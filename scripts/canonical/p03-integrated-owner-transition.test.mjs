import test from 'node:test';
import assert from 'node:assert/strict';
import {runP03OwnerTransition,p03TransitionDigest} from './p03-integrated-owner-transition.mjs';

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
