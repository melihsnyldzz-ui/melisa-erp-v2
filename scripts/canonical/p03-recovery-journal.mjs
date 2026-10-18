// Pure reader for the existing P03 transition writer. The private owner injects
// a complete directory inventory and exact bytes; this module never opens files.
import {createHash} from 'node:crypto';
import {p03TransitionDigest} from './p03-integrated-owner-transition.mjs';

const stem='p03-integrated-owner-20261017';
const roles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
const targets=roles.filter(role=>!role.endsWith('Watcher'));
const tasks=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=()=>{throw Error('P03_JOURNAL_REJECTED');};
const check=value=>{if(!value)fail();};
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value,names)=>plain(value)&&Reflect.ownKeys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const normalized=value=>{
 if(typeof value!=='string')return null;
 const path=value.replaceAll('\\','/');
 return /^[A-Za-z]:\/(?:[A-Za-z0-9_. -]+\/)*[A-Za-z0-9_. -]+$/.test(path)&&
  path.split('/').every(part=>part!=='.'&&part!=='..')?path:null;
};
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));

function verifiedFile(file,path,ownerSid){
 check(exact(file,['path','bytes','sha256','protectedOwnerAcl']));
 check(normalized(file.path)===path&&file.bytes instanceof Uint8Array&&file.bytes.length>0&&hash(file.sha256)&&digest(file.bytes)===file.sha256);
 check(exact(file.protectedOwnerAcl,['verified','ownerSid'])&&file.protectedOwnerAcl.verified===true&&file.protectedOwnerAcl.ownerSid===ownerSid);
 try{return new TextDecoder('utf-8',{fatal:true}).decode(file.bytes);}catch{fail();}
}
function parseExact(text,newline){
 let value;try{value=JSON.parse(newline?text.endsWith('\n')?text.slice(0,-1):'':text);}catch{fail();}
 check(plain(value)&&(!newline||JSON.stringify(value)+'\n'===text));return value;
}
function normal(plan){
 const rows=[],add=(event,target)=>rows.push({sequence:rows.length,digest:plan.digest,event,...(target?{target}:{})});
 add('TASK_STOP_INTENT');add('TASKS_STOPPED');
 for(const target of targets.filter(value=>value!=='terminalWatcher'&&value!=='hubWatcher')){add('EXACT_STOP_INTENT',target);add('EXACT_STOPPED',target);}
 add('PORTS_CLEAR');for(const task of tasks){add('ACTION_INTENT',task);add('ACTION_SET',task);}
 add('START_INTENT');add('STARTED');add('COMPLETE');return rows;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function classify(rows,expected){
 if(rows.length===1&&same(rows[0],{sequence:0,digest:expected[0].digest,event:'FAILED',target:'ADMITTED'}))return 'FAILED_MANUAL_REVIEW';
 let prefix=0;while(prefix<rows.length&&prefix<expected.length&&same(rows[prefix],expected[prefix]))prefix++;
 if(prefix===rows.length){
  if(prefix===0)return 'LOCK_ONLY_PRE_MUTATION';
  if(prefix===expected.length)return 'COMPLETE_SOURCE_JOURNAL';
  if(rows.some(row=>row.event==='STARTED'))return 'STARTED_MANUAL_READBACK';
  if(rows.some(row=>row.event==='START_INTENT'))return 'START_INTENT_MANUAL_RECOVERY';
  return 'TRANSITION_PRE_START_MANUAL_REVIEW';
 }
 check(prefix>0&&prefix<expected.length);
 let tail=rows.slice(prefix);
 const actionBegun=rows.slice(0,prefix).some(row=>row.event==='ACTION_INTENT');
 const startBegun=rows.slice(0,prefix).some(row=>row.event==='START_INTENT');
 if(actionBegun&&!startBegun&&tail[0]?.event==='OLD_ACTION_RESTORE_INTENT'){
  check(same(tail[0],{sequence:prefix,digest:expected[0].digest,event:'OLD_ACTION_RESTORE_INTENT'}));tail=tail.slice(1);
  if(tail[0]?.event==='OLD_ACTIONS_RESTORED'){
   check(same(tail[0],{sequence:prefix+1,digest:expected[0].digest,event:'OLD_ACTIONS_RESTORED'}));tail=tail.slice(1);
  }
  if(tail.length===0)return 'ACTION_RESTORE_INTENT_MANUAL_REVIEW';
 }
 if(tail.length===1&&tail[0].event==='FAILED'){
  const phase=tail[0].target;
  const last=rows[prefix-1];
  const validPhase=last.event==='TASK_STOP_INTENT'||last.event==='TASKS_STOPPED'?phase==='TASK_STOP':
   last.event==='EXACT_STOP_INTENT'||last.event==='EXACT_STOPPED'?phase==='STOP_'+last.target||(last.event==='EXACT_STOPPED'&&last.target==='coreSupervisor'&&phase==='PORTS_CLEAR'):
   last.event==='PORTS_CLEAR'?phase==='PORTS_CLEAR':
   last.event==='ACTION_INTENT'||last.event==='ACTION_SET'?phase==='ACTION_'+last.target:
   last.event==='START_INTENT'?phase==='START':last.event==='STARTED'?phase==='READBACK':
   last.event==='OLD_ACTION_RESTORE_INTENT'||last.event==='OLD_ACTIONS_RESTORED'?tasks.some(task=>phase==='ACTION_'+task):false;
  check(exact(tail[0],['sequence','digest','event','target'])&&tail[0].digest===expected[0].digest&&validPhase);
  return phase==='START'||phase==='READBACK'?'FAILED_AFTER_START_MANUAL_RECOVERY':'FAILED_MANUAL_REVIEW';
 }
 fail();
}

/** Read-only classification; state labels are evidence for a human owner, never replay permission.
 * files is the owner's complete, unfiltered directory enumeration. Unrelated
 * entries need only a path; every P03-prefixed entry needs exact bytes and pins.
 */
export function readP03RecoveryJournal({directory,plan,files}){
 const root=normalized(directory);
 check(root&&exact(plan,['digest','targets','oldSettingsSha256','newSettingsSha256','ownerSid'])&&
  plan.digest===p03TransitionDigest(plan)&&typeof plan.ownerSid==='string'&&plan.ownerSid.length>0&&Array.isArray(files)&&files.length>0);
 const lockPath=root+'/'+stem+'.lock.json';
 const byPath=new Map(),seen=new Set();
 for(const file of files){
  const path=normalized(file?.path);
  check(plain(file)&&path&&path.startsWith(root+'/')&&!path.slice(root.length+1).includes('/')&&!seen.has(path));
  seen.add(path);
  if(path.slice(root.length+1).startsWith(stem)){check(byPath.size<42);byPath.set(path,file);}
 }
 check(byPath.has(lockPath));
 const lock=parseExact(verifiedFile(byPath.get(lockPath),lockPath,plan.ownerSid),false);
 const required=['schemaVersion','phase','mutationStarted','digest','old','next','ownerSid','beforeImage','taskInstances','taskCollectorSha256','candidateTaskProofSha256','businessBaselineSha256','preBusinessHash','createdAt','pid'];
 check(exact(lock,required)&&lock.schemaVersion==='melisa-p03-owner-lock.v1'&&lock.phase==='PRE_MUTATION'&&lock.mutationStarted===false&&
  lock.digest===plan.digest&&lock.old===plan.oldSettingsSha256&&lock.next===plan.newSettingsSha256&&lock.ownerSid===plan.ownerSid&&
  hash(lock.taskCollectorSha256)&&hash(lock.candidateTaskProofSha256)&&hash(lock.businessBaselineSha256)&&hash(lock.preBusinessHash)&&
  stamp(lock.createdAt)&&Number.isSafeInteger(lock.pid)&&lock.pid>0&&Array.isArray(lock.taskInstances)&&lock.taskInstances.length===2&&
  tasks.every(name=>lock.taskInstances.some(item=>exact(item,['name','enginePID','instanceGuid'])&&item.name===name&&Number.isSafeInteger(item.enginePID)&&item.enginePID>0&&typeof item.instanceGuid==='string'&&item.instanceGuid.length>0))&&
  new Set(lock.taskInstances.map(item=>item.enginePID)).size===2&&new Set(lock.taskInstances.map(item=>item.instanceGuid)).size===2);
 check(exact(lock.beforeImage,['observedAt','oldOwners'])&&stamp(lock.beforeImage.observedAt)&&Array.isArray(lock.beforeImage.oldOwners)&&lock.beforeImage.oldOwners.length===10);
 const seenRoles=new Set(),seenPids=new Set();
 for(const item of lock.beforeImage.oldOwners){
  check(exact(item,['role','pid','creationTime'])&&roles.includes(item.role)&&!seenRoles.has(item.role)&&Number.isSafeInteger(item.pid)&&item.pid>0&&!seenPids.has(item.pid)&&stamp(item.creationTime)&&Date.parse(item.creationTime)<=Date.parse(lock.beforeImage.observedAt));
  seenRoles.add(item.role);seenPids.add(item.pid);
 }
 check(roles.every(role=>seenRoles.has(role)));
 const eventFiles=[...byPath.keys()].filter(path=>path!==lockPath).sort();
 const rows=[];for(let i=0;i<eventFiles.length;i++){
  check(i<=40);const path=root+'/'+stem+'-event-'+String(i).padStart(3,'0')+'.json';check(eventFiles[i]===path);
  const row=parseExact(verifiedFile(byPath.get(path),path,plan.ownerSid),true);
  check(plain(row)&&Number.isSafeInteger(row.sequence)&&row.sequence===i&&row.digest===plan.digest);
  rows.push(row);
 }
 const state=classify(rows,normal(plan));
 return Object.freeze({state,records:rows.length,lockSha256:byPath.get(lockPath).sha256,tailSha256:rows.length?byPath.get(eventFiles.at(-1)).sha256:null,replayPermitted:false});
}
