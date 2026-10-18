import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {assertPr54SharedProfile,admitPr54PrestartRecovery,comparePr54InvarianceSnapshots,PR54_PROTECT_SQL_CONNECTION} from './p03-pr54-shared-owner-io.mjs';
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
test('SQL protect-only connection retains exactly one instance separator',()=>{
 assert.equal(PR54_PROTECT_SQL_CONNECTION.split(';')[0],'Server=Semih\\MELISADEV');
 assert.equal(PR54_PROTECT_SQL_CONNECTION.split(';')[1],'Database=master');
 assert.equal(PR54_PROTECT_SQL_CONNECTION.match(/\\/g)?.length,1);
});
function fixture(){
 const owner='S-1-5-21-2170750028-1005938530-2568122015-1001',oldSha='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96',newSha='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071';
 const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];const plan={targets,oldSettingsSha256:oldSha,newSettingsSha256:newSha};plan.digest=p03TransitionDigest(plan);
 const before={schemaVersion:'melisa-p03-owner-observation.v3',ownerSid:owner,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',actualT1:false,plan,identities:Object.fromEntries(targets.map((r,i)=>[r,{pid:i+10,ownerSid:owner}])),profile:{erpSource:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',erpManifest:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7',crmSource:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',crmManifest:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83',supervisorSource:'13bdf75a032ae8f694354a2e57b6ed382aec2f17',supervisorManifest:'195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'}};
 const profile={schemaVersion:'melisa-p03-physical-profile.v1',ownerSid:owner,database:before.database,oldSettings:{sha256:oldSha},newSettings:{path:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json',sha256:newSha},tasks:['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'].map(name=>({name,oldXml:'old',oldXmlSha256:hash('old'),newXml:'new',newXmlSha256:hash('new')})),oldWatchers:[{},{}],protectedProcesses:[{pid:1,kind:'ProtectedSqlService'}],stopper:{path:'C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014\\stop-exact-observed-process.ps1',sha256:'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'}};
 return {profile,before};
}
test('shared admission binds exact e59/13b/be8/new settings and excludes protected SQL from targets',()=>{
 const f=fixture();assert.equal(assertPr54SharedProfile(f.profile,f.before),true);
 for(const change of [x=>x.profile.environment='P03_REHEARSAL',x=>x.before.profile.erpSource='c88d7010f8318b088c73201585a254f8975c650d',x=>x.profile.newSettings.sha256='0'.repeat(64),x=>x.profile.tasks[0].newXml+='x',x=>x.profile.protectedProcesses[0].pid=x.before.identities.hub.pid]){const bad=fixture();change(bad);assert.throws(()=>assertPr54SharedProfile(bad.profile,bad.before));}
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
