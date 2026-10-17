// Source-only comparison of caller-supplied OS observations and pinned receipts.
// The launcher has exited by the time the outer proof runs. Its protected,
// create-only lineage receipt carries the launcher birth and parent chain.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
import {proveP03CandidateCore,proveP03NewLineageCore} from './p03-candidate-core-proof.mjs';
import {assertP03NewLineageTaskProof} from './p03-candidate-task-proof.mjs';
import {CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME} from './crm06-staff-refresh-successor.mjs';

const reject=()=>{throw Error('P03_CANDIDATE_OUTER_REJECTED');};
const requireThat=value=>{if(!value)reject();};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const INTEGRATED_SETTINGS_SHA='201a159b9b51058896d25961c5292d1d8e22cc3a76024958b4c324de07896e35';
const NEW_SETTINGS_SHA='e4422f910fe92cf4dbed636b71eea515180131b617fc3329f2d9eeabc8f1b319';
const ticks=value=>{const m=typeof value==='string'&&/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)\.(\d{1,7})Z$/.exec(value);if(!m)return null;const n=Date.parse(m[1]+'.000Z');return Number.isFinite(n)?BigInt(n)*10000n+BigInt(m[2].padEnd(7,'0')):null;};
const after=(later,earlier)=>ticks(later)!==null&&ticks(earlier)!==null&&ticks(later)>ticks(earlier);
const same=(actual,expected)=>{requireThat(Array.isArray(actual)&&actual.length===expected.length&&actual.every((value,i)=>value===expected[i]));};
const nodeArgs=value=>nativeArgumentTokens(value);
const watcherArgs=(root,script,settingsRef)=>['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',path.win32.join(root,'scripts','canonical',script),'-StartupConfigPath',settingsRef.path,'-StartupConfigSha256',settingsRef.sha256];
const verifyReceiptBytes=(ref,value)=>{
 requireThat(typeof ref?.bytesBase64==='string'&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(ref.bytesBase64)&&ref.bytesBase64.length>0);
 const bytes=Buffer.from(ref.bytesBase64,'base64');requireThat(bytes.toString('base64')===ref.bytesBase64&&createHash('sha256').update(bytes).digest('hex')===ref.sha256);
 try{requireThat(isDeepStrictEqual(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),value));}catch{reject();}
};
const guid=value=>typeof value==='string'&&/^\{?[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\}?$/i.test(value)?value.toLowerCase().replace(/[{}]/g,''):null;

function proveOuter({coreInput,terminalWatcher,hubWatcher,supervisor,hub,taskInput},variant){
 const newProfile=variant==='lineage',core=(newProfile?proveP03NewLineageCore:proveP03CandidateCore)(coreInput),{settings,settingsRef,beforeImage,observations,now}=coreInput;
 requireThat(settingsRef.sha256===(newProfile?NEW_SETTINGS_SHA:INTEGRATED_SETTINGS_SHA));
 requireThat(settings.node.path===CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME.path&&settings.node.sha256===CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME.sha256);
 const old=new Set(beforeImage.oldOwners.map(row=>row.pid));
 const expectedWatcherBirth=(row,script)=>{
  requireThat(row&&Number.isSafeInteger(row.pid)&&row.pid>0&&!old.has(row.pid)&&row.ownerSid===settings.ownerSid&&after(row.creationTime,beforeImage.observedAt)&&ticks(row.creationTime)<=ticks(now));
  requireThat(row.executablePath==='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  same(nodeArgs(row.commandLine),watcherArgs(settings.supervisor.packageRoot,script,settingsRef));
 };
 expectedWatcherBirth(terminalWatcher,'watch-terminal-completion-logon.ps1');
 expectedWatcherBirth(hubWatcher,'watch-hub-after-erp.ps1');
 requireThat(terminalWatcher.pid!==hubWatcher.pid);
 if(newProfile){
  requireThat(taskInput?.beforeImage?.capturedAt===beforeImage.observedAt&&taskInput?.observed?.capturedAt===now&&taskInput?.expected?.ownerSid===settings.ownerSid);
  assertP03NewLineageTaskProof(taskInput);
  for(const [name,row,role] of [['Melisa-Terminal-Completion-Logon',terminalWatcher,'terminalWatcher'],['Melisa-Hub-TEST-Web',hubWatcher,'hubWatcher']]){
   const oldOwner=beforeImage.oldOwners.find(item=>item.role===role),oldWatcher=taskInput.beforeImage.oldWatchers.find(item=>item.name===name);
   const run=taskInput.observed.runningTasks.find(item=>item.name===name),process=taskInput.observed.processes.find(item=>item.processId===row.pid);
   requireThat(oldOwner&&oldWatcher&&oldOwner.pid===oldWatcher.pid&&oldOwner.creationTime===oldWatcher.creationTime);
   requireThat(run&&process&&run.enginePID===row.pid&&guid(run.instanceGuid)!==null&&guid(run.instanceGuid)===guid(row.instanceGuid));
   requireThat(process.creationTime===row.creationTime&&process.ownerSid===row.ownerSid&&process.executablePath===row.executablePath&&process.commandLine===row.commandLine);
  }
 }
 const supervisorArgs=[settings.node.path,'--no-maglev',path.win32.join(settings.supervisor.packageRoot,'scripts','canonical','terminal-completion-logon.mjs'),'--config',settingsRef.path,'--sha256',settingsRef.sha256,'--owner-sid',settings.ownerSid,'--action','Start'];
 requireThat(supervisor&&supervisor.pid===core.parentPid&&!old.has(supervisor.pid)&&!new Set([terminalWatcher.pid,hubWatcher.pid]).has(supervisor.pid));
 requireThat(supervisor.parentPid===terminalWatcher.pid&&supervisor.parentCreationTime===terminalWatcher.creationTime&&supervisor.ownerSid===settings.ownerSid&&supervisor.parentOwnerSid===settings.ownerSid&&supervisor.nodePath===settings.node.path&&after(supervisor.creationTime,terminalWatcher.creationTime)&&after(supervisor.creationTime,beforeImage.observedAt));
 same(nodeArgs(supervisor.commandLine),supervisorArgs);
 for(const observation of observations){const row=observation.rows[0];requireThat(row.parentPid===supervisor.pid&&row.parentCreationTime===supervisor.creationTime&&row.parentOwnerSid===supervisor.ownerSid);same(nodeArgs(row.parentCommandLine),supervisorArgs);}
 const used=new Set([terminalWatcher.pid,hubWatcher.pid,supervisor.pid,...observations.map(o=>o.receipt.pid)]);
 const pin=settings.components.hub,process=hub?.process,receipt=hub?.receipt,ref=hub?.receiptRef,lineage=hub?.lineage,lineageRef=hub?.lineageRef;
 requireThat(process&&receipt&&ref&&lineage&&lineageRef&&Number.isSafeInteger(lineage.launcher?.pid)&&lineage.launcher.pid>0&&Number.isSafeInteger(process.pid)&&process.pid>0&&!used.has(lineage.launcher.pid)&&!used.has(process.pid)&&!old.has(lineage.launcher.pid)&&!old.has(process.pid)&&lineage.launcher.pid!==process.pid);
 requireThat(lineage.schemaVersion===1&&/^[a-f0-9]{32}$/.test(lineage.run)&&Number.isInteger(lineage.attempt)&&lineage.attempt>=0&&lineage.attempt<=3&&lineage.ownerSid===settings.ownerSid&&lineage.sourceCommit===pin.sourceCommit&&lineage.packageRoot===pin.packageRoot&&lineage.manifestSha256===pin.manifestSha256&&lineage.nodeSha256===settings.node.sha256);
 requireThat(lineage.watcher.pid===hubWatcher.pid&&lineage.watcher.birth===hubWatcher.creationTime&&lineage.watcher.sid===hubWatcher.ownerSid&&lineage.watcher.argv===hubWatcher.commandLine);
 requireThat(lineage.launcher.parentPid===hubWatcher.pid&&lineage.launcher.sid===settings.ownerSid&&after(lineage.launcher.birth,hubWatcher.creationTime)&&after(lineage.launcher.birth,beforeImage.observedAt));
 same(nodeArgs(lineage.launcher.argv),['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',path.win32.join(pin.packageRoot,'scripts','canonical','start-hub-web.ps1'),'-StartupConfigPath',pin.config.path,'-Action','Start','-RunId',lineage.run,'-Attempt',String(lineage.attempt)]);
 requireThat(lineage.node.pid===process.pid&&lineage.node.parentPid===lineage.launcher.pid&&lineage.node.birth===process.creationTime&&lineage.node.sid===settings.ownerSid&&lineage.node.argv===process.commandLine);
 requireThat(process.parentPid===lineage.launcher.pid&&process.parentCreationTime===lineage.launcher.birth&&process.parentOwnerSid===settings.ownerSid&&process.ownerSid===settings.ownerSid&&process.nodePath===settings.node.path&&after(process.creationTime,lineage.launcher.birth)&&after(process.creationTime,beforeImage.observedAt));
 same(nodeArgs(process.commandLine),[settings.node.path,path.win32.join(pin.packageRoot,'apps','api','start-shared-test-copy-web.mjs'),settings.privateSources.operationConfig.path]);
 requireThat(Array.isArray(process.bindings)&&process.bindings.length===2&&['127.0.0.1','192.168.1.46'].every(address=>process.bindings.some(row=>row.address===address&&row.port===5234))&&process.bindings.every(row=>row.port===5234&&['127.0.0.1','192.168.1.46'].includes(row.address)));
 requireThat(hub.portInventoryScope==='Get-NetTCPConnection.Listen.All5234'&&Array.isArray(hub.portInventory)&&hub.portInventory.length===2&&hub.portInventory.every(row=>row.pid===process.pid&&row.port===5234&&process.bindings.some(binding=>binding.address===row.address))&&process.bindings.every(binding=>hub.portInventory.some(row=>row.address===binding.address)));
 requireThat(Array.isArray(lineage.bindings)&&lineage.bindings.length===2&&lineage.bindings.every(row=>row.pid===process.pid&&row.port===5234&&process.bindings.some(binding=>binding.address===row.address))&&process.bindings.every(binding=>lineage.bindings.some(row=>row.address===binding.address)));
 requireThat(lineage.startupConfig?.path===pin.config.path&&lineage.startupConfig.sha256===pin.config.sha256&&lineage.operationConfig?.path===settings.privateSources.operationConfig.path&&lineage.operationConfig.sha256===settings.privateSources.operationConfig.sha256&&lineage.hubConfig?.path===settings.privateSources.hubPinConfig.path&&lineage.hubConfig.sha256===settings.privateSources.hubPinConfig.sha256);
 const lineageStarted=ticks(lineage.startedAt),receiptStarted=ticks(receipt.startedAt),nodeBorn=ticks(process.creationTime);
 requireThat(lineageStarted!==null&&receiptStarted!==null&&nodeBorn!==null&&lineageStarted>=nodeBorn&&lineageStarted===receiptStarted);
 if(newProfile){verifyReceiptBytes(lineageRef,lineage);verifyReceiptBytes(ref,receipt);}
 requireThat(receipt.pid===process.pid&&receipt.sourceCommit===pin.sourceCommit&&receipt.packageRoot===pin.packageRoot&&receipt.port===5234&&ticks(receipt.startedAt)!==null&&ticks(receipt.startedAt)>=ticks(process.creationTime));
 requireThat(ref.path===path.win32.join(settings.runtimeDirectory,'hub-web','hub-web-process-'+lineage.run+'-'+lineage.attempt+'.json')&&ref.createOnly===true&&ref.aclProtected===true&&ref.fsync===true);
 requireThat(receipt.run===lineage.run&&receipt.attempt===lineage.attempt&&receipt.lineagePath===lineageRef.path&&receipt.lineageSha256===lineageRef.sha256&&lineageRef.path===path.win32.join(settings.runtimeDirectory,'hub-web','hub-web-lineage-'+lineage.run+'-'+lineage.attempt+'.json')&&sha(lineageRef.sha256)&&lineageRef.aclProtected===true&&lineageRef.createOnly===true&&lineageRef.fsync===true&&ticks(lineageRef.observedAt)!==null&&ticks(lineageRef.observedAt)>=ticks(lineage.startedAt)&&ticks(lineageRef.observedAt)<=ticks(ref.observedAt));
 requireThat(sha(ref.sha256)&&ticks(ref.observedAt)!==null&&ticks(ref.observedAt)>=ticks(receipt.startedAt)&&ticks(ref.observedAt)<=ticks(now));
 requireThat(ticks(hub.observedAt)!==null&&ticks(hub.observedAt)>=ticks(ref.observedAt)&&ticks(hub.observedAt)<=ticks(now));
 requireThat(ticks(process.creationTime)<=ticks(hub.observedAt)&&ticks(lineage.launcher.birth)<=ticks(hub.observedAt));
 return Object.freeze({status:'CANDIDATE_OUTER_CONDITIONAL_CONSISTENCY',coreRoles:core.roles.length,supervisorPid:supervisor.pid,hubPid:process.pid});
}
export function proveP03CandidateOuter(input){return proveOuter(input,'integrated');}
export function proveP03NewLineageOuter(input){return proveOuter(input,'lineage');}
