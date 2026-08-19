$ErrorActionPreference = 'Stop'

$ArchiveUrl = 'https://codeload.github.com/SunQingyuan0/Kabutack/tar.gz/refs/heads/main'
$InstallDir = Join-Path $env:TEMP 'kabutack-install'
$Archive = Join-Path $env:TEMP 'kabutack-install.tar.gz'

# Remove stale copies, then download and extract the repository archive.
# This avoids requiring git for the one-line installer.
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
if (Test-Path $Archive) { Remove-Item $Archive -Force }
Invoke-WebRequest -Uri $ArchiveUrl -OutFile $Archive -UseBasicParsing
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
tar -xzf $Archive -C $InstallDir --strip-components 1

& (Join-Path $InstallDir 'install.ps1') @args
