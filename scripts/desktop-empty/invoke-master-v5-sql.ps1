# One fresh process/connection per fixed-target observation or attempt. No retry.
param([Parameter(Mandatory)][ValidateSet('snapshot','observe','rollback','apply','revert')][string]$Operation,
 [Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$PlanSha256,
 [Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$ExpectedPackageHash,
 [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{0,39}$')][string]$Label)
$ErrorActionPreference='Stop'
$root='C:\Users\Xaser\Desktop\ERP';$dir=Join-Path $root 'kurulum';$source=Join-Path $root 'kaynak-r1';$owner=$null;$readerOwner=$null;$connection=$null;$planStream=$null;$publicBindingStream=$null;$dispatched=$false;$pinned=[Collections.Generic.List[IO.FileStream]]::new()
$outcome=Join-Path $dir ('master-v5-'+$Label+'-outcome.json')
function Write-V5New([string]$file,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 10 -Compress)+"`n");$stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes);$stream.Flush($true)}finally{$stream.Dispose()}}
function Hold-V5Input([string]$file,[string]$hash){
 if($hash -cnotmatch '^[a-fA-F0-9]{64}$'){throw 'MASTER_V5_SOURCE_PIN'}
 $item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V5_SOURCE_PATH'}
 $s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$pinned.Add($s)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant() -cne $hash.ToLowerInvariant()){throw 'MASTER_V5_SOURCE_PIN'}
}
function Assert-V5CompiledPlan([string]$mode,[string]$planHash,[string]$sqlHash){
 $node='C:\Program Files\nodejs\node.exe';Hold-V5Input $node '3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5'
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$node;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WorkingDirectory=$source;$p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows'
 [void]$p.ArgumentList.Add((Join-Path $source 'scripts\desktop-empty\assert-master-v5-plan.mjs'));[void]$p.ArgumentList.Add($mode)
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p
 try{if(-not $child.Start()){throw 'MASTER_V5_PLAN_SOURCE_REJECTED'};$child.StandardInput.Close();$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();if(-not $child.WaitForExit(30000)){$child.Kill();$child.WaitForExit();throw 'MASTER_V5_PLAN_SOURCE_REJECTED'}
  $text=$out.GetAwaiter().GetResult();if($child.ExitCode -ne 0 -or $err.GetAwaiter().GetResult().Length -ne 0 -or $text.Length -gt 2048){throw 'MASTER_V5_PLAN_SOURCE_REJECTED'}
  $proof=$text|ConvertFrom-Json -AsHashtable;if($proof.state -cne 'MASTER_V5_PLAN_SOURCE_VERIFIED' -or $proof.planSha256 -cne $planHash.ToLowerInvariant() -or $proof.sqlSha256 -cne $sqlHash){throw 'MASTER_V5_PLAN_SOURCE_REJECTED'}
 }finally{if(-not $child.HasExited){try{$child.Kill()}catch{};$child.WaitForExit()};$child.Dispose()}
}
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'MASTER_V5_WINDOWS_IDENTITY'}
 foreach($p in @($root,$dir,$source)){$part=[IO.Path]::GetPathRoot($p);foreach($name in $p.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V5_ROOT_REPARSE'}}}
 if([IO.Path]::GetFullPath($PSCommandPath) -cne (Join-Path $source 'scripts\desktop-empty\invoke-master-v5-sql.ps1')){throw 'MASTER_V5_EXECUTOR_SOURCE'}
 $packageFile=Join-Path $dir 'master-v5-package.json';Hold-V5Input $packageFile $ExpectedPackageHash
 $package=Get-Content -Raw -LiteralPath $packageFile|ConvertFrom-Json -AsHashtable
 if($package.profile -cne 'desktop-master-v5' -or $package.sourceRoot -cne 'C:/Users/Xaser/Desktop/ERP/kaynak-r1' -or $package.sources -isnot [hashtable] -or $package.helpers -isnot [hashtable] -or -not $package.sources.ContainsKey('scripts/desktop-empty/assert-master-v5-plan.mjs') -or -not $package.sources.ContainsKey('scripts/desktop-empty/master-v5-plan-core.mjs') -or -not $package.helpers.ContainsKey('scripts/desktop-empty/invoke-master-v5-sql.ps1')){throw 'MASTER_V5_PACKAGE_SOURCE'}
 foreach($name in $package.sources.Keys){if($name -cnotmatch '^(apps/api/|scripts/|packages/shared/|infra/sql/migrations/)[A-Za-z0-9_./-]+\.(mjs|js|sql)$' -or $name.Split('/') -contains '..'){throw 'MASTER_V5_PACKAGE_PATH'};Hold-V5Input (Join-Path $source $name) $package.sources[$name]}
 foreach($name in $package.helpers.Keys){if($name -cnotmatch '^scripts/desktop-empty/[A-Za-z0-9._-]+\.ps1$'){throw 'MASTER_V5_HELPER_PATH'};Hold-V5Input (Join-Path $source $name) $package.helpers[$name]}
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -in @(4294,5294)).Count){throw 'MASTER_V5_APPLICATION_NOT_STOPPED'}
 if((Test-Path -LiteralPath $outcome) -or (Test-Path -LiteralPath (Join-Path $dir ('master-v5-'+$Label+'-attempt.json')))){throw 'MASTER_V5_PRIOR_ATTEMPT_NO_RETRY'}
 $mode=if($Operation -ceq 'observe'){'snapshot'}else{$Operation};$planFile=Join-Path $dir ('master-v5-'+$mode+'-plan.json')
 $item=Get-Item -LiteralPath $planFile -Force;if($item.PSIsContainer -or $item.Length -gt 1048576 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V5_PLAN_PATH'}
 $planStream=[IO.File]::Open($planFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($planStream)) -cne $PlanSha256){throw 'MASTER_V5_PLAN_HASH'}
 $plan=Get-Content -Raw -LiteralPath $planFile|ConvertFrom-Json -AsHashtable
 if($plan.mode -cne $mode -or $plan.sql -isnot [string] -or $plan.sha256 -cnotmatch '^[a-f0-9]{64}$' -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($plan.sql))).ToLowerInvariant() -cne $plan.sha256){throw 'MASTER_V5_SQL_HASH'}
 Assert-V5CompiledPlan $mode $PlanSha256 $plan.sha256
 if($Operation -ceq 'revert'){
  $journal=Join-Path $dir 'master-v5-export-journal'
  $item=Get-Item -LiteralPath $journal -Force
  if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or @(Get-ChildItem -LiteralPath $journal -Force|Where-Object Name -cne 'desktop-target.json').Count){throw 'MASTER_V5_REVERT_JOURNAL_NOT_EMPTY'}
  $bindingFile=Join-Path $journal 'desktop-target.json';$binding=Get-Item -LiteralPath $bindingFile -Force
  if($binding.PSIsContainer -or $binding.Length -gt 2048 -or ($binding.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $plan.publicBindingSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'MASTER_V5_REVERT_BINDING'}
  $publicBindingStream=[IO.File]::Open($bindingFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($publicBindingStream)).ToLowerInvariant() -cne $plan.publicBindingSha256){throw 'MASTER_V5_REVERT_BINDING'}
  $applied=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-apply-verification.json')|ConvertFrom-Json -AsHashtable
  if($applied.state -cne 'MASTER_V5_APPLY_INDEPENDENTLY_VERIFIED' -or $applied.observerProcessCompleted -ne $true -or $applied.observed.result.schemaVersion -ne 5){throw 'MASTER_V5_REVERT_APPLY_PROOF'}
  foreach($k in @('metadataSha256','securitySha256')){if($plan.candidate[$k] -cne $applied.observed.result[$k]){throw 'MASTER_V5_REVERT_CANDIDATE'}}
 }
 if($Operation -in @('rollback','apply','revert')){
  $baseline=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-baseline-outcome.json')|ConvertFrom-Json -AsHashtable
  if($baseline.state -cne 'MASTER_V5_BATCH_COMPLETED' -or $baseline.result.schemaVersion -ne 4){throw 'MASTER_V5_BASELINE_PROOF'}
  foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($plan.baseline[$k] -cne $baseline.result[$k]){throw 'MASTER_V5_BASELINE_PROOF'}}
  if($Operation -ceq 'apply'){
   $proof=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-rollback-verification.json')|ConvertFrom-Json -AsHashtable
   $rollbackPlan=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-rollback-plan.json')|ConvertFrom-Json -AsHashtable
   if($proof.state -cne 'MASTER_V5_ROLLBACK_INDEPENDENTLY_VERIFIED' -or $proof.observerProcessCompleted -ne $true -or $proof.sqlSha256 -cne $rollbackPlan.sha256 -or $proof.observed.result.schemaVersion -ne 4){throw 'MASTER_V5_ROLLBACK_PROOF'}
   foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($proof.observed.result[$k] -cne $baseline.result[$k]){throw 'MASTER_V5_ROLLBACK_PROOF'}}
   foreach($k in @('metadataSha256','securitySha256')){if($plan.candidate[$k] -cne $proof.candidate[$k]){throw 'MASTER_V5_CANDIDATE_PROOF'}}
  }
 }
 Write-V5New (Join-Path $dir ('master-v5-'+$Label+'-attempt.json')) @{state='DISPATCH_PLANNED';packageSha256=$ExpectedPackageHash;operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;ownerPid=$PID;time=[DateTime]::UtcNow.ToString('o')}
 $connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;');$connection.Open()
 $command=$connection.CreateCommand();$command.CommandTimeout=60;$command.CommandText=$plan.sql;$dispatched=$true;$reader=$command.ExecuteReader();$rows=[Collections.Generic.List[object]]::new()
 try{do{while($reader.Read()){$row=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$key=$reader.GetName($i);if($key -cnotin @('state','metadataSha256','securitySha256','businessRowsSha256','schemaVersion','candidateMetadataSha256','candidateSecuritySha256','permissionIdentityPreserved','permissionIdentityCurrent')){throw 'MASTER_V5_RESULT_FIELD'};$row[$key]=$reader.GetValue($i)};$rows.Add($row)}}while($reader.NextResult())}finally{$reader.Dispose();$command.Dispose()}
 if($rows.Count -ne 1){throw 'MASTER_V5_RESULT_COUNT'};$result=$rows[0]
 foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($result[$k] -isnot [string] -or $result[$k] -cnotmatch '^[a-f0-9]{64}$'){throw 'MASTER_V5_RESULT_HASH'}}
 if($Operation -ceq 'rollback' -and $result.state -cne 'MASTER_V5_ROLLED_BACK' -or $Operation -ceq 'apply' -and $result.state -cne 'MASTER_V5_COMMITTED_UNVERIFIED' -or $Operation -ceq 'revert' -and $result.state -cne 'MASTER_V5_REVERTED_UNVERIFIED' -or $mode -ceq 'snapshot' -and $result.schemaVersion -notin @(4,5)){throw 'MASTER_V5_RESULT_STATE'}
 $record=@{state='MASTER_V5_BATCH_COMPLETED';packageSha256=$ExpectedPackageHash;operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;result=$result;time=[DateTime]::UtcNow.ToString('o')}
 Write-V5New $outcome $record;[Console]::WriteLine(($record|ConvertTo-Json -Depth 10 -Compress))
}catch{
 $e=$_.Exception.GetBaseException();$labels=@([regex]::Matches($e.Message,'\b(?:MASTER_V[345]|LOCAL_MASTER)_[A-Z0-9_]{1,90}\b')|ForEach-Object{$_.Value}|Select-Object -Unique -First 5)
 $record=@{state=$(if($dispatched){'UNKNOWN'}else{'NOT_RUN'});operation=$Operation;staticLabels=$labels;exceptionType=$e.GetType().FullName;time=[DateTime]::UtcNow.ToString('o')}
 if(-not(Test-Path -LiteralPath $outcome)){Write-V5New $outcome $record};[Console]::Error.WriteLine(($record|ConvertTo-Json -Compress));exit 1
}finally{if($connection){$connection.Dispose()};if($publicBindingStream){$publicBindingStream.Dispose()};if($planStream){$planStream.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()};foreach($s in $pinned){$s.Dispose()}}
