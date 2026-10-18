import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-paused-old-recover.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};
const ps=code=>execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8'});
test('paused helper parses without executing any dispatcher',windows,()=>{
 const code=`$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile('${source.replaceAll("'","''")}',[ref]$tokens,[ref]$errors);$errors.Count`;assert.equal(ps(code).trim(),'0');
});
test('paused helper retains finite source authority, default DryRun and canonical drain order',()=>{
 const s=readFileSync(source,'utf8');assert.match(s,/\$Mode='DryRun'/);assert.match(s,/639e2da815e1e7ac0f1c0d04d7f7bdc3/);assert.match(s,/fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037/);
 assert.match(s,/\$order=@\('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative'\)/);assert.doesNotMatch(s,/Remove-Item|Unregister-ScheduledTask|Start-Process|\.Run\(\$null\)/);
 assert.ok(s.indexOf("if($Mode -ceq 'DryRun')")<s.indexOf("WriteEvidence 'paused-old-console-recovery-intent.json'"));assert.ok(s.indexOf("WriteEvidence 'paused-old-console-recovery-intent.json'")<s.indexOf("foreach($role in $order){",s.indexOf("$intentWritten=$true;")));
});
test('empty gate rejects globally reused captured watcher PID and orphan child even absent from observer',windows,()=>{
 const s=readFileSync(source,'utf8');const fn=s.slice(s.indexOf('function PausedEmpty{'),s.indexOf('$selected=PausedOld'));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 function Need($v,$c){if(-not $v){throw ('P03_PHYSICAL_'+$c)}};function ProtectedProcesses($i){};function AssertEmpty($i){};function Inventory{return [pscustomobject]@{all=$script:all}}
 ${fn}
 $before=[pscustomobject]@{identities=[pscustomobject]@{hub=[pscustomobject]@{pid=10}}};$profile=[pscustomobject]@{oldWatchers=@([pscustomobject]@{pid=20})};$script:consolePins=@{};$script:probePins=@{};$script:legacyConsolePins=@{}
 $script:all=@([pscustomobject]@{ProcessId=99;ParentProcessId=1});PausedEmpty;'EMPTY'
 $script:probePins=@{30=[pscustomobject]@{pid=30}};foreach($row in @([pscustomobject]@{ProcessId=20;ParentProcessId=1},[pscustomobject]@{ProcessId=21;ParentProcessId=20},[pscustomobject]@{ProcessId=31;ParentProcessId=30})){$script:all=@($row);try{PausedEmpty}catch{$_.Exception.Message}}`;
 const out=ps(code);assert.match(out,/EMPTY/);assert.equal((out.match(/PAUSED_OLD_DESCENDANT_REMAINS/g)||[]).length,3);
});

test('each drain rechecks descendant closure and refuses newly introduced foreign child',windows,()=>{
 const s=readFileSync(source,'utf8');const fn=s.slice(s.indexOf('function PausedRemaining{'),s.indexOf('function PausedEmpty{'));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 function Need($v,$c){if(-not $v){throw ('P03_PHYSICAL_'+$c)}};function Authority{};function PrepareProbeSource{};function PausedTasks{return $script:inv};function ProtectedProcesses($i){};function Identity($a,$e){return $true};function ConsoleAuxiliaries($i,$s){return @()};function LegacyConsoleAuxiliaries($i){return @()};function ProbeAuxiliaries($i){return @()};function IsWatcherCommand($c){return $false}
 ${fn}
 $order=@('hub');$e=[pscustomobject]@{pid=10;bindings=@()};$before=[pscustomobject]@{identities=[pscustomobject]@{hub=$e}};$profile=[pscustomobject]@{oldWatchers=@();packages=@()};$script:consolePins=@{};$script:probePins=@{};$script:legacyConsolePins=@{};$script:drainedPids=@();$p=[pscustomobject]@{ProcessId=10;ParentProcessId=1;CommandLine='known'};$script:inv=[pscustomobject]@{all=@($p);listeners=@()};[void](PausedRemaining);'CLEAN'
 $script:inv.all+=,[pscustomobject]@{ProcessId=11;ParentProcessId=10;CommandLine='foreign'};try{PausedRemaining}catch{$_.Exception.Message}`;
 const out=ps(code);assert.match(out,/CLEAN/);assert.match(out,/PAUSED_DRAIN_FOREIGN_PROCESS/);
});

test('readonly monitor probe argv accepts exact stage ports and optional captured PID, rejects mutation and foreign PID',windows,()=>{
 const s=readFileSync(source,'utf8');const fn=s.slice(s.indexOf('function ProbeArgumentsAllowed('),s.indexOf('function PrepareProbeSource{'));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;${fn}
 $profile=[pscustomobject]@{shell=[pscustomobject]@{path='powershell.exe'}};$before=[pscustomobject]@{identities=[pscustomobject]@{}};foreach($r in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){$before.identities|Add-Member NoteProperty $r ([pscustomobject]@{pid=10;bindings=@([pscustomobject]@{port=62700},[pscustomobject]@{port=62701})})}
 $a=@('powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','probe.ps1','-Ports','62700,62701')
 'GOOD='+(ProbeArgumentsAllowed $a 'probe.ps1');'PID='+(ProbeArgumentsAllowed @($a+@('-ProcessId','10')) 'probe.ps1');'WRONG='+(ProbeArgumentsAllowed @($a+@('-ProcessId','99')) 'probe.ps1');'MUTATE='+(ProbeArgumentsAllowed @($a+@('-Command','Stop-Process')) 'probe.ps1')`;
 const out=ps(code);assert.match(out,/GOOD=True/);assert.match(out,/PID=True/);assert.match(out,/WRONG=False/);assert.match(out,/MUTATE=False/);
});

test('cached probe PID reuse is rejected and genuine exit requests whole inventory recapture',windows,()=>{
 const s=readFileSync(source,'utf8');const fn=s.slice(s.indexOf('function ProbeAuxiliaries('),s.indexOf('function PausedTasks{'));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 function Need($v,$c){if(-not $v){throw ('P03_PHYSICAL_'+$c)}};function Identity($a,$e){return $false};function Get-CimInstance{param($ClassName,$Filter,$ErrorAction);return $script:fresh}
 ${fn}
 $birth=[DateTime]::Parse('2026-10-18T00:00:00Z').ToUniversalTime();$p=[pscustomobject]@{ProcessId=10;ParentProcessId=1;CreationDate=$birth};$pin=[pscustomobject]@{creationTime=$birth.ToString('o')};$before=[pscustomobject]@{identities=[pscustomobject]@{coreSupervisor=[pscustomobject]@{pid=1}}};$script:probePins=@{10=$pin};$script:probePath='fixed';$script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$inv=[pscustomobject]@{all=@($p);allListeners=@()};$script:fresh=@($p)
 try{ProbeAuxiliaries $inv}catch{$_.Exception.Message};$script:fresh=@();try{ProbeAuxiliaries $inv}catch{$_.Exception.Message}`;
 const out=ps(code);assert.match(out,/PAUSED_PROBE_IDENTITY/);assert.match(out,/P03_PAUSED_PROBE_EXIT_RECAPTURE/);
});

test('fresh readonly probe can enter before authenticated core cut but is rejected after verified exit',windows,()=>{
 const s=readFileSync(source,'utf8');const fn=s.slice(s.indexOf('function ProbeAuxiliaries('),s.indexOf('function PausedTasks{'));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 function Need($v,$c){if(-not $v){throw ('P03_PHYSICAL_'+$c)}};function Identity($a,$e){return $true};function Tokens($s){return @('exact')};function ProbeArgumentsAllowed($a,$p){return $true};function LatePrecutProbeAllowed($p,$inv){return $false}
 ${fn}
 $birth=[DateTime]::Parse('2026-10-18T00:00:00Z').ToUniversalTime();$core=[pscustomobject]@{pid=1;creationTime=$birth.ToString('o');ownerSid='fixture'};$before=[pscustomobject]@{identities=[pscustomobject]@{coreSupervisor=$core}};$profile=[pscustomobject]@{shell=[pscustomobject]@{path='fixed-shell'}};$script:probePath='fixed-probe';$script:probePins=@{};$script:legacyConsolePins=@{};$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false
 $child=[pscustomobject]@{ProcessId=10;ParentProcessId=1;Name='powershell.exe';ExecutablePath='fixed-shell';CommandLine='finite';CreationDate=$birth.AddSeconds(1)};$parent=[pscustomobject]@{ProcessId=1;ParentProcessId=0};$inv=[pscustomobject]@{all=@($parent,$child);allListeners=@()};$rows=@(ProbeAuxiliaries $inv);'PRECUT='+$rows.Count
 $script:probePins=@{};$script:legacyConsolePins=@{};$script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;try{ProbeAuxiliaries $inv}catch{$_.Exception.Message}`;
 const out=ps(code);assert.match(out,/PRECUT=1/);assert.match(out,/PAUSED_NEW_PROBE_AFTER_CORE_EXIT/);
 const freeze=s.indexOf('$script:coreQuiesced=$true;');assert.ok(freeze>s.indexOf("'PAUSED_DRAIN_ABSENCE'"));assert.ok(s.indexOf("WriteEvidence 'paused-old-console-core-cut-observation.json'")<s.indexOf("$result=&"));
});

test('actual engine native Tokens feed flat nine and eleven probe arguments to classifier',windows,()=>{
 const helper=readFileSync(source,'utf8');const fn=helper.slice(helper.indexOf('function ProbeArgumentsAllowed('),helper.indexOf('function PrepareProbeSource{'));
 const engine=readFileSync(fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url)),'utf8');const tokens=engine.slice(engine.indexOf('function Tokens('),engine.indexOf('function VerifyRule('));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;function Need($v,$c){if(-not $v){throw $c}};${tokens};${fn}
 $profile=[pscustomobject]@{shell=[pscustomobject]@{path='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'}};$before=[pscustomobject]@{identities=[pscustomobject]@{}};foreach($role in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){$before.identities|Add-Member NoteProperty $role ([pscustomobject]@{pid=10})}
 $probe='C:\\fixed package\\hub-stack-process-probe.ps1';$line='"'+$profile.shell.path+'" -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "'+$probe+'" -Ports 62700,62701'
 $argv=Tokens $line;'COUNT='+$argv.Count;'GOOD='+(ProbeArgumentsAllowed $argv $probe)
 $argv=Tokens ($line+' -ProcessId 10');'OPTIONALCOUNT='+$argv.Count;'OPTIONAL='+(ProbeArgumentsAllowed $argv $probe)
 $argv=Tokens ($line+' -Command Stop-Process');'MUTATE='+(ProbeArgumentsAllowed $argv $probe)`;
 const out=ps(code);assert.match(out,/COUNT=9/);assert.match(out,/GOOD=True/);assert.match(out,/OPTIONALCOUNT=11/);assert.match(out,/OPTIONAL=True/);assert.match(out,/MUTATE=False/);assert.doesNotMatch(helper,/\$argv=@\(Tokens/);
});
