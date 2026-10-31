param([switch]$Library,[switch]$Apply,[string]$SourceSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Separate exact-marker archive authorization is required before -Apply.
# This is not an installer, creator-token adoption or a stop capability.
function Get-B6RetainedRecoveryCase {
 return @{
  root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-retained-handoff-recovery-20261101'
  beforeRoot='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-pending-web-generation-birth-v2-20261101\owner-preparation'
  marker='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\5244-retirement.pending'
  markerHash='3a036109935e733fa2e6f3cf229677b067ff0ecfdab7f98794fe9b065c718745'
  failureHash='a983c262bf21bb6fb8b0ce95eb386799b622846bb3c3dc1ded78fb0d1ea97dbf'
  before='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-pending-web-generation-20261031\before.json'
  beforeHash='25127ef33de5323af9e7ed6888b2699c5276836fff8d471fdad4c34d43b2dcdc'
  peerRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V6-OWNER-20261030'
  peerManifestHash='253995a17a754cec962746da44f44142a477603437ca478911c07cd5ae33dd09'
  ownerPid=33080;ownerBirth='134379216568450543';childPid=7052;childBirth='134379217109250887';controllerPid=53132;controllerBirth='134379606963542382'
 }
}
function Assert-B6RetainedRecoveryEvidence($Failure,$Marker,$Before){
 $c=Get-B6RetainedRecoveryCase
 if($Failure.status-cne'FAILED_REVIEW_RECEIPT'-or$Failure.failure-cne'B6_ACTIVE_ENTRY_HANDOFF_GATES_RETAINED'-or$null-ne$Failure.outcome-or$Failure.scope-cne'TEST125-API-B6-WRITER-20261029'){throw 'RETAINED_RECOVERY_WRONG_FAILURE'}
 foreach($key in @('stopCalls','startCalls','retireAttempts','taskChanges','apiRestarts','profileWrites','sqlWrites')){if($Failure.$key-ne0){throw 'RETAINED_RECOVERY_EFFECTS_NOT_ZERO'}}
 if($Marker.schema-cne'business-5244-cold-handoff.pending.v1'-or$Marker.controllerPid-ne$c.controllerPid-or$Marker.controllerBirth-cne$c.controllerBirth-or$Marker.ownerPid-ne$c.ownerPid-or$Marker.ownerBirth-cne$c.ownerBirth-or$Marker.operationId-cnotmatch'\A[a-f0-9]{32}\z'-or@($Marker.entries).Count-ne1){throw 'RETAINED_RECOVERY_MARKER_IDENTITY'}
 $entry=@($Before.entries|Where-Object path -CEQ (Join-Path $c.peerRoot 'run-current-owner.ps1'))
 if($entry.Count-ne1-or$Marker.entries[0].path-cne$entry[0].path-or$Marker.entries[0].sha256-cne$entry[0].sha256){throw 'RETAINED_RECOVERY_ENTRY_MISMATCH'}
}
function Get-B6RetainedRecoveryHash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Hold-B6RetainedRecoveryInput([string]$Path,[string]$Hash){
 if($Hash-cnotmatch'\A[a-fA-F0-9]{64}\z'){throw 'RETAINED_RECOVERY_INPUT_PIN_REQUIRED'}
 Assert-B6RetainedRecoveryPlainPath $Path;$s=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{$m=[IO.MemoryStream]::new();try{$s.CopyTo($m);$bytes=$m.ToArray()}finally{$m.Dispose();$s.Position=0};$sha=[Security.Cryptography.SHA256]::Create();try{$actual=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  if($actual-ine$Hash){throw 'RETAINED_RECOVERY_HELD_INPUT_CHANGED'};Assert-B6RetainedRecoveryPlainPath $Path;$script:B6RecoveryHolds.Add($s);return ,$bytes
 }catch{$s.Dispose();throw}
}
function Assert-B6RetainedRecoveryPlainPath([string]$Path){for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'RETAINED_RECOVERY_REPARSE'}}}
function Write-B6RetainedRecoveryNew([string]$Path,$Value){
 $f=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$b=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 12));$f.Write($b,0,$b.Length);$f.Flush($true)}finally{$f.Dispose()}
}
function Assert-B6RetainedRecoveryProtection {
 $c=Get-B6RetainedRecoveryCase;$failure=$script:B6RecoveryInputs.failure
 foreach($f in $failure.before.files){if((Get-B6RetainedRecoveryHash $f.path)-cne$f.hash){throw 'RETAINED_RECOVERY_PROTECTED_FILE_CHANGED'}}
 foreach($p in $failure.before.processes){$actual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$p.pid);$savedBirth=([datetime]$p.birth).ToUniversalTime().ToFileTimeUtc();if(!$actual-or$actual.ExecutablePath-cne$p.exe-or$actual.CreationDate.ToUniversalTime().ToFileTimeUtc()-ne$savedBirth){throw 'RETAINED_RECOVERY_PROTECTED_PROCESS_CHANGED'}}
 $ls=@(Get-NetTCPConnection -State Listen);$ports=@($failure.before.listeners.LocalPort);$pids=@($failure.before.processes.pid)
 $scope=@($ls|Where-Object {$_.LocalPort-in$ports-or$_.OwningProcess-in$pids});$expected=@($failure.before.listeners|ForEach-Object {'{0}|{1}|{2}'-f$_.LocalPort,$_.LocalAddress,$_.OwningProcess}|Sort-Object);$actual=@($scope|ForEach-Object {'{0}|{1}|{2}'-f$_.LocalPort,$_.LocalAddress,$_.OwningProcess}|Sort-Object)
 if(($actual-join';')-cne($expected-join';')){throw 'RETAINED_RECOVERY_LISTENER_CHANGED'}
 $web=@($ls|Where-Object {$_.LocalPort-eq5244-or$_.OwningProcess-in@($c.ownerPid,$c.childPid)})
 if($web.Count-ne3-or@($web|Where-Object {$_.LocalPort-ne5244-or$_.OwningProcess-ne$c.childPid}).Count-or((@($web.LocalAddress|Sort-Object)-join'|')-cne'100.87.188.3|127.0.0.1|192.168.1.46')){throw 'RETAINED_RECOVERY_WEB_LISTENER_CHANGED'}
 $before=$script:B6RecoveryInputs.before
 # These are part of the pinned source baseline, distinct from the CRM and
 # canonical-entry protection snapshot above. Observe the live journal hash;
 # do not deny its legitimate writes by holding a restrictive read handle.
 foreach($f in $before.files){if((Get-B6RetainedRecoveryHash $f.path)-cne$f.sha256){throw 'RETAINED_RECOVERY_BASELINE_FILE_CHANGED'}}
 foreach($entry in $before.entries){if((Get-B6RetainedRecoveryHash $entry.path)-cne$entry.sha256){throw 'RETAINED_RECOVERY_ENTRY_CHANGED'}}
 if((Get-B6RetainedRecoveryHash $before.recordPath)-cne$before.recordSha256){throw 'RETAINED_RECOVERY_RECORD_CHANGED'}
 $svc=New-Object -ComObject 'Schedule.Service';$svc.Connect();$task=$svc.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
 if([string]$task.Xml-cne$script:B6RecoveryInputs.taskXml-or[string]$task.GetSecurityDescriptor(7)-cne$script:B6RecoveryInputs.taskSddl){throw 'RETAINED_RECOVERY_TASK_CHANGED'}
 $instances=$task.GetInstances(0);$capturedTask=$script:B6RecoveryInputs.taskCapture
 if($capturedTask.instanceCount-ne1-or$instances.Count-ne1-or$instances.Item(1).EnginePID-ne$capturedTask.enginePid-or[string]$instances.Item(1).InstanceGuid-cne$capturedTask.instanceGuid){throw 'RETAINED_RECOVERY_TASK_INSTANCE_CHANGED'}
 $capture=$script:B6RecoveryInputs.owner
 $owner=Get-CimInstance Win32_Process -Filter ('ProcessId='+$c.ownerPid);$child=Get-CimInstance Win32_Process -Filter ('ProcessId='+$c.childPid)
 if(!$owner-or!$child-or$child.ParentProcessId-ne$c.ownerPid-or$owner.ExecutablePath-cne$capture.owner.exe-or[string]$owner.CommandLine-cne$capture.owner.argv-or$child.ExecutablePath-cne$capture.child.exe){throw 'RETAINED_RECOVERY_OWNER_CHANGED'}
 $childArgv='"'+$capture.child.exe+'" "C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030\apps\sites-workflow\node_modules\vite\bin\vite.js" preview --host 127.0.0.1 --port 5244 --strictPort'
 if([string]$child.CommandLine-cne$childArgv){throw 'RETAINED_RECOVERY_CHILD_ARGV_CHANGED'}
 foreach($url in @('http://127.0.0.1:5244/ornek-akis.html','http://127.0.0.1:4144/api/health')){if((Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15).StatusCode-ne200){throw 'RETAINED_RECOVERY_HEALTH_FAILED'}}
}
function Invoke-B6RetainedRecoverySequence {
 # All operations are fixed, not a callback or caller-defined target executor.
 Assert-B6RetainedRecoveryProtection
 $c=Get-B6RetainedRecoveryCase
 $connection=Connect-Business5244RetirementPeer;$capability=$null
 try{
  $record=Get-Business5244RetirementRecord $connection -Client
  $capability=$record.peer.OpenRetainedHandoffRecovery()
  $capability.Validate();$identity=$capability.ObservationFileIdentity
  Assert-B6RetainedRecoveryProtection;$capability.Validate()
  $status=Send-Business5244RetirementRequest -Connection $connection -Operation status
  if(!$status.nativePeerVerified-or$status.reply-cne'Status'-or$status.state.phase-cne'Running'-or$status.state.ownerPid-ne$c.ownerPid-or$status.state.ownerBirth-cne$c.ownerBirth-or$status.state.childPid-ne$c.childPid-or$status.state.childBirth-cne$c.childBirth){throw 'RETAINED_RECOVERY_GENUINE_STATUS_REQUIRED'}
  $capability.Validate()
  # Archive writes its durable attempt BEFORE its only native rename. Its
  # uncertainty never causes another Archive call or an installer invocation.
  $capability.Archive()
  if(!$capability.Archived){throw 'RETAINED_RECOVERY_ARCHIVE_UNCONFIRMED'}
  return @{archived=$true;newObservationFileIdentity=$identity;originalCreatorIdentityRecovered=$false}
 }finally{if($capability){$script:B6RecoveryNativeRenameCalls=$capability.NativeRenameCalls;$capability.Dispose()};Close-Business5244RetirementPeer $connection}
}
if($Library){return}
if(!$Apply){throw 'RETAINED_RECOVERY_SEPARATE_ARCHIVE_APPROVAL_REQUIRED'}
foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets','NetTCPIP')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$n,($n+'.psd1'))) -Scope Local -ErrorAction Stop}
$case=Get-B6RetainedRecoveryCase
if($PSVersionTable.PSEdition-cne'Desktop'-or$PSCommandPath-cne(Join-Path $case.root 'recover-business-5244-retained-handoff.ps1')-or$SourceSha256-cnotmatch'\A[a-fA-F0-9]{64}\z'-or(Get-B6RetainedRecoveryHash $PSCommandPath)-ine$SourceSha256){throw 'RETAINED_RECOVERY_FROZEN_ENTRY_REQUIRED'}
$self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$selfSid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
$argv=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape([string]$self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
$expectedArgs='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$PSCommandPath+' -Apply -SourceSha256 '+$SourceSha256.ToUpperInvariant()
if($self.ExecutablePath-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or$selfSid.ReturnValue-ne0-or$selfSid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$argv-cnotin@($expectedArgs,($expectedArgs+' '))){throw 'RETAINED_RECOVERY_NATIVE_CALLER_CHANGED'}
# Runtime application is deliberately separate from the source/offline task.
# No shared TEST action has happened merely by loading this library.
$script:B6RecoveryHolds=[Collections.Generic.List[IO.FileStream]]::new();$script:B6RecoveryInputs=@{};$script:B6RecoveryNativeRenameCalls=0;$mutex=$null;$result=$null;$once=Join-Path $case.root 'recovery-once'
try{
 Assert-B6RetainedRecoveryPlainPath $PSCommandPath
 $manifest=Get-Content -LiteralPath (Join-Path $case.root 'source-manifest.json') -Raw|ConvertFrom-Json
 if($manifest.schema-cne'melisa-b6-retained-recovery-source.v1'-or$manifest.sourceCommit-cnotmatch'\A[a-f0-9]{40}\z'-or$manifest.entrySha256-ine$SourceSha256-or$manifest.ciSuccess-ne$true){throw 'RETAINED_RECOVERY_SOURCE_MANIFEST'}
 [void](Hold-B6RetainedRecoveryInput $PSCommandPath $SourceSha256)
 $manifestBytes=Hold-B6RetainedRecoveryInput (Join-Path $case.root 'source-manifest.json') (Get-B6RetainedRecoveryHash (Join-Path $case.root 'source-manifest.json'))
 $heldManifest=[Text.Encoding]::UTF8.GetString($manifestBytes)|ConvertFrom-Json
 if(($heldManifest|ConvertTo-Json -Depth 8 -Compress)-cne($manifest|ConvertTo-Json -Depth 8 -Compress)){throw 'RETAINED_RECOVERY_MANIFEST_CHANGED'}
 $expectedPeerSourceSha256='4cce4731630f3be32355f5d7e38baca7043cffe2a0eca0dc15d08411187f6dc7'
 if($manifest.peerSha256-cne$expectedPeerSourceSha256){throw 'RETAINED_RECOVERY_NATIVE_SOURCE_PIN'}
 $nativeBytes=Hold-B6RetainedRecoveryInput (Join-Path $case.root 'business-5244-retirement-peer.cs') $expectedPeerSourceSha256
 $failureBytes=Hold-B6RetainedRecoveryInput (Join-Path $case.beforeRoot 'install-once\result.json') $case.failureHash;$script:B6RecoveryInputs.failure=[Text.Encoding]::UTF8.GetString($failureBytes)|ConvertFrom-Json
 $beforeBytes=Hold-B6RetainedRecoveryInput $case.before $case.beforeHash;$script:B6RecoveryInputs.before=[Text.Encoding]::UTF8.GetString($beforeBytes)|ConvertFrom-Json
 $frozen=Hold-B6RetainedRecoveryInput 'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PENDING-WEB-OWNER-BIRTH-V2-20261101\owner-manifest.json' '68220abd0606d09fc2273e06674facf4d3450516b9050045ca2d0903b178502b';$frozen=[Text.Encoding]::UTF8.GetString($frozen)|ConvertFrom-Json
 $names=@('current-entry-hold-capture.json','current-erp-processes.before.json','current-read2b-owner-capture.json','current-task-capture.json','current-task.before.sddl','current-task.before.xml','pending-web-before.json','webonly-api-before.json')
 $actualNames=@($frozen.privateBeforeImages.path|ForEach-Object {[IO.Path]::GetFileName($_)}|Sort-Object)
 if(@($frozen.privateBeforeImages).Count-ne8-or($actualNames-join'|')-cne($names-join'|')){throw 'RETAINED_RECOVERY_BEFORE_CLOSURE'}
 foreach($f in $frozen.privateBeforeImages){if([IO.Path]::GetDirectoryName($f.path)-cne$case.beforeRoot){throw 'RETAINED_RECOVERY_BEFORE_SCOPE'};$b=Hold-B6RetainedRecoveryInput $f.path $f.sha256;switch([IO.Path]::GetFileName($f.path)){'current-read2b-owner-capture.json'{$script:B6RecoveryInputs.owner=[Text.Encoding]::UTF8.GetString($b)|ConvertFrom-Json}'current-task-capture.json'{$script:B6RecoveryInputs.taskCapture=[Text.Encoding]::UTF8.GetString($b)|ConvertFrom-Json}'current-task.before.xml'{$script:B6RecoveryInputs.taskXml=[Text.Encoding]::UTF8.GetString($b)}'current-task.before.sddl'{$script:B6RecoveryInputs.taskSddl=[Text.Encoding]::UTF8.GetString($b)}}}
 Assert-B6RetainedRecoveryPlainPath $case.marker;if((Get-B6RetainedRecoveryHash $case.marker)-cne$case.markerHash){throw 'RETAINED_RECOVERY_MARKER_HASH'};$marker=Get-Content -LiteralPath $case.marker -Raw|ConvertFrom-Json
 Assert-B6RetainedRecoveryEvidence $script:B6RecoveryInputs.failure $marker $script:B6RecoveryInputs.before
 $coreBytes=Hold-B6RetainedRecoveryInput (Join-Path $case.peerRoot 'owner-manifest.json') $case.peerManifestHash;$core=[Text.Encoding]::UTF8.GetString($coreBytes)|ConvertFrom-Json
 foreach($f in $core.files){[void](Hold-B6RetainedRecoveryInput (Join-Path $case.peerRoot $f.path) $f.sha256)}
 Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString($nativeBytes))
 . (Join-Path $case.peerRoot 'business-5244-retirement-channel.ps1') -Library
 Assert-B6RetainedRecoveryProtection
 $mutex=[Threading.Mutex]::OpenExisting((Get-Business5244StartupMutexName));try{$free=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();throw 'RETAINED_RECOVERY_ABANDONED_OWNER'}
 if($free){$mutex.ReleaseMutex();throw 'RETAINED_RECOVERY_OWNER_MUTEX_NOT_HELD'}
 if(Test-Path -LiteralPath $once){throw 'RETAINED_RECOVERY_USE_EXISTING_RECEIPT'}
 Write-B6RetainedRecoveryNew (Join-Path $case.root 'recovery-claim.json') @{schema='melisa-b6-retained-recovery-claim.v1';source=$manifest.sourceCommit;failure=$case.failureHash;marker=$case.markerHash;pid=$PID;writes='EXACT_MARKER_ARCHIVE_ONLY'}
 [void][IO.Directory]::CreateDirectory($once)
 $result=@{schema='melisa-b6-retained-recovery-result.v1';status='PREPARING';sourceCommit=$manifest.sourceCommit;recoverySequenceAttempts=0;nativeRenameCalls=0;installationCalls=0;sqlWrites=0;stopCalls=0;taskChanges=0;firstInstallError='UNKNOWN';failure=$null}
 try{
  $result.recoverySequenceAttempts=1;$proof=Invoke-B6RetainedRecoverySequence
  Assert-B6RetainedRecoveryProtection
  $archive=Join-Path $once '5244-retirement.pending.archived'
  if((Test-Path -LiteralPath $case.marker)-or(Get-B6RetainedRecoveryHash $archive)-cne$case.markerHash){throw 'RETAINED_RECOVERY_FINAL_READBACK'}
  $result.status='MARKER_ARCHIVED_OLD_PAIR_PRESERVED';$result.proof=$proof;$result.startupMarkerAbsent=$true;$result.installationRollbackComplete=$false
 }catch{$result.status='RECOVERY_UNCONFIRMED_READONLY_RECONCILIATION_REQUIRED';$result.failure=if($_.Exception.Message-cmatch'\A[A-Z][A-Z0-9_]+\z'){$_.Exception.Message}else{'RETAINED_RECOVERY_UNCLASSIFIED'};throw}finally{$result.nativeRenameCalls=$script:B6RecoveryNativeRenameCalls;Write-B6RetainedRecoveryNew (Join-Path $once 'result.json') $result}
 $result|ConvertTo-Json -Depth 8
}finally{if($mutex){$mutex.Dispose()};foreach($h in $script:B6RecoveryHolds){$h.Dispose()}}
