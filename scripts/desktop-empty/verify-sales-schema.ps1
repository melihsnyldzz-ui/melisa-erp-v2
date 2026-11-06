# Single process owns the cooperative lock and dispatches SQLCMD. Node only
# compiles fixed, source-pinned SQL; it is not entrusted with lock ownership.
# No commercial records are seeded. A started/unknown attempt cannot be retried.
$ErrorActionPreference='Stop'
$root='C:\Users\Xaser\Desktop\ERP'
$source=Join-Path $root 'kaynak'
$node='C:\Program Files\nodejs\node.exe'
$nodeHash='3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5'
$sqlcmd='C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
$sqlHash='7220B526AB97B0A5B30ED7B09C497AB7FAD39141090F8801D68691C38FF248DA'
$envId='eb2888c2-51cb-4570-a933-397cf7e62806'
$server='Semih\MELISAERP'
$db='MELISA_ERP_DESKTOP_TEST_20261105'
$original='e4f0eb89743f497e761a02ebd6be6a74742d188f88fbaae77086292964ee7f1d'
$lock=Join-Path $root 'desktop-empty-schema.owner.lock'
$oldAttempt=Join-Path $root "desktop-empty-$envId.rollback45.attempt.json"
$oldAttemptHash='F7634BD5819AF4868F17189E8237AE87504F34FE6B3265A502D2FA58869097D6'
$priorResolution=Join-Path $root "desktop-empty-$envId.rollback45.prior-resolution.json"
$priorResolutionHash='727A859CBF27CC69EC39891338E2F9499DA7628D311796CF3A1AF2B86A95F9AA'
$rollbackAttempt=Join-Path $root "desktop-empty-$envId.rollback45-v2.attempt.json"
$rollbackAttemptHash='E7B5CA1155CEF8291670F17FBABA169DF74570C57C41E970D4D08B01E7396DA3'
$rollbackOutcome=Join-Path $root "desktop-empty-$envId.rollback45-v2.outcome.json"
$rollbackOutcomeHash='829ABA98C626B36749409EEA88A691957DBF4B5CC997E54CFFAAABDC22B4684D'
$rollbackProbeSha='df9054887c18dc8b6743b7347135dfa7585b2ecfd3734affe8175be2ef2140aa'
$attempt=Join-Path $root "desktop-empty-$envId.apply45.attempt.json"
$events=Join-Path $root "desktop-empty-$envId.apply45.events.jsonl"
$outcome=Join-Path $root "desktop-empty-$envId.apply45.outcome.json"
$blocked=@('attempt.json','outcome.json','rollback-probe.attempt.json','rollback45.outcome.json','apply45.attempt.json','apply45.events.jsonl','apply45.outcome.json') | ForEach-Object { Join-Path $root "desktop-empty-$envId.$_" }
$script:probeJournalActive=$false
$script:currentPhase='PRE_ATTEMPT'
$script:failureCode='UNCLASSIFIED'
$script:lastChildPid=0
$script:probeStarted=$false
$script:probeClosed=$false
$script:probePid=0
function Record-Stage([string]$stage,[int]$childPid=0,[int]$exitCode=0,[int]$sqlError=0,[string]$failureCode='NONE') {
 if(-not $script:probeJournalActive){return}
 $allowed=@('ATTEMPT_CREATED','APPLY_PROCESS_STARTED','APPLY_STDIN_SENT','APPLY_PROCESS_CLOSED','READBACK_PROCESS_STARTED','READBACK_PROCESS_CLOSED','READBACK_VERIFIED','STOPPED','SESSION_CLEAR','OWNER_HELD_UNKNOWN')
 $codes=@('NONE','APPLY_UNKNOWN','READBACK_UNKNOWN','READBACK_COMPILER_REJECTED','CHILD_INPUT_TIMEOUT','CHILD_TIMEOUT','CHILD_OUTPUT_LIMIT','CHILD_NOT_STARTED','EXTERNAL_FAILURE')
 if($stage -cnotin $allowed -or $childPid -lt 0 -or $sqlError -notin @(0,51990,51994,51995) -or $failureCode -cnotin $codes){throw 'STAGE_REJECTED'}
 $record=@{stage=$stage;phase=$script:currentPhase;childPid=$childPid;exitCode=$exitCode;sqlError=$sqlError;failureCode=$failureCode;time=[DateTime]::UtcNow.ToString('o')}
 $stream=[IO.File]::Open($events,[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($record|ConvertTo-Json -Compress)+"`n");$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
$pins=@{
 'scripts/desktop-empty/sales-apply-compiler.mjs'='1784793E38E610CADB5A26748FD882A2B235F878DBE0EA3540DBBDCFD65C9ADA'
 'scripts/desktop-empty/apply-sales-readback.mjs'='AAC8E0DA2ABFF2109DCBE1F7A5D83D44F0A693B67FB8201ABE97D2EB13B51C12'
 'scripts/desktop-empty/rollback-sales-probe.mjs'='D4F5296EAF419DED4D94EC196ADBDD1B51957BFA35D95FB59AF629E34B2EF3EF'
 'scripts/desktop-empty/rollback-readback.mjs'='708935FC6B9359DE4C96929BC4399DCB0472487DF023B0267D376B5DDF4796B0'
 'scripts/desktop-empty/rollback-probe.mjs'='0BA238BCFDD9E7C81F412B75CBD63528428CA26FAE94EDBD9816682EECA6C35D'
 'scripts/desktop-empty/bootstrap-sales-proposal.mjs'='5FB8F1B6EDBB3F144F93E1B1A935A9F2F07C664B8ECE323054C9850899EB0140'
 'scripts/desktop-empty/bootstrap-sql.mjs'='DDDCBAE5B3EFB198CCFD03B0E1827F73E7BE8DAE5FEF81930C592787ED358369'
 'scripts/desktop-empty/schema.mjs'='7B0EEE3CDBCE0B1314FA8F778BA65790BE819FF7245F005E2305412FED32A74E'
 'scripts/desktop-empty/native-catalog-schema.mjs'='554387D4B845CCE013AB16FE6411448246F5AD69BB3C0C0D68FC031EA39CD33E'
 'scripts/desktop-empty/sales-currency-schema.mjs'='6EB84815B58DFD2390B91BD4515BC520A7C99D6A055B0C2B7A11C52F91008AA1'
 'scripts/empty-local/schema.mjs'='C9470829DD16100CA3EC3CE2A7479EE4CD0E0CFE432FDA3E31446C8850F77193'
}
function HashText([string]$s) { ([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($s)))).ToLowerInvariant() }
function Verify-File([string]$file,[string]$hash) {
 $item=Get-Item -LiteralPath $file -Force
 if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -cne $hash) { throw 'FILE_PIN_REJECTED' }
}
function Verify-Inputs {
 Verify-File $node $nodeHash; Verify-File $sqlcmd $sqlHash
 foreach($p in $pins.Keys) { Verify-File (Join-Path $source $p) $pins[$p] }
}
if ('DesktopRollback45BoundedReader' -as [type]) { throw 'READER_TYPE_COLLISION' }
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Threading.Tasks;
public static class DesktopRollback45BoundedReader {
 public static async Task<byte[]> Read(Stream input, int limit) {
  using (var output = new MemoryStream()) {
   byte[] buffer = new byte[4096];
   for (;;) {
    int count = await input.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false);
    if (count == 0) return output.ToArray();
    if (output.Length + count > limit) throw new InvalidDataException("OUTPUT_LIMIT");
    output.Write(buffer, 0, count);
   }
  }
 }
}
'@
function Stop-Child([Diagnostics.Process]$proc,[int]$pidValue,[string]$reason) {
 [Console]::Error.WriteLine("UNKNOWN_CHILD_WAIT PID=$pidValue; OWNER_LOCK_HELD; SESSION_NOT_YET_RESOLVED; NO_RETRY")
 try{$proc.Kill()}catch{};$proc.WaitForExit();throw $reason
}
function Run-Child([string]$exe,[string[]]$arguments,[string]$inputText,[int]$limit) {
 $psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$exe;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
 $psi.WorkingDirectory=$source;$psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
 $psi.StandardInputEncoding=[Text.UTF8Encoding]::new($false);$psi.StandardOutputEncoding=[Text.UTF8Encoding]::new($false);$psi.StandardErrorEncoding=[Text.UTF8Encoding]::new($false)
 $psi.Environment.Clear();$psi.Environment['SystemRoot']='C:\Windows';$psi.Environment['WINDIR']='C:\Windows'
 foreach($arg in $arguments){[void]$psi.ArgumentList.Add($arg)}
 $proc=[Diagnostics.Process]::new();$proc.StartInfo=$psi
 if(-not $proc.Start()){throw 'CHILD_NOT_STARTED'}
 $pidValue=$proc.Id
 if($script:currentPhase -ceq 'APPLY'){$script:probeStarted=$true;$script:probePid=$pidValue}
 try {
  if($script:currentPhase -cin @('APPLY','READBACK')){$script:lastChildPid=$pidValue}
  if($script:currentPhase -ceq 'APPLY'){Record-Stage 'APPLY_PROCESS_STARTED' $pidValue}
  if($script:currentPhase -ceq 'READBACK'){Record-Stage 'READBACK_PROCESS_STARTED' $pidValue}
  $out=[DesktopRollback45BoundedReader]::Read($proc.StandardOutput.BaseStream,$limit)
  $err=[DesktopRollback45BoundedReader]::Read($proc.StandardError.BaseStream,$limit)
  $watch=[Diagnostics.Stopwatch]::StartNew()
  try {
   $writing=$proc.StandardInput.WriteAsync($inputText)
   while(-not $writing.IsCompleted){
    if($out.IsFaulted -or $err.IsFaulted){Stop-Child $proc $pidValue 'CHILD_OUTPUT_LIMIT'}
    if($watch.ElapsedMilliseconds -ge 120000){Stop-Child $proc $pidValue 'CHILD_INPUT_TIMEOUT'}
    Start-Sleep -Milliseconds 50
   }
   $writing.GetAwaiter().GetResult();$proc.StandardInput.Close()
   if($script:currentPhase -ceq 'APPLY'){Record-Stage 'APPLY_STDIN_SENT' $pidValue}
  } catch {try{$proc.Kill()}catch{};throw}
  while(-not $proc.WaitForExit(50)) {
   if($out.IsFaulted -or $err.IsFaulted){Stop-Child $proc $pidValue 'CHILD_OUTPUT_LIMIT'}
   if($watch.ElapsedMilliseconds -ge 120000){Stop-Child $proc $pidValue 'CHILD_TIMEOUT'}
  }
  $stdoutBytes=$out.GetAwaiter().GetResult();$stderrBytes=$err.GetAwaiter().GetResult()
  if($stdoutBytes.Length+$stderrBytes.Length -gt $limit){throw 'CHILD_OUTPUT_LIMIT'}
  $utf8=[Text.UTF8Encoding]::new($false,$true);$stdout=$utf8.GetString($stdoutBytes);$stderr=$utf8.GetString($stderrBytes)
  $sqlError=0
  if($stderr -match '(?m)^Msg\s+(51990|51994|51995),'){$sqlError=[int]$Matches[1]}
  if($script:currentPhase -ceq 'APPLY'){Record-Stage 'APPLY_PROCESS_CLOSED' $pidValue $proc.ExitCode $sqlError}
  if($script:currentPhase -ceq 'READBACK'){Record-Stage 'READBACK_PROCESS_CLOSED' $pidValue $proc.ExitCode $sqlError}
  return @{pid=$pidValue;code=$proc.ExitCode;out=$stdout;err=$stderr}
 } finally {
  if(-not $proc.HasExited){
   [Console]::Error.WriteLine("UNKNOWN_CHILD_WAIT PID=$pidValue; OWNER_LOCK_HELD; SESSION_NOT_YET_RESOLVED; NO_RETRY")
   try{$proc.Kill()}catch{};$proc.WaitForExit()
  }
  if($script:currentPhase -ceq 'APPLY' -and $proc.HasExited){$script:probeClosed=$true}
  $proc.Dispose()
 }
}
function Compile([hashtable]$inputValue) {
 Verify-Inputs
 $result=Run-Child $node @((Join-Path $source 'scripts\desktop-empty\sales-apply-compiler.mjs')) ($inputValue | ConvertTo-Json -Compress -Depth 5) 3000000
 if($result.code -ne 0 -or $result.err.Trim()){throw 'COMPILER_FAILED'}
 return $result.out | ConvertFrom-Json -AsHashtable -DateKind String
}
function Sql([string]$text) {
 return Run-Child $sqlcmd @('-S',"lpc:$server",'-d',$db,'-E','-b','-r1','-X1','-x','-l','10','-W','-h','-1','-w','65535','-f','65001') ($text+"`nGO`n") 8192
}
function Write-New([string]$file,[object]$row) {
 $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try {$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($row|ConvertTo-Json -Compress -Depth 6)+"`n");$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)} finally {$stream.Dispose()}
}
$applyAttempt=Join-Path $root "desktop-empty-$envId.apply45.attempt.json"
$applyAttemptHash='6E90BD644E24980D1E74B771EABF84A803621AD05382B7208A905808AA81BCE0'
$applyEvents=Join-Path $root "desktop-empty-$envId.apply45.events.jsonl"
$applyEventsHash='3312D1157CFAC42D5262E4491B44E0BD97055C00156CF24DAC4421AEDB69A634'
$verificationAttempt=Join-Path $root "desktop-empty-$envId.apply45.verify.attempt.json"
$verificationOutcome=Join-Path $root "desktop-empty-$envId.apply45.verify.outcome.json"
$applyAttemptId='13a99cab-b4d0-4fae-a0b4-90446eed69c9'
$expectedReadbackSha='914df934b6704a183d7430e42712e0009a0d86c859f4369125cf98e4098afa89'
$applyPid=25280
$previousReadbackPid=36412
$owner=$null
$dispatched=$false
try {
 if($PSVersionTable.PSVersion -lt [version]'7.5'){throw 'HOST_REJECTED'}
 $part=[IO.Path]::GetPathRoot($root)
 foreach($name in $root.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'ROOT_REJECTED'}}
 if(Test-Path -LiteralPath $lock){$entry=Get-Item -LiteralPath $lock -Force;if($entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'LOCK_REJECTED'}}
 $owner=[IO.File]::Open($lock,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 Verify-Inputs
 Verify-File $oldAttempt $oldAttemptHash
 Verify-File $priorResolution $priorResolutionHash
 Verify-File $rollbackAttempt $rollbackAttemptHash
 Verify-File $rollbackOutcome $rollbackOutcomeHash
 Verify-File $applyAttempt $applyAttemptHash
 Verify-File $applyEvents $applyEventsHash
 $prior=Get-Content -Raw -LiteralPath $applyAttempt | ConvertFrom-Json -AsHashtable -DateKind String
 $history=@(Get-Content -LiteralPath $applyEvents | ForEach-Object {$_|ConvertFrom-Json -AsHashtable -DateKind String})
 $expectedStages=@('ATTEMPT_CREATED','APPLY_PROCESS_STARTED','APPLY_STDIN_SENT','APPLY_PROCESS_CLOSED','READBACK_PROCESS_STARTED','READBACK_PROCESS_CLOSED','STOPPED','SESSION_CLEAR')
 if($prior.state -cne 'UNKNOWN' -or $prior.attemptId -cne $applyAttemptId -or $prior.server -cne $server -or $prior.database -cne $db -or
  $prior.originalSha256 -cne $original -or $prior.environmentId -cne $envId -or $prior.rollbackOutcomeHash -cne $rollbackOutcomeHash -or
  $history.Count -ne $expectedStages.Count -or (($history | ForEach-Object {$_.stage}) -join '|') -cne ($expectedStages -join '|') -or
  $history[0].attemptId -cne $applyAttemptId -or $history[1].childPid -ne $applyPid -or $history[2].childPid -ne $applyPid -or
  $history[3].childPid -ne $applyPid -or $history[3].exitCode -ne 0 -or $history[4].childPid -ne $previousReadbackPid -or
  $history[5].childPid -ne $previousReadbackPid -or $history[5].exitCode -ne 1 -or $history[6].failureCode -cne 'READBACK_UNKNOWN' -or
  $history[7].childPid -ne $applyPid){throw 'APPLY_EVIDENCE_REJECTED'}
 if(Test-Path -LiteralPath $verificationOutcome){
  $item=Get-Item -LiteralPath $verificationOutcome -Force
  if($item.PSIsContainer -or $item.Length -gt 4096 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'OUTCOME_REJECTED'}
  $attemptItem=Get-Item -LiteralPath $verificationAttempt -Force
  if($attemptItem.PSIsContainer -or $attemptItem.Length -gt 4096 -or ($attemptItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'OUTCOME_REJECTED'}
  $receipt=Get-Content -Raw -LiteralPath $verificationAttempt|ConvertFrom-Json -AsHashtable -DateKind String
  $existing=Get-Content -Raw -LiteralPath $verificationOutcome|ConvertFrom-Json -AsHashtable -DateKind String
  if($receipt.state -cne 'UNKNOWN' -or $receipt.applyAttemptId -cne $applyAttemptId -or $receipt.applyAttemptHash -cne $applyAttemptHash -or
   $receipt.applyEventsHash -cne $applyEventsHash -or $receipt.readbackSha256 -cne $expectedReadbackSha){throw 'OUTCOME_REJECTED'}
  if($existing.state -cne 'CONFIRMED_SCHEMA_COMMIT' -or $existing.applyAttemptId -cne $applyAttemptId -or $existing.applyAttemptHash -cne $applyAttemptHash -or
   $existing.applyEventsHash -cne $applyEventsHash -or $existing.applySqlSha256 -cne $original -or $existing.readbackSha256 -cne $expectedReadbackSha -or
   $existing.identity.databaseId -ne $prior.identity.databaseId -or $existing.identity.databaseGuid -cne $prior.identity.databaseGuid -or
   $existing.identity.databaseCreateDate -cne $prior.identity.databaseCreateDate -or $existing.identity.serverProcessId -ne $prior.identity.serverProcessId){throw 'OUTCOME_REJECTED'}
  [Console]::WriteLine('CONFIRMED_SCHEMA_COMMIT; EXISTING_VERIFICATION; ERP acceptance remains unverified')
  return
 }
 if(Test-Path -LiteralPath $verificationAttempt){throw 'VERIFICATION_ALREADY_STARTED'}
 foreach($p in @($applyPid,$previousReadbackPid)){if(@(Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction Stop).Count -ne 0){throw 'PREVIOUS_PROCESS_PRESENT'}}
 $identity=@{}+$prior.identity;$identity.applyProcessId=$applyPid
 $compiled=Compile @{mode='applied';identity=$identity}
 if($compiled.applySqlSha256 -cne $original -or $compiled.sqlSha256 -cne $expectedReadbackSha -or
  (HashText $compiled.sql) -cne $expectedReadbackSha -or $compiled.expectedResult -cne 'DESKTOP_APPLY_READBACK_VERIFIED'){throw 'READBACK_REJECTED'}
 $guard=@"
SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id=$previousReadbackPid)
 THROW 51995,'PREVIOUS_READBACK_SESSION_ACTIVE',1;
"@
 Write-New $verificationAttempt @{version=1;state='UNKNOWN';applyAttemptId=$applyAttemptId;applyAttemptHash=$applyAttemptHash;applyEventsHash=$applyEventsHash;readbackSha256=$expectedReadbackSha;recordedAt=[DateTime]::UtcNow.ToString('o')}
 $dispatched=$true
 $script:currentPhase='READBACK'
 $observed=Sql ($guard+"`n"+$compiled.sql)
 if($observed.code -ne 0 -or $observed.err.Trim() -or $observed.out.Trim() -cne 'DESKTOP_APPLY_READBACK_VERIFIED'){throw 'READBACK_UNKNOWN'}
 foreach($p in @($applyPid,$previousReadbackPid,$observed.pid)){if(@(Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction Stop).Count -ne 0){throw 'PROCESS_PRESENT_AFTER_READBACK'}}
 Write-New $verificationOutcome @{version=1;state='CONFIRMED_SCHEMA_COMMIT';applyAttemptId=$applyAttemptId;applyAttemptHash=$applyAttemptHash;applyEventsHash=$applyEventsHash;applySqlSha256=$original;readbackSha256=$expectedReadbackSha;identity=$prior.identity;applyPid=$applyPid;verificationPid=$observed.pid;previousProbe51990='UNKNOWN';completeFoundationMetadataVerified=$false;fullApplicationAcceptance=$false;recordedAt=[DateTime]::UtcNow.ToString('o')}
 [Console]::WriteLine('CONFIRMED_SCHEMA_COMMIT; business workflows and ERP acceptance remain unverified')
} catch {
 if($dispatched){
  [Console]::Error.WriteLine("OWNER_HELD_UNKNOWN PID=$($script:lastChildPid); READBACK_SESSION_NOT_RESOLVED; NO_RETRY")
  while($true){Start-Sleep -Seconds 30}
 }
 [Console]::Error.WriteLine('VERIFICATION_UNKNOWN_OR_NOT_STARTED; NO_AUTOMATIC_RETRY')
 exit 1
} finally {if($null -ne $owner){$owner.Dispose()}}
