import {PR54_CURRENT_B007_PRECUTB142_REFS,PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH,preparePr54CurrentB007PrecutB142Continuation} from './p03-pr54-current-b007-precut-continuation.mjs';
import {PR54_CURRENT_B007_PRECUT974D_REFS,PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH,preparePr54CurrentB007Precut974dContinuation} from './p03-pr54-current-b007-precut-continuation.mjs';
import {PR54_CURRENT_B007_PRECUT_RETRY_REFS,preparePr54CurrentB007PrecutRetry} from './p03-pr54-current-b007-precut-continuation.mjs';
// Finite B264 physical inspection only. Importing this module does no IO.
// No public transport hook, token mint, claim, Drain or Apply dispatcher.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inspectPr54B264PredecessorIO,validatePr54B264PhysicalInspection,validatePr54B264Sup20dPhysicalInspection,collectPr54CurrentInspectionPair,pr54CollectPhysicalObservation} from './p03-pr54-shared-owner-io.mjs';
import {PR54_OWNER_ROOT,PR54_B264_REFS,PR54_B264_SUCCESSOR_CLAIM_PATH,assertPr54B264SuccessorCandidate,assertPr54B264Sup20dCandidate} from './p03-pr54-owner-successor.mjs';
import {validatePr54CurrentB007PhysicalInspection} from './p03-pr54-shared-owner-io.mjs';
import {PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH,PR54_CURRENT_B007_ENGINE_SHA256,assertPr54CurrentB007Candidate} from './p03-pr54-owner-successor.mjs';
import {PR54_CURRENT_B007_PRECUT_REFS,PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH,preparePr54CurrentB007PrecutContinuation} from './p03-pr54-current-b007-precut-continuation.mjs';
import {PR54_CURRENT_B007_PRECUT_RESUME_REFS,preparePr54CurrentB007PrecutResume} from './p03-pr54-current-b007-precut-continuation.mjs';
const run=promisify(execFile),shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const hash=x=>createHash('sha256').update(x).digest('hex');
const bytes=x=>Buffer.from(JSON.stringify(x));
const need=(v,c)=>{if(!v)throw Error('P03_B264_PHYSICAL_'+c);};
const pins=Object.freeze({
 drainer:Object.freeze({leaf:'p03-pr54-successor-core-drain.ps1',sha256:'34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c'}),
 observer:Object.freeze({leaf:'p03-physical-recovery-observe.ps1',sha256:'5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5'}),
 helper:Object.freeze({leaf:'p03-pr54-paused-old-recover.ps1',sha256:'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'}),
});
// Fixed source of the prepared Sup20d generation; legacy pins above are unchanged.
const sup20dPins=Object.freeze({
 drainer:Object.freeze({leaf:'p03-pr54-successor-core-drain.ps1',sha256:'eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5'}),
 observer:Object.freeze({leaf:'p03-physical-recovery-observe.ps1',sha256:'5e1f89bd24ba7b1a2c8738cab3f2f29d4ec44ade96b62127d9f1367efd6143f9'}),
 helper:Object.freeze({leaf:'p03-pr54-paused-old-recover.ps1',sha256:'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'}),
});
const inspections=new WeakMap();
export function lookupPr54B264PhysicalInspection(token,{current,profile,before,profileRef,beforeRef,now=Date.now()}){
 const p=inspections.get(token);
 return p&&p.policy==='B264InspectOnly'&&p.current===current&&p.profile===profile&&p.before===before&&JSON.stringify(p.profileRef)===JSON.stringify(profileRef)&&JSON.stringify(p.beforeRef)===JSON.stringify(beforeRef)&&p.digest===hash(bytes({current,profile,before}))&&Number.isFinite(now)&&now-Date.parse(p.observedAt)>=0&&now-Date.parse(p.observedAt)<60000?p.aux:null;
}
export function lookupPr54B264Sup20dPhysicalInspection(token,{current,profile,before,profileRef,beforeRef,now=Date.now()}){
 const p=inspections.get(token);
 return p&&p.policy==='B264Sup20DInspectOnly'&&p.current===current&&p.profile===profile&&p.before===before&&JSON.stringify(p.profileRef)===JSON.stringify(profileRef)&&JSON.stringify(p.beforeRef)===JSON.stringify(beforeRef)&&p.digest===hash(bytes({current,profile,before}))&&Number.isFinite(now)&&now-Date.parse(p.observedAt)>=0&&now-Date.parse(p.observedAt)<60000?p.aux:null;
}
const exact=(o,keys)=>o&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).sort().join('|')===keys.toSorted().join('|');
function ref(r){return exact(r,['path','sha256'])&&typeof r.path==='string'&&r.path.startsWith(PR54_OWNER_ROOT+'\\')&&path.win32.normalize(r.path)===r.path&&/^[a-f0-9]{64}$/.test(r.sha256);}
function read(r){
 need(ref(r),'REF');
 for(let p=r.path;p&&p!==path.win32.dirname(p);p=path.win32.dirname(p))need(!fs.lstatSync(p).isSymbolicLink(),'REPARSE');
 const stat=fs.lstatSync(r.path);need(stat.isFile()&&stat.nlink===1&&stat.size>0&&stat.size<=16777216,'FILE');
 const b=fs.readFileSync(r.path);need(hash(b)===r.sha256,'HASH');return b;
}
// Argument construction is pure; every executable/helper byte is fixed. Only
// the normal physical observer and the worker's Inspect entry are callable.
export function pr54B264InspectionArguments(input){
 need(exact(input,['profileRef','beforeRef','engineRef','recoveryHelperRef','drainerRef','observerRef']),'INPUT');
 const {profileRef,beforeRef,engineRef,recoveryHelperRef,drainerRef,observerRef}=input;
 for(const r of Object.values(input))need(ref(r),'REF');
 need(engineRef.path===PR54_B264_REFS.engine.path&&engineRef.sha256===PR54_B264_REFS.engine.sha256,'ENGINE');
 for(const [r,k]of [[recoveryHelperRef,'helper'],[drainerRef,'drainer'],[observerRef,'observer']])need(path.win32.basename(r.path)===pins[k].leaf&&r.sha256===pins[k].sha256,'SOURCE');
 const runId=path.win32.basename(beforeRef.path).match(/^MelisaERP-P03-before-([a-f0-9]{32})\.json$/)?.[1];
 need(runId&&!['639e2da815e1e7ac0f1c0d04d7f7bdc3','7b0821959737f1da0427b17a7dfd4685','b264594b6f93d560d807c8decc4e6699'].includes(runId)&&beforeRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-before-'+runId+'.json'&&profileRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-profile-'+runId+'.json','RUN');
 const common=['-PolicyGeneration','B264InspectOnly','-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256,'-EnginePath',engineRef.path,'-EngineSha256',engineRef.sha256,'-RecoveryHelperPath',recoveryHelperRef.path,'-RecoveryHelperSha256',recoveryHelperRef.sha256];
 return {observer:['-NoProfile','-NonInteractive','-File',observerRef.path,'-Environment','Shared','-Purpose','Physical',...common,'-DrainerPath',drainerRef.path,'-DrainerSha256',drainerRef.sha256],worker:['-NoProfile','-NonInteractive','-File',drainerRef.path,'-Mode','Inspect',...common]};
}
export function pr54B264Sup20dInspectionArguments(input){
 need(exact(input,['profileRef','beforeRef','engineRef','recoveryHelperRef','drainerRef','observerRef']),'INPUT');
 const {profileRef,beforeRef,engineRef,recoveryHelperRef,drainerRef,observerRef}=input;
 for(const r of Object.values(input))need(ref(r),'REF');
 need(engineRef.path===PR54_B264_REFS.engine.path&&engineRef.sha256===PR54_B264_REFS.engine.sha256,'ENGINE');
 for(const [r,k]of [[recoveryHelperRef,'helper'],[drainerRef,'drainer'],[observerRef,'observer']])need(path.win32.basename(r.path)===sup20dPins[k].leaf&&r.sha256===sup20dPins[k].sha256,'SOURCE');
 const runId=path.win32.basename(beforeRef.path).match(/^MelisaERP-P03-before-([a-f0-9]{32})\.json$/)?.[1];
 need(runId&&!['639e2da815e1e7ac0f1c0d04d7f7bdc3','7b0821959737f1da0427b17a7dfd4685','b264594b6f93d560d807c8decc4e6699'].includes(runId)&&beforeRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-before-'+runId+'.json'&&profileRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-profile-'+runId+'.json','RUN');
 const common=['-PolicyGeneration','B264Sup20DInspectOnly','-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256,'-EnginePath',engineRef.path,'-EngineSha256',engineRef.sha256,'-RecoveryHelperPath',recoveryHelperRef.path,'-RecoveryHelperSha256',recoveryHelperRef.sha256];
 return {observer:['-NoProfile','-NonInteractive','-File',observerRef.path,'-Environment','Shared','-Purpose','Physical',...common,'-DrainerPath',drainerRef.path,'-DrainerSha256',drainerRef.sha256],worker:['-NoProfile','-NonInteractive','-File',drainerRef.path,'-Mode','Inspect',...common]};
}
// Execute the already hashed UTF-8 buffer, not the subsequently replaceable
// -File path. The child authenticates owner/ACL/path/hash before parsing and
// retains the deny-write handle until the source returns. No shell interpolation.
function pinnedInvocation(ref,argv){
 const payload=Buffer.from(JSON.stringify({ref,args:argv.slice(4)})).toString('base64');
 const program=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$env:PSModulePath=Join-Path $PSHOME 'Modules';foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\\'+$n+'\\'+$n+'.psd1')) -ErrorAction Stop};$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;$owner='S-1-5-21-2170750028-1005938530-2568122015-1001';if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-cne$owner){throw 'B264_SOURCE_OWNER'};for($p=$v.ref.path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B264_SOURCE_REPARSE'}};$i=Get-Item -LiteralPath $v.ref.path -Force;if($i.PSIsContainer-or$i.LinkType){throw 'B264_SOURCE_FILE'};$a=Get-Acl -LiteralPath $v.ref.path;$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$owner-or$rules.Count-ne2){throw 'B264_SOURCE_ACL'};foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'B264_SOURCE_ACL'}};$s=[IO.File]::Open($v.ref.path,'Open','Read','Read');try{if($s.Length-le0-or$s.Length-gt16777216){throw 'B264_SOURCE_SIZE'};$m=[IO.MemoryStream]::new();$s.CopyTo($m);$b=$m.ToArray();$sha=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant();if($sha-cne$v.ref.sha256){throw 'B264_SOURCE_HASH'};$bound=@{};if($v.args.Count%2-ne0){throw 'B264_SOURCE_ARGS'};for($n=0;$n-lt$v.args.Count;$n+=2){$k=[string]$v.args[$n];if($k-cnotmatch'^-[A-Za-z][A-Za-z0-9]*$'-or$bound.ContainsKey($k.Substring(1))){throw 'B264_SOURCE_ARGS'};$bound[$k.Substring(1)]=[string]$v.args[$n+1]};$code=[Text.UTF8Encoding]::new($false,$true).GetString($b);& ([scriptblock]::Create($code)) @bound}finally{$s.Dispose()}`;
 // Error-only source coordinates: never messages, paths, argv, frame data or
 // credentials. Preserve the original rejection and the same held source.
 const identityDiagnostic=`$roIdentity=$null;foreach($roEntry in $roChain){if($roEntry.Data.Contains('melisaP03VanishedProbeIdentity')){try{$roText=[string]$roEntry.Data['melisaP03VanishedProbeIdentity'];if($roText.Length-gt0-and$roText.Length-lt4096){$roCandidate=$roText|ConvertFrom-Json;$roKeys=@('birthAfterCore','birthIsDateTime','birthNotFuture','nameMatch','notCore','notProtected','parentMatch','pidPositive','shellPathMatch');if((@($roCandidate.PSObject.Properties.Name|Sort-Object)-join'|')-ceq'checks|guard|schemaVersion'-and$roCandidate.schemaVersion-ceq'melisa-p03-vanished-probe-identity-rejection.v1'-and$roCandidate.guard-ceq'RAW_IDENTITY'-and(@($roCandidate.checks.PSObject.Properties.Name|Sort-Object)-join'|')-ceq($roKeys-join'|')-and@($roCandidate.checks.PSObject.Properties|Where-Object{$_.Value-isnot[bool]}).Count-eq0){$roIdentity=[ordered]@{schemaVersion='melisa-p03-vanished-probe-identity-rejection.v1';guard='RAW_IDENTITY';checks=$roCandidate.checks};break}}}catch{}}};if($null-ne$roIdentity-and$roTypes.Count-gt0){$roTypes[0]['vanishedProbeIdentity']=$roIdentity}`;
 const failureTrace=`try{& ([scriptblock]::Create($code)) @bound}catch{$roFailure=$_;try{$roFrames=@(([string]$roFailure.ScriptStackTrace).Split([char]10)|ForEach-Object{if($_.Trim() -match '^at ([-A-Za-z0-9_]{1,64}),.*: line ([0-9]{1,5})$'){[ordered]@{fn=$Matches[1];line=[int]$Matches[2]}}}|Select-Object -First 6);[Console]::Out.WriteLine('MELISA_NATIVE_RO_TRACE='+(ConvertTo-Json -InputObject @($roFrames) -Compress))}catch{};try{$roTypes=@();$roChain=@();$roException=$roFailure.Exception;for($roDepth=0;$roDepth-lt3-and$null-ne$roException;$roDepth++){$roChain+=,$roException;$roType=$roException.GetType().FullName;if($roType-cmatch'^(System[.][A-Za-z0-9_.]{1,120}|Microsoft[.]Management[.]Infrastructure[.]CimException)$'){$roTypes+=[ordered]@{type=$roType;hresult=[int]$roException.HResult}};$roException=$roException.InnerException};${identityDiagnostic};[Console]::Out.WriteLine('MELISA_NATIVE_RO_ERROR='+(ConvertTo-Json -InputObject @($roTypes) -Depth 6 -Compress))}catch{};throw $roFailure}`;
 const tracedProgram=program.replace('& ([scriptblock]::Create($code)) @bound',()=>failureTrace);
 const encoded=Buffer.from(tracedProgram,'utf16le').toString('base64');need(encoded.length<30000,'COMMAND_LIMIT');
 return ['-NoProfile','-NonInteractive','-EncodedCommand',encoded];
}
export async function inspectPr54B264PhysicalOwner(input){
 need(process.platform==='win32','PLATFORM');const argv=pr54B264InspectionArguments(input);
 const {profileRef,beforeRef,engineRef,recoveryHelperRef}=input;
 need(!fs.existsSync(PR54_B264_SUCCESSOR_CLAIM_PATH),'CONSUMED');
 await inspectPr54B264PredecessorIO();
 const captured=Object.fromEntries(Object.entries(input).map(([k,r])=>[k,read(r)]));
 const profile=JSON.parse(captured.profileRef),before=JSON.parse(captured.beforeRef);
 // Candidate values are derived from pinned before/settings metadata, never a
 // caller-supplied boolean or a caller-provided current-process frame.
 assertPr54B264SuccessorCandidate({...before.profile,supervisorRoot:profile.packages.find(p=>p.sourceCommit===before.profile.supervisorSource)?.root,newSettings:profile.newSettings});
 const options={windowsHide:true,timeout:60000,maxBuffer:8*1024*1024,env:{...process.env,PSModulePath:String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\Modules`}};
 const observe=await run(shell,pinnedInvocation(input.observerRef,argv.observer),options);need(!observe.stderr,'OBSERVER_STDERR');const current=JSON.parse(observe.stdout);
 need(current.schemaVersion==='melisa-p03-physical-observation.v1'&&current.environment==='Shared'&&current.policyGeneration==='B264InspectOnly'&&current.transitionAuthority===false&&current.collectionAuthority==='PHYSICAL_OBSERVATION_ONLY'&&current.collection==='Schedule.Service.GetRunningTasks(1)'&&current.processScope==='CIM.Win32_Process.Unfiltered'&&current.portScope==='Get-NetTCPConnection.Listen.Unfiltered'&&current.stopPermitted===false&&current.applyAvailable===false&&JSON.stringify(current.beforeImage)===JSON.stringify(beforeRef)&&current.rawScope?.unverifiedCount===0&&current.rawScope?.unverifiedProcesses?.length===0,'OBSERVER_FRAME');
 const inspected=await run(shell,pinnedInvocation(input.drainerRef,argv.worker),options);need(!inspected.stderr,'WORKER_STDERR');const frame=JSON.parse(inspected.stdout);
 const aux=validatePr54B264PhysicalInspection({frame,current,profile,before,profileRef,beforeRef,engineRef,recoveryHelperRef});
 // Native worker authenticated protected SQL via service + birth + typed
 // master SELECT, and normal OS identities via the existing engine guard.
 // SQL service envelopes are not normal owner/argv process rows.
 need(profile.protectedProcesses.every(p=>p.kind==='ProtectedSqlService'||current.processes.some(q=>['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'].every(k=>p[k]===q[k]))),'PROTECTED');
 await inspectPr54B264PredecessorIO();
 for(const [k,r]of Object.entries(input))need(read(r).equals(captured[k]),'PIN_CHANGED');
 need(!fs.existsSync(PR54_B264_SUCCESSOR_CLAIM_PATH),'CONSUMED');
 const token=Object.freeze({}),now=Date.now();need(now-Date.parse(frame.observedAt)>=0&&now-Date.parse(frame.observedAt)<60000,'EXPIRED');
 inspections.set(token,{policy:'B264InspectOnly',current,profile,before,profileRef:Object.freeze({...profileRef}),beforeRef:Object.freeze({...beforeRef}),observedAt:frame.observedAt,aux,digest:hash(bytes({current,profile,before}))});
 return {status:'B264_PHYSICAL_INSPECTED_READ_ONLY',current,profile,before,physicalInspection:token,claimCreated:false,applyExecuted:false,stopAuthority:false,transitionAuthority:false};
}

// Explicit finite generation; no caller transport or policy selector is exposed.
export async function inspectPr54B264Sup20dPhysicalOwner(input){
 need(process.platform==='win32','PLATFORM');const argv=pr54B264Sup20dInspectionArguments(input);
 const {profileRef,beforeRef,engineRef,recoveryHelperRef}=input;
 need(!fs.existsSync(PR54_B264_SUCCESSOR_CLAIM_PATH),'CONSUMED');
 await inspectPr54B264PredecessorIO();
 const captured=Object.fromEntries(Object.entries(input).map(([k,r])=>[k,read(r)]));
 const profile=JSON.parse(captured.profileRef),before=JSON.parse(captured.beforeRef);
 // Candidate values are derived from pinned before/settings metadata, never a
 // caller-supplied boolean or a caller-provided current-process frame.
 assertPr54B264Sup20dCandidate({...before.profile,supervisorRoot:profile.packages.find(p=>p.sourceCommit===before.profile.supervisorSource)?.root,newSettings:profile.newSettings});
 const options={windowsHide:true,timeout:60000,maxBuffer:8*1024*1024,env:{...process.env,PSModulePath:String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\Modules`}};
 const {current,frame,aux}=await collectPr54CurrentInspectionPair(()=>pr54CollectPhysicalObservation(async()=>{
  // Re-observe the entire raw pair; never retry just the failed worker against
  // an older process frame or delete an ephemeral row from an observation.
  need(!fs.existsSync(PR54_B264_SUCCESSOR_CLAIM_PATH),'CONSUMED');
  await inspectPr54B264PredecessorIO();
  for(const [k,r]of Object.entries(input))need(read(r).equals(captured[k]),'PIN_CHANGED');
 const observe=await run(shell,pinnedInvocation(input.observerRef,argv.observer),options);need(!observe.stderr,'OBSERVER_STDERR');const current=JSON.parse(observe.stdout);
 need(current.schemaVersion==='melisa-p03-physical-observation.v1'&&current.environment==='Shared'&&current.policyGeneration==='B264Sup20DInspectOnly'&&current.transitionAuthority===false&&current.collectionAuthority==='PHYSICAL_OBSERVATION_ONLY'&&current.collection==='Schedule.Service.GetRunningTasks(1)'&&current.processScope==='CIM.Win32_Process.Unfiltered'&&current.portScope==='Get-NetTCPConnection.Listen.Unfiltered'&&current.stopPermitted===false&&current.applyAvailable===false&&JSON.stringify(current.beforeImage)===JSON.stringify(beforeRef)&&current.rawScope?.unverifiedCount===0&&current.rawScope?.unverifiedProcesses?.length===0,'OBSERVER_FRAME');
 const inspected=await run(shell,pinnedInvocation(input.drainerRef,argv.worker),options);need(!inspected.stderr,'WORKER_STDERR');const frame=JSON.parse(inspected.stdout);
 const aux=validatePr54B264Sup20dPhysicalInspection({frame,current,profile,before,profileRef,beforeRef,engineRef,recoveryHelperRef});
 // Native worker authenticated protected SQL via service + birth + typed
 // master SELECT, and normal OS identities via the existing engine guard.
 // SQL service envelopes are not normal owner/argv process rows.
 need(profile.protectedProcesses.every(p=>p.kind==='ProtectedSqlService'||current.processes.some(q=>['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'].every(k=>p[k]===q[k]))),'PROTECTED');
 await inspectPr54B264PredecessorIO();
 for(const [k,r]of Object.entries(input))need(read(r).equals(captured[k]),'PIN_CHANGED');
 need(!fs.existsSync(PR54_B264_SUCCESSOR_CLAIM_PATH),'CONSUMED');
  return {current,frame,aux};
 },'SUCCESSOR_INSPECT'));
 const token=Object.freeze({}),now=Date.now();need(now-Date.parse(frame.observedAt)>=0&&now-Date.parse(frame.observedAt)<60000,'EXPIRED');
 inspections.set(token,{policy:'B264Sup20DInspectOnly',current,profile,before,profileRef:Object.freeze({...profileRef}),beforeRef:Object.freeze({...beforeRef}),observedAt:frame.observedAt,aux,digest:hash(bytes({current,profile,before}))});
 return {status:'B264_SUP20D_PHYSICAL_INSPECTED_READ_ONLY',current,profile,before,physicalInspection:token,claimCreated:false,applyExecuted:false,stopAuthority:false,transitionAuthority:false};
}

export function lookupPr54CurrentB007PhysicalInspection(token,{current,profile,before,profileRef,beforeRef,now=Date.now()}){
 const p=inspections.get(token);
 return p&&p.policy==='CurrentB007InspectOnly'&&p.current===current&&p.profile===profile&&p.before===before&&JSON.stringify(p.profileRef)===JSON.stringify(profileRef)&&JSON.stringify(p.beforeRef)===JSON.stringify(beforeRef)&&p.digest===hash(bytes({current,profile,before}))&&Number.isFinite(now)&&now-Date.parse(p.observedAt)>=0&&now-Date.parse(p.observedAt)<60000?p.aux:null;
}

// Explicit CurrentB007 transport. Historical source generations remain sealed.
const currentB007Pins=Object.freeze({
 drainer:Object.freeze({leaf:'p03-pr54-successor-core-drain.ps1',sha256:'cc864ca3d9030929f5bc5d30f93ffbaadac72286e40e346bf5d63c32a5926767'}),
 observer:Object.freeze({leaf:'p03-physical-recovery-observe.ps1',sha256:'8260a0d0fc8c378b68c1c7a6303b085cc265a6045c004f9b81586d5a99e617b1'}),
 helper:Object.freeze({leaf:'p03-pr54-paused-old-recover.ps1',sha256:'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'}),
});
const sameCapturePins=Object.freeze({drainer:'9a0e0931bbd1897f55d25396cd64619a663821eccd6ebf8cb00d1250e5bdab33',observer:'a92f4d712c59970ae50a8ace92dbbeba52d59fadfe542794879d9da898394812'});
// Finite audit handoff pair; the historical same-capture pair remains sealed.
const auditedSameCapturePins=Object.freeze({drainer:'0233887b0bbc9023efe2bc25260266c42b588479879f85213bfe4b79f408f710',observer:'271d9fa16656449727db3ece3000621d1d0a7f2643c2335e409dd0335c9c30c5'});
const diagnosticSameCapturePins=Object.freeze({drainer:'0233887b0bbc9023efe2bc25260266c42b588479879f85213bfe4b79f408f710',observer:'5511027cbb98f29f39008c833ef7db25004cd9cb436acb25c7a744871df1128d'});
// Explicit current pair after the isolated native scope split; prior pairs remain sealed.
const rehearsalSplitSameCapturePins=Object.freeze({drainer:'023b33b9d3683a19473251dfa19cf7d86fd804da3859e669440858e97aa40f14',observer:'06ab2ac9cd440ff24009f53e6b202503419d48e7333213b0e042e499ebb360d8'});
export function pr54CurrentB007InspectionArguments(input){
 need(exact(input,['profileRef','beforeRef','engineRef','recoveryHelperRef','drainerRef','observerRef']),'INPUT');
 const {profileRef,beforeRef,engineRef,recoveryHelperRef,drainerRef,observerRef}=input;
 for(const r of Object.values(input))need(ref(r),'REF');
 need(/^C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-current-b007-control-[a-f0-9]{12}\\p03-physical-rollback-lifetime-v2\.ps1$/.test(engineRef.path)&&engineRef.sha256===PR54_CURRENT_B007_ENGINE_SHA256,'ENGINE');
 const capturePins=[sameCapturePins,auditedSameCapturePins,diagnosticSameCapturePins,rehearsalSplitSameCapturePins].find(p=>drainerRef.sha256===p.drainer&&observerRef.sha256===p.observer),sameCapture=!!capturePins;
 for(const [r,k]of [[recoveryHelperRef,'helper'],[drainerRef,'drainer'],[observerRef,'observer']])need(path.win32.basename(r.path)===currentB007Pins[k].leaf&&r.sha256===(sameCapture&&k!=='helper'?capturePins[k]:currentB007Pins[k].sha256),'SOURCE');
 need(recoveryHelperRef.path===PR54_OWNER_ROOT+'\\'+currentB007Pins.helper.leaf&&[drainerRef,observerRef].every(r=>path.win32.dirname(r.path)===path.win32.dirname(engineRef.path)),'SOURCE_DIRECTORY');
 const runId=path.win32.basename(beforeRef.path).match(/^MelisaERP-P03-before-([a-f0-9]{32})\.json$/)?.[1];
 need(runId&&!['639e2da815e1e7ac0f1c0d04d7f7bdc3','7b0821959737f1da0427b17a7dfd4685','b264594b6f93d560d807c8decc4e6699'].includes(runId)&&beforeRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-before-'+runId+'.json'&&profileRef.path===PR54_OWNER_ROOT+'\\MelisaERP-P03-profile-'+runId+'.json','RUN');
 const common=['-PolicyGeneration','CurrentB007InspectOnly','-ProfilePath',profileRef.path,'-ProfileSha256',profileRef.sha256,'-BeforeImagePath',beforeRef.path,'-BeforeImageSha256',beforeRef.sha256,'-EnginePath',engineRef.path,'-EngineSha256',engineRef.sha256,'-RecoveryHelperPath',recoveryHelperRef.path,'-RecoveryHelperSha256',recoveryHelperRef.sha256];
 return {observer:['-NoProfile','-NonInteractive','-File',observerRef.path,'-Environment','Shared','-Purpose','Physical',...common,'-DrainerPath',drainerRef.path,'-DrainerSha256',drainerRef.sha256,...(sameCapture?['-CaptureMode','CurrentB007']:[])],worker:['-NoProfile','-NonInteractive','-File',drainerRef.path,'-Mode','Inspect',...common]};
}
// Pure shape/pin check only; it cannot mint a physical token or native authority.
export function validatePr54CurrentSameCaptureEnvelope(value,input){
 need(exact(value,['schemaVersion','capture','current','frame'])&&value.schemaVersion==='melisa-p03-current-b007-same-capture.v1','SAME_CAPTURE_SCHEMA');
 const {capture:c,current,frame}=value;
 need(exact(c,['id','attempt','startedAt','inventoryObservedAt','profileSha256','beforeSha256','drainerSha256','processCount','listenerCount','runningInstanceCount'])&&Number.isInteger(c.attempt)&&c.attempt>=1&&c.attempt<=3&&/^[a-f0-9]{32}$/.test(c.id)&&current?.captureId===c.id&&frame?.captureId===c.id,'SAME_CAPTURE_ID');
 need(c.profileSha256===input.profileRef.sha256&&c.beforeSha256===input.beforeRef.sha256&&c.drainerSha256===input.drainerRef.sha256&&[sameCapturePins,auditedSameCapturePins,diagnosticSameCapturePins,rehearsalSplitSameCapturePins].some(p=>input.drainerRef.sha256===p.drainer&&input.observerRef.sha256===p.observer),'SAME_CAPTURE_PINS');
 const times=[c.startedAt,c.inventoryObservedAt,current.observedAt,frame.observedAt].map(Date.parse);need(times.every(Number.isFinite)&&times.every((t,i)=>i===0||t>=times[i-1])&&Date.now()-times[0]>=0&&Date.now()-times[0]<60000,'SAME_CAPTURE_TIME');
 need(c.startedAt===current.startedAt&&[c.processCount,c.listenerCount,c.runningInstanceCount].every(n=>Number.isSafeInteger(n)&&n>=0)&&c.processCount>=current.processes.length&&c.listenerCount>=current.bindings.length&&c.runningInstanceCount===current.runningInstances.length,'SAME_CAPTURE_COUNTS');
 const {captureId:nativeId,...native}=frame;return {current,frame:native};
}
export async function inspectPr54CurrentB007PhysicalOwner(input,{freshOwnerGeneration=false,precutB142Continuation=false,precut974dContinuation=false,precutContinuation=false,precutResume=false,precutResumeAfter9d2=false}={}){
 need(process.platform==='win32','PLATFORM');const argv=pr54CurrentB007InspectionArguments(input);
 need([precutB142Continuation,precut974dContinuation,precutContinuation,precutResume,precutResumeAfter9d2].every(v=>typeof v==='boolean')&&[precutB142Continuation,precut974dContinuation,precutContinuation,precutResume,precutResumeAfter9d2].filter(Boolean).length<=1,'CONTINUATION_MODE');
 need(typeof freshOwnerGeneration==='boolean'&&(!freshOwnerGeneration||![precutB142Continuation,precut974dContinuation,precutContinuation,precutResume,precutResumeAfter9d2].some(Boolean)),'FRESH_GENERATION_MODE');
 const {profileRef,beforeRef,engineRef,recoveryHelperRef}=input;
 const captured=Object.fromEntries(Object.entries(input).map(([k,r])=>[k,read(r)]));
 const profile=JSON.parse(captured.profileRef),before=JSON.parse(captured.beforeRef);
 const claimSlot=()=>{
  // RO inspection does not mint a slot. The owner derives it from two complete
  // native admissions and enforces exclusive creation before any task mutation.
  if(freshOwnerGeneration)return;
  if(precutB142Continuation){
   need(argv.observer.includes('-CaptureMode')&&argv.observer.includes('CurrentB007'),'B142_SAME_CAPTURE_REQUIRED');
   const collect=refs=>Object.fromEntries(Object.entries(refs).map(([key,ref])=>[key,{ref,bytes:read(ref)}]));
   const raw={original:collect(PR54_CURRENT_B007_PRECUT974D_REFS),failed:collect(PR54_CURRENT_B007_PRECUTB142_REFS)};
   preparePr54CurrentB007PrecutB142Continuation({raw,profileRef,beforeRef,profile,before});
   need(!fs.existsSync(PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH),'CONSUMED');return;
  }
  if(precut974dContinuation){const raw=Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT974D_REFS).map(([key,ref])=>[key,{ref,bytes:read(ref)}]));preparePr54CurrentB007Precut974dContinuation({raw,profileRef,beforeRef,profile,before});need(!fs.existsSync(PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH),'CONSUMED');return;}
  if(precutResume||precutResumeAfter9d2){
   const original=Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT_REFS).map(([key,ref])=>[key,{ref,bytes:read(ref)}])),resume=Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT_RESUME_REFS).map(([key,ref])=>[key,{ref,bytes:read(ref)}]));
   const retry=precutResumeAfter9d2?Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT_RETRY_REFS).map(([key,ref])=>[key,{ref,bytes:read(ref)}])):null;
   (precutResumeAfter9d2?preparePr54CurrentB007PrecutRetry:preparePr54CurrentB007PrecutResume)({raw:{original,resume,...(retry?{retry}:{})},profileRef,beforeRef,profile,before});
   need(!fs.existsSync(path.win32.join(path.win32.dirname((precutResumeAfter9d2?PR54_CURRENT_B007_PRECUT_RETRY_REFS:PR54_CURRENT_B007_PRECUT_RESUME_REFS).failureTail.path),'resume-attempt.json')),'RESUME_ALREADY_CONSUMED');return;
  }
  if(precutContinuation){
   const raw=Object.fromEntries(Object.entries(PR54_CURRENT_B007_PRECUT_REFS).map(([key,ref])=>[key,{ref,bytes:read(ref)}]));
   preparePr54CurrentB007PrecutContinuation({raw,profileRef,beforeRef,profile,before});
  }
  need(!fs.existsSync(precutContinuation?PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH:PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH),'CONSUMED');
 };
 claimSlot();await inspectPr54B264PredecessorIO();
 // Candidate values are derived from pinned before/settings metadata, never a
 // caller-supplied boolean or a caller-provided current-process frame.
 assertPr54CurrentB007Candidate({...before.profile,supervisorRoot:profile.packages.find(p=>p.sourceCommit===before.profile.supervisorSource)?.root,newSettings:profile.newSettings});
 // Three existing whole native captures share only the readonly transport
 // budget. Each accepted capture and every claim/Drain window stays <60s.
 const options={windowsHide:true,timeout:precutB142Continuation?180000:60000,maxBuffer:8*1024*1024,env:{...process.env,PSModulePath:String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\Modules`}};
 // Error-only, pure projections of the last complete pair; never raw argv,
 // environment, paths or a capability. Identity hashes use the validator's
 // six/seven-digit creation-time normalization and exact identity fields.
 let completedPairs=0;
 function diagnostic(current,frame){
  const rows=x=>Array.isArray(x)?x:[],freeze=Object.freeze;
  const precise=x=>typeof x==='string'?x.replace(/(\.\d{6})Z$/,(_,d)=>d+'0Z'):null;
  const same=(a,b)=>a&&b&&['pid','parentPid','nodePath','ownerSid','commandLine'].every(k=>a[k]===b[k])&&precise(a.creationTime)===precise(b.creationTime);
  const pid=p=>Number.isSafeInteger(p?.pid)&&p.pid>0?p.pid:null;
  const digest=p=>hash(bytes(Object.fromEntries(['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'].map(k=>[k,k==='creationTime'?precise(p?.[k]):p?.[k]??null]))));
  const summary=p=>freeze({pid:pid(p),identitySha256:digest(p)});
  const raw=rows(current?.processes),owned=[...Object.values(before.identities??{}),...rows(profile.oldWatchers)],protectedRows=rows(profile.protectedProcesses),consolePins=rows(frame?.consolePins),probePins=rows(frame?.probePins),auxiliary=[...probePins,...consolePins];
  const reportedProtectedConsoles=rows(frame?.protectedConsolePins);
  const extras=raw.filter(p=>!owned.some(q=>same(p,q))&&!protectedRows.some(q=>same(p,q)));
  const extraPids=extras.filter(p=>!auxiliary.some(q=>q.pid===p.pid)),missingAuxiliary=auxiliary.filter(p=>!extras.some(q=>q.pid===p.pid));
  const comparison=(expected,actual,console=false)=>freeze({pid:pid(expected),presentInRaw:!!actual,identityMatches:!!actual&&same(console?{...actual,nodePath:typeof actual.nodePath==='string'&&actual.nodePath.toLowerCase()===expected.nodePath?.toLowerCase()?expected.nodePath:actual.nodePath}:actual,expected),expectedIdentitySha256:digest(expected),rawIdentitySha256:actual?digest(actual):null});
  const identityDrift=[...owned,...auxiliary].map(p=>comparison(p,raw.find(q=>q.pid===p.pid),consolePins.includes(p))).filter(p=>p.presentInRaw&&!p.identityMatches);
  return freeze({schemaVersion:'melisa-p03-current-b007-physical-diagnostic.v1',counts:freeze({completedPairs,rawProcesses:raw.length,ownedProcesses:owned.length,protectedProcesses:protectedRows.length,expectedAuxiliary:auxiliary.length,rawExtras:extras.length,extraPids:extraPids.length,missingAuxiliaryPids:missingAuxiliary.length,identityDrift:identityDrift.length,reportedProtectedConsoles:reportedProtectedConsoles.length}),reportedProtectedConsolePins:freeze(reportedProtectedConsoles.map(summary)),extraPids:freeze(extraPids.map(summary)),missingAuxiliaryPids:freeze(missingAuxiliary.map(summary)),missingOwnedPids:freeze(owned.filter(p=>!raw.some(q=>same(p,q))).map(summary)),identityDrift:freeze(identityDrift),protectedProcesses:freeze(protectedRows.map(p=>freeze({...comparison(p,raw.find(q=>q.pid===p.pid)),kind:p.kind==='ProtectedSqlService'?'ProtectedSqlService':'Other'}))),pins:freeze(Object.fromEntries(Object.entries(input).map(([key,ref])=>[key.replace(/Ref$/,''),ref.sha256])))});
 }
 const {current,frame,aux}=await collectPr54CurrentInspectionPair(()=>pr54CollectPhysicalObservation(async()=>{
  // Re-observe the entire raw pair; never retry just the failed worker against
  // an older process frame or delete an ephemeral row from an observation.
  claimSlot();
  await inspectPr54B264PredecessorIO();
  for(const [k,r]of Object.entries(input))need(read(r).equals(captured[k]),'PIN_CHANGED');
 let observe;const transportStarted=Date.now();
 try{observe=await run(shell,pinnedInvocation(input.observerRef,argv.observer),options);}catch(error){
  // Fixed diagnostic fields only; never copy raw error text, argv or secrets.
  try{if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'p03ReadonlyTransportDiagnostic',{value:Object.freeze({operation:'CURRENT_PHYSICAL_READ_ONLY',timeoutMs:options.timeout,elapsedMs:Math.max(0,Math.min(86400000,Date.now()-transportStarted)),killed:error.killed===true,signal:['SIGTERM','SIGKILL','SIGINT'].includes(error.signal)?error.signal:null,ioCode:['ETIMEDOUT','ENOENT','EACCES','EPERM','ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(error.code)?error.code:null,exitCode:Number.isInteger(error.code)?error.code:null})});}catch{}
  throw error;
 }
 need(!observe.stderr,'OBSERVER_STDERR');const paired=argv.observer.includes('-CaptureMode'),output=JSON.parse(observe.stdout);const envelope=paired?validatePr54CurrentSameCaptureEnvelope(output,input):null,current=paired?envelope.current:output;
 need(current.schemaVersion==='melisa-p03-physical-observation.v1'&&current.environment==='Shared'&&current.policyGeneration==='CurrentB007InspectOnly'&&current.transitionAuthority===false&&current.collectionAuthority==='PHYSICAL_OBSERVATION_ONLY'&&current.collection==='Schedule.Service.GetRunningTasks(1)'&&current.processScope==='CIM.Win32_Process.Unfiltered'&&current.portScope==='Get-NetTCPConnection.Listen.Unfiltered'&&current.stopPermitted===false&&current.applyAvailable===false&&JSON.stringify(current.beforeImage)===JSON.stringify(beforeRef)&&current.rawScope?.unverifiedCount===0&&current.rawScope?.unverifiedProcesses?.length===0,'OBSERVER_FRAME');
 const inspected=paired?null:await run(shell,pinnedInvocation(input.drainerRef,argv.worker),options);if(inspected)need(!inspected.stderr,'WORKER_STDERR');const frame=paired?envelope.frame:JSON.parse(inspected.stdout);
 completedPairs++;
 let aux;try{aux=validatePr54CurrentB007PhysicalInspection({frame,current,profile,before,profileRef,beforeRef,engineRef,recoveryHelperRef});}catch(error){
  // The existing bounded retry receives the identical error. Each failed
  // complete pair owns its own frozen diagnostic; the final error keeps only
  // that pair. Diagnostic construction must never mask the validation failure.
  try{if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'p03CurrentB007Diagnostic',{value:diagnostic(current,frame),enumerable:true});}catch{}
  throw error;
 }
 // Native worker authenticated protected SQL via service + birth + typed
 // master SELECT, and normal OS identities via the existing engine guard.
 // SQL service envelopes are not normal owner/argv process rows.
 need(profile.protectedProcesses.every(p=>p.kind==='ProtectedSqlService'||current.processes.some(q=>['pid','parentPid','nodePath','ownerSid','commandLine','creationTime'].every(k=>p[k]===q[k]))),'PROTECTED');
 await inspectPr54B264PredecessorIO();
 for(const [k,r]of Object.entries(input))need(read(r).equals(captured[k]),'PIN_CHANGED');
 claimSlot();
  return {current,frame,aux};
 },'SUCCESSOR_INSPECT'));
 const token=Object.freeze({}),now=Date.now();need(now-Date.parse(frame.observedAt)>=0&&now-Date.parse(frame.observedAt)<60000,'EXPIRED');
 inspections.set(token,{policy:'CurrentB007InspectOnly',current,profile,before,profileRef:Object.freeze({...profileRef}),beforeRef:Object.freeze({...beforeRef}),observedAt:frame.observedAt,aux,digest:hash(bytes({current,profile,before}))});
 // Only the finite b142 path consumes this already authenticated same-capture
 // frame. It is evidence, never a capability: the private inspection token is
 // still required, and caller-provided frames cannot enter this collector.
 let admissionFrame;
 if(precutB142Continuation){
  const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
  admissionFrame=freeze(JSON.parse(JSON.stringify(frame)));
 }
 return {status:'CURRENT_B007_PHYSICAL_INSPECTED_READ_ONLY',current,profile,before,physicalInspection:token,...(precutB142Continuation?{admissionFrame}:{}),claimCreated:false,applyExecuted:false,stopAuthority:false,transitionAuthority:false};
}
