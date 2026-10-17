import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createP03RecoveryEventCAS} from './p03-recovery-event-cas.mjs';

const directory='C:/Sirket/ERP/runtime/terminal-completion-logon';
const stem='p03-integrated-recovery-20261017';
const ownerSid='S-1-5-21-test';
const hash=value=>value.repeat(64);
const planDigest=hash('a'),beforeSha256=hash('b'),sourceJournalSha256=hash('c');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function file(path,value,newline){
 const bytes=new TextEncoder().encode(JSON.stringify(value)+(newline?'\n':''));
 return {path,bytes,sha256:digest(bytes),protectedOwnerAcl:{verified:true,ownerSid},createOnlyVerified:true,fsyncVerified:true};
}
function fixture(){
 const lock=file(directory+'/'+stem+'.lock.json',{schemaVersion:'melisa-p03-owner-recovery-lock.v1',planDigest,beforeSha256,sourceJournalSha256,ownerSid,createdAt:'2026-10-17T16:00:00Z'},false);
 const files=[lock],calls=[];
 let failure=null,corrupt=false,extra=false,rewriteOld=null;
 const enumerate=async()=>{calls.push('enumerate');return files.map(item=>({...item,bytes:new Uint8Array(item.bytes),protectedOwnerAcl:{...item.protectedOwnerAcl}}));};
 const createNew=async({path,bytes,sha256})=>{
  calls.push('createNew');if(failure)throw failure;
  if(files.some(item=>item.path===path))throw Error('CREATE_NEW_EXISTS');
  const item={path,bytes:new Uint8Array(bytes),sha256,protectedOwnerAcl:{verified:true,ownerSid},createOnlyVerified:true,fsyncVerified:true};
  if(corrupt)item.bytes[0]=0;
  files.push(item);
  if(extra)files.push(file(directory+'/'+stem+'-event-000.json.bak',{},false));
  if(rewriteOld)rewriteOld(files);
  return {created:true,sha256};
 };
 const freshAppend=()=>createP03RecoveryEventCAS({directory,ownerSid,planDigest,beforeSha256,sourceJournalSha256,enumerate,createNew});
 const append=freshAppend();
 return {append,freshAppend,files,calls,setFailure:value=>failure=value,setCorrupt:value=>corrupt=value,setExtra:value=>extra=value,setRewriteOld:value=>rewriteOld=value};
}
const row=(sequence,event,extra={})=>({sequence,digest:planDigest,event,...extra});

test('creates one protected canonical event and chains exact tail and sequence',async()=>{
 const f=fixture();
 const first=await f.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')});
 assert.deepEqual(first,{created:true,sequence:0,sha256:f.files[1].sha256});
 const second=await f.append({expectedTail:first.sha256,record:row(1,'RECOVERY_TASKS_STOPPED')});
 assert.deepEqual(second,{created:true,sequence:1,sha256:f.files[2].sha256});
 assert.deepEqual(f.calls,['enumerate','createNew','enumerate','enumerate','createNew','enumerate']);
});
test('stale tail, wrong sequence, plan digest, replay, and illegal ordering refuse before write',async()=>{
 const f=fixture();
 for(const input of [
  {expectedTail:hash('d'),record:row(0,'RECOVERY_INTENT')},
  {expectedTail:sourceJournalSha256,record:row(1,'RECOVERY_INTENT')},
  {expectedTail:sourceJournalSha256,record:{...row(0,'RECOVERY_INTENT'),digest:hash('f')}},
  {expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_COMPLETE')},
 ])await assert.rejects(f.append(input));
 assert.equal(f.calls.includes('createNew'),false);
 const first=await f.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')});
 await assert.rejects(f.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')}));
 await assert.rejects(f.append({expectedTail:first.sha256,record:row(1,'RECOVERY_EXACT_STOPPED',{pid:50})}));
 assert.equal(f.calls.filter(item=>item==='createNew').length,1);
});
test('lookalike event rejects complete listing before CreateNew',async()=>{
 const f=fixture();f.files.push(file(directory+'/'+stem+'-event-000.json.bak',{},false));
 await assert.rejects(f.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')}));
 assert.equal(f.calls.includes('createNew'),false);
});
test('CreateNew failure, corrupt readback, and post-write extra lookalike never report success',async()=>{
 const failed=fixture();failed.setFailure(Error('DISK_FULL'));
 await assert.rejects(failed.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')}),/DISK_FULL/);
 assert.equal(failed.files.length,1);
 const corrupt=fixture();corrupt.setCorrupt(true);
 await assert.rejects(corrupt.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')}));
 const extra=fixture();extra.setExtra(true);
 await assert.rejects(extra.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')}));
});
test('terminal recovery event refuses subsequent replay',async()=>{
 const f=fixture();let tail=sourceJournalSha256;
 for(const event of ['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE']){
  const result=await f.append({expectedTail:tail,record:row(f.files.length-1,event)});tail=result.sha256;
 }
 await assert.rejects(f.append({expectedTail:tail,record:row(4,'RECOVERY_FAILED',{phase:'RESTORE_ACTIONS'})}));
 assert.equal(f.calls.filter(item=>item==='createNew').length,4);
});
test('a pending exact stop intent permits only the matching stopped PID',async()=>{
 const f=fixture();let tail=sourceJournalSha256;
 for(const event of ['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_EXACT_STOP_INTENT']){
  const result=await f.append({expectedTail:tail,record:row(f.files.length-1,event,event==='RECOVERY_EXACT_STOP_INTENT'?{pid:50}:{})});tail=result.sha256;
 }
 for(const record of [row(3,'RECOVERY_EXACT_STOPPED',{pid:51}),row(3,'RECOVERY_FAILED',{phase:'EXACT_STOP'}),row(3,'RECOVERY_EXACT_STOP_INTENT',{pid:50})]){
  await assert.rejects(f.append({expectedTail:tail,record}));
 }
 await assert.rejects(f.freshAppend()({expectedTail:tail,record:row(3,'RECOVERY_EXACT_STOPPED',{pid:50})}));
 assert.equal(f.calls.filter(item=>item==='createNew').length,3);
 const stopped=await f.append({expectedTail:tail,record:row(3,'RECOVERY_EXACT_STOPPED',{pid:50})});
 assert.equal(stopped.sequence,3);
});
test('writer cannot replace a previously verified lock or event with valid different contents',async()=>{
 const changedLock=fixture();changedLock.setRewriteOld(files=>{
  files[0]=file(files[0].path,{schemaVersion:'melisa-p03-owner-recovery-lock.v1',planDigest,beforeSha256,sourceJournalSha256,ownerSid,createdAt:'2026-10-17T16:01:00Z'},false);
 });
 await assert.rejects(changedLock.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')}));
 const changedEvent=fixture();
 let tail=sourceJournalSha256;
 for(const event of ['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_EXACT_STOPPED']){
  tail=(await changedEvent.append({expectedTail:tail,record:row(changedEvent.files.length-1,event,event==='RECOVERY_EXACT_STOPPED'?{pid:50}:{})})).sha256;
 }
 changedEvent.setRewriteOld(files=>{files[3]=file(files[3].path,row(2,'RECOVERY_EXACT_STOPPED',{pid:51}),true);});
 await assert.rejects(changedEvent.append({expectedTail:tail,record:row(3,'RECOVERY_EXACT_STOPPED',{pid:60})}));
});
test('Windows backslash listing preserves prior-file comparison',async()=>{
 const passing=fixture();passing.files[0].path=passing.files[0].path.replaceAll('/','\\');
 assert.equal((await passing.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')})).created,true);
 const replaced=fixture();replaced.files[0].path=replaced.files[0].path.replaceAll('/','\\');
 replaced.setRewriteOld(files=>{files[0]=file(files[0].path,{schemaVersion:'melisa-p03-owner-recovery-lock.v1',planDigest,beforeSha256,sourceJournalSha256,ownerSid,createdAt:'2026-10-17T16:02:00Z'},false);});
 await assert.rejects(replaced.append({expectedTail:sourceJournalSha256,record:row(0,'RECOVERY_INTENT')}));
});
