$ErrorActionPreference = 'Continue'
$WatchdogPath = Join-Path $PSScriptRoot 'erp-server-watchdog.ps1'
$RuntimeRoot = Join-Path $env:LOCALAPPDATA 'MelisaERPServer'
$SupervisorLog = Join-Path $RuntimeRoot 'logs\supervisor.log'
$PidFile = Join-Path $RuntimeRoot 'supervisor.pid'

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SupervisorLog) | Out-Null

$mutex = New-Object System.Threading.Mutex($false, 'MelisaErpServerSupervisor')
$hasLock = $false

function Write-SupervisorLog {
  param([string]$Message)
  Add-Content -LiteralPath $SupervisorLog -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
}

try {
  $hasLock = $mutex.WaitOne(0)
  if (-not $hasLock) { exit 0 }

  Set-Content -LiteralPath $PidFile -Value $PID
  Write-SupervisorLog "START Supervisor basladi. PID=$PID"

  while ($true) {
    try {
      $watchdogProcess = Start-Process -FilePath powershell.exe -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-File', $WatchdogPath
      ) -WindowStyle Hidden -PassThru

      $completed = $watchdogProcess.WaitForExit(90000)
      if (-not $completed) {
        Stop-Process -Id $watchdogProcess.Id -Force -ErrorAction SilentlyContinue
        Write-SupervisorLog "WARN Watchdog 90 saniyede tamamlanmadi ve sonlandirildi. PID=$($watchdogProcess.Id)"
      } elseif ($watchdogProcess.ExitCode -ne 0) {
        Write-SupervisorLog "WARN Watchdog hata koduyla kapandi. ExitCode=$($watchdogProcess.ExitCode)"
      }
    } catch {
      Write-SupervisorLog "WARN Watchdog cagrisi hata verdi: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 120
  }
} finally {
  if ($hasLock) {
    $pidOwner = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ([string]$pidOwner -eq [string]$PID) {
      Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
