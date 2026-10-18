// Root-only Windows IO for the finite be8 -> e59/13b shared TEST handoff.
// Importing this file performs no IO. DryRun is the default. No LIVE/Vega SQL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {runP03OwnerTransition,runP03CoreFirstOwnerTransition,p03TransitionDigest,p03CoreFirstStopDigest} from './p03-integrated-owner-transition.mjs';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
import {admitPr54OwnerSuccessor,claimPr54OwnerSuccessor,pr54OwnerSuccessorRefs,PR54_PREDECESSOR_REFS,PR54_PREDECESSOR_TRANSITION,PR54_PREDECESSOR_JOURNAL,PR54_SUCCESSOR_CLAIM_PATH,PR54_REHEARSED_ENGINE_SHA} from './p03-pr54-owner-successor.mjs';
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
export function pr54SafeFailure(error){const text=String(error?.message??'')+' '+String(error?.stderr??'');const fixed=text.match(/\bP03_[A-Z_]+\b/);if(fixed)return fixed[0];return ['ENOENT','EACCES','ENAMETOOLONG','ETIMEDOUT','EPIPE'].includes(error?.code)?error.code:'UNCLASSIFIED_IO_FAILURE';}
// A probe can exit between the frozen observer's CIM list and owner read. A
// retry obtains a whole new observation; no partial frame is reused or admitted.
export async function pr54CollectPhysicalObservation(collect){
 for(let attempt=0;attempt<3;attempt++){
  try{return await collect();}catch(error){if(pr54SafeFailure(error)!=='P03_PROCESS_IDENTITY_UNAVAILABLE'||attempt===2)throw error;}
 }
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
export function assertPr54WriteScope(file,transitionDir,globalOwnerLock,successorClaimPath=null){need(file===globalOwnerLock||file.startsWith(transitionDir+'\\')||/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-candidate-[a-f0-9]{32}\.json$/.test(file)||successorClaimPath===PR54_SUCCESSOR_CLAIM_PATH&&file===successorClaimPath,'WRITE_SCOPE');need(path.win32.normalize(file)===file&&!file.includes('/'),'WRITE_SCOPE');}
export function pr54ProtectedWriteProgram(file,sha256){need(/^[a-f0-9]{64}$/.test(sha256),'WRITE_HASH');return `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Security')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,$name+'.psd1')) -ErrorAction Stop};$p=${quote(file)};${psNoReparse}$raw=[Console]::In.ReadToEnd();if($raw.Length-gt22369624){throw 'PAYLOAD_LIMIT'};$b=[Convert]::FromBase64String($raw);$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant();if($actual-cne'${sha256}'){throw 'PAYLOAD_HASH'};if(Test-Path -LiteralPath $p){throw 'EXISTS'};$s=[Security.AccessControl.FileSecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new('${owner}'));$s.SetAccessRuleProtection($true,$false);foreach($id in @('${owner}','S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow'))};$f=[IO.FileStream]::new($p,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$s);try{$f.Write($b,0,$b.Length);$f.Flush($true)}finally{$f.Dispose()};'CREATED'`;}
async function psPayload(code,bytes){need(bytes.length<=16*1024*1024,'PAYLOAD_LIMIT');const encoded=Buffer.from(code,'utf16le').toString('base64');need(encoded.length<16000,'WRITER_COMMAND_LIMIT');return new Promise((resolve,reject)=>{const child=spawn(shell,['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{...opts,stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',d=>{output+=d;if(output.length>65536)child.kill();});child.stderr.on('data',d=>{errors+=d;if(errors.length>65536)child.kill();});child.on('error',()=>reject(Error('P03_SHARED_WRITER_EXECUTION')));child.stdin.on('error',()=>{});child.on('close',status=>{if(status!==0||errors||output.trim()!=='CREATED')reject(Error('P03_SHARED_WRITER_REJECTED'));else resolve();});child.stdin.end(bytes.toString('base64'));});}
async function ps(code){const result=await run(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;"+code,'utf16le').toString('base64')],opts);need(!result.stderr,'POWERSHELL_STDERR');return result.stdout.trim();}
export function assertPr54SharedProfile(profile,before){
 need(profile?.schemaVersion==='melisa-p03-physical-profile.v1'&&before?.schemaVersion==='melisa-p03-owner-observation.v3','SCHEMA');
 need(profile.environment===undefined&&before.environment===undefined&&profile.ownerSid===owner&&before.ownerSid===owner,'OWNER');
 need(profile.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&before.database===profile.database&&before.actualT1===false,'DATABASE');
 need(profile.oldSettings?.sha256===oldSha&&profile.newSettings?.sha256===newSha&&profile.newSettings.path==='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json','SETTINGS');
 const expected={erpSource:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',erpManifest:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7',crmSource:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',crmManifest:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83',supervisorSource:'13bdf75a032ae8f694354a2e57b6ed382aec2f17',supervisorManifest:'195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'};
 need(Object.keys(expected).every(k=>before.profile?.[k]===expected[k]),'EXACT_CANDIDATE');
 need(profile.tasks?.length===2&&names.every(n=>profile.tasks.some(t=>t.name===n&&hash(Buffer.from(t.oldXml))===t.oldXmlSha256&&hash(Buffer.from(t.newXml))===t.newXmlSha256)),'TASKS');
 need(targets.every(role=>before.identities?.[role]?.ownerSid===owner)&&profile.oldWatchers?.length===2,'CAPTURED_IDENTITIES');
 need(profile.protectedProcesses?.length>0&&targets.every(role=>!profile.protectedProcesses.some(p=>p.pid===before.identities[role].pid)),'PROTECTED_NEVER_STOP');
 const beforeMatch=/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-([a-f0-9]{32})\.json$/.exec(profile.beforeImage?.path??'');need(beforeMatch&&before.runId===beforeMatch[1],'STOPPER_BEFORE_GUID');
 need(profile.stopper?.sha256==='79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'&&profile.stopper.path==='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-stopper-'+beforeMatch[1]+'.ps1','STOPPER');
 need(profile.journalDirectory==='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-'+beforeMatch[1],'RECOVERY_DIRECTORY');
 need(before.plan?.digest===p03TransitionDigest(before.plan)&&before.plan.newSettingsSha256===newSha,'PLAN');return true;
}
export function comparePr54InvarianceSnapshots(pre,post){
 need(pre?.database==='MELISA_ERP_P03_PR54_PRE_20261018'&&post?.database==='MELISA_ERP_P03_PR54_POST_20261018'&&pre.tables?.length===51&&post.tables?.length===51,'INVARIANCE_SCOPE');
 for(const snapshot of [pre,post])need(new Set(snapshot.tables.map(t=>t.table)).size===51&&snapshot.tables.every(t=>typeof t.table==='string'&&t.table.length>0&&Number.isSafeInteger(t.count)&&t.count>=0&&/^[a-f0-9]{64}$/i.test(t.sha256)),'INVARIANCE_TABLES');
 const fields=['tables','modules','permissions','memberships','principals'];need(fields.every(k=>Array.isArray(pre[k])&&Array.isArray(post[k])),'INVARIANCE_FIELDS');
 need(fields.every(k=>JSON.stringify(pre[k])===JSON.stringify(post[k])),'INVARIANCE_MISMATCH');
 return {equal:true,criticalTables:51,coverage:'51 business tables, readable modules, explicit permissions, memberships and principals; not all database contents'};
}
export function pr54SuccessorEmptyProgram({ids,consoles}){
 need(Array.isArray(ids)&&ids.length<=256&&ids.every(x=>Number.isSafeInteger(x)&&x>0)&&Array.isArray(consoles)&&consoles.length<=128,'SUCCESSOR_EMPTY_SCOPE');
 const data=Buffer.from(JSON.stringify({ids:[...new Set(ids)],consoles})).toString('base64');
 return `$pins=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;$until=[DateTime]::UtcNow.AddSeconds(15);do{$all=@(Get-CimInstance Win32_Process -ErrorAction Stop);$remaining=@($all|Where-Object{$_.ProcessId-in$pins.ids-or$_.ParentProcessId-in$pins.ids});if($remaining.Count-eq0){'EMPTY';return};foreach($p in $remaining){$saved=@($pins.consoles|Where-Object{$_.pid-eq$p.ProcessId});if($saved.Count-ne1){throw 'P03_SUCCESSOR_UNKNOWN_REMAINING'};$e=$saved[0];$sid=Invoke-CimMethod $p -MethodName GetOwnerSid -ErrorAction Stop;if($sid.ReturnValue-ne0-or$sid.Sid-cne$e.ownerSid-or$p.ParentProcessId-ne$e.parentPid-or$p.ExecutablePath-ine$e.nodePath-or$p.CommandLine-cne$e.commandLine-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTime]::Parse($e.creationTime).ToUniversalTime().Ticks){throw 'P03_SUCCESSOR_CONSOLE_REUSED'};if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object OwningProcess -eq $p.ProcessId).Count-ne0){throw 'P03_SUCCESSOR_CONSOLE_LISTENER'}};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow-lt$until);'REMAINS'`;
}
export async function runPr54SharedOwnerTransition({mode='DryRun',profileRef,beforeRef,engineRef,observerRef,invarianceScriptRef,preSnapshotRef,preProofRef,rehearsalProofRef,predecessorRef=null,successorDrainerRef=null,recoveryHelperRef=null,newOwnerObserverRef=null}){
 need(['DryRun','Apply'].includes(mode)&&process.platform==='win32','MODE_PLATFORM');
 const profile=read(profileRef),before=read(beforeRef);assertPr54SharedProfile(profile,before);need(JSON.stringify(profile.beforeImage)===JSON.stringify(beforeRef),'BEFORE_BINDING');
 need(/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-profile-[a-f0-9]{32}\.json$/.test(profileRef.path)&&/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-[a-f0-9]{32}\.json$/.test(beforeRef.path),'PROFILE_PATH');
 for(const [ref,leaf] of [[engineRef,'p03-physical-rollback.ps1'],[observerRef,'p03-physical-recovery-observe.ps1'],[invarianceScriptRef,'p03-pr54-invariance-capture.ps1']]){need(path.win32.basename(ref.path)===leaf,'HELPER_PATH');pin(ref);}
 if(predecessorRef!==null)for(const [ref,leaf] of [[successorDrainerRef,'p03-pr54-successor-core-drain.ps1'],[recoveryHelperRef,'p03-pr54-paused-old-recover.ps1'],[newOwnerObserverRef,'p03-pr54-new-owner-observe.ps1']]){need(ref&&path.win32.basename(ref.path)===leaf,'SUCCESSOR_DRAIN_HELPER');pin(ref);}
 const pre=read(preSnapshotRef),preProof=read(preProofRef),rehearsal=read(rehearsalProofRef);
 need(preSnapshotRef.path==='C:\\Sirket\\ERP\\backups\\P03-20261018-140001\\invariance-readonly\\restored-snapshot.json'&&preProofRef.path==='C:\\Sirket\\ERP\\backups\\P03-20261018-140001\\invariance-readonly\\invariance-capture-verified.json','PRE_PATH');
 need(preProof.phase==='Pre'&&preProof.readOnly===true&&preProof.dbccCheckdbPassed===true&&preProof.criticalTablesHashed===51,'PRE_PROOF');
 need(rehearsal.status==='REHEARSAL_ROLLBACK_READY'&&rehearsal.environment==='P03_REHEARSAL'&&rehearsal.sharedTestMutation===false&&rehearsal.protectedBeforeSha256===rehearsal.protectedAfterSha256,'ACTUAL_REHEARSAL_REQUIRED');
 need(rehearsal.engineSha256===engineRef.sha256&&rehearsal.engine?.sha256===engineRef.sha256,'SAME_REHEARSED_ENGINE_REQUIRED');
 const sharedArgs=['-Environment','Shared','-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256];
 async function engine(action,extra=[]){pin(engineRef);pin(profileRef);pin(beforeRef);const r=await run(shell,['-NoProfile','-NonInteractive','-File',engineRef.path,...sharedArgs,'-Mode',action,...extra],{...opts,timeout:900000});need(!r.stderr,'ENGINE_STDERR');return JSON.parse(r.stdout);}
 async function observeRef(ref){pin(ref);const r=await run(shell,['-NoProfile','-NonInteractive','-File',ref.path,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256],opts);need(!r.stderr,'OBSERVER_STDERR');return JSON.parse(r.stdout);}
 async function inspectOldOwnerPhysical(){
  pin(successorDrainerRef);pin(recoveryHelperRef);pin(engineRef);
  const r=await run(shell,['-NoProfile','-NonInteractive','-File',successorDrainerRef.path,'-Mode','Inspect',...sharedArgs.slice(2),'-EnginePath',engineRef.path,'-EngineSha256',engineRef.sha256,'-RecoveryHelperPath',recoveryHelperRef.path,'-RecoveryHelperSha256',recoveryHelperRef.sha256],{...opts,timeout:180000});need(!r.stderr,'SUCCESSOR_INSPECT_STDERR');const frame=JSON.parse(r.stdout);
  need(frame.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&frame.profileSha256===profileRef.sha256&&frame.beforeSha256===beforeRef.sha256&&frame.engineSha256===engineRef.sha256&&frame.recoveryHelperSha256===recoveryHelperRef.sha256&&Date.now()-Date.parse(frame.observedAt)>=0&&Date.now()-Date.parse(frame.observedAt)<60000&&frame.oldIdentities?.length===8&&frame.oldWatchers?.length===2,'SUCCESSOR_INSPECT_FRAME');
  need(Object.values(before.identities).every(p=>frame.oldIdentities.some(q=>sameIdentity(p,q)))&&profile.oldWatchers.every(p=>frame.oldWatchers.some(q=>sameIdentity(p,q))),'SUCCESSOR_INSPECT_IDENTITY');return frame;
 }
 async function inspectSuccessor(observed){
  need(predecessorRef!==null&&engineRef.sha256===PR54_REHEARSED_ENGINE_SHA,'SUCCESSOR_ENGINE');
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
 if(predecessorRef!==null){need(!fs.existsSync(PR54_SUCCESSOR_CLAIM_PATH),'SUCCESSOR_ALREADY_CONSUMED');await inspectSuccessor();}
 if(mode==='DryRun')return {status:'DRY_RUN_ONLY',applyExecuted:false,exactCandidate:before.profile,newSettingsSha256:newSha,...(predecessorRef?{successorClaimPath:PR54_SUCCESSOR_CLAIM_PATH}:{})};
 const runId=path.win32.basename(profileRef.path).match(/([a-f0-9]{32})\.json$/)[1];
 const globalOwnerLock='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\p03-pr54-shared-owner.lock.json';
 if(predecessorRef===null)need(!fs.existsSync(globalOwnerLock),'OTHER_OWNER_OR_PRIOR_RUN');
 else need(!fs.existsSync(PR54_SUCCESSOR_CLAIM_PATH),'SUCCESSOR_ALREADY_CONSUMED');
 const transitionDir=path.win32.join('C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018','MelisaERP-P03-transition-'+runId);
 need(!fs.existsSync(transitionDir)&&fs.readdirSync(profile.journalDirectory).length===0,'PRIOR_JOURNAL');
 noReparseAncestors(transitionDir);await ps(`$p=${quote(transitionDir)};${psNoReparse}if(Test-Path -LiteralPath $p){throw 'EXISTS'};$s=[Security.AccessControl.DirectorySecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new('${owner}'));$s.SetAccessRuleProtection($true,$false);foreach($id in @('${owner}','S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($p,$s);'CREATED'`);
 const backupRef={path:path.win32.join(path.win32.dirname(invarianceScriptRef.path),'p03-test-backup.ps1'),sha256:'5700edc949f377aff61c426492606e696a2af06bdd1824e7d7516b9b837fdfcb'};pin(backupRef);
 const frozen={};for(const [name,ref] of [['engine',engineRef],['observer',observerRef],['invariance',invarianceScriptRef],['backup',backupRef]]){const file=path.win32.join(transitionDir,path.win32.basename(ref.path));frozen[name]=await protectedWrite(file,pin(ref));}
 if(predecessorRef!==null)for(const [name,ref]of [['drainer',successorDrainerRef],['pausedHelper',recoveryHelperRef],['newObserver',newOwnerObserverRef]])frozen[name]=await protectedWrite(path.win32.join(transitionDir,path.win32.basename(ref.path)),pin(ref));
 async function protectedWrite(file,bytes){need(predecessorRef===null||file!==globalOwnerLock,'PREDECESSOR_IMMUTABLE');assertPr54WriteScope(file,transitionDir,globalOwnerLock,predecessorRef?PR54_SUCCESSOR_CLAIM_PATH:null);noReparseAncestors(file);const sha256=hash(bytes);await psPayload(pr54ProtectedWriteProgram(file,sha256),bytes);const ref={path:file,sha256};pin(ref);return ref;}
 async function physical(){return pr54CollectPhysicalObservation(async()=>{pin(frozen.observer);const r=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.observer.path,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256],opts);need(!r.stderr,'OBSERVER_STDERR');return JSON.parse(r.stdout);});}
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
 async function currentOld(){await guardProtected();const seen=await physical();need(Date.now()-Date.parse(seen.observedAt)<60000,'STALE');need(names.every(n=>{const t=seen.tasks.find(x=>x.name===n),p=profile.tasks.find(x=>x.name===n);return t?.state===4&&hash(Buffer.from(t.xml))===p.oldXmlSha256;}),'OLD_TASK_DRIFT');for(const role of targets)need(exact(seen.processes.find(p=>p.pid===before.identities[role].pid),before.identities[role]),'OLD_PROCESS_DRIFT');const bindings=targets.flatMap(role=>(before.identities[role].bindings??[]).map(b=>({...b,pid:before.identities[role].pid}))),normalized=rows=>JSON.stringify(rows.map(b=>[b.port,b.address,b.pid]).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1])||a[2]-b[2]));need(normalized(seen.bindings)===normalized(bindings),'OLD_PORT_OWNER_DRIFT');return seen;}
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
 async function successorWorker(action,extra=[]){
  pin(frozen.drainer);pin(frozen.pausedHelper);pin(frozen.engine);pin(successorClaimRef);
  const args=['-Mode',action,...sharedArgs.filter((_,i)=>i>1),'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.pausedHelper.path,'-RecoveryHelperSha256',frozen.pausedHelper.sha256,'-ClaimPath',successorClaimRef.path,'-ClaimSha256',successorClaimRef.sha256,...extra];
  const result=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.drainer.path,...args],{...opts,timeout:180000});need(!result.stderr,'SUCCESSOR_DRAIN_STDERR');return JSON.parse(result.stdout);
 }
 async function observeNewOwner(ref,leaf){
  if(predecessorRef===null)return useFrozenEngine('PreflightNew',['-CandidatePath',ref.path,'-CandidateSha256',ref.sha256]);
  pin(frozen.newObserver);pin(frozen.engine);pin(frozen.pausedHelper);pin(ref);
  const result=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.newObserver.path,'-Mode','Observe',...sharedArgs.slice(2),'-CandidatePath',ref.path,'-CandidateSha256',ref.sha256,'-EnginePath',frozen.engine.path,'-EngineSha256',frozen.engine.sha256,'-RecoveryHelperPath',frozen.pausedHelper.path,'-RecoveryHelperSha256',frozen.pausedHelper.sha256],{...opts,timeout:900000});
  need(!result.stderr,'NEW_OBSERVER_STDERR');const proof=JSON.parse(result.stdout);
  need(proof.status==='NEW_OWNER_OBSERVED_READY'&&proof.profileSha256===profileRef.sha256&&proof.beforeSha256===beforeRef.sha256&&proof.candidateSha256===ref.sha256&&proof.engineSha256===frozen.engine.sha256&&proof.stableSeconds>=30&&proof.mutationExecuted===false&&proof.sourceProof?.supervisorSourceCommit===before.profile.supervisorSource&&proof.sourceProof?.supervisorManifestSha256===before.profile.supervisorManifest,'NEW_OBSERVER_PROOF');
  await protectedWrite(path.win32.join(transitionDir,leaf),jsonBytes(proof));return proof;
 }
 const callbacks={plan:before.plan,
  admit:async()=>{admittedOld=await currentOld();if(predecessorRef===null)need((await useFrozenEngine('PreflightOld')).status==='OLD_PHYSICAL_PREFLIGHT','ADMISSION');
   if(predecessorRef===null)await protectedWrite(globalOwnerLock,jsonBytes({profileRef,beforeRef,preSnapshotRef,preProofRef,rehearsalProofRef,transitionDirectory:transitionDir}));
   else successorClaimRef=await claimPr54OwnerSuccessor({inspect:async()=>inspectSuccessor(await currentOld()),createNew:async({ref,bytes})=>({created:true,ref:await protectedWrite(ref.path,bytes)}),readClaim:ref=>pin(ref)});
   await protectedWrite(path.win32.join(transitionDir,'transition.lock'),jsonBytes({profileRef,beforeRef,preSnapshotRef,preProofRef,rehearsalProofRef,...(successorClaimRef?{successorClaimRef}:{})}));return {owner:true,oldHealthy:true,oldActions:true,emptyJournal:true};},persist,
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
  readback:async()=>{const deadline=Date.now()+600000;let capture=null;while(Date.now()<deadline){const seen=await physical();if((predecessorRef===null?selectPr54CandidateProcesses:proposePr54CandidateProcesses)(seen,profile).length===10&&new Set(seen.bindings.map(b=>b.port)).size===8&&seen.bindings.every(b=>ports.includes(b.port))&&seen.runningInstances.length===2){capture=await captureCandidate();candidateRef=capture.ref;break;}await new Promise(r=>setTimeout(r,1000));}need(capture!==null,'NEW_READBACK_TIMEOUT');const ready=await observeNewOwner(capture.ref,'new-owner-readback-initial.json');need(ready.status===(predecessorRef===null?'NEW_PHYSICAL_PREFLIGHT':'NEW_OWNER_OBSERVED_READY')&&ready.stableSeconds>=30&&ready.mutationExecuted===false,'NEW_READBACK');pin(frozen.invariance);const post=await run(shell,['-NoProfile','-NonInteractive','-File',frozen.invariance.path,'-Mode','Capture','-Phase','Post'],{...opts,timeout:3600000});need(!post.stderr,'POST_CAPTURE_STDERR');const proof=JSON.parse(post.stdout);need(proof.phase==='Post'&&proof.criticalTablesHashed===51&&proof.dbccCheckdbPassed===true,'POST_PROOF');const postSnapshotPath='C:\\Sirket\\ERP\\backups\\P03-20261018-140002\\invariance-readonly\\restored-snapshot.json',postBytes=fs.readFileSync(postSnapshotPath);const equal=comparePr54InvarianceSnapshots(pre,JSON.parse(postBytes));await protectedWrite(path.win32.join(transitionDir,'invariance-comparison.json'),jsonBytes({...equal,preSnapshotRef,postSnapshotRef:{path:postSnapshotPath,sha256:hash(postBytes)}}));const final=await captureCandidate();candidateRef=final.ref;const finalProof=await observeNewOwner(final.ref,'new-owner-readback-final.json');need(finalProof.status===(predecessorRef===null?'NEW_PHYSICAL_PREFLIGHT':'NEW_OWNER_OBSERVED_READY')&&finalProof.stableSeconds>=30&&finalProof.mutationExecuted===false,'FINAL_READBACK');return true;},
  restoreOldActions:async()=>{await guardProtected();need(await empty(),'RESTORE_EMPTY');for(const name of names)await changeAction(name,'old');return true;},
 };
 for(const callbackName of ['admit','stopTasks','tasksStopped']){const actual=callbacks[callbackName];callbacks[callbackName]=async(...args)=>{const started=Date.now();try{const result=await actual(...args);if(callbackName!=='admit'&&result!==true)lastCallbackFailure??={callback:callbackName,reason:'CALLBACK_RETURNED_FALSE',elapsedMs:Date.now()-started};return result;}catch(error){lastCallbackFailure??={callback:callbackName,reason:pr54SafeFailure(error),elapsedMs:Date.now()-started};throw error;}};}
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
 catch(error){if(lastCallbackFailure){try{await protectedWrite(path.win32.join(transitionDir,'io-failure-diagnostic.json'),jsonBytes({...lastCallbackFailure,phase:error.phase??'UNKNOWN',profileSha256:profileRef.sha256,beforeSha256:beforeRef.sha256}));}catch{}}if(error.startAttempted||startAttempted){try{const candidate=await captureCandidate();candidateRef=candidate.ref;const recovered=await useFrozenEngine('StopNew',['-CandidatePath',candidate.ref.path,'-CandidateSha256',candidate.ref.sha256]);need(recovered.status==='RECOVERED_OLD_ACTIONS','STOP_NEW_RECOVERY');const restored=await useFrozenEngine('RollbackOld',['-RecoveryTailSha256',recovered.journalTailSha256]);need(restored.status==='RESTORED_READY','ROLLBACK_OLD');return {status:'FAILED_ROLLED_BACK_OLD_READY',failurePhase:error.phase??'READBACK',transitionDirectory:transitionDir};}catch{return {status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',transitionDirectory:transitionDir,candidateRef};}}if(taskStopAttempted&&!startAttempted){try{return await recoverBeforeStart();}catch(recoveryError){return {failureDiagnostic:lastCallbackFailure,recoveryReason:pr54SafeFailure(recoveryError),status:'QUARANTINED_REQUIRES_ROOT_INSPECTION',transitionDirectory:transitionDir,candidateRef,recoveryPath:'PRESTART_RECOVERY_REFUSED'};}}return {status:'STOPPED_BEFORE_START',transitionDirectory:transitionDir,failurePhase:error.phase??'ADMISSION'};}
}
