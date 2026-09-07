param(
  [switch]$VerboseStatus
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $env:LOCALAPPDATA 'MelisaERPServer'
$LogDir = Join-Path $RuntimeRoot 'logs'
$WatchdogLog = Join-Path $LogDir 'watchdog.log'
$NodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
$DockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
$EvolutionCompose = 'C:\Users\Xaser\Documents\Websitesi\melisa-crm\docker-compose.yml'
$CrmCompose = Join-Path $RepoRoot 'docker-compose.whatsapp-crm.yml'
$ChatwootCompose = Join-Path $RepoRoot 'infra\chatwoot\docker-compose.yml'
$ChatwootEnv = Join-Path $RepoRoot 'infra\chatwoot\.env'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, 'MelisaErpServerWatchdog')
$hasLock = $false

function Write-ServerLog {
  param([string]$Message)

  if ((Test-Path $WatchdogLog) -and (Get-Item $WatchdogLog).Length -gt 10MB) {
    Move-Item -Force -LiteralPath $WatchdogLog -Destination "$WatchdogLog.previous"
  }

  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -LiteralPath $WatchdogLog -Value $line
  if ($VerboseStatus) { Write-Host $line }
}

function Test-HttpOk {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 4
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Test-PortListening {
  param([int]$Port)

  return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Get-LanIp {
  $address = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -like '192.168.*' -and
      $_.AddressState -eq 'Preferred' -and
      $_.InterfaceAlias -notlike 'vEthernet*' -and
      $_.InterfaceAlias -notlike '*Docker*'
    } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress

  if ($address) { return $address }
  return '127.0.0.1'
}

function Test-DockerReady {
  docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Ensure-DockerReady {
  if (Test-DockerReady) { return $true }

  if (-not (Test-Path -LiteralPath $DockerDesktop)) {
    Write-ServerLog 'ERROR Docker Desktop bulunamadi.'
    return $false
  }

  Write-ServerLog 'RECOVER Docker Desktop baslatiliyor.'
  Start-Process -FilePath $DockerDesktop -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    if (Test-DockerReady) {
      Write-ServerLog 'OK Docker Desktop hazir.'
      return $true
    }
  }

  Write-ServerLog 'WARN Docker Desktop 45 saniyede hazir olmadi; sonraki kontrolde yeniden denenecek.'
  return $false
}

function Invoke-ComposeUp {
  param(
    [string]$ComposeFile,
    [string[]]$Services = @()
  )

  if (-not (Test-Path -LiteralPath $ComposeFile)) { return }

  $arguments = @('compose', '-f', $ComposeFile, 'up', '-d') + $Services
  $output = & docker @arguments 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-ServerLog "OK Docker compose hazir: $ComposeFile $($Services -join ',')"
  } else {
    $safeError = ($output | Select-Object -Last 2) -join ' '
    Write-ServerLog "WARN Docker compose baslatma sorunu: $safeError"
  }
}

function Start-NodeServiceIfDown {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string[]]$Arguments,
    [string]$HealthUrl,
    [int]$Port,
    [hashtable]$Environment = @{}
  )

  if ($Name -eq 'erp-api') {
    $leasePath = Join-Path $RuntimeRoot 'api-restart-lease.json'
    if (Test-Path -LiteralPath $leasePath) {
      try {
        $lease = Get-Content -LiteralPath $leasePath -Raw | ConvertFrom-Json
        if ([long]$lease.expiresAt -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -and (Get-Process -Id $lease.ownerPid -ErrorAction SilentlyContinue)) {
          Write-ServerLog 'SKIP erp-api: guarded restart owns the short-lived lease.'
          return
        }
      } catch { Write-ServerLog 'WARN Invalid API restart lease ignored.' }
    }
  }
  if (Test-HttpOk -Url $HealthUrl) {
    Write-ServerLog "OK $Name"
    return
  }

  if (Test-PortListening -Port $Port) {
    Write-ServerLog "WARN $Name sagliksiz ancak $Port portu dolu; ikinci surec baslatilmadi."
    return
  }

  if (-not $NodeExe) {
    Write-ServerLog "ERROR $Name baslatilamadi; node.exe bulunamadi."
    return
  }

  $stdout = Join-Path $LogDir "$Name.out.log"
  $stderr = Join-Path $LogDir "$Name.err.log"
  $previousEnvironment = @{}

  foreach ($key in $Environment.Keys) {
    $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], 'Process')
  }

  try {
    Start-Process `
      -FilePath $NodeExe `
      -ArgumentList $Arguments `
      -WorkingDirectory $WorkingDirectory `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr | Out-Null
  } finally {
    foreach ($key in $Environment.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process')
    }
  }

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    if (Test-HttpOk -Url $HealthUrl) {
      Write-ServerLog "RECOVER $Name yeniden baslatildi."
      return
    }
  }

  Write-ServerLog "ERROR $Name acilamadi. Log: $stderr"
}

try {
  $hasLock = $mutex.WaitOne(0)
  if (-not $hasLock) { exit 0 }

  Write-ServerLog 'CHECK Sunucu saglik kontrolu basladi.'
  $lanIp = Get-LanIp

  if (Ensure-DockerReady) {
    if (Test-PortListening -Port 8080) {
      Write-ServerLog 'OK Evolution API 8080 portunda zaten hazir.'
    } else {
      Invoke-ComposeUp -ComposeFile $EvolutionCompose -Services @('evolution-api')
    }
    Invoke-ComposeUp -ComposeFile $CrmCompose -Services @('whatsapp-crm-postgres', 'whatsapp-crm-redis')
    if (Test-Path -LiteralPath $ChatwootEnv) {
      Invoke-ComposeUp -ComposeFile $ChatwootCompose
    }
  }

  Start-NodeServiceIfDown `
    -Name 'erp-api' `
    -WorkingDirectory (Join-Path $RepoRoot 'apps\api') `
    -Arguments @('src/server.js') `
    -HealthUrl 'http://127.0.0.1:4100/api/health' `
    -Port 4100

  Start-NodeServiceIfDown `
    -Name 'whatsapp-crm-api' `
    -WorkingDirectory (Join-Path $RepoRoot 'apps\whatsapp-crm-api') `
    -Arguments @('src/server.js') `
    -HealthUrl 'http://127.0.0.1:4200/health' `
    -Port 4200

  Start-NodeServiceIfDown `
    -Name 'web-admin' `
    -WorkingDirectory (Join-Path $RepoRoot 'apps\web-admin') `
    -Arguments @('node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '5173') `
    -HealthUrl 'http://127.0.0.1:5173/' `
    -Port 5173 `
    -Environment @{
      VITE_API_BASE_URL = "http://${lanIp}:4100"
      VITE_WHATSAPP_CRM_API_BASE_URL = "http://${lanIp}:4200"
    }

  if (Test-Path -LiteralPath $ChatwootEnv) {
    if (Test-HttpOk -Url 'http://127.0.0.1:3100/api') {
      Write-ServerLog 'OK chatwoot'
    } else {
      Write-ServerLog 'WARN Chatwoot compose calisiyor ancak web sagligi henuz hazir degil.'
    }
  }

  Write-ServerLog "DONE Sunucu kontrolu tamamlandi. LAN=$lanIp"
} catch {
  Write-ServerLog "ERROR Watchdog beklenmeyen hata: $($_.Exception.Message)"
} finally {
  if ($hasLock) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
