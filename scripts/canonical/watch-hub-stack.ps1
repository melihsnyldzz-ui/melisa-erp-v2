param([string]$StartupConfigPath,[string]$StartupConfigSha256,[ValidateSet('Inspect','Probe','Start')][string]$Action='Inspect',[switch]$Library)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# SOURCE PREPARATION / NOT INSTALLED. Inspect and Probe read only; Start has a
# single bounded driver budget. Nothing installs or changes a task/network.
# Activation requires separately reviewed immutable dependencies/private pins.
function Assert-HubStackFields($Value,$Required,$Optional=@()) {
 if(!$Value -or $Value -is [array]){throw 'HUB_STACK_FIELDS_REJECTED'}
 $actual=@($Value.PSObject.Properties.Name)
 if(@($actual|Where-Object {$_ -notin @($Required)+@($Optional)}).Count -or @($Required|Where-Object {$_ -notin $actual}).Count){throw 'HUB_STACK_FIELDS_REJECTED'}
}
function Assert-HubStackPath([string]$Value,[string]$Root='') {
 if($Value -cnotmatch '^[A-Za-z]:\\' -or $Value -match '[\x00-\x1f\x7f"''/%`$<>|?*]' -or $Value.Substring(2).Contains(':') -or $Value.EndsWith('\')){throw 'HUB_STACK_PATH_REJECTED'}
 $parts=$Value.Substring(3).Split('\')
 foreach($part in $parts){if(!$part -or $part -in @('.','..') -or $part -match '[. ]$' -or $part -match '^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)'){throw 'HUB_STACK_PATH_REJECTED'}}
 if([IO.Path]::GetFullPath($Value) -cne $Value){throw 'HUB_STACK_PATH_REJECTED'}
 if($Root -and !$Value.StartsWith($Root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'HUB_STACK_PATH_SCOPE_REJECTED'}
}
function Assert-HubStackHash([string]$Value,[int]$Length=64) {
 if($Value -cnotmatch ('^[a-fA-F0-9]{'+$Length+'}$')){throw 'HUB_STACK_HASH_REJECTED'}
}
function Assert-HubStackNoReparse([string]$Value) {
 $cursor=$Value
 while($cursor -and $cursor.Length -gt 3){
  if(((Get-Item -LiteralPath $cursor -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'HUB_STACK_REPARSE_REJECTED'}
  $cursor=[IO.Path]::GetDirectoryName($cursor)
 }
}
function Assert-HubStackConfigReference($Reference) {
 Assert-HubStackFields $Reference @('path','sha256')
 Assert-HubStackPath $Reference.path 'C:\Sirket\ERP\runtime'
 if([IO.Path]::GetExtension($Reference.path) -ne '.json'){throw 'HUB_STACK_CONFIG_SCOPE_REJECTED'}
 Assert-HubStackHash $Reference.sha256
}
function Assert-HubStackSettings($Settings,[string]$ActualOwnerSid) {
 $required=@('schemaVersion','ownerSid','actualT1','copyId','database','stableOrigin','releaseRoots','runtimeRoot','windowsRoot','node','stackPackage','components')
 Assert-HubStackFields $Settings $required @('privateSources','dependencyLocks','crmPrivateFiles')
 if(($Settings.schemaVersion -isnot [int] -and $Settings.schemaVersion -isnot [long]) -or $Settings.schemaVersion -ne 1 -or $Settings.actualT1 -isnot [bool] -or $Settings.actualT1 -ne $false -or $Settings.copyId -cne 'e16b70f0-4057-428b-9abc-6bbcaf35fe82' -or $Settings.database -cne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $Settings.stableOrigin -cne 'https://semih.tail295701.ts.net:8443'){throw 'HUB_STACK_TARGET_REJECTED'}
 if($Settings.ownerSid -cnotmatch '^S-1-5-21-([1-9][0-9]*-){3}[1-9][0-9]*$' -or $Settings.ownerSid -cne $ActualOwnerSid){throw 'HUB_STACK_OWNER_REJECTED'}
 if(@($Settings.releaseRoots).Count -ne 2 -or $Settings.releaseRoots[0] -ne 'C:\Sirket\ERP\releases' -or $Settings.releaseRoots[1] -ne 'C:\Sirket\CRM\releases' -or $Settings.runtimeRoot -ne 'C:\Sirket\ERP\runtime' -or $Settings.windowsRoot -ne 'C:\Windows'){throw 'HUB_STACK_ROOT_REJECTED'}
 Assert-HubStackFields $Settings.node @('path','sha256');Assert-HubStackPath $Settings.node.path;Assert-HubStackHash $Settings.node.sha256
 if([IO.Path]::GetFileName($Settings.node.path) -ne 'node.exe' -or $Settings.node.path.StartsWith($Settings.runtimeRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or @($Settings.releaseRoots|Where-Object {$Settings.node.path.StartsWith($_+'\',[StringComparison]::OrdinalIgnoreCase)}).Count){throw 'HUB_STACK_NODE_SCOPE_REJECTED'}
 Assert-HubStackFields $Settings.stackPackage @('packageRoot','sourceCommit','manifestSha256','entrySha256')
 Assert-HubStackPath $Settings.stackPackage.packageRoot $Settings.releaseRoots[0]
 Assert-HubStackHash $Settings.stackPackage.sourceCommit 40;Assert-HubStackHash $Settings.stackPackage.manifestSha256;Assert-HubStackHash $Settings.stackPackage.entrySha256
 Assert-HubStackFields $Settings.components @('erpApiNative','nativeOrder','crm','hub','edge')
 foreach($name in @('erpApiNative','nativeOrder','crm','hub','edge')){
  $p=$Settings.components.$name;Assert-HubStackFields $p @('packageRoot','sourceCommit','manifestSha256','config')
  $root=if($name -eq 'crm'){$Settings.releaseRoots[1]}else{$Settings.releaseRoots[0]}
  Assert-HubStackPath $p.packageRoot $root;Assert-HubStackHash $p.sourceCommit 40;Assert-HubStackHash $p.manifestSha256;Assert-HubStackConfigReference $p.config
 }
 if($Settings.PSObject.Properties['privateSources']){
  Assert-HubStackFields $Settings.privateSources @('operationConfig','crmActivationConfig','nativeOrderConfig','hubPinConfig')
  foreach($ref in $Settings.privateSources.PSObject.Properties){Assert-HubStackConfigReference $ref.Value}
 }
 if($Settings.PSObject.Properties['dependencyLocks']){
  Assert-HubStackFields $Settings.dependencyLocks @('erpApiNative','nativeOrder','crm')
  foreach($name in @('erpApiNative','nativeOrder','crm')){
   $ref=$Settings.dependencyLocks.$name;Assert-HubStackFields $ref @('path','sha256');Assert-HubStackPath $ref.path $Settings.components.$name.packageRoot;Assert-HubStackHash $ref.sha256
   if($ref.path -ine (Join-Path $Settings.components.$name.packageRoot 'hub-dependency-lock.json')){throw 'HUB_STACK_DEPENDENCY_LOCK_SCOPE_REJECTED'}
  }
 }
 if($Settings.PSObject.Properties['crmPrivateFiles']){
  Assert-HubStackFields $Settings.crmPrivateFiles @('baseline','catalogAccess')
  foreach($ref in $Settings.crmPrivateFiles.PSObject.Properties){Assert-HubStackFields $ref.Value @('path','sha256');Assert-HubStackPath $ref.Value.path;Assert-HubStackHash $ref.Value.sha256}
 }
}
function Assert-HubStackFilePin([string]$Path,[string]$Sha256) {
 Assert-HubStackNoReparse $Path
 if((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ine $Sha256){throw 'HUB_STACK_FILE_PIN_REJECTED'}
}
function Assert-HubStackPackage($Pin,[bool]$Crm=$false) {
 Assert-HubStackFilePin (Join-Path $Pin.packageRoot 'release-manifest.json') $Pin.manifestSha256
 $manifest=Get-Content -LiteralPath (Join-Path $Pin.packageRoot 'release-manifest.json') -Raw|ConvertFrom-Json
 $source=if($Crm){$manifest.source.commit}else{$manifest.sourceCommit}
 if($source -cne $Pin.sourceCommit -or !$manifest.files -or @($manifest.files).Count -eq 0){throw 'HUB_STACK_PACKAGE_IDENTITY_REJECTED'}
 $seen=@{}
 foreach($file in $manifest.files){
  if($file.path -isnot [string] -or $file.path -match '(^[/\\]|:|[\x00-\x1f"''%`$<>|?*])' -or @($file.path.Replace('/','\').Split('\')|Where-Object {$_ -in @('','..','.')}).Count){throw 'HUB_STACK_MANIFEST_PATH_REJECTED'}
  $target=Join-Path $Pin.packageRoot $file.path.Replace('/','\');Assert-HubStackPath $target $Pin.packageRoot
  if($seen.ContainsKey($target.ToLowerInvariant())){throw 'HUB_STACK_MANIFEST_DUPLICATE_REJECTED'};$seen[$target.ToLowerInvariant()]=$true
  Assert-HubStackHash $file.sha256;Assert-HubStackFilePin $target $file.sha256
 }
 if(!$seen.ContainsKey((Join-Path $Pin.packageRoot $(if($Crm){'deploy\test-server.mjs'}else{'apps\api\package.json'})).ToLowerInvariant())){throw 'HUB_STACK_MANIFEST_ENTRY_REJECTED'}
}
function Get-HubStackStages {
 @(
  [pscustomobject]@{name='erpNative';component='erpApiNative';ports=@(4186);entry='apps\api\start-shared-test-copy.mjs';mode='native'},
  [pscustomobject]@{name='erpApi';component='erpApiNative';ports=@(4184);entry='apps\api\start-shared-test-copy.mjs';mode='erp'},
  [pscustomobject]@{name='crmNativeOrder';component='nativeOrder';ports=@(62704);entry='apps\api\start-crm-order-test.mjs';mode='--shared-current-test'},
  [pscustomobject]@{name='crmCatalog';component='crm';ports=@(62702);entry='deploy\test-erp-catalog.mjs';mode=''},
  [pscustomobject]@{name='crmOrders';component='crm';ports=@(62703);entry='deploy\test-erp-orders.mjs';mode=''},
  [pscustomobject]@{name='crmServer';component='crm';ports=@(62700,62701);entry='deploy\test-server.mjs';mode=''},
  [pscustomobject]@{name='hub';component='hub';ports=@(5234);entry='apps\api\start-shared-test-copy-web.mjs';mode=''},
  [pscustomobject]@{name='edge';component='edge';ports=@(5244);entry='scripts\canonical\hub-stable-edge.mjs';mode=''}
 )
}
function Test-HubStackProcessEvidence($Evidence,$Stage,$Settings) {
 $pin=$Settings.components.($Stage.component)
 if(!$Evidence -or $Evidence.verified -isnot [bool] -or $Evidence.verified -ne $true -or $Evidence.pid -isnot [int] -or $Evidence.pid -le 0 -or $Evidence.ownerSid -cne $Settings.ownerSid -or $Evidence.nodePath -ine $Settings.node.path -or $Evidence.packageRoot -ine $pin.packageRoot -or $Evidence.sourceCommit -cne $pin.sourceCommit -or $Evidence.configPath -ine $pin.config.path -or $Evidence.configSha256 -ine $pin.config.sha256 -or $Evidence.copyId -cne $Settings.copyId -or $Evidence.creationMatched -isnot [bool] -or $Evidence.creationMatched -ne $true -or $Evidence.actualT1 -isnot [bool] -or $Evidence.actualT1 -ne $false){return $false}
 if(@($Evidence.ports).Count -ne @($Stage.ports).Count -or @(Compare-Object @($Evidence.ports|Sort-Object) @($Stage.ports|Sort-Object)).Count){return $false}
 return $true
}
function Assert-HubStackSqlEvidence($Evidence,$Settings) {
 if(!$Evidence -or $Evidence.ready -isnot [bool] -or $Evidence.ready -ne $true -or $Evidence.readOnlyProbe -isnot [bool] -or $Evidence.readOnlyProbe -ne $true -or $Evidence.database -cne $Settings.database -or $Evidence.copyId -cne $Settings.copyId -or $Evidence.actualT1 -isnot [bool] -or $Evidence.actualT1 -ne $false -or $Evidence.sysadmin -isnot [int] -or $Evidence.sysadmin -ne 0 -or $Evidence.control -isnot [int] -or $Evidence.control -ne 0 -or $Evidence.live -isnot [int] -or $Evidence.live -ne 0 -or $Evidence.original -isnot [int] -or $Evidence.original -ne 0){throw 'HUB_STACK_SQL_READY_REJECTED'}
}
function Invoke-HubStackOfflineSequence($Settings,$Drivers) {
 # Only a library caller supplies in-memory scriptblocks. Runtime JSON cannot
 # select drivers or commands. The real entry below never calls this prototype.
 $keys=@('VerifyPins','SqlReady','InspectPort','StartChild','RecordReceipt','WaitForChildren','WritePrivateFailure','Delay')
 foreach($key in $keys){if(!$Drivers.ContainsKey($key) -or $Drivers[$key] -isnot [scriptblock]){throw 'HUB_STACK_OFFLINE_DRIVER_REJECTED'}}
 if(@($Drivers.Keys|Where-Object {$_ -notin $keys}).Count){throw 'HUB_STACK_OFFLINE_DRIVER_REJECTED'}
 for($attempt=0;$attempt -le 3;$attempt++){
  try{
   & $Drivers.VerifyPins $Settings
   $sql=& $Drivers.SqlReady $Settings;Assert-HubStackSqlEvidence $sql $Settings
   $children=@()
   foreach($stage in @(Get-HubStackStages)){
    $existing=& $Drivers.InspectPort $stage $Settings
    if(!$existing -or $existing.state -notin @('empty','verified')){throw 'HUB_STACK_FOREIGN_PORT_REJECTED'}
    if($existing.state -eq 'verified'){$child=$existing.evidence}else{$child=& $Drivers.StartChild $stage $Settings}
    if(!(Test-HubStackProcessEvidence $child $stage $Settings)){throw 'HUB_STACK_CHILD_EVIDENCE_REJECTED'}
    & $Drivers.RecordReceipt $child $stage $attempt;$children+=,$child
   }
   & $Drivers.WaitForChildren $children $attempt
   throw 'HUB_STACK_CHILD_EXITED'
  }catch{
   $failure=$_
   $code=if($failure.Exception.Message -cmatch '^HUB_STACK_[A-Z_]+$'){$failure.Exception.Message}else{'HUB_STACK_ATTEMPT_FAILED'}
   # Do not persist a raw exception that could contain config/password values.
   & $Drivers.WritePrivateFailure ([pscustomobject]@{attempt=$attempt;code=$code;sourceCommit=$Settings.stackPackage.sourceCommit})
   if($attempt -ge 3){throw 'HUB_STACK_RETRY_EXHAUSTED'}
   & $Drivers.Delay 60
  }
 }
}
function Get-HubStackExistingReadiness($Settings) {
 $results=@()
 foreach($stage in @(Get-HubStackStages)){
  $connections=@(Get-NetTCPConnection -State Listen -LocalPort $stage.ports -ErrorAction SilentlyContinue)
  if(!$connections){$results+=,[pscustomobject]@{stage=$stage.name;state='not-running'};continue}
  $ids=@($connections.OwningProcess|Select-Object -Unique)
  if($ids.Count -ne 1 -or @($connections|Where-Object {$_.LocalAddress -ne '127.0.0.1' -and $_.LocalAddress -cnotmatch '^192\.168\.1\.([1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$'}).Count){throw 'HUB_STACK_FOREIGN_PORT_REJECTED'}
  foreach($port in $stage.ports){if(!@($connections|Where-Object {$_.LocalAddress -eq '127.0.0.1' -and $_.LocalPort -eq $port}).Count){throw 'HUB_STACK_LOOPBACK_REQUIRED'}}
  $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$ids[0])
  $pin=$Settings.components.($stage.component)
  $entry=Join-Path $pin.packageRoot $stage.entry
  if(!$process -or $process.ExecutablePath -ine $Settings.node.path -or (Invoke-CimMethod $process -MethodName GetOwnerSid).Sid -cne $Settings.ownerSid -or !$process.CommandLine.Contains($entry)){throw 'HUB_STACK_PROCESS_IDENTITY_REJECTED'}
  # Entry/owner alone is not an adoption proof. CRM currently has env-only
  # config identity; no exact receipt/config creation match is fabricated.
  if($stage.component -eq 'crm'){$results+=,[pscustomobject]@{stage=$stage.name;state='owner-entry-matched-not-adoptable';reason='PINNED_ENV_AND_RECEIPT_PROBE_REQUIRED'};continue}
  if(!$process.CommandLine.Contains($pin.config.path)){throw 'HUB_STACK_PROCESS_CONFIG_REJECTED'}
  if($stage.name -eq 'edge'){$results+=,[pscustomobject]@{stage=$stage.name;state='owner-entry-matched-not-adoptable';reason='EDGE_HEALTH_AND_RECEIPT_PROBE_REQUIRED'};continue}
  $health=Invoke-RestMethod ('http://127.0.0.1:'+$stage.ports[0]+'/test-health') -TimeoutSec 3 -MaximumRedirection 0
  $db=if($health.PSObject.Properties['databaseName']){$health.databaseName}else{$health.database}
  if($health.ok -ne $true -or $health.environment -cne 'ISOLATED_TEST_COPY' -or $db -cne $Settings.database -or $health.copyId -cne $Settings.copyId -or $health.actualT1 -ne $false -or $health.sourceCommit -cne $pin.sourceCommit){throw 'HUB_STACK_HEALTH_IDENTITY_REJECTED'}
  if($stage.name -in @('erpNative','erpApi') -and ($health.sysadmin -ne 0 -or $health.databaseControl -ne 0 -or $health.liveDatabaseAccess -ne 0 -or $health.originalDatabaseAccess -ne 0 -or $health.externalOperations -ne $false -or $health.automaticJobs -ne $false)){throw 'HUB_STACK_HEALTH_PRIVILEGE_REJECTED'}
  $results+=,[pscustomobject]@{stage=$stage.name;state='existing-readiness-only-not-adopted';pid=[int]$ids[0]}
 }
 return $results
}
if($Library){return}
Assert-HubStackPath $StartupConfigPath 'C:\Sirket\ERP\runtime';Assert-HubStackHash $StartupConfigSha256
Assert-HubStackFilePin $StartupConfigPath $StartupConfigSha256
$settings=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Assert-HubStackSettings $settings $owner
$ownEntry=Join-Path $settings.stackPackage.packageRoot 'scripts\canonical\watch-hub-stack.ps1'
if([IO.Path]::GetFullPath($PSCommandPath) -ine $ownEntry){throw 'HUB_STACK_EXECUTION_PACKAGE_REJECTED'}
Assert-HubStackFilePin $settings.node.path $settings.node.sha256
Assert-HubStackPackage $settings.stackPackage;Assert-HubStackFilePin $ownEntry $settings.stackPackage.entrySha256
foreach($name in @('erpApiNative','nativeOrder','crm','hub','edge')){
 $pin=$settings.components.$name;Assert-HubStackPackage $pin ($name -eq 'crm');Assert-HubStackFilePin $pin.config.path $pin.config.sha256
}
if($settings.PSObject.Properties['privateSources']){foreach($ref in $settings.privateSources.PSObject.Properties){Assert-HubStackFilePin $ref.Value.path $ref.Value.sha256}}
if($Action -in @('Probe','Start')){
 if(!$settings.PSObject.Properties['dependencyLocks'] -or !$settings.PSObject.Properties['privateSources'] -or !$settings.PSObject.Properties['crmPrivateFiles']){throw 'HUB_STACK_ACTIVATION_DEPENDENCY_PINS_REQUIRED'}
 foreach($ref in $settings.dependencyLocks.PSObject.Properties){Assert-HubStackFilePin $ref.Value.path $ref.Value.sha256}
 foreach($ref in $settings.crmPrivateFiles.PSObject.Properties){Assert-HubStackFilePin $ref.Value.path $ref.Value.sha256}
 $runtime=Join-Path $settings.runtimeRoot 'hub-stable-stack';New-Item -ItemType Directory -Path $runtime -Force|Out-Null;Assert-HubStackNoReparse $runtime
 $driver=Join-Path $settings.stackPackage.packageRoot 'scripts\canonical\hub-stack-driver.mjs'
 $attempts=if($Action -eq 'Probe'){0}else{3}
 $run=[guid]::NewGuid().ToString('N')
 for($attempt=0;$attempt -le $attempts;$attempt++){
  try{
   # Node performs full package/dependency/config/SQL/OS proof on every attempt.
   # It starts fixed direct children, not either legacy nested Watch supervisor.
   $arguments=@(('"'+$driver+'"'),'--config',('"'+$StartupConfigPath+'"'),'--sha256',$StartupConfigSha256,'--owner-sid',$owner,'--mode',$Action)
   $child=Start-Process -FilePath $settings.node.path -ArgumentList $arguments -WorkingDirectory $settings.stackPackage.packageRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime ('driver-'+$run+'-'+$attempt+'.out.log')) -RedirectStandardError (Join-Path $runtime ('driver-'+$run+'-'+$attempt+'.err.log'))
   $null=$child.Handle;$child.WaitForExit()
   if($null -eq $child.ExitCode -or $child.ExitCode -ne 0){throw 'HUB_STACK_DRIVER_FAILED'}
   if($Action -eq 'Probe'){Write-Output 'HUB_STACK_READONLY_PROBE_VERIFIED';exit 0}
   throw 'HUB_STACK_DRIVER_EXITED'
  }catch{
   $failure=$_;$code=if($failure.Exception.Message -cmatch '^HUB_STACK_[A-Z_]+$'){$failure.Exception.Message}else{'HUB_STACK_ATTEMPT_FAILED'}
   [pscustomobject]@{attempt=$attempt;code=$code;sourceCommit=$settings.stackPackage.sourceCommit;actualT1=$false;checkedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $runtime ('driver-'+$run+'-'+$attempt+'.failure.json')) -Encoding utf8
   if($attempt -ge $attempts){throw 'HUB_STACK_RETRY_EXHAUSTED'}
   Start-Sleep -Seconds 60
  }
 }
}
$readiness=@(Get-HubStackExistingReadiness $settings)
[pscustomobject]@{prepared=$true;installed=$false;actualBootTested=$false;sourceCommit=$settings.stackPackage.sourceCommit;existingReadiness=$readiness;blockers=@('Future immutable candidate/private/dependency pins must be populated and independently reviewed','Exact activation approval and S4U noninteractive access proof','Actual boot/logon and network delivery have not been executed')}|ConvertTo-Json -Depth 5
