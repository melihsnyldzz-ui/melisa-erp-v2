import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {validatePr54B264PhysicalInspection,validatePr54B264Sup20dPhysicalInspection,validatePr54CurrentPhysicalInspection,lookupPr54CurrentPhysicalInspection,collectPr54CurrentInspectionPair,pr54CollectPhysicalObservation} from './p03-pr54-shared-owner-io.mjs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {pr54B264InspectionArguments,lookupPr54B264PhysicalInspection,inspectPr54B264PhysicalOwner,pr54B264Sup20dInspectionArguments,lookupPr54B264Sup20dPhysicalInspection,inspectPr54B264Sup20dPhysicalOwner} from './p03-pr54-b264-physical-io.mjs';
import {PR54_OWNER_ROOT,PR54_B264_REFS,assertPr54B264SuccessorCandidate,assertPr54B264Sup20dCandidate} from './p03-pr54-owner-successor.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),root=PR54_OWNER_ROOT;
const leaf=n=>new URL('./'+n,import.meta.url),text=n=>fs.readFileSync(leaf(n),'utf8');
const drainer=text('p03-pr54-successor-core-drain.ps1'),observer=text('p03-physical-recovery-observe.ps1');
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,q=s=>"'"+s.replaceAll("'","''")+"'";
test('owner-query row diagnostics retain before and after bits without replacing the native catch',{skip:process.platform!=='win32'},()=>{
 const lines=observer.split(/\r?\n/),pre=lines[lines.findIndex(x=>x.includes('# Diagnostic row snapshot before the SAME owner query'))+1],hook=lines[lines.findIndex(x=>x.includes('# Diagnostic child scope preserves the original catch'))+1];
 assert(pre.includes('$consoleBefore='));assert(hook.includes('MELISA_NATIVE_RO_ROW='));
 const code=astFn('./p03-physical-recovery-observe.ps1','ObserverExactNotFound')+String.raw`
Import-Module (Join-Path $PSHOME 'Modules/CimCmdlets/CimCmdlets.psd1')
foreach($case in @('changed','missingBefore','diagnosticFault','legacy')){
 $PolicyGeneration=if($case-ceq'legacy'){'Legacy'}else{'CurrentB007InspectOnly'}
 $p=[pscustomobject]@{Name='conhost.exe';ExecutablePath='C:\Windows\System32\conhost.exe';CommandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';ProcessId=123;ParentProcessId=120;CreationDate=[DateTime]::UtcNow}
 if($case-ceq'missingBefore'){$p.CommandLine=$null}
`+pre+String.raw`
 [Console]::Out.WriteLine('CASE='+$case)
 $nativeError=[Management.Automation.ErrorRecord]::new([Microsoft.Management.Infrastructure.CimException]::new('private-sentinel'),'HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand',[Management.Automation.ErrorCategory]::ObjectNotFound,$null)
 try{if($case-ceq'diagnosticFault'){$p.ProcessId='private-sentinel'}else{$p.CommandLine=$null};throw $nativeError}catch{$beforeHook=$_
`+hook+String.raw`
 if(-not [object]::ReferenceEquals($_,$beforeHook)){throw 'NATIVE_CATCH_REPLACED'}
 if(-not (ObserverExactNotFound $_)){throw 'NATIVE_CLASSIFICATION_CHANGED'}
 'ORIGINAL_NATIVE_CATCH_PRESERVED'
 }
}
`;
 const out=ps(code);assert.doesNotMatch(out,/private-sentinel/);assert.equal((out.match(/ORIGINAL_NATIVE_CATCH_PRESERVED/g)??[]).length,4);
 const prefix='MELISA_NATIVE_RO_ROW=',rows=out.split(/\r?\n/).filter(x=>x.startsWith(prefix)).map(x=>JSON.parse(x.slice(prefix.length)));
 assert.equal(rows.length,2);for(const row of rows){assert.deepEqual(Object.keys(row).sort(),['after','before','exactCimNotFound','parentPid','pid']);assert.equal(row.exactCimNotFound,true);assert.equal(row.pid,123);assert.equal(row.parentPid,120);assert(Object.values(row.before).every(x=>typeof x==='boolean'));assert(Object.values(row.after).every(x=>typeof x==='boolean'));}
 assert.equal(rows[0].before.commandPresent,true);assert.equal(rows[0].after.commandPresent,false);assert.equal(rows[1].before.commandPresent,false);assert.equal(rows[1].after.commandPresent,false);
});
test('Current console failure predicates remain boolean-only and preserve the original rejection',{skip:process.platform!=='win32'},()=>{
 const code=astFn('./p03-physical-recovery-observe.ps1','ObserverRequire')+'\n'+astFn('./p03-physical-recovery-observe.ps1','ObserverVanishedConsole')+String.raw`
$PolicyGeneration='CurrentB007InspectOnly'
function ObserverExactNotFound($f){return $true}
function ObserverPinnedConsoleBinary{}
function ObserverAssertAbsentFamily($a,$b,$c){}
foreach($case in @('valid','name','emptyExe','wrongExe','emptyCommand','wrongCommand','pid','parent','samePid','date','legacy')){
 $p=[pscustomobject]@{Name='conhost.exe';ExecutablePath='C:\Windows\System32\conhost.exe';CommandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';ProcessId=123;ParentProcessId=120;CreationDate=[DateTime]::UtcNow.AddSeconds(-1)}
 switch($case){'name'{$p.Name='private-sentinel'};'emptyExe'{$p.ExecutablePath=$null};'wrongExe'{$p.ExecutablePath='private-sentinel'};'emptyCommand'{$p.CommandLine=$null};'wrongCommand'{$p.CommandLine='private-sentinel'};'pid'{$p.ProcessId=0};'parent'{$p.ParentProcessId=0};'samePid'{$p.ParentProcessId=123};'date'{$p.CreationDate='private-sentinel'};'legacy'{$PolicyGeneration='Legacy';$p.CommandLine='private-sentinel'}}
 [Console]::Out.WriteLine('CASE='+$case)
 try{$r=ObserverVanishedConsole $null $p @([pscustomobject]@{ProcessId=120;CreationDate=[DateTime]::UtcNow.AddMinutes(-1)}) @() @() @();if($case-cne'valid'){throw 'UNEXPECTED_ACCEPT'};'VALID'}catch{if($_.Exception.Message-cne'P03_VANISHED_CONSOLE_REJECTED'){throw};'ORIGINAL_REJECTION'}
}
`;
 const out=ps(code);assert.doesNotMatch(out,/private-sentinel/);assert.match(out,/CASE=valid\r?\nVALID/);assert.match(out,/CASE=legacy\r?\nORIGINAL_REJECTION/);
 const prefix='MELISA_NATIVE_RO_PREDICATES=',rows=out.split(/\r?\n/).filter(x=>x.startsWith(prefix)).map(x=>JSON.parse(x.slice(prefix.length)));
 assert.equal(rows.length,9);for(const row of rows){assert.deepEqual(Object.keys(row).sort(),['commandExact','commandPresent','creationIsDateTime','executableExact','executablePresent','nameExact','parentPositive','pidDistinct','pidPositive'].sort());assert(Object.values(row).every(x=>typeof x==='boolean'));assert(Object.values(row).some(x=>!x));}
 for(const [i,key]of ['nameExact','executablePresent','executableExact','commandPresent','commandExact','pidPositive','parentPositive','pidDistinct','creationIsDateTime'].entries())assert.equal(rows[i][key],false);
});
function input(){const source=n=>({path:root+'\\source-inspect\\'+n,sha256:n==='p03-pr54-successor-core-drain.ps1'?'34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c':n==='p03-physical-recovery-observe.ps1'?'5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5':hash(fs.readFileSync(leaf(n)))});return {profileRef:{path:root+'\\MelisaERP-P03-profile-'+ 'a'.repeat(32)+'.json',sha256:'a'.repeat(64)},beforeRef:{path:root+'\\MelisaERP-P03-before-'+ 'a'.repeat(32)+'.json',sha256:'b'.repeat(64)},engineRef:{...PR54_B264_REFS.engine},recoveryHelperRef:source('p03-pr54-paused-old-recover.ps1'),drainerRef:source('p03-pr54-successor-core-drain.ps1'),observerRef:source('p03-physical-recovery-observe.ps1')};}
function ps(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))','utf16le').toString('base64')],{input:"$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n"+code,encoding:'utf8',timeout:25000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
function astFn(file,name){return `$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(new URL(file,import.meta.url)))},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};$d=@($a.FindAll({param($x)$x -is [Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -ceq '${name}'},$true));if($d.Count-ne1){throw 'FUNCTION'};. ([scriptblock]::Create($d[0].Extent.Text))`;}
const windows={skip:process.platform!=='win32'};
test('Legacy B264 normal collector and Inspect argv retain fixed historical source pins; no mutator or caller transport',()=>{
 const f=input(),a=pr54B264InspectionArguments(f);assert.equal(a.worker[a.worker.indexOf('-Mode')+1],'Inspect');assert.equal(a.observer[a.observer.indexOf('-Purpose')+1],'Physical');assert.equal(a.observer[a.observer.indexOf('-Environment')+1],'Shared');assert.ok(a.worker.includes('B264InspectOnly')&&a.observer.includes('B264InspectOnly'));assert.ok(observer.includes(f.drainerRef.sha256));
 for(const change of [x=>x.engineRef.sha256='f'.repeat(64),x=>x.engineRef.path=x.engineRef.path.toUpperCase(),x=>x.drainerRef.sha256='f'.repeat(64),x=>x.observerRef.sha256='f'.repeat(64),x=>x.recoveryHelperRef.sha256='f'.repeat(64),x=>x.beforeRef.path=x.beforeRef.path.replace('a'.repeat(32),'b264594b6f93d560d807c8decc4e6699'),x=>x.mode='Apply',x=>x.transport=()=>{},x=>x.profileRef.path+='\\..',x=>x.engineRef.extra=true]){const x=input();change(x);assert.throws(()=>pr54B264InspectionArguments(x));}
 assert.doesNotMatch(inspectPr54B264PhysicalOwner.toString(),/CreateNew|writeFile|Stop-Process|RegisterTask|claimPr54|runPr54SharedOwnerTransition|DrainWorkerCore/);
 assert.equal(lookupPr54B264PhysicalInspection({},{}),null);
});
test('PS5 B264 mutation aliases, partial pins and legacy-source drift reject before OS/file/COM imports',windows,()=>{
 const prefix=s=>s.slice(0,s.indexOf('# Source-bound successor worker.'));
 const gate=prefix(drainer).replace(/^param\([\s\S]*?\n\)\n/,'').replaceAll('$PSBoundParameters','$script:bound');
 const observerGate=observer.slice(0,observer.indexOf('# Read-only physical collection.')).replace(/^param\([\s\S]*?\n\)\n/,'').replaceAll('$PSBoundParameters','$script:bound');
 const code=`$PolicyGeneration='B264InspectOnly';$Mode='Inspect';$EngineSha256='${PR54_B264_REFS.engine.sha256}';$RecoveryHelperSha256='${input().recoveryHelperRef.sha256}';$script:bound=@{}\nfunction Reject([scriptblock]$f){try{& $f}catch{if($_.Exception.Message-notmatch'^P03_B264_'){throw};'REJECTED';return};throw 'ACCEPTED'}\n& {${gate}};'VALID'\nforeach($m in @('Capture','Drain','inspect','INSPECT')){$Mode=$m;Reject {${gate}}};$Mode='Inspect'\nforeach($k in @('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','StopIntentPath','StopIntentSha256')){$script:bound=@{};$script:bound[$k]='';Reject {${gate}}}\n$script:bound=@{};$EngineSha256='${'f'.repeat(64)}';Reject {${gate}}\n$Environment='Shared';$Purpose='Physical';$ProfilePath='x';$ProfileSha256='x';$BeforeImagePath='x';$BeforeImageSha256='x';$EnginePath='x';$RecoveryHelperPath='x';$DrainerPath='x';$DrainerSha256='${input().drainerRef.sha256}';$EngineSha256='${PR54_B264_REFS.engine.sha256}'\n& {${observerGate}};'PHYSICAL_VALID'\nforeach($p in @('CandidateProposal','physical','PHYSICAL')){$Purpose=$p;Reject {${observerGate}}};$Purpose='Physical';$Environment='Rehearsal';Reject {${observerGate}};$Environment='Shared';$DrainerPath='';Reject {${observerGate}}`;
 const out=ps(code);assert.match(out,/VALID/);assert.match(out,/PHYSICAL_VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,16);
});
// Synthetic immutable metadata only; no source database or runtime is read.
function contractFixture(sup20d=false){
 const owner='S-1-5-21-2170750028-1005938530-2568122015-1001',db='MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
 const legacyContract=drainer.slice(drainer.indexOf('function AssertB264InspectionContract('),drainer.indexOf('function AssertB264Sup20DInspectionContract('));
 const selectedContract=sup20d?drainer.slice(drainer.indexOf('function AssertB264Sup20DInspectionContract('),drainer.indexOf('function WorkerSamePin(')):legacyContract;
 const matches=[...selectedContract.matchAll(/@\(\$(oldSettings|newSettings)\.(components\.\w+|supervisor),'([^']+)','([a-f0-9]{40})','([a-f0-9]{64})'\)/g)];assert.equal(matches.length,6);
 const old={ownerSid:owner,database:db,copyId,actualT1:false,components:{}},next=structuredClone(old),packages=[];
 for(const [,which,key,packageRoot,sourceCommit,manifestSha256]of matches){const v={packageRoot,sourceCommit,manifestSha256},o=which==='oldSettings'?old:next;if(key==='supervisor')o.supervisor=v;else o.components[key.split('.')[1]]=v;packages.push({root:packageRoot,sourceCommit,manifestPath:packageRoot+'\\release-manifest.json',manifestSha256});}
 next.components.crm=structuredClone(old.components.crm);next.components.nativeOrder=structuredClone(old.components.nativeOrder);
 const oldSettings={path:String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json`,sha256:'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'},newSettings={path:String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json`,sha256:sup20d?'f893faf4a1113fab3fdcdfce181e219f1bee480be4b6ab4142a738e47c094c95':'c'.repeat(64)};
 const names=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'],roles=['coreSupervisor','crmCatalog','crmNativeOrder','crmOrders','crmServer','erpApi','erpNative','hub'];
 const identity=pid=>({pid,ownerSid:owner,creationTime:'2026-10-20T10:00:00.0000000Z'});
 const before={schemaVersion:'melisa-p03-owner-observation.v3',runId:'a'.repeat(32),ownerSid:owner,database:db,copyId,actualT1:false,observedAt:'2026-10-20T10:01:00.0000000Z',oldConfig:oldSettings,newConfig:newSettings,plan:{oldSettingsSha256:oldSettings.sha256,newSettingsSha256:newSettings.sha256},profile:{},oldSupervisor:{root:old.supervisor.packageRoot,manifest:old.supervisor.manifestSha256},identities:Object.fromEntries(roles.map((r,n)=>[r,identity(n+1)]))};
 for(const [k,v]of [['erp',next.components.erpApiNative],['crm',next.components.crm],['supervisor',next.supervisor]])Object.assign(before.profile,{[k+'Source']:v.sourceCommit,[k+'Manifest']:v.manifestSha256});
 const profile={schemaVersion:'melisa-p03-physical-profile.v1',ownerSid:owner,database:db,beforeImage:{path:input().beforeRef.path,sha256:input().beforeRef.sha256},oldSettings,newSettings,packages,oldWatchers:[identity(9),identity(10)],tasks:names.map(name=>({name})),protectedProcesses:[{kind:'ProtectedSqlService'}]};return {profile,before,old,next};
}
test('PS5 shared B264 contract admits exact metadata and rejects copy/settings/package/source/run/freshness/role drift',windows,()=>{
 const f=contractFixture(),load=`$fixture=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(JSON.stringify(f)).toString('base64')}'))`;const reset=`$f=$fixture|ConvertFrom-Json`;const invoke=`AssertB264InspectionContract $f.profile $f.before $f.old $f.next ${q(input().profileRef.path)} ${q(input().beforeRef.path)} '${input().beforeRef.sha256}' ([DateTime]::Parse('2026-10-20T10:02:00Z'))`;
 const mutations=["$f.before.copyId='foreign'","$f.before.actualT1=$true","$f.before.runId='b264594b6f93d560d807c8decc4e6699'","$f.before.observedAt='2026-10-20T09:00:00Z'","$f.before.observedAt='2026-10-20T11:00:00Z'","$f.profile.newSettings.path+='x'","$f.profile.newSettings.sha256=$f.profile.oldSettings.sha256","$f.next.supervisor.manifestSha256='f'*64","$f.next.components.crm.sourceCommit='f'*40","$f.profile.packages[0].root+='x'","$f.profile.packages+=,$f.profile.packages[0]","$f.before.oldSupervisor.root+='x'","$f.before.identities.erpApi.pid=1","$f.before.identities.erpApi.ownerSid='foreign'","$f.before.profile.erpSource='f'*40","$f.profile.tasks[0].name='foreign'","$f.profile.protectedProcesses=@()"];
 const out=ps(astFn('./p03-pr54-successor-core-drain.ps1','AssertB264InspectionContract')+`\n${load};${reset};${invoke};'VALID'\n`+mutations.map(m=>`${reset};${m};try{${invoke};throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED'}`).join('\n'));assert.match(out,/VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,mutations.length);
});

function physicalFixture(sup20d=false){
 const f=contractFixture(sup20d),refs=sup20dInput(sup20d),now=Date.now(),observed=new Date(now-20).toISOString(),creationTime=new Date(now-2000).toISOString().replace('Z','0000Z');
 const identity=(pid,parentPid=99)=>({pid,parentPid,nodePath:'C:\\synthetic\\node.exe',ownerSid:f.before.ownerSid,commandLine:'synthetic '+pid,creationTime,bindings:[]});
 const roles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
 f.before.identities=Object.fromEntries(roles.map((r,n)=>[r,identity(n+1,8)]));
 f.profile.oldWatchers=[{...identity(20),role:'terminalWatcher'},{...identity(21),role:'hubWatcher'}];
 f.profile.shell={path:shell};f.profile.tasks=f.profile.tasks.map(t=>({...t,oldXml:'xml '+t.name,oldXmlSha256:hash('xml '+t.name)}));
 const protectedProcess={kind:'ProtectedSqlService',name:'sqlservr.exe',pid:99,creationTime,service:{name:'MSSQL$MELISADEV',state:'Running',processId:99},sql:{serverName:'Semih\\MELISADEV',databaseName:'master',processId:99}};f.profile.protectedProcesses=[protectedProcess];
 const consoles=[1,20,21].map((pid,n)=>({...identity(40+n,pid),nodePath:String.raw`C:\Windows\System32\conhost.exe`,commandLine:String.raw`\??\C:\WINDOWS\system32\conhost.exe 0x4`}));
 const current={schemaVersion:'melisa-p03-physical-observation.v1',environment:'Shared',policyGeneration:sup20d?'B264Sup20DInspectOnly':'B264InspectOnly',transitionAuthority:false,beforeImage:refs.beforeRef,collectionAuthority:'PHYSICAL_OBSERVATION_ONLY',collection:'Schedule.Service.GetRunningTasks(1)',processScope:'CIM.Win32_Process.Unfiltered',portScope:'Get-NetTCPConnection.Listen.Unfiltered',stopPermitted:false,applyAvailable:false,rawScope:{unverifiedCount:0,unverifiedProcesses:[]},observedAt:observed,tasks:f.profile.tasks.map(t=>({name:t.name,state:4,xml:t.oldXml})),runningInstances:f.profile.tasks.map((t,n)=>({name:t.name,path:'\\'+t.name,state:4,enginePid:20+n,instanceGuid:'instance-'+n})),processes:[...Object.values(f.before.identities),...f.profile.oldWatchers,...consoles],bindings:[]};
 const frame={schemaVersion:'melisa-p03-b264-precut-inspection.v1',policyGeneration:sup20d?'B264Sup20DInspectOnly':'B264InspectOnly',transitionAuthority:false,stopAuthority:false,applyExecuted:false,protectedProcesses:f.profile.protectedProcesses,profileSha256:refs.profileRef.sha256,beforeSha256:refs.beforeRef.sha256,engineSha256:refs.engineRef.sha256,recoveryHelperSha256:refs.recoveryHelperRef.sha256,observedAt:observed,oldIdentities:Object.values(f.before.identities),oldWatchers:f.profile.oldWatchers,consolePins:consoles,probePins:[]};
 return {...f,...refs,refs,frame,current,now};
}
test('B264 full frame uses the existing ten-UID/COM/port classifier and cannot mint legacy authority',()=>{
 const f=physicalFixture();assert.equal(validatePr54B264PhysicalInspection(f).length,3);assert.throws(()=>validatePr54CurrentPhysicalInspection(f));assert.equal(lookupPr54CurrentPhysicalInspection({},f),null);assert.equal(lookupPr54B264PhysicalInspection({},f),null);
 for(const mutate of [x=>x.frame.applyExecuted=true,x=>x.frame.stopAuthority=true,x=>x.frame.transitionAuthority=true,x=>x.frame.policyGeneration='Legacy',x=>x.frame.engineSha256='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037',x=>x.frame.extra=true,x=>x.frame.protectedProcesses=[],x=>x.frame.oldIdentities.pop(),x=>x.frame.oldWatchers[0].pid++,x=>x.frame.observedAt=new Date(x.now-60000).toISOString(),x=>x.current.tasks[0].xml+='x',x=>x.current.runningInstances[0].enginePid++,x=>x.current.processes.push({...x.current.processes[0]}),x=>x.current.bindings.push({pid:40,port:99,address:'127.0.0.1'}),x=>x.frame.consolePins[0].parentPid=999]){const x=physicalFixture();mutate(x);assert.throws(()=>validatePr54B264PhysicalInspection(x));}
});
function transportFixture(sup20d=false){
 const f=physicalFixture(sup20d),map=new WeakMap(),events=[],encoded=o=>Buffer.from(JSON.stringify(o)),context={input:f.refs,process:{platform:'win32'},fs:{existsSync:()=>false},Date,Object,JSON,Buffer,hash,bytes:encoded,inspections:map,need:(v,c)=>{if(!v)throw Error(c);},shell,PR54_B264_SUCCESSOR_CLAIM_PATH:'claim',pr54B264InspectionArguments,pr54B264Sup20dInspectionArguments,assertPr54B264Sup20dCandidate:c=>assertPr54B264Sup20dCandidate(JSON.parse(JSON.stringify(c))),validatePr54B264Sup20dPhysicalInspection,collectPr54CurrentInspectionPair,pr54CollectPhysicalObservation,assertPr54B264SuccessorCandidate:c=>assertPr54B264SuccessorCandidate(JSON.parse(JSON.stringify(c))),validatePr54B264PhysicalInspection,
 inspectPr54B264PredecessorIO:async()=>{events.push('history');return {transitionAuthority:false};},read:r=>r.path===f.profileRef.path?encoded(f.profile):r.path===f.beforeRef.path?encoded(f.before):Buffer.from('pinned source'),
 pinnedInvocation:(_ref,argv)=>argv,run:async(_exe,args)=>{events.push(args);return {stderr:'',stdout:JSON.stringify(args.includes('-Mode')?f.frame:f.current)};}};
 return {f,context,events,invoke:()=>vm.runInNewContext('('+(sup20d?inspectPr54B264Sup20dPhysicalOwner:inspectPr54B264PhysicalOwner).toString()+')(input)',context),lookup:vm.runInNewContext('('+(sup20d?lookupPr54B264Sup20dPhysicalInspection:lookupPr54B264PhysicalInspection).toString()+')',context),otherLookup:vm.runInNewContext('('+(sup20d?lookupPr54B264PhysicalInspection:lookupPr54B264Sup20dPhysicalInspection).toString()+')',context)};
}
test('private B264 real transport body alone mints a short-lived raw-bound token; clones/legacy/fakes/stale/drift cannot use it',async()=>{
 const t=transportFixture(),r=await t.invoke(),args={current:r.current,profile:r.profile,before:r.before,profileRef:t.f.profileRef,beforeRef:t.f.beforeRef,now:t.f.now};
 assert.equal(r.status,'B264_PHYSICAL_INSPECTED_READ_ONLY');assert.equal(r.claimCreated,false);assert.equal(r.applyExecuted,false);assert.equal(r.transitionAuthority,false);assert.equal(t.events.filter(e=>e==='history').length,2);assert.equal(t.lookup(r.physicalInspection,args).length,3);
 assert.equal(t.lookup({},args),null);assert.equal(t.lookup({...r.physicalInspection},args),null);assert.equal(lookupPr54CurrentPhysicalInspection(r.physicalInspection,args),null);assert.equal(t.lookup(r.physicalInspection,{...args,current:structuredClone(args.current)}),null);assert.equal(t.lookup(r.physicalInspection,{...args,now:t.f.now+60000}),null);assert.equal(t.lookup(r.physicalInspection,{...args,beforeRef:{...args.beforeRef,sha256:'f'.repeat(64)}}),null);args.current.processes[0].parentPid++;assert.equal(t.lookup(r.physicalInspection,args),null);
});
test('B264 transport fails closed for consumed claim, source drift, stderr, unverified raw frame and missing protected process',async()=>{
 for(const mutate of [t=>t.context.fs.existsSync=()=>true,t=>t.context.run=async()=>({stdout:'{}',stderr:'ERROR'}),t=>t.f.current.rawScope.unverifiedCount=1,t=>t.f.frame.protectedProcesses=[],t=>{const read=t.context.read;let n=0;t.context.read=r=>{const value=read(r);return ++n>6?Buffer.from('changed'):value;};}]){const t=transportFixture();mutate(t);await assert.rejects(t.invoke());}
});

test('pinned subprocess runs the authenticated source buffer under deny-write handle, not a replaceable File path',windows,()=>{
 const source=text('p03-pr54-b264-physical-io.mjs'),start=source.indexOf('function pinnedInvocation('),end=source.indexOf('\nexport async function inspectPr54B264PhysicalOwner',start);assert.ok(start>0&&end>start);
 const invoke=new Function('Buffer','need',source.slice(start,end)+';return pinnedInvocation;')(Buffer,(v,c)=>assert.ok(v,c));const f=input(),argv=pr54B264InspectionArguments(f);
 for(const [ref,a]of [[f.observerRef,argv.observer],[f.drainerRef,argv.worker]]){const args=invoke(ref,a);assert.deepEqual(args.slice(0,3),['-NoProfile','-NonInteractive','-EncodedCommand']);const program=Buffer.from(args[3],'base64').toString('utf16le');assert.match(program,/AreAccessRulesProtected/);assert.match(program,/rules.Count-ne2/);assert.match(program,/\[IO.File\]::Open\(\$v.ref.path,'Open','Read','Read'\)/);assert.match(program,/\$sha-cne\$v.ref.sha256/);assert.match(program,/scriptblock\]::Create\(\$code\)\) @bound/);assert.match(program,/finally\{\$s.Dispose\(\)\}/);assert.doesNotMatch(program,/& \$v.ref.path|Start-Process|Stop-Process|WriteAll|Set-Acl/);const encoded=Buffer.from(program).toString('base64');assert.match(ps(`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')),[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};'PARSE_PASS'`),/PARSE_PASS/);}
});

test('read-only native failure trace preserves exact rejection and CIM retry identity without disclosing exception content',windows,()=>{
 const source=text('p03-pr54-b264-physical-io.mjs'),a=source.indexOf('function pinnedInvocation('),b=source.indexOf('\nexport async function inspectPr54B264PhysicalOwner',a),invoke=new Function('Buffer','need',source.slice(a,b)+';return pinnedInvocation;')(Buffer,(v,c)=>assert.ok(v,c)),f=input();
 const program=Buffer.from(invoke(f.observerRef,pr54B264InspectionArguments(f).observer)[3],'base64').toString('utf16le'),start=program.indexOf('try{& ([scriptblock]::Create($code)) @bound}catch'),end=program.lastIndexOf('}finally{$s.Dispose()}');assert(start>0&&end>start);const fragment=program.slice(start,end);
 const run=code=>spawnSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$ProgressPreference='SilentlyContinue';"+code,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',timeout:20000});
 const prefix="$ErrorActionPreference='Stop';$bound=@{};$code='function DiagnosticLeaf{throw $script:originalError};function DiagnosticOuter{DiagnosticLeaf};DiagnosticOuter';";
 for(const kind of ['fixed','cim','io']){
  const init=kind==='io'?"$x=[IO.IOException]::new('private-sentinel',[int]-2147024864);$script:originalError=[Management.Automation.ErrorRecord]::new($x,'SyntheticSharingFixture',[Management.Automation.ErrorCategory]::ResourceBusy,$null);":kind==='cim'?"Import-Module (Join-Path $PSHOME 'Modules/CimCmdlets/CimCmdlets.psd1');$x=[Microsoft.Management.Infrastructure.CimException]::new('private-sentinel');$script:originalError=[Management.Automation.ErrorRecord]::new($x,'HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand',[Management.Automation.ErrorCategory]::ObjectNotFound,$null);":"$script:originalError='P03_SYNTHETIC_READ_REJECTED private-sentinel';";
  const r=run(prefix+init+"try{"+fragment+"}catch{[ordered]@{message=$_.Exception.Message;id=$_.FullyQualifiedErrorId;category=[string]$_.CategoryInfo.Category}|ConvertTo-Json -Compress;exit 7}");assert.equal(r.status,7,r.stderr);const caught=JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));assert(caught.message.includes('private-sentinel'));
  const match=r.stdout.match(/MELISA_NATIVE_RO_TRACE=(\[[^\r\n]*?\])/);assert(match,r.stdout);const trace=JSON.parse(match[1]);assert(trace.some(x=>x.fn==='DiagnosticLeaf'));assert(trace.length<=6);assert(trace.every(x=>Object.keys(x).sort().join('|')==='fn|line'&&/^[A-Za-z0-9_-]{1,64}$/.test(x.fn)&&Number.isSafeInteger(x.line)));assert(!match[1].includes('private-sentinel'));
  const metaMatch=r.stdout.match(/MELISA_NATIVE_RO_ERROR=(\[[^\r\n]*?\])/);assert(metaMatch,r.stdout);const meta=JSON.parse(metaMatch[1]);assert(meta.length>0&&meta.length<=3);assert(meta.every(x=>Object.keys(x).sort().join('|')==='hresult|type'&&/^(System[.][A-Za-z0-9_.]{1,120}|Microsoft[.]Management[.]Infrastructure[.]CimException)$/.test(x.type)&&Number.isInteger(x.hresult)));assert(!metaMatch[1].includes('private-sentinel'));
  if(kind==='io'){assert(meta.some(x=>x.type==='System.IO.IOException'&&x.hresult===-2147024864));assert.equal(caught.id,'SyntheticSharingFixture');assert.equal(caught.category,'ResourceBusy');}
  if(kind==='cim'){assert.equal(caught.id,'HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand');assert.equal(caught.category,'ObjectNotFound');}
 }
 const ok=run("$bound=@{};$code='Write-Output success';"+fragment);assert.equal(ok.status,0,ok.stderr);assert.equal(ok.stdout.trim(),'success');assert.equal(ok.stderr,'');
});

test('PS5 normal observer B264 Old policy imports V2 tokens and the same finite contract, rejecting New and wrong engine',windows,()=>{
 const f=contractFixture();f.old.node={path:'C:\\synthetic\\node.exe',sha256:'d'.repeat(64)};f.next.node=structuredClone(f.old.node);f.profile.shell={path:shell,sha256:'e'.repeat(64)};f.before.identities.coreSupervisor.nodePath=f.old.node.path;
 const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64'),worker=fileURLToPath(leaf('p03-pr54-successor-core-drain.ps1')),engine=fileURLToPath(leaf('p03-physical-rollback-lifetime-v2.ps1')),helper=fileURLToPath(leaf('p03-pr54-paused-old-recover.ps1'));
 const program=astFn('./p03-pr54-successor-core-drain.ps1','AssertB264InspectionContract')+'\n'+astFn('./p03-physical-recovery-observe.ps1','ObserverImportDefinition')+'\n'+astFn('./p03-physical-recovery-observe.ps1','ObserverInitializeProbePolicy')+`
$fixture=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${enc(f)}'))|ConvertFrom-Json
$profile=$fixture.profile;$before=$fixture.before;$owner=$before.ownerSid;$ProfilePath=${q(input().profileRef.path)};$BeforeImagePath=${q(input().beforeRef.path)};$BeforeImageSha256='${input().beforeRef.sha256}'
# Shift only this synthetic fixture's observation clock; no stored proof is edited.
$before.observedAt=[DateTime]::UtcNow.ToString('o');foreach($p in @($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)){$p.creationTime=[DateTime]::UtcNow.AddMinutes(-1).ToString('o')}
$old=$fixture.old;$new=$fixture.next;$engineBytes=[IO.File]::ReadAllBytes(${q(engine)});$helperBytes=[IO.File]::ReadAllBytes(${q(helper)});$script:binaryReads=0
function ObserverRequire($v){if(-not$v){throw 'POLICY_REJECTED'}}
function ObserverNoReparse($p){}
function ObserverPolicyBinary($r){$script:binaryReads++}
function ObserverPolicyJson($b){return [Text.Encoding]::UTF8.GetString($b)|ConvertFrom-Json}
function ObserverPolicyRead($r,[bool]$private=$true){
 if($r.path-ceq$profile.oldSettings.path){return ,[Text.Encoding]::UTF8.GetBytes(($old|ConvertTo-Json -Depth 20 -Compress))}
 if($r.path-ceq$profile.newSettings.path){return ,[Text.Encoding]::UTF8.GetBytes(($new|ConvertTo-Json -Depth 20 -Compress))}
 if($r.path.EndsWith('p03-physical-rollback.ps1')){return ,$engineBytes}
 if($r.path.EndsWith('p03-pr54-paused-old-recover.ps1')){return ,$helperBytes}
 if($r.path.EndsWith('release-manifest.json')){return ,[Text.Encoding]::UTF8.GetBytes(([ordered]@{sourceCommit=$old.supervisor.sourceCommit;files=@([ordered]@{path='scripts/canonical/hub-stack-process-probe.ps1';sha256=('f'*64)})}|ConvertTo-Json -Depth 10 -Compress))}
 if($r.path.EndsWith('hub-stack-process-probe.ps1')){return ,[Text.Encoding]::UTF8.GetBytes('probe')};throw 'UNEXPECTED_READ'
}
# Same pinned AST function alias used by normal source, not a boolean mock.
. ([scriptblock]::Create('function ObserverImportedB264Contract{'+(Get-Command AssertB264InspectionContract).Definition+'}'))
$er=[pscustomobject]@{path=${q(PR54_B264_REFS.engine.path)};sha256='${PR54_B264_REFS.engine.sha256}'};$hr=[pscustomobject]@{path=${q(input().recoveryHelperRef.path)};sha256='${input().recoveryHelperRef.sha256}'}
$p=ObserverInitializeProbePolicy $profile $before $before.identities 'Old' $er $hr 'B264InspectOnly';if($p.generation-cne'Old'-or$binaryReads-ne2){throw 'BAD_POLICY'};'VALID'
try{ObserverInitializeProbePolicy $profile $before $before.identities 'New' $er $hr 'B264InspectOnly'|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED'}
$er.sha256='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037';try{ObserverInitializeProbePolicy $profile $before $before.identities 'Old' $er $hr 'B264InspectOnly'|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED'}
`;
 const out=ps(program);assert.match(out,/VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,2);
});

// Historical Sup20d transport fixtures keep their frozen source pins. CurrentB007
// helper files are a different generation and cannot stand in for these bytes.
function sup20dInput(enabled=true){const f=input();if(enabled){f.drainerRef.sha256='eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5';f.observerRef.sha256='5e1f89bd24ba7b1a2c8738cab3f2f29d4ec44ade96b62127d9f1367efd6143f9';}return f;}

test('Sup20d inspection arguments require exact reviewed current bytes and a separate finite policy',()=>{
 const f=sup20dInput(),a=pr54B264Sup20dInspectionArguments(f);assert(a.worker.includes('B264Sup20DInspectOnly'));assert(a.observer.includes('B264Sup20DInspectOnly'));assert.throws(()=>pr54B264InspectionArguments(f));assert.throws(()=>pr54B264Sup20dInspectionArguments(input()));
 for(const change of [x=>x.drainerRef.sha256='f'.repeat(64),x=>x.observerRef.sha256='f'.repeat(64),x=>x.engineRef.sha256='f'.repeat(64),x=>x.transport=()=>{},x=>x.mode='Apply']){const bad=sup20dInput();change(bad);assert.throws(()=>pr54B264Sup20dInspectionArguments(bad));}
});
test('historical Sup20d transport rejects replacement by CurrentB007 helper bytes',()=>{
 for(const [key,file] of [['drainerRef','p03-pr54-successor-core-drain.ps1'],['observerRef','p03-physical-recovery-observe.ps1']]){
  const f=sup20dInput(),current=hash(fs.readFileSync(leaf(file)));assert.notEqual(current,f[key].sha256);f[key].sha256=current;assert.throws(()=>pr54B264Sup20dInspectionArguments(f),/P03_B264_PHYSICAL_SOURCE/);
 }
});
test('Sup20d private transport token cannot cross into legacy policy or survive clone drift expiry',async()=>{
 const t=transportFixture(true),r=await t.invoke(),args={current:r.current,profile:r.profile,before:r.before,profileRef:t.f.profileRef,beforeRef:t.f.beforeRef,now:t.f.now};
 assert.equal(r.status,'B264_SUP20D_PHYSICAL_INSPECTED_READ_ONLY');assert.equal(r.claimCreated,false);assert.equal(r.transitionAuthority,false);assert.equal(t.lookup(r.physicalInspection,args).length,3);assert.equal(t.otherLookup(r.physicalInspection,args),null);
 assert.equal(t.lookup({},args),null);assert.equal(t.lookup({...r.physicalInspection},args),null);assert.equal(t.lookup(r.physicalInspection,{...args,current:structuredClone(args.current)}),null);assert.equal(t.lookup(r.physicalInspection,{...args,now:t.f.now+60000}),null);
 assert.throws(()=>validatePr54B264PhysicalInspection(t.f));const legacy=transportFixture(),old=await legacy.invoke();assert.equal(legacy.otherLookup(old.physicalInspection,{current:old.current,profile:old.profile,before:old.before,profileRef:legacy.f.profileRef,beforeRef:legacy.f.beforeRef,now:legacy.f.now}),null);
});
test('Sup20d physical transport fails closed for a legacy frame candidate source drift and consumed claim',async()=>{
 for(const change of [t=>t.f.frame.policyGeneration='B264InspectOnly',t=>t.f.current.policyGeneration='B264InspectOnly',t=>t.f.before.profile.supervisorSource='eb5b37a555cbf18e1fcaa491820707c73b354e12',t=>t.f.before.newConfig.sha256='0'.repeat(64),t=>t.context.fs.existsSync=()=>true,t=>t.context.run=async()=>({stdout:'{}',stderr:'ERROR'}),t=>t.f.frame.protectedProcesses=[]]){const t=transportFixture(true);change(t);await assert.rejects(t.invoke());}
});

test('real pinned invocation named-argument parser admits Sha256 names and rejects malformed or duplicate switches',windows,()=>{
 const source=text('p03-pr54-b264-physical-io.mjs'),start=source.indexOf('function pinnedInvocation('),end=source.indexOf('\nexport async function inspectPr54B264PhysicalOwner',start);
 const invoke=new Function('Buffer','need',source.slice(start,end)+';return pinnedInvocation;')(Buffer,(v,c)=>assert.ok(v,c));const f=sup20dInput(),argv=pr54B264Sup20dInspectionArguments(f).worker;
 const program=Buffer.from(invoke(f.drainerRef,argv)[3],'base64').toString('utf16le'),a=program.indexOf('$bound=@{};'),b=program.indexOf(';$code=',a);assert(a>0&&b>a);const parser=program.slice(a,b);
 const valid=argv.slice(4),bad=[['-ProfileSha256','a','-ProfileSha256','b'],['-1Alias','x'],['-Profile;Write','x'],['-ProfileSha256']];
 const cases=Buffer.from(JSON.stringify([valid,...bad])).toString('base64');
 const out=ps(`$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${cases}'))|ConvertFrom-Json
 for($i=0;$i-lt$cases.Count;$i++){$v=[pscustomobject]@{args=@($cases[$i])};try{${parser};if($i-ne0){throw 'ACCEPTED'};if(-not$bound.ContainsKey('ProfileSha256')-or-not$bound.ContainsKey('BeforeImageSha256')){throw 'MISSING'};'VALID'}catch{if($i-eq0-or$_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED'}}`);
 assert.match(out,/VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,bad.length);
});

function addTransientProbe(f){
 const probePath=String.raw`C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a\scripts\canonical\hub-stack-process-probe.ps1`,core=f.before.identities.coreSupervisor;
 const probe={pid:70,parentPid:core.pid,nodePath:shell,ownerSid:core.ownerSid,creationTime:core.creationTime,commandLine:[shell,'-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',probePath,'-Ports','4186','-ProcessId',String(f.before.identities.erpNative.pid)].map(x=>'"'+x+'"').join(' ')};
 f.frame.probePins.push(probe);f.current.processes.push({...probe});
}
function recapturedAuxiliaryFrame(f){
 const x=structuredClone(f),ids=new Map([...x.frame.probePins,...x.frame.consolePins].map(p=>[p.pid,p.pid+1000]));
 for(const rows of [x.current.processes,x.frame.probePins,x.frame.consolePins])for(const p of rows){p.pid=ids.get(p.pid)??p.pid;p.parentPid=ids.get(p.parentPid)??p.parentPid;}
 return x;
}
test('Sup20d retries an exact ephemeral CIM failure with an entirely new observer and worker pair',async()=>{
 for(const where of ['observer','worker']){
  const t=transportFixture(true);addTransientProbe(t.f);const next=recapturedAuxiliaryFrame(t.f),seen=[];let failed=false;
  t.context.run=async(_exe,args)=>{const worker=args.includes('-Mode');seen.push(worker?'worker':'observer');if(!failed&&worker===(where==='worker')){failed=true;throw Object.assign(Error('redacted'),{stderr:'FullyQualifiedErrorId : HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand\r\n'});}return {stderr:'',stdout:JSON.stringify(worker?next.frame:failed?next.current:t.f.current)};};
  const result=await t.invoke();assert.equal(result.status,'B264_SUP20D_PHYSICAL_INSPECTED_READ_ONLY');assert.deepEqual(seen,where==='worker'?['observer','worker','observer','worker']:['observer','observer','worker']);
  assert.equal(result.current.processes.some(p=>p.pid===t.f.frame.probePins[0].pid),false);assert.equal(result.current.processes.some(p=>p.pid===next.frame.probePins[0].pid),true);
  assert.equal(t.lookup(result.physicalInspection,{current:result.current,profile:result.profile,before:result.before,profileRef:t.f.profileRef,beforeRef:t.f.beforeRef,now:t.f.now}).length,4);
 }
});
test('Sup20d AUX frame churn recaptures whole pairs and never filters or combines frames',async()=>{
 const t=transportFixture(true);addTransientProbe(t.f);const next=recapturedAuxiliaryFrame(t.f),seen=[];let workerCalls=0;
 t.context.run=async(_exe,args)=>{const worker=args.includes('-Mode');seen.push(worker?'worker':'observer');if(worker){workerCalls++;return {stderr:'',stdout:JSON.stringify(next.frame)};}return {stderr:'',stdout:JSON.stringify(workerCalls?next.current:t.f.current)};};
 const result=await t.invoke();assert.deepEqual(seen,['observer','worker','observer','worker']);assert.equal(result.current.processes.length,next.current.processes.length);assert.equal(result.current.processes.some(p=>p.pid===t.f.frame.probePins[0].pid),false);
 const bad=transportFixture(true),mismatch=recapturedAuxiliaryFrame(bad.f);let attempts=0;bad.context.run=async(_exe,args)=>{attempts++;return {stderr:'',stdout:JSON.stringify(args.includes('-Mode')?mismatch.frame:bad.f.current)};};
 await assert.rejects(bad.invoke(),/P03_SHARED_CURRENT_AUX_FRAME_CHANGED/);assert.equal(attempts,6);
});
test('Sup20d known transient retries exhaust at three complete attempts; permanent errors never retry',async()=>{
 const t=transportFixture(true);let observers=0,workers=0;const failure=Error('P03_PROCESS_IDENTITY_UNAVAILABLE');t.context.run=async(_exe,args)=>{if(args.includes('-Mode')){workers++;throw failure;}observers++;return {stderr:'',stdout:JSON.stringify(t.f.current)};};
 await assert.rejects(t.invoke(),e=>e===failure&&e.p03ObservationStage==='SUCCESSOR_INSPECT');assert.equal(observers,3);assert.equal(workers,3);
 for(const stderr of ['FullyQualifiedErrorId : HRESULT 0x80041003,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand','FullyQualifiedErrorId : HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.GetCimInstanceCommand','P03_OWNER','P03_BEFORE_HASH','P03_SHARED_CURRENT_AUX_IDENTITY']){const x=transportFixture(true);let calls=0;x.context.run=async()=>{calls++;throw Object.assign(Error('redacted'),{stderr});};await assert.rejects(x.invoke());assert.equal(calls,1);}
});
test('Sup20d recapture rechecks consumed claims and unchanged source bytes before another OS pair',async()=>{
 for(const changed of ['claim','pin']){const t=transportFixture(true);let calls=0,consumed=false,drift=false;const originalRead=t.context.read;t.context.fs.existsSync=()=>consumed;t.context.read=r=>drift?Buffer.from('changed'):originalRead(r);t.context.run=async()=>{calls++;if(changed==='claim')consumed=true;else drift=true;throw Error('P03_PROCESS_IDENTITY_UNAVAILABLE');};await assert.rejects(t.invoke(),changed==='claim'?/CONSUMED/:/PIN_CHANGED/);assert.equal(calls,1);}
});
test('Sup20d source retains raw authority rules, finite collectors and non-mutation',()=>{
 const body=inspectPr54B264Sup20dPhysicalOwner.toString();assert.match(body,/collectPr54CurrentInspectionPair\(\(\)=>pr54CollectPhysicalObservation\(async\(\)=>/);assert.match(body,/'SUCCESSOR_INSPECT'/);assert.doesNotMatch(body,/current\.processes\.filter|unverifiedProcesses\.filter|CandidateProposal|CreateNew|writeFile|Stop-Process|RegisterTask|setTimeout/);assert.equal((body.match(/inspections\.set\(/g)??[]).length,1);assert(body.indexOf('inspections.set(')>body.indexOf("'SUCCESSOR_INSPECT'"));
});

test('legacy B264 physical inspection source body remains unchanged',()=>{const s=text('p03-pr54-b264-physical-io.mjs').replaceAll('\r\n','\n'),a=s.indexOf('export async function inspectPr54B264PhysicalOwner('),b=s.indexOf('// Explicit finite generation;',a);assert.equal(hash(Buffer.from(s.slice(a,b).trim())),'34312ccab473aa09d7ed9573731392c1e54b699efc27152df810df57471ea54f');});
