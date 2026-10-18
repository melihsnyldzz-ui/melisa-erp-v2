// Pure, single-predecessor admission. This returns proposed CreateNew bytes;
// it does not release a lock, touch Windows, or authorize a replay.
import {createHash} from 'node:crypto';
import path from 'node:path';
import {p03CoreFirstStopDigest} from './p03-integrated-owner-transition.mjs';
export const PR54_OWNER_ROOT='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018';
export const PR54_PREDECESSOR_RUN='639e2da815e1e7ac0f1c0d04d7f7bdc3';
export const PR54_PREDECESSOR_TRANSITION=PR54_OWNER_ROOT+'\\MelisaERP-P03-transition-'+PR54_PREDECESSOR_RUN;
export const PR54_PREDECESSOR_JOURNAL=PR54_OWNER_ROOT+'\\MelisaERP-P03-recovery-'+PR54_PREDECESSOR_RUN;
export const PR54_SUCCESSOR_CLAIM_PATH=PR54_OWNER_ROOT+'\\p03-pr54-successor-of-'+PR54_PREDECESSOR_RUN+'.lock.json';
export const PR54_REHEARSED_ENGINE_SHA='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037';
const fixed=(leaf,sha256,root=PR54_PREDECESSOR_TRANSITION)=>Object.freeze({path:root+'\\'+leaf,sha256});
export const PR54_PREDECESSOR_REFS=Object.freeze({
 globalLock:fixed('p03-pr54-shared-owner.lock.json','69bf4c022904e6c8d2baa2ea5766e3c115dde2b9e2412d6cfbe0a004e2cf235b',PR54_OWNER_ROOT),
 transitionLock:fixed('transition.lock','aa00995da40dd5d2c4f5d5c6a9f3d71624e86e6ea3843aabc37197e714b1a1f4'),
 profile:fixed('MelisaERP-P03-profile-'+PR54_PREDECESSOR_RUN+'.json','17fec444c09d04331a12e73264039f1d65c23158ed7d289c43880bfe25fbc041',PR54_OWNER_ROOT),
 before:fixed('MelisaERP-P03-before-'+PR54_PREDECESSOR_RUN+'.json','c58fdcd36ff3c16e9c2df8965982c17a0830cf527314df5a66bfe71f69e6d256',PR54_OWNER_ROOT),
 event0:fixed('event-0000.json','fd09519005b519dbb953e6d030f66cf8e6c586bf15bd27043ce9d5dccec056a2'),
 event1:fixed('event-0001.json','52e907db361e7aeb1e89976734cdccedab1a435747914ae48c9e73dbe12d72fa'),
 priorIntent:fixed('paused-old-recovery-intent.json','6eb43d46509faeb8bef1b740c19d8410a33699232137a27576522be02f68f263'),
 priorFailure:fixed('paused-old-recovery-failed.json','6bf3d88d0c866ae0c7c1f83df044e9b64f427e1565be6f82f5f6bbca8e0241b8'),
 originalConsoleIntent:fixed('paused-old-console-recovery-intent.json','6d89a9eadffdec76df380a5c6feb7ae819c6ebfbf20544598938f3f9f227a2ed'),
 originalConsoleCut:fixed('paused-old-console-core-cut-observation.json','cd086021c17e6b15a3abead8fc328782a5d5a378b29e82abc95153aa8b247be0'),
 originalConsoleCompleted:fixed('paused-old-console-core-cut-completed.json','c89baea866c1f7610f230eff18a866e2f689196833ddd16888e36072b322a1a0'),
 originalConsoleFailure:fixed('paused-old-console-recovery-failed.json','62c0f948119081e250e6cc62626c39e9f9f834bd4950c99d6c47d09c955df26b'),
 engine:fixed('p03-physical-rollback.ps1',PR54_REHEARSED_ENGINE_SHA),
});
const owner='S-1-5-21-2170750028-1005938530-2568122015-1001';
const tasks=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const roles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Error('P03_OWNER_SUCCESSOR_REJECTED');};
const check=value=>{if(!value)fail();};
const plain=value=>value&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value,keys)=>plain(value)&&Object.keys(value).sort().join('|')===keys.toSorted().join('|');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const birth=value=>typeof value==='string'?value.replace(/(\.\d{6})Z$/,(_,part)=>part+'0Z'):null;
const identity=(a,b)=>a&&b&&['pid','parentPid','nodePath','ownerSid','commandLine'].every(key=>a[key]===b[key])&&birth(a.creationTime)===birth(b.creationTime);
const ref=value=>exact(value,['path','sha256'])&&typeof value.path==='string'&&path.win32.normalize(value.path)===value.path&&!value.path.includes('/')&&sha(value.sha256);
const bytesOf=row=>{check(row?.bytes instanceof Uint8Array&&ref(row.ref)&&hash(row.bytes)===row.ref.sha256);return JSON.parse(Buffer.from(row.bytes).toString('utf8'));};
// The fixed predecessor bytes are verified by the real IO reader, never by a
// caller-provided boolean. Pure fixtures can supply the already-pinned objects.
export function pr54OwnerSuccessorRefs(predecessorRef){
 check(exact(predecessorRef,['recoveryResult','candidate','consoleIntent','consoleCut','recoveryTail']));
 for(const value of Object.values(predecessorRef))check(ref(value));
 check(predecessorRef.recoveryResult.path===PR54_PREDECESSOR_TRANSITION+'\\paused-old-console-resume-result.json');
 check(predecessorRef.consoleIntent.path===PR54_PREDECESSOR_TRANSITION+'\\paused-old-console-resume-intent.json');
 check(predecessorRef.consoleCut.path===PR54_PREDECESSOR_TRANSITION+'\\paused-old-console-core-cut-observation.json');
 check(/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-candidate-[a-f0-9]{32}\.json$/.test(predecessorRef.candidate.path));
 check(predecessorRef.recoveryTail.path===PR54_PREDECESSOR_JOURNAL+'\\event-0006.json');
 return {...PR54_PREDECESSOR_REFS,...predecessorRef};
}
function proveRecovery({refs,previous,raw}){
 check(exact(previous,['globalLock','transitionLock','profile','before','event0','event1','priorIntent','priorFailure','originalConsoleIntent','originalConsoleCut','originalConsoleCompleted','originalConsoleFailure']));
 const oldProfile=previous.profile,oldBefore=previous.before;
 for(const lock of [previous.globalLock,previous.transitionLock])check(same(lock.profileRef,refs.profile)&&same(lock.beforeRef,refs.before));
 check(previous.globalLock.transitionDirectory===PR54_PREDECESSOR_TRANSITION);
 check(oldBefore.runId===PR54_PREDECESSOR_RUN&&same(oldProfile.beforeImage,refs.before)&&oldProfile.journalDirectory===PR54_PREDECESSOR_JOURNAL);
 check(previous.event0.event==='TASK_STOP_INTENT'&&previous.event0.sequence===0&&previous.event1.event==='FAILED'&&previous.event1.target==='TASK_STOP'&&previous.event1.sequence===1);
 const originalIntent=previous.originalConsoleIntent,originalCut=previous.originalConsoleCut,completed=previous.originalConsoleCompleted,originalFailure=previous.originalConsoleFailure;
 const oldPids=roles.map(role=>oldBefore.identities[role].pid).sort((a,b)=>a-b);
 const intentHeader=row=>row.event==='PAUSED_OLD_CONSOLE_RECOVERY_INTENT'&&row.priorIntentSha256===refs.priorIntent.sha256&&row.priorFailureSha256===refs.priorFailure.sha256&&Array.isArray(row.oldPids)&&same([...row.oldPids].sort((a,b)=>a-b),oldPids)&&['consolePins','legacyConsolePins','probePins'].every(key=>Array.isArray(row[key]));
 for(const row of [originalIntent,originalCut,completed])check(row.profileSha256===refs.profile.sha256&&row.beforeSha256===refs.before.sha256&&row.engineSha256===PR54_REHEARSED_ENGINE_SHA);
 check(intentHeader(originalIntent)&&time(originalIntent.observedAt));
 check(originalCut.event==='PAUSED_OLD_CORE_CUT_OBSERVATION'&&identity(originalCut.core,oldBefore.identities.coreSupervisor)&&time(originalCut.observedAt)&&Date.parse(originalCut.observedAt)>=Date.parse(originalIntent.observedAt));
 check(completed.event==='PAUSED_OLD_CORE_CUT_COMPLETED'&&identity(completed.core,oldBefore.identities.coreSupervisor)&&completed.heldProcessHandle===true&&completed.processAbsent===true&&time(completed.windowOpenedAt)&&time(completed.cutCompletedAt)&&Date.parse(completed.windowOpenedAt)>=Date.parse(originalIntent.observedAt)&&Date.parse(originalCut.observedAt)>=Date.parse(completed.windowOpenedAt)&&Date.parse(completed.cutCompletedAt)>=Date.parse(originalCut.observedAt));
 check(exact(originalFailure,['exceptionType','sourceLine','code'])&&typeof originalFailure.exceptionType==='string'&&originalFailure.exceptionType.length>0&&Number.isSafeInteger(originalFailure.sourceLine)&&originalFailure.sourceLine>=0&&originalFailure.sourceLine<=10000&&originalFailure.code==='P03_PHYSICAL_PAUSED_REMAINING_IDENTITY');
 const result=bytesOf(raw.recoveryResult),candidate=bytesOf(raw.candidate),intent=bytesOf(raw.consoleIntent),cut=bytesOf(raw.consoleCut);
 for(const key of ['recoveryResult','candidate','consoleIntent','consoleCut'])check(same(raw[key].ref,refs[key]));
 check(exact(result,['status','engineSha256','candidateSha256','recoveryTailSha256','stableSeconds','newGenerationStarted','locksRetained'])&&result.status==='PAUSED_OLD_RESTORED_READY'&&result.engineSha256===PR54_REHEARSED_ENGINE_SHA&&result.candidateSha256===refs.candidate.sha256&&result.recoveryTailSha256===refs.recoveryTail.sha256&&Number.isFinite(result.stableSeconds)&&result.stableSeconds>=30&&result.newGenerationStarted===false&&result.locksRetained===true);
 check(candidate.schemaVersion==='melisa-p03-physical-candidate.v1'&&candidate.profileSha256===refs.profile.sha256&&candidate.beforeSha256===refs.before.sha256&&time(candidate.observedAt)&&Array.isArray(candidate.processes)&&candidate.processes.length===0&&Array.isArray(candidate.receipts)&&candidate.receipts.length===0);
 for(const row of [intent,cut])check(row.profileSha256===refs.profile.sha256&&row.beforeSha256===refs.before.sha256&&row.engineSha256===PR54_REHEARSED_ENGINE_SHA&&time(row.observedAt));
 check(intentHeader(intent)&&Date.parse(intent.observedAt)>=Date.parse(completed.cutCompletedAt));
 // The original cut predates the resumed attempt. Both reads refer to the
 // same immutable fixed file; IO pins its cd086... bytes before this function.
 check(same(cut,originalCut)&&Date.parse(intent.observedAt)>=Date.parse(cut.observedAt)&&Date.parse(candidate.observedAt)>=Date.parse(intent.observedAt));
 const expected=['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE','ROLLBACK_START_INTENT','ROLLBACK_STARTED','RESTORED_READY'];
 check(Array.isArray(raw.journal)&&raw.journal.length===expected.length);
 let previousSha=refs.before.sha256,previousTime=Date.parse(candidate.observedAt);const records=[];
 for(const [n,row]of raw.journal.entries()){
  check(ref(row.ref)&&row.ref.path===PR54_PREDECESSOR_JOURNAL+'\\event-'+String(n).padStart(4,'0')+'.json');
  const record=bytesOf(row);
  // These are the exact fields emitted by the unchanged fe engine Append().
  check(exact(record,['sequence','previousSha256','profileSha256','beforeSha256','event','observedAt'])&&record.sequence===n&&record.previousSha256===previousSha&&record.profileSha256===refs.profile.sha256&&record.beforeSha256===refs.before.sha256&&record.event===expected[n]&&time(record.observedAt)&&Date.parse(record.observedAt)>=previousTime);
  previousSha=row.ref.sha256;previousTime=Date.parse(record.observedAt);records.push(record);
 }
 check(same(raw.journal.at(-1).ref,refs.recoveryTail)&&previousSha===result.recoveryTailSha256&&Date.parse(records[6].observedAt)-Date.parse(records[4].observedAt)>=30000);
 return {oldProfile,oldBefore,restoredAt:records[6].observedAt,startedAt:records[4].observedAt};
}
export function admitPr54OwnerSuccessor({predecessorRef,previous,raw,profileRef,beforeRef,profile,before,current,now=Date.now()}){
 const refs=pr54OwnerSuccessorRefs(predecessorRef),{oldProfile,oldBefore,restoredAt,startedAt}=proveRecovery({refs,previous,raw});
 check(ref(profileRef)&&ref(beforeRef)&&before.runId!==PR54_PREDECESSOR_RUN&&/^[a-f0-9]{32}$/.test(before.runId));
 check(profileRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-profile-'+before.runId+'.json'&&beforeRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-before-'+before.runId+'.json'&&same(profile.beforeImage,beforeRef));
 check(profile.ownerSid===owner&&before.ownerSid===owner&&profile.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&before.database===profile.database&&before.actualT1===false&&before.copyId===oldBefore.copyId);
 check(profile.schemaVersion==='melisa-p03-physical-profile.v1'&&before.schemaVersion==='melisa-p03-owner-observation.v3'&&profile.oldSettings.sha256==='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96'&&profile.newSettings.sha256==='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071');
 check(same(profile.oldSettings,oldProfile.oldSettings)&&same(profile.newSettings,oldProfile.newSettings)&&same(before.profile,oldBefore.profile)&&same(before.plan,oldBefore.plan));
 // This immutable before-image anchors the full package preflight, which can
 // take several minutes. It is never timestamp-refreshed. Each claim inspection
 // independently reauthenticates the full current owner within sixty seconds.
 check(time(before.observedAt)&&Number.isFinite(now)&&now-Date.parse(before.observedAt)>=0&&now-Date.parse(before.observedAt)<15*60000&&Date.parse(before.observedAt)>=Date.parse(restoredAt));
 check(current&&time(current.observedAt)&&now-Date.parse(current.observedAt)>=0&&now-Date.parse(current.observedAt)<60000&&Date.parse(current.observedAt)>=Date.parse(before.observedAt));
 const protectedRows=rows=>JSON.stringify([...rows].sort((a,b)=>a.pid-b.pid));
 check(Array.isArray(profile.protectedProcesses)&&protectedRows(profile.protectedProcesses)===protectedRows(oldProfile.protectedProcesses)&&profile.protectedProcesses.some(p=>p.kind==='ProtectedSqlService'));
 // The observer intentionally omits unrelated protected OS/SQL processes.
 // Real IO must run guardProtected() (including master SQL identity) before
 // this pure proposal and again around the atomic claim; this is no OS proof.
 check(Array.isArray(current.processes)&&Array.isArray(current.bindings));
 check(profile.tasks.length===2&&current.tasks.length===2&&Array.isArray(current.runningInstances)&&current.runningInstances.length===2&&profile.oldWatchers.length===2);
 const oldPids=[...Object.values(oldBefore.identities),...oldProfile.oldWatchers].map(p=>p.pid),newPids=new Set();
 for(const role of roles){const row=before.identities[role];check(row&&row.ownerSid===owner&&Number.isSafeInteger(row.pid)&&row.pid>0&&!newPids.has(row.pid)&&!oldPids.includes(row.pid)&&time(row.creationTime)&&Date.parse(row.creationTime)>=Date.parse(startedAt)&&identity(current.processes.find(p=>p.pid===row.pid),row));newPids.add(row.pid);}
 for(const [n,name]of tasks.entries()){
  const task=profile.tasks.find(t=>t.name===name),oldTask=oldProfile.tasks.find(t=>t.name===name),actual=current.tasks.find(t=>t.name===name),watcher=profile.oldWatchers.find(p=>p.role===(n===0?'terminalWatcher':'hubWatcher'));
  check(task&&oldTask&&task.oldXmlSha256===oldTask.oldXmlSha256&&task.newXmlSha256===oldTask.newXmlSha256&&actual?.state===4&&hash(Buffer.from(actual.xml))===task.oldXmlSha256&&watcher&&watcher.ownerSid===owner&&!oldPids.includes(watcher.pid)&&!newPids.has(watcher.pid)&&time(watcher.creationTime)&&Date.parse(watcher.creationTime)>=Date.parse(startedAt)&&identity(current.processes.find(p=>p.pid===watcher.pid),watcher));
  const instances=current.runningInstances.filter(p=>p.name===name);check(instances.length===1&&instances[0].state===4&&instances[0].path==='\\'+name&&instances[0].enginePid===watcher.pid&&typeof instances[0].instanceGuid==='string'&&instances[0].instanceGuid.length>0);newPids.add(watcher.pid);
 }
 check(!current.processes.some(p=>oldPids.includes(p.pid))&&newPids.size===10);
 const expectedBindings=roles.flatMap(role=>(before.identities[role].bindings??[]).map(b=>({...b,pid:before.identities[role].pid})));
 const bindings=rows=>JSON.stringify(rows.map(b=>[b.port,b.address,b.pid]).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1])||a[2]-b[2]));
 check(bindings(current.bindings)===bindings(expectedBindings));
 const claim={schemaVersion:'melisa-p03-owner-successor-claim.v1',predecessorRunId:PR54_PREDECESSOR_RUN,predecessorLock:refs.globalLock,predecessorProfile:refs.profile,predecessorBefore:refs.before,recoveryResult:refs.recoveryResult,recoveryTail:refs.recoveryTail,engineSha256:PR54_REHEARSED_ENGINE_SHA,stopOrderDigest:p03CoreFirstStopDigest(before.plan),successorRunId:before.runId,successorProfile:profileRef,successorBefore:beforeRef,newSettings:profile.newSettings};
 return {claimPath:PR54_SUCCESSOR_CLAIM_PATH,claim,refs,proofDigest:hash(Buffer.from(JSON.stringify(raw.journal.map(row=>row.ref))))};
}
// The injected writer must be the protected atomic CreateNew writer. A failed
// readback consumes this predecessor too; this adapter never removes a claim.
export async function claimPr54OwnerSuccessor({inspect,createNew,readClaim}){
 check([inspect,createNew,readClaim].every(fn=>typeof fn==='function'));
 const first=await inspect();check(first?.claimPath===PR54_SUCCESSOR_CLAIM_PATH&&sha(first.proofDigest));
 const bytes=Buffer.from(JSON.stringify(first.claim,null,2)+'\n'),ref={path:first.claimPath,sha256:hash(bytes)};
 const created=await createNew({ref,bytes});check(created?.created===true&&same(created.ref,ref));
 const second=await inspect();check(same(first,second));
 const actual=await readClaim(ref);check(actual instanceof Uint8Array&&hash(actual)===ref.sha256&&Buffer.from(actual).equals(bytes));
 return Object.freeze(ref);
}
