# One fresh process/connection per fixed-target observation or attempt. No retry.
param([Parameter(Mandatory)][ValidateSet('snapshot','observe','rollback','apply','revert','diagnose')][string]$Operation,
 [Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$PlanSha256,
 [Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$ExpectedPackageHash,
 [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{0,39}$')][string]$Label)
$ErrorActionPreference='Stop'
$root='C:\Users\Xaser\Desktop\ERP';$globalDir=Join-Path $root 'kurulum';$dir=$null;$contextKey=$null;$outcome=$null;$source=Join-Path $root 'kaynak-r1';$owner=$null;$readerOwner=$null;$connection=$null;$planStream=$null;$publicBindingStream=$null;$dispatched=$false;$pinned=[Collections.Generic.List[IO.FileStream]]::new()
function Write-V5New([string]$file,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 10 -Compress)+"`n");$stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes);$stream.Flush($true)}finally{$stream.Dispose()}}
function Hold-V5Input([string]$file,[string]$hash){
 if($hash -cnotmatch '^[a-fA-F0-9]{64}$'){throw 'MASTER_V5_SOURCE_PIN'}
 $item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V5_SOURCE_PATH'}
 $s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$pinned.Add($s)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant() -cne $hash.ToLowerInvariant()){throw 'MASTER_V5_SOURCE_PIN'}
}
function ConvertTo-V5FailureDetail([string]$message,[string[]]$knownLabels,$sqlErrors){
 $labels=@($knownLabels|Where-Object {$_ -cmatch '^(?:MASTER_V[345]|LOCAL_MASTER|DESKTOP)_[A-Z0-9_]{1,100}$' -and $message.Contains($_,[StringComparison]::Ordinal)}|Select-Object -Unique -First 5)
 $safeErrors=@();foreach($item in @($sqlErrors)|Select-Object -First 8){if($null -eq $item){continue};if($item.number -is [int] -and $item.sqlState -is [string] -and $item.sqlState -cmatch '^[A-Z0-9]{5}$'){$safeErrors+=@{number=$item.number;sqlState=$item.sqlState}}}
 return @{staticLabels=$labels;sqlErrors=$safeErrors}
}
function Assert-V5DiagnosticResult($result,$baselineResult){
 $keys=@('state','metadataSha256','securitySha256','businessRowsSha256','schemaVersion','permissionIdentityCurrent','diagnosticStage','errorNumber','errorLabel','checkDefinitions','effectivePermissions','operatorPermissions')
 if($result -isnot [hashtable] -or (($result.Keys|Sort-Object)-join ',') -cne (($keys|Sort-Object)-join ',')){throw 'MASTER_V5_DIAGNOSTIC_FIELDS'}
 if($result.state -cnotin @('MASTER_V5_DIAGNOSTIC_ROLLED_BACK','MASTER_V5_DIAGNOSTIC_ROLLED_BACK_ERROR') -or $result.schemaVersion -ne 4 -or $result.permissionIdentityCurrent -isnot [string] -or $result.permissionIdentityCurrent -cnotmatch '^[1-9][0-9]{0,18}$' -or $result.permissionIdentityCurrent -cne $baselineResult.permissionIdentityCurrent -or $result.diagnosticStage -isnot [string] -or $result.diagnosticStage -cnotmatch '^[A-Z_]{1,40}$' -or $result.errorNumber -isnot [int] -or $result.errorNumber -lt 0 -or ($null -ne $result.errorLabel -and ($result.errorLabel -isnot [string] -or $result.errorLabel -cnotmatch '^(?:MASTER_V5|LOCAL_MASTER|DESKTOP)_[A-Z0-9_]{1,100}$'))){throw 'MASTER_V5_DIAGNOSTIC_RESULT'}
 if(($result.state -ceq 'MASTER_V5_DIAGNOSTIC_ROLLED_BACK' -and ($result.errorNumber -ne 0 -or $null -ne $result.errorLabel -or $result.diagnosticStage -cne 'COMPLETE')) -or ($result.state -ceq 'MASTER_V5_DIAGNOSTIC_ROLLED_BACK_ERROR' -and $result.errorNumber -eq 0)){throw 'MASTER_V5_DIAGNOSTIC_ERROR_STATE'}
 foreach($key in @('metadataSha256','securitySha256','businessRowsSha256')){if($result[$key] -isnot [string] -or $result[$key] -cnotmatch '^[a-f0-9]{64}$' -or $result[$key] -cne $baselineResult[$key]){throw 'MASTER_V5_DIAGNOSTIC_DRIFT'}}
 foreach($key in @('checkDefinitions','effectivePermissions','operatorPermissions')){if($null -ne $result[$key]){if($result[$key] -isnot [string] -or $result[$key].Length -gt 65536 -or -not $result[$key].StartsWith('[') -or -not $result[$key].EndsWith(']')){throw 'MASTER_V5_DIAGNOSTIC_METADATA'};try{$null=$result[$key]|ConvertFrom-Json -AsHashtable -NoEnumerate}catch{throw 'MASTER_V5_DIAGNOSTIC_METADATA'}}}
 return $true
}
function Read-V5Assertion([string]$mode){
 $node='C:\Program Files\nodejs\node.exe';Hold-V5Input $node '3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5'
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$node;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WorkingDirectory=$source;$p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows'
 [void]$p.ArgumentList.Add((Join-Path $source 'scripts\desktop-empty\assert-master-v5-plan.mjs'));[void]$p.ArgumentList.Add($mode);[void]$p.ArgumentList.Add($ExpectedPackageHash)
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p
 try{if(-not $child.Start()){throw 'MASTER_V5_PLAN_SOURCE_REJECTED'};$child.StandardInput.Close();$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();if(-not $child.WaitForExit(30000)){$child.Kill();$child.WaitForExit();throw 'MASTER_V5_PLAN_SOURCE_REJECTED'}
  $text=$out.GetAwaiter().GetResult();if($child.ExitCode -ne 0 -or $err.GetAwaiter().GetResult().Length -ne 0 -or $text.Length -gt 2048){throw 'MASTER_V5_PLAN_SOURCE_REJECTED'}
  return ($text|ConvertFrom-Json -AsHashtable)
 }finally{if(-not $child.HasExited){try{$child.Kill()}catch{};$child.WaitForExit()};$child.Dispose()}
}
function Assert-V5CompiledPlan([string]$mode,[string]$planHash,[string]$sqlHash){$proof=Read-V5Assertion $mode;if($proof.state -cne 'MASTER_V5_PLAN_SOURCE_VERIFIED' -or $proof.contextKey -cne $contextKey -or $proof.packageSha256 -cne $ExpectedPackageHash.ToLowerInvariant() -or $proof.planSha256 -cne $planHash.ToLowerInvariant() -or $proof.sqlSha256 -cne $sqlHash){throw 'MASTER_V5_PLAN_SOURCE_REJECTED'}}
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'MASTER_V5_WINDOWS_IDENTITY'}
 foreach($p in @($root,$globalDir,$source)){$part=[IO.Path]::GetPathRoot($p);foreach($name in $p.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V5_ROOT_REPARSE'}}}
 if([IO.Path]::GetFullPath($PSCommandPath) -cne (Join-Path $source 'scripts\desktop-empty\invoke-master-v5-sql.ps1')){throw 'MASTER_V5_EXECUTOR_SOURCE'}
 $packageFile=Join-Path $globalDir 'master-v5-package.json';Hold-V5Input $packageFile $ExpectedPackageHash
 $package=Get-Content -Raw -LiteralPath $packageFile|ConvertFrom-Json -AsHashtable
 if($package.profile -cne 'desktop-master-v5' -or $package.sourceRoot -cne 'C:/Users/Xaser/Desktop/ERP/kaynak-r1' -or $package.sources -isnot [hashtable] -or $package.helpers -isnot [hashtable] -or -not $package.sources.ContainsKey('scripts/desktop-empty/assert-master-v5-plan.mjs') -or -not $package.sources.ContainsKey('scripts/desktop-empty/master-v5-plan-core.mjs') -or -not $package.helpers.ContainsKey('scripts/desktop-empty/invoke-master-v5-sql.ps1')){throw 'MASTER_V5_PACKAGE_SOURCE'}
 foreach($name in $package.sources.Keys){if($name -cnotmatch '^(apps/api/|scripts/|packages/shared/|infra/sql/migrations/)[A-Za-z0-9_./-]+\.(mjs|js|sql)$' -or $name.Split('/') -contains '..'){throw 'MASTER_V5_PACKAGE_PATH'};Hold-V5Input (Join-Path $source $name) $package.sources[$name]}
 foreach($name in $package.helpers.Keys){if($name -cnotmatch '^scripts/desktop-empty/[A-Za-z0-9._-]+\.ps1$'){throw 'MASTER_V5_HELPER_PATH'};Hold-V5Input (Join-Path $source $name) $package.helpers[$name]}
 $context=Read-V5Assertion 'context'
 if($context.state -cne 'MASTER_V5_RUN_CONTEXT_VERIFIED' -or $context.packageSha256 -cne $ExpectedPackageHash.ToLowerInvariant() -or $context.contextKey -cnotmatch '^[a-f0-9]{64}$' -or $context.artifactDirectory -cne ('C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-runs/'+$context.contextKey)){throw 'MASTER_V5_RUN_CONTEXT_REJECTED'}
 $contextKey=$context.contextKey;$dir=$context.artifactDirectory.Replace('/','\');$part=[IO.Path]::GetPathRoot($dir);foreach($name in $dir.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'MASTER_V5_CONTEXT_REPARSE'}}
 $outcome=Join-Path $dir ('master-v5-'+$Label+'-outcome.json')
 $expectedLabels=@{snapshot=@('baseline');observe=@('after-rollback','after-apply','after-revert','after-diagnose');rollback=@('rollback');apply=@('apply');revert=@('revert');diagnose=@('diagnose')}
 if($Label -cnotin $expectedLabels[$Operation]){throw 'MASTER_V5_ATTEMPT_LABEL_REJECTED'}
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
  $journal=Join-Path $globalDir 'master-v5-export-journal'
  $item=Get-Item -LiteralPath $journal -Force
  if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or @(Get-ChildItem -LiteralPath $journal -Force|Where-Object Name -cne 'desktop-target.json').Count){throw 'MASTER_V5_REVERT_JOURNAL_NOT_EMPTY'}
  $bindingFile=Join-Path $journal 'desktop-target.json';$binding=Get-Item -LiteralPath $bindingFile -Force
  if($binding.PSIsContainer -or $binding.Length -gt 2048 -or ($binding.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $plan.publicBindingSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'MASTER_V5_REVERT_BINDING'}
  $publicBindingStream=[IO.File]::Open($bindingFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($publicBindingStream)).ToLowerInvariant() -cne $plan.publicBindingSha256){throw 'MASTER_V5_REVERT_BINDING'}
  $applied=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-apply-verification.json')|ConvertFrom-Json -AsHashtable
  if($applied.state -cne 'MASTER_V5_APPLY_INDEPENDENTLY_VERIFIED' -or $applied.contextKey -cne $contextKey -or $applied.packageSha256 -cne $ExpectedPackageHash.ToLowerInvariant() -or $applied.observerProcessCompleted -ne $true -or $applied.observed.result.schemaVersion -ne 5){throw 'MASTER_V5_REVERT_APPLY_PROOF'}
  foreach($k in @('metadataSha256','securitySha256')){if($plan.candidate[$k] -cne $applied.observed.result[$k]){throw 'MASTER_V5_REVERT_CANDIDATE'}}
 }
 if($Operation -in @('rollback','apply','revert','diagnose')){
  $baseline=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-baseline-outcome.json')|ConvertFrom-Json -AsHashtable
  if($baseline.state -cne 'MASTER_V5_BATCH_COMPLETED' -or $baseline.contextKey -cne $contextKey -or $baseline.packageSha256.ToLowerInvariant() -cne $ExpectedPackageHash.ToLowerInvariant() -or $baseline.result.schemaVersion -ne 4){throw 'MASTER_V5_BASELINE_PROOF'}
  foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($plan.baseline[$k] -cne $baseline.result[$k]){throw 'MASTER_V5_BASELINE_PROOF'}}
  if($Operation -ceq 'apply'){
   $proof=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-rollback-verification.json')|ConvertFrom-Json -AsHashtable
   $rollbackPlan=Get-Content -Raw -LiteralPath (Join-Path $dir 'master-v5-rollback-plan.json')|ConvertFrom-Json -AsHashtable
   if($proof.state -cne 'MASTER_V5_ROLLBACK_INDEPENDENTLY_VERIFIED' -or $proof.contextKey -cne $contextKey -or $proof.packageSha256 -cne $ExpectedPackageHash.ToLowerInvariant() -or $proof.observerProcessCompleted -ne $true -or $proof.sqlSha256 -cne $rollbackPlan.sha256 -or $proof.observed.result.schemaVersion -ne 4){throw 'MASTER_V5_ROLLBACK_PROOF'}
   foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($proof.observed.result[$k] -cne $baseline.result[$k]){throw 'MASTER_V5_ROLLBACK_PROOF'}}
   foreach($k in @('metadataSha256','securitySha256')){if($plan.candidate[$k] -cne $proof.candidate[$k]){throw 'MASTER_V5_CANDIDATE_PROOF'}}
  }
 }
 Write-V5New (Join-Path $dir ('master-v5-'+$Label+'-attempt.json')) @{state='DISPATCH_PLANNED';contextKey=$contextKey;packageSha256=$ExpectedPackageHash;operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;ownerPid=$PID;time=[DateTime]::UtcNow.ToString('o')}
 $connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;');$connection.Open()
 $command=$connection.CreateCommand();$command.CommandTimeout=60;$command.CommandText=$plan.sql;$dispatched=$true;$reader=$command.ExecuteReader();$rows=[Collections.Generic.List[object]]::new()
 $resultFields=if($Operation -ceq 'diagnose'){@('state','metadataSha256','securitySha256','businessRowsSha256','schemaVersion','permissionIdentityCurrent','diagnosticStage','errorNumber','errorLabel','checkDefinitions','effectivePermissions','operatorPermissions')}else{@('state','metadataSha256','securitySha256','businessRowsSha256','schemaVersion','candidateMetadataSha256','candidateSecuritySha256','permissionIdentityPreserved','permissionIdentityCurrent')}
 try{do{while($reader.Read()){$row=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$key=$reader.GetName($i);if($key -cnotin $resultFields -or $row.ContainsKey($key)){throw 'MASTER_V5_RESULT_FIELD'};$value=$reader.GetValue($i);$row[$key]=if($value -is [DBNull]){$null}else{$value}};$rows.Add($row)}}while($reader.NextResult())}finally{$reader.Dispose();$command.Dispose()}
 if($rows.Count -ne 1){throw 'MASTER_V5_RESULT_COUNT'};$result=$rows[0]
 foreach($k in @('metadataSha256','securitySha256','businessRowsSha256')){if($result[$k] -isnot [string] -or $result[$k] -cnotmatch '^[a-f0-9]{64}$'){throw 'MASTER_V5_RESULT_HASH'}}
 if($Operation -ceq 'rollback' -and $result.state -cne 'MASTER_V5_ROLLED_BACK' -or $Operation -ceq 'apply' -and $result.state -cne 'MASTER_V5_COMMITTED_UNVERIFIED' -or $Operation -ceq 'revert' -and $result.state -cne 'MASTER_V5_REVERTED_UNVERIFIED' -or $mode -ceq 'snapshot' -and $result.schemaVersion -notin @(4,5)){throw 'MASTER_V5_RESULT_STATE'}
 if($Operation -ceq 'diagnose'){
  if((Assert-V5DiagnosticResult $result $baseline.result) -ne $true){throw 'MASTER_V5_DIAGNOSTIC_RESULT'}
 }
 $record=@{state=$(if($Operation -ceq 'diagnose'){'MASTER_V5_DIAGNOSTIC_COMPLETED_REQUIRES_OBSERVATION'}else{'MASTER_V5_BATCH_COMPLETED'});contextKey=$contextKey;packageSha256=$ExpectedPackageHash;operation=$Operation;sqlSha256=$plan.sha256;planSha256=$PlanSha256;result=$result;time=[DateTime]::UtcNow.ToString('o')}
 Write-V5New $outcome $record;[Console]::WriteLine(($record|ConvertTo-Json -Depth 10 -Compress))
}catch{
 $e=$_.Exception.GetBaseException();$known=@([regex]::Matches([IO.File]::ReadAllText($PSCommandPath),"(?i:throw)\s+'((?:MASTER_V[345]|LOCAL_MASTER|DESKTOP)_[A-Z0-9_]{1,100})'")|ForEach-Object{$_.Groups[1].Value})
 if($plan -and $plan.sql -is [string]){$known+=@([regex]::Matches($plan.sql,"\bTHROW\s+\d+\s*,\s*N?('{1,2})((?:MASTER_V[345]|LOCAL_MASTER|DESKTOP)_[A-Z0-9_]{1,100})\1\s*,\s*\d+\s*;")|ForEach-Object{$_.Groups[2].Value})}
 $sqlErrors=@();if($e -is [Data.Odbc.OdbcException]){$sqlErrors=@($e.Errors|ForEach-Object{@{number=[int]$_.NativeError;sqlState=[string]$_.SQLState}})};$detail=ConvertTo-V5FailureDetail $e.Message $known $sqlErrors
 $record=@{state=$(if($dispatched){'UNKNOWN'}else{'NOT_RUN'});contextKey=$contextKey;operation=$Operation;staticLabels=$detail.staticLabels;sqlErrors=$detail.sqlErrors;exceptionType=$e.GetType().FullName;time=[DateTime]::UtcNow.ToString('o')}
 if($outcome -and -not(Test-Path -LiteralPath $outcome)){Write-V5New $outcome $record};[Console]::Error.WriteLine(($record|ConvertTo-Json -Depth 5 -Compress));exit 1
}finally{if($connection){$connection.Dispose()};if($publicBindingStream){$publicBindingStream.Dispose()};if($planStream){$planStream.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()};foreach($s in $pinned){$s.Dispose()}}
