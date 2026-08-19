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

# 2. Drop the stale pre-rename package/link so re-running the installer repairs
# profiles installed before the rename. The new dependency/bundle registration
# is left to the official `dsh plugin` command below.
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

$pkg = Get-Content $packageFile -Raw | ConvertFrom-Json
$changed = $false

if ($pkg.PSObject.Properties['dependencies'] -and $null -ne $pkg.dependencies) {
  if ($pkg.dependencies.PSObject.Properties['@dsh-external/kabutack']) {
    $pkg.dependencies.PSObject.Properties.Remove('@dsh-external/kabutack')
    $changed = $true
  }
}

if ($pkg.PSObject.Properties['dsh'] -and $null -ne $pkg.dsh) {
  if ($pkg.dsh.PSObject.Properties['profile'] -and $null -ne $pkg.dsh.profile) {
    if ($pkg.dsh.profile.PSObject.Properties['bundles'] -and $null -ne $pkg.dsh.profile.bundles) {
      $bundles = @($pkg.dsh.profile.bundles | Where-Object { $_ -ne $null -and $_ -ne '@dsh-external/kabutack' })
      if ($bundles.Count -ne @($pkg.dsh.profile.bundles).Count) {
        $pkg.dsh.profile.bundles = $bundles
        $changed = $true
      }
    }
  }
}

if ($changed) {
  $json = $pkg | ConvertTo-Json -Depth 10
  # Use UTF-8 without BOM; Windows PowerShell's Set-Content -Encoding UTF8 writes a
  # BOM that Node.js JSON.parse cannot handle and would break DSH profile loading.
  [System.IO.File]::WriteAllText($packageFile, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
}

# 3. Use the official DSH plugin CLI to install and register the bundle.
if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) {
  throw "dsh CLI not found on PATH. Install DSH first, then re-run this script."
}

Write-Host "Running: dsh plugin --profile $Profile add $TargetDir"
& dsh plugin --profile $Profile add $TargetDir
if ($LASTEXITCODE -ne 0) {
  throw "dsh plugin failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Kabutack installed successfully (official dsh plugin)."
Write-Host "  Profile : $Profile"
Write-Host "  Package : $TargetDir"
Write-Host ""
Write-Host "Next: restart DSH (or reload the profile) to load the plugin."
