param(
  [string]$ChatwootBaseUrl = 'http://127.0.0.1:3100',
  [string]$ChatwootPostgresContainer = 'melisa-chatwoot-postgres-1'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $RepoRoot 'apps\whatsapp-crm-api\.env.local'

function Invoke-ChatwootSqlScalar {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $value = docker exec $ChatwootPostgresContainer psql -U postgres -d chatwoot -Atc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw 'Chatwoot PostgreSQL sorgusu calistirilamadi.'
  }
  return ($value | Select-Object -First 1).Trim()
}

function Set-EnvLine {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Lines,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  if ($Value.Contains("`r") -or $Value.Contains("`n")) {
    throw "$Name satir sonu iceremez."
  }

  $replacement = "$Name=$Value"
  for ($index = 0; $index -lt $Lines.Count; $index += 1) {
    if ($Lines[$index] -match "^$([regex]::Escape($Name))=") {
      $Lines[$index] = $replacement
      return
    }
  }
  $Lines.Add($replacement)
}

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw 'WhatsApp CRM .env.local dosyasi bulunamadi.'
}

$accountUser = Invoke-ChatwootSqlScalar -Sql @"
select au.account_id || ':' || au.user_id
from account_users au
join access_tokens token
  on token.owner_type = 'User'
 and token.owner_id = au.user_id
order by au.account_id, au.user_id
limit 1;
"@

$accountParts = $accountUser.Split(':')
if ($accountParts.Count -ne 2) {
  throw 'Chatwoot hesap ve token sahibi bulunamadi.'
}

$accountId = [int]$accountParts[0]
$userId = [int]$accountParts[1]
$inboxId = [int](Invoke-ChatwootSqlScalar -Sql "select id from inboxes where account_id=$accountId order by case when lower(name) like '%whatsapp%' then 0 else 1 end, id limit 1;")
$accessToken = Invoke-ChatwootSqlScalar -Sql "select token from access_tokens where owner_type='User' and owner_id=$userId order by id desc limit 1;"

if (-not $accountId -or -not $inboxId -or -not $accessToken) {
  throw 'Chatwoot salt-okunur baglanti bilgileri tamamlanamadi.'
}

$headers = @{ api_access_token = $accessToken }
$probeUrl = "$($ChatwootBaseUrl.TrimEnd('/'))/api/v1/accounts/$accountId/conversations?status=all&page=1"
$probe = Invoke-RestMethod -Uri $probeUrl -Headers $headers -Method Get -TimeoutSec 15
if ($null -eq $probe.data) {
  throw 'Chatwoot API gelen kutusu dogrulamasi basarisiz oldu.'
}

$lines = [System.Collections.Generic.List[string]]::new()
foreach ($line in [System.IO.File]::ReadAllLines($EnvPath)) {
  $lines.Add($line)
}

Set-EnvLine -Lines $lines -Name 'CHATWOOT_BASE_URL' -Value $ChatwootBaseUrl.TrimEnd('/')
Set-EnvLine -Lines $lines -Name 'CHATWOOT_ACCOUNT_ID' -Value ([string]$accountId)
Set-EnvLine -Lines $lines -Name 'CHATWOOT_INBOX_ID' -Value ([string]$inboxId)
Set-EnvLine -Lines $lines -Name 'CHATWOOT_API_ACCESS_TOKEN' -Value $accessToken
Set-EnvLine -Lines $lines -Name 'CHATWOOT_INBOX_READ_ENABLED' -Value 'true'
Set-EnvLine -Lines $lines -Name 'CHATWOOT_INBOX_FALLBACK_ENABLED' -Value 'true'
Set-EnvLine -Lines $lines -Name 'CHATWOOT_INCLUDE_GROUPS' -Value 'false'

[System.IO.File]::WriteAllLines($EnvPath, $lines, [System.Text.UTF8Encoding]::new($false))

Write-Output "Chatwoot salt-okunur kaynak yapilandirildi. Hesap: $accountId, gelen kutusu: $inboxId."
Write-Output 'Erisim anahtari loglanmadi. WhatsApp gonderim ayarlari degistirilmedi.'
