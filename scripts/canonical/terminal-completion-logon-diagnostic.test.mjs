import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {classifyCompletionProcessExecFailure,completionProcessProbeExec,completionObserveProcess,completionDiagnosticProbe,completionFailureDiagnostic,runCompletionLogon,completionAttempt,COMPLETION_CORE_STAGES} from './terminal-completion-logon.mjs';
const owner='S-1-5-21-123-456-789-1001',source='b'.repeat(40),hash='a'.repeat(64),erp='C:\\Sirket\\ERP',crm='C:\\Sirket\\CRM';
function settings(){
 const refs=Object.fromEntries(['operationConfig','nativeOrderConfig','crmActivationConfig','hubPinConfig','hubStartupConfig'].map(key=>[key,{path:`${erp}\\runtime\\completion\\${key}.json`,sha256:hash}]));
 const packageRoot=erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-bbbbbbb';
 const components=Object.fromEntries(['erpApiNative','nativeOrder','crm','hub'].map(name=>[name,{packageRoot:name==='crm'?crm+'\\releases\\crm-shared-test-'+source:packageRoot,sourceCommit:source,manifestSha256:hash,config:refs[{erpApiNative:'operationConfig',nativeOrder:'nativeOrderConfig',crm:'crmActivationConfig',hub:'hubStartupConfig'}[name]]}]));
 return {schemaVersion:1,ownerSid:owner,actualT1:false,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',lanAddress:'192.168.1.46',runtimeDirectory:erp+'\\runtime\\terminal-completion-logon',node:{path:'C:\\Program Files\\nodejs\\node.exe',sha256:hash},supervisor:{packageRoot,sourceCommit:source,manifestSha256:hash},components,privateSources:refs,dependencyLocks:Object.fromEntries(['erpApiNative','nativeOrder','crm'].map(name=>[name,{path:erp+'\\runtime\\terminal-completion-logon\\'+name+'-'+components[name].sourceCommit.slice(0,12)+'-dependency-lock.json',sha256:hash}])),crmPrivateFiles:{baseline:{path:crm+'\\runtime\\normal-baseline.env',sha256:hash},catalogAccess:{path:erp+'\\runtime\\catalog-access.json',sha256:hash}}};
}

test('nested failing probe retains exact child and phase without serializing secrets',async()=>{
 const error=Object.assign(new Error('PASSWORD SQL SELECT private-path 100.00'),{name:'TimeoutError',code:'ETIMEOUT',stdout:'SECRET',stderr:'SECRET',query:'SECRET',params:{password:'SECRET'},stack:'SECRET'});
 await assert.rejects(completionDiagnosticProbe('supervisor','monitor',()=>completionDiagnosticProbe('erpApi','health',async()=>{throw error;})),e=>e===error);
 const safe=completionFailureDiagnostic(error);assert.deepEqual(safe,{stage:'erpApi',phase:'health',errorType:'TimeoutError',staticCode:'ETIMEOUT'});assert(!JSON.stringify(safe).includes('SECRET'));assert(!JSON.stringify(safe).includes('100.00'));assert(!JSON.stringify(safe).includes('PASSWORD'));
});
test('process and CRM failures use only enum types/codes; forged fields cannot enter record',async()=>{
 for(const [stage,phase] of [['erpNative','processProbe'],['crmServer','CRM'],['hub','hub']]){const error=Object.assign(new Error('SECRET'),{name:'C:/secret/name',code:'SQL SELECT password=SECRET',stage:'SECRET',phase:'SECRET',number:51904});await assert.rejects(completionDiagnosticProbe(stage,phase,async()=>{throw error;}));assert.deepEqual(completionFailureDiagnostic(error),{stage,phase,errorType:'OtherError',staticCode:'UNCLASSIFIED'});}
 assert.equal(completionFailureDiagnostic(Object.assign(new Error(),{diagnostic:{stage:'erpApi'}})),null);
 await assert.rejects(completionDiagnosticProbe('SECRET','health',()=>assert.fail()),/DIAGNOSTIC_SCOPE/);
});
test('unknown process observation persists bounded diagnostic and quarantines without cleanup or replacement attempt',async()=>{
 const records=[],delays=[];let attempts=0,stops=0;const driver={verify:async()=>{},sqlReady:async()=>{},inspect:async()=>[],start:async()=>({pid:1}),ready:async stage=>{attempts++;await completionDiagnosticProbe(stage.name,'processProbe',()=>completionObserveProcess(async()=>{throw new Error('SECRET SQL params');},{delay:async()=>assert.fail()}));},stop:async()=>{stops++;return true;},quarantine:async()=>{},failure:async(code,stages,diagnostic)=>records.push({code,stages,diagnostic})};
 await assert.rejects(runCompletionLogon({configPath:erp+'\\runtime\\completion\\launcher.json',configSha256:hash,ownerSid:owner,action:'Start',driverFactory:async()=>driver,loadSettings:()=>settings(),delay:async ms=>delays.push(ms)}),/OBSERVATION_QUARANTINED/);
 assert.equal(attempts,1);assert.equal(stops,0);assert.deepEqual(delays,[]);assert.equal(records.length,2);assert.equal(records[0].code,'OBSERVATION_QUARANTINED');assert.deepEqual(records[0].diagnostic,{stage:'erpNative',phase:'processProbe',errorType:'Error',staticCode:'UNCLASSIFIED'});for(const row of records)assert(!JSON.stringify(row).includes('SECRET'));
});
test('monitor exception still stops all newly created children in reverse order',async()=>{
 const stopped=[],error=Object.assign(new Error('SECRET'),{code:'ECONNRESET'}),driver={verify:async()=>{},sqlReady:async()=>{},inspect:async()=>[],start:async()=>({pid:1}),ready:async()=>{},hubReady:async()=>{},monitor:async()=>{throw error;},stop:async stage=>{stopped.push(stage.name);return true;}};
 await assert.rejects(completionAttempt(settings(),driver),e=>e===error);assert.deepEqual(stopped,[...COMPLETION_CORE_STAGES].reverse().map(s=>s.name));assert.deepEqual(completionFailureDiagnostic(error),{stage:'supervisor',phase:'monitor',errorType:'Error',staticCode:'ECONNRESET'});
});
test('production driver retains original process and HTTP thresholds and bounded failure writer',()=>{
 const source=fs.readFileSync(new URL('./terminal-completion-logon.mjs',import.meta.url),'utf8');assert(source.includes('timeout:10000,maxBuffer:128*1024'));assert(source.includes('AbortSignal.timeout(4000)'));assert(source.includes('setTimeout(resolve,15000)'));assert(source.includes('safeCompletionDiagnostic(diagnostic)'));assert(source.includes('await delay(60000)'));
});

test('caught exec failure distinguishes killed, nonzero and only exact reported OS disappearance without secret fields',async()=>{
 const secret='SECRET password SQL params path command 100.00';
 for(const [fields,outcome] of [[{killed:true,signal:'SIGTERM',code:null},'EXEC_KILLED'],[{killed:false,code:1},'EXEC_EXIT_NONZERO'],[{killed:false,code:1,stderr:"throw 'HUB_STACK_OS_PROCESS_DISAPPEARED'"},'EXEC_PROCESS_DISAPPEARED_REPORTED']]){
  const error=Object.assign(new Error(secret),{name:'Error',message:secret,stdout:secret,stderr:secret,command:secret,stack:secret,...fields});let time=0;
  await assert.rejects(completionDiagnosticProbe('supervisor','monitor',()=>completionDiagnosticProbe('erpNative','processProbe',()=>completionProcessProbeExec(async()=>{throw error;},{now:()=>{const result=time;time=10012;return result;}}))),e=>e===error);
  const record=completionFailureDiagnostic(error);assert.equal(record.stage,'erpNative');assert.equal(record.phase,'processProbe');assert.equal(record.processExec.outcome,outcome);assert.equal(record.processExec.elapsedMs,10012);assert.equal(record.processExec.killed,fields.killed);assert(!JSON.stringify(record).includes(secret));assert(!JSON.stringify(record).includes('HUB_STACK_OS_PROCESS_DISAPPEARED'));assert.deepEqual(Object.keys(record.processExec).sort(),['outcome','killed','elapsedMs',...(fields.signal?['signal']:[]),...(fields.code===1?['exitCode']:[])].sort());
 }
});
test('malicious or malformed exec values never enter diagnostics and similar sentinel text is not accepted',()=>{
 const input={killed:'SECRET',signal:'C:/private',code:'1',stderr:'HUB_STACK_OS_PROCESS_DISAPPEARED_SECRET',message:'SECRET',stdout:'SECRET',cmd:'SECRET',params:{SECRET:true},stack:'SECRET'};
 assert.deepEqual(classifyCompletionProcessExecFailure(input,'10000'),{outcome:'EXEC_ERROR'});
 for(const code of [-1,1.5,NaN,Infinity,2147483648,'1',{},null])assert.equal(classifyCompletionProcessExecFailure({...input,code},60001).exitCode,undefined);
 assert.equal(classifyCompletionProcessExecFailure({...input,stderr:'x'.repeat(128*1024)+'HUB_STACK_OS_PROCESS_DISAPPEARED'},1).outcome,'EXEC_ERROR');
 for(const elapsed of [-1,1.5,NaN,Infinity,60001,'5'])assert.equal(classifyCompletionProcessExecFailure({},elapsed).elapsedMs,undefined);
 assert.deepEqual(classifyCompletionProcessExecFailure({killed:true,signal:'UNTRUSTED',code:-1},0),{outcome:'EXEC_KILLED',killed:true,elapsedMs:0});
});
test('exec wrapper preserves success/original error and cannot attach fields to non-process probes or caller-forged errors',async()=>{
 const result={stdout:'kept in memory'};assert.equal(await completionProcessProbeExec(async()=>result),result);
 const forged=Object.assign(new Error('SECRET'),{processExec:{outcome:'EXEC_KILLED',command:'SECRET'}});await assert.rejects(completionDiagnosticProbe('erpNative','processProbe',async()=>{throw forged;}));assert.equal(completionFailureDiagnostic(forged).processExec,undefined);
 const error=Object.assign(new Error('SECRET'),{code:2,killed:false});await assert.rejects(completionDiagnosticProbe('erpApi','health',()=>completionProcessProbeExec(async()=>{throw error;})));assert.equal(completionFailureDiagnostic(error).processExec,undefined);
});

test('malicious exec-error getters cannot mask the original failure or persist private thrown text',async()=>{
 const error=new Error('PRIVATE');Object.defineProperty(error,'stderr',{get(){throw Error('PRIVATE GETTER');}});
 await assert.rejects(completionDiagnosticProbe('erpNative','processProbe',()=>completionProcessProbeExec(async()=>{throw error;},{now:()=>0})),e=>e===error);
 assert.deepEqual(completionFailureDiagnostic(error).processExec,{outcome:'EXEC_ERROR',elapsedMs:0});assert(!JSON.stringify(completionFailureDiagnostic(error)).includes('PRIVATE'));
});
