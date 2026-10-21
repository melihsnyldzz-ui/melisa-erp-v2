param(
 [string]$PolicyGeneration='Legacy',[string]$DrainerPath,[string]$DrainerSha256,
 [ValidateSet('DryRun','Observe')][string]$Mode='Observe',
 [Parameter(Mandatory=$true)][string]$ProfilePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BeforeImageSha256,
 [Parameter(Mandatory=$true)][string]$CandidatePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$CandidateSha256,
 [Parameter(Mandatory=$true)][string]$EnginePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$EngineSha256,
 [Parameter(Mandatory=$true)][string]$RecoveryHelperPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$RecoveryHelperSha256,
 [Parameter(Mandatory=$true)][string]$SourceObserverPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceObserverSha256
)
# Explicit new-generation readback only. No engine dispatcher is executed.
if($PolicyGeneration -cnotin @('Legacy','B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){throw 'P03_B264_NEW_POLICY'}
if($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){
 if($Mode -cnotin @('DryRun','Observe') -or $EngineSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}) -or $RecoveryHelperSha256 -cne 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5' -or $SourceObserverSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){'5511027cbb98f29f39008c833ef7db25004cd9cb436acb25c7a744871df1128d'}elseif($PolicyGeneration -ceq 'B264Sup20DObserveOnly'){'5e1f89bd24ba7b1a2c8738cab3f2f29d4ec44ade96b62127d9f1367efd6143f9'}else{'5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5'}) -or $DrainerSha256 -cne $(if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){'0233887b0bbc9023efe2bc25260266c42b588479879f85213bfe4b79f408f710'}elseif($PolicyGeneration -ceq 'B264Sup20DObserveOnly'){'eb56b12fe35c3bc4c1313a7ad9b584336be8dc260a4c40dbb957347413be3cc5'}else{'34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c'}) -or [string]::IsNullOrEmpty($DrainerPath)){throw 'P03_B264_NEW_SOURCE'}
}elseif($PSBoundParameters.ContainsKey('DrainerPath') -or $PSBoundParameters.ContainsKey('DrainerSha256')){throw 'P03_B264_NEW_DRAINER_SCOPE'}
if($PolicyGeneration -ceq 'CurrentB007ObserveOnly' -and $EnginePath -cnotmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-transition-[a-f0-9]{32}\\p03-physical-rollback-lifetime-v2\.ps1\z'){throw 'P03_CURRENT_B007_ENGINE_SCOPE'}
# Separate read-only NEW observation. The frozen engine is imported only as
# function definitions. No engine PASS/event, task action or process is written.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$name+'\'+$name+'.psd1')) -ErrorAction Stop}
$invokedAtUtc=[DateTime]::UtcNow
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$engineSha=if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}elseif($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'}else{'fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_NEW_OBSERVER_OWNER'}
function NewObserverPin([string]$path,[string]$sha){
 if($sha -cnotmatch '\A[a-f0-9]{64}\z'){throw 'P03_NEW_OBSERVER_SHA'}
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'P03_NEW_OBSERVER_REPARSE'}}
 $item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.LinkType){throw 'P03_NEW_OBSERVER_FILE'}
 $acl=Get-Acl -LiteralPath $path;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or $rules.Count -ne 2){throw 'P03_NEW_OBSERVER_ACL'}
 foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and -not $_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -ne 1){throw 'P03_NEW_OBSERVER_ACL'}}
 $stream=[IO.File]::Open($path,'Open','Read','None');try{if($stream.Length -le 0 -or $stream.Length -gt 16777216){throw 'P03_NEW_OBSERVER_SIZE'};$memory=[IO.MemoryStream]::new();$stream.CopyTo($memory);$bytes=$memory.ToArray();$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant();if($actual -cne $sha){throw 'P03_NEW_OBSERVER_HASH'};return ,$bytes}finally{$stream.Dispose()}
}
function ImportNewObserverFunctions([byte[]]$bytes,[string[]]$only=@()){
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($bytes),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'P03_NEW_OBSERVER_PARSE'}
 $definitions=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst]},$false))
 if($only.Count){foreach($name in $only){if(@($definitions|Where-Object{$_.Name -ceq $name}).Count -ne 1){throw 'P03_NEW_OBSERVER_FUNCTION'}};$definitions=@($definitions|Where-Object{$_.Name -cin $only})}
 foreach($definition in $definitions){if($definition.Name -ceq 'HubLineage'){$script:newFrozenHubLineageBody=$definition.Body.Extent.Text};if($definition.Name -ceq 'CandidateInventoryCore'){$script:newFrozenCandidateInventoryBody=$definition.Body.Extent.Text};$name=if($definition.Name -ceq 'Inventory'){'NewRawInventory'}else{$definition.Name};. ([scriptblock]::Create('function script:'+$name+$definition.Extent.Text.Substring(('function '+$definition.Name).Length)))}
}
function ImportSharedObserverFunctions([byte[]]$bytes){
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($bytes),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'P03_NEW_OBSERVER_SHARED_PARSE'}
 $only=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -cmatch '\AObserver[A-Za-z]+\z'},$false)|ForEach-Object{$_.Name})
 foreach($required in @('ObserverInitializeProbePolicy','ObserverTryVanishedProbe','ObserverAssertVanishedAudits','ObserverVanishedConsole','ObserverExactNotFound','ObserverPinnedConsoleBinary')){Need (@($only|Where-Object{$_ -ceq $required}).Count -eq 1) 'NEW_SHARED_EXPORT'}
 ImportNewObserverFunctions $bytes $only
}
if($EngineSha256 -cne $engineSha){throw 'P03_NEW_OBSERVER_ENGINE'}
if($RecoveryHelperSha256 -cne 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'){throw 'P03_NEW_OBSERVER_HELPER'}
ImportNewObserverFunctions (NewObserverPin $EnginePath $engineSha)
ImportNewObserverFunctions (NewObserverPin $RecoveryHelperPath $RecoveryHelperSha256) @('ProbeArgumentsAllowed')
ImportSharedObserverFunctions (NewObserverPin $SourceObserverPath $SourceObserverSha256)
if($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){
 if(-not $DrainerPath.StartsWith($base+'\',[StringComparison]::Ordinal) -or [IO.Path]::GetFileName($DrainerPath) -cne 'p03-pr54-successor-core-drain.ps1'){throw 'P03_B264_NEW_DRAINER_PATH'}
 ImportNewObserverFunctions (NewObserverPin $DrainerPath $DrainerSha256) @($(if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){'AssertCurrentB007StaticContract'}elseif($PolicyGeneration -ceq 'B264Sup20DObserveOnly'){'AssertB264Sup20DInspectionContract'}else{'AssertB264InspectionContract'}))
}
$profile=Json (ReadPinned $ProfilePath $ProfileSha256);$before=Json (ReadPinned $BeforeImagePath $BeforeImageSha256)
$runId=$before.runId;$dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
$Environment='Shared';$isRehearsal=$false;$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
$currentReadRepair=($profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.oldSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $profile.newSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json')
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
$script:parentPins=@{};$script:watcherPins=@{};$script:consolePins=@{};$script:tasksStopRequested=$false
$script:newCandidateIdentities=$null;$script:newProbeSource=$null;$script:newProbePolicy=$null;$script:newFrameVanishedAudits=@();$script:newFrameAuditSnapshots=@()
function NewSourceBytes([string]$path,[string]$sha){
 NoReparse $path;$stream=[IO.File]::Open($path,'Open','Read','None')
 try{Need ($stream.Length -gt 0 -and $stream.Length -le 16777216) 'NEW_SOURCE_SIZE';$memory=[IO.MemoryStream]::new();$stream.CopyTo($memory);$bytes=$memory.ToArray();Need ((Hash $bytes) -ceq $sha) 'NEW_SOURCE_HASH';return ,$bytes}finally{$stream.Dispose()}
}
function NewPrepareProbeSource{
 $supervisor=$newSettings.supervisor;$root=$supervisor.packageRoot
 if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){Need ($root -ceq 'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-da5b39491994' -and $supervisor.sourceCommit -ceq 'da5b394919941f73b9d7098f146fffd362c2a955' -and $supervisor.manifestSha256 -ceq 'b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf') 'CURRENT_B007_PROBE_SCOPE'}
 if($PolicyGeneration -ceq 'B264Sup20DObserveOnly'){Need ($root -ceq 'C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-20d7e5b69696' -and $supervisor.sourceCommit -ceq '20d7e5b696969d502014ba359b950496dc530410' -and $supervisor.manifestSha256 -ceq '0959b1b84faafe2e297e537d470d6b6d443e6fac2fe30d3f2518f5b6036d1418') 'B264_SUP20D_PROBE_SCOPE'}
 $manifest=Json (NewSourceBytes (Join-Path $root 'release-manifest.json') $supervisor.manifestSha256)
 if($supervisor.sourceCommit-ceq'13bdf75a032ae8f694354a2e57b6ed382aec2f17'){
 Need ($manifest.sourceCommit -ceq '13bdf75a032ae8f694354a2e57b6ed382aec2f17' -and $manifest.sourceCommit -ceq $supervisor.sourceCommit) 'NEW_PROBE_MANIFEST'
 }elseif($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){
 if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){Need ($supervisor.sourceCommit -ceq 'da5b394919941f73b9d7098f146fffd362c2a955' -and $supervisor.manifestSha256 -ceq 'b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf' -and $manifest.sourceCommit -ceq $supervisor.sourceCommit) 'CURRENT_B007_PROBE_MANIFEST'}elseif($PolicyGeneration -ceq 'B264Sup20DObserveOnly'){Need ($supervisor.sourceCommit -ceq '20d7e5b696969d502014ba359b950496dc530410' -and $supervisor.manifestSha256 -ceq '0959b1b84faafe2e297e537d470d6b6d443e6fac2fe30d3f2518f5b6036d1418' -and $manifest.sourceCommit -ceq $supervisor.sourceCommit) 'B264_NEW_PROBE_MANIFEST'}else{Need ($supervisor.sourceCommit -ceq 'eb5b37a555cbf18e1fcaa491820707c73b354e12' -and $supervisor.manifestSha256 -ceq '1a9d7a0ba6d0ed0fa60e9044122fb895e58e725d84f194ceea255a00aece39b0' -and $manifest.sourceCommit -ceq $supervisor.sourceCommit) 'B264_NEW_PROBE_MANIFEST'}
 }else{Need ($profile.oldSettings.sha256-ceq'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'-and$profile.newSettings.path-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'-and$supervisor.sourceCommit-cmatch'^[a-f0-9]{40}$'-and$supervisor.manifestSha256-cmatch'^[a-f0-9]{64}$'-and$manifest.sourceCommit-ceq$supervisor.sourceCommit-and$supervisor.sourceCommit-ceq$before.profile.supervisorSource-and$supervisor.manifestSha256-ceq$before.profile.supervisorManifest-and$supervisor.packageRoot-ceq('C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-'+$supervisor.sourceCommit.Substring(0,12))-and$newSettings.components.erpApiNative.sourceCommit-ceq'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2'-and$newSettings.components.erpApiNative.manifestSha256-ceq'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf') 'CURRENT_NEW_PROBE_MANIFEST'}
 $files=@($manifest.files|Where-Object{$_.path -ceq 'scripts/canonical/hub-stack-process-probe.ps1'})
 Need ($files.Count -eq 1 -and $files[0].sha256 -cmatch '\A[a-f0-9]{64}\z') 'NEW_PROBE_FILE'
 $probe=Join-Path $root 'scripts\canonical\hub-stack-process-probe.ps1';[void](NewSourceBytes $probe $files[0].sha256)
 $entries=@($manifest.files|Where-Object{$_.path -ceq 'scripts/canonical/terminal-completion-logon.mjs'});Need ($entries.Count -eq 1 -and $entries[0].sha256 -cmatch '\A[a-f0-9]{64}\z') 'NEW_SUPERVISOR_ENTRY'
 [void](NewSourceBytes (Join-Path $root 'scripts\canonical\terminal-completion-logon.mjs') $entries[0].sha256)
 NoReparse $profile.shell.path;Need ($profile.shell.path -ceq 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -and (Get-FileHash -LiteralPath $profile.shell.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $profile.shell.sha256) 'NEW_PROBE_SHELL'
 $script:newProbeSource=[ordered]@{supervisorSourceCommit=$manifest.sourceCommit;supervisorManifestSha256=$supervisor.manifestSha256;supervisorEntrySha256=$entries[0].sha256;probePath=$probe;probeSha256=$files[0].sha256;shellSha256=$profile.shell.sha256;recoveryHelperSha256=$RecoveryHelperSha256}
}
function NewHubHandleInfo($stream){
 if(-not ('P03NewHubFileIdentity' -as [type])){Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public static class P03NewHubFileIdentity {
 [StructLayout(LayoutKind.Sequential)] public struct Info { public uint Attributes,CreationLow,CreationHigh,AccessLow,AccessHigh,WriteLow,WriteHigh,Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow; }
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info info);
}
'@}
 $info=New-Object P03NewHubFileIdentity+Info
 Need ([P03NewHubFileIdentity]::GetFileInformationByHandle($stream.SafeFileHandle,[ref]$info) -and ($info.Attributes -band 0x410) -eq 0) 'NEW_HUB_SHELL_FILE'
 return [ordered]@{volume=$info.Volume;indexHigh=$info.IndexHigh;indexLow=$info.IndexLow}
}
function NewHubOpenShell([string]$path){return [IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)}
function NewHubShellIdentity([string]$actual,[string]$expected){
 $canonical='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 Need ($profile.shell.path -ceq $canonical -and $expected -ceq $canonical -and [string]::Equals($actual,$canonical,[StringComparison]::OrdinalIgnoreCase)) 'NEW_HUB_SHELL_PATH'
 # The existing binary/reparse/signer policy still applies. Hold both names
 # read-only with write/delete sharing denied, then compare OS file IDs and
 # hashes from these handles, never from rewritten lineage evidence.
 foreach($path in @($actual,$expected)){ObserverPolicyBinary ([pscustomobject]@{path=$path;sha256=$profile.shell.sha256})}
 $left=$null;$right=$null
 try{
  $left=NewHubOpenShell $actual;$right=NewHubOpenShell $expected
  $a=NewHubHandleInfo $left;$b=NewHubHandleInfo $right
  Need (($a|ConvertTo-Json -Compress) -ceq ($b|ConvertTo-Json -Compress)) 'NEW_HUB_SHELL_FILE_ID'
  foreach($stream in @($left,$right)){
   Need ($stream.Length -gt 0 -and $stream.Length -le 16777216) 'NEW_HUB_SHELL_SIZE'
   $digest=[Security.Cryptography.SHA256]::Create();try{$hash=[BitConverter]::ToString($digest.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}
   Need ($hash -ceq $profile.shell.sha256) 'NEW_HUB_SHELL_HASH'
  }
 }finally{if($null -ne $right){$right.Dispose()};if($null -ne $left){$left.Dispose()}}
}
function NewHubLauncherArgsAllowed($actual,$expected){
 $canonical='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 if(@($actual).Count -ne 17 -or @($expected).Count -ne 17 -or $expected[0] -cne $canonical -or -not [string]::Equals([string]$actual[0],$canonical,[StringComparison]::OrdinalIgnoreCase)){return $false}
 for($index=1;$index -lt 17;$index++){if($actual[$index] -cne $expected[$index]){return $false}}
 NewHubShellIdentity $actual[0] $expected[0]
 return $true
}
function NewHubLineage($evidence,$expected,$inventory){
 $refs=@($evidence.receipts|Where-Object{$_.role -ceq 'hub'});Need ($refs.Count -eq 1) 'HUB_RECEIPT_COUNT'
 $ref=$refs[0];$root=Join-Path $newSettings.runtimeDirectory 'hub-web'
 Need ([IO.Path]::GetDirectoryName($ref.path) -ceq $root -and [IO.Path]::GetDirectoryName($ref.lineagePath) -ceq $root) 'HUB_RECEIPT_ROOT'
 $lineage=Json (ReadPinned $ref.lineagePath $ref.lineageSha256);$rec=Json (ReadPinned $ref.path $ref.sha256)
 $pin=$newSettings.components.hub;$watchers=@($evidence.processes|Where-Object{$_.role -ceq 'hubWatcher'});Need ($watchers.Count -eq 1) 'HUB_WATCHER_REF'
 $watcher=$watchers[0];$launcher=$lineage.launcher
 $oldPids=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{[int]$_.pid})
 Need ([int]$launcher.pid -notin $oldPids) 'HUB_OLD_LAUNCHER_PID'
 Need ($lineage.schemaVersion -eq 1 -and $lineage.run -cmatch '\A[a-f0-9]{32}\z' -and [int]$lineage.attempt -ge 0 -and [int]$lineage.attempt -le 3 -and $lineage.ownerSid -ceq $owner -and $lineage.sourceCommit -ceq $pin.sourceCommit -and $lineage.packageRoot -ceq $pin.packageRoot -and $lineage.manifestSha256 -ceq $pin.manifestSha256 -and $lineage.nodeSha256 -ceq $newSettings.node.sha256) 'HUB_LINEAGE_SOURCE'
 Need ($ref.lineagePath -ceq (Join-Path $root ('hub-web-lineage-'+$lineage.run+'-'+$lineage.attempt+'.json')) -and $ref.path -ceq (Join-Path $root ('hub-web-process-'+$lineage.run+'-'+$lineage.attempt+'.json'))) 'HUB_RECEIPT_NAMES'
 Need ($lineage.watcher.pid -eq $watcher.pid -and $lineage.watcher.birth -ceq $watcher.creationTime -and $lineage.watcher.sid -ceq $owner -and $lineage.watcher.argv -ceq $watcher.commandLine -and $launcher.parentPid -eq $watcher.pid -and $launcher.pid -eq $expected.parentPid -and $launcher.sid -ceq $owner -and [DateTime]::Parse($launcher.birth) -gt [DateTime]::Parse($watcher.creationTime)) 'HUB_LINEAGE_PARENT'
 $watcherActual=@($inventory.all|Where-Object{$_.ProcessId -eq $watcher.pid})
 Need (($watcherActual.Count -eq 1 -and (Identity $watcherActual[0] $watcher)) -or ($watcherActual.Count -eq 0 -and $script:tasksStopRequested -and $script:watcherPins.ContainsKey([int]$watcher.pid))) 'HUB_WATCHER_PHYSICAL'
 $launcherArgs=@('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',(Join-Path $pin.packageRoot 'scripts\canonical\start-hub-web.ps1'),'-StartupConfigPath',$pin.config.path,'-Action','Start','-RunId',$lineage.run,'-Attempt',[string]$lineage.attempt)
 Need (NewHubLauncherArgsAllowed (Tokens $launcher.argv) $launcherArgs) 'HUB_LAUNCHER_ARGV'
 Need ($lineage.node.pid -eq $expected.pid -and $lineage.node.birth -ceq $expected.creationTime -and $lineage.node.sid -ceq $owner -and $lineage.node.argv -ceq $expected.commandLine -and [DateTime]::Parse($expected.creationTime) -gt [DateTime]::Parse($launcher.birth)) 'HUB_NODE_LINEAGE'
 Need ($lineage.startupConfig.path -ceq $pin.config.path -and $lineage.startupConfig.sha256 -ceq $pin.config.sha256 -and $lineage.operationConfig.path -ceq $newSettings.privateSources.operationConfig.path -and $lineage.operationConfig.sha256 -ceq $newSettings.privateSources.operationConfig.sha256 -and $lineage.hubConfig.path -ceq $newSettings.privateSources.hubPinConfig.path -and $lineage.hubConfig.sha256 -ceq $newSettings.privateSources.hubPinConfig.sha256) 'HUB_CONFIG_LINEAGE'
 Need ($rec.pid -eq $expected.pid -and $rec.run -ceq $lineage.run -and $rec.attempt -eq $lineage.attempt -and $rec.sourceCommit -ceq $pin.sourceCommit -and $rec.packageRoot -ceq $pin.packageRoot -and $rec.port -eq 5234 -and $rec.lineagePath -ceq $ref.lineagePath -and $rec.lineageSha256 -ceq $ref.lineageSha256 -and $rec.startedAt -ceq $lineage.startedAt -and [DateTime]::Parse($rec.startedAt) -ge [DateTime]::Parse($expected.creationTime)) 'HUB_POINTER_LINEAGE'
 Need (@($lineage.bindings).Count -eq @($expected.bindings).Count) 'HUB_LINEAGE_BINDINGS'
 foreach($b in $expected.bindings){Need (@($lineage.bindings|Where-Object{$_.pid -eq $expected.pid -and $_.port -eq $b.port -and $_.address -ceq $b.address}).Count -eq 1) 'HUB_LINEAGE_BINDING'}
 return [DateTime]::Parse($launcher.birth).ToUniversalTime()
}
function NewAssertHubLineageEquivalence{
 $old='Need (((Tokens $launcher.argv)|ConvertTo-Json -Compress) -ceq ($launcherArgs|ConvertTo-Json -Compress)) ''HUB_LAUNCHER_ARGV'''
 $replacement='Need (NewHubLauncherArgsAllowed (Tokens $launcher.argv) $launcherArgs) ''HUB_LAUNCHER_ARGV'''
 Need ([regex]::Matches($script:newFrozenHubLineageBody,[regex]::Escape($old)).Count -eq 1) 'NEW_HUB_LINEAGE_SOURCE'
 $expected=$script:newFrozenHubLineageBody.Replace($old,$replacement).Replace("`r`n","`n").Trim()
 $definition=(Get-Command NewHubLineage -CommandType Function).ScriptBlock.Ast
 Need ($definition -is [Management.Automation.Language.FunctionDefinitionAst] -and $definition.Name -ceq 'NewHubLineage') 'NEW_HUB_LINEAGE_DEFINITION'
 $actual=$definition.Body.Extent.Text.Replace("`r`n","`n").Trim()
 Need ($actual -ceq $expected) 'NEW_HUB_LINEAGE_EQUIVALENCE'
}
function HubLineage($evidence,$expected,$inventory){return NewHubLineage $evidence $expected $inventory}
function NewHistoricalDigest($value){return Hash ([Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12 -Compress)))}
function NewHistoricalIdentity($process){
 Need ([int]$process.ProcessId -gt 0 -and [int]$process.ParentProcessId -ge 0 -and -not [string]::IsNullOrWhiteSpace($process.Name) -and -not [string]::IsNullOrWhiteSpace($process.ExecutablePath) -and -not [string]::IsNullOrWhiteSpace($process.CommandLine) -and $process.CreationDate -is [DateTime]) 'NEW_HISTORICAL_IDENTITY'
 $sid=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop
 Need ($sid.ReturnValue -eq 0 -and $sid.Sid -cmatch '\AS-1-[0-9-]+\z') 'NEW_HISTORICAL_OWNER'
 return [ordered]@{pid=[int]$process.ProcessId;parentPid=[int]$process.ParentProcessId;name=[string]$process.Name;nodePath=[string]$process.ExecutablePath;ownerSid=[string]$sid.Sid;commandLine=[string]$process.CommandLine;creationTime=$process.CreationDate.ToUniversalTime().ToString('o')}
}
function NewHistoricalOpenProcess([int]$processId){
 if(-not ('P03NewHistoricalProcess' -as [type])){Add-Type -TypeDefinition @'
using System;using System.Text;using System.ComponentModel;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public sealed class P03NewHistoricalHandle:SafeHandleZeroOrMinusOneIsInvalid {
 public P03NewHistoricalHandle():base(true){}
 protected override bool ReleaseHandle(){return P03NewHistoricalProcess.CloseHandle(handle);}
}
public static class P03NewHistoricalProcess {
 public sealed class State {public uint Id;public DateTime Birth;public string Path;public bool Running;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern P03NewHistoricalHandle OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint GetProcessId(P03NewHistoricalHandle h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(P03NewHistoricalHandle h,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll",EntryPoint="QueryFullProcessImageNameW",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageName(P03NewHistoricalHandle h,uint flags,StringBuilder path,ref uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(P03NewHistoricalHandle h,uint milliseconds);
 public static P03NewHistoricalHandle Open(uint pid){
  // QUERY_LIMITED_INFORMATION | SYNCHRONIZE; no process control/write rights.
  var h=OpenProcess(0x00101000,false,pid);if(h.IsInvalid){int error=Marshal.GetLastWin32Error();h.Dispose();throw new Win32Exception(error);}return h;
 }
 public static State Read(P03NewHistoricalHandle h){
  uint id=GetProcessId(h);long creation,exit,kernel,user;uint wait=WaitForSingleObject(h,0);
  if(id==0||wait==0xffffffff||!GetProcessTimes(h,out creation,out exit,out kernel,out user))throw new Win32Exception(Marshal.GetLastWin32Error());
  var path=new StringBuilder(32768);uint size=(uint)path.Capacity;if(!QueryFullProcessImageName(h,0,path,ref size))throw new Win32Exception(Marshal.GetLastWin32Error());
  if(wait!=0&&wait!=258)throw new InvalidOperationException("P03_HISTORICAL_WAIT");
  return new State{Id=id,Birth=DateTime.FromFileTimeUtc(creation),Path=path.ToString(),Running=wait==258};
 }
}
'@}
 Need ($processId -gt 0) 'NEW_HISTORICAL_KERNEL_PID'
 return [P03NewHistoricalProcess]::Open([uint32]$processId)
}
function NewHistoricalReadProcess($handle){
 $state=[P03NewHistoricalProcess]::Read($handle)
 return [pscustomobject]@{Id=$state.Id;StartTime=$state.Birth;HasExited=(-not $state.Running);MainModule=[pscustomobject]@{FileName=$state.Path}}
}
function NewHistoricalKernel($process,$pin){
 $state=NewHistoricalReadProcess $process
 # CIM timestamps have microsecond precision. Preserve the raw CIM UID; only
 # this kernel/CIM comparison truncates the kernel's finer 100 ns remainder.
 $format='yyyy-MM-ddTHH:mm:ss.ffffffZ';$culture=[Globalization.CultureInfo]::InvariantCulture
 Need (-not $state.HasExited -and $state.Id -eq $pin.pid -and $state.StartTime.ToUniversalTime().ToString($format,$culture) -ceq [DateTime]::Parse($pin.creationTime).ToUniversalTime().ToString($format,$culture) -and $state.MainModule.FileName -ieq $pin.nodePath) 'NEW_HISTORICAL_KERNEL'
}
function NewHistoricalFamily($inventory,[int]$processId,$evidence){
 $all=@($inventory.all);Need ($all.Count -gt 0 -and $all.Count -le 100000) 'NEW_HISTORICAL_INVENTORY'
 $map=@{};foreach($row in $all){$key=[int]$row.ProcessId;Need (-not $map.ContainsKey($key)) 'NEW_HISTORICAL_DUPLICATE';$map[$key]=$row}
 Need ($map.ContainsKey($processId)) 'NEW_HISTORICAL_MISSING'
 $family=[Collections.Generic.HashSet[int]]::new();[void]$family.Add($processId)
 do{$added=$false;foreach($row in $all){if($family.Contains([int]$row.ParentProcessId) -and $family.Add([int]$row.ProcessId)){$added=$true}};Need ($family.Count -le 256) 'NEW_HISTORICAL_FAMILY_BOUND'}while($added)
 # Only the reused PID's causal descendants need this additional proof.
 # External ancestors remain in the unfiltered inventory: the unchanged
 # namespace seeds and descendant closure still reject any managed ancestor.
 $scope=@($family|Sort-Object)
 $forbidden=@(@($evidence.processes|ForEach-Object{$_.pid})+@($profile.protectedProcesses|ForEach-Object{$_.pid})+@($inventory.instances|ForEach-Object{$_.EnginePID})+@($script:consolePins.Keys))
 $pins=@();foreach($id in $scope){
  $row=$map[[int]$id];Need ([int]$id -notin $forbidden) 'NEW_HISTORICAL_MANAGED_PID'
  Need (-not (IsWatcherCommand ([string]$row.CommandLine)) -and $row.Name -ine 'conhost.exe' -and ([string]$row.CommandLine).IndexOf($script:newProbeSource.probePath,[StringComparison]::OrdinalIgnoreCase) -lt 0) 'NEW_HISTORICAL_MANAGED_ARGV'
  foreach($pkg in $profile.packages){foreach($value in @([string]$row.CommandLine,[string]$row.ExecutablePath)){Need ($value.Replace('/','\').IndexOf(([string]$pkg.root).Replace('/','\'),[StringComparison]::OrdinalIgnoreCase) -lt 0) 'NEW_HISTORICAL_PACKAGE'}}
  Need (@($inventory.allListeners|Where-Object{$_.OwningProcess -eq $id}).Count -eq 0) 'NEW_HISTORICAL_LISTENER'
  $pin=NewHistoricalIdentity $row
  if($family.Contains([int]$id)){Need ($pin.ownerSid -ceq $owner) 'NEW_HISTORICAL_FAMILY_OWNER'}
  if([int]$id -ne $processId){Need ($map.ContainsKey([int]$row.ParentProcessId) -and $row.CreationDate.ToUniversalTime() -ge $map[[int]$row.ParentProcessId].CreationDate.ToUniversalTime()) 'NEW_HISTORICAL_EDGE'}
  # An extant historical owner in either direction is still managed. Only the
  # one demonstrated reused PID may have a different generation here.
  foreach($old in @(@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers))){if([int]$old.pid -eq [int]$id -and [int]$id -ne $processId){Need ($old.PSObject.Properties.Name -contains 'creationTime' -and [DateTime]::Parse($old.creationTime).ToUniversalTime().Ticks -ne $row.CreationDate.ToUniversalTime().Ticks) 'NEW_HISTORICAL_OLD_FAMILY'}}
  $pins+=,$pin
 }
 return @($pins|Sort-Object pid)
}
function NewHistoricalProof($process,$oldPids,$inventory,$evidence){
 $processId=[int]$process.ProcessId
 Need ($processId -in $oldPids) 'NEW_HISTORICAL_OLD_PID'
 $old=@(@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)|Where-Object{[int]$_.pid -eq $processId})
 Need ($old.Count -eq 1 -and $old[0].PSObject.Properties.Name -contains 'creationTime' -and -not [string]::IsNullOrWhiteSpace($old[0].creationTime)) 'NEW_HISTORICAL_OLD_UID'
 $oldBirth=[DateTime]::Parse($old[0].creationTime).ToUniversalTime()
 $current=NewHistoricalIdentity $process;Need ([DateTime]::Parse($current.creationTime).ToUniversalTime() -gt $oldBirth -and $current.ownerSid -ceq $owner) 'NEW_HISTORICAL_GENERATION'
 $rawFamily=@(NewHistoricalFamily $inventory $processId $evidence)
 $held=NewHistoricalOpenProcess $processId
 try{
  NewHistoricalKernel $held $current
  # Both passes are unfiltered global collections. No row is removed and no
  # unrelated process is granted an ERP owner or stop identity.
  for($pass=0;$pass -lt 2;$pass++){
   $fresh=NewRawInventory;$rows=@($fresh.all|Where-Object{$_.ProcessId -eq $processId})
   Need ($rows.Count -eq 1 -and (NewHistoricalDigest (NewHistoricalIdentity $rows[0])) -ceq (NewHistoricalDigest $current)) 'NEW_HISTORICAL_CURRENT_CAS'
   Need ($rows[0].CreationDate.ToUniversalTime() -gt $oldBirth) 'NEW_HISTORICAL_OLD_UID_PRESENT'
   $family=@(NewHistoricalFamily $fresh $processId $evidence)
   Need ((NewHistoricalDigest $family) -ceq (NewHistoricalDigest $rawFamily)) 'NEW_HISTORICAL_FAMILY_CAS'
   NewHistoricalKernel $held $current
  }
 }finally{$held.Dispose()}
 return [pscustomobject]@{audit=[ordered]@{status='UNRELATED_HISTORICAL_PID_REUSE';pid=$processId;oldUidDigest=(NewHistoricalDigest $old[0]);currentUidDigest=(NewHistoricalDigest $current);admittedOwner=$false;stopAuthority=$false};familyDigest=(NewHistoricalDigest $rawFamily);process=$process;oldPids=@($oldPids);evidence=$evidence}
}
function NewHistoricalOldPidRelevant($process,$oldPids,$inventory,$evidence){
 if([int]$process.ProcessId -notin $oldPids){return $false}
 $proof=NewHistoricalProof $process $oldPids $inventory $evidence
 $script:historicalPidReuseAudits+=,$proof.audit;$script:historicalPidReuseFrames+=,$proof
 return $false
}
function NewRevalidateHistoricalAudits{
 foreach($frame in $script:historicalPidReuseFrames){
  $fresh=NewRawInventory;$rows=@($fresh.all|Where-Object{$_.ProcessId -eq $frame.process.ProcessId});Need ($rows.Count -eq 1) 'NEW_HISTORICAL_FINAL_MISSING'
  $proof=NewHistoricalProof $rows[0] $frame.oldPids $fresh $frame.evidence
  Need (($proof.audit|ConvertTo-Json -Compress) -ceq ($frame.audit|ConvertTo-Json -Compress) -and $proof.familyDigest -ceq $frame.familyDigest) 'NEW_HISTORICAL_FINAL_CAS'
 }
}
function NewCandidateInventoryCore($evidence){
 $script:capturedCandidatePids=@($evidence.processes|ForEach-Object{[int]$_.pid})
 $inventory=Inventory;ProtectedProcesses $inventory
 Need (@($profile.oldWatchers).Count -eq 2) 'OLD_WATCHER_PINS'
 $oldPids=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{[int]$_.pid})
 foreach($instance in $inventory.instances){$oldPids+=@($before.tasks|Where-Object{$_.name -ceq $instance.Name}|ForEach-Object{if($_.PSObject.Properties.Name -contains 'enginePid'){[int]$_.enginePid}})}
 Need (@($evidence.processes|ForEach-Object{$_.role}|Sort-Object -Unique).Count -eq @($evidence.processes).Count -and @($evidence.processes|ForEach-Object{$_.pid}|Sort-Object -Unique).Count -eq @($evidence.processes).Count) 'CANDIDATE_DUPLICATE'
 $selected=@();$rules=@($profile.candidateRules);$seen=@()
 foreach($expected in @($evidence.processes)){
  Need ($expected.PSObject.Properties.Name -cnotcontains 'kind') 'CANDIDATE_PROTECTED_KIND'
  Need ([int]$expected.pid -notin @($profile.protectedProcesses|ForEach-Object{[int]$_.pid})) 'CANDIDATE_PROTECTED_PID'
  Need ($expected.ownerSid -ceq $owner -and [int]$expected.pid -gt 0 -and [int]$expected.pid -notin $oldPids -and $expected.role -cnotin $seen) 'CANDIDATE_OLD_OR_DUPLICATE'
  $rule=@($rules|Where-Object{$_.role -ceq $expected.role});Need ($rule.Count -eq 1) 'CANDIDATE_ROLE'
  VerifyRule $rule[0]
  Need ($expected.nodePath -ceq $rule[0].nodePath -and ((Tokens $expected.commandLine)|ConvertTo-Json -Compress) -ceq ((Tokens $rule[0].commandLine)|ConvertTo-Json -Compress)) 'CANDIDATE_ARGV'
  [void](ReadPinned $rule[0].config.path $rule[0].config.sha256)
  Need (@($profile.packages|Where-Object{$_.root -ceq $rule[0].packageRoot -and $_.sourceCommit -ceq $rule[0].sourceCommit}).Count -eq 1) 'CANDIDATE_PACKAGE'
  $actual=@($inventory.all|Where-Object{$_.ProcessId -eq $expected.pid})
  if($actual.Count -eq 0){continue}
  Need ($actual.Count -eq 1 -and (Identity $actual[0] $expected)) 'CANDIDATE_IDENTITY'
  RehearsalBindings $expected.role $expected $inventory
  $parent=@($inventory.all|Where-Object{$_.ProcessId -eq $expected.parentPid})
  $hubParentBirth=if($expected.role -ceq 'hub' -and -not $isRehearsal){HubLineage $evidence $expected $inventory}else{$null}
  if($parent.Count -eq 1){
   $parentProof=@(CandidateParentSnapshot $parent ([int]$expected.parentPid))
   if($parentProof.Count -eq 0){$parent=@()}else{$parent=@($parentProof[0].process);$parentSid=$parentProof[0].sid}
  }
  if($parent.Count -eq 1){
   if($expected.role -cin @('terminalWatcher','hubWatcher')){
    $service=@(Get-CimInstance Win32_Service -Filter "Name='Schedule'" -ErrorAction Stop)
    $pathAvailable=$parent[0].ExecutablePath -ieq 'C:\Windows\System32\svchost.exe' -and $parent[0].CommandLine -ieq 'C:\Windows\system32\svchost.exe -k netsvcs -p'
    $pathUnavailable=[string]::IsNullOrEmpty($parent[0].ExecutablePath) -and [string]::IsNullOrEmpty($parent[0].CommandLine)
    Need ($service.Count -eq 1 -and $service[0].State -ceq 'Running' -and $service[0].StartName -ceq 'LocalSystem' -and $service[0].PathName -ieq 'C:\Windows\system32\svchost.exe -k netsvcs -p' -and [int]$service[0].ProcessId -eq [int]$expected.parentPid -and $parent[0].Name -ieq 'svchost.exe' -and ($pathAvailable -or $pathUnavailable) -and (($parentSid.ReturnValue -eq 0 -and $parentSid.Sid -ceq 'S-1-5-18') -or ($parentSid.ReturnValue -eq 2 -and -not $parentSid.Sid))) 'CANDIDATE_SCHEDULE_PARENT'
   }else{Need ($parentSid.ReturnValue -eq 0 -and $parentSid.Sid -ceq $owner) 'CANDIDATE_PARENT_OWNER'}
   Need ($parent[0].CreationDate.ToUniversalTime() -le $actual[0].CreationDate.ToUniversalTime()) 'CANDIDATE_PARENT_BIRTH'
   $parentBirth=$parent[0].CreationDate.ToUniversalTime()
   if($script:parentPins.ContainsKey([int]$expected.parentPid)){Need ($script:parentPins[[int]$expected.parentPid].Ticks -eq $parentBirth.Ticks) 'CANDIDATE_PARENT_REUSED'}else{$script:parentPins[[int]$expected.parentPid]=$parentBirth}
  }else{
   if($expected.role -ceq 'hub' -and -not $isRehearsal -and $null -ne $hubParentBirth){$parentBirth=$hubParentBirth;$script:parentPins[[int]$expected.parentPid]=$parentBirth}else{
    Need ($parent.Count -eq 0 -and $script:tasksStopRequested -and $script:parentPins.ContainsKey([int]$expected.parentPid)) 'CANDIDATE_PARENT_UNPROVEN'
    $parentBirth=$script:parentPins[[int]$expected.parentPid]
   }
  }
  if($expected.role -cin @('terminalWatcher','hubWatcher')){
   $instances=@($inventory.instances|Where-Object{$_.Name -ceq $rule[0].taskName -and $_.EnginePID -eq $expected.pid})
   Need ($instances.Count -eq 1 -or ($script:tasksStopRequested -and $script:watcherPins.ContainsKey([int]$expected.pid))) 'CANDIDATE_COM'
   if($instances.Count -eq 1){
    if($script:watcherPins.ContainsKey([int]$expected.pid)){Need ($script:watcherPins[[int]$expected.pid] -ceq [string]$instances[0].InstanceGuid) 'CANDIDATE_COM_GUID_DRIFT'}else{$script:watcherPins[[int]$expected.pid]=[string]$instances[0].InstanceGuid}
   }
  }elseif($expected.role -ceq 'hub' -and -not $isRehearsal){
   Need ($parentBirth.Ticks -eq $hubParentBirth.Ticks) 'HUB_PARENT_BIRTH'
  }elseif($expected.role -ceq 'coreSupervisor'){
   Need ($null -eq $rule[0].receipt) 'SUPERVISOR_NO_SYNTHETIC_RECEIPT'
   SupervisorParent $evidence $expected $inventory
  }else{
   $refs=@($evidence.receipts|Where-Object{$_.role -ceq $expected.role});Need ($refs.Count -eq 1 -and $refs[0].path -ceq $rule[0].receipt.path) 'CANDIDATE_RECEIPT_REF'
   $receipt=Json (ReadPinned $refs[0].path $refs[0].sha256);$fields=$rule[0].receipt.fields
   $coreKeys=@('run','pid','parentPid','parentCreationTime','creationTime','stage','sourceCommit','configSha256','copyId','actualT1')|Sort-Object
   Need ((@($receipt.PSObject.Properties.Name|Sort-Object)-join '|') -ceq ($coreKeys-join '|') -and $receipt.stage -ceq $expected.role -and $receipt.run -cmatch '\A[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\z') 'CORE_RECEIPT_SCHEMA'
   Need ((@($receipt.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (@($rule[0].receipt.exactKeys|Sort-Object)-join '|')) 'CANDIDATE_RECEIPT_KEYS'
   if($null -ne $rule[0].receipt.schemaVersion){Need ((Field $receipt $fields.schema) -ceq $rule[0].receipt.schemaVersion) 'CANDIDATE_RECEIPT_SCHEMA'}
   Need ((Field $receipt $fields.pid) -eq $expected.pid -and (Field $receipt $fields.parentPid) -eq $expected.parentPid -and [DateTime]::Parse((Field $receipt $fields.birth)).ToUniversalTime().Ticks -eq [DateTime]::Parse($expected.creationTime).ToUniversalTime().Ticks -and (Field $receipt $fields.sourceCommit) -ceq $rule[0].sourceCommit -and (Field $receipt $fields.configSha256) -ceq $rule[0].config.sha256 -and (Field $receipt $fields.copyId) -ceq $before.copyId -and (Field $receipt $fields.actualT1) -ceq $false -and [DateTime]::Parse((Field $receipt $fields.parentBirth)).ToUniversalTime().Ticks -eq $parentBirth.Ticks) 'CANDIDATE_RECEIPT_IDENTITY'
  }
  foreach($binding in @($expected.bindings)){Need (@($inventory.listeners|Where-Object{$_.OwningProcess -eq $expected.pid -and $_.LocalPort -eq $binding.port -and $_.LocalAddress -ceq $binding.address}).Count -eq 1) 'CANDIDATE_BINDING'}
  $selected+=,$expected;$seen+=$expected.role
 }
 foreach($listener in $inventory.listeners){Need (@($selected|Where-Object{$_.pid -eq $listener.OwningProcess -and @($_.bindings|Where-Object{$_.port -eq $listener.LocalPort -and $_.address -ceq $listener.LocalAddress}).Count -eq 1}).Count -eq 1) 'FOREIGN_LISTENER'}
 $auxiliaryPids=@(ConsoleAuxiliaries $inventory $selected)
 $relevantPids=[Collections.Generic.HashSet[int]]::new()
 foreach($captured in @($evidence.processes)){[void]$relevantPids.Add([int]$captured.pid)}
 foreach($capturedPid in @($script:consolePins.Keys)){[void]$relevantPids.Add([int]$capturedPid)}
 foreach($p in $inventory.all){
  $relevant=(NewHistoricalOldPidRelevant $p $oldPids $inventory $evidence) -or $p.ProcessId -in @($inventory.instances|ForEach-Object{$_.EnginePID}) -or (IsWatcherCommand ([string]$p.CommandLine))
  foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){$relevant=$true}}
  if($relevant){[void]$relevantPids.Add([int]$p.ProcessId)}
 }
 do{$added=$false;foreach($p in $inventory.all){if($relevantPids.Contains([int]$p.ParentProcessId) -and $relevantPids.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inventory.all){if($relevantPids.Contains([int]$p.ProcessId)){Need (@($selected|Where-Object{$_.pid -eq $p.ProcessId}).Count -eq 1 -or $p.ProcessId -in $auxiliaryPids) 'FOREIGN_PROCESS'}}
 if(-not $script:tasksStopRequested){
  $script:admittedExitPins=@{};foreach($pin in $selected){$script:admittedExitPins[[int]$pin.pid]=$pin};foreach($pin in $script:consolePins.Values){$script:admittedExitPins[[int]$pin.pid]=$pin}
 }
 return [pscustomobject]@{inventory=$inventory;selected=$selected}
}
function NewAssertCandidateInventoryEquivalence{
 $body=$script:newFrozenCandidateInventoryBody
 if($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){
  $lifetime=' $unrelatedOldPids=@(AssertOldPidLifetimes $inventory)'
  $relevant='($p.ProcessId -in $oldPids -and $p.ProcessId -notin $unrelatedOldPids)'
  Need ([regex]::Matches($body,[regex]::Escape($lifetime)).Count -eq 1 -and [regex]::Matches($body,[regex]::Escape($relevant)).Count -eq 1) 'B264_NEW_LIFETIME_SOURCE'
  $body=$body.Replace($lifetime+[Environment]::NewLine,'').Replace($lifetime+"`n",'').Replace($relevant,'$p.ProcessId -in $oldPids')
 }
 $old='$p.ProcessId -in $oldPids';$replacement='(NewHistoricalOldPidRelevant $p $oldPids $inventory $evidence)'
 Need ([regex]::Matches($body,[regex]::Escape($old)).Count -eq 1) 'NEW_CANDIDATE_INVENTORY_SOURCE'
 $expected=$body.Replace($old,$replacement).Replace("`r`n","`n").Trim()
 $definition=(Get-Command NewCandidateInventoryCore -CommandType Function).ScriptBlock.Ast
 Need ($definition -is [Management.Automation.Language.FunctionDefinitionAst] -and $definition.Name -ceq 'NewCandidateInventoryCore') 'NEW_CANDIDATE_INVENTORY_DEFINITION'
 Need ($definition.Body.Extent.Text.Replace("`r`n","`n").Trim() -ceq $expected) 'NEW_CANDIDATE_INVENTORY_EQUIVALENCE'
}
function CandidateInventoryCore($evidence){return NewCandidateInventoryCore $evidence}
function NewCurrentWitnessKeys($value,[string[]]$keys){Need ((@($value.PSObject.Properties.Name|Sort-Object)-join '|') -ceq (($keys|Sort-Object)-join '|')) 'CURRENT_NEW_WITNESS_KEYS'}
function NewCurrentWitnessRef($ref,[string]$expectedPath){
 NewCurrentWitnessKeys $ref @('path','sha256');Need ($ref.path -ceq $expectedPath -and $ref.sha256 -cmatch '\A[a-f0-9]{64}\z') 'CURRENT_NEW_WITNESS_REF'
 return Json (ReadPinned $ref.path $ref.sha256)
}
function NewCurrentWitnessArtifact([string]$leaf){
 Need ($leaf -cin @('transition.lock','successor-core-probe-drain.json','successor-core-cut-completed.json')) 'CURRENT_NEW_WITNESS_LEAF'
 $path=Join-Path $dir $leaf;Protected $path;$sha=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();return [pscustomobject]@{ref=[pscustomobject]@{path=$path;sha256=$sha};value=(Json (ReadPinned $path $sha))}
}

# Finite metadata-only binding for the one failed974d pre-cut generation.
# Fresh OLD admission remains in the caller; recovery adds no wall-clock gate.
function Same974dShape($a,$b,[string[]]$omit=@()){
 if($null-eq$a-or$null-eq$b){return $null-eq$a-and$null-eq$b}
 if($a-is[Array]-or$b-is[Array]){if($a-isnot[Array]-or$b-isnot[Array]-or$a.Count-ne$b.Count){return $false};for($i=0;$i-lt$a.Count;$i++){if(-not(Same974dShape $a[$i] $b[$i])){return $false}};return $true}
 if($a.GetType().FullName-ceq'System.Management.Automation.PSCustomObject'-or$b.GetType().FullName-ceq'System.Management.Automation.PSCustomObject'){if($a.GetType().FullName-cne'System.Management.Automation.PSCustomObject'-or$b.GetType().FullName-cne'System.Management.Automation.PSCustomObject'){return $false};$ak=@($a.PSObject.Properties.Name|Where-Object{$_-cnotin$omit}|Sort-Object);$bk=@($b.PSObject.Properties.Name|Where-Object{$_-cnotin$omit}|Sort-Object);if(($ak-join'|')-cne($bk-join'|')){return $false};foreach($k in $ak){if(-not(Same974dShape $a.$k $b.$k)){return $false}};return $true}
 return $a.GetType()-eq$b.GetType()-and$a-ceq$b
}
function Assert974dContinuation($context,$currentClaim,[scriptblock]$read){
 $failed='974d73c7d84b9ea43e1397b0fdf44c01';$priorDir=Join-Path $base ('MelisaERP-P03-transition-'+$failed);$expectedClaim=Join-Path $base ('p03-pr54-current-b007-continuation-of-'+$failed+'.lock.json')
 $keys=@('schemaVersion','retainedClaimRef','failureTailRef','profileRef','beforeRef','claimPath','correctedSourceCommit')
 Need ((@($context.PSObject.Properties.Name|Sort-Object)-join'|')-ceq(@($keys|Sort-Object)-join'|')-and$context.schemaVersion-ceq'melisa-p03-current-b007-precut974d-continuation.v1'-and$context.correctedSourceCommit-ceq'82e741af59cb59f27a4008ded83ca889238fb5c7'-and$context.claimPath-ceq$expectedClaim) 'CURRENT_974D_CONTEXT'
 $pins=[ordered]@{
 claim=[pscustomobject]@{path=(Join-Path $base 'p03-pr54-current-b007-generation-1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381.lock.json');sha256='fb736269cb81c53a164f35f2c348dff7c32ec574b46a1b7b00666f9d9f0a5332'}
 profile=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$failed+'.json'));sha256='68dcb12d3ed557f1ffe48bf99961b24daaa62cf387d1265ac0ad28e608690f3a'}
 before=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$failed+'.json'));sha256='ff97a87aa6caf59ae934d07b055bc4d7f8470677a70f30e0b5a12b3a36e5349f'}
 transitionLock=[pscustomobject]@{path=(Join-Path $priorDir 'transition.lock');sha256='657702fcb5b1a9255ec65fe6fe012f584c797e87f881f68223394215f24c575c'}
 event0=[pscustomobject]@{path=(Join-Path $priorDir 'event-0000.json');sha256='ae88c07259811eb76dcaefc52655f3605af89e99be5e87203d5cb8b0bc67d67c'}
 event1=[pscustomobject]@{path=(Join-Path $priorDir 'event-0001.json');sha256='7452b31c398f56bfea1dbbadf7df1ff295c5bd7673ed04ea4de60c65eb593832'}
 failureTail=[pscustomobject]@{path=(Join-Path $priorDir 'event-0002.json');sha256='327528179fdbed252553f06c7b8e3ba812cfd3c0a4d96419298ba94163c09706'}
 diagnostic=[pscustomobject]@{path=(Join-Path $priorDir 'io-failure-diagnostic.json');sha256='a571e5dfdb1e0f00c9102733c0a054827d1230f343351805ed515389f93e8aa8'}
 }
 Need ((Same974dShape $context.retainedClaimRef $pins.claim)-and(Same974dShape $context.failureTailRef $pins.failureTail)-and(Same974dShape $context.profileRef ([pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256}))-and(Same974dShape $context.beforeRef ([pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256}))) 'CURRENT_974D_REFS'
 $old=@{};foreach($key in $pins.Keys){$old[$key]=&$read $pins[$key].path $pins[$key].sha256}
 Need ($old.claim.successorRunId-ceq$failed-and$old.claim.currentOwnerDigest-ceq'1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381'-and$old.claim.transitionAuthority-ceq$true-and$old.claim.applyExecuted-ceq$false-and(Same974dShape $old.claim.successorProfile $pins.profile)-and(Same974dShape $old.claim.successorBefore $pins.before)) 'CURRENT_974D_HISTORY'
 Need ((Same974dShape $old.transitionLock.profileRef $pins.profile)-and(Same974dShape $old.transitionLock.beforeRef $pins.before)-and(Same974dShape $old.transitionLock.successorClaimRef $pins.claim)-and(Same974dShape $old.transitionLock.currentPreCapture.snapshotRef $old.profile.businessDigest)) 'CURRENT_974D_LOCK'
 $previous=$pins.before.sha256;foreach($i in 0..2){$key=@('event0','event1','failureTail')[$i];$row=$old[$key];Need ($row.sequence-eq$i-and$row.event-ceq@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$i]-and$row.previousSha256-ceq$previous-and$row.profileSha256-ceq$pins.profile.sha256-and$row.beforeSha256-ceq$pins.before.sha256-and$row.digest-ceq$old.before.plan.digest-and$row.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_974D_CHAIN';if($i-gt0){Need ($row.target-ceq@('','coreSupervisor','HELD_CORE_CUT')[$i]) 'CURRENT_974D_TARGET'};$previous=$pins[$key].sha256}
 Need ($old.diagnostic.phase-ceq'HELD_CORE_CUT'-and$old.diagnostic.reason-ceq'P03_OWNER_TRANSITION_STOPPED'-and$old.diagnostic.failureDiagnostic.stage-ceq'INSPECT'-and$old.diagnostic.failureDiagnostic.reason-ceq'UNCLASSIFIED_IO_FAILURE'-and$old.diagnostic.profileSha256-ceq$pins.profile.sha256-and$old.diagnostic.beforeSha256-ceq$pins.before.sha256) 'CURRENT_974D_DIAGNOSTIC'
 Need ($before.runId-cne$failed-and$before.runId-cmatch'\A[a-f0-9]{32}\z'-and$ProfilePath-ceq(Join-Path $base ('MelisaERP-P03-profile-'+$before.runId+'.json'))-and$BeforeImagePath-ceq(Join-Path $base ('MelisaERP-P03-before-'+$before.runId+'.json'))-and(Same974dShape $profile.beforeImage $context.beforeRef)-and(Same974dShape $before $old.before @('runId','startedAt','observedAt'))-and(Same974dShape $profile $old.profile @('beforeImage','businessDigest','journalDirectory','stopper'))) 'CURRENT_974D_EQUIVALENCE'
 Need ([DateTime]::Parse($before.startedAt).ToUniversalTime()-le[DateTime]::Parse($before.observedAt).ToUniversalTime()-and[DateTime]::Parse($before.startedAt).ToUniversalTime()-ge[DateTime]::Parse($old.before.observedAt).ToUniversalTime()) 'CURRENT_974D_TIMES'
 Need ($profile.businessDigest.path-cmatch'\AC:\\Sirket\\ERP\\backups\\P03-20261021-\d{6}\\source-pre-snapshot-[a-f0-9]{32}\.json\z'-and$profile.businessDigest.path-cne$old.profile.businessDigest.path-and[IO.Path]::GetDirectoryName($profile.businessDigest.path)-ceq[IO.Path]::GetDirectoryName($old.profile.businessDigest.path)-and$profile.journalDirectory-ceq(Join-Path $base ('MelisaERP-P03-recovery-'+$before.runId))-and$profile.stopper.path-ceq(Join-Path $base ('MelisaERP-P03-stopper-'+$before.runId+'.ps1'))-and$profile.stopper.sha256-ceq$old.profile.stopper.sha256) 'CURRENT_974D_NEW_REFS'
 Need ($currentClaim.currentOwnerDigest-ceq$old.claim.currentOwnerDigest-and(Same974dShape $currentClaim.candidate $old.claim.candidate)-and(Same974dShape $currentClaim.protectedSqlEpoch $old.claim.protectedSqlEpoch)-and$currentClaim.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_974D_CLAIM_EQUIVALENCE'
 # The failed source generation never entered recovery. Preserve its empty journal.
 Protected $old.profile.journalDirectory;Need (@(Get-ChildItem -LiteralPath $old.profile.journalDirectory -Force).Count-eq0) 'CURRENT_974D_OLD_JOURNAL'
 foreach($leaf in @('b264-old-owner-held-cut-intent.json','successor-core-cut-completed.json','successor-core-probe-drain.json','new-owner-started.json')){Need (-not(Test-Path -LiteralPath (Join-Path $priorDir $leaf))) 'CURRENT_974D_NO_CUT'}
}

function AssertB142Continuation($context,$currentClaim,[scriptblock]$read){
 $failed='b14266ad30507bb10d78ae76e2546221';$priorDir=Join-Path $base ('MelisaERP-P03-transition-'+$failed);$expectedClaim=Join-Path $base ('p03-pr54-current-b007-continuation-of-'+$failed+'.lock.json')
 $keys=@('schemaVersion','retainedClaimRef','failureTailRef','profileRef','beforeRef','claimPath','correctedSourceCommit')
 Need ((@($context.PSObject.Properties.Name|Sort-Object)-join'|')-ceq(@($keys|Sort-Object)-join'|')-and$context.schemaVersion-ceq'melisa-p03-current-b007-precutb142-continuation.v1'-and$context.correctedSourceCommit-ceq'82e741af59cb59f27a4008ded83ca889238fb5c7'-and$context.claimPath-ceq$expectedClaim) 'CURRENT_B142_CONTEXT'
 $pins=[ordered]@{
 claim=[pscustomobject]@{path=(Join-Path $base 'p03-pr54-current-b007-continuation-of-974d73c7d84b9ea43e1397b0fdf44c01.lock.json');sha256='442f7d953c6e75512c36a259611d6d3f2275e9073d030991e1f87c177cd461a5'}
 profile=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$failed+'.json'));sha256='8e34643bd8fb360e8ad7e94fcf5bca1e3b9b438a4d19ca1dce01d21b375d8bb2'}
 before=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$failed+'.json'));sha256='360b5f6551fda107d2f556f1230cdc2812dcc44b0818bf5b8c35d5b453e7f9d1'}
 transitionLock=[pscustomobject]@{path=(Join-Path $priorDir 'transition.lock');sha256='de02d0c1d1caa26f95c6c22497aa738a2b2905e9e15c1d6dcd6f71d199d57f6b'}
 event0=[pscustomobject]@{path=(Join-Path $priorDir 'event-0000.json');sha256='457c86fe6db487b490f1d8db50bf69d90a5090c498f8c00cea121aad1660bef9'}
 event1=[pscustomobject]@{path=(Join-Path $priorDir 'event-0001.json');sha256='dfe8cf9b4be4189ce17aa3482fdcb6d3fa20ba05cf678074f0c2d750ffd43b56'}
 failureTail=[pscustomobject]@{path=(Join-Path $priorDir 'event-0002.json');sha256='abfbe25fb456df145857d10e96f366d3aacfd91b0cfe14440b0ab51b1c04d77c'}
 diagnostic=[pscustomobject]@{path=(Join-Path $priorDir 'io-failure-diagnostic.json');sha256='588065c6d36a65563869698586765ee838cb739a70c263ebde454fa9a761a72a'}
 context=[pscustomobject]@{path=(Join-Path $priorDir 'precut-continuation.json');sha256='cc3adf31b7e0bf9fda138093c2fd2c6c892cae09884e443bd1a06cee52605e3a'}
 snapshot=[pscustomobject]@{path=(Join-Path $priorDir 'successor-precut-admission.json');sha256='25bbcfd0dcb027c7acbd7e78437e55e1bf47bc46c37904474d03e3010665bf32'}
 intent=[pscustomobject]@{path=(Join-Path $priorDir 'b264-old-owner-cut-intent.json');sha256='81051359805fa84cc44ddad4586161e084055572d08b1d2df214ade7dc6e9e0a'}
 }
 Need ((Same974dShape $context.retainedClaimRef $pins.claim)-and(Same974dShape $context.failureTailRef $pins.failureTail)-and(Same974dShape $context.profileRef ([pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256}))-and(Same974dShape $context.beforeRef ([pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256}))) 'CURRENT_B142_REFS'
 $old=@{};foreach($key in $pins.Keys){$old[$key]=&$read $pins[$key].path $pins[$key].sha256}
 Need ($old.claim.successorRunId-ceq$failed-and$old.claim.currentOwnerDigest-ceq'1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381'-and$old.claim.transitionAuthority-ceq$true-and$old.claim.applyExecuted-ceq$false-and(Same974dShape $old.claim.successorProfile $pins.profile)-and(Same974dShape $old.claim.successorBefore $pins.before)) 'CURRENT_B142_HISTORY'
 Need ((Same974dShape $old.transitionLock.profileRef $pins.profile)-and(Same974dShape $old.transitionLock.beforeRef $pins.before)-and(Same974dShape $old.transitionLock.successorClaimRef $pins.claim)-and(Same974dShape $old.transitionLock.currentPreCapture.snapshotRef $old.profile.businessDigest)) 'CURRENT_B142_LOCK'
 $previous=$pins.before.sha256;foreach($i in 0..2){$key=@('event0','event1','failureTail')[$i];$row=$old[$key];Need ($row.sequence-eq$i-and$row.event-ceq@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$i]-and$row.previousSha256-ceq$previous-and$row.profileSha256-ceq$pins.profile.sha256-and$row.beforeSha256-ceq$pins.before.sha256-and$row.digest-ceq$old.before.plan.digest-and$row.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_B142_CHAIN';if($i-gt0){Need ($row.target-ceq@('','coreSupervisor','HELD_CORE_CUT')[$i]) 'CURRENT_B142_TARGET'};$previous=$pins[$key].sha256}
 Need ($old.diagnostic.phase-ceq'HELD_CORE_CUT'-and$old.diagnostic.reason-ceq'P03_OWNER_TRANSITION_STOPPED'-and$old.diagnostic.failureDiagnostic.stage-ceq'DRAIN'-and$old.diagnostic.failureDiagnostic.reason-ceq'P03_PHYSICAL_B264_CUT_OWNER_FRESH'-and$old.diagnostic.profileSha256-ceq$pins.profile.sha256-and$old.diagnostic.beforeSha256-ceq$pins.before.sha256) 'CURRENT_B142_DIAGNOSTIC'
 Need ((Same974dShape $old.transitionLock.continuationRef $pins.context)) 'CURRENT_B142_CONTEXT_POINTER'
 # Verify the immutable974d lineage using the retained b142 profile/before.
 & { $profile=$old.profile;$before=$old.before;$ProfilePath=$pins.profile.path;$ProfileSha256=$pins.profile.sha256;$BeforeImagePath=$pins.before.path;$BeforeImageSha256=$pins.before.sha256;Assert974dContinuation $old.context $old.claim $read }
 $snapshot=$old.snapshot;$intent=$old.intent
 Need ((@($snapshot.PSObject.Properties.Name|Sort-Object)-join'|')-ceq' beforeSha256|consolePins|engineSha256|observedAt|oldIdentities|oldWatchers|probePins|profileSha256|protectedConsolePins|recoveryHelperSha256|schemaVersion'.Trim()-and$snapshot.schemaVersion-ceq'melisa-p03-successor-precut-admission.v1'-and$snapshot.profileSha256-ceq$pins.profile.sha256-and$snapshot.beforeSha256-ceq$pins.before.sha256-and$snapshot.engineSha256-ceq'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'-and$snapshot.recoveryHelperSha256-ceq'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'-and@($snapshot.oldIdentities).Count-eq8-and@($old.before.identities.PSObject.Properties).Count-eq8-and(Same974dShape @($snapshot.oldWatchers) @($old.profile.oldWatchers))) 'CURRENT_B142_SNAPSHOT'
 foreach($entry in $old.before.identities.PSObject.Properties){Need (@($snapshot.oldIdentities|Where-Object{Same974dShape $_ $entry.Value}).Count-eq1) 'CURRENT_B142_SNAPSHOT_UID'}
 Need ((@($intent.PSObject.Properties.Name|Sort-Object)-join'|')-ceq'beforeSha256|claimSha256|event|observedAt|profileSha256|stopOrderDigest'-and$intent.event-ceq'B264_OLD_CUT_INTENT'-and$intent.claimSha256-ceq$pins.claim.sha256-and$intent.stopOrderDigest-ceq$old.claim.stopOrderDigest-and$intent.profileSha256-ceq$pins.profile.sha256-and$intent.beforeSha256-ceq$pins.before.sha256-and[DateTime]::Parse($intent.observedAt).ToUniversalTime()-ge[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()) 'CURRENT_B142_INTENT'
 Need ($before.runId-cne$failed-and$before.runId-cmatch'\A[a-f0-9]{32}\z'-and$ProfilePath-ceq(Join-Path $base ('MelisaERP-P03-profile-'+$before.runId+'.json'))-and$BeforeImagePath-ceq(Join-Path $base ('MelisaERP-P03-before-'+$before.runId+'.json'))-and(Same974dShape $profile.beforeImage $context.beforeRef)-and(Same974dShape $before $old.before @('runId','startedAt','observedAt'))-and(Same974dShape $profile $old.profile @('beforeImage','businessDigest','journalDirectory','stopper'))) 'CURRENT_B142_EQUIVALENCE'
 Need ([DateTime]::Parse($before.startedAt).ToUniversalTime()-le[DateTime]::Parse($before.observedAt).ToUniversalTime()-and[DateTime]::Parse($before.startedAt).ToUniversalTime()-ge[DateTime]::Parse($old.before.observedAt).ToUniversalTime()) 'CURRENT_B142_TIMES'
 Need ($profile.businessDigest.path-cmatch'\AC:\\Sirket\\ERP\\backups\\P03-20261021-\d{6}\\source-pre-snapshot-[a-f0-9]{32}\.json\z'-and$profile.businessDigest.path-cne$old.profile.businessDigest.path-and[IO.Path]::GetDirectoryName($profile.businessDigest.path)-ceq[IO.Path]::GetDirectoryName($old.profile.businessDigest.path)-and$profile.journalDirectory-ceq(Join-Path $base ('MelisaERP-P03-recovery-'+$before.runId))-and$profile.stopper.path-ceq(Join-Path $base ('MelisaERP-P03-stopper-'+$before.runId+'.ps1'))-and$profile.stopper.sha256-ceq$old.profile.stopper.sha256) 'CURRENT_B142_NEW_REFS'
 Need ($currentClaim.currentOwnerDigest-ceq$old.claim.currentOwnerDigest-and(Same974dShape $currentClaim.candidate $old.claim.candidate)-and(Same974dShape $currentClaim.protectedSqlEpoch $old.claim.protectedSqlEpoch)-and$currentClaim.stopOrderDigest-ceq$old.claim.stopOrderDigest) 'CURRENT_B142_CLAIM_EQUIVALENCE'
 # The failed source generation never entered recovery. Preserve its empty journal.
 Protected $old.profile.journalDirectory;Need (@(Get-ChildItem -LiteralPath $old.profile.journalDirectory -Force).Count-eq0) 'CURRENT_B142_OLD_JOURNAL'
 foreach($leaf in @('b264-old-owner-held-cut-intent.json','successor-core-cut-completed.json','successor-core-probe-drain.json','new-owner-started.json')){Need (-not(Test-Path -LiteralPath (Join-Path $priorDir $leaf))) 'CURRENT_B142_NO_CUT'}
}

function NewCurrentCutWitness{
 Need ($PolicyGeneration -ceq 'CurrentB007ObserveOnly') 'CURRENT_NEW_WITNESS_POLICY'
 $lock=(NewCurrentWitnessArtifact 'transition.lock').value
 $keys=@('profileRef','beforeRef','currentPreCapture','rehearsalProofRef','successorClaimRef','sourceControlDir');if($lock.PSObject.Properties.Name -ccontains 'continuationRef'){$keys+=,'continuationRef'}
 NewCurrentWitnessKeys $lock $keys
 [void](NewCurrentWitnessRef $lock.profileRef $ProfilePath);Need ($lock.profileRef.sha256 -ceq $ProfileSha256) 'CURRENT_NEW_PROFILE_REF'
 [void](NewCurrentWitnessRef $lock.beforeRef $BeforeImagePath);Need ($lock.beforeRef.sha256 -ceq $BeforeImageSha256) 'CURRENT_NEW_BEFORE_REF'
 $claimPath=$lock.successorClaimRef.path;$freshClaim=$claimPath -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\p03-pr54-current-b007-generation-[a-f0-9]{64}\.lock\.json\z'
 Need ($claimPath -cin @((Join-Path $base 'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'),(Join-Path $base 'p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json'),(Join-Path $base 'p03-pr54-current-b007-continuation-of-974d73c7d84b9ea43e1397b0fdf44c01.lock.json'),(Join-Path $base 'p03-pr54-current-b007-continuation-of-b14266ad30507bb10d78ae76e2546221.lock.json'))-or$freshClaim) 'CURRENT_NEW_CLAIM_PATH'
 $claim=NewCurrentWitnessRef $lock.successorClaimRef $claimPath
 if($freshClaim){Need ($claimPath -ceq (Join-Path $base ('p03-pr54-current-b007-generation-'+$claim.currentOwnerDigest+'.lock.json'))-and-not($lock.PSObject.Properties.Name-ccontains'continuationRef')) 'CURRENT_NEW_GENERATION_EPOCH'}
 Need ($claim.schemaVersion -ceq 'melisa-p03-current-b007-epoch-claim.v1' -and $claim.transitionAuthority -ceq $true -and $claim.applyExecuted -ceq $false -and $claim.predecessorRunId -ceq 'b264594b6f93d560d807c8decc4e6699' -and $claim.newSettings.path -ceq $profile.newSettings.path -and $claim.newSettings.sha256 -ceq $profile.newSettings.sha256) 'CURRENT_NEW_CLAIM'
 $continuation974d=$claimPath -ceq (Join-Path $base 'p03-pr54-current-b007-continuation-of-974d73c7d84b9ea43e1397b0fdf44c01.lock.json');Need (-not$continuation974d-or($lock.PSObject.Properties.Name-ccontains'continuationRef')) 'CURRENT_974D_CONTEXT_REQUIRED'
 $continuationB142=$claimPath -ceq (Join-Path $base 'p03-pr54-current-b007-continuation-of-b14266ad30507bb10d78ae76e2546221.lock.json');Need (-not$continuationB142-or($lock.PSObject.Properties.Name-ccontains'continuationRef')) 'CURRENT_B142_CONTEXT_REQUIRED'
 $retained=$false
 if($lock.PSObject.Properties.Name -ccontains 'continuationRef'){
  $context=NewCurrentWitnessRef $lock.continuationRef (Join-Path $dir 'precut-continuation.json')
  $contextKeys=@('schemaVersion','retainedClaimRef','failureTailRef','profileRef','beforeRef','claimPath')
  if($continuation974d-or$continuationB142){$contextKeys+=,'correctedSourceCommit'}
  if($context.schemaVersion -cin @('melisa-p03-current-b007-precut-resume.v1','melisa-p03-current-b007-precut-retry.v1')){$contextKeys+=@('retainedProfileRef','retainedBeforeRef');$retained=$true}
  NewCurrentWitnessKeys $context $contextKeys
  Need ($context.claimPath -ceq $claimPath -and $context.profileRef.path -ceq $ProfilePath -and $context.profileRef.sha256 -ceq $ProfileSha256 -and $context.beforeRef.path -ceq $BeforeImagePath -and $context.beforeRef.sha256 -ceq $BeforeImageSha256) 'CURRENT_NEW_CONTEXT'
  [void](NewCurrentWitnessRef $context.profileRef $ProfilePath);[void](NewCurrentWitnessRef $context.beforeRef $BeforeImagePath)
  if($continuationB142){AssertB142Continuation $context $claim {param($p,$h) Json (ReadPinned $p $h)};$failedRun='b14266ad30507bb10d78ae76e2546221';$failedSha='abfbe25fb456df145857d10e96f366d3aacfd91b0cfe14440b0ab51b1c04d77c'}elseif($continuation974d){Assert974dContinuation $context $claim {param($p,$h) Json (ReadPinned $p $h)};$failedRun='974d73c7d84b9ea43e1397b0fdf44c01';$failedSha='327528179fdbed252553f06c7b8e3ba812cfd3c0a4d96419298ba94163c09706'}elseif($retained){
   Need ($lock.successorClaimRef.sha256 -ceq 'a5990db676c6308e0899d81a2f6efdde539544109762802d62137d9ec853e544' -and $context.retainedClaimRef.path -ceq $claimPath -and $context.retainedClaimRef.sha256 -ceq $lock.successorClaimRef.sha256 -and $context.retainedProfileRef.sha256 -ceq '4b808868f23ced8015aad4395a7c390017b374d3c23fe23d48fc6bf7f0397c39' -and $context.retainedBeforeRef.sha256 -ceq '23ae28bc8d01f644c9f56404c6b358bc57afec336bb82bb3ad19158f2bd11d3f' -and $claim.successorRunId -ceq '452054204a1857ff618b0dd30a59caea') 'CURRENT_NEW_RETAINED'
   [void](NewCurrentWitnessRef $context.retainedClaimRef $claimPath);[void](NewCurrentWitnessRef $context.retainedProfileRef (Join-Path $base 'MelisaERP-P03-profile-452054204a1857ff618b0dd30a59caea.json'));[void](NewCurrentWitnessRef $context.retainedBeforeRef (Join-Path $base 'MelisaERP-P03-before-452054204a1857ff618b0dd30a59caea.json'))
   $failedRun=if($context.schemaVersion -ceq 'melisa-p03-current-b007-precut-retry.v1'){'9d2e00d572acc83391a0a2e5ac28d046'}else{'452054204a1857ff618b0dd30a59caea'}
   $failedSha=if($failedRun -ceq '9d2e00d572acc83391a0a2e5ac28d046'){'74d1c6dcdd5597935a9a8f2b814aef4e8167880bbc2c9ebea469d07f8f85af26'}else{'778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777'}
  }else{
   Need ($context.schemaVersion -ceq 'melisa-p03-current-b007-precut-continuation.v1' -and $context.retainedClaimRef.sha256 -ceq '3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408') 'CURRENT_NEW_CONTINUATION'
   [void](NewCurrentWitnessRef $context.retainedClaimRef (Join-Path $base 'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'));$failedRun='cffba2988afcb49502ae73ddd797e966';$failedSha='87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82'
  }
  Need ($context.failureTailRef.sha256 -ceq $failedSha) 'CURRENT_NEW_FAILURE_TAIL';[void](NewCurrentWitnessRef $context.failureTailRef (Join-Path $base ('MelisaERP-P03-transition-'+$failedRun+'\event-0002.json')))
 }
 if(-not$retained){Need ($claim.successorRunId -ceq $runId -and $claim.successorProfile.path -ceq $ProfilePath -and $claim.successorProfile.sha256 -ceq $ProfileSha256 -and $claim.successorBefore.path -ceq $BeforeImagePath -and $claim.successorBefore.sha256 -ceq $BeforeImageSha256) 'CURRENT_NEW_CLAIM_REFS'}
 $completed=NewCurrentWitnessArtifact 'successor-core-cut-completed.json';$cut=$completed.value
 $drain=(NewCurrentWitnessArtifact 'successor-core-probe-drain.json').value
 [void](NewCurrentWitnessRef $drain.cutWitness $completed.ref.path);Need ($drain.cutWitness.sha256 -ceq $completed.ref.sha256 -and $drain.event -ceq 'B264_OLD_OWNER_CORE_PROBES_ABSENT' -and $drain.profileSha256 -ceq $ProfileSha256 -and $drain.beforeSha256 -ceq $BeforeImageSha256) 'CURRENT_NEW_DRAIN'
 Need ($cut.event -ceq 'B264_OLD_OWNER_CORE_CUT_COMPLETED' -and $cut.profileSha256 -ceq $ProfileSha256 -and $cut.beforeSha256 -ceq $BeforeImageSha256 -and $cut.claimSha256 -ceq $lock.successorClaimRef.sha256 -and $cut.heldProcessHandle -ceq $true -and $cut.processAbsent -ceq $true -and $cut.mechanism -cin @('COM_STOP_NATURAL_EXIT','EXACT_OBSERVED_PROCESS_STOPPED')) 'CURRENT_NEW_CUT'
 $intent=NewCurrentWitnessRef $cut.durableIntent (Join-Path $dir 'b264-old-owner-held-cut-intent.json')
 Need ($intent.event -ceq 'B264_OLD_OWNER_CUT_INTENT' -and $intent.profileSha256 -ceq $ProfileSha256 -and $intent.beforeSha256 -ceq $BeforeImageSha256 -and $intent.claimSha256 -ceq $lock.successorClaimRef.sha256 -and $intent.heldProcessHandle -ceq $true -and $intent.windowOpenedAt -ceq $cut.windowOpenedAt) 'CURRENT_NEW_HELD_INTENT'
 $rootRef=[pscustomobject]@{path=(Join-Path $dir 'b264-old-owner-cut-intent.json');sha256=$intent.rootIntentSha256};$rootIntent=NewCurrentWitnessRef $rootRef $rootRef.path
 Need ($rootIntent.event -ceq 'B264_OLD_CUT_INTENT' -and $rootIntent.profileSha256 -ceq $ProfileSha256 -and $rootIntent.beforeSha256 -ceq $BeforeImageSha256 -and $rootIntent.claimSha256 -ceq $lock.successorClaimRef.sha256 -and $rootIntent.stopOrderDigest -ceq $claim.stopOrderDigest) 'CURRENT_NEW_ROOT_INTENT'
 $snapshotRef=[pscustomobject]@{path=(Join-Path $dir 'successor-precut-admission.json');sha256=$intent.admittedSnapshotSha256};$snapshot=NewCurrentWitnessRef $snapshotRef $snapshotRef.path
 Need ($snapshot.schemaVersion -ceq 'melisa-p03-successor-precut-admission.v1' -and $snapshot.profileSha256 -ceq $ProfileSha256 -and $snapshot.beforeSha256 -ceq $BeforeImageSha256 -and $snapshot.engineSha256 -ceq $engineSha -and $snapshot.recoveryHelperSha256 -ceq $RecoveryHelperSha256 -and @($snapshot.oldIdentities).Count -eq 8 -and @($snapshot.oldWatchers).Count -eq 2) 'CURRENT_NEW_SNAPSHOT'
 $core=$before.identities.coreSupervisor
 foreach($field in @('pid','parentPid','nodePath','ownerSid','commandLine','creationTime')){Need ($cut.core.$field -ceq $core.$field -and $intent.core.$field -ceq $core.$field) 'CURRENT_NEW_CORE_UID'}
 foreach($role in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor')){$expected=$before.identities.$role;$rows=@($snapshot.oldIdentities|Where-Object{$_.pid -eq $expected.pid});Need ($rows.Count -eq 1) 'CURRENT_NEW_SNAPSHOT_UID';foreach($field in @('pid','parentPid','nodePath','ownerSid','commandLine','creationTime')){Need ($rows[0].$field -ceq $expected.$field) 'CURRENT_NEW_SNAPSHOT_UID'}}
 foreach($w in $profile.oldWatchers){$rows=@($snapshot.oldWatchers|Where-Object{$_.pid -eq $w.pid});$com=@($intent.runningInstances|Where-Object{$_.pid -eq $w.pid});Need ($rows.Count -eq 1 -and $com.Count -eq 1 -and -not[string]::IsNullOrEmpty($com[0].guid)) 'CURRENT_NEW_WATCHER';foreach($field in @('pid','parentPid','nodePath','ownerSid','commandLine','creationTime')){Need ($rows[0].$field -ceq $w.$field) 'CURRENT_NEW_WATCHER_UID'}}
 Need (@($intent.runningInstances).Count -eq 2 -and @($intent.tasks).Count -eq 2) 'CURRENT_NEW_COM_PROOF'
 foreach($task in $profile.tasks){$matches=@($intent.tasks|Where-Object{$_.name -ceq $task.name});$instances=@($intent.runningInstances|Where-Object{$_.name -ceq $task.name});Need ($matches.Count -eq 1 -and $instances.Count -eq 1 -and $matches[0].oldXmlSha256 -ceq $task.oldXmlSha256 -and $matches[0].newXmlSha256 -ceq $task.newXmlSha256) 'CURRENT_NEW_TASK_PROOF'}
 $opened=[DateTime]::Parse($cut.windowOpenedAt).ToUniversalTime();$done=[DateTime]::Parse($cut.cutCompletedAt).ToUniversalTime();$old=[DateTime]::Parse($before.observedAt).ToUniversalTime()
 Need (($opened-$old).TotalSeconds -ge 0 -and ($opened-$old).TotalSeconds -lt 900 -and ($done-$opened).TotalSeconds -ge 0 -and ($done-$opened).TotalSeconds -lt 60 -and $done -le [DateTime]::UtcNow) 'CURRENT_NEW_CUT_WINDOW'
 Need (($opened-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()).TotalSeconds -ge 0 -and ($opened-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime()).TotalSeconds -lt 60 -and ($opened-[DateTime]::Parse($rootIntent.observedAt).ToUniversalTime()).TotalSeconds -ge 0 -and ($opened-[DateTime]::Parse($rootIntent.observedAt).ToUniversalTime()).TotalSeconds -lt 60 -and [DateTime]::Parse($claim.ownerObservedAt).ToUniversalTime() -le [DateTime]::Parse($snapshot.observedAt).ToUniversalTime() -and [DateTime]::Parse($drain.observedAt).ToUniversalTime() -ge $done) 'CURRENT_NEW_ADMISSION_WINDOW'
 $raw=NewRawInventory;ProtectedProcesses $raw;$oldPids=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{$_.pid});Need (@($raw.all|Where-Object{$_.ProcessId -in $oldPids}).Count -eq 0) 'CURRENT_NEW_OLD_PRESENT'
}
function NewAuthority{
 foreach($pin in @(@($ProfilePath,$ProfileSha256),@($BeforeImagePath,$BeforeImageSha256),@($CandidatePath,$CandidateSha256),@($EnginePath,$engineSha),@($RecoveryHelperPath,$RecoveryHelperSha256),@($SourceObserverPath,$SourceObserverSha256))){[void](ReadPinned $pin[0] $pin[1])}
 Need ($runId -cmatch '\A[a-f0-9]{32}\z' -and $runId -cne '639e2da815e1e7ac0f1c0d04d7f7bdc3' -and $ProfilePath -ceq (Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json')) -and $BeforeImagePath -ceq (Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json')) -and $EnginePath -ceq (Join-Path $dir $(if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){'p03-physical-rollback-lifetime-v2.ps1'}else{'p03-physical-rollback.ps1'})) -and $RecoveryHelperPath -ceq (Join-Path $dir 'p03-pr54-paused-old-recover.ps1')) 'NEW_OBSERVER_PATH'
 Need ($SourceObserverPath -ceq (Join-Path $dir 'p03-physical-recovery-observe.ps1')) 'NEW_SHARED_OBSERVER_PATH'
 Need ($RecoveryHelperSha256 -ceq 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5') 'NEW_RECOVERY_HELPER_PIN'
 Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.database -ceq $database -and $before.actualT1 -ceq $false -and $profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256) 'NEW_OBSERVER_SCOPE'
 $currentReadRepair=($profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.oldSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $profile.newSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json')
 if($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){
  [void](ReadPinned $DrainerPath $DrainerSha256)
  if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){NewCurrentCutWitness;AssertCurrentB007StaticContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256}elseif($PolicyGeneration -ceq 'B264Sup20DObserveOnly'){AssertB264Sup20DInspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}else{AssertB264InspectionContract $profile $before $oldSettings $newSettings $ProfilePath $BeforeImagePath $BeforeImageSha256 ([DateTime]::UtcNow)}
 }elseif($currentReadRepair){
 Need ($runId-cne'7b0821959737f1da0427b17a7dfd4685'-and$before.oldConfig.sha256-ceq$profile.oldSettings.sha256-and$before.newConfig.sha256-ceq$profile.newSettings.sha256-and$oldSettings.components.erpApiNative.sourceCommit-ceq'e59e07abf7ae2567cdc2adb93811fe29e0032fe5'-and$oldSettings.supervisor.sourceCommit-ceq'13bdf75a032ae8f694354a2e57b6ed382aec2f17') 'CURRENT_NEW_OBSERVER_SETTINGS'
 }else{
 Need ($profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $before.oldConfig.sha256 -ceq $profile.oldSettings.sha256 -and $before.newConfig.sha256 -ceq $profile.newSettings.sha256) 'NEW_OBSERVER_SETTINGS'
 }
 foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false) 'NEW_OBSERVER_SETTINGS_SCOPE'}
 [void](ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);[void](ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
 if($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){
  Need ($engineSha -ceq $(if($PolicyGeneration -ceq 'CurrentB007ObserveOnly'){'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'}else{'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'})) 'B264_NEW_ENGINE'
 }elseif($currentReadRepair){
 foreach($pin in @(@($newSettings.components.erpApiNative,'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2','8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'),@($newSettings.components.crm,'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'))){Need ($pin[0].sourceCommit-ceq$pin[1]-and$pin[0].manifestSha256-ceq$pin[2]) 'CURRENT_NEW_OBSERVER_SOURCE'}
 Need ($newSettings.supervisor.sourceCommit-cmatch'^[a-f0-9]{40}$'-and$newSettings.supervisor.manifestSha256-cmatch'^[a-f0-9]{64}$'-and$newSettings.supervisor.sourceCommit-cne'13bdf75a032ae8f694354a2e57b6ed382aec2f17'-and$newSettings.supervisor.packageRoot-ceq('C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-'+$newSettings.supervisor.sourceCommit.Substring(0,12))) 'CURRENT_NEW_OBSERVER_SUPERVISOR'
 }else{
 foreach($pin in @(@($newSettings.components.erpApiNative,'e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),@($newSettings.components.crm,'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),@($newSettings.supervisor,'13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'))){Need ($pin[0].sourceCommit -ceq $pin[1] -and $pin[0].manifestSha256 -ceq $pin[2]) 'NEW_OBSERVER_SOURCE'}
 }
 foreach($package in $profile.packages){Need ($package.manifestPath -ceq (Join-Path $package.root 'release-manifest.json')) 'NEW_MANIFEST_PATH';[void](NewSourceBytes $package.manifestPath $package.manifestSha256)}
 NewPrepareProbeSource
}
function NewB264ProbePolicy{
 Need ($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')) 'B264_NEW_POLICY'
 ObserverImportDefinition (ReadPinned $EnginePath $engineSha) 'Tokens' 'ObserverImportedTokens'
 ObserverImportDefinition (ReadPinned $RecoveryHelperPath $RecoveryHelperSha256) 'ProbeArgumentsAllowed' 'ObserverImportedProbeArgumentsAllowed'
 $settings=$newSettings;$supervisor=$settings.supervisor;$core=$script:newCandidateIdentities.coreSupervisor
 $rules=@($profile.candidateRules|Where-Object{$_.role -ceq 'coreSupervisor'})
 Need ($rules.Count -eq 1 -and $core.ownerSid -ceq $owner -and $core.nodePath -ceq $settings.node.path -and $rules[0].nodePath -ceq $core.nodePath -and $rules[0].packageRoot -ceq $supervisor.packageRoot -and $rules[0].sourceCommit -ceq $supervisor.sourceCommit -and $rules[0].config.path -ceq $profile.newSettings.path -and $rules[0].config.sha256 -ceq $profile.newSettings.sha256 -and ((Tokens $core.commandLine)|ConvertTo-Json -Compress) -ceq ((Tokens $rules[0].commandLine)|ConvertTo-Json -Compress)) 'B264_NEW_CORE_POLICY'
 foreach($binary in @($settings.node,$profile.shell)){ObserverPolicyBinary $binary}
 return [pscustomobject]@{profile=$profile;identityMap=$script:newCandidateIdentities;generation='New';core=$core;engineRef=[pscustomobject]@{path=$EnginePath;sha256=$engineSha};helperRef=[pscustomobject]@{path=$RecoveryHelperPath;sha256=$RecoveryHelperSha256};settingsRef=$profile.newSettings;manifestRef=[pscustomobject]@{path=(Join-Path $supervisor.packageRoot 'release-manifest.json');sha256=$supervisor.manifestSha256};probeRef=[pscustomobject]@{path=$script:newProbeSource.probePath;sha256=$script:newProbeSource.probeSha256};nodeRef=$settings.node;shellRef=$profile.shell}
}
function NewB264CandidateInventoryCore($evidence){
 [void](AssertOldPidLifetimes (Inventory))
 $result=NewCandidateInventoryCore $evidence
 [void](AssertOldPidLifetimes $result.inventory)
 return $result
}
function NewProbeArgvAllowed($argv){
 # Dynamic scope is deliberately local: helper optional -ProcessId arguments
 # must refer to the current NEW candidate, never the historical before-image.
 $before=[pscustomobject]@{identities=$script:newCandidateIdentities}
 return (ProbeArgumentsAllowed $argv $script:newProbeSource.probePath)
}
function NewProtectedPids($inventory){
 return @(@($script:newCandidateIdentities.PSObject.Properties|ForEach-Object{$_.Value.pid})+@($before.identities.PSObject.Properties|ForEach-Object{$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{$_.pid})+@($profile.protectedProcesses|ForEach-Object{$_.pid})+@($inventory.instances|ForEach-Object{$_.EnginePID})+@($inventory.allListeners|ForEach-Object{$_.OwningProcess})|Sort-Object -Unique)
}
function NewProbeConsole($process,$parent,$rawSnapshot,$protectedPids){
 Need ($process.Name -ieq 'conhost.exe' -and $process.ExecutablePath -ieq 'C:\Windows\System32\conhost.exe' -and $process.CommandLine -ceq '\??\C:\WINDOWS\system32\conhost.exe 0x4' -and $process.ParentProcessId -eq $parent.ProcessId -and [int]$process.ProcessId -gt 0 -and $process.ProcessId -notin $protectedPids) 'NEW_PROBE_CONSOLE_SOURCE'
 $born=$process.CreationDate.ToUniversalTime();Need ($born -ge $parent.CreationDate.ToUniversalTime() -and $born -le (NewNow)) 'NEW_PROBE_CONSOLE_BIRTH'
 Need (@($rawSnapshot.all|Where-Object{$_.ParentProcessId -eq $process.ProcessId}).Count -eq 0 -and @($rawSnapshot.allListeners|Where-Object{$_.OwningProcess -eq $process.ProcessId}).Count -eq 0) 'NEW_PROBE_CONSOLE_DESCENDANT'
 ObserverPinnedConsoleBinary
 $pin=[pscustomobject]@{pid=[int]$process.ProcessId;parentPid=[int]$process.ParentProcessId;nodePath='C:\Windows\System32\conhost.exe';ownerSid=$script:newCandidateIdentities.coreSupervisor.ownerSid;commandLine=[string]$process.CommandLine;creationTime=$born.ToString('o')}
 try{Need (Identity $process $pin) 'NEW_PROBE_CONSOLE_IDENTITY'}catch{if(-not (ObserverExactNotFound $_)){throw};return (ObserverVanishedConsole $_ $process $rawSnapshot.selected $protectedPids $rawSnapshot.all $rawSnapshot.allListeners)}
 $fresh=@(Get-CimInstance Win32_Process -ErrorAction Stop);$current=@($fresh|Where-Object{$_.ProcessId -eq $process.ProcessId})
 if($current.Count -eq 0){throw 'P03_NEW_PROBE_EXIT_RECAPTURE'}
 Need ($current.Count -eq 1 -and @($fresh|Where-Object{$_.ParentProcessId -eq $process.ProcessId}).Count -eq 0) 'NEW_PROBE_CONSOLE_FAMILY'
 if($current.Count -eq 1){try{Need (Identity $current[0] $pin) 'NEW_PROBE_CONSOLE_REUSED'}catch{if(-not (ObserverExactNotFound $_)){throw};return (ObserverVanishedConsole $_ $process $rawSnapshot.selected $protectedPids $rawSnapshot.all $rawSnapshot.allListeners)}}
 Need (@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.OwningProcess -eq $process.ProcessId}).Count -eq 0) 'NEW_PROBE_CONSOLE_LISTENER'
 return $null
}
function NewFilteredInventory($inventory){
 $core=$script:newCandidateIdentities.coreSupervisor;$parents=@($inventory.all|Where-Object{$_.ProcessId -eq $core.pid})
 Need ($parents.Count -eq 1 -and (Identity $parents[0] $core)) 'NEW_PROBE_CORE'
 $excluded=@();$audits=@();$rawSnapshot=[pscustomobject]@{all=$inventory.all;selected=$inventory.all;allListeners=$inventory.allListeners};$protectedPids=@(NewProtectedPids $inventory)
 foreach($process in @($inventory.all|Sort-Object CreationDate -Descending)){
  $looks=($process.ParentProcessId -eq $core.pid -and $process.Name -ieq 'powershell.exe') -or ([string]$process.CommandLine).IndexOf($script:newProbeSource.probePath,[StringComparison]::OrdinalIgnoreCase) -ge 0
  if(-not $looks){continue}
  Need ($process.ParentProcessId -eq $core.pid -and $process.Name -ieq 'powershell.exe' -and [int]$process.ProcessId -gt 0 -and [int]$process.ProcessId -ne $core.pid) 'NEW_PROBE_PARENT'
  $born=$process.CreationDate.ToUniversalTime();Need ($born -ge [DateTime]::Parse($core.creationTime).ToUniversalTime() -and $born -le (NewNow)) 'NEW_PROBE_BIRTH'
  # A missing binary/command may only cause a complete recapture after the
  # exact parent's genuine process has disappeared. It never grants admission.
  if(($process.ExecutablePath -ieq $profile.shell.path -or -not $process.ExecutablePath) -and (-not $process.ExecutablePath -or -not $process.CommandLine)){
   $fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$process.ProcessId) -ErrorAction Stop);if($fresh.Count -eq 0){throw 'P03_NEW_PROBE_EXIT_RECAPTURE'}
  }
  Need ($process.ExecutablePath -ieq $profile.shell.path -and (NewProbeArgvAllowed (Tokens ([string]$process.CommandLine)))) 'NEW_PROBE_ARGV'
  $pin=[pscustomobject]@{pid=[int]$process.ProcessId;parentPid=[int]$process.ParentProcessId;nodePath=$profile.shell.path;ownerSid=$core.ownerSid;commandLine=[string]$process.CommandLine;creationTime=$born.ToString('o')}
  $matches=$false;$vanished=$false
  try{$matches=Identity $process $pin}catch{if(ObserverExactNotFound $_){$audits+=,(ObserverTryVanishedProbe $process $_ $rawSnapshot $protectedPids $script:newProbePolicy);$vanished=$true}else{$fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$process.ProcessId) -ErrorAction Stop);if($fresh.Count -eq 0){throw 'P03_NEW_PROBE_EXIT_RECAPTURE'};throw}}
  Need ($matches -or $vanished) 'NEW_PROBE_IDENTITY'
  Need (@($inventory.allListeners|Where-Object{$_.OwningProcess -eq $process.ProcessId}).Count -eq 0) 'NEW_PROBE_LISTENER'
  foreach($child in @($inventory.all|Where-Object{$_.ParentProcessId -eq $process.ProcessId}|Sort-Object CreationDate -Descending)){$audit=NewProbeConsole $child $process $rawSnapshot $protectedPids;if($null -ne $audit){$audits+=,$audit};$excluded+=,[int]$child.ProcessId}
  $excluded+=,[int]$process.ProcessId
 }
 ObserverAssertVanishedAudits $audits $rawSnapshot $script:newProbePolicy
 $script:newFrameVanishedAudits+=@($audits)
 if($audits.Count){$script:newFrameAuditSnapshots+=,[pscustomobject]@{audits=$audits;rawSnapshot=$rawSnapshot}}
 return [pscustomobject]@{all=@($inventory.all|Where-Object{$_.ProcessId -notin $excluded});allListeners=$inventory.allListeners;listeners=$inventory.listeners;instances=$inventory.instances;vanishedAuxiliaries=$audits}
}
function Inventory{
 for($attempt=0;$attempt -lt 3;$attempt++){try{return NewFilteredInventory (NewRawInventory)}catch{if($_.Exception.Message -cne 'P03_NEW_PROBE_EXIT_RECAPTURE'){throw};if($attempt -eq 2){throw 'P03_NEW_PROBE_EXIT_RECAPTURE_EXHAUSTED'}}}
}
function NewNow{return [DateTime]::UtcNow}
function NewAssertTasks{
 Need (@($profile.tasks).Count -eq 2 -and (@($profile.tasks|ForEach-Object{$_.name}|Sort-Object)-join '|') -ceq (($names|Sort-Object)-join '|')) 'NEW_TASK_NAMES'
 foreach($entry in $profile.tasks){$task=$folder.GetTask($entry.name);Need ([int]$task.State -eq 4 -and (XmlHash ([string]$task.Xml)) -ceq $entry.newXmlSha256) 'NEW_TASK_XML'}
}
function NewFullOwner($evidence){
 # The fixed 13b supervisor requires LAN listeners for API4184, CRM62700 and
 # Hub5234. Its manifest-pinned entry is checked by NewPrepareProbeSource.
 # Candidate identity/receipt/source admission and Health remain the fe code.
 TaskPhase 'new';$seen=CandidateInventory $evidence
 Need ($seen.selected.Count -eq 10 -and $seen.inventory.instances.Count -eq 2 -and $seen.inventory.listeners.Count -eq 11) 'NEW_OWNER_INCOMPLETE'
 $bindings=@{
  hub=@('5234|127.0.0.1','5234|192.168.1.46');erpApi=@('4184|127.0.0.1','4184|192.168.1.46')
  crmServer=@('62700|127.0.0.1','62700|192.168.1.46','62701|127.0.0.1');erpNative=@('4186|127.0.0.1')
  crmNativeOrder=@('62704|127.0.0.1');crmCatalog=@('62702|127.0.0.1');crmOrders=@('62703|127.0.0.1')
  coreSupervisor=@();terminalWatcher=@();hubWatcher=@()
 }
 foreach($row in $seen.selected){
  Need ($bindings.ContainsKey([string]$row.role)) 'NEW_ROLE'
  $expected=@($bindings[$row.role]);$actual=@($seen.inventory.allListeners|Where-Object{$_.OwningProcess -eq $row.pid})
  Need ($actual.Count -eq $expected.Count -and @($row.bindings).Count -eq $expected.Count) 'NEW_ROLE_BINDING_COUNT'
  foreach($pair in $expected){$parts=$pair.Split('|');$port=[int]$parts[0];$address=$parts[1]
   Need (@($actual|Where-Object{$_.LocalPort -eq $port -and $_.LocalAddress -ceq $address}).Count -eq 1 -and @($row.bindings|Where-Object{$_.port -eq $port -and $_.address -ceq $address}).Count -eq 1) 'NEW_ROLE_BINDING'
  }
 }
 Health $seen.selected 'new'
 $stable=[ordered]@{processes=@($seen.selected|Sort-Object pid);instances=@($seen.inventory.instances|ForEach-Object{[ordered]@{name=[string]$_.Name;pid=[int]$_.EnginePID;guid=[string]$_.InstanceGuid}}|Sort-Object name)}
 return (Hash ([Text.UTF8Encoding]::new($false).GetBytes(($stable|ConvertTo-Json -Depth 12 -Compress))))
}
function NewFrame($evidence){
 $script:newFrameVanishedAudits=@();$script:newFrameAuditSnapshots=@()
 $script:historicalPidReuseAudits=@();$script:historicalPidReuseFrames=@()
 NewAuthority;NewAssertTasks
 $digest=NewFullOwner $evidence
 ProtectedProcesses (Inventory);NewAssertTasks
 # Recheck each audit against its original raw descendant links and a fresh
 # global inventory; audit rows never become active owner or stop identities.
 foreach($auditFrame in $script:newFrameAuditSnapshots){ObserverAssertVanishedAudits $auditFrame.audits $auditFrame.rawSnapshot $script:newProbePolicy}
 NewRevalidateHistoricalAudits
 Need ($digest -cmatch '\A[a-f0-9]{64}\z') 'NEW_OBSERVER_DIGEST';return $digest
}
function ObserveNewOwner($evidence){
 if($Mode -ceq 'DryRun'){$digest=NewFrame $evidence;return [ordered]@{status='NEW_OWNER_OBSERVATION_DRY_RUN';identityDigest=$digest;sourceObserverSha256=$SourceObserverSha256;vanishedAuxiliaries=$script:newFrameVanishedAudits;historicalPidReuseAudits=$script:historicalPidReuseAudits;mutationExecuted=$false}}
 $deadline=(NewNow).AddMinutes(10);$stableSince=$null;$stableDigest=$null;$lastFailureCode='P03_NEW_OWNER_NO_STABLE_FRAME'
 while((NewNow) -lt $deadline){
  $digest=$null;try{$digest=NewFrame $evidence}catch{$stableSince=$null;$stableDigest=$null;$safe=[regex]::Match($_.Exception.Message,'\AP03_[A-Z_]{1,100}\z').Value;$lastFailureCode=if($safe){$safe}else{'P03_NEW_OWNER_FRAME_UNCLASSIFIED'}}
  if($null -ne $digest){if($null -eq $stableSince -or $digest -cne $stableDigest){$stableSince=NewNow;$stableDigest=$digest};$now=NewNow
   if(($now-$stableSince).TotalSeconds -ge 30 -and $now -lt $deadline){NewAuthority;NewRevalidateHistoricalAudits;return [ordered]@{status='NEW_OWNER_OBSERVED_READY';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;candidateSha256=$CandidateSha256;engineSha256=$engineSha;sourceObserverSha256=$SourceObserverSha256;identityDigest=$stableDigest;observedAt=(NewNow).ToString('o');sourceProof=$script:newProbeSource;vanishedAuxiliaries=$script:newFrameVanishedAudits;historicalPidReuseAudits=$script:historicalPidReuseAudits;stableSeconds=30;mutationExecuted=$false}}
  }
  Start-Sleep -Milliseconds 500
 }
 throw ('P03_NEW_OWNER_NOT_STABLE_'+$lastFailureCode)
}
if($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){. ([scriptblock]::Create('function script:CandidateInventoryCore($evidence){return NewB264CandidateInventoryCore $evidence}'))}
NewAssertHubLineageEquivalence
NewAssertCandidateInventoryEquivalence
NewAuthority
$evidence=AdmitCandidate
Need (@($evidence.processes).Count -eq 10 -and @($evidence.processes|Select-Object -ExpandProperty role -Unique).Count -eq 10) 'NEW_CANDIDATE_COUNT'
$script:newCandidateIdentities=[pscustomobject]@{};foreach($row in $evidence.processes){$script:newCandidateIdentities|Add-Member NoteProperty $row.role $row}
$script:newProbePolicy=if($PolicyGeneration -cin @('B264ObserveOnly','B264Sup20DObserveOnly','CurrentB007ObserveOnly')){NewB264ProbePolicy}else{ObserverInitializeProbePolicy $profile $before $script:newCandidateIdentities 'New' ([pscustomobject]@{path=$EnginePath;sha256=$engineSha}) ([pscustomobject]@{path=$RecoveryHelperPath;sha256=$RecoveryHelperSha256})}
ObserveNewOwner $evidence|ConvertTo-Json -Depth 10 -Compress
