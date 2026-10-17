import test from 'node:test';
import assert from 'node:assert/strict';
import {createP03OwnerOsCallbacks} from './p03-owner-os-callbacks.mjs';
import {p03TransitionDigest,runP03OwnerTransition} from './p03-integrated-owner-transition.mjs';

const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const names=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
function fixture(){
 const now=Date.parse('2026-10-17T16:00:00.000Z'),old='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96',next='201a159b9b51058896d25961c5292d1d8e22cc3a76024958b4c324de07896e35',ownerSid='S-1-5-21-2170750028-1005938530-2568122015-1001';
 const plan={targets,oldSettingsSha256:old,newSettingsSha256:next};plan.digest=p03TransitionDigest(plan);
 const identities=Object.fromEntries(targets.map((name,i)=>[name,{pid:100+i,parentPid:i===7?50:99,nodePath:'C:\\test\\node.exe',ownerSid,commandLine:'exact '+name,creationTime:'2026-10-17T15:59:00.000000Z',bindings:i===7?undefined:[{port:i+1,address:'127.0.0.1'}]}]));
 const tasks=names.map(name=>({name,state:'Running',xml:'<Task>'+name+'</Task>'}));
 const snapshot={schemaVersion:'melisa-p03-owner-observation.v2',hubLineage:'WATCHER_RUNNING_PARENT_EXITED_UNPROVEN',ownerSid,oldConfig:{sha256:old},newConfig:{sha256:next},database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId:'copy',actualT1:false,plan,tasks,identities};
 const calls=[],live=new Map(targets.map(name=>[identities[name].pid,structuredClone(identities[name])])),actions=new Map(names.map(name=>[name,'old']));let stopped=false,started=false,protectedOk=true,bindings=[];
 const io={freshObservation:async()=>{calls.push('observe');return {observedAt:new Date(now-1000).toISOString(),ownerSid,oldConfigSha256:old,newConfigSha256:next,database:snapshot.database,copyId:'copy',actualT1:false,tasks,identities};},
  readPinnedSnapshot:async()=>({sha256:'3a8513e96a14348c0deb9b6b6cb4b85bfdcb7a39e64a9f7ee0d04703656c77dd',snapshot}),verifyOldPins:async()=>true,
  acquireExclusive:async()=>{calls.push('lock');return {owner:true,oldHealthy:true,oldActions:true,emptyJournal:true};},persistEvent:async row=>{calls.push('event:'+row.event);return {created:true,sequence:row.sequence};},
  stopNamedTasks:async()=>{calls.push('stopTasks');stopped=true;return true;},tasksStopped:async()=>stopped,
  observeProcess:async pid=>live.get(pid)??null,stopCaptured:async(name,row)=>{calls.push('stop:'+name);live.delete(row.pid);return 'EXACT_OBSERVED_PROCESS_STOPPED';},
  portBindings:async()=>bindings,protectedUnchanged:async()=>protectedOk,
  setTaskAction:async(name,kind)=>{calls.push('action:'+name);actions.set(name,kind);return true;},taskActionsMatch:async expected=>expected.every(({name,kind})=>actions.get(name)===kind),
  startNamedTasks:async()=>{calls.push('startTasks');started=true;return true;},verifyNewOwner:async()=>started,
  restoreOldActions:async()=>{calls.push('restore');for(const name of names)actions.set(name,'old');return true;}};
 return {snapshot,io,calls,now,live,actions,setProtected:value=>{protectedOk=value;},setBindings:value=>{bindings=value;}};
}
test('finite callbacks hand a fresh exact owner through the pure transition contract',async()=>{
 const f=fixture(),result=await runP03OwnerTransition(createP03OwnerOsCallbacks({snapshot:f.snapshot,io:f.io,now:()=>f.now}));
 assert.equal(result.status,'COMPLETE');assert.equal(f.calls.filter(x=>x.startsWith('stop:')).length,8);
 assert.deepEqual(f.calls.filter(x=>x.startsWith('action:')),names.map(x=>'action:'+x));assert.equal(f.calls.at(-1),'event:COMPLETE');
});
test('admission finishes with the protected lock and does no fresh probe after it',async()=>{
 const f=fixture(),original=f.io.freshObservation;let observations=0;
 f.io.freshObservation=async()=>{observations++;if(observations>1)throw Error('POST_LOCK_PROBE');return original();};
 const callbacks=createP03OwnerOsCallbacks({snapshot:f.snapshot,io:f.io,now:()=>f.now});
 const admitted=await callbacks.admit();
 assert.deepEqual(admitted,{owner:true,oldHealthy:true,oldActions:true,emptyJournal:true});
 assert.equal(observations,1);assert.equal(f.calls.at(-1),'lock');
});
test('task, process or protected identity drift refuses before stopping tasks',async()=>{
 for(const change of [f=>{f.io.freshObservation=async()=>({...f.snapshot,observedAt:new Date(f.now-1000).toISOString(),oldConfigSha256:f.snapshot.oldConfig.sha256,newConfigSha256:f.snapshot.newConfig.sha256,tasks:[{...f.snapshot.tasks[0],xml:'changed'},f.snapshot.tasks[1]]});},f=>{f.io.freshObservation=async()=>({...f.snapshot,observedAt:new Date(f.now-1000).toISOString(),oldConfigSha256:f.snapshot.oldConfig.sha256,newConfigSha256:f.snapshot.newConfig.sha256,identities:{...f.snapshot.identities,hub:{...f.snapshot.identities.hub,commandLine:'other'}}});},f=>f.setProtected(false)]){
  const f=fixture();change(f);await assert.rejects(runP03OwnerTransition(createP03OwnerOsCallbacks({snapshot:f.snapshot,io:f.io,now:()=>f.now})),/P03_OWNER_OS_CALLBACK_REJECTED/);assert.equal(f.calls.includes('stopTasks'),false);
 }
});
test('a missing captured process is already gone; a recycled PID is never stopped',async()=>{
 const gone=fixture();gone.live.delete(gone.snapshot.identities.hub.pid);const result=await runP03OwnerTransition(createP03OwnerOsCallbacks({snapshot:gone.snapshot,io:gone.io,now:()=>gone.now}));assert.equal(result.status,'COMPLETE');assert.equal(gone.calls.includes('stop:hub'),false);
 const recycled=fixture(),stop=recycled.io.stopNamedTasks;recycled.io.stopNamedTasks=async()=>{const result=await stop();recycled.live.set(recycled.snapshot.identities.hub.pid,{...recycled.snapshot.identities.hub,creationTime:'2026-10-17T16:01:00.000000Z'});return result;};
 await assert.rejects(runP03OwnerTransition(createP03OwnerOsCallbacks({snapshot:recycled.snapshot,io:recycled.io,now:()=>recycled.now})),error=>error.code==='P03_OWNER_TRANSITION_STOPPED'&&error.phase==='STOP_hub');assert.equal(recycled.calls.includes('stop:hub'),false);
});
test('occupied target port prevents task action change and new startup',async()=>{
 const f=fixture();f.setBindings([{port:4184,pid:999}]);await assert.rejects(runP03OwnerTransition(createP03OwnerOsCallbacks({snapshot:f.snapshot,io:f.io,now:()=>f.now})),error=>error.code==='P03_OWNER_TRANSITION_STOPPED'&&error.phase==='PORTS_CLEAR');assert.equal(f.calls.some(x=>x.startsWith('action:')),false);assert.equal(f.calls.includes('startTasks'),false);
});
test('wrong pinned report and competing task action edit both fail before overwriting a task',async()=>{
 const pin=fixture();pin.io.readPinnedSnapshot=async()=>({sha256:'0'.repeat(64),snapshot:pin.snapshot});
 await assert.rejects(runP03OwnerTransition(createP03OwnerOsCallbacks({snapshot:pin.snapshot,io:pin.io,now:()=>pin.now})),/P03_OWNER_OS_CALLBACK_REJECTED/);assert.equal(pin.calls.includes('stopTasks'),false);
 const drift=fixture(),stop=drift.io.stopNamedTasks;drift.io.stopNamedTasks=async()=>{const result=await stop();drift.actions.set(names[1],'other');return result;};
 await assert.rejects(runP03OwnerTransition(createP03OwnerOsCallbacks({snapshot:drift.snapshot,io:drift.io,now:()=>drift.now})),error=>error.code==='P03_OWNER_TRANSITION_STOPPED'&&error.phase==='ACTION_'+names[0]);
 assert.equal(drift.calls.some(x=>x.startsWith('action:')),false);assert.equal(drift.calls.includes('startTasks'),false);
});
