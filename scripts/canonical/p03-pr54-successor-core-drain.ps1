param(
 [string]$PolicyGeneration='Legacy',
 [ValidateSet('Inspect','Capture','Drain')][string]$Mode='Capture',
 [Parameter(Mandatory=$true)][string]$ProfilePath,[Parameter(Mandatory=$true)][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,[Parameter(Mandatory=$true)][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,[Parameter(Mandatory=$true)][string]$EngineSha256,
 [Parameter(Mandatory=$true)][string]$RecoveryHelperPath,[Parameter(Mandatory=$true)][string]$RecoveryHelperSha256,
 [string]$ClaimPath,[string]$ClaimSha256,
 [string]$AdmittedSnapshotPath,[string]$AdmittedSnapshotSha256,[string]$StopIntentPath,[string]$StopIntentSha256
)
if($PolicyGeneration-ceq'CurrentB142Rehearsal'){
 if($Mode-cne'Inspect'-or@('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','StopIntentPath','StopIntentSha256'|Where-Object{$PSBoundParameters.ContainsKey($_)}).Count-or$EngineSha256-cne'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'-or$RecoveryHelperSha256-cne'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'-or$EnginePath-cnotmatch'\AC:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\recovery-engine\.ps1\z'){throw 'P03_CURRENT_B142_REHEARSAL_ENTRY'}
}
# B264 is a separately selected read-only generation. Reject mutation inputs
# before any import, file, owner, SQL or COM access (including empty bound args).
if($PolicyGeneration -cnotin @('Legacy','B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly','CurrentB142Rehearsal')){throw 'P03_B264_POLICY_GENERATION'}
if($PolicyGeneration -cin @('B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly')){
 if($Mode -cne 'Inspect' -or @('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','StopIntentPath','StopIntentSha256'|Where-Object{$PSBoundParameters.ContainsKey($_)}).Count){throw 'P03_B264_INSPECT_ONLY'}
 if($EngineSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}) -or $RecoveryHelperSha256 -cne 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'){throw 'P03_B264_INSPECTION_SOURCE'}
}
if($PolicyGeneration -ceq 'CurrentB007InspectOnly' -and $EnginePath -cnotmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-current-b007-control-[a-f0-9]{12}\\p03-physical-rollback-lifetime-v2\.ps1\z'){throw 'P03_CURRENT_B007_ENGINE_SCOPE'}
# Source-bound successor worker. Inspect/Capture only read; Drain stops only the exact
# core after the coordinator's durable intent. Consoles/probes are never killed.
Set-StrictMode -Version Latest

# Internal in-process entry; NativeCapture is deliberately not a script/CLI parameter.
function InvokeP03SuccessorWorker{
param(
 [string]$PolicyGeneration='Legacy',
 [ValidateSet('Inspect','Capture','Drain')][string]$Mode='Capture',
 [Parameter(Mandatory=$true)][string]$ProfilePath,[Parameter(Mandatory=$true)][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,[Parameter(Mandatory=$true)][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,[Parameter(Mandatory=$true)][string]$EngineSha256,
 [Parameter(Mandatory=$true)][string]$RecoveryHelperPath,[Parameter(Mandatory=$true)][string]$RecoveryHelperSha256,
 [string]$ClaimPath,[string]$ClaimSha256,
 [string]$AdmittedSnapshotPath,[string]$AdmittedSnapshotSha256,[string]$StopIntentPath,[string]$StopIntentSha256,
 [object]$NativeCapture=$null
)
if($null -ne $NativeCapture){
 if($PolicyGeneration -cnotin @('CurrentB007InspectOnly','CurrentB142Rehearsal') -or $Mode -cne 'Inspect' -or $NativeCapture.id -cnotmatch '^[a-f0-9]{32}$' -or $NativeCapture.schemaVersion -cne 'melisa-p03-native-inventory.v1'){throw 'P03_SAME_CAPTURE_SCOPE'}
 foreach($row in @($NativeCapture.all)+@($NativeCapture.allListeners)){if($row -isnot [Microsoft.Management.Infrastructure.CimInstance]){throw 'P03_SAME_CAPTURE_NATIVE_TYPE'}}
 foreach($row in @($NativeCapture.instances)){if(-not [Runtime.InteropServices.Marshal]::IsComObject($row)){throw 'P03_SAME_CAPTURE_COM_TYPE'}}
}

if($PolicyGeneration-ceq'CurrentB142Rehearsal'){
 if($Mode-cne'Inspect'-or@('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','StopIntentPath','StopIntentSha256'|Where-Object{$PSBoundParameters.ContainsKey($_)}).Count-or$EngineSha256-cne'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'-or$RecoveryHelperSha256-cne'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'-or$EnginePath-cnotmatch'\AC:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\recovery-engine\.ps1\z'){throw 'P03_CURRENT_B142_REHEARSAL_ENTRY'}
}
# B264 is a separately selected read-only generation. Reject mutation inputs
# before any import, file, owner, SQL or COM access (including empty bound args).
if($PolicyGeneration -cnotin @('Legacy','B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly','CurrentB142Rehearsal')){throw 'P03_B264_POLICY_GENERATION'}
if($PolicyGeneration -cin @('B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly')){
 if($Mode -cne 'Inspect' -or @('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','StopIntentPath','StopIntentSha256'|Where-Object{$PSBoundParameters.ContainsKey($_)}).Count){throw 'P03_B264_INSPECT_ONLY'}
 if($EngineSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}) -or $RecoveryHelperSha256 -cne 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'){throw 'P03_B264_INSPECTION_SOURCE'}
}
if($PolicyGeneration -ceq 'CurrentB007InspectOnly' -and $EnginePath -cnotmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-current-b007-control-[a-f0-9]{12}\\p03-physical-rollback-lifetime-v2\.ps1\z'){throw 'P03_CURRENT_B007_ENGINE_SCOPE'}
# Source-bound successor worker. Inspect/Capture only read; Drain stops only the exact
# core after the coordinator's durable intent. Consoles/probes are never killed.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_SUCCESSOR_OWNER'}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$predecessor='639e2da815e1e7ac0f1c0d04d7f7bdc3'
$engineSha=if($PolicyGeneration -cin @('CurrentB007InspectOnly','CurrentB142Rehearsal')){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}elseif($PolicyGeneration -cin @('B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly')){'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}else{'fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'}
function ReadWorkerPin([string]$path,[string]$sha){
 if($sha -cnotmatch '\A[a-f0-9]{64}\z' -or -not [IO.Path]::IsPathRooted($path) -or [IO.Path]::GetFullPath($path) -cne $path){throw 'P03_SUCCESSOR_PIN_SCOPE'}
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'P03_SUCCESSOR_REPARSE'}}
 $item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.LinkType){throw 'P03_SUCCESSOR_FILE'}
 $acl=Get-Acl -LiteralPath $path;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or $rules.Count -ne 2){throw 'P03_SUCCESSOR_ACL'}
 foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and -not $_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -ne 1){throw 'P03_SUCCESSOR_ACL'}}
 $share=if($null -ne $NativeCapture){[IO.FileShare]::Read}else{[IO.FileShare]::None};$s=[IO.File]::Open($path,'Open','Read',$share);try{if($s.Length -le 0 -or $s.Length -gt 16777216){throw 'P03_SUCCESSOR_SIZE'};$m=[IO.MemoryStream]::new();$s.CopyTo($m);$bytes=$m.ToArray();$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant();if($actual -cne $sha){throw 'P03_SUCCESSOR_HASH'};return ,$bytes}finally{$s.Dispose()}
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
if($PolicyGeneration -cin @('B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly')){$helperNames=@('SourceBytes','ProbeArgumentsAllowed','PrepareProbeSource','LatePrecutProbeAllowed','ProbeAuxiliaries')}
ImportWorkerFunctions (ReadWorkerPin $RecoveryHelperPath $RecoveryHelperSha256) $helperNames
$profile=Json (ReadWorkerPin $ProfilePath $ProfileSha256);$before=Json (ReadWorkerPin $BeforeImagePath $BeforeImageSha256)
$runId=$before.runId;$dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
$Environment='Shared';$isRehearsal=$false;$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704);$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
if($PolicyGeneration-ceq'CurrentB142Rehearsal'){$base='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018';$runRoot=Join-Path $base ('run-'+$runId);$dir=$runRoot;$Environment='Rehearsal';$isRehearsal=$true;$names=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub');$ports=@(4284,4286,5334,62710,62711,62712,62713,62714);$database='MELISA_ERP_P03_RESTORE_TEST_20261018_01';function PrepareProbeSource{};function ProbeAuxiliaries($inventory){return @()}}
$order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
$currentReadRepair=($profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.oldSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $profile.newSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json');if($currentReadRepair){$predecessor='7b0821959737f1da0427b17a7dfd4685'}
$script:consolePins=@{};$script:probePins=@{};$script:legacyConsolePins=@{};$script:drainedPids=@()
$script:tasksStopRequested=$false;$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false;$script:lateAdmissionOpen=$false;$script:lateProbePids=@()
$script:sameCaptureAuditContext=if($null-ne$NativeCapture){$NativeCapture}else{$null}
$script:coreLifetime=$null;$script:precutWindowOpenedAt=$null;$script:coreStopCompletedAt=$null
$script:cutWitnessCommitted=$false
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
# Pure finite envelope reused by the normal physical collector. This function
# performs no IO and does not grant admission/claim/stop/Apply authority.
function AssertCurrentB142RehearsalContract($profile,$before,$oldSettings,$newSettings,[string]$profilePath,[string]$beforePath,[string]$beforeSha){
 # Separate finite fixture contract; this never admits Shared identities or history.
 function RNeed($value){if(-not$value){throw 'P03_CURRENT_B142_REHEARSAL_SCOPE'}}
 function RSame($a,$b){return ($a|ConvertTo-Json -Depth 20 -Compress)-ceq($b|ConvertTo-Json -Depth 20 -Compress)}
 $fixtureBase='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018';$fixtureOwner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 RNeed ($before.runId-cmatch'\A[a-f0-9]{32}\z');$fixtureRoot=Join-Path $fixtureBase ('run-'+$before.runId)
 RNeed ($profilePath-ceq(Join-Path $fixtureRoot 'profile.json')-and$beforePath-ceq(Join-Path $fixtureRoot 'before.json')-and$profile.beforeImage.path-ceq$beforePath-and$profile.beforeImage.sha256-ceq$beforeSha)
 foreach($value in @($profile,$before,$oldSettings,$newSettings)){RNeed ($value.environment-ceq'P03_REHEARSAL'-and$value.ownerSid-ceq$fixtureOwner-and$value.database-ceq'MELISA_ERP_P03_RESTORE_TEST_20261018_01')}
 foreach($value in @($before,$oldSettings,$newSettings)){RNeed ($value.copyId-ceq'P03-RECOVERY-REHEARSAL-20261018'-and$value.actualT1-ceq$false)}
 RNeed ($profile.schemaVersion-ceq'melisa-p03-physical-profile.v1'-and$before.schemaVersion-ceq'melisa-p03-owner-observation.v3'-and(RSame $before.oldConfig $profile.oldSettings)-and(RSame $before.newConfig $profile.newSettings))
 RNeed ($profile.oldSettings.path-ceq(Join-Path $fixtureRoot 'settings-old.json')-and$profile.newSettings.path-ceq(Join-Path $fixtureRoot 'settings-new.json')-and$profile.oldSettings.sha256-cmatch'\A[a-f0-9]{64}\z'-and$profile.newSettings.sha256-cmatch'\A[a-f0-9]{64}\z'-and$profile.oldSettings.sha256-cne$profile.newSettings.sha256)
 RNeed ($profile.shell.path-ceq'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-and$profile.shell.sha256-cmatch'\A[a-f0-9]{64}\z')
 $fixtureRoles=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative');$fixtureTasks=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')
 RNeed ((@($before.identities.PSObject.Properties.Name|Sort-Object)-join'|')-ceq(($fixtureRoles|Sort-Object)-join'|')-and@($profile.oldWatchers).Count-eq2)
 $all=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers);RNeed (@($all|Select-Object -ExpandProperty pid -Unique).Count-eq10)
 foreach($pin in $all){RNeed ($pin.pid-notin@($profile.protectedProcesses|ForEach-Object{$_.pid})-and$pin.pid-gt0-and$pin.ownerSid-ceq$fixtureOwner-and$pin.creationTime-is[string]-and[DateTime]::Parse($pin.creationTime).ToUniversalTime()-le[DateTime]::Parse($before.observedAt).ToUniversalTime())}
 RNeed (@($profile.tasks).Count-eq2-and(@($profile.tasks.name|Sort-Object)-join'|')-ceq(($fixtureTasks|Sort-Object)-join'|')-and@($before.tasks).Count-eq2-and(@($before.tasks.name|Sort-Object)-join'|')-ceq(($fixtureTasks|Sort-Object)-join'|'))
 RNeed ($profile.journalDirectory-ceq(Join-Path $fixtureRoot 'recovery')-and$profile.stopper.path-ceq(Join-Path $fixtureRoot 'stop-exact-observed-process.ps1')-and$profile.stopper.sha256-ceq'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d')
 RNeed (@($profile.packages).Count-eq2-and@($profile.candidateRules).Count-eq10-and@($profile.candidateRules.role|Sort-Object -Unique).Count-eq10)
 foreach($generation in @('old','new')){
  $settings=if($generation-ceq'old'){$oldSettings}else{$newSettings};$packageRoot=Join-Path $fixtureRoot ('packages\'+$generation)
  RNeed ($settings.generation-ceq$generation-and$settings.runtimeDirectory-ceq$fixtureRoot-and$settings.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$settings.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237')
  foreach($component in @($settings.components.PSObject.Properties|ForEach-Object{$_.Value})+@($settings.supervisor)){RNeed ($component.packageRoot-ceq$packageRoot-and$component.sourceCommit-cmatch'\A[a-f0-9]{40}\z'-and$component.manifestSha256-cmatch'\A[a-f0-9]{64}\z'-and$component.config.path-ceq(Join-Path $packageRoot 'fixture-config.json')-and$component.config.sha256-cmatch'\A[a-f0-9]{64}\z')}
  $pins=@($profile.packages|Where-Object{$_.root-ceq$packageRoot});RNeed ($pins.Count-eq1-and$pins[0].manifestPath-ceq(Join-Path $packageRoot 'release-manifest.json')-and$pins[0].manifestSha256-ceq$settings.supervisor.manifestSha256-and$pins[0].sourceCommit-ceq$settings.supervisor.sourceCommit)
 }
 # The imported frozen Rehearsal classifier rechecks these protected Shared baselines physically.
 RNeed (@($profile.protectedProcesses).Count-gt0-and@($profile.protectedBindings).Count-ge8-and@($profile.protectedTasks).Count-eq2-and(@($profile.protectedTasks.name|Sort-Object)-join'|')-ceq'Melisa-Hub-TEST-Web|Melisa-Terminal-Completion-Logon')
}
function AssertCurrentB142RehearsalFiles($profile,$oldSettings,$newSettings){
 foreach($settingsRef in @($profile.oldSettings,$profile.newSettings)){[void](ReadPinned $settingsRef.path $settingsRef.sha256)}
 foreach($pkg in $profile.packages){
  $manifest=Json (ReadPinned $pkg.manifestPath $pkg.manifestSha256);Need ((PackageManifestSource $manifest $pkg)-ceq$pkg.sourceCommit-and$manifest.files.Count-eq4) 'REHEARSAL_MANIFEST'
  $allowed=@('p03-rehearsal-fixture.mjs','p03-rehearsal-watch-core.ps1','p03-rehearsal-watch-hub.ps1','fixture-config.json');Need ((@($manifest.files.path|Sort-Object)-join'|')-ceq(($allowed|Sort-Object)-join'|')) 'REHEARSAL_FILES'
  foreach($file in $manifest.files){[void](ReadPinned (Join-Path $pkg.root $file.path) $file.sha256)}
 }
 foreach($task in $profile.tasks){Need ((XmlHash $task.oldXml)-ceq$task.oldXmlSha256-and(XmlHash $task.newXml)-ceq$task.newXmlSha256) 'REHEARSAL_TASK_HASH';RehearsalTaskAction $task.oldXml 'old' $task.name;RehearsalTaskAction $task.newXml 'new' $task.name}
 foreach($rule in $profile.candidateRules){VerifyRule $rule}
 foreach($role in @('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){
  $pin=$before.identities.$role;$expected=@($oldSettings.node.path,'--no-maglev',(Join-Path $oldSettings.supervisor.packageRoot 'p03-rehearsal-fixture.mjs'),'--role',$role,'--config',$oldSettings.supervisor.config.path,'--generation','old')
  Need ($pin.nodePath-ceq$oldSettings.node.path-and((Tokens $pin.commandLine)|ConvertTo-Json -Compress)-ceq($expected|ConvertTo-Json -Compress)) 'REHEARSAL_OLD_ARGV'
 }
 foreach($index in 0,1){$name=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')[$index];$task=@($before.tasks|Where-Object{$_.name-ceq$name});Need ($task.Count-eq1-and$task[0].PSObject.Properties.Name-ccontains'enginePid') 'REHEARSAL_OLD_COM';$pin=@($profile.oldWatchers|Where-Object{$_.pid-eq$task[0].enginePid});Need ($pin.Count-eq1) 'REHEARSAL_OLD_WATCHER';$leaf=@('p03-rehearsal-watch-core.ps1','p03-rehearsal-watch-hub.ps1')[$index];$expected=@($profile.shell.path,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',(Join-Path $oldSettings.supervisor.packageRoot $leaf),'-StartupConfigPath',$profile.oldSettings.path,'-StartupConfigSha256',$profile.oldSettings.sha256);Need ($pin[0].nodePath-ceq$profile.shell.path-and((Tokens $pin[0].commandLine)|ConvertTo-Json -Compress)-ceq($expected|ConvertTo-Json -Compress)) 'REHEARSAL_OLD_WATCHER_ARGV'}
 Need ($profile.cloneProof.path-ceq(Join-Path $runRoot 'clone-proof.json')-and$profile.cloneProof.sha256-ceq'e820511b06f64c21b0fe9c0a1338af355f0e440bdfe0459136cdb14cfe2f5353') 'REHEARSAL_CLONE_PROOF';[void](ReadPinned $profile.cloneProof.path $profile.cloneProof.sha256)
}
function AssertCurrentB142RehearsalClaim($claim,$profile,$before,[string]$profilePath,[string]$profileSha,[string]$beforePath,[string]$beforeSha,[string]$claimPath,[DateTime]$admissionTime,[bool]$recovery=$false){
 function RClaimNeed($value){if(-not$value){throw 'P03_CURRENT_B142_REHEARSAL_CLAIM'}}
 function RClaimSame($a,$b){return ($a|ConvertTo-Json -Depth 20 -Compress)-ceq($b|ConvertTo-Json -Depth 20 -Compress)}
 $root=Join-Path 'C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018' ('run-'+$before.runId)
 $keys=@('schemaVersion','runId','profileRef','beforeRef','newSettings','currentOwnerDigest','ownerObservedAt','stopOrderDigest','transitionAuthority','applyExecuted')
 RClaimNeed ((@($claim.PSObject.Properties.Name|Sort-Object)-join'|')-ceq(($keys|Sort-Object)-join'|')-and$claim.schemaVersion-ceq'melisa-p03-current-b142-rehearsal-claim.v1'-and$claim.runId-ceq$before.runId-and$claimPath-ceq(Join-Path $root 'rehearsal-claim.json')-and$claim.transitionAuthority-ceq$true-and$claim.applyExecuted-ceq$false)
 foreach($ref in @($claim.profileRef,$claim.beforeRef,$claim.newSettings)){RClaimNeed ((@($ref.PSObject.Properties.Name|Sort-Object)-join'|')-ceq'path|sha256'-and$ref.sha256-cmatch'\A[a-f0-9]{64}\z')}
 RClaimNeed ($claim.profileRef.path-ceq$profilePath-and$claim.profileRef.sha256-ceq$profileSha-and$claim.beforeRef.path-ceq$beforePath-and$claim.beforeRef.sha256-ceq$beforeSha-and(RClaimSame $claim.newSettings $profile.newSettings)-and$claim.currentOwnerDigest-cmatch'\A[a-f0-9]{64}\z'-and$claim.stopOrderDigest-cmatch'\A[a-f0-9]{64}\z')
 $epoch=[DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime();RClaimNeed ($epoch-ge[DateTime]::Parse($before.observedAt).ToUniversalTime())
 if(-not$recovery){$age=($admissionTime.ToUniversalTime()-$epoch).TotalSeconds;RClaimNeed ($age-ge0-and$age-lt60)}
}
function AssertCurrentB007InspectionContract($profile,$before,$oldSettings,$newSettings,[string]$profilePath,[string]$beforePath,[string]$beforeSha,[DateTime]$now){
 function B264Need($ok){if(-not $ok){throw 'P03_B264_INSPECTION_CONTRACT'}}
 function B264Same($a,$b){return ($a|ConvertTo-Json -Depth 20 -Compress) -ceq ($b|ConvertTo-Json -Depth 20 -Compress)}
 $root='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 $db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82'
 $oldPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'
 $oldSha='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'
 $newPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'
 B264Need ($profile.newSettings.sha256 -ceq '800329af39652d7fcf111a2b8441d7a00cb0bef94b37668e2ed261e4324ba329')
 B264Need ($before.runId -cmatch '\A[a-f0-9]{32}\z' -and $before.runId -cnotin @('639e2da815e1e7ac0f1c0d04d7f7bdc3','7b0821959737f1da0427b17a7dfd4685','b264594b6f93d560d807c8decc4e6699'))
 B264Need ($profilePath -ceq (Join-Path $root ('MelisaERP-P03-profile-'+$before.runId+'.json')) -and $beforePath -ceq (Join-Path $root ('MelisaERP-P03-before-'+$before.runId+'.json')) -and $profile.beforeImage.path -ceq $beforePath -and $profile.beforeImage.sha256 -ceq $beforeSha)
 B264Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $db -and $before.database -ceq $db -and $before.copyId -ceq $copy -and $before.actualT1 -ceq $false)
 $age=($now.ToUniversalTime()-[DateTime]::Parse($before.observedAt).ToUniversalTime()).TotalSeconds;B264Need ($age -ge 0 -and $age -lt 900)
 B264Need ($profile.oldSettings.path -ceq $oldPath -and $profile.oldSettings.sha256 -ceq $oldSha -and $profile.newSettings.path -ceq $newPath -and $profile.newSettings.sha256 -cmatch '\A[a-f0-9]{64}\z' -and $profile.newSettings.sha256 -cnotin @($oldSha,'fec69870a70631bcb6cfd2df70bf1566d2ab66eb5b09f7ac96c54ac29f749417') -and (B264Same $before.oldConfig $profile.oldSettings) -and (B264Same $before.newConfig $profile.newSettings))
 B264Need ($before.plan.oldSettingsSha256 -ceq $oldSha -and $before.plan.newSettingsSha256 -ceq $profile.newSettings.sha256)
 foreach($settings in @($oldSettings,$newSettings)){B264Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $db -and $settings.copyId -ceq $copy -and $settings.actualT1 -ceq $false)}
 $fixed=@(
 @($oldSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae','e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),
 @($oldSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a','13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'),
 @($oldSettings.components.crm,'C:\Sirket\CRM\releases\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),
 @($oldSettings.components.nativeOrder,'C:\Sirket\ERP\releases\CRM-ORDER-DRAFT-TEST-20261013-7a41f64','7a41f6492273dd1ec0bcb086f820be5575372be8','6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'),
 @($newSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261020-6dc33f41','6dc33f41737349c6e3f17fb867a451b570a00acc','6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49'),
 @($newSettings.components.crm,'C:\Sirket\CRM\releases\node-v24.19.0\crm-shared-test-d1e4425206249e38445fb103e03601f86baa84ec','d1e4425206249e38445fb103e03601f86baa84ec','a0e86fccbdb95eeb97e4dc08e383db7bf8f12a29b040f34a78f6c37e3093b5ef'),
 @($newSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-da5b39491994','da5b394919941f73b9d7098f146fffd362c2a955','b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf')
 )
 B264Need (@($profile.packages).Count -eq 7 -and @($profile.packages|Select-Object -ExpandProperty root -Unique).Count -eq 7)
 foreach($f in $fixed){B264Need ($f[0].packageRoot -ceq $f[1] -and $f[0].sourceCommit -ceq $f[2] -and $f[0].manifestSha256 -ceq $f[3]);B264Need (@($profile.packages|Where-Object{$_.root -ceq $f[1] -and $_.sourceCommit -ceq $f[2] -and $_.manifestSha256 -ceq $f[3] -and $_.manifestPath -ceq ($f[1]+'\release-manifest.json')}).Count -eq 1)}
 B264Need (B264Same $oldSettings.components.nativeOrder $newSettings.components.nativeOrder)
 foreach($crm in @($oldSettings.components.crm,$newSettings.components.crm)){B264Need ((@($crm.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'config|manifestSha256|packageRoot|sourceCommit' -and (@($crm.config.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'path|sha256')}
 B264Need ($oldSettings.components.crm.config.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $oldSettings.components.crm.config.sha256 -ceq '9b484883f89584225bcd5242b7f501a38feb6a1bbaa22d8a8e17accf302785ab')
 B264Need ($newSettings.components.crm.config.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-d1e442520624-erp-6dc33f417373-current.json' -and $newSettings.components.crm.config.sha256 -ceq '0ef6eb422be2522743753d2b2d9f24f3cbf5c6a3d8b45a904540478e112a3449')
 foreach($settings in @($oldSettings,$newSettings)){B264Need ($settings.node.path -ceq 'C:\Sirket\ERP\tools\node-v24.19.0\node.exe' -and $settings.node.sha256 -ceq '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237')}
 foreach($key in @('packageRoot','sourceCommit','manifestSha256')){B264Need ($oldSettings.components.hub.$key -ceq $oldSettings.components.erpApiNative.$key -and $newSettings.components.hub.$key -ceq $newSettings.components.erpApiNative.$key)}
 foreach($pair in @(@('erp',$newSettings.components.erpApiNative),@('crm',$newSettings.components.crm),@('supervisor',$newSettings.supervisor))){B264Need ($before.profile.($pair[0]+'Source') -ceq $pair[1].sourceCommit -and $before.profile.($pair[0]+'Manifest') -ceq $pair[1].manifestSha256)}
 B264Need ($before.oldSupervisor.root -ceq $oldSettings.supervisor.packageRoot -and $before.oldSupervisor.manifest -ceq $oldSettings.supervisor.manifestSha256)
 B264Need ((@($before.identities.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'coreSupervisor|crmCatalog|crmNativeOrder|crmOrders|crmServer|erpApi|erpNative|hub')
 B264Need (@($profile.oldWatchers).Count -eq 2 -and @($profile.tasks).Count -eq 2 -and @($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -ccontains 'kind' -and $_.kind -ceq 'ProtectedSqlService'}).Count -eq 1)
 $all=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)
 B264Need (@($all|Select-Object -ExpandProperty pid -Unique).Count -eq 10)
 foreach($p in $all){B264Need ($p.pid -gt 0 -and $p.ownerSid -ceq $owner -and $p.creationTime -is [string] -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -le [DateTime]::Parse($before.observedAt).ToUniversalTime())}
 foreach($name in @('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')){B264Need (@($profile.tasks|Where-Object{$_.name -ceq $name}).Count -eq 1)}
}
function AssertCurrentB007StaticContract($profile,$before,$oldSettings,$newSettings,[string]$profilePath,[string]$beforePath,[string]$beforeSha){
 function B264Need($ok){if(-not $ok){throw 'P03_B264_INSPECTION_CONTRACT'}}
 function B264Same($a,$b){return ($a|ConvertTo-Json -Depth 20 -Compress) -ceq ($b|ConvertTo-Json -Depth 20 -Compress)}
 $root='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 $db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82'
 $oldPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'
 $oldSha='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'
 $newPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'
 B264Need ($profile.newSettings.sha256 -ceq '800329af39652d7fcf111a2b8441d7a00cb0bef94b37668e2ed261e4324ba329')
 B264Need ($before.runId -cmatch '\A[a-f0-9]{32}\z' -and $before.runId -cnotin @('639e2da815e1e7ac0f1c0d04d7f7bdc3','7b0821959737f1da0427b17a7dfd4685','b264594b6f93d560d807c8decc4e6699'))
 B264Need ($profilePath -ceq (Join-Path $root ('MelisaERP-P03-profile-'+$before.runId+'.json')) -and $beforePath -ceq (Join-Path $root ('MelisaERP-P03-before-'+$before.runId+'.json')) -and $profile.beforeImage.path -ceq $beforePath -and $profile.beforeImage.sha256 -ceq $beforeSha)
 B264Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $db -and $before.database -ceq $db -and $before.copyId -ceq $copy -and $before.actualT1 -ceq $false)
 B264Need ($profile.oldSettings.path -ceq $oldPath -and $profile.oldSettings.sha256 -ceq $oldSha -and $profile.newSettings.path -ceq $newPath -and $profile.newSettings.sha256 -cmatch '\A[a-f0-9]{64}\z' -and $profile.newSettings.sha256 -cnotin @($oldSha,'fec69870a70631bcb6cfd2df70bf1566d2ab66eb5b09f7ac96c54ac29f749417') -and (B264Same $before.oldConfig $profile.oldSettings) -and (B264Same $before.newConfig $profile.newSettings))
 B264Need ($before.plan.oldSettingsSha256 -ceq $oldSha -and $before.plan.newSettingsSha256 -ceq $profile.newSettings.sha256)
 foreach($settings in @($oldSettings,$newSettings)){B264Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $db -and $settings.copyId -ceq $copy -and $settings.actualT1 -ceq $false)}
 $fixed=@(
 @($oldSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae','e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),
 @($oldSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a','13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'),
 @($oldSettings.components.crm,'C:\Sirket\CRM\releases\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),
 @($oldSettings.components.nativeOrder,'C:\Sirket\ERP\releases\CRM-ORDER-DRAFT-TEST-20261013-7a41f64','7a41f6492273dd1ec0bcb086f820be5575372be8','6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'),
 @($newSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261020-6dc33f41','6dc33f41737349c6e3f17fb867a451b570a00acc','6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49'),
 @($newSettings.components.crm,'C:\Sirket\CRM\releases\node-v24.19.0\crm-shared-test-d1e4425206249e38445fb103e03601f86baa84ec','d1e4425206249e38445fb103e03601f86baa84ec','a0e86fccbdb95eeb97e4dc08e383db7bf8f12a29b040f34a78f6c37e3093b5ef'),
 @($newSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-da5b39491994','da5b394919941f73b9d7098f146fffd362c2a955','b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf')
 )
 B264Need (@($profile.packages).Count -eq 7 -and @($profile.packages|Select-Object -ExpandProperty root -Unique).Count -eq 7)
 foreach($f in $fixed){B264Need ($f[0].packageRoot -ceq $f[1] -and $f[0].sourceCommit -ceq $f[2] -and $f[0].manifestSha256 -ceq $f[3]);B264Need (@($profile.packages|Where-Object{$_.root -ceq $f[1] -and $_.sourceCommit -ceq $f[2] -and $_.manifestSha256 -ceq $f[3] -and $_.manifestPath -ceq ($f[1]+'\release-manifest.json')}).Count -eq 1)}
 B264Need (B264Same $oldSettings.components.nativeOrder $newSettings.components.nativeOrder)
 foreach($crm in @($oldSettings.components.crm,$newSettings.components.crm)){B264Need ((@($crm.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'config|manifestSha256|packageRoot|sourceCommit' -and (@($crm.config.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'path|sha256')}
 B264Need ($oldSettings.components.crm.config.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $oldSettings.components.crm.config.sha256 -ceq '9b484883f89584225bcd5242b7f501a38feb6a1bbaa22d8a8e17accf302785ab')
 B264Need ($newSettings.components.crm.config.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-d1e442520624-erp-6dc33f417373-current.json' -and $newSettings.components.crm.config.sha256 -ceq '0ef6eb422be2522743753d2b2d9f24f3cbf5c6a3d8b45a904540478e112a3449')
 foreach($settings in @($oldSettings,$newSettings)){B264Need ($settings.node.path -ceq 'C:\Sirket\ERP\tools\node-v24.19.0\node.exe' -and $settings.node.sha256 -ceq '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237')}
 foreach($key in @('packageRoot','sourceCommit','manifestSha256')){B264Need ($oldSettings.components.hub.$key -ceq $oldSettings.components.erpApiNative.$key -and $newSettings.components.hub.$key -ceq $newSettings.components.erpApiNative.$key)}
 foreach($pair in @(@('erp',$newSettings.components.erpApiNative),@('crm',$newSettings.components.crm),@('supervisor',$newSettings.supervisor))){B264Need ($before.profile.($pair[0]+'Source') -ceq $pair[1].sourceCommit -and $before.profile.($pair[0]+'Manifest') -ceq $pair[1].manifestSha256)}
 B264Need ($before.oldSupervisor.root -ceq $oldSettings.supervisor.packageRoot -and $before.oldSupervisor.manifest -ceq $oldSettings.supervisor.manifestSha256)
 B264Need ((@($before.identities.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'coreSupervisor|crmCatalog|crmNativeOrder|crmOrders|crmServer|erpApi|erpNative|hub')
 B264Need (@($profile.oldWatchers).Count -eq 2 -and @($profile.tasks).Count -eq 2 -and @($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -ccontains 'kind' -and $_.kind -ceq 'ProtectedSqlService'}).Count -eq 1)
 $all=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)
 B264Need (@($all|Select-Object -ExpandProperty pid -Unique).Count -eq 10)
 foreach($p in $all){B264Need ($p.pid -gt 0 -and $p.ownerSid -ceq $owner -and $p.creationTime -is [string] -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -le [DateTime]::Parse($before.observedAt).ToUniversalTime())}
 foreach($name in @('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')){B264Need (@($profile.tasks|Where-Object{$_.name -ceq $name}).Count -eq 1)}
}
function AssertB264InspectionContract($profile,$before,$oldSettings,$newSettings,[string]$profilePath,[string]$beforePath,[string]$beforeSha,[DateTime]$now){
 function B264Need($ok){if(-not $ok){throw 'P03_B264_INSPECTION_CONTRACT'}}
 function B264Same($a,$b){return ($a|ConvertTo-Json -Depth 20 -Compress) -ceq ($b|ConvertTo-Json -Depth 20 -Compress)}
 $root='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 $db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82'
 $oldPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'
 $oldSha='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'
 $newPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'
 B264Need ($before.runId -cmatch '\A[a-f0-9]{32}\z' -and $before.runId -cnotin @('639e2da815e1e7ac0f1c0d04d7f7bdc3','7b0821959737f1da0427b17a7dfd4685','b264594b6f93d560d807c8decc4e6699'))
 B264Need ($profilePath -ceq (Join-Path $root ('MelisaERP-P03-profile-'+$before.runId+'.json')) -and $beforePath -ceq (Join-Path $root ('MelisaERP-P03-before-'+$before.runId+'.json')) -and $profile.beforeImage.path -ceq $beforePath -and $profile.beforeImage.sha256 -ceq $beforeSha)
 B264Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $db -and $before.database -ceq $db -and $before.copyId -ceq $copy -and $before.actualT1 -ceq $false)
 $age=($now.ToUniversalTime()-[DateTime]::Parse($before.observedAt).ToUniversalTime()).TotalSeconds;B264Need ($age -ge 0 -and $age -lt 900)
 B264Need ($profile.oldSettings.path -ceq $oldPath -and $profile.oldSettings.sha256 -ceq $oldSha -and $profile.newSettings.path -ceq $newPath -and $profile.newSettings.sha256 -cmatch '\A[a-f0-9]{64}\z' -and $profile.newSettings.sha256 -cnotin @($oldSha,'fec69870a70631bcb6cfd2df70bf1566d2ab66eb5b09f7ac96c54ac29f749417') -and (B264Same $before.oldConfig $profile.oldSettings) -and (B264Same $before.newConfig $profile.newSettings))
 B264Need ($before.plan.oldSettingsSha256 -ceq $oldSha -and $before.plan.newSettingsSha256 -ceq $profile.newSettings.sha256)
 foreach($settings in @($oldSettings,$newSettings)){B264Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $db -and $settings.copyId -ceq $copy -and $settings.actualT1 -ceq $false)}
 $fixed=@(
 @($oldSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae','e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),
 @($oldSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a','13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'),
 @($oldSettings.components.crm,'C:\Sirket\CRM\releases\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),
 @($oldSettings.components.nativeOrder,'C:\Sirket\ERP\releases\CRM-ORDER-DRAFT-TEST-20261013-7a41f64','7a41f6492273dd1ec0bcb086f820be5575372be8','6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'),
 @($newSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a','01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2','8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'),
 @($newSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-eb5b37a555cb','eb5b37a555cbf18e1fcaa491820707c73b354e12','1a9d7a0ba6d0ed0fa60e9044122fb895e58e725d84f194ceea255a00aece39b0')
 )
 B264Need (@($profile.packages).Count -eq 6 -and @($profile.packages|Select-Object -ExpandProperty root -Unique).Count -eq 6)
 foreach($f in $fixed){B264Need ($f[0].packageRoot -ceq $f[1] -and $f[0].sourceCommit -ceq $f[2] -and $f[0].manifestSha256 -ceq $f[3]);B264Need (@($profile.packages|Where-Object{$_.root -ceq $f[1] -and $_.sourceCommit -ceq $f[2] -and $_.manifestSha256 -ceq $f[3] -and $_.manifestPath -ceq ($f[1]+'\release-manifest.json')}).Count -eq 1)}
 foreach($component in @('crm','nativeOrder')){B264Need (B264Same $oldSettings.components.$component $newSettings.components.$component)}
 foreach($pair in @(@('erp',$newSettings.components.erpApiNative),@('crm',$newSettings.components.crm),@('supervisor',$newSettings.supervisor))){B264Need ($before.profile.($pair[0]+'Source') -ceq $pair[1].sourceCommit -and $before.profile.($pair[0]+'Manifest') -ceq $pair[1].manifestSha256)}
 B264Need ($before.oldSupervisor.root -ceq $oldSettings.supervisor.packageRoot -and $before.oldSupervisor.manifest -ceq $oldSettings.supervisor.manifestSha256)
 B264Need ((@($before.identities.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'coreSupervisor|crmCatalog|crmNativeOrder|crmOrders|crmServer|erpApi|erpNative|hub')
 B264Need (@($profile.oldWatchers).Count -eq 2 -and @($profile.tasks).Count -eq 2 -and @($profile.protectedProcesses|Where-Object{$_.kind -ceq 'ProtectedSqlService'}).Count -eq 1)
 $all=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)
 B264Need (@($all|Select-Object -ExpandProperty pid -Unique).Count -eq 10)
 foreach($p in $all){B264Need ($p.pid -gt 0 -and $p.ownerSid -ceq $owner -and $p.creationTime -is [string] -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -le [DateTime]::Parse($before.observedAt).ToUniversalTime())}
 foreach($name in @('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')){B264Need (@($profile.tasks|Where-Object{$_.name -ceq $name}).Count -eq 1)}
}
function AssertB264Sup20DInspectionContract($profile,$before,$oldSettings,$newSettings,[string]$profilePath,[string]$beforePath,[string]$beforeSha,[DateTime]$now){
 function B264Need($ok){if(-not $ok){throw 'P03_B264_INSPECTION_CONTRACT'}}
 function B264Same($a,$b){return ($a|ConvertTo-Json -Depth 20 -Compress) -ceq ($b|ConvertTo-Json -Depth 20 -Compress)}
 $root='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
 $db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82'
 $oldPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'
 $oldSha='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'
 $newPath='C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'
 B264Need ($profile.newSettings.sha256 -ceq 'f893faf4a1113fab3fdcdfce181e219f1bee480be4b6ab4142a738e47c094c95')
 B264Need ($before.runId -cmatch '\A[a-f0-9]{32}\z' -and $before.runId -cnotin @('639e2da815e1e7ac0f1c0d04d7f7bdc3','7b0821959737f1da0427b17a7dfd4685','b264594b6f93d560d807c8decc4e6699'))
 B264Need ($profilePath -ceq (Join-Path $root ('MelisaERP-P03-profile-'+$before.runId+'.json')) -and $beforePath -ceq (Join-Path $root ('MelisaERP-P03-before-'+$before.runId+'.json')) -and $profile.beforeImage.path -ceq $beforePath -and $profile.beforeImage.sha256 -ceq $beforeSha)
 B264Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $db -and $before.database -ceq $db -and $before.copyId -ceq $copy -and $before.actualT1 -ceq $false)
 $age=($now.ToUniversalTime()-[DateTime]::Parse($before.observedAt).ToUniversalTime()).TotalSeconds;B264Need ($age -ge 0 -and $age -lt 900)
 B264Need ($profile.oldSettings.path -ceq $oldPath -and $profile.oldSettings.sha256 -ceq $oldSha -and $profile.newSettings.path -ceq $newPath -and $profile.newSettings.sha256 -cmatch '\A[a-f0-9]{64}\z' -and $profile.newSettings.sha256 -cnotin @($oldSha,'fec69870a70631bcb6cfd2df70bf1566d2ab66eb5b09f7ac96c54ac29f749417') -and (B264Same $before.oldConfig $profile.oldSettings) -and (B264Same $before.newConfig $profile.newSettings))
 B264Need ($before.plan.oldSettingsSha256 -ceq $oldSha -and $before.plan.newSettingsSha256 -ceq $profile.newSettings.sha256)
 foreach($settings in @($oldSettings,$newSettings)){B264Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $db -and $settings.copyId -ceq $copy -and $settings.actualT1 -ceq $false)}
 $fixed=@(
 @($oldSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae','e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),
 @($oldSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a','13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'),
 @($oldSettings.components.crm,'C:\Sirket\CRM\releases\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),
 @($oldSettings.components.nativeOrder,'C:\Sirket\ERP\releases\CRM-ORDER-DRAFT-TEST-20261013-7a41f64','7a41f6492273dd1ec0bcb086f820be5575372be8','6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'),
 @($newSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a','01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2','8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'),
 @($newSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-20d7e5b69696','20d7e5b696969d502014ba359b950496dc530410','0959b1b84faafe2e297e537d470d6b6d443e6fac2fe30d3f2518f5b6036d1418')
 )
 B264Need (@($profile.packages).Count -eq 6 -and @($profile.packages|Select-Object -ExpandProperty root -Unique).Count -eq 6)
 foreach($f in $fixed){B264Need ($f[0].packageRoot -ceq $f[1] -and $f[0].sourceCommit -ceq $f[2] -and $f[0].manifestSha256 -ceq $f[3]);B264Need (@($profile.packages|Where-Object{$_.root -ceq $f[1] -and $_.sourceCommit -ceq $f[2] -and $_.manifestSha256 -ceq $f[3] -and $_.manifestPath -ceq ($f[1]+'\release-manifest.json')}).Count -eq 1)}
 # SUP20D keeps the identical CRM activation bytes at two exact generation paths.
 B264Need (B264Same $oldSettings.components.nativeOrder $newSettings.components.nativeOrder)
 foreach($crm in @($oldSettings.components.crm,$newSettings.components.crm)){
  B264Need ((@($crm.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'config|manifestSha256|packageRoot|sourceCommit')
  B264Need ($crm.packageRoot -ceq 'C:\Sirket\CRM\releases\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a' -and $crm.sourceCommit -ceq '6bc82e6fe9726261ef1d0171d97e5d9da9f5398a' -and $crm.manifestSha256 -ceq 'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83')
  B264Need ((@($crm.config.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'path|sha256' -and $crm.config.sha256 -ceq '9b484883f89584225bcd5242b7f501a38feb6a1bbaa22d8a8e17accf302785ab')
 }
 B264Need ($oldSettings.components.crm.config.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $newSettings.components.crm.config.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\crm-activation-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json')
 foreach($pair in @(@('erp',$newSettings.components.erpApiNative),@('crm',$newSettings.components.crm),@('supervisor',$newSettings.supervisor))){B264Need ($before.profile.($pair[0]+'Source') -ceq $pair[1].sourceCommit -and $before.profile.($pair[0]+'Manifest') -ceq $pair[1].manifestSha256)}
 B264Need ($before.oldSupervisor.root -ceq $oldSettings.supervisor.packageRoot -and $before.oldSupervisor.manifest -ceq $oldSettings.supervisor.manifestSha256)
 B264Need ((@($before.identities.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'coreSupervisor|crmCatalog|crmNativeOrder|crmOrders|crmServer|erpApi|erpNative|hub')
 B264Need (@($profile.oldWatchers).Count -eq 2 -and @($profile.tasks).Count -eq 2 -and @($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -ccontains 'kind' -and $_.kind -ceq 'ProtectedSqlService'}).Count -eq 1)
 $all=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)
 B264Need (@($all|Select-Object -ExpandProperty pid -Unique).Count -eq 10)
 foreach($p in $all){B264Need ($p.pid -gt 0 -and $p.ownerSid -ceq $owner -and $p.creationTime -is [string] -and [DateTime]::Parse($p.creationTime).ToUniversalTime() -le [DateTime]::Parse($before.observedAt).ToUniversalTime())}
 foreach($name in @('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')){B264Need (@($profile.tasks|Where-Object{$_.name -ceq $name}).Count -eq 1)}
}
function WorkerSamePin($a,$b){
 return $null -ne $a -and $null -ne $b -and $a.pid -eq $b.pid -and $a.parentPid -eq $b.parentPid -and $a.ownerSid -ceq $b.ownerSid -and $a.nodePath -ceq $b.nodePath -and $a.commandLine -ceq $b.commandLine -and [DateTime]::Parse($a.creationTime).ToUniversalTime().Ticks -eq [DateTime]::Parse($b.creationTime).ToUniversalTime().Ticks
}
function WorkerAuthority{
 if($PolicyGeneration-ceq'CurrentB142Rehearsal'){
  AssertCurrentB142RehearsalContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256
  Need ($EnginePath-ceq(Join-Path $runRoot 'recovery-engine.ps1')) 'REHEARSAL_ENGINE'
  foreach($pin in @(@($ProfilePath,$ProfileSha256),@($BeforeImagePath,$BeforeImageSha256),@($EnginePath,$engineSha),@($RecoveryHelperPath,$RecoveryHelperSha256),@($profile.oldSettings.path,$profile.oldSettings.sha256),@($profile.newSettings.path,$profile.newSettings.sha256))){[void](ReadWorkerPin $pin[0] $pin[1])}
  AssertCurrentB142RehearsalFiles $profile $oldSettings $newSettings;return
 }

 if($PolicyGeneration -cin @('B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly')){
  foreach($entry in @(@($EnginePath,$(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'p03-physical-rollback-lifetime-v2.ps1'}else{'p03-physical-rollback.ps1'})),@($RecoveryHelperPath,'p03-pr54-paused-old-recover.ps1'))){Need ($entry[0].StartsWith($base+'\',[StringComparison]::Ordinal) -and [IO.Path]::GetFileName($entry[0]) -ceq $entry[1]) 'B264_HELPER_SCOPE'}
  foreach($r in @(@($ProfilePath,$ProfileSha256),@($BeforeImagePath,$BeforeImageSha256),@($EnginePath,$engineSha),@($RecoveryHelperPath,$RecoveryHelperSha256),@($profile.oldSettings.path,$profile.oldSettings.sha256),@($profile.newSettings.path,$profile.newSettings.sha256))){[void](ReadWorkerPin $r[0] $r[1])}
  if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){AssertCurrentB007InspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}elseif($PolicyGeneration -ceq 'B264Sup20DInspectOnly'){AssertB264Sup20DInspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}else{AssertB264InspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}
  return
 }
 $currentReadRepair=($profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.oldSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $profile.newSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json');if($currentReadRepair){$predecessor='7b0821959737f1da0427b17a7dfd4685'}
 [void](ReadWorkerPin $ProfilePath $ProfileSha256);[void](ReadWorkerPin $BeforeImagePath $BeforeImageSha256);[void](ReadWorkerPin $EnginePath $engineSha);[void](ReadWorkerPin $RecoveryHelperPath $RecoveryHelperSha256)
 Need ($runId -cmatch '\A[a-f0-9]{32}\z' -and $runId -cne $predecessor -and $ProfilePath -ceq (Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json')) -and $BeforeImagePath -ceq (Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json'))) 'SUCCESSOR_RUN_SCOPE'
 if($Mode -ceq 'Inspect'){
  # Initial and claim-CAS inspections precede the frozen transition directory.
  # Only already pinned private source files under this owner root may supply
  # definitions. Inspect grants neither claim admission nor any mutation.
  foreach($entry in @(@($EnginePath,$(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'p03-physical-rollback-lifetime-v2.ps1'}else{'p03-physical-rollback.ps1'})),@($RecoveryHelperPath,'p03-pr54-paused-old-recover.ps1'))){Need ([IO.Path]::GetFullPath($entry[0]) -ceq $entry[0] -and $entry[0].StartsWith($base+'\',[StringComparison]::Ordinal) -and [IO.Path]::GetFileName($entry[0]) -ceq $entry[1]) 'SUCCESSOR_INSPECT_HELPER_SCOPE'}
 }else{Need ($EnginePath -ceq (Join-Path $dir 'p03-physical-rollback.ps1') -and $RecoveryHelperPath -ceq (Join-Path $dir 'p03-pr54-paused-old-recover.ps1')) 'SUCCESSOR_HELPER_SCOPE'}
 Need ($Environment -ceq 'Shared' -and $isRehearsal -eq $false -and $profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3') 'SUCCESSOR_ENVIRONMENT'
 Need ($profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.database -ceq $database -and $before.actualT1 -eq $false) 'SUCCESSOR_PROFILE'
 if($currentReadRepair){
 Need ($oldSettings.components.erpApiNative.sourceCommit-ceq'e59e07abf7ae2567cdc2adb93811fe29e0032fe5'-and$oldSettings.supervisor.sourceCommit-ceq'13bdf75a032ae8f694354a2e57b6ed382aec2f17'-and$newSettings.components.erpApiNative.sourceCommit-ceq'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'-and$newSettings.components.erpApiNative.manifestSha256-ceq'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'-and$newSettings.supervisor.packageRoot-ceq('C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-'+$newSettings.supervisor.sourceCommit.Substring(0,12))-and$before.newConfig.sha256-ceq$profile.newSettings.sha256) 'CURRENT_SUCCESSOR_SETTINGS'
 }else{
 Need ($profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071') 'SUCCESSOR_SETTINGS'
 }
 foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false) 'SUCCESSOR_SETTINGS_SCOPE'}
 [void](ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);[void](ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
 $stopDigest=Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{planDigest=$before.plan.digest;stopOrder=$order}|ConvertTo-Json -Compress)))
 if($Mode -cne 'Inspect'){
  Need (-not [string]::IsNullOrEmpty($ClaimPath) -and $ClaimSha256 -cmatch '\A[a-f0-9]{64}\z') 'SUCCESSOR_CLAIM_REQUIRED'
  Need ($ClaimPath -ceq (Join-Path $base ('p03-pr54-successor-of-'+$predecessor+'.lock.json'))) 'SUCCESSOR_CLAIM_PATH'
  $claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256)
  if($currentReadRepair){
  Need ($ClaimPath-ceq(Join-Path $base 'p03-pr54-successor-of-7b0821959737f1da0427b17a7dfd4685.lock.json')-and$claim.schemaVersion-ceq'melisa-p03-current-owner-successor-claim.v1'-and$claim.predecessorRunId-ceq$predecessor-and$claim.successorRunId-ceq$runId-and$claim.successorProfile.path-ceq$ProfilePath-and$claim.successorProfile.sha256-ceq$ProfileSha256-and$claim.successorBefore.path-ceq$BeforeImagePath-and$claim.successorBefore.sha256-ceq$BeforeImageSha256-and$claim.stopOrderDigest-ceq$stopDigest-and$claim.newSettings.path-ceq$profile.newSettings.path-and$claim.newSettings.sha256-ceq$profile.newSettings.sha256-and$claim.candidate.erpSource-ceq$newSettings.components.erpApiNative.sourceCommit-and$claim.candidate.erpManifest-ceq$newSettings.components.erpApiNative.manifestSha256-and$claim.candidate.supervisorSource-ceq$newSettings.supervisor.sourceCommit-and$claim.candidate.supervisorManifest-ceq$newSettings.supervisor.manifestSha256-and$claim.candidate.supervisorRoot-ceq$newSettings.supervisor.packageRoot-and$claim.readOnlyNewReady.sha256-ceq'37d19530131f006d8332827f673d7e35284f891b081875653df6b60383be1f5d'-and$claim.quarantinedController.sha256-ceq'7e47bd7fa12baf349783b229a6aa80c48dcb9e7231063c0c76a7c18aca3b9fe2') 'CURRENT_SUCCESSOR_CLAIM'
  }else{
  Need ($claim.schemaVersion -ceq 'melisa-p03-owner-successor-claim.v1' -and $claim.predecessorRunId -ceq $predecessor -and $claim.successorRunId -ceq $runId -and $claim.successorProfile.path -ceq $ProfilePath -and $claim.successorProfile.sha256 -ceq $ProfileSha256 -and $claim.successorBefore.path -ceq $BeforeImagePath -and $claim.successorBefore.sha256 -ceq $BeforeImageSha256 -and $claim.engineSha256 -ceq $engineSha -and $claim.stopOrderDigest -ceq $stopDigest) 'SUCCESSOR_CLAIM'
  }
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
function Inventory{
 # Keep the same complete inventories as fe; take CIM after slower network
 # and COM enumeration so ephemeral probe SID reads use the newest frame.
 $allListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 $listeners=@($allListeners|Where-Object{$_.LocalPort -in $ports})
 $running=$schedule.GetRunningTasks(1);$instances=@()
 for($i=1;$i -le $running.Count;$i++){$r=$running.Item($i);if($r.Name -cin $names){$instances+=,$r}}
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 return [pscustomobject]@{all=$all;allListeners=$allListeners;listeners=$listeners;instances=$instances}
}
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
function GetCurrentB007ProtectedConsolePins($inventory){
 Need ($PolicyGeneration -ceq 'CurrentB007InspectOnly' -and -not $script:tasksStopRequested) 'CURRENT_PROTECTED_CONSOLE_SCOPE'
 ProtectedProcesses $inventory
 $parents=@($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -cnotcontains 'kind'})
 Need ($parents.Count -le 64 -and @($parents|Select-Object -ExpandProperty pid -Unique).Count -eq $parents.Count) 'CURRENT_PROTECTED_CONSOLE_PARENTS'
 $ownedPids=@($order|ForEach-Object{$before.identities.$_.pid})+@($profile.oldWatchers|ForEach-Object{$_.pid})+@($script:probePins.Keys)+@($script:consolePins.Keys)
 foreach($parent in $parents){
  $actual=@($inventory.all|Where-Object{$_.ProcessId -eq $parent.pid})
  Need ($parent.pid -gt 0 -and $parent.pid -notin $ownedPids -and $parent.ownerSid -ceq $owner -and $actual.Count -eq 1 -and (Identity $actual[0] $parent)) 'CURRENT_PROTECTED_CONSOLE_PARENT_IDENTITY'
 }
 if(-not (Get-Variable protectedConsolePins -Scope Script -ErrorAction SilentlyContinue)){$script:protectedConsolePins=@{}}
 $ownedCache=$script:consolePins
 Need (-not [object]::ReferenceEquals($ownedCache,$script:protectedConsolePins)) 'CURRENT_PROTECTED_CONSOLE_CACHE'
 try{
  # Reuse the unmodified native classifier with an isolated cache. Its binary,
  # signature, owner, parent/birth, cached-lifetime and no-listener checks stay
  # intact; these pins never enter the owned console or process-stop cohort.
  $script:consolePins=$script:protectedConsolePins
  $allowed=@(ConsoleAuxiliaries $inventory $parents)
  $pins=@(foreach($id in $allowed){Need ($id -notin $ownedPids) 'CURRENT_PROTECTED_CONSOLE_OVERLAP';$script:protectedConsolePins[[int]$id]})
  return $pins
 }finally{$script:consolePins=$ownedCache}
}

function CurrentSameCaptureAuditFrame($native){
 function AuditSame($a,$b){return ($a|ConvertTo-Json -Depth 25 -Compress)-ceq($b|ConvertTo-Json -Depth 25 -Compress)}
 Need ($PolicyGeneration-ceq'CurrentB007InspectOnly'-and$Mode-ceq'Inspect'-and$null-ne$native-and$native.schemaVersion-ceq'melisa-p03-native-inventory.v1'-and$native.id-cmatch'\A[a-f0-9]{32}\z') 'SAME_CAPTURE_AUDIT_SCOPE'
 $context=$native.readOnlyAudits
 Need ((@($context.PSObject.Properties.Name|Sort-Object)-join'|')-ceq'audits|capture|captureId|policy|rawSnapshot|recheck|schemaVersion'-and$context.schemaVersion-ceq'melisa-p03-native-vanished-audits.v1'-and$context.captureId-ceq$native.id-and[object]::ReferenceEquals($context.capture,$native)-and[object]::ReferenceEquals($context.rawSnapshot.all,$native.all)-and[object]::ReferenceEquals($context.rawSnapshot.allListeners,$native.allListeners)) 'SAME_CAPTURE_AUDIT_NATIVE_BINDING'
 $commands=@(Get-Command -Name ObserverAssertVanishedAudits -CommandType Function -ErrorAction Stop)
 Need ($commands.Count-eq1-and$context.recheck-is[scriptblock]-and[object]::ReferenceEquals($context.recheck,$commands[0].ScriptBlock)-and(Hash ([Text.Encoding]::UTF8.GetBytes($commands[0].ScriptBlock.Ast.Extent.Text.Replace("`r`n","`n"))))-ceq'59f0f72e86f2c50ee9acbbe9f49627976a4d5f35eb31b48f2273796bf721fd37') 'SAME_CAPTURE_AUDIT_FUNCTION'
 $policy=$context.policy;$core=$before.identities.coreSupervisor
 Need ($null-ne$policy-and$policy.generation-ceq'Old'-and(WorkerSamePin $policy.core $core)-and(AuditSame $policy.profile $profile)-and(AuditSame $policy.identityMap $before.identities)-and$policy.engineRef.path-ceq$EnginePath-and$policy.engineRef.sha256-ceq$engineSha-and$policy.helperRef.path-ceq$RecoveryHelperPath-and$policy.helperRef.sha256-ceq$RecoveryHelperSha256-and(AuditSame $policy.settingsRef $profile.oldSettings)-and(AuditSame $policy.shellRef $profile.shell)-and(AuditSame $policy.nodeRef $oldSettings.node)-and$policy.manifestRef.path-ceq(Join-Path $oldSettings.supervisor.packageRoot 'release-manifest.json')-and$policy.manifestRef.sha256-ceq$oldSettings.supervisor.manifestSha256-and$policy.probeRef.path-ceq$script:probePath) 'SAME_CAPTURE_AUDIT_POLICY'
 Need ($context.audits-is[Array]-and$context.audits.Count-le128) 'SAME_CAPTURE_AUDIT_COUNT'
 $managed=@($order|ForEach-Object{$before.identities.$_.pid})+@($profile.oldWatchers|ForEach-Object{$_.pid})+@($profile.protectedProcesses|ForEach-Object{$_.pid})
 $seen=@();$probeAuditPids=@();$consoleAuditPids=@()
 foreach($audit in $context.audits){
  $auditKeys=if($audit-is[Collections.IDictionary]){@($audit.Keys)}else{@($audit.PSObject.Properties.Name)}
  Need ((@($auditKeys|Sort-Object)-join'|')-ceq'creationTime|ownerState|ownerVerified|parentPid|pid|reason'-and$audit.pid-gt0-and$audit.parentPid-gt0-and$audit.pid-ne$audit.parentPid-and$audit.pid-notin$managed-and$audit.pid-notin$seen-and$audit.ownerVerified-ceq$false-and$audit.ownerState-ceq'UNVERIFIED_EXITED') 'SAME_CAPTURE_AUDIT_RECORD'
  $seen+=,[int]$audit.pid;$rows=@($native.all|Where-Object{$_.ProcessId-eq$audit.pid})
  Need ($rows.Count-eq1-and$rows[0].ParentProcessId-eq$audit.parentPid-and$rows[0].CreationDate-is[DateTime]-and$rows[0].CreationDate.ToUniversalTime().Ticks-eq[DateTime]::Parse($audit.creationTime).ToUniversalTime().Ticks-and@($native.allListeners|Where-Object{$_.OwningProcess-eq$audit.pid}).Count-eq0) 'SAME_CAPTURE_AUDIT_RAW_IDENTITY'
  $row=$rows[0];Need ($row.CreationDate.ToUniversalTime()-le[DateTime]::UtcNow) 'SAME_CAPTURE_AUDIT_FUTURE'
  if($audit.reason-ceq'CIM_NOT_FOUND_CONFIRMED_ABSENT_APPROVED_RO_PROBE'){
   Need ($row.Name-ieq'powershell.exe'-and$row.ExecutablePath-ieq$profile.shell.path-and$row.ParentProcessId-eq$core.pid-and$row.CreationDate.ToUniversalTime()-ge[DateTime]::Parse($core.creationTime).ToUniversalTime()-and(ProbeArgumentsAllowed (Tokens $row.CommandLine) $script:probePath)) 'SAME_CAPTURE_AUDIT_PROBE'
   $probeAuditPids+=,[int]$audit.pid
  }else{
   Need ($audit.reason-ceq'CIM_NOT_FOUND_CONFIRMED_ABSENT_STANDARD_CONSOLE'-and$row.Name-ieq'conhost.exe'-and$row.ExecutablePath-ieq'C:\Windows\System32\conhost.exe'-and$row.CommandLine-ceq'\??\C:\WINDOWS\system32\conhost.exe 0x4') 'SAME_CAPTURE_AUDIT_CONSOLE'
   $consoleAuditPids+=,[int]$audit.pid
  }
 }
 foreach($id in $consoleAuditPids){$audit=@($context.audits|Where-Object{$_.pid-eq$id})[0];$parents=@($native.all|Where-Object{$_.ProcessId-eq$audit.parentPid});Need ($parents.Count-eq1-and($audit.parentPid-in$managed-or$audit.parentPid-in$probeAuditPids)-and$parents[0].CreationDate-is[DateTime]-and$parents[0].CreationDate.ToUniversalTime()-le[DateTime]::Parse($audit.creationTime).ToUniversalTime()) 'SAME_CAPTURE_AUDIT_CONSOLE_PARENT'}
 # Raw descendants remain visible. Only separately audited standard rows may
 # accompany an exited probe; an unknown descendant is never covered by it.
 foreach($row in $native.all){if($row.ParentProcessId-in$seen){Need ($row.ProcessId-in$seen) 'SAME_CAPTURE_AUDIT_UNKNOWN_DESCENDANT'}}
 # This exact pinned observer function rechecks raw+fresh complete families,
 # managed PID absence, all listeners, core UID and binary/source/argv policy.
 & $context.recheck $context.audits $context.rawSnapshot $policy
 # Classification view only. The original raw arrays and their counts remain
 # unchanged for protected, foreign, listener and full identity accounting.
 return [pscustomobject]@{auditedPids=@($seen);all=@($native.all|Where-Object{$_.ProcessId-notin$seen})}
}

function CaptureWorkerAdmissionCore($capturedInventory=$null){
 Authority;PrepareProbeSource;$inv=if($null -eq $capturedInventory){Inventory}else{$capturedInventory}
 # Expected parents serve only the imported console classifier's lookup.
 # Admission still requires all ten live identities below. Authenticate the
 # shortest-lived rows first; sorting retains the entire unfiltered frame.
 $expectedParents=@($order|ForEach-Object{$before.identities.$_})+@($profile.oldWatchers)
 $auditFrame=$null
 if($null-ne$capturedInventory){$auditNative=Get-Variable -Name sameCaptureAuditContext -Scope Script -ValueOnly -ErrorAction SilentlyContinue;Need ($null-ne$auditNative-and[object]::ReferenceEquals($auditNative,$capturedInventory)) 'SAME_CAPTURE_AUDIT_CONTEXT';if($PolicyGeneration-ceq'CurrentB142Rehearsal'){Need (@($capturedInventory.readOnlyAudits.audits).Count-eq0-and[object]::ReferenceEquals($capturedInventory.readOnlyAudits.capture,$capturedInventory)) 'REHEARSAL_NATIVE_CONTEXT';$auditFrame=[pscustomobject]@{all=$capturedInventory.all;auditedPids=@()}}else{$auditFrame=CurrentSameCaptureAuditFrame $capturedInventory}}
 $classificationAll=if($null-ne$auditFrame){$auditFrame.all}else{$inv.all}
 $auxInventory=[pscustomobject]@{all=@($classificationAll|Sort-Object CreationDate -Descending);allListeners=$inv.allListeners;listeners=$inv.listeners;instances=$inv.instances}
 $probes=@(ProbeAuxiliaries $auxInventory);$aux=@(ConsoleAuxiliaries $auxInventory @($expectedParents+$probes));$aux+=@($probes|ForEach-Object{$_.pid})
 ProtectedProcesses $inv
 $protectedPins=@();if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){$protectedPins=@(GetCurrentB007ProtectedConsolePins $(if($null-ne$auditFrame){$auxInventory}else{$inv}))}
 Need ($inv.instances.Count -eq 2 -and @($profile.tasks).Count -eq 2 -and @($profile.oldWatchers).Count -eq 2) 'SUCCESSOR_CAPTURE_COM'
 $selected=@();foreach($role in $order){$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'SUCCESSOR_CAPTURE_APP';if($PolicyGeneration-ceq'CurrentB142Rehearsal'){RehearsalBindings $role $e $inv};$selected+=,$e}
 foreach($entry in $profile.tasks){
  Need ($entry.name -cin $names) 'SUCCESSOR_CAPTURE_TASK_NAME';$t=if($null -eq $capturedInventory){$folder.GetTask($entry.name)}else{$matches=@($capturedInventory.tasks|Where-Object{$_.name -ceq $entry.name});Need ($matches.Count -eq 1) 'SAME_CAPTURE_TASK_COUNT';$matches[0]};Need ([int]$t.State -eq 4 -and (XmlHash ([string]$t.Xml)) -ceq $entry.oldXmlSha256) 'SUCCESSOR_CAPTURE_TASK'
  $instances=@($inv.instances|Where-Object{$_.Name -ceq $entry.name});Need ($instances.Count -eq 1 -and [int]$instances[0].State -eq 4 -and [string]$instances[0].Path -ceq ('\'+$entry.name)) 'SUCCESSOR_CAPTURE_INSTANCE'
  $watchers=@($profile.oldWatchers|Where-Object{$_.pid -eq [int]$instances[0].EnginePID});Need ($watchers.Count -eq 1) 'SUCCESSOR_CAPTURE_WATCHER';$w=$watchers[0];$actual=@($inv.all|Where-Object{$_.ProcessId -eq $w.pid});Need ($actual.Count -eq 1 -and (Identity $actual[0] $w)) 'SUCCESSOR_CAPTURE_WATCHER_IDENTITY';$selected+=,$w
 }
 Need (@($selected|Select-Object -ExpandProperty pid -Unique).Count -eq 10) 'SUCCESSOR_CAPTURE_DISTINCT'
 $relevant=[Collections.Generic.HashSet[int]]::new();foreach($p in $selected){[void]$relevant.Add([int]$p.pid)}
 foreach($p in $inv.all){foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){[void]$relevant.Add([int]$p.ProcessId)}};if(IsWatcherCommand ([string]$p.CommandLine)){[void]$relevant.Add([int]$p.ProcessId)}}
 do{$added=$false;foreach($p in $inv.all){if($relevant.Contains([int]$p.ParentProcessId) -and $relevant.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inv.all){if($relevant.Contains([int]$p.ProcessId)){Need ($p.ProcessId -in @($selected|ForEach-Object{$_.pid}) -or $p.ProcessId -in $aux -or ($PolicyGeneration -ceq 'CurrentB007InspectOnly' -and $p.ProcessId -in @($protectedPins|ForEach-Object{$_.pid})) -or ($null-ne$auditFrame-and$p.ProcessId-in$auditFrame.auditedPids)) 'SUCCESSOR_CAPTURE_FOREIGN'}}
 if($null-ne$auditFrame){Need (@($script:probePins.Keys|Where-Object{$_-in$auditFrame.auditedPids}).Count-eq0-and@($script:consolePins.Keys|Where-Object{$_-in$auditFrame.auditedPids}).Count-eq0) 'SAME_CAPTURE_AUDIT_NOT_OWNED'}
 AssertWorkerBindings $inv @($order|ForEach-Object{$before.identities.$_})
 $frame=[ordered]@{schemaVersion='melisa-p03-successor-precut-admission.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;recoveryHelperSha256=$RecoveryHelperSha256;observedAt=[DateTime]::UtcNow.ToString('o');oldIdentities=@($order|ForEach-Object{$before.identities.$_});oldWatchers=@($profile.oldWatchers);consolePins=@($script:consolePins.Values);probePins=@($script:probePins.Values)}
 if($PolicyGeneration-ceq'CurrentB142Rehearsal'){$frame['environment']='P03_REHEARSAL'}
 if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){$frame['protectedConsolePins']=@($protectedPins)}
 return $frame
}
function CaptureWorkerAdmission{
 for($attempt=0;$attempt -lt 3;$attempt++){try{return CaptureWorkerAdmissionCore}catch{if($_.Exception.Message -cne 'P03_PAUSED_PROBE_EXIT_RECAPTURE'){throw};if($attempt -eq 2){throw 'P03_SUCCESSOR_PROBE_RECAPTURE_EXHAUSTED'}}}
}
function SeedWorkerAdmission($snapshot){
 if($PolicyGeneration-ceq'CurrentB142Rehearsal'){Need ($snapshot.environment-ceq'P03_REHEARSAL'-and@($snapshot.probePins).Count-eq0) 'REHEARSAL_SNAPSHOT_SCOPE'}
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
 if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){
  Need (@($snapshot.protectedConsolePins).Count -le 64) 'CURRENT_PROTECTED_SNAPSHOT_COUNT'
  $nextCache=@{};if(Get-Variable protectedConsolePins -Scope Script -ErrorAction SilentlyContinue){foreach($key in $script:protectedConsolePins.Keys){$nextCache[$key]=$script:protectedConsolePins[$key]}}
  $seen=@();$forbidden=@($snapshot.oldIdentities|ForEach-Object{$_.pid})+@($snapshot.oldWatchers|ForEach-Object{$_.pid})+@($snapshot.consolePins|ForEach-Object{$_.pid})+@($snapshot.probePins|ForEach-Object{$_.pid})+@($profile.protectedProcesses|ForEach-Object{$_.pid})
  foreach($pin in $snapshot.protectedConsolePins){
   $parents=@($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -cnotcontains 'kind' -and $_.pid -eq $pin.parentPid})
   Need ((@($pin.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'commandLine|creationTime|nodePath|ownerSid|parentPid|pid' -and $pin.pid -gt 0 -and $pin.pid -notin $forbidden -and $pin.pid -notin $seen -and $parents.Count -eq 1 -and $pin.ownerSid -ceq $owner -and $parents[0].ownerSid -ceq $owner -and $pin.nodePath -ceq 'C:\Windows\System32\conhost.exe' -and $pin.commandLine -ceq '\??\C:\WINDOWS\system32\conhost.exe 0x4' -and [DateTime]::Parse($pin.creationTime).ToUniversalTime() -ge [DateTime]::Parse($parents[0].creationTime).ToUniversalTime() -and [DateTime]::Parse($pin.creationTime).ToUniversalTime() -le [DateTime]::Parse($snapshot.observedAt).ToUniversalTime()) 'CURRENT_PROTECTED_SNAPSHOT_PIN'
   if($nextCache.ContainsKey([int]$pin.pid)){Need (WorkerSamePin $pin $nextCache[[int]$pin.pid]) 'CURRENT_PROTECTED_SNAPSHOT_REUSED'}
   $nextCache[[int]$pin.pid]=[pscustomobject]@{pid=[int]$pin.pid;parentPid=[int]$pin.parentPid;nodePath=[string]$pin.nodePath;ownerSid=[string]$pin.ownerSid;commandLine=[string]$pin.commandLine;creationTime=[string]$pin.creationTime};$seen+=,[int]$pin.pid
  }
  $script:protectedConsolePins=$nextCache
 }
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
if($PolicyGeneration -cin @('B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly','CurrentB142Rehearsal')){$frame=if($null -eq $NativeCapture){CaptureWorkerAdmission}else{CaptureWorkerAdmissionCore $NativeCapture};$frame.schemaVersion='melisa-p03-b264-precut-inspection.v1';$frame['policyGeneration']=$PolicyGeneration;if($PolicyGeneration-ceq'CurrentB142Rehearsal'){$frame['environment']='P03_REHEARSAL'};$frame['protectedProcesses']=@($profile.protectedProcesses);$frame['transitionAuthority']=$false;$frame['stopAuthority']=$false;$frame['applyExecuted']=$false;if($null -ne $NativeCapture){$frame['captureId']=$NativeCapture.id;return $frame};$frame|ConvertTo-Json -Depth 14 -Compress;return}
if($Mode -cin @('Inspect','Capture')){CaptureWorkerAdmission|ConvertTo-Json -Depth 14 -Compress;return}
DrainWorkerCore|ConvertTo-Json -Depth 8 -Compress

}
InvokeP03SuccessorWorker @PSBoundParameters
