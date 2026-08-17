$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/SunQingyuan0/Kabutack.git'
$InstallDir = Join-Path $env:TEMP 'kabutack-install'

if (Test-Path $InstallDir) {
  Remove-Item $InstallDir -Recurse -Force
}

git clone --depth 1 $RepoUrl $InstallDir
& (Join-Path $InstallDir 'install.ps1') @args
