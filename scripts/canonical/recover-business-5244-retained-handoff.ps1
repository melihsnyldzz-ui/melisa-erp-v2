param([switch]$Library,[switch]$Apply,[string]$SourceSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Separate exact-marker archive authorization is required before -Apply.
# This is not an installer, creator-token adoption or a stop capability.
function Get-B6RetainedRecoveryCase {
 return @{
  root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-retained-handoff-recovery-20261101'
  sourceRoot='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-retained-handoff-recovery-ci-v2-20261101'
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
function Invoke-B6RetainedRecoveryCiProcess([string]$Producer){
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe'
 if((Get-B6RetainedRecoveryHash $node)-cne'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'){throw 'RETAINED_RECOVERY_CI_NODE_CHANGED'}
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$node;$info.Arguments='"'+$Producer+'" --verify';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 foreach($n in @('NODE_OPTIONS','NODE_PATH','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED')){$info.EnvironmentVariables.Remove($n)}
 $process=[Diagnostics.Process]::new();$process.StartInfo=$info
 try{if(!$process.Start()){throw 'RETAINED_RECOVERY_CI_VERIFIER_START'};$out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync();if(!$process.WaitForExit(120000)){throw 'RETAINED_RECOVERY_CI_VERIFIER_TIMEOUT'};$text=$out.GetAwaiter().GetResult();[void]$err.GetAwaiter().GetResult();if($process.ExitCode-ne0){throw 'RETAINED_RECOVERY_LIVE_CI_REQUIRED'};return $text}finally{$process.Dispose()}
}
function Assert-B6RetainedRecoveryCiProvenance([byte[]]$ManifestBytes,[string]$EntryHash){
 $case=Get-B6RetainedRecoveryCase;$manifest=[Text.Encoding]::UTF8.GetString($ManifestBytes)|ConvertFrom-Json
 if($manifest.schema-cne'melisa-b6-retained-recovery-source.v2'-or$manifest.generation-cne'ERP-B6-RECOVERY-CI-PROVENANCE-20261101-0103'-or$manifest.sourceCommit-cnotmatch'\A[a-f0-9]{40}\z'-or$manifest.binding.sourceRoot-cne$case.sourceRoot-or$manifest.binding.recoveryRoot-cne$case.root){throw 'RETAINED_RECOVERY_CI_MANIFEST'}
 $expectedCiProducerSha256='b66d97f6c0a2bb65b5a0c0f3943b1a0359746aec084a45c2331c03fe7cc2dad7'
 $producer=Join-Path $case.sourceRoot 'prepare-business-5244-retained-recovery.mjs'
 [void](Hold-B6RetainedRecoveryInput $producer $expectedCiProducerSha256)
 if($manifest.provenance.path-cne'ci-provenance.json'){throw 'RETAINED_RECOVERY_CI_PROOF_PATH'}
 [void](Hold-B6RetainedRecoveryInput (Join-Path $case.sourceRoot 'ci-provenance.json') $manifest.provenance.sha256)
 $verified=Invoke-B6RetainedRecoveryCiProcess $producer|ConvertFrom-Json
 $sha=[Security.Cryptography.SHA256]::Create();try{$manifestHash=[BitConverter]::ToString($sha.ComputeHash($ManifestBytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 if($verified.schema-cne'melisa-b6-retained-recovery-ci-verification.v2'-or$verified.generation-cne$manifest.generation-or$verified.liveGithubVerified-ne$true-or$verified.sourceCommit-cne$manifest.sourceCommit-or$verified.sourceRoot-cne$case.sourceRoot-or$verified.recoveryRoot-cne$case.root-or$verified.manifestSha256-cne$manifestHash-or$verified.entrySha256-ine$EntryHash-or$verified.producerSha256-cne$expectedCiProducerSha256-or$verified.executionAuthority-ne$false-or$verified.installed-ne$false-or$verified.applied-ne$false-or$verified.admissionIssued-ne$false-or$verified.runtimeValidationComplete-ne$false){throw 'RETAINED_RECOVERY_LIVE_CI_BINDING'}
 return $manifest
}
function Assert-B6RetainedRecoveryProtection {
 $c=Get-B6RetainedRecoveryCase;$failure=$script:B6RecoveryInputs.failure
 foreach($f in $failure.before.files){if((Get-B6RetainedRecoveryHash $f.path)-ine$f.hash){throw 'RETAINED_RECOVERY_PROTECTED_FILE_CHANGED'}}
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
 foreach($f in $before.files){if((Get-B6RetainedRecoveryHash $f.path)-ine$f.sha256){throw 'RETAINED_RECOVERY_BASELINE_FILE_CHANGED'}}
 foreach($entry in $before.entries){if((Get-B6RetainedRecoveryHash $entry.path)-ine$entry.sha256){throw 'RETAINED_RECOVERY_ENTRY_CHANGED'}}
 if((Get-B6RetainedRecoveryHash $before.recordPath)-ine$before.recordSha256){throw 'RETAINED_RECOVERY_RECORD_CHANGED'}
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
if($PSVersionTable.PSEdition-cne'Desktop'-or$PSCommandPath-cne(Join-Path $case.sourceRoot 'recover-business-5244-retained-handoff.ps1')-or$SourceSha256-cnotmatch'\A[a-fA-F0-9]{64}\z'-or(Get-B6RetainedRecoveryHash $PSCommandPath)-ine$SourceSha256){throw 'RETAINED_RECOVERY_FROZEN_ENTRY_REQUIRED'}
$self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$selfSid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
$argv=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape([string]$self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
$expectedArgs='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$PSCommandPath+' -Apply -SourceSha256 '+$SourceSha256.ToUpperInvariant()
if($self.ExecutablePath-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or$selfSid.ReturnValue-ne0-or$selfSid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$argv-cnotin@($expectedArgs,($expectedArgs+' '))){throw 'RETAINED_RECOVERY_NATIVE_CALLER_CHANGED'}
# Runtime application is deliberately separate from the source/offline task.
# No shared TEST action has happened merely by loading this library.
$script:B6RecoveryHolds=[Collections.Generic.List[IO.FileStream]]::new();$script:B6RecoveryInputs=@{};$script:B6RecoveryNativeRenameCalls=0;$mutex=$null;$result=$null;$once=Join-Path $case.root 'recovery-once'
try{
 Assert-B6RetainedRecoveryPlainPath $PSCommandPath
 [void](Hold-B6RetainedRecoveryInput $PSCommandPath $SourceSha256)
 $manifestBytes=Hold-B6RetainedRecoveryInput (Join-Path $case.sourceRoot 'source-manifest.json') (Get-B6RetainedRecoveryHash (Join-Path $case.sourceRoot 'source-manifest.json'))
 $manifest=Assert-B6RetainedRecoveryCiProvenance $manifestBytes $SourceSha256
 $expectedPeerSourceSha256='a733f488c408dd969eb377dc44b329662e88860c30a3b8b1ee79afda28506dd2'
 $nativeBytes=Hold-B6RetainedRecoveryInput (Join-Path $case.sourceRoot 'business-5244-retirement-peer.cs') $expectedPeerSourceSha256
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
