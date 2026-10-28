import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
const base=import.meta.dirname,file=path.join(base,'test125-bound-api-quiescence.ps1'),plan=path.join(base,'test125-bound-maintenance-plan.ps1');
const ps=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,q=s=>"'"+s.replaceAll("'","''")+"'",win={skip:process.platform!=='win32'};
function run(body){return execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;foreach($m in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules/'+$m+'/'+$m+'.psd1'))};. ${q(file)};${body}`],{encoding:'utf8',timeout:30000,windowsHide:true}).trim();}
test('fixed READ2b scope is preparation only, legacy runs cannot select it without explicit new preparation',win,()=>{
 assert.equal(run(`$s=Get-Test125ReadPairScope;if($s.current.ManifestSha256-cne'3e498c4fe89853e295c3ef0a66f88abcbd640b22750c6a54d4348b309b5c2f33'-or$s.candidate.ManifestSha256-cne'8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'){throw 'PAIR'};function Read-ErpStartupConfig{throw 'UNEXPECTED_RUNTIME'};try{Get-Test125BoundMaintenancePlan -RunId $s.name;throw 'ACCEPT'}catch{if($_.Exception.Message-cne'TEST125_RUN_SCOPE_REJECTED'){throw}};try{Get-Test125BoundMaintenancePlan -RunId 'PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a' -ReadPairPreparation;throw 'ACCEPT'}catch{if($_.Exception.Message-cne'TEST125_RUN_SCOPE_REJECTED'){throw}};'PASS'`),'PASS');
});
test('forged/replayed API pair objects and mutated scopes reject before external access',win,()=>{
 assert.equal(run(`function Read-ErpStartupConfig{throw 'UNEXPECTED_RUNTIME'};foreach($mode in @('Current','Candidate')){try{Assert-Test125ReadPairTransition ([pscustomobject]@{scope=(Get-Test125ReadPairScope).name}) $mode;throw 'ACCEPT'}catch{if($_.Exception.Message-cne'TEST125_READPAIR_NOT_ISSUED'){throw}}};try{Invoke-Test125ReadPairApiTransition ([pscustomobject]@{}) Candidate;throw 'ACCEPT'}catch{if($_.Exception.Message-cne'TEST125_READPAIR_NOT_ISSUED'){throw}};$s=Get-Test125ReadPairScope;$c=[pscustomobject]@{RepoRoot='C:\\Sirket\\ERP\\melisa-erp-v2';SourceCommit=$s.source;ExpectedDatabase=$s.database;TaskName='Melisa-ERP-TEST-Canonical';ApiComponent=$s.current};[void](Assert-Test125ReadPairConfig $c Current);foreach($key in @('ReleaseRoot','SourceCommit','ManifestSha256','ConfigPath')){$copy=$c|ConvertTo-Json -Depth 10|ConvertFrom-Json;$copy.ApiComponent.$key='foreign';try{Assert-Test125ReadPairConfig $copy Current;throw 'ACCEPT'}catch{if($_.Exception.Message-cne'TEST125_READPAIR_COMPONENT_REJECTED'){throw}}};'PASS'`),'PASS');
});
const fixture=String.raw`
function Reject([scriptblock]$f,[string]$reason){try{&$f|Out-Null}catch{if($_.Exception.Message-cne$reason){throw};return};throw 'EXPECTED_REJECTION'}
$global:taskRunning=$true;$global:supervisor=900;$global:apiPid=901;$global:stopCalls=0;$global:startCalls=0;$global:apiStops=0
$startup=Join-Path $temp 'startup.json';$api=Join-Path $temp 'api.json';$native=Join-Path $temp 'native.json';$vaultRoot=Join-Path $temp 'vault';[void][IO.Directory]::CreateDirectory($vaultRoot)
$originalScope=Get-Test125ReadPairScope
$originalScope.current.ConfigPath=$api;$originalScope.candidate.ConfigPath=$api
function Get-Test125ReadPairScope{return $originalScope}
$config=[pscustomobject]@{RepoRoot='C:\Sirket\ERP\melisa-erp-v2';SourceCommit=$originalScope.source;ExpectedDatabase=$originalScope.database;TaskName='Melisa-ERP-TEST-Canonical';OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;ConfigPath=$native;ApiComponent=$originalScope.current}
[IO.File]::WriteAllText($startup,($config|ConvertTo-Json -Depth 30));[IO.File]::WriteAllText($api,(@{goal8SyntheticDaySeal=@{packageId='CANONICAL-TEST125-BUSINESS5244-10cdc0ee'};untouched='private-fixture'}|ConvertTo-Json -Depth 10));[IO.File]::WriteAllText($native,'{"untouched":"base-fixture"}')
function Read-ErpStartupConfig{param($Path);return (Get-Content -Raw $startup|ConvertFrom-Json)}
function Assert-ErpRelease{param($c);return [pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'}}
function Assert-ErpApiPrivateProfile{param($base,$candidate,$manifest);if($candidate.untouched-cne'private-fixture'-or$candidate.goal8SyntheticDaySeal.packageId-cne$manifest.packageId){throw 'PROFILE_DELTA'}}
function Get-ErpApiComponentConfig{param($c);return $c}
# This older fixture isolates task/CAS/replay IO, not package validation.
# Actual payload seals/issued config refs are exercised by the new production
# call-path tests in test125-read2b-prepared-api.test.mjs.
$script:inertReleaseProof=[pscustomobject]@{kind='inert-payload-fixture'}
function New-ErpReadPairPreparedReleaseProof{param($Config);return $script:inertReleaseProof}
function Get-ErpReadPairReleaseProofContext{param($Proof);if(![object]::ReferenceEquals($Proof,$script:inertReleaseProof)){throw 'FIXTURE_RELEASE_REFERENCE'};return @{}}
function Get-ErpReadPairReleaseProofPins{param($Proof);[void](Get-ErpReadPairReleaseProofContext $Proof);return [pscustomobject]@{policy='inert-payload-fixture'}}
function Get-Test125BoundMaintenancePlan{
 param($RunId,[switch]$ReadPairPreparation,$ReadPairMode)
 if(!$ReadPairPreparation-or$RunId-cne$originalScope.name){throw 'PLAN_SCOPE'}
 return [pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$RunId;source=$originalScope.source;database=$originalScope.database;startupHash=(Get-FileHash $startup).Hash;launcherHash='fixture-launcher';manifestHash='fixture-native-manifest';taskXmlHash=(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes('fixture-xml')));taskInstance=('fixture-guid-'+$global:supervisor);supervisor=$global:supervisor;supervisorBirth=('birth-'+$global:supervisor);children=@{api=@{port=4144;pid=$global:apiPid;birth=('birth-'+$global:apiPid)};native=@{port=4146;pid=400;birth='native'};web=@{port=5194;pid=401;birth='web'}}}
}
# Only this test replaces fixed file locations in the two existing constructor
# definitions and vault leaf. Production has no injected path/IO callback.
foreach($name in @('New-Test125ReadPairTransition','Invoke-Test125ReadPairApiTransition')){
 $text=(Get-Command $name).Definition;$text=$text.Replace("'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'",("'"+$startup.Replace("'","''")+"'"));$text=$text.Replace("'C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'",("'"+$vaultRoot.Replace("'","''")+"'"));. ([scriptblock]::Create('function '+$name+' {'+$text+'}'))
}
function Get-Test125ReadPairTask{
 $task=[pscustomobject]@{Xml='fixture-xml'};$task|Add-Member ScriptMethod GetInstances {param($unused);$list=[pscustomobject]@{Count=$(if($global:taskRunning){1}else{0})};$list|Add-Member ScriptMethod Item {param($index);return [pscustomobject]@{InstanceGuid=('fixture-guid-'+$global:supervisor);EnginePID=$global:supervisor}};return $list};return $task
}
function Open-Test125ApiQuiescence{param($Admission,$Run);Assert-Test125ApiAdmission $Admission $Run;return [pscustomobject]@{held=$false;stopped=$false}}
function Enter-Test125ApiQuiescence{param($b);if($global:taskRunning){throw 'NOT_PAUSED'};$b.held=$true}
function Stop-Test125BoundApi{param($b);if(!$b.held){throw 'NOT_HELD'};$b.stopped=$true;$global:apiStops++}
function Test-Test125ApiPhysicalPause{param($b);if(!$b.stopped){throw 'NOT_STOPPED'};return $true}
function Close-Test125ApiQuiescence{param($b)}
function Assert-Test125ReadPairCompanions{param($c);if($c.baseline.children.native.pid-ne400-or$c.baseline.children.web.pid-ne401){throw 'COMPANION'}}
function Stop-ScheduledTask{param($TaskName,$TaskPath);if($TaskName-cne'Melisa-ERP-TEST-Canonical'-or$TaskPath-cne'\'){throw 'TASK_SCOPE'};$global:stopCalls++;$global:taskRunning=$false}
function Start-ScheduledTask{param($TaskName,$TaskPath);$global:startCalls++;$global:taskRunning=$true;$global:supervisor++;$global:apiPid++}
function Get-ErpProcess{param($Id);if($global:taskRunning){$p=[Microsoft.Management.Infrastructure.CimInstance]::new('Win32_Process','root/cimv2');$p.CimInstanceProperties.Add([Microsoft.Management.Infrastructure.CimProperty]::Create('ProcessId',[uint32]$Id,[Microsoft.Management.Infrastructure.CimType]::UInt32,[Microsoft.Management.Infrastructure.CimFlags]::None));$p.CimInstanceProperties.Add([Microsoft.Management.Infrastructure.CimProperty]::Create('CreationDate',[datetime]::Parse('2026-10-28T00:00:00.1234560Z'),[Microsoft.Management.Infrastructure.CimType]::DateTime,[Microsoft.Management.Infrastructure.CimFlags]::None));return $p};return $null}
function Start-Sleep{param($Milliseconds);throw 'UNEXPECTED_WAIT'}
`;
test('issued token exact pair switches candidate and rollback through existing quiescence with temp CAS and inert task/health IO',win,()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-read2b-'));
 try{assert.equal(run(`$temp=${q(temp)};${fixture}
 $t=New-Test125ReadPairTransition;[void](Assert-Test125ReadPairTransition $t Current);$contract=Get-Test125ReadPairTransitionContract $t;if($contract.contractSha256-cnotmatch'^[a-f0-9]{64}$'){throw 'CONTRACT'}
 $copy=$t|ConvertTo-Json -Depth 12|ConvertFrom-Json;Reject {Assert-Test125ReadPairTransition $copy Current} 'TEST125_READPAIR_NOT_ISSUED'
 $old=$t.apiPort;$t.apiPort=999;Reject {Assert-Test125ReadPairTransition $t Current} 'TEST125_READPAIR_NOT_ISSUED';$t.apiPort=$old
 $r=Invoke-Test125ReadPairApiTransition $t Candidate;if($r.status-cne'API_COMPONENT_VERIFIED'-or$global:apiStops-ne1-or$global:stopCalls-ne1-or$global:startCalls-ne1){throw 'CANDIDATE'}
 [void](Assert-Test125ReadPairTransition $t Candidate);$r=Invoke-Test125ReadPairApiTransition $t Candidate;if($r.status-cne'ALREADY_VERIFIED'-or$global:apiStops-ne1){throw 'REPLAY'}
 $r=Invoke-Test125ReadPairApiTransition $t Rollback;if($r.status-cne'API_COMPONENT_VERIFIED'-or$global:apiStops-ne2-or$global:stopCalls-ne2-or$global:startCalls-ne2){throw 'ROLLBACK'}
 Reject {Invoke-Test125ReadPairApiTransition $t Candidate} 'TEST125_READPAIR_CANDIDATE_ALREADY_ATTEMPTED';if($global:apiStops-ne2-or$global:stopCalls-ne2-or$global:startCalls-ne2){throw 'TOKEN_REPLAY'}
 [void](Assert-Test125ReadPairTransition $t Current);$a=Get-Content -Raw $api|ConvertFrom-Json;if($a.untouched-cne'private-fixture'-or$a.goal8SyntheticDaySeal.packageId-cne'CANONICAL-TEST125-BUSINESS5244-10cdc0ee'){throw 'PROFILE_RESTORE'};'PASS'`),'PASS');}
 finally{const resolved=fs.realpathSync(temp);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert(path.basename(resolved).startsWith('melisa-read2b-'));assert(!fs.lstatSync(resolved).isSymbolicLink());fs.rmSync(resolved,{recursive:true});}
});
test('partial profile CAS failure rolls back only the retained paused API; fresh profile drift rejects before stop',win,()=>{
 for(const scenario of ['partial','drift']){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-read2b-'));
 try{assert.equal(run(`$temp=${q(temp)};${fixture}
 $t=New-Test125ReadPairTransition
 if('${scenario}'-ceq'drift'){
  [IO.File]::AppendAllText($api,' ');Reject {Assert-Test125ReadPairTransition $t Current} 'TEST125_READPAIR_PROFILE_DRIFT';if($global:stopCalls-ne0-or$global:apiStops-ne0){throw 'EFFECT_ON_DRIFT'}
 }else{
  $originalCas=(Get-Command Write-Test125ReadPairCas).ScriptBlock;$global:failStartup=$true
  function Write-Test125ReadPairCas{param($Path,$Expected,[byte[]]$Bytes);if($global:failStartup-and$Path-ceq$startup){throw 'FIXTURE_STARTUP_CAS_FAILURE'};&$originalCas $Path $Expected $Bytes}
  function Assert-Test125ReadPairPaused{param($Context);if($global:taskRunning-or!$Context.activeBinding.held-or!$Context.activeBinding.stopped-or!$Context.apiChanged-or$Context.changed){throw 'PAUSE_SCOPE'};if((Get-FileHash $api).Hash.ToLowerInvariant()-cne$Context.token.apiProfileCandidateSha256){throw 'PAUSED_HASH'}}
  Reject {Invoke-Test125ReadPairApiTransition $t Candidate} 'FIXTURE_STARTUP_CAS_FAILURE';if($global:startCalls-ne0-or$global:apiStops-ne1){throw 'FAILED_START'}
  $global:failStartup=$false;$r=Invoke-Test125ReadPairApiTransition $t Rollback
  if($r.mode-cne'Current'-or$global:apiStops-ne1-or$global:stopCalls-ne1-or$global:startCalls-ne1){throw 'SECOND_API_EFFECT'};[void](Assert-Test125ReadPairTransition $t Current)
 };'PASS'`),'PASS');}
 finally{const resolved=fs.realpathSync(temp);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert(path.basename(resolved).startsWith('melisa-read2b-'));assert(!fs.lstatSync(resolved).isSymbolicLink());fs.rmSync(resolved,{recursive:true});}
 }
});
test('unhealthy resumed API timeout without publication evidence refuses rollback without a second stop or CAS',win,()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-read2b-'));
 try{assert.equal(run(`$temp=${q(temp)};${fixture}
 $t=New-Test125ReadPairTransition
 $definition=(Get-Command Invoke-Test125ReadPairApiTransition).Definition
 if([regex]::Matches($definition,[regex]::Escape('AddSeconds(300)')).Count-ne1){throw 'TIMEOUT_FIXTURE_SOURCE'}
 $definition=$definition.Replace('AddSeconds(300)','AddSeconds(0)');. ([scriptblock]::Create('function Invoke-Test125ReadPairApiTransition {'+$definition+'}'))
 $originalPlan=(Get-Command Get-Test125BoundMaintenancePlan).ScriptBlock
 function Get-Test125BoundMaintenancePlan{param($RunId,[switch]$ReadPairPreparation,$ReadPairMode);if($global:startCalls-gt0){throw 'FIXTURE_API_NOT_HEALTHY'};&$originalPlan -RunId $RunId -ReadPairPreparation:$ReadPairPreparation -ReadPairMode $ReadPairMode}
 function Start-Sleep{param($Milliseconds)}
 $originalCas=(Get-Command Write-Test125ReadPairCas).ScriptBlock;$global:casCount=0
 function Write-Test125ReadPairCas{param($Path,$Expected,[byte[]]$Bytes);$global:casCount++;&$originalCas $Path $Expected $Bytes}
 Reject {Invoke-Test125ReadPairApiTransition $t Candidate} 'TEST125_READPAIR_API_READY_TIMEOUT'
 $contract=Get-Test125ReadPairTransitionContract $t
 if($contract.phase-cne'FAILED'-or$null-ne$script:Test125ReadPairContext.activeBinding-or$global:stopCalls-ne1-or$global:startCalls-ne1-or$global:apiStops-ne1-or$global:casCount-ne2){throw 'FAILED_STATE'}
 $startupHash=(Get-FileHash $startup).Hash;$apiHash=(Get-FileHash $api).Hash
 Reject {Invoke-Test125ReadPairApiTransition $t Rollback} 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'
 if($global:stopCalls-ne1-or$global:startCalls-ne1-or$global:apiStops-ne1-or$global:casCount-ne2-or(Get-FileHash $startup).Hash-cne$startupHash-or(Get-FileHash $api).Hash-cne$apiHash){throw 'SECOND_EFFECT'};'PASS'`),'PASS');}
 finally{const resolved=fs.realpathSync(temp);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert(path.basename(resolved).startsWith('melisa-read2b-'));assert(!fs.lstatSync(resolved).isSymbolicLink());fs.rmSync(resolved,{recursive:true});}
});
test('direct recovery helper calls require the registered issued context before any external IO or handle access',win,()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-read2b-'));
 try{assert.equal(run(`$temp=${q(temp)};${fixture}
 $token=New-Test125ReadPairTransition;$context=$script:Test125ReadPairContext;$copy=$context.PSObject.Copy();$global:external=0
 function Read-ErpStartupConfig{param($Path);$global:external++;throw 'UNEXPECTED_IO'};function Initialize-Test125ApiKernel{$global:external++;throw 'UNEXPECTED_KERNEL'};function Get-Test125ReadPairTask{$global:external++;throw 'UNEXPECTED_COM'}
 foreach($helper in @('Get-Test125ReadPairFailedStartEvidence','Open-Test125ReadPairFailedStart','Stop-Test125ReadPairFailedApi')){
  foreach($foreign in @($null,[pscustomobject]@{},[pscustomobject]@{token=$token},$copy)){Reject {&$helper $foreign} 'TEST125_READPAIR_NOT_ISSUED'}
  $thread=$context.thread;$context.thread=$thread+1;Reject {&$helper $context} 'TEST125_READPAIR_NOT_ISSUED';$context.thread=$thread
  $process=$context.pid;$context.pid=$process+1;Reject {&$helper $context} 'TEST125_READPAIR_NOT_ISSUED';$context.pid=$process
 };if($global:external-ne0){throw 'FOREIGN_CONTEXT_IO'};'PASS'`),'PASS');}
 finally{const resolved=fs.realpathSync(temp);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert(path.basename(resolved).startsWith('melisa-read2b-'));assert(!fs.lstatSync(resolved).isSymbolicLink());fs.rmSync(resolved,{recursive:true});}
});
const recoveryFixture=String.raw`
Add-Type -TypeDefinition @"
using System;public sealed class OfflinePairHandle:IDisposable{public long Birth;public bool Closed;public static int Disposals=0;public void Dispose(){Closed=true;Disposals++;}}
public static class Test125ApiKernel{public static bool Gone=false;public static int Opens=0,Stops=0;public static OfflinePairHandle Open(int p,long b){Opens++;return new OfflinePairHandle{Birth=b};}public static bool Exited(OfflinePairHandle h,long b){if(h.Closed||h.Birth!=b)throw new Exception("HANDLE");return Gone;}public static void Stop(OfflinePairHandle h,long b){if(h.Closed||h.Birth!=b||Gone)throw new Exception("HANDLE");Stops++;Gone=true;}}
"@
$global:case='CASE';$stamp='2026-10-28T00:00:00.1234560Z';$recordPath=Join-Path $temp 'owned-processes.json'
$config|Add-Member RuntimeDir $temp;$config|Add-Member NodePath 'C:\fixture\node.exe';[IO.File]::WriteAllText($startup,($config|ConvertTo-Json -Depth 30))
$originalPlan=(Get-Command Get-Test125BoundMaintenancePlan).ScriptBlock
function Get-Test125BoundMaintenancePlan{param($RunId,[switch]$ReadPairPreparation,$ReadPairMode);if($global:startCalls-eq1-and$global:case-cne'healthy'){throw 'FIXTURE_API_NOT_HEALTHY'};$a=&$originalPlan -RunId $RunId -ReadPairPreparation:$ReadPairPreparation -ReadPairMode $ReadPairMode;$a.children.native.birth=$stamp;$a.children.web.birth=$stamp;return $a}
$originalStart=(Get-Command Start-ScheduledTask).ScriptBlock
function Start-ScheduledTask{param($TaskName,$TaskPath);&$originalStart $TaskName $TaskPath;$record=@{sourceCommit=$originalScope.source;supervisor=$global:supervisor;children=@{api=@{pid=$global:apiPid;createdAt=$stamp};native=@{pid=400;createdAt=$stamp};web=@{pid=401;createdAt=$stamp}}};[IO.File]::WriteAllText($recordPath,($record|ConvertTo-Json -Depth 15))}
$originalStop=(Get-Command Stop-ScheduledTask).ScriptBlock
function Stop-ScheduledTask{param($TaskName,$TaskPath);&$originalStop $TaskName $TaskPath;if($global:case-ceq'exited'-and$global:stopCalls-eq2){[Test125ApiKernel]::Gone=$true}}
function Get-FileHash{param($LiteralPath,$Algorithm);if($LiteralPath-like'*start-owned-test.ps1'){return [pscustomobject]@{Hash='fixture-launcher'}};return Microsoft.PowerShell.Utility\Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256}
function MakeRow([int]$Id,[bool]$Supervisor){
 $row=[Microsoft.Management.Infrastructure.CimInstance]::new('Win32_Process','root/cimv2');$exe=if($Supervisor){Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'}else{'C:\fixture\node.exe'};$args=if($Supervisor){'fixture-supervisor-args'}else{'"fixture-api" "'+$api+'"'};if($global:case-ceq'argv'-and!$Supervisor){$args='foreign'}
 foreach($f in @(@('ProcessId',[uint32]$Id,[Microsoft.Management.Infrastructure.CimType]::UInt32),@('ParentProcessId',[uint32]$(if($Supervisor){1}elseif($global:case-ceq'parent'){99999}else{$global:supervisor}),[Microsoft.Management.Infrastructure.CimType]::UInt32),@('ExecutablePath',$exe,[Microsoft.Management.Infrastructure.CimType]::String),@('CommandLine',('"'+$exe+'" '+$args),[Microsoft.Management.Infrastructure.CimType]::String),@('CreationDate',$(if($Supervisor-and$global:case-ceq'supervisor-birth'-and$script:Test125ReadPairContext.phase-ceq'FAILED'){[datetime]::Parse($stamp).AddSeconds(1)}else{[datetime]::Parse($stamp)}),[Microsoft.Management.Infrastructure.CimType]::DateTime))){$row.CimInstanceProperties.Add([Microsoft.Management.Infrastructure.CimProperty]::Create($f[0],$f[1],$f[2],[Microsoft.Management.Infrastructure.CimFlags]::None))};return $row
}
function Get-ErpProcess{param($ProcessId);if(!$global:taskRunning-and$ProcessId-eq$global:supervisor){return $null};if($ProcessId-eq$global:supervisor){return MakeRow $ProcessId $true};if($ProcessId-eq$global:apiPid){if([Test125ApiKernel]::Gone){return $null};return MakeRow $ProcessId $false};return $null}
function Invoke-CimMethod{param($InputObject,$MethodName);if($MethodName-cne'GetOwnerSid'-or$InputObject-isnot[Microsoft.Management.Infrastructure.CimInstance]){throw 'NATIVE_QUERY'};if($global:case-ceq'record-drift'-and[Test125ApiKernel]::Opens-gt0){[IO.File]::AppendAllText($recordPath,' ')};return [pscustomobject]@{ReturnValue=0;Sid=$(if($global:case-ceq'foreign-owner'){'foreign'}else{$config.OwnerSid})}}
function Get-ScheduledTask{param($TaskName,$TaskPath);if($TaskName-cne'Melisa-ERP-TEST-Canonical'-or$TaskPath-cne'\'){throw 'TASK'};return [pscustomobject]@{Fixture=$true}}
function Assert-Test125MaintenanceTask{param($Task,$Config,$Path);if(!$Task.Fixture-or$Path-cne$startup){throw 'TASK_ACTION'};return @{Executable=(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe');Arguments='fixture-supervisor-args'}}
function Get-ErpServiceDefinitions{param($Config);return @(@{Name='api';Port=4144;Script='fixture-api';Args=@($api)})}
function Get-ErpServiceListeners{param($Definition,$Config);if($Definition.Port-ne4144){throw 'PORT'};if($global:case-ceq'foreign-listener'){return @([pscustomobject]@{OwningProcess=99999})};if([Test125ApiKernel]::Gone-or$global:case-ceq'no-listener'){return @()};return @([pscustomobject]@{OwningProcess=$global:apiPid})}
function Assert-Test125ApiStoppedSupervisor{param($b);if($global:taskRunning-or![object]::ReferenceEquals($b,$script:Test125ApiBinding)-or$b.config.ApiComponent.ManifestSha256-cne$originalScope.candidate.ManifestSha256){throw 'FAILED_BINDING'}}
function Test-Test125ApiPhysicalPause{param($b);if(!$b.stopped-or($script:Test125ReadPairContext.failedStartProof-and![Test125ApiKernel]::Gone)){throw 'NOT_STOPPED'};return $true}
function Close-Test125ApiQuiescence{param($b);if($b.PSObject.Properties['handle']){$b.handle.Dispose();$script:Test125ApiBinding=$null}}
$definition=(Get-Command Invoke-Test125ReadPairApiTransition).Definition;$definition=$definition.Replace('AddSeconds(300)','AddSeconds(0)');. ([scriptblock]::Create('function Invoke-Test125ReadPairApiTransition {'+$definition+'}'))
function Start-Sleep{param($Milliseconds)}
`;
test('failed-start evidence functions recover only the owned candidate and retain foreign/missing-proof refusals',win,()=>{
 for(const scenario of ['healthy','ok','no-listener','exited','exited-before-rollback','foreign-owner','parent','argv','record-drift','missing-record','record-owner','record-birth','foreign-listener','missing-anchor','com-drift','multiple-com','supervisor-birth','record-source']){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-read2b-'));
 try{assert.equal(run(`$temp=${q(temp)};${fixture};${recoveryFixture.replace("'CASE'",q(scenario))}
 $t=New-Test125ReadPairTransition;$realCas=(Get-Command Write-Test125ReadPairCas).ScriptBlock;$global:casCount=0;function Write-Test125ReadPairCas{param($Path,$Expected,[byte[]]$Bytes);$global:casCount++;&$realCas $Path $Expected $Bytes}
 if('${scenario}'-ceq'healthy'){$r=Invoke-Test125ReadPairApiTransition $t Candidate;if($r.status-cne'API_COMPONENT_VERIFIED'-or[Test125ApiKernel]::Opens-ne1-or[OfflinePairHandle]::Disposals-ne1-or$script:Test125ApiBinding-or$script:Test125ReadPairContext.failedStartProof-or$script:Test125ReadPairContext.admission.supervisor-ne$global:supervisor){throw 'HEALTHY_EARLY_CAPTURE'}}else{Reject {Invoke-Test125ReadPairApiTransition $t Candidate} 'TEST125_READPAIR_API_READY_TIMEOUT'}
 if('${scenario}'-ceq'exited-before-rollback'){[Test125ApiKernel]::Gone=$true}
 if('${scenario}'-ceq'missing-record'){[IO.File]::Delete($recordPath)}
 if('${scenario}'-cin@('record-owner','record-birth')){$r=Get-Content -Raw $recordPath|ConvertFrom-Json;if('${scenario}'-ceq'record-owner'){$r.supervisor=99999}else{$r.children.api.createdAt='2026-10-28T00:00:01.1234560Z'};[IO.File]::WriteAllText($recordPath,($r|ConvertTo-Json -Depth 15))}
 if('${scenario}'-ceq'missing-anchor'){$script:Test125ReadPairContext.resumedInstance=$null}
 if('${scenario}'-ceq'record-source'){$r=Get-Content -Raw $recordPath|ConvertFrom-Json;$r.sourceCommit='foreign';[IO.File]::WriteAllText($recordPath,($r|ConvertTo-Json -Depth 15))}
 if('${scenario}'-cin@('com-drift','multiple-com')){$oldTask=(Get-Command Get-Test125ReadPairTask).ScriptBlock;function Get-Test125ReadPairTask{$task=&$oldTask;$task|Add-Member ScriptMethod GetInstances {param($unused);$n=if($global:case-ceq'multiple-com'){2}else{1};$list=[pscustomobject]@{Count=$n};$list|Add-Member ScriptMethod Item {param($index);return [pscustomobject]@{InstanceGuid='foreign-guid';EnginePID=$global:supervisor}};return $list} -Force;return $task}}
 if('${scenario}'-ceq'healthy'){[void](Assert-Test125ReadPairTransition $t Candidate);if($global:stopCalls-ne1-or$global:startCalls-ne1-or$global:casCount-ne2){throw 'HEALTHY_COUNTS'}}elseif('${scenario}'-cin@('ok','no-listener','exited','exited-before-rollback')){
  $r=Invoke-Test125ReadPairApiTransition $t Rollback;if($r.mode-cne'Current'-or$global:stopCalls-ne2-or$global:startCalls-ne2-or$global:apiStops-ne1-or$global:casCount-ne4){throw 'ROLLBACK'}
  $expected=if('${scenario}'-cin@('exited','exited-before-rollback')){0}else{1};if([Test125ApiKernel]::Stops-ne$expected-or[Test125ApiKernel]::Opens-ne1){throw 'EXACT_HANDLE'}
  [void](Assert-Test125ReadPairTransition $t Current);$r=Invoke-Test125ReadPairApiTransition $t Rollback;if($r.status-cne'ALREADY_VERIFIED'-or$global:casCount-ne4-or$global:stopCalls-ne2){throw 'REPLAY'}
 }else{
  $startupHash=(Get-FileHash $startup).Hash;$apiHash=(Get-FileHash $api).Hash;Reject {Invoke-Test125ReadPairApiTransition $t Rollback} 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'
  if($global:stopCalls-ne1-or$global:startCalls-ne1-or$global:casCount-ne2-or[Test125ApiKernel]::Stops-ne0-or(Get-FileHash $startup).Hash-cne$startupHash-or(Get-FileHash $api).Hash-cne$apiHash){throw 'SECOND_EFFECT'}
 };'PASS'`),'PASS',scenario);}
 finally{const resolved=fs.realpathSync(temp);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert(path.basename(resolved).startsWith('melisa-read2b-'));assert(!fs.lstatSync(resolved).isSymbolicLink());fs.rmSync(resolved,{recursive:true});}
 }
});
test('new source preserves only API target, existing handle stop, two-field component and single seal delta',()=>{
 const s=fs.readFileSync(file,'utf8'),p=fs.readFileSync(plan,'utf8');assert.match(s,/ReferenceEquals\(\$Transition,\$c.token\)/);assert.match(s,/Open-Test125ApiQuiescence \$c.admission \$Transition.scope/);assert.match(s,/Stop-Test125BoundApi \$c.activeBinding/);assert.match(s,/DataProtectionScope\]::CurrentUser/);assert.match(s,/FileShare\]::None/);assert.match(s,/apiNext.goal8SyntheticDaySeal.packageId=\$manifest.packageId/);assert.doesNotMatch(s,/Stop-Process|Invoke-Sqlcmd|Register-ScheduledTask|Start-Process/);assert.match(p,/ReadPairPreparation\)\{if\(\$RunId-cne\(Get-Test125ReadPairScope\).name/);
});
