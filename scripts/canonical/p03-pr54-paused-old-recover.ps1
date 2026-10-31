param([ValidateSet('DryRun','Recover','ResumeCoreCut','ResumeCoreCutDryRun')][string]$Mode='DryRun')
# One known paused OLD run only. Importing the frozen engine's function definitions
# does not execute its dispatcher. No new generation is ever started here.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_PAUSED_OWNER'}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$id='639e2da815e1e7ac0f1c0d04d7f7bdc3'
$dir=Join-Path $base ('MelisaERP-P03-transition-'+$id)
$ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$id+'.json');$ProfileSha256='17fec444c09d04331a12e73264039f1d65c23158ed7d289c43880bfe25fbc041'
$BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$id+'.json');$BeforeImageSha256='c58fdcd36ff3c16e9c2df8965982c17a0830cf527314df5a66bfe71f69e6d256'
$engine=Join-Path $dir 'p03-physical-rollback.ps1';$engineSha='fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037'
function BootPin([string]$path,[string]$sha){
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'P03_PAUSED_REPARSE'}}
 $item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.LinkType){throw 'P03_PAUSED_FILE_TYPE'}
 $acl=Get-Acl -LiteralPath $path;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or $rules.Count -ne 2){throw 'P03_PAUSED_ACL'}
 foreach($sid in @($owner,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value -ceq $sid -and -not $_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl'}).Count -ne 1){throw 'P03_PAUSED_ACL'}}
 $s=[IO.File]::Open($path,'Open','Read','None');try{$m=[IO.MemoryStream]::new();$s.CopyTo($m);$bytes=$m.ToArray();$actual=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant();if($actual -cne $sha){throw 'P03_PAUSED_HASH'};return ,$bytes}finally{$s.Dispose()}
}
$engineBytes=BootPin $engine $engineSha
$engineText=[Text.UTF8Encoding]::new($false,$true).GetString($engineBytes)
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($engineText,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'P03_PAUSED_ENGINE_PARSE'}
foreach($definition in $ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){. ([scriptblock]::Create($definition.Extent.Text))}
$profile=Json (BootPin $ProfilePath $ProfileSha256);$before=Json (BootPin $BeforeImagePath $BeforeImageSha256)
$Environment='Shared';$isRehearsal=$false;$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$ports=@(4184,4186,5234,62700,62701,62702,62703,62704);$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256);$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
Need ($profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.oldSettings.sha256 -ceq 'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96' -and $profile.newSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071') 'PAUSED_PROFILE'
$pins=@(
 @('p03-pr54-shared-owner.lock.json','69bf4c022904e6c8d2baa2ea5766e3c115dde2b9e2412d6cfbe0a004e2cf235b'),
 @('transition.lock','aa00995da40dd5d2c4f5d5c6a9f3d71624e86e6ea3843aabc37197e714b1a1f4'),
 @('event-0000.json','fd09519005b519dbb953e6d030f66cf8e6c586bf15bd27043ce9d5dccec056a2'),
 @('event-0001.json','52e907db361e7aeb1e89976734cdccedab1a435747914ae48c9e73dbe12d72fa'),
 @('paused-old-recovery-intent.json','6eb43d46509faeb8bef1b740c19d8410a33699232137a27576522be02f68f263'),
 @('paused-old-recovery-failed.json','6bf3d88d0c866ae0c7c1f83df044e9b64f427e1565be6f82f5f6bbca8e0241b8'),
 @('p03-physical-recovery-observe.ps1','04f0039ad959fe7cdd1329cedf9bed0130c00d1f70a80352ab120cee0a5fb9a9'))
$resumeCoreCut=$Mode -cin @('ResumeCoreCut','ResumeCoreCutDryRun')
if($resumeCoreCut){$pins+=@(
 @('paused-old-console-recovery-intent.json','6d89a9eadffdec76df380a5c6feb7ae819c6ebfbf20544598938f3f9f227a2ed'),
 @('paused-old-console-core-cut-observation.json','cd086021c17e6b15a3abead8fc328782a5d5a378b29e82abc95153aa8b247be0'),
 @('paused-old-console-core-cut-completed.json','c89baea866c1f7610f230eff18a866e2f689196833ddd16888e36072b322a1a0'),
 @('paused-old-console-recovery-failed.json','62c0f948119081e250e6cc62626c39e9f9f834bd4950c99d6c47d09c955df26b'))}
function Authority{
 [void](BootPin $ProfilePath $ProfileSha256);[void](BootPin $BeforeImagePath $BeforeImageSha256);[void](BootPin $engine $engineSha)
 foreach($pin in $pins){$path=if($pin[0] -ceq 'p03-pr54-shared-owner.lock.json'){Join-Path $base $pin[0]}else{Join-Path $dir $pin[0]};[void](BootPin $path $pin[1])}
 Need (@(Get-ChildItem -LiteralPath $dir -Filter 'event-*.json' -File).Count -eq 2) 'PAUSED_TRANSITION_ADVANCED'
 Need (@(Get-ChildItem -LiteralPath $profile.journalDirectory -Force).Count -eq 0) 'PAUSED_ENGINE_JOURNAL'
 Need (-not (Test-Path -LiteralPath (Join-Path $dir 'paused-old-core-cut-observation.json')) -and -not (Test-Path -LiteralPath (Join-Path $dir 'paused-old-recovery-result.json'))) 'PAUSED_PRIOR_NO_CORE_CUT'
}
function WriteEvidence([string]$leaf,$value){
 if($resumeCoreCut){$leaf=$leaf.Replace('paused-old-console-recovery-','paused-old-console-resume-')}
 Need ($leaf -cin @('paused-old-console-recovery-intent.json','paused-old-console-recovery-failed.json','paused-old-console-recovery-result.json','paused-old-console-core-cut-observation.json','paused-old-console-core-cut-completed.json','paused-old-console-probe-drain.json','paused-old-console-resume-intent.json','paused-old-console-resume-failed.json','paused-old-console-resume-result.json')) 'PAUSED_WRITE_SCOPE'
 $target=Join-Path $dir $leaf;Need (-not (Test-Path -LiteralPath $target)) 'PAUSED_ONCE'
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12 -Compress))
 $acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
 $s=New-Object IO.FileStream($target,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$acl)
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()};[void](ReadPinned $target (Hash $bytes))
}
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
$script:tasksStopRequested=$false;$script:consolePins=@{};$script:parentPins=@{};$script:watcherPins=@{}
$order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
$script:probePins=@{};$script:coreQuiesced=$false;$script:probeAdmissionFrozen=$false
$script:legacyConsolePins=@{}
$script:coreLifetime=$null;$script:precutWindowOpenedAt=$null;$script:coreStopCompletedAt=$null;$script:lateAdmissionOpen=$false;$script:lateProbePids=@()
function LegacyConsoleAuxiliaries($inv){
 # One historical watcher child only. Never turn a missing parent into general
 # admission, and never add this console to application stop targets.
 $allowed=@();$rows=@($inv.all|Where-Object{$_.ProcessId -eq 42036})
 if($rows.Count -eq 0){return $allowed}
 Need ($rows.Count -eq 1) 'PAUSED_LEGACY_CONSOLE_COUNT';$p=$rows[0]
 $watchers=@($profile.oldWatchers|Where-Object{$_.pid -eq 53356});Need ($watchers.Count -eq 1) 'PAUSED_LEGACY_WATCHER_PIN';$watcher=$watchers[0]
 Need (@($inv.all|Where-Object{$_.ProcessId -eq $watcher.pid}).Count -eq 0) 'PAUSED_LEGACY_WATCHER_REUSED'
 $core=$before.identities.coreSupervisor
 Need ($core.parentPid -eq $watcher.pid -and $core.ownerSid -ceq $watcher.ownerSid -and [DateTime]::Parse($watcher.creationTime).ToUniversalTime() -le [DateTime]::Parse($core.creationTime).ToUniversalTime()) 'PAUSED_LEGACY_WATCHER_CHAIN'
 $binary='C:\Windows\System32\conhost.exe'
 $pin=[pscustomobject]@{pid=42036;parentPid=53356;nodePath=$binary;ownerSid=$watcher.ownerSid;commandLine='\??\C:\WINDOWS\system32\conhost.exe 0x4';creationTime='2026-10-16T22:56:21.0862000Z'}
 Need ([DateTime]::Parse($watcher.creationTime).ToUniversalTime() -le [DateTime]::Parse($pin.creationTime).ToUniversalTime() -and [DateTime]::Parse($pin.creationTime).ToUniversalTime() -le [DateTime]::Parse($core.creationTime).ToUniversalTime() -and [DateTime]::Parse($core.creationTime).ToUniversalTime() -le [DateTime]::Parse($before.observedAt).ToUniversalTime()) 'PAUSED_LEGACY_TIME_CHAIN'
 Need ($p.Name -ieq 'conhost.exe' -and (Identity $p $pin)) 'PAUSED_LEGACY_CONSOLE_IDENTITY'
 NoReparse $binary;Need ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant() -ceq 'c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac') 'PAUSED_LEGACY_CONSOLE_BINARY'
 $signature=Get-AuthenticodeSignature -LiteralPath $binary;Need ($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -ceq 'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US') 'PAUSED_LEGACY_CONSOLE_SIGNATURE'
 Need (@($inv.allListeners|Where-Object{$_.OwningProcess -eq $pin.pid}).Count -eq 0) 'PAUSED_LEGACY_CONSOLE_LISTENER'
 if($script:legacyConsolePins.ContainsKey(42036)){Need (($script:legacyConsolePins[42036]|ConvertTo-Json -Compress) -ceq ($pin|ConvertTo-Json -Compress)) 'PAUSED_LEGACY_CONSOLE_PIN_CHANGED'}else{$script:legacyConsolePins[42036]=$pin}
 return ,42036
}
function WaitLegacyConsoleAbsence{
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{$inv=PausedRemaining;$live=@($inv.all|Where-Object{$_.ProcessId -in @($script:legacyConsolePins.Keys)});if($live.Count -eq 0){return};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow -lt $until)
 Need $false 'PAUSED_LEGACY_CONSOLE_NOT_ABSENT'
}
function WaitCoreProbeAbsence{
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{
  # PausedRemaining has already authenticated every remaining OLD application.
  # Those children are stopped in their own later steps, not mistaken for probes.
  $check=PausedRemaining
  $remainingOld=@($before.identities.PSObject.Properties|Where-Object{$_.Value.pid -notin $script:drainedPids}|ForEach-Object{[int]$_.Value.pid})
  $cutPids=@([int]$before.identities.coreSupervisor.pid)+@($script:probePins.Keys)
  $live=@($check.all|Where-Object{($_.ProcessId -in $cutPids -or $_.ParentProcessId -in $cutPids) -and $_.ProcessId -notin $remainingOld})
  if($live.Count -eq 0){return};Start-Sleep -Milliseconds 250
 }while([DateTime]::UtcNow -lt $until)
 Need $false 'PAUSED_PROBE_NOT_ABSENT'
}
function SourceBytes([string]$path,[string]$sha){NoReparse $path;$f=[IO.File]::Open($path,'Open','Read','None');try{$m=[IO.MemoryStream]::new();$f.CopyTo($m);$b=$m.ToArray();Need ((Hash $b) -ceq $sha) 'PAUSED_PROBE_SOURCE_HASH';return ,$b}finally{$f.Dispose()}}
function ProbeArgumentsAllowed($argv,[string]$probe){
   foreach($role in @('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')){
    $stagePorts=@{hub='5234';crmServer='62700,62701';crmOrders='62703';crmCatalog='62702';crmNativeOrder='62704';erpApi='4184';erpNative='4186'}
    $portText=$stagePorts[$role]
    $expected=@($profile.shell.path,'-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',$probe,'-Ports',$portText)
    if(($argv|ConvertTo-Json -Compress) -ceq ($expected|ConvertTo-Json -Compress) -or ($argv|ConvertTo-Json -Compress) -ceq (@($expected+@('-ProcessId',[string]$before.identities.$role.pid))|ConvertTo-Json -Compress)){return $true}
   }
 return $false
}
function PrepareProbeSource{
 $root=$oldSettings.supervisor.packageRoot
 $manifest=Json (SourceBytes (Join-Path $root 'release-manifest.json') $oldSettings.supervisor.manifestSha256)
 Need ($manifest.sourceCommit -ceq $oldSettings.supervisor.sourceCommit) 'PAUSED_PROBE_MANIFEST'
 $files=@($manifest.files|Where-Object{$_.path -ceq 'scripts/canonical/hub-stack-process-probe.ps1'});Need ($files.Count -eq 1) 'PAUSED_PROBE_FILE'
 $probe=Join-Path $root 'scripts\canonical\hub-stack-process-probe.ps1';[void](SourceBytes $probe $files[0].sha256)
 NoReparse $profile.shell.path;Need ($profile.shell.path -ceq 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -and (Get-FileHash -LiteralPath $profile.shell.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $profile.shell.sha256) 'PAUSED_PROBE_SHELL'
 $script:probePath=$probe
}
function LatePrecutProbeAllowed($p,$inv){
 $core=$before.identities.coreSupervisor
 if(-not $script:lateAdmissionOpen){return $false}
 Need ($null -ne $script:coreLifetime -and $script:coreLifetime.Handle -ne [IntPtr]::Zero -and $script:coreLifetime.HasExited) 'PAUSED_PROBE_CORE_HANDLE'
 Need ($script:coreLifetime.Id -eq $core.pid -and $script:coreLifetime.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ') -ceq [DateTime]::Parse($core.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'PAUSED_PROBE_CORE_LIFETIME'
 Need (@($inv.all|Where-Object{$_.ProcessId -eq $core.pid}).Count -eq 0) 'PAUSED_PROBE_CORE_REUSED'
 Need ($null -ne $script:precutWindowOpenedAt -and $null -ne $script:coreStopCompletedAt -and $script:precutWindowOpenedAt -le $script:coreStopCompletedAt) 'PAUSED_PROBE_CUT_WITNESS'
 $born=$p.CreationDate.ToUniversalTime()
 return $p.ParentProcessId -eq $core.pid -and $born -ge $script:precutWindowOpenedAt -and $born -le $script:coreStopCompletedAt
}
function ProbeAuxiliaries($inv){
 $core=$before.identities.coreSupervisor;$probe=$script:probePath
 $result=@();foreach($p in $inv.all){
  $known=$script:probePins.ContainsKey([int]$p.ProcessId)
  if(-not $known -and $p.ParentProcessId -ne $core.pid){continue}
  if(-not $known -and $p.Name -ine 'powershell.exe'){continue}
  $late=$false
  if(-not $known -and ($script:coreQuiesced -or $script:probeAdmissionFrozen)){$late=LatePrecutProbeAllowed $p $inv}
  Need ((-not $script:coreQuiesced -and -not $script:probeAdmissionFrozen) -or $known -or $late) 'PAUSED_NEW_PROBE_AFTER_CORE_EXIT'
  if($known){$pin=$script:probePins[[int]$p.ProcessId]}else{
   if(-not $late){$parent=@($inv.all|Where-Object{$_.ProcessId -eq $core.pid});Need ($parent.Count -eq 1 -and (Identity $parent[0] $core)) 'PAUSED_PROBE_PARENT'}
   $sourceMatches=$p.ExecutablePath -ceq $profile.shell.path -and $p.CreationDate.ToUniversalTime() -ge [DateTime]::Parse($core.creationTime).ToUniversalTime()
   if((-not $p.ExecutablePath -or -not $p.CommandLine) -and (-not $p.ExecutablePath -or $p.ExecutablePath -ceq $profile.shell.path)){
    $fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$p.ProcessId) -ErrorAction Stop)
    if($fresh.Count -eq 0 -and $p.ParentProcessId -eq $core.pid -and $p.Name -ieq 'powershell.exe' -and $p.CreationDate.ToUniversalTime() -ge [DateTime]::Parse($core.creationTime).ToUniversalTime()){throw 'P03_PAUSED_PROBE_EXIT_RECAPTURE'}
   }
   Need $sourceMatches 'PAUSED_PROBE_BINARY'
   $argv=Tokens ([string]$p.CommandLine);$matched=ProbeArgumentsAllowed $argv $probe
   Need $matched 'PAUSED_PROBE_ARGV'
   $pin=[pscustomobject]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=[string]$p.ExecutablePath;ownerSid=$core.ownerSid;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o')}
  }
  try{Need (Identity $p $pin) 'PAUSED_PROBE_IDENTITY'}catch{
   $fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$p.ProcessId) -ErrorAction Stop)
   if($fresh.Count -eq 0 -and $p.CreationDate.ToUniversalTime().Ticks -eq [DateTime]::Parse($pin.creationTime).ToUniversalTime().Ticks){throw 'P03_PAUSED_PROBE_EXIT_RECAPTURE'};throw
  }
  Need (@($inv.allListeners|Where-Object{$_.OwningProcess -eq $p.ProcessId}).Count -eq 0) 'PAUSED_PROBE_LISTENER'
  $script:probePins[[int]$p.ProcessId]=$pin;if($late){$script:lateProbePids+=,[int]$p.ProcessId};$result+=,$pin
 }
 return $result
}
function PausedTasks{
 $inv=Inventory;Need ($inv.instances.Count -eq 0) 'PAUSED_COM'
 foreach($entry in $profile.tasks){$t=$folder.GetTask($entry.name);Need ([int]$t.State -eq 3 -and (XmlHash ([string]$t.Xml)) -ceq $entry.oldXmlSha256) 'PAUSED_OLD_ACTION'}
 return $inv
}
function PausedOld{for($attempt=0;$attempt -lt 3;$attempt++){try{return PausedOldCore}catch{if($_.Exception.Message -cne 'P03_PAUSED_PROBE_EXIT_RECAPTURE'){throw};if($attempt -eq 2){throw 'P03_PAUSED_PROBE_RECAPTURE_EXHAUSTED'}}}}
function PausedOldCore{
 Authority;PrepareProbeSource;$inv=PausedTasks;ProtectedProcesses $inv
 $selected=@();foreach($role in $order){$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'PAUSED_OLD_IDENTITY';$selected+=,$e}
 foreach($w in $profile.oldWatchers){Need (@($inv.all|Where-Object{$_.ProcessId -eq $w.pid}).Count -eq 0) 'PAUSED_WATCHER_PRESENT'}
 $expected=@($selected|ForEach-Object{$e=$_;foreach($b in $e.bindings){[pscustomobject]@{port=$b.port;address=$b.address;pid=$e.pid}}})
 Need ($inv.listeners.Count -eq $expected.Count) 'PAUSED_BINDING_COUNT'
 foreach($b in $expected){Need (@($inv.listeners|Where-Object{$_.LocalPort -eq $b.port -and $_.LocalAddress -ceq $b.address -and $_.OwningProcess -eq $b.pid}).Count -eq 1) 'PAUSED_BINDING'}
 $probes=@(ProbeAuxiliaries $inv);$aux=@(ConsoleAuxiliaries $inv @($selected+$probes));$aux+=@($probes|ForEach-Object{$_.pid});$aux+=@(LegacyConsoleAuxiliaries $inv)
 # All descendants remain relevant even if a captured parent has just disappeared.
 $relevant=[Collections.Generic.HashSet[int]]::new();foreach($e in $selected){[void]$relevant.Add([int]$e.pid)};foreach($w in $profile.oldWatchers){[void]$relevant.Add([int]$w.pid)};foreach($pidValue in @($script:legacyConsolePins.Keys)){[void]$relevant.Add([int]$pidValue)}
 foreach($p in $inv.all){foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){[void]$relevant.Add([int]$p.ProcessId)}};if(IsWatcherCommand ([string]$p.CommandLine)){[void]$relevant.Add([int]$p.ProcessId)}}
 do{$added=$false;foreach($p in $inv.all){if($relevant.Contains([int]$p.ParentProcessId) -and $relevant.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inv.all){if($relevant.Contains([int]$p.ProcessId)){Need ($p.ProcessId -in @($selected|ForEach-Object{$_.pid}) -or $p.ProcessId -in $aux) 'PAUSED_FOREIGN_PROCESS'}}
 Health $selected;return $selected
}
function PausedRemaining{for($attempt=0;$attempt -lt 3;$attempt++){try{return PausedRemainingCore}catch{if($_.Exception.Message -cne 'P03_PAUSED_PROBE_EXIT_RECAPTURE'){throw};if($attempt -eq 2){throw 'P03_PAUSED_PROBE_RECAPTURE_EXHAUSTED'}}}}
function PausedRemainingCore{
 Authority;PrepareProbeSource;$inv=PausedTasks;ProtectedProcesses $inv;$selected=@()
 foreach($role in $order){$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});if($e.pid -in $script:drainedPids){Need ($p.Count -eq 0) 'PAUSED_DRAINED_PID_REAPPEARED';continue};Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'PAUSED_REMAINING_IDENTITY';$selected+=,$e}
 foreach($w in $profile.oldWatchers){Need (@($inv.all|Where-Object{$_.ProcessId -eq $w.pid}).Count -eq 0) 'PAUSED_WATCHER_REUSED'}
 $probes=@(ProbeAuxiliaries $inv);$aux=@(ConsoleAuxiliaries $inv @($selected+$probes));$aux+=@($probes|ForEach-Object{$_.pid});$aux+=@(LegacyConsoleAuxiliaries $inv)
 $relevant=[Collections.Generic.HashSet[int]]::new();foreach($e in $before.identities.PSObject.Properties){[void]$relevant.Add([int]$e.Value.pid)};foreach($w in $profile.oldWatchers){[void]$relevant.Add([int]$w.pid)};foreach($pidValue in @($script:consolePins.Keys)+@($script:probePins.Keys)+@($script:legacyConsolePins.Keys)){[void]$relevant.Add([int]$pidValue)}
 foreach($p in $inv.all){foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){[void]$relevant.Add([int]$p.ProcessId)}};if(IsWatcherCommand ([string]$p.CommandLine)){[void]$relevant.Add([int]$p.ProcessId)}}
 do{$added=$false;foreach($p in $inv.all){if($relevant.Contains([int]$p.ParentProcessId) -and $relevant.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inv.all){if($relevant.Contains([int]$p.ProcessId)){Need ($p.ProcessId -in @($selected|ForEach-Object{$_.pid}) -or $p.ProcessId -in $aux) 'PAUSED_DRAIN_FOREIGN_PROCESS'}}
 $expected=@($selected|ForEach-Object{$e=$_;foreach($b in $e.bindings){[pscustomobject]@{port=$b.port;address=$b.address;pid=$e.pid}}})
 Need ($inv.listeners.Count -eq $expected.Count) 'PAUSED_REMAINING_BINDING_COUNT'
 foreach($b in $expected){Need (@($inv.listeners|Where-Object{$_.LocalPort -eq $b.port -and $_.LocalAddress -ceq $b.address -and $_.OwningProcess -eq $b.pid}).Count -eq 1) 'PAUSED_REMAINING_BINDING'}
 return $inv
}
function PausedEmpty{
 $inv=Inventory;ProtectedProcesses $inv;AssertEmpty $inv
 $captured=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{[int]$_.pid})+@($script:consolePins.Keys)+@($script:probePins.Keys)+@($script:legacyConsolePins.Keys)
 foreach($p in $inv.all){Need ($p.ProcessId -notin $captured -and $p.ParentProcessId -notin $captured) 'PAUSED_OLD_DESCENDANT_REMAINS'}
}
function ResumePausedCoreCut{
 Authority
 $intent=Json (BootPin (Join-Path $dir 'paused-old-console-recovery-intent.json') '6d89a9eadffdec76df380a5c6feb7ae819c6ebfbf20544598938f3f9f227a2ed')
 $cut=Json (BootPin (Join-Path $dir 'paused-old-console-core-cut-completed.json') 'c89baea866c1f7610f230eff18a866e2f689196833ddd16888e36072b322a1a0')
 Need ($cut.event -ceq 'PAUSED_OLD_CORE_CUT_COMPLETED' -and $cut.profileSha256 -ceq $ProfileSha256 -and $cut.beforeSha256 -ceq $BeforeImageSha256 -and $cut.engineSha256 -ceq $engineSha -and $cut.heldProcessHandle -ceq $true -and $cut.processAbsent -ceq $true) 'PAUSED_RESUME_CUT'
 $inv=PausedTasks;ProtectedProcesses $inv
 # A completed exact parent stop can close its Windows-lifetime children.
 # Only globally absent captured IDs become drained; any reuse remains fatal.
 $script:drainedPids=@();foreach($role in $order){$e=$before.identities.$role;$rows=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});if($rows.Count -eq 0){$script:drainedPids+=,[int]$e.pid}else{Need ($rows.Count -eq 1 -and (Identity $rows[0] $e)) 'PAUSED_RESUME_REUSED'}}
 Need ($before.identities.coreSupervisor.pid -in $script:drainedPids) 'PAUSED_RESUME_CORE_PRESENT'
 foreach($pin in $intent.consolePins){$script:consolePins[[int]$pin.pid]=$pin}
 foreach($pin in $intent.legacyConsolePins){$script:legacyConsolePins[[int]$pin.pid]=$pin}
 foreach($pin in $intent.probePins){$script:probePins[[int]$pin.pid]=$pin}
 $script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$script:tasksStopRequested=$true
 [void](PausedRemaining)
 return @($order|ForEach-Object{$before.identities.$_})
}
if($resumeCoreCut){$selected=ResumePausedCoreCut}else{$selected=PausedOld}
if($Mode -ceq 'ResumeCoreCutDryRun'){[ordered]@{status='PAUSED_CORE_CUT_RESUME_DRY_RUN';mutationExecuted=$false;capturedOldRoles=$selected.Count;absentOldRoles=$script:drainedPids.Count;remainingOldRoles=$selected.Count-$script:drainedPids.Count;engineSha256=$engineSha}|ConvertTo-Json;return}
if($Mode -ceq 'DryRun'){[ordered]@{status='PAUSED_OLD_RECOVERY_DRY_RUN';mutationExecuted=$false;oldRoles=$selected.Count;auxiliaryCount=$script:consolePins.Count;legacyAuxiliaryCount=$script:legacyConsolePins.Count;authenticatedProbeCount=$script:probePins.Count;engineSha256=$engineSha}|ConvertTo-Json;return}
$attemptIntentLeaf=if($resumeCoreCut){'paused-old-console-resume-intent.json'}else{'paused-old-console-recovery-intent.json'}
Need (-not (Test-Path -LiteralPath (Join-Path $dir $attemptIntentLeaf))) 'PAUSED_ONCE'
$intentWritten=$false
try{
 WriteEvidence 'paused-old-console-recovery-intent.json' ([ordered]@{event='PAUSED_OLD_CONSOLE_RECOVERY_INTENT';priorIntentSha256='6eb43d46509faeb8bef1b740c19d8410a33699232137a27576522be02f68f263';priorFailureSha256='6bf3d88d0c866ae0c7c1f83df044e9b64f427e1565be6f82f5f6bbca8e0241b8';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;observedAt=[DateTime]::UtcNow.ToString('o');oldPids=@($selected|ForEach-Object{$_.pid});consolePins=@($script:consolePins.Values);legacyConsolePins=@($script:legacyConsolePins.Values);probePins=@($script:probePins.Values)})
 $intentWritten=$true;if(-not $resumeCoreCut){$script:drainedPids=@()}
 foreach($role in $order){
  if($before.identities.$role.pid -in $script:drainedPids){[void](PausedRemaining);continue}
  if($role -ceq 'coreSupervisor'){
   $script:coreLifetime=[Diagnostics.Process]::GetProcessById([int]$before.identities.coreSupervisor.pid);[void]$script:coreLifetime.Handle
   Need (-not $script:coreLifetime.HasExited -and $script:coreLifetime.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ') -ceq [DateTime]::Parse($before.identities.coreSupervisor.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'PAUSED_CORE_HELD_LIFETIME'
   $script:precutWindowOpenedAt=[DateTime]::UtcNow
  }
  $inv=PausedRemaining;$e=$before.identities.$role;$p=@($inv.all|Where-Object{$_.ProcessId -eq $e.pid});Need ($p.Count -eq 1 -and (Identity $p[0] $e)) 'PAUSED_DRAIN_IDENTITY';[void](ReadPinned $profile.stopper.path '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d')
  $proof=[ordered]@{pid=$e.pid;parentPid=$e.parentPid;nodePath=$e.nodePath;ownerSid=$e.ownerSid;commandLine=$e.commandLine;creationTime=[DateTime]::Parse($e.creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')}
  # Hold this exact code file against write/delete through process completion.
  $codeHandle=[IO.File]::Open($profile.stopper.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try{$codeMemory=[IO.MemoryStream]::new();$codeHandle.CopyTo($codeMemory);Need ((Hash $codeMemory.ToArray()) -ceq '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d') 'PAUSED_HELD_STOPPER'
   if($role -ceq 'coreSupervisor'){
    WriteEvidence 'paused-old-console-core-cut-observation.json' ([ordered]@{event='PAUSED_OLD_CORE_CUT_OBSERVATION';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;observedAt=[DateTime]::UtcNow.ToString('o');core=$e;probePins=@($script:probePins.Values);consolePins=@($script:consolePins.Values);legacyConsolePins=@($script:legacyConsolePins.Values)})
    $actualCore=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$e.pid) -ErrorAction Stop);Need ($actualCore.Count -eq 1 -and (Identity $actualCore[0] $e)) 'PAUSED_CORE_PRECUT_IDENTITY'
   }
   $result=& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'  -NoProfile -NonInteractive -File $profile.stopper.path -ExpectedJsonBase64 ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($proof|ConvertTo-Json -Compress))))
  }finally{$codeHandle.Dispose()}
  Need ($LASTEXITCODE -eq 0 -and [string]$result -cin @('EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE')) 'PAUSED_DRAIN_RESULT'
  Need (@((Inventory).all|Where-Object{$_.ProcessId -eq $e.pid}).Count -eq 0) 'PAUSED_DRAIN_ABSENCE'
  $script:drainedPids+=,[int]$e.pid
  if($role -ceq 'coreSupervisor'){
   Need ($script:coreLifetime.HasExited) 'PAUSED_CORE_HELD_EXIT'
   $script:coreStopCompletedAt=[DateTime]::UtcNow
   WriteEvidence 'paused-old-console-core-cut-completed.json' ([ordered]@{event='PAUSED_OLD_CORE_CUT_COMPLETED';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$engineSha;windowOpenedAt=$script:precutWindowOpenedAt.ToString('o');cutCompletedAt=$script:coreStopCompletedAt.ToString('o');core=$e;heldProcessHandle=$true;processAbsent=$true})
   $script:coreQuiesced=$true;$script:probeAdmissionFrozen=$true;$script:tasksStopRequested=$true;$script:lateAdmissionOpen=$true
   try{WaitCoreProbeAbsence}finally{$script:lateAdmissionOpen=$false}
   WriteEvidence 'paused-old-console-probe-drain.json' ([ordered]@{event='PAUSED_OLD_CORE_PROBES_ABSENT';observedAt=[DateTime]::UtcNow.ToString('o');probePins=@($script:probePins.Values);latePrecutProbePids=$script:lateProbePids;heldCoreExited=$true})
  }
 }
 $script:capturedCandidatePids=@($selected|ForEach-Object{$_.pid});WaitLegacyConsoleAbsence;WaitConsoleAbsence;PausedEmpty;Authority
 foreach($entry in $profile.tasks){PausedEmpty;$t=$folder.GetTask($entry.name);Need ([int]$t.State -eq 3 -and (XmlHash ([string]$t.Xml)) -ceq $entry.oldXmlSha256) 'PAUSED_ACTION_CAS';[void]$folder.RegisterTask($entry.name,$entry.newXml,4,$owner,$null,3,$null);Need ((XmlHash ([string]$folder.GetTask($entry.name).Xml)) -ceq $entry.newXmlSha256) 'PAUSED_ACTION_READBACK'}
 # Candidate is ACTUALLY empty; no synthetic processes, receipts, COM or recovery events.
 PausedEmpty;$candidatePath=Join-Path $base ('MelisaERP-P03-candidate-'+[Guid]::NewGuid().ToString('N')+'.json')
 $candidate=[ordered]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=@();receipts=@()}
 # Reuse the strict CreateNew writer with a scoped local function for this one candidate.
 NoReparse $base
 Need (-not (Test-Path -LiteralPath $candidatePath)) 'PAUSED_CANDIDATE_EXISTS'
 $candidateBytes=[Text.UTF8Encoding]::new($false).GetBytes(($candidate|ConvertTo-Json -Compress));$candidateAcl=[Security.AccessControl.FileSecurity]::new();$candidateAcl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$candidateAcl.SetAccessRuleProtection($true,$false);foreach($sid in @($owner,'S-1-5-18')){[void]$candidateAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))};$s=New-Object IO.FileStream($candidatePath,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$candidateAcl);try{$s.Write($candidateBytes,0,$candidateBytes.Length);$s.Flush($true)}finally{$s.Dispose()};$candidateSha=Hash $candidateBytes;[void](ReadPinned $candidatePath $candidateSha)
 $common=@{Environment='Shared';ProfilePath=$ProfilePath;ProfileSha256=$ProfileSha256;BeforeImagePath=$BeforeImagePath;BeforeImageSha256=$BeforeImageSha256}
 [void](ReadPinned $engine $engineSha);$recovered=(& $engine @common -Mode StopNew -CandidatePath $candidatePath -CandidateSha256 $candidateSha)|ConvertFrom-Json;Need ($recovered.status -ceq 'RECOVERED_OLD_ACTIONS') 'PAUSED_ENGINE_RECOVERY'
 [void](ReadPinned $engine $engineSha);$ready=(& $engine @common -Mode RollbackOld -RecoveryTailSha256 $recovered.journalTailSha256)|ConvertFrom-Json;Need ($ready.status -ceq 'RESTORED_READY' -and $ready.stableSeconds -ge 30) 'PAUSED_RESTORED'
 WriteEvidence 'paused-old-console-recovery-result.json' ([ordered]@{status='PAUSED_OLD_RESTORED_READY';engineSha256=$engineSha;candidateSha256=$candidateSha;recoveryTailSha256=$ready.journalTailSha256;stableSeconds=$ready.stableSeconds;newGenerationStarted=$false;locksRetained=$true})
 [ordered]@{status='PAUSED_OLD_RESTORED_READY';stableSeconds=30;newGenerationStarted=$false;locksRetained=$true}|ConvertTo-Json
}catch{if($intentWritten){try{WriteEvidence 'paused-old-console-recovery-failed.json' (FailureDiagnostic $_)}catch{}};throw}finally{if($null -ne $script:coreLifetime){$script:coreLifetime.Dispose()}}
