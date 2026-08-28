$ports = @(
  @{ Name = 'ERP Web'; Port = 5173; Url = 'http://127.0.0.1:5173/' },
  @{ Name = 'ERP API'; Port = 4100; Url = 'http://127.0.0.1:4100/api/health' },
  @{ Name = 'WhatsApp CRM API'; Port = 4200; Url = 'http://127.0.0.1:4200/health' },
  @{ Name = 'Evolution API'; Port = 8080; Url = 'http://127.0.0.1:8080/' }
  @{ Name = 'Chatwoot'; Port = 3100; Url = 'http://127.0.0.1:3100/api' }
)

$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -like '192.168.*' -and $_.AddressState -eq 'Preferred' -and $_.InterfaceAlias -notlike 'vEthernet*' } |
  Select-Object -First 1 -ExpandProperty IPAddress

$rows = foreach ($service in $ports) {
  $httpOk = $false
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $service.Url -TimeoutSec 4
    $httpOk = [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
  } catch {}

  [pscustomobject]@{
    Servis = $service.Name
    Port = $service.Port
    Durum = if ($httpOk) { 'ACIK' } else { 'KAPALI' }
  }
}

$rows | Format-Table -AutoSize
Write-Host "LAN ERP adresi: http://${lanIp}:5173/"
Write-Host "Log klasoru: $(Join-Path $env:LOCALAPPDATA 'MelisaERPServer\logs')"
