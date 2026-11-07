[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('export', 'inspect', 'import', 'verify')]
  [string]$Action,
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9][a-z0-9-]{2,47}$')]
  [string]$SnapshotId
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$exitCode = 1
$password = $null
$pointer = [IntPtr]::Zero
$child = $null
$startInfo = $null
$privateNames = @('LOCAL_MIGRATION_PASSWORD', 'NEON_MIGRATION_PASSWORD', 'NEON_MIGRATION_HOST', 'NEON_MIGRATION_CONFIRM_TARGET', 'MIGRATION_EXPECTED_SHA256', 'PGPASSWORD')
try {
  $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
  $package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
  if ($package.name -ne '@platypus/workspace') { throw 'Unexpected project.' }
  $entry = Join-Path $projectRoot 'apps\server\database\neon\cli.mjs'
  if (!(Test-Path -LiteralPath $entry -PathType Leaf) -or $entry -match '["\r\n]') { throw 'Missing command.' }
  if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'apps\server\dist\neon-connection.js') -PathType Leaf)) {
    throw 'Build the reviewed server before using this runner.'
  }
  $node = (Get-Command -Name 'node.exe' -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  $startInfo = New-Object Diagnostics.ProcessStartInfo
  $startInfo.FileName = $node
  $startInfo.Arguments = '"' + $entry + '" ' + $Action + ' ' + $SnapshotId
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }

  if ($Action -ne 'export') {
    $expected = Read-Host -Prompt 'Paste the SHA256 recorded when exporting this snapshot'
    if ($expected -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid expected digest.' }
    $startInfo.EnvironmentVariables['MIGRATION_EXPECTED_SHA256'] = $expected
  }
  if ($Action -in @('import', 'verify')) {
    $selectedHost = Read-Host -Prompt 'Direct Neon host in Frankfurt (hostname only, no pooler or URL)'
    if ($selectedHost -cnotmatch '^ep-[a-z0-9]+(-[a-z0-9]+)*\.(c-[1-9][0-9]*\.)?eu-central-1\.aws\.neon\.tech$' -or
        $selectedHost.Split('.')[0].EndsWith('-pooler')) { throw 'Invalid direct endpoint.' }
    Write-Host ('Selected {0}: {1}/neondb as neondb_owner.' -f $Action, $selectedHost)
    $confirmation = Read-Host -Prompt 'Confirm by typing the complete hostname/neondb shown above'
    if ($confirmation -cne ($selectedHost + '/neondb')) { throw 'Target confirmation differs.' }
    $startInfo.EnvironmentVariables['NEON_MIGRATION_HOST'] = $selectedHost
    $startInfo.EnvironmentVariables['NEON_MIGRATION_CONFIRM_TARGET'] = $confirmation
    $password = Read-Host -Prompt 'Private password for Neon neondb_owner' -AsSecureString
    $passwordName = 'NEON_MIGRATION_PASSWORD'
  } elseif ($Action -eq 'export') {
    Write-Host 'Read-only export from 127.0.0.1:5432/platypus_service_large as platypus_app.'
    $password = Read-Host -Prompt 'Private LOCAL password for platypus_app' -AsSecureString
    $passwordName = 'LOCAL_MIGRATION_PASSWORD'
  }
  if ($null -ne $password) {
    if ($password.Length -eq 0) { throw 'An empty password is unsupported.' }
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $startInfo.EnvironmentVariables[$passwordName] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  try { $child = [Diagnostics.Process]::Start($startInfo) }
  finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $pointer = [IntPtr]::Zero }
    if ($null -ne $password) { $password.Dispose(); $password = $null }
    foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }
  }
  $outputTask = $child.StandardOutput.ReadToEndAsync()
  $errorTask = $child.StandardError.ReadToEndAsync()
  if (!$child.WaitForExit(420000)) { throw 'Owned migration child exceeded its budget.' }
  $exitCode = $child.ExitCode
  $safeOutput = $outputTask.GetAwaiter().GetResult()
  $privateError = $errorTask.GetAwaiter().GetResult()
  if ($exitCode -eq 0 -and $safeOutput.Length -le 16384 -and $privateError.Length -eq 0) {
    Write-Host $safeOutput.Trim()
  } else {
    Write-Host 'The selected migration action failed. For an uncertain import, run explicit verify before retrying.'
    $exitCode = 1
  }
  $privateError = $null
} catch {
  Write-Host 'The migration runner did not complete. Check the reviewed command, snapshot digest and privately entered configuration. No automatic retry was attempted.'
  $exitCode = 1
} finally {
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  if ($null -ne $password) { $password.Dispose() }
  if ($null -ne $startInfo) {
    foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }
  }
  if ($null -ne $child) {
    try {
      if (!$child.HasExited) {
        $stopInfo = New-Object Diagnostics.ProcessStartInfo
        $stopInfo.FileName = Join-Path ([Environment]::GetFolderPath('System')) 'taskkill.exe'
        $stopInfo.Arguments = '/PID ' + $child.Id + ' /T /F'
        $stopInfo.UseShellExecute = $false
        $stopInfo.CreateNoWindow = $true
        $stopInfo.RedirectStandardOutput = $true
        $stopInfo.RedirectStandardError = $true
        $stopChild = [Diagnostics.Process]::Start($stopInfo)
        try {
          if (!$stopChild.WaitForExit(5000) -or $stopChild.ExitCode -ne 0 -or !$child.WaitForExit(5000)) {
            Write-Host 'The owned migration process may need to be stopped in this terminal.'
          }
        } finally { $stopChild.Dispose() }
      }
    } catch { Write-Host 'The owned migration process may need to be stopped in this terminal.' }
    finally { $child.Dispose() }
  }
}
exit $exitCode
