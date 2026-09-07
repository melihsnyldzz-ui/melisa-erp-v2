import test from 'node:test';import assert from 'node:assert/strict';
import {assertIdentity,restartTransaction} from './guarded-runtime.mjs';
const identity={pid:42,created:'2026-09-07T00:00:00.123Z',port:4100,cwd:'C:\\ERP\\apps\\api',executable:'C:\\node\\node.exe',commandLine:'node src/server.js'};
test('ownership rejects PID reuse, wrong executable, cwd, entry point and port',()=>{
 assert.doesNotThrow(()=>assertIdentity({...identity},identity));
 for(const patch of [{pid:43},{created:'other'},{cwd:'C:\\other'},{executable:'C:\\other\\node.exe'},{commandLine:'node unrelated.js'},{port:4324}])assert.throws(()=>assertIdentity({...identity,...patch},identity),/RUNTIME_IDENTITY_CHANGED/);
});
function rig(fail) {const events=[];const fn=(name,value)=>async()=>{events.push(name);if(name===fail)throw Error('TEST_FAILURE');return value};return {events,io:{preflight:fn('preflight',identity),save:fn('save'),stop:fn('stop'),waitDown:fn('down'),start:fn('start',{pid:43}),ready:fn('ready'),verify:fn('verify'),commit:fn('commit'),stopStarted:fn('stop-new'),restore:fn('restore'),startRollback:fn('start-old',{pid:44}),rollbackCommit:fn('rollback-commit')}};}
test('unhealthy/unidentified preflight cannot stop a service',async()=>{const r=rig('preflight');await assert.rejects(()=>restartTransaction(r.io));assert.deepEqual(r.events,['preflight']);});
test('a failure to record rollback prevents service interruption',async()=>{const r=rig('save');await assert.rejects(()=>restartTransaction(r.io));assert.deepEqual(r.events,['preflight','save']);});
test('restart requires confirmed down, ready and live reads before publishing state',async()=>{const r=rig();assert.deepEqual(await restartTransaction(r.io),{deployed:true,rollbackUsed:false});assert.deepEqual(r.events,['preflight','save','stop','down','start','ready','verify','commit']);});
test('product/read regression stops only the newly started instance and restores old runtime',async()=>{const r=rig('verify');assert.equal((await restartTransaction(r.io)).rollbackUsed,true);assert.deepEqual(r.events,['preflight','save','stop','down','start','ready','verify','stop-new','down','restore','start-old','ready','rollback-commit']);});
test('failed start invokes rollback without guessing or stopping an unrelated PID',async()=>{const r=rig('start');assert.equal((await restartTransaction(r.io)).rollbackUsed,true);assert.equal(r.events.includes('stop-new'),false);assert.ok(r.events.includes('start-old'));});
test('rollback failure is explicit, never reported as deployment success',async()=>{const r=rig('verify');r.io.restore=async()=>{throw Error('RESTORE_FAILED')};await assert.rejects(()=>restartTransaction(r.io),/RUNTIME_ROLLBACK_FAILED/);});
test('policy rejection never retries through another process-control path',async()=>{const r=rig();r.io.start=async()=>{throw Error('RUNTIME_EXECUTION_POLICY_REJECTED')};await assert.rejects(()=>restartTransaction(r.io),/RUNTIME_EXECUTION_POLICY_REJECTED/);assert.equal(r.events.includes('start-old'),false);});

