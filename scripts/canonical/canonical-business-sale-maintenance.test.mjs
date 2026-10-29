import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const dir=import.meta.dirname,ps=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,q=s=>"'"+s.replaceAll("'","''")+"'",win={skip:process.platform!=='win32'};
function run(body){return execFileSync(ps,['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd();&([scriptblock]::Create($s))'],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;foreach($m in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules/'+$m+'/'+$m+'.psd1'))};. ${q(path.join(dir,'canonical-business-sale-maintenance.ps1'))};${body}`,encoding:'utf8',timeout:30000,windowsHide:true}).trim();}
const fixture=String.raw`
function Read-ErpBusinessSalePinnedFile {param($Path,$Hash);if($Hash-cnotin@('35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe','050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024')){throw 'FIXTURE_INPUT_PIN'};return ,([byte[]](0))}
function Get-ErpBusinessSaleNativeInputs {if(Get-Variable pinnedFixtureArtifact -Scope Script -ErrorAction SilentlyContinue){return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';artifact=($script:pinnedFixtureArtifact|ConvertTo-Json -Depth 32|ConvertFrom-Json)}};return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe'}}
$cap=[pscustomobject]@{schema='fixture-cap';id='fixture';rehearsalOnly=$false}
$r=[pscustomobject]@{token=$cap;tokenJson=($cap|ConvertTo-Json -Compress);closed=$false;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;inputHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';phase='Prepared';rehearsalOnly=$false;rehearsalAttempted=$false;rehearsalFailed=$false;candidateBytes=[byte[]](1,2,3);profilePath='fixture-profile';profileBeforeHash='fixture-before';transition=$null;rehearsed=$false;backup=$null;backupSignature=$null;journalHash=$null;events=[Collections.ArrayList]::new();inputs=[pscustomobject]@{artifact=[pscustomobject]@{applyBatches=@([pscustomobject]@{sql='apply-before'},[pscustomobject]@{sql='apply-after'});inverseBatches=@([pscustomobject]@{sql='inverse-history-cas'},[pscustomobject]@{sql='inverse-before'})}}}
[void]$script:ErpBusinessSaleAdmissions.Add($r)
function Reject([scriptblock]$f){$failed=$false;try{&$f|Out-Null}catch{$failed=$true};if(!$failed){throw 'EXPECTED_REJECTION'}}
`;
const nativeFixture=fixture+String.raw`
$script:pinnedFixtureArtifact=$r.inputs.artifact|ConvertTo-Json -Depth 32|ConvertFrom-Json
$script:trace=[Collections.ArrayList]::new();$script:fail='';$script:commits=0;$script:rollbacks=0;$script:opens=0
function Assert-ErpBusinessSaleNativeQuiescence {param($Record);[pscustomobject]@{vault='fixture-only'}}
function Write-ErpBusinessSaleNativeEvent {param($Record,$Event);[void]$script:trace.Add('event:'+ $Event)}
function Open-ErpBusinessSaleSqlConnection {
 $script:opens++;$tx=[pscustomobject]@{}
 $tx|Add-Member ScriptMethod Commit {$script:commits++;if($script:fail-ceq'commit'){throw 'LOST_COMMIT_ACK'}}
 $tx|Add-Member ScriptMethod Rollback {$script:rollbacks++}
 $tx|Add-Member ScriptMethod Dispose {}
 $connection=[pscustomobject]@{tx=$tx}
 $connection|Add-Member ScriptMethod BeginTransaction {param($isolation);return $this.tx}
 $connection|Add-Member ScriptMethod Dispose {}
 return $connection
}
function Invoke-ErpBusinessSaleSqlBatch {param($Connection,$Transaction,$Sql);[void]$script:trace.Add($Sql);if($script:fail-ceq$Sql){throw 'NATIVE_CAS_REJECTED'}}
function New-ErpBusinessSaleVerifiedBackup {param($Connection);[void]$script:trace.Add('backup');if($script:fail-ceq'backup'){throw 'BACKUP_NOT_VERIFIED'};return [pscustomobject]@{path='fixture-backup';restored=$false}}
function Test-ErpBusinessSaleVerifiedBackup {param($Record,$Connection);[void]$script:trace.Add('backup-reverify');if($script:fail-ceq'backup-reverify'){throw 'BACKUP_NOT_VERIFIED'}}
function Test-ErpBusinessSaleBefore {param($Inputs);[void]$script:trace.Add('before-readback')}
function Test-ErpBusinessSaleAfter {param($Inputs);[void]$script:trace.Add('after-readback');if($script:fail-ceq'after-readback'){throw 'AFTER_CHANGED'}}
`;

test('new frozen permission artifact pins reject old revision, scope drift and descriptor mismatch',win,()=>{
 assert.equal(run(String.raw`
$script:descriptor=[pscustomobject]@{readerDefinitions=[pscustomobject]@{}}
1..14|ForEach-Object{$script:descriptor.readerDefinitions|Add-Member NoteProperty ('reader'+$_) ('A'*64)}
$sql='offline-fixture-no-executor';$hash=(Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($sql))).ToUpperInvariant()
$script:artifact=[pscustomobject]@{revisionHash='DEBAFECB1915AEC135E58107F64EE4243D7B93E3C091799EB8E4F29500C477DE';profileHash='9CBDA03D44559F2CC1487B526F4E67E7301467ECBF576126AF9BEBDA18A237F9';installable=$false;executeAllowed=$false;nativeCompiled=$false;changedModules=@(1..25);newModules=@(1..31);appDescriptor=$script:descriptor;applyBatches=@([pscustomobject]@{sql=$sql;sourceHash=$hash});inverseBatches=@()}
function Read-ErpBusinessSalePinnedFile {
 param($Path,$Hash)
 $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-permission-snapshot-source-20261029'
 if($Path-ceq(Join-Path $root 'b6-native-complete-source-artifact-20261028.json')-and$Hash-ceq'35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe'){return ,([Text.Encoding]::UTF8.GetBytes(($script:artifact|ConvertTo-Json -Depth 32)))}
 if($Path-ceq(Join-Path $root 'b6-native-complete-source-app-descriptor-20261028.json')-and$Hash-ceq'050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024'){return ,([Text.Encoding]::UTF8.GetBytes(($script:descriptor|ConvertTo-Json -Depth 32)))}
 throw 'WRONG_FROZEN_INPUT_PIN'
}
[void](Get-ErpBusinessSaleNativeInputs)
$saved=$script:artifact|ConvertTo-Json -Depth 32
foreach($case in @('old','profile','installable','executeAllowed','nativeCompiled','changed','new','readers','descriptor','batch')){
 $script:artifact=$saved|ConvertFrom-Json
 switch($case){old{$script:artifact.revisionHash='F05B63189AFC7A5BAF6E5686631CC3B793ECF73F94C472DB32747138EBAFC7C8'}profile{$script:artifact.profileHash='A'*64}installable{$script:artifact.installable=$true}executeAllowed{$script:artifact.executeAllowed=$true}nativeCompiled{$script:artifact.nativeCompiled=$true}changed{$script:artifact.changedModules=@(1..24)}new{$script:artifact.newModules=@(1..30)}readers{$script:descriptor.readerDefinitions.PSObject.Properties.Remove('reader14')}descriptor{$script:artifact.appDescriptor|Add-Member changed $true}batch{$script:artifact.applyBatches[0].sql='changed'}}
 $failed=$false;try{[void](Get-ErpBusinessSaleNativeInputs)}catch{$failed=$true};if(!$failed){throw ('INPUT_SCOPE_ACCEPTED_'+$case)}
 if($case-ceq'readers'){$script:descriptor.readerDefinitions|Add-Member reader14 ('A'*64)}
}
'PASS'
`),'PASS');
});

test('rehearsal-only purpose denies apply and repeats, then leaves a verified Restored phase without commit',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$cap.rehearsalOnly=$true;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r.rehearsalOnly=$true
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
foreach($alias in @('apply','APPLY','rehearse','REHEARSE','inverse','INVERSE')){Reject {Invoke-ErpBusinessSaleNativeRevision $cap $alias}}
if($script:opens-ne0-or$script:trace.Count-ne0){throw 'EARLY_REHEARSAL_EFFECT'}
Invoke-ErpBusinessSaleNativeRevision $cap Rehearse
if(!$r.rehearsed-or!$r.rehearsalAttempted-or$r.rehearsalFailed-or$r.phase-cne'Restored'-or$script:commits-ne0-or$script:rollbacks-ne1-or!$script:trace.Contains('before-readback')){throw 'REHEARSAL_NOT_RESTORED'}
$count=$script:trace.Count;$opens=$script:opens
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse};Invoke-ErpBusinessSaleNativeRevision $cap Inverse
if($script:trace.Count-ne$count-or$script:opens-ne$opens-or$script:commits-ne0){throw 'REHEARSAL_EFFECT_REPLAYED'}
'PASS'
`),'PASS');
});

test('failed finite rehearsal permits only fresh before-state verification, never inverse batches or retry',win,()=>{
 for(const failure of ['backup','apply-after'])assert.equal(run(nativeFixture+`$script:fail=${q(failure)};`+String.raw`
$cap.rehearsalOnly=$true;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r.rehearsalOnly=$true
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}
if(!$r.rehearsalAttempted-or!$r.rehearsalFailed-or$r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0){throw 'FAILED_REHEARSAL_ACCEPTED'}
$count=$script:trace.Count;$opens=$script:opens
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply}
if($script:trace.Count-ne$count-or$script:opens-ne$opens){throw 'FAILED_REHEARSAL_RETRIED'}
Invoke-ErpBusinessSaleNativeRevision $cap Inverse
if($r.phase-cne'Restored'-or$script:trace.Count-ne($count+1)-or$script:trace[$count]-cne'before-readback'-or$script:commits-ne0-or$script:trace.Contains('inverse-history-cas')){throw 'REHEARSAL_INVERSE_EXECUTED'}
'PASS'
`),'PASS');
 assert.equal(run(nativeFixture+String.raw`
$cap.rehearsalOnly=$true;$r.tokenJson=$cap|ConvertTo-Json -Compress;$r.rehearsalOnly=$true;$r.rehearsalAttempted=$true;$r.rehearsalFailed=$true
function Test-ErpBusinessSaleBefore {throw 'BEFORE_CHANGED'}
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse};if($r.phase-cne'Prepared'-or$script:opens-ne0-or$script:commits-ne0){throw 'FAILED_BEFORE_ACCEPTED'}
$r.phase='Applied';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
if($script:opens-ne0-or$script:commits-ne0){throw 'FORGED_APPLIED_REHEARSAL_INVERSED'};'PASS'
`),'PASS');
});

test('purpose is bound to the original token and cannot be changed through JSON or private-record drift',win,()=>{
 assert.equal(run(fixture+String.raw`
[void](Get-ErpBusinessSaleNativeAdmissionContext $cap)
$cap.rehearsalOnly=$true;Reject {Get-ErpBusinessSaleNativeAdmissionContext $cap};$cap.rehearsalOnly=$false
$r.rehearsalOnly=$true;Reject {Get-ErpBusinessSaleNativeAdmissionContext $cap};$r.rehearsalOnly=$false
$r.rehearsalOnly='false';Reject {Get-ErpBusinessSaleNativeAdmissionContext $cap};$r.rehearsalOnly=$false
Reject {Get-ErpBusinessSaleNativeAdmissionContext ($cap|ConvertTo-Json|ConvertFrom-Json)}
[void](Get-ErpBusinessSaleNativeAdmissionContext $cap);'PASS'
`),'PASS');
});

test('actual factory issues immutable purpose with default mutation flow preserved using only a disposable profile',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-purpose-'))),file=path.join(temp,'profile.json');
 const profile={goal8SyntheticDaySeal:{packageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'}};
 fs.writeFileSync(file,JSON.stringify(profile));const before=fs.readFileSync(file);
 try{assert.equal(run(fixture+`$fixtureProfile=${q(file)};`+String.raw`
# Only the fixed profile location is redirected in this disposable test copy;
# the real factory, issuer registry, token shape and purpose checks run intact.
$factory=(Get-Item Function:New-ErpBusinessSaleNativeProfileAdmission).ScriptBlock.ToString().Replace('C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json',$fixtureProfile.Replace("'","''"))
Set-Item Function:New-ErpBusinessSaleNativeProfileAdmission ([scriptblock]::Create($factory))
$script:factoryBefore=0
$config=[pscustomobject]@{OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;ApiComponent=[pscustomobject]@{ManifestSha256='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'}}
function Read-ErpStartupConfig {param($Path);return $config}
function Read-ErpBusinessSaleOwnerSource {[pscustomobject]@{source='offline-factory-fixture'}}
function Get-ErpBusinessSaleNativeInputs {[pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';descriptor=[pscustomobject]@{schema='offline-descriptor'}}}
function Test-ErpBusinessSaleBefore {param($Inputs);$script:factoryBefore++}
function Open-ErpBusinessSaleSqlConnection {throw 'SQL_FORBIDDEN'}
$normal=New-ErpBusinessSaleNativeProfileAdmission $config
$only=New-ErpBusinessSaleNativeProfileAdmission $config -RehearsalOnly
if($normal.rehearsalOnly-isnot[bool]-or$normal.rehearsalOnly-or$only.rehearsalOnly-isnot[bool]-or!$only.rehearsalOnly-or$script:factoryBefore-ne2){throw 'FACTORY_PURPOSE_NOT_ISSUED'}
foreach($token in @($normal,$only)){
 $context=Get-ErpBusinessSaleNativeAdmissionContext $token
 if($context.rehearsalOnly-ne$token.rehearsalOnly-or$context.rehearsalAttempted-or$context.rehearsalFailed-or$context.rehearsed-or$context.phase-cne'Prepared'){throw 'FACTORY_CONTEXT_PURPOSE_LOST'}
 Reject {Get-ErpBusinessSaleNativeAdmissionContext ($token|ConvertTo-Json|ConvertFrom-Json)}
}
function Read-ErpBusinessSaleOwnerSource {[pscustomobject]@{source='offline-sealed-owner';rehearsalOnly=$true}}
$sealed=New-ErpBusinessSaleNativeProfileAdmission $config
if(!$sealed.rehearsalOnly-or!(Get-ErpBusinessSaleNativeAdmissionContext $sealed).rehearsalOnly){throw 'SEALED_SOURCE_PURPOSE_LOST'}
$only.rehearsalOnly=$false;Reject {Get-ErpBusinessSaleNativeAdmissionContext $only};'PASS'
`),'PASS');assert.deepEqual(fs.readFileSync(file),before);}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-purpose-'));fs.rmSync(temp,{recursive:true});}
});
// Reflection is confined to the offline fixture: no SQL connection, target or
// production exception constructor is changed. Exercise a real SqlException.
const sqlExceptionFixture=String.raw`
Add-Type -ReferencedAssemblies System.Data -TypeDefinition @'
using System;
using System.Data.SqlClient;
using System.Reflection;
public static class B6SqlErrorFixture {
 public static SqlException Create(string procedure) {
  var flags=BindingFlags.NonPublic|BindingFlags.Instance;
  var collection=(SqlErrorCollection)Activator.CreateInstance(typeof(SqlErrorCollection),true);
  ConstructorInfo ctor=null;
  foreach(var c in typeof(SqlError).GetConstructors(flags)) if(c.GetParameters().Length==8) ctor=c;
  var error=(SqlError)ctor.Invoke(new object[]{8711,(byte)1,(byte)16,"PRIVATE_SERVER","PRIVATE_SQL_AND_AMOUNT",procedure,118,null});
  typeof(SqlErrorCollection).GetMethod("Add",flags).Invoke(collection,new object[]{error});
  var factory=typeof(SqlException).GetMethod("CreateException",BindingFlags.NonPublic|BindingFlags.Static,null,new Type[]{typeof(SqlErrorCollection),typeof(string)},null);
  return (SqlException)factory.Invoke(null,new object[]{collection,"fixture"});
 }
}
'@
`;

test('nested real provider error reaches the actual rehearsal journal with batch identity, rollback and no sensitive text',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-error-')));
 try{assert.equal(run(String.raw`
$realBatch=(Get-Item Function:Invoke-ErpBusinessSaleSqlBatch).ScriptBlock;$realJournal=(Get-Item Function:Write-ErpBusinessSaleNativeEvent).ScriptBlock
`+nativeFixture+sqlExceptionFixture+`$script:vault=${q(temp)};`+String.raw`
Set-Item Function:Invoke-ErpBusinessSaleSqlBatch $realBatch;Set-Item Function:Write-ErpBusinessSaleNativeEvent $realJournal
foreach($b in $script:pinnedFixtureArtifact.applyBatches){$b|Add-Member NoteProperty id 'synthetic-command';$b|Add-Member NoteProperty sourceHash ('A'*64)}
function Assert-ErpBusinessSaleNativeQuiescence {param($Record);[pscustomobject]@{vault=$script:vault}}
function Open-ErpBusinessSaleSqlConnection {
 $tx=[pscustomobject]@{};$tx|Add-Member ScriptMethod Rollback {$script:rollbacks++};$tx|Add-Member ScriptMethod Commit {$script:commits++};$tx|Add-Member ScriptMethod Dispose {}
 $c=[pscustomobject]@{tx=$tx};$c|Add-Member ScriptMethod BeginTransaction {param($isolation);$this.tx};$c|Add-Member ScriptMethod Dispose {}
 $c|Add-Member ScriptMethod CreateCommand {
  $cmd=[pscustomobject]@{CommandTimeout=0;Transaction=$null;CommandText=''}
  $cmd|Add-Member ScriptMethod ExecuteNonQuery {
   if(!$this.CommandText.StartsWith("SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);")){throw 'PREFIX_CHANGED'}
   if($this.CommandText.EndsWith('apply-after')){throw [InvalidOperationException]::new('PRIVATE_WRAPPER',[B6SqlErrorFixture]::Create('dbo.usp_b6_reader_fixture_v1'))};return 0
  };$cmd|Add-Member ScriptMethod Dispose {};return $cmd
 };return $c
}
$caught=$null;try{Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}catch{$caught=$_}
if(!$caught-or!(Get-ErpBusinessSaleSqlFailure $caught $null Other -1)){throw 'ORIGINAL_PROVIDER_ERROR_LOST'}
if($script:rollbacks-ne1-or$script:commits-ne0-or$r.rehearsed-or$r.phase-cne'Prepared'){throw 'FAILED_REHEARSAL_MUTATED'}
$raw=[IO.File]::ReadAllText((Join-Path $script:vault 'native-b6-journal.jsonl'))
if($raw-cmatch'PRIVATE_|apply-after|SET XACT_ABORT|CommandText'){throw 'SENSITIVE_ERROR_LOGGED'}
$last=($raw.Trim()-split"\n")[-1]|ConvertFrom-Json;$d=$last.sqlFailure
if($last.event-cne'REHEARSE_FAILED_NO_REPLAY'-or$d.batchPhase-cne'Apply'-or$d.batchIndex-ne1-or$d.batchId-cne'synthetic-command'-or$d.batchSourceHash-cne('A'*64)-or$d.errors[0].number-ne8711-or$d.errors[0].lineNumber-ne118-or$d.errors[0].procedure-cne'dbo.usp_b6_reader_fixture_v1'-or$d.commandPrefixLines-ne1){throw 'SQL_LOCATION_LOST'}
$unsafe=Get-ErpBusinessSaleSqlFailure ([Exception]::new('PRIVATE_WRAPPER',[B6SqlErrorFixture]::Create('PRIVATE_PROCEDURE'))) $null Inverse 3
if($null-ne$unsafe.errors[0].procedure-or$unsafe.errors[0].procedureHash.Length-ne64){throw 'UNTRUSTED_PROCEDURE_EXPOSED'}
if($null-ne(Get-ErpBusinessSaleSqlFailure ([Exception]::new('PRIVATE_NON_SQL')) $null Other -1)){throw 'NON_SQL_MISCLASSIFIED'}
'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-error-'));fs.rmSync(temp,{recursive:true});}
});
test('library import creates no SQL connection or process/service action',win,()=>{
 assert.equal(run(`function Open-ErpBusinessSaleSqlConnection {throw 'SQL_FORBIDDEN'};if($script:ErpBusinessSaleAdmissions.Count-ne0){throw 'IMPORT_ISSUED_AUTHORITY'};'PASS'`),'PASS');
 const text=fs.readFileSync(path.join(dir,'canonical-business-sale-maintenance.ps1'),'utf8');
 assert(!/EncodedCommand|Invoke-Expression|Stop-Process|Start-Process|Invoke-RestMethod|Set-MpPreference/i.test(text));
});
test('inverse batch errors keep their own index and diagnostic failures never replace the original failure',win,()=>{
 assert.equal(run(nativeFixture+sqlExceptionFixture+String.raw`
foreach($b in $script:pinnedFixtureArtifact.inverseBatches){$b|Add-Member NoteProperty id 'synthetic-inverse';$b|Add-Member NoteProperty sourceHash ('B'*64)}
$script:lastSqlFailure=$null
function Write-ErpBusinessSaleNativeEvent {param($Record,$Event,$SqlFailure);if($Event-ceq'REHEARSE_FAILED_NO_REPLAY'){$script:lastSqlFailure=$SqlFailure}}
function Invoke-ErpBusinessSaleSqlBatch {param($Connection,$Transaction,$Sql);if($Sql-ceq'inverse-history-cas'){throw [InvalidOperationException]::new('PRIVATE_WRAPPER',[B6SqlErrorFixture]::Create('dbo.usp_b6_inverse_fixture'))}}
$caught=$null;try{Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}catch{$caught=$_}
if(!$caught-or$script:lastSqlFailure.batchPhase-cne'Inverse'-or$script:lastSqlFailure.batchIndex-ne0-or$script:lastSqlFailure.batchId-cne'synthetic-inverse'-or$script:rollbacks-ne1-or$script:commits-ne0){throw 'INVERSE_BATCH_LOCATION_LOST'}
$r.backup=$null
function Get-ErpBusinessSaleSqlFailure {throw 'DIAGNOSTIC_FAILURE'}
function Write-ErpBusinessSaleNativeEvent {param($Record,$Event,$SqlFailure);if($Event-ceq'REHEARSE_FAILED_NO_REPLAY'){throw 'JOURNAL_FAILURE'}}
$caught=$null;try{Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}catch{$caught=$_}
$e=$caught.Exception;$found=$false;for($i=0;$e-and$i-lt8;$i++){if($e-is[Data.SqlClient.SqlException]){$found=$true;break};$e=$e.InnerException}
if(!$found-or$script:rollbacks-ne2-or$script:commits-ne0){throw 'DIAGNOSTIC_MASKED_PROVIDER_ERROR'}
'PASS'
`),'PASS');
});
test('real SqlClient builder accepts the fixed keywords without connecting or relaxing TLS',win,()=>{
 assert.equal(run(String.raw`$s=New-ErpBusinessSaleSqlConnectionString;$b=[Data.SqlClient.SqlConnectionStringBuilder]::new($s);if($b.DataSource-cne'Semih\MELISADEV'-or$b.InitialCatalog-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or!$b.IntegratedSecurity-or!$b.Encrypt-or$b.TrustServerCertificate-or$b.Pooling-or$b.ConnectTimeout-ne5-or$b.ApplicationName-cne'Melisa-B6-Finite-Maintenance'){throw 'FIXED_SQL_CONNECTION_CHANGED'};$c=[Data.SqlClient.SqlConnection]::new($s);try{if($c.State-ne[Data.ConnectionState]::Closed){throw 'UNEXPECTED_CONNECTION'}}finally{$c.Dispose()};'PASS'`),'PASS');
});
test('each native command declares the compiler scratch variable in its own SQL scope',win,()=>{
 assert.equal(run(String.raw`
$script:observed=$null;$command=[pscustomobject]@{CommandTimeout=0;Transaction=$null;CommandText=''}
$command|Add-Member ScriptMethod ExecuteNonQuery {$script:observed=$this.CommandText;return 0};$command|Add-Member ScriptMethod Dispose {}
$connection=[pscustomobject]@{command=$command};$connection|Add-Member ScriptMethod CreateCommand {return $this.command}
$tx=[pscustomobject]@{fixture=$true};Invoke-ErpBusinessSaleSqlBatch $connection $tx 'SET @b6_ddl=N''fixture'';'
if($script:observed-cne("SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);"+[char]10+"SET @b6_ddl=N'fixture';")-or![object]::ReferenceEquals($command.Transaction,$tx)){throw 'BATCH_VARIABLE_SCOPE'};'PASS'
`),'PASS');
});
test('native admission denies JSON copies, altered token, foreign PID/thread/owner and wrong phase',win,()=>{
 assert.equal(run(fixture+String.raw`
[void](Assert-ErpBusinessSaleNativeProfileAdmission $cap Prepared)
Reject {Assert-ErpBusinessSaleNativeProfileAdmission ($cap|ConvertTo-Json|ConvertFrom-Json) Prepared}
foreach($field in @('pid','thread','owner','phase')){$old=$r.$field;$r.$field=if($field-ceq'owner'){'foreign-owner'}elseif($field-ceq'phase'){'Applied'}else{-1};Reject {Assert-ErpBusinessSaleNativeProfileAdmission $cap Prepared};$r.$field=$old}
$cap.id='altered';Reject {Assert-ErpBusinessSaleNativeProfileAdmission $cap Identity};$cap.id='fixture'
$copy=Get-ErpBusinessSaleCandidateProfileBytes $cap;$copy[0]=9;if((Get-ErpBusinessSaleCandidateProfileBytes $cap)[0]-ne1){throw 'BYTES_ESCAPED'}
$r.phase='Unknown';Reject {Assert-ErpBusinessSaleNativeProfileAdmission $cap Identity};'PASS'
`),'PASS');
});
test('native binding rejects changed profile before/candidate hashes and a second transition',win,()=>{
 assert.equal(run(fixture+String.raw`
$t=[pscustomobject]@{scope='TEST125-API-B6-ca620bac-20261028';apiProfileBeforeSha256='fixture-before';apiProfileCandidateSha256=(Get-ErpBusinessSaleHash $r.candidateBytes)}
$script:c=[pscustomobject]@{nativeProfileAdmission=$cap;apiPath='fixture-profile'}
function Assert-Test125ReadPairIssued {param($Transition);if(![object]::ReferenceEquals($Transition,$t)){throw 'NOT_ISSUED'};return $script:c}
$t.apiProfileBeforeSha256='changed';Reject {Bind-ErpBusinessSaleNativeProfileTransition $cap $t};$t.apiProfileBeforeSha256='fixture-before'
$t.apiProfileCandidateSha256='changed';Reject {Bind-ErpBusinessSaleNativeProfileTransition $cap $t};$t.apiProfileCandidateSha256=Get-ErpBusinessSaleHash $r.candidateBytes
Bind-ErpBusinessSaleNativeProfileTransition $cap $t;Reject {Bind-ErpBusinessSaleNativeProfileTransition $cap $t};'PASS'
`),'PASS');
});
test('native mutation requires the same retained paused API binding, stopped supervisor and durable vault',win,()=>{
 assert.equal(run(fixture+String.raw`
$r.transition=[pscustomobject]@{fixture='transition'};$binding=[pscustomobject]@{held=$true;stopped=$true};$script:Test125ApiBinding=$binding
$script:c=[pscustomobject]@{activeBinding=$binding;taskStopped=$true;vault='fixture-vault'}
function Assert-Test125ReadPairIssued {param($Transition);if(![object]::ReferenceEquals($Transition,$r.transition)){throw 'NOT_ISSUED'};return $script:c}
function Assert-Test125ApiStoppedSupervisor {param($Binding)};function Test-Test125ApiPhysicalPause {param($Binding);return $true};function Assert-Test125ReadPairCompanions {param($Context)}
[void](Assert-ErpBusinessSaleNativeQuiescence $r)
foreach($field in @('held','stopped')){$binding.$field=$false;Reject {Assert-ErpBusinessSaleNativeQuiescence $r};$binding.$field=$true}
$script:c.taskStopped=$false;Reject {Assert-ErpBusinessSaleNativeQuiescence $r};$script:c.taskStopped=$true
$script:c.vault=$null;Reject {Assert-ErpBusinessSaleNativeQuiescence $r};$script:c.vault='fixture-vault'
$script:c.activeBinding=[pscustomobject]@{held=$true;stopped=$true};Reject {Assert-ErpBusinessSaleNativeQuiescence $r};'PASS'
`),'PASS');
});
test('native journal persists intent and rejects changed bytes or adoption of an existing unissued journal',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-journal-')));
 try{assert.equal(run(fixture+`$script:vault=${q(temp)};`+String.raw`
function Assert-ErpBusinessSaleNativeQuiescence {param($Record);[pscustomobject]@{vault=$script:vault}}
Write-ErpBusinessSaleNativeEvent $r 'APPLY_INTENT';$first=$r.journalHash;Write-ErpBusinessSaleNativeEvent $r 'BACKUP_VERIFIED'
if(!$first-or$r.journalHash-ceq$first){throw 'JOURNAL_NOT_DURABLE'}
$file=Join-Path $script:vault 'native-b6-journal.jsonl';[IO.File]::AppendAllText($file,'foreign');Reject {Write-ErpBusinessSaleNativeEvent $r 'APPLY_VERIFIED'}
$r.journalHash=$null;Reject {Write-ErpBusinessSaleNativeEvent $r 'ADOPT_EXISTING'};'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-journal-'));fs.rmSync(temp,{recursive:true});}
});
test('rehearsal runs apply and inverse then rolls back; apply requires backup and fresh after-readback',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};if($script:opens-ne0){throw 'EARLY_SQL'}
Invoke-ErpBusinessSaleNativeRevision $cap Rehearse
if(!$r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0-or$script:rollbacks-ne1-or!$script:trace.Contains('inverse-history-cas')){throw 'REHEARSAL_NOT_RESTORED'}
Invoke-ErpBusinessSaleNativeRevision $cap Apply
if($r.phase-cne'Applied'-or$script:commits-ne1-or$script:trace.IndexOf('backup')-gt$script:trace.IndexOf('apply-before')-or@($script:trace|Where-Object{$_-ceq'backup'}).Count-ne1-or!$script:trace.Contains('backup-reverify')-or!$script:trace.Contains('after-readback')){throw 'APPLY_NOT_VERIFIED'}
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};if($script:commits-ne1){throw 'SECOND_EFFECT'}
Invoke-ErpBusinessSaleNativeRevision $cap Inverse;if($r.phase-cne'Restored'-or$script:commits-ne2){throw 'INVERSE_FAILED'}
Invoke-ErpBusinessSaleNativeRevision $cap Inverse;if($script:commits-ne2){throw 'SECOND_INVERSE'};'PASS'
`),'PASS');
});
test('failed compile or unverified backup prevents commit and does not produce Applied',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$script:fail='apply-after';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}
if($r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0-or$script:rollbacks-ne1){throw 'FAILED_REHEARSAL_ACCEPTED'}
;'PASS'
`),'PASS');
 assert.equal(run(nativeFixture+String.raw`
$script:fail='backup';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Rehearse}
if($r.rehearsed-or$r.phase-cne'Prepared'-or$script:commits-ne0-or$script:trace.Contains('apply-before')){throw 'REHEARSAL_WITHOUT_BACKUP'}
$script:fail='backup-reverify';$r.rehearsed=$true;Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply}
if($r.phase-cne'Prepared'-or$script:commits-ne0-or$script:trace.Contains('apply-before')){throw 'BACKUP_BYPASS'};'PASS'
`),'PASS');
});
test('mutable retained diagnostic inputs never become the SQL source',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$r.inputs.artifact.applyBatches[0].sql='unapproved-retained-sql';$r.rehearsed=$true
Invoke-ErpBusinessSaleNativeRevision $cap Apply
if($script:trace.Contains('unapproved-retained-sql')-or!$script:trace.Contains('apply-before')){throw 'UNPINNED_SQL_SOURCE'};'PASS'
`),'PASS');
});
test('backup reuse requires the exact immutable proof, hard-root path and fresh timestamp before VERIFYONLY',win,()=>{
 assert.equal(run(fixture+String.raw`
Add-Type -AssemblyName System.Data;$native=[Data.SqlClient.SqlCommand]::new();$script:verified=0
function Open-ErpBusinessSaleVerifiedBackupStream {param($Path,$Sha256);return [IO.MemoryStream]::new([byte[]](1,2,3))}
$command=[pscustomobject]@{CommandTimeout=0;CommandText='';Parameters=$native.Parameters}
$command|Add-Member ScriptMethod ExecuteNonQuery {$script:verified++;if($this.CommandText-cne'RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;'){throw 'UNEXPECTED_SQL'};return 0};$command|Add-Member ScriptMethod Dispose {}
$connection=[pscustomobject]@{command=$command};$connection|Add-Member ScriptMethod CreateCommand {return $this.command}
$r.backup=[pscustomobject]@{path='C:\Sirket\ERP\backups\B6\B6-before-00000000000000000000000000000000.bak';sha256=$r.inputHash;verifiedAt=[datetime]::UtcNow.ToString('o');restored=$false};$r.backupSignature=$r.backup|ConvertTo-Json -Compress
Test-ErpBusinessSaleVerifiedBackup $r $connection;if($script:verified-ne1){throw 'BACKUP_NOT_REVERIFIED'}
foreach($case in @('mutated','stale','future','outside','restored')){
 $saved=$r.backup|ConvertTo-Json -Compress;$savedSig=$r.backupSignature
 switch($case){mutated{$r.backup.sha256='changed'}stale{$r.backup.verifiedAt=[datetime]::UtcNow.AddMinutes(-11).ToString('o')}future{$r.backup.verifiedAt=[datetime]::UtcNow.AddMinutes(1).ToString('o')}outside{$r.backup.path='C:\other\B6-before-00000000000000000000000000000000.bak'}restored{$r.backup.restored=$true}}
 if($case-cne'mutated'){$r.backupSignature=$r.backup|ConvertTo-Json -Compress};Reject {Test-ErpBusinessSaleVerifiedBackup $r $connection}
 $r.backup=$saved|ConvertFrom-Json;$r.backupSignature=$savedSig
}
if($script:verified-ne1){throw 'INVALID_BACKUP_REACHED_SQL'};$native.Dispose();'PASS'
`),'PASS');
});
test('backup verification streams and retains exact file identity without loading a database backup into memory',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-backup-stream-'))),file=path.join(temp,'inert.bak');fs.writeFileSync(file,Buffer.alloc(1024*1024,0x5a));
 try{assert.equal(run(`$file=${q(file)};`+String.raw`
$sha=(Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant();$stream=Open-ErpBusinessSaleVerifiedBackupStream $file $sha
try{
 if($stream-isnot[IO.FileStream]-or$stream.Position-ne0-or$stream.Length-ne1048576){throw 'NOT_RETAINED_STREAM'}
 $denied=$false;try{$writer=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite);$writer.Dispose()}catch{$denied=$true};if(!$denied){throw 'BACKUP_WRITE_NOT_EXCLUDED'}
}finally{$stream.Dispose()}
$rejected=$false;try{$bad=Open-ErpBusinessSaleVerifiedBackupStream $file ('0'*64);$bad.Dispose()}catch{$rejected=$true};if(!$rejected){throw 'BACKUP_HASH_NOT_CHECKED'};'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-backup-stream-'));fs.rmSync(temp,{recursive:true});}
});
test('lost commit acknowledgement or independent after-readback failure becomes Unknown without inverse/retry',win,()=>{
 for(const failure of ['commit','after-readback'])assert.equal(run(nativeFixture+`$r.rehearsed=$true;$script:fail=${q(failure)};`+String.raw`
Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};if($r.phase-cne'Unknown'){throw 'UNKNOWN_ADOPTED'}
$count=$script:commits;Reject {Invoke-ErpBusinessSaleNativeRevision $cap Apply};Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
if($script:commits-ne$count){throw 'UNKNOWN_REPLAYED'};'PASS'
`),'PASS');
});
test('native history inverse rejection preserves Applied and never commits a destructive rollback',win,()=>{
 assert.equal(run(nativeFixture+String.raw`
$r.phase='Applied';$script:fail='inverse-history-cas';Reject {Invoke-ErpBusinessSaleNativeRevision $cap Inverse}
if($r.phase-cne'Applied'-or$script:commits-ne0-or$script:rollbacks-ne1-or$script:trace.Contains('inverse-before')){throw 'HISTORY_BYPASS'};'PASS'
`),'PASS');
});
test('B6 startup accepts only the exact descriptor and read-only profile delta; legacy seals and secrets stay unchanged',win,()=>{
 assert.equal(run(`. ${q(path.join(dir,'start-owned-test.ps1'))} -Library;`+String.raw`
$script:d=[pscustomobject]@{schemaVersion='fixture';readerDefinitions=[pscustomobject]@{reader='fixture-hash'}}
function Get-ErpBusinessSaleNativeInputs {[pscustomobject]@{descriptor=$script:d}}
$base=[pscustomobject]@{database='fixture';jwtAccessSecret='fixture-only';goal8SyntheticDaySeal=[pscustomobject]@{packageId='base';sourceCommit='fixture-source';dayId='fixture-day';definitionHash='fixture-definition'}}
$before=$base|ConvertTo-Json -Depth 32 -Compress;$api=$base|ConvertTo-Json -Depth 32|ConvertFrom-Json
$api.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'
$api|Add-Member businessWorkface ([pscustomobject]@{id='fixture-workface'});$api|Add-Member businessSessionAccessSecret 'fixture-business'
$api|Add-Member businessSaleAdmission ($script:d|ConvertTo-Json -Depth 32|ConvertFrom-Json);$api|Add-Member businessSaleWritesEnabled $false
$m=[pscustomobject]@{packageId=$api.goal8SyntheticDaySeal.packageId;sourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';businessSaleSourceCommit='ca620bac30f96034b33d4410dc43576a38a38707';businessSaleCandidate=[pscustomobject]@{recordingEnabled=$false}}
Assert-ErpApiPrivateProfile $base $api $m
foreach($case in @('enable','reader','secret','seal','extra','missing')){
 $bad=$api|ConvertTo-Json -Depth 32|ConvertFrom-Json
 switch($case){enable{$bad.businessSaleWritesEnabled=$true}reader{$bad.businessSaleAdmission.readerDefinitions.reader='changed'}secret{$bad.jwtAccessSecret='changed'}seal{$bad.goal8SyntheticDaySeal.definitionHash='changed'}extra{$bad|Add-Member unsafeField $true}missing{$bad.PSObject.Properties.Remove('businessSaleAdmission')}}
 $rejected=$false;try{Assert-ErpApiPrivateProfile $base $bad $m}catch{$rejected=$true};if(!$rejected){throw 'B6_PROFILE_EXPANSION'}
}
if(($base|ConvertTo-Json -Depth 32 -Compress)-cne$before-or$api.businessSaleWritesEnabled){throw 'ORIGINAL_PROFILE_CHANGED'};'PASS'
`),'PASS');
});
test('real Unknown audit guard recursion persists the failure while normal execution remains rejected',win,()=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'melisa-b6-unknown-')));
 try{assert.equal(run(`. ${q(path.join(dir,'test125-bound-api-quiescence.ps1'))};`+fixture+`$vault=${q(temp)};`+String.raw`
$t=[pscustomobject]@{scope='TEST125-API-B6-ca620bac-20261028';fixture='transition';rehearsalOnly=$false};$proof=[pscustomobject]@{fixture='retained-proof'};$binding=[pscustomobject]@{held=$true;stopped=$true}
$script:Test125ApiBinding=$binding;$script:Test125ReadPairContext=[pscustomobject]@{token=$t;tokenJson=($t|ConvertTo-Json -Depth 12 -Compress);pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;releaseProof=$proof;nativeProfileAdmission=$cap;rehearsalOnly=$false;activeBinding=$binding;taskStopped=$true;vault=$vault}
$r.transition=$t;$r.phase='Unknown'
function Get-ErpReadPairReleaseProofContext {param($Proof);if(![object]::ReferenceEquals($Proof,$script:Test125ReadPairContext.releaseProof)){throw 'PROOF_NOT_ISSUED'};return [pscustomobject]@{fixture='retained'}}
function Assert-Test125ApiStoppedSupervisor {param($Binding)};function Test-Test125ApiPhysicalPause {param($Binding);return $true};function Assert-Test125ReadPairCompanions {param($Context)}
Reject {Assert-Test125ReadPairIssued $t}
Write-ErpBusinessSaleNativeEvent $r 'APPLY_FAILED_NO_REPLAY'
$row=Get-Content -Raw -LiteralPath (Join-Path $vault 'native-b6-journal.jsonl')|ConvertFrom-Json
if($row.phase-cne'Unknown'-or$row.event-cne'APPLY_FAILED_NO_REPLAY'){throw 'UNKNOWN_NOT_DURABLE'}
Reject {Write-ErpBusinessSaleNativeEvent $r 'APPLY_VERIFIED'};Reject {Assert-Test125ReadPairIssued $t};'PASS'
`),'PASS');}finally{assert.equal(path.dirname(fs.realpathSync.native(temp)).toLowerCase(),parent.toLowerCase());assert(path.basename(temp).startsWith('melisa-b6-unknown-'));fs.rmSync(temp,{recursive:true});}
});
