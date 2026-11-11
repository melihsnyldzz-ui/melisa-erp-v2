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
 Assert ((Recovery-IsolateSql).Contains('EXEC [MELISA_ERP_DB9_RESTORE_20261111_4B560CEE].sys.sp_executesql')) 'COPY_ONLY_DENY'
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
 Assert ($sql.Contains('SELECT tableName,[rowCount],dataSha256 FROM @result') -and -not $sql.Contains('SELECT @json')) 'NO_RAW_ROWS'
 Assert ((Recovery-MetadataSql (Recovery-Target).database $false).Contains('CONVERT(nvarchar(128),last_value)')) 'SQL_VARIANT_CANONICAL'
 $sourceMeta=Recovery-MetadataSql (Recovery-Target).database $false;$copyMeta=Recovery-MetadataSql (Recovery-Names).restoreDatabase $true
 Assert (-not $sourceMeta.Contains('AND NOT(p.class=0') -and $copyMeta.Contains("p.permission_name=N'CONNECT' AND p.state=N'D' AND p.grantee_principal_id=0")) 'ONLY_COPY_EXCEPTION'
 Reject {Recovery-MetadataSql (Recovery-Target).database $true} 'RECOVERY_METADATA_SCOPE'
}
Check 'fingerprint reserved rowCount identifier is delimited in declaration and result without changing JSON contract' {
 foreach($database in @((Recovery-Target).database,(Recovery-Names).restoreDatabase)){
  $sql=Recovery-FingerprintSql $database
  Assert ($sql.Contains('DECLARE @result TABLE(tableName nvarchar(128),[rowCount] varchar(30),dataSha256 varchar(64));')) 'DELIMITED_ROWCOUNT_DECLARATION'
  Assert ($sql.Contains('SELECT tableName,[rowCount],dataSha256 FROM @result')) 'DELIMITED_ROWCOUNT_SELECT'
  Assert (-not($sql -cmatch '(?<![\[A-Za-z0-9_])rowCount(?![\]A-Za-z0-9_])')) 'NO_BARE_ROWCOUNT_IDENTIFIER'
  Assert ($sql.Contains('INSERT @result VALUES(@table,CONVERT(varchar(30),@count),') -and $sql.Contains('FOR JSON PATH,INCLUDE_NULL_VALUES')) 'FINGERPRINT_VALUES_JSON_UNCHANGED'
 }
 $public='[{"tableName":"public_example","rowCount":"0","dataSha256":"'+('a'*64)+'"}]'|ConvertFrom-Json -AsHashtable -NoEnumerate
 Assert ($public[0].Contains('rowCount') -and -not$public[0].Contains('[rowCount]') -and $public[0].rowCount -ceq '0') 'PUBLIC_JSON_ROWCOUNT_NAME'
}
Check 'successor recovery namespace never reuses failed operation artifacts or destination' {
 $n=Recovery-Names
 Assert ($n.operationId -ceq '4b560cee-677a-499a-83e8-0dd08726ec40' -and $n.restoreDatabase -ceq 'MELISA_ERP_DB9_RESTORE_20261111_4B560CEE') 'SUCCESSOR_OPERATION'
 Assert ($n.backupPath.EndsWith('DB9_K12_AFTER_FIRSTSALE_4b560cee677a499a83e80dd08726ec40.bak') -and $n.dataPath.EndsWith('MELISA_ERP_DB9_RESTORE_20261111_4B560CEE.mdf') -and $n.logPath.EndsWith('MELISA_ERP_DB9_RESTORE_20261111_4B560CEE_log.ldf') -and $n.mediaName -ceq 'DB9_K12_4b560cee677a499a83e80dd08726ec40') 'SUCCESSOR_MEDIA_AND_FILES'
 Reject {Recovery-Database 'MELISA_ERP_DB9_RESTORE_20261111_CA3526AE'} 'RECOVERY_DATABASE_REJECTED'
 $text=[IO.File]::ReadAllText($runnerPath)
 Assert ($text.Contains("`$Mode.ToLowerInvariant()+'-v2-20261111.json'") -and $text.Contains("db9-firstsale-recovery-4b560cee-'")) 'SUCCESSOR_DECISION_AND_PREFIX'
 Assert ($text.Contains('/db9-firstsale-recovery-4b560cee-preflight-result.json') -and $text.Contains('/db9-firstsale-recovery-4b560cee-preflight-closed.json') -and -not($text -match '(?i)ca3526ae')) 'NO_OLD_RESULT_REPLAY'
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
Check 'real decision validator requires postRole authority exact target source review' {
 $script:Mode='Preflight';$script:ExpectedSelfSha256='a'*64;$script:ExpectedCoreSha256='b'*64
 $savedReference=${function:Recovery-PublicReference}
 try{
  function Recovery-PublicReference($Reference){if($Reference.kind -ceq 'review'){return @{decision='GO_SOURCE_ONLY';P1P2Findings=0;files=@{core=$script:ExpectedCoreSha256;runner=$script:ExpectedSelfSha256}}};return @{synthetic=$true}}
  $d=@{version=1;mode='Preflight';operationId=(Recovery-Names).operationId;authorizedBy='ROOT_SEQUENTIAL_OWNER';postRoleBindingsConfirmed=$true;target=(Recovery-Target);runtimeSourceHead='70e8ec1584369eeb1aae9a76a5285509cd127d7b';personnelExpected=@{users=7;roles=7;permissions=58};runnerSha256=$script:ExpectedSelfSha256;coreSha256=$script:ExpectedCoreSha256;roleAppliedReceipt=@{kind='receipt'};finalNativeSnapshot=@{kind='snapshot'};independentSourceReview=@{kind='review'}}
  [void](Recovery-Decision $d)
  $d.postRoleBindingsConfirmed=$false;Reject {Recovery-Decision $d} 'RECOVERY_DECISION_REJECTED';$d.postRoleBindingsConfirmed=$true
  $d.personnelExpected.roles=6;Reject {Recovery-Decision $d} 'RECOVERY_ROLE_FINAL_BINDING';$d.personnelExpected.roles=7
  $d.target.databaseId=5;Reject {Recovery-Decision $d} 'RECOVERY_DECISION_TARGET';$d.target.databaseId=9
  $d.coreSha256='c'*64;Reject {Recovery-Decision $d} 'RECOVERY_SOURCE_PINS'
  $d.coreSha256=$script:ExpectedCoreSha256;$d.mode='BackupRestore';$script:Mode='BackupRestore'
  Reject {Recovery-Decision $d} 'RECOVERY_PREFLIGHT_REFERENCE_PAIR'
 }finally{${function:Recovery-PublicReference}=$savedReference}
}
Check 'paired preflight closure requires same operation mode result hash and actual release' {
 $p=@{mode='Preflight';operationId=(Recovery-Names).operationId;state='RECOVERY_PREFLIGHT_PASSED_ZERO_SQL_WRITES';decisionSha256='a'*64;runnerSha256='b'*64;coreSha256='c'*64}
 $r=@{path='C:/public/preflight-result.json';sha256='d'*64}
 $c=@{state='RECOVERY_LIFECYCLE_CLOSED_AND_RELEASED';mode='Preflight';operationId=$p.operationId;resultPath=$r.path;resultSha256=$r.sha256;resultState=$p.state;decisionSha256=$p.decisionSha256;runnerSha256=$p.runnerSha256;coreSha256=$p.coreSha256;connectionCloseCompleted=$true;connectionDisposeCompleted=$true;connectionStateClosed=$true;holdsReleaseCompleted=$true;locksReleaseCompleted=$true;locksExpectedCount=2;locksReleasedCount=2;successResultPersisted=$true;sqlRollbackClaimed=$false}
 Recovery-ValidatePreflightClosed $p $c $r
 Reject {Recovery-ValidatePreflightClosed $p $null $r} 'RECOVERY_PREFLIGHT_CLOSED_SCOPE'
 $c.mode='BackupRestore';Reject {Recovery-ValidatePreflightClosed $p $c $r} 'RECOVERY_PREFLIGHT_CLOSED_SCOPE';$c.mode='Preflight'
 $c.resultSha256='e'*64;Reject {Recovery-ValidatePreflightClosed $p $c $r} 'RECOVERY_PREFLIGHT_CLOSED_BINDING';$c.resultSha256=$r.sha256
 $c.connectionDisposeCompleted=$false;Reject {Recovery-ValidatePreflightClosed $p $c $r} 'RECOVERY_PREFLIGHT_CLOSE_NOT_VERIFIED';$c.connectionDisposeCompleted=$true
 $c.locksReleasedCount=1;Reject {Recovery-ValidatePreflightClosed $p $c $r} 'RECOVERY_PREFLIGHT_CLOSE_NOT_VERIFIED'
}
function Fixture-Disposable([bool]$Fail=$false){
 $d=[pscustomobject]@{Fail=$Fail;Attempts=0};$d|Add-Member ScriptMethod Dispose {$this.Attempts++;if($this.Fail){throw 'fake-dispose'}};return $d
}
Check 'production Close and Dispose independent faults release actual flags' {
 foreach($failure in @('none','close','dispose','lock')){
  $connection=[pscustomobject]@{State='Open';CloseAttempts=0;DisposeAttempts=0;FailClose=($failure -ceq 'close');FailDispose=($failure -ceq 'dispose')}
  $connection|Add-Member ScriptMethod Close {$this.CloseAttempts++;if($this.FailClose){throw 'fake-close'};$this.State='Closed'}
  $connection|Add-Member ScriptMethod Dispose {$this.DisposeAttempts++;if($this.FailDispose){throw 'fake-dispose'};$this.State='Closed'}
  $holds=@((Fixture-Disposable));$locks=@((Fixture-Disposable ($failure -ceq 'lock')),(Fixture-Disposable))
  $actual=Recovery-CloseResources $connection $holds $locks
  Assert ($connection.CloseAttempts -eq 1 -and $connection.DisposeAttempts -eq 1 -and $holds[0].Attempts -eq 1 -and $locks[0].Attempts -eq 1 -and $locks[1].Attempts -eq 1) 'CLOSE_DISPOSE_RELEASE_ALL_ATTEMPTED'
  Assert ($actual.connectionCloseCompleted -eq ($failure -cne 'close') -and $actual.connectionDisposeCompleted -eq ($failure -cne 'dispose') -and $actual.locksReleaseCompleted -eq ($failure -cne 'lock')) 'REAL_CLOSE_FLAGS'
  Assert ($actual.connectionStateClosed -and $actual.locksExpectedCount -eq 2 -and $actual.locksReleasedCount -eq $(if($failure -ceq 'lock'){1}else{2})) 'REAL_RELEASE_COUNTS'
 }
}
Check 'actual runner AST locks pins close and no operational body evaluated' {
 $run=($runnerDefs|Where-Object Name -ceq 'Recovery-Run').Body.Extent.Text
 Assert ($run.IndexOf('Recovery-Boundary') -lt $run.IndexOf('$connection.Open()')) 'BOUNDARY_BEFORE_OPEN'
 Assert ($run.Contains('[IO.FileShare]::None') -and $run.Contains('desktop-empty-schema.owner.lock') -and $run.Contains('desktop-initial-reader.owner.lock')) 'TWO_NO_SHARE'
 $close=($defs|Where-Object Name -ceq 'Recovery-CloseResources').Body.Extent.Text
 Assert ($close.IndexOf('$Connection.Close()') -lt $close.IndexOf('foreach($lock in $Locks)') -and $close.IndexOf('$Connection.Dispose()') -lt $close.IndexOf('foreach($lock in $Locks)')) 'CLOSE_BEFORE_UNLOCK'
 Assert ($close.Contains('connectionCloseCompleted=$closeCompleted') -and $close.Contains('sqlRollbackClaimed=$false') -and $run.Contains("'RECOVERY_LIFECYCLE_UNKNOWN_NO_RETRY'")) 'HONEST_CLOSE_AND_NO_SQL_ROLLBACK'
 $all=$runnerAst.Extent.Text
 Assert ($all -notmatch '(?i)(Start-Process|Stop-Process|Restart-Service|Stop-Service|Start-Service|Remove-Item|\.Kill\(|\.BeginTransaction\()') 'NO_OS_ACTION_OR_TRANSACTED_BACKUP'
 $builder=($runnerDefs|Where-Object Name -ceq 'Recovery-NewConnection').Body.Extent.Text
 foreach($setter in @('DataSource','InitialCatalog','IntegratedSecurity','Encrypt','Pooling','ConnectTimeout','ApplicationName')){Assert ($builder.Contains('set_'+$setter+'(')) 'CLR_SETTER'}
 Assert ($builder -notmatch '\.Open\(') 'BUILDER_CLOSED'
}
[Console]::WriteLine(('RECOVERY_PURE_PASS tests='+$testCount+' operationalBody=false SQL=0 OS=0'))
