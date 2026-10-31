param(
 [ValidateSet('Inspect','Harden')][string]$Mode='Inspect',
 [ValidateSet('Receipts','ConfigArtifacts')][string]$TargetScope='Receipts',
 [Parameter(Mandatory=$true)][string]$CandidatePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$CandidateSha256
)
$invokedAtUtc=[DateTime]::UtcNow
# A one-run metadata repair. No task/process/SQL/application action is available.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$run='7b0821959737f1da0427b17a7dfd4685'
$dir=Join-Path $base ('MelisaERP-P03-transition-'+$run)
$copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82';$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$processRoles=@('crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
$receiptRoot='C:\Sirket\ERP\runtime\terminal-completion-logon'
$receiptPaths=@{};foreach($role in $processRoles){$receiptPaths[$role]=Join-Path $receiptRoot ($role+'.json')}
$configRefs=@{
 operation=[pscustomobject]@{path=(Join-Path $receiptRoot 'operation-7a41f6492273.json');sha256='cfb6817797fe3b081aab0fa484d6aded5a44dd5dee98a5b69ffdc1c90f553fd4'}
 nativeOrder=[pscustomobject]@{path=(Join-Path $receiptRoot 'native-order-7a41f6492273.json');sha256='617f4792968e20b7b9d30e66a4e920fb6eb93b80c39a2b6fcaff3fba8b200057'}
}
$profileRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$run+'.json'));sha256='cf176e37c795f6de01353f04f4f1747499aab5f695d79519c2ecf3233b80967a'}
$beforeRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$run+'.json'));sha256='b89366ce31aa8254e8ad7c0ef2c342520b427e0dbbbf37263a68001d92ab2443'}
$originalRef=[pscustomobject]@{path=(Join-Path $base 'MelisaERP-P03-candidate-a48aca4f8e18a764ab5ea3a94016723d.json');sha256='fe4d57fb88ad89345126fd003975ce4bd483b34ac7fe707a8567ae468e92f7ef'}
$claimRef=[pscustomobject]@{path=(Join-Path $base 'p03-pr54-successor-of-639e2da815e1e7ac0f1c0d04d7f7bdc3.lock.json');sha256='23c5369ebd2657961566ded8f0417713be0ba4e2a4b3843e1d7899eda6049203'}
$failureRef=[pscustomobject]@{path=(Join-Path $dir 'event-0025.json');sha256='bd455b43c46e124ae46699f7f32bcd8bab02f67bfc146d040951f66c1a5a0760'}
$outcomeRef=[pscustomobject]@{path=(Join-Path $dir 'controller-outcome.json');sha256='7e47bd7fa12baf349783b229a6aa80c48dcb9e7231063c0c76a7c18aca3b9fe2'}
$engineRef=[pscustomobject]@{path=(Join-Path $dir 'p03-physical-rollback.ps1');sha256='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'}
function RaclNeed($condition,[string]$code){if(-not $condition){throw ('P03_RECEIPT_ACL_'+$code)}}
function RaclHash([byte[]]$bytes){return [BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}
function RaclJson([byte[]]$bytes){return [Text.UTF8Encoding]::new($false,$true).GetString($bytes)|ConvertFrom-Json -ErrorAction Stop}
function RaclNoReparse([string]$path){
 RaclNeed ([IO.Path]::IsPathRooted($path) -and [IO.Path]::GetFullPath($path) -ceq $path) 'PATH'
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){RaclNeed (((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE'}
}
function RaclAcl($acl,[ValidateSet('Inherited3','Parent3','Protected2')][string]$kind){
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 $ids=if($kind -ceq 'Protected2'){@($owner,'S-1-5-18')}else{@($owner,'S-1-5-18','S-1-5-32-544')}
 RaclNeed ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq $owner -and $rules.Count -eq $ids.Count -and $acl.AreAccessRulesProtected -eq ($kind -cne 'Inherited3')) 'ACL'
 foreach($id in $ids){RaclNeed (@($rules|Where-Object{$_.IdentityReference.Value -ceq $id -and $_.IsInherited -eq ($kind -ceq 'Inherited3') -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl}).Count -eq 1) 'ACE'}
}
function RaclReadStrict($ref){
 RaclNeed ($ref.sha256 -cmatch '\A[a-f0-9]{64}\z') 'SHA';RaclNoReparse $ref.path
 $item=Get-Item -LiteralPath $ref.path -Force;RaclNeed (-not $item.PSIsContainer -and -not $item.LinkType) 'FILE'
 RaclAcl (Get-Acl -LiteralPath $ref.path) 'Protected2'
 $stream=[IO.File]::Open($ref.path,'Open','Read','None')
 try{$bytes=RaclBytes $stream;RaclNeed ((RaclHash $bytes) -ceq $ref.sha256) 'HASH';return ,$bytes}finally{$stream.Dispose()}
}
function RaclBytes($stream){
 RaclNeed ($stream.Length -gt 0 -and $stream.Length -le 16777216) 'SIZE';$stream.Position=0
 $memory=[IO.MemoryStream]::new();try{$stream.CopyTo($memory);return ,$memory.ToArray()}finally{$memory.Dispose()}
}
function RaclImportEngine([byte[]]$bytes){
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::UTF8.GetString($bytes),[ref]$tokens,[ref]$errors);RaclNeed ($errors.Count -eq 0) 'ENGINE_PARSE'
 foreach($name in @('Need','NoReparse','Hash','Json','ReadPinned','Identity','Tokens','VerifyRule','Metadata','XmlHash','TaskPhase','RehearsalTaskAction')){
  $defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));RaclNeed ($defs.Count -eq 1) 'ENGINE_FUNCTION'
  . ([scriptblock]::Create('function script:'+$name+$defs[0].Extent.Text.Substring(('function '+$name).Length)))
 }
}
function RaclNative{
 if('P03ReceiptFileInfo' -as [type]){return}
 Add-Type -TypeDefinition @'
using System;using System.Text;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public static class P03ReceiptFileInfo {
 [StructLayout(LayoutKind.Sequential)] public struct Info { public uint Attributes,CreationLow,CreationHigh,AccessLow,AccessHigh,WriteLow,WriteHigh,Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow; }
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info info);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern uint GetFinalPathNameByHandle(SafeFileHandle h,StringBuilder p,uint size,uint flags);
}
'@
}
function RaclFileInfo($stream,[string]$path){
 RaclNative;$info=New-Object P03ReceiptFileInfo+Info
 RaclNeed ([P03ReceiptFileInfo]::GetFileInformationByHandle($stream.SafeFileHandle,[ref]$info)) 'HANDLE_INFO'
 RaclNeed ($info.Links -eq 1 -and ($info.Attributes -band 0x410) -eq 0) 'LINK_OR_DIRECTORY'
 $text=[Text.StringBuilder]::new(32768);$length=[P03ReceiptFileInfo]::GetFinalPathNameByHandle($stream.SafeFileHandle,$text,32768,0)
 RaclNeed ($length -gt 0 -and $length -lt 32768 -and $text.ToString().StartsWith('\\?\',[StringComparison]::Ordinal) -and $text.ToString().Substring(4) -ieq $path) 'HANDLE_PATH'
 return [ordered]@{volume=$info.Volume;indexHigh=$info.IndexHigh;indexLow=$info.IndexLow;links=$info.Links}
}
function RaclTargets{
 if($TargetScope -ceq 'Receipts'){return [pscustomobject]@{roles=$processRoles;paths=$receiptPaths;prefix='receipt-acl';status='RECEIPT_ACL'}}
 RaclNeed ($TargetScope -ceq 'ConfigArtifacts') 'TARGET_SCOPE'
 return [pscustomobject]@{roles=@('operation','nativeOrder');paths=@{operation=$configRefs.operation.path;nativeOrder=$configRefs.nativeOrder.path};prefix='config-acl';status='CONFIG_ACL'}
}
function RaclOpen([string]$role){
 $targets=RaclTargets;RaclNeed ($role -cin $targets.roles) 'ROLE';$path=$targets.paths[$role];RaclNoReparse $path
 # No write-data or write-owner right. All target handles stay exclusive until
 # every readback is complete; replacement and concurrent writes are blocked.
 $rights=[Security.AccessControl.FileSystemRights]::Read -bor [Security.AccessControl.FileSystemRights]::ChangePermissions
 $stream=[IO.FileStream]::new($path,[IO.FileMode]::Open,$rights,[IO.FileShare]::None,4096,[IO.FileOptions]::None)
 try{
  $id=RaclFileInfo $stream $path;$acl=$stream.GetAccessControl();RaclAcl $acl 'Inherited3';$bytes=RaclBytes $stream
  return [pscustomobject]@{role=$role;path=$path;stream=$stream;fileId=$id;sha256=(RaclHash $bytes);bytes=$bytes;sddl=$acl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)}
 }catch{$stream.Dispose();throw}
}
function RaclAssertHeld($held,[string]$kind='Inherited3'){
 RaclNoReparse $held.path;$id=RaclFileInfo $held.stream $held.path
 RaclNeed (($id|ConvertTo-Json -Compress) -ceq ($held.fileId|ConvertTo-Json -Compress) -and (RaclHash (RaclBytes $held.stream)) -ceq $held.sha256) 'HELD_CHANGED'
 RaclAcl ($held.stream.GetAccessControl()) $kind
 if($kind -ceq 'Inherited3'){RaclNeed ($held.stream.GetAccessControl().GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All) -ceq $held.sddl) 'SDDL_CHANGED'}
}
function RaclReceipt($held,$candidate,$profile){
 $value=RaclJson $held.bytes;$keys=@('run','pid','parentPid','parentCreationTime','creationTime','stage','sourceCommit','configSha256','copyId','actualT1')
 RaclNeed ((@($value.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (($keys|Sort-Object)-join '|')) 'RECEIPT_KEYS'
 $rows=@($candidate.processes|Where-Object{$_.role -ceq $held.role});$rules=@($profile.candidateRules|Where-Object{$_.role -ceq $held.role});$cores=@($candidate.processes|Where-Object{$_.role -ceq 'coreSupervisor'})
 RaclNeed ($rows.Count -eq 1 -and $rules.Count -eq 1 -and $cores.Count -eq 1) 'RECEIPT_ROLE'
 $row=$rows[0];$rule=$rules[0];$core=$cores[0]
 RaclNeed ($value.run -cmatch '\A[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\z' -and $value.stage -ceq $held.role -and $value.pid -eq $row.pid -and $value.parentPid -eq $row.parentPid -and $row.parentPid -eq $core.pid -and [DateTime]::Parse($value.creationTime).ToUniversalTime().Ticks -eq [DateTime]::Parse($row.creationTime).ToUniversalTime().Ticks -and [DateTime]::Parse($value.parentCreationTime).ToUniversalTime().Ticks -eq [DateTime]::Parse($core.creationTime).ToUniversalTime().Ticks -and [DateTime]::Parse($value.creationTime) -ge [DateTime]::Parse($value.parentCreationTime) -and $value.sourceCommit -ceq $rule.sourceCommit -and $value.configSha256 -ceq $rule.config.sha256 -and $value.copyId -ceq $copy -and $value.actualT1 -ceq $false -and $rule.receipt.path -ceq $held.path) 'RECEIPT_CONTENT'
 $refs=@($candidate.receipts|Where-Object{$_.role -ceq $held.role});RaclNeed ($refs.Count -eq 1 -and $refs[0].path -ceq $held.path -and $refs[0].sha256 -ceq $held.sha256) 'RECEIPT_HASH'
 return $true
}
function RaclConfig($held){
 # Config bytes can contain secrets. Validate only their immutable hash and
 # authenticated metadata references; never decode or emit the content.
 RaclNeed ($held.role -cin @('operation','nativeOrder')) 'CONFIG_ROLE';$expected=$configRefs[$held.role]
 RaclNeed ($held.path -ceq $expected.path -and $held.sha256 -ceq $expected.sha256) 'CONFIG_HASH'
 $component=if($held.role -ceq 'operation'){'erpApiNative'}else{'nativeOrder'}
 $private=if($held.role -ceq 'operation'){'operationConfig'}else{'nativeOrderConfig'}
 foreach($settings in @($oldSettings,$newSettings)){
  foreach($ref in @($settings.components.$component.config,$settings.privateSources.$private)){RaclNeed ($ref.path -ceq $expected.path -and $ref.sha256 -ceq $expected.sha256) 'CONFIG_SOURCE_REF'}
 }
 $boundRoles=if($held.role -ceq 'operation'){@('erpApi','erpNative','hub')}else{@('crmNativeOrder')}
 foreach($role in $boundRoles){$rules=@($profile.candidateRules|Where-Object{$_.role -ceq $role});RaclNeed ($rules.Count -eq 1 -and $rules[0].config.path -ceq $expected.path -and $rules[0].config.sha256 -ceq $expected.sha256) 'CONFIG_PROFILE_REF'}
}
function RaclSame($a,$b){
 return $a.pid -eq $b.pid -and $a.parentPid -eq $b.parentPid -and $a.ownerSid -ceq $b.ownerSid -and $a.nodePath -ceq $b.nodePath -and $a.commandLine -ceq $b.commandLine -and [DateTime]::Parse($a.creationTime).ToUniversalTime().Ticks -eq [DateTime]::Parse($b.creationTime).ToUniversalTime().Ticks
}
function RaclCandidate($candidate){
 $allRoles=@($processRoles)+@('coreSupervisor','hub','terminalWatcher','hubWatcher')
 foreach($value in @($candidate,$original)){
  RaclNeed ($value.schemaVersion -ceq 'melisa-p03-physical-candidate.v1' -and $value.profileSha256 -ceq $profileRef.sha256 -and $value.beforeSha256 -ceq $beforeRef.sha256 -and (@($value.processes.role|Sort-Object)-join '|') -ceq (($allRoles|Sort-Object)-join '|') -and @($value.processes.pid|Sort-Object -Unique).Count -eq 10) 'CANDIDATE'
 }
 # Entry admission is immutable across the bounded metadata operation. Every
 # mutation still obtains a new complete physical CAS in RaclScope.
 $age=($invokedAtUtc-[DateTime]::Parse($candidate.observedAt).ToUniversalTime()).TotalSeconds
 RaclNeed ($age -ge 0 -and $age -lt 60 -and [DateTime]::Parse($candidate.observedAt) -ge [DateTime]::Parse($original.observedAt)) 'FRESH'
 foreach($row in $candidate.processes){$pins=@($original.processes|Where-Object{$_.role -ceq $row.role});RaclNeed ($pins.Count -eq 1 -and (RaclSame $row $pins[0])) 'GENERATION'}
}
function RaclKernel($row){
 $kernel=[Diagnostics.Process]::GetProcessById([int]$row.pid)
 try{RaclNeed (-not $kernel.HasExited -and $kernel.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ') -ceq [DateTime]::Parse($row.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'KERNEL_BIRTH'}finally{$kernel.Dispose()}
}
function RaclOutcome($outcome){
 RaclNeed ($outcome.status -ceq 'QUARANTINED_REQUIRES_ROOT_INSPECTION' -and $outcome.failedPhase -ceq 'READBACK' -and $outcome.recoveryReason -ceq 'P03_PHYSICAL_ACL') 'OUTCOME'
}
function RaclAuthority{
 foreach($ref in @($profileRef,$beforeRef,$originalRef,$claimRef,$engineRef)){[void](RaclReadStrict $ref)}
 RaclOutcome (RaclJson (RaclReadStrict $outcomeRef))
 $claim=RaclJson (RaclReadStrict $claimRef)
 RaclNeed ($claim.schemaVersion -ceq 'melisa-p03-owner-successor-claim.v1' -and $claim.predecessorRunId -ceq '639e2da815e1e7ac0f1c0d04d7f7bdc3' -and $claim.successorRunId -ceq $run -and $claim.successorProfile.path -ceq $profileRef.path -and $claim.successorProfile.sha256 -ceq $profileRef.sha256 -and $claim.successorBefore.path -ceq $beforeRef.path -and $claim.successorBefore.sha256 -ceq $beforeRef.sha256 -and $claim.engineSha256 -ceq $engineRef.sha256) 'CLAIM'
 $events=@(Get-ChildItem -LiteralPath $dir -File|Where-Object{$_.Name -match '^event-'}|Sort-Object Name)
 RaclNeed (($events.Name -join '|') -ceq ((0..25|ForEach-Object{'event-'+$_.ToString('0000')+'.json'})-join '|')) 'JOURNAL_SCOPE'
 $next=$failureRef.sha256
 for($n=25;$n -ge 0;$n--){$path=Join-Path $dir ('event-'+$n.ToString('0000')+'.json');$record=RaclJson (RaclReadStrict ([pscustomobject]@{path=$path;sha256=$next}));RaclNeed ($record.sequence -eq $n -and $record.profileSha256 -ceq $profileRef.sha256 -and $record.beforeSha256 -ceq $beforeRef.sha256) 'JOURNAL_HEADER';if($n-eq25){RaclNeed ($record.event -ceq 'FAILED' -and $record.target -ceq 'READBACK') 'FAILED_READBACK'};$next=$record.previousSha256}
 RaclNeed ($next -ceq $beforeRef.sha256 -and @(Get-ChildItem -LiteralPath $profile.journalDirectory -Force).Count -eq 0) 'RECOVERY_OR_TAIL'
 RaclNeed ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $before.runId -ceq $run -and $before.ownerSid -ceq $owner -and $profile.ownerSid -ceq $owner -and $before.database -ceq $database -and $profile.database -ceq $database -and $before.copyId -ceq $copy -and $before.actualT1 -ceq $false -and $profile.beforeImage.path -ceq $beforeRef.path -and $profile.beforeImage.sha256 -ceq $beforeRef.sha256) 'SCOPE'
 RaclNeed ($profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96') 'SETTINGS'
 [void](RaclReadStrict $profile.newSettings);[void](RaclReadStrict $profile.oldSettings)
 RaclNeed ($newSettings.ownerSid -ceq $owner -and $newSettings.database -ceq $database -and $newSettings.copyId -ceq $copy -and $newSettings.actualT1 -ceq $false -and $newSettings.runtimeDirectory -ceq $receiptRoot) 'SETTINGS_SCOPE'
 foreach($pin in @(@($newSettings.components.erpApiNative,'e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),@($newSettings.components.crm,'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),@($newSettings.supervisor,'13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'))){RaclNeed ($pin[0].sourceCommit -ceq $pin[1] -and $pin[0].manifestSha256 -ceq $pin[2]) 'SOURCE'}
 $candidate=RaclJson (RaclReadStrict ([pscustomobject]@{path=$CandidatePath;sha256=$CandidateSha256}))
 RaclCandidate $candidate
 return $candidate
}
function RaclScope($held){
 $candidate=RaclAuthority
 RaclAcl (Get-Acl -LiteralPath $receiptRoot) 'Parent3'
 RaclNeed ((Get-Acl -LiteralPath $receiptRoot).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All) -ceq $script:parentSddl) 'PARENT_CHANGED'
 $allListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 $running=$schedule.GetRunningTasks(1);$instances=@();for($i=1;$i -le $running.Count;$i++){$r=$running.Item($i);if($r.Name -cin $names){$instances+=,$r}}
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 RaclNeed ($instances.Count -eq 2) 'COM_COUNT';TaskPhase 'new'
 $bindings=@{hub=@('5234|127.0.0.1','5234|192.168.1.46');erpApi=@('4184|127.0.0.1','4184|192.168.1.46');crmServer=@('62700|127.0.0.1','62700|192.168.1.46','62701|127.0.0.1');erpNative=@('4186|127.0.0.1');crmNativeOrder=@('62704|127.0.0.1');crmCatalog=@('62702|127.0.0.1');crmOrders=@('62703|127.0.0.1');coreSupervisor=@();terminalWatcher=@();hubWatcher=@()}
 RaclNeed (@($allListeners|Where-Object{$_.LocalPort -in $ports}).Count -eq 11) 'LISTENER_COUNT'
 foreach($row in $candidate.processes){
  $rule=@($profile.candidateRules|Where-Object{$_.role -ceq $row.role});RaclNeed ($rule.Count -eq 1 -and $row.ownerSid -ceq $owner) 'RULE';VerifyRule $rule[0]
  RaclNeed ($row.nodePath -ceq $rule[0].nodePath -and ((Tokens $row.commandLine)|ConvertTo-Json -Compress) -ceq ((Tokens $rule[0].commandLine)|ConvertTo-Json -Compress)) 'ARGV'
  $actual=@($all|Where-Object{$_.ProcessId -eq $row.pid});RaclNeed ($actual.Count -eq 1 -and (Identity $actual[0] $row)) 'IDENTITY'
  RaclKernel $row
  $actualBindings=@($allListeners|Where-Object{$_.OwningProcess -eq $row.pid});$expected=@($bindings[$row.role]);RaclNeed ($actualBindings.Count -eq $expected.Count -and @($row.bindings).Count -eq $expected.Count) 'BINDING_COUNT'
  foreach($pair in $expected){$p=$pair.Split('|');RaclNeed (@($actualBindings|Where-Object{$_.LocalPort -eq [int]$p[0] -and $_.LocalAddress -ceq $p[1]}).Count -eq 1 -and @($row.bindings|Where-Object{$_.port -eq [int]$p[0] -and $_.address -ceq $p[1]}).Count -eq 1) 'BINDING'}
  if($row.role -cin @('terminalWatcher','hubWatcher')){$taskName=$rule[0].taskName;$task=$folder.GetTask($taskName);RaclNeed ([int]$task.State -eq 4 -and @($instances|Where-Object{$_.Name -ceq $taskName -and $_.EnginePID -eq $row.pid -and $_.State -eq 4}).Count -eq 1) 'COM_IDENTITY'}
 }
 $oldPids=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{$_.pid});RaclNeed (@($all|Where-Object{$_.ProcessId -in $oldPids}).Count -eq 0) 'OLD_GENERATION'
 foreach($file in $held){if($TargetScope -ceq 'Receipts'){[void](RaclReceipt $file $candidate $profile);[void](RaclReceipt $file $original $profile)}else{RaclConfig $file}}
 return [ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');processCount=10;comCount=2;bindingCount=11;rawProcessCount=$all.Count;fullInstallAdmission=$false}
}
function RaclWriteEvidence([string]$leaf,$value){
 $targets=RaclTargets;$prefix=$targets.prefix
 RaclNeed ($leaf -cin @(($prefix+'-before.json'),($prefix+'-result.json'),($prefix+'-failed.json')) -or $leaf -cin @($targets.roles|ForEach-Object{$prefix+'-file-'+$_+'.json'})) 'WRITE_SCOPE'
 $path=Join-Path $dir $leaf;RaclNoReparse $dir;RaclAcl (Get-Acl -LiteralPath $dir) 'Protected2'
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 14 -Compress));$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($id in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow'))}
 $stream=[IO.FileStream]::new($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 $ref=[ordered]@{path=$path;sha256=(RaclHash $bytes)};[void](RaclReadStrict $ref);return $ref
}
function RaclHarden($held){
 RaclAssertHeld $held
 # Preserve the already verified owner. Only DACL is modified, so the open
 # handle needs CHANGE_PERMISSIONS, never WRITE_OWNER or WRITE_DATA.
 $acl=$held.stream.GetAccessControl();$acl.SetAccessRuleProtection($true,$false)
 foreach($id in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow'))}
 $held.stream.SetAccessControl($acl);RaclAssertHeld $held 'Protected2'
 return [ordered]@{role=$held.role;path=$held.path;fileId=$held.fileId;sha256=$held.sha256;sddl=$held.stream.GetAccessControl().GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All);contentUnchanged=$true;aclOnly=$true}
}
function RaclRun{
 $targets=RaclTargets;$targetRoles=@($targets.roles);$prefix=$targets.prefix;$status=$targets.status
 $held=@();$beforeEvidence=$null;$results=@();$finished=@();$mutationAttempted=$false
 try{
  foreach($role in $targetRoles){$held+=,(RaclOpen $role)}
  $scope=RaclScope $held;foreach($file in $held){RaclAssertHeld $file}
  if($Mode -ceq 'Inspect'){return [ordered]@{status=($status+'_INSPECTED');mutationExecuted=$false;files=@($held|ForEach-Object{[ordered]@{role=$_.role;path=$_.path;fileId=$_.fileId;sha256=$_.sha256}});scope=$scope}}
  foreach($leaf in @(($prefix+'-before.json'),($prefix+'-result.json'),($prefix+'-failed.json'))+@($targetRoles|ForEach-Object{$prefix+'-file-'+$_+'.json'})){RaclNeed (-not (Test-Path -LiteralPath (Join-Path $dir $leaf))) 'ONCE'}
  $beforeEvidence=RaclWriteEvidence ($prefix+'-before.json') ([ordered]@{status=($status+'_HARDEN_INTENT');run=$run;profile=$profileRef;before=$beforeRef;candidate=[ordered]@{path=$CandidatePath;sha256=$CandidateSha256};original=$originalRef;claim=$claimRef;failed=$failureRef;outcome=$outcomeRef;scope=$scope;files=@($held|ForEach-Object{[ordered]@{role=$_.role;path=$_.path;fileId=$_.fileId;sha256=$_.sha256;sddl=$_.sddl}})})
  foreach($file in $held){
   [void](RaclScope $held);foreach($check in $held){RaclAssertHeld $check $(if($check.role -cin $finished){'Protected2'}else{'Inherited3'})}
   $mutationAttempted=$true;$result=RaclHarden $file;$results+=,(RaclWriteEvidence ($prefix+'-file-'+$file.role+'.json') $result);$finished+=,$file.role
  }
  [void](RaclScope $held);foreach($file in $held){RaclAssertHeld $file 'Protected2'}
  $value=[ordered]@{status=($status+'_HARDENED');run=$run;beforeEvidence=$beforeEvidence;readbacks=$results;files=$targetRoles.Count;contentUnchanged=$true;parentUnchanged=$true;aclOnly=$true;mutationExecuted=$true;processMutationExecuted=$false;fullInstallAdmission=$false;observedAt=[DateTime]::UtcNow.ToString('o')}
  $resultRef=RaclWriteEvidence ($prefix+'-result.json') $value;$value['resultRef']=$resultRef;return $value
 }catch{
  if($null -ne $beforeEvidence){$safe=[regex]::Match($_.Exception.Message,'\AP03_RECEIPT_ACL_[A-Z_]+\z').Value;if(-not $safe){$safe='P03_RECEIPT_ACL_UNCLASSIFIED'};[void](RaclWriteEvidence ($prefix+'-failed.json') ([ordered]@{status=($status+'_INCOMPLETE');beforeEvidence=$beforeEvidence;readbacks=$results;completedRoles=$finished;aclMutationAttempted=$mutationAttempted;reason=$safe;processMutationExecuted=$false;fullInstallAdmission=$false}))}
  throw
 }finally{foreach($file in $held){$file.stream.Dispose()}}
}
RaclNeed ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ceq $owner) 'OWNER'
RaclNeed ($CandidatePath -cmatch ('\A'+[regex]::Escape($base)+'\\MelisaERP-P03-candidate-[a-f0-9]{32}\.json\z') -and $CandidatePath -cne $originalRef.path) 'CANDIDATE_PATH'
RaclImportEngine (RaclReadStrict $engineRef)
$profile=RaclJson (RaclReadStrict $profileRef);$before=RaclJson (RaclReadStrict $beforeRef);$original=RaclJson (RaclReadStrict $originalRef)
$oldSettings=RaclJson (RaclReadStrict $profile.oldSettings);$newSettings=RaclJson (RaclReadStrict $profile.newSettings)
$Environment='Shared';$isRehearsal=$false;$script:tasksStopRequested=$false
$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
RaclAcl (Get-Acl -LiteralPath $receiptRoot) 'Parent3';$script:parentSddl=(Get-Acl -LiteralPath $receiptRoot).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)
RaclRun|ConvertTo-Json -Depth 16 -Compress
