param(
 [ValidateSet('Inspect','Capture','Drain')][string]$Mode='Capture',
 [Parameter(Mandatory=$true)][string]$ProfilePath,[Parameter(Mandatory=$true)][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,[Parameter(Mandatory=$true)][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,[Parameter(Mandatory=$true)][string]$EngineSha256,
 [Parameter(Mandatory=$true)][string]$RecoveryHelperPath,[Parameter(Mandatory=$true)][string]$RecoveryHelperSha256,
 [string]$ClaimPath,[string]$ClaimSha256,
 [string]$AdmittedSnapshotPath,[string]$AdmittedSnapshotSha256,[string]$StopIntentPath,[string]$StopIntentSha256
)
# Source-bound successor worker. Inspect/Capture only read; Drain stops only the exact
# core after the coordinator's durable intent. Consoles/probes are never killed.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_SUCCESSOR_OWNER'}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$predecessor='639e2da815e1e7ac0f1c0d04d7f7bdc3'
$engineSha='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'
function ReadWorkerPin([string]$path,[string]$sha){
 if($sha -cnotmatch '\A[a-f0-9]{64}\z' -or -not [IO.Path]::IsPathRooted($path) -or [IO.Path]::GetFullPath($path) -cne $path){throw 'P03_SUCCESSOR_PIN_SCOPE'}
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'P03_SUCCESSOR_REPARSE'}}
 $item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.LinkType){throw 'P03_SUCCESSOR_FILE'}
 $acl=Get-Acl -LiteralPath $path;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or $rules.Count -ne 2){throw 'P03_SUCCESSOR_ACL'}
 foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and -not $_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -ne 1){throw 'P03_SUCCESSOR_ACL'}}
 $s=[IO.File]::Open($path,'Open','Read','None');try{if($s.Length -le 0 -or $s.Length -gt 16777216){throw 'P03_SUCCESSOR_SIZE'};$m=[IO.MemoryStream]::new();$s.CopyTo($m);$bytes=$m.ToArray();$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant();if($actual -cne $sha){throw 'P03_SUCCESSOR_HASH'};return ,$bytes}finally{$s.Dispose()}
}
function ImportWorkerFunctions([byte[]]$bytes,[string[]]$names){
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($bytes),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'P03_SUCCESSOR_SOURCE_PARSE'}
 foreach($name in $names){$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));if($defs.Count -ne 1){throw 'P03_SUCCESSOR_FUNCTION'};$targetName=if($name -ceq 'PausedRemainingCore'){'RecoveredRemainingCore'}else{$name};. ([scriptblock]::Create('function script:'+ $targetName + $defs[0].Extent.Text.Substring(('function '+$defs[0].Name).Length)))}
}
if($EngineSha256 -cne $engineSha){throw 'P03_SUCCESSOR_ENGINE'}
$engineBytes=ReadWorkerPin $EnginePath $engineSha
# Function definitions only: neither helper's top-level dispatcher executes.
$engineTokens=$null;$engineErrors=$null;$engineAst=[Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::UTF8.GetString($engineBytes),[ref]$engineTokens,[ref]$engineErrors)
if($engineErrors.Count){throw 'P03_SUCCESSOR_ENGINE_PARSE'}
$engineNames=@($engineAst.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)|ForEach-Object{$_.Name})
ImportWorkerFunctions $engineBytes $engineNames
$helperNames=@('SourceBytes','ProbeArgumentsAllowed','PrepareProbeSource','LatePrecutProbeAllowed','ProbeAuxiliaries','PausedTasks','PausedOld','PausedOldCore','PausedRemaining','PausedRemainingCore','WaitCoreProbeAbsence')
ImportWorkerFunctions (ReadWorkerPin $RecoveryHelperPath $RecoveryHelperSha256) $helperNames
$profile=Json (ReadWorkerPin $ProfilePath $ProfileSha256);$before=Json (ReadWorkerPin $BeforeImagePath $BeforeImageSha256)
$runId=$before.runId;$dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
$Environment='Shared';$isRehearsal=$false;$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704);$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
$script:consolePins=@{};$script:probePins=@{};$script:legacyConsolePins=@{};$script:drainedPids=@()
$script:tasksStopRequested=$false;$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false;$script:lateAdmissionOpen=$false;$script:lateProbePids=@()
$script:coreLifetime=$null;$script:precutWindowOpenedAt=$null;$script:coreStopCompletedAt=$null
$script:cutWitnessCommitted=$false
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
function WorkerSamePin($a,$b){
 return $null -ne $a -and $null -ne $b -and $a.pid -eq $b.pid -and $a.parentPid -eq $b.parentPid -and $a.ownerSid -ceq $b.ownerSid -and $a.nodePath -ceq $b.nodePath -and $a.commandLine -ceq $b.commandLine -and [DateTime]::Parse($a.creationTime).ToUniversalTime().Ticks -eq [DateTime]::Parse($b.creationTime).ToUniversalTime().Ticks
}
function WorkerAuthority{
 [void](ReadWorkerPin $ProfilePath $ProfileSha256);[void](ReadWorkerPin $BeforeImagePath $BeforeImageSha256);[void](ReadWorkerPin $EnginePath $engineSha);[void](ReadWorkerPin $RecoveryHelperPath $RecoveryHelperSha256)
 Need ($runId -cmatch '\A[a-f0-9]{32}\z' -and $runId -cne $predecessor -and $ProfilePath -ceq (Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json')) -and $BeforeImagePath -ceq (Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json'))) 'SUCCESSOR_RUN_SCOPE'
 if($Mode -ceq 'Inspect'){
  # Initial and claim-CAS inspections precede the frozen transition directory.
  # Only already pinned private source files under this owner root may supply
  # definitions. Inspect grants neither claim admission nor any mutation.
  foreach($entry in @(@($EnginePath,'p03-physical-rollback.ps1'),@($RecoveryHelperPath,'p03-pr54-paused-old-recover.ps1'))){Need ([IO.Path]::GetFullPath($entry[0]) -ceq $entry[0] -and $entry[0].StartsWith($base+'\',[StringComparison]::Ordinal) -and [IO.Path]::GetFileName($entry[0]) -ceq $entry[1]) 'SUCCESSOR_INSPECT_HELPER_SCOPE'}
 }else{Need ($EnginePath -ceq (Join-Path $dir 'p03-physical-rollback.ps1') -and $RecoveryHelperPath -ceq (Join-Path $dir 'p03-pr54-paused-old-recover.ps1')) 'SUCCESSOR_HELPER_SCOPE'}
 Need ($Environment -ceq 'Shared' -and $isRehearsal -eq $false -and $profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3') 'SUCCESSOR_ENVIRONMENT'
 Need ($profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.database -ceq $database -and $before.actualT1 -eq $false) 'SUCCESSOR_PROFILE'
 Need ($profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071') 'SUCCESSOR_SETTINGS'
 foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false) 'SUCCESSOR_SETTINGS_SCOPE'}
 [void](ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);[void](ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
 $stopDigest=Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{planDigest=$before.plan.digest;stopOrder=$order}|ConvertTo-Json -Compress)))
 if($Mode -cne 'Inspect'){
  Need (-not [string]::IsNullOrEmpty($ClaimPath) -and $ClaimSha256 -cmatch '\A[a-f0-9]{64}\z') 'SUCCESSOR_CLAIM_REQUIRED'
  Need ($ClaimPath -ceq (Join-Path $base ('p03-pr54-successor-of-'+$predecessor+'.lock.json'))) 'SUCCESSOR_CLAIM_PATH'
  $claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256)
  Need ($claim.schemaVersion -ceq 'melisa-p03-owner-successor-claim.v1' -and $claim.predecessorRunId -ceq $predecessor -and $claim.successorRunId -ceq $runId -and $claim.successorProfile.path -ceq $ProfilePath -and $claim.successorProfile.sha256 -ceq $ProfileSha256 -and $claim.successorBefore.path -ceq $BeforeImagePath -and $claim.successorBefore.sha256 -ceq $BeforeImageSha256 -and $claim.engineSha256 -ceq $engineSha -and $claim.stopOrderDigest -ceq $stopDigest) 'SUCCESSOR_CLAIM'
 }
 if($Mode -ceq 'Drain'){
  Need ($AdmittedSnapshotPath -ceq (Join-Path $dir 'successor-precut-admission.json') -and $StopIntentPath -cmatch ('\A'+[regex]::Escape($dir)+'\\event-[0-9]{4}\.json\z')) 'SUCCESSOR_DRAIN_PATH'
  [void](ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256);$intent=Json (ReadWorkerPin $StopIntentPath $StopIntentSha256)
  Need ($intent.event -ceq 'EXACT_STOP_INTENT' -and $intent.target -ceq 'coreSupervisor' -and $intent.digest -ceq $before.plan.digest -and $intent.stopOrderDigest -ceq $stopDigest -and $intent.profileSha256 -ceq $ProfileSha256 -and $intent.beforeSha256 -ceq $BeforeImageSha256) 'SUCCESSOR_CORE_INTENT'
 }
}
# Reuse current-generation classification, never the historical PID42036 grant.
function Authority{WorkerAuthority}
function LegacyConsoleAuxiliaries($inv){return @()}
function WriteWorkerEvidence([string]$leaf,$value){
 Need ($leaf -cin @('successor-core-cut-completed.json','successor-core-probe-drain.json')) 'SUCCESSOR_WRITE_SCOPE'
 $path=Join-Path $dir $leaf;NoReparse $dir;Need (-not (Test-Path -LiteralPath $path)) 'SUCCESSOR_ONCE'
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 14 -Compress));$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
 $s=New-Object IO.FileStream($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()};$sha=Hash $bytes;[void](ReadWorkerPin $path $sha);return [ordered]@{path=$path;sha256=$sha}
}
function AssertWorkerBindings($inv,$selected){
 $expected=@($selected|ForEach-Object{$e=$_;foreach($b in $e.bindings){[pscustomobject]@{port=$b.port;address=$b.address;pid=$e.pid}}})
 Need ($inv.listeners.Count -eq $expected.Count) 'SUCCESSOR_BINDING_COUNT'
 foreach($b in $expected){Need (@($inv.listeners|Where-Object{$_.LocalPort -eq $b.port -and $_.LocalAddress -ceq $b.address -and $_.OwningProcess -eq $b.pid}).Count -eq 1) 'SUCCESSOR_BINDING'}
}
function CaptureWorkerAdmissionCore{
 Authority;PrepareProbeSource;$inv=Inventory;ProtectedProcesses $inv
 Need ($inv.instances.Count -eq 2 -and @($profile.tasks).Count -eq 2 -and @($profile.oldWatchers).Count -eq 2) 'SUCCESSOR_CAPTURE_COM'
 $selected=@();foreach($role in $order){$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'SUCCESSOR_CAPTURE_APP';$selected+=,$e}
 foreach($entry in $profile.tasks){
  Need ($entry.name -cin $names) 'SUCCESSOR_CAPTURE_TASK_NAME';$t=$folder.GetTask($entry.name);Need ([int]$t.State -eq 4 -and (XmlHash ([string]$t.Xml)) -ceq $entry.oldXmlSha256) 'SUCCESSOR_CAPTURE_TASK'
  $instances=@($inv.instances|Where-Object{$_.Name -ceq $entry.name});Need ($instances.Count -eq 1 -and [int]$instances[0].State -eq 4 -and [string]$instances[0].Path -ceq ('\'+$entry.name)) 'SUCCESSOR_CAPTURE_INSTANCE'
  $watchers=@($profile.oldWatchers|Where-Object{$_.pid -eq [int]$instances[0].EnginePID});Need ($watchers.Count -eq 1) 'SUCCESSOR_CAPTURE_WATCHER';$w=$watchers[0];$actual=@($inv.all|Where-Object{$_.ProcessId -eq $w.pid});Need ($actual.Count -eq 1 -and (Identity $actual[0] $w)) 'SUCCESSOR_CAPTURE_WATCHER_IDENTITY';$selected+=,$w
 }
 Need (@($selected|Select-Object -ExpandProperty pid -Unique).Count -eq 10) 'SUCCESSOR_CAPTURE_DISTINCT'
 $probes=@(ProbeAuxiliaries $inv);$aux=@(ConsoleAuxiliaries $inv @($selected+$probes));$aux+=@($probes|ForEach-Object{$_.pid})
 $relevant=[Collections.Generic.HashSet[int]]::new();foreach($p in $selected){[void]$relevant.Add([int]$p.pid)}
 foreach($p in $inv.all){foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){[void]$relevant.Add([int]$p.ProcessId)}};if(IsWatcherCommand ([string]$p.CommandLine)){[void]$relevant.Add([int]$p.ProcessId)}}
 do{$added=$false;foreach($p in $inv.all){if($relevant.Contains([int]$p.ParentProcessId) -and $relevant.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inv.all){if($relevant.Contains([int]$p.ProcessId)){Need ($p.ProcessId -in @($selected|ForEach-Object{$_.pid}) -or $p.ProcessId -in $aux) 'SUCCESSOR_CAPTURE_FOREIGN'}}
 AssertWorkerBindings $inv @($order|ForEach-Object{$before.identities.$_})
 return [ordered]@{schemaVersion='melisa-p03-successor-precut-admission.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;recoveryHelperSha256=$RecoveryHelperSha256;observedAt=[DateTime]::UtcNow.ToString('o');oldIdentities=@($order|ForEach-Object{$before.identities.$_});oldWatchers=@($profile.oldWatchers);consolePins=@($script:consolePins.Values);probePins=@($script:probePins.Values)}
}
function CaptureWorkerAdmission{
 for($attempt=0;$attempt -lt 3;$attempt++){try{return CaptureWorkerAdmissionCore}catch{if($_.Exception.Message -cne 'P03_PAUSED_PROBE_EXIT_RECAPTURE'){throw};if($attempt -eq 2){throw 'P03_SUCCESSOR_PROBE_RECAPTURE_EXHAUSTED'}}}
}
function SeedWorkerAdmission($snapshot){
 Need ($snapshot.schemaVersion -ceq 'melisa-p03-successor-precut-admission.v1' -and $snapshot.profileSha256 -ceq $ProfileSha256 -and $snapshot.beforeSha256 -ceq $BeforeImageSha256 -and $snapshot.engineSha256 -ceq $engineSha -and $snapshot.recoveryHelperSha256 -ceq $RecoveryHelperSha256) 'SUCCESSOR_SNAPSHOT'
 $age=([DateTime]::UtcNow-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60) 'SUCCESSOR_SNAPSHOT_FRESH'
 Need (@($snapshot.oldIdentities).Count -eq 8 -and @($snapshot.oldWatchers).Count -eq 2 -and @($snapshot.consolePins).Count -le 64 -and @($snapshot.probePins).Count -le 64) 'SUCCESSOR_SNAPSHOT_COUNT'
 foreach($role in $order){$e=$before.identities.$role;$rows=@($snapshot.oldIdentities|Where-Object{$_.pid -eq $e.pid});Need ($rows.Count -eq 1 -and (WorkerSamePin $rows[0] $e)) 'SUCCESSOR_SNAPSHOT_APP'}
 foreach($w in $profile.oldWatchers){$rows=@($snapshot.oldWatchers|Where-Object{$_.pid -eq $w.pid});Need ($rows.Count -eq 1 -and (WorkerSamePin $rows[0] $w)) 'SUCCESSOR_SNAPSHOT_WATCHER'}
 $parents=@($snapshot.oldIdentities)+@($snapshot.oldWatchers)+@($snapshot.probePins)
 foreach($p in $snapshot.consolePins){
  $parent=@($parents|Where-Object{$_.pid -eq $p.parentPid});Need ($parent.Count -eq 1 -and $p.ownerSid -ceq $owner -and $p.nodePath -ceq 'C:\Windows\System32\conhost.exe' -and $p.commandLine -ceq '\??\C:\WINDOWS\system32\conhost.exe 0x4' -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -ge [DateTime]::Parse($parent[0].creationTime).ToUniversalTime() -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -le [DateTime]::Parse($snapshot.observedAt).ToUniversalTime() -and -not $script:consolePins.ContainsKey([int]$p.pid)) 'SUCCESSOR_SNAPSHOT_CONSOLE';$script:consolePins[[int]$p.pid]=$p
 }
 foreach($p in $snapshot.probePins){Need ($p.parentPid -eq $before.identities.coreSupervisor.pid -and $p.ownerSid -ceq $owner -and $p.nodePath -ceq $profile.shell.path -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -ge [DateTime]::Parse($before.identities.coreSupervisor.creationTime).ToUniversalTime() -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -le [DateTime]::Parse($snapshot.observedAt).ToUniversalTime() -and (ProbeArgumentsAllowed (Tokens $p.commandLine) $script:probePath) -and -not $script:probePins.ContainsKey([int]$p.pid)) 'SUCCESSOR_SNAPSHOT_PROBE';$script:probePins[[int]$p.pid]=$p}
 # The original capture proved the parent while alive. Recheck the binary even
 # for cached children; the fe classifier validates current identity/listeners.
 $binary='C:\Windows\System32\conhost.exe';NoReparse $binary;Need ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant() -ceq 'c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac') 'SUCCESSOR_CONSOLE_BINARY'
 $signature=Get-AuthenticodeSignature -LiteralPath $binary;Need ($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -ceq 'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US') 'SUCCESSOR_CONSOLE_SIGNATURE'
}
function HoldWorkerCore($core){
 $held=[Diagnostics.Process]::GetProcessById([int]$core.pid);[void]$held.Handle
 try{Need ($held.Handle -ne [IntPtr]::Zero -and -not $held.HasExited -and $held.Id -eq $core.pid -and $held.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ') -ceq [DateTime]::Parse($core.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'SUCCESSOR_CORE_LIFETIME'}catch{$held.Dispose();throw}
 return $held
}
function PausedRemainingCore{
 # A held, witnessed core exit can naturally terminate its captured children.
 # Absence is monotonic: no PID marked gone may subsequently reappear, even
 # with an apparently matching command. The imported classifier still checks
 # every surviving identity, all descendants, COM, protected state and ports.
 Need ($script:cutWitnessCommitted -and $script:coreQuiesced -and $null -ne $script:coreLifetime -and $script:coreLifetime.HasExited) 'SUCCESSOR_REMAINING_BEFORE_CUT'
 for($attempt=0;$attempt -lt 3;$attempt++){
  Authority;$inv=Inventory;ProtectedProcesses $inv
  Need (@($inv.all|Where-Object{$_.ProcessId -eq $before.identities.coreSupervisor.pid}).Count -eq 0) 'SUCCESSOR_CORE_REUSED'
  foreach($role in $order){$e=$before.identities.$role;$rows=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});if($e.pid -in $script:drainedPids){Need ($rows.Count -eq 0) 'SUCCESSOR_GONE_PID_REAPPEARED'}elseif($rows.Count -eq 0){$script:drainedPids+=,[int]$e.pid}else{Need ($rows.Count -eq 1 -and (Identity $rows[0] $e)) 'SUCCESSOR_REMAINING_REUSED'}}
  try{return RecoveredRemainingCore}catch{if($_.Exception.Message -cne 'P03_PHYSICAL_PAUSED_REMAINING_IDENTITY' -or $attempt -eq 2){throw}}
 }
}
function StopWorkerCore($core){
 $stopperSha='79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d';[void](ReadWorkerPin $profile.stopper.path $stopperSha)
 $codeHandle=[IO.File]::Open($profile.stopper.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{
  $memory=[IO.MemoryStream]::new();$codeHandle.CopyTo($memory);Need ((Hash $memory.ToArray()) -ceq $stopperSha) 'SUCCESSOR_HELD_STOPPER'
  $actual=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$core.pid) -ErrorAction Stop);Need ($actual.Count -eq 1 -and (Identity $actual[0] $core)) 'SUCCESSOR_CORE_PRECUT'
  $proof=[ordered]@{pid=$core.pid;parentPid=$core.parentPid;nodePath=$core.nodePath;ownerSid=$core.ownerSid;commandLine=$core.commandLine;creationTime=[DateTime]::Parse($core.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')}
  $result=& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -File $profile.stopper.path -ExpectedJsonBase64 ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($proof|ConvertTo-Json -Compress))))
  Need ($LASTEXITCODE -eq 0 -and [string]$result -ceq 'EXACT_OBSERVED_PROCESS_STOPPED') 'SUCCESSOR_STOP_RESULT'
 }finally{$codeHandle.Dispose()}
}
function DrainWorkerCore{
 Authority;Need (-not (Test-Path -LiteralPath (Join-Path $dir 'successor-core-cut-completed.json')) -and -not (Test-Path -LiteralPath (Join-Path $dir 'successor-core-probe-drain.json'))) 'SUCCESSOR_PRIOR_CUT'
 PrepareProbeSource;SeedWorkerAdmission (Json (ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256))
 $script:tasksStopRequested=$true
 try{
  $core=$before.identities.coreSupervisor;$script:coreLifetime=HoldWorkerCore $core
  # Open before the authoritative pre-cut inventory. An unseen probe may only
  # enter later if born inside this held lifetime's bounded cut window.
  $script:precutWindowOpenedAt=[DateTime]::UtcNow
  $selected=@(PausedOld);Need ($selected.Count -eq 8) 'SUCCESSOR_EIGHT_BEFORE_CUT'
  Need (([DateTime]::UtcNow-$script:precutWindowOpenedAt).TotalSeconds -lt 60) 'SUCCESSOR_PRECUT_WINDOW'
  StopWorkerCore $core
  Need ($script:coreLifetime.HasExited -and @((Inventory).all|Where-Object{$_.ProcessId -eq $core.pid}).Count -eq 0) 'SUCCESSOR_CORE_EXIT'
  $script:coreStopCompletedAt=[DateTime]::UtcNow
  Need (($script:coreStopCompletedAt-$script:precutWindowOpenedAt).TotalSeconds -lt 60) 'SUCCESSOR_COMPLETED_WINDOW'
  $cut=WriteWorkerEvidence 'successor-core-cut-completed.json' ([ordered]@{event='SUCCESSOR_CORE_CUT_COMPLETED';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;recoveryHelperSha256=$RecoveryHelperSha256;claimSha256=$ClaimSha256;stopIntentSha256=$StopIntentSha256;admittedSnapshotSha256=$AdmittedSnapshotSha256;windowOpenedAt=$script:precutWindowOpenedAt.ToString('o');cutCompletedAt=$script:coreStopCompletedAt.ToString('o');core=$core;heldProcessHandle=$true;processAbsent=$true})
  $script:cutWitnessCommitted=$true;$script:drainedPids=@([int]$core.pid);$script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$script:lateAdmissionOpen=$true
  try{WaitCoreProbeAbsence}finally{$script:lateAdmissionOpen=$false}
  $remaining=PausedRemaining;Need ($script:coreLifetime.HasExited -and @($remaining.all|Where-Object{$_.ProcessId -eq $core.pid -or $_.ProcessId -in @($script:probePins.Keys)}).Count -eq 0) 'SUCCESSOR_PROBE_ABSENCE'
  $remainingCount=8-@($script:drainedPids).Count
  $drain=WriteWorkerEvidence 'successor-core-probe-drain.json' ([ordered]@{event='SUCCESSOR_CORE_PROBES_ABSENT';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;cutWitness=$cut;observedAt=[DateTime]::UtcNow.ToString('o');consolePins=@($script:consolePins.Values);probePins=@($script:probePins.Values);latePrecutProbePids=$script:lateProbePids;heldCoreExited=$true;remainingOldRoles=$remainingCount;goneOldPids=@($script:drainedPids)})
  return [ordered]@{status='SUCCESSOR_CORE_DRAINED';coreStopResult='EXACT_OBSERVED_PROCESS_STOPPED';heldCoreExited=$true;remainingOldRoles=$remainingCount;goneOldPids=@($script:drainedPids);cutWitness=$cut;drainWitness=$drain;authenticatedProbeCount=$script:probePins.Count;latePrecutProbeCount=$script:lateProbePids.Count;consoleCount=$script:consolePins.Count}
 }finally{if($null -ne $script:coreLifetime){$script:coreLifetime.Dispose()}}
}
WorkerAuthority
if($Mode -cin @('Inspect','Capture')){CaptureWorkerAdmission|ConvertTo-Json -Depth 14 -Compress;return}
DrainWorkerCore|ConvertTo-Json -Depth 8 -Compress
