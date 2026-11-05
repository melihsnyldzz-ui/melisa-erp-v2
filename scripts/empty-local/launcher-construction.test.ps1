# Offline Windows PowerShell 5.1 regression: constructs and disposes CLOSED
# SqlConnection objects only. No command, connection opening, or SQL execution.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. 'C:\Sirket\ERP\worktrees\erp-empty-local-20261105\scripts\empty-local\launcher-common.ps1'

function Assert-EmptyConstruction([bool]$Condition,[string]$Code) {
    if (-not $Condition) { throw $Code }
}

foreach ($target in @('master','MELISA_ERP_EMPTY_TEST_20261105')) {
    $connection = $null
    try {
        $connection = New-EmptySqlConnection $target
        Assert-EmptyConstruction ($connection -is [Data.SqlClient.SqlConnection]) 'EMPTY_LOCAL_TEST_CONNECTION_TYPE'
        Assert-EmptyConstruction ($connection.State -eq [Data.ConnectionState]::Closed) 'EMPTY_LOCAL_TEST_CONNECTION_NOT_CLOSED'
        $options = [Data.SqlClient.SqlConnectionStringBuilder]::new($connection.ConnectionString)
        Assert-EmptyConstruction ($options['Data Source'] -ceq 'tcp:127.0.0.1,1433') 'EMPTY_LOCAL_TEST_ENDPOINT'
        Assert-EmptyConstruction ($options['Initial Catalog'] -ceq $target) 'EMPTY_LOCAL_TEST_DATABASE'
        Assert-EmptyConstruction ($options['Integrated Security'] -eq $true) 'EMPTY_LOCAL_TEST_WINDOWS_IDENTITY'
        Assert-EmptyConstruction ($options['Encrypt'] -eq $true) 'EMPTY_LOCAL_TEST_ENCRYPT'
        Assert-EmptyConstruction ($options['TrustServerCertificate'] -eq $false) 'EMPTY_LOCAL_TEST_CERTIFICATE_VALIDATION'
        Assert-EmptyConstruction ($options['Connect Timeout'] -eq 5) 'EMPTY_LOCAL_TEST_CONNECT_TIMEOUT'
        Assert-EmptyConstruction ($options['Pooling'] -eq $false) 'EMPTY_LOCAL_TEST_POOLING'
        Assert-EmptyConstruction ($options['Application Name'] -ceq 'MelisaEmptyLocal20261105Setup') 'EMPTY_LOCAL_TEST_APPLICATION_NAME'
        Assert-EmptyConstruction ($options['User ID'] -ceq '') 'EMPTY_LOCAL_TEST_NO_SQL_USERNAME'
        Assert-EmptyConstruction ($options['Password'] -ceq '') 'EMPTY_LOCAL_TEST_NO_SQL_PASSWORD'
        Assert-EmptyConstruction ($connection.State -eq [Data.ConnectionState]::Closed) 'EMPTY_LOCAL_TEST_CONNECTION_STATE_CHANGED'
    } finally {
        if ($null -ne $connection) { $connection.Dispose() }
    }
}

foreach ($rejectedTarget in @('not-authorized','MASTER','MELISA_ERP_EMPTY_TEST_20261105 ')) {
    $rejected = $false; $unexpectedConnection = $null
    try { $unexpectedConnection = New-EmptySqlConnection $rejectedTarget }
    catch { $rejected = $_.FullyQualifiedErrorId -ceq 'EMPTY_LOCAL_DATABASE_REJECTED' }
    finally { if ($null -ne $unexpectedConnection) { $unexpectedConnection.Dispose() } }
    Assert-EmptyConstruction $rejected 'EMPTY_LOCAL_TEST_UNAUTHORIZED_DATABASE_NOT_REJECTED'
}

Write-Output 'EMPTY_LOCAL_LAUNCHER_CONSTRUCTION_PASS targets=2 rejectedTargets=3 connectionsOpened=0'
