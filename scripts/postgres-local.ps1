[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('migrate', 'seed', 'check', 'serve', 'migrate-large', 'seed-large', 'check-large', 'serve-large')]
  [string]$Action
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$exitCode = 1
$password = $null
$passwordPointer = [IntPtr]::Zero
$startInfo = $null
$child = $null
$environmentBefore = @{}
$environmentChanges = @{
  PGHOST = '127.0.0.1'
  PGPORT = '5432'
  PGDATABASE = 'platypus_service'
  PGUSER = 'platypus_owner'
  PGPASSWORD = $null
  PGSSLMODE = 'disable'
  PGOPTIONS = $null
  PORT = $null
  ALLOWED_ORIGINS = $null
}

try {
  $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
  $packagePath = Join-Path $projectRoot 'package.json'
  $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
  $commands = @{
    migrate = 'db:migrate'
    seed = 'db:seed'
    check = 'db:check'
    serve = 'start:server:postgres'
    'migrate-large' = 'db:large:migrate'
    'seed-large' = 'db:large:seed'
    'check-large' = 'db:large:check'
    'serve-large' = 'start:server:postgres'
  }
  $command = $commands[$Action]
  if ($package.name -ne '@platypus/workspace' -or
      $null -eq $package.scripts.PSObject.Properties[$command]) {
    throw 'The expected project command is unavailable.'
  }

  $npm = (Get-Command -Name 'npm.cmd' -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  if ([IO.Path]::GetFileName($npm) -ne 'npm.cmd' -or $npm -match '[%"!\r\n]') {
    throw 'The npm command path is unsupported.'
  }
  $commandInterpreter = Join-Path ([Environment]::GetFolderPath('System')) 'cmd.exe'
  if (!(Test-Path -LiteralPath $commandInterpreter -PathType Leaf)) {
    throw 'The Windows command interpreter is unavailable.'
  }
  if ($Action -in @('serve', 'serve-large')) { $environmentChanges.PGUSER = 'platypus_app' }
  if ($Action.EndsWith('-large')) { $environmentChanges.PGDATABASE = 'platypus_service_large' }
  if ($Action -eq 'serve-large') {
    $environmentChanges.PORT = '3001'
    $environmentChanges.ALLOWED_ORIGINS = 'http://localhost:5176'
  }

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $commandInterpreter
  $startInfo.Arguments = '/d /s /c ""' + $npm + '" run ' + $command + '"'
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $false

  foreach ($name in $environmentChanges.Keys) {
    $environmentBefore[$name] = @{
      Present = $startInfo.EnvironmentVariables.ContainsKey($name)
      Value = $startInfo.EnvironmentVariables[$name]
    }
  }

  Write-Host ('Local PostgreSQL: {0} as {1} at 127.0.0.1:5432/{2}.' -f $Action, $environmentChanges.PGUSER, $environmentChanges.PGDATABASE)
  $password = Read-Host -Prompt ('Password for ' + $environmentChanges.PGUSER) -AsSecureString
  if ($password.Length -eq 0) { throw 'An empty password is unsupported.' }

  foreach ($name in $environmentChanges.Keys) {
    if ($name -ne 'PGPASSWORD') {
      if ($null -eq $environmentChanges[$name]) {
        $startInfo.EnvironmentVariables.Remove($name)
      } else {
        $startInfo.EnvironmentVariables[$name] = $environmentChanges[$name]
      }
    }
  }
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
  $startInfo.EnvironmentVariables['PGPASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  try {
    $child = [Diagnostics.Process]::Start($startInfo)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $passwordPointer = [IntPtr]::Zero
    $startInfo.EnvironmentVariables.Remove('PGPASSWORD')
    $password.Dispose()
    $password = $null
  }

  $child.WaitForExit()
  $exitCode = $child.ExitCode
  if ($exitCode -ne 0) {
    Write-Host 'The selected local PostgreSQL command did not complete successfully.'
  }
} catch {
  # Never echo an exception that might include environment or process details.
  Write-Host 'The local PostgreSQL runner failed. Check the selected command and local configuration.'
  $exitCode = 1
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  if ($null -ne $password) { $password.Dispose() }
  if ($null -ne $child) {
    try {
      if (!$child.HasExited) {
        # Only the foreground process tree created above belongs to this runner.
        $stopInfo = New-Object System.Diagnostics.ProcessStartInfo
        $stopInfo.FileName = Join-Path ([Environment]::GetFolderPath('System')) 'taskkill.exe'
        $stopInfo.Arguments = '/PID ' + $child.Id + ' /T /F'
        $stopInfo.UseShellExecute = $false
        $stopInfo.CreateNoWindow = $true
        $stopInfo.RedirectStandardOutput = $true
        $stopInfo.RedirectStandardError = $true
        $stopChild = [Diagnostics.Process]::Start($stopInfo)
        try {
          $stopFinished = $stopChild.WaitForExit(5000)
          $stopSucceeded = $stopFinished -and $stopChild.ExitCode -eq 0
          $ownedChildExited = $child.WaitForExit(5000)
          if (!$stopSucceeded -or !$ownedChildExited) {
            Write-Host 'An owned child process may need to be stopped in this terminal.'
            $exitCode = 1
          }
        } finally { $stopChild.Dispose() }
      }
    } catch {
      Write-Host 'An owned child process may need to be stopped in this terminal.'
      $exitCode = 1
    } finally {
      $child.Dispose()
    }
  }
  if ($null -ne $startInfo) {
    foreach ($name in $environmentBefore.Keys) {
      if ($environmentBefore[$name].Present) {
        $startInfo.EnvironmentVariables[$name] = $environmentBefore[$name].Value
      } else {
        $startInfo.EnvironmentVariables.Remove($name)
      }
      $environmentBefore[$name].Value = $null
    }
  }
  $environmentBefore.Clear()
  $startInfo = $null
}

exit $exitCode
