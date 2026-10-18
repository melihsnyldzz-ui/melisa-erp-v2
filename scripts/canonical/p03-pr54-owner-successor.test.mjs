import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {p03TransitionDigest,p03CoreFirstStopDigest} from './p03-integrated-owner-transition.mjs';
import {admitPr54OwnerSuccessor,claimPr54OwnerSuccessor,pr54OwnerSuccessorRefs,PR54_OWNER_ROOT,PR54_PREDECESSOR_RUN,PR54_PREDECESSOR_TRANSITION,PR54_PREDECESSOR_JOURNAL,PR54_PREDECESSOR_REFS,PR54_SUCCESSOR_CLAIM_PATH,PR54_REHEARSED_ENGINE_SHA} from './p03-pr54-owner-successor.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const encoded=value=>Buffer.from(JSON.stringify(value));
const tasks=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'],roles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const owner='S-1-5-21-2170750028-1005938530-2568122015-1001';
const row=(path,value)=>{const bytes=encoded(value);return {ref:{path,sha256:hash(bytes)},bytes};};
const decoded=row=>JSON.parse(Buffer.from(row.bytes));
function changeRaw(f,key,change){const value=decoded(f.raw[key]);change(value);f.raw[key]=row(f.raw[key].ref.path,value);f.predecessorRef[key]=f.raw[key].ref;}
export function ownerSuccessorFixture(){
 const id='a'.repeat(32),startedAt='2026-10-18T15:46:44.2767695Z',restoredAt='2026-10-18T15:52:16.0000000Z';
 const identity=(pid,creationTime)=>({pid,parentPid:5000,nodePath:'C:\\pinned\\node.exe',ownerSid:owner,commandLine:'node exact role-'+pid,creationTime,bindings:[]});
 const oldBefore={schemaVersion:'melisa-p03-owner-observation.v3',runId:PR54_PREDECESSOR_RUN,ownerSid:owner,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',actualT1:false,observedAt:'2026-10-18T14:00:00.000Z',identities:Object.fromEntries(roles.map((role,n)=>[role,identity([23272,15416,10344,32112,30080,31604,48100,49908][n],'2026-10-18T13:00:00.0000000Z')])),profile:{erpSource:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',erpManifest:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7',crmSource:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',supervisorSource:'13bdf75a032ae8f694354a2e57b6ed382aec2f17'},plan:{digest:'1'.repeat(64)}};
 const oldProfile={schemaVersion:'melisa-p03-physical-profile.v1',ownerSid:owner,database:oldBefore.database,beforeImage:PR54_PREDECESSOR_REFS.before,journalDirectory:PR54_PREDECESSOR_JOURNAL,oldSettings:{path:'C:\\old\\settings.json',sha256:'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96'},newSettings:{path:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json',sha256:'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'},tasks:tasks.map(name=>({name,oldXml:'old '+name,oldXmlSha256:hash('old '+name),newXml:'new '+name,newXmlSha256:hash('new '+name)})),oldWatchers:[identity(20,'2026-10-18T13:00:00.0000000Z'),identity(21,'2026-10-18T13:00:00.0000000Z')],protectedProcesses:[{...identity(900,'2026-10-18T12:00:00.0000000Z'),kind:'ProtectedSqlService',service:{pathName:'SQL fixed',startName:'SQL fixed'}}]};
 oldBefore.plan={targets:roles,oldSettingsSha256:oldProfile.oldSettings.sha256,newSettingsSha256:oldProfile.newSettings.sha256};oldBefore.plan.digest=p03TransitionDigest(oldBefore.plan);
 const previous={globalLock:{profileRef:PR54_PREDECESSOR_REFS.profile,beforeRef:PR54_PREDECESSOR_REFS.before,transitionDirectory:PR54_PREDECESSOR_TRANSITION},transitionLock:{profileRef:PR54_PREDECESSOR_REFS.profile,beforeRef:PR54_PREDECESSOR_REFS.before},profile:oldProfile,before:oldBefore,event0:{sequence:0,event:'TASK_STOP_INTENT'},event1:{sequence:1,event:'FAILED',target:'TASK_STOP'},priorIntent:{},priorFailure:{}};
 const candidate=row(PR54_OWNER_ROOT+'\\MelisaERP-P03-candidate-'+'b'.repeat(32)+'.json',{schemaVersion:'melisa-p03-physical-candidate.v1',profileSha256:PR54_PREDECESSOR_REFS.profile.sha256,beforeSha256:PR54_PREDECESSOR_REFS.before.sha256,observedAt:'2026-10-18T15:43:40.0000000Z',processes:[],receipts:[]});
 const consoleIntent=row(PR54_PREDECESSOR_TRANSITION+'\\paused-old-console-resume-intent.json',{event:'PAUSED_OLD_CONSOLE_RECOVERY_INTENT',priorIntentSha256:PR54_PREDECESSOR_REFS.priorIntent.sha256,priorFailureSha256:PR54_PREDECESSOR_REFS.priorFailure.sha256,profileSha256:PR54_PREDECESSOR_REFS.profile.sha256,beforeSha256:PR54_PREDECESSOR_REFS.before.sha256,engineSha256:PR54_REHEARSED_ENGINE_SHA,observedAt:'2026-10-18T15:37:40.5614186Z',oldPids:[49908,23272,15416,10344,32112,30080,31604,48100],consolePins:[{pid:22128,parentPid:23272,nodePath:'C:\\Windows\\System32\\conhost.exe',ownerSid:owner,commandLine:'\\??\\C:\\WINDOWS\\system32\\conhost.exe 0x4',creationTime:'2026-10-16T22:59:02.0737370Z'}],legacyConsolePins:[{pid:42036,parentPid:53356,nodePath:'C:\\Windows\\System32\\conhost.exe',ownerSid:owner,commandLine:'\\??\\C:\\WINDOWS\\system32\\conhost.exe 0x4',creationTime:'2026-10-16T22:56:21.0862000Z'}],probePins:[]});
 const consoleCut=row(PR54_PREDECESSOR_TRANSITION+'\\paused-old-console-core-cut-observation.json',{event:'PAUSED_OLD_CORE_CUT_OBSERVATION',profileSha256:PR54_PREDECESSOR_REFS.profile.sha256,beforeSha256:PR54_PREDECESSOR_REFS.before.sha256,engineSha256:PR54_REHEARSED_ENGINE_SHA,observedAt:'2026-10-18T14:58:01.0000000Z',core:oldBefore.identities.coreSupervisor,consolePins:[],legacyConsolePins:[],probePins:[]});
 previous.originalConsoleIntent={...decoded(consoleIntent),observedAt:'2026-10-18T14:58:00.0000000Z'};
 previous.originalConsoleCut=decoded(consoleCut);
 previous.originalConsoleCompleted={event:'PAUSED_OLD_CORE_CUT_COMPLETED',profileSha256:PR54_PREDECESSOR_REFS.profile.sha256,beforeSha256:PR54_PREDECESSOR_REFS.before.sha256,engineSha256:PR54_REHEARSED_ENGINE_SHA,windowOpenedAt:'2026-10-18T14:58:00.5000000Z',cutCompletedAt:'2026-10-18T14:58:02.0000000Z',core:oldBefore.identities.coreSupervisor,heldProcessHandle:true,processAbsent:true};
 previous.originalConsoleFailure={exceptionType:'System.Management.Automation.RuntimeException',sourceLine:173,code:'P03_PHYSICAL_PAUSED_REMAINING_IDENTITY'};
 previous.resumeIntent=decoded(consoleIntent);
 previous.resumeFailure={exceptionType:'System.Management.Automation.RuntimeException',sourceLine:29,code:'P03_PHYSICAL_ROLLBACK_READBACK_FAILED'};
 assert.equal(consoleIntent.ref.sha256,'1a1df3dd63acb1b77834b61df9a17b71b04fb44c942ec092ac35c8ffc9f89bbd');
 let previousSha=PR54_PREDECESSOR_REFS.before.sha256;
 // Exact, non-secret fe Append records from the fixed timeout attempt. Compact
 // JSON recreates all eight physical hashes, including literal event-0007.
 const timestamps=['2026-10-18T15:43:47.0780116Z','2026-10-18T15:43:48.1500270Z','2026-10-18T15:44:06.0966695Z','2026-10-18T15:44:12.3198264Z',startedAt,'2026-10-18T15:46:44.3540766Z','2026-10-18T15:51:45.2875846Z','2026-10-18T15:51:45.3228139Z'];
 const journal=['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE','ROLLBACK_START_INTENT','ROLLBACK_STARTED','ROLLBACK_FAILED','QUARANTINED'].map((event,sequence)=>{const value=row(PR54_PREDECESSOR_JOURNAL+'\\event-'+String(sequence).padStart(4,'0')+'.json',{sequence,previousSha256:previousSha,profileSha256:PR54_PREDECESSOR_REFS.profile.sha256,beforeSha256:PR54_PREDECESSOR_REFS.before.sha256,event,observedAt:timestamps[sequence],...(sequence===6?{failure:previous.resumeFailure}:{})});previousSha=value.ref.sha256;return value;});
 assert.equal(previousSha,'6f7f5b31e418f0d98499b77b85120239efee7ae54cfb10c7b6a6d3fc8e9c07a3');
 const recoveryResult=row(PR54_PREDECESSOR_TRANSITION+'\\late-old-owner-observed-ready.json',{status:'LATE_OLD_OWNER_OBSERVED_READY',profileSha256:PR54_PREDECESSOR_REFS.profile.sha256,beforeSha256:PR54_PREDECESSOR_REFS.before.sha256,engineSha256:PR54_REHEARSED_ENGINE_SHA,candidateSha256:candidate.ref.sha256,recoveryTailSha256:previousSha,startedAt,observedAt:restoredAt,stableSeconds:30,identityDigest:hash('real-fe-StartedOwner-digest'),engineOutcome:'ROLLBACK_READBACK_FAILED',newGenerationStarted:false,mutationExecuted:false,locksRetained:true});
 const raw={candidate,consoleIntent,consoleCut,recoveryResult,journal},predecessorRef={candidate:candidate.ref,consoleIntent:consoleIntent.ref,consoleCut:consoleCut.ref,recoveryResult:recoveryResult.ref,recoveryTail:journal.at(-1).ref};
 const before={...structuredClone(oldBefore),runId:id,observedAt:'2026-10-18T15:52:20.000Z',identities:Object.fromEntries(roles.map((role,n)=>[role,identity(100+n,'2026-10-18T15:46:45.0000000Z')]))};
 const beforeRef={path:PR54_OWNER_ROOT+'\\MelisaERP-P03-before-'+id+'.json',sha256:hash(encoded(before))};
 const profile={...structuredClone(oldProfile),beforeImage:beforeRef,journalDirectory:PR54_OWNER_ROOT+'\\MelisaERP-P03-recovery-'+id,oldWatchers:['terminalWatcher','hubWatcher'].map((role,n)=>({...identity(200+n,'2026-10-18T15:46:44.4000000Z'),role}))};
 const profileRef={path:PR54_OWNER_ROOT+'\\MelisaERP-P03-profile-'+id+'.json',sha256:hash(encoded(profile))};
 const current={observedAt:'2026-10-18T15:52:21.000Z',tasks:profile.tasks.map(t=>({name:t.name,state:4,xml:t.oldXml})),runningInstances:tasks.map((name,n)=>({name,path:'\\'+name,state:4,enginePid:200+n,instanceGuid:'guid-'+n})),processes:[...Object.values(before.identities),...profile.oldWatchers],bindings:[]};
 return {predecessorRef,previous,raw,profileRef,beforeRef,profile,before,current,now:Date.parse('2026-10-18T15:52:22.000Z')};
}
test('successor proposal consumes fixed predecessor639 timeout plus separate late stable OLD observation',()=>{
 const f=ownerSuccessorFixture(),before=JSON.stringify(f),proposal=admitPr54OwnerSuccessor(f);
 assert.equal(proposal.claimPath,PR54_SUCCESSOR_CLAIM_PATH);assert.equal(proposal.claim.successorRunId,f.before.runId);assert.deepEqual(proposal.claim.successorBefore,f.beforeRef);assert.deepEqual(proposal.claim.predecessorLock,PR54_PREDECESSOR_REFS.globalLock);assert.equal(proposal.claim.engineSha256,PR54_REHEARSED_ENGINE_SHA);assert.equal(proposal.claim.stopOrderDigest,p03CoreFirstStopDigest(f.before.plan));assert.equal(JSON.stringify(f),before);
});
test('successor rejects foreign proof refs, partial outcomes, changed engine and non-empty synthetic recovery',()=>{
 for(const change of [f=>f.predecessorRef.extra={},f=>f.predecessorRef.recoveryTail.path=f.predecessorRef.recoveryTail.path.replace('0007','0006'),f=>f.predecessorRef.recoveryResult.path=PR54_PREDECESSOR_TRANSITION+'\\paused-old-console-resume-result.json',f=>f.predecessorRef.candidate.path='C:\\foreign\\candidate.json',f=>f.raw.recoveryResult.bytes[0]^=1,f=>changeRaw(f,'recoveryResult',r=>r.status='RECOVERED_OLD_ACTIONS'),f=>changeRaw(f,'recoveryResult',r=>r.engineSha256='f'.repeat(64)),f=>changeRaw(f,'recoveryResult',r=>r.stableSeconds=29),f=>changeRaw(f,'recoveryResult',r=>r.newGenerationStarted=true),f=>changeRaw(f,'recoveryResult',r=>r.locksRetained=false),f=>changeRaw(f,'recoveryResult',r=>r.extra=true),f=>changeRaw(f,'candidate',r=>r.processes=[{pid:1}]),f=>changeRaw(f,'candidate',r=>r.receipts=[{}]),f=>changeRaw(f,'consoleIntent',r=>r.priorFailureSha256='f'.repeat(64)),f=>changeRaw(f,'consoleCut',r=>r.core.pid=999)]){const f=ownerSuccessorFixture();change(f);assert.throws(()=>admitPr54OwnerSuccessor(f));}
});
test('successor recovery chain requires exact fe Append fields, eight failed events and matching raw tail',()=>{
 for(const change of [f=>f.raw.journal.pop(),f=>f.raw.journal.push(f.raw.journal.at(-1)),f=>f.raw.journal[2].bytes[0]^=1,f=>{const r=decoded(f.raw.journal[3]);r.previousSha256='f'.repeat(64);f.raw.journal[3]=row(f.raw.journal[3].ref.path,r);},f=>{const r=decoded(f.raw.journal[6]);r.event='QUARANTINED';f.raw.journal[6]=row(f.raw.journal[6].ref.path,r);},f=>{const r=decoded(f.raw.journal[4]);r.pid=7;f.raw.journal[4]=row(f.raw.journal[4].ref.path,r);},f=>f.predecessorRef.recoveryTail.sha256='f'.repeat(64)]){const f=ownerSuccessorFixture();change(f);assert.throws(()=>admitPr54OwnerSuccessor(f));}
});
test('successor never reuses old process births, old before639, stale observations or partial COM/tasks',()=>{
 for(const change of [f=>f.before.runId=PR54_PREDECESSOR_RUN,f=>f.beforeRef.path=f.beforeRef.path.replace('a'.repeat(32),'b'.repeat(32)),f=>f.now+=60000,f=>f.current.observedAt='2026-10-18T15:01:00.000Z',f=>f.before.observedAt='2026-10-18T15:00:00.000Z',f=>f.current.runningInstances.pop(),f=>f.current.runningInstances[0].enginePid=999,f=>f.current.runningInstances[0].path='foreign',f=>f.current.tasks[0].state=3,f=>f.current.tasks[0].xml='new',f=>f.current.processes.shift(),f=>f.before.identities.hub.pid=f.previous.before.identities.hub.pid,f=>f.before.identities.coreSupervisor.creationTime='2026-10-18T14:00:00Z',f=>f.profile.oldWatchers[0].pid=20,f=>f.profile.protectedProcesses[0].pid++,f=>f.profile.newSettings.sha256='f'.repeat(64),f=>f.before.actualT1=true,f=>f.before.copyId='foreign',f=>f.current.bindings.push({pid:999,port:5234,address:'127.0.0.1'})]){const f=ownerSuccessorFixture();change(f);assert.throws(()=>admitPr54OwnerSuccessor(f));}
});
test('successor claim uses one predecessor-derived path even for a second valid fresh run',()=>{
 const f=ownerSuccessorFixture(),first=admitPr54OwnerSuccessor(f);const g=ownerSuccessorFixture();g.before.runId='d'.repeat(32);g.beforeRef.path=g.beforeRef.path.replace('a'.repeat(32),'d'.repeat(32));g.profile.beforeImage=g.beforeRef;g.profileRef.path=g.profileRef.path.replace('a'.repeat(32),'d'.repeat(32));const second=admitPr54OwnerSuccessor(g);
 assert.equal(first.claimPath,second.claimPath);assert.notEqual(hash(encoded(first.claim)),hash(encoded(second.claim)));assert.deepEqual(pr54OwnerSuccessorRefs(f.predecessorRef).priorIntent,PR54_PREDECESSOR_REFS.priorIntent);
 const claims=new Map();const createNew=p=>{if(claims.has(p.claimPath))throw Error('EXISTS');claims.set(p.claimPath,encoded(p.claim));};createNew(first);assert.throws(()=>createNew(second),/EXISTS/);assert.throws(()=>createNew(first),/EXISTS/);assert.equal(claims.size,1);
});
function claimStore(){
 const values=new Map();let writes=0;
 return {values,get writes(){return writes;},createNew:async({ref,bytes})=>{if(values.has(ref.path))throw Error('EXISTS');writes++;values.set(ref.path,Buffer.from(bytes));return {created:true,ref};},readClaim:async ref=>values.get(ref.path)};
}
test('successor atomic claim permits one parallel winner and permanently refuses replay',async()=>{
 const f=ownerSuccessorFixture(),proposal=admitPr54OwnerSuccessor(f),store=claimStore();
 const attempt=()=>claimPr54OwnerSuccessor({inspect:async()=>proposal,createNew:store.createNew,readClaim:store.readClaim});
 const results=await Promise.allSettled([attempt(),attempt()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(store.writes,1);assert.equal(store.values.size,1);
 await assert.rejects(attempt(),/EXISTS/);assert.equal(store.writes,1);
});
test('successor claim failure before validation writes nothing; unknown partial or changed proof stays consumed',async()=>{
 const proposal=admitPr54OwnerSuccessor(ownerSuccessorFixture());
 {const store=claimStore();await assert.rejects(claimPr54OwnerSuccessor({inspect:async()=>{throw Error('STALE');},createNew:store.createNew,readClaim:store.readClaim}),/STALE/);assert.equal(store.writes,0);}
 for(const drift of [p=>p.proofDigest='f'.repeat(64),p=>p.claim.successorBefore.sha256='f'.repeat(64),p=>p.claim.stopOrderDigest='f'.repeat(64)]){
  const store=claimStore();let reads=0;await assert.rejects(claimPr54OwnerSuccessor({inspect:async()=>{const value=structuredClone(proposal);if(reads++)drift(value);return value;},createNew:store.createNew,readClaim:store.readClaim}));assert.equal(store.writes,1);assert.equal(store.values.size,1);
 }
 {const store=claimStore();await assert.rejects(claimPr54OwnerSuccessor({inspect:async()=>proposal,createNew:async value=>{await store.createNew(value);throw Error('UNKNOWN_AFTER_CREATE');},readClaim:store.readClaim}),/UNKNOWN_AFTER_CREATE/);assert.equal(store.values.size,1);}
});
test('successor claim requires exact CreateNew acknowledgement and raw readback without deleting failed claims',async()=>{
 const proposal=admitPr54OwnerSuccessor(ownerSuccessorFixture());
 for(const acknowledgement of [null,{created:false},{created:true,ref:{path:PR54_SUCCESSOR_CLAIM_PATH,sha256:'f'.repeat(64)}}]){
  const store=claimStore();await assert.rejects(claimPr54OwnerSuccessor({inspect:async()=>proposal,createNew:async value=>{await store.createNew(value);return acknowledgement;},readClaim:store.readClaim}));assert.equal(store.values.size,1);
 }
 const store=claimStore();await assert.rejects(claimPr54OwnerSuccessor({inspect:async()=>proposal,createNew:store.createNew,readClaim:async()=>Buffer.from('tampered')}));assert.equal(store.values.size,1);
});
test('successor result numeric duration and fresh observation boundaries fail closed',()=>{
 for(const duration of ['30',null,-1]){const f=ownerSuccessorFixture();changeRaw(f,'recoveryResult',r=>r.stableSeconds=duration);assert.throws(()=>admitPr54OwnerSuccessor(f));}
 for(const change of [f=>{f.now=Date.parse(f.before.observedAt)+15*60000;f.current.observedAt=new Date(f.now).toISOString();},f=>f.now=Date.parse(f.current.observedAt)-1,f=>f.profile.oldWatchers[1].pid=f.profile.oldWatchers[0].pid,f=>f.current.processes.push(f.previous.before.identities.hub)]){const f=ownerSuccessorFixture();change(f);assert.throws(()=>admitPr54OwnerSuccessor(f));}
});
test('a slow full package preflight preserves its immutable before-image while current owner must remain fresh',()=>{
 const f=ownerSuccessorFixture(),original=f.before.observedAt;f.now=Date.parse(original)+10*60000;f.current.observedAt=new Date(f.now).toISOString();
 assert.equal(admitPr54OwnerSuccessor(f).claim.successorRunId,f.before.runId);assert.equal(f.before.observedAt,original);
 const expired=structuredClone(f);expired.now=Date.parse(original)+15*60000;expired.current.observedAt=new Date(expired.now).toISOString();assert.throws(()=>admitPr54OwnerSuccessor(expired));
 const stale=structuredClone(f);stale.current.observedAt=new Date(stale.now-60000).toISOString();assert.throws(()=>admitPr54OwnerSuccessor(stale));
 const changed=structuredClone(f);changed.current.processes[0]={...changed.current.processes[0],creationTime:'2026-10-18T15:09:59.0000000Z'};assert.throws(()=>admitPr54OwnerSuccessor(changed));
});
test('successor pins all four failed original console records and accepts only resumed attempt leaf names',()=>{
 const refs=pr54OwnerSuccessorRefs(ownerSuccessorFixture().predecessorRef);
 assert.equal(refs.originalConsoleIntent.sha256,'6d89a9eadffdec76df380a5c6feb7ae819c6ebfbf20544598938f3f9f227a2ed');assert.equal(refs.originalConsoleCut.sha256,'cd086021c17e6b15a3abead8fc328782a5d5a378b29e82abc95153aa8b247be0');assert.equal(refs.originalConsoleCompleted.sha256,'c89baea866c1f7610f230eff18a866e2f689196833ddd16888e36072b322a1a0');assert.equal(refs.originalConsoleFailure.sha256,'62c0f948119081e250e6cc62626c39e9f9f834bd4950c99d6c47d09c955df26b');
 for(const key of ['originalConsoleIntent','originalConsoleCut','originalConsoleCompleted','originalConsoleFailure']){const f=ownerSuccessorFixture();delete f.previous[key];assert.throws(()=>admitPr54OwnerSuccessor(f));}
 for(const key of ['recoveryResult','consoleIntent']){const f=ownerSuccessorFixture();f.predecessorRef[key].path=PR54_PREDECESSOR_TRANSITION+'\\foreign-proof.json';assert.throws(()=>admitPr54OwnerSuccessor(f));}
});

test('literal timeout requires resumed intent and failure pins without inventing RESTORED_READY',()=>{
 const f=ownerSuccessorFixture(),refs=pr54OwnerSuccessorRefs(f.predecessorRef);
 assert.equal(refs.resumeIntent.sha256,'1a1df3dd63acb1b77834b61df9a17b71b04fb44c942ec092ac35c8ffc9f89bbd');
 assert.equal(refs.resumeFailure.sha256,'ad72bbabfe2a69033ad4ea3772fc2c0a9288989b24e5fba9ac673db82f8fadb0');
 assert.equal(refs.recoveryTail.sha256,'6f7f5b31e418f0d98499b77b85120239efee7ae54cfb10c7b6a6d3fc8e9c07a3');
 assert.deepEqual(f.raw.journal.map(r=>decoded(r).event),['RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE','ROLLBACK_START_INTENT','ROLLBACK_STARTED','ROLLBACK_FAILED','QUARANTINED']);
 for(const edit of [x=>delete x.previous.resumeIntent,x=>delete x.previous.resumeFailure,x=>x.previous.resumeIntent.priorFailureSha256='f'.repeat(64),x=>x.previous.resumeFailure.code='OTHER',x=>x.previous.resumeFailure.sourceLine=30,x=>x.previous.resumeFailure.extra=true,x=>x.predecessorRef.consoleIntent.sha256='f'.repeat(64),x=>x.raw.consoleIntent.bytes[0]^=1,x=>x.raw.journal.splice(6,2),x=>{const r=decoded(x.raw.journal[6]);delete r.failure;x.raw.journal[6]=row(x.raw.journal[6].ref.path,r);},x=>{const r=decoded(x.raw.journal[7]);r.event='RESTORED_READY';x.raw.journal[7]=row(x.raw.journal[7].ref.path,r);}]){const bad=ownerSuccessorFixture();edit(bad);assert.throws(()=>admitPr54OwnerSuccessor(bad));}
});

test('late observation binds exact attempt, empty candidate, failure outcome, time and non-mutation',()=>{
 const edits=[
  r=>r.status='PAUSED_OLD_RESTORED_READY',r=>r.engineOutcome='RESTORED_READY',r=>r.profileSha256='f'.repeat(64),r=>r.beforeSha256='f'.repeat(64),r=>r.candidateSha256='f'.repeat(64),r=>r.recoveryTailSha256='f'.repeat(64),
  r=>r.identityDigest='',r=>r.identityDigest='F'.repeat(64),r=>r.startedAt='2026-10-18T15:46:44.2760000Z',r=>r.observedAt='2026-10-18T15:52:15.3210000Z',r=>r.observedAt='2026-10-18T15:52:21.0000000Z',r=>r.observedAt='invalid',
  r=>r.mutationExecuted=true,r=>r.newGenerationStarted=true,r=>r.locksRetained=false,r=>delete r.identityDigest,r=>delete r.candidateSha256,r=>r.extra=true
 ];
 for(const edit of edits){const f=ownerSuccessorFixture();changeRaw(f,'recoveryResult',edit);assert.throws(()=>admitPr54OwnerSuccessor(f));}
 const valid=ownerSuccessorFixture();changeRaw(valid,'recoveryResult',r=>r.observedAt='2026-10-18T15:52:15.3228139Z');assert.doesNotThrow(()=>admitPr54OwnerSuccessor(valid));
});
test('resumed predecessor requires real completed core cut, exact prior failure and chronological original-to-resume bridge',()=>{
 const mutations=[f=>f.previous.originalConsoleIntent.event='FORGED',f=>f.previous.originalConsoleIntent.priorFailureSha256='f'.repeat(64),f=>f.previous.originalConsoleIntent.oldPids.pop(),f=>f.previous.originalConsoleCut.profileSha256='f'.repeat(64),f=>f.previous.originalConsoleCut.event='FORGED',f=>f.previous.originalConsoleCut.core={...f.previous.originalConsoleCut.core,pid:999},f=>f.previous.originalConsoleCompleted.event='FORGED',f=>f.previous.originalConsoleCompleted.heldProcessHandle=false,f=>f.previous.originalConsoleCompleted.processAbsent=false,f=>f.previous.originalConsoleCompleted.engineSha256='f'.repeat(64),f=>f.previous.originalConsoleCompleted.windowOpenedAt='2026-10-18T14:58:01.5000000Z',f=>f.previous.originalConsoleCompleted.cutCompletedAt='2026-10-18T14:58:00.5000000Z',f=>f.previous.originalConsoleFailure.code='P03_PHYSICAL_UNCLASSIFIED',f=>f.previous.originalConsoleFailure.sourceLine=-1,f=>f.previous.originalConsoleFailure.extra=true,f=>changeRaw(f,'consoleIntent',r=>r.observedAt='2026-10-18T14:58:01.5000000Z'),f=>changeRaw(f,'candidate',r=>r.observedAt='2026-10-18T14:58:59.0000000Z'),f=>changeRaw(f,'consoleCut',r=>r.observedAt='2026-10-18T14:59:01.0000000Z')];
 for(const mutate of mutations){const f=ownerSuccessorFixture();mutate(f);assert.throws(()=>admitPr54OwnerSuccessor(f));}
 const f=ownerSuccessorFixture();assert.ok(Date.parse(decoded(f.raw.consoleCut).observedAt)<Date.parse(decoded(f.raw.consoleIntent).observedAt));assert.doesNotThrow(()=>admitPr54OwnerSuccessor(f));
});
