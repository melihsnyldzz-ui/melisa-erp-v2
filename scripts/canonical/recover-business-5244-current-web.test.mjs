import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';

const dir=import.meta.dirname,source=path.join(dir,'recover-business-5244-current-web.ps1'),q=s=>`'${s.replaceAll("'","''")}'`,win={skip:process.platform!=='win32'};
function run(body,extra){
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'p03-cold-entry-'))),file=path.join(temp,'test.ps1');
 try{extra?.(temp);fs.writeFileSync(file,`$ErrorActionPreference='Stop'\nSet-StrictMode -Version Latest\n${body.replaceAll('__TEMP__',q(temp))}`);const r=cp.spawnSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
 finally{assert.equal(path.dirname(temp).toLowerCase(),fs.realpathSync.native(os.tmpdir()).toLowerCase());assert.match(path.basename(temp),/^p03-cold-entry-[^\\/]+$/);assert.ok(!fs.lstatSync(temp).isSymbolicLink());fs.rmSync(temp,{recursive:true});}
}
const load=`. ${q(source)} -Library;`;

test('Library is inert and the real entry parses in Windows PowerShell 5 without native/process/task/file work',win,()=>{
 assert.equal(run(String.raw`
 function Add-Type {throw 'UNEXPECTED_NATIVE'}
 function Get-CimInstance {throw 'UNEXPECTED_CIM'}
 function Invoke-RestMethod {throw 'UNEXPECTED_HTTP'}
 function Start-Process {throw 'UNEXPECTED_PROCESS'}
 function Open-ColdCurrentEntrySources {throw 'UNEXPECTED_VERIFIER'}
 . __SOURCE__ -Library
 $t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile(__SOURCE__,[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'}
 $case=Get-ColdCurrentEntryCase;if($case.expectedColdProducerSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'PIN_SHAPE'};'PASS'
 `.replaceAll('__SOURCE__',q(source))),'PASS');
});

test('actual production orchestration runs one archive then the Current supervisor in the same scope and stops on every earlier failure',win,()=>{
 const module=String.raw`param([switch]$Library,[string]$OwnerScopeName)
if(!$Library-or$OwnerScopeName-cne'TEST125-API-B6-WRITER-20261029'){throw 'BAD_LIBRARY'}
$script:events.Add('library')
function Start-Business5244OwnedSupervisor {param($InitialSlot,$ScopeName,$ColdCurrentRecovery)
 if($InitialSlot-cne'Current'-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or![object]::ReferenceEquals($ColdCurrentRecovery,$script:ctx)){throw 'WRONG_SUPERVISOR'}
 $script:events.Add('supervisor');if($script:mode-ceq'supervisor'){throw 'COLD_CURRENT_SUPERVISOR_FIXTURE'};'OWNER_RUNNING'
}`;
 const body=load+String.raw`
 $script:temp=__TEMP__;$script:events=[Collections.Generic.List[string]]::new();$script:mode=''
 function Get-ColdCurrentEntryCase{return @{core=$script:temp}}
 function Open-ColdCurrentEntrySources{$script:events.Add('sources');if($script:mode-ceq'sources'){throw 'COLD_CURRENT_SOURCE_FIXTURE'};return @{native='PINNED_NATIVE_FIXTURE'}}
 function Get-ColdCurrentProtection {param($i,$Phase='Before',$NativeContext=$null)
  if($Phase-ceq'Prepared'){
   $script:events.Add('late-protection');if(![object]::ReferenceEquals($NativeContext,$script:ctx)){throw 'WRONG_LATE_CONTEXT'}
   return @{valid=$(if($script:mode-ceq'late-string'){'false'}else{$script:mode-cne'late-protection'})}
  }
  $script:events.Add('protection');return @{valid=$(if($script:mode-ceq'before-string'){'false'}else{$script:mode-cne'protection'})}
 }
 function Add-Type {param($LiteralPath,$ReferencedAssemblies);if($LiteralPath-cne'PINNED_NATIVE_FIXTURE'){throw 'WRONG_NATIVE'};$script:events.Add('compile');if($script:mode-ceq'compile'){throw 'COLD_CURRENT_COMPILE_FIXTURE'}}
 function New-ColdCurrentNativeContext{
  $script:events.Add('prepare');if($script:mode-ceq'prepare'){throw 'COLD_CURRENT_PREPARE_FIXTURE'}
  $script:ctx=[pscustomobject]@{}
  $script:ctx|Add-Member ScriptMethod ValidatePrepared {$script:events.Add('validate');if($script:mode-ceq'validate'){throw 'COLD_CURRENT_VALIDATE_FIXTURE'}}
  $script:ctx|Add-Member ScriptMethod ArchiveOnce {$script:events.Add('archive');if($script:mode-ceq'archive'){throw 'COLD_CURRENT_ARCHIVE_FIXTURE'}}
  $script:ctx|Add-Member ScriptMethod ValidateArchived {$script:events.Add('archived');if($script:mode-ceq'archived'){throw 'COLD_CURRENT_ARCHIVED_FIXTURE'}}
  return $script:ctx
 }
 $result=Invoke-ColdCurrentRecoverySequence
 if($result-cne'OWNER_RUNNING'-or($script:events-join',')-cne'sources,protection,compile,prepare,validate,late-protection,archive,archived,library,supervisor'){throw 'ORDER_OR_OUTPUT_CHANGED'}
 foreach($m in @('sources','protection','before-string','compile','prepare','validate','late-protection','late-string','archive','archived','supervisor')){
  $script:mode=$m;$script:events.Clear();$script:ColdCurrentNative=$null;$caught=$false;try{Invoke-ColdCurrentRecoverySequence|Out-Null}catch{$caught=$true}
  if(!$caught-or@($script:events|Where-Object{$_-ceq'archive'}).Count-gt1-or@($script:events|Where-Object{$_-ceq'prepare'}).Count-gt1){throw 'RETRY_OR_MISSING_REJECT'}
  if($m-cne'supervisor'-and$script:events.Contains('supervisor')){throw 'FAILED_STAGE_STARTED_OWNER'}
 };'PASS'`;
 assert.equal(run(body,t=>fs.writeFileSync(path.join(t,'start-business-5244-owned.ps1'),module)),'PASS');
});

test('verifier exact hashes and typed passive flags reject forged authority, wrong source and nonhex pins',win,()=>{
 assert.equal(run(load+String.raw`
 function Get-ColdCurrentEntryCase{return @{expectedColdProducerSha256=('1'*64)}}
 $seed=@{schema='melisa-b6-cold-current-verification.v1';sourceCommit=('a'*40);entrySha256=('2'*64);manifestSha256=('3'*64);producerSha256=('1'*64);nativeSha256=('4'*64);liveGithubVerified=$true;installed=$false;applied=$false;executionAuthority=$false;admissionIssued=$false;runtimeValidationComplete=$false}
 Assert-ColdCurrentVerification ([pscustomobject]$seed) ('2'*64) ('3'*64)
 foreach($field in @('installed','applied','executionAuthority','admissionIssued','runtimeValidationComplete')){foreach($value in @($true,'false',0)){$v=$seed.Clone();$v[$field]=$value;$caught=$false;try{Assert-ColdCurrentVerification ([pscustomobject]$v) ('2'*64) ('3'*64)}catch{$caught=$true};if(!$caught){throw 'PASSIVE_FLAG_FORGERY'}}}
 foreach($field in @('entrySha256','manifestSha256','producerSha256')){$v=$seed.Clone();$v[$field]='0'*64;$caught=$false;try{Assert-ColdCurrentVerification ([pscustomobject]$v) ('2'*64) ('3'*64)}catch{$caught=$true};if(!$caught){throw 'HASH_FORGERY'}}
 foreach($bad in @(@{nativeSha256='G'*64},@{liveGithubVerified=$false},@{liveGithubVerified='true'},@{sourceCommit='a'*39})){$v=$seed.Clone();foreach($key in $bad.Keys){$v[$key]=$bad[$key]};$caught=$false;try{Assert-ColdCurrentVerification ([pscustomobject]$v) ('2'*64) ('3'*64)}catch{$caught=$true};if(!$caught){throw 'BAD_VERIFIER_ACCEPTED'}};'PASS'
 `),'PASS');
});

test('source holds reject changed bytes and retain read handles until release on synthetic files only',win,()=>{
 assert.equal(run(load+String.raw`
 $script:ColdCurrentEntryHolds=[Collections.Generic.List[IO.FileStream]]::new();$file=Join-Path __TEMP__ 'held.txt';[IO.File]::WriteAllText($file,'ÖNCE-00161',[Text.Encoding]::UTF8)
 $bytes=[IO.File]::ReadAllBytes($file);$hash=Get-ColdCurrentEntrySha256 $bytes;$result=Hold-ColdCurrentEntrySource $file $hash
 if((Get-ColdCurrentEntrySha256 $result)-cne$hash-or$script:ColdCurrentEntryHolds.Count-ne1){throw 'HOLD_NOT_BOUND'}
 $caught=$false;try{[IO.File]::WriteAllText($file,'CHANGED')}catch{$caught=$true};if(!$caught){throw 'SOURCE_NOT_HELD'}
 $caught=$false;try{Hold-ColdCurrentEntrySource $file ('0'*64)|Out-Null}catch{$caught=$true};if(!$caught-or$script:ColdCurrentEntryHolds.Count-ne1){throw 'BAD_PIN_ACCEPTED'}
 foreach($h in $script:ColdCurrentEntryHolds){$h.Dispose()};[IO.File]::WriteAllText($file,'AFTER');'PASS'
 `),'PASS');
});

test('entry has no candidate installer, task mutation, API restart or generic recovery dispatch',()=>{
 const s=fs.readFileSync(source,'utf8');
 assert.doesNotMatch(s,/RegisterTask|Set-ScheduledTask|Stop-Process|Start-Process|\.Kill\(|New-Test125ReadPairTransition|New-ErpBusinessSaleWriterProfileAdmission|Invoke-Expression/);
 assert.match(s,/if\(\$Library\)\{return\}/);
 assert.match(s,/while\(\$true\)\{Start-Sleep -Seconds 1\}/);
 assert.match(s,/Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-WRITER-20261029' -ColdCurrentRecovery \$script:ColdCurrentNative/);
});

test('actual entry catch retains an archived failing capability and only disposes a pre-archive capability once',win,()=>{
 assert.equal(run(load+String.raw`
 $t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(__SOURCE__,[ref]$t,[ref]$e)
 $tries=@($a.EndBlock.Statements|Where-Object{$_-is[Management.Automation.Language.TryStatementAst]})
 if($tries.Count-ne1){throw 'ENTRY_TRY_NOT_UNIQUE'};$catch=[scriptblock]::Create($tries[0].CatchClauses[0].Body.Extent.Text.Trim().TrimStart('{').TrimEnd('}'))
 $script:dispose=0;$script:retains=0;$script:mode='archived'
 $script:ColdCurrentNative=[pscustomobject]@{}
 $script:ColdCurrentNative|Add-Member ScriptMethod Dispose {$script:dispose++;if($script:mode-ceq'archived'){throw 'COLD_CURRENT_ARCHIVED_SAFETY_HOLDS_RETAINED'}}
 function Wait-ColdCurrentRetainedFailure($Code){$script:retains++;if($Code-cne'COLD_CURRENT_UNCLASSIFIED_FAILURE'){throw 'UNBOUNDED_CODE'};throw 'TEST_RETAIN_STOP'}
 $caught=$false;try{try{throw 'SECRET-argv-token-SENTINEL'}catch{&$catch}}catch{$caught=$_.Exception.Message-ceq'TEST_RETAIN_STOP'}
 if(!$caught-or$script:dispose-ne1-or$script:retains-ne1-or$null-eq$script:ColdCurrentNative){throw 'ARCHIVED_GATE_RELEASED_OR_RETRIED'}
 $script:mode='prearchive';$script:dispose=0;$script:retains=0
 $caught=$false;try{try{throw 'SECRET-argv-token-SENTINEL'}catch{&$catch}}catch{$caught=$_.Exception.Message-ceq'COLD_CURRENT_UNCLASSIFIED_FAILURE'}
 if(!$caught-or$script:dispose-ne1-or$script:retains-ne0-or$null-ne$script:ColdCurrentNative){throw 'PREARCHIVE_RELEASE_NOT_FINITE'};'PASS'
 `.replaceAll('__SOURCE__',q(source))),'PASS');
});

test('actual fresh protection uses genuine Prepared context, no held-entry reopen, protected-PID listener union and exact parent argv',win,()=>{
 assert.equal(run(load+String.raw`
 # This process has only inert in-memory process/task/network doubles. The real
 # production protection function remains unchanged; no native runtime is read.
 Add-Type -TypeDefinition 'public sealed class Business5244ColdCurrentRecovery {public static int Calls;public static bool Fail;public void ValidatePrepared(){Calls++;if(Fail)throw new System.InvalidOperationException("COLD_CURRENT_FIXTURE_DRIFT");}}'
 $script:hash='a'*64;$script:entryReads=0;$script:fileReads=0;$script:taskReads=0;$script:cimReads=0;$script:healthReads=0
 $script:birth=[datetime]::Parse('2026-11-01T12:00:00Z').ToUniversalTime();$script:parentArgv='powershell.exe -File exact-OWNER-source.ps1'
 $script:parent=[pscustomobject]@{ProcessId=27732;CreationDate=$script:birth;ExecutablePath='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';CommandLine=$script:parentArgv}
 $script:protected=[pscustomobject]@{ProcessId=42;CreationDate=$script:birth;ExecutablePath='fixture-native.exe';CommandLine='unused'}
 $script:rows=@($script:protected,$script:parent)
 $script:baseListener=[pscustomobject]@{LocalPort=4144;LocalAddress='127.0.0.1';OwningProcess=42};$script:listeners=@($script:baseListener)
 function Get-ColdCurrentEntryCase{return @{parentPid=27732;parentBirth=$script:birth.ToFileTimeUtc().ToString();parentArgvSha256=(Get-ColdCurrentEntrySha256 ([Text.Encoding]::UTF8.GetBytes($script:parentArgv)))}}
 function Assert-ColdCurrentEntryPath($Path){}
 function Get-FileHash {param($LiteralPath);$script:fileReads++;if($LiteralPath-ceq'entry-fixture'){$script:entryReads++};return @{Hash=$script:hash}}
 function Get-CimInstance {param($Class);if($Class-cne'Win32_Process'){throw 'WRONG_CLASS'};$script:cimReads++;return $script:rows}
 function Invoke-CimMethod {param($InputObject,$MethodName);if($MethodName-cne'GetOwnerSid'){throw 'WRONG_METHOD'};return @{ReturnValue=0;Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}}
 function Get-NetTCPConnection {param($State,$ErrorAction);if($State-cne'Listen'){throw 'WRONG_STATE'};return $script:listeners}
 $script:instance=[pscustomobject]@{EnginePID=27732;InstanceGuid='fixture-guid'}
 $script:instances=[pscustomobject]@{Count=1};$script:instances|Add-Member ScriptMethod Item {param($n);if($n-ne1){throw 'WRONG_INSTANCE'};return $script:instance}
 $script:task=[pscustomobject]@{Xml='<Task>Exact fixture</Task>'}
 $script:task|Add-Member ScriptMethod GetInstances {param($n);if($n-ne0){throw 'WRONG_TASK_CALL'};return $script:instances}
 $script:task|Add-Member ScriptMethod GetSecurityDescriptor {param($n);if($n-ne7){throw 'WRONG_SDDL_CALL'};return 'FIXTURE-SDDL'}
 $script:folder=[pscustomobject]@{};$script:folder|Add-Member ScriptMethod GetTask {param($name);if($name-cne'Melisa-ERP-TEST-Canonical'){throw 'WRONG_TASK_NAME'};$script:taskReads++;return $script:task}
 $script:svc=[pscustomobject]@{};$script:svc|Add-Member ScriptMethod Connect {}; $script:svc|Add-Member ScriptMethod GetFolder {param($name);if($name-cne'\'){throw 'WRONG_TASK_FOLDER'};return $script:folder}
 function New-Object {param($ComObject);if($ComObject-cne'Schedule.Service'){throw 'UNEXPECTED_COM'};return $script:svc}
 function Invoke-RestMethod {param($Uri,$TimeoutSec);if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'WRONG_HEALTH_URL'};$script:healthReads++;return [pscustomobject]@{package='fixture';safe=$true}}
 $inputs=@{
  before=@{entries=@(@{path='entry-fixture';sha256=$script:hash});files=@(@{path='base-file';sha256=$script:hash});recordPath='record-file';recordSha256=$script:hash;protectedSnapshot=@{files=@(@{path='protected-file';hash=$script:hash});processes=@(@{pid=42;birth=$script:birth.ToString('o');exe='fixture-native.exe'});listeners=@($script:baseListener)}}
  api=@{files=@(@{path='api-file';sha256=$script:hash});health=[pscustomobject]@{package='fixture';safe=$true}}
  task=@{xmlSha256=(Get-ColdCurrentEntrySha256 ([Text.Encoding]::UTF8.GetBytes([string]$script:task.Xml)));sddlSha256=(Get-ColdCurrentEntrySha256 ([Text.Encoding]::UTF8.GetBytes('FIXTURE-SDDL')));enginePid=27732;instanceGuid='fixture-guid'}
  sale=@{files=@(@{file='sale-proof';sha256=$script:hash})}
 }
 $before=Get-ColdCurrentProtection $inputs
 if(!$before.valid-or$before.entryProof-cne'FRESH_PATH_SHA256'-or!$before.directEntryPathReads-or$script:entryReads-ne1){throw ('BEFORE_FALSE_POSITIVE:' + ($before|ConvertTo-Json -Depth 5 -Compress))}
 $native=[Business5244ColdCurrentRecovery]::new();$previousFileReads=$script:fileReads;$previousTaskReads=$script:taskReads;$previousHealthReads=$script:healthReads;$previousCimReads=$script:cimReads
 $prepared=Get-ColdCurrentProtection $inputs -Phase Prepared -NativeContext $native
 if(!$prepared.valid-or$prepared.directEntryPathReads-or$prepared.entryProof-cne'NATIVE_HELD_56_REVALIDATED'-or$script:entryReads-ne1-or[Business5244ColdCurrentRecovery]::Calls-ne1-or$script:fileReads-le$previousFileReads-or$script:taskReads-ne($previousTaskReads+1)-or$script:healthReads-ne($previousHealthReads+1)-or$script:cimReads-ne($previousCimReads+1)){throw 'LATE_GUARD_NOT_FRESH'}
 foreach($fake in @($null,[pscustomobject]@{ValidatePrepared='fake'},'true')){$r=Get-ColdCurrentProtection $inputs -Phase Prepared -NativeContext $fake;if($r.valid-or$r.checks.entriesEqual){throw 'FAKE_CONTEXT_ACCEPTED'}}
 [Business5244ColdCurrentRecovery]::Fail=$true;$r=Get-ColdCurrentProtection $inputs -Phase Prepared -NativeContext $native;[Business5244ColdCurrentRecovery]::Fail=$false;if($r.valid-or$r.checks.entriesEqual){throw 'NATIVE_DRIFT_ACCEPTED'}
 $script:listeners=@($script:baseListener,[pscustomobject]@{LocalPort=65000;LocalAddress='127.0.0.1';OwningProcess=42});$r=Get-ColdCurrentProtection $inputs -Phase Prepared -NativeContext $native
 if($r.valid-or$r.checks.listenersEqual){throw 'PROTECTED_PID_UNLISTED_PORT_IGNORED'}
 $script:listeners=@($script:baseListener,[pscustomobject]@{LocalPort=65000;LocalAddress='127.0.0.1';OwningProcess=777});$r=Get-ColdCurrentProtection $inputs -Phase Prepared -NativeContext $native
 if(!$r.valid){throw 'UNRELATED_PROCESS_PORT_INCLUDED'}
 $script:parent.CommandLine='powershell.exe -File wrong-STEADY-source.ps1';$r=Get-ColdCurrentProtection $inputs -Phase Prepared -NativeContext $native
 if($r.valid-or$r.checks.parentEqual){throw 'PARENT_ARGV_DRIFT_IGNORED'};'PASS'
 `),'PASS');
});
