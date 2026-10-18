param(
 [ValidateSet('Shared','Rehearsal')][string]$Environment='Shared',
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BeforeImageSha256
)
# Read-only physical collection. This script never authorizes stop/start/restore.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_OWNER'}
$resolved=[IO.Path]::GetFullPath($BeforeImagePath)
$rehearsal=$Environment -ceq 'Rehearsal'
$pattern=if($rehearsal){'\AC:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\before\.json\z'}else{'\AC:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-before-[a-f0-9]{32}\.json\z'}
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
 $names=if($rehearsal){@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')}else{@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')}
 $ports=if($rehearsal){@(4284,4286,5334,62710,62711,62712,62713,62714)}else{@(4184,4186,5234,62700,62701,62702,62703,62704)}
 $started=[DateTime]::UtcNow.ToString('o')
 # Unfiltered source inventories: selectors belong to the independently reviewed classifier.
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
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
 # Full processes are retained only in memory; emitted command lines are limited
 # to the P03 release roots/watchers, old identities and target listener owners.
 $pids=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})
 $pids+=@($instances|ForEach-Object{$_.enginePid})
 $bindings=@($listeners|Where-Object{$_.LocalPort -in $ports}|ForEach-Object{[ordered]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress;pid=[int]$_.OwningProcess}})
 $pids+=@($bindings|ForEach-Object{$_.pid})
 $selected=if($rehearsal){@($all|Where-Object{$_.ProcessId -in $pids -or ([string]$_.CommandLine).IndexOf($runRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0})}else{@($all|Where-Object{$_.ProcessId -in $pids -or [string]$_.CommandLine -match '(?i)C:\\Sirket\\(?:ERP|CRM)\\releases\\|watch-terminal-completion-logon\.ps1|watch-hub-after-erp\.ps1'})}
 # Include every descendant of selected application processes; never add their
 # OS ancestors (Schedule's parent would otherwise encompass the whole host).
 do{
  $selectedPids=@($selected|ForEach-Object{[int]$_.ProcessId})
  $children=@($all|Where-Object{$_.ParentProcessId -in $selectedPids -and $_.ProcessId -notin $selectedPids})
  $selected+= $children
 }while($children.Count -gt 0)
 $processes=@()
 foreach($p in $selected){
  $sid=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction Stop
  if($sid.ReturnValue -ne 0 -or -not $sid.Sid -or -not $p.ExecutablePath -or -not $p.CommandLine){throw 'P03_PROCESS_IDENTITY_UNAVAILABLE'}
  $processes+=,[ordered]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;ownerSid=[string]$sid.Sid;nodePath=[string]$p.ExecutablePath;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o')}
 }
 [ordered]@{schemaVersion='melisa-p03-physical-observation.v1';environment=$Environment;beforeImage=[ordered]@{path=$resolved;sha256=$actual};startedAt=$started;observedAt=[DateTime]::UtcNow.ToString('o');collection='Schedule.Service.GetRunningTasks(1)';processScope='CIM.Win32_Process.Unfiltered';portScope='Get-NetTCPConnection.Listen.Unfiltered';tasks=$tasks;runningInstances=$instances;processes=$processes;bindings=$bindings;stopPermitted=$false;applyAvailable=$false}|ConvertTo-Json -Depth 12
}finally{$stream.Dispose()}
