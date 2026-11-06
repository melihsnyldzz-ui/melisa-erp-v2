# One fresh Windows process/one admin connection per observation or trial.
# No automatic retry, original installer/activation, SQL login or password edits.
param([Parameter(Mandatory)][ValidateSet('snapshot','rollback','apply','observe')][string]$Operation,
 [Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$PlanSha256)
$ErrorActionPreference='Stop';$root='C:\Users\Xaser\Desktop\ERP';$owner=$null;$readerOwner=$null;$connection=$null;$planStream=$null;$dispatched=$false;$outcomePath=$null;$stage='PREFLIGHT'
function Write-NewV3([string]$path,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 10 -Compress));$stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes);$stream.Flush($true)}finally{$stream.Dispose()}}
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'V3_WINDOWS_IDENTITY'}
 foreach($partPath in @($root,(Join-Path $root 'kurulum'))){$part=[IO.Path]::GetPathRoot($partPath);foreach($name in $partPath.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'V3_ROOT_REPARSE'}}}
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -in @(4294,5294)).Count){throw 'V3_APPLICATION_NOT_STOPPED'}
 $planMode=if($Operation -ceq 'observe'){'snapshot'}else{$Operation};$planFile=Join-Path $root ('kurulum\master-v3-'+$planMode+'-plan.json')
 $item=Get-Item -LiteralPath $planFile -Force;if($item.PSIsContainer -or $item.Length -gt 1048576 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'V3_PLAN_FILE_REJECTED'}
 $planStream=[IO.File]::Open($planFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($planStream)) -cne $PlanSha256){throw 'V3_PLAN_HASH_REJECTED'}
 $plan=Get-Content -Raw -LiteralPath $planFile|ConvertFrom-Json -AsHashtable
 if($plan.mode -cne $planMode -or $plan.sql -isnot [string] -or $plan.sha256 -cnotmatch '^[a-f0-9]{64}$' -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($plan.sql))).ToLowerInvariant() -cne $plan.sha256){throw 'V3_SQL_HASH_REJECTED'}
 if($Operation -in @('rollback','apply')){
  $prefix='master-v3-'+$Operation+'-v';$prior=@(Get-ChildItem -LiteralPath (Join-Path $root 'kurulum') -Directory -Filter ($prefix+'*'))
  foreach($old in $prior){
   if($old.Name -cnotmatch ('^'+[regex]::Escape($prefix)+'[1-9][0-9]{0,2}$') -or ($old.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'V3_PRIOR_TRIAL_PATH'}
   $oldOutcome=Join-Path $old.FullName 'outcome.json';if(-not(Test-Path -LiteralPath $oldOutcome)){throw 'V3_PRIOR_TRIAL_NO_RETRY'}
   $oldState=Get-Content -Raw -LiteralPath $oldOutcome|ConvertFrom-Json -AsHashtable
   if($oldState.operation -cne $Operation){throw 'V3_PRIOR_TRIAL_NO_RETRY'}
   if($oldState.state -cne 'NOT_RUN'){
    $reconciledFile=Join-Path $old.FullName 'reconciliation.json';if(-not(Test-Path -LiteralPath $reconciledFile)){throw 'V3_PRIOR_TRIAL_NO_RETRY'}
    $reconciled=Get-Content -Raw -LiteralPath $reconciledFile|ConvertFrom-Json -AsHashtable
    $before=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\master-v3-baseline.json')|ConvertFrom-Json -AsHashtable
    $oldAttempt=Get-Content -Raw -LiteralPath (Join-Path $old.FullName 'attempt.json')|ConvertFrom-Json -AsHashtable
    if($oldState.state -cne 'UNKNOWN' -or $reconciled.state -cne 'MASTER_V3_BASELINE_RESTORED' -or $reconciled.operation -cne $Operation -or $reconciled.sqlSha256 -cne $oldAttempt.sqlSha256 -or $reconciled.observerProcessCompleted -ne $true -or $reconciled.snapshot.schemaVersion -ne 2 -or $plan.sha256 -ceq $oldAttempt.sqlSha256){throw 'V3_PRIOR_TRIAL_NO_RETRY'}
    foreach($key in @('metadataSha256','securitySha256','businessRowsSha256')){if($reconciled.snapshot[$key] -cne $before.snapshot[$key]){throw 'V3_RECONCILIATION_DRIFT'}}
   }
  }
  if($prior.Count -ge 100){throw 'V3_TRIAL_LIMIT'};$trial=Join-Path $root ('kurulum\'+$prefix+($prior.Count+1));if(Test-Path -LiteralPath $trial){throw 'V3_PRIOR_TRIAL_PATH'}
  [void][IO.Directory]::CreateDirectory($trial);$outcomePath=Join-Path $trial 'outcome.json'
  Write-NewV3 (Join-Path $trial 'attempt.json') @{state='DISPATCH_PLANNED';operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;time=[DateTime]::UtcNow.ToString('o');ownerPid=$PID}
 }
 $stage='CONNECT';$connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;');$connection.Open()
 $command=$connection.CreateCommand();$command.CommandTimeout=60;$command.CommandText=$plan.sql
 $stage='EXECUTE';$dispatched=$true;$reader=$command.ExecuteReader();$stage='READ_RESULT';$rows=[Collections.Generic.List[object]]::new()
 try{do{while($reader.Read()){
   if($rows.Count -ne 0){throw 'V3_RESULT_COUNT'};$row=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$name=$reader.GetName($i);if($name -cnotin @('state','metadataSha256','securitySha256','businessRowsSha256','schemaVersion')){throw 'V3_RESULT_FIELD'};$row[$name]=$reader.GetValue($i)};$rows.Add($row)
  }}while($reader.NextResult())}finally{$reader.Dispose();$command.Dispose()}
 $stage='VERIFY_RESULT';if($rows.Count -ne 1){throw 'V3_RESULT_COUNT'};$row=$rows[0]
 foreach($name in @('metadataSha256','securitySha256','businessRowsSha256')){if($row[$name] -isnot [string] -or $row[$name] -cnotmatch '^[a-f0-9]{64}$'){throw 'V3_RESULT_HASH'}}
 if($Operation -ceq 'rollback' -and $row.state -cne 'MASTER_V3_ROLLED_BACK' -or $Operation -ceq 'apply' -and $row.state -cne 'MASTER_V3_COMMITTED_UNVERIFIED' -or $Operation -in @('snapshot','observe') -and $row.schemaVersion -notin @(2,3)){throw 'V3_RESULT_STATE'}
 $record=@{state='MASTER_V3_BATCH_COMPLETED';operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;result=$row;time=[DateTime]::UtcNow.ToString('o');requiresIndependentReadback=($Operation -in @('rollback','apply'))}
 if($outcomePath){Write-NewV3 $outcomePath $record};[Console]::WriteLine(($record|ConvertTo-Json -Depth 10 -Compress))
}catch{
 $baseError=$_.Exception.GetBaseException();$label=if($baseError.Message -cmatch '^(?:V3_|MASTER_V3_)[A-Z0-9_]{1,90}$'){$baseError.Message}else{'UNCLASSIFIED'};$sqlNumbers=@();if($baseError -is [Data.Odbc.OdbcException]){$sqlNumbers=@($baseError.Errors|ForEach-Object {$_.NativeError})};$safeFailure=[regex]::Match($baseError.Message,'MASTER_V3_FAILURE number=([0-9]{1,10}) cleanup=([0-9]{1,10}) label=([A-Z0-9_]{1,100})')
 $failure=@{state=$(if($dispatched){'UNKNOWN'}else{'NOT_RUN'});operation=$Operation;label=$label;stage=$stage;exceptionType=$baseError.GetType().FullName;sqlNumbers=$sqlNumbers;time=[DateTime]::UtcNow.ToString('o')};if($safeFailure.Success){$failure.safeSqlFailure=$safeFailure.Value}
 if($baseError -is [Data.Odbc.OdbcException]){$failure.staticSqlLabels=@([regex]::Matches($baseError.Message,'\b(?:MASTER_V3|LOCAL_MASTER)_[A-Z0-9_]{1,80}\b')|ForEach-Object {$_.Value}|Select-Object -Unique -First 5)}
 $sqlStage=[regex]::Match($baseError.Message,'\bstage=([0-9]{1,3})\b');if($sqlStage.Success){$failure.sqlStage=[int]$sqlStage.Groups[1].Value}
 if($outcomePath -and -not(Test-Path -LiteralPath $outcomePath)){Write-NewV3 $outcomePath $failure};[Console]::Error.WriteLine(($failure|ConvertTo-Json -Compress));exit 1
}finally{if($connection){$connection.Dispose()};if($planStream){$planStream.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()}}
