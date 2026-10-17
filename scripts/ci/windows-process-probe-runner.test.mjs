import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {windowsProcessProbeDiagnostic,WINDOWS_PROCESS_PROBE_BUDGET_MS} from './run.mjs';
test('Windows probe diagnostics preserve finite timeout/status facts and never copy private OS text',()=>{
 const source={status:null,signal:'SIGTERM',error:{code:'ETIMEDOUT',message:'PRIVATE_OS_SECRET command --password hidden',path:'PRIVATE_OS_SECRET',spawnargs:['PRIVATE_OS_SECRET']},stderr:'PRIVATE_OS_SECRET'};
 assert.deepEqual(windowsProcessProbeDiagnostic(source,30058),{mode:'windows-process-probe',elapsedMs:30058,status:null,signal:'SIGTERM',errorCode:'ETIMEDOUT'});
 assert(!JSON.stringify(windowsProcessProbeDiagnostic(source,30058)).includes('PRIVATE_OS_SECRET'));
 assert.deepEqual(windowsProcessProbeDiagnostic({status:1,signal:null},125),{mode:'windows-process-probe',elapsedMs:125,status:1,signal:null,errorCode:null});
 for(const code of ['ENOENT','EACCES','EINVAL'])assert.equal(windowsProcessProbeDiagnostic({error:{code}},0).errorCode,code);
 const unknown=windowsProcessProbeDiagnostic({status:'PRIVATE_OS_SECRET',signal:'PRIVATE_OS_SECRET',error:{code:'PRIVATE_OS_SECRET'}},NaN);assert.deepEqual(unknown,{mode:'windows-process-probe',elapsedMs:0,status:null,signal:'OTHER_SIGNAL',errorCode:'OTHER_ERROR'});
});
test('fixed Windows fixture budget matches bounded unit budget and failures remain fatal',()=>{
 assert.equal(WINDOWS_PROCESS_PROBE_BUDGET_MS,180000);
 const source=fs.readFileSync(new URL('./run.mjs',import.meta.url),'utf8');
 const branch=source.slice(source.indexOf("} else if (mode === 'windows-process-probe')"),source.indexOf("} else if (['api'"));
 assert.match(branch,/hub-stack-process-probe\.test\.ps1/);assert.match(branch,/hub-stack-process-probe\.ps1/);assert.match(branch,/timeout: WINDOWS_PROCESS_PROBE_BUDGET_MS/);
 assert.match(branch,/result\.error \|\| result\.status !== 0/);assert.match(branch,/process\.exit\(result\.status \|\| 1\)/);assert.doesNotMatch(branch,/skip|process\.exit\(0\)/);
});
