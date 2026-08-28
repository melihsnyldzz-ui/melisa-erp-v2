param(
  [Parameter(Mandatory = $true)]
  [string]$PersonnelJson
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $RepoRoot 'apps\whatsapp-crm-api\.env.local'

function Get-EnvValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  $line = [System.IO.File]::ReadAllLines($EnvPath) |
    Where-Object { $_ -match "^$([regex]::Escape($Name))=" } |
    Select-Object -Last 1
  if (-not $line) { return '' }
  return $line.Substring($line.IndexOf('=') + 1).Trim().Trim('"').Trim("'")
}

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

function Invoke-ChatwootApi {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [ValidateSet('GET', 'POST')][string]$Method = 'GET',
    [object]$Body = $null
  )

  $request = @{
    Uri = "$ChatwootBaseUrl/api/v1/accounts/$AccountId$Path"
    Headers = @{ api_access_token = $AccessToken }
    Method = $Method
    TimeoutSec = 20
  }
  if ($null -ne $Body) {
    $request.ContentType = 'application/json; charset=utf-8'
    $request.Body = $Body | ConvertTo-Json -Depth 8 -Compress
  }
  return Invoke-RestMethod @request
}

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw 'WhatsApp CRM .env.local dosyasi bulunamadi.'
}

$ChatwootBaseUrl = (Get-EnvValue -Name 'CHATWOOT_BASE_URL').TrimEnd('/')
$AccountId = [int](Get-EnvValue -Name 'CHATWOOT_ACCOUNT_ID')
$InboxId = [int](Get-EnvValue -Name 'CHATWOOT_INBOX_ID')
$AccessToken = Get-EnvValue -Name 'CHATWOOT_API_ACCESS_TOKEN'

if (-not $ChatwootBaseUrl -or -not $AccountId -or -not $InboxId -or -not $AccessToken) {
  throw 'Once configure-whatsapp-crm-chatwoot-read.ps1 calistirilmalidir.'
}

$personnel = $PersonnelJson | ConvertFrom-Json
if ($null -eq $personnel -or @($personnel).Count -lt 1) {
  throw 'En az bir aktif ERP personeli verilmelidir.'
}

$seenUserIds = @{}
foreach ($person in $personnel) {
  $erpUserId = [int]$person.erpUserId
  $username = [string]$person.username
  $displayName = [string]$person.displayName
  if ($erpUserId -lt 1 -or -not $username.Trim() -or -not $displayName.Trim()) {
    throw 'ERP personel girdisi gecersiz.'
  }
  if ($seenUserIds.ContainsKey($erpUserId)) {
    throw "ERP kullanici kimligi tekrar ediyor: $erpUserId"
  }
  $seenUserIds[$erpUserId] = $true
}

$agentsResponse = Invoke-ChatwootApi -Path '/agents'
$agents = @($agentsResponse)
$createdCount = 0
$mappingRows = @()

foreach ($person in $personnel) {
  $erpUserId = [int]$person.erpUserId
  $username = ([string]$person.username).Trim()
  $displayName = ([string]$person.displayName).Trim()
  $emailSlug = ($username.ToLowerInvariant() -replace '[^a-z0-9._-]', '')
  if (-not $emailSlug) {
    throw "Chatwoot e-posta kimligi uretilemedi: ERP kullanici $erpUserId"
  }
  $agentEmail = "erp.$emailSlug@melisa.local"
  $agent = $agents | Where-Object { $_.email -ieq $agentEmail } | Select-Object -First 1

  if (-not $agent) {
    $agent = Invoke-ChatwootApi -Path '/agents' -Method POST -Body @{
      agent = @{
        email = $agentEmail
        name = $displayName
        role = 'agent'
        availability = 'online'
        auto_offline = $false
      }
    }
    $agents += $agent
    $createdCount += 1
  }

  if (-not $agent.id) {
    throw "Chatwoot temsilci kimligi alinamadi: ERP kullanici $erpUserId"
  }

  $mappingRows += [pscustomobject]@{
    ErpUserId = $erpUserId
    Username = $username
    DisplayName = $displayName
    ChatwootAgentId = [int]$agent.id
  }
}

$agentIds = @($mappingRows | ForEach-Object { $_.ChatwootAgentId })
Invoke-ChatwootApi -Path '/inbox_members' -Method POST -Body @{
  inbox_id = $InboxId
  user_ids = $agentIds
} | Out-Null

$mappingValue = ($mappingRows | Sort-Object ErpUserId | ForEach-Object { "$($_.ErpUserId):$($_.ChatwootAgentId)" }) -join ','
$lines = [System.Collections.Generic.List[string]]::new()
foreach ($line in [System.IO.File]::ReadAllLines($EnvPath)) { $lines.Add($line) }
Set-EnvLine -Lines $lines -Name 'CHATWOOT_AGENT_PERSONNEL_MAP' -Value $mappingValue
[System.IO.File]::WriteAllLines($EnvPath, $lines, [System.Text.UTF8Encoding]::new($false))

Write-Output "Chatwoot ERP temsilci eslemesi tamamlandi. Yeni temsilci: $createdCount, toplam esleme: $($mappingRows.Count)."
$mappingRows | Select-Object ErpUserId, Username, DisplayName, ChatwootAgentId | Format-Table -AutoSize
Write-Output 'Gecici parolalar ve Chatwoot erisim anahtari loglanmadi. WhatsApp mesaji gonderilmedi.'
