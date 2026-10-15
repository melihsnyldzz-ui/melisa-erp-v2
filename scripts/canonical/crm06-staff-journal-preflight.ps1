param([Parameter(Mandatory=$true)][string]$OwnerSid,[ValidateSet('b2985d2295c022848c769ea5f494012c1eb3fa00','da82fc6644c1d9dba0c10eaa861773534d43c288','5ce452b01ef20fc84a09c52b78311db8eb1dd1d8','5bcd5ad136ff7ca35d623d436b8724cc491641be','bb8966c59a6cfbdc1cc83472cb331e48b720a173','957f98773695874ea3d101b7eb4816f9ea080880','89427492f27caf72c511a27262b55e73d782c407','94f2a75322a3daa695d38010a6f2c8ef23f6c17b','a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9')][string]$Source='b2985d2295c022848c769ea5f494012c1eb3fa00',[string]$ProfileVariant)
$ErrorActionPreference='Stop'
$actorRoot='C:\Sirket\CRM\runtime\CRM06-TEST-ACTORS-20261014'
$target=$actorRoot+'\assigned-staff-refresh.json'
$handles=New-Object 'System.Collections.Generic.List[Microsoft.Win32.SafeHandles.SafeFileHandle]'
$phase='OWNER'
try {
 if($OwnerSid -notmatch '^S-1-5-21-(?:[1-9]\d*-){3}[1-9]\d*$' -or [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $OwnerSid){throw 'REJECT'}
 $phase='PARAMETERS'
 if($Source -cne 'b2985d2295c022848c769ea5f494012c1eb3fa00' -and $Source -cne 'da82fc6644c1d9dba0c10eaa861773534d43c288' -and $Source -cne '5ce452b01ef20fc84a09c52b78311db8eb1dd1d8' -and $Source -cne '5bcd5ad136ff7ca35d623d436b8724cc491641be' -and $Source -cne 'bb8966c59a6cfbdc1cc83472cb331e48b720a173' -and $Source -cne '957f98773695874ea3d101b7eb4816f9ea080880' -and $Source -cne '89427492f27caf72c511a27262b55e73d782c407' -and $Source -cne '94f2a75322a3daa695d38010a6f2c8ef23f6c17b' -and $Source -cne 'a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9'){throw 'REJECT'}
 $hasParentProbe=$PSBoundParameters.ContainsKey('ProfileVariant')
 if($hasParentProbe -and -not (($ProfileVariant -ceq 'parent-probe' -and $Source -ceq 'da82fc6644c1d9dba0c10eaa861773534d43c288') -or ($ProfileVariant -ceq 'receipt-wait' -and $Source -ceq '5bcd5ad136ff7ca35d623d436b8724cc491641be'))){throw 'REJECT'}
 $expected=@(
  'C:\Sirket\CRM\runtime\ERP-COMPLETION01-20261011\normal-agent-test-baseline.env',
  'C:\Sirket\CRM\runtime\ERP-COMPLETION01-20261011\protected-normal-sessions\refresh-journal.json',
  'C:\Sirket\CRM\runtime\CUSTOMER-PRODUCT-REQUEST-SHARED-20261013\customer-product-requests.json',
  'C:\Sirket\CRM\runtime\CUSTOMER-PRODUCT-REQUEST-SHARED-20261013\request-issuer-refresh.json',
  ($actorRoot+'\manager-first-login.dpapi'),($actorRoot+'\staff-first-login.dpapi'),($actorRoot+'\agent-test-baseline.env'),($actorRoot+'\provisioning-audit.json'),($actorRoot+'\credential-index.json'),($actorRoot+'\staff-refresh-successor-b2985d2295c0.json')
 )
 if($Source -ceq 'da82fc6644c1d9dba0c10eaa861773534d43c288'){$expected+=($actorRoot+'\staff-refresh-successor-da82fc6644c1.json')}
 if($hasParentProbe -and $ProfileVariant -ceq 'parent-probe'){$expected+=($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json')}
 if($Source -ceq '5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'){$expected+=@(($actorRoot+'\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\staff-refresh-successor-5ce452b01ef2.json'))}
 if($Source -ceq '5bcd5ad136ff7ca35d623d436b8724cc491641be'){$expected+=@(($actorRoot+'\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\staff-refresh-successor-5ce452b01ef2.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff.json'))}
 if($hasParentProbe -and $ProfileVariant -ceq 'receipt-wait'){$expected+=($actorRoot+'\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json')}
 if($Source -ceq 'bb8966c59a6cfbdc1cc83472cb331e48b720a173'){$expected+=@(($actorRoot+'\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\staff-refresh-successor-5ce452b01ef2.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json'),($actorRoot+'\staff-refresh-successor-bb8966c59a6c.json'))}
 if($Source -ceq '957f98773695874ea3d101b7eb4816f9ea080880'){$expected+=@(($actorRoot+'\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\staff-refresh-successor-5ce452b01ef2.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json'),($actorRoot+'\staff-refresh-successor-bb8966c59a6c.json'),($actorRoot+'\staff-refresh-successor-957f98773695.json'))}
 if($Source -ceq '89427492f27caf72c511a27262b55e73d782c407'){$expected+=@(($actorRoot+'\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\staff-refresh-successor-5ce452b01ef2.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json'),($actorRoot+'\staff-refresh-successor-bb8966c59a6c.json'),($actorRoot+'\staff-refresh-successor-957f98773695.json'),($actorRoot+'\staff-refresh-successor-89427492f27c.json'))}
 if($Source -ceq '94f2a75322a3daa695d38010a6f2c8ef23f6c17b'){$expected+=@(($actorRoot+'\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\staff-refresh-successor-5ce452b01ef2.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json'),($actorRoot+'\staff-refresh-successor-bb8966c59a6c.json'),($actorRoot+'\staff-refresh-successor-957f98773695.json'),($actorRoot+'\staff-refresh-successor-89427492f27c.json'),($actorRoot+'\staff-refresh-successor-94f2a75322a3.json'))}
 if($Source -ceq 'a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9'){$expected+=@(($actorRoot+'\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\staff-refresh-successor-5ce452b01ef2.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff.json'),($actorRoot+'\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json'),($actorRoot+'\staff-refresh-successor-bb8966c59a6c.json'),($actorRoot+'\staff-refresh-successor-957f98773695.json'),($actorRoot+'\staff-refresh-successor-89427492f27c.json'),($actorRoot+'\staff-refresh-successor-94f2a75322a3.json'),($actorRoot+'\staff-refresh-successor-a7243dedf9ca.json'))}
 [Array]::Sort($expected,[StringComparer]::Ordinal)
 # Independent finite policy, never a caller-selectable subset. The JS owner
 # also validates its exact profile reference set and every returned tuple.
 $excluded=$expected
 $phase='NATIVE_INIT'
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class Crm06JournalNative {
 [StructLayout(LayoutKind.Sequential)] public struct Info {
  public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Creation;
  public System.Runtime.InteropServices.ComTypes.FILETIME Access; public System.Runtime.InteropServices.ComTypes.FILETIME Write;
  public uint Volume; public uint SizeHigh; public uint SizeLow; public uint Links; public uint IndexHigh; public uint IndexLow;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern SafeFileHandle CreateFileW(string name,uint access,uint sharing,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool GetFileInformationByHandle(SafeFileHandle handle,out Info info);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern uint GetFileAttributesW(string name);
 [DllImport("advapi32.dll",SetLastError=true)] public static extern uint GetSecurityInfo(SafeFileHandle handle,uint objectType,uint information,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
 [DllImport("advapi32.dll")] public static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
 [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr memory);
 public static byte[] Security(SafeFileHandle handle) {
  IntPtr owner,group,dacl,sacl,descriptor;
  if(GetSecurityInfo(handle,1,5,out owner,out group,out dacl,out sacl,out descriptor)!=0)throw new InvalidOperationException();
  try { uint size=GetSecurityDescriptorLength(descriptor); if(size==0||size>65536)throw new InvalidOperationException();byte[] data=new byte[size];Marshal.Copy(descriptor,data,0,(int)size);return data; }
  finally { LocalFree(descriptor); }
 }
}
'@
 function Validate-Path([string]$value){
  if($value -cnotmatch '^C:\\Sirket\\CRM\\runtime\\' -or [IO.Path]::GetFullPath($value) -cne $value -or $value -match '[\x00-\x1f\x7f"''`$%<>|?*/]' -or $value.Substring(2).Contains(':')){throw 'REJECT'}
  foreach($part in $value.Split('\')){if(!$part -or $part -eq '.' -or $part -eq '..' -or $part -match '[. ]$'){throw 'REJECT'}}
 }
 function Attributes([string]$value){
  $a=[Crm06JournalNative]::GetFileAttributesW($value)
  if($a -eq [uint32]::MaxValue){$error=[Runtime.InteropServices.Marshal]::GetLastWin32Error();if($error -eq 2 -or $error -eq 3){return $null};throw 'REJECT'}
  if(($a -band 1024) -ne 0){throw 'REJECT'}
  return $a
 }
 function Check-Ancestors([string]$value){
  for($current=$value;$current;$current=[IO.Path]::GetDirectoryName($current)){$null=Attributes $current;if($current -eq [IO.Path]::GetPathRoot($current)){break}}
 }
 function Open-Metadata([string]$value){
  # FILE_READ_ATTRIBUTES|READ_CONTROL only. No FILE_READ_DATA, write access,
  # backup privilege, content stream, ACL mutation or link modification.
  $handle=[Crm06JournalNative]::CreateFileW($value,0x20080,1,[IntPtr]::Zero,3,0x02200000,[IntPtr]::Zero)
  if($handle.IsInvalid){$handle.Dispose();throw 'REJECT'}
  $handles.Add($handle)
  $info=New-Object Crm06JournalNative+Info
  if(![Crm06JournalNative]::GetFileInformationByHandle($handle,[ref]$info) -or ($info.Attributes -band 1024) -ne 0 -or $info.Links -ne 1){throw 'REJECT'}
  return [pscustomobject]@{Handle=$handle;Info=$info}
 }
 function Identity([string]$value,$opened){
  $fileId=('{0:X8}{1:X8}' -f $opened.Info.IndexHigh,$opened.Info.IndexLow)
  if($fileId -eq '0000000000000000'){throw 'REJECT'}
  return [ordered]@{path=$value;exists=$true;volumeSerial=('{0:X8}' -f $opened.Info.Volume);fileId=$fileId;linkCount=[int]$opened.Info.Links;reparse=$false}
 }
 function Secure-Metadata([string]$value,[bool]$directory,[bool]$mustProtected){
  $opened=Open-Metadata $value
  if((($opened.Info.Attributes -band 16) -ne 0) -ne $directory){throw 'REJECT'}
  $bytes=[Crm06JournalNative]::Security($opened.Handle)
  $descriptor=[Security.AccessControl.RawSecurityDescriptor]::new($bytes,0)
  $actualOwner=$descriptor.Owner.Value
  $protected=($descriptor.ControlFlags -band [Security.AccessControl.ControlFlags]::DiscretionaryAclProtected) -ne 0
  if($actualOwner -notin @($OwnerSid,'S-1-5-18') -or ($mustProtected -and !$protected) -or $null -eq $descriptor.DiscretionaryAcl -or $descriptor.DiscretionaryAcl.Count -eq 0){throw 'REJECT'}
  foreach($ace in $descriptor.DiscretionaryAcl){
   if($ace -isnot [Security.AccessControl.QualifiedAce] -or $ace.IsCallback){throw 'REJECT'}
   # Reject inherited, inherit-only and explicit foreign writable grants.
   if($ace.AceQualifier -eq [Security.AccessControl.AceQualifier]::AccessAllowed -and $ace.SecurityIdentifier.Value -notin @($OwnerSid,'S-1-5-18') -and ([long]$ace.AccessMask -band 0x500D0156) -ne 0){throw 'REJECT'}
   # The refresh metadata is private too: foreign read-only Allow ACEs also
   # reject, even when the journal inherits them instead of an explicit ACE.
   if($ace.AceQualifier -eq [Security.AccessControl.AceQualifier]::AccessAllowed -and $ace.SecurityIdentifier.Value -notin @($OwnerSid,'S-1-5-18')){throw 'REJECT'}
  }
  $id=Identity $value $opened
  return [ordered]@{path=$value;ownerSid=$actualOwner;daclProtected=$protected;foreignWritable=$false;foreignAllowed=$false;volumeSerial=$id.volumeSerial;fileId=$id.fileId;linkCount=$id.linkCount;reparse=$false;directory=$directory}
 }
 $phase='ANCESTORS'
 Validate-Path $target
 foreach($value in @($target)+$excluded){Validate-Path $value;Check-Ancestors $value}
 $phase='PARENT_ACL'
 $parent=$actorRoot
 if($null -eq (Attributes $parent)){$parent='C:\Sirket\CRM\runtime'}
 if($null -eq (Attributes $parent)){throw 'REJECT'}
 $parentEvidence=Secure-Metadata $parent $true $true
 $phase='TARGET'
 $journal=$null;$status='PREPARE_REQUIRED'
 if($null -ne (Attributes $target)){$journal=Secure-Metadata $target $false $false;$status='READY'}
 $phase='REFERENCES'
 $references=@()
 foreach($value in $excluded){
  if($null -eq (Attributes $value)){$references+=([ordered]@{path=$value;exists=$false;volumeSerial=$null;fileId=$null;linkCount=$null;reparse=$false})}
  else{$opened=Open-Metadata $value;if(($opened.Info.Attributes -band 16) -ne 0){throw 'REJECT'};$references+=(Identity $value $opened)}
 }
 if($journal){foreach($ref in $references){if($ref.exists -and $ref.volumeSerial -ceq $journal.volumeSerial -and $ref.fileId -ceq $journal.fileId){throw 'REJECT'}}}
 # Reopen each existing path while the original read-only handle is retained.
 # Rename/delete/write sharing was not granted; validate identity again rather
 # than trusting a path-only ACL or an earlier GetFileAttributes snapshot.
 $phase='RECHECK'
 foreach($entry in @($parentEvidence)+@($journal)+$references){
  if($null -eq $entry){continue}
  if($entry.Contains('exists') -and !$entry.exists){if($null -ne (Attributes $entry.path)){throw 'REJECT'};continue}
  Check-Ancestors $entry.path;$again=Identity $entry.path (Open-Metadata $entry.path)
  if($again.volumeSerial -cne $entry.volumeSerial -or $again.fileId -cne $entry.fileId){throw 'REJECT'}
 }
 if($status -eq 'PREPARE_REQUIRED' -and $null -ne (Attributes $target)){throw 'REJECT'}
 $phase='RESULT'
 $refText=''
 foreach($ref in $references){$exists=if($ref.exists){'1'}else{'0'};$refText+=$ref.path.ToLowerInvariant()+"`n"+$exists+"`n"+$ref.volumeSerial+"`n"+$ref.fileId+"`n"+$ref.linkCount+"`n"}
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$referenceHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($refText)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 $evidence=[ordered]@{schemaVersion='crm06-staff-journal-physical.v1';status=$status;path=$target;actorRoot=$actorRoot;callerSid=$OwnerSid;ancestorReparse=$false;parent=$parentEvidence;journal=$journal;references=$references;referenceSha256=$referenceHash}
 [Console]::Out.Write(($evidence|ConvertTo-Json -Depth 8 -Compress))
} catch {[Console]::Error.Write('CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:'+$phase);exit 1}
finally {foreach($handle in $handles){$handle.Dispose()}}
