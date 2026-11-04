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
