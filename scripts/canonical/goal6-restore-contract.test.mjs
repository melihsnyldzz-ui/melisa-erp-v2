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

test('clean profile exposes existing-backup preflight only and stops before SQL for every write mode', {skip:process.platform!=='win32'}, async()=>{
 const shell=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const source=fileURLToPath(new URL('./goal6-backup-restore.ps1',import.meta.url));
 for(const mode of ['Rehearse','Proof','Negatives']){
  assert.throws(()=>execFileSync(shell,['-NoProfile','-NonInteractive','-File',source,'-Profile','Clean20261022','-Mode',mode],{encoding:'utf8',windowsHide:true,stdio:'pipe'}),error=>String(error.stderr).includes('CLEAN_RESTORE_PREFLIGHT_ONLY'));
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
$Profile='Clean20261022';$Mode='Preflight';$sourceDb='MELISA_ERP_CLEAN_TEST_20261022';$restoreDb='MELISA_ERP_CLEAN_RESTORE_TEST_20261024_01';$server='Semih\MELISADEV';$backupFile='C:\Sirket\ERP\backups\CLEAN-20261022-before-B7-20261024.bak';$restoreRoot='C:\Sirket\ERP\data\CLEAN-RESTORE-20261024-01'
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
