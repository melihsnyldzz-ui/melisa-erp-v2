import {assertPr54CurrentB007Candidate} from './p03-pr54-owner-successor.mjs';
import {PR54_CURRENT_B007_PRECUT_REFS,PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH} from './p03-pr54-current-b007-precut-continuation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {runP03HeldCoreOwnerTransition,p03TransitionDigest,p03CoreFirstStopDigest} from './p03-integrated-owner-transition.mjs';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
const source=fs.readFileSync(new URL('./p03-pr54-shared-owner-io.mjs',import.meta.url),'utf8');
const safeFailureSource=source.split(/\r?\n/).find(line=>line.startsWith('export function pr54SafeFailure('));
const actualSafeFailure=new Function(safeFailureSource.replace(/^export /,'')+';return pr54SafeFailure;')();
const start=source.indexOf('export async function runPr54CurrentB007SharedOwnerTransition(');
const body=source.slice(start).replace(/^export /,'');
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
 const files=new Map(),directories=new Set(),calls=[],events=[],writes=[],programs=[];let phase='old',inspections=0,stops=0;
 const now=()=>new Date().toISOString();
 function put(file,value,expected){const b=Buffer.isBuffer(value)?value:bytes(value),ref={path:file,sha256:expected??hash(b)};files.set(file,{bytes:b,ref});return ref;}
 const engineRef=put(control+'\\p03-physical-rollback-lifetime-v2.ps1',Buffer.from('engine'),shaEngine);
 for(const [leaf,sha]of Object.values(pins))put(control+'\\'+leaf,Buffer.from(leaf),sha);
 put(root+'\\p03-pr54-paused-old-recover.ps1',Buffer.from('helper'),'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5');
 const stamp='2026-10-20T08:00:00.0000000Z';
 const identity=(role,n)=>({role,pid:100+n,parentPid:107,nodePath:'C:\\node.exe',ownerSid:owner,commandLine:'node '+role,creationTime:stamp,bindings:n<8?[{port:4184+n,address:'127.0.0.1'}]:[]});
 const identities=Object.fromEntries(targets.map((r,n)=>[r,identity(r,n)])),watchers=[identity('terminalWatcher',8),identity('hubWatcher',9)];
 const protectedRow={pid:900,parentPid:1,nodePath:'C:\\protected.exe',ownerSid:owner,commandLine:'protected',creationTime:stamp};
 const protectedConsole={pid:901,parentPid:900,nodePath:String.raw`C:\Windows\System32\conhost.exe`,ownerSid:owner,commandLine:String.raw`\??\C:\WINDOWS\system32\conhost.exe 0x4`,creationTime:stamp};
 const oldSettings=put(root+'\\old.json',{test:true},'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071');
 const newSettings=put(String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json`,{test:true},shaSettings);
 const candidate={erpSource:'6dc33f41737349c6e3f17fb867a451b570a00acc',erpManifest:'6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49',crmSource:'d1e4425206249e38445fb103e03601f86baa84ec',crmManifest:'a0e86fccbdb95eeb97e4dc08e383db7bf8f12a29b040f34a78f6c37e3093b5ef',supervisorSource:'da5b394919941f73b9d7098f146fffd362c2a955',supervisorManifest:'b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf',supervisorRoot:String.raw`C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-da5b39491994`,newSettings};
 const plan={targets,oldSettingsSha256:oldSettings.sha256,newSettingsSha256:newSettings.sha256};plan.digest=p03TransitionDigest(plan);
 const before={runId:sid,ownerSid:owner,database:db,copyId:copy,actualT1:false,observedAt:now(),profile:Object.fromEntries(Object.entries(candidate).filter(([k])=>!['newSettings','supervisorRoot'].includes(k))),identities,plan};
 const beforeRef=put(root+'\\MelisaERP-P03-before-'+sid+'.json',before);
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
 const profileRef=put(root+'\\MelisaERP-P03-profile-'+sid+'.json',profile);
 const rehearsalProofRef=put(String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-06889c3b196045bbacf33a10f450a178\result.json`,{status:'REHEARSAL_ROLLBACK_READY',environment:'P03_REHEARSAL',sharedTestMutation:false,protectedBeforeSha256:'a',protectedAfterSha256:'a',engineSha256:options.wrongEngine?'fe053':shaEngine,engine:{sha256:options.wrongEngine?'fe053':shaEngine}},'80e22ce1689fe7c7e8ca01cfafbbba5025e5fa31e9097e55810368c34e1fbc62');
 const outerRef=put(root+'\\history-outer\\event-0000.json',{history:true}),recoveryRef=put(root+'\\history-recovery\\event-0000.json',{history:true});
 const input={profileRef,beforeRef,currentPreCapture:{snapshotRef,proofRef,backupProofRef},rehearsalProofRef,sourceControlDir:control};
 if(options.continuation){
  input.precutContinuation=true;
  for(const ref of Object.values(PR54_CURRENT_B007_PRECUT_REFS))put(ref.path,{fixtureHistoricalPin:true},ref.sha256);
  const failedDir=path.win32.dirname(PR54_CURRENT_B007_PRECUT_REFS.failureTail.path);
  for(const leaf of ['successor-precut-admission.json','b264-old-owner-cut-intent.json','p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(pins).map(p=>p[0])])put(failedDir+'\\'+leaf,{unchanged:true});
  if(options.advancedFailed)put(failedDir+'\\successor-core-cut-completed.json',{forbidden:true});
  for(const leaf of ['p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1']){
   const matched=body.match(new RegExp("path:path.win32.join\\(sourceControlDir,'"+leaf.replaceAll('.','\\.')+"'\\),sha256:'([^']+)'"));assert(matched);put(control+'\\'+leaf,Buffer.from(leaf),matched[1]);
  }
 }
 function pin(ref){const f=files.get(ref.path);assert(f,'missing '+ref.path);assert.equal(ref.sha256,f.ref.sha256);return f.bytes;}
 const seen=()=>({schemaVersion:'melisa-p03-physical-observation.v1',environment:'Shared',beforeImage:beforeRef,observedAt:now(),collectionAuthority:'PHYSICAL_OBSERVATION_ONLY',processScope:'CIM.Win32_Process.Unfiltered',portScope:'Get-NetTCPConnection.Listen.Unfiltered',stopPermitted:false,applyAvailable:false,rawScope:{unverifiedCount:options.foreignRaw?1:0,unverifiedProcesses:options.foreignRaw?[{pid:666}]:[]},processes:[...rows,...(options.protectedParentDrift&&phase==='cut'?[{...protectedRow,commandLine:'drift'}]:[protectedRow]),...(options.protectedConsole?[options.protectedDrift&&phase==='cut'?{...protectedConsole,creationTime:'2026-10-20T08:00:01.0000000Z'}:protectedConsole]:[]),...(options.foreignOld&&phase==='cut'?[identity('unknown',66)]:[])],bindings:rows.flatMap(p=>(p.bindings??[]).map(b=>({...b,pid:p.pid}))),tasks:tasks.map((t,n)=>({name:t.name,state:running?4:3,xml:taskXml[n]})),runningInstances:running?names.map((name,n)=>({name,state:4,path:'\\'+name,enginePid:rows.find(p=>p.role===(n?'hubWatcher':'terminalWatcher'))?.pid??108+n,instanceGuid:'g'+n})):[]});
 async function run(shell,request){const {ref,args}=request,leaf=path.win32.basename(ref.path),at=k=>args[args.indexOf(k)+1];calls.push(leaf+':'+(args.includes('-Mode')?at('-Mode'):args.includes('-Action')?at('-Action'):''));
  if(leaf==='p03-pr54-b264-old-owner-cut.ps1'||leaf==='p03-pr54-current-b007-precut-cut.ps1'){
   if(at('-Mode')==='Inspect')return {stdout:JSON.stringify({schemaVersion:'melisa-p03-successor-precut-admission.v1',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,engineSha256:at('-EngineSha256'),recoveryHelperSha256:at('-RecoveryHelperSha256'),observedAt:now(),protectedConsolePins:options.protectedConsole?[protectedConsole]:[],oldIdentities:Object.values(identities),oldWatchers:watchers,consolePins:[],probePins:[]})};
   assert(files.has(transition+'\\b264-old-owner-cut-intent.json'));assert(files.has(options.continuation?PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH:claimPath));assert(events.some(e=>e.event==='EXACT_STOP_INTENT'&&e.target==='coreSupervisor'));
   if(options.continuation){assert.equal(at('-ContinuationPath'),transition+'\\precut-continuation.json');assert(files.has(at('-ContinuationPath')));}
   if(options.cutError)throw options.cutError;if(options.failCut)throw Error('P03_CUT_UNPROVEN');
   stops++;phase='cut';running=false;rows=rows.filter(p=>!['coreSupervisor','terminalWatcher','hubWatcher'].includes(p.role));
   const cutWitness=put(transition+'\\successor-core-cut-completed.json',{event:'B264_OLD_OWNER_CORE_CUT_COMPLETED'}),drainWitness=put(transition+'\\successor-core-probe-drain.json',{consolePins:[],probePins:[],goneOldPids:[107]});
   return {stdout:JSON.stringify({status:'B264_OLD_OWNER_CORE_DRAINED',coreStopResult:'COM_STOP_NATURAL_EXIT',heldCoreExited:true,comStopped:true,cutWitness,drainWitness})};
  }
  if(leaf==='p03-physical-recovery-observe.ps1')return {stdout:JSON.stringify(seen())};
  if(leaf.startsWith('MelisaERP-P03-stopper-')){const proof=JSON.parse(Buffer.from(at('-ExpectedJsonBase64'),'base64'));stops++;rows=rows.filter(p=>p.pid!==proof.pid);return {stdout:'EXACT_OBSERVED_PROCESS_STOPPED'};}
  if(leaf==='p03-pr54-new-owner-observe.ps1'){
   if(options.failNew)throw Error('P03_NEW_READBACK_FAILED');const candidate=JSON.parse(pin({path:at('-CandidatePath'),sha256:at('-CandidateSha256')}));assert.equal(candidate.processes.length,10);
   return {stdout:JSON.stringify({status:'NEW_OWNER_OBSERVED_READY',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,candidateSha256:at('-CandidateSha256'),engineSha256:at('-EngineSha256'),sourceObserverSha256:at('-SourceObserverSha256'),stableSeconds:30,mutationExecuted:false,sourceProof:{supervisorSourceCommit:before.profile.supervisorSource,supervisorManifestSha256:before.profile.supervisorManifest}})};
  }
  if(leaf==='p03-current-invariance-capture.ps1'){
   const post=structuredClone(snapshot);if(options.sqlDrift)post.tables[0].count=1;const postRef=put(base+'\\source-post-snapshot.json',post),proof={phase:'Post',snapshotRef:postRef};put(base+'\\source-post-proof.json',proof);return {stdout:JSON.stringify(proof)};
  }
  if(leaf==='p03-pr54-b264-new-owner-recovery.ps1'||leaf==='p03-pr54-current-b007-precut-new-recovery.ps1'){
   if(options.continuation)assert.equal(at('-ContinuationPath'),transition+'\\precut-continuation.json');
   if(options.unprovenPartial)throw Error('P03_NEW_DRAIN_CORE_UNPROVEN');rows=[];running=false;const candidateRef=put(root+'\\MelisaERP-P03-candidate-'+('c'.repeat(32))+'.json',{schemaVersion:'melisa-p03-physical-candidate.v1',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,observedAt:now(),processes:[],receipts:[]});return {stdout:JSON.stringify({status:'B264_NEW_OWNER_EMPTY_CANDIDATE_READY',candidateRef,oldOwnerStarted:false,engineRecoveryExecuted:false,businessWrites:0,requiresFrozenStopNewAndRollbackOld:true})};
  }
  if(leaf==='p03-physical-rollback-lifetime-v2.ps1'){
   if(at('-Mode')==='PreflightOld'){assert(!files.has(options.continuation?PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH:claimPath));if(options.payloadDrift)throw Error('P03_PHYSICAL_PACKAGE_BYTES');return {stdout:JSON.stringify({status:'OLD_PHYSICAL_PREFLIGHT',environment:'Shared',profileSha256:profileRef.sha256,beforeImageSha256:beforeRef.sha256,applyAvailable:false,mutationExecuted:options.badPreflight===true})};}
   if(at('-Mode')==='StopNew'){const c=JSON.parse(pin({path:at('-CandidatePath'),sha256:at('-CandidateSha256')}));assert.equal(c.processes.length,0);put(profile.journalDirectory+'\\event-0000.json',{event:'genuine-frozen-event'});return {stdout:JSON.stringify({status:'RECOVERED_OLD_ACTIONS',journalTailSha256:'f'.repeat(64)})};}
   assert.equal(at('-RecoveryTailSha256'),'f'.repeat(64));return {stdout:JSON.stringify({status:options.failRollback?'ROLLBACK_READBACK_FAILED':'RESTORED_READY'})};
  }
  throw Error('unexpected worker '+leaf);
 }
 async function ps(code){programs.push(code);
  if(code==='ABSENCE_CHECK')return 'EMPTY';
  if(code.includes('::GetCurrent().User.Value')&&!code.includes('Get-Acl'))return owner;
  if(code.includes('log_end_lsn'))return JSON.stringify({freshNative:true});
  if(code.includes('RegisterTask(')){const n=code.includes("GetTask('"+names[0]+"')")?0:1;taskXml[n]=code.includes(Buffer.from(tasks[n].newXml).toString('base64'))?tasks[n].newXml:tasks[n].oldXml;return 'SET';}
  if(code.includes("'STARTED'")){phase='new';running=true;rows=rules.map((r,n)=>({...identity(r.role,100+n),commandLine:r.commandLine,bindings:n<8?[{port:4184+n,address:'127.0.0.1'}]:[]}));const hubPath=String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\hub-web\hub-web-process-`+'d'.repeat(32)+'-0.json';put(hubPath,{pid:rows.find(p=>p.role==='hub').pid});put(hubPath.replace('hub-web-process-','hub-web-lineage-'),{lineage:true});return 'STARTED';}
  if(code.includes('CreateDirectory')){directories.add(transition);return 'CREATED';}
  if(code.includes("'UNCHANGED'"))return 'UNCHANGED';
  return 'VERIFIED';
 }
 const currentB007ProtectedConsoleCoverage=new Function('need','targets','owner','sameIdentity','preciseTime','exactKeys',source.slice(source.indexOf('function currentB007ProtectedConsoleCoverage('),source.indexOf('export function validatePr54CurrentB007PhysicalInspection('))+';return currentB007ProtectedConsoleCoverage;')((v,c)=>{if(!v)throw Error('P03_SHARED_'+c);},targets,owner,same,x=>typeof x==='string'?x.replace(/(\.\d{6})Z$/,(_,d)=>d+'0Z'):null,exact);
 const env={currentB007ProtectedConsoleCoverage,PR54_CURRENT_B007_ENGINE_SHA256:shaEngine,process:{platform:'win32'},path,crypto,Buffer,Date,JSON,Map,Set,Object,Number,Promise,RegExp,fs:{existsSync:p=>files.has(p)||directories.has(p),readdirSync:p=>[...files.keys()].filter(f=>path.win32.dirname(f)===p).map(f=>path.win32.basename(f)),readFileSync:p=>pin(files.get(p).ref)},hash,jsonBytes:bytes,need:(v,c)=>{if(!v)throw Error('P03_SHARED_'+c);},typedRef:r=>exact(r,['path','sha256']),exactKeys:exact,pin,read:r=>JSON.parse(pin(r)),currentDatabase:db,currentCopy:copy,owner,targets,names,quote:s=>"'"+s+"'",psNoReparse:'',shell:'synthetic',opts:{},PR54_PROTECT_SQL_CONNECTION:'synthetic',currentB007SourcePins:pins,PR54_B264_REFS:{engine:engineRef},PR54_B264_OUTER_REFS:[outerRef],PR54_B264_RECOVERY_REFS:[recoveryRef],PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH:claimPath,p03TransitionDigest,p03CoreFirstStopDigest,b264ReadPins:()=>[],pr54B264ReadPinsProgram:()=>'',validatePr54B264Predecessor:()=>true,
  assertPr54CurrentB007Candidate,PR54_CURRENT_B007_PRECUT_REFS,PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH,
  preparePr54CurrentB007PrecutContinuation:input=>{if(options.expireAfterClaim&&files.has(PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH))throw Error('P03_MODELED_BEFORE_EXPIRED');return env.validatePr54CurrentB007PrecutContinuationBinding(input);},
  validatePr54CurrentB007PrecutContinuationBinding:({raw,profileRef,beforeRef})=>{if(options.rejectContinuation)throw Error('P03_CURRENT_B007_PRECUT_CONTINUATION_REJECTED');assert.equal(Object.keys(raw).length,8);return Object.freeze({schemaVersion:'melisa-p03-current-b007-precut-continuation.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT_REFS.failureTail,profileRef,beforeRef,claimPath:PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH});},
  inspectPr54CurrentB007PhysicalOwner:async()=>{inspections++;return {profile,before,current:seen(),physicalInspection:secret};},
  preparePr54B264NativeContinuity:()=>secret,preparePr54CurrentB007NativeContinuity:()=>secret,validatePr54CurrentPreCapture:()=>({runId:'P03-20261020-100000',root:base}),pr54CurrentContinuityProgram:()=> 'log_end_lsn',
  admitPr54CurrentB007Epoch:({physicalInspection,current})=>{assert.equal(physicalInspection,secret);const value={schemaVersion:'melisa-p03-current-b007-epoch-proposal.v1',currentOwnerDigest:options.ownerDrift&&inspections>1?'e'.repeat(64):'d'.repeat(64),ownerObservedAt:current.observedAt,protectedSqlEpoch:{kind:'ProtectedSqlService',pid:900},predecessorRunId:'b264594b6f93d560d807c8decc4e6699',predecessorProfile:{},predecessorBefore:{},predecessorLock:{},consumedAncestorClaim:{},failedOuterTail:{},quarantinedRecoveryTail:{},readOnlyOldReady:{},successorRunId:sid,successorProfile:profileRef,successorBefore:beforeRef,newSettings,candidate,stopOrderDigest:p03CoreFirstStopDigest(plan),transitionAuthority:false,applyExecuted:false};return {claimPath,claim:value,proofDigest:'c'.repeat(64)};},
  noReparseAncestors:()=>{},pr54ProtectedWriteProgram:(file,sha)=>({file,sha}),psPayload:async({file,sha},b)=>{assert(!files.has(file),'CreateNew must reject overwrite');assert.equal(hash(b),sha);put(file,b);writes.push(file);if(/event-\d{4}\.json$/.test(file))events.push(JSON.parse(b));},ps,run,b264Sup20dHeldInvocation:(ref,argv)=>({ref,args:argv.slice(4)}),pr54CollectPhysicalObservation:(fn,stage)=>{assert.equal(stage,'PHYSICAL');return fn();},sameIdentity:same,pr54SuccessorEmptyProgram:({ids,consoles})=>{if(options.protectedConsole){assert(!ids.includes(901));assert(!consoles.some(p=>p.pid===901));}return 'ABSENCE_CHECK';},nativeArgumentTokens,proposePr54CandidateProcesses:(seen,profile)=>seen.processes.flatMap(p=>{const r=profile.candidateRules.find(r=>r.commandLine===p.commandLine&&r.nodePath===p.nodePath);return r?[{...p,role:r.role}]:[];}),pr54CurrentSourceCaptureArgs:runId=>['-Mode','SourceCapture','-Phase','Post','-RunId',runId],comparePr54CurrentSourceSnapshots:(a,b)=>{assert.deepEqual(a,b);return {equal:true,criticalTables:51};},runP03HeldCoreOwnerTransition,pr54SafeFailure:actualSafeFailure};
 const secret=Object.freeze({});
 const fn=new Function('env',`const {${Object.keys(env).join(',')}}=env;return (${body});`)(env);
 if(options.missingSource)files.delete(control+'\\'+pins.emptyRecovery[0]);
 return {input,fn,calls,events,writes,files,programs,get stops(){return stops;}};
}

// Source-body IO fixtures only. They do not collect OS state or perform a Shared transition.
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
 assert.equal(r.failurePhase,'HELD_CORE_CUT');assert.equal(r.recoveryReason,actualSafeFailure(Error('P03_SHARED_CURRENT_B007_PRESTART_CUT_UNPROVEN')));
 assert.equal(r.unprovenPartialRecoveryGranted,false);assert.equal(f.stops,0);
 assert.equal(f.calls.filter(c=>c==='p03-pr54-b264-old-owner-cut.ps1:Drain').length,1);
 assert(!f.calls.some(c=>c.includes('new-owner-recovery.ps1:Drain')||c.includes('StopNew')||c.includes('RollbackOld')));
 assert(!f.writes.some(p=>p.endsWith('successor-core-cut-completed.json')||p.endsWith('successor-core-probe-drain.json')));
});

test('CurrentB007 preserves the bounded native B264 code without exposing PowerShell stderr',async()=>{
 const marker='PRIVATE_STDERR_SENTINEL';
 for(const code of ['P03_PHYSICAL_B264_CUT_OWNER_FRESH',null]){
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
