import test from 'node:test';import assert from 'node:assert/strict';
import {waitForErpBeforeHub,runErpHubBarrier,assertErpHubHealth} from './wait-erp-for-hub.mjs';
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
