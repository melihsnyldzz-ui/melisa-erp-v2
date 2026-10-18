import test from 'node:test';
import assert from 'node:assert/strict';
import {runP03OwnerRecovery} from './p03-owner-recovery.mjs';
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';

const names=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const hash=value=>value.repeat(64);
function fixture(){
 const now=Date.parse('2026-10-17T16:00:00Z');
 const plan={targets,oldSettingsSha256:hash('a'),newSettingsSha256:hash('b'),newActionHashes:Object.fromEntries(names.map(name=>[name,hash('c')]))};plan.digest=p03TransitionDigest(plan);
 const before={sha256:hash('d'),planDigest:plan.digest,databaseDigest:hash('e'),protectedDigest:hash('f'),oldActionHashes:Object.fromEntries(names.map(name=>[name,hash('1')])),oldPids:Object.fromEntries(targets.map((name,index)=>[name,index+100]))};
 const records=[],add=(event,target)=>records.push({sequence:records.length,digest:plan.digest,event,...(target?{target}:{})});
 add('TASK_STOP_INTENT');add('TASKS_STOPPED');for(const target of targets){add('EXACT_STOP_INTENT',target);add('EXACT_STOPPED',target);}
 add('PORTS_CLEAR');for(const name of names){add('ACTION_INTENT',name);add('ACTION_SET',name);}add('START_INTENT');
 const journal={sha256:hash('2'),records};
 const one={role:'hub',pid:500,parentPid:400,nodePath:'C:/test/node.exe',ownerSid:'S-1-5-test',commandLine:'node watcher',configSha256:plan.newSettingsSha256,creationTime:'2026-10-17T15:59:00Z',bindings:[{port:4184,address:'127.0.0.1'}]};
 const state={processes:[one],bindings:[{port:4184,address:'127.0.0.1',pid:500}],stopped:false,actions:'new',protected:true,quarantined:false,stopper:true};
 const calls=[],events=[];let tail=journal.sha256;
 const io={verifyPins:async()=>true,acquireExclusive:async()=>({owner:true,exclusive:true,journalUnchanged:true}),
  appendEventCAS:async({expectedTail,record})=>{assert.equal(expectedTail,tail);calls.push('event:'+record.event);events.push(record);tail=String(events.length).padStart(64,'0');return {created:true,sequence:record.sequence,sha256:tail};},
  protectedDigests:async()=>({databaseDigest:state.protected?before.databaseDigest:hash('0'),protectedDigest:before.protectedDigest}),
  taskActionsMatch:async expected=>Object.values(expected).every(value=>value===(state.actions==='new'?hash('c'):hash('1'))),
  stopTasksCAS:async()=>{calls.push('stopTasks');state.stopped=true;return true;},tasksStopped:async()=>state.stopped,
  inventory:async()=>({observedAt:new Date(now-1000).toISOString(),processes:structuredClone(state.processes),bindings:structuredClone(state.bindings)}),
  verifyCandidateProcess:async({candidate,plan})=>candidate.ownerSid==='S-1-5-test'&&candidate.nodePath==='C:/test/node.exe'&&candidate.commandLine==='node watcher'&&candidate.configSha256===plan.newSettingsSha256&&candidate.parentPid===400&&candidate.creationTime==='2026-10-17T15:59:00Z'&&candidate.role==='hub'&&candidate.bindings.length===1&&candidate.bindings[0].port===4184,
  observeProcess:async pid=>structuredClone(state.processes.find(row=>row.pid===pid)??null),
  stopExact:async row=>{calls.push('stop:'+row.pid);if(!state.stopper)return 'REFUSED';state.processes=state.processes.filter(item=>item.pid!==row.pid);state.bindings=state.bindings.filter(item=>item.pid!==row.pid);return 'EXACT_OBSERVED_PROCESS_STOPPED';},
  portsClear:async()=>state.bindings.length===0,oldProcessesAbsent:async()=>true,
  restoreOldActionsCAS:async()=>{calls.push('restore');state.actions='old';return true;},quarantine:async()=>{calls.push('quarantine');state.quarantined=true;return true;}};
 return {input:{explicit:true,plan,before,journal,io,now:()=>now},state,calls,events,one};
}
test('partial first-task start is stopped exactly, then old actions are restored without restart',async()=>{
 const f=fixture(),result=await runP03OwnerRecovery(f.input);
 assert.deepEqual(result,{status:'RECOVERED_OLD_ACTIONS',oldTasksStarted:false,stopped:1});
 assert.deepEqual(f.calls.filter(value=>value.startsWith('stop:')),['stop:500']);
 assert.ok(f.calls.indexOf('event:RECOVERY_EXACT_STOP_INTENT')<f.calls.indexOf('stop:500'));
 assert.ok(f.calls.indexOf('event:RECOVERY_OLD_ACTION_RESTORE_INTENT')<f.calls.indexOf('restore'));
 assert.equal(f.events.at(-1).event,'RECOVERY_COMPLETE');assert.equal(f.state.quarantined,false);
});
test('START_INTENT with no surviving new process still restores old actions after empty-port proof',async()=>{
 const f=fixture();f.state.processes=[];f.state.bindings=[];
 const result=await runP03OwnerRecovery(f.input);assert.equal(result.stopped,0);assert.equal(f.calls.some(value=>value.startsWith('stop:')),false);assert.equal(f.calls.includes('restore'),true);
});
test('the original transition FAILED START marker remains recoverable once',async()=>{
 const f=fixture(),sequence=f.input.journal.records.length;f.input.journal.records.push({sequence,digest:f.input.plan.digest,event:'FAILED',target:'START'});
 const result=await runP03OwnerRecovery(f.input);assert.equal(result.status,'RECOVERED_OLD_ACTIONS');assert.equal(f.events[0].sequence,sequence+1);
});
test('STARTED and FAILED READBACK tails recover, while COMPLETE or a forged prefix cannot replay',async()=>{
 for(const tail of [['STARTED'],['STARTED','FAILED']]){
  const f=fixture();for(const event of tail)f.input.journal.records.push({sequence:f.input.journal.records.length,digest:f.input.plan.digest,event,...(event==='FAILED'?{target:'READBACK'}:{})});
  assert.equal((await runP03OwnerRecovery(f.input)).status,'RECOVERED_OLD_ACTIONS');
 }
 for(const change of [f=>f.input.journal.records[0].event='FAKE',f=>f.input.journal.records.push({sequence:f.input.journal.records.length,digest:f.input.plan.digest,event:'COMPLETE'}),f=>f.input.journal.records.push({sequence:f.input.journal.records.length,digest:f.input.plan.digest,event:'START_INTENT'})]){
  const f=fixture();change(f);await assert.rejects(runP03OwnerRecovery(f.input));assert.equal(f.calls.includes('stopTasks'),false);
 }
});
test('explicit invocation, pinned plan, and replay journal are required before mutation',async()=>{
 for(const change of [f=>{f.input.explicit=false;},f=>{f.input.before.planDigest=hash('0');},f=>{f.input.journal.records.push({sequence:1,digest:f.input.plan.digest,event:'RECOVERY_INTENT'});},f=>{f.input.io.verifyPins=async()=>false;}]){
  const f=fixture();change(f);await assert.rejects(runP03OwnerRecovery(f.input));assert.equal(f.calls.includes('stopTasks'),false);assert.equal(f.calls.includes('restore'),false);
 }
});
test('foreign PID or port, and recycled old PID refuse recovery before task stop',async()=>{
 for(const change of [f=>f.state.bindings.push({port:4186,address:'127.0.0.1',pid:999}),f=>{f.state.processes[0].pid=100;f.state.bindings[0].pid=100;},f=>f.state.processes[0].bindings[0].port=4186,f=>f.state.processes[0].ownerSid='foreign',f=>f.state.processes[0].configSha256=hash('0'),f=>f.state.processes[0].parentPid=999]){
  const f=fixture();change(f);await assert.rejects(runP03OwnerRecovery(f.input));assert.equal(f.calls.includes('stopTasks'),false);assert.equal(f.calls.includes('restore'),false);
 }
});
test('watchers plus eight targets are permitted and exact stop orders supervisor last',async()=>{
 const f=fixture(),roles=['crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
 for(const [index,role] of roles.entries())f.state.processes.push({...f.one,role,pid:501+index,bindings:[]});
 f.input.io.verifyCandidateProcess=async({candidate,plan})=>candidate.ownerSid==='S-1-5-test'&&candidate.nodePath==='C:/test/node.exe'&&candidate.commandLine==='node watcher'&&candidate.configSha256===plan.newSettingsSha256&&candidate.parentPid===400;
 const result=await runP03OwnerRecovery(f.input);assert.equal(result.stopped,10);assert.equal(f.calls.filter(value=>value.startsWith('stop:')).at(-1),'stop:509');
});
test('database drift refuses before stop and later drift quarantines without action restore',async()=>{
 const first=fixture();first.state.protected=false;await assert.rejects(runP03OwnerRecovery(first.input));assert.equal(first.calls.includes('stopTasks'),false);
 const later=fixture(),stop=later.input.io.stopTasksCAS;later.input.io.stopTasksCAS=async args=>{const result=await stop(args);later.state.protected=false;return result;};
 await assert.rejects(runP03OwnerRecovery(later.input),error=>error.code==='P03_OWNER_RECOVERY_STOPPED'&&error.quarantined===true);
 assert.equal(later.calls.includes('restore'),false);assert.equal(later.state.quarantined,true);
});
test('stopper refusal quarantines and never restores old actions',async()=>{
 const f=fixture();f.state.stopper=false;await assert.rejects(runP03OwnerRecovery(f.input),error=>error.phase==='EXACT_STOP'&&error.quarantined===true);
 assert.equal(f.calls.includes('restore'),false);assert.equal(f.state.processes.length,1);
});
test('first recovery intent persisted but readback failed is quarantined before task stop',async()=>{
 const f=fixture(),append=f.input.io.appendEventCAS;
 let first=true;
 f.input.io.appendEventCAS=async input=>{
  if(first){first=false;await append(input);throw Error('POST_WRITE_READBACK_FAILED');}
  return append(input);
 };
 await assert.rejects(runP03OwnerRecovery(f.input),error=>error.code==='P03_OWNER_RECOVERY_STOPPED'&&error.phase==='TASK_STOP'&&error.quarantined===true);
 assert.equal(f.events[0].event,'RECOVERY_INTENT');
 assert.equal(f.calls.includes('stopTasks'),false);
 assert.equal(f.calls.includes('restore'),false);
});
