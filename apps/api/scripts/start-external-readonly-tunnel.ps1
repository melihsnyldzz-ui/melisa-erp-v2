$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $env:EXTERNAL_READ_ONLY_ENABLED -or $env:EXTERNAL_READ_ONLY_ENABLED.ToLowerInvariant() -ne 'true') {
  throw 'EXTERNAL_READ_ONLY_ENABLED must be true in the local environment.'
}

if ([string]::IsNullOrWhiteSpace($env:EXTERNAL_READ_ONLY_API_KEY)) {
  throw 'EXTERNAL_READ_ONLY_API_KEY is not configured. Generate a strong local secret; do not commit it.'
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  throw 'cloudflared is not installed or not in PATH.'
}

$gatewayPort = if ($env:EXTERNAL_READ_ONLY_PORT) { [int]$env:EXTERNAL_READ_ONLY_PORT } else { 4112 }
$gatewayHost = '127.0.0.1'

$existing = Get-NetTCPConnection -LocalAddress $gatewayHost -LocalPort $gatewayPort -State Listen -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "Starting isolated read-only gateway on $gatewayHost`:$gatewayPort ..."
  Start-Process -FilePath 'node' -ArgumentList 'src/externalReadOnlyServer.js' -WorkingDirectory $repoRoot -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

$existing = Get-NetTCPConnection -LocalAddress $gatewayHost -LocalPort $gatewayPort -State Listen -ErrorAction SilentlyContinue
if (-not $existing) {
  throw "Read-only gateway did not start on $gatewayHost`:$gatewayPort."
}

Write-Host 'Gateway is listening on loopback only.'
Write-Host 'Starting HTTPS tunnel. Only the isolated whitelist gateway is forwarded.'
Write-Host 'Do not forward the normal ERP API port.'

& $cloudflared.Source tunnel --url "http://$gatewayHost`:$gatewayPort"
