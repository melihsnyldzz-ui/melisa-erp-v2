import {PR54_CURRENT_B007_PRECUTB142_REFS,PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH} from './p03-pr54-current-b007-precut-continuation.mjs';
import {PR54_CURRENT_B007_PRECUT974D_REFS,PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH} from './p03-pr54-current-b007-precut-continuation.mjs';
import {pr54B264StartedOwnerDigest,assertPr54CurrentB007Candidate} from './p03-pr54-owner-successor.mjs';
import {PR54_CURRENT_B007_PRECUT_REFS,PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH,PR54_CURRENT_B007_PRECUT_RESUME_REFS,PR54_CURRENT_B007_PRECUT_RETRY_REFS} from './p03-pr54-current-b007-precut-continuation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {runP03HeldCoreOwnerTransition,p03TransitionDigest,p03CoreFirstStopDigest} from './p03-integrated-owner-transition.mjs';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
import {validatePr54CurrentB007PhysicalInspection,pr54SafeFailure as actualSafeFailure,pr54CollectPhysicalObservation as actualCollectPhysicalObservation} from './p03-pr54-shared-owner-io.mjs';
const source=fs.readFileSync(new URL('./p03-pr54-shared-owner-io.mjs',import.meta.url),'utf8');
const start=source.indexOf('export async function runPr54CurrentB007SharedOwnerTransition(');
const body=source.slice(start,source.indexOf('// SQL-free, finite native lifecycle proof.',start)).replace(/^export /,'');
const heldInvocationSource=source.slice(source.indexOf('function b264Sup20dHeldInvocation('),source.indexOf('export async function runPr54B264Sup20dSharedOwnerTransition('));
const heldInvocation=new Function('Buffer','need',heldInvocationSource+';return b264Sup20dHeldInvocation;')(Buffer,(value,code)=>{if(!value)throw Error(code);});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const owner='S-1-5-21-2170750028-1005938530-2568122015-1001';
const root=String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018`;
const db='MELISA_ERP_CRM_SHARED_TEST_20261009_02',copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const names=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const sid='a'.repeat(32),transition=root+'\\MelisaERP-P03-transition-'+sid;
const control=root+'\\MelisaERP-P03-current-b007-control-0ddaf85067d6';
const claimPath=root+'\\p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json';
const shaEngine='b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f';
const shaSettings='800329af39652d7fcf111a2b8441d7a00cb0bef94b37668e2ed261e4324ba329';
const pins=Object.fromEntries([...source.slice(source.indexOf('const currentB007SourcePins='),source.indexOf('export async function runPr54CurrentB007SharedOwnerTransition(')).matchAll(/ (\w+):\['([^']+)','([a-f0-9]{64})'\]/g)].map(m=>[m[1],[m[2],m[3]]]));
const same=(a,b)=>a&&b&&['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'].every(k=>a[k]===b[k]);
const exact=(x,keys)=>!!x&&Object.keys(x).sort().join('|')===keys.toSorted().join('|');
function fixture(options={}){
 if(options.finalize)options={...options,postcas:true};
 if(options.postcas)options={...options,recovery:true};
 if(options.recovery)options={...options,retry:true};
 const sid=options.recovery?'42d0d0536cb115cc4aea43ff1f13afbf':'a'.repeat(32),transition=root+'\\MelisaERP-P03-transition-'+sid;
 const isResume=options.resume||options.retry;
 const selected=options.fresh||options.cont974d||options.b142?Object.fromEntries([...(options.b142?body.slice(body.indexOf(' const selectedPins='),body.indexOf('}:freshOwnerGeneration')):body.slice(body.indexOf('}:freshOwnerGeneration'),body.indexOf(' const sources='))).matchAll(/ (\w+):\['([^']+)','([a-f0-9]{64})'\]/g)].map(m=>[m[1],[m[2],m[3]]])):{};
 const activePins={...pins,...selected};
 const files=new Map(),directories=new Set(),calls=[],events=[],writes=[],programs=[];let phase='old',inspections=0,stops=0,emptyWitnessed=false;
 let clock=Date.now();class FixtureDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};const now=()=>new FixtureDate().toISOString();
 function put(file,value,expected){const b=Buffer.isBuffer(value)?value:bytes(value),ref={path:file,sha256:expected??hash(b)};files.set(file,{bytes:b,ref});return ref;}
 const engineRef=put(control+'\\p03-physical-rollback-lifetime-v2.ps1',Buffer.from('engine'),shaEngine);
 for(const [leaf,sha]of Object.values(activePins))put(control+'\\'+leaf,Buffer.from(leaf),sha);
 put(root+'\\p03-pr54-paused-old-recover.ps1',Buffer.from('helper'),'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5');
 const stamp='2026-10-20T08:00:00.0000000Z';
 const identity=(role,n)=>({role,pid:100+n,parentPid:107,nodePath:'C:\\node.exe',ownerSid:owner,commandLine:'node '+role,creationTime:stamp,bindings:n<8?[{port:4184+n,address:'127.0.0.1'}]:[]});
 const identities=Object.fromEntries(targets.map((r,n)=>[r,identity(r,n)])),watchers=[identity('terminalWatcher',8),identity('hubWatcher',9)];
 const protectedRow={pid:900,parentPid:1,nodePath:'C:\\protected.exe',ownerSid:owner,commandLine:'protected',creationTime:stamp};
 const protectedConsole={pid:901,parentPid:900,nodePath:String.raw`C:\Windows\System32\conhost.exe`,ownerSid:owner,commandLine:String.raw`\??\C:\WINDOWS\system32\conhost.exe 0x4`,creationTime:stamp};
 const historicalConsole={pid:4900,parentPid:107,nodePath:String.raw`C:\Windows\System32\conhost.exe`,ownerSid:owner,commandLine:'old console4900',creationTime:stamp};
 const oldSettings=put(root+'\\old.json',{test:true},'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071');
 const newSettings=put(String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json`,{test:true},shaSettings);
 const candidate={erpSource:'6dc33f41737349c6e3f17fb867a451b570a00acc',erpManifest:'6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49',crmSource:'d1e4425206249e38445fb103e03601f86baa84ec',crmManifest:'a0e86fccbdb95eeb97e4dc08e383db7bf8f12a29b040f34a78f6c37e3093b5ef',supervisorSource:'da5b394919941f73b9d7098f146fffd362c2a955',supervisorManifest:'b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf',supervisorRoot:String.raw`C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-da5b39491994`,newSettings};
 const plan={targets,oldSettingsSha256:oldSettings.sha256,newSettingsSha256:newSettings.sha256};plan.digest=p03TransitionDigest(plan);
 const before={runId:sid,ownerSid:owner,database:db,copyId:copy,actualT1:false,observedAt:now(),profile:Object.fromEntries(Object.entries(candidate).filter(([k])=>!['newSettings','supervisorRoot'].includes(k))),identities,plan};
 const beforeRef=put(root+'\\MelisaERP-P03-before-'+sid+'.json',before,options.recovery?'e05d2d7d30a8d477457a78adf7bbe342955d4667a0ba005dc0e399b3e3b8e791':undefined);
 const base=String.raw`C:\Sirket\ERP\backups\P03-20261020-100000`.replace('20261020',options.captureDay??'20261020');
 const snapshot={database:db,tables:Array.from({length:51},(_,n)=>({table:'t'+n,count:0,sha256:'c'.repeat(64)})),modules:[],permissions:[],memberships:[],principals:[],logEndBefore:'00000000:00000001:0000',logEndAfter:'00000000:00000001:0000'};
 const snapshotRef=put(base+'\\source-pre-snapshot.json',snapshot),proofRef=put(base+'\\source-pre-proof.json',{phase:'Pre',snapshotRef}),backupProofRef=put(base+'\\backup-verified.json',{runId:'P03-20261020-100000',backupSetGuid:'a'.repeat(36)});
 const packages=Array.from({length:7},(_,n)=>{const manifest=put(root+'\\package'+n+'\\release-manifest.json',{n});return {root:n===6?candidate.supervisorRoot:root+'\\package'+n,sourceCommit:n===6?candidate.supervisorSource:'d'.repeat(40),manifestPath:manifest.path,manifestSha256:manifest.sha256};});
 const rules=[...targets,...watchers.map(p=>p.role)].map((role,n)=>({role,nodePath:'C:\\node.exe',commandLine:'new '+role}));
 let rows=[...Object.values(identities),...watchers],running=true;
 const tasks=names.map((name,n)=>({name,oldXml:'old'+n,newXml:'new'+n,oldXmlSha256:hash(Buffer.from('old'+n)),newXmlSha256:hash(Buffer.from('new'+n))}));
 let taskXml=tasks.map(t=>t.oldXml);
 const stopper=put(root+'\\MelisaERP-P03-stopper-'+sid+'.ps1',Buffer.from('stopper'),'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d');
 const profile={schemaVersion:'melisa-p03-physical-profile.v1',ownerSid:owner,database:db,beforeImage:beforeRef,businessDigest:snapshotRef,oldSettings,newSettings,protectedProcesses:[protectedRow],oldWatchers:watchers,tasks,packages,stopper,candidateRules:rules,journalDirectory:root+'\\MelisaERP-P03-recovery-'+sid};
 directories.add(profile.journalDirectory);
 const profileRef=put(root+'\\MelisaERP-P03-profile-'+sid+'.json',profile,options.recovery?'a06625191c5b8ccdc622a40555513fcd5192fa81eae784ee706fc258cee9100e':undefined);
 const rehearsalProofRef=put(String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-06889c3b196045bbacf33a10f450a178\result.json`,{status:'REHEARSAL_ROLLBACK_READY',environment:'P03_REHEARSAL',sharedTestMutation:false,protectedBeforeSha256:'a',protectedAfterSha256:'a',engineSha256:options.wrongEngine?'fe053':shaEngine,engine:{sha256:options.wrongEngine?'fe053':shaEngine}},'80e22ce1689fe7c7e8ca01cfafbbba5025e5fa31e9097e55810368c34e1fbc62');
 const historicalBefore=structuredClone(before);if(options.reorderedBindings){before.identities.hub.bindings.push({port:4999,address:'0.0.0.0'});historicalBefore.identities.hub.bindings=[...before.identities.hub.bindings].reverse();put(beforeRef.path,before,beforeRef.sha256);}
 const historicalBeforeRef=put(root+'\\history-before.json',historicalBefore);
 const outerRef=put(root+'\\history-outer\\event-0000.json',{history:true}),recoveryRef=put(root+'\\history-recovery\\event-0000.json',{history:true});
 const input={profileRef,beforeRef,currentPreCapture:{snapshotRef,proofRef,backupProofRef},rehearsalProofRef,sourceControlDir:control};
 if(options.fresh)input.freshOwnerGeneration=true;
 if(options.cont974d)input.precut974dContinuation=true;if(options.b142)input.precutB142Continuation=true;
 if(options.continuation||isResume){
  if(options.retry)input.precutResumeAfter9d2=true;else if(isResume)input.precutResume=true;else input.precutContinuation=true;
  for(const ref of Object.values(PR54_CURRENT_B007_PRECUT_REFS))put(ref.path,{fixtureHistoricalPin:true},ref.sha256);
  const failedDir=path.win32.dirname(PR54_CURRENT_B007_PRECUT_REFS.failureTail.path);
  for(const leaf of ['successor-precut-admission.json','b264-old-owner-cut-intent.json','p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(pins).map(p=>p[0])])put(failedDir+'\\'+leaf,{unchanged:true});
  if(options.advancedFailed)put(failedDir+'\\successor-core-cut-completed.json',{forbidden:true});
  if(isResume){
   for(const ref of Object.values(PR54_CURRENT_B007_PRECUT_RESUME_REFS))put(ref.path,{fixtureResumePin:true},ref.sha256);
   const retainedDir=path.win32.dirname(PR54_CURRENT_B007_PRECUT_RESUME_REFS.failureTail.path);
   for(const leaf of ['p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(pins).filter(([leaf])=>!['p03-pr54-b264-old-owner-cut.ps1','p03-pr54-b264-new-owner-recovery.ps1'].includes(leaf)).map(([leaf])=>leaf),'p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1'])put(retainedDir+'\\'+leaf,{unchanged:true});
   if(options.advancedResume)put(retainedDir+'\\successor-core-cut-completed.json',{forbidden:true});
   if(options.usedResume)put(retainedDir+'\\resume-attempt.json',{forbidden:true});
  }
  if(options.retry){
   for(const ref of Object.values(PR54_CURRENT_B007_PRECUT_RETRY_REFS))put(ref.path,{fixtureRetryPin:true},ref.sha256);
   put(PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile.path,{journalDirectory:root+'\\retry-old-journal'},PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile.sha256);
   const retryDir=path.win32.dirname(PR54_CURRENT_B007_PRECUT_RETRY_REFS.failureTail.path);
   for(const leaf of ['p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(pins).filter(([leaf])=>!['p03-pr54-b264-old-owner-cut.ps1','p03-pr54-b264-new-owner-recovery.ps1'].includes(leaf)).map(([leaf])=>leaf),'p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1'])put(retryDir+'\\'+leaf,{unchanged:true});
   if(options.advancedRetry)put(retryDir+'\\successor-core-cut-completed.json',{forbidden:true});
   if(options.usedRetry)put(retryDir+'\\resume-attempt.json',{forbidden:true});
   if(options.priorAttemptDrift)put(PR54_CURRENT_B007_PRECUT_RETRY_REFS.priorAttempt.path,{drift:true});
  }
  for(const leaf of ['p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1']){
   const matched=body.match(new RegExp("path:path.win32.join\\(sourceControlDir,'"+leaf.replaceAll('.','\\.')+"'\\),sha256:'([^']+)'"));assert(matched);put(control+'\\'+leaf,Buffer.from(leaf),matched[1]);
  }
 }
 function pin(ref){const f=files.get(ref.path);assert(f,'missing '+ref.path);assert.equal(ref.sha256,f.ref.sha256);return f.bytes;}
 const seen=()=>({schemaVersion:'melisa-p03-physical-observation.v1',environment:'Shared',beforeImage:beforeRef,observedAt:now(),collectionAuthority:'PHYSICAL_OBSERVATION_ONLY',processScope:'CIM.Win32_Process.Unfiltered',portScope:'Get-NetTCPConnection.Listen.Unfiltered',stopPermitted:false,applyAvailable:false,rawScope:{unverifiedCount:options.foreignRaw?1:0,unverifiedProcesses:options.foreignRaw?[{pid:666}]:[]},processes:[...rows,...(options.protectedParentDrift&&phase==='cut'?[{...protectedRow,commandLine:'drift'}]:[protectedRow]),...(options.protectedConsole?[options.protectedDrift&&phase==='cut'?{...protectedConsole,creationTime:'2026-10-20T08:00:01.0000000Z'}:protectedConsole]:[]),...(options.foreignOld&&phase==='cut'?[identity('unknown',66)]:[])],bindings:rows.flatMap(p=>(p.bindings??[]).map(b=>({...b,pid:p.pid}))),tasks:tasks.map((t,n)=>({name:t.name,state:running?4:3,xml:taskXml[n]})),runningInstances:running?names.map((name,n)=>({name,state:4,path:'\\'+name,enginePid:rows.find(p=>p.role===(n?'hubWatcher':'terminalWatcher'))?.pid??108+n,instanceGuid:'g'+n})):[]});
 async function run(shell,request,runOptions){const {ref,args}=request,leaf=path.win32.basename(ref.path),at=k=>args[args.indexOf(k)+1];calls.push(leaf+':'+(args.includes('-Mode')?at('-Mode'):args.includes('-Action')?at('-Action'):''));
  if(leaf==='p03-pr54-b264-old-owner-cut.ps1'||leaf==='p03-pr54-current-b007-precut-cut.ps1'){
   if(at('-Mode')==='ObserveStartedOld'){
    assert((options.fresh||options.cont974d)&&options.lateRollback);assert.equal(at('-WorkerSourceSha256'),ref.sha256);assert.equal(runOptions.timeout,660000);
    if(options.lateNativeFailure)throw Error('P03_PHYSICAL_STARTED_PARENT_IDENTITY');
    return {stdout:JSON.stringify({status:'OLD_READY_LATE_OBSERVED',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,engineSha256:at('-EngineSha256'),rollbackFailureTailSha256:at('-RollbackFailureTailSha256'),identityDigest:'e'.repeat(64),stableSeconds:options.lateShortProof?0:30,mutationExecuted:false,startExecuted:false,newGenerationStarted:false})};
   }
   if(['FinalizeOld42d0Inspect','FinalizeOld42d0Apply'].includes(at('-Mode'))){
    assert(options.finalize);assert.equal(runOptions.timeout,900000);assert.equal(at('-EngineSha256'),shaEngine);assert.equal(at('-EnginePath'),transition+'\\p03-physical-rollback-lifetime-v2.ps1');assert.equal(at('-WorkerSourceSha256'),ref.sha256);
    if(options.finalizeNativeError)throw Error('P03_PHYSICAL_FINALIZE42_ALREADY_ATTEMPTED');
    const apply=at('-Mode')==='FinalizeOld42d0Apply',tail='cc202c25a1917b3263ba034f09457d10c01686b8a0b09031e5d5c15249df96db';return {stdout:JSON.stringify({status:options.finalizeWrongStatus?'UNPROVEN':apply?'B264_COMPLETED42_OLD_RESTORED_READY':'B264_COMPLETED42_FINALIZE_OLD_DRY_RUN',recoveryOnly:true,newGenerationStarted:options.finalizeWrongGeneration===true,profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,mutationExecuted:apply,engineSha256:shaEngine,oldActionsRestored:apply,oldRolesAbsent:!apply,startedTasks:apply?2:0,stableSeconds:options.finalizeShortProof?1:30,identityDigest:'a'.repeat(64),journalTailSha256:tail,quarantinedJournalTailSha256:tail})};
   }
   if(['ResumeDrainDryRun','ResumeDrain','ResumeDrainCheck'].includes(at('-Mode'))){
    assert.equal(runOptions.timeout,900000);
    assert(options.recovery);if(options.rejectRecoveryNative)throw Error('P03_PHYSICAL_B264_CUT_CONSOLE_CHANGED');
    const nativeRef=r=>options.recoveryReverseRefs&&at('-Mode')!=='ResumeDrain'?{sha256:r.sha256,path:r.path}:r;
    const actualCut=files.get(transition+'\\successor-core-cut-completed.json').ref;
    const cutWitness=options.recoveryWrongRef==='missing'?{path:actualCut.path}:nativeRef({...actualCut,...(options.recoveryWrongRef==='hash'?{sha256:'0'.repeat(64)}:options.recoveryWrongRef==='path'?{path:actualCut.path+'.wrong'}:options.recoveryWrongRef==='extra'?{extra:true}:{})});
    if(at('-Mode')==='ResumeDrainCheck'){
     const actualDrain=files.get(transition+'\\successor-core-probe-drain.json').ref;
     const checkDrain=options.recoveryWrongDrain==='missing'?{path:actualDrain.path}:{...actualDrain,...(options.recoveryWrongDrain==='hash'?{sha256:'0'.repeat(64)}:options.recoveryWrongDrain==='path'?{path:actualDrain.path+'.wrong'}:options.recoveryWrongDrain==='extra'?{extra:true}:{})};
     assert(files.has(transition+'\\completed-cut-recovery-intent.json'));assert(files.has(transition+'\\successor-core-probe-drain.json'));if(options.recoveryCheckError)throw options.recoveryCheckError;if(options.rejectRecoveryCheck)throw Error('P03_PHYSICAL_COMPLETED42_EPOCH_CHANGED');
     return {stdout:JSON.stringify({status:'B264_COMPLETED_CUT_HISTORICAL_AUX_READ_ONLY',mutationExecuted:false,stopPermitted:options.recoveryProofStop===true,profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,cutWitness,drainWitness:nativeRef(checkDrain),observedAt:options.recoveryProofStale?'2020-01-01T00:00:00Z':now(),historicalConsolePins:[{...historicalConsole,...(options.recoveryProofWrongPid?{pid:4901}:{}),...(options.recoveryProofWrongBirth?{creationTime:'2026-10-20T08:00:01.0000000Z'}:{})}],replacementEpochDigest:'f'.repeat(64),scope:'CURRENT42D0_HISTORICAL_CONSOLE_4900_ONLY'})};
    }
    if(at('-Mode')==='ResumeDrainDryRun'){assert(!files.has(transition+'\\completed-cut-recovery-intent.json'));return {stdout:JSON.stringify({status:'B264_COMPLETED_CUT_RESUME_DRY_RUN',mutationExecuted:false,coreAbsent:true,watchersAbsent:true,probesAbsent:true,remainingOldRoles:rows.length,cutWitness})};}
    const intent=JSON.parse(files.get(transition+'\\completed-cut-recovery-intent.json').bytes);assert.equal(Object.keys(intent).length,9);assert.deepEqual(intent.workerRef,ref);
    const drainWitness=put(transition+'\\successor-core-probe-drain.json',{consolePins:[],probePins:[],goneOldPids:[107]});return {stdout:JSON.stringify({status:'B264_OLD_OWNER_CORE_DRAINED',heldCoreExited:true,comStopped:true,coreStopResult:'COM_STOP_NATURAL_EXIT',cutWitness,drainWitness})};
   }
   if(at('-Mode')==='Inspect'){if(options.slowStage)clock+=65000;const failures=options.inspectErrors??[];if(failures.length)throw failures.shift();return {stdout:JSON.stringify({schemaVersion:'melisa-p03-successor-precut-admission.v1',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,engineSha256:at('-EngineSha256'),recoveryHelperSha256:at('-RecoveryHelperSha256'),observedAt:now(),protectedConsolePins:options.protectedConsole?[protectedConsole]:[],oldIdentities:Object.values(identities),oldWatchers:watchers,consolePins:[],probePins:[]})};}
   assert(files.has(transition+'\\b264-old-owner-cut-intent.json'));const actualClaimPath=options.b142?PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH:options.cont974d?PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH:options.fresh?root+'\\p03-pr54-current-b007-generation-'+ 'd'.repeat(64)+'.lock.json':(options.continuation||isResume)?PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH:claimPath;assert.equal(at('-ClaimPath'),actualClaimPath);assert(files.has(actualClaimPath));assert(events.some(e=>e.event==='EXACT_STOP_INTENT'&&e.target==='coreSupervisor'));
   if(options.b142||options.cont974d||options.continuation||isResume){assert.equal(at('-ContinuationPath'),transition+'\\precut-continuation.json');assert(files.has(at('-ContinuationPath')));}
   if(options.cutError)throw options.cutError;if(options.failCut)throw Error('P03_CUT_UNPROVEN');
   stops++;phase='cut';running=false;rows=rows.filter(p=>!['coreSupervisor','terminalWatcher','hubWatcher'].includes(p.role));
   if(options.diskReplyLoss){
    const rootRef=files.get(transition+'\\b264-old-owner-cut-intent.json').ref,snapshotRef=files.get(transition+'\\successor-precut-admission.json').ref,claimRef=files.get(actualClaimPath).ref;
    const held={event:'B264_OLD_OWNER_CUT_INTENT',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,claimSha256:claimRef.sha256,rootIntentSha256:rootRef.sha256,admittedSnapshotSha256:snapshotRef.sha256,windowOpenedAt:now(),core:identities.coreSupervisor,heldProcessHandle:true,tasks:profile.tasks,runningInstances:names.map((name,n)=>({name,pid:108+n,guid:'g'+n}))};
    if(options.diskBadRoot)held.rootIntentSha256='0'.repeat(64);if(options.diskBadCom)held.runningInstances[0].guid='foreign';if(options.diskBadClaim)held.claimSha256='0'.repeat(64);
    const heldRef=put(transition+'\\b264-old-owner-held-cut-intent.json',held);
    const done={event:'B264_OLD_OWNER_CORE_CUT_COMPLETED',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,claimSha256:claimRef.sha256,durableIntent:heldRef,mechanism:'COM_STOP_NATURAL_EXIT',windowOpenedAt:held.windowOpenedAt,cutCompletedAt:now(),core:identities.coreSupervisor,heldProcessHandle:true,processAbsent:true};if(options.diskBadProfile)done.profileSha256='f'.repeat(64);if(options.diskBadWindow)done.cutCompletedAt=new Date(clock+61000).toISOString();
    if(options.diskHalfCom){rows=[...Object.values(identities),watchers[1]];running=true;return {stdout:'LOST_RESPONSE'};}
    const cutRef=put(transition+'\\successor-core-cut-completed.json',done);
    if(!options.diskTorn)put(transition+'\\successor-core-probe-drain.json',{event:'B264_OLD_OWNER_CORE_PROBES_ABSENT',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,cutWitness:cutRef,observedAt:now(),consolePins:[],probePins:[],latePrecutProbePids:[],goneOldPids:[107],protectedConsolePins:[]});
    if(options.diskNewActions)taskXml=tasks.map(t=>t.newXml);if(options.diskForeign)rows.push({...identity('foreign',70),commandLine:'foreign'});
    if(options.diskRejectedChild)throw Object.assign(Error('P03_NATIVE_EXIT'),{code:1,killed:false,signal:null});
    return {stdout:'LOST_RESPONSE',...(options.diskKilled?{killed:true}:{})};
   }
   const cutWitness=put(transition+'\\successor-core-cut-completed.json',{event:'B264_OLD_OWNER_CORE_CUT_COMPLETED'}),drainWitness=put(transition+'\\successor-core-probe-drain.json',{consolePins:[],probePins:[],goneOldPids:[107]});
   return {stdout:JSON.stringify({status:'B264_OLD_OWNER_CORE_DRAINED',coreStopResult:'COM_STOP_NATURAL_EXIT',heldCoreExited:true,comStopped:true,cutWitness,drainWitness})};
  }
  if(leaf==='p03-physical-recovery-observe.ps1'){const frame=seen();if(emptyWitnessed&&options.postcas){if(options.postcasSecondFrameRole)frame.processes.push(identities.hub);if(options.postcasSecondFrameTask)frame.tasks[0]={...frame.tasks[0],state:4};if(options.postcasSecondFrameAction)frame.tasks[0]={...frame.tasks[0],xml:tasks[0].oldXml};if(options.postcasSecondFrameListener)frame.bindings.push({pid:12345,port:5234,address:'127.0.0.1'});if(options.postcasSecondFrameInstance)frame.runningInstances.push({name:names[0],state:4,path:'\\'+names[0],enginePid:108,instanceGuid:'unexpected'});}return {stdout:JSON.stringify(frame)};}
  if(leaf.startsWith('MelisaERP-P03-stopper-')){const proof=JSON.parse(Buffer.from(at('-ExpectedJsonBase64'),'base64'));stops++;rows=rows.filter(p=>p.pid!==proof.pid);return {stdout:'EXACT_OBSERVED_PROCESS_STOPPED'};}
  if(leaf==='p03-pr54-new-owner-observe.ps1'){
   if(options.failNew)throw Error('P03_NEW_READBACK_FAILED');const candidate=JSON.parse(pin({path:at('-CandidatePath'),sha256:at('-CandidateSha256')}));assert.equal(candidate.processes.length,10);
   return {stdout:JSON.stringify({status:'NEW_OWNER_OBSERVED_READY',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,candidateSha256:at('-CandidateSha256'),engineSha256:at('-EngineSha256'),sourceObserverSha256:at('-SourceObserverSha256'),stableSeconds:30,mutationExecuted:false,sourceProof:{supervisorSourceCommit:before.profile.supervisorSource,supervisorManifestSha256:before.profile.supervisorManifest}})};
  }
  if(leaf==='p03-current-invariance-capture.ps1'){
   const post=structuredClone(snapshot);if(options.sqlDrift)post.tables[0].count=1;const postRef=put(base+'\\source-post-snapshot.json',post),proof={phase:'Post',snapshotRef:postRef};put(base+'\\source-post-proof.json',proof);return {stdout:JSON.stringify(proof)};
  }
  if(leaf==='p03-pr54-b264-new-owner-recovery.ps1'||leaf==='p03-pr54-current-b007-precut-new-recovery.ps1'){
   if(options.b142||options.cont974d||options.continuation||isResume)assert.equal(at('-ContinuationPath'),transition+'\\precut-continuation.json');
   if(options.unprovenPartial)throw Error('P03_NEW_DRAIN_CORE_UNPROVEN');rows=[];running=false;const candidateRef=put(root+'\\MelisaERP-P03-candidate-'+('c'.repeat(32))+'.json',{schemaVersion:'melisa-p03-physical-candidate.v1',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,observedAt:now(),processes:[],receipts:[]});return {stdout:JSON.stringify({status:'B264_NEW_OWNER_EMPTY_CANDIDATE_READY',candidateRef,oldOwnerStarted:false,engineRecoveryExecuted:false,businessWrites:0,requiresFrozenStopNewAndRollbackOld:true})};
  }
  if(leaf==='p03-physical-rollback-lifetime-v2.ps1'){
   if(at('-Mode')==='PreflightOld'){if(!isResume&&!options.fresh&&!options.cont974d)assert(!files.has(options.continuation?PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH:claimPath));if(options.payloadDrift)throw Error('P03_PHYSICAL_PACKAGE_BYTES');return {stdout:JSON.stringify({status:'OLD_PHYSICAL_PREFLIGHT',environment:'Shared',profileSha256:profileRef.sha256,beforeImageSha256:beforeRef.sha256,applyAvailable:false,mutationExecuted:options.badPreflight===true})};}
   if(at('-Mode')==='StopNew'){const c=JSON.parse(pin({path:at('-CandidatePath'),sha256:at('-CandidateSha256')}));assert.equal(c.processes.length,0);put(profile.journalDirectory+'\\event-0000.json',{event:'genuine-frozen-event'});return {stdout:JSON.stringify({status:'RECOVERED_OLD_ACTIONS',journalTailSha256:'f'.repeat(64)})};}
   assert.equal(at('-RecoveryTailSha256'),'f'.repeat(64));if(options.lateRollback){put(profile.journalDirectory+'\\event-0007.json',{sequence:7,event:'QUARANTINED',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256});throw Error(options.lateOtherFailure?'P03_PHYSICAL_STARTED_ROLE_IDENTITY':'P03_PHYSICAL_ROLLBACK_READBACK_FAILED');}return {stdout:JSON.stringify({status:options.failRollback?'ROLLBACK_READBACK_FAILED':'RESTORED_READY'})};
  }
  throw Error('unexpected worker '+leaf);
 }
 async function ps(code,transport){assert.deepEqual(transport,options.recovery||options.fresh||options.cont974d||options.b142?{plainCommandOnly:true}:undefined);programs.push(code);if(options.b142&&files.has(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH))clock+=options.postclaimCost??0;if(options.aclAfterClaim&&files.has(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH)&&code.includes('GetAccessRules'))throw Error('B264_IO_ACL');
  if(code==='ABSENCE_CHECK'){emptyWitnessed=true;return 'EMPTY';}
  if(code.includes('::GetCurrent().User.Value')&&!code.includes('Get-Acl'))return owner;
  if(code.includes('log_end_lsn')){if(options.recovery&&!options.finalize){assert(calls.includes('p03-pr54-current-b007-precut-cut.ps1:'+(options.postcas?'ResumeDrainCheck':'ResumeDrainDryRun')));assert.equal(files.has(transition+'\\completed-cut-recovery-intent.json'),!!options.postcas);}return JSON.stringify(options.recovery?{server:'Semih\\MELISADEV',database:db,copyId:options.recoveryDbDrift?'wrong':copy,actualT1:false,sealed:true,readOnly:true,snapshotRef,backupSetGuid:'a'.repeat(36),observedAt:now()}:{freshNative:true});}
  if(code.includes('RegisterTask(')){const n=code.includes("GetTask('"+names[0]+"')")?0:1;taskXml[n]=code.includes(Buffer.from(tasks[n].newXml).toString('base64'))?tasks[n].newXml:tasks[n].oldXml;return 'SET';}
  if(code.includes("'STARTED'")){phase='new';running=true;rows=rules.map((r,n)=>({...identity(r.role,100+n),commandLine:r.commandLine,bindings:n<8?[{port:4184+n,address:'127.0.0.1'}]:[]}));const hubPath=String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\hub-web\hub-web-process-`+'d'.repeat(32)+'-0.json';put(hubPath,{pid:rows.find(p=>p.role==='hub').pid});put(hubPath.replace('hub-web-process-','hub-web-lineage-'),{lineage:true});return 'STARTED';}
  if(code.includes('CreateDirectory')){directories.add(transition);return 'CREATED';}
  if(code.includes("'UNCHANGED'"))return 'UNCHANGED';
  return 'VERIFIED';
 }
 const currentB007ProtectedConsoleCoverage=new Function('need','targets','owner','sameIdentity','preciseTime','exactKeys',source.slice(source.indexOf('function currentB007ProtectedConsoleCoverage('),source.indexOf('export function validatePr54CurrentB007PhysicalInspection('))+';return currentB007ProtectedConsoleCoverage;')((v,c)=>{if(!v)throw Error('P03_SHARED_'+c);},targets,owner,same,x=>typeof x==='string'?x.replace(/(\.\d{6})Z$/,(_,d)=>d+'0Z'):null,exact);
 const env={validatePr54CurrentB007PhysicalInspection:({frame,current})=>{assert(Date.parse(frame.observedAt)>=Date.parse(current.observedAt)||options.staleFrame);},pr54B264StartedOwnerDigest:(b,c)=>options.frameCom?'f'.repeat(64):pr54B264StartedOwnerDigest(b,c),currentB007ProtectedConsoleCoverage,PR54_CURRENT_B007_ENGINE_SHA256:shaEngine,process:{platform:'win32'},path,crypto,Buffer,Date:options.b142?FixtureDate:Date,JSON,Map,Set,Object,Number,Promise,RegExp,fs:{existsSync:p=>files.has(p)||directories.has(p),readdirSync:p=>[...files.keys()].filter(f=>path.win32.dirname(f)===p).map(f=>path.win32.basename(f)),readFileSync:p=>pin(files.get(p).ref)},hash,jsonBytes:bytes,need:(v,c)=>{if(!v)throw Error('P03_SHARED_'+c);},typedRef:r=>exact(r,['path','sha256']),exactKeys:exact,pin,read:r=>JSON.parse(pin(r)),currentDatabase:db,currentCopy:copy,owner,targets,names,quote:s=>"'"+s+"'",psNoReparse:'',shell:'synthetic',opts:{},PR54_PROTECT_SQL_CONNECTION:'synthetic',currentB007SourcePins:pins,PR54_B264_REFS:{engine:engineRef,before:historicalBeforeRef},PR54_B264_OUTER_REFS:[outerRef],PR54_B264_RECOVERY_REFS:[recoveryRef],PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH:claimPath,p03TransitionDigest,p03CoreFirstStopDigest,b264ReadPins:()=>[],pr54B264ReadPinsProgram:()=>'',validatePr54B264Predecessor:()=>true,
  assertPr54CurrentB007Candidate,PR54_CURRENT_B007_PRECUT_REFS,PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH,PR54_CURRENT_B007_PRECUT_RESUME_REFS,PR54_CURRENT_B007_PRECUT_RETRY_REFS,
  preparePr54CurrentB007PrecutResume:input=>{if(options.expireAfterClaim&&files.has(path.win32.dirname(PR54_CURRENT_B007_PRECUT_RESUME_REFS.failureTail.path)+'\\resume-attempt.json'))throw Error('P03_MODELED_BEFORE_EXPIRED');return env.validatePr54CurrentB007PrecutResumeBinding(input);},
  validatePr54CurrentB007PrecutResumeBinding:({raw,profileRef,beforeRef})=>{assert.equal(Object.keys(raw.original).length,8);assert.equal(Object.keys(raw.resume).length,11);return {schemaVersion:'melisa-p03-current-b007-precut-resume.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.failureTail,retainedProfileRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.profile,retainedBeforeRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.before,profileRef,beforeRef,claimPath:PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH};},
  preparePr54CurrentB007PrecutContinuation:input=>{if(options.expireAfterClaim&&files.has(PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH))throw Error('P03_MODELED_BEFORE_EXPIRED');return env.validatePr54CurrentB007PrecutContinuationBinding(input);},
  validatePr54CurrentB007PrecutContinuationBinding:({raw,profileRef,beforeRef})=>{if(options.rejectContinuation)throw Error('P03_CURRENT_B007_PRECUT_CONTINUATION_REJECTED');assert.equal(Object.keys(raw).length,8);return Object.freeze({schemaVersion:'melisa-p03-current-b007-precut-continuation.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT_REFS.failureTail,profileRef,beforeRef,claimPath:PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH});},
  inspectPr54CurrentB007PhysicalOwner:async()=>{inspections++;calls.push('ADMISSION');const current=seen();if(options.staggerFrame)clock+=50;const frame={schemaVersion:'melisa-p03-b264-precut-inspection.v1',policyGeneration:'CurrentB007InspectOnly',transitionAuthority:false,stopAuthority:false,applyExecuted:false,profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,engineSha256:files.get(transition+'\\p03-physical-rollback-lifetime-v2.ps1')?.ref.sha256??engineRef.sha256,recoveryHelperSha256:files.get(transition+'\\p03-pr54-paused-old-recover.ps1')?.ref.sha256??'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5',observedAt:options.staleFrame?new Date(clock-61000).toISOString():now(),oldIdentities:Object.values(identities).map(p=>({...p})),oldWatchers:watchers.map(p=>({...p})),consolePins:[],probePins:[],protectedConsolePins:[],protectedProcesses:profile.protectedProcesses};if(options.frameUid)frame.oldIdentities[0].pid++;return {profile,before,current,physicalInspection:secret,...(options.b142?{admissionFrame:frame}:{})};},
  preparePr54B264NativeContinuity:()=>secret,preparePr54CurrentB007NativeContinuity:()=>secret,validatePr54CurrentPreCapture:()=>({runId:'P03-20261020-100000',root:base}),pr54CurrentContinuityProgram:()=> 'log_end_lsn',
  admitPr54CurrentB007Epoch:({physicalInspection,current})=>{assert.equal(physicalInspection,secret);const value={schemaVersion:'melisa-p03-current-b007-epoch-proposal.v1',currentOwnerDigest:options.ownerDrift&&inspections>1?'e'.repeat(64):options.b142?pr54B264StartedOwnerDigest(historicalBefore,current):'d'.repeat(64),ownerObservedAt:current.observedAt,protectedSqlEpoch:{kind:'ProtectedSqlService',pid:900},predecessorRunId:'b264594b6f93d560d807c8decc4e6699',predecessorProfile:{},predecessorBefore:{},predecessorLock:{},consumedAncestorClaim:{},failedOuterTail:{},quarantinedRecoveryTail:{},readOnlyOldReady:{},successorRunId:sid,successorProfile:profileRef,successorBefore:beforeRef,newSettings,candidate,stopOrderDigest:p03CoreFirstStopDigest(plan),transitionAuthority:false,applyExecuted:false};return {claimPath,claim:value,proofDigest:'c'.repeat(64)};},
  noReparseAncestors:p=>{if(options.journal974dLink&&p===root+'\\prior974dJournal\\scope-check')throw Error('P03_SHARED_REPARSE');},pr54ProtectedWriteProgram:(file,sha)=>({file,sha}),psPayload:async({file,sha},b,transport)=>{assert.deepEqual(transport,options.recovery||options.fresh||options.cont974d||options.b142?{plainCommandOnly:true}:undefined);assert(!files.has(file),'CreateNew must reject overwrite');if(options.b142&&files.has(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH))clock+=options.postclaimCost??0;if(options.failDiagnostic&&file.endsWith('io-failure-diagnostic.json'))throw Error('P03_DIAGNOSTIC_IO');if(options.failLock&&file.endsWith('transition.lock'))throw Error('P03_LOCK_IO');assert.equal(hash(b),sha);put(file,b);writes.push(file);if(options.failClaimReply&&file===PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH)throw Error('P03_CLAIM_WRITE_REPLY_LOST');if(/event-\d{4}\.json$/.test(file))events.push(JSON.parse(b));},ps,run,b264Sup20dHeldInvocation:(ref,argv,transport)=>{assert.deepEqual(transport,options.recovery||options.fresh||options.cont974d||options.b142?{fileInvocationOnly:true}:undefined);return {ref,args:argv.slice(4)};},pr54CollectPhysicalObservation:(fn,stage)=>{assert(['PHYSICAL','SUCCESSOR_INSPECT'].includes(stage));return actualCollectPhysicalObservation(fn,stage);},sameIdentity:same,pr54SuccessorEmptyProgram:({ids,consoles})=>{if(options.protectedConsole){assert(!ids.includes(901));assert(!consoles.some(p=>p.pid===901));}if(options.recovery){assert(!ids.includes(4900));assert(!consoles.some(p=>p.pid===4900));assert(calls.at(-1).endsWith(':ResumeDrainCheck'));}return 'ABSENCE_CHECK';},nativeArgumentTokens,proposePr54CandidateProcesses:(seen,profile)=>seen.processes.flatMap(p=>{const r=profile.candidateRules.find(r=>r.commandLine===p.commandLine&&r.nodePath===p.nodePath);return r?[{...p,role:r.role}]:[];}),pr54CurrentSourceCaptureArgs:runId=>['-Mode','SourceCapture','-Phase','Post','-RunId',runId],comparePr54CurrentSourceSnapshots:(a,b)=>{assert.deepEqual(a,b);return {equal:true,criticalTables:51};},runP03HeldCoreOwnerTransition,pr54SafeFailure:actualSafeFailure};
 if(options.retry){env.preparePr54CurrentB007PrecutRetry=input=>env.validatePr54CurrentB007PrecutRetryBinding(input);env.validatePr54CurrentB007PrecutRetryBinding=({raw,profileRef,beforeRef})=>{assert.equal(Object.keys(raw.original).length,8);assert.equal(Object.keys(raw.resume).length,11);assert.equal(Object.keys(raw.retry).length,11);for(const [key,ref]of Object.entries(PR54_CURRENT_B007_PRECUT_RETRY_REFS))pin(ref);return {schemaVersion:'melisa-p03-current-b007-precut-retry.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT_RETRY_REFS.failureTail,retainedProfileRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.profile,retainedBeforeRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.before,profileRef,beforeRef,claimPath:PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH};};}
 if(options.cont974d){
  env.PR54_CURRENT_B007_PRECUT974D_REFS=PR54_CURRENT_B007_PRECUT974D_REFS;env.PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH=PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH;
  env.validatePr54CurrentB007Precut974dContinuationBinding=({raw,profileRef,beforeRef})=>{if(options.reject974d)throw Error('P03_CURRENT_B007_PRECUT974D_REJECTED');assert.equal(Object.keys(raw).length,8);for(const r of Object.values(PR54_CURRENT_B007_PRECUT974D_REFS))pin(r);return {schemaVersion:'melisa-p03-current-b007-precut974d-continuation.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT974D_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT974D_REFS.failureTail,profileRef,beforeRef,claimPath:PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH,correctedSourceCommit:'82e741af59cb59f27a4008ded83ca889238fb5c7'};};
  env.preparePr54CurrentB007Precut974dContinuation=input=>{if(options.expireAfterClaim&&files.has(PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH))throw Error('P03_MODELED_BEFORE_EXPIRED');return env.validatePr54CurrentB007Precut974dContinuationBinding(input);};
 }
 const secret=Object.freeze({});
 if(options.cont974d){
  const refs=PR54_CURRENT_B007_PRECUT974D_REFS,failedDir=path.win32.dirname(refs.failureTail.path),priorJournal=root+'\\prior974dJournal';
  for(const [key,r] of Object.entries(refs))put(r.path,key==='profile'?{journalDirectory:priorJournal}:{retained974d:true},r.sha256);
  for(const leaf of ['p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(activePins).map(([leaf])=>leaf)])put(failedDir+'\\'+leaf,{retainedPayload:true});
  if(options.advanced974d)put(failedDir+'\\successor-core-cut-completed.json',{forbidden:true});
  if(options.journal974d)put(priorJournal+'\\event-0000.json',{forbidden:true});
  const proposal=env.admitPr54CurrentB007Epoch({physicalInspection:secret,current:seen()}).claim;
  put(refs.claim.path,{...proposal,schemaVersion:'melisa-p03-current-b007-epoch-claim.v1',transitionAuthority:true,applyExecuted:false,successorRunId:'974d73c7d84b9ea43e1397b0fdf44c01',successorProfile:refs.profile,successorBefore:refs.before,ownerObservedAt:'2026-10-21T18:40:00Z',...(options.retained974dDrift?{currentOwnerDigest:'e'.repeat(64)}:{})},refs.claim.sha256);
 }

 if(options.b142){
  Object.assign(env,{PR54_CURRENT_B007_PRECUT974D_REFS,PR54_CURRENT_B007_PRECUTB142_REFS,PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH});
  env.preparePr54CurrentB007PrecutB142Continuation=env.validatePr54CurrentB007PrecutB142ContinuationBinding=({raw,profileRef,beforeRef})=>{assert.equal(Object.keys(raw.original).length,8);assert.equal(Object.keys(raw.failed).length,11);return {schemaVersion:'melisa-p03-current-b007-precutb142-continuation.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUTB142_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUTB142_REFS.failureTail,profileRef,beforeRef,claimPath:PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH,correctedSourceCommit:'82e741af59cb59f27a4008ded83ca889238fb5c7'};};
  for(const [refs,extras] of [[PR54_CURRENT_B007_PRECUT974D_REFS,[]],[PR54_CURRENT_B007_PRECUTB142_REFS,['precut-continuation.json','successor-precut-admission.json','b264-old-owner-cut-intent.json']]]){
   const dir=path.win32.dirname(refs.failureTail.path),journal=root+'\\prior'+(extras.length?'B142':'974d')+'Journal';
   for(const [key,r]of Object.entries(refs))put(r.path,key==='profile'?{journalDirectory:journal}:{retained:true},r.sha256);
   for(const leaf of ['p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(activePins).map(([leaf])=>leaf),...extras])if(!files.has(dir+'\\'+leaf))put(dir+'\\'+leaf,{retainedPayload:true});
  }
  const modeled=env.admitPr54CurrentB007Epoch({physicalInspection:secret,current:seen()}).claim;
  put(PR54_CURRENT_B007_PRECUTB142_REFS.claim.path,{...modeled,schemaVersion:'melisa-p03-current-b007-epoch-claim.v1',transitionAuthority:true,successorRunId:'b14266ad30507bb10d78ae76e2546221',successorProfile:PR54_CURRENT_B007_PRECUTB142_REFS.profile,successorBefore:PR54_CURRENT_B007_PRECUTB142_REFS.before},PR54_CURRENT_B007_PRECUTB142_REFS.claim.sha256);
 }

 if(isResume){const modeled=env.admitPr54CurrentB007Epoch({physicalInspection:secret,current:seen()}).claim;put(PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim.path,{...modeled,schemaVersion:'melisa-p03-current-b007-epoch-claim.v1',transitionAuthority:true,ownerObservedAt:'2026-10-21T10:00:00Z',successorRunId:'452054204a1857ff618b0dd30a59caea',successorProfile:PR54_CURRENT_B007_PRECUT_RESUME_REFS.profile,successorBefore:PR54_CURRENT_B007_PRECUT_RESUME_REFS.before},PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim.sha256);}
 if(options.recovery){
  input.resumeCompletedCut42d0=true;phase='cut';running=false;rows=[identities.hub];
  if(options.recoveryRawUnknown)rows.push({...historicalConsole,nodePath:'C:\\Windows\\System32\\cmd.exe',commandLine:'unrelated new command',creationTime:'2026-10-21T12:10:54.924001Z'});
  const hashes=new Function('return ('+body.match(/const hashes=(\{[\s\S]*?\n  \});/)[1]+');')();
  const context=env.validatePr54CurrentB007PrecutRetryBinding({raw:{original:PR54_CURRENT_B007_PRECUT_REFS,resume:PR54_CURRENT_B007_PRECUT_RESUME_REFS,retry:PR54_CURRENT_B007_PRECUT_RETRY_REFS},profileRef,beforeRef});
  for(const [leaf,sha]of Object.entries(hashes))put(transition+'\\'+leaf,{fixtureCompletedCutPin:true},sha);
  const contextRef=put(transition+'\\precut-continuation.json',context,hashes['precut-continuation.json']);put(path.win32.dirname(PR54_CURRENT_B007_PRECUT_RETRY_REFS.failureTail.path)+'\\resume-attempt.json',bytes(context),contextRef.sha256);
  put(transition+'\\transition.lock',{profileRef,beforeRef,currentPreCapture:input.currentPreCapture,rehearsalProofRef,successorClaimRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim,continuationRef:contextRef},hashes['transition.lock']);
  put(transition+'\\successor-precut-admission.json',{consolePins:[historicalConsole],probePins:[],protectedConsolePins:[],observedAt:now()},hashes['successor-precut-admission.json']);
  for(const [leaf,sha]of [['p03-physical-rollback-lifetime-v2.ps1',shaEngine],['p03-pr54-paused-old-recover.ps1','e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'],...Object.values(pins).filter(([leaf])=>!['p03-pr54-b264-old-owner-cut.ps1','p03-pr54-b264-new-owner-recovery.ps1'].includes(leaf)),['p03-pr54-current-b007-precut-cut.ps1','ebfbe596906e3c98951df085df4d84648152d581ac774353815cdfea3b3bd138'],['p03-pr54-current-b007-precut-new-recovery.ps1','667ac16f0a83251db2e11e9e337ce9894de4803efc9ed5a2b2fe6129672fb28c']])put(transition+'\\'+leaf,Buffer.from(leaf),sha);
  put(control+'\\p03-pr54-current-b007-precut-cut.ps1',Buffer.from('new recovery worker'),'213835b02b8eb367bbb6858a76cfcd36e46103bac960843d04bde3c971d703b7');
  if(options.recoveryAdvanced)put(transition+'\\unexpected.json',{unknown:true});
  if(options.recoveryUsed)put(transition+'\\completed-cut-recovery-intent.json',{used:true});
  if(options.postcas){
   input.resumeCompletedCut42d0PostCas=true;rows=[];taskXml=tasks.map(t=>t.newXml);
   const fixed=new Function('return ('+body.match(/if\(resumeCompletedCut42d0PostCas\)Object.assign\(hashes,(\{[\s\S]*?\n  \})\);/)[1]+');')();
   for(const [leaf,sha]of Object.entries(fixed))put(transition+'\\'+leaf,{fixturePostcasPin:true},sha);
   put(transition+'\\completed-cut-recovery-intent.json',{schemaVersion:'melisa-p03-current-b007-completed-cut-recovery.v1',mode:'ROLLBACK_OLD_ONLY',runId:sid,profileRef,beforeRef,claimRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim,cutRef:files.get(transition+'\\successor-core-cut-completed.json').ref,failureTailRef:files.get(transition+'\\event-0002.json').ref,workerRef:files.get(control+'\\p03-pr54-current-b007-precut-cut.ps1').ref},fixed['completed-cut-recovery-intent.json']);
   put(transition+'\\completed-cut-recovery-result.json',{status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',reason:'B264_SOURCE_ACL',recoveryOnly:true,newGenerationStarted:false},fixed['completed-cut-recovery-result.json']);
   put(transition+'\\successor-core-probe-drain.json',{event:'B264_OLD_OWNER_CORE_PROBES_ABSENT',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,cutWitness:files.get(transition+'\\successor-core-cut-completed.json').ref,consolePins:[],probePins:[]},fixed['successor-core-probe-drain.json']);
   for(const role of ['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative']){
    put(transition+'\\completed-cut-recovery-stop-'+role+'-intent.json',{role,identity:identities[role],alreadyAbsent:role!=='hub',cutRef:files.get(transition+'\\successor-core-cut-completed.json').ref},fixed['completed-cut-recovery-stop-'+role+'-intent.json']);
    put(transition+'\\completed-cut-recovery-stop-'+role+'-result.json',{role,result:role==='hub'?'EXACT_OBSERVED_PROCESS_STOPPED':'ALREADY_GONE'},fixed['completed-cut-recovery-stop-'+role+'-result.json']);
   }
   if(options.postcasOldAction)taskXml[0]=tasks[0].oldXml;
   if(options.postcasRunning){running=true;}
   if(options.postcasLiveRole)rows=[identities.hub];
   if(options.postcasUsed)put(transition+'\\completed-cut-postcas-recovery-intent.json',{used:true});
   if(options.postcasJournal)put(profile.journalDirectory+'\\event-0000.json',{advanced:true});
   if(options.postcasWrongStop){const leaf='completed-cut-recovery-stop-hub-result.json';put(transition+'\\'+leaf,{role:'hub',result:'ALREADY_GONE'},fixed[leaf]);}
   if(options.postcasWrongResult){const leaf='completed-cut-recovery-result.json';put(transition+'\\'+leaf,{status:'RECOVERED_OLD_READY',reason:'B264_SOURCE_ACL',recoveryOnly:true,newGenerationStarted:false},fixed[leaf]);}
   if(options.postcasChangedPin)put(transition+'\\completed-cut-recovery-stop-hub-result.json',{changed:true});
   if(options.postcasWorkerError){const old=env.run;env.run=async(...args)=>{const request=args[1];if(path.win32.basename(request.ref.path)==='p03-physical-rollback-lifetime-v2.ps1')throw options.postcasWorkerError;return old(...args);};}
  }
 }
 if(options.finalize){
  input.resumeFailedStopNew42d0=true;const originalControl=root+'\\MelisaERP-P03-current-b007-control-f7c6286076b4';
  for(const [file,value]of [...files])if(file.startsWith(control+'\\')){const replacement=originalControl+file.slice(control.length);files.set(replacement,{bytes:value.bytes,ref:{...value.ref,path:replacement}});}
  input.sourceControlDir=originalControl;
  const literal=body.match(/finalRestoreWorkerRef.path===root\+('[^']+')/)[1],leaf=new Function('return '+literal)(),sha=body.match(/finalRestoreWorkerRef.sha256==='([^']+)'/)[1];
  input.finalRestoreWorkerRef=put(root+leaf,Buffer.from('finalize worker'),sha);
 }
 const fn=new Function('env',`const {${Object.keys(env).join(',')}}=env;return (${body});`)(env);
 if(options.missingSource)files.delete(control+'\\'+pins.emptyRecovery[0]);
 return {input,fn,calls,events,writes,files,programs,get clock(){return clock;},get stops(){return stops;}};
}

// Source-body IO fixtures only. They do not collect OS state or perform a Shared transition.
test('existing ps and payload helpers use literal Command only when explicitly selected and retain historical encoded output',async()=>{
 const lines=source.split(/\r?\n/),code=lines.find(s=>s.startsWith('async function psPayload('))+'\n'+lines.find(s=>s.startsWith('async function ps(')),calls=[];
 const run=async(shell,args)=>{calls.push(args);return {stdout:'OK',stderr:''};};
 const spawn=(shell,args)=>{calls.push(args);const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=input=>{assert.equal(input,Buffer.from('payload').toString('base64'));child.stdout.emit('data','CREATED');child.emit('close',0);};return child;};
 const helpers=new Function('Buffer','need','run','spawn','shell','opts',code+';return {ps,psPayload};')(Buffer,(v,c)=>{if(!v)throw Error(c);},run,spawn,'fixture',{});
 await helpers.ps("'OK'");assert.equal(calls.at(-1)[2],'-EncodedCommand');assert.equal(Buffer.from(calls.at(-1)[3],'base64').toString('utf16le'),"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;'OK'");
 await helpers.ps("'OK'",{plainCommandOnly:true});assert.equal(calls.at(-1)[2],'-Command');assert.equal(calls.at(-1)[3],"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;'OK'");
 await helpers.psPayload("'CREATED'",Buffer.from('payload'));assert.equal(calls.at(-1)[2],'-EncodedCommand');await helpers.psPayload("'CREATED'",Buffer.from('payload'),{plainCommandOnly:true});assert.deepEqual(calls.at(-1),['-NoProfile','-NonInteractive','-Command',"'CREATED'"]);
});
test('held File-only transport retains historical bytes and rejects unsafe native argument shapes without encoded code',()=>{
 const ref={path:'C:\\fixture.ps1',sha256:'a'.repeat(64)},argv=['-NoProfile','-NonInteractive','-File',ref.path,'-Mode','DryRun'];assert.equal(hash(JSON.stringify(heldInvocation(ref,argv))),'573c18a5161adc378408fa0894762a8ee46ec0d2c7397ffa98e213e3fd2f6382');
 const file=heldInvocation(ref,argv,{fileInvocationOnly:true});assert.equal(file[2],'-Command');assert(!file.includes('-EncodedCommand'));assert(!file[3].toLowerCase().includes('[scriptblock]::create'));assert(file[3].includes("$s=[IO.File]::Open($v.ref.path,'Open','Read','Read')"));assert(file[3].includes("'-File',[string]$v.ref.path"));assert(file[3].includes('exit $childExit'));
 for(const tail of [['-Mode','bad"quote'],['-Mode','line\n'],['-Mode',''],['-Mode','x','-mode','y'],['Mode','x']])assert.throws(()=>heldInvocation(ref,[...argv.slice(0,4),...tail],{fileInvocationOnly:true}),/FILE_INVOCATION_ARGS/);
});
test('held File-only Windows child has real PSCommandPath, compatible self-read and inherited exit status', {skip:process.platform!=='win32'},()=>{
 const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,temp=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'melisa-p03-file-invocation-')));
 try{
  const file=path.join(temp,'source with spaces.ps1'),literal="literal $(do-not-run); single'quote [x]";
  fs.writeFileSync(file,"param([string]$Literal,[int]$ExitCode)\n$ErrorActionPreference='Stop'\n$s=[IO.File]::Open($PSCommandPath,'Open','Read','Read');$s.Dispose();$exclusiveDenied=$false;try{$s=[IO.File]::Open($PSCommandPath,'Open','Read','None');$s.Dispose()}catch [IO.IOException]{$exclusiveDenied=$true};[ordered]@{path=$PSCommandPath;literal=$Literal;sharedRead=$true;exclusiveDenied=$exclusiveDenied}|ConvertTo-Json -Compress;exit $ExitCode\n",{flag:'wx'});
  const data=Buffer.from(JSON.stringify({file})).toString('base64'),setup=`$ErrorActionPreference='Stop';$env:PSModulePath=Join-Path $PSHOME 'Modules';Import-Module (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop;$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$a=[Security.AccessControl.FileSecurity]::new();$a.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$a.SetAccessRuleProtection($true,$false);foreach($sid in @($owner,'S-1-5-18')){$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))};Set-Acl -LiteralPath $v.file -AclObject $a;$owner`;
  const prepared=spawnSync(shell,['-NoProfile','-NonInteractive','-Command',setup],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(prepared.status,0,prepared.stderr);const currentOwner=prepared.stdout.trim();assert.match(currentOwner,/^S-1-[0-9-]+$/);
  const fn=new Function('Buffer','need',heldInvocationSource.replaceAll(owner,currentOwner)+';return b264Sup20dHeldInvocation;')(Buffer,(value,code)=>{if(!value)throw Error(code);});
  const ref={path:file,sha256:hash(fs.readFileSync(file))};for(const exitCode of [0,7]){const argv=['-NoProfile','-NonInteractive','-File',file,'-Literal',literal,'-ExitCode',String(exitCode)],r=spawnSync(shell,fn(ref,argv,{fileInvocationOnly:true}),{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(r.status,exitCode,r.stderr);assert.equal(r.stderr,'');assert.deepEqual(JSON.parse(r.stdout),{path:file,literal,sharedRead:true,exclusiveDenied:true});}
 }finally{const base=fs.realpathSync.native(os.tmpdir())+path.sep,target=path.resolve(temp);assert(target.startsWith(base)&&path.basename(target).startsWith('melisa-p03-file-invocation-'));fs.rmSync(target,{recursive:true});}
});
test('fixed completed42d0 cut recovery DryRun only authenticates history and native absence without admission or writes',async()=>{
 const f=fixture({recovery:true}),r=await f.fn(f.input);assert.equal(r.status,'CURRENT_B007_COMPLETED_CUT_RECOVERY_DRY_RUN');assert.equal(r.remainingOldRoles,1);assert.equal(f.stops,0);assert.equal(f.writes.length,0);assert(f.calls.includes('p03-pr54-current-b007-precut-cut.ps1:ResumeDrainDryRun'));assert(!f.calls.some(c=>c.includes('PreflightOld')||c.includes('RollbackOld')));
});
test('fixed completed42d0 recovery restores OLD via one exact remaining stop and frozen rollback, never starts NEW',async()=>{
 const f=fixture({recovery:true}),original=new Map([...f.files].map(([p,x])=>[p,Buffer.from(x.bytes)])),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'RECOVERED_OLD_READY',JSON.stringify(r));assert.equal(f.stops,1);assert.equal(r.newGenerationStarted,false);assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:StopNew'));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));assert(!f.calls.some(c=>c.includes('PreflightOld')||c.includes('new-owner-observe')));assert(!f.programs.some(p=>p.includes("'STARTED'")));for(const [p,b]of original)assert(f.files.get(p).bytes.equals(b));await assert.rejects(f.fn({...f.input,mode:'Apply'}),/ALREADY_ATTEMPTED|COMPLETED_CUT_SCOPE/);
});
test('fixed42d0 recovery refuses changed scope, previous attempt, DB mismatch and failed native absence before any write or stop',async()=>{
 for(const option of ['recoveryAdvanced','recoveryUsed','recoveryDbDrift','rejectRecoveryNative']){const f=fixture({recovery:true,[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}));assert.equal(f.writes.length,0);assert.equal(f.stops,0);}
 const f=fixture({recovery:true});await assert.rejects(f.fn({...f.input,precutResumeAfter9d2:false,mode:'Apply'}),/COMPLETED_CUT_MODE/);assert.equal(f.writes.length,0);
});
test('completed42d0 failed frozen rollback retains one-shot intent and never retries or claims success',async()=>{
 const f=fixture({recovery:true,failRollback:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(f.stops,1);assert.equal(f.calls.filter(c=>c.endsWith(':RollbackOld')).length,1);assert(f.writes.some(p=>p.endsWith('completed-cut-recovery-intent.json')));assert(!f.programs.some(p=>p.includes("'STARTED'")));
});
test('each completed42d0 empty boundary rechecks only4900 historical epoch and rejects malformed or stale native proofs',async()=>{
 const good=fixture({recovery:true}),r=await good.fn({...good.input,mode:'Apply'});assert.equal(r.status,'RECOVERED_OLD_READY');assert(good.calls.filter(c=>c.endsWith(':ResumeDrainCheck')).length>=4);
 for(const option of ['rejectRecoveryCheck','recoveryProofStop','recoveryProofStale','recoveryProofWrongPid','recoveryProofWrongBirth']){const f=fixture({recovery:true,[option]:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(f.stops,1);assert(!f.calls.some(c=>c.endsWith(':StopNew')||c.endsWith(':RollbackOld')));assert(!f.programs.some(p=>p.includes('RegisterTask(')));}
 const raw=fixture({recovery:true,recoveryRawUnknown:true}),blocked=await raw.fn({...raw.input,mode:'Apply'});assert.equal(blocked.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(raw.stops,0);assert(!raw.calls.some(c=>c.endsWith(':StopNew')));
});
test('completed42d0 recovery retains the first bounded digit-bearing native reason without raw stderr or TDZ',async()=>{
 const secret='PRIVATE_PATH_AND_ARGV_PAYLOAD',error=Object.assign(Error(secret),{stderr:secret+'\nP03_PHYSICAL_COMPLETED42_AUX_CAS\n'+secret}),f=fixture({recovery:true,recoveryCheckError:error}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.recoveryReason,'P03_PHYSICAL_COMPLETED42_AUX_CAS');assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert(!JSON.stringify(r).includes(secret));const saved=JSON.parse(f.files.get(root+'\\MelisaERP-P03-transition-42d0d0536cb115cc4aea43ff1f13afbf\\completed-cut-recovery-result.json').bytes);assert.equal(saved.reason,r.recoveryReason);assert(!JSON.stringify(saved).includes(secret));
});
test('exact9d2 retry modeled dry-run writes nothing and successful handoff preserves both histories and same452 claim',async()=>{
 const dry=fixture({retry:true}),d=await dry.fn(dry.input);assert.equal(d.status,'CURRENT_B007_DRY_RUN_ONLY');assert.equal(dry.writes.length,0);assert.equal(dry.stops,0);
 const f=fixture({retry:true}),refs=[...Object.values(PR54_CURRENT_B007_PRECUT_REFS),...Object.values(PR54_CURRENT_B007_PRECUT_RESUME_REFS),...Object.values(PR54_CURRENT_B007_PRECUT_RETRY_REFS)],old=refs.map(r=>[r.path,Buffer.from(f.files.get(r.path).bytes)]),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify(r));
 const pointer=path.win32.dirname(PR54_CURRENT_B007_PRECUT_RETRY_REFS.failureTail.path)+'\\resume-attempt.json';assert.equal(f.writes.filter(p=>p===pointer).length,1);assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH).length,0);for(const [p,b]of old)assert(f.files.get(p).bytes.equals(b));assert(f.files.get(pointer).bytes.equals(f.files.get(transition+'\\precut-continuation.json').bytes));
});
test('exact9d2 retry refuses prior attempt drift, advanced cut, consumed pointer and mixed flags before any stop',async()=>{
 for(const option of ['priorAttemptDrift','advancedRetry','usedRetry']){const f=fixture({retry:true,[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}));assert.equal(f.stops,0);assert.equal(f.writes.length,0);}
 for(const flag of ['precutResume','precutContinuation']){const f=fixture({retry:true});await assert.rejects(f.fn({...f.input,[flag]:true,mode:'Apply'}),/CONTINUATION_MODE/);assert.equal(f.stops,0);assert.equal(f.writes.length,0);}
});
test('exact9d2 retry NEW failure uses bound native recovery and immutable frozen rollback',async()=>{
 const f=fixture({retry:true,failNew:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify(r));assert(f.calls.includes('p03-pr54-current-b007-precut-new-recovery.ps1:Drain'));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH).length,0);
});
test('retained452 resume completes modeled handoff with unchanged claim and a single append-only attempt',async()=>{
 const f=fixture({resume:true}),refs=[...Object.values(PR54_CURRENT_B007_PRECUT_REFS),...Object.values(PR54_CURRENT_B007_PRECUT_RESUME_REFS)],old=refs.map(r=>[r.path,Buffer.from(f.files.get(r.path).bytes)]);
 const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify(r));
 assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH).length,0);
 const attempt=path.win32.dirname(PR54_CURRENT_B007_PRECUT_RESUME_REFS.failureTail.path)+'\\resume-attempt.json';assert.equal(f.writes.filter(p=>p===attempt).length,1);
 assert(f.files.get(attempt).bytes.equals(f.files.get(transition+'\\precut-continuation.json').bytes));
 for(const [p,b]of old)assert(f.files.get(p).bytes.equals(b));
 await assert.rejects(f.fn({...f.input,mode:'Apply'}),/RESUME_SCOPE_ADVANCED|RESUME_ALREADY_ATTEMPTED/);
});
test('retained452 dry-run is read-only and rejects advanced history, previous attempt and mixed modes before writes',async()=>{
 const f=fixture({resume:true}),r=await f.fn(f.input);assert.equal(r.status,'CURRENT_B007_DRY_RUN_ONLY');assert.equal(f.writes.length,0);assert.equal(f.stops,0);
 for(const option of ['advancedResume','usedResume','ownerDrift']){const bad=fixture({resume:true,[option]:true});await assert.rejects(bad.fn({...bad.input,mode:'Apply'}));assert.equal(bad.writes.length,0);assert.equal(bad.stops,0);}
 await assert.rejects(f.fn({...f.input,precutContinuation:true,mode:'Apply'}),/CONTINUATION_MODE/);
});
test('same per-guard full ACL and hash checks are batched within the native Windows argument limit without caching',async()=>{
 const f=fixture({resume:true});await f.fn(f.input);
 const programs=f.programs.filter(code=>code.includes('$pins=')&&code.includes('B264_IO_ACL'));assert(programs.length>0);
 let checked=0;for(const code of programs){const b64=code.match(/FromBase64String\('([^']+)'\)/)?.[1];assert(b64);const refs=JSON.parse(Buffer.from(b64,'base64'));assert(refs.length>0&&refs.length<=8);checked+=refs.length;assert(Buffer.from("$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;"+code,'utf16le').toString('base64').length<24000);assert(code.includes('GetAccessRules')&&code.includes('Get-FileHash'));}
 assert(checked>Object.keys(PR54_CURRENT_B007_PRECUT_RESUME_REFS).length*2);
});
test('retained452 resume keeps exact bound NEW recovery without a post-claim before-age gate',async()=>{
 const f=fixture({resume:true,failNew:true,expireAfterClaim:true}),r=await f.fn({...f.input,mode:'Apply'});
 assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify(r));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH).length,0);
});
test('finite Current continuation modeled DryRun retains consumed claim and writes nothing',async()=>{
 const f=fixture({continuation:true}),old=Buffer.from(f.files.get(PR54_CURRENT_B007_PRECUT_REFS.claim.path).bytes),r=await f.fn(f.input);
 assert.equal(r.status,'CURRENT_B007_DRY_RUN_ONLY');assert.equal(f.writes.length,0);assert.equal(f.stops,0);
 assert(f.files.get(PR54_CURRENT_B007_PRECUT_REFS.claim.path).bytes.equals(old));assert(!f.files.has(PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH));
});
test('finite Current continuation modeled handoff binds fresh context and never rewrites failed history',async()=>{
 const f=fixture({continuation:true}),old=Object.fromEntries(Object.values(PR54_CURRENT_B007_PRECUT_REFS).map(r=>[r.path,Buffer.from(f.files.get(r.path).bytes)]));
 const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify(r));assert.equal(r.humanAcceptance,'BEKLİYOR');
 assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH).length,1);assert(f.files.has(transition+'\\precut-continuation.json'));
 for(const [p,b]of Object.entries(old))assert(f.files.get(p).bytes.equals(b));
 assert(f.calls.includes('p03-pr54-current-b007-precut-cut.ps1:Drain'));await assert.rejects(f.fn({...f.input,mode:'Apply'}),/SUCCESSOR_ALREADY_CONSUMED/);
});
test('finite Current continuation refuses advanced history or rejected binding before claim or stop',async()=>{
 for(const option of ['advancedFailed','rejectContinuation']){const f=fixture({continuation:true,[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}));assert.equal(f.stops,0);assert.equal(f.writes.length,0);}
});
test('finite Current continuation modeled failed NEW uses bound recovery and frozen rollback',async()=>{
 const f=fixture({continuation:true,failNew:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify(r));
 assert(f.calls.includes('p03-pr54-current-b007-precut-new-recovery.ps1:Drain'));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));assert(!f.events.some(e=>e.event==='COMPLETE'));
});
test('finite continuation does not add a new before-age gate to already admitted NEW rollback',async()=>{
 const f=fixture({continuation:true,expireAfterClaim:true,failNew:true}),r=await f.fn({...f.input,mode:'Apply'});
 assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify(r));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));
});
test('CurrentB00721 pins the new capture LF bytes while historical Sup20D remains bound to7d1',()=>{const current=source.slice(source.indexOf('const currentB007SourcePins='),start),legacy=source.slice(source.indexOf('const b264Sup20dSourcePins='),source.indexOf('export async function runPr54B264Sup20dSharedOwnerTransition(')),capture=fs.readFileSync(new URL('./p03-current-invariance-capture.ps1',import.meta.url),'utf8').replaceAll('\r\n','\n');assert(current.includes(hash(capture)));assert(legacy.includes('7d1dab68e3f285ae7def2c9d3a7a30a6b7eeed715690c30e2bce5341b3c5faa4'));assert(!legacy.includes(hash(capture)));});
test('CurrentB007 modeled DryRun creates no claim and retains full package preflight',async()=>{const f=fixture(),r=await f.fn(f.input);assert.equal(r.status,'CURRENT_B007_DRY_RUN_ONLY');assert.equal(r.claimCreated,false);assert.equal(f.writes.length,0);assert.equal(f.stops,0);assert.equal(f.calls.filter(c=>c==='p03-physical-rollback-lifetime-v2.ps1:PreflightOld').length,1);});
test('CurrentB007 explicit21 capture reaches modeled DryRun but22 cannot create a claim or stop a process',async()=>{const f=fixture({captureDay:'20261021'}),r=await f.fn(f.input);assert.equal(r.status,'CURRENT_B007_DRY_RUN_ONLY');assert.equal(f.writes.length,0);assert.equal(f.stops,0);const future=fixture({captureDay:'20261022'});await assert.rejects(future.fn(future.input));assert.equal(future.writes.length,0);assert.equal(future.stops,0);});
test('CurrentB007 modeled full handoff uses unique claim, core-first stop and frozen V2 engine without changing old claim',async()=>{const f=fixture();const oldClaim=root+'\\p03-pr54-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json';f.files.set(oldClaim,{bytes:Buffer.from('CONSUMED'),ref:{path:oldClaim,sha256:hash('CONSUMED')}});const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify({r,diagnostic:JSON.parse(f.files.get(transition+'\\io-failure-diagnostic.json')?.bytes??'null')}));assert.equal(r.humanAcceptance,'BEKLİYOR');const claim=JSON.parse(f.files.get(claimPath).bytes);assert.equal(Object.keys(claim).length,20);assert.equal(claim.schemaVersion,'melisa-p03-current-b007-epoch-claim.v1');assert.equal(f.writes.filter(p=>p===claimPath).length,1);assert.equal(f.files.get(oldClaim).bytes.toString(),'CONSUMED');assert.equal(f.stops,8);assert.equal(f.events.at(-1).event,'COMPLETE');assert(f.calls.findIndex(c=>c.includes('old-owner-cut.ps1:Drain'))<f.calls.findIndex(c=>c.startsWith('MelisaERP-P03-stopper-')));assert.equal(f.calls.filter(c=>c.includes('new-owner-observe.ps1:Observe')).length,2);await assert.rejects(f.fn({...f.input,mode:'Apply'}),/SUCCESSOR_ALREADY_CONSUMED/);});
test('CurrentB007 wrong rehearsal, missing source, source payload, native preflight and owner drift reject before claim',async()=>{for(const option of ['wrongEngine','missingSource','payloadDrift','badPreflight','ownerDrift']){const f=fixture({[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}));assert.equal(f.writes.length,0);assert.equal(f.stops,0);}});
test('CurrentB007 binds only the real b33 rehearsal and rejects historical or crossed path/hash pairs before claim',async()=>{
 const old={path:String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-3f889527d9344b68adc1f2560f6eb8ef\result.json`,sha256:'12a941bf0fd6355588357481dc9eec41689f37f9b6e75f565502a10bd88d109f'};
 for(const variant of ['old','oldPath','oldHash']){
  const f=fixture(),current=f.input.rehearsalProofRef;
  const rehearsalProofRef=variant==='old'?old:variant==='oldPath'?{...current,path:old.path}:{...current,sha256:old.sha256};
  await assert.rejects(f.fn({...f.input,rehearsalProofRef,mode:'Apply'}),/CURRENT_B007_REHEARSAL_PATH/);
  assert.equal(f.writes.length,0);assert.equal(f.stops,0);
 }
});
test('CurrentB007 unverified OLD raw rows or unproven core cut never grant general recovery',async()=>{for(const option of ['foreignRaw','foreignOld','failCut']){const f=fixture({[option]:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(r.unprovenPartialRecoveryGranted,false);assert(!f.calls.some(c=>c==='p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));}});

test('CurrentB007 retains the first Drain failure without granting unproven recovery',async()=>{
 const f=fixture({failCut:true}),r=await f.fn({...f.input,mode:'Apply'});
 const failure={stage:'DRAIN',reason:'P03_CUT_UNPROVEN'};
 assert.deepEqual(r.failureDiagnostic,failure);
 assert.deepEqual(JSON.parse(f.files.get(transition+'\\io-failure-diagnostic.json').bytes).failureDiagnostic,failure);
 assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');
 assert.equal(r.failurePhase,'HELD_CORE_CUT');assert.equal(r.recoveryReason,'P03_SHARED_CURRENT_B007_PRESTART_CUT_UNPROVEN');
 assert.equal(r.unprovenPartialRecoveryGranted,false);assert.equal(f.stops,0);
 assert.equal(f.calls.filter(c=>c==='p03-pr54-b264-old-owner-cut.ps1:Drain').length,1);
 assert(!f.calls.some(c=>c.includes('new-owner-recovery.ps1:Drain')||c.includes('StopNew')||c.includes('RollbackOld')));
 assert(!f.writes.some(p=>p.endsWith('successor-core-cut-completed.json')||p.endsWith('successor-core-probe-drain.json')));
});

test('CurrentB007 preserves the bounded native B264 code without exposing PowerShell stderr',async()=>{
 const marker='PRIVATE_STDERR_SENTINEL';
 for(const code of ['P03_PHYSICAL_B264_CUT_OWNER_FRESH','P03_PHYSICAL_CURRENT_CONTINUATION_SNAPSHOT_FRESH','P03_B264_CUT_SCOPE','B264_SOURCE_HASH',null]){
  const error=Object.assign(Error('child failed '+marker),{stderr:'PowerShell error: '+(code??'unclassified '+marker)+'\n'+marker});
  const f=fixture({cutError:error}),r=await f.fn({...f.input,mode:'Apply'});
  const expected=code??'UNCLASSIFIED_IO_FAILURE';
  assert.deepEqual(r.failureDiagnostic,{stage:'DRAIN',reason:expected});
  const diagnostic=JSON.parse(f.files.get(transition+'\\io-failure-diagnostic.json').bytes);
  assert.deepEqual(diagnostic.failureDiagnostic,r.failureDiagnostic);
  assert(!JSON.stringify({r,diagnostic}).includes(marker));assert.equal(f.stops,0);
  assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(r.unprovenPartialRecoveryGranted,false);
 }
});
test('CurrentB007 failed NEW readback uses exact drain, zero candidate and genuine frozen tail',async()=>{const f=fixture({failNew:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY');assert(f.calls.includes('p03-pr54-b264-new-owner-recovery.ps1:Drain'));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:StopNew'));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));assert(!f.events.some(e=>e.event==='COMPLETE'));});
test('CurrentB007 unproven NEW partial or failed OLD readback remains quarantined',async()=>{for(const extra of ['unprovenPartial','failRollback']){const f=fixture({failNew:true,[extra]:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(r.unprovenPartialRecoveryGranted,false);assert(!f.events.some(e=>e.event==='COMPLETE'));}});
test('CurrentB007 source/table drift cannot be marked COMPLETE',async()=>{const f=fixture({sqlDrift:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY');assert(!f.events.some(e=>e.event==='COMPLETE'));});
test('CurrentB007 dispatcher is finite, seven-package and same reviewed engine with no public override',()=>{assert.match(body,/profile.packages.length===7/);assert.match(body,/runP03HeldCoreOwnerTransition\(callbacks\)/);assert.match(body,/CurrentB007InspectOnly/);assert.match(body,/CurrentB007ObserveOnly/);assert.doesNotMatch(body,/runPr54SharedOwnerTransition\(|stopTasks:|'CandidateProposal'|'CURRENT_B007_RAW'/);assert.equal(Object.keys(pins).length,7);});

test('CurrentB007 persistent protected console survives post-cut raw coverage and empty-owned test without becoming a stop target',async()=>{const f=fixture({protectedConsole:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify({r,diagnostic:JSON.parse(f.files.get(transition+'\\io-failure-diagnostic.json')?.bytes??'null')}));assert.equal(f.stops,8);assert.equal(f.events.at(-1).event,'COMPLETE');});

test('CurrentB007 post-cut readonly witness rejects live child or protected-parent identity drift without stopping either',async()=>{for(const option of ['protectedDrift','protectedParentDrift']){const f=fixture({protectedConsole:true,[option]:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(r.unprovenPartialRecoveryGranted,false);assert.equal(f.stops,1);assert(!f.events.some(e=>e.event==='COMPLETE'));}});

test('postCAS42d0 DryRun executes exact zero-candidate prerequisites without writes or a second drain',async()=>{
 const f=fixture({postcas:true}),original=new Map([...f.files].map(([p,v])=>[p,Buffer.from(v.bytes)])),r=await f.fn(f.input);
 assert.equal(r.status,'CURRENT_B007_POSTCAS_RECOVERY_DRY_RUN');assert.equal(r.remainingOldRoles,0);assert.equal(f.writes.length,0);assert.equal(f.stops,0);assert(f.calls.some(c=>c.endsWith(':ResumeDrainCheck')));assert(f.calls.filter(c=>c==='p03-physical-recovery-observe.ps1:').length>=3);assert(!f.calls.some(c=>c.endsWith(':ResumeDrain')||c.endsWith(':ResumeDrainDryRun')||c.endsWith(':StopNew')));for(const [p,b]of original)assert(f.files.get(p).bytes.equals(b));
});

test('postCAS42d0 read-only zero proof rejects OLD role, task, action, listener or COM drift in the second physical frame',async()=>{
 for(const option of ['postcasSecondFrameRole','postcasSecondFrameTask','postcasSecondFrameAction','postcasSecondFrameListener','postcasSecondFrameInstance']){const f=fixture({postcas:true,[option]:true});await assert.rejects(f.fn(f.input),/POSTCAS_NOT_ZERO|OLD_TASK_FRAME|FOREIGN_LISTENER/,option);assert.equal(f.writes.length,0,option);assert.equal(f.stops,0,option);assert(!f.calls.some(c=>c.endsWith(':StopNew')),option);}
});

test('postCAS42d0 uses a distinct one-shot intent, keeps original recovery proof and restores OLD only',async()=>{
 const f=fixture({postcas:true}),original=new Map([...f.files].map(([p,v])=>[p,Buffer.from(v.bytes)])),r=await f.fn({...f.input,mode:'Apply'});
 assert.equal(r.status,'RECOVERED_OLD_READY',JSON.stringify(r));assert.equal(r.newGenerationStarted,false);assert.equal(f.stops,0);assert.equal(f.calls.filter(c=>c.endsWith(':StopNew')).length,1);assert.equal(f.calls.filter(c=>c.endsWith(':RollbackOld')).length,1);assert(!f.calls.some(c=>c.endsWith(':ResumeDrain')||c.endsWith(':ResumeDrainDryRun')));assert(!f.programs.some(p=>p.includes('RegisterTask(')||p.includes("'STARTED'")));for(const [p,b]of original)assert(f.files.get(p).bytes.equals(b));assert.equal(f.writes.filter(p=>p.endsWith('completed-cut-postcas-recovery-intent.json')).length,1);assert.equal(f.writes.filter(p=>p.endsWith('completed-cut-postcas-recovery-result.json')).length,1);await assert.rejects(f.fn({...f.input,mode:'Apply'}),/ALREADY_ATTEMPTED|COMPLETED_CUT_SCOPE/);
});

test('postCAS42d0 refuses stale scope, old actions, live roles, advanced journals and wrong stop evidence before writing',async()=>{
 for(const option of ['postcasOldAction','postcasRunning','postcasLiveRole','postcasUsed','postcasJournal','postcasWrongStop','postcasWrongResult','postcasChangedPin','recoveryDbDrift','rejectRecoveryCheck','recoveryAdvanced']){const f=fixture({postcas:true,[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}),undefined,option);assert.equal(f.writes.length,0,option);assert.equal(f.stops,0,option);assert(!f.calls.some(c=>c.endsWith(':StopNew')),option);}
 const f=fixture({postcas:true});await assert.rejects(f.fn({...f.input,resumeCompletedCut42d0:false}),/POSTCAS_MODE/);assert.equal(f.writes.length,0);
 const missing=fixture({postcas:true});missing.files.delete(root+'\\MelisaERP-P03-transition-42d0d0536cb115cc4aea43ff1f13afbf\\completed-cut-recovery-stop-hub-result.json');await assert.rejects(missing.fn({...missing.input,mode:'Apply'}));assert.equal(missing.writes.length,0);
});

test('postCAS42d0 error diagnostics ignore echoed guard literals and retain bounded transport metadata',async()=>{
 const secret='PRIVATE_COMMAND_PAYLOAD',error=Object.assign(Error("Command failed: "+secret+";throw 'B264_SOURCE_ACL';throw 'P03_PHYSICAL_FAKE'"),{code:'ETIMEDOUT',killed:true,signal:'SIGTERM',stderr:secret+";throw 'B264_SOURCE_ACL'"}),f=fixture({postcas:true,postcasWorkerError:error}),r=await f.fn({...f.input,mode:'Apply'});
 assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(r.recoveryReason,'P03_SHARED_CURRENT_B007_WORKER_INTERRUPTED');assert.deepEqual(Object.keys(r.workerDiagnostic).sort(),['action','elapsedMs','errno','exitCode','killed','signal','stderrSha256','workerLeaf'].sort());assert.equal(r.workerDiagnostic.workerLeaf,'p03-physical-rollback-lifetime-v2.ps1');assert.equal(r.workerDiagnostic.action,'StopNew');assert.equal(r.workerDiagnostic.errno,'ETIMEDOUT');assert.equal(r.workerDiagnostic.killed,true);assert.equal(r.workerDiagnostic.stderrSha256,hash(Buffer.from(error.stderr)));assert(!JSON.stringify(r).includes(secret));assert(!f.writes.some(p=>p.endsWith('completed-cut-recovery-result.json')));await assert.rejects(f.fn({...f.input,mode:'Apply'}));
 const echoed=Object.assign(Error("Command failed: throw 'B264_SOURCE_ACL';throw 'P03_PHYSICAL_FAKE'"),{code:'ETIMEDOUT',stderr:"At line:1 char:1\n+throw 'B264_SOURCE_ACL';throw 'P03_PHYSICAL_FAKE'"}),other=fixture({postcas:true,postcasWorkerError:echoed}),rejected=await other.fn({...other.input,mode:'Apply'});assert.equal(rejected.recoveryReason,'ETIMEDOUT');assert.equal(rejected.workerDiagnostic.killed,false);assert.equal(rejected.workerDiagnostic.errno,'ETIMEDOUT');
});

test('completed42d0 native reference key order is irrelevant while exact shape path and hash remain mandatory',async()=>{for(const mode of ['DryRun','Apply']){const f=fixture({recovery:true,recoveryReverseRefs:true}),r=await f.fn({...f.input,mode});assert.equal(r.status,mode==='DryRun'?'CURRENT_B007_COMPLETED_CUT_RECOVERY_DRY_RUN':'RECOVERED_OLD_READY');}for(const recoveryWrongRef of ['hash','path','extra','missing']){const f=fixture({recovery:true,recoveryWrongRef});await assert.rejects(f.fn({...f.input,mode:'Apply'}),/COMPLETED_CUT_FRESH/);assert.equal(f.writes.length,0);assert.equal(f.stops,0);}});

test('completed42d0 Check rejects altered drain references after the one intent without invoking rollback',async()=>{for(const recoveryWrongDrain of ['hash','path','extra','missing']){const f=fixture({recovery:true,recoveryWrongDrain}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert(f.writes.some(p=>p.endsWith('completed-cut-recovery-intent.json')));assert(!f.calls.some(c=>c.endsWith(':RollbackOld')));}});

test('fresh owner epoch keeps consumed legacy claim and makes one deterministic CreateNew generation slot after real admission',async()=>{
 const f=fixture({fresh:true}),legacy=Buffer.from('consumed immutable legacy');f.files.set(claimPath,{bytes:legacy,ref:{path:claimPath,sha256:hash(legacy)}});
 const dry=await f.fn(f.input);assert.equal(dry.status,'CURRENT_B007_DRY_RUN_ONLY');assert.equal(dry.generationClaimPath,root+'\\p03-pr54-current-b007-generation-'+ 'd'.repeat(64)+'.lock.json');assert.equal(f.writes.length,0);assert.equal(f.stops,0);assert(f.files.get(claimPath).bytes.equals(legacy));
 const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE');assert(f.writes.includes(dry.generationClaimPath));assert(f.files.get(claimPath).bytes.equals(legacy));
 const again=fixture({fresh:true});again.files.set(dry.generationClaimPath,{bytes:Buffer.from('consumed')});await assert.rejects(again.fn({...again.input,mode:'Apply'}),/ALREADY_CONSUMED/);assert.equal(again.writes.length,0);assert.equal(again.stops,0);
});

test('fresh owner generation cannot mix historical resume flags or use a changed second physical owner',async()=>{
 for(const flag of ['precutContinuation','precutResume','precutResumeAfter9d2','resumeCompletedCut42d0','resumeCompletedCut42d0PostCas','resumeFailedStopNew42d0']){const f=fixture({fresh:true});await assert.rejects(f.fn({...f.input,[flag]:true}),/FRESH_GENERATION_MODE/);assert.equal(f.writes.length,0);assert.equal(f.stops,0);}
 const changed=fixture({fresh:true,ownerDrift:true});await assert.rejects(changed.fn({...changed.input,mode:'Apply'}),/ADMISSION_DRIFT/);assert.equal(changed.writes.length,0);assert.equal(changed.stops,0);
});

test('fresh generation late OLD recovery observes the already-started tasks once and retains the original failed journal',async()=>{
 const f=fixture({fresh:true,failNew:true,lateRollback:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify({r,calls:f.calls}));assert.equal(f.calls.filter(c=>c.endsWith(':RollbackOld')).length,1);assert.equal(f.calls.filter(c=>c.endsWith(':ObserveStartedOld')).length,1);assert(!f.calls.some(c=>c.endsWith(':FinalizeOld42d0Apply')));
 const record=JSON.parse(f.files.get(transition+'\\rollback-result.json').bytes);assert.equal(record.originalReadbackFailure.code,'P03_PHYSICAL_ROLLBACK_READBACK_FAILED');assert.equal(record.restored.status,'OLD_READY_LATE_OBSERVED');assert.equal(record.restored.startExecuted,false);assert(!f.writes.some(p=>p.includes('MelisaERP-P03-recovery-')&&p.endsWith('event-0007.json')));assert(f.files.has(transition+'\\late-old-readback.json'));
});

test('late OLD reader cannot turn identity errors, native refusal or insufficient stability into rollback success',async()=>{
 for(const option of ['lateOtherFailure','lateNativeFailure','lateShortProof']){const f=fixture({fresh:true,failNew:true,lateRollback:true,[option]:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION',option);assert.equal(f.calls.filter(c=>c.endsWith(':RollbackOld')).length,1);assert.equal(f.calls.filter(c=>c.endsWith(':ObserveStartedOld')).length,option==='lateOtherFailure'?0:1);assert(!f.files.has(transition+'\\rollback-result.json'));}
});

test('failed StopNew42d0 finalization uses only the separately pinned existing native phase',async()=>{
 for(const mode of ['DryRun','Apply']){const f=fixture({finalize:true}),original=new Map([...f.files].map(([p,v])=>[p,Buffer.from(v.bytes)])),r=await f.fn({...f.input,mode});assert.equal(r.status,mode==='Apply'?'B264_COMPLETED42_OLD_RESTORED_READY':'B264_COMPLETED42_FINALIZE_OLD_DRY_RUN');assert.equal(r.applyExecuted,mode==='Apply');assert.equal(r.newGenerationStarted,false);assert.equal(r.humanAcceptance,'BEKLİYOR');assert.equal(f.calls.length,1);assert.equal(f.calls[0],'p03-pr54-current-b007-precut-cut.ps1:'+ (mode==='Apply'?'FinalizeOld42d0Apply':'FinalizeOld42d0Inspect'));assert.equal(f.writes.length,0);assert.equal(f.stops,0);for(const[p,b]of original)assert(f.files.get(p).bytes.equals(b));}
});

test('failed StopNew42d0 finalization refuses crossed flags and worker refs before native invocation',async()=>{
 for(const alter of [x=>x.resumeCompletedCut42d0=false,x=>x.resumeCompletedCut42d0PostCas=false,x=>x.finalRestoreWorkerRef=null,x=>x.finalRestoreWorkerRef={...x.finalRestoreWorkerRef,sha256:'0'.repeat(64)},x=>x.finalRestoreWorkerRef={...x.finalRestoreWorkerRef,path:x.finalRestoreWorkerRef.path+'.wrong'},x=>x.sourceControlDir=control]){const f=fixture({finalize:true});alter(f.input);await assert.rejects(f.fn({...f.input,mode:'Apply'}));assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);assert.equal(f.stops,0);}
});

test('failed StopNew42d0 finalization refuses DB drift or unproven native results without fallback recovery',async()=>{
 for(const option of ['recoveryDbDrift','finalizeWrongStatus','finalizeWrongGeneration','finalizeNativeError','finalizeShortProof']){const f=fixture({finalize:true,[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}),undefined,option);assert.equal(f.calls.length,option==='recoveryDbDrift'?0:1);assert.equal(f.writes.length,0);assert.equal(f.stops,0);assert(!f.calls.some(c=>c.endsWith(':StopNew')||c.endsWith(':RollbackOld')||c.endsWith(':ResumeDrain')));}
});


test('CurrentB007 whole held-cut Inspect recaptures exact CIM NotFound without replaying Drain',async()=>{
 const failure=()=>Object.assign(Error('Command failed: dormant P03_FALSE_LITERAL'),{stderr:'FullyQualifiedErrorId : HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand\r\n'});
 const f=fixture({inspectErrors:[failure(),failure()]});
 const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE');
 assert.equal(f.calls.filter(c=>c==='p03-pr54-b264-old-owner-cut.ps1:Inspect').length,3);
 assert.equal(f.calls.filter(c=>c==='p03-pr54-b264-old-owner-cut.ps1:Drain').length,1);
});

test('CurrentB007 exhausted or permanent held-cut Inspect cannot stop or recover any process',async()=>{
 for(const [nativeId,count,reason] of [
  ['HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand',3,'P03_OBSERVER_CIM_OBJECT_NOT_FOUND'],
  ['HRESULT 0x80041003,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand',1,'UNCLASSIFIED_IO_FAILURE'],
  ['HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.GetCimInstanceCommand',1,'UNCLASSIFIED_IO_FAILURE']
 ]){
  const make=()=>Object.assign(Error('child failed PRIVATE_SENTINEL'),{stderr:'FullyQualifiedErrorId : '+nativeId+'\r\n'});
  const f=fixture({inspectErrors:Array.from({length:3},make)});const r=await f.fn({...f.input,mode:'Apply'});
  assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');
  assert.deepEqual(r.failureDiagnostic,{stage:'INSPECT',reason});assert.equal(f.stops,0);
  assert.equal(f.calls.filter(c=>c==='p03-pr54-b264-old-owner-cut.ps1:Inspect').length,count);
  assert(!f.calls.some(c=>c.includes(':Drain')||c.includes('RollbackOld')||c.includes('StopNew')));
  assert(!JSON.stringify(r).includes('PRIVATE_SENTINEL'));
 }
});


test('974d bound DryRun requires two native admissions and actual held-cut Inspect with zero writes',async()=>{
 const f=fixture({cont974d:true});const retained=Buffer.from(f.files.get(PR54_CURRENT_B007_PRECUT974D_REFS.claim.path).bytes);
 const r=await f.fn(f.input);assert.equal(r.status,'CURRENT_B007_DRY_RUN_ONLY');assert.equal(f.writes.length,0);assert.equal(f.stops,0);
 assert.equal(f.calls.filter(c=>c==='p03-physical-rollback-lifetime-v2.ps1:PreflightOld').length,2);
 assert.equal(f.calls.filter(c=>c==='p03-pr54-b264-old-owner-cut.ps1:Inspect').length,1);assert(retained.equals(f.files.get(PR54_CURRENT_B007_PRECUT974D_REFS.claim.path).bytes));
});

test('974d guarded Apply consumes only its exact continuation slot once and preserves prior history',async()=>{
 const f=fixture({cont974d:true}),old=Object.fromEntries(Object.values(PR54_CURRENT_B007_PRECUT974D_REFS).map(r=>[r.path,Buffer.from(f.files.get(r.path).bytes)]));
 const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify(r));assert.equal(r.humanAcceptance,'BEKLİYOR');
 assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH).length,1);assert(f.files.has(transition+'\\precut-continuation.json'));
 for(const [p,b] of Object.entries(old))assert(b.equals(f.files.get(p).bytes));
 await assert.rejects(f.fn({...f.input,mode:'Apply'}));
});

test('974d advanced scope journal retained owner mismatch and changed second admission fail closed',async()=>{
 for(const option of ['advanced974d','journal974d','journal974dLink','reject974d','retained974dDrift','ownerDrift']){
  const f=fixture({cont974d:true,[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}));assert.equal(f.writes.length,0);assert.equal(f.stops,0);
 }
});

test('974d failed NEW uses the existing exact StopNew and frozen RollbackOld path',async()=>{
 const f=fixture({cont974d:true,failNew:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify(r));
 assert(f.calls.includes('p03-pr54-b264-new-owner-recovery.ps1:Drain'));assert(f.calls.includes('p03-physical-rollback-lifetime-v2.ps1:RollbackOld'));assert(!f.events.some(e=>e.event==='COMPLETE'));
});


test('974d late OLD observation preserves frozen failure without replay or a new recovery age gate',async()=>{
 const f=fixture({cont974d:true,failNew:true,lateRollback:true,expireAfterClaim:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify(r));assert.equal(f.calls.filter(c=>c.endsWith(':RollbackOld')).length,1);assert.equal(f.calls.filter(c=>c.endsWith(':ObserveStartedOld')).length,1);
 for(const option of ['lateOtherFailure','lateNativeFailure','lateShortProof']){const bad=fixture({cont974d:true,failNew:true,lateRollback:true,[option]:true}),v=await bad.fn({...bad.input,mode:'Apply'});assert.equal(v.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION');assert.equal(bad.calls.filter(c=>c.endsWith(':RollbackOld')).length,1);}
});

test('974d parallel attempts cannot consume the continuation pointer twice',async()=>{
 const f=fixture({cont974d:true});const results=await Promise.allSettled([f.fn({...f.input,mode:'Apply'}),f.fn({...f.input,mode:'Apply'})]);assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH).length,1);assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.status==='COMPLETE').length,1);assert.equal(f.stops,8);
});


test('B142 stages actual held Inspect before two admissions and DryRun never writes',async()=>{
 const f=fixture({b142:true});const r=await f.fn(f.input);assert.equal(r.precutB142NativeCheck,true);assert.equal(r.retainedFailureRunId,'b14266ad30507bb10d78ae76e2546221');assert.equal(f.writes.length,0);assert.equal(f.stops,0);assert.equal(f.calls.filter(x=>x==='ADMISSION').length,2);assert(f.calls.findIndex(x=>x.endsWith(':Inspect'))<f.calls.indexOf('ADMISSION'));
});
test('B142 Apply uses final same-capture frame without a postclaim Inspect and preserves immutable history',async()=>{
 const f=fixture({b142:true});const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify(r));assert.equal(f.stops,8);assert.equal(f.calls.filter(x=>x.endsWith(':Inspect')).length,1);assert.equal(f.calls.filter(x=>x==='ADMISSION').length,2);assert.equal(f.writes.filter(x=>x===PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).length,1);assert(f.writes.indexOf(transition+'\\successor-precut-admission.json')<f.writes.indexOf(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH));assert(f.files.has(transition+'\\transition.lock'));const frame=JSON.parse(f.files.get(transition+'\\successor-precut-admission.json').bytes);assert.equal(frame.schemaVersion,'melisa-p03-successor-precut-admission.v1');for(const k of ['policyGeneration','transitionAuthority','stopAuthority','applyExecuted','protectedProcesses'])assert(!Object.hasOwn(frame,k));assert.deepEqual(frame.protectedConsolePins,[]);
});
test('B142 rejects changed final UID, COM digest and stale original capture without creating a claim or stopping',async()=>{
 for(const option of ['frameUid','frameCom','staleFrame']){const f=fixture({b142:true,[option]:true});await assert.rejects(f.fn({...f.input,mode:'Apply'}));assert(!f.files.has(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH));assert.equal(f.stops,0);}
});

test('B142 slow staging finishes before the fresh admission clock and retains full postclaim ACL checks',async()=>{
 const f=fixture({b142:true,slowStage:true,staggerFrame:true,reorderedBindings:true});const began=f.clock;const r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'COMPLETE',JSON.stringify(r));assert(f.clock-began>60000);const claim=JSON.parse(f.files.get(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).bytes),frame=JSON.parse(f.files.get(transition+'\\successor-precut-admission.json').bytes);assert.equal(Date.parse(frame.observedAt)-Date.parse(claim.ownerObservedAt),50);assert.equal(Date.parse(frame.observedAt),f.clock);assert.equal(f.calls.filter(x=>x.endsWith(':Inspect')).length,1);const allBatches=f.programs.filter(p=>p.includes('GetAccessRules')).map(p=>JSON.parse(Buffer.from(p.match(/FromBase64String\('([^']+)'\)/)[1],'base64').toString()));assert(allBatches.some(x=>x.length>8));
 const bad=fixture({b142:true,aclAfterClaim:true});const stopped=await bad.fn({...bad.input,mode:'Apply'});assert.equal(stopped.status,'STOPPED_BEFORE_DRAIN');assert.equal(stopped.drainInvoked,false);assert.equal(stopped.failureDiagnostic.stage,'CLAIM_READBACK');assert.equal(bad.stops,0);assert.equal(bad.writes.filter(x=>x===PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).length,1);
});
test('B142 pointer races cannot write twice and Drain failure never causes a new admission or Inspect replay',async()=>{
 const f=fixture({b142:true});const both=await Promise.allSettled([f.fn({...f.input,mode:'Apply'}),f.fn({...f.input,mode:'Apply'})]);assert.equal(f.writes.filter(x=>x===PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).length,1);assert.equal(both.filter(x=>x.status==='fulfilled'&&x.value.status==='COMPLETE').length,1);assert.equal(f.stops,8);
 const bad=fixture({b142:true,cutError:Error('P03_PHYSICAL_CLAIM_EPOCH')});const r=await bad.fn({...bad.input,mode:'Apply'});assert.notEqual(r.status,'COMPLETE');assert.equal(bad.calls.filter(x=>x==='ADMISSION').length,2);assert.equal(bad.calls.filter(x=>x.endsWith(':Inspect')).length,1);assert.equal(bad.calls.filter(x=>x.endsWith(':Drain')).length,1);assert.equal(bad.writes.filter(x=>x===PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).length,1);
});

test('B142 accounts for all postclaim guard and persistence costs without refreshing clocks or retrying expired proof',async()=>{
 const fast=fixture({b142:true,postclaimCost:2});const ok=await fast.fn({...fast.input,mode:'Apply'});assert.equal(ok.status,'COMPLETE');const claim=JSON.parse(fast.files.get(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).bytes);assert(fast.clock-Date.parse(claim.ownerObservedAt)>0);assert(fast.clock-Date.parse(claim.ownerObservedAt)<60000);
 const slow=fixture({b142:true,postclaimCost:10000});const bad=await slow.fn({...slow.input,mode:'Apply'});assert.notEqual(bad.status,'COMPLETE');assert.equal(slow.stops,0);assert.equal(slow.calls.filter(x=>x==='ADMISSION').length,2);assert.equal(slow.calls.filter(x=>x.endsWith(':Inspect')).length,1);assert.equal(slow.writes.filter(x=>x===PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).length,1);
});

test('B142 postclaim preparation returns bounded evidence without deleting a consumed claim or invoking Drain',async()=>{
 for(const option of ['aclAfterClaim','failLock','failClaimReply']){const f=fixture({b142:true,[option]:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'STOPPED_BEFORE_DRAIN');assert.equal(r.claimPointerPresent,true);assert.equal(r.applyExecuted,false);assert.equal(r.drainInvoked,false);assert.equal(r.diagnosticPersisted,true);assert.equal(f.stops,0);assert(!f.calls.some(c=>c.endsWith(':Drain')));assert.equal(f.writes.filter(p=>p===PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH).length,1);}
 const f=fixture({b142:true,failLock:true,failDiagnostic:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'STOPPED_BEFORE_DRAIN');assert.equal(r.diagnosticPersisted,false);assert.equal(r.claimPointerPresent,true);assert.equal(f.stops,0);
});
test('B142 successful closed native child plus complete linked disk proof recovers after JSON reply loss without repeating Drain',async()=>{
 const f=fixture({b142:true,diskReplyLoss:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'FAILED_ROLLED_BACK_OLD_READY',JSON.stringify(r));assert.equal(f.calls.filter(c=>c.endsWith(':Drain')).length,1);assert.equal(f.calls.filter(c=>c.endsWith(':StopNew')).length,1);assert.equal(f.calls.filter(c=>c.endsWith(':RollbackOld')).length,1);assert.equal(f.stops,8);assert.equal(f.calls.filter(c=>c==='ADMISSION').length,2);
});
test('B142 malformed disk links, COM, foreign process, torn witness and unknown or killed child never grant recovery mutation',async()=>{
 for(const option of ['diskBadCom','diskBadClaim','diskBadProfile','diskBadRoot','diskBadWindow','diskNewActions','diskTorn','diskHalfCom','diskForeign','diskRejectedChild','diskKilled']){const f=fixture({b142:true,diskReplyLoss:true,[option]:true}),r=await f.fn({...f.input,mode:'Apply'});assert.equal(r.status,'QUARANTINED_REQUIRES_ROOT_INSPECTION',option+JSON.stringify(r));assert.equal(f.calls.filter(c=>c.endsWith(':Drain')).length,1);assert(!f.calls.some(c=>c.endsWith(':StopNew')||c.endsWith(':RollbackOld')));assert.equal(f.stops,1);}
});

// Explicit SQL-free native bridge fixtures. No OS/task/SQL/runtime execution.
function currentRehearsalFixture(options={}){
 const body=source.slice(source.indexOf('export async function runPr54CurrentB142RehearsalTransition(')).replace(/^export /,'');
 const root=String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-${'a'.repeat(32)}`,files=new Map(),calls=[],writes=[],events=[],programs=[];
 const rows=targets.map((role,i)=>({role,pid:100+i,parentPid:107,nodePath:'node',ownerSid:owner,commandLine:'node '+role,creationTime:'2026-10-21T00:00:00.0000000Z',bindings:[]}));
 const watchers=['terminalWatcher','hubWatcher'].map((role,i)=>({...rows[0],role,pid:200+i,commandLine:role}));
 const taskNames=['Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub'];
 const put=(leaf,value)=>{const ref={path:root+'\\'+leaf,sha256:hash(bytes(value))};files.set(ref.path,{ref,value});return ref;};
 const plan={targets,oldSettingsSha256:'1'.repeat(64),newSettingsSha256:'2'.repeat(64)};plan.digest=p03TransitionDigest(plan);
 const before={runId:'a'.repeat(32),environment:'P03_REHEARSAL',database:'MELISA_ERP_P03_RESTORE_TEST_20261018_01',copyId:'P03-RECOVERY-REHEARSAL-20261018',actualT1:false,identities:Object.fromEntries(rows.map(x=>[x.role,x])),plan};
 const nativePins=Object.fromEntries(['observer','drainer','oldCut','recovery','engine','helper','empty'].map(k=>[k,[k+'.ps1',hash(k)]]));
 for(const [k,[leaf,sha256]]of Object.entries(nativePins))files.set(root+'\\'+leaf,{ref:{path:root+'\\'+leaf,sha256},value:k});
 const xml=(g,i)=>g+i+(options.large?'X'.repeat(16000):'');if(options.large)before.transportPadding='b'.repeat(19000);
 const stopper=put('stopper.ps1','stopper'),profile={environment:'P03_REHEARSAL',database:before.database,tasks:taskNames.map((name,i)=>({name,oldXml:xml('old',i),newXml:xml('new',i),oldXmlSha256:hash(xml('old',i)),newXmlSha256:hash(xml('new',i))})),stopper,newSettings:{path:root+'\\settings-new.json',sha256:plan.newSettingsSha256},journalDirectory:root+'\\recovery'};
 const startup={schemaVersion:'melisa-p03-current-b142-fixture-startup.v1',scenario:options.scenario??'Normal',generation:'new',childRoles:options.scenario==='PartialNew'?['erpNative']:['erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer']};if(options.badStartup)startup.scenario='PartialNew';
 const cfgRef=put('fixture-config.json',{generation:'new',partial:true,startup}),settingsRef=put('settings-new.json',{supervisor:{config:cfgRef}});profile.newSettings=settingsRef;
 const beforeRef=put('before.json',before),profileRef=put('profile.json',profile);
 let processRows=[...rows,...watchers],instances=taskNames.map((name,i)=>({name,pid:200+i,guid:'g'+i})),actions=['old','old'],activeGeneration='old',stopCalls=0,drainCalls=0,recoverCalls=0,clock=Date.now();
 class D extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
 const stamp=()=>new D().toISOString();
 function read(ref){const entry=files.get(ref.path);assert(entry,'unknown ref '+ref.path);assert.equal(entry.ref.sha256,ref.sha256);return entry.value;}
 function pin(ref){return bytes(read(ref));}
 function state(){return {processes:processRows,instances,tasks:taskNames.map((name,i)=>({name,state:instances.some(x=>x.name===name)?4:3,sha256:profile.tasks[i][actions[i]+'XmlSha256']})),listeners:processRows.filter(x=>targets.includes(x.role)&&x.role!=='coreSupervisor').map((x,i)=>({pid:x.pid,port:4284+i,address:'127.0.0.1'}))};}
 const makeFrame=()=>({schemaVersion:'melisa-p03-successor-precut-admission.v1',environment:'P03_REHEARSAL',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,oldIdentities:rows,oldWatchers:watchers,consolePins:[],probePins:[],observedAt:stamp()});
 const arg=(a,n)=>a[a.indexOf(n)+1];
 async function nativeRun(_shell,invocation){const {ref,args}=invocation;calls.push([ref.path,args]);const leaf=path.win32.basename(ref.path),mode=arg(args,'-Mode');
  if(leaf==='engine.ps1'){
   if(mode==='PreflightOld'){
    if(options.preflightError)throw options.preflightError;
    if(options.preflightStderr)return {stderr:options.preflightStderr,stdout:'PRIVATE_SENTINEL'};
    if(options.preflightJson)return {stderr:'',stdout:'PRIVATE_SENTINEL invalid json'};
    return {stderr:'',stdout:JSON.stringify({status:'OLD_PHYSICAL_PREFLIGHT',environment:'Rehearsal',mutationExecuted:false})};
   }
   if(mode==='StopNew'){actions=['old','old'];put('recovery\\event-0000.json',{event:'RECOVERED'});return {stderr:'',stdout:JSON.stringify({status:'RECOVERED_OLD_ACTIONS'})};}
   if(mode==='RollbackOld'){processRows=[...rows,...watchers].map(x=>({...x,pid:x.pid+1000}));instances=taskNames.map((name,i)=>({name,pid:1200+i,guid:'restored'+i}));return {stderr:'',stdout:JSON.stringify({status:'RESTORED_READY'})};}
  }
  if(leaf==='oldCut.ps1'){
   if(mode==='Inspect')return {stderr:'',stdout:JSON.stringify(makeFrame())};drainCalls++;
   if(options.nativeUnknown)throw Error('UNKNOWN_NATIVE_CHILD');
   if(options.nativeCutError)throw options.nativeCutError;
   processRows=processRows.filter(x=>x.role!=='coreSupervisor'&&!x.role.endsWith('Watcher'));instances=[];
   const claimRef=files.get(root+'\\rehearsal-claim.json').ref,snapshotRef=files.get(root+'\\successor-precut-admission.json').ref,intentRef=files.get(root+'\\b264-old-owner-cut-intent.json').ref;
   const held=put('b264-old-owner-held-cut-intent.json',{claimSha256:claimRef.sha256,rootIntentSha256:intentRef.sha256,admittedSnapshotSha256:snapshotRef.sha256});
   const cutWitness=put('successor-core-cut-completed.json',{event:'B264_OLD_OWNER_CORE_CUT_COMPLETED',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,claimSha256:claimRef.sha256,durableIntent:held,mechanism:'COM_STOP_NATURAL_EXIT',heldProcessHandle:true,processAbsent:true,core:rows.find(x=>x.role==='coreSupervisor')});
   const drainWitness=put('successor-core-probe-drain.json',{event:'B264_OLD_OWNER_CORE_PROBES_ABSENT',cutWitness,consolePins:[],probePins:[]});if(options.tornWitness)files.get(drainWitness.path).value.cutWitness={...cutWitness,sha256:'f'.repeat(64)};
   return {stderr:'',stdout:JSON.stringify({status:'B264_OLD_OWNER_CORE_DRAINED',coreStopResult:'COM_STOP_NATURAL_EXIT',heldCoreExited:true,comStopped:true,cutWitness,drainWitness})};
  }
  if(leaf==='observer.ps1')return {stderr:'',stdout:JSON.stringify({schemaVersion:'melisa-p03-current-b007-same-capture.v1',current:{environment:'Rehearsal',observedAt:stamp(),runningInstances:instances.map(x=>({name:x.name,enginePid:x.pid,instanceGuid:x.guid}))},frame:{...makeFrame(),policyGeneration:options.badReadOnlyCapture?'Shared':'CurrentB142Rehearsal',transitionAuthority:false,stopAuthority:false,applyExecuted:false,protectedProcesses:[]}})};
  if(leaf==='stopper.ps1'){const proof=JSON.parse(Buffer.from(arg(args,'-ExpectedJsonBase64'),'base64'));processRows=processRows.filter(x=>x.pid!==proof.pid);stopCalls++;return {stderr:'',stdout:'EXACT_OBSERVED_PROCESS_STOPPED'};}
  if(leaf==='recovery.ps1'){
   const action=arg(args,'-Action');if(action==='Inspect')return {stderr:'',stdout:JSON.stringify({status:'B264_NEW_OWNER_RECOVERY_INSPECTED',newIdentities:processRows.length,runningInstances:instances.length})};
   recoverCalls++;processRows=[];instances=[];const candidateRef=put('MelisaERP-P03-candidate-'+ 'c'.repeat(32)+'.json',{processes:[],receipts:[]});return {stderr:'',stdout:JSON.stringify({status:'B264_NEW_OWNER_EMPTY_CANDIDATE_READY',candidateRef})};
  }
  throw Error('UNMODELED_NATIVE');
 }
 async function ps(code){programs.push(code);
  if(code.endsWith("'OK'")){
   if(code.includes('REHEARSAL_ACTION_READBACK')){const b64=code.match(/\$a=.*?FromBase64String\('([^']+)'\)/)[1],a=JSON.parse(Buffer.from(b64,'base64'));actions[taskNames.indexOf(a.name)]=a.xml.startsWith('new')?'new':'old';}
   else if(code.includes('.Run($null)')){activeGeneration='new';const partial=options.scenario==='PartialNew';processRows=[...rows,...watchers].filter(x=>!partial||['coreSupervisor','erpNative','terminalWatcher'].includes(x.role)).map(x=>({...x,pid:x.pid+500}));instances=taskNames.slice(0,partial?1:2).map((name,i)=>({name,pid:700+i,guid:'new'+i}));}
   return 'OK';
  }
  if(code.includes("'HEALTHY'"))return 'HEALTHY';if(code.includes("'VERIFIED'"))return 'VERIFIED';
  if(code.includes('$o=@('))return 'a'.repeat(64);
  if(code.includes('$all=@('))return JSON.stringify(state());
  throw Error('UNMODELED_PS');
 }
 async function psPayload(file,b){
  if(file.includes('REHEARSAL_ACTION_SIZE')){programs.push(file);const m=file.match(/\$a=\[Text.Encoding\].*?FromBase64String\('([^']+)'\)/),a=JSON.parse(Buffer.from(m[1],'base64'));assert.equal(hash(b),a.sha256);assert.equal(b.toString(),profile.tasks.find(x=>x.name===a.name)[a.generation+'Xml']);actions[taskNames.indexOf(a.name)]=a.generation;return;}
  const value=JSON.parse(b),ref=put(path.win32.basename(file),value);writes.push(ref.path);if(value.event)events.push(value.event);
 }
 const params={mode:options.mode??'Apply',scenario:options.scenario??'Normal',runRoot:root,profileRef,beforeRef};
 const deps={P03_CURRENT_B142_REHEARSAL_NATIVE:nativePins,pr54SafeFailure:actualSafeFailure,path,need:(v,c)=>{if(!v)throw Error(c);},pin,read,noReparseAncestors:()=>{},hash,jsonBytes:bytes,targets,p03TransitionDigest,p03CoreFirstStopDigest,run:nativeRun,shell:'shell',b264Sup20dHeldInvocation:(ref,argv)=>({ref,args:argv.slice(4)}),opts:{},psPayload,pr54ProtectedWriteProgram:p=>p,Buffer,owner,psNoReparse:'NOREPARSE;',ps,sameIdentity:same,typedRef:x=>x&&typeof x.path==='string'&&/^[a-f0-9]{64}$/.test(x.sha256),runP03HeldCoreOwnerTransition,Date:D,fs:{readFileSync:p=>bytes(files.get(p).value),readdirSync:()=>['event-0000.json']},setTimeout:(fn,ms)=>{clock+=ms;fn();}};
 const execute=new Function(...Object.keys(deps),body+';return runPr54CurrentB142RehearsalTransition;')(...Object.values(deps));
 return {run:()=>execute(params),calls,writes,events,programs,digestInput:{before,profile,taskNames},profileBytes:bytes(profile).length,beforeBytes:bytes(before).length,get counts(){return {drainCalls,stopCalls,recoverCalls};}};
}
test('CurrentB142 SQL-free native bridge uses the held dispatcher for four finite outcomes',async()=>{
 for(const scenario of ['Normal','OldCutFailure','ReplyLoss','PartialNew']){const f=currentRehearsalFixture({scenario}),result=await f.run();assert.equal(result.status,'CURRENT_B142_REHEARSAL_SCENARIO_READY');assert.equal(result.scenario,scenario);assert.equal(result.sqlFreeFixture,true);assert.equal(result.applicationRollbackVerified,false);assert.equal(result.databaseRollbackVerified,false);assert.equal(result.sharedHistoryAdmissionVerified,false);assert.equal(f.counts.drainCalls,1);assert.equal(result.recovered,scenario!=='Normal');assert.equal(result.nativeReplyLost,scenario==='ReplyLoss');assert(f.events.includes('EXACT_STOP_INTENT'));}
});
test('CurrentB142 rehearsal DryRun reads all three native stages before returning with no claim or Drain',async()=>{const f=currentRehearsalFixture({mode:'DryRun'}),r=await f.run();assert.equal(r.runtimeMutation,false);assert.equal(r.claimCreated,false);assert.equal(r.applyExecuted,false);assert.equal(r.transitionAuthority,false);assert.deepEqual(r.nativeStages,['PreflightOld','Inspect','Capture']);assert.equal(f.calls.length,3);assert.equal(f.writes.length,0);assert.equal(f.counts.drainCalls,0);assert.equal(f.counts.stopCalls,0);
 const bad=currentRehearsalFixture({mode:'DryRun',badReadOnlyCapture:true});await assert.rejects(bad.run(),/REHEARSAL_CAPTURE/);assert.equal(bad.calls.length,3);assert.equal(bad.writes.length,0);assert.equal(bad.counts.drainCalls,0);assert.equal(bad.counts.stopCalls,0);
});
test('CurrentB142 rehearsal unknown native child and torn completed witness never begin a second mutation',async()=>{
 for(const bad of [{nativeUnknown:true},{scenario:'ReplyLoss',tornWitness:true}]){const f=currentRehearsalFixture(bad);await assert.rejects(f.run());assert.equal(f.counts.drainCalls,1);assert.equal(f.counts.stopCalls,0);assert.equal(f.counts.recoverCalls,0);}
});

test('CurrentB142 rehearsal emitted native PowerShell programs parse in Windows PS5 without executing them',{skip:process.platform!=='win32'},async()=>{
 const programs=[];for(const scenario of ['Normal','OldCutFailure','ReplyLoss','PartialNew']){const f=currentRehearsalFixture({scenario});await f.run();programs.push(...f.programs);}
 const data=Buffer.from(JSON.stringify([...new Set(programs)])).toString('base64');
 const code=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$items=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;$n=0;foreach($x in $items){$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseInput($x,[ref]$t,[ref]$e);if($e.Count){throw ('EMITTED_PARSE_'+$n+'_'+$e[0].Message)};$n++};'EMITTED_PS5_PASS'`;
 // Data is supplied on stdin so the AST-only fixture stays below Windows argv limits.
 const inputCode="$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$data=[Console]::In.ReadToEnd();$items=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($data))|ConvertFrom-Json;$n=0;foreach($x in $items){$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseInput($x,[ref]$t,[ref]$e);if($e.Count){throw ('EMITTED_PARSE_'+$n+'_'+$e[0].Message)};$n++};'EMITTED_PS5_PASS'";
 const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command',inputCode],{input:data,encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});assert.equal(child.status,0,child.stderr);assert.match(child.stdout,/EMITTED_PS5_PASS/);
});

test('CurrentB142 real-size profile and task XML use pinned disk reads and stdin, never oversized Windows argv',async(t)=>{
 const f=currentRehearsalFixture({large:true});await f.run();assert(f.profileBytes>=62540);assert(f.beforeBytes>=18265);let maxEncoded=0,maxPlain=0,maxHeld=0;
 for(const program of f.programs){
  assert(!program.includes('X'.repeat(100)));assert(!program.includes(Buffer.from('X'.repeat(100)).toString('base64')));
  assert.match(program,/profileRef/);assert.match(program,/REHEARSAL_INPUT_ACL/);assert.match(program,/REHEARSAL_INPUT_HASH/);
  const prefixed="$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;"+program,encoded=Buffer.from(prefixed,'utf16le').toString('base64');
  maxEncoded=Math.max(maxEncoded,encoded.length+200);maxPlain=Math.max(maxPlain,program.length+200);assert(encoded.length+200<30000,'encoded callback argv exceeds Windows bound');assert(program.length+200<30000,'plain stdin callback argv exceeds Windows bound');
 }
 for(const [file,args]of f.calls){const argv=['-NoProfile','-NonInteractive','-File',file,...args],wrapped=heldInvocation({path:file,sha256:'a'.repeat(64)},argv,{fileInvocationOnly:true}),estimated=wrapped.map(x=>'"'+x.replaceAll('"','\\"')+'"').join(' ').length;maxHeld=Math.max(maxHeld,estimated+200);assert(estimated+200<30000,'held File wrapper argv exceeds Windows bound');}
 t.diagnostic(JSON.stringify({profileBytes:f.profileBytes,beforeBytes:f.beforeBytes,maxEncoded,maxPlain,maxHeld}));
 const setter=f.programs.filter(p=>p.includes('REHEARSAL_ACTION_SIZE'));assert.equal(setter.length,2);assert(setter.every(p=>p.includes('[Console]::In.ReadToEnd()')&&p.endsWith("'CREATED'")));
});

test('CurrentB142 adapter rejects a mismatched explicit startup scenario before preflight, claim or Drain',async()=>{const f=currentRehearsalFixture({badStartup:true});await assert.rejects(f.run(),/REHEARSAL_STARTUP_CONTRACT/);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);});


test('CurrentB142 native refusal diagnostics are bounded and preserve preclaim rejection without secrets',async()=>{
 const rejected=Object.assign(Error('Command failed: PRIVATE_SENTINEL C:\\private\\secret'),{stderr:'P03_PHYSICAL_REHEARSAL_SCOPE PRIVATE_SENTINEL',code:1,killed:false,signal:null});
 const cases=[
  [{preflightError:rejected},'P03_PHYSICAL_REHEARSAL_SCOPE',false,1,'Error'],
  [{preflightError:Error('PRIVATE_SENTINEL')},'UNCLASSIFIED_IO_FAILURE',false,null,'Error'],
  [{preflightError:Error('P03_CURRENT_B142_REHEARSAL_SCOPE PRIVATE_SENTINEL')},'P03_CURRENT_B142_REHEARSAL_SCOPE',false,null,'Error'],
  [{preflightStderr:'P03_PHYSICAL_REHEARSAL_SCOPE PRIVATE_SENTINEL'},'P03_PHYSICAL_REHEARSAL_SCOPE',true,0,'Error'],
  [{preflightJson:true},'P03_SHARED_REHEARSAL_NATIVE_JSON_INVALID',true,null,'SyntaxError']
 ];
 for(const [option,code,completed,exitCode,errorType]of cases){const f=currentRehearsalFixture(option);await assert.rejects(f.run(),e=>{
  assert.equal(e.message,code);assert.deepEqual(e.p03RehearsalDiagnostic,{schemaVersion:'melisa-p03-current-b142-native-failure.v1',worker:'engine',action:'PreflightOld',code,exitCode,killed:false,signal:null,errorType,completed});
  assert(!JSON.stringify(e).includes('PRIVATE_SENTINEL'));assert(!JSON.stringify(e).includes('private'));assert.deepEqual(Object.keys(e),['p03RehearsalDiagnostic']);return true;
 });assert.equal(f.calls.length,1);assert.equal(f.writes.length,0);assert.equal(f.counts.drainCalls,0);}
});


test('CurrentB142 generated PS5 owner digest bypasses the built-in history alias without modifying it',{skip:process.platform!=='win32'},async()=>{
 const f=currentRehearsalFixture();await f.run();const program=f.programs.find(x=>x.includes('$o=@(')),begin=program.indexOf('function P03RehearsalTextSha256('),end=program.indexOf(';function ReadP03RehearsalPinnedJson(',begin),body=program.slice(program.indexOf('$c=',end));assert(begin>0&&end>begin);const definition=program.slice(begin,end);
 const fixture=structuredClone(f.digestInput),ownerRows=()=>Object.values(fixture.before.identities);ownerRows()[0].bindings=[{port:4284,address:'127.0.0.1'},{port:4286,address:'::1'}];
 const baseline=structuredClone(fixture),cases=[baseline];
 for(const change of ['unicodeQuote','leadingZero','bindingOrder','fieldTamper']){const x=structuredClone(baseline),row=x.before.identities.hub;if(change==='unicodeQuote')row.commandLine='node "şişe"';if(change==='leadingZero')row.commandLine='node --barcode 00123';if(change==='bindingOrder')row.bindings.reverse();if(change==='fieldTamper')row.parentPid++;cases.push(x);}
 const instances=f.digestInput.taskNames.map((name,i)=>({name,pid:200+i,guid:'g'+i}));
 const expected=cases.map(x=>hash(JSON.stringify({owners:Object.values(x.before.identities).sort((a,b)=>a.pid-b.pid).map(p=>Object.fromEntries(['pid','parentPid','ownerSid','nodePath','commandLine','creationTime','bindings'].map(k=>[k,p[k]]))),instances})));
 const input=Buffer.from(JSON.stringify(cases)).toString('base64');
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${input}'))|ConvertFrom-Json;${definition};if((Get-Alias h).Definition-cne'Get-History'-or(Get-Alias rp).Definition-cne'Remove-ItemProperty'){throw 'DEFAULT_ALIAS_CHANGED'};$reject=$false;try{H '{"owners":[],"instances":[]}'}catch{if($_.InvocationInfo.MyCommand.Name-cne'Get-History'-or$_.Exception.ParameterName-cne'Id'){throw};$reject=$true};if(-not$reject){throw 'OLD_H_NOT_REPRODUCED'};foreach($v in $cases){${body}};if((Get-Alias h).Definition-cne'Get-History'-or(Get-Alias rp).Definition-cne'Remove-ItemProperty'){throw 'DEFAULT_ALIAS_CHANGED'}`;
 const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command',"& ([scriptblock]::Create([Console]::In.ReadToEnd()))"],{input:code,encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});assert.equal(child.status,0,child.stderr);assert.deepEqual(child.stdout.trim().split(/\r?\n/),expected);assert.equal(new Set(expected).size,5);
 const legacy=source.slice(0,source.indexOf('export async function runPr54CurrentB142RehearsalTransition('));assert(!legacy.includes('P03RehearsalTextSha256'));assert.doesNotMatch(program,/\b(?:Remove|Set)-Alias\b/);assert.doesNotMatch(program,/\b(?:function )?(?:H|RP)\s*\(/);assert.match(program,/function ReadP03RehearsalPinnedJson\(/);assert.match(program,/ReadP03RehearsalPinnedJson \$v\.profileRef/);assert.match(program,/ReadP03RehearsalPinnedJson \$v\.beforeRef/);
});


test('CurrentB142 actual generated PS5 initializer uses uniquely named pinned readers with mocked COM and ACL only',{skip:process.platform!=='win32'},async()=>{
 const f=currentRehearsalFixture();await f.run();const full=f.programs.find(x=>x.includes('$o=@(')),init=full.slice(0,full.indexOf('$c=')),temp=fs.mkdtempSync(path.join(os.tmpdir(),'p03-current-init-'));
 try{
  const profileBytes=bytes({marker:'profile-00123'}),beforeBytes=bytes({marker:'before-00123'}),profilePath=path.join(temp,'profile.json'),beforePath=path.join(temp,'before.json');fs.writeFileSync(profilePath,profileBytes);fs.writeFileSync(beforePath,beforeBytes);
  const input={profileRef:{path:profilePath,sha256:hash(profileBytes)},beforeRef:{path:beforePath,sha256:hash(beforeBytes)}};
  const parentGuard=new Function(source.match(/^const psNoReparse=.*;$/m)[0]+';return psNoReparse;')();
  let generated=init.replace('NOREPARSE;',parentGuard).replace(/FromBase64String\('[^']+'\)/,"FromBase64String('"+Buffer.from(JSON.stringify(input)).toString('base64')+"')");
  const com="$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');";assert(generated.includes(com));generated=generated.replace(com,"$s=$null;$f=$null;");assert(!generated.includes('New-Object -ComObject'));
  const mocks=`$script:aclReads=0;function Get-Acl{param($LiteralPath);$script:aclReads++;$a=[pscustomobject]@{AreAccessRulesProtected=$true};$a|Add-Member ScriptMethod GetOwner {param($type);[pscustomobject]@{Value='${owner}'}};$a|Add-Member ScriptMethod GetAccessRules {param($explicit,$inherited,$type);foreach($sid in @('${owner}','S-1-5-18')){[pscustomobject]@{IdentityReference=[pscustomobject]@{Value=$sid};IsInherited=$false;AccessControlType='Allow';FileSystemRights='FullControl'}}};return $a};`;
  const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;${mocks}${generated};if($script:aclReads-ne2-or$v.profile.marker-cne'profile-00123'-or$v.before.marker-cne'before-00123'){throw 'PINNED_READER_FAILED'};if((Get-Alias h).Definition-cne'Get-History'-or(Get-Alias rp).Definition-cne'Remove-ItemProperty'){throw 'DEFAULT_ALIAS_CHANGED'};'INIT_HELPERS_PASS'`;
  const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command',"& ([scriptblock]::Create([Console]::In.ReadToEnd()))"],{input:code,encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'INIT_HELPERS_PASS');
 }finally{const resolved=fs.realpathSync.native(temp),parent=fs.realpathSync.native(os.tmpdir()),stat=fs.lstatSync(temp),leaf=path.basename(temp);assert(/^p03-current-init-[a-zA-Z0-9]+$/.test(leaf)&&stat.isDirectory()&&!stat.isSymbolicLink()&&path.dirname(resolved).toLowerCase()===parent.toLowerCase()&&path.basename(resolved).toLowerCase()===leaf.toLowerCase());fs.rmSync(resolved,{recursive:true,force:true});}
});


test('CurrentB142 held-core wrapper retains only the native refusal diagnostic without replay or recovery',async()=>{
 const refusal=Object.assign(Error('Command failed: PRIVATE_SENTINEL'),{stderr:'P03_CURRENT_B142_REHEARSAL_CLAIM PRIVATE_SENTINEL',code:1,killed:false}),f=currentRehearsalFixture({nativeCutError:refusal});
 await assert.rejects(f.run(),error=>{assert.equal(error.message,'P03_OWNER_TRANSITION_STOPPED');assert.equal(error.phase,'HELD_CORE_CUT');assert.deepEqual(error.p03RehearsalDiagnostic,{schemaVersion:'melisa-p03-current-b142-native-failure.v1',worker:'oldCut',action:'Drain',code:'P03_CURRENT_B142_REHEARSAL_CLAIM',exitCode:1,killed:false,signal:null,errorType:'Error',completed:false});assert(!JSON.stringify(error).includes('PRIVATE_SENTINEL'));return true;});
 assert.equal(f.writes.filter(p=>p.endsWith('\\rehearsal-claim.json')).length,1);assert.equal(f.calls.filter(([p,a])=>p.endsWith('oldCut.ps1')&&a[a.indexOf('-Mode')+1]==='Drain').length,1);assert.equal(f.counts.drainCalls,1);assert.equal(f.counts.stopCalls,0);assert.equal(f.counts.recoverCalls,0);assert(f.events.includes('FAILED'));assert(!f.calls.some(([p,a])=>p.endsWith('engine.ps1')&&['StopNew','RollbackOld'].includes(a[a.indexOf('-Mode')+1])));
 const unknown=currentRehearsalFixture({nativeUnknown:true});await assert.rejects(unknown.run(),e=>{assert.equal(e.p03RehearsalDiagnostic.code,'UNCLASSIFIED_IO_FAILURE');return true;});assert.equal(unknown.counts.drainCalls,1);assert.equal(unknown.counts.recoverCalls,0);
});
