// Finite B264 physical inspection only. Importing this module does no IO.
// No public transport hook, token mint, claim, Drain or Apply dispatcher.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inspectPr54B264PredecessorIO,validatePr54B264PhysicalInspection,validatePr54B264Sup20dPhysicalInspection} from './p03-pr54-shared-owner-io.mjs';
import {PR54_OWNER_ROOT,PR54_B264_REFS,PR54_B264_SUCCESSOR_CLAIM_PATH,assertPr54B264SuccessorCandidate,assertPr54B264Sup20dCandidate} from './p03-pr54-owner-successor.mjs';
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
 const encoded=Buffer.from(program,'utf16le').toString('base64');need(encoded.length<30000,'COMMAND_LIMIT');
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
 const token=Object.freeze({}),now=Date.now();need(now-Date.parse(frame.observedAt)>=0&&now-Date.parse(frame.observedAt)<60000,'EXPIRED');
 inspections.set(token,{policy:'B264Sup20DInspectOnly',current,profile,before,profileRef:Object.freeze({...profileRef}),beforeRef:Object.freeze({...beforeRef}),observedAt:frame.observedAt,aux,digest:hash(bytes({current,profile,before}))});
 return {status:'B264_SUP20D_PHYSICAL_INSPECTED_READ_ONLY',current,profile,before,physicalInspection:token,claimCreated:false,applyExecuted:false,stopAuthority:false,transitionAuthority:false};
}
