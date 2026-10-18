import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-successor-core-drain.ps1',import.meta.url));
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
 catch(error){throw Error(String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z_]+/u)?.[0]??String(error.stderr??'FIXTURE_FAILED').slice(0,1400));}
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
const captureFunctions=()=>extract(['ConsoleAuxiliaries'],engine)+'\n'+extract(['AssertWorkerBindings','CaptureWorkerAdmissionCore','CaptureWorkerAdmission','WorkerSamePin','SeedWorkerAdmission']);
test('worker source uses pinned AST functions without dispatch, exact claim/intent and only two CreateNew witnesses',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/ValidateSet\('Inspect','Capture','Drain'\)/);assert.match(s,/Mode='Capture'/);assert.match(s,/ReadWorkerPin \$RecoveryHelperPath \$RecoveryHelperSha256/);
 assert.match(s,/FunctionDefinitionAst/);assert.match(s,/ProbeArgumentsAllowed.*PrepareProbeSource.*LatePrecutProbeAllowed.*ProbeAuxiliaries/);
 assert.match(s,/fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037/);assert.match(s,/79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d/);
 assert.match(s,/EXACT_STOP_INTENT/);assert.match(s,/stopOrderDigest/);assert.match(s,/SUCCESSOR_SNAPSHOT_FRESH/);assert.match(s,/FileMode\]::CreateNew/);assert.match(s,/\.Flush\(\$true\)/);
 assert.match(s,/function LegacyConsoleAuxiliaries\(\$inv\)\{return @\(\)\}/);assert.doesNotMatch(s,/Stop-Process|taskkill|Remove-Item|RegisterTask|\.Kill\(|& \$EnginePath|& \$RecoveryHelperPath/i);
 const cut=s.indexOf("$cut=WriteWorkerEvidence 'successor-core-cut-completed.json'"),open=s.indexOf('$script:lateAdmissionOpen=$true',cut),wait=s.indexOf('try{WaitCoreProbeAbsence}',open);
 assert.ok(cut>0&&open>cut&&wait>open);assert.match(s,/finally\{\$script:lateAdmissionOpen=\$false\}/);assert.match(s,/finally\{if\(\$null -ne \$script:coreLifetime\)\{\$script:coreLifetime.Dispose\(\)\}\}/);
 assert.ok(s.indexOf('[void]$held.Handle')<s.indexOf("'SUCCESSOR_CORE_LIFETIME'"));
});
const inspectAuthorityFixture=String.raw`
$script:base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:predecessor='639e2da815e1e7ac0f1c0d04d7f7bdc3';$script:runId='a'*32;$script:dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
$script:ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json');$script:BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json');$script:ProfileSha256='a'*64;$script:BeforeImageSha256='b'*64;$script:RecoveryHelperSha256='c'*64;$script:engineSha='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'
$script:EnginePath=Join-Path $base ('MelisaERP-P03-transition-'+$predecessor+'\p03-physical-rollback.ps1');$script:RecoveryHelperPath=Join-Path $base 'p03-pr54-paused-old-recover.ps1';$script:Environment='Shared';$script:isRehearsal=$false;$script:database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$script:Mode='Inspect';$script:ClaimPath='';$script:ClaimSha256='';$script:reads=@()
foreach($entry in @{schemaVersion='melisa-p03-owner-observation.v3';runId=$runId;ownerSid=$owner;database=$database;copyId='copy';actualT1=$false;plan=[pscustomobject]@{digest=('d'*64)}}.GetEnumerator()){$before|Add-Member NoteProperty $entry.Key $entry.Value -Force}
foreach($entry in @{schemaVersion='melisa-p03-physical-profile.v1';ownerSid=$owner;database=$database;beforeImage=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};oldSettings=[pscustomobject]@{path=(Join-Path $base 'old-settings.json');sha256='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96'};newSettings=[pscustomobject]@{path=(Join-Path $base 'new-settings.json');sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'}}.GetEnumerator()){$profile|Add-Member NoteProperty $entry.Key $entry.Value -Force}
$script:oldSettings=[pscustomobject]@{ownerSid=$owner;database=$database;copyId='copy';actualT1=$false};$script:newSettings=$oldSettings
function ReadWorkerPin($path,$sha){$script:reads+=,$path;if($path-eq$script:ClaimPath-and-not[string]::IsNullOrEmpty($path)){return ,[Text.Encoding]::UTF8.GetBytes(($script:claim|ConvertTo-Json -Depth 8 -Compress))};return ,[byte[]]@(1)}
function ReadPinned($path,$sha){return ReadWorkerPin $path $sha}
function Authority{WorkerAuthority}
`;
test('Inspect runs actual full capture admission with authenticated OLD probes and never reads a claim',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${extract(['Hash','Json','Tokens'],engine)}\n${extract(['ProbeArgumentsAllowed','LatePrecutProbeAllowed','ProbeAuxiliaries'],recovery)}\n${extract(['WorkerAuthority'])}\n${inspectAuthorityFixture}\n${String.raw`
$probe=[pscustomobject]@{ProcessId=500;ParentProcessId=100;Name='powershell.exe';ExecutablePath=$profile.shell.path;CommandLine=($profile.shell.path+' -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File C:\fixture\probe.ps1 -Ports 5234 -ProcessId 101');CreationDate=[DateTime]::Parse('2026-10-18T10:00:01Z').ToUniversalTime();OwnerSid=$owner};$inv.all+=,$probe
$snapshot=CaptureWorkerAdmission;'APPS='+$snapshot.oldIdentities.Count;'PROBES='+$snapshot.probePins.Count;'READS='+$script:reads.Count;'CLAIM_READ='+@($script:reads|Where-Object{$_-match'successor-of'}).Count;'WRITES='+$script:writes.Count
$probe.CommandLine+=' -Write';ExpectRejected 'foreign-argv' {CaptureWorkerAdmission};$probe.CommandLine=$probe.CommandLine.Replace(' -Write','');$probe.OwnerSid='S-1-5-18';ExpectRejected 'foreign-owner' {CaptureWorkerAdmission};$probe.OwnerSid=$owner;$inv.allListeners=@([pscustomobject]@{OwningProcess=500;LocalPort=65000});ExpectRejected 'probe-listener' {CaptureWorkerAdmission}
`}`);
 assert.match(out,/APPS=8/);assert.match(out,/PROBES=1/);assert.match(out,/CLAIM_READ=0/);assert.match(out,/WRITES=0/);for(const name of ['foreign-argv','foreign-owner','probe-listener'])assert.match(out,new RegExp('REJECTED='+name));
});
test('only Inspect omits claim admission; Capture and Drain require the exact claim and frozen helper scope',windows,()=>{
 const out=run(`${fixture}\n${extract(['Hash','Json'],engine)}\n${extract(['WorkerAuthority'])}\n${inspectAuthorityFixture}\n${String.raw`
WorkerAuthority;'INSPECT=PASS';$script:ClaimPath='C:\forged\claim.json';$script:ClaimSha256='f'*64;WorkerAuthority;'INSPECT_CLAIM_READ='+@($reads|Where-Object{$_-eq$ClaimPath}).Count
$script:Mode='Capture';$script:EnginePath=Join-Path $dir 'p03-physical-rollback.ps1';$script:RecoveryHelperPath=Join-Path $dir 'p03-pr54-paused-old-recover.ps1';$script:ClaimPath='';$script:ClaimSha256='';ExpectRejected 'capture-missing' {WorkerAuthority};$script:Mode='Drain';ExpectRejected 'drain-missing' {WorkerAuthority}
$script:Mode='Capture';$script:ClaimPath=Join-Path $base ('p03-pr54-successor-of-'+$predecessor+'.lock.json');$script:ClaimSha256='f'*64;$script:claim=[pscustomobject]@{schemaVersion='melisa-p03-owner-successor-claim.v1';predecessorRunId=$predecessor;successorRunId=$runId;successorProfile=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};successorBefore=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};engineSha256=$engineSha;stopOrderDigest=(Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{planDigest=$before.plan.digest;stopOrder=$order}|ConvertTo-Json -Compress))))};WorkerAuthority;'CAPTURE=PASS';'CAPTURE_CLAIM_READ='+@($reads|Where-Object{$_-eq$ClaimPath}).Count
$script:claim.successorRunId='b'*32;ExpectRejected 'claim-tamper' {WorkerAuthority};$script:Mode='Inspect';$script:EnginePath='C:\foreign\p03-physical-rollback.ps1';ExpectRejected 'inspect-root' {WorkerAuthority}
`}`);
 assert.match(out,/INSPECT=PASS/);assert.match(out,/INSPECT_CLAIM_READ=0/);assert.match(out,/CAPTURE=PASS/);assert.match(out,/CAPTURE_CLAIM_READ=1/);for(const name of ['capture-missing','drain-missing','claim-tamper','inspect-root'])assert.match(out,new RegExp('REJECTED='+name));
});
test('Capture actual worker AST authenticates all ten live parents and fe console cache without writing',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n$snapshot=CaptureWorkerAdmission;'APPS='+$snapshot.oldIdentities.Count;'WATCHERS='+$snapshot.oldWatchers.Count;'CONSOLES='+$snapshot.consolePins.Count;'WRITES='+$script:writes.Count;$inv.all=@($inv.all|Where-Object{$_.ProcessId -notin @(10,11)});$inv.instances=@();$script:taskState=3;$script:consolePins=@{};SeedWorkerAdmission $snapshot;$script:tasksStopRequested=$true;[void](ConsoleAuxiliaries $inv @($before.identities.PSObject.Properties|ForEach-Object{$_.Value}));'ORPHAN_CACHE='+$script:consolePins.Count`);
 assert.match(out,/APPS=8/);assert.match(out,/WATCHERS=2/);assert.match(out,/CONSOLES=1/);assert.match(out,/WRITES=0/);assert.match(out,/ORPHAN_CACHE=1/);
});
test('Capture rejects changed role/watcher, foreign descendants, console signature/hash/listener and partial COM',windows,()=>{
 const edits=[['app',"$inv.all[0].CreationDate=$inv.all[0].CreationDate.AddTicks(1)"],['watcher',"$inv.all[8].CommandLine='foreign'"],['foreign',"$inv.all+=,[pscustomobject]@{ProcessId=999;ParentProcessId=100;Name='bad.exe';CommandLine='foreign'}"],['signature',"$script:signature='NotSigned'"],['hash',"$script:binaryHash='0'*64"],['listener',"$inv.allListeners=@([pscustomobject]@{OwningProcess=60;LocalPort=65000})"],['COM',"$inv.instances=@($inv.instances[0])"],['task',"$script:taskState=3"]];
 const out=run(`${fixture}\n${captureFunctions()}\n${edits.map(([name,edit])=>`ResetFixture;${edit};ExpectRejected '${name}' {CaptureWorkerAdmission}`).join('\n')}`);
 for(const [name]of edits)assert.match(out,new RegExp('REJECTED='+name+'(?:\\r?\\n|$)'));
});
test('admission snapshot rejects wrong hash scope, stale data, duplicate identities and forged console pins',windows,()=>{
 const edits=[['profile',"$snapshot.profileSha256='foreign'"],['stale',"$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')"],['future',"$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(1).ToString('o')"],['duplicate',"$snapshot.oldIdentities=@($snapshot.oldIdentities[0])*8"],['parent',"$snapshot.consolePins[0].parentPid=999"],['path',"$snapshot.consolePins[0].nodePath='C:\\foreign.exe'"],['owner',"$snapshot.consolePins[0].ownerSid='S-1-5-18'"]];
 const out=run(`${fixture}\n${captureFunctions()}\n${edits.map(([name,edit])=>`ResetFixture;$snapshot=CaptureWorkerAdmission;$script:consolePins=@{};${edit};ExpectRejected '${name}' {SeedWorkerAdmission $snapshot}`).join('\n')}`);
 for(const [name]of edits)assert.match(out,new RegExp('REJECTED='+name+'(?:\\r?\\n|$)'));
});
const drainFunctions=()=>extract(['Json'],engine)+'\n'+extract(['PausedTasks','PausedOld','PausedOldCore','PausedRemaining','PausedRemainingCore','WaitCoreProbeAbsence'],recovery,{PausedRemainingCore:'RecoveredRemainingCore'})+'\n'+extract(['PausedRemainingCore','DrainWorkerCore']);
const drainFixture=String.raw`
function ReadWorkerPin($path,$sha){return ,[Text.Encoding]::UTF8.GetBytes(($script:snapshot|ConvertTo-Json -Depth 14 -Compress))}
function Test-Path{param($LiteralPath);return $false}
function HoldWorkerCore($core){$held=[pscustomobject]@{Id=$core.pid;Handle=[IntPtr]17;HasExited=$false;StartTime=[DateTime]::Parse($core.creationTime).ToUniversalTime()};$held|Add-Member ScriptMethod Dispose {$script:disposed=$true};return $held}
function StopWorkerCore($core){$script:stops++;$script:coreLifetime.HasExited=$true;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId -notin @(100,102,103,104,105,106,107)})}
function WriteWorkerEvidence($leaf,$value){if($script:writeFail){throw 'FIXTURE_WRITE_FAILED'};$script:writes+=,$leaf;return [ordered]@{path=('C:\fixture\'+$leaf);sha256=('a'*64)}}
function Start-Sleep{param($Milliseconds);throw 'FIXTURE_UNEXPECTED_WAIT'}
function PrepareDrainFixture{
 ResetFixture;$script:snapshot=CaptureWorkerAdmission;$script:consolePins=@{};$script:probePins=@{};$script:taskState=3;$script:inv.instances=@();$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId -notin @(10,11)})
}
`;
test('Drain authenticates eight before stop, accepts six natural exits and leaves surviving Hub untouched',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${drainFunctions()}\n${drainFixture}\nPrepareDrainFixture;$result=DrainWorkerCore;'STATUS='+$result.status;'STOPS='+$script:stops;'GONE='+($result.goneOldPids -join ',');'REMAIN='+$result.remainingOldRoles;'DISPOSED='+$script:disposed;'LATE_OPEN='+$script:lateAdmissionOpen;'HUB='+@($inv.all|Where-Object{$_.ProcessId -eq 101}).Count`);
 assert.match(out,/STATUS=SUCCESSOR_CORE_DRAINED/);assert.match(out,/STOPS=1/);assert.match(out,/GONE=100,102,103,104,105,106,107/);assert.match(out,/REMAIN=1/);assert.match(out,/DISPOSED=True/);assert.match(out,/LATE_OPEN=False/);assert.match(out,/HUB=1/);
});
test('Drain fails before cut for missing role and closes late admission after witness failure',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${drainFunctions()}\n${drainFixture}\nPrepareDrainFixture;$inv.all=@($inv.all|Where-Object{$_.ProcessId -ne 102});ExpectRejected 'missing-before' {DrainWorkerCore};'BEFORE_STOPS='+$script:stops;'BEFORE_DISPOSED='+$script:disposed;PrepareDrainFixture;$script:writeFail=$true;ExpectRejected 'witness' {DrainWorkerCore};'LATE_OPEN='+$script:lateAdmissionOpen;'DISPOSED='+$script:disposed`);
 assert.match(out,/REJECTED=missing-before/);assert.match(out,/BEFORE_STOPS=0/);assert.match(out,/BEFORE_DISPOSED=True/);assert.match(out,/REJECTED=witness/);assert.match(out,/LATE_OPEN=False/);assert.match(out,/DISPOSED=True/);
});
test('after witnessed cut gone PID reuse and unknown core descendants fail closed',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${drainFunctions()}\n${drainFixture}\nPrepareDrainFixture;$null=DrainWorkerCore;$inv.all+=,(ProcessFor $before.identities.crmServer);ExpectRejected 'reappeared' {PausedRemainingCore};PrepareDrainFixture;$null=DrainWorkerCore;$inv.all+=,[pscustomobject]@{ProcessId=999;ParentProcessId=100;Name='foreign.exe';CommandLine='foreign'};ExpectRejected 'foreign' {PausedRemainingCore}`);
 assert.match(out,/REJECTED=reappeared/);assert.match(out,/REJECTED=foreign/);
});
test('pinned AST importer defines callable engine/helper functions at script scope without running dispatch',windows,()=>{
 const out=run(`${extract(['ImportWorkerFunctions'])}\nImportWorkerFunctions ([IO.File]::ReadAllBytes(${q(engine)})) @('Hash','ConsoleAuxiliaries')\nImportWorkerFunctions ([IO.File]::ReadAllBytes(${q(recovery)})) @('ProbeArgumentsAllowed','LatePrecutProbeAllowed','ProbeAuxiliaries','PausedRemainingCore')\n'HASH='+(Hash ([byte[]]@(1,2,3)));'ENGINE='+[bool](Get-Command ConsoleAuxiliaries -ErrorAction Stop);'HELPER='+[bool](Get-Command ProbeAuxiliaries -ErrorAction Stop);'REMAINING_ALIAS='+[bool](Get-Command RecoveredRemainingCore -ErrorAction Stop)`);
 assert.match(out,/HASH=039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81/);assert.match(out,/ENGINE=True/);assert.match(out,/HELPER=True/);assert.match(out,/REMAINING_ALIAS=True/);
});
test('Drain uses actual bounded late-probe classifier and waits naturally without stopping probes',windows,()=>{
 const realProbe=extract(['Tokens'],engine)+'\n'+extract(['ProbeArgumentsAllowed','LatePrecutProbeAllowed','ProbeAuxiliaries'],recovery);
 const probeDrain=String.raw`
function AppendWorkerProbe($core){
 $script:stops++;$script:coreLifetime.HasExited=$true;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId -notin @(100,102,103,104,105,106,107)})
 $script:probe=[pscustomobject]@{ProcessId=500;ParentProcessId=100;Name='powershell.exe';ExecutablePath=$profile.shell.path;CommandLine=($profile.shell.path+' -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File C:\fixture\probe.ps1 -Ports 5234');CreationDate=[DateTime]::UtcNow;OwnerSid=$owner};$script:inv.all+=,$probe
}
function Start-Sleep{param($Milliseconds);Need ($Milliseconds-eq250) 'FIXTURE_DELAY';$script:sleeps++;$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId-ne500})}
`;
 const out=run(`${fixture}\n${captureFunctions()}\n${drainFunctions()}\n${drainFixture}\n${realProbe}\n${probeDrain}\nfunction StopWorkerCore($core){AppendWorkerProbe $core}\nPrepareDrainFixture;$script:sleeps=0;$result=DrainWorkerCore;'STATUS='+$result.status;'LATE='+$result.latePrecutProbeCount;'PROBES='+$result.authenticatedProbeCount;'SLEEPS='+$script:sleeps;'STOPS='+$script:stops;'LATE_OPEN='+$script:lateAdmissionOpen\nfunction StopWorkerCore($core){AppendWorkerProbe $core;$script:probe.CreationDate=[DateTime]::UtcNow.AddSeconds(1)}\nPrepareDrainFixture;ExpectRejected 'postcut-born' {DrainWorkerCore};'POSTCUT_CLOSED='+(-not $script:lateAdmissionOpen)\nfunction StopWorkerCore($core){AppendWorkerProbe $core;$script:probe.CommandLine+=' -Write'}\nPrepareDrainFixture;ExpectRejected 'argv-write' {DrainWorkerCore};'ARGV_CLOSED='+(-not $script:lateAdmissionOpen)`);
 assert.match(out,/STATUS=SUCCESSOR_CORE_DRAINED/);assert.match(out,/LATE=1/);assert.match(out,/PROBES=1/);assert.match(out,/SLEEPS=1/);assert.match(out,/STOPS=1/);assert.match(out,/LATE_OPEN=False/);
 assert.match(out,/REJECTED=postcut-born/);assert.match(out,/REJECTED=argv-write/);assert.match(out,/POSTCUT_CLOSED=True/);assert.match(out,/ARGV_CLOSED=True/);
});
