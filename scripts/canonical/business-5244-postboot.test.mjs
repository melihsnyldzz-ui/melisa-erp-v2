import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {POSTBOOT,POSTBOOT_PROFILE,POSTBOOT_FILES,compilePostbootGeneration,projectPostbootTask,validatePostbootCapture} from './prepare-business-5244-postboot-recovery.mjs';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),q=s=>"'"+s.replaceAll("'","''")+"'";
function root(){return fs.mkdtempSync(path.join(process.env.RUNNER_TEMP||os.tmpdir(),'melisa-postboot-source-'));}
function run(body,{cwd=root(),timeout=20000,bootstrapPrelude=''}={}){
 const file=path.join(cwd,'test.ps1');fs.writeFileSync(file,"$ErrorActionPreference='Stop'\n"+bootstrapPrelude+"\n[Console]::Error.WriteLine('POSTBOOT_HARNESS_STARTED')\nforeach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){Microsoft.PowerShell.Core\\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$n,($n+'.psd1'))) -Scope Local -ErrorAction Stop}\n[Console]::Error.WriteLine('POSTBOOT_TRUSTED_BUILTINS_LOADED')\n"+body);
 return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:cwd,TMP:cwd,PSModulePath:path.join(cwd,'unused-module-search')}}).trim();
}
const xml='<Task><Triggers><LogonTrigger/></Triggers><Principals><Principal><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy></Settings><Actions><Exec><Command>powershell.exe</Command><Arguments>old</Arguments></Exec></Actions></Task>';
test('native argv0 identity accepts case-only real Windows file; wrong image/hash/birth/owner and exact-tail changes reject',()=>{
 if(process.platform!=='win32')return;
 const temp=root();const body=String.raw`
 Add-Type -LiteralPath __NATIVE__ -ReferencedAssemblies @('System.Management')
 . __MODULE__ -Library
 $expected='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';$hash=(Get-FileHash -LiteralPath $expected).Hash.ToLowerInvariant();$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$birth=[Business5244PostbootEpoch]::CurrentBirth
 $held=[Business5244PostbootExecutable]::CaptureCurrent($expected.ToUpperInvariant(),$expected,$hash)
 try{$held.Validate()}finally{$held.Dispose()}
 $matcher=[Business5244PostbootExecutable].GetMethod('BirthMatches',([Reflection.BindingFlags]::Static-bor[Reflection.BindingFlags]::NonPublic))
 if($matcher.Invoke($null,[object[]]@([long]1234501,[long]1234500,$false))-or!$matcher.Invoke($null,[object[]]@([long]1234501,[long]1234500,$true))){throw 'NATIVE_BIRTH_ROUNDED_WITHOUT_CIM_PROVENANCE'}
 $projected=([long]$birth-[long]$birth%10).ToString();$cim=[Business5244PostbootExecutable]::CaptureCimProcess($PID,$projected,$sid,$expected,$expected,$hash);try{$cim.Validate()}finally{$cim.Dispose()}
 $copy=Join-Path $PSScriptRoot 'same-bytes.exe';[IO.File]::Copy($expected,$copy)
 $rejects=0
 foreach($bad in @('hash','birth','owner','other-file','other-path','missing-pid')){
  $id=$PID;$b=$birth;$owner=$sid;$actual=$expected;$wanted=$expected;$digest=$hash
  switch($bad){hash{$digest='0'*64}birth{$b=([long]$birth+1000).ToString()}owner{$owner='S-1-0-0'}other-file{$actual=$copy;$wanted=$copy}other-path{$actual=$copy}missing-pid{$id=2147483000}}
  try{$x=[Business5244PostbootExecutable]::CaptureProcess($id,$b,$owner,$actual,$wanted,$digest);$x.Dispose();throw 'UNEXPECTED_IDENTITY_ACCEPTED'}catch{if($_.Exception.Message-ceq'UNEXPECTED_IDENTITY_ACCEPTED'){throw};$rejects++}
 }
 $a=@($expected.ToUpperInvariant(),'-File','C:\fixed\postboot-task.ps1','-ManifestSha256',('f'*64));$e=@($expected,'-File','C:\fixed\postboot-task.ps1','-ManifestSha256',('f'*64));Assert-Business5244PostbootArgumentTail $a $e
 foreach($bad in @('entry-case','entry-file','manifest','extra','missing','flag-case')){
  $a=@($e);switch($bad){entry-case{$a[2]='C:\fixed\POSTBOOT-TASK.ps1'}entry-file{$a[2]='C:\fixed\owner.ps1'}manifest{$a[4]='e'*64}extra{$a+=@('-Other')}missing{$a=$a[0..3]}flag-case{$a[1]='-file'}}
  $rejected=$false;try{Assert-Business5244PostbootArgumentTail $a $e}catch{if($_.Exception.Message-cne'POSTBOOT_EXACT_ENTRY_REQUIRED'){throw};$rejected=$true};if(!$rejected){throw 'NON_EXE_CASE_WAS_RELAXED'}
 }
 if($rejects-ne6){throw 'NEGATIVE_IDENTITY_COUNT'};'PASS'
 `.replace('__NATIVE__',q(path.join(dir,'business-5244-postboot-native.cs'))).replace('__MODULE__',q(path.join(dir,'business-5244-postboot.ps1')));
 assert.equal(run(body,{cwd:temp,timeout:20000}),'PASS');
});
test('publication actor validation permits recorded adopted native/web parents but rejects a foreign current API parent',()=>{
 if(process.platform!=='win32')return;
 const temp=root();fs.writeFileSync(path.join(temp,'owned-processes.json'),JSON.stringify({supervisor:42,sourceCommit:'model-source',children:{api:{pid:500,createdAt:'model'},native:{pid:500,createdAt:'model'},web:{pid:500,createdAt:'model'}}}));
 const body=String.raw`
 . __MODULE__ -Library
 function Get-Business5244PostbootCase {return @{config='MODEL_ONLY_CONFIG'}}
 function Read-ErpStartupConfig {return @{RuntimeDir=$PSScriptRoot}}
 function Get-ErpServiceDefinitions {return @{Name=$script:definition;Port=4144}}
 function Assert-ErpOwnedProcess {return [pscustomobject]@{ProcessId=500;ParentProcessId=41}}
 function Get-NetTCPConnection {throw 'MODEL_ADOPTED_PARENT_REACHED_LISTENER_CHECK'}
 foreach($name in @('api','native','web')){$script:definition=$name;$caught=$null;try{Open-Business5244PostbootPublicationActors @{base=@{sourceCommit='model-source'}} @{enginePid=42}|Out-Null}catch{$caught=$_.Exception.Message}
  $expected=if($name-ceq'api'){'POSTBOOT_PUBLICATION_API_PARENT_CHANGED'}else{'MODEL_ADOPTED_PARENT_REACHED_LISTENER_CHECK'};if($caught-cne$expected){throw 'ACTOR_PARENT_ROLE_NOT_PRESERVED'}
 };'PASS'
 `.replace('__MODULE__',q(path.join(dir,'business-5244-postboot.ps1')));
 assert.equal(run(body,{cwd:temp}),'PASS');
});
test('nineteen-file source seal rejects missing/changed/duplicate closure and holds genuine source files against writing',()=>{
 if(process.platform!=='win32')return;
 const temp=root(),bundle=path.join(temp,'bundle');fs.mkdirSync(bundle);
 const files=POSTBOOT_FILES.map(name=>{const b=fs.readFileSync(path.join(dir,name));fs.writeFileSync(path.join(bundle,name),b);return {path:name,sha256:sha(b),bytes:b.length};});
 const m={root:bundle,files};const raw=Buffer.from(JSON.stringify(m));fs.writeFileSync(path.join(bundle,'postboot-manifest.json'),raw);
 const body=String.raw`
 Add-Type -LiteralPath __WEB__
 . __MODULE__ -Library
 $root=__ROOT__;$raw=[IO.File]::ReadAllBytes((Join-Path $root 'postboot-manifest.json'));$m=[Text.Encoding]::UTF8.GetString($raw)|ConvertFrom-Json;$hash=Get-Business5244PostbootHash $raw
 $file=Join-Path $root $m.files[0].path;$original=[IO.File]::ReadAllBytes($file)
 [IO.File]::AppendAllText($file,'changed');$rejected=$false;try{$s=Open-Business5244PostbootSourceClosure $m $hash $root;$s.Dispose()}catch{$rejected=$true};if(!$rejected){throw 'CHANGED_SOURCE_ACCEPTED'};[IO.File]::WriteAllBytes($file,$original)
 [IO.File]::Move($file,($file+'.kept'));$rejected=$false;try{$s=Open-Business5244PostbootSourceClosure $m $hash $root;$s.Dispose()}catch{$rejected=$true};if(!$rejected){throw 'MISSING_SOURCE_ACCEPTED'};[IO.File]::Move(($file+'.kept'),$file)
 $duplicate=$m.files[18].path;$m.files[18].path=$m.files[0].path;$rejected=$false;try{$s=Open-Business5244PostbootSourceClosure $m $hash $root;$s.Dispose()}catch{$rejected=$true};if(!$rejected){throw 'DUPLICATE_SOURCE_ACCEPTED'};$m.files[18].path=$duplicate
 $held=Open-Business5244PostbootSourceClosure $m $hash $root
 try{$denied=$false;try{$f=[IO.File]::OpenWrite($file);$f.Dispose()}catch{$denied=$true};if(!$denied){throw 'SOURCE_WAS_NOT_RETAINED'};$held.Validate()}finally{$held.Dispose()};'PASS'
 `.replace('__WEB__',q(path.join(dir,'business-5244-web-native.cs'))).replace('__MODULE__',q(path.join(dir,'business-5244-postboot.ps1'))).replace('__ROOT__',q(bundle));
 assert.equal(run(body,{cwd:temp,timeout:20000}),'PASS');
});
test('task snapshot uses one enumeration; instance/engine/XML/SDDL/principal changes fail before a registration decision',()=>{
 if(process.platform!=='win32')return;
 const body=String.raw`
 . __MODULE__ -Library
 $script:calls=0;$script:itemCalls=0;$script:count=1;$script:engine=42;$script:guid='original-instance'
 $t=[pscustomobject]@{Enabled=$true;State=4;Definition=[pscustomobject]@{Principal=[pscustomobject]@{LogonType=3;UserId='fixture-owner'}};Xml='<Task/>'}
 $t|Add-Member ScriptMethod GetSecurityDescriptor {param($flags);return 'fixture-sddl'}
 $t|Add-Member ScriptMethod GetInstances {param($flags);$script:calls++;$r=[pscustomobject]@{Count=$script:count};$r|Add-Member ScriptMethod Item {param($index);$script:itemCalls++;return [pscustomobject]@{EnginePID=$script:engine;InstanceGuid=$script:guid}};return $r}
 $before=Get-Business5244PostbootTaskSnapshot $t;if($script:calls-ne1-or$script:itemCalls-ne1){throw 'SNAPSHOT_WAS_NOT_SINGLE'}
 foreach($bad in @('count','engine','guid','xml','sddl','principal')){
  $script:count=1;$script:engine=42;$script:guid='original-instance';$t.Xml='<Task/>';$t.Definition.Principal.UserId='fixture-owner'
  switch($bad){count{$script:count=2}engine{$script:engine=43}guid{$script:guid='new-instance'}xml{$t.Xml='<Changed/>'}sddl{}principal{$t.Definition.Principal.UserId='other-owner'}}
  $rejected=$false;try{$fresh=Get-Business5244PostbootTaskSnapshot $t;if($bad-ceq'sddl'){$fresh.sddl='other-sddl'};Assert-Business5244PostbootTaskSnapshot $before $fresh}catch{$rejected=$true};if(!$rejected){throw 'TASK_DRIFT_ACCEPTED'}
 };'PASS'
 `.replace('__MODULE__',q(path.join(dir,'business-5244-postboot.ps1')));
 assert.equal(run(body),'PASS');
});
for(const drift of ['none','engine','instance','count','lost-reply','read-only'])test(`production publication call in isolated own-file MODEL: ${drift}; no real task registration`,()=>{
 if(process.platform!=='win32')return;
 const temp=root();fs.writeFileSync(path.join(temp,'input.txt'),'immutable own fixture');
 const body=String.raw`
 Add-Type -LiteralPath __WEB__
 Add-Type -LiteralPath __NATIVE__ -ReferencedAssemblies @('System.Management')
 . __MODULE__ -Library
 $script:mode=__MODE__;$script:registerCalls=0;$script:snapshotEnumerations=0;$script:engine=42;$script:guid='same-instance';$script:count=1
 $script:task=[pscustomobject]@{Enabled=$true;State=4;Definition=[pscustomobject]@{Principal=[pscustomobject]@{LogonType=3;UserId='MODEL_ONLY_OWNER'}};Xml='<Task><Actions><Exec><Arguments>old</Arguments></Exec></Actions></Task>'}
 $script:task|Add-Member ScriptMethod GetSecurityDescriptor {param($flags);return 'MODEL_ONLY_SDDL'}
 $script:task|Add-Member ScriptMethod GetInstances {param($flags);$script:snapshotEnumerations++;$r=[pscustomobject]@{Count=$script:count};$r|Add-Member ScriptMethod Item {param($index);return [pscustomobject]@{EnginePID=$script:engine;InstanceGuid=$script:guid}};return $r}
 $folder=[pscustomobject]@{}
 $folder|Add-Member ScriptMethod GetTask {param($name);switch($script:mode){engine{$script:engine=43}instance{$script:guid='changed-instance'}count{$script:count=2}};return $script:task}
 $folder|Add-Member ScriptMethod RegisterTask {param($name,$xml,$flags,$user,$password,$logon,$sddl);if($name-cne'Melisa-ERP-TEST-Canonical'-or$flags-ne52-or$user-cne'MODEL_ONLY_OWNER'-or$null-ne$password-or$logon-ne3-or$null-ne$sddl){throw 'REGISTRATION_SCOPE_EXPANDED'};$script:registerCalls++;$script:task.Xml=$xml;if($script:mode-ceq'lost-reply'){throw 'MODEL_REPLY_LOST'};return $null}
 function Get-Business5244PostbootScheduledTask {return $script:task}
 $script:folder=$folder;function Get-Business5244PostbootTaskFolder {return $script:folder}
 function Get-Business5244PostbootCase {return @{privateRoot=$PSScriptRoot}}
 function Assert-Business5244PostbootPublicationProtection($Record){$Record.self.Validate();foreach($s in $Record.seals){$s.Validate()}}
 $psFile=[IO.Path]::Combine($PSHOME,'powershell.exe');$psHash=(Get-FileHash -LiteralPath $psFile).Hash.ToLowerInvariant();$self=[Business5244PostbootExecutable]::CaptureCurrent([Environment]::GetCommandLineArgs()[0],$psFile,$psHash)
 $seal=[Business5244PackageSeal]::new();$inputFile=Join-Path $PSScriptRoot 'input.txt';$seal.Add($inputFile,((Get-FileHash -LiteralPath $inputFile).Hash.ToLowerInvariant()));$seal.Freeze()
 $profileToken=[pscustomobject]@{fixture='MODEL_PROFILE_DISPOSAL_ONLY'};function Close-Business5244PostbootProfileScope($t){if(![object]::ReferenceEquals($t,$profileToken)){throw 'MODEL_PROFILE_TOKEN_CHANGED'}}
 $token=[pscustomobject]@{fixture='MODEL_NOT_REAL_TASK_ADMISSION'};$before=Get-Business5244PostbootTaskSnapshot $script:task
 $r=@{token=$token;purpose=$(if($script:mode-ceq'read-only'){'Preflight'}else{'TaskPublication'});profileScope=$profileToken;manifest=@{sourceCommit=('a'*40)};before=$before;proposal='<Task><Actions><Exec><Arguments>new</Arguments></Exec></Actions></Task>';self=$self;seals=@($seal);actors=@{handles=@()};used=$false;closed=$false;registrationCalls=0};$script:Business5244PostbootPublications.Add($r)
 try{
  $caught=$null;$answer=$null;try{$answer=Invoke-Business5244PostbootTaskPublication $token}catch{$caught=$_.Exception.Message}
  if($script:mode-ceq'read-only'){if($caught-cne'POSTBOOT_READ_ONLY_PUBLICATION_CONTEXT'-or$script:registerCalls-ne0-or$r.used-or(Test-Path (Join-Path $PSScriptRoot 'task-publication-attempt.json'))){throw 'READ_ONLY_CONTEXT_REACHED_MUTATOR'};'PASS';return}
  if($script:mode-cin@('engine','instance','count')){if(!$caught-or$script:registerCalls-ne0-or$r.registrationCalls-ne0){throw 'DRIFT_REACHED_REGISTRATION'}}
  elseif($script:mode-ceq'lost-reply'){if(!$caught-or$script:registerCalls-ne1-or$script:task.Xml-cne$r.proposal){throw 'UNKNOWN_MODEL_EFFECT_NOT_PRESERVED'}}
  else{if($caught-or$answer.taskChanges-ne1-or$script:registerCalls-ne1-or$script:snapshotEnumerations-ne4){throw 'MODEL_SUCCESS_COUNT_CHANGED'}}
  $rejected=$false;try{Invoke-Business5244PostbootTaskPublication $token|Out-Null}catch{if($_.Exception.Message-cne'POSTBOOT_PUBLICATION_NO_REPLAY'){throw};$rejected=$true};if(!$rejected-or$script:registerCalls-gt1){throw 'UNKNOWN_OR_COMPLETED_PUBLICATION_REPLAYED'}
  if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'task-publication-attempt.json'))){throw 'ATTEMPT_NOT_RETAINED'};'PASS'
 }finally{Close-Business5244PostbootPublication $token}
 `.replace('__WEB__',q(path.join(dir,'business-5244-web-native.cs'))).replace('__NATIVE__',q(path.join(dir,'business-5244-postboot-native.cs'))).replace('__MODULE__',q(path.join(dir,'business-5244-postboot.ps1'))).replace('__MODE__',q(drift));
 assert.equal(run(body,{cwd:temp,timeout:20000}),'PASS');
});
test('trusted builtin bootstrap needs neither an ambient Join-Path command nor module search directory',()=>{
 if(process.platform!=='win32')return;
 const body="foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){$module=Get-Module -Name $n;if(!$module-or$module.Path-cne[IO.Path]::Combine($PSHOME,'Modules',$n,($n+'.psd1'))){throw 'UNTRUSTED_BUILTIN'}};'PASS'";
 assert.equal(run(body,{bootstrapPrelude:"function global:Join-Path {throw 'IMPLICIT_BOOTSTRAP_DEPENDENCY'}"}),'PASS');
});
function capture(){return {schema:'melisa-b6-postboot-capture.v1',profileCompatibility:structuredClone(POSTBOOT_PROFILE),beforeBootFileTime:'134380000000000000',capturedFileTime:'134380360000000000',taskXml:xml,taskSddl:'MODEL_ONLY_NO_ACTUAL_TASK',windowsPowerShell:{path:POSTBOOT.ps,sha256:sha('model-windows-powershell')},taskChanges:0,sqlCalls:0,processActions:0,base:structuredClone(POSTBOOT.base),protected:[...Array.from({length:5},(_,i)=>({path:`C:\\Sirket\\ERP\\fixture${i}.json`,sha256:sha(`fixture${i}`)})),{path:POSTBOOT_PROFILE.profilePath,sha256:POSTBOOT_PROFILE.profileSha256}],health:{ok:true,environment:'CANONICAL_TEST',mode:'erp',port:4144,databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',serverName:'Semih\\MELISADEV',sourceCommit:POSTBOOT.api.sourceCommit,packageId:POSTBOOT.api.packageId,actualT1:false,externalOperations:false,automaticJobs:false,sysadmin:0,databaseControl:0,liveDatabaseAccess:0}};}
test('postboot task proposal changes only Arguments; principals/triggers/settings are byte-preserved',()=>{
 const h=sha('manifest');const projected=projectPostbootTask(xml,h);
 assert.equal(projected.replace(/<Arguments>[\s\S]*?<\/Arguments>/,'<Arguments>old</Arguments>'),xml);
 assert.ok(projected.includes(POSTBOOT.root+'\\postboot-task.ps1'));
 assert.throws(()=>projectPostbootTask(xml.replace('</Actions>','<Exec><Arguments>x</Arguments></Exec></Actions>'),h),/ACTION_COUNT/);
 assert.throws(()=>projectPostbootTask(xml,'bad'),/PROJECTION/);
});
test('real capture pin cannot be replaced by synthetic XML or an old successful archive',()=>{
 assert.throws(()=>validatePostbootCapture(capture()),/CAPTURE_TASK_CHANGED/);
 assert.throws(()=>validatePostbootCapture({schema:'melisa-b6-current-web-restore-result.v1'}),/CAPTURE_EPOCH_REJECTED/);
 assert.throws(()=>compilePostbootGeneration({source:'old',files:new Map(),capture:capture(),ci:[]}),/CAPTURE_TASK_CHANGED/);
});
test('isolated compiler model preserves all source bytes and emits no authority; every safety delta rejects',async()=>{
 // The only changed production constant is the private task XML digest. This
 // model is NOT proof that the real task or a postboot runtime was admitted.
 const temp=root(),original=fs.readFileSync(path.join(dir,'prepare-business-5244-postboot-recovery.mjs'),'utf8');
 assert.equal(original.split(POSTBOOT.taskBeforeSha256).length,2);
 const modeled=original.replace(POSTBOOT.taskBeforeSha256,sha(xml));const file=path.join(temp,'compiler-model.mjs');fs.writeFileSync(file,modeled);
 const model=await import(pathToFileURL(file));const source=sha('source').slice(0,40);
 const files=new Map(POSTBOOT_FILES.map(n=>[n,fs.readFileSync(path.join(dir,n))]));
 const ci=['push','pull_request'].map(event=>({event,head:source,conclusion:'success',jobs:['quality-build-test','secret-scan','windows-startup-test'].map(name=>({name,conclusion:'success'}))}));
 const result=model.compilePostbootGeneration({source,files,capture:capture(),ci});
 const manifest=JSON.parse(result.root.get('postboot-manifest.json'));
 for(const key of ['installed','applied','executionAuthority','runtimeGo','actualT1','externalOperations'])assert.equal(manifest[key],false);
 assert.equal(manifest.originalRequestId,POSTBOOT.originalRequestId);assert.equal(manifest.originalPath,'/api/work-sales/drafts');assert.equal(manifest.originalBodySha256,POSTBOOT.originalBodySha256);
 for(const [name,bytes]of files)assert.deepEqual(result.root.get(name),bytes);
 assert.equal(result.root.size,POSTBOOT_FILES.length+1);assert.equal(result.proof.size,8);
 for(const slot of ['Old','Candidate']){const steady=JSON.parse(result.steadyFiles[slot].get('postboot-manifest.json'));assert.equal(steady.phase,'STEADY');assert.equal(steady.initialSlot,slot);assert.equal(steady.planSha256,manifest.planSha256);assert.equal(steady.runtimeGo,false);}
 for(const delta of ['boot','capture-time','task','sql','scope','currency-target','privilege','source-path','duplicate-path','wrong-ci','missing-source']){
  const c=capture(),f=new Map(files),checks=structuredClone(ci);
  if(delta==='boot')c.beforeBootFileTime='not-time';if(delta==='capture-time')c.capturedFileTime=c.beforeBootFileTime;
  if(delta==='task')c.taskXml+='changed';if(delta==='sql')c.sqlCalls=1;
  if(delta==='scope')c.health.actualT1=true;if(delta==='currency-target')c.health.databaseName='OTHER';if(delta==='privilege')c.health.sysadmin=1;
  if(delta==='source-path')c.protected[0].path='C:\\Windows\\outside';if(delta==='duplicate-path')c.protected[0].path=c.protected[1].path;
  if(delta==='wrong-ci')checks[1].head=sha('wrong').slice(0,40);if(delta==='missing-source')f.delete('postboot-owner.ps1');
  assert.throws(()=>model.compilePostbootGeneration({source,files:f,capture:c,ci:checks}),/POSTBOOT_/);
 }
});
test('PS5 source parses and native epoch compiles; real same-boot admission is rejected',()=>{
 if(process.platform!=='win32')return;
 const files=POSTBOOT_FILES.filter(n=>n.endsWith('.ps1')).map(n=>q(path.join(dir,n))).join(',');
 const body=`$timer=[Diagnostics.Stopwatch]::StartNew();[Console]::Error.WriteLine('POSTBOOT_PARSE_START')
 foreach($p in @(${files})){$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile($p,[ref]$tokens,[ref]$errors);if($errors.Count){throw ($errors|Out-String)}}
 [Console]::Error.WriteLine('POSTBOOT_PARSE_DONE_MS='+$timer.ElapsedMilliseconds)
 Add-Type -LiteralPath ${q(path.join(dir,'business-5244-postboot-native.cs'))} -ReferencedAssemblies @('System.Management')
 [Console]::Error.WriteLine('POSTBOOT_COMPILE_DONE_MS='+$timer.ElapsedMilliseconds)
 $same=[Business5244PostbootEpoch]::BootFileTime();$rejected=$false
 [Console]::Error.WriteLine('POSTBOOT_OS_BOOT_READ_MS='+$timer.ElapsedMilliseconds)
 try{[void][Business5244PostbootEpoch]::new($same,[DateTime]::UtcNow.ToFileTimeUtc().ToString())}catch{if($_.Exception.ToString()-notmatch'POSTBOOT_NEW_BOOT_REQUIRED'){throw};$rejected=$true}
 if(!$rejected){throw 'SAME_BOOT_ACCEPTED'};'PASS'`;
 assert.equal(run(body,{timeout:20000}),'PASS');
});
test('isolated native boot MODEL: genuine own-child sequence, same retained mutex and once replay rejection',()=>{
 if(process.platform!=='win32')return;
 const temp=root(),privateRoot=path.join(temp,'proof'),runtime=path.join(temp,'runtime');fs.mkdirSync(privateRoot);fs.mkdirSync(runtime);
 const original=fs.readFileSync(path.join(dir,'business-5244-postboot-native.cs'),'utf8');
 let source=original.replace(String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-postboot-profile-integration-20261102-0742`,privateRoot).replace(String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,runtime);
 const start=source.indexOf('    public static string BootFileTime() {'),end=source.indexOf('    public Business5244PostbootEpoch(',start);
 assert.ok(start>0&&end>start);const modeledBoot=(BigInt(Date.now()-3600000)*10000n+116444736000000000n).toString();
 source=source.slice(0,start)+`    public static string BootFileTime() { return "${modeledBoot}"; }\n`+source.slice(end);
 fs.writeFileSync(path.join(temp,'epoch-model.cs'),source);fs.writeFileSync(path.join(temp,'own-child.js'),'setInterval(()=>{},1000);\n');
 const node=process.execPath;
 const body=String.raw`
 Add-Type -LiteralPath (Join-Path $PSScriptRoot 'epoch-model.cs') -ReferencedAssemblies @('System.Management')
 Add-Type -LiteralPath ORIGINAL_WEB_NATIVE
 $hash=[Security.Cryptography.SHA256]::Create();try{$digest=[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes(RUNTIME.ToLowerInvariant()))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$name='Global\MelisaERP5244Startup-'+$sid+'-'+$digest
 $mutex=[Threading.Mutex]::new($false,$name);if(!$mutex.WaitOne(0)){throw 'OWN_MUTEX_BUSY'}
 $epoch=[Business5244PostbootEpoch]::new([DateTime]::UtcNow.AddHours(-3).ToFileTimeUtc().ToString(),[DateTime]::UtcNow.AddHours(-2).ToFileTimeUtc().ToString())
 $children=[Collections.Generic.List[object]]::new()
 try{
  $epoch.BindLease($mutex,$name);$epoch.Claim('web');[void]$epoch.WriteNew('claim.json',[Text.Encoding]::UTF8.GetBytes('model-only'))
  function OwnChild { $n=[Business5244WebNative]::new();$children.Add($n);$epoch.BindChild($n);$n.Spawn(NODE,('"'+(Join-Path $PSScriptRoot 'own-child.js')+'"'),$PSScriptRoot);$epoch.ObserveCreatedChild($n);return $n }
  $old=OwnChild;$epoch.Ready($old);if($epoch.Stage-cne'OldReady'){throw 'OLD_NOT_READY'}
  $epoch.HoldPendingDirectory();$epoch.BeginSuccessor('Promote');[void]$epoch.WriteNew('promote-intent.json',[Text.Encoding]::UTF8.GetBytes('one-intent'))
  $bytes=[Text.Encoding]::UTF8.GetBytes('owned-pending-model');$pending=$epoch.CreatePending($bytes)
  $old.Dispose();$epoch.ConfirmOldChildClosed($old);$candidate=OwnChild;$epoch.Ready($candidate);$epoch.EndSuccessor();if($epoch.Stage-cne'CandidateReady'){throw 'CANDIDATE_NOT_READY'}
  $rejected=$false;try{$epoch.BeginSuccessor('Promote')}catch{$rejected=$true};if(!$rejected){throw 'DOUBLE_PROMOTE_ACCEPTED'}
  $epoch.BeginSuccessor('Rollback');$candidate.Dispose();$epoch.ConfirmOldChildClosed($candidate);$rollback=OwnChild;$epoch.Ready($rollback);$epoch.EndSuccessor();if($epoch.Stage-cne'RollbackReady'){throw 'ROLLBACK_NOT_READY'}
  $duplicate=[Business5244PostbootEpoch]::new([DateTime]::UtcNow.AddHours(-3).ToFileTimeUtc().ToString(),[DateTime]::UtcNow.AddHours(-2).ToFileTimeUtc().ToString());$rejected=$false
  try{$duplicate.Claim('web')}catch{if($_.Exception.ToString()-notmatch'POSTBOOT_ONCE_ALREADY_USED_OR_UNAVAILABLE'){throw};$rejected=$true}finally{$duplicate.Dispose()};if(!$rejected){throw 'ONCE_REPLAY_ACCEPTED'}
  $rejected=$false;try{[void]$epoch.WriteNew('claim.json',[byte[]]@(1))}catch{$rejected=$true};if(!$rejected){throw 'CLAIM_OVERWRITTEN'}
  $epoch.BeginFinalize();[void]$epoch.WriteNew('finalize-intent.json',[Text.Encoding]::UTF8.GetBytes('native-model-finalize'))
  $epoch.CompleteOwnBarrier();[void]$epoch.WriteNew('finalize-receipt.json',[Text.Encoding]::UTF8.GetBytes('native-model-receipt'));$epoch.CommitFinalization();if($epoch.Stage-cne'Committed'){throw 'FINALIZE_NOT_COMMITTED'}
  $rollback.Dispose()
  # Keep another handle open to the SAME kernel object before original release.
  $probe=[Threading.Mutex]::OpenExisting($name);$mutex.ReleaseMutex();$mutex.Dispose();$epoch.ValidateLease();$epoch.Dispose()
  try{if(!$probe.WaitOne(0)){throw 'SAME_MUTEX_NOT_FREE'};$probe.ReleaseMutex()}catch [Threading.AbandonedMutexException]{throw 'ABANDONED_HANDOFF'}finally{$probe.Dispose()}
  if((Test-Path -LiteralPath (Join-Path RUNTIME '5244-retirement.pending'))-or!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'proof\web-once\postboot-successor.completed'))){throw 'OWN_COMPLETION_WITNESS_MISSING'}
  'PASS'
 }finally{foreach($n in $children){$n.Dispose()};$epoch.Dispose();if(Get-Variable pending -ErrorAction SilentlyContinue){$pending.Dispose()};try{$mutex.Dispose()}catch{}}
 `.replaceAll('ORIGINAL_WEB_NATIVE',q(path.join(dir,'business-5244-web-native.cs'))).replaceAll('RUNTIME',q(runtime)).replaceAll('NODE',q(node));
 assert.equal(run(body,{cwd:temp,timeout:30000}),'PASS');
});
test('existing standard pending guard and all old finally/timeout bodies stay intact; new source has no external stop or SQL route',()=>{
 const gate=fs.readFileSync(path.join(dir,'business-5244-startup-exclusion.ps1'),'utf8');assert.ok(gate.includes("throw 'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'"));
 const code=fs.readFileSync(path.join(dir,'business-5244-postboot.ps1'),'utf8');const native=fs.readFileSync(path.join(dir,'business-5244-postboot-native.cs'),'utf8');
 for(const forbidden of ['TerminateProcess','Stop-Process','Remove-Item','Clear-Business','Invoke-Sqlcmd','Register-ScheduledTask','Set-ScheduledTask','ArchiveOnce','Kill('])assert.ok(!code.includes(forbidden)&&!native.includes(forbidden),forbidden);
 assert.ok(code.includes('Enter-Business5244StartupLease -Kind Owner'));assert.ok(code.includes('Assert-Business5244StartupLease $r.lease -Kind Owner'));
 assert.ok(code.includes('POSTBOOT_NORMAL_GUI_REQUIRED'));
});

function runtimeModel(extra){
 const temp=root(),proof=path.join(temp,'proof'),runtime=path.join(temp,'runtime');fs.mkdirSync(proof);fs.mkdirSync(runtime);
 let native=fs.readFileSync(path.join(dir,'business-5244-postboot-native.cs'),'utf8').replace(POSTBOOT.privateRoot,proof).replace(String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,runtime).replace(String.raw`C:\Sirket\ERP\clean\20261022\runtime`,temp);
 const a=native.indexOf('    public static string BootFileTime() {'),b=native.indexOf('    public Business5244PostbootEpoch(',a);
 const modeledBoot=(BigInt(Date.now()-3600000)*10000n+116444736000000000n).toString();
 native=native.slice(0,a)+`    public static string BootFileTime() { return "${modeledBoot}"; }\n`+native.slice(b);
 fs.writeFileSync(path.join(temp,'epoch-model.cs'),native);
 const gate=fs.readFileSync(path.join(dir,'business-5244-startup-exclusion.ps1'),'utf8').replaceAll(String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,runtime);
 fs.writeFileSync(path.join(temp,'gate-model.ps1'),gate);fs.writeFileSync(path.join(temp,'own-child.js'),'setInterval(()=>{},1000);\n');
 const body=String.raw`
 Add-Type -LiteralPath (Join-Path $PSScriptRoot 'epoch-model.cs') -ReferencedAssemblies @('System.Management')
 Add-Type -LiteralPath WEB_NATIVE
 . POSTBOOT_SOURCE -Library
 . (Join-Path $PSScriptRoot 'gate-model.ps1') -Library
 $script:fixtureCase=@{privateRoot=PROOF;runtime=RUNTIME;records=(Join-Path $PSScriptRoot 'records.json');steady=$false;slot='Old'}
 function Get-Business5244PostbootCase {return $script:fixtureCase}
 function Assert-Business5244PostbootProtection($Token){$r=Get-Business5244PostbootContext $Token;$r.epoch.Validate();$r.sourceSeal.Validate()}
 function Assert-Business5244CreatedChild($Native,$Pins){if(!($Native-is[Business5244WebNative])-or!$Native.ChildAlive()){throw 'FIXTURE_CHILD_NOT_LIVE'}}
 function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
 function Assert-Business5244PostbootHttp($Token){Get-Business5244PostbootContext $Token|Out-Null}
 function Get-CimInstance {return $null}
 function Assert-Business5244PostbootRequest($Token,$Channel,$Request,$Action){if($script:rejectRequest){throw 'FIXTURE_NATIVE_REQUEST_REJECTED'};Get-Business5244PostbootContext $Token|Out-Null}
 function Open-Business5244PostbootGuiProof($Token){$seal=[Business5244PackageSeal]::new();$file=Join-Path $PSScriptRoot 'own-child.js';$seal.Add($file,((Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant()));$seal.Freeze();return $seal}
 $script:rejectRequest=$false;$script:failCandidate=$false;$script:children=[Collections.Generic.List[object]]::new()
 function New-Business5244PinnedChild($Pins,$Lease,$PostbootContext){
  Assert-Business5244StartupLease $Lease -Kind Owner
  $n=[Business5244WebNative]::new();$script:children.Add($n);Register-Business5244PostbootNative $PostbootContext $n
  $n.Spawn(NODE,('"'+(Join-Path $PSScriptRoot 'own-child.js')+'"'),$PSScriptRoot);Register-Business5244PostbootNative $PostbootContext $n -Created
  if($Pins.package-ceq'candidate'-and$script:failCandidate){$script:failCandidate=$false;$n.Dispose();throw 'FIXTURE_CANDIDATE_START_FAILED'}
  return $n
 }
 $psFile=[IO.Path]::Combine($PSHOME,'powershell.exe');$psHash=(Get-FileHash -LiteralPath $psFile).Hash.ToLowerInvariant();$exe=[Business5244PostbootExecutable]::CaptureCurrent([Environment]::GetCommandLineArgs()[0],$psFile,$psHash)
 $token=[pscustomobject]@{fixture='MODEL_NOT_PRODUCTION_ADMISSION'}
 $epoch=[Business5244PostbootEpoch]::new([DateTime]::UtcNow.AddHours(-3).ToFileTimeUtc().ToString(),[DateTime]::UtcNow.AddHours(-2).ToFileTimeUtc().ToString())
 $ownFile=Join-Path $PSScriptRoot 'own-child.js';$ownHash=(Get-FileHash -LiteralPath $ownFile).Hash.ToLowerInvariant()
 $s=[Business5244PackageSeal]::new();$s.Add($ownFile,$ownHash);$s.Freeze();$p=[Business5244PackageSeal]::new();$p.Add($ownFile,$ownHash);$p.Freeze()
 $m=@{windowsPowerShell=@{path=$psFile;sha256=$psHash};phase='FINITE';planSha256=('e'*64);sourceCommit=('c'*40);steady=@{Old=@{root=(Join-Path $PSScriptRoot 'steady-old');manifestSha256=('5'*64)};Candidate=@{root=(Join-Path $PSScriptRoot 'steady-candidate');manifestSha256=('6'*64)}};oldWeb=@{root=(Join-Path $PSScriptRoot 'old');packageId='old';manifestSha256=('1'*64);sourceCommit=('a'*40)};candidateWeb=@{root=(Join-Path $PSScriptRoot 'candidate');packageId='candidate';manifestSha256=('2'*64);sourceCommit=('b'*40)};api=@{packageId='model-api';manifestSha256=('3'*64);sourceCommit=('c'*40)};node=@{path=NODE;sha256=('4'*64)};originalRequestId='d3d54eed-5de6-46ed-8881-1d3f004c37d8';originalPath='/api/work-sales/drafts';originalBodySha256='9a9fa1be7ffe3158f1c05f433fe07e2a9f4c2333005ca1243489d403673a76ed'}
 $r=@{token=$token;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;closed=$false;epoch=$epoch;sourceSeal=$s;protectedSeal=$s;executable=$exe;seal=$p;manifest=$m;manifestHash=('f'*64);role='Owner';lease=$null;native=$null;slot='Old';metadataHash=$null;metadataSlot='Old';metadataUnknown=$false;transitionRecordStream=$null;pending=$null}
 $script:Business5244PostbootContexts.Add($r);$script:Business5244PostbootOwner=$token;$script:fixtureToken=$token
 $other='{"port":4196,"keep":"EXACT OTHER BYTES"}'
 $row=@{pid=2147483000;root=$m.oldWeb.root;sourceCommit=$m.oldWeb.sourceCommit;port=5244;backendPort=4144;entry='vite-preview';businessWorkfaceId='ERP-5244-REALDATA-20261027'}|ConvertTo-Json -Compress
 [IO.File]::WriteAllText($script:fixtureCase.records,('['+$other+','+$row+']'),[Text.UTF8Encoding]::new($false))
 EXTRA
 `.replaceAll('WEB_NATIVE',q(path.join(dir,'business-5244-web-native.cs'))).replaceAll('POSTBOOT_SOURCE',q(path.join(dir,'business-5244-postboot.ps1'))).replaceAll('PROOF',q(proof)).replaceAll('RUNTIME',q(runtime)).replaceAll('NODE',q(process.execPath)).replace('EXTRA',extra);
 return {temp,body};
}
const initialize=String.raw`
 $r.lease=Enter-Business5244StartupLease -Kind Owner;$l=Get-Business5244StartupRecord $r.lease;$epoch.BindLease($l.mutex,$l.name);$epoch.Claim('web')
 $r.native=New-Business5244PinnedChild (Get-Business5244PostbootPins Old) $r.lease -PostbootContext $token;Publish-Business5244PostbootChild $token old
`;
const cleanup=String.raw`
 foreach($n in $script:children){$n.Dispose()};if($r.lease){Exit-Business5244StartupLease $r.lease};$epoch.Dispose();if($r.pending){$r.pending.Dispose()};$exe.Dispose();$s.Dispose();$p.Dispose()
`;
for(const failCandidate of [false,true])test(`production successor + metadata functions in isolated native MODEL: ${failCandidate?'candidate cleanup admits rollback':'promotion and explicit rollback'}`,()=>{
 if(process.platform!=='win32')return;
 const fixture=runtimeModel('try{'+initialize+String.raw`
  $request=[pscustomobject]@{requestId=('d'*32)};$script:failCandidate=FAIL
  Invoke-Business5244PostbootSuccessor $token $null $request Promote
  if($epoch.Stage-cneEXPECTED){throw 'MODEL_SUCCESSOR_STAGE_CHANGED'}
  if(!(Get-Content -LiteralPath $script:fixtureCase.records -Raw).Contains($other)){throw 'OTHER_RECORD_BYTES_CHANGED'}
  if(!FAIL){Invoke-Business5244PostbootSuccessor $token $null $request Rollback}
  if($epoch.Stage-cne'RollbackReady'){throw 'MODEL_ROLLBACK_NOT_READY'}
  $after=Get-Content -LiteralPath $script:fixtureCase.records -Raw|ConvertFrom-Json;$web=@($after|Where-Object port -eq 5244);if($web.Count-ne1-or$web[0].root-cne$m.oldWeb.root-or$web[0].pid-ne$r.native.ChildPid){throw 'MODEL_ROLLBACK_METADATA_WRONG'}
  $rejected=$false;try{Invoke-Business5244PostbootSuccessor $token $null $request Promote}catch{$rejected=$true};if(!$rejected){throw 'MODEL_REPLAY_ACCEPTED'}
  'PASS'
 }finally{`+cleanup+'}');
 fixture.body=fixture.body.replaceAll('FAIL',failCandidate?'$true':'$false').replaceAll('EXPECTED',q(failCandidate?'RollbackReady':'CandidateReady'));
 assert.equal(run(fixture.body,{cwd:fixture.temp,timeout:30000}),'PASS');
});
test('production owner loop: rejected wire is non-destructive; unknown metadata is fail-stop',()=>{
 if(process.platform!=='win32')return;
 for(const unknown of [false,true]){
  const fixture=runtimeModel(String.raw`
 function New-Business5244PostbootContext {return $script:fixtureToken}
 function Open-Business5244RetirementChannel {return [pscustomobject]@{fixture=$true}}
 function Close-Business5244RetirementChannel {}
 function Complete-Business5244RetirementRequest {}
 $script:reads=0;$script:aliveAfterWire=$false
 function Receive-Business5244RetirementRequest {
  $script:reads++
  if($script:reads-eq1){throw 'RETIREMENT_REQUEST_NOT_CONFIRMED'}
  if(!$r.native.ChildAlive()){throw 'WIRE_KILLED_CHILD'};$script:aliveAfterWire=$true
  if(UNKNOWN){return [pscustomobject]@{operation='retire';requestId=('d'*32)}}
  throw 'MODEL_END'
 }
 function Invoke-Business5244PostbootSuccessor {$r.metadataUnknown=$true;throw 'MODEL_METADATA_UNCERTAIN'}
 $caught=$null;try{Start-Business5244PostbootOwner ('f'*64)}catch{$caught=$_.Exception.Message}
 if(!$script:aliveAfterWire-or$caught-cneEXPECTED-or@($script:children|Where-Object{!$_.RetirementConfirmed}).Count){throw 'MODEL_OWNER_POLICY_WRONG'}
 if(Test-Path -LiteralPath (Join-Path PROOF 'web-once\promote-intent.json')){throw 'WIRE_CREATED_INTENT'}
 'PASS'
 `);
  fixture.body=fixture.body.replaceAll('UNKNOWN',unknown?'$true':'$false').replaceAll('EXPECTED',q(unknown?'MODEL_METADATA_UNCERTAIN':'MODEL_END')).replaceAll('PROOF',q(path.join(fixture.temp,'proof')));
  assert.equal(run(fixture.body,{cwd:fixture.temp,timeout:30000}),'PASS');
 }
});
for(const slot of ['Old','Candidate'])test(`production finalization in isolated native MODEL: ${slot} witness is readable and normal namespaces are new`,()=>{
 if(process.platform!=='win32')return;
 const fixture=runtimeModel('try{'+initialize+String.raw`
  $request=[pscustomobject]@{requestId=('d'*32)};$script:failCandidate=FAILED
  Invoke-Business5244PostbootSuccessor $token $null $request Promote
  $script:wrongTask=$true
  function Assert-Business5244PostbootTask {param($Manifest,$ManifestHash,$Role,[switch]$AllowSteadyAction,[string]$RequireSteadySlot)if($script:wrongTask-or$RequireSteadySlot-cne$r.slot){throw 'MODEL_TASK_TARGET_REJECTED'};return $PID}
  $rejected=$false;try{Complete-Business5244PostbootGeneration $token $null $request}catch{if($_.Exception.Message-cne'MODEL_TASK_TARGET_REJECTED'){throw};$rejected=$true}
  if(!$rejected-or!$r.native.ChildAlive()-or(Test-Path (Join-Path PROOF 'web-once\finalize-intent.json'))){throw 'WRONG_TASK_CHANGED_RUNNING_CHILD'}
  $script:wrongTask=$false
  $m.root=(Join-Path $PSScriptRoot 'finite');$m.initialSlot='Old';$m.files=@(@{path='own-child.js';sha256=$ownHash;bytes=(Get-Item $ownFile).Length})
  foreach($slotName in @('Old','Candidate')){
   $steadyTarget=@{};foreach($key in $m.Keys){if($key-cne'steady'){$steadyTarget[$key]=$m[$key]}}
   $steadyTarget.root=$m.steady[$slotName].root;$steadyTarget.phase='STEADY';$steadyTarget.initialSlot=$slotName
   [void][IO.Directory]::CreateDirectory($steadyTarget.root)
   [IO.File]::Copy($ownFile,(Join-Path $steadyTarget.root 'own-child.js'))
   $targetBytes=[Text.Encoding]::UTF8.GetBytes(($steadyTarget|ConvertTo-Json -Depth 100 -Compress))
   [IO.File]::WriteAllBytes((Join-Path $steadyTarget.root 'postboot-manifest.json'),$targetBytes)
   $m.steady[$slotName].manifestSha256=Get-Business5244PostbootHash $targetBytes
  }
  $targetRoot=$m.steady[$r.slot].root;$targetManifest=Join-Path $targetRoot 'postboot-manifest.json';$targetSource=Join-Path $targetRoot 'own-child.js'
  $originalManifest=[IO.File]::ReadAllBytes($targetManifest);$originalSource=[IO.File]::ReadAllBytes($targetSource)
  foreach($bad in @('missing-manifest','changed-manifest','changed-source')){
   if($bad-ceq'missing-manifest'){[IO.File]::Move($targetManifest,($targetManifest+'.kept'))}
   elseif($bad-ceq'changed-manifest'){[IO.File]::AppendAllText($targetManifest,' ')}
   else{[IO.File]::AppendAllText($targetSource,'changed')}
   $rejected=$false;try{Complete-Business5244PostbootGeneration $token $null $request}catch{$rejected=$true}
   if(!$rejected-or!$r.native.ChildAlive()-or(Test-Path (Join-Path PROOF 'web-once\finalize-intent.json'))){throw 'INVALID_STEADY_TARGET_CHANGED_CHILD'}
   if($bad-ceq'missing-manifest'){[IO.File]::Move(($targetManifest+'.kept'),$targetManifest)}
   else{[IO.File]::WriteAllBytes($targetManifest,$originalManifest);[IO.File]::WriteAllBytes($targetSource,$originalSource)}
  }
  $held=Open-Business5244PostbootSteadySeal $token
  try{foreach($locked in @($targetManifest,$targetSource)){$denied=$false;try{$writer=[IO.File]::OpenWrite($locked);$writer.Dispose()}catch{$denied=$true};if(!$denied){throw 'STEADY_TARGET_NOT_RETAINED'}};$held.Validate()}finally{$held.Dispose()}
  Complete-Business5244PostbootGeneration $token $null $request
  if($epoch.Stage-cne'Committed'-or(Test-Path (Join-Path RUNTIME '5244-retirement.pending'))){throw 'MODEL_FINALIZATION_NOT_COMMITTED'}
  $steady=@{initialSlot=SLOT;oldWeb=$m.oldWeb;candidateWeb=$m.candidateWeb;planSha256=$m.planSha256;sourceCommit=$m.sourceCommit}
  $refs=@(Get-Business5244PostbootFinalProof $steady $m.steady[SLOT].manifestSha256);if($refs.Count-ne3){throw 'MODEL_FINAL_WITNESS_NOT_READABLE'}
  $normal=[Business5244PostbootEpoch]::new([DateTime]::UtcNow.AddHours(-3).ToFileTimeUtc().ToString(),[DateTime]::UtcNow.AddHours(-2).ToFileTimeUtc().ToString(),$true)
  try{$normal.Claim('services');if($normal.ClaimedRole-cne'services'){throw 'NORMAL_CLAIM_FAILED'}
   $repeat=[Business5244PostbootEpoch]::new([DateTime]::UtcNow.AddHours(-3).ToFileTimeUtc().ToString(),[DateTime]::UtcNow.AddHours(-2).ToFileTimeUtc().ToString(),$true)
   $rejected=$false;try{$repeat.Claim('services')}catch{$rejected=$true}finally{$repeat.Dispose()};if(!$rejected){throw 'NORMAL_SAME_ISSUER_REPLAY_ACCEPTED'}
  }finally{$normal.Dispose()}
  $rejected=$false;try{Complete-Business5244PostbootGeneration $token $null $request}catch{$rejected=$true};if(!$rejected){throw 'FINALIZATION_REPLAY_ACCEPTED'}
  'PASS'
 }finally{`+cleanup+'}');
 fixture.body=fixture.body.replaceAll('FAILED',slot==='Old'?'$true':'$false').replaceAll('SLOT',q(slot)).replaceAll('PROOF',q(path.join(fixture.temp,'proof'))).replaceAll('RUNTIME',q(path.join(fixture.temp,'runtime')));
 assert.equal(run(fixture.body,{cwd:fixture.temp,timeout:30000}),'PASS');
});
test('metadata CAS conflict rejects before child shutdown or intent; lost ACK preserves one promoted child',()=>{
 if(process.platform!=='win32')return;
 const conflict=runtimeModel('try{'+initialize+String.raw`
  $request=[pscustomobject]@{requestId=('d'*32)};$oldPid=$r.native.ChildPid
  [IO.File]::AppendAllText($script:fixtureCase.records,' ')
  $rejected=$false;try{Invoke-Business5244PostbootSuccessor $token $null $request Promote}catch{if($_.Exception.Message-cne'POSTBOOT_RECORD_CAS_CHANGED'){throw};$rejected=$true}
  if(!$rejected-or$r.native.ChildPid-ne$oldPid-or!$r.native.ChildAlive()-or$epoch.Stage-cne'OldReady'-or(Test-Path (Join-Path PROOF 'web-once\promote-intent.json'))){throw 'CAS_CONFLICT_CHANGED_CHILD'}
  'PASS'
 }finally{`+cleanup+'}');
 conflict.body=conflict.body.replaceAll('PROOF',q(path.join(conflict.temp,'proof')));assert.equal(run(conflict.body,{cwd:conflict.temp,timeout:30000}),'PASS');
 const lost=runtimeModel(String.raw`
 function New-Business5244PostbootContext {return $script:fixtureToken}
 function Open-Business5244RetirementChannel {return [pscustomobject]@{fixture=$true}}
 function Close-Business5244RetirementChannel {}
 function Complete-Business5244RetirementRequest {throw 'RETIREMENT_NATIVE_PEER_CHANGED'}
 $script:reads=0;$script:promotedAlive=$false
 function Receive-Business5244RetirementRequest {$script:reads++;if($script:reads-eq1){return [pscustomobject]@{operation='retire';requestId=('d'*32)}};if($epoch.Stage-cne'CandidateReady'-or!$r.native.ChildAlive()-or$script:children.Count-ne2){throw 'LOST_ACK_CHANGED_SUCCESSOR'};$script:promotedAlive=$true;throw 'MODEL_END'}
 $caught=$null;try{Start-Business5244PostbootOwner ('f'*64)}catch{$caught=$_.Exception.Message}
 if($caught-cne'MODEL_END'-or!$script:promotedAlive){throw 'LOST_ACK_POLICY_WRONG'};'PASS'
 `);assert.equal(run(lost.body,{cwd:lost.temp,timeout:30000}),'PASS');
});
test('new completion operation is restricted to the finite root; caller-built contexts never reach IO',()=>{
 if(process.platform!=='win32')return;
 const body=String.raw`
 . MODULE -Library
 $rejected=$false;try{Get-Business5244PostbootContext ([pscustomobject]@{kind='postboot-finite-source-bound'})}catch{if($_.Exception.Message-cne'POSTBOOT_UNISSUED_CONTEXT'){throw};$rejected=$true};if(!$rejected){throw 'COPIED_CONTEXT_ACCEPTED'}
 . CHANNEL -Library
 $body=(Get-Command Get-Business5244RetirementOperations).Definition.Replace('$PSScriptRoot','$script:fixtureRoot');. ([scriptblock]::Create('function Get-Business5244RetirementOperations {'+$body+'}'))
 foreach($root in @('legacy','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-STEADY-8530-PROFILE-0742-20261102','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-STEADY-F5F8-PROFILE-0742-20261102')){$script:fixtureRoot=$root;if('complete'-cin(Get-Business5244RetirementOperations)){throw 'COMPLETION_LEAKED_TO_DEFAULT'}}
 $script:fixtureRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-PROFILE-0742-20261102';if('complete'-cnotin(Get-Business5244RetirementOperations)){throw 'FINITE_COMPLETION_MISSING'};'PASS'
 `.replace('MODULE',q(path.join(dir,'business-5244-postboot.ps1'))).replace('CHANNEL',q(path.join(dir,'business-5244-retirement-channel.ps1')));
 assert.equal(run(body),'PASS');
});


test('profile contract capture rejects descriptor, profile, purpose and unprotected source changes',async()=>{
 const temp=root(),file=path.join(temp,'compiler-profile-model.mjs');fs.writeFileSync(file,fs.readFileSync(path.join(dir,'prepare-business-5244-postboot-recovery.mjs'),'utf8').replace(POSTBOOT.taskBeforeSha256,sha(xml)));const model=await import(pathToFileURL(file));
 for(const key of ['descriptorSha256','profileSha256','profilePath','purpose']){const c=capture();c.profileCompatibility[key]='changed';assert.throws(()=>model.validatePostbootCapture(c),/POSTBOOT_CAPTURE_PROFILE_CHANGED/);}
 const c=capture();c.protected=c.protected.filter(f=>f.path!==POSTBOOT_PROFILE.profilePath);assert.throws(()=>model.validatePostbootCapture(c),/POSTBOOT_CAPTURE_PROFILE_CHANGED/);
});

for(const slot of ['Finite','Old','Candidate'])for(const role of (slot==='Finite'?['Preflight','TaskPublication','Task','Owner','Control']:['Task','Owner','Control']))test('production profile chain: '+slot+'/'+role+' uses held exact source and grants no SQL admission',async()=>{
 if(process.platform!=='win32')return;
 const temp=root(),releasePrefix=path.join(temp,'releases')+'\\',proof=path.join(temp,'proof'),inputs=path.join(temp,'source-proof'),profilePath=path.join(temp,'profile.json');fs.mkdirSync(proof);fs.mkdirSync(inputs);
 const descriptor={schemaVersion:'synthetic-only',profileHash:'old-profile',readerDefinitions:Object.fromEntries(Array.from({length:14},(_,i)=>['reader'+i,'old'+i]))};
 const installed=structuredClone(descriptor);installed.profileHash='approved-fixture-profile';installed.readerDefinitions.reader0='approved0';installed.readerDefinitions.reader1='approved1';
 const descriptorBytes=Buffer.from(JSON.stringify(descriptor)),artifactBytes=Buffer.from(JSON.stringify({revisionHash:'DEBAFECB1915AEC135E58107F64EE4243D7B93E3C091799EB8E4F29500C477DE',profileHash:'9CBDA03D44559F2CC1487B526F4E67E7301467ECBF576126AF9BEBDA18A237F9',installable:false,executeAllowed:false,nativeCompiled:false,changedModules:Array(25).fill('synthetic'),newModules:Array(31).fill('synthetic'),appDescriptor:descriptor,applyBatches:[],inverseBatches:[]}));
 fs.writeFileSync(path.join(inputs,'b6-native-complete-source-app-descriptor-20261028.json'),descriptorBytes);fs.writeFileSync(path.join(inputs,'b6-native-complete-source-artifact-20261028.json'),artifactBytes);
 const base={database:'synthetic-only',jwtAccessSecret:'fixture-only-not-a-real-key',goal8SyntheticDaySeal:{packageId:'base',sourceCommit:'fixture-source',dayId:'fixture-day',definitionHash:'fixture-definition'}};
 const api=structuredClone(base);api.goal8SyntheticDaySeal.packageId=POSTBOOT.api.packageId;api.businessWorkface={id:'ERP-5244-REALDATA-20261027',userId:17,actualT1:false,externalOperations:false};api.businessSessionAccessSecret='synthetic-only';api.businessSaleAdmission=installed;api.businessSaleWritesEnabled=true;
 const apiBytes=Buffer.from(JSON.stringify(api));fs.writeFileSync(profilePath,apiBytes);fs.writeFileSync(path.join(temp,'base.json'),JSON.stringify(base));
 const app={packageId:POSTBOOT.api.packageId,sourceCommit:POSTBOOT.api.sourceCommit,businessSaleSourceCommit:'5457e450ad153894c2f81112f08217a16c70330a',businessWorkfaceReadOnly:true,businessSaleCandidate:{kind:'ADMITTED_B6_WRITER',recordingEnabled:true},businessSaleWriterActivation:{kind:'NORMAL_SEMIH_B6_WRITER',purpose:'WriterProfileActivation',sourceCommit:'5457e450ad153894c2f81112f08217a16c70330a',basePackageId:'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028',baseManifestSha256:'85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d',artifactSha256:sha(artifactBytes),descriptorSha256:sha(descriptorBytes),revisionHash:'DEBAFECB1915AEC135E58107F64EE4243D7B93E3C091799EB8E4F29500C477DE',actorId:17,roleId:17}};
 const appBytes=Buffer.from(JSON.stringify(app)),source='a'.repeat(40),rawFiles=new Map(POSTBOOT_FILES.map(n=>[n,fs.readFileSync(path.join(dir,n))]));
 const modelFile=path.join(temp,'compiler-profile-model.mjs');fs.writeFileSync(modelFile,fs.readFileSync(path.join(dir,'prepare-business-5244-postboot-recovery.mjs'),'utf8').replace(POSTBOOT.taskBeforeSha256,sha(xml)));const model=await import(pathToFileURL(modelFile));
 const checks=['push','pull_request'].map(event=>({event,head:source,conclusion:'success',jobs:['quality-build-test','secret-scan','windows-startup-test'].map(name=>({name,conclusion:'success'}))}));
 const compiled=model.compilePostbootGeneration({source,files:rawFiles,capture:capture(),ci:checks});
 const selected=slot==='Finite'?JSON.parse(compiled.root.get('postboot-manifest.json')):JSON.parse(compiled.steadyFiles[slot].get('postboot-manifest.json'));
 const originalPrefix=String.raw`C:\Sirket\ERP\releases`+'\\',inputOriginal=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-permission-snapshot-source-20261029`;
 const map=s=>s.replaceAll(POSTBOOT.privateRoot,proof).replaceAll(originalPrefix,releasePrefix).replaceAll(POSTBOOT_PROFILE.profilePath,profilePath).replaceAll(inputOriginal,inputs).replaceAll(POSTBOOT_PROFILE.profileSha256,sha(apiBytes)).replaceAll(POSTBOOT_PROFILE.descriptorSha256,sha(JSON.stringify(installed))).replaceAll(POSTBOOT.api.manifestSha256,sha(appBytes)).replaceAll('35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe',sha(artifactBytes)).replaceAll('050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024',sha(descriptorBytes));
 const bundle=map(selected.root);fs.mkdirSync(bundle,{recursive:true});const appRoot=map(POSTBOOT.api.root);fs.mkdirSync(appRoot,{recursive:true});fs.writeFileSync(path.join(appRoot,'release-manifest.json'),appBytes);
 const leaf={Preflight:'capture-business-5244-postboot.ps1',TaskPublication:'capture-business-5244-postboot.ps1',Task:'postboot-task.ps1',Owner:'postboot-owner.ps1',Control:'postboot-control.ps1'}[role];
 const driver=String.raw`
 $ErrorActionPreference='Stop'
 foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$n,($n+'.psd1'))) -ErrorAction Stop}
 Add-Type -LiteralPath (Join-Path $PSScriptRoot 'business-5244-web-native.cs')
 Add-Type -LiteralPath (Join-Path $PSScriptRoot 'business-5244-postboot-native.cs') -ReferencedAssemblies @('System.Management')
 . (Join-Path $PSScriptRoot 'business-5244-postboot.ps1') -Library
 . (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
 $script:PostbootControlAction='Status';$role='__ROLE__';$hash=$args[([Array]::IndexOf($args,'-ManifestSha256')+1)]
 $m=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'postboot-manifest.json') -Raw|ConvertFrom-Json
 $source=Open-Business5244PostbootSourceClosure $m $hash $PSScriptRoot;$protected=[Business5244PackageSeal]::new();$protected.Add($m.profileCompatibility.profilePath,$m.profileCompatibility.profileSha256);$protected.Add((Join-Path $m.api.root 'release-manifest.json'),$m.api.manifestSha256);$protected.Freeze()
 $exe=[Business5244PostbootExecutable]::CaptureCurrent([Environment]::GetCommandLineArgs()[0],$m.windowsPowerShell.path,$m.windowsPowerShell.sha256);$token=$null
 try{
  if((Test-ErpBusinessSaleDiagnosticGeneration -IncludeSteady)-or(Test-ErpBusinessSaleReadContextRepairGeneration -IncludeSteady)){throw 'READ_PROFILE_GRANTED_MAINTENANCE_GENERATION'}
  $base=Get-Content -LiteralPath '__BASE__' -Raw|ConvertFrom-Json;$api=Get-Content -LiteralPath $m.profileCompatibility.profilePath -Raw|ConvertFrom-Json;$app=Get-Content -LiteralPath (Join-Path $m.api.root 'release-manifest.json') -Raw|ConvertFrom-Json
  $denied=$false;try{Assert-ErpApiPrivateProfile $base $api $app}catch{if($_.Exception.Message-cne'POSTBOOT_PROFILE_SCOPE_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'UNISSUED_PROFILE_ACCEPTED'}
  $token=Open-Business5244PostbootProfileScope $m $hash $role $source $protected $exe
  Assert-ErpApiPrivateProfile $base $api $app
  foreach($bad in @('descriptor','writes','actor','secret','manifest-source')){
   $a=$api|ConvertTo-Json -Depth 100|ConvertFrom-Json;$b=$base|ConvertTo-Json -Depth 100|ConvertFrom-Json;$p=$app|ConvertTo-Json -Depth 100|ConvertFrom-Json
   switch($bad){descriptor{$a.businessSaleAdmission.readerDefinitions.reader1='changed'}writes{$a.businessSaleWritesEnabled=$false}actor{$a.businessWorkface.userId=18}secret{$b.jwtAccessSecret='changed'}manifest-source{$p.businessSaleSourceCommit='b'*40}}
   $denied=$false;try{Assert-ErpApiPrivateProfile $b $a $p}catch{$denied=$true};if(!$denied){throw 'PROFILE_NEGATIVE_ACCEPTED'}
  }
  $record=Get-Business5244PostbootProfileScope;$saved=$record.role;$record.role=if($role-ceq'Task'){'Owner'}else{'Task'};$denied=$false;try{Get-Business5244PostbootProfileScope|Out-Null}catch{$denied=$true};$record.role=$saved;if(!$denied){throw 'WRONG_ROLE_ACCEPTED'}
  foreach($field in @('root','sourceCommit')){$saved=$m.$field;$m.$field='changed';$denied=$false;try{Get-Business5244PostbootProfileScope|Out-Null}catch{$denied=$true};$m.$field=$saved;if(!$denied){throw 'MANIFEST_CONTEXT_CHANGED_ACCEPTED'}}
  $denied=$false;try{Get-ErpBusinessSaleNativeAdmissionContext $token|Out-Null}catch{$denied=$true};if(!$denied-or$script:ErpBusinessSaleAdmissions.Count-ne0){throw 'READ_PROFILE_GRANTED_NATIVE_ADMISSION'}
  $before=$api|ConvertTo-Json -Depth 100 -Compress;Assert-ErpApiPrivateProfile $base $api $app;if(($api|ConvertTo-Json -Depth 100 -Compress)-cne$before){throw 'PROFILE_INPUT_MUTATED'}
  'PASS'
 }finally{if($token){Close-Business5244PostbootProfileScope $token};$exe.Dispose();$protected.Dispose();$source.Dispose()}
 `.replace('__ROLE__',role).replace('__BASE__',path.join(temp,'base.json'));
 for(const [name,bytes]of rawFiles)fs.writeFileSync(path.join(bundle,name),map(bytes.toString('utf8')));
 fs.writeFileSync(path.join(bundle,leaf),driver);
 const mapValue=v=>typeof v==='string'?map(v):Array.isArray(v)?v.map(mapValue):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,mapValue(x)])):v;
 const m=mapValue(selected);m.files=m.files.map(f=>{const b=fs.readFileSync(path.join(bundle,f.path));return {...f,sha256:sha(b),bytes:b.length}});m.windowsPowerShell.sha256=sha(fs.readFileSync(ps));const manifestBytes=Buffer.from(JSON.stringify(m));fs.writeFileSync(path.join(bundle,'postboot-manifest.json'),manifestBytes);
 const args=['-NoProfile','-NonInteractive',...(['Preflight','TaskPublication'].includes(role)?[]:['-WindowStyle','Hidden']),'-File',path.join(bundle,leaf),...(role==='Preflight'?['-ReadOnlyPreflight']:role==='TaskPublication'?['-PublishTask']:[]),'-ManifestSha256',sha(manifestBytes),...(role==='Control'?['-Action','Status']:[])];
 assert.equal(cp.execFileSync(ps,args,{encoding:'utf8',windowsHide:true,timeout:20000,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp,PSModulePath:path.join(temp,'unused-module-search')}}).trim(),'PASS');
});


test('fixed capture consumer rejects mixed actions before any OS observation or publication',()=>{
 if(process.platform!=='win32')return;
 const source=fs.readFileSync(path.join(dir,'capture-business-5244-postboot.ps1'),'utf8');assert.ok(source.includes("if($PublishTask){Invoke-Business5244PostbootTaskPublication $token|ConvertTo-Json -Compress;return}"));
 for(const flags of [['-Capture','-ReadOnlyPreflight'],['-Capture','-PublishTask'],['-ReadOnlyPreflight','-PublishTask']]){const r=cp.spawnSync(ps,['-NoProfile','-NonInteractive','-File',path.join(dir,'capture-business-5244-postboot.ps1'),...flags],{encoding:'utf8',windowsHide:true,timeout:20000,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:os.tmpdir(),TMP:os.tmpdir(),PSModulePath:path.join(os.tmpdir(),'unused-module-search')}});assert.equal(r.status,1);assert.match(r.stderr,/POSTBOOT_CAPTURE_ACTION_EXCLUSIVE/);}
});
