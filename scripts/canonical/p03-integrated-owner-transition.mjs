// Pure ordering contract for one reviewed ERP/CRM TEST owner handoff.
// The caller supplies exact OS observations, durable persistence and the
// existing captured-identity stopper. Importing this file performs no IO.
import {createHash} from 'node:crypto';
const expectedTargets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const taskNames=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const refuse=()=>{throw Error('P03_OWNER_TRANSITION_REJECTED');};
const check=value=>{if(!value)refuse();};
const own=(value,keys)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');});
export function p03TransitionDigest({targets,oldSettingsSha256,newSettingsSha256}){
 check(Array.isArray(targets)&&targets.length===expectedTargets.length&&targets.every((name,index)=>name===expectedTargets[index]));
 check(/^[a-f0-9]{64}$/.test(oldSettingsSha256)&&/^[a-f0-9]{64}$/.test(newSettingsSha256)&&oldSettingsSha256!==newSettingsSha256);
 return createHash('sha256').update(JSON.stringify({targets,oldSettingsSha256,newSettingsSha256})).digest('hex');
}

export async function runP03OwnerTransition({plan,admit,persist,stopTasks,tasksStopped,stopExact,absent,portsClear,setAction,actionsEqual,startTasks,readback,restoreOldActions}){
 check(own(plan,['digest','targets','oldSettingsSha256','newSettingsSha256'])&&/^[a-f0-9]{64}$/.test(plan.digest));
 check(plan.digest===p03TransitionDigest(plan));
 for(const callback of [admit,persist,stopTasks,tasksStopped,stopExact,absent,portsClear,setAction,actionsEqual,startTasks,readback,restoreOldActions])check(typeof callback==='function');
 // The OS caller must prove the old owner and task actions still match its
 // fresh before-image, and that no event for this digest exists. It must
 // persist each event create-only by sequence; an old intent forbids replay.
 const admission=await admit(plan);
 check(own(admission,['owner','oldHealthy','oldActions','emptyJournal'])&&Object.values(admission).every(value=>value===true));
 let sequence=0,phase='ADMITTED',taskStopAttempted=false,startAttempted=false,actionAttempted=false;
 const save=async(event,target)=>{const record=Object.freeze({sequence,digest:plan.digest,event,...(target?{target}:{})});const result=await persist(record);check(own(result,['created','sequence'])&&result.created===true&&result.sequence===sequence);sequence++;};
 try{
  await save('TASK_STOP_INTENT');phase='TASK_STOP';taskStopAttempted=true;
  check(await stopTasks()===true);
  check(await tasksStopped()===true);
  await save('TASKS_STOPPED');
  for(const target of plan.targets){
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
