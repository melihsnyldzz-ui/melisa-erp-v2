$ErrorActionPreference='Stop'
# Exercise the actual dispatcher function with in-memory substitutes only.
# This test creates no process, file, SQL transaction, owner or authority.
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'business-5244-maintenance-dispatch.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'BEGIN_UNKNOWN_TEST_PARSE'}
foreach($name in @('Get-Business5244DispatchErrorCode','Invoke-Business5244OwnerMaintenance')){
 $found=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true))
 if($found.Count-ne1){throw 'BEGIN_UNKNOWN_TEST_FUNCTION'}
 . ([scriptblock]::Create($found[0].Extent.Text))
}
function Assert-Business5244RetirementRequest($Channel,$Request){}
function Get-Business5244RetirementState($State){return $script:r}
function Get-Business5244MaintenancePlan($State,$ApiTransition){return @{hash=('a'*64);candidate=@{};rollback=@{}}}
function Assert-Business5244MaintenancePlan($Plan,$State,$ApiTransition){}
function Get-Business5244RetirementRequestAdmission($Channel,$Request){return @{}}
function Invoke-Business5244OwnedRetirement($State,$Channel,$Request){$script:events.Add('retire');$script:r.phase='Retired'}
function Assert-Business5244StartupLease($Lease,$Kind){}
function Test-Business5244PreRetireExpiredNoEffects($State,$Dispatch,$Channel,$Request,$Failure){return $false}
function Test-Business5244DispatchCommitted($Record,$Dispatch,$Native,$Mode){return ($script:scenario-ceq'commit-verified'-and$Mode-ceq'Candidate')}
function Test-Business5244DispatchUncertain($Record,$Failure){return $false}
function Reset-Business5244FailedCandidate($State){$script:events.Add('reset')}
function Invoke-Test125ReadPairApiTransition($Transition,$Mode){
 $script:events.Add('api-'+$Mode)
 if($Mode-ceq'Candidate'-and$script:scenario-ceq'apply-unknown'){throw 'TEST_APPLY_UNKNOWN'}
 if($Mode-ceq'Candidate'-and$script:scenario-ceq'apply-token-drift'){$Transition.profileOnlyPurpose='Changed';throw 'TEST_TOKEN_DRIFT'}
 if($Mode-ceq'Rollback'){throw 'TEST_UNSAFE_ROLLBACK'}
}
function Assert-Test125ReadPairTransition($Transition,$Mode){}
function New-Business5244PinnedChild($Pins,$Lease){$script:events.Add('new-child');if($script:scenario-ceq'after-apply'){throw 'TEST_CHILD_START_UNKNOWN'};return [pscustomobject]@{fixture='candidate'}}
function Publish-Business5244RetiredRecord($State,$ReplacementNative,$Mode,$Pins){$script:events.Add('publish');if($script:scenario-ceq'publish-unknown'){throw 'TEST_PUBLISH_UNKNOWN'}}
function Complete-Business5244OwnedMaintenance($State,$ReplacementNative,$Pins,$Mode,$PlanHash){$script:events.Add('commit');throw 'TEST_COMMIT_UNKNOWN'}
function Complete-Business5244DispatchResult($Record,$Dispatch,$Native,$Mode){$script:events.Add('verified-readback');$Dispatch.phase='Completed';$Dispatch.result=$Mode}
function Get-Business5244DispatchResult($Record,$Dispatch,$Replayed){return [pscustomobject]@{result='VERIFIED_FIXTURE';replayed=$Replayed}}
function Save-Business5244RollbackFailureWitness($State){}
$state=[pscustomobject]@{};$channel=[pscustomobject]@{};$request=[pscustomobject]@{operation='retire';requestId='fixture'}
$transition=$null
foreach($scenario in @('apply-unknown','apply-token-drift','after-apply','publish-unknown','commit-unknown')){
 $transition=[pscustomobject]@{profileOnlyPurpose='BeginSuccessor'}
 $script:scenario=$scenario;$script:events=[Collections.Generic.List[string]]::new()
 $script:r=@{phase='Running';native=[pscustomobject]@{RetirementConfirmed=$true};lease=[pscustomobject]@{};ownerBirth='1';childPid=2;childBirth='3'}
 $failed=$false;try{Invoke-Business5244OwnerMaintenance $state $channel $request $transition|Out-Null}catch{if($_.Exception.Message-cne'BUSINESS_5244_BEGIN_OUTCOME_UNKNOWN'){throw};$failed=$true}
 $expected=switch($scenario){'apply-unknown'{'retire|api-Candidate'}'apply-token-drift'{'retire|api-Candidate'}'after-apply'{'retire|api-Candidate|new-child'}'publish-unknown'{'retire|api-Candidate|new-child|publish'}'commit-unknown'{'retire|api-Candidate|new-child|publish|commit'}}
 if(!$failed-or($script:events-join'|')-cne$expected-or$script:r.phase-cne'Unknown'-or$script:r.dispatch.phase-cne'Blocked'-or$script:events.Contains('reset')-or$script:events.Contains('api-Rollback')){throw 'BEGIN_UNKNOWN_TEST_UNSAFE_RECOVERY'}
 $before=$script:events.Count;$failed=$false
 try{Invoke-Business5244OwnerMaintenance $state $channel $request $transition|Out-Null}catch{$failed=$true}
 if(!$failed-or$script:events.Count-ne$before){throw 'BEGIN_UNKNOWN_TEST_REPLAY'}
}
# If an independent same-child/plan readback proves commit, preserve the
# existing reconciliation rather than misclassifying it as UNKNOWN.
$script:scenario='commit-verified';$script:events=[Collections.Generic.List[string]]::new()
$script:r=@{phase='Running';native=[pscustomobject]@{RetirementConfirmed=$true};lease=[pscustomobject]@{};ownerBirth='1';childPid=2;childBirth='3'}
$transition=[pscustomobject]@{profileOnlyPurpose='BeginSuccessor'}
$observed=Invoke-Business5244OwnerMaintenance $state $channel $request $transition
if($observed.result-cne'VERIFIED_FIXTURE'-or!$observed.replayed-or($script:events-join'|')-cne'retire|api-Candidate|new-child|publish|commit|verified-readback'-or$script:events.Contains('reset')){throw 'BEGIN_UNKNOWN_TEST_VERIFIED_READBACK_CHANGED'}
# This guard is scoped to BEGIN; existing non-BEGIN behavior is not changed.
$script:scenario='apply-unknown';$script:events=[Collections.Generic.List[string]]::new()
$script:r=@{phase='Running';native=[pscustomobject]@{RetirementConfirmed=$true};lease=[pscustomobject]@{};ownerBirth='1';childPid=2;childBirth='3'}
$other=[pscustomobject]@{profileOnlyPurpose='PackageRefresh'};$failed=$false
try{Invoke-Business5244OwnerMaintenance $state $channel $request $other|Out-Null}catch{if($_.Exception.Message-cne'BUSINESS_5244_MAINTENANCE_ROLLBACK_UNCONFIRMED'){throw};$failed=$true}
if(!$failed-or!$script:events.Contains('reset')-or!$script:events.Contains('api-Rollback')){throw 'BEGIN_UNKNOWN_TEST_SCOPE_CHANGED'}
'PASS: BEGIN failure and lost result block automatic rollback and replay in the real dispatcher'
