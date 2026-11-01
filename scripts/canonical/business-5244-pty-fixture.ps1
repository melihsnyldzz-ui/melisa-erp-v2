param([Parameter(Mandatory)][ValidateSet('Owner','Controller','Witness')][string]$Mode,[Parameter(Mandatory)][string]$TempRoot,[Parameter(Mandatory)][string]$Nonce,[Parameter(Mandatory)][string]$SourceSha256,[Parameter(Mandatory)][string]$NativeSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Disposable own-temp fixture only. No production entry/library is imported.
function Get-PtyFixtureHash([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Assert-PtyFixturePlainPath([string]$Path){for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if(([IO.File]::GetAttributes($p)-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'PTY_FIXTURE_REPARSE'}}}
function Assert-PtyFixtureScope {
 if($PSVersionTable.PSEdition-cne'Desktop'-or$Nonce-cnotmatch'\A[a-f0-9]{32}\z'-or$SourceSha256-cnotmatch'\A[a-f0-9]{64}\z'-or$NativeSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'PTY_FIXTURE_ARGUMENTS'}
 $full=[IO.Path]::GetFullPath($TempRoot);$parent=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
 if($full-cne$TempRoot-or![string]::Equals([IO.Path]::GetDirectoryName($full),$parent,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-cne('b6-pty-fixture-'+$Nonce)-or$full.StartsWith('C:\Sirket\ERP',[StringComparison]::OrdinalIgnoreCase)-or$PSCommandPath-cne(Join-Path $full 'business-5244-pty-fixture.ps1')){throw 'PTY_FIXTURE_TEMP_SCOPE'}
 Assert-PtyFixturePlainPath $full
 if([Management.Automation.Runspaces.Runspace]::DefaultRunspace.Id-ne1){throw 'PTY_FIXTURE_MAIN_RUNSPACE_REQUIRED'}
}
function Hold-PtyFixtureSource([string]$Leaf,[string]$Hash){
 if($Leaf-cnotin@('business-5244-pty-fixture.ps1','business-5244-pty-fixture-native.cs')){throw 'PTY_FIXTURE_SOURCE_LEAF'}
 $path=Join-Path $TempRoot $Leaf;Assert-PtyFixturePlainPath $path;$f=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{if($f.Length-le0-or$f.Length-gt262144){throw 'PTY_FIXTURE_SOURCE_SIZE'};$memory=[IO.MemoryStream]::new();try{$f.CopyTo($memory);$bytes=$memory.ToArray()}finally{$memory.Dispose();$f.Position=0};if((Get-PtyFixtureHash $bytes)-cne$Hash){throw 'PTY_FIXTURE_SOURCE_HASH'};$script:FixtureSourceHolds.Add($f)}catch{$f.Dispose();throw}
}
function Write-PtyFixtureRecord([ValidateSet('owner-ready.json','owner-finally.json','controller-once.json','controller-result.json','witness-ready.json','exit-observed.json','witness-result.json')][string]$Leaf,$Value){
 Assert-PtyFixturePlainPath $TempRoot;$path=Join-Path $TempRoot $Leaf;$bytes=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 6 -Compress))
 $f=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()}
}
function Get-PtyFixtureSafeCode($Failure){
 $e=$Failure.Exception
 for($i=0;$i-lt4-and$e;$i++){if([string]$e.Message-cmatch'\APTY_FIXTURE_[A-Z0-9_]{1,80}\z'){return [string]$e.Message};$e=$e.InnerException}
 return 'PTY_FIXTURE_UNKNOWN_FAILURE'
}
function Invoke-PtyFixtureOwner {
 $mutex=[Threading.Mutex]::new($false,('Local\MelisaERP5244PtyFixture-'+$Nonce));$held=$false;$published=$false
 try{
  try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();throw 'PTY_FIXTURE_OWNER_MUTEX_ABANDONED'}
  if(!$held){throw 'PTY_FIXTURE_OWNER_MUTEX_BUSY'}
  $self=[Diagnostics.Process]::GetCurrentProcess()
  Write-PtyFixtureRecord 'owner-ready.json' ([ordered]@{schema='melisa-b6-pty-fixture-owner-ready.v1';nonce=$Nonce;fixtureRoot=$TempRoot;ownerPid=$PID;ownerBirth=[Business5244PtyFixtureNative]::SelfBirth;exe=$self.MainModule.FileName;sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;runspaceId=1;sourceSha256=$SourceSha256;nativeSha256=$NativeSha256;observedUtc=[DateTime]::UtcNow.ToString('o')})
  $published=$true;$clock=[Diagnostics.Stopwatch]::StartNew()
  # This normal runspace1 loop is the only debug target. It has no child process.
  while($clock.ElapsedMilliseconds-lt180000){[Threading.Thread]::Sleep(100)}
  throw 'PTY_FIXTURE_OWNER_MAX_LIFETIME'
 }finally{
  if($held){$mutex.ReleaseMutex()};$mutex.Dispose()
  if($published){try{Write-PtyFixtureRecord 'owner-finally.json' ([ordered]@{schema='melisa-b6-pty-fixture-owner-finally.v1';nonce=$Nonce;ownerPid=$PID;ownerBirth=[Business5244PtyFixtureNative]::SelfBirth;observedUtc=[DateTime]::UtcNow.ToString('o');mutexReleased=$true;reason='FINALLY_OBSERVED_NOT_DEBUG_QUIT_PROOF'})}catch{}}
 }
}
function Read-PtyFixtureOwnerReady {
 $path=Join-Path $TempRoot 'owner-ready.json';Assert-PtyFixturePlainPath $path;$f=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{if($f.Length-le0-or$f.Length-gt16384){throw 'PTY_FIXTURE_READY_SIZE'};$memory=[IO.MemoryStream]::new();try{$f.CopyTo($memory);$bytes=$memory.ToArray()}finally{$memory.Dispose();$f.Position=0};$r=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json
  if($r.schema-cne'melisa-b6-pty-fixture-owner-ready.v1'-or$r.nonce-cne$Nonce-or$r.fixtureRoot-cne$TempRoot-or$r.ownerPid-isnot[int]-or$r.ownerPid-le0-or$r.ownerBirth-isnot[string]-or$r.ownerBirth-cnotmatch'\A[1-9][0-9]{15,19}\z'-or$r.exe-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or$r.sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$r.runspaceId-isnot[int]-or$r.runspaceId-ne1-or$r.sourceSha256-cne$SourceSha256-or$r.nativeSha256-cne$NativeSha256){throw 'PTY_FIXTURE_READY_IDENTITY'}
  $script:FixtureReadyHold=$f;return $r
 }catch{$f.Dispose();throw}
}
function Invoke-PtyFixtureController {
 $owner=$null;$mutex=$null;$signal=$null;$claimed=$false
 $receipt=[ordered]@{schema='melisa-b6-pty-fixture-result.v1';status='FAILED';code=$null;nonce=$Nonce;fixtureRoot=$TempRoot;ownerPid=$null;ownerBirth=$null;controllerPid=$PID;controllerBirth=[Business5244PtyFixtureNative]::SelfBirth;signalReads=0;ownerExited=$false;ownerExitCode=$null;mutexAcquired=$false;mutexAbandoned=$false;guardMilliseconds=60000;elapsedMilliseconds=$null;startedUtc=$null;finishedUtc=$null;sourceSha256=$SourceSha256;nativeSha256=$NativeSha256;runtimeGo=$false}
 try{
  if(Test-Path -LiteralPath (Join-Path $TempRoot 'controller-result.json')){throw 'PTY_FIXTURE_RESULT_ALREADY_EXISTS'}
  Write-PtyFixtureRecord 'controller-once.json' ([ordered]@{schema='melisa-b6-pty-fixture-controller-once.v1';nonce=$Nonce;controllerPid=$PID;controllerBirth=[Business5244PtyFixtureNative]::SelfBirth;sourceSha256=$SourceSha256;nativeSha256=$NativeSha256;observedUtc=[DateTime]::UtcNow.ToString('o')})
  $claimed=$true
  $ready=Read-PtyFixtureOwnerReady;$receipt.ownerPid=$ready.ownerPid;$receipt.ownerBirth=$ready.ownerBirth
  $owner=[Business5244PtyFixtureNative]::Capture($ready.ownerPid,$ready.ownerBirth,$TempRoot,$Nonce);$owner.ValidateLive()
  $mutex=[Threading.Mutex]::OpenExisting(('Local\MelisaERP5244PtyFixture-'+$Nonce))
  try{$free=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();$receipt.mutexAbandoned=$true;throw 'PTY_FIXTURE_MUTEX_ABANDONED_BEFORE_READY'}
  if($free){$mutex.ReleaseMutex();throw 'PTY_FIXTURE_OWNER_MUTEX_NOT_HELD'}
  # Native code emits the single READY with the actual monotonic guard start.
  $signal=[Business5244PtyFixtureNative]::ReadSignalOnce($owner,$Nonce);$receipt.signalReads=1
  $receipt.startedUtc=$signal.StartedUtc;$receipt.finishedUtc=$signal.FinishedUtc;$receipt.elapsedMilliseconds=$signal.ElapsedMilliseconds
  if($signal.TimedOut){throw 'PTY_FIXTURE_SIGNAL_TIMEOUT'}
  if($signal.FailureCode){throw 'PTY_FIXTURE_SIGNAL_UNKNOWN'}
  if($signal.Value-cne'MANAGED_EXIT_OBSERVED'){throw 'PTY_FIXTURE_SIGNAL_NOT_RECEIVED'}
  $owner.ValidateExited();$receipt.ownerExited=$true;$receipt.ownerExitCode=$owner.ExitCode
  if($receipt.ownerExitCode-ne0){throw 'PTY_FIXTURE_OWNER_EXIT_CODE'}
  try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();$receipt.mutexAbandoned=$true;throw 'PTY_FIXTURE_MUTEX_ABANDONED_AFTER_EXIT'}
  if(!$acquired){throw 'PTY_FIXTURE_MUTEX_NOT_AVAILABLE'}
  try{$receipt.mutexAcquired=$true;$owner.ValidateExited()}finally{$mutex.ReleaseMutex()}
  $now=[DateTime]::UtcNow;$start=[DateTime]::Parse($signal.StartedUtc,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
  $receipt.finishedUtc=$now.ToString('o');$receipt.elapsedMilliseconds=[Math]::Max([double]$signal.ElapsedMilliseconds,($now-$start).TotalMilliseconds)
  if($receipt.elapsedMilliseconds-lt0-or$receipt.elapsedMilliseconds-ge60000-or$now-ge$start.AddMilliseconds(60000)){throw 'PTY_FIXTURE_FINAL_GUARD_EXPIRED'}
  $receipt.status='PASS'
 }catch{$receipt.code=Get-PtyFixtureSafeCode $_;throw}finally{
  try{if($claimed){Write-PtyFixtureRecord 'controller-result.json' $receipt;[Console]::WriteLine(($receipt|ConvertTo-Json -Depth 5 -Compress));[Console]::Out.Flush()}}finally{if($owner){$owner.Dispose()};if($mutex){$mutex.Dispose()};if($script:FixtureReadyHold){$script:FixtureReadyHold.Dispose();$script:FixtureReadyHold=$null}}
 }
}
function Write-PtyFixtureWitnessFailure($Failure,$Ready){
 $types=@('System.Management.Automation.MethodInvocationException','System.Management.Automation.RuntimeException','System.Management.Automation.PipelineStoppedException','System.InvalidOperationException','System.IO.IOException','System.UnauthorizedAccessException','System.ComponentModel.Win32Exception','System.Threading.AbandonedMutexException','System.ObjectDisposedException','System.TimeoutException','System.ArgumentException','System.NullReferenceException')
 $chain=[Collections.Generic.List[string]]::new();$exception=$Failure.Exception
 for($i=0;$i-lt4-and$exception;$i++){$name=$exception.GetType().FullName;$chain.Add($(if($name-cin$types){$name}else{'OTHER'}));$exception=$exception.InnerException}
 Write-PtyFixtureRecord 'witness-result.json' ([ordered]@{schema='melisa-b6-pty-fixture-witness-result.v1';status='FAILED';code=(Get-PtyFixtureSafeCode $Failure);exceptionTypes=@($chain.ToArray());outerType=$(if($chain.Count-gt0){$chain[0]}else{'OTHER'});innerType=$(if($chain.Count-gt1){$chain[1]}else{$null});nonce=$Nonce;fixtureRoot=$TempRoot;witnessPid=$PID;witnessBirth=[Business5244PtyFixtureNative]::SelfBirth;ownerPid=$(if($Ready){$Ready.ownerPid}else{$null});ownerBirth=$(if($Ready){$Ready.ownerBirth}else{$null});observedUtc=[DateTime]::UtcNow.ToString('o');qpc=[Diagnostics.Stopwatch]::GetTimestamp();frequency=[Diagnostics.Stopwatch]::Frequency;runtimeGo=$false})
}
function Invoke-PtyFixtureWitness {
 $owner=$null;$ready=$null;$failure=$null
 try{
  $ready=Read-PtyFixtureOwnerReady
  $owner=[Business5244PtyFixtureNative]::Capture($ready.ownerPid,$ready.ownerBirth,$TempRoot,$Nonce);$owner.ValidateLive()
  $clock=[Diagnostics.Stopwatch]::StartNew()
  Write-PtyFixtureRecord 'witness-ready.json' ([ordered]@{schema='melisa-b6-pty-fixture-witness-ready.v1';nonce=$Nonce;fixtureRoot=$TempRoot;ownerPid=$owner.Pid;ownerBirth=$owner.Birth;witnessPid=$PID;witnessBirth=[Business5244PtyFixtureNative]::SelfBirth;observedUtc=[DateTime]::UtcNow.ToString('o');qpc=[Diagnostics.Stopwatch]::GetTimestamp();frequency=[Diagnostics.Stopwatch]::Frequency;maximumObservationMilliseconds=90000;sourceSha256=$SourceSha256;nativeSha256=$NativeSha256})
  if(!$owner.WaitForExit(90000)){throw 'PTY_FIXTURE_WITNESS_TIMEOUT'}
  $owner.ValidateExited();$exitCode=$owner.ExitCode
  Write-PtyFixtureRecord 'exit-observed.json' ([ordered]@{schema='melisa-b6-pty-fixture-exit-observed.v1';status='EXIT_OBSERVED';nonce=$Nonce;fixtureRoot=$TempRoot;ownerPid=$owner.Pid;ownerBirth=$owner.Birth;witnessPid=$PID;witnessBirth=[Business5244PtyFixtureNative]::SelfBirth;nativeExitCode=$exitCode;observedUtc=[DateTime]::UtcNow.ToString('o');qpc=[Diagnostics.Stopwatch]::GetTimestamp();frequency=[Diagnostics.Stopwatch]::Frequency;elapsedMilliseconds=$clock.Elapsed.TotalMilliseconds;runtimeGo=$false})
 }catch{$failure=$_;Write-PtyFixtureWitnessFailure $_ $ready;throw}finally{
  try{if($owner){$owner.Dispose()}}catch{if(!$failure){Write-PtyFixtureWitnessFailure $_ $ready;throw}}
  if($script:FixtureReadyHold){$script:FixtureReadyHold.Dispose();$script:FixtureReadyHold=$null}
 }
}
$script:FixtureSourceHolds=[Collections.Generic.List[IO.FileStream]]::new();$script:FixtureReadyHold=$null
try{
 foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
 Assert-PtyFixtureScope
 Hold-PtyFixtureSource 'business-5244-pty-fixture.ps1' $SourceSha256;Hold-PtyFixtureSource 'business-5244-pty-fixture-native.cs' $NativeSha256
 if('Business5244PtyFixtureNative'-as[type]){throw 'PTY_FIXTURE_NATIVE_TYPE_PRELOADED'}
 Add-Type -LiteralPath (Join-Path $TempRoot 'business-5244-pty-fixture-native.cs')
 if($Mode-ceq'Owner'){Invoke-PtyFixtureOwner}elseif($Mode-ceq'Controller'){Invoke-PtyFixtureController}else{Invoke-PtyFixtureWitness}
}catch{[Console]::Error.WriteLine((Get-PtyFixtureSafeCode $_));[Console]::Error.Flush();exit 1}finally{foreach($held in $script:FixtureSourceHolds){$held.Dispose()}}
