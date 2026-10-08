import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const file=fileURLToPath(new URL('./stage4-copy-recovery.ps1',import.meta.url));
const source=await readFile(file,'utf8');
const windows=process.platform==='win32';
function offline(script){
 const quoted="'"+file.replace(/'/g,"''")+"'";
 const run=spawnSync('pwsh',['-NoLogo','-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'; . ${quoted}; ${script}`],{encoding:'utf8',timeout:10000});
 assert.equal(run.status,0,run.stderr||run.stdout||run.error?.message);return run.stdout;
}
test('recovery source fixes two new TEST targets and cannot replace active or foreign databases',()=>{
 assert.match(source,/\$server='Semih\\MELISADEV'/);
 for(const name of ['MELISA_ERP_STAGE04_RECOVERY_TEST_20261008_01','MELISA_ERP_STAGE04_COPY_TEST_20261008_01'])assert.ok(source.includes(name));
 assert.doesNotMatch(source,/WITH\s+REPLACE|\bDROP\s+DATABASE|RESTORE DATABASE \[\$sourceDb\]|ALTER DATABASE \[\$sourceDb\]/i);
 assert.match(source,/RESTORE DATABASE \[\$db\].*WITH CHECKSUM,RECOVERY,MOVE/);
 assert.match(source,/ALTER DATABASE \[\$recoveryDb\] SET READ_ONLY WITH NO_WAIT/);
 assert.doesNotMatch(source,/SET READ_WRITE|SINGLE_USER|ROLLBACK IMMEDIATE|TRUNCATE|\bDELETE\s+FROM/i);
 assert.match(source,/COPY_ONLY,CHECKSUM\$compression,NOINIT/);
 assert.match(source,/RESTORE VERIFYONLY.*WITH CHECKSUM/);
 assert.match(source,/Get-FileHash.*SHA256/);
 assert.match(source,/coverage=.*29 critical tables.*not whole database rows/);
});
test('critical hash coverage exactly matches the established 29-table source fingerprint algorithm',()=>{
 const block=/\$criticalTables=@\(([\s\S]*?)\n\)/.exec(source)?.[1];
 const tables=[...block.matchAll(/'((?:dbo|erp_migration)\.[a-z0-9_]+)'/g)].map(m=>m[1]);
 assert.equal(tables.length,29);assert.equal(new Set(tables).size,29);
 for(const table of ['dbo.stock_movements','dbo.supplier_movements','dbo.party_currency_accounts','dbo.product_prices','dbo.permissions','erp_migration.goal7_source_version_prices'])assert.ok(tables.includes(table));
 assert.match(source,/FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES/);
 assert.match(source,/ORDER BY rowHash/);
 assert.match(source,/SQL_FULL_ROW_JSON_UTF16_SHA256_SORTED_MULTISET/);
 assert.match(source,/UTF8.GetBytes\('\['\)/);assert.match(source,/UTF8.GetBytes\('\]'\)/);
 assert.match(source,/sys\.sql_modules/);assert.match(source,/ExecIsTriggerDisabled/);
});
test('PowerShell parser and dot-source test mode have no SQL or filesystem effects',{skip:!windows},()=>{
 const result=offline(`$errors=$null; $tokens=$null; [void][Management.Automation.Language.Parser]::ParseFile(${"'"+file.replace(/'/g,"''")+"'"},[ref]$tokens,[ref]$errors); if($errors.Count){throw 'PARSE_ERROR'}; function Open-Stage4Connection {throw 'SQL_MUST_NOT_RUN'}; function New-Item {throw 'FILES_MUST_NOT_RUN'}; 'OFFLINE_READY'`);
 assert.match(result,/OFFLINE_READY/);
});
test('exact target identity rejects source, LIVE, case drift and pre-existing database or files before restore',{skip:!windows},()=>{
 const result=offline(`
 function Blocked([scriptblock]$f,[string]$expected){try{&$f;throw 'UNBLOCKED'}catch{if($_.Exception.Message -cne $expected){throw}}}
 Assert-Stage4Identity $server $sourceDb
 foreach($db in $targets){$data=Join-Path $dataRoot ($db+'.mdf');$log=Join-Path $dataRoot ($db+'_log.ldf');Assert-Stage4Target $db $data $log $false $false $false
  Blocked {Assert-Stage4Target $db $data $log $true $false $false} 'STAGE4_HEDEF_ZATEN_VAR'
  Blocked {Assert-Stage4Target $db $data $log $false $true $false} 'STAGE4_HEDEF_ZATEN_VAR'
  Blocked {Assert-Stage4Target $db $data $log $false $false $true} 'STAGE4_HEDEF_ZATEN_VAR'
  Blocked {Assert-Stage4Target $db ($dataRoot+'\\..\\active.mdf') $log $false $false $false} 'STAGE4_DOSYA_YOLU_GECERSIZ'
 }
 foreach($db in @($sourceDb,'MELISA_ERP_LIVE','melisa_erp_stage04_copy_test_20261008_01')){Blocked {Assert-Stage4Target $db 'x' 'y' $false $false $false} 'STAGE4_HEDEF_GECERSIZ'}
 Blocked {Assert-Stage4Identity 'Other\\MELISADEV' $sourceDb} 'STAGE4_KIMLIK_GECERSIZ'
 'TARGET_NEGATIVES_PASS'`);assert.match(result,/TARGET_NEGATIVES_PASS/);
});
test('backup path/header/files and disk margin fail closed on wrong or existing inputs',{skip:!windows},()=>{
 const result=offline(`
 function Blocked([scriptblock]$f,[string]$expected){try{&$f;throw 'UNBLOCKED'}catch{if($_.Exception.Message -cne $expected){throw}}}
 Assert-Stage4BackupPath $backupFile $false
 Blocked {Assert-Stage4BackupPath $backupFile $true} 'STAGE4_YEDEK_ZATEN_VAR'
 Blocked {Assert-Stage4BackupPath 'C:\\wrong.bak' $false} 'STAGE4_YEDEK_YOLU_GECERSIZ'
 $header=@([pscustomobject]@{DatabaseName=$sourceDb;IsCopyOnly=$true;HasBackupChecksums=$true;IsDamaged=$false;BackupType=1});Assert-Stage4Header $header
 foreach($field in @('DatabaseName','IsCopyOnly','HasBackupChecksums','IsDamaged','BackupType')){$bad=@([pscustomobject]@{DatabaseName=$sourceDb;IsCopyOnly=$true;HasBackupChecksums=$true;IsDamaged=$false;BackupType=1});$bad[0].$field=if($field -eq 'DatabaseName'){'LIVE'}elseif($field -eq 'BackupType'){2}elseif($field -eq 'IsDamaged'){$true}else{$false};Blocked {Assert-Stage4Header $bad} 'STAGE4_YEDEK_BASLIGI_GECERSIZ'}
 $files=@([pscustomobject]@{LogicalName='MELISA_ERP_V2';Type='D'},[pscustomobject]@{LogicalName='MELISA_ERP_V2_log';Type='L'});Assert-Stage4FileList $files $true
 $files[1].LogicalName='OTHER';Blocked {Assert-Stage4FileList $files $true} 'STAGE4_MANTIKSAL_DOSYALAR_GECERSIZ'
 $needed=Assert-Stage4Space 1GB 13GB;if($needed -ne 13GB){throw 'CAPACITY_CALCULATION'}
 Blocked {Assert-Stage4Space 1GB (13GB-1)} 'STAGE4_DISK_ALANI_YETERSIZ'
 'BACKUP_NEGATIVES_PASS'`);assert.match(result,/BACKUP_NEGATIVES_PASS/);
});
test('fingerprint proof catches one changed table, module or schema rather than asserting whole-database recovery',{skip:!windows},()=>{
 const result=offline(`
 function Fixture([string]$db,[bool]$ro){$groups=@{};foreach($table in $criticalTables){$groups[$table]=@{count=1;fullRowsHashMultisetSHA256=('a'*64);basis=$hashBasis}};return @{identity=@{server=$server;database=$db};groups=$groups;modules=@(@{name='guard';definitionSHA256=('A'*64);disabled=0});schema=@(@{name='balance';scale=8});databaseState=@(@{state_desc='ONLINE';is_read_only=$ro;collation_name='Turkish_CI_AS'})}}
 $before=Fixture $sourceDb $false;$after=Fixture $sourceDb $false;$raw=Fixture $recoveryDb $true;$copy=Fixture $copyDb $false
 $proof=Stage4-Compare $before $after @($raw,$copy);if($proof.status -cne 'PASS' -or $proof.tablesCompared -ne 29){throw 'PROOF_UNEXPECTED'}
 $copy.groups['dbo.supplier_movements'].count=2;if((Stage4-Compare $before $after @($raw,$copy)).status -cne 'FAIL'){throw 'ROW_DRIFT_UNDETECTED'}
 $copy=Fixture $copyDb $false;$copy.modules[0].disabled=1;if((Stage4-Compare $before $after @($raw,$copy)).status -cne 'FAIL'){throw 'GUARD_DRIFT_UNDETECTED'}
 $copy=Fixture $copyDb $false;$copy.schema[0].scale=4;if((Stage4-Compare $before $after @($raw,$copy)).status -cne 'FAIL'){throw 'SCHEMA_DRIFT_UNDETECTED'}
 'COMPARISON_NEGATIVES_PASS'`);assert.match(result,/COMPARISON_NEGATIVES_PASS/);
});
