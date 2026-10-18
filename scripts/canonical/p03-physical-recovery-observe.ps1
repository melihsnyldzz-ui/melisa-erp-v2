param(
 [ValidateSet('Shared','Rehearsal')][string]$Environment='Shared',
 [ValidateSet('Physical','CandidateProposal')][string]$Purpose='Physical',
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BeforeImageSha256,
 [string]$ProfilePath,[string]$ProfileSha256,[string]$EnginePath,[string]$EngineSha256,[string]$RecoveryHelperPath,[string]$RecoveryHelperSha256
)
# Read-only physical collection. This script never authorizes stop/start/restore.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_OWNER'}
function ObserverRequire($condition){if(-not $condition){throw 'P03_VANISHED_CONSOLE_REJECTED'}}
function ObserverExactNotFound($failure){
 # CIM can expose the generic CLR HResult while preserving the native WMI
 # status in Invoke-CimMethod's exact structured error ID. Never parse Message.
 return $failure.Exception.GetType().FullName -ceq 'Microsoft.Management.Infrastructure.CimException' -and [string]$failure.CategoryInfo.Category -ceq 'ObjectNotFound' -and $failure.FullyQualifiedErrorId -ceq 'HRESULT 0x80041002,Microsoft.Management.Infrastructure.CimCmdlets.InvokeCimMethodCommand' -and $failure.Exception.HResult -in @(-2147217406,-2146233088)
}
function ObserverKernelAbsent([int]$targetPid){
 ObserverRequire ($targetPid -gt 0)
 # Only GetProcessById's own positive-PID ArgumentException means absent.
 # AccessDenied and all other errors propagate; a returned process is live.
 try{$managed=[Diagnostics.Process]::GetProcessById($targetPid)}catch [ArgumentException]{return $true}
 try{return $false}finally{$managed.Dispose()}
}
function ObserverPinnedConsoleBinary{
 $binary='C:\Windows\System32\conhost.exe'
 for($part=$binary;$part;$part=[IO.Path]::GetDirectoryName($part)){ObserverRequire (((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)}
 ObserverRequire ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant() -ceq 'c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac')
 $signature=Get-AuthenticodeSignature -LiteralPath $binary
 ObserverRequire ($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -ceq 'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US')
}
function ObserverAssertAbsentFamily($evidence,$rawAll,$rawListeners){
 $fresh=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 $family=[Collections.Generic.HashSet[int]]::new();[void]$family.Add([int]$evidence.pid)
 # Retain raw links too: an exited intermediate parent must not hide a live
 # grandchild or a reused descendant PID in the newer global inventory.
 do{$added=$false;foreach($row in @($rawAll)+@($fresh)){if($family.Contains([int]$row.ParentProcessId) -and $family.Add([int]$row.ProcessId)){$added=$true}}}while($added)
 ObserverRequire (@($fresh|Where-Object{$family.Contains([int]$_.ProcessId)}).Count -eq 0)
 ObserverRequire (ObserverKernelAbsent ([int]$evidence.pid))
 $freshListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 ObserverRequire (@(@($rawListeners)+@($freshListeners)|Where-Object{$family.Contains([int]$_.OwningProcess)}).Count -eq 0)
}
function ObserverVanishedConsole($failure,$process,$rawSelected,$capturedPids,$rawAll,$rawListeners){
 ObserverRequire (ObserverExactNotFound $failure)
 ObserverRequire ($process.Name -ieq 'conhost.exe' -and $process.ExecutablePath -ieq 'C:\Windows\System32\conhost.exe' -and $process.CommandLine -ceq '\??\C:\WINDOWS\system32\conhost.exe 0x4' -and [int]$process.ProcessId -gt 0 -and [int]$process.ParentProcessId -gt 0 -and [int]$process.ProcessId -ne [int]$process.ParentProcessId -and $process.CreationDate -is [DateTime])
 ObserverRequire ($process.ProcessId -notin @($capturedPids) -and @($rawListeners|Where-Object{$_.OwningProcess -eq $process.ProcessId}).Count -eq 0)
 $parents=@($rawSelected|Where-Object{$_.ProcessId -eq $process.ParentProcessId})
 ObserverRequire ($parents.Count -eq 1 -and $parents[0].CreationDate -is [DateTime] -and $parents[0].CreationDate.ToUniversalTime() -le $process.CreationDate.ToUniversalTime() -and $process.CreationDate.ToUniversalTime() -le [DateTime]::UtcNow)
 ObserverPinnedConsoleBinary
 $evidence=[ordered]@{pid=[int]$process.ProcessId;parentPid=[int]$process.ParentProcessId;creationTime=$process.CreationDate.ToUniversalTime().ToString('o');ownerVerified=$false;ownerState='UNVERIFIED_EXITED';reason='CIM_NOT_FOUND_CONFIRMED_ABSENT_STANDARD_CONSOLE'}
 ObserverAssertAbsentFamily $evidence $rawAll $rawListeners
 return $evidence
}
function ObserverNoReparse([string]$path){for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){ObserverRequire (((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)}}
function ObserverPolicyRead($ref,[bool]$private=$true){
 ObserverRequire ($ref.sha256 -cmatch '\A[a-f0-9]{64}\z' -and [IO.Path]::IsPathRooted($ref.path) -and [IO.Path]::GetFullPath($ref.path) -ceq $ref.path);ObserverNoReparse $ref.path
 $item=Get-Item -LiteralPath $ref.path -Force;ObserverRequire (-not $item.PSIsContainer -and -not $item.LinkType)
 if($private){$acl=Get-Acl -LiteralPath $ref.path;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));ObserverRequire ($acl.AreAccessRulesProtected -and $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq $owner -and $rules.Count -eq 2);foreach($sid in @($owner,'S-1-5-18')){ObserverRequire (@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and -not $_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -eq 1)}}
 $s=[IO.File]::Open($ref.path,'Open','Read','None');try{ObserverRequire ($s.Length -gt 0 -and $s.Length -le 16777216);$m=[IO.MemoryStream]::new();$s.CopyTo($m);$b=$m.ToArray();$h=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant();ObserverRequire ($h -ceq $ref.sha256);return ,$b}finally{$s.Dispose()}
}
function ObserverPolicyJson($bytes){return [Text.UTF8Encoding]::new($false,$true).GetString($bytes)|ConvertFrom-Json -ErrorAction Stop}
function ObserverPolicyBinary($ref){
 ObserverRequire ($ref.sha256 -cmatch '\A[a-f0-9]{64}\z' -and [IO.Path]::GetFullPath($ref.path) -ceq $ref.path);ObserverNoReparse $ref.path
 $item=Get-Item -LiteralPath $ref.path -Force
 $windowsShellHardLink=$item.LinkType -ceq 'HardLink' -and $ref.path -ieq 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 ObserverRequire (-not $item.PSIsContainer -and (-not $item.LinkType -or $windowsShellHardLink) -and $item.Length -gt 0 -and $item.Length -le 268435456)
 # Node exceeds the source/JSON byte-buffer limit. Hash binaries as streams.
 ObserverRequire ((Get-FileHash -LiteralPath $ref.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $ref.sha256)
 if($windowsShellHardLink){
  $signature=Get-AuthenticodeSignature -LiteralPath $ref.path
  ObserverRequire ($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -ceq 'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US')
 }
}
function ObserverImportDefinition($bytes,[string]$name,[string]$alias){
 $t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($bytes),[ref]$t,[ref]$e);ObserverRequire ($e.Count -eq 0)
 $defs=@($a.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));ObserverRequire ($defs.Count -eq 1)
 . ([scriptblock]::Create('function script:'+$alias+$defs[0].Extent.Text.Substring(('function '+$name).Length)))
}
function ObserverNativeTokens([string]$commandLine){
 function Need($condition,$code){ObserverRequire $condition}
 return ObserverImportedTokens $commandLine
}
function ObserverPolicyArgvAllowed($argv,$policy){
 $profile=$policy.profile;$before=[pscustomobject]@{identities=$policy.identityMap}
 return ObserverImportedProbeArgumentsAllowed $argv $policy.probeRef.path
}
function ObserverInitializeProbePolicy($profile,$before,$identityMap,[ValidateSet('Old','New')][string]$generation,$engineRef,$helperRef){
 $root='C:\Sirket\ERP\runtime\P03-OWNER-20261018'
 foreach($entry in @(@($engineRef,'p03-physical-rollback.ps1'),@($helperRef,'p03-pr54-paused-old-recover.ps1'))){ObserverRequire ($entry[0].path.StartsWith($root+'\',[StringComparison]::Ordinal) -and [IO.Path]::GetFileName($entry[0].path) -ceq $entry[1])}
 ObserverRequire ($engineRef.sha256 -ceq 'fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037')
 ObserverRequire ($helperRef.sha256 -ceq 'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5')
 ObserverImportDefinition (ObserverPolicyRead $engineRef) 'Tokens' 'ObserverImportedTokens'
 ObserverImportDefinition (ObserverPolicyRead $helperRef) 'ProbeArgumentsAllowed' 'ObserverImportedProbeArgumentsAllowed'
 ObserverRequire ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $profile.ownerSid -ceq $owner -and $before.ownerSid -ceq $owner -and $profile.database -ceq 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -and $before.database -ceq $profile.database -and $before.actualT1 -ceq $false)
 ObserverRequire ($profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071')
 $settingsRef=if($generation -ceq 'Old'){$profile.oldSettings}else{$profile.newSettings};$settings=ObserverPolicyJson (ObserverPolicyRead $settingsRef)
 ObserverRequire ($settings.ownerSid -ceq $owner -and $settings.database -ceq $profile.database -and $settings.copyId -ceq $before.copyId -and $settings.actualT1 -ceq $false)
 $supervisor=$settings.supervisor
 if($generation -ceq 'Old'){
  $settingsRoot=[IO.Path]::GetFullPath($supervisor.packageRoot);$beforeRoot=[IO.Path]::GetFullPath($before.oldSupervisor.root)
  ObserverNoReparse $settingsRoot;ObserverNoReparse $beforeRoot
  ObserverRequire ($settingsRoot -ceq $beforeRoot -and $supervisor.manifestSha256 -ceq $before.oldSupervisor.manifest)
 }else{ObserverRequire ($supervisor.sourceCommit -ceq '13bdf75a032ae8f694354a2e57b6ed382aec2f17' -and $supervisor.manifestSha256 -ceq '195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624')}
 $manifestRef=[pscustomobject]@{path=(Join-Path $supervisor.packageRoot 'release-manifest.json');sha256=$supervisor.manifestSha256}
 $manifest=ObserverPolicyJson (ObserverPolicyRead $manifestRef $false);ObserverRequire ($manifest.sourceCommit -ceq $supervisor.sourceCommit)
 $files=@($manifest.files|Where-Object{$_.path -ceq 'scripts/canonical/hub-stack-process-probe.ps1'});ObserverRequire ($files.Count -eq 1)
 $probeRef=[pscustomobject]@{path=(Join-Path $supervisor.packageRoot 'scripts\canonical\hub-stack-process-probe.ps1');sha256=$files[0].sha256};[void](ObserverPolicyRead $probeRef $false)
 $core=$identityMap.coreSupervisor
 ObserverRequire ($core.ownerSid -ceq $owner -and $core.nodePath -ceq $settings.node.path -and [int]$core.pid -gt 0 -and $core.creationTime -is [string])
 if($generation -ceq 'Old'){ObserverRequire (($core|ConvertTo-Json -Depth 10 -Compress) -ceq ($before.identities.coreSupervisor|ConvertTo-Json -Depth 10 -Compress))}else{
  $rules=@($profile.candidateRules|Where-Object{$_.role -ceq 'coreSupervisor'});ObserverRequire ($rules.Count -eq 1 -and $rules[0].nodePath -ceq $core.nodePath -and $rules[0].packageRoot -ceq $supervisor.packageRoot -and $rules[0].sourceCommit -ceq $supervisor.sourceCommit -and $rules[0].config.path -ceq $settingsRef.path -and $rules[0].config.sha256 -ceq $settingsRef.sha256 -and ((ObserverNativeTokens $core.commandLine)|ConvertTo-Json -Compress) -ceq ((ObserverNativeTokens $rules[0].commandLine)|ConvertTo-Json -Compress))
 }
 ObserverRequire ($profile.shell.path -ceq 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe')
 foreach($binary in @($settings.node,$profile.shell)){ObserverPolicyBinary $binary}
 return [pscustomobject]@{profile=$profile;identityMap=$identityMap;generation=$generation;core=$core;engineRef=$engineRef;helperRef=$helperRef;settingsRef=$settingsRef;manifestRef=$manifestRef;probeRef=$probeRef;nodeRef=$settings.node;shellRef=$profile.shell}
}
function ObserverPolicyCoreAlive($policy,$rawSnapshot){
 ObserverRequire ($null -ne $policy)
 $expected=$policy.core;$raw=@($rawSnapshot.selected|Where-Object{$_.ProcessId -eq $expected.pid});ObserverRequire ($raw.Count -eq 1)
 $fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$expected.pid) -ErrorAction Stop);ObserverRequire ($fresh.Count -eq 1)
 foreach($row in @($raw[0],$fresh[0])){ObserverRequire ($row.ProcessId -eq $expected.pid -and $row.ParentProcessId -eq $expected.parentPid -and $row.ExecutablePath -ieq $expected.nodePath -and $row.CommandLine -ceq $expected.commandLine -and $row.CreationDate.ToUniversalTime().Ticks -eq [DateTime]::Parse($expected.creationTime).ToUniversalTime().Ticks)}
 $sid=Invoke-CimMethod -InputObject $fresh[0] -MethodName GetOwnerSid -ErrorAction Stop;ObserverRequire ($sid.ReturnValue -eq 0 -and $sid.Sid -ceq $expected.ownerSid)
}
function ObserverTryVanishedProbe($process,$errorRecord,$rawSnapshot,$protectedPids,$policy){
 ObserverRequire ((ObserverExactNotFound $errorRecord) -and $null -ne $policy)
 ObserverRequire ($process.Name -ieq 'powershell.exe' -and $process.ExecutablePath -ieq $policy.shellRef.path -and $process.ParentProcessId -eq $policy.core.pid -and [int]$process.ProcessId -gt 0 -and $process.ProcessId -notin @($protectedPids) -and $process.ProcessId -ne $policy.core.pid -and $process.CreationDate -is [DateTime] -and $process.CreationDate.ToUniversalTime() -ge [DateTime]::Parse($policy.core.creationTime).ToUniversalTime() -and $process.CreationDate.ToUniversalTime() -le [DateTime]::UtcNow)
 ObserverRequire (ObserverPolicyArgvAllowed (ObserverNativeTokens $process.CommandLine) $policy)
 ObserverPolicyCoreAlive $policy $rawSnapshot
 $audit=[ordered]@{pid=[int]$process.ProcessId;parentPid=[int]$process.ParentProcessId;creationTime=$process.CreationDate.ToUniversalTime().ToString('o');ownerVerified=$false;ownerState='UNVERIFIED_EXITED';reason='CIM_NOT_FOUND_CONFIRMED_ABSENT_APPROVED_RO_PROBE'}
 ObserverAssertAbsentFamily $audit $rawSnapshot.all $rawSnapshot.allListeners
 return $audit
}
function ObserverAssertVanishedAudits($audits,$rawSnapshot,$policy){
 foreach($audit in $audits){
  ObserverRequire ($audit.ownerVerified -ceq $false -and $audit.ownerState -ceq 'UNVERIFIED_EXITED')
  if($audit.reason -ceq 'CIM_NOT_FOUND_CONFIRMED_ABSENT_APPROVED_RO_PROBE'){
   ObserverRequire ($null -ne $policy);foreach($ref in @($policy.engineRef,$policy.helperRef,$policy.settingsRef)){[void](ObserverPolicyRead $ref)};foreach($ref in @($policy.manifestRef,$policy.probeRef)){[void](ObserverPolicyRead $ref $false)};foreach($ref in @($policy.nodeRef,$policy.shellRef)){ObserverPolicyBinary $ref}
   ObserverPolicyCoreAlive $policy $rawSnapshot
  }else{ObserverRequire ($audit.reason -ceq 'CIM_NOT_FOUND_CONFIRMED_ABSENT_STANDARD_CONSOLE')}
  ObserverAssertAbsentFamily $audit $rawSnapshot.all $rawSnapshot.allListeners
 }
}
$optionalPins=@($ProfilePath,$ProfileSha256,$EnginePath,$EngineSha256,$RecoveryHelperPath,$RecoveryHelperSha256|Where-Object{-not [string]::IsNullOrEmpty($_)})
ObserverRequire ($optionalPins.Count -in @(0,6) -and ($optionalPins.Count -eq 0 -or $Environment -ceq 'Shared') -and ($Purpose -cne 'CandidateProposal' -or $optionalPins.Count -eq 6))
$observerProbePolicy=$null;$observerProfile=$null
$resolved=[IO.Path]::GetFullPath($BeforeImagePath)
$rehearsal=$Environment -ceq 'Rehearsal'
$pattern=if($rehearsal){'\AC:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\before\.json\z'}else{'\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-[a-f0-9]{32}\.json\z'}
if($resolved -cnotmatch $pattern){throw 'P03_BEFORE_PATH'}
$runRoot=if($rehearsal){[IO.Path]::GetDirectoryName($resolved)}else{$null}
for($part=$resolved;$part;$part=[IO.Path]::GetDirectoryName($part)){
 $item=Get-Item -LiteralPath $part -Force -ErrorAction Stop
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'P03_REPARSE'}
}
$acl=Get-Acl -LiteralPath $resolved
if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner){throw 'P03_ACL'}
if(@($acl.Access).Count -ne 2){throw 'P03_ACL_COUNT'}
foreach($ace in $acl.Access){
 $sid=$ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
 if($ace.AccessControlType -ne 'Allow' -or $sid -notin @($owner,'S-1-5-18') -or $ace.IsInherited -or $ace.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'P03_ACL_ENTRY'}
}
# Keep the file open with no sharing throughout collection to prevent replacement
# or writes through another hard link while parsing and collecting.
$stream=[IO.File]::Open($resolved,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
try{
 if($stream.Length -lt 100 -or $stream.Length -gt 1048576){throw 'P03_BEFORE_SIZE'}
 $bytes=New-Object byte[] ([int]$stream.Length)
 $offset=0
 while($offset -lt $bytes.Length){$count=$stream.Read($bytes,$offset,$bytes.Length-$offset);if($count -eq 0){throw 'P03_BEFORE_TRUNCATED'};$offset+=$count}
 $actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
 if($actual -cne $BeforeImageSha256){throw 'P03_BEFORE_HASH'}
 $before=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)|ConvertFrom-Json
 $database=if($rehearsal){'MELISA_ERP_P03_RESTORE_TEST_20261018_01'}else{'MELISA_ERP_CRM_SHARED_TEST_20261009_02'}
 if($before.schemaVersion -cne 'melisa-p03-owner-observation.v3' -or $before.ownerSid -cne $owner -or $before.database -cne $database -or $before.actualT1 -cne $false){throw 'P03_BEFORE_SCOPE'}
 if($rehearsal -and ($before.environment -cne 'P03_REHEARSAL' -or $before.copyId -cne 'P03-RECOVERY-REHEARSAL-20261018')){throw 'P03_REHEARSAL_SCOPE'}
 if($optionalPins.Count -eq 6){
  ObserverRequire ($ProfilePath -ceq (Join-Path ([IO.Path]::GetDirectoryName($resolved)) ([IO.Path]::GetFileName($resolved).Replace('MelisaERP-P03-before-','MelisaERP-P03-profile-'))))
  $observerProfile=ObserverPolicyJson (ObserverPolicyRead ([pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256}))
  ObserverRequire ($observerProfile.beforeImage.path -ceq $resolved -and $observerProfile.beforeImage.sha256 -ceq $BeforeImageSha256)
  $observerProbePolicy=ObserverInitializeProbePolicy $observerProfile $before $before.identities 'Old' ([pscustomobject]@{path=$EnginePath;sha256=$EngineSha256}) ([pscustomobject]@{path=$RecoveryHelperPath;sha256=$RecoveryHelperSha256})
 }
 $names=if($rehearsal){@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')}else{@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')}
 $ports=if($rehearsal){@(4284,4286,5334,62710,62711,62712,62713,62714)}else{@(4184,4186,5234,62700,62701,62702,62703,62704)}
 $started=[DateTime]::UtcNow.ToString('o')
 # Unfiltered source inventories: selectors belong to the independently reviewed classifier.
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 $schedule=New-Object -ComObject Schedule.Service
 $schedule.Connect()
 $folder=$schedule.GetFolder('\')
 $running=$schedule.GetRunningTasks(1)
 $instances=@()
 for($i=1;$i -le $running.Count;$i++){
  $r=$running.Item($i)
  if($r.Name -cin $names){$instances+=,[ordered]@{name=[string]$r.Name;path=[string]$r.Path;instanceGuid=[string]$r.InstanceGuid;enginePid=[int]$r.EnginePID;state=[int]$r.State}}
 }
 $tasks=@()
 foreach($name in $names){$t=$folder.GetTask($name);$xml=[string]$t.Xml;$tasks+=,[ordered]@{name=$name;state=[int]$t.State;xml=$xml}}
 # Collect processes after the slower listener/COM/XML reads, immediately
 # before selecting and authenticating their still-live identities.
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 # Full processes are retained only in memory; emitted command lines are limited
 # to the P03 release roots/watchers, old identities and target listener owners.
 $pids=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})
 $pids+=@($before.tasks|ForEach-Object{if($_.PSObject.Properties.Name -contains 'enginePid'){[int]$_.enginePid}})
 $pids+=@($instances|ForEach-Object{$_.enginePid})
 $bindings=@($listeners|Where-Object{$_.LocalPort -in $ports}|ForEach-Object{[ordered]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress;pid=[int]$_.OwningProcess}})
 $pids+=@($bindings|ForEach-Object{$_.pid})
 $selected=@(if($rehearsal){@($all|Where-Object{$_.ProcessId -in $pids -or ([string]$_.CommandLine).IndexOf($runRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0})}else{@($all|Where-Object{$_.ProcessId -in $pids -or [string]$_.CommandLine -match '(?i)C:\\Sirket\\(?:ERP|CRM)\\releases\\|watch-terminal-completion-logon\.ps1|watch-hub-after-erp\.ps1'})})
 # Include every descendant of selected application processes; never add their
 # OS ancestors (Schedule's parent would otherwise encompass the whole host).
 do{
  $selectedPids=@($pids)+@($selected|ForEach-Object{[int]$_.ProcessId})
  $children=@($all|Where-Object{$_.ParentProcessId -in $selectedPids -and $_.ProcessId -notin $selectedPids})
  $selected+= $children
 }while($children.Count -gt 0)
 $rawSnapshot=[pscustomobject]@{all=$all;selected=@($selected);allListeners=$listeners};$unverifiedRaw=@()
 if($Purpose -ceq 'CandidateProposal'){
  $matched=@()
  foreach($row in $selected){
   $rules=@();if($row.ExecutablePath -and $row.CommandLine){$rules=@($observerProfile.candidateRules|Where-Object{$_.nodePath -ceq $row.ExecutablePath -and ((ObserverNativeTokens $_.commandLine)|ConvertTo-Json -Compress) -ceq ((ObserverNativeTokens $row.CommandLine)|ConvertTo-Json -Compress)})}
   ObserverRequire ($rules.Count -le 1)
   if($rules.Count -eq 1){$matched+=,$row}else{$unverifiedRaw+=,[ordered]@{pid=[int]$row.ProcessId;parentPid=[int]$row.ParentProcessId;creationTime=if($row.CreationDate -is [DateTime]){$row.CreationDate.ToUniversalTime().ToString('o')}else{$null};ownerVerified=$false}}
  }
  $selected=$matched
 }
 $processes=@();$vanishedConsoles=@();$vanishedProbes=@()
 # Read the newest identities first so short-lived probe children are less
 # likely to exit while older parents are queried. Every selected row and
 # every owner/binary/command check is still required; no failure is skipped.
 foreach($p in @($selected|Sort-Object CreationDate -Descending)){
  try{$sid=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction Stop}catch{
   if($Purpose -ceq 'Physical' -and (ObserverExactNotFound $_) -and $p.Name -ieq 'conhost.exe'){
    $vanishedConsoles+=,(ObserverVanishedConsole $_ $p $selected $pids $all $listeners);continue
   }
   if($Purpose -ceq 'Physical' -and $null -ne $observerProbePolicy -and (ObserverExactNotFound $_) -and $p.Name -ieq 'powershell.exe'){
    $vanishedProbes+=,(ObserverTryVanishedProbe $p $_ $rawSnapshot $pids $observerProbePolicy);continue
   }
   throw
  }
  if($sid.ReturnValue -ne 0 -or -not $sid.Sid -or -not $p.ExecutablePath -or -not $p.CommandLine){throw 'P03_PROCESS_IDENTITY_UNAVAILABLE'}
  $processes+=,[ordered]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;ownerSid=[string]$sid.Sid;nodePath=[string]$p.ExecutablePath;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o')}
 }
 # No row here is an authenticated identity or a stop/claim authority. Recheck
 # absence immediately before output; parents retain their normal SID checks.
 ObserverAssertVanishedAudits @($vanishedConsoles+$vanishedProbes) $rawSnapshot $observerProbePolicy
 [ordered]@{schemaVersion='melisa-p03-physical-observation.v1';environment=$Environment;beforeImage=[ordered]@{path=$resolved;sha256=$actual};startedAt=$started;observedAt=[DateTime]::UtcNow.ToString('o');collection='Schedule.Service.GetRunningTasks(1)';collectionAuthority=if($Purpose -ceq 'CandidateProposal'){'CANDIDATE_PROPOSAL_ONLY'}else{'PHYSICAL_OBSERVATION_ONLY'};processScope='CIM.Win32_Process.Unfiltered';portScope='Get-NetTCPConnection.Listen.Unfiltered';tasks=$tasks;runningInstances=$instances;processes=$processes;bindings=$bindings;vanishedConsoles=$vanishedConsoles;vanishedProbes=$vanishedProbes;rawScope=[ordered]@{selectedCount=$rawSnapshot.selected.Count;unverifiedCount=$unverifiedRaw.Count;unverifiedProcesses=$unverifiedRaw};stopPermitted=$false;applyAvailable=$false}|ConvertTo-Json -Depth 12
}finally{$stream.Dispose()}
