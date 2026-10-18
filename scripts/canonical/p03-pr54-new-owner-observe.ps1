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
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$RecoveryHelperSha256
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
 foreach($definition in $definitions){$name=if($definition.Name -ceq 'Inventory'){'NewRawInventory'}else{$definition.Name};. ([scriptblock]::Create('function script:'+$name+$definition.Extent.Text.Substring(('function '+$definition.Name).Length)))}
}
if($EngineSha256 -cne $engineSha){throw 'P03_NEW_OBSERVER_ENGINE'}
ImportNewObserverFunctions (NewObserverPin $EnginePath $engineSha)
ImportNewObserverFunctions (NewObserverPin $RecoveryHelperPath $RecoveryHelperSha256) @('ProbeArgumentsAllowed')
$profile=Json (ReadPinned $ProfilePath $ProfileSha256);$before=Json (ReadPinned $BeforeImagePath $BeforeImageSha256)
$runId=$before.runId;$dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
$Environment='Shared';$isRehearsal=$false;$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
$script:parentPins=@{};$script:watcherPins=@{};$script:consolePins=@{};$script:tasksStopRequested=$false
$script:newCandidateIdentities=$null;$script:newProbeSource=$null
function NewSourceBytes([string]$path,[string]$sha){
 NoReparse $path;$stream=[IO.File]::Open($path,'Open','Read','None')
 try{Need ($stream.Length -gt 0 -and $stream.Length -le 16777216) 'NEW_SOURCE_SIZE';$memory=[IO.MemoryStream]::new();$stream.CopyTo($memory);$bytes=$memory.ToArray();Need ((Hash $bytes) -ceq $sha) 'NEW_SOURCE_HASH';return ,$bytes}finally{$stream.Dispose()}
}
function NewPrepareProbeSource{
 $supervisor=$newSettings.supervisor;$root=$supervisor.packageRoot
 $manifest=Json (NewSourceBytes (Join-Path $root 'release-manifest.json') $supervisor.manifestSha256)
 Need ($manifest.sourceCommit -ceq '13bdf75a032ae8f694354a2e57b6ed382aec2f17' -and $manifest.sourceCommit -ceq $supervisor.sourceCommit) 'NEW_PROBE_MANIFEST'
 $files=@($manifest.files|Where-Object{$_.path -ceq 'scripts/canonical/hub-stack-process-probe.ps1'})
 Need ($files.Count -eq 1 -and $files[0].sha256 -cmatch '\A[a-f0-9]{64}\z') 'NEW_PROBE_FILE'
 $probe=Join-Path $root 'scripts\canonical\hub-stack-process-probe.ps1';[void](NewSourceBytes $probe $files[0].sha256)
 NoReparse $profile.shell.path;Need ($profile.shell.path -ceq 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -and (Get-FileHash -LiteralPath $profile.shell.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $profile.shell.sha256) 'NEW_PROBE_SHELL'
 $script:newProbeSource=[ordered]@{supervisorSourceCommit=$manifest.sourceCommit;supervisorManifestSha256=$supervisor.manifestSha256;probePath=$probe;probeSha256=$files[0].sha256;shellSha256=$profile.shell.sha256;recoveryHelperSha256=$RecoveryHelperSha256}
}
function NewAuthority{
 foreach($pin in @(@($ProfilePath,$ProfileSha256),@($BeforeImagePath,$BeforeImageSha256),@($CandidatePath,$CandidateSha256),@($EnginePath,$engineSha),@($RecoveryHelperPath,$RecoveryHelperSha256))){[void](ReadPinned $pin[0] $pin[1])}
 Need ($runId -cmatch '\A[a-f0-9]{32}\z' -and $runId -cne '639e2da815e1e7ac0f1c0d04d7f7bdc3' -and $ProfilePath -ceq (Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json')) -and $BeforeImagePath -ceq (Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json')) -and $EnginePath -ceq (Join-Path $dir 'p03-physical-rollback.ps1') -and $RecoveryHelperPath -ceq (Join-Path $dir 'p03-pr54-paused-old-recover.ps1')) 'NEW_OBSERVER_PATH'
 Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.database -ceq $database -and $before.actualT1 -ceq $false -and $profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256) 'NEW_OBSERVER_SCOPE'
 Need ($profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $before.oldConfig.sha256 -ceq $profile.oldSettings.sha256 -and $before.newConfig.sha256 -ceq $profile.newSettings.sha256) 'NEW_OBSERVER_SETTINGS'
 foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false) 'NEW_OBSERVER_SETTINGS_SCOPE'}
 [void](ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);[void](ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
 foreach($pin in @(@($newSettings.components.erpApiNative,'e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'),@($newSettings.components.crm,'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'),@($newSettings.supervisor,'13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'))){Need ($pin[0].sourceCommit -ceq $pin[1] -and $pin[0].manifestSha256 -ceq $pin[2]) 'NEW_OBSERVER_SOURCE'}
 foreach($package in $profile.packages){Need ($package.manifestPath -ceq (Join-Path $package.root 'release-manifest.json')) 'NEW_MANIFEST_PATH';[void](NewSourceBytes $package.manifestPath $package.manifestSha256)}
 NewPrepareProbeSource
}
function NewProbeArgvAllowed($argv){
 # Dynamic scope is deliberately local: helper optional -ProcessId arguments
 # must refer to the current NEW candidate, never the historical before-image.
 $before=[pscustomobject]@{identities=$script:newCandidateIdentities}
 return (ProbeArgumentsAllowed $argv $script:newProbeSource.probePath)
}
function NewFilteredInventory($inventory){
 $core=$script:newCandidateIdentities.coreSupervisor;$parents=@($inventory.all|Where-Object{$_.ProcessId -eq $core.pid})
 Need ($parents.Count -eq 1 -and (Identity $parents[0] $core)) 'NEW_PROBE_CORE'
 $excluded=@()
 foreach($process in $inventory.all){
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
  try{$matches=Identity $process $pin}catch{$fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$process.ProcessId) -ErrorAction Stop);if($fresh.Count -eq 0){throw 'P03_NEW_PROBE_EXIT_RECAPTURE'};throw}
  Need $matches 'NEW_PROBE_IDENTITY'
  Need (@($inventory.allListeners|Where-Object{$_.OwningProcess -eq $process.ProcessId}).Count -eq 0) 'NEW_PROBE_LISTENER'
  Need (@($inventory.all|Where-Object{$_.ParentProcessId -eq $process.ProcessId}).Count -eq 0) 'NEW_PROBE_DESCENDANT'
  $excluded+=,[int]$process.ProcessId
 }
 return [pscustomobject]@{all=@($inventory.all|Where-Object{$_.ProcessId -notin $excluded});allListeners=$inventory.allListeners;listeners=$inventory.listeners;instances=$inventory.instances}
}
function Inventory{
 for($attempt=0;$attempt -lt 3;$attempt++){try{return NewFilteredInventory (NewRawInventory)}catch{if($_.Exception.Message -cne 'P03_NEW_PROBE_EXIT_RECAPTURE'){throw};if($attempt -eq 2){throw 'P03_NEW_PROBE_EXIT_RECAPTURE_EXHAUSTED'}}}
}
function NewNow{return [DateTime]::UtcNow}
function NewAssertTasks{
 Need (@($profile.tasks).Count -eq 2 -and (@($profile.tasks|ForEach-Object{$_.name}|Sort-Object)-join '|') -ceq (($names|Sort-Object)-join '|')) 'NEW_TASK_NAMES'
 foreach($entry in $profile.tasks){$task=$folder.GetTask($entry.name);Need ([int]$task.State -eq 4 -and (XmlHash ([string]$task.Xml)) -ceq $entry.newXmlSha256) 'NEW_TASK_XML'}
}
function NewFrame($evidence){
 NewAuthority;NewAssertTasks
 $digest=NewFullOwner $evidence
 ProtectedProcesses (Inventory);NewAssertTasks
 Need ($digest -cmatch '\A[a-f0-9]{64}\z') 'NEW_OBSERVER_DIGEST';return $digest
}
function ObserveNewOwner($evidence){
 if($Mode -ceq 'DryRun'){$digest=NewFrame $evidence;return [ordered]@{status='NEW_OWNER_OBSERVATION_DRY_RUN';identityDigest=$digest;mutationExecuted=$false}}
 $deadline=(NewNow).AddMinutes(10);$stableSince=$null;$stableDigest=$null
 while((NewNow) -lt $deadline){
  $digest=$null;try{$digest=NewFrame $evidence}catch{$stableSince=$null;$stableDigest=$null}
  if($null -ne $digest){if($null -eq $stableSince -or $digest -cne $stableDigest){$stableSince=NewNow;$stableDigest=$digest};$now=NewNow
   if(($now-$stableSince).TotalSeconds -ge 30 -and $now -lt $deadline){NewAuthority;return [ordered]@{status='NEW_OWNER_OBSERVED_READY';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;candidateSha256=$CandidateSha256;engineSha256=$engineSha;identityDigest=$stableDigest;observedAt=(NewNow).ToString('o');sourceProof=$script:newProbeSource;stableSeconds=30;mutationExecuted=$false}}
  }
  Start-Sleep -Milliseconds 500
 }
 throw 'P03_NEW_OWNER_NOT_STABLE'
}
NewAuthority
$evidence=AdmitCandidate
Need (@($evidence.processes).Count -eq 10 -and @($evidence.processes|Select-Object -ExpandProperty role -Unique).Count -eq 10) 'NEW_CANDIDATE_COUNT'
$script:newCandidateIdentities=[pscustomobject]@{};foreach($row in $evidence.processes){$script:newCandidateIdentities|Add-Member NoteProperty $row.role $row}
ObserveNewOwner $evidence|ConvertTo-Json -Depth 10 -Compress
