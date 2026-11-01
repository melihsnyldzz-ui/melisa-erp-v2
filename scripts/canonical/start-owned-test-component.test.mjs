import test from 'node:test';import assert from 'node:assert/strict';import cp from 'node:child_process';import path from 'node:path';
import {readFileSync} from 'node:fs';
const script=path.join(import.meta.dirname,'start-owned-test.ps1'),ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const q=s=>"'"+s.replaceAll("'","''")+"'";
const run=body=>{const env={...process.env};delete env.PSModulePath;return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`. ${q(script)} -Library; ${body}`],{encoding:'utf8',env}).trim();};
const win=(n,fn)=>test(n,{skip:process.platform!=='win32'},fn);
test('Writer release proof seals the pair and current task witness before freezing without extending native admission phases',()=>{
 const source=readFileSync(script,'utf8');
 assert.match(source,/if\(\$ScopeName-cin@\('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029'\)\)\{[\s\S]*?\$ownerSource=Get-ErpBusinessSaleOwnerSource/);
 const pair=source.indexOf('$seal.Add($ownerSource.packagePairPath,$ownerSource.packagePairSha256)');
 const capture=source.indexOf('$seal.Add($currentTask.capturePath,$currentTask.captureSha256)');
 assert.ok(pair>0&&capture>pair&&source.indexOf('$seal.Freeze()',capture)>capture);
 assert.match(source,/Assert-ErpBusinessSaleWriterProfileAdmission \$NativeProfileAdmission -Phase WriterPrepared/);
});
const config=`$cfg=[pscustomobject]@{RepoRoot='C:\\fixture\\repo';ReleaseRoot='C:\\fixture\\original';RuntimeDir='C:\\fixture\\runtime';ConfigPath='C:\\fixture\\private.json';SourceCommit=('a'*40);ManifestSha256=('b'*64);ExpectedDatabase='MELISA_ERP_SIRKET_TEST_20260929_01';ApiComponent=[pscustomobject]@{ReleaseRoot='C:\\Sirket\\ERP\\releases\\component-fixture';SourceCommit=('a'*40);ManifestSha256=('c'*64);ConfigPath='C:\\Sirket\\ERP\\config\\TEST-20260929-01\\business-5244-private.json'}};`;
win('component routing changes only API definition; old native and web script and args stay byte-equivalent',()=>{
 assert.equal(run(`${config}$defs=@(Get-ErpServiceDefinitions $cfg);if($defs.Count -ne 3){throw 'count'};foreach($d in $defs){if($d.Name -eq 'api'){if($d.Port -ne 4144 -or $d.Script -cne 'C:\\Sirket\\ERP\\releases\\component-fixture\\apps\\api\\start-canonical-test.mjs'){throw 'api'}}elseif(!$d.Script.StartsWith('C:\\fixture\\original\\apps\\api\\')){throw 'companion changed'}};if($cfg.ReleaseRoot -cne 'C:\\fixture\\original'){throw 'mutated input'};'PASS'`),'PASS');
});
win('component accepts only a pinned same-source package under releases and rejects path or extra-field expansion',()=>{
 assert.equal(run(`${config}foreach($case in @('source','root','manifest','profile','extra')){$old=$cfg.ApiComponent.PSObject.Copy();if($case -eq 'source'){$cfg.ApiComponent.SourceCommit='other'};if($case -eq 'root'){$cfg.ApiComponent.ReleaseRoot='C:\\fixture\\LIVE'};if($case -eq 'manifest'){$cfg.ApiComponent.ManifestSha256='bad'};if($case -eq 'profile'){$cfg.ApiComponent.ConfigPath='C:\\fixture\\private.json'};if($case -eq 'extra'){$cfg.ApiComponent|Add-Member -NotePropertyName Port -NotePropertyValue 4146};$rejected=$false;try{Get-ErpApiComponentConfig $cfg|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'unexpected admission'};$cfg.ApiComponent=$old};'PASS'`),'PASS');
});
win('component health is checked against its own manifest and dedicated normal-session proof',()=>{
 assert.equal(run(`${config}$d=@{Name='api';Port=4144};function Get-Content {param($LiteralPath,[switch]$Raw);if($LiteralPath -like '*component-fixture*'){'{"packageId":"new-component"}'}else{'{"packageId":"original"}'}};$script:h=[pscustomobject]@{ok=$true;environment='CANONICAL_TEST';port=4144;sourceCommit=('a'*40);packageId='new-component';databaseName='MELISA_ERP_SIRKET_TEST_20260929_01';serverName='Semih\\MELISADEV';businessWorkfaceId='ERP-5244-REALDATA-20261027';normalSessionUserId=17;persistentNormalSession=$true;businessSessionSignerDomain='dedicated-business-key-v1';actualT1=$false;sysadmin=0;databaseControl=0;liveDatabaseAccess=0};function Invoke-RestMethod {$script:h};Assert-ErpHealth $cfg $d|Out-Null;foreach($field in @('packageId','normalSessionUserId','persistentNormalSession','actualT1','sysadmin')){$old=$script:h.$field;$script:h.$field=if($field -eq 'packageId'){'original'}elseif($field -eq 'normalSessionUserId'){10018}elseif($field -eq 'persistentNormalSession'){$false}elseif($field -eq 'actualT1'){$true}else{1};$rejected=$false;try{Assert-ErpHealth $cfg $d|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'wrong health admitted'};$script:h.$field=$old};'PASS'`),'PASS');
});
win('API profile permits only the package projection and business fields without changing the original native seal',()=>{
 assert.equal(run(`$base=[pscustomobject]@{database='TEST';jwtAccessSecret='fixture-only';goal8SyntheticDaySeal=[pscustomobject]@{sourceCommit='source';dayId='day';definitionHash='definition';packageId='original'}};$before=$base|ConvertTo-Json -Depth 10 -Compress;$api=$base|ConvertTo-Json -Depth 10|ConvertFrom-Json;$api.goal8SyntheticDaySeal.packageId='api-only';$api|Add-Member -NotePropertyName businessWorkface -NotePropertyValue ([pscustomobject]@{id='fixture'});$api|Add-Member -NotePropertyName businessSessionAccessSecret -NotePropertyValue 'fixture-separate';$manifest=[pscustomobject]@{packageId='api-only'};Assert-ErpApiPrivateProfile $base $api $manifest;if($api.goal8SyntheticDaySeal.packageId -cne 'api-only' -or ($base|ConvertTo-Json -Depth 10 -Compress) -cne $before){throw 'MUTATED_INPUT'};foreach($field in @('database','jwtAccessSecret','dayId','definitionHash','packageId')){$bad=$api|ConvertTo-Json -Depth 10|ConvertFrom-Json;if($field -in @('database','jwtAccessSecret')){$bad.$field='changed'}else{$bad.goal8SyntheticDaySeal.$field='changed'};$rejected=$false;try{Assert-ErpApiPrivateProfile $base $bad $manifest}catch{$rejected=$true};if(!$rejected){throw 'UNSAFE_PROFILE_ACCEPTED'}};'PASS'`),'PASS');
});
win('Pending WEB steady root is exact and the real three-service readiness gate invokes startup only after all three are ready',()=>{
 const body=String.raw`
$tokens=$null;$parseErrors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(`+q(script)+String.raw`,[ref]$tokens,[ref]$parseErrors)
$fn=$ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Test-ErpSteadyWebStartupGeneration'},$true)
if($fn.Count-ne1){throw 'PENDING_STEADY_PREDICATE_MISSING'}
. ([scriptblock]::Create($fn[0].Extent.Text.Replace('$PSScriptRoot','$fixtureSteadyRoot')))
$expected='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PENDING-WEB-STEADY-OWNER-POST-RECOVERY-20261101'
foreach($candidate in @($expected,($expected+'-other'),$expected.ToLowerInvariant(),$expected.Replace('OWNER-POST-RECOVERY-20261101','OWNER-BIRTH-V2-20261101'))){$fixtureSteadyRoot=$candidate;if((Test-ErpSteadyWebStartupGeneration)-ne($candidate-ceq$expected)){throw 'PENDING_STEADY_ALIAS_ACCEPTED'}}
$fixtureSteadyRoot=$expected;$script:startCalls=0;$script:stateWrites=0;$script:notReady=$false
function Get-ErpMutexName{'isolated-fixture-no-kernel-mutex'}
function New-Object {param($TypeName,$ArgumentList);if($TypeName-cne'Threading.Mutex'){throw 'UNEXPECTED_OBJECT'};$m=[pscustomobject]@{};$m|Add-Member ScriptMethod WaitOne {$true};$m|Add-Member ScriptMethod ReleaseMutex {};$m|Add-Member ScriptMethod Dispose {};return $m}
function New-Item {param($ItemType,[switch]$Force,$Path)}
function Assert-ErpRelease {param($Config);@{packageId='isolated-fixture'}}
function Get-ErpServiceDefinitions {param($Config);@(@{Name='api';Port=4144},@{Name='native';Port=4146},@{Name='web';Port=5194})}
function Test-Path {param($LiteralPath);$false}
function Get-ErpServiceListeners {param($Definition,$Config);[pscustomobject]@{OwningProcess=$Definition.Port}}
function Assert-ErpOwnedProcess {param($ProcessId,$Config,$Definition,$CreatedAt);[pscustomobject]@{ProcessId=$ProcessId;CreationDate=[DateTime]::UtcNow}}
function Assert-ErpHealth {param($Config,$Definition);if($script:notReady-and$Definition.Name-ceq'native'){throw 'fixture-not-ready'}}
function Start-ErpSteadyWebStartup {$script:startCalls++;@{state='fixture-start-dispatched';attempted=$true}}
function Start-Process {throw 'UNEXPECTED_REAL_START'}
function Stop-Process {throw 'UNEXPECTED_REAL_STOP'}
function Write-ErpState {param($Path,$Value);$script:stateWrites++}
function Get-ScheduledTask {param($TaskName,$TaskPath,$ErrorAction);$null}
$cfg=[pscustomobject]@{RepoRoot='C:\isolated-fixture';OwnerSid='fixture-identity';RuntimeDir='C:\isolated-fixture\runtime';LogDir='C:\isolated-fixture\logs';SourceCommit=('f'*40);TaskName='fixture';ExpectedDatabase='fixture'}
Invoke-ErpOwnedSession $cfg -SinglePass
if($script:startCalls-ne1-or$script:stateWrites-lt3){throw 'THREE_READY_DID_NOT_DISPATCH_PENDING_STEADY'}
$script:notReady=$true;Invoke-ErpOwnedSession $cfg -SinglePass
if($script:startCalls-ne1){throw 'INCOMPLETE_SERVICES_STARTED_PENDING_WEB'}
'PASS'`;
 assert.equal(run(body),'PASS');
});