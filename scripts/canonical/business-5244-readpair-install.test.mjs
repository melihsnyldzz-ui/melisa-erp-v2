import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';import os from 'node:os';import path from 'node:path';
const dir=import.meta.dirname,q=s=>"'"+s.replaceAll("'","''")+"'";
function run(body){const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'erp-readpair-install-')));try{const file=path.join(temp,'delta.ps1');fs.writeFileSync(file,`$ErrorActionPreference='Stop';. ${q(path.join(dir,'install-business-5244-readpair.ps1'))} -Library;${body}`);return cp.execFileSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();}finally{const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('erp-readpair-install-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true,force:true});}}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
win('installer failure site retains the real strict property error and line without source text or target values',()=>{
 assert.equal(run(String.raw`Set-StrictMode -Version Latest;$record=$null;try{$item=[pscustomobject]@{present=1};$item.missingFixtureField}catch{$record=$_};$site=Get-ReadPairInstallFailureSite $record;$json=$site|ConvertTo-Json -Compress;if($site.errorId-cne'PropertyNotFoundStrict'-or$site.scriptLineNumber-le0-or$site.exceptionType-cne'System.Management.Automation.PropertyNotFoundException'-or$json.Contains('missingFixtureField')-or$json.Contains('present')-or$json.Contains('Message')-or$json.Contains('TargetObject')){throw 'INSTALL_FAILURE_LOCATION_LOST'};'PASS'`),'PASS');
});
win('unknown installer error identifiers are hashed and never carry arbitrary exception messages into the receipt',()=>{
 assert.equal(run(String.raw`$marker='deneme-'+('ab'*16);$record=$null;try{throw $marker}catch{$record=$_};$site=Get-ReadPairInstallFailureSite $record;$json=$site|ConvertTo-Json -Compress;if($site.errorId-or$site.errorIdSha256-cnotmatch'^[a-f0-9]{64}$'-or$json.Contains($marker)-or$json.Contains('Message')-or(Get-ReadPairInstallFailureSite ([pscustomobject]@{Message=$marker}))){throw 'INSTALL_FAILURE_LEAKED_VALUE'};'PASS'`),'PASS');
});
const inert=String.raw`$script:calls=[Collections.Generic.List[string]]::new();function Open-ReadPairPublication{$calls.Add('open')};function Assert-ReadPairColdTarget{$calls.Add('target')};function Stop-ReadPairColdOwner{$calls.Add('coldstop')};function Start-ReadPairPreparedOwner{$calls.Add('start')};function Assert-ReadPairPreparedOwner{$calls.Add('ready')};function Send-ReadPairSingleRetire{$calls.Add('retire')};function Wait-ReadPairFinalState{$calls.Add('readback');return 'CandidateVerified'};function Complete-ReadPairPublication($Outcome){$calls.Add($Outcome)};function Restore-ReadPairBeforeRetire([bool]$OldStopped){$calls.Add('restore:'+ $OldStopped)};function Close-ReadPairPublication{$calls.Add('close')};function Record-Phase($Phase){$calls.Add($Phase)};`;
const activeFixture=String.raw`
. __STARTUP__ -Library
$nativeSource=[IO.File]::ReadAllText(__PEER__);$nativeLiteral='const string Path="C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027\\5244-retirement.pending";'
if($nativeSource.Split(@($nativeLiteral),[StringSplitOptions]::None).Count-ne2){throw 'ISOLATED_PENDING_LITERAL_NOT_UNIQUE'}
$nativeSource=$nativeSource.Replace($nativeLiteral,('const string Path=@"'+(Join-Path $PSScriptRoot 'fixture.pending')+'";'));Add-Type -TypeDefinition $nativeSource
function Get-Business5244StartupMutexName{return ('Local\MelisaActiveEntryFixture-'+[IO.Path]::GetFileName($PSScriptRoot))}
function Get-Business5244RetirementPendingPath{return (Join-Path $PSScriptRoot 'fixture.pending')}
$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:held=[Collections.Generic.List[object]]::new();$script:created=@();$script:before=@{fixture=$true};$script:oldRoot=$PSScriptRoot;$script:oldHash=('a'*64);$script:result=@{stopCalls=0};$script:foreignLaunch=$false;$script:startCalls=0;$script:skipAutomaticHold=$false
$active=Join-Path $PSScriptRoot 'run-current-owner.ps1';$bytes=[Text.Encoding]::UTF8.GetBytes('inert-active-entry');[IO.File]::WriteAllBytes($active,$bytes);$hash=Get-Business5244StartupHash $bytes
$entries=@(1..6|ForEach-Object{$p=Join-Path $PSScriptRoot ('legacy-'+$_+'.ps1');[IO.File]::WriteAllBytes($p,$bytes);[pscustomobject]@{path=$p;beforeSha256=$hash;afterEqualsBefore=$true}})
$direct=@(1..3|ForEach-Object{$p=Join-Path $PSScriptRoot ('inactive-'+$_+'.ps1');[IO.File]::WriteAllBytes($p,$bytes);[pscustomobject]@{path=$p;sha256=$hash}})+@([pscustomobject]@{path=$active;sha256=$hash})
$script:b6=[pscustomobject]@{owner=[pscustomobject]@{predecessorEntryKind='CurrentCore';core=[pscustomobject]@{root=$PSScriptRoot;manifestSha256=$oldHash};entry=[pscustomobject]@{root=$PSScriptRoot;leaf='run-current-owner.ps1';sha256=$hash;manifestSha256=$oldHash}};entryCapture=[pscustomobject]@{entries=$entries;directEntries=$direct}}
foreach($row in @($entries)+@($direct|Where-Object{$_.path-cne$active})){Hold-B6ReadPairEntry $row.path $hash}
$pipeName='MelisaActiveEntry-'+[guid]::NewGuid().ToString('N');$serverScript=Join-Path $PSScriptRoot 'server.ps1'
[IO.File]::WriteAllText($serverScript,('param($Name,$Entry);$f=[IO.File]::Open($Entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$p=[IO.Pipes.NamedPipeServerStream]::new($Name,[IO.Pipes.PipeDirection]::InOut);[Console]::WriteLine("READY");[Console]::Out.Flush();$p.WaitForConnection();Start-Sleep -Seconds 120'))
$si=[Diagnostics.ProcessStartInfo]::new();$si.FileName=Join-Path $PSHOME 'powershell.exe';$si.Arguments='-NoProfile -NonInteractive -File "'+$serverScript+'" "'+$pipeName+'" "'+$active+'"';$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true;$server=[Diagnostics.Process]::new();$server.StartInfo=$si;[void]$server.Start()
$pipe=$null;$peer=$null;$extra=$null;$busy=$null
try{
 if($server.StandardOutput.ReadLine()-cne'READY'){throw 'ISOLATED_SERVER_NOT_READY'}
 $pipe=[IO.Pipes.NamedPipeClientStream]::new('.',$pipeName,[IO.Pipes.PipeDirection]::InOut);$pipe.Connect(5000);$peer=[Business5244RetirementPeer]::CaptureServer($pipe);$script:control=$peer.OpenControlledShutdown();$peer.Dispose();$peer=$null;$pipe.Dispose();$pipe=$null
 if($control.TargetPid-ne$server.Id){throw 'ISOLATED_TARGET_NOT_OWN_CREATED_SERVER'}
 $script:status=@{ownerPid=$control.TargetPid;ownerBirth=$control.TargetBirth};$script:oldResourceRows=@(@{pid=$server.Id;birth=$control.TargetBirth})
 function Assert-OldTarget($Status){$control.Validate();if($Status.ownerPid-ne$server.Id-or$Status.ownerBirth-cne$control.TargetBirth){throw 'ISOLATED_FOREIGN_OLD_TARGET'}}
 function Get-CimInstance($ClassName){if($ClassName-cne'Win32_Process'){throw 'ISOLATED_FOREIGN_QUERY'};if($script:foreignLaunch){return @([pscustomobject]@{ProcessId=2147483000;CommandLine=('-File "'+$active+'"')})};return @()}
 function Wait-ResourceExit($Rows){return $server.HasExited}
 function Get-NetTCPConnection($LocalPort,$State){if($LocalPort-ne5244-or$State-cne'Listen'){throw 'ISOLATED_FOREIGN_PORT'};return @()}
 function Assert-ReadPairProtection{}
 function Record-Phase($Phase){}
 function Start-Frozen{$script:startCalls++;throw 'UNEXPECTED_OWNER_START'}
 __BEFORE_HOLD__
 if(!$script:skipAutomaticHold){Hold-B6ReadPairActiveEntry}
 __BODY__
}finally{
 if($extra){$extra.Dispose()};if($peer){$peer.Dispose()};if($pipe){$pipe.Dispose()}
 $handoff=if(Get-Variable ReadPairActiveHandoff -Scope Script -ErrorAction SilentlyContinue){$script:ReadPairActiveHandoff}else{$null};if($handoff-and$handoff.marker){$handoff.marker.CloseRetained()};if($handoff-and$handoff.lease){Exit-Business5244StartupLease $handoff.lease;$handoff.lease=$null};if($busy){Exit-Business5244StartupLease $busy}
 foreach($item in $held){$item.stream.Dispose()};if($control){$control.Dispose()};if(!$server.HasExited){$server.Kill();[void]$server.WaitForExit(5000)};$server.Dispose()
};'PASS'
`.replace('__STARTUP__',q(path.join(dir,'business-5244-startup-exclusion.ps1'))).replace('__PEER__',q(path.join(dir,'business-5244-retirement-peer.cs')));
const activeRun=(body,before='',fixture=activeFixture)=>run(fixture.replace('__BEFORE_HOLD__',before).replace('__BODY__',body));
win('RehearsalOnly stop dispatch and managed body contain no force-stop path in their selected AST branch',()=>{
 assert.equal(run(String.raw`
 $tokens=$null;$errors=$null;$source=(Get-Command Stop-ReadPairColdOwner).Definition;$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'STOP_SOURCE_PARSE'}
 $branch=@($ast.FindAll({param($n);$n-is[Management.Automation.Language.IfStatementAst]-and$n.Clauses.Count-eq1-and$n.Clauses[0].Item1.Extent.Text-ceq'$RehearsalOnly'},$true));if($branch.Count-ne1){throw 'MANAGED_STOP_BRANCH_MISSING'}
 $managed=@($branch[0].Clauses[0].Item2.FindAll({param($n);$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-ceq'Invoke-B6ReadPairManagedOwnerExit'},$true));if($managed.Count-ne1){throw 'MANAGED_STOP_NOT_DISPATCHED'}
 $force=@($branch[0].Clauses[0].Item2.FindAll({param($n);$n-is[Management.Automation.Language.InvokeMemberExpressionAst]-and$n.Member.Value-cin@('Stop','Kill','TerminateProcess')},$true));if($force.Count){throw 'FORCE_STOP_IN_REHEARSAL_BRANCH'}
 $body=(Get-Command Invoke-B6ReadPairManagedOwnerExit).Definition
 if($body-cmatch'\.Stop\(|\.Kill\(|TerminateProcess|Invoke-Expression'-or$body.IndexOf('[Threading.Mutex]::OpenExisting')-gt$body.IndexOf('Read-B6ReadPairManagedExitSignal')-or$body.IndexOf('.ValidateExited()')-gt$body.IndexOf('.CompleteManagedExit(')){throw 'MANAGED_NATIVE_ORDER_CHANGED'}
 'PASS'`),'PASS');
});
const managedServer=String.raw`param($Name,$Entry,$Mutex);$m=[Threading.Mutex]::new($false,$Mutex);$owned=$false;$f=$null;$p=$null;try{$owned=$m.WaitOne(0);if(!$owned){throw 'ISOLATED_OWNER_MUTEX_BUSY'};$f=[IO.File]::Open($Entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$p=[IO.Pipes.NamedPipeServerStream]::new($Name,[IO.Pipes.PipeDirection]::InOut);[Console]::WriteLine("READY");[Console]::Out.Flush();$p.WaitForConnection();[Console]::ReadLine()|Out-Null}finally{if($p){$p.Dispose()};if($f){$f.Dispose()};if($owned){$m.ReleaseMutex()};$m.Dispose()}`;
const managedFixture=activeFixture
 .replace('@(1..3|ForEach-Object','@(1..11|ForEach-Object')
 .replace("param($Name,$Entry);$f=[IO.File]::Open($Entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$p=[IO.Pipes.NamedPipeServerStream]::new($Name,[IO.Pipes.PipeDirection]::InOut);[Console]::WriteLine(\"READY\");[Console]::Out.Flush();$p.WaitForConnection();Start-Sleep -Seconds 120",managedServer.replaceAll("'","''"))
 .replace("$si.UseShellExecute=$false;","$si.Arguments+=' \"'+(Get-Business5244StartupMutexName)+'\"';$si.UseShellExecute=$false;")
 .replace('$si.RedirectStandardError=$true;','$si.RedirectStandardError=$true;$si.RedirectStandardInput=$true;')
 .replace('$script:control=$peer.OpenControlledShutdown();','$script:control=$peer.OpenControlledShutdown();$script:ReadPairExitObservation=$peer.OpenExitObservation();')
 .replace(' __BEFORE_HOLD__',` $script:RehearsalOnly=$true;$b6|Add-Member rehearsalOnly $true;$b6.owner|Add-Member recordBeforeSha256 '81862843a2595587771a8779b23a965b3139cbd8145680af52e4a663c7d2cc17'
 function Get-FileHash($LiteralPath){if($LiteralPath-ceq'C:\\Sirket\\ERP\\clean\\20261022\\runtime\\erp-processes.json'){return @{Hash=$b6.owner.recordBeforeSha256}};throw 'ISOLATED_FOREIGN_FILE_HASH'}
 __BEFORE_HOLD__`)
 .replace('if(!$server.HasExited){$server.Kill();[void]$server.WaitForExit(5000)};',"if(!$server.HasExited){$server.StandardInput.Close();if(!$server.WaitForExit(5000)){throw 'ISOLATED_COOPERATIVE_CLEANUP_FAILED'}};if(Get-Variable ReadPairExitObservation -Scope Script -ErrorAction SilentlyContinue){if($script:ReadPairExitObservation-is[IDisposable]){$script:ReadPairExitObservation.Dispose()}};if(Get-Variable ReadPairPreheldMutex -Scope Script -ErrorAction SilentlyContinue){if($script:ReadPairPreheldMutex){$script:ReadPairPreheldMutex.Dispose()}};");
win('RehearsalOnly managed exit uses a genuine observer and the same contended mutex before normal finally and exclusive handoff',()=>{
 const answer=activeRun(String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_MANAGED_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit
 if(!$control.CompletedStop-or!$server.HasExited-or$server.ExitCode-ne0-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1-or!$script:ReadPairPreheldMutex){throw 'MANAGED_EXIT_PROOF_MISSING'}
 $script:ReadPairExitObservation.ValidateExited();$control.ValidateCompletedStop();Complete-B6ReadPairActiveEntryHandoff
 $h=Get-B6ReadPairActiveHandoff;if($h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$h.lease-or$held.Count-ne18-or@($held|Where-Object{$_.holdMode-cne'Exclusive'}).Count){throw 'MANAGED_EXIT_HANDOFF_NOT_EXCLUSIVE'}
 $lease=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $lease
 `,'',managedFixture);assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('RehearsalOnly managed exit rejects forged and disposed observers before prompting or completing the live target',()=>{
 const answer=activeRun(String.raw`
 $real=$script:ReadPairExitObservation;$script:signals=0;function Read-B6ReadPairManagedExitSignal{$script:signals++;throw 'UNEXPECTED_SIGNAL_READ'}
 foreach($bad in @([pscustomobject]@{TargetPid=$control.TargetPid;TargetBirth=$control.TargetBirth},$null)){
  $script:ReadPairExitObservation=$bad;$denied=$false;try{Invoke-B6ReadPairManagedOwnerExit}catch{$denied=$true};if(!$denied-or$control.CompletedStop-or$server.HasExited-or$script:signals-or(Get-B6ReadPairActiveHandoff).stopAttempted){throw 'FORGED_OBSERVER_ALLOWED_EXIT'}
 }
 $script:ReadPairExitObservation=$real;$real.Dispose();$denied=$false;try{Invoke-B6ReadPairManagedOwnerExit}catch{$denied=$true}
 if(!$denied-or$control.CompletedStop-or$server.HasExited-or$script:signals-or(Get-B6ReadPairActiveHandoff).stopAttempted){throw 'DISPOSED_OBSERVER_ALLOWED_EXIT'}
 `,'',managedFixture);assert.match(answer,/PASS$/);
});
for(const signal of ['WRONG_SIGNAL','MANAGED_EXIT_OBSERVED'])win(`RehearsalOnly console ${signal==='WRONG_SIGNAL'?'wrong signal':'signal before native exit'} is never completion authority`,()=>{
 const answer=activeRun(`function Read-B6ReadPairManagedExitSignal{return '${signal}'};`+String.raw`
 $denied=$false;try{Invoke-B6ReadPairManagedOwnerExit}catch{$denied=$true}
 $h=Get-B6ReadPairActiveHandoff;if(!$denied-or$control.CompletedStop-or$server.HasExited-or$result.stopCalls-ne0-or$h.marker.Deleted-or!$h.stopAttempted-or!$script:ReadPairPreheldMutex){throw 'CONSOLE_TEXT_COMPLETED_LIVE_OWNER'}
 `,'',managedFixture);assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('RehearsalOnly managed exit retains the old mutex so standard abandoned-owner rejection blocks exclusive publication',()=>{
 const abandoned=managedFixture.replace('if($owned){$m.ReleaseMutex()}','if($owned){$owned=$false}');
 const answer=activeRun(String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)){throw 'ISOLATED_EXIT_TIMEOUT'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true}
 $h=Get-B6ReadPairActiveHandoff;if(!$denied-or!$control.CompletedStop-or$h.phase-cne'FailedShared'-or$h.upgradeAttempted-or$h.marker.Deleted-or$result.stopCalls-ne0){throw 'ABANDONED_OLD_MUTEX_BYPASSED'}
 `,'',abandoned);assert.match(answer,/PASS$/);
});
win('active entry shares only reads until the same authenticated native stop then upgrades under an actual isolated maintenance lease',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;if($h.phase-cne'Shared'-or$h.item.holdMode-cne'Shared'-or$control.CompletedStop){throw 'ACTIVE_NOT_SHARED'}
 $extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$extra.Dispose();$extra=$null
 $denied=$false;try{$writer=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::Read);$writer.Dispose()}catch{$denied=$true};if(!$denied){throw 'ACTIVE_WRITABLE_PRESTOP'}
 $denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied-or$h.lease-or$h.upgradeAttempted){throw 'ENTRY_UPGRADED_WITHOUT_NATIVE_STOP'}
 $control.Stop();$control.ValidateCompletedStop();Complete-B6ReadPairActiveEntryHandoff;Assert-B6ReadPairEntryHandoffReady
 if($h.phase-cne'ExclusiveVerified'-or$h.item.holdMode-cne'Exclusive'-or$h.lease){throw 'ACTIVE_UPGRADE_NOT_VERIFIED'}
 foreach($item in $held){$denied=$false;try{$reader=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$reader.Dispose()}catch{$denied=$true};if(!$denied){throw 'ENTRY_NOT_EXCLUSIVE_AFTER_STOP'}}
 $check=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $check
 if($control.GetType().GetProperty('CompletedStop').GetSetMethod($false)){throw 'PUBLIC_COMPLETION_SETTER'}
 $control.Dispose();$denied=$false;try{$control.ValidateCompletedStop()}catch{$denied=$true};if(!$denied){throw 'DISPOSED_STOP_PROOF_ACCEPTED'}
 `),'PASS');
});
win('a competing reader after native stop rejects exclusive upgrade, retains the pinned shared seal and maintenance exclusion, and cannot start recovery',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$denied=$false
 try{Complete-B6ReadPairActiveEntryHandoff}catch{if($_.Exception.Message-cne'B6_ACTIVE_ENTRY_HANDOFF_RECOVERY_REQUIRED'){throw};$denied=$true}
 $h=Get-B6ReadPairActiveHandoff;if(!$denied-or$h.phase-cne'FailedShared'-or$h.item.holdMode-cne'Shared'-or!$h.item.stream.CanRead-or!$h.lease){throw 'UPGRADE_FAILURE_DROPPED_SEAL_OR_GATE'}
 Assert-Business5244StartupLease $h.lease -Kind Maintenance
 foreach($call in @('ready','start','restore','close')){$denied=$false;try{switch($call){'ready'{Assert-B6ReadPairEntryHandoffReady}'start'{Start-ReadPairPreparedOwner}'restore'{Restore-ReadPairBeforeRetire -OldStopped $true}'close'{Close-ReadPairPublication}}}catch{$denied=$true};if(!$denied){throw ('UNCERTAIN_HANDOFF_CONTINUED_'+$call)}}
 if($script:startCalls-ne0-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $h.item.stream))-cne$hash){throw 'UNCONFIRMED_HANDOFF_STARTED_OR_CHANGED_ENTRY'}
 `),'PASS');
});
win('maintenance lease contention after the proved stop keeps the active entry shared and never retries the native stop or launcher',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$busy=Enter-Business5244StartupLease -Kind Maintenance;$denied=$false
 try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedShared'-or$h.item.holdMode-cne'Shared'-or$h.upgradeAttempted-or$script:startCalls){throw 'BUSY_GATE_UPGRADED_OR_STARTED'}
 $denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied){throw 'FAILED_HANDOFF_RETRIED'};$control.ValidateCompletedStop()
 `),'PASS');
});
win('foreign entry launch observations after stop prevent upgrade without granting any foreign kill or restart',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$script:foreignLaunch=$true;$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedShared'-or$h.item.holdMode-cne'Shared'-or$h.upgradeAttempted-or!$h.lease-or$script:startCalls){throw 'FOREIGN_LAUNCH_IGNORED'}
 $actual=$control;$script:control=[pscustomobject]@{TargetPid=$actual.TargetPid;TargetBirth=$actual.TargetBirth;CompletedStop=$true};$denied=$false;try{Get-B6ReadPairActiveHandoff|Out-Null}catch{$denied=$true};$script:control=$actual;if(!$denied){throw 'SCALAR_NATIVE_PROOF_ADMITTED'}
 `),'PASS');
});
win('the durable owned pending marker blocks Owner after all process-local leases and handles are released on an uncertain upgrade',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;$pending=Get-Business5244RetirementPendingPath
 if(!(Test-Path -LiteralPath $pending)-or$h.marker.Deleted){throw 'DURABLE_MARKER_MISSING'}
 $control.Stop();$extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied){throw 'UPGRADE_SHOULD_HAVE_FAILED'}
 Exit-Business5244StartupLease $h.lease;$h.lease=$null;$h.marker.CloseRetained()
 $denied=$false;try{$lease=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $lease}catch{if($_.Exception.Message-cne'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'){throw};$denied=$true}
 if(!$denied-or!(Test-Path -LiteralPath $pending)-or$script:startCalls){throw 'PROCESS_EXIT_LOST_DURABLE_EXCLUSION'}
 `),'PASS');
});
win('an existing foreign pending marker is neither adopted nor removed and prevents the native stop',()=>{
 assert.equal(activeRun(String.raw`
 $pending=Get-Business5244RetirementPendingPath;if([IO.File]::ReadAllText($pending)-cne'foreign-marker'-or$control.CompletedStop-or$server.HasExited-or$result.stopCalls){throw 'FOREIGN_MARKER_CHANGED_OR_STOPPED'}
 $denied=$false;try{Stop-ReadPairColdOwner}catch{$denied=$true};if(!$denied-or$server.HasExited-or$result.stopCalls){throw 'FOREIGN_MARKER_ALLOWED_STOP'}
 `,String.raw`
 $script:skipAutomaticHold=$true;[IO.File]::WriteAllText((Get-Business5244RetirementPendingPath),'foreign-marker');$denied=$false
 try{Hold-B6ReadPairActiveEntry}catch{if($_.Exception.Message-cne'B6_ACTIVE_ENTRY_FOREIGN_PENDING_MARKER'){throw};$denied=$true};if(!$denied){throw 'FOREIGN_PENDING_ADOPTED'}
 `),'PASS');
});
win('corrupting the retained marker bytes rejects stop and deletion instead of treating a path or JSON record as authority',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;$flags=[Reflection.BindingFlags]'Instance,NonPublic';$stream=$h.marker.GetType().GetField('stream',$flags).GetValue($h.marker)
 $stream.Position=0;$stream.WriteByte(0);$stream.Flush($true);$denied=$false
 try{Stop-ReadPairColdOwner}catch{$denied=$true};if(!$denied-or$h.stopAttempted-or$server.HasExited-or$result.stopCalls){throw 'CORRUPT_MARKER_ALLOWED_STOP'}
 $denied=$false;try{Cancel-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied-or$h.marker.Deleted){throw 'CORRUPT_MARKER_REMOVED'}
 $h.marker.CloseRetained();if(!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'CORRUPT_MARKER_NOT_DURABLE'}
 `),'PASS');
});
win('failed marker flush prevents stop and leaves an untrusted pending file rather than granting a retry',()=>{
 const fixture=activeFixture.replace('Add-Type -TypeDefinition $nativeSource',String.raw`$nativeSource=$nativeSource.Replace('stream.Flush(true);Validate();','stream.Flush(true);throw new IOException("ISOLATED_MARKER_FLUSH_FAILED");');Add-Type -TypeDefinition $nativeSource`);
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;if($h.phase-cne'MarkerPending'-or$h.marker-or$h.stopAttempted-or$server.HasExited-or$result.stopCalls-or!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'FLUSH_FAILURE_GRANTED_HANDOFF'}
 $denied=$false;try{Stop-ReadPairColdOwner}catch{$denied=$true};if(!$denied-or$server.HasExited){throw 'FLUSH_FAILURE_STOPPED_OWNER'}
 `,String.raw`
 $script:skipAutomaticHold=$true;$denied=$false;try{Hold-B6ReadPairActiveEntry}catch{if($_.Exception.ToString()-cnotmatch'ISOLATED_MARKER_FLUSH_FAILED'){throw};$denied=$true};if(!$denied){throw 'MARKER_FLUSH_FAILURE_NOT_REACHED'}
 `,fixture),'PASS');
});
win('maintenance lease exit failure retains the durable marker and cannot report an exclusive ready handoff',()=>{
 assert.equal(activeRun(String.raw`
 $script:originalExit=(Get-Command Exit-Business5244StartupLease).ScriptBlock;$script:failExit=$true
 function Exit-Business5244StartupLease($Lease){if($script:failExit){$script:failExit=$false;throw 'ISOLATED_EXIT_FAILURE'};& $script:originalExit $Lease}
 $control.Stop();$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedExclusive'-or!$h.lease-or$h.marker.Deleted-or!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'EXIT_FAILURE_REMOVED_PENDING_OR_CLAIMED_READY'}
 $denied=$false;try{Assert-B6ReadPairEntryHandoffReady}catch{$denied=$true};if(!$denied){throw 'EXIT_FAILURE_READY'}
 `),'PASS');
});
win('an unattempted pre-stop abort removes only its own marker while the authenticated native owner is still alive',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;Cancel-B6ReadPairActiveEntryHandoff
 if($h.phase-cne'CancelledBeforeStop'-or!$h.marker.Deleted-or(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))-or$server.HasExited-or$control.CompletedStop){throw 'PRESTOP_CANCEL_NOT_SAFE'}
 $control.Validate();$script:b6ReadProof=$null;$script:b6SourceHandles=@();Close-ReadPairPublication
 if($server.HasExited-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($active)))-cne$hash){throw 'PRESTOP_CANCEL_CHANGED_OWNER_OR_ENTRY'}
 `),'PASS');
});

const routerFixture=activeFixture
 .replace("$entries=@(1..6", "$routerRoot=Join-Path $PSScriptRoot 'router';[void][IO.Directory]::CreateDirectory($routerRoot);$routerActive=Join-Path $routerRoot 'start-business-5244-readpair-router.ps1';[IO.File]::WriteAllText($routerActive,'inert-router-entry');$routerEntryHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($routerActive));$coreManifest=$oldHash;$script:oldRoot=$routerRoot;$script:oldHash=('b'*64)\n$entries=@(1..6")
 .replace("foreach($row in @($entries)+@($direct|Where-Object{$_.path-cne$active})){Hold-B6ReadPairEntry $row.path $hash}",String.raw`$direct+=,[pscustomobject]@{path=$routerActive;sha256=$routerEntryHash};$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.core.manifestSha256=$coreManifest;$b6.owner.core|Add-Member files @([pscustomobject]@{path='run-current-owner.ps1';sha256=$hash});$b6.owner|Add-Member router ([pscustomobject]@{root=$routerRoot;manifestSha256=$oldHash;entrySha256=$routerEntryHash});$b6.owner.entry=[pscustomobject]@{root=$routerRoot;leaf='start-business-5244-readpair-router.ps1';sha256=$routerEntryHash;manifestSha256=$oldHash};$b6.entryCapture.directEntries=$direct
foreach($row in @($entries)+@($direct|Where-Object{$_.path-cnotin@($active,$routerActive)})){Hold-B6ReadPairEntry $row.path $hash}`)
 .replace('param($Name,$Entry);$f=', 'param($Name,$Entry,$Router);$routerHold=[IO.File]::Open($Router,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$f=')
 .replace("+$active+'\"';$si.UseShellExecute", "+$active+'\" \"'+$routerActive+'\"';$si.UseShellExecute");
win('a typed ReadPairRouter holds exactly router plus core current read shares then upgrades both only after the same native stop',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;$descriptors=@(Get-B6ReadPairActiveEntry)
 if($h.items.Count-ne2-or$descriptors.Count-ne2-or$h.items[0].path-cne$routerActive-or$h.items[1].path-cne$active-or$held.Count-ne11){throw 'TYPED_ROUTER_SET_NOT_EXACT_TWO'}
 foreach($item in $h.items){if($item.holdMode-cne'Shared'){throw 'ROUTER_ACTIVE_NOT_SHARED'};$extra=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$extra.Dispose();$extra=$null;$denied=$false;try{$w=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite);$w.Dispose()}catch{$denied=$true};if(!$denied){throw 'ROUTER_ACTIVE_WRITABLE'}}
 Stop-ReadPairColdOwner;Assert-B6ReadPairEntryHandoffReady
 if($result.stopCalls-ne1-or$h.phase-cne'ExclusiveVerified'-or$h.lease-or!$h.marker.Deleted-or(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'ROUTER_DUAL_UPGRADE_UNCONFIRMED'}
 foreach($item in $held){if($item.holdMode-cne'Exclusive'){throw 'ROUTER_ENTRY_NOT_EXCLUSIVE'};$denied=$false;try{$r=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$r.Dispose()}catch{$denied=$true};if(!$denied){throw 'ROUTER_EXCLUSIVE_SHARE_LOST'}}
 `,'',routerFixture),'PASS');
});
win('a second active-entry upgrade conflict preserves the first exclusive handle, second shared seal and durable pending marker',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedShared'-or$h.items[0].holdMode-cne'Exclusive'-or$h.items[1].holdMode-cne'Shared'-or!$h.lease-or$h.marker.Deleted){throw 'PARTIAL_DUAL_UPGRADE_LOST_EXCLUSION'}
 foreach($item in $h.items){if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream))-cne$item.beforeHash){throw 'PARTIAL_DUAL_ENTRY_BYTES_CHANGED'}}
 foreach($call in @('ready','start','restore','close')){$denied=$false;try{switch($call){ready{Assert-B6ReadPairEntryHandoffReady}start{Start-ReadPairPreparedOwner}restore{Restore-ReadPairBeforeRetire -OldStopped $true}close{Close-ReadPairPublication}}}catch{$denied=$true};if(!$denied){throw 'PARTIAL_DUAL_HANDOFF_CONTINUED'}}
 Exit-Business5244StartupLease $h.lease;$h.lease=$null;$h.marker.CloseRetained();$denied=$false;try{$l=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $l}catch{if($_.Exception.Message-cne'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'){throw};$denied=$true};if(!$denied-or$script:startCalls){throw 'PARTIAL_DUAL_DURABILITY_LOST'}
 `,'',routerFixture),'PASS');
});
win('typed router descriptors reject missing duplicate foreign and mismatched core entries before any native stop or marker creation',()=>{
 assert.equal(activeRun(String.raw`
 if($control.CompletedStop-or$server.HasExited-or$result.stopCalls-or(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'INVALID_ROUTER_DESCRIPTOR_EFFECT'}
 `,String.raw`
 $script:skipAutomaticHold=$true;$originalFiles=$b6.owner.core.files;$originalEntry=$b6.owner.entry.PSObject.Copy();$originalDirect=$b6.entryCapture.directEntries
 foreach($kind in @('coreHash','missingCore','duplicateCore','foreignRouter','wrongCaseKind','directCoreHash','duplicateDirectCore')){
  $b6.owner.core.files=$originalFiles;$b6.owner.entry=$originalEntry.PSObject.Copy();$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.entryCapture.directEntries=@($originalDirect|ForEach-Object{$_.PSObject.Copy()})
  switch($kind){coreHash{$b6.owner.core.files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('f'*64)})}missingCore{$b6.owner.core.files=@()}duplicateCore{$b6.owner.core.files=@($originalFiles)+@($originalFiles)}foreignRouter{$b6.owner.entry.root=Join-Path $PSScriptRoot 'foreign'}wrongCaseKind{$b6.owner.predecessorEntryKind='readpairrouter'}directCoreHash{($b6.entryCapture.directEntries|Where-Object{$_.path-ceq$active}).sha256=('f'*64)}duplicateDirectCore{$b6.entryCapture.directEntries+=@($b6.entryCapture.directEntries|Where-Object{$_.path-ceq$active})}}
  $denied=$false;try{Get-B6ReadPairActiveEntry|Out-Null}catch{$denied=$true};if(!$denied){throw ('INVALID_ROUTER_DESCRIPTOR_ADMITTED_'+$kind)}
 }
 $b6.owner.core.files=$originalFiles;$b6.owner.entry=$originalEntry;$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.entryCapture.directEntries=$originalDirect
 `,routerFixture),'PASS');
});
win('typed ReadPairRouter argv retains its exact old router scope while Current recovery remains a separate fixed core entry',()=>{
 assert.equal(run(String.raw`
 $script:b6=@{owner=[pscustomobject]@{predecessorEntryKind='ReadPairRouter';core=@{root='C:\fixed\old-core';manifestSha256=('a'*64)};router=@{root='C:\fixed\old-router';manifestSha256=('b'*64)};entry=@{root='C:\fixed\old-router';leaf='start-business-5244-readpair-router.ps1';manifestSha256=('b'*64)}};routerRoot='C:\fixed\new-router';routerHash=('c'*64);coreRoot='C:\fixed\new-core';coreHash=('d'*64)}
 $old=Get-B6ReadPairOwnerArguments 'C:\fixed\old-router' ('b'*64);$current=Get-B6ReadPairOwnerArguments 'C:\fixed\new-core' ('d'*64)
 if($old-cnotmatch'start-business-5244-readpair-router.ps1 -ManifestSha256 B{64} -ScopeName TEST125-API-B6-ca620bac-20261028$'-or$current-cnotmatch'run-current-owner.ps1 -ManifestSha256 D{64}$'-or$current-cmatch'ScopeName'){throw 'TYPED_ROUTER_ARGV_CHANGED'}
 foreach($kind in @('leaf','root','hash','kind')){$entry=$b6.owner.entry.PSObject.Copy();$k=$b6.owner.predecessorEntryKind;switch($kind){leaf{$b6.owner.entry.leaf='run-current-owner.ps1'}root{$b6.owner.entry.root='C:\foreign'}hash{$b6.owner.entry.manifestSha256=('e'*64)}kind{$b6.owner.predecessorEntryKind='Router'}};$denied=$false;try{Get-B6ReadPairOwnerArguments 'C:\fixed\old-router' ('b'*64)|Out-Null}catch{$denied=$true};$b6.owner.entry=$entry;$b6.owner.predecessorEntryKind=$k;if(!$denied){throw 'TYPED_ROUTER_ARGV_WIDENED'}};'PASS'
 `),'PASS');
});
win('normal sequence admits exact target, one cold handoff and one retire before independently verified commit',()=>{assert.equal(run(inert+`$r=Invoke-ReadPairInstallSequence;if($r-cne'CandidateVerified'-or($calls-join'|')-cne'open|target|coldstop|start|ready|retire|readback|CandidateVerified|close'){throw 'ORDER'};'PASS'`),'PASS');});
win('ACK loss never resends retire and requires readonly final readback',()=>{assert.equal(run(inert+`function Send-ReadPairSingleRetire{$calls.Add('retire');throw 'ACK_LOST'};$r=Invoke-ReadPairInstallSequence;if($r-cne'CandidateVerified'-or@($calls|Where-Object {$_-ceq'retire'}).Count-ne1-or$calls.Contains('restore:True')-or!$calls.Contains('ACK_UNCONFIRMED_READONLY_RECONCILIATION')){throw 'REPLAYED'};'PASS'`),'PASS');});
win('native paired rollback is a distinct verified result, never a second controller API write',()=>{assert.equal(run(inert+`function Wait-ReadPairFinalState{return 'RollbackVerified'};$r=Invoke-ReadPairInstallSequence;if($r-cne'RollbackVerified'-or$calls.Contains('restore:True')-or@($calls|Where-Object {$_-ceq'retire'}).Count-ne1){throw 'ROLLBACK_REPLAYED'};'PASS'`),'PASS');});
win('unknown post-retire result retains gates and refuses stop, inverse or another retire',()=>{assert.equal(run(inert+`function Wait-ReadPairFinalState{throw 'UNKNOWN'};$denied=$false;try{Invoke-ReadPairInstallSequence}catch{$denied=$true};if(!$denied-or$calls.Contains('restore:True')-or$calls.Contains('restore:False')-or!$calls.Contains('OWNER_RECOVERY_REQUIRED_NO_SECOND_RETIRE')-or@($calls|Where-Object {$_-ceq'retire'}).Count-ne1-or$calls[-1]-cne'close'){throw 'UNSAFE_RECOVERY'};'PASS'`),'PASS');});
win('pre-retire startup failure uses cold recovery only; pre-target failure never stops a process',()=>{assert.equal(run(inert+`function Start-ReadPairPreparedOwner{throw 'START_FAILED'};try{Invoke-ReadPairInstallSequence}catch{};if(!$calls.Contains('restore:True')-or$calls.Contains('retire')){throw 'START_RECOVERY'};$calls.Clear();function Assert-ReadPairColdTarget{throw 'FOREIGN'};try{Invoke-ReadPairInstallSequence}catch{};if(!$calls.Contains('restore:False')-or$calls.Contains('coldstop')-or$calls.Contains('retire')){throw 'FOREIGN_STOPPED'};'PASS'`),'PASS');});
win('real temporary exclusive file CAS rejects foreign bytes and restores only its own projected hash',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$file=Join-Path $PSScriptRoot 'inert-entry.txt';$a=[Text.Encoding]::UTF8.GetBytes('original');$b=[Text.Encoding]::UTF8.GetBytes('gated');[IO.File]::WriteAllBytes($file,$a);$s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);try{$denied=$false;try{Write-ReadPairHeldCas $s ('0'*64) $b}catch{$denied=$true};if(!$denied-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $s))-cne(Get-Business5244StartupHash $a)){throw 'FOREIGN_WRITE'};Write-ReadPairHeldCas $s (Get-Business5244StartupHash $a) $b;Write-ReadPairHeldCas $s (Get-Business5244StartupHash $b) $a;if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $s))-cne(Get-Business5244StartupHash $a)){throw 'INVERSE_FAILED'}}finally{$s.Dispose()};'PASS'`),'PASS');});
test('production entry is default-denied and has no SQL, task registration, blanket process kill or database restore',()=>{const text=fs.readFileSync(path.join(dir,'install-business-5244-readpair.ps1'),'utf8');assert.match(text,/if\(\$Library\)\{return\}/);assert.match(text,/READPAIR_REVIEWED_SOURCE_AND_SEPARATE_API_APPROVAL_REQUIRED/);assert.doesNotMatch(text,/Stop-Process|taskkill|Invoke-Sqlcmd|Register-ScheduledTask|RESTORE DATABASE|Set-MpPreference/i);assert.match(text,/841C99F9EA5CF38F20747F2550A97306EA3F68215600FA2EC5F17675EE2322EE/);});

win('bootstrap archive never counts as a paired commit and prior completed receipts are excluded',()=>{assert.equal(run(`$id='a'*32;$old='b'*32;$files=@([pscustomobject]@{Name=('5244-retirement.pending.'+$id+'.bootstrap.completed');FullName='bootstrap'},[pscustomobject]@{Name=('5244-retirement.pending.'+$id+'.completed');FullName='new'},[pscustomobject]@{Name=('5244-retirement.pending.'+$old+'.completed');FullName='old'});$c=@(Select-ReadPairCommitArchives $files @('old'));if($c.Count-ne1-or$c[0].FullName-cne'new'){throw 'ARCHIVE_SELECTION'};'PASS'`),'PASS');});
win('partial entry bytes block all inverse writes and helper removal instead of falsely reporting recovery',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$script:before=@{present=$true};$script:held=[Collections.Generic.List[object]]::new();$script:created=@();function Assert-ReadPairProtection{};function Record-Phase{throw 'FALSE_VERIFIED'};$a=[Text.Encoding]::UTF8.GetBytes('before');$b=[Text.Encoding]::UTF8.GetBytes('after');$partial=[Text.Encoding]::UTF8.GetBytes('part');foreach($index in @(1,2)){$f=Join-Path $PSScriptRoot ('entry'+$index);[IO.File]::WriteAllBytes($f,$(if($index-eq1){$b}else{$partial}));$h=[IO.File]::Open($f,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$held.Add(@{stream=$h;before=$a;beforeHash=(Get-Business5244StartupHash $a);afterHash=(Get-Business5244StartupHash $b);written=$true})};try{$denied=$false;try{Restore-ReadPairBeforeRetire -OldStopped $false}catch{if($_.Exception.Message-cne'READPAIR_HELD_ENTRY_RECOVERY_REQUIRED'){throw};$denied=$true};if(!$denied-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $held[0].stream))-cne(Get-Business5244StartupHash $b)){throw 'PARTIAL_FALSE_INVERSE'}}finally{foreach($x in $held){$x.stream.Dispose()}};'PASS'`),'PASS');});

win('fixed owner argv allows only Windows one terminal ASCII space, never extra arguments or whitespace',()=>{assert.equal(run(`$e='-NoProfile -File entry.ps1 -ManifestSha256 ABC';foreach($v in @($e,($e+' '))){if(!(Test-ReadPairOwnerArguments $v $e)){throw 'VALID_SERIALIZATION_REJECTED'}};foreach($v in @(($e+'  '),($e+[char]9),(' '+$e),($e+' -Other'))){if(Test-ReadPairOwnerArguments $v $e){throw 'FOREIGN_ARGV_ADMITTED'}};'PASS'`),'PASS');});

win('sealed published entry is readable by real Windows PowerShell while replacement and writes remain denied',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$f=Join-Path $PSScriptRoot 'inert-child.ps1';$bytes=[Text.Encoding]::UTF8.GetBytes("Write-Output 'SEALED_READ_OK'");$h=Publish-ReadPairSealedFile $f $bytes;try{$ps=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe';$answer=& $ps -NoProfile -NonInteractive -File $f;if($LASTEXITCODE-ne0-or$answer-cne'SEALED_READ_OK'){throw 'SCRIPT_LOAD_BLOCKED'};$denied=$false;try{$w=[IO.File]::Open($f,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::Read);$w.Dispose()}catch{$denied=$true};if(!$denied){throw 'SEAL_WRITE_ALLOWED'}}finally{$h.Dispose()};'PASS'`),'PASS');});

win('loader continuation accepts only the finite pre-retire failure plus verified Current recovery, never an issued or changed pair',()=>{assert.equal(run(`$f=@{status='FAILED_REVIEW_RECEIPT';failure='READPAIR_NEW_RESOURCES_RECOVERY_REQUIRED';retireAttempts=0;stopCalls=1;startCalls=1};$r=@{status='CURRENT_PAIR_FRESH_RECOVERED_VERIFIED';retireAttempts=0;apiRestarts=0;stopCalls=0;startCalls=1;protectionPreserved=$true;apiPackage='CANONICAL-TEST125-BUSINESS5244-10cdc0ee';webPackage='ERP-BUSINESS-WEB-5244-5cb682d8'};Assert-ReadPairLoaderContinuation $f $r;foreach($case in @('retire','api','unknown','protection','repeated')){$x=$f.Clone();$y=$r.Clone();switch($case){retire{$x.retireAttempts=1}api{$y.apiPackage='OTHER'}unknown{$x.failure='UNKNOWN'}protection{$y.protectionPreserved=$false}repeated{$y.startCalls=2}};$denied=$false;try{Assert-ReadPairLoaderContinuation $x $y}catch{$denied=$true};if(!$denied){throw 'CONTINUATION_BROADENED'}};'PASS'`),'PASS');});

win('exact baseline comparison ignores map property order but rejects added fields and changed values',()=>{assert.equal(run(`$a=@{planHash='p';baseHash='b';startupPath='s';apiPath='a';basePath='b';Current=@{startup='c';api='d'};Candidate=@{startup='e';api='f'}};$b=[pscustomobject]@{Candidate=[pscustomobject]@{api='f';startup='e'};Current=[pscustomobject]@{api='d';startup='c'};basePath='b';apiPath='a';startupPath='s';baseHash='b';planHash='p'};Assert-ReadPairExpectedEqual $a $b;$b.Candidate.api='other';$denied=$false;try{Assert-ReadPairExpectedEqual $a $b}catch{$denied=$true};if(!$denied){throw 'VALUE_DRIFT'};$s=@{listeners=@(@{LocalPort=1;LocalAddress='loopback';OwningProcess=2});processes=@(@{pid=2;birth='now';exe='fixed'});files=@(@{path='fixed';hash='hash'})};$t=$s|ConvertTo-Json -Depth 8|ConvertFrom-Json;if((Get-ReadPairProtectionSignature $s)-cne(Get-ReadPairProtectionSignature $t)){throw 'ORDER_ONLY_DRIFT'};$t.files[0]|Add-Member -NotePropertyName Extra -NotePropertyValue 'no';$denied=$false;try{Get-ReadPairProtectionSignature $t}catch{$denied=$true};if(!$denied){throw 'ADDITIONAL_FIELD'};'PASS'`),'PASS');});

win('authenticated final Unknown is an immediate readonly terminal failure; a foreign peer cannot settle a result',()=>{assert.equal(run(`$x=@{nativePeerVerified=$true;reply='Status';state=@{ownerPid=42;ownerBirth='1234';phase='Unknown'}};$caught=$null;try{Get-ReadPairFinalPeerState $x 42 '1234'}catch{$caught=$_.Exception.Message};if($caught-cne'READPAIR_FINAL_OWNER_UNKNOWN'){throw 'UNKNOWN_HIDDEN_BY_POLLING'};$x.state.phase='Running';$x.state.ownerPid=43;$caught=$null;try{Get-ReadPairFinalPeerState $x 42 '1234'}catch{$caught=$_.Exception.Message};if($caught-cne'READPAIR_FINAL_PEER_CHANGED'){throw 'FOREIGN_PEER_ACCEPTED'};'PASS'`),'PASS');});

win('metadata baseline has only the three exact observed snapshots and grants no Unknown shutdown admission',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-retirement-state.ps1'))} -Library;$old=Get-Business5244CurrentBootstrapPins;$known=Get-Business5244CurrentBootstrapPins '3bfd7f5df1aaedae5835709fd048f27cf35aa97f97a7c561cbd89ee0342827fc';$second=Get-Business5244CurrentBootstrapPins 'f0ace9f544671c8028d374e41ceb69a743fb01975998ea4bfedf4ec7661823c7';$foreign=Get-Business5244CurrentBootstrapPins ('0'*64);if($second.pid-ne41116-or$second.root-cne$known.root-or$second.source-cne$known.source-or$old.pid-ne2000-or$known.pid-ne25564-or$known.root-cnotlike'*ERP-BUSINESS-WEB-5244-5cb682d8'-or$foreign.hash-ceq('0'*64)){throw 'BASELINE_SCOPE_CHANGED'};'PASS'`),'PASS');});

const projectionSetup=String.raw`. ${q(path.join(dir,'start-business-5244-web.ps1'))} -Library;. ${q(path.join(dir,'test125-bound-maintenance-plan.ps1'))} -Library;
function FixtureStartup([string]$Name){$s=Get-Test125ReadPairScope -Name $Name;return [pscustomobject][ordered]@{SourceCommit=$s.source;ExpectedDatabase=$s.database;RepoRoot='C:\Sirket\ERP\melisa-erp-v2';TaskName='Melisa-ERP-TEST-Canonical';ApiComponent=$s.current;ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778';ManifestSha256='0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64';ConfigPath='C:\fixture\base-profile.json';NodePath=(Get-Business5244WebPins).node;NodeSha256=(Get-Business5244WebPins).nodeHash}};
function Bytes($Value){return ,([Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 100)))};`;
win('READ2b pure projection keeps original seal-only serialized candidate and has no native admission dependency',()=>{assert.equal(run(projectionSetup+`$name='TEST125-API-READ2b-20261028-41d3c213';$startup=Bytes (FixtureStartup $name);$api=Bytes ([pscustomobject][ordered]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-10cdc0ee'};secretFixture='unchanged'});function Assert-ErpBusinessSaleNativeProfileAdmission{throw 'NATIVE_CALLED'};$r=Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64);$after=[Text.Encoding]::UTF8.GetString($api)|ConvertFrom-Json;$after.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213';if($r.Current.api-cne(Get-Business5244StartupHash $api)-or$r.Candidate.api-cne(Get-Business5244StartupHash (Bytes $after))-or$r.baseHash-cne('a'*64)-or$r.planHash-cnotmatch'^[a-f0-9]{64}$'){throw 'LEGACY_PROJECTION_CHANGED'};$deny=$false;try{Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64) -NativeProfileAdmission ([pscustomobject]@{})|Out-Null}catch{$deny=$true};if(!$deny){throw 'OLD_SCOPE_ACCEPTED_NATIVE'};'PASS'`),'PASS');});
win('B6 pure expected projection uses only the issued native candidate bytes and rejects a changed before-image or foreign token',()=>{assert.equal(run(projectionSetup+`$name='TEST125-API-B6-ca620bac-20261028';$startup=Bytes (FixtureStartup $name);$api=Bytes ([pscustomobject]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'};secretFixture='unchanged'});$script:fixtureToken=[pscustomobject]@{fixture='same-object'};$script:fixtureBeforeHash=Get-Business5244StartupHash $api;$candidate=[Text.Encoding]::UTF8.GetString($api)|ConvertFrom-Json;$candidate.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028';$candidate|Add-Member businessSaleWritesEnabled $false;$candidate|Add-Member businessSaleAdmission ([pscustomobject]@{fixture='descriptor'});$script:fixtureCandidate=Bytes $candidate;
function Assert-ErpBusinessSaleNativeProfileAdmission($Admission,$Phase){if(![object]::ReferenceEquals($Admission,$script:fixtureToken)-or$Phase-cne'Prepared'){throw 'FIXTURE_NOT_ISSUED'};return $true};function Get-ErpBusinessSaleNativeAdmissionContext($Admission){[void](Assert-ErpBusinessSaleNativeProfileAdmission $Admission Prepared);return @{profileBeforeHash=$script:fixtureBeforeHash}};function Get-ErpBusinessSaleCandidateProfileBytes($Admission){[void](Assert-ErpBusinessSaleNativeProfileAdmission $Admission Prepared);return ,([byte[]]$script:fixtureCandidate.Clone())};
$r=Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64) -ScopeName $name -NativeProfileAdmission $script:fixtureToken;if($r.Candidate.api-cne(Get-Business5244StartupHash $script:fixtureCandidate)-or$r.Current.api-cne$script:fixtureBeforeHash-or$r.planHash-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_PROJECTION_CHANGED'};foreach($kind in @('foreignToken','before','source','scope')){$st=$startup;$ap=$api;$token=$script:fixtureToken;$n=$name;switch($kind){foreignToken{$token=[pscustomobject]@{fixture='same-object'}}before{$ap=Bytes ([pscustomobject]@{changed=$true})}source{$c=FixtureStartup $name;$c.SourceCommit='ca620bac30f96034b33d4410dc43576a38a38707';$st=Bytes $c}scope{$n='OTHER'}};$deny=$false;try{Get-ReadPairExpectedProjection -StartupBytes $st -ApiBytes $ap -BaseProfileSha256 ('a'*64) -ScopeName $n -NativeProfileAdmission $token|Out-Null}catch{$deny=$true};if(!$deny){throw 'B6_PROJECTION_WIDENED'}};'PASS'`),'PASS');});
win('B6 installer executable entry rejects absent isolated owner bundle before proof directory, private hash, stop or publication',()=>{assert.equal(run(`$source=[IO.File]::ReadAllText(${q(path.join(dir,'install-business-5244-readpair.ps1'))});$production='C:\\Sirket\\ERP\\evidence\\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\\private\\b6-passive-pair-ca620bac-20261028';if(!$source.Contains($production)){throw 'FIXTURE_FIXED_ROOT_MISSING'};$isolated=Join-Path $PSScriptRoot 'absent-private-root';$entry=Join-Path $PSScriptRoot 'isolated-installer.ps1';[IO.File]::WriteAllText($entry,$source.Replace($production,$isolated));$script:calls=0;function Get-FileHash{$script:calls++;throw 'UNEXPECTED_HASH'};function Read-ErpStartupConfig{$script:calls++;throw 'UNEXPECTED_PRIVATE'};function Start-Process{$script:calls++;throw 'UNEXPECTED_START'};$caught='';try{& $entry -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Apply -SourceSha256 ('0'*64)}catch{$caught=$_.Exception.Message};if($caught-cne'B6_OWNER_BUNDLE_NOT_PREPARED'-or$script:calls-ne0){throw 'B6_EXECUTABLE_BROADENED'};'PASS'`),'PASS');});

win('real native admission validator rejects a forged JSON token before SQL or protected-file reads in either expected-hash entry',()=>{assert.equal(run(projectionSetup+`function Open-ErpBusinessSaleSqlConnection{throw 'UNEXPECTED_SQL'};$name='TEST125-API-B6-ca620bac-20261028';$startup=Bytes (FixtureStartup $name);$api=Bytes ([pscustomobject]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'}});foreach($entry in @('projection','files')){$caught='';try{if($entry-ceq'projection'){Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64) -ScopeName $name -NativeProfileAdmission ([pscustomobject]@{schema='melisa-b6-finite-native-profile.v1';id='a'*32})|Out-Null}else{Get-ReadPairExpectedHashes -ScopeName $name -NativeProfileAdmission ([pscustomobject]@{schema='melisa-b6-finite-native-profile.v1';id='a'*32})|Out-Null}}catch{$caught=$_.Exception.Message};if($caught-cne'B6_NATIVE_ADMISSION_NOT_ISSUED'){throw ('FORGED_ADMISSION '+$entry+' '+$caught)}};'PASS'`),'PASS');});

win('B6 controller preflight issues its own native and release proof before any stop and aborts on SQL or task rejection',()=>{assert.equal(run(String.raw`$script:calls=[Collections.Generic.List[string]]::new();$script:cap=[pscustomobject]@{};$script:proof=[pscustomobject]@{};$script:reject='';function Read-ErpStartupConfig($Path){$calls.Add('config');return @{fixture='current'}};function New-ErpBusinessSaleNativeProfileAdmission($Config){$calls.Add('native');if($reject-ceq'native'){throw 'FIXTURE_TLS_REJECT'};return $cap};function Assert-ErpBusinessSaleNativeProfileAdmission($Admission,$Phase){if(![object]::ReferenceEquals($cap,$Admission)-or$Phase-cne'Prepared'){throw 'CAP_CHANGED'};$calls.Add('assert')};function New-ErpReadPairPreparedReleaseProof($Config,$ScopeName,$NativeProfileAdmission){if(![object]::ReferenceEquals($cap,$NativeProfileAdmission)-or$ScopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'PROOF_CHANGED'};$calls.Add('release');return $proof};function Get-Test125BoundMaintenancePlan($RunId,[switch]$ReadPairPreparation,$ReadPairMode,$PreparedReleaseProof){if(![object]::ReferenceEquals($proof,$PreparedReleaseProof)-or!$ReadPairPreparation-or$ReadPairMode-cne'Current'-or$RunId-cne'TEST125-API-B6-ca620bac-20261028'){throw 'TASK_PROOF_CHANGED'};$calls.Add('task');if($reject-ceq'task'){throw 'FIXTURE_TASK_REJECT'}};function Get-ReadPairExpectedHashes($ScopeName,$NativeProfileAdmission){if(![object]::ReferenceEquals($cap,$NativeProfileAdmission)-or$ScopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'PROFILE_PROOF_CHANGED'};$calls.Add('profile')};function Stop-ReadPairColdOwner{throw 'UNEXPECTED_STOP'};Initialize-B6ReadPairControllerPreflight;if(($calls-join'|')-cne'config|native|assert|release|task|profile'){throw 'PREFLIGHT_ORDER'};foreach($kind in @('native','task')){$calls.Clear();$script:reject=$kind;$caught=$false;try{Initialize-B6ReadPairControllerPreflight}catch{$caught=$true};if(!$caught-or$calls.Contains('profile')-or($kind-ceq'native'-and$calls.Contains('release'))){throw 'PREFLIGHT_CONTINUED'}};'PASS'`),'PASS');});

win('B6 exact current and generated owner argv cannot be interchanged or supplied an arbitrary root or hash',()=>{assert.equal(run(String.raw`$script:b6=@{owner=[pscustomobject]@{predecessorEntryKind='CurrentCore';core=@{root='C:\fixed\old';manifestSha256=('a'*64)};entry=@{root='C:\fixed\old';leaf='run-current-owner.ps1';manifestSha256=('a'*64)}};routerRoot='C:\fixed\new';routerHash=('b'*64);coreRoot='C:\fixed\core';coreHash=('c'*64)};$old=Get-B6ReadPairOwnerArguments 'C:\fixed\old' ('a'*64);$new=Get-B6ReadPairOwnerArguments 'C:\fixed\new' ('b'*64);$rollback=Get-B6ReadPairOwnerArguments 'C:\fixed\core' ('c'*64);if($old-cmatch'ScopeName'-or$old-cnotmatch'run-current-owner.ps1 -ManifestSha256 A{64}$'-or$new-cnotmatch' -ScopeName TEST125-API-B6-ca620bac-20261028$'-or$rollback-cnotmatch'run-current-owner.ps1 -ManifestSha256 C{64}$'){throw 'ARGV_MIXED'};foreach($pair in @(@{root='C:\foreign';hash=('a'*64)},@{root='C:\fixed\new';hash=('a'*64)})){$deny=$false;try{Get-B6ReadPairOwnerArguments $pair.root $pair.hash|Out-Null}catch{$deny=$true};if(!$deny){throw 'ARGV_WIDENED'}};$full='C:\Windows\powershell.exe '+$old;$fullHash=Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($full));if($fullHash-ceq(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($old)))-or$fullHash-ceq(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($full+' ')))){throw 'FULL_CIM_ARGV_NORMALIZED'};$b6.owner.predecessorEntryKind='Router';$denied=$false;try{Get-B6ReadPairOwnerArguments 'C:\fixed\old' ('a'*64)|Out-Null}catch{$denied=$true};if(!$denied){throw 'ROUTER_KIND_ACCEPTED'};'PASS'`),'PASS');});

win('B6 current entry hold denies concurrent reads and writes without changing a single byte or writing on inverse',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:held=[Collections.Generic.List[object]]::new();$script:created=@();$script:before=@{fixture=$true};$file=Join-Path $PSScriptRoot 'current-entry.ps1';$bytes=[Text.Encoding]::UTF8.GetBytes('fixed-current-entry');[IO.File]::WriteAllBytes($file,$bytes);$hash=Get-Business5244StartupHash $bytes;function Assert-ReadPairProtection{};function Record-Phase{};function Write-ReadPairHeldCas{throw 'UNEXPECTED_WRITE'};try{Hold-B6ReadPairEntry $file $hash;if($held.Count-ne1-or$held[0].stream.CanWrite-or$held[0].written-or$held[0].beforeHash-cne$held[0].afterHash){throw 'HOLD_CHANGED'};foreach($access in @([IO.FileAccess]::Read,[IO.FileAccess]::Write)){$denied=$false;try{$other=[IO.File]::Open($file,[IO.FileMode]::Open,$access,[IO.FileShare]::ReadWrite);$other.Dispose()}catch{$denied=$true};if(!$denied){throw 'ENTRY_NOT_EXCLUSIVE'}};Restore-ReadPairBeforeRetire -OldStopped $false;if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $held[0].stream))-cne$hash){throw 'ENTRY_MUTATED'}}finally{foreach($item in $held){$item.stream.Dispose()}};if((Get-Business5244StartupHash ([IO.File]::ReadAllBytes($file)))-cne$hash){throw 'ENTRY_MUTATED_AFTER_CLOSE'};$denied=$false;try{Hold-B6ReadPairEntry $file ('0'*64)}catch{$denied=$true};if(!$denied){throw 'STALE_ENTRY_ACCEPTED'};'PASS'`),'PASS');});

win('RehearsalOnly CLI rejects wrong scope and combined recovery modes before importing or executing any source action',()=>{
 assert.equal(run(`$entry=${q(path.join(dir,'install-business-5244-readpair.ps1'))};`+String.raw`
 $script:actions=0;function Get-CimInstance{$script:actions++;throw 'UNEXPECTED_PROCESS'};function Stop-ScheduledTask{$script:actions++;throw 'UNEXPECTED_TASK'};function Open-ErpBusinessSaleSqlConnection{$script:actions++;throw 'UNEXPECTED_SQL'}
 foreach($mode in @('wrong-scope','old-loader','supersession','initializer','wrong-case')){
  $args=@{Library=$true;RehearsalOnly=$true;ScopeName='TEST125-API-B6-ca620bac-20261028'}
  switch($mode){'wrong-scope'{$args.ScopeName='TEST125-API-READ2b-20261028-41d3c213'}'old-loader'{$args.AfterLoaderRecovery=$true}supersession{$args.CurrentOnlySupersession=$true}initializer{$args.InitializerCleanRecovery=$true}'wrong-case'{$args.ScopeName='test125-api-b6-ca620bac-20261028'}}
  $expected=if($mode-ceq'wrong-case'){'READPAIR_INSTALL_SCOPE_REJECTED'}else{'B6_REHEARSAL_FIXED_ACTION_REQUIRED'};$caught=''
  try{& $entry @args}catch{$caught=$_.Exception.Message};if($caught-cne$expected-or$script:actions){throw ('REHEARSAL_CLI_GUARD_'+$mode)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly source constructor rejects wrong purpose, scope, entry and hash before native or protected reads',()=>{
 assert.equal(run(String.raw`
 $script:actions=0;function Assert-ReadPairPath{$script:actions++;throw 'UNEXPECTED_FILE'};function Hold-B6ReadPairSource{$script:actions++;throw 'UNEXPECTED_SOURCE'};function Get-CimInstance{$script:actions++;throw 'UNEXPECTED_PROCESS'}
 $fixed='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029\owner-preparation-v2\reviewed-installer-source.ps1'
 foreach($mode in @('no-apply','no-purpose','scope','entry','old-proof','hash')){
  $script:Apply=$mode-cne'no-apply';$script:RehearsalOnly=$mode-cne'no-purpose';$script:ScopeName=if($mode-ceq'scope'){'TEST125-API-READ2b-20261028-41d3c213'}else{'TEST125-API-B6-ca620bac-20261028'};$path=if($mode-ceq'entry'){'C:\wrong\reviewed-installer-source.ps1'}elseif($mode-ceq'old-proof'){$fixed.Replace('owner-preparation-v2','owner-preparation')}else{$fixed};$hash=if($mode-ceq'hash'){'not-a-hash'}else{'a'*64}
  $caught='';try{Open-B6RehearsalPreparedSource $hash $path|Out-Null}catch{$caught=$_.Exception.Message};if($caught-cne'B6_REHEARSAL_REVIEWED_ENTRY_REQUIRED'-or$script:actions){throw ('REHEARSAL_SOURCE_GUARD_'+$mode)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly V2 scoped constructor reaches only the fixed absent bundle hold before verifier, native admission or stop',()=>{
 assert.equal(run(String.raw`
 $script:Apply=$true;$script:RehearsalOnly=$true;$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:holds=0;$script:effects=0
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029';$isolated=Join-Path $PSScriptRoot 'absent-bundle'
 $definition=(Get-Command Open-B6RehearsalPreparedSource).Definition.Replace($private,$isolated);Set-Item Function:Open-B6RehearsalPreparedSource ([scriptblock]::Create($definition))
 function Assert-ReadPairPath($Path){if($Path-cne'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'){throw 'UNEXPECTED_PATH'}}
 function Get-FileHash{[pscustomobject]@{Hash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'}}
 function Hold-B6ReadPairSource($Path,$Hash){$script:holds++;if($Path-cne(Join-Path $isolated 'owner-preparation-v2\reviewed-installer-source.ps1')-or$Hash-cne('a'*64)){throw 'V2_SCOPED_SOURCE_HOLD_WIDENED'};if(Test-Path -LiteralPath $Path){throw 'UNEXPECTED_BUNDLE_PRESENT'};throw 'ISOLATED_BUNDLE_ABSENT'}
 function New-ErpBusinessSaleNativeProfileAdmission{$script:effects++;throw 'UNEXPECTED_ADMISSION'};function Stop-ReadPairColdOwner{$script:effects++;throw 'UNEXPECTED_STOP'}
 $caught='';try{Open-B6RehearsalPreparedSource ('a'*64) (Join-Path $isolated 'owner-preparation-v2\reviewed-installer-source.ps1')|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'ISOLATED_BUNDLE_ABSENT'-or$script:holds-ne1-or$script:effects-ne0-or(Test-Path -LiteralPath $isolated)){throw 'ABSENT_REHEARSAL_BUNDLE_EXECUTED'};'PASS'`),'PASS');
});
const initializerEntryFixture=String.raw`
$script:RehearsalOnly=$true;$script:ScopeName='TEST125-API-B6-ca620bac-20261028'
$entry=[pscustomobject]@{root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029';leaf='run-current-owner.ps1';manifestSha256='6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0';sha256='ebc933faf015aadc32be74f7abeaef66252ef3bc72dc52ebac265ced9ed577e5';postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false}
$script:b6=[pscustomobject]@{owner=[pscustomobject]@{predecessorEntryKind='CurrentInitializerClean';entry=$entry;owner=[pscustomobject]@{pid=31212}};coreRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V2';coreHash=('a'*64);routerRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V2';routerHash=('b'*64);entryCapture=[pscustomobject]@{directEntries=@([pscustomobject]@{path=(Join-Path $entry.root $entry.leaf);sha256=$entry.sha256})}}
`;
win('CurrentInitializerClean argv and active-entry mapping bind exact captured root, manifest, leaf and B6 scope',()=>{
 assert.equal(run(initializerEntryFixture+String.raw`
 $args=Get-B6ReadPairOwnerArguments $entry.root $entry.manifestSha256
 $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$entry.root+'\run-current-owner.ps1 -ManifestSha256 '+$entry.manifestSha256.ToUpperInvariant()+' -ScopeName TEST125-API-B6-ca620bac-20261028'
 if($args-cne$expected){throw 'INITIALIZER_ARGV_CHANGED'};$active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne1-or$active[0].path-cne(Join-Path $entry.root $entry.leaf)-or$active[0].hash-cne$entry.sha256){throw 'INITIALIZER_ENTRY_SCOPE_CHANGED'}
 foreach($pair in @(@{root='C:\wrong';hash=$entry.manifestSha256},@{root=$entry.root;hash=('f'*64)})){$denied=$false;try{Get-B6ReadPairOwnerArguments $pair.root $pair.hash|Out-Null}catch{$denied=$true};if(!$denied){throw 'ARBITRARY_OWNER_ARGV_ACCEPTED'}}
 $saved=$entry|ConvertTo-Json -Compress
 foreach($mode in @('purpose','root','leaf','manifest','kind','missing-active','duplicate-active','active-hash')){
  $b6.owner.entry=$saved|ConvertFrom-Json;$entry=$b6.owner.entry;$b6.owner.predecessorEntryKind='CurrentInitializerClean';$script:RehearsalOnly=$mode-cne'purpose';$b6.entryCapture.directEntries=@([pscustomobject]@{path=(Join-Path $entry.root $entry.leaf);sha256=$entry.sha256})
  switch($mode){root{$entry.root+='-OTHER'}leaf{$entry.leaf='start-business-5244-readpair-router.ps1'}manifest{$entry.manifestSha256=('a'*64)}kind{$b6.owner.predecessorEntryKind='Initializer'}'missing-active'{$b6.entryCapture.directEntries=@()}'duplicate-active'{$b6.entryCapture.directEntries+=@($b6.entryCapture.directEntries[0])}'active-hash'{$b6.entryCapture.directEntries[0].sha256=('c'*64)}}
  $denied=$false;try{Get-B6ReadPairActiveEntry|Out-Null}catch{$denied=$true};if(!$denied){throw ('INITIALIZER_ENTRY_WIDENED_'+$mode)}
 };'PASS'`),'PASS');
});
const rehearsalPublicationFixture=initializerEntryFixture+String.raw`
$script:pins=@{runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'};$script:result=@{};$script:heldPaths=[Collections.Generic.List[string]]::new();$script:phases=[Collections.Generic.List[string]]::new();$script:b6NativeAdmission=[pscustomobject]@{fixture='retained-native'}
$legacy=@('start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'|ForEach-Object{Join-Path $pins.runtime $_})+@('C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1')
$roots=@('ERP-BUSINESS-5244-READ2B-ROUTER-b9416929-20261028','ERP-BUSINESS-5244-OWNER-b9416929-20261028','ERP-BUSINESS-5244-B6-ROUTER-20261028','ERP-BUSINESS-5244-B6-OWNER-20261028','ERP-BUSINESS-5244-B6-ROUTER-20261029','ERP-BUSINESS-5244-B6-OWNER-20261029','ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE','ERP-BUSINESS-5244-B6-OWNER-20261029-HASHCASE','ERP-BUSINESS-5244-B6-ROUTER-20261029-SQLCOLLATION','ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION','ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029','ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029')
$direct=@(foreach($root in $roots){$leaf=if($root.Contains('ROUTER')){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'};$path=Join-Path ('C:\Sirket\ERP\releases\'+$root) $leaf;[pscustomobject]@{path=$path;sha256=$(if($root-ceq'ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029'){$entry.sha256}else{'a'*64})}})
$b6.entryCapture=[pscustomobject]@{schema='melisa-b6-rehearsal-current-entry-capture.v1';observedAt='2026-10-29T00:00:00.0000000Z';readOnly=$true;executionAuthority=$false;entries=@($legacy|ForEach-Object{[pscustomobject]@{path=$_;beforeSha256=('a'*64);afterEqualsBefore=$true}});directEntries=$direct;entryWrites=0;serviceCalls=0;sqlCalls=0;ownerCaptureSha256='2f066cc82af4fe23337a3469091aad40d6d065a66af72f60db34f2e16152c364';gate=[pscustomobject]@{path='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\business-5244-startup-exclusion-ec316a63.ps1';sha256='a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'};postExitExclusiveEntryCount=18;runtimeValidationComplete=$false}
$protected=[pscustomobject]@{listeners=@();processes=@();files=@([pscustomobject]@{path='fixture-protected';hash=('a'*64)})};$b6.owner|Add-Member protectedSnapshot $protected;$script:observed=$protected|ConvertTo-Json -Depth 20|ConvertFrom-Json
function Protection-Snapshot{return $script:observed}
function Get-ReadPairExpectedHashes($ScopeName,$NativeProfileAdmission){if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or![object]::ReferenceEquals($NativeProfileAdmission,$script:b6NativeAdmission)){throw 'PUBLICATION_NATIVE_REFERENCE_CHANGED'};return @{fixture='expected-only'}}
function Hold-B6ReadPairEntry($Path,$Hash){$script:heldPaths.Add($Path)}
function Hold-B6ReadPairSource($Path,$Hash){if($Path-cne$b6.entryCapture.gate.path-or$Hash-cne$b6.entryCapture.gate.sha256){throw 'UNEXPECTED_GATE'};$script:heldPaths.Add($Path)}
function Get-CimInstance($ClassName){if($ClassName-cne'Win32_Process'){throw 'UNEXPECTED_PROCESS_QUERY'};return @()}
function Get-ChildItem($LiteralPath,$Filter,[switch]$File){if($LiteralPath-cne$pins.runtime-or$Filter-cne'5244-retirement.pending.*.completed'-or!$File){throw 'UNEXPECTED_ARCHIVE_QUERY'};return @()}
function Record-Phase($Phase){$script:phases.Add($Phase)}
`;
win('RehearsalOnly publication accepts the real v1 capture shape without an invented top-level post-exit flag',()=>{
 assert.equal(run(rehearsalPublicationFixture+String.raw`
 $expectedFields=@('schema','observedAt','readOnly','executionAuthority','ownerCaptureSha256','gate','entries','directEntries','entryWrites','serviceCalls','sqlCalls','postExitExclusiveEntryCount','runtimeValidationComplete')
 if((@($b6.entryCapture.PSObject.Properties.Name|Sort-Object)-join'|')-cne(@($expectedFields|Sort-Object)-join'|')-or$b6.entryCapture.PSObject.Properties['postExitExclusiveBytesRequired']-or!$b6.owner.entry.postExitExclusiveBytesRequired-or$b6.owner.entry.runtimeEntryBytesVerified){throw 'NONEXISTENT_CAPTURE_FIELD_PADDED'}
 Open-B6ReadPairPublication
 if($script:heldPaths.Count-ne18-or$script:heldPaths.Contains((Join-Path $entry.root $entry.leaf))-or$script:phases.Count-ne1-or$script:phases[0]-cne'B6_CURRENT_ENTRIES_HELD_UNCHANGED_NOT_RETIRED'-or$b6.entryCapture.runtimeValidationComplete-or$b6.entryCapture.executionAuthority){throw 'PUBLICATION_SCOPE_OR_AUTHORITY_CHANGED'}
 foreach($path in $legacy){if(!$script:heldPaths.Contains($path)){throw 'LEGACY_ENTRY_OMITTED'}};'PASS'`),'PASS');
});
win('RehearsalOnly publication rejects finite scope, protection and proof-claim drift before holding entry bytes',()=>{
 assert.equal(run(rehearsalPublicationFixture+String.raw`
 $saved=$b6.entryCapture|ConvertTo-Json -Depth 20;$savedEntry=$b6.owner.entry|ConvertTo-Json -Compress
 foreach($case in @('direct-count','direct-order','owner-capture','metadata-write','runtime-claim','postexit','entry-runtime-claim','missing-entry-postexit','missing-entry-runtime','gate','protection')){
  $b6.entryCapture=$saved|ConvertFrom-Json;$b6.owner.entry=$savedEntry|ConvertFrom-Json;$entry=$b6.owner.entry;$script:observed=$protected|ConvertTo-Json -Depth 20|ConvertFrom-Json
  switch($case){'direct-count'{$b6.entryCapture.directEntries=@($b6.entryCapture.directEntries|Select-Object -First 11)}'direct-order'{$row=$b6.entryCapture.directEntries[0];$b6.entryCapture.directEntries[0]=$b6.entryCapture.directEntries[1];$b6.entryCapture.directEntries[1]=$row}'owner-capture'{$b6.entryCapture.ownerCaptureSha256=('a'*64)}'metadata-write'{$b6.entryCapture.entryWrites=1}'runtime-claim'{$b6.entryCapture.runtimeValidationComplete=$true}postexit{$b6.owner.entry.postExitExclusiveBytesRequired=$false}'entry-runtime-claim'{$b6.owner.entry.runtimeEntryBytesVerified=$true}'missing-entry-postexit'{$b6.owner.entry.PSObject.Properties.Remove('postExitExclusiveBytesRequired')}'missing-entry-runtime'{$b6.owner.entry.PSObject.Properties.Remove('runtimeEntryBytesVerified')}gate{$b6.entryCapture.gate.sha256=('a'*64)}protection{$script:observed.files[0].hash=('b'*64)}}
  $denied=$false;try{Open-B6ReadPairPublication}catch{$denied=$true};if(!$denied-or$script:heldPaths.Count-or$script:phases.Count){throw ('PUBLICATION_METADATA_ACCEPTED_'+$case)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly pre-retire recovery retains only a fully reverified healthy Current and never calls cleanup kill or restart',()=>{
 assert.equal(run(String.raw`
 $script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:RehearsalOnly=$true;$script:before=@{fixture=$true};$script:calls=[Collections.Generic.List[string]]::new();$script:failStep='';$script:newHost=[pscustomobject]@{HasExited=$false}
 $newHost|Add-Member ScriptMethod Kill {$script:calls.Add('kill');throw 'UNEXPECTED_CLEANUP_KILL'}
 $script:ready=@{fixture='ready'};$script:newResourceRows=@(@{fixture='native-resource'});$script:b6ReadProof=[pscustomobject]@{fixture='retained-release'};$script:pins=@{fixture='current'}
 function Step($Name){$script:calls.Add($Name);if($script:failStep-ceq$Name){throw 'CURRENT_REVERIFY_REJECTED'}}
 function Assert-B6ReadPairEntryHandoffReady{Step 'handoff'};function Assert-B6ReadPairRecoveryOwner{Step 'native-peer'}
 function Owner-Status{Step 'status';return @{fixture='same-current-status'}}
 function Assert-B6ReadPairCurrentRecoveryRecord($Status,[switch]$Router){if(!$Router-or$Status.fixture-cne'same-current-status'){throw 'WRONG_CURRENT_RECORD_ROUTE'};Step 'record-stage'}
 function Get-Test125BoundMaintenancePlan($RunId,[switch]$ReadPairPreparation,$ReadPairMode,$PreparedReleaseProof){if($RunId-cne'TEST125-API-B6-ca620bac-20261028'-or!$ReadPairPreparation-or$ReadPairMode-cne'Current'-or![object]::ReferenceEquals($PreparedReleaseProof,$script:b6ReadProof)){throw 'CURRENT_PLAN_SCOPE_CHANGED'};Step 'current-api-plan';return @{fixture='current-plan'}}
 function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'-or$TimeoutSec-ne5){throw 'WRONG_HEALTH_TARGET'};Step 'health-read';return @{fixture='health'}}
 function Assert-Business5244ApiHealth($Health,$Pins){if($Health.fixture-cne'health'-or![object]::ReferenceEquals($Pins,$script:pins)){throw 'WRONG_HEALTH_PINS'};Step 'health-proof'}
 function Assert-ReadPairProtection{Step 'protection'};function Record-Phase($Phase){Step $Phase};function Start-Frozen{$script:calls.Add('restart');throw 'UNEXPECTED_RESTART'}
 Restore-ReadPairBeforeRetire -OldStopped $true
 if(($script:calls-join'|')-cne'handoff|native-peer|status|record-stage|current-api-plan|health-read|health-proof|protection|PRE_RETIRE_HEALTHY_CURRENT_RETAINED'){throw 'CURRENT_RETENTION_PROOFS_SKIPPED'}
 foreach($step in @('native-peer','record-stage','current-api-plan','health-read','health-proof','protection')){
  $script:calls.Clear();$script:failStep=$step;$denied=$false;try{Restore-ReadPairBeforeRetire -OldStopped $true}catch{$denied=$true}
  if(!$denied-or$script:calls.Contains('kill')-or$script:calls.Contains('restart')-or$script:calls.Contains('PRE_RETIRE_HEALTHY_CURRENT_RETAINED')){throw ('FAILED_CURRENT_PROOF_BYPASSED_'+$step)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly failure before managed wait cancels only the unattempted marker route and never starts a replacement',()=>{
 assert.equal(run(inert+String.raw`
 $script:RehearsalOnly=$true;function Get-B6ReadPairActiveHandoff{return @{stopAttempted=$false}}
 function Stop-ReadPairColdOwner{$script:calls.Add('precheck-reject');throw 'BEFORE_MANAGED_WAIT'}
 $denied=$false;try{Invoke-ReadPairInstallSequence|Out-Null}catch{$denied=$true}
 if(!$denied-or!$script:calls.Contains('restore:False')-or$script:calls.Contains('start')-or$script:calls.Contains('retire')-or$script:calls.Contains('restore:True')){throw 'PREWAIT_FAILURE_ADOPTED_STOP'};'PASS'`),'PASS');
});

test('B6 executable source verifies and retains the closure before native preflight and first mutation, without old projection replay',()=>{const text=fs.readFileSync(path.join(dir,'install-business-5244-readpair.ps1'),'utf8');const branch=text.slice(text.indexOf("if($Library){return}"),text.indexOf("if($ScopeName-cne'TEST125-API-READ2b"));assert.ok(branch.indexOf('Open-B6ReadPairPreparedSource')<branch.indexOf('Initialize-B6ReadPairControllerPreflight'));assert.ok(branch.indexOf('Initialize-B6ReadPairControllerPreflight')<branch.indexOf('[IO.Directory]::CreateDirectory'));assert.ok(branch.indexOf('[IO.Directory]::CreateDirectory')<branch.indexOf('Invoke-ReadPairInstallSequence'));const publication=text.slice(text.indexOf('function Open-B6ReadPairPublication'),text.indexOf('function Open-ReadPairPublication'));assert.doesNotMatch(publication,/Write-ReadPairHeldCas|Publish-ReadPairSealedFile|Add-Business5244LegacyLauncherGate|Add-Business5244StarterWebGate/);assert.match(publication,/current-entry-hold-capture|B6_ENTRY_HOLD_CAPTURE_CHANGED/);});
win('B6 no-ready, foreign, Unknown or published Current owner cannot trigger a cleanup kill, inverse or restart',()=>{assert.equal(run(String.raw`
$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:before=@{fixture=$true};$script:calls=[Collections.Generic.List[string]]::new()
$script:b6InitializationExitProcess=$null
$script:newHost=[pscustomobject]@{Id=42;HasExited=$false};$newHost|Add-Member -MemberType ScriptMethod -Name Kill -Value {$script:calls.Add('kill');throw 'FIXTURE_STOP'}
$script:b6=@{owner=@{recordBeforeSha256=('d'*64)};routerRoot='C:\fixed\new';routerHash=('b'*64)}
function Connect-Business5244RetirementPeer{$calls.Add('connect');return @{fixture=$true}}
function Close-Business5244RetirementPeer($Connection){$calls.Add('close')}
function Send-Business5244RetirementRequest($Connection,$Operation){$calls.Add('status');return $script:observed}
function Assert-OldTarget($Status){$calls.Add('argv')}
function Web-Resources($Status){$calls.Add('resources');return @([pscustomobject]@{pid=43;birth='child'})}
function Get-FileHash($LiteralPath){if($LiteralPath-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'){throw 'UNEXPECTED_FILE'};$calls.Add('record');return @{Hash=$(if($script:kind-ceq'published'){'e'*64}else{'d'*64})}}
function Start-Frozen{throw 'UNEXPECTED_RESTART'};function Write-ReadPairHeldCas{throw 'UNEXPECTED_INVERSE'}
foreach($kind in @('noReady','Unknown','foreign','child','published','Running')){
 $calls.Clear();$script:ready=@{ownerBirth='owner';childPid=43;childBirth='child'};$script:newResourceRows=@([pscustomobject]@{pid=43;birth='child'})
 $script:observed=@{nativePeerVerified=$true;reply='Status';state=@{ownerPid=42;ownerBirth='owner';childPid=43;childBirth='child';phase='Running'}}
 switch($kind){noReady{$script:ready=$null}Unknown{$script:observed.state.phase='Unknown'}foreign{$script:observed.state.ownerPid=99}child{$script:observed.state.childBirth='different'}}
 $denied=$false;try{Restore-ReadPairBeforeRetire -OldStopped $true}catch{$denied=$true}
 if(!$denied-or($kind-cne'Running'-and$calls.Contains('kill'))-or($kind-ceq'noReady'-and$calls.Contains('connect'))){throw 'UNPROVEN_CLEANUP'}
 if($kind-ceq'Running'-and($calls-join'|')-cne'connect|status|argv|resources|close|record|kill'){throw 'CLEANUP_BEFORE_NATIVE_CHECK'}
};'PASS'`),'PASS');});
win('B6 verified initialization recovery requires the retained real process reference and exit73 plus fresh unchanged baseline before a single Current start',()=>{assert.equal(run(String.raw`
$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:before=@{fixture=$true};$script:calls=[Collections.Generic.List[string]]::new();$script:held=@();$script:created=@();$script:newResourceRows=@();$script:oldResourceRows=@(@{fixture=$true})
$script:b6=@{owner=@{recordBeforeSha256=('d'*64)};coreRoot='C:\fixed\core';coreHash=('c'*64)}
function Wait-ResourceExit($Rows){$calls.Add('oldexit');return $true};function Get-NetTCPConnection{param($LocalPort,$State,$ErrorAction);$calls.Add('port');return @()}
function Get-FileHash($LiteralPath){$calls.Add('baseline');return @{Hash=$(if($script:kind-ceq'recordDrift'){'e'*64}else{'d'*64})}}
function Assert-ReadPairProtection{$calls.Add('protection');if($script:kind-ceq'protectionDrift'){throw 'FIXTURE_PROTECTION'}}
function Start-Frozen($Root,$Hash,$Label){if($Root-cne'C:\fixed\core'-or$Hash-cne('c'*64)-or$Label-cne'rollback'){throw 'FOREIGN_RECOVERY_START'};$calls.Add('start');$script:newHost=[pscustomobject]@{Id=44};return @{ownerBirth='newOwner';childPid=45;childBirth='newChild'}}
function Owner-Status{return @{ownerPid=44;ownerBirth='newOwner';childPid=45;childBirth='newChild'}}
function Assert-B6ReadPairCurrentRecoveryRecord($Status){$calls.Add('recordVerified')};function Record-Phase($Phase){$calls.Add($Phase)}
$ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe';$child=Join-Path $PSScriptRoot 'inert73.ps1';[IO.File]::WriteAllText($child,'exit 73')
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$ps;$info.Arguments='-NoProfile -NonInteractive -File "'+$child+'"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$process=[Diagnostics.Process]::Start($info);[void]$process.Handle;$wrong=$null;try{if(!$process.WaitForExit(10000)-or$process.ExitCode-ne73){throw 'INERT_CHILD_FAILED'}
 [IO.File]::WriteAllText($child,'exit 1');$wrong=[Diagnostics.Process]::Start($info);[void]$wrong.Handle;if(!$wrong.WaitForExit(10000)-or$wrong.ExitCode-ne1){throw 'INERT_WRONG_CHILD_FAILED'}
 foreach($kind in @('foreignReference','wrongCode','fakeProcess','recordDrift','protectionDrift','verified')){
  $calls.Clear();$script:newHost=if($kind-ceq'wrongCode'){$wrong}elseif($kind-ceq'fakeProcess'){[pscustomobject]@{HasExited=$true;ExitCode=73}}else{$process};$script:b6InitializationExitProcess=if($kind-ceq'foreignReference'){$null}else{$script:newHost};$denied=$false
  try{Restore-ReadPairBeforeRetire -OldStopped $true}catch{$denied=$true}
  if($kind-ceq'verified'){if($denied-or($calls-join'|')-cne'oldexit|port|baseline|protection|start|recordVerified|protection|PRE_RETIRE_INVERSE_VERIFIED'){throw ('RECOVERY_ORDER '+($calls-join'|'))}}
  elseif(!$denied-or$calls.Contains('start')){throw 'UNVERIFIED_RECOVERY_STARTED'}
 }
}finally{$process.Dispose();if($wrong){$wrong.Dispose()}};'PASS'`),'PASS');});

win('legacy READ2b real active-entry hold treats the explicit null descriptor as no work and never reads a B6 control or marker',()=>{
 assert.equal(run(String.raw`
 $script:ScopeName='TEST125-API-READ2b-20261028-41d3c213';$script:touched=0
 $script:control=[pscustomobject]@{};$control|Add-Member ScriptMethod Validate {$script:touched++;throw 'UNEXPECTED_LEGACY_CONTROL'}
 function Get-B6ReadPairActiveHandoff{$script:touched++;throw 'UNEXPECTED_LEGACY_HANDOFF'}
 function Get-Business5244RetirementPendingPath{$script:touched++;throw 'UNEXPECTED_LEGACY_PENDING'}
 $raw=@(Get-B6ReadPairActiveEntry);if($raw.Count-ne1-or$null-ne$raw[0]){throw 'EXPLICIT_NULL_CANARY_NOT_EXERCISED'}
 Hold-B6ReadPairActiveEntry;if($script:touched){throw 'LEGACY_NULL_ENTERED_B6_PATH'};'PASS'
 `),'PASS');
});

const currentInputFixture=String.raw`
function Get-Business5244RetirementPendingPath{return 'C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\5244-retirement.pending'}
$script:currentPins=@{apiManifest='8B39A46F27CE8C6E0B8E41A34E29BEE2AAB0B4575129DA5503C0602C4C9C8090';manifest='91EE8B23C37A46EC89F8060967BC7A0106F68F2DE9A4A1F4199941CCE5A9E0FD'}
function Get-Business5244FinitePairPins{param($ScopeName,$Mode);if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$Mode-cne'Current'){throw 'FIXTURE_WRONG_PAIR'};return $script:currentPins}
$case=[pscustomobject]@{schema='melisa-5244-current-supersession-case.v1';readOnly=$true;executionAuthority=$false;target=@{pid=48212;birth='134377121934062288';sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value};pending=@{path=(Get-Business5244RetirementPendingPath);sha256='7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab'};record=@{path='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';sha256='3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74';actualRecordRead=$false};stopCalls=0;recordWrites=0;sqlWrites=0;serviceCalls=0;entryCaptureSha256='311b3facefe4aa9c0e0629a1fe5ca2e87d11e04f2562a3a237a51be54c116a55';current=@{apiManifest=$currentPins.apiManifest.ToLowerInvariant();webManifest=$currentPins.manifest.ToLowerInvariant();database='MELISA_ERP_SIRKET_TEST_20260929_01';server='Semih\MELISADEV'}}
$boundary=@{schema='melisa-5244-current-supersession-boundary.v1';readOnly=$true;executionAuthority=$false;caseSha256='8965df723ec4bdbbd12360129d54aab47484d67ad76d8c42f4ec7c7b67c6caf8';writes=0;sqlCalls=0;serviceCalls=0}
$entry=@{entries=@(1..6|ForEach-Object{@{path=('fixture-legacy-'+$_);beforeSha256=('a'*64)}});directEntries=@(1..10|ForEach-Object{@{path=('fixture-direct-'+$_);sha256=('b'*64)}});executionAuthority=$false;entryWrites=0;gate=@{path='fixture-gate';sha256=('c'*64)}}
# This fixture replaces ONLY the external private capture provider. It never
# issues an exit observer/admission and cannot reach live records or SQL.
function Read-Business5244CurrentSupersessionCaseFile{param($Leaf,$Sha256);$v=switch -CaseSensitive($Leaf){'supersession-fixed-case.json'{$case}'protected-boundary.json'{$boundary}'current-entry-hold-capture.json'{$entry}'oldrecord.before.json'{'fixture-record'}'oldpending.before.bin'{'fixture-pending'}default{throw 'FIXTURE_UNEXPECTED_LEAF'}};if($v-is[string]){return ,([Text.Encoding]::UTF8.GetBytes($v))};return ,([Text.Encoding]::UTF8.GetBytes(($v|ConvertTo-Json -Depth 12)))}
`;
win('Current-only fixed metadata reader preserves same SHA bytes across hash letter casing and never treats capture as live-record authority',()=>{
 assert.equal(run(currentInputFixture+String.raw`$i=Get-Business5244CurrentSupersessionFixedInputs;if($i.entrySeals.Count-ne16-or$i.case.record.actualRecordRead-ne$false-or$i.ownerPid-ne48212-or$i.scopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'FIXED_SCOPE_LOST'};'PASS'`),'PASS');
});
for(const mode of ['digest-drift','wrong-db','capture-write','wrong-owner'])win(`Current-only fixed metadata ${mode} rejects without reading a live target or minting an admission`,()=>{
 const change={'digest-drift':"$case.current.webManifest=('d'*64)",'wrong-db':"$case.current.database='VEGA2026'",'capture-write':'$case.sqlWrites=1','wrong-owner':'$case.target.pid=1'}[mode];
 assert.equal(run(currentInputFixture+change+String.raw`;$denied=$false;try{Get-Business5244CurrentSupersessionFixedInputs|Out-Null}catch{$denied=$true};if(!$denied){throw 'BAD_PASSIVE_CASE_ADMITTED'};'PASS'`),'PASS');
});
win('Current-only source constructor rejects non-current flags and wrong entry before source handles or process actions',()=>{
 assert.equal(run(String.raw`$script:CurrentOnlySupersession=$true;$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:Apply=$false;$script:AfterLoaderRecovery=$false;$script:effects=0;function Hold-B6ReadPairSource{$script:effects++;throw 'UNEXPECTED_SOURCE_READ'};foreach($mode in @('apply','old-loader','wrong-scope','wrong-entry')){$Apply=$mode-ceq'apply';$AfterLoaderRecovery=$mode-ceq'old-loader';$ScopeName=if($mode-ceq'wrong-scope'){'TEST125-API-READ2b-20261028-41d3c213'}else{'TEST125-API-B6-ca620bac-20261028'};$denied=$false;try{Open-Business5244CurrentSupersessionSource ('a'*64) 'C:\not-the-fixed-core\entry.ps1'|Out-Null}catch{$denied=$true};if(!$denied-or$script:effects){throw 'CONSTRUCTOR_CROSSED_GUARD'}};'PASS'`),'PASS');
});
win('INIT-CLEAN constructor rejects combined recovery modes, old roots and widened scope before any source or process action',()=>{
 assert.equal(run(String.raw`$script:effects=0;function Hold-B6ReadPairSource{$script:effects++;throw 'UNEXPECTED_FIXED_SOURCE_READ'};foreach($mode in @('combined','apply','old-root','wrong-scope')){$script:InitializerCleanRecovery=$true;$script:CurrentOnlySupersession=$mode-ceq'combined';$script:Apply=$mode-ceq'apply';$script:AfterLoaderRecovery=$false;$script:ScopeName=if($mode-ceq'wrong-scope'){'TEST125-API-READ2b-20261028-41d3c213'}else{'TEST125-API-B6-ca620bac-20261028'};$entry=if($mode-ceq'old-root'){'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029\install-business-5244-readpair.ps1'}else{'C:\not-the-fixed-root\install-business-5244-readpair.ps1'};$denied=$false;try{Open-Business5244CurrentSupersessionSource ('a'*64) $entry|Out-Null}catch{$denied=$true};if(!$denied-or$script:effects){throw 'INIT_CLEAN_ENTRY_WIDENED'}};'PASS'`),'PASS');
});
