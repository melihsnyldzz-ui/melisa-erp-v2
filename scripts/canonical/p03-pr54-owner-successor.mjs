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
 resumeIntent:fixed('paused-old-console-resume-intent.json','1a1df3dd63acb1b77834b61df9a17b71b04fb44c942ec092ac35c8ffc9f89bbd'),
 resumeFailure:fixed('paused-old-console-resume-failed.json','ad72bbabfe2a69033ad4ea3772fc2c0a9288989b24e5fba9ac673db82f8fadb0'),
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
 check(predecessorRef.recoveryResult.path===PR54_PREDECESSOR_TRANSITION+'\\late-old-owner-observed-ready.json');
 check(same(predecessorRef.consoleIntent,PR54_PREDECESSOR_REFS.resumeIntent));
 check(predecessorRef.consoleCut.path===PR54_PREDECESSOR_TRANSITION+'\\paused-old-console-core-cut-observation.json');
 check(/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-candidate-[a-f0-9]{32}\.json$/.test(predecessorRef.candidate.path));
 check(predecessorRef.recoveryTail.path===PR54_PREDECESSOR_JOURNAL+'\\event-0007.json'&&predecessorRef.recoveryTail.sha256==='6f7f5b31e418f0d98499b77b85120239efee7ae54cfb10c7b6a6d3fc8e9c07a3');
 return {...PR54_PREDECESSOR_REFS,...predecessorRef};
}
function proveRecovery({refs,previous,raw}){
 check(exact(previous,['globalLock','transitionLock','profile','before','event0','event1','priorIntent','priorFailure','originalConsoleIntent','originalConsoleCut','originalConsoleCompleted','originalConsoleFailure','resumeIntent','resumeFailure']));
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
 check(same(intent,previous.resumeIntent));
 for(const key of ['recoveryResult','candidate','consoleIntent','consoleCut'])check(same(raw[key].ref,refs[key]));
 check(exact(result,['status','profileSha256','beforeSha256','engineSha256','candidateSha256','recoveryTailSha256','startedAt','observedAt','stableSeconds','identityDigest','engineOutcome','newGenerationStarted','mutationExecuted','locksRetained'])&&result.status==='LATE_OLD_OWNER_OBSERVED_READY'&&result.profileSha256===refs.profile.sha256&&result.beforeSha256===refs.before.sha256&&result.engineSha256===PR54_REHEARSED_ENGINE_SHA&&result.candidateSha256===refs.candidate.sha256&&result.recoveryTailSha256===refs.recoveryTail.sha256&&Number.isFinite(result.stableSeconds)&&result.stableSeconds>=30&&sha(result.identityDigest)&&time(result.startedAt)&&time(result.observedAt)&&result.engineOutcome==='ROLLBACK_READBACK_FAILED'&&result.newGenerationStarted===false&&result.mutationExecuted===false&&result.locksRetained===true);
 check(candidate.schemaVersion==='melisa-p03-physical-candidate.v1'&&candidate.profileSha256===refs.profile.sha256&&candidate.beforeSha256===refs.before.sha256&&time(candidate.observedAt)&&Array.isArray(candidate.processes)&&candidate.processes.length===0&&Array.isArray(candidate.receipts)&&candidate.receipts.length===0);
 for(const row of [intent,cut])check(row.profileSha256===refs.profile.sha256&&row.beforeSha256===refs.before.sha256&&row.engineSha256===PR54_REHEARSED_ENGINE_SHA&&time(row.observedAt));
 check(intentHeader(intent)&&Date.parse(intent.observedAt)>=Date.parse(completed.cutCompletedAt));
 // The original cut predates the resumed attempt. Both reads refer to the
 // same immutable fixed file; IO pins its cd086... bytes before this function.
 check(same(cut,originalCut)&&Date.parse(intent.observedAt)>=Date.parse(cut.observedAt)&&Date.parse(candidate.observedAt)>=Date.parse(intent.observedAt));
 const expected=['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE','ROLLBACK_START_INTENT','ROLLBACK_STARTED','ROLLBACK_FAILED','QUARANTINED'];
 check(Array.isArray(raw.journal)&&raw.journal.length===expected.length);
 let previousSha=refs.before.sha256,previousTime=Date.parse(candidate.observedAt);const records=[];
 for(const [n,row]of raw.journal.entries()){
  check(ref(row.ref)&&row.ref.path===PR54_PREDECESSOR_JOURNAL+'\\event-'+String(n).padStart(4,'0')+'.json');
  const record=bytesOf(row);
  // These are the exact fields emitted by the unchanged fe engine Append().
  check(exact(record,['sequence','previousSha256','profileSha256','beforeSha256','event','observedAt',...(n===6?['failure']:[])])&&record.sequence===n&&record.previousSha256===previousSha&&record.profileSha256===refs.profile.sha256&&record.beforeSha256===refs.before.sha256&&record.event===expected[n]&&time(record.observedAt)&&Date.parse(record.observedAt)>=previousTime);
  if(n===6)check(exact(record.failure,['exceptionType','sourceLine','code'])&&record.failure.exceptionType==='System.Management.Automation.RuntimeException'&&record.failure.sourceLine===29&&record.failure.code==='P03_PHYSICAL_ROLLBACK_READBACK_FAILED'&&same(record.failure,previous.resumeFailure));
  previousSha=row.ref.sha256;previousTime=Date.parse(record.observedAt);records.push(record);
 }
 check(same(raw.journal.at(-1).ref,refs.recoveryTail)&&previousSha===result.recoveryTailSha256&&result.startedAt===records[4].observedAt&&Date.parse(result.observedAt)-Date.parse(records[7].observedAt)>=30000);
 // The frozen engine remains failed/quarantined. Only this separately pinned,
 // read-only observation proves the OLD owner subsequently became stable.
 return {oldProfile,oldBefore,restoredAt:result.observedAt,startedAt:records[4].observedAt};
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

// Additive current-owner proposal. The failed 7b controller and its 26 records
// remain immutable; separate read-only NEW_READY evidence does not rewrite it.
export const PR54_CURRENT_PREDECESSOR_RUN='7b0821959737f1da0427b17a7dfd4685';
export const PR54_CURRENT_SUCCESSOR_CLAIM_PATH=PR54_OWNER_ROOT+'\\p03-pr54-successor-of-'+PR54_CURRENT_PREDECESSOR_RUN+'.lock.json';
export const PR54_CURRENT_REFS=Object.freeze(Object.fromEntries(Object.entries({"profile":{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-profile-7b0821959737f1da0427b17a7dfd4685.json","sha256":"cf176e37c795f6de01353f04f4f1747499aab5f695d79519c2ecf3233b80967a"},"before":{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-7b0821959737f1da0427b17a7dfd4685.json","sha256":"b89366ce31aa8254e8ad7c0ef2c342520b427e0dbbbf37263a68001d92ab2443"},"transitionLock":{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\transition.lock","sha256":"a0622af3cca2076c56c38c7ca030124e7c264980ea5657e8d0efaf08a4832e05"},"ancestorClaim":{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\p03-pr54-successor-of-639e2da815e1e7ac0f1c0d04d7f7bdc3.lock.json","sha256":"23c5369ebd2657961566ded8f0417713be0ba4e2a4b3843e1d7899eda6049203"},"controller":{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\controller-outcome.json","sha256":"7e47bd7fa12baf349783b229a6aa80c48dcb9e7231063c0c76a7c18aca3b9fe2"},"ready":{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\late-new-owner-final.json","sha256":"37d19530131f006d8332827f673d7e35284f891b081875653df6b60383be1f5d"},"candidate":{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-candidate-e2e7d8011a1cd4236dab9f959acd94a4.json","sha256":"143ca5b5242a702e846e421d8210afa254cc8d30a85961f41c152762b415f1ef"}}).map(([key,value])=>[key,Object.freeze(value)])));
export const PR54_CURRENT_JOURNAL_REFS=Object.freeze([{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0000.json","sha256":"991f6f661069e72d5eb2e65d1da4f2d89929b56077c0baebe01a87dda3418839"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0001.json","sha256":"616939fde13980c9c04c5a39719716d90effa0715b7dbf9a4ac8ef21b2f11967"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0002.json","sha256":"aafe1f93fb57c188ea8e686b563a931db924b791bef279321bfda987da9e87a0"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0003.json","sha256":"1f0923d6c1a723f85227bf9210d5328605e74567019823f5a82fb49639d783f6"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0004.json","sha256":"638a963206354ad9d4f5423830a0ba41ad016f83519e2617b2449af58f205d95"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0005.json","sha256":"8ef524eb73cdafe9727889a563dccdf3efd7f5debd009149260b7fcd7bc7f642"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0006.json","sha256":"2b6d7565c1920cab700d5b60a2df44968ebdd576da02ed230c0cdf2323d77065"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0007.json","sha256":"92ac9b0083577b2d9915bc29173ad650c6e78b13c27f6fa40c2024f744edaf5e"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0008.json","sha256":"c4c87ff42d035f57d9e7bdeb5c30d80b7dc7587b939dc7d150d9c95c0d996a9b"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0009.json","sha256":"14e6cfe5771ba532ee895466f11aefd5baafd43c4b3995cb73446080095aabd8"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0010.json","sha256":"4977be119d7074e09107408ef0efeacd5206e408e5e05a92aebf1659d55052c6"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0011.json","sha256":"b0bac53db4be0c0c6278d81a2e7d5d0d0b3870dc1503277497faaf909f9a9ec7"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0012.json","sha256":"15e5327413b53d3f65aadbd26e9635fb9fd97261842ce70aaa7dd864bb1a523a"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0013.json","sha256":"248fb48a73d230fdd9ad2aa2fc8b2b81c59a214039f30c2564a173707f4ba783"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0014.json","sha256":"17c2569ac9733cad69c54875c44b192403609a10fc2e076b7100cbff554b8a1a"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0015.json","sha256":"94b194b7d2d446de688e559a2ab386ef96dd32ef66fe8047db8d23357136b37e"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0016.json","sha256":"344113bc27cc583d6796a7a33e0bd06f769aa75faee962f704ba3d7950e2769f"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0017.json","sha256":"bab5a627ec74e2f43c7647093f5ffcf6302267dc917bb9616f6debf9afe26012"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0018.json","sha256":"210ee83ebf78844c89fd6d8cf516f508562ba630455c1ebdd459b57d01f5bf24"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0019.json","sha256":"b1c5724129b112c833663b490b507e531be51a0be394b20e7e3c382b83cb833d"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0020.json","sha256":"93b7903b427eca78bf020a24fa577660133d909d47b377c5df17fbbedc54800e"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0021.json","sha256":"460069d9b9ffbe86c0c3e5139a4a48d07734d09280d2193a19ddd82ce3ba23a2"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0022.json","sha256":"5796cd27268e564aab33f2d15356d599f260f2aec0746643900eb1e8d52457d1"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0023.json","sha256":"0d25ac95600646bb387fb03750fe2ab0607662e7c601eea991bfdb9dfdf585ad"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0024.json","sha256":"c9baea46d2844835cca10a49c07204916e47ef4876e7a5f5062c2e9b5666eb7c"},{"path":"C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-7b0821959737f1da0427b17a7dfd4685\\event-0025.json","sha256":"bd455b43c46e124ae46699f7f32bcd8bab02f67bfc146d040951f66c1a5a0760"}].map(Object.freeze));
const currentOldProfile=Object.freeze({erpSource:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',erpManifest:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7',crmSource:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',crmManifest:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83',supervisorSource:'13bdf75a032ae8f694354a2e57b6ed382aec2f17',supervisorManifest:'195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'});
function provePr54CurrentHistory(raw){
 check(exact(raw,[...Object.keys(PR54_CURRENT_REFS),'journal']));
 const decoded={};for(const [key,pin]of Object.entries(PR54_CURRENT_REFS)){check(same(raw[key]?.ref,pin));decoded[key]=bytesOf(raw[key]);}
 const {profile,before,transitionLock,ancestorClaim,controller,ready,candidate}=decoded;
 check(before.runId===PR54_CURRENT_PREDECESSOR_RUN&&same(before.profile,currentOldProfile)&&before.actualT1===false&&before.copyId==='e16b70f0-4057-428b-9abc-6bbcaf35fe82'&&before.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02');
 check(same(profile.beforeImage,PR54_CURRENT_REFS.before)&&same(transitionLock.profileRef,PR54_CURRENT_REFS.profile)&&same(transitionLock.beforeRef,PR54_CURRENT_REFS.before)&&same(transitionLock.successorClaimRef,PR54_CURRENT_REFS.ancestorClaim));
 check(ancestorClaim.predecessorRunId===PR54_PREDECESSOR_RUN&&ancestorClaim.successorRunId===PR54_CURRENT_PREDECESSOR_RUN&&same(ancestorClaim.successorProfile,PR54_CURRENT_REFS.profile)&&same(ancestorClaim.successorBefore,PR54_CURRENT_REFS.before)&&same(ancestorClaim.newSettings,profile.newSettings));
 check(controller.status==='QUARANTINED_REQUIRES_ROOT_INSPECTION'&&controller.failedPhase==='READBACK'&&controller.recoveryReason==='P03_PHYSICAL_ACL'&&controller.runId===PR54_CURRENT_PREDECESSOR_RUN&&controller.controllerSessionCompleted===true&&controller.originalJournalRetained===true&&controller.successorClaimRetained===true&&controller.recoveryIntentCreated===false&&controller.postCaptureStarted===false);
 check(Array.isArray(raw.journal)&&raw.journal.length===26);
 let previousSha=PR54_CURRENT_REFS.before.sha256;
 const stopRoles=['coreSupervisor',...roles.filter(role=>role!=='coreSupervisor')],events=[['TASK_STOP_INTENT'],['TASKS_STOPPED'],...stopRoles.flatMap(role=>[['EXACT_STOP_INTENT',role],['EXACT_STOPPED',role]]),['PORTS_CLEAR'],...tasks.flatMap(name=>[['ACTION_INTENT',name],['ACTION_SET',name]]),['START_INTENT'],['STARTED'],['FAILED','READBACK']];
 for(const [n,row]of raw.journal.entries()){
  check(same(row.ref,PR54_CURRENT_JOURNAL_REFS[n]));const value=bytesOf(row),[event,target]=events[n];
  check(exact(value,['sequence','digest','event','stopOrderDigest','previousSha256','profileSha256','beforeSha256',...(target?['target']:[])])&&value.sequence===n&&value.event===event&&value.target===target&&value.previousSha256===previousSha&&value.profileSha256===PR54_CURRENT_REFS.profile.sha256&&value.beforeSha256===PR54_CURRENT_REFS.before.sha256&&value.digest===before.plan.digest&&value.stopOrderDigest===p03CoreFirstStopDigest(before.plan));previousSha=row.ref.sha256;
 }
 const proof=ready.proof;
 check(exact(ready,['candidateRef','observerRef','proof'])&&same(ready.candidateRef,PR54_CURRENT_REFS.candidate)&&proof.status==='NEW_OWNER_OBSERVED_READY'&&proof.profileSha256===PR54_CURRENT_REFS.profile.sha256&&proof.beforeSha256===PR54_CURRENT_REFS.before.sha256&&proof.candidateSha256===PR54_CURRENT_REFS.candidate.sha256&&proof.engineSha256===PR54_REHEARSED_ENGINE_SHA&&proof.sourceProof.supervisorSourceCommit===currentOldProfile.supervisorSource&&proof.sourceProof.supervisorManifestSha256===currentOldProfile.supervisorManifest&&proof.mutationExecuted===false&&proof.stableSeconds>=30&&time(proof.observedAt)&&time(candidate.observedAt)&&Date.parse(proof.observedAt)>=Date.parse(candidate.observedAt)&&candidate.profileSha256===PR54_CURRENT_REFS.profile.sha256&&candidate.beforeSha256===PR54_CURRENT_REFS.before.sha256&&candidate.processes.length===10);
 return {...decoded,readyAt:proof.observedAt};
}
// Candidate supervisor source/manifest and newly generated settings are explicit
// required pins. No fallback to the old supervisor, generic source or registry.
export function assertPr54CurrentSuccessorCandidate(candidate){
 check(exact(candidate,['erpSource','erpManifest','crmSource','crmManifest','supervisorSource','supervisorManifest','supervisorRoot','newSettings']));
 check(candidate.erpSource==='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'&&candidate.erpManifest==='8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'&&candidate.crmSource===currentOldProfile.crmSource&&candidate.crmManifest===currentOldProfile.crmManifest&&/^[a-f0-9]{40}$/.test(candidate.supervisorSource)&&candidate.supervisorSource!==currentOldProfile.supervisorSource&&sha(candidate.supervisorManifest)&&candidate.supervisorManifest!==currentOldProfile.supervisorManifest&&ref(candidate.newSettings)&&candidate.newSettings.sha256!=='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071');
 check(candidate.newSettings.path==='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'&&typeof candidate.supervisorRoot==='string'&&/^C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-[a-f0-9]{12}$/.test(candidate.supervisorRoot)&&candidate.supervisorRoot.endsWith(candidate.supervisorSource.slice(0,12)));
 return Object.freeze({...candidate,newSettings:Object.freeze({...candidate.newSettings})});
}
// IO must independently authenticate ACL/no-reparse files, source manifests,
// protected SQL/OS identities and full health before/after atomic CreateNew.
// These bytes are an admission proposal, never OS proof or permission to replay.
const currentContinuities=new WeakMap();
export function preparePr54CurrentNativeContinuity(snapshotRef,snapshot,observation,backup,now=Date.now()){
 check(exact(snapshotRef,['path','sha256'])&&ref(snapshotRef)&&/^C:\\Sirket\\ERP\\backups\\P03-20261019-\d{6}\\source-pre-snapshot\.json$/.test(snapshotRef.path));
 check(snapshot?.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&typeof snapshot.logEndBefore==='string'&&/^[0-9A-Fa-f]{8}:[0-9A-Fa-f]{8}:[0-9A-Fa-f]{4}$/.test(snapshot.logEndBefore)&&snapshot.logEndBefore===snapshot.logEndAfter);
 const guid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
 check(guid(backup?.backupSetGuid));
 check(exact(observation,['server','database','copyId','observedAt','actualT1','readOnly','sealed','logEnd','queryStoreMode','snapshotRef','backupSetGuid','databaseGuid','recoveryForkGuid','backupDatabaseGuid','backupFirstRecoveryForkGuid','backupLastRecoveryForkGuid'])&&observation.server==='Semih\\MELISADEV'&&observation.database===snapshot.database&&observation.copyId==='e16b70f0-4057-428b-9abc-6bbcaf35fe82'&&observation.actualT1===false&&observation.readOnly===true&&observation.sealed===true&&observation.queryStoreMode==='READ_ONLY'&&['backupSetGuid','databaseGuid','recoveryForkGuid','backupDatabaseGuid','backupFirstRecoveryForkGuid','backupLastRecoveryForkGuid'].every(k=>guid(observation[k]))&&observation.backupSetGuid.toLowerCase()===backup.backupSetGuid.toLowerCase()&&observation.databaseGuid.toLowerCase()===observation.backupDatabaseGuid.toLowerCase()&&observation.recoveryForkGuid.toLowerCase()===observation.backupFirstRecoveryForkGuid.toLowerCase()&&observation.recoveryForkGuid.toLowerCase()===observation.backupLastRecoveryForkGuid.toLowerCase()&&observation.logEnd===snapshot.logEndAfter&&same(observation.snapshotRef,snapshotRef)&&time(observation.observedAt)&&Number.isFinite(now)&&now-Date.parse(observation.observedAt)>=0&&now-Date.parse(observation.observedAt)<60000);
 const token=Object.freeze({});currentContinuities.set(token,{snapshotRef:Object.freeze({...snapshotRef}),observedAt:observation.observedAt});return token;
}
export function isPr54CurrentNativeContinuity(token,snapshotRef,now=Date.now()){
 const proof=currentContinuities.get(token);return Boolean(proof&&same(proof.snapshotRef,snapshotRef)&&Number.isFinite(now)&&now-Date.parse(proof.observedAt)>=0&&now-Date.parse(proof.observedAt)<60000);
}
export function admitPr54CurrentOwnerSuccessor({raw,profileRef,beforeRef,profileBytes,beforeBytes,profile,before,current,candidate,now=Date.now(),nativeContinuity=null}){
 candidate=assertPr54CurrentSuccessorCandidate(candidate);
 const history=provePr54CurrentHistory(raw),old=history.profile;
 check(ref(profileRef)&&ref(beforeRef)&&same(bytesOf({ref:profileRef,bytes:profileBytes}),profile)&&same(bytesOf({ref:beforeRef,bytes:beforeBytes}),before));
 check(/^[a-f0-9]{32}$/.test(before.runId)&&![PR54_PREDECESSOR_RUN,PR54_CURRENT_PREDECESSOR_RUN].includes(before.runId)&&profileRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-profile-'+before.runId+'.json'&&beforeRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-before-'+before.runId+'.json'&&same(profile.beforeImage,beforeRef));
 check(profile.schemaVersion==='melisa-p03-physical-profile.v1'&&before.schemaVersion==='melisa-p03-owner-observation.v3'&&profile.ownerSid===owner&&before.ownerSid===owner&&profile.database===history.before.database&&before.database===profile.database&&before.actualT1===false&&before.copyId===history.before.copyId);
 check(same(profile.oldSettings,old.newSettings)&&same(before.oldConfig,old.newSettings)&&same(profile.newSettings,candidate.newSettings)&&same(before.newConfig,candidate.newSettings)&&before.plan.oldSettingsSha256===old.newSettings.sha256&&before.plan.newSettingsSha256===candidate.newSettings.sha256);
 const target=Object.fromEntries(Object.keys(currentOldProfile).map(key=>[key,candidate[key]]));check(same(before.profile,target));p03CoreFirstStopDigest(before.plan);
 // The frozen engine checks the OLD/NEW settings union, not all historical packages.
 // The hash-bound old profile still preserves all eight ancestor package descriptors.
 const currentRoots=[
  ['C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae',currentOldProfile.erpSource],
  ['C:\\Sirket\\ERP\\releases\\CRM-ORDER-DRAFT-TEST-20261013-7a41f64','7a41f6492273dd1ec0bcb086f820be5575372be8'],
  ['C:\\Sirket\\CRM\\releases\\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',currentOldProfile.crmSource],
  ['C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a',currentOldProfile.supervisorSource]
 ];
 const currentPackages=currentRoots.map(([root,sourceCommit])=>{const matches=old.packages.filter(p=>p.root===root&&p.sourceCommit===sourceCommit);check(matches.length===1);return matches[0];});
 check(Array.isArray(profile.packages)&&profile.packages.length===6&&new Set(profile.packages.map(p=>p.root)).size===6&&currentPackages.every(pin=>profile.packages.some(p=>same(p,pin))));
 const additions=profile.packages.filter(p=>!currentPackages.some(pin=>same(p,pin)));
 check(additions.length===2&&additions.every(p=>exact(p,['root','sourceCommit','manifestPath','manifestSha256'])&&ref({path:p.root,sha256:p.manifestSha256})&&p.manifestPath===p.root+'\\release-manifest.json'));
 check(additions.some(p=>p.root==='C:\\Sirket\\ERP\\releases\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a'&&p.sourceCommit===candidate.erpSource&&p.manifestSha256===candidate.erpManifest)&&additions.some(p=>p.root===candidate.supervisorRoot&&p.sourceCommit===candidate.supervisorSource&&p.manifestSha256===candidate.supervisorManifest));
 check(Number.isFinite(now)&&time(before.observedAt)&&now-Date.parse(before.observedAt)>=0&&now-Date.parse(before.observedAt)<15*60000&&Date.parse(before.observedAt)>=Date.parse(history.readyAt)&&time(current?.observedAt)&&now-Date.parse(current.observedAt)>=0&&now-Date.parse(current.observedAt)<60000&&Date.parse(current.observedAt)>=Date.parse(before.observedAt));
 check(Array.isArray(profile.protectedProcesses)&&same(profile.protectedProcesses,old.protectedProcesses)&&profile.protectedProcesses.some(p=>p.kind==='ProtectedSqlService'));
 check(Array.isArray(current.processes)&&Array.isArray(current.bindings)&&current.tasks.length===2&&current.runningInstances.length===2&&profile.tasks.length===2&&profile.oldWatchers.length===2);
 const known=history.candidate.processes,owned=[...roles.map(role=>({...before.identities[role],role})),...profile.oldWatchers];check(new Set(owned.map(p=>p.pid)).size===10&&new Set(current.processes.map(p=>p.pid)).size===current.processes.length);
 for(const p of owned){const prior=known.find(x=>x.role===p.role);check(prior&&p.ownerSid===owner&&Number.isSafeInteger(p.pid)&&p.pid>0&&p.nodePath===prior.nodePath&&p.commandLine===prior.commandLine&&time(p.creationTime)&&identity(p,current.processes.find(x=>x.pid===p.pid)));if(p.pid===prior.pid)check(identity(p,prior));else check(!known.some(x=>x.pid===p.pid)&&birth(p.creationTime)>birth(prior.creationTime)&&Date.parse(p.creationTime)<=Date.parse(before.observedAt));const priorParent=known.find(x=>x.pid===prior.parentPid);if(priorParent)check(p.parentPid===owned.find(x=>x.role===priorParent.role)?.pid);}
 check(current.processes.every(p=>owned.some(x=>identity(p,x))||profile.protectedProcesses.some(x=>identity(p,x))));
 for(const [n,name]of tasks.entries()){const t=profile.tasks.find(t=>t.name===name),previous=old.tasks.find(t=>t.name===name),actual=current.tasks.find(t=>t.name===name),watcher=owned.find(p=>p.role===(n?'hubWatcher':'terminalWatcher'));check(t&&t.oldXml===previous.newXml&&t.oldXmlSha256===previous.newXmlSha256&&hash(Buffer.from(t.oldXml))===t.oldXmlSha256&&typeof t.newXml==='string'&&hash(Buffer.from(t.newXml))===t.newXmlSha256&&t.newXml===t.oldXml.replaceAll('C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a',candidate.supervisorRoot).replaceAll(old.newSettings.path,candidate.newSettings.path).replaceAll(old.newSettings.sha256,candidate.newSettings.sha256)&&t.newXml!==t.oldXml&&actual?.state===4&&actual.xml===t.oldXml);const instances=current.runningInstances.filter(p=>p.name===name);check(instances.length===1&&instances[0].state===4&&instances[0].path==='\\'+name&&instances[0].enginePid===watcher.pid&&typeof instances[0].instanceGuid==='string'&&instances[0].instanceGuid.length>0);}
 const bindings=rows=>JSON.stringify(rows.map(b=>[b.port,b.address,b.pid]).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1])||a[2]-b[2]));check(bindings(current.bindings)===bindings(roles.flatMap(role=>(before.identities[role].bindings??[]).map(b=>({...b,pid:before.identities[role].pid})))));
 const claim={schemaVersion:'melisa-p03-current-owner-successor-claim.v1',predecessorRunId:PR54_CURRENT_PREDECESSOR_RUN,ancestorClaim:PR54_CURRENT_REFS.ancestorClaim,predecessorLock:PR54_CURRENT_REFS.transitionLock,predecessorProfile:PR54_CURRENT_REFS.profile,predecessorBefore:PR54_CURRENT_REFS.before,quarantinedController:PR54_CURRENT_REFS.controller,failedJournalTail:PR54_CURRENT_JOURNAL_REFS.at(-1),readOnlyNewReady:PR54_CURRENT_REFS.ready,successorRunId:before.runId,successorProfile:profileRef,successorBefore:beforeRef,newSettings:profile.newSettings,candidate,stopOrderDigest:p03CoreFirstStopDigest(before.plan)};
 const bytes=Buffer.from(JSON.stringify(claim,null,2)+'\n');return {claimPath:PR54_CURRENT_SUCCESSOR_CLAIM_PATH,claim,proposedCreateNew:{ref:{path:PR54_CURRENT_SUCCESSOR_CLAIM_PATH,sha256:hash(bytes)},bytes},proofDigest:hash(Buffer.from(JSON.stringify([...Object.values(PR54_CURRENT_REFS),...PR54_CURRENT_JOURNAL_REFS])))};
}
