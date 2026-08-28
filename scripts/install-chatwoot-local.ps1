param(
  [switch]$SkipPull
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ChatwootDir = Join-Path $RepoRoot 'infra\chatwoot'
$ComposeFile = Join-Path $ChatwootDir 'docker-compose.yml'
$EnvFile = Join-Path $ChatwootDir '.env'

function New-AlphanumericSecret {
  param([int]$Length = 64)

  $alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  $bytes = New-Object byte[] $Length
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  return -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
}

function Get-LanIp {
  $address = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -like '192.168.*' -and
      $_.AddressState -eq 'Preferred' -and
      $_.InterfaceAlias -notlike 'vEthernet*' -and
      $_.InterfaceAlias -notlike '*Docker*'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($address) { return $address }
  return '127.0.0.1'
}

if (-not (Test-Path -LiteralPath $ComposeFile)) {
  throw "Chatwoot compose dosyasi bulunamadi: $ComposeFile"
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker Desktop calismiyor.'
}

$lanIp = Get-LanIp
if (-not (Test-Path -LiteralPath $EnvFile)) {
  $secretKey = New-AlphanumericSecret -Length 96
  $postgresPassword = New-AlphanumericSecret -Length 48
  $redisPassword = New-AlphanumericSecret -Length 48
  $content = @(
    "FRONTEND_URL=http://${lanIp}:3100",
    "SECRET_KEY_BASE=$secretKey",
    "POSTGRES_PASSWORD=$postgresPassword",
    "REDIS_PASSWORD=$redisPassword",
    "DATABASE_URL=postgresql://postgres:${postgresPassword}@postgres:5432/chatwoot",
    "REDIS_URL=redis://:${redisPassword}@redis:6379",
    'RAILS_ENV=production',
    'NODE_ENV=production',
    'INSTALLATION_ENV=docker',
    'DEFAULT_LOCALE=tr',
    'ACTIVE_STORAGE_SERVICE=local',
    'ENABLE_ACCOUNT_SIGNUP=true',
    'FORCE_SSL=false',
    'RAILS_LOG_TO_STDOUT=true',
    'LOG_LEVEL=info',
    'LOG_SIZE=100',
    'MAILER_SENDER_EMAIL=Chatwoot <chatwoot@localhost>'
  )
  [IO.File]::WriteAllLines($EnvFile, $content, [Text.UTF8Encoding]::new($false))
  Write-Host 'Chatwoot gizli ayarlari olusturuldu.' -ForegroundColor Green
} else {
  Write-Host 'Mevcut Chatwoot gizli ayarlari korunuyor.' -ForegroundColor Yellow
}

Push-Location $ChatwootDir
try {
  if (-not $SkipPull) {
    docker compose pull
    if ($LASTEXITCODE -ne 0) { throw 'Chatwoot imajlari indirilemedi.' }
  }

  docker compose run --rm rails bundle exec rails db:chatwoot_prepare
  if ($LASTEXITCODE -ne 0) { throw 'Chatwoot veritabani hazirlanamadi.' }

  docker compose up -d
  if ($LASTEXITCODE -ne 0) { throw 'Chatwoot servisleri baslatilamadi.' }
} finally {
  Pop-Location
}

$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3100/api' -TimeoutSec 8
    if ([int]$response.StatusCode -eq 200) {
      Write-Host "Chatwoot hazir: http://${lanIp}:3100" -ForegroundColor Green
      exit 0
    }
  } catch {}
  Start-Sleep -Seconds 5
}

throw 'Chatwoot 5 dakika icinde saglikli yanit vermedi.'
