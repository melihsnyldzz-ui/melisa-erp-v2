# One fresh process/connection per fixed-target observation or attempt. No retry.
param([Parameter(Mandatory)][ValidateSet('snapshot','observe','rollback','apply')][string]$Operation,
 [Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$PlanSha256,
 [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{0,39}$')][string]$Label)
$ErrorActionPreference='Stop'
$root='C:\Users\Xaser\Desktop\ERP';$dir=Join-Path $root 'kurulum';$owner=$null;$readerOwner=$null;$connection=$null;$planStream=$null;$dispatched=$false
$outcome=Join-Path $dir ('master-v4-'+$Label+'-outcome.json')
function Write-V4New([string]$file,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 10 -Compress)+"`n");$stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes);$stream.Flush($true)}finally{$stream.Dispose()}}
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'MASTER_V4_WINDOWS_IDENTITY'}
 foreach($p in @($root,$dir)){$part=[IO.Path]::GetPathRoot($p);foreach($name in $p.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V4_ROOT_REPARSE'}}}
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -in @(4294,5294)).Count){throw 'MASTER_V4_APPLICATION_NOT_STOPPED'}
 if((Test-Path -LiteralPath $outcome) -or (Test-Path -LiteralPath (Join-Path $dir ('master-v4-'+$Label+'-attempt.json')))){throw 'MASTER_V4_PRIOR_ATTEMPT_NO_RETRY'}
 $mode=if($Operation -ceq 'observe'){'snapshot'}else{$Operation};$planFile=Join-Path $dir ('master-v4-'+$mode+'-plan.json')
 $item=Get-Item -LiteralPath $planFile -Force;if($item.PSIsContainer -or $item.Length -gt 1048576 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V4_PLAN_PATH'}
 $planStream=[IO.File]::Open($planFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($planStream)) -cne $PlanSha256){throw 'MASTER_V4_PLAN_HASH'}
 $plan=Get-Content -Raw -LiteralPath $planFile|ConvertFrom-Json -AsHashtable
 if($plan.mode -cne $mode -or $plan.sql -isnot [string] -or $plan.sha256 -cnotmatch '^[a-f0-9]{64}$' -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($plan.sql))).ToLowerInvariant() -cne $plan.sha256){throw 'MASTER_V4_SQL_HASH'}
 if($Operation -in @('rollback','apply')){
  $baseline=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v4-baseline-outcome.json')|ConvertFrom-Json -AsHashtable
  if($baseline.state -cne 'MASTER_V4_BATCH_COMPLETED' -or $baseline.result.schemaVersion -ne 3){throw 'MASTER_V4_BASELINE_PROOF'}
  foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($plan.baseline[$k] -cne $baseline.result[$k]){throw 'MASTER_V4_BASELINE_PROOF'}}
  if($Operation -ceq 'apply'){
   $proof=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v4-rollback-verification.json')|ConvertFrom-Json -AsHashtable
   $rollbackPlan=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v4-rollback-plan.json')|ConvertFrom-Json -AsHashtable
   if($proof.state -cne 'MASTER_V4_ROLLBACK_INDEPENDENTLY_VERIFIED' -or $proof.observerProcessCompleted -ne $true -or $proof.sqlSha256 -cne $rollbackPlan.sha256 -or $proof.observed.result.schemaVersion -ne 3){throw 'MASTER_V4_ROLLBACK_PROOF'}
   foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($proof.observed.result[$k] -cne $baseline.result[$k]){throw 'MASTER_V4_ROLLBACK_PROOF'}}
  }
 }
 Write-V4New (Join-Path $dir ('master-v4-'+$Label+'-attempt.json')) @{state='DISPATCH_PLANNED';operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;ownerPid=$PID;time=[DateTime]::UtcNow.ToString('o')}
 $connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;');$connection.Open()
 $command=$connection.CreateCommand();$command.CommandTimeout=60;$command.CommandText=$plan.sql;$dispatched=$true;$reader=$command.ExecuteReader();$rows=[Collections.Generic.List[object]]::new()
 try{do{while($reader.Read()){$row=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$key=$reader.GetName($i);if($key -cnotin @('state','metadataSha256','securitySha256','businessRowsSha256','schemaVersion')){throw 'MASTER_V4_RESULT_FIELD'};$row[$key]=$reader.GetValue($i)};$rows.Add($row)}}while($reader.NextResult())}finally{$reader.Dispose();$command.Dispose()}
 if($rows.Count -ne 1){throw 'MASTER_V4_RESULT_COUNT'};$result=$rows[0]
 foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($result[$k] -isnot [string] -or $result[$k] -cnotmatch '^[a-f0-9]{64}$'){throw 'MASTER_V4_RESULT_HASH'}}
 if($Operation -ceq 'rollback' -and $result.state -cne 'MASTER_V4_ROLLED_BACK' -or $Operation -ceq 'apply' -and $result.state -cne 'MASTER_V4_COMMITTED_UNVERIFIED' -or $mode -ceq 'snapshot' -and $result.schemaVersion -notin @(3,4)){throw 'MASTER_V4_RESULT_STATE'}
 $record=@{state='MASTER_V4_BATCH_COMPLETED';operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;result=$result;time=[DateTime]::UtcNow.ToString('o')}
 Write-V4New $outcome $record;[Console]::WriteLine(($record|ConvertTo-Json -Depth 10 -Compress))
}catch{
 $e=$_.Exception.GetBaseException();$labels=@([regex]::Matches($e.Message,'\b(?:MASTER_V[34]|LOCAL_MASTER)_[A-Z0-9_]{1,90}\b')|ForEach-Object{$_.Value}|Select-Object -Unique -First 5)
 $record=@{state=$(if($dispatched){'UNKNOWN'}else{'NOT_RUN'});operation=$Operation;staticLabels=$labels;exceptionType=$e.GetType().FullName;time=[DateTime]::UtcNow.ToString('o')}
 if(-not(Test-Path -LiteralPath $outcome)){Write-V4New $outcome $record};[Console]::Error.WriteLine(($record|ConvertTo-Json -Compress));exit 1
}finally{if($connection){$connection.Dispose()};if($planStream){$planStream.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()}}
