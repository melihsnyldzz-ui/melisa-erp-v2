param([Alias('Library')][switch]$C06BeginJournalLibrary)
# The caller must load the real owner-issued pause admission before this module.
# This module neither opens a path nor issues SQL, stop, owner or install rights.
if(!(Get-Variable C06BeginJournalProofs -Scope Script -ErrorAction SilentlyContinue)){$script:C06BeginJournalProofs=[Collections.Generic.List[object]]::new()}

function Get-C06BeginJournalHash([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Get-C06BeginJournalSnapshot($PausedAdmission){
 if(!(Get-Command Assert-C06BeginPausedAdmission -CommandType Function -ErrorAction SilentlyContinue)){throw 'C06_BEGIN_PAUSED_ISSUER_UNAVAILABLE'}
 $view=Assert-C06BeginPausedAdmission $PausedAdmission
 if($null-eq$view-or$null-eq$view.identity-or$null-eq$view.binding-or$null-eq$view.ownerState-or$null-eq$view.transition-or$view.stream-isnot[IO.FileStream]){throw 'C06_BEGIN_HELD_JOURNAL_UNAVAILABLE'}
 $s=$view.stream;if(!$s.CanRead-or!$s.CanWrite-or!$s.CanSeek){throw 'C06_BEGIN_HELD_JOURNAL_UNAVAILABLE'}
 $identity=$view.identity;$outerKeys=@('operation','ownerPid','ownerBirth','retirementOperationId');$keys=@('operationId','bodySha256','sourceSha256','targetSha256','sqlBeforeSha256','sqlAfterSha256','profileBeforeSha256','profileAfterSha256','server','database','actorId','roleId','purpose')
 if($identity-isnot[pscustomobject]-or(@($identity.PSObject.Properties.Name|Sort-Object)-join'|')-cne(@($outerKeys|Sort-Object)-join'|')-or@($identity.PSObject.Properties|Where-Object{$_.MemberType-ne[Management.Automation.PSMemberTypes]::NoteProperty}).Count){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}
 $v=$identity.operation
 if($v-isnot[pscustomobject]-or(@($v.PSObject.Properties.Name|Sort-Object)-join'|')-cne(@($keys|Sort-Object)-join'|')-or@($v.PSObject.Properties|Where-Object{$_.MemberType-ne[Management.Automation.PSMemberTypes]::NoteProperty}).Count){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}
 foreach($key in @('operationId','bodySha256','sourceSha256','targetSha256','sqlBeforeSha256','sqlAfterSha256','profileBeforeSha256','profileAfterSha256','server','database','purpose')){if($v.$key-isnot[string]){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}}
 if($v.operationId-cnotmatch'\A[a-f0-9]{32}\z'-or$v.server-cne'Semih\MELISADEV'-or$v.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or$v.purpose-cne'BeginSuccessor'-or$identity.ownerBirth-isnot[string]-or$identity.ownerBirth-cnotmatch'\A[0-9]{1,20}\z'-or$identity.retirementOperationId-isnot[string]-or$identity.retirementOperationId-cnotmatch'\A[a-f0-9]{32}\z'-or$identity.retirementOperationId-ceq$v.operationId){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}
 foreach($key in @('bodySha256','sourceSha256','targetSha256','sqlBeforeSha256','sqlAfterSha256','profileBeforeSha256','profileAfterSha256')){if($v.$key-cnotmatch'\A[a-f0-9]{64}\z'){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}}
 foreach($key in @('actorId','roleId')){if(($v.$key-isnot[int]-and$v.$key-isnot[long])-or$v.$key-le0){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}}
 if(($identity.ownerPid-isnot[int]-and$identity.ownerPid-isnot[long])-or$identity.ownerPid-le0){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}
 if($v.sqlBeforeSha256-ceq$v.sqlAfterSha256-or$v.profileBeforeSha256-ceq$v.profileAfterSha256){throw 'C06_BEGIN_JOURNAL_IDENTITY_INVALID'}
 $ordered=[ordered]@{};foreach($key in $keys){$ordered[$key]=$v.$key};foreach($key in @('ownerPid','ownerBirth','retirementOperationId')){$ordered[$key]=$identity.$key}
 $text=ConvertTo-Json -InputObject ([pscustomobject]$ordered) -Compress -Depth 5
 return @{stream=$s;binding=$view.binding;ownerState=$view.ownerState;transition=$view.transition;identity=$identity;identityJson=$text;operationId=$v.operationId}
}
function Assert-C06BeginJournalSame($First,$Again){
 foreach($key in @('stream','binding','ownerState','transition','identity')){if(![object]::ReferenceEquals($First.$key,$Again.$key)){throw 'C06_BEGIN_JOURNAL_ISSUED_REFERENCE_CHANGED'}}
 if($First.identityJson-cne$Again.identityJson){throw 'C06_BEGIN_JOURNAL_IDENTITY_CHANGED'}
}
function Get-C06BeginJournalIntentBytes($Snapshot){
 $body='{"schema":"melisa-c06-begin-intent.v1","identity":'+$Snapshot.identityJson+'}' + "`n"
 return ,([Text.UTF8Encoding]::new($false,$true).GetBytes($body))
}
function Read-C06BeginHeldBytes([IO.FileStream]$Stream){
 if(!$Stream.CanRead-or!$Stream.CanSeek-or$Stream.Length-gt32768){throw 'C06_BEGIN_JOURNAL_CORRUPT'}
 $Stream.Position=0;$buffer=[byte[]]::new([int]$Stream.Length);$n=0
 while($n-lt$buffer.Length){$got=$Stream.Read($buffer,$n,$buffer.Length-$n);if($got-le0){throw 'C06_BEGIN_JOURNAL_READ_FAILED'};$n+=$got};return ,$buffer
}
function Get-C06BeginJournalReservation($PausedAdmission,$Snapshot){
 $matches=@($script:C06BeginJournalProofs|Where-Object{[object]::ReferenceEquals($_.admission,$PausedAdmission)-or$_.snapshot.operationId-ceq$Snapshot.operationId-or[object]::ReferenceEquals($_.snapshot.stream,$Snapshot.stream)})
 foreach($r in $matches){
  if(![object]::ReferenceEquals($r.admission,$PausedAdmission)){throw 'C06_BEGIN_JOURNAL_ADMISSION_CHANGED_NO_REPLAY'}
  if($r.snapshot.identityJson-cne$Snapshot.identityJson){throw 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT'}
  if(![object]::ReferenceEquals($r.snapshot.stream,$Snapshot.stream)){throw 'C06_BEGIN_JOURNAL_STREAM_CHANGED_NO_REPLAY'}
 }
 return $matches
}
function New-C06BeginUnknownReservation($PausedAdmission,$Snapshot,$Hash=$null){
 $r=@{token=$null;tokenJson=$null;admission=$PausedAdmission;snapshot=$Snapshot;hash=$Hash;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;used=$false;phase='Unknown'}
 [void]$script:C06BeginJournalProofs.Add($r);return $r
}
function Get-C06BeginJournalState($PausedAdmission){
 $first=Get-C06BeginJournalSnapshot $PausedAdmission;$reservations=Get-C06BeginJournalReservation $PausedAdmission $first
 if(@($reservations|Where-Object{$_.phase-cin@('Writing','Unknown')}).Count){return [pscustomobject]@{status='UNKNOWN_NO_REPLAY';executionAuthority=$false}}
 $bytes=Read-C06BeginHeldBytes $first.stream;$next=Get-C06BeginJournalSnapshot $PausedAdmission;Assert-C06BeginJournalSame $first $next
 # Zero bytes cannot distinguish a newly created journal from a crash before
 # durable intent. Only the separate issuer can prove a fresh CreateNew file.
 if($bytes.Length-eq0){return [pscustomobject]@{status='UNKNOWN_NO_REPLAY';executionAuthority=$false}}
 $expected=Get-C06BeginJournalIntentBytes $first
 if((Get-C06BeginJournalHash $bytes)-cne(Get-C06BeginJournalHash $expected)){throw 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT'}
 # An intent alone cannot prove whether SQL or profile changes committed.
 return [pscustomobject]@{status='UNKNOWN_NO_REPLAY';executionAuthority=$false}
}
function Start-C06BeginJournalIntent($PausedAdmission){
 $first=Get-C06BeginJournalSnapshot $PausedAdmission
 if(@(Get-C06BeginJournalReservation $PausedAdmission $first).Count){throw 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'}
 try{$initial=Read-C06BeginHeldBytes $first.stream}catch{[void](New-C06BeginUnknownReservation $PausedAdmission $first);throw}
 if($initial.Length-ne0){[void](New-C06BeginUnknownReservation $PausedAdmission $first);throw 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'}
 if(!(Get-Command Assert-C06BeginFreshJournalAdmission -CommandType Function -ErrorAction SilentlyContinue)){throw 'C06_BEGIN_FRESH_ISSUER_UNAVAILABLE'}
 # The real issuer must prove CreateNew and retain this exact operation and
 # handle; a caller boolean or a pre-existing empty path is not such proof.
 # Reserve before issuer invocation: even an issuer exception can mean a
 # CreateNew attempt occurred and must never be retried automatically.
 $record=New-C06BeginUnknownReservation $PausedAdmission $first
 try{
  $fresh=Assert-C06BeginFreshJournalAdmission $PausedAdmission
  if($null-eq$fresh-or![object]::ReferenceEquals($fresh.admission,$PausedAdmission)){throw 'C06_BEGIN_FRESH_ADMISSION_REJECTED'}
  foreach($key in @('stream','binding','ownerState','transition','identity')){if(![object]::ReferenceEquals($fresh.$key,$first.$key)){throw 'C06_BEGIN_FRESH_ADMISSION_REJECTED'}}
  $bytes=Get-C06BeginJournalIntentBytes $first;$hash=Get-C06BeginJournalHash $bytes;$record.hash=$hash
  $second=Get-C06BeginJournalSnapshot $PausedAdmission;Assert-C06BeginJournalSame $first $second
  $third=Get-C06BeginJournalSnapshot $PausedAdmission;Assert-C06BeginJournalSame $first $third
  # Never overwrite bytes appearing between the initial read and freshness.
  # No issuer callbacks occur between this final read and the write.
  if((Read-C06BeginHeldBytes $third.stream).Length-ne0){throw 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'}
  $record.phase='Writing'
  $s=$first.stream;$s.Position=0;$s.Write($bytes,0,$bytes.Length);$s.Flush($true)
  if((Get-C06BeginJournalHash (Read-C06BeginHeldBytes $s))-cne$hash){throw 'C06_BEGIN_JOURNAL_DURABILITY_UNKNOWN'}
  $last=Get-C06BeginJournalSnapshot $PausedAdmission;Assert-C06BeginJournalSame $first $last
  $token=[pscustomobject][ordered]@{schema='melisa-c06-begin-intent-proof.v1';id=[guid]::NewGuid().ToString('N')}
  $record.token=$token;$record.tokenJson=($token|ConvertTo-Json -Compress);$record.phase='Ready';return $token
 }catch{$record.phase='Unknown';throw}
}
function Use-C06BeginJournalIntent($PausedAdmission,$IntentProof){
 $rows=@($script:C06BeginJournalProofs|Where-Object{[object]::ReferenceEquals($_.token,$IntentProof)})
 if($rows.Count-ne1){throw 'C06_BEGIN_INTENT_UNISSUED'};$r=$rows[0]
 if($r.phase-cne'Ready'-or$r.used-or$r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or![object]::ReferenceEquals($r.admission,$PausedAdmission)-or($IntentProof|ConvertTo-Json -Compress)-cne$r.tokenJson){throw 'C06_BEGIN_INTENT_REPLAY_OR_CHANGED'}
 $next=Get-C06BeginJournalSnapshot $PausedAdmission;Assert-C06BeginJournalSame $r.snapshot $next
 if((Get-C06BeginJournalHash (Read-C06BeginHeldBytes $next.stream))-cne$r.hash){throw 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT'}
 $last=Get-C06BeginJournalSnapshot $PausedAdmission;Assert-C06BeginJournalSame $r.snapshot $last
 $r.used=$true
 # The paired consumer must perform its own SQL/profile admission and readback.
 return [pscustomobject]@{status='INTENT_CONSUMED';sqlAuthority=$false;executionAuthority=$false;complete=$false}
}
