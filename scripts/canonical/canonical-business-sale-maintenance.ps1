# Finite B6 extension to the existing TEST125 maintenance owner. No CLI,
# import-time SQL, callbacks, credentials, arbitrary SQL or target parameters.
Set-StrictMode -Version Latest
if(!(Get-Variable ErpBusinessSaleAdmissions -Scope Script -ErrorAction SilentlyContinue)){$script:ErpBusinessSaleAdmissions=[Collections.ArrayList]::new()}
function Get-ErpBusinessSaleHash([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Read-ErpBusinessSalePinnedFile([string]$Path,[string]$Hash){
 for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_NATIVE_INPUT_REPARSE'}}
 $bytes=[IO.File]::ReadAllBytes($Path);if((Get-ErpBusinessSaleHash $bytes)-cne$Hash){throw 'B6_NATIVE_INPUT_CHANGED'};return ,$bytes
}
function Get-ErpBusinessSaleNativeInputs {
 $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-permission-snapshot-source-20261029'
 $artifactBytes=Read-ErpBusinessSalePinnedFile (Join-Path $root 'b6-native-complete-source-artifact-20261028.json') '35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe'
 $descriptorBytes=Read-ErpBusinessSalePinnedFile (Join-Path $root 'b6-native-complete-source-app-descriptor-20261028.json') '050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024'
 $a=[Text.Encoding]::UTF8.GetString($artifactBytes)|ConvertFrom-Json;$d=[Text.Encoding]::UTF8.GetString($descriptorBytes)|ConvertFrom-Json
 if($a.revisionHash-cne'DEBAFECB1915AEC135E58107F64EE4243D7B93E3C091799EB8E4F29500C477DE'-or$a.profileHash-cne'9CBDA03D44559F2CC1487B526F4E67E7301467ECBF576126AF9BEBDA18A237F9'-or$a.installable-ne$false-or$a.executeAllowed-ne$false-or$a.nativeCompiled-ne$false-or@($a.changedModules).Count-ne25-or@($a.newModules).Count-ne31-or@($d.readerDefinitions.PSObject.Properties).Count-ne14-or($a.appDescriptor|ConvertTo-Json -Depth 32 -Compress)-cne($d|ConvertTo-Json -Depth 32 -Compress)){throw 'B6_NATIVE_SOURCE_SCOPE'}
 foreach($batch in @($a.applyBatches)+@($a.inverseBatches)){if(!$batch.sql-or(Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($batch.sql))).ToUpperInvariant()-cne$batch.sourceHash){throw 'B6_NATIVE_BATCH_HASH'}}
 return [pscustomobject]@{artifact=$a;descriptor=$d;artifactHash=(Get-ErpBusinessSaleHash $artifactBytes)}
}
function Assert-ErpBusinessSaleProfileDelta($Base,$Api,$Manifest){
 if($Manifest.packageId-cne'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'-or$Manifest.sourceCommit-cne'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'-or$Manifest.businessSaleSourceCommit-cne'ca620bac30f96034b33d4410dc43576a38a38707'-or$Manifest.businessSaleCandidate.recordingEnabled-ne$false-or$Api.businessSaleWritesEnabled-isnot[bool]-or$Api.businessSaleWritesEnabled){throw 'B6_PROFILE_TARGET_REJECTED'}
 $inputs=Get-ErpBusinessSaleNativeInputs
 if(($Api.businessSaleAdmission|ConvertTo-Json -Depth 32 -Compress)-cne($inputs.descriptor|ConvertTo-Json -Depth 32 -Compress)){throw 'B6_PROFILE_DESCRIPTOR_REJECTED'}
 $copy=$Api.PSObject.Copy();$copy.PSObject.Properties.Remove('businessSaleAdmission');$copy.PSObject.Properties.Remove('businessSaleWritesEnabled')
 return $copy
}
function Read-ErpBusinessSaleOwnerSource {
 $root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH';$manifestPath=Join-Path $root 'owner-manifest.json'
 if(![IO.File]::Exists($manifestPath)){throw 'B6_OWNER_SOURCE_BUNDLE_NOT_PREPARED'}
 for($p=$manifestPath;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_OWNER_SOURCE_REPARSE'}}
 $bytes=[IO.File]::ReadAllBytes($manifestPath);$manifest=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json
 $leaves=@('business-5244-startup-exclusion.ps1','start-business-5244-web.ps1','business-5244-web-native.cs','business-5244-retirement-channel.ps1','business-5244-retirement-peer.cs','business-5244-retirement-state.ps1','business-5244-maintenance-dispatch.ps1','start-business-5244-owned.ps1','test125-bound-api-quiescence.ps1','test125-bound-maintenance-plan.ps1','start-owned-test.ps1','canonical-business-sale-maintenance.ps1','run-current-owner.ps1')
 if($manifest.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$manifest.finiteScope-cne'TEST125-API-B6-ca620bac-20261028'-or$manifest.sourceCommit-cnotmatch'^[a-f0-9]{40}$'-or$manifest.actualT1-ne$false-or$manifest.externalOperations-ne$false-or$manifest.apiPackageId-cne'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'-or$manifest.appPackageId-cne'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'-or(@($manifest.files.path|Sort-Object -CaseSensitive)-join'|')-cne(@($leaves|Sort-Object -CaseSensitive)-join'|')){throw 'B6_OWNER_SOURCE_SCOPE'}
 foreach($f in $manifest.files){[void](Read-ErpBusinessSalePinnedFile (Join-Path $root $f.path) $f.sha256)}
 if(!$manifest.PSObject.Properties['rehearsalOnly']-or$manifest.rehearsalOnly-isnot[bool]-or!$manifest.rehearsalOnly){throw 'B6_OWNER_REHEARSAL_ONLY_REQUIRED'}
 return [pscustomobject]@{root=$root;manifestPath=$manifestPath;manifestSha256=(Get-ErpBusinessSaleHash $bytes);files=$manifest.files;sourceCommit=$manifest.sourceCommit;rehearsalOnly=$true;launcher=(Join-Path $root 'start-owned-test.ps1');launcherSha256=(@($manifest.files|Where-Object path -ceq 'start-owned-test.ps1')[0].sha256)}
}
function Get-ErpBusinessSaleOwnerSource($Admission){
 $r=Get-ErpBusinessSaleNativeAdmissionContext $Admission;$fresh=Read-ErpBusinessSaleOwnerSource
 if($fresh.manifestSha256-cne$r.ownerInputs.manifestSha256){throw 'B6_OWNER_SOURCE_CHANGED'}
 return $fresh
}
function Get-ErpBusinessSaleTaskLauncherPins($PreparedReleaseProof){
 $proof=Get-ErpReadPairReleaseProofContext $PreparedReleaseProof
 if(!$proof.PSObject.Properties['businessSaleOwnerPins']-or!$proof.businessSaleOwnerPins){throw 'B6_TASK_FROZEN_LAUNCHER_PROOF_REQUIRED'}
 $proof.seal.Validate();$pins=$proof.businessSaleOwnerPins
 if($pins.path-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH\start-owned-test.ps1'-or(Get-FileHash -LiteralPath $pins.path).Hash.ToLowerInvariant()-cne$pins.sha256){throw 'B6_TASK_FROZEN_LAUNCHER_CHANGED'}
 return ($pins|ConvertTo-Json -Compress|ConvertFrom-Json)
}
function Get-ErpBusinessSaleNativeAdmissionContext($Admission){
 $record=$null;foreach($r in $script:ErpBusinessSaleAdmissions){if([object]::ReferenceEquals($r.token,$Admission)){$record=$r;break}}
 if(!$record-or$record.closed-or$record.pid-ne$PID-or$record.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$record.owner-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or($Admission|ConvertTo-Json -Compress)-cne$record.tokenJson){throw 'B6_NATIVE_ADMISSION_NOT_ISSUED'}
 if($record.rehearsalOnly-isnot[bool]-or$Admission.rehearsalOnly-isnot[bool]-or$record.rehearsalOnly-ne$Admission.rehearsalOnly){throw 'B6_NATIVE_PURPOSE_CHANGED'}
 # Revalidate the immutable bytes without repeatedly parsing the 11 MB SQL
 # snapshot on the time-bounded request path. SQL execution separately loads
 # fresh pinned inputs rather than using a mutable retained object as SQL.
 if($record.inputHash-cne'35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe'){throw 'B6_NATIVE_INPUT_CHANGED'}
 $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-permission-snapshot-source-20261029'
 [void](Read-ErpBusinessSalePinnedFile (Join-Path $root 'b6-native-complete-source-artifact-20261028.json') $record.inputHash)
 [void](Read-ErpBusinessSalePinnedFile (Join-Path $root 'b6-native-complete-source-app-descriptor-20261028.json') '050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024')
 return $record
}
function Assert-ErpBusinessSaleNativeProfileAdmission($Admission,[ValidateSet('Identity','Prepared','Applied','Restored')][string]$Phase='Prepared'){
 $r=Get-ErpBusinessSaleNativeAdmissionContext $Admission
 if($Phase-cne'Identity'-and$r.phase-cne$Phase){throw 'B6_NATIVE_PHASE_REJECTED'}
 if($r.phase-ceq'Unknown'){throw 'B6_NATIVE_OUTCOME_UNKNOWN'}
 return $true
}
function New-ErpBusinessSaleSqlConnectionString {
 Add-Type -AssemblyName System.Data
 $b=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
 # PowerShell's IDictionary adapter treats member assignment as a keyword.
 # Use supported SQL keyword names rather than CLR property aliases.
 $b['Data Source']='Semih\MELISADEV';$b['Initial Catalog']='MELISA_ERP_SIRKET_TEST_20260929_01';$b['Integrated Security']=$true;$b['Encrypt']=$true;$b['TrustServerCertificate']=$false;$b['Pooling']=$false;$b['Connect Timeout']=5;$b['Application Name']='Melisa-B6-Finite-Maintenance'
 return $b.ConnectionString
}
function Open-ErpBusinessSaleSqlConnection {
 $connection=New-Object System.Data.SqlClient.SqlConnection((New-ErpBusinessSaleSqlConnectionString))
 try{
  $connection.Open();$command=$connection.CreateCommand()
  try{$command.CommandTimeout=10;$command.CommandText="IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\MELISADEV' OR IS_SRVROLEMEMBER(N'sysadmin')<>1 OR @@TRANCOUNT<>0 THROW 51917,'B6_NATIVE_TARGET_REJECTED',1;";[void]$command.ExecuteNonQuery()}finally{$command.Dispose()}
  return $connection
 }catch{$connection.Dispose();throw 'B6_NATIVE_CONNECTION_UNAVAILABLE'}
}
function Get-ErpBusinessSaleSqlFailure($Failure,$Batch,[string]$BatchPhase,[int]$BatchIndex){
 # Diagnostic data only. Never retain Message, SQL text, values or connection
 # details. PowerShell may wrap the provider exception more than once.
 $e=if($Failure-is[Management.Automation.ErrorRecord]){$Failure.Exception}else{$Failure}
 for($depth=0;$e-and$depth-lt8;$depth++){
  if($e-is[Data.SqlClient.SqlException]){
   $errors=@();foreach($item in $e.Errors){
    if($errors.Count-ge8){break}
    $procedure=[string]$item.Procedure;$procedureHash=$null
    if($procedure-and$procedure-cnotmatch'^(?:dbo\.)?usp_b6_[A-Za-z0-9_]{1,110}$'){$procedureHash=Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($procedure));$procedure=$null}
    $errors+=@([ordered]@{number=[int]$item.Number;procedure=$procedure;procedureHash=$procedureHash;lineNumber=[int]$item.LineNumber})
   }
   $id=$null;$hash=$null
   if($Batch-and$Batch.PSObject.Properties['id']-and[string]$Batch.id-cmatch'^[A-Za-z0-9_.-]{1,160}$'){$id=[string]$Batch.id}
   if($Batch-and$Batch.PSObject.Properties['sourceHash']-and[string]$Batch.sourceHash-cmatch'^[A-Fa-f0-9]{64}$'){$hash=[string]$Batch.sourceHash}
   if($BatchPhase-cnotin@('Lock','Apply','Inverse')){$BatchPhase='Other'}
   return [ordered]@{schema='B6_SQL_FAILURE_V1';batchPhase=$BatchPhase;batchIndex=$BatchIndex;batchId=$id;batchSourceHash=$hash;commandPrefixLines=1;errors=$errors}
  }
  $e=$e.InnerException
 }
 return $null
}
function Invoke-ErpBusinessSaleSqlBatch($Connection,$Transaction,[string]$Sql){
 # Each command has its own T-SQL variable scope. The frozen combined-script
 # wrapper declares this compiler scratch variable once; per-batch execution
 # must provide the same fixed declaration, never a caller-controlled wrapper.
 $command=$Connection.CreateCommand();try{$command.CommandTimeout=60;$command.Transaction=$Transaction;$command.CommandText="SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);`n"+$Sql;[void]$command.ExecuteNonQuery()}finally{$command.Dispose()}
}
function Test-ErpBusinessSaleBefore($Inputs){
 $connection=Open-ErpBusinessSaleSqlConnection;$tx=$null
 try{$tx=$connection.BeginTransaction([Data.IsolationLevel]::Serializable);Invoke-ErpBusinessSaleSqlBatch $connection $tx $Inputs.artifact.applyBatches[0].sql;$tx.Rollback();$tx=$null}
 finally{if($tx){try{$tx.Rollback()}catch{};$tx.Dispose()};$connection.Dispose()}
}
function Test-ErpBusinessSaleAfter($Inputs){
 $connection=Open-ErpBusinessSaleSqlConnection;$tx=$null
 try{$tx=$connection.BeginTransaction([Data.IsolationLevel]::Serializable);$batches=@($Inputs.artifact.applyBatches);Invoke-ErpBusinessSaleSqlBatch $connection $tx $batches[$batches.Count-1].sql;$tx.Rollback();$tx=$null}
 finally{if($tx){try{$tx.Rollback()}catch{};$tx.Dispose()};$connection.Dispose()}
}
function New-ErpBusinessSaleNativeProfileAdmission($Config,[switch]$RehearsalOnly){
 if($PSVersionTable.PSEdition-cne'Desktop'){throw 'B6_NATIVE_WINDOWS_POWERSHELL_REQUIRED'}
 $actual=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 if(($actual|ConvertTo-Json -Depth 100 -Compress)-cne($Config|ConvertTo-Json -Depth 100 -Compress)-or$actual.ApiComponent.ManifestSha256-cne'8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'){throw 'B6_NATIVE_STARTUP_CHANGED'}
 $ownerInputs=Read-ErpBusinessSaleOwnerSource
 # The verified finite owner bundle can narrow, never widen, a caller's mode.
 # The normal existing supervisor call therefore cannot issue Apply authority
 # when launched from the PERMHASH rehearsal-only bundle.
 if($ownerInputs.PSObject.Properties['rehearsalOnly']){
  if($ownerInputs.rehearsalOnly-isnot[bool]){throw 'B6_OWNER_REHEARSAL_ONLY_REQUIRED'}
  if($ownerInputs.rehearsalOnly){$RehearsalOnly=[switch]$true}
 }
 $inputs=Get-ErpBusinessSaleNativeInputs;Test-ErpBusinessSaleBefore $inputs
 $path='C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'
 for($p=$path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_NATIVE_PROFILE_REPARSE'}}
 $before=[IO.File]::ReadAllBytes($path);$profile=[Text.Encoding]::UTF8.GetString($before)|ConvertFrom-Json
 if($profile.goal8SyntheticDaySeal.packageId-cne'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'-or$profile.PSObject.Properties['businessSaleAdmission']-or$profile.PSObject.Properties['businessSaleWritesEnabled']){throw 'B6_NATIVE_PROFILE_CHANGED'}
 $profile.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'
 $profile|Add-Member -NotePropertyName businessSaleAdmission -NotePropertyValue $inputs.descriptor
 $profile|Add-Member -NotePropertyName businessSaleWritesEnabled -NotePropertyValue $false
 $candidate=[Text.Encoding]::UTF8.GetBytes(($profile|ConvertTo-Json -Depth 100))
 $token=[pscustomobject][ordered]@{schema='melisa-b6-finite-native-profile.v1';id=[guid]::NewGuid().ToString('N');rehearsalOnly=[bool]$RehearsalOnly}
 $record=[pscustomobject]@{token=$token;tokenJson=($token|ConvertTo-Json -Compress);owner=$actual.OwnerSid;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;inputHash=$inputs.artifactHash;inputs=$inputs;ownerInputs=$ownerInputs;phase='Prepared';profilePath=$path;profileBeforeHash=(Get-ErpBusinessSaleHash $before);candidateBytes=$candidate;transition=$null;rehearsalOnly=[bool]$RehearsalOnly;rehearsalAttempted=$false;rehearsalFailed=$false;rehearsed=$false;backup=$null;backupSignature=$null;closed=$false;journalHash=$null;events=[Collections.ArrayList]::new()}
 [void]$script:ErpBusinessSaleAdmissions.Add($record);return $token
}
function Get-ErpBusinessSaleCandidateProfileBytes($Admission){$r=Get-ErpBusinessSaleNativeAdmissionContext $Admission;if($r.phase-cnotin@('Prepared','Applied')){throw 'B6_NATIVE_PHASE_REJECTED'};return ,([byte[]]$r.candidateBytes.Clone())}
function Bind-ErpBusinessSaleNativeProfileTransition($Admission,$Transition){
 $r=Get-ErpBusinessSaleNativeAdmissionContext $Admission;$context=Assert-Test125ReadPairIssued $Transition
 if($r.transition-or$Transition.scope-cne'TEST125-API-B6-ca620bac-20261028'-or![object]::ReferenceEquals($context.nativeProfileAdmission,$Admission)-or$context.apiPath-cne$r.profilePath-or$Transition.apiProfileBeforeSha256-cne$r.profileBeforeHash-or$Transition.apiProfileCandidateSha256-cne(Get-ErpBusinessSaleHash $r.candidateBytes)){throw 'B6_NATIVE_TRANSITION_NOT_ISSUED'}
 $r.transition=$Transition
}
function Assert-ErpBusinessSaleNativeQuiescence($Record){
 if(!$Record.transition){throw 'B6_NATIVE_TRANSITION_REQUIRED'}
 $c=Assert-Test125ReadPairIssued $Record.transition;$b=$c.activeBinding
 if(!$b-or![object]::ReferenceEquals($b,$script:Test125ApiBinding)-or!$b.held-or!$b.stopped-or!$c.taskStopped-or!$c.vault){throw 'B6_NATIVE_QUIESCENCE_REQUIRED'}
 Assert-Test125ApiStoppedSupervisor $b;[void](Test-Test125ApiPhysicalPause $b);Assert-Test125ReadPairCompanions $c
 return $c
}
function New-ErpBusinessSaleVerifiedBackup($Connection){
 # A unique COPY_ONLY backup; never overwrite/delete/restore an existing file.
 $size=$Connection.CreateCommand();try{$size.CommandText="SELECT CONVERT(bigint,SUM(CONVERT(bigint,size))*8192) FROM sys.database_files";$bytes=[long]$size.ExecuteScalar()}finally{$size.Dispose()}
 if($bytes-le0-or([IO.DriveInfo]::new('C:\')).AvailableFreeSpace-lt($bytes*2+536870912)){throw 'B6_NATIVE_BACKUP_SPACE_REQUIRED'}
 $root='C:\Sirket\ERP\backups\B6'
 for($p=$root;$p;$p=[IO.Path]::GetDirectoryName($p)){if([IO.Directory]::Exists($p)-and(Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_NATIVE_BACKUP_REPARSE'}}
 [void][IO.Directory]::CreateDirectory($root)
 for($p=$root;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_NATIVE_BACKUP_REPARSE'}}
 $path=Join-Path $root ('B6-before-'+[guid]::NewGuid().ToString('N')+'.bak');if([IO.File]::Exists($path)){throw 'B6_NATIVE_BACKUP_EXISTS'}
 $command=$Connection.CreateCommand();try{$command.CommandTimeout=300;$command.CommandText="BACKUP DATABASE [MELISA_ERP_SIRKET_TEST_20260929_01] TO DISK=@path WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;";[void]$command.Parameters.Add('@path',[Data.SqlDbType]::NVarChar,260);$command.Parameters['@path'].Value=$path;[void]$command.ExecuteNonQuery()}finally{$command.Dispose()}
 if(![IO.File]::Exists($path)-or([IO.FileInfo]::new($path)).Length-le0){throw 'B6_NATIVE_BACKUP_NOT_VERIFIED'}
 return [pscustomobject]@{path=$path;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();verifiedAt=[datetime]::UtcNow.ToString('o');restored=$false}
}
function Open-ErpBusinessSaleVerifiedBackupStream([string]$Path,[string]$Sha256){
 for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_NATIVE_BACKUP_REPARSE'}}
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{
  if($stream.Length-le0){throw 'B6_NATIVE_BACKUP_NOT_VERIFIED'}
  $hash=[Security.Cryptography.SHA256]::Create();try{$actual=[BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
  if($actual-cne$Sha256){throw 'B6_NATIVE_BACKUP_FILE_CHANGED'};$stream.Position=0;return $stream
 }catch{$stream.Dispose();throw}
}
function Test-ErpBusinessSaleVerifiedBackup($Record,$Connection){
 $backup=$Record.backup
 if(!$backup-or!$Record.backupSignature-or($backup|ConvertTo-Json -Compress)-cne$Record.backupSignature-or$backup.restored-ne$false-or[IO.Path]::GetDirectoryName($backup.path)-cne'C:\Sirket\ERP\backups\B6'-or[IO.Path]::GetFileName($backup.path)-cnotmatch'^B6-before-[a-f0-9]{32}\.bak$'){throw 'B6_NATIVE_BACKUP_PROOF_REQUIRED'}
 $age=[datetime]::UtcNow-([datetime]$backup.verifiedAt).ToUniversalTime();if($age.TotalSeconds-lt0-or$age.TotalMinutes-gt10){throw 'B6_NATIVE_BACKUP_STALE'}
 # Backups may be multi-gigabyte: hash a retained read-only stream instead of
 # allocating the whole database backup in the PowerShell process.
 $stream=Open-ErpBusinessSaleVerifiedBackupStream $backup.path $backup.sha256
 try{$command=$Connection.CreateCommand();try{$command.CommandTimeout=300;$command.CommandText='RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;';[void]$command.Parameters.Add('@path',[Data.SqlDbType]::NVarChar,260);$command.Parameters['@path'].Value=$backup.path;[void]$command.ExecuteNonQuery()}finally{$command.Dispose()}}finally{$stream.Dispose()}
}
function Write-ErpBusinessSaleNativeEvent($Record,[string]$Event,$SqlFailure=$null){
 if($Record.phase-ceq'Unknown'){
  # Audit-only path: authentic retained objects and physical pause are still
  # required, but Unknown may be recorded without issuing execution authority.
  $owned=Get-ErpBusinessSaleNativeAdmissionContext $Record.token
  if(![object]::ReferenceEquals($Record,$owned)-or$Event-cnotin@('APPLY_FAILED_NO_REPLAY','INVERSE_FAILED_NO_REPLAY','REHEARSE_FAILED_NO_REPLAY')){throw 'B6_NATIVE_AUDIT_SCOPE_REJECTED'}
  $c=Get-Test125ReadPairNativeAuditContext $Record.transition $Record.token;$b=$c.activeBinding
  if(!$b-or![object]::ReferenceEquals($b,$script:Test125ApiBinding)-or!$b.held-or!$b.stopped-or!$c.taskStopped-or!$c.vault){throw 'B6_NATIVE_AUDIT_PAUSE_REQUIRED'}
  Assert-Test125ApiStoppedSupervisor $b;[void](Test-Test125ApiPhysicalPause $b);Assert-Test125ReadPairCompanions $c
 }else{$c=Assert-ErpBusinessSaleNativeQuiescence $Record}
 $file=Join-Path $c.vault 'native-b6-journal.jsonl'
 for($p=$file;$p;$p=[IO.Path]::GetDirectoryName($p)){if([IO.File]::Exists($p)-or[IO.Directory]::Exists($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_NATIVE_JOURNAL_REPARSE'}}}
 $mode=if($null-eq$Record.journalHash){[IO.FileMode]::CreateNew}else{[IO.FileMode]::Open}
 $stream=[IO.File]::Open($file,$mode,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{
  $old=[IO.MemoryStream]::new();try{$stream.CopyTo($old);$previous=$old.ToArray()}finally{$old.Dispose()}
  if($null-ne$Record.journalHash-and(Get-ErpBusinessSaleHash $previous)-cne$Record.journalHash){throw 'B6_NATIVE_JOURNAL_CAS'}
  $row=[ordered]@{event=$Event;phase=$Record.phase;at=[datetime]::UtcNow.ToString('o');sourceHash=$Record.inputHash;profileBefore=$Record.profileBeforeHash;backup=$Record.backup;commercialWrites=0}
  if($SqlFailure-and$Event-cin@('APPLY_FAILED_NO_REPLAY','INVERSE_FAILED_NO_REPLAY','REHEARSE_FAILED_NO_REPLAY')){$row.sqlFailure=$SqlFailure}
  $bytes=[Text.Encoding]::UTF8.GetBytes((($row|ConvertTo-Json -Depth 8 -Compress)+"`n"));$stream.Position=$stream.Length;$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)
  $stream.Position=0;$all=[IO.MemoryStream]::new();try{$stream.CopyTo($all);$Record.journalHash=Get-ErpBusinessSaleHash $all.ToArray()}finally{$all.Dispose()}
 }finally{$stream.Dispose()}
}
function Invoke-ErpBusinessSaleNativeRevision($Admission,[ValidateSet('Rehearse','Apply','Inverse')][string]$Direction){
 $r=Get-ErpBusinessSaleNativeAdmissionContext $Admission;[void](Assert-ErpBusinessSaleNativeQuiescence $r)
 $nativeInputs=Get-ErpBusinessSaleNativeInputs
 if($nativeInputs.artifactHash-cne$r.inputHash){throw 'B6_NATIVE_INPUT_CHANGED'}
 # ValidateSet is case-insensitive in Windows PowerShell. The finite purpose
 # admits only these exact branches, so a differently cased alias cannot fall
 # through into the shared commit path.
 if($r.rehearsalOnly-and$Direction-cnotin@('Rehearse','Inverse')){throw 'B6_NATIVE_REHEARSAL_ONLY'}
 if($r.rehearsalOnly-and$Direction-ceq'Rehearse'-and$r.rehearsalAttempted){throw 'B6_NATIVE_REHEARSAL_ALREADY_ATTEMPTED'}
 if($Direction-ceq'Apply'-and($r.phase-cne'Prepared'-or!$r.rehearsed)){throw 'B6_NATIVE_REHEARSAL_REQUIRED'}
 if($Direction-ceq'Rehearse'-and$r.phase-cne'Prepared'){throw 'B6_NATIVE_PHASE_REJECTED'}
 if($Direction-ceq'Inverse'-and$r.phase-ceq'Restored'){return}
 if($Direction-ceq'Inverse'-and$r.phase-ceq'Prepared'){
  if($r.rehearsalOnly-and(!$r.rehearsalAttempted-or!$r.rehearsalFailed-or$r.rehearsed)){throw 'B6_NATIVE_REHEARSAL_FAILURE_REQUIRED'}
  Test-ErpBusinessSaleBefore $nativeInputs;$r.phase='Restored';return
 }
 if($Direction-ceq'Inverse'-and$r.phase-cne'Applied'){throw 'B6_NATIVE_PHASE_REJECTED'}
 if($r.rehearsalOnly-and$Direction-ceq'Inverse'){throw 'B6_NATIVE_REHEARSAL_ONLY'}
 # Consume a finite rehearsal before any intent/backup work. Even an early
 # failure permits only fresh before-state verification, never a second run.
 if($r.rehearsalOnly-and$Direction-ceq'Rehearse'){$r.rehearsalAttempted=$true;$r.rehearsalFailed=$true}
 Write-ErpBusinessSaleNativeEvent $r ($Direction.ToUpperInvariant()+'_INTENT')
 $connection=$null;$tx=$null;$commitAttempted=$false;$activeBatch=$null;$batchPhase='Other';$batchIndex=-1
 try{
  $connection=Open-ErpBusinessSaleSqlConnection
  if($Direction-ceq'Rehearse'){
   if($null-ne$r.backup){throw 'B6_NATIVE_BACKUP_ALREADY_CREATED'}
   $r.backup=New-ErpBusinessSaleVerifiedBackup $connection;$r.backupSignature=($r.backup|ConvertTo-Json -Compress)
   Write-ErpBusinessSaleNativeEvent $r 'BACKUP_VERIFIED';[void](Assert-ErpBusinessSaleNativeQuiescence $r)
  }elseif($Direction-ceq'Apply'){
   # The rollback rehearsal and apply share the same continuously paused
   # writer boundary. Revalidate its one fresh backup, never make duplicate
   # full DB copies or use an unverified source/caller-supplied backup.
   Test-ErpBusinessSaleVerifiedBackup $r $connection;Write-ErpBusinessSaleNativeEvent $r 'BACKUP_REVERIFIED'
   [void](Assert-ErpBusinessSaleNativeQuiescence $r)
  }
  $tx=$connection.BeginTransaction([Data.IsolationLevel]::Serializable)
  $batchPhase='Lock'
  # Preserve this shared resource across revisions: old and new owners must
  # serialize on the same lock even though the frozen artifact hash changes.
  Invoke-ErpBusinessSaleSqlBatch $connection $tx "DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'melisa-b6-finite-revision-F05B6318',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51917,'B6_NATIVE_LOCK_REQUIRED',1;"
  $batches=if($Direction-ceq'Inverse'){$nativeInputs.artifact.inverseBatches}else{$nativeInputs.artifact.applyBatches}
  $batchPhase=if($Direction-ceq'Inverse'){'Inverse'}else{'Apply'};$batchIndex=-1
  foreach($batch in $batches){$batchIndex++;$activeBatch=$batch;Invoke-ErpBusinessSaleSqlBatch $connection $tx $batch.sql}
  if($Direction-ceq'Rehearse'){
   $batchPhase='Inverse';$batchIndex=-1;$activeBatch=$null
   foreach($batch in $nativeInputs.artifact.inverseBatches){$batchIndex++;$activeBatch=$batch;Invoke-ErpBusinessSaleSqlBatch $connection $tx $batch.sql}
   $batchPhase='Other';$batchIndex=-1;$activeBatch=$null
   $tx.Rollback();$tx=$null;Test-ErpBusinessSaleBefore $nativeInputs;$r.rehearsed=$true
   if($r.rehearsalOnly){$r.rehearsalFailed=$false;$r.phase='Restored'}
  }else{
   $batchPhase='Other';$batchIndex=-1;$activeBatch=$null
   [void](Assert-ErpBusinessSaleNativeQuiescence $r);$commitAttempted=$true;$tx.Commit();$tx=$null
   if($Direction-ceq'Inverse'){Test-ErpBusinessSaleBefore $nativeInputs;$r.phase='Restored'}else{Test-ErpBusinessSaleAfter $nativeInputs;$r.phase='Applied'}
  }
  [void]$r.events.Add([pscustomobject]@{direction=$Direction;phase=$r.phase;at=[datetime]::UtcNow.ToString('o');commercialWrites=0})
  Write-ErpBusinessSaleNativeEvent $r ($Direction.ToUpperInvariant()+'_VERIFIED')
 }catch{
  $originalFailure=$_;$sqlFailure=$null
  try{$sqlFailure=Get-ErpBusinessSaleSqlFailure $originalFailure $activeBatch $batchPhase $batchIndex}catch{}
  if($tx){try{$tx.Rollback()}catch{$r.phase='Unknown'}}
  if($commitAttempted){$r.phase='Unknown'}
  try{Write-ErpBusinessSaleNativeEvent $r ($Direction.ToUpperInvariant()+'_FAILED_NO_REPLAY') $sqlFailure}catch{}
  throw $originalFailure
 }finally{if($tx){$tx.Dispose()};if($connection){$connection.Dispose()}}
}
