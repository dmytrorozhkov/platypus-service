$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageSource = [IO.Path]::GetFullPath($env:PLATYPUS_PACKAGE_SOURCE)
$packageArchive = [IO.Path]::GetFullPath($env:PLATYPUS_PACKAGE_ARCHIVE)
$packageExtract = [IO.Path]::GetFullPath($env:PLATYPUS_PACKAGE_EXTRACT)
if (!(Test-Path -LiteralPath $packageSource -PathType Container)) { throw 'Package source is missing.' }
if ((Test-Path -LiteralPath $packageArchive) -or (Test-Path -LiteralPath $packageExtract)) { throw 'Archive targets already exist.' }
$packageFiles = Get-ChildItem -LiteralPath $packageSource -Recurse -File | Sort-Object FullName
$packageStream = [IO.File]::Open($packageArchive, [IO.FileMode]::CreateNew)
$packageZip = New-Object IO.Compression.ZipArchive($packageStream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
  foreach ($packageFile in $packageFiles) {
    if ($packageFile.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Archive source cannot be a link.' }
    $packageName = $packageFile.FullName.Substring($packageSource.Length + 1).Replace('\', '/')
    $packageEntry = $packageZip.CreateEntry($packageName, [IO.Compression.CompressionLevel]::Optimal)
    $packageEntry.LastWriteTime = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
    $packageInput = [IO.File]::OpenRead($packageFile.FullName)
    $packageOutput = $packageEntry.Open()
    try { $packageInput.CopyTo($packageOutput) } finally { $packageInput.Dispose(); $packageOutput.Dispose() }
  }
} finally { $packageZip.Dispose(); $packageStream.Dispose() }
[IO.Compression.ZipFile]::ExtractToDirectory($packageArchive, $packageExtract)
