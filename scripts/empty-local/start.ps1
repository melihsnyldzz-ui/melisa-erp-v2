param([string]$PlanPath='C:\Users\Xaser\Documents\Codex\2026-11-05\task\empty-local-20261105-94a8324f\plan.json')
. (Join-Path $PSScriptRoot 'launcher-common.ps1')
$api=$null; $web=$null; $lock=$null; $secrets=$null; $clearBytes=$null; $phase='verify-plan'
$sessionId=[Guid]::NewGuid().ToString('N')
function Start-EmptyOwnedNode($Info,[string]$InputJson,[int]$Port) {
    $process = [Diagnostics.Process]::new(); $process.StartInfo=$Info
    $started=$false
    try {
        if (-not $process.Start()) { throw 'EMPTY_LOCAL_CHILD_START_FAILED' }
        $started=$true
        # stderr is drained privately. Never forward raw driver/SQL errors.
        $errorDrain=$process.StandardError.ReadToEndAsync()
        $firstLine=$process.StandardOutput.ReadLineAsync()
        $process.StandardInput.Write($InputJson); $process.StandardInput.Close()
        if (-not $firstLine.Wait(30000)) { throw 'EMPTY_LOCAL_START_TIMEOUT' }
        $line=$firstLine.GetAwaiter().GetResult()
        if (-not $line) { throw 'EMPTY_LOCAL_START_REJECTED' }
        $ready=$line | ConvertFrom-Json
        if ($ready.status -cne 'listening' -or $ready.profile -cne 'empty-local-20261105' -or [int]$ready.port -ne $Port -or $process.HasExited) { throw 'EMPTY_LOCAL_START_REJECTED' }
        $outputDrain=$process.StandardOutput.ReadToEndAsync()
        return @{Process=$process;ErrorDrain=$errorDrain;OutputDrain=$outputDrain}
    } catch {
        # Only the Process object created in this invocation may be stopped.
        if ($started) { try { if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit() } } catch {} }
        $process.Dispose(); throw 'EMPTY_LOCAL_CHILD_START_REJECTED'
    }
}
try {
    $verified=Get-EmptyVerifiedPlan $PlanPath; $plan=$verified.Plan
    Assert-EmptyRegularPath $script:EmptyRuntime
    $successPath=Join-Path $script:EmptyRuntime 'bootstrap-success.json'; Assert-EmptyRegularPath $successPath
    if (Test-Path -LiteralPath (Join-Path $script:EmptyRuntime 'bootstrap-failure.json')) { throw 'EMPTY_LOCAL_SETUP_INCOMPLETE' }
    $receipt=Get-Content -LiteralPath $successPath -Encoding UTF8 -Raw | ConvertFrom-Json
    if ($receipt.status -cne 'setup_complete_listeners_not_started' -or $receipt.planSha256 -cne $verified.Sha256 -or $receipt.environmentId -cne $script:EmptyEnvironmentId -or [long]$receipt.businessRows -ne 0) { throw 'EMPTY_LOCAL_RECEIPT_REJECTED' }
    $lockPath=Join-Path $script:EmptyRuntime 'launcher.lock'
    if (Test-Path -LiteralPath $lockPath) { Assert-EmptyRegularPath $lockPath }
    $lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $phase='unprotect-own-config'
    $protectedPath=Join-Path $script:EmptyRuntime 'protected-config.dpapi'; Assert-EmptyRegularPath $protectedPath
    if ((Get-FileHash -LiteralPath $protectedPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $receipt.protectedConfigSha256) { throw 'EMPTY_LOCAL_CONFIG_REJECTED' }
    Add-Type -AssemblyName System.Security
    $entropy=[Text.Encoding]::UTF8.GetBytes($script:EmptyEnvironmentId)
    $clearBytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($protectedPath),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $secrets=[Text.Encoding]::UTF8.GetString($clearBytes) | ConvertFrom-Json
    [Array]::Clear($clearBytes,0,$clearBytes.Length)
    if ($secrets.formatVersion -ne 1 -or $secrets.environmentId -cne $script:EmptyEnvironmentId -or $secrets.planSha256 -cne $verified.Sha256 -or $secrets.username -cne 'kurulum') { throw 'EMPTY_LOCAL_CONFIG_IDENTITY_REJECTED' }
    $phase='start-new-api-and-await-own-ready'
    $info=New-EmptyNodeInfo $verified.Node (Join-Path $script:EmptySourceRoot $plan.apiEntry) (Join-Path $script:EmptySourceRoot 'apps\api')
    $inputJson=@{sqlPassword=$secrets.sqlPassword;jwtAccessSecret=$secrets.jwtAccessSecret;jwtRefreshSecret=$secrets.jwtRefreshSecret} | ConvertTo-Json -Compress
    $api=Start-EmptyOwnedNode $info $inputJson 4294; $inputJson=$null; $secrets=$null
    # The web child independently verifies the plan/receipt and probes the fixed
    # API health identity before binding. It cannot proxy any API request.
    $phase='start-new-web-after-api-proof'
    if ($api.Process.HasExited) { throw 'EMPTY_LOCAL_API_EXITED' }
    $webInfo=New-EmptyNodeInfo $verified.Node (Join-Path $script:EmptySourceRoot 'scripts\empty-local\static-web.mjs') $script:EmptySourceRoot
    $web=Start-EmptyOwnedNode $webInfo '' 5294
    $phase='supervise-own-children'
    Write-EmptyNewJson (Join-Path $script:EmptyRuntime ('launcher-'+$sessionId+'.json')) @{status='listening';environmentId=$script:EmptyEnvironmentId;planSha256=$verified.Sha256;apiPid=$api.Process.Id;webPid=$web.Process.Id;createdAt=[DateTime]::UtcNow.ToString('o')}
    Write-Output 'EMPTY_LOCAL_LISTENING http://127.0.0.1:5294'
    while (-not $api.Process.HasExited -and -not $web.Process.HasExited) { Start-Sleep -Milliseconds 500 }
    throw 'EMPTY_LOCAL_CHILD_EXITED'
} catch {
    if ($null -ne $lock) {
        try { Write-EmptyNewJson (Join-Path $script:EmptyRuntime ('launcher-stopped-'+$sessionId+'.json')) @{status='stopped';phase=$phase;code='EMPTY_LOCAL_LAUNCHER_STOPPED';environmentId=$script:EmptyEnvironmentId;createdAt=[DateTime]::UtcNow.ToString('o')} } catch {}
    }
    Write-Error -Message ('EMPTY_LOCAL_LAUNCHER_STOPPED phase='+$phase+'; only children from this invocation are stopped.') -ErrorAction Continue
    exit 1
} finally {
    foreach ($owned in @($web,$api)) {
        if ($null -ne $owned) {
            try { if (-not $owned.Process.HasExited) { $owned.Process.Kill(); $owned.Process.WaitForExit() } } catch {}
            $owned.Process.Dispose()
        }
    }
    if ($null -ne $lock) { $lock.Dispose() }
    if ($null -ne $clearBytes) { [Array]::Clear($clearBytes,0,$clearBytes.Length) }
    $secrets=$null; $inputJson=$null
}
