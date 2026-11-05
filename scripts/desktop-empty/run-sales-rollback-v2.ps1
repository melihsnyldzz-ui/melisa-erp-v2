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
$priorProbePid=40048 # Independently observed in the existing trace; not 51990 proof.
$attempt=Join-Path $root "desktop-empty-$envId.rollback45-v2.attempt.json"
$events=Join-Path $root "desktop-empty-$envId.rollback45-v2.events.jsonl"
$outcome=Join-Path $root "desktop-empty-$envId.rollback45-v2.outcome.json"
$blocked=@('attempt.json','outcome.json','rollback-probe.attempt.json','rollback45.outcome.json','rollback45.prior-resolution.json','rollback45-v2.attempt.json','rollback45-v2.events.jsonl','rollback45-v2.outcome.json') | ForEach-Object { Join-Path $root "desktop-empty-$envId.$_" }
$script:probeJournalActive=$false
$script:currentPhase='PRE_ATTEMPT'
$script:failureCode='UNCLASSIFIED'
$script:lastChildPid=0
$script:probeStarted=$false
$script:probeClosed=$false
$script:probePid=0
function Record-Stage([string]$stage,[int]$childPid=0,[int]$exitCode=0,[int]$sqlError=0,[string]$failureCode='NONE') {
 if(-not $script:probeJournalActive){return}
 $allowed=@('ATTEMPT_CREATED','PROBE_PROCESS_STARTED','PROBE_STDIN_SENT','PROBE_PROCESS_CLOSED','READBACK_PROCESS_STARTED','READBACK_PROCESS_CLOSED','READBACK_VERIFIED','STOPPED','SESSION_CLEAR','OWNER_HELD_UNKNOWN')
 $codes=@('NONE','PROBE_UNKNOWN','READBACK_UNKNOWN','READBACK_COMPILER_REJECTED','CHILD_INPUT_TIMEOUT','CHILD_TIMEOUT','CHILD_OUTPUT_LIMIT','CHILD_NOT_STARTED','EXTERNAL_FAILURE')
 if($stage -cnotin $allowed -or $childPid -lt 0 -or $sqlError -notin @(0,51990,51994,51995) -or $failureCode -cnotin $codes){throw 'STAGE_REJECTED'}
 $record=@{stage=$stage;phase=$script:currentPhase;childPid=$childPid;exitCode=$exitCode;sqlError=$sqlError;failureCode=$failureCode;time=[DateTime]::UtcNow.ToString('o')}
 $stream=[IO.File]::Open($events,[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($record|ConvertTo-Json -Compress)+"`n");$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
$pins=@{
 'scripts/desktop-empty/sales-probe-compiler.mjs'='35647B81C3F3FD4DDCC9B27ECCBBACE8CDD428C9A22EC6F5819D8CB63BF84A92'
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
 if($script:currentPhase -ceq 'PROBE'){$script:probeStarted=$true;$script:probePid=$pidValue}
 try {
  if($script:currentPhase -cin @('PROBE','READBACK')){$script:lastChildPid=$pidValue}
  if($script:currentPhase -ceq 'PROBE'){Record-Stage 'PROBE_PROCESS_STARTED' $pidValue}
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
   if($script:currentPhase -ceq 'PROBE'){Record-Stage 'PROBE_STDIN_SENT' $pidValue}
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
  if($script:currentPhase -ceq 'PROBE'){Record-Stage 'PROBE_PROCESS_CLOSED' $pidValue $proc.ExitCode $sqlError}
  if($script:currentPhase -ceq 'READBACK'){Record-Stage 'READBACK_PROCESS_CLOSED' $pidValue $proc.ExitCode $sqlError}
  return @{pid=$pidValue;code=$proc.ExitCode;out=$stdout;err=$stderr}
 } finally {
  if(-not $proc.HasExited){
   [Console]::Error.WriteLine("UNKNOWN_CHILD_WAIT PID=$pidValue; OWNER_LOCK_HELD; SESSION_NOT_YET_RESOLVED; NO_RETRY")
   try{$proc.Kill()}catch{};$proc.WaitForExit()
  }
  if($script:currentPhase -ceq 'PROBE' -and $proc.HasExited){$script:probeClosed=$true}
  $proc.Dispose()
 }
}
function Compile([hashtable]$inputValue) {
 Verify-Inputs
 $result=Run-Child $node @((Join-Path $source 'scripts\desktop-empty\sales-probe-compiler.mjs')) ($inputValue | ConvertTo-Json -Compress -Depth 5) 3000000
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
$owner=$null
try {
 if($PSVersionTable.PSVersion -lt [version]'7.5'){throw 'HOST_REJECTED'}
 $part=[IO.Path]::GetPathRoot($root)
 foreach($name in $root.Substring($part.Length).Split('\')){$part=Join-Path $part $name;if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'ROOT_REJECTED'}}
 if(Test-Path -LiteralPath $lock){$entry=Get-Item -LiteralPath $lock -Force;if($entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'LOCK_REJECTED'}}
 $owner=[IO.File]::Open($lock,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 foreach($file in $blocked){if(Test-Path -LiteralPath $file){throw 'PREVIOUS_ATTEMPT'}}
 Verify-File $oldAttempt $oldAttemptHash
 $prior=Get-Content -Raw -LiteralPath $oldAttempt | ConvertFrom-Json -AsHashtable -DateKind String
 if($prior.state -cne 'UNKNOWN' -or $prior.environmentId -cne $envId -or $prior.database -cne $db -or $prior.server -cne $server){throw 'PRIOR_ATTEMPT_REJECTED'}
 Verify-Inputs
 $probe=Compile @{mode='probe'}
 if($probe.server -cne $server -or $probe.database -cne $db -or $probe.environmentId -cne $envId -or $probe.originalSha256 -cne $original -or $probe.batchCount -ne 45 -or (HashText $probe.sql) -cne $probe.probeSha256){throw 'PROBE_REJECTED'}
 $preflight=@"
SET NOCOUNT ON;
IF CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'$server')
 OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'$db') OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1
 OR SUSER_SID() IS NULL OR SUSER_SID(N'SEMIH\Xaser') IS NULL OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\Xaser')
 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_connections WHERE session_id=@@SPID AND net_transport=N'Shared memory')
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_locks WHERE resource_database_id=DB_ID() AND request_session_id>0 AND request_session_id<>@@SPID)
 THROW 51995,'ROLLBACK45_PREFLIGHT_REJECTED',1;
SELECT DB_ID() AS databaseId,CONVERT(varchar(19),d.create_date,126)+'.'+RIGHT('000'+CONVERT(varchar(3),DATEPART(millisecond,d.create_date)),3) AS databaseCreateDate,
 LOWER(CONVERT(varchar(36),r.database_guid)) AS databaseGuid,CONVERT(int,SERVERPROPERTY('ProcessID')) AS serverProcessId
 FROM sys.databases d JOIN sys.database_recovery_status r ON r.database_id=d.database_id WHERE d.database_id=DB_ID() FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
"@
 $before=Sql $preflight
 if($before.code -ne 0 -or $before.err.Trim()){throw 'PREFLIGHT_FAILED'}
 $id=$before.out.Trim()|ConvertFrom-Json -AsHashtable -DateKind String
 if($id.databaseId -ne $prior.identity.databaseId -or $id.databaseGuid -cne $prior.identity.databaseGuid -or $id.databaseCreateDate -cne $prior.identity.databaseCreateDate -or $id.serverProcessId -ne $prior.identity.serverProcessId){throw 'PRIOR_IDENTITY_CHANGED'}
 # Resolve the earlier unknown effect using a new read-only session, never by
 # assuming an error number or changing its journal. PID existence is checked
 # before and after readback; a reused PID also stops this controlled attempt.
 if(@(Get-CimInstance Win32_Process -Filter "ProcessId=$priorProbePid" -ErrorAction Stop).Count -ne 0){throw 'PRIOR_PROCESS_PRESENT'}
 $validation=@{}+ $id;$validation.probeProcessId=$priorProbePid
 $priorCheck=Compile @{mode='readback';identity=$validation}
 if($priorCheck.originalSha256 -cne $original -or $priorCheck.probeSha256 -cne $probe.probeSha256 -or (HashText $priorCheck.sql) -cne $priorCheck.sqlSha256){throw 'PRIOR_READBACK_REJECTED'}
 $priorGuard=@"
SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_locks WHERE resource_database_id=DB_ID() AND request_session_id>0 AND request_session_id<>@@SPID)
 THROW 51995,'PRIOR_OTHER_SESSION_REJECTED',1;
"@
 $priorResult=Sql ($priorGuard+"`n"+$priorCheck.sql)
 if($priorResult.code -ne 0 -or $priorResult.err.Trim() -or $priorResult.out.Trim() -cne 'DESKTOP_ROLLBACK_READBACK_EMPTY'){throw 'PRIOR_READBACK_REJECTED'}
 if(@(Get-CimInstance Win32_Process -Filter "ProcessId=$priorProbePid" -ErrorAction Stop).Count -ne 0){throw 'PRIOR_PROCESS_PRESENT'}
 foreach($file in $blocked){if(Test-Path -LiteralPath $file){throw 'PREVIOUS_ATTEMPT'}}
 Verify-File $oldAttempt $oldAttemptHash
 Write-New $priorResolution @{version=1;state='PRIOR_EFFECT_ABSENT';scope='USER_OBJECTS_PRINCIPALS_PERMISSIONS_AND_ACTIVE_TRANSACTIONS';autoStatisticsNotExcluded=$true;priorProbe51990='UNKNOWN';priorAttemptHash=$oldAttemptHash;identity=$id;priorProbePid=$priorProbePid;readbackSha256=$priorCheck.sqlSha256;recordedAt=[DateTime]::UtcNow.ToString('o')}
 $attemptId=[guid]::NewGuid().ToString()
 Write-New $attempt @{version=1;state='UNKNOWN';attemptId=$attemptId;server=$server;database=$db;environmentId=$envId;originalSha256=$original;probeSha256=$probe.probeSha256;identity=$id;createdAt=[DateTime]::UtcNow.ToString('o')}
 Write-New $events @{stage='ATTEMPT_CREATED';attemptId=$attemptId;priorAttemptHash=$oldAttemptHash;time=[DateTime]::UtcNow.ToString('o')}
 $script:probeJournalActive=$true
 $guard=@"
SET NOCOUNT ON;
IF CONVERT(int,SERVERPROPERTY('ProcessID'))<>$($id.serverProcessId) OR DB_ID()<>$($id.databaseId)
 OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=DB_ID() AND CONVERT(varchar(19),create_date,126)+'.'+RIGHT('000'+CONVERT(varchar(3),DATEPART(millisecond,create_date)),3)='$($id.databaseCreateDate)')
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid=CONVERT(uniqueidentifier,'$($id.databaseGuid)'))
 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_connections WHERE session_id=@@SPID AND net_transport=N'Shared memory')
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_locks WHERE resource_database_id=DB_ID() AND request_session_id>0 AND request_session_id<>@@SPID)
 THROW 51995,'ROLLBACK45_TARGET_REJECTED',1;
"@
 $script:currentPhase='PROBE'
 $result=Sql ($guard+"`n"+$probe.sql)
 if($result.code -eq 0 -or -not $result.err.Contains('51990') -or -not $result.err.Contains('DESKTOP_SALES_ROLLBACK_PROBE_REACHED')){throw 'PROBE_UNKNOWN'}
 $identity=@{}+$id;$identity.probeProcessId=$result.pid
 $script:currentPhase='READBACK_COMPILE'
 $readback=Compile @{mode='readback';identity=$identity}
 if($readback.originalSha256 -cne $original -or $readback.probeSha256 -cne $probe.probeSha256 -or (HashText $readback.sql) -cne $readback.sqlSha256){throw 'READBACK_COMPILER_REJECTED'}
 $script:currentPhase='READBACK'
 $check=Sql $readback.sql
 if($check.code -ne 0 -or $check.err.Trim() -or $check.out.Trim() -cne 'DESKTOP_ROLLBACK_READBACK_EMPTY'){throw 'READBACK_UNKNOWN'}
 Record-Stage 'READBACK_VERIFIED' $check.pid
 Write-New $outcome @{version=1;state='CONFIRMED_ROLLBACK';attemptId=$attemptId;identity=$id;probePid=$result.pid;probeSha256=$probe.probeSha256;readbackSha256=$readback.sqlSha256;recordedAt=[DateTime]::UtcNow.ToString('o')}
 [Console]::WriteLine('CONFIRMED_ROLLBACK; schema test only; ERP is not installed')
} catch {
 if($script:probeJournalActive){
  $known=@('PROBE_UNKNOWN','READBACK_UNKNOWN','READBACK_COMPILER_REJECTED','CHILD_INPUT_TIMEOUT','CHILD_TIMEOUT','CHILD_OUTPUT_LIMIT','CHILD_NOT_STARTED')
  $safe='EXTERNAL_FAILURE';if($_.Exception.Message -cin $known){$safe=$_.Exception.Message}
  try{Record-Stage 'STOPPED' $script:lastChildPid 0 0 $safe}catch{}
 }
 if($script:probeStarted){
  $sessionClear=$false
  if($script:probeClosed -and $script:probePid -gt 0 -and $null -ne $id){
   try{
    $script:currentPhase='SESSION_CHECK'
    $sessionSql=@"
SET NOCOUNT ON;
IF CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'$server')
 OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'$db')
 OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>$($id.serverProcessId) OR DB_ID()<>$($id.databaseId)
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(N'SEMIH\Xaser') IS NULL
 OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\Xaser')
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid=CONVERT(uniqueidentifier,'$($id.databaseGuid)'))
 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_connections WHERE session_id=@@SPID AND net_transport=N'Shared memory')
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id=$($script:probePid))
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_locks WHERE resource_database_id=DB_ID() AND request_session_id>0 AND request_session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_database_transactions dt WHERE dt.database_id=DB_ID() AND NOT EXISTS(SELECT 1 FROM sys.dm_tran_session_transactions st WHERE st.transaction_id=dt.transaction_id AND st.session_id=@@SPID))
 THROW 51995,'SESSION_NOT_RESOLVED',1;
SELECT N'DESKTOP_SESSION_CLEAR';
"@
    $sessionResult=Sql $sessionSql
    $sessionClear=$sessionResult.code -eq 0 -and -not $sessionResult.err.Trim() -and $sessionResult.out.Trim() -ceq 'DESKTOP_SESSION_CLEAR'
   }catch{$sessionClear=$false}
  }
  if($sessionClear){try{Record-Stage 'SESSION_CLEAR' $script:probePid}catch{}}
  else{
   try{Record-Stage 'OWNER_HELD_UNKNOWN' $script:probePid}catch{}
   [Console]::Error.WriteLine("OWNER_HELD_UNKNOWN PID=$($script:probePid); SESSION_NOT_RESOLVED; NO_RETRY")
   while($true){Start-Sleep -Seconds 30}
  }
 }
 [Console]::Error.WriteLine('UNKNOWN_OR_NOT_STARTED; NO_AUTOMATIC_RETRY')
 exit 1
} finally {if($null -ne $owner){$owner.Dispose()}}
