// Source-only candidate proof. The caller supplies a fresh, exact OS probe and
// immutable receipt for each CORE role. No process, port, file or task is touched.
import {COMPLETION_CORE_STAGES,completionProcessMatches,validateCompletionSettings} from './terminal-completion-logon.mjs';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
import {CRM06_STAFF_INTEGRATED_CRM_PACKAGE,CRM06_STAFF_ERP_INTEGRATED_PACKAGE,crm06StaffSuccessorProfile,CRM06_STAFF_INTEGRATED_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';

const fail=()=>{throw Error('P03_CANDIDATE_CORE_REJECTED');};
const check=value=>{if(!value)fail();};
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const keys=(value,expected)=>plain(value)&&Reflect.ownKeys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const commit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const oldRoles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
const integratedNativeOrder=Object.freeze({packageRoot:'C:\\Sirket\\ERP\\releases\\CRM-ORDER-DRAFT-TEST-20261013-7a41f64',sourceCommit:'7a41f6492273dd1ec0bcb086f820be5575372be8',manifestSha256:'6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'});
const integratedSupervisor=Object.freeze({packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-c4010efa8ff6',sourceCommit:'c4010efa8ff6b49f3e342032c98611a26c41cfaf',manifestSha256:'4fecac939834ee66266472bfc2d0d4ede3c475292971183da6e58de006c58590'});
const born=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/.test(value)&&Number.isFinite(Date.parse(value));
const stampTicks=value=>{const match=typeof value==='string'&&/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)\.(\d{1,7})Z$/.exec(value);if(!match)return null;const second=Date.parse(match[1]+'.000Z');return Number.isFinite(second)?BigInt(second)*10000n+BigInt(match[2].padEnd(7,'0')):null;};
const birthTicks=stampTicks;
const recent=(value,now)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now&&now-Date.parse(value)<=60000;

export function proveP03CandidateCore({settings,ownerSid,settingsRef,supervisorConfig,beforeImage,observations,oldPids,now}){
 check(typeof ownerSid==='string'&&validateCompletionSettings(settings,ownerSid)===settings);
 const profile=crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-integrated-20261017');
 check(keys(settingsRef,['path','sha256'])&&settingsRef.path===profile.nextPaths.settings&&sha(settingsRef.sha256));
 for(const name of ['erpApiNative','hub'])check(['packageRoot','sourceCommit','manifestSha256'].every(key=>settings.components[name][key]===CRM06_STAFF_ERP_INTEGRATED_PACKAGE[key]));
 check(['packageRoot','sourceCommit','manifestSha256'].every(key=>settings.components.nativeOrder[key]===integratedNativeOrder[key]));
 check(['packageRoot','sourceCommit','manifestSha256'].every(key=>settings.components.crm[key]===CRM06_STAFF_INTEGRATED_CRM_PACKAGE[key]));
 check(['packageRoot','sourceCommit','manifestSha256'].every(key=>settings.supervisor[key]===integratedSupervisor[key]));
 check(keys(supervisorConfig,['path','sha256'])&&supervisorConfig.path===settingsRef.path&&supervisorConfig.sha256===settingsRef.sha256);
 const clock=Date.parse(now),clockTicks=stampTicks(now),beforeTicks=stampTicks(beforeImage?.observedAt);
 check(typeof now==='string'&&Number.isFinite(clock)&&clockTicks!==null&&beforeTicks!==null&&beforeTicks<=clockTicks);
 check(keys(beforeImage,['observedAt','oldOwners'])&&Array.isArray(beforeImage.oldOwners)&&beforeImage.oldOwners.length===10);
 const old=new Set(),roles=new Set();
 for(const identity of beforeImage.oldOwners){check(keys(identity,['role','pid','creationTime'])&&oldRoles.includes(identity.role)&&!roles.has(identity.role)&&Number.isSafeInteger(identity.pid)&&identity.pid>0&&!old.has(identity.pid)&&born(identity.creationTime)&&birthTicks(identity.creationTime)<=beforeTicks);roles.add(identity.role);old.add(identity.pid);}
 check(oldRoles.every(role=>roles.has(role))&&Array.isArray(oldPids)&&oldPids.length===10&&new Set(oldPids).size===10&&oldPids.every(pid=>old.has(pid)));
 check(Array.isArray(observations)&&observations.length===COMPLETION_CORE_STAGES.length);
 const names=new Set(),pids=new Set(),runs=new Set(),bindings=new Set();
 let parentPid,parentCreationTime;
 for(const observation of observations){
  check(keys(observation,['stage','rows','receipt','observedAt','receiptRef'])&&typeof observation.stage==='string'&&!names.has(observation.stage)&&recent(observation.observedAt,clock)&&stampTicks(observation.observedAt)!==null&&stampTicks(observation.observedAt)>=beforeTicks);
  const stage=COMPLETION_CORE_STAGES.find(item=>item.name===observation.stage);
  check(stage&&Array.isArray(observation.rows)&&observation.rows.length===1);
  const [row]=observation.rows,receipt=observation.receipt,pin=settings.components[stage.component];
  check(keys(observation.receiptRef,['path','sha256','observedAt'])&&observation.receiptRef.path===settings.runtimeDirectory+'\\'+stage.name+'.json'&&sha(observation.receiptRef.sha256)&&recent(observation.receiptRef.observedAt,clock)&&stampTicks(observation.receiptRef.observedAt)!==null&&stampTicks(observation.receiptRef.observedAt)<=stampTicks(observation.observedAt));
  check(keys(receipt,['run','pid','parentPid','parentCreationTime','creationTime','stage','sourceCommit','configSha256','copyId','actualT1'])&&
   typeof receipt.run==='string'&&receipt.run.length>0&&!runs.has(receipt.run)&&
   commit(pin.sourceCommit)&&sha(pin.manifestSha256)&&sha(pin.config.sha256)&&
   !old.has(receipt.pid)&&!old.has(receipt.parentPid)&&!pids.has(receipt.pid)&&
   born(receipt.creationTime)&&born(receipt.parentCreationTime)&&birthTicks(receipt.parentCreationTime)>beforeTicks&&birthTicks(receipt.creationTime)>birthTicks(receipt.parentCreationTime)&&birthTicks(receipt.creationTime)<=stampTicks(observation.observedAt)&&
   completionProcessMatches(row,receipt,stage,settings));
  check(stampTicks(observation.receiptRef.observedAt)>=beforeTicks&&stampTicks(observation.receiptRef.observedAt)>=birthTicks(receipt.creationTime));
  const parent=nativeArgumentTokens(row.parentCommandLine);
  check(parent.length===11&&parent[3]==='--config'&&parent[4]===supervisorConfig.path&&
   parent[5]==='--sha256'&&parent[6]===supervisorConfig.sha256&&
   parent[7]==='--owner-sid'&&parent[8]===settings.ownerSid&&parent[9]==='--action'&&parent[10]==='Start'&&
   parent[0]===settings.node.path);
  if(parentPid===undefined){parentPid=receipt.parentPid;parentCreationTime=receipt.parentCreationTime;}
  check(receipt.parentPid===parentPid&&receipt.parentCreationTime===parentCreationTime);
  for(const binding of row.bindings){
   const key=`${binding.address}:${binding.port}`;
   check(!bindings.has(key));bindings.add(key);
  }
  names.add(stage.name);pids.add(receipt.pid);runs.add(receipt.run);
 }
 check(COMPLETION_CORE_STAGES.every(stage=>names.has(stage.name)));
 return Object.freeze({status:'CANDIDATE_CORE_CONDITIONAL_CONSISTENCY',roles:Object.freeze([...names]),parentPid});
}
