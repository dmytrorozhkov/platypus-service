[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('check', 'serve')]
  [string]$Action
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$exitCode = 1
$password = $null
$pointer = [IntPtr]::Zero
$child = $null
$startInfo = $null
$stdoutTask = $null
$stderrTask = $null
$privateNames = @('NEON_HOST', 'NEON_DATABASE', 'NEON_USER', 'NEON_PASSWORD', 'NEON_CONFIRM_TARGET', 'NEON_CONTROL_STDIN', 'PGPASSWORD', 'PORT', 'ALLOWED_ORIGINS')
try {
  $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
  $package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
  $entry = Join-Path $projectRoot 'apps\server\dist\neon-main.js'
  if ($package.name -ne '@platypus/workspace' -or !(Test-Path -LiteralPath $entry -PathType Leaf) -or $entry -match '["\r\n]') {
    throw 'Build the reviewed server first.'
  }
  $selectedHost = Read-Host -Prompt 'Pooled Neon Frankfurt hostname only (contains -pooler, no URL)'
  if ($selectedHost -cnotmatch '^ep-[a-z0-9]+(-[a-z0-9]+)*-pooler\.(c-[1-9][0-9]*\.)?eu-central-1\.aws\.neon\.tech$') {
    throw 'Invalid pooled endpoint.'
  }
  Write-Host ('Selected {0}: {1}/neondb as restricted platypus_app.' -f $Action, $selectedHost)
  $confirmation = Read-Host -Prompt 'Confirm by typing the complete hostname/neondb shown above'
  if ($confirmation -cne ($selectedHost + '/neondb')) { throw 'Target confirmation differs.' }
  $node = (Get-Command -Name 'node.exe' -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  $startInfo = New-Object Diagnostics.ProcessStartInfo
  $startInfo.FileName = $node
  $startInfo.Arguments = '"' + $entry + '" ' + $Action
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }
  $startInfo.EnvironmentVariables['NEON_HOST'] = $selectedHost
  $startInfo.EnvironmentVariables['NEON_DATABASE'] = 'neondb'
  $startInfo.EnvironmentVariables['NEON_USER'] = 'platypus_app'
  $startInfo.EnvironmentVariables['NEON_CONFIRM_TARGET'] = $confirmation
  $startInfo.EnvironmentVariables['NEON_CONTROL_STDIN'] = '1'
  $startInfo.EnvironmentVariables['PORT'] = '3002'
  $startInfo.EnvironmentVariables['ALLOWED_ORIGINS'] = 'http://localhost:5177'
  $password = Read-Host -Prompt 'Private NEON password for platypus_app (not the local password or owner password)' -AsSecureString
  if ($password.Length -eq 0) { throw 'An empty password is unsupported.' }
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
  $startInfo.EnvironmentVariables['NEON_PASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  try { $child = [Diagnostics.Process]::Start($startInfo) }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $pointer = [IntPtr]::Zero
    $password.Dispose()
    $password = $null
    foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }
  }
  $stdoutTask = $child.StandardOutput.ReadLineAsync()
  $stderrTask = $child.StandardError.ReadLineAsync()
  $clock = [Diagnostics.Stopwatch]::StartNew()
  while (!$child.HasExited) {
    if ($Action -eq 'check' -and $clock.ElapsedMilliseconds -gt 25000) { throw 'Connection check exceeded its budget.' }
    if ($null -ne $stdoutTask -and $stdoutTask.IsCompleted) {
      $line = $stdoutTask.GetAwaiter().GetResult()
      if ($null -eq $line) { $stdoutTask = $null }
      else {
        if ($line.Length -gt 4096) { throw 'Unexpected command output.' }
        Write-Host $line
        $stdoutTask = $child.StandardOutput.ReadLineAsync()
      }
    }
    if ($null -ne $stderrTask -and $stderrTask.IsCompleted) {
      $line = $stderrTask.GetAwaiter().GetResult()
      if ($null -eq $line) { $stderrTask = $null }
      else {
        # The command owns sanitized diagnostics; never forward an unexpected raw failure.
        Write-Host 'A Neon backend operation failed. Check the private role/connection setup.'
        $stderrTask = $child.StandardError.ReadLineAsync()
      }
    }
    Start-Sleep -Milliseconds 100
  }
  $exitCode = $child.ExitCode
  if ($null -ne $stdoutTask) {
    $line = $stdoutTask.GetAwaiter().GetResult()
    if ($null -ne $line -and $line.Length -le 4096) { Write-Host $line }
  }
  if ($exitCode -ne 0) { Write-Host 'The selected Neon backend command failed. No fallback or automatic retry was used.' }
} catch {
  Write-Host 'The Neon backend runner did not complete. Check the reviewed build, pooled hostname and privately entered app credentials.'
  $exitCode = 1
} finally {
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  if ($null -ne $password) { $password.Dispose() }
  if ($null -ne $startInfo) { foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) } }
  if ($null -ne $child) {
    try {
      if (!$child.HasExited) {
        # Request graceful stop of this exclusively owned child before a forced fallback.
        try { $child.StandardInput.WriteLine('stop'); $child.StandardInput.Close() } catch { }
        if (!$child.WaitForExit(25000)) {
          $stopInfo = New-Object Diagnostics.ProcessStartInfo
          $stopInfo.FileName = Join-Path ([Environment]::GetFolderPath('System')) 'taskkill.exe'
          $stopInfo.Arguments = '/PID ' + $child.Id + ' /T /F'
          $stopInfo.UseShellExecute = $false
          $stopInfo.CreateNoWindow = $true
          $stopInfo.RedirectStandardOutput = $true
          $stopInfo.RedirectStandardError = $true
          $stopChild = [Diagnostics.Process]::Start($stopInfo)
          try { if (!$stopChild.WaitForExit(5000) -or !$child.WaitForExit(5000)) { Write-Host 'The owned Neon child may need to be stopped in this terminal.' } }
          finally { $stopChild.Dispose() }
        }
      }
    } catch { Write-Host 'The owned Neon child may need to be stopped in this terminal.' }
    finally { $child.Dispose() }
  }
}
exit $exitCode
