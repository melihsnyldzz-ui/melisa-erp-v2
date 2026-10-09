param(
 [ValidateSet('Rehearse','Install')][string]$Mode='Rehearse',
 [Parameter(Mandatory)][string]$BundlePath,
 [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$BundleSHA256,
 [Parameter(Mandatory)][string]$SharedConfigPath,
 [Parameter(Mandatory)][string]$NativeConfigPath
)
$ErrorActionPreference='Stop'
$taskDatabase='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$taskLogin='melisa_crm_shared_draft_20261009_02'
$taskConnection=$null
$taskPhase='private-paths'
function Assert-PrivatePath([string]$Value,[switch]$AllowSharedRuntimeConfig) {
 if(-not[IO.Path]::IsPathRooted($Value)){throw 'CRM_PRIVATE_PATH_REQUIRED'}
 $resolved=[IO.Path]::GetFullPath($Value)
 $allowed=@('C:\Sirket\ERP\evidence\ERP-CRM-EXPAND-20261009\private\','C:\Sirket\ERP\config\ERP-CRM-SHARED-TEST-20261009-02\')
 $fixedSharedConfig=$AllowSharedRuntimeConfig-and$resolved.Equals('C:\Sirket\ERP\runtime\ERP-CRM-EXPAND-20261009\shared-copy-config.json',[StringComparison]::OrdinalIgnoreCase)
 if(-not$fixedSharedConfig-and-not($allowed|Where-Object{$resolved.StartsWith($_,[StringComparison]::OrdinalIgnoreCase)})){throw 'CRM_PRIVATE_PATH_REJECTED'}
 for($parent=[IO.Path]::GetDirectoryName($resolved);$parent;$parent=[IO.Path]::GetDirectoryName($parent)) {if(Test-Path -LiteralPath $parent){if((Get-Item -LiteralPath $parent).Attributes -band[IO.FileAttributes]::ReparsePoint){throw 'CRM_PRIVATE_REPARSE_REJECTED'}}}
 return $resolved
}
function Read-Rows([string]$Query){$cmd=$taskConnection.CreateCommand();$cmd.CommandText=$Query;$cmd.CommandTimeout=120;$reader=$cmd.ExecuteReader();$rows=@();try{while($reader.Read()){$row=@{};for($i=0;$i-lt$reader.FieldCount;$i++){$row[$reader.GetName($i)]=$reader.GetValue($i)};$rows+=,$row}}finally{$reader.Close();$cmd.Dispose()};return ,$rows}
function Run-Sql([string]$Query){$cmd=$taskConnection.CreateCommand();$cmd.CommandText=$Query;$cmd.CommandTimeout=120;try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}}
try {
 $BundlePath=Assert-PrivatePath $BundlePath;$SharedConfigPath=Assert-PrivatePath $SharedConfigPath -AllowSharedRuntimeConfig;$NativeConfigPath=Assert-PrivatePath $NativeConfigPath
 if((Test-Path -LiteralPath $NativeConfigPath)-or-not(Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($NativeConfigPath)))){throw 'CRM_NEW_CONFIG_PATH_REQUIRED'}
 $taskPhase='bundle-pin'
 $actual=(Get-FileHash -LiteralPath $BundlePath -Algorithm SHA256).Hash
 if($actual-ne$BundleSHA256){throw 'CRM_BUNDLE_PIN_MISMATCH'}
 $bundle=Get-Content -LiteralPath $BundlePath -Raw|ConvertFrom-Json
 $shared=Get-Content -LiteralPath $SharedConfigPath -Raw|ConvertFrom-Json
 $context=$bundle.context
 $taskPhase='copy-authority'
 if($bundle.schemaVersion-ne'melisa-crm-current-sql-bundle.v1'-or$bundle.actualT1-ne$false-or$bundle.businessEffect-ne$false-or$context.target.database-ne$taskDatabase-or$context.target.server-ne'Semih\MELISADEV'-or$context.target.login-ne$taskLogin-or$context.target.databaseUser-ne$taskLogin-or$context.copyId-ne$shared.copyContext.copyId-or$context.backupSHA-ne$shared.copyContext.backupSHA-or$shared.database-ne$taskDatabase-or$bundle.definitions.Count-ne5-or$context.catalog.runId-ne$shared.goal7SourceVersion.runId-or$context.catalog.bindingsHash-ne$shared.goal7SourceVersion.bindingsHash){throw 'CRM_COPY_AUTHORITY_REJECTED'}
 foreach($key in @('jwtAccessSecret','jwtRefreshSecret')){if($shared.$key-isnot[string]-or$shared.$key.Length-lt48){throw 'CRM_SHARED_JWT_REQUIRED'}}
 $taskPhase='sql-connect'
 $taskConnection=[Data.SqlClient.SqlConnection]::new("Server=Semih\MELISADEV;Database=$taskDatabase;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=10")
 $taskConnection.Open()
 $taskPhase='sql-copy-identity'
 $identity=(Read-Rows "SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control")[0]
 if($identity.db-ne$taskDatabase-or$identity.server-ne'Semih\MELISADEV'-or$identity.control-ne1){throw 'CRM_COPY_IDENTITY_REJECTED'}
 $taskPhase='legacy-baseline'
 $existing=(Read-Rows "SELECT SUSER_ID(N'$taskLogin') login_id,DATABASE_PRINCIPAL_ID(N'$taskLogin') user_id,(SELECT COUNT(*) FROM dbo.crm_order_v2_requests) requests,(SELECT COUNT(*) FROM dbo.crm_order_v2_lines) lines,(SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id IN(OBJECT_ID(N'dbo.crm_order_v2_requests'),OBJECT_ID(N'dbo.crm_order_v2_lines')) AND is_disabled=0 AND is_not_trusted=0) foreign_keys")[0]
 if($existing.login_id-isnot[DBNull]-or$existing.user_id-isnot[DBNull]){throw 'CRM_FRESH_PRINCIPAL_REQUIRED'}
 if($existing.requests-ne5-or$existing.lines-ne9-or$existing.foreign_keys-ne4-or$bundle.legacyGuards.Count-ne5){throw 'CRM_LEGACY_COPY_BASELINE_CHANGED'}
 $taskPhase='legacy-before-guards'
 foreach($guard in $bundle.legacyGuards){if($guard.name-cnotmatch '^dbo.crm_order_v2_[a-z_]+$'-or$guard.beforeHash-cnotmatch '^[A-F0-9]{64}$'-or$guard.afterHash-cnotmatch '^[A-F0-9]{64}$'){throw 'CRM_LEGACY_GUARD_INPUT_REJECTED'};$observed=(Read-Rows "SELECT CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($guard.name)'))),2) hash,OBJECTPROPERTY(OBJECT_ID(N'$($guard.name)'),'ExecIsTriggerDisabled') disabled,OBJECTPROPERTY(OBJECT_ID(N'$($guard.name)'),'IsTrigger') is_trigger")[0];if($observed.hash-ne$guard.beforeHash-or$observed.disabled-ne0-or$observed.is_trigger-ne1){throw 'CRM_LEGACY_GUARD_BEFORE_DRIFT'}}
 if($Mode-eq'Rehearse'){[PSCustomObject]@{mode='Rehearse';target='SHARED_TEST_COPY';definitions=5;executeProcedures=3;legacyRequests=$existing.requests;legacyLines=$existing.lines;businessWrites=0}|ConvertTo-Json -Compress;exit 0}
 $random=[byte[]]::new(48);$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($random)}finally{$rng.Dispose()};$password=[Convert]::ToBase64String($random)
 $taskPhase='fresh-principal-install'
 Run-Sql "BEGIN TRANSACTION;CREATE LOGIN [$taskLogin] WITH PASSWORD=N'$password',DEFAULT_DATABASE=[$taskDatabase],CHECK_POLICY=ON,CHECK_EXPIRATION=OFF;CREATE USER [$taskLogin] FOR LOGIN [$taskLogin];GRANT CONNECT TO [$taskLogin];GRANT SELECT ON OBJECT::dbo.users TO [$taskLogin];GRANT SELECT ON OBJECT::dbo.roles TO [$taskLogin];GRANT SELECT ON OBJECT::dbo.permissions TO [$taskLogin];"
 $taskPhase='legacy-guard-rebind';Run-Sql $bundle.legacyGuardRebindSql
 $taskPhase='current-procedure-install';Run-Sql $bundle.installSql
 $taskPhase='current-definition-after-proof'
 $actualDefs=Read-Rows "SELECT name,CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+name))),2) hash FROM dbo.crm_order_current_definitions"
 foreach($expected in $bundle.definitions){if(@($actualDefs|Where-Object{$_.name-eq$expected.name-and$_.hash-eq$expected.definitionHash}).Count-ne1){throw 'CRM_CURRENT_DEFINITION_DRIFT'}}
 $taskPhase='commit';Run-Sql 'COMMIT;'
 $native=@{database=$taskDatabase;server='127.0.0.1';sqlPort=1433;host='127.0.0.1';nativePort=62704;sqlUser=$taskLogin;sqlPassword=$password;jwtAccessSecret=$shared.jwtAccessSecret;jwtRefreshSecret=$shared.jwtRefreshSecret;crmOrderCurrentContext=$context}
 $taskPhase='native-config-exclusive-write'
 $stream=[IO.File]::Open($NativeConfigPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$bytes=[Text.Encoding]::UTF8.GetBytes(($native|ConvertTo-Json -Depth 30));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 $taskPhase='native-config-acl';$acl=Get-Acl -LiteralPath $NativeConfigPath;$acl.SetAccessRuleProtection($true,$false);foreach($account in @([Security.Principal.WindowsIdentity]::GetCurrent().Name,'NT AUTHORITY\SYSTEM')){$rule=[Security.AccessControl.FileSystemAccessRule]::new($account,'FullControl','Allow');$acl.AddAccessRule($rule)};Set-Acl -LiteralPath $NativeConfigPath -AclObject $acl
 $password=$null;$native=$null;$bytes=$null
 [PSCustomObject]@{mode='Install';target='SHARED_TEST_COPY';definitions=5;executeProcedures=3;legacyRequests=$existing.requests;legacyLines=$existing.lines;businessWrites=0;secretsPrinted=0}|ConvertTo-Json -Compress
}catch{
 # Never emit exception messages, SQL text, row bodies, paths or credentials.
 # Only this script's fixed CRM code and bounded SQL diagnostic identifiers.
 $taskCaught=$_.Exception;$taskCode='CRM_INSTALL_OPERATION_FAILED';$taskSqlNumber=$null;$taskSqlLine=$null;$taskSqlProcedure=$null
 if($taskCaught.Message-cmatch '^CRM_[A-Z0-9_]{1,100}$'){$taskCode=$taskCaught.Message}
 for($depth=0;$taskCaught-and$depth-lt8;$depth++){
  if($taskCaught-is[Data.SqlClient.SqlException]){
   $taskSqlNumber=[int]$taskCaught.Number
   if($taskCaught.Errors.Count){$taskError=$taskCaught.Errors[0];$taskSqlLine=[int]$taskError.LineNumber;if($taskError.Procedure-cmatch '^[a-zA-Z0-9_.\[\]]{1,128}$'){$taskSqlProcedure=$taskError.Procedure}}
   break
  }
  $taskCaught=$taskCaught.InnerException
 }
 if($taskConnection-and$taskConnection.State-eq'Open'){try{Run-Sql 'IF @@TRANCOUNT>0 ROLLBACK;'}catch{}}
 [PSCustomObject]@{error='CRM_CURRENT_COPY_INSTALL_FAILED';phase=$taskPhase;code=$taskCode;sqlNumber=$taskSqlNumber;sqlProcedure=$taskSqlProcedure;sqlLine=$taskSqlLine;secretsPrinted=0}|ConvertTo-Json -Compress
 exit 1
}finally{if($taskConnection){$taskConnection.Dispose()}}
