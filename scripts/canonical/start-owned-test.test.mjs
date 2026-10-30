import fs from 'node:fs';
import os from 'node:os';
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

winTest('steady startup is inert outside the fixed generation and never adopts an existing 5244 listener',()=>{
 assert.equal(run("function Get-NetTCPConnection {throw 'UNEXPECTED_PROBE'};if(Test-ErpSteadyWebStartupGeneration){throw 'SOURCE_ACTIVATED'};try{Start-ErpSteadyWebStartup;throw 'EXPECTED_RET'}catch{if($_.Exception.Message-cne'TEST_STEADY_GENERATION_REQUIRED'){throw}};function Test-ErpSteadyWebStartupGeneration{return $true};function Get-NetTCPConnection {[pscustomobject]@{LocalPort=5244;OwningProcess=999}};function Start-Process {throw 'ADOPTION_START'};$a=Start-ErpSteadyWebStartup;$b=Start-ErpSteadyWebStartup;if($a.state-cne'already-present-not-adopted'-or$a.attempted-or![object]::ReferenceEquals($a,$b)){throw 'ADOPTION'};'PASS'"),'PASS');
});
winTest('NativeContext PackageRefresh keeps maintenance API launchers inert and only its fixed steady sibling enables future startup',()=>{
 assert.equal(run(String.raw`
 $body=(Get-Command Test-ErpSteadyWebStartupGeneration).Definition.Replace('$PSScriptRoot','$script:connectorSourceRoot');. ([scriptblock]::Create('function Test-ErpSteadyWebStartupGeneration {'+$body+'}'))
 foreach($name in @('LINK','CONTEXT','READ')){$script:connectorSourceRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-'+$name+'-OWNER-20261030';if(Test-ErpSteadyWebStartupGeneration){throw 'MAINTENANCE_CONNECTOR_ACTIVATED'}}
 foreach($root in @('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-VERIFIED-STEADY-OWNER-20261030')){$script:connectorSourceRoot=$root;if(!(Test-ErpSteadyWebStartupGeneration)){throw 'STEADY_CONNECTOR_MISSING'};$script:connectorSourceRoot=$root.ToLowerInvariant();if(Test-ErpSteadyWebStartupGeneration){throw 'UNPINNED_CONNECTOR_ALIAS'}};'PASS'
 `),'PASS');
});
winTest('steady connector is ready-only, one-shot and does not expand canonical service definitions',()=>{
 const source=execFileSync(process.execPath,['-e',"process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))",path.join(import.meta.dirname,'start-owned-test.ps1')],{encoding:'utf8'});
 assert.match(source,/if\(\$ready-and\(Test-ErpSteadyWebStartupGeneration\)\)/);
 const definition=source.slice(source.indexOf('function Get-ErpServiceDefinitions'),source.indexOf('function Get-ErpProcess'));
 assert.match(definition,/Port=5194/);assert.match(definition,/Port=4146/);assert.match(definition,/Port=4144/);assert.doesNotMatch(definition,/5244/);
 assert.equal(run("function Test-ErpSteadyWebStartupGeneration{return $true};$script:ErpSteadyWebStartupAttempt=@{state='unknown';attempted=$true;owner=$null};function Get-NetTCPConnection {throw 'REPLAY_PROBE'};$r=Start-ErpSteadyWebStartup;if($r.state-cne'unknown'-or!$r.attempted){throw 'REPLAY'};'PASS'"),'PASS');
});
winTest('steady connector validates immutable files before a single mocked launch and rejects listener uncertainty',()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'steady-connector-'))),entry=path.join(temp,'run-current-owner.ps1'),manifest=path.join(temp,'owner-manifest.json');const q=s=>"'"+s.replaceAll("'","''")+"'";
 try{
 fs.writeFileSync(entry,'# inert fixture\n');
 const body=String.raw`foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){Microsoft.PowerShell.Core\Import-Module (Join-Path $PSHOME ('Modules\'+$name+'\'+$name+'.psd1')) -ErrorAction Stop}
function Test-ErpSteadyWebStartupGeneration{return $true}
$definition=(Get-Command Start-ErpSteadyWebStartup).Definition
$definition=$definition.Replace('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029',__TEMP__).Replace('$PSCommandPath',__SELFEXPR__)
. ([scriptblock]::Create('function Start-IsolatedSteady {'+$definition+'}'))
$rows=@([pscustomobject]@{path='run-current-owner.ps1';sha256=(Get-FileHash __ENTRY__).Hash.ToLowerInvariant()},[pscustomobject]@{path='start-owned-test.ps1';sha256=(Get-FileHash __SOURCE__).Hash.ToLowerInvariant()})+@(1..11|ForEach-Object{[pscustomobject]@{path=('fixture-'+$_);sha256=('a'*64)}})
$m=@{kind='BUSINESS5244_FRESH_OWNER_BUNDLE';finiteScope='TEST125-API-B6-WRITER-20261029';maintenancePurpose='WebOnlySteadyStartup';apiTransitionEnabled=$false;readPairMaintenanceEnabled=$false;actualT1=$false;externalOperations=$false;recordingEnabled=$false;files=$rows}
[IO.File]::WriteAllText(__MANIFEST__,($m|ConvertTo-Json -Depth 6))
$script:starts=0;function Get-NetTCPConnection{return @()};function Start-Process {param($FilePath,$ArgumentList,$WorkingDirectory,$WindowStyle,[switch]$PassThru);if($FilePath-cne(Join-Path $PSHOME 'powershell.exe')-or$ArgumentList[4]-cne'-File'-or$ArgumentList[5]-cne __ENTRY__-or$WorkingDirectory-cne __TEMP__){throw 'FIXTURE_ARGV_CHANGED'};$script:starts++;return [pscustomobject]@{Handle=1}}
$r=Start-IsolatedSteady;$again=Start-IsolatedSteady;if($starts-ne1-or$r.state-cne'started-unverified'-or![object]::ReferenceEquals($r,$again)){throw 'FIXTURE_REPLAY'}
Remove-Variable ErpSteadyWebStartupAttempt -Scope Script
[IO.File]::AppendAllText(__ENTRY__,'changed');try{Start-IsolatedSteady;throw 'EXPECTED_HASH_RET'}catch{if($_.Exception.Message-cne'TEST_STEADY_OWNER_SOURCE_CHANGED'){throw}};if($starts-ne1){throw 'CHANGED_FILE_STARTED'}
Remove-Variable ErpSteadyWebStartupAttempt -Scope Script
function Get-NetTCPConnection {throw 'FIXTURE_LISTENER_UNKNOWN'};try{Start-IsolatedSteady;throw 'EXPECTED_LISTENER_RET'}catch{if($_.Exception.Message-cne'FIXTURE_LISTENER_UNKNOWN'){throw}};if($starts-ne1){throw 'UNKNOWN_LISTENER_STARTED'};'PASS'
`.replaceAll('__TEMP__',q(temp)).replaceAll('__ENTRY__',q(entry)).replaceAll('__MANIFEST__',q(manifest)).replaceAll('__SOURCE__',q(path.join(import.meta.dirname,'start-owned-test.ps1'))).replace('__SELFEXPR__',q(q(path.join(import.meta.dirname,'start-owned-test.ps1'))));
 assert.equal(run(body),'PASS');
 }finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('steady-connector-'));for(const leaf of fs.readdirSync(temp)){const target=path.join(temp,leaf);assert(fs.lstatSync(target).isFile());fs.unlinkSync(target);}fs.rmdirSync(temp);}
});
