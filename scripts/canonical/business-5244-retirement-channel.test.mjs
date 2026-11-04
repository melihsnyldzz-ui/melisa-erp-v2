import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';import {spawn} from 'node:child_process';import path from 'node:path';import os from 'node:os';
const source=path.join(import.meta.dirname,'business-5244-retirement-channel.ps1'),q=s=>`'${s.replaceAll("'","''")}'`,win={skip:process.platform!=='win32',timeout:30000};
async function fixture(t){const directory=await mkdtemp(path.join(os.tmpdir(),'erp-5244-retirement-test-')),children=[];t.after(async()=>{for(const p of children){if(p.exitCode===null){p.kill();await p.finished;}}await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});});return {directory,children};}
async function child(f,body,name){const file=path.join(f.directory,name+'.ps1');await writeFile(file,`$ErrorActionPreference='Stop'\n. ${q(source)} -Library\n${await isolatedAdmission(f)}\n${body}\n`);const root=process.env.SystemRoot??'C:\\Windows',p=spawn(path.join(root,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-File',file],{windowsHide:true,env:{SystemRoot:root,WINDIR:root,PATH:path.join(root,'System32'),TEMP:f.directory,TMP:f.directory},stdio:['pipe','pipe','pipe']});f.children.push(p);let stdout='',stderr='',remainder='';const lines=[],waiters=[];p.stdout.on('data',b=>{stdout+=b;remainder+=b;while(remainder.includes('\n')){const at=remainder.indexOf('\n'),line=remainder.slice(0,at).replace(/\r$/,'');remainder=remainder.slice(at+1);const waiter=waiters.shift();if(waiter)waiter(line);else lines.push(line);}});p.stderr.on('data',b=>stderr+=b);p.finished=new Promise(resolve=>p.once('close',code=>resolve({code,stdout,stderr})));p.line=()=>lines.length?Promise.resolve(lines.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('disposable pipe readiness timeout')),10000);waiters.push(line=>{clearTimeout(timer);resolve(line);});p.once('close',()=>{clearTimeout(timer);reject(new Error('disposable pipe exited before readiness: '+stderr));});});return p;}
const serverStart=String.raw`$lease=Enter-Business5244StartupLease -Kind Owner;$channel=$null
try{$channel=Open-Business5244RetirementChannel -OwnerLease $lease;[Console]::WriteLine('READY');[Console]::Out.Flush();`;
const serverEnd=String.raw`}finally{if($channel){Close-Business5244RetirementChannel $channel};Assert-Business5244StartupLease -Lease $lease;Exit-Business5244StartupLease -Lease $lease}`;
const snapshot=String.raw`$snapshot=@{phase='Running';ownerPid=$PID;ownerBirth=[Business5244RetirementPeer]::CurrentBirth;childPid=$null;childBirth=$null;requestId=$request.requestId}`;
const connect=pid=>`$connection=Connect-Business5244RetirementPeer;if($connection.serverPid -ne ${pid}){Close-Business5244RetirementPeer $connection;throw 'NOT_OUR_DISPOSABLE_SERVER'};`;
async function isolatedAdmission(f){
 const native=await readFile(path.join(import.meta.dirname,'business-5244-retirement-peer.cs'),'utf8'),runtime=path.join(f.directory,'admission-runtime'),cs=path.join(f.directory,'admission-peer.cs');
 await writeFile(cs,native.replaceAll(String.raw`C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027`,runtime.replaceAll('\\','\\\\')));
 return `function Initialize-Business5244RetirementPeer{if(!('Business5244RetirementPeer' -as [type])){Add-Type -LiteralPath ${q(cs)}}};function Get-Business5244StartupMutexName{return ('Global\\MelisaERP5244Startup-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value+'-'+(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(${q(runtime)}.ToLowerInvariant()))))};function Get-Business5244RetirementPendingPath{return ${q(path.join(f.directory,'admission.pending'))}};`;
}
const acceptAdmission=String.raw`$request=$null;$end=[DateTime]::UtcNow.AddSeconds(12);while(!$request-and[DateTime]::UtcNow-lt$end){$request=Receive-Business5244RetirementRequest $channel;Start-Sleep -Milliseconds 5};if(!$request){throw 'NO_DISPOSABLE_REQUEST'};$r=Get-Business5244RetirementRecord $channel;$q=$r.request;`;
test('native exit observation keeps only its own query/sync handle across a cooperative disposable server exit',win,async t=>{
 const f=await fixture(t),pipeName='erp-exit-observer-'+path.basename(f.directory);
 const server=await child(f,`Initialize-Business5244RetirementPeer;$pipe=[IO.Pipes.NamedPipeServerStream]::new('${pipeName}',[IO.Pipes.PipeDirection]::InOut);$peer=$null
try{[Console]::WriteLine('READY');[Console]::Out.Flush();$pipe.WaitForConnection();$peer=[Business5244RetirementPeer]::CaptureClient($pipe);$denied=$false;try{$peer.OpenExitObservation()|Out-Null}catch{if($_.Exception.InnerException.Message-cne'RETIREMENT_EXIT_SERVER_PEER_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'CLIENT_ROLE_OBSERVER'};[Console]::WriteLine('CLIENT_REJECTED');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null}finally{if($peer){$peer.Dispose()};$pipe.Dispose()}`,'exit-observer-server');
 assert.equal(await server.line(),'READY');
 const client=await child(f,`Initialize-Business5244RetirementPeer
Add-Type -TypeDefinition @'
using System;using System.Reflection;using System.Threading;
public static class ExitObserverThreadProbe {public static string Check(object observer,string method){string answer=null;Thread thread=new Thread(()=>{try{observer.GetType().GetMethod(method).Invoke(observer,null);answer="ACCEPTED";}catch(TargetInvocationException e){answer=e.InnerException.Message;}});thread.Start();thread.Join();return answer;}}
'@
$pipe=[IO.Pipes.NamedPipeClientStream]::new('.','${pipeName}',[IO.Pipes.PipeDirection]::InOut);$pipe.Connect(5000);$peer=[Business5244RetirementPeer]::CaptureServer($pipe);$observer=$null
try{
if($peer.Pid-ne${server.pid}){throw 'NOT_OUR_DISPOSABLE_SERVER'};if([ExitObserverThreadProbe]::Check($peer,'OpenExitObservation')-cne'RETIREMENT_EXIT_OBSERVER_CHANGED'){throw 'FOREIGN_THREAD_ISSUANCE'};$observer=$peer.OpenExitObservation();$birth=$observer.TargetBirth
if($observer.Observe()){throw 'LIVE_EXIT_OBSERVED'};$denied=$false;try{$observer.ValidateExited()}catch{if($_.Exception.InnerException.Message-cne'RETIREMENT_EXIT_NOT_OBSERVED'){throw};$denied=$true};if(!$denied){throw 'LIVE_ASSERTION_ACCEPTED'}
if([ExitObserverThreadProbe]::Check($observer,'Observe')-cne'RETIREMENT_EXIT_OBSERVER_CHANGED'){throw 'FOREIGN_THREAD_OBSERVER'}
$copy=$observer|ConvertTo-Json|ConvertFrom-Json;$denied=$false;try{$copy.ValidateExited()}catch{$denied=$true};if(!$denied-or$copy-is[Business5244RetirementPeer+ExitObservation]){throw 'JSON_OBSERVER_AUTHORITY'}
$methods=@($observer.GetType().GetMethods([Reflection.BindingFlags]'Public,Instance,DeclaredOnly')|ForEach-Object Name|Sort-Object -Unique);if(@(Compare-Object $methods @('Dispose','Observe','ValidateExited','get_TargetBirth','get_TargetPid')).Count-or$observer.GetType().GetConstructors().Length){throw 'OBSERVER_EFFECT_API'}
$discard=$peer.OpenExitObservation();$discard.Dispose();$denied=$false;try{$discard.Observe()}catch{if($_.Exception.InnerException.Message-cne'RETIREMENT_EXIT_OBSERVER_CHANGED'){throw};$denied=$true};if(!$denied){throw 'DISPOSED_OBSERVER'}
$peer.Dispose();$pipe.Dispose();$denied=$false;try{$peer.OpenExitObservation()|Out-Null}catch{$denied=$true};if(!$denied-or$observer.Observe()){throw 'DISPOSED_PEER_REISSUED'}
[Console]::WriteLine('OBSERVING');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null
if(!$observer.Observe()-or$observer.TargetPid-ne${server.pid}-or$observer.TargetBirth-cne$birth){throw 'RETAINED_HANDLE_EXIT_IDENTITY'};$observer.ValidateExited();$observer.ValidateExited()
if([ExitObserverThreadProbe]::Check($observer,'Observe')-cne'RETIREMENT_EXIT_OBSERVER_CHANGED'){throw 'EXITED_FOREIGN_THREAD_OBSERVER'}
$observer.Dispose();$denied=$false;try{$observer.ValidateExited()}catch{if($_.Exception.InnerException.Message-cne'RETIREMENT_EXIT_OBSERVER_CHANGED'){throw};$denied=$true};if(!$denied){throw 'DISPOSED_EXIT_ASSERTION'};'PASS'
}finally{if($observer){$observer.Dispose()};$peer.Dispose();$pipe.Dispose()}`,'exit-observer-client');
 assert.equal(await server.line(),'CLIENT_REJECTED');assert.equal(await client.line(),'OBSERVING');
 server.stdin.end();const sr=await server.finished;assert.equal(sr.code,0,sr.stderr);
 client.stdin.end();const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);assert.match(cr.stdout,/PASS/);
});
test('managed completion observes a cooperative disposable exit and reuses only its retained marker proof',win,async t=>{
 const f=await fixture(t);
 const server=await child(f,String.raw`Initialize-Business5244RetirementPeer;$pipe=[Business5244RetirementPipe]::CreateServer()
try{[Console]::WriteLine('READY');[Console]::Out.Flush();$pipe.WaitForConnection();[Console]::ReadLine()|Out-Null}finally{$pipe.Dispose();[Console]::WriteLine('FINALLY');[Console]::Out.Flush()}`,'managed-exit-server');
 assert.equal(await server.line(),'READY');
 const client=await child(f,`Initialize-Business5244RetirementPeer
Add-Type -TypeDefinition @'
using System;using System.Reflection;using System.Threading;
public static class ManagedExitThreadProbe {public static string Check(object control,object observation){string answer=null;var thread=new Thread(()=>{try{control.GetType().GetMethod("CompleteManagedExit").Invoke(control,new object[]{observation});answer="ACCEPTED";}catch(TargetInvocationException e){answer=e.InnerException.Message;}});thread.Start();thread.Join();return answer;}}
'@
$pipe=[Business5244RetirementPipe]::Connect();$peer=[Business5244RetirementPeer]::CaptureServer($pipe);$control=$null;$observer=$null;$marker=$null
try{
 if($peer.Pid-ne${server.pid}){throw 'NOT_OUR_DISPOSABLE_SERVER'}
 $control=$peer.OpenControlledShutdown();$observer=$peer.OpenExitObservation();$discard=$peer.OpenControlledShutdown();$discard.Dispose();$disposedObserver=$peer.OpenExitObservation();$disposedObserver.Dispose()
 $birth=$control.TargetBirth;$directory=${q(path.join(f.directory,'admission-runtime'))};[void][IO.Directory]::CreateDirectory($directory)
 $marker=$control.CreateMaintenanceMarker([Text.Encoding]::UTF8.GetBytes('isolated-managed-exit-fixture'));$marker.Validate()
 $denied=$false;try{$control.CompleteManagedExit($observer)}catch{$denied=$true};if(!$denied-or$control.CompletedStop){throw 'LIVE_OWNER_COMPLETED'}
 $denied=$false;try{$marker.DeleteForCompletedStop()}catch{$denied=$true};if(!$denied-or$marker.Deleted){throw 'LIVE_MARKER_DELETED'}
 if([ManagedExitThreadProbe]::Check($control,$observer)-ceq'ACCEPTED'-or$control.CompletedStop){throw 'LIVE_FOREIGN_THREAD_COMPLETED'}
 $peer.Dispose();$pipe.Dispose();[Console]::WriteLine('OBSERVING');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null
 $observer.ValidateExited()
 foreach($invalid in @($null,$disposedObserver,($observer|ConvertTo-Json|ConvertFrom-Json))){$denied=$false;try{$control.CompleteManagedExit($invalid)}catch{$denied=$true};if(!$denied-or$control.CompletedStop){throw 'INVALID_OBSERVATION_COMPLETED'}}
 $denied=$false;try{$discard.CompleteManagedExit($observer)}catch{$denied=$true};if(!$denied-or$discard.CompletedStop){throw 'DISPOSED_CONTROL_COMPLETED'}
 if([ManagedExitThreadProbe]::Check($control,$observer)-ceq'ACCEPTED'-or$control.CompletedStop){throw 'EXITED_FOREIGN_THREAD_COMPLETED'}
 $copy=$control|ConvertTo-Json|ConvertFrom-Json;$copy.CompletedStop=$true;$denied=$false;try{$copy.ValidateCompletedStop()}catch{$denied=$true};if(!$denied-or$control.CompletedStop){throw 'SERIALIZED_COMPLETION_AUTHORITY'}
 $denied=$false;try{$marker.DeleteForCompletedStop()}catch{$denied=$true};if(!$denied-or$marker.Deleted){throw 'OBSERVATION_ALONE_DELETED_MARKER'}
 $control.CompleteManagedExit($observer);$control.ValidateCompletedStop();$control.ValidateCompletedStop()
 if(!$control.CompletedStop-or$control.TargetPid-ne${server.pid}-or$control.TargetBirth-cne$birth){throw 'MANAGED_COMPLETION_IDENTITY'}
 $denied=$false;try{$control.CompleteManagedExit($observer)}catch{if($_.Exception.InnerException.Message-cne'RETIREMENT_CONTROL_STOP_REPLAY'){throw};$denied=$true};if(!$denied){throw 'MANAGED_COMPLETION_REPLAY'}
 $marker.DeleteForCompletedStop();if(!$marker.Deleted){throw 'MANAGED_MARKER_NOT_DELETED'}
 $control.Dispose();$denied=$false;try{$control.ValidateCompletedStop()}catch{$denied=$true};if(!$denied){throw 'DISPOSED_COMPLETION_VALIDATED'};'PASS'
}finally{if($marker){$marker.CloseRetained()};if($observer){$observer.Dispose()};if($control){$control.Dispose()};$peer.Dispose();$pipe.Dispose()}`,'managed-exit-client');
 assert.equal(await client.line(),'OBSERVING');server.stdin.end();const sr=await server.finished;assert.equal(sr.code,0,sr.stderr);assert.match(sr.stdout,/FINALLY/);
 client.stdin.end();const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);assert.match(cr.stdout,/PASS/);
});

test('managed completion cannot exchange genuine observations across two disposable server generations',win,async t=>{
 const f=await fixture(t),serverBody=String.raw`Initialize-Business5244RetirementPeer;$pipe=[Business5244RetirementPipe]::CreateServer();try{[Console]::WriteLine('READY');[Console]::Out.Flush();$pipe.WaitForConnection();$pipe.WriteByte(1);$pipe.Flush();[Console]::ReadLine()|Out-Null}finally{$pipe.Dispose()}`;
 const first=await child(f,serverBody,'managed-generation-first');assert.equal(await first.line(),'READY');
 const client=await child(f,`Initialize-Business5244RetirementPeer;$firstControl=$null;$firstObserver=$null;$nextControl=$null;$nextObserver=$null
try{
 $p=[Business5244RetirementPipe]::Connect();if($p.ReadByte()-ne1){throw 'FIRST_PIPE_NOT_CONNECTED'};$peer=[Business5244RetirementPeer]::CaptureServer($p);if($peer.Pid-ne${first.pid}){throw 'NOT_OUR_DISPOSABLE_FIRST'};$firstControl=$peer.OpenControlledShutdown();$firstObserver=$peer.OpenExitObservation();$peer.Dispose();$p.Dispose()
 [Console]::WriteLine('FIRST_BOUND');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null;$firstObserver.ValidateExited()
 [Console]::WriteLine('NEXT_READY');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null
 $p=[Business5244RetirementPipe]::Connect();if($p.ReadByte()-ne1){throw 'NEXT_PIPE_NOT_CONNECTED'};$peer=[Business5244RetirementPeer]::CaptureServer($p);$nextControl=$peer.OpenControlledShutdown();$nextObserver=$peer.OpenExitObservation();$peer.Dispose();$p.Dispose()
 if($nextControl.TargetPid-eq$firstControl.TargetPid-and$nextControl.TargetBirth-ceq$firstControl.TargetBirth){throw 'SAME_GENERATION_FIXTURE'}
 [Console]::WriteLine('NEXT_BOUND');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null;$nextObserver.ValidateExited()
 foreach($pair in @(@($firstControl,$nextObserver),@($nextControl,$firstObserver))){$denied=$false;try{$pair[0].CompleteManagedExit($pair[1])}catch{if($_.Exception.InnerException.Message-cne'RETIREMENT_CONTROL_MANAGED_TARGET_MISMATCH'){throw};$denied=$true};if(!$denied-or$pair[0].CompletedStop){throw 'FOREIGN_GENERATION_COMPLETED'}}
 $firstControl.CompleteManagedExit($firstObserver);$nextControl.CompleteManagedExit($nextObserver);$firstControl.ValidateCompletedStop();$nextControl.ValidateCompletedStop();'PASS'
}finally{foreach($item in @($firstObserver,$nextObserver,$firstControl,$nextControl)){if($item){$item.Dispose()}}}`,'managed-generation-client');
 assert.equal(await client.line(),'FIRST_BOUND');first.stdin.end();const fr=await first.finished;assert.equal(fr.code,0,fr.stderr);client.stdin.write('first-exited\n');assert.equal(await client.line(),'NEXT_READY');
 const next=await child(f,serverBody,'managed-generation-next');assert.equal(await next.line(),'READY');client.stdin.write('next-ready\n');assert.equal(await client.line(),'NEXT_BOUND');next.stdin.end();const nr=await next.finished;assert.equal(nr.code,0,nr.stderr);client.stdin.end();const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);assert.match(cr.stdout,/PASS/);
});

test('separate admission accepts a valid body after input deadline while preserving exact peer/reference guards',win,async t=>{
 const f=await fixture(t),isolate=await isolatedAdmission(f);
 const server=await child(f,isolate+serverStart+acceptAdmission+String.raw`
if($q.admissionDeadlineUtc-ne$q.acceptedUtc.AddSeconds(60)-or@($request.PSObject.Properties.Name).Count-ne2){throw 'CLIENT_CONTROLLED_TTL'}
$r.deadline=[DateTime]::UtcNow.AddSeconds(-5);$q.acceptedTicks-=20L*[Diagnostics.Stopwatch]::Frequency;$q.acceptedUtc=$q.acceptedUtc.AddSeconds(-20);$q.admissionDeadlineUtc=$q.acceptedUtc.AddSeconds(60)
$info=Get-Business5244RetirementRequestAdmission $channel $request
if($info.expired-or$info.elapsedMilliseconds-lt20000-or!$info.nativePeerVerified-or$info.stopAuthorized-or$info.bodyHash-cne$q.hash){throw 'ADMISSION_WINDOW_WRONG'}
foreach($copy in @(($request|ConvertTo-Json|ConvertFrom-Json),([pscustomobject]@{operation=$request.operation;requestId=$request.requestId}))){$caught=$false;try{Get-Business5244RetirementRequestAdmission $channel $copy|Out-Null}catch{$caught=$true};if(!$caught){throw 'COPIED_REQUEST_ADMITTED'}}
$original=$request.operation;$request.operation='status';$caught=$false;try{Get-Business5244RetirementRequestAdmission $channel $request|Out-Null}catch{$caught=$true};if(!$caught){throw 'MUTATED_REQUEST_ADMITTED'};$request.operation=$original
Assert-Business5244RetirementRequest $channel $request
if($null-ne(Receive-Business5244RetirementRequest $channel)){throw 'REQUEST_REISSUED'};`+snapshot+String.raw`;Complete-Business5244RetirementRequest $channel $request RetireAccepted $snapshot|Out-Null
for($i=0;$i-lt15;$i++){Receive-Business5244RetirementRequest $channel|Out-Null;Start-Sleep -Milliseconds 5};'PASS'`+serverEnd,'admission-valid-server');
 assert.equal(await server.line(),'READY');
 const client=await child(f,isolate+connect(server.pid)+String.raw`$answer=Send-Business5244RetirementRequest $connection retire;if($answer.reply-cne'RetireAccepted'-or$answer.stopAuthorized){throw 'BAD_REPLY'};'PASS'`,'admission-valid-client');
 const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);const sr=await server.finished;assert.equal(sr.code,0,sr.stderr);assert.match(sr.stdout,/PASS/);
});
test('admission expiry is typed and read-only; late ACK resets without writing or granting replay',win,async t=>{
 const f=await fixture(t),isolate=await isolatedAdmission(f);
 const server=await child(f,isolate+serverStart+acceptAdmission+String.raw`
$q.acceptedTicks-=61L*[Diagnostics.Stopwatch]::Frequency;$q.acceptedUtc=$q.acceptedUtc.AddSeconds(-61);$q.admissionDeadlineUtc=$q.acceptedUtc.AddSeconds(60)
$info=Get-Business5244RetirementRequestAdmission $channel $request
if(!$info.expired-or$info.elapsedMilliseconds-lt61000-or$info.stopAuthorized-or!$info.nativePeerVerified-or$q.completed-or$q.closed){throw 'EXPIRY_OBSERVATION_MUTATED_STATE'}
$originalHash=$q.hash;$q.hash='0'*64;$caught=$false;try{Get-Business5244RetirementRequestAdmission $channel $request|Out-Null}catch{if($_.Exception.Message-ceq'RETIREMENT_REQUEST_REFERENCE_CHANGED'){$caught=$true}else{throw}};if(!$caught){throw 'ALTERED_BODY_HASH_OBSERVED'};$q.hash=$originalHash
$caught=$false;try{Assert-Business5244RetirementRequest $channel $request}catch{if($_.Exception.Message-ceq'RETIREMENT_ADMISSION_EXPIRED'){$caught=$true}else{throw}};if(!$caught){throw 'EXPIRY_NOT_TYPED'}
$copy=$request|ConvertTo-Json|ConvertFrom-Json;$caught=$false;try{Get-Business5244RetirementRequestAdmission $channel $copy|Out-Null}catch{if($_.Exception.Message-ceq'RETIREMENT_REQUEST_REFERENCE_CHANGED'){$caught=$true}else{throw}};if(!$caught){throw 'COPY_MINTED_EXPIRY'};`+snapshot+String.raw`
$caught=$false;try{Complete-Business5244RetirementRequest $channel $request RetireAccepted $snapshot|Out-Null}catch{if($_.Exception.Message-ceq'RETIREMENT_ADMISSION_EXPIRED'){$caught=$true}else{throw}};if(!$caught-or$r.phase-cne'Accept'-or$r.request-or!$q.closed-or$q.completed){throw 'LATE_ACK_WAS_AUTHORITY'}
$caught=$false;try{Get-Business5244RetirementRequestAdmission $channel $request|Out-Null}catch{$caught=$true};if(!$caught){throw 'EXPIRED_TOKEN_REPLAY'};'PASS'`+serverEnd,'admission-expired-server');
 assert.equal(await server.line(),'READY');
 const client=await child(f,isolate+connect(server.pid)+String.raw`$caught=$false;try{Send-Business5244RetirementRequest $connection retire|Out-Null}catch{if($_.Exception.Message-ceq'RETIREMENT_EXCHANGE_NOT_CONFIRMED'){$caught=$true}else{throw}};if(!$caught){throw 'EXPIRED_ACK_ACCEPTED'};'PASS'`,'admission-expired-client');
 const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);const sr=await server.finished;assert.equal(sr.code,0,sr.stderr);assert.match(sr.stdout,/PASS/);
});
test('input deadline remains 15 seconds and cannot issue an admission for an unfinished body',win,async t=>{
 const f=await fixture(t),isolate=await isolatedAdmission(f);
 const server=await child(f,isolate+serverStart+String.raw`
$r=Get-Business5244RetirementRecord $channel;$end=[DateTime]::UtcNow.AddSeconds(10)
while($r.phase-cne'Read'-and[DateTime]::UtcNow-lt$end){if(Receive-Business5244RetirementRequest $channel){throw 'BODY_UNEXPECTED'};Start-Sleep -Milliseconds 5};if($r.phase-cne'Read'){throw 'NO_INPUT_READ'}
if(($r.deadline-[DateTime]::UtcNow).TotalSeconds-gt15-or$r.request){throw 'INPUT_TTL_CHANGED'};$r.deadline=[DateTime]::UtcNow.AddMilliseconds(-1)
$caught=$false;try{Receive-Business5244RetirementRequest $channel|Out-Null}catch{if($_.Exception.Message-ceq'RETIREMENT_REQUEST_NOT_CONFIRMED'){$caught=$true}else{throw}};if(!$caught-or$r.request-or$r.phase-cne'Accept'){throw 'UNFINISHED_BODY_ADMITTED'};'PASS'`+serverEnd,'admission-input-server');
 assert.equal(await server.line(),'READY');
 const client=await child(f,isolate+String.raw`Initialize-Business5244RetirementPeer;$p=[Business5244RetirementPipe]::Connect();$peer=[Business5244RetirementPeer]::CaptureServer($p);try{if($peer.Pid-neEXPECTED){throw 'NOT_OUR_DISPOSABLE_SERVER'};$hello=Read-Business5244RetirementLine $p 192;$b=[byte[]]::new(1);$task=$p.ReadAsync($b,0,1);if(!$task.Wait(5000)){throw 'INPUT_NOT_CLOSED'};try{if($task.GetAwaiter().GetResult()-gt0){throw 'UNFINISHED_ACK'}}catch{if($_.Exception.Message-ceq'UNFINISHED_ACK'){throw}};'PASS'}finally{$peer.Dispose();$p.Dispose()}`.replace('EXPECTED',String(server.pid)),'admission-input-client');
 const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);const sr=await server.finished;assert.equal(sr.code,0,sr.stderr);assert.match(sr.stdout,/PASS/);
});
test('admission expiry cannot hide a dead native peer or a second body after acceptance',win,async t=>{
 for(const mode of ['extra','dead']){
  const f=await fixture(t),isolate=await isolatedAdmission(f);
  const server=await child(f,isolate+serverStart+acceptAdmission+String.raw`
$q.acceptedTicks-=61L*[Diagnostics.Stopwatch]::Frequency;$q.acceptedUtc=$q.acceptedUtc.AddSeconds(-61);$q.admissionDeadlineUtc=$q.acceptedUtc.AddSeconds(60)
[Console]::WriteLine('REQUESTED');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null
$caught=$false;try{Get-Business5244RetirementRequestAdmission $channel $request|Out-Null}catch{if($_.Exception.Message-match'EXPECTED'){$caught=$true}else{throw}};if(!$caught){throw 'EXPIRY_HID_PEER_OR_EXTRA_BODY'};'PASS'`.replace('EXPECTED',mode==='extra'?'RETIREMENT_SECOND_BODY_REJECTED':'RETIREMENT_NATIVE_PEER_CHANGED')+serverEnd,'admission-native-'+mode+'-server');
  assert.equal(await server.line(),'READY');
  const extra=String.raw`Initialize-Business5244RetirementPeer;$pipe=[Business5244RetirementPipe]::Connect();$peer=[Business5244RetirementPeer]::CaptureServer($pipe);try{if($peer.Pid-neEXPECTED){throw 'NOT_OUR_DISPOSABLE_SERVER'};$hello=Read-Business5244RetirementLine $pipe 192;$bytes=[Text.Encoding]::ASCII.GetBytes(('{"operation":"retire","requestId":"'+$hello.requestId+'"}')+[char]10);$pipe.Write($bytes,0,$bytes.Length);$pipe.Flush();[Console]::ReadLine()|Out-Null;$pipe.WriteByte(88);$pipe.Flush();[Console]::WriteLine('EXTRA_SENT');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null;'PASS'}finally{$peer.Dispose();$pipe.Dispose()}`.replace('EXPECTED',String(server.pid));
  const client=await child(f,isolate+(mode==='extra'?extra:connect(server.pid)+String.raw`Send-Business5244RetirementRequest $connection retire|Out-Null`),'admission-native-'+mode+'-client');
  assert.equal(await server.line(),'REQUESTED');
  if(mode==='extra'){client.stdin.write('EXTRA\n');assert.equal(await client.line(),'EXTRA_SENT');}else{client.kill();await client.finished;}
  server.stdin.end();const sr=await server.finished;assert.equal(sr.code,0,sr.stderr);assert.match(sr.stdout,/PASS/);
  if(mode==='extra'){client.stdin.end();const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);}
 }
});
test('normal wire handler has no stop, execution, credential, arbitrary pipe/PID or lease-release primitive',async()=>{const ps=await readFile(source,'utf8'),cs=await readFile(path.join(import.meta.dirname,'business-5244-retirement-peer.cs'),'utf8');assert.doesNotMatch(ps,/Exit-Business5244StartupLease|Stop-Process|Start-Process|Invoke-RestMethod|TerminateProcess|JWT_|SQL_PASSWORD|Cookie/);assert.match(cs,/GetNamedPipeClientProcessId/);assert.match(cs,/GetNamedPipeServerProcessId/);assert.match(cs,/SetAccessRuleProtection\(true,false\)/);assert.match(cs,/0x40080003,8,1,512,512/);});
test('controlled maintenance retains the actual server handle; client role and disposed control cannot stop',win,async t=>{
 const f=await fixture(t),pipeName='melisa-disposable-control-'+path.basename(f.directory);
 const server=await child(f,`Initialize-Business5244RetirementPeer;$pipe=[IO.Pipes.NamedPipeServerStream]::new('${pipeName}',[IO.Pipes.PipeDirection]::InOut);[Console]::WriteLine('READY');[Console]::Out.Flush();$pipe.WaitForConnection();$peer=[Business5244RetirementPeer]::CaptureClient($pipe);$rejected=$false;try{$peer.OpenControlledShutdown()|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'CLIENT_ROLE_CONTROL'};[Console]::WriteLine('CLIENT_REJECTED');[Console]::Out.Flush();Start-Sleep -Seconds 120`,'controlled-server');
 assert.equal(await server.line(),'READY');
 const client=await child(f,`Initialize-Business5244RetirementPeer;$pipe=[IO.Pipes.NamedPipeClientStream]::new('.','${pipeName}',[IO.Pipes.PipeDirection]::InOut);$pipe.Connect(5000);$peer=[Business5244RetirementPeer]::CaptureServer($pipe);if($peer.Pid-ne${server.pid}){throw 'NOT_OUR_DISPOSABLE_SERVER'};$discard=$peer.OpenControlledShutdown();$discard.Dispose();$rejected=$false;try{$discard.Stop()}catch{$rejected=$true};if(!$rejected){throw 'DISPOSED_CONTROL'};$control=$peer.OpenControlledShutdown();$birth=$control.TargetBirth;$peer.Dispose();$pipe.Dispose();$control.Validate();$control.Stop();$rejected=$false;try{$control.Stop()}catch{$rejected=$true};if(!$rejected-or$control.TargetPid-ne${server.pid}-or$control.TargetBirth-cne$birth){throw 'CONTROL_REPLAY_OR_IDENTITY'};$control.Dispose();'PASS'`,'controlled-client');
 assert.equal(await server.line(),'CLIENT_REJECTED');const cr=await client.finished;assert.equal(cr.code,0,cr.stderr);assert.match(cr.stdout,/PASS/);const sr=await server.finished;assert.notEqual(sr.code,0);
});
test('abandoned pre-body connections cannot terminate the real owner loop or its owned Job child',win,async t=>{
 const f=await fixture(t),nativeSource=await readFile(path.join(import.meta.dirname,'business-5244-retirement-peer.cs'),'utf8');
 const isolatedRuntime=path.join(f.directory,'isolated-runtime');
 const isolatedCs=path.join(f.directory,'isolated-peer.cs');
 await writeFile(isolatedCs,nativeSource.replaceAll(String.raw`C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027`,isolatedRuntime.replaceAll('\\','\\\\')));
 const isolate=`function Initialize-Business5244RetirementPeer{if(!('Business5244RetirementPeer' -as [type])){Add-Type -LiteralPath ${q(isolatedCs)}}};function Get-Business5244StartupMutexName{return ('Global\\MelisaERP5244Startup-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value+'-'+(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(${q(isolatedRuntime)}.ToLowerInvariant()))))};function Get-Business5244RetirementPendingPath{return ${q(path.join(f.directory,'only-test.pending'))}};`;
 const sleep=path.join(f.directory,'sleep.ps1');await writeFile(sleep,'Start-Sleep -Seconds 120');
 const owner=await child(f,`. ${q(path.join(import.meta.dirname,'start-business-5244-owned.ps1'))} -Library;${isolate}function New-Business5244PinnedChild{param($Pins,$Lease);Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+${q(sleep)}+'"'),$env:TEMP);return $n};Start-Business5244OwnedSupervisor -InitialSlot Current|ForEach-Object{[Console]::WriteLine(($_|ConvertTo-Json -Compress));[Console]::Out.Flush()}`,'resilient-owner');
 const ready=JSON.parse(await owner.line());assert.equal(ready.ownerPid,owner.pid);
 for(let i=0;i<3;i++){
  const abort=await child(f,isolate+String.raw`Initialize-Business5244RetirementPeer;$p=[Business5244RetirementPipe]::Connect();$p.Dispose();'ABORTED'`,'aborted-'+i);
  const ar=await abort.finished;assert.equal(ar.code,0,ar.stderr);
 }
 const normal=await child(f,isolate+connect(owner.pid)+`$answer=Send-Business5244RetirementRequest $connection status;if($answer.state.phase-cne'Running'-or$answer.state.childPid-ne${ready.childPid}){throw 'OWNER_OR_CHILD_LOST'};'PASS'`,'after-aborts');
 const nr=await normal.finished;assert.equal(nr.code,0,nr.stderr);assert.match(nr.stdout,/PASS/);assert.equal(owner.exitCode,null);
});
test('actual pipe ACL is protected/currentSID-only and poll remains nonblocking without a client',win,async t=>{const f=await fixture(t),p=await child(f,serverStart+String.raw`$pipe=(Get-Business5244RetirementRecord $channel).pipe;$acl=$pipe.GetAccessControl();$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(!$acl.AreAccessRulesProtected -or !$rules.Count -or @($rules|Where-Object{$_.IdentityReference.Value -cne [Business5244RetirementPeer]::CurrentSid -or $_.AccessControlType -ne 'Allow'}).Count){throw 'PIPE_ACL_NOT_CURRENT_SID_ONLY'}
$clock=[Diagnostics.Stopwatch]::StartNew();for($i=0;$i -lt 50;$i++){if($null -ne (Receive-Business5244RetirementRequest $channel)){throw 'UNSOLICITED_REQUEST'}};if($clock.ElapsedMilliseconds -gt 2000){throw 'ACCEPT_POLL_BLOCKED'}
$caught=$false;try{Assert-Business5244RetirementChannel ($channel|ConvertTo-Json|ConvertFrom-Json)}catch{$caught=$true};if(!$caught){throw 'JSON_CHANNEL_AUTHORITY'};'PASS'`+serverEnd,'acl');assert.equal(await p.line(),'READY');const r=await p.finished;assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/PASS/);});
test('separate native peers exchange only status/retire snapshots; token mutation and replay fail',win,async t=>{const f=await fixture(t),server=await child(f,serverStart+String.raw`$count=0;$deadline=[DateTime]::UtcNow.AddSeconds(20)
while($count -lt 2 -and [DateTime]::UtcNow -lt $deadline){$request=Receive-Business5244RetirementRequest $channel;if($request){Assert-Business5244RetirementRequest $channel $request;$original=$request.operation;$request.operation='changed';$caught=$false;try{Assert-Business5244RetirementRequest $channel $request}catch{$caught=$true};if(!$caught){throw 'MUTATED_OPERATION_ADMITTED'};$request.operation=$original;Assert-Business5244RetirementRequest $channel $request;`+snapshot+String.raw`;$reply=if($request.operation -ceq 'status'){'Status'}else{'RetireAccepted'};$queued=Complete-Business5244RetirementRequest $channel $request $reply $snapshot;if($queued.stopAuthorized -or $queued.deliveryConfirmed){throw 'ACK_IS_AUTHORITY'};$caught=$false;try{Complete-Business5244RetirementRequest $channel $request $reply $snapshot|Out-Null}catch{$caught=$true};if(!$caught){throw 'REQUEST_TOKEN_REPLAY'};$count++};Start-Sleep -Milliseconds 10}
if($count -ne 2){throw 'MISSING_REQUESTS'};for($i=0;$i -lt 15;$i++){Receive-Business5244RetirementRequest $channel|Out-Null;Start-Sleep -Milliseconds 10};'PASS'`+serverEnd,'roundtrip-server');assert.equal(await server.line(),'READY');for(const op of ['status','retire']){const client=await child(f,connect(server.pid)+`$answer=Send-Business5244RetirementRequest -Connection $connection -Operation ${op};if(!$answer.nativePeerVerified -or $answer.stopAuthorized -or !$answer.childObservationOnly -or $answer.state.ownerPid -ne ${server.pid}){throw 'WRONG_ACK_SCOPE'};$caught=$false;try{Send-Business5244RetirementRequest $connection status|Out-Null}catch{$caught=$true};if(!$caught){throw 'CLIENT_REPLAY_ADMITTED'};'PASS'`,'roundtrip-'+op),r=await client.finished;assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/PASS/);}const r=await server.finished;assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/PASS/);});
test('client death after request invalidates retained native peer before any state callback',win,async t=>{const f=await fixture(t),server=await child(f,serverStart+String.raw`$request=$null;$end=[DateTime]::UtcNow.AddSeconds(15);while(!$request -and [DateTime]::UtcNow -lt $end){$request=Receive-Business5244RetirementRequest $channel;Start-Sleep -Milliseconds 10};if(!$request){throw 'REQUEST_MISSING'};[Console]::WriteLine('REQUESTED');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null;$mutations=0;$caught=$false;try{Assert-Business5244RetirementRequest $channel $request;$mutations++}catch{$caught=$true};if(!$caught -or $mutations){throw 'DEAD_PEER_AUTHORITY'};'PASS'`+serverEnd,'death-server');assert.equal(await server.line(),'READY');const client=await child(f,connect(server.pid)+String.raw`Send-Business5244RetirementRequest $connection retire|Out-Null`,'death-client');assert.equal(await server.line(),'REQUESTED');client.kill();await client.finished;server.stdin.end();const r=await server.finished;assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/PASS/);});
test('duplicate/unknown/oversized/wrong-challenge bodies are rejected with no returned request token',win,async t=>{const f=await fixture(t),server=await child(f,serverStart+String.raw`$rejected=0;$tokens=0;$end=[DateTime]::UtcNow.AddSeconds(20);while($rejected -lt 4 -and [DateTime]::UtcNow -lt $end){try{$request=Receive-Business5244RetirementRequest $channel;if($request){$tokens++}}catch{if($_.Exception.Message -cne 'RETIREMENT_REQUEST_NOT_CONFIRMED'){throw};$rejected++};Start-Sleep -Milliseconds 10};if($rejected -ne 4 -or $tokens){throw 'MALFORMED_BODY_REACHED_STATE'};'PASS'`+serverEnd,'bad-server');assert.equal(await server.line(),'READY');for(const mode of ['double','unknown','oversize','nonce']){const raw=String.raw`Initialize-Business5244RetirementPeer;$pipe=[Business5244RetirementPipe]::Connect();$peer=$null;try{$peer=[Business5244RetirementPeer]::CaptureServer($pipe);if($peer.Pid -ne EXPECTED){throw 'NOT_OUR_DISPOSABLE_SERVER'};$peer.Validate();$hello=Read-Business5244RetirementLine $pipe 192;$id=$hello.requestId;$frame='{"operation":"status","requestId":"'+$id+'"}'+"`+'`n'+String.raw`";switch('MODE'){double{$frame=$frame+$frame}unknown{$frame=$frame.Replace('status','delete')}oversize{$frame=('X'*200)+"`+'`n'+String.raw`"}nonce{$frame=$frame.Replace($id,('0'*32))}};$bytes=[Text.Encoding]::ASCII.GetBytes($frame);$task=$pipe.WriteAsync($bytes,0,$bytes.Length);if(!$task.Wait(5000)){throw 'TEST_WRITE_TIMEOUT'};$task.GetAwaiter().GetResult();$buf=[byte[]]::new(512);$task=$pipe.ReadAsync($buf,0,$buf.Length);if(!$task.Wait(5000)){throw 'TEST_REJECTION_TIMEOUT'};try{$n=$task.GetAwaiter().GetResult();if($n -gt 0){throw 'MALFORMED_ACK'}}catch{if($_.Exception.Message -ceq 'MALFORMED_ACK'){throw}};'PASS'}finally{if($peer){$peer.Dispose()};$pipe.Dispose()}`;const client=await child(f,raw.replace('EXPECTED',String(server.pid)).replace('MODE',mode),'raw-'+mode),r=await client.finished;assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/PASS/);}const r=await server.finished;assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/PASS/);});
test('owner death while client awaits ACK yields uncertainty, never stop authority',win,async t=>{const f=await fixture(t),server=await child(f,serverStart+String.raw`$request=$null;while(!$request){$request=Receive-Business5244RetirementRequest $channel;Start-Sleep -Milliseconds 10};[Console]::WriteLine('REQUESTED');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null`+serverEnd,'ack-server');assert.equal(await server.line(),'READY');const client=await child(f,connect(server.pid)+String.raw`$caught=$false;try{Send-Business5244RetirementRequest $connection retire|Out-Null}catch{if($_.Exception.Message -ceq 'RETIREMENT_EXCHANGE_NOT_CONFIRMED'){$caught=$true}else{throw}};if(!$caught){throw 'LOST_ACK_CONFIRMED'};'PASS'`,'ack-client');assert.equal(await server.line(),'REQUESTED');server.kill();await server.finished;const r=await client.finished;assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/PASS/);});

for(const [operation,reply] of [['status','Status'],['retire','RetireAccepted'],['recover','RecoveryAccepted']])test(`native isolated ${operation} exchange accepts only its own reply and never converts observations into stop authority`,win,async t=>{
 const f=await fixture(t),isolate=await isolatedAdmission(f);
 const wrong=['Status','RetireAccepted','RecoveryAccepted'].filter(x=>x!==reply);
 const body=isolate+serverStart+acceptAdmission+snapshot+`
if($request.operation-cne'${operation}'){throw 'WRONG_ISSUED_OPERATION'}
foreach($bad in @(${wrong.map(q).join(',')})){$denied=$false;try{Complete-Business5244RetirementRequest $channel $request $bad $snapshot|Out-Null}catch{if($_.Exception.Message-cne'RETIREMENT_REPLY_OPERATION_MISMATCH'){throw};$denied=$true};if(!$denied-or$q.completed-or$r.phase-cne'Request'){throw 'CROSS_OPERATION_REPLY_ADMITTED'}}
Complete-Business5244RetirementRequest $channel $request ${reply} $snapshot|Out-Null
$end=[DateTime]::UtcNow.AddSeconds(8);while($r.phase-cne'Accept'-and[DateTime]::UtcNow-lt$end){Receive-Business5244RetirementRequest $channel|Out-Null;Start-Sleep -Milliseconds 5};if($r.phase-cne'Accept'){throw 'REPLY_NOT_RESET'};'PASS'
`+serverEnd;
 const server=await child(f,body,`reply-${operation}-server`);assert.equal(await server.line(),'READY');
 const client=await child(f,isolate+connect(server.pid)+`$answer=Send-Business5244RetirementRequest $connection ${operation};if($answer.reply-cne'${reply}'-or!$answer.nativePeerVerified-or$answer.stopAuthorized-or!$answer.childObservationOnly){throw 'REPLY_ISSUED_AUTHORITY'};$denied=$false;try{Send-Business5244RetirementRequest $connection ${operation}|Out-Null}catch{$denied=$true};if(!$denied){throw 'CONNECTION_REPLAY_ALLOWED'};'PASS'`,`reply-${operation}-client`);
 const [a,b]=await Promise.all([client.finished,server.finished]);assert.equal(a.code,0,a.stderr);assert.equal(b.code,0,b.stderr);assert.match(a.stdout,/PASS/);assert.match(b.stdout,/PASS/);
});
