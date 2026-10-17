// Pure evidence classifier for the separate P03 recovery namespace. The ERP
// owner supplies a complete directory listing and already observed raw bytes.
import {createHash} from 'node:crypto';

const stem='p03-integrated-recovery-20261017';
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value,names)=>plain(value)&&Reflect.ownKeys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const fail=()=>{throw Error('P03_RECOVERY_JOURNAL_REJECTED');};
const check=value=>{if(!value)fail();};
const pathOf=value=>{
 if(typeof value!=='string')return null;
 const path=value.replaceAll('\\','/');
 return /^[A-Za-z]:\/(?:[A-Za-z0-9_. -]+\/)*[A-Za-z0-9_. -]+$/.test(path)&&
  path.split('/').every(part=>part!=='.'&&part!=='..')?path:null;
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const row=(sequence,digest,event,extra={})=>({sequence,digest,event,...extra});

function verifiedText(file,path,ownerSid){
 check(exact(file,['path','bytes','sha256','protectedOwnerAcl','createOnlyVerified','fsyncVerified'])&&
  pathOf(file.path)===path&&file.bytes instanceof Uint8Array&&file.bytes.length>=20&&file.bytes.length<=8192&&
  sha(file.sha256)&&createHash('sha256').update(file.bytes).digest('hex')===file.sha256&&
  exact(file.protectedOwnerAcl,['verified','ownerSid'])&&file.protectedOwnerAcl.verified===true&&
  file.protectedOwnerAcl.ownerSid===ownerSid&&file.createOnlyVerified===true&&file.fsyncVerified===true);
 try{return new TextDecoder('utf-8',{fatal:true}).decode(file.bytes);}catch{fail();}
}
function parse(text,newline){
 let value;try{value=JSON.parse(newline?text.endsWith('\n')?text.slice(0,-1):'':text);}catch{fail();}
 check(plain(value)&&JSON.stringify(value)+(newline?'\n':'')===text);return value;
}
function classify(rows,digest){
 if(rows.length===0)return 'RECOVERY_LOCK_ONLY_MANUAL_REVIEW';
 check(same(rows[0],row(0,digest,'RECOVERY_INTENT')));
 let phase='TASK_STOP',pending=null,stopped=new Set(),terminal=null;
 for(let i=1;i<rows.length;i++){
  const current=rows[i],event=current.event;
  check(current.sequence===i&&current.digest===digest&&terminal===null);
  if(event==='RECOVERY_FAILED'){
   check(i===rows.length-1&&exact(current,['sequence','digest','event','phase'])&&
    (current.phase===phase||
     (current.phase==='TASK_STOP'&&phase==='EXACT_STOP'&&pending===null&&stopped.size===0)||
     (phase==='EXACT_STOP'&&pending===null&&
      (current.phase==='EMPTY'||current.phase==='RESTORE_ACTIONS'))));
   terminal='RECOVERY_FAILED_MANUAL_REVIEW';continue;
  }
  if(event==='RECOVERY_TASKS_STOPPED'){
   check(phase==='TASK_STOP'&&same(current,row(i,digest,event)));
   phase='EXACT_STOP';continue;
  }
  if(event==='RECOVERY_EXACT_STOP_INTENT'){
   check(phase==='EXACT_STOP'&&pending===null&&exact(current,['sequence','digest','event','pid'])&&
    Number.isSafeInteger(current.pid)&&current.pid>0&&!stopped.has(current.pid)&&stopped.size<10);
   pending=current.pid;continue;
  }
  if(event==='RECOVERY_EXACT_STOPPED'){
   check(phase==='EXACT_STOP'&&exact(current,['sequence','digest','event','pid'])&&
    Number.isSafeInteger(current.pid)&&current.pid>0&&!stopped.has(current.pid)&&
    (pending===null||pending===current.pid)&&stopped.size<10);
   stopped.add(current.pid);pending=null;continue;
  }
  if(event==='RECOVERY_OLD_ACTION_RESTORE_INTENT'){
   check(phase==='EXACT_STOP'&&pending===null&&same(current,row(i,digest,event)));
   phase='RESTORE_ACTIONS';continue;
  }
  if(event==='RECOVERY_COMPLETE'){
   check(phase==='RESTORE_ACTIONS'&&same(current,row(i,digest,event))&&i===rows.length-1);
   terminal='RECOVERY_COMPLETE_SOURCE_JOURNAL';continue;
  }
  fail();
 }
 return terminal??(pending===null?'RECOVERY_OPEN_MANUAL_REVIEW':'RECOVERY_STOP_INTENT_MANUAL_REVIEW');
}

/** Complete listing and file proof are caller supplied. This never reads or writes. */
export function readP03OwnerRecoveryJournal({directory,ownerSid,planDigest,beforeSha256,sourceJournalSha256,files}){
 const root=pathOf(directory);
 check(root&&typeof ownerSid==='string'&&ownerSid.length>0&&sha(planDigest)&&sha(beforeSha256)&&
  sha(sourceJournalSha256)&&Array.isArray(files)&&files.length>0);
 const lockPath=root+'/'+stem+'.lock.json',selected=new Map(),seen=new Set();
 for(const file of files){
  const path=pathOf(file?.path);
  check(plain(file)&&path&&path.startsWith(root+'/')&&!path.slice(root.length+1).includes('/')&&!seen.has(path.toLowerCase()));
  seen.add(path.toLowerCase());
  if(path.slice(root.length+1).toLowerCase().startsWith(stem)){check(selected.size<26);selected.set(path,file);}
 }
 check(selected.has(lockPath));
 const lock=parse(verifiedText(selected.get(lockPath),lockPath,ownerSid),false);
 check(exact(lock,['schemaVersion','planDigest','beforeSha256','sourceJournalSha256','ownerSid','createdAt'])&&
  lock.schemaVersion==='melisa-p03-owner-recovery-lock.v1'&&lock.planDigest===planDigest&&
  lock.beforeSha256===beforeSha256&&lock.sourceJournalSha256===sourceJournalSha256&&
  lock.ownerSid===ownerSid&&typeof lock.createdAt==='string'&&Number.isFinite(Date.parse(lock.createdAt)));
 const paths=[...selected.keys()].filter(path=>path!==lockPath).sort(),rows=[];
 for(let i=0;i<paths.length;i++){
  const path=root+'/'+stem+'-event-'+String(i).padStart(3,'0')+'.json';check(paths[i]===path);
  rows.push(parse(verifiedText(selected.get(path),path,ownerSid),true));
 }
 const state=classify(rows,planDigest);
 return Object.freeze({state,records:rows.length,lockSha256:selected.get(lockPath).sha256,
  tailSha256:rows.length?selected.get(paths.at(-1)).sha256:null,replayPermitted:false});
}
