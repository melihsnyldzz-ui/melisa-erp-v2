param([switch]$Apply,[string]$PlanPath='C:\Users\Xaser\Documents\Codex\2026-11-05\task\empty-local-20261105-94a8324f\plan.json')
. (Join-Path $PSScriptRoot 'launcher-common.ps1')
if (-not $Apply) { throw 'EMPTY_LOCAL_APPLY_REQUIRED: review the public plan, then invoke with -Apply.' }
$phase = 'verify-plan'; $master = $null; $database = $null; $transaction = $null; $attemptOwned = $false
$secrets = $null; $passwordHash = $null; $secretJson = $null; $secretBytes = $null
try {
    $verified = Get-EmptyVerifiedPlan $PlanPath; $plan = $verified.Plan
    if (Test-Path -LiteralPath $script:EmptyRuntime) { throw 'EMPTY_LOCAL_PRIOR_ATTEMPT_REJECTED' }
    # Creating this directory is the permanent no-retry attempt marker. A failure
    # leaves artifacts for inspection; no cleanup/adoption/recovery is automated.
    [void](New-Item -ItemType Directory -Path $script:EmptyRuntime -ErrorAction Stop)
    $attemptOwned = $true; Assert-EmptyRegularPath $script:EmptyRuntime
    $phase = 'protect-new-secrets'
    Add-Type -AssemblyName System.Security
    $secrets = @{ sqlPassword=(New-EmptyRandomSecret); jwtAccessSecret=(New-EmptyRandomSecret); jwtRefreshSecret=(New-EmptyRandomSecret); appPassword=(New-EmptyRandomSecret) }
    $secretJson = @{ formatVersion=1; environmentId=$script:EmptyEnvironmentId; planSha256=$verified.Sha256; username='kurulum'; sqlPassword=$secrets.sqlPassword; jwtAccessSecret=$secrets.jwtAccessSecret; jwtRefreshSecret=$secrets.jwtRefreshSecret; appPassword=$secrets.appPassword } | ConvertTo-Json -Compress
    $secretBytes = [Text.Encoding]::UTF8.GetBytes($secretJson)
    $entropy = [Text.Encoding]::UTF8.GetBytes($script:EmptyEnvironmentId)
    $ciphertext = [Security.Cryptography.ProtectedData]::Protect($secretBytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $protectedPath = Join-Path $script:EmptyRuntime 'protected-config.dpapi'
    $file = [IO.File]::Open($protectedPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $file.Write($ciphertext,0,$ciphertext.Length); $file.Flush($true) } finally { $file.Dispose() }
    [Array]::Clear($secretBytes,0,$secretBytes.Length); $secretJson = $null
    $hashInfo = New-EmptyNodeInfo $verified.Node (Join-Path $script:EmptySourceRoot 'scripts\empty-local\hash-password.mjs') (Join-Path $script:EmptySourceRoot 'apps\api')
    $passwordHash = Invoke-EmptyPrivateNode $hashInfo (@{password=$secrets.appPassword} | ConvertTo-Json -Compress)
    if ($passwordHash -cnotmatch '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$') { throw 'EMPTY_LOCAL_HASH_REJECTED' }
    $phase = 'connect-master-current-windows-identity'
    $master = New-EmptySqlConnection 'master'; $master.Open()
    $phase = 'verify-server-and-absence'
    $server = Invoke-EmptySqlScalar $master $null "SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'));"
    if ($server -cne 'Semih\MELISADEV') { throw 'EMPTY_LOCAL_SERVER_REJECTED' }
    $absent = Invoke-EmptySqlScalar $master $null "SELECT CASE WHEN DB_ID(N'MELISA_ERP_EMPTY_TEST_20261105') IS NULL AND SUSER_ID(N'melisa_empty_test_read_20261105') IS NULL THEN 1 ELSE 0 END;"
    if ([int]$absent -ne 1) { throw 'EMPTY_LOCAL_TARGET_EXISTS' }
    $phase = 'create-new-database'
    Invoke-EmptySqlNonQuery $master $null 'CREATE DATABASE [MELISA_ERP_EMPTY_TEST_20261105];'
    $master.Dispose(); $master = $null
    $phase = 'connect-new-database'
    $database = New-EmptySqlConnection 'MELISA_ERP_EMPTY_TEST_20261105'; $database.Open()
    $identity = Invoke-EmptySqlScalar $database $null "SELECT CASE WHEN DB_NAME() COLLATE Latin1_General_100_BIN2=N'MELISA_ERP_EMPTY_TEST_20261105' AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2=N'Semih\MELISADEV' AND NOT EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0) THEN 1 ELSE 0 END;"
    if ([int]$identity -ne 1) { throw 'EMPTY_LOCAL_NEW_DATABASE_REJECTED' }
    $transaction = $database.BeginTransaction()
    $phase = 'create-empty-schema'
    foreach ($batch in $plan.schema.batches) { Invoke-EmptySqlNonQuery $database $transaction $batch.sql }
    $phase = 'create-marker-and-view-role'
    Invoke-EmptySqlNonQuery $database $transaction "INSERT dbo.empty_local_installation(id,environment_id,schema_version,actual_t1,external_operations,read_only) VALUES(1,'94a8324f-124a-49e4-ad70-be3232989f47',1,0,0,1);"
    $roleId = Invoke-EmptySqlScalar $database $transaction $plan.referenceSql
    if ([long]$roleId -lt 1) { throw 'EMPTY_LOCAL_ROLE_REJECTED' }
    $phase = 'create-one-normal-app-user-and-audit'
    $command = New-EmptySqlCommand $database $transaction @'
IF NOT EXISTS(SELECT 1 FROM dbo.roles WHERE id=@roleId AND code=N'empty_local_reader' AND is_active=1)
    THROW 51994,'EMPTY_LOCAL_ROLE_REJECTED',1;
IF EXISTS(SELECT 1 FROM dbo.users WHERE username=@username)
    THROW 51994,'EMPTY_LOCAL_USER_EXISTS',1;
DECLARE @created TABLE(id bigint);
INSERT dbo.users(username,password_hash,display_name,role_id,is_active,created_by,updated_by)
OUTPUT inserted.id INTO @created(id) VALUES(@username,@passwordHash,@displayName,@roleId,1,NULL,NULL);
DECLARE @userId bigint=(SELECT id FROM @created);
INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,after_json,reason,source)
VALUES(NULL,N'user_created',N'user',@userId,@snapshot,N'New isolated empty local installation',N'empty-local-setup');
SELECT @userId;
'@
    try {
        [void]$command.Parameters.Add('@username',[Data.SqlDbType]::NVarChar,80); $command.Parameters['@username'].Value='kurulum'
        [void]$command.Parameters.Add('@displayName',[Data.SqlDbType]::NVarChar,150); $command.Parameters['@displayName'].Value='Yerel kurulum okuyucusu'
        [void]$command.Parameters.Add('@roleId',[Data.SqlDbType]::BigInt); $command.Parameters['@roleId'].Value=[long]$roleId
        [void]$command.Parameters.Add('@passwordHash',[Data.SqlDbType]::NVarChar,255); $command.Parameters['@passwordHash'].Value=$passwordHash
        [void]$command.Parameters.Add('@snapshot',[Data.SqlDbType]::NVarChar,-1)
        $command.Parameters['@snapshot'].Value=(@{username='kurulum';displayName='Yerel kurulum okuyucusu';roleId=[long]$roleId;roleCode='empty_local_reader';isActive=$true;passwordConfigured=$true} | ConvertTo-Json -Compress)
        $userId = $command.ExecuteScalar(); if ([long]$userId -lt 1) { throw 'EMPTY_LOCAL_USER_REJECTED' }
    } finally { $command.Dispose(); $passwordHash = $null }
    $phase = 'create-select-only-sql-login'
    $command = New-EmptySqlCommand $database $transaction @'
IF SUSER_ID(N'melisa_empty_test_read_20261105') IS NOT NULL THROW 51994,'EMPTY_LOCAL_LOGIN_EXISTS',1;
DECLARE @statement nvarchar(max)=N'CREATE LOGIN [melisa_empty_test_read_20261105] WITH PASSWORD=N'''+REPLACE(@password,N'''',N'''''')+N''', DEFAULT_DATABASE=[MELISA_ERP_EMPTY_TEST_20261105], CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;';
EXEC sys.sp_executesql @statement;
CREATE USER [melisa_empty_test_read_20261105] FOR LOGIN [melisa_empty_test_read_20261105];
GRANT SELECT ON SCHEMA::dbo TO [melisa_empty_test_read_20261105];
IF EXISTS(SELECT 1 FROM sys.server_role_members WHERE member_principal_id=SUSER_ID(N'melisa_empty_test_read_20261105')) THROW 51994,'EMPTY_LOCAL_SERVER_ROLE_REJECTED',1;
IF EXISTS(SELECT 1 FROM sys.database_role_members WHERE member_principal_id=USER_ID(N'melisa_empty_test_read_20261105')) THROW 51994,'EMPTY_LOCAL_DATABASE_ROLE_REJECTED',1;
'@
    try {
        [void]$command.Parameters.Add('@password',[Data.SqlDbType]::NVarChar,128); $command.Parameters['@password'].Value=$secrets.sqlPassword
        [void]$command.ExecuteNonQuery()
    } finally { $command.Dispose() }
    $phase = 'prove-empty-and-references'
    $businessRows = Invoke-EmptySqlScalar $database $transaction $plan.emptyProofSql
    $references = Invoke-EmptySqlScalar $database $transaction @'
SELECT CASE WHEN
 (SELECT COUNT_BIG(*) FROM dbo.roles)=1 AND (SELECT COUNT_BIG(*) FROM dbo.permissions)=4
 AND (SELECT COUNT_BIG(*) FROM dbo.users)=1 AND (SELECT COUNT_BIG(*) FROM dbo.audit_logs)=1
 AND (SELECT COUNT_BIG(*) FROM dbo.empty_local_installation)=1
 AND NOT EXISTS(SELECT 1 FROM dbo.permissions WHERE can_view<>1 OR can_create<>0 OR can_update<>0 OR can_delete<>0 OR can_approve<>0 OR permission_key NOT IN(N'product.view',N'customer.view',N'supplier.view',N'dashboard.view'))
 THEN 1 ELSE 0 END;
'@
    if ([long]$businessRows -ne 0 -or [int]$references -ne 1) { throw 'EMPTY_LOCAL_EMPTY_PROOF_REJECTED' }
    $phase = 'commit-new-installation'; $transaction.Commit(); $transaction.Dispose(); $transaction = $null
    $phase = 'write-success-receipt'
    Write-EmptyNewJson (Join-Path $script:EmptyRuntime 'bootstrap-success.json') @{formatVersion=1;status='setup_complete_listeners_not_started';environmentId=$script:EmptyEnvironmentId;planSha256=$verified.Sha256;protectedConfigSha256=(Get-FileHash -LiteralPath $protectedPath -Algorithm SHA256).Hash.ToLowerInvariant();businessRows=0;createdAt=[DateTime]::UtcNow.ToString('o')}
    Write-Output 'EMPTY_LOCAL_SETUP_COMPLETE_LISTENERS_NOT_STARTED'
} catch {
    # Copy only type names and numeric provider codes. Never serialize an
    # exception/ErrorRecord/SqlError object, its Message, or other properties.
    $caughtException = $_.Exception
    $exceptionDiagnostics = @(); $sqlErrors = @(); $numericCodes = @()
    $classification = 'EMPTY_LOCAL_SETUP_STOPPED'
    try {
        $currentException = $caughtException
        for ($depth=0; $null -ne $currentException -and $depth -lt 8; $depth++) {
            $exceptionDiagnostics += @{type=$currentException.GetType().FullName;hResult=[int]$currentException.HResult}
            if ($currentException -is [Data.SqlClient.SqlException]) {
                foreach ($providerError in $currentException.Errors) {
                    if ($sqlErrors.Count -ge 32) { break }
                    $sqlErrors += @{number=[int]$providerError.Number;state=[int]$providerError.State;class=[int]$providerError.Class}
                }
            }
            $currentException = $currentException.InnerException
        }
        $numericCodes = @(@($exceptionDiagnostics | ForEach-Object { [int]$_.hResult }) + @($sqlErrors | ForEach-Object { [int]$_.number }) | Sort-Object -Unique)
        if ($numericCodes -contains -2146893019 -or $numericCodes -contains -2146893022) { $classification='SQL_CERTIFICATE_VALIDATION_FAILED' }
        elseif ($numericCodes -contains 10013) { $classification='SQL_SOCKET_ACCESS_DENIED' }
        elseif ($numericCodes -contains 18456) { $classification='SQL_AUTHORIZATION_FAILED' }
    } catch {
        $exceptionDiagnostics=@(); $sqlErrors=@(); $numericCodes=@()
        $classification='EMPTY_LOCAL_SETUP_STOPPED'
    }
    # No DDL is reachable in these phases. Once CREATE DATABASE is attempted,
    # failure is conservatively uncertain; no rollback/success is inferred.
    $sqlDdlState = 'uncertain'
    if ($phase -in @('verify-plan','protect-new-secrets','connect-master-current-windows-identity','verify-server-and-absence')) { $sqlDdlState='not_attempted' }
    elseif ($phase -eq 'write-success-receipt') { $sqlDdlState='committed_before_receipt_failure' }
    if ($attemptOwned) {
        try { Write-EmptyNewJson (Join-Path $script:EmptyRuntime 'bootstrap-failure.json') @{formatVersion=1;status='stopped_no_retry';phase=$phase;code=$classification;sqlDdlState=$sqlDdlState;exceptions=$exceptionDiagnostics;sqlErrors=$sqlErrors;outcome='inspect_own_artifacts_do_not_adopt_or_retry';createdAt=[DateTime]::UtcNow.ToString('o')} } catch {}
    }
    $numericSummary = if ($numericCodes.Count -gt 0) { $numericCodes -join ',' } else { 'none' }
    Write-Error -Message ('EMPTY_LOCAL_SETUP_STOPPED phase=' + $phase + ' numericCodes=' + $numericSummary) -ErrorAction Continue
    exit 1
} finally {
    # Disposing an uncommitted transaction rolls it back; the new database itself
    # is deliberately retained. No explicit destructive recovery is available.
    if ($null -ne $transaction) { try { $transaction.Dispose() } catch {} }
    if ($null -ne $master) { try { $master.Dispose() } catch {} }
    if ($null -ne $database) { try { $database.Dispose() } catch {} }
    if ($null -ne $secretBytes) { [Array]::Clear($secretBytes,0,$secretBytes.Length) }
    if ($null -ne $secrets) { foreach ($key in @($secrets.Keys)) { $secrets[$key]=$null } }
    $secretJson=$null; $passwordHash=$null
}
