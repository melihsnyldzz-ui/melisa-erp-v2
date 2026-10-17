// Finite OS callback boundary for the P03 handoff ordering module.
// This module never runs a command; the ERP owner injects a reviewed executor.
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';
import {createHash} from 'node:crypto';

const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const tasks=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const ports=[4184,4186,5234,62700,62701,62702,62703,62704];
const oldSha='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96';
const newSha='201a159b9b51058896d25961c5292d1d8e22cc3a76024958b4c324de07896e35';
const observationSha='3a8513e96a14348c0deb9b6b6cb4b85bfdcb7a39e64a9f7ee0d04703656c77dd';
const ownerSid='S-1-5-21-2170750028-1005938530-2568122015-1001';
const refuse=()=>{throw Error('P03_OWNER_OS_CALLBACK_REJECTED');};
const check=value=>{if(!value)refuse();};
const exact=(value,keys)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');});
const time=value=>typeof value==='string'?value.replace(/(\.\d{6})0Z$/,'$1Z'):value;
function identity(a,b){return a&&b&&['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'].every(key=>key==='creationTime'?time(a[key])===time(b[key]):a[key]===b[key])&&JSON.stringify(a.bindings??[])===JSON.stringify(b.bindings??[]);}
function sameTasks(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&tasks.every(name=>{const x=a.find(row=>row.name===name),y=b.find(row=>row.name===name);return x&&y&&x.state==='Running'&&y.state==='Running'&&x.xml===y.xml;});}

export function createP03OwnerOsCallbacks({snapshot,io,now=()=>Date.now()}){
 check(snapshot?.schemaVersion==='melisa-p03-owner-observation.v2'&&snapshot.ownerSid===ownerSid&&snapshot.hubLineage==='WATCHER_RUNNING_PARENT_EXITED_UNPROVEN');
 check(snapshot.oldConfig?.sha256===oldSha&&snapshot.newConfig?.sha256===newSha&&snapshot.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&snapshot.actualT1===false);
 check(snapshot.plan?.digest===p03TransitionDigest(snapshot.plan)&&snapshot.plan.oldSettingsSha256===oldSha&&snapshot.plan.newSettingsSha256===newSha);
 check(Array.isArray(snapshot.plan.targets)&&snapshot.plan.targets.every((name,index)=>name===targets[index]));
 check(tasks.every(name=>snapshot.tasks?.some(row=>row.name===name&&row.state==='Running'&&typeof row.xml==='string')));
 check(targets.every(name=>snapshot.identities?.[name]?.ownerSid===ownerSid&&Number.isSafeInteger(snapshot.identities[name].pid)&&snapshot.identities[name].pid>0));
 const methods=['readPinnedSnapshot','verifyOldPins','freshObservation','acquireExclusive','persistEvent','stopNamedTasks','tasksStopped','observeProcess','stopCaptured','portBindings','protectedUnchanged','setTaskAction','taskActionsMatch','startNamedTasks','verifyNewOwner','restoreOldActions'];
 check(io&&methods.every(name=>typeof io[name]==='function')&&typeof now==='function');
 const plan=snapshot.plan;
 const captured=Object.freeze(Object.fromEntries(targets.map(name=>[name,Object.freeze(snapshot.identities[name])])));
 let changedActions=0;
 const expectedActions=number=>tasks.map((name,index)=>({name,kind:index<number?'new':'old'}));
 const fresh=async()=>{
  const seen=await io.freshObservation();
  check(seen&&Number.isFinite(Date.parse(seen.observedAt))&&now()-Date.parse(seen.observedAt)>=0&&now()-Date.parse(seen.observedAt)<60000);
  check(seen.ownerSid===ownerSid&&seen.oldConfigSha256===oldSha&&seen.newConfigSha256===newSha&&seen.database===snapshot.database&&seen.copyId===snapshot.copyId&&seen.actualT1===false);
  check(sameTasks(seen.tasks,snapshot.tasks));
  check(targets.every(name=>identity(seen.identities?.[name],captured[name])));
  check(await io.protectedUnchanged()===true);
  return true;
 };
 return Object.freeze({plan,
  admit:async()=>{const pinned=await io.readPinnedSnapshot();check(exact(pinned,['sha256','snapshot'])&&pinned.sha256===observationSha&&JSON.stringify(pinned.snapshot)===JSON.stringify(snapshot));check(await io.verifyOldPins({oldSha,newSha,observationSha,taskXml:snapshot.tasks,stopperSha:snapshot.stopperSha,supervisor:snapshot.oldSupervisor})===true);await fresh();const held=await io.acquireExclusive(plan);check(exact(held,['owner','oldHealthy','oldActions','emptyJournal'])&&Object.values(held).every(value=>value===true));return held;},
  persist:async record=>{check(record.digest===plan.digest&&Number.isSafeInteger(record.sequence)&&record.sequence>=0);return io.persistEvent(record);},
  stopTasks:async()=>{await fresh();return io.stopNamedTasks(tasks);},
  tasksStopped:async()=>io.tasksStopped(tasks),
  stopExact:async name=>{check(targets.includes(name));const before=await io.observeProcess(captured[name].pid);if(before===null)return 'ALREADY_GONE';check(identity(before,captured[name]));check(await io.protectedUnchanged()===true);return io.stopCaptured(name,captured[name]);},
  absent:async name=>{check(targets.includes(name));return await io.observeProcess(captured[name].pid)===null;},
  portsClear:async()=>{const bindings=await io.portBindings(ports);check(Array.isArray(bindings)&&await io.protectedUnchanged()===true);return bindings.length===0;},
  setAction:async(name,kind)=>{check(name===tasks[changedActions]&&kind==='new');check(await io.tasksStopped(tasks)===true&&await io.protectedUnchanged()===true&&await io.taskActionsMatch(expectedActions(changedActions),snapshot.tasks)===true);const result=await io.setTaskAction(name,kind,oldSha,newSha);check(result===true&&await io.taskActionsMatch(expectedActions(changedActions+1),snapshot.tasks)===true);changedActions++;return true;},
  actionsEqual:async kind=>{check(['old','new'].includes(kind));return io.taskActionsMatch(tasks.map(name=>({name,kind})),snapshot.tasks);},
  startTasks:async()=>{check(await io.tasksStopped(tasks)===true&&(await io.portBindings(ports)).length===0&&await io.protectedUnchanged()===true&&await io.taskActionsMatch(expectedActions(2),snapshot.tasks)===true);return io.startNamedTasks(tasks);},
  readback:async()=>io.verifyNewOwner({plan,ports,tasks,ownerSid}),
  restoreOldActions:async()=>{check(await io.tasksStopped(tasks)===true&&(await io.portBindings(ports)).length===0&&await io.protectedUnchanged()===true&&await io.taskActionsMatch(expectedActions(changedActions),snapshot.tasks)===true);const restored=await io.restoreOldActions(tasks,oldSha);return restored===true&&await io.taskActionsMatch(expectedActions(0),snapshot.tasks)===true;},
 });
}

// The new lineage has its own versioned, caller-pinned before image. This is
// deliberately a separate entry point: the historical e0e/c401 report pin
// above remains immutable. No callback here performs OS or filesystem IO.
export function createP03NewLineageOwnerOsCallbacks({snapshot,snapshotRef,io,now=()=>Date.now()}){
 const next='e4422f910fe92cf4dbed636b71eea515180131b617fc3329f2d9eeabc8f1b319';
 const profile={erpSource:'1a03157a323e6a6c16aea714194a76b6438a435c',erpManifest:'9e5d75db4312231ab06af2f17d421b0f4e3e909cdfaee19743d92ae171ad6a66',crmSource:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',crmManifest:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83',supervisorSource:'ba65c8cb2ca9826c98edd06bc5129e37b51bb64a',supervisorManifest:'b5810d589ea1a4876cbb513d86b2ce90ef322f192e83845cac4e8f7103149435'};
 check(snapshot?.schemaVersion==='melisa-p03-owner-observation.v3'&&snapshot.ownerSid===ownerSid&&snapshot.hubLineage==='WATCHER_RUNNING_PARENT_EXITED_UNPROVEN');
 check(snapshot.oldConfig?.sha256===oldSha&&snapshot.newConfig?.sha256===next&&snapshot.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&snapshot.actualT1===false);
 check(exact(snapshot.profile,Object.keys(profile))&&Object.keys(profile).every(key=>snapshot.profile[key]===profile[key]));
 check(exact(snapshotRef,['sha256'])&&/^[a-f0-9]{64}$/.test(snapshotRef.sha256)&&typeof snapshot.copyId==='string'&&snapshot.copyId.length>0);
 check(exact(snapshot.plan,['targets','oldSettingsSha256','newSettingsSha256','digest'])&&snapshot.plan.digest===p03TransitionDigest(snapshot.plan)&&snapshot.plan.oldSettingsSha256===oldSha&&snapshot.plan.newSettingsSha256===next);
 check(snapshot.plan.targets.every((name,index)=>name===targets[index]));
 check(sameTasks(snapshot.tasks,snapshot.tasks)&&targets.every(name=>snapshot.identities?.[name]?.ownerSid===ownerSid&&Number.isSafeInteger(snapshot.identities[name].pid)&&snapshot.identities[name].pid>0));
 const methods=['readPinnedSnapshot','verifyOldPins','freshObservation','postStopObservation','acquireExclusive','persistEvent','stopNamedTasks','tasksStopped','observeProcess','stopCaptured','portBindings','protectedUnchanged','setTaskAction','taskActionsMatch','startNamedTasks','verifyNewOwner','restoreOldActions'];
 check(io&&methods.every(name=>typeof io[name]==='function')&&typeof now==='function');
 const plan=snapshot.plan,captured=Object.freeze(Object.fromEntries(targets.map(name=>[name,Object.freeze(structuredClone(snapshot.identities[name]))])));
 let changedActions=0,stopAttempted=false,postStopProved=false,stopRequestedAt=null,stopCompletedAt=null;
 const expectedActions=number=>tasks.map((name,index)=>({name,kind:index<number?'new':'old'}));
 const recent=seen=>{check(seen&&Number.isFinite(Date.parse(seen.observedAt))&&now()-Date.parse(seen.observedAt)>=0&&now()-Date.parse(seen.observedAt)<60000);check(seen.ownerSid===ownerSid&&seen.oldConfigSha256===oldSha&&seen.newConfigSha256===next&&seen.database===snapshot.database&&seen.copyId===snapshot.copyId&&seen.actualT1===false);};
 const protectedNow=async()=>check(await io.protectedUnchanged()===true);
 const postStop=async()=>{
  if(!stopAttempted)return false;
  const seen=await io.postStopObservation();recent(seen);
  check(stopCompletedAt!==null&&Date.parse(seen.observedAt)>=stopCompletedAt&&Date.parse(seen.observedAt)>=stopRequestedAt);
  check(Array.isArray(seen.tasks)&&seen.tasks.length===tasks.length&&tasks.every(name=>{const before=snapshot.tasks.find(row=>row.name===name),after=seen.tasks.find(row=>row.name===name);return after&&after.state==='Ready'&&after.xml===before.xml;}));
  check(seen.runningTaskCollection==='Schedule.Service.GetRunningTasks(1)'&&Array.isArray(seen.runningTaskInstances)&&seen.runningTaskInstances.length===0);
  check(seen.watcherProcessInventoryScope==='CIM.Win32_Process.AllP03WatcherCommands'&&Array.isArray(seen.watcherProcesses)&&seen.watcherProcesses.length===0);
  check(await io.tasksStopped(tasks)===true);
  check(targets.every(name=>seen.identities?.[name]===null||identity(seen.identities?.[name],captured[name])));
  await protectedNow();postStopProved=true;return true;
 };
 const stopped=async()=>{if(!stopAttempted)return false;return postStop();};
 return Object.freeze({plan,
  admit:async()=>{const pinned=await io.readPinnedSnapshot();check(exact(pinned,['sha256','bytesBase64'])&&pinned.sha256===snapshotRef.sha256&&typeof pinned.bytesBase64==='string'&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(pinned.bytesBase64)&&pinned.bytesBase64.length>0);const bytes=Buffer.from(pinned.bytesBase64,'base64');check(bytes.toString('base64')===pinned.bytesBase64&&createHash('sha256').update(bytes).digest('hex')===snapshotRef.sha256);let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{refuse();}check(JSON.stringify(parsed)===JSON.stringify(snapshot));check(await io.verifyOldPins({oldSha,newSha:next,observationSha:snapshotRef.sha256,taskXml:snapshot.tasks,stopperSha:snapshot.stopperSha,supervisor:snapshot.oldSupervisor,profile})===true);const seen=await io.freshObservation();recent(seen);check(sameTasks(seen.tasks,snapshot.tasks)&&targets.every(name=>identity(seen.identities?.[name],captured[name])));await protectedNow();const held=await io.acquireExclusive(plan);check(exact(held,['owner','oldHealthy','oldActions','emptyJournal'])&&Object.values(held).every(value=>value===true));return held;},
  persist:async record=>{check(record.digest===plan.digest&&Number.isSafeInteger(record.sequence)&&record.sequence>=0);return io.persistEvent(record);},
  stopTasks:async()=>{check(!stopAttempted);const seen=await io.freshObservation();recent(seen);check(sameTasks(seen.tasks,snapshot.tasks)&&targets.every(name=>identity(seen.identities?.[name],captured[name])));await protectedNow();stopAttempted=true;stopRequestedAt=now();const result=await io.stopNamedTasks(tasks);stopCompletedAt=now();check(Number.isFinite(stopRequestedAt)&&Number.isFinite(stopCompletedAt)&&stopCompletedAt>=stopRequestedAt);return result;},
  tasksStopped:stopped,
  stopExact:async name=>{check(postStopProved&&targets.includes(name)&&await stopped());const before=await io.observeProcess(captured[name].pid);if(before===null)return 'ALREADY_GONE';check(identity(before,captured[name]));await protectedNow();return io.stopCaptured(name,captured[name]);},
  absent:async name=>{check(targets.includes(name));return await io.observeProcess(captured[name].pid)===null;},
  portsClear:async()=>{check(await stopped());const bindings=await io.portBindings(ports);check(Array.isArray(bindings));await protectedNow();return bindings.length===0;},
  setAction:async(name,kind)=>{check(name===tasks[changedActions]&&kind==='new'&&await stopped());await protectedNow();check(await io.taskActionsMatch(expectedActions(changedActions),snapshot.tasks)===true);const result=await io.setTaskAction(name,kind,oldSha,next);check(result===true&&await io.taskActionsMatch(expectedActions(changedActions+1),snapshot.tasks)===true);changedActions++;return true;},
  actionsEqual:async kind=>{check(['old','new'].includes(kind));return io.taskActionsMatch(tasks.map(name=>({name,kind})),snapshot.tasks);},
  startTasks:async()=>{check(await stopped()&&(await io.portBindings(ports)).length===0);await protectedNow();check(await io.taskActionsMatch(expectedActions(2),snapshot.tasks)===true);return io.startNamedTasks(tasks);},
  readback:async()=>io.verifyNewOwner({plan,ports,tasks,ownerSid,profile}),
  restoreOldActions:async()=>{check(await stopped()&&(await io.portBindings(ports)).length===0);await protectedNow();check(await io.taskActionsMatch(expectedActions(changedActions),snapshot.tasks)===true);const restored=await io.restoreOldActions(tasks,oldSha);return restored===true&&await io.taskActionsMatch(expectedActions(0),snapshot.tasks)===true;},
 });
}
