import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const helper=fileURLToPath(new URL('./p03-pr54-new-owner-empty-recovery.ps1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const extract=(file,names)=>`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(file)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};${names.map(name=>`$defs=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq${quote(name)}},$true));if($defs.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text));`).join('')}`;
function run(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$text=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($text))','utf16le').toString('base64')],{input:"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n"+code,encoding:'utf8',timeout:15000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
const functions=extract(engine,['OldReuseHold','OldReusePin','AssertOldPidLifetimes','Need','Hash','Json','XmlHash','Field','Identity','CandidateParentSnapshot','CandidateInventory','CandidateInventoryCore','ConsoleAuxiliaries','WaitConsoleAbsence','AssertEmpty'])+'\n'+extract(helper,['Require-NewDrain','Assert-NewDrainOldAbsent','Capture-NewDrainCandidate','Current-NewDrainFrame','Stop-NewDrainExact','Wait-NewDrainCoreQuiet','Invoke-NewDrain']);
const fixture=String.raw`
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001';$base='C:\fixture';$BeforeImageSha256='b'*64;$ProfileSha256='a'*64;$isRehearsal=$false;$ProfilePath='C:\fixture\profile.json';$BeforeImagePath='C:\fixture\before.json';$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')
function Reset-Fixture{
 $script:trace=@();$script:saves=@();$script:stopPids=@();$script:rawCalls=0;$script:protectedBad=$false;$script:foreignAfterCore=$false;$script:foreignListener=$false;$script:reuseAfterCore=$false;$script:disposed=$false;$script:newSequence=$null
 $script:taskState=4;$script:birth=[DateTime]::Parse('2026-10-19T12:00:00Z').ToUniversalTime();$script:roles=@('coreSupervisor','terminalWatcher','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer');$script:all=@();$script:rows=@();$script:receipts=@{}
 foreach($n in 0..7){$role=$roles[$n];$parent=if($n-eq1){900}else{if($n-eq0){101}else{100}};$row=[pscustomobject]@{role=$role;pid=100+$n;parentPid=$parent;nodePath='C:\fixture\node.exe';ownerSid=$owner;commandLine=('fixed-'+$role);creationTime=$birth.AddTicks($(if($n-eq1){0}else{$n+1})).ToString('o');bindings=@()};$script:rows+=,$row;$script:all+=,[pscustomobject]@{ProcessId=$row.pid;ParentProcessId=$row.parentPid;ExecutablePath=$row.nodePath;CommandLine=$row.commandLine;CreationDate=[DateTime]::Parse($row.creationTime);Name='node.exe';OwnerSid=$owner}}
 $scheduleParent=[pscustomobject]@{ProcessId=900;ParentProcessId=1;ExecutablePath='C:\Windows\System32\svchost.exe';CommandLine='C:\Windows\system32\svchost.exe -k netsvcs -p';CreationDate=$birth.AddSeconds(-1);Name='svchost.exe';OwnerSid='S-1-5-18'};$script:all+=,$scheduleParent
 Remove-Variable oldReusePins -Scope Script -ErrorAction SilentlyContinue;$script:capturedCandidatePids=@();$old=[pscustomobject]@{pid=1;creationTime='2026-10-18T00:00:00Z'};$script:before=[pscustomobject]@{identities=[pscustomobject]@{old=$old};tasks=@()};$rules=@()
 foreach($r in $rows){$receipt=$null;if($r.role-cnotin@('coreSupervisor','terminalWatcher')){$path='C:\fixture\'+$r.role+'.json';$receipt=[pscustomobject]@{path=$path;fields=[pscustomobject]@{pid='pid';parentPid='parentPid';birth='creationTime';parentBirth='parentCreationTime';sourceCommit='sourceCommit';configSha256='configSha256';copyId='copyId';actualT1='actualT1'};exactKeys=@('run','pid','parentPid','parentCreationTime','creationTime','stage','sourceCommit','configSha256','copyId','actualT1');schemaVersion=$null};$receipts[$path]=[ordered]@{run='11111111-2222-3333-4444-555555555555';pid=$r.pid;parentPid=100;parentCreationTime=$rows[0].creationTime;creationTime=$r.creationTime;stage=$r.role;sourceCommit='c'*40;configSha256='d'*64;copyId='copy';actualT1=$false}}
 $rules+=,[pscustomobject]@{role=$r.role;nodePath=$r.nodePath;commandLine=$r.commandLine;packageRoot='C:\fixture\new';sourceCommit='c'*40;config=[pscustomobject]@{path='C:\fixture\config.json';sha256='d'*64};receipt=$receipt;taskName='Melisa-Terminal-Completion-Logon'}}
 foreach($role in @('hub','hubWatcher')){$rules+=,[pscustomobject]@{role=$role;nodePath='C:\fixture\node.exe';commandLine='absent-'+$role;receipt=$null}}
 $script:profile=[pscustomobject]@{candidateRules=$rules;oldWatchers=@([pscustomobject]@{pid=2},[pscustomobject]@{pid=3});protectedProcesses=@();packages=@([pscustomobject]@{root='C:\fixture\new';sourceCommit='c'*40});stopper=[pscustomobject]@{path='C:\fixture\stop.ps1'}};$script:before|Add-Member NoteProperty copyId 'copy'
 $script:instances=@();$instance=[pscustomobject]@{Name='Melisa-Terminal-Completion-Logon';Path='\Melisa-Terminal-Completion-Logon';InstanceGuid='instance';EnginePID=101;State=4};$instance|Add-Member ScriptMethod Stop {$script:trace+=,'COM_STOP';$script:instances=@();$script:taskState=3;$script:all=@($script:all|Where-Object{$_.ProcessId-ne101})};$script:instances+=,$instance
 $script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($name) [pscustomobject]@{State=$script:taskState}}
 $script:coreHandle=[pscustomobject]@{Id=100;Handle=[IntPtr]17;HasExited=$false;StartTime=[DateTime]::Parse($rows[0].creationTime)};$coreHandle|Add-Member ScriptMethod Dispose {$script:disposed=$true}
}
function Inventory{$script:rawCalls++;return [pscustomobject]@{all=@($script:all);allListeners=@($(if($script:foreignListener){[pscustomobject]@{LocalPort=4184;LocalAddress='127.0.0.1';OwningProcess=999}}));listeners=@($(if($script:foreignListener){[pscustomobject]@{LocalPort=4184;LocalAddress='127.0.0.1';OwningProcess=999}}));instances=@($script:instances)}}
function ProtectedProcesses($inv){if($script:protectedBad){throw 'P03_PHYSICAL_PROTECTED_PROCESS_CHANGED'}}
function Assert-NewDrainPins{if($script:taskState-cnotin@(3,4)){throw 'FIXTURE_TASK_DRIFT'}}
function VerifyRule($rule){}
function Tokens($text){return @($text)}
function NoReparse($path){}
function IsWatcherCommand($text){return $text-ceq'fixed-terminalWatcher'}
function RehearsalBindings($role,$row,$inv){}
function SupervisorParent($evidence,$expected,$inv){$watch=@($evidence.processes|Where-Object{$_.role-ceq'terminalWatcher'})[0];if($watch.pid-ne$expected.parentPid){throw 'FIXTURE_SUPERVISOR_PARENT'}}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction) if($ClassName-ceq'Win32_Service'){return [pscustomobject]@{State='Running';StartName='LocalSystem';PathName='C:\Windows\system32\svchost.exe -k netsvcs -p';ProcessId=900}};if($Filter-match'ProcessId=(\d+)'){return @($script:all|Where-Object{$_.ProcessId-eq[int]$Matches[1]})};throw 'FIXTURE_CIM'}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction) return [pscustomobject]@{ReturnValue=0;Sid=$InputObject.OwnerSid}}
function ReadPinned($path,$sha){if($script:receipts.ContainsKey($path)){return ,[Text.Encoding]::UTF8.GetBytes(($script:receipts[$path]|ConvertTo-Json -Compress))};return ,[Text.Encoding]::UTF8.GetBytes('{}')}
function Read-NewDrainReceipt($role,$path){return [ordered]@{role=$role;path=$path;sha256='e'*64}}
function Hold-NewDrainCore($identity){return $script:coreHandle}
function Open-NewDrainOutput{$script:trace+=,'OUTER_OPEN';$script:newSequence=0}
function Record-NewDrain($event,$identity){$script:trace+=,($event+':'+$(if($null-ne$identity-and$identity.PSObject.Properties.Name-contains'pid'){$identity.pid}else{''}));return [ordered]@{path='C:\fixture\event';sha256='e'*64}}
function Save-NewDrain($path,$value){$script:saves+=,$value;return [ordered]@{path=$path;sha256='e'*64}}
function Invoke-NewDrainStopper($identity){$script:trace+=,('STOP:'+ $identity.pid);$script:stopPids+=,$identity.pid;$script:all=@($script:all|Where-Object{$_.ProcessId-ne$identity.pid});if($identity.pid-eq100){$script:coreHandle.HasExited=$true;if($script:reuseAfterCore){$script:all+=,[pscustomobject]@{ProcessId=100;ParentProcessId=101;ExecutablePath='C:\fixture\node.exe';CommandLine='fixed-coreSupervisor';CreationDate=[DateTime]::UtcNow;Name='node.exe';OwnerSid=$owner}};if($script:foreignAfterCore){$script:all+=,[pscustomobject]@{ProcessId=999;ParentProcessId=100;ExecutablePath='C:\fixture\foreign.exe';CommandLine='foreign';CreationDate=[DateTime]::UtcNow;Name='foreign.exe';OwnerSid=$owner}}}}
function Start-Sleep{param($Milliseconds) throw 'FIXTURE_UNEXPECTED_SLEEP'}
function Reject($name,[scriptblock]$body){try{&$body;throw 'FIXTURE_EXPECTED_REJECTION'}catch{if($_.Exception.Message-ceq'FIXTURE_EXPECTED_REJECTION'){throw};'REJECTED='+$name}}
`;
test('new drain helper parses and imports only pinned function definitions; never invokes engine dispatcher or SQL/trade commands',()=>{
 const source=fs.readFileSync(helper,'utf8');assert.match(source,/FindAll[\s\S]*FunctionDefinitionAst/);assert.match(source,/99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def/);assert.doesNotMatch(source,/Set-ScheduledTask|Register-ScheduledTask|Start-ScheduledTask|Invoke-Sqlcmd|ExecuteNonQuery|RESTORE DATABASE|Remove-Item|Kill\(/);assert.match(source,/FileMode\]::CreateNew/);assert.match(source,/Flush\(\$true\)/);assert.match(source,/Get-ChildItem -LiteralPath \$profile.journalDirectory/);
 const out=run(`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile(${quote(helper)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};'PARSED'`);assert.equal(out.trim(),'PARSED');
});
test('same-session original CandidateInventory admits full eight, preserves cached parent birth after core first and emits genuine zero only',()=>{
 const out=run(functions+'\n'+fixture+String.raw`
Reset-Fixture;$Action='Inspect';$x=Invoke-NewDrain;if($x.mutationExecuted-or$trace.Count-ne0-or$saves.Count-ne0){throw 'FIXTURE_INSPECT_MUTATION'}
Reset-Fixture;$Action='Drain';$result=Invoke-NewDrain
if($result.status-cne'NEW_OWNER_EMPTY_CANDIDATE_READY'-or-not$disposed){throw 'FIXTURE_RESULT'}
if(($stopPids-join',')-cne'100,107,106,105,104,103,102'){throw 'FIXTURE_STOP_ORDER'}
if($saves.Count-ne1-or$saves[0].processes.Count-ne0-or$saves[0].receipts.Count-ne0){throw 'FIXTURE_NOT_ZERO'}
if($parentPins[100].Ticks-ne[DateTime]::Parse($rows[0].creationTime).ToUniversalTime().Ticks){throw 'FIXTURE_PARENT_CACHE'}
if($trace[0]-cne'OUTER_OPEN'-or$trace[1]-cne'NEW_COM_STOP_INTENT:'-or$trace[2]-cne'COM_STOP'){throw 'FIXTURE_DURABLE_ORDER'}
'CORE_FIRST_PARENT_PINS_ZERO_VERIFIED'
`);assert.match(out,/CORE_FIRST_PARENT_PINS_ZERO_VERIFIED/);
});
test('unknown probe, listener, UID drift and failed protected proof fail closed without output or further stops',()=>{
 const out=run(functions+'\n'+fixture+String.raw`
Reset-Fixture;$Action='Drain';$script:all+=,[pscustomobject]@{ProcessId=500;ParentProcessId=100;ExecutablePath='C:\fixture\powershell.exe';CommandLine='unadmitted-probe';CreationDate=[DateTime]::UtcNow;Name='powershell.exe';OwnerSid=$owner};Reject 'precut-probe' {Invoke-NewDrain};if($stopPids.Count-ne0-or$saves.Count-ne0){throw 'FIXTURE_PRECUT_EFFECT'}
Reset-Fixture;$Action='Drain';$script:foreignAfterCore=$true;Reject 'postcut-child' {Invoke-NewDrain};if(($stopPids-join',')-cne'100'-or$saves.Count-ne0-or-not($trace-contains'NEW_DRAIN_FAILED:')){throw 'FIXTURE_POSTCUT_EFFECT'}
Reset-Fixture;$Action='Drain';$script:foreignListener=$true;Reject 'listener' {Invoke-NewDrain};if($stopPids.Count-ne0-or$saves.Count-ne0){throw 'FIXTURE_LISTENER_EFFECT'}
Reset-Fixture;$Action='Drain';$script:reuseAfterCore=$true;Reject 'reused-core' {Invoke-NewDrain};if(($stopPids-join',')-cne'100'-or$saves.Count-ne0-or-not($trace-contains'NEW_DRAIN_FAILED:')){throw 'FIXTURE_REUSE_EFFECT'}
Reset-Fixture;$Action='Drain';$script:protectedBad=$true;Reject 'protected' {Invoke-NewDrain};if($stopPids.Count-ne0){throw 'FIXTURE_PROTECTED_EFFECT'}
Reset-Fixture;$Action='Drain';$receipts['C:\fixture\erpApi.json'].parentCreationTime=$birth.AddSeconds(1).ToString('o');Reject 'receipt-parent' {Invoke-NewDrain};if($stopPids.Count-ne0){throw 'FIXTURE_RECEIPT_EFFECT'}
`);for(const name of ['precut-probe','postcut-child','listener','reused-core','protected','receipt-parent'])assert.match(out,new RegExp('REJECTED='+name));
});

test('versioned raw OLD reused PID is observation-only, lifetime-held and rechecked by CandidateInventory and AssertEmpty',()=>{
 const out=run(functions+'\n'+fixture+String.raw`
function OldReuseHold($row){return [pscustomobject]@{HasExited=$false}}
function Get-FileHash{param($LiteralPath,$Algorithm) return [pscustomobject]@{Hash=$(if($script:imageDrift){'B'*64}else{'A'*64})}}
function Add-Reuse{
 $script:imageDrift=$false
 $script:before.copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';foreach($r in $script:receipts.Values){$r.copyId=$script:before.copyId}
 $script:profile|Add-Member NoteProperty oldSettings ([pscustomobject]@{sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'})
 $script:newSettings=[pscustomobject]@{components=[pscustomobject]@{erpApiNative=[pscustomobject]@{sourceCommit='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'}}}
 $script:profile.oldWatchers[0]|Add-Member NoteProperty creationTime '2026-10-18T00:00:00Z'
 $script:parent=[pscustomobject]@{ProcessId=400;ParentProcessId=0;ExecutablePath='C:\other\node_repl.exe';CommandLine='node_repl';CreationDate=$birth.AddMinutes(-2);Name='node_repl.exe';OwnerSid=$owner}
 $script:reused=[pscustomobject]@{ProcessId=2;ParentProcessId=400;ExecutablePath='C:\Windows\System32\conhost.exe';CommandLine='conhost unrelated';CreationDate=$birth.AddMinutes(-1);Name='conhost.exe';OwnerSid=$owner}
 $script:all+=,$parent;$script:all+=,$reused
}
Reset-Fixture;Add-Reuse;$Action='Drain';$x=Invoke-NewDrain
if($x.status-cne'NEW_OWNER_EMPTY_CANDIDATE_READY'-or2-in$stopPids-or400-in$stopPids-or@($all|Where-Object{$_.ProcessId-eq2}).Count-ne1){throw 'FIXTURE_REUSE_STOP_AUTHORITY'}
# Exact zero candidate still passes the new engine without filtering raw rows.
$empty=[pscustomobject]@{processes=@();receipts=@()};$y=CandidateInventory $empty;AssertEmpty $y.inventory
if(@($y.inventory.all|Where-Object{$_.ProcessId-eq2}).Count-ne1){throw 'FIXTURE_RAW_FILTERED'}
$script:imageDrift=$true;Reject 'image-drift' {CandidateInventory $empty};$script:imageDrift=$false
$reused.CommandLine='changed';Reject 'argv-drift' {CandidateInventory $empty};$reused.CommandLine='conhost unrelated'
$parent.CreationDate=$parent.CreationDate.AddSeconds(1);Reject 'parent-reuse' {CandidateInventory $empty}
Reset-Fixture;Add-Reuse;$raw=Inventory;$raw.allListeners=@([pscustomobject]@{OwningProcess=2});Reject 'listener-linked' {AssertOldPidLifetimes $raw}
Reset-Fixture;Add-Reuse;$script:capturedCandidatePids=@(2);Reject 'candidate-overlap' {AssertOldPidLifetimes (Inventory)}
Reset-Fixture;Add-Reuse;$profile.protectedProcesses=@([pscustomobject]@{pid=400});Reject 'protected-parent' {AssertOldPidLifetimes (Inventory)}
Reset-Fixture;Add-Reuse;$reused.CreationDate=[DateTime]::Parse('2026-10-18T00:00:00Z');Reject 'old-same-birth' {Invoke-NewDrain}
Reset-Fixture;Add-Reuse;$reused.OwnerSid='foreign';Reject 'foreign-owner' {Invoke-NewDrain}
Reset-Fixture;Add-Reuse;$reused.CommandLine='C:\fixture\new\child';Reject 'package-linked' {Invoke-NewDrain}
Reset-Fixture;Add-Reuse;$reused.ParentProcessId=100;Reject 'candidate-parent' {Invoke-NewDrain}
Reset-Fixture;Add-Reuse;$script:all+=,[pscustomobject]@{ProcessId=401;ParentProcessId=2};Reject 'descendant' {Invoke-NewDrain}
Reset-Fixture;Add-Reuse;[void](AssertOldPidLifetimes (Inventory));$script:all=@($all|Where-Object{$_.ProcessId-ne2});$new=[pscustomobject]@{ProcessId=3;ParentProcessId=400;ExecutablePath=$reused.ExecutablePath;CommandLine=$reused.CommandLine;CreationDate=$birth;Name='conhost.exe';OwnerSid=$owner};$profile.oldWatchers[1]|Add-Member NoteProperty creationTime '2026-10-18T00:00:00Z';$script:all+=,$new;Reject 'late-reuse' {AssertOldPidLifetimes (Inventory)}
'REUSE_OBSERVATION_ONLY_VERIFIED'
`);assert.match(out,/REUSE_OBSERVATION_ONLY_VERIFIED/);for(const n of ['image-drift','listener-linked','candidate-overlap','protected-parent','argv-drift','parent-reuse','old-same-birth','foreign-owner','package-linked','candidate-parent','descendant','late-reuse'])assert.match(out,new RegExp('REJECTED='+n));
});
test('already empty cohort is independently inventoried and inspected before a real zero candidate is published',()=>{
 const out=run(functions+'\n'+fixture+String.raw`
Reset-Fixture;$script:all=@();$script:instances=@();$script:taskState=3;$Action='Inspect';$x=Invoke-NewDrain;if($x.status-cne'NEW_OWNER_EMPTY_INSPECTED'-or$saves.Count-or$trace.Count){throw 'FIXTURE_EMPTY_INSPECT'}
Reset-Fixture;$script:all=@();$script:instances=@();$script:taskState=3;$Action='Drain';$x=Invoke-NewDrain;if($x.status-cne'NEW_OWNER_EMPTY_CANDIDATE_READY'-or$x.mutationExecuted-or$stopPids.Count-or$saves.Count-ne1-or$saves[0].processes.Count){throw 'FIXTURE_EMPTY_RESULT'}
Reset-Fixture;$script:all=@();$script:instances=@();$script:taskState=4;$Action='Drain';Reject 'not-ready-task' {Invoke-NewDrain};if($saves.Count){throw 'FIXTURE_EARLY_SAVE'}
'ACTUAL_EMPTY_ONLY_VERIFIED'
`);assert.match(out,/ACTUAL_EMPTY_ONLY_VERIFIED/);assert.match(out,/REJECTED=not-ready-task/);
});
