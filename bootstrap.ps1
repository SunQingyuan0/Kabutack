$ErrorActionPreference = 'Stop'

# TODO: 发布到 GitHub 后，把这里替换为真实仓库地址
$RepoUrl = 'https://github.com/<owner>/<repo>.git'
$InstallDir = Join-Path $env:TEMP 'kabutack-install'

if (Test-Path $InstallDir) {
  Remove-Item $InstallDir -Recurse -Force
}

git clone --depth 1 $RepoUrl $InstallDir
& (Join-Path $InstallDir 'install.ps1') @args
