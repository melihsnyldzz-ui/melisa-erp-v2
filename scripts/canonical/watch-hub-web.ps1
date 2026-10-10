param([Parameter(Mandatory=$true)][string]$StartupConfigPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Web-only supervisor: initial attempt plus three retries. Scheduler retries
# must be zero, so the budget cannot multiply across task invocations.
$c=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
foreach($path in @($StartupConfigPath,$c.PackageRoot,$c.RuntimeDir,$c.NodePath)){
 if(![IO.Path]::IsPathRooted($path) -or $path -match '["\r\n]'){throw 'HUB_WATCH_PATH_REJECTED'}
}
if($c.OwnerSid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $c.SourceCommit -notmatch '^[a-f0-9]{40}$'){throw 'HUB_WATCH_OWNER_REJECTED'}
if([IO.Path]::GetFullPath($c.RuntimeDir).StartsWith([IO.Path]::GetFullPath($c.PackageRoot).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or $c.NodeSha256 -notmatch '^[a-fA-F0-9]{64}$' -or $c.ManifestSha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'HUB_WATCH_PIN_REJECTED'}
if((Get-FileHash -LiteralPath $c.NodePath -Algorithm SHA256).Hash -ne $c.NodeSha256 -or (Get-FileHash -LiteralPath (Join-Path $c.PackageRoot 'release-manifest.json') -Algorithm SHA256).Hash -ne $c.ManifestSha256){throw 'HUB_WATCH_OUTER_PIN_REJECTED'}
$expectedScript=Join-Path $c.PackageRoot 'scripts\canonical\watch-hub-web.ps1'
if([IO.Path]::GetFullPath($PSCommandPath) -ne [IO.Path]::GetFullPath($expectedScript)){throw 'HUB_WATCH_PACKAGE_REJECTED'}
$launcher=Join-Path $c.PackageRoot 'scripts\canonical\start-hub-web.ps1'
$shell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
# The core launcher performs the full manifest/Node/dependency validation on
# every attempt and refuses an occupied port; this wrapper never kills owners.
New-Item -ItemType Directory -Force -Path $c.RuntimeDir|Out-Null
$run=[guid]::NewGuid().ToString('N')
$stateFile=Join-Path $c.RuntimeDir 'hub-web-supervisor.json'
for($attempt=0;$attempt -le 3;$attempt++){
 $attemptAt=[DateTime]::UtcNow
 try{
  $out=Join-Path $c.RuntimeDir ('hub-watch-'+$run+'-'+$attempt+'.out.log')
  $err=Join-Path $c.RuntimeDir ('hub-watch-'+$run+'-'+$attempt+'.err.log')
  $starter=Start-Process -FilePath $shell -ArgumentList @('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File','"'+$launcher+'"','-StartupConfigPath','"'+$StartupConfigPath+'"','-Action','Start') -WorkingDirectory (Join-Path $c.PackageRoot 'apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  # Windows PowerShell 5.1 requires caching the handle before redirected
  # process exit, otherwise ExitCode may remain null after WaitForExit.
  $null=$starter.Handle
  $starter.WaitForExit()
  if($null -eq $starter.ExitCode -or $starter.ExitCode -ne 0){throw 'HUB_WATCH_START_FAILED'}
  $receipt=Get-Content -LiteralPath (Join-Path $c.RuntimeDir 'hub-web-process.json') -Raw|ConvertFrom-Json
  if($receipt.sourceCommit -ne $c.SourceCommit -or $receipt.packageRoot -ne $c.PackageRoot -or $receipt.port -ne 5234 -or [DateTime]::Parse($receipt.startedAt).ToUniversalTime() -lt $attemptAt){throw 'HUB_WATCH_RECEIPT_REJECTED'}
  $owned=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$receipt.pid)
  if(!$owned -or $owned.ExecutablePath -ne $c.NodePath -or $owned.CreationDate.ToUniversalTime() -lt $attemptAt -or (Invoke-CimMethod $owned -MethodName GetOwnerSid).Sid -ne $c.OwnerSid -or !$owned.CommandLine.Contains((Join-Path $c.PackageRoot 'apps\api\start-shared-test-copy-web.mjs')) -or !$owned.CommandLine.Contains($c.OperationConfigPath)){throw 'HUB_WATCH_CHILD_REJECTED'}
  $child=Get-Process -Id $receipt.pid -ErrorAction Stop
  $null=$child.Handle
  if([Math]::Abs(($child.StartTime.ToUniversalTime()-$owned.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 1){throw 'HUB_WATCH_CHILD_CREATION_REJECTED'}
  [ordered]@{run=$run;attempt=$attempt;maxRetries=3;retrySeconds=60;state='watching';pid=$receipt.pid;sourceCommit=$c.SourceCommit;checkedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath $stateFile -Encoding utf8
  $child.WaitForExit()
  throw 'HUB_WATCH_CHILD_EXITED'
 }catch{
  $code=if($_.Exception.Message -match '^HUB_WATCH_[A-Z_]+$'){$_.Exception.Message}else{'HUB_WATCH_ATTEMPT_FAILED'}
  [ordered]@{run=$run;attempt=$attempt;maxRetries=3;retrySeconds=60;state=if($attempt -lt 3){'retry-wait'}else{'exhausted'};reason=$code;sourceCommit=$c.SourceCommit;checkedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath $stateFile -Encoding utf8
  if($attempt -ge 3){throw 'HUB_WATCH_RETRY_EXHAUSTED'}
  Start-Sleep -Seconds 60
 }
}
