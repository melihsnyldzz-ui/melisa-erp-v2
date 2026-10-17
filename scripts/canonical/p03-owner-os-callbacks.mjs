// Finite OS callback boundary for the P03 handoff ordering module.
// This module never runs a command; the ERP owner injects a reviewed executor.
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';

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
  admit:async()=>{const pinned=await io.readPinnedSnapshot();check(exact(pinned,['sha256','snapshot'])&&pinned.sha256===observationSha&&JSON.stringify(pinned.snapshot)===JSON.stringify(snapshot));check(await io.verifyOldPins({oldSha,newSha,observationSha,taskXml:snapshot.tasks,stopperSha:snapshot.stopperSha,supervisor:snapshot.oldSupervisor})===true);await fresh();const held=await io.acquireExclusive(plan);check(exact(held,['owner','oldHealthy','oldActions','emptyJournal'])&&Object.values(held).every(value=>value===true));await fresh();return held;},
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
