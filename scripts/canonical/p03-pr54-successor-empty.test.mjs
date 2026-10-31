import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pr54SuccessorEmptyProgram} from './p03-pr54-shared-owner-io.mjs';

const windows={skip:process.platform!=='win32'};
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const consolePin={pid:120,parentPid:110,nodePath:String.raw`C:\Windows\System32\conhost.exe`,ownerSid:'S-1-5-21-1001',commandLine:String.raw`\??\C:\WINDOWS\system32\conhost.exe 0x4`,creationTime:'2026-10-18T10:00:00.1234567Z'};
const scope={ids:[100,110,120,130],consoles:[consolePin]};
const setup=String.raw`
$script:inventory=@();$script:listeners=@();$script:sleeps=0;$script:captures=0
$script:exitOnSleep=$true;$script:ownerReturn=0;$script:ownerSid='S-1-5-21-1001'
function Get-CimInstance{param($ClassName,$ErrorAction)
 if($ClassName -cne 'Win32_Process' -or $ErrorAction -cne 'Stop'){throw 'FIXTURE_CAPTURE_SCOPE'}
 $script:captures++;return $script:inventory
}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction)
 if($MethodName -cne 'GetOwnerSid' -or $ErrorAction -cne 'Stop'){throw 'FIXTURE_OWNER_SCOPE'}
 [pscustomobject]@{ReturnValue=$script:ownerReturn;Sid=$script:ownerSid}
}
function Get-NetTCPConnection{param($State,$ErrorAction)
 if($State -cne 'Listen' -or $ErrorAction -cne 'Stop'){throw 'FIXTURE_LISTENER_SCOPE'}
 return $script:listeners
}
function Start-Sleep{param($Milliseconds)
 if($Milliseconds -ne 250){throw 'FIXTURE_POLL_INTERVAL'}
 $script:sleeps++;if($script:exitOnSleep){$script:inventory=@()}else{throw 'FIXTURE_WAIT_CONTINUES'}
}
function Stop-Process{throw 'FIXTURE_FORBIDDEN_STOP'}
function Set-ScheduledTask{throw 'FIXTURE_FORBIDDEN_TASK'}
function Invoke-Sqlcmd{throw 'FIXTURE_FORBIDDEN_SQL'}
function New-Item{throw 'FIXTURE_FORBIDDEN_WRITE'}
function Set-Content{throw 'FIXTURE_FORBIDDEN_WRITE'}
$script:child=[pscustomobject]@{ProcessId=120;ParentProcessId=110;ExecutablePath='C:\WINDOWS\system32\conhost.exe';CommandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';CreationDate=[DateTime]::Parse('2026-10-18T10:00:00.1234567Z').ToUniversalTime()}
`;
function run(edit='',pins=scope){
 const code=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${setup}\n${edit}\ntry{& {${pr54SuccessorEmptyProgram(pins)}}}catch{'REJECT='+$_.Exception.Message}\n'SLEEPS='+$script:sleeps;'CAPTURES='+$script:captures`;
 return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000,windowsHide:true,stdio:['ignore','pipe','pipe']});
}

test('successor global empty scope is finite and read only before any PowerShell execution',()=>{
 for(const ids of [[0],[-1],[1.1],Array(257).fill(1)])assert.throws(()=>pr54SuccessorEmptyProgram({...scope,ids}));
 assert.throws(()=>pr54SuccessorEmptyProgram({...scope,consoles:Array(129).fill(consolePin)}));
 const program=pr54SuccessorEmptyProgram(scope);
 assert.match(program,/UtcNow.AddSeconds\(15\)/);assert.match(program,/Start-Sleep -Milliseconds 250/);
 assert.match(program,/ProcessId-in\$pins.ids-or\$_.ParentProcessId-in\$pins.ids/);
 assert.doesNotMatch(program,/Stop-Process|\.Kill\(|Set-ScheduledTask|Invoke-Sqlcmd|FileStream|WriteAll|Set-Content|New-Item/);
});

test('global capture ignores unrelated processes but recaptures an exact orphan console until natural exit',windows,()=>{
 const empty=run("$script:inventory=@([pscustomobject]@{ProcessId=999;ParentProcessId=998})");
 assert.match(empty,/^EMPTY\r?\n/);assert.match(empty,/SLEEPS=0/);assert.match(empty,/CAPTURES=1/);
 const orphan=run('$script:inventory=@($script:child)');
 assert.match(orphan,/^EMPTY\r?\n/);assert.match(orphan,/SLEEPS=1/);assert.match(orphan,/CAPTURES=2/);
 assert.doesNotMatch(orphan,/REJECT=/);
});

test('every captured app watcher probe console PID and each immediate orphan child prevents empty',windows,()=>{
 for(const pid of scope.ids){
  const self=run(`$script:inventory=@([pscustomobject]@{ProcessId=${pid};ParentProcessId=998})`,{...scope,consoles:[]});
  assert.match(self,/REJECT=P03_SUCCESSOR_UNKNOWN_REMAINING/);assert.match(self,/SLEEPS=0/);
  const child=run(`$script:inventory=@([pscustomobject]@{ProcessId=999;ParentProcessId=${pid}})`);
  assert.match(child,/REJECT=P03_SUCCESSOR_UNKNOWN_REMAINING/);assert.match(child,/SLEEPS=0/);
 }
});

test('natural console wait rejects PID reuse and full identity or ownership drift',windows,()=>{
 const negatives=[
  "$script:child.ParentProcessId=100",
  "$script:child.ExecutablePath='C:\\foreign\\conhost.exe'",
  "$script:child.CommandLine+=' foreign'",
  '$script:child.CreationDate=$script:child.CreationDate.AddTicks(1)',
  "$script:ownerSid='S-1-5-18'",
  '$script:ownerReturn=5'
 ];
 for(const edit of negatives){const out=run(`${edit};$script:inventory=@($script:child)`);assert.match(out,/REJECT=P03_SUCCESSOR_CONSOLE_REUSED/);assert.match(out,/SLEEPS=0/);}
 const duplicate=run('$script:inventory=@($script:child)',{...scope,consoles:[consolePin,{...consolePin}]});
 assert.match(duplicate,/REJECT=P03_SUCCESSOR_UNKNOWN_REMAINING/);
});

test('listener on pinned console rejects and unrelated listener does not prevent natural exit',windows,()=>{
 const bad=run('$script:inventory=@($script:child);$script:listeners=@([pscustomobject]@{OwningProcess=120;LocalPort=65000})');
 assert.match(bad,/REJECT=P03_SUCCESSOR_CONSOLE_LISTENER/);assert.match(bad,/SLEEPS=0/);
 const good=run('$script:inventory=@($script:child);$script:listeners=@([pscustomobject]@{OwningProcess=999;LocalPort=65000})');
 assert.match(good,/^EMPTY\r?\n/);assert.match(good,/SLEEPS=1/);
});

test('persistent exact console continues waiting and inventory failures cannot report empty',windows,()=>{
 const waiting=run('$script:inventory=@($script:child);$script:exitOnSleep=$false');
 assert.match(waiting,/REJECT=FIXTURE_WAIT_CONTINUES/);assert.doesNotMatch(waiting,/^EMPTY\r?$/m);
 const captureFailure=run("function Get-CimInstance{throw 'FIXTURE_CAPTURE_FAILED'}");
 assert.match(captureFailure,/REJECT=FIXTURE_CAPTURE_FAILED/);assert.doesNotMatch(captureFailure,/^EMPTY\r?$/m);
 const listenerFailure=run("$script:inventory=@($script:child);function Get-NetTCPConnection{throw 'FIXTURE_LISTENER_FAILED'}");
 assert.match(listenerFailure,/REJECT=FIXTURE_LISTENER_FAILED/);assert.doesNotMatch(listenerFailure,/^EMPTY\r?$/m);
});
