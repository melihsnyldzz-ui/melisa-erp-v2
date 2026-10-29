import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=import.meta.dirname, ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const q=s=>"'"+s.replaceAll("'","''")+"'";
const setup=String.raw`
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. __OWNED__ -Library
Add-Type -LiteralPath __NATIVE__
# All external paths, network, task and process observations are isolated.
# No production mutex, pending marker, ERP process, SQL, HTTP or task is used.
function Get-Business5244StartupMutexName{return ('Local\Melisa5244PairTest-'+[IO.Path]::GetFileName($env:TEMP))}
function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'retirement.pending')}
$lease=Enter-Business5244StartupLease -Kind Owner
$script:children=[Collections.Generic.List[object]]::new()
$sleepFile=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($sleepFile,'Start-Sleep -Seconds 120')
function New-TestChild{$n=[Business5244WebNative]::new();$script:children.Add($n);$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$sleepFile+'"'),$env:TEMP);return $n}
function Assert-Business5244CreatedChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'ISOLATED_CHILD_NOT_ALIVE'}}
function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
function Get-CimInstance{param($ClassName,$Filter);if($ClassName -cne 'Win32_Process' -or $Filter -cne 'ProcessId=2000'){throw 'ISOLATED_UNEXPECTED_PROCESS_QUERY'};if($script:oldPidPresent){return @{ProcessId=2000}}}
$script:oldPidPresent=$false
$pins=Get-Business5244WebPins;$native=New-TestChild;$state=Register-Business5244OwnedRetirement $lease $native $pins
$script:r=Get-Business5244RetirementState $state
$rows=@([pscustomobject]@{port=4194;pid=111;entry='keep-api';root='keep-api'},[pscustomobject]@{port=4196;pid=112;entry='keep-native';root='keep-native'},[pscustomobject]@{port=5244;pid=2000;entry='vite-preview';sourceCommit='d875dc6e59d70230b8c931f718bac30438778ec1';root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-d4f52345';backendPort=4144;businessWorkfaceId=$pins.profile})
$script:before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20))
$script:baselineHash=Get-Business5244StartupHash $script:before
function Get-Business5244CurrentBootstrapPins{return @{hash=$script:baselineHash;pid=2000;root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-d4f52345';source='d875dc6e59d70230b8c931f718bac30438778ec1'}}
$recordPath=Join-Path $env:TEMP 'records.json';$bootstrapPath=Join-Path $env:TEMP 'bootstrap.pending'
[IO.File]::WriteAllBytes($recordPath,$script:before)
# Route only this fixed production literal to the disposable record file.
$prep=(Get-Command Prepare-Business5244PairedMaintenance).Definition.Replace("'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'",("'"+$recordPath.Replace("'","''")+"'"))
. ([scriptblock]::Create('function Prepare-Business5244PairedMaintenance {'+$prep+'}'))
function Get-NetTCPConnection{param($LocalPort,$State);if(($null-ne$LocalPort-and$LocalPort-ne5244)-or$State-cne'Listen'){throw 'ISOLATED_TCP_SCOPE'};foreach($address in @('100.87.188.3','127.0.0.1','192.168.1.46')){[pscustomobject]@{LocalPort=5244;LocalAddress=$address;OwningProcess=$native.ChildPid}}}

function Publish-Business5244CurrentRecord($State){
 $records=[IO.File]::Open($recordPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$pending=$null
 try{if(!$script:r.ContainsKey('currentBootstrap')){$pending=[IO.File]::Open($bootstrapPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)};Publish-Business5244HeldCurrentRecord $State $records $pending}finally{if(!$script:r.records){$records.Dispose();if($pending){$pending.Dispose()}}}
}
$script:apiToken=[pscustomobject]@{kind='isolated-issued-api-reference'};$script:apiMode='Current';$script:apiCalls=[Collections.Generic.List[string]]::new();$script:scenario='Success';$script:spawnCount=0
$script:payloadChecks=0;$sealFile=Join-Path $env:TEMP 'immutable-package-fixture.txt';[IO.File]::WriteAllText($sealFile,'only-immutable-fixture');$sealHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($sealFile))
function Assert-Test125ReadPairTransition{param($Transition,$Mode);if(![object]::ReferenceEquals($Transition,$script:apiToken) -or $script:apiMode -cne $Mode){throw 'ISOLATED_API_TRANSITION_REJECTED'}}
# This state-machine fixture isolates API providers; the separate prepared-API
# test executes the actual issued query-handle admission and negative guards.
function Prepare-Test125ReadPairRequestAdmission($Transition){Assert-Test125ReadPairTransition $Transition Current}
function Assert-Test125ReadPairRequestAdmission($Transition){Assert-Test125ReadPairTransition $Transition Current}
function Get-Test125ReadPairTransitionContract{param($Transition);Assert-Test125ReadPairTransition $Transition Current;return @{scope='TEST125-API-READ2b-20261028-41d3c213';contractSha256=('b'*64);mode='Current';phase='PREPARED'}}
function Invoke-Test125ReadPairApiTransition{param($Transition,$Mode);if(![object]::ReferenceEquals($Transition,$script:apiToken)){throw 'ISOLATED_API_REFERENCE'};if(!$script:r.native.RetirementConfirmed){throw 'ISOLATED_API_BEFORE_WEB_RETIREMENT'};$script:apiCalls.Add($Mode);if($script:scenario -ceq 'ApiUnknown'){throw 'ISOLATED_API_UNCERTAIN'};$script:apiMode=if($Mode -ceq 'Candidate'){'Candidate'}else{'Current'}}
function Assert-Business5244OwnedPackage{param($Pins,$Seal=$null);$script:payloadChecks++;$expected=if($Pins.package -ceq (Get-Business5244ReadPairPins).package){Get-Business5244ReadPairPins}else{Get-Business5244WebPins};foreach($key in $expected.Keys){if($Pins[$key] -cne $expected[$key]){throw 'ISOLATED_PACKAGE_PIN_CHANGED'}};if($null -ne $Seal){$Seal.Add($sealFile,$sealHash)}}
function Invoke-RestMethod{param($Uri,$TimeoutSec);if($Uri -cne 'http://127.0.0.1:4144/test-health'){throw 'ISOLATED_UNEXPECTED_HTTP'};return @{packageId=$(if($script:apiMode -ceq 'Current'){(Get-Business5244WebPins).apiPackage}else{(Get-Business5244ReadPairPins).apiPackage})}}
function Assert-Business5244ApiHealth($Health,$Pins){if($Health.packageId -cne $Pins.apiPackage){throw 'ISOLATED_API_PAIR_MISMATCH'}}
# Manifest IO is outside the state-machine test; only the fixed manifest path
# is accepted and the exact production pin is returned, never a real file read.
function Get-FileHash{param($LiteralPath);if($LiteralPath -ceq (Join-Path $pins.root 'release-manifest.json')){return @{Hash=$pins.manifest}};Microsoft.PowerShell.Utility\Get-FileHash -LiteralPath $LiteralPath}
$script:request=[pscustomobject]@{operation='retire';requestId='isolated-pair'};$channel=[pscustomobject]@{};$script:requestFresh=$true
function Assert-Business5244RetirementRequest{param($Channel,$Request);if(![object]::ReferenceEquals($Request,$script:request) -or !$script:requestFresh){throw 'ISOLATED_FOREIGN_OR_EXPIRED_REQUEST'}}
function Get-Business5244RetirementRequestAdmission{param($Channel,$Request);Assert-Business5244RetirementRequest $Channel $Request;return @{bodyHash=('a'*64);requestId=$Request.requestId;expired=$false}}
function Invoke-Business5244OwnedRetirement{param($State,$Channel,$Request);Assert-Business5244RetirementRequest $Channel $Request;$records=[IO.File]::Open($recordPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$pending=[IO.File]::Open((Get-Business5244RetirementPendingPath),[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);Invoke-Business5244HeldRetirement $State $records $pending}
function New-Business5244PinnedChild{param($Pins,$Lease);Assert-Business5244StartupLease -Lease $Lease -Kind Maintenance;$h=Invoke-RestMethod 'http://127.0.0.1:4144/test-health';Assert-Business5244ApiHealth $h $Pins;if($script:scenario -ceq 'CandidateStartFail' -and $Pins.apiPackage -ceq (Get-Business5244ReadPairPins).apiPackage){throw 'ISOLATED_CANDIDATE_START_FAILURE'};$script:spawnCount++;return New-TestChild}
`;
const loaded=setup.replace('__OWNED__',q(path.join(dir,'start-business-5244-owned.ps1'))).replace('__NATIVE__',q(path.join(dir,'business-5244-web-native.cs')));
const cleanup=String.raw`finally{foreach($child in $script:children){$child.Dispose()};if($script:r.records){$script:r.records.Dispose()};if($script:r.pending){$script:r.pending.Dispose()};if($script:r.ContainsKey('preparedPair')){$script:r.preparedPair.seal.Dispose()};Exit-Business5244StartupLease -Lease $lease};'PASS'`;
function run(body){const temp=fs.mkdtempSync(path.join(os.tmpdir(),'erp-5244-pair-'));try{const file=path.join(temp,'run.ps1');fs.writeFileSync(file,loaded+body);return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',timeout:25000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();}finally{fs.rmSync(temp,{recursive:true,force:true});}}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
win('stale record CAS publishes only the real held Current child; replay has no write or stop',()=>{
 assert.equal(run(String.raw`try{$first=Publish-Business5244CurrentRecord $state;$after=[IO.File]::ReadAllBytes($recordPath);$again=Publish-Business5244CurrentRecord $state;if(!$first.published -or $first.replayed -or !$again.replayed -or !$native.ChildAlive() -or $again.childPid -ne $native.ChildPid){throw 'BOOTSTRAP_NOT_BOUND'};if((Get-Business5244StartupHash $after) -cne (Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordPath)))){throw 'BOOTSTRAP_REPLAY_WRITE'};$actual=ConvertFrom-Business5244RecordBytes $after;Assert-Business5244RecordStage $rows $actual $native.ChildPid Candidate $pins;if(@(Get-ChildItem $env:TEMP -Filter '*.bootstrap.completed').Count -ne 1 -or (Test-Path $bootstrapPath)){throw 'BOOTSTRAP_ARCHIVE'}}`+cleanup),'PASS');
});
for(const scenario of ['HashDrift','OldPidPresent'])win(`bootstrap ${scenario} refuses publication and leaves the owned child alive`,()=>{
 assert.equal(run(`$script:scenario='${scenario}';`+String.raw`try{if($script:scenario -ceq 'HashDrift'){$script:baselineHash='0'*64}else{$script:oldPidPresent=$true};$rejected=$false;try{Publish-Business5244CurrentRecord $state|Out-Null}catch{$rejected=$true};if(!$rejected -or !$native.ChildAlive() -or $script:r.phase -cne 'Running' -or (Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordPath))) -cne (Get-Business5244StartupHash $script:before)){throw 'INVALID_BOOTSTRAP_EFFECT'}}`+cleanup),'PASS');
});
win('two-pair preflight requires an issued API reference and keeps the ordinary web-only mismatch closed',()=>{
 assert.equal(run(String.raw`try{$denied=$false;try{Get-Business5244MaintenancePlan -State $state -ApiTransition ([pscustomobject]@{kind=$script:apiToken.kind})|Out-Null}catch{$denied=$true};if(!$denied){throw 'FORGED_API_ADMITTED'};$plain=Get-Business5244MaintenancePlan -State $state;$denied=$false;try{Assert-Business5244MaintenancePlan $plain $state}catch{$denied=$true};if(!$denied){throw 'ORDINARY_RETIRE_BYPASSED_API'};Prepare-Business5244PairedMaintenance $state $script:apiToken;$pair=Get-Business5244MaintenancePlan -State $state -ApiTransition $script:apiToken;Assert-Business5244MaintenancePlan $pair $state $script:apiToken;$pair.candidate.manifest='F'*64;$denied=$false;try{Assert-Business5244MaintenancePlan $pair $state $script:apiToken}catch{$denied=$true};if(!$denied -or !$native.ChildAlive() -or $script:apiCalls.Count){throw 'MUTABLE_PLAN_ADMITTED'}}`+cleanup),'PASS');
});
win('bootstrap durable-write failure retains evidence and Unknown; it never republishes a stale PID',()=>{
 assert.equal(run(String.raw`Add-Type -TypeDefinition @'
using System;using System.IO;public sealed class BootstrapFailFlush:FileStream{public bool Fail=true;public BootstrapFailFlush(string p):base(p,FileMode.Open,FileAccess.ReadWrite,FileShare.None){}public override void Flush(bool durable){if(Fail){Fail=false;throw new IOException("ISOLATED_BOOTSTRAP_FLUSH_FAILURE");}base.Flush(durable);}}
'@;
try{$records=[BootstrapFailFlush]::new($recordPath);$pending=[IO.File]::Open($bootstrapPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{$denied=$true};if(!$denied -or $script:r.phase -cne 'Unknown' -or $script:r.currentBootstrap.phase -cne 'Unknown' -or !$native.ChildAlive() -or !(Test-Path $bootstrapPath)){throw 'BOOTSTRAP_UNCERTAIN_NOT_HELD'};$written=ConvertFrom-Business5244RecordBytes (Read-Business5244RetirementBytes $records);if(($written|Where-Object port -eq 5244).pid -ne $native.ChildPid){throw 'BOOTSTRAP_RESTORED_STALE_PID'};$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{$denied=$true};if(!$denied){throw 'BOOTSTRAP_UNCERTAIN_REPLAY'}}`+cleanup),'PASS');
});
for(const scenario of ['Success','CandidateStartFail'])win(`paired ${scenario} orders web retirement, API change and exact new or rollback child; replay is inert`,()=>{
 assert.equal(run(`$script:scenario='${scenario}';`+String.raw`try{Prepare-Business5244PairedMaintenance $state $script:apiToken;$result=Invoke-Business5244PairedOwnerMaintenance $state $channel $script:request $script:apiToken;$wanted=if($script:scenario -ceq 'Success'){'Candidate'}else{'Rollback'};if($result.mode -cne $wanted -or $script:r.phase -cne 'Running' -or !$script:r.native.ChildAlive() -or $script:r.native.ChildPid -eq $native.ChildPid){throw 'PAIR_RESULT_NOT_BOUND'};$expectedCalls=if($wanted -ceq 'Candidate'){'Candidate'}else{'Candidate,Rollback'};if(($script:apiCalls -join ',') -cne $expectedCalls){throw 'PAIR_API_ORDER'};$savedCalls=$script:apiCalls.Count;$savedSpawns=$script:spawnCount;$again=Invoke-Business5244PairedOwnerMaintenance $state $channel $script:request $script:apiToken;if(!$again.replayed -or $script:apiCalls.Count -ne $savedCalls -or $script:spawnCount -ne $savedSpawns){throw 'PAIR_REPLAY_EFFECT'};$actual=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes($recordPath));if(($actual|Where-Object port -eq 4194).pid -ne 111 -or ($actual|Where-Object port -eq 4196).pid -ne 112){throw 'PAIR_CHANGED_KEPT_RECORD'};Assert-Business5244StartupLease -Lease $lease -Kind Owner}`+cleanup),'PASS');
});
win('unknown API transition never starts a mismatched web or forces a second switch',()=>{
 assert.equal(run(String.raw`$script:scenario='ApiUnknown';try{Prepare-Business5244PairedMaintenance $state $script:apiToken;$denied=$false;try{Invoke-Business5244PairedOwnerMaintenance $state $channel $script:request $script:apiToken|Out-Null}catch{$denied=$true};if(!$denied -or $script:r.phase -cne 'Unknown' -or $script:spawnCount -ne 0){throw 'UNKNOWN_PAIR_BYPASSED'};Assert-Business5244StartupLease -Lease $lease -Kind Maintenance;$calls=$script:apiCalls.Count;try{Invoke-Business5244PairedOwnerMaintenance $state $channel $script:request $script:apiToken|Out-Null}catch{};if($script:apiCalls.Count -ne $calls){throw 'UNKNOWN_API_REPLAY'}}`+cleanup),'PASS');
});
win('heavy preparation precedes the request; read locks preserve payload and a disposed seal fails before retirement',()=>{
 assert.equal(run(String.raw`try{$pair=Get-Business5244MaintenancePlan $state $script:apiToken;$denied=$false;try{Assert-Business5244MaintenancePlan $pair $state $script:apiToken}catch{$denied=$true};if(!$denied){throw 'UNPREPARED_PAIR_ADMITTED'};Prepare-Business5244PairedMaintenance $state $script:apiToken;$checked=$script:payloadChecks;Assert-Business5244MaintenancePlan $pair $state $script:apiToken;if($script:payloadChecks-ne$checked){throw 'REQUEST_REHASHED_PAYLOAD'};$denied=$false;try{[IO.File]::WriteAllText($sealFile,'changed')}catch{$denied=$true};if(!$denied){throw 'SEALED_PAYLOAD_WRITABLE'};$script:r.preparedPair.seal.Dispose();$denied=$false;try{Invoke-Business5244PairedOwnerMaintenance $state $channel $script:request $script:apiToken|Out-Null}catch{$denied=$true};if(!$denied-or!$native.ChildAlive()-or$script:apiCalls.Count){throw 'DEAD_SEAL_RETIRED_CHILD'}}`+cleanup),'PASS');
});
win('an expired fresh request cannot reuse prepared payload proof to publish or stop anything',()=>{
 assert.equal(run(String.raw`try{Prepare-Business5244PairedMaintenance $state $script:apiToken;$preparedHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordPath));$script:requestFresh=$false;$denied=$false;try{Invoke-Business5244PairedOwnerMaintenance $state $channel $script:request $script:apiToken|Out-Null}catch{$denied=$true};if(!$denied -or !$native.ChildAlive() -or $script:apiCalls.Count -or !$script:r.ContainsKey('currentBootstrap') -or (Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordPath))) -cne $preparedHash){throw 'STALE_REQUEST_EFFECT'}}`+cleanup),'PASS');
});
// The recovery fixture retains real same-process state, a real native Job/child
// retirement, the same kernel mutex and durable temp streams. API/SQL providers
// remain isolated here; the quiescence suite tests the actual post-CAS API handle.
const recoveryLeaf=path.join(dir,'business-5244-writer-postcas-recovery.ps1');
const recoveryFixture=String.raw`
Initialize-Business5244RetirementPeer
function Get-Business5244RetirementPipeName{return ('IsolatedRecovery-'+[Guid]::NewGuid().ToString('N'))}
function Reset-Business5244RetirementConnection($Record){$Record.pipe=[IO.Pipes.NamedPipeServerStream]::new(('IsolatedRecovery-'+[Guid]::NewGuid().ToString('N')));$Record.phase='Accept'}
$channel=Open-Business5244RetirementChannel $lease
Prepare-Business5244PairedMaintenance $state $script:apiToken
$script:scenario='ApiUnknown';try{Invoke-Business5244PairedOwnerMaintenance $state $channel $script:request $script:apiToken|Out-Null}catch{}
if(!$script:r.native.RetirementConfirmed-or$script:r.phase-cne'Unknown'){throw 'FIXTURE_NOT_ACTUALLY_RETIRED'}
$script:r.scopeName='TEST125-API-B6-WRITER-20261029';$script:r.requestProof=@{channel=$channel;request=$script:request};$script:r.dispatch.failureCode='TEST125_API_CONFIG_CHANGED';$script:r.dispatch.stage='ApiRollback'
$script:apiToken|Add-Member startupCandidateSha256 ('1'*64);$script:apiToken|Add-Member apiProfileCandidateSha256 ('2'*64)
$script:fixtureC=@{phase='FAILED';mode='Current';changed=$true;apiChanged=$true;taskStopped=$true;candidateAttempted=$true;nativeChangeAttempted=$false;nativeApplied=$false;resumedEngine=$null;resumedInstance=$null;resumedBirth=$null;failedStartProof=$null;nativeProfileAdmission=[pscustomobject]@{kind='isolated-native-reference'};taskAction=@{mode='Candidate';unknown=$false;candidateSignature=('3'*64);sddlHash=('4'*64)};tokenJson=($script:apiToken|ConvertTo-Json -Depth 12 -Compress)}
$script:fixtureN=@{mode='WriterProfileActivation';phase='WriterPrepared';transition=$script:apiToken}
function Assert-Test125ReadPairIssued($Transition){if(![object]::ReferenceEquals($Transition,$script:apiToken)){throw 'FIXTURE_UNISSUED_API'};return $script:fixtureC}
function Get-ErpBusinessSaleNativeAdmissionContext($Admission){if(![object]::ReferenceEquals($Admission,$script:fixtureC.nativeProfileAdmission)){throw 'FIXTURE_UNISSUED_NATIVE'};return $script:fixtureN}
function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'){throw 'FIXTURE_SCOPE'};if($Mode-ceq'Candidate'){return Get-Business5244ReadPairPins};return Get-Business5244WebPins}
$keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile');$candidate=Get-Business5244ReadPairPins;$old=Get-Business5244WebPins
$contractHash=Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($script:fixtureC.tokenJson));$identity='business-5244-read-pair.v1|'+$contractHash+'|'+(($keys|ForEach-Object{$candidate[$_]})-join'|')+'|'+(($keys|ForEach-Object{$old[$_]})-join'|')
$script:r.dispatch.planHash=Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity));$script:r.dispatch.plan.hash=$script:r.dispatch.planHash;$script:r.preparedPair.planHash=$script:r.dispatch.planHash
$script:fixtureCase=[pscustomobject]@{schema='melisa-b6-writer-postcas-fixed-case.v1';scope=$script:r.scopeName;purpose='CompleteHeldWriterCandidateAfterCas';ownerPid=$PID;ownerBirth=[Business5244RetirementPeer]::CurrentBirth;webChildPid=$native.ChildPid;webChildBirth=$native.ChildBirth;operationId=$script:r.operationId;planHash=$script:r.dispatch.planHash;recordsSha256=$script:r.recordExpected;pendingSha256=$script:r.pendingHash;beforeSha256=$script:r.expected;startupCandidateSha256=$script:apiToken.startupCandidateSha256;apiProfileCandidateSha256=$script:apiToken.apiProfileCandidateSha256;taskCandidateSignature=$script:fixtureC.taskAction.candidateSignature;taskSddlHash=$script:fixtureC.taskAction.sddlHash;expectedFailureCode='TEST125_API_CONFIG_CHANGED';readOnly=$true;executionAuthority=$false;actualT1=$false;externalOperations=$false}
$code=[IO.File]::ReadAllText(__RECOVERY__)
# Only fixed deployment identity/path literals are translated in this test copy.
$code=$code.Replace('$Case.ownerPid-ne45612','$Case.ownerPid-ne$PID').Replace('$PID-ne45612','$PID-ne$Case.ownerPid').Replace("'134377648982508423'",'[Business5244RetirementPeer]::CurrentBirth').Replace("'C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029\recovery-preparation\original-issuer-admission.jsonl'",'(Join-Path $env:TEMP ''recovery-audit.jsonl'')')
. ([scriptblock]::Create($code))
$script:afterChecks=0;$script:resumeCalls=0;$script:pauseClosed=$false
function Assert-Test125ReadPairWriterPostCasPause($Transition,$Mode){$c=Assert-Test125ReadPairIssued $Transition;if($script:pauseClosed-or$Mode-cne'Candidate'){throw 'FIXTURE_PAUSE_CLOSED'};return $c}
function Get-ErpBusinessSaleNativeInputs{return @{inert=$true}}
function Test-ErpBusinessSaleAfter($Inputs){$script:afterChecks++;return $true}
function Get-NetTCPConnection{param($State,$LocalPort);if($State-cne'Listen'-or$LocalPort-ne5244){throw 'FIXTURE_PORT_SCOPE'}}
function Get-Business5244WriterPostCasRecoverySources{$s=[Business5244PackageSeal]::new();$s.Add($sealFile,$sealHash);$s.Freeze();return @{seal=$s;definitions=@{};case=$script:fixtureCase;caseHash=('5'*64);manifestHash=('6'*64)}}
function Resume-Test125ReadPairWriterCandidateAfterCas($Transition,$Admission,$RecoveryAdmission){[void](Assert-Business5244WriterPostCasRecoveryApiResume $RecoveryAdmission $Transition $Admission);[void](Assert-Test125ReadPairIssued $Transition);if(![object]::ReferenceEquals($Admission,$script:fixtureC.nativeProfileAdmission)-or$script:resumeCalls){throw 'FIXTURE_RESUME_NOT_ISSUED'};$script:resumeCalls++;if($script:recoveryFails){throw 'FIXTURE_RESUME_UNKNOWN'};$script:apiMode='Candidate';$script:fixtureN.phase='WriterActivated';$script:fixtureC.phase='VERIFIED';$script:fixtureC.mode='Candidate'}
$script:recoveryFails=$false;$script:apiCalls.Clear();$script:scenario='Success'
`.replace('__RECOVERY__',q(recoveryLeaf));
const recoveryCleanup=String.raw`finally{if($channel){Close-Business5244RetirementChannel $channel};foreach($x in $script:Business5244WriterPostCasRecoveries){if($x.audit){$x.audit.Dispose()};$x.sources.seal.Dispose()};foreach($child in $script:children){$child.Dispose()};if($script:r.records){$script:r.records.Dispose()};if($script:r.pending){$script:r.pending.Dispose()};$script:r.preparedPair.seal.Dispose();Exit-Business5244StartupLease $lease};'PASS'`;
win('Writer fresh post-CAS admission keeps a scalar frame when read-only guards return true and commits one real new child',()=>{
 assert.equal(run(recoveryFixture+String.raw`try{
 $frame=Assert-Business5244WriterPostCasOriginal $state $script:apiToken $channel $script:fixtureCase
 if($frame-isnot[hashtable]-or![object]::ReferenceEquals($frame.state,$script:r)-or$script:afterChecks-ne1){throw 'FRAME_PIPELINE_POLLUTED'}
 $cap=New-Business5244WriterPostCasRecoveryAdmission $state $script:apiToken $channel
 $denied=$false;try{Resume-Test125ReadPairWriterCandidateAfterCas $script:apiToken $script:fixtureC.nativeProfileAdmission $cap|Out-Null}catch{$denied=$true};if(!$denied-or$script:resumeCalls){throw 'PREPARED_CAP_DIRECT_RESUME'}
 $result=Invoke-Business5244WriterPostCasRecovery $cap
 if($result.mode-cne'Candidate'-or$script:r.phase-cne'Running'-or$script:resumeCalls-ne1-or$script:spawnCount-ne1-or!$script:r.native.ChildAlive()-or$script:apiCalls.Count){throw 'RECOVERY_NOT_ONE_CONTINUOUS_COMMIT'}
 $audit=@(Get-Content -LiteralPath (Join-Path $env:TEMP 'recovery-audit.jsonl')|ForEach-Object{$_|ConvertFrom-Json});if($audit.Count-ne3-or$audit[-1].phase-cne'CANDIDATE_COMMITTED_VERIFIED'){throw 'RECOVERY_AUDIT_NOT_DURABLE'}
 foreach($fake in @($cap,($cap|ConvertTo-Json|ConvertFrom-Json))){$denied=$false;try{Invoke-Business5244WriterPostCasRecovery $fake|Out-Null}catch{$denied=$true};if(!$denied-or$script:resumeCalls-ne1-or$script:spawnCount-ne1){throw 'RECOVERY_REPLAY'}}
 }`+recoveryCleanup),'PASS');
});
win('Writer recovery rejects changed retained records, pending, plan, original refs, issuer and paused API before admission',()=>{
 assert.equal(run(recoveryFixture+String.raw`try{
 foreach($case in @('record','pending','plan','api-copy','state-copy','channel-copy','request-ref','issuer','live-native','pause','native-phase')){
  $record=Read-Business5244RetirementBytes $script:r.records;$pending=Read-Business5244RetirementBytes $script:r.pending;$s=$state;$a=$script:apiToken;$h=$channel;$requestRef=$script:r.requestProof.request;$birth=$script:fixtureCase.ownerBirth;$oldNative=$script:r.native;$oldPlan=$script:r.dispatch.plan.candidate.manifest;$oldPhase=$script:fixtureN.phase
  switch($case){'record'{$script:r.records.Position=0;$script:r.records.WriteByte(0);$script:r.records.Flush($true)}'pending'{$script:r.pending.Position=0;$script:r.pending.WriteByte(0);$script:r.pending.Flush($true)}'plan'{$script:r.dispatch.plan.candidate.manifest='0'*64}'api-copy'{$a=$a|ConvertTo-Json|ConvertFrom-Json}'state-copy'{$s=$s|ConvertTo-Json|ConvertFrom-Json}'channel-copy'{$h=$h|ConvertTo-Json|ConvertFrom-Json}'request-ref'{$script:r.requestProof.request=[pscustomobject]@{}}'issuer'{$script:fixtureCase.ownerBirth='1'}'live-native'{$script:r.native=New-TestChild}'pause'{$script:pauseClosed=$true}'native-phase'{$script:fixtureN.phase='WriterActivated'}}
  $denied=$false;try{New-Business5244WriterPostCasRecoveryAdmission $s $a $h|Out-Null}catch{$denied=$true}
  if(!$denied-or$script:resumeCalls-or$script:spawnCount-or$script:r.phase-cne'Unknown'-or(Test-Path (Join-Path $env:TEMP 'recovery-audit.jsonl'))){throw ('RECOVERY_FALSE_ADMISSION_'+$case)}
  $script:r.records.Position=0;$script:r.records.Write($record,0,$record.Length);$script:r.records.SetLength($record.Length);$script:r.records.Flush($true);$script:r.pending.Position=0;$script:r.pending.Write($pending,0,$pending.Length);$script:r.pending.SetLength($pending.Length);$script:r.pending.Flush($true)
  $script:r.requestProof.request=$requestRef;$script:fixtureCase.ownerBirth=$birth;$script:r.native=$oldNative;$script:r.dispatch.plan.candidate.manifest=$oldPlan;$script:pauseClosed=$false;$script:fixtureN.phase=$oldPhase
 }; }`+recoveryCleanup),'PASS');
});
win('Writer recovery unknown after one resume retains original evidence and blocks every retry',()=>{
 assert.equal(run(recoveryFixture+String.raw`try{
 $cap=New-Business5244WriterPostCasRecoveryAdmission $state $script:apiToken $channel;$script:recoveryFails=$true
 $denied=$false;try{Invoke-Business5244WriterPostCasRecovery $cap|Out-Null}catch{$denied=$true}
 if(!$denied-or$script:r.phase-cne'Unknown'-or$script:r.dispatch.phase-cne'Blocked'-or$script:resumeCalls-ne1-or$script:spawnCount-or!$script:r.records.CanRead-or!$script:r.pending.CanRead){throw 'RECOVERY_UNKNOWN_NOT_RETAINED'}
 foreach($action in @('invoke','new')){$denied=$false;try{if($action-ceq'invoke'){Invoke-Business5244WriterPostCasRecovery $cap|Out-Null}else{New-Business5244WriterPostCasRecoveryAdmission $state $script:apiToken $channel|Out-Null}}catch{$denied=$true};if(!$denied-or$script:resumeCalls-ne1){throw 'RECOVERY_UNKNOWN_RETRIED'}}
 }`+recoveryCleanup),'PASS');
});
win('Writer recovery rejects a copied cap, closed source seal and changed audit before state or process effects',()=>{
 assert.equal(run(recoveryFixture+String.raw`try{
 $cap=New-Business5244WriterPostCasRecoveryAdmission $state $script:apiToken $channel
 $denied=$false;try{Invoke-Business5244WriterPostCasRecovery ($cap|ConvertTo-Json|ConvertFrom-Json)|Out-Null}catch{$denied=$true};if(!$denied){throw 'COPIED_RECOVERY_CAP'}
 $reg=$script:Business5244WriterPostCasRecoveries[0];$reg.audit.Position=0;$reg.audit.WriteByte(0);$reg.audit.Flush($true)
 $denied=$false;try{Invoke-Business5244WriterPostCasRecovery $cap|Out-Null}catch{$denied=$true};if(!$denied-or$script:resumeCalls-or$script:spawnCount-or$script:r.phase-cne'Unknown'){throw 'CHANGED_AUDIT_EFFECT'}
 }`+recoveryCleanup),'PASS');
});
win('Writer recovery lost source seal or changed loaded definition rejects before any continuation',()=>{
 assert.equal(run(recoveryFixture+String.raw`try{
 $cap=New-Business5244WriterPostCasRecoveryAdmission $state $script:apiToken $channel;$reg=$script:Business5244WriterPostCasRecoveries[0]
 $reg.sources.definitions['Resume-Test125ReadPairWriterCandidateAfterCas']='unloaded-definition'
 $denied=$false;try{Invoke-Business5244WriterPostCasRecovery $cap|Out-Null}catch{$denied=$true};if(!$denied-or$script:resumeCalls-or$script:r.phase-cne'Unknown'){throw 'CHANGED_DEFINITION_EFFECT'}
 $reg.sources.definitions.Clear();$reg.sources.seal.Dispose();$denied=$false;try{Invoke-Business5244WriterPostCasRecovery $cap|Out-Null}catch{$denied=$true};if(!$denied-or$script:resumeCalls-or$script:spawnCount-or$script:r.phase-cne'Unknown'){throw 'LOST_SOURCE_SEAL_EFFECT'}
 }`+recoveryCleanup),'PASS');
});
win('Writer recovery source loader seals real files and imports only three new AST definitions without replacing old guards',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'erp-recovery-loader-'));
 try{
  const core=path.join(temp,'core'),proof=path.join(temp,'proof');fs.mkdirSync(core);fs.mkdirSync(proof);
  const producer=path.join(proof,'verified-owner-producer.mjs'),shaFile=filename=>cp.execFileSync(process.execPath,['-e',"const f=require('fs'),c=require('crypto');process.stdout.write(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))",filename],{encoding:'utf8',windowsHide:true});
  fs.writeFileSync(producer,`import fs from 'node:fs';import crypto from 'node:crypto';const root=${JSON.stringify(core)};if(process.argv.slice(2).join('|')!=='--verify-writer-recovery')throw Error('FIXTURE_ARG');const bytes=fs.readFileSync(root+'/owner-manifest.json'),m=JSON.parse(bytes);console.log(JSON.stringify({schema:'melisa-b6-writer-recovery-verification.v1',coreRoot:root,coreManifestSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceCommit:m.sourceCommit,files:3,baseCoreManifestSha256:m.baseCoreManifestSha256,fixedCaseSha256:m.fixedCase.sha256,installed:false,executable:false,executionAuthority:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,writes:0}));`);
  let source=fs.readFileSync(recoveryLeaf,'utf8').replace("C:\\Sirket\\ERP\\releases\\ERP-BUSINESS-5244-B6-WRITER-RECOVERY-20261029",core).replace("C:\\Sirket\\ERP\\evidence\\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\\private\\b6-writer-activation-v2-20261029\\recovery-preparation",proof).replace("C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe",process.execPath).replace('8553b4c4974f504566c72334da08664e6244d45a650f00ed6ba80dc2cc0f8f77',shaFile(producer)).replace('3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237',shaFile(process.execPath));
  const leaf=path.join(core,path.basename(recoveryLeaf));fs.writeFileSync(leaf,source);
  for(const name of ['test125-bound-api-quiescence.ps1','canonical-business-sale-maintenance.ps1'])fs.copyFileSync(path.join(dir,name),path.join(core,name));
  const files=[path.basename(recoveryLeaf),'test125-bound-api-quiescence.ps1','canonical-business-sale-maintenance.ps1'].map(name=>({path:name,sha256:shaFile(path.join(core,name)),bytes:fs.statSync(path.join(core,name)).size}));
  const casePath=path.join(core,'writer-postcas-fixed-case.json');fs.writeFileSync(casePath,'{}');
  fs.writeFileSync(path.join(core,'owner-manifest.json'),JSON.stringify({kind:'BUSINESS5244_WRITER_POSTCAS_RECOVERY',scope:'TEST125-API-B6-WRITER-20261029',sourceCommit:'a'.repeat(40),sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',baseCoreRoot:'C:\\Sirket\\ERP\\releases\\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2',baseCoreManifestSha256:'2d1047887212c9e131a53da0f7f865a48909c90f0d6b84756c589fc8fdbbcdd2',baseRouterRoot:'C:\\Sirket\\ERP\\releases\\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2',baseRouterManifestSha256:'7f44b5b61e4cc8867aa25a84a2820974b632c0bdba318711e67c8ef24c7b5602',files,fixedCase:{path:path.basename(casePath),sha256:shaFile(casePath),bytes:2}}));
  const script=String.raw`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
Add-Type -LiteralPath __NATIVE__
function Read-ErpBusinessSalePinnedFile($Path,$Hash){$b=[IO.File]::ReadAllBytes($Path);$s=[Security.Cryptography.SHA256]::Create();try{if(([BitConverter]::ToString($s.ComputeHash($b)).Replace('-','').ToLowerInvariant())-cne$Hash){throw 'FIXTURE_BAD_HASH'}}finally{$s.Dispose()};return ,$b}
function Assert-ErpBusinessSaleNativeQuiescence {throw 'ORIGINAL_GUARD_SENTINEL'}
$original=(Get-Command Assert-ErpBusinessSaleNativeQuiescence).Definition
. __LEAF__
$sealed=Get-Business5244WriterPostCasRecoverySources
try{
 foreach($n in @('Assert-Test125ReadPairWriterPostCasPause','Resume-Test125ReadPairWriterCandidateAfterCas','Complete-ErpBusinessSaleWriterProfilePostCasState')){if(!(Get-Command $n -CommandType Function)){throw 'NEW_LEAF_NOT_IMPORTED'}}
 foreach($n in @('Assert-Test125ReadPairWriterPostCasPause','Complete-ErpBusinessSaleWriterProfilePostCasState')){
  if(!(Get-Command $n).Parameters.ContainsKey('Mode')){throw 'INLINE_PARAMETERS_LOST'}
  $denied=$false;try{&$n $null -Mode INVALID|Out-Null}catch{if($_.Exception.GetType().FullName-cne'System.Management.Automation.ParameterBindingValidationException'){throw};$denied=$true};if(!$denied){throw 'INLINE_VALIDATESET_LOST'}
 }
 if(!(Get-Command Resume-Test125ReadPairWriterCandidateAfterCas).Parameters.ContainsKey('RecoveryAdmission')){throw 'OPAQUE_OUTER_PARAMETER_LOST'}
 $denied=$false;try{Resume-Test125ReadPairWriterCandidateAfterCas $null $null $null|Out-Null}catch{if($_.Exception.Message-cne'WRITER_POSTCAS_NOT_ISSUED'){throw};$denied=$true};if(!$denied){throw 'DIRECT_RESUME_WITHOUT_OUTER_CAP'}
 if((Get-Command Assert-ErpBusinessSaleNativeQuiescence).Definition-cne$original-or(Get-Command Invoke-ErpBusinessSaleNativeRevision -ErrorAction SilentlyContinue)){throw 'ORIGINAL_MODULE_HOTLOADED'}
 Assert-Business5244WriterPostCasRecoverySources $sealed
 $denied=$false;try{[IO.File]::WriteAllText(__INPUT__,'drift')}catch{$denied=$true};if(!$denied){throw 'SOURCE_NOT_HELD'}
 $denied=$false;try{Get-Business5244WriterPostCasRecoverySources|Out-Null}catch{$denied=$true};if(!$denied){throw 'NEW_FUNCTION_COLLISION_ACCEPTED'}
 'PASS'
}finally{$sealed.seal.Dispose()}
`.replace('__NATIVE__',q(path.join(dir,'business-5244-web-native.cs'))).replace('__LEAF__',q(leaf)).replace('__INPUT__',q(path.join(core,'test125-bound-api-quiescence.ps1')));
  const scriptPath=path.join(temp,'loader.ps1');fs.writeFileSync(scriptPath,script);assert.equal(cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',scriptPath],{encoding:'utf8',timeout:20000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim(),'PASS');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
