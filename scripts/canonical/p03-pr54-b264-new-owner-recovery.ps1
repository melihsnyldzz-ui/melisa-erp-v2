param(
 [ValidateSet('Inspect','Drain')][string]$Action='Inspect',
 [ValidateSet('LegacyB264','B264Sup20D','CurrentB007')][string]$PolicyGeneration='LegacyB264',
 [Parameter(Mandatory=$true)][string]$ProfilePath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ClaimSha256,
 [Parameter(Mandatory=$true)][string]$EmptyRecoveryPath,
 [Parameter(Mandatory=$true)][string]$RecoveryHelperPath,
 [Parameter(Mandatory=$true)][string]$NewObserverPath,
 [Parameter(Mandatory=$true)][string]$SourceObserverPath
)
# Additive B264 NEW-owner recovery. Source AST imports only: no imported dispatcher.
# This emits an empty candidate; it does not run frozen StopNew/RollbackOld.
# Unproven orphan/partial ownership is deliberately refused.
if($PolicyGeneration -cnotin @('LegacyB264','B264Sup20D','CurrentB007')){throw 'P03_B264_NEW_RECOVERY_POLICY'}
if($PolicyGeneration -ceq 'CurrentB007' -and $EnginePath -cnotmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-[a-f0-9]{32}\\p03-physical-rollback-lifetime-v2\.ps1\z'){throw 'P03_CURRENT_B007_ENGINE_SCOPE'}
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018'
$engineSha=if($PolicyGeneration -ceq 'CurrentB007'){'1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}


function Require-NewDrain($condition,[string]$code){if(-not $condition){throw ('P03_NEW_DRAIN_'+$code)}}
function Import-B264Definitions([byte[]]$bytes,[string[]]$only=@(),[hashtable]$aliases=@{}){
 $t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($bytes),[ref]$t,[ref]$e)
 Require-NewDrain ($e.Count -eq 0) 'SOURCE_PARSE'
 $defs=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$false))
 Require-NewDrain (@($defs.Name|Sort-Object -Unique).Count -eq $defs.Count) 'SOURCE_DUPLICATE'
 foreach($name in $only){Require-NewDrain (@($defs|Where-Object{$_.Name -ceq $name}).Count -eq 1) 'SOURCE_FUNCTION'}
 foreach($d in $defs){if($only.Count -and $d.Name -cnotin $only){continue}
  if($d.Name -ceq 'HubLineage'){$script:newFrozenHubLineageBody=$d.Body.Extent.Text}
  $alias=if($aliases.ContainsKey($d.Name)){$aliases[$d.Name]}else{$d.Name}
  . ([scriptblock]::Create('function script:'+$alias+$d.Extent.Text.Substring(('function '+$d.Name).Length)))
 }
}
function Read-B264Source([string]$path,[string]$sha,[string]$leaf){
 Require-NewDrain ([IO.Path]::GetFullPath($path) -ceq $path -and $path.StartsWith($base+'\',[StringComparison]::Ordinal) -and [IO.Path]::GetFileName($path) -ceq $leaf) 'SOURCE_PATH'
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){Require-NewDrain (-not((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'SOURCE_REPARSE'}
 $acl=Get-Acl -LiteralPath $path;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 Require-NewDrain ($acl.AreAccessRulesProtected -and $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq $owner -and $rules.Count -eq 2) 'SOURCE_ACL'
 foreach($sid in @($owner,'S-1-5-18')){Require-NewDrain (@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and -not $_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -eq 1) 'SOURCE_ACL'}
 $stream=[IO.File]::Open($path,'Open','Read','None')
 try{Require-NewDrain ($stream.Length -gt 0 -and $stream.Length -le 16777216) 'SOURCE_SIZE';$m=[IO.MemoryStream]::new();$stream.CopyTo($m);$bytes=$m.ToArray();$hash=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant();Require-NewDrain ($hash -ceq $sha) 'SOURCE_HASH';return ,$bytes}finally{$stream.Dispose()}
}
function Get-B264RecoverySourcePolicy{
 if($PolicyGeneration -ceq 'CurrentB007'){return @{newObserverSha256='3bce4718115f83f469129080729d241c3e2acc435a7307f61c4bb73a976eb298';observerSha256='fe6e03bb1cd7c1b928fde19b18d74eb1333965f65948e7881c6b3d1079c59385'}}
 if($PolicyGeneration -ceq 'B264Sup20D'){
  return @{newObserverSha256='b7ba34e3b13899874f0ea3d5cd168682f81fd946ca7d42db586d8a95ff4efa22';observerSha256='5e1f89bd24ba7b1a2c8738cab3f2f29d4ec44ade96b62127d9f1367efd6143f9'}
 }
 Require-NewDrain ($PolicyGeneration -ceq 'LegacyB264') 'POLICY'
 return @{newObserverSha256='1644e2d61653e41851698f1f8e98d873e0346dcf21cea6b243f7c4af66c00920';observerSha256='5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5'}
}
function Initialize-B264Recovery{
 Require-NewDrain ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ceq $owner) 'OWNER'
 # All sources are read/hash/ACL checked before definitions are imported. None
 # of these files' top-level dispatchers execute.
 $engine=Read-B264Source $EnginePath $engineSha $(if($PolicyGeneration -ceq 'CurrentB007'){'p03-physical-rollback-lifetime-v2.ps1'}else{'p03-physical-rollback.ps1'})
 $empty=Read-B264Source $EmptyRecoveryPath $(if($PolicyGeneration -ceq 'CurrentB007'){'ef7e9bc94688b5fd4817d36da174e2d0c768d4d3a9ce33fd2bdaea4fac7297bd'}else{'a742992d20b5eb44f2092249077cf785a5176525c6d498dd300873b0bfaa7f4a'}) 'p03-pr54-new-owner-empty-recovery.ps1'
 $paused=Read-B264Source $RecoveryHelperPath 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5' 'p03-pr54-paused-old-recover.ps1'
 $sourcePolicy=Get-B264RecoverySourcePolicy
 $new=Read-B264Source $NewObserverPath $sourcePolicy.newObserverSha256 'p03-pr54-new-owner-observe.ps1'
 $observer=Read-B264Source $SourceObserverPath $sourcePolicy.observerSha256 'p03-physical-recovery-observe.ps1'
 Import-B264Definitions $engine @() @{ConsoleAuxiliaries='B264FrozenConsoleAuxiliaries';HubLineage='B264FrozenHubLineage'}
 Import-B264Definitions $empty @('Assert-NewDrainOldAbsent','Save-NewDrain','Read-NewDrainReceipt','Stop-NewDrainExact','Hold-NewDrainCore','Open-NewDrainOutput')
 if($PolicyGeneration -ceq 'CurrentB007'){Import-B264Definitions $empty @('Assert-CurrentB007RecoverySettings')}
 Import-B264Definitions $paused @('SourceBytes','PrepareProbeSource','LatePrecutProbeAllowed','ProbeAuxiliaries')
 Import-B264Definitions $observer @('ObserverRequire','ObserverNoReparse','ObserverPolicyBinary')
 Import-B264Definitions $new @('NewHubHandleInfo','NewHubOpenShell','NewHubShellIdentity','NewHubLauncherArgsAllowed','NewHubLineage','NewAssertHubLineageEquivalence')
 NewAssertHubLineageEquivalence
 # Importing frozen functions never grants a broader dispatcher capability.
}
function Initialize-B264Bindings{
 $script:b264HistoricalBefore=$before
 $script:parentPins=@{};$script:watcherPins=@{};$script:consolePins=@{};$script:tasksStopRequested=$false
 $script:newGone=@();$script:newCoreHandle=$null;$script:probePins=@{};$script:lateProbePids=@()
 $script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false;$script:lateAdmissionOpen=$false
 $script:coreCutRecorded=$false;$script:lastCoreStopperResult=$null;$script:precutWindowOpenedAt=$null;$script:coreStopCompletedAt=$null;$script:coreLifetime=$null
 $oldSettings=$newSettings;PrepareProbeSource
 # Dynamic scope only: PrepareProbeSource checks the candidate supervisor,
 # while the original oldSettings and before image remain immutable.
}
function Same-B264Value($a,$b){return ($a|ConvertTo-Json -Depth 18 -Compress) -ceq ($b|ConvertTo-Json -Depth 18 -Compress)}
function Get-B264HistoricalPins{
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
function Assert-B264StopPlan{
 $targets=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor')
 $stopOrder=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
 $plan=$before.plan
 Require-NewDrain ((@($plan.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'digest|newSettingsSha256|oldSettingsSha256|targets') 'B264_PLAN_KEYS'
 Require-NewDrain ((@($plan.targets)-join '|') -ceq ($targets-join '|')) 'B264_PLAN_TARGETS'
 Require-NewDrain ($plan.oldSettingsSha256 -cmatch '\A[a-f0-9]{64}\z' -and $plan.newSettingsSha256 -cmatch '\A[a-f0-9]{64}\z' -and $plan.oldSettingsSha256 -cne $plan.newSettingsSha256) 'B264_PLAN_SETTINGS_HASHES'
 Require-NewDrain ($plan.oldSettingsSha256 -ceq $profile.oldSettings.sha256 -and $plan.newSettingsSha256 -ceq $profile.newSettings.sha256 -and (Same-B264Value $before.oldConfig $profile.oldSettings) -and (Same-B264Value $before.newConfig $profile.newSettings)) 'B264_PLAN_SETTINGS_BINDING'
 $canonical=[ordered]@{targets=$targets;oldSettingsSha256=$plan.oldSettingsSha256;newSettingsSha256=$plan.newSettingsSha256}
 $digest=Hash ([Text.UTF8Encoding]::new($false).GetBytes(($canonical|ConvertTo-Json -Compress)))
 Require-NewDrain ($plan.digest -ceq $digest) 'B264_PLAN_DIGEST'
 $commitment=[ordered]@{planDigest=$digest;stopOrder=$stopOrder}
 $stopDigest=Hash ([Text.UTF8Encoding]::new($false).GetBytes(($commitment|ConvertTo-Json -Compress)))
 Require-NewDrain ($claim.stopOrderDigest -ceq $stopDigest) 'B264_STOP_ORDER_DIGEST'
}
function Assert-B264RecoveryCandidateTuple{
 if($PolicyGeneration -ceq 'CurrentB007'){
  Require-NewDrain ($claim.candidate.supervisorSource -ceq 'b007317f03e6be2c3a3d2271428dcf9dec33e04e' -and $claim.candidate.supervisorManifest -ceq '365dc4dd287fb05d171ca30f8c9e8abb037f9d9d5382a79f61fa9356f8d21eac' -and $claim.candidate.supervisorRoot -ceq 'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-b007317f03e6' -and $claim.newSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-7ba6e4ebc8b7-erp-6dc33f417373-current.json' -and $claim.newSettings.sha256 -ceq 'de54c4da7f5b33a5f41b94624f01df4eb315dfa6a20fd2826af9ca37538d3942') 'CURRENT_B007_CANDIDATE';return
 }

 if($PolicyGeneration -ceq 'B264Sup20D'){
  Require-NewDrain ($claim.candidate.supervisorSource -ceq '20d7e5b696969d502014ba359b950496dc530410') 'B264_SUP20D_SOURCE'
  Require-NewDrain ($claim.candidate.supervisorManifest -ceq '0959b1b84faafe2e297e537d470d6b6d443e6fac2fe30d3f2518f5b6036d1418') 'B264_SUP20D_MANIFEST'
  Require-NewDrain ($claim.candidate.supervisorRoot -ceq 'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-20d7e5b69696') 'B264_SUP20D_ROOT'
  Require-NewDrain ($claim.newSettings.sha256 -ceq 'f893faf4a1113fab3fdcdfce181e219f1bee480be4b6ab4142a738e47c094c95') 'B264_SUP20D_SETTINGS'
 }else{
  Require-NewDrain ($PolicyGeneration -ceq 'LegacyB264') 'POLICY'
 Require-NewDrain ($claim.candidate.supervisorSource -ceq 'eb5b37a555cbf18e1fcaa491820707c73b354e12') 'B264_SUPERVISOR_SOURCE'
 Require-NewDrain ($claim.candidate.supervisorManifest -ceq '1a9d7a0ba6d0ed0fa60e9044122fb895e58e725d84f194ceea255a00aece39b0') 'B264_SUPERVISOR_MANIFEST'
 Require-NewDrain ($claim.candidate.supervisorRoot -ceq 'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-eb5b37a555cb') 'B264_SUPERVISOR_ROOT'
 }
}
function Assert-B264Claim{
 Assert-B264StopPlan
 $keys=@('schemaVersion','currentOwnerDigest','ownerObservedAt','protectedSqlEpoch','predecessorRunId','predecessorProfile','predecessorBefore','predecessorLock','consumedAncestorClaim','failedOuterTail','quarantinedRecoveryTail','readOnlyOldReady','successorRunId','successorProfile','successorBefore','newSettings','candidate','stopOrderDigest','transitionAuthority','applyExecuted')
 Require-NewDrain ((@($claim.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (($keys|Sort-Object)-join '|')) 'B264_CLAIM_KEYS'
 $candidateKeys=@('erpSource','erpManifest','crmSource','crmManifest','supervisorSource','supervisorManifest','supervisorRoot','newSettings')
 Require-NewDrain ((@($claim.candidate.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (($candidateKeys|Sort-Object)-join '|')) 'B264_CANDIDATE_KEYS'
 Require-NewDrain ($claim.candidate.erpSource -ceq $(if($PolicyGeneration -ceq 'CurrentB007'){'6dc33f41737349c6e3f17fb867a451b570a00acc'}else{'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'})) 'B264_ERP_SOURCE'
 Require-NewDrain ($claim.candidate.erpManifest -ceq $(if($PolicyGeneration -ceq 'CurrentB007'){'6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49'}else{'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'})) 'B264_ERP_MANIFEST'
 Require-NewDrain ($claim.candidate.crmSource -ceq $(if($PolicyGeneration -ceq 'CurrentB007'){'7ba6e4ebc8b70019136d603e6307741189ba03c1'}else{'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'})) 'B264_CRM_SOURCE'
 Require-NewDrain ($claim.candidate.crmManifest -ceq $(if($PolicyGeneration -ceq 'CurrentB007'){'820cbf0f0002a7bcd6ce4d2e629d4e1c690027bb3243aa04b19a8ac0aa9edf35'}else{'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'})) 'B264_CRM_MANIFEST'
 Assert-B264RecoveryCandidateTuple
 Require-NewDrain (Same-B264Value $claim.candidate.newSettings $claim.newSettings) 'B264_CANDIDATE_SETTINGS'
 Require-NewDrain ($claim.schemaVersion -ceq $(if($PolicyGeneration -ceq 'CurrentB007'){'melisa-p03-current-b007-epoch-claim.v1'}else{'melisa-p03-b264-current-epoch-claim.v1'}) -and $claim.transitionAuthority -ceq $true -and $claim.applyExecuted -ceq $false -and $claim.predecessorRunId -ceq 'b264594b6f93d560d807c8decc4e6699' -and $claim.successorRunId -ceq $runId) 'B264_CLAIM'
 Require-NewDrain ($claim.successorProfile.path -ceq $ProfilePath -and $claim.successorProfile.sha256 -ceq $ProfileSha256 -and $claim.successorBefore.path -ceq $BeforeImagePath -and $claim.successorBefore.sha256 -ceq $BeforeImageSha256 -and (Same-B264Value $claim.newSettings $profile.newSettings)) 'B264_CLAIM_BINDING'
 Require-NewDrain ($claim.currentOwnerDigest -cmatch '\A[a-f0-9]{64}\z' -and $claim.stopOrderDigest -cmatch '\A[a-f0-9]{64}\z' -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -ge [DateTime]::Parse($before.observedAt).ToUniversalTime()) 'B264_EPOCH_DIGEST'
 $sql=@($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name -ccontains 'kind' -and $_.kind -ceq 'ProtectedSqlService'})
 Require-NewDrain ($sql.Count -eq 1 -and (Same-B264Value $claim.protectedSqlEpoch $sql[0])) 'B264_SQL_EPOCH'
 Require-NewDrain ($claim.newSettings.path -ceq $(if($PolicyGeneration -ceq 'CurrentB007'){'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-7ba6e4ebc8b7-erp-6dc33f417373-current.json'}else{'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'})) 'B264_NEW_SETTINGS'
 $pins=Get-B264HistoricalPins
 foreach($key in $pins.Keys){$ref=$claim.$key;Require-NewDrain ($ref.path -ceq $pins[$key].path -and $ref.sha256 -ceq $pins[$key].sha256) 'B264_HISTORY_BINDING';[void](ReadPinned $ref.path $ref.sha256)}
}
function Assert-NewDrainPins{
 [void](ReadPinned $ProfilePath $ProfileSha256);[void](ReadPinned $BeforeImagePath $BeforeImageSha256);$fresh=Json (ReadPinned $claimPath $ClaimSha256)
 Require-NewDrain (Same-B264Value $fresh $claim) 'CLAIM_CHANGED'
 [void](ReadPinned $profile.newSettings.path $profile.newSettings.sha256);[void](ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);[void](ReadPinned $EnginePath $engineSha)
 Assert-B264Claim;TaskPhase 'new'
 Require-NewDrain (@(Get-ChildItem -LiteralPath $profile.journalDirectory -Force).Count -eq 0) 'ENGINE_RECOVERY_NOT_EMPTY'
}
function Record-NewDrain([string]$event,$identity=$null){
 Require-NewDrain ($event -cin @('NEW_DRAIN_INTENT','NEW_CORE_CUT_INTENT','NEW_CORE_CUT_COMPLETED','NEW_COM_STOP_INTENT','NEW_COM_STOPPED','NEW_EXACT_STOP_INTENT','NEW_EXACT_STOPPED','NEW_ALREADY_ABSENT','NEW_DRAIN_EMPTY','NEW_DRAIN_FAILED')) 'EVENT'
 if($script:newSequence -gt 0){[void](ReadPinned (Join-Path $script:newOutput ('event-'+($script:newSequence-1).ToString('0000')+'.json')) $script:newPrevious)}
 $row=[ordered]@{sequence=$script:newSequence;previousSha256=$script:newPrevious;event=$event;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;claimSha256=$ClaimSha256;observedAt=[DateTime]::UtcNow.ToString('o');identity=$identity}
 $ref=Save-NewDrain (Join-Path $script:newOutput ('event-'+$script:newSequence.ToString('0000')+'.json')) $row;$script:newSequence++;$script:newPrevious=$ref.sha256;return $ref
}
function Read-B264HubReceipt($identity){
 $root=Join-Path $newSettings.runtimeDirectory 'hub-web';NoReparse $root;$found=@()
 foreach($file in @(Get-ChildItem -LiteralPath $root -File|Where-Object{$_.Name -cmatch '\Ahub-web-process-[a-f0-9]{32}-[0-3]\.json\z'})){
  $ref=Read-NewDrainReceipt 'hub' $file.FullName;$value=Json (ReadPinned $ref.path $ref.sha256)
  if($value.pid -ne $identity.pid){continue}
  Require-NewDrain ($value.run -cmatch '\A[a-f0-9]{32}\z' -and $value.attempt -ge 0 -and $value.attempt -le 3) 'HUB_POINTER_SCHEMA'
  $lineagePath=Join-Path $root ('hub-web-lineage-'+$value.run+'-'+$value.attempt+'.json')
  Require-NewDrain ($value.lineagePath -ceq $lineagePath -and $value.lineageSha256 -cmatch '\A[a-f0-9]{64}\z') 'HUB_POINTER_PATH'
  [void](ReadPinned $lineagePath $value.lineageSha256)
  $found+=,[pscustomobject]@{role='hub';path=$ref.path;sha256=$ref.sha256;lineagePath=$lineagePath;lineageSha256=$value.lineageSha256}
 }
 Require-NewDrain ($found.Count -eq 1) 'HUB_POINTER_COUNT';return $found[0]
}
function Assert-B264PartialShape($selected){
 $roles=@($selected|ForEach-Object{$_.role})
 Require-NewDrain ($selected.Count -le 10 -and @($roles|Sort-Object -Unique).Count -eq $selected.Count) 'PARTIAL_COUNT'
 if('coreSupervisor' -cin $roles){Require-NewDrain ('terminalWatcher' -cin $roles) 'PARTIAL_CORE_WATCHER'}
 if(@($roles|Where-Object{$_ -cin @('erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer')}).Count){Require-NewDrain ('coreSupervisor' -cin $roles -and 'terminalWatcher' -cin $roles) 'PARTIAL_UNCAPTURED_CORE'}
 if('hub' -cin $roles){Require-NewDrain ('hubWatcher' -cin $roles) 'PARTIAL_HUB_WATCHER'}
}
function Capture-NewDrainCandidate{
 Assert-NewDrainPins;$raw=Inventory;ProtectedProcesses $raw;Assert-NewDrainOldAbsent $raw;$selected=@();$receipts=@()
 foreach($rule in $profile.candidateRules){VerifyRule $rule;$rows=@($raw.all|Where-Object{$_.ExecutablePath -ceq $rule.nodePath -and ((Tokens $_.CommandLine)|ConvertTo-Json -Compress) -ceq ((Tokens $rule.commandLine)|ConvertTo-Json -Compress)})
  Require-NewDrain ($rows.Count -le 1) 'CURRENT_ROLE_COUNT';if($rows.Count -eq 0){continue}
  $p=$rows[0];$sid=Invoke-CimMethod $p -MethodName GetOwnerSid -ErrorAction Stop;Require-NewDrain ($sid.ReturnValue -eq 0 -and $sid.Sid -ceq $owner) 'CURRENT_OWNER'
  $identity=[pscustomobject]@{role=$rule.role;pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=[string]$p.ExecutablePath;ownerSid=$owner;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');bindings=@($raw.listeners|Where-Object{$_.OwningProcess -eq $p.ProcessId}|ForEach-Object{[pscustomobject]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress}})}
  $selected+=,$identity
  if($rule.role -ceq 'hub'){$receipts+=,(Read-B264HubReceipt $identity)}elseif($null -ne $rule.receipt){$receipts+=,(Read-NewDrainReceipt $rule.role $rule.receipt.path)}
 }
 Assert-B264PartialShape $selected
 return [pscustomobject]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=$selected;receipts=$receipts}
}
function ProbeArgumentsAllowed($argv,[string]$probe){
 $stagePorts=@{hub='5234';crmServer='62700,62701';crmOrders='62703';crmCatalog='62702';crmNativeOrder='62704';erpApi='4184';erpNative='4186'}
 foreach($role in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){
  $expected=@($profile.shell.path,'-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',$probe,'-Ports',$stagePorts[$role])
  if(($argv|ConvertTo-Json -Compress) -ceq ($expected|ConvertTo-Json -Compress)){return $true}
  # No synthetic PID or default identity is inserted for absent partial roles.
  $pins=@($script:newEvidence.processes|Where-Object{$_.role -ceq $role})
  if($pins.Count -eq 1 -and ($argv|ConvertTo-Json -Compress) -ceq (@($expected+@('-ProcessId',[string]$pins[0].pid))|ConvertTo-Json -Compress)){return $true}
 }
 return $false
}
function B264ProbeAuxiliaries($inventory){
 $cores=@($script:newEvidence.processes|Where-Object{$_.role -ceq 'coreSupervisor'})
 if($cores.Count -eq 0){return @()}
 $identities=[ordered]@{};foreach($p in $script:newEvidence.processes){$identities[$p.role]=$p}
 $before=[pscustomobject]@{identities=[pscustomobject]$identities}
 # Helper functions use PowerShell dynamic scope; only this invocation sees
 # candidate identities. Historical before/protected/old-absence remain intact.
 return @(ProbeAuxiliaries $inventory)
}
function ConsoleAuxiliaries($inventory,$selected){
 $probes=@(B264ProbeAuxiliaries $inventory)
 $allowed=@(B264FrozenConsoleAuxiliaries $inventory @($selected+$probes))
 return @($allowed)+@($probes|ForEach-Object{[int]$_.pid})
}
function HubLineage($evidence,$expected,$inventory){return NewHubLineage $evidence $expected $inventory}
function Current-NewDrainFrame{
 Assert-NewDrainPins;Complete-B264CoreCut;$frame=CandidateInventory $script:newEvidence;Assert-NewDrainOldAbsent $frame.inventory
 foreach($pidValue in $script:newGone){Require-NewDrain (@($frame.inventory.all|Where-Object{$_.ProcessId -eq $pidValue}).Count -eq 0) 'GONE_PID_REAPPEARED'}
 if($null -ne $script:newCoreHandle){Require-NewDrain ($script:newCoreHandle.Id -eq $script:newCore.pid -and $script:newCoreHandle.StartTime.ToUniversalTime().Ticks -eq [DateTime]::Parse($script:newCore.creationTime).ToUniversalTime().Ticks) 'HELD_CORE_IDENTITY'}
 return $frame
}
function Assert-B264Com($frame){
 $watchers=@($frame.selected|Where-Object{$_.role -cin @('terminalWatcher','hubWatcher')})
 Require-NewDrain ($frame.inventory.instances.Count -eq $watchers.Count) 'COM_COUNT'
 foreach($w in $watchers){$rule=@($profile.candidateRules|Where-Object{$_.role -ceq $w.role})[0];$instances=@($frame.inventory.instances|Where-Object{$_.Name -ceq $rule.taskName -and $_.Path -ceq ('\'+$rule.taskName) -and [int]$_.State -eq 4 -and $_.EnginePID -eq $w.pid -and -not[string]::IsNullOrWhiteSpace([string]$_.InstanceGuid) });Require-NewDrain ($instances.Count -eq 1) 'COM_IDENTITY'}
}
function Open-B264StopperHandle([string]$path){return [IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)}
function Invoke-B264StopperChild([string]$path,[string]$encodedProof){
 $out=& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -File $path -ExpectedJsonBase64 $encodedProof
 return [pscustomobject]@{exitCode=$LASTEXITCODE;output=[string]$out}
}
function Invoke-NewDrainStopper($identity){
 $stopperSha='79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'
 [void](ReadPinned $profile.stopper.path $stopperSha)
 # Deny write AND delete/rename from held-byte verification through child exit.
 # -File therefore cannot be redirected to replacement code after the hash.
 $held=Open-B264StopperHandle $profile.stopper.path
 try{
  Require-NewDrain ($held.Length -gt 0 -and $held.Length -le 1048576) 'HELD_STOPPER_SIZE'
  $memory=[IO.MemoryStream]::new();try{$held.CopyTo($memory);$bytes=$memory.ToArray()}finally{$memory.Dispose()}
  Require-NewDrain ((Hash $bytes) -ceq $stopperSha) 'HELD_STOPPER_HASH'
  $proof=[ordered]@{pid=$identity.pid;parentPid=$identity.parentPid;nodePath=$identity.nodePath;ownerSid=$identity.ownerSid;commandLine=$identity.commandLine;creationTime=[DateTime]::Parse($identity.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')}
  $result=Invoke-B264StopperChild $profile.stopper.path ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($proof|ConvertTo-Json -Compress))))
  Require-NewDrain ($result.exitCode -eq 0 -and $result.output -cin @('EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE')) 'STOP_RESULT'
  if($null -ne $script:newCore -and $identity.pid -eq $script:newCore.pid){$script:lastCoreStopperResult=$result.output}
 }finally{$held.Dispose()}
}
function Complete-B264CoreCut{
 if($Action -cne 'Drain' -or $null -eq $script:precutWindowOpenedAt -or $script:coreCutRecorded -or $null -eq $script:newCoreHandle -or -not $script:newCoreHandle.HasExited){return}
 $raw=Inventory;ProtectedProcesses $raw;Assert-NewDrainOldAbsent $raw
 Require-NewDrain (@($raw.all|Where-Object{$_.ProcessId -eq $script:newCore.pid}).Count -eq 0) 'CORE_PID_REUSED'
 $script:coreStopCompletedAt=[DateTime]::UtcNow
 [void](Record-NewDrain 'NEW_CORE_CUT_COMPLETED' ([ordered]@{identity=$script:newCore;mechanism=$(if($script:lastCoreStopperResult -ceq 'EXACT_OBSERVED_PROCESS_STOPPED'){'EXACT_OBSERVED_PROCESS_STOPPED'}else{'NATURAL_EXIT_OBSERVED'});stopperResult=$script:lastCoreStopperResult;windowOpenedAt=$script:precutWindowOpenedAt.ToString('o');completedAt=$script:coreStopCompletedAt.ToString('o')}))
 $script:coreCutRecorded=$true;$script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$script:lateAdmissionOpen=$true
 if($script:newCore.pid -notin $script:newGone){$script:newGone+=,[int]$script:newCore.pid}
}
function Wait-B264AuxiliaryAbsence([bool]$coreOnly=$false){
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{$frame=Current-NewDrainFrame;$pids=@($script:probePins.Keys)+@($script:consolePins.Values|Where-Object{-not $coreOnly -or $_.parentPid -eq $script:newCore.pid -or $_.parentPid -in @($script:probePins.Keys)}|ForEach-Object{[int]$_.pid})
  if(@($frame.inventory.all|Where-Object{$_.ProcessId -in $pids}).Count -eq 0){$script:lateAdmissionOpen=$false;return};Start-Sleep -Milliseconds 250
 }while([DateTime]::UtcNow -lt $until)
 Require-NewDrain $false 'PROBE_OR_CONSOLE_NOT_ABSENT'
}
function Publish-B264Empty{
 $frame=Current-NewDrainFrame;AssertEmpty $frame.inventory
 Require-NewDrain ($frame.selected.Count -eq 0 -and @($names|Where-Object{[int]$folder.GetTask($_).State -ne 3}).Count -eq 0) 'FINAL_NOT_EMPTY'
 $zero=[ordered]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=@();receipts=@()}
 $ref=Save-NewDrain (Join-Path $base ('MelisaERP-P03-candidate-'+[guid]::NewGuid().ToString('N')+'.json')) $zero;$tail=Record-NewDrain 'NEW_DRAIN_EMPTY' $ref
 return [ordered]@{status='B264_NEW_OWNER_EMPTY_CANDIDATE_READY';candidateRef=$ref;outerTail=$tail;mutationExecuted=$script:b264Mutated;oldOwnerStarted=$false;engineRecoveryExecuted=$false;businessWrites=0;requiresFrozenStopNewAndRollbackOld=$true;unprovenPartialRecoveryGranted=$false}
}
function Invoke-B264Recovery{
 Require-NewDrain ($Action -cin @('Inspect','Drain')) 'ACTION';$script:b264Mutated=$false;$script:b264OutputOpened=$false
 $script:newEvidence=Capture-NewDrainCandidate;$script:newCore=@($script:newEvidence.processes|Where-Object{$_.role -ceq 'coreSupervisor'})|Select-Object -First 1
 if($null -ne $script:newCore){$script:newCoreHandle=Hold-NewDrainCore $script:newCore;$script:coreLifetime=$script:newCoreHandle}
 try{
  $admitted=Current-NewDrainFrame;Assert-B264Com $admitted
  if($Action -ceq 'Inspect'){return [ordered]@{status='B264_NEW_OWNER_RECOVERY_INSPECTED';mutationExecuted=$false;newIdentities=$admitted.selected.Count;liveProbesAccepted=$script:probePins.Count;rawInventoryPreserved=$true;unprovenPartialRecoveryGranted=$false;engineRecoveryExecuted=$false}}
  Open-NewDrainOutput;$script:b264OutputOpened=$true
  # A durable intent plus held OS lifetime precedes either COM.Stop. COM.Stop
  # can naturally exit core; that outcome is recorded without a fabricated kill.
  if($null -ne $script:newCore){$script:precutWindowOpenedAt=[DateTime]::UtcNow;[void](Record-NewDrain 'NEW_CORE_CUT_INTENT' ([ordered]@{identity=$script:newCore;windowOpenedAt=$script:precutWindowOpenedAt.ToString('o')}))}
  foreach($pin in @($admitted.inventory.instances)){
   $now=Current-NewDrainFrame;$matches=@($now.inventory.instances|Where-Object{$_.Name -ceq $pin.Name -and $_.Path -ceq $pin.Path -and [string]$_.InstanceGuid -ceq [string]$pin.InstanceGuid -and $_.EnginePID -eq $pin.EnginePID -and [int]$_.State -eq 4})
   Require-NewDrain ($matches.Count -eq 1) 'COM_CAS';[void](Record-NewDrain 'NEW_COM_STOP_INTENT' ([ordered]@{name=[string]$pin.Name;guid=[string]$pin.InstanceGuid;pid=[int]$pin.EnginePID}))
   $script:tasksStopRequested=$true;$matches[0].Stop();$script:b264Mutated=$true
   [void](Record-NewDrain 'NEW_COM_STOPPED' ([ordered]@{name=[string]$pin.Name;guid=[string]$pin.InstanceGuid;pid=[int]$pin.EnginePID}))
  }
  $until=[DateTime]::UtcNow.AddSeconds(20)
  do{$now=Current-NewDrainFrame;if($now.inventory.instances.Count -eq 0 -and @($names|Where-Object{[int]$folder.GetTask($_).State -ne 3}).Count -eq 0){break};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow -lt $until)
  Require-NewDrain ($now.inventory.instances.Count -eq 0 -and @($names|Where-Object{[int]$folder.GetTask($_).State -ne 3}).Count -eq 0) 'COM_NOT_STOPPED'
  if($null -ne $script:newCore){
   if(-not $script:newCoreHandle.HasExited){Stop-NewDrainExact $script:newCore}
   Require-NewDrain ($script:newCoreHandle.HasExited) 'HELD_CORE_NOT_EXITED';Complete-B264CoreCut
   Require-NewDrain $script:coreCutRecorded 'CORE_CUT_NOT_RECORDED'
   Wait-B264AuxiliaryAbsence $true
  }
  foreach($role in @('crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','hub','terminalWatcher','hubWatcher')){
   $pins=@($script:newEvidence.processes|Where-Object{$_.role -ceq $role});if($pins.Count -eq 1){Stop-NewDrainExact $pins[0]}
  }
  Wait-B264AuxiliaryAbsence;return Publish-B264Empty
 }catch{
  if($script:b264OutputOpened){try{[void](Record-NewDrain 'NEW_DRAIN_FAILED' ([ordered]@{code='P03_B264_NEW_RECOVERY_REJECTED'}))}catch{}}
  throw
 }finally{if($null -ne $script:newCoreHandle){$script:newCoreHandle.Dispose()}}
}


# DISPATCH
try {
Initialize-B264Recovery
$Environment='Shared';$isRehearsal=$false;$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$runRoot=$null;$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
Require-NewDrain ($ProfilePath-cmatch ('\A'+[regex]::Escape($base)+'\\MelisaERP-P03-profile-([a-f0-9]{32})\.json\z')) 'PROFILE_PATH';$runId=$Matches[1]
if($PolicyGeneration -ceq 'CurrentB007'){Require-NewDrain ($EnginePath -ceq (Join-Path (Join-Path $base ('MelisaERP-P03-transition-'+$runId)) 'p03-physical-rollback-lifetime-v2.ps1')) 'CURRENT_B007_ENGINE_RUN'}
Require-NewDrain ($runId-cnotin@('7b0821959737f1da0427b17a7dfd4685','639e2da815e1e7ac0f1c0d04d7f7bdc3','b264594b6f93d560d807c8decc4e6699')-and$BeforeImagePath-ceq(Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json'))) 'RUN'
$profile=Json (ReadPinned $ProfilePath $ProfileSha256);$before=Json (ReadPinned $BeforeImagePath $BeforeImageSha256)
$claimPath=Join-Path $base $(if($PolicyGeneration -ceq 'CurrentB007'){'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'}else{'p03-pr54-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'});$claim=Json (ReadPinned $claimPath $ClaimSha256)
Assert-B264Claim
Require-NewDrain ($profile.schemaVersion-ceq'melisa-p03-physical-profile.v1'-and$before.schemaVersion-ceq'melisa-p03-owner-observation.v3'-and$profile.ownerSid-ceq$owner-and$before.ownerSid-ceq$owner-and$profile.database-ceq$database-and$before.database-ceq$database-and$before.actualT1-ceq$false-and$before.copyId-ceq'e16b70f0-4057-428b-9abc-6bbcaf35fe82'-and$profile.beforeImage.path-ceq$BeforeImagePath-and$profile.beforeImage.sha256-ceq$BeforeImageSha256-and$profile.oldSettings.sha256-ceq'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'-and$profile.newSettings.sha256-ceq$claim.newSettings.sha256-and$profile.newSettings.path-ceq$claim.newSettings.path) 'SCOPE'
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
if($PolicyGeneration -ceq 'CurrentB007'){Assert-CurrentB007RecoverySettings $profile $oldSettings $newSettings}else{Require-NewDrain ($newSettings.ownerSid-ceq$owner-and$newSettings.database-ceq$database-and$newSettings.copyId-ceq$before.copyId-and$newSettings.actualT1-ceq$false-and$newSettings.components.erpApiNative.sourceCommit-ceq'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'-and$newSettings.components.erpApiNative.manifestSha256-ceq'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'-and$newSettings.components.crm.sourceCommit-ceq'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'-and$newSettings.supervisor.sourceCommit-ceq$claim.candidate.supervisorSource-and$newSettings.supervisor.manifestSha256-ceq$claim.candidate.supervisorManifest-and$newSettings.supervisor.packageRoot-ceq$claim.candidate.supervisorRoot) 'NEW_SOURCE'}
Require-NewDrain ($profile.tasks.Count-eq2-and$profile.candidateRules.Count-eq10-and@($profile.candidateRules.role|Sort-Object -Unique).Count-eq10-and$profile.protectedProcesses.Count-gt0-and@($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name-ccontains'kind'-and$_.kind-ceq'ProtectedSqlService'}).Count-eq1) 'PROFILE_COUNTS'
$expectedPackages=@{};foreach($settings in @($oldSettings,$newSettings)){foreach($component in @($settings.components.PSObject.Properties|ForEach-Object{$_.Value})+@($settings.supervisor)){$root=[IO.Path]::GetFullPath($component.packageRoot);if($expectedPackages.ContainsKey($root)){Require-NewDrain ($expectedPackages[$root].sourceCommit-ceq$component.sourceCommit-and$expectedPackages[$root].manifestSha256-ceq$component.manifestSha256) 'PACKAGE_CONFLICT'}else{$expectedPackages[$root]=$component}}}
Require-NewDrain ($profile.packages.Count-eq$expectedPackages.Count-and$expectedPackages.Count-eq$(if($PolicyGeneration -ceq 'CurrentB007'){7}else{6})) 'PACKAGE_COUNT';$seen=@()
foreach($pkg in $profile.packages){$root=[IO.Path]::GetFullPath($pkg.root);Require-NewDrain ($expectedPackages.ContainsKey($root)-and$root-cnotin$seen-and$pkg.sourceCommit-ceq$expectedPackages[$root].sourceCommit-and$pkg.manifestSha256-ceq$expectedPackages[$root].manifestSha256-and$pkg.manifestPath-ceq(Join-Path $root 'release-manifest.json')) 'PACKAGE_BINDING';$seen+=,$root;NoReparse $pkg.manifestPath;$bytes=[IO.File]::ReadAllBytes($pkg.manifestPath);Require-NewDrain ((Hash $bytes)-ceq$pkg.manifestSha256) 'PACKAGE_HASH';$manifest=Json $bytes;Require-NewDrain ((PackageManifestSource $manifest $pkg)-ceq$pkg.sourceCommit-and$manifest.files.Count-gt0) 'PACKAGE_SOURCE';foreach($file in $manifest.files){$target=[IO.Path]::GetFullPath((Join-Path $root $file.path));Require-NewDrain ($target.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) 'PACKAGE_ESCAPE';NoReparse $target;Require-NewDrain ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$file.sha256) 'PACKAGE_BYTES'}}
Require-NewDrain ($profile.stopper.sha256-ceq'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'-and$profile.stopper.path-ceq(Join-Path $base ('MelisaERP-P03-stopper-'+$runId+'.ps1'))) 'STOPPER';[void](ReadPinned $profile.stopper.path $profile.stopper.sha256)
$transitionDir=Join-Path $base ('MelisaERP-P03-transition-'+$runId);Protected $transitionDir;Require-NewDrain ($profile.journalDirectory-ceq(Join-Path $base ('MelisaERP-P03-recovery-'+$runId))) 'RECOVERY_DIR';Protected $profile.journalDirectory
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
Initialize-B264Bindings
Invoke-B264Recovery|ConvertTo-Json -Depth 8 -Compress
}catch{[Console]::Error.WriteLine('P03_B264_NEW_RECOVERY_REJECTED');exit 1}
