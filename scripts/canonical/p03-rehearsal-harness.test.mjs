import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseP03RehearsalMode} from './p03-rehearsal-harness.mjs';
import {validateRehearsalFixtureArgs,REHEARSAL_PORTS} from './p03-rehearsal-fixture.mjs';

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
 const command=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
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
 const command=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);$trap=$a.EndBlock.Traps[0].Extent.Text;. ([scriptblock]::Create($trap+[Environment]::NewLine+"throw 'P03_REHEARSAL_CONTROLLED_REFUSAL'"))`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/^P03_REHEARSAL_CONTROLLED_REFUSAL TYPE_[A-Za-z]+ METHOD_[A-Za-z]+ LINE_\d+\r?\n$/);assert.doesNotMatch(result.stderr,/CLIXML|At line|CategoryInfo/);
});

test('wrapped physical-engine refusal retains only the fixed inner P03 code',{skip:process.platform!=='win32'},()=>{
 const file=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);$trap=$a.EndBlock.Traps[0].Extent.Text;. ([scriptblock]::Create($trap+[Environment]::NewLine+"throw [InvalidOperationException]::new('wrapped action: P03_PHYSICAL_ACL private-sentinel-value')"))`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/^P03_PHYSICAL_ACL TYPE_[A-Za-z]+ METHOD_[A-Za-z]+ LINE_\d+\r?\n$/);assert.doesNotMatch(result.stderr,/private-sentinel-value|wrapped action|CLIXML/);
});
