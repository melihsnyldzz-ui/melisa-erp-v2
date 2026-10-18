import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readP03RecoveryJournal} from './p03-recovery-journal.mjs';
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';

const directory='C:/Sirket/ERP/runtime/terminal-completion-logon';
const stem='p03-integrated-owner-20261017';
const roles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
const targets=roles.filter(role=>!role.endsWith('Watcher'));
const tasks=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=(path,text)=>{const bytes=Buffer.from(text);return {path,bytes,sha256:sha(bytes),protectedOwnerAcl:{verified:true,ownerSid:'S-1-5-test'}};};
function fixture(){
 const plan={targets,oldSettingsSha256:'a'.repeat(64),newSettingsSha256:'b'.repeat(64),ownerSid:'S-1-5-test'};plan.digest=p03TransitionDigest(plan);
 const lock={schemaVersion:'melisa-p03-owner-lock.v1',phase:'PRE_MUTATION',mutationStarted:false,digest:plan.digest,old:plan.oldSettingsSha256,next:plan.newSettingsSha256,ownerSid:plan.ownerSid,beforeImage:{observedAt:'2026-10-17T12:00:00Z',oldOwners:roles.map((role,pid)=>({role,pid:100+pid,creationTime:'2026-10-17T11:00:00Z'}))},taskInstances:tasks.map((name,index)=>({name,enginePID:200+index,instanceGuid:'instance-'+index})),taskCollectorSha256:'c'.repeat(64),candidateTaskProofSha256:'d'.repeat(64),businessBaselineSha256:'e'.repeat(64),preBusinessHash:'f'.repeat(64),createdAt:'2026-10-17T12:00:01Z',pid:999};
 const normal=[],add=(event,target)=>normal.push({sequence:normal.length,digest:plan.digest,event,...(target?{target}:{})});
 add('TASK_STOP_INTENT');add('TASKS_STOPPED');for(const target of targets){add('EXACT_STOP_INTENT',target);add('EXACT_STOPPED',target);}add('PORTS_CLEAR');for(const task of tasks){add('ACTION_INTENT',task);add('ACTION_SET',task);}add('START_INTENT');add('STARTED');add('COMPLETE');
 const rows=[];const input={directory,plan,files:[file(directory+'/'+stem+'.lock.json',JSON.stringify(lock))]};
 const append=row=>{rows.push(row);input.files.push(file(directory+'/'+stem+'-event-'+String(rows.length-1).padStart(3,'0')+'.json',JSON.stringify(row)+'\n'));};
 const reset=()=>{input.files=input.files.slice(0,1);rows.length=0;};
 return {input,lock,normal,append,reset};
}
test('lock only and each normal boundary produce bounded manual states, never replay permission',()=>{
 const f=fixture();assert.equal(readP03RecoveryJournal(f.input).state,'LOCK_ONLY_PRE_MUTATION');
 for(const row of f.normal){f.append(row);const result=readP03RecoveryJournal(f.input);assert.equal(result.replayPermitted,false);assert.equal(result.records,f.input.files.length-1);}
 assert.equal(readP03RecoveryJournal(f.input).state,'COMPLETE_SOURCE_JOURNAL');
 for(const [count,state] of [[1,'TRANSITION_PRE_START_MANUAL_REVIEW'],[24,'START_INTENT_MANUAL_RECOVERY'],[25,'STARTED_MANUAL_READBACK']]){
  f.reset();f.normal.slice(0,count).forEach(f.append);assert.equal(readP03RecoveryJournal(f.input).state,state);
 }
});
test('writer lock old/next fields and caller-supplied Windows separators are read exactly',()=>{
 const f=fixture();f.input.directory=f.input.directory.replaceAll('/','\\');
 f.input.files[0].path=f.input.files[0].path.replaceAll('/','\\');
 f.append(f.normal[0]);f.input.files[1].path=f.input.files[1].path.replaceAll('/','\\');
 assert.equal(readP03RecoveryJournal(f.input).state,'TRANSITION_PRE_START_MANUAL_REVIEW');
 f.lock.old='0'.repeat(64);f.input.files[0]=file(directory+'/'+stem+'.lock.json',JSON.stringify(f.lock));
 assert.throws(()=>readP03RecoveryJournal(f.input),/P03_JOURNAL_REJECTED/);
});
test('raw runtime enumeration may contain unrelated entries, including names that sort before P03',()=>{
 const f=fixture();f.input.files.unshift({path:directory+'/a-ordinary-runtime-log.txt'});
 f.input.files.push({path:directory+'/z-other-application.json'});f.append(f.normal[0]);
 assert.equal(readP03RecoveryJournal(f.input).records,1);
});
test('every P03-prefixed sibling is selected and rejected unless it is the lock or next numbered event',()=>{
 for(const suffix of ['-backup.json','-event-001.json','-event-000.json.tmp']){
  const f=fixture();f.append(f.normal[0]);f.input.files.push({path:directory+'/'+stem+suffix});
  assert.throws(()=>readP03RecoveryJournal(f.input),/P03_JOURNAL_REJECTED/);
 }
});
test('selected event with missing byte metadata rejects even among unrelated entries',()=>{
 const f=fixture();f.append(f.normal[0]);f.input.files[1]={path:f.input.files[1].path};
 f.input.files.push({path:directory+'/ordinary.tmp'});
 assert.throws(()=>readP03RecoveryJournal(f.input),/P03_JOURNAL_REJECTED/);
});
test('failed pre-start and post-start tails classify without making recovery executable',()=>{
 const f=fixture();f.normal.slice(0,1).forEach(f.append);f.append({sequence:1,digest:f.input.plan.digest,event:'FAILED',target:'TASK_STOP'});
 assert.equal(readP03RecoveryJournal(f.input).state,'FAILED_MANUAL_REVIEW');
 f.reset();f.append({sequence:0,digest:f.input.plan.digest,event:'FAILED',target:'ADMITTED'});
 assert.equal(readP03RecoveryJournal(f.input).state,'FAILED_MANUAL_REVIEW');
 f.reset();f.normal.slice(0,18).forEach(f.append);f.append({sequence:18,digest:f.input.plan.digest,event:'FAILED',target:'PORTS_CLEAR'});
 assert.equal(readP03RecoveryJournal(f.input).state,'FAILED_MANUAL_REVIEW');
 f.reset();f.normal.slice(0,24).forEach(f.append);f.append({sequence:24,digest:f.input.plan.digest,event:'FAILED',target:'START'});
 assert.equal(readP03RecoveryJournal(f.input).state,'FAILED_AFTER_START_MANUAL_RECOVERY');
 f.reset();f.normal.slice(0,22).forEach(f.append);f.append({sequence:22,digest:f.input.plan.digest,event:'OLD_ACTION_RESTORE_INTENT'});
 assert.equal(readP03RecoveryJournal(f.input).state,'ACTION_RESTORE_INTENT_MANUAL_REVIEW');
});
test('exact file inventory, sequence, digest, bytes, ACL and old identities reject drift',()=>{
 const changes=[
  f=>f.input.files.push(file(directory+'/'+stem+'-foreign.json','{}')),
  f=>{f.input.files[1].path=f.input.files[1].path.replace('000','001');},
  f=>{f.input.files[1].sha256='0'.repeat(64);},
  f=>{f.input.files[1].protectedOwnerAcl.verified=false;},
  f=>{f.input.files[1].bytes=Buffer.from(JSON.stringify({...f.normal[0],digest:'0'.repeat(64)})+'\n');f.input.files[1].sha256=sha(f.input.files[1].bytes);},
  f=>{f.input.files[1].bytes=Buffer.from(JSON.stringify({...f.normal[0],sequence:1})+'\n');f.input.files[1].sha256=sha(f.input.files[1].bytes);},
  f=>{f.lock.beforeImage.oldOwners[9].role='hub';f.input.files[0]=file(directory+'/'+stem+'.lock.json',JSON.stringify(f.lock));},
  f=>{f.lock.phase='MUTATING';f.input.files[0]=file(directory+'/'+stem+'.lock.json',JSON.stringify(f.lock));},
 ];
 for(const change of changes){const f=fixture();f.append(f.normal[0]);change(f);assert.throws(()=>readP03RecoveryJournal(f.input),/P03_JOURNAL_REJECTED/);}
});
test('foreign recovery events, forged normal event, duplicate, and extra after complete reject',()=>{
 for(const rows of [
  f=>[{sequence:0,digest:f.input.plan.digest,event:'RECOVERY_INTENT'}],
  f=>[{...f.normal[0],event:'TASKS_STOPPED'}],
  f=>[f.normal[0],f.normal[0]],
  f=>[...f.normal,{sequence:f.normal.length,digest:f.input.plan.digest,event:'FAILED',target:'READBACK'}],
 ]){const f=fixture();rows(f).forEach(f.append);assert.throws(()=>readP03RecoveryJournal(f.input),/P03_JOURNAL_REJECTED/);}
});
