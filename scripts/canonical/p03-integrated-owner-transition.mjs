// Pure ordering contract for one reviewed ERP/CRM TEST owner handoff.
// The caller supplies exact OS observations, durable persistence and the
// existing captured-identity stopper. Importing this file performs no IO.
import {createHash} from 'node:crypto';
const expectedTargets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const coreFirstTargets=['coreSupervisor',...expectedTargets.filter(role=>role!=='coreSupervisor')];
const taskNames=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const refuse=()=>{throw Error('P03_OWNER_TRANSITION_REJECTED');};
const check=value=>{if(!value)refuse();};
const own=(value,keys)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');});
export function p03TransitionDigest({targets,oldSettingsSha256,newSettingsSha256}){
 check(Array.isArray(targets)&&targets.length===expectedTargets.length&&targets.every((name,index)=>name===expectedTargets[index]));
 check(/^[a-f0-9]{64}$/.test(oldSettingsSha256)&&/^[a-f0-9]{64}$/.test(newSettingsSha256)&&oldSettingsSha256!==newSettingsSha256);
 return createHash('sha256').update(JSON.stringify({targets,oldSettingsSha256,newSettingsSha256})).digest('hex');
}

export function p03CoreFirstStopDigest(plan){
 check(plan.digest===p03TransitionDigest(plan));
 return createHash('sha256').update(JSON.stringify({planDigest:plan.digest,stopOrder:coreFirstTargets})).digest('hex');
}
export async function runP03OwnerTransition(options){return runOrderedOwnerTransition(options,expectedTargets,null);}
// Explicit successor-only ordering; each durable record carries the extra
// order commitment. The legacy entry point and canonical inventory plan stay exact.
export async function runP03CoreFirstOwnerTransition(options){return runOrderedOwnerTransition(options,coreFirstTargets,p03CoreFirstStopDigest(options.plan));}
async function runOrderedOwnerTransition({plan,admit,persist,stopTasks,tasksStopped,stopExact,absent,portsClear,setAction,actionsEqual,startTasks,readback,restoreOldActions},stopOrder,stopOrderDigest){
 check(own(plan,['digest','targets','oldSettingsSha256','newSettingsSha256'])&&/^[a-f0-9]{64}$/.test(plan.digest));
 check(plan.digest===p03TransitionDigest(plan));
 for(const callback of [admit,persist,stopTasks,tasksStopped,stopExact,absent,portsClear,setAction,actionsEqual,startTasks,readback,restoreOldActions])check(typeof callback==='function');
 // The OS caller must prove the old owner and task actions still match its
 // fresh before-image, and that no event for this digest exists. It must
 // persist each event create-only by sequence; an old intent forbids replay.
 const admission=await admit(plan);
 check(own(admission,['owner','oldHealthy','oldActions','emptyJournal'])&&Object.values(admission).every(value=>value===true));
 let sequence=0,phase='ADMITTED',taskStopAttempted=false,startAttempted=false,actionAttempted=false;
 const save=async(event,target)=>{const record=Object.freeze({sequence,digest:plan.digest,event,...(stopOrderDigest?{stopOrderDigest}:{}),...(target?{target}:{})});const result=await persist(record);check(own(result,['created','sequence'])&&result.created===true&&result.sequence===sequence);sequence++;};
 try{
  await save('TASK_STOP_INTENT');phase='TASK_STOP';taskStopAttempted=true;
  check(await stopTasks()===true);
  check(await tasksStopped()===true);
  await save('TASKS_STOPPED');
  for(const target of stopOrder){
   await save('EXACT_STOP_INTENT',target);phase='STOP_'+target;
   const result=await stopExact(target);
   check(['EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE'].includes(result));
   check(await absent(target)===true);
   await save('EXACT_STOPPED',target);
  }
  phase='PORTS_CLEAR';check(await portsClear()===true&&await tasksStopped()===true);
  await save('PORTS_CLEAR');
  for(const name of taskNames){
   await save('ACTION_INTENT',name);phase='ACTION_'+name;actionAttempted=true;
   check(await portsClear()===true&&await tasksStopped()===true);
   check(await setAction(name,'new')===true);
   await save('ACTION_SET',name);
  }
  check(await actionsEqual('new')===true&&await portsClear()===true&&await tasksStopped()===true);
  await save('START_INTENT');phase='START';startAttempted=true;
  check(await startTasks()===true);
  await save('STARTED');
  phase='READBACK';check(await readback()===true);
  await save('COMPLETE');
  return Object.freeze({status:'COMPLETE',stopped:expectedTargets.length,started:true});
 }catch(error){
  // Before START_INTENT, the only automatic repair is restoring the two old
  // task actions while tasks are stopped and every captured port is empty.
  // Never auto-restart old or new processes from an ambiguous state.
  let actionRestore='NOT_ATTEMPTED';
  if(actionAttempted&&!startAttempted){
   try{if(await tasksStopped()===true&&await portsClear()===true){
    await save('OLD_ACTION_RESTORE_INTENT');
    if(await restoreOldActions()===true&&await actionsEqual('old')===true){actionRestore='RESTORED';await save('OLD_ACTIONS_RESTORED');}
    else actionRestore='FAILED';
   }else actionRestore='UNSAFE';}catch{actionRestore='FAILED';}
  }
  try{await save('FAILED',phase);}catch{}
  const failure=Error('P03_OWNER_TRANSITION_STOPPED');
  failure.code='P03_OWNER_TRANSITION_STOPPED';
  failure.phase=phase;
  failure.taskStopAttempted=taskStopAttempted;
  failure.startAttempted=startAttempted;
  failure.actionRestore=actionRestore;
  throw failure;
 }
}

// B264 successor: the durable core intent precedes the worker that holds the
// exact core handle and then stops COM. Legacy callbacks keep their old order.
export async function runP03HeldCoreOwnerTransition({plan,admit,persist,heldCoreCut,tasksStopped,stopExact,absent,portsClear,setAction,actionsEqual,startTasks,readback,restoreOldActions}){
 check(own(plan,['digest','targets','oldSettingsSha256','newSettingsSha256'])&&plan.digest===p03TransitionDigest(plan));
 const stopOrderDigest=p03CoreFirstStopDigest(plan);
 for(const fn of [admit,persist,heldCoreCut,tasksStopped,stopExact,absent,portsClear,setAction,actionsEqual,startTasks,readback,restoreOldActions])check(typeof fn==='function');
 const admission=await admit(plan);check(own(admission,['owner','oldHealthy','oldActions','emptyJournal'])&&Object.values(admission).every(x=>x===true));
 let sequence=0,phase='ADMITTED',taskStopAttempted=false,startAttempted=false,actionAttempted=false;
 const save=async(event,target)=>{const record=Object.freeze({sequence,digest:plan.digest,event,stopOrderDigest,...(target?{target}:{})});const result=await persist(record);check(own(result,['created','sequence'])&&result.created===true&&result.sequence===sequence);sequence++;};
 try{
  await save('TASK_STOP_INTENT');
  await save('EXACT_STOP_INTENT','coreSupervisor');phase='HELD_CORE_CUT';taskStopAttempted=true;
  const cut=await heldCoreCut();
  check(own(cut,['coreStopResult','heldCoreExited','comStopped','cutWitness','drainWitness']));
  check(['COM_STOP_NATURAL_EXIT','EXACT_OBSERVED_PROCESS_STOPPED'].includes(cut.coreStopResult)&&cut.heldCoreExited===true&&cut.comStopped===true);
  const ref=x=>own(x,['path','sha256'])&&typeof x.path==='string'&&/^[a-f0-9]{64}$/.test(x.sha256);
  check(ref(cut.cutWitness)&&ref(cut.drainWitness)&&cut.cutWitness.path!==cut.drainWitness.path);
  check(await absent('coreSupervisor')===true&&await tasksStopped()===true);
  await save('EXACT_STOPPED','coreSupervisor');await save('TASKS_STOPPED');
  for(const target of coreFirstTargets.slice(1)){
   await save('EXACT_STOP_INTENT',target);phase='STOP_'+target;
   check(['EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE'].includes(await stopExact(target)));
   check(await absent(target)===true);await save('EXACT_STOPPED',target);
  }
  phase='PORTS_CLEAR';check(await portsClear()===true&&await tasksStopped()===true);await save('PORTS_CLEAR');
  for(const name of taskNames){
   await save('ACTION_INTENT',name);phase='ACTION_'+name;actionAttempted=true;
   check(await portsClear()===true&&await tasksStopped()===true&&await setAction(name,'new')===true);await save('ACTION_SET',name);
  }
  check(await actionsEqual('new')===true&&await portsClear()===true&&await tasksStopped()===true);
  await save('START_INTENT');phase='START';startAttempted=true;check(await startTasks()===true);await save('STARTED');
  phase='READBACK';check(await readback()===true);await save('COMPLETE');
  return Object.freeze({status:'COMPLETE',stopped:expectedTargets.length,started:true});
 }catch{
  let actionRestore='NOT_ATTEMPTED';
  if(actionAttempted&&!startAttempted){try{if(await tasksStopped()===true&&await portsClear()===true){await save('OLD_ACTION_RESTORE_INTENT');if(await restoreOldActions()===true&&await actionsEqual('old')===true){actionRestore='RESTORED';await save('OLD_ACTIONS_RESTORED');}else actionRestore='FAILED';}else actionRestore='UNSAFE';}catch{actionRestore='FAILED';}}
  try{await save('FAILED',phase);}catch{}
  const error=Error('P03_OWNER_TRANSITION_STOPPED');Object.assign(error,{code:'P03_OWNER_TRANSITION_STOPPED',phase,taskStopAttempted,startAttempted,actionRestore});throw error;
 }
}
