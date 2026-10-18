import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {assertPr54SharedProfile,admitPr54PrestartRecovery,classifyPr54Auxiliary,selectPr54CandidateProcesses,comparePr54InvarianceSnapshots,PR54_PROTECT_SQL_CONNECTION} from './p03-pr54-shared-owner-io.mjs';
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';
import {assertPr54WriteScope,pr54ProtectedWriteProgram} from './p03-pr54-shared-owner-io.mjs';
import {pr54SafeFailure,pr54StopObservationSummary} from './p03-pr54-shared-owner-io.mjs';
import {diagnosePr54PausedOld} from './p03-pr54-shared-owner-io.mjs';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
test('paused old read-only diagnosis uses durable captured identities without invented admittedOld',()=>{const f=prestartFixture();f.current.runningInstances=[];f.current.tasks.forEach(t=>{t.state=3;t.xml='old';});f.current.processes=f.current.processes.filter(p=>!f.profile.oldWatchers.some(w=>w.pid===p.pid));f.current.bindings=f.current.bindings.filter(b=>f.current.processes.some(p=>p.pid===b.pid));const good=diagnosePr54PausedOld(f);assert.equal(good.mutationAuthorized,false);assert.equal(good.requiresDurableJournalProof,true);for(const change of [x=>x.current.processes[0].creationTime='2026-10-18T10:00:00.1234568Z',x=>x.current.tasks[0].xml='new',x=>x.current.processes.push({...x.current.processes[0],pid:999}),x=>x.current.bindings.push({pid:999,port:4184,address:'127.0.0.1'})]){const bad=structuredClone(f);change(bad);assert.throws(()=>diagnosePr54PausedOld(bad));}});
test('stop diagnostics disclose only fixed codes and identity counts without raw command lines',()=>{assert.equal(pr54SafeFailure({message:'private P03_SHARED_OBSERVER_STDERR secret'}),'P03_SHARED_OBSERVER_STDERR');assert.equal(pr54SafeFailure({message:'private',code:'ETIMEDOUT'}),'ETIMEDOUT');assert.equal(pr54SafeFailure({message:'private token'}),'UNCLASSIFIED_IO_FAILURE');const f=prestartFixture();f.current.processes[0].commandLine='watch-terminal-completion-logon.ps1 private-sentinel';const summary=pr54StopObservationSummary(f.current,f.before,f.profile);assert.equal(summary.watcherMatches.length,1);assert.ok(!JSON.stringify(summary).includes('private-sentinel'));assert.ok(!JSON.stringify(summary).includes('commandLine'));});
test('callback failure diagnostic preserves first failure and uses create-only sanitized durable evidence',()=>{const source=fs.readFileSync(new URL('./p03-pr54-shared-owner-io.mjs',import.meta.url),'utf8');assert.match(source,/lastCallbackFailure\?\?=\{callback:callbackName,reason:pr54SafeFailure\(error\),elapsedMs:/);assert.match(source,/protectedWrite\(path.win32.join\(transitionDir,'io-failure-diagnostic.json'\)/);assert.match(source,/recoveryReason:pr54SafeFailure\(recoveryError\)/);assert.doesNotMatch(source,/jsonBytes\(error\)|JSON.stringify\(error\)/);});
test('protected writer transport keeps large payload out of command line, verifies hash and strict ACL and rejects overwrite',{skip:process.platform!=='win32'},()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'p03-writer-')),file=path.join(directory,'payload.bin'),bytes=crypto.randomBytes(256*1024),sha=hash(bytes);
 const invoke=(program,data)=>spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(program,'utf16le').toString('base64')],{input:data.toString('base64'),encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 // The runtime owner remains literal Xaser. Only the isolated test program uses
 // the runner's own SID, as Windows forbids assigning an unrelated account owner.
 const sidResult=invoke('[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',Buffer.alloc(0));assert.equal(sidResult.status,0);const currentSid=sidResult.stdout.trim();assert.match(currentSid,/^S-1-5-\d+(?:-\d+)+$/);
 const testProgram=target=>pr54ProtectedWriteProgram(target,sha).replaceAll('S-1-5-21-2170750028-1005938530-2568122015-1001',currentSid),code=testProgram(file);
 try{assert.ok(Buffer.from(code,'utf16le').toString('base64').length<16000);assert.ok(!code.includes(bytes.toString('base64')));const result=invoke(code,bytes);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/CREATED/);assert.equal(hash(fs.readFileSync(file)),sha);
 const expectedIds=['S-1-5-18',currentSid].sort().join('|');const check=`$a=Get-Acl -LiteralPath '${file.replaceAll("'","''")}';if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne'${currentSid}'-or@($a.Access).Count-ne2){exit 1};$ids=@($a.Access|ForEach-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value}|Sort-Object);if(($ids-join'|')-cne'${expectedIds}'){exit 2}`;assert.equal(invoke(check,Buffer.alloc(0)).status,0);
 assert.notEqual(invoke(code,bytes).status,0);assert.equal(hash(fs.readFileSync(file)),sha);const wrong=path.join(directory,'wrong.bin');assert.notEqual(invoke(testProgram(wrong),Buffer.from('changed')).status,0);assert.equal(fs.existsSync(wrong),false);
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(directory);}
});
test('writer rejects paths outside finite owner scope and traversal before mutation',()=>{const root='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018',dir=root+'\\MelisaERP-P03-transition-'+'a'.repeat(32),lock=root+'\\owner-transition.lock';assert.doesNotThrow(()=>assertPr54WriteScope(dir+'\\engine.ps1',dir,lock));for(const file of ['C:\\foreign\\engine.ps1',dir+'\\..\\escape',dir+'evil\\engine.ps1'])assert.throws(()=>assertPr54WriteScope(file,dir,lock));});
function auxiliary(parent){return {pid:900,parentPid:parent.pid,ownerSid:parent.ownerSid,nodePath:'C:\\Windows\\System32\\conhost.exe',commandLine:'\\??\\C:\\WINDOWS\\system32\\conhost.exe 0x4',creationTime:'2026-10-18T10:00:01.1234567Z',bindings:[]};}
test('only bounded console auxiliary with exact parent owner birth and no listener is preliminary classified',()=>{
 const parent={pid:500,ownerSid:'S-1-5-21-2170750028-1005938530-2568122015-1001',creationTime:'2026-10-18T10:00:00.1234567Z'},a=auxiliary(parent);
 assert.equal(classifyPr54Auxiliary(a,[parent],[]),true);
 assert.equal(classifyPr54Auxiliary({...a,nodePath:'C:\\WINDOWS\\system32\\conhost.exe'},[parent],[]),true);
 for(const change of [p=>p.nodePath='C:\\foreign\\conhost.exe',p=>p.commandLine+=' foreign',p=>p.ownerSid='S-1-5-18',p=>p.parentPid=999,p=>p.creationTime='2026-10-18T10:00:00.1234566Z',p=>p.bindings=[{port:1}]]){const bad=structuredClone(a);change(bad);assert.equal(classifyPr54Auxiliary(bad,[parent],[]),false);}
 assert.equal(classifyPr54Auxiliary(a,[parent],[{pid:a.pid,port:1}]),false);
 const main={...parent,nodePath:'node.exe',commandLine:'node.exe exact'},profile={protectedProcesses:[],candidateRules:[{role:'erpApi',nodePath:main.nodePath,commandLine:main.commandLine}]};
 assert.equal(selectPr54CandidateProcesses({processes:[main,a],bindings:[]},profile).length,1);
 assert.throws(()=>selectPr54CandidateProcesses({processes:[main,{...a,commandLine:'foreign'}],bindings:[]},profile));
});
test('ten exact applications plus actual CIM-cased console selects ten and rejects unknown siblings',()=>{
 const ownerSid='S-1-5-21-2170750028-1005938530-2568122015-1001';
 const apps=Array.from({length:10},(_,i)=>({pid:500+i,parentPid:499,nodePath:'C:\\pinned\\node.exe',ownerSid,commandLine:'node.exe exact-'+i,creationTime:'2026-10-18T10:00:00.1234567Z'}));
 const profile={protectedProcesses:[],candidateRules:apps.map((p,i)=>({role:'role'+i,nodePath:p.nodePath,commandLine:p.commandLine}))};
 const console={...auxiliary(apps[0]),nodePath:'C:\\WINDOWS\\system32\\conhost.exe'},seen={processes:[...apps,console],bindings:[]};
 assert.equal(selectPr54CandidateProcesses(seen,profile).length,10);
 assert.throws(()=>selectPr54CandidateProcesses({...seen,processes:[...seen.processes,{...console,pid:901,nodePath:'C:\\other\\conhost.exe'}]},profile));
});
test('prestart auxiliary must retain admitted identity and currently captured old parent',()=>{
 const f=prestartFixture(),a=auxiliary(f.current.processes[0]);f.current.processes.push(a);f.admittedOld.processes=structuredClone(f.current.processes);assert.equal(admitPr54PrestartRecovery(f),true);
 for(const change of [x=>x.current.processes.at(-1).creationTime='2026-10-18T10:00:01.1234568Z',x=>x.current.processes.at(-1).parentPid=999,x=>x.current.processes.at(-1).commandLine+=' foreign',x=>x.current.processes.shift(),x=>x.admittedOld.processes.pop()]){const bad=structuredClone(f);change(bad);assert.throws(()=>admitPr54PrestartRecovery(bad));}
});
test('SQL protect-only connection retains exactly one instance separator',()=>{
 assert.equal(PR54_PROTECT_SQL_CONNECTION.split(';')[0],'Server=Semih\\MELISADEV');
 assert.equal(PR54_PROTECT_SQL_CONNECTION.split(';')[1],'Database=master');
 assert.equal(PR54_PROTECT_SQL_CONNECTION.match(/\\/g)?.length,1);
});
function fixture(){
 const owner='S-1-5-21-2170750028-1005938530-2568122015-1001',oldSha='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96',newSha='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071';
 const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];const plan={targets,oldSettingsSha256:oldSha,newSettingsSha256:newSha};plan.digest=p03TransitionDigest(plan);
 const before={runId:'a'.repeat(32),schemaVersion:'melisa-p03-owner-observation.v3',ownerSid:owner,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',actualT1:false,plan,identities:Object.fromEntries(targets.map((r,i)=>[r,{pid:i+10,ownerSid:owner}])),profile:{erpSource:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',erpManifest:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7',crmSource:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',crmManifest:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83',supervisorSource:'13bdf75a032ae8f694354a2e57b6ed382aec2f17',supervisorManifest:'195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'}};
 const profile={journalDirectory:'C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-'+'a'.repeat(32),beforeImage:{path:'C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-'+'a'.repeat(32)+'.json',sha256:'f'.repeat(64)},schemaVersion:'melisa-p03-physical-profile.v1',ownerSid:owner,database:before.database,oldSettings:{sha256:oldSha},newSettings:{path:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json',sha256:newSha},tasks:['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'].map(name=>({name,oldXml:'old',oldXmlSha256:hash('old'),newXml:'new',newXmlSha256:hash('new')})),oldWatchers:[{},{}],protectedProcesses:[{pid:1,kind:'ProtectedSqlService'}],stopper:{path:'C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-stopper-'+'a'.repeat(32)+'.ps1',sha256:'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'}};
 return {profile,before};
}
test('shared admission binds exact e59/13b/be8/new settings and excludes protected SQL from targets',()=>{
 const f=fixture();assert.equal(assertPr54SharedProfile(f.profile,f.before),true);
 for(const change of [x=>x.profile.environment='P03_REHEARSAL',x=>x.before.profile.erpSource='c88d7010f8318b088c73201585a254f8975c650d',x=>x.profile.newSettings.sha256='0'.repeat(64),x=>x.profile.tasks[0].newXml+='x',x=>x.profile.protectedProcesses[0].pid=x.before.identities.hub.pid,x=>x.profile.stopper.path='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014\\stop-exact-observed-process.ps1',x=>x.profile.stopper.path=x.profile.stopper.path.replace('a'.repeat(32),'b'.repeat(32)),x=>x.before.runId='b'.repeat(32)]){const bad=fixture();change(bad);assert.throws(()=>assertPr54SharedProfile(bad.profile,bad.before));}
});
test('owner envelope accepts only the canonical runtime root and the same run recovery directory',()=>{
 for(const change of [f=>f.profile.beforeImage.path=f.profile.beforeImage.path.replace('C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018','C:\\Users\\Xaser\\AppData\\Local'),f=>f.profile.stopper.path=f.profile.stopper.path.replace('P03-OWNER-20261018','P03-OWNER-20261018-other'),f=>f.profile.journalDirectory=f.profile.journalDirectory.replace('a'.repeat(32),'b'.repeat(32)),f=>f.profile.journalDirectory=f.profile.journalDirectory.replace('P03-OWNER-20261018','terminal-completion-logon')]){const bad=fixture();change(bad);assert.throws(()=>assertPr54SharedProfile(bad.profile,bad.before));}
 const source=fs.readFileSync(new URL('./p03-pr54-shared-owner-io.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/AppData|LocalCache/);
});
function prestartFixture(){
 const f=fixture(),identity=(pid,port)=>({pid,parentPid:2,nodePath:'C:\\node.exe',ownerSid:f.before.ownerSid,commandLine:'node role-'+pid,creationTime:'2026-10-18T10:00:00.1234567Z',bindings:port?[{port,address:'127.0.0.1'}]:[]});
 f.before.identities=Object.fromEntries(f.before.plan.targets.map((role,i)=>[role,identity(10+i,i===0?5234:null)]));f.profile.oldWatchers=[identity(20),identity(21)];
 const instances=f.profile.tasks.map((t,i)=>({name:t.name,path:'\\'+t.name,instanceGuid:'guid-'+i,enginePid:20+i,state:4}));
 f.admittedOld={runningInstances:structuredClone(instances)};
 f.current={tasks:f.profile.tasks.map(t=>({name:t.name,state:4,xml:t.oldXml})),runningInstances:instances,processes:structuredClone([...Object.values(f.before.identities),...f.profile.oldWatchers]),bindings:[{pid:10,port:5234,address:'127.0.0.1'}]};return f;
}
test('preSTART recovery admits only remaining captured old processes and exact old COM instances',()=>{
 const full=prestartFixture();assert.equal(admitPr54PrestartRecovery(full),true);
 const partial=prestartFixture();partial.current.runningInstances=[];partial.current.tasks.forEach(t=>{t.state=3;t.xml='new';});partial.current.processes=partial.current.processes.slice(0,2);assert.equal(admitPr54PrestartRecovery(partial),true);
 const empty=prestartFixture();empty.current.runningInstances=[];empty.current.tasks.forEach(t=>t.state=3);empty.current.processes=[];empty.current.bindings=[];assert.equal(admitPr54PrestartRecovery(empty),true);
});
test('preSTART recovery rejects PID reuse, foreign processes/listeners, action drift and ambiguous COM identity',()=>{
 for(const change of [f=>f.current.processes[0].creationTime='2026-10-18T10:00:00.1234568Z',f=>f.current.processes[0].commandLine+=' foreign',f=>f.current.processes.push({...f.current.processes[0],pid:999}),f=>f.current.bindings[0].pid=999,f=>f.current.bindings[0].address='0.0.0.0',f=>f.current.tasks[0].xml='foreign',f=>f.current.tasks[0].state=2,f=>f.current.runningInstances[0].instanceGuid='new-instance',f=>f.current.runningInstances[0].enginePid=999,f=>f.current.runningInstances.push({...f.current.runningInstances[0]})]){const bad=prestartFixture();change(bad);assert.throws(()=>admitPr54PrestartRecovery(bad));}
});
test('invariance compares actual 51-table readonly-clone snapshots, including non-row metadata',()=>{
 const pre={database:'MELISA_ERP_P03_PR54_PRE_20261018',tables:Array.from({length:51},(_,i)=>({table:'t'+i,count:1,sha256:hash('row'+i)})),modules:[{name:'m',sha256:hash('m')}],permissions:[{permission:'SELECT'}],memberships:[{role:'reader'}],principals:[{name:'p'}]};const post={...structuredClone(pre),database:'MELISA_ERP_P03_PR54_POST_20261018'};
 assert.equal(comparePr54InvarianceSnapshots(pre,post).equal,true);
 for(const change of [x=>x.tables[1].sha256=hash('changed'),x=>x.tables[2].count++,x=>x.modules[0].sha256=hash('changed'),x=>x.permissions.push({permission:'INSERT'}),x=>x.memberships=[],x=>x.principals=[],x=>x.database=pre.database]){const bad=structuredClone(post);change(bad);assert.throws(()=>comparePr54InvarianceSnapshots(pre,bad));}
});
test('real adapter is read only by default, freezes helpers and gates success on physical readback and actual Post capture',()=>{
 const source=fs.readFileSync(new URL('./p03-pr54-shared-owner-io.mjs',import.meta.url),'utf8');
 assert.match(source,/mode='DryRun'/);assert.match(source,/if\(mode==='DryRun'\)return/);assert.match(source,/SAME_REHEARSED_ENGINE_REQUIRED/);
 assert.match(source,/useFrozenEngine\('StopNew'/);assert.match(source,/useFrozenEngine\('RollbackOld'/);assert.match(source,/useFrozenEngine\('PreflightNew'/);
 assert.match(source,/ready\.stableSeconds>=30&&ready\.mutationExecuted===false/);
 assert.match(source,/noReparseAncestors\(transitionDir\);await ps/);assert.match(source,/noReparseAncestors\(file\);/);assert.match(source,/\$\{psNoReparse\}if\(Test-Path/);
 assert.match(source,/SERVERPROPERTY\('ServerName'\)/);assert.match(source,/DB_NAME\(\)/);assert.match(source,/SQL_MASTER_IDENTITY/);
 assert.doesNotMatch(source,/seen\.bindings\.length===8/);
 assert.match(source,/FileMode\]::CreateNew/);assert.match(source,/\.Flush\(\$true\)/);assert.match(source,/'-Mode','Capture','-Phase','Post'/);assert.match(source,/comparePr54InvarianceSnapshots\(pre,/);
 assert.doesNotMatch(source,/SERIALIZABLE|TABLOCK|HOLDLOCK|Set-ExecutionPolicy|DROP DATABASE|DELETE FROM/);
 assert.match(source,/if\(taskStopAttempted&&!startAttempted\)/);assert.match(source,/candidate\.value\.processes\.length===0&&candidate\.value\.receipts\.length===0/);
 assert.match(source,/PRESTART_EXACT_OLD_DRAIN_THEN_REVIEWED_ENGINE/);assert.match(source,/PRESTART_RECOVERY_REFUSED/);
});
