import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import cp from 'node:child_process';import crypto from 'node:crypto';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const q=s=>"'"+s.replaceAll("'","''")+"'",hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const required=['start-business-5244-owned.ps1','business-5244-cooperative-exit.ps1','business-5244-cooperative-exit-native.cs','business-5244-startup-exclusion.ps1','business-5244-retirement-channel.ps1','business-5244-retirement-peer.cs','business-5244-web-native.cs','business-5244-retirement-state.ps1','business-5244-cold-current-recovery.cs','start-business-5244-web.ps1','business-5244-maintenance-dispatch.ps1','start-business-5244-cooperative-owner.ps1','business-5244-cooperative-controller.ps1'];
const copied=required.filter(n=>!n.endsWith('-owner.ps1')&&!n.endsWith('-controller.ps1'));
function launch(file,manifest){
 const child=cp.spawn(ps,['-NoProfile','-NonInteractive','-File',file,'-ManifestSha256',manifest],{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';const waiters=[];
 child.stdout.on('data',b=>{stdout+=b;for(const w of waiters)w();});child.stderr.on('data',b=>stderr+=b);
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,stdout,stderr}));});
 return {child,done,async line(prefix){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('OWN_FIXTURE_READY_TIMEOUT '+stdout+' '+stderr)),15000);const poll=()=>{const line=stdout.split(/\r?\n/).find(s=>s.startsWith(prefix));if(line){clearTimeout(timer);resolve(JSON.parse(line.slice(prefix.length)));}};waiters.push(poll);poll();child.once('close',()=>{clearTimeout(timer);reject(new Error('OWN_FIXTURE_CLOSED '+stdout+' '+stderr));});});}};
}
const clientScript=String.raw`param([string]$ManifestSha256)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'business-5244-retirement-channel.ps1') -Library
Initialize-Business5244RetirementPeer
[Console]::WriteLine('CLIENT '+(@{pid=$PID;birth=[Business5244RetirementPeer]::CurrentBirth}|ConvertTo-Json -Compress));[Console]::Out.Flush()
Add-Type -TypeDefinition 'public static class OwnFixtureGo { public static string Read(){var r=System.Threading.Tasks.Task.Run(()=>System.Console.ReadLine());return r.Wait(10000)?r.GetAwaiter().GetResult():null;} }'
if([OwnFixtureGo]::Read()-cne'GO'){return}
$conn=$null;$obs=$null;$owner=$null;$mutex=$null;$mutexHeld=$false;$answer=@{mutexBusyBefore=$false;sameMutexReleased=$false;mutexAbandoned=$false;pendingRestartBlocked=$false;requests=1;replays=0;reply='UNKNOWN';readAck=$false;ownerExited=$false;ownerExitCode=$null}
try{
 $conn=Connect-Business5244RetirementPeer;$record=Get-Business5244RetirementRecord $conn -Client;$obs=$record.peer.OpenExitObservation();$owner=[Diagnostics.Process]::GetProcessById([int]$conn.serverPid);[void]$owner.Handle
 if($owner.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()-cne$conn.serverBirth){throw 'OWN_FIXTURE_PEER_HANDLE_BIRTH'}
 $mutex=[Threading.Mutex]::OpenExisting((Get-Business5244StartupMutexName));try{$mutexHeld=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();$answer.mutexAbandoned=$true;throw};if($mutexHeld){$mutex.ReleaseMutex();$mutexHeld=$false;throw 'OWN_FIXTURE_LIVE_OWNER_MUTEX_NOT_BUSY'};$answer.mutexBusyBefore=$true
 if([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'kind.txt'))-ceq'wire-nonce'){
  $hello=Read-Business5244RetirementLine $record.pipe 192;$stale=$(if($hello.requestId[0]-ceq'0'){'1'}else{'0'})+$hello.requestId.Substring(1);$record.used=$true;$bad=[Text.Encoding]::ASCII.GetBytes(('{"operation":"exit","requestId":"'+$stale+'"}')+[char]10);$task=$record.pipe.WriteAsync($bad,0,$bad.Length);if(!$task.Wait(5000)){throw 'OWN_FIXTURE_BAD_FRAME_TIMEOUT'};[void]$task.GetAwaiter().GetResult();$closed=$false;try{Read-Business5244RetirementLine $record.pipe 512|Out-Null}catch{$closed=$true};if(!$closed){throw 'OWN_FIXTURE_STALE_FRAME_ACCEPTED'}
  Close-Business5244RetirementPeer $conn;$conn=Connect-Business5244RetirementPeer;$record=Get-Business5244RetirementRecord $conn -Client;if($conn.serverPid-ne$owner.Id-or$conn.serverBirth-cne$owner.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()){throw 'OWN_FIXTURE_OWNER_CHANGED_AFTER_REJECTED_FRAME'};$answer.invalidFrames=1
  # The rejected frame minted no admission/intent. This next explicit valid
  # unit-test request is not a retry of an accepted or uncertain mutation.
 }
 if([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'kind.txt'))-ceq'lost-response'){
  $hello=Read-Business5244RetirementLine $record.pipe 192;$record.peer.Validate();$record.used=$true;$wire=[Text.Encoding]::ASCII.GetBytes(('{"operation":"exit","requestId":"'+$hello.requestId+'"}')+[char]10);$write=$record.pipe.WriteAsync($wire,0,$wire.Length);if(!$write.Wait(5000)){throw 'OWN_FIXTURE_WIRE_TIMEOUT'};[void]$write.GetAwaiter().GetResult()
  # Deliberately do not read a response. UNKNOWN must never trigger a replay.
 }else{try{$reply=Send-Business5244RetirementRequest -Connection $conn -Operation exit;$answer.reply=$reply.reply;$answer.readAck=$true}catch{$answer.reply='UNKNOWN'}}
 if($owner.WaitForExit(15000)){$obs.ValidateExited();$answer.ownerExited=$true;$answer.ownerExitCode=$owner.ExitCode
  try{$mutexHeld=$mutex.WaitOne(15000)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();$answer.mutexAbandoned=$true;throw};if(!$mutexHeld){throw 'OWN_FIXTURE_SAME_MUTEX_NOT_RELEASED'};$mutex.ReleaseMutex();$mutexHeld=$false;$answer.sameMutexReleased=$true
  if([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'kind.txt'))-in@('valid','lost-response','wire-nonce','copy','once')){
   $data=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'plan.json') -Raw|ConvertFrom-Json;$barrier=Get-Content -LiteralPath (Get-Business5244RetirementPendingPath) -Raw|ConvertFrom-Json
   if($barrier.generation-cne$data.generation-or$barrier.intentSha256-cne(Get-Business5244StartupHash ([IO.File]::ReadAllBytes((Join-Path $data.auditRoot 'intent.json'))))){throw 'OWN_FIXTURE_PENDING_INTENT_NOT_BOUND'}
   $denied=$false;try{$unexpected=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $unexpected}catch{if(!$_.Exception.ToString().Contains('BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED')){throw};$denied=$true};if(!$denied){throw 'OWN_FIXTURE_RESTART_BARRIER_SKIPPED'};$answer.pendingRestartBlocked=$true
  }
 }
}finally{
 if($mutex){if($mutexHeld){$mutex.ReleaseMutex()};$mutex.Dispose()};if($conn){Close-Business5244RetirementPeer $conn};if($obs){$obs.Dispose()};if($owner){$owner.Dispose()}
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'client-result.json'),($answer|ConvertTo-Json -Compress))
}
`;
const ownerScript=String.raw`param([string]$ManifestSha256)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'start-business-5244-owned.ps1') -Library
. (Join-Path $PSScriptRoot 'business-5244-cooperative-exit.ps1') -Library
Initialize-Business5244RetirementPeer
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'plan.json') -Raw|ConvertFrom-Json
$data=$plan;$plan=@{};foreach($p in $data.PSObject.Properties){$plan[$p.Name]=$p.Value};$plan.ownerArgv=[string[]]$plan.ownerArgv;$plan.clientArgv=[string[]]$plan.clientArgv
$kind=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'kind.txt'))
foreach($name in @('Test-Business5244ColdCurrentGeneration','Test-Business5244ReadContextRepairGeneration','Test-Business5244SteadyGeneration','Test-Business5244PackageRefreshGeneration','Test-Business5244WriterWebOnlyGeneration')){Set-Item ('function:'+$name) {return $false}}
# Inert generation seam avoids the unrelated runtime config loader.
function Test-Business5244SteadyGeneration{return $true};function Assert-Business5244SteadyEntry{}
function Invoke-RestMethod{throw 'OWN_FIXTURE_FORBIDDEN_HTTP'};function Invoke-WebRequest{throw 'OWN_FIXTURE_FORBIDDEN_HTTP'};function Get-NetTCPConnection{throw 'OWN_FIXTURE_FORBIDDEN_PORT_QUERY'};function Get-CimInstance{throw 'OWN_FIXTURE_FORBIDDEN_CIM'};function Invoke-CimMethod{throw 'OWN_FIXTURE_FORBIDDEN_CIM'};function Read-ErpStartupConfig{throw 'OWN_FIXTURE_FORBIDDEN_CONFIG'}
$script:fixturePins=@{root=$PSScriptRoot;package='own-inert-child';manifest=('a'*64);frontendSource=('b'*40);apiPackage='not-an-api';apiManifest=('c'*64);baseSource=('d'*40);node=(Join-Path $PSHOME 'powershell.exe');nodeHash=('e'*64);profile='OWN-TEMP-ONLY'}
function Get-Business5244FinitePairPins($ScopeName,$Mode){return $script:fixturePins.Clone()}
function New-Business5244PinnedChild($Pins,$Lease){
 Assert-Business5244StartupLease $Lease -Kind Owner;Initialize-Business5244WebNative
 $n=[Business5244WebNative]::new();$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+(Join-Path $PSScriptRoot 'own-child.ps1')+'"'),$PSScriptRoot)
 $r=Get-Business5244StartupRecord $Lease;if(!$r.ContainsKey('ownedNatives')){$r.ownedNatives=[Collections.Generic.List[object]]::new()};$r.ownedNatives.Add($n);$script:fixtureNative=$n;$script:fixtureLease=$Lease;return $n
}
function Publish-Business5244CurrentRecord($State){$r=Get-Business5244RetirementState $State;$r.currentBootstrap=@{phase='Archived'};return @{inertPublication=$true}}
function Undo-Business5244CurrentBootstrap($State){throw 'OWN_FIXTURE_NO_RECORD_INVERSE'}
# Instrument only adversarial caller DATA. The handler itself is the actual
# production ScriptBlock; no request/peer/native/lease predicate is stubbed.
$script:actualRequest=(Get-Command Request-Business5244CooperativeExit).ScriptBlock
function Request-Business5244CooperativeExit($Token,$Channel,$Request){
 $r=Get-Business5244CooperativeExit $Token
 if($kind-ceq'copy'){
  $denied=$false;try{&$script:actualRequest ([pscustomobject]@{kind=$Token.kind}) $Channel $Request|Out-Null}catch{$denied=$true};if(!$denied-or!$r.native.ChildAlive()){throw 'OWN_FIXTURE_COPY_TOKEN_ALLOWED'}
  $denied=$false;try{&$script:actualRequest $Token $Channel ([pscustomobject]@{operation='exit';requestId=$Request.requestId})|Out-Null}catch{$denied=$true};if(!$denied-or!$r.native.ChildAlive()){throw 'OWN_FIXTURE_COPY_REQUEST_ALLOWED'};[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'copies-rejected.json'),'true')
 }
 if($kind-ceq'admission-expiry'){$c=Get-Business5244RetirementRecord $Channel;$c.request.acceptedTicks=[long]([Diagnostics.Stopwatch]::GetTimestamp()-(61L*[Diagnostics.Stopwatch]::Frequency))}
 if($kind-ceq'intent-failure'){[IO.File]::WriteAllText((Join-Path $r.root 'intent.json'),'foreign-intent')}
 try{$answer=&$script:actualRequest $Token $Channel $Request}catch{if($kind-ceq'admission-expiry'){if(!$_.Exception.ToString().Contains('RETIREMENT_ADMISSION_EXPIRED')-or!$r.native.ChildAlive()-or$r.phase-cne'Running'-or[IO.File]::Exists((Join-Path $r.root 'intent.json'))){throw 'OWN_FIXTURE_EXPIRY_ACCEPTED'};[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'rejected-live.json'),'true')};if($kind-ceq'intent-failure'){if(!$r.native.ChildAlive()-or$r.phase-cne'IntentUnknown'){throw 'OWN_FIXTURE_WRITE_FAILURE_STOPPED_CHILD'};[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'rejected-live.json'),'true')};throw}
 if($kind-ceq'once'){$denied=$false;try{&$script:actualRequest $Token $Channel $Request|Out-Null}catch{if(!$_.Exception.ToString().Contains('COOPERATIVE_EXIT_ONCE_CONSUMED')){throw};$denied=$true};if(!$denied-or!$r.native.ChildAlive()){throw 'OWN_FIXTURE_SECOND_ACCEPTED'};[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'once-rejected.json'),'true')}
 return $answer
}
$errorCode=$null;$retainedMutex=[Threading.Mutex]::new($false,(Get-Business5244StartupMutexName))
try{
 if($kind-in@('pid','birth','source','argv','generation-mismatch')){
  $lease=Enter-Business5244StartupLease -Kind Owner;$n=New-Business5244PinnedChild $fixturePins $lease
  try{$denied=$false;try{$token=New-Business5244CooperativeExit $lease $n $plan}catch{$errorCode=$_.Exception.ToString();$denied=$true};if(!$denied-or!$n.ChildAlive()){throw 'OWN_FIXTURE_BAD_FACTORY_TOUCHED_CHILD'};[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'rejected-live.json'),'true')}finally{$n.Dispose();Exit-Business5244StartupLease $lease}
 }else{
  Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029' -CooperativeExitPlan $plan|ForEach-Object{if($_.PSObject.Properties['kind']-and$_.kind-ceq'business-5244-owned-start'){[Console]::WriteLine('OWNER '+($_|ConvertTo-Json -Compress));[Console]::Out.Flush()}}
 }
}catch{$errorCode=$_.Exception.ToString()}
finally{
 $phase=$null;$cleanup=$false
 if($script:Business5244CooperativeExits.Count){$r=$script:Business5244CooperativeExits[0];if($r.phase-ceq'Accepted'-and$r.ContainsKey('leaseReleaseReturned')-and$r.leaseReleaseReturned){Complete-Business5244CooperativeExitCleanup $r.token|Out-Null};$phase=$r.phase;$cleanup=$r.cleanupReturned}
 $leaseClosed=if(Get-Variable fixtureLease -Scope Script -ErrorAction SilentlyContinue){(Get-Business5244StartupRecord $script:fixtureLease).closed}else{$false}
 $nativeClosed=if(Get-Variable fixtureNative -Scope Script -ErrorAction SilentlyContinue){$script:fixtureNative.RetirementConfirmed}else{$false}
 $m=[Threading.Mutex]::OpenExisting((Get-Business5244StartupMutexName));$free=$false;try{try{$free=$m.WaitOne(0)}catch [Threading.AbandonedMutexException]{throw 'OWN_FIXTURE_ABANDONED_MUTEX'};if($free){$m.ReleaseMutex()}}finally{$m.Dispose();$retainedMutex.Dispose()}
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'owner-result.json'),(@{phase=$phase;cleanupReturned=$cleanup;leaseClosed=$leaseClosed;nativeClosed=$nativeClosed;mutexFree=$free;failure=$errorCode}|ConvertTo-Json -Compress))
}
`;
const receiveSpy=String.raw`
if(!(Get-Variable FixtureActualReceive -Scope Script -ErrorAction SilentlyContinue)){$script:FixtureActualReceive=(Get-Command Receive-Business5244RetirementRequest).ScriptBlock}
function Receive-Business5244RetirementRequest($Channel){
 try{return &$script:FixtureActualReceive $Channel}catch{
  if($kind-ceq'wire-nonce'-and$_.Exception.Message-ceq'RETIREMENT_REQUEST_NOT_CONFIRMED'){
   $r=Get-Business5244RetirementRecord $Channel;$c=$script:Business5244CooperativeExits[0]
   if($r.request-or$c.phase-cne'Running'-or!$c.native.ChildAlive()-or[IO.File]::Exists((Join-Path $c.root 'intent.json'))){throw 'OWN_FIXTURE_BAD_WIRE_MINTED_AUTHORITY'}
   [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'wire-rejected-live.json'),'true')
  };throw
 }
}
`;
async function fixture(kind){
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),root=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-cooperative-exit-'))),generation=crypto.randomBytes(16).toString('hex'),auditParent=path.join(root,'audit'),audit=path.join(auditParent,'cooperative-exit-'+generation);fs.mkdirSync(audit,{recursive:true});
 // Keep every proof file. There is deliberately no recursive delete or process
 // kill fallback; the own no-port child exits naturally after twelve seconds.
 const runtimeLiteral=String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,futureLiteral=String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-COOPERATIVE-OWNER-V1-20261101`,auditLiteral=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-cooperative-exit-v1-20261101`;
 for(const leaf of copied){let text=fs.readFileSync(path.join(dir,leaf),'utf8');if(leaf==='business-5244-startup-exclusion.ps1')text=text.replaceAll(runtimeLiteral,root).replaceAll('Global\\MelisaERP5244Startup-','Local\\CooperativeFixture-');if(leaf==='business-5244-retirement-peer.cs')text=text.replaceAll(runtimeLiteral.replaceAll('\\','\\\\'),root.replaceAll('\\','\\\\')).replaceAll('Global\\\\MelisaERP5244Startup-','Local\\\\CooperativeFixture-');if(leaf==='business-5244-cooperative-exit.ps1'){text=text.replaceAll(futureLiteral,root).replaceAll(auditLiteral,auditParent);const begin=ownerScript.indexOf('$script:actualRequest='),end=ownerScript.indexOf('$errorCode=$null',begin);assert(begin>=0&&end>begin);text+='\n'+ownerScript.slice(begin,end)+receiveSpy;}fs.writeFileSync(path.join(root,leaf),text,{flag:'wx'});}
 fs.writeFileSync(path.join(root,'start-business-5244-cooperative-owner.ps1'),ownerScript,{flag:'wx'});fs.writeFileSync(path.join(root,'business-5244-cooperative-controller.ps1'),clientScript,{flag:'wx'});fs.writeFileSync(path.join(root,'own-child.ps1'),'Start-Sleep -Seconds 12',{flag:'wx'});fs.writeFileSync(path.join(root,'kind.txt'),kind,{flag:'wx'});
 const rows=required.map(leaf=>({path:leaf,sha256:hash(fs.readFileSync(path.join(root,leaf)))}));if(kind==='source')rows[0].sha256='0'.repeat(64);
 const manifest={schema:'melisa-b6-cooperative-exit-generation.v1',scope:'TEST125-API-B6-WRITER-20261029',purpose:'FiniteNormalExit',generation,installed:false,executionAuthority:false,files:rows},mb=Buffer.from(JSON.stringify(manifest)),mh=hash(mb);fs.writeFileSync(path.join(root,'cooperative-exit-manifest.json'),mb,{flag:'wx'});
 const clientFile=path.join(root,'business-5244-cooperative-controller.ps1'),ownerFile=path.join(root,'start-business-5244-cooperative-owner.ps1'),client=launch(clientFile,mh);const ready=await client.line('CLIENT ');
 const plan={schema:'melisa-b6-cooperative-exit-plan.v1',scope:manifest.scope,purpose:manifest.purpose,generation:kind==='generation-mismatch'?'f'.repeat(32):generation,actualT1:false,installed:false,auditRoot:audit,manifestSha256:mh,clientPid:kind==='pid'?process.pid:ready.pid,clientBirth:kind==='birth'?String(BigInt(ready.birth)+1n):ready.birth,ownerArgv:[ps,'-NoProfile','-NonInteractive','-File',ownerFile,'-ManifestSha256',mh],clientArgv:[ps,'-NoProfile','-NonInteractive','-File',clientFile,'-ManifestSha256',mh],sources:rows.map(row=>({path:path.join(root,row.path),sha256:row.sha256}))};if(kind==='argv')plan.ownerArgv[1]='-NoLogo';fs.writeFileSync(path.join(root,'plan.json'),JSON.stringify(plan),{flag:'wx'});
 const owner=launch(ownerFile,mh);let ownerDone,clientDone;
 try{
  if(['pid','birth','source','argv','generation-mismatch'].includes(kind)){ownerDone=await owner.done;client.child.stdin.end('ABORT\n');clientDone=await client.done;}
  else{await owner.line('OWNER ');client.child.stdin.end('GO\n');[ownerDone,clientDone]=await Promise.all([owner.done,client.done]);}
 }finally{if(!client.child.stdin.destroyed)client.child.stdin.end('ABORT\n');await Promise.all([owner.done,client.done]);}
 fs.writeFileSync(path.join(root,'transport-results.json'),JSON.stringify({kind,owner:ownerDone,client:clientDone}),{flag:'wx'});
 assert.equal(ownerDone.code,0,root+'\n'+ownerDone.stderr);assert.equal(clientDone.code,0,root+'\n'+clientDone.stderr);
 const result=JSON.parse(fs.readFileSync(path.join(root,'owner-result.json'),'utf8'));assert.equal(result.nativeClosed,true,root);assert.equal(result.leaseClosed,true,root);assert.equal(result.mutexFree,true,root);
 if(['valid','lost-response','wire-nonce','copy','once'].includes(kind)){assert.equal(result.failure,null,root);assert.equal(result.phase,'Clean',root);assert.equal(result.cleanupReturned,true,root);const claim=JSON.parse(fs.readFileSync(path.join(audit,'claim.json'))),intent=JSON.parse(fs.readFileSync(path.join(audit,'intent.json'))),clean=JSON.parse(fs.readFileSync(path.join(audit,'clean.json')));assert.equal(intent.claimSha256,hash(fs.readFileSync(path.join(audit,'claim.json'))));assert.equal(clean.intentSha256,hash(fs.readFileSync(path.join(audit,'intent.json'))));assert.equal(clean.state,'NORMAL_CLEANUP_COMPLETED');const observed=JSON.parse(fs.readFileSync(path.join(root,'client-result.json')));assert.equal(observed.requests,1);assert.equal(observed.replays,0);assert.equal(observed.ownerExited,true);assert.equal(observed.ownerExitCode,0);assert.equal(claim.clientPid,ready.pid);if(kind==='lost-response'){assert.equal(observed.reply,'UNKNOWN');assert.equal(observed.readAck,false);}if(kind==='wire-nonce'){assert.equal(observed.invalidFrames,1);assert.equal(fs.readFileSync(path.join(root,'wire-rejected-live.json'),'utf8'),'true');}assert.equal(observed.mutexBusyBefore,true);assert.equal(observed.sameMutexReleased,true);assert.equal(observed.mutexAbandoned,false);assert.equal(observed.pendingRestartBlocked,true);if(kind==='copy')assert.equal(fs.readFileSync(path.join(root,'copies-rejected.json'),'utf8'),'true');if(kind==='once')assert.equal(fs.readFileSync(path.join(root,'once-rejected.json'),'utf8'),'true');}
 else{assert.equal(fs.readFileSync(path.join(root,'rejected-live.json'),'utf8'),'true',root);assert.equal(fs.existsSync(path.join(audit,'clean.json')),false,root);const expected={pid:'COOPERATIVE_EXIT_NATIVE_IDENTITY_CHANGED',birth:'COOPERATIVE_EXIT_NATIVE_IDENTITY_CHANGED',source:'COOPERATIVE_EXIT_SOURCE_CHANGED',argv:'COOPERATIVE_EXIT_ARGV_CHANGED','generation-mismatch':'COOPERATIVE_EXIT_FRESH_ROOT_REQUIRED','intent-failure':'OWNED_WEB_CHILD_EXITED','admission-expiry':'OWNED_WEB_CHILD_EXITED'}[kind];assert(result.failure?.includes(expected),root+' '+result.failure);if(kind==='intent-failure'){assert.equal(result.phase,'IntentUnknown');assert.equal(fs.readFileSync(path.join(audit,'intent.json'),'utf8'),'foreign-intent');}}
 return root;
}
for(const kind of['valid','lost-response','wire-nonce','copy','once','pid','birth','source','argv','generation-mismatch','admission-expiry','intent-failure'])test('isolated genuine cooperative exit / '+kind+(kind==='admission-expiry'?' (aged issued ticks, no real 60s delay)':''),{skip:process.platform!=='win32',timeout:45000},()=>fixture(kind));
