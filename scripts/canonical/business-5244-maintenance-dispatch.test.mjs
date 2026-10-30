import test from 'node:test';import assert from 'node:assert/strict';import cp from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),q=s=>"'"+s.replaceAll("'","''")+"'";
const fixtureHarness='dispatch';


// Approved Windows Utility comparison; import cost remains inside the original process deadline.
const fixturePhases=new Set(['SCRIPT_ENTER','UTILITY_IMPORT_ENTER','UTILITY_IMPORT_RETURNED','LIBRARY_ENTER','LIBRARY_RETURNED','GATE_LIBRARY_ENTER','GATE_LIBRARY_RETURNED','WEB_LIBRARY_ENTER','WEB_LIBRARY_RETURNED','STATE_LIBRARY_ENTER','STATE_LIBRARY_RETURNED','DISPATCH_LIBRARY_ENTER','DISPATCH_LIBRARY_RETURNED','NATIVE_INIT_ENTER','NATIVE_INIT_RETURNED','LEASE_ENTER','LEASE_ACQUIRED','SPAWN_ENTER','SPAWN_RETURNED','SETUP_RETURNED','BODY_ENTER','BODY_RETURNED','CLEANUP_ENTER','LEASE_EXIT_ENTER','LEASE_EXITED','CLEANUP_EXIT','PASS_ISSUED','SCRIPT_END','RUNSPACE_CREATE_ENTER','RUNSPACE_CREATED','RUNSPACE_OPEN_ENTER','RUNSPACE_OPEN_RETURNED','PIPELINE_CREATE_ENTER','PIPELINE_CREATED','ADD_SCRIPT_ENTER','ADD_SCRIPT_RETURNED','BEGIN_INVOKE_ENTER','BEGIN_INVOKE_RETURNED','INNER_SCRIPT_ENTER','INNER_LIBRARY_ENTER','INNER_LIBRARY_RETURNED','INNER_SUPERVISOR_ENTER','INNER_SUPERVISOR_RETURNED','INNER_FINALLY_ENTER','PIPELINE_STOP_ENTER','PIPELINE_STOP_RETURNED','END_INVOKE_ENTER','END_INVOKE_RETURNED','OWNER_READY_OBSERVED']);
const fixturePhaseWriter="function Write-FixturePhase([string]$Phase){if($Phase-cnotin@(__PHASE_NAMES__)){throw 'FIXTURE_PHASE_NAME'};$script:fixtureSequence++;$seq=$script:fixtureSequence;$time=$script:fixturePhaseClock.ElapsedMilliseconds;$stream=$null;try{$bytes=[Text.Encoding]::ASCII.GetBytes(($seq.ToString()+'|'+$Phase+'|'+$time.ToString()+[Environment]::NewLine));$stream=[IO.File]::Open($script:fixturePhasePath,[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::Read);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null;[Console]::WriteLine(('FIXTURE_FLUSH_ACK|'+$script:fixtureTraceLabel+'|'+$seq+'|'+$Phase+'|'+$time))}catch{try{[Console]::WriteLine(('FIXTURE_TRACE_IO_FAILED|'+$script:fixtureTraceLabel+'|'+$seq))}catch{}}finally{if($stream){try{$stream.Dispose()}catch{}}}}".replace('__PHASE_NAMES__',[...fixturePhases].map(q).join(','));
function phaseScript(script,tracePath){
 const lastFinally=script.lastIndexOf('finally{'),lastPass=script.lastIndexOf("'PASS'");
 assert(lastFinally>0&&script[lastFinally-1]==='}'&&lastPass>lastFinally,'FIXTURE_PHASE_BOUNDARIES');
 script=script.slice(0,lastFinally-1)+";Write-FixturePhase 'BODY_RETURNED'}finally{Write-FixturePhase 'CLEANUP_ENTER';"+script.slice(lastFinally+'finally{'.length);
 const pass=script.lastIndexOf("'PASS'");
 script=script.slice(0,pass)+"Write-FixturePhase 'CLEANUP_EXIT';Write-FixturePhase 'PASS_ISSUED';'PASS';Write-FixturePhase 'SCRIPT_END'"+script.slice(pass+6);
 return "$script:fixturePhaseClock=[Diagnostics.Stopwatch]::StartNew();$script:fixturePhasePath="+q(tracePath)+";$script:fixtureSequence=0;$script:fixtureTraceLabel='MAIN';"+fixturePhaseWriter+";Write-FixturePhase 'SCRIPT_ENTER';Write-FixturePhase 'UTILITY_IMPORT_ENTER';Microsoft.PowerShell.Core\\Import-Module -Name ($PSHOME+'\\Modules\\Microsoft.PowerShell.Utility\\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop;Write-FixturePhase 'UTILITY_IMPORT_RETURNED';"+script;
}
function phaseOutput(raw){
 const acks=[],ioFailures=[];let output='';
 for(const line of String(raw??'').match(/[^\n]*\n|[^\n]+$/g)??[]){
  const text=line.replace(/\r?\n$/,'');let m=/^FIXTURE_FLUSH_ACK\|(MAIN|INNER)\|([1-9]\d*)\|([A-Z_]+)\|(\d+)$/.exec(text);
  if(m&&fixturePhases.has(m[3])&&Number.isSafeInteger(Number(m[2]))&&Number.isSafeInteger(Number(m[4]))){acks.push({stream:m[1],sequence:Number(m[2]),phase:m[3],elapsedMs:Number(m[4])});continue;}
  m=/^FIXTURE_TRACE_IO_FAILED\|(MAIN|INNER)\|([1-9]\d*)$/.exec(text);
  if(m&&Number.isSafeInteger(Number(m[2]))){ioFailures.push({stream:m[1],sequence:Number(m[2])});continue;}
  output+=line;
 }
 return {acks,ioFailures,output};
}
function reportPhases(tracePath,started,outcome,error,raw,expectsInner=false){
 const observed=phaseOutput(raw??error?.stdout),streams=[];
 for(const label of (expectsInner?['MAIN','INNER']:['MAIN'])){
  const file=tracePath+(label==='INNER'?'.inner':'');let phases=[],state='UNKNOWN',reason='MISSING_TRACE';
  try{
   if(fs.statSync(file).size>65536)throw Error();const text=fs.readFileSync(file,'ascii');if(!text.endsWith('\n'))throw Error();
   let previous=-1;const lines=text.trimEnd().split(/\r?\n/);
   phases=lines.map((line,index)=>{const m=/^([1-9]\d*)\|([A-Z_]+)\|(\d+)$/.exec(line);if(!m||!fixturePhases.has(m[2]))throw Error();const sequence=Number(m[1]),elapsedMs=Number(m[3]);if(sequence!==index+1||!Number.isSafeInteger(elapsedMs)||elapsedMs<previous)throw Error();previous=elapsedMs;return {stream:label,sequence,phase:m[2],elapsedMs};});
   const acks=observed.acks.filter(a=>a.stream===label),failures=observed.ioFailures.filter(a=>a.stream===label);
   if(failures.length){reason='TRACE_IO_FAILURE';}
   else if(JSON.stringify(acks)!==JSON.stringify(phases)){reason='FLUSH_ACK_MISMATCH';}
   else{state=phases.at(-1)?.phase==='SCRIPT_END'?'COMPLETE':'CONFIRMED_PREFIX';reason=state==='COMPLETE'?'END_ACKED':'TAIL_AFTER_LAST_ACK_UNKNOWN';}
  }catch{reason=fs.existsSync(file)?'INVALID_OR_GAPPED_TRACE':'MISSING_TRACE';}
  streams.push({stream:label,state,reason,phases});
 }
 const code=['ETIMEDOUT','ENOENT','EACCES','ENOBUFS'].includes(error?.code)?error.code:error?'EXEC_FAILURE':null;
 const signal=['SIGTERM','SIGKILL','SIGINT'].includes(error?.signal)?error.signal:null;
 const status=Number.isInteger(error?.status)?error.status:error?null:0;
 const diagnostic={harness:fixtureHarness,outcome,nodeElapsedMs:Number((process.hrtime.bigint()-started)/1000000n),code,status,signal,traceIoFailures:observed.ioFailures,streams};
 console.error('ISOLATED_HARNESS_SUBPHASES '+JSON.stringify(diagnostic));return diagnostic;
}
const setup=String.raw`$ErrorActionPreference='Stop';$script:r=$null;trap{if($script:r -and $script:r.dispatch){[Console]::Error.WriteLine(('ISOLATED_DISPATCH_FAILURE='+$script:r.dispatch.failureCode+';stage='+$script:r.dispatch.stage))};break};
Write-FixturePhase 'LIBRARY_ENTER';Write-FixturePhase 'GATE_LIBRARY_ENTER';. '__GATE__' -Library;Write-FixturePhase 'GATE_LIBRARY_RETURNED';Write-FixturePhase 'WEB_LIBRARY_ENTER';. '__WEB__' -Library;Write-FixturePhase 'WEB_LIBRARY_RETURNED';Write-FixturePhase 'STATE_LIBRARY_ENTER';. '__STATE__' -Library;Write-FixturePhase 'STATE_LIBRARY_RETURNED';Write-FixturePhase 'DISPATCH_LIBRARY_ENTER';. '__DISPATCH__' -Library;Write-FixturePhase 'DISPATCH_LIBRARY_RETURNED';Write-FixturePhase 'LIBRARY_RETURNED';
Write-FixturePhase 'NATIVE_INIT_ENTER';Add-Type -LiteralPath '__NATIVE__';Write-FixturePhase 'NATIVE_INIT_RETURNED';$script:realCompleteBody=(Get-Command Complete-Business5244OwnedMaintenance).Definition;
function Get-Business5244StartupMutexName{return ('Local\Melisa5244DispatchTest-'+[IO.Path]::GetFileName($env:TEMP))};function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'retirement.pending')};
Write-FixturePhase 'LEASE_ENTER';$lease=Enter-Business5244StartupLease -Kind Owner;Write-FixturePhase 'LEASE_ACQUIRED';$pins=Get-Business5244ReadPairPins;$scriptFile=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($scriptFile,'Start-Sleep -Seconds 300');
function New-TestNative{Write-FixturePhase 'SPAWN_ENTER';$n=[Business5244WebNative]::new();$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$scriptFile+'"'),$env:TEMP);Write-FixturePhase 'SPAWN_RETURNED';return $n}
$native=New-TestNative;$state=Register-Business5244OwnedRetirement $lease $native $pins;$script:r=Get-Business5244RetirementState $state;$script:r.commit=@{phase='None'};
$script:counts=@{preflight=0;retire=0;spawn=0;publish=0;complete=0;reset=0};$script:scenario='Success';$script:request=[pscustomobject]@{operation='retire';requestId='isolated-local-dispatch'};$channel=[pscustomobject]@{};
$rows=@([pscustomobject]@{port=4194;pid=111;entry='keep-api';root='keep-api'},[pscustomobject]@{port=4196;pid=112;entry='keep-native';root='keep-native'},[pscustomobject]@{port=5244;pid=$native.ChildPid;entry='vite-preview';sourceCommit=$pins.frontendSource;root=$pins.root;backendPort=4144;businessWorkfaceId=$pins.profile});$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));$recordPath=Join-Path $env:TEMP 'records.json';$pendingPath=Join-Path $env:TEMP 'retirement.pending';[IO.File]::WriteAllBytes($recordPath,$before);
$script:records=[IO.File]::Open($recordPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$script:pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);
# Only external preflight/launch/normal-identity/commit adapters are isolated.
# The dispatcher, real mutex, native Job/child and held retirement/publication
# functions execute unchanged against disposable OS children and file streams.
function Assert-Business5244RetirementRequest{param($Channel,$Request);if(![object]::ReferenceEquals($Request,$script:request)){throw 'ISOLATED_FOREIGN_REQUEST'}}
function Get-Business5244MaintenancePlan{param($State);return @{candidate=$pins.Clone();rollback=$pins.Clone();hash=('a'*64)}}
function Assert-Business5244MaintenancePlan{param($Plan,$State);$script:counts.preflight++;if($script:scenario -ceq 'PreflightFail'){throw 'ISOLATED_PREFLIGHT_FAILURE'}}
function Assert-Business5244CreatedChild{param($Native,$Pins);$Native.Validate();if(!$Native.ChildAlive()){throw 'ISOLATED_CHILD_EXITED'}}
function Invoke-Business5244OwnedRetirement{param($State,$Channel,$Request);Assert-Business5244RetirementRequest $Channel $Request;$script:counts.retire++;Invoke-Business5244HeldRetirement $State $script:records $script:pending}
function New-Business5244PinnedChild{param($Pins,$Lease);$script:counts.spawn++;Assert-Business5244StartupLease -Lease $Lease -Kind Maintenance;if($script:scenario -ceq 'RollbackStartFail' -or ($script:scenario -ceq 'StartFail' -and $script:r.dispatch.stage -ceq 'CandidateStarting')){throw 'ISOLATED_START_FAILURE'};if($script:scenario -ceq 'StartUnknown' -and $script:r.dispatch.stage -ceq 'CandidateStarting'){throw 'OWNED_WEB_CLEANUP_UNCONFIRMED'};return New-TestNative}
function Publish-Business5244RetiredRecord{param($State,$ReplacementNative,$Mode,$Pins);$script:counts.publish++;if($script:scenario -ceq 'ChildDeath' -and $Mode -ceq 'Candidate'){$ReplacementNative.Dispose()};Publish-Business5244HeldRecord -State $State -ReplacementNative $ReplacementNative -Mode $Mode -Pins $Pins;if($script:scenario -ceq 'UnknownPublish' -and $Mode -ceq 'Candidate'){$script:r.phase='Unknown';$script:r.commit=@{phase='Unknown'};throw 'ISOLATED_DURABILITY_UNCONFIRMED'}}
function Reset-Business5244FailedCandidate{param($State);$script:counts.reset++;$r=Get-Business5244RetirementState $State;if($r.phase -ceq 'Unknown' -or ($r.commit -and $r.commit.phase -cin @('Archived','Unknown'))){throw 'ISOLATED_UNSAFE_RESET'};if($r.dispatch.candidateNative){$r.dispatch.candidateNative.Dispose()};$r.recordExpected=Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records);$r.publication=$null;$r.phase='Retired';$r.commit=@{phase='None'}}
function Complete-Business5244OwnedMaintenance{param($State,$ReplacementNative,$Pins,$Mode,$PlanHash);$script:counts.complete++;$r=Get-Business5244RetirementState $State;if(!$ReplacementNative.ChildAlive() -or $r.phase -cne 'Published' -or !$r.publication.confirmed){throw 'ISOLATED_COMMIT_NOT_READY'};if($script:scenario -ceq 'CommitFail' -and $Mode -ceq 'Candidate'){$r.phase='Committing';$r.commit=@{phase='PendingDurable'};throw 'ISOLATED_COMMIT_BEFORE_ARCHIVE'};$r.records.Flush($true);$r.pending.Flush($true);$archive=$r.pending.Name+'.'+[Guid]::NewGuid().ToString('N')+'.completed';$pendingName=$r.pending.Name;$r.records.Dispose();$r.records=$null;$r.pending.Dispose();$r.pending=$null;[IO.File]::Move($pendingName,$archive);$r.native=$ReplacementNative;$r.childPid=$ReplacementNative.ChildPid;$r.childBirth=$ReplacementNative.ChildBirth;$r.pins=$Pins.Clone();$r.commit=@{phase='Archived';planHash=$PlanHash;mode=$Mode;childPid=$ReplacementNative.ChildPid;childBirth=$ReplacementNative.ChildBirth;archivePath=$archive;hash=(Get-FileHash -LiteralPath $archive).Hash};$r.phase='Running';(Get-Business5244StartupRecord $r.lease).kind='Owner';if($script:scenario -ceq 'CommitAckLoss' -and $Mode -ceq 'Candidate'){throw 'ISOLATED_COMMIT_ACK_LOSS'}}
`;
const helpers={__GATE__:'business-5244-startup-exclusion.ps1',__WEB__:'start-business-5244-web.ps1',__STATE__:'business-5244-retirement-state.ps1',__DISPATCH__:'business-5244-maintenance-dispatch.ps1',__NATIVE__:'business-5244-web-native.cs'};
let source=setup+"Write-FixturePhase 'SETUP_RETURNED';Write-FixturePhase 'BODY_ENTER';";for(const [token,name]of Object.entries(helpers))source=source.replaceAll(token,path.join(dir,name).replaceAll("'","''"));
const cleanup=String.raw`finally{foreach($n in @($native,$script:r.native,$script:r.dispatch.candidateNative,$script:r.dispatch.rollbackNative)){if($n){$n.Dispose()}};if($script:r.records){$script:r.records.Dispose()};if($script:r.pending){$script:r.pending.Dispose()};$script:records.Dispose();$script:pending.Dispose();Write-FixturePhase 'LEASE_EXIT_ENTER';Exit-Business5244StartupLease -Lease $lease;Write-FixturePhase 'LEASE_EXITED'};'PASS'`;
function run(body,{recovery=false,bare=false}={}){const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'erp-5244-dispatch-'))),tracePath=path.join(temp,'phases.log'),started=process.hrtime.bigint();try{const file=path.join(temp,'run.ps1');fs.writeFileSync(file,phaseScript((bare?"$ErrorActionPreference='Stop';Write-FixturePhase 'BODY_ENTER';":recovery?source.replace('Register-Business5244OwnedRetirement $lease $native $pins;','Register-Business5244OwnedRetirement $lease $native $pins -ScopeName TEST125-API-B6-ca620bac-20261028;'):source)+body,tracePath));let output;try{output=cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',timeout:25000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}});}catch(error){const diagnostic=reportPhases(tracePath,started,'failed',error,undefined,bare);const failure=new Error('ISOLATED_HARNESS_FAILED '+JSON.stringify(diagnostic));failure.code=diagnostic.code;failure.status=diagnostic.status;failure.signal=diagnostic.signal;throw failure;}reportPhases(tracePath,started,'returned',null,output,bare);return phaseOutput(output).output.trim();}finally{console.error('ISOLATED_HARNESS_NODE_PHASE '+JSON.stringify({harness:fixtureHarness,phase:'CLEANUP_ENTER',elapsedMs:Number((process.hrtime.bigint()-started)/1000000n)}));const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('erp-5244-dispatch-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true,force:true});console.error('ISOLATED_HARNESS_NODE_PHASE '+JSON.stringify({harness:fixtureHarness,phase:'CLEANUP_EXIT',elapsedMs:Number((process.hrtime.bigint()-started)/1000000n)}));}}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
win('fixed plan completes once and repeated authenticated request does not stop, spawn or publish twice',()=>{
 assert.equal(run(String.raw`try{$result=Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request;if($result.mode -cne 'Candidate' -or $result.replayed -or $script:r.phase -cne 'Running' -or !$script:r.native.ChildAlive()){throw 'CANDIDATE_NOT_RESUMED'};$saved=$script:counts.Clone();$again=Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request;foreach($key in $saved.Keys){if($script:counts[$key] -ne $saved[$key]){throw 'REPLAY_EFFECT'}};if(!$again.replayed -or $again.childPid -ne $result.childPid -or $again.childBirth -cne $result.childBirth){throw 'REPLAY_IDENTITY'};Assert-Business5244StartupLease -Lease $lease -Kind Owner}`+cleanup),'PASS');
});
for(const scenario of ['StartFail','ChildDeath','CommitFail'])win(`${scenario} uses a fresh rollback child and preserves the same owner gate`,()=>{
 assert.equal(run(`$script:scenario='${scenario}';`+String.raw`try{$result=Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request;if($result.mode -cne 'Rollback' -or $script:counts.reset -ne 1 -or $script:r.native.ChildPid -eq $native.ChildPid -or !$script:r.native.ChildAlive()){throw 'ROLLBACK_NOT_NEW_CHILD'};$saved=$script:counts.Clone();$again=Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request;foreach($key in $saved.Keys){if($script:counts[$key] -ne $saved[$key]){throw 'ROLLBACK_REPLAY_EFFECT'}};if(!$again.replayed){throw 'ROLLBACK_REPLAY_NOT_STABLE'};Assert-Business5244StartupLease -Lease $lease -Kind Owner}`+cleanup),'PASS');
});
win('commit acknowledgment loss reconciles only an archived exact child/plan without rollback',()=>{
 assert.equal(run(String.raw`$script:scenario='CommitAckLoss';try{$result=Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request;if($result.mode -cne 'Candidate' -or !$result.replayed -or $script:counts.reset -ne 0 -or $script:counts.spawn -ne 1 -or $script:counts.publish -ne 1 -or $script:counts.complete -ne 1){throw 'COMMIT_ACK_REPLAYED_EFFECT'}}`+cleanup),'PASS');
});
for(const scenario of ['UnknownPublish','StartUnknown'])win(`${scenario} retains maintenance exclusion and never forces an uncertain rollback`,()=>{
 assert.equal(run(`$script:scenario='${scenario}';`+String.raw`try{$denied=$false;try{Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request|Out-Null}catch{if($_.Exception.Message -ceq 'BUSINESS_5244_MAINTENANCE_RECOVERY_REQUIRED'){$denied=$true}else{throw}};if(!$denied -or $script:counts.reset -ne 0 -or $script:counts.spawn -ne 1 -or $script:r.dispatch.phase -cne 'Blocked'){throw 'UNKNOWN_FORCED_ROLLBACK'};Assert-Business5244StartupLease -Lease $lease -Kind Maintenance;$saved=$script:counts.Clone();try{Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request|Out-Null}catch{};foreach($key in $saved.Keys){if($script:counts[$key] -ne $saved[$key]){throw 'UNKNOWN_REPLAY_EFFECT'}}}`+cleanup),'PASS');
});
win('preflight failure leaves the original child alive and creates no retirement or replacement effect',()=>{
 assert.equal(run(String.raw`$script:scenario='PreflightFail';try{$denied=$false;try{Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request|Out-Null}catch{if($_.Exception.Message -ceq 'ISOLATED_PREFLIGHT_FAILURE'){$denied=$true}else{throw}};if(!$denied -or !$native.ChildAlive() -or $script:counts.retire -ne 0 -or $script:counts.spawn -ne 0 -or $script:counts.publish -ne 0){throw 'PREFLIGHT_CHANGED_RUNTIME'};Assert-Business5244StartupLease -Lease $lease -Kind Owner}`+cleanup),'PASS');
});
win('rollback start failure remains Unknown with the same maintenance gate and no automatic second attempt',()=>{
 assert.equal(run(String.raw`$script:scenario='RollbackStartFail';try{$denied=$false;try{Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request|Out-Null}catch{if($_.Exception.Message -ceq 'BUSINESS_5244_MAINTENANCE_ROLLBACK_UNCONFIRMED'){$denied=$true}else{throw}};if(!$denied -or $script:r.phase -cne 'Unknown' -or $script:r.dispatch.phase -cne 'Blocked' -or $script:counts.spawn -ne 2 -or $script:counts.reset -ne 1 -or $script:counts.publish -ne 0){throw 'ROLLBACK_FAILURE_NOT_CLOSED'};Assert-Business5244StartupLease -Lease $lease -Kind Maintenance;$saved=$script:counts.Clone();try{Invoke-Business5244OwnerMaintenance -State $state -Channel $channel -Request $script:request|Out-Null}catch{};foreach($key in $saved.Keys){if($script:counts[$key] -ne $saved[$key]){throw 'FAILED_ROLLBACK_REPLAY'}}}`+cleanup),'PASS');
});

const recoverySetup=String.raw`
$resetBody=(Get-Command Reset-Business5244FailedCandidate).Definition.Replace("$"+"r.commit=@{phase='None'}","$"+'r.commit=$null');. ([scriptblock]::Create('function Reset-Business5244FailedCandidate {'+$resetBody+'}'))
$script:apiToken=[pscustomobject]@{fixture='private-transition'};$script:nativeToken=[pscustomobject]@{fixture='private-native'};$script:fixtureChannel=$channel;$script:apiCalls=[Collections.Generic.List[string]]::new();$script:nativeWriterCalls=0;$script:beforeReads=0;$script:beforeFailure=$false
$script:nativeRecord=[pscustomobject]@{phase='Restored';inputHash=('b'*64)};$script:apiContext=[pscustomobject]@{mode='Current';phase='VERIFIED';nativeProfileAdmission=$script:nativeToken;nativeApplied=$false;nativeChangeAttempted=$true;changed=$false;apiChanged=$false;taskStopped=$false;activeBinding=$null}
$lr=Get-Business5244StartupRecord $lease;$lr.ownedNatives=[Collections.Generic.List[object]]::new();$lr.ownedNatives.Add($native)
function New-TestNative{Write-FixturePhase 'SPAWN_ENTER';$n=[Business5244WebNative]::new();(Get-Business5244StartupRecord $lease).ownedNatives.Add($n);$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$scriptFile+'"'),$env:TEMP);Write-FixturePhase 'SPAWN_RETURNED';return $n}
function Assert-Business5244RetirementRequest($Channel,$Request){if(![object]::ReferenceEquals($Channel,$script:fixtureChannel)-or![object]::ReferenceEquals($Request,$script:request)){throw 'ISOLATED_FOREIGN_REQUEST'}}
function Get-Business5244RetirementRequestAdmission($Channel,$Request){Assert-Business5244RetirementRequest $Channel $Request;return @{bodyHash=('a'*64);requestId=$Request.requestId}}
function Invoke-Business5244OwnedRetirement($State,$Channel,$Request){Assert-Business5244RetirementRequest $Channel $Request;$script:r.requestProof=@{channel=$Channel;request=$Request};$script:counts.retire++;Invoke-Business5244HeldRetirement $State $script:records $script:pending}
function Assert-Test125ReadPairIssued($Transition){if(![object]::ReferenceEquals($Transition,$script:apiToken)){throw 'ISOLATED_FOREIGN_TRANSITION'};[void](Assert-ErpBusinessSaleNativeProfileAdmission $script:nativeToken Identity);return $script:apiContext}
function Assert-Test125ReadPairTransition($Transition,$Mode){$c=Assert-Test125ReadPairIssued $Transition;if($Mode-cne'Current'-or$c.mode-cne'Current'-or$c.phase-cne'VERIFIED'){throw 'ISOLATED_API_NOT_VERIFIED'};[void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission Restored)}
function Invoke-Test125ReadPairApiTransition($Transition,$Mode){if(![object]::ReferenceEquals($Transition,$script:apiToken)){throw 'ISOLATED_FOREIGN_TRANSITION'};$script:apiCalls.Add($Mode);if($Mode-ceq'Candidate'){throw 'ISOLATED_NATIVE_REHEARSE_FAILURE'};if($Mode-cne'Rollback'){throw 'ISOLATED_WRONG_API_MODE'}}
function Get-ErpBusinessSaleNativeAdmissionContext($Admission){if(![object]::ReferenceEquals($Admission,$script:nativeToken)){throw 'ISOLATED_FOREIGN_NATIVE'};return $script:nativeRecord}
function Assert-ErpBusinessSaleNativeProfileAdmission($Admission,$Phase){$n=Get-ErpBusinessSaleNativeAdmissionContext $Admission;if($n.phase-ceq'Unknown'){throw 'B6_NATIVE_OUTCOME_UNKNOWN'};if($Phase-cne'Identity'-and$n.phase-cne$Phase){throw 'ISOLATED_NATIVE_PHASE_CHANGED'}}
function Get-ErpBusinessSaleNativeInputs{return @{artifactHash=('b'*64)}}
function Test-ErpBusinessSaleBefore($Inputs){$script:beforeReads++;if($script:beforeFailure){throw 'ISOLATED_NATIVE_BEFORE_DRIFT'};if($Inputs.artifactHash-cne$script:nativeRecord.inputHash){throw 'ISOLATED_NATIVE_INPUT_DRIFT'}}
function Invoke-ErpBusinessSaleNativeRevision{$script:nativeWriterCalls++;throw 'UNEXPECTED_NATIVE_REPLAY'}
$sealFile=Join-Path $env:TEMP 'package-seal.txt';[IO.File]::WriteAllText($sealFile,'immutable-disposable-package');$script:recoverySeal=[Business5244PackageSeal]::new();$recoverySeal.Add($sealFile,(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($sealFile))));$recoverySeal.Freeze()
function Assert-Business5244PreparedPair($State,$ApiTransition,$PlanHash){[void](Assert-Test125ReadPairIssued $ApiTransition);if($PlanHash-cne('a'*64)){throw 'ISOLATED_PLAN_CHANGED'};$script:recoverySeal.Validate()}
function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
function Get-NetTCPConnection($LocalPort,$State){if($LocalPort-ne5244-or$State-cne'Listen'){throw 'ISOLATED_NETWORK_FORBIDDEN'};return @()}
function Set-RecoveryRequest{$script:request=[pscustomobject]@{operation='recover';requestId=[guid]::NewGuid().ToString('N')}}
function Set-BlockedRollbackFixture{
 $script:scenario='RollbackStartFail';$caught='';try{Invoke-Business5244OwnerMaintenance $state $channel $script:request $script:apiToken|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'BUSINESS_5244_MAINTENANCE_ROLLBACK_UNCONFIRMED'-or$script:r.phase-cne'Unknown'-or!$script:r.dispatch.rollbackFailureWitness){throw 'RECOVERY_KNOWN_FAILURE_NOT_CAPTURED'}
 $script:scenario='Success';Set-RecoveryRequest
}
function Set-PublishedRollbackFixture{
 $script:r.phase='Retired';$script:r.dispatch.stage='RollbackPublishing';$script:r.dispatch.rollbackNative=New-TestNative
 Publish-Business5244RetiredRecord $state $script:r.dispatch.rollbackNative Rollback $pins
 Save-Business5244RollbackFailureWitness $state;$script:r.phase='Unknown';$script:r.dispatch.phase='Blocked'
 if(!$script:r.dispatch.rollbackFailureWitness){throw 'RECOVERY_PUBLISHED_PROOF_MISSING'}
}
`;
win('sealed rehearsal-only transition publishes Current without Candidate and an authenticated replay has no effect',()=>{
 assert.equal(recoverRun(String.raw`try{
 $script:apiToken|Add-Member rehearsalOnly $true;$script:apiContext|Add-Member rehearsalOnly $true
 function Invoke-Test125ReadPairApiTransition($Transition,$Mode){[void](Assert-Test125ReadPairIssued $Transition);$script:apiCalls.Add($Mode);if($Mode-cne'RehearseOnly'){throw 'ISOLATED_APPLY_OR_ROLLBACK_UNEXPECTED'}}
 $result=Invoke-Business5244OwnerMaintenance $state $channel $script:request $script:apiToken
 if($result.mode-cne'Rollback'-or$script:apiCalls.Count-ne1-or$script:apiCalls[0]-cne'RehearseOnly'-or$script:counts.reset-ne0-or$script:counts.spawn-ne1-or$script:r.dispatch.candidateNative-or!$script:r.native.ChildAlive()){throw 'REHEARSAL_NOT_CURRENT_ONLY'}
 $saved=$script:counts.Clone();$again=Invoke-Business5244OwnerMaintenance $state $channel $script:request $script:apiToken
 if(!$again.replayed-or$script:apiCalls.Count-ne1){throw 'REHEARSAL_REQUEST_REPLAYED'};foreach($key in $saved.Keys){if($script:counts[$key]-ne$saved[$key]){throw 'REHEARSAL_REPLAY_EFFECT'}}
 `),'PASS');
});
win('failed rehearsal-only transition uses the existing Current rollback without Candidate or a second rehearsal',()=>{
 assert.equal(recoverRun(String.raw`try{
 $script:apiToken|Add-Member rehearsalOnly $true;$script:apiContext|Add-Member rehearsalOnly $true
 function Invoke-Test125ReadPairApiTransition($Transition,$Mode){[void](Assert-Test125ReadPairIssued $Transition);$script:apiCalls.Add($Mode);if($Mode-ceq'RehearseOnly'){throw 'ISOLATED_NATIVE_REHEARSE_FAILURE'};if($Mode-cne'Rollback'){throw 'ISOLATED_APPLY_UNEXPECTED'}}
 $result=Invoke-Business5244OwnerMaintenance $state $channel $script:request $script:apiToken
 if($result.mode-cne'Rollback'-or($script:apiCalls-join'|')-cne'RehearseOnly|Rollback'-or$script:counts.reset-ne1-or$script:nativeWriterCalls-or$script:beforeReads-ne0-or!$script:r.native.ChildAlive()){throw ('FAILED_REHEARSAL_REPLAYED_NATIVE:'+($script:apiCalls-join'|')+':reset='+$script:counts.reset+':writes='+$script:nativeWriterCalls+':before='+$script:beforeReads)}
 `),'PASS');
});
win('rehearsal Current commit acknowledgment loss reads back the same archive without a second rollback or rehearsal',()=>{
 assert.equal(recoverRun(String.raw`try{
 $script:apiToken|Add-Member rehearsalOnly $true;$script:apiContext|Add-Member rehearsalOnly $true
 function Invoke-Test125ReadPairApiTransition($Transition,$Mode){[void](Assert-Test125ReadPairIssued $Transition);$script:apiCalls.Add($Mode);if($Mode-cne'RehearseOnly'){throw 'ISOLATED_SECOND_NATIVE_ATTEMPT'}}
 $script:completeOriginal=(Get-Command Complete-Business5244OwnedMaintenance).ScriptBlock
 function Complete-Business5244OwnedMaintenance{param($State,$ReplacementNative,$Pins,$Mode,$PlanHash);& $script:completeOriginal $State $ReplacementNative $Pins $Mode $PlanHash;throw 'ISOLATED_CURRENT_COMMIT_ACK_LOSS'}
 $result=Invoke-Business5244OwnerMaintenance $state $channel $script:request $script:apiToken
 if($result.mode-cne'Rollback'-or!$result.replayed-or$script:apiCalls.Count-ne1-or$script:counts.spawn-ne1-or$script:counts.reset-ne0-or$script:counts.complete-ne1-or$script:r.phase-cne'Running'){throw 'CURRENT_ACK_LOSS_REPLAYED_EFFECT'}
 `),'PASS');
});
// Keep cleanup scoped to the actual native creation objects and disposable
// Local mutex/held streams above. It never queries or stops installed PIDs.
function recoverRun(body){return run(recoverySetup+body+'}'+cleanup.replace('finally{','finally{$script:recoverySeal.Dispose();foreach($owned in (Get-Business5244StartupRecord $lease).ownedNatives){$owned.Dispose()};'),{recovery:true});}
win('same-owner recover resumes one known failed rollback with a new pinned child and fresh request, then replays without any second effect',()=>{
 assert.equal(recoverRun(String.raw`try{
 Set-BlockedRollbackFixture;$before=$counts.Clone();$result=Resume-Business5244BlockedRollback $state $channel $script:request $script:apiToken
 if($result.mode-cne'Rollback'-or$result.replayed-or$counts.retire-ne1-or$counts.spawn-ne($before.spawn+1)-or$counts.reset-ne$before.reset-or$apiCalls.Count-ne2-or$nativeWriterCalls-or$beforeReads-ne1-or!$r.native.ChildAlive()){throw 'RECOVERY_REPLAYED_TRADE_OR_RETIREMENT'}
 $saved=$counts.Clone();Set-RecoveryRequest;$again=Resume-Business5244BlockedRollback $state $channel $script:request $script:apiToken
 if(!$again.replayed-or$again.childPid-ne$result.childPid-or$apiCalls.Count-ne2-or$beforeReads-ne1){throw 'RECOVERY_COMPLETED_REPLAY_DRIFT'};foreach($k in $saved.Keys){if($saved[$k]-ne$counts[$k]){throw 'RECOVERY_SECOND_EFFECT'}}
 `),'PASS');
});
win('same-owner recover keeps a genuine existing rollback child and publishes idempotently without another spawn',()=>{
 assert.equal(recoverRun(String.raw`try{
 Set-BlockedRollbackFixture;Set-PublishedRollbackFixture;$child=$r.dispatch.rollbackNative;$spawn=$counts.spawn;$publish=$counts.publish
 $result=Resume-Business5244BlockedRollback $state $channel $script:request $script:apiToken
 if($result.mode-cne'Rollback'-or$counts.spawn-ne$spawn-or$counts.publish-ne($publish+1)-or![object]::ReferenceEquals($r.native,$child)-or$counts.retire-ne1-or$apiCalls.Count-ne2-or$nativeWriterCalls){throw 'RECOVERY_EXISTING_CHILD_REPLACED'}
 `),'PASS');
});
win('same-owner recover reconciles a lost rollback commit ACK only from the exact archived child and plan',()=>{
 assert.equal(recoverRun(String.raw`try{
 Set-BlockedRollbackFixture;$body=(Get-Command Complete-Business5244OwnedMaintenance).Definition.Replace("$"+'Mode -ceq '+"'Candidate'","$"+'Mode -ceq '+"'Rollback'");. ([scriptblock]::Create('function Complete-Business5244OwnedMaintenance {'+$body+'}'));$script:scenario='CommitAckLoss'
 $result=Resume-Business5244BlockedRollback $state $channel $script:request $script:apiToken
 if(!$result.replayed-or$result.mode-cne'Rollback'-or$counts.complete-ne1-or$counts.spawn-ne2-or$counts.retire-ne1-or$apiCalls.Count-ne2-or$nativeWriterCalls){throw 'RECOVERY_ACK_LOSS_REPLAYED_WRITES'}
 `),'PASS');
});
for(const negative of ['foreignState','foreignChannel','foreignRequest','retireReplay','foreignApi','legacyScope','nativeUnknown','nativeBefore','apiFailed','commitUnknown','commitArchived','recordCAS','pendingCAS','planDrift','witnessThread','unknownNative','sealDisposed','foreignNative','expiredRequest'])win(`recover ${negative} fails closed before stop, spawn, API, native or publication effects`,()=>{
 assert.equal(recoverRun(`try{Set-BlockedRollbackFixture;$negative='${negative}';`+String.raw`
 $s=$state;$ch=$channel;$arg=$script:request;$token=$script:apiToken;$extraNative=$null
 switch($negative){foreignState{$s=$state|ConvertTo-Json|ConvertFrom-Json}foreignChannel{$ch=[pscustomobject]@{}}foreignRequest{$arg=$script:request|ConvertTo-Json|ConvertFrom-Json}retireReplay{$script:request=$r.dispatch.retiringRequest;$arg=$script:request}foreignApi{$token=$script:apiToken|ConvertTo-Json|ConvertFrom-Json}legacyScope{$r.scopeName='TEST125-API-READ2b-20261028-41d3c213'}nativeUnknown{$script:nativeRecord.phase='Unknown'}nativeBefore{$script:beforeFailure=$true}apiFailed{$script:apiContext.phase='FAILED'}commitUnknown{$r.commit=@{phase='Unknown'}}commitArchived{$r.commit=@{phase='Archived'}}recordCAS{$r.records.Position=0;$r.records.WriteByte(0);$r.records.Flush($true)}pendingCAS{$r.pending.Position=0;$r.pending.WriteByte(0);$r.pending.Flush($true)}planDrift{$r.dispatch.planHash=('c'*64)}witnessThread{$r.dispatch.rollbackFailureWitness.thread++}unknownNative{$extraNative=New-TestNative}sealDisposed{$script:recoverySeal.Dispose()}foreignNative{$script:apiContext.nativeProfileAdmission=$script:nativeToken|ConvertTo-Json|ConvertFrom-Json}expiredRequest{$script:requestChecks=0;function Assert-Business5244RetirementRequest($Channel,$Request){if(![object]::ReferenceEquals($Channel,$script:fixtureChannel)-or![object]::ReferenceEquals($Request,$script:request)){throw 'ISOLATED_FOREIGN_REQUEST'};$script:requestChecks++;if($script:requestChecks-ge2){throw 'RETIREMENT_ADMISSION_EXPIRED'}}}}
 $saved=$counts.Clone();$apiCount=$apiCalls.Count;$denied=$false;try{Resume-Business5244BlockedRollback $s $ch $arg $token|Out-Null}catch{$denied=$true}
 if(!$denied-or$r.phase-cne'Unknown'-or$apiCalls.Count-ne$apiCount-or$nativeWriterCalls){throw ('RECOVERY_NEGATIVE_ALLOWED_'+$negative)};foreach($k in $saved.Keys){if($saved[$k]-ne$counts[$k]){throw ('RECOVERY_NEGATIVE_EFFECT_'+$negative+'_'+$k)}}
 if($extraNative){$extraNative.Dispose()}
 `),'PASS');
});

win('same-owner recover completes the retained real PendingDurable rollback commit without republishing or creating a child',()=>{
 assert.equal(recoverRun(String.raw`try{
 Set-BlockedRollbackFixture;Set-PublishedRollbackFixture
 . ([scriptblock]::Create('function Invoke-FixtureRealCommit {'+$script:realCompleteBody+'}'))
 function Complete-Business5244OwnedMaintenance{param($State,$ReplacementNative,$Pins,$Mode,$PlanHash);$script:counts.complete++;Invoke-FixtureRealCommit @PSBoundParameters}
 $script:failMove=$true;function Move-Business5244PendingArchive($Source,$Destination){if($script:failMove){$script:failMove=$false;throw 'ISOLATED_ARCHIVE_MOVE_FAILED'};[IO.File]::Move($Source,$Destination)}
 $r.phase='Published';$r.dispatch.stage='RollbackCommitting';$caught=''
 try{Complete-Business5244OwnedMaintenance -State $state -ReplacementNative $r.dispatch.rollbackNative -Pins $pins -Mode Rollback -PlanHash $r.dispatch.planHash}catch{$caught=$_.Exception.Message}
 if($caught-cne'ISOLATED_ARCHIVE_MOVE_FAILED'-or$r.phase-cne'Committing'-or$r.commit.phase-cne'PendingDurable'-or!$r.pending.CanWrite){throw 'REAL_PENDING_DURABLE_NOT_RETAINED'}
 Save-Business5244RollbackFailureWitness $state;$r.phase='Unknown';$r.dispatch.phase='Blocked';$saved=$counts.Clone();$child=$r.dispatch.rollbackNative
 $result=Resume-Business5244BlockedRollback $state $channel $script:request $script:apiToken
 if($result.mode-cne'Rollback'-or$counts.publish-ne$saved.publish-or$counts.spawn-ne$saved.spawn-or$counts.complete-ne($saved.complete+1)-or$r.commit.phase-cne'Archived'-or$r.records-or$r.pending-or![object]::ReferenceEquals($r.native,$child)-or$apiCalls.Count-ne2-or$nativeWriterCalls){throw 'PENDING_DURABLE_REPLAYED_PUBLICATION_OR_NATIVE'}
 `),'PASS');
});

const managedStopFixture=String.raw`
$shared=[Collections.Concurrent.ConcurrentDictionary[string,object]]::new();$shared['fixturePhaseClock']=$script:fixturePhaseClock;$shared['fixturePhasePath']=$script:fixturePhasePath+'.inner';Write-FixturePhase 'RUNSPACE_CREATE_ENTER';$rs=[runspacefactory]::CreateRunspace();Write-FixturePhase 'RUNSPACE_CREATED';Write-FixturePhase 'RUNSPACE_OPEN_ENTER';$rs.Open();Write-FixturePhase 'RUNSPACE_OPEN_RETURNED';Write-FixturePhase 'PIPELINE_CREATE_ENTER';$pipeline=[powershell]::Create();Write-FixturePhase 'PIPELINE_CREATED';$pipeline.Runspace=$rs
$inner=@'
param($Shared,$TempRoot,$SourceRoot,$FailApiCleanup)
$script:fixturePhaseClock=$Shared['fixturePhaseClock'];$script:fixturePhasePath=$Shared['fixturePhasePath'];$script:fixtureSequence=0;$script:fixtureTraceLabel='INNER';__INNER_PHASE_WRITER__;Write-FixturePhase 'INNER_SCRIPT_ENTER';
$ErrorActionPreference='Stop';Write-FixturePhase 'UTILITY_IMPORT_ENTER';Microsoft.PowerShell.Core\Import-Module -Name ($PSHOME+'\Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop;Write-FixturePhase 'UTILITY_IMPORT_RETURNED';Write-FixturePhase 'INNER_LIBRARY_ENTER';. (Join-Path $SourceRoot 'start-business-5244-owned.ps1') -Library;Write-FixturePhase 'INNER_LIBRARY_RETURNED'
function Get-Business5244StartupMutexName{return ('Local\MelisaManagedStop-'+[IO.Path]::GetFileName($TempRoot))}
function Get-Business5244RetirementPendingPath{return (Join-Path $TempRoot 'managed.pending')}
$script:Shared=$Shared;$script:TempRoot=$TempRoot;$script:FailApiCleanup=$FailApiCleanup;$script:fixtureApi=[pscustomobject]@{fixture='same-current-api'};$script:fixtureNativeCap=[pscustomobject]@{fixture='same-native-restored'};$script:fixtureProof=[pscustomobject]@{fixture='same-owner-proof'}
$Shared['mutexName']=Get-Business5244StartupMutexName;$Shared['pendingPath']=Get-Business5244RetirementPendingPath;$Shared['recordPath']=Join-Path $TempRoot 'managed-records.json';$Shared['leaseReleased']=$false;$Shared['stateClosed']=$false;$Shared['apiClosed']=$false;$Shared['loopEntered']=$false
function New-FixtureManagedChild($Lease){Write-FixturePhase 'NATIVE_INIT_ENTER';Initialize-Business5244WebNative;Write-FixturePhase 'NATIVE_INIT_RETURNED';Write-FixturePhase 'SPAWN_ENTER';$n=[Business5244WebNative]::new();$lr=Get-Business5244StartupRecord $Lease;if(!$lr.ContainsKey('ownedNatives')){$lr.ownedNatives=[Collections.Generic.List[object]]::new()};$lr.ownedNatives.Add($n);$path=Join-Path $TempRoot 'managed-sleep.ps1';[IO.File]::WriteAllText($path,'Start-Sleep -Seconds 300');$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$path+'"'),$TempRoot);Write-FixturePhase 'SPAWN_RETURNED';return $n}
function New-Business5244PinnedChild($Pins,$Lease){return New-FixtureManagedChild $Lease}
function Read-ErpStartupConfig($Path){return @{fixture='not-private-config'}}
function New-ErpBusinessSaleNativeProfileAdmission($Config){return $script:fixtureNativeCap}
function New-Test125ReadPairTransition($ScopeName,$NativeProfileAdmission){if(![object]::ReferenceEquals($NativeProfileAdmission,$script:fixtureNativeCap)){throw 'ISOLATED_NATIVE_REFERENCE'};return $script:fixtureApi}
function Prepare-Business5244PairedMaintenance($State,$ApiTransition){if(![object]::ReferenceEquals($ApiTransition,$script:fixtureApi)){throw 'ISOLATED_API_REFERENCE'}}
function Open-Business5244RetirementChannel($OwnerLease){return [pscustomobject]@{fixture='own-disposable-channel'}}
function Close-Business5244RetirementChannel($Channel){if($Channel.fixture-cne'own-disposable-channel'){throw 'ISOLATED_FOREIGN_CHANNEL'};$Shared['channelClosed']=$true}
function Close-Test125ReadPairRequestAdmission($Transition){if(![object]::ReferenceEquals($Transition,$script:fixtureApi)){throw 'ISOLATED_API_REFERENCE'};if($script:FailApiCleanup){throw 'ISOLATED_API_CLEANUP_REJECTED'};$Shared['requestAdmissionClosed']=$true}
function Assert-Test125ReadPairIssued($Transition){if(![object]::ReferenceEquals($Transition,$script:fixtureApi)){throw 'ISOLATED_API_REFERENCE'};return @{mode='Current';phase='VERIFIED';releaseProof=$script:fixtureProof}}
function Close-ErpReadPairReleaseProof($Proof){if(![object]::ReferenceEquals($Proof,$script:fixtureProof)){throw 'ISOLATED_PROOF_REFERENCE'};$Shared['apiClosed']=$true}
$realClose=(Get-Command Close-Business5244RetirementState).Definition;. ([scriptblock]::Create('function Invoke-FixtureRealStateClose {'+$realClose+'}'))
function Close-Business5244RetirementState($State){Invoke-FixtureRealStateClose $State;$r=Get-Business5244RetirementState $State;if($r.records-or$r.pending){throw 'ISOLATED_STATE_HANDLES_OPEN'};$Shared['stateClosed']=$true}
$realExit=(Get-Command Exit-Business5244StartupLease).Definition;. ([scriptblock]::Create('function Invoke-FixtureRealLeaseExit {'+$realExit+'}'))
function Exit-Business5244StartupLease($Lease){Invoke-FixtureRealLeaseExit $Lease;$Shared['leaseReleased']=$true}
function Receive-Business5244RetirementRequest($Channel){
 if(!$Shared['loopEntered']){
  if($script:Business5244Retirements.Count-ne1){throw 'ISOLATED_STATE_NOT_UNIQUE'};$r=$script:Business5244Retirements[0];$state=$r.token
  $rows=@([pscustomobject]@{port=4194;pid=111;entry='preserve-api';root='preserve-api'},[pscustomobject]@{port=4196;pid=112;entry='preserve-native';root='preserve-native'},[pscustomobject]@{port=5244;pid=$r.childPid;entry='vite-preview';sourceCommit=$r.pins.frontendSource;root=$r.pins.root;backendPort=4144;businessWorkfaceId=$r.pins.profile});[IO.File]::WriteAllText($Shared['recordPath'],(ConvertTo-Json -InputObject $rows -Depth 8))
  $records=[IO.File]::Open($Shared['recordPath'],[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$pending=[IO.File]::Open($Shared['pendingPath'],[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  Invoke-Business5244HeldRetirement $state $records $pending
  $rollback=New-FixtureManagedChild $r.lease;$child=[Diagnostics.Process]::GetProcessById($rollback.ChildPid);[void]$child.Handle;$Shared['child']=$child;$Shared['childBirth']=$rollback.ChildBirth
  $r.dispatch=@{candidateNative=$null;rollbackNative=$rollback};$r.phase='Unknown';$Shared['loopEntered']=$true
 }
 return $null
}
# Only the external API-provider import is replaced. The production supervisor
# and finally, native Job children, held streams and lease execute unchanged.
$body=(Get-Command Start-Business5244OwnedSupervisor).Definition.Replace((". (Join-Path "+[char]36+"PSScriptRoot 'test125-bound-api-quiescence.ps1')"),'[void]0');. ([scriptblock]::Create('function Start-Business5244OwnedSupervisor {'+$body+'}'))
try{Write-FixturePhase 'INNER_SUPERVISOR_ENTER';Start-Business5244OwnedSupervisor -ScopeName 'TEST125-API-B6-ca620bac-20261028' -InitialSlot Current -PrepareReadPair|Out-Null;Write-FixturePhase 'INNER_SUPERVISOR_RETURNED'}catch{$code=[string]$_.Exception.Message;$Shared['safeFailure']=if($code-cmatch'^[A-Z][A-Z0-9_]{1,100}$'){$code}else{$_.Exception.GetType().Name};throw}finally{Write-FixturePhase 'INNER_FINALLY_ENTER';$Shared['innerReturned']=$true}
__INNER_END__
Write-FixturePhase 'ADD_SCRIPT_ENTER';[void]$pipeline.AddScript($inner).AddArgument($shared).AddArgument($env:TEMP).AddArgument('__SOURCE_ROOT__').AddArgument(__FAIL_API__);Write-FixturePhase 'ADD_SCRIPT_RETURNED';
Write-FixturePhase 'BEGIN_INVOKE_ENTER';$async=$pipeline.BeginInvoke();$maintenance=$null;$oldMutexHandle=$null
try{
 $deadline=[datetime]::UtcNow.AddSeconds(12);Write-FixturePhase 'BEGIN_INVOKE_RETURNED';do{if($shared.ContainsKey('loopEntered')-and$shared['loopEntered']){break};if($async.IsCompleted){$ids=@($pipeline.Streams.Error|ForEach-Object{$_.FullyQualifiedErrorId});throw ('ISOLATED_MANAGED_OWNER_EARLY_EXIT '+$shared['safeFailure']+' '+($ids-join'|'))};Start-Sleep -Milliseconds 20}while([datetime]::UtcNow-lt$deadline)
 if(!$shared['loopEntered']){throw 'ISOLATED_MANAGED_OWNER_NOT_READY'};Write-FixturePhase 'OWNER_READY_OBSERVED'
 $denied=$false;try{$foreign=[IO.File]::Open($shared['recordPath'],[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$foreign.Dispose()}catch{$denied=$true};if(!$denied){throw 'ISOLATED_UNKNOWN_RECORD_NOT_HELD'}
 if($shared['child'].HasExited){throw 'ISOLATED_ROLLBACK_CHILD_NOT_ALIVE_BEFORE_STOP'}
 $oldMutexHandle=[Threading.Mutex]::OpenExisting($shared['mutexName']);$acquired=$oldMutexHandle.WaitOne(0);if($acquired){$oldMutexHandle.ReleaseMutex();throw 'ISOLATED_OLD_MUTEX_NOT_HELD_BEFORE_STOP'}
 # Cooperative pipeline stop, not process termination or a production attach.
 Write-FixturePhase 'PIPELINE_STOP_ENTER';$pipeline.Stop();Write-FixturePhase 'PIPELINE_STOP_RETURNED';Write-FixturePhase 'END_INVOKE_ENTER';try{[void]$pipeline.EndInvoke($async)}catch{if($_.Exception.GetType().Name-cnotin@('MethodInvocationException','PipelineStoppedException')){throw}}
 Write-FixturePhase 'END_INVOKE_RETURNED';if(!$async.IsCompleted-or!$shared['innerReturned']-or!$shared['stateClosed']-or!$shared['child'].WaitForExit(1500)-or!(Test-Path -LiteralPath $shared['pendingPath'])){throw 'MANAGED_STOP_RESOURCE_CLEANUP_UNPROVEN'}
 $reader=[IO.File]::Open($shared['recordPath'],[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$reader.Dispose()
 . '__STARTUP__' -Library
 function Get-Business5244StartupMutexName{return $shared['mutexName']};function Get-Business5244RetirementPendingPath{return $shared['pendingPath']}
 __VERIFY__
}finally{if($maintenance){Exit-Business5244StartupLease $maintenance};if(!$async.IsCompleted){$pipeline.Stop()};$pipeline.Dispose();$rs.Dispose();if($oldMutexHandle){$oldMutexHandle.Dispose()};if($shared.ContainsKey('child')){$shared['child'].Dispose()}}
'PASS'
`.replace('__INNER_END__',"'@").replace('__INNER_PHASE_WRITER__',fixturePhaseWriter).replace('__SOURCE_ROOT__',dir.replaceAll("'","''")).replace('__STARTUP__',path.join(dir,'business-5244-startup-exclusion.ps1').replaceAll("'","''"));
win('cooperative PowerShell pipeline Stop executes the original Unknown-owner finally, closes owned children and handles, and releases a non-abandoned mutex while retaining pending',()=>{
 const body=managedStopFixture.replace('__FAIL_API__','$false').replace('__VERIFY__',String.raw`
 if(!$shared['leaseReleased']-or!$shared['apiClosed']-or!$shared['channelClosed']){throw 'MANAGED_STOP_CLEANUP_OR_RELEASE_INCOMPLETE'}
 $maintenance=Enter-Business5244StartupLease -Kind Maintenance;Assert-Business5244StartupLease $maintenance -Kind Maintenance;Exit-Business5244StartupLease $maintenance;$maintenance=$null
 $denied=$false;try{$owner=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $owner}catch{if($_.Exception.Message-cne'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'MANAGED_STOP_PENDING_DID_NOT_BLOCK_START'}
 `);
 assert.equal(run(body,{bare:true}),'PASS');
});
win('cooperative pipeline Stop cannot claim a released clean owner when API admission cleanup fails; the durable pending remains',()=>{
 const body=managedStopFixture.replace('__FAIL_API__','$true').replace('__VERIFY__',String.raw`
 if($shared['leaseReleased']-or$shared['apiClosed']){throw 'FAILED_API_CLEANUP_RELEASED_LEASE'}
 $denied=$false;try{$maintenance=Enter-Business5244StartupLease -Kind Maintenance}catch{if($_.Exception.Message-cnotin@('BUSINESS_5244_STARTUP_BUSY','BUSINESS_5244_ABANDONED_OWNER')){throw};$denied=$true}
 if(!$denied){throw 'FAILED_API_CLEANUP_CLAIMED_SAFE_MAINTENANCE'}
 `);
 assert.equal(run(body,{bare:true}),'PASS');
});
