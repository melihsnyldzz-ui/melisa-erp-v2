param(
  [switch]$Remove
)

$ErrorActionPreference = 'Continue'
$WatchdogPath = Join-Path $PSScriptRoot 'erp-server-watchdog.ps1'
$SupervisorPath = Join-Path $PSScriptRoot 'erp-server-supervisor.ps1'
$StartupTask = 'MelisaERP-Startup'
$WatchdogTask = 'MelisaERP-Watchdog'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunValueName = 'MelisaERPServerSupervisor'
$RuntimeRoot = Join-Path $env:LOCALAPPDATA 'MelisaERPServer'
$PidFile = Join-Path $RuntimeRoot 'supervisor.pid'

if ($Remove) {
  schtasks.exe /Delete /TN $StartupTask /F 2>$null | Out-Null
  schtasks.exe /Delete /TN $WatchdogTask /F 2>$null | Out-Null
  Remove-ItemProperty -Path $RunKey -Name $RunValueName -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $PidFile) {
    $supervisorPid = [int](Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $supervisorPid" -ErrorAction SilentlyContinue
    if ($process.CommandLine -like "*$SupervisorPath*") {
      Stop-Process -Id $supervisorPid -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Host 'Melisa ERP otomatik baslatma gorevleri kaldirildi.' -ForegroundColor Yellow
  exit 0
}

if (-not (Test-Path -LiteralPath $WatchdogPath) -or -not (Test-Path -LiteralPath $SupervisorPath)) {
  throw 'Sunucu watchdog veya supervisor scripti bulunamadi.'
}

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WatchdogPath`""

$taskSchedulerInstalled = $false
schtasks.exe /Create /F /TN $StartupTask /SC ONLOGON /RL LIMITED /TR $taskCommand 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  schtasks.exe /Create /F /TN $WatchdogTask /SC MINUTE /MO 2 /RL LIMITED /TR $taskCommand 2>$null | Out-Null
  $taskSchedulerInstalled = $LASTEXITCODE -eq 0
}

if ($taskSchedulerInstalled) {
  schtasks.exe /Run /TN $WatchdogTask | Out-Null
  Remove-ItemProperty -Path $RunKey -Name $RunValueName -ErrorAction SilentlyContinue
  Write-Host 'Melisa ERP sunucu otomatik baslatma Gorev Zamanlayici ile kuruldu.' -ForegroundColor Green
} else {
  schtasks.exe /Delete /TN $StartupTask /F 2>$null | Out-Null
  schtasks.exe /Delete /TN $WatchdogTask /F 2>$null | Out-Null

  $supervisorCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SupervisorPath`""
  New-Item -Path $RunKey -Force | Out-Null
  Set-ItemProperty -Path $RunKey -Name $RunValueName -Value $supervisorCommand
  Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $SupervisorPath) -WindowStyle Hidden
  Write-Host 'Melisa ERP sunucu otomatik baslatma kullanici baslangici ile kuruldu.' -ForegroundColor Green
}

Write-Host 'Kontrol araligi: 2 dakika'
Write-Host "Watchdog: $WatchdogPath"
