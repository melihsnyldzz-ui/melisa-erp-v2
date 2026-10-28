import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function run(body){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'erp-5244-owned-test-'));
 try{
  const file=path.join(temp,'run.ps1');fs.writeFileSync(file,"$ErrorActionPreference='Stop'\n"+body);
  return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:20000,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
// Every invocation has its own mkdtemp root. Exercise the production lease
// implementation without ever competing for the installed owner's global gate
// or reading its recovery marker. Nested legacy imports need this adapter too.
const isolatedStartup=String.raw`function Get-Business5244StartupMutexName{return ('Local\MelisaOwnedFixture-'+[IO.Path]::GetFileName($env:TEMP))};function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'fixture.retirement.pending')};`;
const load=`. ${quote(path.join(dir,'start-business-5244-owned.ps1'))} -Library;${isolatedStartup}`;
const initRecoveryFixture=String.raw`
function Get-Business5244StartupMutexName{return ('Local\MelisaB6Init-'+[IO.Path]::GetFileName($env:TEMP))}
$script:initRecords=Join-Path $env:TEMP 'records.json';$script:initPending=Join-Path $env:TEMP 'retirement.pending';$script:ownedLease=$null;$script:initNative=$null;$script:initFailureMode='channel'
function Get-Business5244RetirementPendingPath{return $script:initPending}
$pins=Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Current
$rows=@([pscustomobject]@{port=4194;pid=111;entry='preserve-api'},[pscustomobject]@{port=4196;pid=112;entry='preserve-native'},[pscustomobject]@{port=5244;pid=16084;entry='vite-preview';sourceCommit=$pins.frontendSource;root=$pins.root;backendPort=4144;businessWorkfaceId=$pins.profile})
$script:initBefore=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));[IO.File]::WriteAllBytes($script:initRecords,$script:initBefore);$script:initHash=Get-Business5244StartupHash $script:initBefore
function Get-Business5244CurrentBootstrapPins($BeforeHash,$ScopeName){if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'ISOLATED_SCOPE'};return @{hash=$script:initHash;pid=16084;ownerPid=49668;root=$pins.root;source=$pins.frontendSource}}
function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'-or$Filter-cnotin@('ProcessId=16084','ProcessId=49668')){throw 'ISOLATED_FOREIGN_PID_READ'};return $null}
function Get-NetTCPConnection($State,$LocalPort){if($State-cne'Listen'-or$LocalPort-ne5244){throw 'ISOLATED_FOREIGN_PORT_READ'};return @()}
function Assert-Business5244CreatedChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'ISOLATED_CHILD_NOT_LIVE'}}
function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
function New-Business5244PinnedChild($Pins,$Lease){$script:ownedLease=$Lease;Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$file=Join-Path $env:TEMP 'init-child.ps1';[IO.File]::WriteAllText($file,'Start-Sleep -Seconds 60');$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$file+'"'),$env:TEMP);$script:initNative=$n;return $n}
foreach($name in @('Publish-Business5244CurrentRecord','Undo-Business5244CurrentBootstrap')){$body=(Get-Command $name).Definition.Replace('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json',$script:initRecords);. ([scriptblock]::Create('function '+$name+' {'+$body+'}'))}
function Open-Business5244RetirementChannel($OwnerLease){if($script:initFailureMode-ceq'drift'){[IO.File]::AppendAllText($script:initRecords,' ')};throw 'ISOLATED_PRECHANNEL_FAILURE'}
`;
win('production native child creation retains its creation handle and stops only that child',()=>{
 assert.equal(run(`${load} Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$script=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($script,'Start-Sleep -Seconds 300');try{$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$script+'"'),$env:TEMP);if(!$n.ChildAlive() -or $n.ChildPid -le 0){throw 'CHILD_NOT_LIVE'};$birth=$n.ChildBirth;$n.Stop();if($n.ChildAlive() -or $n.ChildBirth -cne $birth){throw 'STOP_NOT_BOUND'};$denied=$false;try{$n.Stop()}catch{$denied=$true};if(!$denied){throw 'STOP_REPLAY'}}finally{$n.Dispose()};'PASS'`),'PASS');
});
win('production native disposal confirms child exit before returning ownership',()=>{
 assert.equal(run(`${load}Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$script=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($script,'Start-Sleep -Seconds 300');$p=$null;try{$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$script+'"'),$env:TEMP);$p=[Diagnostics.Process]::GetProcessById($n.ChildPid);$null=$p.Handle;$n.Dispose();if(!$p.WaitForExit(1000)){throw 'LEASE_COULD_OPEN_BEFORE_CHILD_EXIT'}}finally{if($p){$p.Dispose()};$n.Dispose()};'PASS'`),'PASS');
});
win('maintenance blocks both source launchers before package, environment or network work',()=>{
 assert.equal(run(`${load}$l=Enter-Business5244StartupLease -Kind Maintenance;try{foreach($name in @('Start-Business5244Web','Start-Business5244OwnedSupervisor')){$denied=$false;try{& $name|Out-Null}catch{if($_.Exception.Message -match 'BUSY|REENTRANT'){$denied=$true}else{throw}};if(!$denied){throw 'COOPERATIVE_START_OPEN'}}}finally{Exit-Business5244StartupLease -Lease $l};'PASS'`),'PASS');
});
win('owned startup releases its lease on package failure without starting or adopting anything',()=>{
 assert.equal(run(`${load}function Assert-Business5244OwnedPackage{throw 'ISOLATED_PACKAGE_FAILURE'};function Invoke-RestMethod{throw 'UNEXPECTED_NETWORK'};$denied=$false;try{Start-Business5244OwnedSupervisor|Out-Null}catch{if($_.Exception.Message -ceq 'ISOLATED_PACKAGE_FAILURE'){$denied=$true}else{throw}};if(!$denied){throw 'EXPECTED_FAILURE_MISSING'};$l=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease -Lease $l;'PASS'`),'PASS');
});
win('Current startup selects only the fixed 5cb package and leaves ReadPair as the explicit default',()=>{
 assert.equal(run(`${load}$script:chosen=$null;function Assert-Business5244OwnedPackage($Pins){$script:chosen=$Pins;throw 'ISOLATED_SLOT_CHECK'};foreach($slot in @('Current','current','ReadPair')){$denied=$false;try{Start-Business5244OwnedSupervisor -InitialSlot $slot|Out-Null}catch{if($_.Exception.Message -ceq 'ISOLATED_SLOT_CHECK'){$denied=$true}else{throw}};$expected=if($slot -ieq 'Current'){'ERP-BUSINESS-WEB-5244-5cb682d8'}else{'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'};if(!$denied -or $script:chosen.package -cne $expected){throw 'WRONG_FIXED_SLOT'}};'PASS'`),'PASS');
});
win('new package pins stay paired and generic B5 handoff remains closed',()=>{
 assert.equal(run(`${load}$p=Get-Business5244ReadPairPins;if($p.apiPackage -cne 'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213' -or $p.manifest -cne '91EE8B23C37A46EC89F8060967BC7A0106F68F2DE9A4A1F4199941CCE5A9E0FD'){throw 'PAIR_CHANGED'};. ${quote(path.join(dir,'clean-b5-pair-transition.ps1'))} -Library;$denied=$false;try{Get-B5WriterHandoff}catch{if($_.Exception.Message -ceq 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'){$denied=$true}else{throw}};if(!$denied){throw 'GENERIC_HANDOFF_OPEN'};'PASS'`),'PASS');
});
win('owned network readiness rejects foreign listeners, hidden child ports and incomplete bindings',()=>{
 assert.equal(run(`${load}$rows=@('100.87.188.3','127.0.0.1','192.168.1.46')|ForEach-Object {[pscustomobject]@{LocalPort=5244;OwningProcess=777;LocalAddress=$_}};Assert-Business5244OwnedListeners $rows 777;foreach($mode in @('foreign','extra','missing')){$bad=@($rows|ForEach-Object {$_.PSObject.Copy()});switch($mode){foreign{$bad[0].OwningProcess=778}extra{$bad+=,[pscustomobject]@{LocalPort=4144;OwningProcess=777;LocalAddress='127.0.0.1'}}missing{$bad=$bad[0..1]}};$denied=$false;try{Assert-Business5244OwnedListeners $bad 777}catch{$denied=$true};if(!$denied){throw 'LISTENER_SCOPE_OPEN'}};'PASS'`),'PASS');
});
win('B5 cleanup rejects a foreign owner and retains startup exclusion after a resource error',()=>{
 assert.equal(run(`${load}. ${quote(path.join(dir,'clean-b5-pair-transition.ps1'))} -Library;${isolatedStartup}$g=Enter-Business5244StartupLease -Kind Maintenance;$m=[Threading.Mutex]::new($false,('Local\\erp-5244-retirement-'+[Guid]::NewGuid().ToString('N')));$null=$m.WaitOne(0);$script:cleanupSeen=0;$a=[pscustomobject]@{};$a|Add-Member ScriptMethod Dispose {throw 'SYNTHETIC_DISPOSE_FAILURE'};$b=[pscustomobject]@{};$b|Add-Member ScriptMethod Dispose {$script:cleanupSeen++};$l=[pscustomobject]@{process=($PID+1);thread=[Threading.Thread]::CurrentThread.ManagedThreadId;mutex=$m;startupLease=$g;closed=$false;resources=@($a,$b)};$script:B5Lease=$l;try{$denied=$false;try{Exit-B5Lease $l}catch{if($_.Exception.Message -ceq 'B5_LEASE_EXIT_FOREIGN_OWNER'){$denied=$true}else{throw}};if(!$denied -or $l.closed -or $script:cleanupSeen){throw 'FOREIGN_CLEANUP_MUTATED'};$l.process=$PID;$denied=$false;try{Exit-B5Lease $l}catch{if($_.Exception.Message -ceq 'B5_LEASE_CLEANUP_UNCONFIRMED'){$denied=$true}else{throw}};if(!$denied -or $script:cleanupSeen -ne 1){throw 'RESOURCE_ATTEMPTS_INCOMPLETE'};Assert-Business5244StartupLease -Lease $g -Kind Maintenance;$denied=$false;try{Enter-Business5244StartupLease -Kind Owner|Out-Null}catch{if($_.Exception.Message -ceq 'BUSINESS_5244_STARTUP_BUSY'){$denied=$true}else{throw}};if(!$denied){throw 'UNCERTAIN_CLEANUP_OPENED_GATE'}}finally{Exit-Business5244StartupLease -Lease $g};'PASS'`),'PASS');
});
win('changed source scripts parse under Windows PowerShell',()=>{
 assert.equal(run(`foreach($file in @(${['start-business-5244-owned.ps1','start-business-5244-web.ps1','clean-b5-pair-transition.ps1'].map(x=>quote(path.join(dir,x))).join(',')})){$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){throw 'PARSE_FAILED'}};'PASS'`),'PASS');
});
win('B6 pre-channel failure restores its own bootstrap and issues code73 only for the original exception after complete cleanup',()=>{
 assert.equal(run(load+initRecoveryFixture+String.raw`
 $failure=$null;try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$failure=$_}
 if(!$failure-or$failure.Exception.Message-cne'ISOLATED_PRECHANNEL_FAILURE'-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne73-or!$script:initNative.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-cne$script:initHash-or(Test-Path -LiteralPath $script:initPending)){throw 'INIT_VERIFIED_EXIT_NOT_BOUND'}
 foreach($arg in @($null,([Exception]::new('ISOLATED_PRECHANNEL_FAILURE')),($failure.Exception|ConvertTo-Json -Depth 4|ConvertFrom-Json))){if((Get-Business5244VerifiedInitializationExitCode $arg)-ne1){throw 'INIT_EXIT_COPY_ADMITTED'}}
 $o=$script:Business5244LastInitializationOutcome;$o.thread++;if((Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1){throw 'INIT_EXIT_FOREIGN_THREAD'};$o.thread--
 $l=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $l;'PASS'`),'PASS');
});
win('B6 init record drift prevents restoration and code73 while preserving exclusion even after owned child cleanup',()=>{
 assert.equal(run(load+initRecoveryFixture+String.raw`
 $script:initFailureMode='drift';$failure=$null
 try{try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$failure=$_}
  if(!$failure-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1-or!$script:initNative.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-ceq$script:initHash){throw 'INIT_DRIFT_FALSE_OUTCOME'}
  Assert-Business5244StartupLease $script:ownedLease -Kind Owner
 }finally{if($script:ownedLease){Exit-Business5244StartupLease $script:ownedLease}};'PASS'`),'PASS');
});
win('B6 verified bootstrap inverse cannot issue code73 when later cleanup or lease release remains unconfirmed',()=>{
 assert.equal(run(load+initRecoveryFixture+String.raw`
 function Close-Business5244PinnedChildren($Lease){throw 'ISOLATED_FINAL_CLEANUP_FAILURE'}
 $failure=$null;try{try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$failure=$_}
  if(!$failure-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1-or!$script:initNative.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-cne$script:initHash){throw 'INIT_CLEANUP_FALSE_OUTCOME'}
  Assert-Business5244StartupLease $script:ownedLease -Kind Owner
 }finally{if($script:ownedLease){Exit-Business5244StartupLease $script:ownedLease}};'PASS'`),'PASS');
});
win('owner initialization rejects differently cased scope names before acquiring a lease or creating any child',()=>{
 assert.equal(run(load+String.raw`
 function Enter-Business5244StartupLease {throw 'UNEXPECTED_LEASE_ACQUISITION'}
 foreach($scope in @('test125-api-b6-ca620bac-20261028','TEST125-api-READ2b-20261028-41d3c213')){$denied=$false;try{Start-Business5244OwnedSupervisor -ScopeName $scope|Out-Null}catch{if($_.Exception.Message-cne'OWNED_WEB_SCOPE_REJECTED'){throw};$denied=$true};if(!$denied){throw 'CASED_SCOPE_ADMITTED'}};'PASS'`),'PASS');
});
win('startup publication observation is true only for the actual B6 bootstrap and a published channel cannot obtain init inverse code73',()=>{
 assert.equal(run(load+initRecoveryFixture+String.raw`
 $script:fakeChannel=[pscustomobject]@{opaque='isolated-channel'}
 function Open-Business5244RetirementChannel{return $script:fakeChannel}
 function Close-Business5244RetirementChannel($Channel){if(![object]::ReferenceEquals($Channel,$script:fakeChannel)){throw 'ISOLATED_FOREIGN_CHANNEL'}}
 function Receive-Business5244RetirementRequest {throw 'ISOLATED_AFTER_CHANNEL_PUBLISHED'}
 foreach($scope in @('TEST125-API-B6-ca620bac-20261028','TEST125-API-READ2b-20261028-41d3c213')){
  $seen=[Collections.Generic.List[object]]::new();$failure=$null
  try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName $scope|ForEach-Object{$seen.Add($_)}}catch{$failure=$_}
  $expected=$scope-ceq'TEST125-API-B6-ca620bac-20261028'
  if(!$failure-or$failure.Exception.Message-cne'ISOLATED_AFTER_CHANNEL_PUBLISHED'-or$seen.Count-ne1-or$seen[0].installedRecordPublished-ne$expected-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1-or!$script:initNative.RetirementConfirmed){throw 'STARTUP_PUBLICATION_CLAIM_OR_LATE_INVERSE'}
 }
 'PASS'`),'PASS');
});
win('finite B6 startup chooses READ2b Current or B6 Candidate without changing the default pair',()=>{
 assert.equal(run(`${load}
 function Get-Business5244StartupMutexName{return ('Local\\MelisaB6Slots-'+[IO.Path]::GetFileName($env:TEMP))}
 $script:chosen=$null;function Assert-Business5244OwnedPackage($Pins){$script:chosen=$Pins;throw 'ISOLATED_B6_SLOT_CHECK'}
 foreach($scope in @('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')){foreach($slot in @('Current','ReadPair')){$denied=$false;try{Start-Business5244OwnedSupervisor -InitialSlot $slot -ScopeName $scope|Out-Null}catch{if($_.Exception.Message-cne'ISOLATED_B6_SLOT_CHECK'){throw};$denied=$true};$pins=Get-Business5244FinitePairPins -ScopeName $scope -Mode $(if($slot-ceq'Current'){'Current'}else{'Candidate'});if(!$denied-or$script:chosen.package-cne$pins.package-or$script:chosen.apiManifest-cne$pins.apiManifest){throw 'B6_START_SCOPE_CHANGED'}}};'PASS'`),'PASS');
});
win('finite B6 maintenance plan binds its registered scope to the issued API contract and exact READ2b rollback',()=>{
 assert.equal(run(`${load}
 function Get-Business5244StartupMutexName{return ('Local\\MelisaB6Plan-'+[IO.Path]::GetFileName($env:TEMP))}
 Initialize-Business5244WebNative;$lease=Enter-Business5244StartupLease -Kind Owner;$native=[Business5244WebNative]::new();$sleep=Join-Path $env:TEMP 'b6-sleep.ps1';[IO.File]::WriteAllText($sleep,'Start-Sleep -Seconds 60');$state=$null
 try{
  $native.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$sleep+'"'),$env:TEMP);$scope='TEST125-API-B6-ca620bac-20261028';$pins=Get-Business5244FinitePairPins -ScopeName $scope -Mode Current;$state=Register-Business5244OwnedRetirement $lease $native $pins -ScopeName $scope;$script:api=[pscustomobject]@{fixture='opaque'};$script:contractScope=$scope
  function Get-Test125ReadPairTransitionContract($Transition){if(![object]::ReferenceEquals($Transition,$script:api)){throw 'ISOLATED_UNISSUED_API'};return @{scope=$script:contractScope;contractSha256=('a'*64);mode='Current';phase='PREPARED'}}
  $plan=Get-Business5244MaintenancePlan $state $script:api;if($plan.candidate.package-cne'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028'-or$plan.rollback.package-cne'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'-or(Get-Business5244RetirementState $state).scopeName-cne$scope){throw 'B6_PLAN_SCOPE'}
  foreach($case in @('copy','wrong-contract','mixed-record')){$arg=$script:api;if($case-ceq'copy'){$arg=$arg.PSObject.Copy()}elseif($case-ceq'wrong-contract'){$script:contractScope='TEST125-API-READ2b-20261028-41d3c213'}else{(Get-Business5244RetirementState $state).pins.apiPackage='foreign'};$denied=$false;try{Get-Business5244MaintenancePlan $state $arg|Out-Null}catch{$denied=$true};if(!$denied-or!$native.ChildAlive()){throw 'B6_UNISSUED_PLAN_ACCEPTED'};$script:contractScope=$scope;(Get-Business5244RetirementState $state).pins=$pins.Clone()}
  $mixed=$pins.Clone();$mixed.manifest=('f'*64);$denied=$false;try{Register-Business5244OwnedRetirement $lease $native $mixed -ScopeName $scope|Out-Null}catch{if($_.Exception.Message-cne'RETIREMENT_FINITE_B6_PINS_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'B6_MIXED_REGISTRATION'}
 }finally{if($state){Close-Business5244RetirementState $state};$native.Dispose();Exit-Business5244StartupLease -Lease $lease};'PASS'`),'PASS');
});
win('B6 supervisor prepares the genuine native/profile reference before opening a request channel',()=>{
 assert.equal(run(`${load}
 function Get-Business5244StartupMutexName{return ('Local\\MelisaB6StartupBind-'+[IO.Path]::GetFileName($env:TEMP))}
 Initialize-Business5244WebNative;$script:native=[Business5244WebNative]::new();$script:config=[pscustomobject]@{fixture='startup'};$script:cap=[pscustomobject]@{fixture='native-owner-issued'};$script:api=[pscustomobject]@{fixture='api-owner-issued'};$script:events=[Collections.Generic.List[string]]::new();$sleep=Join-Path $env:TEMP 'b6-startup-sleep.ps1';[IO.File]::WriteAllText($sleep,'Start-Sleep -Seconds 60')
 function New-Business5244PinnedChild($Pins,$Lease){if($Pins.package-cne'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'){throw 'B6_WRONG_CURRENT'};$script:native.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$sleep+'"'),$env:TEMP);$script:childProcess=[Diagnostics.Process]::GetProcessById($script:native.ChildPid);[void]$script:childProcess.Handle;return $script:native}
 function Read-ErpStartupConfig($Path){if($Path-cne'C:\\Sirket\\ERP\\runtime\\canonical-test\\startup-config.json'){throw 'B6_WRONG_STARTUP'};return $script:config}
 function New-ErpBusinessSaleNativeProfileAdmission($Config){if(![object]::ReferenceEquals($Config,$script:config)){throw 'B6_NATIVE_WRONG_CONFIG'};$script:events.Add('native');return $script:cap}
 function New-Test125ReadPairTransition($ScopeName,$NativeProfileAdmission){if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or![object]::ReferenceEquals($NativeProfileAdmission,$script:cap)){throw 'B6_NATIVE_CAP_NOT_RETAINED'};$script:events.Add('api');return $script:api}
 function Prepare-Business5244PairedMaintenance($State,$ApiTransition){if((Get-Business5244RetirementState $State).scopeName-cne'TEST125-API-B6-ca620bac-20261028'-or![object]::ReferenceEquals($ApiTransition,$script:api)){throw 'B6_PAIR_CAP_NOT_RETAINED'};$script:events.Add('prepared')}
 function Open-Business5244RetirementChannel($OwnerLease){$script:events.Add('channel');throw 'ISOLATED_AFTER_PREPARED'}
 function Close-Test125ReadPairRequestAdmission($Transition){};function Assert-Test125ReadPairIssued($Transition){if(![object]::ReferenceEquals($Transition,$script:api)){throw 'B6_UNISSUED_CLEANUP'};return @{releaseProof=$script:api}};function Close-ErpReadPairReleaseProof($Proof){}
 # Only the external API-provider import is replaced; its issuer, IO and SQL
 # have separate native-context tests. The supervisor and real Job child run.
 $body=(Get-Command Start-Business5244OwnedSupervisor).Definition.Replace((". (Join-Path "+[char]36+"PSScriptRoot 'test125-bound-api-quiescence.ps1')"),'[void]0');. ([scriptblock]::Create('function Start-Business5244OwnedSupervisor {'+$body+'}'))
 $denied=$false;try{Start-Business5244OwnedSupervisor -ScopeName 'TEST125-API-B6-ca620bac-20261028' -InitialSlot Current -PrepareReadPair|Out-Null}catch{if($_.Exception.Message-cne'ISOLATED_AFTER_PREPARED'){throw};$denied=$true};try{if(!$denied-or($script:events-join'|')-cne'native|api|prepared|channel'-or!$script:childProcess.WaitForExit(1000)){throw 'B6_STARTUP_ORDER_OR_CLEANUP'}}finally{$script:childProcess.Dispose()};'PASS'`),'PASS');
});
