import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const path=name=>fileURLToPath(new URL(name,import.meta.url));
const adapter=path('./p03-pr54-b264-new-owner-recovery.ps1');
const engine=path('./p03-physical-rollback-lifetime-v2.ps1');
const empty=path('./p03-pr54-new-owner-empty-recovery.ps1');
const paused=path('./p03-pr54-paused-old-recover.ps1');
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const extract=(file,names,aliases={})=>`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(file)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};${names.map(name=>`$defs=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq${quote(name)}},$false));if($defs.Count-ne1){throw 'FIXTURE_FUNCTION'};$text=$defs[0].Extent.Text;${aliases[name]?`$text='function ${aliases[name]}'+$text.Substring(('function '+${quote(name)}).Length);`:''}. ([scriptblock]::Create($text));`).join('')}`;
function run(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$text=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($text))','utf16le').toString('base64')],{input:"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n"+code,encoding:'utf8',timeout:20000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
const functions=extract(engine,['OldReuseHold','OldReusePin','AssertOldPidLifetimes','Need','Hash','Json','XmlHash','Field','Identity','CandidateParentSnapshot','CandidateInventory','CandidateInventoryCore','ConsoleAuxiliaries','AssertEmpty'],{ConsoleAuxiliaries:'B264FrozenConsoleAuxiliaries'})+'\n'+extract(empty,['Stop-NewDrainExact','Assert-NewDrainOldAbsent'])+'\n'+extract(paused,['LatePrecutProbeAllowed','ProbeAuxiliaries'])+'\n'+extract(adapter,['Require-NewDrain','Get-B264RecoverySourcePolicy','Same-B264Value','Get-B264HistoricalPins','Assert-B264StopPlan','Assert-B264RecoveryCandidateTuple','Assert-B264Claim','Assert-B264PartialShape','Capture-NewDrainCandidate','ProbeArgumentsAllowed','B264ProbeAuxiliaries','ConsoleAuxiliaries','HubLineage','Current-NewDrainFrame','Assert-B264Com','Complete-B264CoreCut','Wait-B264AuxiliaryAbsence','Publish-B264Empty','Invoke-B264Recovery']);
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
const extra=String.raw`
function Reset-B264Fixture{
 $script:PolicyGeneration='LegacyB264'
 Reset-Fixture;$script:newCoreHandle=$null;$script:newCore=$null;$script:b264Mutated=$false
 $script:probePins=@{};$script:lateProbePids=@();$script:probePath='C:\fixture\probe.ps1';$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false;$script:lateAdmissionOpen=$false;$script:precutWindowOpenedAt=$null;$script:coreStopCompletedAt=$null;$script:coreLifetime=$null;$script:coreCutRecorded=$false;$script:lastCoreStopperResult=$null
 $script:parentPins=@{};$script:watcherPins=@{};$script:consolePins=@{};$script:tasksStopRequested=$false;$script:newGone=@()
 $script:profile|Add-Member NoteProperty shell ([pscustomobject]@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'})
}
function Add-Hub{
 $script:instances[0]|Add-Member ScriptMethod Stop {$script:trace+=,'COM_STOP';$script:instances=@($script:instances|Where-Object{$_.EnginePID-ne101});$script:all=@($script:all|Where-Object{$_.ProcessId-ne101});$script:taskState=3} -Force
 $watch=[pscustomobject]@{role='hubWatcher';pid=108;parentPid=900;nodePath='C:\fixture\node.exe';ownerSid=$owner;commandLine='fixed-hubWatcher';creationTime=$birth.ToString('o');bindings=@()}
 $hub=[pscustomobject]@{role='hub';pid=109;parentPid=950;nodePath='C:\fixture\node.exe';ownerSid=$owner;commandLine='fixed-hub';creationTime=$birth.AddTicks(100).ToString('o');bindings=@()}
 foreach($row in @($watch,$hub)){
  $script:rows+=,$row;$script:all+=,[pscustomobject]@{ProcessId=$row.pid;ParentProcessId=$row.parentPid;ExecutablePath=$row.nodePath;CommandLine=$row.commandLine;CreationDate=[DateTime]::Parse($row.creationTime);Name='node.exe';OwnerSid=$owner}
  $rule=@($profile.candidateRules|Where-Object{$_.role-ceq$row.role})[0];$rule.nodePath=$row.nodePath;$rule.commandLine=$row.commandLine
  foreach($prop in @{taskName='Melisa-Hub-TEST-Web';config=[pscustomobject]@{path='C:\fixture\config.json';sha256='d'*64};packageRoot='C:\fixture\new';sourceCommit='c'*40}.GetEnumerator()){$rule|Add-Member NoteProperty $prop.Key $prop.Value -Force}
 }
 $com=[pscustomobject]@{Name='Melisa-Hub-TEST-Web';Path='\Melisa-Hub-TEST-Web';InstanceGuid='hub-instance';EnginePID=108;State=4}
 $com|Add-Member ScriptMethod Stop {$script:trace+=,'HUB_COM_STOP';$script:instances=@($script:instances|Where-Object{$_.EnginePID-ne108});$script:all=@($script:all|Where-Object{$_.ProcessId-ne108});$script:taskState=3}
 $script:instances+=,$com
}
function Read-B264HubReceipt($identity){return [pscustomobject]@{role='hub';path='C:\fixture\hub.json';sha256='f'*64;lineagePath='C:\fixture\lineage.json';lineageSha256='a'*64}}
function NewHubLineage($evidence,$expected,$inventory){$r=@($evidence.receipts|Where-Object{$_.role-ceq'hub'});$w=@($evidence.processes|Where-Object{$_.role-ceq'hubWatcher'});if($r.Count-ne1-or$w.Count-ne1-or$expected.parentPid-ne950){throw 'FIXTURE_HUB_LINEAGE'};return $birth.AddTicks(50)}
function Inspect-Subset($roles){$script:all=@($script:all|Where-Object{$_.ProcessId-eq900-or$_.CommandLine-cin@($roles|ForEach-Object{'fixed-'+$_})});$script:instances=@($script:instances|Where-Object{($_.EnginePID-eq101-and'terminalWatcher'-cin$roles)-or($_.EnginePID-eq108-and'hubWatcher'-cin$roles)});if($instances.Count-eq0){$script:taskState=3}}
function Seed-Claim{
 $script:runId='a'*32;$script:ProfilePath='C:\fixture\profile.json';$script:BeforeImagePath='C:\fixture\before.json';$script:ProfileSha256='a'*64;$script:BeforeImageSha256='b'*64
 $script:before=[pscustomobject]@{observedAt='2026-10-20T10:00:00Z'}
 $settings=[pscustomobject]@{path='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json';sha256='c'*64}
 $sql=[pscustomobject]@{kind='ProtectedSqlService';pid=123}
 $oldSettings=[pscustomobject]@{path='C:\fixture\old-settings.json';sha256='a'*64}
 $script:profile=[pscustomobject]@{oldSettings=$oldSettings;newSettings=$settings;protectedProcesses=@($sql)}
 $plan=[pscustomobject]@{targets=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor');oldSettingsSha256=$oldSettings.sha256;newSettingsSha256=$settings.sha256}
 $plan|Add-Member NoteProperty digest (Hash ([Text.UTF8Encoding]::new($false).GetBytes(($plan|ConvertTo-Json -Compress))))
 $script:before|Add-Member NoteProperty plan $plan;$script:before|Add-Member NoteProperty oldConfig $oldSettings;$script:before|Add-Member NoteProperty newConfig $settings
 $stopCommitment=[ordered]@{planDigest=$plan.digest;stopOrder=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')}
 $stopDigest=Hash ([Text.UTF8Encoding]::new($false).GetBytes(($stopCommitment|ConvertTo-Json -Compress)))
 $candidate=[pscustomobject]@{erpSource='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2';erpManifest='8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf';crmSource='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';crmManifest='e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83';supervisorSource='eb5b37a555cbf18e1fcaa491820707c73b354e12';supervisorManifest='1a9d7a0ba6d0ed0fa60e9044122fb895e58e725d84f194ceea255a00aece39b0';supervisorRoot='C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-eb5b37a555cb';newSettings=$settings}
 $values=[ordered]@{schemaVersion='melisa-p03-b264-current-epoch-claim.v1';currentOwnerDigest='d'*64;ownerObservedAt='2026-10-20T10:00:01Z';protectedSqlEpoch=$sql;predecessorRunId='b264594b6f93d560d807c8decc4e6699';successorRunId=$runId;successorProfile=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};successorBefore=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};newSettings=$settings;candidate=$candidate;stopOrderDigest=$stopDigest;transitionAuthority=$true;applyExecuted=$false}
 foreach($entry in (Get-B264HistoricalPins).GetEnumerator()){$values[$entry.Key]=[pscustomobject]$entry.Value}
 $script:claim=[pscustomobject]$values
}
`;

test('adapter parses; immutable AST sources and all Hub closure dependencies are pinned before dispatch',()=>{
 const s=fs.readFileSync(adapter,'utf8');
 assert.match(run(`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile(${quote(adapter)},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};'PARSED'`),/PARSED/);
 for(const hash of ['99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def','a742992d20b5eb44f2092249077cf785a5176525c6d498dd300873b0bfaa7f4a','e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5','1644e2d61653e41851698f1f8e98d873e0346dcf21cea6b243f7c4af66c00920','5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5'])assert.ok(s.includes(hash));
 for(const name of ['NewHubHandleInfo','NewHubOpenShell','NewHubShellIdentity','NewHubLauncherArgsAllowed','NewHubLineage','NewAssertHubLineageEquivalence','ObserverRequire','ObserverNoReparse','ObserverPolicyBinary'])assert.ok(s.includes("'"+name+"'"));
 assert.match(s,/HubLineage='B264FrozenHubLineage'/);assert.doesNotMatch(s,/Set-ScheduledTask|Start-ScheduledTask|Invoke-Sqlcmd|ExecuteNonQuery|Remove-Item|\.Kill\(/);
 assert.match(s,/Unproven orphan\/partial ownership is deliberately refused/);
});

test('exact B264 claim scope, SQL epoch, immutable history and candidate pin drift fail closed',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
Reset-B264Fixture;Seed-Claim;Assert-B264Claim
$claim.schemaVersion='melisa-p03-current-owner-successor-claim.v1';Reject 'legacy-claim' {Assert-B264Claim}
Seed-Claim;$claim.transitionAuthority=$false;Reject 'proposal-not-authority' {Assert-B264Claim}
Seed-Claim;$claim.protectedSqlEpoch=[pscustomobject]@{kind='ProtectedSqlService';pid=124};Reject 'sql-epoch-drift' {Assert-B264Claim}
Seed-Claim;$claim.predecessorBefore.sha256='f'*64;Reject 'history-drift' {Assert-B264Claim}
Seed-Claim;$claim.candidate.supervisorSource='0'*40;Reject 'candidate-drift' {Assert-B264Claim}
Seed-Claim;$claim.stopOrderDigest='e'*64;Reject 'stop-order-digest' {Assert-B264Claim}
Seed-Claim;$before.plan.digest='f'*64;Reject 'plan-digest' {Assert-B264Claim}
Seed-Claim;$before.plan.targets=@($before.plan.targets|Sort-Object);Reject 'plan-order' {Assert-B264Claim}
Seed-Claim;$before.plan.oldSettingsSha256='f'*64;Reject 'plan-settings-binding' {Assert-B264Claim}
Seed-Claim;$claim|Add-Member NoteProperty unexpected $true;Reject 'extra-claim-field' {Assert-B264Claim}
`);for(const v of ['legacy-claim','proposal-not-authority','sql-epoch-drift','history-drift','candidate-drift','stop-order-digest','plan-digest','plan-order','plan-settings-binding','extra-claim-field'])assert.ok(out.includes('REJECTED='+v));
});

test('real V2 raw candidate collector admits provable subsets of every size 1 through 10 and Inspect never writes',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
$subsets=@(@('terminalWatcher'),@('terminalWatcher','coreSupervisor'),@('terminalWatcher','coreSupervisor','erpNative'),@('terminalWatcher','coreSupervisor','erpNative','erpApi'),@('terminalWatcher','coreSupervisor','erpNative','erpApi','crmNativeOrder'),@('terminalWatcher','coreSupervisor','erpNative','erpApi','crmNativeOrder','crmCatalog'),@('terminalWatcher','coreSupervisor','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders'),@('terminalWatcher','coreSupervisor','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer'),@('terminalWatcher','coreSupervisor','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer','hubWatcher'),@('terminalWatcher','coreSupervisor','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer','hubWatcher','hub'))
foreach($subset in $subsets){Reset-B264Fixture;Add-Hub;Inspect-Subset $subset;$Action='Inspect';$result=Invoke-B264Recovery;if($result.newIdentities-ne$subset.Count-or$result.mutationExecuted-or$trace.Count-ne0-or$saves.Count-ne0){throw 'FIXTURE_SUBSET'};'SUBSET='+$subset.Count}
`);for(let n=1;n<=10;n++)assert.match(out,new RegExp('SUBSET='+n+'(?:\\r?\\n|$)'));
});

test('full ten drain has durable held-core cut before COM stops, exact native stops and zero-only publication',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
Reset-B264Fixture;Add-Hub;$Action='Drain';$result=Invoke-B264Recovery
if($result.status-cne'B264_NEW_OWNER_EMPTY_CANDIDATE_READY'-or-not$disposed-or$saves.Count-ne1-or$saves[0].processes.Count-ne0){throw 'FIXTURE_RESULT'}
if(($stopPids-join',')-cne'100,107,106,105,104,103,102,109'){throw 'FIXTURE_STOP_ORDER'}
if([array]::IndexOf($trace,'NEW_CORE_CUT_INTENT:')-ge[array]::IndexOf($trace,'COM_STOP')){throw 'FIXTURE_CUT_ORDER'}
if(-not($trace-contains'NEW_CORE_CUT_COMPLETED:')-or-not$coreCutRecorded){throw 'FIXTURE_CUT_RECEIPT'}
'FULL_TEN_ZERO'
`);assert.match(out,/FULL_TEN_ZERO/);
});

test('COM natural core exit is recorded and never force-stops the absent core',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
Reset-B264Fixture;$instances[0]|Add-Member ScriptMethod Stop {$script:trace+=,'COM_STOP';$script:instances=@();$script:taskState=3;$script:all=@($script:all|Where-Object{$_.ProcessId-notin@(100,101)});$script:coreHandle.HasExited=$true} -Force
$Action='Drain';$result=Invoke-B264Recovery;if(100-in$stopPids-or-not$coreCutRecorded-or-not$disposed){throw 'FIXTURE_NATURAL'}
'NATURAL_NOT_FORCE_KILLED'
`);assert.match(out,/NATURAL_NOT_FORCE_KILLED/);
});

test('raw foreign probe/listener, unproven orphan/core, bad Hub lineage and COM drift reject before mutation',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
Reset-B264Fixture;$Action='Drain';$script:all+=,[pscustomobject]@{ProcessId=500;ParentProcessId=100;ExecutablePath='C:\fixture\wrong.exe';CommandLine='wrong';CreationDate=[DateTime]::UtcNow;Name='powershell.exe';OwnerSid=$owner};Reject 'foreign-probe' {Invoke-B264Recovery};if($trace.Count){throw 'FIXTURE_PROBE_EFFECT'}
Reset-B264Fixture;$script:foreignListener=$true;Reject 'foreign-listener' {Invoke-B264Recovery};if($trace.Count){throw 'FIXTURE_LISTENER_EFFECT'}
Reset-B264Fixture;Inspect-Subset @('erpNative');Reject 'uncaptured-core' {Invoke-B264Recovery};if($trace.Count){throw 'FIXTURE_ORPHAN_EFFECT'}
Reset-B264Fixture;Inspect-Subset @('coreSupervisor');Reject 'missing-watcher' {Invoke-B264Recovery}
Reset-B264Fixture;Add-Hub;function Read-B264HubReceipt($identity){throw 'FIXTURE_HUB_LINEAGE'};Reject 'missing-lineage' {Invoke-B264Recovery};if($trace.Count){throw 'FIXTURE_HUB_EFFECT'}
Reset-B264Fixture;$instances[0].Path='\wrong';Reject 'COM-path' {Invoke-B264Recovery};if($trace.Count){throw 'FIXTURE_COM_EFFECT'}
Reset-B264Fixture;$script:protectedBad=$true;Reject 'protected-drift' {Invoke-B264Recovery};if($trace.Count){throw 'FIXTURE_PROTECTED_EFFECT'}
`);for(const v of ['foreign-probe','foreign-listener','uncaptured-core','missing-watcher','missing-lineage','COM-path','protected-drift'])assert.ok(out.includes('REJECTED='+v));
});

test('probe argv uses candidate-only available PIDs and never invents an absent role PID',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
Reset-B264Fixture;$script:newEvidence=[pscustomobject]@{processes=@($rows|Where-Object{$_.role-ceq'erpNative'})};$probe='C:\fixture\probe.ps1';$prefix=@($profile.shell.path,'-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',$probe,'-Ports')
if(-not(ProbeArgumentsAllowed @($prefix+@('4186','-ProcessId','102')) $probe)){throw 'FIXTURE_VALID_PROBE'}
if(ProbeArgumentsAllowed @($prefix+@('4184','-ProcessId','0')) $probe){throw 'FIXTURE_MISSING_PID'}
if(ProbeArgumentsAllowed @($prefix+@('4186','-ProcessId','999')) $probe){throw 'FIXTURE_FOREIGN_PID'}
if(ProbeArgumentsAllowed @($prefix+@('4186','-ProcessId','102','-evil')) $probe){throw 'FIXTURE_EXTRA_ARG'}
'FINITE_CANDIDATE_PROBES'
`);assert.match(out,/FINITE_CANDIDATE_PROBES/);
});


test('live candidate probe remains in raw inventory, exits naturally and never becomes a stop target',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
function Tokens($text){return @($text.Split(' '))}
Reset-B264Fixture
$probeArgv=@($profile.shell.path,'-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',$script:probePath,'-Ports','4186','-ProcessId','102')
$script:all+=,[pscustomobject]@{ProcessId=500;ParentProcessId=100;ExecutablePath=$profile.shell.path;CommandLine=($probeArgv-join' ');CreationDate=$birth.AddTicks(1000);Name='powershell.exe';OwnerSid=$owner}
$Action='Inspect';$x=Invoke-B264Recovery;if($x.liveProbesAccepted-ne1-or@($all|Where-Object{$_.ProcessId-eq500}).Count-ne1-or$before.identities.PSObject.Properties.Name-ccontains'coreSupervisor'){throw 'FIXTURE_RAW_OR_OLD_BEFORE_CHANGED'}
# A second invocation models a fresh one-shot operator, with the same actual
# candidate rows. The probe's natural exit is observed at the core boundary.
$script:newCoreHandle=$null;$script:parentPins=@{};$script:watcherPins=@{};$script:consolePins=@{};$script:tasksStopRequested=$false;$script:newGone=@();$script:coreCutRecorded=$false;$script:precutWindowOpenedAt=$null;$script:probePins=@{}
$originalStop=(Get-Command Invoke-NewDrainStopper).ScriptBlock
function Invoke-NewDrainStopper($identity){& $originalStop $identity;if($identity.pid-eq100){$script:all=@($script:all|Where-Object{$_.ProcessId-ne500})}}
$Action='Drain';$x=Invoke-B264Recovery
if(500-in$stopPids-or$x.status-cne'B264_NEW_OWNER_EMPTY_CANDIDATE_READY'){throw 'FIXTURE_PROBE_STOP_TARGET'}
'RAW_PROBE_NATURAL_ONLY'
`);assert.match(out,/RAW_PROBE_NATURAL_ONLY/);
});


test('stopper executes only held pinned bytes, retains the hold until child completes and records genuine outcome',()=>{
 const selected=extract(adapter,['Require-NewDrain','Invoke-NewDrainStopper']);
 const out=run(selected+String.raw`
$script:profile=[pscustomobject]@{stopper=[pscustomobject]@{path='C:\fixture\stop.ps1'}};$script:newCore=[pscustomobject]@{pid=100};$script:lastCoreStopperResult=$null
$identity=[pscustomobject]@{pid=100;parentPid=101;nodePath='C:\fixture\node.exe';ownerSid='sid';commandLine='fixed';creationTime='2026-10-20T10:00:00Z'}
$script:changed=$false;$script:calls=0;$script:result='EXACT_OBSERVED_PROCESS_STOPPED'
function ReadPinned($path,$sha){}
function Open-B264StopperHandle($path){$script:held=[IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($(if($script:changed){'changed'}else{'pinned'})));return ,$script:held}
function Hash($bytes){if([Text.Encoding]::UTF8.GetString($bytes)-ceq'pinned'){return '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'};return '0'*64}
function Invoke-B264StopperChild($path,$proof){if(-not$script:held.CanRead){throw 'FIXTURE_HOLD_RELEASED_BEFORE_CHILD'};$script:calls++;$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($proof))|ConvertFrom-Json;if($p.pid-ne100){throw 'FIXTURE_WRONG_UID'};return [pscustomobject]@{exitCode=0;output=$script:result}}
Invoke-NewDrainStopper $identity;if($calls-ne1-or$held.CanRead-or$lastCoreStopperResult-cne'EXACT_OBSERVED_PROCESS_STOPPED'){throw 'FIXTURE_EXACT_RESULT'}
$script:result='ALREADY_GONE';Invoke-NewDrainStopper $identity;if($lastCoreStopperResult-cne'ALREADY_GONE'-or$held.CanRead){throw 'FIXTURE_NATURAL_RESULT'}
$script:changed=$true;try{Invoke-NewDrainStopper $identity;throw 'FIXTURE_EXPECTED_REJECTION'}catch{if($_.Exception.Message-cne'P03_NEW_DRAIN_HELD_STOPPER_HASH'){throw}}
if($calls-ne2-or$held.CanRead){throw 'FIXTURE_CHANGED_BYTES_EXECUTED_OR_HOLD_LEAK'}
'HELD_BYTES_CHILD_COMPLETION_OUTCOME'
`);assert.match(out,/HELD_BYTES_CHILD_COMPLETION_OUTCOME/);
 const source=fs.readFileSync(adapter,'utf8');assert.match(source,/function Open-B264StopperHandle[^\n]+FileShare\]::Read/);
});


test('Sup20D recovery selects only exact new immutable tuple and settings, with no legacy cross-generation acceptance',()=>{
 const out=run(functions+'\n'+fixture+'\n'+extra+String.raw`
function Seed-Sup20DClaim{
 Seed-Claim;$script:PolicyGeneration='B264Sup20D'
 $claim.candidate.supervisorSource='20d7e5b696969d502014ba359b950496dc530410';$claim.candidate.supervisorManifest='0959b1b84faafe2e297e537d470d6b6d443e6fac2fe30d3f2518f5b6036d1418';$claim.candidate.supervisorRoot='C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-20d7e5b69696'
 $claim.newSettings.sha256='f893faf4a1113fab3fdcdfce181e219f1bee480be4b6ab4142a738e47c094c95'
 $before.plan.newSettingsSha256=$claim.newSettings.sha256
 $canonical=[ordered]@{targets=$before.plan.targets;oldSettingsSha256=$before.plan.oldSettingsSha256;newSettingsSha256=$before.plan.newSettingsSha256};$before.plan.digest=Hash ([Text.Encoding]::UTF8.GetBytes(($canonical|ConvertTo-Json -Compress)))
 $commitment=[ordered]@{planDigest=$before.plan.digest;stopOrder=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')};$claim.stopOrderDigest=Hash ([Text.Encoding]::UTF8.GetBytes(($commitment|ConvertTo-Json -Compress)))
}
Reset-B264Fixture;Seed-Sup20DClaim;Assert-B264Claim
$policy=Get-B264RecoverySourcePolicy;if($policy.newObserverSha256-cne'b7ba34e3b13899874f0ea3d5cd168682f81fd946ca7d42db586d8a95ff4efa22'-or$policy.observerSha256-cne'5e1f89bd24ba7b1a2c8738cab3f2f29d4ec44ade96b62127d9f1367efd6143f9'){throw 'FIXTURE_NEW_SOURCE_POLICY'}
$script:PolicyGeneration='LegacyB264';$legacy=Get-B264RecoverySourcePolicy;if($legacy.newObserverSha256-cne'1644e2d61653e41851698f1f8e98d873e0346dcf21cea6b243f7c4af66c00920'){throw 'FIXTURE_LEGACY_SOURCE_POLICY'};Reject 'new-under-legacy-policy' {Assert-B264Claim}
Reset-B264Fixture;Seed-Claim;$script:PolicyGeneration='B264Sup20D';Reject 'legacy-under-new-policy' {Assert-B264Claim}
Seed-Sup20DClaim;$claim.candidate.supervisorManifest='0'*64;Reject 'sup20d-manifest' {Assert-B264Claim}
Seed-Sup20DClaim;$claim.candidate.supervisorRoot+='-other';Reject 'sup20d-root' {Assert-B264Claim}
Seed-Sup20DClaim;$claim.newSettings.sha256='c'*64;Reject 'sup20d-settings' {Assert-B264RecoveryCandidateTuple}
Seed-Sup20DClaim;$script:PolicyGeneration='b264sup20d';Reject 'policy-case' {Assert-B264RecoveryCandidateTuple}
`);for(const label of ['new-under-legacy-policy','legacy-under-new-policy','sup20d-manifest','sup20d-root','sup20d-settings','policy-case'])assert.ok(out.includes('REJECTED='+label));
});


test('latest fresh and exact974d recovery pin the corrected NEW observer without changing legacy closure',()=>{
 const raw=fs.readFileSync(adapter,'utf8'),newBytes=fs.readFileSync(path('./p03-pr54-new-owner-observe.ps1'),'utf8').replaceAll('\r\n','\n');
 const crypto=createHash('sha256').update(newBytes).digest('hex');assert(raw.includes(crypto));assert(raw.includes('777bc48f04fbdd1a48b9cf92aea4deaed4e34a9004139a2b0e9e5eba094445c4'));
 assert.match(raw,/ContinuationPath.*ContinuationSha256/);assert.match(raw,/CURRENT_974D_CONTEXT_REQUIRED/);assert(!raw.slice(raw.indexOf('function Assert974dContinuation'),raw.indexOf('function Assert-B264Claim')).includes('UtcNow'));
});


test('Rehearsal NEW Inspect stays read-only for full Hub 10/2 and partial 3/1; the same Drain publishes only a verified empty candidate',()=>{
 const out=run(`${functions}\n${fixture}\n${extra}\n${extract(engine,['RehearsalRolePorts','RehearsalBindings'])}\n${String.raw`
function Reset-RehearsalFixture{
 Reset-B264Fixture;Add-Hub;$script:PolicyGeneration='CurrentB142Rehearsal';$script:isRehearsal=$true;$script:Action='Inspect';$script:names=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')
 foreach($r in $script:rows){
  if($r.role-ceq'hub'){$r.parentPid=108;@($script:all|Where-Object{$_.ProcessId-eq$r.pid})[0].ParentProcessId=108;$path='C:\fixture\hub-fixture.json';$template=@($profile.candidateRules|Where-Object{$_.role-ceq'erpNative'})[0].receipt|ConvertTo-Json -Depth 8|ConvertFrom-Json;$template.path=$path;@($profile.candidateRules|Where-Object{$_.role-ceq'hub'})[0].receipt=$template;$script:receipts[$path]=[ordered]@{run='11111111-2222-3333-4444-555555555555';pid=$r.pid;parentPid=108;parentCreationTime=$birth.ToString('o');creationTime=$r.creationTime;stage='hub';sourceCommit='c'*40;configSha256='d'*64;copyId='copy';actualT1=$false}}
  $r.bindings=@(RehearsalRolePorts $r.role|ForEach-Object{[pscustomobject]@{port=$_;address='127.0.0.1'}})
 }
 foreach($i in 0,1){$script:instances[$i].Name=$script:names[$i];$script:instances[$i].Path='\'+$script:names[$i];@($profile.candidateRules|Where-Object{$_.role-ceq@('terminalWatcher','hubWatcher')[$i]})[0].taskName=$script:names[$i]}
}
function Inventory{$listeners=@(foreach($r in $script:rows){if(@($script:all|Where-Object{$_.ProcessId-eq$r.pid}).Count){foreach($b in $r.bindings){[pscustomobject]@{LocalPort=$b.port;LocalAddress=$b.address;OwningProcess=$r.pid}}}});return [pscustomobject]@{all=$script:all;allListeners=$listeners;listeners=$listeners;instances=$script:instances}}
foreach($kind in @('full','partial')){Reset-RehearsalFixture;$isRehearsal=$true;$names=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub');if($kind-ceq'partial'){Inspect-Subset @('coreSupervisor','terminalWatcher','erpNative')};$result=Invoke-B264Recovery;if($script:trace.Count-ne0){throw 'FIXTURE_INSPECT_WRITE'};'RESULT='+($result|ConvertTo-Json -Compress)}
Reset-RehearsalFixture;$script:receipts['C:\fixture\hub-fixture.json'].copyId='foreign';Reject 'hub-receipt-copy' {Invoke-B264Recovery}
Reset-RehearsalFixture;$isRehearsal=$true;$names=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub');$Action='Drain';$result=Invoke-B264Recovery;'REHEARSAL_DRAIN='+$result.status+';EMPTY='+$script:saves[-1].processes.Count
`}`);
 const results=out.split(/\r?\n/).filter(x=>x.startsWith('RESULT=')).map(x=>JSON.parse(x.slice(7)));assert.equal(results.length,2);
 assert.equal(results[0].newIdentities,10);assert.equal(results[0].runningInstances,2);assert(results[0].newRoles.includes('hub'));
 assert.equal(results[1].newIdentities,3);assert.equal(results[1].runningInstances,1);assert.deepEqual([...results[1].newRoles].sort(),['coreSupervisor','erpNative','terminalWatcher']);
 for(const r of results){assert.equal(r.environment,'P03_REHEARSAL');assert.equal(r.mutationExecuted,false);assert.equal(r.engineRecoveryExecuted,false)}assert.match(out,/REJECTED=hub-receipt-copy/);assert.match(out,/REHEARSAL_DRAIN=B264_NEW_OWNER_EMPTY_CANDIDATE_READY;EMPTY=0/);
});
