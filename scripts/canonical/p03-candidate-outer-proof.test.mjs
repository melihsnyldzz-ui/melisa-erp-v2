import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {COMPLETION_CORE_STAGES} from './terminal-completion-logon.mjs';
import {proveP03CandidateOuter,proveP03NewLineageOuter} from './p03-candidate-outer-proof.mjs';
import {CRM06_STAFF_INTEGRATED_CRM_PACKAGE,CRM06_STAFF_ERP_INTEGRATED_PACKAGE,CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE,CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME,crm06StaffSuccessorProfile,CRM06_STAFF_INTEGRATED_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';

const owner='S-1-5-21-123-456-789-1001',source='b'.repeat(40),hash='201a159b9b51058896d25961c5292d1d8e22cc3a76024958b4c324de07896e35';
const erp='C:\\Sirket\\ERP',crm='C:\\Sirket\\CRM';
function settings(){
 const refs=Object.fromEntries(['operationConfig','nativeOrderConfig','crmActivationConfig','hubPinConfig','hubStartupConfig'].map(key=>[key,{path:`${erp}\\runtime\\completion\\${key}.json`,sha256:hash}]));
 const packageRoot=erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-bbbbbbb';
 const nativePin={packageRoot:'C:\\Sirket\\ERP\\releases\\CRM-ORDER-DRAFT-TEST-20261013-7a41f64',sourceCommit:'7a41f6492273dd1ec0bcb086f820be5575372be8',manifestSha256:'6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'};
 const components=Object.fromEntries(['erpApiNative','nativeOrder','crm','hub'].map(name=>[name,{...(name==='crm'?CRM06_STAFF_INTEGRATED_CRM_PACKAGE:name==='nativeOrder'?nativePin:CRM06_STAFF_ERP_INTEGRATED_PACKAGE),config:refs[{erpApiNative:'operationConfig',nativeOrder:'nativeOrderConfig',crm:'crmActivationConfig',hub:'hubStartupConfig'}[name]]}]));
 return {schemaVersion:1,ownerSid:owner,actualT1:false,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',lanAddress:'192.168.1.46',runtimeDirectory:erp+'\\runtime\\terminal-completion-logon',node:{...CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME},supervisor:{packageRoot:erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-c4010efa8ff6',sourceCommit:'c4010efa8ff6b49f3e342032c98611a26c41cfaf',manifestSha256:'4fecac939834ee66266472bfc2d0d4ede3c475292971183da6e58de006c58590'},components,privateSources:refs,dependencyLocks:Object.fromEntries(['erpApiNative','nativeOrder','crm'].map(name=>[name,{path:erp+'\\runtime\\terminal-completion-logon\\'+name+'-'+components[name].sourceCommit.slice(0,12)+'-dependency-lock.json',sha256:hash}])),crmPrivateFiles:{baseline:{path:crm+'\\runtime\\normal-baseline.env',sha256:hash},catalogAccess:{path:erp+'\\runtime\\catalog-access.json',sha256:hash}}};
}
function fixture(){
 const s=settings(),observations=COMPLETION_CORE_STAGES.map((stage,index)=>{
  const pin=s.components[stage.component],entry=pin.packageRoot+'\\'+stage.entry.replaceAll('/','\\'),parent=s.supervisor.packageRoot+'\\scripts\\canonical\\terminal-completion-logon.mjs',creation=`2026-10-17T12:00:00.${String(2000000+index*10000)}Z`,parentCreation='2026-10-17T12:00:00.1000000Z';
  const args=[s.node.path,'--no-maglev',entry,...(stage.component==='crm'?[]:[...(stage.mode?[stage.mode]:[]),pin.config.path])];
  const settingsPath=crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-integrated-20261017').nextPaths.settings;
  const row={pid:100+index,parentPid:11,ownerSid:owner,parentOwnerSid:owner,nodePath:s.node.path,parentNodePath:s.node.path,creationTime:creation,managedCreationTime:creation,parentCreationTime:parentCreation,parentCommandLine:`"${s.node.path}" --no-maglev "${parent}" --config "${settingsPath}" --sha256 ${hash} --owner-sid ${owner} --action Start`,commandLine:args.map(value=>'"'+value+'"').join(' '),bindings:stage.ports.map(port=>({port,address:'127.0.0.1'}))};
  if(['erpApi','crmServer'].includes(stage.name))row.bindings.push({port:stage.ports[0],address:s.lanAddress});
  const receipt={run:`run-${index}`,pid:row.pid,parentPid:11,parentCreationTime:parentCreation,creationTime:creation,stage:stage.name,sourceCommit:pin.sourceCommit,configSha256:pin.config.sha256,copyId:s.copyId,actualT1:false};
  return {stage:stage.name,rows:[row],receipt,observedAt:'2026-10-17T12:00:01.000Z',receiptRef:{path:s.runtimeDirectory+'\\'+stage.name+'.json',sha256:hash,observedAt:'2026-10-17T12:00:00.500Z'}};
 });
 const oldRoles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
 const settingsRef={path:crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-integrated-20261017').nextPaths.settings,sha256:hash};
 return {settings:s,ownerSid:owner,settingsRef,supervisorConfig:{...settingsRef},beforeImage:{observedAt:'2026-10-17T12:00:00.000Z',oldOwners:oldRoles.map((role,index)=>({role,pid:30+index,creationTime:'2026-10-11T11:00:00.0000000Z'}))},observations,oldPids:oldRoles.map((_,index)=>30+index),now:'2026-10-17T12:00:02.000Z'};
}

const q=args=>args.map(value=>'"'+value+'"').join(' ');
function outerFixture(){
 const coreInput=fixture(),s=coreInput.settings,r=s.supervisor.packageRoot,h=s.components.hub.packageRoot,sp=coreInput.settingsRef.path;
 const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
 const watcher=(pid,birth,script)=>({pid,ownerSid:owner,creationTime:birth,executablePath:shell,commandLine:q([shell,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',r+'\\scripts\\canonical\\'+script,'-StartupConfigPath',sp,'-StartupConfigSha256',hash])});
 const terminalWatcher=watcher(12,'2026-10-17T12:00:00.0500000Z','watch-terminal-completion-logon.ps1');
 const hubWatcher=watcher(13,'2026-10-17T12:00:00.0400000Z','watch-hub-after-erp.ps1');
 const supervisor={pid:11,parentPid:12,parentCreationTime:terminalWatcher.creationTime,parentOwnerSid:owner,ownerSid:owner,nodePath:s.node.path,creationTime:'2026-10-17T12:00:00.1000000Z',commandLine:coreInput.observations[0].rows[0].parentCommandLine};
 const run='a'.repeat(32),attempt=0,birth='2026-10-17T12:00:00.1500000Z';
 const launch={pid:14,parentPid:13,birth,sid:owner,argv:q([shell,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',h+'\\scripts\\canonical\\start-hub-web.ps1','-StartupConfigPath',s.components.hub.config.path,'-Action','Start','-RunId',run,'-Attempt','0'])};
 const process={pid:15,parentPid:14,parentCreationTime:birth,parentOwnerSid:owner,ownerSid:owner,nodePath:s.node.path,creationTime:'2026-10-17T12:00:00.2500000Z',commandLine:q([s.node.path,h+'\\apps\\api\\start-shared-test-copy-web.mjs',s.privateSources.operationConfig.path]),bindings:[{address:'127.0.0.1',port:5234},{address:s.lanAddress,port:5234}]};
 const lineagePath=s.runtimeDirectory+'\\hub-web\\hub-web-lineage-'+run+'-0.json',startedAt='2026-10-17T12:00:00.5000000Z';
 const lineage={schemaVersion:1,run,attempt,ownerSid:owner,sourceCommit:s.components.hub.sourceCommit,packageRoot:h,manifestSha256:s.components.hub.manifestSha256,nodeSha256:s.node.sha256,startupConfig:{...s.components.hub.config},operationConfig:{...s.privateSources.operationConfig},hubConfig:{...s.privateSources.hubPinConfig},watcher:{pid:hubWatcher.pid,birth:hubWatcher.creationTime,sid:owner,argv:hubWatcher.commandLine},launcher:launch,node:{pid:process.pid,parentPid:launch.pid,birth:process.creationTime,sid:owner,argv:process.commandLine},bindings:process.bindings.map(row=>({...row,pid:15})),startedAt};
 const hub={lineage,lineageRef:{path:lineagePath,sha256:hash,aclProtected:true,createOnly:true,fsync:true,observedAt:'2026-10-17T12:00:00.6000000Z'},process,portInventoryScope:'Get-NetTCPConnection.Listen.All5234',portInventory:process.bindings.map(row=>({...row,pid:15})),receipt:{pid:15,sourceCommit:s.components.hub.sourceCommit,packageRoot:h,port:5234,startedAt,run,attempt,lineagePath,lineageSha256:hash},receiptRef:{path:s.runtimeDirectory+'\\hub-web\\hub-web-process-'+run+'-0.json',sha256:hash,createOnly:true,aclProtected:true,fsync:true,observedAt:'2026-10-17T12:00:00.7500000Z'},observedAt:'2026-10-17T12:00:01.0000000Z'};
 return {coreInput,terminalWatcher,hubWatcher,supervisor,hub};
}
const denied=change=>{const input=outerFixture();change(input);assert.throws(()=>proveP03CandidateOuter(input),/REJECTED/);};
test('new watcher, c401 supervisor, six CORE children and e0e Hub lineage are conditionally consistent',()=>{
 const result=proveP03CandidateOuter(outerFixture());
 assert.equal(result.status,'CANDIDATE_OUTER_CONDITIONAL_CONSISTENCY');assert.equal(result.coreRoles,6);
});
test('actual CIM trailing whitespace is accepted but an extra argv token is rejected',()=>{
 const input=outerFixture();
 input.hub.lineage.launcher.argv+='  ';
 input.hub.process.commandLine+=' ';
 input.hub.lineage.node.argv=input.hub.process.commandLine;
 assert.equal(proveP03CandidateOuter(input).status,'CANDIDATE_OUTER_CONDITIONAL_CONSISTENCY');
 denied(x=>{x.hub.lineage.launcher.argv+=' -NoExit';});
 denied(x=>{x.hub.process.commandLine+=' --inspect';x.hub.lineage.node.argv=x.hub.process.commandLine;});
});
test('foreign supervisor parent, owner, argv, birth and old PID fail',()=>{
 for(const change of [x=>x.supervisor.parentPid=99,x=>x.supervisor.parentCreationTime='2026-10-17T12:00:00.0600000Z',x=>x.supervisor.ownerSid='S-1-5-18',x=>x.supervisor.commandLine+=' --inspect',x=>x.supervisor.pid=30,x=>x.terminalWatcher.pid=38,x=>x.terminalWatcher.creationTime='2026-10-11T11:00:00.0000000Z'])denied(change);
});
test('Hub receipt alone cannot prove lineage; foreign launcher, port, receipt and old PID fail',()=>{
 for(const change of [x=>delete x.hub.lineage,x=>x.hub.lineage.launcher.parentPid=99,x=>x.hub.process.parentPid=99,x=>x.hub.process.parentCreationTime='2026-10-17T12:00:00.1600000Z',x=>x.hub.process.pid=30,x=>x.hub.process.commandLine+=' --inspect',x=>x.hub.process.bindings[0].port=5235,x=>x.hub.portInventory[0].pid=99,x=>x.hub.portInventoryScope='filtered',x=>x.hub.receipt.pid=99,x=>x.hub.receipt.sourceCommit='b'.repeat(40),x=>x.hub.receiptRef.path+='-old',x=>x.hub.receiptRef.sha256='bad',x=>x.hub.receipt.lineageSha256='a'.repeat(64),x=>x.hub.lineageRef.aclProtected=false,x=>x.hub.lineageRef.fsync=false])denied(change);
});
test('old Hub PID is rejected even when process, receipt and full port inventory agree',()=>{
 denied(x=>{x.hub.lineage.launcher.pid=30;x.hub.process.parentPid=30;});
 denied(x=>{x.hub.process.pid=30;x.hub.lineage.node.pid=30;x.hub.receipt.pid=30;x.hub.portInventory.forEach(row=>row.pid=30);});
});
test('stale or edited durable lineage and changed config pins fail',()=>{
 for(const change of [
  x=>x.hub.lineage.watcher.birth='2026-10-11T11:00:00.0000000Z',
  x=>x.hub.lineage.launcher.birth='2026-10-11T11:00:00.0000000Z',
  x=>x.hub.lineage.launcher.argv+=' -NoExit',
  x=>x.hub.lineage.node.birth='2026-10-17T12:00:00.2600000Z',
  x=>x.hub.lineage.startupConfig.sha256='a'.repeat(64),
  x=>x.hub.lineage.operationConfig.path+='-other',
  x=>x.hub.lineage.hubConfig.sha256='a'.repeat(64),
  x=>x.hub.lineage.bindings[0].pid=99,
  x=>x.hub.lineageRef.path+='-old',
  x=>x.hub.lineageRef.createOnly=false,
  x=>x.hub.receiptRef.path=x.coreInput.settings.runtimeDirectory+'\\hub-web\\hub-web-process.json',
  x=>x.hub.receiptRef.aclProtected=false,
 ].entries()){
  try{denied(change[1]);}catch(error){throw Error(`case ${change[0]}: ${error.message}`);}
 }
});
test('six CORE receipts must share the exact observed supervisor birth and argv',()=>{
 for(const change of [x=>x.coreInput.observations[0].receipt.parentPid=12,x=>x.coreInput.observations[0].rows[0].parentCreationTime='2026-10-17T12:00:00.1010000Z',x=>x.coreInput.observations[0].rows[0].parentCommandLine+=' --inspect'])denied(change);
});
test('integrated settings and Node pins cannot silently select another candidate',()=>{
 for(const change of [x=>x.coreInput.settingsRef.sha256='a'.repeat(64),x=>x.coreInput.settings.node.sha256='a'.repeat(64),x=>x.coreInput.settings.node.path='C:\\Program Files\\nodejs\\node.exe'])denied(change);
});
function newLineageFixture(){
 const x=outerFixture(),v=x.coreInput,s=v.settings,p=crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-hub-lineage-20261017');
 const oldRoot=s.supervisor.packageRoot,newRoot=erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-ba65c8cb2ca9';
 const oldSettings=v.settingsRef.path,newSettings=p.nextPaths.settings,oldHash=v.settingsRef.sha256,newHash='e4422f910fe92cf4dbed636b71eea515180131b617fc3329f2d9eeabc8f1b319';
 const oldErp=s.components.hub.packageRoot,newErp=CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE.packageRoot;
 v.settingsRef={path:newSettings,sha256:newHash};v.supervisorConfig={...v.settingsRef};
 s.supervisor={packageRoot:newRoot,sourceCommit:'ba65c8cb2ca9826c98edd06bc5129e37b51bb64a',manifestSha256:'b5810d589ea1a4876cbb513d86b2ce90ef322f192e83845cac4e8f7103149435'};
 for(const name of ['erpApiNative','hub'])Object.assign(s.components[name],CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE);
 s.privateSources.hubStartupConfig={path:p.nextPaths.hubStartup,sha256:'ad4419162f641c5bda94198f5fdae1474e1c189782fc21ea823c463382de560f'};s.components.hub.config=s.privateSources.hubStartupConfig;
 s.dependencyLocks.erpApiNative.path=p.erpDependencyLockPath;
 for(const o of v.observations){const stage=COMPLETION_CORE_STAGES.find(item=>item.name===o.stage);o.receipt.sourceCommit=s.components[stage.component].sourceCommit;o.rows[0].commandLine=o.rows[0].commandLine.replaceAll(oldErp,newErp);o.rows[0].parentCommandLine=o.rows[0].parentCommandLine.replaceAll(oldRoot,newRoot).replaceAll(oldSettings,newSettings).replaceAll(oldHash,newHash);}
 for(const watcher of [x.terminalWatcher,x.hubWatcher])watcher.commandLine=watcher.commandLine.replaceAll(oldRoot,newRoot).replaceAll(oldSettings,newSettings).replaceAll(oldHash,newHash);
 x.supervisor.commandLine=x.supervisor.commandLine.replaceAll(oldRoot,newRoot).replaceAll(oldSettings,newSettings).replaceAll(oldHash,newHash);
 x.hub.lineage.watcher.argv=x.hubWatcher.commandLine;
 x.hub.lineage.sourceCommit=s.components.hub.sourceCommit;x.hub.lineage.packageRoot=newErp;x.hub.lineage.manifestSha256=s.components.hub.manifestSha256;
 x.hub.lineage.launcher.argv=x.hub.lineage.launcher.argv.replaceAll(oldErp,newErp);
 x.hub.lineage.launcher.argv=x.hub.lineage.launcher.argv.replaceAll('C:\\Sirket\\ERP\\runtime\\completion\\hubStartupConfig.json',p.nextPaths.hubStartup);
 x.hub.lineage.startupConfig={...s.components.hub.config};
 x.hub.lineage.node.argv=x.hub.lineage.node.argv.replaceAll(oldErp,newErp);
 x.hub.process.commandLine=x.hub.process.commandLine.replaceAll(oldErp,newErp);
 x.hub.receipt.sourceCommit=s.components.hub.sourceCommit;x.hub.receipt.packageRoot=newErp;
 x.terminalWatcher.instanceGuid='11111111-1111-4111-8111-111111111111';x.hubWatcher.instanceGuid='22222222-2222-4222-8222-222222222222';
 const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',schedulePath='C:\\WINDOWS\\system32\\svchost.exe -k netsvcs -p';
 for(const [row,script] of [[x.terminalWatcher,'watch-terminal-completion-logon.ps1'],[x.hubWatcher,'watch-hub-after-erp.ps1']])row.commandLine=`"${shell}" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${newRoot}\\scripts\\canonical\\${script}" -StartupConfigPath "${newSettings}" -StartupConfigSha256 ${newHash}`;
 x.hub.lineage.watcher.argv=x.hubWatcher.commandLine;
 const pairs=[['Melisa-Terminal-Completion-Logon',x.terminalWatcher,'terminalWatcher'],['Melisa-Hub-TEST-Web',x.hubWatcher,'hubWatcher']];
 const tasks=pairs.map(([name,row,role])=>({name,path:'\\'+name,oldEnginePid:v.beforeImage.oldOwners.find(item=>item.role===role).pid,currentAction:shell,action:{execute:shell,arguments:row.commandLine.slice(`"${shell}" `.length),workingDirectory:newRoot},settingsSha256:newHash,supervisorPin:{...s.supervisor},watcherExecutablePath:shell,watcherCommandLine:row.commandLine}));
 x.taskInput={beforeImage:{capturedAt:v.beforeImage.observedAt,oldWatchers:pairs.map(([name,,role])=>({name,pid:v.beforeImage.oldOwners.find(item=>item.role===role).pid,creationTime:v.beforeImage.oldOwners.find(item=>item.role===role).creationTime}))},expected:{ownerSid:owner,scheduleServiceExecutablePath:'C:\\Windows\\System32\\svchost.exe',scheduleServiceCommandLine:'C:\\Windows\\system32\\svchost.exe -k netsvcs -p',tasks},observed:{capturedAt:v.now,runningTaskCollection:'Schedule.Service.GetRunningTasks(1)',processInventoryScope:'CIM.Win32_Process.AllP03WatcherCommands',scheduleService:{name:'Schedule',state:'Running',startName:'LocalSystem',pathName:schedulePath,processId:1000},scheduleServiceProcess:{name:'svchost.exe',processId:1000,ownerResult:{code:0,sid:'S-1-5-18'},executablePath:'C:\\Windows\\System32\\svchost.exe',commandLine:'C:\\Windows\\system32\\svchost.exe -k netsvcs -p',pathArgvMarker:null,creationTime:'2026-10-11T10:00:00.000Z'},registeredTasks:tasks.map(t=>({name:t.name,path:t.path,state:4,ownerSid:owner,action:{...t.action},settingsSha256:newHash,supervisorPin:{...s.supervisor},taskInfoLastRunTime:'2026-10-17T12:00:00.010Z'})),runningTasks:tasks.map((t,i)=>({name:t.name,path:t.path,state:4,currentAction:shell,enginePID:pairs[i][1].pid,instanceGuid:pairs[i][1].instanceGuid})),processes:pairs.map(([,row])=>({processId:row.pid,ownerSid:owner,executablePath:shell,commandLine:row.commandLine,creationTime:row.creationTime,parentProcessId:1000}))}};
 captureBytes(x);
 return x;
}
function captureBytes(x){
 const {lineage,lineageRef,receipt,receiptRef}=x.hub;
 lineageRef.bytesBase64=Buffer.from(JSON.stringify(lineage)).toString('base64');lineageRef.sha256=createHash('sha256').update(Buffer.from(lineageRef.bytesBase64,'base64')).digest('hex');
 receipt.lineageSha256=lineageRef.sha256;
 receiptRef.bytesBase64=Buffer.from(JSON.stringify(receipt)).toString('base64');receiptRef.sha256=createHash('sha256').update(Buffer.from(receiptRef.bytesBase64,'base64')).digest('hex');
}
test('new lineage profile proves protected per-run Hub parent chain without live launcher',()=>{
 const x=newLineageFixture();assert.equal(proveP03NewLineageOuter(x).status,'CANDIDATE_OUTER_CONDITIONAL_CONSISTENCY');
 assert.throws(()=>proveP03CandidateOuter(x),/REJECTED/);
 for(const change of [v=>v.hub.lineage.launcher.parentPid=30,v=>v.hub.receiptRef.path=v.coreInput.settings.runtimeDirectory+'\\hub-web\\hub-web-process.json',v=>v.hub.lineageRef.createOnly=false,v=>v.hub.process.parentCreationTime='2026-10-11T11:00:00.0000000Z',v=>v.coreInput.settings.components.hub.config.sha256='a'.repeat(64)]){const bad=newLineageFixture();change(bad);assert.throws(()=>proveP03NewLineageOuter(bad),/REJECTED/);}
});
test('new outer proof joins COM instance, exact EnginePID, old watcher image and capture',()=>{
 const changes=[
  x=>{x.taskInput.observed.runningTasks[0].enginePID=16;x.taskInput.observed.processes[0].processId=16;},
  x=>x.terminalWatcher.instanceGuid='33333333-3333-4333-8333-333333333333',
  x=>{x.taskInput.beforeImage.oldWatchers[0].pid=90;x.taskInput.expected.tasks[0].oldEnginePid=90;},
  x=>x.taskInput.beforeImage.capturedAt='2026-10-17T11:59:59.000Z',
  x=>x.taskInput.observed.capturedAt='2026-10-17T12:00:03.000Z',
 ];
 for(const change of changes){const x=newLineageFixture();change(x);assert.throws(()=>proveP03NewLineageOuter(x),/REJECTED/);}
});
test('new Hub receipt and lineage hashes cover exact supplied bytes',()=>{
 const changes=[
  x=>x.hub.lineageRef.bytesBase64+='A',
  x=>x.hub.receiptRef.bytesBase64+='A',
  x=>{x.hub.lineageRef.bytesBase64=Buffer.from('{}').toString('base64');x.hub.lineageRef.sha256=createHash('sha256').update('{}').digest('hex');x.hub.receipt.lineageSha256=x.hub.lineageRef.sha256;const pointer=Buffer.from(JSON.stringify(x.hub.receipt));x.hub.receiptRef.bytesBase64=pointer.toString('base64');x.hub.receiptRef.sha256=createHash('sha256').update(pointer).digest('hex');},
  x=>{x.hub.receiptRef.bytesBase64=Buffer.from('{}').toString('base64');x.hub.receiptRef.sha256=createHash('sha256').update('{}').digest('hex');},
 ];
 for(const change of changes){const x=newLineageFixture();change(x);assert.throws(()=>proveP03NewLineageOuter(x),/REJECTED/);}
});
test('lineage startedAt must be parseable, after node birth and equal pointer startedAt',()=>{
 for(const change of [x=>{x.hub.lineage.startedAt='bad';x.hub.receipt.startedAt='bad';},x=>x.hub.lineage.startedAt='2026-10-17T12:00:00.1000000Z',x=>x.hub.receipt.startedAt='2026-10-17T12:00:00.6000000Z']){
  const x=newLineageFixture();change(x);captureBytes(x);assert.throws(()=>proveP03NewLineageOuter(x),/REJECTED/);
 }
});
