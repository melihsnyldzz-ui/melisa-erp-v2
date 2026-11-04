import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import cp from 'node:child_process';import crypto from 'node:crypto';import net from 'node:net';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),json=o=>Buffer.from(JSON.stringify(o)),q=s=>"'"+s.replaceAll("'","''")+"'";
const names=[
        'business-5244-startup-exclusion.ps1',
        'start-business-5244-web.ps1',
        'business-5244-web-native.cs',
        'business-5244-retirement-channel.ps1',
        'business-5244-retirement-peer.cs',
        'business-5244-retirement-state.ps1',
        'business-5244-maintenance-dispatch.ps1',
        'start-business-5244-owned.ps1',
        'test125-bound-api-quiescence.ps1',
        'test125-bound-maintenance-plan.ps1',
        'start-owned-test.ps1',
        'canonical-business-sale-maintenance.ps1',
        'run-current-owner.ps1'
    ];
const sourcePath=path.join(dir,'business-5244-cold-current-recovery.cs');
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function manager(temp){
 const file=path.join(temp,'dead-owned.ps1');fs.writeFileSync(file,String.raw`$ErrorActionPreference='Stop';$all=@();try{1..3|ForEach-Object{$p=[Diagnostics.Process]::Start($env:ComSpec,'/c exit 0');[void]$p.Handle;$p.WaitForExit();$all+=,$p};$ids=@($all|ForEach-Object{$_.Id});foreach($p in $all){$p.Dispose()};$all=@();[Console]::WriteLine(($ids|ConvertTo-Json -Compress));[Console]::Out.Flush();[Console]::ReadLine()|Out-Null}finally{foreach($p in $all){$p.Dispose()}}`);
 const child=cp.spawn(ps,['-NoProfile','-NonInteractive','-File',file],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';child.stderr.on('data',b=>err+=b);
 const ids=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('OWN_DEAD_MANAGER_TIMEOUT '+err)),10000);child.stdout.on('data',b=>{out+=b;if(out.includes('\n')){clearTimeout(t);resolve(JSON.parse(out.trim()));}});child.once('error',reject);});
 return {child,ids};
}
async function execute(kind){
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-cold-native-')));let m,blocker;
 try{
  m=await manager(temp);const port=await freePort();
  const core=path.join(temp,'core'),priv=path.join(temp,'private'),failed=path.join(temp,'failed'),runtime=path.join(temp,'runtime'),beforePath=path.join(temp,'before.json'),proof=path.join(priv,'owner-preparation'),ledger=path.join(priv,'recovery-once'),web=path.join(temp,'web'),node=process.execPath;
  for(const p of[core,priv,failed,runtime,proof,web,path.join(failed,'owner-preparation','install-once'),path.join(web,'apps','sites-workflow','node_modules','vite','bin')])fs.mkdirSync(p,{recursive:true});
  const fixtureWorker=path.join(web,'apps','sites-workflow','node_modules','vite','bin','vite.js');
  fs.writeFileSync(fixtureWorker,`const net=require('net');const servers=['127.0.0.1','127.0.0.2','127.0.0.3'].map(ip=>net.createServer().listen(${port},ip));process.stdin.on('end',()=>{for(const server of servers)server.close();});process.stdin.resume();`);
  const webBytes=json({fixture:true});fs.writeFileSync(path.join(web,'release-manifest.json'),webBytes);
  const entries=Array.from({length:56},(_,i)=>{const p=path.join(temp,'entries','entry-'+i+'.ps1');fs.mkdirSync(path.dirname(p),{recursive:true});const b=Buffer.from('own-inert-entry-'+i);fs.writeFileSync(p,b);return {path:p,sha256:hash(b)};});
  const beforeBytes=json({entries:kind==='count'?entries.slice(1):entries});fs.writeFileSync(beforePath,beforeBytes);
  const failureBytes=json({status:'FAILED_REVIEW_RECEIPT',scope:'TEST125-API-B6-WRITER-20261029',stopCalls:0,startCalls:0,retireAttempts:0,apiRestarts:0,taskChanges:0,profileWrites:0,sqlWrites:0});
  const markerBytes=json({schema:'business-5244-cold-handoff.pending.v1',controllerPid:kind==='lineage'?m.ids[0]+1:m.ids[0],controllerBirth:'134380102437098616',ownerPid:m.ids[1],ownerBirth:'134379216568450543',entries:[entries[0]],operationId:'a'.repeat(32)});
  const readbackBytes=json({installResultSha256:hash(failureBytes),markerSha256:hash(markerBytes),oldOwnerPresent:false,oldChildPresent:false,controllerPresent:false,webListenerCount:0});
  const summaryBytes=json({receiptSha256:hash(failureBytes),markerSha256:hash(markerBytes),protectedReadbackSha256:hash(readbackBytes),newOwnerStarts:0,retireAttempts:0,apiRestarts:0,sqlWrites:0,taskChanges:0,configChanges:0,salesPostCount:0,secondInstallerCalls:0,installed:false,rollbackComplete:false});
  fs.writeFileSync(path.join(failed,'owner-preparation','install-once','result.json'),failureBytes);fs.writeFileSync(path.join(failed,'runtime-failure-readback-1216.json'),readbackBytes);fs.writeFileSync(path.join(failed,'install-attempt-summary-1216.json'),summaryBytes);fs.writeFileSync(path.join(runtime,'5244-retirement.pending'),markerBytes);
  const nativeFile=path.join(proof,'business-5244-cold-current-recovery.cs'),entry=path.join(core,'run-current-owner.ps1');
  const positive=String.raw`
$c=[Business5244ColdCurrentRecovery]::Prepare();$c.ValidatePrepared();if([ColdFixtureProbe]::Foreign($c)-cne'COLD_CURRENT_FOREIGN_CAPABILITY'){throw 'FOREIGN_THREAD_ALLOWED'}
$denied=$false;try{[IO.File]::WriteAllText(__ENTRY0__,'bad')}catch{$denied=$true};if(!$denied){throw 'EXCLUSIVE_ENTRY_NOT_HELD'}
$c.ArchiveOnce();$c.ValidateArchived();if((Test-Path __MARKER__)-or!(Test-Path __ARCHIVED__)){throw 'ARCHIVE_NOT_EXACT'}
$denied=$false;try{$c.ArchiveOnce()}catch{if(!$_.Exception.ToString().Contains('COLD_CURRENT_NOT_PREPARED')){throw};$denied=$true};if(!$denied){throw 'ARCHIVE_REPLAY_ALLOWED'}
$denied=$false;try{$c.Dispose()}catch{if(!$_.Exception.ToString().Contains('COLD_CURRENT_ARCHIVED_SAFETY_HOLDS_RETAINED')){throw};$denied=$true};if(!$denied){throw 'ARCHIVED_GATES_DISPOSED'}
$normal=[Threading.Mutex]::OpenExisting($gateName);if(!$normal.WaitOne(0)){throw 'NORMAL_RECURSIVE_ACQUIRE_FAILED'}
$denied=$false;$foreign=[Threading.Mutex]::new($false,($gateName+'-foreign'));try{$c.IssueOwnerLeaseWitness($foreign)|Out-Null}catch{$denied=$true}finally{$foreign.Dispose()};if(!$denied){throw 'FOREIGN_MUTEX_ACCEPTED'}
$w=$c.IssueOwnerLeaseWitness($normal);$normal.ReleaseMutex();$w.ValidateActive()
$forged=[Runtime.Serialization.FormatterServices]::GetUninitializedObject([Business5244ColdCurrentRecovery+OwnerLeaseWitness]);$denied=$false;try{$c.ReleaseSafetyHoldsAfterCurrentReady($forged,1,'1')}catch{if(!$_.Exception.ToString().Contains('COLD_CURRENT_OWNER_WITNESS_REQUIRED')){throw};$denied=$true};if(!$denied){throw 'FORGED_WITNESS_ALLOWED'}
$si=[Diagnostics.ProcessStartInfo]::new(__NODE__,('"'+__WORKER__+'" preview --host 127.0.0.1 --port __PORT__ --strictPort'));$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$si.RedirectStandardInput=$true;$child=[Diagnostics.Process]::Start($si);[void]$child.Handle
try{
 $ready=$false;for($i=0;$i-lt50;$i++){try{$c.ReleaseSafetyHoldsAfterCurrentReady($w,$child.Id,$child.StartTime.ToFileTimeUtc().ToString());$ready=$true;break}catch{if(!$_.Exception.ToString().Contains('COLD_CURRENT_CURRENT_LISTENERS_CHANGED')){throw}};Start-Sleep -Milliseconds 50};if(!$ready){throw 'OWN_CHILD_NOT_READY'}
 $w.ValidateActive();$readyPath=Join-Path __LEDGER__ 'current-ready.json';if(!$c.ReadyResultSha256-or![IO.File]::Exists($readyPath)){throw 'DURABLE_CURRENT_READY_MISSING'};$ser=[Web.Script.Serialization.JavaScriptSerializer]::new();$ready=$ser.DeserializeObject([IO.File]::ReadAllText($readyPath));if($ready['schema']-cne'melisa-b6-cold-current-ready.v1'-or$ready['childPid']-ne$child.Id-or$ready['childBirth']-cne$child.StartTime.ToFileTimeUtc().ToString()-or$ready['archived']-cne$true-or$ready['currentOnly']-cne$true-or$ready['candidate']-cne$false-or$ready['apiTransition']-cne$false-or$ready['sqlWrites']-ne0-or$ready['taskChanges']-ne0){throw 'DURABLE_CURRENT_READY_FALSE_SCOPE'}
 $c.AssertNormalExitBinding($w,$child.Id,$child.StartTime.ToFileTimeUtc().ToString());if($c.NormalExitCleanupComplete){throw 'PREMATURE_COLD_CLEANUP_PROOF'}
 foreach($bad in @({$c.AssertNormalExitBinding($forged,$child.Id,$child.StartTime.ToFileTimeUtc().ToString())},{$c.AssertNormalExitBinding($w,($child.Id+1),$child.StartTime.ToFileTimeUtc().ToString())},{$c.AssertNormalExitBinding($w,$child.Id,'1')})){$denied=$false;try{& $bad}catch{if(!$_.Exception.ToString().Contains('COLD_CURRENT_NORMAL_EXIT_BINDING_REQUIRED')){throw};$denied=$true};if(!$denied){throw 'FOREIGN_NORMAL_EXIT_BINDING_ALLOWED'}}
 [IO.File]::WriteAllText(__ENTRY0__,'released-after-current-ready');$c.Dispose();if(!$c.NormalExitCleanupComplete){throw 'COLD_CLEANUP_PROOF_MISSING'};$w.ValidateActive()
 if([ColdFixtureProbe]::Free($gateName)){throw 'OWNER_GATE_GAP'}
 $testRetain=[Threading.Mutex]::OpenExisting($gateName);try{$normal.Dispose();$w.Close();if(![ColdFixtureProbe]::Free($gateName)){throw 'WITNESS_NOT_RELEASED'}}finally{$testRetain.Dispose()}
}finally{$child.StandardInput.Close();if(!$child.WaitForExit(5000)){throw 'COLD_FIXTURE_NORMAL_CHILD_EXIT_UNCONFIRMED'};if($child.ExitCode-ne0){throw 'COLD_FIXTURE_NORMAL_CHILD_EXIT_FAILED'};$child.Dispose()}
'PASS'
`;
  const collisionStart=positive.indexOf(' $ready=$false;for'),collisionEnd=positive.indexOf('}finally{$child.StandardInput.Close()');
  assert(collisionStart>=0&&collisionEnd>collisionStart);
  const collision=positive.slice(0,collisionStart)+String.raw`
 [IO.File]::WriteAllText((Join-Path __LEDGER__ 'current-ready.json'),'foreign-ready')
 $denied=$false;for($i=0;$i-lt50;$i++){try{$c.ReleaseSafetyHoldsAfterCurrentReady($w,$child.Id,$child.StartTime.ToFileTimeUtc().ToString())}catch{if($_.Exception.ToString().Contains('COLD_CURRENT_CURRENT_LISTENERS_CHANGED')){Start-Sleep -Milliseconds 50;continue};if($_.Exception.GetBaseException()-isnot[IO.IOException]){throw};$denied=$true;break}};if(!$denied-or$c.ReadyResultSha256-or[IO.File]::ReadAllText((Join-Path __LEDGER__ 'current-ready.json'))-cne'foreign-ready'){throw 'READY_COLLISION_OVERWRITTEN'}
 $locked=$false;try{[IO.File]::WriteAllText(__ENTRY0__,'bad')}catch{$locked=$true};if(!$locked-or[ColdFixtureProbe]::Free($gateName)){throw 'READY_FAILURE_RELEASED_SAFETY'};$w.ValidateActive()
 $retained=$false;try{$c.Dispose()}catch{if(!$_.Exception.ToString().Contains('COLD_CURRENT_ARCHIVED_SAFETY_HOLDS_RETAINED')){throw};$retained=$true};if(!$retained){throw 'READY_FAILURE_DISPOSED'}
`+positive.slice(collisionEnd);
  const expected={entry:'COLD_CURRENT_CONTENT_CHANGED',before:'COLD_CURRENT_CONTENT_CHANGED',marker:'COLD_CURRENT_CONTENT_CHANGED',live:'COLD_CURRENT_OLD_PID_PRESENT_OR_REUSED',count:'COLD_CURRENT_BEFORE_ENTRIES',lineage:'COLD_CURRENT_MARKER_LINEAGE',port:'COLD_CURRENT_PORT_OCCUPIED_OR_FOREIGN',once:'COLD_CURRENT_ONCE_DIRECTORY_EXISTS_OR_UNAVAILABLE',closed:'COLD_CURRENT_ENTRY_PIN_NOT_BOUND'}[kind];
  let body=kind==='valid'?positive:kind==='readyexists'?collision:`$c=$null;$errorText=$null;try{$c=[Business5244ColdCurrentRecovery]::Prepare()}catch{$errorText=$_.Exception.ToString()};if(!$errorText-or!$errorText.Contains('${expected}')){throw ('EXPECTED_BASELINE_${kind} '+$errorText)};if(Test-Path ${q(path.join(ledger,'archive-attempt.json'))}){throw 'FAILED_PREPARE_MUTATED_ARCHIVE'};'PASS'`;
  for(const [key,value]of Object.entries({ENTRY0:q(entries[0].path),MARKER:q(path.join(runtime,'5244-retirement.pending')),ARCHIVED:q(path.join(ledger,'5244-retirement.pending.archived')),NODE:q(node),WORKER:q(fixtureWorker),PORT:String(port),LEDGER:q(ledger)}))body=body.replaceAll('__'+key+'__',value);
  const gatePrefix='Local'+String.fromCharCode(92,92)+'ColdNative-'+crypto.randomUUID()+'-';
  const controller=`$ErrorActionPreference='Stop';Add-Type -LiteralPath ${q(nativeFile)} -ReferencedAssemblies System.Web.Extensions,System.Management\n$runtime=${q(runtime)};$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$sha=[Security.Cryptography.SHA256]::Create();try{$rh=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($runtime.ToLowerInvariant()))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()};$gateName='${gatePrefix.replaceAll(String.fromCharCode(92,92),String.fromCharCode(92)) }'+$sid+'-'+$rh\n`+body;
  fs.writeFileSync(entry,controller);const entryHash=hash(Buffer.from(controller));
  let native=fs.readFileSync(sourcePath,'utf8');
  const stringConstant=(name,value)=>{const re=new RegExp('(const string '+name+'=@")([^"\\n]*)(";)');assert(re.test(native),name);native=native.replace(re,(_,a,_b,c)=>a+value+c);};
  for(const [key,value]of Object.entries({Core:core,PrivateRoot:priv,FailedRoot:failed,BeforePath:beforePath,Runtime:runtime,Ps5:ps,Node:node,WebRoot:web}))stringConstant(key,value);
  native=native.replace('Global\\\\MelisaERP5244Startup-',gatePrefix).replace('100.87.188.3|127.0.0.1|192.168.1.46','127.0.0.1|127.0.0.2|127.0.0.3');
  const sid=cp.execFileSync(ps,['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true}).trim();native=native.replace('S-1-5-21-2170750028-1005938530-2568122015-1001',sid);
  const original={BeforeHash:hash(beforeBytes),FailureHash:hash(failureBytes),MarkerHash:hash(markerBytes),ReadbackHash:hash(readbackBytes),SummaryHash:hash(summaryBytes),NodeHash:hash(fs.readFileSync(node)),WebHash:hash(webBytes),ExpectedEntryHash:kind==='closed'?'0'.repeat(64):entryHash};
  for(const [name,value]of Object.entries(original)){const re=new RegExp('('+name+'=")[a-f0-9]{64}(";)??');native=native.replace(re,(_,a,b)=>a+value+(b??''));}
  native=native.replace('DeadController=2696,DeadOwner=33080,DeadChild=7052,Port=5244',`DeadController=${kind==='live'?m.child.pid:m.ids[0]},DeadOwner=${m.ids[1]},DeadChild=${m.ids[2]},Port=${port}`);
  native+='\npublic static class ColdFixtureProbe { public static string Foreign(Business5244ColdCurrentRecovery c){return System.Threading.Tasks.Task.Run(()=>{try{c.ValidatePrepared();return \"ALLOWED\";}catch(System.Exception e){return e.Message;}}).GetAwaiter().GetResult();} public static bool Free(string name){return System.Threading.Tasks.Task.Run(()=>{using(var m=System.Threading.Mutex.OpenExisting(name)){bool held=m.WaitOne(0);if(held)m.ReleaseMutex();return held;}}).GetAwaiter().GetResult();} }';
  fs.writeFileSync(nativeFile,native);
  const row=p=>({path:path.basename(p),sha256:hash(fs.readFileSync(p)),bytes:fs.statSync(p).size});
  for(const n of names)if(n!=='run-current-owner.ps1')fs.writeFileSync(path.join(core,n),'inert fixed fixture closure '+n);
  fs.writeFileSync(path.join(proof,'recover-business-5244-current-web.ps1'),controller);fs.writeFileSync(path.join(proof,'prepare-business-5244-cold-current-recovery.mjs'),'inert fixture producer');
  const sources={schema:'melisa-b6-cold-current-sources.v1',sourceCommit:'a'.repeat(40),entrySha256:entryHash,producerSha256:hash(fs.readFileSync(path.join(proof,'prepare-business-5244-cold-current-recovery.mjs'))),nativeSha256:hash(fs.readFileSync(nativeFile)),files:['prepare-business-5244-cold-current-recovery.mjs','recover-business-5244-current-web.ps1','business-5244-cold-current-recovery.cs'].map(n=>row(path.join(proof,n)))};
  const sourcesBytes=json(sources);fs.writeFileSync(path.join(proof,'source-manifest.json'),sourcesBytes);const caseBytes=json({schema:'melisa-b6-cold-current-case.v1',id:'ERP-B6-CURRENT-WEB-RECOVERY-SOURCE-20261101-1258'});fs.writeFileSync(path.join(core,'cold-current-case.json'),caseBytes);
  const manifest={schema:'melisa-b6-cold-current-owner.v1',kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',root:core,coldRecoveryCaseId:'ERP-B6-CURRENT-WEB-RECOVERY-SOURCE-20261101-1258',finiteScope:'TEST125-API-B6-WRITER-20261029',maintenancePurpose:'ColdCurrentWebRecovery',sourceCommit:'a'.repeat(40),entrySha256:entryHash,files:names.map(n=>row(path.join(core,n))),coldCurrentCase:{path:'cold-current-case.json',sha256:hash(caseBytes)},recoverySources:{root:proof,sha256:hash(sourcesBytes)}};
  for(const f of['apiTransitionEnabled','readPairMaintenanceEnabled','actualT1','externalOperations','installed','applied','executionAuthority','admissionIssued','runtimeValidationComplete'])manifest[f]=false;
  const manifestBytes=json(manifest);fs.writeFileSync(path.join(core,'owner-manifest.json'),manifestBytes);
  if(kind==='entry')fs.appendFileSync(entry,'\n# changed');if(kind==='before')fs.appendFileSync(beforePath,' ');if(kind==='marker')fs.appendFileSync(path.join(runtime,'5244-retirement.pending'),' ');
  if(kind==='once')fs.mkdirSync(ledger);
  if(kind==='port'){blocker=net.createServer();await new Promise(r=>blocker.listen(port,'127.0.0.1',r));}
  const result=cp.spawnSync(ps,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',entry,'-Apply','-ManifestSha256',hash(manifestBytes)],{encoding:'utf8',windowsHide:true,timeout:25000});
  assert.equal(result.status,0,result.stderr+'\n'+result.stdout);assert.match(result.stdout,/PASS\s*$/);
 }finally{
  if(blocker)await new Promise(r=>blocker.close(r));
  if(m){m.child.stdin.end();await new Promise(r=>{if(m.child.exitCode!==null)r();else m.child.once('close',r);});}
  const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('b6-cold-native-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true});
 }
}
for(const kind of['valid','readyexists','entry','before','marker','live','count','lineage','port','once','closed'])test('finite cold native production body on owned temp OS boundary: '+kind,{skip:process.platform!=='win32',timeout:40000},()=>execute(kind));
