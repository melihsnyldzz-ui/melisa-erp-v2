param([ValidateSet('Preflight','Rehearse','Proof')][string]$Mode='Preflight')
$ErrorActionPreference='Stop'
# These targets cannot be overridden. Only a new isolated database may be restored.
$server='Semih\MELISADEV'
$sourceDb='MELISA_ERP_SIRKET_TEST_20260929_01'
$recoveryDb='MELISA_ERP_STAGE04_RECOVERY_TEST_20261008_01'
$copyDb='MELISA_ERP_STAGE04_COPY_TEST_20261008_01'
$backupRoot='C:\Sirket\ERP\backups\ERP-STAGE04-20261008'
$backupFile=Join-Path $backupRoot 'STAGE04_TEST113_CURRENT_20261008_01.bak'
$dataRoot='C:\Sirket\ERP\data\ERP-STAGE04-20261008'
$evidenceRoot='C:\Sirket\ERP\evidence\ERP-STAGE04-20261008\private\recovery'
$targets=@($recoveryDb,$copyDb)
$criticalTables=@(
 'dbo.products','dbo.product_prices','dbo.product_barcodes','dbo.product_source_aliases',
 'dbo.customers','dbo.suppliers','dbo.party_entities','dbo.party_currency_accounts','dbo.party_source_links',
 'dbo.customer_movements','dbo.supplier_movements','dbo.stock_movements','dbo.finance_accounts','dbo.finance_account_movements',
 'dbo.sales_invoices','dbo.sales_invoice_items','dbo.purchase_invoices','dbo.purchase_invoice_items',
 'dbo.invoice_returns','dbo.invoice_return_items','dbo.users','dbo.roles','dbo.permissions',
 'erp_migration.goal7_source_version_manifest','erp_migration.goal7_source_version_products',
 'erp_migration.goal7_source_version_prices','erp_migration.operation_quarantine_holds',
 'erp_migration.product_purchase_reference_rows','erp_migration.product_last_purchase_rows'
)
$hashBasis='SQL_FULL_ROW_JSON_UTF16_SHA256_SORTED_MULTISET'

function Assert-Stage4Identity([string]$actualServer,[string]$db){
 if($actualServer -cne $server -or $db -cnotin @('master',$sourceDb,$recoveryDb,$copyDb)){throw 'STAGE4_KIMLIK_GECERSIZ'}
}
function Assert-Stage4Target([string]$db,[string]$dataFile,[string]$logFile,[bool]$databaseExists,[bool]$dataExists,[bool]$logExists){
 if($db -cnotin $targets -or $db -ceq $sourceDb){throw 'STAGE4_HEDEF_GECERSIZ'}
 if($dataFile -cne (Join-Path $dataRoot ($db+'.mdf')) -or $logFile -cne (Join-Path $dataRoot ($db+'_log.ldf')) -or
    [IO.Path]::GetFullPath($dataFile) -cne $dataFile -or [IO.Path]::GetFullPath($logFile) -cne $logFile){throw 'STAGE4_DOSYA_YOLU_GECERSIZ'}
 if($databaseExists -or $dataExists -or $logExists){throw 'STAGE4_HEDEF_ZATEN_VAR'}
}
function Assert-Stage4BackupPath([string]$file,[bool]$exists){
 if($file -cne $backupFile -or [IO.Path]::GetFullPath($file) -cne $file){throw 'STAGE4_YEDEK_YOLU_GECERSIZ'}
 if($exists){throw 'STAGE4_YEDEK_ZATEN_VAR'}
}
function Assert-Stage4Header($header){
 if(@($header).Count -ne 1 -or $header[0].DatabaseName -cne $sourceDb -or $header[0].IsCopyOnly -ne $true -or
    $header[0].HasBackupChecksums -ne $true -or $header[0].IsDamaged -ne $false -or $header[0].BackupType -ne 1){throw 'STAGE4_YEDEK_BASLIGI_GECERSIZ'}
}
function Assert-Stage4FileList($files,[bool]$backup=$false){
 $nameKey=if($backup){'LogicalName'}else{'name'}
 $typeKey=if($backup){'Type'}else{'type_desc'}
 $data=@($files|Where-Object {$_.$nameKey -ceq 'MELISA_ERP_V2'})
 $log=@($files|Where-Object {$_.$nameKey -ceq 'MELISA_ERP_V2_log'})
 if(@($files).Count -ne 2 -or $data.Count -ne 1 -or $log.Count -ne 1 -or
    $data[0].$typeKey -cne $(if($backup){'D'}else{'ROWS'}) -or $log[0].$typeKey -cne $(if($backup){'L'}else{'LOG'})){throw 'STAGE4_MANTIKSAL_DOSYALAR_GECERSIZ'}
}
function Assert-Stage4Space([long]$sourceBytes,[long]$availableBytes){
 if($sourceBytes -le 0 -or $sourceBytes -gt ([long]::MaxValue-10GB)/3){throw 'STAGE4_BOYUT_GECERSIZ'}
 $required=$sourceBytes*3+10GB # Two uncompressed restored databases, one conservative backup, margin.
 if($availableBytes -lt $required){throw 'STAGE4_DISK_ALANI_YETERSIZ'}
 return $required
}
function Open-Stage4Connection([string]$db){
 Assert-Stage4Identity $server $db
 $cn=[Data.SqlClient.SqlConnection]::new("Server=$server;Database=$db;Integrated Security=True;Encrypt=False;Application Name=ERP-STAGE04-RECOVERY")
 try{
  $cn.Open();$cmd=$cn.CreateCommand();$cmd.CommandText="SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) serverName, DB_NAME() databaseName"
  $r=$cmd.ExecuteReader();try{if(-not $r.Read()){throw 'STAGE4_KIMLIK_OKUNAMADI'};Assert-Stage4Identity $r.GetString(0) $r.GetString(1);if($r.GetString(1) -cne $db){throw 'STAGE4_KIMLIK_GECERSIZ'}}finally{$r.Close()}
  return $cn
 }catch{$cn.Dispose();throw}
}
function Stage4-Rows($cn,[string]$query){
 $cmd=$cn.CreateCommand();$cmd.CommandTimeout=900;$cmd.CommandText=$query;$r=$cmd.ExecuteReader();$rows=[Collections.Generic.List[object]]::new()
 try{while($r.Read()){$row=[ordered]@{};for($i=0;$i -lt $r.FieldCount;$i++){$row[$r.GetName($i)]=if($r.IsDBNull($i)){$null}else{$r.GetValue($i)}};$rows.Add([pscustomobject]$row)}}finally{$r.Close();$cmd.Dispose()}
 return $rows.ToArray()
}
function Stage4-Execute($cn,[string]$query){$cmd=$cn.CreateCommand();$cmd.CommandTimeout=900;$cmd.CommandText=$query;try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}}
function Stage4-Save([string]$name,$value){
 if($name -notmatch '^[a-z0-9-]+\.json$'){throw 'STAGE4_KANIT_YOLU_GECERSIZ'}
 [IO.File]::WriteAllText((Join-Path $evidenceRoot $name),($value|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
}
function Assert-NewStage4Targets($master){
 foreach($db in $targets){
  $exists=@(Stage4-Rows $master "SELECT name FROM sys.databases WHERE name=N'$db'").Count -ne 0
  $data=Join-Path $dataRoot ($db+'.mdf');$log=Join-Path $dataRoot ($db+'_log.ldf')
  Assert-Stage4Target $db $data $log $exists (Test-Path -LiteralPath $data) (Test-Path -LiteralPath $log)
 }
}
function Stage4-Snapshot([string]$db){
 $cn=Open-Stage4Connection $db;$groups=[ordered]@{};$started=[DateTime]::UtcNow.ToString('o')
 try{
  foreach($table in $criticalTables){
   $parts=$table.Split('.');$qualified='['+$parts[0]+'].['+$parts[1]+']'
   $cmd=$cn.CreateCommand();$cmd.CommandTimeout=900
   $cmd.CommandText="IF OBJECT_ID(N'$table',N'U') IS NULL THROW 51904,'STAGE4_KRITIK_TABLO_EKSIK',1; SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) rowHash FROM $qualified x ORDER BY rowHash"
   $r=$cmd.ExecuteReader();$digest=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256);$count=0L
   try{
    $digest.AppendData([Text.Encoding]::UTF8.GetBytes('['))
    while($r.Read()){$hash=$r.GetString(0);if($hash -cnotmatch '^[A-F0-9]{64}$'){throw 'STAGE4_SATIR_KANITI_EKSIK'};$prefix=if($count -eq 0){'"'}else{',"'};$digest.AppendData([Text.Encoding]::UTF8.GetBytes($prefix+$hash+'"'));$count++}
    $digest.AppendData([Text.Encoding]::UTF8.GetBytes(']'));$sha=[Convert]::ToHexString($digest.GetHashAndReset()).ToLowerInvariant()
    $groups[$table]=[ordered]@{count=$count;fullRowsHashMultisetSHA256=$sha;basis=$hashBasis}
   }finally{$r.Close();$cmd.Dispose();$digest.Dispose()}
   Write-Host "KANIT_TABLO $db $table $count"
  }
  $modules=@(Stage4-Rows $cn "SELECT SCHEMA_NAME(o.schema_id) schemaName,o.name,o.type,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) definitionSHA256,CASE WHEN o.type='TR' THEN OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled') ELSE 0 END disabled FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.is_ms_shipped=0 ORDER BY schemaName,o.name,o.type")
  if($modules.Count -lt 177 -or @($modules|Where-Object {$_.definitionSHA256 -cnotmatch '^[A-F0-9]{64}$' -or $null -eq $_.disabled}).Count){throw 'STAGE4_MODUL_KANITI_EKSIK'}
  $schema=@(Stage4-Rows $cn "SELECT SCHEMA_NAME(o.schema_id) schemaName,o.name tableName,c.column_id,c.name columnName,TYPE_NAME(c.user_type_id) typeName,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed FROM sys.objects o JOIN sys.columns c ON c.object_id=o.object_id WHERE o.type='U' AND o.is_ms_shipped=0 ORDER BY schemaName,tableName,c.column_id")
  $dbState=@(Stage4-Rows $cn "SELECT state_desc,is_read_only,collation_name FROM sys.databases WHERE database_id=DB_ID()")
  return [ordered]@{schemaVersion='melisa-stage4.recovery-snapshot.v1';identity=@{server=$server;database=$db};startedAt=$started;capturedAt=[DateTime]::UtcNow.ToString('o');groups=$groups;modules=$modules;schema=$schema;databaseState=$dbState;atomic=$false;sourceWrites=0;coverage='29 critical tables; all SQL module definitions and trigger disabled state; native column schema; not all database rows'}
 }finally{$cn.Dispose()}
}
function Stage4-Preflight($master){
 Assert-NewStage4Targets $master;Assert-Stage4BackupPath $backupFile (Test-Path -LiteralPath $backupFile)
 $cn=Open-Stage4Connection $sourceDb
 try{
  $files=@(Stage4-Rows $cn 'SELECT name,type_desc,physical_name,CAST(size AS bigint)*8192 sizeBytes FROM sys.database_files')
  Assert-Stage4FileList $files
  $vol=@(Stage4-Rows $cn 'SELECT volume_mount_point,MIN(available_bytes) available_bytes FROM sys.database_files f CROSS APPLY sys.dm_os_volume_stats(DB_ID(),f.file_id) GROUP BY volume_mount_point')
  if($vol.Count -ne 1 -or $vol[0].volume_mount_point -cne 'C:\'){throw 'STAGE4_DISK_KIMLIGI_GECERSIZ'}
  $needed=Assert-Stage4Space ([long]($files|Measure-Object sizeBytes -Sum).Sum) $vol[0].available_bytes
  return [ordered]@{schemaVersion='melisa-stage4.recovery-preflight.v1';server=$server;sourceDatabase=$sourceDb;targets=$targets;backupFile=$backupFile;dataRoot=$dataRoot;sourceFiles=$files;requiredConservativeBytes=$needed;availableBytes=$vol[0].available_bytes;overwriteAllowed=$false;existingTargetAllowed=$false}
 }finally{$cn.Dispose()}
}
function Stage4-Compare($before,$after,$restores){
 if($before.identity.server -cne $server -or $before.identity.database -cne $sourceDb -or $after.identity.server -cne $server -or $after.identity.database -cne $sourceDb -or @($restores).Count -ne 2){throw 'STAGE4_KARSILASTIRMA_KIMLIGI_GECERSIZ'}
 $changed=[Collections.Generic.List[string]]::new();$all=@($after)+@($restores)
 foreach($snapshot in $all){
  if($snapshot.identity.database -cnotin (@($sourceDb)+$targets) -or $snapshot.identity.server -cne $server){throw 'STAGE4_KARSILASTIRMA_KIMLIGI_GECERSIZ'}
  foreach($table in $criticalTables){
   $b=$before.groups[$table];$a=$snapshot.groups[$table]
   if($null -eq $a -or $null -eq $b -or $a.basis -cne $hashBasis -or $b.basis -cne $hashBasis -or $a.count -ne $b.count -or $a.fullRowsHashMultisetSHA256 -cne $b.fullRowsHashMultisetSHA256){$changed.Add($snapshot.identity.database+':'+$table)}
  }
  foreach($part in @('modules','schema')){if(($before[$part]|ConvertTo-Json -Depth 12 -Compress) -cne ($snapshot[$part]|ConvertTo-Json -Depth 12 -Compress)){$changed.Add($snapshot.identity.database+':'+$part)}}
 }
 if($restores[0].identity.database -cne $recoveryDb -or $restores[1].identity.database -cne $copyDb -or
    $restores[0].databaseState[0].is_read_only -ne $true -or $restores[1].databaseState[0].is_read_only -ne $false -or
    @($all|Where-Object {$_.databaseState[0].state_desc -cne 'ONLINE' -or $_.databaseState[0].collation_name -cne $before.databaseState[0].collation_name}).Count){throw 'STAGE4_HEDEF_DURUMU_GECERSIZ'}
 return [ordered]@{schemaVersion='melisa-stage4.recovery-comparison.v1';status=$(if($changed.Count){'FAIL'}else{'PASS'});comparedAt=[DateTime]::UtcNow.ToString('o');tablesCompared=$criticalTables.Count;moduleDefinitionsCompared=$before.modules.Count;sourceBeforeAfterEqual=($changed.Count -eq 0);bothRawRestoresMatchSource=($changed.Count -eq 0);changed=$changed.ToArray();hashBasis=$hashBasis;recoveryReadOnly=$true;operationalCopyReadWrite=$true;actualRestorePerformed=$true;activeDatabaseOverwritten=$false;coverage='29 critical tables and all SQL modules/native columns; not whole database rows'}
}

# Offline tests dot-source only these definitions. They cannot connect or create files.
if($MyInvocation.InvocationName -eq '.'){return}
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$master=$null
try{
 $master=Open-Stage4Connection 'master'
 if($Mode -eq 'Preflight'){Stage4-Save 'preflight.json' (Stage4-Preflight $master);Write-Host 'STAGE4_PREFLIGHT_HAZIR';exit}
 if($Mode -eq 'Rehearse'){
  Stage4-Save 'preflight.json' (Stage4-Preflight $master)
  New-Item -ItemType Directory -Path $backupRoot,$dataRoot -Force | Out-Null
  $before=Stage4-Snapshot $sourceDb;Stage4-Save 'source-before.json' $before
  $edition=@(Stage4-Rows $master "SELECT CONVERT(int,SERVERPROPERTY('EngineEdition')) engineEdition")[0]
  $compression=if($edition.engineEdition -eq 4){''}else{',COMPRESSION'}
  Assert-Stage4BackupPath $backupFile (Test-Path -LiteralPath $backupFile)
  $timer=[Diagnostics.Stopwatch]::StartNew()
  Stage4-Execute $master "IF DB_ID(N'$sourceDb') IS NULL THROW 51904,'STAGE4_KAYNAK_EKSIK',1; BACKUP DATABASE [$sourceDb] TO DISK=N'$backupFile' WITH COPY_ONLY,CHECKSUM$compression,NOINIT;"
  $timer.Stop();$backupMs=$timer.ElapsedMilliseconds
  $header=@(Stage4-Rows $master "RESTORE HEADERONLY FROM DISK=N'$backupFile'");Assert-Stage4Header $header
  $files=@(Stage4-Rows $master "RESTORE FILELISTONLY FROM DISK=N'$backupFile'");Assert-Stage4FileList $files $true
  Stage4-Execute $master "RESTORE VERIFYONLY FROM DISK=N'$backupFile' WITH CHECKSUM;"
  $sha=(Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
  Stage4-Save 'backup-result.json' ([ordered]@{schemaVersion='melisa-stage4.backup.v1';server=$server;sourceDatabase=$sourceDb;file=$backupFile;sha256=$sha;sizeBytes=(Get-Item -LiteralPath $backupFile).Length;backupMs=$backupMs;copyOnly=$true;checksum=$true;verifyOnlyPassed=$true;backupSetGuid=[string]$header[0].BackupSetGUID;recordedAt=[DateTime]::UtcNow.ToString('o')})
  $results=@()
  foreach($db in $targets){
   $data=Join-Path $dataRoot ($db+'.mdf');$log=Join-Path $dataRoot ($db+'_log.ldf')
   Assert-Stage4Target $db $data $log (@(Stage4-Rows $master "SELECT name FROM sys.databases WHERE name=N'$db'").Count -ne 0) (Test-Path -LiteralPath $data) (Test-Path -LiteralPath $log)
   if((Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash -cne $sha){throw 'STAGE4_YEDEK_DEGISTI'}
   $timer.Restart()
   Stage4-Execute $master "IF DB_ID(N'$db') IS NOT NULL THROW 51904,'STAGE4_HEDEF_ZATEN_VAR',1; RESTORE DATABASE [$db] FROM DISK=N'$backupFile' WITH CHECKSUM,RECOVERY,MOVE N'MELISA_ERP_V2' TO N'$data',MOVE N'MELISA_ERP_V2_log' TO N'$log';"
   $timer.Stop()
   if($db -ceq $recoveryDb){Stage4-Execute $master "ALTER DATABASE [$recoveryDb] SET READ_ONLY WITH NO_WAIT;"}
   $results+=[ordered]@{database=$db;dataFile=$data;logFile=$log;restoreMs=$timer.ElapsedMilliseconds;restored=$true;readOnly=($db -ceq $recoveryDb)}
   Stage4-Save 'restore-results.json' $results
   Write-Host "STAGE4_YENI_KOPYA_HAZIR $db"
  }
 }
 if($Mode -in @('Rehearse','Proof')){
  $before=Get-Content -LiteralPath (Join-Path $evidenceRoot 'source-before.json') -Raw|ConvertFrom-Json -AsHashtable
  $backup=Get-Content -LiteralPath (Join-Path $evidenceRoot 'backup-result.json') -Raw|ConvertFrom-Json -AsHashtable
  if($backup.server -cne $server -or $backup.sourceDatabase -cne $sourceDb -or $backup.file -cne $backupFile -or (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash -cne $backup.sha256){throw 'STAGE4_YEDEK_KANITI_GECERSIZ'}
  $after=Stage4-Snapshot $sourceDb;Stage4-Save 'source-after.json' $after
  $restores=@();foreach($db in $targets){$snapshot=Stage4-Snapshot $db;Stage4-Save $(if($db -ceq $recoveryDb){'recovery-snapshot.json'}else{'copy-snapshot.json'}) $snapshot;$restores+=,$snapshot}
  $comparison=Stage4-Compare $before $after $restores;Stage4-Save 'restore-comparison.json' $comparison
  if($comparison.status -cne 'PASS'){throw 'STAGE4_KOPYA_KANITI_FARKLI'}
  Write-Host "STAGE4_RESTORE_PASS $($comparison.tablesCompared) TABLO $($comparison.moduleDefinitionsCompared) MODUL"
 }
}catch{
 Stage4-Save 'recovery-failure.json' ([ordered]@{schemaVersion='melisa-stage4.recovery-failure.v1';recordedAt=[DateTime]::UtcNow.ToString('o');mode=$Mode;code='STAGE4_KURTARMA_DURDU';existingTargetOverwriteAllowed=$false;activeSourceChanged=$false;targetsRetainedForInspection=$true;secretsLogged=$false})
 throw 'STAGE4_KURTARMA_DURDU: Kopyalar ve private kanit korundu; mevcut veritabanina yeniden yukleme yapilmadi.'
}finally{if($master){$master.Dispose()}}
