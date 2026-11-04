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
