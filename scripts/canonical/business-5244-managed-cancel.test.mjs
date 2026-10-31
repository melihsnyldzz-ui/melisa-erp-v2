import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {createHash} from 'node:crypto';

const dir=import.meta.dirname;
const ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const q=s=>"'"+s.replaceAll("'","''")+"'";
const hash=b=>createHash('sha256').update(b).digest('hex');
const originalSupervisorHash='d9f358798c5105c2c82eb5d2df154add8183d5833aed9da9521fe17cb3a4bb97';
const originalFinallyHash='278511e460a1051b7c01a5cee3dde0749bc6cfb5ce8057271914e399e7387a2f';
const sourceFiles=['start-business-5244-owned.ps1','business-5244-startup-exclusion.ps1','start-business-5244-web.ps1','business-5244-retirement-state.ps1','business-5244-retirement-channel.ps1','business-5244-maintenance-dispatch.ps1','business-5244-web-native.cs','business-5244-retirement-peer.cs'];

// Reuse the existing disposable, genuine observer/lease/Job fixture. Only
// fixed-case DATA and external network/SQL observations are adapted there.
// The finally block remains exact Writer V2 Git-LF bytes. The source envelope
// may contain the separately tested finite Web-only pin/guard additions.
function fixtureSource(sourceRoot){
 const text=fs.readFileSync(path.join(dir,'business-5244-retirement-state.test.mjs'),'utf8');
 const begin=text.indexOf('const supersessionFixture=String.raw`');
 const end=text.indexOf("`.replace('__OWNED__'",begin);
 assert(begin>=0&&end>begin,'existing bounded supersession fixture');
 const raw=text.slice(begin+'const supersessionFixture=String.raw`'.length,end);
 assert.equal(raw.split('__BODY__').length,2);
 return raw.replace('__OWNED__',path.join(sourceRoot,'start-business-5244-owned.ps1').replaceAll("'","''"))
  .replace('__PEER__',path.join(sourceRoot,'business-5244-retirement-peer.cs').replaceAll("'","''"));
}

test('managed PS5 pipeline Stop runs the original completed Current-only supervisor finally and releases the preheld same mutex', {skip:process.platform!=='win32',timeout:45000},()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir());
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-managed-current-')));
 try{
  const sourceRoot=path.join(temp,'source');fs.mkdirSync(sourceRoot);
  for(const name of sourceFiles){
   const bytes=Buffer.from(fs.readFileSync(path.join(dir,name),'utf8').replaceAll('\r\n','\n'));
   // The original finally is checked with the PS5 AST before this fixture starts.
   // A whole-file hash would incorrectly freeze unrelated finite package pins.
   fs.writeFileSync(path.join(sourceRoot,name),bytes,{flag:'wx'});
  }
  const body=String.raw`
 Exit-FixtureOldOwner
 $token=New-Business5244CurrentSupersessionAdmission $observer
 $script:fixtureAdmission=$token
 $script:fixtureLease=(Get-Business5244CurrentSupersessionContext $token).lease
 $Shared['issuerThread']=[Threading.Thread]::CurrentThread.ManagedThreadId
 $sourceHolds=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  foreach($file in [IO.Directory]::GetFiles($SourceRoot)){$sourceHolds.Add([IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read))}
  function Open-Business5244RetirementChannel($OwnerLease){
   if(![object]::ReferenceEquals($OwnerLease,$script:fixtureLease)){throw 'ISOLATED_FOREIGN_CHANNEL_LEASE'}
   Assert-Business5244StartupLease $OwnerLease -Kind Owner
   $script:fixtureChannel=[pscustomobject]@{kind='own-disposable-channel'}
   return $script:fixtureChannel
  }
  function Close-Business5244RetirementChannel($Channel){
   if(![object]::ReferenceEquals($Channel,$script:fixtureChannel)){throw 'ISOLATED_FOREIGN_CHANNEL'}
   Assert-Business5244StartupLease $script:fixtureLease -Kind Owner
   $Shared['channelClosed']=$true
  }
  function Receive-Business5244RetirementRequest($Channel){
   if(![object]::ReferenceEquals($Channel,$script:fixtureChannel)){throw 'ISOLATED_FOREIGN_CHANNEL'}
   if(!$Shared.ContainsKey('ready')){
    $c=Get-Business5244CurrentSupersessionContext $script:fixtureAdmission
    if($c.phase-cne'Completed'-or!$c.native.ChildAlive()){throw 'ISOLATED_CURRENT_NOT_COMPLETED'}
    Assert-Business5244StartupLease $c.lease -Kind Owner
    $child=[Diagnostics.Process]::GetProcessById($c.native.ChildPid);[void]$child.Handle
    if($child.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()-cne$c.native.ChildBirth){throw 'ISOLATED_CHILD_BIRTH_CHANGED'}
    $Shared['child']=$child;$Shared['childBirth']=$c.native.ChildBirth
    $Shared['completedCurrent']=$true;$Shared['mutexName']=Get-Business5244StartupMutexName
    $Shared['pendingPath']=Get-Business5244RetirementPendingPath
    $Shared['ready']=$true
   }
   Start-Sleep -Milliseconds 25
   return $null
  }
  Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028' -CurrentSupersession $token|Out-Null
 }finally{
  # Observe BEFORE the generic fixture's fallback cleanup. It cannot turn a
  # failed original finally into a successful lease/child cleanup witness.
  $Shared['finallyThread']=[Threading.Thread]::CurrentThread.ManagedThreadId
  $Shared['originalLeaseClosed']=(Get-Business5244StartupRecord $script:fixtureLease).closed
  $Shared['originalNativeClosed']=@($script:createdNatives|Where-Object{!$_.RetirementConfirmed}).Count-eq0
  foreach($hold in $sourceHolds){$hold.Dispose()}
  $Shared['sourceHoldsClosed']=$true
 }
`;
  let worker=fixtureSource(sourceRoot).replace('__BODY__',body);
  worker='param($Shared,$SourceRoot)\n'+worker;
  assert(!worker.includes("'@"),'safe literal worker script');
  const main=String.raw`
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path __SOURCE__ 'start-business-5244-owned.ps1'),[ref]$tokens,[ref]$errors)
$finals=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.TryStatementAst]-and$n.Finally-and$n.Finally.Extent.Text.Contains('$cleanupFailed=$initRecoveryBlocked')},$true))
if($errors.Count-or$finals.Count-ne1){throw 'ORIGINAL_FINALLY_AST_MISSING'}
$sha=[Security.Cryptography.SHA256]::Create();try{$digest=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($finals[0].Finally.Extent.Text.Replace(([string][char]13+[char]10),([string][char]10))))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
if($digest-cne'__FINALLY_HASH__'){throw 'ORIGINAL_FINALLY_BYTES_CHANGED'}
$shared=[Collections.Concurrent.ConcurrentDictionary[string,object]]::new()
$rs=[runspacefactory]::CreateRunspace();$rs.Open()
$pipeline=[powershell]::Create();$pipeline.Runspace=$rs
$inner=@'
__WORKER__
'@
[void]$pipeline.AddScript($inner).AddArgument($shared).AddArgument(__SOURCE__)
$async=$pipeline.BeginInvoke();$preheld=$null;$maintenance=$null
try{
 $deadline=[datetime]::UtcNow.AddSeconds(18)
 while(!$shared.ContainsKey('ready')){
  if($async.IsCompleted){$codes=@($pipeline.Streams.Error|ForEach-Object{if($_.Exception.Message-cmatch'^[A-Z][A-Z0-9_]{1,100}$'){$_.Exception.Message}else{$_.Exception.GetType().Name}});throw ('ISOLATED_CURRENT_EARLY_EXIT '+($codes-join'|'))}
  if([datetime]::UtcNow-ge$deadline){throw 'ISOLATED_CURRENT_NOT_READY'}
  Start-Sleep -Milliseconds 20
 }
 if(!$shared['completedCurrent']-or$shared['child'].HasExited){throw 'ISOLATED_COMPLETED_CURRENT_NOT_LIVE'}
 $preheld=[Threading.Mutex]::OpenExisting($shared['mutexName'])
 if($preheld.WaitOne(0)){$preheld.ReleaseMutex();throw 'ISOLATED_LIVE_MUTEX_NOT_HELD'}
 # Microsoft managed pipeline cancellation. No process termination, target
 # attachment, debugger evaluation, Undo or token/private-field mutation.
 $pipeline.Stop()
 try{[void]$pipeline.EndInvoke($async)}catch{if($_.Exception.GetType().Name-cnotin@('MethodInvocationException','PipelineStoppedException')){throw}}
 if(!$async.IsCompleted-or!$shared['originalLeaseClosed']-or!$shared['originalNativeClosed']-or!$shared['channelClosed']-or!$shared['sourceHoldsClosed']-or$shared['issuerThread']-ne$shared['finallyThread']){throw 'ORIGINAL_CURRENT_FINALLY_NOT_CONFIRMED'}
 if(!$shared['child'].WaitForExit(2000)){throw 'ORIGINAL_CURRENT_CHILD_NOT_EXITED'}
 if(Test-Path -LiteralPath $shared['pendingPath']){throw 'COMPLETED_CURRENT_LEFT_PENDING'}
 . __STARTUP__ -Library
 function Get-Business5244StartupMutexName{return $shared['mutexName']}
 function Get-Business5244RetirementPendingPath{return $shared['pendingPath']}
 # The pre-exit handle is STILL open: this cannot silently create a new
 # named object after the old object's final handle disappears.
 $maintenance=Enter-Business5244StartupLease -Kind Maintenance
 Assert-Business5244StartupLease $maintenance -Kind Maintenance
 Exit-Business5244StartupLease $maintenance;$maintenance=$null
 foreach($file in [IO.Directory]::GetFiles(__SOURCE__)){$h=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);$h.Dispose()}
 [pscustomobject]@{status='PASS';sourceRevision='B6-WRITER-V2-20261029';historicalSupervisorSha256='__SUPERVISOR_HASH__';finallySha256='__FINALLY_HASH__';completedCurrent=$true;normalManagedStop=$true;originalFinally=$true;sameIssuerThread=$true;preExitSameMutexHandle=$true;standardMaintenanceNonAbandoned=$true;ownedChildExited=$true;sourceHoldsReleased=$true;undoCalls=0;debuggerEvaluationCalls=0;productionTargets=0;sqlCalls=0;apiCalls=0;taskCalls=0}|ConvertTo-Json -Compress
}finally{
 if($maintenance){Exit-Business5244StartupLease $maintenance}
 if(!$async.IsCompleted){$pipeline.Stop()}
 $pipeline.Dispose();$rs.Dispose()
 if($preheld){$preheld.Dispose()}
 if($shared.ContainsKey('child')){$shared['child'].Dispose()}
}
`.replace('__WORKER__',worker).replaceAll('__SOURCE__',q(sourceRoot)).replace('__STARTUP__',q(path.join(sourceRoot,'business-5244-startup-exclusion.ps1'))).replaceAll('__SUPERVISOR_HASH__',originalSupervisorHash).replaceAll('__FINALLY_HASH__',originalFinallyHash);
  const file=path.join(temp,'managed-current.ps1');fs.writeFileSync(file,main,{flag:'wx'});
  const output=cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',timeout:35000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();
  const result=JSON.parse(output);assert.equal(result.status,'PASS');assert.equal(result.standardMaintenanceNonAbandoned,true);assert.equal(result.sameIssuerThread,true);assert.equal(result.ownedChildExited,true);assert.equal(result.productionTargets,0);
 }finally{
  assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());
  assert(path.basename(temp).startsWith('b6-managed-current-'));
  assert(!fs.lstatSync(temp).isSymbolicLink());fs.rmSync(temp,{recursive:true});
 }
});


test('Completed Candidate managed Stop runs the pinned original finally with an issued API token and same preheld non-abandoned mutex', {skip:process.platform!=='win32',timeout:45000},()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-managed-candidate-')));
 try{
  const text=fs.readFileSync(path.join(dir,'test125-bound-api-quiescence.test.mjs'),'utf8'),raw=name=>{const marker='const '+name+'=String.raw`',a=text.indexOf(marker)+marker.length,b=text.indexOf('\n`;',a);assert(a>=marker.length&&b>a);return text.slice(a,b);};
  const apiRoot=path.join(temp,'api');fs.mkdirSync(apiRoot);const fixture=raw('b6Fixture').replace('__TEMP__',q(apiRoot))+raw('writerFixture');
  const worker=String.raw`param($Shared)
$ErrorActionPreference='Stop';. '__OWNED__' -Library;. '__QUIESCENCE__'
__FIXTURE__
function Get-Business5244StartupMutexName{return ('Local\MelisaCompletedCandidate-'+[IO.Path]::GetFileName($env:TEMP))}
function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'candidate.pending')}
$token=New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $native;$ctx=Assert-Test125ReadPairIssued $token
$children=[Collections.Generic.List[object]]::new();$rows=@{};$webNative=$null;$lease=$null;$sourceHolds=[Collections.Generic.List[IO.FileStream]]::new()
try{
 foreach($role in @('supervisor','api','native','web')){$si=[Diagnostics.ProcessStartInfo]::new('__NODE__','-e "setTimeout(()=>{},60000)"');$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$child=[Diagnostics.Process]::Start($si);$children.Add($child);$rows[$role]=@{pid=$child.Id;birth=$child.StartTime.ToUniversalTime().ToString('o')}}
 $ctx.admission.supervisor=$rows.supervisor.pid;$ctx.admission.supervisorBirth=$rows.supervisor.birth
 foreach($role in @('api','native','web')){$ctx.admission.children.$role.pid=$rows[$role].pid;$ctx.admission.children.$role.birth=$rows[$role].birth}
 $ctx.admissionJson=$ctx.admission|ConvertTo-Json -Depth 32 -Compress
 function Assert-Test125ReadPairTransition {param($Transition,$Mode);[void](Assert-Test125ReadPairIssued $Transition);if($Mode-cne'Current'){throw 'FIXTURE_NOT_CURRENT'};return $true}
 function Get-Test125ReadPairTask {$o=[pscustomobject]@{Xml=$script:taskXml};$o|Add-Member ScriptMethod GetInstances {param($unused);$l=[pscustomobject]@{Count=1};$l|Add-Member ScriptMethod Item {param($index);return [pscustomobject]@{EnginePID=$rows.supervisor.pid;InstanceGuid=$ctx.admission.taskInstance}};return $l};return $o}
 function Get-ErpServiceDefinitions {param($Config);return @(@{Name='api';Port=4144},@{Name='native';Port=4146},@{Name='web';Port=5194})}
 function Get-NetTCPConnection {param($State,$LocalPort);foreach($role in @('api','native','web')){[pscustomobject]@{LocalPort=$ctx.admission.children.$role.port;OwningProcess=$rows[$role].pid;LocalAddress='127.0.0.1'}}}
 function Assert-ErpHealth {return @{ok=$true;sqlReadOnly=$true;sysadmin=0}}
 [void](Prepare-Test125ReadPairRequestAdmission $token)
 # Only the terminal Candidate state is modeled: this test never activates an
 # API/profile. The actual constructor-issued reference and close routines run.
 $ctx.mode='Candidate';$ctx.phase='VERIFIED';$script:nativePhase='WriterActivated'
 $script:mutatorCalls=0;foreach($name in @('Invoke-Test125ReadPairApiTransition','Invoke-ErpBusinessSaleNativeRevision','Set-ScheduledTask','Start-ScheduledTask','Stop-ScheduledTask','Write-Test125ReadPairCas','Invoke-Sqlcmd')){Set-Item ('function:'+ $name) {$script:mutatorCalls++;throw 'CANDIDATE_CLEANUP_MUTATOR_CALLED'}}
 Initialize-Business5244WebNative;$lease=Enter-Business5244StartupLease -Kind Owner;$webNative=[Business5244WebNative]::new();$webNative.Spawn('__NODE__','-e "setInterval(()=>{},10000)"',$env:TEMP)
 $ownerPins=(Get-Business5244WebPins).Clone();function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$Mode-cnotin@('Current','Candidate')){throw 'FIXTURE_WEB_SCOPE'};return $ownerPins.Clone()}
 $state=Register-Business5244OwnedRetirement $lease $webNative $ownerPins -ScopeName 'TEST125-API-B6-WRITER-20261029';$record=Get-Business5244RetirementState $state;$record.dispatch=@{phase='Completed';result='Candidate';candidateNative=$webNative;rollbackNative=$null};$record.initializing=$false
 $lr=Get-Business5244StartupRecord $lease;$lr.ownedNatives=[Collections.Generic.List[object]]::new();$lr.ownedNatives.Add($webNative)
 $childHandle=[Diagnostics.Process]::GetProcessById($webNative.ChildPid);[void]$childHandle.Handle;$Shared['child']=$childHandle
 foreach($path in @('__OWNED__','__QUIESCENCE__')){$sourceHolds.Add([IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read))}
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('__OWNED__',[ref]$tokens,[ref]$errors);$finals=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.TryStatementAst]-and$n.Finally-and$n.Finally.Extent.Text.Contains('$cleanupFailed=$initRecoveryBlocked')},$true));if($errors.Count-or$finals.Count-ne1){throw 'ORIGINAL_CANDIDATE_FINALLY_MISSING'}
 $cleanup=$finals[0].Finally.Extent.Text;$sha=[Security.Cryptography.SHA256]::Create();try{$hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($cleanup.Replace(([string][char]13+[char]10),([string][char]10))))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()};if($hash-cne'__FINALLY_HASH__'){throw 'ORIGINAL_CANDIDATE_FINALLY_CHANGED'}
 $script:fixtureLease=$lease;$script:fixtureState=$state;$script:fixtureNative=$webNative;$script:fixtureApiToken=$token;$script:channelToken=[pscustomobject]@{fixture='own-status-channel'}
 function Close-Business5244RetirementChannel($Channel){if(![object]::ReferenceEquals($Channel,$script:channelToken)){throw 'FIXTURE_FOREIGN_CHANNEL'};Assert-Business5244StartupLease $script:fixtureLease -Kind Owner;$Shared['channelClosed']=$true}
 $body='param($Shared);$lease=$script:fixtureLease;$native=$script:fixtureNative;$retirement=$script:fixtureState;$apiTransition=$script:fixtureApiToken;$channel=$script:channelToken;$supersessionBlocked=$false;$initRecoveryBlocked=$false;$supersessionUndo=$false;$verifiedInitCleanup=$null;$initializationFailure=$null;try{$Shared[''issuerThread'']=[Threading.Thread]::CurrentThread.ManagedThreadId;$Shared[''mutexName'']=Get-Business5244StartupMutexName;$Shared[''ready'']=$true;while($true){Start-Sleep -Milliseconds 25}}finally'+$cleanup
 . ([scriptblock]::Create('function Invoke-IsolatedCompletedCandidate {'+$body+'}'));Invoke-IsolatedCompletedCandidate $Shared
}finally{
 $Shared['finallyThread']=[Threading.Thread]::CurrentThread.ManagedThreadId
 if($lease){$Shared['originalLeaseClosed']=(Get-Business5244StartupRecord $lease).closed};$Shared['nativeClosed']=($webNative-and$webNative.RetirementConfirmed)
 $Shared['requestAdmissionClosed']=($ctx.requestAdmission-and$ctx.requestAdmission.closed);$Shared['releaseClosed']=$script:releaseClosed;$Shared['mutatorCalls']=$script:mutatorCalls;$Shared['apiFixtureChildrenPreservedBeforeCleanup']=@($children|Where-Object{$_.HasExited}).Count-eq0
 foreach($h in $sourceHolds){$h.Dispose()};$Shared['sourceHoldsClosed']=$true
 foreach($child in $children){if(!$child.HasExited){$matched=@($rows.Values|Where-Object{$_.pid-eq$child.Id});if($matched.Count-ne1-or$child.StartTime.ToUniversalTime().ToString('o')-cne$matched[0].birth){throw 'FIXTURE_CHILD_CHANGED'};$child.Kill();$child.WaitForExit()};$child.Dispose()}
 if($webNative){$webNative.Dispose()};if($lease-and!(Get-Business5244StartupRecord $lease).closed){Exit-Business5244StartupLease $lease}
}
`.replaceAll('__OWNED__',path.join(dir,'start-business-5244-owned.ps1').replaceAll("'","''")).replaceAll('__QUIESCENCE__',path.join(dir,'test125-bound-api-quiescence.ps1').replaceAll("'","''")).replace('__FIXTURE__',fixture).replaceAll('__NODE__',process.execPath.replaceAll("'","''")).replaceAll('__FINALLY_HASH__',originalFinallyHash);
  assert(!worker.includes("'@"));
  const main=String.raw`$ErrorActionPreference='Stop';$shared=[Collections.Concurrent.ConcurrentDictionary[string,object]]::new();$rs=[runspacefactory]::CreateRunspace();$rs.Open();$p=[powershell]::Create();$p.Runspace=$rs
$worker=@'
__WORKER__
__PS_END__
[void]$p.AddScript($worker).AddArgument($shared);$async=$p.BeginInvoke();$preheld=$null;$maintenance=$null
try{
 $until=[datetime]::UtcNow.AddSeconds(20);while(!$shared.ContainsKey('ready')){if($async.IsCompleted){throw ('CANDIDATE_EARLY_EXIT '+(($p.Streams.Error|ForEach-Object{$_.FullyQualifiedErrorId})-join'|'))};if([datetime]::UtcNow-ge$until){throw 'CANDIDATE_NOT_READY'};Start-Sleep -Milliseconds 20}
 $preheld=[Threading.Mutex]::OpenExisting($shared['mutexName']);if($preheld.WaitOne(0)){$preheld.ReleaseMutex();throw 'CANDIDATE_MUTEX_NOT_HELD'}
 $p.Stop();try{[void]$p.EndInvoke($async)}catch{}
 foreach($key in @('originalLeaseClosed','nativeClosed','requestAdmissionClosed','releaseClosed','channelClosed','sourceHoldsClosed','apiFixtureChildrenPreservedBeforeCleanup')){if(!$shared[$key]){throw ('CANDIDATE_ORIGINAL_FINALLY_FAILED_'+$key)}}
 if($shared['mutatorCalls']-ne0-or$shared['issuerThread']-ne$shared['finallyThread']-or!$shared['child'].WaitForExit(2000)){throw 'CANDIDATE_CLEANUP_EFFECT_OR_IDENTITY_CHANGED'}
 . '__GATE__' -Library;function Get-Business5244StartupMutexName{return $shared['mutexName']};function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'candidate.pending')}
 $maintenance=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $maintenance;$maintenance=$null
 [pscustomobject]@{status='PASS';finallySha256='__FINALLY_HASH__';sameIssuerThread=$true;preheldSameMutexNonAbandoned=$true;ownedWebChildExited=$true;originalApiTokenClosed=$true;requestQueryHandlesClosed=$true;fixtureApiChildrenPreserved=$true;modeledCompletedCandidate=$true;productionAuthority=$false;mutatorCalls=0;productionTargets=0}|ConvertTo-Json -Compress
}finally{if($maintenance){Exit-Business5244StartupLease $maintenance};if(!$async.IsCompleted){$p.Stop()};$p.Dispose();$rs.Dispose();if($preheld){$preheld.Dispose()};if($shared.ContainsKey('child')){$shared['child'].Dispose()}}
`.replace('__WORKER__',worker).replace('__PS_END__',String.fromCharCode(39)+'@').replace('__GATE__',path.join(dir,'business-5244-startup-exclusion.ps1').replaceAll("'","''")).replace('__FINALLY_HASH__',originalFinallyHash);
  const driver=path.join(temp,'candidate.ps1');fs.writeFileSync(driver,main,{flag:'wx'});const output=cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',driver],{encoding:'utf8',timeout:40000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();const result=JSON.parse(output);assert.equal(result.status,'PASS');assert.equal(result.preheldSameMutexNonAbandoned,true);assert.equal(result.mutatorCalls,0);assert.equal(result.productionAuthority,false);
 }finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('b6-managed-candidate-'));fs.rmSync(temp,{recursive:true});}
});
