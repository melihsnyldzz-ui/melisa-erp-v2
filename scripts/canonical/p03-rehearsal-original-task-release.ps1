param([ValidateSet('Inspect','ReleaseForRehearsal')][string]$Mode='Inspect')
# Finite prerequisite for a separately authorized rehearsal, not installation or recovery success.
# A successful release leaves only the two original mock task definitions absent.
# The caller must finally restore them using the independently pinned original restorer.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function ReleaseNeed($ok,[string]$code){if(-not$ok){throw ('P03_ORIGINAL_RELEASE_'+$code)}}
function ReleaseHash([byte[]]$bytes){$h=[Security.Cryptography.SHA256]::Create();try{[BitConverter]::ToString($h.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function ReleaseNoReparse([string]$path){for($p=[IO.Path]::GetFullPath($path);$p;$p=[IO.Path]::GetDirectoryName($p)){ReleaseNeed (([IO.File]::GetAttributes($p)-band[IO.FileAttributes]::ReparsePoint)-eq0) 'REPARSE'}}
function ReleasePrivate([string]$path){
 ReleaseNoReparse $path;$acl=Get-Acl -LiteralPath $path
 ReleaseNeed ($acl.AreAccessRulesProtected-and$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-ceq$script:owner-and@($acl.Access).Count-eq2) 'ACL'
 $seen=@();foreach($a in $acl.Access){$sid=$a.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;ReleaseNeed ($sid-cin@($script:owner,'S-1-5-18')-and$sid-cnotin$seen-and$a.AccessControlType-eq'Allow'-and-not$a.IsInherited-and$a.FileSystemRights-eq[Security.AccessControl.FileSystemRights]::FullControl) 'ACE';$seen+=$sid}
}
function ReadRestoreDefinitions {
 $path='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\source-p03-rehearsal-original-task-restore-8941733a63b6.ps1'
 ReleasePrivate $path;$file=Get-Item -LiteralPath $path -Force;ReleaseNeed (-not$file.LinkType-and-not$file.Target) 'SOURCE_LINK'
 $s=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
 try{$m=[IO.MemoryStream]::new();try{ReleaseNeed ($s.Length-gt0-and$s.Length-le1048576) 'SOURCE_SIZE';$s.CopyTo($m);$bytes=$m.ToArray();ReleaseNeed ((ReleaseHash $bytes)-ceq'8941733a63b6b89f53087a45284343eaf7454644e93967b296b8a241d2fa4d78') 'SOURCE_HASH';$text=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)}finally{$m.Dispose()}}finally{$s.Dispose()}
 RestoreDefinitionText $text
}
function RestoreDefinitionText([string]$text){
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors);ReleaseNeed ($errors.Count-eq0) 'SOURCE_PARSE'
 $names=@('Need','Hash','TextHash','NoReparse','ReadOriginalBefore','AssertTarget','TaskMissing','FindTask','AssertOriginalXml','ValidateBefore','DaclBytes','CompareTaskSecurity','AssertAllowEquivalent','AssertExisting','AssertQuietData','AssertQuiet','ProcessFrame','ProtectedFrame','AssertProtected','RestoreOriginalTasks')
 $definitions=@();foreach($name in $names){$f=@($ast.EndBlock.Statements|Where-Object{$_-is[Management.Automation.Language.FunctionDefinitionAst]-and$_.Name-ceq$name});ReleaseNeed ($f.Count-eq1) 'SOURCE_FUNCTION';$definitions+=$f[0].Extent.Text}
 return $definitions-join[Environment]::NewLine
}
function ReleaseFileSecurity {
 $s=[Security.AccessControl.FileSecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new($script:owner));$s.SetAccessRuleProtection($true,$false)
 foreach($sid in @($script:owner,'S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))};return $s
}
function WriteReleaseReceipt([string]$run,[int]$step,$body){
 ReleaseNeed ($run-cmatch'\A[a-f0-9]{32}\z'-and$step-ge0-and$step-le99) 'RECEIPT_SCOPE'
 $root='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018';ReleasePrivate $root
 $path=[IO.Path]::Combine($root,('original-task-release-'+$run+'-'+$step.ToString('00')+'.json'))
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($body|ConvertTo-Json -Depth 12 -Compress))
 $s=[IO.FileStream]::new($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,(ReleaseFileSecurity))
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()}
 ReleasePrivate $path;ReleaseNeed ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()-ceq(ReleaseHash $bytes)) 'RECEIPT_READBACK'
 [ordered]@{path=$path;sha256=(ReleaseHash $bytes)}
}
function ReleaseStates($folder,$before){
 $states=@();foreach($e in $before.tasks){$state='UNAVAILABLE';try{$t=FindTask $folder $e.name;if($null-eq$t){$state='ABSENT'}else{$null=AssertExisting $t $e;$state='ORIGINAL_VERIFIED'}}catch{$state='DRIFT_OR_UNAVAILABLE'};$states+=,[ordered]@{name=$e.name;status=$state}};return ,$states
}
function ReleaseGate($folder,[string]$protected){AssertQuiet $folder;AssertProtected $folder $protected}
function ReleaseOriginalTasks($folder,$before,[string]$mode){
 ReleaseNeed ($mode-cin@('Inspect','ReleaseForRehearsal')) 'MODE';ValidateBefore $before
 AssertQuiet $folder;$protected=ProtectedFrame $folder
 foreach($e in $before.tasks){$t=FindTask $folder $e.name;ReleaseNeed ($null-ne$t) 'ORIGINAL_MISSING';$null=AssertExisting $t $e}
 ReleaseGate $folder $protected
 if($mode-ceq'Inspect'){$states=ReleaseStates $folder $before;ReleaseNeed (@($states|Where-Object{$_.status-cne'ORIGINAL_VERIFIED'}).Count-eq0) 'INSPECT_READBACK';ReleaseGate $folder $protected;return [ordered]@{status='INSPECTED';finalReadback=$true;states=$states;protectedFrameSha256=$protected;mutationExecuted=$false}}
 $run=[Guid]::NewGuid().ToString('N');$step=0;$receipts=@();$deleteAttempted=$false
 try{
  $receipts+=,(WriteReleaseReceipt $run $step ([ordered]@{event='RELEASE_INTENT';environment='P03_REHEARSAL';beforeSha256='61f545642ee32ecb88a7a58a1f76a6f97e944d0400c5678ec2d89e0a9cbd2fe0';restorerSha256='8941733a63b6b89f53087a45284343eaf7454644e93967b296b8a241d2fa4d78';protectedFrameSha256=$protected;names=@($before.tasks.name)}));$step++
  foreach($e in $before.tasks){
   $fresh=ReadOriginalBefore;ValidateBefore $fresh;ReleaseNeed ((TextHash ($fresh|ConvertTo-Json -Depth 10 -Compress))-ceq(TextHash ($before|ConvertTo-Json -Depth 10 -Compress))) 'BEFORE_CAS'
   ReleaseGate $folder $protected;$t=FindTask $folder $e.name;ReleaseNeed ($null-ne$t) 'TASK_CAS_MISSING';$null=AssertExisting $t $e
   $receipts+=,(WriteReleaseReceipt $run $step ([ordered]@{event='DELETE_INTENT';name=$e.name;xmlSha256=(TextHash $e.xml);protectedFrameSha256=$protected}));$step++
   ReleaseGate $folder $protected;$t=FindTask $folder $e.name;ReleaseNeed ($null-ne$t) 'TASK_CAS_MISSING';$null=AssertExisting $t $e;AssertTarget $e.name
   $deleteAttempted=$true;$null=$folder.DeleteTask($e.name,0)
   ReleaseNeed ($null-eq(FindTask $folder $e.name)) 'DELETE_READBACK';ReleaseGate $folder $protected
   $receipts+=,(WriteReleaseReceipt $run $step ([ordered]@{event='DELETE_VERIFIED';name=$e.name;protectedFrameSha256=$protected}));$step++
  }
  ReleaseGate $folder $protected;$states=ReleaseStates $folder $before;ReleaseNeed (@($states|Where-Object{$_.status-cne'ABSENT'}).Count-eq0) 'FINAL_NOT_ABSENT'
  $receipts+=,(WriteReleaseReceipt $run $step ([ordered]@{event='RELEASED_FOR_REHEARSAL';states=$states;protectedFrameSha256=$protected;finallyRestoreRequired=$true}));$step++
  return [ordered]@{status='RELEASED_FOR_REHEARSAL';finalReadback=$true;states=$states;protectedFrameSha256=$protected;receipts=$receipts;finallyRestoreRequired=$true;mutationExecuted=$true}
 }catch{
  $recovery='NOT_NEEDED_OR_NOT_ATTEMPTED'
  if($deleteAttempted){try{ReleaseGate $folder $protected;$fresh=ReadOriginalBefore;ValidateBefore $fresh;ReleaseNeed ((TextHash ($fresh|ConvertTo-Json -Depth 10 -Compress))-ceq(TextHash ($before|ConvertTo-Json -Depth 10 -Compress))) 'RECOVERY_BEFORE_CAS';$restored=RestoreOriginalTasks $folder $fresh 'Restore';ReleaseNeed $restored.finalReadback 'RECOVERY_READBACK';ReleaseGate $folder $protected;$recovery='RESTORED_ORIGINALS_VERIFIED'}catch{$recovery='BLOCKED_OR_INCOMPLETE'}}
  $states=ReleaseStates $folder $before
  try{$receipts+=,(WriteReleaseReceipt $run $step ([ordered]@{event='RELEASE_FAILED';recovery=$recovery;states=$states;protectedFrameSha256=$protected}))}catch{}
  return [ordered]@{status='FAILED';finalReadback=$false;recovery=$recovery;states=$states;receipts=$receipts;mutationMayHaveOccurred=$deleteAttempted}
 }
}
function ReleaseMain {
 ReleaseNeed ($PSVersionTable.PSVersion.Major-eq5-and$PSVersionTable.PSEdition-ceq'Desktop'-and[Diagnostics.Process]::GetCurrentProcess().MainModule.FileName-ieq'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe') 'ENVIRONMENT'
 $script:owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 . ([scriptblock]::Create((ReadRestoreDefinitions)))
 $before=ReadOriginalBefore;ValidateBefore $before;$service=New-Object -ComObject 'Schedule.Service';$service.Connect();$folder=$service.GetFolder('\')
 ReleaseOriginalTasks $folder $before $Mode
}
try{$result=ReleaseMain;$result|ConvertTo-Json -Depth 10 -Compress;if($result.status-ceq'FAILED'){exit 1};exit 0}catch{[ordered]@{status='FAILED';code='P03_ORIGINAL_RELEASE_REJECTED';errorSha256=(ReleaseHash ([Text.UTF8Encoding]::new($false).GetBytes($_.Exception.GetType().FullName)));finalReadback=$false}|ConvertTo-Json -Compress;exit 1}
