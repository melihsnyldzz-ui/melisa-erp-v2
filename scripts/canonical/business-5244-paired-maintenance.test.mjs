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
