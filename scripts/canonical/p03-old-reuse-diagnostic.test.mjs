import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-old-reuse-diagnostic.psm1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url));
const frozenNoReparse="function NoReparse([string]$path){for($part=[IO.Path]::GetFullPath($path);$part;$part=[IO.Path]::GetDirectoryName($part)){$item=Get-Item -LiteralPath $part -Force;Need (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE'}}",fileAttributesNoReparse="function NoReparse([string]$path){for($part=[IO.Path]::GetFullPath($path);$part;$part=[IO.Path]::GetDirectoryName($part)){Need (([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE'}}";
function reconstructFrozenEngine(source){
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 assert.equal(sha(source),'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f');
 assert.equal(source.split(fileAttributesNoReparse).length-1,1);
 const failureRecordSource=source.replace(fileAttributesNoReparse,frozenNoReparse);
 assert.equal(sha(failureRecordSource),'1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054');
 const regions=/^# P03_FAILURE_RECORD_BEGIN\n[\s\S]*?^# P03_FAILURE_RECORD_END\n/gm;
 assert.equal([...failureRecordSource.matchAll(regions)].length,4);
 const frozen=failureRecordSource.replace(regions,'');
 assert.equal(sha(frozen),'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def');
 return {failureRecordSource,frozen};
}
const windows={skip:process.platform!=='win32'};
const fixture=String.raw`
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
function New-Fixture{
 $script:ctx=[pscustomobject]@{
  before=[pscustomobject]@{copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';identities=[pscustomobject]@{erpApi=[pscustomobject]@{pid=42;creationTime='2026-10-18T00:00:00Z'}}}
  profile=[pscustomobject]@{oldWatchers=@();protectedProcesses=@();packages=@([pscustomobject]@{root='C:\synthetic-candidate'}) ;oldSettings=[pscustomobject]@{sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'}}
  newSettings=[pscustomobject]@{components=[pscustomobject]@{erpApiNative=[pscustomobject]@{sourceCommit='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'}}}
  isRehearsal=$false;capturedCandidatePids=@()
 }
 $script:child=[pscustomobject]@{ProcessId=42;ParentProcessId=50;CreationDate=[DateTime]::Parse('2026-10-19T00:00:00Z').ToUniversalTime();ExecutablePath='C:\private-sentinel\secret.exe';CommandLine='secret-argv-sentinel'}
 $script:parent=[pscustomobject]@{ProcessId=50;ParentProcessId=0;CreationDate=[DateTime]::Parse('2026-10-17T00:00:00Z').ToUniversalTime();CommandLine='unrelated'}
 $script:inv=[pscustomobject]@{all=@($child,$parent);allListeners=@();instances=@()}
}
New-Fixture
`;
function run(body,moduleSource=source){
 const cmd=`Import-Module '${moduleSource.replaceAll("'","''")}' -Force\n${fixture}\n${body}\n$result|ConvertTo-Json -Depth 12 -Compress`;
 const wrapper=Buffer.from('$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))','utf16le').toString('base64');
 return JSON.parse(execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-EncodedCommand',wrapper],{input:cmd,encoding:'utf8',timeout:15000,windowsHide:true,stdio:['pipe','pipe','pipe']}));
}
function safe(result){
 assert.equal(result.kind,'P03_OLD_REUSE_OFFLINE_DIAGNOSTIC');
 for(const key of ['admissionGranted','stopAuthority','applyExecuted'])assert.equal(result[key],false);
 assert.equal(result.physicalChecks,'NOT_EVALUATED');
 assert.doesNotMatch(JSON.stringify(result),/private-sentinel|secret-argv|secret\.exe/);
}
test('explicit NoReparse and failure-record deltas recover sealed1b then exact frozen99b; diagnostic labels current source honestly',()=>{
 reconstructFrozenEngine(fs.readFileSync(engine,'utf8').replaceAll('\r\n','\n'));
 const text=fs.readFileSync(source,'utf8');
 assert.match(text,/AssertOldPidLifetimes','IsWatcherCommand/);
 assert.doesNotMatch(text,/Get-CimInstance|Invoke-CimMethod|Get-NetTCPConnection|GetProcessById|Start-Process|Stop-Process|ScheduledTask|New-Object.*ComObject|SqlConnection|WriteAll|Set-Content/);
});
test('scope rejection identifies supplied PID and role before birth and preserves original gate order',windows,()=>{
 const r=run('$ctx.isRehearsal=$true;$child.CreationDate=[DateTime]::Parse($ctx.before.identities.erpApi.creationTime);$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.rejectingGuard,'OLD_REUSE_SCOPE');assert.equal(r.rehearsal,true);assert.equal(r.observed.pid,42);
 assert.equal(r.expected[0].role,'erpApi');assert.equal(r.expected[0].pid,42);assert.equal(r.observed.birth.utc,r.expected[0].birth.utc);
 assert.deepEqual(r.checks,[{guard:'OLD_REUSE_SCOPE',accepted:false}]);
 assert.ok(r.predicateOrder.indexOf('OLD_REUSE_SCOPE')<r.predicateOrder.indexOf('OLD_LIFETIME_PRESENT'));
});
test('same old lifetime still live is rejected by actual birth guard',windows,()=>{
 const r=run('$child.CreationDate=[DateTime]::Parse($ctx.before.identities.erpApi.creationTime);$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.rejectingGuard,'OLD_LIFETIME_PRESENT');assert.equal(r.checks.at(-1).accepted,false);assert.equal(r.expectedIdentityStatus,'SINGLE_SUPPLIED_PIN');
});
test('same PID with later birth reaches explicit offline boundary, never physical admission',windows,()=>{
 const r=run('$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.status,'OFFLINE_BOUNDARY');assert.equal(r.rejectingGuard,null);assert.equal(r.sourceRevision,'FILE_ATTRIBUTES_V1_FAILURE_RECORD_SOURCE');assert.equal(r.sourceSha256,'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f');assert.notEqual(r.sourceSha256,'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def');
 assert.ok(r.checks.some(x=>x.guard==='OLD_LIFETIME_PRESENT'&&x.accepted));
 assert.ok(r.checks.some(x=>x.guard==='OLD_REUSE_NEW_LIFETIME'&&x.accepted));
 assert.ok(!r.checks.some(x=>x.guard==='OLD_REUSE_IDENTITY'||x.guard==='OLD_REUSE_IMAGE'));
});
test('absent PID is absence in supplied snapshot, not historical lifetime proof',windows,()=>{
 const r=run('$inv.all=@($parent);$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.status,'NO_OLD_PID_OBSERVED');assert.equal(r.triggerKnown,false);assert.equal(r.expectedIdentityStatus,'UNKNOWN');assert.equal(r.suppliedOldPidRows,0);assert.deepEqual(r.checks,[]);
});
test('missing expected birth remains missing and fails the original guard',windows,()=>{
 const r=run('$ctx.before.identities.erpApi.PSObject.Properties.Remove("creationTime");$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.rejectingGuard,'OLD_LIFETIME_PRESENT');assert.equal(r.expected[0].birth.status,'MISSING');
});
test('missing or invalid observed birth is evaluation failure, not an invented scope or reuse rejection',windows,()=>{
 for(const mutate of ['$child.PSObject.Properties.Remove("CreationDate")',"$child.CreationDate='not-a-date'"]){
  const r=run(`${mutate};$result=Get-P03OldReuseDiagnostic $ctx $inv`);safe(r);
  assert.equal(r.status,'REJECTED');assert.equal(r.errorKind,'GUARD_EVALUATION_ERROR');assert.equal(r.rejectingGuard,null);assert.equal(r.observed.pid,42);
  assert.equal(r.observed.birth.status,mutate.includes('Remove')?'MISSING':'INVALID');assert.equal(r.checks.at(-1).guard,'OLD_REUSE_CANDIDATE');
 }
});
test('ambiguous expected lifetime pins are labelled, not silently selected or admitted',windows,()=>{
 const r=run('$ctx.profile.oldWatchers=@([pscustomobject]@{pid=42;creationTime="2026-10-17T00:00:00Z"});$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.expectedIdentityStatus,'AMBIGUOUS');assert.equal(r.expectedCount,2);assert.equal(r.expected.length,2);assert.equal(r.status,'OFFLINE_BOUNDARY');
});
test('ambiguous parent identity is rejected by original parent cardinality guard',windows,()=>{
 const r=run('$inv.all+=,$parent;$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.rejectingGuard,'OLD_REUSE_PARENT_DUPLICATE');assert.equal(r.status,'REJECTED');
});
test('wrong scope tuple and missing scope field never reach birth or OS boundary',windows,()=>{
 for(const mutation of ["$ctx.before.copyId='other'",'$ctx.profile.oldSettings.PSObject.Properties.Remove("sha256")']){
  const r=run(`${mutation};$result=Get-P03OldReuseDiagnostic $ctx $inv`);safe(r);
  assert.equal(r.status,'REJECTED');assert.ok(!r.checks.some(x=>x.guard==='OLD_LIFETIME_PRESENT'));
  if(mutation.includes('other'))assert.equal(r.rejectingGuard,'OLD_REUSE_SCOPE');
  else{assert.equal(r.rejectingGuard,null);assert.equal(r.errorKind,'GUARD_EVALUATION_ERROR');assert.equal(r.triggerKnown,false);assert.ok(r.missingInputs.includes('profile.oldSettings.sha256'));}
 }
});
test('missing expected PID and absent identity container are explicit unknown input, never matched by guess',windows,()=>{
 const r=run('$ctx.before.identities.erpApi.PSObject.Properties.Remove("pid");$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.status,'REJECTED');assert.equal(r.triggerKnown,false);assert.equal(r.expectedInvalidPidCount,1);assert.equal(r.errorKind,'GUARD_EVALUATION_ERROR');
 const other=run('$ctx.before.PSObject.Properties.Remove("identities");$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(other);
 assert.equal(other.status,'REJECTED');assert.equal(other.triggerKnown,false);assert.ok(other.missingInputs.includes('before.identities'));
});
test('linked listener and captured candidate are rejected before birth, preserving safety gates',windows,()=>{
 for(const [mutation,guard] of [['$inv.allListeners=@([pscustomobject]@{OwningProcess=42})','OLD_REUSE_LINKED'],['$ctx.capturedCandidatePids=@(42)','OLD_REUSE_CANDIDATE']]){
  const r=run(`${mutation};$result=Get-P03OldReuseDiagnostic $ctx $inv`);safe(r);assert.equal(r.rejectingGuard,guard);
 }
});
test('diagnostics are isolated across calls and bounded; raw commands and roles are never emitted',windows,()=>{
 const r=run('$ctx.before.identities=[pscustomobject]@{"secret-argv-sentinel"=$ctx.before.identities.erpApi};$ctx.isRehearsal=$true;$first=Get-P03OldReuseDiagnostic $ctx $inv;New-Fixture;$result=Get-P03OldReuseDiagnostic $ctx $inv;if($first.expected[0].role-cne"UNRECOGNIZED_ROLE"){throw "FIXTURE_ROLE"}');safe(r);assert.equal(r.status,'OFFLINE_BOUNDARY');
});
test('large supplied pin and candidate sets produce bounded evidence without truncating guard execution',windows,()=>{
 const r=run('$ctx.profile.oldWatchers=@(1..150|ForEach-Object{[pscustomobject]@{pid=42;creationTime="2026-10-17T00:00:00Z"}});$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(r);
 assert.equal(r.status,'OFFLINE_BOUNDARY');assert.equal(r.expectedCount,151);assert.equal(r.expected.length,8);assert.equal(r.expectedTruncated,true);assert.equal(r.checks.length,128);assert.equal(r.traceTruncated,true);
 const other=run('$ctx.isRehearsal=$true;$inv.all=@(1..20|ForEach-Object{$child});$result=Get-P03OldReuseDiagnostic $ctx $inv');safe(other);
 assert.equal(other.rejectingGuard,'OLD_REUSE_SCOPE');assert.equal(other.suppliedOldPidRows,20);assert.equal(other.suppliedCandidates.length,8);assert.equal(other.candidatesTruncated,true);
});
test('birth diagnostics use the frozen guard current-culture and local-time parsing semantics',windows,()=>{
 for(const value of ['01/02/2026','2026-02-01T12:34:56.1234567']){
  const r=run(`[Threading.Thread]::CurrentThread.CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo('tr-TR');$ctx.before.identities.erpApi.creationTime='${value}';$result=Get-P03OldReuseDiagnostic $ctx $inv;if($result.expected[0].birth.utc-cne[DateTime]::Parse($ctx.before.identities.erpApi.creationTime).ToUniversalTime().ToString('o')){throw 'FIXTURE_BIRTH_SEMANTICS'}`);safe(r);assert.equal(r.expected[0].birth.status,'SUPPLIED');
 }
});

test('offline diagnostic keeps frozen99b, sealed1b and FileAttributes source labels separate and rejects any unpinned source',windows,()=>{
 const text=fs.readFileSync(engine,'utf8').replaceAll('\r\n','\n'),{failureRecordSource,frozen}=reconstructFrozenEngine(text),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p03-offline-pin-')),moduleFile=path.join(dir,'p03-old-reuse-diagnostic.psm1'),engineFile=path.join(dir,'p03-physical-rollback-lifetime-v2.ps1');
 try{
  fs.copyFileSync(source,moduleFile);
  for(const [sourceText,sha,label]of [[frozen,'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def','FROZEN_99B'],[failureRecordSource,'1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054','FAILURE_RECORD_SOURCE'],[text,'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f','FILE_ATTRIBUTES_V1_FAILURE_RECORD_SOURCE']]){fs.writeFileSync(engineFile,sourceText);const r=run('$result=Get-P03OldReuseDiagnostic $ctx $inv',moduleFile);safe(r);assert.equal(r.sourceSha256,sha);assert.equal(r.sourceRevision,label);assert.equal(r.status,'OFFLINE_BOUNDARY');}
  fs.writeFileSync(engineFile,text+'\n# unpinned source delta\n');assert.throws(()=>run('$result=Get-P03OldReuseDiagnostic $ctx $inv',moduleFile),error=>String(error.stderr).includes('P03_DIAGNOSTIC_SOURCE_PIN'));
 }finally{for(const file of [engineFile,moduleFile])if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(dir);}
});
test('offline module source selector is a finite three-hash allowlist without runtime or configurable pin authority',()=>{
 const text=fs.readFileSync(source,'utf8'),gate=text.match(/if\(\$sha -cnotin @\(([^)]+)\)\)/);assert(gate);assert.deepEqual([...gate[1].matchAll(/[a-f0-9]{64}/g)].map(m=>m[0]),['99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def','1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054','b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f']);assert.doesNotMatch(text,/\$env:|SourceShaOverride|AllowedSource|SourcePathOverride/);
});
