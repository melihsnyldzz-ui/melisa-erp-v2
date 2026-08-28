param(
  [switch]$Disable
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $RepoRoot 'apps\whatsapp-crm-api\.env.local'

function Set-EnvLine {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Lines,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $replacement = "$Name=$Value"
  for ($index = 0; $index -lt $Lines.Count; $index += 1) {
    if ($Lines[$index] -match "^$([regex]::Escape($Name))=") {
      $Lines[$index] = $replacement
      return
    }
  }
  $Lines.Add($replacement)
}

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Lines,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $match = $Lines | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -Last 1
  if (-not $match) { return '' }
  return $match.Substring($match.IndexOf('=') + 1).Trim()
}

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw 'WhatsApp CRM .env.local dosyasi bulunamadi.'
}

$lines = [System.Collections.Generic.List[string]]::new()
foreach ($line in [System.IO.File]::ReadAllLines($EnvPath)) {
  $lines.Add($line)
}

if (-not $Disable) {
  foreach ($requiredName in @('CHATWOOT_BASE_URL', 'CHATWOOT_ACCOUNT_ID', 'CHATWOOT_INBOX_ID', 'CHATWOOT_API_ACCESS_TOKEN')) {
    if (-not (Get-EnvValue -Lines $lines -Name $requiredName)) {
      throw "Chatwoot ayari eksik: $requiredName"
    }
  }
}

Set-EnvLine -Lines $lines -Name 'WHATSAPP_PROVIDER' -Value 'evolution'
Set-EnvLine -Lines $lines -Name 'WHATSAPP_SEND_ENABLED' -Value $(if ($Disable) { 'false' } else { 'true' })
Set-EnvLine -Lines $lines -Name 'WHATSAPP_TEST_NUMBER_ONLY' -Value 'false'
Set-EnvLine -Lines $lines -Name 'WHATSAPP_LIVE_SEND_APPROVED' -Value $(if ($Disable) { 'false' } else { 'true' })

[System.IO.File]::WriteAllLines($EnvPath, $lines, [System.Text.UTF8Encoding]::new($false))

if ($Disable) {
  Write-Output 'Chatwoot CRM gonderimi kapatildi. Hicbir mesaj gonderilmedi.'
} else {
  Write-Output 'Chatwoot gelen kutusu icin dogrudan Evolution canli gonderimi acildi. Hicbir mesaj gonderilmedi.'
}
