import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const q=s=>"'"+s.replaceAll("'","''")+"'";
function run(body){
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir());
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'erp-readpair-errors-')));
 try{
  const file=path.join(temp,'error-chain.ps1');
  fs.writeFileSync(file,`$ErrorActionPreference='Stop';. ${q(path.join(import.meta.dirname,'install-business-5244-readpair.ps1'))} -Library;\n${fixture}\n${body}`);
  return cp.execFileSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
 }finally{
  const full=fs.realpathSync.native(temp);
  assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());
  assert(path.basename(full).startsWith('erp-readpair-errors-'));
  assert(!fs.lstatSync(full).isSymbolicLink());
  fs.rmSync(full,{recursive:true,force:true});
 }
}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
test('both executable installer catches retain the primary catch rethrow after sanitized receipt handling',()=>{
 const source=fs.readFileSync(path.join(import.meta.dirname,'install-business-5244-readpair.ps1'),'utf8');
 assert.equal(source.split('catch{$primaryInstallFailure=$_;Write-ReadPairInstallFailureReceipt $primaryInstallFailure;throw}').length-1,2);
 assert.doesNotMatch(source,/throw \$result\.failure/);
 assert.match(source,/\}catch\{\$b6SourcePrimaryFailure=\$_;throw\}finally\{\s*Close-B6ReadPairSourceResources \$b6SourcePrimaryFailure\s*\}/);
});
const fixture=String.raw`
$result=[ordered]@{failure=$null};$calls=[Collections.Generic.List[string]]::new()
function Open-ReadPairPublication{$calls.Add('open')}
function Assert-ReadPairColdTarget{$calls.Add('target')}
function Stop-ReadPairColdOwner{$calls.Add('stop')}
function Start-ReadPairPreparedOwner{$calls.Add('start')}
function Assert-ReadPairPreparedOwner{$calls.Add('ready')}
function Send-ReadPairSingleRetire{$calls.Add('retire')}
function Wait-ReadPairFinalState{$calls.Add('wait');return 'CandidateVerified'}
function Complete-ReadPairPublication($Outcome){$calls.Add($Outcome)}
function Restore-ReadPairBeforeRetire([bool]$OldStopped){$calls.Add('restore:'+ $OldStopped)}
function Close-ReadPairPublication{$calls.Add('close')}
function Record-Phase($Phase){$calls.Add($Phase)}
function Fail-Primary{try{throw 'secret-primary /query?credential=sentinel'}catch{$script:original=$_;throw}}
function Assert-Original($Caught){if(![object]::ReferenceEquals($Caught.Exception,$script:original.Exception)-or$Caught.FullyQualifiedErrorId-cne$script:original.FullyQualifiedErrorId-or$Caught.InvocationInfo.ScriptName-cne$script:original.InvocationInfo.ScriptName-or$Caught.InvocationInfo.ScriptLineNumber-ne$script:original.InvocationInfo.ScriptLineNumber){throw 'ERROR_RECORD_REPLACED'}}
`;
win('installer preserves original exception reference and ErrorRecord origin across independent restore and cleanup failures',()=>{
 assert.equal(run(String.raw`
function Start-ReadPairPreparedOwner{Fail-Primary}
function Restore-ReadPairBeforeRetire([bool]$OldStopped){$calls.Add('restore:'+ $OldStopped);throw 'secret-restore sentinel'}
function Close-ReadPairPublication{$calls.Add('close');throw 'secret-cleanup sentinel'}
$caught=$null;try{Invoke-ReadPairInstallSequence|Out-Null}catch{$caught=$_};Assert-Original $caught
if(($calls-join'|')-cne'open|target|stop|restore:True|close'){throw 'ORDER'}
if($result.primaryFailure.code-cne'READPAIR_PRIMARY_FAILURE'-or$result.restoreFailure.code-cne'READPAIR_RESTORE_FAILURE'-or$result.cleanupFailure.code-cne'READPAIR_CLEANUP_FAILURE'){throw 'CHAIN_MISSING'}
$json=$result|ConvertTo-Json -Depth 12;if($json-match'sentinel|secret-|credential|query'){throw 'SECRET_OUTPUT'};'PASS'
`),'PASS');
});
win('installer rejects cleanup failure after successful readback and does not restore or resend retirement',()=>{
 assert.equal(run(String.raw`
function Close-ReadPairPublication{$calls.Add('close');try{throw 'secret-close'}catch{$script:original=$_;throw}}
$caught=$null;$output=@();try{$output=@(Invoke-ReadPairInstallSequence)}catch{$caught=$_};Assert-Original $caught
if($output.Count-or$result.primaryFailure-or$result.restoreFailure-or$result.cleanupFailure.code-cne'READPAIR_CLEANUP_FAILURE'-or$calls.Contains('restore:True')-or@($calls|Where-Object{$_-ceq'retire'}).Count-ne1){throw 'FALSE_SUCCESS'};'PASS'
`),'PASS');
});
win('installer post-retire primary survives recovery-phase logging and cleanup failures without inverse',()=>{
 assert.equal(run(String.raw`
function Wait-ReadPairFinalState{Fail-Primary}
function Record-Phase($Phase){$calls.Add($Phase);throw 'secret-phase'}
function Close-ReadPairPublication{$calls.Add('close');throw 'secret-close'}
$caught=$null;try{Invoke-ReadPairInstallSequence|Out-Null}catch{$caught=$_};Assert-Original $caught
if($calls.Contains('restore:True')-or$calls.Contains('restore:False')-or@($calls|Where-Object{$_-ceq'retire'}).Count-ne1-or!$result.restoreFailure-or!$result.cleanupFailure){throw 'POST_RETIRE_REPLAY'};'PASS'
`),'PASS');
});
win('installer failure receipt write cannot replace original error and stores bounded write-failure metadata',()=>{
 assert.equal(run(String.raw`
try{Fail-Primary}catch{$failure=$_}
function Record-Phase($Phase){throw 'secret-write sentinel'}
Write-ReadPairInstallFailureReceipt $failure
if($result.failure-cne'READPAIR_UNCLASSIFIED_FAILURE'-or$result.failureReceiptWriteFailure.code-cne'READPAIR_FAILURE_RECEIPT_WRITE_FAILED'){throw 'RECEIPT_FAILURE_LOST'}
if(($result|ConvertTo-Json -Depth 12)-match'sentinel|secret-|credential'){throw 'SECRET_OUTPUT'}
function Invoke-FixtureOuter{try{Fail-Primary}catch{Write-ReadPairInstallFailureReceipt $_;throw}}
$caught=$null;try{Invoke-FixtureOuter}catch{$caught=$_};Assert-Original $caught;'PASS'
`),'PASS');
});
win('installer successful normal and steady outcomes remain scalar with exactly one close',()=>{
 assert.equal(run(String.raw`
$output=@(Invoke-ReadPairInstallSequence)
if($output.Count-ne1-or$output[0]-cne'CandidateVerified'-or($calls-join'|')-cne'open|target|stop|start|ready|retire|wait|CandidateVerified|close'){throw 'NORMAL_CHANGED'}
$calls.Clear();$script:SteadyStartupInstall=$true
function Complete-B6SteadyTaskPublication{$calls.Add('task')}
$output=@(Invoke-ReadPairInstallSequence)
if($output.Count-ne1-or$output[0]-cne'SteadyStartupVerified'-or($calls-join'|')-cne'open|target|stop|start|ready|task|SteadyStartupVerified|close'){throw 'STEADY_CHANGED'};'PASS'
`),'PASS');
});
const sourceFixture=String.raw`
$script:WebOnlyRefreshInstall=$true;$resultPath='inert-existing-receipt';$script:b6ReadProof=[pscustomobject]@{inert=$true}
function New-FixtureResource($Name){$v=[pscustomobject]@{name=$Name};$v|Add-Member ScriptMethod Dispose {$calls.Add($this.name);throw ('secret-'+$this.name)};return $v}
$script:WebOnlyApiHandle=New-FixtureResource 'api';$script:WebOnlyPackageSeal=New-FixtureResource 'seal'
$script:b6SourceHandles=@((New-FixtureResource 'source0'),(New-FixtureResource 'source1'))
function Close-ErpReadPairReleaseProof($Proof){if(![object]::ReferenceEquals($Proof,$script:b6ReadProof)){throw 'FOREIGN_PROOF'};$calls.Add('proof');throw 'secret-proof'}
`;
win('outer source cleanup attempts all fixed resources while original primary survives and receipt has separate bounded diagnostics',()=>{
 assert.equal(run(sourceFixture+String.raw`
function Invoke-FixtureOuter{
 $sourcePrimary=$null
 try{Fail-Primary}catch{$sourcePrimary=$_;throw}finally{Close-B6ReadPairSourceResources $sourcePrimary}
}
$caught=$null;try{Invoke-FixtureOuter}catch{$caught=$_};Assert-Original $caught
if(($calls-join'|')-cne'api|seal|proof|source0|source1|FAILED_REVIEW_RECEIPT'-or$result.sourceCleanupFailure.failureCount-ne5-or$result.sourceCleanupFailure.diagnostics.Count-ne5){throw 'SOURCE_CLEANUP_SKIPPED'}
if(($result|ConvertTo-Json -Depth 16)-match'secret-|credential|query'){throw 'SOURCE_SECRET_LEAK'};'PASS'
`),'PASS');
});
win('source cleanup alone fails closed and limits safe diagnostic entries while closing every handle',()=>{
 assert.equal(run(sourceFixture+String.raw`
$script:b6SourceHandles=@(0..19|ForEach-Object{New-FixtureResource ('source'+$_)})
$denied=$false;try{Close-B6ReadPairSourceResources $null}catch{$denied=$true}
if(!$denied-or$result.sourceCleanupFailure.failureCount-ne23-or$result.sourceCleanupFailure.diagnostics.Count-ne16-or!$calls.Contains('source19')-or$calls[-1]-cne'FAILED_REVIEW_RECEIPT'){throw 'CLEANUP_FALSE_SUCCESS_OR_UNBOUNDED'};'PASS'
`),'PASS');
});
win('preclaim source cleanup preserves its primary without creating any receipt or invoking the writer',()=>{
 assert.equal(run(sourceFixture+String.raw`
$result=$null;$resultPath=$null
function Record-Phase($Phase){throw 'PRECHECK_MUST_NOT_WRITE'}
function Invoke-FixtureOuter{
 $sourcePrimary=$null
 try{Fail-Primary}catch{$sourcePrimary=$_;throw}finally{Close-B6ReadPairSourceResources $sourcePrimary}
}
$caught=$null;try{Invoke-FixtureOuter}catch{$caught=$_};Assert-Original $caught
if(($calls-join'|')-cne'api|seal|proof|source0|source1'-or$null-ne$result){throw 'PRECHECK_EFFECT'};'PASS'
`),'PASS');
});
