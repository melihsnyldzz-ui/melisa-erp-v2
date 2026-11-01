param([Parameter(Mandatory)][int]$ClientPid,[Parameter(Mandatory)][string]$TempRoot,[Parameter(Mandatory)][string]$Nonce,[Parameter(Mandatory)][string]$ClientSha256,[Parameter(Mandatory)][string]$ObserverSha256,[Parameter(Mandatory)][string]$AuditRoot,[Parameter(Mandatory)][string]$AuditNonce)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Query-only readback of one disposable client. No stdin or control operation.
function Get-PtyClientReadbackHash([byte[]]$Bytes){$sha=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Assert-PtyClientReadbackPlain([string]$Path){for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if(([IO.File]::GetAttributes($p)-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'PTY_CLIENT_READBACK_REPARSE'}}}
function Assert-PtyClientReadbackScope {
 if($PSVersionTable.PSEdition-cne'Desktop'-or$ClientPid-le0-or$Nonce-cnotmatch'\A[a-f0-9]{32}\z'-or$AuditNonce-cnotmatch'\A[a-f0-9]{32}\z'-or$Nonce-ceq$AuditNonce-or$ClientSha256-cnotmatch'\A[a-f0-9]{64}\z'-or$ObserverSha256-cne'3fd25e800e1359336b178a62d57d278831663915d21f33d0a31973eac048f791'){throw 'PTY_CLIENT_READBACK_ARGUMENTS'}
 $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
 foreach($pair in @(@($TempRoot,$Nonce),@($AuditRoot,$AuditNonce))){$root=[IO.Path]::GetFullPath($pair[0]);if($root-cne$pair[0]-or![string]::Equals([IO.Path]::GetDirectoryName($root),$temp,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($root)-cne('b6-pty-fixture-'+$pair[1])-or$root.StartsWith('C:\Sirket\ERP',[StringComparison]::OrdinalIgnoreCase)){throw 'PTY_CLIENT_READBACK_TEMP_SCOPE'};Assert-PtyClientReadbackPlain $root}
 if($AuditRoot-ceq$TempRoot-or$PSCommandPath-cne(Join-Path $AuditRoot 'business-5244-pty-client-readback.ps1')){throw 'PTY_CLIENT_READBACK_FIXED_ENTRY'}
 $exe=[Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
 if($exe-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'){throw 'PTY_CLIENT_READBACK_PS5_REQUIRED'}
 $argv=[Environment]::GetCommandLineArgs();$file=@(for($i=0;$i-lt$argv.Length;$i++){if($argv[$i]-ceq'-File'){$i}})
 if($file.Count-ne1-or$file[0]+1-ge$argv.Length-or$argv[$file[0]+1]-cne$PSCommandPath-or@($argv|Where-Object{$_-cin@('-Command','-EncodedCommand','-c','-enc','-CommandWithArgs')}).Count){throw 'PTY_CLIENT_READBACK_FILE_CALLER'}
}
function Hold-PtyClientReadbackSource([string]$Leaf,[string]$ExpectedHash=''){
 if($Leaf-cnotin@('business-5244-pty-client-readback.ps1','business-5244-pty-client-observer.cs')){throw 'PTY_CLIENT_READBACK_SOURCE_LEAF'}
 $path=Join-Path $AuditRoot $Leaf;Assert-PtyClientReadbackPlain $path;$f=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{if($f.Length-le0-or$f.Length-gt262144){throw 'PTY_CLIENT_READBACK_SOURCE_SIZE'};$memory=[IO.MemoryStream]::new();try{$f.CopyTo($memory);$bytes=$memory.ToArray()}finally{$memory.Dispose();$f.Position=0};$actual=Get-PtyClientReadbackHash $bytes;if($ExpectedHash-and$actual-cne$ExpectedHash){throw 'PTY_CLIENT_READBACK_SOURCE_HASH'};Assert-PtyClientReadbackPlain $path;$script:PtyClientReadbackHolds.Add($f);return $actual}catch{$f.Dispose();throw}
}
function Write-PtyClientReadbackRecord([ValidateSet('once','admission','result')][string]$Kind,$Value){
 Assert-PtyClientReadbackPlain $AuditRoot;$leaf='cleanup-'+$ClientPid+'-'+$Kind+'.json';$path=Join-Path $AuditRoot $leaf
 $f=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 6 -Compress));$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()}
}
function Get-PtyClientReadbackSafeCode($Failure){$e=$Failure.Exception;for($i=0;$i-lt4-and$e;$i++){if([string]$e.Message-cmatch'\APTY_CLIENT_[A-Z0-9_]{1,90}\z'){return [string]$e.Message};$e=$e.InnerException};return 'PTY_CLIENT_READBACK_UNKNOWN_FAILURE'}
function Get-PtyClientReadbackErrorTypes($Failure){$types=@('System.Management.Automation.MethodInvocationException','System.Management.Automation.RuntimeException','System.InvalidOperationException','System.IO.IOException','System.UnauthorizedAccessException','System.ComponentModel.Win32Exception','System.ArgumentException','System.ObjectDisposedException');$result=[Collections.Generic.List[string]]::new();$e=$Failure.Exception;for($i=0;$i-lt4-and$e;$i++){$name=$e.GetType().FullName;$result.Add($(if($name-cin$types){$name}else{'OTHER'}));$e=$e.InnerException};return ,$result.ToArray()}
$script:PtyClientReadbackHolds=[Collections.Generic.List[IO.FileStream]]::new();$observer=$null;$claimed=$false;$receipt=$null;$failure=$null;$ok=$false
try{
 foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
 Assert-PtyClientReadbackScope
 $helperHash=Hold-PtyClientReadbackSource 'business-5244-pty-client-readback.ps1'
 [void](Hold-PtyClientReadbackSource 'business-5244-pty-client-observer.cs' $ObserverSha256)
 foreach($kind in @('admission','result')){if(Test-Path -LiteralPath (Join-Path $AuditRoot ('cleanup-'+$ClientPid+'-'+$kind+'.json'))){throw 'PTY_CLIENT_READBACK_EXISTING_RECEIPT'}}
 $selfBirth=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToFileTimeUtc().ToString([Globalization.CultureInfo]::InvariantCulture)
 Write-PtyClientReadbackRecord once ([ordered]@{schema='melisa-b6-pty-client-readback-once.v1';clientPid=$ClientPid;fixtureRoot=$TempRoot;nonce=$Nonce;auditRoot=$AuditRoot;auditNonce=$AuditNonce;observerPid=$PID;observerBirth=$selfBirth;helperSourceSha256=$helperHash;observerSourceSha256=$ObserverSha256;clientSourceSha256=$ClientSha256;observedUtc=[DateTime]::UtcNow.ToString('o')})
 $claimed=$true
 $receipt=[ordered]@{schema='melisa-b6-pty-client-readback-result.v1';status='UNKNOWN';code=$null;exceptionTypes=@();clientPid=$ClientPid;clientBirth=$null;clientExe=$null;fixtureRoot=$TempRoot;nonce=$Nonce;auditRoot=$AuditRoot;auditNonce=$AuditNonce;observerPid=$PID;observerBirth=$selfBirth;helperSourceSha256=$helperHash;observerSourceSha256=$ObserverSha256;clientSourceSha256=$ClientSha256;originalBirthKnown=$false;captureVerified=$false;exitObserved=$false;nativeExitCode=$null;waitMilliseconds=60000;observedUtc=$null;qpc=$null;frequency=[Diagnostics.Stopwatch]::Frequency;controlCalls=0;runtimeGo=$false}
 if('Business5244PtyClientObserver'-as[type]){throw 'PTY_CLIENT_READBACK_NATIVE_PRELOADED'}
 Add-Type -LiteralPath (Join-Path $AuditRoot 'business-5244-pty-client-observer.cs')
 $observer=[Business5244PtyClientObserver]::CaptureKnownClient($ClientPid,$TempRoot,$Nonce,$ClientSha256);$observer.ValidateLive()
 if($observer.Pid-ne$ClientPid-or$observer.FixtureRoot-cne$TempRoot-or$observer.Nonce-cne$Nonce-or$observer.SourceSha256-cne$ClientSha256-or$observer.OriginalBirthKnown-isnot[bool]-or$observer.OriginalBirthKnown){throw 'PTY_CLIENT_READBACK_CAPTURE_BINDING'}
 $receipt.clientBirth=$observer.Birth;$receipt.clientExe=$observer.Exe;$receipt.captureVerified=$true
 $admission=[ordered]@{schema='melisa-b6-pty-client-readback-admission.v1';clientPid=$observer.Pid;nativeBirth=$observer.Birth;exe=$observer.Exe;fixtureRoot=$observer.FixtureRoot;nonce=$observer.Nonce;clientSourceSha256=$observer.SourceSha256;originalBirthKnown=$false;auditRoot=$AuditRoot;auditNonce=$AuditNonce;observerPid=$PID;observerBirth=$selfBirth;observerSourceSha256=$ObserverSha256;helperSourceSha256=$helperHash;observedUtc=[DateTime]::UtcNow.ToString('o');qpc=[Diagnostics.Stopwatch]::GetTimestamp();frequency=[Diagnostics.Stopwatch]::Frequency;readOnly=$true;controlCalls=0;runtimeGo=$false}
 Write-PtyClientReadbackRecord admission $admission;[Console]::WriteLine(($admission|ConvertTo-Json -Depth 5 -Compress));[Console]::Out.Flush()
 if($observer.WaitForExit(60000)){$receipt.exitObserved=$true;$receipt.nativeExitCode=$observer.ExitCode;$receipt.status='EXIT_OBSERVED';$ok=$true}else{$receipt.code='PTY_CLIENT_READBACK_EXIT_NOT_OBSERVED'}
}catch{$failure=$_;$ok=$false;if($receipt){$receipt.code=Get-PtyClientReadbackSafeCode $_;$receipt.exceptionTypes=Get-PtyClientReadbackErrorTypes $_};[Console]::Error.WriteLine((Get-PtyClientReadbackSafeCode $_));[Console]::Error.Flush()}finally{
 try{if($observer){$observer.Dispose()}}catch{$failure=$_;$ok=$false;if($receipt){$receipt.status='UNKNOWN';$receipt.code=Get-PtyClientReadbackSafeCode $_;$receipt.exceptionTypes=Get-PtyClientReadbackErrorTypes $_}}
 try{if($claimed-and$receipt){$receipt.observedUtc=[DateTime]::UtcNow.ToString('o');$receipt.qpc=[Diagnostics.Stopwatch]::GetTimestamp();Write-PtyClientReadbackRecord result $receipt;[Console]::WriteLine(($receipt|ConvertTo-Json -Depth 6 -Compress));[Console]::Out.Flush()}}finally{foreach($held in $script:PtyClientReadbackHolds){$held.Dispose()}}
}
if(!$ok){exit 1}
