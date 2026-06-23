param(
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$DesktopDir = Join-Path $RepoRoot 'apps\desktop'
$RuntimeDir = Join-Path $RepoRoot '.codex_tmp\electron-runtime'
$RuntimePackageJson = Join-Path $RuntimeDir 'package.json'
$ElectronCmd = Join-Path $RuntimeDir 'node_modules\.bin\electron.cmd'

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

if (-not (Test-Path $RuntimePackageJson)) {
  @'
{"private":true,"devDependencies":{"electron":"39.8.10"}}
'@ | Set-Content -Encoding ASCII -Path $RuntimePackageJson
}

if (-not (Test-Path $ElectronCmd)) {
  if ($NoInstall) {
    throw "Electron runtime bulunamadi. Kurulum icin -NoInstall kullanmadan calistirin."
  }

  Push-Location $RuntimeDir
  try {
    npm.cmd install
  } finally {
    Pop-Location
  }
}

Start-Process -FilePath $ElectronCmd -ArgumentList @($DesktopDir) -WorkingDirectory $DesktopDir
Write-Host "Melisa ERP Electron aciliyor..." -ForegroundColor Green
