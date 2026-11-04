$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'c06-begin-journal.ps1') -Library
function Expect-C06Failure([scriptblock]$Action,[string]$Code){$caught=$false;try{&$Action|Out-Null}catch{if(!$_.Exception.ToString().Contains($Code)){throw};$caught=$true};if(!$caught){throw ('EXPECTED_'+$Code)}}
# This is a synthetic issuer stub and one disposable file, never real owner or TEST proof.
Expect-C06Failure {Start-C06BeginJournalIntent ([pscustomobject]@{})} 'C06_BEGIN_PAUSED_ISSUER_UNAVAILABLE'
$script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_ONLY'}
$script:testBinding=[object]::new();$script:testOwner=[object]::new();$script:testTransition=[object]::new();$script:testStream=$null
$script:testIdentity=[pscustomobject][ordered]@{operation=[pscustomobject][ordered]@{operationId='1'*32;bodySha256='2'*64;sourceSha256='3'*64;targetSha256='4'*64;sqlBeforeSha256='5'*64;sqlAfterSha256='6'*64;profileBeforeSha256='7'*64;profileAfterSha256='8'*64;server='Semih\MELISADEV';database='MELISA_ERP_SIRKET_TEST_20260929_01';actorId=17;roleId=17;purpose='BeginSuccessor'};ownerPid=1234;ownerBirth='123456789';retirementOperationId='a'*32}
function Assert-C06BeginPausedAdmission($a){if(![object]::ReferenceEquals($a,$script:testAdmission)){throw 'FIXTURE_UNISSUED'};if($script:injectOnPausedCall){$script:pausedCalls++;if($script:pausedCalls-eq$script:injectOnPausedCall){$script:testStream.WriteByte(43);$script:testStream.Flush($true)}};return [pscustomobject]@{identity=$script:testIdentity;binding=$script:testBinding;ownerState=$script:testOwner;transition=$script:testTransition;stream=$script:testStream}}
Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_HELD_JOURNAL_UNAVAILABLE'
Add-Type -TypeDefinition @'
using System;
using System.IO;
public sealed class C06SyntheticFailingStream : FileStream {
 public string Failure;
 public C06SyntheticFailingStream(string path, string failure) : base(path,FileMode.CreateNew,FileAccess.ReadWrite,FileShare.Read) { Failure=failure; }
 public override int Read(byte[] bytes,int offset,int count) { if(Failure=="read") throw new IOException("FIXTURE_FAIL_READ");return base.Read(bytes,offset,count); }
 public override void Write(byte[] bytes,int offset,int count) { if(Failure=="write") throw new IOException("FIXTURE_FAIL_WRITE");base.Write(bytes,offset,count); }
 public override void Flush(bool flushToDisk) { if(Failure=="flush") { SetLength(0); throw new IOException("FIXTURE_FAIL_FLUSH"); } base.Flush(flushToDisk); }
}
'@
$path=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp')
$extraPaths=[Collections.Generic.List[string]]::new()
try{
 $script:testStream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_EMPTY_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_FRESH_ISSUER_UNAVAILABLE'
 $script:testFreshStream=$script:testStream
 function Assert-C06BeginFreshJournalAdmission($a){
  if(![object]::ReferenceEquals($a,$script:testAdmission)-or![object]::ReferenceEquals($script:testFreshStream,$script:testStream)){throw 'FIXTURE_FRESH_STREAM_NOT_ISSUED'}
  if($script:injectBytesDuringFresh){$script:testStream.WriteByte(42);$script:testStream.Flush($true)}
  if($script:driftIdentityDuringFresh){$script:testIdentity.operation.bodySha256='9'*64}
  if($script:throwDuringFresh){$script:testStream.WriteByte(44);$script:testStream.Flush($true);throw 'FIXTURE_FRESH_UNCERTAIN'}
  return [pscustomobject]@{admission=$a;stream=$script:testStream;identity=$script:testIdentity;binding=$script:testBinding;ownerState=$script:testOwner;transition=$script:testTransition}
 }
 $normalStream=$script:testStream;$normalAdmission=$script:testAdmission
 $initialPath=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp');[void]$extraPaths.Add($initialPath)
 $script:testStream=[IO.File]::Open($initialPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_INITIAL_BYTES'};$script:testIdentity.operation.operationId='8'*32;$script:testFreshStream=$script:testStream
 $script:testStream.WriteByte(55);$script:testStream.Flush($true)
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.SetLength(0);$script:testStream.Flush($true)
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_INITIAL_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.Dispose()
 $failurePath=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp');[void]$extraPaths.Add($failurePath)
 $script:testStream=[C06SyntheticFailingStream]::new($failurePath,'none');$script:testStream.WriteByte(56);$script:testStream.Flush($true);$script:testStream.Failure='read'
 $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_INITIAL_READ_FAILED'};$script:testIdentity.operation.operationId='7'*32;$script:testFreshStream=$script:testStream
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'FIXTURE_FAIL_READ'
 $script:testStream.Failure='none'
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_READ_ERROR_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.Dispose()
 $issuerPath=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp');[void]$extraPaths.Add($issuerPath)
 $script:testStream=[IO.File]::Open($issuerPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_ISSUER_FAILURE'};$script:testIdentity.operation.operationId='6'*32;$script:testFreshStream=$script:testStream;$script:throwDuringFresh=$true
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'FIXTURE_FRESH_UNCERTAIN'
 $script:throwDuringFresh=$false;$script:testStream.SetLength(0);$script:testStream.Flush($true)
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_ISSUER_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.Dispose();$script:testStream=$normalStream;$script:testFreshStream=$normalStream
 $script:testAdmission=$normalAdmission;$script:testIdentity.operation.operationId='1'*32
 $racePath=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp');[void]$extraPaths.Add($racePath)
 $script:testStream=[IO.File]::Open($racePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_FRESH_RACE'};$script:testIdentity.operation.operationId='f'*32;$script:testFreshStream=$script:testStream
 $script:injectBytesDuringFresh=$true
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $observed=Read-C06BeginHeldBytes $script:testStream
 if($observed.Length-ne1-or$observed[0]-ne42){throw 'FIXTURE_FRESH_RACE_BYTES_NOT_PRESERVED'}
 # Even a subsequent truncation of this disposable fixture cannot authorize
 # retry in this process; the production journal is never truncated here.
 $script:testStream.SetLength(0);$script:testStream.Flush($true);$script:injectBytesDuringFresh=$false
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_FRESH_RACE_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.Dispose();$script:testStream=$normalStream;$script:testFreshStream=$normalStream
 $script:testAdmission=$normalAdmission;$script:testIdentity.operation.operationId='1'*32
 $latePath=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp');[void]$extraPaths.Add($latePath)
 $script:testStream=[IO.File]::Open($latePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_FINAL_SNAPSHOT_RACE'};$script:testIdentity.operation.operationId='9'*32;$script:testFreshStream=$script:testStream
 $script:pausedCalls=0;$script:injectOnPausedCall=3
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:injectOnPausedCall=0;$observed=Read-C06BeginHeldBytes $script:testStream
 if($observed.Length-ne1-or$observed[0]-ne43){throw 'FIXTURE_FINAL_SNAPSHOT_BYTES_NOT_PRESERVED'}
 $script:testStream.SetLength(0);$script:testStream.Flush($true)
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_FINAL_SNAPSHOT_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.Dispose();$script:testStream=$normalStream;$script:testFreshStream=$normalStream
 $script:testAdmission=$normalAdmission;$script:testIdentity.operation.operationId='1'*32
 $driftPath=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp');[void]$extraPaths.Add($driftPath)
 $script:testStream=[IO.File]::Open($driftPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_FRESH_IDENTITY_DRIFT'};$script:testIdentity.operation.operationId='0'*32;$script:testFreshStream=$script:testStream
 $script:driftIdentityDuringFresh=$true
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_IDENTITY_CHANGED'
 $script:driftIdentityDuringFresh=$false;$script:testIdentity.operation.bodySha256='2'*64
 if($script:testStream.Length-ne0-or(Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_FRESH_DRIFT_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.Dispose();$script:testStream=$normalStream;$script:testFreshStream=$normalStream
 $script:testAdmission=$normalAdmission;$script:testIdentity.operation.operationId='1'*32
 $proof=Start-C06BeginJournalIntent $script:testAdmission
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $oldAdmission=$script:testAdmission;$script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_SECOND_ADMISSION'}
 Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_ADMISSION_CHANGED_NO_REPLAY'
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_ADMISSION_CHANGED_NO_REPLAY';$script:testAdmission=$oldAdmission
 $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_OTHER_OPERATION'};$script:testIdentity.operation.operationId='e'*32
 Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_ADMISSION_CHANGED_NO_REPLAY'
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_ADMISSION_CHANGED_NO_REPLAY';$script:testIdentity.operation.operationId='1'*32;$script:testAdmission=$oldAdmission
 Expect-C06Failure {Use-C06BeginJournalIntent ([pscustomobject]@{}) $proof} 'C06_BEGIN_INTENT_REPLAY_OR_CHANGED'
 $script:testIdentity.operation.bodySha256='9'*64
 Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT'
 Expect-C06Failure {Use-C06BeginJournalIntent $script:testAdmission $proof} 'C06_BEGIN_JOURNAL_IDENTITY_CHANGED'
 $script:testIdentity.operation.bodySha256='2'*64
 foreach($key in @('operationId','sourceSha256','targetSha256','sqlBeforeSha256','sqlAfterSha256','profileBeforeSha256','profileAfterSha256')){
  $old=$script:testIdentity.operation.$key;$script:testIdentity.operation.$key=if($key-ceq'operationId'){'b'*32}else{'b'*64}
  Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT';$script:testIdentity.operation.$key=$old
 }
 $script:testIdentity.ownerPid=9999;Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT';$script:testIdentity.ownerPid=1234
 $script:testIdentity.ownerBirth='999';Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT';$script:testIdentity.ownerBirth='123456789'
 $script:testIdentity.retirementOperationId='b'*32;Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT';$script:testIdentity.retirementOperationId='a'*32
 $script:testIdentity.operation.database='NOT_TEST';Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_IDENTITY_INVALID';$script:testIdentity.operation.database='MELISA_ERP_SIRKET_TEST_20260929_01'
 Expect-C06Failure {Use-C06BeginJournalIntent $script:testAdmission ([pscustomobject]@{})} 'C06_BEGIN_INTENT_UNISSUED'
 $result=Use-C06BeginJournalIntent $script:testAdmission $proof
 if($result.status-cne'INTENT_CONSUMED'-or$result.executionAuthority-ne$false-or$result.sqlAuthority-ne$false-or$result.complete-ne$false){throw 'FIXTURE_RESULT_SCOPE'}
 Expect-C06Failure {Use-C06BeginJournalIntent $script:testAdmission $proof} 'C06_BEGIN_INTENT_REPLAY_OR_CHANGED'
 $saved=Read-C06BeginHeldBytes $script:testStream;$script:testStream.SetLength(0)
 if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_TRUNCATED_UNKNOWN_EXPECTED'}
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
 $script:testStream.Position=0;$script:testStream.Write($saved,0,$saved.Length);$script:testStream.Flush($true)
 $script:testStream.Position=0;$script:testStream.WriteByte(88);$script:testStream.Flush($true)
 Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_DIFFERENT_OR_CORRUPT'
 $script:testStream.Position=0;$script:testStream.Write($saved,0,$saved.Length);$script:testStream.Flush($true)
 $script:testStream.Dispose();$script:testStream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_STREAM_CHANGED_NO_REPLAY'
 Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_STREAM_CHANGED_NO_REPLAY'
 $script:testStream.Position=0;$script:testStream.WriteByte(88);$script:testStream.Flush($true)
 Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_STREAM_CHANGED_NO_REPLAY'
 $script:testStream.Dispose();$script:testStream=$null
 foreach($kind in @('write','flush')){
  $script:testAdmission=[pscustomobject]@{fixture='SYNTHETIC_ONLY'};$script:testIdentity.operation.operationId=if($kind-ceq'write'){'c'*32}else{'d'*32}
  $next=Join-Path ([IO.Path]::GetTempPath()) ('melisa-c06-journal-fixture-'+[guid]::NewGuid().ToString('N')+'.tmp');[void]$extraPaths.Add($next)
  $script:testStream=[C06SyntheticFailingStream]::new($next,$kind)
  $script:testFreshStream=$script:testStream
  Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} ('FIXTURE_FAIL_'+$kind.ToUpperInvariant())
  if($script:testStream.Length-ne0){throw 'FIXTURE_FAILURE_MUST_BE_ZERO_BYTE'}
  if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_FAILED_EMPTY_UNKNOWN_EXPECTED'}
  Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_NOT_EMPTY_NO_REPLAY'
  $script:testStream.Failure='none';$script:testStream.Dispose();$script:testStream=[IO.File]::Open($next,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  Expect-C06Failure {Get-C06BeginJournalState $script:testAdmission} 'C06_BEGIN_JOURNAL_STREAM_CHANGED_NO_REPLAY'
  Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'C06_BEGIN_JOURNAL_STREAM_CHANGED_NO_REPLAY'
  # Simulate only loss of this in-memory registry; no crash proof is claimed.
  $script:C06BeginJournalProofs.Clear()
  if((Get-C06BeginJournalState $script:testAdmission).status-cne'UNKNOWN_NO_REPLAY'){throw 'FIXTURE_REOPEN_EMPTY_UNKNOWN_EXPECTED'}
  Expect-C06Failure {Start-C06BeginJournalIntent $script:testAdmission} 'FIXTURE_FRESH_STREAM_NOT_ISSUED'
  $script:testStream.Dispose();$script:testStream=$null
 }
 'C06_BEGIN_JOURNAL_SYNTHETIC_FIXTURE_PASS'
}finally{
 if($script:testStream){$script:testStream.Dispose();$script:testStream=$null}
 if($normalStream){$normalStream.Dispose()}
 if([IO.File]::Exists($path)){[IO.File]::Delete($path)}
 foreach($extra in $extraPaths){if([IO.File]::Exists($extra)){[IO.File]::Delete($extra)}}
}
