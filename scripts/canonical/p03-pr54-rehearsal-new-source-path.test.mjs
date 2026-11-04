import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-b264-new-owner-recovery.ps1',import.meta.url));
const q=s=>"'"+s.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
function run(code){return execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest; $env:PSModulePath=Join-Path $PSHOME 'Modules'; foreach($m in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\\'+$m+'\\'+$m+'.psd1')) -ErrorAction Stop}\n${code}`,encoding:'utf8',windowsHide:true,timeout:15000});}
const load=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};foreach($name in @('Require-NewDrain','Read-B264Source')){$f=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq$name},$true));if($f.Count-ne1){throw 'FUNCTION'};. ([scriptblock]::Create($f[0].Extent.Text))}`;
const rejects=String.raw`function Reject([scriptblock]$f){try{&$f|Out-Null}catch{return};throw 'EXPECTED_REJECT'}`;
test('actual PS5 initializer binds sources to exact engine run before the genuine reader is called',windows,()=>{
 const out=run(load+String.raw`
 $f=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Initialize-B264Recovery'},$true))[0]
 $branch=$f.Body.EndBlock.Statements[0].Clauses[0].Item2.Statements
 if($branch[0].Extent.Text-notmatch'REHEARSAL_ENTRY'-or$branch[2].Extent.Text-notmatch'REHEARSAL_SOURCE_ROOT'-or$branch[3].Extent.Text-cne'$script:base=$rehearsalSourceRoot'-or$branch[4].Extent.Text-notmatch'Read-B264Source'){throw 'ORDER'}
 $gate=[scriptblock]::Create((@($branch[0..3]|ForEach-Object{$_.Extent.Text})-join[Environment]::NewLine))
 function ResetPath{$script:owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$script:base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:root='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-'+('1'*32);$script:EnginePath=Join-Path $root 'recovery-engine.ps1';$script:EmptyRecoveryPath=Join-Path $root 'p03-pr54-new-owner-empty-recovery.ps1';$script:DrainerPath=Join-Path $root 'p03-pr54-successor-core-drain.ps1'}
 $pin=[regex]::Match($branch[0].Extent.Text,"DrainerSha256-ceq'([a-f0-9]{64})'").Groups[1].Value;if($pin.Length-ne64){throw 'PIN'};$DrainerSha256=$pin
 ResetPath;&$gate;if($script:base-cne$root){throw 'BOUND_ROOT'}
`+rejects+String.raw`
 foreach($case in @('shared','otherroot','wrongrun','emptyleaf','drainerleaf','emptyother','drainerother','nested','enginename')){
  ResetPath;switch($case){
   'shared'{$EnginePath='C:\Sirket\ERP\runtime\P03-OWNER-20261018\recovery-engine.ps1'}
   'otherroot'{$EnginePath=$EnginePath.Replace('P03-RECOVERY-20261018','OTHER')}
   'wrongrun'{$EnginePath=$EnginePath.Replace('run-'+('1'*32),'run-not-hex')}
   'emptyleaf'{$EmptyRecoveryPath=Join-Path $root 'other.ps1'}
   'drainerleaf'{$DrainerPath=Join-Path $root 'other.ps1'}
   'emptyother'{$EmptyRecoveryPath=$EmptyRecoveryPath.Replace('run-'+('1'*32),'run-'+('2'*32))}
   'drainerother'{$DrainerPath=$DrainerPath.Replace('run-'+('1'*32),'run-'+('2'*32))}
   'nested'{$DrainerPath=Join-Path $root 'nested\p03-pr54-successor-core-drain.ps1'}
   'enginename'{$EnginePath=Join-Path $root 'other.ps1'}
  };Reject {&$gate};if($script:base-cne'C:\Sirket\ERP\runtime\P03-OWNER-20261018'){throw 'BASE_CHANGED_ON_REJECT'}
 };'PASS'
`);assert.match(out,/PASS/);
});
test('genuine source reader hashes private temporary files and preserves ACL/hash/root/leaf rejection',windows,()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'p03-rehearsal-new-source-'));
 const real=fs.realpathSync.native(temp),root=path.join(real,'run-'+'1'.repeat(32));
 fs.mkdirSync(root);const leaves=['recovery-engine.ps1','p03-pr54-new-owner-empty-recovery.ps1','p03-pr54-successor-core-drain.ps1'];
 for(const leaf of leaves)fs.writeFileSync(path.join(root,leaf),`# synthetic ${leaf}\n`);
 try{
  const out=run(load+rejects+`
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$base=${q(root)}
$leaves=@(${leaves.map(q).join(',')})
foreach($leaf in $leaves){$file=Join-Path $base $leaf;$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false);foreach($sid in @($owner,'S-1-5-18')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))};Set-Acl -LiteralPath $file -AclObject $acl;$sha=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();$read=Read-B264Source $file $sha $leaf;if([Text.Encoding]::UTF8.GetString($read)-cne[IO.File]::ReadAllText($file)){throw 'BYTES'};Reject {Read-B264Source $file ('0'*64) $leaf};Reject {Read-B264Source $file $sha 'wrong.ps1'};Reject {Read-B264Source (Join-Path ${q(real)} $leaf) $sha $leaf}}
$file=Join-Path $base 'bad-acl.ps1';[IO.File]::WriteAllText($file,'# inherited ACL');$sha=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();Reject {Read-B264Source $file $sha 'bad-acl.ps1'};'PASS'
`);assert.match(out,/PASS/);
 }finally{
  const actual=fs.realpathSync.native(temp),parent=fs.realpathSync.native(os.tmpdir()),relative=path.relative(parent,actual);
  assert.equal(actual.toLowerCase(),real.toLowerCase());assert.equal(fs.lstatSync(temp).isSymbolicLink(),false);assert.equal(path.dirname(relative),'.');assert.match(path.basename(relative),/^p03-rehearsal-new-source-/);assert.equal(fs.lstatSync(actual).isSymbolicLink(),false);assert.notEqual(actual,path.parse(actual).root);fs.rmSync(actual,{recursive:true});
 }
});

test('finite Rehearsal importer selects only three direct worker definitions from genuine pinned current source',windows,()=>{
 const drainer=fileURLToPath(new URL('./p03-pr54-successor-core-drain.ps1',import.meta.url));
 const out=run(load+rejects+`
$f=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Import-B264Definitions'},$true))[0];. ([scriptblock]::Create($f.Extent.Text))
function Hash($b){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant()}
$bytes=[IO.File]::ReadAllBytes(${q(drainer)});$script:DrainerSha256=Hash $bytes;$script:PolicyGeneration='CurrentB142Rehearsal'
$names=@('AssertCurrentB142RehearsalContract','AssertCurrentB142RehearsalClaim','AssertCurrentB142RehearsalFiles')
Import-B264Definitions $bytes $names @{} -CurrentRehearsalDrainer
foreach($name in $names){if(@(Get-Command $name -CommandType Function -ErrorAction Stop).Count-ne1){throw 'MISSING'}}
if(Get-Command Need -CommandType Function -ErrorAction SilentlyContinue){throw 'EXTRA_IMPORTED'}
$body=[Text.Encoding]::UTF8.GetString($bytes)
foreach($case in @('duplicate','wrapper','name','alias','hash','policy','nested')){
 $script:PolicyGeneration='CurrentB142Rehearsal';$testNames=$names;$aliases=@{};$changed=$body
 switch($case){
 'duplicate'{$changed=$body.Replace('function AssertCurrentB142RehearsalContract(', 'function AssertCurrentB142RehearsalClaim(){};function AssertCurrentB142RehearsalContract(')}
 'wrapper'{$changed=$body.Replace('function InvokeP03SuccessorWorker','function OtherWorker')}
 'name'{$testNames=@('AssertCurrentB142RehearsalContract','AssertCurrentB142RehearsalClaim','Need')}
 'alias'{$aliases=@{AssertCurrentB142RehearsalContract='Other'}}
 'policy'{$script:PolicyGeneration='CurrentB007'}
 'nested'{$changed=$body.Replace('function AssertCurrentB142RehearsalContract(', 'function ExtraNested{function AssertCurrentB142RehearsalContract(').Replace('function AssertCurrentB142RehearsalFiles(', '} function AssertCurrentB142RehearsalFiles(')}
 }
 $testBytes=[Text.Encoding]::UTF8.GetBytes($changed);$script:DrainerSha256=if($case-ceq'hash'){'0'*64}else{Hash $testBytes}
 Reject {Import-B264Definitions $testBytes $testNames $aliases -CurrentRehearsalDrainer}
};'PASS'
`);assert.match(out,/PASS/);
});

test('held-core identity uses the same exact six-microsecond representation as frozen recovery',windows,()=>{
 const out=run(load+rejects+String.raw`
$f=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Current-NewDrainFrame'},$true))[0];. ([scriptblock]::Create($f.Extent.Text))
function Assert-NewDrainPins{}
function Complete-B264CoreCut{}
function CandidateInventory($evidence){return [pscustomobject]@{inventory=[pscustomobject]@{all=@()};selected=@()}}
function Assert-NewDrainOldAbsent($inv){}
$script:newGone=@();$script:newEvidence=[pscustomobject]@{};$script:newCore=[pscustomobject]@{pid=32864;creationTime='2026-10-22T01:53:05.8456350Z'}
$script:newCoreHandle=[pscustomobject]@{Id=32864;StartTime=[DateTime]::Parse('2026-10-22T01:53:05.8456354Z')}
Current-NewDrainFrame|Out-Null
$script:newCoreHandle.StartTime=[DateTime]::Parse('2026-10-22T01:53:05.8456359Z');Current-NewDrainFrame|Out-Null
$script:newCoreHandle.StartTime=[DateTime]::Parse('2026-10-22T01:53:05.8456360Z');Reject {Current-NewDrainFrame}
$script:newCoreHandle.StartTime=[DateTime]::Parse('2026-10-22T01:53:05.8456349Z');Reject {Current-NewDrainFrame}
$script:newCoreHandle.StartTime=[DateTime]::Parse('2026-10-22T01:53:05.8456354Z');$script:newCoreHandle.Id=32865;Reject {Current-NewDrainFrame};'PASS'
`);assert.match(out,/PASS/);
});

test('actual publish body bridges exact Rehearsal candidate to frozen admission and keeps other policy shapes',windows,()=>{
 const engine=fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url));
 const out=run(load+rejects+String.raw`
$f=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Publish-B264Empty'},$true))[0];. ([scriptblock]::Create($f.Extent.Text))
$t=$null;$e=$null;$ea=[Management.Automation.Language.Parser]::ParseFile(${q(engine)},[ref]$t,[ref]$e);$f=@($ea.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'AdmitCandidate'},$true))[0];. ([scriptblock]::Create($f.Extent.Text))
function Need($value,$code){if(-not$value){throw ('FROZEN_'+$code)}}
function Current-NewDrainFrame{return [pscustomobject]@{inventory=[pscustomobject]@{all=@()};selected=@()}}
function AssertEmpty($inventory){}
function Save-NewDrain($file,$value){if($script:exists){throw 'OUTPUT_EXISTS'};$script:savedPath=$file;$script:savedValue=$value;return [ordered]@{path=$file;sha256=('a'*64)}}
function Record-NewDrain($event,$ref){if($event-cne'NEW_DRAIN_EMPTY'){throw 'EVENT'};return [ordered]@{path='tail';sha256=('b'*64)}}
function Json($value){return $script:savedValue}
function ReadPinned($file,$sha){if($file-cne$savedPath-or$sha-cne('a'*64)){throw 'REF'};return [byte[]]@(1)}
$script:base='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-'+('1'*32);$script:runRoot=$base;$script:names=@('Core','Hub');$script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($n);return [pscustomobject]@{State=3}}
$script:ProfileSha256='profile';$script:BeforeImageSha256='before';$script:b264Mutated=$true;$script:exists=$false;$script:isRehearsal=$true
$script:PolicyGeneration='CurrentB142Rehearsal';$result=Publish-B264Empty
if($result.candidateRef.path-cne(Join-Path $base 'candidate.json')-or$savedValue.environment-cne'P03_REHEARSAL'){throw 'BRIDGE'}
$script:CandidatePath=$result.candidateRef.path;$script:CandidateSha256=$result.candidateRef.sha256;$script:invokedAtUtc=[DateTime]::UtcNow
$accepted=AdmitCandidate;if($accepted.processes.Count-ne0-or$accepted.receipts.Count-ne0){throw 'NOT_ZERO'}
foreach($case in @('path','environment','schema','profile','before','count','old','future')){
 $script:exists=$false;$result=Publish-B264Empty;$script:CandidatePath=$result.candidateRef.path;$script:invokedAtUtc=[DateTime]::UtcNow
 switch($case){'path'{$CandidatePath=Join-Path $base 'MelisaERP-P03-candidate-wrong.json'};'environment'{$savedValue.Remove('environment')};'schema'{$savedValue.schemaVersion='wrong'};'profile'{$savedValue.profileSha256='wrong'};'before'{$savedValue.beforeSha256='wrong'};'count'{$savedValue.processes=@(1..11)};'old'{$savedValue.observedAt=[DateTime]::UtcNow.AddMinutes(-2).ToString('o')};'future'{$savedValue.observedAt=[DateTime]::UtcNow.AddMinutes(1).ToString('o')}}
 Reject {AdmitCandidate}
}
$script:exists=$true;Reject {Publish-B264Empty};$script:exists=$false
foreach($policy in @('LegacyB264','B264Sup20D','CurrentB007','Foreign')){$script:PolicyGeneration=$policy;$result=Publish-B264Empty;if([IO.Path]::GetFileName($result.candidateRef.path)-cnotmatch'^MelisaERP-P03-candidate-[a-f0-9]{32}\.json$'-or$savedValue.Contains('environment')){throw 'SHARED_CHANGED'}};'PASS'
`);assert.match(out,/PASS/);
});
test('genuine Save-NewDrain refuses existing candidate bytes without overwrite',windows,()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'p03-rehearsal-new-source-')),real=fs.realpathSync.native(temp),target=path.join(real,'candidate.json');fs.writeFileSync(target,'existing immutable candidate');
 try{
  const empty=fileURLToPath(new URL('./p03-pr54-new-owner-empty-recovery.ps1',import.meta.url));
  const out=run(load+`
$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(empty)},[ref]$t,[ref]$e);$f=@($a.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Save-NewDrain'},$true))[0];. ([scriptblock]::Create($f.Extent.Text))
function NoReparse($p){if($p-cne${q(real)}){throw 'PARENT'}}
try{Save-NewDrain ${q(target)} ([ordered]@{value=1})|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-cne'P03_NEW_DRAIN_OUTPUT_EXISTS'){throw}};'PASS'
`);assert.match(out,/PASS/);assert.equal(fs.readFileSync(target,'utf8'),'existing immutable candidate');
 }finally{const actual=fs.realpathSync.native(temp),parent=fs.realpathSync.native(os.tmpdir()),rel=path.relative(parent,actual);assert.equal(actual.toLowerCase(),real.toLowerCase());assert.equal(path.dirname(rel),'.');assert.match(path.basename(rel),/^p03-rehearsal-new-source-/);assert.equal(fs.lstatSync(temp).isSymbolicLink(),false);assert.notEqual(actual,path.parse(actual).root);fs.rmSync(actual,{recursive:true});}
});
