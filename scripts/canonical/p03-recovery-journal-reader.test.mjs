import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readP03OwnerRecoveryJournal} from './p03-recovery-journal-reader.mjs';

const directory='C:/Sirket/ERP/runtime/terminal-completion-logon';
const stem='p03-integrated-recovery-20261017';
const ownerSid='S-1-5-test',planDigest='a'.repeat(64),beforeSha256='b'.repeat(64),sourceJournalSha256='c'.repeat(64);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=(path,text)=>{const bytes=Buffer.from(text);return {path,bytes,sha256:hash(bytes),protectedOwnerAcl:{verified:true,ownerSid},createOnlyVerified:true,fsyncVerified:true};};
const row=(sequence,event,extra={})=>({sequence,digest:planDigest,event,...extra});
function fixture(){
 const lock={schemaVersion:'melisa-p03-owner-recovery-lock.v1',planDigest,beforeSha256,sourceJournalSha256,ownerSid,createdAt:'2026-10-17T12:00:00Z'};
 const input={directory,ownerSid,planDigest,beforeSha256,sourceJournalSha256,files:[file(directory+'/'+stem+'.lock.json',JSON.stringify(lock))]};
 const append=(event,extra={})=>{const sequence=input.files.length-1;input.files.push(file(directory+'/'+stem+'-event-'+String(sequence).padStart(3,'0')+'.json',JSON.stringify(row(sequence,event,extra))+'\n'));};
 return {input,lock,append};
}
const read=input=>readP03OwnerRecoveryJournal(input);
const reject=input=>assert.throws(()=>read(input),/P03_RECOVERY_JOURNAL_REJECTED/);

test('lock, recovery prefix, zero discovered processes and complete remain read-only',()=>{
 const f=fixture();assert.deepEqual({state:read(f.input).state,tail:read(f.input).tailSha256},
  {state:'RECOVERY_LOCK_ONLY_MANUAL_REVIEW',tail:null});
 for(const event of ['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT']){
  f.append(event);assert.equal(read(f.input).state,'RECOVERY_OPEN_MANUAL_REVIEW');assert.equal(read(f.input).replayPermitted,false);
 }
 f.append('RECOVERY_COMPLETE');const result=read(f.input);
 assert.equal(result.state,'RECOVERY_COMPLETE_SOURCE_JOURNAL');assert.equal(result.records,4);
 assert.equal(result.tailSha256,f.input.files.at(-1).sha256);assert.equal(result.replayPermitted,false);
});
test('exact stop intent and observed absent process paths admit distinct PIDs only',()=>{
 const f=fixture();f.append('RECOVERY_INTENT');f.append('RECOVERY_TASKS_STOPPED');
 f.append('RECOVERY_EXACT_STOP_INTENT',{pid:101});
 assert.equal(read(f.input).state,'RECOVERY_STOP_INTENT_MANUAL_REVIEW');
 f.append('RECOVERY_EXACT_STOPPED',{pid:101});f.append('RECOVERY_EXACT_STOPPED',{pid:102});
 f.append('RECOVERY_OLD_ACTION_RESTORE_INTENT');f.append('RECOVERY_COMPLETE');
 assert.equal(read(f.input).state,'RECOVERY_COMPLETE_SOURCE_JOURNAL');
});
test('failure tail is accepted only in the phase emitted by the recovery owner',()=>{
 for(const [prefix,phase] of [
  [['RECOVERY_INTENT'],'TASK_STOP'],
  [['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED'],'EXACT_STOP'],
  [['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED'],'TASK_STOP'],
  [['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED'],'EMPTY'],
  [['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED'],'RESTORE_ACTIONS'],
  [['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT'],'RESTORE_ACTIONS'],
 ]){
  const f=fixture();prefix.forEach(event=>f.append(event));f.append('RECOVERY_FAILED',{phase});
  assert.equal(read(f.input).state,'RECOVERY_FAILED_MANUAL_REVIEW');
  const wrong=fixture();prefix.forEach(event=>wrong.append(event));wrong.append('RECOVERY_FAILED',{phase:'START'});reject(wrong.input);
 }
});
test('restore phase failure before restore-intent is valid only with no pending stop intent',()=>{
 const accepted=fixture();accepted.append('RECOVERY_INTENT');accepted.append('RECOVERY_TASKS_STOPPED');
 accepted.append('RECOVERY_EXACT_STOPPED',{pid:101});accepted.append('RECOVERY_FAILED',{phase:'RESTORE_ACTIONS'});
 assert.equal(read(accepted.input).state,'RECOVERY_FAILED_MANUAL_REVIEW');
 const rejected=fixture();rejected.append('RECOVERY_INTENT');rejected.append('RECOVERY_TASKS_STOPPED');
 rejected.append('RECOVERY_EXACT_STOP_INTENT',{pid:101});rejected.append('RECOVERY_FAILED',{phase:'RESTORE_ACTIONS'});
 reject(rejected.input);
 const lateTaskStop=fixture();lateTaskStop.append('RECOVERY_INTENT');lateTaskStop.append('RECOVERY_TASKS_STOPPED');
 lateTaskStop.append('RECOVERY_EXACT_STOPPED',{pid:101});lateTaskStop.append('RECOVERY_FAILED',{phase:'TASK_STOP'});
 reject(lateTaskStop.input);
});
test('complete unfiltered directory permits unrelated siblings but rejects recovery lookalikes',()=>{
 const f=fixture();f.append('RECOVERY_INTENT');f.input.files.unshift({path:directory+'/ordinary.log'});
 f.input.files.push({path:directory+'/p03-integrated-owner-20261017.lock.json'});
 assert.equal(read(f.input).records,1);
 for(const suffix of ['-event-000.json.tmp','-event-002.json','-backup.json']){
  const bad=fixture();bad.append('RECOVERY_INTENT');bad.input.files.push({path:directory+'/'+stem+suffix});reject(bad.input);
 }
 const cased=fixture();cased.input.files.push({path:directory+'/'+stem.toUpperCase()+'-event-000.json'});reject(cased.input);
});
test('byte, protected ACL, create-only, fsync and lock pins all bind selected entries',()=>{
 const changes=[
  f=>{f.input.files[1].sha256='0'.repeat(64);},
  f=>{f.input.files[1].protectedOwnerAcl.verified=false;},
  f=>{f.input.files[1].createOnlyVerified=false;},
  f=>{f.input.files[1].fsyncVerified=false;},
  f=>{f.input.files[1].bytes=Buffer.from('{}\n');f.input.files[1].sha256=hash(f.input.files[1].bytes);},
  f=>{f.lock.sourceJournalSha256='0'.repeat(64);f.input.files[0]=file(directory+'/'+stem+'.lock.json',JSON.stringify(f.lock));},
 ];
 for(const change of changes){const f=fixture();f.append('RECOVERY_INTENT');change(f);reject(f.input);}
});
test('foreign normal events, skipped sequence, duplicate PID and ambiguous terminal tails reject',()=>{
 const paths=[
  f=>f.append('START_INTENT'),
  f=>{f.append('RECOVERY_INTENT');f.append('RECOVERY_COMPLETE');},
  f=>{f.append('RECOVERY_INTENT');f.append('RECOVERY_TASKS_STOPPED');f.append('RECOVERY_EXACT_STOPPED',{pid:101});f.append('RECOVERY_EXACT_STOPPED',{pid:101});},
  f=>{f.append('RECOVERY_INTENT');f.append('RECOVERY_TASKS_STOPPED');f.append('RECOVERY_EXACT_STOP_INTENT',{pid:101});f.append('RECOVERY_OLD_ACTION_RESTORE_INTENT');},
  f=>{f.append('RECOVERY_INTENT');f.append('RECOVERY_FAILED',{phase:'TASK_STOP'});f.append('RECOVERY_TASKS_STOPPED');},
  f=>{f.append('RECOVERY_INTENT');f.input.files[1].path=f.input.files[1].path.replace('000','001');},
 ];
 for(const add of paths){const f=fixture();add(f);reject(f.input);}
});
