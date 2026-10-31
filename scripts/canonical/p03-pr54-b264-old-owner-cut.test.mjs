import test from 'node:test';
import {pr54B264StartedOwnerDigest} from './p03-pr54-owner-successor.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-b264-old-owner-cut.ps1',import.meta.url));
const drainer=fileURLToPath(new URL('./p03-pr54-successor-core-drain.ps1',import.meta.url));
const recovery=fileURLToPath(new URL('./p03-pr54-paused-old-recover.ps1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};
const q=s=>"'"+s.replaceAll("'","''")+"'";
function extract(names,file=source,alias={}){return `
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'FIXTURE_SOURCE_PARSE'}
${names.map(name=>`$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq ${q(name)}},$true));if($defs.Count -ne 1){throw 'FIXTURE_FUNCTION_MISSING'};$text=$defs[0].Extent.Text${alias[name]?`.Replace('function ${name}','function ${alias[name]}')`:''};. ([scriptblock]::Create($text))`).join('\n')}`;}
function run(code){
 try{return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$source=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($source))','utf16le').toString('base64')],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}`,encoding:'utf8',timeout:15000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
 catch(error){throw Error(String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z0-9_]+/u)?.[0]??String(error.stderr??'FIXTURE_FAILED').slice(0,1400));}
}
const fixture=String.raw`
function Need($value,$code){if(-not$value){throw ('P03_PHYSICAL_'+$code)}}
function Authority{}
function PrepareProbeSource{$script:probePath='C:\fixture\probe.ps1'}
function ProtectedProcesses($inv){}
function Health($selected){}
function NoReparse($path){}
function XmlHash($xml){return $xml}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:binaryHash}}
function Get-AuthenticodeSignature{param($LiteralPath);[pscustomobject]@{Status=$script:signature;SignerCertificate=[pscustomobject]@{Subject='CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'}}}
function Identity($actual,$expected){return $null-ne$actual-and$actual.ProcessId-eq$expected.pid-and$actual.ParentProcessId-eq$expected.parentPid-and$actual.ExecutablePath-ceq$expected.nodePath-and$actual.CommandLine-ceq$expected.commandLine-and$actual.OwnerSid-ceq$expected.ownerSid-and$actual.CreationDate.Ticks-eq[DateTime]::Parse($expected.creationTime).ToUniversalTime().Ticks}
function Inventory{return $script:inv}
function ProbeAuxiliaries($inv){return @()}
function LegacyConsoleAuxiliaries($inv){return @()}
function IsWatcherCommand($command){return $command -match 'watcher'}
function ProcessFor($p){[pscustomobject]@{ProcessId=$p.pid;ParentProcessId=$p.parentPid;Name=if($p.nodePath.EndsWith('conhost.exe')){'conhost.exe'}else{'node.exe'};ExecutablePath=$p.nodePath;CommandLine=$p.commandLine;CreationDate=[DateTime]::Parse($p.creationTime).ToUniversalTime();OwnerSid=$p.ownerSid}}
function ResetFixture{
 $script:PolicyGeneration='Legacy'
 $script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001';$script:order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
 $script:ProfileSha256='profile';$script:BeforeImageSha256='before';$script:engineSha='engine';$script:RecoveryHelperSha256='helper';$script:ClaimSha256='claim';$script:StopIntentSha256='intent';$script:AdmittedSnapshotSha256='snapshot';$script:AdmittedSnapshotPath='private-fixture';$script:dir='C:\fixture'
 $script:binaryHash='c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac';$script:signature='Valid';$script:names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')
 $script:before=[pscustomobject]@{identities=[pscustomobject]@{}}
 foreach($n in 0..7){$p=[pscustomobject]@{pid=100+$n;parentPid=if($n-eq0){10}else{100};nodePath='C:\fixture\node.exe';commandLine=('old-'+$order[$n]);ownerSid=$owner;creationTime='2026-10-18T10:00:00.0000000Z';bindings=@()};$before.identities|Add-Member NoteProperty $order[$n] $p}
 $watchers=@(10,11|ForEach-Object{[pscustomobject]@{pid=$_;parentPid=1;nodePath='C:\fixture\powershell.exe';commandLine=('watcher-'+$_);ownerSid=$owner;creationTime='2026-10-18T09:00:00.0000000Z'}})
 $script:profile=[pscustomobject]@{tasks=@($names|ForEach-Object{[pscustomobject]@{name=$_;oldXmlSha256='old'}});oldWatchers=$watchers;packages=@([pscustomobject]@{root='C:\fixture'});shell=[pscustomobject]@{path='C:\fixture\powershell.exe'}}
 $script:inv=[pscustomobject]@{all=@($order|ForEach-Object{ProcessFor $before.identities.$_})+@($watchers|ForEach-Object{ProcessFor $_});listeners=@();allListeners=@();instances=@(0..1|ForEach-Object{[pscustomobject]@{Name=$names[$_];Path=('\'+$names[$_]);State=4;EnginePID=10+$_}})}
 $script:child=[pscustomobject]@{pid=60;parentPid=10;nodePath='C:\Windows\System32\conhost.exe';commandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';ownerSid=$owner;creationTime='2026-10-18T09:00:01.0000000Z'};$inv.all+=,(ProcessFor $child)
 $script:taskState=4;$script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($name);[pscustomobject]@{State=$script:taskState;Xml='old'}}
 $script:consolePins=@{};$script:probePins=@{};$script:legacyConsolePins=@{};$script:drainedPids=@();$script:tasksStopRequested=$false;$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false;$script:lateAdmissionOpen=$false;$script:lateProbePids=@();$script:coreLifetime=$null;$script:cutWitnessCommitted=$false;$script:disposed=$false;$script:writes=@();$script:writeFail=$false;$script:stops=0;$script:precutWindowOpenedAt=$null;$script:coreStopCompletedAt=$null
}
function ExpectRejected($name,[scriptblock]$action){try{& $action|Out-Null}catch{Write-Output ('REJECTED='+$name);return};throw ('FIXTURE_ACCEPTED_'+$name)}
ResetFixture
`;

const capture=()=>extract(['ConsoleAuxiliaries'],engine)+'\n'+extract(['AssertWorkerBindings','CaptureWorkerAdmissionCore','CaptureWorkerAdmission','WorkerSamePin','SeedWorkerAdmission'],drainer);
const drain=()=>extract(['Json'],engine)+'\n'+extract(['PausedTasks','PausedRemaining','PausedRemainingCore','WaitCoreProbeAbsence'],recovery,{PausedRemainingCore:'RecoveredRemainingCore'})+'\n'+extract(['PausedRemainingCore','DrainB264OldOwner']);
const setup=String.raw`
function AssertB264CutCurrentOwner{}
function ReadWorkerPin($path,$sha){return ,[Text.Encoding]::UTF8.GetBytes(($script:snapshot|ConvertTo-Json -Depth 14 -Compress))}
function Test-Path{param($LiteralPath);return $false}
function HoldWorkerCore($core){$script:trace+=,'HOLD';$held=[pscustomobject]@{Id=$core.pid;Handle=[IntPtr]17;HasExited=$false;StartTime=[DateTime]::Parse($core.creationTime).ToUniversalTime()};$held|Add-Member ScriptMethod Dispose {$script:disposed=$true};return $held}
function StopWorkerCore($core){$script:trace+=,'EXACT_STOP';$script:stops++;$script:coreLifetime.HasExited=$true;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId-ne100})}
function StopB264OldCom{
 $script:trace+=,'COM';$script:comStops++;$script:inv.instances=@();$script:taskState=3;$script:tasksStopRequested=$true;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId-notin@(10,11)})
 if($script:natural){$script:coreLifetime.HasExited=$true;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId-ne100})}
}
function WriteB264CutEvidence($leaf,$value){$script:trace+=,('WRITE:'+ $leaf);if($script:failLeaf-ceq$leaf){throw 'FIXTURE_WRITE_FAILED'};$script:writes+=,$leaf;return [ordered]@{path=('C:\fixture\'+$leaf);sha256=('a'*64)}}
function Start-Sleep{param($Milliseconds);throw 'FIXTURE_UNEXPECTED_WAIT'}
function Setup{
 ResetFixture;$script:snapshot=CaptureWorkerAdmission;$script:consolePins=@{};$script:probePins=@{};$script:RootIntentSha256='root';$script:trace=@();$script:comStops=0;$script:natural=$false;$script:failLeaf='';$script:b264CutComPins=@()
}
`;
test('source parses in Windows PS5 and keeps inspect default, frozen AST imports and no blanket process stop',windows,()=>{
 const out=run(`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};'PARSED'`);assert.match(out,/PARSED/);
 const s=readFileSync(source,'utf8');assert.match(s,/Mode='Inspect'/);assert.match(s,/FileMode\]::CreateNew/);assert.match(s,/\.Flush\(\$true\)/);assert.doesNotMatch(s,/Stop-Process|taskkill|\.Kill\(|Remove-Item|RegisterTask|& \$EnginePath|& \$RecoveryHelperPath/i);
 for(const pin of ['99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def','e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5','34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c'])assert.ok(s.includes(pin));
});
test('held process and durable intent precede COM; natural exit is recorded without inventing an exact stop',windows,()=>{
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\nSetup;$script:natural=$true;$r=DrainB264OldOwner;'STATUS='+$r.status;'MECHANISM='+$r.coreStopResult;'STOPS='+$stops;'COM='+$comStops;'TRACE='+($trace-join'|');'GONE='+($r.goneOldPids-join',');'DISPOSED='+$disposed`);
 assert.match(out,/STATUS=B264_OLD_OWNER_CORE_DRAINED/);assert.match(out,/MECHANISM=COM_STOP_NATURAL_EXIT/);assert.match(out,/STOPS=0/);assert.match(out,/COM=1/);assert.match(out,/TRACE=HOLD\|WRITE:b264-old-owner-held-cut-intent.json\|COM\|WRITE:successor-core-cut-completed.json/);assert.match(out,/GONE=100/);assert.match(out,/DISPOSED=True/);
});
test('live core after COM uses exact stopper once, leaves remaining seven roles, never kills console/probe',windows,()=>{
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\nSetup;$r=DrainB264OldOwner;'MECHANISM='+$r.coreStopResult;'STOPS='+$stops;'LEFT='+$r.remainingOldRoles;'TRACE='+($trace-join'|');'LATE='+$lateAdmissionOpen`);
 assert.match(out,/MECHANISM=EXACT_OBSERVED_PROCESS_STOPPED/);assert.match(out,/STOPS=1/);assert.match(out,/LEFT=7/);assert.match(out,/COM\|EXACT_STOP\|WRITE:successor-core-cut-completed.json/);assert.match(out,/LATE=False/);
});
test('failed durable intent or changed raw admission causes zero COM/core mutations',windows,()=>{
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\nSetup;$script:failLeaf='b264-old-owner-held-cut-intent.json';ExpectRejected 'durable' {DrainB264OldOwner};'DURABLE_COM='+$comStops;'DURABLE_STOP='+$stops;'DISPOSED='+$disposed;Setup;$inv.all[1].CommandLine='foreign';ExpectRejected 'raw-changed' {DrainB264OldOwner};'RAW_COM='+$comStops;'RAW_STOP='+$stops`);
 for(const x of ['DURABLE_COM=0','DURABLE_STOP=0','RAW_COM=0','RAW_STOP=0','DISPOSED=True'])assert.ok(out.includes(x));
});
test('failed cut witness closes late probe admission and preserves evidence after physical COM/core result',windows,()=>{
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\nSetup;$script:failLeaf='successor-core-cut-completed.json';ExpectRejected 'cut-write' {DrainB264OldOwner};'COM='+$comStops;'STOPS='+$stops;'LATE='+$lateAdmissionOpen;'DISPOSED='+$disposed;'WRITES='+($writes-join',')`);
 assert.match(out,/COM=1/);assert.match(out,/STOPS=1/);assert.match(out,/LATE=False/);assert.match(out,/DISPOSED=True/);assert.match(out,/WRITES=b264-old-owner-held-cut-intent.json/);
});
test('same PID reappearance and unknown descendants fail closed after cut without killing them',windows,()=>{
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\nSetup;$null=DrainB264OldOwner;$inv.all+=,(ProcessFor $before.identities.coreSupervisor);ExpectRejected 'reused' {PausedRemainingCore};Setup;$null=DrainB264OldOwner;$inv.all+=,[pscustomobject]@{ProcessId=999;ParentProcessId=100;Name='foreign.exe';CommandLine='foreign'};ExpectRejected 'foreign' {PausedRemainingCore}`);
 assert.match(out,/REJECTED=reused/);assert.match(out,/REJECTED=foreign/);
});
test('actual COM CAS authenticates each watcher and XML before stopping, preserving native protected checks',windows,()=>{
 const comSetup=String.raw`
function BuildCom{
 ResetFixture;$script:taskState=4;$script:comCalls=0;$script:protectedCalls=0
 function ProtectedProcesses($inv){$script:protectedCalls++}
 $script:b264CutComPins=@();foreach($r in $inv.instances){$r|Add-Member NoteProperty InstanceGuid ('g'+$r.EnginePID);$script:b264CutComPins+=,[pscustomobject]@{name=$r.Name;pid=$r.EnginePID;guid=$r.InstanceGuid};$r|Add-Member ScriptMethod Stop {$script:comCalls++;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId-ne$this.EnginePID});$script:inv.instances=@($script:inv.instances|Where-Object{$_.Name-cne$this.Name});if($script:inv.instances.Count-eq0){$script:taskState=3}}}
}
`;
 const out=run(`${fixture}\n${extract(['StopB264OldCom'])}\n${comSetup}\nBuildCom;StopB264OldCom;'STOPS='+$comCalls;'PROTECTED='+$protectedCalls;'ABSENT='+$inv.instances.Count;BuildCom;$inv.all[8].CommandLine='foreign';ExpectRejected 'watcher-reuse' {StopB264OldCom};'REJECT_STOPS='+$comCalls;BuildCom;$script:taskState=3;ExpectRejected 'xml-state' {StopB264OldCom};'XML_STOPS='+$comCalls;BuildCom;$inv.instances[0].InstanceGuid='changed';ExpectRejected 'guid-restart' {StopB264OldCom};'GUID_STOPS='+$comCalls`);
 assert.match(out,/STOPS=2/);assert.match(out,/ABSENT=0/);assert.match(out,/REJECT_STOPS=0/);assert.match(out,/XML_STOPS=0/);assert.match(out,/GUID_STOPS=0/);assert.match(out,/REJECTED=guid-restart/);assert.match(out,/REJECTED=watcher-reuse/);assert.match(out,/REJECTED=xml-state/);
});

const authorityFixture=String.raw`
$script:cutWitnessCommitted=$false
ResetFixture
$script:base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:runId='a'*32;$script:dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
$script:ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json');$script:BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json');$script:ProfileSha256='a'*64;$script:BeforeImageSha256='b'*64
$script:EnginePath=Join-Path $base 'p03-physical-rollback.ps1';$script:RecoveryHelperPath=Join-Path $base 'p03-pr54-paused-old-recover.ps1';$script:DrainerPath=Join-Path $base 'p03-pr54-successor-core-drain.ps1';$script:EngineSha256='c'*64;$script:RecoveryHelperSha256='d'*64;$script:DrainerSha256='e'*64
$script:ClaimPath=Join-Path $base 'p03-pr54-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json';$script:ClaimSha256='f'*64;$script:RootIntentPath=Join-Path $dir 'b264-old-owner-cut-intent.json';$script:RootIntentSha256='1'*64;$script:AdmittedSnapshotPath=Join-Path $dir 'successor-precut-admission.json';$script:AdmittedSnapshotSha256='2'*64
$script:Mode='Drain';$script:reads=@();$script:contractChecks=0
$profile|Add-Member NoteProperty oldSettings ([pscustomobject]@{path='old';sha256=('6'*64)})
$profile|Add-Member NoteProperty newSettings ([pscustomobject]@{path='new';sha256=('3'*64)})
$profile|Add-Member NoteProperty protectedProcesses @([pscustomobject]@{kind='ProtectedSqlService';pid=5360},[pscustomobject]@{pid=5361},[pscustomobject]@{pid=5362},[pscustomobject]@{pid=5363})
$before|Add-Member NoteProperty observedAt ([DateTime]::UtcNow.ToString('o'));$before|Add-Member NoteProperty oldConfig $profile.oldSettings;$before|Add-Member NoteProperty newConfig $profile.newSettings
$plan=[ordered]@{targets=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor');oldSettingsSha256=$profile.oldSettings.sha256;newSettingsSha256=$profile.newSettings.sha256};$digest=Hash ([Text.Encoding]::UTF8.GetBytes(($plan|ConvertTo-Json -Compress)));$plan.digest=$digest;$before|Add-Member NoteProperty plan ([pscustomobject]$plan)
$script:newSettings=[pscustomobject]@{components=[pscustomobject]@{erpApiNative=[pscustomobject]@{sourceCommit='erp';manifestSha256='erpManifest'};crm=[pscustomobject]@{sourceCommit='crm';manifestSha256='crmManifest'}};supervisor=[pscustomobject]@{sourceCommit='sup';manifestSha256='supManifest';packageRoot='supRoot'}};$script:oldSettings=$newSettings
$history=B264CutHistoryPins
$script:claim=[pscustomobject][ordered]@{schemaVersion='melisa-p03-b264-current-epoch-claim.v1';currentOwnerDigest=('5'*64);ownerObservedAt=$before.observedAt;protectedSqlEpoch=$profile.protectedProcesses[0];predecessorRunId='b264594b6f93d560d807c8decc4e6699';predecessorProfile=[pscustomobject]$history.predecessorProfile;predecessorBefore=[pscustomobject]$history.predecessorBefore;predecessorLock=[pscustomobject]$history.predecessorLock;consumedAncestorClaim=[pscustomobject]$history.consumedAncestorClaim;failedOuterTail=[pscustomobject]$history.failedOuterTail;quarantinedRecoveryTail=[pscustomobject]$history.quarantinedRecoveryTail;readOnlyOldReady=[pscustomobject]$history.readOnlyOldReady;successorRunId=$runId;successorProfile=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};successorBefore=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};newSettings=$profile.newSettings;candidate=[pscustomobject][ordered]@{erpSource='erp';erpManifest='erpManifest';crmSource='crm';crmManifest='crmManifest';supervisorSource='sup';supervisorManifest='supManifest';supervisorRoot='supRoot';newSettings=$profile.newSettings};stopOrderDigest=(Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{planDigest=$before.plan.digest;stopOrder=$order}|ConvertTo-Json -Compress))));transitionAuthority=$true;applyExecuted=$false}
$script:intent=[pscustomobject]@{event='B264_OLD_CUT_INTENT';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;claimSha256=$ClaimSha256;stopOrderDigest=$claim.stopOrderDigest;observedAt=[DateTime]::UtcNow.ToString('o')}
function AssertB264InspectionContract{$script:contractChecks++}
function ReadWorkerPin($path,$sha){$script:reads+=,$path;$value=if($path-ceq$ClaimPath){$script:claim}elseif($path-ceq$RootIntentPath){$script:intent}else{[pscustomobject]@{}};return ,[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 25 -Compress))}
`;
test('Drain validates exact B264 epoch claim, historical refs and truthful fresh root intent; proposal cannot authorize stop',windows,()=>{
 const definitions=extract(['Hash','Json'],engine)+'\n'+extract(['B264Same','B264CutHistoryPins','AssertB264CutStopPlan','B264CutAdmissionTime','B264CutAuthority']);
 const edits=[['plan-targets',"$before.plan.targets=@($before.plan.targets[1..7])"],['plan-digest',"$before.plan.digest='0'*64"],['plan-extra',"$before.plan|Add-Member NoteProperty bypass $true"],['plan-settings',"$before.plan.oldSettingsSha256=$before.plan.newSettingsSha256"],['proposal',"$claim.schemaVersion='melisa-p03-b264-current-epoch-proposal.v1'"],['authority',"$claim.transitionAuthority=$false"],['extra-field',"$claim|Add-Member NoteProperty bypass $true"],['epoch',"$claim.protectedSqlEpoch=[pscustomobject]@{kind='ProtectedSqlService';pid=1}"],['owner-before',"$claim.ownerObservedAt=[DateTime]::Parse($before.observedAt).AddSeconds(-1).ToString('o')"],['owner-future',"$claim.ownerObservedAt=[DateTime]::UtcNow.AddSeconds(2).ToString('o')"],['owner-stale',"$before.observedAt=[DateTime]::UtcNow.AddSeconds(-62).ToString('o');$claim.ownerObservedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')"],['candidate',"$claim.candidate.crmSource='other'"],['history',"$claim.predecessorBefore.sha256='0'*64"],['intent',"$intent.event='EXACT_STOP_INTENT'"],['stale-root',"$intent.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')"],['future-root',"$intent.observedAt=[DateTime]::UtcNow.AddSeconds(2).ToString('o')"],['root-extra',"$intent|Add-Member NoteProperty fake $true"]];
 const out=run(`${fixture}\n${definitions}\n${authorityFixture}\nB264CutAuthority;'VALID=PASS';$before.observedAt=[DateTime]::UtcNow.AddSeconds(-2).ToString('o');$claim.ownerObservedAt=[DateTime]::Parse($before.observedAt).AddSeconds(1).ToString('o');B264CutAuthority;'BEFORE_PLUS_ONE=PASS';${edits.map(([name,edit])=>`${authorityFixture}\n${edit};ExpectRejected '${name}' {B264CutAuthority}`).join('\n')}`);
 assert.match(out,/VALID=PASS/);assert.match(out,/BEFORE_PLUS_ONE=PASS/);for(const [name]of edits)assert.ok(out.includes('REJECTED='+name));
});
test('Inspect authority never reads a claim or root mutation intent',windows,()=>{
 const out=run(`${fixture}\n${extract(['Hash','Json'],engine)}\n${extract(['B264Same','B264CutHistoryPins','AssertB264CutStopPlan','B264CutAdmissionTime','B264CutAuthority'])}\n${authorityFixture}\n$script:Mode='Inspect';B264CutAuthority;'CLAIMS='+@($reads|Where-Object{$_-ceq$ClaimPath}).Count;'INTENTS='+@($reads|Where-Object{$_-ceq$RootIntentPath}).Count;'CONTRACT='+$contractChecks`);
 assert.match(out,/CLAIMS=0/);assert.match(out,/INTENTS=0/);assert.match(out,/CONTRACT=1/);
});

test('Current committed cut uses its authenticated original admission clock across the before-image boundary without admitting an expired live owner',windows,()=>{
 const definitions=extract(['Hash','Json'],engine)+'\n'+extract(['B264Same','B264CutHistoryPins','AssertB264CutStopPlan','B264CutAdmissionTime','B264CutAuthority']);
 const out=run(`${fixture}\n${definitions}\n${authorityFixture}\n`+String.raw`
$script:PolicyGeneration='CurrentB007InspectOnly';$script:EnginePath=Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1'
$claim.schemaVersion='melisa-p03-current-b007-epoch-claim.v1';$script:ClaimPath=Join-Path $base ('p03-pr54-current-b007-generation-'+$claim.currentOwnerDigest+'.lock.json')
$script:precutWindowOpenedAt=[DateTime]::UtcNow.AddSeconds(-120);$script:coreStopCompletedAt=$precutWindowOpenedAt.AddSeconds(54)
$before.observedAt=$precutWindowOpenedAt.AddSeconds(-899).ToString('o');$claim.ownerObservedAt=$precutWindowOpenedAt.ToString('o');$intent.observedAt=$precutWindowOpenedAt.ToString('o')
$script:coreLifetime=[pscustomobject]@{HasExited=$true};$script:coreQuiesced=$true
function AssertCurrentB007InspectionContract($p,$b,$o,$n,$pp,$bp,$sha,$at){$age=($at-[DateTime]::Parse($b.observedAt).ToUniversalTime()).TotalSeconds;Need ($age-ge0-and$age-lt900) 'FIXTURE_BEFORE_EXPIRED'}
ExpectRejected 'expired-live' {B264CutAuthority}
$script:cutWitnessCommitted=$true;B264CutAuthority;'COMMITTED=PASS'
$script:coreLifetime.HasExited=$false;ExpectRejected 'live-core' {B264CutAuthority}
$script:coreLifetime.HasExited=$true;$script:coreStopCompletedAt=$precutWindowOpenedAt.AddSeconds(60);ExpectRejected 'cut-too-late' {B264CutAuthority}
`);
 assert.match(out,/REJECTED=expired-live/);assert.match(out,/COMMITTED=PASS/);assert.match(out,/REJECTED=live-core/);assert.match(out,/REJECTED=cut-too-late/);
});

test('COM-time bounded late probe drains naturally; wrong birth, argv or listener is rejected without a probe stop',windows,()=>{
 const probe=extract(['Tokens'],engine)+'\n'+extract(['ProbeArgumentsAllowed','LatePrecutProbeAllowed','ProbeAuxiliaries'],recovery);
 const helpers=String.raw`
$originalCom=(Get-Command StopB264OldCom).Definition
. ([scriptblock]::Create('function OriginalCom{'+$originalCom+'}'))
function StopB264OldCom{
 OriginalCom
 $script:probe=[pscustomobject]@{ProcessId=500;ParentProcessId=100;Name='powershell.exe';ExecutablePath=$profile.shell.path;CommandLine=($profile.shell.path+' -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File C:\fixture\probe.ps1 -Ports 5234');CreationDate=[DateTime]::UtcNow;OwnerSid=$owner}
 if($script:probeCase-ceq'birth'){$probe.CreationDate=$probe.CreationDate.AddSeconds(1)}
 if($script:probeCase-ceq'argv'){$probe.CommandLine+=' -Write'}
 if($script:probeCase-ceq'listener'){$script:inv.allListeners=@([pscustomobject]@{OwningProcess=500;LocalPort=65000})}
 $script:inv.all+=,$probe
}
function Start-Sleep{param($Milliseconds);Need ($Milliseconds-eq250) 'FIXTURE_DELAY';$script:sleeps++;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId-ne500})}
`;
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\n${probe}\n${helpers}\nSetup;$script:natural=$true;$script:probeCase='good';$script:sleeps=0;$r=DrainB264OldOwner;'STATUS='+$r.status;'LATE='+$lateProbePids.Count;'SLEEPS='+$sleeps;'EXACT_STOPS='+$stops;${['birth','argv','listener'].map(name=>`Setup;$script:natural=$true;$script:probeCase='${name}';ExpectRejected '${name}' {DrainB264OldOwner};'${name}_LATE_CLOSED='+(-not $lateAdmissionOpen);'${name}_PROBE_STOPS='+$stops`).join('\n')}`);
 assert.match(out,/STATUS=B264_OLD_OWNER_CORE_DRAINED/);assert.match(out,/LATE=1/);assert.match(out,/SLEEPS=1/);assert.match(out,/EXACT_STOPS=0/);
 for(const name of ['birth','argv','listener']){assert.ok(out.includes('REJECTED='+name));assert.ok(out.includes(name+'_LATE_CLOSED=True'));assert.ok(out.includes(name+'_PROBE_STOPS=0'));}
});

test('fresh native COM GUID and all eight full lifetimes must equal the admitted current-owner digest',windows,()=>{
 const owner='S-1-5-21-2170750028-1005938530-2568122015-1001',roles=['coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative'];
 const identities=Object.fromEntries(roles.map((r,i)=>[r,{pid:100+i,parentPid:i?100:10,nodePath:String.raw`C:\fixture\node.exe`,commandLine:'old-'+r,ownerSid:owner,creationTime:'2026-10-18T10:00:00.0000000Z',bindings:[]}]))
 const expected=pr54B264StartedOwnerDigest({identities},{processes:Object.values(identities),runningInstances:[{name:'Melisa-Terminal-Completion-Logon',enginePid:10,instanceGuid:'g1'},{name:'Melisa-Hub-TEST-Web',enginePid:11,instanceGuid:'g2'}]});
 const out=run(`${fixture}\n${extract(['Json','Hash'],engine)}\n${extract(['AssertB264CutCurrentOwner'])}\n$script:ClaimPath='fixture';$script:ClaimSha256='hash';$script:claim=[pscustomobject]@{currentOwnerDigest='${expected}'};function ReadWorkerPin($path,$sha){return ,[Text.Encoding]::UTF8.GetBytes(($script:claim|ConvertTo-Json -Compress))};$inv.instances[0]|Add-Member NoteProperty InstanceGuid 'g1';$inv.instances[1]|Add-Member NoteProperty InstanceGuid 'g2';AssertB264CutCurrentOwner;'CURRENT=PASS';$inv.instances[0].InstanceGuid='changed';ExpectRejected 'com-restarted' {AssertB264CutCurrentOwner};$inv.instances[0].InstanceGuid='g1';$inv.all[0].CreationDate=$inv.all[0].CreationDate.AddTicks(1);ExpectRejected 'core-birth' {AssertB264CutCurrentOwner}`);
 assert.match(out,/CURRENT=PASS/);assert.match(out,/REJECTED=com-restarted/);assert.match(out,/REJECTED=core-birth/);
});

test('COM instance GUID drift inside durable intent callback is rejected before any physical stop',windows,()=>{
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\n${extract(['StopB264OldCom'])}\n${String.raw`
Setup
$script:b264CutComPins=@()
foreach($r in $inv.instances){$r|Add-Member NoteProperty InstanceGuid ('g'+$r.EnginePID);$script:b264CutComPins+=,[pscustomobject]@{name=$r.Name;pid=$r.EnginePID;guid=$r.InstanceGuid};$r|Add-Member ScriptMethod Stop {$script:comStops++}}
function WriteB264CutEvidence($leaf,$value){$script:writes+=,$leaf;if($leaf-ceq'b264-old-owner-held-cut-intent.json'){$script:inv.instances[0].InstanceGuid='new-instance'};return [ordered]@{path=('C:\fixture\'+$leaf);sha256=('a'*64)}}
ExpectRejected 'durable-guid-drift' {DrainB264OldOwner}
'COM='+$comStops;'CORE='+$stops;'WRITES='+($writes-join',');'DISPOSED='+$disposed
`}`);
 assert.match(out,/REJECTED=durable-guid-drift/);assert.match(out,/COM=0/);assert.match(out,/CORE=0/);assert.match(out,/WRITES=b264-old-owner-held-cut-intent.json/);assert.match(out,/DISPOSED=True/);
});

test('SUP20D OLD cut selects its exact drainer and distinct contract while keeping legacy claim/probe/CAS logic',windows,()=>{
 const whole=readFileSync(source,'utf8'),gate=whole.slice(0,whole.indexOf('Set-StrictMode')).replace(/^param\([\s\S]*?\n\)\n/,'').replaceAll('$PSBoundParameters','$script:bound');
 const out=run(`$PolicyGeneration='B264Sup20DInspectOnly';$Mode='Drain';$EngineSha256='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def';$RecoveryHelperSha256='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5';$DrainerSha256='eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5';$script:bound=@{}\n& {${gate}};'VALID'\n$DrainerSha256='34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c';try{& {${gate}};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}`);
 assert.match(out,/VALID/);assert.match(out,/REJECTED/);assert.ok(whole.includes("'AssertB264Sup20DInspectionContract'"));
});


const continuation974dFixture=String.raw`
function Need($ok,$reason){if(-not$ok){throw ('P03_'+$reason)}}
function Protected($p){if($p-cne$oldProfile.journalDirectory){throw 'FIXTURE_JOURNAL'}}
function Get-ChildItem{param($LiteralPath,[switch]$Force) if($journalDirty){return [pscustomobject]@{Name='unexpected'}};return @()}
function Test-Path{param($LiteralPath) return $cutExists}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$failed='974d73c7d84b9ea43e1397b0fdf44c01';$newRun='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';$dir=Join-Path $base ('MelisaERP-P03-transition-'+$newRun)
$ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$newRun+'.json');$BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$newRun+'.json');$ProfileSha256='a'*64;$BeforeImageSha256='b'*64
function Clone($x){return ($x|ConvertTo-Json -Depth 25 -Compress|ConvertFrom-Json)}
$oldProfileRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$failed+'.json'));sha256='68dcb12d3ed557f1ffe48bf99961b24daaa62cf387d1265ac0ad28e608690f3a'}
$oldBeforeRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$failed+'.json'));sha256='ff97a87aa6caf59ae934d07b055bc4d7f8470677a70f30e0b5a12b3a36e5349f'}
$oldClaimRef=[pscustomobject]@{path=(Join-Path $base 'p03-pr54-current-b007-generation-1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381.lock.json');sha256='fb736269cb81c53a164f35f2c348dff7c32ec574b46a1b7b00666f9d9f0a5332'}
$oldProfile=[pscustomobject]@{beforeImage=$oldBeforeRef;businessDigest=[pscustomobject]@{path='C:\Sirket\ERP\backups\P03-20261021-120000\source-pre-snapshot-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.json';sha256=('c'*64)};journalDirectory=(Join-Path $base ('MelisaERP-P03-recovery-'+$failed));stopper=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-stopper-'+$failed+'.ps1'));sha256=('d'*64)};candidateRules=@([pscustomobject]@{role='core';pid=19});protectedProcesses=@([pscustomobject]@{pid=33});oldWatchers=@(1,2)}
$oldBefore=[pscustomobject]@{runId=$failed;startedAt='2026-10-21T10:00:00Z';observedAt='2026-10-21T10:01:00Z';plan=[pscustomobject]@{digest=('e'*64)};identities=[pscustomobject]@{core=[pscustomobject]@{pid=19}}}
$oldClaim=[pscustomobject]@{successorRunId=$failed;currentOwnerDigest='1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381';transitionAuthority=$true;applyExecuted=$false;successorProfile=$oldProfileRef;successorBefore=$oldBeforeRef;stopOrderDigest=('f'*64);candidate=[pscustomobject]@{source='same'};protectedSqlEpoch=[pscustomobject]@{pid=33}}
$profile=Clone $oldProfile;$profile.beforeImage=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};$profile.businessDigest.path='C:\Sirket\ERP\backups\P03-20261021-120000\source-pre-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json';$profile.journalDirectory=Join-Path $base ('MelisaERP-P03-recovery-'+$newRun);$profile.stopper.path=Join-Path $base ('MelisaERP-P03-stopper-'+$newRun+'.ps1')
$before=Clone $oldBefore;$before.runId=$newRun;$before.startedAt='2026-10-21T10:02:00Z';$before.observedAt='2026-10-21T10:03:00Z';$claim=Clone $oldClaim
$context=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-precut974d-continuation.v1';retainedClaimRef=$oldClaimRef;failureTailRef=[pscustomobject]@{path=(Join-Path (Join-Path $base ('MelisaERP-P03-transition-'+$failed)) 'event-0002.json');sha256='327528179fdbed252553f06c7b8e3ba812cfd3c0a4d96419298ba94163c09706'};profileRef=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};beforeRef=$profile.beforeImage;claimPath=(Join-Path $base ('p03-pr54-current-b007-continuation-of-'+$failed+'.lock.json'));correctedSourceCommit='82e741af59cb59f27a4008ded83ca889238fb5c7'}
$store=@{};$store[[IO.Path]::GetFileName($oldClaimRef.path)]=$oldClaim;$store[[IO.Path]::GetFileName($oldProfileRef.path)]=$oldProfile;$store[[IO.Path]::GetFileName($oldBeforeRef.path)]=$oldBefore
$store['transition.lock']=[pscustomobject]@{profileRef=$oldProfileRef;beforeRef=$oldBeforeRef;successorClaimRef=$oldClaimRef;currentPreCapture=[pscustomobject]@{snapshotRef=$oldProfile.businessDigest}}
$previous=$oldBeforeRef.sha256;$eventShas=@('ae88c07259811eb76dcaefc52655f3605af89e99be5e87203d5cb8b0bc67d67c','7452b31c398f56bfea1dbbadf7df1ff295c5bd7673ed04ea4de60c65eb593832','327528179fdbed252553f06c7b8e3ba812cfd3c0a4d96419298ba94163c09706')
foreach($i in 0..2){$store[('event-'+$i.ToString('0000')+'.json')]=[pscustomobject]@{sequence=$i;event=@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$i];target=@('','coreSupervisor','HELD_CORE_CUT')[$i];previousSha256=$previous;profileSha256=$oldProfileRef.sha256;beforeSha256=$oldBeforeRef.sha256;digest=$oldBefore.plan.digest;stopOrderDigest=$oldClaim.stopOrderDigest};$previous=$eventShas[$i]}
$store['io-failure-diagnostic.json']=[pscustomobject]@{phase='HELD_CORE_CUT';reason='P03_OWNER_TRANSITION_STOPPED';failureDiagnostic=[pscustomobject]@{stage='INSPECT';reason='UNCLASSIFIED_IO_FAILURE'};profileSha256=$oldProfileRef.sha256;beforeSha256=$oldBeforeRef.sha256}
$context=Clone $context;$profile=Clone $profile;$before=Clone $before;$claim=Clone $claim
$journalDirty=$false;$cutExists=$false;$read={param($p,$h) return $store[[IO.Path]::GetFileName($p)]}
Assert974dContinuation $context $claim $read
function Reject974d($label,[scriptblock]$change){$savedContext=Clone $context;$savedProfile=Clone $profile;$savedBefore=Clone $before;$savedClaim=Clone $claim;&$change;try{Assert974dContinuation $context $claim $read;throw 'FIXTURE_UNEXPECTED_PASS'}catch{if($_.Exception.Message-cnotmatch'^P03_CURRENT_974D_'){throw}};Set-Variable -Scope 1 context $savedContext;Set-Variable -Scope 1 profile $savedProfile;Set-Variable -Scope 1 before $savedBefore;Set-Variable -Scope 1 claim $savedClaim}
Reject974d 'extra receipt' {$context|Add-Member NoteProperty extra 'bad'}
Reject974d 'wrong corrected source' {$context.correctedSourceCommit='0'*40}
Reject974d 'wrong claim path' {$context.claimPath+='x'}
Reject974d 'wrong retained claim' {$context.retainedClaimRef.sha256='0'*64}
Reject974d 'changed OLD identity' {$before.identities.core.pid=20}
Reject974d 'changed protected' {$profile.protectedProcesses[0].pid=34}
Reject974d 'changed candidate' {$claim.candidate.source='other'}
Reject974d 'changed owner digest' {$claim.currentOwnerDigest='0'*64}
Reject974d 'old business digest reused' {$profile.businessDigest.path=$oldProfile.businessDigest.path}
$journalDirty=$true;try{Assert974dContinuation $context $claim $read;throw 'FIXTURE_DIRTY_PASS'}catch{if($_.Exception.Message-cne'P03_CURRENT_974D_OLD_JOURNAL'){throw}};$journalDirty=$false
$cutExists=$true;try{Assert974dContinuation $context $claim $read;throw 'FIXTURE_CUT_PASS'}catch{if($_.Exception.Message-cne'P03_CURRENT_974D_NO_CUT'){throw}};$cutExists=$false
'PASS'
`;
test('exact974d continuation pins and equivalence apply identically in the three native readers',windows,()=>{
 const files=[source,fileURLToPath(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url)),fileURLToPath(new URL('./p03-pr54-b264-new-owner-recovery.ps1',import.meta.url))];
 for(const file of files)run(extract(['Same974dShape','Assert974dContinuation'],file)+continuation974dFixture);
});


test('exact974d native entry points keep context mandatory and inspect read-only',()=>{
 const old=readFileSync(source,'utf8'),observe=readFileSync(fileURLToPath(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url)),'utf8'),recover=readFileSync(fileURLToPath(new URL('./p03-pr54-b264-new-owner-recovery.ps1',import.meta.url)),'utf8');
 assert.match(old,/RootIntentSha256','ContinuationPath','ContinuationSha256'/);assert.match(old,/if\(\$continuation974d\)\{Need \(\$ContinuationPath -ceq/);
 assert.match(observe,/CURRENT_974D_CONTEXT_REQUIRED/);assert.match(observe,/if\(\$continuation974d\)\{Assert974dContinuation/);
 assert.match(recover,/CURRENT_974D_CONTEXT_REQUIRED/);assert.match(recover,/CURRENT_974D_CONTEXT_FORBIDDEN/);
 for(const raw of [old,observe,recover]){const fn=raw.slice(raw.indexOf('function Assert974dContinuation'),raw.indexOf('function Assert974dContinuation')+raw.slice(raw.indexOf('function Assert974dContinuation')).indexOf('\n}\n')+3);assert(!fn.includes('UtcNow'));assert(!fn.includes('StopNew'));assert(!fn.includes('WriteAllText'));}
});


test('exactb142 continuation preserves974d lineage and rejects source, UID, advanced-cut, pointer and tamper drift in all native readers',windows,()=>{
 const files=[source,fileURLToPath(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url)),fileURLToPath(new URL('./p03-pr54-b264-new-owner-recovery.ps1',import.meta.url))];
 const baseFixture=continuation974dFixture.split('Assert974dContinuation $context $claim $read')[0].replace("$newRun='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'","$newRun='b14266ad30507bb10d78ae76e2546221'").replace("$ProfileSha256='a'*64;$BeforeImageSha256='b'*64","$ProfileSha256='8e34643bd8fb360e8ad7e94fcf5bca1e3b9b438a4d19ca1dce01d21b375d8bb2';$BeforeImageSha256='360b5f6551fda107d2f556f1230cdc2812dcc44b0818bf5b8c35d5b453e7f9d1'");
 for(const file of files)run(extract(['Same974dShape','Assert974dContinuation','AssertB142Continuation'],file)+baseFixture+String.raw`
$b142='b14266ad30507bb10d78ae76e2546221';$priorDir=Join-Path $base ('MelisaERP-P03-transition-'+$b142)
$b142Profile=Clone $profile;$b142Before=Clone $before;$b142Context=Clone $context;$b142Claim=Clone $claim;$b142Claim.successorRunId=$b142;$b142Claim.successorProfile=Clone $context.profileRef;$b142Claim.successorBefore=Clone $context.beforeRef
$b142ClaimRef=[pscustomobject]@{path=$context.claimPath;sha256='442f7d953c6e75512c36a259611d6d3f2275e9073d030991e1f87c177cd461a5'}
$b142Rows=@{};$b142Rows[$b142ClaimRef.path]=$b142Claim;$b142Rows[$context.profileRef.path]=$b142Profile;$b142Rows[$context.beforeRef.path]=$b142Before
$b142ContextRef=[pscustomobject]@{path=(Join-Path $priorDir 'precut-continuation.json');sha256='cc3adf31b7e0bf9fda138093c2fd2c6c892cae09884e443bd1a06cee52605e3a'};$b142Rows[$b142ContextRef.path]=$b142Context
$b142Rows[(Join-Path $priorDir 'transition.lock')]=[pscustomobject]@{profileRef=$b142Claim.successorProfile;beforeRef=$b142Claim.successorBefore;successorClaimRef=$b142ClaimRef;currentPreCapture=[pscustomobject]@{snapshotRef=$b142Profile.businessDigest};continuationRef=$b142ContextRef}
$previous=$b142Claim.successorBefore.sha256;$eventShas=@('457c86fe6db487b490f1d8db50bf69d90a5090c498f8c00cea121aad1660bef9','dfe8cf9b4be4189ce17aa3482fdcb6d3fa20ba05cf678074f0c2d750ffd43b56','abfbe25fb456df145857d10e96f366d3aacfd91b0cfe14440b0ab51b1c04d77c')
foreach($i in 0..2){$b142Rows[(Join-Path $priorDir ('event-'+$i.ToString('0000')+'.json'))]=[pscustomobject]@{sequence=$i;event=@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$i];target=@('','coreSupervisor','HELD_CORE_CUT')[$i];previousSha256=$previous;profileSha256=$b142Claim.successorProfile.sha256;beforeSha256=$b142Claim.successorBefore.sha256;digest=$b142Before.plan.digest;stopOrderDigest=$b142Claim.stopOrderDigest};$previous=$eventShas[$i]}
$b142Rows[(Join-Path $priorDir 'io-failure-diagnostic.json')]=[pscustomobject]@{phase='HELD_CORE_CUT';reason='P03_OWNER_TRANSITION_STOPPED';failureDiagnostic=[pscustomobject]@{stage='DRAIN';reason='P03_PHYSICAL_B264_CUT_OWNER_FRESH'};profileSha256=$b142Claim.successorProfile.sha256;beforeSha256=$b142Claim.successorBefore.sha256}
$ids=@();$b142Before.identities=[pscustomobject]@{};foreach($i in 0..7){$v=[pscustomobject]@{pid=100+$i};$b142Before.identities|Add-Member NoteProperty ('role'+$i) $v;$ids+=,$v};$oldBefore.identities=Clone $b142Before.identities
$snapshot=[pscustomobject]@{schemaVersion='melisa-p03-successor-precut-admission.v1';profileSha256=$b142Claim.successorProfile.sha256;beforeSha256=$b142Claim.successorBefore.sha256;engineSha256='b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f';recoveryHelperSha256='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5';observedAt='2026-10-21T10:04:00Z';oldIdentities=(Clone $ids);oldWatchers=$b142Profile.oldWatchers;consolePins=@();probePins=@();protectedConsolePins=@()}
$b142Rows[(Join-Path $priorDir 'successor-precut-admission.json')]=$snapshot
$b142Rows[(Join-Path $priorDir 'b264-old-owner-cut-intent.json')]=[pscustomobject]@{event='B264_OLD_CUT_INTENT';claimSha256=$b142ClaimRef.sha256;stopOrderDigest=$b142Claim.stopOrderDigest;profileSha256=$b142Claim.successorProfile.sha256;beforeSha256=$b142Claim.successorBefore.sha256;observedAt='2026-10-21T10:04:01Z'}
$newRun='cccccccccccccccccccccccccccccccc';$ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$newRun+'.json');$BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$newRun+'.json');$ProfileSha256='c'*64;$BeforeImageSha256='d'*64
$profile=Clone $b142Profile;$before=Clone $b142Before;$claim=Clone $b142Claim;$profile.beforeImage=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};$before.runId=$newRun;$before.startedAt='2026-10-21T10:05:00Z';$before.observedAt='2026-10-21T10:06:00Z';$profile.businessDigest.path='C:\Sirket\ERP\backups\P03-20261021-120000\source-pre-snapshot-cccccccccccccccccccccccccccccccc.json';$profile.journalDirectory=Join-Path $base ('MelisaERP-P03-recovery-'+$newRun);$profile.stopper.path=Join-Path $base ('MelisaERP-P03-stopper-'+$newRun+'.ps1')
$context=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-precutb142-continuation.v1';retainedClaimRef=$b142ClaimRef;failureTailRef=[pscustomobject]@{path=(Join-Path $priorDir 'event-0002.json');sha256=$eventShas[2]};profileRef=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};beforeRef=$profile.beforeImage;claimPath=(Join-Path $base ('p03-pr54-current-b007-continuation-of-'+$b142+'.lock.json'));correctedSourceCommit='82e741af59cb59f27a4008ded83ca889238fb5c7'}
$context=Clone $context
function Protected($p){if($p-cnotin@($oldProfile.journalDirectory,$b142Profile.journalDirectory)){throw 'FIXTURE_JOURNAL'}}
$read={param($p,$h) if($b142Rows.ContainsKey($p)){return $b142Rows[$p]};return $store[[IO.Path]::GetFileName($p)]}
AssertB142Continuation $context $claim $read
function RejectB142($label,[scriptblock]$change){$savedContext=Clone $context;$savedProfile=Clone $profile;$savedBefore=Clone $before;$savedClaim=Clone $claim;&$change;try{AssertB142Continuation $context $claim $read;throw 'FIXTURE_UNEXPECTED_PASS'}catch{if($_.Exception.Message-cnotmatch'^P03_CURRENT_(?:B142|974D)_'){throw}};Set-Variable -Scope 1 context $savedContext;Set-Variable -Scope 1 profile $savedProfile;Set-Variable -Scope 1 before $savedBefore;Set-Variable -Scope 1 claim $savedClaim}
RejectB142 'wrong scope' {$context.claimPath+='x'}
RejectB142 'wrong source' {$context.correctedSourceCommit='0'*40}
RejectB142 'missingUID' {$before.identities.PSObject.Properties.Remove('role0')}
RejectB142 'tamper protected' {$profile.protectedProcesses[0].pid=34}
RejectB142 'tamper retained pointer' {$context.retainedClaimRef.sha256='0'*64}
$save=Clone $b142Rows[$b142ContextRef.path];$b142Rows[$b142ContextRef.path].claimPath+='wrong';try{AssertB142Continuation $context $claim $read;throw 'FIXTURE_CONTEXT_PASS'}catch{if($_.Exception.Message-cnotmatch'^P03_CURRENT_974D_'){throw}};$b142Rows[$b142ContextRef.path]=$save
$savedSnapshotIds=Clone $snapshot.oldIdentities;$snapshot.oldIdentities=@($snapshot.oldIdentities[1..7]);try{AssertB142Continuation $context $claim $read;throw 'FIXTURE_UID_PASS'}catch{if($_.Exception.Message-cne'P03_CURRENT_B142_SNAPSHOT'){throw}};$snapshot.oldIdentities=$savedSnapshotIds
$cutExists=$true;try{AssertB142Continuation $context $claim $read;throw 'FIXTURE_CUT_PASS'}catch{if($_.Exception.Message-cnotmatch'^P03_CURRENT_(?:B142|974D)_'){throw}}
'PASS'
 `);
});

test('Drain rejects a simulated over-sixty-second internal full capture before COM without weakening the real clock',windows,()=>{
 const out=run(`${fixture}\n${capture()}\n${drain()}\n${setup}\nSetup\n`+String.raw`
$body=(Get-Command CaptureWorkerAdmission).Definition
. ([scriptblock]::Create('function FullCaptureForTiming{'+$body+'}'))
function CaptureWorkerAdmission{$v=FullCaptureForTiming;$script:precutWindowOpenedAt=[DateTime]::UtcNow.AddSeconds(-61);return $v}
ExpectRejected 'internal-capture-over-window' {DrainB264OldOwner}
'COM='+$comStops;'STOPS='+$stops;'DISPOSED='+$disposed
`);assert.match(out,/REJECTED=internal-capture-over-window/);assert.match(out,/COM=0/);assert.match(out,/STOPS=0/);assert.match(out,/DISPOSED=True/);
});
