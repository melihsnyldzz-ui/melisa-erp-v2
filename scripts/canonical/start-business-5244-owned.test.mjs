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
win('maintenance admission reads fresh finite pins once per call and retains every hash pin and phase rejection',()=>{
 assert.equal(run(load+String.raw`
 $script:reads=0;$script:checks=0
 $keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')
 $script:fixed=@{};foreach($key in $keys){$fixed[$key]='fixture-'+$key};$fixed.root=$env:TEMP
 $script:r=@{phase='Running';scopeName='TEST125-API-B6-WRITER-20261029';pins=$fixed.Clone();native=[pscustomobject]@{}}
 function Get-Business5244RetirementState($State){return $script:r}
 function Test-Business5244WriterWebOnlyGeneration{return $true}
 function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$Mode-cne'Candidate'){throw 'FIXTURE_WRONG_PIN_SCOPE'};$script:reads++;return $script:fixed.Clone()}
 function Assert-Business5244PreparedPair{$script:checks++}
 function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'-or$TimeoutSec-ne3){throw 'FIXTURE_FOREIGN_HEALTH'};return @{fixture='health'}}
 function Assert-Business5244ApiHealth{$script:checks++}
 function Get-FileHash($LiteralPath){return @{Hash=$script:r.pins.manifest}}
 function Assert-Business5244CreatedChild{$script:checks++}
 function Assert-Business5244ReadyChild{$script:checks++}
 $state=[pscustomobject]@{fixture='state'}
 $plan=Get-Business5244MaintenancePlan $state
 $script:reads=0;Assert-Business5244MaintenancePlan $plan $state
 if($reads-ne1-or$checks-ne5){throw 'FIXTURE_FRESH_SOURCE_OR_GUARDS_MISSING'}
 Assert-Business5244MaintenancePlan $plan $state
 if($reads-ne2-or$checks-ne10){throw 'FIXTURE_CROSS_CALL_CACHE_OR_GUARD_SKIP'}
 foreach($side in @('candidate','rollback')){foreach($key in $keys){
  $copy=@{hash=$plan.hash;candidate=$plan.candidate.Clone();rollback=$plan.rollback.Clone()};$copy[$side][$key]='foreign'
  $before=$reads;$failure=$null;try{Assert-Business5244MaintenancePlan $copy $state}catch{$failure=$_.Exception.Message}
  $expected=if($side-ceq'candidate'){'OWNED_WEB_CANDIDATE_PINS_CHANGED'}else{'OWNED_WEB_ROLLBACK_PINS_CHANGED'}
  if($failure-cne$expected-or$reads-ne($before+1)){throw 'FIXTURE_FOREIGN_PIN_ACCEPTED'}
 }}
 $bad=@{hash='foreign';candidate=$plan.candidate;rollback=$plan.rollback};$failure=$null
 try{Assert-Business5244MaintenancePlan $bad $state}catch{$failure=$_.Exception.Message}
 if($failure-cne'OWNED_WEB_MAINTENANCE_PLAN_CHANGED'){throw 'FIXTURE_FOREIGN_HASH_ACCEPTED'}
 # A changed source is re-read on the next call, not hidden by a cached plan.
 $fixed.package='changed-source';$failure=$null;try{Assert-Business5244MaintenancePlan $plan $state}catch{$failure=$_.Exception.Message}
 if($failure-cne'OWNED_WEB_MAINTENANCE_PLAN_CHANGED'){throw 'FIXTURE_STALE_SOURCE_ACCEPTED'}
 $r.phase='Closed';$before=$reads;$failure=$null;try{Assert-Business5244MaintenancePlan $plan $state}catch{$failure=$_.Exception.Message}
 if($failure-cne'OWNED_WEB_MAINTENANCE_PLAN_CHANGED'-or$reads-ne$before){throw 'FIXTURE_PHASE_GUARD_MOVED'}
 'PASS'
 `),'PASS');
});
win('PackageRefresh entry binds preparation to only its fixed router and keeps Current recovery separate before any lease',()=>{
 assert.equal(run(load+String.raw`
 function Get-ErpBusinessSalePackageRefreshFixedCase{return $script:entryCase}
 $body=(Get-Command Assert-Business5244PackageRefreshEntry).Definition.Replace('[Environment]::GetCommandLineArgs()','$script:hostArguments');. ([scriptblock]::Create('function Assert-Business5244PackageRefreshEntry {'+$body+'}'))
 foreach($name in @('LINK','CONTEXT','READ')){
 $script:entryCase=@{root=('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-'+$name+'-OWNER-20261030');routerRoot=('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-'+$name+'-ROUTER-20261030')}
 $router=Join-Path $script:entryCase.routerRoot 'start-business-5244-readpair-router.ps1';$current=Join-Path $script:entryCase.root 'run-current-owner.ps1'
 foreach($prepare in @($false,$true)){$script:hostArguments=@('powershell.exe','-NoProfile','-File',$(if($prepare){$router}else{$current}));Assert-Business5244PackageRefreshEntry $prepare;$script:hostArguments[3]=if($prepare){$current}else{$router};$denied=$false;try{Assert-Business5244PackageRefreshEntry $prepare}catch{$denied=$true};if(!$denied){throw 'PACKAGE_ENTRY_ROLE_CONFUSED'}}
 foreach($args in @(@('powershell.exe','-Command',$router),@('powershell.exe','-File',$router,'-File',$router),@('powershell.exe','-File',$router,'-EncodedCommand','AA=='),@('powershell.exe','-file',$router),@('powershell.exe','-File',($router+'x')))){$script:hostArguments=$args;$denied=$false;try{Assert-Business5244PackageRefreshEntry $true}catch{$denied=$true};if(!$denied){throw 'PACKAGE_HOST_NOT_CLOSED'}}
 }
 function Test-Business5244PackageRefreshGeneration{return $true};function Enter-Business5244StartupLease{throw 'UNEXPECTED_PACKAGE_LEASE'}
 foreach($scope in @('TEST125-API-B6-ca620bac-20261028','TEST125-API-READ2b-20261028-41d3c213')){$denied=$false;try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName $scope}catch{if($_.Exception.Message-cne'OWNED_PACKAGE_REFRESH_SCOPE_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'PACKAGE_OTHER_SCOPE_ADMITTED'}};'PASS'`),'PASS');
});
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
win('verified init diagnostic exposes only the original uppercase code and allowlisted source location after genuine full cleanup',()=>{
 assert.equal(run(`${load}${initRecoveryFixture}
 function Open-Business5244RetirementChannel($OwnerLease){Assert-Business5244OwnedListeners @() 1;throw 'UNREACHABLE'}
 $failure=$null;try{Start-Business5244OwnedSupervisor -ScopeName 'TEST125-API-B6-ca620bac-20261028' -InitialSlot Current|Out-Null}catch{$failure=$_}
 if(!$failure-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne73){throw 'DIAGNOSTIC_NO_GENUINE_EXIT'}
 $d=Get-Business5244VerifiedInitializationFailureDiagnostic $failure.Exception
 if(($d.PSObject.Properties.Name-join'|')-cne'code|sourceLeaf|sourceLine'-or$d.code-cne'OWNED_WEB_LISTENER_MISMATCH'-or$d.sourceLeaf-cne'start-business-5244-owned.ps1'-or$d.sourceLine-isnot[int]-or$d.sourceLine-le0){throw 'DIAGNOSTIC_ORIGINAL_CODE_OR_LOCATION_LOST'}
 $encoded=$d|ConvertTo-Json -Compress;if($encoded-match'Exception|Message|StackTrace|Data|C:|fixture-sid|secret'){throw 'DIAGNOSTIC_RAW_DATA_LEAK'}
 foreach($copy in @($null,([Exception]::new('OWNED_WEB_LISTENER_MISMATCH')),($failure.Exception|ConvertTo-Json -Depth 3|ConvertFrom-Json))){if($null-ne(Get-Business5244VerifiedInitializationFailureDiagnostic $copy)){throw 'DIAGNOSTIC_FORGED_EXCEPTION'}}
 $d.code='MUTATED';if((Get-Business5244VerifiedInitializationFailureDiagnostic $failure.Exception).code-cne'OWNED_WEB_LISTENER_MISMATCH'){throw 'DIAGNOSTIC_RETURN_MUTATES_PRIVATE_OUTCOME'}
 $o=$script:Business5244LastInitializationOutcome;$o.thread++;if($null-ne(Get-Business5244VerifiedInitializationFailureDiagnostic $failure.Exception)){throw 'DIAGNOSTIC_FOREIGN_THREAD'};$o.thread--
 if(!$script:initNative.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($script:initRecords)))-cne$script:initHash-or(Test-Path -LiteralPath $script:initPending)){throw 'DIAGNOSTIC_WEAKENED_CLEANUP'};'PASS'`),'PASS');
});
win('verified init diagnostic never emits unstructured text, unknown uppercase or token-shaped hex and never invents a location',()=>{
 assert.equal(run(`${load}${initRecoveryFixture}
 function Open-Business5244RetirementChannel($OwnerLease){throw $script:diagnosticFailure}
 foreach($text in @('fixture secret must never be emitted','UNRECOGNIZED_UPPERCASE_VALUE',('A'*64))){
  $script:diagnosticFailure=$text;$failure=$null;try{Start-Business5244OwnedSupervisor -ScopeName 'TEST125-API-B6-ca620bac-20261028' -InitialSlot Current|Out-Null}catch{$failure=$_}
  $d=Get-Business5244VerifiedInitializationFailureDiagnostic $failure.Exception
  if(!$d-or$d.code-cne'INITIALIZATION_FAILURE_CODE_UNAVAILABLE'-or$null-ne$d.sourceLeaf-or$null-ne$d.sourceLine-or($d|ConvertTo-Json -Compress).Contains($text)){throw 'DIAGNOSTIC_RAW_FAILURE_EXPOSED'}
 };'PASS'`),'PASS');
});
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

win('Writer supervisor binds only its fresh profile-activation factory and restores Applied-B6 as Current without native DDL',()=>{
 assert.equal(run(`${load}
 function Get-Business5244StartupMutexName{return ('Local\\MelisaWriterStartup-'+[IO.Path]::GetFileName($env:TEMP))}
 $script:writerCurrent=(Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate).Clone();$script:writerCandidate=$script:writerCurrent.Clone();$script:writerCandidate.package='ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$script:writerCandidate.root='C:\\Sirket\\ERP\\releases\\ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$script:writerCandidate.manifest='a'*64;$script:writerCandidate.apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';$script:writerCandidate.apiManifest='b'*64
 function Get-ErpBusinessSaleWriterPairPins($Mode){if($Mode-ceq'Current'){return $script:writerCurrent};return $script:writerCandidate}
 Initialize-Business5244WebNative;$script:native=[Business5244WebNative]::new();$script:config=[pscustomobject]@{fixture='startup'};$script:cap=[pscustomobject]@{fixture='fresh-writer-owner'};$script:api=[pscustomobject]@{fixture='issued-transition'};$script:events=[Collections.Generic.List[string]]::new();$sleep=Join-Path $env:TEMP 'writer-source-sleep.ps1';[IO.File]::WriteAllText($sleep,'Start-Sleep -Seconds 60')
 function New-Business5244PinnedChild($Pins,$Lease){if($Pins.package-cne'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028'-or$Pins.apiManifest-cne'85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d'){throw 'WRITER_WRONG_CURRENT'};$script:native.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$sleep+'"'),$env:TEMP);$script:childProcess=[Diagnostics.Process]::GetProcessById($script:native.ChildPid);[void]$script:childProcess.Handle;return $script:native}
 function Read-ErpStartupConfig($Path){if($Path-cne'C:\\Sirket\\ERP\\runtime\\canonical-test\\startup-config.json'){throw 'WRITER_STARTUP_CHANGED'};return $script:config}
 function New-ErpBusinessSaleNativeProfileAdmission{throw 'WRITER_MUST_NOT_REPLAY_NATIVE_REVISION'}
 function Invoke-ErpBusinessSaleNativeRevision{throw 'WRITER_MUST_NOT_RUN_DDL'}
 function New-ErpBusinessSaleWriterProfileAdmission($Config){if(![object]::ReferenceEquals($Config,$script:config)){throw 'WRITER_WRONG_CONFIG'};$script:events.Add('writer');return $script:cap}
 function New-Test125ReadPairTransition($ScopeName,$NativeProfileAdmission){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or![object]::ReferenceEquals($NativeProfileAdmission,$script:cap)){throw 'WRITER_CAP_NOT_RETAINED'};$script:events.Add('api');return $script:api}
 function Prepare-Business5244PairedMaintenance($State,$ApiTransition){if((Get-Business5244RetirementState $State).scopeName-cne'TEST125-API-B6-WRITER-20261029'-or![object]::ReferenceEquals($ApiTransition,$script:api)){throw 'WRITER_PAIR_CHANGED'};$script:events.Add('prepared')}
 function Open-Business5244RetirementChannel($OwnerLease){$script:events.Add('channel');throw 'ISOLATED_WRITER_PREPARED'}
 function Close-Test125ReadPairRequestAdmission($Transition){};function Assert-Test125ReadPairIssued($Transition){if(![object]::ReferenceEquals($Transition,$script:api)){throw 'WRITER_UNISSUED_CLEANUP'};return @{releaseProof=$script:api}};function Close-ErpReadPairReleaseProof($Proof){}
 $body=(Get-Command Start-Business5244OwnedSupervisor).Definition.Replace((". (Join-Path "+[char]36+"PSScriptRoot 'test125-bound-api-quiescence.ps1')"),'[void]0');. ([scriptblock]::Create('function Start-Business5244OwnedSupervisor {'+$body+'}'))
 $denied=$false;try{Start-Business5244OwnedSupervisor -ScopeName 'TEST125-API-B6-WRITER-20261029' -InitialSlot Current -PrepareReadPair|Out-Null}catch{if($_.Exception.Message-cne'ISOLATED_WRITER_PREPARED'){throw};$denied=$true};try{if(!$denied-or($script:events-join'|')-cne'writer|api|prepared|channel'-or!$script:childProcess.WaitForExit(1000)){throw 'WRITER_STARTUP_ORDER_OR_CLEANUP'}}finally{$script:childProcess.Dispose()};'PASS'`),'PASS');
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


win('finite Web-only null-API dispatcher switches or rolls back only WEB with real owned Jobs and no API task profile or SQL mutator',()=>{
 const original=fs.readFileSync(path.join(dir,'business-5244-maintenance-dispatch.test.mjs'),'utf8').replaceAll('\r\n','\n');
 const blocks=[original,original.replaceAll('\n','\r\n')].map(raw=>{const text=raw.replaceAll('\r\n','\n'),start=text.indexOf('const setup=String.raw`')+'const setup=String.raw`'.length,end=text.indexOf('\n`;\nconst helpers=',start);assert(start>0&&end>start);return text.slice(start,end);});
 assert.equal(blocks[0],blocks[1],'Git LF and Windows checkout CRLF extract the same real dispatcher fixture');
 let setup=blocks[0].replace(/^function Get-Business5244MaintenancePlan.*$/m,'').replace(/^function Assert-Business5244MaintenancePlan.*$/m,'');
 for(const [token,name]of Object.entries({__GATE__:'business-5244-startup-exclusion.ps1',__WEB__:'start-business-5244-web.ps1',__STATE__:'business-5244-retirement-state.ps1',__DISPATCH__:'business-5244-maintenance-dispatch.ps1',__NATIVE__:'business-5244-web-native.cs'}))setup=setup.replaceAll(token,path.join(dir,name).replaceAll("'","''"));
 const projection=String.raw`
 $script:apiMutators=0;$script:currentPins=(Get-Business5244WebPins).Clone();$currentPins.root='C:\fixture\current-writer';$currentPins.package='ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$currentPins.manifest='121020af80ef660c4b9a0872f31dd4c3306bff81346f66797a6806bf6b1a4189';$currentPins.frontendSource='1033566d594ad7c02b8469e5c9598541333cd500';$currentPins.apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';$currentPins.apiManifest=('560c735fcaffa6692f55543840f81066'+'79b43b871e3c19f1990bdd17d46f9946');$script:nextPins=$currentPins.Clone();$nextPins.root='C:\fixture\new-workface';$nextPins.package='ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029';$nextPins.manifest='5cebcda8e9937a4db7135bdd18e48fc1585e0d5b1854f63711fe546886ec4bf6';$nextPins.frontendSource='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'
 function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'){throw 'FIXTURE_WEB_ONLY_SCOPE'};if($Mode-ceq'Current'){return $currentPins.Clone()};if($Mode-ceq'Candidate'){return $nextPins.Clone()};throw 'FIXTURE_MODE'}
 function Get-Business5244ReadPairPins{return $currentPins.Clone()}
 function Assert-Business5244OwnedPackage($Pins){$expected=if($Pins.package-ceq$nextPins.package){$nextPins}else{$currentPins};foreach($key in $expected.Keys){if($Pins[$key]-cne$expected[$key]){throw 'FIXTURE_PACKAGE_OBSERVATION_DRIFT'}}}
 function Assert-Business5244ReadyChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'FIXTURE_CHILD_DEAD'}}
 function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'FIXTURE_FOREIGN_API_READ'};return @{ok=$true;environment='CANONICAL_TEST';mode='erp';port=4144;databaseName='MELISA_ERP_SIRKET_TEST_20260929_01';serverName='Semih\MELISADEV';loginName='melisa_sirket_sales_test_20260929_01';databaseUser='melisa_sirket_sales_test_20260929_01';sysadmin=0;databaseControl=0;liveDatabaseAccess=0;sourceCommit=$currentPins.baseSource;packageId=$currentPins.apiPackage;businessWorkfaceId=$currentPins.profile;normalSessionUserId=17;persistentNormalSession=$true;businessSessionSignerDomain='dedicated-business-key-v1';actualT1=$false;externalOperations=$false;automaticJobs=$false}}
 function Get-FileHash($LiteralPath){if($LiteralPath-ceq(Join-Path $currentPins.root 'release-manifest.json')){return @{Hash=$currentPins.manifest}};if([IO.Path]::GetFullPath($LiteralPath).StartsWith($env:TEMP+'\',[StringComparison]::OrdinalIgnoreCase)){return Microsoft.PowerShell.Utility\Get-FileHash $LiteralPath};throw 'FIXTURE_HASH_OUTSIDE_SCOPE'}
 foreach($name in @('New-Test125ReadPairTransition','Invoke-Test125ReadPairApiTransition','New-ErpBusinessSaleWriterProfileAdmission','Invoke-ErpBusinessSaleNativeRevision','Set-ScheduledTask','Start-ScheduledTask','Stop-ScheduledTask','Write-Test125ReadPairCas','Invoke-Sqlcmd')){Set-Item ('function:'+ $name) { $script:apiMutators++;throw 'WEB_ONLY_MUTATOR_CALLED' }}
 `;
 setup=setup.replace('$lease=Enter-Business5244StartupLease',projection+'\n$lease=Enter-Business5244StartupLease').replace('Register-Business5244OwnedRetirement $lease $native $pins;','Register-Business5244OwnedRetirement $lease $native $pins -ScopeName TEST125-API-B6-WRITER-20261029;');
 for(const scenario of ['Success','StartFail']){
  const body=load+'\n'+setup+`\n$script:scenario='${scenario}';try{`+String.raw`
   $result=Invoke-Business5244OwnerMaintenance $state $channel $script:request
   $mode=if($script:scenario-ceq'Success'){'Candidate'}else{'Rollback'}
   if($result.mode-cne$mode-or$apiMutators-or$r.dispatch.apiTransition-or!$r.native.ChildAlive()-or$counts.retire-ne1){throw 'WEB_ONLY_NULL_API_EFFECT'}
   $saved=$counts.Clone();$again=Invoke-Business5244OwnerMaintenance $state $channel $script:request;if(!$again.replayed-or$apiMutators){throw 'WEB_ONLY_REPLAY_MUTATED'};foreach($key in $saved.Keys){if($counts[$key]-ne$saved[$key]){throw 'WEB_ONLY_REPLAY_EXTRA_EFFECT'}}
  }finally{foreach($n in @($native,$r.native,$r.dispatch.candidateNative,$r.dispatch.rollbackNative)){if($n){$n.Dispose()}};if($r.records){$r.records.Dispose()};if($r.pending){$r.pending.Dispose()};$records.Dispose();$pending.Dispose();Exit-Business5244StartupLease $lease};'PASS'`;
  assert.match(run(body),/PASS$/);
 }
});

win('Web-only supervisor rejects API preparation, another scope and direct Candidate startup before acquiring any lease',()=>{
 assert.equal(run(load+String.raw`function Test-Business5244WriterWebOnlyGeneration{return $true};$script:touches=0;function Enter-Business5244StartupLease{$script:touches++;throw 'UNEXPECTED_OWNER_LEASE'};foreach($kind in @('prepare','scope','candidate')){$denied=$false;try{if($kind-ceq'prepare'){Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029' -PrepareReadPair}elseif($kind-ceq'scope'){Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028'}else{Start-Business5244OwnedSupervisor -InitialSlot ReadPair -ScopeName 'TEST125-API-B6-WRITER-20261029'}}catch{if($_.Exception.Message-cne'OWNED_WEB_ONLY_API_PREPARATION_FORBIDDEN'){throw};$denied=$true};if(!$denied-or$touches){throw 'WEB_ONLY_CAPABILITY_OR_LEASE_CREATED'}};'PASS'`),'PASS');
});


const webOnlyPreparedFixture=initRecoveryFixture.replaceAll('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029').replace("$pins=Get-Business5244FinitePairPins -ScopeName",String.raw`
function Test-Business5244WriterWebOnlyGeneration{return $true}
function Get-Business5244WebOnlyEntryMode{return 'Maintenance'}
$script:apiMutators=0;$script:payloadVerifications=0
foreach($name in @('New-Test125ReadPairTransition','Prepare-Test125ReadPairRequestAdmission','Assert-Test125ReadPairTransition','Invoke-Test125ReadPairApiTransition','New-ErpBusinessSaleWriterProfileAdmission','Invoke-ErpBusinessSaleNativeRevision','Set-ScheduledTask','Start-ScheduledTask','Stop-ScheduledTask','Write-Test125ReadPairCas','Invoke-Sqlcmd')){Set-Item ('function:'+ $name) {$script:apiMutators++;throw 'WEB_ONLY_API_MUTATOR_OR_ADMISSION_CALLED'}}
$script:fixtureCurrent=(Get-Business5244WebPins).Clone();$fixtureCurrent.root=Join-Path $env:TEMP 'current-payload';$fixtureCurrent.package='ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$fixtureCurrent.frontendSource='1033566d594ad7c02b8469e5c9598541333cd500';$fixtureCurrent.apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';$fixtureCurrent.apiManifest=('560c735fcaffa6692f55543840f81066'+'79b43b871e3c19f1990bdd17d46f9946');$fixtureCurrent.node=Join-Path $PSHOME 'powershell.exe';$fixtureCurrent.nodeHash=(Get-FileHash $fixtureCurrent.node).Hash
$script:fixtureNext=$fixtureCurrent.Clone();$fixtureNext.root=Join-Path $env:TEMP 'candidate-payload';$fixtureNext.package='ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029';$fixtureNext.frontendSource='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'
foreach($p in @($fixtureCurrent,$fixtureNext)){
 [void][IO.Directory]::CreateDirectory($p.root);[IO.File]::WriteAllText((Join-Path $p.root 'payload.js'),'own temporary package '+$p.package)
 $m=@{kind='ERP_BUSINESS_WORKFACE_WEB_CANDIDATE';packageId=$p.package;database='MELISA_ERP_SIRKET_TEST_20260929_01';sourceCommit=$p.frontendSource;businessWorkfaceId=$p.profile;backendPackageId=$p.apiPackage;backendManifestSha256=$p.apiManifest;actualT1=$false;externalOperations=$false;businessSessionSignerDomain='dedicated-business-key-v1';webHostSourceCommit=$p.frontendSource;backendSourceCommit=$p.baseSource;businessSaleCandidate=@{kind='ADMITTED_B6_WRITER_UI';sourceCommit='1033566d594ad7c02b8469e5c9598541333cd500';recordingEnabled=$true};files=@(@{path='payload.js';sha256=(Get-FileHash (Join-Path $p.root 'payload.js')).Hash})}
 [IO.File]::WriteAllText((Join-Path $p.root 'release-manifest.json'),($m|ConvertTo-Json -Depth 12));$p.manifest=(Get-FileHash (Join-Path $p.root 'release-manifest.json')).Hash.ToLowerInvariant()
}
function Get-Business5244WriterWebOnlyPins($Mode){if($Mode-ceq'Current'){return $fixtureCurrent.Clone()};if($Mode-ceq'Candidate'){return $fixtureNext.Clone()};throw 'FIXTURE_WEB_ONLY_MODE'}
function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'){throw 'FIXTURE_WEB_ONLY_SCOPE'};return Get-Business5244WriterWebOnlyPins $Mode}
function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'FIXTURE_FOREIGN_HEALTH'};return @{ok=$true;environment='CANONICAL_TEST';mode='erp';port=4144;databaseName='MELISA_ERP_SIRKET_TEST_20260929_01';serverName='Semih\MELISADEV';loginName='melisa_sirket_sales_test_20260929_01';databaseUser='melisa_sirket_sales_test_20260929_01';sysadmin=0;databaseControl=0;liveDatabaseAccess=0;sourceCommit=$fixtureCurrent.baseSource;packageId=$fixtureCurrent.apiPackage;businessWorkfaceId=$fixtureCurrent.profile;normalSessionUserId=17;persistentNormalSession=$true;businessSessionSignerDomain='dedicated-business-key-v1';actualT1=$false;externalOperations=$false;automaticJobs=$false}}
$originalOwnedPackage=[scriptblock]::Create((Get-Command Assert-Business5244OwnedPackage).Definition)
function Assert-Business5244OwnedPackage($Pins,$Seal=$null){$script:payloadVerifications++; & $originalOwnedPackage $Pins $Seal}
$pins=Get-Business5244FinitePairPins -ScopeName`)+String.raw`
$preparedBody=(Get-Command Prepare-Business5244PairedMaintenance).Definition.Replace('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json',$script:initRecords)
. ([scriptblock]::Create('function Prepare-Business5244PairedMaintenance {'+$preparedBody+'}'))
`;
win('Web-only preparation seals both payloads before nonce and the request only validates exact State native lease and plan bound handles',()=>{
 assert.equal(run(load+webOnlyPreparedFixture+String.raw`
 $lease=Enter-Business5244StartupLease -Kind Owner;$native=New-Business5244PinnedChild $pins $lease;$state=Register-Business5244OwnedRetirement $lease $native $pins -ScopeName 'TEST125-API-B6-WRITER-20261029';$other=$null;$otherNative=$null
 try{
  Publish-Business5244CurrentRecord $state|Out-Null
  $emitted=@(Prepare-Business5244PairedMaintenance $state $null);if($emitted.Count){throw 'PREPARED_NULL_API_PIPELINE_OUTPUT'}
  $r=Get-Business5244RetirementState $state;$p=$r.preparedPair;$plan=Get-Business5244MaintenancePlan $state
  if($payloadVerifications-ne2-or$apiMutators-or$p.apiTransition-or$p.preflightMilliseconds-ge10000-or![object]::ReferenceEquals($p.stateToken,$state)-or![object]::ReferenceEquals($p.native,$native)-or![object]::ReferenceEquals($p.lease,$lease)){throw 'WEB_ONLY_PREPARATION_NOT_EXACT'}
  $denied=$false;try{[IO.File]::WriteAllText((Join-Path $fixtureNext.root 'payload.js'),'drift')}catch{$denied=$true};if(!$denied){throw 'PREPARED_PAYLOAD_NOT_HELD'}
  function Assert-Business5244OwnedPackage{$script:payloadVerifications++;throw 'REQUEST_FULL_PAYLOAD_SCAN'}
  Assert-Business5244MaintenancePlan $plan $state $null;if($payloadVerifications-ne2-or$apiMutators){throw 'REQUEST_REHASH_OR_API_ADMISSION'}
  foreach($kind in @('missing','plan','native','state','lease','api','generation','closed')){
   $badHash=$p.planHash;$inputApi=$null
   switch($kind){missing{$r.preparedPair=$null}plan{$badHash='0'*64}native{$otherNative=New-Business5244PinnedChild $pins $lease;$r.native=$otherNative}state{$other=Register-Business5244OwnedRetirement $lease $native $pins -ScopeName 'TEST125-API-B6-WRITER-20261029';$otherRecord=Get-Business5244RetirementState $other;$otherRecord.preparedPair=$p}lease{$p.lease=[pscustomobject]@{fake='lease'}}api{$inputApi=[pscustomobject]@{fake='api'}}generation{function Test-Business5244WriterWebOnlyGeneration{return $false}}closed{$p.seal.Dispose()}}
   $denied=$false;try{Assert-Business5244PreparedPair $(if($kind-ceq'state'){$other}else{$state}) $inputApi $badHash}catch{$denied=$true}
   if(!$denied-or$apiMutators){throw 'PREPARED_FOREIGN_OR_CLOSED_ACCEPTED'};$r.preparedPair=$p;$r.native=$native;$p.lease=$lease;function Test-Business5244WriterWebOnlyGeneration{return $true}
   if($otherNative){$otherNative.Dispose();$otherNative=$null}
  }
 }finally{Close-Business5244RetirementState $state;if($other){Close-Business5244RetirementState $other};$native.Dispose();Exit-Business5244StartupLease $lease};'PASS'
 `),'PASS');
});
for(const failure of ['channel','budget'])win(`Web-only ${failure} failure after bootstrap uses the retained authentic seal for own inverse and verified exit73`,()=>{
 assert.equal(run(load+webOnlyPreparedFixture+`$failureMode='${failure}';`+String.raw`
 if($failureMode-ceq'budget'){$recordAssert=[scriptblock]::Create((Get-Command Assert-Business5244RetirementRecord).Definition);function Assert-Business5244RetirementRecord($State,$Records){$b=& $recordAssert $State $Records;Start-Sleep -Milliseconds 5100;return ,$b}}
 $preheld=[Threading.Mutex]::new($false,(Get-Business5244StartupMutexName))
 $failure=$null;try{Start-Business5244OwnedSupervisor -ScopeName 'TEST125-API-B6-WRITER-20261029' -InitialSlot Current|Out-Null}catch{$failure=$_}
 if(!$failure-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne73){throw ('WEB_ONLY_NO_VERIFIED_INVERSE '+(Get-InitFixtureFailureDiagnostic $failure))}
 $r=$script:Business5244Retirements[$script:Business5244Retirements.Count-1]
 if($apiMutators-or!$initNative.RetirementConfirmed-or!(Get-Business5244StartupRecord $ownedLease).closed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($initRecords)))-cne$initHash-or(Test-Path $initPending)-or!$r.currentBootstrap.inverse-or$r.currentBootstrap.inverse.phase-cne'Archived'){throw 'WEB_ONLY_INIT_INVERSE_INCOMPLETE'}
 $r.preparedPair.seal.Dispose();$rows=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes($initRecords));if(@($rows|Where-Object{$_.port-eq5244-and$_.pid-eq$initNative.ChildPid}).Count){throw 'WEB_ONLY_LEFT_DEAD_CREATED_CHILD_RECORD'}
 $reacquired=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $reacquired
 # The fallback Current wrapper must work even when Candidate is unreadable.
 [IO.File]::Delete((Join-Path $fixtureNext.root 'payload.js'));$verifiedReads=$payloadVerifications
 function Get-Business5244WebOnlyEntryMode{return 'CurrentRecovery'}
 $script:recoveryChannel=[pscustomobject]@{fixture='current-only'};$script:retireRequest=[pscustomobject]@{operation='retire';requestId='own-no-preparation'};$script:receiveCount=0;$script:recoveryReady=$false;$script:rejectedWithoutStop=$false
 function Open-Business5244RetirementChannel($OwnerLease){Assert-Business5244StartupLease $OwnerLease -Kind Owner;return $script:recoveryChannel}
 function Close-Business5244RetirementChannel($Channel){if(![object]::ReferenceEquals($Channel,$script:recoveryChannel)){throw 'FOREIGN_RECOVERY_CHANNEL'}}
 function Assert-Business5244RetirementRequest($Channel,$Request){if(![object]::ReferenceEquals($Channel,$script:recoveryChannel)-or![object]::ReferenceEquals($Request,$script:retireRequest)){throw 'FOREIGN_RECOVERY_REQUEST'}}
 function Complete-Business5244RetirementRequest($Channel,$Request,$Reply,$Snapshot){if($Reply-cne'Rejected'-or$Snapshot.phase-cne'Running'){throw 'UNPREPARED_RECOVERY_RETIRED'};$script:rejectedWithoutStop=$true}
 function Receive-Business5244RetirementRequest($Channel){
  $r=$script:Business5244Retirements[$script:Business5244Retirements.Count-1]
  if(!$r.native.ChildAlive()-or$r.phase-cne'Running'-or$r.initializing-or$r.ContainsKey('preparedPair')-or$apiMutators-or$payloadVerifications-ne$verifiedReads){throw 'RECOVERY_CURRENT_NOT_INDEPENDENT'}
  $allRows=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes($initRecords));$row=@($allRows|Where-Object{$_.port-eq5244})
  if($row.Count-ne1-or$row[0].pid-ne$r.native.ChildPid-or$row[0].root-cne$fixtureCurrent.root){throw 'RECOVERY_CURRENT_RECORD_NOT_LIVE'}
  Assert-Business5244StartupLease $r.lease -Kind Owner;$script:recoveryReady=$true
  $script:receiveCount++;if($receiveCount-eq1){return $script:retireRequest};if(!$rejectedWithoutStop-or$r.dispatch.phase-cne'PreflightFailed'-or$r.dispatch.candidateNative-or$r.dispatch.rollbackNative){throw 'RECOVERY_CURRENT_ACCEPTED_UNPREPARED_RETIRE'};throw 'ISOLATED_CURRENT_RECOVERY_OBSERVED'
 }
 $observed=$null;try{Start-Business5244OwnedSupervisor -ScopeName 'TEST125-API-B6-WRITER-20261029' -InitialSlot Current|Out-Null}catch{$observed=$_}
 if(!$observed-or$observed.Exception.Message-cne'ISOLATED_CURRENT_RECOVERY_OBSERVED'-or!$recoveryReady-or!$rejectedWithoutStop-or$apiMutators-or$payloadVerifications-ne$verifiedReads){throw ('WEB_ONLY_CURRENT_RESTART_FAILED '+(Get-InitFixtureFailureDiagnostic $observed))}
 $reacquired=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $reacquired;$preheld.Dispose()
 'PASS'
 `,{timeout:35000}),'PASS');
});

win('Web-only host entry selection admits only the one exact router or Current wrapper and rejects command duplicate and direct helper modes',()=>{
 assert.equal(run(load+String.raw`
 $definition=(Get-Command Get-Business5244WebOnlyEntryMode).Definition.Replace('[Environment]::GetCommandLineArgs()','$script:entryArguments')
 . ([scriptblock]::Create('function Get-Business5244WebOnlyEntryMode {'+$definition+'}'))
 $router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029\start-business-5244-readpair-router.ps1';$current='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029\run-current-owner.ps1'
 foreach($kind in @('router','current','unknown','duplicate','command','helper','lowerFile')){
  $script:entryArguments=@('powershell.exe','-NoProfile','-NonInteractive','-File',$(if($kind-ceq'current'){$current}else{$router}),'-ManifestSha256',('a'*64))
  switch($kind){unknown{$entryArguments[4]='C:\foreign.ps1'}duplicate{$entryArguments+=@('-File',$current)}command{$entryArguments+=@('-Command','ignored')}helper{$entryArguments[4]='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029\start-business-5244-owned.ps1'}lowerFile{$entryArguments[3]='-file'}}
  $denied=$false;$answer=$null;try{$answer=Get-Business5244WebOnlyEntryMode}catch{if($_.Exception.Message-cne'OWNED_WEB_ONLY_FIXED_ENTRY_REQUIRED'){throw};$denied=$true}
  if($kind-ceq'router'){if($denied-or$answer-cne'Maintenance'){throw 'ROUTER_ENTRY_LOST'}}elseif($kind-ceq'current'){if($denied-or$answer-cne'CurrentRecovery'){throw 'CURRENT_ENTRY_LOST'}}elseif(!$denied){throw 'UNKNOWN_WEB_ONLY_HOST_ACCEPTED'}
 }
 'PASS'`),'PASS');
});

win('Web-only entry predicate observes real PS5 File host arguments for the two disposable wrapper paths',()=>{
 assert.equal(run(load+String.raw`
 $router=Join-Path $env:TEMP 'router-entry.ps1';$current=Join-Path $env:TEMP 'current-entry.ps1'
 $definition=(Get-Command Get-Business5244WebOnlyEntryMode).Definition.Replace('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029\start-business-5244-readpair-router.ps1',$router).Replace('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029\run-current-owner.ps1',$current)
 foreach($entry in @($router,$current)){[IO.File]::WriteAllText($entry,('function Get-Business5244WebOnlyEntryMode {'+$definition+'};Get-Business5244WebOnlyEntryMode'))}
 foreach($entry in @($router,$current)){
  $si=[Diagnostics.ProcessStartInfo]::new();$si.FileName=Join-Path $PSHOME 'powershell.exe';$si.Arguments='-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$entry+'" -ManifestSha256 '+('a'*64)+$(if($entry-ceq$router){' -ScopeName TEST125-API-B6-WRITER-20261029'}else{''});$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true
  $child=[Diagnostics.Process]::Start($si);try{$answer=$child.StandardOutput.ReadToEnd().Trim();$errorText=$child.StandardError.ReadToEnd();if(!$child.WaitForExit(5000)-or$child.ExitCode-ne0-or$errorText-or$answer-cne$(if($entry-ceq$router){'Maintenance'}else{'CurrentRecovery'})){throw 'ACTUAL_WRAPPER_ARGV_REJECTED'}}finally{$child.Dispose()}
 }
 'PASS'`),'PASS');
});
const steadyFixture=webOnlyPreparedFixture+String.raw`
function Test-Business5244WriterWebOnlyGeneration{return $false}
function Test-Business5244SteadyGeneration{return $true}
function Assert-Business5244SteadyEntry{}
function Get-Business5244SteadyPins{return $fixtureNext.Clone()}
function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$Mode-cne'Current'){throw 'BUSINESS_STEADY_CURRENT_ONLY'};return Get-Business5244SteadyPins}
$pins=Get-Business5244SteadyPins;$rows[2].root=$pins.root;$rows[2].sourceCommit=$pins.frontendSource
$script:initBefore=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));[IO.File]::WriteAllBytes($script:initRecords,$script:initBefore);$script:initHash=Get-Business5244StartupHash $script:initBefore
$script:oldRecordedPid=16084;$script:oldChildPresent=$false
function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'-or$Filter-cne('ProcessId='+$script:oldRecordedPid)){throw 'STEADY_FOREIGN_PID_READ'};if($script:oldChildPresent){return @{ProcessId=$script:oldRecordedPid}};return $null}
function New-Business5244PinnedChild($Pins,$Lease){$script:ownedLease=$Lease;Assert-Business5244OwnedPackage $Pins;Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$file=Join-Path $env:TEMP 'steady-child.ps1';[IO.File]::WriteAllText($file,'Start-Sleep -Seconds 60');$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$file+'"'),$env:TEMP);$script:initNative=$n;return $n}
`;
win('steady Current publishes only its fresh owned child and rebinds the next exact stale 5ce record without any maintenance or API capability',()=>{
 assert.equal(run(load+steadyFixture+String.raw`
 $script:replies=[Collections.Generic.List[string]]::new();$script:requests=0
 function Open-Business5244RetirementChannel($OwnerLease){Assert-Business5244StartupLease $OwnerLease -Kind Owner;return [pscustomobject]@{fixture='status-only'}}
 function Receive-Business5244RetirementRequest($Channel){$script:requests++;if($requests-gt3){throw 'STEADY_FIXTURE_FINISHED'};return [pscustomobject]@{operation=@('status','retire','recover')[$requests-1];requestId=([guid]::NewGuid().ToString())}}
 function Assert-Business5244RetirementRequest($Channel,$Request){if($Channel.fixture-cne'status-only'-or$Request.operation-cnotin@('status','retire','recover')){throw 'FIXTURE_REQUEST_CHANGED'}}
 function Complete-Business5244RetirementRequest($Channel,$Request,$Reply,$Snapshot){$script:replies.Add($Reply);if($Snapshot.phase-cne'Running'){throw 'STEADY_LEFT_RUNNING'}}
 function Close-Business5244RetirementChannel($Channel){}
 $kept=ConvertTo-Json -InputObject @($rows|Where-Object port -ne 5244) -Depth 20 -Compress;$lastPid=16084
 foreach($attempt in 1..2){
  $script:requests=0;$failure=$null;try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029'|Out-Null}catch{$failure=$_}
  if(!$failure-or$failure.Exception.Message-cne'STEADY_FIXTURE_FINISHED'-or!$initNative.RetirementConfirmed-or$apiMutators-or(Test-Path $initPending)){throw 'STEADY_START_OR_CLEANUP_FAILED'}
  $saved=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes($initRecords));$row=@($saved|Where-Object port -eq 5244)[0]
  if($row.pid-ne$initNative.ChildPid-or$row.pid-eq$lastPid-or$row.root-cne$pins.root-or$row.sourceCommit-cne$pins.frontendSource-or(ConvertTo-Json -InputObject @($saved|Where-Object port -ne 5244) -Depth 20 -Compress)-cne$kept){throw 'STEADY_RECORD_REBIND_OR_PRESERVATION_FAILED'}
  $lastPid=$row.pid;$script:oldRecordedPid=$row.pid
 }
 if(($replies-join'|')-cne'Status|Rejected|Rejected|Status|Rejected|Rejected'-or$payloadVerifications-ne2){throw 'STEADY_REQUEST_OR_PACKAGE_GUARD_MISSING'}
 $l=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $l;'PASS'`),'PASS');
});
win('steady prechannel failure uses the genuine archived bootstrap inverse and restores exact before bytes before issuing 73',()=>{
 assert.equal(run(load+steadyFixture+String.raw`
 $failure=$null;try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029'|Out-Null}catch{$failure=$_}
 if(!$failure-or(Get-Business5244VerifiedInitializationExitCode $failure.Exception)-ne73-or!$initNative.RetirementConfirmed-or$apiMutators-or(Test-Path $initPending)-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($initRecords)))-cne$initHash){throw ('STEADY_INVERSE_FAILED;'+(Get-InitFixtureFailureDiagnostic $failure))}
 $l=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $l;'PASS'`),'PASS');
});
win('steady rejects occupied predecessors, mismatched records, foreign generations and preparation before any record or API effect',()=>{
 assert.equal(run(load+steadyFixture+String.raw`
 foreach($mode in @('live','wrong-root','wrong-source','string-pid','extra-field','pending')){
  $script:oldChildPresent=($mode-ceq'live');$savedRows=$rows|ConvertTo-Json -Depth 20|ConvertFrom-Json
  switch($mode){wrong-root{$savedRows[2].root='C:\foreign'}wrong-source{$savedRows[2].sourceCommit='a'*40}string-pid{$savedRows[2].pid='16084'}extra-field{$savedRows[2]|Add-Member injected $true}pending{[IO.File]::WriteAllText($initPending,'foreign pending')}}
  $image=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $savedRows -Depth 20));[IO.File]::WriteAllBytes($initRecords,$image);$failure=$null
  try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029'|Out-Null}catch{$failure=$_}
  if(!$failure-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($initRecords)))-cne(Get-Business5244StartupHash $image)-or$apiMutators){throw 'STEADY_UNSAFE_BASE_ACCEPTED'}
  if($mode-ceq'pending'){if([IO.File]::ReadAllText($initPending)-cne'foreign pending'){throw 'STEADY_FOREIGN_PENDING_CHANGED'};[IO.File]::Delete($initPending)}
 }
 function Enter-Business5244StartupLease{throw 'STEADY_BAD_MODE_REACHED_LEASE'}
 foreach($mode in @('candidate','prepare','scope','supersession')){$failure=$null;try{switch($mode){candidate{Start-Business5244OwnedSupervisor -InitialSlot ReadPair -ScopeName 'TEST125-API-B6-WRITER-20261029'}prepare{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029' -PrepareReadPair}scope{Start-Business5244OwnedSupervisor -InitialSlot Current}supersession{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029' -CurrentSupersession ([pscustomobject]@{})}}}catch{$failure=$_};if(!$failure-or$failure.Exception.Message-cne'OWNED_STEADY_CURRENT_ONLY'){throw 'STEADY_MODE_NOT_CLOSED'}};'PASS'`),'PASS');
});
win('steady host invocation accepts only its single fixed File entry and rejects alternate modes before the lease',()=>{
 assert.equal(run(load+String.raw`
 $definition=(Get-Command Assert-Business5244SteadyEntry).Definition.Replace('[Environment]::GetCommandLineArgs()','$script:entryArguments')
 . ([scriptblock]::Create('function Assert-Business5244SteadyEntry {'+$definition+'}'))
 $entry='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029\run-current-owner.ps1'
 $script:entryArguments=@('powershell.exe','-NoProfile','-NonInteractive','-File',$entry);Assert-Business5244SteadyEntry
 foreach($arguments in @(@('powershell.exe','-File',$entry,'-File',$entry),@('powershell.exe','-file',$entry),@('powershell.exe','-Command',$entry),@('powershell.exe','-File',$entry,'-EncodedCommand','AA=='),@('powershell.exe','-File',($entry+'x')),@('powershell.exe'))){$script:entryArguments=$arguments;$denied=$false;try{Assert-Business5244SteadyEntry}catch{if($_.Exception.Message-cne'OWNED_STEADY_FIXED_ENTRY_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'STEADY_NONFILE_ADMISSION'}}
 $actual=(Get-Command Assert-Business5244SteadyEntry).Definition.Replace('$script:entryArguments','[Environment]::GetCommandLineArgs()');$fixtureEntry=Join-Path $env:TEMP 'run-current-owner.ps1';$actual=$actual.Replace($entry,$fixtureEntry)
 [IO.File]::WriteAllText($fixtureEntry,('function Assert-Business5244SteadyEntry {'+$actual+'};Assert-Business5244SteadyEntry;"PASS"'))
 $si=[Diagnostics.ProcessStartInfo]::new();$si.FileName=Join-Path $PSHOME 'powershell.exe';$si.Arguments='-NoProfile -NonInteractive -File "'+$fixtureEntry+'"';$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true
 $child=[Diagnostics.Process]::Start($si);try{$answer=$child.StandardOutput.ReadToEnd().Trim();$errors=$child.StandardError.ReadToEnd();if(!$child.WaitForExit(5000)-or$child.ExitCode-ne0-or$errors-or$answer-cne'PASS'){throw 'STEADY_ACTUAL_OS_FILE_REJECTED'}}finally{$child.Dispose()};'PASS'`),'PASS');
});
win('steady held publisher requires its genuine state and direct retirement cannot create a pending record or stop its owned child',()=>{
 assert.equal(run(load+steadyFixture+String.raw`
 $lease=Enter-Business5244StartupLease -Kind Owner;$native=New-Business5244PinnedChild $pins $lease;$state=Register-Business5244OwnedRetirement $lease $native $pins -ScopeName 'TEST125-API-B6-WRITER-20261029';$records=$null
 try{
  foreach($fake in @($null,([pscustomobject]@{kind='business-5244-retirement-state'}),($state|ConvertTo-Json|ConvertFrom-Json))){$denied=$false;try{Get-Business5244SteadyBootstrapBefore $fake $initBefore|Out-Null}catch{if($_.Exception.Message-cne'RETIREMENT_STATE_UNISSUED'){throw};$denied=$true};if(!$denied){throw 'STEADY_SERIALIZED_STATE_ADMITTED'}}
  $records=[IO.File]::Open($initRecords,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $denied=$false;try{Invoke-Business5244HeldRetirement $state $records $null}catch{if($_.Exception.Message-cne'RETIREMENT_STEADY_CURRENT_ONLY'){throw};$denied=$true}
  if(!$denied-or!$native.ChildAlive()-or(Test-Path $initPending)-or$apiMutators-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$initHash){throw 'STEADY_DIRECT_RETIRE_EFFECT'}
  $records.Dispose();$records=$null;Publish-Business5244CurrentRecord $state|Out-Null
  $r=Get-Business5244RetirementState $state;$r.currentBootstrap.steadyBefore.pid++
  $denied=$false;try{Undo-Business5244CurrentBootstrap $state|Out-Null}catch{if($_.Exception.Message-cne'CURRENT_STEADY_INVERSE_BEFORE_CHANGED'){throw};$denied=$true}
  if(!$denied-or!$native.ChildAlive()-or(Test-Path $initPending)-or$apiMutators){throw 'STEADY_FOREIGN_INVERSE_EFFECT'}
  $r.currentBootstrap.steadyBefore.pid--;Undo-Business5244CurrentBootstrap $state|Out-Null
  if(!$native.RetirementConfirmed-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($initRecords)))-cne$initHash){throw 'STEADY_GENUINE_INVERSE_FAILED'}
 }finally{if($records){$records.Dispose()};Close-Business5244RetirementState $state;$native.Dispose();Exit-Business5244StartupLease $lease};'PASS'`),'PASS');
});
