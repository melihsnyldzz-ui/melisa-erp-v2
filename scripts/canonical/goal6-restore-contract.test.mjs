import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {RESTORE_DATABASE,RESTORE_SERVER,assertRestoreIdentity,assertRestoreRead} from './goal6-restore-contract.mjs';
const identity={serverName:RESTORE_SERVER,databaseName:RESTORE_DATABASE,isReadOnly:true,state:'ONLINE'};
test('restore read requires exact isolated database, server and READ_ONLY ONLINE state',()=>{
 assert.doesNotThrow(()=>assertRestoreIdentity(identity));
 for(const changed of [{databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01'},{databaseName:'MELISA_ERP_PROD_CANDIDATE_20260917_01'},{serverName:'other'},{isReadOnly:false},{state:'RESTORING'}])assert.throws(()=>assertRestoreIdentity({...identity,...changed}),/TARGET_INVALID/);
});
test('application proof rejects lost leading zeros, altered prices, duplicate/missing native rows or unpreserved pending drafts',()=>{
 const fixture=()=>({identity,catalog:{count:'16622',unknownCost:'10552',prices:'63774'},products:[{productId:'34765',stockCode:'0161 MOLLY',barcode:'8697130801618',price:'9.66000000',currency:'USD'},{productId:'36724',stockCode:'8023 CONCEPT',price:'15.78000000',currency:'USD'}],nativeOrder:{id:'9',status:'draft',currency:'USD',total:'25.4400'},nativeLines:[{productId:'34765',quantity:'1.000',currency:'USD'},{productId:'36724',quantity:'1.000',currency:'USD'}],dailyDrafts:[{id:'43',state:'pending'},{id:'44',state:'pending'}],inbound:{id:'7'},roles:{users:16,roles:16,permissions:137}});
 assert.doesNotThrow(()=>assertRestoreRead(fixture()));
 for(const mutate of [p=>p.products[0].stockCode='161 MOLLY',p=>p.products[1].price='15.77000000',p=>p.catalog.unknownCost='0',p=>p.nativeLines.push({...p.nativeLines[0]}),p=>p.nativeLines[1].productId='34765',p=>p.nativeOrder.status='finalized',p=>p.dailyDrafts[0].state='approved',p=>p.roles.permissions=0]){
  const p=fixture();mutate(p);assert.throws(()=>assertRestoreRead(p));
 }
});
test('operator rehearsal cannot replace, drop, accept arbitrary targets or restore active TEST',async()=>{
 const source=await fs.readFile(new URL('./goal6-backup-restore.ps1',import.meta.url),'utf8');
 assert.doesNotMatch(source,/WITH\s+REPLACE|\bDROP\s+DATABASE|RESTORE DATABASE \[\$sourceDb\]/i);
 assert.match(source,/GOAL6_RESTORE_TARGET_EXISTS/);assert.match(source,/COPY_ONLY,CHECKSUM\$compression,NOINIT/);assert.match(source,/engineEdition -eq 4/);assert.match(source,/SET READ_ONLY WITH NO_WAIT/);
 assert.match(source,/GuardDefinitionsCompared|guardDefinitionsCompared/);
});

test('clean operator requires explicit externally approved restore selection before IO; other write modes remain closed', {skip:process.platform!=='win32'}, async()=>{
 const shell=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const source=fileURLToPath(new URL('./goal6-backup-restore.ps1',import.meta.url));
 for(const [mode,extra,code] of [['Proof',[],'CLEAN_RESTORE_PREFLIGHT_ONLY'],['Negatives',[],'CLEAN_RESTORE_PREFLIGHT_ONLY'],['Rehearse',[],'CLEAN_RESTORE_EXPLICIT_APPROVAL_REQUIRED'],['Rehearse',['-ApplyCleanRestore'],'CLEAN_RESTORE_EXPLICIT_APPROVAL_REQUIRED'],['Preflight',['-ApplyCleanRestore'],'CLEAN_RESTORE_MODE_INVALID']]){
  assert.throws(()=>execFileSync(shell,['-NoProfile','-NonInteractive','-File',source,'-Profile','Clean20261022','-Mode',mode,...extra],{encoding:'utf8',windowsHide:true,stdio:'pipe'}),error=>String(error.stderr).includes(code));
 }
});

test('clean preflight actual PowerShell guard rejects unsafe backup identity, files, capacity and existing targets', {skip:process.platform!=='win32'},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-c6-guard-'));
 const harness=path.join(dir,'guard.test.ps1');
 // Parse only two function definitions: never dot-source or execute the operator script.
 await fs.writeFile(harness,String.raw`param([string]$Source)
$ErrorActionPreference='Stop'
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @('Assert-BackupHeader','Assert-CleanBackupCandidate')){
 $f=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object Name -ceq $name)
 if($f.Count -ne 1){throw 'FUNCTION_MISSING'}
 . ([scriptblock]::Create($f[0].Extent.Text))
}
$Profile='Clean20261022';$Mode='Preflight';$CleanBackup='BeforeB7';$sourceDb='MELISA_ERP_CLEAN_TEST_20261022';$restoreDb='MELISA_ERP_CLEAN_RESTORE_TEST_20261024_01';$server='Semih\MELISADEV';$backupFile='C:\Sirket\ERP\backups\CLEAN-20261022-before-B7-20261024.bak';$restoreRoot='C:\Sirket\ERP\data\CLEAN-RESTORE-20261024-01'
function Header {return [pscustomobject]@{DatabaseName=$sourceDb;IsCopyOnly=$true;HasBackupChecksums=$true;IsDamaged=$false;BackupType=1;ServerName=$server;Position=1;BackupSetGUID='ed3002fc-6661-4ff0-a4f1-e9f8b29f8f11';BackupStartDate=[datetime]'2026-10-24T02:00:00';BackupFinishDate=[datetime]'2026-10-24T02:00:01'}}
function Files {return @([pscustomobject]@{Type='D';IsPresent=$true;Size=1024L;FileId=1;LogicalName='0007 data'},[pscustomobject]@{Type='D';IsPresent=$true;Size=1024L;FileId=3;LogicalName='other data'},[pscustomobject]@{Type='L';IsPresent=$true;Size=1024L;FileId=2;LogicalName='log'})}
function Reject([scriptblock]$call,[string]$code){try{& $call;throw 'NOT_REJECTED'}catch{if($_.Exception.Message -cne $code){throw}}}
$good=Assert-CleanBackupCandidate @(Header) @(Files) $false $false 2GB
if($good.moves.Count -ne 3 -or $good.restoreExecuted -or $good.targetCreated -or $good.sourceBackupCreated -or $good.moves[0].logicalName -cne '0007 data' -or !$good.moves[1].proposedPath.EndsWith('_3.ndf')){throw 'POSITIVE_CONTRACT_FAILED'}
Reject {Assert-CleanBackupCandidate @(Header) @(Files) $true $false 2GB} 'CLEAN_RESTORE_TARGET_EXISTS'
Reject {Assert-CleanBackupCandidate @(Header) @(Files) $false $true 2GB} 'CLEAN_RESTORE_TARGET_EXISTS'
Reject {Assert-CleanBackupCandidate @(Header) @(Files) $false $false 1GB} 'CLEAN_RESTORE_INSUFFICIENT_CAPACITY'
foreach($change in @(@{DatabaseName='OTHER'},@{IsCopyOnly=$false},@{HasBackupChecksums=$false},@{IsDamaged=$true},@{BackupType=2})){
 $h=Header;foreach($k in $change.Keys){$h.$k=$change[$k]};Reject {Assert-CleanBackupCandidate @($h) @(Files) $false $false 2GB} 'GOAL6_BACKUP_HEADER_INVALID'
}
foreach($change in @(@{ServerName='OTHER'},@{Position=2},@{BackupSetGUID=$null},@{BackupFinishDate=[datetime]'2026-10-23T01:00:00'})){
 $h=Header;foreach($k in $change.Keys){$h.$k=$change[$k]};Reject {Assert-CleanBackupCandidate @($h) @(Files) $false $false 2GB} 'CLEAN_RESTORE_HEADER_IDENTITY_INVALID'
}
Reject {Assert-CleanBackupCandidate @((Header),(Header)) @(Files) $false $false 2GB} 'GOAL6_BACKUP_HEADER_INVALID'
foreach($change in @(@{Type='S'},@{IsPresent=$false},@{Size=0},@{Size=-1},@{Size=1.5},@{FileId=0},@{FileId=1.5},@{FileId=2147483648},@{LogicalName=' '})){
 $files=Files;foreach($k in $change.Keys){$files[0].$k=$change[$k]};Reject {Assert-CleanBackupCandidate @(Header) $files $false $false 2GB} 'CLEAN_RESTORE_FILELIST_INVALID'
}
$files=Files;$files[1].LogicalName=$files[0].LogicalName;Reject {Assert-CleanBackupCandidate @(Header) $files $false $false 2GB} 'CLEAN_RESTORE_FILELIST_INVALID'
$files=Files;$files[1].FileId=$files[0].FileId;Reject {Assert-CleanBackupCandidate @(Header) $files $false $false 2GB} 'CLEAN_RESTORE_FILELIST_INVALID'
Reject {Assert-CleanBackupCandidate @(Header) @((Files)[0]) $false $false 2GB} 'CLEAN_RESTORE_FILELIST_INVALID'
Reject {Assert-CleanBackupCandidate @(Header) @() $false $false 2GB} 'CLEAN_RESTORE_FILELIST_INVALID'
$restoreDb=$sourceDb;Reject {Assert-CleanBackupCandidate @(Header) @(Files) $false $false 2GB} 'CLEAN_RESTORE_PROFILE_INVALID'
Write-Output 'C6_ACTUAL_POWERSHELL_GUARDS_PASS'
`);
 const shell=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const output=execFileSync(shell,['-NoProfile','-NonInteractive','-File',harness,'-Source',fileURLToPath(new URL('./goal6-backup-restore.ps1',import.meta.url))],{encoding:'utf8',windowsHide:true,stdio:'pipe'});
 assert.match(output,/C6_ACTUAL_POWERSHELL_GUARDS_PASS/);
});

test('clean restore executes real operator functions against only in-memory SQL and filesystem boundaries', {skip:process.platform!=='win32'},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-c6-restore-'));
 const harness=path.join(dir,'restore.test.ps1');
 // Import only the production function ASTs. SQL connections, IO commands and the
 // backup file handle are replaced before invocation; no operator entry point runs.
 await fs.writeFile(harness,String.raw`param([string]$Source)
$ErrorActionPreference='Stop'
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @('Assert-BackupHeader','Assert-CleanBackupCandidate','Assert-CleanPath','CleanPreflight','Assert-CleanRestoreReceipt','Restore-CleanBackup')){
 $f=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object Name -ceq $name)
 if($f.Count -ne 1){throw 'FUNCTION_MISSING'};. ([scriptblock]::Create($f[0].Extent.Text))
}
function Check([bool]$ok,[string]$why){if(!$ok){throw $why}}
function Reject([scriptblock]$call,[string]$code){try{& $call;throw 'NOT_REJECTED'}catch{if($_.Exception.Message -cne $code){throw}}}
function Reset([string]$selection='BeforeB7'){
 $script:Profile='Clean20261022';$script:Mode='Rehearse';$script:CleanBackup=$selection
 $script:sourceDb='MELISA_ERP_CLEAN_TEST_20261022';$script:restoreDb='MELISA_ERP_CLEAN_RESTORE_TEST_20261024_01';$script:server='Semih\MELISADEV';$script:restoreRoot='C:\Sirket\ERP\data\CLEAN-RESTORE-20261024-01'
 $script:backupFile=if($selection -ceq 'BeforeB7'){'C:\Sirket\ERP\backups\CLEAN-20261022-before-B7-20261024.bak'}else{'C:\Sirket\ERP\backups\CLEAN-20261022-C5-20261025T000001357Z-512ec2b3bf8f478ca37e1851c8a821d2\CLEAN_TEST_COPY_ONLY.bak'}
 $script:backupHash=if($selection -ceq 'BeforeB7'){'A'*64}else{'FD9096307DCB058813E7A8732A4665C4CD9809CBA257403A88EAE8978795C891'}
 $script:operatorHash='B'*64;$script:CleanPreflightSha256='C'*64;$script:CleanRestoreApprovalReference='synthetic-approval-reference'
 $script:dbExists=$false;$script:dirExists=$false;$script:failRestore=$false;$script:badReadback=$false;$script:badIdentity=$false;$script:raceDirectory=$false;$script:raceDatabase=$false;$script:reparseAt='';$script:changeHash=$false
 $script:sqlWrites=@();$script:connections=0;$script:directories=0;$script:hashReads=0;$script:handleClosed=$false
}
function Open-VerifiedConnection([string]$db){
 Check ($db -ceq $sourceDb) 'UNEXPECTED_CONNECTION';$script:connections++
 $cn=[pscustomobject]@{};$cn|Add-Member ScriptMethod Close {};return $cn
}
function Rows($cn,[string]$query){
 if($query.StartsWith('SELECT environment_id,')){return [pscustomobject]@{environment_id=if($badIdentity){'wrong'}else{'e662fd94-d797-4b3b-938a-d143ad758b67'};synthetic=$true;actual_t1=$false;external_operations=$false}}
 if($query.StartsWith('RESTORE HEADERONLY')){return [pscustomobject]@{DatabaseName=$sourceDb;IsCopyOnly=$true;HasBackupChecksums=$true;IsDamaged=$false;BackupType=1;ServerName=$server;Position=1;BackupSetGUID=if($CleanBackup -ceq 'BeforeB7'){'ed3002fc-6661-4ff0-a4f1-e9f8b29f8f11'}else{'b8b6ee89-1886-4fbd-be27-065343c02d25'};BackupStartDate=[datetime]'2026-10-24T02:00:00';BackupFinishDate=[datetime]'2026-10-24T02:00:01'}}
 if($query.StartsWith('RESTORE FILELISTONLY')){return @([pscustomobject]@{Type='D';IsPresent=$true;Size=1024L;FileId=1;LogicalName="0007 data's"},[pscustomobject]@{Type='D';IsPresent=$true;Size=1024L;FileId=3;LogicalName='other data'},[pscustomobject]@{Type='L';IsPresent=$true;Size=1024L;FileId=2;LogicalName='log'})}
 if($query.StartsWith('SELECT name FROM sys.databases')){if($dbExists){return [pscustomobject]@{name=$restoreDb}};return @()}
 if($query.StartsWith('SELECT d.name,d.state_desc')){return [pscustomobject]@{name=$restoreDb;state_desc='ONLINE';is_read_only=(!$badReadback);environment_id='e662fd94-d797-4b3b-938a-d143ad758b67';synthetic=$true;actual_t1=$false;external_operations=$false}}
 throw 'UNEXPECTED_SQL_READ'
}
function Execute($cn,[string]$query){
 $script:sqlWrites+=@($query)
 if($query.StartsWith('IF DB_ID(')){if($raceDatabase){throw 'CLEAN_RESTORE_TARGET_EXISTS'};if($failRestore){throw 'FIXTURE_RESTORE_FAILED'};$script:dbExists=$true;return}
 if($query.StartsWith('ALTER DATABASE ['+$restoreDb+'] SET READ_ONLY')){return}
 throw 'UNEXPECTED_SQL_WRITE'
}
function Test-Path([string]$LiteralPath,[string]$PathType){if($LiteralPath -ceq $restoreRoot){return $dirExists};return $true}
function Get-Item([string]$LiteralPath,[switch]$Force){return [pscustomobject]@{Attributes=if($LiteralPath -ceq $reparseAt){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]::Normal}}}
function Get-PSDrive([string]$Name){Check ($Name -ceq 'C') 'UNEXPECTED_DRIVE';return [pscustomobject]@{Free=2GB}}
# AST-created functions have no PSCommandPath; that one hash input is deliberately
# virtual too. Every other path must be the fixed selected backup.
function Get-FileHash([string]$LiteralPath,[string]$Algorithm){if($LiteralPath -ceq $backupFile){$script:hashReads++;return [pscustomobject]@{Hash=if($changeHash -and $hashReads -ge 2){'D'*64}else{$backupHash}}};Check ([string]::IsNullOrEmpty($LiteralPath)) 'UNEXPECTED_HASH_PATH';return [pscustomobject]@{Hash=$operatorHash}}
function New-Item([string]$ItemType,[string]$Path,[string]$ErrorAction){Check ($ItemType -ceq 'Directory' -and $Path -ceq $restoreRoot) 'UNEXPECTED_CREATE';if($dirExists -or $raceDirectory){throw 'FIXTURE_DIRECTORY_EXISTS'};$script:dirExists=$true;$script:directories++}
function Open-CleanBackupReadLock {$h=[pscustomobject]@{};$h|Add-Member ScriptMethod Dispose {$script:handleClosed=$true};return $h}
function Receipt {
 # Real production preflight with virtual IO, round-tripped as an actual JSON receipt.
 $r=CleanPreflight 'fixture-master';$script:connections=0;$script:hashReads=0
 return ($r|ConvertTo-Json -Depth 14|ConvertFrom-Json)
}
foreach($selection in @('BeforeB7','C5-20261025-0300')){
 Reset $selection;$r=Receipt;Assert-CleanRestoreReceipt $r ([datetimeoffset]::UtcNow) $operatorHash
 $result=Restore-CleanBackup 'fixture-master' $r
 Check ($result.restored -and $result.readOnly -and $result.retainedForEvidence -and $result.humanAcceptance -ceq 'PENDING' -and $directories -eq 1 -and $sqlWrites.Count -eq 2 -and $handleClosed) 'RESTORE_RESULT_INVALID'
 Check ($sqlWrites[0].Contains("MOVE N'0007 data''s'") -and $sqlWrites[0].Contains('_3.ndf') -and $sqlWrites[0].Contains('IF DB_ID(') -and $sqlWrites[0] -notmatch 'BACKUP DATABASE|WITH REPLACE|DROP DATABASE') 'RESTORE_SQL_INVALID'
 $before=$sqlWrites.Count;Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_TARGET_EXISTS'
 Check ($sqlWrites.Count -eq $before -and $directories -eq 1) 'REPLAY_MUTATED'
}
foreach($change in @(@{schemaVersion='melisa-goal6.clean-preflight.v1'},@{status='FAILED'},@{server='other'},@{sourceDatabase='MELISA_ERP_PROD'},@{proposedRestoreDatabase='MELISA_ERP_CLEAN_TEST_20261022'},@{restoreRoot='C:\other'},@{backupFile='C:\other.bak'},@{cleanBackup='C5-20261025-0300'},@{operatorSha256=('D'*64)},@{backupSha256='bad'},@{backupSetGuid=$null},@{synthetic=$false},@{actualT1=$true},@{externalOperations=$true},@{copyOnly=$false},@{checksum=$false},@{restoreExecuted=$true},@{targetCreated=$true},@{sourceBackupCreated=$true},@{applicationConnectionChanged=$true})){
 Reset;$r=Receipt;foreach($k in $change.Keys){$r.$k=$change[$k]}
 Reject {Assert-CleanRestoreReceipt $r ([datetimeoffset]::UtcNow) $operatorHash} 'CLEAN_RESTORE_PREFLIGHT_MISMATCH'
 Check ($connections -eq 0 -and $directories -eq 0 -and $sqlWrites.Count -eq 0) 'INVALID_RECEIPT_DID_IO'
}
foreach($at in @(([datetimeoffset]::UtcNow.AddMinutes(-31).ToString('o').Replace('+00:00','Z')),([datetimeoffset]::UtcNow.AddMinutes(1).ToString('o').Replace('+00:00','Z')),'bad','2026-10-24T02:00:00')){
 Reset;$r=Receipt;$r.observedAt=$at;Reject {Assert-CleanRestoreReceipt $r ([datetimeoffset]::UtcNow) $operatorHash} 'CLEAN_RESTORE_PREFLIGHT_STALE'
 Check ($connections -eq 0 -and $directories -eq 0 -and $sqlWrites.Count -eq 0) 'STALE_RECEIPT_DID_IO'
}
foreach($field in @('backupSha256','backupSetGuid','sqlBackupStart','sqlBackupFinish')){
 Reset;$r=Receipt;$r.$field='D'*64
 Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_PREFLIGHT_MISMATCH'
 Check ($directories -eq 0 -and $sqlWrites.Count -eq 0 -and $handleClosed) 'MISMATCH_MUTATED'
}
Reset;$r=Receipt;$dbExists=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_TARGET_EXISTS';Check ($directories -eq 0 -and $sqlWrites.Count -eq 0) 'EXISTING_DB_MUTATED'
Reset;$r=Receipt;$dirExists=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_TARGET_EXISTS';Check ($directories -eq 0 -and $sqlWrites.Count -eq 0) 'EXISTING_DIR_MUTATED'
Reset;$r=Receipt;$raceDirectory=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'FIXTURE_DIRECTORY_EXISTS';Check ($directories -eq 0 -and $sqlWrites.Count -eq 0 -and $handleClosed) 'DIRECTORY_RACE_MUTATED'
Reset;$r=Receipt;$badIdentity=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_SOURCE_IDENTITY_INVALID';Check ($directories -eq 0 -and $sqlWrites.Count -eq 0) 'WRONG_SOURCE_MUTATED'
Reset;$r=Receipt;$changeHash=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_BACKUP_CHANGED';Check ($directories -eq 0 -and $sqlWrites.Count -eq 0) 'CHANGED_BACKUP_MUTATED'
Reset;$r=Receipt;$reparseAt='C:\Sirket\ERP\data';Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_REPARSE_PATH';Check ($directories -eq 0 -and $sqlWrites.Count -eq 0) 'REPARSE_MUTATED'
Reset;$r=Receipt;$failRestore=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'FIXTURE_RESTORE_FAILED';Check ($dirExists -and !$dbExists -and $sqlWrites.Count -eq 1 -and $handleClosed) 'FAILED_ATTEMPT_NOT_RETAINED';Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_TARGET_EXISTS';Check ($sqlWrites.Count -eq 1) 'FAILED_ATTEMPT_RETRIED'
Reset;$r=Receipt;$raceDatabase=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_TARGET_EXISTS';Check ($dirExists -and !$dbExists -and $sqlWrites.Count -eq 1 -and $handleClosed) 'DATABASE_RACE_NOT_REJECTED'
Reset;$r=Receipt;$badReadback=$true;Reject {Restore-CleanBackup 'fixture-master' $r} 'CLEAN_RESTORE_READBACK_FAILED';Check ($dirExists -and $dbExists -and $sqlWrites.Count -eq 2 -and $handleClosed) 'FAILED_READBACK_CLEANED'
Write-Output 'C6_RESTORE_OFFLINE_WORKFLOW_PASS'
`);
 const shell=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const output=execFileSync(shell,['-NoProfile','-NonInteractive','-File',harness,'-Source',fileURLToPath(new URL('./goal6-backup-restore.ps1',import.meta.url))],{encoding:'utf8',windowsHide:true,stdio:'pipe'});
 assert.match(output,/C6_RESTORE_OFFLINE_WORKFLOW_PASS/);
});

test('clean receipt reader preserves ISO strings on PS5 and PS7 and read lock excludes backup replacement', {skip:process.platform!=='win32'},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-c6-receipt-'));
 const harness=path.join(dir,'receipt.test.ps1');
 await fs.writeFile(harness,String.raw`param([string]$Source,[string]$TempRoot)
$ErrorActionPreference='Stop'
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @('Assert-CleanPath','Assert-CleanRestoreReceipt','Read-CleanRestoreReceipt','Open-CleanBackupReadLock')){
 $f=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object Name -ceq $name)
 if($f.Count -ne 1){throw 'FUNCTION_MISSING'};. ([scriptblock]::Create($f[0].Extent.Text))
}
function Reject([scriptblock]$call,[string]$code){try{& $call;throw 'NOT_REJECTED'}catch{if($_.Exception.Message -cne $code){throw}}}
function Get-FileHash([string]$LiteralPath,[string]$Algorithm){if($LiteralPath){throw 'UNEXPECTED_HASH_PATH'};return [pscustomobject]@{Hash=('B'*64)}}
function WriteFixture {
 [IO.File]::WriteAllText($CleanPreflightReceipt,($r|ConvertTo-Json -Depth 14),[Text.UTF8Encoding]::new($false))
 $bytes=[IO.File]::ReadAllBytes($CleanPreflightReceipt);$script:CleanPreflightSha256=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-','')
}
# Match the production canonical root; PS5 expands CI's RUNNER~1 temporary path.
$TempRoot=[IO.Path]::GetFullPath($TempRoot)
$evidenceRoot=$TempRoot;$CleanPreflightReceipt=Join-Path $TempRoot 'c6-clean-preflight-11111111111111111111111111111111.json'
$server='Semih\MELISADEV';$sourceDb='MELISA_ERP_CLEAN_TEST_20261022';$restoreDb='MELISA_ERP_CLEAN_RESTORE_TEST_20261024_01';$restoreRoot='C:\Sirket\ERP\data\CLEAN-RESTORE-20261024-01';$backupFile='C:\Sirket\ERP\backups\CLEAN-20261022-before-B7-20261024.bak';$CleanBackup='BeforeB7'
$r=@{schemaVersion='melisa-goal6.clean-preflight.v2';status='READY';server=$server;sourceDatabase=$sourceDb;proposedRestoreDatabase=$restoreDb;restoreRoot=$restoreRoot;backupFile=$backupFile;cleanBackup=$CleanBackup;operatorSha256=('B'*64);backupSha256=('A'*64);backupSetGuid='ed3002fc-6661-4ff0-a4f1-e9f8b29f8f11';synthetic=$true;actualT1=$false;externalOperations=$false;copyOnly=$true;checksum=$true;restoreExecuted=$false;targetCreated=$false;sourceBackupCreated=$false;applicationConnectionChanged=$false;observedAt=[DateTime]::UtcNow.ToString('o')}
$r.sqlBackupStart='2026-10-25T03:00:01.3570000';$r.sqlBackupFinish='2026-10-25T03:00:02.3570000'
WriteFixture
$read=Read-CleanRestoreReceipt
if($read.backupSha256 -cne ('A'*64)){throw 'RECEIPT_POSITIVE_FAILED'}
foreach($key in @('observedAt','sqlBackupStart','sqlBackupFinish')){if($read.$key -isnot [string] -or $read.$key -cne $r.$key){throw ('RECEIPT_ISO_STRING_CHANGED_'+$key)}}
$CleanPreflightSha256='D'*64;Reject {Read-CleanRestoreReceipt} 'CLEAN_RESTORE_RECEIPT_HASH_MISMATCH'
WriteFixture;$r.observedAt=[DateTime]::UtcNow.AddMinutes(-31).ToString('o');WriteFixture;Reject {Read-CleanRestoreReceipt} 'CLEAN_RESTORE_PREFLIGHT_STALE'
$r.observedAt=[DateTime]::UtcNow.AddMinutes(1).ToString('o');WriteFixture;Reject {Read-CleanRestoreReceipt} 'CLEAN_RESTORE_PREFLIGHT_STALE'
$r.observedAt=[DateTime]::UtcNow.ToString('o').Replace('Z','+00:00');WriteFixture;Reject {Read-CleanRestoreReceipt} 'CLEAN_RESTORE_PREFLIGHT_STALE'
$r.observedAt=[DateTime]::UtcNow.ToString('o').Replace('Z','');WriteFixture;Reject {Read-CleanRestoreReceipt} 'CLEAN_RESTORE_PREFLIGHT_STALE'
$r.observedAt=[DateTime]::UtcNow.ToString('o');$r.cleanBackup='C5-20261025-0300';WriteFixture;Reject {Read-CleanRestoreReceipt} 'CLEAN_RESTORE_PREFLIGHT_MISMATCH'
$CleanPreflightReceipt=Join-Path $TempRoot 'unrelated.json';Reject {Read-CleanRestoreReceipt} 'CLEAN_RESTORE_RECEIPT_PATH_INVALID'
# Only this newly created synthetic file is used for the OS file-sharing assertion.
$backupFile=Join-Path $TempRoot 'synthetic-not-sql.bak';[IO.File]::WriteAllText($backupFile,'synthetic')
$handle=Open-CleanBackupReadLock
try{
 if([IO.File]::ReadAllText($backupFile) -cne 'synthetic'){throw 'READ_LOCK_BLOCKED_READER'}
 try{[IO.File]::WriteAllText($backupFile,'changed');throw 'WRITE_LOCK_MISSING'}catch{if($_.Exception.Message -ceq 'WRITE_LOCK_MISSING'){throw}}
 try{[IO.File]::Delete($backupFile);throw 'DELETE_LOCK_MISSING'}catch{if($_.Exception.Message -ceq 'DELETE_LOCK_MISSING'){throw}}
}finally{$handle.Dispose()}
if([IO.File]::ReadAllText($backupFile) -cne 'synthetic'){throw 'READ_LOCK_BYTES_CHANGED'}
Write-Output 'C6_PINNED_RECEIPT_AND_READ_LOCK_PASS'
`);
 for(const shell of [path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),'pwsh.exe']){
  const output=execFileSync(shell,['-NoProfile','-NonInteractive','-File',harness,'-Source',fileURLToPath(new URL('./goal6-backup-restore.ps1',import.meta.url)),'-TempRoot',dir],{encoding:'utf8',windowsHide:true,stdio:'pipe'});
  assert.match(output,/C6_PINNED_RECEIPT_AND_READ_LOCK_PASS/);
 }
});
