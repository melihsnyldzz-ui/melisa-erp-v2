Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:EmptySourceRoot = 'C:\Sirket\ERP\worktrees\erp-empty-local-20261105'
$script:EmptyTaskRoot = 'C:\Users\Xaser\Documents\Codex\2026-11-05\task'
$script:EmptyInstallRoot = Join-Path $script:EmptyTaskRoot 'empty-local-20261105-94a8324f'
$script:EmptyPlanPath = Join-Path $script:EmptyInstallRoot 'plan.json'
$script:EmptyRuntime = Join-Path $script:EmptyInstallRoot 'runtime'
$script:EmptyEnvironmentId = '94a8324f-124a-49e4-ad70-be3232989f47'
if ([IO.Path]::GetFullPath($PSScriptRoot) -cne (Join-Path $script:EmptySourceRoot 'scripts\empty-local')) { throw 'EMPTY_LOCAL_LAUNCHER_SOURCE_REJECTED' }

function Assert-EmptyRegularPath([string]$Path) {
    $current = [IO.Path]::GetFullPath($Path)
    while ($current) {
        $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'EMPTY_LOCAL_REPARSE_REJECTED' }
        $parent = [IO.Directory]::GetParent($current)
        if ($null -eq $parent) { break }
        $current = $parent.FullName
    }
}
function New-EmptyNodeInfo([string]$NodePath,[string]$Entry,[string]$WorkingDirectory) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $NodePath
    $info.Arguments = '"' + $Entry + '"'
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.EnvironmentVariables.Clear()
    $systemRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::Windows)
    if (-not $systemRoot) { throw 'EMPTY_LOCAL_SYSTEMROOT_MISSING' }
    $info.EnvironmentVariables['SystemRoot'] = $systemRoot
    $info.EnvironmentVariables['WINDIR'] = $systemRoot
    return $info
}
function Invoke-EmptyPrivateNode([Diagnostics.ProcessStartInfo]$Info,[string]$InputJson) {
    $child = [Diagnostics.Process]::new(); $child.StartInfo = $Info
    $started = $false
    try {
        if (-not $child.Start()) { throw 'EMPTY_LOCAL_CHILD_FAILED' }
        $started = $true
        $outputTask = $child.StandardOutput.ReadToEndAsync()
        $errorTask = $child.StandardError.ReadToEndAsync()
        $child.StandardInput.Write($InputJson); $child.StandardInput.Close()
        if (-not $child.WaitForExit(60000)) { $child.Kill(); $child.WaitForExit(); throw 'EMPTY_LOCAL_CHILD_TIMEOUT' }
        $output = $outputTask.GetAwaiter().GetResult()
        $discarded = $errorTask.GetAwaiter().GetResult()
        if ($child.ExitCode -ne 0) { throw 'EMPTY_LOCAL_CHILD_REJECTED' }
        return $output
    } finally {
        if ($started) { try { if (-not $child.HasExited) { $child.Kill(); $child.WaitForExit() } } catch {} }
        $child.Dispose()
    }
}
function Get-EmptyVerifiedPlan([string]$PlanPath) {
    if ([IO.Path]::GetFullPath($PlanPath) -cne $script:EmptyPlanPath) { throw 'EMPTY_LOCAL_PLAN_PATH_REJECTED' }
    Assert-EmptyRegularPath $PlanPath
    Assert-EmptyRegularPath $script:EmptySourceRoot
    $node = 'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'
    Assert-EmptyRegularPath $node
    if ((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant() -cne '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237') { throw 'EMPTY_LOCAL_NODE_REJECTED' }
    $entry = Join-Path $script:EmptySourceRoot 'scripts\empty-local\prepare-plan.mjs'
    Assert-EmptyRegularPath $entry
    $info = New-EmptyNodeInfo $node $entry $script:EmptySourceRoot
    $info.Arguments += ' --verify "' + $script:EmptyPlanPath + '"'
    $result = (Invoke-EmptyPrivateNode $info '') | ConvertFrom-Json
    $plan = Get-Content -LiteralPath $PlanPath -Encoding UTF8 -Raw | ConvertFrom-Json
    $hash = (Get-FileHash -LiteralPath $PlanPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not $result.verified -or $result.sha256 -cne $hash -or $plan.node.path -cne $node) { throw 'EMPTY_LOCAL_PLAN_REJECTED' }
    return @{ Plan=$plan; Sha256=$hash; Node=$node }
}
function Write-EmptyNewJson([string]$Path,$Value) {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 20 -Compress))
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose(); [Array]::Clear($bytes,0,$bytes.Length) }
}
function New-EmptyRandomSecret {
    $bytes = [byte[]]::new(48); $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); return ('Aa7!' + [Convert]::ToBase64String($bytes)) } finally { $rng.Dispose(); [Array]::Clear($bytes,0,$bytes.Length) }
}
function New-EmptySqlConnection([string]$Database) {
    if ($Database -cne 'master' -and $Database -cne 'MELISA_ERP_EMPTY_TEST_20261105') { throw 'EMPTY_LOCAL_DATABASE_REJECTED' }
    $builder = [Data.SqlClient.SqlConnectionStringBuilder]::new()
    $builder.DataSource = 'tcp:127.0.0.1,1433'; $builder.InitialCatalog = $Database
    $builder.IntegratedSecurity = $true; $builder.Encrypt = $true; $builder.TrustServerCertificate = $false
    $builder.ConnectTimeout = 5; $builder.Pooling = $false; $builder.ApplicationName = 'MelisaEmptyLocal20261105Setup'
    return [Data.SqlClient.SqlConnection]::new($builder.ConnectionString)
}
function New-EmptySqlCommand($Connection,$Transaction,[string]$Sql) {
    $command = $Connection.CreateCommand(); $command.CommandText = $Sql; $command.CommandTimeout = 5
    if ($null -ne $Transaction) { $command.Transaction = $Transaction }
    return $command
}
function Invoke-EmptySqlScalar($Connection,$Transaction,[string]$Sql) {
    $command = New-EmptySqlCommand $Connection $Transaction $Sql
    try { return $command.ExecuteScalar() } finally { $command.Dispose() }
}
function Invoke-EmptySqlNonQuery($Connection,$Transaction,[string]$Sql) {
    $command = New-EmptySqlCommand $Connection $Transaction $Sql
    try { [void]$command.ExecuteNonQuery() } finally { $command.Dispose() }
}
