import test from 'node:test';import assert from 'node:assert/strict';
import {crm06StopCaptured} from './crm06-stop-child-diagnostic.mjs';
const item={pid:101,parentPid:100,nodePath:'C:\\fixture\\node.exe',ownerSid:'S-1-5-21-1',commandLine:'fixture secret command',creationTime:'2026-10-15T00:00:00.1234560Z'};
const options=Object.freeze({windowsHide:true,timeout:45000,maxBuffer:1048576,env:{fixture:'SECRET'}});
const invoke=(run,extra={})=>crm06StopCaptured(item,{run,shell:'fixture-shell',stopper:'fixture-stopper',options,target:'coreWatcher',...extra});
test('retains child rejection metadata before the same error escapes',async()=>{
 const error=Object.assign(new Error('SECRET command SQL token'),{code:7,stdout:'SECRET output',stderr:'CRM06_EXACT_OBSERVATION_STOP_REJECTED',signal:null,killed:false}),records=[];let calls=0;
 await assert.rejects(invoke(async()=>{calls++;throw error;},{onDiagnostic:r=>records.push(r)}),e=>e===error);
 assert.equal(calls,1);assert.equal(records.length,1);assert.equal(records[0].outcome,'EXEC_REJECTED');assert.equal(records[0].childExitCode,7);assert.equal(records[0].stderrKind,'STOP_REJECTED');assert(!JSON.stringify(records).includes('SECRET'));
});
// Exact original call/acceptance semantics, injected executor only. It has no
// child_process import; the fake shell/stopper names are never executed.
async function legacyStopCaptured(value,{run,shell,stopper,options}){
 const proof={pid:value.pid,parentPid:value.parentPid,nodePath:value.nodePath,ownerSid:value.ownerSid,commandLine:value.commandLine,creationTime:value.creationTime.replace(/(\.\d{6})0Z$/,'$1Z')};
 const r=await run(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',stopper,'-ExpectedJsonBase64',Buffer.from(JSON.stringify(proof)).toString('base64')],options);
 if(!(!r.stderr&&['EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE'].includes(r.stdout.trim())))throw Error('REJECTED');return {pid:proof.pid,result:r.stdout.trim()};
}
test('unchanged exact arguments, proof, timeout and acceptance/refusal matrix',async()=>{
 const cases=[{stdout:'EXACT_OBSERVED_PROCESS_STOPPED\r\n',stderr:''},{stdout:'ALREADY_GONE',stderr:''},{stdout:'ALREADY_GONE',stderr:' '},{stdout:'ALREADY_GONE',stderr:'CRM06_EXACT_OBSERVATION_STOP_REJECTED'},{stdout:'',stderr:''},{stdout:'SECRET',stderr:''},{stdout:null,stderr:''},undefined];
 for(const value of cases){
  const run=async(call,records)=>{const deps={run:async(...args)=>{records.push(args);return value;},shell:'fixture-shell',stopper:'fixture-stopper',options};try{return {value:await call(item,deps)};}catch(error){return {errorName:error.name,errorMessage:error.message};}};
  const beforeCalls=[],afterCalls=[];assert.deepEqual(await run(legacyStopCaptured,beforeCalls),await run(crm06StopCaptured,afterCalls));assert.deepEqual(beforeCalls,afterCalls);assert.equal(afterCalls.length,1);assert.equal(afterCalls[0][2],options);
  const proof=JSON.parse(Buffer.from(afterCalls[0][1].at(-1),'base64'));assert.equal(proof.creationTime,'2026-10-15T00:00:00.123456Z');assert.equal(proof.ownerSid,item.ownerSid);assert.equal(proof.commandLine,item.commandLine);
 }
});
test('an exit-zero output refusal remains a refusal and has a different diagnostic',async()=>{
 for(const value of [{stdout:'ALREADY_GONE',stderr:'SECRET stderr'},{stdout:'SECRET stdout',stderr:''},{stdout:'ALREADY_GONE',stderr:' '}]){
  const records=[];await assert.rejects(invoke(async()=>value,{onDiagnostic:r=>records.push(r)}),{message:'REJECTED'});assert.equal(records.length,1);assert.equal(records[0].outcome,'RESULT_REJECTED');assert.equal(records[0].childExitCode,0);assert(!JSON.stringify(records).includes('SECRET'));
 }
});
test('successful child result is preserved before a later child or port guard fails',async()=>{
 const records=[],sink=r=>records.push(r);await invoke(async()=>({stdout:'ALREADY_GONE',stderr:''}),{onDiagnostic:sink});
 const error=Object.assign(new Error('SECRET'),{code:3});await assert.rejects(invoke(async()=>{throw error;},{target:'hubWatcher',onDiagnostic:sink}),e=>e===error);
 assert.deepEqual(records.map(r=>[r.target,r.outcome,r.childExitCode]),[['coreWatcher','ACCEPTED',0],['hubWatcher','EXEC_REJECTED',3]]);
 const guardError=new Error('REJECTED');assert.throws(()=>{throw guardError;},e=>e===guardError);assert.equal(records.length,2); // no invented clearPorts result
});
test('throwing, rejecting or pending receipt sinks cannot mask success or original failure',async()=>{
 for(const sink of [()=>{throw Error('SECRET sink');},()=>Promise.reject(Error('SECRET async sink')),()=>new Promise(()=>{})]){
  assert.deepEqual(await invoke(async()=>({stdout:'ALREADY_GONE',stderr:''}),{onDiagnostic:sink}),{pid:101,result:'ALREADY_GONE'});
  const error=new Error('SECRET caller');await assert.rejects(invoke(async()=>{throw error;},{onDiagnostic:sink}),e=>e===error);
 }
});
test('only finite exit/code/signal fields survive; other errors remain unchanged',async()=>{
 for(const code of [0,2147483647,-1,2147483648,1.5,NaN,'ETIMEDOUT','SECRET']){
  const error=Object.assign(new TypeError('SECRET'),{code,stdout:'SECRET',stderr:'SECRET',signal:'SECRET',killed:true,stack:'SECRET',command:'SECRET'}),records=[];
  await assert.rejects(invoke(async()=>{throw error;},{target:'SECRET',onDiagnostic:r=>records.push(r)}),e=>e===error);
  const d=records[0];assert.equal(d.childExitCode,Number.isSafeInteger(code)&&code>=0&&code<=2147483647?code:null);assert.equal(d.staticCode,code==='ETIMEDOUT'?'ETIMEDOUT':'UNCLASSIFIED');assert.equal(d.signal,null);assert.equal(d.target,'UNKNOWN_TARGET');assert.equal(d.errorType,'TypeError');assert(!JSON.stringify(d).includes('SECRET'));
 }
});
test('oversize output is reduced to finite kinds, never serialized',async()=>{
 const records=[],error=Object.assign(Error('SECRET'),{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',stdout:'x'.repeat(4097),stderr:'y'.repeat(4097),signal:'SIGTERM',killed:true});await assert.rejects(invoke(async()=>{throw error;},{onDiagnostic:r=>records.push(r)}),e=>e===error);
 assert.equal(records[0].stdoutKind,'OVERSIZE');assert.equal(records[0].stderrKind,'OVERSIZE');assert.equal(records[0].signal,'SIGTERM');assert.equal(records[0].killed,true);assert(JSON.stringify(records[0]).length<500);
});
test('diagnostic projection never reads raw error accessors',async()=>{
 let reads=0;const error=Object.assign(new Error('SECRET'),{code:1});for(const key of ['stdout','stderr','signal','killed'])Object.defineProperty(error,key,{get(){reads++;throw Error('SECRET getter');}});
 const records=[];await assert.rejects(invoke(async()=>{throw error;},{onDiagnostic:r=>records.push(r)}),e=>e===error);assert.equal(reads,0);assert.equal(records[0].stdoutKind,'UNAVAILABLE');assert.equal(records[0].childExitCode,1);
});
test('invalid proof input still fails before any executor or diagnostic call',async()=>{
 let calls=0;await assert.rejects(crm06StopCaptured({...item,creationTime:null},{run:()=>{calls++;},onDiagnostic:()=>{calls++;}}),TypeError);assert.equal(calls,0);
});
