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
 $starter=$null
 try{
  $out=Join-Path $c.RuntimeDir ('hub-watch-'+$run+'-'+$attempt+'.out.log')
  $err=Join-Path $c.RuntimeDir ('hub-watch-'+$run+'-'+$attempt+'.err.log')
  $arguments=@('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',('"'+$launcher+'"'),'-StartupConfigPath',('"'+$StartupConfigPath+'"'),'-Action','Start','-RunId',$run,'-Attempt',$attempt)
  $starter=Start-Process -FilePath $shell -ArgumentList $arguments -WorkingDirectory (Join-Path $c.PackageRoot 'apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  # Windows PowerShell 5.1 requires caching the handle before redirected
  # process exit, otherwise ExitCode may remain null after WaitForExit.
  $null=$starter.Handle
  $starter.WaitForExit()
  if($null -eq $starter.ExitCode -or $starter.ExitCode -ne 0){throw 'HUB_WATCH_START_FAILED'}
  $pointerPath=Join-Path $c.RuntimeDir ('hub-web-process-'+$run+'-'+$attempt+'.json')
  $receipt=Get-Content -LiteralPath $pointerPath -Raw|ConvertFrom-Json
  if($receipt.sourceCommit -ne $c.SourceCommit -or $receipt.packageRoot -ne $c.PackageRoot -or $receipt.port -ne 5234 -or [DateTime]::Parse($receipt.startedAt).ToUniversalTime() -lt $attemptAt){throw 'HUB_WATCH_RECEIPT_REJECTED'}
  $lineagePath=Join-Path $c.RuntimeDir ('hub-web-lineage-'+$run+'-'+$attempt+'.json')
  if($receipt.run -cne $run -or $receipt.attempt -ne $attempt -or $receipt.lineagePath -cne $lineagePath -or $receipt.lineageSha256 -notmatch '^[a-f0-9]{64}$' -or !(Test-Path -LiteralPath $lineagePath -PathType Leaf)){throw 'HUB_WATCH_LINEAGE_POINTER_REJECTED'}
  $pointerAcl=Get-Acl -LiteralPath $pointerPath
  if(!$pointerAcl.AreAccessRulesProtected -or @($pointerAcl.Access|Where-Object {$_.AccessControlType -eq 'Deny' -or $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($c.OwnerSid,'S-1-5-18')}).Count){throw 'HUB_WATCH_POINTER_ACL_REJECTED'}
  if((Get-FileHash -LiteralPath $lineagePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $receipt.lineageSha256){throw 'HUB_WATCH_LINEAGE_HASH_REJECTED'}
  $acl=Get-Acl -LiteralPath $lineagePath
  if(!$acl.AreAccessRulesProtected -or @($acl.Access|Where-Object {$_.AccessControlType -eq 'Deny' -or $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($c.OwnerSid,'S-1-5-18')}).Count){throw 'HUB_WATCH_LINEAGE_ACL_REJECTED'}
  $lineage=Get-Content -LiteralPath $lineagePath -Raw|ConvertFrom-Json
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID)
  $expectedLauncher='"'+$shell+'" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$launcher+'" -StartupConfigPath "'+$StartupConfigPath+'" -Action Start -RunId '+$run+' -Attempt '+$attempt
  if($lineage.schemaVersion -ne 1 -or $lineage.run -cne $run -or $lineage.attempt -ne $attempt -or $lineage.ownerSid -cne $c.OwnerSid -or $lineage.sourceCommit -cne $c.SourceCommit -or $lineage.packageRoot -cne $c.PackageRoot -or $lineage.manifestSha256 -cne $c.ManifestSha256 -or $lineage.nodeSha256 -cne $c.NodeSha256 -or $lineage.startupConfig.path -cne $StartupConfigPath -or $lineage.startupConfig.sha256 -cne (Get-FileHash -LiteralPath $StartupConfigPath -Algorithm SHA256).Hash.ToLowerInvariant() -or $lineage.operationConfig.path -cne $c.OperationConfigPath -or $lineage.operationConfig.sha256 -cne (Get-FileHash -LiteralPath $c.OperationConfigPath -Algorithm SHA256).Hash.ToLowerInvariant() -or $lineage.hubConfig.path -cne $c.HubConfigPath -or $lineage.hubConfig.sha256 -cne (Get-FileHash -LiteralPath $c.HubConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'HUB_WATCH_LINEAGE_PIN_REJECTED'}
  if($lineage.watcher.pid -ne $PID -or $lineage.watcher.sid -cne $c.OwnerSid -or $lineage.watcher.birth -cne $self.CreationDate.ToUniversalTime().ToString('o') -or $lineage.watcher.argv.TrimEnd() -cne $self.CommandLine.TrimEnd() -or $lineage.launcher.parentPid -ne $PID -or $lineage.launcher.pid -ne $starter.Id -or $lineage.launcher.sid -cne $c.OwnerSid -or $lineage.launcher.argv.TrimEnd() -cne $expectedLauncher -or [DateTime]::Parse($lineage.launcher.birth).ToUniversalTime() -lt $attemptAt -or [Math]::Abs(([DateTime]::Parse($lineage.launcher.birth).ToUniversalTime()-$starter.StartTime.ToUniversalTime()).TotalMilliseconds) -gt 1){throw 'HUB_WATCH_LAUNCHER_REJECTED'}
  if($lineage.node.pid -ne $receipt.pid -or $lineage.node.parentPid -ne $starter.Id -or $lineage.node.sid -cne $c.OwnerSid -or [DateTime]::Parse($lineage.node.birth).ToUniversalTime() -lt $attemptAt -or $lineage.startedAt -cne $receipt.startedAt){throw 'HUB_WATCH_LINEAGE_CHILD_REJECTED'}
  $owned=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$receipt.pid)
  $expectedNode='"'+$c.NodePath+'" "'+(Join-Path $c.PackageRoot 'apps\api\start-shared-test-copy-web.mjs')+'" "'+$c.OperationConfigPath+'"'
  if(!$owned -or $owned.ParentProcessId -ne $starter.Id -or $owned.ExecutablePath -ne $c.NodePath -or $owned.CreationDate.ToUniversalTime() -lt $attemptAt -or $owned.CreationDate.ToUniversalTime().ToString('o') -cne $lineage.node.birth -or (Invoke-CimMethod $owned -MethodName GetOwnerSid).Sid -ne $c.OwnerSid -or $owned.CommandLine.TrimEnd() -cne $expectedNode -or $lineage.node.argv.TrimEnd() -cne $expectedNode){throw 'HUB_WATCH_CHILD_REJECTED'}
  $liveBindings=@(Get-NetTCPConnection -State Listen -LocalPort 5234 -ErrorAction SilentlyContinue)
  if($liveBindings.Count -ne 2 -or $lineage.bindings.Count -ne 2 -or @($liveBindings|Select-Object -ExpandProperty LocalAddress -Unique).Count -ne 2 -or @($lineage.bindings|Select-Object -ExpandProperty address -Unique).Count -ne 2 -or @($liveBindings|Where-Object {$_.OwningProcess -ne $receipt.pid -or $_.LocalAddress -notin @('127.0.0.1','192.168.1.46')}).Count -or @($lineage.bindings|Where-Object {$_.pid -ne $receipt.pid -or $_.port -ne 5234 -or $_.address -notin @('127.0.0.1','192.168.1.46')}).Count){throw 'HUB_WATCH_BINDINGS_REJECTED'}
  $child=Get-Process -Id $receipt.pid -ErrorAction Stop
  $null=$child.Handle
  if([Math]::Abs(($child.StartTime.ToUniversalTime()-$owned.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 1){throw 'HUB_WATCH_CHILD_CREATION_REJECTED'}
  [ordered]@{run=$run;attempt=$attempt;maxRetries=3;retrySeconds=60;state='watching';pid=$receipt.pid;sourceCommit=$c.SourceCommit;checkedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath $stateFile -Encoding utf8
  $child.WaitForExit()
  throw 'HUB_WATCH_CHILD_EXITED'
 }catch{
  $failure=$_
  $code=if($failure.Exception.Message -cmatch '^HUB_WATCH_[A-Z_]+$'){$failure.Exception.Message}else{'HUB_WATCH_ATTEMPT_FAILED'}
  # Private local diagnostics only; Hub status never exposes these details.
  [ordered]@{run=$run;attempt=$attempt;exceptionType=$failure.Exception.GetType().FullName;message=$failure.Exception.Message;checkedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $c.RuntimeDir ('hub-watch-'+$run+'-'+$attempt+'.failure.json')) -Encoding utf8
  [ordered]@{run=$run;attempt=$attempt;maxRetries=3;retrySeconds=60;state=if($attempt -lt 3){'retry-wait'}else{'exhausted'};reason=$code;sourceCommit=$c.SourceCommit;checkedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath $stateFile -Encoding utf8
  if(@(Get-NetTCPConnection -State Listen -LocalPort 5234 -ErrorAction SilentlyContinue).Count -or ($starter -and @(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$starter.Id) -ErrorAction SilentlyContinue|Where-Object {$_.CreationDate.ToUniversalTime() -ge $attemptAt}).Count)){throw 'HUB_WATCH_UNVERIFIED_CHILD_OR_PORT'}
  if($attempt -ge 3){throw 'HUB_WATCH_RETRY_EXHAUSTED'}
  Start-Sleep -Seconds 60
 }
}
