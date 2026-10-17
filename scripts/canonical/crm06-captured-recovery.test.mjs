import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverCapturedTestOwner} from './crm06-captured-recovery.mjs';
const targets = ['coreSupervisor','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','hub'];
function fixture() {
  const history=[], actions=[], gone=new Set();
  const options={plan:{digest:'a'.repeat(64),targets}, history,
    admit:async()=>true,persist:async e=>{history.push(e);return true;},
    stop:async n=>{actions.push('stop:'+n);gone.add(n);return 'EXACT_OBSERVED_PROCESS_STOPPED';},
    absent:async n=>gone.has(n),clear:async()=>gone.size===8,
    start:async()=>{actions.push('start');return true;},readback:async()=>true};
  return {options,history,actions,gone};
}
test('recovery persists every intent/result before next effect and reads back',async()=>{
  const f=fixture(); const result=await recoverCapturedTestOwner(f.options);
  assert.equal(result.status,'COMPLETE');assert.equal(f.actions.length,9);
  assert.equal(f.history.at(-1).event,'COMPLETE');
  assert.deepEqual(f.history.filter(e=>e.event==='STOP_INTENT').map(e=>e.target),targets);
});
test('completed replay verifies readback without another stop/start',async()=>{
  const f=fixture();await recoverCapturedTestOwner(f.options);f.actions.length=0;
  assert.equal((await recoverCapturedTestOwner(f.options)).status,'ALREADY_COMPLETE');assert.deepEqual(f.actions,[]);
});
test('admission, closed targets and changed plan reject before effects',async()=>{
  for(const kind of ['admit','targets','digest']) {const f=fixture();if(kind==='admit')f.options.admit=async()=>false;if(kind==='targets')f.options.plan.targets=[...targets.slice(0,7),'sql'];if(kind==='digest'){f.history.push({sequence:0,digest:'b'.repeat(64),event:'PLAN'});}await assert.rejects(recoverCapturedTestOwner(f.options));assert.deepEqual(f.actions,[]);}
});
test('intent persistence failure prevents even the first child stop',async()=>{
  const f=fixture();f.options.persist=async e=>e.event!=='STOP_INTENT';await assert.rejects(recoverCapturedTestOwner(f.options));assert.deepEqual(f.actions,[]);
});
test('child rejection persists partial failure and prohibits retry or startup',async()=>{
  const f=fixture();f.options.stop=async n=>{f.actions.push(n);throw Error('OWNED_STOP_REJECTED');};await assert.rejects(recoverCapturedTestOwner(f.options));assert.equal(f.history.at(-1).event,'FAILED');const count=f.actions.length;await assert.rejects(recoverCapturedTestOwner(f.options));assert.equal(f.actions.length,count);
});
test('interrupted stop intent accepts only proven absence without second stop',async()=>{
  const f=fixture();f.history.push({sequence:0,digest:'a'.repeat(64),event:'PLAN'},{sequence:1,digest:'a'.repeat(64),event:'STOP_INTENT',target:targets[0]});
  await assert.rejects(recoverCapturedTestOwner(f.options));assert.deepEqual(f.actions,[]);
  const g=fixture();g.history.push({sequence:0,digest:'a'.repeat(64),event:'PLAN'},{sequence:1,digest:'a'.repeat(64),event:'STOP_INTENT',target:targets[0]});g.gone.add(targets[0]);await recoverCapturedTestOwner(g.options);assert.ok(!g.actions.includes('stop:'+targets[0]));
});
test('unclear ports or ambiguous start prevents success and automatic rollback',async()=>{
  const f=fixture();f.options.clear=async()=>false;await assert.rejects(recoverCapturedTestOwner(f.options));assert.ok(!f.actions.includes('start'));
  const g=fixture();g.options.start=async()=>{g.actions.push('start');return false;};await assert.rejects(recoverCapturedTestOwner(g.options));assert.equal(g.actions.filter(x=>x==='start').length,1);assert.equal(g.history.at(-1).event,'FAILED');
});
test('forged, reordered or duplicated journal success cannot admit recovery',async()=>{
  for(const events of [[{event:'COMPLETE'}],[{event:'PLAN'},{event:'STOPPED',target:targets[0]}],[{event:'PLAN'},{event:'PLAN'}]]){
    const f=fixture();f.history.push(...events.map((e,sequence)=>({sequence,digest:'a'.repeat(64),...e})));await assert.rejects(recoverCapturedTestOwner(f.options));assert.deepEqual(f.actions,[]);
  }
});
