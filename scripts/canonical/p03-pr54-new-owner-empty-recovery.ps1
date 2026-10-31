param(
 [ValidateSet('Inspect','Drain')][string]$Action='Inspect',
 [Parameter(Mandatory=$true)][string]$ProfilePath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ClaimSha256
)
# Root-operated finite NEW-owner drain. Original engine functions are imported
# unchanged; neither its dispatcher nor its journal/rollback actions run here.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018'
$engineSha='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'
function Require-NewDrain($condition,[string]$code){if(-not$condition){throw ('P03_NEW_DRAIN_'+$code)}}
# Functions-only CurrentB007 reuse. The legacy standalone dispatcher is unchanged.
function Assert-CurrentB007RecoverySettings($profile,$oldSettings,$newSettings){
 $owner='S-1-5-21-2170750028-1005938530-2568122015-1001';$runtime='C:\Sirket\ERP\runtime\terminal-completion-logon'
 Require-NewDrain ($profile.oldSettings.path -ceq ($runtime+'\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json') -and $profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.newSettings.path -ceq ($runtime+'\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json') -and $profile.newSettings.sha256 -ceq '800329af39652d7fcf111a2b8441d7a00cb0bef94b37668e2ed261e4324ba329') 'CURRENT_SETTINGS_REFS'
 foreach($settings in @($oldSettings,$newSettings)){Require-NewDrain ($settings.ownerSid -ceq $owner -and $settings.database -ceq 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -and $settings.copyId -ceq 'e16b70f0-4057-428b-9abc-6bbcaf35fe82' -and $settings.actualT1 -ceq $false -and (@($settings.components.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'crm|erpApiNative|hub|nativeOrder' -and $settings.node.path -ceq 'C:\Sirket\ERP\tools\node-v24.19.0\node.exe' -and $settings.node.sha256 -ceq '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237') 'CURRENT_SETTINGS_SCOPE'}
 $fixed=@(
 @($oldSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae','e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),
 @($oldSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a','13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'),
 @($oldSettings.components.crm,'C:\Sirket\CRM\releases\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),
 @($oldSettings.components.nativeOrder,'C:\Sirket\ERP\releases\CRM-ORDER-DRAFT-TEST-20261013-7a41f64','7a41f6492273dd1ec0bcb086f820be5575372be8','6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'),
 @($newSettings.components.erpApiNative,'C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261020-6dc33f41','6dc33f41737349c6e3f17fb867a451b570a00acc','6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49'),
 @($newSettings.components.crm,'C:\Sirket\CRM\releases\node-v24.19.0\crm-shared-test-d1e4425206249e38445fb103e03601f86baa84ec','d1e4425206249e38445fb103e03601f86baa84ec','a0e86fccbdb95eeb97e4dc08e383db7bf8f12a29b040f34a78f6c37e3093b5ef'),
 @($newSettings.supervisor,'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-da5b39491994','da5b394919941f73b9d7098f146fffd362c2a955','b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf')
 )
 Require-NewDrain (@($profile.packages).Count -eq 7 -and @($profile.packages.root|Select-Object -Unique).Count -eq 7) 'CURRENT_PACKAGE_COUNT'
 foreach($f in $fixed){Require-NewDrain ($f[0].packageRoot -ceq $f[1] -and $f[0].sourceCommit -ceq $f[2] -and $f[0].manifestSha256 -ceq $f[3] -and @($profile.packages|Where-Object{$_.root -ceq $f[1] -and $_.sourceCommit -ceq $f[2] -and $_.manifestSha256 -ceq $f[3] -and $_.manifestPath -ceq ($f[1]+'\release-manifest.json')}).Count -eq 1) 'CURRENT_PACKAGE_BINDING'}
 Require-NewDrain (($oldSettings.components.nativeOrder|ConvertTo-Json -Depth 20 -Compress) -ceq ($newSettings.components.nativeOrder|ConvertTo-Json -Depth 20 -Compress)) 'CURRENT_NATIVE_RETAINED'
 foreach($key in @('packageRoot','sourceCommit','manifestSha256')){Require-NewDrain ($oldSettings.components.hub.$key -ceq $oldSettings.components.erpApiNative.$key -and $newSettings.components.hub.$key -ceq $newSettings.components.erpApiNative.$key) 'CURRENT_HUB_BINDING'}
 Require-NewDrain ($oldSettings.components.crm.config.path -ceq ($runtime+'\crm-activation-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json') -and $oldSettings.components.crm.config.sha256 -ceq '9b484883f89584225bcd5242b7f501a38feb6a1bbaa22d8a8e17accf302785ab' -and $newSettings.components.crm.config.path -ceq ($runtime+'\crm-activation-crm06-staff-d1e442520624-erp-6dc33f417373-current.json') -and $newSettings.components.crm.config.sha256 -ceq '0ef6eb422be2522743753d2b2d9f24f3cbf5c6a3d8b45a904540478e112a3449') 'CURRENT_ACTIVATION'
}
function Read-NewDrainEngine{
 Require-NewDrain ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-ceq$owner) 'OWNER'
 Require-NewDrain ([IO.Path]::GetFullPath($EnginePath)-ceq$EnginePath-and$EnginePath.StartsWith($base+'\',[StringComparison]::Ordinal)-and[IO.Path]::GetFileName($EnginePath)-ceq'p03-physical-rollback.ps1') 'ENGINE_PATH'
 for($p=$EnginePath;$p;$p=[IO.Path]::GetDirectoryName($p)){Require-NewDrain (-not((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)) 'REPARSE'}
 $acl=Get-Acl -LiteralPath $EnginePath;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 Require-NewDrain ($acl.AreAccessRulesProtected-and$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-ceq$owner-and$rules.Count-eq2) 'ENGINE_ACL'
 foreach($sid in @($owner,'S-1-5-18')){Require-NewDrain (@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-eq1) 'ENGINE_ACL'}
 $bytes=[IO.File]::ReadAllBytes($EnginePath);$digest=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
 Require-NewDrain ($digest-ceq$engineSha) 'ENGINE_HASH'
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($bytes),[ref]$tokens,[ref]$errors)
 Require-NewDrain ($errors.Count-eq0) 'ENGINE_PARSE'
 $defs=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]},$false));Require-NewDrain ($defs.Count-gt20-and@($defs.Name|Sort-Object -Unique).Count-eq$defs.Count) 'ENGINE_FUNCTIONS'
 foreach($d in $defs){. ([scriptblock]::Create('function script:'+$d.Name+$d.Extent.Text.Substring(('function '+$d.Name).Length)))}
}
function Assert-NewDrainPins{
 [void](ReadPinned $ProfilePath $ProfileSha256);[void](ReadPinned $BeforeImagePath $BeforeImageSha256);[void](ReadPinned $claimPath $ClaimSha256)
 [void](ReadPinned $profile.newSettings.path $profile.newSettings.sha256);[void](ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);[void](ReadPinned $EnginePath $engineSha)
 TaskPhase 'new';Require-NewDrain (@(Get-ChildItem -LiteralPath $profile.journalDirectory -Force).Count-eq0) 'ENGINE_RECOVERY_NOT_EMPTY'
}
function Assert-NewDrainOldAbsent($inventory){
 [void](AssertOldPidLifetimes $inventory)
}
function Save-NewDrain([string]$file,$value){
 NoReparse ([IO.Path]::GetDirectoryName($file));Require-NewDrain (-not(Test-Path -LiteralPath $file)) 'OUTPUT_EXISTS'
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 18 -Compress));$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
 $stream=New-Object IO.FileStream($file,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()};$digest=Hash $bytes;[void](ReadPinned $file $digest);return [ordered]@{path=$file;sha256=$digest}
}
function Record-NewDrain([string]$event,$identity=$null){
 Require-NewDrain ($event-cin@('NEW_DRAIN_INTENT','NEW_COM_STOP_INTENT','NEW_COM_STOPPED','NEW_EXACT_STOP_INTENT','NEW_EXACT_STOPPED','NEW_ALREADY_ABSENT','NEW_DRAIN_EMPTY','NEW_DRAIN_FAILED')) 'EVENT'
 $row=[ordered]@{sequence=$script:newSequence;previousSha256=$script:newPrevious;event=$event;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;claimSha256=$ClaimSha256;observedAt=[DateTime]::UtcNow.ToString('o');identity=$identity}
 $ref=Save-NewDrain (Join-Path $script:newOutput ('event-'+$script:newSequence.ToString('0000')+'.json')) $row;$script:newSequence++;$script:newPrevious=$ref.sha256;return $ref
}
function Read-NewDrainReceipt([string]$role,[string]$file){
 $bytes=[IO.File]::ReadAllBytes($file);$ref=[ordered]@{role=$role;path=$file;sha256=(Hash $bytes)};[void](ReadPinned $file $ref.sha256);return $ref
}
function Capture-NewDrainCandidate{
 Assert-NewDrainPins;$raw=Inventory;ProtectedProcesses $raw;Assert-NewDrainOldAbsent $raw
 $roles=@('coreSupervisor','terminalWatcher','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer');$selected=@();$receipts=@()
 foreach($rule in $profile.candidateRules){VerifyRule $rule;$rows=@($raw.all|Where-Object{$_.ExecutablePath-ceq$rule.nodePath-and((Tokens $_.CommandLine)|ConvertTo-Json -Compress)-ceq((Tokens $rule.commandLine)|ConvertTo-Json -Compress)})
  if($rule.role-cin@('hub','hubWatcher')){Require-NewDrain ($rows.Count-eq0) 'UNEXPECTED_HUB';continue}
  if($rows.Count-eq0){continue}
  Require-NewDrain ($rule.role-cin$roles-and$rows.Count-eq1) 'CURRENT_ROLE_COUNT';$p=$rows[0];$sid=Invoke-CimMethod $p -MethodName GetOwnerSid -ErrorAction Stop
  Require-NewDrain ($sid.ReturnValue-eq0-and$sid.Sid-ceq$owner) 'CURRENT_OWNER'
  $selected+=,[pscustomobject]@{role=$rule.role;pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=[string]$p.ExecutablePath;ownerSid=$owner;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');bindings=@($raw.listeners|Where-Object{$_.OwningProcess-eq$p.ProcessId}|ForEach-Object{[pscustomobject]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress}})}
  if($null-ne$rule.receipt){$receipts+=,(Read-NewDrainReceipt $rule.role $rule.receipt.path)}
 }
 Require-NewDrain (($selected.Count-eq0-and$raw.instances.Count-eq0-and$raw.listeners.Count-eq0)-or($selected.Count-eq8-and@($selected.role|Sort-Object -Unique).Count-eq8-and$receipts.Count-eq6)) 'CURRENT_EIGHT'
 return [pscustomobject]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=$selected;receipts=$receipts}
}
function Current-NewDrainFrame{
 Assert-NewDrainPins;$frame=CandidateInventory $script:newEvidence;Assert-NewDrainOldAbsent $frame.inventory
 foreach($pidValue in $script:newGone){Require-NewDrain (@($frame.inventory.all|Where-Object{$_.ProcessId-eq$pidValue}).Count-eq0) 'GONE_PID_REAPPEARED'}
 if($null-ne$script:newCoreHandle){Require-NewDrain ($script:newCoreHandle.Id-eq$script:newCore.pid-and$script:newCoreHandle.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')-ceq[DateTime]::Parse($script:newCore.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'HELD_CORE_IDENTITY'}
 return $frame
}
function Stop-NewDrainExact($identity){
 $frame=Current-NewDrainFrame;$rows=@($frame.selected|Where-Object{$_.pid-eq$identity.pid})
 if($rows.Count-eq0){Require-NewDrain (@($frame.inventory.all|Where-Object{$_.ProcessId-eq$identity.pid}).Count-eq0) 'ABSENCE';$script:newGone+=,[int]$identity.pid;[void](Record-NewDrain 'NEW_ALREADY_ABSENT' $identity);return}
 Require-NewDrain ($rows.Count-eq1-and(Identity (@($frame.inventory.all|Where-Object{$_.ProcessId-eq$identity.pid})[0]) $identity)) 'EXACT_IDENTITY'
 [void](ReadPinned $profile.stopper.path '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d');[void](Record-NewDrain 'NEW_EXACT_STOP_INTENT' $identity)
 Invoke-NewDrainStopper $identity
 $after=Inventory;ProtectedProcesses $after;Assert-NewDrainOldAbsent $after;Require-NewDrain (@($after.all|Where-Object{$_.ProcessId-eq$identity.pid}).Count-eq0) 'STOP_NOT_ABSENT'
 $script:newGone+=,[int]$identity.pid;[void](Record-NewDrain 'NEW_EXACT_STOPPED' $identity)
}
function Invoke-NewDrainStopper($identity){
 $proof=[ordered]@{pid=$identity.pid;parentPid=$identity.parentPid;nodePath=$identity.nodePath;ownerSid=$identity.ownerSid;commandLine=$identity.commandLine;creationTime=[DateTime]::Parse($identity.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')}
 $out=& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -File $profile.stopper.path -ExpectedJsonBase64 ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($proof|ConvertTo-Json -Compress))))
 Require-NewDrain ($LASTEXITCODE-eq0-and[string]$out-cin@('EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE')) 'STOP_RESULT'
}
function Hold-NewDrainCore($identity){
 $held=[Diagnostics.Process]::GetProcessById($identity.pid);[void]$held.Handle
 try{Require-NewDrain (-not$held.HasExited-and$held.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')-ceq[DateTime]::Parse($identity.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'CORE_LIFETIME';return $held}catch{$held.Dispose();throw}
}
function Open-NewDrainOutput{
 $script:newOutput=Join-Path $transitionDir ('new-owner-empty-recovery-'+[guid]::NewGuid().ToString('N'));NoReparse $transitionDir;Require-NewDrain (-not(Test-Path -LiteralPath $script:newOutput)) 'OUTPUT_EXISTS'
 $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false);foreach($sid in @($owner,'S-1-5-18')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($script:newOutput,$acl);Protected $script:newOutput
 $script:newSequence=0;$script:newPrevious=$BeforeImageSha256;$inputRef=Save-NewDrain (Join-Path $script:newOutput 'admitted-new-candidate.json') $script:newEvidence;[void](Record-NewDrain 'NEW_DRAIN_INTENT' $inputRef)
}
function Wait-NewDrainCoreQuiet{
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{$frame=Current-NewDrainFrame;Require-NewDrain ($script:newCoreHandle.HasExited-and@($frame.inventory.all|Where-Object{$_.ProcessId-eq$script:newCore.pid}).Count-eq0) 'CORE_REAPPEARED'
  $parents=@($script:newCore.pid)+@($script:newEvidence.processes|Where-Object{$_.role-ceq'terminalWatcher'}|ForEach-Object{$_.pid});$known=@($script:consolePins.Values|Where-Object{$_.parentPid-in$parents})
  if(@($frame.inventory.all|Where-Object{$_.ProcessId-in@($known|ForEach-Object{$_.pid})}).Count-eq0){return};Start-Sleep -Milliseconds 250
 }while([DateTime]::UtcNow-lt$until)
 Require-NewDrain $false 'CORE_CONSOLE_NOT_ABSENT'
}
function Invoke-NewDrain{
 $script:parentPins=@{};$script:watcherPins=@{};$script:consolePins=@{};$script:tasksStopRequested=$false;$script:newGone=@();$script:newCoreHandle=$null
 $script:newEvidence=Capture-NewDrainCandidate
 if($script:newEvidence.processes.Count-eq0){
  $frame=Current-NewDrainFrame;AssertEmpty $frame.inventory;Require-NewDrain (@($names|Where-Object{[int]$folder.GetTask($_).State-ne3}).Count-eq0) 'EMPTY_TASKS'
  if($Action-ceq'Inspect'){return [ordered]@{status='NEW_OWNER_EMPTY_INSPECTED';mutationExecuted=$false;newIdentities=0;engineRecoveryExecuted=$false}}
  Open-NewDrainOutput;$zeroRef=Save-NewDrain (Join-Path $base ('MelisaERP-P03-candidate-'+[guid]::NewGuid().ToString('N')+'.json')) $script:newEvidence;$tail=Record-NewDrain 'NEW_DRAIN_EMPTY' $zeroRef
  return [ordered]@{status='NEW_OWNER_EMPTY_CANDIDATE_READY';candidateRef=$zeroRef;outerTail=$tail;mutationExecuted=$false;oldOwnerStarted=$false;engineRecoveryExecuted=$false;businessWrites=0;requiresVersionedStopNewAndRollbackOld=$true}
 }
 $script:newCore=@($script:newEvidence.processes|Where-Object{$_.role-ceq'coreSupervisor'})[0]
 $script:newCoreHandle=Hold-NewDrainCore $script:newCore
 try{
  Require-NewDrain (-not$script:newCoreHandle.HasExited-and$script:newCoreHandle.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')-ceq[DateTime]::Parse($script:newCore.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'CORE_LIFETIME'
  $admitted=Current-NewDrainFrame;Require-NewDrain ($admitted.selected.Count-eq8-and$admitted.inventory.instances.Count-eq1-and$admitted.inventory.instances[0].Name-ceq'Melisa-Terminal-Completion-Logon'-and$admitted.inventory.instances[0].Path-ceq'\Melisa-Terminal-Completion-Logon'-and[int]$admitted.inventory.instances[0].State-eq4-and-not[string]::IsNullOrWhiteSpace([string]$admitted.inventory.instances[0].InstanceGuid)-and$admitted.inventory.instances[0].EnginePID-eq(@($script:newEvidence.processes|Where-Object{$_.role-ceq'terminalWatcher'})[0].pid)) 'INITIAL_EIGHT_COM'
  if($Action-ceq'Inspect'){return [ordered]@{status='NEW_OWNER_DRAIN_INSPECTED';mutationExecuted=$false;newIdentities=8;protectedVerified=$true;liveProbesAccepted=0;engineRecoveryExecuted=$false}}
  Open-NewDrainOutput
  $com=@($admitted.inventory.instances);foreach($pin in $com){$now=Current-NewDrainFrame;$match=@($now.inventory.instances|Where-Object{$_.Name-ceq$pin.Name-and$_.Path-ceq('\'+$pin.Name)-and[string]$_.InstanceGuid-ceq[string]$pin.InstanceGuid-and$_.EnginePID-eq$pin.EnginePID-and[int]$_.State-eq4});Require-NewDrain ($match.Count-eq1) 'COM_CAS';[void](Record-NewDrain 'NEW_COM_STOP_INTENT' ([ordered]@{name=[string]$pin.Name;guid=[string]$pin.InstanceGuid;pid=[int]$pin.EnginePID}));$match[0].Stop();$script:tasksStopRequested=$true;[void](Record-NewDrain 'NEW_COM_STOPPED' ([ordered]@{name=[string]$pin.Name;guid=[string]$pin.InstanceGuid;pid=[int]$pin.EnginePID}))}
  $until=[DateTime]::UtcNow.AddSeconds(20);do{$now=Current-NewDrainFrame;if($now.inventory.instances.Count-eq0-and@($names|Where-Object{[int]$folder.GetTask($_).State-ne3}).Count-eq0){break};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow-lt$until)
  Require-NewDrain ($now.inventory.instances.Count-eq0-and@($names|Where-Object{[int]$folder.GetTask($_).State-ne3}).Count-eq0) 'COM_NOT_STOPPED'
  Stop-NewDrainExact $script:newCore
  Require-NewDrain ($script:newCoreHandle.HasExited) 'HELD_CORE_NOT_EXITED'
  Wait-NewDrainCoreQuiet
  # No new probe classification/adoption here. Original CandidateInventory
  # rejects any unexpected child or listener; captured consoles exit naturally.
  foreach($role in @('crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher')){Stop-NewDrainExact (@($script:newEvidence.processes|Where-Object{$_.role-ceq$role})[0])}
  WaitConsoleAbsence;$final=Current-NewDrainFrame;AssertEmpty $final.inventory
  Require-NewDrain ($script:newCoreHandle.HasExited-and$final.selected.Count-eq0) 'FINAL_NOT_EMPTY'
  $zero=[ordered]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=@();receipts=@()}
  $zeroRef=Save-NewDrain (Join-Path $base ('MelisaERP-P03-candidate-'+[guid]::NewGuid().ToString('N')+'.json')) $zero;$tail=Record-NewDrain 'NEW_DRAIN_EMPTY' $zeroRef
  return [ordered]@{status='NEW_OWNER_EMPTY_CANDIDATE_READY';candidateRef=$zeroRef;outerTail=$tail;mutationExecuted=$true;oldOwnerStarted=$false;engineRecoveryExecuted=$false;businessWrites=0;requiresFrozenStopNewAndRollbackOld=$true}
 }catch{if((Get-Variable newSequence -Scope Script -ErrorAction SilentlyContinue)){$code=if($_.Exception.Message-cmatch '^P03_[A-Z_]+$'){$_.Exception.Message}else{'P03_NEW_DRAIN_UNCLASSIFIED'};try{[void](Record-NewDrain 'NEW_DRAIN_FAILED' ([ordered]@{code=$code}))}catch{}};throw}finally{if($null-ne$script:newCoreHandle){$script:newCoreHandle.Dispose()}}
}

try {
Read-NewDrainEngine
$Environment='Shared';$isRehearsal=$false;$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$runRoot=$null;$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
Require-NewDrain ($ProfilePath-cmatch ('\A'+[regex]::Escape($base)+'\\MelisaERP-P03-profile-([a-f0-9]{32})\.json\z')) 'PROFILE_PATH';$runId=$Matches[1]
Require-NewDrain ($runId-cnotin@('7b0821959737f1da0427b17a7dfd4685','639e2da815e1e7ac0f1c0d04d7f7bdc3')-and$BeforeImagePath-ceq(Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json'))) 'RUN'
$profile=Json (ReadPinned $ProfilePath $ProfileSha256);$before=Json (ReadPinned $BeforeImagePath $BeforeImageSha256)
$claimPath=Join-Path $base 'p03-pr54-successor-of-7b0821959737f1da0427b17a7dfd4685.lock.json';$claim=Json (ReadPinned $claimPath $ClaimSha256)
Require-NewDrain ($claim.schemaVersion-ceq'melisa-p03-current-owner-successor-claim.v1'-and$claim.predecessorRunId-ceq'7b0821959737f1da0427b17a7dfd4685'-and$claim.successorRunId-ceq$runId-and$claim.successorProfile.path-ceq$ProfilePath-and$claim.successorProfile.sha256-ceq$ProfileSha256-and$claim.successorBefore.path-ceq$BeforeImagePath-and$claim.successorBefore.sha256-ceq$BeforeImageSha256) 'CLAIM'
Require-NewDrain ($profile.schemaVersion-ceq'melisa-p03-physical-profile.v1'-and$before.schemaVersion-ceq'melisa-p03-owner-observation.v3'-and$profile.ownerSid-ceq$owner-and$before.ownerSid-ceq$owner-and$profile.database-ceq$database-and$before.database-ceq$database-and$before.actualT1-ceq$false-and$before.copyId-ceq'e16b70f0-4057-428b-9abc-6bbcaf35fe82'-and$profile.beforeImage.path-ceq$BeforeImagePath-and$profile.beforeImage.sha256-ceq$BeforeImageSha256-and$profile.oldSettings.sha256-ceq'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'-and$profile.newSettings.sha256-ceq$claim.newSettings.sha256-and$profile.newSettings.path-ceq$claim.newSettings.path) 'SCOPE'
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
Require-NewDrain ($newSettings.ownerSid-ceq$owner-and$newSettings.database-ceq$database-and$newSettings.copyId-ceq$before.copyId-and$newSettings.actualT1-ceq$false-and$newSettings.components.erpApiNative.sourceCommit-ceq'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'-and$newSettings.components.erpApiNative.manifestSha256-ceq'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'-and$newSettings.components.crm.sourceCommit-ceq'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'-and$newSettings.supervisor.sourceCommit-ceq$claim.candidate.supervisorSource-and$newSettings.supervisor.manifestSha256-ceq$claim.candidate.supervisorManifest-and$newSettings.supervisor.packageRoot-ceq$claim.candidate.supervisorRoot) 'NEW_SOURCE'
Require-NewDrain ($profile.tasks.Count-eq2-and$profile.candidateRules.Count-eq10-and@($profile.candidateRules.role|Sort-Object -Unique).Count-eq10-and$profile.protectedProcesses.Count-gt0-and@($profile.protectedProcesses|Where-Object{$_.PSObject.Properties.Name-ccontains'kind'-and$_.kind-ceq'ProtectedSqlService'}).Count-eq1) 'PROFILE_COUNTS'
$expectedPackages=@{};foreach($settings in @($oldSettings,$newSettings)){foreach($component in @($settings.components.PSObject.Properties|ForEach-Object{$_.Value})+@($settings.supervisor)){$root=[IO.Path]::GetFullPath($component.packageRoot);if($expectedPackages.ContainsKey($root)){Require-NewDrain ($expectedPackages[$root].sourceCommit-ceq$component.sourceCommit-and$expectedPackages[$root].manifestSha256-ceq$component.manifestSha256) 'PACKAGE_CONFLICT'}else{$expectedPackages[$root]=$component}}}
Require-NewDrain ($profile.packages.Count-eq$expectedPackages.Count-and$expectedPackages.Count-eq6) 'PACKAGE_COUNT';$seen=@()
foreach($pkg in $profile.packages){$root=[IO.Path]::GetFullPath($pkg.root);Require-NewDrain ($expectedPackages.ContainsKey($root)-and$root-cnotin$seen-and$pkg.sourceCommit-ceq$expectedPackages[$root].sourceCommit-and$pkg.manifestSha256-ceq$expectedPackages[$root].manifestSha256-and$pkg.manifestPath-ceq(Join-Path $root 'release-manifest.json')) 'PACKAGE_BINDING';$seen+=,$root;NoReparse $pkg.manifestPath;$bytes=[IO.File]::ReadAllBytes($pkg.manifestPath);Require-NewDrain ((Hash $bytes)-ceq$pkg.manifestSha256) 'PACKAGE_HASH';$manifest=Json $bytes;Require-NewDrain ((PackageManifestSource $manifest $pkg)-ceq$pkg.sourceCommit-and$manifest.files.Count-gt0) 'PACKAGE_SOURCE';foreach($file in $manifest.files){$target=[IO.Path]::GetFullPath((Join-Path $root $file.path));Require-NewDrain ($target.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) 'PACKAGE_ESCAPE';NoReparse $target;Require-NewDrain ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$file.sha256) 'PACKAGE_BYTES'}}
Require-NewDrain ($profile.stopper.sha256-ceq'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'-and$profile.stopper.path-ceq(Join-Path $base ('MelisaERP-P03-stopper-'+$runId+'.ps1'))) 'STOPPER';[void](ReadPinned $profile.stopper.path $profile.stopper.sha256)
$transitionDir=Join-Path $base ('MelisaERP-P03-transition-'+$runId);Protected $transitionDir;Require-NewDrain ($profile.journalDirectory-ceq(Join-Path $base ('MelisaERP-P03-recovery-'+$runId))) 'RECOVERY_DIR';Protected $profile.journalDirectory
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
Invoke-NewDrain|ConvertTo-Json -Depth 6 -Compress
}catch{$code=if($_.Exception.Message-cmatch '^P03_(?:PHYSICAL|NEW_DRAIN)_[A-Z_]{1,80}$'){$_.Exception.Message}else{'P03_NEW_DRAIN_UNCLASSIFIED'};[Console]::Error.WriteLine($code);exit 1}
