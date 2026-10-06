import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const script=path.join(import.meta.dirname,'start-owned-test.ps1').replaceAll("'","''");
const winTest=(name,body)=>test(name,{skip:process.platform!=='win32'},body);
const run=body=>execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`. '${script}' -Library; ${body}`],{encoding:'utf8'}).trim();
winTest('task management CLI retains its config parameter through library import',()=>{
 const cli=path.join(import.meta.dirname,'manage-owned-test-startup.ps1').replaceAll("'","''");
 const output=execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`function Get-Content {param($LiteralPath,[switch]$Raw);if($LiteralPath -ne 'C:\\fixture\\startup.json'){throw 'CONFIG_ARGUMENT_LOST'};throw 'FIXTURE_CONFIG_OBSERVED'};try{& '${cli}' -Action Inspect -StartupConfigPath 'C:\\fixture\\startup.json';throw 'CLI_UNEXPECTED_SUCCESS'}catch{if($_.Exception.Message -ne 'FIXTURE_CONFIG_OBSERVED'){throw};'PASS'}`],{encoding:'utf8'}).trim();
 assert.equal(output,'PASS');
});
winTest('library is inert; equivalent paths have same single-owner mutex and private overlap is rejected',()=>{
 assert.equal(run(`$sid='S-1-fixture';if((Get-ErpMutexName 'C:\\fixture\\repo' $sid) -ne (Get-ErpMutexName 'c:/fixture/repo/.' $sid)){throw 'mutex'};if(Outside-ErpPath 'C:\\fixture\\repo\\runtime' 'C:\\fixture\\repo'){throw 'overlap'};if(!(Outside-ErpPath 'C:\\fixture\\runtime' 'C:\\fixture\\repo')){throw 'outside'};'PASS'`),'PASS');
});
winTest('recovery backs off, opens circuit and resets only after stable service',()=>{
 assert.equal(run(`$count=0;foreach($delay in @(5,10,20,40,60)){$result=Get-ErpRecoveryDecision $count 1;if($result.DelaySeconds -ne $delay -or $result.State -ne 'restart-wait'){throw 'delay'};$count=$result.Failures};if((Get-ErpRecoveryDecision $count 1).State -ne 'circuit-open'){throw 'circuit'};if((Get-ErpRecoveryDecision $count 120).Failures -ne 1){throw 'stable'};'PASS'`),'PASS');
});
winTest('process adoption checks exact owner executable script mode config and creation time',()=>{
 assert.equal(run(`$cfg=[pscustomobject]@{OwnerSid='S-1-fixture';NodePath='C:\\fixture\\node.exe'};$d=@{Script='C:\\fixture\\package\\start.mjs';Args=@('erp','C:\\fixture\\private.json')};$script:p=[pscustomobject]@{ProcessId=1;CreationDate=[datetime]'2026-10-06T00:00:00Z';ExecutablePath=$cfg.NodePath;CommandLine='"C:\\fixture\\node.exe" "C:\\fixture\\package\\start.mjs" "erp" "C:\\fixture\\private.json"'};function Get-ErpProcess {$script:p};function Invoke-CimMethod {[pscustomobject]@{ReturnValue=0;Sid='S-1-fixture'}};Assert-ErpOwnedProcess 1 $cfg $d | Out-Null;foreach($bad in @('owner','node','script','config','pid')){$old=$script:p.PSObject.Copy();$sid=$cfg.OwnerSid;if($bad -eq 'owner'){$cfg.OwnerSid='foreign'};if($bad -eq 'node'){$script:p.ExecutablePath='C:\\foreign.exe'};if($bad -eq 'script'){$script:p.CommandLine='node LIVE.mjs'};if($bad -eq 'config'){$script:p.CommandLine='node "C:\\fixture\\package\\start.mjs" erp "C:\\fixture\\other.json"'};$reject=$false;try{$created=if($bad -eq 'pid'){'2026-10-05T00:00:00Z'}else{''};Assert-ErpOwnedProcess 1 $cfg $d $created | Out-Null}catch{$reject=$true};if(!$reject){throw ('accepted '+$bad)};$script:p=$old;$cfg.OwnerSid=$sid};'PASS'`),'PASS');
});
winTest('health requires exact environment source package and TEST DB; raw error never leaks',()=>{
 assert.equal(run(`$cfg=[pscustomobject]@{SourceCommit='source';ReleaseRoot='C:\\fixture';ExpectedDatabase='TEST'};$d=@{Port=4144;Name='api'};$script:h=[pscustomobject]@{ok=$true;environment='CANONICAL_TEST';port=4144;sourceCommit='source';packageId='package';databaseName='TEST';serverName='Semih\\MELISADEV'};function Get-Content {'{"packageId":"package"}'};function Invoke-RestMethod {$script:h};Assert-ErpHealth $cfg $d | Out-Null;foreach($field in @('environment','sourceCommit','packageId','databaseName')){$before=$script:h.$field;$script:h.$field='foreign';$bad=$false;try{Assert-ErpHealth $cfg $d | Out-Null}catch{$bad=$true};if(!$bad){throw ('accepted '+$field)};$script:h.$field=$before};if((Get-ErpSafeCode (New-Object Exception('password=secret'))) -ne 'TEST_OPERATION_UNAVAILABLE'){throw 'leak'};'PASS'`),'PASS');
});
