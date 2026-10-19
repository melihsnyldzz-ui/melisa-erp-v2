param(
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
# Separate read-only NEW observation. The frozen engine is imported only as
# function definitions. No engine PASS/event, task action or process is written.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$name+'\'+$name+'.psd1')) -ErrorAction Stop}
$invokedAtUtc=[DateTime]::UtcNow
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$engineSha='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'
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
 $manifest=Json (NewSourceBytes (Join-Path $root 'release-manifest.json') $supervisor.manifestSha256)
 if($supervisor.sourceCommit-ceq'13bdf75a032ae8f694354a2e57b6ed382aec2f17'){
 Need ($manifest.sourceCommit -ceq '13bdf75a032ae8f694354a2e57b6ed382aec2f17' -and $manifest.sourceCommit -ceq $supervisor.sourceCommit) 'NEW_PROBE_MANIFEST'
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
 $old='$p.ProcessId -in $oldPids';$replacement='(NewHistoricalOldPidRelevant $p $oldPids $inventory $evidence)'
 Need ([regex]::Matches($script:newFrozenCandidateInventoryBody,[regex]::Escape($old)).Count -eq 1) 'NEW_CANDIDATE_INVENTORY_SOURCE'
 $expected=$script:newFrozenCandidateInventoryBody.Replace($old,$replacement).Replace("`r`n","`n").Trim()
 $definition=(Get-Command NewCandidateInventoryCore -CommandType Function).ScriptBlock.Ast
 Need ($definition -is [Management.Automation.Language.FunctionDefinitionAst] -and $definition.Name -ceq 'NewCandidateInventoryCore') 'NEW_CANDIDATE_INVENTORY_DEFINITION'
 Need ($definition.Body.Extent.Text.Replace("`r`n","`n").Trim() -ceq $expected) 'NEW_CANDIDATE_INVENTORY_EQUIVALENCE'
}
function CandidateInventoryCore($evidence){return NewCandidateInventoryCore $evidence}
function NewAuthority{
 foreach($pin in @(@($ProfilePath,$ProfileSha256),@($BeforeImagePath,$BeforeImageSha256),@($CandidatePath,$CandidateSha256),@($EnginePath,$engineSha),@($RecoveryHelperPath,$RecoveryHelperSha256),@($SourceObserverPath,$SourceObserverSha256))){[void](ReadPinned $pin[0] $pin[1])}
 Need ($runId -cmatch '\A[a-f0-9]{32}\z' -and $runId -cne '639e2da815e1e7ac0f1c0d04d7f7bdc3' -and $ProfilePath -ceq (Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json')) -and $BeforeImagePath -ceq (Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json')) -and $EnginePath -ceq (Join-Path $dir 'p03-physical-rollback.ps1') -and $RecoveryHelperPath -ceq (Join-Path $dir 'p03-pr54-paused-old-recover.ps1')) 'NEW_OBSERVER_PATH'
 Need ($SourceObserverPath -ceq (Join-Path $dir 'p03-physical-recovery-observe.ps1')) 'NEW_SHARED_OBSERVER_PATH'
 Need ($RecoveryHelperSha256 -ceq 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5') 'NEW_RECOVERY_HELPER_PIN'
 Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.database -ceq $database -and $before.actualT1 -ceq $false -and $profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256) 'NEW_OBSERVER_SCOPE'
 $currentReadRepair=($profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $profile.oldSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json' -and $profile.newSettings.path -ceq 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json')
 if($currentReadRepair){
 Need ($runId-cne'7b0821959737f1da0427b17a7dfd4685'-and$before.oldConfig.sha256-ceq$profile.oldSettings.sha256-and$before.newConfig.sha256-ceq$profile.newSettings.sha256-and$oldSettings.components.erpApiNative.sourceCommit-ceq'e59e07abf7ae2567cdc2adb93811fe29e0032fe5'-and$oldSettings.supervisor.sourceCommit-ceq'13bdf75a032ae8f694354a2e57b6ed382aec2f17') 'CURRENT_NEW_OBSERVER_SETTINGS'
 }else{
 Need ($profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $before.oldConfig.sha256 -ceq $profile.oldSettings.sha256 -and $before.newConfig.sha256 -ceq $profile.newSettings.sha256) 'NEW_OBSERVER_SETTINGS'
 }
 foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false) 'NEW_OBSERVER_SETTINGS_SCOPE'}
 [void](ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);[void](ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
 if($currentReadRepair){
 foreach($pin in @(@($newSettings.components.erpApiNative,'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2','8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'),@($newSettings.components.crm,'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'))){Need ($pin[0].sourceCommit-ceq$pin[1]-and$pin[0].manifestSha256-ceq$pin[2]) 'CURRENT_NEW_OBSERVER_SOURCE'}
 Need ($newSettings.supervisor.sourceCommit-cmatch'^[a-f0-9]{40}$'-and$newSettings.supervisor.manifestSha256-cmatch'^[a-f0-9]{64}$'-and$newSettings.supervisor.sourceCommit-cne'13bdf75a032ae8f694354a2e57b6ed382aec2f17'-and$newSettings.supervisor.packageRoot-ceq('C:\Sirket\ERP\releases\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-'+$newSettings.supervisor.sourceCommit.Substring(0,12))) 'CURRENT_NEW_OBSERVER_SUPERVISOR'
 }else{
 foreach($pin in @(@($newSettings.components.erpApiNative,'e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),@($newSettings.components.crm,'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),@($newSettings.supervisor,'13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'))){Need ($pin[0].sourceCommit -ceq $pin[1] -and $pin[0].manifestSha256 -ceq $pin[2]) 'NEW_OBSERVER_SOURCE'}
 }
 foreach($package in $profile.packages){Need ($package.manifestPath -ceq (Join-Path $package.root 'release-manifest.json')) 'NEW_MANIFEST_PATH';[void](NewSourceBytes $package.manifestPath $package.manifestSha256)}
 NewPrepareProbeSource
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
NewAssertHubLineageEquivalence
NewAssertCandidateInventoryEquivalence
NewAuthority
$evidence=AdmitCandidate
Need (@($evidence.processes).Count -eq 10 -and @($evidence.processes|Select-Object -ExpandProperty role -Unique).Count -eq 10) 'NEW_CANDIDATE_COUNT'
$script:newCandidateIdentities=[pscustomobject]@{};foreach($row in $evidence.processes){$script:newCandidateIdentities|Add-Member NoteProperty $row.role $row}
$script:newProbePolicy=ObserverInitializeProbePolicy $profile $before $script:newCandidateIdentities 'New' ([pscustomobject]@{path=$EnginePath;sha256=$engineSha}) ([pscustomobject]@{path=$RecoveryHelperPath;sha256=$RecoveryHelperSha256})
ObserveNewOwner $evidence|ConvertTo-Json -Depth 10 -Compress
