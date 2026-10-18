// Pure, source-only START_INTENT/STARTED partial candidate predicate. The
// caller's trusted collector must supply complete, unfiltered CIM process and
// listener inventories. Scope labels alone do not prove physical completeness.
// This is a conditional recovery subset, never permission to stop/start/replay.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
import {COMPLETION_CORE_STAGES,completionProcessMatches,validateCompletionSettings} from './terminal-completion-logon.mjs';
import {CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE,CRM06_STAFF_INTEGRATED_CRM_PACKAGE,CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME,crm06StaffSuccessorProfile,CRM06_STAFF_INTEGRATED_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';

const CODE='P03_PARTIAL_CANDIDATE_REJECTED';
const fail=()=>{const error=Error(CODE);error.code=CODE;throw error;};
const need=value=>{if(!value)fail();};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const tick=value=>{const m=typeof value==='string'&&/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)\.(\d{1,7})Z$/.exec(value);if(!m)return null;const t=Date.parse(m[1]+'.000Z');return Number.isFinite(t)?BigInt(t)*10000n+BigInt(m[2].padEnd(7,'0')):null;};
const pid=value=>Number.isSafeInteger(value)&&value>0;
const same=(a,b)=>isDeepStrictEqual(a,b);
const args=value=>nativeArgumentTokens(value);
const argv=(actual,expected)=>same(args(actual),expected);
const SHELL='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const SETTINGS_SHA='e4422f910fe92cf4dbed636b71eea515180131b617fc3329f2d9eeabc8f1b319';
const SUPERVISOR=Object.freeze({packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-ba65c8cb2ca9',sourceCommit:'ba65c8cb2ca9826c98edd06bc5129e37b51bb64a',manifestSha256:'b5810d589ea1a4876cbb513d86b2ce90ef322f192e83845cac4e8f7103149435'});
const NATIVE_ORDER=Object.freeze({packageRoot:'C:\\Sirket\\ERP\\releases\\CRM-ORDER-DRAFT-TEST-20261013-7a41f64',sourceCommit:'7a41f6492273dd1ec0bcb086f820be5575372be8',manifestSha256:'6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'});
const TASKS=Object.freeze({terminalWatcher:{name:'Melisa-Terminal-Completion-Logon',script:'watch-terminal-completion-logon.ps1'},hubWatcher:{name:'Melisa-Hub-TEST-Web',script:'watch-hub-after-erp.ps1'}});
const ROLES=Object.freeze(['terminalWatcher','hubWatcher','coreSupervisor',...COMPLETION_CORE_STAGES.map(s=>s.name),'hub']);
const PORTS=new Set([4184,4186,5234,62700,62701,62702,62703,62704]);
const GUID=/^\{?[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\}?$/i;
const guid=value=>typeof value==='string'&&GUID.test(value)?value.toLowerCase().replace(/[{}]/g,''):null;
const pin=(actual,expected)=>need(actual&&['packageRoot','sourceCommit','manifestSha256'].every(k=>actual[k]===expected[k]));
function bytes(ref,value){
 need(ref&&sha(ref.sha256)&&ref.aclProtected===true&&ref.createOnly===true&&ref.fsync===true&&typeof ref.bytesBase64==='string');
 const raw=Buffer.from(ref.bytesBase64,'base64');
 need(raw.length>0&&raw.toString('base64')===ref.bytesBase64&&createHash('sha256').update(raw).digest('hex')===ref.sha256);
 try{need(same(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),value));}catch{fail();}
}
function birth(row,old,at,owner){
 need(row&&pid(row.pid)&&!old.has(row.pid)&&row.ownerSid===owner&&tick(row.creationTime)>at);
}
function oldImage(image){
 need(image&&tick(image.observedAt)!==null&&Array.isArray(image.oldOwners)&&image.oldOwners.length===10);
 const roles=new Set(),pids=new Set();
 for(const row of image.oldOwners){need(ROLES.includes(row.role)&&!roles.has(row.role)&&pid(row.pid)&&!pids.has(row.pid)&&tick(row.creationTime)!==null&&tick(row.creationTime)<=tick(image.observedAt));roles.add(row.role);pids.add(row.pid);}
 need(roles.size===10);return pids;
}
function inventory(input,old,at,now){
 const {processes,listeners,processScope,listenerScope}=input;
 need(processScope==='CIM.Win32_Process.AllP03CandidatesAndChildren'&&listenerScope==='Get-NetTCPConnection.Listen.AllP03Ports'&&Array.isArray(processes)&&Array.isArray(listeners));
 const pids=new Set(),roles=new Set(),byPid=new Map();
 for(const row of processes){need(row&&ROLES.includes(row.role)&&!roles.has(row.role)&&pid(row.pid)&&!pids.has(row.pid));birth(row,old,at,input.ownerSid);need(tick(row.creationTime)<=now);roles.add(row.role);pids.add(row.pid);byPid.set(row.pid,row);}
 const bindings=new Set();
 for(const row of listeners){need(row&&PORTS.has(row.port)&&['127.0.0.1','192.168.1.46'].includes(row.address)&&pid(row.pid)&&byPid.has(row.pid));const key=`${row.address}:${row.port}`;need(!bindings.has(key));bindings.add(key);}
 return {roles,byPid,bindings};
}
function watcher(row,role,input,tasks,old,at,now){
 const {settings,settingsRef}=input,def=TASKS[role],task=tasks.find(t=>t.name===def.name),run=input.runningTasks.find(t=>t.name===def.name);
 need(task&&task.path==='\\'+def.name&&task.ownerSid===settings.ownerSid&&[3,4].includes(task.state)&&task.settingsSha256===SETTINGS_SHA);pin(task.supervisorPin,SUPERVISOR);
 const script=path.win32.join(SUPERVISOR.packageRoot,'scripts','canonical',def.script);
 const tail=`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${script}" -StartupConfigPath "${settingsRef.path}" -StartupConfigSha256 ${SETTINGS_SHA}`;
 need(task.action?.execute===SHELL&&task.action.arguments===tail&&task.action.workingDirectory===SUPERVISOR.packageRoot);
 if(!row){need(!run&&task.state===3);return;}
 birth(row,old,at,settings.ownerSid);
 need(task.state===4&&run&&run.path===task.path&&run.state===4&&run.currentAction===SHELL&&run.enginePID===row.pid&&guid(run.instanceGuid)!==null&&guid(run.instanceGuid)===guid(row.instanceGuid));
 need(row.executablePath===SHELL&&argv(row.commandLine,[SHELL,...args(tail)])&&row.parentPid===input.scheduleService.processId&&row.parentCreationTime===input.scheduleServiceProcess.creationTime&&tick(row.creationTime)<=now);
 need(tick(task.taskInfoLastRunTime)>at&&tick(task.taskInfoLastRunTime)<=tick(row.creationTime));
}
function receipt(ref,value,pathName,now,born){
 need(ref?.path===pathName&&tick(ref.observedAt)!==null&&tick(ref.observedAt)>=born&&tick(ref.observedAt)<=now);bytes(ref,value);
}

/** Every surviving role is proven against the exact new candidate and a full
 * target inventory. Missing roles are accepted only when no target process or
 * target listener claims them. A transient Hub launcher needs protected bytes.
 */
export function proveP03PartialCandidate(input){
 need(input&&['START_INTENT','STARTED'].includes(input.phase));
 const {settings,settingsRef,beforeImage,inventory:seen,registeredTasks,runningTasks,scheduleService,scheduleServiceProcess,observations,hub}=input;
 const at=tick(beforeImage?.observedAt),now=tick(input.now),old=oldImage(beforeImage);
 need(at!==null&&now!==null&&now>at&&Date.parse(input.now)-Date.parse(beforeImage.observedAt)<=60000);
 need(validateCompletionSettings(settings,settings.ownerSid)===settings&&settingsRef?.path===crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-hub-lineage-20261017').nextPaths.settings&&settingsRef.sha256===SETTINGS_SHA);
 need(settings.node.path===CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME.path&&settings.node.sha256===CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME.sha256);
 pin(settings.supervisor,SUPERVISOR);pin(settings.components.erpApiNative,CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE);pin(settings.components.hub,CRM06_STAFF_ERP_HUB_LINEAGE_PACKAGE);pin(settings.components.crm,CRM06_STAFF_INTEGRATED_CRM_PACKAGE);pin(settings.components.nativeOrder,NATIVE_ORDER);
 need(settings.components.hub.config.path===settings.privateSources.hubStartupConfig.path&&settings.components.hub.config.sha256==='ad4419162f641c5bda94198f5fdae1474e1c189782fc21ea823c463382de560f');
 need(scheduleService?.name==='Schedule'&&scheduleService.state==='Running'&&scheduleService.startName==='LocalSystem'&&scheduleService.pathName==='C:\\WINDOWS\\system32\\svchost.exe -k netsvcs -p'&&pid(scheduleService.processId));
 need(scheduleServiceProcess?.processId===scheduleService.processId&&scheduleServiceProcess.name==='svchost.exe'&&tick(scheduleServiceProcess.creationTime)!==null&&tick(scheduleServiceProcess.creationTime)<=at);
 const serviceOwner=scheduleServiceProcess.ownerResult;
 need(serviceOwner&&(serviceOwner.code===0&&serviceOwner.sid==='S-1-5-18'||serviceOwner.code===2&&serviceOwner.sid===null&&serviceOwner.marker==='UNAVAILABLE_ACCESS_DENIED'));
 const servicePath=scheduleServiceProcess.executablePath,serviceArgv=scheduleServiceProcess.commandLine;
 if(typeof servicePath==='string'&&servicePath.length>0&&typeof serviceArgv==='string'&&serviceArgv.length>0){
  need(scheduleServiceProcess.pathArgvMarker===null&&servicePath==='C:\\Windows\\System32\\svchost.exe'&&serviceArgv==='C:\\Windows\\system32\\svchost.exe -k netsvcs -p');
 }else need([null,''].includes(servicePath)&&[null,''].includes(serviceArgv)&&scheduleServiceProcess.pathArgvMarker==='UNAVAILABLE_CIM_EMPTY');
 need(Array.isArray(registeredTasks)&&registeredTasks.length===2&&Array.isArray(runningTasks)&&runningTasks.length<=2&&new Set(runningTasks.map(t=>t.name)).size===runningTasks.length&&runningTasks.every(t=>Object.values(TASKS).some(d=>d.name===t.name)));
 need(Array.isArray(observations)&&new Set(observations.map(o=>o.stage)).size===observations.length);
 const inv=inventory({...seen,ownerSid:settings.ownerSid},old,at,now),row=role=>seen.processes.find(p=>p.role===role),roles=[];
 need(seen.processes.every(p=>p.pid!==scheduleService.processId&&p.parentPid!==p.pid));
 need(new Set(runningTasks.map(t=>guid(t.instanceGuid))).size===runningTasks.length);
 for(const role of Object.keys(TASKS)){watcher(row(role),role,input,registeredTasks,old,at,now);if(row(role))roles.push(role);}
 const supervisor=row('coreSupervisor'),terminal=row('terminalWatcher');
 const supervisorArgs=[settings.node.path,'--no-maglev',path.win32.join(SUPERVISOR.packageRoot,'scripts','canonical','terminal-completion-logon.mjs'),'--config',settingsRef.path,'--sha256',SETTINGS_SHA,'--owner-sid',settings.ownerSid,'--action','Start'];
 if(supervisor){need(terminal&&supervisor.parentPid===terminal.pid&&supervisor.parentCreationTime===terminal.creationTime&&supervisor.parentOwnerSid===settings.ownerSid&&supervisor.nodePath===settings.node.path&&argv(supervisor.commandLine,supervisorArgs)&&tick(supervisor.creationTime)>tick(terminal.creationTime));roles.push('coreSupervisor');}
 for(const stage of COMPLETION_CORE_STAGES){
  const r=row(stage.name),o=observations.find(x=>x.stage===stage.name);
  if(!r){need(!o);continue;}
  need(supervisor&&o&&o.row&&same(o.row,r)&&o.receipt&&o.receiptRef&&o.receipt.parentPid===supervisor.pid&&o.receipt.parentCreationTime===supervisor.creationTime&&r.parentPid===supervisor.pid&&r.parentCreationTime===supervisor.creationTime&&r.parentOwnerSid===settings.ownerSid&&argv(r.parentCommandLine,supervisorArgs));
  need(completionProcessMatches(r,o.receipt,stage,settings));
  const bindingPlan=stage.ports.map(port=>({port,address:'127.0.0.1'}));
  if(['erpApi','crmServer'].includes(stage.name))bindingPlan.push({port:stage.ports[0],address:'192.168.1.46'});
  need(r.bindings.length===bindingPlan.length&&r.bindings.every(b=>bindingPlan.some(p=>same(b,p))));
  receipt(o.receiptRef,o.receipt,settings.runtimeDirectory+'\\'+stage.name+'.json',now,tick(r.creationTime));
  need(tick(o.observedAt)>=tick(o.receiptRef.observedAt)&&tick(o.observedAt)<=now);roles.push(stage.name);
 }
 const h=row('hub');
 if(h){
  const watcherRow=row('hubWatcher'),lineage=hub?.lineage,lr=hub?.lineageRef,rr=hub?.receiptRef,rec=hub?.receipt,launcher=lineage?.launcher,pinHub=settings.components.hub;
  need(watcherRow&&hub?.process&&same(hub.process,h)&&lineage&&launcher&&rec&&lr&&rr);
  receipt(lr,lineage,path.win32.join(settings.runtimeDirectory,'hub-web',`hub-web-lineage-${lineage.run}-${lineage.attempt}.json`),now,tick(h.creationTime));
  receipt(rr,rec,path.win32.join(settings.runtimeDirectory,'hub-web',`hub-web-process-${lineage.run}-${lineage.attempt}.json`),now,tick(h.creationTime));
  need(lineage.schemaVersion===1&&/^[a-f0-9]{32}$/.test(lineage.run)&&Number.isInteger(lineage.attempt)&&lineage.attempt>=0&&lineage.attempt<=3&&lineage.ownerSid===settings.ownerSid&&lineage.sourceCommit===pinHub.sourceCommit&&lineage.packageRoot===pinHub.packageRoot&&lineage.manifestSha256===pinHub.manifestSha256&&lineage.nodeSha256===settings.node.sha256);
  need(lineage.watcher?.pid===watcherRow.pid&&lineage.watcher.birth===watcherRow.creationTime&&lineage.watcher.sid===settings.ownerSid&&lineage.watcher.argv===watcherRow.commandLine);
  need(pid(launcher.pid)&&!old.has(launcher.pid)&&!inv.byPid.has(launcher.pid)&&launcher.parentPid===watcherRow.pid&&launcher.sid===settings.ownerSid&&tick(launcher.birth)>tick(watcherRow.creationTime));
  need(argv(launcher.argv,[SHELL,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',path.win32.join(pinHub.packageRoot,'scripts','canonical','start-hub-web.ps1'),'-StartupConfigPath',pinHub.config.path,'-Action','Start','-RunId',lineage.run,'-Attempt',String(lineage.attempt)]));
  need(h.pid===lineage.node?.pid&&h.parentPid===launcher.pid&&h.parentCreationTime===launcher.birth&&h.parentOwnerSid===settings.ownerSid&&h.nodePath===settings.node.path&&h.creationTime===lineage.node.birth&&lineage.node.sid===settings.ownerSid&&lineage.node.argv===h.commandLine&&tick(h.creationTime)>tick(launcher.birth));
  need(argv(h.commandLine,[settings.node.path,path.win32.join(pinHub.packageRoot,'apps','api','start-shared-test-copy-web.mjs'),settings.privateSources.operationConfig.path]));
  const hubBindings=[{address:'127.0.0.1',port:5234},{address:'192.168.1.46',port:5234}];
  need(Array.isArray(h.bindings)&&h.bindings.length===2&&hubBindings.every(expected=>h.bindings.filter(b=>same(b,expected)).length===1));
  need(Array.isArray(lineage.bindings)&&lineage.bindings.length===2&&hubBindings.every(expected=>lineage.bindings.filter(b=>same(b,{...expected,pid:h.pid})).length===1));
  need(lineage.startupConfig?.path===pinHub.config.path&&lineage.startupConfig.sha256===pinHub.config.sha256&&lineage.operationConfig?.path===settings.privateSources.operationConfig.path&&lineage.operationConfig.sha256===settings.privateSources.operationConfig.sha256&&lineage.hubConfig?.path===settings.privateSources.hubPinConfig.path&&lineage.hubConfig.sha256===settings.privateSources.hubPinConfig.sha256);
  need(rec.pid===h.pid&&rec.run===lineage.run&&rec.attempt===lineage.attempt&&rec.sourceCommit===pinHub.sourceCommit&&rec.packageRoot===pinHub.packageRoot&&rec.port===5234&&rec.lineagePath===lr.path&&rec.lineageSha256===lr.sha256&&rec.startedAt===lineage.startedAt&&tick(rec.startedAt)>=tick(h.creationTime)&&tick(rr.observedAt)>=tick(lr.observedAt));roles.push('hub');
 }else need(!hub);
 const expected=[];
 for(const stage of COMPLETION_CORE_STAGES)if(row(stage.name))for(const binding of row(stage.name).bindings)expected.push({pid:row(stage.name).pid,port:binding.port,address:binding.address});
 if(h)for(const address of ['127.0.0.1','192.168.1.46'])expected.push({pid:h.pid,port:5234,address});
 need(expected.length===seen.listeners.length&&expected.every(e=>seen.listeners.some(a=>same(a,e)))&&seen.listeners.every(a=>expected.some(e=>same(a,e))));
 need(seen.processes.every(p=>roles.includes(p.role))&&inv.roles.size===roles.length);
 return Object.freeze({status:'PARTIAL_CANDIDATE_CONDITIONAL_SUBSET',phase:input.phase,roles:Object.freeze([...roles]),pids:Object.freeze(roles.map(role=>row(role).pid)),stopPermitted:false});
}
