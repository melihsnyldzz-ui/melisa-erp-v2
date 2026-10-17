// Explicit, finite recovery contract for a P03 START_INTENT partial start.
// All observations, durable writes and OS operations belong to the injected ERP owner.
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';

const tasks=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const ports=[4184,4186,5234,62700,62701,62702,62703,62704];
// Children and web workers precede their watcher; the supervisor is last.
const stopOrder=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=()=>{throw Error('P03_OWNER_RECOVERY_REJECTED');};
const check=value=>{if(!value)fail();};
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const keys=(value,expected)=>plain(value)&&Reflect.ownKeys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));
const actionHashes=value=>keys(value,tasks)&&tasks.every(name=>sha(value[name]));
const identity=value=>keys(value,['role','pid','parentPid','nodePath','ownerSid','commandLine','configSha256','creationTime','bindings'])&&stopOrder.includes(value.role)&&Number.isSafeInteger(value.pid)&&value.pid>0&&Number.isSafeInteger(value.parentPid)&&value.parentPid>=0&&typeof value.nodePath==='string'&&value.nodePath.length>0&&typeof value.ownerSid==='string'&&value.ownerSid.length>0&&typeof value.commandLine==='string'&&value.commandLine.length>0&&sha(value.configSha256)&&Number.isFinite(Date.parse(value.creationTime))&&Array.isArray(value.bindings)&&value.bindings.every(row=>keys(row,['port','address'])&&ports.includes(row.port)&&typeof row.address==='string'&&row.address.length>0);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function normalJournal(plan){
 const rows=[],add=(event,target)=>rows.push({sequence:rows.length,digest:plan.digest,event,...(target?{target}:{})});
 add('TASK_STOP_INTENT');add('TASKS_STOPPED');
 for(const target of targets){add('EXACT_STOP_INTENT',target);add('EXACT_STOPPED',target);}
 add('PORTS_CLEAR');for(const task of tasks){add('ACTION_INTENT',task);add('ACTION_SET',task);}
 add('START_INTENT');return rows;
}

export async function runP03OwnerRecovery({explicit,plan,before,journal,io,now=()=>Date.now()}){
 check(explicit===true&&keys(plan,['digest','targets','oldSettingsSha256','newSettingsSha256','newActionHashes'])&&plan.digest===p03TransitionDigest(plan)&&actionHashes(plan.newActionHashes));
 check(keys(before,['sha256','planDigest','databaseDigest','protectedDigest','oldActionHashes','oldPids'])&&sha(before.sha256)&&before.planDigest===plan.digest&&sha(before.databaseDigest)&&sha(before.protectedDigest)&&actionHashes(before.oldActionHashes));
 check(keys(before.oldPids,targets)&&targets.every(name=>Number.isSafeInteger(before.oldPids[name])&&before.oldPids[name]>0));
 check(keys(journal,['sha256','records'])&&sha(journal.sha256)&&Array.isArray(journal.records)&&journal.records.length>0);
 const prefix=normalJournal(plan),started={sequence:prefix.length,digest:plan.digest,event:'STARTED'};
 const failedStart={sequence:prefix.length,digest:plan.digest,event:'FAILED',target:'START'};
 const failedReadback={sequence:prefix.length+1,digest:plan.digest,event:'FAILED',target:'READBACK'};
 check([
  prefix,[...prefix,failedStart],[...prefix,started],[...prefix,started,failedReadback],
 ].some(rows=>same(rows,journal.records)));
 const methods=['verifyPins','acquireExclusive','appendEventCAS','protectedDigests','taskActionsMatch','stopTasksCAS','tasksStopped','inventory','verifyCandidateProcess','stopExact','observeProcess','portsClear','oldProcessesAbsent','restoreOldActionsCAS','quarantine'];
 check(plain(io)&&methods.every(name=>typeof io[name]==='function')&&typeof now==='function');
 let phase='ADMISSION',sequence=journal.records.length,tail=journal.sha256,mutated=false,quarantined=false;
 const event=async(name,extra={})=>{const row={sequence,digest:plan.digest,event:name,...extra};const result=await io.appendEventCAS({expectedTail:tail,record:row});check(keys(result,['created','sequence','sha256'])&&result.created===true&&result.sequence===sequence&&sha(result.sha256)&&result.sha256!==tail);sequence++;tail=result.sha256;};
 const protectedOk=async()=>{const result=await io.protectedDigests();check(keys(result,['databaseDigest','protectedDigest'])&&result.databaseDigest===before.databaseDigest&&result.protectedDigest===before.protectedDigest);};
 const inventory=async()=>{const result=await io.inventory();check(keys(result,['observedAt','processes','bindings'])&&Number.isFinite(Date.parse(result.observedAt))&&now()-Date.parse(result.observedAt)>=0&&now()-Date.parse(result.observedAt)<60000&&Array.isArray(result.processes)&&Array.isArray(result.bindings));
  const seen=new Set(),roles=new Set();for(const row of result.processes){check(identity(row)&&!seen.has(row.pid)&&!roles.has(row.role)&&!Object.values(before.oldPids).includes(row.pid));seen.add(row.pid);roles.add(row.role);}
  for(const row of result.bindings){check(keys(row,['port','address','pid'])&&ports.includes(row.port)&&Number.isSafeInteger(row.pid)&&row.pid>0);const owner=result.processes.find(process=>process.pid===row.pid);check(owner&&owner.bindings.some(binding=>binding.port===row.port&&binding.address===row.address));}
  for(const process of result.processes)for(const binding of process.bindings)check(result.bindings.some(row=>row.pid===process.pid&&row.port===binding.port&&row.address===binding.address));
  return result;
 };
 try{
  check(await io.verifyPins({plan,before,journal})===true);
  const held=await io.acquireExclusive({planDigest:plan.digest,journalSha256:journal.sha256});check(keys(held,['owner','exclusive','journalUnchanged'])&&Object.values(held).every(value=>value===true));
  await protectedOk();check(await io.taskActionsMatch(plan.newActionHashes)===true);
  const first=await inventory();
  // The reviewed caller validates role, SID, executable, argv/config, birth,
  // parent lineage and the role-specific port map against pinned new-owner data.
  for(const row of first.processes)check(await io.verifyCandidateProcess({candidate:row,plan,before})===true);
  // A foreign target port, an unreported watcher, or a reused old PID is ambiguous.
  await event('RECOVERY_INTENT');phase='TASK_STOP';mutated=true;
  check(await io.stopTasksCAS({names:tasks,expectedActionHashes:plan.newActionHashes})===true);
  check(await io.tasksStopped(tasks)===true);await event('RECOVERY_TASKS_STOPPED');
  await protectedOk();check(await io.taskActionsMatch(plan.newActionHashes)===true);
  const afterStop=await inventory();const discovered=new Map();
  for(const row of [...first.processes,...afterStop.processes]){
   const prior=discovered.get(row.pid);check(!prior||same(prior,row));discovered.set(row.pid,row);
  }
  for(const row of discovered.values())check(await io.verifyCandidateProcess({candidate:row,plan,before})===true);
  for(const row of [...discovered.values()].sort((a,b)=>stopOrder.indexOf(a.role)-stopOrder.indexOf(b.role))){
   phase='EXACT_STOP';await protectedOk();check(await io.tasksStopped(tasks)===true);
   const current=await io.observeProcess(row.pid);if(current!==null){check(identity(current)&&same(current,row));await event('RECOVERY_EXACT_STOP_INTENT',{pid:row.pid});check(await io.stopExact(row)=== 'EXACT_OBSERVED_PROCESS_STOPPED');}
   check(await io.observeProcess(row.pid)===null);await event('RECOVERY_EXACT_STOPPED',{pid:row.pid});
  }
  phase='EMPTY';await protectedOk();check(await io.tasksStopped(tasks)===true&&await io.portsClear(ports)===true&&await io.oldProcessesAbsent(before.oldPids)===true);
  const finalInventory=await inventory();check(finalInventory.processes.length===0&&finalInventory.bindings.length===0);
  phase='RESTORE_ACTIONS';check(await io.taskActionsMatch(plan.newActionHashes)===true);
  await event('RECOVERY_OLD_ACTION_RESTORE_INTENT');
  check(await io.restoreOldActionsCAS({names:tasks,expectedActionHashes:plan.newActionHashes,restoreActionHashes:before.oldActionHashes})===true);
  check(await io.taskActionsMatch(before.oldActionHashes)===true);
  await protectedOk();check(await io.tasksStopped(tasks)===true&&await io.portsClear(ports)===true&&await io.oldProcessesAbsent(before.oldPids)===true);
  const readback=await inventory();check(readback.processes.length===0&&readback.bindings.length===0);
  await event('RECOVERY_COMPLETE');return Object.freeze({status:'RECOVERED_OLD_ACTIONS',oldTasksStarted:false,stopped:discovered.size});
 }catch(error){
  if(mutated){try{await event('RECOVERY_FAILED',{phase});}catch{}
   try{quarantined=await io.quarantine({planDigest:plan.digest,phase,expectedTail:tail})===true;}catch{}
  }
  const failure=Error('P03_OWNER_RECOVERY_STOPPED');failure.code='P03_OWNER_RECOVERY_STOPPED';failure.phase=phase;failure.quarantined=quarantined;throw failure;
 }
}
