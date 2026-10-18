// Source-only adapter. The ERP owner injects complete listings and an atomic,
// protected CreateNew writer while holding the separate exclusive recovery lock.
import {createHash} from 'node:crypto';
import {readP03OwnerRecoveryJournal} from './p03-recovery-journal-reader.mjs';

const stem='p03-integrated-recovery-20261017';
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value,names)=>plain(value)&&Reflect.ownKeys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const fail=()=>{throw Error('P03_RECOVERY_EVENT_CAS_REJECTED');};
const check=value=>{if(!value)fail();};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sameBytes=(a,b)=>a instanceof Uint8Array&&b instanceof Uint8Array&&a.length===b.length&&a.every((value,index)=>value===b[index]);
const normalizedPath=value=>typeof value==='string'?value.replaceAll('\\','/'):null;
const sortedPaths=files=>files.map(file=>normalizedPath(file.path)).sort();
const selected=(files,root)=>files.filter(file=>{const path=normalizedPath(file.path);return path?.startsWith(root+'/')&&
 path.slice(root.length+1).toLowerCase().startsWith(stem);});
const snapshot=file=>({path:file.path,normalizedPath:normalizedPath(file.path),bytes:new Uint8Array(file.bytes),sha256:file.sha256,
 protectedOwnerAcl:{...file.protectedOwnerAcl},createOnlyVerified:file.createOnlyVerified,fsyncVerified:file.fsyncVerified});
const unchanged=(left,right)=>left.path===right.path&&sameBytes(left.bytes,right.bytes)&&left.sha256===right.sha256&&
 JSON.stringify(left.protectedOwnerAcl)===JSON.stringify(right.protectedOwnerAcl)&&
 left.createOnlyVerified===right.createOnlyVerified&&left.fsyncVerified===right.fsyncVerified;

/** Injected IO must enumerate the whole directory and CreateNew protected bytes. */
export function createP03RecoveryEventCAS({directory,ownerSid,planDigest,beforeSha256,sourceJournalSha256,enumerate,createNew}){
 check(typeof directory==='string'&&typeof ownerSid==='string'&&ownerSid.length>0&&
 sha(planDigest)&&sha(beforeSha256)&&sha(sourceJournalSha256)&&typeof enumerate==='function'&&typeof createNew==='function');
 const pins={directory,ownerSid,planDigest,beforeSha256,sourceJournalSha256};
 let ownedPendingStop=null;
 return async function appendEventCAS({expectedTail,record}){
  check(sha(expectedTail)&&exact(record,Object.hasOwn(record,'pid')?['sequence','digest','event','pid']:
   Object.hasOwn(record,'phase')?['sequence','digest','event','phase']:['sequence','digest','event'])&&
   Number.isSafeInteger(record.sequence)&&record.sequence>=0&&record.sequence<=63&&record.digest===planDigest);
  const before=await enumerate();check(Array.isArray(before));
  const prior=readP03OwnerRecoveryJournal({...pins,files:before});
  check(prior.replayPermitted===false&&prior.state!=='RECOVERY_COMPLETE_SOURCE_JOURNAL'&&
   prior.state!=='RECOVERY_FAILED_MANUAL_REVIEW'&&
   record.sequence===prior.records&&expectedTail===(prior.tailSha256??sourceJournalSha256));
  if(prior.state==='RECOVERY_STOP_INTENT_MANUAL_REVIEW'){
   const pendingPath=directory.replaceAll('\\','/')+'/'+stem+'-event-'+String(prior.records-1).padStart(3,'0')+'.json';
   const pending=JSON.parse(new TextDecoder().decode(before.find(file=>normalizedPath(file.path)===pendingPath).bytes));
   check(ownedPendingStop!==null&&ownedPendingStop.pid===pending.pid&&
    ownedPendingStop.sha256===expectedTail&&ownedPendingStop.sequence===prior.records-1&&
    record.event==='RECOVERY_EXACT_STOPPED'&&record.pid===pending.pid);
  }
  const root=directory.replaceAll('\\','/');
  const oldSelected=selected(before,root).map(snapshot);
  const path=directory.replaceAll('\\','/')+'/'+stem+'-event-'+String(record.sequence).padStart(3,'0')+'.json';
  const bytes=new TextEncoder().encode(JSON.stringify(record)+'\n');
  const sha256=digest(bytes);
  // Classify the proposed exact file before any write, including event order.
  const proposed={path,bytes,sha256,protectedOwnerAcl:{verified:true,ownerSid},createOnlyVerified:true,fsyncVerified:true};
  readP03OwnerRecoveryJournal({...pins,files:[...before,proposed]});
  const result=await createNew({path,bytes,sha256});
  check(exact(result,['created','sha256'])&&result.created===true&&result.sha256===sha256);
  const after=await enumerate();check(Array.isArray(after));
  const readback=readP03OwnerRecoveryJournal({...pins,files:after});
  check(readback.records===prior.records+1&&readback.tailSha256===sha256&&
   JSON.stringify(sortedPaths(after))===JSON.stringify([...sortedPaths(before),path].sort()));
  const afterSelected=selected(after,root);
  for(const old of oldSelected)check(unchanged(old,afterSelected.find(file=>normalizedPath(file.path)===old.normalizedPath)??{}));
  const actual=after.find(file=>normalizedPath(file.path)===path);
  check(actual&&sameBytes(actual.bytes,bytes)&&actual.sha256===sha256);
  ownedPendingStop=record.event==='RECOVERY_EXACT_STOP_INTENT'?{pid:record.pid,sha256,sequence:record.sequence}:null;
  return Object.freeze({created:true,sequence:record.sequence,sha256});
 };
}
