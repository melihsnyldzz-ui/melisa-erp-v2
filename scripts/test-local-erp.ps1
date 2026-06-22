param(
  [string]$BaseUrl = 'http://192.168.1.47:4100',
  [string]$WebUrl = 'http://192.168.1.47:5173',
  [switch]$RunBuild
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
  param(
    [string]$Area,
    [string]$Name,
    [bool]$Ok,
    [string]$Detail = ''
  )

  $Checks.Add([pscustomobject]@{
    Area = $Area
    Name = $Name
    Ok = $Ok
    Detail = $Detail
  }) | Out-Null
}

function Test-Http {
  param(
    [string]$Area,
    [string]$Name,
    [string]$Url,
    [hashtable]$Headers = @{},
    [int]$TimeoutSec = 8
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -Headers $Headers -TimeoutSec $TimeoutSec
    $ok = [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300
    Add-Check $Area $Name $ok "HTTP $($response.StatusCode)"
    return $response
  } catch {
    Add-Check $Area $Name $false ($_.Exception.Message)
    return $null
  }
}

function Test-ApiJson {
  param(
    [string]$Area,
    [string]$Name,
    [string]$Path
  )

  $headers = @{ Authorization = 'Bearer open-admin'; Accept = 'application/json' }
  $response = Test-Http -Area $Area -Name $Name -Url "$BaseUrl$Path" -Headers $headers
  if (-not $response) { return }

  try {
    $payload = $response.Content | ConvertFrom-Json
    if ($payload.PSObject.Properties.Name -contains 'success' -and -not $payload.success) {
      $last = $Checks[$Checks.Count - 1]
      $last.Ok = $false
      $last.Detail = $payload.error.message
    }
  } catch {
    $last = $Checks[$Checks.Count - 1]
    $last.Ok = $false
    $last.Detail = 'JSON okunamadi'
  }
}

function Get-EnvMap {
  param([string]$Path)

  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $map[$matches[1].Trim()] = $matches[2].Trim().Trim('"')
    }
  }
  return $map
}

Write-Host "Melisa ERP Genel Smoke Test" -ForegroundColor White
Write-Host "API: $BaseUrl"
Write-Host "Web: $WebUrl"
Write-Host ""

Test-Http 'Sistem' 'API health' "$BaseUrl/api/health" | Out-Null
Test-Http 'Sistem' 'Web ana sayfa' "$WebUrl/" | Out-Null
Test-Http 'Sistem' 'WhatsApp API' 'http://localhost:8080/' | Out-Null

$apiConfigResponse = Test-Http 'Sistem' 'Web API config LAN' "$WebUrl/src/config/apiConfig.js"
if ($apiConfigResponse) {
  $last = $Checks[$Checks.Count - 1]
  $last.Ok = $apiConfigResponse.Content -match [regex]::Escape($BaseUrl)
  $last.Detail = if ($last.Ok) { "API base $BaseUrl" } else { 'Web config LAN API adresini gostermiyor' }
}

$evolutionEnv = Get-EnvMap -Path 'C:\evolution-api\.env'
$apiKey = $evolutionEnv['AUTHENTICATION_API_KEY']
if (-not $apiKey) { $apiKey = $evolutionEnv['API_KEY'] }
$apiEnv = Get-EnvMap -Path (Join-Path $RepoRoot 'apps\api\.env.local')
$instance = $apiEnv['WHATSAPP_INSTANCE']
if (-not $instance) { $instance = 'melisa-test' }

if ($apiKey) {
  $stateResponse = Test-Http 'WhatsApp' 'Instance connection state' "http://localhost:8080/instance/connectionState/$instance" -Headers @{ apikey = $apiKey }
  if ($stateResponse) {
    try {
      $payload = $stateResponse.Content | ConvertFrom-Json
      $last = $Checks[$Checks.Count - 1]
      $last.Ok = $payload.instance.state -eq 'open'
      $last.Detail = "state=$($payload.instance.state)"
    } catch {
      $last = $Checks[$Checks.Count - 1]
      $last.Ok = $false
      $last.Detail = 'state JSON okunamadi'
    }
  }
} else {
  Add-Check 'WhatsApp' 'Instance connection state' $false 'API key bulunamadi'
}

$readChecks = @(
  @('Dashboard', 'Dashboard summary', '/api/dashboard/summary'),
  @('Dashboard', 'Dashboard alerts', '/api/dashboard/alerts'),
  @('Stok', 'Products list', '/api/products?page=1&limit=5'),
  @('Stok', 'Stock movements', '/api/stock-movements?limit=5'),
  @('Stok', 'Stock valuation', '/api/stock-valuation?limit=5'),
  @('Cari', 'Customers list', '/api/customers?page=1&limit=5'),
  @('Cari', 'Customer movements', '/api/customer-movements?limit=5'),
  @('Cari', 'Customer statement', '/api/customer-statement?limit=5'),
  @('Tedarikci', 'Suppliers list', '/api/suppliers?page=1&limit=5&activeOnly=false'),
  @('Tedarikci', 'Supplier movements', '/api/supplier-movements?limit=5'),
  @('Tedarikci', 'Supplier statement', '/api/supplier-statement?limit=5'),
  @('Satis', 'Sales invoices', '/api/sales-invoices?limit=5'),
  @('Alis', 'Purchase invoices', '/api/purchase-invoices?limit=5'),
  @('Finans', 'Finance summary', '/api/finance/summary'),
  @('Finans', 'Finance movements', '/api/finance/movements?limit=5'),
  @('Katalog', 'Catalog list', '/api/catalogs?limit=5'),
  @('Katalog', 'WhatsApp status', '/api/catalogs/whatsapp-status'),
  @('Ayarlar', 'Currency rates', '/api/currency-rates'),
  @('Ayarlar', 'Settings', '/api/settings'),
  @('Terminal', 'Terminal products', '/api/terminal/products/search?q=&limit=5'),
  @('Terminal', 'Terminal customers', '/api/terminal/customers/search?q=&limit=5'),
  @('Terminal', 'Terminal admin', '/api/terminal-admin/overview')
)

foreach ($check in $readChecks) {
  Test-ApiJson -Area $check[0] -Name $check[1] -Path $check[2]
}

$navigationSmokeScript = Join-Path $RepoRoot 'scripts\web-admin-navigation-smoke.mjs'
if (Test-Path $navigationSmokeScript) {
  Push-Location $RepoRoot
  try {
    $navigationSmokeOutput = node $navigationSmokeScript 2>&1
    Add-Check 'Web Admin' 'Navigation registry smoke' ($LASTEXITCODE -eq 0) (($navigationSmokeOutput | Select-Object -Last 1) -join ' ')
  } finally {
    Pop-Location
  }
} else {
  Add-Check 'Web Admin' 'Navigation registry smoke' $false 'script bulunamadi'
}

$listScopeSmokeScript = Join-Path $RepoRoot 'scripts\web-admin-list-scope-smoke.mjs'
if (Test-Path $listScopeSmokeScript) {
  Push-Location $RepoRoot
  try {
    $listScopeSmokeOutput = node $listScopeSmokeScript 2>&1
    Add-Check 'Web Admin' 'List scope smoke' ($LASTEXITCODE -eq 0) (($listScopeSmokeOutput | Select-Object -Last 1) -join ' ')
  } finally {
    Pop-Location
  }
} else {
  Add-Check 'Web Admin' 'List scope smoke' $false 'script bulunamadi'
}

$financeFormSmokeScript = Join-Path $RepoRoot 'scripts\web-admin-finance-form-smoke.mjs'
if (Test-Path $financeFormSmokeScript) {
  Push-Location $RepoRoot
  try {
    $financeFormSmokeOutput = node $financeFormSmokeScript 2>&1
    Add-Check 'Web Admin' 'Finance form dirty smoke' ($LASTEXITCODE -eq 0) (($financeFormSmokeOutput | Select-Object -Last 1) -join ' ')
  } finally {
    Pop-Location
  }
} else {
  Add-Check 'Web Admin' 'Finance form dirty smoke' $false 'script bulunamadi'
}

$actionClaritySmokeScript = Join-Path $RepoRoot 'scripts\web-admin-action-clarity-smoke.mjs'
if (Test-Path $actionClaritySmokeScript) {
  Push-Location $RepoRoot
  try {
    $actionClaritySmokeOutput = node $actionClaritySmokeScript 2>&1
    Add-Check 'Web Admin' 'Action clarity smoke' ($LASTEXITCODE -eq 0) (($actionClaritySmokeOutput | Select-Object -Last 1) -join ' ')
  } finally {
    Pop-Location
  }
} else {
  Add-Check 'Web Admin' 'Action clarity smoke' $false 'script bulunamadi'
}

$emptyStateSmokeScript = Join-Path $RepoRoot 'scripts\web-admin-empty-state-smoke.mjs'
if (Test-Path $emptyStateSmokeScript) {
  Push-Location $RepoRoot
  try {
    $emptyStateSmokeOutput = node $emptyStateSmokeScript 2>&1
    Add-Check 'Web Admin' 'Empty state smoke' ($LASTEXITCODE -eq 0) (($emptyStateSmokeOutput | Select-Object -Last 1) -join ' ')
  } finally {
    Pop-Location
  }
} else {
  Add-Check 'Web Admin' 'Empty state smoke' $false 'script bulunamadi'
}

if ($RunBuild) {
  Push-Location (Join-Path $RepoRoot 'apps\web-admin')
  try {
    npm.cmd run build
    Add-Check 'Build' 'Web admin build' ($LASTEXITCODE -eq 0) "exit=$LASTEXITCODE"
  } finally {
    Pop-Location
  }
}

Write-Host ""
foreach ($check in $Checks) {
  $status = if ($check.Ok) { 'PASS' } else { 'FAIL' }
  $color = if ($check.Ok) { 'Green' } else { 'Red' }
  Write-Host ("{0} - {1} / {2} - {3}" -f $status, $check.Area, $check.Name, $check.Detail) -ForegroundColor $color
}

$passed = ($Checks | Where-Object { $_.Ok }).Count
$failed = $Checks.Count - $passed
Write-Host ""
Write-Host "SUMMARY: $passed/$($Checks.Count) PASS" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Yellow' })

if ($failed -gt 0) {
  exit 1
}
