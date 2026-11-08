[CmdletBinding(PositionalBinding = $false)]
param()
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$exitCode = 1
$child = $null
$startInfo = $null
$privateValues = @()
$pointers = @()
$newValue = $null
$repeatValue = $null
$ownerValue = $null
$localRefusal = $null
$childStartAttempted = $false
$privateNames = @('NEON_MIGRATION_HOST', 'NEON_MIGRATION_CONFIRM_TARGET', 'NEON_MIGRATION_PASSWORD', 'NEON_APP_NEW_PASSWORD', 'NEON_HOST', 'NEON_USER', 'NEON_DATABASE', 'NEON_PASSWORD', 'PGPASSWORD', 'LOCAL_MIGRATION_PASSWORD')
try {
  $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
  $package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
  $entry = Join-Path $projectRoot 'apps\server\database\neon\runtime-password.mjs'
  if ($package.name -ne '@platypus/workspace' -or !(Test-Path -LiteralPath $entry -PathType Leaf) -or $entry -match '["\r\n]' -or !(Test-Path -LiteralPath (Join-Path $projectRoot 'apps\server\dist\neon-connection.js') -PathType Leaf)) {
    throw 'Use the reviewed project and server build.'
  }
  $selectedHost = Read-Host -Prompt 'Direct Neon Frankfurt hostname only (no pooler or URL)'
  if ($selectedHost -cnotmatch '^ep-[a-z0-9]+(-[a-z0-9]+)*\.(c-[1-9][0-9]*\.)?eu-central-1\.aws\.neon\.tech$' -or $selectedHost.Split('.')[0].EndsWith('-pooler')) { throw 'Unexpected target.' }
  Write-Host ('Set only the existing platypus_app password at {0}/neondb using neondb_owner.' -f $selectedHost)
  $confirmation = Read-Host -Prompt 'Confirm by typing the complete hostname/neondb shown above'
  if ($confirmation -cne ($selectedHost + '/neondb')) { throw 'Target confirmation differs.' }
  $node = (Get-Command -Name 'node.exe' -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  $startInfo = New-Object Diagnostics.ProcessStartInfo
  $startInfo.FileName = $node
  $startInfo.Arguments = '"' + $entry + '" set'
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }
  $startInfo.EnvironmentVariables['NEON_MIGRATION_HOST'] = $selectedHost
  $startInfo.EnvironmentVariables['NEON_MIGRATION_CONFIRM_TARGET'] = $confirmation
  $privateValues += Read-Host -Prompt 'Private existing Neon neondb_owner password' -AsSecureString
  $privateValues += Read-Host -Prompt 'NEW private platypus_app password (20-128 printable ASCII characters; use a random 32-character password)' -AsSecureString
  $privateValues += Read-Host -Prompt 'Repeat the NEW private platypus_app password' -AsSecureString
  if ($privateValues[0].Length -eq 0) { $localRefusal = 'OWNER_EMPTY'; throw 'Local private input refused.' }
  if ($privateValues[1].Length -lt 20 -or $privateValues[1].Length -gt 128) { $localRefusal = 'APP_LENGTH'; throw 'Local private input refused.' }
  if ($privateValues[2].Length -ne $privateValues[1].Length) { $localRefusal = 'APP_CONFIRMATION'; throw 'Local private input refused.' }
  foreach ($value in $privateValues) { $pointers += [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value) }
  $newValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointers[1])
  $repeatValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointers[2])
  if (![string]::Equals($newValue, $repeatValue, [StringComparison]::Ordinal)) { $localRefusal = 'APP_CONFIRMATION'; throw 'Local private input refused.' }
  foreach ($character in $newValue.ToCharArray()) {
    if ([int]$character -lt 32 -or [int]$character -gt 126) { $localRefusal = 'APP_ASCII'; throw 'Local private input refused.' }
  }
  $ownerValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointers[0])
  if ([string]::Equals($newValue, $ownerValue, [StringComparison]::Ordinal)) { $localRefusal = 'OWNER_REUSE'; throw 'Local private input refused.' }
  $startInfo.EnvironmentVariables['NEON_MIGRATION_PASSWORD'] = $ownerValue
  $startInfo.EnvironmentVariables['NEON_APP_NEW_PASSWORD'] = $newValue
  try { $childStartAttempted = $true; $child = [Diagnostics.Process]::Start($startInfo) }
  finally {
    foreach ($pointer in $pointers) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $pointers = @()
    foreach ($value in $privateValues) { $value.Dispose() }
    $privateValues = @()
    $newValue = $null
    $repeatValue = $null
    $ownerValue = $null
    foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }
  }
  $stdoutTask = $child.StandardOutput.ReadToEndAsync()
  $stderrTask = $child.StandardError.ReadToEndAsync()
  if (!$child.WaitForExit(70000)) { throw 'Owned command exceeded its budget.' }
  $safeOutput = $stdoutTask.GetAwaiter().GetResult()
  $privateError = $stderrTask.GetAwaiter().GetResult()
  if ($child.ExitCode -ne 0 -or $privateError.Length -ne 0 -or $safeOutput.Length -gt 4096) { throw 'The result is not confirmed.' }
  $receipt = $safeOutput | ConvertFrom-Json
  if ((@($receipt.PSObject.Properties.Name) -join ',') -cne 'operation,role,database,passwordConfigured' -or $receipt.operation -cne 'set-runtime-password' -or $receipt.role -cne 'platypus_app' -or $receipt.database -cne 'neondb' -or $receipt.passwordConfigured -isnot [bool] -or !$receipt.passwordConfigured) { throw 'Unexpected result.' }
  # Forward only this fixed receipt, never raw child output or an exception.
  Write-Host '{"operation":"set-runtime-password","role":"platypus_app","database":"neondb","passwordConfigured":true}'
  $exitCode = 0
} catch {
  if (!$childStartAttempted) {
    # Codes and messages are fixed. Never report supplied values, actual lengths or exceptions.
    switch ($localRefusal) {
      'OWNER_EMPTY' { Write-Host '[NEON_PASSWORD_INPUT_OWNER_EMPTY] The owner password must not be empty.' }
      'APP_LENGTH' { Write-Host '[NEON_PASSWORD_INPUT_APP_LENGTH] The new app password must contain 20-128 characters.' }
      'APP_CONFIRMATION' { Write-Host '[NEON_PASSWORD_INPUT_APP_CONFIRMATION] The repeated app password must match exactly.' }
      'APP_ASCII' { Write-Host '[NEON_PASSWORD_INPUT_APP_ASCII] The new app password must use printable ASCII characters only.' }
      'OWNER_REUSE' { Write-Host '[NEON_PASSWORD_INPUT_OWNER_REUSE] The app password must differ from the owner password.' }
      default { Write-Host '[NEON_PASSWORD_PREPARATION_FAILED] Local password setup did not complete.' }
    }
    Write-Host 'No child process was started; no remote password operation was attempted.'
  } else {
    Write-Host '[NEON_PASSWORD_RESULT_UNCONFIRMED] Neon app password setup was not confirmed. No automatic retry was used. Run the app connection check with the new password before explicitly retrying.'
  }
} finally {
  foreach ($pointer in $pointers) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  foreach ($value in $privateValues) { $value.Dispose() }
  $newValue = $null
  $repeatValue = $null
  $ownerValue = $null
  if ($null -ne $startInfo) { foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) } }
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
        try { if (!$stopChild.WaitForExit(5000) -or !$child.WaitForExit(5000)) { Write-Host 'The owned password-setup child may need to be stopped in this terminal.' } }
        finally { $stopChild.Dispose() }
      }
    } catch { Write-Host 'The owned password-setup child may need to be stopped in this terminal.' }
    finally { $child.Dispose() }
  }
}
exit $exitCode
