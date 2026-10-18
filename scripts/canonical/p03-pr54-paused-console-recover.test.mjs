import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('./p03-pr54-paused-old-recover.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const extract=names=>`
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(source)},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'FIXTURE_SOURCE_PARSE'}
foreach($name in @(${names.map(quote).join(',')})){
 $defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true))
 if($defs.Count -ne 1){throw ('FIXTURE_FUNCTION_MISSING_'+$name)}
 . ([scriptblock]::Create($defs[0].Extent.Text))
}`;
const run=code=>{
 try{return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}`,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000,windowsHide:true,stdio:['ignore','pipe','pipe']});}
 catch(error){const message=String(error.stderr??'').match(/(?:FIXTURE|P03)_[A-Z_]+/u)?.[0]??'WINDOWS_FIXTURE_FAILED';throw Error(message);}
};

const fixture=String.raw`
function Need($v,$code){if(-not $v){throw ('FIXTURE_REJECT_'+$code)}}
function NoReparse($path){Need ($path -ieq 'C:\Windows\System32\conhost.exe') 'FIXTURE_BINARY_PATH'}
function Get-FileHash{param($LiteralPath,$Algorithm);[pscustomobject]@{Hash=$script:binaryHash}}
function Get-AuthenticodeSignature{param($LiteralPath);[pscustomobject]@{Status=$script:signatureStatus;SignerCertificate=[pscustomobject]@{Subject=$script:signer}}}
function Identity($actual,$expected){
 return $actual.ProcessId -eq $expected.pid -and $actual.ParentProcessId -eq $expected.parentPid -and $actual.ExecutablePath -ieq $expected.nodePath -and $actual.CommandLine -ceq $expected.commandLine -and $actual.OwnerSid -ceq $expected.ownerSid -and $actual.CreationDate.ToUniversalTime().Ticks -eq [DateTime]::Parse($expected.creationTime).ToUniversalTime().Ticks
}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction);$id=[int]($Filter -replace '^ProcessId=','');return @($script:inv.all|Where-Object{$_.ProcessId -eq $id})}
function ResetFixture{
 $script:binaryHash='c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac'
 $script:signatureStatus='Valid';$script:signer='CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'
 $script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 $script:legacyConsolePins=@{};$script:consolePins=@{};$script:probePins=@{}
 $script:tasksStopRequested=$false;$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false
 $script:watcher=[pscustomobject]@{role='terminalWatcher';pid=53356;parentPid=100;nodePath='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';ownerSid=$owner;commandLine='captured-old-watcher';creationTime='2026-10-16T22:56:21.0723420Z'}
 $script:profile=[pscustomobject]@{oldWatchers=@($watcher,[pscustomobject]@{role='hubWatcher';pid=49164;parentPid=100;nodePath=$watcher.nodePath;ownerSid=$owner;commandLine='captured-hub-watcher';creationTime=$watcher.creationTime});packages=@()}
 $script:core=[pscustomobject]@{pid=49908;parentPid=53356;nodePath='C:\fixture\node.exe';commandLine='captured-core';ownerSid=$owner;creationTime='2026-10-16T22:56:21.1050000Z';bindings=@()}
 $script:before=[pscustomobject]@{observedAt='2026-10-18T10:00:00.0000000Z';identities=[pscustomobject]@{coreSupervisor=$core}}
 $script:child=[pscustomobject]@{ProcessId=42036;ParentProcessId=53356;Name='conhost.exe';ExecutablePath='C:\Windows\System32\conhost.exe';CommandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';CreationDate=[DateTime]::Parse('2026-10-16T22:56:21.0862000Z').ToUniversalTime();OwnerSid=$owner}
 $script:inv=[pscustomobject]@{all=@($child);allListeners=@();listeners=@();instances=@()}
}
function ExpectRejected([string]$name,[scriptblock]$action){
 try{& $action}catch{if($_.Exception.Message -match '^FIXTURE_FUNCTION_MISSING|^FIXTURE_SOURCE_PARSE'){throw};Write-Output ('REJECTED='+$name);return}
 throw ('FIXTURE_ACCEPTED_BAD_'+$name)
}
ResetFixture
`;

test('legacy console uses the real AST function and the captured orphan survives admission without synthetic parent',windows,()=>{
 const out=run(`${fixture}\n${extract(['LegacyConsoleAuxiliaries'])}\n$ids=@(LegacyConsoleAuxiliaries $inv);'IDS='+($ids -join ',');'PINS='+$script:legacyConsolePins.Count;'REGULAR='+$script:consolePins.Count;'PARENT='+@($inv.all|Where-Object{$_.ProcessId -eq 53356}).Count;[void](LegacyConsoleAuxiliaries $inv);'CACHED='+$script:legacyConsolePins.Count`);
 assert.match(out,/IDS=42036/);assert.match(out,/PINS=1/);assert.match(out,/REGULAR=0/);assert.match(out,/PARENT=0/);assert.match(out,/CACHED=1/);
});

test('legacy admission rejects altered parent birth owner binary signature listeners and live watcher PID reuse',windows,()=>{
 const cases=[
  ['parent',"$child.ParentProcessId=49164"],
  ['birth',"$child.CreationDate=$child.CreationDate.AddTicks(1)"],
  ['owner',"$child.OwnerSid='S-1-5-18'"],
  ['path',"$child.ExecutablePath='C:\\foreign\\conhost.exe'"],
  ['argv',"$child.CommandLine+=' extra'"],
  ['hash',"$script:binaryHash='0'*64"],
  ['signature',"$script:signatureStatus='NotSigned'"],
  ['signer',"$script:signer='CN=Other'"],
  ['listener',"$inv.allListeners=@([pscustomobject]@{OwningProcess=42036;LocalPort=65000})"],
  ['watcher-reuse',"$inv.all+=,[pscustomobject]@{ProcessId=53356;ParentProcessId=1;Name='powershell.exe';CreationDate=[DateTime]::Parse('2026-10-18T11:00:00Z')}"],
  ['missing-watcher',"$profile.oldWatchers=@($profile.oldWatchers[1])"],
  ['watcher-after-child',"$watcher.creationTime='2026-10-16T22:56:21.1000000Z'"],
  ['before-child',"$before.observedAt='2026-10-16T22:56:21.0800000Z'"],
  ['core-parent',"$core.parentPid=49164"]
 ];
 const body=cases.map(([name,edit])=>`ResetFixture;${edit};ExpectRejected '${name}' {LegacyConsoleAuxiliaries $inv}`).join('\n');
 const out=run(`${fixture}\n${extract(['LegacyConsoleAuxiliaries'])}\n${body}`);
 for(const [name]of cases)assert.match(out,new RegExp('REJECTED='+name+'(?:\\r?\\n|$)'));
});

test('cached legacy console PID reuse is rejected and an unrelated console cannot enter its cache',windows,()=>{
 const out=run(`${fixture}\n${extract(['LegacyConsoleAuxiliaries'])}\n[void](LegacyConsoleAuxiliaries $inv);$child.CreationDate=$child.CreationDate.AddTicks(1);ExpectRejected 'cached-reuse' {LegacyConsoleAuxiliaries $inv};ResetFixture;$child.ProcessId=42037;[void](LegacyConsoleAuxiliaries $inv);'UNKNOWN_PINS='+$script:legacyConsolePins.Count`);
 assert.match(out,/REJECTED=cached-reuse/);assert.match(out,/UNKNOWN_PINS=0/);
});

test('the real first and remaining classifiers retain all eight old roles and the shared console after the core exits',windows,()=>{
 const out=run(`${fixture}\n${extract(['LegacyConsoleAuxiliaries','PausedOldCore','PausedRemainingCore'])}\n${String.raw`
 function Authority{};function PrepareProbeSource{};function ProtectedProcesses($inv){};function Health($selected){}
 function PausedTasks{return $script:inv};function ConsoleAuxiliaries($inv,$selected){return @()};function ProbeAuxiliaries($inv){return @()};function IsWatcherCommand($command){return $false}
 function ProcessFor($pin){return [pscustomobject]@{ProcessId=$pin.pid;ParentProcessId=$pin.parentPid;Name='node.exe';ExecutablePath=$pin.nodePath;CommandLine=$pin.commandLine;OwnerSid=$pin.ownerSid;CreationDate=[DateTime]::Parse($pin.creationTime).ToUniversalTime()}}
 $script:order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
 $appPids=@(49908,23272,15416,10344,32112,30080,31604,48100)
 for($i=1;$i -lt $order.Count;$i++){$pin=[pscustomobject]@{pid=$appPids[$i];parentPid=49908;nodePath='C:\fixture\node.exe';commandLine=('captured-'+$order[$i]);ownerSid=$owner;creationTime='2026-10-16T22:56:22.0000000Z';bindings=@()};$before.identities|Add-Member NoteProperty $order[$i] $pin}
 $script:inv.all=@($child)+@($order|ForEach-Object{ProcessFor $before.identities.$_})
 $script:drainedPids=@();'START='+@(PausedOldCore).Count
 $script:inv.all=@($inv.all|Where-Object{$_.ProcessId -ne $core.pid});$script:drainedPids=@($core.pid);$script:coreQuiesced=$true;$script:tasksStopRequested=$true
 [void](PausedRemainingCore);'AFTER_CORE_CONSOLE='+$script:legacyConsolePins.Count
 $inv.all+=,[pscustomobject]@{ProcessId=62000;ParentProcessId=53356;Name='foreign.exe';CommandLine='foreign'}
 ExpectRejected 'orphan-watcher-descendant' {PausedRemainingCore}
 ResetFixture;$inv.all+=,[pscustomobject]@{ProcessId=62000;ParentProcessId=42036;Name='foreign.exe';CommandLine='foreign'}
 $script:order=@('coreSupervisor');$inv.all+=,(ProcessFor $core)
 ExpectRejected 'console-descendant' {PausedOldCore}
 `}`);
 assert.match(out,/START=8/);assert.match(out,/AFTER_CORE_CONSOLE=1/);assert.match(out,/REJECTED=orphan-watcher-descendant/);assert.match(out,/REJECTED=console-descendant/);
});

test('legacy absence waits for a natural exit and refuses a reused console PID without stopping any process',windows,()=>{
 const out=run(`${fixture}\n${extract(['LegacyConsoleAuxiliaries','WaitLegacyConsoleAbsence'])}\n${String.raw`
 [void](LegacyConsoleAuxiliaries $inv)
 $script:captures=0;$script:sleeps=0
 function PausedRemaining{$script:captures++;if($script:captures -ge 3){return [pscustomobject]@{all=@();allListeners=@();listeners=@();instances=@()}};[void](LegacyConsoleAuxiliaries $script:inv);return $script:inv}
 function Start-Sleep{param($Milliseconds);$script:sleeps++}
 function Stop-Process{throw 'FIXTURE_FORBIDDEN_PROCESS_STOP'}
 WaitLegacyConsoleAbsence;'NATURAL_CAPTURES='+$script:captures;'NATURAL_SLEEPS='+$script:sleeps
 ResetFixture;[void](LegacyConsoleAuxiliaries $inv);$child.CreationDate=$child.CreationDate.AddTicks(1);$script:captures=0
 ExpectRejected 'absence-pid-reuse' {WaitLegacyConsoleAbsence}
 `}`);
 assert.match(out,/NATURAL_CAPTURES=3/);assert.match(out,/NATURAL_SLEEPS=2/);assert.match(out,/REJECTED=absence-pid-reuse/);
});

test('global empty proof rejects cached legacy PID reuse and its orphan descendant even after the console disappeared',windows,()=>{
 const out=run(`${fixture}\n${extract(['LegacyConsoleAuxiliaries','PausedEmpty'])}\n${String.raw`
 function Inventory{return $script:inv};function ProtectedProcesses($inv){};function AssertEmpty($inv){}
 [void](LegacyConsoleAuxiliaries $inv)
 $inv.all=@();PausedEmpty;'NATURAL_EMPTY'
 $inv.all=@([pscustomobject]@{ProcessId=42036;ParentProcessId=1});ExpectRejected 'global-reused-pid' {PausedEmpty}
 $inv.all=@([pscustomobject]@{ProcessId=62000;ParentProcessId=42036});ExpectRejected 'global-orphan-child' {PausedEmpty}
 `}`);
 assert.match(out,/NATURAL_EMPTY/);assert.match(out,/REJECTED=global-reused-pid/);assert.match(out,/REJECTED=global-orphan-child/);
});

test('authority refuses a previous core cut result advanced journal or changed failed evidence before any new attempt',windows,()=>{
 const out=run(`${fixture}\n${extract(['Authority'])}\n${String.raw`
 $ProfilePath='C:\fixture\profile.json';$ProfileSha256='profile';$BeforeImagePath='C:\fixture\before.json';$BeforeImageSha256='before';$engine='C:\fixture\engine.ps1';$engineSha='engine';$base='C:\fixture';$dir='C:\fixture\transition'
 $profile|Add-Member NoteProperty journalDirectory 'C:\fixture\journal'
 $pins=@(@('paused-old-recovery-intent.json','6eb43d46509faeb8bef1b740c19d8410a33699232137a27576522be02f68f263'),@('paused-old-recovery-failed.json','6bf3d88d0c866ae0c7c1f83df044e9b64f427e1565be6f82f5f6bbca8e0241b8'))
 $script:marker='';$script:journalAdvanced=$false;$script:tamper=$false;$script:reads=@()
 function BootPin($path,$hash){if($script:tamper -and $path.EndsWith('paused-old-recovery-failed.json')){throw 'FIXTURE_PIN_HASH'};$script:reads+=,$path;return ,@()}
 function Get-ChildItem{param($LiteralPath,$Filter,[switch]$File,[switch]$Force);if($LiteralPath -eq $profile.journalDirectory){if($script:journalAdvanced){return 'unexpected-event'};return @()};return @('event-0000.json','event-0001.json')}
 function Test-Path{param($LiteralPath);return $script:marker -and $LiteralPath.EndsWith($script:marker)}
 Authority;'AUTHORITY_OK';'PRIOR_READS='+@($script:reads|Where-Object{$_ -match 'paused-old-recovery-(intent|failed)\.json$'}).Count
 foreach($marker in @('paused-old-core-cut-observation.json','paused-old-recovery-result.json')){$script:marker=$marker;ExpectRejected $marker {Authority}}
 $script:marker='';$script:journalAdvanced=$true;ExpectRejected 'journal-advanced' {Authority}
 $script:journalAdvanced=$false;$script:tamper=$true;ExpectRejected 'prior-failure-tamper' {Authority}
 `}`);
 assert.match(out,/AUTHORITY_OK/);assert.match(out,/PRIOR_READS=2/);assert.match(out,/REJECTED=paused-old-core-cut-observation.json/);assert.match(out,/REJECTED=paused-old-recovery-result.json/);assert.match(out,/REJECTED=journal-advanced/);assert.match(out,/REJECTED=prior-failure-tamper/);
});

const probeFixture=String.raw`
function ResetProbeFixture{
 ResetFixture
 $profile|Add-Member NoteProperty shell ([pscustomobject]@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'})
 $script:probePath='C:\fixture\hub-stack-process-probe.ps1'
 $script:probe=[pscustomobject]@{ProcessId=61000;ParentProcessId=$core.pid;Name='powershell.exe';ExecutablePath='';CommandLine='';CreationDate=[DateTime]::Parse($core.creationTime).ToUniversalTime().AddSeconds(1);OwnerSid=$owner}
 $script:parent=[pscustomobject]@{ProcessId=$core.pid;ParentProcessId=$core.parentPid;Name='node.exe';ExecutablePath=$core.nodePath;CommandLine=$core.commandLine;CreationDate=[DateTime]::Parse($core.creationTime).ToUniversalTime();OwnerSid=$owner}
 $script:inv.all=@($parent,$probe);$script:fresh=@();$script:freshReads=0
}
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction);$script:freshReads++;return $script:fresh}
function Tokens($line){return @($line)}
function ProbeArgumentsAllowed($argv,$path){return $false}
function ProbeOutcome{
 try{$rows=@(ProbeAuxiliaries $inv);return ('ADMITTED='+$rows.Count)}catch{return $_.Exception.Message}
}
ResetProbeFixture
`;

test('vanished uncached probe with missing binary or command requests whole-inventory recapture without adding a pin',windows,()=>{
 const out=run(`${fixture}\n${extract(['ProbeAuxiliaries'])}\n${probeFixture}\n${String.raw`
 'EMPTY_BINARY='+(ProbeOutcome);'BINARY_PINS='+$script:probePins.Count;'BINARY_READS='+$script:freshReads
 ResetProbeFixture;$probe.ExecutablePath=$profile.shell.path
 'EMPTY_COMMAND='+(ProbeOutcome);'COMMAND_PINS='+$script:probePins.Count;'COMMAND_READS='+$script:freshReads
 `}`);
 assert.match(out,/EMPTY_BINARY=P03_PAUSED_PROBE_EXIT_RECAPTURE/);assert.match(out,/EMPTY_COMMAND=P03_PAUSED_PROBE_EXIT_RECAPTURE/);
 assert.match(out,/BINARY_PINS=0/);assert.match(out,/COMMAND_PINS=0/);assert.match(out,/BINARY_READS=1/);assert.match(out,/COMMAND_READS=1/);
});

test('missing-field probe retry never admits live reused foreign wrong-parent or pre-parent-birth processes',windows,()=>{
 const out=run(`${fixture}\n${extract(['ProbeAuxiliaries'])}\n${probeFixture}\n${String.raw`
 $script:fresh=@($probe);'LIVE='+(ProbeOutcome)
 ResetProbeFixture;$probe.ExecutablePath=$profile.shell.path;$script:fresh=@($probe);'LIVE_COMMAND='+(ProbeOutcome)
 ResetProbeFixture;$script:fresh=@([pscustomobject]@{ProcessId=$probe.ProcessId;CreationDate=$probe.CreationDate.AddSeconds(1)});'REUSED='+(ProbeOutcome)
 ResetProbeFixture;$probe.ExecutablePath='C:\foreign\powershell.exe';'FOREIGN='+(ProbeOutcome)
 ResetProbeFixture;$parent.OwnerSid='S-1-5-18';'PARENT='+(ProbeOutcome)
 ResetProbeFixture;$probe.CreationDate=[DateTime]::Parse($core.creationTime).ToUniversalTime().AddTicks(-1);'BIRTH='+(ProbeOutcome)
 ResetProbeFixture;$probe.ParentProcessId=62000;'UNRELATED='+(ProbeOutcome)
 'FINAL_PINS='+$script:probePins.Count
 `}`);
 for(const name of ['LIVE','REUSED','FOREIGN','BIRTH'])assert.match(out,new RegExp(name+'=FIXTURE_REJECT_PAUSED_PROBE_BINARY'));
 assert.match(out,/LIVE_COMMAND=FIXTURE_REJECT_PAUSED_PROBE_ARGV/);
 assert.match(out,/PARENT=FIXTURE_REJECT_PAUSED_PROBE_PARENT/);assert.match(out,/UNRELATED=ADMITTED=0/);assert.match(out,/FINAL_PINS=0/);
});

test('core probe wait excludes six authenticated OLD children but waits for admitted probes and rejects foreign or reused children',windows,()=>{
 const out=run(`${fixture}\n${extract(['LegacyConsoleAuxiliaries','ProbeAuxiliaries','PausedRemainingCore','WaitCoreProbeAbsence'])}\n${String.raw`
 function Authority{};function PrepareProbeSource{};function ProtectedProcesses($inv){};function ConsoleAuxiliaries($inv,$selected){return @()};function IsWatcherCommand($command){return $false}
 function ProcessFor($pin){return [pscustomobject]@{ProcessId=$pin.pid;ParentProcessId=$pin.parentPid;Name='node.exe';ExecutablePath=$pin.nodePath;CommandLine=$pin.commandLine;OwnerSid=$pin.ownerSid;CreationDate=[DateTime]::Parse($pin.creationTime).ToUniversalTime()}}
 function Start-Sleep{param($Milliseconds);Need ($Milliseconds -eq 250) 'CORE_WAIT_DELAY';$script:sleeps++}
 function Stop-Process{throw 'FIXTURE_FORBIDDEN_PROCESS_STOP'}
 function PausedTasks{
  $script:captures++
  if($script:probeExitAt -and $script:captures -ge $script:probeExitAt){$script:inv.all=@($script:inv.all|Where-Object{$_.ProcessId -ne 61000})}
  return $script:inv
 }
 function PausedRemaining{return PausedRemainingCore}
 function ResetCoreWaitFixture{
  ResetFixture
  $script:order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
  $appPids=@(49908,23272,15416,10344,32112,30080,31604,48100)
  for($i=1;$i -lt $order.Count;$i++){
   $parentPid=if($i -eq 1){49164}else{49908}
   $pin=[pscustomobject]@{pid=$appPids[$i];parentPid=$parentPid;nodePath='C:\fixture\node.exe';commandLine=('captured-'+$order[$i]);ownerSid=$owner;creationTime='2026-10-16T22:56:22.0000000Z';bindings=@()}
   $before.identities|Add-Member NoteProperty $order[$i] $pin
  }
  $script:inv.all=@($child)+@($order|Where-Object{$_ -ne 'coreSupervisor'}|ForEach-Object{ProcessFor $before.identities.$_})
  $script:drainedPids=@($core.pid);$script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$script:tasksStopRequested=$true
  $script:probePath='C:\fixture\hub-stack-process-probe.ps1';$script:captures=0;$script:sleeps=0;$script:probeExitAt=0
 }
 ResetCoreWaitFixture
 'AUTHENTICATED_CORE_CHILDREN='+@($inv.all|Where-Object{$_.ParentProcessId -eq $core.pid}).Count
 WaitCoreProbeAbsence;'OLD_ONLY_CAPTURES='+$script:captures;'OLD_ONLY_SLEEPS='+$script:sleeps
 ResetCoreWaitFixture
 $probePin=[pscustomobject]@{pid=61000;parentPid=$core.pid;nodePath='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';ownerSid=$owner;commandLine='captured-readonly-probe';creationTime='2026-10-16T22:56:23.0000000Z'}
 $script:probePins[61000]=$probePin;$p=ProcessFor $probePin;$p.Name='powershell.exe';$inv.all+=,$p;$script:probeExitAt=3
 WaitCoreProbeAbsence;'PROBE_CAPTURES='+$script:captures;'PROBE_SLEEPS='+$script:sleeps;'PROBE_CACHE='+$script:probePins.Count
 ResetCoreWaitFixture;$inv.all+=,[pscustomobject]@{ProcessId=62000;ParentProcessId=$core.pid;Name='foreign.exe';CommandLine='foreign'}
 try{WaitCoreProbeAbsence;throw 'FIXTURE_FOREIGN_ACCEPTED'}catch{'FOREIGN='+$_.Exception.Message}
 ResetCoreWaitFixture;$changed=@($inv.all|Where-Object{$_.ProcessId -eq 15416})[0];$changed.CreationDate=$changed.CreationDate.AddTicks(1)
 try{WaitCoreProbeAbsence;throw 'FIXTURE_REUSED_OLD_ACCEPTED'}catch{'REUSED_OLD='+$_.Exception.Message}
 `}`);
 assert.match(out,/AUTHENTICATED_CORE_CHILDREN=6/);assert.match(out,/OLD_ONLY_CAPTURES=1/);assert.match(out,/OLD_ONLY_SLEEPS=0/);
 assert.match(out,/PROBE_CAPTURES=3/);assert.match(out,/PROBE_SLEEPS=2/);assert.match(out,/PROBE_CACHE=1/);
 assert.match(out,/FOREIGN=FIXTURE_REJECT_PAUSED_DRAIN_FOREIGN_PROCESS/);assert.match(out,/REUSED_OLD=FIXTURE_REJECT_PAUSED_REMAINING_IDENTITY/);
});

test('recovery source keeps failed evidence pinned and creates a distinct one-shot console attempt',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037/);
 assert.ok(/6eb43d[a-f0-9]{54}f263/.test(s),'original failed intent remains pinned');assert.ok(/6bf3[a-f0-9]{56}41b8/.test(s),'original failed result remains pinned');
 assert.match(s,/paused-old-console-recovery-intent\.json/);assert.match(s,/paused-old-console-recovery-failed\.json/);assert.match(s,/paused-old-console-recovery-result\.json/);
 assert.doesNotMatch(s,/Remove-Item|Unregister-ScheduledTask|Stop-Process|taskkill/i);
 const dry=s.indexOf("if($Mode -ceq 'DryRun')"),intent=s.indexOf("WriteEvidence 'paused-old-console-recovery-intent.json'");
 assert.ok(dry>=0&&intent>dry);assert.ok(s.includes('paused-old-core-cut-observation.json'));
 assert.match(s,/\$order=@\('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative'\)/);
 assert.ok(s.indexOf('WaitLegacyConsoleAbsence')>=0);
 assert.ok(s.lastIndexOf('WaitLegacyConsoleAbsence')>s.indexOf('$script:capturedCandidatePids='),'legacy console is awaited after the application drain');
 assert.ok(s.lastIndexOf('WaitLegacyConsoleAbsence')<s.lastIndexOf('WaitConsoleAbsence;PausedEmpty'),'all console absences precede the global empty gate');
 assert.ok(/AddSeconds\(20\)/.test(s)&&/Start-Sleep -Milliseconds 250/.test(s),'absence wait is bounded and yields between observations');
});
