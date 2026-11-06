$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'c06-begin-authority.ps1') -Library
# In-memory doubles exercise candidate/reference and one-shot semantics only.
# They never issue a real owner, journal, SQL, stop or execution capability.
$script:binding=[pscustomobject]@{fixture='binding'}
$script:observation=[pscustomobject]@{fixture='observation'}
$script:bindingRecord=@{ownedObservationToken=$script:observation}
$script:owner=@{token=$script:observation;binding=$script:binding;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;closed=$false;lease=[pscustomobject]@{};apiChild=[pscustomobject]@{};webChild=[pscustomobject]@{};seal=[pscustomobject]@{}}
$script:ErpCurrentPairObservations=[Collections.Generic.List[object]]::new();[void]$script:ErpCurrentPairObservations.Add($script:owner)
$script:ownerValid=$true
function Get-ErpCurrentPairBinding($Binding){if(!$script:ownerValid-or![object]::ReferenceEquals($Binding,$script:binding)){throw 'FIXTURE_BINDING_CHANGED'};return $script:bindingRecord}
function Get-ErpCurrentPairOwnedObservation($Observation){if(!$script:ownerValid-or![object]::ReferenceEquals($Observation,$script:observation)){throw 'FIXTURE_OWNER_CHANGED'};return [pscustomobject]@{status='OWNED_PAIR_OBSERVATION_ONLY';sqlAuthority=$false;stopAuthority=$false;installationAuthority=$false}}
function New-FixtureOperation([string]$Id){return [pscustomobject][ordered]@{operationId=$Id;bodySha256=('1'*64);sourceSha256=('2'*64);targetSha256=('3'*64);sqlBeforeSha256=('4'*64);sqlAfterSha256=('5'*64);profileBeforeSha256=('6'*64);profileAfterSha256=('7'*64);server='Semih\MELISADEV';database='MELISA_ERP_SIRKET_TEST_20260929_01';actorId=17;roleId=17;purpose='BeginSuccessor'}}
function Must-Fail([scriptblock]$Action,[string]$Expected){$failed=$false;try{&$Action|Out-Null}catch{if($_.Exception.Message-cne$Expected){throw};$failed=$true};if(!$failed){throw 'C06_FIXTURE_UNEXPECTED_ACCEPTANCE'}}
$op=New-FixtureOperation ('a'*32);$candidate=New-C06BeginOwnerCandidate $script:binding $script:observation $op
$view=Assert-C06BeginOwnerCandidate $candidate
if($view.status-cne'OWNER_CANDIDATE_AVAILABLE'-or$view.sqlAuthority-or$view.stopAuthority-or$view.executionAuthority-or$view.nativeTargetVerified-or$view.durableJournalVerified){throw 'C06_FIXTURE_AUTHORITY_CLAIM'}
$op.bodySha256='8'*64
if((Assert-C06BeginOwnerCandidate $candidate).operation.bodySha256-cne('1'*64)){throw 'C06_FIXTURE_OPERATION_NOT_COPIED'}
$copy=$candidate|ConvertTo-Json|ConvertFrom-Json;Must-Fail {Assert-C06BeginOwnerCandidate $copy} 'C06_OWNER_CANDIDATE_UNISSUED'
Must-Fail {New-C06BeginOwnerCandidate $script:binding $script:observation (New-FixtureOperation ('a'*32))} 'C06_OWNER_CANDIDATE_OPERATION_REUSED'
$script:ownerValid=$false;Must-Fail {Assert-C06BeginOwnerCandidate $candidate} 'FIXTURE_BINDING_CHANGED';$script:ownerValid=$true
$original=$script:owner.webChild;$script:owner.webChild=[pscustomobject]@{};Must-Fail {Assert-C06BeginOwnerCandidate $candidate} 'C06_OWNER_CANDIDATE_OWNER_CHANGED';$script:owner.webChild=$original
# One in-process second PowerShell runspace receives the actual candidate and
# registry object references; no OS process, handle or external resource.
$ps=[powershell]::Create()
try{
 $code='param($Path,$Records,$Candidate) . $Path -Library; $script:C06BeginOwnerCandidates=$Records; $id=[Threading.Thread]::CurrentThread.ManagedThreadId; try { Assert-C06BeginOwnerCandidate $Candidate | Out-Null; return [pscustomobject]@{thread=$id;result="ACCEPTED"} } catch { return [pscustomobject]@{thread=$id;result=$_.Exception.Message} }'
 [void]$ps.AddScript($code).AddArgument((Join-Path $PSScriptRoot 'c06-begin-authority.ps1')).AddArgument($script:C06BeginOwnerCandidates).AddArgument($candidate)
 $pending=$ps.BeginInvoke();$otherThread=@($ps.EndInvoke($pending))
 if($otherThread.Count-ne1-or$otherThread[0].thread-eq[Threading.Thread]::CurrentThread.ManagedThreadId-or$otherThread[0].result-cne'C06_OWNER_CANDIDATE_CHANGED'){throw 'C06_FIXTURE_FOREIGN_THREAD_RESULT'}
}finally{$ps.Dispose()}
$used=Use-C06BeginOwnerCandidate $candidate
if($used.status-cne'OWNER_CANDIDATE_CONSUMED'-or$used.executionAuthority-or$used.sqlAuthority-or$used.stopAuthority){throw 'C06_FIXTURE_USE_AUTHORITY_CLAIM'}
Must-Fail {Use-C06BeginOwnerCandidate $candidate} 'C06_OWNER_CANDIDATE_CHANGED';Must-Fail {Assert-C06BeginOwnerCandidate $candidate} 'C06_OWNER_CANDIDATE_CHANGED'
$claimed=New-FixtureOperation ('c'*32);$claimed.actorId=18;$claimed.roleId=19
$claimedCandidate=New-C06BeginOwnerCandidate $script:binding $script:observation $claimed
$claimedView=Assert-C06BeginOwnerCandidate $claimedCandidate
if($claimedView.nativeTargetVerified-or$claimedView.executionAuthority-or$claimedView.operation.actorId-ne18-or$claimedView.operation.roleId-ne19){throw 'C06_FIXTURE_CALLER_CLAIM_PROMOTED'}
$script:injectedGetterCalled=$false;$poisoned=New-FixtureOperation ('d'*32);$poisoned.PSObject.Properties.Remove('bodySha256');$poisoned|Add-Member -MemberType ScriptProperty -Name bodySha256 -Value {$script:injectedGetterCalled=$true;return '1'*64}
Must-Fail {New-C06BeginOwnerCandidate $script:binding $script:observation $poisoned} 'C06_OWNER_CANDIDATE_OPERATION_INVALID'
if($script:injectedGetterCalled){throw 'C06_FIXTURE_GETTER_EXECUTED'}
foreach($change in @('missing','extra','newline','badHash','badActor','badRole','sameSql','sameProfile','wrongDb')){
 $bad=New-FixtureOperation ('b'*32)
 switch($change){'missing'{$bad.PSObject.Properties.Remove('bodySha256')};'extra'{$bad|Add-Member extra 1};'newline'{$bad.operationId+="`n"};'badHash'{$bad.bodySha256='z'*64};'badActor'{$bad.actorId=0};'badRole'{$bad.roleId=0};'sameSql'{$bad.sqlAfterSha256=$bad.sqlBeforeSha256};'sameProfile'{$bad.profileAfterSha256=$bad.profileBeforeSha256};'wrongDb'{$bad.database='LIVE'}}
 Must-Fail {New-C06BeginOwnerCandidate $script:binding $script:observation $bad} 'C06_OWNER_CANDIDATE_OPERATION_INVALID'
}
'PASS: same-owner candidate and one-shot checks with in-memory doubles; no execution authority'

# Pause fixtures are in-memory substitutes. They prove dispatch/reference
# behavior only; no retained OS handle, physical pause or journal is created.
$script:owner.facts=[pscustomobject]@{apiPid=11;apiBirth='2026-11-04T09:00:00.0000000Z';webPid=12;webBirth='123456789012345678';ownerBirth='123456789012345679'}
$script:owner.sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$script:owner.tokenJson=$script:observation|ConvertTo-Json -Compress;$script:owner.factsJson=$script:owner.facts|ConvertTo-Json -Compress
$script:owner.seal|Add-Member -MemberType ScriptMethod -Name Validate -Value {if(!$script:sealValid){throw 'FIXTURE_SEAL_CHANGED'}}
$script:owner.webChild|Add-Member -NotePropertyName RetirementConfirmed -NotePropertyValue $false
$script:sealValid=$true;$script:requestValid=$true;$script:paused=$true;$script:transitionValid=$true
$script:stateToken=[pscustomobject]@{state='fixture'};$script:channel=[pscustomobject]@{};$script:request=[pscustomobject]@{operation='retire'}
$script:ret=@{phase='Running';operationId=$null;pending=$null;records=$null;lease=$script:owner.lease;native=$script:owner.webChild;childPid=12;childBirth='123456789012345678';ownerBirth='123456789012345679';requestProof=$null}
$script:transition=[pscustomobject]@{scope='TEST125-API-B6-BEGIN-SUCCESSOR';profileOnlyPurpose='BeginSuccessor';apiProfileBeforeSha256=('6'*64);apiProfileCandidateSha256=('7'*64)}
$script:transitionJson=$script:transition|ConvertTo-Json -Compress
$script:ctx=[pscustomobject]@{token=$script:transition;phase='PREPARED';admission=[pscustomobject]@{children=[pscustomobject]@{api=[pscustomobject]@{pid=11;birth='2026-11-04T09:00:00.0000000Z'}}};activeBinding=$null}
function Get-Business5244RetirementState($State){if(![object]::ReferenceEquals($State,$script:stateToken)){throw 'FIXTURE_STATE_CHANGED'};return $script:ret}
function Assert-Test125ReadPairIssued($Transition){if(!$script:transitionValid-or![object]::ReferenceEquals($Transition,$script:transition)-or($Transition|ConvertTo-Json -Compress)-cne$script:transitionJson){throw 'FIXTURE_TRANSITION_CHANGED'};return $script:ctx}
function Assert-Test125ReadPairRequestAdmission($Transition){if(![object]::ReferenceEquals($Transition,$script:transition)){throw 'FIXTURE_TRANSITION_CHANGED'}}
function Assert-Business5244RetirementRequest($Channel,$Request){if(!$script:requestValid-or![object]::ReferenceEquals($Channel,$script:channel)-or![object]::ReferenceEquals($Request,$script:request)){throw 'FIXTURE_REQUEST_EXPIRED'}}
function Assert-Business5244StartupLease($Lease,$Kind){if(![object]::ReferenceEquals($Lease,$script:owner.lease)-or$Kind-cne'Maintenance'){throw 'FIXTURE_LEASE_CHANGED'}}
function Read-Business5244RetirementBytes($Stream){if(![object]::ReferenceEquals($Stream,$script:ret.pending)-and![object]::ReferenceEquals($Stream,$script:ret.records)){throw 'FIXTURE_PENDING_CHANGED'};return ,[byte[]](1,2,3)}
function Get-Business5244StartupHash([byte[]]$Bytes){return 'f'*64}
function Assert-Test125ReadPairPaused($Context){if(!$script:paused-or![object]::ReferenceEquals($Context,$script:ctx)){throw 'FIXTURE_PHYSICAL_PAUSE_CHANGED'}}
$pauseCandidate=New-C06BeginOwnerCandidate $script:binding $script:observation (New-FixtureOperation ('e'*32))
Must-Fail {Bind-C06BeginOwnerPause $pauseCandidate ([pscustomobject]@{}) $script:transition $script:channel $script:request} 'FIXTURE_STATE_CHANGED'
$pauseBinding=Bind-C06BeginOwnerPause $pauseCandidate $script:stateToken $script:transition $script:channel $script:request
Must-Fail {Use-C06BeginOwnerCandidate $pauseCandidate} 'C06_OWNER_CANDIDATE_CHANGED'
Must-Fail {New-C06BeginPausedAdmission $pauseBinding} 'C06_BEGIN_PAUSE_OWNER_CHANGED'
$script:ret.phase='Retired';$script:ret.operationId='9'*32;$script:ret.pending=[pscustomobject]@{};$script:ret.records=[pscustomobject]@{};$script:ret.pendingHash='f'*64;$script:ret.before=[byte[]](1,2,3);$script:ret.expected='f'*64;$script:ret.recordExpected='f'*64;$script:ret.requestProof=@{channel=$script:channel;request=$script:request};$script:owner.webChild.RetirementConfirmed=$true
$script:ctx.phase='PAUSING';$script:ctx.activeBinding=[pscustomobject]@{admission=$script:ctx.admission;birth=([datetime]'2026-11-04T09:00:00Z').ToUniversalTime().Ticks;handle=[pscustomobject]@{}}
$script:paused=$false;Must-Fail {New-C06BeginPausedAdmission $pauseBinding} 'FIXTURE_PHYSICAL_PAUSE_CHANGED';$script:paused=$true
Must-Fail {New-C06BeginPausedAdmission $pauseBinding} 'C06_BEGIN_API_HANDLE_OWNER_PROOF_UNAVAILABLE'
# The positive branch below uses a test-only replacement. It does not prove
# that Test125's real handle identifies the retained owner Process.
function Assert-C06BeginApiHandleOwner($Record,$Context){}
$pausedAdmission=New-C06BeginPausedAdmission $pauseBinding
$p=Assert-C06BeginPausedAdmission $pausedAdmission
if($p.stream-ne$null-or$p.nativeTargetVerified-or$p.sqlAuthority-or$p.stopAuthority-or$p.executionAuthority-or$p.identity.operation.operationId-cne('e'*32)-or$p.identity.retirementOperationId-cne('9'*32)-or![object]::ReferenceEquals($p.ownerState,$script:stateToken)){throw 'C06_FIXTURE_PAUSE_AUTHORITY_CLAIM'}
Must-Fail {New-C06BeginPausedAdmission $pauseBinding} 'C06_BEGIN_PAUSE_ALREADY_ISSUED'
$copy=$pausedAdmission|ConvertTo-Json|ConvertFrom-Json;Must-Fail {Assert-C06BeginPausedAdmission $copy} 'C06_BEGIN_PAUSED_ADMISSION_UNISSUED'
$script:requestValid=$false;Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'FIXTURE_REQUEST_EXPIRED';$script:requestValid=$true
$script:owner.closed=$true;Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'C06_BEGIN_PAUSE_OWNER_CHANGED';$script:owner.closed=$false
[void]$script:ErpCurrentPairObservations.Remove($script:owner);Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'C06_BEGIN_PAUSE_OWNER_CHANGED';[void]$script:ErpCurrentPairObservations.Add($script:owner)
$oldObservation=$script:owner.token;$script:owner.token=[pscustomobject]@{fixture='observation'};Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'C06_BEGIN_PAUSE_OWNER_CHANGED';$script:owner.token=$oldObservation
$script:transition.apiProfileBeforeSha256='8'*64;Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'FIXTURE_TRANSITION_CHANGED';$script:transition.apiProfileBeforeSha256='6'*64
$script:ctx.activeBinding.birth++;Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'C06_BEGIN_PAUSE_API_CHANGED';$script:ctx.activeBinding.birth--
$savedHandle=$script:ctx.activeBinding.handle;$script:ctx.activeBinding.handle=[pscustomobject]@{};Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'C06_BEGIN_PAUSE_RETIREMENT_RECORD_CHANGED';$script:ctx.activeBinding.handle=$savedHandle
$script:ret.operationId='8'*32;Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'C06_BEGIN_PAUSE_RETIREMENT_RECORD_CHANGED';$script:ret.operationId='9'*32
$savedPending=$script:ret.pending;$script:ret.pending=[pscustomobject]@{};Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'C06_BEGIN_PAUSE_RETIREMENT_RECORD_CHANGED';$script:ret.pending=$savedPending
$script:sealValid=$false;Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'Exception calling "Validate" with "0" argument(s): "FIXTURE_SEAL_CHANGED"';$script:sealValid=$true
$script:paused=$false;Must-Fail {Assert-C06BeginPausedAdmission $pausedAdmission} 'FIXTURE_PHYSICAL_PAUSE_CHANGED';$script:paused=$true
# Cross-module fixture: even the test-only paused admission has no real held
# BEGIN journal, so the actual journal consumer must reject before any I/O.
. (Join-Path $PSScriptRoot 'c06-begin-journal.ps1') -Library
Must-Fail {Start-C06BeginJournalIntent $pausedAdmission} 'C06_BEGIN_HELD_JOURNAL_UNAVAILABLE'
'PASS: fixture-only pause binding; real API handle proof unavailable and admission blocked'
