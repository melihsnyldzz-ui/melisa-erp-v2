param([ValidateSet('Preflight','SourceCapture')][string]$Mode='Preflight',[Parameter(Mandatory=$true)][ValidateSet('Pre','Post')][string]$Phase,[Parameter(Mandatory=$true)][ValidatePattern('^P03-202610(?:19|20|21)-[0-9]{6}$')][string]$RunId)
# Existing hash algorithm, current DB02 SELECT only. No clone/restore/DDL/DML.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$p03Server='Semih\MELISADEV';$p03Source='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82'
$root=Join-Path 'C:\Sirket\ERP\backups' $RunId;$baselinePath='C:\Sirket\ERP\reports\p03-db02-content-baseline-20261017.json';$script:p03ReadTransaction=$null
function Assert-True($condition,[string]$code){if(-not $condition){throw $code}}
function Check-Path([string]$file){for($p=[IO.Path]::GetFullPath($file);$p;$p=[IO.Path]::GetDirectoryName($p)){if(Test-Path -LiteralPath $p){Assert-True (-not((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)) 'SOURCE_CAPTURE_REPARSE'}}}
function Save-New([string]$leaf,$value){$file=Join-Path $root $leaf;Check-Path $file;Assert-True (-not(Test-Path -LiteralPath $file)) 'SOURCE_CAPTURE_EXISTS';$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 14));$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetAccessRuleProtection($true,$false);$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl.SetOwner($owner);foreach($sid in @($owner,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow'))};$stream=New-Object IO.FileStream($file,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl);try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()};Assert-True ((Get-Acl -LiteralPath $file).AreAccessRulesProtected-and@( (Get-Acl -LiteralPath $file).Access).Count-eq2) 'SOURCE_CAPTURE_METADATA_ACL';return [ordered]@{path=$file;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}}
function Open-Database([string]$database){Assert-True ($database-ceq$p03Source) 'SOURCE_CAPTURE_DATABASE';$connection=[Data.SqlClient.SqlConnection]::new("Server=$p03Server;Database=$database;Integrated Security=True;Encrypt=False;Application Name=MelisaP03CurrentReadOnlyInvariance;Connect Timeout=5");try{$connection.Open();$identity=@(Rows $connection "SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) serverName,DB_NAME() databaseName")[0];Assert-True ($identity.serverName-ceq$p03Server-and$identity.databaseName-ceq$p03Source) 'SOURCE_CAPTURE_IDENTITY';$seal=@(Rows $connection "SELECT COUNT_BIG(*) n FROM dbo.stage4_copy_manifest WHERE copy_id='$copy' AND sealed=1" 5)[0];Assert-True ($seal.n-eq1) 'SOURCE_CAPTURE_SEAL';return $connection}catch{$connection.Dispose();throw}}
function Rows($connection,[string]$sql,[int]$timeout=1800){
 $command=$connection.CreateCommand();$command.CommandText=$sql;$command.CommandTimeout=$timeout;if($null-ne$script:p03ReadTransaction){$command.Transaction=$script:p03ReadTransaction}
 try{$reader=$command.ExecuteReader();$rows=@();try{do{while($reader.Read()){$row=[ordered]@{};for($i=0;$i-lt $reader.FieldCount;$i++){$row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$rows+=[pscustomobject]$row}}while($reader.NextResult())}finally{$reader.Close()};return $rows}finally{$command.Dispose()}
}
function Execute($connection,[string]$sql){Assert-True ($sql-ceq'SET LOCK_TIMEOUT 3000; SET DEADLOCK_PRIORITY LOW;') 'SOURCE_CAPTURE_SQL_REJECTED';$command=$connection.CreateCommand();$command.CommandText=$sql;$command.CommandTimeout=1800;if($null-ne$script:p03ReadTransaction){$command.Transaction=$script:p03ReadTransaction};try{[void]$command.ExecuteNonQuery()}finally{$command.Dispose()}}
function Snapshot([string]$database,[string[]]$tableNames){
 Assert-True ($database -ceq $p03Source) 'P03_SNAPSHOT_SOURCE_ONLY'
 $connection=Open-Database $database
 try{
  Execute $connection 'SET LOCK_TIMEOUT 3000; SET DEADLOCK_PRIORITY LOW;'
  $script:p03ReadTransaction=$connection.BeginTransaction([Data.IsolationLevel]::Serializable)
  $lsn=@(Rows $connection 'SELECT log_end_lsn lsn FROM sys.dm_db_log_stats(DB_ID())' 5)[0].lsn
  $tables=@();$deadline=[DateTime]::UtcNow.AddMinutes(10)
  function RemainingSeconds { $remaining=[int][Math]::Floor(($deadline-[DateTime]::UtcNow).TotalSeconds);Assert-True ($remaining -gt 0) 'P03_SNAPSHOT_TIME_BUDGET';return [Math]::Min(30,$remaining) }
  foreach($table in $tableNames){
   Assert-True ($table -cmatch '^(dbo|erp_migration)\.[a-zA-Z0-9_]+$') 'P03_TABLE_SCOPE'
   Assert-True ([DateTime]::UtcNow -lt $deadline) 'P03_SNAPSHOT_TIME_BUDGET'
   $parts=$table.Split('.');$qualified='['+$parts[0]+'].['+$parts[1]+']'
   # Stream only one SHA per row. Sorting/aggregation stays outside SQL so a
   # large ordered STRING_AGG cannot monopolize the shared TEST query budget.
   $command=$connection.CreateCommand();$command.CommandTimeout=RemainingSeconds;$command.Transaction=$script:p03ReadTransaction
   $command.CommandText="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) rowHash FROM $qualified t OPTION(MAXDOP 1)"
   $hashes=[Collections.Generic.List[string]]::new();$reader=$null
   try{
    $reader=$command.ExecuteReader()
    while($reader.Read()){
     $hash=$reader.GetString(0);Assert-True ($hash -cmatch '^[A-F0-9]{64}$') 'P03_ROW_HASH'
     $hashes.Add($hash)
     if(($hashes.Count -band 4095) -eq 0){Assert-True ($hashes.Count -le 3000000 -and [DateTime]::UtcNow -lt $deadline) 'P03_STREAM_BUDGET'}
    }
   }finally{if($null -ne $reader){$reader.Close()};$command.Dispose()}
   Assert-True ($hashes.Count -le 3000000 -and [DateTime]::UtcNow -lt $deadline) 'P03_STREAM_FINAL_BUDGET'
   $sorted=$hashes.ToArray();[Array]::Sort($sorted,[StringComparer]::Ordinal)
   $aggregate=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
   try{
    $count=0L
    foreach($hash in $sorted){if(($count -band 4095) -eq 0){Assert-True ([DateTime]::UtcNow -lt $deadline) 'P03_CLIENT_HASH_BUDGET'};$aggregate.AppendData([Text.Encoding]::UTF8.GetBytes($hash+"`n"));$count++}
    $digest=[BitConverter]::ToString($aggregate.GetHashAndReset()).Replace('-','').ToLowerInvariant()
   }finally{$aggregate.Dispose()}
   $tables+=[ordered]@{table=$table;count=$count;sha256=$digest}
  }
  $modules=@(Rows $connection "SELECT SCHEMA_NAME(o.schema_id) schemaName,o.name,o.type,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) sha256 FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.is_ms_shipped=0 ORDER BY schemaName,o.name,o.type" (RemainingSeconds))
  Assert-True (@($modules|Where-Object {$null -eq $_.sha256}).Count -eq 0) 'P03_UNREADABLE_SQL_MODULE'
  $permissions=@(Rows $connection 'SELECT dp.name principalName,p.class,p.major_id,p.minor_id,p.permission_name,p.state FROM sys.database_permissions p JOIN sys.database_principals dp ON dp.principal_id=p.grantee_principal_id ORDER BY dp.name,p.class,p.major_id,p.minor_id,p.permission_name,p.state' (RemainingSeconds))
  $memberships=@(Rows $connection 'SELECT rp.name roleName,mp.name memberName FROM sys.database_role_members rm JOIN sys.database_principals rp ON rp.principal_id=rm.role_principal_id JOIN sys.database_principals mp ON mp.principal_id=rm.member_principal_id ORDER BY rp.name,mp.name' (RemainingSeconds))
  $principals=@(Rows $connection 'SELECT name,type,default_schema_name,authentication_type_desc,owning_principal_id,CONVERT(varchar(170),sid,2) sid FROM sys.database_principals WHERE principal_id>4 ORDER BY name,type' (RemainingSeconds))
  $last=@(Rows $connection 'SELECT log_end_lsn lsn FROM sys.dm_db_log_stats(DB_ID())' (RemainingSeconds))[0].lsn
  Assert-True ([string]$lsn -ceq [string]$last) 'P03_READONLY_CLONE_CHANGED_DURING_SNAPSHOT'
  $result=[ordered]@{database=$database;capturedAt=[DateTime]::UtcNow.ToString('o');tables=$tables;modules=$modules;permissions=$permissions;memberships=$memberships;principals=$principals;logEndBefore=[string]$lsn;logEndAfter=[string]$last;coverage='51 critical business tables; readable SQL modules, explicit permissions, role memberships and principals; not all764 table contents'}
  $script:p03ReadTransaction.Commit();return $result
 }finally{if($null-ne$script:p03ReadTransaction){$script:p03ReadTransaction.Dispose();$script:p03ReadTransaction=$null};$connection.Dispose()}
}

Check-Path $root;Check-Path $baselinePath;Assert-True ((Get-FileHash -LiteralPath $baselinePath -Algorithm SHA256).Hash.ToLowerInvariant()-ceq'b2789bfcd1e2dbc9d3f7e7cc394fa4a1c31ac759e1db3f67f2db007c00c849aa') 'SOURCE_CAPTURE_BASELINE_PIN'
Assert-True (Test-Path -LiteralPath $root -PathType Container) 'SOURCE_CAPTURE_BACKUP_ROOT_REQUIRED'
$backupPath=Join-Path $root 'backup-verified.json';Check-Path $backupPath;$backup=Get-Content -LiteralPath $backupPath -Raw|ConvertFrom-Json
Assert-True ($backup.database-ceq$p03Source-and$backup.server-ceq$p03Server-and$backup.copyOnly-and$backup.checksumVerified-and$backup.restoreVerifyOnly-and-not$backup.commercialWrites-and$backup.copyId-ceq$copy-and$backup.actualT1-eq$false) 'SOURCE_CAPTURE_BACKUP_REQUIRED'
$baseline=Get-Content -LiteralPath $baselinePath -Raw|ConvertFrom-Json;Assert-True ($baseline.database-ceq$p03Source-and$baseline.tables-eq51) 'SOURCE_CAPTURE_BASELINE'
$tables=@($baseline.groups.PSObject.Properties.Name|Sort-Object);Assert-True ($tables.Count-eq51) 'SOURCE_CAPTURE_TABLE_COUNT'
$leafPhase=$Phase.ToLowerInvariant();foreach($leaf in @(('source-'+$leafPhase+'-snapshot.json'),('source-'+$leafPhase+'-proof.json'))){Assert-True (-not(Test-Path -LiteralPath (Join-Path $root $leaf))) 'SOURCE_CAPTURE_OUTPUT_EXISTS'}
if($Mode-ceq'Preflight'){$c=Open-Database $p03Source;$c.Dispose();[ordered]@{ready=$true;scope='CURRENT_DB02_READ_ONLY';phase=$Phase;database=$p03Source;copyId=$copy;actualT1=$false;restored=$false;commercialWrites=$false}|ConvertTo-Json;return}
$startedAt=[DateTime]::UtcNow.ToString('o');$snapshot=Snapshot $p03Source $tables;$snapshotRef=Save-New ('source-'+$leafPhase+'-snapshot.json') $snapshot
$proof=[ordered]@{scope='CURRENT_DB02_READ_ONLY';phase=$Phase;readOnly=$true;criticalTablesHashed=51;server=$p03Server;database=$p03Source;copyId=$copy;actualT1=$false;observedAt=[DateTime]::UtcNow.ToString('o');startedAt=$startedAt;snapshotRef=$snapshotRef;restored=$false;commercialWrites=$false;sourceCaptureKind='SERIALIZABLE_READ_ONLY_TRANSACTION'}
[void](Save-New ('source-'+$leafPhase+'-proof.json') $proof);$proof|ConvertTo-Json -Depth 4
