import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./goal7-test-backup.ps1', import.meta.url));
const shell = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const windows = { skip: process.platform !== 'win32' };
const run = args => execFileSync(shell, ['-NoProfile', '-NonInteractive', '-File', ...args], { encoding: 'utf8', windowsHide: true, stdio: 'pipe' });

test('existing backup runner keeps Goal7 default and has no restore, cleanup or task registration', async () => {
  const text = await fs.readFile(source, 'utf8');
  assert.match(text, /\[string\]\$Profile='Goal7'/);
  assert.match(text, /\$goal7Database='MELISA_ERP_SIRKET_TEST_20260929_01'/);
  assert.match(text, /ERP-GOAL7-20261007/);
  assert.match(text, /COPY_ONLY,CHECKSUM\$compression,NOINIT/);
  assert.match(text, /CLEAN-20261022-C5-/);
  assert.doesNotMatch(text, /RESTORE\s+DATABASE|\bDROP\s+DATABASE|Remove-Item|Register-ScheduledTask|Start-ScheduledTask|Set-ScheduledTask|Unregister-ScheduledTask/i);
});

test('real PS5 task definition is offline, exact clean runner, daily, interactive and nonoverlapping', windows, async () => {
  const sid = 'S-1-5-21-111-222-333-1001';
  const output = run([source, '-Profile', 'Clean20261022', '-Mode', 'TaskDefinition', '-OwnerSid', sid]);
  assert.match(output, /<DaysInterval>1<\/DaysInterval>/);
  assert.match(output, /T03:00:00<\/StartBoundary>/);
  assert.match(output, /<UserId>S-1-5-21-111-222-333-1001<\/UserId>/);
  assert.match(output, /<LogonType>InteractiveToken<\/LogonType><RunLevel>LeastPrivilege<\/RunLevel>/);
  assert.match(output, /<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);
  assert.match(output, /<StartWhenAvailable>true<\/StartWhenAvailable>/);
  assert.match(output, /goal7-test-backup\.ps1&quot; -Profile Clean20261022 -Mode Backup/);
  assert.match(output, /-File &quot;C:\\Sirket\\ERP\\clean\\20261022\\runtime\\maintenance\\c5\\goal7-test-backup\.ps1&quot;/);
  assert.match(output, /<WorkingDirectory>C:\\Sirket\\ERP\\clean\\20261022\\runtime\\maintenance\\c5<\/WorkingDirectory>/);
  assert.doesNotMatch(output, /C:\\Sirket\\ERP\\clean\\20261022\\erp(?:\\|<)/);
  assert.doesNotMatch(output, /Production-Candidate|SIRKET_TEST|Password|S4U|HighestAvailable|RestartOnFailure/);
  for (const args of [
    ['-Profile', 'Goal7', '-Mode', 'TaskDefinition', '-OwnerSid', sid],
    ['-Profile', 'Clean20261022', '-Mode', 'TaskDefinition', '-OwnerSid', 'SYSTEM'],
    ['-Profile', 'Clean20261022', '-Mode', 'TaskDefinition', '-OwnerSid', sid, '-RunId', '..\\OLD'],
  ]) assert.throws(() => run([source, ...args]));
  // ValidateSet must not admit a spelling that misses the case-sensitive dispatch.
  for (const args of [
    ['-Profile', 'clean20261022', '-Mode', 'TaskDefinition', '-OwnerSid', sid],
    ['-Profile', 'Clean20261022', '-Mode', 'taskdefinition', '-OwnerSid', sid],
  ]) assert.throws(() => run([source, ...args]), error => String(error.stderr).includes('ParameterArgumentValidationError'));
});

test('real PS5 exact clean identity rejects other server/database/environment, T1, external operations and missing flags', windows, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'melisa-c5-identity-'));
  const harness = path.join(dir, 'identity.ps1');
  await fs.writeFile(harness, String.raw`param([string]$Source)
$ErrorActionPreference='Stop'
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'SOURCE_PARSE_FAILED'}
$function=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object Name -ceq 'Goal7-AssertCleanIdentity')
if($function.Count -ne 1){throw 'FUNCTION_MISSING'}
. ([scriptblock]::Create($function[0].Extent.Text))
function Identity {return @{server='Semih\MELISADEV';database='MELISA_ERP_CLEAN_TEST_20261022';admin=1}}
function Environment {return @{environment_id='e662fd94-d797-4b3b-938a-d143ad758b67';synthetic=1;actual_t1=0;external_operations=0}}
function Reject([scriptblock]$call,[string]$code){try{& $call;throw 'NOT_REJECTED'}catch{if($_.Exception.Message -cne $code){throw}}}
Goal7-AssertCleanIdentity (Identity) @((Environment))
foreach($change in @(@{server='other'},@{database='MELISA_ERP_V2'},@{database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'},@{admin=0})){
 $identity=Identity;foreach($k in $change.Keys){$identity[$k]=$change[$k]};Reject {Goal7-AssertCleanIdentity $identity @((Environment))} 'CLEAN_BACKUP_TARGET_REJECTED'
}
foreach($change in @(@{environment_id='other'},@{synthetic=0},@{actual_t1=1},@{external_operations=1},@{actual_t1=$null})){
 $environment=Environment;foreach($k in $change.Keys){$environment[$k]=$change[$k]};Reject {Goal7-AssertCleanIdentity (Identity) @($environment)} 'CLEAN_BACKUP_ENVIRONMENT_REJECTED'
}
Reject {Goal7-AssertCleanIdentity (Identity) @()} 'CLEAN_BACKUP_ENVIRONMENT_REJECTED'
Reject {Goal7-AssertCleanIdentity (Identity) @((Environment),(Environment))} 'CLEAN_BACKUP_ENVIRONMENT_REJECTED'
Write-Output 'C5_IDENTITY_PASS'
`);
  assert.match(run([harness, '-Source', source]), /C5_IDENTITY_PASS/);
});

test('actual backup orchestration publishes only after verify; failures preserve previous good files and cannot overwrite receipts', windows, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'melisa-c5-backup-'));
  const harness = path.join(dir, 'backup.ps1');
  await fs.writeFile(harness, String.raw`param([string]$Source,[string]$FixtureRoot)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @('Goal7-Save','Goal7-WriteVerifiedBackup')){
 $function=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object Name -ceq $name)
 if($function.Count -ne 1){throw 'FUNCTION_MISSING'};. ([scriptblock]::Create($function[0].Extent.Text))
}
# Only source functions are loaded. These local doubles replace both SQL commands.
function Goal7-Execute($cn,[string]$query){
 $script:queries.Add($query)
 if($query -match 'BACKUP DATABASE'){
  if($script:failure -eq 'backup'){throw 'INJECTED_BACKUP_FAILURE'}
  [IO.File]::WriteAllText($goal7BackupFile,'SYNTHETIC - NOT A SQL BACKUP')
 }elseif($query -match 'RESTORE VERIFYONLY'){
  if($script:failure -eq 'verify'){throw 'INJECTED_VERIFY_FAILURE'}
 }else{throw 'UNEXPECTED_SQL'}
}
function Goal7-Rows($cn,[string]$query){
 if($query -notmatch '^RESTORE HEADERONLY'){throw 'UNEXPECTED_QUERY'}
 $database=if($script:failure -eq 'header'){'WRONG_DATABASE'}else{$goal7Database}
 return [pscustomobject]@{DatabaseName=$database;IsCopyOnly=$true;HasBackupChecksums=$true;IsDamaged=$false;BackupType=1;ServerName=$goal7Server;Position=1;BackupSetGUID='9e199cf8-4a6c-4c3c-9718-1447f03d1151'}
}
function Reject([scriptblock]$call,[string]$code){try{& $call;throw 'NOT_REJECTED'}catch{if($_.Exception.Message -cne $code){throw}}}
$Profile='Clean20261022';$goal7Server='Semih\MELISADEV';$goal7Database='MELISA_ERP_CLEAN_TEST_20261022';$RunId='synthetic'
$prior=Join-Path $FixtureRoot 'previous-good.bak';$priorReceipt=Join-Path $FixtureRoot 'previous-good.json'
[IO.File]::WriteAllText($prior,'previous-good-bytes');[IO.File]::WriteAllText($priorReceipt,'previous-good-receipt')
$priorHash=(Get-FileHash -LiteralPath $prior).Hash;$priorReceiptHash=(Get-FileHash -LiteralPath $priorReceipt).Hash
foreach($failure in @('backup','header','verify','none')){
 $script:failure=$failure;$script:queries=[Collections.Generic.List[string]]::new()
 $goal7Evidence=Join-Path $FixtureRoot $failure;[void][IO.Directory]::CreateDirectory($goal7Evidence)
 $goal7BackupFile=Join-Path $goal7Evidence 'new.bak'
 $expected=@{backup='INJECTED_BACKUP_FAILURE';header='GOAL7_BACKUP_HEADER_REJECTED';verify='INJECTED_VERIFY_FAILURE'}
 if($failure -eq 'none'){
  $result=Goal7-WriteVerifiedBackup $null 4
  if(!$result.verifyOnlyPassed -or $result.fullSystemRecoveryProven -or $result.retention -cne 'retain-all-no-delete'){throw 'SUCCESS_RECEIPT_INVALID'}
  $receipt=Join-Path $goal7Evidence 'backup-result.json';$goodHash=(Get-FileHash -LiteralPath $receipt).Hash
  try{Goal7-Save 'backup-result.json' @{bad=$true};throw 'OVERWRITE_NOT_REJECTED'}catch{if($_.Exception.Message -eq 'OVERWRITE_NOT_REJECTED'){throw}}
  if((Get-FileHash -LiteralPath $receipt).Hash -cne $goodHash){throw 'GOOD_RECEIPT_OVERWRITTEN'}
  Reject {Goal7-WriteVerifiedBackup $null 4} 'GOAL7_BACKUP_ALREADY_EXISTS'
 }else{
  Reject {Goal7-WriteVerifiedBackup $null 4} $expected[$failure]
  if(Test-Path -LiteralPath (Join-Path $goal7Evidence 'backup-result.json')){throw 'FALSE_SUCCESS_RECEIPT'}
 }
 if($queries[0] -notmatch 'clean_test_environment' -or $queries[0] -notmatch 'synthetic=1 AND actual_t1=0 AND external_operations=0' -or $queries[0] -notmatch 'COPY_ONLY,CHECKSUM,NOINIT'){throw 'SQL_GUARD_OR_OPTIONS_LOST'}
 if((Get-FileHash -LiteralPath $prior).Hash -cne $priorHash -or (Get-FileHash -LiteralPath $priorReceipt).Hash -cne $priorReceiptHash){throw 'PRIOR_GOOD_CHANGED'}
}
Write-Output 'C5_FAILURE_PRESERVATION_PASS'
`);
  assert.match(run([harness, '-Source', source, '-FixtureRoot', dir]), /C5_FAILURE_PRESERVATION_PASS/);
});
