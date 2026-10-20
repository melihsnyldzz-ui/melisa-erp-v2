import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const engine=fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url));
const q=s=>"'"+s.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
const extract=names=>`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(engine)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};${names.map(n=>`$f=@($ast.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq${q(n)}},$true));if($f.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($f[0].Extent.Text));`).join('')}`;
const functions=extract(['Need','Hash','FailureDiagnostic','WriteOldReuseFailureRecord','AssertOldPidLifetimes','IsWatcherCommand']);
function run(code){const wrapper=Buffer.from('$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))','utf16le').toString('base64');return execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-EncodedCommand',wrapper],{input:"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n"+code,encoding:'utf8',timeout:15000,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PSModulePath:String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\Modules`}}).trim();}
const fixture=String.raw`
$ProfilePath='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-11111111111111111111111111111111\profile.json';$BeforeImagePath='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-11111111111111111111111111111111\before.json';$Mode='StopNew';$Environment='Rehearsal';$isRehearsal=$true;$ProfileSha256='a'*64;$BeforeImageSha256='b'*64;$CandidateSha256='c'*64
$before=[pscustomobject]@{copyId='different';identities=[pscustomobject]@{erpApi=[pscustomobject]@{pid=42;creationTime='2026-10-20T01:02:03.1234567Z'}}}
$profile=[pscustomobject]@{oldWatchers=@();oldSettings=[pscustomobject]@{sha256='d'*64};newSettings=[pscustomobject]@{sha256='e'*64};protectedProcesses=@();packages=@();journalDirectory='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-11111111111111111111111111111111\recovery'}
$newSettings=[pscustomobject]@{components=[pscustomobject]@{erpApiNative=[pscustomobject]@{sourceCommit='f'*40}}}
$script:capturedCandidatePids=@(80);$script:saved=$null;$script:writtenTarget=$null;$script:protectedPath=$null;$script:writes=0;$script:reads=0;$script:trace=@();$script:failAt='';$script:seenInput=$null;$script:originalError=$null
$child=[pscustomobject]@{ProcessId=42;ParentProcessId=50;CreationDate=[DateTime]::Parse('2026-10-20T01:02:03.1234567Z');CommandLine='private-command-sentinel';ExecutablePath='C:\private-path-sentinel';OwnerSid='private-owner-sentinel';password='private-password-sentinel'}
$inventory=[pscustomobject]@{all=@($child);allListeners=@();instances=@();extra='private-extra-sentinel'}
$realText=(Get-Command WriteOldReuseFailureRecord).Definition
. ([scriptblock]::Create('function InvokeFixtureRecorder {'+$realText+'}'))
function WriteOldReuseFailureRecord($failure,$inputInventory,$row,$definition){$script:originalError=$failure;$script:seenInput=$inputInventory;InvokeFixtureRecorder $failure $inputInventory $row $definition}
function Protected($p){$script:protectedPath=$p;$script:trace+=,'PROTECTED';if($script:failAt-ceq'protected'){throw 'private-protected-error'}}
function WriteOldReuseFailureFile($p,$bytes){$script:trace+=,'WRITE';if($script:failAt-ceq'write'){throw 'private-write-error'};$script:writes++;$script:writtenTarget=$p;$script:saved=[byte[]]$bytes.Clone()}
function ReadPinned($p,$sha){$script:trace+=,'READBACK';if($script:failAt-ceq'readback'){throw 'private-readback-error'};$script:reads++;if((Hash $script:saved)-cne$sha){throw 'FIXTURE_HASH'};return ,$script:saved}
function Inventory{throw 'FIXTURE_LIVE_INVENTORY_FORBIDDEN'}
function Get-CimInstance{throw 'FIXTURE_LIVE_CIM_FORBIDDEN'}
function OldReusePin{throw 'FIXTURE_PHYSICAL_BOUNDARY'}
function OldReuseHold{throw 'FIXTURE_PHYSICAL_BOUNDARY'}
function NoReparse{throw 'FIXTURE_PHYSICAL_BOUNDARY'}
function Get-FileHash{throw 'FIXTURE_PHYSICAL_BOUNDARY'}
function Catch-Guard{
 try{AssertOldPidLifetimes $inventory;throw 'FIXTURE_ACCEPTED'}catch{
  if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw}
  if(-not[object]::ReferenceEquals($_.Exception,$script:originalError.Exception)){throw 'FIXTURE_ORIGINAL_REPLACED'}
  return $_
 }
}
`;
test('only additive error-record regions differ from frozen99b; runtime pin remains99b',()=>{
 const source=fs.readFileSync(engine,'utf8').replaceAll('\r\n','\n');
 const old=source.replace(/^# P03_FAILURE_RECORD_BEGIN\n[\s\S]*?^# P03_FAILURE_RECORD_END\n/gm,'');
 assert.equal(crypto.createHash('sha256').update(old).digest('hex'),'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def');
 assert.notEqual(crypto.createHash('sha256').update(source).digest('hex'),crypto.createHash('sha256').update(old).digest('hex'));
 assert.match(fs.readFileSync(new URL('./p03-rehearsal-harness.mjs',import.meta.url),'utf8'),/sha256:'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'/);
});
test('failure receives the exact same guard input; private projection binds PID/birth/role/phase and only hash enters outer diagnostic',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
$beforeImage=$inventory|ConvertTo-Json -Depth 8 -Compress;$err=Catch-Guard
if(-not[object]::ReferenceEquals($script:seenInput,$inventory)-or$beforeImage-cne($inventory|ConvertTo-Json -Depth 8 -Compress)){throw 'FIXTURE_INPUT_REPLACED'}
$p=[Text.Encoding]::UTF8.GetString($saved)|ConvertFrom-Json
if($p.trigger.pid-ne42-or$p.trigger.birth.utc-cne$child.CreationDate.ToUniversalTime().ToString('o')-or$p.trigger.roles[0]-cne'erpApi'-or$p.phase-cne'AssertOldPidLifetimes'-or$p.mode-cne'StopNew'-or$p.environment-cne'Rehearsal'){throw 'FIXTURE_CONTEXT'}
if($p.failure.code-cne'P03_PHYSICAL_OLD_REUSE_SCOPE'-or$writes-ne1-or$reads-ne1-or($trace-join',')-cne'PROTECTED,WRITE,READBACK'){throw 'FIXTURE_ORDER'}
$outer=FailureDiagnostic $err;if($outer.oldPidFailureRecordSha256-cne(Hash $saved)-or$outer.Count-ne4){throw 'FIXTURE_REF'}
if([IO.Path]::GetDirectoryName($writtenTarget)-cne[IO.Path]::GetDirectoryName($ProfilePath)-or$writtenTarget.StartsWith($profile.journalDirectory,[StringComparison]::OrdinalIgnoreCase)-or$protectedPath-cne[IO.Path]::GetDirectoryName($ProfilePath)){throw 'FIXTURE_JOURNAL_POLLUTION'}
if($p.profileSha256-cne$ProfileSha256-or$p.beforeSha256-cne$BeforeImageSha256-or$p.candidateSha256-cne$CandidateSha256-or$p.capturedCandidatePids[0]-ne80-or-not$p.capturedCandidatePidsKnown){throw 'FIXTURE_HASH_CONTEXT'}
if($p.fullGuardReplayAvailable-or$p.admissionGranted-or$p.stopAuthority-or$p.applyExecuted-or$p.inputOrigin-cne'SAME_ASSERT_ARGUMENT'){throw 'FIXTURE_AUTHORITY'}
if(-not$p.inventory.allKnown-or-not$p.inventory.allListenersKnown-or-not$p.inventory.instancesKnown-or$p.inventory.allListeners.Count-or$p.inventory.instances.Count){throw 'FIXTURE_EMPTY_UNKNOWN'}
'SAME_INPUT_PRIVATE_HASH_ONLY'
`);assert.equal(out,'SAME_INPUT_PRIVATE_HASH_ONLY');
});
test('recorder failure in ACL/write/readback preserves original exception and never attaches a success hash',windows,()=>{
 for(const failure of ['protected','write','readback']){
  const out=run(functions+'\n'+fixture+`\n$script:failAt='${failure}';$err=Catch-Guard;if($err.Exception.Message-cne'P03_PHYSICAL_OLD_REUSE_SCOPE'-or$err.Exception.Data.Contains('P03OldPidFailureRecordSha256')){throw 'FIXTURE_FAILURE_SWALLOWED'};'ORIGINAL_RETHROWN'`);assert.equal(out,'ORIGINAL_RETHROWN');
 }
});
test('guard birth rejection is unchanged and recorder does not rerun any guard or Inventory',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
$Environment='Shared';$ProfilePath='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-profile-11111111111111111111111111111111.json';$BeforeImagePath='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-before-11111111111111111111111111111111.json';$profile.journalDirectory='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-recovery-11111111111111111111111111111111';$isRehearsal=$false;$before.copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';$profile.oldSettings.sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071';$newSettings.components.erpApiNative.sourceCommit='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'
$err=Catch-Guard;if($err.Exception.Message-cne'P03_PHYSICAL_OLD_LIFETIME_PRESENT'-or$writes-ne1){throw 'FIXTURE_BIRTH_GATE'};'BIRTH_REJECTION_UNCHANGED'
`);assert.equal(out,'BIRTH_REJECTION_UNCHANGED');
});
test('missing observed birth, unknown role and malformed hash stay UNKNOWN; no sensitive input fields are serialized',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
$child.PSObject.Properties.Remove('CreationDate');$before.identities=[pscustomobject]@{'private-role-sentinel'=$before.identities.erpApi};$ProfileSha256='private-hash-sentinel'
$err=Catch-Guard;$json=[Text.Encoding]::UTF8.GetString($saved);$p=$json|ConvertFrom-Json
if($p.trigger.birth.status-cne'UNKNOWN'-or$p.trigger.birth.utc-ne$null-or$p.trigger.roles[0]-cne'UNKNOWN'-or$p.profileSha256-cne'UNKNOWN'){throw 'FIXTURE_MISSING_GUESSED'}
if($json-match'private-|CommandLine|ExecutablePath|OwnerSid|password'){throw 'FIXTURE_SECRET'}
$outer=FailureDiagnostic $err;if(($outer|ConvertTo-Json -Compress)-match'private-|trigger|inventory|path'){throw 'FIXTURE_PUBLIC_LEAK'};'UNKNOWN_AND_REDACTED'
`);assert.equal(out,'UNKNOWN_AND_REDACTED');
});
test('invalid PID and missing inventory property remain explicit unknown without empty-array invention',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
$child.PSObject.Properties.Remove('ProcessId');$inventory.PSObject.Properties.Remove('instances');$err=Catch-Guard;$p=[Text.Encoding]::UTF8.GetString($saved)|ConvertFrom-Json
if($p.trigger.pid-ne$null-or$p.trigger.roles.Count-or$p.inventory.all[0].ProcessId-ne$null-or$p.inventory.instancesKnown){throw 'FIXTURE_UNKNOWN_ID'};'UNKNOWN_PID'
`);assert.equal(out,'UNKNOWN_PID');
});
test('snapshot bounds refuse the record without truncating input or replacing original refusal',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
$inventory.all=@(1..8193|ForEach-Object{$child});$err=Catch-Guard
if($err.Exception.Message-cne'P03_PHYSICAL_OLD_REUSE_SCOPE'-or$writes-or$err.Exception.Data.Contains('P03OldPidFailureRecordSha256')){throw 'FIXTURE_BOUNDS_SUCCESS'};'BOUNDED_ORIGINAL'
`);assert.equal(out,'BOUNDED_ORIGINAL');
});
test('invalid/foreign run routes and observer modes never write a private artifact or alter original rejection',windows,()=>{
 for(const mutate of ["$ProfilePath='C:\\other\\profile.json'", "$BeforeImagePath='C:\\other\\before.json'", "$profile.journalDirectory='C:\\other\\recovery'", "$Mode='Observe'"]){
  const out=run(functions+'\n'+fixture+`\n${mutate};$err=Catch-Guard;if($writes-or$trace.Count-or$err.Exception.Message-cne'P03_PHYSICAL_OLD_REUSE_SCOPE'-or$err.Exception.Data.Contains('P03OldPidFailureRecordSha256')){throw 'FIXTURE_FOREIGN_WRITE'};'ROUTE_REJECTED'`);assert.equal(out,'ROUTE_REJECTED');
 }
});
test('unknown captured PID cache is not invented as a verified empty cache',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
Remove-Variable capturedCandidatePids -Scope Script;$err=Catch-Guard;$p=[Text.Encoding]::UTF8.GetString($saved)|ConvertFrom-Json
if($p.capturedCandidatePidsKnown-or$p.capturedCandidatePids.Count){throw 'FIXTURE_CACHE_GUESSED'};'UNKNOWN_CACHE'
`);assert.equal(out,'UNKNOWN_CACHE');
});
test('null snapshot fields/cache stay unknown while actual empty arrays stay known',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
$inventory=[pscustomobject]@{all=$null;allListeners=$null;instances=$null};$script:capturedCandidatePids=$null
try{throw 'P03_PHYSICAL_OLD_REUSE_SCOPE'}catch{$err=$_}
WriteOldReuseFailureRecord $err $inventory $null 'offline-fixture';$p=[Text.Encoding]::UTF8.GetString($saved)|ConvertFrom-Json
if($p.inventory.allKnown-or$p.inventory.allListenersKnown-or$p.inventory.instancesKnown-or$p.capturedCandidatePidsKnown-or$p.capturedCandidatePids.Count){throw 'FIXTURE_NULL_AS_EMPTY'}
$inventory=[pscustomobject]@{all=@();allListeners=@();instances=@()};$script:capturedCandidatePids=@()
WriteOldReuseFailureRecord $err $inventory $null 'offline-fixture';$p=[Text.Encoding]::UTF8.GetString($saved)|ConvertFrom-Json
if(-not$p.inventory.allKnown-or-not$p.inventory.allListenersKnown-or-not$p.inventory.instancesKnown-or-not$p.capturedCandidatePidsKnown-or$p.capturedCandidatePids.Count){throw 'FIXTURE_EMPTY_AS_NULL'};'NULL_EMPTY_DISTINCT'
`);assert.equal(out,'NULL_EMPTY_DISTINCT');
});
test('birth/culture evidence uses guard Parse semantics and preserves seven fractional digits',windows,()=>{
 const out=run(functions+'\n'+fixture+String.raw`
[Threading.Thread]::CurrentThread.CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo('tr-TR');$before.identities.erpApi.creationTime='01/02/2026'
$err=Catch-Guard;$p=[Text.Encoding]::UTF8.GetString($saved)|ConvertFrom-Json
if($p.culture-cne'tr-TR'-or$p.expected[0].birth.utc-cne[DateTime]::Parse('01/02/2026').ToUniversalTime().ToString('o')-or$p.trigger.birth.utc-cnotmatch'\.1234567Z$'){throw 'FIXTURE_TIME'};'EXACT_TIME_CONTEXT'
`);assert.equal(out,'EXACT_TIME_CONTEXT');
});
test('outer failure metadata rejects arbitrary artifact references and raw exception text',windows,()=>{
 const out=run(extract(['FailureDiagnostic'])+String.raw`
try{throw 'private-outer-sentinel'}catch{$err=$_}
$err.Exception.Data['P03OldPidFailureRecordSha256']='private-path-sentinel';$d=FailureDiagnostic $err
if($d.Count-ne3-or$d.code-cne'P03_PHYSICAL_UNCLASSIFIED'-or($d|ConvertTo-Json -Compress)-match'private-'){throw 'FIXTURE_OUTER_LEAK'};'SAFE_OUTER'
`);assert.equal(out,'SAFE_OUTER');
});
test('actual private file writer creates owner/SYSTEM-only protected ACL, refuses overwrite and retains original bytes',windows,()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p03-failure-record-'));const target=path.join(dir,'record.json');
 try{
  const out=run(extract(['WriteOldReuseFailureFile'])+`\n$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$target=${q(target)};WriteOldReuseFailureFile $target ([byte[]]@(1,2,3));$acl=Get-Acl -LiteralPath $target;if(-not$acl.AreAccessRulesProtected-or$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$owner-or@($acl.Access).Count-ne2){throw 'FIXTURE_ACL'};foreach($a in $acl.Access){if($a.IsInherited-or$a.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value-cnotin@($owner,'S-1-5-18')-or$a.FileSystemRights-ne[Security.AccessControl.FileSystemRights]::FullControl){throw 'FIXTURE_ACE'}};try{WriteOldReuseFailureFile $target ([byte[]]@(9));throw 'FIXTURE_OVERWRITE'}catch{if($_.Exception.Message-ceq'FIXTURE_OVERWRITE'){throw}};if(([IO.File]::ReadAllBytes($target)-join',')-cne'1,2,3'){throw 'FIXTURE_BYTES'};'PRIVATE_CREATE_NEW'`);
  assert.equal(out,'PRIVATE_CREATE_NEW');assert.deepEqual(fs.readFileSync(target),Buffer.from([1,2,3]));
 }finally{if(fs.existsSync(target))fs.unlinkSync(target);fs.rmdirSync(dir);}
});
