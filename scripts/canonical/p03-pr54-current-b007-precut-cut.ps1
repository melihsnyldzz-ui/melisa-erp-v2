param(
 [ValidateSet('CurrentB007InspectOnly')][string]$PolicyGeneration='CurrentB007InspectOnly',
 [ValidateSet('Inspect','Drain')][string]$Mode='Inspect',
 [Parameter(Mandatory=$true)][string]$ProfilePath,[Parameter(Mandatory=$true)][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,[Parameter(Mandatory=$true)][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,[Parameter(Mandatory=$true)][string]$EngineSha256,
 [Parameter(Mandatory=$true)][string]$RecoveryHelperPath,[Parameter(Mandatory=$true)][string]$RecoveryHelperSha256,
 [Parameter(Mandatory=$true)][string]$DrainerPath,[Parameter(Mandatory=$true)][string]$DrainerSha256,
 [string]$ClaimPath,[string]$ClaimSha256,[string]$AdmittedSnapshotPath,[string]$AdmittedSnapshotSha256,[string]$RootIntentPath,[string]$RootIntentSha256,
 [string]$ContinuationPath,[string]$ContinuationSha256
)
if($PolicyGeneration -cnotin @('CurrentB007InspectOnly')){throw 'P03_B264_CUT_POLICY'}
if($PolicyGeneration -ceq 'CurrentB007InspectOnly' -and $EnginePath -cnotmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-(?:current-b007-control-[a-f0-9]{12}|transition-[a-f0-9]{32})\\p03-physical-rollback-lifetime-v2\.ps1\z'){throw 'P03_CURRENT_B007_ENGINE_SCOPE'}
# Definitions-only reuse. No historical dispatcher, claim creation or task start.
if($EngineSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}) -or $RecoveryHelperSha256 -cne 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5' -or $DrainerSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'b6566e3505af505fb6e0b8d47d6227cf5277d527014db9a8f034093285783486'}elseif($PolicyGeneration -ceq 'B264Sup20DInspectOnly'){'eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5'}else{'34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c'})){throw 'P03_B264_CUT_SOURCE'}
if($Mode -ceq 'Inspect' -and @('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','RootIntentPath','RootIntentSha256','ContinuationPath','ContinuationSha256'|Where-Object{$PSBoundParameters.ContainsKey($_)}).Count){throw 'P03_B264_CUT_INSPECT_ONLY'}
if($Mode -ceq 'Drain' -and (-not $PSBoundParameters.ContainsKey('ContinuationPath') -or -not $PSBoundParameters.ContainsKey('ContinuationSha256') -or [string]::IsNullOrEmpty($ContinuationPath) -or $ContinuationSha256 -cnotmatch '\A[a-f0-9]{64}\z')){throw 'P03_CURRENT_B007_CONTINUATION_REQUIRED'}
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_B264_CUT_OWNER'}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$engineSha=$EngineSha256
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

$engineBytes=ReadWorkerPin $EnginePath $engineSha
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($engineBytes),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'P03_B264_CUT_ENGINE_PARSE'}
ImportWorkerFunctions $engineBytes @($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)|ForEach-Object{$_.Name})
ImportWorkerFunctions (ReadWorkerPin $RecoveryHelperPath $RecoveryHelperSha256) @('SourceBytes','ProbeArgumentsAllowed','PrepareProbeSource','LatePrecutProbeAllowed','ProbeAuxiliaries','PausedTasks','PausedRemaining','PausedRemainingCore','WaitCoreProbeAbsence')
ImportWorkerFunctions (ReadWorkerPin $DrainerPath $DrainerSha256) @($(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'AssertCurrentB007InspectionContract'}elseif($PolicyGeneration -ceq 'B264Sup20DInspectOnly'){'AssertB264Sup20DInspectionContract'}else{'AssertB264InspectionContract'}),'WorkerSamePin','Inventory','AssertWorkerBindings','CaptureWorkerAdmissionCore','CaptureWorkerAdmission','SeedWorkerAdmission','HoldWorkerCore','StopWorkerCore')
if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){ImportWorkerFunctions (ReadWorkerPin $DrainerPath $DrainerSha256) @('GetCurrentB007ProtectedConsolePins')}
$profile=Json (ReadWorkerPin $ProfilePath $ProfileSha256);$before=Json (ReadWorkerPin $BeforeImagePath $BeforeImageSha256)
$oldSettings=Json (ReadWorkerPin $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadWorkerPin $profile.newSettings.path $profile.newSettings.sha256)
$runId=$before.runId;$dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
$Environment='Shared';$isRehearsal=$false
$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
$order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative');$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$script:consolePins=@{};$script:probePins=@{};$script:legacyConsolePins=@{};$script:drainedPids=@();$script:tasksStopRequested=$false;$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false;$script:lateAdmissionOpen=$false;$script:lateProbePids=@();$script:coreLifetime=$null;$script:precutWindowOpenedAt=$null;$script:coreStopCompletedAt=$null;$script:cutWitnessCommitted=$false;$script:b264CutComPins=@()
$script:continuationLiveAdmission=$null
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
function B264Same($a,$b){return ($a|ConvertTo-Json -Depth 25 -Compress) -ceq ($b|ConvertTo-Json -Depth 25 -Compress)}
function B264CutHistoryPins{
 return @{
  predecessorProfile=@{path='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-profile-b264594b6f93d560d807c8decc4e6699.json';sha256='7effdbf12208c973da6ccbd91ab07afd785d3e9d2bc15a2d00d62980c70ed294'}
  predecessorBefore=@{path='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-before-b264594b6f93d560d807c8decc4e6699.json';sha256='b05242a19ce9bcccd20ba363e213c892aadc89a4e863af9c9186f86206bb3873'}
  predecessorLock=@{path='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-transition-b264594b6f93d560d807c8decc4e6699\transition.lock';sha256='4d3741a78dd88adc7c9a2b3fc88a8b7135862458285a9591e1be326f3ed1b65d'}
  consumedAncestorClaim=@{path='C:\Sirket\ERP\runtime\P03-OWNER-20261018\p03-pr54-successor-of-7b0821959737f1da0427b17a7dfd4685.lock.json';sha256='6d9320c8c00cc33c59c65de663a0ece96a82ca0f116194cb7d35f655853f7815'}
  failedOuterTail=@{path='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-transition-b264594b6f93d560d807c8decc4e6699\event-0025.json';sha256='89821e3d15838cb549b14b1738fe5214e6325ce87c1ebd12c273c9c9bcecafd3'}
  quarantinedRecoveryTail=@{path='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-recovery-b264594b6f93d560d807c8decc4e6699\event-0007.json';sha256='0f45377171afcb85a82dfa3d130592251c31687134abafde0c9cca557879d25c'}
  readOnlyOldReady=@{path='C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-transition-b264594b6f93d560d807c8decc4e6699\current-b264-late-old-observed-ready.json';sha256='097b43d18467a2d594b04586e7ebb9cbcea4133c7dcd2154c4e24e1c8ed42dcf'}
 }
}
function AssertB264CutStopPlan($claim){
 $targets=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor')
 $stopOrder=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
 $plan=$before.plan
 Need ((@($plan.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'digest|newSettingsSha256|oldSettingsSha256|targets') 'B264_PLAN_KEYS'
 Need ((@($plan.targets)-join '|') -ceq ($targets-join '|')) 'B264_PLAN_TARGETS'
 Need ($plan.oldSettingsSha256 -cmatch '\A[a-f0-9]{64}\z' -and $plan.newSettingsSha256 -cmatch '\A[a-f0-9]{64}\z' -and $plan.oldSettingsSha256 -cne $plan.newSettingsSha256) 'B264_PLAN_SETTINGS_HASHES'
 Need ($plan.oldSettingsSha256 -ceq $profile.oldSettings.sha256 -and $plan.newSettingsSha256 -ceq $profile.newSettings.sha256 -and (B264Same $before.oldConfig $profile.oldSettings) -and (B264Same $before.newConfig $profile.newSettings)) 'B264_PLAN_SETTINGS_BINDING'
 $canonical=[ordered]@{targets=$targets;oldSettingsSha256=$plan.oldSettingsSha256;newSettingsSha256=$plan.newSettingsSha256}
 $digest=Hash ([Text.UTF8Encoding]::new($false).GetBytes(($canonical|ConvertTo-Json -Compress)))
 Need ($plan.digest -ceq $digest) 'B264_PLAN_DIGEST'
 $commitment=[ordered]@{planDigest=$digest;stopOrder=$stopOrder}
 $stopDigest=Hash ([Text.UTF8Encoding]::new($false).GetBytes(($commitment|ConvertTo-Json -Compress)))
 Need ($claim.stopOrderDigest -ceq $stopDigest) 'B264_STOP_ORDER_DIGEST'
}
function ContinuationKeys($value,[string[]]$keys){Need ((@($value.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (@($keys|Sort-Object)-join '|')) 'CURRENT_CONTINUATION_FIELDS'}
function ContinuationStable($value,[string[]]$excluded){$out=[ordered]@{};foreach($p in $value.PSObject.Properties){if($p.Name -cnotin $excluded){$out[$p.Name]=$p.Value}};return $out}
function AssertCurrentB007LiveAdmission($live,$claim,$snapshot){
 Need ($live.schemaVersion -ceq 'melisa-p03-successor-precut-admission.v1' -and $live.profileSha256 -ceq $ProfileSha256 -and $live.beforeSha256 -ceq $BeforeImageSha256 -and $live.engineSha256 -ceq $EngineSha256 -and $live.recoveryHelperSha256 -ceq $RecoveryHelperSha256) 'CURRENT_CONTINUATION_LIVE_REFS'
 Need (@($live.oldIdentities).Count -eq 8 -and @($live.oldWatchers).Count -eq 2 -and @(@($live.oldIdentities)+@($live.oldWatchers)|Select-Object -ExpandProperty pid -Unique).Count -eq 10) 'CURRENT_CONTINUATION_LIVE_COUNT'
 foreach($role in $order){$e=$before.identities.$role;$rows=@($live.oldIdentities|Where-Object{$_.pid -eq $e.pid});Need ($rows.Count -eq 1 -and (WorkerSamePin $rows[0] $e) -and (B264Same $rows[0].bindings $e.bindings)) 'CURRENT_CONTINUATION_LIVE_APP'}
 foreach($watcher in $profile.oldWatchers){$rows=@($live.oldWatchers|Where-Object{$_.pid -eq $watcher.pid});Need ($rows.Count -eq 1 -and (WorkerSamePin $rows[0] $watcher)) 'CURRENT_CONTINUATION_LIVE_WATCHER'}
 $age=([DateTime]::UtcNow-[DateTime]::Parse($live.observedAt).ToUniversalTime()).TotalSeconds
 Need ($age -ge 0 -and $age -lt 60 -and [DateTime]::Parse($live.observedAt).ToUniversalTime() -ge [DateTime]::Parse($snapshot.observedAt).ToUniversalTime() -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -le [DateTime]::Parse($live.observedAt).ToUniversalTime()) 'CURRENT_CONTINUATION_LIVE_FRESH'
}
function AssertCurrentB007Continuation($claim){
 Need ($ContinuationPath -ceq (Join-Path $dir 'precut-continuation.json') -and $ContinuationSha256 -cmatch '\A[a-f0-9]{64}\z') 'CURRENT_CONTINUATION_PATH'
 $context=Json (ReadWorkerPin $ContinuationPath $ContinuationSha256)
 ContinuationKeys $context @('schemaVersion','retainedClaimRef','failureTailRef','profileRef','beforeRef','claimPath')
 $retainedPath=Join-Path $base 'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'
 $oldRun='cffba2988afcb49502ae73ddd797e966';$failedDir=Join-Path $base ('MelisaERP-P03-transition-'+$oldRun)
 Need ($context.schemaVersion -ceq 'melisa-p03-current-b007-precut-continuation.v1' -and $context.claimPath -ceq $ClaimPath -and $context.profileRef.path -ceq $ProfilePath -and $context.profileRef.sha256 -ceq $ProfileSha256 -and $context.beforeRef.path -ceq $BeforeImagePath -and $context.beforeRef.sha256 -ceq $BeforeImageSha256) 'CURRENT_CONTINUATION_CONTEXT'
 foreach($key in @('retainedClaimRef','failureTailRef','profileRef','beforeRef')){ContinuationKeys $context.$key @('path','sha256')}
 Need ($context.retainedClaimRef.path -ceq $retainedPath -and $context.retainedClaimRef.sha256 -ceq '3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408' -and $context.failureTailRef.path -ceq (Join-Path $failedDir 'event-0002.json') -and $context.failureTailRef.sha256 -ceq '87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82') 'CURRENT_CONTINUATION_HISTORY'
 $retained=Json (ReadWorkerPin $retainedPath $context.retainedClaimRef.sha256)
 Need ($retained.schemaVersion -ceq 'melisa-p03-current-b007-epoch-claim.v1' -and $retained.successorRunId -ceq $oldRun -and $retained.transitionAuthority -ceq $true -and $retained.applyExecuted -ceq $false) 'CURRENT_CONTINUATION_RETAINED'
 $oldProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$oldRun+'.json');$oldBeforePath=Join-Path $base ('MelisaERP-P03-before-'+$oldRun+'.json')
 Need ($retained.successorProfile.path -ceq $oldProfilePath -and $retained.successorProfile.sha256 -ceq '7c3788d9dc97ae182adddec1b3b5f1106a6c408cc542ef00f8f6bc146ec4df8c' -and $retained.successorBefore.path -ceq $oldBeforePath -and $retained.successorBefore.sha256 -ceq 'd6aec6a904ca36bccccc2d295a770d8fae53ca3190b0b763e43788d2e3294f5c') 'CURRENT_CONTINUATION_OLD_REFS'
 $oldProfile=Json (ReadWorkerPin $oldProfilePath $retained.successorProfile.sha256);$oldBefore=Json (ReadWorkerPin $oldBeforePath $retained.successorBefore.sha256)
 Need ($runId -cne $oldRun -and $oldBefore.runId -ceq $oldRun) 'CURRENT_CONTINUATION_RUN'
 Need ((B264Same (ContinuationStable $profile @('beforeImage','businessDigest','journalDirectory','stopper')) (ContinuationStable $oldProfile @('beforeImage','businessDigest','journalDirectory','stopper'))) -and $profile.stopper.sha256 -ceq $oldProfile.stopper.sha256) 'CURRENT_CONTINUATION_PROFILE_DRIFT'
 Need (B264Same (ContinuationStable $before @('runId','startedAt','observedAt')) (ContinuationStable $oldBefore @('runId','startedAt','observedAt'))) 'CURRENT_CONTINUATION_BEFORE_DRIFT'
 Need ((B264Same $claim.candidate $retained.candidate) -and (B264Same $claim.newSettings $retained.newSettings) -and (B264Same $claim.protectedSqlEpoch $retained.protectedSqlEpoch) -and $claim.stopOrderDigest -ceq $retained.stopOrderDigest -and $claim.currentOwnerDigest -ceq $retained.currentOwnerDigest) 'CURRENT_CONTINUATION_CLAIM_DRIFT'
 $events=@(Get-ChildItem -LiteralPath $failedDir -File|Where-Object{$_.Name -cmatch '^event-'}|ForEach-Object{$_.Name}|Sort-Object)
 Need (($events -join '|') -ceq 'event-0000.json|event-0001.json|event-0002.json' -and @(Get-ChildItem -LiteralPath $oldProfile.journalDirectory -Force).Count -eq 0) 'CURRENT_CONTINUATION_JOURNAL'
 $previous=$retained.successorBefore.sha256
 foreach($n in 0..2){$eventPath=Join-Path $failedDir ('event-'+$n.ToString('0000')+'.json');$expected=if($n -eq 2){$context.failureTailRef.sha256}else{(Get-FileHash -LiteralPath $eventPath -Algorithm SHA256).Hash.ToLowerInvariant()};$event=Json (ReadWorkerPin $eventPath $expected);Need ($event.sequence -eq $n -and $event.previousSha256 -ceq $previous -and $event.profileSha256 -ceq $retained.successorProfile.sha256 -and $event.beforeSha256 -ceq $retained.successorBefore.sha256 -and $event.digest -ceq $oldBefore.plan.digest -and $event.stopOrderDigest -ceq $retained.stopOrderDigest -and $event.event -ceq @('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n]) 'CURRENT_CONTINUATION_EVENT';if($n -gt 0){Need ($event.target -ceq @('coreSupervisor','HELD_CORE_CUT')[$n-1]) 'CURRENT_CONTINUATION_EVENT_TARGET'};$previous=$expected}
 Need (@(Get-ChildItem -LiteralPath $failedDir -File|Where-Object{$_.Name -cmatch '\.json$' -and $_.Name -cmatch '(held-cut|core-cut|probe-drain|new-owner|candidate|readback|witness|rollback-result|invariance-comparison)'}).Count -eq 0) 'CURRENT_CONTINUATION_CUT_ADVANCED'
 Need ($AdmittedSnapshotPath -ceq (Join-Path $dir 'successor-precut-admission.json')) 'CURRENT_CONTINUATION_SNAPSHOT_PATH'
 $snapshot=Json (ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256)
 Need ($snapshot.schemaVersion -ceq 'melisa-p03-successor-precut-admission.v1' -and $snapshot.profileSha256 -ceq $ProfileSha256 -and $snapshot.beforeSha256 -ceq $BeforeImageSha256 -and $snapshot.engineSha256 -ceq $EngineSha256 -and $snapshot.recoveryHelperSha256 -ceq $RecoveryHelperSha256) 'CURRENT_CONTINUATION_SNAPSHOT_REFS'
 if($null -ne $script:continuationLiveAdmission){AssertCurrentB007LiveAdmission $script:continuationLiveAdmission $claim $snapshot}else{
  $snapshotAge=([DateTime]::UtcNow-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()).TotalSeconds
  Need ($snapshotAge -ge 0 -and $snapshotAge -lt 60 -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -le [DateTime]::Parse($snapshot.observedAt).ToUniversalTime()) 'CURRENT_CONTINUATION_SNAPSHOT_FRESH'
 }
}
function B264CutAuthority{
 foreach($pin in @(@($ProfilePath,$ProfileSha256),@($BeforeImagePath,$BeforeImageSha256),@($EnginePath,$EngineSha256),@($RecoveryHelperPath,$RecoveryHelperSha256),@($DrainerPath,$DrainerSha256))){[void](ReadWorkerPin $pin[0] $pin[1])}
 if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){AssertCurrentB007InspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}elseif($PolicyGeneration -ceq 'B264Sup20DInspectOnly'){AssertB264Sup20DInspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}else{AssertB264InspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}
 foreach($entry in @(@($EnginePath,$(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'p03-physical-rollback-lifetime-v2.ps1'}else{'p03-physical-rollback.ps1'})),@($RecoveryHelperPath,'p03-pr54-paused-old-recover.ps1'),@($DrainerPath,'p03-pr54-successor-core-drain.ps1'))){Need ($entry[0].StartsWith($base+'\',[StringComparison]::Ordinal) -and [IO.Path]::GetFileName($entry[0]) -ceq $entry[1]) 'B264_CUT_SOURCE_SCOPE'}
 if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){Need ($(if($Mode -ceq 'Inspect'){$EnginePath -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-current-b007-control-[a-f0-9]{12}\\p03-physical-rollback-lifetime-v2\.ps1\z' -or $EnginePath -ceq (Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1')}else{$EnginePath -ceq (Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1')})) 'CURRENT_B007_ENGINE_RUN'}
 if($Mode -ceq 'Inspect'){return}
 Need ($Mode -ceq 'Drain' -and $ClaimPath -ceq (Join-Path $base $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json'}else{'p03-pr54-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'}))) 'B264_CUT_CLAIM_PATH'
 $claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256)
 $keys=@('schemaVersion','currentOwnerDigest','ownerObservedAt','protectedSqlEpoch','predecessorRunId','predecessorProfile','predecessorBefore','predecessorLock','consumedAncestorClaim','failedOuterTail','quarantinedRecoveryTail','readOnlyOldReady','successorRunId','successorProfile','successorBefore','newSettings','candidate','stopOrderDigest','transitionAuthority','applyExecuted')
 Need ((@($claim.PSObject.Properties.Name|Sort-Object) -join '|') -ceq (@($keys|Sort-Object) -join '|')) 'B264_CUT_CLAIM_FIELDS'
 Need ($claim.schemaVersion -ceq $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'melisa-p03-current-b007-epoch-claim.v1'}else{'melisa-p03-b264-current-epoch-claim.v1'}) -and $claim.predecessorRunId -ceq 'b264594b6f93d560d807c8decc4e6699' -and $claim.successorRunId -ceq $runId -and $claim.transitionAuthority -ceq $true -and $claim.applyExecuted -ceq $false -and $claim.currentOwnerDigest -cmatch '\A[a-f0-9]{64}\z') 'B264_CUT_CLAIM'
 Need ($claim.successorProfile.path -ceq $ProfilePath -and $claim.successorProfile.sha256 -ceq $ProfileSha256 -and $claim.successorBefore.path -ceq $BeforeImagePath -and $claim.successorBefore.sha256 -ceq $BeforeImageSha256 -and (B264Same $claim.newSettings $profile.newSettings)) 'B264_CUT_CLAIM_REFS'
 Need ((B264Same $claim.protectedSqlEpoch @($profile.protectedProcesses|Where-Object{$_.kind -ceq 'ProtectedSqlService'})[0]) -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -ge [DateTime]::Parse($before.observedAt).ToUniversalTime()) 'B264_CUT_EPOCH'
 AssertCurrentB007Continuation $claim
 AssertB264CutStopPlan $claim
 $candidate=[ordered]@{erpSource=$newSettings.components.erpApiNative.sourceCommit;erpManifest=$newSettings.components.erpApiNative.manifestSha256;crmSource=$newSettings.components.crm.sourceCommit;crmManifest=$newSettings.components.crm.manifestSha256;supervisorSource=$newSettings.supervisor.sourceCommit;supervisorManifest=$newSettings.supervisor.manifestSha256;supervisorRoot=$newSettings.supervisor.packageRoot;newSettings=$profile.newSettings}
 Need (B264Same $claim.candidate $candidate) 'B264_CUT_CANDIDATE'
 $history=B264CutHistoryPins
 foreach($key in $history.Keys){$pin=$claim.$key;Need ($pin.path -ceq $history[$key].path -and $pin.sha256 -ceq $history[$key].sha256 -and @($pin.PSObject.Properties).Count -eq 2) 'B264_CUT_HISTORY';[void](ReadWorkerPin $pin.path $pin.sha256)}
 $stopDigest=Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{planDigest=$before.plan.digest;stopOrder=$order}|ConvertTo-Json -Compress)))
 Need ($claim.stopOrderDigest -ceq $stopDigest -and $AdmittedSnapshotPath -ceq (Join-Path $dir 'successor-precut-admission.json') -and $RootIntentPath -ceq (Join-Path $dir 'b264-old-owner-cut-intent.json')) 'B264_CUT_INTENT_PATH'
 $intent=Json (ReadWorkerPin $RootIntentPath $RootIntentSha256)
 Need ($intent.event -ceq 'B264_OLD_CUT_INTENT' -and $intent.claimSha256 -ceq $ClaimSha256 -and $intent.stopOrderDigest -ceq $stopDigest -and $intent.profileSha256 -ceq $ProfileSha256 -and $intent.beforeSha256 -ceq $BeforeImageSha256) 'B264_CUT_INTENT'
 $intentAge=([DateTime]::UtcNow-[DateTime]::Parse($intent.observedAt).ToUniversalTime()).TotalSeconds;Need ($intentAge -ge 0 -and $intentAge -lt 60) 'B264_CUT_INTENT_FRESH'
 Need ((@($intent.PSObject.Properties.Name|Sort-Object) -join '|') -ceq 'beforeSha256|claimSha256|event|observedAt|profileSha256|stopOrderDigest') 'B264_CUT_INTENT_FIELDS'
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

function Authority{B264CutAuthority}
function LegacyConsoleAuxiliaries($inv){return @()}
function WriteB264CutEvidence([string]$leaf,$value){
 Need ($leaf -cin @('b264-old-owner-held-cut-intent.json','successor-core-cut-completed.json','successor-core-probe-drain.json')) 'B264_CUT_WRITE_SCOPE'
 $path=Join-Path $dir $leaf;NoReparse $dir
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 25 -Compress));$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
 $stream=New-Object IO.FileStream($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 $sha=Hash $bytes;[void](ReadWorkerPin $path $sha);return [ordered]@{path=$path;sha256=$sha}
}
function StopB264OldCom{
 # Per-instance CAS immediately before Stop, with exact XML and engine UID.
 foreach($entry in $profile.tasks){
  Authority;$inv=Inventory;ProtectedProcesses $inv;$task=$folder.GetTask($entry.name)
  Need ([int]$task.State -eq 4 -and (XmlHash ([string]$task.Xml)) -ceq $entry.oldXmlSha256) 'B264_CUT_COM_XML'
  $rows=@($inv.instances|Where-Object{$_.Name -ceq $entry.name});Need ($rows.Count -eq 1 -and [int]$rows[0].State -eq 4 -and [string]$rows[0].Path -ceq ('\'+$entry.name)) 'B264_CUT_COM_INSTANCE'
  $comPins=@($script:b264CutComPins|Where-Object{$_.name -ceq $entry.name});Need ($comPins.Count -eq 1 -and $comPins[0].pid -eq [int]$rows[0].EnginePID -and $comPins[0].guid -ceq [string]$rows[0].InstanceGuid) 'B264_CUT_COM_GUID'
  $pins=@($profile.oldWatchers|Where-Object{$_.pid -eq [int]$rows[0].EnginePID});Need ($pins.Count -eq 1) 'B264_CUT_COM_PIN'
  $actual=@($inv.all|Where-Object{$_.ProcessId -eq $pins[0].pid});Need ($actual.Count -eq 1 -and (Identity $actual[0] $pins[0])) 'B264_CUT_COM_UID'
  $rows[0].Stop()
 }
 $script:tasksStopRequested=$true
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{$inv=Inventory;ProtectedProcesses $inv;if($inv.instances.Count -eq 0){break};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow -lt $until)
 Need ($inv.instances.Count -eq 0) 'B264_CUT_COM_NOT_ABSENT'
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{
  $inv=Inventory;ProtectedProcesses $inv;$live=@()
  foreach($pin in $profile.oldWatchers){$rows=@($inv.all|Where-Object{$_.ProcessId -eq $pin.pid});if($rows.Count){Need ($rows.Count -eq 1 -and (Identity $rows[0] $pin)) 'B264_CUT_WATCHER_REUSED';$live+=,$pin}}
  if($live.Count -eq 0){break};Start-Sleep -Milliseconds 250
 }while([DateTime]::UtcNow -lt $until)
 Need ($live.Count -eq 0) 'B264_CUT_WATCHER_NOT_ABSENT'
 foreach($entry in $profile.tasks){$task=$folder.GetTask($entry.name);Need ([int]$task.State -eq 3 -and (XmlHash ([string]$task.Xml)) -ceq $entry.oldXmlSha256) 'B264_CUT_COM_READY'}
}
function AssertB264CutCurrentOwner{
 $claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256);$inv=Inventory;ProtectedProcesses $inv
 $owners=@(@(foreach($role in $order){
  $e=$before.identities.$role;$rows=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($rows.Count -eq 1 -and (Identity $rows[0] $e)) 'B264_CUT_OWNER_UID'
  [ordered]@{pid=[int]$e.pid;parentPid=[int]$e.parentPid;ownerSid=$e.ownerSid;nodePath=$e.nodePath;commandLine=$e.commandLine;creationTime=[DateTime]::Parse($e.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ');bindings=@($e.bindings)}
 })|Sort-Object { $_.pid })
 Need ($inv.instances.Count -eq 2) 'B264_CUT_OWNER_COM_COUNT'
 $instances=@(foreach($name in $names){$rows=@($inv.instances|Where-Object{$_.Name -ceq $name});Need ($rows.Count -eq 1 -and [int]$rows[0].State -eq 4 -and [string]$rows[0].Path -ceq ('\'+$name) -and -not[string]::IsNullOrEmpty([string]$rows[0].InstanceGuid)) 'B264_CUT_OWNER_COM';[ordered]@{name=$name;pid=[int]$rows[0].EnginePID;guid=[string]$rows[0].InstanceGuid}})
 $actual=Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{owners=$owners;instances=$instances}|ConvertTo-Json -Depth 25 -Compress)))
 Need ($claim.currentOwnerDigest -ceq $actual) 'B264_CUT_OWNER_DIGEST'
 $script:b264CutComPins=$instances
}
function DrainB264OldOwner{
 Authority;PrepareProbeSource;SeedWorkerAdmission (Json (ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256))
 foreach($leaf in @('b264-old-owner-held-cut-intent.json','successor-core-cut-completed.json','successor-core-probe-drain.json')){Need (-not(Test-Path -LiteralPath (Join-Path $dir $leaf))) 'B264_CUT_ONCE'}
 try{
  $core=$before.identities.coreSupervisor;$script:coreLifetime=HoldWorkerCore $core
  $script:precutWindowOpenedAt=[DateTime]::UtcNow
  $live=CaptureWorkerAdmission;AssertB264CutCurrentOwner
  Need ($null -eq $script:continuationLiveAdmission) 'CURRENT_CONTINUATION_LIVE_ONCE';$claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256);$rootSnapshot=Json (ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256);AssertCurrentB007LiveAdmission $live $claim $rootSnapshot
  Set-Variable -Name continuationLiveAdmission -Scope Script -Option ReadOnly -Value (Json ([Text.Encoding]::UTF8.GetBytes(($live|ConvertTo-Json -Depth 25 -Compress))))
  $durable=WriteB264CutEvidence 'b264-old-owner-held-cut-intent.json' ([ordered]@{event='B264_OLD_OWNER_CUT_INTENT';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;claimSha256=$ClaimSha256;rootIntentSha256=$RootIntentSha256;admittedSnapshotSha256=$AdmittedSnapshotSha256;windowOpenedAt=$script:precutWindowOpenedAt.ToString('o');core=$core;heldProcessHandle=$true;tasks=@($profile.tasks);runningInstances=@($script:b264CutComPins)})
  Need (([DateTime]::UtcNow-$script:precutWindowOpenedAt).TotalSeconds -lt 60) 'B264_CUT_PRECOM_WINDOW'
  StopB264OldCom
  $mechanism='COM_STOP_NATURAL_EXIT'
  if(-not $script:coreLifetime.HasExited){StopWorkerCore $core;$mechanism='EXACT_OBSERVED_PROCESS_STOPPED'}
  $inv=Inventory;ProtectedProcesses $inv
  Need ($script:coreLifetime.HasExited -and @($inv.all|Where-Object{$_.ProcessId -eq $core.pid}).Count -eq 0) 'B264_CUT_CORE_EXIT'
  $script:coreStopCompletedAt=[DateTime]::UtcNow
  Need (($script:coreStopCompletedAt-$script:precutWindowOpenedAt).TotalSeconds -lt 60) 'B264_CUT_WINDOW'
  $cut=WriteB264CutEvidence 'successor-core-cut-completed.json' ([ordered]@{event='B264_OLD_OWNER_CORE_CUT_COMPLETED';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;claimSha256=$ClaimSha256;durableIntent=$durable;mechanism=$mechanism;windowOpenedAt=$script:precutWindowOpenedAt.ToString('o');cutCompletedAt=$script:coreStopCompletedAt.ToString('o');core=$core;heldProcessHandle=$true;processAbsent=$true})
  $script:cutWitnessCommitted=$true;$script:drainedPids=@([int]$core.pid);$script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$script:lateAdmissionOpen=$true
  try{WaitCoreProbeAbsence}finally{$script:lateAdmissionOpen=$false}
  $remaining=PausedRemaining
  Need ($script:coreLifetime.HasExited -and @($remaining.all|Where-Object{$_.ProcessId -eq $core.pid -or $_.ProcessId -in @($script:probePins.Keys)}).Count -eq 0) 'B264_CUT_PROBE_ABSENCE'
  $drainValue=[ordered]@{event='B264_OLD_OWNER_CORE_PROBES_ABSENT';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;cutWitness=$cut;observedAt=[DateTime]::UtcNow.ToString('o');consolePins=@($script:consolePins.Values);probePins=@($script:probePins.Values);latePrecutProbePids=$script:lateProbePids;goneOldPids=@($script:drainedPids)}
  if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){$drainValue['protectedConsolePins']=@($script:protectedConsolePins.Values)}
  $drain=WriteB264CutEvidence 'successor-core-probe-drain.json' $drainValue
  return [ordered]@{status='B264_OLD_OWNER_CORE_DRAINED';coreStopResult=$mechanism;heldCoreExited=$true;comStopped=$true;remainingOldRoles=(8-@($script:drainedPids).Count);goneOldPids=@($script:drainedPids);cutWitness=$cut;drainWitness=$drain}
 }finally{if($null -ne $script:coreLifetime){$script:coreLifetime.Dispose()}}
}
B264CutAuthority
if($Mode -ceq 'Inspect'){CaptureWorkerAdmission|ConvertTo-Json -Depth 25 -Compress;return}
DrainB264OldOwner|ConvertTo-Json -Depth 25 -Compress
