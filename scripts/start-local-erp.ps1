param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Continue'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ApiDir = Join-Path $RepoRoot 'apps\api'
$WebDir = Join-Path $RepoRoot 'apps\web-admin'
$EvolutionDir = 'C:\evolution-api'
$LogDir = Join-Path $RepoRoot '.codex_tmp\launcher-logs'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[UYARI] $Message" -ForegroundColor Yellow
}

function Write-Bad {
  param([string]$Message)
  Write-Host "[HATA] $Message" -ForegroundColor Red
}

function Test-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutSec = 3
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec $TimeoutSec
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutSec = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk -Url $Url -TimeoutSec 3) {
      return $true
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Get-LanIp {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -like '192.168.*' `
        -and $_.PrefixOrigin -ne 'WellKnown' `
        -and $_.InterfaceAlias -notlike 'vEthernet*' `
        -and $_.InterfaceAlias -notlike '*Default Switch*' `
        -and $_.InterfaceAlias -notlike '*Docker*'
    } |
    Sort-Object @{ Expression = { if ($_.PrefixOrigin -eq 'Dhcp') { 0 } else { 1 } } }, InterfaceAlias |
    Select-Object -First 1 -ExpandProperty IPAddress

  if (-not $ip) {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -notlike '127.*' `
          -and $_.PrefixOrigin -ne 'WellKnown' `
          -and $_.InterfaceAlias -notlike 'vEthernet*' `
          -and $_.InterfaceAlias -notlike '*Default Switch*' `
          -and $_.InterfaceAlias -notlike '*Docker*'
      } |
      Select-Object -First 1 -ExpandProperty IPAddress
  }

  if ($ip) { return $ip }
  return 'localhost'
}

function Get-EnvMap {
  param([string]$Path)

  $map = @{}
  if (-not (Test-Path $Path)) {
    return $map
  }

  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $map[$matches[1].Trim()] = $matches[2].Trim().Trim('"')
    }
  }

  return $map
}

function Start-NodeAppIfNeeded {
  param(
    [string]$Name,
    [string]$Directory,
    [string[]]$Arguments,
    [string]$HealthUrl,
    [hashtable]$Environment = @{}
  )

  if (Test-HttpOk -Url $HealthUrl -TimeoutSec 3) {
    Write-Ok "$Name zaten acik"
    return
  }

  Write-Warn "$Name kapali, baslatiliyor"
  $stdout = Join-Path $LogDir "$Name.out.log"
  $stderr = Join-Path $LogDir "$Name.err.log"
  $previousEnv = @{}
  foreach ($key in $Environment.Keys) {
    $previousEnv[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], 'Process')
  }

  try {
    Start-Process -FilePath npm.cmd -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  } finally {
    foreach ($key in $Environment.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previousEnv[$key], 'Process')
    }
  }

  if (Wait-HttpOk -Url $HealthUrl -TimeoutSec 60) {
    Write-Ok "$Name acildi"
  } else {
    Write-Bad "$Name acilamadi. Log: $stdout / $stderr"
  }
}

function Wait-Docker {
  param([int]$TimeoutSec = 120)

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) {
      return $true
    }
    Start-Sleep -Seconds 5
  }
  return $false
}

$lanIp = Get-LanIp
$webUrl = "http://${lanIp}:5173/"
$apiHealthUrl = 'http://localhost:4100/api/health'
$apiLanHealthUrl = "http://${lanIp}:4100/api/health"
$webHealthUrl = 'http://localhost:5173/'
$whatsappUrl = 'http://localhost:8080/'

Write-Host "Melisa ERP Lokal Baslatici" -ForegroundColor White
Write-Host "Repo: $RepoRoot"

Write-Step "Docker / WhatsApp API"
$dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (-not (Wait-Docker -TimeoutSec 3)) {
  if (Test-Path $dockerDesktop) {
    Write-Warn "Docker kapali, Docker Desktop baslatiliyor"
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
  } else {
    Write-Bad "Docker Desktop bulunamadi: $dockerDesktop"
  }
}

if (Wait-Docker -TimeoutSec 120) {
  Write-Ok "Docker hazir"
  if (Test-Path (Join-Path $EvolutionDir 'docker-compose.yml')) {
    docker compose --project-directory $EvolutionDir up -d | Out-Host
    if (Wait-HttpOk -Url $whatsappUrl -TimeoutSec 60) {
      Write-Ok "WhatsApp API acik: $whatsappUrl"
    } else {
      Write-Bad "WhatsApp API 8080 yanit vermiyor"
    }
  } else {
    Write-Warn "Evolution API klasoru bulunamadi: $EvolutionDir"
  }
} else {
  Write-Bad "Docker hazir olmadi; WhatsApp API baslatilamadi"
}

Write-Step "ERP API"
Start-NodeAppIfNeeded -Name 'api' -Directory $ApiDir -Arguments @('run', 'start') -HealthUrl $apiHealthUrl

Write-Step "Web Admin"
Start-NodeAppIfNeeded `
  -Name 'web-admin' `
  -Directory $WebDir `
  -Arguments @('run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173') `
  -HealthUrl $webHealthUrl `
  -Environment @{ VITE_API_BASE_URL = "http://${lanIp}:4100" }

Write-Step "Durum"
if (Test-HttpOk -Url $apiHealthUrl -TimeoutSec 3) { Write-Ok "API local: $apiHealthUrl" } else { Write-Bad "API local kapali" }
if (Test-HttpOk -Url $apiLanHealthUrl -TimeoutSec 3) { Write-Ok "API LAN: $apiLanHealthUrl" } else { Write-Warn "API LAN erisilemiyor: $apiLanHealthUrl" }
if (Test-HttpOk -Url $webHealthUrl -TimeoutSec 3) { Write-Ok "Web local: $webHealthUrl" } else { Write-Bad "Web local kapali" }
if (Test-HttpOk -Url $webUrl -TimeoutSec 3) { Write-Ok "Web LAN: $webUrl" } else { Write-Warn "Web LAN erisilemiyor: $webUrl" }

$evolutionEnv = Get-EnvMap -Path (Join-Path $EvolutionDir '.env')
$evolutionKey = $evolutionEnv['AUTHENTICATION_API_KEY']
if (-not $evolutionKey) { $evolutionKey = $evolutionEnv['API_KEY'] }
$apiEnv = Get-EnvMap -Path (Join-Path $ApiDir '.env.local')
$instance = $apiEnv['WHATSAPP_INSTANCE']
if (-not $instance) { $instance = 'melisa-test' }

if ($evolutionKey -and (Test-HttpOk -Url $whatsappUrl -TimeoutSec 3)) {
  try {
    $stateUrl = "http://localhost:8080/instance/connectionState/$instance"
    $stateResponse = Invoke-WebRequest -UseBasicParsing $stateUrl -Headers @{ apikey = $evolutionKey } -TimeoutSec 10
    $stateJson = $stateResponse.Content | ConvertFrom-Json
    $state = $stateJson.instance.state
    if ($state -eq 'open') {
      Write-Ok "WhatsApp instance: $instance / open"
    } else {
      Write-Warn "WhatsApp instance: $instance / $state"
    }
  } catch {
    Write-Warn "WhatsApp instance durumu okunamadi"
  }
} elseif (Test-HttpOk -Url $whatsappUrl -TimeoutSec 3) {
  Write-Ok "WhatsApp API acik, instance durumu okunamadi"
} else {
  Write-Bad "WhatsApp API kapali"
}

if (-not $NoBrowser -and (Test-HttpOk -Url $webUrl -TimeoutSec 3)) {
  Start-Process $webUrl
}

Write-Host ""
Write-Host "Hazir. Web adresi: $webUrl" -ForegroundColor Green
