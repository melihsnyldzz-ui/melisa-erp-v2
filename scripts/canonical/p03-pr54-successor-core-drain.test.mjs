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
const captureFunctions=()=>extract(['ConsoleAuxiliaries'],engine)+'\n'+extract(['GetCurrentB007ProtectedConsolePins','AssertWorkerBindings','CaptureWorkerAdmissionCore','CaptureWorkerAdmission','WorkerSamePin','SeedWorkerAdmission']);
const protectedConsoleFixture=String.raw`
function ResetProtectedConsoleFixture{
 ResetFixture;$script:PolicyGeneration='CurrentB007InspectOnly';$script:protectedConsolePins=@{}
 $script:profile|Add-Member NoteProperty protectedProcesses @([pscustomobject]@{kind='ProtectedSqlService';pid=999})
 foreach($n in 0..2){$p=[pscustomobject]@{pid=800+$n;parentPid=1;nodePath='C:\protected\node.exe';commandLine=('protected-'+$n);ownerSid=$owner;creationTime='2026-10-18T08:00:00.0000000Z'};$profile.protectedProcesses+=,$p;$inv.all+=,(ProcessFor $p);$console=[pscustomobject]@{pid=900+$n;parentPid=$p.pid;nodePath='C:\Windows\System32\conhost.exe';commandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';ownerSid=$owner;creationTime='2026-10-18T08:00:01.0000000Z'};$inv.all+=,(ProcessFor $console)}
}
ResetProtectedConsoleFixture
`;
test('CurrentB007 capture authenticates protected TEST consoles separately and leaves owned stop pins and raw rows intact',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${protectedConsoleFixture}\n${String.raw`
$original=$script:consolePins;$raw=($inv.all|ConvertTo-Json -Depth 10 -Compress);$profileBefore=($profile|ConvertTo-Json -Depth 15 -Compress)
$frame=CaptureWorkerAdmissionCore
if($frame.protectedConsolePins.Count-ne3-or$frame.consolePins.Count-ne1-or$frame.probePins.Count-ne0){throw 'FIXTURE_PROTECTED_CONSOLE_COUNTS'}
if(-not[object]::ReferenceEquals($original,$script:consolePins)-or@($script:consolePins.Keys|Where-Object{$_-ge900}).Count){throw 'FIXTURE_OWNED_CACHE_CHANGED'}
if(($inv.all|ConvertTo-Json -Depth 10 -Compress)-cne$raw-or($profile|ConvertTo-Json -Depth 15 -Compress)-cne$profileBefore){throw 'FIXTURE_RAW_CHANGED'}
foreach($pin in $frame.protectedConsolePins){if($pin.pid-notin900..902-or(@($pin.PSObject.Properties.Name|Sort-Object)-join'|')-cne'commandLine|creationTime|nodePath|ownerSid|parentPid|pid'){throw 'FIXTURE_PROTECTED_PIN_SHAPE'}}
$next=CaptureWorkerAdmissionCore;if($next.protectedConsolePins.Count-ne3-or$next.consolePins.Count-ne1){throw 'FIXTURE_REFRESH_MIXED'}
'PROTECTED_SEPARATE_3_OWNED_1_NO_WRITES'
`}`);
 assert.match(out,/PROTECTED_SEPARATE_3_OWNED_1_NO_WRITES/);
});
test('protected console classification rejects source, owner, listener, parent and reused PID drift and restores owned cache on every failure',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${protectedConsoleFixture}\n${String.raw`
foreach($mode in @('binary','hash','signature','owner','listener','parent','parent-birth','reuse')){
 ResetProtectedConsoleFixture;$null=ConsoleAuxiliaries $inv (@($order|ForEach-Object{$before.identities.$_})+@($profile.oldWatchers));$owned=$script:consolePins;$ownedBefore=@($owned.Values)|ConvertTo-Json -Depth 10 -Compress
 if($mode -cin @('parent','reuse')){$null=GetCurrentB007ProtectedConsolePins $inv}
 $target=@($inv.all|Where-Object{$_.ProcessId-eq900})[0]
 switch($mode){binary{$target.ExecutablePath='C:\foreign\conhost.exe'} hash{$script:binaryHash='0'*64} signature{$script:signature='Invalid'} owner{$target.OwnerSid='other'} listener{$inv.allListeners=@([pscustomobject]@{OwningProcess=900;LocalPort=4444})} parent{$target.ParentProcessId=100} 'parent-birth'{@($inv.all|Where-Object{$_.ProcessId-eq800})[0].CreationDate=[DateTime]::Parse('2026-10-18T08:00:01Z')} reuse{$target.CreationDate=$target.CreationDate.AddSeconds(1)}}
 ExpectRejected $mode {GetCurrentB007ProtectedConsolePins $inv}
 if(-not[object]::ReferenceEquals($owned,$script:consolePins)-or(@($owned.Values)|ConvertTo-Json -Depth 10 -Compress)-cne$ownedBefore){throw 'FIXTURE_OWNED_CACHE_LEAK'}
}
ResetProtectedConsoleFixture;$script:tasksStopRequested=$true;ExpectRejected 'after-stop' {GetCurrentB007ProtectedConsolePins $inv}
'RESTORED_OWNED_CACHE_ALL_FAILURES'
`}`);
 for(const mode of ['binary','hash','signature','owner','listener','parent','parent-birth','reuse','after-stop'])assert.match(out,new RegExp('REJECTED='+mode));assert.match(out,/RESTORED_OWNED_CACHE_ALL_FAILURES/);
});
test('legacy capture never emits protected console pins and typed SQL children are not admitted as normal protected consoles',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${protectedConsoleFixture}\n${String.raw`
foreach($generation in @('Legacy','B264InspectOnly','B264Sup20DInspectOnly')){ResetProtectedConsoleFixture;$script:PolicyGeneration=$generation;$frame=CaptureWorkerAdmissionCore;if($frame.Contains('protectedConsolePins')-or$frame.consolePins.Count-ne1){throw 'FIXTURE_LEGACY_CHANGED'}}
ResetProtectedConsoleFixture;$sqlConsole=[pscustomobject]@{pid=990;parentPid=999;nodePath='C:\Windows\System32\conhost.exe';commandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';ownerSid=$owner;creationTime='2026-10-18T08:00:01.0000000Z'};$inv.all+=,(ProcessFor $sqlConsole)
$frame=CaptureWorkerAdmissionCore;if($frame.protectedConsolePins.Count-ne3-or990-in@($frame.protectedConsolePins.pid)-or990-in@($frame.consolePins.pid)){throw 'FIXTURE_SQL_CONSOLE_ADMITTED'}
'LEGACY_UNCHANGED_SQL_NOT_CLASSIFIED'
`}`);
 assert.match(out,/LEGACY_UNCHANGED_SQL_NOT_CLASSIFIED/);
});
test('CurrentB007 seed carries protected pins separately across held-cut admission and rejects forged or reused protected pins',windows,()=>{
 const out=run(`${fixture}\n${captureFunctions()}\n${protectedConsoleFixture}\n${String.raw`
function CurrentSnapshot{return (CaptureWorkerAdmissionCore|ConvertTo-Json -Depth 20 -Compress|ConvertFrom-Json)}
$snapshot=CurrentSnapshot;$script:consolePins=@{};$script:protectedConsolePins=@{};SeedWorkerAdmission $snapshot
if($script:consolePins.Count-ne1-or$script:protectedConsolePins.Count-ne3-or@($script:consolePins.Keys|Where-Object{$_-ge900}).Count){throw 'FIXTURE_SEED_MIXED'}
$next=CaptureWorkerAdmissionCore;if($next.protectedConsolePins.Count-ne3-or$next.consolePins.Count-ne1){throw 'FIXTURE_HELD_CUT_RECAPTURE'}
foreach($mode in @('owner','parent','overlap','duplicate','reuse')){
 ResetProtectedConsoleFixture;$snapshot=CurrentSnapshot;$script:consolePins=@{};$script:protectedConsolePins=@{}
 if($mode-ceq'reuse'){SeedWorkerAdmission $snapshot;$script:consolePins=@{}}
 switch($mode){owner{$snapshot.protectedConsolePins[0].ownerSid='other'} parent{$snapshot.protectedConsolePins[0].parentPid=999} overlap{$snapshot.protectedConsolePins[0].pid=60} duplicate{$snapshot.protectedConsolePins+=,$snapshot.protectedConsolePins[0]} reuse{$snapshot.protectedConsolePins[0].creationTime='2026-10-18T08:00:02.0000000Z'}}
 ExpectRejected ('SEED_'+$mode.ToUpperInvariant()) {SeedWorkerAdmission $snapshot}
 if(@($script:consolePins.Keys|Where-Object{$_-ge900}).Count){throw 'FIXTURE_SEED_OWNED_LEAK'}
}
ResetProtectedConsoleFixture;$inv.all=@($inv.all|Where-Object{$_.ProcessId-notin900..902});$empty=CaptureWorkerAdmissionCore;if(@($empty.protectedConsolePins).Count-ne0){throw 'FIXTURE_EMPTY_NULL_PIN'}
'SEED_PROTECTED_SEPARATE_EMPTY_ARRAY'
`}`);
 for(const mode of ['owner','parent','overlap','duplicate','reuse'])assert.match(out,new RegExp('REJECTED=SEED_'+mode.toUpperCase()));assert.match(out,/SEED_PROTECTED_SEPARATE_EMPTY_ARRAY/);
});
const timingFunctions=()=>captureFunctions()+'\n'+extract(['Identity','Tokens'],engine)+'\n'+extract(['Inventory'],engine,{Inventory:'LegacyInventory'})+'\n'+extract(['ProbeArgumentsAllowed','LatePrecutProbeAllowed','ProbeAuxiliaries'],recovery)+'\n'+extract(['Inventory']);
const timingFixture=String.raw`
function ResetTiming{
 ResetFixture;$script:clock=0;$script:expiresAt=0;$script:trace=@();$script:sidReads=@();$script:sidMode='normal';$script:sidTarget=500;$script:expiryEnabled=$true;$script:protectedChecks=0
 $script:ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
 $script:probe=[pscustomobject]@{ProcessId=500;ParentProcessId=100;Name='powershell.exe';ExecutablePath=$profile.shell.path;CommandLine=($profile.shell.path+' -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File C:\fixture\probe.ps1 -Ports 5234 -ProcessId 101');CreationDate=[DateTime]::Parse('2026-10-18T10:00:01Z').ToUniversalTime();OwnerSid=$owner}
 $script:probeConsole=[pscustomobject]@{ProcessId=501;ParentProcessId=500;Name='conhost.exe';ExecutablePath='C:\Windows\System32\conhost.exe';CommandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';CreationDate=$probe.CreationDate.AddTicks(1);OwnerSid=$owner}
 $script:unrelated=[pscustomobject]@{ProcessId=9999;ParentProcessId=1;Name='other.exe';ExecutablePath='C:\other\other.exe';CommandLine='unrelated';CreationDate=[DateTime]::Parse('2026-10-18T08:00:00Z').ToUniversalTime();OwnerSid='other'}
 $script:inv.all+=@($probe,$probeConsole,$unrelated)
 $script:folder|Add-Member ScriptMethod GetTask {param($name);$script:clock+=2;$script:trace+=,('XML-'+$name);[pscustomobject]@{State=$script:taskState;Xml='old'}} -Force
 $script:schedule=[pscustomobject]@{};$schedule|Add-Member ScriptMethod GetRunningTasks {param($flags);if($flags-ne1){throw 'FIXTURE_COM_FLAGS'};$script:clock+=10;$script:trace+=,'COM';$runs=[pscustomobject]@{Count=$script:inv.instances.Count};$runs|Add-Member ScriptMethod Item {param($index);return $script:inv.instances[$index-1]};return $runs}
}
function Get-NetTCPConnection{param($State,$ErrorAction);if($State-cne'Listen'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_NET_SCOPE'};$script:clock+=10;$script:trace+=,'NET';return $script:inv.allListeners}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction)
 if($ClassName-cne'Win32_Process'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_CIM_SCOPE'}
 if($Filter){if($Filter-cne'ProcessId=500'){throw 'FIXTURE_FILTER_SCOPE'};if($script:expiryEnabled-and$script:clock-gt$script:expiresAt){return @()};return @($script:inv.all|Where-Object{$_.ProcessId-eq500})}
 $script:trace+=,'CIM';$script:expiresAt=$script:clock+4;return $script:inv.all
}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction)
 if($MethodName-cne'GetOwnerSid'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_SID_SCOPE'}
 $script:clock++;$script:sidReads+=,[int]$InputObject.ProcessId;$script:trace+=,('SID-'+$InputObject.ProcessId)
 if($script:expiryEnabled-and$InputObject.ProcessId-in@(500,501)-and$script:clock-gt$script:expiresAt){throw 'FIXTURE_PROBE_EXPIRED'}
 if($InputObject.ProcessId-eq$script:sidTarget){if($script:sidMode-ceq'missing'){return [pscustomobject]@{ReturnValue=0;Sid=$null}};if($script:sidMode-ceq'denied'){return [pscustomobject]@{ReturnValue=2;Sid=$null}}}
 return [pscustomobject]@{ReturnValue=0;Sid=$InputObject.OwnerSid}
}
function ProtectedProcesses($inventory){$script:clock+=2;$script:protectedChecks++}
ResetTiming
`;

test('actual PS5 worker collects CIM last and authenticates ephemeral probe/console before full admission; both old delays fail',windows,()=>{
 const out=run(`${fixture}\n${timingFunctions()}\n${timingFixture}\n${String.raw`
$newInventory=(Get-Command Inventory).Definition
$newCapture=(Get-Command CaptureWorkerAdmissionCore).Definition
$start=$newCapture.IndexOf(' $expectedParents=@(');$end=$newCapture.IndexOf(' ProtectedProcesses $inv',$start)
if($start-lt0-or$end-le$start){throw 'FIXTURE_CAPTURE_PHASE'}
$legacyCapture=$newCapture.Remove($start,$end-$start)
# Literal source marker: do not expand fixture's selected variable here.
$marker=' Need (@($selected|Select-Object -ExpandProperty pid -Unique).Count -eq 10) ''SUCCESSOR_CAPTURE_DISTINCT'''
$legacyCapture=$legacyCapture.Replace($marker,$marker+[Environment]::NewLine+' $probes=@(ProbeAuxiliaries $inv);$aux=@(ConsoleAuxiliaries $inv @($selected+$probes));$aux+=@($probes|ForEach-Object{$_.pid})')
if($legacyCapture-ceq$newCapture-or-not$legacyCapture.Contains('ProbeAuxiliaries $inv')){throw 'FIXTURE_LEGACY_BODY'}
. ([scriptblock]::Create('function Inventory{'+(Get-Command LegacyInventory).Definition+'}'))
ExpectRejected 'CIM-before-slow-reads' {CaptureWorkerAdmissionCore}
ResetTiming;. ([scriptblock]::Create('function Inventory{'+$newInventory+'}'));. ([scriptblock]::Create('function LegacyCapture{'+$legacyCapture+'}'))
ExpectRejected 'stable-UIDs-before-probes' {LegacyCapture}
ResetTiming;$snapshot=CaptureWorkerAdmissionCore
'APPS='+$snapshot.oldIdentities.Count;'WATCHERS='+$snapshot.oldWatchers.Count;'PROBES='+$snapshot.probePins.Count;'CONSOLES='+$snapshot.consolePins.Count;'PROTECTED='+$protectedChecks;'WRITES='+$writes.Count
'SID_ORDER='+($sidReads-join',');'TRACE='+($trace-join',')
$frame=Inventory;'FIELDS='+(@($frame.PSObject.Properties.Name|Sort-Object)-join',');'ALL='+$frame.all.Count;'UNRELATED='+@($frame.all|Where-Object{$_.ProcessId-eq9999}).Count
`}`);
 for(const name of ['CIM-before-slow-reads','stable-UIDs-before-probes'])assert.match(out,new RegExp('REJECTED='+name));
 assert.match(out,/APPS=8/);assert.match(out,/WATCHERS=2/);assert.match(out,/PROBES=1/);assert.match(out,/CONSOLES=2/);assert.match(out,/PROTECTED=1/);assert.match(out,/WRITES=0/);assert.match(out,/SID_ORDER=100,500,500,501,/);assert.match(out,/TRACE=NET,COM,CIM,SID-100,SID-500,SID-500,SID-501,/);assert.match(out,/FIELDS=all,allListeners,instances,listeners/);assert.match(out,/ALL=14/);assert.match(out,/UNRELATED=1/);
});

test('early ephemeral authentication retains full ten SID checks, strict parent, global listeners and foreign-descendant rejection',windows,()=>{
 const edits=[['missing-probe-SID',"$script:sidMode='missing'"],['denied-probe-SID',"$script:sidMode='denied'"],['missing-old-SID',"$script:sidMode='missing';$script:sidTarget=107"],['denied-watcher-SID',"$script:sidMode='denied';$script:sidTarget=11"],['probe-parent',"$probe.ParentProcessId=9999"],['parent-SID',"$inv.all[0].OwnerSid='foreign'"],['foreign-argv',"$probe.CommandLine+=' -Write'"],['unknown-listener',"$inv.allListeners=@([pscustomobject]@{LocalPort=4184;LocalAddress='127.0.0.1';OwningProcess=9999})"],['probe-global-listener',"$inv.allListeners=@([pscustomobject]@{LocalPort=65000;LocalAddress='127.0.0.1';OwningProcess=500})"],['foreign-child',"$foreign=ProcessFor $before.identities.hub;$foreign.ProcessId=777;$foreign.ParentProcessId=100;$foreign.CommandLine='foreign';$inv.all+=,$foreign"]];
 const out=run(`${fixture}\n${timingFunctions()}\n${timingFixture}\n${edits.map(([name,edit])=>`ResetTiming;$script:expiryEnabled=$false;${edit};ExpectRejected '${name}' {CaptureWorkerAdmissionCore}`).join('\n')}`);
 for(const [name]of edits)assert.match(out,new RegExp('REJECTED='+name));
});
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

function sup20DFixture(generation){
 const whole=readFileSync(source,'utf8');const from=generation==='old'?'function AssertB264InspectionContract(':'function AssertB264Sup20DInspectionContract(';const fromIndex=whole.indexOf(from);const drainer=whole.slice(fromIndex,whole.indexOf(generation==='old'?'function AssertB264Sup20DInspectionContract(':'function WorkerSamePin',fromIndex+10));
 const root=String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018`;
 const owner='S-1-5-21-2170750028-1005938530-2568122015-1001',db='MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
 const matches=[...drainer.matchAll(/@\(\$(oldSettings|newSettings)\.(components\.\w+|supervisor),'([^']+)','([a-f0-9]{40})','([a-f0-9]{64})'\)/g)];assert.equal(matches.length,6);
 const old={ownerSid:owner,database:db,copyId,actualT1:false,components:{}},next=structuredClone(old),packages=[];
 for(const [,which,key,packageRoot,sourceCommit,manifestSha256]of matches){const v={packageRoot,sourceCommit,manifestSha256},o=which==='oldSettings'?old:next;if(key==='supervisor')o.supervisor=v;else o.components[key.split('.')[1]]=v;packages.push({root:packageRoot,sourceCommit,manifestPath:packageRoot+'\\release-manifest.json',manifestSha256});}
 next.components.crm=structuredClone(old.components.crm);next.components.nativeOrder=structuredClone(old.components.nativeOrder);
 if(generation!=='old'){
  old.components.crm.config={path:String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json`,sha256:'9b484883f89584225bcd5242b7f501a38feb6a1bbaa22d8a8e17accf302785ab'};
  next.components.crm.config={path:String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json`,sha256:old.components.crm.config.sha256};
 }

 const oldSettings={path:String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json`,sha256:'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'},newSettings={path:String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json`,sha256:generation==='old'?'c'.repeat(64):'f893faf4a1113fab3fdcdfce181e219f1bee480be4b6ab4142a738e47c094c95'};
 const names=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'],roles=['coreSupervisor','crmCatalog','crmNativeOrder','crmOrders','crmServer','erpApi','erpNative','hub'];
 const identity=pid=>({pid,ownerSid:owner,creationTime:'2026-10-20T10:00:00.0000000Z'});
 const before={schemaVersion:'melisa-p03-owner-observation.v3',runId:'a'.repeat(32),ownerSid:owner,database:db,copyId,actualT1:false,observedAt:'2026-10-20T10:01:00.0000000Z',oldConfig:oldSettings,newConfig:newSettings,plan:{oldSettingsSha256:oldSettings.sha256,newSettingsSha256:newSettings.sha256},profile:{},oldSupervisor:{root:old.supervisor.packageRoot,manifest:old.supervisor.manifestSha256},identities:Object.fromEntries(roles.map((r,n)=>[r,identity(n+1)]))};
 for(const [k,v]of [['erp',next.components.erpApiNative],['crm',next.components.crm],['supervisor',next.supervisor]])Object.assign(before.profile,{[k+'Source']:v.sourceCommit,[k+'Manifest']:v.manifestSha256});
 const profile={schemaVersion:'melisa-p03-physical-profile.v1',ownerSid:owner,database:db,beforeImage:{path:root+'\\MelisaERP-P03-before-'+ 'a'.repeat(32)+'.json',sha256:'b'.repeat(64)},oldSettings,newSettings,packages,oldWatchers:[identity(9),identity(10)],tasks:names.map(name=>({name})),protectedProcesses:generation==='old'?[{kind:'ProtectedSqlService'}]:[{kind:'ProtectedSqlService'},{pid:57,nodePath:'C:\\synthetic\\protected-helper.exe'}]};return {profile,before,old,next};
}

test('SUP20D finite contract differs only in its literal supervisor tuple and preserves all original checks',()=>{
 const whole=readFileSync(source,'utf8'),a=whole.indexOf('function AssertB264InspectionContract('),b=whole.indexOf('function AssertB264Sup20DInspectionContract('),c=whole.indexOf('function WorkerSamePin',b);
 const expected=whole.slice(a,b).replace('AssertB264InspectionContract','AssertB264Sup20DInspectionContract').replaceAll('CANONICAL-CRM06-SUPERVISOR-TEST-20261019-eb5b37a555cb','CANONICAL-CRM06-SUPERVISOR-TEST-20261020-20d7e5b69696').replaceAll('eb5b37a555cbf18e1fcaa491820707c73b354e12','20d7e5b696969d502014ba359b950496dc530410').replaceAll('1a9d7a0ba6d0ed0fa60e9044122fb895e58e725d84f194ceea255a00aece39b0','0959b1b84faafe2e297e537d470d6b6d443e6fac2fe30d3f2518f5b6036d1418');
 const actual=whole.slice(b,c).replace("Where-Object{$_.PSObject.Properties.Name -ccontains 'kind' -and $_.kind -ceq 'ProtectedSqlService'}","Where-Object{$_.kind -ceq 'ProtectedSqlService'}").replace(" B264Need ($profile.newSettings.sha256 -ceq 'f893faf4a1113fab3fdcdfce181e219f1bee480be4b6ab4142a738e47c094c95')\n",'');const start=actual.indexOf(' # SUP20D keeps'),end=actual.indexOf(' foreach($pair in',start);assert.ok(start>0&&end>start);assert.equal(actual.slice(0,start)+" foreach($component in @('crm','nativeOrder')){B264Need (B264Same $oldSettings.components.$component $newSettings.components.$component)}\n"+actual.slice(end),expected);
});
test('SUP20D contract accepts only exact new metadata; legacy eb5 stays isolated and drift is rejected',windows,()=>{
 const root=String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018`,f=sup20DFixture('new'),old=sup20DFixture('old'),p=root+'\\MelisaERP-P03-profile-'+ 'a'.repeat(32)+'.json',b=root+'\\MelisaERP-P03-before-'+ 'a'.repeat(32)+'.json';
 const encoded=x=>Buffer.from(JSON.stringify(x)).toString('base64'),reset=`$f=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded(f)}'))|ConvertFrom-Json`,call=name=>`${name} $f.profile $f.before $f.old $f.next ${q(p)} ${q(b)} '${'b'.repeat(64)}' ([DateTime]::Parse('2026-10-20T10:02:00Z'))`;
 const mutations=["$f.profile.protectedProcesses=@($f.profile.protectedProcesses[1])","$f.profile.protectedProcesses+=,$f.profile.protectedProcesses[0]","$f.next.components.crm.config.path+='x'","$f.old.components.crm.config.path+='x'","$f.next.components.crm.config.sha256='d'*64","$f.next.components.crm.config|Add-Member NoteProperty unknown $true","$f.next.components.crm|Add-Member NoteProperty unknown $true","$f.profile.newSettings.sha256='d'*64","$f.next.supervisor.sourceCommit='f'*40","$f.next.supervisor.manifestSha256='f'*64","$f.next.supervisor.packageRoot+='x'","$f.before.actualT1=$true","$f.before.copyId='other'","$f.before.observedAt='2026-10-20T09:00:00Z'","$f.profile.newSettings.path+='x'","$f.profile.packages+=,$f.profile.packages[0]","$f.before.identities.erpApi.pid=1","$f.profile.protectedProcesses=@()"];
 const out=run(`${extract(['AssertB264InspectionContract','AssertB264Sup20DInspectionContract'])}\n${reset};${call('AssertB264Sup20DInspectionContract')};'NEW_VALID'\ntry{${call('AssertB264InspectionContract')};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'CROSS_REJECTED'}\n$f=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded(old)}'))|ConvertFrom-Json;${call('AssertB264InspectionContract')};'OLD_VALID'\ntry{${call('AssertB264Sup20DInspectionContract')};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'CROSS_REJECTED'}\n${mutations.map(m=>`${reset};${m};try{${call('AssertB264Sup20DInspectionContract')};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'DRIFT_REJECTED'}`).join('\n')}`);
 assert.match(out,/NEW_VALID/);assert.match(out,/OLD_VALID/);assert.equal((out.match(/CROSS_REJECTED/g)??[]).length,2);assert.equal((out.match(/DRIFT_REJECTED/g)??[]).length,mutations.length);
});

function currentB007ContractFixture(){
 const f=sup20DFixture('new'),runtime=String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon`;
 const erp={packageRoot:String.raw`C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261020-6dc33f41`,sourceCommit:'6dc33f41737349c6e3f17fb867a451b570a00acc',manifestSha256:'6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49'};
 const crm={packageRoot:String.raw`C:\Sirket\CRM\releases\node-v24.19.0\crm-shared-test-d1e4425206249e38445fb103e03601f86baa84ec`,sourceCommit:'d1e4425206249e38445fb103e03601f86baa84ec',manifestSha256:'a0e86fccbdb95eeb97e4dc08e383db7bf8f12a29b040f34a78f6c37e3093b5ef'};
 const sup={packageRoot:String.raw`C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-da5b39491994`,sourceCommit:'da5b394919941f73b9d7098f146fffd362c2a955',manifestSha256:'b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf'};
 Object.assign(f.next.components.erpApiNative,erp);Object.assign(f.next.components.crm,crm);Object.assign(f.next.supervisor,sup);
 f.old.components.hub=structuredClone(f.old.components.erpApiNative);f.next.components.hub=structuredClone(f.next.components.erpApiNative);
 for(const s of[f.old,f.next])s.node={path:String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`,sha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'};
 f.next.components.crm.config={path:runtime+'\\crm-activation-crm06-staff-d1e442520624-erp-6dc33f417373-current.json',sha256:'0ef6eb422be2522743753d2b2d9f24f3cbf5c6a3d8b45a904540478e112a3449'};
 Object.assign(f.profile.newSettings,{path:runtime+'\\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json',sha256:'800329af39652d7fcf111a2b8441d7a00cb0bef94b37668e2ed261e4324ba329'});f.before.newConfig=f.profile.newSettings;f.before.plan.newSettingsSha256=f.profile.newSettings.sha256;
 for(const [key,value]of[['erp',f.next.components.erpApiNative],['crm',f.next.components.crm],['supervisor',f.next.supervisor]])Object.assign(f.before.profile,{[key+'Source']:value.sourceCommit,[key+'Manifest']:value.manifestSha256});
 const packages=new Map();for(const s of[f.old,f.next])for(const c of[...Object.values(s.components),s.supervisor])packages.set(c.packageRoot,{root:c.packageRoot,sourceCommit:c.sourceCommit,manifestSha256:c.manifestSha256,manifestPath:c.packageRoot+'\\release-manifest.json'});f.profile.packages=[...packages.values()];return f;
}
test('CurrentB007 inspection contract preserves seven exact packages, literal activation and all old ownership gates',windows,()=>{
 const f=currentB007ContractFixture(),root=String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018`,p=root+'\\MelisaERP-P03-profile-'+f.before.runId+'.json',b=root+'\\MelisaERP-P03-before-'+f.before.runId+'.json',encoded=Buffer.from(JSON.stringify(f)).toString('base64'),reset=`$f=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json`,call=`AssertCurrentB007InspectionContract $f.profile $f.before $f.old $f.next ${q(p)} ${q(b)} '${'b'.repeat(64)}' ([DateTime]::Parse('2026-10-20T10:02:00Z'))`;
 const changes=["$f.next.components.crm.config.sha256='0'*64","$f.next.components.crm.config.path+='x'","$f.old.components.crm.config.sha256='0'*64","$f.next.components.crm.manifestSha256='0'*64","$f.next.components.erpApiNative.sourceCommit='0'*40","$f.next.supervisor.sourceCommit='0'*40","$f.next.node.path='C:\\Program Files\\nodejs\\node.exe'","$f.next.node.sha256='0'*64","$f.profile.newSettings.sha256='0'*64","$f.profile.packages+=,$f.profile.packages[0]","$f.before.ownerSid='other'","$f.before.observedAt='2026-10-20T09:00:00Z'","$f.before.actualT1=$true","$f.profile.protectedProcesses=@()","$f.before.identities.erpApi.pid=1"];
 const out=run(`${extract(['AssertCurrentB007InspectionContract'])}\n${reset};${call};'CURRENT_VALID'\n${changes.map(change=>`${reset};${change};try{${call};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}`).join('\n')}`);
 assert.match(out,/CURRENT_VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,changes.length);
});
test('CurrentB007 recovery settings function preserves the exact seven-package scope without granting dispatcher authority',windows,()=>{
 const f=currentB007ContractFixture(),encoded=Buffer.from(JSON.stringify(f)).toString('base64'),reset=`$f=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json`,call='Assert-CurrentB007RecoverySettings $f.profile $f.old $f.next';
 const changes=["$f.next.components.crm.config.sha256='0'*64","$f.next.components.crm.config.path+='x'","$f.old.components.crm.config.sha256='0'*64","$f.next.components.crm.manifestSha256='0'*64","$f.next.components.erpApiNative.packageRoot+='x'","$f.next.supervisor.sourceCommit='0'*40","$f.next.node.path='C:\\Program Files\\nodejs\\node.exe'","$f.profile.packages+=,$f.profile.packages[0]","$f.next.actualT1=$true","$f.next.copyId='other'","$f.next.components.nativeOrder.sourceCommit='0'*40"];
 const empty=fileURLToPath(new URL('./p03-pr54-new-owner-empty-recovery.ps1',import.meta.url)),out=run(`${extract(['Require-NewDrain','Assert-CurrentB007RecoverySettings'],empty)}\n${reset};${call};'CURRENT_RECOVERY_VALID'\n${changes.map(change=>`${reset};${change};try{${call};throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}`).join('\n')}`);
 assert.match(out,/CURRENT_RECOVERY_VALID/);assert.equal((out.match(/REJECTED/g)??[]).length,changes.length);
});


test('post-cut frozen and NEW candidate readers preserve protected TEST consoles as raw non-owned rows without broad foreign exemptions',windows,()=>{
 const newer=fileURLToPath(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url)),v2=fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url));
 const out=run(`${extract(['CandidateInventoryCore'],v2,{CandidateInventoryCore:'FrozenCandidateInventoryCore'})}\n${extract(['NewCandidateInventoryCore'],newer)}\n${String.raw`
function Need($v,$code){if(-not$v){throw ('P03_PHYSICAL_'+$code)}}
function ProtectedProcesses($i){$script:protectedReads++;if(@($i.all|Where-Object{$_.ProcessId-eq800}).Count-ne1){throw 'FIXTURE_PARENT'}}
function Inventory{return $script:raw}
function AssertOldPidLifetimes($i){return @()}
function NewHistoricalOldPidRelevant($p,$old,$i,$e){return $p.ProcessId-in$old}
function IsWatcherCommand($c){return $false}
function ConsoleAuxiliaries($i,$selected){if(@($selected).Count){throw 'FIXTURE_OWNED_SELECTION'};return @()}
$script:owner='owner';$script:isRehearsal=$false;$script:tasksStopRequested=$false;$script:protectedReads=0
$script:profile=[pscustomobject]@{oldWatchers=@([pscustomobject]@{pid=1},[pscustomobject]@{pid=2});candidateRules=@();packages=@([pscustomobject]@{root='C:\managed'});protectedProcesses=@([pscustomobject]@{pid=800})}
$script:before=[pscustomobject]@{identities=[pscustomobject]@{hub=[pscustomobject]@{pid=3}};tasks=@()}
$script:consolePins=@{};$script:protectedConsolePins=@{900=[pscustomobject]@{pid=900;parentPid=800}}
$parent=[pscustomobject]@{ProcessId=800;ParentProcessId=0;CommandLine='node C:\protected-test125\server.js'}
$console=[pscustomobject]@{ProcessId=900;ParentProcessId=800;CommandLine='\??\C:\Windows\System32\conhost.exe 0x4'}
$script:raw=[pscustomobject]@{all=@($parent,$console);listeners=@();instances=@()};$e=[pscustomobject]@{processes=@()}
foreach($fn in @('FrozenCandidateInventoryCore','NewCandidateInventoryCore')){
 $json=$raw|ConvertTo-Json -Depth 8 -Compress;$seen=&$fn $e
 if($seen.inventory.all.Count-ne2-or$seen.selected.Count-ne0-or$script:consolePins.Count-ne0-or$script:admittedExitPins.Count-ne0-or($raw|ConvertTo-Json -Depth 8 -Compress)-cne$json){throw 'FIXTURE_PROTECTED_BECAME_OWNED'}
 'RAW_ONLY='+$fn
 $parent.CommandLine='node C:\managed\foreign.js'
 try{&$fn $e|Out-Null;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};if($_.Exception.Message-cne'P03_PHYSICAL_FOREIGN_PROCESS'){throw};'FOREIGN_REJECTED'}
 $parent.CommandLine='node C:\protected-test125\server.js'
}
if($protectedReads-ne4){throw 'FIXTURE_PROTECTED_NOT_RECHECKED'}
`}`);
 assert.equal((out.match(/RAW_ONLY=/g)??[]).length,2);assert.equal((out.match(/FOREIGN_REJECTED/g)??[]).length,2);
});
