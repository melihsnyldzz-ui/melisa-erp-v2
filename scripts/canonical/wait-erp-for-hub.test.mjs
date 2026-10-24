import test from 'node:test';import assert from 'node:assert/strict';
import {waitForErpBeforeHub,runErpHubBarrier,assertErpHubHealth,assertErpHubProfile,erpHubFailureMetadata} from './wait-erp-for-hub.mjs';
import {COMPLETION_CORE_STAGES,completionNodeArguments,completionProcessMatches} from './terminal-completion-logon.mjs';
import {crm06StaffSuccessorProfile,CRM06_STAFF_CURRENT_CRM_PACKAGE,CRM06_STAFF_CURRENT_ERP_PACKAGE} from './crm06-staff-refresh-successor.mjs';
const stages=[{name:'erpNative',ports:[4186]},{name:'erpApi',ports:[4184]}];
const make=()=>{
 const settings={ownerSid:'S-1-5-21-1-2-3-4',node:{path:'C:\\Program Files\\nodejs\\node.exe'}};
 const rows=stages.map((s,i)=>({pid:30+i,parentPid:20,creationTime:'2026-10-15T00:00:01.0000000Z',parentCreationTime:'2026-10-15T00:00:00.0000000Z',ownerSid:settings.ownerSid,nodePath:settings.node.path,commandLine:'pinned '+s.name,parentCommandLine:'pinned supervisor',bindings:[{address:'127.0.0.1',port:s.ports[0]}]}));
 const receipts=Object.fromEntries(stages.map((s,i)=>[s.name,{pid:30+i,parentPid:20,parentCreationTime:rows[i].parentCreationTime}]));
 let clock=0,sleeps=0;const calls=[];
 const input={settings,stages,now:()=>clock,sleep:async n=>{clock+=n;sleeps++;},probe:async()=>structuredClone(rows),receipt:async s=>structuredClone(receipts[s.name]),matches:(row,r,s)=>row.pid===r.pid&&row.commandLine==='pinned '+s.name&&row.parentPid===r.parentPid&&row.parentCreationTime===r.parentCreationTime,ready:async s=>{calls.push(s.name);return true;}};
 return {input,rows,receipts,calls,sleeps:()=>sleeps};
};
test('new Hub barrier waits through empty/partial startup and releases only after both current ERP identities and second fresh observation',async()=>{
 const f=make();let probes=0;f.input.probe=async()=>{probes++;return probes===1?[]:probes===2?[f.rows[0]]:structuredClone(f.rows);};const r=await waitForErpBeforeHub(f.input);assert.equal(r.ready,true);assert.equal(f.sleeps(),2);assert.equal(probes,4);assert.deepEqual(f.calls,['erpNative','erpApi']);assert.equal(r.coreSupervisorPid,20);assert.equal(r.erpNativePid,30);assert.equal(r.erpApiPid,31);
});
test('foreign owner or Node executable fails closed without touching readiness/start callbacks',async()=>{
 for(const patch of[{ownerSid:'S-1-5-18'},{nodePath:'C:\\foreign\\node.exe'}]){const f=make();Object.assign(f.rows[0],patch);await assert.rejects(waitForErpBeforeHub(f.input),{code:'ERP_HUB_WAIT_OWNER'});assert.deepEqual(f.calls,[]);assert.equal(f.sleeps(),0);}
});
test('stale receipt, mismatched parent generation and ambiguous bindings never release the barrier',async()=>{
 for(const mutate of[f=>{f.receipts.erpApi.pid=99;},f=>{f.rows[1].parentPid=21;f.receipts.erpApi.parentPid=21;},f=>{f.rows[1].parentCreationTime='2026-10-14T00:00:00.0000000Z';f.receipts.erpApi.parentCreationTime=f.rows[1].parentCreationTime;},f=>{f.rows[0].bindings.push({address:'127.0.0.1',port:4184});}]){const f=make();mutate(f);await assert.rejects(waitForErpBeforeHub(f.input),e=>['ERP_HUB_WAIT_IDENTITY','ERP_HUB_WAIT_PARENT','ERP_HUB_WAIT_OBSERVATION'].includes(e.code));assert.deepEqual(f.calls,[]);}
});
test('missing startup receipt waits and does not consume old Hub retry/start budget',async()=>{
 const f=make();let reads=0;f.input.receipt=async s=>{reads++;return reads===1?null:f.receipts[s.name];};await waitForErpBeforeHub(f.input);assert.equal(f.sleeps(),1);assert.deepEqual(f.calls,['erpNative','erpApi']);
});
test('ERP health not ready waits; fresh observations and both readiness results are required',async()=>{
 const f=make();let health=0;f.input.ready=async s=>{health++;f.calls.push(s.name);return health!==1;};await waitForErpBeforeHub(f.input);assert.equal(f.sleeps(),1);assert.deepEqual(f.calls,['erpNative','erpNative','erpApi']);
});
test('reused child or parent identity between health and second snapshot is rejected',async()=>{
 for(const field of['pid','parentPid','creationTime','parentCreationTime','parentCommandLine']){const f=make();let reads=0;f.input.probe=async()=>{reads++;const rows=structuredClone(f.rows);if(reads===2)rows[0][field]=typeof rows[0][field]==='number'?999:'changed';return rows;};await assert.rejects(waitForErpBeforeHub(f.input),e=>['ERP_HUB_WAIT_IDENTITY','ERP_HUB_WAIT_CHANGED'].includes(e.code));}
});
test('OS observation errors and target-health denial propagate without retries or fallback',async()=>{
 for(const mode of['probe','ready']){const f=make();f.input[mode]=async()=>{throw Object.assign(Error('static'),{code:'FIXTURE_DENIED'});};await assert.rejects(waitForErpBeforeHub(f.input),{code:'FIXTURE_DENIED'});assert.equal(f.sleeps(),0);}
});
test('permanently absent prerequisites stop at the fixed deadline; no Hub start API exists',async()=>{
 const f=make();f.input.probe=async()=>[];f.input.sleep=async()=>{};let n=0;f.input.now=()=>n++*300001;await assert.rejects(waitForErpBeforeHub(f.input),{code:'ERP_HUB_WAIT_TIMEOUT'});assert.deepEqual(f.calls,[]);
});
test('unexpected port or third process is a closed observation error',async()=>{
 for(const change of[f=>f.rows.push({...f.rows[0],pid:99}),f=>f.rows[0].bindings[0].port=5234]){const f=make();change(f);await assert.rejects(waitForErpBeforeHub(f.input),e=>['ERP_HUB_WAIT_OWNER','ERP_HUB_WAIT_OBSERVATION'].includes(e.code));}
});
test('runtime entry rejects arbitrary config/receipt destinations before reading files or invoking an OS helper',async()=>{
 await assert.rejects(runErpHubBarrier({configPath:'C:\\foreign.json',configSha256:'0'.repeat(64),ownerSid:'S-1-5-21-1-2-3-4',receiptPath:'C:\\foreign.json'}),{code:'ERP_HUB_WAIT_REJECTED'});
});
test('health evidence preserves the full existing ERP isolated/nonprivileged execution contract',()=>{
 const settings={components:{erpApiNative:{sourceCommit:'a'.repeat(40)}},copyId:'copy',database:'DB02'},stage={component:'erpApiNative'};
 const h={ok:true,sourceCommit:'a'.repeat(40),copyId:'copy',databaseName:'DB02',actualT1:false,environment:'ISOLATED_TEST_COPY',externalOperations:false,automaticJobs:false,sysadmin:0,databaseControl:0,liveDatabaseAccess:0,originalDatabaseAccess:0};assert.equal(assertErpHubHealth(h,settings,stage),true);
 for(const [key,value]of Object.entries({environment:'LIVE',automaticJobs:true,sysadmin:1,databaseControl:1,liveDatabaseAccess:1,originalDatabaseAccess:1,externalOperations:true,actualT1:true,sourceCommit:'b'.repeat(40),copyId:'other',databaseName:'other',ok:false})){assert.throws(()=>assertErpHubHealth({...h,[key]:value},settings,stage),{code:'ERP_HUB_WAIT_TARGET'});const missing={...h};delete missing[key];assert.throws(()=>assertErpHubHealth(missing,settings,stage),{code:'ERP_HUB_WAIT_TARGET'});}
});
test('slow successful probes may not release Hub after the fixed deadline',async()=>{
 const f=make();let clock=0;f.input.now=()=>clock;f.input.ready=async()=>{clock=600001;return true;};await assert.rejects(waitForErpBeforeHub(f.input),{code:'ERP_HUB_WAIT_TIMEOUT'});
});

test('5ce Hub profile binds exact new config/source while preserving installed da82 rollback tuple',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\';
 const old=root+'settings-crm06-staff-da82fc6644c1-parent-probe.json',next=root+'settings-crm06-staff-5ce452b01ef2.json';
 const a='da82fc6644c1d9dba0c10eaa861773534d43c288',b='5ce452b01ef20fc84a09c52b78311db8eb1dd1d8';
 assert.equal(assertErpHubProfile(old,a),true);assert.equal(assertErpHubProfile(next,b),true);
 for(const [file,source]of [[old,b],[next,a],[next,b.toUpperCase()],[next.toUpperCase(),b],[root+'settings-crm06-staff-unknown.json',b],[root+'settings-crm06-staff-da82fc6644c1.json',a],[next,'f'.repeat(40)],[next,b.slice(0,12)]])assert.throws(()=>assertErpHubProfile(file,source),{code:'ERP_HUB_WAIT_REJECTED'});
});

test('final 5bcd Hub tuple rejects every preceding config/source cross-pair and case alias',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='5bcd5ad136ff7ca35d623d436b8724cc491641be',next=root+'settings-crm06-staff-5bcd5ad136ff.json';
 assert.equal(assertErpHubProfile(next,source),true);
 for(const [suffix,oldSource]of [['da82fc6644c1-parent-probe','da82fc6644c1d9dba0c10eaa861773534d43c288'],['5ce452b01ef2','5ce452b01ef20fc84a09c52b78311db8eb1dd1d8']]){
  const previous=root+'settings-crm06-staff-'+suffix+'.json';assert.equal(assertErpHubProfile(previous,oldSource),true);assert.throws(()=>assertErpHubProfile(previous,source),{code:'ERP_HUB_WAIT_REJECTED'});assert.throws(()=>assertErpHubProfile(next,oldSource),{code:'ERP_HUB_WAIT_REJECTED'});
 }
 for(const [file,s]of [[next.toUpperCase(),source],[next,source.toUpperCase()],[root+'settings-crm06-staff-unknown.json',source],[next,source.slice(0,12)]])assert.throws(()=>assertErpHubProfile(file,s),{code:'ERP_HUB_WAIT_REJECTED'});
});

function staleStartupFixture(){
 const root='C:\\synthetic',stages=COMPLETION_CORE_STAGES.slice(0,2),settings={ownerSid:'S-1-5-21-1-2-3-4',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',node:{path:root+'\\node.exe'},supervisor:{packageRoot:root+'\\sup'},components:{erpApiNative:{packageRoot:root+'\\api',sourceCommit:'a'.repeat(40),config:{path:root+'\\operation.json',sha256:'b'.repeat(64)}}}};
 const quote=args=>args.map(x=>'"'+x+'"').join(' '),time='2026-10-15T00:00:02.0000000Z',parentTime='2026-10-15T00:00:01.0000000Z';
 const rows=stages.map((s,i)=>({pid:30+i,parentPid:20,ownerSid:settings.ownerSid,parentOwnerSid:settings.ownerSid,nodePath:settings.node.path,parentNodePath:settings.node.path,creationTime:time,managedCreationTime:time,parentCreationTime:parentTime,commandLine:quote([settings.node.path,...completionNodeArguments(s,settings)]),parentCommandLine:quote([settings.node.path,'--no-maglev',root+'\\sup\\scripts\\canonical\\terminal-completion-logon.mjs']),bindings:s.ports.flatMap(port=>[{port,address:'127.0.0.1'},...(s.name==='erpApi'?[{port,address:'192.168.1.46'}]:[])])}));
 const fresh=stages.map((s,i)=>({run:'11111111-1111-4111-8111-111111111111',pid:rows[i].pid,parentPid:20,creationTime:time,parentCreationTime:parentTime,stage:s.name,sourceCommit:'a'.repeat(40),configSha256:'b'.repeat(64),copyId:settings.copyId,actualT1:false}));
 const old=fresh.map(r=>({...r,pid:r.pid-10,parentPid:10,creationTime:'2026-10-14T00:00:02.0000000Z',parentCreationTime:'2026-10-14T00:00:01.0000000Z'}));
 let clock=0,sleeps=0,probes=0,health=0;
 const input={settings,stages,probe:async()=>{probes++;return structuredClone(rows);},receipt:async s=>structuredClone((clock===0?old:fresh)[stages.indexOf(s)]),matches:completionProcessMatches,ready:async()=>{health++;return true;},now:()=>clock,sleep:async ms=>{clock+=ms;sleeps++;}};
 return {input,rows,old,fresh,counts:()=>({sleeps,probes,health})};
}
test('stale generation race waits for actual fresh receipts then exact native identities health and second snapshot',async()=>{
 const f=staleStartupFixture(),result=await waitForErpBeforeHub(f.input);assert.equal(result.ready,true);assert.equal(result.coreSupervisorPid,20);assert.deepEqual(f.counts(),{sleeps:1,probes:3,health:2});
});
test('stale generation race never releases from self-derived candidates and retains fixed deadline',async()=>{
 const f=staleStartupFixture();f.input.receipt=async s=>f.old[f.input.stages.indexOf(s)];f.input.sleep=async()=>{};let n=0;f.input.now=()=>n++*200001;
 await assert.rejects(waitForErpBeforeHub(f.input),{code:'ERP_HUB_WAIT_TIMEOUT'});assert.equal(f.counts().health,0);
});
test('stale generation race rejects malformed static drift same PID reuse and foreign current identity immediately',async()=>{
 const changes=[f=>f.old[0].run='bad',f=>delete f.old[0].run,f=>f.old[0].extra=true,f=>f.old[0].sourceCommit='c'.repeat(40),f=>f.old[0].configSha256='c'.repeat(64),f=>f.old[0].copyId='other',f=>f.old[0].actualT1=true,f=>f.old[0].stage='erpApi',f=>f.old[0].pid=f.rows[0].pid,f=>f.old[0].parentPid=f.rows[0].parentPid,f=>f.old[0].creationTime=f.rows[0].creationTime,f=>f.old[0].parentCreationTime=f.rows[0].parentCreationTime,f=>f.old[0].creationTime='2026-02-30T00:00:02.0000000Z',f=>f.old[0].pid='20',f=>f.rows[0].ownerSid='S-1-5-18',f=>f.rows[0].nodePath='C:\\foreign.exe',f=>f.rows[0].parentOwnerSid='S-1-5-18',f=>f.rows[0].parentNodePath='C:\\foreign.exe',f=>f.rows[0].parentCommandLine='foreign supervisor',f=>f.rows[0].commandLine+=' extra',f=>f.rows[0].managedCreationTime='2026-10-15T00:00:03.0000000Z'];
 for(const change of changes){const f=staleStartupFixture();change(f);await assert.rejects(waitForErpBeforeHub(f.input),e=>['ERP_HUB_WAIT_IDENTITY','ERP_HUB_WAIT_OWNER'].includes(e.code));assert.deepEqual(f.counts(),{sleeps:0,probes:1,health:0});}
});
test('stale generation race still requires common fresh parent and unchanged second OS observation',async()=>{
 for(const mode of ['parent','second']){const f=staleStartupFixture();if(mode==='parent'){f.rows[1].parentPid=21;f.fresh[1].parentPid=21;f.rows[1].parentCreationTime='2026-10-15T00:00:01.0000010Z';f.fresh[1].parentCreationTime=f.rows[1].parentCreationTime;}else{let n=0;f.input.probe=async()=>{n++;const rows=structuredClone(f.rows);if(n===3)rows[0].parentCommandLine+=' changed';return rows;};}await assert.rejects(waitForErpBeforeHub(f.input),e=>['ERP_HUB_WAIT_PARENT','ERP_HUB_WAIT_IDENTITY','ERP_HUB_WAIT_CHANGED'].includes(e.code));}
});
test('receipt-wait literal fourth tuple admits only exact 5bcd source and preserves base tuples',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='5bcd5ad136ff7ca35d623d436b8724cc491641be',next=root+'settings-crm06-staff-5bcd5ad136ff-receipt-wait.json';
 assert.equal(assertErpHubProfile(next,source),true);assert.equal(assertErpHubProfile(root+'settings-crm06-staff-5bcd5ad136ff.json',source),true);
 for(const [config,value]of [[next,'da82fc6644c1d9dba0c10eaa861773534d43c288'],[next,'5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'],[next,source.toUpperCase()],[next.toUpperCase(),source],[next,source.slice(0,12)],[next.replace('receipt-wait','other'),source],[root+'settings-crm06-staff-5ce452b01ef2-receipt-wait.json',source]])assert.throws(()=>assertErpHubProfile(config,value),{code:'ERP_HUB_WAIT_REJECTED'});
});
test('stale generation race accepts same live supervisor child retry but rejects child PID reuse or changed parent birth',async()=>{
 const makeRetry=()=>{const f=staleStartupFixture();for(let i=0;i<2;i++)Object.assign(f.old[i],{parentPid:f.rows[i].parentPid,parentCreationTime:f.rows[i].parentCreationTime,creationTime:'2026-10-15T00:00:01.5000000Z'});return f;};
 const f=makeRetry(),result=await waitForErpBeforeHub(f.input);assert.equal(result.ready,true);assert.deepEqual(f.counts(),{sleeps:1,probes:3,health:2});
 for(const change of [v=>v.old[0].pid=v.rows[0].pid,v=>v.old[0].parentCreationTime='2026-10-15T00:00:01.0000010Z',v=>v.old[0].parentPid=99]){const bad=makeRetry();change(bad);await assert.rejects(waitForErpBeforeHub(bad.input),{code:'ERP_HUB_WAIT_IDENTITY'});assert.deepEqual(bad.counts(),{sleeps:0,probes:1,health:0});}
});

test('readiness failure metadata admits only fixed profile and receipt destinations and never exposes dynamic errors',()=>{
 const config='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-5bcd5ad136ff-receipt-wait.json',receipt='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\hub-web\\erp-prerequisites-'+ 'a'.repeat(32)+'.json',hash='b'.repeat(64);
 assert.deepEqual(erpHubFailureMetadata(config,hash,receipt,'ERP_HUB_WAIT_IDENTITY'),{path:receipt+'.failure.json',code:'ERP_HUB_WAIT_IDENTITY',configSha256:hash});
 const opaque=erpHubFailureMetadata(config,hash,receipt,'PRIVATE_DYNAMIC_ERROR');assert.equal(opaque.code,'ERP_HUB_WAIT_REJECTED');assert.equal(JSON.stringify(opaque).includes('PRIVATE'),false);
 for(const args of [['C:\\foreign.json',hash,receipt],[config,'not-a-hash',receipt],[config,hash,'C:\\foreign.json'],[config,hash,receipt+'.other'],[config,hash,receipt.toUpperCase()]])assert.throws(()=>erpHubFailureMetadata(...args,'ERP_HUB_WAIT_IDENTITY'),{code:'ERP_HUB_WAIT_REJECTED'});
});

test('bb896 Hub tuple preserves receipt-wait behavior and rejects every preceding source or private path cross-pair',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='bb8966c59a6cfbdc1cc83472cb331e48b720a173',next=root+'settings-crm06-staff-bb8966c59a6c.json',previous=[['da82fc6644c1-parent-probe','da82fc6644c1d9dba0c10eaa861773534d43c288'],['5ce452b01ef2','5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'],['5bcd5ad136ff','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['5bcd5ad136ff-receipt-wait','5bcd5ad136ff7ca35d623d436b8724cc491641be']];
 assert.equal(assertErpHubProfile(next,source),true);for(const [suffix,oldSource]of previous){const old=root+'settings-crm06-staff-'+suffix+'.json';assert.equal(assertErpHubProfile(old,oldSource),true);assert.throws(()=>assertErpHubProfile(old,source),{code:'ERP_HUB_WAIT_REJECTED'});assert.throws(()=>assertErpHubProfile(next,oldSource),{code:'ERP_HUB_WAIT_REJECTED'});}
 for(const [config,value]of [[next.toUpperCase(),source],[next,source.toUpperCase()],[next,source.slice(0,12)],[next.replace('.json','-receipt-wait.json'),source],[next.replace('.json','-parent-probe.json'),source],[root+'settings-crm06-staff-unknown.json',source]])assert.throws(()=>assertErpHubProfile(config,value),{code:'ERP_HUB_WAIT_REJECTED'});
});

test('957 Hub tuple preserves receipt-wait behavior and rejects every preceding source or private path cross-pair',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='957f98773695874ea3d101b7eb4816f9ea080880',next=root+'settings-crm06-staff-957f98773695.json',previous=[['da82fc6644c1-parent-probe','da82fc6644c1d9dba0c10eaa861773534d43c288'],['5ce452b01ef2','5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'],['5bcd5ad136ff','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['5bcd5ad136ff-receipt-wait','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['bb8966c59a6c','bb8966c59a6cfbdc1cc83472cb331e48b720a173']];
 assert.equal(assertErpHubProfile(next,source),true);for(const [suffix,oldSource]of previous){const old=root+'settings-crm06-staff-'+suffix+'.json';assert.equal(assertErpHubProfile(old,oldSource),true);assert.throws(()=>assertErpHubProfile(old,source),{code:'ERP_HUB_WAIT_REJECTED'});assert.throws(()=>assertErpHubProfile(next,oldSource),{code:'ERP_HUB_WAIT_REJECTED'});}
 for(const [config,value]of [[next.toUpperCase(),source],[next,source.toUpperCase()],[next,source.slice(0,12)],[next.replace('.json','-receipt-wait.json'),source],[next.replace('.json','-parent-probe.json'),source],[root+'settings-crm06-staff-unknown.json',source]])assert.throws(()=>assertErpHubProfile(config,value),{code:'ERP_HUB_WAIT_REJECTED'});
});

test('894 Hub tuple preserves receipt-wait behavior and rejects every preceding source or private path cross-pair',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='89427492f27caf72c511a27262b55e73d782c407',next=root+'settings-crm06-staff-89427492f27c.json',previous=[['da82fc6644c1-parent-probe','da82fc6644c1d9dba0c10eaa861773534d43c288'],['5ce452b01ef2','5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'],['5bcd5ad136ff','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['5bcd5ad136ff-receipt-wait','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['bb8966c59a6c','bb8966c59a6cfbdc1cc83472cb331e48b720a173'],['957f98773695','957f98773695874ea3d101b7eb4816f9ea080880']];
 assert.equal(assertErpHubProfile(next,source),true);for(const [suffix,oldSource]of previous){const old=root+'settings-crm06-staff-'+suffix+'.json';assert.equal(assertErpHubProfile(old,oldSource),true);assert.throws(()=>assertErpHubProfile(old,source),{code:'ERP_HUB_WAIT_REJECTED'});assert.throws(()=>assertErpHubProfile(next,oldSource),{code:'ERP_HUB_WAIT_REJECTED'});}
 for(const [config,value]of [[next.toUpperCase(),source],[next,source.toUpperCase()],[next,source.slice(0,12)],[next.replace('.json','-receipt-wait.json'),source],[next.replace('.json','-parent-probe.json'),source],[root+'settings-crm06-staff-unknown.json',source]])assert.throws(()=>assertErpHubProfile(config,value),{code:'ERP_HUB_WAIT_REJECTED'});
});

test('94f Hub tuple preserves receipt-wait behavior and rejects every preceding source or private path cross-pair',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='94f2a75322a3daa695d38010a6f2c8ef23f6c17b',next=root+'settings-crm06-staff-94f2a75322a3.json',previous=[['da82fc6644c1-parent-probe','da82fc6644c1d9dba0c10eaa861773534d43c288'],['5ce452b01ef2','5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'],['5bcd5ad136ff','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['5bcd5ad136ff-receipt-wait','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['bb8966c59a6c','bb8966c59a6cfbdc1cc83472cb331e48b720a173'],['957f98773695','957f98773695874ea3d101b7eb4816f9ea080880'],['89427492f27c','89427492f27caf72c511a27262b55e73d782c407']];
 assert.equal(assertErpHubProfile(next,source),true);for(const [suffix,oldSource]of previous){const old=root+'settings-crm06-staff-'+suffix+'.json';assert.equal(assertErpHubProfile(old,oldSource),true);assert.throws(()=>assertErpHubProfile(old,source),{code:'ERP_HUB_WAIT_REJECTED'});assert.throws(()=>assertErpHubProfile(next,oldSource),{code:'ERP_HUB_WAIT_REJECTED'});}
 for(const [config,value]of [[next.toUpperCase(),source],[next,source.toUpperCase()],[next,source.slice(0,12)],[next.replace('.json','-receipt-wait.json'),source],[next.replace('.json','-parent-probe.json'),source],[root+'settings-crm06-staff-unknown.json',source]])assert.throws(()=>assertErpHubProfile(config,value),{code:'ERP_HUB_WAIT_REJECTED'});
});

test('94f WindowsPS5 Hub switch maps exact config and rejects path aliases without loading private settings',async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url');
 const sourcePath=fileURLToPath(new URL('./watch-hub-after-erp.ps1',import.meta.url)).replaceAll("'","''"),source='94f2a75322a3daa695d38010a6f2c8ef23f6c17b',previous='89427492f27caf72c511a27262b55e73d782c407',root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',next=root+'settings-crm06-staff-94f2a75322a3.json',old=root+'settings-crm06-staff-89427492f27c.json';
 const script=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PARSE_FAILED'}
$assignment=@($ast.EndBlock.Statements|Where-Object {$_.Extent.Text.StartsWith('$expectedCrmSource=switch ')})
if($assignment.Count-ne1){throw 'SWITCH_AST_MISSING'}
$policy=[scriptblock]::Create('param($StartupConfigPath)'+[Environment]::NewLine+$assignment[0].Extent.Text+[Environment]::NewLine+'return $expectedCrmSource')
$cases=@('${next}','${old}','${next.toUpperCase()}','${next.replace('.json','-receipt-wait.json')}','${next.replace('.json','-parent-probe.json')}','${root}settings-crm06-staff-unknown.json')
$results=@(foreach($c in $cases){try{[pscustomobject]@{accepted=$true;source=(& $policy $c)}}catch{[pscustomobject]@{accepted=$false;source=$null}}})
ConvertTo-Json -InputObject @($results) -Compress`;
 // Execute only the pure assignment AST; no Read-PinnedJson or process launch.
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0);assert.equal(result.stderr,'');const rows=JSON.parse(result.stdout);assert.deepEqual(rows.slice(0,2),[{accepted:true,source},{accepted:true,source:previous}]);for(const row of rows.slice(2))assert.equal(row.accepted,false);
});

test('a724 Hub tuple preserves receipt-wait behavior and rejects every preceding source or private path cross-pair',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9',next=root+'settings-crm06-staff-a7243dedf9ca.json',previous=[['da82fc6644c1-parent-probe','da82fc6644c1d9dba0c10eaa861773534d43c288'],['5ce452b01ef2','5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'],['5bcd5ad136ff','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['5bcd5ad136ff-receipt-wait','5bcd5ad136ff7ca35d623d436b8724cc491641be'],['bb8966c59a6c','bb8966c59a6cfbdc1cc83472cb331e48b720a173'],['957f98773695','957f98773695874ea3d101b7eb4816f9ea080880'],['89427492f27c','89427492f27caf72c511a27262b55e73d782c407'],['94f2a75322a3','94f2a75322a3daa695d38010a6f2c8ef23f6c17b']];
 assert.equal(assertErpHubProfile(next,source),true);for(const [suffix,oldSource]of previous){const old=root+'settings-crm06-staff-'+suffix+'.json';assert.equal(assertErpHubProfile(old,oldSource),true);assert.throws(()=>assertErpHubProfile(old,source),{code:'ERP_HUB_WAIT_REJECTED'});assert.throws(()=>assertErpHubProfile(next,oldSource),{code:'ERP_HUB_WAIT_REJECTED'});}
 for(const [config,value]of [[next.toUpperCase(),source],[next,source.toUpperCase()],[next,source.slice(0,12)],[next.replace('.json','-receipt-wait.json'),source],[next.replace('.json','-parent-probe.json'),source],[root+'settings-crm06-staff-unknown.json',source]])assert.throws(()=>assertErpHubProfile(config,value),{code:'ERP_HUB_WAIT_REJECTED'});
});

test('a724 WindowsPS5 Hub switch maps exact config and rejects path aliases without loading private settings',async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url');
 const sourcePath=fileURLToPath(new URL('./watch-hub-after-erp.ps1',import.meta.url)).replaceAll("'","''"),source='a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9',previous='94f2a75322a3daa695d38010a6f2c8ef23f6c17b',root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',next=root+'settings-crm06-staff-a7243dedf9ca.json',old=root+'settings-crm06-staff-94f2a75322a3.json';
 const script=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PARSE_FAILED'}
$assignment=@($ast.EndBlock.Statements|Where-Object {$_.Extent.Text.StartsWith('$expectedCrmSource=switch ')})
if($assignment.Count-ne1){throw 'SWITCH_AST_MISSING'}
$policy=[scriptblock]::Create('param($StartupConfigPath)'+[Environment]::NewLine+$assignment[0].Extent.Text+[Environment]::NewLine+'return $expectedCrmSource')
$cases=@('${next}','${old}','${next.toUpperCase()}','${next.replace('.json','-receipt-wait.json')}','${next.replace('.json','-parent-probe.json')}','${root}settings-crm06-staff-unknown.json')
$results=@(foreach($c in $cases){try{[pscustomobject]@{accepted=$true;source=(& $policy $c)}}catch{[pscustomobject]@{accepted=$false;source=$null}}})
ConvertTo-Json -InputObject @($results) -Compress`;
 // Execute only the pure assignment AST; no Read-PinnedJson or process launch.
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0);assert.equal(result.stderr,'');const rows=JSON.parse(result.stdout);assert.deepEqual(rows.slice(0,2),[{accepted:true,source},{accepted:true,source:previous}]);for(const row of rows.slice(2))assert.equal(row.accepted,false);
});


test('B264 Hub prerequisite accepts one exact successor settings path and preserves old01ef/e59 profiles',()=>{
 const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',source='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',next=root+'settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json';
 for(const suffix of ['01ef3e3aa3bd-b264-successor','01ef3e3aa3bd','e59e07abf7ae'])assert.equal(assertErpHubProfile(root+'settings-crm06-staff-6bc82e6fe972-erp-'+suffix+'.json',source),true);
 for(const [config,value]of [[next.toUpperCase(),source],[next,source.toUpperCase()],[next,source.slice(0,12)],[next.replace('b264-successor','b264-anything'),source],[next.replace('01ef3e3aa3bd','e59e07abf7ae'),source],[next.replace('6bc82e6fe972','439b63db8376'),source]])assert.throws(()=>assertErpHubProfile(config,value),{code:'ERP_HUB_WAIT_REJECTED'});
});
test('Windows PS5 B264 Hub path and Node24 guards run as pure AST without settings IO or a process launch',{skip:process.platform!=='win32'},async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url');
 const file=fileURLToPath(new URL('./watch-hub-after-erp.ps1',import.meta.url)).replaceAll("'","''"),root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\',next=root+'settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json';
 const ps=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){throw 'PARSE_FAILED'}
$statements=@($ast.EndBlock.Statements);$switch=@($statements|Where-Object{$_.Extent.Text.StartsWith('$expectedCrmSource=switch ')})
$raw=[IO.File]::ReadAllText('${file}');$start=$raw.IndexOf('$literalCandidateNode=');$end=$raw.IndexOf('$manifest=Read-PinnedJson',$start)
if($switch.Count-ne1-or$start-lt0-or$end-le$start){throw 'POLICY_AST_MISSING'}
$policy=[scriptblock]::Create('param($StartupConfigPath,$c,$owner)'+[Environment]::NewLine+$switch[0].Extent.Text+[Environment]::NewLine+$raw.Substring($start,$end-$start)+[Environment]::NewLine+'return $true')
function Config{[pscustomobject]@{components=[pscustomobject]@{crm=[pscustomobject]@{sourceCommit='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'}};ownerSid='fixture-owner';node=[pscustomobject]@{path='C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe';sha256='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'};actualT1=$false;database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82'}}
$results=@();$c=Config;$results+=,(& $policy '${next}' $c 'fixture-owner')
foreach($kind in @('node','node-hash','crm','t1','db','copy','case','suffix')){$c=Config;$p='${next}';switch($kind){node{$c.node.path='C:\\Program Files\\nodejs\\node.exe'} 'node-hash'{$c.node.sha256='0'*64} crm{$c.components.crm.sourceCommit='0'*40} t1{$c.actualT1=$true} db{$c.database='LIVE'} copy{$c.copyId='other'} case{$p=$p.ToUpperInvariant()} suffix{$p=$p.Replace('b264-successor','b264-anything')}};try{$null=& $policy $p $c 'fixture-owner';$results+=,$true}catch{$results+=,$false}}
ConvertTo-Json -InputObject $results -Compress`;
 const r=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');assert.deepEqual(JSON.parse(r.stdout),[true,...Array(8).fill(false)]);
});

const currentHubProfile=()=>crm06StaffSuccessorProfile('d1e4425206249e38445fb103e03601f86baa84ec','erp-crm-current-20261020');
test('current Hub prerequisite accepts only the exact existing successor path and full CRM source',()=>{
 const profile=currentHubProfile(),config=profile.nextPaths.settings,source=profile.source;
 assert.equal(assertErpHubProfile(config,source),true);
 for(const [p,s]of [[config.toUpperCase(),source],[config,source.toUpperCase()],[config,source.slice(0,12)],[config.replace('-current.json','-other.json'),source],[config,'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a']])assert.throws(()=>assertErpHubProfile(p,s),{code:'ERP_HUB_WAIT_REJECTED'});
});
test('Windows PS5 current Hub policy binds exact Node and app tuples without running the watcher',{skip:process.platform!=='win32'},async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url'),profile=currentHubProfile(),config=profile.nextPaths.settings;
 const base={components:{crm:structuredClone(CRM06_STAFF_CURRENT_CRM_PACKAGE),erpApiNative:structuredClone(CRM06_STAFF_CURRENT_ERP_PACKAGE),hub:structuredClone(CRM06_STAFF_CURRENT_ERP_PACKAGE)},ownerSid:'fixture-owner',node:{path:'C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe',sha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'},actualT1:false,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82'};
 const cases=[{path:config,value:base}];
 for(const mutate of [v=>v.node.path='C:\\Program Files\\nodejs\\node.exe',v=>v.node.sha256='0'.repeat(64),v=>v.ownerSid='other',v=>v.actualT1=true,v=>v.database='LIVE',v=>v.copyId='other',...['crm','erpApiNative','hub'].flatMap(name=>['sourceCommit','packageRoot','manifestSha256'].map(key=>v=>v.components[name][key]+='wrong'))]){const value=structuredClone(base);mutate(value);cases.push({path:config,value});}
 cases.push({path:config.toUpperCase(),value:base},{path:config.replace('-current.json','-other.json'),value:base});
 const file=fileURLToPath(new URL('./watch-hub-after-erp.ps1',import.meta.url)).replaceAll("'","''"),payload=Buffer.from(JSON.stringify(cases)).toString('base64');
 const ps=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){throw 'PARSE_FAILED'}
$switch=@($ast.EndBlock.Statements|Where-Object{$_.Extent.Text.StartsWith('$expectedCrmSource=switch ')});$raw=[IO.File]::ReadAllText('${file}');$start=$raw.IndexOf('$literalCandidateNode=');$end=$raw.IndexOf('$manifest=Read-PinnedJson',$start);if($switch.Count-ne1-or$start-lt0-or$end-le$start){throw 'POLICY_AST_MISSING'}
$policy=[scriptblock]::Create('param($StartupConfigPath,$c,$owner)'+[Environment]::NewLine+$switch[0].Extent.Text+[Environment]::NewLine+$raw.Substring($start,$end-$start)+[Environment]::NewLine+'return $true')
$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;$results=@(foreach($case in $cases){try{$null=& $policy $case.path $case.value 'fixture-owner';$true}catch{$false}});ConvertTo-Json -InputObject $results -Compress`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','-'],{input:ps,encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.deepEqual(JSON.parse(result.stdout),[true,...Array(cases.length-1).fill(false)]);
});
