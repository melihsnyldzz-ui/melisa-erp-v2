# Proposed one-shot schema rollback trial. No login/grant/application install.
param([switch]$ExecuteReviewedRollback)
$ErrorActionPreference='Stop'
if(-not $ExecuteReviewedRollback){throw 'EXECUTION_AUTHORITY_REQUIRED'}
$evidence='C:\Users\Xaser\Desktop\ERP\kurulum\first-sale-source-review'
$trial=Join-Path $evidence 'first-sale-schema-rollback-trial'
$digest='fb07cc6157b3a1c2557f0a8fc878c1f41d11f82b135c08c653f5ec7bd08eb92a'
$readbackDigest='3f0a3f0b1df6abcad019a549975b38cff174771b484e1db14f6f7ed27aaee7ca'
$sqlcmd='C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
function Write-New([string]$path,[object]$value){$f=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 8 -Compress));$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()}}
function Hash-Bytes([byte[]]$bytes){return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()}
function Read-Pinned([string]$path,[string]$hash){$item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.Length -gt 1048576 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'INPUT_PATH_REJECTED'};$bytes=[IO.File]::ReadAllBytes($path);if((Hash-Bytes $bytes) -cne $hash){throw 'INPUT_HASH_REJECTED'};return [Text.UTF8Encoding]::new($false,$true).GetString($bytes)}
function Assert-AppStopped {
 if(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -in 4294,5294}){throw 'DEDICATED_APPLICATION_MUST_BE_STOPPED'}
}
function Run-Sql([string]$text){
 $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$sqlcmd;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 $utf8=[Text.UTF8Encoding]::new($false);$start.StandardInputEncoding=$utf8;$start.StandardOutputEncoding=$utf8;$start.StandardErrorEncoding=$utf8
 foreach($a in @('-S','lpc:Semih\MELISAERP','-d','MELISA_ERP_DESKTOP_TEST_20261105','-E','-b','-r','1','-l','5','-t','20','-f','65001','-W','-h','-1')){[void]$start.ArgumentList.Add($a)}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$start;$started=$false
 try{if(-not $child.Start()){throw 'SQL_CHILD_NOT_STARTED'};$started=$true;$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();
  $write=$child.StandardInput.WriteAsync($text);if(-not $write.Wait(5000)){throw 'SQL_INPUT_TIMEOUT_NO_RETRY'};$write.GetAwaiter().GetResult();$child.StandardInput.Close()
  if(-not $child.WaitForExit(30000)){throw 'SQL_CHILD_TIMEOUT_NO_RETRY'}
  return @{exit=$child.ExitCode;output=$out.GetAwaiter().GetResult();error=$err.GetAwaiter().GetResult();pid=$child.Id;hasExited=$child.HasExited;sqlSha256=(Hash-Bytes $utf8.GetBytes($text))}
 }finally{if($started -and -not $child.HasExited){$child.Kill();$child.WaitForExit()};$child.Dispose()}
}
$owner=$null;$binary=$null;$readerOwner=$null
try{
 foreach($path in @($evidence,$sqlcmd)){$item=Get-Item -LiteralPath $path -Force;if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'PATH_REJECTED'}}
 $sqlText=Read-Pinned (Join-Path $evidence ($digest+'.rollback.proposed.sql')) $digest
 $readbackTemplate=Read-Pinned (Join-Path $evidence ($readbackDigest+'.readback.template.sql')) $readbackDigest
 if(([regex]::Matches($readbackTemplate,'__SQL_CHILD_PID__')).Count -ne 1){throw 'READBACK_PLACEHOLDER_REJECTED'}
 $binary=[IO.File]::Open($sqlcmd,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($binary)) -cne '7220B526AB97B0A5B30ED7B09C497AB7FAD39141090F8801D68691C38FF248DA'){throw 'SQLCMD_HASH_REJECTED'}
 # Hold the SAME owner lock as the verified reader launcher throughout the
 # trial. This also prevents a quoted/alternate-argument cooperative launcher
 # from starting before it opens ports; command-line text is not used as proof.
 $readerLock='C:\Users\Xaser\Desktop\ERP\desktop-initial-reader.owner.lock'
 $lockItem=Get-Item -LiteralPath $readerLock -Force
 if($lockItem.PSIsContainer -or ($lockItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'READER_LOCK_PATH_REJECTED'}
 $readerOwner=[IO.File]::Open($readerLock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 Assert-AppStopped
 if(-not(Test-Path -LiteralPath $trial)){[void][IO.Directory]::CreateDirectory($trial)}
 if(([IO.File]::GetAttributes($trial) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'TRIAL_PATH_REJECTED'}
 $owner=[IO.File]::Open((Join-Path $trial 'owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(Test-Path -LiteralPath (Join-Path $trial 'attempt.json')){throw 'PRIOR_ATTEMPT_NO_RETRY'}
 Write-New (Join-Path $trial 'attempt.json') @{state='DISPATCHED';mode='rollback';database='MELISA_ERP_DESKTOP_TEST_20261105';databaseGuid='c67f5317-9c0d-4831-aadd-fadc379a95d1';sqlSha256=$digest;readbackTemplateSha256=$readbackDigest;ownerPid=$PID;time=[DateTime]::UtcNow.ToString('o')}
 $result=Run-Sql $sqlText
 $expectedError=$result.error.Trim() -match '^(?:Msg|İleti)\s+51990,[^\r\n]*\r?\nFIRST_SALE_CONTROLLED_ROLLBACK$'
 Write-New (Join-Path $trial 'child-exit.json') @{exit=$result.exit;pid=$result.pid;hasExited=$result.hasExited;exactControlledError=$expectedError;sqlSha256=$result.sqlSha256;errorSha256=(Hash-Bytes ([Text.Encoding]::UTF8.GetBytes($result.error)))}
 if($result.exit -ne 1 -or -not $result.hasExited -or -not $expectedError -or $result.output.Trim() -ne '' -or $result.sqlSha256 -cne $digest){throw 'CONTROLLED_ROLLBACK_NOT_OBSERVED_NO_RETRY'}
 if(Get-Process -Id $result.pid -ErrorAction SilentlyContinue){throw 'CHILD_PID_STILL_PRESENT_NO_RETRY'}
 Assert-AppStopped
 $readback=$readbackTemplate.Replace('__SQL_CHILD_PID__',[string][int]$result.pid)
 $check=Run-Sql $readback
 Write-New (Join-Path $trial 'readback-exit.json') @{exit=$check.exit;pid=$check.pid;hasExited=$check.hasExited;sqlSha256=$check.sqlSha256;outputMatched=($check.output.Trim() -ceq 'FIRST_SALE_ROLLBACK_READBACK_VERIFIED');errorEmpty=($check.error.Trim() -ceq '')}
 if($check.exit -ne 0 -or -not $check.hasExited -or $check.error.Trim() -ne '' -or $check.output.Trim() -cne 'FIRST_SALE_ROLLBACK_READBACK_VERIFIED'){throw 'INDEPENDENT_READBACK_NOT_VERIFIED_NO_RETRY'}
 if(Get-Process -Id $result.pid,$check.pid -ErrorAction SilentlyContinue){throw 'CHILD_PID_REAPPEARED_NO_RETRY'}
 Assert-AppStopped
 Write-New (Join-Path $trial 'outcome.json') @{state='CONTROLLED_ROLLBACK_VERIFIED';sqlSha256=$digest;readbackTemplateSha256=$readbackDigest;scopedSchemaMetadataMatched=$true;readbackAtomicSnapshot=$false;principalPermissionSnapshotVerified=$false;applicationInstalled=$false;writerCreated=$false;permissionsGranted=$false;time=[DateTime]::UtcNow.ToString('o')}
 [Console]::Out.WriteLine('FIRST_SALE_CONTROLLED_ROLLBACK_VERIFIED')
}finally{if($owner){$owner.Dispose()};if($binary){$binary.Dispose()};if($readerOwner){$readerOwner.Dispose()}}
