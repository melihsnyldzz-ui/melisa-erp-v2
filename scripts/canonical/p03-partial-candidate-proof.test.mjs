import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {COMPLETION_CORE_STAGES} from './terminal-completion-logon.mjs';
import {proveP03PartialCandidate} from './p03-partial-candidate-proof.mjs';
import {CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE,CRM06_STAFF_INTEGRATED_CRM_PACKAGE,CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME,crm06StaffSuccessorProfile,CRM06_STAFF_INTEGRATED_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';

const owner='S-1-5-21-123-456-789-1001',erp='C:\\Sirket\\ERP',crm='C:\\Sirket\\CRM';
const hash='e4422f910fe92cf4dbed636b71eea515180131b617fc3329f2d9eeabc8f1b319';
const supervisor={packageRoot:erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-ba65c8cb2ca9',sourceCommit:'ba65c8cb2ca9826c98edd06bc5129e37b51bb64a',manifestSha256:'b5810d589ea1a4876cbb513d86b2ce90ef322f192e83845cac4e8f7103149435'};
const nativeOrder={packageRoot:erp+'\\releases\\CRM-ORDER-DRAFT-TEST-20261013-7a41f64',sourceCommit:'7a41f6492273dd1ec0bcb086f820be5575372be8',manifestSha256:'6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'};
const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const oldRoles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
const q=values=>values.map(v=>'"'+v+'"').join(' ');
const raw=value=>{const b=Buffer.from(JSON.stringify(value));return {bytesBase64:b.toString('base64'),sha256:createHash('sha256').update(b).digest('hex'),aclProtected:true,createOnly:true,fsync:true};};
const stamp=n=>`2026-10-17T12:00:00.${String(n).padStart(7,'0')}Z`;
function make(){
 const p=crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-hub-lineage-20261017');
 const refs={operationConfig:{path:erp+'\\runtime\\completion\\operationConfig.json',sha256:hash},nativeOrderConfig:{path:erp+'\\runtime\\completion\\nativeOrderConfig.json',sha256:hash},crmActivationConfig:{path:erp+'\\runtime\\completion\\crmActivationConfig.json',sha256:hash},hubPinConfig:{path:erp+'\\runtime\\completion\\hubPinConfig.json',sha256:hash},hubStartupConfig:{path:p.nextPaths.hubStartup,sha256:'ad4419162f641c5bda94198f5fdae1474e1c189782fc21ea823c463382de560f'}};
 const components={erpApiNative:{...CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE,config:refs.operationConfig},nativeOrder:{...nativeOrder,config:refs.nativeOrderConfig},crm:{...CRM06_STAFF_INTEGRATED_CRM_PACKAGE,config:refs.crmActivationConfig},hub:{...CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE,config:refs.hubStartupConfig}};
 const settings={schemaVersion:1,ownerSid:owner,actualT1:false,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',lanAddress:'192.168.1.46',runtimeDirectory:erp+'\\runtime\\terminal-completion-logon',node:{...CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME},supervisor:{...supervisor},components,privateSources:refs,dependencyLocks:{erpApiNative:{path:p.erpDependencyLockPath,sha256:hash},nativeOrder:{path:erp+'\\runtime\\terminal-completion-logon\\nativeOrder-'+nativeOrder.sourceCommit.slice(0,12)+'-dependency-lock.json',sha256:hash},crm:{path:erp+'\\runtime\\terminal-completion-logon\\crm-'+components.crm.sourceCommit.slice(0,12)+'-dependency-lock.json',sha256:hash}},crmPrivateFiles:{baseline:{path:crm+'\\runtime\\normal-baseline.env',sha256:hash},catalogAccess:{path:erp+'\\runtime\\catalog-access.json',sha256:hash}}};
 const settingsRef={path:p.nextPaths.settings,sha256:hash};
 const task=(name,script)=>{const argumentsString=`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${supervisor.packageRoot}\\scripts\\canonical\\${script}" -StartupConfigPath "${settingsRef.path}" -StartupConfigSha256 ${hash}`;return {name,path:'\\'+name,ownerSid:owner,state:3,action:{execute:shell,arguments:argumentsString,workingDirectory:supervisor.packageRoot},settingsSha256:hash,supervisorPin:{...supervisor},taskInfoLastRunTime:stamp(10000)};};
 return {phase:'START_INTENT',now:'2026-10-17T12:00:02.0000000Z',settings,settingsRef,beforeImage:{observedAt:stamp(0),oldOwners:oldRoles.map((role,i)=>({role,pid:30+i,creationTime:'2026-10-11T11:00:00.0000000Z'}))},scheduleService:{name:'Schedule',state:'Running',startName:'LocalSystem',pathName:'C:\\WINDOWS\\system32\\svchost.exe -k netsvcs -p',processId:1000},scheduleServiceProcess:{name:'svchost.exe',processId:1000,ownerResult:{code:0,sid:'S-1-5-18'},pathArgvMarker:null,creationTime:'2026-10-11T10:00:00.0000000Z',executablePath:'C:\\Windows\\System32\\svchost.exe',commandLine:'C:\\Windows\\system32\\svchost.exe -k netsvcs -p'},registeredTasks:[task('Melisa-Terminal-Completion-Logon','watch-terminal-completion-logon.ps1'),task('Melisa-Hub-TEST-Web','watch-hub-after-erp.ps1')],runningTasks:[],observations:[],inventory:{processScope:'CIM.Win32_Process.AllP03CandidatesAndChildren',listenerScope:'Get-NetTCPConnection.Listen.AllP03Ports',processes:[],listeners:[]}};
}
function watcher(x,role,pidNumber,birth){
 const task=x.registeredTasks[role==='terminalWatcher'?0:1];task.state=4;
 const row={role,pid:pidNumber,ownerSid:owner,creationTime:birth,executablePath:shell,commandLine:`"${shell}" ${task.action.arguments}`,parentPid:1000,parentCreationTime:x.scheduleServiceProcess.creationTime,parentOwnerSid:'S-1-5-18',instanceGuid:role==='terminalWatcher'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222'};
 x.inventory.processes.push(row);x.runningTasks.push({name:task.name,path:task.path,state:4,currentAction:shell,enginePID:pidNumber,instanceGuid:row.instanceGuid});return row;
}
function core(x){
 const terminal=x.inventory.processes.find(p=>p.role==='terminalWatcher');
 const command=q([x.settings.node.path,'--no-maglev',supervisor.packageRoot+'\\scripts\\canonical\\terminal-completion-logon.mjs','--config',x.settingsRef.path,'--sha256',hash,'--owner-sid',owner,'--action','Start']);
 const s={role:'coreSupervisor',pid:13,parentPid:terminal.pid,parentCreationTime:terminal.creationTime,parentOwnerSid:owner,ownerSid:owner,nodePath:x.settings.node.path,creationTime:stamp(300000),commandLine:command};x.inventory.processes.push(s);
 for(const [i,stage] of COMPLETION_CORE_STAGES.entries()){
  const pin=x.settings.components[stage.component],creationTime=stamp(400000+i*10000),entry=pin.packageRoot+'\\'+stage.entry.replaceAll('/','\\');
  const row={role:stage.name,pid:100+i,parentPid:s.pid,ownerSid:owner,parentOwnerSid:owner,nodePath:x.settings.node.path,parentNodePath:x.settings.node.path,creationTime,managedCreationTime:creationTime,parentCreationTime:s.creationTime,parentCommandLine:command,commandLine:q([x.settings.node.path,'--no-maglev',entry,...(stage.component==='crm'?[]:[...(stage.mode?[stage.mode]:[]),pin.config.path])]),bindings:stage.ports.map(port=>({port,address:'127.0.0.1'}))};
  if(['erpApi','crmServer'].includes(stage.name))row.bindings.push({port:stage.ports[0],address:'192.168.1.46'});
  const receipt={run:`run-${i}`,pid:row.pid,parentPid:s.pid,parentCreationTime:s.creationTime,creationTime,stage:stage.name,sourceCommit:pin.sourceCommit,configSha256:pin.config.sha256,copyId:x.settings.copyId,actualT1:false};
  x.inventory.processes.push(row);x.inventory.listeners.push(...row.bindings.map(b=>({...b,pid:row.pid})));
  x.observations.push({stage:stage.name,row,receipt,receiptRef:{path:x.settings.runtimeDirectory+'\\'+stage.name+'.json',observedAt:stamp(800000),...raw(receipt)},observedAt:stamp(900000)});
 }
}
function full(){
 const x=make(),terminal=watcher(x,'terminalWatcher',11,stamp(100000)),hubWatcher=watcher(x,'hubWatcher',12,stamp(200000));core(x);
 const pin=x.settings.components.hub,run='a'.repeat(32),attempt=0,launcherBirth=stamp(250000),nodeBirth=stamp(350000),startedAt=stamp(700000);
 const launcher={pid:14,parentPid:hubWatcher.pid,birth:launcherBirth,sid:owner,argv:q([shell,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',pin.packageRoot+'\\scripts\\canonical\\start-hub-web.ps1','-StartupConfigPath',pin.config.path,'-Action','Start','-RunId',run,'-Attempt','0'])};
 const h={role:'hub',pid:15,parentPid:launcher.pid,parentCreationTime:launcherBirth,parentOwnerSid:owner,ownerSid:owner,nodePath:x.settings.node.path,creationTime:nodeBirth,commandLine:q([x.settings.node.path,pin.packageRoot+'\\apps\\api\\start-shared-test-copy-web.mjs',x.settings.privateSources.operationConfig.path]),bindings:[{address:'127.0.0.1',port:5234},{address:'192.168.1.46',port:5234}]};
 const lineage={schemaVersion:1,run,attempt,ownerSid:owner,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,manifestSha256:pin.manifestSha256,nodeSha256:x.settings.node.sha256,watcher:{pid:hubWatcher.pid,birth:hubWatcher.creationTime,sid:owner,argv:hubWatcher.commandLine},launcher,node:{pid:h.pid,parentPid:launcher.pid,birth:h.creationTime,sid:owner,argv:h.commandLine},bindings:h.bindings.map(b=>({...b,pid:h.pid})),startupConfig:{...pin.config},operationConfig:{...x.settings.privateSources.operationConfig},hubConfig:{...x.settings.privateSources.hubPinConfig},startedAt};
 const lineageRef={path:x.settings.runtimeDirectory+'\\hub-web\\hub-web-lineage-'+run+'-0.json',observedAt:stamp(800000),...raw(lineage)};
 const receipt={pid:h.pid,run,attempt,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,port:5234,lineagePath:lineageRef.path,lineageSha256:lineageRef.sha256,startedAt};
 const receiptRef={path:x.settings.runtimeDirectory+'\\hub-web\\hub-web-process-'+run+'-0.json',observedAt:stamp(850000),...raw(receipt)};
 x.hub={process:h,lineage,lineageRef,receipt,receiptRef};x.inventory.processes.push(h);x.inventory.listeners.push({pid:h.pid,address:'127.0.0.1',port:5234},{pid:h.pid,address:'192.168.1.46',port:5234});
 return x;
}
const denied=change=>{const x=full();change(x);assert.throws(()=>proveP03PartialCandidate(x),/P03_PARTIAL_CANDIDATE_REJECTED/);};
const recaptureHub=x=>{Object.assign(x.hub.lineageRef,raw(x.hub.lineage));x.hub.receipt.lineageSha256=x.hub.lineageRef.sha256;Object.assign(x.hub.receiptRef,raw(x.hub.receipt));};
test('zero roles and both Ready tasks are a conditional empty subset',()=>{const result=proveP03PartialCandidate(make());assert.deepEqual(result.roles,[]);assert.equal(result.status,'PARTIAL_CANDIDATE_CONDITIONAL_SUBSET');assert.equal(Object.hasOwn(result,'replayPermitted'),false);});
test('first and second Task Scheduler starts yield exact independent subsets',()=>{const x=make();watcher(x,'terminalWatcher',11,stamp(100000));assert.deepEqual(proveP03PartialCandidate(x).roles,['terminalWatcher']);watcher(x,'hubWatcher',12,stamp(200000));x.phase='STARTED';assert.deepEqual(proveP03PartialCandidate(x).roles,['terminalWatcher','hubWatcher']);});
test('full ten-role candidate is conditional only',()=>{const result=proveP03PartialCandidate(full());assert.equal(result.roles.length,10);assert.equal(Object.hasOwn(result,'replayPermitted'),false);assert.equal(result.stopPermitted,false);});
test('foreign, orphan and duplicate process/listener fail',()=>{
 denied(x=>x.inventory.processes.push({...x.inventory.processes[0],role:'terminalWatcher',pid:88}));
 denied(x=>x.inventory.processes.find(p=>p.role==='coreSupervisor').parentPid=99);
 denied(x=>x.inventory.listeners.push({pid:99,address:'127.0.0.1',port:4184}));
 denied(x=>x.inventory.listeners[0].pid=99);
 denied(x=>x.inventory.processes.find(p=>p.role==='erpApi').parentPid=99);
 denied(x=>x.inventory.processes.push({role:'lookalikeWatcher',pid:90,ownerSid:owner,creationTime:stamp(450000)}));
});
test('old PID reuse, changed receipts, altered action or instance fail',()=>{
 denied(x=>x.inventory.processes.find(p=>p.role==='hubWatcher').pid=38);
 denied(x=>x.observations[0].receipt.run='edited');
 denied(x=>x.hub.lineageRef.bytesBase64=Buffer.from('{}').toString('base64'));
 denied(x=>x.registeredTasks[0].action.arguments+=' -NoExit');
 denied(x=>x.runningTasks[0].instanceGuid='33333333-3333-4333-8333-333333333333');
 denied(x=>x.runningTasks[1].instanceGuid=x.runningTasks[0].instanceGuid);
 denied(x=>x.inventory.processes.find(p=>p.role==='crmCatalog').bindings.push({address:'192.168.1.46',port:62702}));
});
test('transient Hub parent without protected lineage is rejected',()=>denied(x=>delete x.hub.lineageRef));
test('Hub process and protected lineage bindings must match complete 5234 listeners',()=>{
 denied(x=>x.hub.process.bindings[0].address='0.0.0.0');
 denied(x=>x.hub.process.bindings[1]={...x.hub.process.bindings[0]});
 denied(x=>{x.hub.lineage.bindings[0].pid=99;recaptureHub(x);});
 denied(x=>{x.hub.lineage.bindings.pop();recaptureHub(x);});
 denied(x=>{x.hub.lineage.bindings[1]={...x.hub.lineage.bindings[0]};recaptureHub(x);});
 denied(x=>x.inventory.listeners[0].port=5234);
});
test('explicit CIM access denied for Schedule owner and path/argv preserves PID/birth lineage',()=>{
 const x=make(),service=x.scheduleServiceProcess;
 service.ownerResult={code:2,sid:null,marker:'UNAVAILABLE_ACCESS_DENIED'};
 service.executablePath=null;service.commandLine=null;service.pathArgvMarker='UNAVAILABLE_CIM_EMPTY';
 watcher(x,'terminalWatcher',11,stamp(100000));
 assert.deepEqual(proveP03PartialCandidate(x).roles,['terminalWatcher']);
});
test('Schedule CIM unavailable markers must be complete and exact',()=>{
 for(const mutate of [
  x=>x.scheduleServiceProcess.ownerResult={code:2,sid:null},
  x=>x.scheduleServiceProcess.ownerResult={code:2,sid:'S-1-5-18',marker:'UNAVAILABLE_ACCESS_DENIED'},
  x=>x.scheduleServiceProcess.ownerResult={code:0,sid:'S-1-5-21-1'},
  x=>{x.scheduleServiceProcess.executablePath=null;x.scheduleServiceProcess.pathArgvMarker='UNAVAILABLE_CIM_EMPTY';},
  x=>{x.scheduleServiceProcess.executablePath=null;x.scheduleServiceProcess.commandLine=null;x.scheduleServiceProcess.pathArgvMarker=null;},
  x=>{x.scheduleServiceProcess.pathArgvMarker='UNAVAILABLE_CIM_EMPTY';},
 ]){const x=make();mutate(x);assert.throws(()=>proveP03PartialCandidate(x),/P03_PARTIAL_CANDIDATE_REJECTED/);}
});
