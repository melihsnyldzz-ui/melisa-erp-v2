import test from 'node:test';
import assert from 'node:assert/strict';
import {runP03OwnerTransition,runP03HeldCoreOwnerTransition,p03TransitionDigest} from './p03-integrated-owner-transition.mjs';

const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
function fixture(changes={}){
 const events=[],calls=[],plan={targets,oldSettingsSha256:'b'.repeat(64),newSettingsSha256:'c'.repeat(64)};plan.digest=p03TransitionDigest(plan);
 let action='old';
 const callbacks={plan,admit:async()=>{calls.push('admit');return {owner:true,oldHealthy:true,oldActions:true,emptyJournal:events.length===0};},persist:async row=>{if(events.some(e=>e.sequence===row.sequence))return {created:false,sequence:row.sequence};events.push(row);return {created:true,sequence:row.sequence};},
  stopTasks:async()=>{calls.push('stopTasks');return true;},tasksStopped:async()=>{calls.push('tasksStopped');return true;},
  stopExact:async target=>{calls.push('stop:'+target);return 'EXACT_OBSERVED_PROCESS_STOPPED';},absent:async target=>{calls.push('absent:'+target);return true;},
  portsClear:async()=>{calls.push('portsClear');return true;},setAction:async(name,kind)=>{calls.push('set:'+name+':'+kind);action=kind;return true;},
  actionsEqual:async kind=>{calls.push('actionsEqual:'+kind);return action===kind;},
  startTasks:async()=>{calls.push('startTasks');return true;},readback:async()=>{calls.push('readback');return true;},
  restoreOldActions:async()=>{calls.push('restoreOldActions');action='old';return true;},...changes};
 return {callbacks,calls,events,plan};
}
test('one authorized handoff persists intent before task stop, exact stops, action changes and start',async()=>{
 const f=fixture(),result=await runP03OwnerTransition(f.callbacks);
 assert.deepEqual(result,{status:'COMPLETE',stopped:8,started:true});
 assert.deepEqual(f.calls.filter(x=>x.startsWith('stop:')),targets.map(x=>'stop:'+x));
 assert.deepEqual(f.calls.filter(x=>x.startsWith('set:')),['set:Melisa-Terminal-Completion-Logon:new','set:Melisa-Hub-TEST-Web:new']);
 for(const [index,event] of f.events.entries())assert.equal(event.sequence,index);
 assert.equal(f.events[0].event,'TASK_STOP_INTENT');assert.equal(f.events.at(-1).event,'COMPLETE');
 assert.ok(f.events.findIndex(x=>x.event==='PORTS_CLEAR')<f.events.findIndex(x=>x.event==='ACTION_INTENT'));
 assert.ok(f.events.findIndex(x=>x.event==='START_INTENT')<f.calls.indexOf('startTasks')+f.events.length);
 assert.equal(f.calls.includes('restoreOldActions'),false);
});
test('wrong plan or missing admission refuses before mutation',async()=>{
 for(const changed of [p=>p.targets=[...targets].reverse(),p=>p.targets=[...targets.slice(0,7),'hub'],p=>p.newSettingsSha256=p.oldSettingsSha256]){
  const f=fixture();changed(f.plan);await assert.rejects(runP03OwnerTransition(f.callbacks),/P03_OWNER_TRANSITION_REJECTED/);assert.deepEqual(f.calls,[]);
 }
 const f=fixture({admit:async()=>({owner:true,oldHealthy:false,oldActions:true,emptyJournal:true})});await assert.rejects(runP03OwnerTransition(f.callbacks),/P03_OWNER_TRANSITION_REJECTED/);assert.equal(f.calls.includes('stopTasks'),false);
 const digest=fixture();digest.plan.digest='0'.repeat(64);await assert.rejects(runP03OwnerTransition(digest.callbacks),/P03_OWNER_TRANSITION_REJECTED/);assert.deepEqual(digest.calls,[]);
});
test('an existing stop, start or failed intent forbids repeat invocation before any mutation',async()=>{
 for(const event of ['TASK_STOP_INTENT','START_INTENT','FAILED']){
  const f=fixture();f.events.push({sequence:0,digest:f.plan.digest,event});
  await assert.rejects(runP03OwnerTransition(f.callbacks),/P03_OWNER_TRANSITION_REJECTED/);
  assert.equal(f.calls.includes('stopTasks'),false);assert.equal(f.calls.includes('startTasks'),false);
 }
});
test('failed exact stop leaves both actions untouched and never starts',async()=>{
 const f=fixture({stopExact:async target=>target==='crmOrders'?'REJECTED':'EXACT_OBSERVED_PROCESS_STOPPED'});
 await assert.rejects(runP03OwnerTransition(f.callbacks),error=>error.code==='P03_OWNER_TRANSITION_STOPPED'&&error.phase==='STOP_crmOrders'&&error.startAttempted===false);
 assert.equal(f.calls.includes('startTasks'),false);assert.equal(f.calls.some(x=>x.startsWith('set:')),false);
 assert.equal(f.events.at(-1).event,'FAILED');
});
test('action failure can restore old actions only while tasks stopped and ports empty',async()=>{
 const f=fixture();f.callbacks.setAction=async(name,kind)=>{f.calls.push('set:'+name+':'+kind);return name!=='Melisa-Hub-TEST-Web';};
 await assert.rejects(runP03OwnerTransition(f.callbacks),error=>error.code==='P03_OWNER_TRANSITION_STOPPED'&&error.actionRestore==='RESTORED'&&error.startAttempted===false);
 assert.equal(f.calls.includes('startTasks'),false);assert.ok(f.events.some(x=>x.event==='OLD_ACTIONS_RESTORED'));
 const unsafe=fixture();unsafe.callbacks.setAction=async(name,kind)=>{unsafe.calls.push('set:'+name+':'+kind);return name!=='Melisa-Hub-TEST-Web';};unsafe.callbacks.portsClear=async()=>!unsafe.calls.includes('set:Melisa-Terminal-Completion-Logon:new');
 await assert.rejects(runP03OwnerTransition(unsafe.callbacks),error=>error.actionRestore==='UNSAFE');assert.equal(unsafe.calls.includes('restoreOldActions'),false);
});
test('readback failure after start never auto-restores or restarts',async()=>{
 const f=fixture({readback:async()=>false});
 await assert.rejects(runP03OwnerTransition(f.callbacks),error=>error.code==='P03_OWNER_TRANSITION_STOPPED'&&error.phase==='READBACK'&&error.startAttempted===true&&error.actionRestore==='NOT_ATTEMPTED');
 assert.equal(f.calls.includes('startTasks'),true);assert.equal(f.calls.includes('restoreOldActions'),false);assert.equal(f.events.at(-1).event,'FAILED');
});

function heldFixture(){const f=fixture();f.callbacks.heldCoreCut=async()=>{
 assert.deepEqual(f.events.slice(0,2).map(x=>[x.event,x.target]),[['TASK_STOP_INTENT',undefined],['EXACT_STOP_INTENT','coreSupervisor']]);
 f.calls.push('heldCoreCut');return {coreStopResult:'COM_STOP_NATURAL_EXIT',heldCoreExited:true,comStopped:true,cutWitness:{path:'synthetic/cut',sha256:'a'.repeat(64)},drainWitness:{path:'synthetic/drain',sha256:'b'.repeat(64)}};
};return f;}
test('held-core handoff persists the real core intent before COM-cut callback and drains only seven remaining roles',async()=>{
 const f=heldFixture();assert.deepEqual(await runP03HeldCoreOwnerTransition(f.callbacks),{status:'COMPLETE',stopped:8,started:true});
 assert(!f.calls.includes('stopTasks'));assert(!f.calls.includes('stop:coreSupervisor'));
 assert.deepEqual(f.calls.filter(x=>x.startsWith('stop:')),targets.slice(0,7).map(x=>'stop:'+x));
 assert(f.events.findIndex(x=>x.event==='EXACT_STOPPED'&&x.target==='coreSupervisor')<f.events.findIndex(x=>x.event==='TASKS_STOPPED'));
 assert(f.events.every((e,n)=>e.sequence===n&&/^[a-f0-9]{64}$/.test(e.stopOrderDigest)));
});
test('failed held-core intent persistence never enters the COM-cut callback',async()=>{
 const f=heldFixture(),persist=f.callbacks.persist;f.callbacks.persist=async row=>row.event==='EXACT_STOP_INTENT'?{created:false,sequence:row.sequence}:persist(row);
 await assert.rejects(runP03HeldCoreOwnerTransition(f.callbacks));assert(!f.calls.includes('heldCoreCut'));assert(!f.calls.includes('startTasks'));assert(!f.calls.some(x=>x.startsWith('set:')));
});
test('held-core receipt drift refuses all remaining stops and actions',async()=>{
 for(const change of [x=>x.heldCoreExited=false,x=>x.comStopped=false,x=>x.coreStopResult='ALREADY_GONE',x=>x.cutWitness.sha256='invalid',x=>x.drainWitness=x.cutWitness,x=>x.extra=true]){
  const f=heldFixture(),cut=f.callbacks.heldCoreCut;f.callbacks.heldCoreCut=async()=>{const r=await cut();change(r);return r;};
  await assert.rejects(runP03HeldCoreOwnerTransition(f.callbacks),e=>e.phase==='HELD_CORE_CUT'&&e.startAttempted===false);assert(!f.calls.some(x=>x.startsWith('stop:')||x.startsWith('set:')));assert(!f.calls.includes('startTasks'));
 }
});
test('held-core startup failure never restores actions over potentially running new processes',async()=>{
 const f=heldFixture();f.callbacks.readback=async()=>false;await assert.rejects(runP03HeldCoreOwnerTransition(f.callbacks),e=>e.phase==='READBACK'&&e.startAttempted===true&&e.actionRestore==='NOT_ATTEMPTED');assert(!f.calls.includes('restoreOldActions'));assert.equal(f.events.at(-1).event,'FAILED');
});
