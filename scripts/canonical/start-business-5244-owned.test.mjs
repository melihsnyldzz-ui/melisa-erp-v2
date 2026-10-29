import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function run(body,{tempRoot,timeout=20000,isolatedModulePath=false}={}){
 const parent=fs.realpathSync.native(tempRoot||process.env.RUNNER_TEMP||os.tmpdir());
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'erp-5244-owned-test-')));
 try{
  const file=path.join(temp,'run.ps1');fs.writeFileSync(file,"$ErrorActionPreference='Stop'\n[Console]::Error.WriteLine('OWNED_FIXTURE_STAGE_BEGIN')\nforeach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Microsoft.PowerShell.Core\\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$module,($module+'.psd1'))) -Scope Local}\n[Console]::Error.WriteLine('OWNED_FIXTURE_STAGE_BUILTINS_READY')\n"+body+"\n[Console]::Error.WriteLine('OWNED_FIXTURE_STAGE_COMPLETE')\n");
  return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp,...(isolatedModulePath?{PSModulePath:path.join(temp,'unused-module-search')}:{})}}).trim();
 }finally{const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('erp-5244-owned-test-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true,force:true});}
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
function Get-InitFixtureFailureDiagnostic($Failure){
 $code='NO_FAILURE';$where='unknown';$phase='none';$retired=[bool]($script:initNative-and$script:initNative.RetirementConfirmed)
 if($Failure){$message=[string]$Failure.Exception.Message;$code=if($message-cmatch'^[A-Z][A-Z0-9_]{0,119}$'){$message}else{$Failure.Exception.GetType().Name};$stack=[regex]::Match([string]$Failure.ScriptStackTrace,'at ([A-Za-z][A-Za-z0-9_-]*),[^\r\n]*: line ([0-9]+)');if($stack.Success){$where=$stack.Groups[1].Value+':'+$stack.Groups[2].Value}}
 if($script:Business5244Retirements.Count){$last=$script:Business5244Retirements[$script:Business5244Retirements.Count-1];$phase=[string]$last.phase}
 $restored=(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-ceq$script:initHash
 return ('inner='+$code+';source='+$where+';nativeClosed='+$retired+';restored='+$restored+';pending='+(Test-Path -LiteralPath $script:initPending)+';phase='+$phase)
}
`;
win('fixture uses trusted Windows builtins even with an unavailable module search path',()=>{
 assert.equal(run(`${load} foreach($row in @(@('Join-Path','Microsoft.PowerShell.Management'),@('Get-FileHash','Microsoft.PowerShell.Utility'),@('Get-Acl','Microsoft.PowerShell.Security'))){$command=Get-Command $row[0] -Module $row[1] -ErrorAction Stop;$expected=[IO.Path]::Combine($PSHOME,'Modules',$row[1],($row[1]+'.psd1'));if(!$command.Module.Path.Equals($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'UNTRUSTED_FIXTURE_MODULE'}};'PASS'`,{isolatedModulePath:true}),'PASS');
});
win('production native child creation retains its creation handle and stops only that child',()=>{
 // This fixture includes cold Windows PowerShell/CIM startup on hosted runners.
 // Give only this whole test process a bounded minute; native stop/replay and
 // production owner admission deadlines below remain unchanged.
 assert.equal(run(`${load} Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$script=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($script,'Start-Sleep -Seconds 300');try{$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$script+'"'),$env:TEMP);if(!$n.ChildAlive() -or $n.ChildPid -le 0){throw 'CHILD_NOT_LIVE'};$birth=$n.ChildBirth;$n.Stop();if($n.ChildAlive() -or $n.ChildBirth -cne $birth){throw 'STOP_NOT_BOUND'};$denied=$false;try{$n.Stop()}catch{$denied=$true};if(!$denied){throw 'STOP_REPLAY'}}finally{$n.Dispose()};'PASS'`,{timeout:60000}),'PASS');
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
 if(!$failure-or$failure.Exception.Message-cne'ISOLATED_PRECHANNEL_FAILURE'-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne73-or!$script:initNative.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-cne$script:initHash-or(Test-Path -LiteralPath $script:initPending)){throw ('INIT_VERIFIED_EXIT_NOT_BOUND '+(Get-InitFixtureFailureDiagnostic $failure))}
 foreach($arg in @($null,([Exception]::new('ISOLATED_PRECHANNEL_FAILURE')),($failure.Exception|ConvertTo-Json -Depth 4|ConvertFrom-Json))){if((Get-Business5244VerifiedInitializationExitCode $arg)-ne1){throw 'INIT_EXIT_COPY_ADMITTED'}}
 $o=$script:Business5244LastInitializationOutcome;$o.thread++;if((Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1){throw 'INIT_EXIT_FOREIGN_THREAD'};$o.thread--
 $l=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $l;'PASS'`),'PASS');
});
win('B6 init record drift prevents restoration and code73 while preserving exclusion even after owned child cleanup',()=>{
 assert.equal(run(load+initRecoveryFixture+String.raw`
 $script:initFailureMode='drift';$failure=$null
 try{try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$failure=$_}
  if(!$failure-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1-or!$script:initNative.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-ceq$script:initHash){throw ('INIT_DRIFT_FALSE_OUTCOME '+(Get-InitFixtureFailureDiagnostic $failure))}
  Assert-Business5244StartupLease $script:ownedLease -Kind Owner
 }finally{if($script:ownedLease){Exit-Business5244StartupLease $script:ownedLease}};'PASS'`),'PASS');
});
win('B6 verified bootstrap inverse cannot issue code73 when later cleanup or lease release remains unconfirmed',()=>{
 assert.equal(run(load+initRecoveryFixture+String.raw`
 function Close-Business5244PinnedChildren($Lease){throw 'ISOLATED_FINAL_CLEANUP_FAILURE'}
 $failure=$null;try{try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$failure=$_}
  $actualState=$script:Business5244Retirements[$script:Business5244Retirements.Count-1]
  $inverseArchived=$actualState.ContainsKey('currentBootstrap')-and$actualState.currentBootstrap-and$actualState.currentBootstrap.inverse-and$actualState.currentBootstrap.inverse.phase-ceq'Archived'
  if(!$failure-or$failure.Exception.Message-cne'OWNED_WEB_CLEANUP_UNCONFIRMED'-or$actualState.phase-cne'InitializationRestored'-or!$inverseArchived-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1-or!$script:initNative.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-cne$script:initHash){throw ('INIT_CLEANUP_FALSE_OUTCOME '+(Get-InitFixtureFailureDiagnostic $failure))}
  Assert-Business5244StartupLease $script:ownedLease -Kind Owner
 }finally{if($script:ownedLease){Exit-Business5244StartupLease $script:ownedLease}};'PASS'`),'PASS');
});
win('owner initialization rejects differently cased scope names before acquiring a lease or creating any child',()=>{
 assert.equal(run(load+String.raw`
 function Enter-Business5244StartupLease {throw 'UNEXPECTED_LEASE_ACQUISITION'}
 foreach($scope in @('test125-api-b6-ca620bac-20261028','TEST125-api-READ2b-20261028-41d3c213')){$denied=$false;try{Start-Business5244OwnedSupervisor -ScopeName $scope|Out-Null}catch{if($_.Exception.Message-cne'OWNED_WEB_SCOPE_REJECTED'){throw};$denied=$true};if(!$denied){throw 'CASED_SCOPE_ADMITTED'}};'PASS'`),'PASS');
});
win('fixture canonicalizes an aliased runner temp root before native initialization while production reparse guards stay unchanged',()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),root=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-owned-temp-root-')));
 try{
  const physical=path.join(root,'physical'),redirect=path.join(root,'redirect');fs.mkdirSync(physical);fs.symlinkSync(physical,redirect,'junction');assert.equal(fs.realpathSync.native(redirect),fs.realpathSync.native(physical));
  assert.equal(run(load+initRecoveryFixture+String.raw`
   if($env:TEMP-clike'*\redirect\*'){throw 'TEST_ROOT_WAS_NOT_CANONICAL'}
   $failure=$null;try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$failure=$_}
   if(!$failure-or$failure.Exception.Message-cne'ISOLATED_PRECHANNEL_FAILURE'-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne73-or!$script:initNative.RetirementConfirmed){throw ('CANONICAL_TEMP_INIT_FAILED '+(Get-InitFixtureFailureDiagnostic $failure))};'PASS'`,{tempRoot:redirect}),'PASS');
 }finally{const full=fs.realpathSync.native(root);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('melisa-owned-temp-root-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true,force:true});}
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
  if(!$failure-or$failure.Exception.Message-cne'ISOLATED_AFTER_CHANNEL_PUBLISHED'-or$seen.Count-ne1-or$seen[0].installedRecordPublished-ne$expected-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne1-or!$script:initNative.RetirementConfirmed){throw ('STARTUP_PUBLICATION_CLAIM_OR_LATE_INVERSE '+(Get-InitFixtureFailureDiagnostic $failure))}
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

const packageHashFixture=String.raw`
Initialize-Business5244WebNative
$script:fixturePins=(Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate).Clone()
$fixturePins.root=Join-Path $env:TEMP 'owned-package';[void][IO.Directory]::CreateDirectory($fixturePins.root)
$fixturePins.node=Join-Path $fixturePins.root 'inert-node.bin';$payload=Join-Path $fixturePins.root 'payload.bin';$manifestPath=Join-Path $fixturePins.root 'release-manifest.json'
[IO.File]::WriteAllText($fixturePins.node,'inert-never-executed-node');[IO.File]::WriteAllText($payload,'unchanged-payload')
$fixturePins.nodeHash=(Get-FileHash -LiteralPath $fixturePins.node).Hash.ToLowerInvariant()
$manifest=[ordered]@{kind='ERP_BUSINESS_WORKFACE_WEB_CANDIDATE';packageId=$fixturePins.package;database='MELISA_ERP_SIRKET_TEST_20260929_01';sourceCommit=$fixturePins.frontendSource;businessWorkfaceId=$fixturePins.profile;backendPackageId=$fixturePins.apiPackage;backendManifestSha256=$fixturePins.apiManifest;actualT1=$false;externalOperations=$false;businessSessionSignerDomain='dedicated-business-key-v1';files=@(@{path='payload.bin';sha256=(Get-FileHash -LiteralPath $payload).Hash.ToLowerInvariant()})}
[IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 8));$fixturePins.manifest=(Get-FileHash -LiteralPath $manifestPath).Hash.ToLowerInvariant()
$script:originalPins=$fixturePins.Clone();$nodeBefore=[IO.File]::ReadAllBytes($fixturePins.node);$payloadBefore=[IO.File]::ReadAllBytes($payload);$manifestBefore=[IO.File]::ReadAllBytes($manifestPath)
function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$Mode-cne'Candidate'){throw 'ISOLATED_FIXED_PAIR_ONLY'};return $script:fixturePins.Clone()}
function Change-DigestDigit([string]$Hash){return $(if($Hash[0]-ceq'0'){'1'}else{'0'})+$Hash.Substring(1)}
`;
win('real package file hashes accept either hexadecimal case while exact tuples, content drift and native seal sharing remain enforced',()=>{
 assert.equal(run(load+packageHashFixture+String.raw`
 foreach($case in @('lower','upper')){
  $fixturePins.nodeHash=if($case-ceq'upper'){$originalPins.nodeHash.ToUpperInvariant()}else{$originalPins.nodeHash};$fixturePins.manifest=if($case-ceq'upper'){$originalPins.manifest.ToUpperInvariant()}else{$originalPins.manifest}
  if((Get-FileHash -LiteralPath $manifestPath).Hash-cne$originalPins.manifest.ToUpperInvariant()){throw 'ACTUAL_CMDLET_NOT_UPPERCASE'}
  Assert-Business5244OwnedPackage $fixturePins
  $seal=[Business5244PackageSeal]::new();try{Assert-Business5244OwnedPackage $fixturePins $seal;$seal.Freeze();$seal.Validate()
   foreach($file in @($fixturePins.node,$manifestPath,$payload)){$denied=$false;try{$f=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite);$f.Dispose()}catch{$denied=$true};if(!$denied){throw 'NATIVE_SEAL_LOST_WRITE_EXCLUSION'}}
  }finally{$seal.Dispose()}
 }
 foreach($kind in @('manifestDigit','nodeDigit','manifestBytes','nodeBytes','payloadBytes','tuple')){
  $script:fixturePins=$originalPins.Clone();[IO.File]::WriteAllBytes($fixturePins.node,$nodeBefore);[IO.File]::WriteAllBytes($payload,$payloadBefore);[IO.File]::WriteAllBytes($manifestPath,$manifestBefore);$pins=$fixturePins.Clone()
  switch($kind){manifestDigit{$fixturePins.manifest=Change-DigestDigit $fixturePins.manifest;$pins=$fixturePins.Clone()}nodeDigit{$fixturePins.nodeHash=Change-DigestDigit $fixturePins.nodeHash;$pins=$fixturePins.Clone()}manifestBytes{[IO.File]::AppendAllText($manifestPath,' ')}nodeBytes{[IO.File]::AppendAllText($fixturePins.node,'changed')}payloadBytes{[IO.File]::AppendAllText($payload,'changed')}tuple{$pins.profile+='-foreign'}}
  $caught='';try{Assert-Business5244OwnedPackage $pins}catch{$caught=$_.Exception.Message}
  $expected=if($kind-ceq'tuple'){'OWNED_WEB_PIN_CHANGED'}elseif($kind-ceq'payloadBytes'){'OWNED_WEB_CONTENT_CHANGED'}else{'OWNED_WEB_PACKAGE_CHANGED'}
  if($caught-cne$expected){throw ('REAL_PACKAGE_DRIFT_NOT_REJECTED_'+$kind+'_'+$caught)}
 }
 'PASS'`),'PASS');
});
win('readonly paired rollback manifest verification accepts the same digest case and rejects a single changed digest before child checks',()=>{
 assert.equal(run(load+packageHashFixture+String.raw`
 $script:fixtureNativeChecks=0;$script:fixtureNative=[pscustomobject]@{ChildPid=777;ChildBirth='1234';RetirementConfirmed=$false}
 $fixtureNative|Add-Member ScriptMethod Validate {$script:fixtureNativeChecks++};$fixtureNative|Add-Member ScriptMethod ChildAlive {return $true}
 $script:fixtureState=@{phase='Running';scopeName='TEST125-API-B6-ca620bac-20261028';pins=$fixturePins;native=$fixtureNative;childPid=777;childBirth='1234'};$script:fixtureTransition=[pscustomobject]@{fixture='read-only'}
 $script:fixturePlan=@{hash=('a'*64);candidate=$fixturePins;rollback=$fixturePins}
 function Get-Business5244RetirementState($State){if(![object]::ReferenceEquals($State,$script:fixtureState)){throw 'ISOLATED_STATE_CHANGED'};return $State}
 function Get-Business5244MaintenancePlan($State,$ApiTransition){return $script:fixturePlan}
 function Assert-Business5244PreparedPair($State,$ApiTransition,$PlanHash){if(![object]::ReferenceEquals($ApiTransition,$script:fixtureTransition)-or$PlanHash-cne$script:fixturePlan.hash){throw 'ISOLATED_PREPARED_REFERENCE_CHANGED'}}
 function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'ISOLATED_NETWORK_FORBIDDEN'};return @{fixture='not-network'}}
 function Assert-Business5244ApiHealth($Health,$Pins){}
 function Assert-Test125ReadPairRequestAdmission($Transition){if(![object]::ReferenceEquals($Transition,$script:fixtureTransition)){throw 'ISOLATED_TRANSITION_CHANGED'}}
 function Get-NetTCPConnection($State){if($State-cne'Listen'){throw 'ISOLATED_LISTEN_ONLY'};return @('100.87.188.3','127.0.0.1','192.168.1.46')|ForEach-Object{[pscustomobject]@{LocalPort=5244;LocalAddress=$_;OwningProcess=777}}}
 foreach($case in @('lower','upper','changed')){
  $fixturePins.manifest=if($case-ceq'upper'){$originalPins.manifest.ToUpperInvariant()}elseif($case-ceq'changed'){Change-DigestDigit $originalPins.manifest}else{$originalPins.manifest};$before=$fixtureNativeChecks;$caught=''
  try{Assert-Business5244MaintenancePlan $fixturePlan $fixtureState $fixtureTransition}catch{$caught=$_.Exception.Message}
  if($case-ceq'changed'){if($caught-cne'OWNED_WEB_ROLLBACK_MANIFEST_CHANGED'-or$fixtureNativeChecks-ne$before){throw 'ROLLBACK_DIGEST_DRIFT_ALLOWED'}}elseif($caught-or$fixtureNativeChecks-le$before){throw ('ROLLBACK_SAME_DIGEST_CASE_REJECTED_'+$caught)}
 }
 'PASS'`),'PASS');
});
