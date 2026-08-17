param(
  [string]$Profile = 'web',
  [string]$TargetDir = '',
  [string]$SourceDir = ''
)

$ErrorActionPreference = 'Stop'

if (-not $SourceDir) {
  $SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$SourceDir = [System.IO.Path]::GetFullPath($SourceDir)

$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$profileDir = Join-Path $dshHome "profiles\$Profile"
$packageFile = Join-Path $profileDir 'package.json'

if (-not (Test-Path $packageFile)) {
  throw "DSH profile not found: $packageFile"
}

if (-not $TargetDir) {
  $TargetDir = Join-Path $dshHome 'kabutack'
}
$TargetDir = [System.IO.Path]::GetFullPath($TargetDir)

# 1. Copy runtime files to a stable location
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
$targetLib = Join-Path $TargetDir 'lib'
New-Item -ItemType Directory -Force -Path $targetLib | Out-Null
Copy-Item -Force -Recurse (Join-Path $SourceDir 'lib\*') $targetLib
Copy-Item -Force (Join-Path $SourceDir 'package.json') (Join-Path $TargetDir 'package.json')
Copy-Item -Force (Join-Path $SourceDir 'cordis.patch.yml') (Join-Path $TargetDir 'cordis.patch.yml')

# 2. Create node_modules junction/symlink inside the DSH profile
$extDir = Join-Path $profileDir 'node_modules\@dsh-external'
New-Item -ItemType Directory -Force -Path $extDir | Out-Null
$link = Join-Path $extDir 'kabutack'

if (Test-Path $link) {
  $item = Get-Item $link
  if ($item.LinkType) {
    if ($env:OS -like 'Windows*') {
      cmd /c rmdir "$link"
    } else {
      Remove-Item $link -Force
    }
  } else {
    Remove-Item $link -Recurse -Force
  }
}

if ($env:OS -like 'Windows*') {
  New-Item -ItemType Junction -Path $link -Target $TargetDir | Out-Null
} else {
  New-Item -ItemType SymbolicLink -Path $link -Target $TargetDir | Out-Null
}

# 3. Register bundle in profile package.json
$pkg = Get-Content $packageFile -Raw | ConvertFrom-Json
if (-not $pkg.dependencies) { $pkg.dependencies = @{} }
$pkg.dependencies.'@dsh-external/kabutack' = "link:$TargetDir"
if (-not $pkg.dsh) { $pkg.dsh = @{} }
if (-not $pkg.dsh.profile) { $pkg.dsh.profile = @{} }
if (-not $pkg.dsh.profile.bundles) { $pkg.dsh.profile.bundles = @() }
$bundles = @($pkg.dsh.profile.bundles)
if ($bundles -notcontains '@dsh-external/kabutack') {
  $bundles += '@dsh-external/kabutack'
}
$pkg.dsh.profile.bundles = $bundles
$pkg | ConvertTo-Json -Depth 10 | Set-Content -Path $packageFile -Encoding UTF8

Write-Host ""
Write-Host "Kabutack installed successfully."
Write-Host "  Profile : $Profile"
Write-Host "  Package : $TargetDir"
Write-Host "  Link    : $link"
Write-Host ""
Write-Host "Next: restart DSH (or reload the profile) to load the plugin."
