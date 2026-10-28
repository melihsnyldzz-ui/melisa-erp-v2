param([Alias('Library')][switch]$MaintenanceDispatchLibrary)
# Fixed-plan orchestration inside the existing owner process/thread. No new
# executable, package, PID, body callback, runtime path or first-adoption input.
function Get-Business5244DispatchErrorCode($Failure){
 $message=[string]$Failure.Exception.Message
 if($message -cmatch '^[A-Z][A-Z0-9_]{1,100}$'){return $message}
 return 'BUSINESS_5244_MAINTENANCE_UNCLASSIFIED_FAILURE'
}
function Test-Business5244DispatchCommitted($Record,$Dispatch,$Native,[string]$Mode){
 if(!$Native -or $Record.phase -cne 'Running' -or !$Record.ContainsKey('commit') -or !$Record.commit -or $Record.commit.phase -cne 'Archived' -or $Record.records -or $Record.pending){return $false}
 $commit=$Record.commit
 if($commit.planHash -cne $Dispatch.planHash -or $commit.mode -cne $Mode -or ![object]::ReferenceEquals($Record.native,$Native) -or $Record.childPid -ne $Native.ChildPid -or $Record.childBirth -cne $Native.ChildBirth -or $commit.childPid -ne $Native.ChildPid -or $commit.childBirth -cne $Native.ChildBirth){return $false}
 $pins=if($Mode -ceq 'Candidate'){$Dispatch.plan.candidate}else{$Dispatch.plan.rollback}
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Record.pins[$key] -cne $pins[$key]){return $false}}
 try{Assert-Business5244StartupLease -Lease $Record.lease -Kind Owner;Assert-Business5244CreatedChild $Native $pins;return $true}catch{return $false}
}
function Get-Business5244DispatchResult($Record,$Dispatch,[bool]$Replayed){
 return [pscustomobject]@{phase='Completed';mode=$Dispatch.result;planHash=$Dispatch.planHash;ownerPid=$PID;childPid=$Record.childPid;childBirth=$Record.childBirth;replayed=$Replayed}
}
function Complete-Business5244DispatchResult($Record,$Dispatch,$Native,[ValidateSet('Candidate','Rollback')][string]$Mode){
 if(!(Test-Business5244DispatchCommitted $Record $Dispatch $Native $Mode)){throw 'BUSINESS_5244_COMMIT_NOT_CONFIRMED'}
 if($Dispatch.ContainsKey('apiTransition') -and $null -ne $Dispatch.apiTransition){[void](Assert-Test125ReadPairTransition -Transition $Dispatch.apiTransition -Mode $(if($Mode -ceq 'Candidate'){'Candidate'}else{'Current'}))}
 if($Record.ContainsKey('preparedPair') -and $Record.preparedPair){$Record.preparedPair.seal.Dispose()}
 $Dispatch.result=$Mode;$Dispatch.phase='Completed';$Dispatch.stage='Completed'
}
function Test-Business5244DispatchUncertain($Record,$Failure){
 if($Record.phase -ceq 'Unknown'){return $true}
 if($Record.ContainsKey('commit') -and $Record.commit -and $Record.commit.phase -cin @('Archived','Unknown')){return $true}
 return (Get-Business5244DispatchErrorCode $Failure) -cin @('OWNED_WEB_CLEANUP_UNCONFIRMED','OWNED_WEB_CHILD_EXIT_UNCONFIRMED','OWNED_WEB_JOB_CLOSE_UNCONFIRMED','OWNED_WEB_HANDLE_CLOSE_UNCONFIRMED')
}
function Test-Business5244PreRetireExpiredNoEffects($State,$Dispatch,$Channel,$Request,$Failure){
 # Classification only, not a recovery/reset or a new admission. Every unknown
 # or post-write condition keeps the existing Unknown/blocked outcome.
 try{
  if((Get-Business5244DispatchErrorCode $Failure)-cne'RETIREMENT_ADMISSION_EXPIRED'-or$Dispatch.stage-cne'Retiring'-or$Dispatch.phase-cne'InProgress'-or$null-eq$Dispatch.apiTransition){return $false}
  $r=Get-Business5244RetirementState $State
  if(!$r.ContainsKey('dispatch')-or![object]::ReferenceEquals($r.dispatch,$Dispatch)-or![object]::ReferenceEquals($r,$Dispatch.retiringRecord)-or![object]::ReferenceEquals($Request,$Dispatch.retiringRequest)-or![object]::ReferenceEquals($Channel,$Dispatch.retiringChannel)-or$r.phase-cne'Running'){return $false}
  foreach($key in @('records','pending','pendingHash','before','expected','recordExpected','publication','commit','operationId','lastCompletion')){if(!$r.ContainsKey($key)-or$null-ne$r[$key]){return $false}}
  if($null-ne$Dispatch.candidateNative-or$null-ne$Dispatch.rollbackNative){return $false}
  if(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath) -ErrorAction Stop){return $false}
  if(!($r.native-is[Business5244WebNative])-or![object]::ReferenceEquals($r.native,$Dispatch.retiringNative)-or$r.native.RetirementConfirmed-or$r.ownerBirth-cne$Dispatch.retiringOwnerBirth-or$r.childPid-ne$Dispatch.retiringChildPid-or$r.childBirth-cne$Dispatch.retiringChildBirth-or$r.native.OwnerBirth-cne$r.ownerBirth-or$r.native.ChildPid-ne$r.childPid-or$r.native.ChildBirth-cne$r.childBirth){return $false}
  $r.native.Validate();if(!$r.native.ChildAlive()){return $false}
  foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($r.pins[$key]-cne$Dispatch.plan.rollback[$key]){return $false}}
  $admission=Get-Business5244RetirementRequestAdmission -Channel $Channel -Request $Request
  if($admission.expired-isnot[bool]-or!$admission.expired-or$admission.nativePeerVerified-isnot[bool]-or!$admission.nativePeerVerified-or$admission.stopAuthorized-isnot[bool]-or$admission.stopAuthorized-or$admission.operation-cne'retire'-or$admission.requestId-cne$Request.requestId-or$admission.bodyHash-cnotmatch'^[a-f0-9]{64}$'-or$admission.bodyHash-cne$Dispatch.retiringAdmission.bodyHash-or$admission.requestId-cne$Dispatch.retiringAdmission.requestId){return $false}
  if($r.requestProof-and(![object]::ReferenceEquals($r.requestProof.channel,$Channel)-or![object]::ReferenceEquals($r.requestProof.request,$Request))){return $false}
  $api=Assert-Test125ReadPairIssued $Dispatch.apiTransition
  if($api.mode-cne'Current'-or$api.phase-cnotin@('PREPARED','VERIFIED')-or$null-ne$api.activeBinding){return $false}
  foreach($key in @('changed','apiChanged','taskStopped','candidateAttempted')){if($api.$key-isnot[bool]-or$api.$key){return $false}}
  [void](Assert-Test125ReadPairRequestAdmission -Transition $Dispatch.apiTransition)
  return $true
 }catch{return $false}
}
function Invoke-Business5244OwnerMaintenance {
 param([Parameter(Mandatory)]$State,[Parameter(Mandatory)]$Channel,[Parameter(Mandatory)]$Request,$ApiTransition=$null)
 Assert-Business5244RetirementRequest -Channel $Channel -Request $Request
 if($Request.operation -isnot [string] -or $Request.operation -cne 'retire'){throw 'BUSINESS_5244_DISPATCH_REQUEST_NOT_RETIRE'}
 $r=Get-Business5244RetirementState $State
 if(!$r.ContainsKey('dispatch')){$r.dispatch=$null}
 if(!$r.dispatch){
  if($r.phase -cnotin @('Running','Retired')){throw 'BUSINESS_5244_DISPATCH_NOT_ADMITTED'}
  $plan=if($null -eq $ApiTransition){Get-Business5244MaintenancePlan -State $State}else{Get-Business5244MaintenancePlan -State $State -ApiTransition $ApiTransition}
  if(!$plan -or $plan.hash -isnot [string] -or $plan.hash -cnotmatch '^[a-f0-9]{64}$' -or $plan.candidate -isnot [Collections.IDictionary] -or $plan.rollback -isnot [Collections.IDictionary]){throw 'BUSINESS_5244_FIXED_PLAN_INVALID'}
  $r.dispatch=@{plan=@{hash=$plan.hash;candidate=$plan.candidate.Clone();rollback=$plan.rollback.Clone()};planHash=$plan.hash;phase='New';stage='New';busy=$false;candidateNative=$null;rollbackNative=$null;result=$null;failureCode=$null;apiTransition=$ApiTransition}
 }
 $d=$r.dispatch
 if(![object]::ReferenceEquals($d.apiTransition,$ApiTransition)){throw 'BUSINESS_5244_API_TRANSITION_CHANGED'}
 if($d.busy){throw 'BUSINESS_5244_DISPATCH_BUSY'}
 if($d.phase -ceq 'Completed'){
  $native=if($d.result -ceq 'Candidate'){$d.candidateNative}else{$d.rollbackNative}
  if(!(Test-Business5244DispatchCommitted $r $d $native $d.result)){throw 'BUSINESS_5244_COMPLETED_DISPATCH_CHANGED'}
  if($null -ne $ApiTransition){[void](Assert-Test125ReadPairTransition -Transition $ApiTransition -Mode $(if($d.result -ceq 'Candidate'){'Candidate'}else{'Current'}))}
  return Get-Business5244DispatchResult $r $d $true
 }
 if($d.phase -ceq 'PreflightFailed'){throw 'BUSINESS_5244_DISPATCH_PREFLIGHT_FAILED'}
 if($d.phase -cne 'New'){throw 'BUSINESS_5244_MAINTENANCE_RECOVERY_REQUIRED'}
 $d.busy=$true
 try{
  $d.phase='InProgress';$d.stage='Preflight'
  if($null -eq $ApiTransition){Assert-Business5244MaintenancePlan -Plan $d.plan -State $State}
  else{
   Assert-Business5244MaintenancePlan -Plan $d.plan -State $State -ApiTransition $ApiTransition
   # Current bootstrap publication belongs to pre-request preparation.
  }
  # The final peer/deadline check is still preflight: a lost peer here has
  # caused no transition operation and cannot be mistaken for a partial cut.
  Assert-Business5244RetirementRequest -Channel $Channel -Request $Request
  $d.stage='Retiring'
  if($null-ne$ApiTransition){$d.retiringRecord=$r;$d.retiringRequest=$Request;$d.retiringChannel=$Channel;$d.retiringNative=$r.native;$d.retiringOwnerBirth=$r.ownerBirth;$d.retiringChildPid=$r.childPid;$d.retiringChildBirth=$r.childBirth;$d.retiringAdmission=Get-Business5244RetirementRequestAdmission -Channel $Channel -Request $Request}
  Invoke-Business5244OwnedRetirement $State $Channel $Request
  $r=Get-Business5244RetirementState $State
  Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
  if($r.phase -cne 'Retired' -or !$r.native.RetirementConfirmed){throw 'BUSINESS_5244_DISPATCH_RETIREMENT_UNCONFIRMED'}
  if($null -ne $ApiTransition){$d.stage='ApiCandidate';Invoke-Test125ReadPairApiTransition -Transition $ApiTransition -Mode Candidate|Out-Null;[void](Assert-Test125ReadPairTransition -Transition $ApiTransition -Mode Candidate)}
  $d.stage='CandidateStarting'
  $d.candidateNative=New-Business5244PinnedChild -Pins $d.plan.candidate -Lease $r.lease
  $d.stage='CandidatePublishing'
  Publish-Business5244RetiredRecord -State $State -ReplacementNative $d.candidateNative -Mode Candidate -Pins $d.plan.candidate
  $d.stage='CandidateCommitting'
  Complete-Business5244OwnedMaintenance -State $State -ReplacementNative $d.candidateNative -Pins $d.plan.candidate -Mode Candidate -PlanHash $d.planHash
  $r=Get-Business5244RetirementState $State
  Complete-Business5244DispatchResult $r $d $d.candidateNative Candidate
  return Get-Business5244DispatchResult $r $d $false
 }catch{
  $failure=$_;$d.failureCode=Get-Business5244DispatchErrorCode $failure;$r=Get-Business5244RetirementState $State
  if($d.stage -ceq 'Preflight'){
   if($r.phase -ceq 'Running'){$d.phase='PreflightFailed'}else{$d.phase='Blocked'}
   throw $failure
  }
  if(Test-Business5244PreRetireExpiredNoEffects $State $d $Channel $Request $failure){
   $d.failureCode='BUSINESS_5244_PRERETIRE_EXPIRED_NO_TRANSITION_EFFECTS';$d.phase='PreflightFailed';$d.stage='PreRetireExpiredNoTransitionEffects'
   throw 'BUSINESS_5244_PRERETIRE_EXPIRED_NO_TRANSITION_EFFECTS'
  }
  # Complete may have lost its return after a verified archive/resume. Only the
  # same bound child/plan/result can reconcile it; no write or stop is replayed.
  if($d.stage -ceq 'CandidateCommitting' -and (Test-Business5244DispatchCommitted $r $d $d.candidateNative Candidate)){
   Complete-Business5244DispatchResult $r $d $d.candidateNative Candidate
   return Get-Business5244DispatchResult $r $d $true
  }
  if((Test-Business5244DispatchUncertain $r $failure) -or $r.phase -cnotin @('Retired','Published','Committing')){$r.phase='Unknown';$d.phase='Blocked';throw 'BUSINESS_5244_MAINTENANCE_RECOVERY_REQUIRED'}
  try{
   $d.stage='RollbackPreparing'
   Reset-Business5244FailedCandidate -State $State
   $r=Get-Business5244RetirementState $State
   Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
   if($r.phase -cne 'Retired'){throw 'BUSINESS_5244_ROLLBACK_NOT_RETIRED'}
   if($null -ne $ApiTransition){$d.stage='ApiRollback';Invoke-Test125ReadPairApiTransition -Transition $ApiTransition -Mode Rollback|Out-Null;[void](Assert-Test125ReadPairTransition -Transition $ApiTransition -Mode Current)}
   $d.stage='RollbackStarting'
   $d.rollbackNative=New-Business5244PinnedChild -Pins $d.plan.rollback -Lease $r.lease
   $d.stage='RollbackPublishing'
   Publish-Business5244RetiredRecord -State $State -ReplacementNative $d.rollbackNative -Mode Rollback -Pins $d.plan.rollback
   $d.stage='RollbackCommitting'
   Complete-Business5244OwnedMaintenance -State $State -ReplacementNative $d.rollbackNative -Pins $d.plan.rollback -Mode Rollback -PlanHash $d.planHash
   $r=Get-Business5244RetirementState $State
   Complete-Business5244DispatchResult $r $d $d.rollbackNative Rollback
   return Get-Business5244DispatchResult $r $d $false
  }catch{
   $rollbackFailure=$_;$r=Get-Business5244RetirementState $State
   if($d.stage -ceq 'RollbackCommitting' -and (Test-Business5244DispatchCommitted $r $d $d.rollbackNative Rollback)){
    Complete-Business5244DispatchResult $r $d $d.rollbackNative Rollback
    return Get-Business5244DispatchResult $r $d $true
   }
   $d.failureCode=Get-Business5244DispatchErrorCode $rollbackFailure;$r.phase='Unknown';$d.phase='Blocked'
   throw 'BUSINESS_5244_MAINTENANCE_ROLLBACK_UNCONFIRMED'
  }
 }finally{$d.busy=$false}
}
function Invoke-Business5244PairedOwnerMaintenance {
 param([Parameter(Mandatory)]$State,[Parameter(Mandatory)]$Channel,[Parameter(Mandatory)]$Request,[Parameter(Mandatory)]$ApiTransition)
 # No serialized RunId, boolean approval or injected scriptblock can stand in
 # for the API library's process/thread-bound transition reference.
 if($null -eq $ApiTransition){throw 'BUSINESS_5244_API_TRANSITION_REQUIRED'}
 Invoke-Business5244OwnerMaintenance -State $State -Channel $Channel -Request $Request -ApiTransition $ApiTransition
}
if(!$MaintenanceDispatchLibrary){throw 'BUSINESS_5244_MAINTENANCE_DISPATCH_LIBRARY_ONLY'}
