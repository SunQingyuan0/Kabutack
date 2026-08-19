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
# (package renamed to @galactus/kabutack; drop the stale pre-rename link so
# re-running the installer repairs profiles installed before the rename)
$oldLink = Join-Path $profileDir 'node_modules\@dsh-external\kabutack'
if (Test-Path $oldLink) {
  $oldItem = Get-Item $oldLink
  if ($oldItem.LinkType) {
    # Remove the link itself, never its target.
    Remove-Item $oldLink -Force
  } else {
    Remove-Item $oldLink -Recurse -Force
  }
}
$extDir = Join-Path $profileDir 'node_modules\@galactus'
New-Item -ItemType Directory -Force -Path $extDir | Out-Null
$link = Join-Path $extDir 'kabutack'

if (Test-Path $link) {
  $item = Get-Item $link
  if ($item.LinkType) {
    # Remove the link itself, never its target.
    Remove-Item $link -Force
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

# ConvertFrom-Json produces PSCustomObject, whose new properties cannot be
# assigned with dot notation. Use Add-Member for missing keys, and preserve
# any existing dependencies/dsh sections.
if (-not $pkg.PSObject.Properties['dependencies'] -or $null -eq $pkg.dependencies) {
  $pkg | Add-Member -NotePropertyName 'dependencies' -NotePropertyValue ([pscustomobject]@{}) -Force
}
$pkg.dependencies.PSObject.Properties.Remove('@dsh-external/kabutack')
$pkg.dependencies | Add-Member -NotePropertyName '@galactus/kabutack' -NotePropertyValue "link:$TargetDir" -Force

if (-not $pkg.PSObject.Properties['dsh'] -or $null -eq $pkg.dsh) {
  $pkg | Add-Member -NotePropertyName 'dsh' -NotePropertyValue ([pscustomobject]@{}) -Force
}
if (-not $pkg.dsh.PSObject.Properties['profile'] -or $null -eq $pkg.dsh.profile) {
  $pkg.dsh | Add-Member -NotePropertyName 'profile' -NotePropertyValue ([pscustomobject]@{}) -Force
}
if (-not $pkg.dsh.profile.PSObject.Properties['bundles'] -or $null -eq $pkg.dsh.profile.bundles) {
  $pkg.dsh.profile | Add-Member -NotePropertyName 'bundles' -NotePropertyValue @() -Force
}

$bundles = @($pkg.dsh.profile.bundles | Where-Object { $_ -ne $null -and $_ -ne '@dsh-external/kabutack' })
if ($bundles -notcontains '@galactus/kabutack') {
  $bundles += '@galactus/kabutack'
}
$pkg.dsh.profile.bundles = $bundles

$json = $pkg | ConvertTo-Json -Depth 10
# Use UTF-8 without BOM; Windows PowerShell's Set-Content -Encoding UTF8 writes a
# BOM that Node.js JSON.parse cannot handle and would break DSH profile loading.
[System.IO.File]::WriteAllText($packageFile, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))


Write-Host ""
Write-Host "Kabutack installed successfully."
Write-Host "  Profile : $Profile"
Write-Host "  Package : $TargetDir"
Write-Host "  Link    : $link"
Write-Host ""
Write-Host "Next: restart DSH (or reload the profile) to load the plugin."
