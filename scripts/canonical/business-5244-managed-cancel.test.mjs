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
const sourceFiles=['start-business-5244-owned.ps1','business-5244-startup-exclusion.ps1','start-business-5244-web.ps1','business-5244-retirement-state.ps1','business-5244-retirement-channel.ps1','business-5244-maintenance-dispatch.ps1','business-5244-web-native.cs','business-5244-retirement-peer.cs'];

// Reuse the existing disposable, genuine observer/lease/Job fixture. Only
// fixed-case DATA and external network/SQL observations are adapted there.
// The supervisor/finally itself is the exact pinned Writer V2 Git-LF byte sequence.
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
   if(name==='start-business-5244-owned.ps1')assert.equal(hash(bytes),originalSupervisorHash,'pinned Writer V2 supervisor, no hotload or altered finally');
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
 [pscustomobject]@{status='PASS';sourceRevision='B6-WRITER-V2-20261029';supervisorSha256='__SUPERVISOR_HASH__';completedCurrent=$true;normalManagedStop=$true;originalFinally=$true;sameIssuerThread=$true;preExitSameMutexHandle=$true;standardMaintenanceNonAbandoned=$true;ownedChildExited=$true;sourceHoldsReleased=$true;undoCalls=0;debuggerEvaluationCalls=0;productionTargets=0;sqlCalls=0;apiCalls=0;taskCalls=0}|ConvertTo-Json -Compress
}finally{
 if($maintenance){Exit-Business5244StartupLease $maintenance}
 if(!$async.IsCompleted){$pipeline.Stop()}
 $pipeline.Dispose();$rs.Dispose()
 if($preheld){$preheld.Dispose()}
 if($shared.ContainsKey('child')){$shared['child'].Dispose()}
}
`.replace('__WORKER__',worker).replaceAll('__SOURCE__',q(sourceRoot)).replace('__STARTUP__',q(path.join(sourceRoot,'business-5244-startup-exclusion.ps1'))).replace('__SUPERVISOR_HASH__',originalSupervisorHash);
  const file=path.join(temp,'managed-current.ps1');fs.writeFileSync(file,main,{flag:'wx'});
  const output=cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',timeout:35000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();
  const result=JSON.parse(output);assert.equal(result.status,'PASS');assert.equal(result.standardMaintenanceNonAbandoned,true);assert.equal(result.sameIssuerThread,true);assert.equal(result.ownedChildExited,true);assert.equal(result.productionTargets,0);
 }finally{
  assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());
  assert(path.basename(temp).startsWith('b6-managed-current-'));
  assert(!fs.lstatSync(temp).isSymbolicLink());fs.rmSync(temp,{recursive:true});
 }
});
