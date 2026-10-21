import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseP03RehearsalMode,p03RehearsalSourceRequest,P03_B264_V2_ENGINE,P03_FAILURE_RECORD_V1_ENGINE,P03_FILE_ATTRIBUTES_V1_ENGINE,P03_CURRENT_B142_SCENARIOS,p03RehearsalFailureMetadata} from './p03-rehearsal-harness.mjs';
import {validateRehearsalFixtureArgs,REHEARSAL_PORTS,rehearsalCoreChildRoles} from './p03-rehearsal-fixture.mjs';

// Reconstruct only the historical immutable engine fixture. Production selects sealed bytes.
const historicalEngine=()=>fs.readFileSync(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url),'utf8').replaceAll('\r\n','\n').replace("{Need (([IO.File]::GetAttributes($part) -band","{$item=Get-Item -LiteralPath $part -Force;Need (($item.Attributes -band");

test('task action update preserves raw exported XML metadata and literal argument quotes',{skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8');
 const build=source.match(/^\$taskPins=@\(\);foreach\([^\r\n]+/m)[0];
 assert.doesNotMatch(build,/NewTask|XmlText|SecurityElement/);
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 function Hash([byte[]]$b){[Convert]::ToBase64String($b)}
 function ActionArgs($generation,$index){return 'new "quoted" & bounded'}
 $runRoot='C:\\isolated';$names=@('fixture-core','fixture-hub');$raw='<Task><Settings><Enabled>true</Enabled></Settings><Principals><Principal id="fixed" /></Principals><Actions Context="fixed"><Exec><Command>pinned</Command><Arguments>old "quoted"</Arguments><WorkingDirectory>old</WorkingDirectory></Exec></Actions></Task>'
 $old=@{tasks=@(@{xml=$raw},@{xml=$raw})}
 ${build}
 foreach($entry in $taskPins){$expected=$raw.Replace('<Arguments>old "quoted"</Arguments>','<Arguments>new "quoted" &amp; bounded</Arguments>').Replace('<WorkingDirectory>old</WorkingDirectory>','<WorkingDirectory>C:\\isolated\\packages\\new</WorkingDirectory>');if($entry.newXml-cne$expected){throw 'RAW_EXPORT_CHANGED'};if($entry.oldXml-cne$raw){throw 'OLD_CHANGED'}}
 'RAW_ACTION_ONLY_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/RAW_ACTION_ONLY_PASS/);
});

test('Windows PowerShell engine script named binding rejects array flags and accepts exact source hashtable without IO',{skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8');
 const declaration=source.match(/^\$common=@\{[^\r\n]+/m)[0];
 // Single-quoted here-string preserves parameter names inside the nested script.
 const fixed=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 $engine=[scriptblock]::Create(@'
 param([ValidateSet('Shared','Rehearsal')][string]$Environment,[string]$ProfilePath,[string]$ProfileSha256,[string]$BeforeImagePath,[string]$BeforeImageSha256,[string]$Mode)
 if($Environment-cne'Rehearsal'-or$ProfilePath-cne'profile'-or$ProfileSha256-cne'psha'-or$BeforeImagePath-cne'before'-or$BeforeImageSha256-cne'bsha'-or$Mode-cne'PreflightOld'){throw 'WRONG_BINDING'};'BINDING_PASS'
'@)
 $bad=@('-Environment','Rehearsal','-ProfilePath','profile','-ProfileSha256','psha','-BeforeImagePath','before','-BeforeImageSha256','bsha');$rejected=$false;try{& $engine @bad -Mode PreflightOld}catch{if($_.Exception.GetType().Name-cne'ParameterBindingValidationException'){throw};$rejected=$true};if(-not$rejected){throw 'OLD_NOT_REJECTED'}
 $profileRef=@{path='profile';sha256='psha'};$beforeRef=@{path='before';sha256='bsha'}
 ${declaration}
 & $engine @common -Mode PreflightOld`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(fixed,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/BINDING_PASS/);
});
test('rehearsal mode defaults to read only and refuses generic runtime selectors',()=>{
 assert.equal(parseP03RehearsalMode([]),'DryRun');assert.equal(parseP03RehearsalMode(['--DryRun']),'DryRun');assert.equal(parseP03RehearsalMode(['--Run']),'Run');
 for(const args of [['--Apply'],['--Run','--Run'],['--port','4184'],['--runtime','C:\\Sirket\\ERP\\runtime']])assert.throws(()=>parseP03RehearsalMode(args));
});
test('fixture accepts only exact rehearsal generation and known roles',()=>{
 const path='C:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-'+'a'.repeat(32)+'\\packages\\new\\fixture-config.json';
 assert.equal(validateRehearsalFixtureArgs(['--role','erpNative','--config',path,'--generation','new']).role,'erpNative');
 for(const args of [['--role','sqlservr','--config',path,'--generation','new'],['--role','erpNative','--config',path.replace('packages\\new','packages\\old'),'--generation','new'],['--role','erpNative','--config',path.replace('rehearsal','runtime'),'--generation','new'],['--role','erpNative','--config',path,'--generation','new','--port','4184']])assert.throws(()=>validateRehearsalFixtureArgs(args));
 assert.deepEqual(Object.values(REHEARSAL_PORTS).flat().sort((a,b)=>a-b),[4284,4286,5334,62710,62711,62712,62713,62714]);
});
test('physical harness uses same recovery engine and preserves honest proof scope',()=>{
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8');
 assert.match(source,/\$common=@\{Environment='Rehearsal';ProfilePath=/);assert.match(source,/-Mode StopNew/);assert.match(source,/-Mode RollbackOld/);assert.match(source,/-Mode PreflightOld/);
 assert.match(source,/PARTIAL_START_INTENT/);assert.match(source,/protectedBeforeSha/);assert.match(source,/PROTECTED_BASELINE_CHANGED/);
 assert.match(source,/applicationRollbackVerified=\$false;databaseRollbackVerified=\$false/);
 assert.match(source,/FileMode\]::CreateNew/);assert.match(source,/\.Flush\(\$true\)/);assert.doesNotMatch(source,/Remove-Item|Unregister-ScheduledTask|DROP DATABASE|ALTER DATABASE|DELETE FROM/i);
 assert.equal((source.match(/\$engineResult=\(& \$engineRef\.path @common/g)??[]).length,3);
 assert.equal((source.match(/'ENGINE_PHASE_PIN'/g)??[]).length,3);
 assert.doesNotMatch(source,/& \$request\.engine\.path/);
 assert.match(source,/NoReparse \$stopperSource;\$stopperBytes=\[IO\.File\]::ReadAllBytes\(\$stopperSource\)/);
 assert.match(source,/\$stopperRef=WriteNew \(Join-Path \$runRoot 'stop-exact-observed-process\.ps1'\) \$stopperBytes/);
 assert.match(source,/\$stopper=\$stopperRef\.path/);assert.match(source,/'STOPPER_EACH_STOP_PIN';\$result=& \$stopper /);
 assert.ok(source.indexOf("'STOPPER_COPY_HASH'")<source.indexOf("Journal 'REGISTER_OLD_TASKS_INTENT'"));
 assert.ok(source.indexOf("if($Mode-ceq'DryRun')")<source.indexOf('DirectoryNew $root'));
});
test('rehearsal scripts parse without creating tasks, files or processes',{skip:process.platform!=='win32'},()=>{
 for(const name of ['p03-rehearsal-driver.ps1','p03-rehearsal-watch-core.ps1','p03-rehearsal-watch-hub.ps1']){
  const file=fileURLToPath(new URL('./'+name,import.meta.url)).replaceAll("'","''");
  const command=`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){exit 1}`;
  const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});assert.equal(result.status,0,name+result.stderr);
 }
});

test('actual isolated NTFS roundtrip uses the source helpers and strict owner and SYSTEM SID ACEs',{skip:process.platform!=='win32'},()=>{
 const sourcePath=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$n,$n+'.psd1')) -ErrorAction Stop}
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors);if($errors.Count){throw 'PARSE'}
$wanted=@('Need','Hash','NoReparse','FileSecurity','DirectoryNew','WriteNew')
$functions=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-in$wanted},$true));if($functions.Count-ne6){throw 'SOURCE_HELPERS'}
. ([scriptblock]::Create(($functions|ForEach-Object{$_.Extent.Text})-join[Environment]::NewLine))
$tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath());$target=[IO.Path]::Combine($tempBase,'p03-acl-test-'+[guid]::NewGuid().ToString('N'));$file=[IO.Path]::Combine($target,'probe.json')
if(-not$target.StartsWith($tempBase,[StringComparison]::OrdinalIgnoreCase)){throw 'TEMP_SCOPE'}
try{DirectoryNew $target;$ref=WriteNew $file ([Text.Encoding]::UTF8.GetBytes('{"test":true}'))
foreach($p in @($target,$file)){$acl=Get-Acl -LiteralPath $p;if(-not$acl.AreAccessRulesProtected-or$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$owner-or@($acl.Access).Count-ne2){throw 'ACL'};$ids=@($acl.Access|ForEach-Object{if($_.AccessControlType-ne'Allow'-or$_.IsInherited-or$_.FileSystemRights-ne[Security.AccessControl.FileSystemRights]::FullControl){throw 'ACE'};$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value}|Sort-Object);$expectedIds=@($owner,'S-1-5-18')|Sort-Object;if(($ids-join'|')-cne($expectedIds-join'|')){throw 'SID'}}
if($ref.sha256-cne(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'BYTES'}
'NTFS_SOURCE_HELPERS_PASS'
}finally{if(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file -Force};if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Force}}
`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.equal(result.stdout.trim(),'NTFS_SOURCE_HELPERS_PASS');
 for(const name of ['p03-rehearsal-driver.ps1','p03-rehearsal-fixture.mjs','p03-pr54-shared-owner-io.mjs'])assert.doesNotMatch(fs.readFileSync(new URL('./'+name,import.meta.url),'utf8'),/FileSystemAccessRule\]::new\(\$(?:id|sid),/);
});

test('driver trap classifies a real controlled refusal without leaking raw error text',{skip:process.platform!=='win32'},()=>{
 const file=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);$trap=$a.EndBlock.Traps[0].Extent.Text;. ([scriptblock]::Create($trap+[Environment]::NewLine+"throw 'P03_REHEARSAL_CONTROLLED_REFUSAL'"))`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/^P03_REHEARSAL_CONTROLLED_REFUSAL TYPE_[A-Za-z]+ METHOD_[A-Za-z]+ LINE_\d+\r?\n$/);assert.doesNotMatch(result.stderr,/CLIXML|At line|CategoryInfo/);
});

test('wrapped physical-engine refusal retains only the fixed inner P03 code',{skip:process.platform!=='win32'},()=>{
 const file=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);$trap=$a.EndBlock.Traps[0].Extent.Text;. ([scriptblock]::Create($trap+[Environment]::NewLine+"throw [InvalidOperationException]::new('wrapped action: P03_PHYSICAL_ACL private-sentinel-value')"))`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/^P03_PHYSICAL_ACL TYPE_[A-Za-z]+ METHOD_[A-Za-z]+ LINE_\d+\r?\n$/);assert.doesNotMatch(result.stderr,/private-sentinel-value|wrapped action|CLIXML/);
});

test('explicit B264V2 mode selects only the same frozen private engine and preserves default rehearsal source payload',()=>{
 assert.equal(parseP03RehearsalMode(['--B264V2DryRun']),'B264V2DryRun');assert.equal(parseP03RehearsalMode(['--B264V2Run']),'B264V2Run');
 for(const args of [['--b264v2run'],['--B264V2Run','--Run'],['--engine','other'],['--B264V2Run-anything']])assert.throws(()=>parseP03RehearsalMode(args));
 // Synthetic frozen-runtime fixture only: remove the additive source recorder; production pins stay99b.
 const directory=String.raw`C:\synthetic\scripts\canonical`,v2=Buffer.from(historicalEngine().replace(/^# P03_FAILURE_RECORD_BEGIN\n[\s\S]*?^# P03_FAILURE_RECORD_END\n/gm,'')),calls=[];
 const context={path:path.win32,crypto,Buffer,P03_B264_V2_ENGINE,fs:{lstatSync:file=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1}),readFileSync:file=>{calls.push(file);return file===P03_B264_V2_ENGINE.path?v2:Buffer.from('fixture:'+path.win32.basename(file));}}};
 context.P03_CURRENT_B142_SCENARIOS=P03_CURRENT_B142_SCENARIOS;const make=vm.runInNewContext('('+p03RehearsalSourceRequest.toString()+')',context),fresh=mode=>JSON.parse(JSON.stringify(make(directory,mode)));
 const dry=fresh('B264V2DryRun'),run=fresh('B264V2Run'),legacy=fresh('DryRun');
 assert.equal(dry.mode,'DryRun');assert.equal(run.mode,'Run');assert.equal(dry.engineGeneration,'B264V2');assert.deepEqual(dry.engine,P03_B264_V2_ENGINE);assert.deepEqual(run.engine,P03_B264_V2_ENGINE);assert.deepEqual(dry.cloneProof,legacy.cloneProof);assert.deepEqual(dry.files,legacy.files);assert.equal(Object.hasOwn(legacy,'engineGeneration'),false);assert.equal(legacy.engine.path,path.win32.join(directory,'p03-physical-rollback.ps1'));
 assert.equal(crypto.createHash('sha256').update(v2).digest('hex'),P03_B264_V2_ENGINE.sha256);
 context.fs.readFileSync=file=>file===P03_B264_V2_ENGINE.path?Buffer.from('changed'):Buffer.from('fixture');assert.throws(()=>make(directory,'B264V2Run'),/P03_REHEARSAL_V2_ENGINE/);
 // Fixture canonicalization does not relax the production raw-byte engine pin.
 context.fs.readFileSync=file=>file===P03_B264_V2_ENGINE.path?Buffer.from(v2.toString('utf8').replaceAll('\n','\r\n')):Buffer.from('fixture');assert.throws(()=>make(directory,'B264V2Run'),/P03_REHEARSAL_V2_ENGINE/);
 // The new error-record source is not the frozen runtime and must be rejected.
 // Reconstruct the historical frozen1b fixture, never the new engine's identity.
 const revised=Buffer.from(historicalEngine());
 context.fs.readFileSync=file=>file===P03_B264_V2_ENGINE.path?revised:Buffer.from('fixture');assert.throws(()=>make(directory,'B264V2Run'),/P03_REHEARSAL_V2_ENGINE/);
});
test('Windows PS5 V2 request gate rejects wrong source/hash/generation without IO or task creation',{skip:process.platform!=='win32'},()=>{
 const file=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};foreach($n in @('Need','AssertRehearsalEngineRequest')){$d=@($a.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq$n},$true));if($d.Count-ne1){throw 'FUNCTION'};. ([scriptblock]::Create($d[0].Extent.Text))}
function Request{[pscustomobject]@{engineGeneration='B264V2';engine=[pscustomobject]@{path='${P03_B264_V2_ENGINE.path}';sha256='${P03_B264_V2_ENGINE.sha256}'}}}
$r=Request;AssertRehearsalEngineRequest $r 'B264V2';'VALID'
foreach($kind in @('path','hash','generation','extra','legacy-selector')){$r=Request;$g='B264V2';switch($kind){path{$r.engine.path=$r.engine.path.ToUpperInvariant()} hash{$r.engine.sha256='f'*64} generation{$r.engineGeneration='b264v2'} extra{$r.engine|Add-Member NoteProperty bypass $true} 'legacy-selector'{$g='Legacy'}};try{AssertRehearsalEngineRequest $r $g;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED'}}
$r=[pscustomobject]@{engine=[pscustomobject]@{path='C:\\synthetic\\scripts\\canonical\\p03-physical-rollback.ps1';sha256='a'*64}};AssertRehearsalEngineRequest $r 'Legacy';'LEGACY_VALID'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/VALID/);assert.match(result.stdout,/LEGACY_VALID/);assert.equal((result.stdout.match(/REJECTED/g)??[]).length,5);
});

test('harness retains bounded driver line and every allowed exception type without copying raw diagnostics',()=>{
 const types=['MethodInvocationException','RuntimeException','UnauthorizedAccessException','IOException','ArgumentException','InvalidOperationException','PropertyNotFoundException','ParameterBindingException','PSInvalidCastException','OtherException'];
 for(const type of types){const r=p03RehearsalFailureMetadata(`P03_REHEARSAL_EXECUTION_REJECTED TYPE_${type} METHOD_UnknownMethod LINE_141 private-sentinel SQL passwords argv`);assert.deepEqual(r,{status:'P03_REHEARSAL_FAILED_RETAIN_ALL_ARTIFACTS',reason:'P03_REHEARSAL_EXECUTION_REJECTED',errorType:type,method:'UnknownMethod',line:141});assert.doesNotMatch(JSON.stringify(r),/private-sentinel|SQL|passwords|argv/);}
 for(const suffix of ['LINE_-1','LINE_1000001','LINE_123456789','LINE_1.5','LINE_1e7']){const r=p03RehearsalFailureMetadata('TYPE_private METHOD_private '+suffix);assert.equal(r.errorType,'OtherException');assert.equal(r.method,'UnknownMethod');assert.equal(r.line,null);}
 assert.equal(p03RehearsalFailureMetadata('').line,null);
});

test('failure-record candidate is a separate exact selection, with no staging, fallback or source-byte normalization',()=>{
 for(const mode of ['DryRun','Run'])assert.equal(parseP03RehearsalMode(['--FailureRecordV1'+mode]),'FailureRecordV1'+mode);
 for(const args of [['--FailureRecordV1'],['--failurerecordv1run'],['--FailureRecordV1Run-extra'],['--FailureRecordV1Run','--engine'],['--EngineGeneration'],['--sha256'],['--engine-path']])assert.throws(()=>parseP03RehearsalMode(args));
 assert.ok(Object.isFrozen(P03_FAILURE_RECORD_V1_ENGINE));assert.ok(Object.isFrozen(P03_B264_V2_ENGINE));
 assert.equal(P03_FAILURE_RECORD_V1_ENGINE.path,String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\engine-candidate-1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054.ps1`);
 const revised=Buffer.from(historicalEngine());
 assert.equal(crypto.createHash('sha256').update(revised).digest('hex'),P03_FAILURE_RECORD_V1_ENGINE.sha256);
 assert.notEqual(P03_FAILURE_RECORD_V1_ENGINE.sha256,P03_B264_V2_ENGINE.sha256);
 const old=Buffer.from(revised.toString().replace(/^# P03_FAILURE_RECORD_BEGIN\n[\s\S]*?^# P03_FAILURE_RECORD_END\n/gm,''));
 const directory=String.raw`C:\synthetic\scripts\canonical`,reads=[];
 let candidateBytes=revised,missing=false;
 const context={path:path.win32,crypto,Buffer,P03_B264_V2_ENGINE,P03_FAILURE_RECORD_V1_ENGINE,fs:{lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1}),readFileSync:p=>{reads.push(p);if(p===P03_FAILURE_RECORD_V1_ENGINE.path){if(missing)throw Error('FIXTURE_MISSING_CANDIDATE');return candidateBytes;}if(p===P03_B264_V2_ENGINE.path)return old;return Buffer.from('fixture:'+path.win32.basename(p));}}};
 context.P03_CURRENT_B142_SCENARIOS=P03_CURRENT_B142_SCENARIOS;const make=vm.runInNewContext('('+p03RehearsalSourceRequest.toString()+')',context),fresh=m=>JSON.parse(JSON.stringify(make(directory,m)));
 for(const mode of ['DryRun','Run']){
  reads.length=0;const result=fresh('FailureRecordV1'+mode);assert.equal(result.mode,mode);assert.equal(result.engineGeneration,'FailureRecordV1');assert.deepEqual(result.engine,P03_FAILURE_RECORD_V1_ENGINE);assert.equal(reads.filter(x=>x===P03_FAILURE_RECORD_V1_ENGINE.path).length,1);assert.ok(!reads.includes(P03_B264_V2_ENGINE.path));
  const legacy=fresh(mode),frozen=fresh('B264V2'+mode);assert.deepEqual(result.files,legacy.files);assert.deepEqual(result.cloneProof,frozen.cloneProof);assert.deepEqual(frozen.engine,P03_B264_V2_ENGINE);
 }
 for(const bytes of [old,Buffer.from('changed'),Buffer.from(revised.toString().replaceAll('\n','\r\n'))]){candidateBytes=bytes;assert.throws(()=>make(directory,'FailureRecordV1Run'),/P03_REHEARSAL_FAILURE_RECORD_ENGINE/);}
 missing=true;reads.length=0;assert.throws(()=>make(directory,'FailureRecordV1DryRun'),/FIXTURE_MISSING_CANDIDATE/);assert.ok(!reads.includes(P03_B264_V2_ENGINE.path));
 assert.throws(()=>make(directory,'FailureRecordV1'),/P03_REHEARSAL_MODE/);
});

test('PS5 actual request gate accepts only the finite candidate and rejects cross-generation paths/hashes/fields', {skip:process.platform!=='win32'},()=>{
 const file=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'}
foreach($name in @('Need','AssertRehearsalEngineRequest')){$f=@($ast.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq$name},$true));if($f.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($f[0].Extent.Text))}
function Request{[pscustomobject]@{engineGeneration='FailureRecordV1';engine=[pscustomobject]@{path='${P03_FAILURE_RECORD_V1_ENGINE.path}';sha256='${P03_FAILURE_RECORD_V1_ENGINE.sha256}'}}}
$r=Request;AssertRehearsalEngineRequest $r 'FailureRecordV1';'CANDIDATE_VALID'
foreach($kind in @('path','hash','upperhash','generation','fields','v2tuple','v2selector','legacyselector','unknownselector')){
 $r=Request;$generation='FailureRecordV1'
 switch($kind){path{$r.engine.path=$r.engine.path.ToUpperInvariant()} hash{$r.engine.sha256='f'*64} upperhash{$r.engine.sha256=$r.engine.sha256.ToUpperInvariant()} generation{$r.engineGeneration='failurerecordv1'} fields{$r.engine|Add-Member NoteProperty bypass $true} v2tuple{$r.engine.path='${P03_B264_V2_ENGINE.path}';$r.engine.sha256='${P03_B264_V2_ENGINE.sha256}'} v2selector{$generation='B264V2'} legacyselector{$generation='Legacy'} unknownselector{$generation='Other'}}
 try{AssertRehearsalEngineRequest $r $generation;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}
}
function Inventory{throw 'FIXTURE_LIVE_FORBIDDEN'};function Get-CimInstance{throw 'FIXTURE_LIVE_FORBIDDEN'};function DirectoryNew{throw 'FIXTURE_WRITE_FORBIDDEN'}
'NO_DISPATCH'
`;
 const r=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');assert.match(r.stdout,/CANDIDATE_VALID/);assert.match(r.stdout,/NO_DISPATCH/);assert.equal((r.stdout.match(/REJECTED/g)??[]).length,9);
});

test('candidate parameter binding rejects unknown flags and preserves the prior admission/writes order', {skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8'),file=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const extra=source.match(/^if\(\$EngineGeneration -ceq 'FailureRecordV1'\)\{Need \(\$args.Count -eq 0\)[^\r\n]+/m)[0];
 assert.ok(source.indexOf("'TASK_ALREADY_EXISTS'")<source.indexOf('AssertRehearsalEngineRequest $request $EngineGeneration'));
 assert.ok(source.indexOf('AssertRehearsalEngineRequest $request $EngineGeneration')<source.indexOf(extra));assert.ok(source.indexOf(extra)<source.indexOf('NoReparse $request.engine.path'));
 assert.ok(source.indexOf("'ENGINE_PIN'",source.indexOf(extra))<source.indexOf('$protectedBefore=ProtectedSnapshot'));
 assert.ok(source.indexOf("if($Mode-ceq'DryRun')")<source.indexOf('DirectoryNew $root'));
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e)
function Need($v,$code){if(-not$v){throw ('P03_REHEARSAL_'+$code)}}
$parameters=[scriptblock]::Create($ast.ParamBlock.Extent.Text+[Environment]::NewLine+[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(extra).toString('base64')}'))+[Environment]::NewLine+"'PARAMS_BOUND'")
&$parameters -Mode DryRun -EngineGeneration FailureRecordV1
foreach($bad in @('Other','FailureRecordV1Run')){try{&$parameters -Mode DryRun -EngineGeneration $bad;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}}
try{&$parameters -Mode Apply -EngineGeneration FailureRecordV1;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}
try{&$parameters -Mode DryRun -EngineGeneration FailureRecordV1 -EnginePath private-sentinel;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}
`;
 const r=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');assert.match(r.stdout,/PARAMS_BOUND/);assert.equal((r.stdout.match(/REJECTED/g)??[]).length,4);
});

test('CurrentB142 rehearsal exposes only four finite scenarios and retains the legacy default',()=>{
 for(const scenario of P03_CURRENT_B142_SCENARIOS)for(const suffix of ['Run','DryRun'])assert.equal(parseP03RehearsalMode(['--CurrentB142'+scenario+suffix]),'CurrentB142'+scenario+suffix);
 for(const args of [['--CurrentB142Run'],['--CurrentB142NormalApply'],['--CurrentB142normalRun'],['--CurrentB142NormalRun','--Run']])assert.throws(()=>parseP03RehearsalMode(args),/P03_REHEARSAL_MODE/);
 assert.equal(parseP03RehearsalMode([]),'DryRun');
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8');
 assert.match(source,/status='CURRENT_B142_REHEARSAL_SCENARIO_READY'/);
 assert.match(source,/\$before\['runId'\]=\$runId/);assert.match(source,/p03TransitionDigest\(x\)/);
 assert.match(source,/partial=\(\$generation-ceq'new'\)/);assert.match(source,/\$cfg\['startup'\]=\[ordered\]@\{schemaVersion='melisa-p03-current-b142-fixture-startup.v1'/);
 for(const text of [source.replaceAll('\r\n','\n'),source.replaceAll('\r\n','\n').replaceAll('\n','\r\n')]){const cleanup=/QuiesceCurrentRehearsal\r?\n\s*\$report=/.exec(text);assert(cleanup&&cleanup.index>text.indexOf("Journal 'CURRENT_SCENARIO_VERIFIED'"));}
 assert.match(source,/MelisaERP-P03-current-b007-control-6213b2c673ca\\p03-pr54-new-owner-empty-recovery\.ps1/);
 assert.doesNotMatch(source,/MelisaERP-P03-b264-sup20d-control-0ddaf85067d6/);
});

test('CurrentB142 driver cleanup refuses foreign scope, changed protection, partial and duplicate captured identities before mutation',{skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8'),start=source.indexOf('function QuiesceCurrentRehearsal{'),end=source.indexOf("\nNeed ([Security.Principal.WindowsIdentity]",start),body=source.slice(start,end);
 assert.match(body,/OpenRehearsalOldHandle/);assert.match(body,/CURRENT_CLEANUP_ARGV/);assert.match(body,/CURRENT_CLEANUP_COM/);assert.match(body,/CURRENT_CLEANUP_DELETE_CAS/);assert.match(body,/\.DeleteTask\(\$entry\.name,0\)/);assert.match(body,/rehearsal-cleanup-before\.json/);assert.doesNotMatch(body,/'before\.json'|'profile\.json'|Stop-Process|Remove-Item|Restore/);
 const program=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 function Need($v,$code){if(-not$v){throw $code}}
 function ProtectedSnapshot{return 'protected'};function Bytes($x){return $x};function Hash($x){return $x}
 function Snapshot{return $script:fresh}
 function Get-CimInstance{throw 'MUTATION_BOUNDARY_REACHED'}
 ${body}
 $EngineGeneration='CurrentB142Rehearsal';$runRoot='C:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-${'a'.repeat(32)}';$protectedBeforeSha='protected'
 function Full{$script:fresh=@{processes=@(1..8|ForEach-Object{@{pid=$_}});watchers=@(@{pid=9},@{pid=10});tasks=@(@{},@{});listeners=@(1..8)}}
 $checks=0
 foreach($bad in @('Shared','FileAttributesV1','')){Full;$EngineGeneration=$bad;try{QuiesceCurrentRehearsal;throw 'ACCEPTED'}catch{if($_.Exception.Message-cne'CURRENT_CLEANUP_SCOPE'){throw}};$checks++};$EngineGeneration='CurrentB142Rehearsal'
 $saved=$runRoot;$runRoot='C:\\Sirket\\ERP\\runtime\\Shared';try{QuiesceCurrentRehearsal;throw 'ACCEPTED'}catch{if($_.Exception.Message-cne'CURRENT_CLEANUP_SCOPE'){throw}};$runRoot=$saved;$checks++
 Full;$protectedBeforeSha='changed';try{QuiesceCurrentRehearsal;throw 'ACCEPTED'}catch{if($_.Exception.Message-cne'CURRENT_CLEANUP_PROTECTED'){throw}};$protectedBeforeSha='protected';$checks++
 foreach($count in 0..7){Full;$script:fresh.processes=@(1..8|Select-Object -First $count|ForEach-Object{@{pid=$_}});try{QuiesceCurrentRehearsal;throw 'ACCEPTED'}catch{if($_.Exception.Message-cne'CURRENT_CLEANUP_FULL_GENERATION'){throw}};$checks++}
 Full;$script:fresh.watchers=@(@{pid=1},@{pid=10});try{QuiesceCurrentRehearsal;throw 'ACCEPTED'}catch{if($_.Exception.Message-cne'CURRENT_CLEANUP_DUPLICATE'){throw}};$checks++
 if($checks-ne14){throw 'FIXTURE_COUNT'};'CURRENT_CLEANUP_14_NEGATIVE_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(program,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/CURRENT_CLEANUP_14_NEGATIVE_PASS/);
});

test('CurrentB142 startup explicitly binds each scenario and exact child tuple without changing legacy partial semantics',()=>{
 const full=['erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer'];
 assert.deepEqual(rehearsalCoreChildRoles({partial:true},'new'),['erpNative']);assert.deepEqual(rehearsalCoreChildRoles({partial:false},'old'),full);assert.deepEqual(rehearsalCoreChildRoles({partial:false},'new'),full);
 for(const scenario of P03_CURRENT_B142_SCENARIOS){const childRoles=scenario==='PartialNew'?['erpNative']:full,config={generation:'new',partial:true,startup:{schemaVersion:'melisa-p03-current-b142-fixture-startup.v1',scenario,generation:'new',childRoles}};assert.deepEqual(rehearsalCoreChildRoles(config,'new'),childRoles);
  const negatives=[c=>delete c.startup.generation,c=>c.startup.extra=true,c=>c.startup.schemaVersion='other',c=>c.startup.scenario='normal',c=>c.startup.scenario='Unknown',c=>c.startup.generation='old',c=>c.generation='old',c=>c.partial=false,c=>c.partial='true',c=>c.startup.childRoles=[...c.startup.childRoles,'hub'],c=>c.startup.childRoles=['erpNative','erpNative'],c=>c.startup.childRoles=[...c.startup.childRoles].reverse(),c=>c.startup.childRoles=null];
  for(const mutate of negatives){const bad=structuredClone(config);mutate(bad);if(JSON.stringify(bad)===JSON.stringify(config))continue;assert.throws(()=>rehearsalCoreChildRoles(bad,'new'),/P03_REHEARSAL_STARTUP_/);}
  assert.throws(()=>rehearsalCoreChildRoles(config,'old'),/P03_REHEARSAL_STARTUP_/);
 }
});

test('PS5 emits an actual one-element childRoles array and retains frozen NEW partial=true for every Current scenario',{skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8'),line=source.split(/\r?\n/).find(x=>x.includes("$cfg['startup']="));assert(line);
 const command=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 $EngineGeneration='CurrentB142Rehearsal';$generation='new'
 foreach($RehearsalScenario in @('Normal','OldCutFailure','ReplyLoss','PartialNew')){$cfg=[ordered]@{partial=($generation-ceq'new')}
 ${line}
 $read=($cfg|ConvertTo-Json -Depth 8 -Compress)|ConvertFrom-Json;if($read.partial-cne$true-or-not($read.startup.childRoles-is[Array])){throw 'ARRAY_OR_PARTIAL_LOST'};$expected=if($RehearsalScenario-ceq'PartialNew'){1}else{6};if($read.startup.childRoles.Count-ne$expected-or$read.startup.scenario-cne$RehearsalScenario){throw 'WRONG_STARTUP'};if((@($read.startup.PSObject.Properties.Name|Sort-Object)-join'|')-cne'childRoles|generation|scenario|schemaVersion'){throw 'EXTRA_STARTUP_FIELD'}}
 $EngineGeneration='Legacy';$cfg=[ordered]@{partial=$true};${line};if($cfg.Contains('startup')){throw 'LEGACY_CHANGED'};'CURRENT_STARTUP_JSON_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/CURRENT_STARTUP_JSON_PASS/);
});

test('Current direct frozen read-only preflight refusal alone can clean its captured full fixture, preserving the original error',{skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(new URL('./p03-rehearsal-driver.ps1',import.meta.url),'utf8').replaceAll('\r\n','\n'),start=source.indexOf('try{\n$engineResult=(& $engineRef.path @common -Mode PreflightOld)'),end=source.indexOf("Need ((Get-FileHash -LiteralPath $stopper",start),block=source.slice(start,end);assert(start>0&&end>start);assert.doesNotMatch(block,/Drain|runPr54CurrentB142RehearsalTransition|Current_DISPATCHER|Mode StopNew/);assert.match(block,/throw \$readonlyPreflightFailure/);
 const program=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 function Need($v,$code){if(-not$v){throw $code}}
 function Journal($event){$script:events+=,$event}
 function QuiesceCurrentRehearsal{$script:cleanups++;if($script:cleanupFails){throw 'CLEANUP_FAILED'};return @{capturedIdentities=10}}
 function FrozenReadOnly{param($Mode);if($Mode-cne'PreflightOld'){throw 'WRONG_MODE'};if($script:preflightFails){throw 'P03_PHYSICAL_REHEARSAL_CONFIG_SCOPE'};return '{"status":"OLD_PHYSICAL_PREFLIGHT"}'}
 $engineRef=@{path='FrozenReadOnly'};$common=@{}
 foreach($case in @('current','cleanupFailed','legacy','later')){$EngineGeneration=if($case-ceq'legacy'){'Legacy'}else{'CurrentB142Rehearsal'};$script:preflightFails=$case-cne'later';$script:cleanupFails=$case-ceq'cleanupFailed';$script:cleanups=0;$script:events=@();$reason=$null
 try{${block};if($case-ceq'later'){throw 'AMBIGUOUS_ADAPTER_FAILURE'}}catch{$reason=$_.Exception.Message}
 if($case-ceq'later'){if($reason-cne'AMBIGUOUS_ADAPTER_FAILURE'-or$script:cleanups-ne0-or$script:events.Count-ne0){throw 'LATER_CLEANUP_LEAK'}}elseif($case-ceq'legacy'){if($reason-cne'P03_PHYSICAL_REHEARSAL_CONFIG_SCOPE'-or$script:cleanups-ne0-or$script:events.Count-ne0){throw 'LEGACY_CHANGED'}}else{if($reason-cne'P03_PHYSICAL_REHEARSAL_CONFIG_SCOPE'-or$script:cleanups-ne1-or$script:events[0]-cne'CURRENT_PREFLIGHT_READONLY_FAILED'){throw 'ORIGINAL_REASON_LOST'};$last=if($case-ceq'cleanupFailed'){'CURRENT_PREFLIGHT_CLEANUP_FAILED'}else{'CURRENT_PREFLIGHT_CLEANUP_COMPLETE'};if($script:events[-1]-cne$last){throw 'WRONG_JOURNAL'}}};'READONLY_PREFLIGHT_4_BOUNDARIES_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(program,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/READONLY_PREFLIGHT_4_BOUNDARIES_PASS/);
});
