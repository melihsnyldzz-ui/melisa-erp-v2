param(
 [ValidateSet('CurrentB007InspectOnly')][string]$PolicyGeneration='CurrentB007InspectOnly',
 [ValidateSet('Inspect','Drain','ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck')][string]$Mode='Inspect',
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
if($EngineSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}) -or $RecoveryHelperSha256 -cne 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5' -or $DrainerSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'cc864ca3d9030929f5bc5d30f93ffbaadac72286e40e346bf5d63c32a5926767'}elseif($PolicyGeneration -ceq 'B264Sup20DInspectOnly'){'eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5'}else{'34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c'})){throw 'P03_B264_CUT_SOURCE'}
if($Mode -ceq 'Inspect' -and @('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','RootIntentPath','RootIntentSha256','ContinuationPath','ContinuationSha256'|Where-Object{$PSBoundParameters.ContainsKey($_)}).Count){throw 'P03_B264_CUT_INSPECT_ONLY'}
if($Mode -cin @('Drain','ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck') -and (-not $PSBoundParameters.ContainsKey('ContinuationPath') -or -not $PSBoundParameters.ContainsKey('ContinuationSha256') -or [string]::IsNullOrEmpty($ContinuationPath) -or $ContinuationSha256 -cnotmatch '\A[a-f0-9]{64}\z')){throw 'P03_CURRENT_B007_CONTINUATION_REQUIRED'}
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
if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){ImportWorkerFunctions (ReadWorkerPin $DrainerPath $DrainerSha256) @('GetCurrentB007ProtectedConsolePins','AssertCurrentB007StaticContract')}
if($Mode -cin @('ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck')){ImportWorkerFunctions (ReadWorkerPin (Join-Path ([IO.Path]::GetDirectoryName($EnginePath)) 'p03-pr54-new-owner-observe.ps1') '777bc48f04fbdd1a48b9cf92aea4deaed4e34a9004139a2b0e9e5eba094445c4') @('NewHistoricalDigest','NewHistoricalIdentity','NewHistoricalOpenProcess','NewHistoricalReadProcess','NewHistoricalKernel')}
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
function CurrentB007ResumeStable($value,[string[]]$excluded){$out=[ordered]@{};foreach($p in $value.PSObject.Properties){if($p.Name -cnotin $excluded){$out[$p.Name]=$p.Value}};return $out}
function AssertCurrentB007RetryHistory($context,$claim,$priorAttempt,$retainedProfile,$retainedBefore){
 $retryRun='9d2e00d572acc83391a0a2e5ac28d046';$retryDir=Join-Path $base ('MelisaERP-P03-transition-'+$retryRun)
 Need ($runId -cnotin @($retryRun,'452054204a1857ff618b0dd30a59caea','cffba2988afcb49502ae73ddd797e966') -and $context.schemaVersion -ceq 'melisa-p03-current-b007-precut-retry.v1') 'CURRENT_RETRY_SCOPE'
 $refs=@{
  profile=[ordered]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$retryRun+'.json'));sha256='ed2c3ad7a253f749bf284ccc6aabe34535a28e3f2f0b71484583387082674c12'}
  before=[ordered]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$retryRun+'.json'));sha256='97252544d7ff98c0ed3d908bcf785f89cb2bb65dd3f6c79587653f433e740c04'}
  context=[ordered]@{path=(Join-Path $retryDir 'precut-continuation.json');sha256='7f07000256ed4b1289f36fe5a2290bdfa71e125ff976276f1135b42f0ba4012c'}
  lock=[ordered]@{path=(Join-Path $retryDir 'transition.lock');sha256='a125f57f3d97993ede102504faf379a373be67a1178d53770fb2f3f2916b4255'}
  snapshot=[ordered]@{path=(Join-Path $retryDir 'successor-precut-admission.json');sha256='9207fb109e6b2cfe03b9791ed5f1b2e88b100c052094e86350819d83b1550584'}
  intent=[ordered]@{path=(Join-Path $retryDir 'b264-old-owner-cut-intent.json');sha256='33535a3f165c03892bfb3a225d6ec2ae91b96f47fd2a949b9cf1afa7e2576ee9'}
  diagnostic=[ordered]@{path=(Join-Path $retryDir 'io-failure-diagnostic.json');sha256='f65e6e001f7c936d4577b45d70de97565f603eef8900d18227315d2388148cea'}
 }
 $values=@{};foreach($name in $refs.Keys){$r=$refs[$name];$values[$name]=Json (ReadWorkerPin $r.path $r.sha256)}
 $priorProfile=$values.profile;$priorBefore=$values.before;$priorContext=$values.context;$priorLock=$values.lock
 $expected=[ordered]@{schemaVersion='melisa-p03-current-b007-precut-resume.v1';retainedClaimRef=$context.retainedClaimRef;failureTailRef=[pscustomobject][ordered]@{path=(Join-Path $base 'MelisaERP-P03-transition-452054204a1857ff618b0dd30a59caea\event-0002.json');sha256='778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777'};retainedProfileRef=$context.retainedProfileRef;retainedBeforeRef=$context.retainedBeforeRef;profileRef=[pscustomobject]$refs.profile;beforeRef=[pscustomobject]$refs.before;claimPath=$context.claimPath}
 Need ((B264Same $priorContext $expected) -and (B264Same $priorAttempt $priorContext)) 'CURRENT_RETRY_PRIOR_CONTEXT'
 Need ($priorBefore.runId -ceq $retryRun -and $priorProfile.beforeImage.path -ceq $refs.before.path -and $priorProfile.beforeImage.sha256 -ceq $refs.before.sha256 -and (B264Same (CurrentB007ResumeStable $priorProfile @('beforeImage','businessDigest','journalDirectory','stopper')) (CurrentB007ResumeStable $retainedProfile @('beforeImage','businessDigest','journalDirectory','stopper'))) -and (B264Same (CurrentB007ResumeStable $priorBefore @('runId','startedAt','observedAt')) (CurrentB007ResumeStable $retainedBefore @('runId','startedAt','observedAt')))) 'CURRENT_RETRY_PRIOR_DRIFT'
 Need ($priorProfile.stopper.sha256 -ceq $retainedProfile.stopper.sha256 -and $priorProfile.stopper.path -ceq (Join-Path $base ('MelisaERP-P03-stopper-'+$retryRun+'.ps1')) -and $priorProfile.journalDirectory -ceq (Join-Path $base ('MelisaERP-P03-recovery-'+$retryRun)) -and [DateTime]::Parse($before.startedAt).ToUniversalTime() -ge [DateTime]::Parse($priorBefore.observedAt).ToUniversalTime()) 'CURRENT_RETRY_PRIOR_RUN'
 Need ((@($priorLock.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'beforeRef|continuationRef|currentPreCapture|profileRef|rehearsalProofRef|sourceControlDir|successorClaimRef' -and (B264Same $priorLock.profileRef ([pscustomobject]$refs.profile)) -and (B264Same $priorLock.beforeRef ([pscustomobject]$refs.before)) -and (B264Same $priorLock.successorClaimRef $context.retainedClaimRef) -and (B264Same $priorLock.continuationRef ([pscustomobject]$refs.context))) 'CURRENT_RETRY_LOCK'
 $eventPins=@('3c25d1da4017da7576cc15dd4a7cb603718cc1a4674897a52048bc56dc703b1f','58741b0f6db3a7596d35d04089d178090412c6f722f9a59a9f09f54d51d519bc','74d1c6dcdd5597935a9a8f2b814aef4e8167880bbc2c9ebea469d07f8f85af26');$previous=$refs.before.sha256
 foreach($n in 0..2){$e=Json (ReadWorkerPin (Join-Path $retryDir ('event-'+$n.ToString('0000')+'.json')) $eventPins[$n]);$keys=@('sequence','digest','event','stopOrderDigest','previousSha256','profileSha256','beforeSha256');if($n -gt 0){$keys+=,'target'};Need ((@($e.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (($keys|Sort-Object)-join '|') -and $e.sequence -eq $n -and $e.previousSha256 -ceq $previous -and $e.profileSha256 -ceq $refs.profile.sha256 -and $e.beforeSha256 -ceq $refs.before.sha256 -and $e.digest -ceq $before.plan.digest -and $e.stopOrderDigest -ceq $claim.stopOrderDigest -and $e.event -ceq @('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n]) 'CURRENT_RETRY_EVENT';if($n -gt 0){Need ($e.target -ceq @('coreSupervisor','HELD_CORE_CUT')[$n-1]) 'CURRENT_RETRY_TARGET'};$previous=$eventPins[$n]}
 $d=$values.diagnostic;Need ((@($d.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'beforeSha256|failureDiagnostic|phase|profileSha256|reason' -and $d.phase -ceq 'HELD_CORE_CUT' -and $d.reason -ceq 'P03_OWNER_TRANSITION_STOPPED' -and (B264Same $d.failureDiagnostic ([pscustomobject]@{stage='DRAIN';reason='P03_PHYSICAL_B264_CUT_OWNER_DIGEST'})) -and $d.profileSha256 -ceq $refs.profile.sha256 -and $d.beforeSha256 -ceq $refs.before.sha256) 'CURRENT_RETRY_FAILURE'
 $s=$values.snapshot;Need ((@($s.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'beforeSha256|consolePins|engineSha256|observedAt|oldIdentities|oldWatchers|probePins|profileSha256|protectedConsolePins|recoveryHelperSha256|schemaVersion' -and $s.schemaVersion -ceq 'melisa-p03-successor-precut-admission.v1' -and $s.profileSha256 -ceq $refs.profile.sha256 -and $s.beforeSha256 -ceq $refs.before.sha256 -and $s.engineSha256 -ceq 'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f' -and $s.recoveryHelperSha256 -ceq 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5' -and @($s.oldIdentities).Count -eq 8 -and @($s.oldWatchers).Count -eq 2) 'CURRENT_RETRY_SNAPSHOT'
 foreach($p in @($priorBefore.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($priorProfile.oldWatchers)){$rows=@(@($s.oldIdentities)+@($s.oldWatchers)|Where-Object{$_.pid -eq $p.pid});Need ($rows.Count -eq 1 -and (B264Same $rows[0] $p)) 'CURRENT_RETRY_SNAPSHOT_IDENTITY'}
 $i=$values.intent;Need ((@($i.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'beforeSha256|claimSha256|event|observedAt|profileSha256|stopOrderDigest' -and $i.event -ceq 'B264_OLD_CUT_INTENT' -and $i.claimSha256 -ceq $ClaimSha256 -and $i.stopOrderDigest -ceq $claim.stopOrderDigest -and $i.profileSha256 -ceq $refs.profile.sha256 -and $i.beforeSha256 -ceq $refs.before.sha256) 'CURRENT_RETRY_INTENT'
 Need (@(Get-ChildItem -LiteralPath $priorProfile.journalDirectory -Force).Count -eq 0) 'CURRENT_RETRY_JOURNAL'
 $files=@('b264-old-owner-cut-intent.json','event-0000.json','event-0001.json','event-0002.json','io-failure-diagnostic.json','p03-current-invariance-capture.ps1','p03-physical-recovery-observe.ps1','p03-physical-rollback-lifetime-v2.ps1','p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1','p03-pr54-new-owner-empty-recovery.ps1','p03-pr54-new-owner-observe.ps1','p03-pr54-paused-old-recover.ps1','p03-pr54-successor-core-drain.ps1','precut-continuation.json','successor-precut-admission.json','transition.lock','resume-attempt.json')
 Need ((@((Get-ChildItem -LiteralPath $retryDir -Force)|ForEach-Object{$_.Name}|Sort-Object)-join '|') -ceq (($files|Sort-Object)-join '|')) 'CURRENT_RETRY_OLD_SCOPE'
 $attempt=Json (ReadWorkerPin (Join-Path $retryDir 'resume-attempt.json') $ContinuationSha256);Need (B264Same $attempt $context) 'CURRENT_RETRY_ATTEMPT'
}
function AssertCurrentB007ResumeBinding($context,$claim){
 $isRetry=$context.schemaVersion -ceq 'melisa-p03-current-b007-precut-retry.v1'
 $resumeRun='452054204a1857ff618b0dd30a59caea';$resumeDir=Join-Path $base ('MelisaERP-P03-transition-'+$resumeRun)
 $keys=@('schemaVersion','retainedClaimRef','failureTailRef','retainedProfileRef','retainedBeforeRef','profileRef','beforeRef','claimPath')
 Need ((@($context.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (($keys|Sort-Object)-join '|') -and $context.schemaVersion -ceq $(if($isRetry){'melisa-p03-current-b007-precut-retry.v1'}else{'melisa-p03-current-b007-precut-resume.v1'})) 'CURRENT_RESUME_FIELDS'
 $pins=@{
  retainedClaimRef=@{path=(Join-Path $base 'p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json');sha256='a5990db676c6308e0899d81a2f6efdde539544109762802d62137d9ec853e544'}
  failureTailRef=$(if($isRetry){@{path=(Join-Path $base 'MelisaERP-P03-transition-9d2e00d572acc83391a0a2e5ac28d046\event-0002.json');sha256='74d1c6dcdd5597935a9a8f2b814aef4e8167880bbc2c9ebea469d07f8f85af26'}}else{@{path=(Join-Path $resumeDir 'event-0002.json');sha256='778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777'}})
  retainedProfileRef=@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$resumeRun+'.json'));sha256='4b808868f23ced8015aad4395a7c390017b374d3c23fe23d48fc6bf7f0397c39'}
  retainedBeforeRef=@{path=(Join-Path $base ('MelisaERP-P03-before-'+$resumeRun+'.json'));sha256='23ae28bc8d01f644c9f56404c6b358bc57afec336bb82bb3ad19158f2bd11d3f'}
  profileRef=@{path=$ProfilePath;sha256=$ProfileSha256}
  beforeRef=@{path=$BeforeImagePath;sha256=$BeforeImageSha256}
 }
 Need ($runId -cmatch '\A[a-f0-9]{32}\z' -and $runId -cnotin @($resumeRun,'cffba2988afcb49502ae73ddd797e966') -and $context.claimPath -ceq $ClaimPath -and $ClaimPath -ceq $pins.retainedClaimRef.path -and $ClaimSha256 -ceq $pins.retainedClaimRef.sha256 -and $ContinuationPath -ceq (Join-Path $dir 'precut-continuation.json')) 'CURRENT_RESUME_SCOPE'
 foreach($key in $pins.Keys){$r=$context.$key;$e=$pins[$key];Need ((@($r.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'path|sha256' -and $r.path -ceq $e.path -and $r.sha256 -ceq $e.sha256) 'CURRENT_RESUME_REF';[void](ReadWorkerPin $r.path $r.sha256)}
 $retained=Json (ReadWorkerPin $pins.retainedClaimRef.path $pins.retainedClaimRef.sha256);$retainedProfile=Json (ReadWorkerPin $pins.retainedProfileRef.path $pins.retainedProfileRef.sha256);$retainedBefore=Json (ReadWorkerPin $pins.retainedBeforeRef.path $pins.retainedBeforeRef.sha256)
 Need ((B264Same $retained $claim) -and $retained.successorRunId -ceq $resumeRun -and $retained.successorProfile.path -ceq $pins.retainedProfileRef.path -and $retained.successorProfile.sha256 -ceq $pins.retainedProfileRef.sha256 -and $retained.successorBefore.path -ceq $pins.retainedBeforeRef.path -and $retained.successorBefore.sha256 -ceq $pins.retainedBeforeRef.sha256) 'CURRENT_RESUME_RETAINED'
 Need ($ProfilePath -ceq (Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json')) -and $BeforeImagePath -ceq (Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json')) -and $before.runId -ceq $runId -and $retainedBefore.runId -ceq $resumeRun -and $profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256) 'CURRENT_RESUME_FRESH_REFS'
 Need ((B264Same (CurrentB007ResumeStable $profile @('beforeImage','businessDigest','journalDirectory','stopper')) (CurrentB007ResumeStable $retainedProfile @('beforeImage','businessDigest','journalDirectory','stopper'))) -and $profile.stopper.sha256 -ceq $retainedProfile.stopper.sha256 -and $profile.stopper.path -ceq (Join-Path $base ('MelisaERP-P03-stopper-'+$runId+'.ps1')) -and $profile.journalDirectory -ceq (Join-Path $base ('MelisaERP-P03-recovery-'+$runId))) 'CURRENT_RESUME_PROFILE_DRIFT'
 Need (B264Same (CurrentB007ResumeStable $before @('runId','startedAt','observedAt')) (CurrentB007ResumeStable $retainedBefore @('runId','startedAt','observedAt'))) 'CURRENT_RESUME_BEFORE_DRIFT'
 Need ([DateTime]::Parse($before.startedAt).ToUniversalTime() -ge [DateTime]::Parse($retainedBefore.observedAt).ToUniversalTime() -and [DateTime]::Parse($before.startedAt).ToUniversalTime() -le [DateTime]::Parse($before.observedAt).ToUniversalTime()) 'CURRENT_RESUME_CLOCK_ORDER'
 $attempt=Json (ReadWorkerPin (Join-Path $resumeDir 'resume-attempt.json') $(if($isRetry){'7f07000256ed4b1289f36fe5a2290bdfa71e125ff976276f1135b42f0ba4012c'}else{$ContinuationSha256}));if(-not $isRetry){Need (B264Same $attempt $context) 'CURRENT_RESUME_ATTEMPT'}
 $allowed=@('b264-old-owner-cut-intent.json','event-0000.json','event-0001.json','event-0002.json','io-failure-diagnostic.json','p03-current-invariance-capture.ps1','p03-physical-recovery-observe.ps1','p03-physical-rollback-lifetime-v2.ps1','p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1','p03-pr54-new-owner-empty-recovery.ps1','p03-pr54-new-owner-observe.ps1','p03-pr54-paused-old-recover.ps1','p03-pr54-successor-core-drain.ps1','precut-continuation.json','successor-precut-admission.json','transition.lock','resume-attempt.json')
 Need ((@((Get-ChildItem -LiteralPath $resumeDir -Force)|ForEach-Object{$_.Name}|Sort-Object)-join '|') -ceq (($allowed|Sort-Object)-join '|')) 'CURRENT_RESUME_OLD_SCOPE'
 $lock=Json (ReadWorkerPin (Join-Path $resumeDir 'transition.lock') '349cf763daa3c4cca0856640d48d82ed3c034325d0ad476b4019a31d7374eb73')
 Need ($lock.profileRef.path -ceq $pins.retainedProfileRef.path -and $lock.profileRef.sha256 -ceq $pins.retainedProfileRef.sha256 -and $lock.beforeRef.path -ceq $pins.retainedBeforeRef.path -and $lock.beforeRef.sha256 -ceq $pins.retainedBeforeRef.sha256 -and $lock.successorClaimRef.path -ceq $pins.retainedClaimRef.path -and $lock.successorClaimRef.sha256 -ceq $pins.retainedClaimRef.sha256) 'CURRENT_RESUME_OLD_LOCK'
 $priorContext=Json (ReadWorkerPin (Join-Path $resumeDir 'precut-continuation.json') 'edd1499034512d99153cff12d787a041571195cc59e3a1b01f94bc00dea6b7c1')
 Need ($priorContext.schemaVersion -ceq 'melisa-p03-current-b007-precut-continuation.v1' -and $priorContext.retainedClaimRef.path -ceq (Join-Path $base 'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json') -and $priorContext.retainedClaimRef.sha256 -ceq '3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408' -and $priorContext.failureTailRef.path -ceq (Join-Path $base 'MelisaERP-P03-transition-cffba2988afcb49502ae73ddd797e966\event-0002.json') -and $priorContext.failureTailRef.sha256 -ceq '87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82') 'CURRENT_RESUME_CFF_HISTORY'
 $priorClaim=Json (ReadWorkerPin $priorContext.retainedClaimRef.path $priorContext.retainedClaimRef.sha256);[void](ReadWorkerPin $priorContext.failureTailRef.path $priorContext.failureTailRef.sha256)
 Need ($priorClaim.successorProfile.path -ceq (Join-Path $base 'MelisaERP-P03-profile-cffba2988afcb49502ae73ddd797e966.json') -and $priorClaim.successorProfile.sha256 -ceq '7c3788d9dc97ae182adddec1b3b5f1106a6c408cc542ef00f8f6bc146ec4df8c' -and $priorClaim.successorBefore.path -ceq (Join-Path $base 'MelisaERP-P03-before-cffba2988afcb49502ae73ddd797e966.json') -and $priorClaim.successorBefore.sha256 -ceq 'd6aec6a904ca36bccccc2d295a770d8fae53ca3190b0b763e43788d2e3294f5c') 'CURRENT_RESUME_CFF_REFS'
 [void](ReadWorkerPin $priorClaim.successorProfile.path $priorClaim.successorProfile.sha256);[void](ReadWorkerPin $priorClaim.successorBefore.path $priorClaim.successorBefore.sha256)
 Need (@(Get-ChildItem -LiteralPath $retainedProfile.journalDirectory -Force).Count -eq 0) 'CURRENT_RESUME_OLD_JOURNAL'
 $beforeAge=([DateTime]::UtcNow-[DateTime]::Parse($before.observedAt).ToUniversalTime()).TotalSeconds;Need ($beforeAge -ge 0 -and $beforeAge -lt 900) 'CURRENT_RESUME_BEFORE_FRESH'
 $eventPins=@('18a78709172e036d3d9f452438af4cf9e21f39c89679271094447f44463da02a','741ea2a53a304ba27aff7bcade2548effa22a63e72ccbcf920189e4c6718330c','778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777');$eventPrevious=$pins.retainedBeforeRef.sha256
 foreach($n in 0..2){$event=Json (ReadWorkerPin (Join-Path $resumeDir ('event-'+$n.ToString('0000')+'.json')) $eventPins[$n]);Need ($event.sequence -eq $n -and $event.previousSha256 -ceq $eventPrevious -and $event.digest -ceq $retainedBefore.plan.digest -and $event.stopOrderDigest -ceq $claim.stopOrderDigest -and $event.profileSha256 -ceq $pins.retainedProfileRef.sha256 -and $event.beforeSha256 -ceq $pins.retainedBeforeRef.sha256 -and $event.event -ceq @('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n]) 'CURRENT_RESUME_PINNED_EVENT';if($n -gt 0){Need ($event.target -ceq @('coreSupervisor','HELD_CORE_CUT')[$n-1]) 'CURRENT_RESUME_PINNED_TARGET'};$eventPrevious=$eventPins[$n]}
 if($isRetry){AssertCurrentB007RetryHistory $context $claim $attempt $retainedProfile $retainedBefore}
 # No new owner timestamp or claim is created. The retained epoch is an anchor.
 return [pscustomobject]@{runId=$resumeRun;profileRef=$pins.retainedProfileRef;beforeRef=$pins.retainedBeforeRef;before=$retainedBefore;profile=$retainedProfile}
}
function AssertCurrentB007Continuation($claim){
 Need ($ContinuationPath -ceq (Join-Path $dir 'precut-continuation.json') -and $ContinuationSha256 -cmatch '\A[a-f0-9]{64}\z') 'CURRENT_CONTINUATION_PATH'
 $context=Json (ReadWorkerPin $ContinuationPath $ContinuationSha256)
 if($context.schemaVersion -cin @('melisa-p03-current-b007-precut-resume.v1','melisa-p03-current-b007-precut-retry.v1')){
  $binding=AssertCurrentB007ResumeBinding $context $claim
  $failedDir=Join-Path $base ('MelisaERP-P03-transition-'+$binding.runId)
  $events=@(Get-ChildItem -LiteralPath $failedDir -File|Where-Object{$_.Name -cmatch '^event-'}|ForEach-Object{$_.Name}|Sort-Object)
  Need (($events-join '|') -ceq 'event-0000.json|event-0001.json|event-0002.json' -and @(Get-ChildItem -LiteralPath $binding.profile.journalDirectory -Force).Count -eq 0) 'CURRENT_RESUME_JOURNAL'
  $resumeEventHashes=@('18a78709172e036d3d9f452438af4cf9e21f39c89679271094447f44463da02a','741ea2a53a304ba27aff7bcade2548effa22a63e72ccbcf920189e4c6718330c','778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777');$previous=$binding.beforeRef.sha256
  foreach($n in 0..2){$event=Json (ReadWorkerPin (Join-Path $failedDir ('event-'+$n.ToString('0000')+'.json')) $resumeEventHashes[$n]);Need ($event.sequence -eq $n -and $event.previousSha256 -ceq $previous -and $event.digest -ceq $before.plan.digest -and $event.stopOrderDigest -ceq $claim.stopOrderDigest -and $event.profileSha256 -ceq $binding.profileRef.sha256 -and $event.beforeSha256 -ceq $binding.beforeRef.sha256 -and $event.event -ceq @('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n]) 'CURRENT_RESUME_EVENT';if($n -gt 0){Need ($event.target -ceq @('coreSupervisor','HELD_CORE_CUT')[$n-1]) 'CURRENT_RESUME_EVENT_TARGET'};$previous=$resumeEventHashes[$n]}
  Need (@(Get-ChildItem -LiteralPath $failedDir -File|Where-Object{$_.Name -cmatch '\.json$' -and $_.Name -cmatch '(held-cut|core-cut|probe-drain|new-owner|candidate|readback|witness|rollback-result|invariance-comparison)'}).Count -eq 0) 'CURRENT_RESUME_CUT_ADVANCED'
  Need ($AdmittedSnapshotPath -ceq (Join-Path $dir 'successor-precut-admission.json')) 'CURRENT_RESUME_SNAPSHOT_PATH'
  $snapshot=Json (ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256)
  Need ($snapshot.schemaVersion -ceq 'melisa-p03-successor-precut-admission.v1' -and $snapshot.profileSha256 -ceq $ProfileSha256 -and $snapshot.beforeSha256 -ceq $BeforeImageSha256 -and $snapshot.engineSha256 -ceq $EngineSha256 -and $snapshot.recoveryHelperSha256 -ceq $RecoveryHelperSha256) 'CURRENT_RESUME_SNAPSHOT_REFS'
  if($null -ne $script:continuationLiveAdmission){AssertCurrentB007LiveAdmission $script:continuationLiveAdmission $claim $snapshot}else{$age=([DateTime]::UtcNow-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60 -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -le [DateTime]::Parse($snapshot.observedAt).ToUniversalTime()) 'CURRENT_RESUME_SNAPSHOT_FRESH'}
  return
 }
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
 $claimBinding=[pscustomobject]@{runId=$runId;profileRef=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};beforeRef=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};before=$before}
 $bindingContext=Json (ReadWorkerPin $ContinuationPath $ContinuationSha256)
 if($bindingContext.schemaVersion -cin @('melisa-p03-current-b007-precut-resume.v1','melisa-p03-current-b007-precut-retry.v1')){$claimBinding=AssertCurrentB007ResumeBinding $bindingContext $claim}
 $keys=@('schemaVersion','currentOwnerDigest','ownerObservedAt','protectedSqlEpoch','predecessorRunId','predecessorProfile','predecessorBefore','predecessorLock','consumedAncestorClaim','failedOuterTail','quarantinedRecoveryTail','readOnlyOldReady','successorRunId','successorProfile','successorBefore','newSettings','candidate','stopOrderDigest','transitionAuthority','applyExecuted')
 Need ((@($claim.PSObject.Properties.Name|Sort-Object) -join '|') -ceq (@($keys|Sort-Object) -join '|')) 'B264_CUT_CLAIM_FIELDS'
 Need ($claim.schemaVersion -ceq $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'melisa-p03-current-b007-epoch-claim.v1'}else{'melisa-p03-b264-current-epoch-claim.v1'}) -and $claim.predecessorRunId -ceq 'b264594b6f93d560d807c8decc4e6699' -and $claim.successorRunId -ceq $claimBinding.runId -and $claim.transitionAuthority -ceq $true -and $claim.applyExecuted -ceq $false -and $claim.currentOwnerDigest -cmatch '\A[a-f0-9]{64}\z') 'B264_CUT_CLAIM'
 Need ($claim.successorProfile.path -ceq $claimBinding.profileRef.path -and $claim.successorProfile.sha256 -ceq $claimBinding.profileRef.sha256 -and $claim.successorBefore.path -ceq $claimBinding.beforeRef.path -and $claim.successorBefore.sha256 -ceq $claimBinding.beforeRef.sha256 -and (B264Same $claim.newSettings $profile.newSettings)) 'B264_CUT_CLAIM_REFS'
 Need ((B264Same $claim.protectedSqlEpoch @($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -ccontains 'kind' -and $_.kind -ceq 'ProtectedSqlService'})[0]) -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -ge [DateTime]::Parse($claimBinding.before.observedAt).ToUniversalTime()) 'B264_CUT_EPOCH'
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

function Authority{if($Mode -cin @('ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck')){[void](AssertCompleted42d0Authority)}else{B264CutAuthority}}
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
function CurrentB007OwnerDigestBindings($fresh,$historical){
 # The JS claim commits the pinned predecessor array order, not the order in
 # which Windows enumerates listeners today. Verify the full multiset first;
 # sorting only comparison keys preserves duplicate counts and every tuple.
 $sets=@()
 foreach($bindings in @(@{rows=@($fresh)},@{rows=@($historical)})){
  [string[]]$keys=@(foreach($binding in $bindings.rows){
   ContinuationKeys $binding @('port','address')
   Need (($binding.port -is [int] -or $binding.port -is [long]) -and $binding.port -ge 1 -and $binding.port -le 65535 -and $binding.address -is [string] -and -not[string]::IsNullOrEmpty($binding.address)) 'CURRENT_OWNER_BINDING_FIELDS'
   [ordered]@{port=$binding.port;address=$binding.address}|ConvertTo-Json -Compress
  })
  [Array]::Sort($keys,[StringComparer]::Ordinal);$sets+=,@($keys)
 }
 Need ($sets[0].Count -eq $sets[1].Count) 'CURRENT_OWNER_BINDING_COUNT'
 for($i=0;$i -lt $sets[0].Count;$i++){Need ($sets[0][$i] -ceq $sets[1][$i]) 'CURRENT_OWNER_BINDING_TUPLE'}
 return ,@($historical)
}
function AssertB264CutCurrentOwner{
 $claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256);$inv=Inventory;ProtectedProcesses $inv
 $historicalPin=(B264CutHistoryPins).predecessorBefore
 ContinuationKeys $claim.predecessorBefore @('path','sha256')
 Need ($claim.predecessorBefore.path -ceq $historicalPin.path -and $claim.predecessorBefore.sha256 -ceq $historicalPin.sha256) 'CURRENT_OWNER_HISTORY_REF'
 $historicalBefore=Json (ReadWorkerPin $historicalPin.path $historicalPin.sha256)
 $owners=@(@(foreach($role in $order){
  $e=$before.identities.$role;$rows=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($rows.Count -eq 1 -and (Identity $rows[0] $e)) 'B264_CUT_OWNER_UID'
  $committedBindings=CurrentB007OwnerDigestBindings @($e.bindings) @($historicalBefore.identities.$role.bindings)
  [ordered]@{pid=[int]$e.pid;parentPid=[int]$e.parentPid;ownerSid=$e.ownerSid;nodePath=$e.nodePath;commandLine=$e.commandLine;creationTime=[DateTime]::Parse($e.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ');bindings=$committedBindings}
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
function SeedCompleted42d0Admission($snapshot){
 Need ($snapshot.schemaVersion -ceq 'melisa-p03-successor-precut-admission.v1' -and $snapshot.profileSha256 -ceq $ProfileSha256 -and $snapshot.beforeSha256 -ceq $BeforeImageSha256 -and $snapshot.engineSha256 -ceq $engineSha -and $snapshot.recoveryHelperSha256 -ceq $RecoveryHelperSha256) 'SUCCESSOR_SNAPSHOT'
 $age=($script:completedCutOpenedAt-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60) 'SUCCESSOR_SNAPSHOT_FRESH'
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

function PausedTasks{
 $inv=Inventory;Need ($inv.instances.Count -eq 0) 'PAUSED_COM'
 foreach($entry in $profile.tasks){$t=$folder.GetTask($entry.name);$allowed=@($entry.oldXmlSha256);if($Mode -ceq 'ResumeDrainCheck'){$allowed+=,$entry.newXmlSha256};Need ([int]$t.State -eq 3 -and (XmlHash ([string]$t.Xml)) -cin $allowed) 'PAUSED_OLD_ACTION'}
 return $inv
}
function Completed42d0AuxEpochPins{
 # A single recorded unrelated replacement generation, never a namespace grant.
 return @(
  @{pid=10996;parentPid=1316;name='explorer.exe';nodePath='C:\WINDOWS\Explorer.EXE';creationTime='2026-10-20T08:50:12.2095200Z';image='eee089fe6f927c7f0d51b0abd9d70c094157e33673ad760713ec7b1cea18ee11';argv='430d1236a76c6598d4ef2eb955143ba8c9e96c2191d8550725dc57be464363a9';signer='Windows'}
  @{pid=15168;parentPid=10996;name='ChatGPT.exe';nodePath='C:\Program Files\WindowsApps\OpenAI.Codex_26.1013.4894.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe';creationTime='2026-10-20T15:44:58.8725750Z';image='2f61eaeb01dcee7fd18d572fbb338c88b686c0d891427487fdd182afdd64b4f6';argv='c6daf7a65035cb0b14b7daedb95fa1405d1559fc365f79648c245fc85a4786e8';signer='OpenAI'}
  @{pid=55744;parentPid=15168;name='codex.exe';nodePath='C:\Users\Xaser\AppData\Local\OpenAI\Codex\bin\896a0166b774037a\codex.exe';creationTime='2026-10-20T15:45:02.7221640Z';image='f6dbf48cb70f62649c645f26c87dc9bf84cc36986202dfad8e12fb5b8ca70312';argv='abecfb4db22b20dd1ee6a70bab829479c24973ccede76abc26c191efe4e438f4';signer='OpenAI'}
  @{pid=4900;parentPid=55744;name='cmd.exe';nodePath='C:\WINDOWS\system32\cmd.exe';creationTime='2026-10-21T12:10:54.9240010Z';image='15cd209c995b7d3009c91ca40892d5b8f1fb162f3e5f10716642ea278e8e0d7b';argv='026acd2fa673c8312877cda5dc19a579762b616880f3c4202fc3144a9c0250df';signer='Windows'}
  @{pid=46520;parentPid=4900;name='conhost.exe';nodePath='C:\WINDOWS\system32\conhost.exe';creationTime='2026-10-21T12:10:54.9355440Z';image='c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac';argv='417222c4a0ecb4d60a457ebe8e26fddf3d5406bffb16a5c59af8eeb241beca51';signer='Windows'}
  @{pid=12092;parentPid=4900;name='node.exe';nodePath='C:\Users\Xaser\AppData\Local\OpenAI\Codex\runtimes\cua_node\78fb63cda1a9e2b2\bin\node.exe';creationTime='2026-10-21T12:10:55.0117390Z';image='edba9f4ef4eb4b9519a9a80674d68ba6ff70eff85d8f1719e072f89b69bf3f2f';argv='d39e616ddf70a14dd06a9f6f9781db395d96966fb8fe5f767c441569319d9f36';signer='OpenAI'}
 )
}
function Completed42d0AuxFrame($inventory,$expected){
 $all=@($inventory.all);Need ($all.Count -gt 0 -and $all.Count -le 100000) 'COMPLETED42_AUX_INVENTORY'
 $map=@{};foreach($row in $all){Need (-not$map.ContainsKey([int]$row.ProcessId)) 'COMPLETED42_AUX_DUPLICATE';$map[[int]$row.ProcessId]=$row}
 Need (-not$map.ContainsKey(1316)) 'COMPLETED42_AUX_ROOT_LINEAGE'
 $family=[Collections.Generic.HashSet[int]]::new();[void]$family.Add(4900);do{$added=$false;foreach($row in $all){if($family.Contains([int]$row.ParentProcessId)-and$family.Add([int]$row.ProcessId)){$added=$true}};Need ($family.Count-le3) 'COMPLETED42_AUX_FAMILY'}while($added)
 Need ((@($family|Sort-Object)-join ',') -ceq '4900,12092,46520') 'COMPLETED42_AUX_FAMILY'
 $forbidden=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{$_.pid})+@($profile.protectedProcesses|ForEach-Object{$_.pid})+@($inventory.instances|ForEach-Object{$_.EnginePID})+@($script:probePins.Keys)+@($script:protectedConsolePins.Keys)
 $result=@();foreach($pin in $expected){
  Need ($map.ContainsKey([int]$pin.pid) -and $pin.pid -notin $forbidden) 'COMPLETED42_AUX_MANAGED'
  $row=$map[[int]$pin.pid];$uid=NewHistoricalIdentity $row
  Need ($uid.pid-eq$pin.pid-and$uid.parentPid-eq$pin.parentPid-and$uid.name-ceq$pin.name-and$uid.nodePath-ceq$pin.nodePath-and$uid.ownerSid-ceq$owner-and[DateTime]::Parse($uid.creationTime).ToUniversalTime().Ticks-eq[DateTime]::Parse($pin.creationTime).ToUniversalTime().Ticks-and(Hash ([Text.Encoding]::UTF8.GetBytes($uid.commandLine)))-ceq$pin.argv) 'COMPLETED42_AUX_UID'
  Need (-not(IsWatcherCommand $uid.commandLine)) 'COMPLETED42_AUX_WATCHER'
  foreach($pkg in $profile.packages){foreach($v in @($uid.nodePath,$uid.commandLine)){Need ($v.Replace('/','\').IndexOf(([string]$pkg.root).Replace('/','\'),[StringComparison]::OrdinalIgnoreCase)-lt0) 'COMPLETED42_AUX_PACKAGE'}}
  Need (@($inventory.allListeners|Where-Object{$_.OwningProcess-eq$pin.pid}).Count-eq0) 'COMPLETED42_AUX_LISTENER'
  if($pin.pid-ne10996){Need ($map.ContainsKey([int]$pin.parentPid)-and$row.CreationDate.ToUniversalTime()-ge$map[[int]$pin.parentPid].CreationDate.ToUniversalTime()) 'COMPLETED42_AUX_BIRTH_EDGE'}
  NoReparse $uid.nodePath;Need ((Get-FileHash -LiteralPath $uid.nodePath -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$pin.image) 'COMPLETED42_AUX_IMAGE'
  $signature=Get-AuthenticodeSignature -LiteralPath $uid.nodePath;$subject=if($pin.signer-ceq'Windows'){'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'}else{'CN="OpenAI OpCo, LLC", O="OpenAI OpCo, LLC", L=San Francisco, S=California, C=US'}
  Need ($signature.Status-eq'Valid'-and$signature.SignerCertificate.Subject-ceq$subject) 'COMPLETED42_AUX_SIGNATURE'
  $result+=,[pscustomobject]@{pid=$uid.pid;parentPid=$uid.parentPid;name=$uid.name;nodePath=$uid.nodePath;ownerSid=$uid.ownerSid;creationTime=$uid.creationTime;commandLineSha256=$pin.argv;imageSha256=$pin.image;identitySha256=(NewHistoricalDigest $uid)}
 }
 return @($result|Sort-Object pid)
}
function Completed42d0AuxProof($snapshot){
 $old=@($snapshot.consolePins|Where-Object{$_.pid-eq4900});Need ($old.Count-eq1-and$old[0].nodePath-ceq'C:\Windows\System32\conhost.exe'-and[DateTime]::Parse($old[0].creationTime).ToUniversalTime().Ticks-eq[DateTime]::Parse('2026-10-20T08:50:12.012338Z').ToUniversalTime().Ticks) 'COMPLETED42_AUX_OLD'
 $expected=@(Completed42d0AuxEpochPins);$held=@{};try{
  $first=Inventory;ProtectedProcesses $first;$pins=@(Completed42d0AuxFrame $first $expected)
  foreach($pin in $pins){$held[[int]$pin.pid]=NewHistoricalOpenProcess $pin.pid;$rows=@($first.all|Where-Object{$_.ProcessId-eq$pin.pid});NewHistoricalKernel $held[[int]$pin.pid] (NewHistoricalIdentity $rows[0])}
  for($pass=0;$pass-lt2;$pass++){$fresh=Inventory;ProtectedProcesses $fresh;$again=@(Completed42d0AuxFrame $fresh $expected);Need ((NewHistoricalDigest $again)-ceq(NewHistoricalDigest $pins)) 'COMPLETED42_AUX_CAS';foreach($pin in $again){$rows=@($fresh.all|Where-Object{$_.ProcessId-eq$pin.pid});NewHistoricalKernel $held[[int]$pin.pid] (NewHistoricalIdentity $rows[0])}}
  return [pscustomobject]@{historicalConsolePins=@($old);replacementEpochDigest=(NewHistoricalDigest $pins);family=@($pins|Where-Object{$_.pid-in@(4900,12092,46520)});ancestors=@($pins|Where-Object{$_.pid-in@(10996,15168,55744)});observedAt=[DateTime]::UtcNow.ToString('o');stopPermitted=$false;mutationExecuted=$false}
 }finally{foreach($handle in $held.Values){$handle.Dispose()}}
}
function Completed42d0Pins{
 $prefix=Join-Path $base 'MelisaERP-P03-transition-42d0d0536cb115cc4aea43ff1f13afbf'
 return @{
  profile=@{path=(Join-Path $base 'MelisaERP-P03-profile-42d0d0536cb115cc4aea43ff1f13afbf.json');sha256='a06625191c5b8ccdc622a40555513fcd5192fa81eae784ee706fc258cee9100e'}
  before=@{path=(Join-Path $base 'MelisaERP-P03-before-42d0d0536cb115cc4aea43ff1f13afbf.json');sha256='e05d2d7d30a8d477457a78adf7bbe342955d4667a0ba005dc0e399b3e3b8e791'}
  lock=@{path=(Join-Path $prefix 'transition.lock');sha256='529cb039012f157cdbe0395beb760c47e9297e23db8badb08b1b76743ed31478'}
  context=@{path=(Join-Path $prefix 'precut-continuation.json');sha256='c7e2f4b3a206295173d04c01ff0d4436c49f71b5eaf847da7f89c34b3346bc63'}
  pointer=@{path=(Join-Path $base 'MelisaERP-P03-transition-9d2e00d572acc83391a0a2e5ac28d046\resume-attempt.json');sha256='c7e2f4b3a206295173d04c01ff0d4436c49f71b5eaf847da7f89c34b3346bc63'}
  priorPointer=@{path=(Join-Path $base 'MelisaERP-P03-transition-452054204a1857ff618b0dd30a59caea\resume-attempt.json');sha256='7f07000256ed4b1289f36fe5a2290bdfa71e125ff976276f1135b42f0ba4012c'}
  claim=@{path=(Join-Path $base 'p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json');sha256='a5990db676c6308e0899d81a2f6efdde539544109762802d62137d9ec853e544'}
  snapshot=@{path=(Join-Path $prefix 'successor-precut-admission.json');sha256='6307733ac07c330f67a47027875bb052f2e45b4aa0b187e630271d8837743175'}
  root=@{path=(Join-Path $prefix 'b264-old-owner-cut-intent.json');sha256='1ec55968246907d4a21b3019e876f0a69e7f19e9a535dace2c87bce2f284e1b6'}
  held=@{path=(Join-Path $prefix 'b264-old-owner-held-cut-intent.json');sha256='d02b03d0fff4953211a11029f45d7fa14949bbc95433bca98b669a16c72f996b'}
  cut=@{path=(Join-Path $prefix 'successor-core-cut-completed.json');sha256='9c34ca6fa5677927a0df780775c13b929e59ed5baf0732cb15f43714179d91fb'}
  event0=@{path=(Join-Path $prefix 'event-0000.json');sha256='3fe7476876a9373e4add7e69e2b4806490011291533eaa21e8fcdd7c583fc937'}
  event1=@{path=(Join-Path $prefix 'event-0001.json');sha256='19cf41d5d20ab587176925f4da14879292b0bf1eac208020328c88109b369a15'}
  tail=@{path=(Join-Path $prefix 'event-0002.json');sha256='9b729821da2461174532b51bd1fb467216d12b4710c2b56a04c5be5ed59d9aef'}
  diagnostic=@{path=(Join-Path $prefix 'io-failure-diagnostic.json');sha256='ae1d923a995992c5f79b3c199fad8cc3ca99037dbf1a740418aef3d0c5a41b9c'}
 }
}
function AssertCompleted42d0Authority{
 Need ($Mode -cin @('ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck') -and $PolicyGeneration -ceq 'CurrentB007InspectOnly' -and $runId -ceq '42d0d0536cb115cc4aea43ff1f13afbf' -and $dir -ceq (Join-Path $base ('MelisaERP-P03-transition-'+$runId))) 'COMPLETED42_SCOPE'
 $pins=Completed42d0Pins;$values=@{};foreach($key in $pins.Keys){$ref=$pins[$key];$values[$key]=Json (ReadWorkerPin $ref.path $ref.sha256)}
 foreach($binding in @(@($ProfilePath,$ProfileSha256,'profile'),@($BeforeImagePath,$BeforeImageSha256,'before'),@($ClaimPath,$ClaimSha256,'claim'),@($ContinuationPath,$ContinuationSha256,'context'),@($RootIntentPath,$RootIntentSha256,'root'),@($AdmittedSnapshotPath,$AdmittedSnapshotSha256,'snapshot'))){Need ($binding[0] -ceq $pins[$binding[2]].path -and $binding[1] -ceq $pins[$binding[2]].sha256) 'COMPLETED42_INPUT_REF'}
 Need ($EnginePath -ceq (Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1') -and $RecoveryHelperPath -ceq (Join-Path $dir 'p03-pr54-paused-old-recover.ps1')) 'COMPLETED42_SOURCE_SCOPE'
 foreach($ref in @(@($EnginePath,$EngineSha256),@($RecoveryHelperPath,$RecoveryHelperSha256),@($DrainerPath,$DrainerSha256))){[void](ReadWorkerPin $ref[0] $ref[1])}
 AssertCurrentB007StaticContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256
 $claim=$values.claim;AssertB264CutStopPlan $claim
 $history=B264CutHistoryPins;foreach($key in $history.Keys){$ref=$claim.$key;Need ($ref.path -ceq $history[$key].path -and $ref.sha256 -ceq $history[$key].sha256) 'COMPLETED42_HISTORY';[void](ReadWorkerPin $ref.path $ref.sha256)}
 foreach($ref in @($values.context.retainedProfileRef,$values.context.retainedBeforeRef,$values.context.failureTailRef)){[void](ReadWorkerPin $ref.path $ref.sha256)}
 $cut=$values.cut;$held=$values.held;$root=$values.root;$snapshot=$values.snapshot
 Need ($cut.event -ceq 'B264_OLD_OWNER_CORE_CUT_COMPLETED' -and $cut.heldProcessHandle -ceq $true -and $cut.processAbsent -ceq $true -and $cut.mechanism -cin @('COM_STOP_NATURAL_EXIT','EXACT_OBSERVED_PROCESS_STOPPED') -and $cut.profileSha256 -ceq $ProfileSha256 -and $cut.beforeSha256 -ceq $BeforeImageSha256 -and $cut.claimSha256 -ceq $ClaimSha256 -and $cut.durableIntent.path -ceq $pins.held.path -and $cut.durableIntent.sha256 -ceq $pins.held.sha256) 'COMPLETED42_CUT'
 Need ($held.heldProcessHandle -ceq $true -and $held.rootIntentSha256 -ceq $pins.root.sha256 -and $held.admittedSnapshotSha256 -ceq $pins.snapshot.sha256 -and $held.windowOpenedAt -ceq $cut.windowOpenedAt -and $root.claimSha256 -ceq $ClaimSha256 -and $root.stopOrderDigest -ceq $claim.stopOrderDigest) 'COMPLETED42_CHAIN'
 foreach($f in @('pid','parentPid','nodePath','ownerSid','commandLine','creationTime')){Need ($cut.core.$f -ceq $before.identities.coreSupervisor.$f -and $held.core.$f -ceq $before.identities.coreSupervisor.$f) 'COMPLETED42_CORE_UID'}
 $opened=[DateTime]::Parse($cut.windowOpenedAt).ToUniversalTime();$completed=[DateTime]::Parse($cut.cutCompletedAt).ToUniversalTime();$beforeTime=[DateTime]::Parse($before.observedAt).ToUniversalTime()
 Need (($opened-$beforeTime).TotalSeconds -ge 0 -and ($opened-$beforeTime).TotalSeconds -lt 900 -and ($completed-$opened).TotalSeconds -ge 0 -and ($completed-$opened).TotalSeconds -lt 60 -and $completed -le [DateTime]::UtcNow) 'COMPLETED42_HISTORICAL_WINDOW'
 foreach($stamp in @($root.observedAt,$snapshot.observedAt)){$age=($opened-[DateTime]::Parse($stamp).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60) 'COMPLETED42_ADMISSION_WINDOW'}
 Need ($values.diagnostic.failureDiagnostic.stage -ceq 'DRAIN' -and $values.diagnostic.failureDiagnostic.reason -ceq 'P03_PHYSICAL_B264_CUT_INTENT_FRESH' -and $values.tail.event -ceq 'FAILED') 'COMPLETED42_FAILURE'
 $intentPath=Join-Path $dir 'completed-cut-recovery-intent.json'
 if($Mode -ceq 'ResumeDrainDryRun'){Need (-not(Test-Path -LiteralPath $intentPath)) 'COMPLETED42_RECOVERY_ONCE'}else{
  $intentSha=(Get-FileHash -LiteralPath $intentPath -Algorithm SHA256).Hash.ToLowerInvariant();$recoveryIntent=Json (ReadWorkerPin $intentPath $intentSha)
  ContinuationKeys $recoveryIntent @('schemaVersion','mode','runId','profileRef','beforeRef','claimRef','cutRef','failureTailRef','workerRef')
  Need ($recoveryIntent.schemaVersion -ceq 'melisa-p03-current-b007-completed-cut-recovery.v1' -and $recoveryIntent.mode -ceq 'ROLLBACK_OLD_ONLY' -and $recoveryIntent.runId -ceq $runId) 'COMPLETED42_RECOVERY_INTENT'
  foreach($pair in @(@('profileRef','profile'),@('beforeRef','before'),@('claimRef','claim'),@('cutRef','cut'),@('failureTailRef','tail'))){$r=$recoveryIntent.($pair[0]);ContinuationKeys $r @('path','sha256');Need ($r.path -ceq $pins[$pair[1]].path -and $r.sha256 -ceq $pins[$pair[1]].sha256) 'COMPLETED42_RECOVERY_INTENT_REF'}
  $worker=$recoveryIntent.workerRef;ContinuationKeys $worker @('path','sha256')
  Need ($worker.path -ceq $PSCommandPath -and $worker.path -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-current-b007-control-[a-f0-9]{12}\\p03-pr54-current-b007-precut-cut\.ps1\z') 'COMPLETED42_RECOVERY_WORKER'
  [void](ReadWorkerPin $worker.path $worker.sha256)
 }
 return $values
}
function ResumeCompleted42d0Drain{
 $proof=AssertCompleted42d0Authority
 Need ((Test-Path -LiteralPath (Join-Path $dir 'successor-core-probe-drain.json')) -eq ($Mode -ceq 'ResumeDrainCheck')) 'COMPLETED42_DRAIN_ONCE'
 PrepareProbeSource;$script:completedCutOpenedAt=[DateTime]::Parse($proof.cut.windowOpenedAt).ToUniversalTime();SeedCompleted42d0Admission $proof.snapshot
 $aux=Completed42d0AuxProof $proof.snapshot;Need ($script:consolePins.ContainsKey(4900)) 'COMPLETED42_AUX_CACHE';$script:consolePins.Remove(4900)
 # A completed witness is historical evidence, never a replacement kernel handle.
 # Unknown late children cannot be adopted without the original held lifetime.
 $script:lateAdmissionOpen=$false;$script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$script:tasksStopRequested=$true
 $inv=Inventory;ProtectedProcesses $inv;$script:drainedPids=@()
 foreach($role in $order){$e=$before.identities.$role;$rows=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});if($rows.Count -eq 0){$script:drainedPids+=,[int]$e.pid}else{Need ($rows.Count -eq 1 -and (Identity $rows[0] $e)) 'COMPLETED42_REMAINING_UID'}}
 Need ($before.identities.coreSupervisor.pid -in $script:drainedPids) 'COMPLETED42_CORE_PRESENT'
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{
  $aux=Completed42d0AuxProof $proof.snapshot
  $check=RecoveredRemainingCore
  $afterAux=Completed42d0AuxProof $proof.snapshot;Need ($afterAux.replacementEpochDigest -ceq $aux.replacementEpochDigest) 'COMPLETED42_AUX_AFTER_CAS';$aux=$afterAux
  $probeIds=@($script:probePins.Keys);$live=@($check.all|Where-Object{$_.ProcessId -in $probeIds -or $_.ParentProcessId -eq $before.identities.coreSupervisor.pid -and $_.ProcessId -notin @($before.identities.PSObject.Properties|ForEach-Object{$_.Value.pid})})
  if($live.Count -eq 0){break};Start-Sleep -Milliseconds 250
 }while([DateTime]::UtcNow -lt $until)
 Need ($live.Count -eq 0) 'COMPLETED42_PROBE_NOT_ABSENT'
 if($Mode -ceq 'ResumeDrainCheck'){
  $path=Join-Path $dir 'successor-core-probe-drain.json';$sha=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();$drain=Json (ReadWorkerPin $path $sha)
  Need ($drain.event-ceq'B264_OLD_OWNER_CORE_PROBES_ABSENT'-and$drain.profileSha256-ceq$ProfileSha256-and$drain.beforeSha256-ceq$BeforeImageSha256-and$drain.cutWitness.path-ceq(Completed42d0Pins).cut.path-and$drain.cutWitness.sha256-ceq(Completed42d0Pins).cut.sha256) 'COMPLETED42_REFRESH_DRAIN'
  return [ordered]@{status='B264_COMPLETED_CUT_HISTORICAL_AUX_READ_ONLY';mutationExecuted=$false;stopPermitted=$false;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;cutWitness=(Completed42d0Pins).cut;drainWitness=[pscustomobject]@{path=$path;sha256=$sha};observedAt=$aux.observedAt;historicalConsolePins=$aux.historicalConsolePins;replacementEpochDigest=$aux.replacementEpochDigest;scope='CURRENT42D0_HISTORICAL_CONSOLE_4900_ONLY';family=$aux.family;ancestors=$aux.ancestors}
 }
 if($Mode -ceq 'ResumeDrainDryRun'){return [ordered]@{status='B264_COMPLETED_CUT_RESUME_DRY_RUN';mutationExecuted=$false;cutWitness=(Completed42d0Pins).cut;coreAbsent=$true;watchersAbsent=$true;probesAbsent=$true;remainingOldRoles=(8-@($script:drainedPids).Count)}}
 $value=[ordered]@{event='B264_OLD_OWNER_CORE_PROBES_ABSENT';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;cutWitness=(Completed42d0Pins).cut;observedAt=[DateTime]::UtcNow.ToString('o');consolePins=@($script:consolePins.Values);probePins=@($script:probePins.Values);protectedConsolePins=@($script:protectedConsolePins.Values);readOnlyHistoricalAux=$aux;latePrecutProbePids=@();goneOldPids=@($script:drainedPids)}
 $drain=WriteB264CutEvidence 'successor-core-probe-drain.json' $value
 return [ordered]@{status='B264_OLD_OWNER_CORE_DRAINED';coreStopResult=$proof.cut.mechanism;heldCoreExited=$true;comStopped=$true;remainingOldRoles=(8-@($script:drainedPids).Count);goneOldPids=@($script:drainedPids);cutWitness=(Completed42d0Pins).cut;drainWitness=$drain}
}
if($Mode -cin @('ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck')){ResumeCompleted42d0Drain|ConvertTo-Json -Depth 25 -Compress;return}
B264CutAuthority
if($Mode -ceq 'Inspect'){CaptureWorkerAdmission|ConvertTo-Json -Depth 25 -Compress;return}
DrainB264OldOwner|ConvertTo-Json -Depth 25 -Compress
