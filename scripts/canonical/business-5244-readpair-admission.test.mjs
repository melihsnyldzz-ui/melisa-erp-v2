import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// Integration scope: real preparation/plan, issued native pipe references,
// dispatcher, startup mutex, Job/creation child, held record CAS and commit.
// External API transition/HTTP, production payload files and listener/CIM
// providers are explicitly mocked. Fixed record/pipe destinations alone are
// virtualized into the disposable directory; no installed runtime is opened.
const dir=import.meta.dirname,q=s=>"'"+s.replaceAll("'","''")+"'";
const root=process.env.SystemRoot??'C:\\Windows';
const ps=path.join(root,'System32/WindowsPowerShell/v1.0/powershell.exe');
const win={skip:process.platform!=='win32',timeout:130000};
async function fixture(t){
 const directory=await mkdtemp(path.join(os.tmpdir(),'erp-readpair-admission-')),children=[];
 const native=await readFile(path.join(dir,'business-5244-retirement-peer.cs'),'utf8');
 const runtime=path.join(directory,'isolated-runtime'),peer=path.join(directory,'isolated-peer.cs');
 const literal=String.raw`C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027`;
 assert(native.includes(literal));
 await writeFile(peer,native.replaceAll(literal,runtime.replaceAll('\\','\\\\')));
 const isolate=`function Initialize-Business5244RetirementPeer{if(!('Business5244RetirementPeer' -as [type])){Add-Type -LiteralPath ${q(peer)}}};function Get-Business5244StartupMutexName{return ('Global\\MelisaERP5244Startup-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value+'-'+(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(${q(runtime)}.ToLowerInvariant()))))};function Get-Business5244RetirementPendingPath{return ${q(path.join(directory,'retirement.pending'))}};`;
 t.after(async()=>{for(const p of children)if(p.exitCode===null){p.kill();await p.finished;}await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 return {directory,children,isolate};
}
async function child(f,body,name){
 const file=path.join(f.directory,name+'.ps1');await writeFile(file,`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n. ${q(path.join(dir,'start-business-5244-owned.ps1'))} -Library\n${f.isolate}\n${body}`);
 const p=spawn(ps,['-NoProfile','-NonInteractive','-File',file],{windowsHide:true,env:{SystemRoot:root,WINDIR:root,PATH:path.join(root,'System32'),TEMP:f.directory,TMP:f.directory,PSModulePath:path.join(root,'System32/WindowsPowerShell/v1.0/Modules')},stdio:['pipe','pipe','pipe']});f.children.push(p);
 let stdout='',stderr='',remainder='';const lines=[],waiters=[];
 p.stdout.on('data',b=>{stdout+=b;remainder+=b;while(remainder.includes('\n')){const at=remainder.indexOf('\n'),line=remainder.slice(0,at).replace(/\r$/,'');remainder=remainder.slice(at+1);const next=waiters.shift();if(next)next(line);else lines.push(line);}});p.stderr.on('data',b=>stderr+=b);
 p.finished=new Promise(resolve=>p.once('close',code=>resolve({code,stdout,stderr})));
 p.line=(timeout=15000)=>lines.length?Promise.resolve(lines.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('isolated readiness timeout: '+stderr)),timeout);waiters.push(line=>{clearTimeout(timer);resolve(line);});p.once('close',()=>{clearTimeout(timer);reject(Error('isolated owner exited: '+stderr));});});
 return p;
}
const setup=String.raw`
Initialize-Business5244WebNative
$script:children=[Collections.Generic.List[object]]::new();$script:apiCalls=[Collections.Generic.List[string]]::new();$script:payloadChecks=0;$script:quickCalls=0;$script:admissionDelay=0;$script:apiMode='Current'
$sleep=Join-Path $env:TEMP 'owned-child.ps1';[IO.File]::WriteAllText($sleep,'Start-Sleep -Seconds 300')
function New-IsolatedChild{$n=[Business5244WebNative]::new();$children.Add($n);$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$sleep+'"'),$env:TEMP);return $n}
# Native child identity and Job handles are real; only external observations
# of the fixture's command/listener shape are mocked (it is not Vite/HTTP).
function Assert-Business5244CreatedChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'ISOLATED_NATIVE_CHILD_DEAD'}}
function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
function Get-NetTCPConnection{param($LocalPort,$State,$ErrorAction);$p=(Get-Business5244RetirementState $script:state).childPid;foreach($a in @('100.87.188.3','127.0.0.1','192.168.1.46')){[pscustomobject]@{OwningProcess=$p;LocalPort=5244;LocalAddress=$a}}}
function Get-CimInstance{param($ClassName,$Filter);if($ClassName-cne'Win32_Process'-or$Filter-cne'ProcessId=2000'){throw 'ISOLATED_UNEXPECTED_CIM'}}
$lease=Enter-Business5244StartupLease -Kind Owner;$native=New-IsolatedChild;$pins=Get-Business5244WebPins;$script:state=Register-Business5244OwnedRetirement $lease $native $pins;$r=Get-Business5244RetirementState $state
$recordPath=Join-Path $env:TEMP 'records.json'
$rows=@([pscustomobject]@{port=4194;pid=111;entry='keep-api'},[pscustomobject]@{port=4196;pid=112;entry='keep-native'},[pscustomobject]@{port=5244;pid=2000;entry='vite-preview';sourceCommit='d875dc6e59d70230b8c931f718bac30438778ec1';root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-d4f52345';backendPort=4144;businessWorkfaceId=$pins.profile})
$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));[IO.File]::WriteAllBytes($recordPath,$before);$baseline=Get-Business5244StartupHash $before
function Get-Business5244CurrentBootstrapPins{param($BeforeHash);return @{hash=$baseline;pid=2000;root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-d4f52345';source='d875dc6e59d70230b8c931f718bac30438778ec1'}}
# Route three unchanged production function bodies' fixed file destination to
# the temp record. All their CAS/durability/retirement predicates stay intact.
foreach($name in @('Prepare-Business5244PairedMaintenance','Publish-Business5244CurrentRecord','Invoke-Business5244OwnedRetirement')){$fn=Get-Command $name -CommandType Function;$body=$fn.Definition.Replace('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json',$recordPath);if($body-ceq$fn.Definition){throw 'ISOLATED_RECORD_ROUTE_NOT_FOUND'};. ([scriptblock]::Create('function '+$name+' {'+$body+'}'))}
$script:apiToken=[pscustomobject]@{kind='MOCK_EXTERNAL_API_TRANSITION'}
function Assert-Test125ReadPairTransition{param($Transition,$Mode);if(![object]::ReferenceEquals($Transition,$apiToken)-or$apiMode-cne$Mode){throw 'MOCK_API_REFERENCE_OR_MODE'}}
function Assert-Test125ReadPairIssued{param($Transition);if(![object]::ReferenceEquals($Transition,$apiToken)){throw 'MOCK_API_UNISSUED'};return @{mode=$apiMode;phase='PREPARED';activeBinding=$null;changed=$false;apiChanged=$false;taskStopped=$false;candidateAttempted=$false}}
function Get-Test125ReadPairTransitionContract{param($Transition);Assert-Test125ReadPairTransition $Transition Current;return @{scope='TEST125-API-READ2b-20261028-41d3c213';contractSha256=('b'*64);mode='Current';phase='PREPARED'}}
function Prepare-Test125ReadPairRequestAdmission{param($Transition);Assert-Test125ReadPairTransition $Transition Current;$script:quickPrepared=$true}
function Assert-Test125ReadPairRequestAdmission{param($Transition);Assert-Test125ReadPairTransition $Transition Current;if(!$script:quickPrepared){throw 'MOCK_QUICK_NOT_PREPARED'};$script:quickCalls++;if($script:admissionDelay){Start-Sleep -Milliseconds $script:admissionDelay}}
function Invoke-Test125ReadPairApiTransition{param($Transition,$Mode);if(![object]::ReferenceEquals($Transition,$apiToken)-or!$r.native.RetirementConfirmed){throw 'MOCK_API_BEFORE_RETIREMENT'};$apiCalls.Add($Mode);$script:apiMode=if($Mode-ceq'Candidate'){'Candidate'}else{'Current'}}
$sealFile=Join-Path $env:TEMP 'payload.txt';[IO.File]::WriteAllText($sealFile,'only-disposable-payload');$sealHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($sealFile))
function Assert-Business5244OwnedPackage{param($Pins,$Seal=$null);$script:payloadChecks++;if($Seal){$Seal.Add($sealFile,$sealHash)}}
function Invoke-RestMethod{param($Uri,$TimeoutSec);if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'MOCK_UNEXPECTED_HTTP'};return @{packageId=$(if($apiMode-ceq'Current'){(Get-Business5244WebPins).apiPackage}else{(Get-Business5244ReadPairPins).apiPackage})}}
function Assert-Business5244ApiHealth($Health,$Pins){if($Health.packageId-cne$Pins.apiPackage){throw 'MOCK_API_PAIR_MISMATCH'}}
function Get-FileHash{param($LiteralPath,$Algorithm);foreach($p in @((Get-Business5244WebPins),(Get-Business5244ReadPairPins))){if($LiteralPath-ceq(Join-Path $p.root 'release-manifest.json')){return @{Hash=$p.manifest}}};Microsoft.PowerShell.Utility\Get-FileHash -LiteralPath $LiteralPath}
function New-Business5244PinnedChild{param($Pins,$Lease);Assert-Business5244StartupLease -Lease $Lease -Kind Maintenance;Assert-Business5244ApiHealth (Invoke-RestMethod 'http://127.0.0.1:4144/test-health') $Pins;return New-IsolatedChild}
$channel=$null
function Emit($value){[Console]::WriteLine(($value|ConvertTo-Json -Depth 8 -Compress));[Console]::Out.Flush()}
`;
const cleanup=String.raw`finally{if($channel){Close-Business5244RetirementChannel $channel};Close-Business5244RetirementState $state;foreach($c in $children){$c.Dispose()};Exit-Business5244StartupLease -Lease $lease}`;
const loop=String.raw`
while($true){$request=$null;try{$request=Receive-Business5244RetirementRequest $channel}catch{continue};if(!$request){Start-Sleep -Milliseconds 10;continue}
 if($request.operation-ceq'status'){$s=Get-Business5244RetirementSnapshot $state;$s.requestId=$request.requestId;Complete-Business5244RetirementRequest $channel $request Status $s|Out-Null;continue}
 $admission=Get-Business5244RetirementRequestAdmission $channel $request;$budget=60-($admission.elapsedMilliseconds/1000);if($admission.expired-or$budget-lt55-or$budget-gt60){throw 'ADMISSION_NOT_FRESH_60_SECONDS'};$requestClock=[Diagnostics.Stopwatch]::StartNew()
 if($scenario-ceq'Expiry'){Start-Sleep -Milliseconds 61000};if($scenario-ceq'Slow'){$script:admissionDelay=18000}
 $outcome='';$again='';try{$answer=Invoke-Business5244PairedOwnerMaintenance $state $channel $request $apiToken;$outcome=$answer.mode;$count=$children.Count;$again=Invoke-Business5244PairedOwnerMaintenance $state $channel $request $apiToken;if(!$again.replayed-or$children.Count-ne$count){throw 'SECOND_EFFECT'}}catch{$outcome=$_.Exception.Message}
 $script:admissionDelay=0
 if($scenario-cin@('RetiringClockFault','RetiringPendingFault')){$beforeRepeat=@($apiCalls.Count,$children.Count);$repeatRejected=$false;try{Invoke-Business5244PairedOwnerMaintenance $state $channel $request $apiToken|Out-Null}catch{$repeatRejected=$true};if(!$repeatRejected-or$apiCalls.Count-ne$beforeRepeat[0]-or$children.Count-ne$beforeRepeat[1]){throw 'EXPIRED_RETIRE_REPLAY_EFFECT'}}
 $s=Get-Business5244RetirementSnapshot $state;$s.requestId=$request.requestId;try{Complete-Business5244RetirementRequest $channel $request $(if($outcome-ceq'Candidate'){'RetireAccepted'}else{'Rejected'}) $s|Out-Null}catch{Reset-Business5244RetirementConnection (Get-Business5244RetirementRecord $channel)}
 $after=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes($recordPath));if($after[0].pid-ne111-or$after[1].pid-ne112){throw 'KEPT_RECORD_CHANGED'}
 if($scenario-ceq'Success'){if($outcome-cne'Candidate'-or!$native.RetirementConfirmed-or$apiCalls.Count-ne1-or$children.Count-ne2-or$r.commit.phase-cne'Archived'){throw 'REAL_CHAIN_NOT_COMPLETED'}}elseif($scenario-ceq'RetiringPendingFault'){if(!$native.ChildAlive()-or$apiCalls.Count-or$children.Count-ne1-or$r.phase-cne'Unknown'-or!(Test-Path(Get-Business5244RetirementPendingPath))){throw 'UNCERTAIN_PENDING_NOT_BLOCKED'}}else{if(!$native.ChildAlive()-or$apiCalls.Count-or$children.Count-ne1-or$r.phase-cne'Running'-or(Test-Path(Get-Business5244RetirementPendingPath))){throw 'UNCONFIRMED_REQUEST_EFFECT'}}
 Emit @{kind='OUTCOME';outcome=$outcome;phase=$r.phase;childPid=$r.childPid;apiEffects=$apiCalls.Count;children=$children.Count;initialRetired=$native.RetirementConfirmed;admissionBudgetSeconds=$budget;payloadChecks=$payloadChecks;coldMs=$cold.ElapsedMilliseconds;warmMs=$warm.ElapsedMilliseconds;requestMs=$requestClock.ElapsedMilliseconds;dispatchCode=$(if($r.ContainsKey('dispatch')-and$r.dispatch){$r.dispatch.failureCode}else{$null});dispatchPhase=$(if($r.ContainsKey('dispatch')-and$r.dispatch){$r.dispatch.phase}else{$null})}
 # Keep the owner alive for a new authenticated read-only status connection.
 $end=[DateTime]::UtcNow.AddSeconds(20);while([DateTime]::UtcNow-lt$end){$status=$null;try{$status=Receive-Business5244RetirementRequest $channel}catch{};if($status){if($status.operation-cne'status'){throw 'NO_RETIRE_REPLAY_AFTER_OUTCOME'};$s=Get-Business5244RetirementSnapshot $state;$s.requestId=$status.requestId;Complete-Business5244RetirementRequest $channel $status Status $s|Out-Null;for($i=0;$i-lt20;$i++){Receive-Business5244RetirementRequest $channel|Out-Null;Start-Sleep -Milliseconds 10};Emit @{kind='STATUS_DONE';apiEffects=$apiCalls.Count;children=$children.Count};[Console]::ReadLine()|Out-Null;return};Start-Sleep -Milliseconds 10};throw 'STATUS_NOT_OBSERVED'
}`;
async function exercise(t,scenario){
 const f=await fixture(t);
 const server=await child(f,setup+`$scenario='${scenario}';try{`+String.raw`
 if($script:Business5244RetirementChannels.Count){throw 'CHANNEL_EXISTS_BEFORE_PREPARATION'}
 $cold=[Diagnostics.Stopwatch]::StartNew();Prepare-Business5244PairedMaintenance $state $apiToken;$cold.Stop()
 if(!$r.currentBootstrap-or$r.currentBootstrap.phase-cne'Archived'-or$script:Business5244RetirementChannels.Count){throw 'BOOTSTRAP_NOT_PRE_NONCE'}
 $checked=$payloadChecks;$plan=Get-Business5244MaintenancePlan $state $apiToken;$warm=[Diagnostics.Stopwatch]::StartNew();Assert-Business5244MaintenancePlan $plan $state $apiToken;Assert-Business5244MaintenancePlan $plan $state $apiToken;$warm.Stop();if($payloadChecks-ne$checked){throw 'WARM_REHASHED_PAYLOAD'}
 # Controlled fault only: advance the retained issued clock exactly at the
 # real Retiring boundary. This is separate from the real 61s timeout case.
 # The negative variant also introduces an uncertain TEMP pending marker.
 if($scenario-cin@('RetiringClockFault','RetiringPendingFault')){$script:originalRetire=(Get-Command Invoke-Business5244OwnedRetirement).ScriptBlock;function Invoke-Business5244OwnedRetirement($State,$Channel,$Request){$issued=Get-Business5244RetirementRecord $Channel;$issued.request.acceptedTicks-=(61L*[Diagnostics.Stopwatch]::Frequency);$issued.request.acceptedUtc=$issued.request.acceptedUtc.AddSeconds(-61);$issued.request.admissionDeadlineUtc=$issued.request.acceptedUtc.AddSeconds(60);if($scenario-ceq'RetiringPendingFault'){[IO.File]::WriteAllBytes((Get-Business5244RetirementPendingPath),[byte[]]@(1))};& $script:originalRetire $State $Channel $Request}}
 $channel=Open-Business5244RetirementChannel $lease;Emit @{kind='READY';ownerPid=$PID;childPid=$native.ChildPid;coldMs=$cold.ElapsedMilliseconds;warmMs=$warm.ElapsedMilliseconds;bootstrapArchives=@(Get-ChildItem $env:TEMP -Filter '*.bootstrap.completed').Count}
 `+loop+'}'+cleanup,'owner');
 const ready=JSON.parse(await server.line(25000));assert.equal(ready.kind,'READY');assert.equal(ready.ownerPid,server.pid);assert.equal(ready.bootstrapArchives,1);
 // Expiry uses a canonical body on the REAL authenticated pipe while retaining
 // the peer after a 15s observation timeout. It is explicitly a raw timing
 // fixture, not a claim that the normal client keeps its pipe open that long.
 const clientBody=scenario==='Expiry'?String.raw`$r=Get-Business5244RetirementRecord $c -Client;$hello=Read-Business5244RetirementLine $r.pipe 192;$wire=[Text.Encoding]::ASCII.GetBytes(('{"operation":"retire","requestId":"'+$hello.requestId+'"}')+"`+'`n'+String.raw`");$w=$r.pipe.WriteAsync($wire,0,$wire.Length);if(!$w.Wait(5000)){throw 'ISOLATED_BODY_WRITE_TIMEOUT'};[void]$w.GetAwaiter().GetResult();$buf=[byte[]]::new(512);$ack=$r.pipe.ReadAsync($buf,0,$buf.Length);if(!$ack.Wait(15000)){[Console]::WriteLine('ACK_UNCONFIRMED');[Console]::Out.Flush()};[Console]::ReadLine()|Out-Null;Close-Business5244RetirementPeer $c`:`try{$a=Send-Business5244RetirementRequest $c retire;[Console]::WriteLine(($a|ConvertTo-Json -Depth 5 -Compress));[Console]::Out.Flush()}catch{[Console]::WriteLine('ACK_UNCONFIRMED');[Console]::Out.Flush()};[Console]::ReadLine()|Out-Null`;
 const client=await child(f,`$c=Connect-Business5244RetirementPeer;if($c.serverPid-ne${server.pid}){throw 'FOREIGN_DISPOSABLE_OWNER'};`+clientBody,'retire-client');
 const outcome=JSON.parse(await server.line(scenario==='Expiry'?80000:40000));assert.equal(outcome.kind,'OUTCOME');
 const status=await child(f,`$c=Connect-Business5244RetirementPeer;if($c.serverPid-ne${server.pid}){throw 'FOREIGN_STATUS_OWNER'};$a=Send-Business5244RetirementRequest $c status;if($a.reply-cne'Status'-or$a.stopAuthorized-or!$a.childObservationOnly-or$a.state.childPid-ne${outcome.childPid}){throw 'WRONG_STATUS_SCOPE'};'STATUS_ONLY'`,'status-client');
 const sr=await status.finished;assert.equal(sr.code,0,sr.stderr);assert.match(sr.stdout,/STATUS_ONLY/);const done=JSON.parse(await server.line());assert.equal(done.apiEffects,outcome.apiEffects);assert.equal(done.children,outcome.children);
 client.stdin.end();server.stdin.end();const cr=await client.finished,or=await server.finished;assert.equal(cr.code,0,cr.stderr);assert.equal(or.code,0,or.stderr);
 t.diagnostic(JSON.stringify({scope:'DISPOSABLE_PIPE_JOB_CHAIN_EXTERNAL_PROVIDERS_MOCKED',scenario,coldMs:outcome.coldMs,warmMs:outcome.warmMs,requestMs:outcome.requestMs,admissionBudgetSeconds:outcome.admissionBudgetSeconds,apiEffects:outcome.apiEffects,initialRetired:outcome.initialRetired}));
 return {ready,outcome,clientOutput:cr.stdout};
}
test('isolated issued-pipe paired chain prepares bootstrap before nonce, uses warm admission and retires/commits once',win,async t=>{const r=await exercise(t,'Success');assert.equal(r.outcome.outcome,'Candidate');assert.equal(r.outcome.initialRetired,true);assert.equal(r.outcome.children,2);assert.equal(r.outcome.apiEffects,1);assert(r.outcome.admissionBudgetSeconds>55);});
test('isolated slow admission loses the 15-second ACK but status has no replay or retirement effect',win,async t=>{const r=await exercise(t,'Slow');assert.match(r.clientOutput,/ACK_UNCONFIRMED/);assert.equal(r.outcome.initialRetired,false);assert.equal(r.outcome.apiEffects,0);assert.equal(r.outcome.children,1);});
test('isolated valid-body admission expires after a real 60 seconds with zero business/child effect',win,async t=>{const r=await exercise(t,'Expiry');assert.match(r.clientOutput,/ACK_UNCONFIRMED/);assert.match(r.outcome.outcome,/RETIREMENT_ADMISSION_EXPIRED/);assert.equal(r.outcome.initialRetired,false);assert.equal(r.outcome.apiEffects,0);assert.equal(r.outcome.children,1);});
test('controlled Retiring clock fault classifies zero effects once; uncertain pending stays Unknown',win,async t=>{
 const safe=await exercise(t,'RetiringClockFault');assert.equal(safe.outcome.dispatchCode,'BUSINESS_5244_PRERETIRE_EXPIRED_NO_TRANSITION_EFFECTS');assert.equal(safe.outcome.dispatchPhase,'PreflightFailed');assert.equal(safe.outcome.phase,'Running');assert.equal(safe.outcome.initialRetired,false);assert.equal(safe.outcome.apiEffects,0);
 const uncertain=await exercise(t,'RetiringPendingFault');assert.notEqual(uncertain.outcome.dispatchCode,'BUSINESS_5244_PRERETIRE_EXPIRED_NO_TRANSITION_EFFECTS');assert.equal(uncertain.outcome.dispatchPhase,'Blocked');assert.equal(uncertain.outcome.phase,'Unknown');assert.equal(uncertain.outcome.initialRetired,false);assert.equal(uncertain.outcome.apiEffects,0);
});

test('isolated 15-second pre-body timeout issues no request and retains the prepared child and record',win,async t=>{
 const f=await fixture(t);
 const server=await child(f,setup+String.raw`try{Prepare-Business5244PairedMaintenance $state $apiToken;$preparedHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordPath));$channel=Open-Business5244RetirementChannel $lease;Emit @{kind='READY';ownerPid=$PID};$tokens=0;$timedOut=$false;$watch=[Diagnostics.Stopwatch]::StartNew();$end=[DateTime]::UtcNow.AddSeconds(25);while([DateTime]::UtcNow-lt$end){try{$request=Receive-Business5244RetirementRequest $channel;if($request){$tokens++}}catch{if($_.Exception.Message-cne'RETIREMENT_REQUEST_NOT_CONFIRMED'){throw};$timedOut=$true;break};Start-Sleep -Milliseconds 10};if(!$timedOut-or$tokens-or!$native.ChildAlive()-or$apiCalls.Count-or$children.Count-ne1-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordPath)))-cne$preparedHash){throw 'INPUT_TIMEOUT_EFFECT'};Emit @{kind='INPUT_EXPIRED';tokens=$tokens;elapsedMs=$watch.ElapsedMilliseconds};[Console]::ReadLine()|Out-Null}`+cleanup,'input-owner');
 const ready=JSON.parse(await server.line(25000));
 const client=await child(f,`$c=Connect-Business5244RetirementPeer;if($c.serverPid-ne${ready.ownerPid}){throw 'FOREIGN_INPUT_OWNER'};$r=Get-Business5244RetirementRecord $c -Client;$hello=Read-Business5244RetirementLine $r.pipe 192;'HELLO_NO_BODY';[Console]::Out.Flush();[Console]::ReadLine()|Out-Null;Close-Business5244RetirementPeer $c`,'no-body-client');
 assert.equal(await client.line(),'HELLO_NO_BODY');const result=JSON.parse(await server.line(25000));assert.equal(result.kind,'INPUT_EXPIRED');assert.equal(result.tokens,0);assert(result.elapsedMs>=14000&&result.elapsedMs<25000);client.stdin.end();server.stdin.end();for(const p of [client,server]){const r=await p.finished;assert.equal(r.code,0,r.stderr);}
});
