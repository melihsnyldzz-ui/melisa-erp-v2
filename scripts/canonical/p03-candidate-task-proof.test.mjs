import test from 'node:test';
import assert from 'node:assert/strict';
import {assertP03CandidateTaskProof,assertP03NewLineageTaskProof} from './p03-candidate-task-proof.mjs';

const root='C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-c4010efa8ff6';
const settings='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e0e6c28.json';
const hash='201a159b9b51058896d25961c5292d1d8e22cc3a76024958b4c324de07896e35';
const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const pin={packageRoot:root,sourceCommit:'c4010efa8ff6b49f3e342032c98611a26c41cfaf',manifestSha256:'4fecac939834ee66266472bfc2d0d4ede3c475292971183da6e58de006c58590'};
const sid='S-1-5-21-111-222-333-1001',systemSid='S-1-5-18';
function fixture(){
 const names=[['Melisa-Terminal-Completion-Logon','watch-terminal-completion-logon.ps1',53356,61001,'11111111-1111-4111-8111-111111111111'],['Melisa-Hub-TEST-Web','watch-hub-after-erp.ps1',49164,61002,'22222222-2222-4222-8222-222222222222']];
 const tasks=names.map(([name,script,oldEnginePid])=>{
  const args=`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${root}\\scripts\\canonical\\${script}" -StartupConfigPath "${settings}" -StartupConfigSha256 ${hash}`;
  return {name,path:'\\'+name,oldEnginePid,currentAction:shell,action:{execute:shell,arguments:args,workingDirectory:root},settingsSha256:hash,supervisorPin:{...pin},watcherExecutablePath:shell,watcherCommandLine:`"${shell}" ${args}`};
 });
 return {beforeImage:{capturedAt:'2026-10-17T10:00:00.000Z',oldWatchers:names.map(([name,,pid])=>({name,pid,creationTime:'2026-10-17T09:30:00.000Z'}))},expected:{ownerSid:sid,scheduleServiceExecutablePath:'C:\\Windows\\System32\\svchost.exe',scheduleServiceCommandLine:'C:\\Windows\\system32\\svchost.exe -k netsvcs -p',tasks},observed:{capturedAt:'2026-10-17T10:03:00.000Z',runningTaskCollection:'Schedule.Service.GetRunningTasks(1)',processInventoryScope:'CIM.Win32_Process.AllP03WatcherCommands',scheduleService:{name:'Schedule',state:'Running',startName:'LocalSystem',pathName:'C:\\WINDOWS\\system32\\svchost.exe -k netsvcs -p',processId:1000},scheduleServiceProcess:{name:'svchost.exe',processId:1000,ownerResult:{code:0,sid:systemSid},executablePath:'C:\\Windows\\System32\\svchost.exe',commandLine:'C:\\Windows\\system32\\svchost.exe -k netsvcs -p',pathArgvMarker:null,creationTime:'2026-10-17T09:00:00.000Z'},registeredTasks:tasks.map(t=>({name:t.name,path:t.path,state:4,ownerSid:sid,action:{...t.action},settingsSha256:t.settingsSha256,supervisorPin:{...t.supervisorPin},taskInfoLastRunTime:'2026-10-17T10:01:00.000Z'})),runningTasks:tasks.map((t,i)=>({name:t.name,path:t.path,state:4,currentAction:shell,enginePID:names[i][3],instanceGuid:names[i][4]})),processes:tasks.map((t,i)=>({processId:names[i][3],ownerSid:sid,executablePath:shell,commandLine:t.watcherCommandLine,creationTime:'2026-10-17T10:01:01.000Z',parentProcessId:1000}))}};
}
test('two distinct new COM-backed task engines with exact metadata are conditionally consistent',()=>{
 const result=assertP03CandidateTaskProof(fixture());
 assert.equal(result.status,'CONDITIONAL_CONSISTENCY');assert.deepEqual(result.enginePids,[61001,61002]);
});
test('rejects a manual process, stale PID, duplicate COM instance and foreign action',()=>{
 const changes=[
  x=>x.observed.runningTasks.splice(0,1),
  x=>x.observed.runningTasks[0].enginePID=53356,
  x=>x.observed.runningTasks[1].enginePID=61001,
  x=>x.observed.runningTasks[1].instanceGuid=x.observed.runningTasks[0].instanceGuid,
  x=>x.observed.runningTasks[0].currentAction='C:\\Other\\powershell.exe',
  x=>x.observed.registeredTasks[0].action.arguments+=' -Other',
  x=>x.observed.registeredTasks[0].action.execute='C:\\Other\\powershell.exe',
  x=>x.expected.tasks[0].action.arguments+=' -Other',
  x=>x.observed.runningTaskCollection='Schedule.Service.GetRunningTasks(0)',
 ];
 for(const change of changes){const x=fixture();change(x);assert.throws(()=>assertP03CandidateTaskProof(x),{code:'P03_TASK_IDENTITY_REJECTED'});}
});
test('rejects wrong owner, service parent, package pins, chronology and missing task info',()=>{
 const changes=[
  x=>x.observed.processes[0].ownerSid=systemSid,
  x=>x.observed.processes[0].parentProcessId=999,
  x=>x.observed.scheduleServiceProcess.commandLine+=' -foreign',
  x=>x.observed.registeredTasks[0].supervisorPin.manifestSha256='0'.repeat(64),
  x=>x.expected.tasks[0].supervisorPin.sourceCommit='0'.repeat(40),
  x=>x.observed.registeredTasks[0].settingsSha256='0'.repeat(64),
  x=>x.observed.processes[0].creationTime=x.beforeImage.capturedAt,
  x=>x.observed.registeredTasks[0].taskInfoLastRunTime='2026-10-17T10:01:02.000Z',
  x=>delete x.observed.registeredTasks[0].taskInfoLastRunTime,
  x=>x.observed.registeredTasks[0].state=3,
 ];
 for(const change of changes){const x=fixture();change(x);assert.throws(()=>assertP03CandidateTaskProof(x),{code:'P03_TASK_IDENTITY_REJECTED'});}
});
test('protected before image binds old PID to each role and rejects malformed COM mode',()=>{
 const changes=[
  x=>x.expected.tasks[0].oldEnginePid=49164,
  x=>x.beforeImage.oldWatchers[0].pid=49164,
  x=>x.beforeImage.oldWatchers[0].name='Melisa-Hub-TEST-Web',
  x=>x.beforeImage.oldWatchers[0].creationTime='2026-10-17T10:00:01.000Z',
  x=>delete x.beforeImage.oldWatchers,
  x=>x.observed.runningTaskCollection='Schedule.Service.GetRunningTasks(0)',
 ];
 for(const change of changes){const x=fixture();change(x);assert.throws(()=>assertP03CandidateTaskProof(x),{code:'P03_TASK_IDENTITY_REJECTED'});}
});
test('complete CIM watcher inventory rejects extra manual lookalike and unproved scope',()=>{
 const changes=[
  x=>x.observed.processes.push({...x.observed.processes[0],processId:62000}),
  x=>x.observed.processes[1].processId=62000,
  x=>delete x.observed.processInventoryScope,
  x=>x.observed.processInventoryScope='CIM.Win32_Process.EnginePIDOnly',
 ];
 for(const change of changes){const x=fixture();change(x);assert.throws(()=>assertP03CandidateTaskProof(x),{code:'P03_TASK_IDENTITY_REJECTED'});}
});
test('Schedule LocalSystem owner may be verified or explicitly access denied',()=>{
 const denied=fixture();denied.observed.scheduleServiceProcess.ownerResult={code:2,sid:null,marker:'UNAVAILABLE_ACCESS_DENIED'};
 assert.equal(assertP03CandidateTaskProof(denied).status,'CONDITIONAL_CONSISTENCY');
 const deniedFields=fixture();deniedFields.observed.scheduleServiceProcess.ownerResult={code:2,sid:null,marker:'UNAVAILABLE_ACCESS_DENIED'};
 deniedFields.observed.scheduleServiceProcess.executablePath=null;deniedFields.observed.scheduleServiceProcess.commandLine='';
 deniedFields.observed.scheduleServiceProcess.pathArgvMarker='UNAVAILABLE_CIM_EMPTY';
 assert.equal(assertP03CandidateTaskProof(deniedFields).status,'CONDITIONAL_CONSISTENCY');
 const changes=[
  x=>x.observed.scheduleService.startName='LocalService',
  x=>x.observed.scheduleService.pathName='C:\\Other\\svchost.exe -k netsvcs -p',
  x=>x.observed.scheduleService.processId=2000,
  x=>x.observed.scheduleServiceProcess.name='powershell.exe',
  x=>x.observed.scheduleServiceProcess.commandLine+=' -foreign',
  x=>{x.observed.scheduleServiceProcess.executablePath=null;x.observed.scheduleServiceProcess.pathArgvMarker='UNAVAILABLE_CIM_EMPTY';},
  x=>{x.observed.scheduleServiceProcess.executablePath=null;x.observed.scheduleServiceProcess.commandLine='';},
  x=>x.observed.scheduleServiceProcess.pathArgvMarker='UNAVAILABLE_ACCESS_DENIED',
  x=>delete x.observed.scheduleServiceProcess.pathArgvMarker,
  x=>{x.observed.scheduleServiceProcess.executablePath=null;x.observed.scheduleServiceProcess.commandLine='';x.observed.scheduleServiceProcess.pathArgvMarker='UNAVAILABLE_ACCESS_DENIED';},
  x=>{x.observed.scheduleServiceProcess.executablePath=null;x.observed.scheduleServiceProcess.commandLine='';x.observed.scheduleServiceProcess.pathArgvMarker='FORGED';},
  x=>x.observed.scheduleServiceProcess.ownerResult={code:0,sid},
  x=>x.observed.scheduleServiceProcess.ownerResult={code:2,sid:null},
  x=>x.observed.scheduleServiceProcess.ownerResult={code:2,sid:systemSid,marker:'UNAVAILABLE_ACCESS_DENIED'},
  x=>x.observed.scheduleServiceProcess.ownerResult={code:5,sid:null,marker:'UNAVAILABLE_ACCESS_DENIED'},
  x=>x.observed.scheduleServiceProcess.creationTime='2026-10-17T10:00:01.000Z',
 ];
 for(const change of changes){const x=fixture();change(x);assert.throws(()=>assertP03CandidateTaskProof(x),{code:'P03_TASK_IDENTITY_REJECTED'});}
});
function newLineageFixture(){
 const x=fixture(),newRoot='C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-ba65c8cb2ca9',newSettings='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-1a03157.json',newHash='e4422f910fe92cf4dbed636b71eea515180131b617fc3329f2d9eeabc8f1b319';
 const newPin={packageRoot:newRoot,sourceCommit:'ba65c8cb2ca9826c98edd06bc5129e37b51bb64a',manifestSha256:'b5810d589ea1a4876cbb513d86b2ce90ef322f192e83845cac4e8f7103149435'};
 for(let i=0;i<2;i++){
  const e=x.expected.tasks[i],r=x.observed.registeredTasks[i],p=x.observed.processes[i];
  e.action.arguments=e.action.arguments.replaceAll(root,newRoot).replaceAll(settings,newSettings).replaceAll(hash,newHash);
  e.action.workingDirectory=newRoot;e.settingsSha256=newHash;e.supervisorPin={...newPin};e.watcherCommandLine=`"${shell}" ${e.action.arguments}`;
  r.action={...e.action};r.settingsSha256=newHash;r.supervisorPin={...newPin};p.commandLine=e.watcherCommandLine;
 }
 return x;
}
test('new ba65 COM task pair is conditional and rejects stale settings, old PID and foreign watcher',()=>{
 const x=newLineageFixture();assert.equal(assertP03NewLineageTaskProof(x).taskCount,2);
 assert.throws(()=>assertP03CandidateTaskProof(x),{code:'P03_TASK_IDENTITY_REJECTED'});
 for(const change of [v=>v.expected.tasks[0].settingsSha256=hash,v=>v.observed.runningTasks[0].enginePID=53356,v=>v.observed.processes.push({...v.observed.processes[0],processId:62000})]){const bad=newLineageFixture();change(bad);assert.throws(()=>assertP03NewLineageTaskProof(bad),{code:'P03_TASK_IDENTITY_REJECTED'});}
});
