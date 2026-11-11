# Pure AST/declaration tests. Never invokes Recovery-Run, OS probes or SQL.
$ErrorActionPreference='Stop'
$corePath=Join-Path $PSScriptRoot 'db9-firstsale-recovery-core.ps1'
$runnerPath=Join-Path $PSScriptRoot 'db9-firstsale-recovery.ps1'
function Assert($Condition,[string]$Code){if(-not $Condition){throw ('TEST_'+$Code)}}
function Reject([scriptblock]$Action,[string]$Code){$caught=$false;try{& $Action}catch{$caught=$_.Exception.Message -ceq $Code};Assert $caught $Code}
$coreErrors=$null;$runnerErrors=$null
$coreAst=[Management.Automation.Language.Parser]::ParseFile($corePath,[ref]$null,[ref]$coreErrors)
$runnerAst=[Management.Automation.Language.Parser]::ParseFile($runnerPath,[ref]$null,[ref]$runnerErrors)
Assert ($coreErrors.Count -eq 0 -and $runnerErrors.Count -eq 0) 'SYNTAX'
$defs=@($coreAst.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$false))
Assert ($coreAst.EndBlock.Statements.Count -eq $defs.Count) 'CORE_DECLARATIONS_ONLY'
foreach($def in $defs){Invoke-Expression $def.Extent.Text}
$runnerDefs=@($runnerAst.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$false))
# No runner body is evaluated; definitions only allow in-memory mocks below.
foreach($def in $runnerDefs){Invoke-Expression $def.Extent.Text}
$testCount=0
function Check([string]$Name,[scriptblock]$Test){& $Test;$script:testCount++;[Console]::WriteLine('PASS '+$Name)}
Check 'fixed source/copy identities and SQL no source mutation' {
 $target=Recovery-Target;$names=Recovery-Names
 Assert ($target.databaseId -eq 9 -and $target.tableCount -eq 43 -and $target.columnCount -eq 502 -and -not $target.actualT1 -and -not $target.externalOperations) 'TARGET'
 Reject {Recovery-Database $target.database.ToLowerInvariant()} 'RECOVERY_DATABASE_REJECTED'
 Reject {Recovery-Database ($names.restoreDatabase+'];DROP DATABASE x;--')} 'RECOVERY_DATABASE_REJECTED'
 $guard=Recovery-GuardSql
 foreach($pin in @('6d773db9-bd69-4906-b791-d63a490ab1f2','287f689a-43bb-43dd-950b-adb615fcb20c','2026-11-10 11:10:18.030','4924','Shared memory','0x0105000000000005150000004c0463816267f53b9f6e1299e9030000')){Assert ($guard.Contains($pin)) 'SQL_PIN'}
 $writeSql=(Recovery-BackupSql)+(Recovery-RestoreSql @{logicalData='data';logicalLog='log'})+(Recovery-IsolateSql)+(Recovery-CopyCheckSql)
 Assert ($writeSql -notmatch '(?i)\b(DROP|ALTER|REPAIR_ALLOW_DATA_LOSS|INIT|FORMAT)\b|\bWITH\s+REPLACE\b|,\s*REPLACE\s*[,;]') 'NO_DESTRUCTIVE_TOKEN'
 Assert ((Recovery-IsolateSql).Contains('EXEC [MELISA_ERP_DB9_RESTORE_20261111_CA3526AE].sys.sp_executesql')) 'COPY_ONLY_DENY'
}
Check 'unique backup media and restore logical quoting' {
 $backup=Recovery-BackupSql
 foreach($token in @('COPY_ONLY','CHECKSUM','NO_COMPRESSION','NOINIT','NOSKIP','MEDIANAME','NAME=')){Assert ($backup.Contains($token)) 'BACKUP_OPTIONS'}
 $restore=Recovery-RestoreSql @{logicalData="D'logical";logicalLog='Llogical'}
 Assert ($restore.Contains("N'D''logical'") -and $restore.Contains('RESTRICTED_USER') -and $restore.Contains('RECOVERY') -and $restore.Contains('CHECKSUM,FILE=1')) 'RESTORE_OPTIONS'
 Reject {Recovery-RestoreSql @{logicalData='a';logicalLog='a'}} 'RECOVERY_LOGICAL_NAMES'
}
Check 'all43 PK fingerprints keep sensitive rows only inside native HASHBYTES' {
 $sql=Recovery-FingerprintSql (Recovery-Target).database
 foreach($token in @('is_primary_key=1','ic.key_ordinal>0','ORDER BY ic.key_ordinal','COALESCE((SELECT *','HASHBYTES','IF @keys IS NULL','RECOVERY_TABLE43_REQUIRED','@n>100000','DATALENGTH(@json)>16777216')){Assert ($sql.Contains($token)) 'FULL_HASH_SHAPE'}
 Assert ($sql.Contains('SELECT tableName,rowCount,dataSha256 FROM @result') -and -not $sql.Contains('SELECT @json')) 'NO_RAW_ROWS'
 Assert ((Recovery-MetadataSql (Recovery-Target).database $false).Contains('CONVERT(nvarchar(128),last_value)')) 'SQL_VARIANT_CANONICAL'
 $sourceMeta=Recovery-MetadataSql (Recovery-Target).database $false;$copyMeta=Recovery-MetadataSql (Recovery-Names).restoreDatabase $true
 Assert (-not $sourceMeta.Contains('AND NOT(p.class=0') -and $copyMeta.Contains("p.permission_name=N'CONNECT' AND p.state=N'D' AND p.grantee_principal_id=0")) 'ONLY_COPY_EXCEPTION'
 Reject {Recovery-MetadataSql (Recovery-Target).database $true} 'RECOVERY_METADATA_SCOPE'
}
function Fixture-Layout {
 return @{backupDirectory='C:\Program Files\Microsoft SQL Server\MSSQL16.MELISAERP\MSSQL\Backup\';dataDirectory='C:\Program Files\Microsoft SQL Server\MSSQL16.MELISAERP\MSSQL\DATA\';logDirectory='C:\Program Files\Microsoft SQL Server\MSSQL16.MELISAERP\MSSQL\DATA\';logicalData='D';logicalLog='L';fileBytes='1048576';files=@(@{type=0;physicalName='C:/Program Files/Microsoft SQL Server/MSSQL16.MELISAERP/MSSQL/DATA/source.mdf'},@{type=1;physicalName='C:/Program Files/Microsoft SQL Server/MSSQL16.MELISAERP/MSSQL/DATA/source_log.ldf'});usersCount=7;rolesCount=7;permissionsCount=58}
}
Check 'preflight exact defaults two files role counts capacity fail closed' {
 $layout=Fixture-Layout;$required=Recovery-ValidateLayout $layout 3000000000
 Assert ($required -eq (4*1048576+2147483648L)) 'CAPACITY_FORMULA'
 Reject {Recovery-ValidateLayout $layout ($required-1)} 'RECOVERY_CAPACITY'
 $layout.backupDirectory='D:/Backup';Reject {Recovery-ValidateLayout $layout 3000000000} 'RECOVERY_DEFAULT_PATH_MISMATCH'
 $layout=Fixture-Layout;$layout.rolesCount=6;Reject {Recovery-ValidateLayout $layout 3000000000} 'RECOVERY_ROLE_FINAL_BINDING'
 $layout=Fixture-Layout;$layout.files+=@{type=0};Reject {Recovery-ValidateLayout $layout 3000000000} 'RECOVERY_TWO_FILE_LAYOUT_REQUIRED'
 $layout=Fixture-Layout;$layout.files[0].physicalName='D:/source.mdf';Reject {Recovery-ValidateLayout $layout 3000000000} 'RECOVERY_SOURCE_FILE_PATH'
}
function Fixture-Snapshot {
 return @{tables=@(1..43|ForEach-Object {@{tableName=('table_'+$_);rowCount='0';dataSha256=('a'*64)}});metadata=@{schemaSha256=('b'*64);securitySha256=('c'*64);serverSecuritySha256=('d'*64)}}
}
Check 'source copy after equality catches empty duplicate missing and changed tables' {
 $before=Fixture-Snapshot;$after=Fixture-Snapshot;Recovery-EqualSnapshot $before $after
 Reject {Recovery-ValidateFingerprint @()} 'RECOVERY_TABLE43_REQUIRED'
 $after.tables[42].tableName=$after.tables[0].tableName;Reject {Recovery-EqualSnapshot $before $after} 'RECOVERY_FINGERPRINT_INVALID'
 $after=Fixture-Snapshot;$after.tables[4].dataSha256='e'*64;Reject {Recovery-EqualSnapshot $before $after} 'RECOVERY_DATA_CHANGED'
 $after=Fixture-Snapshot;$after.metadata.securitySha256='f'*64;Reject {Recovery-EqualSnapshot $before $after} 'RECOVERY_METADATA_CHANGED'
}
Check 'backup metadata full set media filelist reject damaged or duplicated sets' {
 $h=@(@{Position=1;BackupType=1;DatabaseName=(Recovery-Target).database;BackupName=(Recovery-Names).mediaName;HasBackupChecksums=$true;IsCopyOnly=$true;IsDamaged=$false;BackupSetGUID='d131d931-0c00-40c4-904e-de611bd71f8e'})
 $m=@(@{MediaName=(Recovery-Names).mediaName;FamilyCount=1;FamilySequenceNumber=1})
 $f=@(@{Type='D';LogicalName='D';IsPresent=$true},@{Type='L';LogicalName='L';IsPresent=$true})
 Recovery-ValidateBackup $h $m $f (Fixture-Layout)
 Reject {Recovery-ValidateBackup ($h+$h) $m $f (Fixture-Layout)} 'RECOVERY_SINGLE_BACKUP_REQUIRED'
 $h[0].IsDamaged=$true;Reject {Recovery-ValidateBackup $h $m $f (Fixture-Layout)} 'RECOVERY_BACKUP_HEADER_REJECTED';$h[0].IsDamaged=$false
 $m[0].MediaName='wrong';Reject {Recovery-ValidateBackup $h $m $f (Fixture-Layout)} 'RECOVERY_MEDIA_REJECTED';$m[0].MediaName=(Recovery-Names).mediaName
 $f[1].LogicalName='wrong';Reject {Recovery-ValidateBackup $h $m $f (Fixture-Layout)} 'RECOVERY_BACKUP_FILELIST_REJECTED'
}
Check 'production phase intent collision prevents submission' {
 $script:events=[Collections.Generic.List[string]]::new()
 Reject {Recovery-Phase BACKUP {$script:events.Add('intent');throw 'OUTPUT_EXISTS'} {$script:events.Add('SQL')} {$script:events.Add('result')}} 'OUTPUT_EXISTS'
 Assert (($script:events -join ',') -ceq 'intent') 'INTENT_BEFORE_SQL'
}
Check 'production phase command and result faults never retry or claim success' {
 foreach($fault in @('invoke','result')){
  $script:events=[Collections.Generic.List[string]]::new()
  Reject {Recovery-Phase RESTORE {$script:events.Add('intent')} {$script:events.Add('SQL');if($fault -ceq 'invoke'){throw 'timeout'}} {$script:events.Add('result');throw 'disk'}} 'RECOVERY_UNKNOWN_NO_RETRY'
  Assert (@($script:events|Where-Object {$_ -ceq 'SQL'}).Count -eq 1) 'NO_RETRY'
 }
 $script:events=[Collections.Generic.List[string]]::new()
 $v=Recovery-Phase BACKUP {$script:events.Add('intent')} {$script:events.Add('SQL');return 7} {$script:events.Add('result')}
 Assert (($script:events -join ',') -ceq 'intent,SQL,result' -and $v -eq 7) 'PHASE_SUCCESS_ORDER'
}
function Fixture-Connection([string]$Json,[bool]$NullValue=$false){
 $reader=[pscustomobject]@{Value=$Json;NullValue=$NullValue;FieldCount=1;Index=-1;Disposed=$false}
 $reader|Add-Member ScriptMethod Read {$this.Index++;return $this.Index -eq 0}
 $reader|Add-Member ScriptMethod NextResult {return $false}
 $reader|Add-Member ScriptMethod GetString {param($i)return $this.Value}
 $reader|Add-Member ScriptMethod IsDBNull {param($i)return $this.NullValue}
 $reader|Add-Member ScriptMethod Dispose {$this.Disposed=$true}
 $command=[pscustomobject]@{Reader=$reader;CommandText='';CommandTimeout=0;Disposed=$false}
 $command|Add-Member ScriptMethod ExecuteReader {return $this.Reader}
 $command|Add-Member ScriptMethod Dispose {$this.Disposed=$true}
 $connection=[pscustomobject]@{Command=$command}
 $connection|Add-Member ScriptMethod CreateCommand {return $this.Command}
 return $connection
}
Check 'production native reader explicit empty JSON null and byte bound dispose' {
 $fake=Fixture-Connection '[{"tableName":"public_example","rowCount":"0"}]'
 $value=Recovery-Execute $fake 'fixed-query' Json
 Assert ($value[0].rowCount -ceq '0' -and $fake.Command.Disposed -and $fake.Command.Reader.Disposed) 'READ_SUCCESS_DISPOSE'
 $fake=Fixture-Connection '[]';$empty=Recovery-Execute $fake 'fixed-query' Json;Assert ($empty -is [array] -and $empty.Count -eq 0) 'EXPLICIT_EMPTY_ARRAY'
 $fake=Fixture-Connection '' $true;Reject {Recovery-Execute $fake 'fixed-query' Json} 'RECOVERY_JSON_SHAPE'
 Assert ($fake.Command.Disposed -and $fake.Command.Reader.Disposed) 'READ_NULL_DISPOSE'
 $fake=Fixture-Connection ('a'*1048577);Reject {Recovery-Execute $fake 'fixed-query' Json} 'RECOVERY_READ_BOUND'
 Assert ($fake.Command.Disposed -and $fake.Command.Reader.Disposed) 'READ_BOUND_DISPOSE'
 $fake=Fixture-Connection '';Reject {Recovery-Execute $fake 'fixed-query' Json} 'RECOVERY_EMPTY_JSON'
}
Check 'actual runner AST locks pins close and no operational body evaluated' {
 $run=($runnerDefs|Where-Object Name -ceq 'Recovery-Run').Body.Extent.Text
 Assert ($run.IndexOf('Recovery-Boundary') -lt $run.IndexOf('$connection.Open()')) 'BOUNDARY_BEFORE_OPEN'
 Assert ($run.Contains('[IO.FileShare]::None') -and $run.Contains('desktop-empty-schema.owner.lock') -and $run.Contains('desktop-initial-reader.owner.lock')) 'TWO_NO_SHARE'
 Assert ($run.IndexOf('$connection.Close()') -lt $run.IndexOf('foreach($s in $locks)')) 'CLOSE_BEFORE_UNLOCK'
 Assert ($run.Contains('connectionCloseCompleted=$closeCompleted') -and $run.Contains('sqlRollbackClaimed=$false')) 'HONEST_CLOSE_AND_NO_SQL_ROLLBACK'
 $all=$runnerAst.Extent.Text
 Assert ($all -notmatch '(?i)(Start-Process|Stop-Process|Restart-Service|Stop-Service|Start-Service|Remove-Item|\.Kill\(|\.BeginTransaction\()') 'NO_OS_ACTION_OR_TRANSACTED_BACKUP'
 $builder=($runnerDefs|Where-Object Name -ceq 'Recovery-NewConnection').Body.Extent.Text
 foreach($setter in @('DataSource','InitialCatalog','IntegratedSecurity','Encrypt','Pooling','ConnectTimeout','ApplicationName')){Assert ($builder.Contains('set_'+$setter+'(')) 'CLR_SETTER'}
 Assert ($builder -notmatch '\.Open\(') 'BUILDER_CLOSED'
}
[Console]::WriteLine(('RECOVERY_PURE_PASS tests='+$testCount+' operationalBody=false SQL=0 OS=0'))
