param([string]$StartupConfigPath, [switch]$Library, [switch]$Once)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Same-ErpPath($A,$B) {
 if (!$A -or !$B) {return $false}
 return [IO.Path]::GetFullPath($A).TrimEnd('\','/').Equals([IO.Path]::GetFullPath($B).TrimEnd('\','/'),[StringComparison]::OrdinalIgnoreCase)
}
function Outside-ErpPath($Path,$Root) {
 $p=[IO.Path]::GetFullPath($Path);$r=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
 return !(Same-ErpPath $p $r) -and !$p.StartsWith($r+'\',[StringComparison]::OrdinalIgnoreCase)
}
function Write-ErpState($Path,$Value) {
 $temporary=$Path+'.'+[guid]::NewGuid().ToString('N')+'.tmp';$backup=$temporary+'.bak'
 try {
  [IO.File]::WriteAllText($temporary,($Value | ConvertTo-Json -Depth 12),(New-Object Text.UTF8Encoding($false)))
  if ([IO.File]::Exists($Path)) {[IO.File]::Replace($temporary,$Path,$backup)} else {[IO.File]::Move($temporary,$Path)}
 } finally {foreach($file in @($temporary,$backup)){if([IO.File]::Exists($file)){[IO.File]::Delete($file)}}}
}
function Get-ErpSafeCode($Exception) {
 if($Exception.Message -cmatch '^[A-Z][A-Z0-9_]{0,100}$'){return $Exception.Message}
 return 'TEST_OPERATION_UNAVAILABLE'
}
function Get-ErpMutexName($Root,$OwnerSid) {
 $canonical=[IO.Path]::GetFullPath($Root.Replace('/','\')).TrimEnd('\').ToLowerInvariant()
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))).Replace('-','').Substring(0,16)}finally{$sha.Dispose()}
 return 'Global\MelisaERPTEST-'+$OwnerSid+'-'+$hash
}
function Get-ErpRecoveryDecision($Failures,$StableSeconds) {
 if($StableSeconds -ge 120){$Failures=0}
 if($Failures -ge 5){return @{State='circuit-open';Failures=$Failures;DelaySeconds=0}}
 return @{State='restart-wait';Failures=($Failures+1);DelaySeconds=([Math]::Min(60,5*[Math]::Pow(2,$Failures)))}
}
function Read-ErpStartupConfig($Path) {
 if(![IO.Path]::IsPathRooted($Path)){throw 'TEST_STARTUP_CONFIG_ABSOLUTE_REQUIRED'}
 $c=Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
 $required=@('RepoRoot','ReleaseRoot','ConfigPath','RuntimeDir','LogDir','NodePath','NodeSha256','OwnerSid','SourceCommit','ManifestSha256','ExpectedDatabase','TaskName')
 $keys=$required+@('ApiComponent')
 foreach($property in $c.PSObject.Properties.Name){if($property -notin $keys){throw 'TEST_STARTUP_CONFIG_UNKNOWN_FIELD'}}
 foreach($key in $required){if(!$c.PSObject.Properties[$key] -or !$c.$key){throw 'TEST_STARTUP_CONFIG_FIELD_REQUIRED'}}
 foreach($key in @('RepoRoot','ReleaseRoot','ConfigPath','RuntimeDir','LogDir','NodePath')){
  if(![IO.Path]::IsPathRooted($c.$key) -or $c.$key -match '["\r\n]'){throw 'TEST_STARTUP_CONFIG_PATH_REJECTED'}
  if($key -notin @('RuntimeDir','LogDir') -and !(Test-Path -LiteralPath $c.$key)){throw 'TEST_STARTUP_CONFIG_PATH_MISSING'}
 }
 foreach($private in @($Path,$c.ConfigPath,$c.RuntimeDir,$c.LogDir)){
  if(!(Outside-ErpPath $private $c.RepoRoot) -or !(Outside-ErpPath $private $c.ReleaseRoot)){throw 'TEST_STARTUP_PRIVATE_STATE_OVERLAP'}
 }
 if(!(Outside-ErpPath $c.ReleaseRoot $c.RepoRoot) -or !(Outside-ErpPath $c.RepoRoot $c.ReleaseRoot)){throw 'TEST_STARTUP_PACKAGE_OVERLAP'}
 if($c.ExpectedDatabase -ne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $c.TaskName -notmatch '^Melisa-ERP-TEST-[A-Za-z0-9_-]+$'){throw 'TEST_STARTUP_SCOPE_REJECTED'}
 if($c.SourceCommit -notmatch '^[a-f0-9]{40}$' -or $c.ManifestSha256 -notmatch '^[a-fA-F0-9]{64}$' -or $c.NodeSha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'TEST_STARTUP_PIN_REJECTED'}
 if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne $c.OwnerSid){throw 'TEST_STARTUP_OWNER_MISMATCH'}
 if((Get-FileHash -LiteralPath $c.NodePath -Algorithm SHA256).Hash -ne $c.NodeSha256){throw 'TEST_STARTUP_NODE_HASH_MISMATCH'}
 $origin=& git -C $c.RepoRoot remote get-url origin; if($LASTEXITCODE -ne 0 -or $origin -ne 'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'){throw 'TEST_STARTUP_ORIGIN_MISMATCH'}
 $push=& git -C $c.RepoRoot remote get-url --push origin; if($LASTEXITCODE -ne 0 -or $push -ne $origin){throw 'TEST_STARTUP_PUSH_ORIGIN_MISMATCH'}
 $privateConfig=Get-Content -LiteralPath $c.ConfigPath -Raw | ConvertFrom-Json
 if($privateConfig.database -ne $c.ExpectedDatabase -or $privateConfig.server -ne '127.0.0.1' -or $privateConfig.sqlPort -ne 1433 -or $privateConfig.erpPort -ne 4144 -or $privateConfig.nativePort -ne 4146 -or $privateConfig.webPort -ne 5194){throw 'TEST_STARTUP_DATABASE_CONFIG_MISMATCH'}
 Assert-ErpRelease $c | Out-Null
 if($c.PSObject.Properties['ApiComponent']){
  $api=Get-ErpApiComponentConfig $c
  $m=Assert-ErpRelease $api
  if($m.kind -cne 'CANONICAL_TEST125_BUSINESS_WORKFACE_CANDIDATE' -or $m.businessWorkfaceId -cne 'ERP-5244-REALDATA-20261027' -or $m.businessWorkfaceReadOnly -ne $true -or $m.normalSessionSourceCommit -cnotmatch '^[a-f0-9]{40}$' -or !$m.PSObject.Properties['businessSessionSignerDomain'] -or $m.businessSessionSignerDomain -cne 'dedicated-business-key-v1' -or !$privateConfig.PSObject.Properties['businessWorkface'] -or $privateConfig.businessWorkface.id -cne $m.businessWorkfaceId -or $privateConfig.businessWorkface.userId -ne 17 -or $privateConfig.businessWorkface.actualT1 -ne $false -or $privateConfig.businessWorkface.externalOperations -ne $false){throw 'TEST_STARTUP_COMPONENT_PROFILE_REJECTED'}
 }
 return $c
}
function Get-ErpApiComponentConfig($Config){
 if(!$Config.PSObject.Properties['ApiComponent']){return $Config}
 $part=$Config.ApiComponent;$keys=@('ReleaseRoot','SourceCommit','ManifestSha256')
 if(!$part -or @($part.PSObject.Properties.Name).Count -ne 3 -or @($part.PSObject.Properties.Name|Where-Object {$_ -notin $keys}).Count -or !$part.ReleaseRoot -or $part.SourceCommit -cne $Config.SourceCommit -or $part.ManifestSha256 -cnotmatch '^[a-fA-F0-9]{64}$'){throw 'TEST_STARTUP_COMPONENT_PIN_REJECTED'}
 if(![IO.Path]::IsPathRooted($part.ReleaseRoot) -or $part.ReleaseRoot -match '["\r\n]' -or !([IO.Path]::GetFullPath($part.ReleaseRoot).StartsWith('C:\Sirket\ERP\releases\',[StringComparison]::OrdinalIgnoreCase)) -or !(Outside-ErpPath $part.ReleaseRoot $Config.RepoRoot) -or !(Outside-ErpPath $Config.RepoRoot $part.ReleaseRoot) -or !(Outside-ErpPath $part.ReleaseRoot $Config.RuntimeDir) -or !(Outside-ErpPath $part.ReleaseRoot $Config.ReleaseRoot) -or !(Outside-ErpPath $Config.ReleaseRoot $part.ReleaseRoot)){throw 'TEST_STARTUP_COMPONENT_PATH_REJECTED'}
 $copy=[pscustomobject]@{};foreach($property in $Config.PSObject.Properties){if($property.Name -ne 'ApiComponent'){$copy|Add-Member -NotePropertyName $property.Name -NotePropertyValue $property.Value}}
 $copy.ReleaseRoot=$part.ReleaseRoot;$copy.SourceCommit=$part.SourceCommit;$copy.ManifestSha256=$part.ManifestSha256
 return $copy
}
function Get-ErpServiceConfig($Config,$Definition){if($Definition.Name -ceq 'api'){return Get-ErpApiComponentConfig $Config};return $Config}
function Assert-ErpRelease($Config) {
 if((Get-FileHash -LiteralPath $Config.NodePath -Algorithm SHA256).Hash -ne $Config.NodeSha256){throw 'TEST_STARTUP_NODE_HASH_MISMATCH'}
 $manifestPath=Join-Path $Config.ReleaseRoot 'release-manifest.json'
 if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne $Config.ManifestSha256){throw 'TEST_STARTUP_MANIFEST_HASH_MISMATCH'}
 $m=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
 if($m.sourceCommit -ne $Config.SourceCommit -or $m.database -ne $Config.ExpectedDatabase -or $m.writes -ne $true -or $m.writeScope -ne 'existing-named-test-records' -or !$m.baselineReproduced){throw 'TEST_STARTUP_RELEASE_IDENTITY_MISMATCH'}
 foreach($file in $m.files){
  $target=[IO.Path]::GetFullPath((Join-Path $Config.ReleaseRoot $file.path))
  if(!( $target.StartsWith($Config.ReleaseRoot.TrimEnd('\','/')+'\',[StringComparison]::OrdinalIgnoreCase)) -or (((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)){throw 'TEST_STARTUP_MANIFEST_PATH_REJECTED'}
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $file.sha256){throw 'TEST_STARTUP_RELEASE_HASH_MISMATCH'}
 }
 return $m
}
function Get-ErpServiceDefinitions($Config) {
 $api=Join-Path $Config.ReleaseRoot 'apps\api'
 $component=Get-ErpApiComponentConfig $Config;$mainApi=Join-Path $component.ReleaseRoot 'apps\api'
 return @(
  @{Name='web';Port=5194;Script=(Join-Path $api 'start-canonical-web.mjs');Args=@($Config.ConfigPath);WorkingDirectory=$api},
  @{Name='native';Port=4146;Script=(Join-Path $api 'start-canonical-test.mjs');Args=@('native',$Config.ConfigPath);WorkingDirectory=$api},
  @{Name='api';Port=4144;Script=(Join-Path $mainApi 'start-canonical-test.mjs');Args=@('erp',$Config.ConfigPath);WorkingDirectory=$mainApi}
 )
}
function Get-ErpProcess($ProcessId){return Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$ProcessId)}
function Assert-ErpOwnedProcess($ProcessId,$Config,$Definition,$CreatedAt='') {
 $p=Get-ErpProcess $ProcessId;if(!$p){return $null}
 try{$owner=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid}catch{
  if($_.Exception -is [Microsoft.Management.Infrastructure.CimException] -and $_.Exception.StatusCode -eq 6 -and !(Get-ErpProcess $ProcessId)){return $null};throw
 }
 $fresh=Get-ErpProcess $ProcessId;if(!$fresh){return $null}
 if($fresh.CreationDate -ne $p.CreationDate){throw 'TEST_STARTUP_PID_REUSED'}
 if($CreatedAt -and [Math]::Abs(($p.CreationDate.ToUniversalTime()-([datetime]$CreatedAt).ToUniversalTime()).TotalSeconds) -gt 1){throw 'TEST_STARTUP_PID_REUSED'}
 if($owner.ReturnValue -ne 0 -or $owner.Sid -ne $Config.OwnerSid -or !(Same-ErpPath $p.ExecutablePath $Config.NodePath)){throw 'TEST_STARTUP_PROCESS_OWNER_MISMATCH'}
 foreach($argument in @($Definition.Script)+$Definition.Args){if($p.CommandLine -notmatch ('(?:^|\s)"?'+[regex]::Escape($argument)+'"?(?:\s|$)')){throw 'TEST_STARTUP_PROCESS_ARGUMENT_MISMATCH'}}
 return $p
}
function Assert-ErpHealth($Config,$Definition) {
 $baseConfig=$Config;$Config=Get-ErpServiceConfig $Config $Definition
 $h=Invoke-RestMethod ('http://127.0.0.1:'+$Definition.Port+'/test-health') -TimeoutSec 3
 $m=Get-Content -LiteralPath (Join-Path $Config.ReleaseRoot 'release-manifest.json') -Raw | ConvertFrom-Json
 if(!$h.ok -or $h.environment -ne 'CANONICAL_TEST' -or $h.port -ne $Definition.Port -or $h.sourceCommit -ne $Config.SourceCommit -or $h.packageId -ne $m.packageId){throw 'TEST_STARTUP_HEALTH_IDENTITY_MISMATCH'}
 if($Definition.Name -ne 'web' -and ($h.databaseName -ne $Config.ExpectedDatabase -or $h.serverName -ine 'Semih\MELISADEV')){throw 'TEST_STARTUP_HEALTH_DATABASE_MISMATCH'}
 if($Definition.Name -ceq 'api' -and $baseConfig.PSObject.Properties['ApiComponent'] -and ($h.businessWorkfaceId -cne 'ERP-5244-REALDATA-20261027' -or $h.normalSessionUserId -ne 17 -or $h.persistentNormalSession -ne $true -or $h.businessSessionSignerDomain -cne 'dedicated-business-key-v1' -or $h.actualT1 -ne $false -or $h.sysadmin -ne 0 -or $h.databaseControl -ne 0 -or $h.liveDatabaseAccess -ne 0)){throw 'TEST_STARTUP_COMPONENT_HEALTH_REJECTED'}
 return $h
}
function Get-ErpServiceListeners($Definition,$Config) {
 $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $Definition.Port -ErrorAction SilentlyContinue)
 $privateConfig=Get-Content -LiteralPath $Config.ConfigPath -Raw | ConvertFrom-Json
 $lan=if($privateConfig.PSObject.Properties['lanHost']){[string]$privateConfig.lanHost}else{''}
 foreach($l in $listeners){if($l.LocalAddress -ne '127.0.0.1' -and !($Definition.Name -ne 'native' -and $lan -and $l.LocalAddress -ceq $lan)){throw 'TEST_STARTUP_FOREIGN_BINDING'}}
 if(@($listeners | Select-Object -ExpandProperty OwningProcess -Unique).Count -gt 1){throw 'TEST_STARTUP_FOREIGN_PORT_OWNER'}
 return $listeners
}
function Invoke-ErpOwnedSession($Config,[switch]$SinglePass) {
 $mutex=New-Object Threading.Mutex($false,(Get-ErpMutexName $Config.RepoRoot $Config.OwnerSid));$held=$false
 try{
  try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException] {$held=$true}
  if(!$held){Write-Output 'TEST_STARTUP_ALREADY_OWNED';return}
  New-Item -ItemType Directory -Force -Path $Config.RuntimeDir,$Config.LogDir | Out-Null
  $manifest=Assert-ErpRelease $Config;$definitions=Get-ErpServiceDefinitions $Config;$states=@{};$records=@{};$startedAt=(Get-Date).ToUniversalTime().ToString('o')
  $recordPath=Join-Path $Config.RuntimeDir 'owned-processes.json'
  if(Test-Path -LiteralPath $recordPath){$old=Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json;if($old.sourceCommit -ne $Config.SourceCommit){throw 'TEST_STARTUP_OLD_RECORD_REQUIRES_SWITCH'};foreach($property in $old.children.PSObject.Properties){$records[$property.Name]=$property.Value}}
  foreach($d in $definitions){$states[$d.Name]=@{port=$d.Port;pid=0;state='unavailable';restartCount=0;nextRestartAt=$null;lastCode=$null;unavailableSince=$null;startedAt=$null;readySince=$null;stableSeconds=0;failures=0}}
  while($true){
   foreach($d in $definitions){
    $s=$states[$d.Name];$listeners=@(Get-ErpServiceListeners $d $Config);$p=$null
    if($listeners.Count){
     $pidValue=$listeners[0].OwningProcess
     $created=if($records.ContainsKey($d.Name) -and $records[$d.Name].pid -eq $pidValue){$records[$d.Name].createdAt}else{''}
     $p=Assert-ErpOwnedProcess $pidValue $Config $d $created
     if(!$p){continue}
    } elseif($records.ContainsKey($d.Name)){$p=Assert-ErpOwnedProcess $records[$d.Name].pid $Config $d $records[$d.Name].createdAt}
    if($p){
     $s.pid=$p.ProcessId;$records[$d.Name]=@{pid=$p.ProcessId;createdAt=$p.CreationDate.ToUniversalTime().ToString('o')}
     try{Assert-ErpHealth $Config $d | Out-Null;if(!$s.readySince){$s.readySince=Get-Date};$s.stableSeconds=((Get-Date)-$s.readySince).TotalSeconds;$s.state='ready';$s.lastCode=$null;$s.unavailableSince=$null;$s.nextRestartAt=$null}
     catch{
      if($_.Exception.Message -like 'TEST_STARTUP_HEALTH_*'){throw}
      if(!$s.unavailableSince){$s.unavailableSince=Get-Date}
      $s.readySince=$null
      $s.state='starting';$s.lastCode='TEST_SERVICE_NOT_READY'
      if(((Get-Date)-$s.unavailableSince).TotalSeconds -ge 180){
       $again=Assert-ErpOwnedProcess $p.ProcessId $Config $d $p.CreationDate.ToUniversalTime().ToString('o')
       if($again){Stop-Process -Id $again.ProcessId -ErrorAction Stop}
       $s.unavailableSince=$null
      }
     }
    } else {
     if($s.state -eq 'circuit-open'){continue}
     if($s.pid){
      $stable=$s.stableSeconds;$decision=Get-ErpRecoveryDecision $s.failures $stable
      $s.failures=$decision.Failures;$s.state=$decision.State;$s.lastCode='TEST_CHILD_EXITED';$s.nextRestartAt=(Get-Date).AddSeconds($decision.DelaySeconds);$s.pid=0
      Write-ErpState (Join-Path $Config.LogDir ($d.Name+'-last-event.json')) @{event='service-closed';observedAt=(Get-Date).ToUniversalTime().ToString('o');code=$s.lastCode;state=$s.state}
     }
     if($s.state -eq 'circuit-open' -or ($s.nextRestartAt -and (Get-Date) -lt $s.nextRestartAt)){continue}
     Assert-ErpRelease (Get-ErpServiceConfig $Config $d) | Out-Null
     if(@(Get-ErpServiceListeners $d $Config).Count){throw 'TEST_STARTUP_PORT_CHANGED'}
     $argsList=@($d.Script)+$d.Args | ForEach-Object {'"'+$_+'"'}
     $child=Start-Process -FilePath $Config.NodePath -ArgumentList $argsList -WorkingDirectory $d.WorkingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Config.LogDir ($d.Name+'.out.log')) -RedirectStandardError (Join-Path $Config.LogDir ($d.Name+'.err.log'))
     $s.pid=$child.Id;$s.startedAt=Get-Date;$s.readySince=$null;$s.stableSeconds=0;$s.state='starting';$s.unavailableSince=Get-Date;$s.restartCount++;$s.nextRestartAt=$null
     $records[$d.Name]=@{pid=$child.Id;createdAt=$child.StartTime.ToUniversalTime().ToString('o')}
     Write-ErpState (Join-Path $Config.LogDir ($d.Name+'-last-event.json')) @{event='service-started';observedAt=(Get-Date).ToUniversalTime().ToString('o');pid=$child.Id;restartCount=$s.restartCount}
    }
   }
   Write-ErpState $recordPath @{sourceCommit=$Config.SourceCommit;supervisor=$PID;startedAt=$startedAt;children=$records}
   $projection=@{};foreach($name in $states.Keys){$s=$states[$name];$projection[$name]=@{port=$s.port;pid=$s.pid;state=$s.state;restartCount=$s.restartCount;lastCode=$s.lastCode;nextRestartAt=if($s.nextRestartAt){$s.nextRestartAt.ToUniversalTime().ToString('o')}else{$null}}}
   $ready=@($states.Values | Where-Object {$_.state -ne 'ready'}).Count -eq 0
   $task=Get-ScheduledTask -TaskName $Config.TaskName -TaskPath '\' -ErrorAction SilentlyContinue
   Write-ErpState (Join-Path $Config.RuntimeDir 'health-status.json') @{version=1;environment='CANONICAL_TEST';observedAt=(Get-Date).ToUniversalTime().ToString('o');sourceCommit=$Config.SourceCommit;packageId=$manifest.packageId;startup=@{taskName=$Config.TaskName;configured=([bool]$task);supervisorPid=$PID;state=if($ready){'running'}else{'degraded'}};database=@{expectedName=$Config.ExpectedDatabase;identityVerified=($states.api.state -eq 'ready' -and $states.native.state -eq 'ready');reachable=$null};services=$projection}
   if($SinglePass){return}
   Start-Sleep -Seconds 5
  }
 }finally{if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
}
if(!$Library){
 $validated=$null
 try{$validated=Read-ErpStartupConfig $StartupConfigPath;Invoke-ErpOwnedSession $validated -SinglePass:$Once}
 catch{
  $code=Get-ErpSafeCode $_.Exception
  if($validated -and (Test-Path -LiteralPath $validated.LogDir)){Write-ErpState (Join-Path $validated.LogDir 'startup-last-error.json') @{observedAt=(Get-Date).ToUniversalTime().ToString('o');code=$code}}
  Write-Error ('TEST_STARTUP_FAILED: '+$code);exit 1
 }
}
