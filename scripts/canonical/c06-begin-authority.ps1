param([Alias('Library')][switch]$C06BeginAuthorityLibrary)
# Same-owner candidate only. This is not SQL, stop, install, native-target,
# durable-journal, or execution authority. Dot-source in the current owner
# script scope so the existing owner registry remains the source of identity.
if(!(Get-Variable C06BeginOwnerCandidates -Scope Script -ErrorAction SilentlyContinue)){$script:C06BeginOwnerCandidates=[Collections.Generic.List[object]]::new()}

function ConvertTo-C06BeginCandidateOperation($Operation){
 if($null-eq$Operation-or$Operation-is[Collections.IDictionary]-or$Operation-isnot[pscustomobject]){throw 'C06_OWNER_CANDIDATE_OPERATION_INVALID'}
 $keys=@('operationId','bodySha256','sourceSha256','targetSha256','sqlBeforeSha256','sqlAfterSha256','profileBeforeSha256','profileAfterSha256','server','database','actorId','roleId','purpose')
 if((@($Operation.PSObject.Properties.Name|Sort-Object)-join'|')-cne(@($keys|Sort-Object)-join'|')){throw 'C06_OWNER_CANDIDATE_OPERATION_INVALID'}
 if(@($Operation.PSObject.Properties|Where-Object{$_.MemberType-ne[Management.Automation.PSMemberTypes]::NoteProperty}).Count){throw 'C06_OWNER_CANDIDATE_OPERATION_INVALID'}
 foreach($key in @('operationId','bodySha256','sourceSha256','targetSha256','sqlBeforeSha256','sqlAfterSha256','profileBeforeSha256','profileAfterSha256','server','database','purpose')){if($Operation.$key-isnot[string]){throw 'C06_OWNER_CANDIDATE_OPERATION_INVALID'}}
 if($Operation.operationId-cnotmatch'\A[a-f0-9]{32}\z'){throw 'C06_OWNER_CANDIDATE_OPERATION_INVALID'}
 foreach($key in @('bodySha256','sourceSha256','targetSha256','sqlBeforeSha256','sqlAfterSha256','profileBeforeSha256','profileAfterSha256')){if($Operation.$key-cnotmatch'\A[a-f0-9]{64}\z'){throw 'C06_OWNER_CANDIDATE_OPERATION_INVALID'}}
 # Actor and role are only structurally checked caller claims here. Their
 # identities and all supplied hashes require a separate real native issuer.
 if($Operation.sqlBeforeSha256-ceq$Operation.sqlAfterSha256-or$Operation.profileBeforeSha256-ceq$Operation.profileAfterSha256-or$Operation.purpose-cne'BeginSuccessor'-or$Operation.server-cne'Semih\MELISADEV'-or$Operation.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or($Operation.actorId-isnot[int]-and$Operation.actorId-isnot[long])-or$Operation.actorId-le0-or($Operation.roleId-isnot[int]-and$Operation.roleId-isnot[long])-or$Operation.roleId-le0){throw 'C06_OWNER_CANDIDATE_OPERATION_INVALID'}
 $value=[ordered]@{};foreach($key in $keys){$value[$key]=$Operation.$key};return [pscustomobject]$value
}

function Get-C06BeginOwnerRecord($Binding,$Observation){
 # The existing getter performs the real same-thread/SID, child lifetime,
 # listener, lease, binding and retained seal checks. Never accept a PID,
 # callback or serialized status response as a substitute for that getter.
 $bindingRecord=Get-ErpCurrentPairBinding $Binding
 $view=Get-ErpCurrentPairOwnedObservation $Observation
 if($view.status-cne'OWNED_PAIR_OBSERVATION_ONLY'-or$view.sqlAuthority-ne$false-or$view.stopAuthority-ne$false-or$view.installationAuthority-ne$false){throw 'C06_OWNER_CANDIDATE_OBSERVATION_INVALID'}
 $rows=@($script:ErpCurrentPairObservations|Where-Object{[object]::ReferenceEquals($_.token,$Observation)})
 if($rows.Count-ne1){throw 'C06_OWNER_CANDIDATE_OBSERVATION_INVALID'};$owner=$rows[0]
 if(![object]::ReferenceEquals($owner.binding,$Binding)-or![object]::ReferenceEquals($bindingRecord.ownedObservationToken,$Observation)-or$owner.pid-ne$PID-or$owner.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$owner.closed-or$null-eq$owner.lease-or$null-eq$owner.apiChild-or$null-eq$owner.webChild-or$null-eq$owner.seal){throw 'C06_OWNER_CANDIDATE_OBSERVATION_INVALID'}
 return $owner
}

function New-C06BeginOwnerCandidate($Binding,$Observation,$Operation){
 $operationCopy=ConvertTo-C06BeginCandidateOperation $Operation
 $owner=Get-C06BeginOwnerRecord $Binding $Observation
 if(@($script:C06BeginOwnerCandidates|Where-Object{$_.operation.operationId-ceq$operationCopy.operationId}).Count){throw 'C06_OWNER_CANDIDATE_OPERATION_REUSED'}
 $token=[pscustomobject][ordered]@{schema='melisa-c06-owner-candidate.v1';id=[guid]::NewGuid().ToString('N')}
 $record=@{token=$token;tokenJson=($token|ConvertTo-Json -Compress);binding=$Binding;observation=$Observation;owner=$owner;lease=$owner.lease;apiChild=$owner.apiChild;webChild=$owner.webChild;seal=$owner.seal;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;operation=$operationCopy;operationJson=($operationCopy|ConvertTo-Json -Compress);phase='Available'}
 [void]$script:C06BeginOwnerCandidates.Add($record);return $token
}

function Assert-C06BeginOwnerCandidate($Candidate){
 $rows=@($script:C06BeginOwnerCandidates|Where-Object{[object]::ReferenceEquals($_.token,$Candidate)})
 if($rows.Count-ne1){throw 'C06_OWNER_CANDIDATE_UNISSUED'};$r=$rows[0]
 if($r.phase-cne'Available'-or$r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or($Candidate|ConvertTo-Json -Compress)-cne$r.tokenJson-or($r.operation|ConvertTo-Json -Compress)-cne$r.operationJson){throw 'C06_OWNER_CANDIDATE_CHANGED'}
 $owner=Get-C06BeginOwnerRecord $r.binding $r.observation
 foreach($key in @('lease','apiChild','webChild','seal')){if(![object]::ReferenceEquals($owner.$key,$r.$key)){throw 'C06_OWNER_CANDIDATE_OWNER_CHANGED'}}
 if(![object]::ReferenceEquals($owner,$r.owner)){throw 'C06_OWNER_CANDIDATE_OWNER_CHANGED'}
 return [pscustomobject][ordered]@{status='OWNER_CANDIDATE_AVAILABLE';operationId=$r.operation.operationId;operation=($r.operationJson|ConvertFrom-Json);nativeTargetVerified=$false;durableJournalVerified=$false;sqlAuthority=$false;stopAuthority=$false;executionAuthority=$false}
}

function Use-C06BeginOwnerCandidate($Candidate){
 $view=Assert-C06BeginOwnerCandidate $Candidate
 $r=@($script:C06BeginOwnerCandidates|Where-Object{[object]::ReferenceEquals($_.token,$Candidate)})[0]
 $r.phase='Consumed'
 return [pscustomobject][ordered]@{status='OWNER_CANDIDATE_CONSUMED';operationId=$view.operationId;nativeTargetVerified=$false;durableJournalVerified=$false;sqlAuthority=$false;stopAuthority=$false;executionAuthority=$false}
}

# This same-process binding is a proof of retained owner/pause identity only.
# It neither stops a process nor grants SQL, native or journal authority.
if(!(Get-Variable C06BeginPauseBindings -Scope Script -ErrorAction SilentlyContinue)){$script:C06BeginPauseBindings=[Collections.Generic.List[object]]::new()}

function Get-C06BeginPauseBindingRecord($Binding){
 $rows=@($script:C06BeginPauseBindings|Where-Object{[object]::ReferenceEquals($_.token,$Binding)})
 if($rows.Count-ne1){throw 'C06_BEGIN_PAUSE_BINDING_UNISSUED'};$r=$rows[0]
 if($r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or($Binding|ConvertTo-Json -Compress)-cne$r.tokenJson-or($r.candidateRecord.operation|ConvertTo-Json -Compress)-cne$r.operationJson){throw 'C06_BEGIN_PAUSE_BINDING_CHANGED'}
 return $r
}

function Assert-C06BeginApiHandleOwner($Record,$Context){
 # Both are same-owner retained objects, captured before pause. No PID reopen
 # or adoption occurs; any unavailable handle or failed comparison rejects.
 if(!$Record-or!$Context-or!$Context.activeBinding-or!$Context.activeBinding.handle-or!$Record.apiChild-or!$Record.apiSafeHandle-or$Record.apiSafeHandle.IsClosed-or$Record.apiSafeHandle.IsInvalid-or![object]::ReferenceEquals($Record.apiChild.SafeHandle,$Record.apiSafeHandle)){throw 'C06_BEGIN_API_HANDLE_OWNER_PROOF_UNAVAILABLE'}
 Initialize-Test125ApiKernel
 [Test125ApiKernel]::AssertSameExitedObject($Context.activeBinding.handle,$Record.apiSafeHandle,[int]$Record.apiPid,[long]$Record.apiBirthTicks)
}

function Bind-C06BeginOwnerPause($Candidate,$OwnerState,$Transition,$Channel,$Request){
 # All capabilities are independently issued by their existing owners.
 # Status observations, caller booleans and serialized copies are not inputs.
 $view=Assert-C06BeginOwnerCandidate $Candidate
 $candidate=@($script:C06BeginOwnerCandidates|Where-Object{[object]::ReferenceEquals($_.token,$Candidate)})[0]
 $owner=Get-C06BeginOwnerRecord $candidate.binding $candidate.observation
 $ret=Get-Business5244RetirementState $OwnerState
 $c=Assert-Test125ReadPairIssued $Transition
 [void](Assert-Test125ReadPairRequestAdmission $Transition)
 Assert-Business5244RetirementRequest -Channel $Channel -Request $Request
 if($Request.operation-cne'retire'-or$ret.phase-cne'Running'-or$ret.operationId-or$ret.pending-or$ret.records-or![object]::ReferenceEquals($ret.lease,$owner.lease)-or![object]::ReferenceEquals($ret.native,$owner.webChild)-or$ret.childPid-ne$owner.facts.webPid-or$ret.childBirth-cne$owner.facts.webBirth-or$ret.ownerBirth-isnot[string]-or$ret.ownerBirth-cnotmatch'\A[1-9][0-9]{0,18}\z'-or$ret.ownerBirth-cne$owner.facts.ownerBirth){throw 'C06_BEGIN_PAUSE_OWNER_CHANGED'}
 if($Transition.scope-cne'TEST125-API-B6-BEGIN-SUCCESSOR'-or$Transition.profileOnlyPurpose-cne'BeginSuccessor'-or$c.phase-cne'PREPARED'-or![object]::ReferenceEquals($c.token,$Transition)-or$Transition.apiProfileBeforeSha256-cne$view.operation.profileBeforeSha256-or$Transition.apiProfileCandidateSha256-cne$view.operation.profileAfterSha256){throw 'C06_BEGIN_PAUSE_TRANSITION_CHANGED'}
 if($c.admission.children.api.pid-ne$owner.facts.apiPid-or([datetime]$c.admission.children.api.birth).ToUniversalTime().Ticks-ne([datetime]$owner.facts.apiBirth).ToUniversalTime().Ticks){throw 'C06_BEGIN_PAUSE_API_CHANGED'}
 # The existing owner validator requires a real Process. The non-Process
 # branch keeps isolated in-memory fixtures non-authoritative and fails when
 # the actual handle proof is requested.
 $apiSafeHandle=if($owner.apiChild-is[Diagnostics.Process]){$owner.apiChild.SafeHandle}else{$null}
 $token=[pscustomobject][ordered]@{schema='melisa-c06-owner-pause-binding.v1';id=[guid]::NewGuid().ToString('N')}
 $record=@{token=$token;tokenJson=($token|ConvertTo-Json -Compress);pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;candidate=$Candidate;candidateRecord=$candidate;operationJson=$candidate.operationJson;owner=$owner;ownerSid=$owner.sid;observationJson=$owner.tokenJson;ownerFactsJson=$owner.factsJson;binding=$candidate.binding;observation=$candidate.observation;lease=$owner.lease;apiChild=$owner.apiChild;apiSafeHandle=$apiSafeHandle;webChild=$owner.webChild;seal=$owner.seal;apiPid=$owner.facts.apiPid;apiBirthTicks=([datetime]$owner.facts.apiBirth).ToUniversalTime().Ticks;ownerBirth=$owner.facts.ownerBirth;webPid=$owner.facts.webPid;webBirth=$owner.facts.webBirth;ownerState=$OwnerState;retirement=$ret;transition=$Transition;transitionContext=$c;channel=$Channel;request=$Request;phase='Bound';admission=$null}
 $candidate.phase='PauseBound';[void]$script:C06BeginPauseBindings.Add($record);return $token
}

function Assert-C06BeginPausePhysicalState($r){
 $binding=Get-ErpCurrentPairBinding $r.binding
 $owners=@($script:ErpCurrentPairObservations|Where-Object{[object]::ReferenceEquals($_.token,$r.observation)})
 if($owners.Count-ne1-or![object]::ReferenceEquals($owners[0],$r.owner)-or![object]::ReferenceEquals($r.owner.binding,$r.binding)-or![object]::ReferenceEquals($binding.ownedObservationToken,$r.observation)-or$r.owner.closed-isnot[bool]-or$r.owner.closed-or$r.owner.pid-ne$PID-or$r.owner.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$r.owner.sid-cne$r.ownerSid-or$r.ownerSid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or($r.observation|ConvertTo-Json -Compress)-cne$r.observationJson-or$r.owner.tokenJson-cne$r.observationJson-or($r.owner.facts|ConvertTo-Json -Compress)-cne$r.ownerFactsJson-or$r.owner.factsJson-cne$r.ownerFactsJson){throw 'C06_BEGIN_PAUSE_OWNER_CHANGED'}
 $ret=Get-Business5244RetirementState $r.ownerState;$c=Assert-Test125ReadPairIssued $r.transition
 if(![object]::ReferenceEquals($ret,$r.retirement)-or![object]::ReferenceEquals($c,$r.transitionContext)-or![object]::ReferenceEquals($c.token,$r.transition)-or![object]::ReferenceEquals($ret.lease,$r.lease)-or![object]::ReferenceEquals($ret.native,$r.webChild)-or$ret.ownerBirth-cne$r.ownerBirth-or$ret.childPid-ne$r.webPid-or$ret.childBirth-cne$r.webBirth-or$ret.phase-cne'Retired'-or$ret.native.RetirementConfirmed-isnot[bool]-or!$ret.native.RetirementConfirmed){throw 'C06_BEGIN_PAUSE_OWNER_CHANGED'}
 if($null-eq$ret.requestProof-or![object]::ReferenceEquals($ret.requestProof.channel,$r.channel)-or![object]::ReferenceEquals($ret.requestProof.request,$r.request)){throw 'C06_BEGIN_PAUSE_REQUEST_CHANGED'}
 Assert-Business5244RetirementRequest -Channel $r.channel -Request $r.request
 Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
 if($ret.operationId-isnot[string]-or$ret.operationId-cnotmatch'\A[a-f0-9]{32}\z'-or$null-eq$ret.records-or$null-eq$ret.pending-or$ret.before-isnot[byte[]]-or$ret.expected-cnotmatch'\A[a-f0-9]{64}\z'-or$ret.recordExpected-cnotmatch'\A[a-f0-9]{64}\z'-or$ret.pendingHash-cnotmatch'\A[a-f0-9]{64}\z'-or(Get-Business5244StartupHash $ret.before)-cne$ret.expected-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $ret.records))-cne$ret.recordExpected-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $ret.pending))-cne$ret.pendingHash){throw 'C06_BEGIN_PAUSE_RETIREMENT_RECORD_CHANGED'}
 if($c.phase-cnotin@('PAUSING','BEGIN_PROFILE_APPLIED_PAUSED')-or$null-eq$c.activeBinding-or$c.activeBinding.admission.children.api.pid-ne$r.apiPid-or$c.activeBinding.birth-ne$r.apiBirthTicks){throw 'C06_BEGIN_PAUSE_API_CHANGED'}
 foreach($key in @('lease','apiChild','webChild','seal')){if(![object]::ReferenceEquals($r.owner.$key,$r.$key)){throw 'C06_BEGIN_PAUSE_OWNER_CHANGED'}}
 $r.seal.Validate();Assert-Test125ReadPairPaused $c
 Assert-C06BeginApiHandleOwner $r $c
 return $ret
}

function New-C06BeginPausedAdmission($PauseBinding){
 $r=Get-C06BeginPauseBindingRecord $PauseBinding
 if($r.phase-cne'Bound'-or$null-ne$r.admission){throw 'C06_BEGIN_PAUSE_ALREADY_ISSUED'}
 $ret=Assert-C06BeginPausePhysicalState $r
 $operation=$r.operationJson|ConvertFrom-Json
 $identity=[pscustomobject][ordered]@{operation=$operation;ownerPid=$PID;ownerBirth=$r.ownerBirth;retirementOperationId=$ret.operationId}
 $token=[pscustomobject][ordered]@{schema='melisa-c06-paused-owner-observation.v1';id=[guid]::NewGuid().ToString('N')}
 $r.identity=$identity;$r.identityJson=$identity|ConvertTo-Json -Depth 8 -Compress;$r.retirementOperationId=$ret.operationId;$r.records=$ret.records;$r.pending=$ret.pending;$r.pendingHash=$ret.pendingHash;$r.beforeHash=$ret.expected;$r.recordExpected=$ret.recordExpected;$r.apiBinding=$r.transitionContext.activeBinding;$r.apiHandle=$r.transitionContext.activeBinding.handle;$r.admission=$token;$r.admissionJson=$token|ConvertTo-Json -Compress;$r.phase='Paused'
 return $token
}

function Assert-C06BeginPausedAdmission($PausedAdmission){
 $rows=@($script:C06BeginPauseBindings|Where-Object{[object]::ReferenceEquals($_.admission,$PausedAdmission)})
 if($rows.Count-ne1){throw 'C06_BEGIN_PAUSED_ADMISSION_UNISSUED'};$r=$rows[0]
 [void](Get-C06BeginPauseBindingRecord $r.token)
 if($r.phase-cne'Paused'-or($PausedAdmission|ConvertTo-Json -Compress)-cne$r.admissionJson-or($r.identity|ConvertTo-Json -Depth 8 -Compress)-cne$r.identityJson){throw 'C06_BEGIN_PAUSED_ADMISSION_CHANGED'}
 $ret=Assert-C06BeginPausePhysicalState $r
 if($ret.operationId-cne$r.retirementOperationId-or![object]::ReferenceEquals($ret.records,$r.records)-or![object]::ReferenceEquals($ret.pending,$r.pending)-or$ret.pendingHash-cne$r.pendingHash-or$ret.expected-cne$r.beforeHash-or$ret.recordExpected-cne$r.recordExpected-or![object]::ReferenceEquals($r.transitionContext.activeBinding,$r.apiBinding)-or![object]::ReferenceEquals($r.transitionContext.activeBinding.handle,$r.apiHandle)){throw 'C06_BEGIN_PAUSE_RETIREMENT_RECORD_CHANGED'}
 # Deliberately no BEGIN journal stream or SQL capability. The legacy WEB
 # pending marker is not a BEGIN intent and must never be re-labelled as one.
 return [pscustomobject]@{identity=$r.identity;binding=$r.binding;ownerState=$r.ownerState;transition=$r.transition;stream=$null;nativeTargetVerified=$false;sqlAuthority=$false;stopAuthority=$false;executionAuthority=$false}
}
