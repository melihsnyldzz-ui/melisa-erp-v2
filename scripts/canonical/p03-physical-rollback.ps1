param(
 [ValidateSet('PreflightOld','StopNew','RollbackOld')][string]$Mode='PreflightOld',
 [Parameter(Mandatory=$true)][string]$ProfilePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ProfileSha256,
 [Parameter(Mandatory=$true)][string]$BeforeImagePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BeforeImageSha256,
 [string]$RecoveryTailSha256,
 [string]$CandidatePath,
 [string]$CandidateSha256
)
# Finite physical old-owner rollback. No SQL, deployment or candidate adoption.
# RollbackOld is admitted only by the caller-pinned complete recovery journal.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')
$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
function Hash([byte[]]$bytes){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}
function NoReparse([string]$path){for($part=[IO.Path]::GetFullPath($path);$part;$part=[IO.Path]::GetDirectoryName($part)){$item=Get-Item -LiteralPath $part -Force;Need (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE'}}
function Protected([string]$path){
 NoReparse $path
 $acl=Get-Acl -LiteralPath $path
 Need ($acl.AreAccessRulesProtected -and $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq $owner -and @($acl.Access).Count -eq 2) 'ACL'
 $seen=@()
 foreach($ace in $acl.Access){$sid=$ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;Need ($sid -cin @($owner,'S-1-5-18') -and $sid -cnotin $seen -and $ace.AccessControlType -eq 'Allow' -and -not $ace.IsInherited -and $ace.FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl) 'ACL_ENTRY';$seen+=$sid}
}
function ReadPinned([string]$path,[string]$sha){
 Need ($sha -cmatch '\A[a-f0-9]{64}\z') 'SHA_FORMAT';Protected $path
 $s=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
 try{Need ($s.Length -gt 0 -and $s.Length -le 16777216) 'FILE_SIZE';$m=[IO.MemoryStream]::new();$s.CopyTo($m);$bytes=$m.ToArray();Need ((Hash $bytes) -ceq $sha) 'PIN_HASH';return ,$bytes}finally{$s.Dispose()}
}
function Json([byte[]]$bytes){[Text.UTF8Encoding]::new($false,$true).GetString($bytes)|ConvertFrom-Json -ErrorAction Stop}
function XmlHash([string]$xml){Hash ([Text.UTF8Encoding]::new($false).GetBytes($xml))}
function Metadata([string]$xml){Need ($xml -match '<Actions\b[^>]*>[\s\S]*?</Actions>') 'TASK_XML';[regex]::Replace($xml,'<Actions\b[^>]*>[\s\S]*?</Actions>','<Actions/>')}
function Identity($actual,$expected){
 if(-not $actual){return $false}
 $sid=Invoke-CimMethod -InputObject $actual -MethodName GetOwnerSid -ErrorAction Stop
 return $sid.ReturnValue -eq 0 -and $sid.Sid -ceq $expected.ownerSid -and [int]$actual.ProcessId -eq [int]$expected.pid -and [int]$actual.ParentProcessId -eq [int]$expected.parentPid -and $actual.ExecutablePath -ieq $expected.nodePath -and $actual.CommandLine -ceq $expected.commandLine -and $actual.CreationDate.ToUniversalTime().Ticks -eq [DateTime]::Parse($expected.creationTime).ToUniversalTime().Ticks
}
function Inventory{
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort -in $ports})
 $running=$schedule.GetRunningTasks(1);$instances=@()
 for($i=1;$i -le $running.Count;$i++){$r=$running.Item($i);if($r.Name -cin $names){$instances+=,$r}}
 return [pscustomobject]@{all=$all;listeners=$listeners;instances=$instances}
}
function ProtectedProcesses($inventory){foreach($p in $profile.protectedProcesses){Need (Identity ($inventory.all|Where-Object{$_.ProcessId -eq $p.pid}) $p) 'PROTECTED_PROCESS_CHANGED'}}
function AssertTasks([int]$state){
 foreach($entry in $profile.tasks){$task=$folder.GetTask($entry.name);Need ([int]$task.State -eq $state -and (XmlHash ([string]$task.Xml)) -ceq $entry.oldXmlSha256) 'OLD_TASK_DRIFT'}
}
function AssertEmpty($inventory){
 Need ($inventory.instances.Count -eq 0 -and $inventory.listeners.Count -eq 0) 'NOT_EMPTY'
 $roots=@($profile.packages|ForEach-Object{[string]$_.root})
 foreach($p in $inventory.all){
  foreach($root in $roots){Need ([string]$p.CommandLine -notlike ('*'+$root+'*')) 'PACKAGE_PROCESS_STILL_RUNNING'}
  Need ([string]$p.CommandLine -notmatch '(?i)watch-terminal-completion-logon\.ps1|watch-hub-after-erp\.ps1') 'WATCHER_STILL_RUNNING'
 }
 ProtectedProcesses $inventory
}
function Field($value,[string]$path){foreach($part in $path.Split('.')){$value=$value.$part};return $value}
function Tokens([string]$commandLine){
 Need ($commandLine -cnotmatch '[\r\n\x00]') 'ARGV_CONTROL'
 if(-not ('P03NativeArgv' -as [type])){Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class P03NativeArgv {
 [DllImport("shell32.dll",SetLastError=true)] public static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string command,out int count);
 [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr memory);
}
'@}
 $count=0;$ptr=[P03NativeArgv]::CommandLineToArgvW($commandLine,[ref]$count);Need ($ptr -ne [IntPtr]::Zero -and $count -gt 0) 'ARGV_PARSE'
 try{$tokens=@();for($i=0;$i -lt $count;$i++){$tokens+=[Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::ReadIntPtr($ptr,$i*[IntPtr]::Size))};return ,$tokens}finally{[void][P03NativeArgv]::LocalFree($ptr)}
}
function VerifyRule($rule){
 $map=@{
  erpNative=@('erpApiNative','apps\api\start-shared-test-copy.mjs','native');erpApi=@('erpApiNative','apps\api\start-shared-test-copy.mjs','erp');crmNativeOrder=@('nativeOrder','apps\api\start-crm-order-test.mjs','--shared-current-test');crmCatalog=@('crm','deploy\test-erp-catalog.mjs','');crmOrders=@('crm','deploy\test-erp-orders.mjs','');crmServer=@('crm','deploy\test-server.mjs','')
 }
 $expected=@();$config=$null;$component=$null
 if($map.ContainsKey($rule.role)){
  $stage=$map[$rule.role];$component=$newSettings.components.($stage[0]);$config=$component.config
  $expected=@($newSettings.node.path,'--no-maglev',(Join-Path $component.packageRoot $stage[1]))
  if($stage[0] -cne 'crm'){$expected+=@($stage[2],$config.path)}
 }elseif($rule.role -ceq 'coreSupervisor'){
  $component=$newSettings.supervisor;$config=$profile.newSettings
  $expected=@($newSettings.node.path,'--no-maglev',(Join-Path $component.packageRoot 'scripts\canonical\terminal-completion-logon.mjs'),'--config',$config.path,'--sha256',$config.sha256,'--owner-sid',$owner,'--action','Start')
 }elseif($rule.role -ceq 'hub'){
  $component=$newSettings.components.hub;$config=$newSettings.privateSources.operationConfig
  $expected=@($newSettings.node.path,(Join-Path $component.packageRoot 'apps\api\start-shared-test-copy-web.mjs'),$config.path)
 }else{
  Need ($rule.role -cin @('terminalWatcher','hubWatcher')) 'RULE_ROLE'
  $component=$newSettings.supervisor;$config=$profile.newSettings
  $leaf=if($rule.role -ceq 'terminalWatcher'){'watch-terminal-completion-logon.ps1'}else{'watch-hub-after-erp.ps1'}
  $taskName=if($rule.role -ceq 'terminalWatcher'){$names[0]}else{$names[1]}
  Need ($rule.taskName -ceq $taskName) 'RULE_TASK_NAME'
  $expected=@('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',(Join-Path $component.packageRoot ('scripts\canonical\'+$leaf)),'-StartupConfigPath',$config.path,'-StartupConfigSha256',$config.sha256)
 }
 Need ($rule.packageRoot -ceq $component.packageRoot -and $rule.sourceCommit -ceq $component.sourceCommit -and $rule.config.path -ceq $config.path -and $rule.config.sha256 -ceq $config.sha256 -and $rule.nodePath -ceq $expected[0]) 'RULE_SOURCE_BINDING'
 $actual=Tokens $rule.commandLine
 Need (($actual|ConvertTo-Json -Compress) -ceq ($expected|ConvertTo-Json -Compress)) 'RULE_ARGV_SOURCE'
 if($rule.role -cin @('terminalWatcher','hubWatcher')){
  Need ($profile.shell.path -ceq $expected[0]) 'RULE_SHELL_PATH'
  $exe=$profile.shell
 }else{$exe=$newSettings.node}
 NoReparse $exe.path;Need ((Get-FileHash -LiteralPath $exe.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $exe.sha256) 'RULE_EXECUTABLE_HASH'
}
function Append([string]$event,$extra=$null){
 $events=@(Get-ChildItem -LiteralPath $profile.journalDirectory -File|Where-Object{$_.Name -cmatch '\Aevent-[0-9]{4}\.json\z'})
 Need ($events.Count -eq $script:sequence) 'EVENT_CAS_COUNT'
 if($script:sequence -gt 0){[void](ReadPinned (Join-Path $profile.journalDirectory ('event-'+($script:sequence-1).ToString('0000')+'.json')) $script:previous)}else{Need ($script:previous -ceq $BeforeImageSha256) 'EVENT_INITIAL_TAIL'}
 $record=[ordered]@{sequence=$script:sequence;previousSha256=$script:previous;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;event=$event;observedAt=[DateTime]::UtcNow.ToString('o')}
 if($null -ne $extra){$record['pid']=[int]$extra}
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($record|ConvertTo-Json -Compress));$target=Join-Path $profile.journalDirectory ('event-'+$script:sequence.ToString('0000')+'.json')
 $security=[Security.AccessControl.FileSecurity]::new();$security.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$security.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$security.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))}
 $s=New-Object IO.FileStream($target,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$security)
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()}
 $next=Hash $bytes;[void](ReadPinned $target $next);$script:previous=$next;$script:sequence++
}
function TaskPhase([string]$kind){
 foreach($entry in $profile.tasks){
  $task=$folder.GetTask($entry.name);$sha=if($kind -ceq 'new'){$entry.newXmlSha256}else{$entry.oldXmlSha256}
  Need ((XmlHash ([string]$task.Xml)) -ceq $sha -and (Metadata ([string]$task.Xml)) -ceq (Metadata $entry.oldXml)) 'RECOVERY_TASK_XML'
 }
}
function HubLineage($evidence,$expected,$inventory){
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
 Need (((Tokens $launcher.argv)|ConvertTo-Json -Compress) -ceq ($launcherArgs|ConvertTo-Json -Compress)) 'HUB_LAUNCHER_ARGV'
 Need ($lineage.node.pid -eq $expected.pid -and $lineage.node.birth -ceq $expected.creationTime -and $lineage.node.sid -ceq $owner -and $lineage.node.argv -ceq $expected.commandLine -and [DateTime]::Parse($expected.creationTime) -gt [DateTime]::Parse($launcher.birth)) 'HUB_NODE_LINEAGE'
 Need ($lineage.startupConfig.path -ceq $pin.config.path -and $lineage.startupConfig.sha256 -ceq $pin.config.sha256 -and $lineage.operationConfig.path -ceq $newSettings.privateSources.operationConfig.path -and $lineage.operationConfig.sha256 -ceq $newSettings.privateSources.operationConfig.sha256 -and $lineage.hubConfig.path -ceq $newSettings.privateSources.hubPinConfig.path -and $lineage.hubConfig.sha256 -ceq $newSettings.privateSources.hubPinConfig.sha256) 'HUB_CONFIG_LINEAGE'
 Need ($rec.pid -eq $expected.pid -and $rec.run -ceq $lineage.run -and $rec.attempt -eq $lineage.attempt -and $rec.sourceCommit -ceq $pin.sourceCommit -and $rec.packageRoot -ceq $pin.packageRoot -and $rec.port -eq 5234 -and $rec.lineagePath -ceq $ref.lineagePath -and $rec.lineageSha256 -ceq $ref.lineageSha256 -and $rec.startedAt -ceq $lineage.startedAt -and [DateTime]::Parse($rec.startedAt) -ge [DateTime]::Parse($expected.creationTime)) 'HUB_POINTER_LINEAGE'
 Need (@($lineage.bindings).Count -eq @($expected.bindings).Count) 'HUB_LINEAGE_BINDINGS'
 foreach($b in $expected.bindings){Need (@($lineage.bindings|Where-Object{$_.pid -eq $expected.pid -and $_.port -eq $b.port -and $_.address -ceq $b.address}).Count -eq 1) 'HUB_LINEAGE_BINDING'}
 return [DateTime]::Parse($launcher.birth).ToUniversalTime()
}
function SupervisorParent($evidence,$expected,$inventory){
 $watchers=@($evidence.processes|Where-Object{$_.role -ceq 'terminalWatcher'});Need ($watchers.Count -eq 1 -and $expected.parentPid -eq $watchers[0].pid) 'SUPERVISOR_WATCHER_PARENT'
 $watcher=$watchers[0];$rules=@($profile.candidateRules|Where-Object{$_.role -ceq 'terminalWatcher'});Need ($rules.Count -eq 1) 'SUPERVISOR_WATCHER_RULE';VerifyRule $rules[0]
 Need ($watcher.commandLine -ceq $rules[0].commandLine -and $watcher.nodePath -ceq $rules[0].nodePath) 'SUPERVISOR_WATCHER_ARGV'
 $actual=@($inventory.all|Where-Object{$_.ProcessId -eq $watcher.pid});$instances=@($inventory.instances|Where-Object{$_.Name -ceq $names[0] -and $_.EnginePID -eq $watcher.pid})
 if($actual.Count -eq 1){
  Need (Identity $actual[0] $watcher) 'SUPERVISOR_WATCHER_IDENTITY'
  if($instances.Count -eq 1){
   if($script:watcherPins.ContainsKey([int]$watcher.pid)){Need ($script:watcherPins[[int]$watcher.pid] -ceq [string]$instances[0].InstanceGuid) 'SUPERVISOR_COM_GUID'}else{$script:watcherPins[[int]$watcher.pid]=[string]$instances[0].InstanceGuid}
  }else{Need ($script:tasksStopRequested -and $instances.Count -eq 0 -and $script:watcherPins.ContainsKey([int]$watcher.pid)) 'SUPERVISOR_COM_ABSENT'}
 }else{Need ($actual.Count -eq 0 -and $script:tasksStopRequested -and $script:watcherPins.ContainsKey([int]$watcher.pid)) 'SUPERVISOR_PARENT_EXIT_UNPROVEN'}
 foreach($child in @($evidence.processes|Where-Object{$_.role -cin @('erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer')})){
  $live=@($inventory.all|Where-Object{$_.ProcessId -eq $child.pid});if($live.Count -eq 0){continue}
  Need ($child.parentPid -eq $expected.pid -and (Identity $live[0] $child)) 'SUPERVISOR_CHILD_OS'
  $refs=@($evidence.receipts|Where-Object{$_.role -ceq $child.role});Need ($refs.Count -eq 1) 'SUPERVISOR_CHILD_RECEIPT'
  $receipt=Json (ReadPinned $refs[0].path $refs[0].sha256)
  Need ($receipt.pid -eq $child.pid -and $receipt.parentPid -eq $expected.pid -and [DateTime]::Parse($receipt.parentCreationTime).ToUniversalTime().Ticks -eq [DateTime]::Parse($expected.creationTime).ToUniversalTime().Ticks) 'SUPERVISOR_SHARED_PARENT_RECEIPT'
 }
}
function CandidateInventory($evidence){
 $inventory=Inventory;ProtectedProcesses $inventory
 Need (@($profile.oldWatchers).Count -eq 2) 'OLD_WATCHER_PINS'
 $oldPids=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{[int]$_.pid})
 foreach($instance in $inventory.instances){$oldPids+=@($before.tasks|Where-Object{$_.name -ceq $instance.Name}|ForEach-Object{if($_.PSObject.Properties.Name -contains 'enginePid'){[int]$_.enginePid}})}
 Need (@($evidence.processes|ForEach-Object{$_.role}|Sort-Object -Unique).Count -eq @($evidence.processes).Count -and @($evidence.processes|ForEach-Object{$_.pid}|Sort-Object -Unique).Count -eq @($evidence.processes).Count) 'CANDIDATE_DUPLICATE'
 $selected=@();$rules=@($profile.candidateRules);$seen=@()
 foreach($expected in @($evidence.processes)){
  Need ($expected.ownerSid -ceq $owner -and [int]$expected.pid -gt 0 -and [int]$expected.pid -notin $oldPids -and $expected.role -cnotin $seen) 'CANDIDATE_OLD_OR_DUPLICATE'
  $rule=@($rules|Where-Object{$_.role -ceq $expected.role});Need ($rule.Count -eq 1) 'CANDIDATE_ROLE'
  VerifyRule $rule[0]
  Need ($expected.nodePath -ceq $rule[0].nodePath -and ((Tokens $expected.commandLine)|ConvertTo-Json -Compress) -ceq ((Tokens $rule[0].commandLine)|ConvertTo-Json -Compress)) 'CANDIDATE_ARGV'
  [void](ReadPinned $rule[0].config.path $rule[0].config.sha256)
  Need (@($profile.packages|Where-Object{$_.root -ceq $rule[0].packageRoot -and $_.sourceCommit -ceq $rule[0].sourceCommit}).Count -eq 1) 'CANDIDATE_PACKAGE'
  $actual=@($inventory.all|Where-Object{$_.ProcessId -eq $expected.pid})
  if($actual.Count -eq 0){continue}
  Need ($actual.Count -eq 1 -and (Identity $actual[0] $expected)) 'CANDIDATE_IDENTITY'
  $parent=@($inventory.all|Where-Object{$_.ProcessId -eq $expected.parentPid})
  $hubParentBirth=if($expected.role -ceq 'hub'){HubLineage $evidence $expected $inventory}else{$null}
  if($parent.Count -eq 1){
   $parentSid=Invoke-CimMethod -InputObject $parent[0] -MethodName GetOwnerSid -ErrorAction Stop
   if($expected.role -cin @('terminalWatcher','hubWatcher')){
    $service=@(Get-CimInstance Win32_Service -Filter "Name='Schedule'" -ErrorAction Stop)
    Need ($service.Count -eq 1 -and $service[0].State -ceq 'Running' -and $service[0].StartName -ceq 'LocalSystem' -and [int]$service[0].ProcessId -eq [int]$expected.parentPid -and $parent[0].ExecutablePath -ieq 'C:\Windows\System32\svchost.exe' -and (($parentSid.ReturnValue -eq 0 -and $parentSid.Sid -ceq 'S-1-5-18') -or ($parentSid.ReturnValue -eq 2 -and -not $parentSid.Sid))) 'CANDIDATE_SCHEDULE_PARENT'
   }else{Need ($parentSid.ReturnValue -eq 0 -and $parentSid.Sid -ceq $owner) 'CANDIDATE_PARENT_OWNER'}
   Need ($parent[0].CreationDate.ToUniversalTime() -le $actual[0].CreationDate.ToUniversalTime()) 'CANDIDATE_PARENT_BIRTH'
   $parentBirth=$parent[0].CreationDate.ToUniversalTime()
   if($script:parentPins.ContainsKey([int]$expected.parentPid)){Need ($script:parentPins[[int]$expected.parentPid].Ticks -eq $parentBirth.Ticks) 'CANDIDATE_PARENT_REUSED'}else{$script:parentPins[[int]$expected.parentPid]=$parentBirth}
  }else{
   if($expected.role -ceq 'hub' -and $null -ne $hubParentBirth){$parentBirth=$hubParentBirth;$script:parentPins[[int]$expected.parentPid]=$parentBirth}else{
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
  }elseif($expected.role -ceq 'hub'){
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
 $relevantPids=[Collections.Generic.HashSet[int]]::new()
 foreach($p in $inventory.all){
  $relevant=$p.ProcessId -in $oldPids -or $p.ProcessId -in @($inventory.instances|ForEach-Object{$_.EnginePID}) -or [string]$p.CommandLine -match '(?i)watch-terminal-completion-logon\.ps1|watch-hub-after-erp\.ps1'
  foreach($pkg in $profile.packages){if(([string]$p.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -ge 0){$relevant=$true}}
  if($relevant){[void]$relevantPids.Add([int]$p.ProcessId)}
 }
 do{$added=$false;foreach($p in $inventory.all){if($relevantPids.Contains([int]$p.ParentProcessId) -and $relevantPids.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 foreach($p in $inventory.all){if($relevantPids.Contains([int]$p.ProcessId)){Need (@($selected|Where-Object{$_.pid -eq $p.ProcessId}).Count -eq 1) 'FOREIGN_PROCESS'}}
 return [pscustomobject]@{inventory=$inventory;selected=$selected}
}
function Health($expectedOwners){
 foreach($item in $profile.health){
  Need ($item.url -cmatch '\Ahttp://127\.0\.0\.1:(4184|4186|5234|62700|62701|62702|62703|62704)/') 'HEALTH_URL'
  $uri=[uri]$item.url
  $expected=@($expectedOwners|Where-Object{@($_.bindings|Where-Object{$_.port -eq $uri.Port -and $_.address -cin @('127.0.0.1','0.0.0.0')}).Count -eq 1})
  Need ($expected.Count -eq 1) 'HEALTH_EXPECTED_OWNER'
  $pre=Inventory
  Need (Identity ($pre.all|Where-Object{$_.ProcessId -eq $expected[0].pid}) $expected[0]) 'HEALTH_PROCESS_BEFORE'
  $bound=@($pre.listeners|Where-Object{$_.LocalPort -eq $uri.Port -and $_.LocalAddress -cin @('127.0.0.1','0.0.0.0')})
  Need ($bound.Count -eq 1 -and $bound[0].OwningProcess -eq $expected[0].pid) 'HEALTH_PORT_BEFORE'
  $value=Invoke-RestMethod -Uri $item.url -Method Get -TimeoutSec 5 -MaximumRedirection 0
  $post=Inventory
  Need (Identity ($post.all|Where-Object{$_.ProcessId -eq $expected[0].pid}) $expected[0]) 'HEALTH_PROCESS_AFTER'
  $after=@($post.listeners|Where-Object{$_.LocalPort -eq $uri.Port -and $_.LocalAddress -cin @('127.0.0.1','0.0.0.0')})
  Need ($after.Count -eq 1 -and $after[0].OwningProcess -eq $expected[0].pid -and $after[0].LocalAddress -ceq $bound[0].LocalAddress) 'HEALTH_PORT_AFTER'
  Need ((Field $value $item.databasePath) -ceq $database -and (Field $value $item.sourcePath) -ceq $item.expectedSource) 'HEALTH_IDENTITY'
 }
}
function StartedOwner([datetime]$started){
 $inventory=Inventory;ProtectedProcesses $inventory
 Need ($inventory.instances.Count -eq 2) 'STARTED_TASK_INSTANCES'
 $newByOld=@{};$owners=@()
 foreach($entry in $before.identities.PSObject.Properties){
  $expected=$entry.Value
  $matches=@($inventory.all|Where-Object{$_.ExecutablePath -ieq $expected.nodePath -and $_.CommandLine -ceq $expected.commandLine})
  Need ($matches.Count -eq 1) 'STARTED_ROLE_COUNT'
  $p=$matches[0];$sid=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction Stop
  Need ($sid.ReturnValue -eq 0 -and $sid.Sid -ceq $owner -and $p.CreationDate.ToUniversalTime() -ge $started -and [int]$p.ProcessId -ne [int]$expected.pid) 'STARTED_ROLE_IDENTITY'
  $newByOld[[int]$expected.pid]=$p
  $owners+=,[pscustomobject]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;ownerSid=$owner;nodePath=[string]$p.ExecutablePath;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');bindings=$expected.bindings}
  foreach($binding in @($expected.bindings)){
   Need (@($inventory.listeners|Where-Object{$_.LocalPort -eq $binding.port -and $_.LocalAddress -ceq $binding.address -and $_.OwningProcess -eq $p.ProcessId}).Count -eq 1) 'STARTED_PORT_IDENTITY'
  }
 }
 foreach($entry in $before.identities.PSObject.Properties){
  $expected=$entry.Value
  if($newByOld.ContainsKey([int]$expected.parentPid)){Need ($newByOld[[int]$expected.pid].ParentProcessId -eq $newByOld[[int]$expected.parentPid].ProcessId) 'STARTED_PARENT_IDENTITY'}
 }
 foreach($instance in $inventory.instances){
  $p=@($inventory.all|Where-Object{$_.ProcessId -eq $instance.EnginePID});Need ($p.Count -eq 1) 'STARTED_WATCHER'
  $sid=Invoke-CimMethod -InputObject $p[0] -MethodName GetOwnerSid -ErrorAction Stop
  [xml]$xml=($profile.tasks|Where-Object{$_.name -ceq $instance.Name}).oldXml
  $action=$xml.Task.Actions.Exec
  Need ($sid.ReturnValue -eq 0 -and $sid.Sid -ceq $owner -and $p[0].ExecutablePath -ieq [string]$action.Command -and $p[0].CommandLine -ceq ('"'+[string]$action.Command+'" '+[string]$action.Arguments) -and $p[0].CreationDate.ToUniversalTime() -ge $started) 'STARTED_WATCHER_IDENTITY'
 }
 Health $owners
 $stable=[ordered]@{owners=@($owners|Sort-Object pid);instances=@($inventory.instances|ForEach-Object{[ordered]@{name=[string]$_.Name;pid=[int]$_.EnginePID;guid=[string]$_.InstanceGuid}}|Sort-Object name)}
 return (Hash ([Text.UTF8Encoding]::new($false).GetBytes(($stable|ConvertTo-Json -Compress -Depth 10))))
}
Need ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ceq $owner) 'OWNER'
Need ([IO.Path]::GetFullPath($ProfilePath) -cmatch '\AC:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-profile-[a-f0-9]{32}\.json\z') 'PROFILE_PATH'
Need ([IO.Path]::GetFullPath($BeforeImagePath) -cmatch '\AC:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-before-[a-f0-9]{32}\.json\z') 'BEFORE_PATH'
$profile=Json (ReadPinned $ProfilePath $ProfileSha256)
$before=Json (ReadPinned $BeforeImagePath $BeforeImageSha256)
Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $profile.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $before.ownerSid -ceq $owner -and $before.database -ceq $database -and $before.actualT1 -ceq $false) 'PROFILE_SCOPE'
Need ($profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.oldSettings.sha256 -ceq $before.oldConfig.sha256 -and $profile.newSettings.sha256 -ceq $before.newConfig.sha256) 'BEFORE_REF'
Need (@($profile.tasks).Count -eq 2 -and @($profile.packages).Count -ge 3 -and @($profile.health).Count -ge 2 -and @($profile.protectedProcesses).Count -ge 1) 'PROFILE_COUNT'
Need ((@($profile.tasks|ForEach-Object{$_.name}|Sort-Object)-join '|') -ceq (($names|Sort-Object)-join '|')) 'TASK_NAMES'
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256)
$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.actualT1 -ceq $false -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId) 'SETTINGS_SCOPE'}
Need ($newSettings.components.erpApiNative.sourceCommit -ceq $before.profile.erpSource -and $newSettings.components.erpApiNative.manifestSha256 -ceq $before.profile.erpManifest -and $newSettings.components.crm.sourceCommit -ceq $before.profile.crmSource -and $newSettings.components.crm.manifestSha256 -ceq $before.profile.crmManifest -and $newSettings.supervisor.sourceCommit -ceq $before.profile.supervisorSource -and $newSettings.supervisor.manifestSha256 -ceq $before.profile.supervisorManifest) 'NEW_PROFILE_PINS'
Need ([IO.Path]::GetFullPath($oldSettings.supervisor.packageRoot) -ceq [IO.Path]::GetFullPath($before.oldSupervisor.root) -and $oldSettings.supervisor.manifestSha256 -ceq $before.oldSupervisor.manifest) 'OLD_SUPERVISOR_PINS'
$expectedPackages=@{}
foreach($settings in @($oldSettings,$newSettings)){
 foreach($component in @($settings.components.PSObject.Properties|ForEach-Object{$_.Value})+@($settings.supervisor)){
  $root=[IO.Path]::GetFullPath($component.packageRoot)
  if($expectedPackages.ContainsKey($root)){Need ($expectedPackages[$root].sourceCommit -ceq $component.sourceCommit -and $expectedPackages[$root].manifestSha256 -ceq $component.manifestSha256) 'SETTINGS_PACKAGE_CONFLICT'}else{$expectedPackages[$root]=$component}
 }
}
Need (@($profile.packages).Count -eq $expectedPackages.Count) 'PACKAGE_COUNT'
$seenPackages=@()
foreach($entry in $profile.tasks){
 Need ((XmlHash $entry.oldXml) -ceq $entry.oldXmlSha256 -and $entry.oldXml -ceq ($before.tasks|Where-Object{$_.name -ceq $entry.name}).xml) 'BEFORE_TASK_XML'
}
foreach($pkg in $profile.packages){
 Need ([IO.Path]::GetFullPath($pkg.root) -cmatch '\AC:\\Sirket\\(?:ERP|CRM)\\releases\\[^\r\n]+\z') 'PACKAGE_ROOT'
 $pkgRoot=[IO.Path]::GetFullPath($pkg.root)
 Need ($expectedPackages.ContainsKey($pkgRoot) -and $pkgRoot -cnotin $seenPackages -and $pkg.sourceCommit -ceq $expectedPackages[$pkgRoot].sourceCommit -and $pkg.manifestSha256 -ceq $expectedPackages[$pkgRoot].manifestSha256) 'SETTINGS_PACKAGE_BINDING'
 $seenPackages+=$pkgRoot
 NoReparse $pkg.manifestPath
 Need ([IO.Path]::GetFullPath($pkg.manifestPath) -ceq (Join-Path $pkg.root 'release-manifest.json')) 'MANIFEST_PATH'
 $manifestBytes=[IO.File]::ReadAllBytes($pkg.manifestPath);Need ((Hash $manifestBytes) -ceq $pkg.manifestSha256) 'MANIFEST_HASH';$manifest=Json $manifestBytes
 Need ($manifest.sourceCommit -ceq $pkg.sourceCommit) 'MANIFEST_SOURCE'
 Need (@($manifest.files).Count -gt 0) 'MANIFEST_EMPTY'
 foreach($file in $manifest.files){
  $filePath=[IO.Path]::GetFullPath((Join-Path $pkg.root $file.path));Need ($filePath.StartsWith($pkg.root+'\',[StringComparison]::OrdinalIgnoreCase)) 'PACKAGE_ESCAPE';NoReparse $filePath
  Need ((Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $file.sha256) 'PACKAGE_CONTENT'
 }
}
[void](ReadPinned $profile.businessDigest.path $profile.businessDigest.sha256)
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
if($Mode -ceq 'PreflightOld'){
 $inventory=Inventory;ProtectedProcesses $inventory;AssertTasks 4
 foreach($p in $before.identities.PSObject.Properties){Need (Identity ($inventory.all|Where-Object{$_.ProcessId -eq $p.Value.pid}) $p.Value) 'OLD_PROCESS_DRIFT'}
 Need ($inventory.instances.Count -eq 2) 'OLD_TASK_INSTANCES';Health @($before.identities.PSObject.Properties|ForEach-Object{$_.Value})
 [ordered]@{status='OLD_PHYSICAL_PREFLIGHT';profileSha256=$ProfileSha256;beforeImageSha256=$BeforeImageSha256;applyAvailable=$false;mutationExecuted=$false}|ConvertTo-Json
 return
}
if($Mode -ceq 'StopNew'){
 $script:parentPins=@{};$script:watcherPins=@{};$script:tasksStopRequested=$false
 Need ([IO.Path]::GetFullPath($CandidatePath) -cmatch '\AC:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-candidate-[a-f0-9]{32}\.json\z') 'CANDIDATE_PATH'
 $evidence=Json (ReadPinned $CandidatePath $CandidateSha256)
 Need ($evidence.schemaVersion -ceq 'melisa-p03-physical-candidate.v1' -and $evidence.profileSha256 -ceq $ProfileSha256 -and $evidence.beforeSha256 -ceq $BeforeImageSha256 -and @($evidence.processes).Count -le 10) 'CANDIDATE_SCOPE'
 $age=([DateTime]::UtcNow-[DateTime]::Parse($evidence.observedAt).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60) 'CANDIDATE_STALE'
 Need (@($profile.candidateRules).Count -eq 10 -and @($profile.candidateRules.role|Sort-Object -Unique).Count -eq 10) 'CANDIDATE_RULES'
 Need ((@($profile.candidateRules.role|Sort-Object)-join '|') -ceq ((@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor')|Sort-Object)-join '|')) 'CANDIDATE_ROLE_SET'
 Need ($profile.stopper.path -ceq 'C:\Sirket\CRM\runtime\CRM06-TEST-ACTORS-20261014\stop-exact-observed-process.ps1' -and $profile.stopper.sha256 -ceq '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d') 'STOPPER_PIN'
 [void](ReadPinned $profile.stopper.path $profile.stopper.sha256)
 Need ($profile.journalDirectory -cmatch '\AC:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-recovery-[a-f0-9]{32}\z') 'JOURNAL_PATH'
 Protected $profile.journalDirectory
 # Admission completes before creating any durable intent or stopping a task.
 TaskPhase 'new';$admitted=CandidateInventory $evidence
 $comPins=@()
 foreach($instance in $admitted.inventory.instances){$comPins+=,[pscustomobject]@{name=[string]$instance.Name;guid=[string]$instance.InstanceGuid;pid=[int]$instance.EnginePID}}
 $lock=[IO.File]::Open((Join-Path $profile.journalDirectory 'recovery.lock'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{
  Need (@(Get-ChildItem -LiteralPath $profile.journalDirectory -Force|Where-Object{$_.Name -cne 'recovery.lock'}).Count -eq 0) 'RECOVERY_JOURNAL_NOT_EMPTY'
  $script:sequence=0;$script:previous=$BeforeImageSha256
  [void](ReadPinned $CandidatePath $CandidateSha256);TaskPhase 'new';[void](CandidateInventory $evidence)
  Append 'RECOVERY_INTENT'
  $script:tasksStopRequested=$true
  foreach($pin in $comPins){
   TaskPhase 'new';$now=CandidateInventory $evidence
   $matched=@($now.inventory.instances|Where-Object{$_.Name -ceq $pin.name -and [string]$_.InstanceGuid -ceq $pin.guid -and [int]$_.EnginePID -eq $pin.pid})
   Need ($matched.Count -eq 1) 'COM_INSTANCE_DRIFT'
   $matched[0].Stop()
  }
  $stopped=$false
  for($attempt=0;$attempt -lt 30;$attempt++){$now=Inventory;if($now.instances.Count -eq 0 -and @($names|Where-Object{[int]$folder.GetTask($_).State -ne 3}).Count -eq 0){$stopped=$true;break};Start-Sleep -Milliseconds 500}
  Need $stopped 'COM_STOP_UNVERIFIED';TaskPhase 'new'
  Append 'RECOVERY_TASKS_STOPPED'
  $order=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor')
  foreach($role in $order){
   $current=CandidateInventory $evidence
   $row=@($current.selected|Where-Object{$_.role -ceq $role});if($row.Count -eq 0){continue}
   Need ($row.Count -eq 1 -and $current.inventory.instances.Count -eq 0) 'STOP_ROLE'
   [void](ReadPinned $profile.stopper.path $profile.stopper.sha256)
   Append 'RECOVERY_EXACT_STOP_INTENT' $row[0].pid
   $proof=[ordered]@{pid=$row[0].pid;parentPid=$row[0].parentPid;nodePath=$row[0].nodePath;ownerSid=$row[0].ownerSid;commandLine=$row[0].commandLine;creationTime=[DateTime]::Parse($row[0].creationTime).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')}
   $base64=[Convert]::ToBase64String([Text.UTF8Encoding]::new($false).GetBytes(($proof|ConvertTo-Json -Compress)))
   $result=& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -File $profile.stopper.path -ExpectedJsonBase64 $base64
   Need ($LASTEXITCODE -eq 0 -and [string]$result -cin @('EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE')) 'EXACT_STOP_FAILED'
   $after=Inventory;Need (@($after.all|Where-Object{$_.ProcessId -eq $row[0].pid}).Count -eq 0) 'EXACT_STOP_NOT_ABSENT';ProtectedProcesses $after
   Append 'RECOVERY_EXACT_STOPPED' $row[0].pid
  }
  AssertEmpty (Inventory);TaskPhase 'new'
  Append 'RECOVERY_OLD_ACTION_RESTORE_INTENT'
  foreach($entry in $profile.tasks){
   AssertEmpty (Inventory)
   Need ((XmlHash ([string]$folder.GetTask($entry.name).Xml)) -ceq $entry.newXmlSha256) 'ACTION_RESTORE_CAS'
   [xml]$xml=$entry.oldXml;$exec=$xml.Task.Actions.Exec
   Need (@($xml.Task.Actions.ChildNodes).Count -eq 1) 'OLD_SINGLE_ACTION'
   $action=New-ScheduledTaskAction -Execute ([string]$exec.Command) -Argument ([string]$exec.Arguments) -WorkingDirectory ([string]$exec.WorkingDirectory)
   [void](Set-ScheduledTask -TaskPath '\' -TaskName $entry.name -Action $action -ErrorAction Stop)
   Need ((XmlHash ([string]$folder.GetTask($entry.name).Xml)) -ceq $entry.oldXmlSha256) 'ACTION_RESTORE_READBACK'
  }
  AssertEmpty (Inventory);AssertTasks 3
  Append 'RECOVERY_COMPLETE'
  [ordered]@{status='RECOVERED_OLD_ACTIONS';profileSha256=$ProfileSha256;beforeImageSha256=$BeforeImageSha256;journalTailSha256=$script:previous;oldTasksStarted=$false}|ConvertTo-Json
 }finally{$lock.Dispose()}
 return
}
# Journal is a local protected directory; every record is raw-byte hash linked.
Need ($RecoveryTailSha256 -cmatch '\A[a-f0-9]{64}\z') 'RECOVERY_TAIL'
Need ($profile.journalDirectory -cmatch '\AC:\\Users\\Xaser\\AppData\\Local\\MelisaERP-P03-recovery-[a-f0-9]{32}\z') 'JOURNAL_PATH'
Protected $profile.journalDirectory
$journalLock=[IO.File]::Open((Join-Path $profile.journalDirectory 'rollback.lock'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
$rollbackAttempted=$false
try{
 $files=@(Get-ChildItem -LiteralPath $profile.journalDirectory -File|Where-Object{$_.Name -cmatch '\Aevent-[0-9]{4}\.json\z'}|Sort-Object Name)
 Need ($files.Count -gt 0 -and $files.Count -lt 9990) 'JOURNAL_COUNT'
 $previous=$BeforeImageSha256;$sequence=0;$last=$null;$records=@()
 foreach($file in $files){
  Need ($file.Name -ceq ('event-'+$sequence.ToString('0000')+'.json')) 'JOURNAL_GAP'
  $bytes=[IO.File]::ReadAllBytes($file.FullName);$digest=Hash $bytes;$record=Json (ReadPinned $file.FullName $digest)
  Need ($record.sequence -eq $sequence -and $record.previousSha256 -ceq $previous -and $record.profileSha256 -ceq $ProfileSha256 -and $record.beforeSha256 -ceq $BeforeImageSha256) 'JOURNAL_CHAIN'
  Need ($record.event -cin @('RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_EXACT_STOP_INTENT','RECOVERY_EXACT_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE')) 'JOURNAL_EVENT'
  $previous=$digest;$sequence++;$last=$record;$records+=,$record
 }
 Need ($last.event -ceq 'RECOVERY_COMPLETE' -and $previous -ceq $RecoveryTailSha256) 'RECOVERY_NOT_COMPLETE'
 Need ($records.Count -ge 4 -and $records[0].event -ceq 'RECOVERY_INTENT' -and $records[1].event -ceq 'RECOVERY_TASKS_STOPPED' -and $records[$records.Count-2].event -ceq 'RECOVERY_OLD_ACTION_RESTORE_INTENT' -and ($records.Count-4)%2 -eq 0) 'RECOVERY_SEQUENCE'
 for($i=2;$i -lt $records.Count-2;$i+=2){Need ($records[$i].event -ceq 'RECOVERY_EXACT_STOP_INTENT' -and $records[$i+1].event -ceq 'RECOVERY_EXACT_STOPPED' -and [int]$records[$i].pid -gt 0 -and $records[$i].pid -eq $records[$i+1].pid) 'RECOVERY_STOP_SEQUENCE'}
 AssertTasks 3;AssertEmpty (Inventory)
 # Re-read pinned profile and before bytes immediately before durable intent.
 [void](ReadPinned $ProfilePath $ProfileSha256);[void](ReadPinned $BeforeImagePath $BeforeImageSha256)
 Append 'ROLLBACK_START_INTENT'
 $rollbackAttempted=$true
 $rollbackStart=[DateTime]::UtcNow
 AssertTasks 3;Start-ScheduledTask -TaskPath '\' -TaskName $names[0] -ErrorAction Stop
 # Starting the first task changes only its state; recheck exact metadata on
 # both before admitting the second task, without requiring the first Ready.
 foreach($entry in $profile.tasks){Need ((XmlHash ([string]$folder.GetTask($entry.name).Xml)) -ceq $entry.oldXmlSha256) 'START_TASK_DRIFT'}
 Start-ScheduledTask -TaskPath '\' -TaskName $names[1] -ErrorAction Stop
 Append 'ROLLBACK_STARTED'
 $ready=$false;$deadline=[DateTime]::UtcNow.AddMinutes(5);$stableSince=$null;$stableDigest=$null
 while([DateTime]::UtcNow -lt $deadline){
  try{
   AssertTasks 4;$seenDigest=StartedOwner $rollbackStart
   if($null -eq $stableSince -or $stableDigest -cne $seenDigest){$stableSince=[DateTime]::UtcNow;$stableDigest=$seenDigest}
   if(([DateTime]::UtcNow-$stableSince).TotalSeconds -ge 30 -and [DateTime]::UtcNow -lt $deadline){$ready=$true;break}
  }catch{$stableSince=$null;$stableDigest=$null}
  Start-Sleep -Milliseconds 500
 }
 Need $ready 'ROLLBACK_READBACK_FAILED'
 ProtectedProcesses (Inventory)
 Append 'RESTORED_READY'
 [ordered]@{status='RESTORED_READY';profileSha256=$ProfileSha256;beforeImageSha256=$BeforeImageSha256;journalTailSha256=$script:previous;restoreExecuted=$false}|ConvertTo-Json
}catch{
 if($rollbackAttempted){try{Append 'ROLLBACK_FAILED';Append 'QUARANTINED'}catch{}}
 throw
}finally{$journalLock.Dispose()}
