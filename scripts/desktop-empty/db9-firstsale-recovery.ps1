param([ValidateSet('Preflight','BackupRestore')][string]$Mode,[string]$ExpectedSelfSha256,[string]$ExpectedCoreSha256,[string]$ExpectedDecisionSha256)
# Explicit Root owner only. No service action, app restart, cleanup or retry.
$ErrorActionPreference='Stop'
$script:RecoveryA='C:/Users/Xaser/.codex/visualizations/2026/11/05/01a1aba4-ea01-7f13-93cc-98d60952a40a'
$script:RecoveryR='C:/Users/Xaser/Desktop/ERP/runtime-clean-v7'
$script:RecoveryHolds=[Collections.Generic.List[IO.FileStream]]::new()
function Recovery-Hold([string]$Path,[string]$Sha,[long]$Max=2097152){
 if($Sha -cnotmatch '^[a-f0-9]{64}$'){throw 'RECOVERY_FILE_PIN'}
 Recovery-NoReparse $Path
 $s=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $script:RecoveryHolds.Add($s)
 if($s.Length -lt 1 -or $s.Length -gt $Max){throw 'RECOVERY_FILE_BOUND'}
 $bytes=[byte[]]::new([int]$s.Length);$s.ReadExactly($bytes)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant() -cne $Sha){throw 'RECOVERY_FILE_HASH'}
 return ,$bytes
}
function Recovery-NoReparse([string]$Path){
 $full=[IO.Path]::GetFullPath($Path)
 if(-not [IO.Path]::IsPathFullyQualified($Path) -or $full.StartsWith('\\') -or [IO.Path]::GetPathRoot($full) -cne 'C:\'){throw 'RECOVERY_PATH_REJECTED'}
 $part=[IO.Path]::GetPathRoot($full)
 foreach($segment in $full.Substring($part.Length).Split('\',[StringSplitOptions]::RemoveEmptyEntries)){
  $part=Join-Path $part $segment
  if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'RECOVERY_REPARSE_REJECTED'}
 }
}
function Recovery-WriteNew([string]$Path,$Value){
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path)).Replace('\','/') -cne $script:RecoveryA){throw 'RECOVERY_OUTPUT_PATH'}
 $bytes=[Text.UTF8Encoding]::new($false,$true).GetBytes(($Value|ConvertTo-Json -Depth 25 -Compress)+"`n")
 if($bytes.Length -gt 1048576){throw 'RECOVERY_OUTPUT_BOUND'}
 $s=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$s.Write($bytes);$s.Flush($true)}finally{$s.Dispose()}
}
function Recovery-PublicReference($Reference){
 if($Reference.path -isnot [string] -or [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Reference.path)).Replace('\','/') -cne $script:RecoveryA -or [IO.Path]::GetExtension($Reference.path) -cne '.json'){throw 'RECOVERY_REFERENCE_PATH'}
 $bytes=Recovery-Hold $Reference.path $Reference.sha256
 return [Text.UTF8Encoding]::new($false,$true).GetString($bytes)|ConvertFrom-Json -AsHashtable -DateKind String
}
function Recovery-Decision($Decision){
 Recovery-Assert ($Decision.version -eq 1 -and $Decision.mode -ceq $Mode -and $Decision.operationId -ceq (Recovery-Names).operationId -and $Decision.postRoleBindingsConfirmed -ceq $true -and $Decision.authorizedBy -ceq 'ROOT_SEQUENTIAL_OWNER') 'RECOVERY_DECISION_REJECTED'
 foreach($key in (Recovery-Target).Keys){Recovery-Assert ($Decision.target.Contains($key) -and $Decision.target[$key] -ceq (Recovery-Target)[$key]) 'RECOVERY_DECISION_TARGET'}
 Recovery-Assert ($Decision.runtimeSourceHead -ceq '70e8ec1584369eeb1aae9a76a5285509cd127d7b' -and $Decision.personnelExpected.users -eq 7 -and $Decision.personnelExpected.roles -eq 7 -and $Decision.personnelExpected.permissions -eq 58) 'RECOVERY_ROLE_FINAL_BINDING'
 Recovery-Assert ($Decision.runnerSha256 -ceq $ExpectedSelfSha256 -and $Decision.coreSha256 -ceq $ExpectedCoreSha256) 'RECOVERY_SOURCE_PINS'
 foreach($name in @('roleAppliedReceipt','finalNativeSnapshot')){[void](Recovery-PublicReference $Decision[$name])}
 $review=Recovery-PublicReference $Decision.independentSourceReview
 Recovery-Assert ($review.decision -ceq 'GO_SOURCE_ONLY' -and $review.P1P2Findings -eq 0 -and $review.files.core -ceq $ExpectedCoreSha256 -and $review.files.runner -ceq $ExpectedSelfSha256) 'RECOVERY_INDEPENDENT_REVIEW'
 if($Mode -ceq 'BackupRestore'){
  $preflight=Recovery-PublicReference $Decision.preflight
  Recovery-Assert ($preflight.state -ceq 'RECOVERY_PREFLIGHT_PASSED_ZERO_SQL_WRITES' -and $preflight.operationId -ceq (Recovery-Names).operationId -and $preflight.roleAppliedReceiptSha256 -ceq $Decision.roleAppliedReceipt.sha256 -and $preflight.finalNativeSnapshotSha256 -ceq $Decision.finalNativeSnapshot.sha256 -and $preflight.sourcePackageSha256 -ceq 'd24350686ba9a240aafe16f7bca2734dc9a0fa404b64a23ea2998aa304c8e164' -and $preflight.coreSha256 -ceq $ExpectedCoreSha256 -and $preflight.runnerSha256 -ceq $ExpectedSelfSha256) 'RECOVERY_PREFLIGHT_BINDING'
  return $preflight
 }
 return $null
}
function Recovery-Boundary {
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent()
 try{
  if($sid.User.Value -cne 'S-1-5-21-2170750028-1005938530-2568122015-1001' -or -not ([Security.Principal.WindowsPrincipal]::new($sid)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'RECOVERY_WINDOWS_OWNER'}
 }finally{$sid.Dispose()}
 $sql=Get-CimInstance Win32_Process -Filter 'ProcessId=4924' -ErrorAction Stop
 if($null -eq $sql -or $sql.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ') -cne '2026-11-11T06:22:50.8072810Z' -or $sql.ExecutablePath -cne 'C:\Program Files\Microsoft SQL Server\MSSQL16.MELISAERP\MSSQL\Binn\sqlservr.exe'){throw 'RECOVERY_SQL_LIFETIME'}
 $service=@(Get-CimInstance Win32_Service -Filter 'ProcessId=4924' -ErrorAction Stop)
 if($service.Count -ne 1 -or $service[0].Name -cne 'MSSQL$MELISAERP' -or $service[0].State -cne 'Running'){throw 'RECOVERY_SQL_SERVICE'}
 if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object {$_.LocalPort -in @(4294,5294)}).Count -ne 0){throw 'RECOVERY_APPLICATION_LISTENER'}
 $apps=@(Get-CimInstance Win32_Process -ErrorAction Stop|Where-Object {$_.CommandLine -and $_.CommandLine.Replace('\','/').Contains($script:RecoveryR) -and $_.Name -in @('node.exe','pwsh.exe','powershell.exe')})
 if($apps.Count -ne 0){throw 'RECOVERY_APPLICATION_PROCESS'}
}
function Recovery-NewConnection {
 # Explicit CLR setters avoid PowerShell's dictionary adapter keyword trap.
 $b=[Data.SqlClient.SqlConnectionStringBuilder]::new()
 $b.set_DataSource('lpc:Semih\MELISAERP');$b.set_InitialCatalog('MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210')
 $b.set_IntegratedSecurity($true);$b.set_Encrypt($false);$b.set_Pooling($false);$b.set_ConnectTimeout(10);$b.set_ApplicationName('MelisaDB9K12Recovery')
 return [Data.SqlClient.SqlConnection]::new($b.get_ConnectionString())
}
function Recovery-Execute($Connection,[string]$Sql,[ValidateSet('Json','Rows','None')][string]$Result='None',[int]$Timeout=30){
 $c=$Connection.CreateCommand();$c.CommandText=$Sql;$c.CommandTimeout=$Timeout;$r=$null
 try{
  $r=$c.ExecuteReader();$rows=[Collections.Generic.List[object]]::new();$sb=[Text.StringBuilder]::new();$size=0
  do{
   while($r.Read()){
    if($Result -ceq 'None'){throw 'RECOVERY_UNEXPECTED_RESULT'}
    if($Result -ceq 'Json'){
     if($r.FieldCount -ne 1 -or $r.IsDBNull(0)){throw 'RECOVERY_JSON_SHAPE'}
     $text=$r.GetString(0);$size+=[Text.Encoding]::UTF8.GetByteCount($text);if($size -gt 1048576){throw 'RECOVERY_READ_BOUND'};[void]$sb.Append($text)
    }else{
     if($rows.Count -ge 8 -or $r.FieldCount -gt 80){throw 'RECOVERY_READ_BOUND'}
     $row=[ordered]@{};for($i=0;$i -lt $r.FieldCount;$i++){$v=if($r.IsDBNull($i)){$null}else{$r.GetValue($i)};if($v -is [byte[]]){if($v.Length -gt 1024){throw 'RECOVERY_READ_BOUND'}}elseif($v -is [string] -and $v.Length -gt 4000){throw 'RECOVERY_READ_BOUND'};$row[$r.GetName($i)]=$v};$rows.Add($row)
    }
   }
  }while($r.NextResult())
  if($Result -ceq 'Json'){if($sb.Length -eq 0){throw 'RECOVERY_EMPTY_JSON'};$parsed=$sb.ToString()|ConvertFrom-Json -AsHashtable -DateKind String -NoEnumerate;return ,$parsed}
  if($Result -ceq 'Rows'){return ,$rows.ToArray()}
 }finally{if($r){$r.Dispose()};$c.Dispose()}
}
function Recovery-DestinationsAbsent {
 foreach($name in @('backupPath','dataPath','logPath')){$path=(Recovery-Names)[$name];Recovery-NoReparse ([IO.Path]::GetDirectoryName($path));if(Test-Path -LiteralPath $path){throw 'RECOVERY_DESTINATION_FILE_EXISTS'}}
}
function Recovery-Snapshot($Connection,[string]$Database,[bool]$Copy){
 $tables=Recovery-Execute $Connection (Recovery-FingerprintSql $Database) Json
 Recovery-ValidateFingerprint $tables
 $metadata=Recovery-Execute $Connection (Recovery-MetadataSql $Database $Copy) Json
 return @{tables=$tables;metadata=$metadata}
}
function Recovery-FileHash([string]$Path){
 Recovery-NoReparse $Path
 $s=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{Recovery-Assert ($s.Length -gt 0) 'RECOVERY_BACKUP_EMPTY';return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant()}finally{$s.Dispose()}
}
function Recovery-HoldBackup {
 $path=(Recovery-Names).backupPath;Recovery-NoReparse $path
 $s=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $script:RecoveryHolds.Add($s)
 Recovery-Assert ($s.Length -gt 0) 'RECOVERY_BACKUP_EMPTY'
 # Keep this handle through RESTORE/comparison, preventing changed media bytes.
 return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant()
}
function Recovery-Run {
 $connection=$null;$locks=[Collections.Generic.List[IO.FileStream]]::new();$phase='INITIAL';$claimed=$false;$backupSubmitted=$false;$restoreSubmitted=$false;$closeCompleted=$false
 $script:recoveryBackupSubmitted=$false;$script:recoveryRestoreSubmitted=$false
 $decisionPath=$script:RecoveryA+'/db9-firstsale-recovery-decision-'+$Mode.ToLowerInvariant()+'-20261111.json'
 $prefix=$script:RecoveryA+'/db9-firstsale-recovery-ca3526ae-'+$Mode.ToLowerInvariant()
 try{
  if($Mode -cnotin @('Preflight','BackupRestore')){throw 'RECOVERY_EXPLICIT_MODE_REQUIRED'}
  [void](Recovery-Hold $PSCommandPath $ExpectedSelfSha256)
  [void](Recovery-Hold (Join-Path $PSScriptRoot 'db9-firstsale-recovery-core.ps1') $ExpectedCoreSha256)
  . (Join-Path $PSScriptRoot 'db9-firstsale-recovery-core.ps1')
  $decision=[Text.UTF8Encoding]::new($false,$true).GetString((Recovery-Hold $decisionPath $ExpectedDecisionSha256))|ConvertFrom-Json -AsHashtable -DateKind String
  $preflight=Recovery-Decision $decision
  Recovery-Boundary
  foreach($name in @('desktop-empty-schema.owner.lock','desktop-initial-reader.owner.lock')){$path='C:/Users/Xaser/Desktop/ERP/'+$name;Recovery-NoReparse $path;$locks.Add([IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None))}
  $packageBytes=Recovery-Hold 'C:/Users/Xaser/Desktop/ERP/kurulum/empty-profile-db9-v1/runtime-package.json' 'd24350686ba9a240aafe16f7bca2734dc9a0fa404b64a23ea2998aa304c8e164' 4194304
  $package=[Text.UTF8Encoding]::new($false,$true).GetString($packageBytes)|ConvertFrom-Json -AsHashtable -DateKind String
  Recovery-Assert ($package.sourceHead -ceq '70e8ec1584369eeb1aae9a76a5285509cd127d7b' -and $package.targetProfile -ceq 'empty-db9-v7-v1' -and $package.sourceRoot -ceq $script:RecoveryR) 'RECOVERY_PACKAGE_TARGET'
  foreach($kind in @('sources','helpers','assets')){
   Recovery-Assert ($package[$kind] -is [Collections.IDictionary] -and $package[$kind].Count -gt 0) 'RECOVERY_PACKAGE_CLOSURE'
   foreach($rel in $package[$kind].Keys){
    Recovery-Assert ($rel -cmatch '^[A-Za-z0-9_./-]+$' -and @($rel.Split('/')|Where-Object {$_ -in @('','..','.')}).Count -eq 0) 'RECOVERY_RUNTIME_KEY'
    $base=if($kind -ceq 'assets'){$script:RecoveryR+'/apps/sites-workflow/dist-desktop-write-green/'}else{$script:RecoveryR+'/'}
    [void](Recovery-Hold ($base+$rel) $package[$kind][$rel] 16777216)
   }
  }
  [void](Recovery-Hold 'C:/Users/Xaser/Desktop/ERP/kurulum/empty-profile-db9-v1/runtime-admissions/D24350686BA9A240AAFE16F7BCA2734DC9A0FA404B64A23EA2998AA304C8E164.json' '95c36fc8517b106788e9124ab087ac3fa6d1c276483dc31f972a748b1f753743')
  $assembly='C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/System.Data.SqlClient.dll'
  [void](Recovery-Hold $assembly '526439c8b3326c1f811e827106012cdd868a436ee1154b169609aad129891cb7' 4194304)
  if([Data.SqlClient.SqlConnection].Assembly.Location.Replace('\','/') -cne $assembly){throw 'RECOVERY_SQL_ASSEMBLY'}
  Recovery-DestinationsAbsent;Recovery-Boundary
  Recovery-WriteNew ($prefix+'-claim.json') @{state='CLAIMED_NO_RETRY';mode=$Mode;operationId=(Recovery-Names).operationId;decisionSha256=$ExpectedDecisionSha256;time=[DateTime]::UtcNow.ToString('o')};$claimed=$true
  $connection=Recovery-NewConnection;$phase='CONNECT';$connection.Open()
  $phase='PREFLIGHT';$layout=Recovery-Execute $connection (Recovery-LayoutSql) Json
  foreach($key in @('backupDirectory','dataDirectory','logDirectory')){Recovery-NoReparse $layout[$key]}
  $required=Recovery-ValidateLayout $layout ([long](Get-PSDrive -Name C -ErrorAction Stop).Free)
  foreach($file in $layout.files){Recovery-NoReparse $file.physicalName}
  $before=Recovery-Snapshot $connection (Recovery-Target).database $false
  if($Mode -ceq 'Preflight'){
   Recovery-WriteNew ($prefix+'-result.json') @{state='RECOVERY_PREFLIGHT_PASSED_ZERO_SQL_WRITES';operationId=(Recovery-Names).operationId;target=(Recovery-Target);names=(Recovery-Names);layout=$layout;capacityRequiredBytes=[string]$required;snapshot=$before;runnerSha256=$ExpectedSelfSha256;coreSha256=$ExpectedCoreSha256;sourcePackageSha256='d24350686ba9a240aafe16f7bca2734dc9a0fa404b64a23ea2998aa304c8e164';roleAppliedReceiptSha256=$decision.roleAppliedReceipt.sha256;finalNativeSnapshotSha256=$decision.finalNativeSnapshot.sha256;sqlWrites=0;observedAtUtc=[DateTime]::UtcNow.ToString('o')}
   return
  }
  Recovery-EqualSnapshot $preflight.snapshot $before
  Recovery-Assert (($preflight.layout|ConvertTo-Json -Depth 8 -Compress) -ceq ($layout|ConvertTo-Json -Depth 8 -Compress)) 'RECOVERY_LAYOUT_CHANGED'
  $intent={param($name)Recovery-Boundary;Recovery-WriteNew ($prefix+'-'+$name.ToLowerInvariant()+'-intent.json') @{state='DISPATCH_INTENT_NO_RETRY';phase=$name;operationId=(Recovery-Names).operationId;decisionSha256=$ExpectedDecisionSha256;time=[DateTime]::UtcNow.ToString('o')}}
  $result={param($name,$value)Recovery-WriteNew ($prefix+'-'+$name.ToLowerInvariant()+'-result.json') @{state='COMMAND_RETURNED';phase=$name;time=[DateTime]::UtcNow.ToString('o')}}
  $phase='BACKUP';Recovery-DestinationsAbsent
  Recovery-Phase 'BACKUP' $intent {$script:recoveryBackupSubmitted=$true;Recovery-Execute $connection (Recovery-BackupSql) None 180} $result
  $backupSubmitted=$true;$phase='BACKUP_VERIFY'
  $header=Recovery-Execute $connection (Recovery-BackupVerifySql HEADERONLY) Rows
  $media=Recovery-Execute $connection (Recovery-BackupVerifySql LABELONLY) Rows
  $files=Recovery-Execute $connection (Recovery-BackupVerifySql FILELISTONLY) Rows
  Recovery-ValidateBackup $header $media $files $layout
  Recovery-Execute $connection (Recovery-BackupVerifySql VERIFYONLY) None 180
  $backupSha=Recovery-HoldBackup
  Recovery-WriteNew ($prefix+'-verified-backup.json') @{state='BACKUP_METADATA_CHECKSUM_AND_SHA_VERIFIED';backupSha256=$backupSha;header=@($header|ForEach-Object {@{position=$_.Position;databaseName=$_.DatabaseName;backupSetGuid=[string]$_.BackupSetGUID;firstLsn=[string]$_.FirstLSN;lastLsn=[string]$_.LastLSN;checkpointLsn=[string]$_.CheckpointLSN;backupSize=[string]$_.BackupSize;startTime=$_.BackupStartDate.ToString('o');finishTime=$_.BackupFinishDate.ToString('o')}});media=@($media|ForEach-Object {@{name=$_.MediaName;mediaSetGuid=[string]$_.MediaSetId;familyCount=$_.FamilyCount;familySequenceNumber=$_.FamilySequenceNumber}});files=@($files|ForEach-Object {@{logicalName=$_.LogicalName;physicalName=$_.PhysicalName;type=$_.Type;sizeBytes=[string]$_.Size;fileId=[string]$_.FileID}})}
  $phase='RESTORE';Recovery-Boundary
  foreach($path in @((Recovery-Names).dataPath,(Recovery-Names).logPath)){if(Test-Path -LiteralPath $path){throw 'RECOVERY_DESTINATION_FILE_EXISTS'}}
  Recovery-Assert ((Recovery-FileHash (Recovery-Names).backupPath) -ceq $backupSha) 'RECOVERY_BACKUP_CHANGED'
  Recovery-EqualSnapshot $before (Recovery-Snapshot $connection (Recovery-Target).database $false)
  Recovery-Phase 'RESTORE' $intent {$script:recoveryRestoreSubmitted=$true;Recovery-Execute $connection (Recovery-RestoreSql $layout) None 180} $result
  $restoreSubmitted=$true;$phase='ISOLATE'
  Recovery-Phase 'ISOLATE' $intent {Recovery-Execute $connection (Recovery-IsolateSql) None} $result
  $phase='CHECKDB';$copyCheck=Recovery-Phase 'CHECKDB' $intent {Recovery-Execute $connection (Recovery-CopyCheckSql) Json 180} $result
  Recovery-Assert ($copyCheck.state -ceq 'RECOVERY_COPY_CHECKED' -and $copyCheck.databaseId -cne '9') 'RECOVERY_COPY_CHECK_RESULT'
  $phase='COMPARE';$copy=Recovery-Snapshot $connection (Recovery-Names).restoreDatabase $true;$after=Recovery-Snapshot $connection (Recovery-Target).database $false
  Recovery-EqualSnapshot $before $copy;Recovery-EqualSnapshot $before $after
  Recovery-Assert ((Recovery-FileHash (Recovery-Names).backupPath) -ceq $backupSha) 'RECOVERY_BACKUP_CHANGED'
  Recovery-Boundary
  Recovery-WriteNew ($prefix+'-result.json') @{state='RECOVERY_ACTUAL_COPY_CHECKDB_AND_ALL43_EQUAL';operationId=(Recovery-Names).operationId;target=(Recovery-Target);names=(Recovery-Names);sourceBefore=$before;restoredCopy=$copy;sourceAfter=$after;copyIdentity=$copyCheck;backupSha256=$backupSha;sourceChanged=$false;copyPublicConnectDenyOnlyDifference=$true;writerCanAccessCopy=$false;applicationBootedOnCopy=$false;offMachineCopy=$false;roleAppliedReceiptSha256=$decision.roleAppliedReceipt.sha256;finalNativeSnapshotSha256=$decision.finalNativeSnapshot.sha256;observedAtUtc=[DateTime]::UtcNow.ToString('o')}
 }catch{
  $code=if($_.Exception.Message -cmatch '^RECOVERY_[A-Z0-9_]+$'){$_.Exception.Message}else{'RECOVERY_UNCLASSIFIED'}
  $number=if($_.Exception.PSObject.Properties['Number']){[int]$_.Exception.Number}else{$null}
  if($claimed){try{Recovery-WriteNew ($prefix+'-failure.json') @{state='UNKNOWN_NO_RETRY_RETAIN_ALL';phase=$phase;code=$code;number=$number;backupSubmitted=($backupSubmitted -or $script:recoveryBackupSubmitted -eq $true);restoreSubmitted=($restoreSubmitted -or $script:recoveryRestoreSubmitted -eq $true);sqlRollbackClaimed=$false;automaticCleanup=$false;automaticRestart=$false}}catch{}}
  [Console]::Error.WriteLine("RECOVERY_STOPPED phase=$phase code=$code number=$number");throw 'RECOVERY_STOPPED'
 }finally{
  if($connection){try{$connection.Close();$connection.Dispose();$closeCompleted=$true}catch{[Console]::Error.WriteLine('RECOVERY_CLOSE_NOT_VERIFIED')}}else{$closeCompleted=$true}
  $releaseCompleted=$true
  foreach($s in $script:RecoveryHolds){try{$s.Dispose()}catch{$releaseCompleted=$false}}
  foreach($s in $locks){try{$s.Dispose()}catch{$releaseCompleted=$false}}
  if($claimed){Recovery-WriteNew ($prefix+'-closed.json') @{connectionCloseCompleted=$closeCompleted;sqlRollbackClaimed=$false;locksReleaseCompleted=$releaseCompleted;lockReleaseOrderedAfterCloseAttempt=$true;time=[DateTime]::UtcNow.ToString('o')}}
  if(-not $closeCompleted -or -not $releaseCompleted){throw 'RECOVERY_CLOSE_NOT_VERIFIED'}
 }
}
if($MyInvocation.InvocationName -ne '.'){Recovery-Run}
