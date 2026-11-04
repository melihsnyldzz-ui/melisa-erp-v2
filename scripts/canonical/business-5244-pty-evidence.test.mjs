import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTrace, validateReady, validateDebugPrompt } from './business-5244-pty-evidence.mjs';
const nonce = '1234567890abcdef1234567890abcdef';
const ready = { schema:'melisa-b6-pty-fixture-ready.v1', nonce, ownerPid:12345,
  ownerBirth:'134380173928338500', fixtureRoot:'C:\\Temp\\b6-pty-fixture-'+nonce,
  runspaceId:1, guardMilliseconds:60000, startedUtc:'2026-11-01T15:00:00.000Z', deadlineUtc:'2026-11-01T15:01:00.000Z' };
const expected = { nonce, ownerPid:ready.ownerPid, ownerBirth:ready.ownerBirth, fixtureRoot:ready.fixtureRoot,controllerPid:12346,controllerBirth:'134380173928338501',sourceSha256:'0'.repeat(64),nativeSha256:'1'.repeat(64) };
const event = (name, ms, extra={}) => ({ name, utc:new Date(Date.parse(ready.startedUtc)+ms).toISOString(), monotonicMs:ms, ...extra });
const prompt = '[DBG]: [Process:12345]: [Runspace1]: PS C:\\Temp>> ';
function trace(){return {ready, expected, events:[event('prompt-observed',1000,{output:prompt}), event('q-dispatch',2000),event('q-return',3000),event('retained-exit-observed',4000),event('signal-dispatch',5000),event('controller-return',6000)],receipt:{schema:'melisa-b6-pty-fixture-result.v1',...expected,ownerExitCode:0,status:'PASS',signalReads:1,ownerExited:true,mutexAcquired:true,mutexAbandoned:false,guardMilliseconds:60000,elapsedMilliseconds:6000}};}
test('one exact measured fixture passes without granting a transport bound or runtime authority',()=>{
 const result=classifyTrace(trace()); assert.equal(result.result,'PASS');assert.equal(result.runtimeGo,false);assert.equal(result.transportDeliveryBoundProven,false);assert.equal(result.automaticRetryAllowed,false);
});
for(const [name,patch,code] of [
 ['stale nonce',{nonce:'abcdef1234567890abcdef1234567890'},'PTY_READY_NONCE'],
 ['wrong PID',{ownerPid:12346},'PTY_READY_PID'],['wrong native birth',{ownerBirth:'134380173928338501'},'PTY_READY_BIRTH'],
 ['wrong root',{fixtureRoot:'C:\\Other'},'PTY_READY_ROOT'],['wrong runspace',{runspaceId:2},'PTY_READY_GUARD'],
 ['weakened guard',{guardMilliseconds:90000},'PTY_READY_GUARD'],['false deadline',{deadlineUtc:'2026-11-01T15:02:00.000Z'},'PTY_READY_DEADLINE']]){
 test(name+' READY rejects before any input',()=>assert.throws(()=>validateReady({...ready,...patch},expected),new RegExp(code)));
}
for(const output of ['PS C:\\Temp> ',prompt.replace('12345','12346'),prompt.replace('Runspace1','Runspace2'),prompt+'\nPS C:\\Temp> ', '[DBG]: [Process:12345]:\n[Runspace1]: PS C:\\Temp>> ']){
 test('nonexact or split debugger prompt rejects: '+JSON.stringify(output),()=>assert.throws(()=>validateDebugPrompt(output,12345),/PTY_PROMPT_MISMATCH/));
}
test('q requested before deadline but response after it remains UNKNOWN; queued input is never called cancelled',()=>{
 const value=trace();value.events=[event('prompt-observed',1000,{output:prompt}),event('q-dispatch',59000),event('q-return',61000)];delete value.receipt;
 const result=classifyTrace(value);assert.equal(result.result,'UNKNOWN');assert.equal(result.lateObserved,true);assert.equal(result.qCalls,1);assert.equal(result.signalCalls,0);
});
test('lost q response without retained exit does not authorize a signal or second q',()=>{
 const value=trace();value.events=value.events.slice(0,2);delete value.receipt;
 assert.equal(classifyTrace(value).result,'UNKNOWN');value.events.push(event('q-dispatch',2500));assert.throws(()=>classifyTrace(value),/PTY_REPEATED_INPUT/);
});
test('late first stdin cannot convert a failed 60-second receipt to success',()=>{
 const value=trace();value.events.at(-2).utc='2026-11-01T15:01:01.000Z';value.events.at(-1).utc='2026-11-01T15:01:02.000Z';value.receipt={...value.receipt,status:'FAILED',elapsedMilliseconds:60000};
 const result=classifyTrace(value);assert.equal(result.result,'FAIL');assert.equal(result.lateObserved,true);assert.equal(result.automaticRetryAllowed,false);
});
test('no prompt means no q; no retained exit means no signal',()=>{
 const value=trace();value.events=value.events.slice(1);assert.throws(()=>classifyTrace(value),/PTY_Q_WITHOUT_PROMPT/);
 const other=trace();other.events=other.events.filter(e=>e.name!=='retained-exit-observed');assert.throws(()=>classifyTrace(other),/PTY_SIGNAL_WITHOUT_EXIT/);
});
test('mismatched or missing durable receipt is UNKNOWN',()=>{
 const value=trace();value.receipt.nonce='abcdef1234567890abcdef1234567890';assert.equal(classifyTrace(value).result,'UNKNOWN');delete value.receipt;assert.equal(classifyTrace(value).result,'UNKNOWN');
});
test('nonmonotonic tool evidence and duplicate signal are rejected',()=>{
 const value=trace();value.events[2].monotonicMs=0;assert.throws(()=>classifyTrace(value),/PTY_TRACE_CLOCK/);
 const other=trace();other.events.push(event('signal-dispatch',7000));assert.throws(()=>classifyTrace(other),/PTY_REPEATED_INPUT/);
});
for(const elapsed of [-1,'6000',NaN,Infinity,null]) test('invalid receipt duration never passes: '+String(elapsed),()=>{const value=trace();value.receipt.elapsedMilliseconds=elapsed;assert.equal(classifyTrace(value).result,'UNKNOWN');});
for(const name of ['q-return','controller-return']) test('missing tool return never passes: '+name,()=>{const value=trace();value.events=value.events.filter(e=>e.name!==name);if(name==='q-return')assert.throws(()=>classifyTrace(value),/PTY_SIGNAL_WITHOUT_EXIT/);else assert.equal(classifyTrace(value).result,'UNKNOWN');});
test('exit preceding q cannot authorize a signal',()=>{const value=trace();value.events=value.events.filter(e=>e.name!=='retained-exit-observed');value.events.splice(1,0,event('retained-exit-observed',1500));assert.throws(()=>classifyTrace(value),/PTY_SIGNAL_WITHOUT_EXIT/);});
for(const key of ['schema','fixtureRoot','ownerExitCode','controllerPid','controllerBirth','sourceSha256','nativeSha256'])test('receipt identity mismatch stays UNKNOWN: '+key,()=>{const value=trace();delete value.receipt[key];assert.equal(classifyTrace(value).result,'UNKNOWN');});
for(const name of ['prompt-observed','retained-exit-observed','q-return','controller-return'])test('duplicate proof phase is rejected: '+name,()=>{const value=trace();value.events.push(event(name,7000,{output:prompt}));assert.throws(()=>classifyTrace(value),/PTY_REPEATED_PHASE/);});
test('unrecognized proof phase is rejected',()=>{const value=trace();value.events.push(event('invented',7000));assert.throws(()=>classifyTrace(value),/PTY_TRACE_PHASE/);});
