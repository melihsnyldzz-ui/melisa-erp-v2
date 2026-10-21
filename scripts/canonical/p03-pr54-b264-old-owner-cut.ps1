param(
 [string]$PolicyGeneration='B264InspectOnly',
 [ValidateSet('Inspect','Drain')][string]$Mode='Inspect',
 [Parameter(Mandatory=$true)][string]$ProfilePath,[Parameter(Mandatory=$true)][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,[Parameter(Mandatory=$true)][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,[Parameter(Mandatory=$true)][string]$EngineSha256,
 [Parameter(Mandatory=$true)][string]$RecoveryHelperPath,[Parameter(Mandatory=$true)][string]$RecoveryHelperSha256,
 [Parameter(Mandatory=$true)][string]$DrainerPath,[Parameter(Mandatory=$true)][string]$DrainerSha256,
 [string]$ClaimPath,[string]$ClaimSha256,[string]$AdmittedSnapshotPath,[string]$AdmittedSnapshotSha256,[string]$RootIntentPath,[string]$RootIntentSha256,[string]$ContinuationPath,[string]$ContinuationSha256
)
if($PolicyGeneration -cnotin @('B264InspectOnly','B264Sup20DInspectOnly','CurrentB007InspectOnly')){throw 'P03_B264_CUT_POLICY'}
if($PolicyGeneration -ceq 'CurrentB007InspectOnly' -and $EnginePath -cnotmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-(?:current-b007-control-[a-f0-9]{12}|transition-[a-f0-9]{32})\\p03-physical-rollback-lifetime-v2\.ps1\z'){throw 'P03_CURRENT_B007_ENGINE_SCOPE'}
# Definitions-only reuse. No historical dispatcher, claim creation or task start.
if($EngineSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}) -or $RecoveryHelperSha256 -cne 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5' -or $DrainerSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'9a0e0931bbd1897f55d25396cd64619a663821eccd6ebf8cb00d1250e5bdab33'}elseif($PolicyGeneration -ceq 'B264Sup20DInspectOnly'){'eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5'}else{'34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c'})){throw 'P03_B264_CUT_SOURCE'}
if($Mode -ceq 'Inspect' -and @('ClaimPath','ClaimSha256','AdmittedSnapshotPath','AdmittedSnapshotSha256','RootIntentPath','RootIntentSha256','ContinuationPath','ContinuationSha256'|Where-Object{$PSBoundParameters.ContainsKey($_)}).Count){throw 'P03_B264_CUT_INSPECT_ONLY'}
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
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')

# Finite metadata-only binding for the one failed974d pre-cut generation.
# Fresh OLD admission remains in the caller; recovery adds no wall-clock gate.
function Same974dShape($a,$b,[string[]]$omit=@()){
 if($null-eq$a-or$null-eq$b){return $null-eq$a-and$null-eq$b}
 if($a-is[Array]-or$b-is[Array]){if($a-isnot[Array]-or$b-isnot[Array]-or$a.Count-ne$b.Count){return $false};for($i=0;$i-lt$a.Count;$i++){if(-not(Same974dShape $a[$i] $b[$i])){return $false}};return $true}
 if($a.GetType().FullName-ceq'System.Management.Automation.PSCustomObject'-or$b.GetType().FullName-ceq'System.Management.Automation.PSCustomObject'){if($a.GetType().FullName-cne'System.Management.Automation.PSCustomObject'-or$b.GetType().FullName-cne'System.Management.Automation.PSCustomObject'){return $false};$ak=@($a.PSObject.Properties.Name|Where-Object{$_-cnotin$omit}|Sort-Object);$bk=@($b.PSObject.Properties.Name|Where-Object{$_-cnotin$omit}|Sort-Object);if(($ak-join'|')-cne($bk-join'|')){return $false};foreach($k in $ak){if(-not(Same974dShape $a.$k $b.$k)){return $false}};return $true}
 return $a.GetType()-eq$b.GetType()-and$a-ceq$b
}
function Assert974dContinuation($context,$currentClaim,[scriptblock]$read){
 $failed='974d73c7d84b9ea43e1397b0fdf44c01';$priorDir=Join-Path $base ('MelisaERP-P03-transition-'+$failed);$expectedClaim=Join-Path $base ('p03-pr54-current-b007-continuation-of-'+$failed+'.lock.json')
 $keys=@('schemaVersion','retainedClaimRef','failureTailRef','profileRef','beforeRef','claimPath','correctedSourceCommit')
 Need ((@($context.PSObject.Properties.Name|Sort-Object)-join'|')-ceq(@($keys|Sort-Object)-join'|')-and$context.schemaVersion-ceq'melisa-p03-current-b007-precut974d-continuation.v1'-and$context.correctedSourceCommit-ceq'82e741af59cb59f27a4008ded83ca889238fb5c7'-and$context.claimPath-ceq$expectedClaim) 'CURRENT_974D_CONTEXT'
 $pins=[ordered]@{
 claim=[pscustomobject]@{path=(Join-Path $base 'p03-pr54-current-b007-generation-1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381.lock.json');sha256='fb736269cb81c53a164f35f2c348dff7c32ec574b46a1b7b00666f9d9f0a5332'}
 profile=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$failed+'.json'));sha256='68dcb12d3ed557f1ffe48bf99961b24daaa62cf387d1265ac0ad28e608690f3a'}
 before=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$failed+'.json'));sha256='ff97a87aa6caf59ae934d07b055bc4d7f8470677a70f30e0b5a12b3a36e5349f'}
 transitionLock=[pscustomobject]@{path=(Join-Path $priorDir 'transition.lock');sha256='657702fcb5b1a9255ec65fe6fe012f584c797e87f881f68223394215f24c575c'}
 event0=[pscustomobject]@{path=(Join-Path $priorDir 'event-0000.json');sha256='ae88c07259811eb76dcaefc52655f3605af89e99be5e87203d5cb8b0bc67d67c'}
 event1=[pscustomobject]@{path=(Join-Path $priorDir 'event-0001.json');sha256='7452b31c398f56bfea1dbbadf7df1ff295c5bd7673ed04ea4de60c65eb593832'}
 failureTail=[pscustomobject]@{path=(Join-Path $priorDir 'event-0002.json');sha256='327528179fdbed252553f06c7b8e3ba812cfd3c0a4d96419298ba94163c09706'}
 diagnostic=[pscustomobject]@{path=(Join-Path $priorDir 'io-failure-diagnostic.json');sha256='a571e5dfdb1e0f00c9102733c0a054827d1230f343351805ed515389f93e8aa8'}
 }
 Need ((Same974dShape $context.retainedClaimRef $pins.claim)-and(Same974dShape $context.failureTailRef $pins.failureTail)-and(Same974dShape $context.profileRef ([pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256}))-and(Same974dShape $context.beforeRef ([pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256}))) 'CURRENT_974D_REFS'
 $old=@{};foreach($key in $pins.Keys){$old[$key]=&$read $pins[$key].path $pins[$key].sha256}
 Need ($old.claim.successorRunId-ceq$failed-and$old.claim.currentOwnerDigest-ceq'1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381'-and$old.claim.transitionAuthority-ceq$true-and$old.claim.applyExecuted-ceq$false-and(Same974dShape $old.claim.successorProfile $pins.profile)-and(Same974dShape $old.claim.successorBefore $pins.before)) 'CURRENT_974D_HISTORY'
 Need ((Same974dShape $old.transitionLock.profileRef $pins.profile)-and(Same974dShape $old.transitionLock.beforeRef $pins.before)-and(Same974dShape $old.transitionLock.successorClaimRef $pins.claim)-and(Same974dShape $old.transitionLock.currentPreCapture.snapshotRef $old.profile.businessDigest)) 'CURRENT_974D_LOCK'
 $previous=$pins.before.sha256;foreach($i in 0..2){$key=@('event0','event1','failureTail')[$i];$row=$old[$key];Need ($row.sequence-eq$i-and$row.event-ceq@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$i]-and$row.previousSha256-ceq$previous-and$row.profileSha256-ceq$pins.profile.sha256-and$row.beforeSha256-ceq$pins.before.sha256-and$row.digest-ceq$old.before.plan.digest-and$row.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_974D_CHAIN';if($i-gt0){Need ($row.target-ceq@('','coreSupervisor','HELD_CORE_CUT')[$i]) 'CURRENT_974D_TARGET'};$previous=$pins[$key].sha256}
 Need ($old.diagnostic.phase-ceq'HELD_CORE_CUT'-and$old.diagnostic.reason-ceq'P03_OWNER_TRANSITION_STOPPED'-and$old.diagnostic.failureDiagnostic.stage-ceq'INSPECT'-and$old.diagnostic.failureDiagnostic.reason-ceq'UNCLASSIFIED_IO_FAILURE'-and$old.diagnostic.profileSha256-ceq$pins.profile.sha256-and$old.diagnostic.beforeSha256-ceq$pins.before.sha256) 'CURRENT_974D_DIAGNOSTIC'
 Need ($before.runId-cne$failed-and$before.runId-cmatch'\A[a-f0-9]{32}\z'-and$ProfilePath-ceq(Join-Path $base ('MelisaERP-P03-profile-'+$before.runId+'.json'))-and$BeforeImagePath-ceq(Join-Path $base ('MelisaERP-P03-before-'+$before.runId+'.json'))-and(Same974dShape $profile.beforeImage $context.beforeRef)-and(Same974dShape $before $old.before @('runId','startedAt','observedAt'))-and(Same974dShape $profile $old.profile @('beforeImage','businessDigest','journalDirectory','stopper'))) 'CURRENT_974D_EQUIVALENCE'
 Need ([DateTime]::Parse($before.startedAt).ToUniversalTime()-le[DateTime]::Parse($before.observedAt).ToUniversalTime()-and[DateTime]::Parse($before.startedAt).ToUniversalTime()-ge[DateTime]::Parse($old.before.observedAt).ToUniversalTime()) 'CURRENT_974D_TIMES'
 Need ($profile.businessDigest.path-cmatch'\AC:\\Sirket\\ERP\\backups\\P03-20261021-\d{6}\\source-pre-snapshot-[a-f0-9]{32}\.json\z'-and$profile.businessDigest.path-cne$old.profile.businessDigest.path-and[IO.Path]::GetDirectoryName($profile.businessDigest.path)-ceq[IO.Path]::GetDirectoryName($old.profile.businessDigest.path)-and$profile.journalDirectory-ceq(Join-Path $base ('MelisaERP-P03-recovery-'+$before.runId))-and$profile.stopper.path-ceq(Join-Path $base ('MelisaERP-P03-stopper-'+$before.runId+'.ps1'))-and$profile.stopper.sha256-ceq$old.profile.stopper.sha256) 'CURRENT_974D_NEW_REFS'
 Need ($currentClaim.currentOwnerDigest-ceq$old.claim.currentOwnerDigest-and(Same974dShape $currentClaim.candidate $old.claim.candidate)-and(Same974dShape $currentClaim.protectedSqlEpoch $old.claim.protectedSqlEpoch)-and$currentClaim.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_974D_CLAIM_EQUIVALENCE'
 # The failed source generation never entered recovery. Preserve its empty journal.
 Protected $old.profile.journalDirectory;Need (@(Get-ChildItem -LiteralPath $old.profile.journalDirectory -Force).Count-eq0) 'CURRENT_974D_OLD_JOURNAL'
 foreach($leaf in @('b264-old-owner-held-cut-intent.json','successor-core-cut-completed.json','successor-core-probe-drain.json','new-owner-started.json')){Need (-not(Test-Path -LiteralPath (Join-Path $priorDir $leaf))) 'CURRENT_974D_NO_CUT'}
}

function AssertB142Continuation($context,$currentClaim,[scriptblock]$read){
 $failed='b14266ad30507bb10d78ae76e2546221';$priorDir=Join-Path $base ('MelisaERP-P03-transition-'+$failed);$expectedClaim=Join-Path $base ('p03-pr54-current-b007-continuation-of-'+$failed+'.lock.json')
 $keys=@('schemaVersion','retainedClaimRef','failureTailRef','profileRef','beforeRef','claimPath','correctedSourceCommit')
 Need ((@($context.PSObject.Properties.Name|Sort-Object)-join'|')-ceq(@($keys|Sort-Object)-join'|')-and$context.schemaVersion-ceq'melisa-p03-current-b007-precutb142-continuation.v1'-and$context.correctedSourceCommit-ceq'82e741af59cb59f27a4008ded83ca889238fb5c7'-and$context.claimPath-ceq$expectedClaim) 'CURRENT_B142_CONTEXT'
 $pins=[ordered]@{
 claim=[pscustomobject]@{path=(Join-Path $base 'p03-pr54-current-b007-continuation-of-974d73c7d84b9ea43e1397b0fdf44c01.lock.json');sha256='442f7d953c6e75512c36a259611d6d3f2275e9073d030991e1f87c177cd461a5'}
 profile=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$failed+'.json'));sha256='8e34643bd8fb360e8ad7e94fcf5bca1e3b9b438a4d19ca1dce01d21b375d8bb2'}
 before=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$failed+'.json'));sha256='360b5f6551fda107d2f556f1230cdc2812dcc44b0818bf5b8c35d5b453e7f9d1'}
 transitionLock=[pscustomobject]@{path=(Join-Path $priorDir 'transition.lock');sha256='de02d0c1d1caa26f95c6c22497aa738a2b2905e9e15c1d6dcd6f71d199d57f6b'}
 event0=[pscustomobject]@{path=(Join-Path $priorDir 'event-0000.json');sha256='457c86fe6db487b490f1d8db50bf69d90a5090c498f8c00cea121aad1660bef9'}
 event1=[pscustomobject]@{path=(Join-Path $priorDir 'event-0001.json');sha256='dfe8cf9b4be4189ce17aa3482fdcb6d3fa20ba05cf678074f0c2d750ffd43b56'}
 failureTail=[pscustomobject]@{path=(Join-Path $priorDir 'event-0002.json');sha256='abfbe25fb456df145857d10e96f366d3aacfd91b0cfe14440b0ab51b1c04d77c'}
 diagnostic=[pscustomobject]@{path=(Join-Path $priorDir 'io-failure-diagnostic.json');sha256='588065c6d36a65563869698586765ee838cb739a70c263ebde454fa9a761a72a'}
 context=[pscustomobject]@{path=(Join-Path $priorDir 'precut-continuation.json');sha256='cc3adf31b7e0bf9fda138093c2fd2c6c892cae09884e443bd1a06cee52605e3a'}
 snapshot=[pscustomobject]@{path=(Join-Path $priorDir 'successor-precut-admission.json');sha256='25bbcfd0dcb027c7acbd7e78437e55e1bf47bc46c37904474d03e3010665bf32'}
 intent=[pscustomobject]@{path=(Join-Path $priorDir 'b264-old-owner-cut-intent.json');sha256='81051359805fa84cc44ddad4586161e084055572d08b1d2df214ade7dc6e9e0a'}
 }
 Need ((Same974dShape $context.retainedClaimRef $pins.claim)-and(Same974dShape $context.failureTailRef $pins.failureTail)-and(Same974dShape $context.profileRef ([pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256}))-and(Same974dShape $context.beforeRef ([pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256}))) 'CURRENT_B142_REFS'
 $old=@{};foreach($key in $pins.Keys){$old[$key]=&$read $pins[$key].path $pins[$key].sha256}
 Need ($old.claim.successorRunId-ceq$failed-and$old.claim.currentOwnerDigest-ceq'1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381'-and$old.claim.transitionAuthority-ceq$true-and$old.claim.applyExecuted-ceq$false-and(Same974dShape $old.claim.successorProfile $pins.profile)-and(Same974dShape $old.claim.successorBefore $pins.before)) 'CURRENT_B142_HISTORY'
 Need ((Same974dShape $old.transitionLock.profileRef $pins.profile)-and(Same974dShape $old.transitionLock.beforeRef $pins.before)-and(Same974dShape $old.transitionLock.successorClaimRef $pins.claim)-and(Same974dShape $old.transitionLock.currentPreCapture.snapshotRef $old.profile.businessDigest)) 'CURRENT_B142_LOCK'
 $previous=$pins.before.sha256;foreach($i in 0..2){$key=@('event0','event1','failureTail')[$i];$row=$old[$key];Need ($row.sequence-eq$i-and$row.event-ceq@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$i]-and$row.previousSha256-ceq$previous-and$row.profileSha256-ceq$pins.profile.sha256-and$row.beforeSha256-ceq$pins.before.sha256-and$row.digest-ceq$old.before.plan.digest-and$row.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_B142_CHAIN';if($i-gt0){Need ($row.target-ceq@('','coreSupervisor','HELD_CORE_CUT')[$i]) 'CURRENT_B142_TARGET'};$previous=$pins[$key].sha256}
 Need ($old.diagnostic.phase-ceq'HELD_CORE_CUT'-and$old.diagnostic.reason-ceq'P03_OWNER_TRANSITION_STOPPED'-and$old.diagnostic.failureDiagnostic.stage-ceq'DRAIN'-and$old.diagnostic.failureDiagnostic.reason-ceq'P03_PHYSICAL_B264_CUT_OWNER_FRESH'-and$old.diagnostic.profileSha256-ceq$pins.profile.sha256-and$old.diagnostic.beforeSha256-ceq$pins.before.sha256) 'CURRENT_B142_DIAGNOSTIC'
 Need ((Same974dShape $old.transitionLock.continuationRef $pins.context)) 'CURRENT_B142_CONTEXT_POINTER'
 # Verify the immutable974d lineage using the retained b142 profile/before.
 & { $profile=$old.profile;$before=$old.before;$ProfilePath=$pins.profile.path;$ProfileSha256=$pins.profile.sha256;$BeforeImagePath=$pins.before.path;$BeforeImageSha256=$pins.before.sha256;Assert974dContinuation $old.context $old.claim $read }
 $snapshot=$old.snapshot;$intent=$old.intent
 Need ((@($snapshot.PSObject.Properties.Name|Sort-Object)-join'|')-ceq' beforeSha256|consolePins|engineSha256|observedAt|oldIdentities|oldWatchers|probePins|profileSha256|protectedConsolePins|recoveryHelperSha256|schemaVersion'.Trim()-and$snapshot.schemaVersion-ceq'melisa-p03-successor-precut-admission.v1'-and$snapshot.profileSha256-ceq$pins.profile.sha256-and$snapshot.beforeSha256-ceq$pins.before.sha256-and$snapshot.engineSha256-ceq'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'-and$snapshot.recoveryHelperSha256-ceq'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'-and@($snapshot.oldIdentities).Count-eq8-and@($old.before.identities.PSObject.Properties).Count-eq8-and(Same974dShape @($snapshot.oldWatchers) @($old.profile.oldWatchers))) 'CURRENT_B142_SNAPSHOT'
 foreach($entry in $old.before.identities.PSObject.Properties){Need (@($snapshot.oldIdentities|Where-Object{Same974dShape $_ $entry.Value}).Count-eq1) 'CURRENT_B142_SNAPSHOT_UID'}
 Need ((@($intent.PSObject.Properties.Name|Sort-Object)-join'|')-ceq'beforeSha256|claimSha256|event|observedAt|profileSha256|stopOrderDigest'-and$intent.event-ceq'B264_OLD_CUT_INTENT'-and$intent.claimSha256-ceq$pins.claim.sha256-and$intent.stopOrderDigest-ceq$old.claim.stopOrderDigest-and$intent.profileSha256-ceq$pins.profile.sha256-and$intent.beforeSha256-ceq$pins.before.sha256-and[DateTime]::Parse($intent.observedAt).ToUniversalTime()-ge[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()) 'CURRENT_B142_INTENT'
 Need ($before.runId-cne$failed-and$before.runId-cmatch'\A[a-f0-9]{32}\z'-and$ProfilePath-ceq(Join-Path $base ('MelisaERP-P03-profile-'+$before.runId+'.json'))-and$BeforeImagePath-ceq(Join-Path $base ('MelisaERP-P03-before-'+$before.runId+'.json'))-and(Same974dShape $profile.beforeImage $context.beforeRef)-and(Same974dShape $before $old.before @('runId','startedAt','observedAt'))-and(Same974dShape $profile $old.profile @('beforeImage','businessDigest','journalDirectory','stopper'))) 'CURRENT_B142_EQUIVALENCE'
 Need ([DateTime]::Parse($before.startedAt).ToUniversalTime()-le[DateTime]::Parse($before.observedAt).ToUniversalTime()-and[DateTime]::Parse($before.startedAt).ToUniversalTime()-ge[DateTime]::Parse($old.before.observedAt).ToUniversalTime()) 'CURRENT_B142_TIMES'
 Need ($profile.businessDigest.path-cmatch'\AC:\\Sirket\\ERP\\backups\\P03-20261021-\d{6}\\source-pre-snapshot-[a-f0-9]{32}\.json\z'-and$profile.businessDigest.path-cne$old.profile.businessDigest.path-and[IO.Path]::GetDirectoryName($profile.businessDigest.path)-ceq[IO.Path]::GetDirectoryName($old.profile.businessDigest.path)-and$profile.journalDirectory-ceq(Join-Path $base ('MelisaERP-P03-recovery-'+$before.runId))-and$profile.stopper.path-ceq(Join-Path $base ('MelisaERP-P03-stopper-'+$before.runId+'.ps1'))-and$profile.stopper.sha256-ceq$old.profile.stopper.sha256) 'CURRENT_B142_NEW_REFS'
 Need ($currentClaim.currentOwnerDigest-ceq$old.claim.currentOwnerDigest-and(Same974dShape $currentClaim.candidate $old.claim.candidate)-and(Same974dShape $currentClaim.protectedSqlEpoch $old.claim.protectedSqlEpoch)-and$currentClaim.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_B142_CLAIM_EQUIVALENCE'
 # The failed source generation never entered recovery. Preserve its empty journal.
 Protected $old.profile.journalDirectory;Need (@(Get-ChildItem -LiteralPath $old.profile.journalDirectory -Force).Count-eq0) 'CURRENT_B142_OLD_JOURNAL'
 foreach($leaf in @('b264-old-owner-held-cut-intent.json','successor-core-cut-completed.json','successor-core-probe-drain.json','new-owner-started.json')){Need (-not(Test-Path -LiteralPath (Join-Path $priorDir $leaf))) 'CURRENT_B142_NO_CUT'}
}

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
function B264CutAdmissionTime{
 if(-not $script:cutWitnessCommitted){return [DateTime]::UtcNow}
 # Once the held core has really exited and its CreateNew witness is committed,
 # draining that SAME captured generation must not re-admit a vanished owner.
 # Preserve both original timestamps and the original <60s destructive window.
 Need ($script:coreQuiesced-and$null-ne$script:coreLifetime-and$script:coreLifetime.HasExited-and$null-ne$script:precutWindowOpenedAt-and$null-ne$script:coreStopCompletedAt) 'B264_CUT_POSTCOMMIT_STATE'
 $elapsed=($script:coreStopCompletedAt-$script:precutWindowOpenedAt).TotalSeconds
 Need ($elapsed-ge0-and$elapsed-lt60-and[DateTime]::UtcNow-ge$script:coreStopCompletedAt) 'B264_CUT_POSTCOMMIT_WINDOW'
 return $script:precutWindowOpenedAt
}
function B264CutAuthority{
 foreach($pin in @(@($ProfilePath,$ProfileSha256),@($BeforeImagePath,$BeforeImageSha256),@($EnginePath,$EngineSha256),@($RecoveryHelperPath,$RecoveryHelperSha256),@($DrainerPath,$DrainerSha256))){[void](ReadWorkerPin $pin[0] $pin[1])}
 if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){AssertCurrentB007InspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 (B264CutAdmissionTime)}elseif($PolicyGeneration -ceq 'B264Sup20DInspectOnly'){AssertB264Sup20DInspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}else{AssertB264InspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}
 foreach($entry in @(@($EnginePath,$(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'p03-physical-rollback-lifetime-v2.ps1'}else{'p03-physical-rollback.ps1'})),@($RecoveryHelperPath,'p03-pr54-paused-old-recover.ps1'),@($DrainerPath,'p03-pr54-successor-core-drain.ps1'))){Need ($entry[0].StartsWith($base+'\',[StringComparison]::Ordinal) -and [IO.Path]::GetFileName($entry[0]) -ceq $entry[1]) 'B264_CUT_SOURCE_SCOPE'}
 if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){Need ($(if($Mode -ceq 'Inspect'){$EnginePath -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-current-b007-control-[a-f0-9]{12}\\p03-physical-rollback-lifetime-v2\.ps1\z' -or $EnginePath -ceq (Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1')}else{$EnginePath -ceq (Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1')})) 'CURRENT_B007_ENGINE_RUN'}
 if($Mode -ceq 'Inspect'){return}
 $legacyClaim=Join-Path $base $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'}else{'p03-pr54-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'})
 $freshClaim=$PolicyGeneration -ceq 'CurrentB007InspectOnly'-and$ClaimPath -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\p03-pr54-current-b007-generation-[a-f0-9]{64}\.lock\.json\z'
 $continuation974d=$PolicyGeneration -ceq 'CurrentB007InspectOnly'-and$ClaimPath -ceq (Join-Path $base 'p03-pr54-current-b007-continuation-of-974d73c7d84b9ea43e1397b0fdf44c01.lock.json')
 $continuationB142=$PolicyGeneration -ceq 'CurrentB007InspectOnly'-and$ClaimPath -ceq (Join-Path $base 'p03-pr54-current-b007-continuation-of-b14266ad30507bb10d78ae76e2546221.lock.json')
 Need ($Mode -ceq 'Drain' -and ($ClaimPath -ceq $legacyClaim-or$freshClaim-or$continuation974d-or$continuationB142)) 'B264_CUT_CLAIM_PATH'
 $claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256)
 if($freshClaim){Need ($ClaimPath -ceq (Join-Path $base ('p03-pr54-current-b007-generation-'+$claim.currentOwnerDigest+'.lock.json'))) 'B264_CUT_GENERATION_EPOCH'}
 $keys=@('schemaVersion','currentOwnerDigest','ownerObservedAt','protectedSqlEpoch','predecessorRunId','predecessorProfile','predecessorBefore','predecessorLock','consumedAncestorClaim','failedOuterTail','quarantinedRecoveryTail','readOnlyOldReady','successorRunId','successorProfile','successorBefore','newSettings','candidate','stopOrderDigest','transitionAuthority','applyExecuted')
 Need ((@($claim.PSObject.Properties.Name|Sort-Object) -join '|') -ceq (@($keys|Sort-Object) -join '|')) 'B264_CUT_CLAIM_FIELDS'
 Need ($claim.schemaVersion -ceq $(if($PolicyGeneration -ceq 'CurrentB007InspectOnly'){'melisa-p03-current-b007-epoch-claim.v1'}else{'melisa-p03-b264-current-epoch-claim.v1'}) -and $claim.predecessorRunId -ceq 'b264594b6f93d560d807c8decc4e6699' -and $claim.successorRunId -ceq $runId -and $claim.transitionAuthority -ceq $true -and $claim.applyExecuted -ceq $false -and $claim.currentOwnerDigest -cmatch '\A[a-f0-9]{64}\z') 'B264_CUT_CLAIM'
 Need ($claim.successorProfile.path -ceq $ProfilePath -and $claim.successorProfile.sha256 -ceq $ProfileSha256 -and $claim.successorBefore.path -ceq $BeforeImagePath -and $claim.successorBefore.sha256 -ceq $BeforeImageSha256 -and (B264Same $claim.newSettings $profile.newSettings)) 'B264_CUT_CLAIM_REFS'
 Need ((B264Same $claim.protectedSqlEpoch @($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -ccontains 'kind' -and $_.kind -ceq 'ProtectedSqlService'})[0]) -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -ge [DateTime]::Parse($before.observedAt).ToUniversalTime()) 'B264_CUT_EPOCH'
 $ownerAge=((B264CutAdmissionTime)-[DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime()).TotalSeconds;Need ($ownerAge -ge 0 -and $ownerAge -lt 60) 'B264_CUT_OWNER_FRESH'
 if($continuationB142){Need ($ContinuationPath -ceq (Join-Path $dir 'precut-continuation.json') -and $ContinuationSha256 -cmatch '\A[a-f0-9]{64}\z') 'CURRENT_B142_CONTEXT_PATH';$context=Json (ReadWorkerPin $ContinuationPath $ContinuationSha256);AssertB142Continuation $context $claim {param($p,$h) Json (ReadWorkerPin $p $h)}}elseif($continuation974d){Need ($ContinuationPath -ceq (Join-Path $dir 'precut-continuation.json') -and $ContinuationSha256 -cmatch '\A[a-f0-9]{64}\z') 'CURRENT_974D_CONTEXT_PATH';$context=Json (ReadWorkerPin $ContinuationPath $ContinuationSha256);Assert974dContinuation $context $claim {param($p,$h) Json (ReadWorkerPin $p $h)}}else{Need ([string]::IsNullOrEmpty((Get-Variable -Name ContinuationPath -ValueOnly -ErrorAction SilentlyContinue))-and[string]::IsNullOrEmpty((Get-Variable -Name ContinuationSha256 -ValueOnly -ErrorAction SilentlyContinue))) 'CURRENT_974D_CONTEXT_FORBIDDEN'}
 AssertB264CutStopPlan $claim
 $candidate=[ordered]@{erpSource=$newSettings.components.erpApiNative.sourceCommit;erpManifest=$newSettings.components.erpApiNative.manifestSha256;crmSource=$newSettings.components.crm.sourceCommit;crmManifest=$newSettings.components.crm.manifestSha256;supervisorSource=$newSettings.supervisor.sourceCommit;supervisorManifest=$newSettings.supervisor.manifestSha256;supervisorRoot=$newSettings.supervisor.packageRoot;newSettings=$profile.newSettings}
 Need (B264Same $claim.candidate $candidate) 'B264_CUT_CANDIDATE'
 $history=B264CutHistoryPins
 foreach($key in $history.Keys){$pin=$claim.$key;Need ($pin.path -ceq $history[$key].path -and $pin.sha256 -ceq $history[$key].sha256 -and @($pin.PSObject.Properties).Count -eq 2) 'B264_CUT_HISTORY';[void](ReadWorkerPin $pin.path $pin.sha256)}
 $stopDigest=Hash ([Text.Encoding]::UTF8.GetBytes(([ordered]@{planDigest=$before.plan.digest;stopOrder=$order}|ConvertTo-Json -Compress)))
 Need ($claim.stopOrderDigest -ceq $stopDigest -and $AdmittedSnapshotPath -ceq (Join-Path $dir 'successor-precut-admission.json') -and $RootIntentPath -ceq (Join-Path $dir 'b264-old-owner-cut-intent.json')) 'B264_CUT_INTENT_PATH'
 $intent=Json (ReadWorkerPin $RootIntentPath $RootIntentSha256)
 Need ($intent.event -ceq 'B264_OLD_CUT_INTENT' -and $intent.claimSha256 -ceq $ClaimSha256 -and $intent.stopOrderDigest -ceq $stopDigest -and $intent.profileSha256 -ceq $ProfileSha256 -and $intent.beforeSha256 -ceq $BeforeImageSha256) 'B264_CUT_INTENT'
 $intentAge=((B264CutAdmissionTime)-[DateTime]::Parse($intent.observedAt).ToUniversalTime()).TotalSeconds;Need ($intentAge -ge 0 -and $intentAge -lt 60) 'B264_CUT_INTENT_FRESH'
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
function ContinuationKeys($value,[string[]]$keys){Need ((@($value.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (($keys|Sort-Object)-join '|')) 'CURRENT_OWNER_BINDING_KEYS'}
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
 $currentBindingOrder=(Get-Variable -Name PolicyGeneration -ValueOnly -ErrorAction SilentlyContinue)-ceq'CurrentB007InspectOnly'
 if($currentBindingOrder){
  $historicalPin=(B264CutHistoryPins).predecessorBefore;ContinuationKeys $claim.predecessorBefore @('path','sha256')
  Need ($claim.predecessorBefore.path -ceq $historicalPin.path -and $claim.predecessorBefore.sha256 -ceq $historicalPin.sha256) 'CURRENT_OWNER_HISTORY_REF'
  $historicalBefore=Json (ReadWorkerPin $historicalPin.path $historicalPin.sha256)
 }
 $owners=@(@(foreach($role in $order){
  $e=$before.identities.$role;$rows=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($rows.Count -eq 1 -and (Identity $rows[0] $e)) 'B264_CUT_OWNER_UID'
  $committedBindings=if($currentBindingOrder){CurrentB007OwnerDigestBindings @($e.bindings) @($historicalBefore.identities.$role.bindings)}else{,@($e.bindings)}
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
  [void](CaptureWorkerAdmission);AssertB264CutCurrentOwner
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
