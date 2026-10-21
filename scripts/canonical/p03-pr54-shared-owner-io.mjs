import {PR54_CURRENT_B007_PRECUT_RETRY_REFS,preparePr54CurrentB007PrecutRetry,validatePr54CurrentB007PrecutRetryBinding} from './p03-pr54-current-b007-precut-continuation.mjs';
// Root-only Windows IO for the finite be8 -> e59/13b shared TEST handoff.
// Importing this file performs no IO. DryRun is the default. No LIVE/Vega SQL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {runP03OwnerTransition,runP03CoreFirstOwnerTransition,p03TransitionDigest,p03CoreFirstStopDigest} from './p03-integrated-owner-transition.mjs';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
import {admitPr54OwnerSuccessor,claimPr54OwnerSuccessor,pr54OwnerSuccessorRefs,PR54_PREDECESSOR_REFS,PR54_PREDECESSOR_TRANSITION,PR54_PREDECESSOR_JOURNAL,PR54_SUCCESSOR_CLAIM_PATH,PR54_REHEARSED_ENGINE_SHA,admitPr54CurrentOwnerSuccessor,preparePr54CurrentNativeContinuity,isPr54CurrentNativeContinuity,assertPr54CurrentSuccessorCandidate,PR54_CURRENT_REFS,PR54_CURRENT_JOURNAL_REFS,PR54_CURRENT_SUCCESSOR_CLAIM_PATH} from './p03-pr54-owner-successor.mjs';
import {PR54_B264_REFS,PR54_B264_OUTER_REFS,PR54_B264_RECOVERY_REFS,PR54_B264_SUCCESSOR_CLAIM_PATH,validatePr54B264Predecessor} from './p03-pr54-owner-successor.mjs';
import {runP03HeldCoreOwnerTransition} from './p03-integrated-owner-transition.mjs';
import {admitPr54B264Sup20dCurrentEpoch,assertPr54B264Sup20dCandidate,preparePr54B264NativeContinuity} from './p03-pr54-owner-successor.mjs';
import {inspectPr54B264Sup20dPhysicalOwner} from './p03-pr54-b264-physical-io.mjs';
import {admitPr54CurrentB007Epoch,assertPr54CurrentB007Candidate,PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH,PR54_CURRENT_B007_ENGINE_SHA256,preparePr54CurrentB007NativeContinuity} from './p03-pr54-owner-successor.mjs';
import {inspectPr54CurrentB007PhysicalOwner} from './p03-pr54-b264-physical-io.mjs';
import {PR54_CURRENT_B007_PRECUT_REFS,PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH,preparePr54CurrentB007PrecutContinuation,validatePr54CurrentB007PrecutContinuationBinding} from './p03-pr54-current-b007-precut-continuation.mjs';
import {PR54_CURRENT_B007_PRECUT_RESUME_REFS,preparePr54CurrentB007PrecutResume,validatePr54CurrentB007PrecutResumeBinding} from './p03-pr54-current-b007-precut-continuation.mjs';
const run=promisify(execFile),owner='S-1-5-21-2170750028-1005938530-2568122015-1001';
export const PR54_PROTECT_SQL_CONNECTION='Server=Semih\\MELISADEV;Database=master;Integrated Security=True;Connect Timeout=5;Application Name=P03SharedProtectOnly';
const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const oldSha='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96';
const newSha='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071';
const targets=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const names=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'],ports=[4184,4186,5234,62700,62701,62702,62703,62704];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const need=(v,c)=>{if(!v)throw Error('P03_SHARED_'+c);};
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const opts={windowsHide:true,timeout:60000,maxBuffer:8*1024*1024,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}};
const jsonBytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
function pin(ref){need(ref&&/^[a-f0-9]{64}$/.test(ref.sha256),'PIN_FORMAT');const st=fs.lstatSync(ref.path);need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&fs.realpathSync.native(ref.path).toLowerCase()===path.resolve(ref.path).toLowerCase(),'PIN_FILE');const b=fs.readFileSync(ref.path);need(hash(b)===ref.sha256,'PIN_HASH');return b;}
function read(ref){return JSON.parse(pin(ref));}
const preciseTime=value=>typeof value==='string'?value.replace(/(\.\d{6})Z$/,(_,digits)=>digits+'0Z'):null;
const sameIdentity=(a,b)=>a&&b&&['pid','parentPid','nodePath','ownerSid','commandLine'].every(k=>a[k]===b[k])&&preciseTime(a.creationTime)===preciseTime(b.creationTime);
// Minted only by the private pinned Inspect transport below. No public mint.
const currentPhysicalInspections=new WeakMap();
export function lookupPr54CurrentPhysicalInspection(token,{current,profile,before,profileRef,beforeRef,now=Date.now()}){
 const p=currentPhysicalInspections.get(token);
 return p&&p.current===current&&p.profile===profile&&p.before===before&&JSON.stringify(p.profileRef)===JSON.stringify(profileRef)&&JSON.stringify(p.beforeRef)===JSON.stringify(beforeRef)&&p.digest===hash(jsonBytes({current,profile,before}))&&Number.isFinite(now)&&now-Date.parse(p.observedAt)>=0&&now-Date.parse(p.observedAt)<60000?p.aux:null;
}
export function validatePr54CurrentPhysicalInspection(args){return validatePr54PhysicalInspection(args,PR54_REHEARSED_ENGINE_SHA);}
export function validatePr54B264PhysicalInspection(args){
 const {frame}=args;need(frame?.schemaVersion==='melisa-p03-b264-precut-inspection.v1'&&frame.policyGeneration==='B264InspectOnly'&&frame.transitionAuthority===false&&frame.stopAuthority===false&&frame.applyExecuted===false&&exactKeys(frame,['schemaVersion','profileSha256','beforeSha256','engineSha256','recoveryHelperSha256','observedAt','oldIdentities','oldWatchers','consolePins','probePins','policyGeneration','transitionAuthority','stopAuthority','applyExecuted','protectedProcesses']),'B264_INSPECTION_BINDING');
 need(Array.isArray(frame.protectedProcesses)&&JSON.stringify(frame.protectedProcesses)===JSON.stringify(args.profile.protectedProcesses),'B264_PROTECTED_NATIVE_FRAME');
 const {policyGeneration,transitionAuthority,stopAuthority,applyExecuted,protectedProcesses,...raw}=frame;
 return validatePr54PhysicalInspection({...args,frame:{...raw,schemaVersion:'melisa-p03-successor-precut-admission.v1'}},'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def');
}
// The new immutable supervisor generation cannot be relabelled as legacy B264.
// This validator only checks a frame; physical authority is held in the private
// transport WeakMap, never granted by this function or a caller boolean.
export function validatePr54B264Sup20dPhysicalInspection(args){
 const {frame}=args;need(frame?.schemaVersion==='melisa-p03-b264-precut-inspection.v1'&&frame.policyGeneration==='B264Sup20DInspectOnly'&&frame.transitionAuthority===false&&frame.stopAuthority===false&&frame.applyExecuted===false&&exactKeys(frame,['schemaVersion','profileSha256','beforeSha256','engineSha256','recoveryHelperSha256','observedAt','oldIdentities','oldWatchers','consolePins','probePins','policyGeneration','transitionAuthority','stopAuthority','applyExecuted','protectedProcesses']),'B264_SUP20D_INSPECTION_BINDING');
 need(Array.isArray(frame.protectedProcesses)&&JSON.stringify(frame.protectedProcesses)===JSON.stringify(args.profile.protectedProcesses),'B264_SUP20D_PROTECTED_NATIVE_FRAME');
 const {policyGeneration,transitionAuthority,stopAuthority,applyExecuted,protectedProcesses,...raw}=frame;
 return validatePr54PhysicalInspection({...args,frame:{...raw,schemaVersion:'melisa-p03-successor-precut-admission.v1'}},'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def');
}
function validatePr54PhysicalInspection({frame,current,profile,before,profileRef,beforeRef,engineRef,recoveryHelperRef,now=Date.now()},expectedEngine){
 need(exactKeys(frame,['schemaVersion','profileSha256','beforeSha256','engineSha256','recoveryHelperSha256','observedAt','oldIdentities','oldWatchers','consolePins','probePins'])&&frame.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&frame.profileSha256===profileRef.sha256&&frame.beforeSha256===beforeRef.sha256&&frame.engineSha256===engineRef.sha256&&frame.engineSha256===expectedEngine&&frame.recoveryHelperSha256===recoveryHelperRef.sha256,'CURRENT_INSPECTION_BINDING');
 need(Number.isFinite(now)&&Number.isFinite(Date.parse(frame.observedAt))&&now-Date.parse(frame.observedAt)>=0&&now-Date.parse(frame.observedAt)<60000&&Number.isFinite(Date.parse(current.observedAt))&&now-Date.parse(current.observedAt)>=0&&now-Date.parse(current.observedAt)<60000&&Date.parse(frame.observedAt)>=Date.parse(current.observedAt),'CURRENT_INSPECTION_FRESH');
 const owned=[...targets.map(role=>before.identities[role]),...profile.oldWatchers];
 need(frame.oldIdentities.length===8&&frame.oldWatchers.length===2&&new Set(owned.map(p=>p.pid)).size===10&&new Set([...frame.oldIdentities,...frame.oldWatchers].map(p=>p.pid)).size===10&&targets.every(role=>frame.oldIdentities.some(p=>sameIdentity(p,before.identities[role])))&&profile.oldWatchers.every(p=>frame.oldWatchers.some(q=>sameIdentity(p,q)))&&owned.every(p=>current.processes.some(q=>sameIdentity(p,q))),'CURRENT_INSPECTION_OWNED');
 need(Array.isArray(frame.consolePins)&&Array.isArray(frame.probePins)&&frame.consolePins.length<=64&&frame.probePins.length<=64&&Array.isArray(current.processes)&&new Set(current.processes.map(p=>p.pid)).size===current.processes.length,'CURRENT_INSPECTION_ROWS');
 need(current.tasks.length===2&&current.runningInstances.length===2&&names.every((name,n)=>{const task=current.tasks.find(p=>p.name===name),expected=profile.tasks.find(p=>p.name===name),instances=current.runningInstances.filter(p=>p.name===name),watcher=profile.oldWatchers.find(p=>p.role===(n?'hubWatcher':'terminalWatcher'));return task?.state===4&&expected&&hash(Buffer.from(task.xml))===expected.oldXmlSha256&&instances.length===1&&instances[0].state===4&&instances[0].path==='\\'+name&&instances[0].enginePid===watcher?.pid&&typeof instances[0].instanceGuid==='string'&&instances[0].instanceGuid.length>0;}),'CURRENT_INSPECTION_TASKS');
 const tuples=rows=>JSON.stringify(rows.map(b=>[b.port,b.address,b.pid]).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1])||a[2]-b[2]));need(tuples(current.bindings)===tuples(targets.flatMap(role=>(before.identities[role].bindings??[]).map(b=>({...b,pid:before.identities[role].pid})))),'CURRENT_INSPECTION_BINDINGS');
 const aux=[...frame.probePins,...frame.consolePins],protectedRows=profile.protectedProcesses,extras=current.processes.filter(p=>!owned.some(q=>sameIdentity(p,q))&&!protectedRows.some(q=>sameIdentity(p,q)));
 need(new Set(aux.map(p=>p.pid)).size===aux.length&&aux.every(p=>Number.isSafeInteger(p.pid)&&p.pid>0&&!owned.some(q=>q.pid===p.pid)&&!protectedRows.some(q=>q.pid===p.pid)&&p.ownerSid===owner&&typeof p.creationTime==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6,7}Z$/.test(p.creationTime)&&Date.parse(p.creationTime)<=Date.parse(frame.observedAt)),'CURRENT_AUX_PIN');
 const core=before.identities.coreSupervisor,probe='C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a\\scripts\\canonical\\hub-stack-process-probe.ps1';
 const stagePorts={hub:'5234',crmServer:'62700,62701',crmOrders:'62703',crmCatalog:'62702',crmNativeOrder:'62704',erpApi:'4184',erpNative:'4186'};
 for(const p of frame.probePins){const argv=nativeArgumentTokens(p.commandLine);need(p.parentPid===core.pid&&p.nodePath===profile.shell.path&&preciseTime(p.creationTime)>=preciseTime(core.creationTime)&&Object.entries(stagePorts).some(([role,ports])=>{const base=[profile.shell.path,'-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',probe,'-Ports',ports];return JSON.stringify(argv)===JSON.stringify(base)||JSON.stringify(argv)===JSON.stringify([...base,'-ProcessId',String(before.identities[role].pid)]);}),'CURRENT_AUX_PROBE');}
 for(const p of frame.consolePins){const parent=[...owned,...frame.probePins].find(q=>q.pid===p.parentPid);need(parent&&parent.ownerSid===owner&&p.nodePath.toLowerCase()==='c:\\windows\\system32\\conhost.exe'&&p.commandLine.toLowerCase()==='\\??\\c:\\windows\\system32\\conhost.exe 0x4'&&preciseTime(p.creationTime)>=preciseTime(parent.creationTime),'CURRENT_AUX_CONSOLE');}
 // Set churn permits only a whole new observation, never a filtered old frame.
 need(extras.length===aux.length&&extras.every(p=>aux.some(q=>q.pid===p.pid))&&aux.every(p=>extras.some(q=>q.pid===p.pid)),'CURRENT_AUX_FRAME_CHANGED');
 for(const p of aux){const raw=extras.find(q=>q.pid===p.pid),console=frame.consolePins.includes(p);need(raw&&['pid','parentPid','ownerSid','commandLine'].every(k=>raw[k]===p[k])&&preciseTime(raw.creationTime)===preciseTime(p.creationTime)&&(console?raw.nodePath.toLowerCase()===p.nodePath.toLowerCase():raw.nodePath===p.nodePath)&&!(raw.bindings??[]).length&&!current.bindings.some(b=>b.pid===p.pid),'CURRENT_AUX_IDENTITY');}
 return Object.freeze(aux.map(p=>Object.freeze({...p})));
}
export async function collectPr54CurrentInspectionPair(collect){
 for(let attempt=0;attempt<3;attempt++){try{return await collect();}catch(error){if(error?.message!=='P03_SHARED_CURRENT_AUX_FRAME_CHANGED'||attempt===2)throw error;}}
}
export function pr54SafeFailure(error){
 const stderr=String(error?.stderr??''),text=String(error?.message??'')+' '+stderr,fixed=text.match(/\bP03_[A-Z_]+\b/);if(fixed)return fixed[0];
 // PS5 emits encoded CRLF inside CLIXML Error strings. Decode only that
 // transport delimiter, not a command, message, frame or owner identity.
 const cimText=stderr.startsWith('#< CLIXML')?[...stderr.matchAll(/<S S="Error">([^<]*)<\/S>/g)].map(x=>x[1].replaceAll('_x000D__x000A_','\r\n')).join('\n'):stderr;
 if(/FullyQualifiedErrorId\s*:\s*HRESULT 0x80041002,Microsoft\.Management\.Infrastructure\.CimCmdlets\.InvokeCimMethodCommand(?:\s|$)/i.test(cimText))return 'P03_OBSERVER_CIM_OBJECT_NOT_FOUND';
 return ['ENOENT','EACCES','ENAMETOOLONG','ETIMEDOUT','EPIPE'].includes(error?.code)?error.code:'UNCLASSIFIED_IO_FAILURE';
}
// A probe can exit between the frozen observer's CIM list and owner read. A
// retry obtains a whole new observation; no partial frame is reused or admitted.
export async function pr54CollectPhysicalObservation(collect,stage='PHYSICAL'){
 need(['PHYSICAL','REFERENCE_OBSERVER','SUCCESSOR_INSPECT','SUCCESSOR_CAPTURE'].includes(stage),'COLLECTION_STAGE');
 for(let attempt=0;attempt<3;attempt++){
  try{return await collect();}catch(error){if(!['P03_PROCESS_IDENTITY_UNAVAILABLE','P03_OBSERVER_CIM_OBJECT_NOT_FOUND'].includes(pr54SafeFailure(error))||attempt===2){if(error&&typeof error==='object'&&Object.isExtensible(error))error.p03ObservationStage=stage;throw error;}}
 }
}
export function assertPr54ObservationAuthority(frame,proposal){
 need(typeof proposal==='boolean'&&frame&&typeof frame==='object','OBSERVER_AUTHORITY');
 need(proposal?frame.collectionAuthority==='CANDIDATE_PROPOSAL_ONLY':frame.collectionAuthority!=='CANDIDATE_PROPOSAL_ONLY','OBSERVER_AUTHORITY');
 return frame;
}
export function pr54StopObservationSummary(seen,before,profile){const old=[...Object.values(before.identities),...profile.oldWatchers];return {tasks:seen.tasks.map(t=>({name:t.name,state:t.state})),runningInstances:seen.runningInstances.length,remainingOld:old.filter(e=>seen.processes.some(p=>sameIdentity(p,e))).map(e=>e.pid),watcherMatches:seen.processes.filter(p=>/watch-terminal-completion-logon\.ps1|watch-hub-after-erp\.ps1/i.test(p.commandLine)).map(p=>({pid:p.pid,parentPid:p.parentPid,captured:old.some(e=>sameIdentity(p,e))})),consoleParents:seen.processes.filter(p=>typeof p.nodePath==='string'&&p.nodePath.toLowerCase()==='c:\\windows\\system32\\conhost.exe').map(p=>({pid:p.pid,parentPid:p.parentPid,parentPresent:seen.processes.some(q=>q.pid===p.parentPid),parentCaptured:old.some(q=>q.pid===p.parentPid)}))};}
// Preliminary classification only. The sealed physical engine must independently
// prove the binary SHA and Microsoft Windows Authenticode signature on every gate.
export function classifyPr54Auxiliary(process,parents,bindings){
 const parent=parents.find(p=>p.pid===process.parentPid);
 return !!parent&&typeof process.nodePath==='string'&&process.nodePath.toLowerCase()==='c:\\windows\\system32\\conhost.exe'&&process.commandLine==='\\??\\C:\\WINDOWS\\system32\\conhost.exe 0x4'&&process.ownerSid===owner&&parent.ownerSid===owner&&Number.isInteger(process.pid)&&process.pid>0&&process.pid!==parent.pid&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6,7}Z$/.test(process.creationTime)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6,7}Z$/.test(parent.creationTime)&&Number.isFinite(Date.parse(process.creationTime))&&Number.isFinite(Date.parse(parent.creationTime))&&preciseTime(process.creationTime)>=preciseTime(parent.creationTime)&&!bindings.some(b=>b.pid===process.pid)&&!(process.bindings??[]).length;
}
export function selectPr54CandidateProcesses(seen,profile){
 const unprotected=seen.processes.filter(p=>!profile.protectedProcesses.some(q=>q.pid===p.pid)),selected=[];
 need(new Set(unprotected.map(p=>p.pid)).size===unprotected.length,'DUPLICATE_PID');
 for(const process of unprotected){const matching=profile.candidateRules.filter(rule=>rule.nodePath===process.nodePath&&JSON.stringify(nativeArgumentTokens(rule.commandLine))===JSON.stringify(nativeArgumentTokens(process.commandLine)));need(matching.length<=1,'DUPLICATE_RULE');if(matching.length===1)selected.push({...process,role:matching[0].role});}
 need(new Set(selected.map(p=>p.pid)).size===selected.length&&new Set(selected.map(p=>p.role)).size===selected.length,'DUPLICATE_ROLE');
 for(const process of unprotected.filter(p=>!selected.some(q=>q.pid===p.pid)))need(classifyPr54Auxiliary(process,selected,seen.bindings),'FOREIGN_CANDIDATE');
 return selected;
}
// This is only a factual proposal, never a complete inventory admission. The
// successor's separate physical observer must authenticate all remaining
// processes, including its live read-only monitor children, before success.
export function proposePr54CandidateProcesses(seen,profile){
 const selected=[];
 for(const process of seen.processes.filter(p=>!profile.protectedProcesses.some(q=>q.pid===p.pid))){const rules=profile.candidateRules.filter(r=>r.nodePath===process.nodePath&&JSON.stringify(nativeArgumentTokens(r.commandLine))===JSON.stringify(nativeArgumentTokens(process.commandLine)));need(rules.length<=1,'DUPLICATE_RULE');if(rules.length===1)selected.push({...process,role:rules[0].role});}
 need(new Set(selected.map(p=>p.pid)).size===selected.length&&new Set(selected.map(p=>p.role)).size===selected.length,'DUPLICATE_ROLE');return selected;
}
// Read-only diagnosis of the fully stopped-task, still-healthy old stack.
// This is not admittedOld and grants no permission to stop/start any process.
export function diagnosePr54PausedOld({profile,before,current}){
 need(current.tasks.length===2&&names.every(name=>{const t=current.tasks.find(x=>x.name===name),pin=profile.tasks.find(x=>x.name===name);return t?.state===3&&pin&&hash(Buffer.from(t.xml))===pin.oldXmlSha256;})&&current.runningInstances.length===0,'PAUSED_TASKS');
 need(profile.oldWatchers.every(w=>!current.processes.some(p=>p.pid===w.pid)),'PAUSED_WATCHERS');
 const old=targets.map(role=>before.identities[role]);need(old.length===8&&old.every(e=>current.processes.some(p=>sameIdentity(p,e))),'PAUSED_OLD_IDENTITY');
 const extras=current.processes.filter(p=>!old.some(e=>e.pid===p.pid)&&!profile.protectedProcesses.some(e=>e.pid===p.pid));for(const p of extras)need(classifyPr54Auxiliary(p,old,current.bindings),'PAUSED_FOREIGN_PROCESS');
 const normalized=rows=>JSON.stringify(rows.map(b=>[b.port,b.address,b.pid]).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1])||a[2]-b[2]));const expected=old.flatMap(p=>(p.bindings??[]).map(b=>({...b,pid:p.pid})));need(normalized(current.bindings)===normalized(expected),'PAUSED_BINDINGS');
 return {status:'PAUSED_OLD_SOURCE_ADMISSION_DIAGNOSIS_PASS',mutationAuthorized:false,oldIdentityCount:8,consoleAuxiliaryCount:extras.length,requiresAuthoritativeAuxiliaryBinaryProof:true,requiresProtectedStateProof:true,requiresDurableJournalProof:true};
}
export function admitPr54PrestartRecovery({profile,before,admittedOld,current}){
 need(admittedOld?.runningInstances?.length===2&&Array.isArray(current?.runningInstances)&&Array.isArray(current?.processes)&&Array.isArray(current?.bindings)&&Array.isArray(current?.tasks),'PRESTART_INPUT');
 const old=[...targets.map(role=>before.identities[role]),...profile.oldWatchers];
 need(old.length===10&&new Set(old.map(p=>p.pid)).size===10&&new Set(current.runningInstances.map(p=>p.name)).size===current.runningInstances.length,'PRESTART_CAPTURE');
 for(const task of current.tasks){const entry=profile.tasks.find(p=>p.name===task.name);need(entry&&[3,4].includes(task.state)&&[entry.oldXmlSha256,entry.newXmlSha256].includes(hash(Buffer.from(task.xml))),'PRESTART_TASK_ACTION');}
 need(current.tasks.length===2&&names.every(name=>current.tasks.some(t=>t.name===name)),'PRESTART_TASK_COUNT');
 for(const instance of current.runningInstances){const saved=admittedOld.runningInstances.find(p=>p.name===instance.name);need(saved&&instance.path===saved.path&&instance.instanceGuid===saved.instanceGuid&&instance.enginePid===saved.enginePid&&instance.state===4,'PRESTART_COM_IDENTITY');const watcher=profile.oldWatchers.find(p=>p.pid===instance.enginePid);need(watcher&&sameIdentity(current.processes.find(p=>p.pid===watcher.pid),watcher),'PRESTART_COM_PROCESS');}
 for(const process of current.processes){if(profile.protectedProcesses.some(p=>p.pid===process.pid))continue;const saved=old.find(p=>p.pid===process.pid);if(saved){need(sameIdentity(process,saved),'PRESTART_FOREIGN_OR_REUSED_PROCESS');continue;}const pinned=admittedOld.processes?.find(p=>p.pid===process.pid);const parents=current.processes.filter(p=>old.some(q=>sameIdentity(p,q)));need(pinned&&sameIdentity(process,pinned)&&classifyPr54Auxiliary(process,parents,current.bindings),'PRESTART_FOREIGN_OR_REUSED_PROCESS');}
 for(const binding of current.bindings){const saved=old.find(p=>p.pid===binding.pid);need(saved&&(saved.bindings??[]).some(b=>b.port===binding.port&&b.address===binding.address),'PRESTART_FOREIGN_LISTENER');}
 return true;
}
function noReparseAncestors(file){for(let q=path.dirname(file);;q=path.dirname(q)){const stat=fs.lstatSync(q);need(stat.isDirectory()&&!stat.isSymbolicLink()&&fs.realpathSync.native(q).toLowerCase()===path.resolve(q).toLowerCase(),'WRITE_PARENT_REPARSE');if(q===path.dirname(q))break;}}
const psNoReparse="for($q=[IO.Path]::GetDirectoryName($p);$q;$q=[IO.Path]::GetDirectoryName($q)){if((Get-Item -LiteralPath $q -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'WRITE_PARENT_REPARSE'}};";
export function assertPr54WriteScope(file,transitionDir,globalOwnerLock,successorClaimPath=null){need(file===globalOwnerLock||file.startsWith(transitionDir+'\\')||/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-candidate-[a-f0-9]{32}\.json$/.test(file)||[PR54_SUCCESSOR_CLAIM_PATH,PR54_CURRENT_SUCCESSOR_CLAIM_PATH].includes(successorClaimPath)&&file===successorClaimPath,'WRITE_SCOPE');need(path.win32.normalize(file)===file&&!file.includes('/'),'WRITE_SCOPE');}
export function pr54ProtectedWriteProgram(file,sha256){need(/^[a-f0-9]{64}$/.test(sha256),'WRITE_HASH');return `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Security')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,$name+'.psd1')) -ErrorAction Stop};$p=${quote(file)};${psNoReparse}$raw=[Console]::In.ReadToEnd();if($raw.Length-gt22369624){throw 'PAYLOAD_LIMIT'};$b=[Convert]::FromBase64String($raw);$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant();if($actual-cne'${sha256}'){throw 'PAYLOAD_HASH'};if(Test-Path -LiteralPath $p){throw 'EXISTS'};$s=[Security.AccessControl.FileSecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new('${owner}'));$s.SetAccessRuleProtection($true,$false);foreach($id in @('${owner}','S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow'))};$f=[IO.FileStream]::new($p,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$s);try{$f.Write($b,0,$b.Length);$f.Flush($true)}finally{$f.Dispose()};'CREATED'`;}
async function psPayload(code,bytes,{plainCommandOnly=false}={}){need(typeof plainCommandOnly==='boolean'&&bytes.length<=16*1024*1024,'PAYLOAD_LIMIT');const encoded=plainCommandOnly?null:Buffer.from(code,'utf16le').toString('base64');need(plainCommandOnly?code.length<16000:encoded.length<16000,'WRITER_COMMAND_LIMIT');return new Promise((resolve,reject)=>{const child=spawn(shell,['-NoProfile','-NonInteractive',plainCommandOnly?'-Command':'-EncodedCommand',plainCommandOnly?code:encoded],{...opts,stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',d=>{output+=d;if(output.length>65536)child.kill();});child.stderr.on('data',d=>{errors+=d;if(errors.length>65536)child.kill();});child.on('error',()=>reject(Error('P03_SHARED_WRITER_EXECUTION')));child.stdin.on('error',()=>{});child.on('close',status=>{if(status!==0||errors||output.trim()!=='CREATED')reject(Error('P03_SHARED_WRITER_REJECTED'));else resolve();});child.stdin.end(bytes.toString('base64'));});}
async function ps(code,{plainCommandOnly=false}={}){need(typeof plainCommandOnly==='boolean','POWERSHELL_MODE');const program="$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;"+code;need(!plainCommandOnly||program.length<30000,'COMMAND_LIMIT');const result=await run(shell,['-NoProfile','-NonInteractive',plainCommandOnly?'-Command':'-EncodedCommand',plainCommandOnly?program:Buffer.from(program,'utf16le').toString('base64')],opts);need(!result.stderr,'POWERSHELL_STDERR');return result.stdout.trim();}
export function assertPr54SharedProfile(profile,before,currentOwnerCandidate=null){
 const currentCandidate=currentOwnerCandidate===null?null:assertPr54CurrentSuccessorCandidate(currentOwnerCandidate),effectiveNewSha=currentCandidate?.newSettings.sha256??newSha;
 need(profile?.schemaVersion==='melisa-p03-physical-profile.v1'&&before?.schemaVersion==='melisa-p03-owner-observation.v3','SCHEMA');
 need(profile.environment===undefined&&before.environment===undefined&&profile.ownerSid===owner&&before.ownerSid===owner,'OWNER');
 need(profile.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&before.database===profile.database&&before.actualT1===false,'DATABASE');
 if(currentCandidate){need(profile.oldSettings?.sha256===newSha&&profile.oldSettings.path==='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'&&JSON.stringify(profile.newSettings)===JSON.stringify(currentCandidate.newSettings)&&JSON.stringify(before.oldConfig)===JSON.stringify(profile.oldSettings)&&JSON.stringify(before.newConfig)===JSON.stringify(profile.newSettings)&&before.copyId==='e16b70f0-4057-428b-9abc-6bbcaf35fe82','CURRENT_SETTINGS');}
 else need(profile.oldSettings?.sha256===oldSha&&profile.newSettings?.sha256===newSha&&profile.newSettings.path==='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json','SETTINGS');
 const expected=currentCandidate?Object.fromEntries(['erpSource','erpManifest','crmSource','crmManifest','supervisorSource','supervisorManifest'].map(k=>[k,currentCandidate[k]])):{erpSource:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',erpManifest:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7',crmSource:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',crmManifest:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83',supervisorSource:'13bdf75a032ae8f694354a2e57b6ed382aec2f17',supervisorManifest:'195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'};
 need(Object.keys(expected).every(k=>before.profile?.[k]===expected[k]),'EXACT_CANDIDATE');
 need(profile.tasks?.length===2&&names.every(n=>profile.tasks.some(t=>t.name===n&&hash(Buffer.from(t.oldXml))===t.oldXmlSha256&&hash(Buffer.from(t.newXml))===t.newXmlSha256)),'TASKS');
 need(targets.every(role=>before.identities?.[role]?.ownerSid===owner)&&profile.oldWatchers?.length===2,'CAPTURED_IDENTITIES');
 need(profile.protectedProcesses?.length>0&&targets.every(role=>!profile.protectedProcesses.some(p=>p.pid===before.identities[role].pid)),'PROTECTED_NEVER_STOP');
 const beforeMatch=/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-([a-f0-9]{32})\.json$/.exec(profile.beforeImage?.path??'');need(beforeMatch&&before.runId===beforeMatch[1],'STOPPER_BEFORE_GUID');
 need(profile.stopper?.sha256==='79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'&&profile.stopper.path==='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-stopper-'+beforeMatch[1]+'.ps1','STOPPER');
 need(profile.journalDirectory==='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-'+beforeMatch[1],'RECOVERY_DIRECTORY');
 need(before.plan?.digest===p03TransitionDigest(before.plan)&&before.plan.newSettingsSha256===effectiveNewSha&&(!currentCandidate||before.plan.oldSettingsSha256===newSha),'PLAN');return true;
}
export function comparePr54InvarianceSnapshots(pre,post){
 need(pre?.database==='MELISA_ERP_P03_PR54_PRE_20261018'&&post?.database==='MELISA_ERP_P03_PR54_POST_20261018'&&pre.tables?.length===51&&post.tables?.length===51,'INVARIANCE_SCOPE');
 for(const snapshot of [pre,post])need(new Set(snapshot.tables.map(t=>t.table)).size===51&&snapshot.tables.every(t=>typeof t.table==='string'&&t.table.length>0&&Number.isSafeInteger(t.count)&&t.count>=0&&/^[a-f0-9]{64}$/i.test(t.sha256)),'INVARIANCE_TABLES');
 const fields=['tables','modules','permissions','memberships','principals'];need(fields.every(k=>Array.isArray(pre[k])&&Array.isArray(post[k])),'INVARIANCE_FIELDS');
 need(fields.every(k=>JSON.stringify(pre[k])===JSON.stringify(post[k])),'INVARIANCE_MISMATCH');
 return {equal:true,criticalTables:51,coverage:'51 business tables, readable modules, explicit permissions, memberships and principals; not all database contents'};
}
const currentDatabase='MELISA_ERP_CRM_SHARED_TEST_20261009_02',currentCopy='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const exactKeys=(x,keys)=>x&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join('|')===keys.toSorted().join('|');
const typedRef=r=>exactKeys(r,['path','sha256'])&&typeof r.path==='string'&&path.win32.normalize(r.path)===r.path&&!r.path.includes('/')&&/^[a-f0-9]{64}$/.test(r.sha256);
export function validatePr54CurrentPreCapture(refs,snapshot,proof,backup,{phase='Pre',now=Date.now(),backupRequired=true,nativeContinuity=null}={}){
 need(['Pre','Post'].includes(phase)&&exactKeys(refs,backupRequired?['snapshotRef','proofRef','backupProofRef']:['snapshotRef','proofRef']),'CURRENT_PRE_REFS');
 need(Object.values(refs).every(typedRef),'CURRENT_PRE_PIN');
 const found=/^(C:\\Sirket\\ERP\\backups\\(P03-202610(?:19|20|21)-\d{6}))\\source-(pre|post)-snapshot(?:-([a-f0-9]{32}))?\.json$/.exec(refs.snapshotRef.path);
 // A fresh Pre revision reuses the exact original backup; it never replaces
 // an older proof or relabels its clock. Historical dates and Post stay closed.
 need(found&&(!found[4]||(found[2].startsWith('P03-20261021-')&&phase==='Pre'))&&found[3]===phase.toLowerCase()&&refs.proofRef.path===found[1]+'\\source-'+phase.toLowerCase()+'-proof'+(found[4]?'-'+found[4]:'')+'.json'&&(!backupRequired||refs.backupProofRef.path===found[1]+'\\backup-verified.json'),'CURRENT_PRE_PATH');
 need(exactKeys(proof,['scope','phase','readOnly','criticalTablesHashed','server','database','copyId','actualT1','observedAt','startedAt','snapshotRef','restored','commercialWrites','sourceCaptureKind'])&&proof.scope==='CURRENT_DB02_READ_ONLY'&&proof.phase===phase&&proof.readOnly===true&&proof.criticalTablesHashed===51&&proof.server==='Semih\\MELISADEV'&&proof.database===currentDatabase&&proof.copyId===currentCopy&&proof.actualT1===false&&proof.restored===false&&proof.commercialWrites===false&&proof.sourceCaptureKind==='SERIALIZABLE_READ_ONLY_TRANSACTION'&&JSON.stringify(proof.snapshotRef)===JSON.stringify(refs.snapshotRef),'CURRENT_PRE_PROOF');
 const runFloor=Date.UTC(2026,9,found[2].startsWith('P03-20261021-')?21:found[2].startsWith('P03-20261020-')?20:19),observed=Date.parse(proof.observedAt);need(typeof proof.observedAt==='string'&&Number.isFinite(observed)&&Number.isFinite(now)&&observed>=runFloor&&typeof proof.startedAt==='string'&&Number.isFinite(Date.parse(proof.startedAt))&&Date.parse(proof.startedAt)>=runFloor&&Date.parse(proof.startedAt)<=observed&&now>=observed&&(now-observed<15*60000||(phase==='Pre'&&isPr54CurrentNativeContinuity(nativeContinuity,refs.snapshotRef,now))),'CURRENT_PRE_FRESH');
 if(phase==='Pre')need(typeof snapshot.logEndBefore==='string'&&/^[0-9a-f]{8}:[0-9a-f]{8}:[0-9a-f]{4}$/i.test(snapshot.logEndBefore)&&snapshot.logEndBefore===snapshot.logEndAfter,'CURRENT_SOURCE_LSN');
 need(snapshot?.database===currentDatabase,'CURRENT_SOURCE_DATABASE');comparePr54CurrentSourceSnapshots(snapshot,snapshot);
 if(backupRequired){need(backup&&backup.runId===found[2]&&backup.server==='Semih\\MELISADEV'&&backup.database===currentDatabase&&backup.copyId===currentCopy&&backup.actualT1===false&&backup.copyOnly===true&&backup.checksumVerified===true&&backup.restoreVerifyOnly===true&&backup.commercialWrites===false&&backup.sourceRestarted===false&&backup.restoreRehearsed===false&&backup.backupFile===found[1]+'\\DB02_COPY_ONLY.bak'&&/^[a-f0-9]{64}$/.test(backup.sha256)&&Number.isSafeInteger(backup.bytes)&&backup.bytes>0&&backup.observedAt===backup.completedAt&&typeof backup.startedAt==='string'&&Number.isFinite(Date.parse(backup.startedAt))&&Date.parse(backup.startedAt)>=runFloor&&Date.parse(backup.startedAt)<=Date.parse(backup.completedAt)&&Date.parse(backup.completedAt)<=observed,'CURRENT_BACKUP_PROOF');}
 return {runId:found[2],root:found[1],sourceReadOnly:true,restored:false};
}
export function comparePr54CurrentSourceSnapshots(pre,post){
 need(pre?.database===currentDatabase&&post?.database===currentDatabase&&pre.tables?.length===51&&post.tables?.length===51,'CURRENT_INVARIANCE_SCOPE');
 for(const snapshot of [pre,post])need(new Set(snapshot.tables.map(t=>t.table)).size===51&&snapshot.tables.every(t=>typeof t.table==='string'&&t.table.length>0&&Number.isSafeInteger(t.count)&&t.count>=0&&/^[a-f0-9]{64}$/i.test(t.sha256)),'CURRENT_INVARIANCE_TABLES');
 const fields=['tables','modules','permissions','memberships','principals'];need(fields.every(k=>Array.isArray(pre[k])&&Array.isArray(post[k])&&JSON.stringify(pre[k])===JSON.stringify(post[k])),'CURRENT_INVARIANCE_MISMATCH');
 return {equal:true,criticalTables:51,sourceReadOnly:true,restored:false,coverage:'51 business tables, readable modules, explicit permissions, memberships and principals; not all database contents'};
}
export function pr54CurrentSourceCaptureArgs(runId){need(/^P03-202610(?:19|20|21)-\d{6}$/.test(runId),'CURRENT_CAPTURE_RUN');return ['-Mode','SourceCapture','-Phase','Post','-RunId',runId];}
export function pr54CurrentContinuityProgram(snapshotRef,backup){
 need(typedRef(snapshotRef)&&/^C:\\Sirket\\ERP\\backups\\(?:P03-202610(?:19|20)-\d{6}\\source-pre-snapshot|P03-20261021-\d{6}\\source-pre-snapshot(?:-[a-f0-9]{32})?)\.json$/.test(snapshotRef.path)&&typeof backup?.backupSetGuid==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(backup.backupSetGuid),'CURRENT_CONTINUITY_INPUT');
 const sql=`SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server,DB_NAME() [database],LOWER(CONVERT(varchar(36),m.copy_id)) copyId,CONVERT(bit,CASE WHEN DB_NAME()=N'MELISA_ERP_CRM_SHARED_TEST_20261009_02' AND CAST(SERVERPROPERTY('ServerName') AS nvarchar(128))=N'Semih\\MELISADEV' AND m.copy_id=@copy AND m.sealed=1 THEN 0 ELSE 1 END) actualT1,CONVERT(bit,m.sealed) sealed,l.log_end_lsn logEnd,q.actual_state_desc queryStoreMode,CONVERT(varchar(36),b.backup_set_uuid) backupSetGuid,CONVERT(varchar(36),r.database_guid) databaseGuid,CONVERT(varchar(36),r.recovery_fork_guid) recoveryForkGuid,CONVERT(varchar(36),b.database_guid) backupDatabaseGuid,CONVERT(varchar(36),b.first_recovery_fork_guid) backupFirstRecoveryForkGuid,CONVERT(varchar(36),b.last_recovery_fork_guid) backupLastRecoveryForkGuid FROM dbo.stage4_copy_manifest m CROSS JOIN sys.dm_db_log_stats(DB_ID()) l CROSS JOIN sys.database_query_store_options q JOIN sys.database_recovery_status r ON r.database_id=DB_ID() JOIN msdb.dbo.backupset b ON b.backup_set_uuid=@backup AND b.database_name=DB_NAME() AND b.server_name=CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AND b.is_copy_only=1 AND b.has_backup_checksums=1 AND b.type='D' AND b.is_damaged=0 WHERE m.copy_id=@copy AND m.sealed=1`;
 return `$c=[Data.SqlClient.SqlConnection]::new('Server=Semih\\MELISADEV;Database=${currentDatabase};Integrated Security=True;Connect Timeout=5;Application Name=P03CurrentContinuityReadOnly');try{$c.Open();$q=$c.CreateCommand();$q.CommandTimeout=5;$q.CommandText=${quote(sql)};$p=$q.Parameters.Add('@copy',[Data.SqlDbType]::UniqueIdentifier);$p.Value=[Guid]'${currentCopy}';$p=$q.Parameters.Add('@backup',[Data.SqlDbType]::UniqueIdentifier);$p.Value=[Guid]'${backup.backupSetGuid}';$r=$q.ExecuteReader();try{if(-not$r.Read()){throw 'CONTINUITY_MISSING'};$v=[ordered]@{};for($i=0;$i-lt$r.FieldCount;$i++){if($r.IsDBNull($i)){throw 'CONTINUITY_NULL'};$v[$r.GetName($i)]=$r.GetValue($i)};if($r.Read()){throw 'CONTINUITY_MULTIPLE'};$v.observedAt=[DateTime]::UtcNow.ToString('o');$v.readOnly=$true;$v.snapshotRef=${`([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(JSON.stringify(snapshotRef)).toString('base64')}'))|ConvertFrom-Json)`};$v|ConvertTo-Json -Depth 4 -Compress}finally{$r.Dispose()}}finally{$c.Dispose()}`;
}
export function pr54CurrentReadPinsProgram(refs){
 const fixed=[PR54_PREDECESSOR_REFS.globalLock,...Object.values(PR54_CURRENT_REFS),...PR54_CURRENT_JOURNAL_REFS];
 need(Array.isArray(refs)&&refs.length>0&&refs.length<=8&&refs.every(r=>typedRef(r)&&(!fixed.some(p=>p.path===r.path)||fixed.some(p=>p.path===r.path&&p.sha256===r.sha256))&&(fixed.some(p=>p.path===r.path&&p.sha256===r.sha256)||/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-(?:profile|before)-[a-f0-9]{32}\.json$/.test(r.path)||/^C:\\Sirket\\ERP\\backups\\P03-202610(?:19|20|21)-\d{6}\\(?:source-(?:pre|post)-(?:snapshot|proof)|backup-verified)\.json$/.test(r.path)||/^C:\\Sirket\\ERP\\backups\\P03-20261021-\d{6}\\source-pre-(?:snapshot|proof)-[a-f0-9]{32}\.json$/.test(r.path))),'CURRENT_READ_PIN_SCOPE');
 const encoded=Buffer.from(JSON.stringify(refs)).toString('base64');
 return `foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Security')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,$name+'.psd1')) -ErrorAction Stop};$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json;foreach($r in $pins){$p=$r.path;${psNoReparse}$i=Get-Item -LiteralPath $p -Force;if($i.PSIsContainer-or($i.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'CURRENT_READ_FILE'};$a=Get-Acl -LiteralPath $p;$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne'${owner}'-or$rules.Count-ne2){throw 'CURRENT_READ_ACL'};foreach($sid in @('${owner}','S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'CURRENT_READ_ACL'}};if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()-cne$r.sha256){throw 'CURRENT_READ_HASH'}};'VERIFIED'`;
}
export async function claimPr54CurrentOwnerSuccessorIO({inspect,createNew,readClaim,guardProtected}){
 need([inspect,createNew,readClaim,guardProtected].every(fn=>typeof fn==='function'),'CURRENT_CLAIM_DEPENDENCIES');
 need(await guardProtected()===true,'CURRENT_CLAIM_PROTECTED');const first=await inspect(),proposal=first?.proposedCreateNew;
 need(first?.claimPath===PR54_CURRENT_SUCCESSOR_CLAIM_PATH&&first.claim?.schemaVersion==='melisa-p03-current-owner-successor-claim.v1'&&first.claim.predecessorRunId==='7b0821959737f1da0427b17a7dfd4685'&&/^[a-f0-9]{64}$/.test(first.proofDigest)&&typedRef(proposal?.ref)&&proposal.ref.path===first.claimPath&&proposal.bytes instanceof Uint8Array&&hash(proposal.bytes)===proposal.ref.sha256&&Buffer.from(proposal.bytes).equals(jsonBytes(first.claim)),'CURRENT_CLAIM_PROPOSAL');
 need(await guardProtected()===true,'CURRENT_CLAIM_PROTECTED');const made=await createNew(proposal);need(made?.created===true&&JSON.stringify(made.ref)===JSON.stringify(proposal.ref),'CURRENT_CLAIM_CREATED');
 need(await guardProtected()===true,'CURRENT_CLAIM_PROTECTED');const second=await inspect();need(JSON.stringify(first)===JSON.stringify(second),'CURRENT_CLAIM_DRIFT');
 const actual=await readClaim(proposal.ref);need(actual instanceof Uint8Array&&hash(actual)===proposal.ref.sha256&&Buffer.from(actual).equals(Buffer.from(proposal.bytes)),'CURRENT_CLAIM_READBACK');return Object.freeze({...proposal.ref});
}
// Finite B264 history reader only. Deliberately not wired into the legacy
// claim writer or runPr54SharedOwnerTransition, both of which still reject it.
function b264ReadPins(){return [...Object.values(PR54_B264_REFS),...PR54_B264_OUTER_REFS,...PR54_B264_RECOVERY_REFS];}
export function pr54B264ReadPinsProgram(refs){
 const fixed=b264ReadPins();need(Array.isArray(refs)&&refs.length>0&&refs.length<=8&&new Set(refs.map(r=>r?.path)).size===refs.length&&refs.every(r=>typedRef(r)&&fixed.some(p=>p.path===r.path&&p.sha256===r.sha256)),'B264_READ_PIN_SCOPE');
 const encoded=Buffer.from(JSON.stringify(refs)).toString('base64');
 const recoveryDirectory=path.win32.dirname(PR54_B264_RECOVERY_REFS[0].path);
 return `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Security')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,$name+'.psd1')) -ErrorAction Stop};function TestB264Acl($a,[bool]$inherited){$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne'${owner}'-or$rules.Count-ne2){return $false};foreach($sid in @('${owner}','S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and$_.IsInherited-eq$inherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){return $false}};return $true};$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json;foreach($r in $pins){$p=$r.path;${psNoReparse}$i=Get-Item -LiteralPath $p -Force;if($i.PSIsContainer-or($i.Attributes-band[IO.FileAttributes]::ReparsePoint)-or$i.Length-gt16777216){throw 'B264_READ_FILE'};$a=Get-Acl -LiteralPath $p;$strict=$a.AreAccessRulesProtected-and(TestB264Acl $a $false);if(-not$strict){$allowed=$p-cin@(${quote(path.win32.join(recoveryDirectory,'recovery.lock'))},${quote(path.win32.join(recoveryDirectory,'rollback.lock'))})-and$i.Length-eq0-and$r.sha256-ceq'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';if(-not$allowed-or$a.AreAccessRulesProtected-or-not(TestB264Acl $a $true)){throw 'B264_READ_ACL'};$parent=Get-Acl -LiteralPath ([IO.Path]::GetDirectoryName($p));if(-not$parent.AreAccessRulesProtected-or-not(TestB264Acl $parent $false)){throw 'B264_READ_PARENT_ACL'}};if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()-cne$r.sha256){throw 'B264_READ_HASH'}};'VERIFIED'`;
}
export async function inspectPr54B264PredecessorIO(...args){
 need(args.length===0&&process.platform==='win32','B264_READ_MODE');
 const fixed=b264ReadPins();need(fixed.length<=64&&new Set(fixed.map(r=>r.path)).size===fixed.length,'B264_READ_PIN_COUNT');
 async function guard(){
  need(!fs.existsSync(PR54_B264_SUCCESSOR_CLAIM_PATH),'B264_SUCCESSOR_ALREADY_CONSUMED');
  for(let offset=0;offset<fixed.length;offset+=8){const program=pr54B264ReadPinsProgram(fixed.slice(offset,offset+8)),encoded=Buffer.from(program,'utf16le').toString('base64');need(encoded.length<16000,'B264_READ_COMMAND_LIMIT');const result=await run(shell,['-NoProfile','-NonInteractive','-EncodedCommand',encoded],opts);need(!result.stderr&&result.stdout.trim()==='VERIFIED','B264_READ_PIN_ACL');}
  for(const refs of [PR54_B264_OUTER_REFS,PR54_B264_RECOVERY_REFS]){const directory=path.win32.dirname(refs[0].path),actual=fs.readdirSync(directory).filter(n=>n.startsWith('event-')).sort(),expected=refs.map(r=>path.win32.basename(r.path)).sort();need(JSON.stringify(actual)===JSON.stringify(expected),'B264_READ_EVENT_SCOPE');}
 }
 await guard();const raw=Object.fromEntries(Object.entries(PR54_B264_REFS).map(([key,ref])=>[key,{ref,bytes:pin(ref)}]));raw.outer=PR54_B264_OUTER_REFS.map(ref=>({ref,bytes:pin(ref)}));raw.recovery=PR54_B264_RECOVERY_REFS.map(ref=>({ref,bytes:pin(ref)}));
 const proof=validatePr54B264Predecessor(raw);await guard();
 return {status:'B264_PREDECESSOR_HISTORY_VALIDATED',proof,observedAt:new Date().toISOString(),applyExecuted:false,claimCreated:false,observerOnly:true,transitionAuthority:false,stopAuthority:false,engineOutcome:'ROLLBACK_READBACK_FAILED'};
}
export function pr54SuccessorEmptyProgram({ids,consoles}){
 need(Array.isArray(ids)&&ids.length<=256&&ids.every(x=>Number.isSafeInteger(x)&&x>0)&&Array.isArray(consoles)&&consoles.length<=128,'SUCCESSOR_EMPTY_SCOPE');
 const data=Buffer.from(JSON.stringify({ids:[...new Set(ids)],consoles})).toString('base64');
 return `$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;$until=[DateTime]::UtcNow.AddSeconds(15);do{$all=@(Get-CimInstance Win32_Process -ErrorAction Stop);$remaining=@($all|Where-Object{$_.ProcessId-in$pins.ids-or$_.ParentProcessId-in$pins.ids});if($remaining.Count-eq0){'EMPTY';return};foreach($p in $remaining){$saved=@($pins.consoles|Where-Object{$_.pid-eq$p.ProcessId});if($saved.Count-ne1){throw 'P03_SUCCESSOR_UNKNOWN_REMAINING'};$e=$saved[0];$sid=Invoke-CimMethod $p -MethodName GetOwnerSid -ErrorAction Stop;if($sid.ReturnValue-ne0-or$sid.Sid-cne$e.ownerSid-or$p.ParentProcessId-ne$e.parentPid-or$p.ExecutablePath-ine$e.nodePath-or$p.CommandLine-cne$e.commandLine-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTime]::Parse($e.creationTime).ToUniversalTime().Ticks){throw 'P03_SUCCESSOR_CONSOLE_REUSED'};if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object OwningProcess -eq $p.ProcessId).Count-ne0){throw 'P03_SUCCESSOR_CONSOLE_LISTENER'}};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow-lt$until);'REMAINS'`;
}
export async function runPr54SharedOwnerTransition({mode='DryRun',profileRef,beforeRef,engineRef,observerRef,invarianceScriptRef,preSnapshotRef,preProofRef,rehearsalProofRef,predecessorRef=null,successorDrainerRef=null,recoveryHelperRef=null,newOwnerObserverRef=null,currentOwnerCandidate=null,currentPreCapture=null}){
 need(['DryRun','Apply'].includes(mode)&&process.platform==='win32','MODE_PLATFORM');
 const currentMode=currentOwnerCandidate!==null;need(!currentMode||JSON.stringify(predecessorRef)===JSON.stringify(PR54_CURRENT_REFS.profile),'CURRENT_PREDECESSOR');need(currentMode||currentPreCapture===null,'CURRENT_PRE_SCOPE');
 const profileBytes=pin(profileRef),beforeBytes=pin(beforeRef),profile=JSON.parse(profileBytes),before=JSON.parse(beforeBytes);assertPr54SharedProfile(profile,before,currentOwnerCandidate);need(JSON.stringify(profile.beforeImage)===JSON.stringify(beforeRef),'BEFORE_BINDING');
 need(/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-profile-[a-f0-9]{32}\.json$/.test(profileRef.path)&&/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-[a-f0-9]{32}\.json$/.test(beforeRef.path),'PROFILE_PATH');
 for(const [ref,leaf] of [[engineRef,'p03-physical-rollback.ps1'],[observerRef,'p03-physical-recovery-observe.ps1'],[invarianceScriptRef,currentMode?'p03-current-invariance-capture.ps1':'p03-pr54-invariance-capture.ps1']]){need(path.win32.basename(ref.path)===leaf,'HELPER_PATH');pin(ref);}
 if(predecessorRef!==null)for(const [ref,leaf] of [[successorDrainerRef,'p03-pr54-successor-core-drain.ps1'],[recoveryHelperRef,'p03-pr54-paused-old-recover.ps1'],[newOwnerObserverRef,'p03-pr54-new-owner-observe.ps1']]){need(ref&&path.win32.basename(ref.path)===leaf,'SUCCESSOR_DRAIN_HELPER');pin(ref);}
 const pre=read(preSnapshotRef),preProof=read(preProofRef),rehearsal=read(rehearsalProofRef);
 need(preSnapshotRef.path==='C:\\Sirket\\ERP\\backups\\P03-20261018-140001\\invariance-readonly\\restored-snapshot.json'&&preProofRef.path==='C:\\Sirket\\ERP\\backups\\P03-20261018-140001\\invariance-readonly\\invariance-capture-verified.json','PRE_PATH');
 need(preProof.phase==='Pre'&&preProof.readOnly===true&&preProof.dbccCheckdbPassed===true&&preProof.criticalTablesHashed===51,'PRE_PROOF');
 need(rehearsal.status==='REHEARSAL_ROLLBACK_READY'&&rehearsal.environment==='P03_REHEARSAL'&&rehearsal.sharedTestMutation===false&&rehearsal.protectedBeforeSha256===rehearsal.protectedAfterSha256,'ACTUAL_REHEARSAL_REQUIRED');
 need(rehearsal.engineSha256===engineRef.sha256&&rehearsal.engine?.sha256===engineRef.sha256,'SAME_REHEARSED_ENGINE_REQUIRED');
 need(!currentMode||exactKeys(currentPreCapture,['snapshotRef','proofRef','backupProofRef']),'CURRENT_PRE_REFS');
 const sourcePre=currentMode?{snapshot:read(currentPreCapture.snapshotRef),proof:read(currentPreCapture.proofRef),backup:read(currentPreCapture.backupProofRef)}:null;
 let nativeContinuity=null;
 async function readCurrentContinuity(){
  need(currentMode&&JSON.stringify(profile.businessDigest)===JSON.stringify(currentPreCapture.snapshotRef),'CURRENT_CONTINUITY_BINDING');
  await guardProtected();pin(currentPreCapture.snapshotRef);pin(currentPreCapture.backupProofRef);
  const observation=JSON.parse(await ps(pr54CurrentContinuityProgram(currentPreCapture.snapshotRef,sourcePre.backup)));
  await guardProtected();nativeContinuity=preparePr54CurrentNativeContinuity(currentPreCapture.snapshotRef,sourcePre.snapshot,observation,sourcePre.backup);return nativeContinuity;
 }
 if(currentMode)await readCurrentContinuity();
 const sourceCapture=currentMode?validatePr54CurrentPreCapture(currentPreCapture,sourcePre.snapshot,sourcePre.proof,sourcePre.backup,{nativeContinuity}):null;
 const successorClaimPath=currentMode?PR54_CURRENT_SUCCESSOR_CLAIM_PATH:PR54_SUCCESSOR_CLAIM_PATH;
 const sharedArgs=['-Environment','Shared','-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256];
 async function engine(action,extra=[]){pin(engineRef);pin(profileRef);pin(beforeRef);const r=await run(shell,['-NoProfile','-NonInteractive','-File',engineRef.path,...sharedArgs,'-Mode',action,...extra],{...opts,timeout:900000});need(!r.stderr,'ENGINE_STDERR');return JSON.parse(r.stdout);}
 function observationPolicyArgs(engine=engineRef,helper=recoveryHelperRef){
  if(predecessorRef===null)return [];
  pin(profileRef);pin(beforeRef);pin(engine);pin(helper);
  return ['-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-EnginePath',engine.path,'-EngineSha256',engine.sha256,'-RecoveryHelperPath',helper.path,'-RecoveryHelperSha256',helper.sha256];
 }
 async function observeRef(ref){return pr54CollectPhysicalObservation(async()=>{pin(ref);const r=await run(shell,['-NoProfile','-NonInteractive','-File',ref.path,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256,...observationPolicyArgs()],opts);need(!r.stderr,'OBSERVER_STDERR');return assertPr54ObservationAuthority(JSON.parse(r.stdout),false);},'REFERENCE_OBSERVER');}
 async function inspectOldOwnerPhysical(current=null){return pr54CollectPhysicalObservation(async()=>{
  pin(successorDrainerRef);pin(recoveryHelperRef);pin(engineRef);
  const r=await run(shell,['-NoProfile','-NonInteractive','-File',successorDrainerRef.path,'-Mode','Inspect',...sharedArgs.slice(2),'-EnginePath',engineRef.path,'-EngineSha256',engineRef.sha256,'-RecoveryHelperPath',recoveryHelperRef.path,'-RecoveryHelperSha256',recoveryHelperRef.sha256],{...opts,timeout:180000});need(!r.stderr,'SUCCESSOR_INSPECT_STDERR');const frame=JSON.parse(r.stdout);
  need(frame.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&frame.profileSha256===profileRef.sha256&&frame.beforeSha256===beforeRef.sha256&&frame.engineSha256===engineRef.sha256&&frame.recoveryHelperSha256===recoveryHelperRef.sha256&&Date.now()-Date.parse(frame.observedAt)>=0&&Date.now()-Date.parse(frame.observedAt)<60000&&frame.oldIdentities?.length===8&&frame.oldWatchers?.length===2,'SUCCESSOR_INSPECT_FRAME');
  need(Object.values(before.identities).every(p=>frame.oldIdentities.some(q=>sameIdentity(p,q)))&&profile.oldWatchers.every(p=>frame.oldWatchers.some(q=>sameIdentity(p,q))),'SUCCESSOR_INSPECT_IDENTITY');
  if(current!==null){const aux=validatePr54CurrentPhysicalInspection({frame,current,profile,before,profileRef,beforeRef,engineRef,recoveryHelperRef});const token=Object.freeze({});currentPhysicalInspections.set(token,{current,profile,before,profileRef:Object.freeze({...profileRef}),beforeRef:Object.freeze({...beforeRef}),engineRef:Object.freeze({...engineRef}),recoveryHelperRef:Object.freeze({...recoveryHelperRef}),observedAt:frame.observedAt,aux,digest:hash(jsonBytes({current,profile,before}))});return token;}return frame;
 },'SUCCESSOR_INSPECT');
 }
 async function inspectSuccessor(observed){
  need(predecessorRef!==null&&engineRef.sha256===PR54_REHEARSED_ENGINE_SHA,'SUCCESSOR_ENGINE');
  if(currentMode){
   const checked=[PR54_PREDECESSOR_REFS.globalLock,...Object.values(PR54_CURRENT_REFS),...PR54_CURRENT_JOURNAL_REFS,profileRef,beforeRef,...Object.values(currentPreCapture)];
   for(let offset=0;offset<checked.length;offset+=8)need(await ps(pr54CurrentReadPinsProgram(checked.slice(offset,offset+8)))==='VERIFIED','CURRENT_PIN_ACL');
   pin(PR54_PREDECESSOR_REFS.globalLock);const raw=Object.fromEntries(Object.entries(PR54_CURRENT_REFS).map(([key,ref])=>[key,{ref,bytes:pin(ref)}]));raw.journal=PR54_CURRENT_JOURNAL_REFS.map(ref=>({ref,bytes:pin(ref)}));
   const directory=path.win32.dirname(PR54_CURRENT_JOURNAL_REFS[0].path);need(JSON.stringify(fs.readdirSync(directory).filter(n=>/^event-/.test(n)).sort())===JSON.stringify(PR54_CURRENT_JOURNAL_REFS.map(r=>path.win32.basename(r.path)).sort()),'CURRENT_JOURNAL_SCOPE');
   const {current,physicalInspection}=await collectPr54CurrentInspectionPair(async()=>{await currentOld(()=>observeRef(observerRef));await inspectOldOwnerPhysical();const current=await currentOld(()=>observeRef(observerRef));const physicalInspection=await inspectOldOwnerPhysical(current);return {current,physicalInspection};});await guardProtected();
   await readCurrentContinuity();const proposal=admitPr54CurrentOwnerSuccessor({raw,profileRef,beforeRef,profileBytes:pin(profileRef),beforeBytes:pin(beforeRef),profile,before,current,candidate:currentOwnerCandidate,nativeContinuity,physicalInspection});
   validatePr54CurrentPreCapture(currentPreCapture,read(currentPreCapture.snapshotRef),read(currentPreCapture.proofRef),read(currentPreCapture.backupProofRef),{nativeContinuity});return proposal;
  }
  const refs=pr54OwnerSuccessorRefs(predecessorRef),previous={},raw={},checked=[];
  for(const[key,ref]of Object.entries(PR54_PREDECESSOR_REFS)){const bytes=pin(ref);checked.push(ref);if(key!=='engine')previous[key]=JSON.parse(bytes);}
  assertPr54SharedProfile(previous.profile,previous.before);
  for(const key of ['recoveryResult','candidate','consoleIntent','consoleCut']){const ref=refs[key];raw[key]={ref,bytes:pin(ref)};checked.push(ref);}
  const journalNames=['recovery.lock','rollback.lock',...Array.from({length:8},(_,n)=>'event-'+String(n).padStart(4,'0')+'.json')];
  need(JSON.stringify(fs.readdirSync(PR54_PREDECESSOR_JOURNAL).sort())===JSON.stringify(journalNames.sort()),'SUCCESSOR_JOURNAL_SCOPE');
  need(JSON.stringify(fs.readdirSync(PR54_PREDECESSOR_TRANSITION).filter(name=>/^event-/.test(name)).sort())===JSON.stringify(['event-0000.json','event-0001.json']),'SUCCESSOR_TRANSITION_ADVANCED');
  for(const leaf of ['late-old-owner-observation-failed.json','paused-old-core-cut-observation.json','paused-old-recovery-result.json','paused-old-console-recovery-result.json'])need(!fs.existsSync(path.win32.join(PR54_PREDECESSOR_TRANSITION,leaf)),'SUCCESSOR_FAILED_OR_AMBIGUOUS');
  raw.journal=Array.from({length:8},(_,n)=>{const file=path.win32.join(PR54_PREDECESSOR_JOURNAL,'event-'+String(n).padStart(4,'0')+'.json'),bytes=fs.readFileSync(file),ref={path:file,sha256:hash(bytes)};pin(ref);checked.push(ref);return {ref,bytes};});
  for(const leaf of ['recovery.lock','rollback.lock']){const file=path.win32.join(PR54_PREDECESSOR_JOURNAL,leaf),ref={path:file,sha256:hash(Buffer.alloc(0))};pin(ref);checked.push(ref);}
  // Read-only ACL/hash validation on every gate. No predecessor bytes change.
  const pins=Buffer.from(JSON.stringify(checked)).toString('base64');
  await ps(`foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Security')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,$name+'.psd1')) -ErrorAction Stop};$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${pins}'))|ConvertFrom-Json;foreach($r in $pins){$p=$r.path;${psNoReparse}$i=Get-Item -LiteralPath $p -Force;if($i.PSIsContainer-or($i.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'SUCCESSOR_FILE'};$a=Get-Acl -LiteralPath $p;$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));$inheritedLock=$false;if(-not$a.AreAccessRulesProtected){$allowedLocks=@('C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-639e2da815e1e7ac0f1c0d04d7f7bdc3\\recovery.lock','C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-639e2da815e1e7ac0f1c0d04d7f7bdc3\\rollback.lock');if($p-cnotin$allowedLocks-or$r.sha256-cne'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'-or$i.Length-ne0){throw 'SUCCESSOR_ACL'};$pa=Get-Acl -LiteralPath ([IO.Path]::GetDirectoryName($p));$pr=@($pa.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$pa.AreAccessRulesProtected-or$pa.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne'${owner}'-or$pr.Count-ne2){throw 'SUCCESSOR_PARENT_ACL'};foreach($sid in @('${owner}','S-1-5-18')){if(@($pr|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'SUCCESSOR_PARENT_ACL'}};$inheritedLock=$true};if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne'${owner}'-or$rules.Count-ne2){throw 'SUCCESSOR_ACL'};foreach($sid in @('${owner}','S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and$_.IsInherited-eq$inheritedLock-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'SUCCESSOR_ACL'}};if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()-cne$r.sha256){throw 'SUCCESSOR_HASH'}};'VERIFIED'`);
  pin(profileRef);pin(beforeRef);await guardProtected();
  const current=observed??await observeRef(observerRef);
  // The same physical classifier used before the core cut authenticates the
  // OLD monitor's live read-only probes on each side of the atomic claim.
  // Generic prestart fallback stays strict and is not a startup admission.
  await inspectOldOwnerPhysical();
  return admitPr54OwnerSuccessor({predecessorRef,previous,raw,profileRef,beforeRef,profile,before,current});
 }
 need((await engine('PreflightOld')).status==='OLD_PHYSICAL_PREFLIGHT','OLD_PREFLIGHT');
 need(await ps(`[Security.Principal.WindowsIdentity]::GetCurrent().User.Value`)===owner,'CALLER');
 if(predecessorRef!==null){need(!fs.existsSync(successorClaimPath),'SUCCESSOR_ALREADY_CONSUMED');await inspectSuccessor();}
 if(mode==='DryRun')return {status:'DRY_RUN_ONLY',applyExecuted:false,exactCandidate:before.profile,newSettingsSha256:profile.newSettings.sha256,...(predecessorRef?{successorClaimPath}:{})};
 const runId=path.win32.basename(profileRef.path).match(/([a-f0-9]{32})\.json$/)[1];
 const globalOwnerLock='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\p03-pr54-shared-owner.lock.json';
 if(predecessorRef===null)need(!fs.existsSync(globalOwnerLock),'OTHER_OWNER_OR_PRIOR_RUN');
 else need(!fs.existsSync(successorClaimPath),'SUCCESSOR_ALREADY_CONSUMED');
 const transitionDir=path.win32.join('C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018','MelisaERP-P03-transition-'+runId);
 need(!fs.existsSync(transitionDir)&&fs.readdirSync(profile.journalDirectory).length===0,'PRIOR_JOURNAL');
 noReparseAncestors(transitionDir);await ps(`$p=${quote(transitionDir)};${psNoReparse}if(Test-Path -LiteralPath $p){throw 'EXISTS'};$s=[Security.AccessControl.DirectorySecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new('${owner}'));$s.SetAccessRuleProtection($true,$false);foreach($id in @('${owner}','S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($p,$s);'CREATED'`);
 const backupRef=currentMode?null:{path:path.win32.join(path.win32.dirname(invarianceScriptRef.path),'p03-test-backup.ps1'),sha256:'5700edc949f377aff61c426492606e696a2af06bdd1824e7d7516b9b837fdfcb'};if(backupRef)pin(backupRef);
 const frozen={};for(const [name,ref] of [['engine',engineRef],['observer',observerRef],['invariance',invarianceScriptRef],...(backupRef?[['backup',backupRef]]:[])]){const file=path.win32.join(transitionDir,path.win32.basename(ref.path));frozen[name]=await protectedWrite(file,pin(ref));}
 if(predecessorRef!==null)for(const [name,ref]of [['drainer',successorDrainerRef],['pausedHelper',recoveryHelperRef],['newObserver',newOwnerObserverRef]])frozen[name]=await protectedWrite(path.win32.join(transitionDir,path.win32.basename(ref.path)),pin(ref));
 async function protectedWrite(file,bytes){need(predecessorRef===null||file!==globalOwnerLock,'PREDECESSOR_IMMUTABLE');assertPr54WriteScope(file,transitionDir,globalOwnerLock,predecessorRef?successorClaimPath:null);noReparseAncestors(file);const sha256=hash(bytes);await psPayload(pr54ProtectedWriteProgram(file,sha256),bytes);const ref={path:file,sha256};pin(ref);return ref;}
 async function physical(){return pr54CollectPhysicalObservation(async()=>{
  pin(frozen.observer);
  // A role-only proposal is permitted only after this controller actually
  // requested NEW task startup. It cannot admit or stop an OLD owner. The
  // independent NEW observer still proves the complete raw inventory below.
  const proposal=predecessorRef!==null&&startAttempted;
  const r=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.observer.path,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256,...observationPolicyArgs(frozen.engine,frozen.pausedHelper),...(proposal?['-Purpose','CandidateProposal']:[])],opts);
  need(!r.stderr,'OBSERVER_STDERR');const frame=JSON.parse(r.stdout);
  return assertPr54ObservationAuthority(frame,proposal);
 });}
 async function taskState(kind,state){const value=await physical();return names.every(name=>{const t=value.tasks.find(t=>t.name===name),pin=profile.tasks.find(t=>t.name===name);return t&&t.state===state&&hash(Buffer.from(t.xml))===pin[kind+'XmlSha256'];});}
 async function empty(){
  const seen=await physical();const clear=seen.bindings.length===0&&seen.runningInstances.length===0&&!seen.processes.some(p=>[...profile.packages.map(x=>x.root),'watch-terminal-completion-logon.ps1','watch-hub-after-erp.ps1'].some(x=>p.commandLine.toLowerCase().includes(x.toLowerCase())));
  if(!clear||predecessorRef===null)return clear;
  need(successorSnapshotRef&&successorDrainProof,'SUCCESSOR_DRAIN_REQUIRED');
  const snapshot=read(successorSnapshotRef),drain=read(successorDrainProof.drainWitness),ids=[...Object.values(before.identities),...profile.oldWatchers,...snapshot.consolePins,...snapshot.probePins,...drain.consolePins,...drain.probePins].map(p=>p.pid);
  // Global CIM absence includes orphan consoles and descendants even when the
  // application observer no longer has a live parent from which to discover them.
  const consoles=[...new Map([...snapshot.consolePins,...drain.consolePins].map(p=>[p.pid,p])).values()];
  return await ps(pr54SuccessorEmptyProgram({ids,consoles}))==='EMPTY';
 }
 const exact=sameIdentity;
 async function guardProtected(){
 const data=Buffer.from(JSON.stringify(profile.protectedProcesses)).toString('base64');
 await ps(`$expected=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;foreach($e in $expected){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$e.pid);if(-not$p-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTime]::Parse($e.creationTime).ToUniversalTime().Ticks){throw 'PROTECTED_BIRTH'};if($e.PSObject.Properties.Name-contains'kind'-and$e.kind-ceq'ProtectedSqlService'){$v=@(Get-CimInstance Win32_Service -Filter 'Name="MSSQL$MELISADEV"');if($p.Name-cne'sqlservr.exe'-or$v.Count-ne1-or$v[0].ProcessId-ne$e.pid-or$v[0].State-cne'Running'-or$v[0].StartName-cne$e.service.startName-or$v[0].PathName-cne$e.service.pathName){throw 'SQL_PROTECT'};$c=[Data.SqlClient.SqlConnection]::new(${quote(PR54_PROTECT_SQL_CONNECTION)});$c.Open();try{$q=$c.CreateCommand();$q.CommandTimeout=5;$q.CommandText="SELECT CAST(SERVERPROPERTY('ProcessID') AS int),CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)),DB_NAME()";$reader=$q.ExecuteReader();try{if(-not$reader.Read()-or$reader.GetInt32(0)-ne$e.pid-or$reader.GetString(1)-cne'Semih\\MELISADEV'-or$reader.GetString(2)-cne'master'){throw 'SQL_MASTER_IDENTITY'}}finally{$reader.Dispose()}}finally{$c.Dispose()}}else{$o=Invoke-CimMethod $p -MethodName GetOwnerSid;if($o.ReturnValue-ne0-or$o.Sid-cne$e.ownerSid-or$p.ExecutablePath-ine$e.nodePath-or$p.CommandLine-cne$e.commandLine-or$p.ParentProcessId-ne$e.parentPid){throw 'PROTECTED_IDENTITY'}}};'UNCHANGED'`);
 return true;
 }
 async function currentOld(observe=physical){await guardProtected();const seen=await observe();need(Number.isFinite(Date.parse(seen.observedAt))&&Date.now()-Date.parse(seen.observedAt)>=0&&Date.now()-Date.parse(seen.observedAt)<60000,'STALE');need(names.every(n=>{const t=seen.tasks.find(x=>x.name===n),p=profile.tasks.find(x=>x.name===n);return t?.state===4&&hash(Buffer.from(t.xml))===p.oldXmlSha256;}),'OLD_TASK_DRIFT');for(const role of targets)need(sameIdentity(seen.processes.find(p=>p.pid===before.identities[role].pid),before.identities[role]),'OLD_PROCESS_DRIFT');const bindings=targets.flatMap(role=>(before.identities[role].bindings??[]).map(b=>({...b,pid:before.identities[role].pid}))),normalized=rows=>JSON.stringify(rows.map(b=>[b.port,b.address,b.pid]).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1])||a[2]-b[2]));need(normalized(seen.bindings)===normalized(bindings),'OLD_PORT_OWNER_DRIFT');return seen;}
 let startAttempted=false,taskStopAttempted=false,admittedOld=null,sequence=0,previous=beforeRef.sha256,candidateRef=null,lastCallbackFailure=null;
 const eventRefs=[];
 async function persist(record){need(record.sequence===sequence,'EVENT_SEQUENCE');for(const ref of eventRefs)pin(ref);const ref=await protectedWrite(path.win32.join(transitionDir,'event-'+String(sequence).padStart(4,'0')+'.json'),jsonBytes({...record,previousSha256:previous,profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256}));eventRefs.push(ref);previous=ref.sha256;sequence++;return {created:true,sequence:record.sequence};}
 async function changeAction(name,kind){const entry=profile.tasks.find(t=>t.name===name);need(entry,'TASK_NAME');const observed=await physical(),t=observed.tasks.find(x=>x.name===name);need(t?.state===3,'TASK_NOT_READY');const actual=hash(Buffer.from(t.xml));need([entry.oldXmlSha256,entry.newXmlSha256].includes(actual),'FOREIGN_ACTION');if(actual===entry[kind+'XmlSha256'])return true;await ps(`$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');$t=$f.GetTask(${quote(name)});$bytes=[Text.Encoding]::UTF8.GetBytes([string]$t.Xml);$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant();if([int]$t.State-ne3-or$sha-cne'${actual}'){throw 'ACTION_CAS'};[void]$f.RegisterTask(${quote(name)},[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(entry[kind+'Xml']).toString('base64')}')),4,'${owner}',$null,3,$null);'SET'`);return true;}
 async function captureCandidate(){
  const seen=await physical(),selected=[],receipts=[];
  for(const process of (predecessorRef===null?selectPr54CandidateProcesses:proposePr54CandidateProcesses)(seen,profile)){const matching=profile.candidateRules.filter(rule=>rule.nodePath===process.nodePath&&JSON.stringify(nativeArgumentTokens(rule.commandLine))===JSON.stringify(nativeArgumentTokens(process.commandLine)));need(matching.length===1,'FOREIGN_CANDIDATE');const rule=matching[0];need(!Object.values(before.identities).some(old=>old.pid===process.pid)&&!profile.oldWatchers.some(old=>old.pid===process.pid),'OLD_PID_REUSE');selected.push({...process,role:rule.role,bindings:seen.bindings.filter(b=>b.pid===process.pid).map(b=>({port:b.port,address:b.address}))});if(rule.receipt){const bytes=fs.readFileSync(rule.receipt.path);receipts.push({role:rule.role,path:rule.receipt.path,sha256:hash(bytes)});}}
  if(selected.some(x=>x.role==='hub')){const current=selected.find(x=>x.role==='hub'),directory='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\hub-web';const found=[];for(const leaf of fs.readdirSync(directory).filter(x=>/^hub-web-process-[a-f0-9]{32}-[0-3]\.json$/.test(x))){const file=path.win32.join(directory,leaf),bytes=fs.readFileSync(file);let rec;try{rec=JSON.parse(bytes);}catch{continue;}if(rec.pid!==current.pid&&rec.processId!==current.pid)continue;const lineagePath=file.replace('hub-web-process-','hub-web-lineage-');found.push({role:'hub',path:file,sha256:hash(bytes),lineagePath,lineageSha256:hash(fs.readFileSync(lineagePath))});}need(found.length===1,'HUB_RECEIPT');receipts.push(found[0]);}
  need(new Set(selected.map(x=>x.role)).size===selected.length,'DUPLICATE_ROLE');const value={schemaVersion:'melisa-p03-physical-candidate.v1',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,observedAt:seen.observedAt,processes:selected,receipts};return {value,ref:await protectedWrite('C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-candidate-'+crypto.randomBytes(16).toString('hex')+'.json',jsonBytes(value))};
 }
 async function useFrozenEngine(action,extra=[]){pin(frozen.engine);const r=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.engine.path,...sharedArgs,'-Mode',action,...extra],{...opts,timeout:900000});need(!r.stderr,'ENGINE_STDERR');return JSON.parse(r.stdout);}
 let successorClaimRef=null,successorSnapshotRef=null,successorDrainProof=null;
 async function successorWorker(action,extra=[]){const collect=async()=>{
  pin(frozen.drainer);pin(frozen.pausedHelper);pin(frozen.engine);pin(successorClaimRef);
  const args=['-Mode',action,...sharedArgs.filter((_,i)=>i>1),'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.pausedHelper.path,'-RecoveryHelperSha256',frozen.pausedHelper.sha256,'-ClaimPath',successorClaimRef.path,'-ClaimSha256',successorClaimRef.sha256,...extra];
  const result=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.drainer.path,...args],{...opts,timeout:180000});need(!result.stderr,'SUCCESSOR_DRAIN_STDERR');return JSON.parse(result.stdout);
 };return action==='Capture'?pr54CollectPhysicalObservation(collect,'SUCCESSOR_CAPTURE'):collect();
 }
 async function observeNewOwner(ref,leaf){
  if(predecessorRef===null)return useFrozenEngine('PreflightNew',['-CandidatePath',ref.path,'-CandidateSha256',ref.sha256]);
  pin(frozen.newObserver);pin(frozen.engine);pin(frozen.pausedHelper);pin(frozen.observer);pin(ref);
  const result=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.newObserver.path,'-Mode','Observe',...sharedArgs.slice(2),'-CandidatePath',ref.path,'-CandidateSha256',ref.sha256,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.pausedHelper.path,'-RecoveryHelperSha256',frozen.pausedHelper.sha256,'-SourceObserverPath',frozen.observer.path,'-SourceObserverSha256',frozen.observer.sha256],{...opts,timeout:900000});
  need(!result.stderr,'NEW_OBSERVER_STDERR');const proof=JSON.parse(result.stdout);
  need(proof.status==='NEW_OWNER_OBSERVED_READY'&&proof.profileSha256===profileRef.sha256&&proof.beforeSha256===beforeRef.sha256&&proof.candidateSha256===ref.sha256&&proof.engineSha256===frozen.engine.sha256&&proof.sourceObserverSha256===frozen.observer.sha256&&proof.stableSeconds>=30&&proof.mutationExecuted===false&&proof.sourceProof?.supervisorSourceCommit===before.profile.supervisorSource&&proof.sourceProof?.supervisorManifestSha256===before.profile.supervisorManifest,'NEW_OBSERVER_PROOF');
  await protectedWrite(path.win32.join(transitionDir,leaf),jsonBytes(proof));return proof;
 }
 const callbacks={plan:before.plan,
  admit:async()=>{admittedOld=await currentOld();if(predecessorRef===null)need((await useFrozenEngine('PreflightOld')).status==='OLD_PHYSICAL_PREFLIGHT','ADMISSION');
   if(predecessorRef===null)await protectedWrite(globalOwnerLock,jsonBytes({profileRef,beforeRef,preSnapshotRef,preProofRef,rehearsalProofRef,transitionDirectory:transitionDir}));
   else successorClaimRef=await (currentMode?claimPr54CurrentOwnerSuccessorIO:claimPr54OwnerSuccessor)({inspect:async()=>inspectSuccessor(await currentOld()),createNew:async({ref,bytes})=>({created:true,ref:await protectedWrite(ref.path,bytes)}),readClaim:ref=>pin(ref),...(currentMode?{guardProtected:async()=>{await guardProtected();await readCurrentContinuity();validatePr54CurrentPreCapture(currentPreCapture,sourcePre.snapshot,sourcePre.proof,sourcePre.backup,{nativeContinuity});return true;}}:{})});
   await protectedWrite(path.win32.join(transitionDir,'transition.lock'),jsonBytes({profileRef,beforeRef,preSnapshotRef,preProofRef,rehearsalProofRef,...(currentMode?{currentPreCapture}:{}),...(successorClaimRef?{successorClaimRef}:{})}));return {owner:true,oldHealthy:true,oldActions:true,emptyJournal:true};},persist,
  stopTasks:async()=>{const seen=await currentOld();admittedOld=seen;
   if(predecessorRef!==null){const snapshot=await successorWorker('Capture');need(snapshot.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&snapshot.oldIdentities.length===8&&snapshot.oldWatchers.length===2,'SUCCESSOR_CAPTURE');successorSnapshotRef=await protectedWrite(path.win32.join(transitionDir,'successor-precut-admission.json'),jsonBytes(snapshot));}
   let code="$s=New-Object -ComObject Schedule.Service;$s.Connect();$runs=$s.GetRunningTasks(1);$selected=@();";for(const name of names){const captured=seen.runningInstances.filter(x=>x.name===name);need(captured.length===1,'OLD_COM');const c=captured[0];code+=`$matches=@();for($i=1;$i-le$runs.Count;$i++){$r=$runs.Item($i);if($r.Name-ceq${quote(name)}){$matches+=,$r}};if($matches.Count-ne1-or$matches[0].InstanceGuid-cne${quote(c.instanceGuid)}-or$matches[0].EnginePID-ne${c.enginePid}){throw 'COM_CAS'};$selected+=,$matches[0];`;}code+="foreach($r in $selected){$r.Stop()};'STOP_REQUESTED'";taskStopAttempted=true;await ps(code);return true;},
  tasksStopped:async()=>{for(let i=0;i<40;i++){const seen=await physical();if(seen.tasks.every(x=>x.state===3)&&seen.runningInstances.length===0&&!seen.processes.some(p=>/watch-terminal-completion-logon\.ps1|watch-hub-after-erp\.ps1/i.test(p.commandLine)))return true;await new Promise(r=>setTimeout(r,250));}return false;},
  stopExact:async role=>{await guardProtected();const captured=before.identities[role],seen=await physical(),actual=seen.processes.find(x=>x.pid===captured.pid);
   if(predecessorRef!==null&&role==='coreSupervisor'){
    if(!actual&&successorDrainProof){pin(successorDrainProof.cutWitness);pin(successorDrainProof.drainWitness);need(successorDrainProof.goneOldPids.includes(captured.pid),'SUCCESSOR_GONE_CORE_PROOF');return 'ALREADY_GONE';}
    need(actual&&exact(actual,captured)&&successorSnapshotRef&&!successorDrainProof,'SUCCESSOR_CORE_SCOPE');const intentRef=eventRefs.at(-1),intent=read(intentRef);need(intent.event==='EXACT_STOP_INTENT'&&intent.target===role,'SUCCESSOR_CORE_INTENT');
    successorDrainProof=await successorWorker('Drain',['-AdmittedSnapshotPath',successorSnapshotRef.path,'-AdmittedSnapshotSha256',successorSnapshotRef.sha256,'-StopIntentPath',intentRef.path,'-StopIntentSha256',intentRef.sha256]);
    need(successorDrainProof.status==='SUCCESSOR_CORE_DRAINED'&&successorDrainProof.heldCoreExited===true,'SUCCESSOR_CORE_DRAIN');pin(successorDrainProof.cutWitness);pin(successorDrainProof.drainWitness);return successorDrainProof.coreStopResult;
   }
   if(!actual)return 'ALREADY_GONE';need(exact(actual,captured),'STOP_IDENTITY');pin(profile.stopper);const proof={pid:captured.pid,parentPid:captured.parentPid,nodePath:captured.nodePath,ownerSid:captured.ownerSid,commandLine:captured.commandLine,creationTime:captured.creationTime.replace(/(\.\d{6})0Z$/,'$1Z')};const r=await run(shell,['-NoProfile','-NonInteractive','-File',profile.stopper.path,'-ExpectedJsonBase64',Buffer.from(JSON.stringify(proof)).toString('base64')],opts);need(!r.stderr&&['ALREADY_GONE','EXACT_OBSERVED_PROCESS_STOPPED'].includes(r.stdout.trim()),'STOP_RESULT');return r.stdout.trim();},
  absent:async role=>!(await physical()).processes.some(x=>x.pid===before.identities[role].pid),portsClear:empty,
  setAction:async(name,kind)=>{await guardProtected();need(kind==='new'&&await empty(),'SET_SCOPE');return changeAction(name,kind);},actionsEqual:kind=>taskState(kind,3),
  startTasks:async()=>{await guardProtected();need(!startAttempted&&await empty()&&await taskState('new',3),'START_SCOPE');startAttempted=true;const taskPins=Buffer.from(JSON.stringify(profile.tasks.map(t=>({name:t.name,sha:t.newXmlSha256})))).toString('base64');await ps(`$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${taskPins}'))|ConvertFrom-Json;foreach($p in $pins){$t=$f.GetTask($p.name);$h=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$t.Xml))).Replace('-','').ToLowerInvariant();if([int]$t.State-ne3-or$h-cne$p.sha){throw 'START_CAS'}};[void]$f.GetTask('${names[0]}').Run($null);[void]$f.GetTask('${names[1]}').Run($null);'STARTED'`);return true;},
  readback:async()=>{const deadline=Date.now()+600000;let capture=null;while(Date.now()<deadline){const seen=await physical();if((predecessorRef===null?selectPr54CandidateProcesses:proposePr54CandidateProcesses)(seen,profile).length===10&&new Set(seen.bindings.map(b=>b.port)).size===8&&seen.bindings.every(b=>ports.includes(b.port))&&seen.runningInstances.length===2){capture=await captureCandidate();candidateRef=capture.ref;break;}await new Promise(r=>setTimeout(r,1000));}need(capture!==null,'NEW_READBACK_TIMEOUT');const ready=await observeNewOwner(capture.ref,'new-owner-readback-initial.json');need(ready.status===(predecessorRef===null?'NEW_PHYSICAL_PREFLIGHT':'NEW_OWNER_OBSERVED_READY')&&ready.stableSeconds>=30&&ready.mutationExecuted===false,'NEW_READBACK');pin(frozen.invariance);const post=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.invariance.path,...(currentMode?pr54CurrentSourceCaptureArgs(sourceCapture.runId):['-Mode','Capture','-Phase','Post'])],{...opts,timeout:3600000});need(!post.stderr,'POST_CAPTURE_STDERR');const proof=JSON.parse(post.stdout);let postSnapshotPath,postBytes,equal;if(currentMode){postSnapshotPath=sourceCapture.root+'\\source-post-snapshot.json';const proofPath=sourceCapture.root+'\\source-post-proof.json';postBytes=fs.readFileSync(postSnapshotPath);const postRefs={snapshotRef:{path:postSnapshotPath,sha256:hash(postBytes)},proofRef:{path:proofPath,sha256:hash(fs.readFileSync(proofPath))}};need(await ps(pr54CurrentReadPinsProgram(Object.values(postRefs)))==='VERIFIED','CURRENT_POST_ACL');need(JSON.stringify(read(postRefs.proofRef))===JSON.stringify(proof),'CURRENT_POST_OUTPUT');validatePr54CurrentPreCapture(postRefs,JSON.parse(postBytes),proof,null,{phase:'Post',backupRequired:false});equal=comparePr54CurrentSourceSnapshots(sourcePre.snapshot,JSON.parse(postBytes));}else{need(proof.phase==='Post'&&proof.criticalTablesHashed===51&&proof.dbccCheckdbPassed===true,'POST_PROOF');postSnapshotPath='C:\\Sirket\\ERP\\backups\\P03-20261018-140002\\invariance-readonly\\restored-snapshot.json';postBytes=fs.readFileSync(postSnapshotPath);equal=comparePr54InvarianceSnapshots(pre,JSON.parse(postBytes));}await protectedWrite(path.win32.join(transitionDir,'invariance-comparison.json'),jsonBytes({...equal,preSnapshotRef:currentMode?currentPreCapture.snapshotRef:preSnapshotRef,...(currentMode?{historicalRestorePreSnapshotRef:preSnapshotRef,currentPreCapture}:{}),postSnapshotRef:{path:postSnapshotPath,sha256:hash(postBytes)}}));const final=await captureCandidate();candidateRef=final.ref;const finalProof=await observeNewOwner(final.ref,'new-owner-readback-final.json');need(finalProof.status===(predecessorRef===null?'NEW_PHYSICAL_PREFLIGHT':'NEW_OWNER_OBSERVED_READY')&&finalProof.stableSeconds>=30&&finalProof.mutationExecuted===false,'FINAL_READBACK');return true;},
  restoreOldActions:async()=>{await guardProtected();need(await empty(),'RESTORE_EMPTY');for(const name of names)await changeAction(name,'old');return true;},
 };
 for(const callbackName of ['admit','stopTasks','tasksStopped']){const actual=callbacks[callbackName];callbacks[callbackName]=async(...args)=>{const started=Date.now();try{const result=await actual(...args);if(callbackName!=='admit'&&result!==true)lastCallbackFailure??={callback:callbackName,reason:'CALLBACK_RETURNED_FALSE',elapsedMs:Date.now()-started};return result;}catch(error){lastCallbackFailure??={callback:callbackName,reason:pr54SafeFailure(error),elapsedMs:Date.now()-started,observationStage:error?.p03ObservationStage??'NONE'};throw error;}};}
 async function recoverBeforeStart(){
  need(taskStopAttempted&&!startAttempted&&admittedOld,'PRESTART_RECOVERY_SCOPE');
  await guardProtected();let current=await physical();admitPr54PrestartRecovery({profile,before,admittedOld,current});
  await protectedWrite(path.win32.join(transitionDir,'prestart-recovery-intent.json'),jsonBytes({event:'PRESTART_RECOVERY_INTENT',profileRef,beforeRef,observedAt:current.observedAt,remainingOldPids:current.processes.filter(p=>!profile.protectedProcesses.some(q=>q.pid===p.pid)).map(p=>p.pid),remainingCom:current.runningInstances}));
  // Stop only the still-running exact old COM instances. Ready tasks are not
  // started, guessed, or assigned synthetic recovery events.
  if(current.runningInstances.length){let code="$s=New-Object -ComObject Schedule.Service;$s.Connect();$runs=$s.GetRunningTasks(1);$chosen=@();";
   for(const instance of current.runningInstances){const entry=profile.tasks.find(t=>t.name===instance.name),task=current.tasks.find(t=>t.name===instance.name),taskSha=hash(Buffer.from(task.xml));code+=`$f=$s.GetFolder('\\');$t=$f.GetTask(${quote(instance.name)});$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$t.Xml))).Replace('-','').ToLowerInvariant();if($sha-cne'${taskSha}'){throw 'PRESTART_ACTION_CAS'};$match=@();for($i=1;$i-le$runs.Count;$i++){$r=$runs.Item($i);if($r.Name-ceq${quote(instance.name)}){$match+=,$r}};if($match.Count-ne1-or$match[0].InstanceGuid-cne${quote(instance.instanceGuid)}-or$match[0].EnginePID-ne${instance.enginePid}){throw 'PRESTART_COM_CAS'};$chosen+=,$match[0];`;need(entry,'PRESTART_TASK');}
   code+="foreach($r in $chosen){$r.Stop()};'PRESTART_COM_STOPPED'";await ps(code);
  }
  need(await callbacks.tasksStopped(),'PRESTART_WATCHERS_NOT_STOPPED');
  for(const role of (predecessorRef===null?targets:['coreSupervisor',...targets.filter(x=>x!=='coreSupervisor')])){
   await guardProtected();current=await physical();admitPr54PrestartRecovery({profile,before,admittedOld,current});
   if(predecessorRef!==null&&role==='coreSupervisor'&&!successorDrainProof){await persist({sequence,digest:before.plan.digest,stopOrderDigest:p03CoreFirstStopDigest(before.plan),event:'EXACT_STOP_INTENT',target:role});}
   const result=await callbacks.stopExact(role);need(['EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE'].includes(result)&&await callbacks.absent(role),'PRESTART_EXACT_STOP');
  }
  need(await callbacks.tasksStopped()&&await empty(),'PRESTART_NOT_EMPTY');await guardProtected();
  await protectedWrite(path.win32.join(transitionDir,'prestart-recovery-empty.json'),jsonBytes({event:'PRESTART_RECOVERY_EMPTY_READY',profileRef,beforeRef,observedAt:new Date().toISOString()}));
  // The reviewed physical engine legitimately creates its own recovery journal
  // from a real zero-process candidate and exact new task actions.
  for(const name of names){need(await empty(),'PRESTART_ACTION_NOT_EMPTY');await changeAction(name,'new');}
  need(await taskState('new',3)&&await empty(),'PRESTART_NEW_ACTIONS');const candidate=await captureCandidate();need(candidate.value.processes.length===0&&candidate.value.receipts.length===0,'PRESTART_CANDIDATE_NOT_EMPTY');candidateRef=candidate.ref;
  const recovered=await useFrozenEngine('StopNew',['-CandidatePath',candidate.ref.path,'-CandidateSha256',candidate.ref.sha256]);need(recovered.status==='RECOVERED_OLD_ACTIONS','PRESTART_ENGINE_RECOVERY');
  const restored=await useFrozenEngine('RollbackOld',['-RecoveryTailSha256',recovered.journalTailSha256]);need(restored.status==='RESTORED_READY','PRESTART_OLD_READBACK');
  return {status:'FAILED_ROLLED_BACK_OLD_READY',recoveryPath:'PRESTART_EXACT_OLD_DRAIN_THEN_REVIEWED_ENGINE',transitionDirectory:transitionDir};
 }
 // The successor coordinator journals the real core-FIRST stop order. It must
 // never stop core invisibly inside another role's callback. Probe quiescence
 // remains a separate physical gate before stopping the remaining OLD apps.
 try{return {status:'COMPLETE',...(await (predecessorRef===null?runP03OwnerTransition:runP03CoreFirstOwnerTransition)(callbacks)),transitionDirectory:transitionDir,...(successorClaimRef?{successorClaimRef}:{})};}
 catch(error){lastCallbackFailure??={callback:'TRANSITION',reason:pr54SafeFailure(error),elapsedMs:null,observationStage:error?.p03ObservationStage??'NONE'};if(lastCallbackFailure){try{await protectedWrite(path.win32.join(transitionDir,'io-failure-diagnostic.json'),jsonBytes({...lastCallbackFailure,phase:error.phase??'UNKNOWN',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256}));}catch{}}if(error.startAttempted||startAttempted){try{const candidate=await captureCandidate();candidateRef=candidate.ref;const recovered=await useFrozenEngine('StopNew',['-CandidatePath',candidate.ref.path,'-CandidateSha256',candidate.ref.sha256]);need(recovered.status==='RECOVERED_OLD_ACTIONS','STOP_NEW_RECOVERY');const restored=await useFrozenEngine('RollbackOld',['-RecoveryTailSha256',recovered.journalTailSha256]);need(restored.status==='RESTORED_READY','ROLLBACK_OLD');return {status:'FAILED_ROLLED_BACK_OLD_READY',failurePhase:error.phase??'READBACK',transitionDirectory:transitionDir};}catch(recoveryError){return {status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',failureDiagnostic:lastCallbackFailure,recoveryReason:pr54SafeFailure(recoveryError),transitionDirectory:transitionDir,candidateRef};}}if(taskStopAttempted&&!startAttempted){try{return await recoverBeforeStart();}catch(recoveryError){return {failureDiagnostic:lastCallbackFailure,recoveryReason:pr54SafeFailure(recoveryError),status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',transitionDirectory:transitionDir,candidateRef,recoveryPath:'PRESTART_RECOVERY_REFUSED'};}}return {status:'STOPPED_BEFORE_START',transitionDirectory:transitionDir,failurePhase:error.phase??'ADMISSION'};}
}


// Separate, finite B264/Sup20d dispatcher. The historical FE/7b path above is
// deliberately unchanged. No transport hooks or caller-supplied capabilities.
const b264Sup20dSourcePins=Object.freeze({
 drainer:['p03-pr54-successor-core-drain.ps1','eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5'],
 observer:['p03-physical-recovery-observe.ps1','5e1f89bd24ba7b1a2c8738cab3f2f29d4ec44ade96b62127d9f1367efd6143f9'],
 newObserver:['p03-pr54-new-owner-observe.ps1','b7ba34e3b13899874f0ea3d5cd168682f81fd946ca7d42db586d8a95ff4efa22'],
 oldCut:['p03-pr54-b264-old-owner-cut.ps1','bacf794ef5e6bd1288aa01b869c13f37d5611079c459c91f745ff97a9942424b'],
 newRecovery:['p03-pr54-b264-new-owner-recovery.ps1','1195eb9f5ca0cf760b16cbbf4f65b8081f9ac16c74d71a1a829114ca439a3c37'],
 invariance:['p03-current-invariance-capture.ps1','7d1dab68e3f285ae7def2c9d3a7a30a6b7eeed715690c30e2bce5341b3c5faa4'],
 emptyRecovery:['p03-pr54-new-owner-empty-recovery.ps1','a742992d20b5eb44f2092249077cf785a5176525c6d498dd300873b0bfaa7f4a'],
});
function b264Sup20dHeldInvocation(ref,argv,{fileInvocationOnly=false}={}){
 const payload=Buffer.from(JSON.stringify({ref,args:argv.slice(4)})).toString('base64');
 const program=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$env:PSModulePath=Join-Path $PSHOME 'Modules';foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\\'+$n+'\\'+$n+'.psd1')) -ErrorAction Stop};$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;$owner='S-1-5-21-2170750028-1005938530-2568122015-1001';if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-cne$owner){throw 'B264_SOURCE_OWNER'};for($p=$v.ref.path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B264_SOURCE_REPARSE'}};$i=Get-Item -LiteralPath $v.ref.path -Force;if($i.PSIsContainer-or$i.LinkType){throw 'B264_SOURCE_FILE'};$a=Get-Acl -LiteralPath $v.ref.path;$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$owner-or$rules.Count-ne2){throw 'B264_SOURCE_ACL'};foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'B264_SOURCE_ACL'}};$s=[IO.File]::Open($v.ref.path,'Open','Read','Read');try{if($s.Length-le0-or$s.Length-gt16777216){throw 'B264_SOURCE_SIZE'};$m=[IO.MemoryStream]::new();$s.CopyTo($m);$b=$m.ToArray();$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant();if($sha-cne$v.ref.sha256){throw 'B264_SOURCE_HASH'};$bound=@{};if($v.args.Count%2-ne0){throw 'B264_SOURCE_ARGS'};for($n=0;$n-lt$v.args.Count;$n+=2){$k=[string]$v.args[$n];if($k-cnotmatch'^-[A-Za-z][A-Za-z0-9]*$'-or$bound.ContainsKey($k.Substring(1))){throw 'B264_SOURCE_ARGS'};$bound[$k.Substring(1)]=[string]$v.args[$n+1]};$code=[Text.UTF8Encoding]::new($false,$true).GetString($b);& ([scriptblock]::Create($code)) @bound}finally{$s.Dispose()}`;
 need(typeof fileInvocationOnly==='boolean','FILE_INVOCATION_MODE');
 if(fileInvocationOnly){
  // Preserve the same owner/ACL/ancestor/hash admission and lifetime read hold.
  // A real child -File invocation supplies PSCommandPath. The payload is JSON
  // data only; no encoded or dynamically reconstructed script is executed.
  need(argv.length>=6&&argv.length%2===0&&argv.slice(0,4).every((v,n)=>v===['-NoProfile','-NonInteractive','-File',ref.path][n])&&typeof ref.path==='string'&&!/[\u0000-\u001f"]/.test(ref.path),'FILE_INVOCATION_ARGS');
  const keys=new Set();for(let n=4;n<argv.length;n+=2){need(/^-[A-Za-z][A-Za-z0-9]*$/.test(argv[n])&&!keys.has(argv[n].toLowerCase())&&typeof argv[n+1]==='string'&&argv[n+1].length>0&&!/[\u0000-\u001f"]/.test(argv[n+1]),'FILE_INVOCATION_ARGS');keys.add(argv[n].toLowerCase());}
  const boundary=program.indexOf('$bound=@{};');need(boundary>0,'FILE_INVOCATION_SOURCE');
  const fileProgram=program.slice(0,boundary)+`$nativeArgs=@('-NoProfile','-NonInteractive','-File',[string]$v.ref.path);$nativeArgs+=@($v.args|ForEach-Object{[string]$_});$child=Join-Path $PSHOME 'powershell.exe';& $child @nativeArgs;$childExit=[int]$LASTEXITCODE}finally{$s.Dispose()};exit $childExit`;
  need(fileProgram.length<30000&&!fileProgram.includes('[scriptblock]::Create('),'COMMAND_LIMIT');return ['-NoProfile','-NonInteractive','-Command',fileProgram];
 }
 const encoded=Buffer.from(program,'utf16le').toString('base64');need(encoded.length<30000,'COMMAND_LIMIT');
 return ['-NoProfile','-NonInteractive','-EncodedCommand',encoded];
}

export async function runPr54B264Sup20dSharedOwnerTransition({mode='DryRun',profileRef,beforeRef,currentPreCapture,rehearsalProofRef,sourceControlDir}={}){
 need(['DryRun','Apply'].includes(mode)&&process.platform==='win32','B264_SUP20D_MODE_PLATFORM');
 const root='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018';
 need(/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-b264-sup20d-control-[a-f0-9]{12}$/.test(sourceControlDir),'B264_SUP20D_SOURCE_DIRECTORY');
 need(typedRef(profileRef)&&typedRef(beforeRef)&&typedRef(rehearsalProofRef)&&exactKeys(currentPreCapture,['snapshotRef','proofRef','backupProofRef'])&&Object.values(currentPreCapture).every(typedRef),'B264_SUP20D_INPUT_REFS');
 const before=read(beforeRef),profile=read(profileRef),runId=before.runId;
 need(/^[a-f0-9]{32}$/.test(runId)&&profileRef.path===root+'\\MelisaERP-P03-profile-'+runId+'.json'&&beforeRef.path===root+'\\MelisaERP-P03-before-'+runId+'.json'&&JSON.stringify(profile.beforeImage)===JSON.stringify(beforeRef),'B264_SUP20D_RUN');
 need(profile.database===currentDatabase&&before.database===currentDatabase&&before.copyId===currentCopy&&before.actualT1===false&&profile.ownerSid===owner&&before.ownerSid===owner,'B264_SUP20D_TARGET');
 const candidate=assertPr54B264Sup20dCandidate({...before.profile,supervisorRoot:profile.packages?.find(p=>p.sourceCommit===before.profile?.supervisorSource)?.root,newSettings:profile.newSettings});
 need(before.plan?.digest===p03TransitionDigest(before.plan)&&before.plan.oldSettingsSha256===profile.oldSettings.sha256&&before.plan.newSettingsSha256===profile.newSettings.sha256,'B264_SUP20D_PLAN');
 need(profile.journalDirectory===root+'\\MelisaERP-P03-recovery-'+runId&&profile.stopper?.path===root+'\\MelisaERP-P03-stopper-'+runId+'.ps1'&&profile.stopper.sha256==='79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d','B264_SUP20D_RECOVERY_SCOPE');
 need(JSON.stringify(profile.businessDigest)===JSON.stringify(currentPreCapture.snapshotRef)&&/^C:\\Sirket\\ERP\\backups\\P03-20261020-\d{6}\\source-pre-snapshot\.json$/.test(profile.businessDigest.path),'B264_SUP20D_CAPTURE');
 need(/^C:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\result\.json$/.test(rehearsalProofRef.path),'B264_SUP20D_REHEARSAL_PATH');
 const engineRef=PR54_B264_REFS.engine,helperRef={path:root+'\\p03-pr54-paused-old-recover.ps1',sha256:'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'};
 const sources=Object.fromEntries(Object.entries(b264Sup20dSourcePins).map(([name,[leaf,sha256]])=>[name,{path:path.win32.join(sourceControlDir,leaf),sha256}]));
 const rehearsal=read(rehearsalProofRef);
 need(rehearsal.status==='REHEARSAL_ROLLBACK_READY'&&rehearsal.environment==='P03_REHEARSAL'&&rehearsal.sharedTestMutation===false&&rehearsal.protectedBeforeSha256===rehearsal.protectedAfterSha256,'ACTUAL_REHEARSAL_REQUIRED');
 need(rehearsal.engineSha256===engineRef.sha256&&rehearsal.engine?.sha256===engineRef.sha256,'SAME_REHEARSED_ENGINE_REQUIRED');
 const sourcePre={snapshot:read(currentPreCapture.snapshotRef),proof:read(currentPreCapture.proofRef),backup:read(currentPreCapture.backupProofRef)};
 const fixedReads=[profileRef,beforeRef,rehearsalProofRef,...Object.values(currentPreCapture),engineRef,helperRef,profile.stopper,profile.oldSettings,profile.newSettings,...Object.values(sources)];
 need(profile.packages.length===6,'B264_SUP20D_SIX_PACKAGES');
 let claimRef=null,claimBytes=null,transitionCreated=false,cut=null,snapshotRef=null,started=false,cutAttempted=false,sequence=0,previous=beforeRef.sha256,candidateRef=null;
 const transitionDir=root+'\\MelisaERP-P03-transition-'+runId,eventRefs=[],frozen={};
 async function strictPins(refs){
  for(let n=0;n<refs.length;n+=4){const batch=refs.slice(n,n+4);for(const r of batch)pin(r);const data=Buffer.from(JSON.stringify(batch)).toString('base64');
   need(await ps(`$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;foreach($r in $pins){$p=$r.path;${psNoReparse}$a=Get-Acl -LiteralPath $p;$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne'${owner}'-or$rules.Count-ne2){throw 'B264_IO_ACL'};foreach($sid in @('${owner}','S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'B264_IO_ACL'}};if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()-cne$r.sha256){throw 'B264_IO_HASH'}};'VERIFIED'`)==='VERIFIED','B264_SUP20D_PIN_ACL');
  }
 }
 async function history(){
  const refs=b264ReadPins();for(let n=0;n<refs.length;n+=8)need(await ps(pr54B264ReadPinsProgram(refs.slice(n,n+8)))==='VERIFIED','B264_SUP20D_HISTORY_ACL');
  for(const rows of [PR54_B264_OUTER_REFS,PR54_B264_RECOVERY_REFS])need(JSON.stringify(fs.readdirSync(path.win32.dirname(rows[0].path)).filter(n=>n.startsWith('event-')).sort())===JSON.stringify(rows.map(r=>path.win32.basename(r.path)).sort()),'B264_SUP20D_HISTORY_SCOPE');
  const raw=Object.fromEntries(Object.entries(PR54_B264_REFS).map(([k,ref])=>[k,{ref,bytes:pin(ref)}]));raw.outer=PR54_B264_OUTER_REFS.map(ref=>({ref,bytes:pin(ref)}));raw.recovery=PR54_B264_RECOVERY_REFS.map(ref=>({ref,bytes:pin(ref)}));validatePr54B264Predecessor(raw);return raw;
 }
 async function guardProtected(){
 const data=Buffer.from(JSON.stringify(profile.protectedProcesses)).toString('base64');
 await ps(`$expected=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;foreach($e in $expected){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$e.pid);if(-not$p-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTime]::Parse($e.creationTime).ToUniversalTime().Ticks){throw 'PROTECTED_BIRTH'};if($e.PSObject.Properties.Name-contains'kind'-and$e.kind-ceq'ProtectedSqlService'){$v=@(Get-CimInstance Win32_Service -Filter 'Name="MSSQL$MELISADEV"');if($p.Name-cne'sqlservr.exe'-or$v.Count-ne1-or$v[0].ProcessId-ne$e.pid-or$v[0].State-cne'Running'-or$v[0].StartName-cne$e.service.startName-or$v[0].PathName-cne$e.service.pathName){throw 'SQL_PROTECT'};$c=[Data.SqlClient.SqlConnection]::new(${quote(PR54_PROTECT_SQL_CONNECTION)});$c.Open();try{$q=$c.CreateCommand();$q.CommandTimeout=5;$q.CommandText="SELECT CAST(SERVERPROPERTY('ProcessID') AS int),CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)),DB_NAME()";$reader=$q.ExecuteReader();try{if(-not$reader.Read()-or$reader.GetInt32(0)-ne$e.pid-or$reader.GetString(1)-cne'Semih\\MELISADEV'-or$reader.GetString(2)-cne'master'){throw 'SQL_MASTER_IDENTITY'}}finally{$reader.Dispose()}}finally{$c.Dispose()}}else{$o=Invoke-CimMethod $p -MethodName GetOwnerSid;if($o.ReturnValue-ne0-or$o.Sid-cne$e.ownerSid-or$p.ExecutablePath-ine$e.nodePath-or$p.CommandLine-cne$e.commandLine-or$p.ParentProcessId-ne$e.parentPid){throw 'PROTECTED_IDENTITY'}}};'UNCHANGED'`);
 return true;
 }

 async function guard(){
  await strictPins(fixedReads);for(const p of profile.packages)pin({path:p.manifestPath,sha256:p.manifestSha256});await guardProtected();
  if(claimRef){await strictPins([claimRef]);need(pin(claimRef).equals(claimBytes),'B264_SUP20D_CLAIM_CHANGED');}else need(!fs.existsSync(PR54_B264_SUCCESSOR_CLAIM_PATH),'B264_SUCCESSOR_ALREADY_CONSUMED');
  if(transitionCreated){for(const ref of eventRefs)pin(ref);for(const ref of Object.values(frozen))pin(ref);}
  return true;
 }
 async function invoke(ref,args,{timeout=180000,text=false}={}){
  pin(ref);const result=await run(shell,b264Sup20dHeldInvocation(ref,['-NoProfile','-NonInteractive','-File',ref.path,...args]),{...opts,timeout});need(!result.stderr,'B264_SUP20D_WORKER_STDERR');return text?result.stdout.trim():JSON.parse(result.stdout);
 }
 const common=['-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256];
 async function admit(){
  await guard();
  // The frozen engine's read-only dispatcher verifies every payload/config
  // byte in the same six packages before each genuine physical admission.
  // Existing before/current freshness limits still apply after this scan;
  // no timestamp is refreshed or reset by the diagnostic timing.
  const preflight=await invoke(engineRef,['-Environment','Shared',...common,'-Mode','PreflightOld'],{timeout:900000});
  need(exactKeys(preflight,['status','environment','profileSha256','beforeImageSha256','applyAvailable','mutationExecuted'])&&preflight.status==='OLD_PHYSICAL_PREFLIGHT'&&preflight.environment==='Shared'&&preflight.profileSha256===profileRef.sha256&&preflight.beforeImageSha256===beforeRef.sha256&&preflight.applyAvailable===false&&preflight.mutationExecuted===false,'B264_SUP20D_FULL_PACKAGE_PREFLIGHT');
  const raw=await history();
  const physical=await inspectPr54B264Sup20dPhysicalOwner({profileRef,beforeRef,engineRef,recoveryHelperRef:helperRef,drainerRef:sources.drainer,observerRef:sources.observer});
  const observation=JSON.parse(await ps(pr54CurrentContinuityProgram(currentPreCapture.snapshotRef,sourcePre.backup)));
  const nativeContinuity=preparePr54B264NativeContinuity(currentPreCapture.snapshotRef,sourcePre.snapshot,observation,sourcePre.backup);
  validatePr54CurrentPreCapture(currentPreCapture,sourcePre.snapshot,sourcePre.proof,sourcePre.backup,{nativeContinuity});await guardProtected();
  return admitPr54B264Sup20dCurrentEpoch({raw,profileRef,beforeRef,profileBytes:pin(profileRef),beforeBytes:pin(beforeRef),profile:physical.profile,before:physical.before,current:physical.current,candidate,nativeContinuity,physicalInspection:physical.physicalInspection});
 }
 await guard();need(await ps(`[Security.Principal.WindowsIdentity]::GetCurrent().User.Value`)===owner,'CALLER');
 need(!fs.existsSync(transitionDir)&&fs.readdirSync(profile.journalDirectory).length===0,'B264_SUP20D_PRIOR_JOURNAL');
 const first=await admit();
 if(mode==='DryRun')return {status:'B264_SUP20D_DRY_RUN_ONLY',applyExecuted:false,claimCreated:false,transitionAuthority:false,candidate,sourceControlDir,proofDigest:first.proofDigest};
 async function protectedWrite(file,bytes){
  need(path.win32.normalize(file)===file&&(file===PR54_B264_SUCCESSOR_CLAIM_PATH||file.startsWith(transitionDir+'\\')||new RegExp('^'+root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\\\MelisaERP-P03-candidate-[a-f0-9]{32}\\.json$').test(file)),'B264_SUP20D_WRITE_SCOPE');
  noReparseAncestors(file);const ref={path:file,sha256:hash(bytes)};await psPayload(pr54ProtectedWriteProgram(file,ref.sha256),bytes);need(pin(ref).equals(bytes),'B264_SUP20D_WRITE_READBACK');return ref;
 }
 // Two genuine observations agree on identities/history/SQL, not clock bytes.
 const second=await admit(),stable=x=>{const {ownerObservedAt,...rest}=x.claim;return JSON.stringify({proofDigest:x.proofDigest,claim:rest});};
 need(stable(first)===stable(second)&&Date.parse(second.claim.ownerObservedAt)>=Date.parse(first.claim.ownerObservedAt)&&Date.now()-Date.parse(second.claim.ownerObservedAt)<60000,'B264_SUP20D_ADMISSION_DRIFT');
 const actualClaim={...second.claim,schemaVersion:'melisa-p03-b264-current-epoch-claim.v1',transitionAuthority:true,applyExecuted:false};
 need(Object.keys(actualClaim).length===20,'B264_SUP20D_CLAIM_FIELDS');claimBytes=jsonBytes(actualClaim);
 claimRef=await protectedWrite(PR54_B264_SUCCESSOR_CLAIM_PATH,claimBytes);await strictPins([claimRef]);
 // A consumed claim is never re-admitted, overwritten or deleted, even if a
 // later gate fails. Historical pins remain separately checked after claim.
 await guard();await history();
 await ps(`$p=${quote(transitionDir)};${psNoReparse}if(Test-Path -LiteralPath $p){throw 'EXISTS'};$s=[Security.AccessControl.DirectorySecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new('${owner}'));$s.SetAccessRuleProtection($true,$false);foreach($id in @('${owner}','S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($p,$s);'CREATED'`);transitionCreated=true;
 for(const [name,ref]of Object.entries({engine:engineRef,helper:helperRef,...sources}))frozen[name]=await protectedWrite(path.win32.join(transitionDir,path.win32.basename(ref.path)),pin(ref));
 await protectedWrite(path.win32.join(transitionDir,'transition.lock'),jsonBytes({profileRef,beforeRef,currentPreCapture,rehearsalProofRef,successorClaimRef:claimRef,sourceControlDir}));
 async function persist(record){need(record.sequence===sequence,'EVENT_SEQUENCE');await guard();const ref=await protectedWrite(path.win32.join(transitionDir,'event-'+String(sequence).padStart(4,'0')+'.json'),jsonBytes({...record,previousSha256:previous,profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256}));eventRefs.push(ref);previous=ref.sha256;sequence++;return {created:true,sequence:record.sequence};}
 async function physical(){
  await guardProtected();return pr54CollectPhysicalObservation(async()=>{
   // Raw Physical collection only; no CandidateProposal filtering and no use
   // of a role-only result as a stop authority. NEW observer authenticates it.
   const seen=await invoke(frozen.observer,['-Environment','Shared','-Purpose','Physical','-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256]);
   need(seen.schemaVersion==='melisa-p03-physical-observation.v1'&&seen.environment==='Shared'&&seen.collectionAuthority==='PHYSICAL_OBSERVATION_ONLY'&&seen.processScope==='CIM.Win32_Process.Unfiltered'&&seen.portScope==='Get-NetTCPConnection.Listen.Unfiltered'&&seen.stopPermitted===false&&seen.applyAvailable===false&&seen.rawScope?.unverifiedCount===0&&seen.rawScope.unverifiedProcesses?.length===0&&JSON.stringify(seen.beforeImage)===JSON.stringify(beforeRef)&&Number.isFinite(Date.parse(seen.observedAt))&&Date.now()-Date.parse(seen.observedAt)>=0&&Date.now()-Date.parse(seen.observedAt)<60000,'B264_SUP20D_RAW_FRAME');
   return seen;
  },'B264_SUP20D_RAW');
 }
 async function stopped(){const seen=await physical();return seen.runningInstances.length===0&&seen.tasks.length===2&&names.every(n=>seen.tasks.some(t=>t.name===n&&t.state===3))&&!profile.oldWatchers.some(p=>seen.processes.some(q=>q.pid===p.pid));}
 function validateOldSubset(seen){
  need(cut&&snapshotRef,'B264_SUP20D_HELD_CUT_REQUIRED');pin(cut.cutWitness);const drain=read(cut.drainWitness),snapshot=read(snapshotRef),owned=[...targets.map(r=>before.identities[r]),...profile.oldWatchers],aux=[...snapshot.consolePins,...snapshot.probePins,...drain.consolePins,...drain.probePins];
  need(new Set(seen.processes.map(p=>p.pid)).size===seen.processes.length&&seen.runningInstances.length===0&&seen.tasks.length===2&&names.every(n=>{const task=seen.tasks.find(t=>t.name===n),saved=profile.tasks.find(t=>t.name===n);return task?.state===3&&[saved.oldXmlSha256,saved.newXmlSha256].includes(hash(Buffer.from(task.xml)));}),'B264_SUP20D_OLD_TASK_FRAME');
  for(const p of seen.processes){const saved=owned.find(q=>q.pid===p.pid)??profile.protectedProcesses.find(q=>q.pid===p.pid)??aux.find(q=>q.pid===p.pid);need(saved&&sameIdentity({...p,nodePath:p.nodePath.toLowerCase()==='c:\\windows\\system32\\conhost.exe'?saved.nodePath:p.nodePath},saved),'B264_SUP20D_UNCAPTURED_OLD');}
  for(const b of seen.bindings)need(owned.some(p=>p.pid===b.pid&&(p.bindings??[]).some(q=>q.port===b.port&&q.address===b.address)),'B264_SUP20D_FOREIGN_LISTENER');
  return {snapshot,drain};
 }
 async function empty(){const seen=await physical(),{snapshot,drain}=validateOldSubset(seen);if(seen.bindings.length||seen.processes.some(p=>!profile.protectedProcesses.some(q=>sameIdentity(p,q))))return false;const ids=[...Object.values(before.identities),...profile.oldWatchers,...snapshot.consolePins,...snapshot.probePins,...drain.consolePins,...drain.probePins].map(p=>p.pid),consoles=[...new Map([...snapshot.consolePins,...drain.consolePins].map(p=>[p.pid,p])).values()];return await ps(pr54SuccessorEmptyProgram({ids,consoles}))==='EMPTY';}
 async function taskState(kind){const seen=await physical();return seen.tasks.length===2&&names.every(n=>{const t=seen.tasks.find(t=>t.name===n),saved=profile.tasks.find(t=>t.name===n);return t?.state===3&&hash(Buffer.from(t.xml))===saved[kind+'XmlSha256'];});}
 async function changeAction(name,kind){
  need(names.includes(name)&&['old','new'].includes(kind),'B264_SUP20D_ACTION_SCOPE');await guard();need(await stopped()&&await empty(),'B264_SUP20D_ACTION_NOT_EMPTY');const entry=profile.tasks.find(t=>t.name===name),seen=await physical(),task=seen.tasks.find(t=>t.name===name),sha=hash(Buffer.from(task.xml));need([entry.oldXmlSha256,entry.newXmlSha256].includes(sha),'B264_SUP20D_FOREIGN_ACTION');if(sha===entry[kind+'XmlSha256'])return true;
  need(await ps(`$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');$t=$f.GetTask(${quote(name)});$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$t.Xml))).Replace('-','').ToLowerInvariant();if([int]$t.State-ne3-or$sha-cne'${sha}'){throw 'B264_ACTION_CAS'};[void]$f.RegisterTask(${quote(name)},[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(entry[kind+'Xml']).toString('base64')}')),4,'${owner}',$null,3,$null);'SET'`)==='SET','B264_SUP20D_ACTION_SET');return true;
 }
 async function captureCandidate(){
  need(started||await empty(),'B264_SUP20D_CANDIDATE_SCOPE');const seen=await physical(),selected=proposePr54CandidateProcesses(seen,profile),receipts=[];
  for(const p of selected){need(![...Object.values(before.identities),...profile.oldWatchers].some(old=>old.pid===p.pid),'OLD_PID_REUSE');p.bindings=seen.bindings.filter(b=>b.pid===p.pid).map(b=>({port:b.port,address:b.address}));const rule=profile.candidateRules.find(r=>r.role===p.role);if(rule.receipt){const b=fs.readFileSync(rule.receipt.path);receipts.push({role:p.role,path:rule.receipt.path,sha256:hash(b)});}}
  const hub=selected.find(p=>p.role==='hub');if(hub){const directory='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\hub-web',found=[];for(const leaf of fs.readdirSync(directory).filter(n=>/^hub-web-process-[a-f0-9]{32}-[0-3]\.json$/.test(n))){const file=path.win32.join(directory,leaf),b=fs.readFileSync(file);let value;try{value=JSON.parse(b);}catch{continue;}if(value.pid!==hub.pid&&value.processId!==hub.pid)continue;const lineagePath=file.replace('hub-web-process-','hub-web-lineage-');found.push({role:'hub',path:file,sha256:hash(b),lineagePath,lineageSha256:hash(fs.readFileSync(lineagePath))});}need(found.length===1,'HUB_RECEIPT');receipts.push(found[0]);}
  const value={schemaVersion:'melisa-p03-physical-candidate.v1',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,observedAt:seen.observedAt,processes:selected,receipts};const ref=await protectedWrite(root+'\\MelisaERP-P03-candidate-'+crypto.randomBytes(16).toString('hex')+'.json',jsonBytes(value));candidateRef=ref;return {ref,value};
 }
 async function observeNew(ref,leaf){
  await guard();const proof=await invoke(frozen.newObserver,['-PolicyGeneration','B264Sup20DObserveOnly','-Mode','Observe',...common,'-CandidatePath',ref.path,'-CandidateSha256',ref.sha256,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-SourceObserverPath',frozen.observer.path,'-SourceObserverSha256',frozen.observer.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256],{timeout:900000});
  need(proof.status==='NEW_OWNER_OBSERVED_READY'&&proof.profileSha256===profileRef.sha256&&proof.beforeSha256===beforeRef.sha256&&proof.candidateSha256===ref.sha256&&proof.engineSha256===frozen.engine.sha256&&proof.sourceObserverSha256===frozen.observer.sha256&&proof.stableSeconds>=30&&proof.mutationExecuted===false&&proof.sourceProof?.supervisorSourceCommit===candidate.supervisorSource&&proof.sourceProof?.supervisorManifestSha256===candidate.supervisorManifest,'B264_SUP20D_NEW_PROOF');await protectedWrite(path.win32.join(transitionDir,leaf),jsonBytes(proof));return proof;
 }
 async function frozenEngine(action,extra){await guard();return invoke(frozen.engine,['-Environment','Shared',...common,'-Mode',action,...extra],{timeout:900000});}
 async function finishRollback(zeroRef){
  const zero=read(zeroRef);need(zero.processes.length===0&&zero.receipts.length===0&&zero.profileSha256===profileRef.sha256&&zero.beforeSha256===beforeRef.sha256,'B264_SUP20D_ZERO_CANDIDATE');
  const recovered=await frozenEngine('StopNew',['-CandidatePath',zeroRef.path,'-CandidateSha256',zeroRef.sha256]);need(recovered.status==='RECOVERED_OLD_ACTIONS'&&/^[a-f0-9]{64}$/.test(recovered.journalTailSha256),'B264_SUP20D_STOPNEW_RESULT');
  const restored=await frozenEngine('RollbackOld',['-RecoveryTailSha256',recovered.journalTailSha256]);need(restored.status==='RESTORED_READY','B264_SUP20D_ROLLBACK_READBACK');
  await protectedWrite(path.win32.join(transitionDir,'rollback-result.json'),jsonBytes({recovered,restored,zeroRef}));return {status:'FAILED_ROLLED_BACK_OLD_READY',transitionDirectory:transitionDir,successorClaimRef:claimRef,humanAcceptance:'BEKLİYOR',applyExecuted:true};
 }
 const callbacks={plan:before.plan,
  admit:async()=>{await guard();need(fs.readdirSync(profile.journalDirectory).length===0,'B264_SUP20D_JOURNAL_ADVANCED');return {owner:true,oldHealthy:true,oldActions:true,emptyJournal:true};},persist,
  heldCoreCut:async()=>{
   await guard();await history();const snapshot=await invoke(frozen.oldCut,['-PolicyGeneration','B264Sup20DInspectOnly','-Mode','Inspect',...common,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256]);
   need(snapshot.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&snapshot.oldIdentities.length===8&&snapshot.oldWatchers.length===2,'B264_SUP20D_PRECUT');snapshotRef=await protectedWrite(path.win32.join(transitionDir,'successor-precut-admission.json'),jsonBytes(snapshot));
   const rootIntent=await protectedWrite(path.win32.join(transitionDir,'b264-old-owner-cut-intent.json'),jsonBytes({event:'B264_OLD_CUT_INTENT',claimSha256:claimRef.sha256,stopOrderDigest:p03CoreFirstStopDigest(before.plan),profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,observedAt:new Date().toISOString()}));
   cutAttempted=true;cut=await invoke(frozen.oldCut,['-PolicyGeneration','B264Sup20DInspectOnly','-Mode','Drain',...common,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256,'-ClaimPath',claimRef.path,'-ClaimSha256',claimRef.sha256,'-AdmittedSnapshotPath',snapshotRef.path,'-AdmittedSnapshotSha256',snapshotRef.sha256,'-RootIntentPath',rootIntent.path,'-RootIntentSha256',rootIntent.sha256]);
   need(cut.status==='B264_OLD_OWNER_CORE_DRAINED'&&cut.heldCoreExited===true&&cut.comStopped===true&&['COM_STOP_NATURAL_EXIT','EXACT_OBSERVED_PROCESS_STOPPED'].includes(cut.coreStopResult),'B264_SUP20D_HELD_CUT');pin(cut.cutWitness);pin(cut.drainWitness);return Object.fromEntries(['coreStopResult','heldCoreExited','comStopped','cutWitness','drainWitness'].map(k=>[k,cut[k]]));
  },
  tasksStopped:stopped,
  stopExact:async role=>{
   need(targets.includes(role)&&role!=='coreSupervisor','B264_SUP20D_REMAINING_ROLE');await guard();const seen=await physical();validateOldSubset(seen);const saved=before.identities[role],actual=seen.processes.find(p=>p.pid===saved.pid);if(!actual)return 'ALREADY_GONE';need(sameIdentity(actual,saved),'B264_SUP20D_STOP_UID');
   const proof={pid:saved.pid,parentPid:saved.parentPid,nodePath:saved.nodePath,ownerSid:saved.ownerSid,commandLine:saved.commandLine,creationTime:saved.creationTime.replace(/(\.\d{6})0Z$/,'$1Z')};const result=await invoke(profile.stopper,['-ExpectedJsonBase64',Buffer.from(JSON.stringify(proof)).toString('base64')],{text:true});need(['ALREADY_GONE','EXACT_OBSERVED_PROCESS_STOPPED'].includes(result),'B264_SUP20D_STOP_RESULT');return result;
  },
  absent:async role=>!(await physical()).processes.some(p=>p.pid===before.identities[role].pid),portsClear:empty,setAction:changeAction,actionsEqual:taskState,
  startTasks:async()=>{
   await guard();need(!started&&await stopped()&&await empty()&&await taskState('new'),'B264_SUP20D_START_SCOPE');const data=Buffer.from(JSON.stringify(profile.tasks.map(t=>({name:t.name,sha:t.newXmlSha256})))).toString('base64');started=true;
   need(await ps(`$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;foreach($p in $pins){$t=$f.GetTask($p.name);$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$t.Xml))).Replace('-','').ToLowerInvariant();if([int]$t.State-ne3-or$sha-cne$p.sha){throw 'B264_START_CAS'}};[void]$f.GetTask('${names[0]}').Run($null);[void]$f.GetTask('${names[1]}').Run($null);'STARTED'`)==='STARTED','B264_SUP20D_START');return true;
  },
  readback:async()=>{
   const deadline=Date.now()+600000;let capture=null;while(Date.now()<deadline){const frame=await physical();if(proposePr54CandidateProcesses(frame,profile).length===10&&frame.runningInstances.length===2){capture=await captureCandidate();break;}await new Promise(r=>setTimeout(r,1000));}need(capture!==null,'B264_SUP20D_READBACK_TIMEOUT');await observeNew(capture.ref,'new-owner-readback-initial.json');
   await guard();const captureInfo=validatePr54CurrentPreCapture(currentPreCapture,sourcePre.snapshot,sourcePre.proof,sourcePre.backup,{nativeContinuity:preparePr54B264NativeContinuity(currentPreCapture.snapshotRef,sourcePre.snapshot,JSON.parse(await ps(pr54CurrentContinuityProgram(currentPreCapture.snapshotRef,sourcePre.backup))),sourcePre.backup)});
   const proof=await invoke(frozen.invariance,pr54CurrentSourceCaptureArgs(captureInfo.runId),{timeout:3600000}),snapshotPath=captureInfo.root+'\\source-post-snapshot.json',proofPath=captureInfo.root+'\\source-post-proof.json';
   const postRefs={snapshotRef:{path:snapshotPath,sha256:hash(fs.readFileSync(snapshotPath))},proofRef:{path:proofPath,sha256:hash(fs.readFileSync(proofPath))}};await strictPins(Object.values(postRefs));need(JSON.stringify(read(postRefs.proofRef))===JSON.stringify(proof),'B264_SUP20D_POST_OUTPUT');const post=read(postRefs.snapshotRef);validatePr54CurrentPreCapture(postRefs,post,proof,null,{phase:'Post',backupRequired:false});const compared=comparePr54CurrentSourceSnapshots(sourcePre.snapshot,post);await protectedWrite(path.win32.join(transitionDir,'invariance-comparison.json'),jsonBytes({...compared,preSnapshotRef:currentPreCapture.snapshotRef,postSnapshotRef:postRefs.snapshotRef}));const final=await captureCandidate();await observeNew(final.ref,'new-owner-readback-final.json');return true;
  },
  restoreOldActions:async()=>{await guard();need(await stopped()&&await empty(),'B264_SUP20D_RESTORE_NOT_EMPTY');for(const name of names)await changeAction(name,'old');return true;},
 };
 try{return {...await runP03HeldCoreOwnerTransition(callbacks),status:'COMPLETE',transitionDirectory:transitionDir,successorClaimRef:claimRef,candidateRef,applyExecuted:true,humanAcceptance:'BEKLİYOR'};}
 catch(error){
  const failurePhase=error.phase??'ADMISSION';try{await protectedWrite(path.win32.join(transitionDir,'io-failure-diagnostic.json'),jsonBytes({phase:failurePhase,reason:pr54SafeFailure(error),profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256}));}catch{}
  try{
   await guard();need(fs.readdirSync(profile.journalDirectory).length===0,'B264_SUP20D_RECOVERY_JOURNAL_ADVANCED');
   if(started){
    // This independently authenticates ALL raw partial roles. It refuses an
    // uncaptured core/orphan or Hub without lineage; no universal recovery PASS.
    const recovered=await invoke(frozen.newRecovery,['-Action','Drain','-PolicyGeneration','B264Sup20D',...common,'-EnginePath',frozen.engine.path,'-ClaimSha256',claimRef.sha256,'-EmptyRecoveryPath',frozen.emptyRecovery.path,'-RecoveryHelperPath',frozen.helper.path,'-NewObserverPath',frozen.newObserver.path,'-SourceObserverPath',frozen.observer.path],{timeout:900000});
    need(recovered.status==='B264_NEW_OWNER_EMPTY_CANDIDATE_READY'&&recovered.oldOwnerStarted===false&&recovered.engineRecoveryExecuted===false&&recovered.businessWrites===0&&recovered.requiresFrozenStopNewAndRollbackOld===true,'B264_SUP20D_NEW_DRAIN');pin(recovered.candidateRef);return {...await finishRollback(recovered.candidateRef),failurePhase};
   }
   // No new COM stop, core kill, or invented witness after an ambiguous cut.
   // Only an already genuine completed held cut allows the remaining exact OLD
   // subset to be drained and passed to the reviewed zero-candidate engine.
   need(cutAttempted&&cut&&snapshotRef&&await stopped(),'B264_SUP20D_PRESTART_CUT_UNPROVEN');for(const role of ['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative']){await callbacks.stopExact(role);need(await callbacks.absent(role),'B264_SUP20D_PRESTART_REMAINS');}
   need(await empty(),'B264_SUP20D_PRESTART_NOT_EMPTY');for(const name of names)await changeAction(name,'new');const zero=await captureCandidate();return {...await finishRollback(zero.ref),failurePhase};
  }catch(recoveryError){return {status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',failurePhase,recoveryReason:pr54SafeFailure(recoveryError),transitionDirectory:transitionDir,successorClaimRef:claimRef,candidateRef,applyExecuted:cutAttempted||started,humanAcceptance:'BEKLİYOR',unprovenPartialRecoveryGranted:false};}
 }
}

// Additive fixed CurrentB007 physical frame validator; no authority mint.
function currentB007ProtectedConsoleCoverage(pins,current,profile,before,observedAt,auxiliaryPins){
 need(Array.isArray(pins)&&pins.length<=64&&Array.isArray(current.processes)&&Array.isArray(current.bindings)&&Array.isArray(auxiliaryPins),'CURRENT_B007_PROTECTED_CONSOLE_ROWS');
 const owned=[...targets.map(role=>before.identities[role]),...profile.oldWatchers],protectedRows=profile.protectedProcesses,authenticated=[];
 need(new Set(pins.map(p=>p.pid)).size===pins.length,'CURRENT_B007_PROTECTED_CONSOLE_DUPLICATE');
 for(const p of pins){
  need(exactKeys(p,['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'])&&Number.isSafeInteger(p.pid)&&p.pid>0&&!owned.some(q=>q.pid===p.pid)&&!protectedRows.some(q=>q.pid===p.pid)&&!auxiliaryPins.some(q=>q.pid===p.pid),'CURRENT_B007_PROTECTED_CONSOLE_PIN');
  const parents=protectedRows.filter(q=>q.pid===p.parentPid&&q.kind!=='ProtectedSqlService'),parent=parents[0],rawParents=current.processes.filter(q=>q.pid===p.parentPid);
  need(parents.length===1&&parent.ownerSid===owner&&rawParents.length===1&&sameIdentity(parent,rawParents[0]),'CURRENT_B007_PROTECTED_CONSOLE_PARENT');
  need(p.ownerSid===owner&&typeof p.nodePath==='string'&&p.nodePath.toLowerCase()==='c:\\windows\\system32\\conhost.exe'&&p.commandLine==='\\??\\C:\\WINDOWS\\system32\\conhost.exe 0x4'&&typeof p.creationTime==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6,7}Z$/.test(p.creationTime)&&Number.isFinite(Date.parse(p.creationTime))&&preciseTime(p.creationTime)>=preciseTime(parent.creationTime)&&preciseTime(p.creationTime)<=preciseTime(observedAt),'CURRENT_B007_PROTECTED_CONSOLE_IDENTITY');
  const rows=current.processes.filter(q=>q.pid===p.pid),raw=rows[0];
  need(rows.length===1&&typeof raw.nodePath==='string'&&sameIdentity({...raw,nodePath:p.nodePath},p)&&raw.nodePath.toLowerCase()===p.nodePath.toLowerCase()&&!(raw.bindings??[]).length&&!current.bindings.some(q=>q.pid===p.pid),'CURRENT_B007_PROTECTED_CONSOLE_RAW');
  authenticated.push(Object.freeze(Object.fromEntries(['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'].map(k=>[k,raw[k]]))));
 }
 return Object.freeze(authenticated);
}
export function validatePr54CurrentB007PhysicalInspection(args){
 const {frame,profile,current,before}=args;
 need(frame?.schemaVersion==='melisa-p03-b264-precut-inspection.v1'&&frame.policyGeneration==='CurrentB007InspectOnly'&&frame.transitionAuthority===false&&frame.stopAuthority===false&&frame.applyExecuted===false&&exactKeys(frame,['schemaVersion','profileSha256','beforeSha256','engineSha256','recoveryHelperSha256','observedAt','oldIdentities','oldWatchers','consolePins','probePins','policyGeneration','transitionAuthority','stopAuthority','applyExecuted','protectedProcesses','protectedConsolePins']),'CURRENT_B007_INSPECTION_BINDING');
 need(Array.isArray(frame.protectedProcesses)&&JSON.stringify(frame.protectedProcesses)===JSON.stringify(profile.protectedProcesses),'CURRENT_B007_PROTECTED_NATIVE_FRAME');
 need(Array.isArray(frame.protectedConsolePins)&&frame.protectedConsolePins.length<=64&&Array.isArray(current.processes)&&Array.isArray(current.bindings)&&Array.isArray(frame.consolePins)&&Array.isArray(frame.probePins),'CURRENT_B007_PROTECTED_CONSOLE_ROWS');
 const authenticated=currentB007ProtectedConsoleCoverage(frame.protectedConsolePins,current,profile,before,frame.observedAt,[...frame.consolePins,...frame.probePins]);
 // Native signature/hash proof comes only from the pinned worker transport.
 // This temporary view covers protected consoles for raw-set authentication;
 // neither the caller's profile nor owned consolePins/STOP roles are changed.
 const protectedView=Object.freeze({...profile,protectedProcesses:Object.freeze([...profile.protectedProcesses,...authenticated])});
 const {policyGeneration,transitionAuthority,stopAuthority,applyExecuted,protectedProcesses,protectedConsolePins,...raw}=frame;
 const auxiliary=validatePr54PhysicalInspection({...args,profile:protectedView,frame:{...raw,schemaVersion:'melisa-p03-successor-precut-admission.v1'}},'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f');
 return Object.freeze([...auxiliary,...authenticated]);
}
// Fixed CurrentB007 generation: same reviewed transition engine and guards.
const currentB007SourcePins=Object.freeze({
 drainer:['p03-pr54-successor-core-drain.ps1','cc864ca3d9030929f5bc5d30f93ffbaadac72286e40e346bf5d63c32a5926767'],
 observer:['p03-physical-recovery-observe.ps1','8260a0d0fc8c378b68c1c7a6303b085cc265a6045c004f9b81586d5a99e617b1'],
 newObserver:['p03-pr54-new-owner-observe.ps1','777bc48f04fbdd1a48b9cf92aea4deaed4e34a9004139a2b0e9e5eba094445c4'],
 oldCut:['p03-pr54-b264-old-owner-cut.ps1','0760b0e496ac3246a7c1ec3a46fdf8c5b14476898e36a6ff13e6f56c665b008c'],
 newRecovery:['p03-pr54-b264-new-owner-recovery.ps1','d4f4321fab70a0adcbab4a9a46d1be958ecaae9be89f537d48f4d794f1c10b76'],
 invariance:['p03-current-invariance-capture.ps1','0ff308d092d2c2c11d5dd7afe2af6f471f9a1f41ebc3b0c59ccb64f60d456ce6'],
 emptyRecovery:['p03-pr54-new-owner-empty-recovery.ps1','d1065793fc1cd6dbaae8633036f52e4a60ce65c7e969d5fb7e4b51fb242c1438'],
});
export async function runPr54CurrentB007SharedOwnerTransition({mode='DryRun',profileRef,beforeRef,currentPreCapture,rehearsalProofRef,sourceControlDir,freshOwnerGeneration=false,precutContinuation=false,precutResume=false,precutResumeAfter9d2=false,resumeCompletedCut42d0=false,resumeCompletedCut42d0PostCas=false,resumeFailedStopNew42d0=false,finalRestoreWorkerRef=null}={}){
 need(['DryRun','Apply'].includes(mode)&&process.platform==='win32','CURRENT_B007_MODE_PLATFORM');
 need([precutContinuation,precutResume,precutResumeAfter9d2].every(v=>typeof v==='boolean')&&[precutContinuation,precutResume,precutResumeAfter9d2].filter(Boolean).length<=1,'CURRENT_B007_CONTINUATION_MODE');
 need(typeof freshOwnerGeneration==='boolean'&&(!freshOwnerGeneration||![precutContinuation,precutResume,precutResumeAfter9d2,resumeCompletedCut42d0,resumeCompletedCut42d0PostCas,resumeFailedStopNew42d0].some(Boolean)),'CURRENT_B007_FRESH_GENERATION_MODE');
 need(typeof resumeCompletedCut42d0==='boolean'&&(!resumeCompletedCut42d0||(precutResumeAfter9d2&&!precutContinuation&&!precutResume)),'CURRENT_B007_COMPLETED_CUT_MODE');
 need(typeof resumeCompletedCut42d0PostCas==='boolean'&&(!resumeCompletedCut42d0PostCas||resumeCompletedCut42d0),'CURRENT_B007_POSTCAS_MODE');
 need(typeof resumeFailedStopNew42d0==='boolean'&&(!resumeFailedStopNew42d0||(resumeCompletedCut42d0&&resumeCompletedCut42d0PostCas))&&(resumeFailedStopNew42d0||finalRestoreWorkerRef===null),'CURRENT_B007_FINALIZE_MODE');
 const psTransport=resumeCompletedCut42d0||freshOwnerGeneration?{plainCommandOnly:true}:undefined;
 const isResume=precutResume||precutResumeAfter9d2,resumeRefs=precutResumeAfter9d2?PR54_CURRENT_B007_PRECUT_RETRY_REFS:PR54_CURRENT_B007_PRECUT_RESUME_REFS;
 const prepareResume=precutResumeAfter9d2?preparePr54CurrentB007PrecutRetry:preparePr54CurrentB007PrecutResume,validateResume=precutResumeAfter9d2?validatePr54CurrentB007PrecutRetryBinding:validatePr54CurrentB007PrecutResumeBinding;
 const root='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018';
 need(/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-current-b007-control-[a-f0-9]{12}$/.test(sourceControlDir),'CURRENT_B007_SOURCE_DIRECTORY');
 need(typedRef(profileRef)&&typedRef(beforeRef)&&typedRef(rehearsalProofRef)&&exactKeys(currentPreCapture,['snapshotRef','proofRef','backupProofRef'])&&Object.values(currentPreCapture).every(typedRef),'CURRENT_B007_INPUT_REFS');
 const before=read(beforeRef),profile=read(profileRef),runId=before.runId;
 // TWO native admissions determine this epoch's CreateNew slot. A random runId
 // or timestamp cannot reset it; the same OLD process/COM lifetime is one slot.
 let admissionClaimPath=freshOwnerGeneration?null:(precutContinuation||isResume)?PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH:PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH;
 const continuationRaw=()=>Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT_REFS).map(([key,ref])=>[key,{ref,bytes:pin(ref)}]));
 const resumeRaw=()=>({original:continuationRaw(),resume:Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT_RESUME_REFS).map(([key,ref])=>[key,{ref,bytes:pin(ref)}])),...(precutResumeAfter9d2?{retry:Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT_RETRY_REFS).map(([key,ref])=>[key,{ref,bytes:pin(ref)}]))}:{})});
 const continuationReceipt=isResume?(resumeCompletedCut42d0?validateResume:prepareResume)({raw:resumeRaw(),profileRef,beforeRef,profile,before}):precutContinuation?preparePr54CurrentB007PrecutContinuation({raw:continuationRaw(),profileRef,beforeRef,profile,before}):null;
 const resumeAttemptPath=isResume?path.win32.join(path.win32.dirname(resumeRefs.failureTail.path),'resume-attempt.json'):null;
 let resumeAttemptRef=resumeCompletedCut42d0?{path:resumeAttemptPath,sha256:'c7e2f4b3a206295173d04c01ff0d4436c49f71b5eaf847da7f89c34b3346bc63'}:null;
 need(/^[a-f0-9]{32}$/.test(runId)&&profileRef.path===root+'\\MelisaERP-P03-profile-'+runId+'.json'&&beforeRef.path===root+'\\MelisaERP-P03-before-'+runId+'.json'&&JSON.stringify(profile.beforeImage)===JSON.stringify(beforeRef),'CURRENT_B007_RUN');
 need(profile.database===currentDatabase&&before.database===currentDatabase&&before.copyId===currentCopy&&before.actualT1===false&&profile.ownerSid===owner&&before.ownerSid===owner,'CURRENT_B007_TARGET');
 const candidate=assertPr54CurrentB007Candidate({...before.profile,supervisorRoot:profile.packages?.find(p=>p.sourceCommit===before.profile?.supervisorSource)?.root,newSettings:profile.newSettings});
 need(before.plan?.digest===p03TransitionDigest(before.plan)&&before.plan.oldSettingsSha256===profile.oldSettings.sha256&&before.plan.newSettingsSha256===profile.newSettings.sha256,'CURRENT_B007_PLAN');
 need(profile.journalDirectory===root+'\\MelisaERP-P03-recovery-'+runId&&profile.stopper?.path===root+'\\MelisaERP-P03-stopper-'+runId+'.ps1'&&profile.stopper.sha256==='79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d','CURRENT_B007_RECOVERY_SCOPE');
 need(JSON.stringify(profile.businessDigest)===JSON.stringify(currentPreCapture.snapshotRef)&&/^C:\\Sirket\\ERP\\backups\\(?:P03-20261020-\d{6}\\source-pre-snapshot|P03-20261021-\d{6}\\source-pre-snapshot(?:-[a-f0-9]{32})?)\.json$/.test(profile.businessDigest.path),'CURRENT_B007_CAPTURE');
 need(rehearsalProofRef.path===String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-06889c3b196045bbacf33a10f450a178\result.json`&&rehearsalProofRef.sha256==='80e22ce1689fe7c7e8ca01cfafbbba5025e5fa31e9097e55810368c34e1fbc62','CURRENT_B007_REHEARSAL_PATH');
 const engineRef={path:path.win32.join(sourceControlDir,'p03-physical-rollback-lifetime-v2.ps1'),sha256:PR54_CURRENT_B007_ENGINE_SHA256},helperRef={path:root+'\\p03-pr54-paused-old-recover.ps1',sha256:'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'};
 const selectedPins=freshOwnerGeneration?{...currentB007SourcePins,
  drainer:['p03-pr54-successor-core-drain.ps1','9a0e0931bbd1897f55d25396cd64619a663821eccd6ebf8cb00d1250e5bdab33'],
  observer:['p03-physical-recovery-observe.ps1','a92f4d712c59970ae50a8ace92dbbeba52d59fadfe542794879d9da898394812'],
  oldCut:['p03-pr54-b264-old-owner-cut.ps1','86e1995d93438c1920dcd37fb0275ab86f25f4f85fb45bb3d8936e2271696138'],
  newObserver:['p03-pr54-new-owner-observe.ps1','c47701ad2e288e186aa1d93eaccdc66044d36690e13428e1cb08dda6b638ae55'],
  newRecovery:['p03-pr54-b264-new-owner-recovery.ps1','2fbfcd966751cddb5dca1b22dd63ff6be46d5fd317e895300a0ad34f9520e251'],
  lateOld:['p03-pr54-current-b007-precut-cut.ps1','dbf7049cb54411766072936f251b3a8eeaaabe0855751154974223e4509a325c'],
 }:currentB007SourcePins;
 const sources=Object.fromEntries(Object.entries(selectedPins).map(([name,[leaf,sha256]])=>[name,{path:path.win32.join(sourceControlDir,leaf),sha256}]));
 if(precutContinuation||isResume){
  sources.oldCut={path:path.win32.join(sourceControlDir,'p03-pr54-current-b007-precut-cut.ps1'),sha256:'ebfbe596906e3c98951df085df4d84648152d581ac774353815cdfea3b3bd138'};
  sources.newRecovery={path:path.win32.join(sourceControlDir,'p03-pr54-current-b007-precut-new-recovery.ps1'),sha256:'667ac16f0a83251db2e11e9e337ce9894de4803efc9ed5a2b2fe6129672fb28c'};
 }
 if(resumeCompletedCut42d0)sources.oldCut={...sources.oldCut,sha256:'213835b02b8eb367bbb6858a76cfcd36e46103bac960843d04bde3c971d703b7'};
 const rehearsal=read(rehearsalProofRef);
 need(rehearsal.status==='REHEARSAL_ROLLBACK_READY'&&rehearsal.environment==='P03_REHEARSAL'&&rehearsal.sharedTestMutation===false&&rehearsal.protectedBeforeSha256===rehearsal.protectedAfterSha256,'ACTUAL_REHEARSAL_REQUIRED');
 need(rehearsal.engineSha256===engineRef.sha256&&rehearsal.engine?.sha256===engineRef.sha256,'SAME_REHEARSED_ENGINE_REQUIRED');
 const sourcePre={snapshot:read(currentPreCapture.snapshotRef),proof:read(currentPreCapture.proofRef),backup:read(currentPreCapture.backupProofRef)};
 const fixedReads=[profileRef,beforeRef,rehearsalProofRef,...Object.values(currentPreCapture),engineRef,helperRef,profile.stopper,profile.oldSettings,profile.newSettings,...Object.values(sources),...((precutContinuation||isResume)?Object.values(PR54_CURRENT_B007_PRECUT_REFS):[]),...(isResume?Object.values(PR54_CURRENT_B007_PRECUT_RESUME_REFS):[]),...(precutResumeAfter9d2?Object.values(PR54_CURRENT_B007_PRECUT_RETRY_REFS):[])];
 need(profile.packages.length===7,'CURRENT_B007_SEVEN_PACKAGES');
 if(resumeFailedStopNew42d0){
  // Only the recorded failed StopNew phase. The original b33 dispatcher and
  // its quarantined journal stay immutable. This existing native worker owns
  // its separately pinned, one-shot finalization records and exact task CAS.
  need(runId==='42d0d0536cb115cc4aea43ff1f13afbf'&&profileRef.sha256==='a06625191c5b8ccdc622a40555513fcd5192fa81eae784ee706fc258cee9100e'&&beforeRef.sha256==='e05d2d7d30a8d477457a78adf7bbe342955d4667a0ba005dc0e399b3e3b8e791'&&sourceControlDir===root+'\\MelisaERP-P03-current-b007-control-f7c6286076b4','CURRENT_B007_FINALIZE_SCOPE');
  need(typedRef(finalRestoreWorkerRef)&&finalRestoreWorkerRef.path===root+'\\MelisaERP-P03-current-b007-control-8029a92aa83a\\p03-pr54-current-b007-precut-cut.ps1'&&finalRestoreWorkerRef.sha256==='8029a92aa83a9c7e64dda8ff9055ec3f260c0ae9e4327a6ac9f972004a0c97ac','CURRENT_B007_FINALIZE_WORKER');
  await strictPins([...fixedReads,finalRestoreWorkerRef]);await guardProtected();
  need(await ps('[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',psTransport)===owner,'CALLER');
  async function finalContinuity(){const observation=JSON.parse(await ps(pr54CurrentContinuityProgram(currentPreCapture.snapshotRef,sourcePre.backup),psTransport));need(observation.server==='Semih\\MELISADEV'&&observation.database===currentDatabase&&observation.copyId===currentCopy&&observation.actualT1===false&&observation.sealed===true&&observation.readOnly===true&&sameRecoveryRef(observation.snapshotRef,currentPreCapture.snapshotRef)&&observation.backupSetGuid.toLowerCase()===sourcePre.backup.backupSetGuid.toLowerCase()&&Number.isFinite(Date.parse(observation.observedAt))&&Date.now()-Date.parse(observation.observedAt)>=0&&Date.now()-Date.parse(observation.observedAt)<60000,'CURRENT_B007_FINALIZE_DB_SCOPE');}
  await finalContinuity();
  const cutDir=root+'\\MelisaERP-P03-transition-'+runId,claim=PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim;
  const args=['-PolicyGeneration','CurrentB007InspectOnly','-Mode',mode==='Apply'?'FinalizeOld42d0Apply':'FinalizeOld42d0Inspect','-WorkerSourceSha256',finalRestoreWorkerRef.sha256,'-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256,'-EnginePath',cutDir+'\\p03-physical-rollback-lifetime-v2.ps1','-EngineSha256',engineRef.sha256,'-RecoveryHelperPath',helperRef.path,'-RecoveryHelperSha256',helperRef.sha256,'-DrainerPath',sources.drainer.path,'-DrainerSha256',sources.drainer.sha256,'-ClaimPath',claim.path,'-ClaimSha256',claim.sha256,'-AdmittedSnapshotPath',cutDir+'\\successor-precut-admission.json','-AdmittedSnapshotSha256','6307733ac07c330f67a47027875bb052f2e45b4aa0b187e630271d8837743175','-RootIntentPath',cutDir+'\\b264-old-owner-cut-intent.json','-RootIntentSha256','1ec55968246907d4a21b3019e876f0a69e7f19e9a535dace2c87bce2f284e1b6','-ContinuationPath',cutDir+'\\precut-continuation.json','-ContinuationSha256','c7e2f4b3a206295173d04c01ff0d4436c49f71b5eaf847da7f89c34b3346bc63'];
  const result=await invoke(finalRestoreWorkerRef,args,{timeout:900000});
  need(result.status===(mode==='Apply'?'B264_COMPLETED42_OLD_RESTORED_READY':'B264_COMPLETED42_FINALIZE_OLD_DRY_RUN')&&result.recoveryOnly===true&&result.newGenerationStarted===false&&result.profileSha256===profileRef.sha256&&result.beforeSha256===beforeRef.sha256&&result.mutationExecuted===(mode==='Apply'),'CURRENT_B007_FINALIZE_RESULT');
  need(result.engineSha256===engineRef.sha256&&(mode==='Apply'?result.oldActionsRestored===true&&result.startedTasks===2&&Number.isFinite(result.stableSeconds)&&result.stableSeconds>=30&&/^[a-f0-9]{64}$/.test(result.identityDigest)&&result.quarantinedJournalTailSha256==='cc202c25a1917b3263ba034f09457d10c01686b8a0b09031e5d5c15249df96db':result.oldRolesAbsent===true&&result.oldActionsRestored===false&&result.journalTailSha256==='cc202c25a1917b3263ba034f09457d10c01686b8a0b09031e5d5c15249df96db'),'CURRENT_B007_FINALIZE_PROOF');
  await guardProtected();await finalContinuity();return {...result,applyExecuted:mode==='Apply',humanAcceptance:'BEKLİYOR'};
 }
 let claimRef=null,claimBytes=null,transitionCreated=false,cut=null,snapshotRef=null,started=false,cutAttempted=false,sequence=0,previous=beforeRef.sha256,candidateRef=null;
 const transitionDir=root+'\\MelisaERP-P03-transition-'+runId,eventRefs=[],frozen={};let continuationRef=null;
 const completedCutPins=[],recoveryAppendPins=[],recoveryWrites=new Set();let completedCutNativeArgs=null;
 function sameRecoveryRef(actual,expected){return typedRef(actual)&&typedRef(expected)&&actual.path===expected.path&&actual.sha256===expected.sha256;}
 async function strictPins(refs){
  // Same full per-pin path/ACL/hash checks, fewer PowerShell startups. No
  // cached result is reused across a guard or a native ownership boundary.
  for(let n=0;n<refs.length;n+=8){const batch=refs.slice(n,n+8);for(const r of batch)pin(r);const data=Buffer.from(JSON.stringify(batch)).toString('base64');
   need(await ps(`$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;foreach($r in $pins){$p=$r.path;${psNoReparse}$a=Get-Acl -LiteralPath $p;$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne'${owner}'-or$rules.Count-ne2){throw 'B264_IO_ACL'};foreach($sid in @('${owner}','S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'B264_IO_ACL'}};if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()-cne$r.sha256){throw 'B264_IO_HASH'}};'VERIFIED'`,psTransport)==='VERIFIED','CURRENT_B007_PIN_ACL');
  }
 }
 async function history(){
  const refs=b264ReadPins();for(let n=0;n<refs.length;n+=8)need(await ps(pr54B264ReadPinsProgram(refs.slice(n,n+8)),psTransport)==='VERIFIED','CURRENT_B007_HISTORY_ACL');
  for(const rows of [PR54_B264_OUTER_REFS,PR54_B264_RECOVERY_REFS])need(JSON.stringify(fs.readdirSync(path.win32.dirname(rows[0].path)).filter(n=>n.startsWith('event-')).sort())===JSON.stringify(rows.map(r=>path.win32.basename(r.path)).sort()),'CURRENT_B007_HISTORY_SCOPE');
  const raw=Object.fromEntries(Object.entries(PR54_B264_REFS).map(([k,ref])=>[k,{ref,bytes:pin(ref)}]));raw.outer=PR54_B264_OUTER_REFS.map(ref=>({ref,bytes:pin(ref)}));raw.recovery=PR54_B264_RECOVERY_REFS.map(ref=>({ref,bytes:pin(ref)}));validatePr54B264Predecessor(raw);return raw;
 }
 async function guardProtected(){
 const data=Buffer.from(JSON.stringify(profile.protectedProcesses)).toString('base64');
 await ps(`$expected=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;foreach($e in $expected){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$e.pid);if(-not$p-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTime]::Parse($e.creationTime).ToUniversalTime().Ticks){throw 'PROTECTED_BIRTH'};if($e.PSObject.Properties.Name-contains'kind'-and$e.kind-ceq'ProtectedSqlService'){$v=@(Get-CimInstance Win32_Service -Filter 'Name="MSSQL$MELISADEV"');if($p.Name-cne'sqlservr.exe'-or$v.Count-ne1-or$v[0].ProcessId-ne$e.pid-or$v[0].State-cne'Running'-or$v[0].StartName-cne$e.service.startName-or$v[0].PathName-cne$e.service.pathName){throw 'SQL_PROTECT'};$c=[Data.SqlClient.SqlConnection]::new(${quote(PR54_PROTECT_SQL_CONNECTION)});$c.Open();try{$q=$c.CreateCommand();$q.CommandTimeout=5;$q.CommandText="SELECT CAST(SERVERPROPERTY('ProcessID') AS int),CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)),DB_NAME()";$reader=$q.ExecuteReader();try{if(-not$reader.Read()-or$reader.GetInt32(0)-ne$e.pid-or$reader.GetString(1)-cne'Semih\\MELISADEV'-or$reader.GetString(2)-cne'master'){throw 'SQL_MASTER_IDENTITY'}}finally{$reader.Dispose()}}finally{$c.Dispose()}}else{$o=Invoke-CimMethod $p -MethodName GetOwnerSid;if($o.ReturnValue-ne0-or$o.Sid-cne$e.ownerSid-or$p.ExecutablePath-ine$e.nodePath-or$p.CommandLine-cne$e.commandLine-or$p.ParentProcessId-ne$e.parentPid){throw 'PROTECTED_IDENTITY'}}};'UNCHANGED'`,psTransport);
 return true;
 }

 async function guard(){
  await strictPins(fixedReads);for(const p of profile.packages)pin({path:p.manifestPath,sha256:p.manifestSha256});await guardProtected();
  if(precutContinuation||isResume){
   if(isResume){
    const bind=resumeAttemptRef?validateResume:prepareResume;
    need(JSON.stringify(bind({raw:resumeRaw(),profileRef,beforeRef,profile,before}))===JSON.stringify(continuationReceipt),'CURRENT_B007_RESUME_CHANGED');
    const failedDir=path.win32.dirname(resumeRefs.failureTail.path);
    const allowed=['transition.lock','event-0000.json','event-0001.json','event-0002.json','io-failure-diagnostic.json','precut-continuation.json','successor-precut-admission.json','b264-old-owner-cut-intent.json','p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(currentB007SourcePins).filter(([leaf])=>!['p03-pr54-b264-old-owner-cut.ps1','p03-pr54-b264-new-owner-recovery.ps1'].includes(leaf)).map(([leaf])=>leaf),'p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1',...(resumeAttemptRef?['resume-attempt.json']:[])].sort();
    noReparseAncestors(failedDir);need(JSON.stringify(fs.readdirSync(failedDir).sort())===JSON.stringify(allowed),'CURRENT_B007_RESUME_SCOPE_ADVANCED');
    if(precutResumeAfter9d2){const priorDir=path.win32.dirname(PR54_CURRENT_B007_PRECUT_RESUME_REFS.failureTail.path);noReparseAncestors(priorDir);need(JSON.stringify(fs.readdirSync(priorDir).sort())===JSON.stringify([...allowed.filter(n=>n!=='resume-attempt.json'),'resume-attempt.json'].sort()),'CURRENT_B007_RETRY_PRIOR_SCOPE');need(fs.readdirSync(read(PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile).journalDirectory).length===0,'CURRENT_B007_RETRY_PRIOR_JOURNAL');}
    if(resumeAttemptRef){await strictPins([resumeAttemptRef]);need(pin(resumeAttemptRef).equals(jsonBytes(continuationReceipt)),'CURRENT_B007_RESUME_ATTEMPT_CHANGED');}else need(!fs.existsSync(resumeAttemptPath),'CURRENT_B007_RESUME_ALREADY_ATTEMPTED');
   }else{
   const bind=claimRef?validatePr54CurrentB007PrecutContinuationBinding:preparePr54CurrentB007PrecutContinuation;
   need(JSON.stringify(bind({raw:continuationRaw(),profileRef,beforeRef,profile,before}))===JSON.stringify(continuationReceipt),'CURRENT_B007_CONTINUATION_CHANGED');
   }
   const failedDir=path.win32.dirname(PR54_CURRENT_B007_PRECUT_REFS.failureTail.path);
   const allowed=['transition.lock','event-0000.json','event-0001.json','event-0002.json','io-failure-diagnostic.json','successor-precut-admission.json','b264-old-owner-cut-intent.json','p03-physical-rollback-lifetime-v2.ps1','p03-pr54-paused-old-recover.ps1',...Object.values(currentB007SourcePins).map(p=>p[0])].sort();
   noReparseAncestors(failedDir);need(JSON.stringify(fs.readdirSync(failedDir).sort())===JSON.stringify(allowed),'CURRENT_B007_FAILED_SCOPE_ADVANCED');
  }
  if(claimRef){await strictPins([claimRef]);need(pin(claimRef).equals(claimBytes),'CURRENT_B007_CLAIM_CHANGED');}else if(isResume){await strictPins([PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim]);}else if(admissionClaimPath!==null)need(!fs.existsSync(admissionClaimPath),'B264_SUCCESSOR_ALREADY_CONSUMED');
  if(transitionCreated){for(const ref of eventRefs)pin(ref);for(const ref of Object.values(frozen))pin(ref);}
  if(resumeCompletedCut42d0){await strictPins([...completedCutPins,...recoveryAppendPins]);if(completedCutPins.length){const allowed=new Set([...completedCutPins.filter(r=>path.win32.dirname(r.path)===transitionDir).map(r=>path.win32.basename(r.path)),...recoveryAppendPins.filter(r=>path.win32.dirname(r.path)===transitionDir).map(r=>path.win32.basename(r.path))]);need(fs.readdirSync(transitionDir).every(n=>allowed.has(n)),'CURRENT_B007_COMPLETED_CUT_SCOPE');}}
  return true;
 }
 async function invoke(ref,args,{timeout=180000,text=false}={}){
  pin(ref);const argv=['-NoProfile','-NonInteractive','-File',ref.path,...args],invocation=resumeCompletedCut42d0||freshOwnerGeneration?b264Sup20dHeldInvocation(ref,argv,{fileInvocationOnly:true}):b264Sup20dHeldInvocation(ref,argv),began=Date.now();
  try{const result=await run(shell,invocation,{...opts,timeout});need(!result.stderr,'CURRENT_B007_WORKER_STDERR');return text?result.stdout.trim():JSON.parse(result.stdout);}catch(error){
   if(resumeCompletedCut42d0){const at=args.indexOf('-Mode'),action=at>=0?args[at+1]:'Physical';try{Object.defineProperty(error,'p03WorkerDiagnostic',{value:Object.freeze({workerLeaf:path.win32.basename(ref.path),action:/^[A-Za-z0-9]{1,40}$/.test(action)?action:'UNKNOWN',elapsedMs:Date.now()-began,exitCode:Number.isInteger(error?.code)?error.code:null,errno:['ETIMEDOUT','EACCES','EPERM','ENOENT','ENOMEM'].includes(error?.code)?error.code:null,killed:error?.killed===true,signal:['SIGTERM','SIGKILL','SIGINT'].includes(error?.signal)?error.signal:null,stderrSha256:hash(Buffer.from(String(error?.stderr??'')))})});}catch{}}
   throw error;
  }
 }
 const common=['-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256];
 async function admit(){
  const started=Date.now(),completed=[];let stage='GUARD',stageStarted=started;
  const elapsed=from=>{const value=Date.now()-from;return Number.isFinite(value)&&value>=0?Math.min(Math.floor(value),86400000):0;};
  const next=name=>{completed.push(Object.freeze({stage,elapsedMs:elapsed(stageStarted)}));stage=name;stageStarted=Date.now();};
  try{
  await guard();
  // The frozen engine's read-only dispatcher verifies every payload/config
  // byte in the same seven packages before each genuine physical admission.
  // It runs BEFORE the immutable claim's short live-owner window begins.
  next('FULL_PACKAGE_PREFLIGHT');const preflight=await invoke(engineRef,['-Environment','Shared',...common,'-Mode','PreflightOld'],{timeout:900000});
  need(exactKeys(preflight,['status','environment','profileSha256','beforeImageSha256','applyAvailable','mutationExecuted'])&&preflight.status==='OLD_PHYSICAL_PREFLIGHT'&&preflight.environment==='Shared'&&preflight.profileSha256===profileRef.sha256&&preflight.beforeImageSha256===beforeRef.sha256&&preflight.applyAvailable===false&&preflight.mutationExecuted===false,'CURRENT_B007_FULL_PACKAGE_PREFLIGHT');
  next('HISTORY');const raw=await history();
  next('PHYSICAL');const physical=await inspectPr54CurrentB007PhysicalOwner({profileRef,beforeRef,engineRef,recoveryHelperRef:helperRef,drainerRef:sources.drainer,observerRef:sources.observer},{freshOwnerGeneration,precutContinuation,precutResume,precutResumeAfter9d2});
  next('CONTINUITY_READ');const observation=JSON.parse(await ps(pr54CurrentContinuityProgram(currentPreCapture.snapshotRef,sourcePre.backup),psTransport));
  next('CONTINUITY_VALIDATE');const nativeContinuity=preparePr54CurrentB007NativeContinuity(currentPreCapture.snapshotRef,sourcePre.snapshot,observation,sourcePre.backup);
  validatePr54CurrentPreCapture(currentPreCapture,sourcePre.snapshot,sourcePre.proof,sourcePre.backup,{nativeContinuity});next('PROTECTED');await guardProtected();
  next('ADMIT');
  return admitPr54CurrentB007Epoch({raw,profileRef,beforeRef,profileBytes:pin(profileRef),beforeBytes:pin(beforeRef),profile:physical.profile,before:physical.before,current:physical.current,candidate,nativeContinuity,physicalInspection:physical.physicalInspection});
  }catch(error){try{Object.defineProperty(error,'p03AdmissionTiming',{value:Object.freeze({stage,elapsedMs:elapsed(started),stageElapsedMs:elapsed(stageStarted),completed:Object.freeze(completed)})});}catch{}throw error;}
 }
 if(resumeCompletedCut42d0)return recoverCompletedCut42d0();
 await guard();need(await ps(`[Security.Principal.WindowsIdentity]::GetCurrent().User.Value`,psTransport)===owner,'CALLER');
 need(!fs.existsSync(transitionDir)&&fs.readdirSync(profile.journalDirectory).length===0,'CURRENT_B007_PRIOR_JOURNAL');
 const first=await admit();
 if(freshOwnerGeneration){need(/^[a-f0-9]{64}$/.test(first.claim.currentOwnerDigest),'CURRENT_B007_FRESH_EPOCH');admissionClaimPath=root+'\\p03-pr54-current-b007-generation-'+first.claim.currentOwnerDigest+'.lock.json';need(!fs.existsSync(admissionClaimPath),'B264_SUCCESSOR_ALREADY_CONSUMED');}
 if(mode==='DryRun')return {status:'CURRENT_B007_DRY_RUN_ONLY',applyExecuted:false,claimCreated:false,transitionAuthority:false,candidate,sourceControlDir,proofDigest:first.proofDigest,...(freshOwnerGeneration?{generationClaimPath:admissionClaimPath}:{} )};
 async function protectedWrite(file,bytes){
  if(resumeCompletedCut42d0)need(recoveryWrites.has(file),'CURRENT_B007_COMPLETED_CUT_WRITE_SCOPE');
  need(path.win32.normalize(file)===file&&((!isResume&&file===admissionClaimPath)||(isResume&&file===resumeAttemptPath)||file.startsWith(transitionDir+'\\')||new RegExp('^'+root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\\\MelisaERP-P03-candidate-[a-f0-9]{32}\\.json$').test(file)),'CURRENT_B007_WRITE_SCOPE');
  noReparseAncestors(file);const ref={path:file,sha256:hash(bytes)};await psPayload(pr54ProtectedWriteProgram(file,ref.sha256),bytes,psTransport);need(pin(ref).equals(bytes),'CURRENT_B007_WRITE_READBACK');if(resumeCompletedCut42d0)recoveryAppendPins.push(ref);return ref;
 }
 // Two genuine observations agree on identities/history/SQL, not clock bytes.
 const second=await admit(),stable=x=>{const {ownerObservedAt,...rest}=x.claim;return JSON.stringify({proofDigest:x.proofDigest,claim:rest});};
 need(stable(first)===stable(second)&&Date.parse(second.claim.ownerObservedAt)>=Date.parse(first.claim.ownerObservedAt)&&Date.now()-Date.parse(second.claim.ownerObservedAt)<60000,'CURRENT_B007_ADMISSION_DRIFT');
 const actualClaim={...second.claim,schemaVersion:'melisa-p03-current-b007-epoch-claim.v1',transitionAuthority:true,applyExecuted:false};
 need(Object.keys(actualClaim).length===20,'CURRENT_B007_CLAIM_FIELDS');claimBytes=jsonBytes(actualClaim);
 if(isResume){
  const retained=read(PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim),canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const stableClaim=value=>Object.fromEntries(Object.entries(value).filter(([k])=>!['ownerObservedAt','successorRunId','successorProfile','successorBefore'].includes(k)));
  need(JSON.stringify(canonical(stableClaim(actualClaim)))===JSON.stringify(canonical(stableClaim(retained)))&&Date.parse(second.claim.ownerObservedAt)>=Date.parse(before.observedAt),'CURRENT_B007_RESUME_LIVE_CLAIM_DRIFT');
  claimRef=PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim;claimBytes=pin(claimRef);
  resumeAttemptRef=await protectedWrite(resumeAttemptPath,jsonBytes(continuationReceipt));
 }else claimRef=await protectedWrite(admissionClaimPath,claimBytes);
 await strictPins([claimRef]);
 // A consumed claim is never re-admitted, overwritten or deleted, even if a
 // later gate fails. Historical pins remain separately checked after claim.
 await guard();await history();
 await ps(`$p=${quote(transitionDir)};${psNoReparse}if(Test-Path -LiteralPath $p){throw 'EXISTS'};$s=[Security.AccessControl.DirectorySecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new('${owner}'));$s.SetAccessRuleProtection($true,$false);foreach($id in @('${owner}','S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($p,$s);'CREATED'`,psTransport);transitionCreated=true;
 for(const [name,ref]of Object.entries({engine:engineRef,helper:helperRef,...sources}))frozen[name]=await protectedWrite(path.win32.join(transitionDir,path.win32.basename(ref.path)),pin(ref));
 if(precutContinuation||isResume)continuationRef=await protectedWrite(path.win32.join(transitionDir,'precut-continuation.json'),jsonBytes(continuationReceipt));
 await protectedWrite(path.win32.join(transitionDir,'transition.lock'),jsonBytes({profileRef,beforeRef,currentPreCapture,rehearsalProofRef,successorClaimRef:claimRef,sourceControlDir,...(continuationRef?{continuationRef}:{})}));
 async function persist(record){need(record.sequence===sequence,'EVENT_SEQUENCE');await guard();const ref=await protectedWrite(path.win32.join(transitionDir,'event-'+String(sequence).padStart(4,'0')+'.json'),jsonBytes({...record,previousSha256:previous,profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256}));eventRefs.push(ref);previous=ref.sha256;sequence++;return {created:true,sequence:record.sequence};}
 async function physical(){
  await guardProtected();return pr54CollectPhysicalObservation(async()=>{
   // Raw Physical collection only; no CandidateProposal filtering and no use
   // of a role-only result as a stop authority. NEW observer authenticates it.
   const seen=await invoke(frozen.observer,['-Environment','Shared','-Purpose','Physical','-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256]);
   need(seen.schemaVersion==='melisa-p03-physical-observation.v1'&&seen.environment==='Shared'&&seen.collectionAuthority==='PHYSICAL_OBSERVATION_ONLY'&&seen.processScope==='CIM.Win32_Process.Unfiltered'&&seen.portScope==='Get-NetTCPConnection.Listen.Unfiltered'&&seen.stopPermitted===false&&seen.applyAvailable===false&&seen.rawScope?.unverifiedCount===0&&seen.rawScope.unverifiedProcesses?.length===0&&JSON.stringify(seen.beforeImage)===JSON.stringify(beforeRef)&&Number.isFinite(Date.parse(seen.observedAt))&&Date.now()-Date.parse(seen.observedAt)>=0&&Date.now()-Date.parse(seen.observedAt)<60000,'CURRENT_B007_RAW_FRAME');
   return seen;
  },'PHYSICAL');
 }
 async function stopped(){const seen=await physical();return seen.runningInstances.length===0&&seen.tasks.length===2&&names.every(n=>seen.tasks.some(t=>t.name===n&&t.state===3))&&!profile.oldWatchers.some(p=>seen.processes.some(q=>q.pid===p.pid));}
 function validateOldSubset(seen){
  need(cut&&snapshotRef,'CURRENT_B007_HELD_CUT_REQUIRED');pin(cut.cutWitness);const drain=read(cut.drainWitness),snapshot=read(snapshotRef),owned=[...targets.map(r=>before.identities[r]),...profile.oldWatchers],aux=[...snapshot.consolePins,...snapshot.probePins,...drain.consolePins,...drain.probePins],readonly=currentB007ProtectedConsoleCoverage(snapshot.protectedConsolePins,seen,profile,before,snapshot.observedAt,aux);
  need(new Set(seen.processes.map(p=>p.pid)).size===seen.processes.length&&seen.runningInstances.length===0&&seen.tasks.length===2&&names.every(n=>{const task=seen.tasks.find(t=>t.name===n),saved=profile.tasks.find(t=>t.name===n);return task?.state===3&&[saved.oldXmlSha256,saved.newXmlSha256].includes(hash(Buffer.from(task.xml)));}),'CURRENT_B007_OLD_TASK_FRAME');
  for(const p of seen.processes){const saved=owned.find(q=>q.pid===p.pid)??profile.protectedProcesses.find(q=>q.pid===p.pid)??aux.find(q=>q.pid===p.pid)??readonly.find(q=>q.pid===p.pid);need(saved&&sameIdentity({...p,nodePath:p.nodePath.toLowerCase()==='c:\\windows\\system32\\conhost.exe'?saved.nodePath:p.nodePath},saved),'CURRENT_B007_UNCAPTURED_OLD');}
  for(const b of seen.bindings)need(owned.some(p=>p.pid===b.pid&&(p.bindings??[]).some(q=>q.port===b.port&&q.address===b.address)),'CURRENT_B007_FOREIGN_LISTENER');
  return {snapshot,drain,readonly};
 }
 async function empty(){
  const seen=await physical(),{snapshot,drain,readonly}=validateOldSubset(seen);if(seen.bindings.length||seen.processes.some(p=>![...profile.protectedProcesses,...readonly].some(q=>sameIdentity(p,q))))return false;
  let historicalPid=null;
  if(resumeCompletedCut42d0){
   // This is a fresh read-only native proof of the one historical auxiliary
   // console epoch. It never filters raw coverage or grants stop authority.
   need(typeof completedCutNativeArgs==='function','CURRENT_B007_COMPLETED_CUT_CHECK_ARGS');
   const proof=await invoke(frozen.oldCut,completedCutNativeArgs('ResumeDrainCheck'),{timeout:900000});
   const saved=snapshot.consolePins.filter(p=>p.pid===4900),pinRows=proof.historicalConsolePins;
   need(proof.status==='B264_COMPLETED_CUT_HISTORICAL_AUX_READ_ONLY'&&proof.scope==='CURRENT42D0_HISTORICAL_CONSOLE_4900_ONLY'&&proof.mutationExecuted===false&&proof.stopPermitted===false&&proof.profileSha256===profileRef.sha256&&proof.beforeSha256===beforeRef.sha256&&sameRecoveryRef(proof.cutWitness,cut.cutWitness)&&sameRecoveryRef(proof.drainWitness,cut.drainWitness)&&Array.isArray(pinRows)&&pinRows.length===1&&exactKeys(pinRows[0],['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'])&&saved.length===1&&sameIdentity(pinRows[0],saved[0])&&pinRows[0].pid===4900&&pinRows[0].nodePath.toLowerCase()==='c:\\windows\\system32\\conhost.exe'&&/^[a-f0-9]{64}$/.test(proof.replacementEpochDigest)&&![...Object.values(before.identities),...profile.oldWatchers,...profile.protectedProcesses,...snapshot.probePins,...drain.probePins].some(p=>p.pid===4900)&&Number.isFinite(Date.parse(proof.observedAt))&&Date.parse(proof.observedAt)>=Date.parse(seen.observedAt)&&Date.now()-Date.parse(proof.observedAt)>=0&&Date.now()-Date.parse(proof.observedAt)<60000,'CURRENT_B007_COMPLETED_CUT_HISTORICAL_AUX');
   historicalPid=4900;
  }
  const ids=[...Object.values(before.identities),...profile.oldWatchers,...snapshot.consolePins,...snapshot.probePins,...drain.consolePins,...drain.probePins].filter(p=>p.pid!==historicalPid).map(p=>p.pid),consoles=[...new Map([...snapshot.consolePins,...drain.consolePins].filter(p=>p.pid!==historicalPid).map(p=>[p.pid,p])).values()];return await ps(pr54SuccessorEmptyProgram({ids,consoles}),psTransport)==='EMPTY';
 }
 async function taskState(kind){const seen=await physical();return seen.tasks.length===2&&names.every(n=>{const t=seen.tasks.find(t=>t.name===n),saved=profile.tasks.find(t=>t.name===n);return t?.state===3&&hash(Buffer.from(t.xml))===saved[kind+'XmlSha256'];});}
 async function changeAction(name,kind){
  need(names.includes(name)&&['old','new'].includes(kind),'CURRENT_B007_ACTION_SCOPE');await guard();need(await stopped()&&await empty(),'CURRENT_B007_ACTION_NOT_EMPTY');const entry=profile.tasks.find(t=>t.name===name),seen=await physical(),task=seen.tasks.find(t=>t.name===name),sha=hash(Buffer.from(task.xml));need([entry.oldXmlSha256,entry.newXmlSha256].includes(sha),'CURRENT_B007_FOREIGN_ACTION');if(sha===entry[kind+'XmlSha256'])return true;
  need(await ps(`$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');$t=$f.GetTask(${quote(name)});$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$t.Xml))).Replace('-','').ToLowerInvariant();if([int]$t.State-ne3-or$sha-cne'${sha}'){throw 'B264_ACTION_CAS'};[void]$f.RegisterTask(${quote(name)},[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(entry[kind+'Xml']).toString('base64')}')),4,'${owner}',$null,3,$null);'SET'`,psTransport)==='SET','CURRENT_B007_ACTION_SET');return true;
 }
 async function captureCandidate({readOnly=false}={}){
  need(typeof readOnly==='boolean'&&(!readOnly||resumeCompletedCut42d0PostCas),'CURRENT_B007_CANDIDATE_READ_ONLY_MODE');
  need(started||await empty(),'CURRENT_B007_CANDIDATE_SCOPE');const seen=await physical(),selected=proposePr54CandidateProcesses(seen,profile),receipts=[];
  for(const p of selected){need(![...Object.values(before.identities),...profile.oldWatchers].some(old=>old.pid===p.pid),'OLD_PID_REUSE');p.bindings=seen.bindings.filter(b=>b.pid===p.pid).map(b=>({port:b.port,address:b.address}));const rule=profile.candidateRules.find(r=>r.role===p.role);if(rule.receipt){const b=fs.readFileSync(rule.receipt.path);receipts.push({role:p.role,path:rule.receipt.path,sha256:hash(b)});}}
  const hub=selected.find(p=>p.role==='hub');if(hub){const directory='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\hub-web',found=[];for(const leaf of fs.readdirSync(directory).filter(n=>/^hub-web-process-[a-f0-9]{32}-[0-3]\.json$/.test(n))){const file=path.win32.join(directory,leaf),b=fs.readFileSync(file);let value;try{value=JSON.parse(b);}catch{continue;}if(value.pid!==hub.pid&&value.processId!==hub.pid)continue;const lineagePath=file.replace('hub-web-process-','hub-web-lineage-');found.push({role:'hub',path:file,sha256:hash(b),lineagePath,lineageSha256:hash(fs.readFileSync(lineagePath))});}need(found.length===1,'HUB_RECEIPT');receipts.push(found[0]);}
  const value={schemaVersion:'melisa-p03-physical-candidate.v1',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,observedAt:seen.observedAt,processes:selected,receipts};if(readOnly){const {readonly}=validateOldSubset(seen);need(selected.length===0&&receipts.length===0&&seen.bindings.length===0&&seen.processes.every(p=>[...profile.protectedProcesses,...readonly].some(q=>sameIdentity(p,q)))&&seen.runningInstances.length===0&&seen.tasks.length===2&&names.every(name=>{const actual=seen.tasks.find(t=>t.name===name),saved=profile.tasks.find(t=>t.name===name);return actual?.state===3&&hash(Buffer.from(actual.xml))===saved.newXmlSha256;}),'CURRENT_B007_POSTCAS_NOT_ZERO');return {value};}const candidatePath=root+'\\MelisaERP-P03-candidate-'+crypto.randomBytes(16).toString('hex')+'.json';if(resumeCompletedCut42d0)recoveryWrites.add(candidatePath);const ref=await protectedWrite(candidatePath,jsonBytes(value));candidateRef=ref;return {ref,value};
 }
 async function observeNew(ref,leaf){
  await guard();const proof=await invoke(frozen.newObserver,['-PolicyGeneration','CurrentB007ObserveOnly','-Mode','Observe',...common,'-CandidatePath',ref.path,'-CandidateSha256',ref.sha256,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-SourceObserverPath',frozen.observer.path,'-SourceObserverSha256',frozen.observer.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256],{timeout:900000});
  need(proof.status==='NEW_OWNER_OBSERVED_READY'&&proof.profileSha256===profileRef.sha256&&proof.beforeSha256===beforeRef.sha256&&proof.candidateSha256===ref.sha256&&proof.engineSha256===frozen.engine.sha256&&proof.sourceObserverSha256===frozen.observer.sha256&&proof.stableSeconds>=30&&proof.mutationExecuted===false&&proof.sourceProof?.supervisorSourceCommit===candidate.supervisorSource&&proof.sourceProof?.supervisorManifestSha256===candidate.supervisorManifest,'CURRENT_B007_NEW_PROOF');await protectedWrite(path.win32.join(transitionDir,leaf),jsonBytes(proof));return proof;
 }
 async function frozenEngine(action,extra){await guard();return invoke(frozen.engine,['-Environment','Shared',...common,'-Mode',action,...extra],{timeout:900000});}
 async function finishRollback(zeroRef){
  const zero=read(zeroRef);need(zero.processes.length===0&&zero.receipts.length===0&&zero.profileSha256===profileRef.sha256&&zero.beforeSha256===beforeRef.sha256,'CURRENT_B007_ZERO_CANDIDATE');
  const recovered=await frozenEngine('StopNew',['-CandidatePath',zeroRef.path,'-CandidateSha256',zeroRef.sha256]);need(recovered.status==='RECOVERED_OLD_ACTIONS'&&/^[a-f0-9]{64}$/.test(recovered.journalTailSha256),'CURRENT_B007_STOPNEW_RESULT');
  let restored,originalReadbackFailure=null;
  try{restored=await frozenEngine('RollbackOld',['-RecoveryTailSha256',recovered.journalTailSha256]);need(restored.status==='RESTORED_READY','CURRENT_B007_ROLLBACK_READBACK');}catch(error){
   if(!freshOwnerGeneration||heldCoreReason(error)!=='P03_PHYSICAL_ROLLBACK_READBACK_FAILED')throw error;
   const tailPath=path.win32.join(profile.journalDirectory,'event-0007.json'),tailRef={path:tailPath,sha256:hash(fs.readFileSync(tailPath))};await strictPins([tailRef]);
   const tail=read(tailRef);need(tail.sequence===7&&tail.event==='QUARANTINED'&&tail.profileSha256===profileRef.sha256&&tail.beforeSha256===beforeRef.sha256,'CURRENT_B007_LATE_OLD_TAIL');
   // Observe only the already-started OLD tasks. The native reader validates
   // all eight immutable events and measures 10m from their original start.
   restored=await invoke(frozen.lateOld,['-PolicyGeneration','CurrentB007InspectOnly','-Mode','ObserveStartedOld','-WorkerSourceSha256',frozen.lateOld.sha256,...common,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256,'-RollbackFailureTailSha256',tailRef.sha256],{timeout:660000});
   need(restored.status==='OLD_READY_LATE_OBSERVED'&&restored.profileSha256===profileRef.sha256&&restored.beforeSha256===beforeRef.sha256&&restored.engineSha256===frozen.engine.sha256&&restored.rollbackFailureTailSha256===tailRef.sha256&&restored.stableSeconds>=30&&/^[a-f0-9]{64}$/.test(restored.identityDigest)&&restored.mutationExecuted===false&&restored.startExecuted===false&&restored.newGenerationStarted===false,'CURRENT_B007_LATE_OLD_PROOF');
   originalReadbackFailure={code:'P03_PHYSICAL_ROLLBACK_READBACK_FAILED',tailRef};await protectedWrite(path.win32.join(transitionDir,'late-old-readback.json'),jsonBytes(restored));
  }
  await protectedWrite(path.win32.join(transitionDir,'rollback-result.json'),jsonBytes({recovered,restored,zeroRef,...(originalReadbackFailure?{originalReadbackFailure}:{} )}));return {status:'FAILED_ROLLED_BACK_OLD_READY',transitionDirectory:transitionDir,successorClaimRef:claimRef,humanAcceptance:'BEKLİYOR',applyExecuted:true};
 }
 async function recoverCompletedCut42d0(){
  // Recovery of this one recorded completed cut, never another admission or
  // new-generation start. Historical claim, failed journal and pointers remain
  // immutable; the native phase authenticates the actual cut-time windows.
  need(runId==='42d0d0536cb115cc4aea43ff1f13afbf'&&profileRef.sha256==='a06625191c5b8ccdc622a40555513fcd5192fa81eae784ee706fc258cee9100e'&&beforeRef.sha256==='e05d2d7d30a8d477457a78adf7bbe342955d4667a0ba005dc0e399b3e3b8e791','CURRENT_B007_COMPLETED_CUT_RUN');
  const hashes={
   'transition.lock':'529cb039012f157cdbe0395beb760c47e9297e23db8badb08b1b76743ed31478',
   'precut-continuation.json':'c7e2f4b3a206295173d04c01ff0d4436c49f71b5eaf847da7f89c34b3346bc63',
   'successor-precut-admission.json':'6307733ac07c330f67a47027875bb052f2e45b4aa0b187e630271d8837743175',
   'b264-old-owner-cut-intent.json':'1ec55968246907d4a21b3019e876f0a69e7f19e9a535dace2c87bce2f284e1b6',
   'b264-old-owner-held-cut-intent.json':'d02b03d0fff4953211a11029f45d7fa14949bbc95433bca98b669a16c72f996b',
   'successor-core-cut-completed.json':'9c34ca6fa5677927a0df780775c13b929e59ed5baf0732cb15f43714179d91fb',
   'event-0000.json':'3fe7476876a9373e4add7e69e2b4806490011291533eaa21e8fcdd7c583fc937',
   'event-0001.json':'19cf41d5d20ab587176925f4da14879292b0bf1eac208020328c88109b369a15',
   'event-0002.json':'9b729821da2461174532b51bd1fb467216d12b4710c2b56a04c5be5ed59d9aef',
   'io-failure-diagnostic.json':'ae1d923a995992c5f79b3c199fad8cc3ca99037dbf1a740418aef3d0c5a41b9c',
  };
  if(resumeCompletedCut42d0PostCas)Object.assign(hashes,{
   'completed-cut-recovery-intent.json':'be80fc9de56013c5d147fff746678aa92f57b941f377a0d29833706bb4865764',
   'completed-cut-recovery-result.json':'7b85fb2f4b4017de936bbbd772f03f3a7a9d521d8ba584fc4ddcf167d761fd3d',
   'successor-core-probe-drain.json':'5aa1a47e5a5bd6cb8f09c008fa54f62ca3bf46372c7c4a14fa48574cdd5cacaa',
   'completed-cut-recovery-stop-hub-intent.json':'c8e383b77d49d62df0730ad91fa3c880f347b57a6f5182d5f998f1a7181d9c26',
   'completed-cut-recovery-stop-hub-result.json':'3e7d879592e7cf69f8deede2688cb9e91b769f3683a835a8b99fe8e950d26506',
   'completed-cut-recovery-stop-crmServer-intent.json':'3b761a437d840bd6ba5fa1208a56c9bb3d0c13330b472c3f9f512cd207017843',
   'completed-cut-recovery-stop-crmServer-result.json':'1862a722a7935325cc488262ffc688b484bb543f4dc0ae8899f9ef0cf82c0cf2',
   'completed-cut-recovery-stop-crmOrders-intent.json':'a87d700a86e54f8a30c9a1df95fd5bb7a5c76913ddbff8bfa7b995600a30cc14',
   'completed-cut-recovery-stop-crmOrders-result.json':'000482b96279f7d2f0c378b0000f304ba366a89e2506cc2cec7c9f0e9edb6815',
   'completed-cut-recovery-stop-crmCatalog-intent.json':'d6ad045d590725ac65bbb5bbdb1318f56e1bb741da1ad88a580ee8216af1d7f2',
   'completed-cut-recovery-stop-crmCatalog-result.json':'bcb583b7b5d623b5e1b9af9cd42cafdfd78cc7d2d5850c58352030177979df3d',
   'completed-cut-recovery-stop-crmNativeOrder-intent.json':'215ea03cc8b85dab1294d6e68af6eba5e82e42ffa8fae33927df9a92227a5eec',
   'completed-cut-recovery-stop-crmNativeOrder-result.json':'49b7b98f043cfe7e9b9bad6d81485ee669aac7b47bfe626b55c6dc8fb1ebcb7f',
   'completed-cut-recovery-stop-erpApi-intent.json':'2a8968698adbbc5f7d8ad7fad7143e41cd665b027d7eea62e8c7ce8b088f7cf7',
   'completed-cut-recovery-stop-erpApi-result.json':'3c3c6455eaa75f37fba5b12798dfa789844b3583665dc527f11e4ee5995763d4',
   'completed-cut-recovery-stop-erpNative-intent.json':'a6213b554dd13cc7a3bb1e98a477ef808aa2b2081c29ee4a02141d2a6864d170',
   'completed-cut-recovery-stop-erpNative-result.json':'7d50548e6fc30219154a440f3d179a8c982ead49b892011fb910346fde62de82',
  });
  const refs=Object.fromEntries(Object.entries(hashes).map(([leaf,sha256])=>[leaf,{path:path.win32.join(transitionDir,leaf),sha256}]));
  completedCutPins.push(profileRef,beforeRef,...Object.values(refs));
  const original={engine:engineRef,helper:helperRef,...sources,oldCut:{path:path.win32.join(transitionDir,'p03-pr54-current-b007-precut-cut.ps1'),sha256:'ebfbe596906e3c98951df085df4d84648152d581ac774353815cdfea3b3bd138'}};
  for(const [name,ref]of Object.entries(original)){const saved={path:path.win32.join(transitionDir,path.win32.basename(ref.path)),sha256:ref.sha256};completedCutPins.push(saved);frozen[name]=name==='oldCut'?sources.oldCut:saved;}
  completedCutPins.forEach(pin);const lock=read(refs['transition.lock']);
  need(JSON.stringify(lock.profileRef)===JSON.stringify(profileRef)&&JSON.stringify(lock.beforeRef)===JSON.stringify(beforeRef)&&JSON.stringify(lock.currentPreCapture)===JSON.stringify(currentPreCapture)&&JSON.stringify(lock.rehearsalProofRef)===JSON.stringify(rehearsalProofRef)&&JSON.stringify(lock.successorClaimRef)===JSON.stringify(PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim)&&JSON.stringify(lock.continuationRef)===JSON.stringify(refs['precut-continuation.json']),'CURRENT_B007_COMPLETED_CUT_LOCK');
  claimRef=PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim;claimBytes=pin(claimRef);continuationRef=refs['precut-continuation.json'];snapshotRef=refs['successor-precut-admission.json'];transitionCreated=true;cutAttempted=true;
  eventRefs.push(refs['event-0000.json'],refs['event-0001.json'],refs['event-0002.json']);
  const roles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative'];
  const stem=resumeCompletedCut42d0PostCas?'completed-cut-postcas-recovery':'completed-cut-recovery';
  const intentPath=path.win32.join(transitionDir,stem+'-intent.json'),resultPath=path.win32.join(transitionDir,stem+'-result.json');
  need(!fs.existsSync(intentPath)&&!fs.existsSync(resultPath)&&fs.readdirSync(profile.journalDirectory).length===0,'CURRENT_B007_COMPLETED_CUT_ALREADY_ATTEMPTED');
  if(resumeCompletedCut42d0PostCas){
   const first=read(refs['completed-cut-recovery-intent.json']),failed=read(refs['completed-cut-recovery-result.json']),drain=read(refs['successor-core-probe-drain.json']);
   need(exactKeys(first,['schemaVersion','mode','runId','profileRef','beforeRef','claimRef','cutRef','failureTailRef','workerRef'])&&first.schemaVersion==='melisa-p03-current-b007-completed-cut-recovery.v1'&&first.mode==='ROLLBACK_OLD_ONLY'&&first.runId===runId&&sameRecoveryRef(first.profileRef,profileRef)&&sameRecoveryRef(first.beforeRef,beforeRef)&&sameRecoveryRef(first.claimRef,claimRef)&&sameRecoveryRef(first.cutRef,refs['successor-core-cut-completed.json'])&&sameRecoveryRef(first.failureTailRef,refs['event-0002.json'])&&sameRecoveryRef(first.workerRef,frozen.oldCut),'CURRENT_B007_POSTCAS_FIRST_INTENT');
   need(exactKeys(failed,['status','reason','recoveryOnly','newGenerationStarted'])&&failed.status==='QUARANTINED_REQUIRES_ROOT_INSPECTION'&&failed.reason==='B264_SOURCE_ACL'&&failed.recoveryOnly===true&&failed.newGenerationStarted===false,'CURRENT_B007_POSTCAS_FIRST_RESULT');
   need(drain.event==='B264_OLD_OWNER_CORE_PROBES_ABSENT'&&drain.profileSha256===profileRef.sha256&&drain.beforeSha256===beforeRef.sha256&&sameRecoveryRef(drain.cutWitness,refs['successor-core-cut-completed.json'])&&Array.isArray(drain.consolePins)&&Array.isArray(drain.probePins),'CURRENT_B007_POSTCAS_DRAIN');
   for(const role of roles){const intent=read(refs['completed-cut-recovery-stop-'+role+'-intent.json']),result=read(refs['completed-cut-recovery-stop-'+role+'-result.json']);need(exactKeys(intent,['role','identity','alreadyAbsent','cutRef'])&&intent.role===role&&JSON.stringify(intent.identity)===JSON.stringify(before.identities[role])&&intent.alreadyAbsent===(role!=='hub')&&sameRecoveryRef(intent.cutRef,refs['successor-core-cut-completed.json'])&&exactKeys(result,['role','result'])&&result.role===role&&result.result===(role==='hub'?'EXACT_OBSERVED_PROCESS_STOPPED':'ALREADY_GONE'),'CURRENT_B007_POSTCAS_STOP_PROOF');}
   cut={cutWitness:refs['successor-core-cut-completed.json'],drainWitness:refs['successor-core-probe-drain.json']};
  }
  const nativeArgs=action=>['-PolicyGeneration','CurrentB007InspectOnly','-Mode',action,'-WorkerSourceSha256',frozen.oldCut.sha256,...common,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256,'-ClaimPath',claimRef.path,'-ClaimSha256',claimRef.sha256,'-AdmittedSnapshotPath',snapshotRef.path,'-AdmittedSnapshotSha256',snapshotRef.sha256,'-RootIntentPath',refs['b264-old-owner-cut-intent.json'].path,'-RootIntentSha256',refs['b264-old-owner-cut-intent.json'].sha256,'-ContinuationPath',continuationRef.path,'-ContinuationSha256',continuationRef.sha256];
  completedCutNativeArgs=nativeArgs;
  await guard();need(await ps('[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',psTransport)===owner,'CALLER');
  let remainingOldRoles=0;
  if(resumeCompletedCut42d0PostCas){need(await taskState('new'),'CURRENT_B007_POSTCAS_TASKS');await captureCandidate({readOnly:true});}else{
   const checked=await invoke(frozen.oldCut,nativeArgs('ResumeDrainDryRun'),{timeout:900000});
   need(checked.status==='B264_COMPLETED_CUT_RESUME_DRY_RUN'&&checked.mutationExecuted===false&&checked.coreAbsent===true&&checked.watchersAbsent===true&&checked.probesAbsent===true&&Number.isSafeInteger(checked.remainingOldRoles)&&checked.remainingOldRoles>=0&&checked.remainingOldRoles<=7&&sameRecoveryRef(checked.cutWitness,refs['successor-core-cut-completed.json']),'CURRENT_B007_COMPLETED_CUT_FRESH');remainingOldRoles=checked.remainingOldRoles;
  }
  await guard();const observation=JSON.parse(await ps(pr54CurrentContinuityProgram(currentPreCapture.snapshotRef,sourcePre.backup),psTransport));
  need(observation.server==='Semih\\MELISADEV'&&observation.database===currentDatabase&&observation.copyId===currentCopy&&observation.actualT1===false&&observation.sealed===true&&observation.readOnly===true&&JSON.stringify(observation.snapshotRef)===JSON.stringify(currentPreCapture.snapshotRef)&&observation.backupSetGuid.toLowerCase()===sourcePre.backup.backupSetGuid.toLowerCase()&&Number.isFinite(Date.parse(observation.observedAt))&&Date.now()-Date.parse(observation.observedAt)>=0&&Date.now()-Date.parse(observation.observedAt)<60000,'CURRENT_B007_COMPLETED_CUT_DB_SCOPE');
  if(mode==='DryRun')return {status:resumeCompletedCut42d0PostCas?'CURRENT_B007_POSTCAS_RECOVERY_DRY_RUN':'CURRENT_B007_COMPLETED_CUT_RECOVERY_DRY_RUN',recoveryOnly:true,applyExecuted:false,claimCreated:false,newGenerationStarted:false,remainingOldRoles};
  recoveryWrites.add(intentPath);recoveryWrites.add(resultPath);recoveryWrites.add(path.win32.join(transitionDir,'rollback-result.json'));
  if(!resumeCompletedCut42d0PostCas)for(const role of roles)for(const kind of ['intent','result'])recoveryWrites.add(path.win32.join(transitionDir,'completed-cut-recovery-stop-'+role+'-'+kind+'.json'));
  // CreateNew is the one-shot boundary. No restart or retry after any error.
  await protectedWrite(intentPath,jsonBytes(resumeCompletedCut42d0PostCas?{schemaVersion:'melisa-p03-current-b007-postcas-recovery.v1',mode:'ROLLBACK_OLD_ONLY',runId,profileRef,beforeRef,firstIntentRef:refs['completed-cut-recovery-intent.json'],firstResultRef:refs['completed-cut-recovery-result.json'],drainRef:refs['successor-core-probe-drain.json']}:{schemaVersion:'melisa-p03-current-b007-completed-cut-recovery.v1',mode:'ROLLBACK_OLD_ONLY',runId,profileRef,beforeRef,claimRef,cutRef:refs['successor-core-cut-completed.json'],failureTailRef:refs['event-0002.json'],workerRef:frozen.oldCut}));
  try{
   if(!resumeCompletedCut42d0PostCas){
   cut=await invoke(frozen.oldCut,nativeArgs('ResumeDrain'),{timeout:900000});
   need(cut.status==='B264_OLD_OWNER_CORE_DRAINED'&&cut.heldCoreExited===true&&cut.comStopped===true&&['COM_STOP_NATURAL_EXIT','EXACT_OBSERVED_PROCESS_STOPPED'].includes(cut.coreStopResult)&&sameRecoveryRef(cut.cutWitness,refs['successor-core-cut-completed.json'])&&cut.drainWitness?.path===path.win32.join(transitionDir,'successor-core-probe-drain.json')&&typedRef(cut.drainWitness),'CURRENT_B007_COMPLETED_CUT_DRAIN');
   recoveryAppendPins.push(cut.drainWitness);await guard();need(await stopped(),'CURRENT_B007_COMPLETED_CUT_TASKS');
   for(const role of roles){
    await guard();const seen=await physical();validateOldSubset(seen);const saved=before.identities[role],actual=seen.processes.find(p=>p.pid===saved.pid);need(!actual||sameIdentity(actual,saved),'CURRENT_B007_STOP_UID');
    await protectedWrite(path.win32.join(transitionDir,'completed-cut-recovery-stop-'+role+'-intent.json'),jsonBytes({role,identity:saved,alreadyAbsent:!actual,cutRef:cut.cutWitness}));
    let result='ALREADY_GONE';if(actual){await guard();const latest=await physical();validateOldSubset(latest);need(sameIdentity(latest.processes.find(p=>p.pid===saved.pid),saved),'CURRENT_B007_STOP_UID');const proof={pid:saved.pid,parentPid:saved.parentPid,nodePath:saved.nodePath,ownerSid:saved.ownerSid,commandLine:saved.commandLine,creationTime:saved.creationTime.replace(/(\.\d{6})0Z$/,'$1Z')};result=await invoke(profile.stopper,['-ExpectedJsonBase64',Buffer.from(JSON.stringify(proof)).toString('base64')],{text:true});need(['ALREADY_GONE','EXACT_OBSERVED_PROCESS_STOPPED'].includes(result),'CURRENT_B007_STOP_RESULT');}
    need(!(await physical()).processes.some(p=>p.pid===saved.pid),'CURRENT_B007_PRESTART_REMAINS');await protectedWrite(path.win32.join(transitionDir,'completed-cut-recovery-stop-'+role+'-result.json'),jsonBytes({role,result}));
   }
   await guard();need(await empty(),'CURRENT_B007_PRESTART_NOT_EMPTY');for(const name of names)await changeAction(name,'new');
   }else{await guard();need(await taskState('new')&&await empty(),'CURRENT_B007_POSTCAS_NOT_EMPTY');}
   const zero=await captureCandidate();const result=await finishRollback(zero.ref);
   await protectedWrite(resultPath,jsonBytes({status:'RECOVERED_OLD_READY',recoveryOnly:true,newGenerationStarted:false,rollbackResult:result}));return {...result,status:'RECOVERED_OLD_READY',recoveryOnly:true,newGenerationStarted:false};
  }catch(error){const reason=heldCoreReason(error),diagnostic=error?.p03WorkerDiagnostic?{workerDiagnostic:error.p03WorkerDiagnostic}:{};try{await protectedWrite(resultPath,jsonBytes({status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',reason,recoveryOnly:true,newGenerationStarted:false,...diagnostic}));}catch{}return {status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',recoveryOnly:true,newGenerationStarted:false,recoveryReason:reason,applyExecuted:true,transitionDirectory:transitionDir,successorClaimRef:claimRef,humanAcceptance:'BEKLİYOR',...diagnostic};}
 }
 let heldCoreFailure=null;
 function heldCoreReason(error){
  const allowed=/^(?:P03_(?:PHYSICAL|CURRENT_B007|SHARED_CURRENT_B007|B264)_[A-Z0-9][A-Z0-9_]*|B264_SOURCE_(?:ACL|HASH|ARGS))$/;
  const message=String(error?.message??'').trim();if(message.length<=180&&allowed.test(message))return message;
  // execFile messages echo the entire command, including dormant throw literals.
  // Only error output carries native codes; never mine the echoed command text.
  for(const line of String(error?.stderr??'').replace(/_x000D_|_x000A_/g,'\n').split(/\r?\n/)){const token=line.trim().replace(/^PowerShell error:\s*/,'');if(token.length<=180&&allowed.test(token))return token;}
  if(error?.killed===true||error?.signal)return 'P03_SHARED_CURRENT_B007_WORKER_INTERRUPTED';
  return pr54SafeFailure({message:message.length<=180&&!/^Command failed:/i.test(message)?message:'',code:error?.code});
 }
 const callbacks={plan:before.plan,
  admit:async()=>{await guard();need(fs.readdirSync(profile.journalDirectory).length===0,'CURRENT_B007_JOURNAL_ADVANCED');return {owner:true,oldHealthy:true,oldActions:true,emptyJournal:true};},persist,
  heldCoreCut:async()=>{
   let stage='INSPECT';try{
   await guard();await history();const snapshot=await invoke(frozen.oldCut,['-PolicyGeneration','CurrentB007InspectOnly','-Mode','Inspect',...common,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256]);
   stage='SNAPSHOT';
   need(snapshot.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&snapshot.oldIdentities.length===8&&snapshot.oldWatchers.length===2&&snapshot.profileSha256===profileRef.sha256&&snapshot.beforeSha256===beforeRef.sha256&&snapshot.engineSha256===frozen.engine.sha256&&snapshot.recoveryHelperSha256===frozen.helper.sha256&&Array.isArray(snapshot.protectedConsolePins)&&Number.isFinite(Date.parse(snapshot.observedAt))&&Date.now()-Date.parse(snapshot.observedAt)>=0&&Date.now()-Date.parse(snapshot.observedAt)<60000,'CURRENT_B007_PRECUT');snapshotRef=await protectedWrite(path.win32.join(transitionDir,'successor-precut-admission.json'),jsonBytes(snapshot));
   stage='ROOT_INTENT';const rootIntent=await protectedWrite(path.win32.join(transitionDir,'b264-old-owner-cut-intent.json'),jsonBytes({event:'B264_OLD_CUT_INTENT',claimSha256:claimRef.sha256,stopOrderDigest:p03CoreFirstStopDigest(before.plan),profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256,observedAt:new Date().toISOString()}));
   stage='DRAIN';
   cutAttempted=true;cut=await invoke(frozen.oldCut,['-PolicyGeneration','CurrentB007InspectOnly','-Mode','Drain',...common,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.helper.path,'-RecoveryHelperSha256',frozen.helper.sha256,'-DrainerPath',frozen.drainer.path,'-DrainerSha256',frozen.drainer.sha256,'-ClaimPath',claimRef.path,'-ClaimSha256',claimRef.sha256,'-AdmittedSnapshotPath',snapshotRef.path,'-AdmittedSnapshotSha256',snapshotRef.sha256,'-RootIntentPath',rootIntent.path,'-RootIntentSha256',rootIntent.sha256,...(continuationRef?['-ContinuationPath',continuationRef.path,'-ContinuationSha256',continuationRef.sha256]:[])]);
   stage='CUT_READBACK';need(cut.status==='B264_OLD_OWNER_CORE_DRAINED'&&cut.heldCoreExited===true&&cut.comStopped===true&&['COM_STOP_NATURAL_EXIT','EXACT_OBSERVED_PROCESS_STOPPED'].includes(cut.coreStopResult),'CURRENT_B007_HELD_CUT');pin(cut.cutWitness);pin(cut.drainWitness);return Object.fromEntries(['coreStopResult','heldCoreExited','comStopped','cutWitness','drainWitness'].map(k=>[k,cut[k]]));
   }catch(error){heldCoreFailure??=Object.freeze({stage,reason:heldCoreReason(error)});throw error;}
  },
  tasksStopped:stopped,
  stopExact:async role=>{
   need(targets.includes(role)&&role!=='coreSupervisor','CURRENT_B007_REMAINING_ROLE');await guard();const seen=await physical();validateOldSubset(seen);const saved=before.identities[role],actual=seen.processes.find(p=>p.pid===saved.pid);if(!actual)return 'ALREADY_GONE';need(sameIdentity(actual,saved),'CURRENT_B007_STOP_UID');
   const proof={pid:saved.pid,parentPid:saved.parentPid,nodePath:saved.nodePath,ownerSid:saved.ownerSid,commandLine:saved.commandLine,creationTime:saved.creationTime.replace(/(\.\d{6})0Z$/,'$1Z')};const result=await invoke(profile.stopper,['-ExpectedJsonBase64',Buffer.from(JSON.stringify(proof)).toString('base64')],{text:true});need(['ALREADY_GONE','EXACT_OBSERVED_PROCESS_STOPPED'].includes(result),'CURRENT_B007_STOP_RESULT');return result;
  },
  absent:async role=>!(await physical()).processes.some(p=>p.pid===before.identities[role].pid),portsClear:empty,setAction:changeAction,actionsEqual:taskState,
  startTasks:async()=>{
   await guard();need(!started&&await stopped()&&await empty()&&await taskState('new'),'CURRENT_B007_START_SCOPE');const data=Buffer.from(JSON.stringify(profile.tasks.map(t=>({name:t.name,sha:t.newXmlSha256})))).toString('base64');started=true;
   need(await ps(`$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;foreach($p in $pins){$t=$f.GetTask($p.name);$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$t.Xml))).Replace('-','').ToLowerInvariant();if([int]$t.State-ne3-or$sha-cne$p.sha){throw 'B264_START_CAS'}};[void]$f.GetTask('${names[0]}').Run($null);[void]$f.GetTask('${names[1]}').Run($null);'STARTED'`,psTransport)==='STARTED','CURRENT_B007_START');return true;
  },
  readback:async()=>{
   const deadline=Date.now()+600000;let capture=null;while(Date.now()<deadline){const frame=await physical();if(proposePr54CandidateProcesses(frame,profile).length===10&&frame.runningInstances.length===2){capture=await captureCandidate();break;}await new Promise(r=>setTimeout(r,1000));}need(capture!==null,'CURRENT_B007_READBACK_TIMEOUT');await observeNew(capture.ref,'new-owner-readback-initial.json');
   await guard();const captureInfo=validatePr54CurrentPreCapture(currentPreCapture,sourcePre.snapshot,sourcePre.proof,sourcePre.backup,{nativeContinuity:preparePr54CurrentB007NativeContinuity(currentPreCapture.snapshotRef,sourcePre.snapshot,JSON.parse(await ps(pr54CurrentContinuityProgram(currentPreCapture.snapshotRef,sourcePre.backup),psTransport)),sourcePre.backup)});
   const proof=await invoke(frozen.invariance,pr54CurrentSourceCaptureArgs(captureInfo.runId),{timeout:3600000}),snapshotPath=captureInfo.root+'\\source-post-snapshot.json',proofPath=captureInfo.root+'\\source-post-proof.json';
   const postRefs={snapshotRef:{path:snapshotPath,sha256:hash(fs.readFileSync(snapshotPath))},proofRef:{path:proofPath,sha256:hash(fs.readFileSync(proofPath))}};await strictPins(Object.values(postRefs));need(JSON.stringify(read(postRefs.proofRef))===JSON.stringify(proof),'CURRENT_B007_POST_OUTPUT');const post=read(postRefs.snapshotRef);validatePr54CurrentPreCapture(postRefs,post,proof,null,{phase:'Post',backupRequired:false});const compared=comparePr54CurrentSourceSnapshots(sourcePre.snapshot,post);await protectedWrite(path.win32.join(transitionDir,'invariance-comparison.json'),jsonBytes({...compared,preSnapshotRef:currentPreCapture.snapshotRef,postSnapshotRef:postRefs.snapshotRef}));const final=await captureCandidate();await observeNew(final.ref,'new-owner-readback-final.json');return true;
  },
  restoreOldActions:async()=>{await guard();need(await stopped()&&await empty(),'CURRENT_B007_RESTORE_NOT_EMPTY');for(const name of names)await changeAction(name,'old');return true;},
 };
 try{return {...await runP03HeldCoreOwnerTransition(callbacks),status:'COMPLETE',transitionDirectory:transitionDir,successorClaimRef:claimRef,candidateRef,applyExecuted:true,humanAcceptance:'BEKLİYOR'};}
 catch(error){
  const failurePhase=error.phase??'ADMISSION';try{await protectedWrite(path.win32.join(transitionDir,'io-failure-diagnostic.json'),jsonBytes({phase:failurePhase,reason:pr54SafeFailure(error),...(heldCoreFailure?{failureDiagnostic:heldCoreFailure}:{}),profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256}));}catch{}
  try{
   await guard();need(fs.readdirSync(profile.journalDirectory).length===0,'CURRENT_B007_RECOVERY_JOURNAL_ADVANCED');
   if(started){
    // This independently authenticates ALL raw partial roles. It refuses an
    // uncaptured core/orphan or Hub without lineage; no universal recovery PASS.
    const recovered=await invoke(frozen.newRecovery,['-Action','Drain','-PolicyGeneration','CurrentB007',...common,'-EnginePath',frozen.engine.path,'-ClaimSha256',claimRef.sha256,'-EmptyRecoveryPath',frozen.emptyRecovery.path,'-RecoveryHelperPath',frozen.helper.path,'-NewObserverPath',frozen.newObserver.path,'-SourceObserverPath',frozen.observer.path,...(freshOwnerGeneration?['-GenerationClaimPath',claimRef.path]:[]),...(continuationRef?['-ContinuationPath',continuationRef.path,'-ContinuationSha256',continuationRef.sha256]:[])],{timeout:900000});
    need(recovered.status==='B264_NEW_OWNER_EMPTY_CANDIDATE_READY'&&recovered.oldOwnerStarted===false&&recovered.engineRecoveryExecuted===false&&recovered.businessWrites===0&&recovered.requiresFrozenStopNewAndRollbackOld===true,'CURRENT_B007_NEW_DRAIN');pin(recovered.candidateRef);return {...await finishRollback(recovered.candidateRef),failurePhase};
   }
   // No new COM stop, core kill, or invented witness after an ambiguous cut.
   // Only an already genuine completed held cut allows the remaining exact OLD
   // subset to be drained and passed to the reviewed zero-candidate engine.
   need(cutAttempted&&cut&&snapshotRef&&await stopped(),'CURRENT_B007_PRESTART_CUT_UNPROVEN');for(const role of ['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative']){await callbacks.stopExact(role);need(await callbacks.absent(role),'CURRENT_B007_PRESTART_REMAINS');}
   need(await empty(),'CURRENT_B007_PRESTART_NOT_EMPTY');for(const name of names)await changeAction(name,'new');const zero=await captureCandidate();return {...await finishRollback(zero.ref),failurePhase};
   }catch(recoveryError){return {status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',failurePhase,...(heldCoreFailure?{failureDiagnostic:heldCoreFailure}:{}),recoveryReason:heldCoreReason(recoveryError),transitionDirectory:transitionDir,successorClaimRef:claimRef,candidateRef,applyExecuted:cutAttempted||started,humanAcceptance:'BEKLİYOR',unprovenPartialRecoveryGranted:false};}
 }
}
