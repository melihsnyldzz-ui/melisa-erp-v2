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
 assert.match(s,/\$order=@\('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'\)/);assert.doesNotMatch(s,/Remove-Item|Unregister-ScheduledTask|Start-Process|\.Run\(\$null\)/);
 assert.ok(s.indexOf("if($Mode -ceq 'DryRun')")<s.indexOf("WriteEvidence 'paused-old-recovery-intent.json'"));assert.ok(s.indexOf("WriteEvidence 'paused-old-recovery-intent.json'")<s.indexOf("foreach($role in $order){$inv=PausedRemaining"));
});
test('empty gate rejects globally reused captured watcher PID and orphan child even absent from observer',windows,()=>{
 const s=readFileSync(source,'utf8');const fn=s.slice(s.indexOf('function PausedEmpty{'),s.indexOf('$selected=PausedOld'));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 function Need($v,$c){if(-not $v){throw ('P03_PHYSICAL_'+$c)}};function ProtectedProcesses($i){};function AssertEmpty($i){};function Inventory{return [pscustomobject]@{all=$script:all}}
 ${fn}
 $before=[pscustomobject]@{identities=[pscustomobject]@{hub=[pscustomobject]@{pid=10}}};$profile=[pscustomobject]@{oldWatchers=@([pscustomobject]@{pid=20})};$script:consolePins=@{}
 $script:all=@([pscustomobject]@{ProcessId=99;ParentProcessId=1});PausedEmpty;'EMPTY'
 foreach($row in @([pscustomobject]@{ProcessId=20;ParentProcessId=1},[pscustomobject]@{ProcessId=21;ParentProcessId=20})){$script:all=@($row);try{PausedEmpty}catch{$_.Exception.Message}}`;
 const out=ps(code);assert.match(out,/EMPTY/);assert.equal((out.match(/PAUSED_OLD_DESCENDANT_REMAINS/g)||[]).length,2);
});

test('each drain rechecks descendant closure and refuses newly introduced foreign child',windows,()=>{
 const s=readFileSync(source,'utf8');const fn=s.slice(s.indexOf('function PausedRemaining{'),s.indexOf('function PausedEmpty{'));
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
 function Need($v,$c){if(-not $v){throw ('P03_PHYSICAL_'+$c)}};function Authority{};function PausedTasks{return $script:inv};function ProtectedProcesses($i){};function Identity($a,$e){return $true};function ConsoleAuxiliaries($i,$s){return @()};function IsWatcherCommand($c){return $false}
 ${fn}
 $order=@('hub');$e=[pscustomobject]@{pid=10;bindings=@()};$before=[pscustomobject]@{identities=[pscustomobject]@{hub=$e}};$profile=[pscustomobject]@{oldWatchers=@();packages=@()};$script:consolePins=@{};$script:drainedPids=@();$p=[pscustomobject]@{ProcessId=10;ParentProcessId=1;CommandLine='known'};$script:inv=[pscustomobject]@{all=@($p);listeners=@()};[void](PausedRemaining);'CLEAN'
 $script:inv.all+=,[pscustomobject]@{ProcessId=11;ParentProcessId=10;CommandLine='foreign'};try{PausedRemaining}catch{$_.Exception.Message}`;
 const out=ps(code);assert.match(out,/CLEAN/);assert.match(out,/PAUSED_DRAIN_FOREIGN_PROCESS/);
});
