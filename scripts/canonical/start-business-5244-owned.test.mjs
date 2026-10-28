import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function run(body){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'erp-5244-owned-test-'));
 try{
  const file=path.join(temp,'run.ps1');fs.writeFileSync(file,"$ErrorActionPreference='Stop'\n"+body);
  return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:20000,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
const load=`. ${quote(path.join(dir,'start-business-5244-owned.ps1'))} -Library;`;
win('production native child creation retains its creation handle and stops only that child',()=>{
 assert.equal(run(`${load} Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$script=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($script,'Start-Sleep -Seconds 300');try{$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$script+'"'),$env:TEMP);if(!$n.ChildAlive() -or $n.ChildPid -le 0){throw 'CHILD_NOT_LIVE'};$birth=$n.ChildBirth;$n.Stop();if($n.ChildAlive() -or $n.ChildBirth -cne $birth){throw 'STOP_NOT_BOUND'};$denied=$false;try{$n.Stop()}catch{$denied=$true};if(!$denied){throw 'STOP_REPLAY'}}finally{$n.Dispose()};'PASS'`),'PASS');
});
win('production native disposal confirms child exit before returning ownership',()=>{
 assert.equal(run(`${load}Initialize-Business5244WebNative;$n=[Business5244WebNative]::new();$script=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($script,'Start-Sleep -Seconds 300');$p=$null;try{$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$script+'"'),$env:TEMP);$p=[Diagnostics.Process]::GetProcessById($n.ChildPid);$null=$p.Handle;$n.Dispose();if(!$p.WaitForExit(1000)){throw 'LEASE_COULD_OPEN_BEFORE_CHILD_EXIT'}}finally{if($p){$p.Dispose()};$n.Dispose()};'PASS'`),'PASS');
});
win('maintenance blocks both source launchers before package, environment or network work',()=>{
 assert.equal(run(`${load}$l=Enter-Business5244StartupLease -Kind Maintenance;try{foreach($name in @('Start-Business5244Web','Start-Business5244OwnedSupervisor')){$denied=$false;try{& $name|Out-Null}catch{if($_.Exception.Message -match 'BUSY|REENTRANT'){$denied=$true}else{throw}};if(!$denied){throw 'COOPERATIVE_START_OPEN'}}}finally{Exit-Business5244StartupLease -Lease $l};'PASS'`),'PASS');
});
win('owned startup releases its lease on package failure without starting or adopting anything',()=>{
 assert.equal(run(`${load}function Assert-Business5244OwnedPackage{throw 'ISOLATED_PACKAGE_FAILURE'};function Invoke-RestMethod{throw 'UNEXPECTED_NETWORK'};$denied=$false;try{Start-Business5244OwnedSupervisor|Out-Null}catch{if($_.Exception.Message -ceq 'ISOLATED_PACKAGE_FAILURE'){$denied=$true}else{throw}};if(!$denied){throw 'EXPECTED_FAILURE_MISSING'};$l=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease -Lease $l;'PASS'`),'PASS');
});
win('Current startup selects only the fixed 5cb package and leaves ReadPair as the explicit default',()=>{
 assert.equal(run(`${load}$script:chosen=$null;function Assert-Business5244OwnedPackage($Pins){$script:chosen=$Pins;throw 'ISOLATED_SLOT_CHECK'};foreach($slot in @('Current','current','ReadPair')){$denied=$false;try{Start-Business5244OwnedSupervisor -InitialSlot $slot|Out-Null}catch{if($_.Exception.Message -ceq 'ISOLATED_SLOT_CHECK'){$denied=$true}else{throw}};$expected=if($slot -ieq 'Current'){'ERP-BUSINESS-WEB-5244-5cb682d8'}else{'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'};if(!$denied -or $script:chosen.package -cne $expected){throw 'WRONG_FIXED_SLOT'}};'PASS'`),'PASS');
});
win('new package pins stay paired and generic B5 handoff remains closed',()=>{
 assert.equal(run(`${load}$p=Get-Business5244ReadPairPins;if($p.apiPackage -cne 'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213' -or $p.manifest -cne '91EE8B23C37A46EC89F8060967BC7A0106F68F2DE9A4A1F4199941CCE5A9E0FD'){throw 'PAIR_CHANGED'};. ${quote(path.join(dir,'clean-b5-pair-transition.ps1'))} -Library;$denied=$false;try{Get-B5WriterHandoff}catch{if($_.Exception.Message -ceq 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'){$denied=$true}else{throw}};if(!$denied){throw 'GENERIC_HANDOFF_OPEN'};'PASS'`),'PASS');
});
win('owned network readiness rejects foreign listeners, hidden child ports and incomplete bindings',()=>{
 assert.equal(run(`${load}$rows=@('100.87.188.3','127.0.0.1','192.168.1.46')|ForEach-Object {[pscustomobject]@{LocalPort=5244;OwningProcess=777;LocalAddress=$_}};Assert-Business5244OwnedListeners $rows 777;foreach($mode in @('foreign','extra','missing')){$bad=@($rows|ForEach-Object {$_.PSObject.Copy()});switch($mode){foreign{$bad[0].OwningProcess=778}extra{$bad+=,[pscustomobject]@{LocalPort=4144;OwningProcess=777;LocalAddress='127.0.0.1'}}missing{$bad=$bad[0..1]}};$denied=$false;try{Assert-Business5244OwnedListeners $bad 777}catch{$denied=$true};if(!$denied){throw 'LISTENER_SCOPE_OPEN'}};'PASS'`),'PASS');
});
win('B5 cleanup rejects a foreign owner and retains startup exclusion after a resource error',()=>{
 assert.equal(run(`${load}. ${quote(path.join(dir,'clean-b5-pair-transition.ps1'))} -Library;$g=Enter-Business5244StartupLease -Kind Maintenance;$m=[Threading.Mutex]::new($false,('Local\\erp-5244-retirement-'+[Guid]::NewGuid().ToString('N')));$null=$m.WaitOne(0);$script:cleanupSeen=0;$a=[pscustomobject]@{};$a|Add-Member ScriptMethod Dispose {throw 'SYNTHETIC_DISPOSE_FAILURE'};$b=[pscustomobject]@{};$b|Add-Member ScriptMethod Dispose {$script:cleanupSeen++};$l=[pscustomobject]@{process=($PID+1);thread=[Threading.Thread]::CurrentThread.ManagedThreadId;mutex=$m;startupLease=$g;closed=$false;resources=@($a,$b)};$script:B5Lease=$l;try{$denied=$false;try{Exit-B5Lease $l}catch{if($_.Exception.Message -ceq 'B5_LEASE_EXIT_FOREIGN_OWNER'){$denied=$true}else{throw}};if(!$denied -or $l.closed -or $script:cleanupSeen){throw 'FOREIGN_CLEANUP_MUTATED'};$l.process=$PID;$denied=$false;try{Exit-B5Lease $l}catch{if($_.Exception.Message -ceq 'B5_LEASE_CLEANUP_UNCONFIRMED'){$denied=$true}else{throw}};if(!$denied -or $script:cleanupSeen -ne 1){throw 'RESOURCE_ATTEMPTS_INCOMPLETE'};Assert-Business5244StartupLease -Lease $g -Kind Maintenance;$denied=$false;try{Enter-Business5244StartupLease -Kind Owner|Out-Null}catch{if($_.Exception.Message -ceq 'BUSINESS_5244_STARTUP_BUSY'){$denied=$true}else{throw}};if(!$denied){throw 'UNCERTAIN_CLEANUP_OPENED_GATE'}}finally{Exit-Business5244StartupLease -Lease $g};'PASS'`),'PASS');
});
win('changed source scripts parse under Windows PowerShell',()=>{
 assert.equal(run(`foreach($file in @(${['start-business-5244-owned.ps1','start-business-5244-web.ps1','clean-b5-pair-transition.ps1'].map(x=>quote(path.join(dir,x))).join(',')})){$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){throw 'PARSE_FAILED'}};'PASS'`),'PASS');
});
