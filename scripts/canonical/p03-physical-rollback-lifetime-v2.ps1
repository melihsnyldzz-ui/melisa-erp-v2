param(
 [ValidateSet('Shared','Rehearsal')][string]$Environment='Shared',
 [ValidateSet('PreflightOld','PreflightNew','StopNew','RollbackOld')][string]$Mode='PreflightOld',
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
$invokedAtUtc=[DateTime]::UtcNow
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')
$ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
$isRehearsal=$Environment -ceq 'Rehearsal'
$rehearsalBase='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018'
$runRoot=$null
if($isRehearsal){
 $database='MELISA_ERP_P03_RESTORE_TEST_20261018_01'
 $names=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')
 $ports=@(4284,4286,5334,62710,62711,62712,62713,62714)
}
function Need($condition,[string]$code){if(-not $condition){throw ('P03_PHYSICAL_'+$code)}}
function Hash([byte[]]$bytes){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}
function NoReparse([string]$path){for($part=[IO.Path]::GetFullPath($path);$part;$part=[IO.Path]::GetDirectoryName($part)){Need (([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE'}}
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
 try{$sid=Invoke-CimMethod -InputObject $actual -MethodName GetOwnerSid -ErrorAction Stop}catch{
  if((Get-Variable tasksStopRequested -Scope Script -ErrorAction SilentlyContinue) -and $script:tasksStopRequested -and (Get-Variable admittedExitPins -Scope Script -ErrorAction SilentlyContinue) -and $script:admittedExitPins.ContainsKey([int]$expected.pid)){
   $pin=$script:admittedExitPins[[int]$expected.pid]
   $sameExpected=($pin|ConvertTo-Json -Compress) -ceq ($expected|ConvertTo-Json -Compress)
   $sameSnapshot=[int]$actual.ProcessId -eq [int]$pin.pid -and [int]$actual.ParentProcessId -eq [int]$pin.parentPid -and $actual.ExecutablePath -ieq $pin.nodePath -and $actual.CommandLine -ceq $pin.commandLine -and $actual.CreationDate.ToUniversalTime().Ticks -eq [DateTime]::Parse($pin.creationTime).ToUniversalTime().Ticks
   if($sameExpected -and $sameSnapshot){$fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$pin.pid) -ErrorAction Stop);if($fresh.Count -eq 0){throw 'P03_PHYSICAL_KNOWN_EXIT_RECAPTURE'}}
  }
  throw
 }
 return $sid.ReturnValue -eq 0 -and $sid.Sid -ceq $expected.ownerSid -and [int]$actual.ProcessId -eq [int]$expected.pid -and [int]$actual.ParentProcessId -eq [int]$expected.parentPid -and $actual.ExecutablePath -ieq $expected.nodePath -and $actual.CommandLine -ceq $expected.commandLine -and $actual.CreationDate.ToUniversalTime().Ticks -eq [DateTime]::Parse($expected.creationTime).ToUniversalTime().Ticks
}
# Versioned observation-only OLD PID reuse admission. Never a stop target.
function OldReuseHold($row){
 $h=[Diagnostics.Process]::GetProcessById([int]$row.ProcessId);[void]$h.Handle
 try{Need (-not $h.HasExited -and $h.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ') -ceq $row.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')) 'OLD_REUSE_HANDLE';return $h}catch{$h.Dispose();throw}
}
function OldReusePin($row){
 Need (-not[string]::IsNullOrWhiteSpace($row.ExecutablePath) -and -not[string]::IsNullOrWhiteSpace($row.CommandLine)) 'OLD_REUSE_FIELDS'
 NoReparse $row.ExecutablePath
 $sid=Invoke-CimMethod -InputObject $row -MethodName GetOwnerSid -ErrorAction Stop;Need ($sid.ReturnValue -eq 0 -and $sid.Sid -ceq $owner) 'OLD_REUSE_OWNER'
 return [pscustomobject]@{pid=[int]$row.ProcessId;parentPid=[int]$row.ParentProcessId;nodePath=[string]$row.ExecutablePath;commandLine=[string]$row.CommandLine;ownerSid=$sid.Sid;creationTime=$row.CreationDate.ToUniversalTime().ToString('o');imageHash=(Get-FileHash -LiteralPath $row.ExecutablePath -Algorithm SHA256).Hash}
}
# P03_FAILURE_RECORD_BEGIN
# Source-only failure-record revision; no caller/runtime pin is changed here.
function WriteOldReuseFailureRecord($failure,$inventory,$row,[string]$guardDefinition){
 function RecordValue($obj,$name){if($null -ne $obj){$p=$obj.PSObject.Properties[$name];if($null -ne $p){return $p.Value}};return $null}
 function RecordInt($v){$number=0;if($null -ne $v -and [int]::TryParse([string]$v,[ref]$number) -and $number -ge 0){return $number};return $null}
 function RecordBirth($v){
  if($null -eq $v -or [string]::IsNullOrWhiteSpace([string]$v)){return [ordered]@{status='UNKNOWN';utc=$null}}
  try{$birth=if($v -is [DateTime]){$v}else{[DateTime]::Parse([string]$v)};return [ordered]@{status='SUPPLIED';utc=$birth.ToUniversalTime().ToString('o')}}catch{return [ordered]@{status='UNKNOWN';utc=$null}}
 }
 function RecordSha($v){if([string]$v -cmatch '\A[a-f0-9]{64}\z'){return [string]$v};return 'UNKNOWN'}
 $all=@((RecordValue $inventory 'all')|Where-Object{$null -ne $_});$listeners=@((RecordValue $inventory 'allListeners')|Where-Object{$null -ne $_});$instances=@((RecordValue $inventory 'instances')|Where-Object{$null -ne $_})
 Need ($all.Count -le 8192 -and $listeners.Count -le 8192 -and $instances.Count -le 256) 'FAILURE_RECORD_BOUNDS'
 $expected=@();$roles=@('erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer','hub','coreSupervisor','terminalWatcher','hubWatcher')
 $identities=RecordValue $before 'identities'
 if($null -ne $identities){foreach($entry in $identities.PSObject.Properties){$expected+=,[ordered]@{role=$(if($entry.Name -cin $roles){$entry.Name}else{'UNKNOWN'});pid=(RecordInt (RecordValue $entry.Value 'pid'));birth=(RecordBirth (RecordValue $entry.Value 'creationTime'))}}}
 $watchers=@((RecordValue $profile 'oldWatchers')|Where-Object{$null -ne $_})
 for($i=0;$i -lt $watchers.Count;$i++){$expected+=,[ordered]@{role=('oldWatcher['+$i+']');pid=(RecordInt (RecordValue $watchers[$i] 'pid'));birth=(RecordBirth (RecordValue $watchers[$i] 'creationTime'))}}
 Need ($expected.Count -le 64) 'FAILURE_RECORD_PIN_BOUNDS'
 $captured=Get-Variable capturedCandidatePids -Scope Script -ErrorAction SilentlyContinue
 $candidateIds=@(if($null -ne $captured -and $null -ne $captured.Value){$captured.Value|ForEach-Object{RecordInt $_}})
 Need ($candidateIds.Count -le 64) 'FAILURE_RECORD_CANDIDATE_BOUNDS'
 $safeFailure=FailureDiagnostic $failure
 $sourceFile=$MyInvocation.MyCommand.ScriptBlock.File
 $sourceSha=if(-not[string]::IsNullOrWhiteSpace($sourceFile)){Hash ([IO.File]::ReadAllBytes($sourceFile))}else{'UNKNOWN'}
 $triggerPid=RecordInt (RecordValue $row 'ProcessId')
 $payload=[ordered]@{
  schemaVersion='melisa-p03-old-pid-failure.v1';sourceRevision='FAILURE_RECORD_SOURCE';sourceFileSha256=$sourceSha
  guardDefinitionSha256=(Hash ([Text.UTF8Encoding]::new($false).GetBytes($guardDefinition.Replace("`r`n","`n"))))
  observedAt=[DateTime]::UtcNow.ToString('o');phase='AssertOldPidLifetimes';mode=$(if($Mode -cin @('PreflightOld','PreflightNew','StopNew','RollbackOld')){$Mode}else{'UNKNOWN'})
  environment=$(if($Environment -cin @('Shared','Rehearsal')){$Environment}else{'UNKNOWN'});culture=[Globalization.CultureInfo]::CurrentCulture.Name;timeZoneId=[TimeZoneInfo]::Local.Id
  profileSha256=(RecordSha $ProfileSha256);beforeSha256=(RecordSha $BeforeImageSha256);candidateSha256=(RecordSha $CandidateSha256)
  oldSettingsSha256=(RecordSha (RecordValue (RecordValue $profile 'oldSettings') 'sha256'));newSettingsSha256=(RecordSha (RecordValue (RecordValue $profile 'newSettings') 'sha256'))
  failure=$safeFailure;trigger=[ordered]@{pid=$triggerPid;birth=(RecordBirth (RecordValue $row 'CreationDate'));roles=@($expected|Where-Object{$null -ne $triggerPid -and $_.pid -eq $triggerPid}|ForEach-Object{$_.role})}
  expected=$expected;capturedCandidatePidsKnown=($null -ne $captured -and $null -ne $captured.Value);capturedCandidatePids=$candidateIds
  inputOrigin='SAME_ASSERT_ARGUMENT';projection='PID_BIRTH_TOPOLOGY_ONLY';fullGuardReplayAvailable=$false
  inventory=[ordered]@{
   allKnown=($null -ne $inventory.PSObject.Properties['all'] -and $null -ne $inventory.PSObject.Properties['all'].Value);all=@($all|ForEach-Object{[ordered]@{ProcessId=(RecordInt (RecordValue $_ 'ProcessId'));ParentProcessId=(RecordInt (RecordValue $_ 'ParentProcessId'));birth=(RecordBirth (RecordValue $_ 'CreationDate'))}})
   allListenersKnown=($null -ne $inventory.PSObject.Properties['allListeners'] -and $null -ne $inventory.PSObject.Properties['allListeners'].Value);allListeners=@($listeners|ForEach-Object{[ordered]@{OwningProcess=(RecordInt (RecordValue $_ 'OwningProcess'))}})
   instancesKnown=($null -ne $inventory.PSObject.Properties['instances'] -and $null -ne $inventory.PSObject.Properties['instances'].Value);instances=@($instances|ForEach-Object{[ordered]@{EnginePID=(RecordInt (RecordValue $_ 'EnginePID'))}})
  }
  admissionGranted=$false;stopAuthority=$false;applyExecuted=$false
 }
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($payload|ConvertTo-Json -Depth 16 -Compress));Need ($bytes.Length -le 2097152) 'FAILURE_RECORD_SIZE'
 $sha=Hash $bytes
 # No artifact is placed in the recovery journal: its empty/chain gates stay exact.
 Need ($Mode -cin @('PreflightOld','PreflightNew','StopNew','RollbackOld') -and $Environment -cin @('Shared','Rehearsal')) 'FAILURE_RECORD_CONTEXT'
 $recordProfile=[IO.Path]::GetFullPath($ProfilePath);$recordBefore=[IO.Path]::GetFullPath($BeforeImagePath);$recordRoot=[IO.Path]::GetDirectoryName($recordProfile)
 if($Environment -ceq 'Rehearsal'){
  Need ($recordProfile -cmatch '\AC:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\profile\.json\z' -and $recordBefore -ceq (Join-Path $recordRoot 'before.json') -and $profile.journalDirectory -ceq (Join-Path $recordRoot 'recovery')) 'FAILURE_RECORD_PATH'
 }else{
  Need ($recordProfile -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-profile-[a-f0-9]{32}\.json\z' -and $recordBefore -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-[a-f0-9]{32}\.json\z' -and $profile.journalDirectory -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-[a-f0-9]{32}\z') 'FAILURE_RECORD_PATH'
 }
 $target=Join-Path $recordRoot ('old-pid-failure-'+$sha+'.json');Protected $recordRoot
 WriteOldReuseFailureFile $target $bytes
 [void](ReadPinned $target $sha)
 $failure.Exception.Data['P03OldPidFailureRecordSha256']=$sha
}
function WriteOldReuseFailureFile([string]$target,[byte[]]$bytes){
 $security=[Security.AccessControl.FileSecurity]::new();$security.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$security.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){[void]$security.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))}
 $stream=New-Object IO.FileStream($target,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$security)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
# P03_FAILURE_RECORD_END
function AssertOldPidLifetimes($inventory){
# P03_FAILURE_RECORD_BEGIN
 try {
# P03_FAILURE_RECORD_END
 $candidateIds=if(Get-Variable capturedCandidatePids -Scope Script -ErrorAction SilentlyContinue){@($script:capturedCandidatePids)}else{@()}
 $old=@($before.identities.PSObject.Properties|ForEach-Object{$_.Value})+@($profile.oldWatchers)
 $oldIds=@($old|ForEach-Object{[int]$_.pid})
 $initial=-not(Get-Variable oldReusePins -Scope Script -ErrorAction SilentlyContinue)
 if($initial){$script:oldReusePins=@{}}
 $observed=@()
 foreach($row in @($inventory.all|Where-Object{$_.ProcessId -in $oldIds})){
  Need (-not$isRehearsal -and $before.copyId -ceq 'e16b70f0-4057-428b-9abc-6bbcaf35fe82' -and $profile.oldSettings.sha256 -ceq 'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071' -and $newSettings.components.erpApiNative.sourceCommit -ceq '01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2') 'OLD_REUSE_SCOPE'
  $id=[int]$row.ProcessId;Need ($id -notin $observed) 'OLD_REUSE_DUPLICATE';$observed+=,$id
  Need (@($inventory.instances|Where-Object{$_.EnginePID -eq $id}).Count -eq 0 -and @($inventory.allListeners|Where-Object{$_.OwningProcess -eq $id}).Count -eq 0 -and @($inventory.all|Where-Object{$_.ParentProcessId -eq $id}).Count -eq 0) 'OLD_REUSE_LINKED'
  Need ($id -notin $candidateIds -and $id -notin @($profile.protectedProcesses|ForEach-Object{$_.pid})) 'OLD_REUSE_CANDIDATE'
  foreach($pin in @($old|Where-Object{$_.pid -eq $id})){Need ($pin.PSObject.Properties.Name -contains 'creationTime' -and $row.CreationDate.ToUniversalTime().Ticks -gt [DateTime]::Parse($pin.creationTime).ToUniversalTime().Ticks) 'OLD_LIFETIME_PRESENT'}
  # Every actual ancestor must remain outside the recovery cohort/package scope.
  $walk=$row;$visited=@()
  while($null -ne $walk){
   Need ([int]$walk.ProcessId -notin $visited) 'OLD_REUSE_ANCESTRY';$visited+=,[int]$walk.ProcessId
   Need (-not(IsWatcherCommand ([string]$walk.CommandLine))) 'OLD_REUSE_WATCHER'
   foreach($pkg in $profile.packages){Need (([string]$walk.CommandLine).IndexOf($pkg.root,[StringComparison]::OrdinalIgnoreCase) -lt 0) 'OLD_REUSE_PACKAGE'}
   Need ([int]$walk.ParentProcessId -notin ($candidateIds+$oldIds+@($profile.protectedProcesses|ForEach-Object{$_.pid}))) 'OLD_REUSE_PARENT_SCOPE'
   $parents=@($inventory.all|Where-Object{$_.ProcessId -eq $walk.ParentProcessId});Need ($parents.Count -le 1) 'OLD_REUSE_PARENT_DUPLICATE'
   $walk=if($parents.Count){$parents[0]}else{$null}
  }
  $parent=@($inventory.all|Where-Object{$_.ProcessId -eq $row.ParentProcessId});Need ($parent.Count -eq 1 -and $parent[0].CreationDate.ToUniversalTime() -le $row.CreationDate.ToUniversalTime()) 'OLD_REUSE_PARENT'
  if(-not$script:oldReusePins.ContainsKey($id)){
   Need $initial 'OLD_REUSE_NEW_LIFETIME'
   $childPin=OldReusePin $row;$parentPin=OldReusePin $parent[0];$childHandle=OldReuseHold $row
   try{$parentHandle=OldReuseHold $parent[0]}catch{$childHandle.Dispose();throw}
   $script:oldReusePins[$id]=[pscustomobject]@{child=$childPin;parent=$parentPin;childHandle=$childHandle;parentHandle=$parentHandle}
  }
  $proof=$script:oldReusePins[$id]
  Need (-not$proof.childHandle.HasExited -and -not$proof.parentHandle.HasExited -and (Identity $row $proof.child) -and (Identity $parent[0] $proof.parent)) 'OLD_REUSE_IDENTITY'
  foreach($pair in @(@($row,$proof.child),@($parent[0],$proof.parent))){NoReparse $pair[0].ExecutablePath;Need ((Get-FileHash -LiteralPath $pair[0].ExecutablePath -Algorithm SHA256).Hash -ceq $pair[1].imageHash) 'OLD_REUSE_IMAGE'}
 }
 return $observed
# P03_FAILURE_RECORD_BEGIN
 }catch{
  $originalFailure=$_
  try{[void](WriteOldReuseFailureRecord $originalFailure $inventory (Get-Variable row -Scope 0 -ValueOnly -ErrorAction SilentlyContinue) $MyInvocation.MyCommand.Definition)}catch{}
  throw
 }
# P03_FAILURE_RECORD_END
}
function Inventory{
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 $allListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 $listeners=@($allListeners|Where-Object{$_.LocalPort -in $ports})
 $running=$schedule.GetRunningTasks(1);$instances=@()
 for($i=1;$i -le $running.Count;$i++){$r=$running.Item($i);if($r.Name -cin $names){$instances+=,$r}}
 return [pscustomobject]@{all=$all;allListeners=$allListeners;listeners=$listeners;instances=$instances}
}
function SqlServiceProtection($pinned,$inventory){
 Need ((@($pinned.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'creationTime|kind|name|pid|service|sql' -and $pinned.kind -ceq 'ProtectedSqlService' -and $pinned.name -ceq 'sqlservr.exe' -and [int]$pinned.pid -gt 0) 'SQL_PROTECTION_SCHEMA'
 Need ($pinned.service.name -ceq 'MSSQL$MELISADEV' -and $pinned.service.state -ceq 'Running' -and $pinned.service.processId -eq $pinned.pid -and $pinned.sql.serverName -ceq 'Semih\MELISADEV' -and $pinned.sql.databaseName -ceq 'master' -and $pinned.sql.processId -eq $pinned.pid) 'SQL_PROTECTION_SCOPE'
 $process=@($inventory.all|Where-Object{$_.ProcessId -eq $pinned.pid})
 Need ($process.Count -eq 1 -and $process[0].Name -ceq 'sqlservr.exe' -and $process[0].CreationDate.ToUniversalTime().Ticks -eq [DateTime]::Parse($pinned.creationTime).ToUniversalTime().Ticks) 'SQL_PROCESS_CHANGED'
 $service=@(Get-CimInstance Win32_Service -Filter 'Name=''MSSQL$MELISADEV''' -ErrorAction Stop)
 Need ($service.Count -eq 1 -and $service[0].Name -ceq $pinned.service.name -and $service[0].State -ceq 'Running' -and [int]$service[0].ProcessId -eq $pinned.pid -and $service[0].StartName -ceq $pinned.service.startName -and $service[0].PathName -ceq $pinned.service.pathName) 'SQL_SERVICE_CHANGED'
 $connection=[Data.SqlClient.SqlConnection]::new('Server=Semih\MELISADEV;Database=master;Integrated Security=True;Connect Timeout=5;Application Name=MelisaP03SqlProtectionReadOnly')
 try{
  $connection.Open();$cmd=$connection.CreateCommand();$cmd.CommandTimeout=5;$cmd.CommandText="SELECT CAST(SERVERPROPERTY('ProcessID') AS int),CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)),DB_NAME()"
  $reader=$cmd.ExecuteReader()
  try{Need ($reader.Read() -and $reader.GetInt32(0) -eq $pinned.pid -and $reader.GetString(1) -ceq 'Semih\MELISADEV' -and $reader.GetString(2) -ceq 'master') 'SQL_MASTER_IDENTITY_CHANGED';Need (-not $reader.Read()) 'SQL_MASTER_IDENTITY_COUNT'}finally{$reader.Dispose();$cmd.Dispose()}
 }finally{$connection.Dispose()}
}
function ProtectedProcesses($inventory){
 foreach($p in $profile.protectedProcesses){
  if($p.PSObject.Properties.Name -ccontains 'kind'){
   Need ($p.kind -ceq 'ProtectedSqlService') 'PROTECTED_KIND';SqlServiceProtection $p $inventory
  }else{Need (Identity ($inventory.all|Where-Object{$_.ProcessId -eq $p.pid}) $p) 'PROTECTED_PROCESS_CHANGED'}
 }
 if($isRehearsal){
  $sharedPorts=@(4184,4186,5234,62700,62701,62702,62703,62704);$allProtectedPorts=$sharedPorts+@(4144,4146,5194)
  $current=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort -in $allProtectedPorts}|ForEach-Object{[pscustomobject]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress;pid=[int]$_.OwningProcess}}|Sort-Object port,address,pid)
  $expected=@($profile.protectedBindings|ForEach-Object{[pscustomobject]@{port=[int]$_.port;address=[string]$_.address;pid=[int]$_.pid}}|Sort-Object port,address,pid)
  Need (($current|ConvertTo-Json -Compress) -ceq ($expected|ConvertTo-Json -Compress)) 'SHARED_BINDINGS_CHANGED'
  foreach($port in $sharedPorts){Need (@($expected|Where-Object{$_.port -eq $port}).Count -gt 0) 'SHARED_BINDING_BASELINE_INCOMPLETE'}
  foreach($binding in $expected){Need ($binding.port -in $allProtectedPorts -and @($profile.protectedProcesses|Where-Object{$_.pid -eq $binding.pid}).Count -eq 1) 'SHARED_BINDING_OWNER_PIN'}
  Need (@($profile.protectedProcesses|Where-Object{$_.name -ceq 'sqlservr.exe'}).Count -ge 1) 'SQL_PROTECTED_BASELINE'
  $sharedNames=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')
  Need (@($profile.protectedTasks).Count -eq 2 -and (@($profile.protectedTasks|ForEach-Object{$_.name}|Sort-Object)-join '|') -ceq (($sharedNames|Sort-Object)-join '|')) 'SHARED_TASK_BASELINE'
  $runs=$schedule.GetRunningTasks(1)
  foreach($pinned in $profile.protectedTasks){
   $task=$folder.GetTask($pinned.name);Need ([int]$task.State -eq 4 -and $pinned.state -eq 4 -and (XmlHash ([string]$task.Xml)) -ceq $pinned.xmlSha256) 'SHARED_TASK_CHANGED'
   $matches=@();for($i=1;$i -le $runs.Count;$i++){$r=$runs.Item($i);if($r.Name -ceq $pinned.name){$matches+=,$r}}
   Need ($matches.Count -eq 1 -and [string]$matches[0].InstanceGuid -ceq $pinned.instanceGuid -and [int]$matches[0].EnginePID -eq $pinned.enginePid -and @($profile.protectedProcesses|Where-Object{$_.pid -eq $pinned.enginePid}).Count -eq 1) 'SHARED_COM_INSTANCE_CHANGED'
  }
 }
}
function RehearsalRolePorts([string]$role){
 switch -CaseSensitive ($role){'erpNative'{4286};'erpApi'{4284};'crmNativeOrder'{62714};'crmCatalog'{62712};'crmOrders'{62713};'crmServer'{62710;62711};'hub'{5334};'coreSupervisor'{};'terminalWatcher'{};'hubWatcher'{};default{throw 'P03_PHYSICAL_REHEARSAL_PORT_ROLE'}}
}
function RehearsalBindings([string]$role,$process,$inventory){
 if(-not $isRehearsal){return}
 $expectedPorts=@(RehearsalRolePorts $role)
 Need (@($process.bindings).Count -eq $expectedPorts.Count) 'REHEARSAL_DECLARED_BINDING_COUNT'
 foreach($binding in $process.bindings){Need ($binding.address -ceq '127.0.0.1' -and $binding.port -in $expectedPorts) 'REHEARSAL_DECLARED_BINDING'}
 $actual=@($inventory.allListeners|Where-Object{$_.OwningProcess -eq $process.pid})
 Need ($actual.Count -eq $expectedPorts.Count) 'REHEARSAL_ACTUAL_BINDING_COUNT'
 foreach($port in $expectedPorts){Need (@($actual|Where-Object{$_.LocalPort -eq $port -and $_.LocalAddress -ceq '127.0.0.1'}).Count -eq 1) 'REHEARSAL_ACTUAL_BINDING'}
}
function PackageManifestSource($manifest,$pkg){
 $isCrm=(-not $isRehearsal -and ($pkg.root -ceq $oldSettings.components.crm.packageRoot -or $pkg.root -ceq $newSettings.components.crm.packageRoot))
 if($isCrm){
  Need ($manifest.PSObject.Properties.Name -ccontains 'schemaVersion' -and $manifest.schemaVersion -eq 1 -and $manifest.kind -ceq 'melisa-crm-test-package' -and $manifest.environment -ceq 'TEST' -and $manifest.source.repository -ceq 'https://github.com/melihsnyldzz-ui/melisa-crm.git' -and $manifest.source.commit -cmatch '\A[a-f0-9]{40}\z' -and -not ($manifest.PSObject.Properties.Name -ccontains 'sourceCommit')) 'CRM_MANIFEST_SCHEMA'
  return [string]$manifest.source.commit
 }
 Need ($manifest.PSObject.Properties.Name -ccontains 'sourceCommit') 'MANIFEST_SOURCE_SCHEMA'
 return [string]$manifest.sourceCommit
}
function RehearsalTaskAction([string]$xml,[string]$generation,[string]$name){
 if(-not $isRehearsal){return}
 try{
 Need ($xml -notmatch '<!DOCTYPE|<!ENTITY') 'REHEARSAL_XML_ENTITY'
 try{[xml]$doc=$xml}catch{throw 'P03_PHYSICAL_REHEARSAL_TASK_XML'}
 function XmlValue([string]$xpath,[string]$default,[bool]$required=$false){
  $nodes=$doc.SelectNodes($xpath);Need ($nodes.Count -le 1 -and (-not $required -or $nodes.Count -eq 1)) 'REHEARSAL_TASK_XML_SHAPE'
  if($nodes.Count -eq 0){return $default};return [string]$nodes[0].InnerText
 }
 $principal="/*[local-name()='Task']/*[local-name()='Principals']/*[local-name()='Principal']"
 $settings="/*[local-name()='Task']/*[local-name()='Settings']"
 $exec="/*[local-name()='Task']/*[local-name()='Actions']/*[local-name()='Exec']"
 $component=if($generation -ceq 'old'){$oldSettings.supervisor}else{$newSettings.supervisor};$ref=if($generation -ceq 'old'){$profile.oldSettings}else{$profile.newSettings}
 $leaf=if($name -ceq $names[0]){'p03-rehearsal-watch-core.ps1'}else{'p03-rehearsal-watch-hub.ps1'}
 $expected=@('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',(Join-Path $component.packageRoot $leaf),'-StartupConfigPath',$ref.path,'-StartupConfigSha256',$ref.sha256)
 Need ($name -cin $names -and $doc.SelectNodes("/*[local-name()='Task']/*[local-name()='Actions']/*").Count -eq 1 -and (XmlValue ($principal+"/*[local-name()='UserId']") '' $true) -ceq $owner -and (XmlValue ($exec+"/*[local-name()='Command']") '' $true) -ceq $expected[0] -and (XmlValue ($exec+"/*[local-name()='WorkingDirectory']") '' $true) -ceq $component.packageRoot) 'REHEARSAL_TASK_ACTION'
 Need ($doc.SelectNodes("/*[local-name()='Task']/*[local-name()='Principals']/*[local-name()='Principal']").Count -eq 1 -and (XmlValue ($principal+"/*[local-name()='LogonType']") '' $true) -ceq 'InteractiveToken' -and ((XmlValue ($principal+"/*[local-name()='RunLevel']") 'LeastPrivilege') -ceq 'LeastPrivilege') -and $doc.SelectNodes("/*[local-name()='Task']/*[local-name()='Triggers']/*").Count -eq 0 -and $doc.SelectNodes("/*[local-name()='Task']/*[local-name()='Settings']/*[local-name()='RestartOnFailure']").Count -eq 0 -and (XmlValue ($settings+"/*[local-name()='MultipleInstancesPolicy']") 'IgnoreNew') -ceq 'IgnoreNew' -and (XmlValue ($settings+"/*[local-name()='Enabled']") 'true') -ceq 'true') 'REHEARSAL_TASK_PRINCIPAL_SETTINGS'
 Need (((Tokens ('"'+(XmlValue ($exec+"/*[local-name()='Command']") '' $true)+'" '+(XmlValue ($exec+"/*[local-name()='Arguments']") '' $true)))|ConvertTo-Json -Compress) -ceq ($expected|ConvertTo-Json -Compress)) 'REHEARSAL_TASK_ARGV'
 Need ($profile.shell.path -ceq $expected[0]) 'REHEARSAL_TASK_SHELL';NoReparse $profile.shell.path;Need ((Get-FileHash -LiteralPath $profile.shell.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $profile.shell.sha256) 'REHEARSAL_TASK_SHELL_HASH'
 }catch{if($_.Exception.Message -cmatch '^P03_PHYSICAL_'){throw};throw 'P03_PHYSICAL_REHEARSAL_TASK_XML_SHAPE'}
}
function VerifyRehearsalClone{
 if(-not $isRehearsal){return}
 $originalProof='C:\Sirket\ERP\backups\P03-20261018-121000\isolated-restore-v4\restore-rehearsal-verified.json'
 $originalSha='e820511b06f64c21b0fe9c0a1338af355f0e440bdfe0459136cdb14cfe2f5353'
 Need ($profile.cloneProof.path -ceq (Join-Path $runRoot 'clone-proof.json') -and $profile.cloneProof.sha256 -ceq $originalSha) 'CLONE_PROOF_PATH'
 # This immutable backup evidence has a SQL-service ACE. It is an artifact,
 # not a private profile. Verify its fixed bytes without changing its ACL.
 NoReparse $originalProof
 $proofStream=[IO.File]::Open($originalProof,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
 try{Need ($proofStream.Length -gt 100 -and $proofStream.Length -le 65536) 'CLONE_PROOF_SIZE';$memory=[IO.MemoryStream]::new();$proofStream.CopyTo($memory);Need ((Hash $memory.ToArray()) -ceq $originalSha) 'CLONE_ORIGINAL_HASH'}finally{$proofStream.Dispose()}
 $proof=Json (ReadPinned $profile.cloneProof.path $profile.cloneProof.sha256)
 Need ($proof.restored -ceq $true -and $proof.readOnly -ceq $true -and $proof.dbccCheckdbPassed -ceq $true -and $proof.cloneDatabase -ceq $database -and $proof.sourceDatabase -ceq 'MELISA_ERP_CRM_SHARED_TEST_20261009_02') 'CLONE_RESTORE_PROOF'
 $connection=[Data.SqlClient.SqlConnection]::new('Server=Semih\MELISADEV;Database=MELISA_ERP_P03_RESTORE_TEST_20261018_01;Integrated Security=True;Connect Timeout=5;Application Name=MelisaP03RecoveryRehearsalReadOnly')
 try{
  $connection.Open();$cmd=$connection.CreateCommand();$cmd.CommandTimeout=5
  $cmd.CommandText="SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)),DB_NAME(),is_read_only,state_desc FROM sys.databases WHERE database_id=DB_ID()"
  $reader=$cmd.ExecuteReader()
  try{Need ($reader.Read() -and $reader.GetString(0) -ceq 'Semih\MELISADEV' -and $reader.GetString(1) -ceq $database -and $reader.GetBoolean(2) -ceq $true -and $reader.GetString(3) -ceq 'ONLINE') 'CLONE_PHYSICAL_IDENTITY';Need (-not $reader.Read()) 'CLONE_IDENTITY_COUNT'}finally{$reader.Dispose();$cmd.Dispose()}
 }finally{$connection.Dispose()}
}
function AssertTasks([int]$state){
 foreach($entry in $profile.tasks){$task=$folder.GetTask($entry.name);Need ([int]$task.State -eq $state -and (XmlHash ([string]$task.Xml)) -ceq $entry.oldXmlSha256) 'OLD_TASK_DRIFT';RehearsalTaskAction ([string]$task.Xml) 'old' $entry.name}
}
function AssertEmpty($inventory){
 [void](AssertOldPidLifetimes $inventory)
 Need ($inventory.instances.Count -eq 0 -and $inventory.listeners.Count -eq 0) 'NOT_EMPTY'
 $roots=@($profile.packages|ForEach-Object{[string]$_.root})
 foreach($p in $inventory.all){
  foreach($root in $roots){Need ([string]$p.CommandLine -notlike ('*'+$root+'*')) 'PACKAGE_PROCESS_STILL_RUNNING'}
  Need (-not (IsWatcherCommand ([string]$p.CommandLine))) 'WATCHER_STILL_RUNNING'
 }
 ProtectedProcesses $inventory
}
function Field($value,[string]$path){foreach($part in $path.Split('.')){$value=$value.$part};return $value}
function IsWatcherCommand([string]$value){
 if($isRehearsal){return $value -match '(?i)p03-rehearsal-watch-(?:core|hub)\.ps1'}
 return $value -match '(?i)watch-terminal-completion-logon\.ps1|watch-hub-after-erp\.ps1'
}
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
 if($isRehearsal){
  $map=@{erpNative='erpApiNative';erpApi='erpApiNative';crmNativeOrder='nativeOrder';crmCatalog='crm';crmOrders='crm';crmServer='crm';hub='hub'}
  if($map.ContainsKey($rule.role)){$component=$newSettings.components.($map[$rule.role]);$config=$component.config}else{$component=$newSettings.supervisor;$config=$component.config}
  if($rule.role -cin @('terminalWatcher','hubWatcher')){
   $config=$profile.newSettings;$leaf=if($rule.role -ceq 'terminalWatcher'){'p03-rehearsal-watch-core.ps1'}else{'p03-rehearsal-watch-hub.ps1'}
   $taskName=if($rule.role -ceq 'terminalWatcher'){$names[0]}else{$names[1]};Need ($rule.taskName -ceq $taskName) 'RULE_TASK_NAME'
   $expected=@('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','RemoteSigned','-File',(Join-Path $component.packageRoot $leaf),'-StartupConfigPath',$config.path,'-StartupConfigSha256',$config.sha256)
   $exe=$profile.shell;Need ($exe.path -ceq $expected[0]) 'RULE_SHELL_PATH'
  }else{
   Need ($rule.role -cin @('hub','coreSupervisor','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer')) 'RULE_ROLE'
   $expected=@($newSettings.node.path,'--no-maglev',(Join-Path $component.packageRoot 'p03-rehearsal-fixture.mjs'),'--role',$rule.role,'--config',$config.path,'--generation','new');$exe=$newSettings.node
  }
  Need ($rule.packageRoot -ceq $component.packageRoot -and $rule.sourceCommit -ceq $component.sourceCommit -and $rule.config.path -ceq $config.path -and $rule.config.sha256 -ceq $config.sha256 -and $rule.nodePath -ceq $expected[0]) 'RULE_SOURCE_BINDING'
  Need (((Tokens $rule.commandLine)|ConvertTo-Json -Compress) -ceq ($expected|ConvertTo-Json -Compress)) 'RULE_ARGV_SOURCE'
  NoReparse $exe.path;Need ((Get-FileHash -LiteralPath $exe.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $exe.sha256) 'RULE_EXECUTABLE_HASH'
  return
 }
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
function FailureDiagnostic($failure){
 $known=@('System.Management.Automation.PropertyNotFoundException','System.Management.Automation.RuntimeException','System.Management.Automation.MethodInvocationException','System.Management.Automation.ParameterBindingException','System.InvalidOperationException','System.UnauthorizedAccessException','System.IO.IOException','Microsoft.Management.Infrastructure.CimException')
 $type=$failure.Exception.GetType().FullName;if($type -cnotin $known){$type='OtherException'}
 $line=[int]$failure.InvocationInfo.ScriptLineNumber;if($line -lt 1 -or $line -gt 10000){$line=0}
 $code=if($failure.Exception.Message -cmatch '\AP03_PHYSICAL_[A-Z0-9_]{1,80}\z'){$failure.Exception.Message}else{'P03_PHYSICAL_UNCLASSIFIED'}
# P03_FAILURE_RECORD_BEGIN
 $recordSha=$failure.Exception.Data['P03OldPidFailureRecordSha256']
 if([string]$recordSha -cmatch '\A[a-f0-9]{64}\z'){return [ordered]@{exceptionType=$type;sourceLine=$line;code=$code;oldPidFailureRecordSha256=[string]$recordSha}}
# P03_FAILURE_RECORD_END
 return [ordered]@{exceptionType=$type;sourceLine=$line;code=$code}
}
function Append([string]$event,$extra=$null,$failure=$null){
 $events=@(Get-ChildItem -LiteralPath $profile.journalDirectory -File|Where-Object{$_.Name -cmatch '\Aevent-[0-9]{4}\.json\z'})
 Need ($events.Count -eq $script:sequence) 'EVENT_CAS_COUNT'
 if($script:sequence -gt 0){[void](ReadPinned (Join-Path $profile.journalDirectory ('event-'+($script:sequence-1).ToString('0000')+'.json')) $script:previous)}else{Need ($script:previous -ceq $BeforeImageSha256) 'EVENT_INITIAL_TAIL'}
 $record=[ordered]@{sequence=$script:sequence;previousSha256=$script:previous;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;event=$event;observedAt=[DateTime]::UtcNow.ToString('o')}
 if($null -ne $extra){$record['pid']=[int]$extra}
 if($null -ne $failure){$record['failure']=FailureDiagnostic $failure}
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
  RehearsalTaskAction ([string]$task.Xml) $kind $entry.name
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
function ConsoleAuxiliaries($inventory,$selected){
 if(-not (Get-Variable consolePins -Scope Script -ErrorAction SilentlyContinue)){$script:consolePins=@{}}
 $allowed=@();$binary='C:\Windows\System32\conhost.exe'
 foreach($p in $inventory.all){
  $parents=@($selected|Where-Object{$_.pid -eq $p.ParentProcessId})
  $known=$script:consolePins.ContainsKey([int]$p.ProcessId)
  if(-not $known -and ($parents.Count -ne 1 -or $p.Name -ine 'conhost.exe')){continue}
  Need ($parents.Count -eq 1 -or ($known -and $script:tasksStopRequested)) 'CONSOLE_PARENT'
  if($known){Need (Identity $p $script:consolePins[[int]$p.ProcessId]) 'CONSOLE_CHANGED'}else{
   Need (-not $script:tasksStopRequested) 'CONSOLE_NEW_AFTER_STOP'
   $parent=$parents[0];$actualParent=@($inventory.all|Where-Object{$_.ProcessId -eq $parent.pid})
   Need ($actualParent.Count -eq 1 -and (Identity $actualParent[0] $parent)) 'CONSOLE_PARENT_IDENTITY'
   Need ($p.ExecutablePath -ieq $binary -and $p.CommandLine -ieq '\??\C:\WINDOWS\system32\conhost.exe 0x4' -and $p.CreationDate.ToUniversalTime() -ge [DateTime]::Parse($parent.creationTime).ToUniversalTime()) 'CONSOLE_SOURCE'
   NoReparse $binary;Need ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant() -ceq 'c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac') 'CONSOLE_BINARY'
   $signature=Get-AuthenticodeSignature -LiteralPath $binary;Need ($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -ceq 'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US') 'CONSOLE_SIGNATURE'
   $pin=[pscustomobject]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=$binary;ownerSid=$parent.ownerSid;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o')}
   Need (Identity $p $pin) 'CONSOLE_OWNER';$script:consolePins[[int]$p.ProcessId]=$pin
  }
  Need (@($inventory.allListeners|Where-Object{$_.OwningProcess -eq $p.ProcessId}).Count -eq 0) 'CONSOLE_LISTENER'
  $allowed+=,[int]$p.ProcessId
 }
 return $allowed
}
function WaitConsoleAbsence{
 $until=[DateTime]::UtcNow.AddSeconds(15)
 do{$current=Inventory;foreach($p in $current.all){Need (-not ($p.ParentProcessId -in $script:capturedCandidatePids -or $script:consolePins.ContainsKey([int]$p.ParentProcessId)) -or $script:consolePins.ContainsKey([int]$p.ProcessId)) 'CONSOLE_UNKNOWN_DESCENDANT'};$live=@($current.all|Where-Object{$script:consolePins.ContainsKey([int]$_.ProcessId)});foreach($p in $live){try{Need (Identity $p $script:consolePins[[int]$p.ProcessId]) 'CONSOLE_PID_REUSED'}catch{if($_.Exception.Message -cne 'P03_PHYSICAL_KNOWN_EXIT_RECAPTURE'){throw}}};if($live.Count -eq 0){return};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow -lt $until)
 Need $false 'CONSOLE_NOT_ABSENT'
}
function CandidateParentSnapshot($snapshot,[int]$parentPid){
 if(@($snapshot).Count -ne 1){return @($snapshot)}
 try{$sid=Invoke-CimMethod -InputObject $snapshot[0] -MethodName GetOwnerSid -ErrorAction Stop;return [pscustomobject]@{process=$snapshot[0];sid=$sid}}catch{
  if(-not $script:tasksStopRequested -or -not $script:parentPins.ContainsKey($parentPid)){throw}
  Need ($snapshot[0].CreationDate.ToUniversalTime().Ticks -eq $script:parentPins[$parentPid].Ticks) 'CANDIDATE_PARENT_REUSED'
  $fresh=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+$parentPid) -ErrorAction Stop)
  Need ($fresh.Count -eq 0) 'CANDIDATE_PARENT_EXIT_RACE_UNPROVEN'
  return @()
 }
}
function CandidateInventory($evidence){
 for($recapture=0;$recapture -lt 3;$recapture++){
  try{return CandidateInventoryCore $evidence}catch{if($_.Exception.Message -cne 'P03_PHYSICAL_KNOWN_EXIT_RECAPTURE'){throw};if($recapture -eq 2){throw 'P03_PHYSICAL_EXIT_RECAPTURE_EXHAUSTED'}}
 }
}
function CandidateInventoryCore($evidence){
 $script:capturedCandidatePids=@($evidence.processes|ForEach-Object{[int]$_.pid})
 $inventory=Inventory;ProtectedProcesses $inventory
 Need (@($profile.oldWatchers).Count -eq 2) 'OLD_WATCHER_PINS'
 $oldPids=@($before.identities.PSObject.Properties|ForEach-Object{[int]$_.Value.pid})+@($profile.oldWatchers|ForEach-Object{[int]$_.pid})
 foreach($instance in $inventory.instances){$oldPids+=@($before.tasks|Where-Object{$_.name -ceq $instance.Name}|ForEach-Object{if($_.PSObject.Properties.Name -contains 'enginePid'){[int]$_.enginePid}})}
 Need (@($evidence.processes|ForEach-Object{$_.role}|Sort-Object -Unique).Count -eq @($evidence.processes).Count -and @($evidence.processes|ForEach-Object{$_.pid}|Sort-Object -Unique).Count -eq @($evidence.processes).Count) 'CANDIDATE_DUPLICATE'
 $unrelatedOldPids=@(AssertOldPidLifetimes $inventory)
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
  $relevant=($p.ProcessId -in $oldPids -and $p.ProcessId -notin $unrelatedOldPids) -or $p.ProcessId -in @($inventory.instances|ForEach-Object{$_.EnginePID}) -or (IsWatcherCommand ([string]$p.CommandLine))
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
function Health($expectedOwners,[ValidateSet('old','new')][string]$generation='old'){
 $healthRows=if($generation -ceq 'new'){$profile.candidateHealth}else{$profile.health}
 foreach($item in $healthRows){
  $urlPattern=if($isRehearsal){'\Ahttp://127\.0\.0\.1:(4284|4286|5334|62710|62711|62712|62713|62714)/test-health\z'}else{'\Ahttp://127\.0\.0\.1:(4184|4186|5234|62700|62701|62702|62703|62704)/'}
  Need ($item.url -cmatch $urlPattern) 'HEALTH_URL'
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
  if($generation -ceq 'new' -or $isRehearsal){
   $settings=if($generation -ceq 'new'){$newSettings}else{$oldSettings}
   $component=if($uri.Port -in @(4184,4186,4284,4286)){$settings.components.erpApiNative}elseif($uri.Port -in @(5234,5334)){$settings.components.hub}elseif($uri.Port -in @(62704,62714)){$settings.components.nativeOrder}else{$settings.components.crm}
  }
  if($generation -ceq 'new'){Need ($item.expectedSource -ceq $component.sourceCommit -and $value.copyId -ceq $before.copyId -and $value.actualT1 -ceq $false) 'NEW_HEALTH_SOURCE'}
  if($isRehearsal){Need ($value.environment -ceq 'P03_REHEARSAL' -and $value.generation -ceq $generation -and $value.copyId -ceq 'P03-RECOVERY-REHEARSAL-20261018' -and $value.actualT1 -ceq $false -and $item.expectedSource -ceq $component.sourceCommit) 'REHEARSAL_HEALTH_GENERATION'}
 }
}
function AdmitCandidate{
 if($isRehearsal){Need ([IO.Path]::GetFullPath($CandidatePath) -ceq (Join-Path $runRoot 'candidate.json')) 'CANDIDATE_PATH'}else{Need ([IO.Path]::GetFullPath($CandidatePath) -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-candidate-[a-f0-9]{32}\.json\z') 'CANDIDATE_PATH'}
 $value=Json (ReadPinned $CandidatePath $CandidateSha256)
 Need ($value.schemaVersion -ceq 'melisa-p03-physical-candidate.v1' -and $value.profileSha256 -ceq $ProfileSha256 -and $value.beforeSha256 -ceq $BeforeImageSha256 -and @($value.processes).Count -le 10) 'CANDIDATE_SCOPE'
 if($isRehearsal){Need ($value.environment -ceq 'P03_REHEARSAL') 'CANDIDATE_ENVIRONMENT'}
 # Admission freshness is evaluated at invocation entry, before the expensive
 # immutable package inventory. Every later use requires fresh physical identity.
 $age=($invokedAtUtc-[DateTime]::Parse($value.observedAt).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60) 'CANDIDATE_STALE'
 return $value
}
function NewFullOwner($evidence){
 TaskPhase 'new';$seen=CandidateInventory $evidence
 $expectedBindings=if($isRehearsal){8}else{9}
 Need ($seen.selected.Count -eq 10 -and $seen.inventory.instances.Count -eq 2 -and $seen.inventory.listeners.Count -eq $expectedBindings) 'NEW_OWNER_INCOMPLETE'
 $rolePorts=@{erpNative=@(4186);erpApi=@(4184);crmNativeOrder=@(62704);crmCatalog=@(62702);crmOrders=@(62703);crmServer=@(62700,62701);hub=@(5234);coreSupervisor=@();terminalWatcher=@();hubWatcher=@()}
 foreach($row in $seen.selected){
  if($isRehearsal){RehearsalBindings $row.role $row $seen.inventory;continue}
  $addresses=@(if($row.role -ceq 'hub'){@('127.0.0.1','192.168.1.46')}else{@('127.0.0.1')});$expectedPorts=@($rolePorts[$row.role]);$actual=@($seen.inventory.allListeners|Where-Object{$_.OwningProcess -eq $row.pid})
  Need ($actual.Count -eq $expectedPorts.Count*$addresses.Count -and @($row.bindings).Count -eq $actual.Count) 'NEW_ROLE_BINDING_COUNT'
  foreach($port in $expectedPorts){foreach($address in $addresses){Need (@($actual|Where-Object{$_.LocalPort -eq $port -and $_.LocalAddress -ceq $address}).Count -eq 1) 'NEW_ROLE_BINDING'}}
 }
 Health $seen.selected 'new'
 $stable=[ordered]@{processes=@($seen.selected|Sort-Object pid);instances=@($seen.inventory.instances|ForEach-Object{[ordered]@{name=[string]$_.Name;pid=[int]$_.EnginePID;guid=[string]$_.InstanceGuid}}|Sort-Object name)}
 return (Hash ([Text.UTF8Encoding]::new($false).GetBytes(($stable|ConvertTo-Json -Depth 12 -Compress))))
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
  RehearsalBindings $entry.Name $owners[-1] $inventory
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
if($isRehearsal){
 Need ([IO.Path]::GetFullPath($ProfilePath) -cmatch '\AC:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\profile\.json\z') 'PROFILE_PATH'
 $runRoot=[IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ProfilePath))
 Need ([IO.Path]::GetFullPath($BeforeImagePath) -ceq (Join-Path $runRoot 'before.json')) 'BEFORE_PATH'
}else{
 Need ([IO.Path]::GetFullPath($ProfilePath) -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-profile-[a-f0-9]{32}\.json\z') 'PROFILE_PATH'
 Need ([IO.Path]::GetFullPath($BeforeImagePath) -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-before-[a-f0-9]{32}\.json\z') 'BEFORE_PATH'
}
$profile=Json (ReadPinned $ProfilePath $ProfileSha256)
$before=Json (ReadPinned $BeforeImagePath $BeforeImageSha256)
Need ($profile.schemaVersion -ceq 'melisa-p03-physical-profile.v1' -and $profile.ownerSid -ceq $owner -and $profile.database -ceq $database -and $before.schemaVersion -ceq 'melisa-p03-owner-observation.v3' -and $before.ownerSid -ceq $owner -and $before.database -ceq $database -and $before.actualT1 -ceq $false) 'PROFILE_SCOPE'
if($isRehearsal){
 Need ($profile.environment -ceq 'P03_REHEARSAL' -and $before.environment -ceq 'P03_REHEARSAL' -and $before.copyId -ceq 'P03-RECOVERY-REHEARSAL-20261018' -and $profile.oldSettings.path -ceq (Join-Path $runRoot 'settings-old.json') -and $profile.newSettings.path -ceq (Join-Path $runRoot 'settings-new.json')) 'REHEARSAL_SCOPE'
}else{
 Need (($profile.PSObject.Properties.Name -cnotcontains 'environment' -or $profile.environment -ceq 'SHARED_DB02') -and ($before.PSObject.Properties.Name -cnotcontains 'environment' -or $before.environment -ceq 'SHARED_DB02')) 'SHARED_SCOPE'
}
Need ($profile.beforeImage.path -ceq $BeforeImagePath -and $profile.beforeImage.sha256 -ceq $BeforeImageSha256 -and $profile.oldSettings.sha256 -ceq $before.oldConfig.sha256 -and $profile.newSettings.sha256 -ceq $before.newConfig.sha256) 'BEFORE_REF'
$admittedCandidate=if($Mode -cin @('StopNew','PreflightNew')){AdmitCandidate}else{$null}
$packageMinimum=if($isRehearsal){2}else{3}
Need (@($profile.tasks).Count -eq 2 -and @($profile.packages).Count -ge $packageMinimum -and @($profile.health).Count -ge 2 -and @($profile.protectedProcesses).Count -ge 1) 'PROFILE_COUNT'
Need ((@($profile.tasks|ForEach-Object{$_.name}|Sort-Object)-join '|') -ceq (($names|Sort-Object)-join '|')) 'TASK_NAMES'
$oldSettings=Json (ReadPinned $profile.oldSettings.path $profile.oldSettings.sha256)
$newSettings=Json (ReadPinned $profile.newSettings.path $profile.newSettings.sha256)
foreach($settings in @($oldSettings,$newSettings)){Need ($settings.ownerSid -ceq $owner -and $settings.actualT1 -ceq $false -and $settings.database -ceq $database -and $settings.copyId -ceq $before.copyId) 'SETTINGS_SCOPE'}
if($isRehearsal){
 foreach($generation in @('old','new')){
  $settings=if($generation -ceq 'old'){$oldSettings}else{$newSettings}
  Need ($settings.environment -ceq 'P03_REHEARSAL' -and $settings.generation -ceq $generation -and $settings.runtimeDirectory -ceq $runRoot -and $settings.node.path -ceq 'C:\Sirket\ERP\tools\node-v24.19.0\node.exe') 'REHEARSAL_SETTINGS'
  NoReparse $settings.node.path;Need ((Get-FileHash -LiteralPath $settings.node.path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $settings.node.sha256) 'REHEARSAL_NODE_HASH'
  foreach($component in @($settings.components.PSObject.Properties|ForEach-Object{$_.Value})+@($settings.supervisor)){
   Need ($component.packageRoot -ceq (Join-Path $runRoot ('packages\'+$generation)) -and $component.sourceCommit -cmatch '\A[a-f0-9]{40}\z' -and $component.config.path -ceq (Join-Path $component.packageRoot 'fixture-config.json')) 'REHEARSAL_COMPONENT_ROOT'
   $config=Json (ReadPinned $component.config.path $component.config.sha256)
   Need ($config.environment -ceq 'P03_REHEARSAL' -and $config.runRoot -ceq $runRoot -and $config.generation -ceq $generation -and $config.database -ceq $database -and $config.copyId -ceq $before.copyId -and $config.sourceCommit -ceq $component.sourceCommit -and $config.packageRoot -ceq $component.packageRoot -and $config.nodePath -ceq $settings.node.path -and $config.partial -ceq ($generation -ceq 'new')) 'REHEARSAL_CONFIG_SCOPE'
  }
 }
 VerifyRehearsalClone
}
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
 if($isRehearsal){Need ([IO.Path]::GetFullPath($pkg.root) -cin @((Join-Path $runRoot 'packages\old'),(Join-Path $runRoot 'packages\new'))) 'PACKAGE_ROOT'}else{Need ([IO.Path]::GetFullPath($pkg.root) -cmatch '\AC:\\Sirket\\(?:ERP|CRM)\\releases\\[^\r\n]+\z') 'PACKAGE_ROOT'}
 $pkgRoot=[IO.Path]::GetFullPath($pkg.root)
 Need ($expectedPackages.ContainsKey($pkgRoot) -and $pkgRoot -cnotin $seenPackages -and $pkg.sourceCommit -ceq $expectedPackages[$pkgRoot].sourceCommit -and $pkg.manifestSha256 -ceq $expectedPackages[$pkgRoot].manifestSha256) 'SETTINGS_PACKAGE_BINDING'
 $seenPackages+=$pkgRoot
 NoReparse $pkg.manifestPath
 Need ([IO.Path]::GetFullPath($pkg.manifestPath) -ceq (Join-Path $pkg.root 'release-manifest.json')) 'MANIFEST_PATH'
 $manifestBytes=[IO.File]::ReadAllBytes($pkg.manifestPath);Need ((Hash $manifestBytes) -ceq $pkg.manifestSha256) 'MANIFEST_HASH';$manifest=Json $manifestBytes
 Need ((PackageManifestSource $manifest $pkg) -ceq $pkg.sourceCommit) 'MANIFEST_SOURCE'
 Need (@($manifest.files).Count -gt 0) 'MANIFEST_EMPTY'
 foreach($file in $manifest.files){
  $filePath=[IO.Path]::GetFullPath((Join-Path $pkg.root $file.path));Need ($filePath.StartsWith($pkg.root+'\',[StringComparison]::OrdinalIgnoreCase)) 'PACKAGE_ESCAPE';NoReparse $filePath
  Need ((Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $file.sha256) 'PACKAGE_CONTENT'
 }
}
[void](ReadPinned $profile.businessDigest.path $profile.businessDigest.sha256)
$expectedStopper=if($isRehearsal){Join-Path $runRoot 'stop-exact-observed-process.ps1'}else{Join-Path ([IO.Path]::GetDirectoryName($BeforeImagePath)) ([IO.Path]::GetFileName($BeforeImagePath).Replace('MelisaERP-P03-before-','MelisaERP-P03-stopper-').Replace('.json','.ps1'))}
Need ($profile.stopper.path -ceq $expectedStopper -and $profile.stopper.sha256 -ceq '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d') 'STOPPER_PIN'
[void](ReadPinned $profile.stopper.path $profile.stopper.sha256)
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
if($Mode -ceq 'PreflightOld'){
 $inventory=Inventory;ProtectedProcesses $inventory;AssertTasks 4
 foreach($p in $before.identities.PSObject.Properties){Need (Identity ($inventory.all|Where-Object{$_.ProcessId -eq $p.Value.pid}) $p.Value) 'OLD_PROCESS_DRIFT'}
 Need ($inventory.instances.Count -eq 2) 'OLD_TASK_INSTANCES';Health @($before.identities.PSObject.Properties|ForEach-Object{$_.Value})
 [ordered]@{status='OLD_PHYSICAL_PREFLIGHT';environment=$Environment;profileSha256=$ProfileSha256;beforeImageSha256=$BeforeImageSha256;applyAvailable=$false;mutationExecuted=$false}|ConvertTo-Json
 return
}
if($Mode -ceq 'PreflightNew'){
 $script:parentPins=@{};$script:watcherPins=@{};$script:tasksStopRequested=$false
 Need (@($profile.candidateRules).Count -eq 10 -and @($profile.candidateHealth).Count -ge 2) 'NEW_READBACK_PROFILE'
 [void](ReadPinned $CandidatePath $CandidateSha256)
 $stableSince=$null;$stableDigest=$null;$deadline=[DateTime]::UtcNow.AddMinutes(5);$ready=$false
 while([DateTime]::UtcNow -lt $deadline){
  $digest=NewFullOwner $admittedCandidate
  if($null -eq $stableSince -or $stableDigest -cne $digest){$stableSince=[DateTime]::UtcNow;$stableDigest=$digest}
  if(([DateTime]::UtcNow-$stableSince).TotalSeconds -ge 30 -and [DateTime]::UtcNow -lt $deadline){$ready=$true;break}
  Start-Sleep -Milliseconds 500
 }
 Need $ready 'NEW_OWNER_STABILITY_TIMEOUT';[void](ReadPinned $CandidatePath $CandidateSha256);ProtectedProcesses (Inventory);VerifyRehearsalClone
 [ordered]@{status='NEW_PHYSICAL_PREFLIGHT';environment=$Environment;profileSha256=$ProfileSha256;beforeImageSha256=$BeforeImageSha256;candidateSha256=$CandidateSha256;identityDigest=$stableDigest;stableSeconds=30;applyAvailable=$false;mutationExecuted=$false}|ConvertTo-Json
 return
}
if($Mode -ceq 'StopNew'){
 $script:parentPins=@{};$script:watcherPins=@{};$script:tasksStopRequested=$false
 $evidence=$admittedCandidate;[void](ReadPinned $CandidatePath $CandidateSha256)
 Need (@($profile.candidateRules).Count -eq 10 -and @($profile.candidateRules.role|Sort-Object -Unique).Count -eq 10) 'CANDIDATE_RULES'
 Need ((@($profile.candidateRules.role|Sort-Object)-join '|') -ceq ((@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor')|Sort-Object)-join '|')) 'CANDIDATE_ROLE_SET'
 Need ($profile.stopper.path -ceq $expectedStopper -and $profile.stopper.sha256 -ceq '79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d') 'STOPPER_PIN'
 [void](ReadPinned $profile.stopper.path $profile.stopper.sha256)
 if($isRehearsal){Need ($profile.journalDirectory -ceq (Join-Path $runRoot 'recovery')) 'JOURNAL_PATH'}else{Need ($profile.journalDirectory -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-[a-f0-9]{32}\z') 'JOURNAL_PATH'}
 Protected $profile.journalDirectory
 # Admission completes before creating any durable intent or stopping a task.
 TaskPhase 'new';$admitted=CandidateInventory $evidence
 $comPins=@()
 foreach($instance in $admitted.inventory.instances){$comPins+=,[pscustomobject]@{name=[string]$instance.Name;guid=[string]$instance.InstanceGuid;pid=[int]$instance.EnginePID}}
 $lock=[IO.File]::Open((Join-Path $profile.journalDirectory 'recovery.lock'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 $recoveryAttempted=$false
 try{
  Need (@(Get-ChildItem -LiteralPath $profile.journalDirectory -Force|Where-Object{$_.Name -cne 'recovery.lock'}).Count -eq 0) 'RECOVERY_JOURNAL_NOT_EMPTY'
  $script:sequence=0;$script:previous=$BeforeImageSha256
  [void](ReadPinned $CandidatePath $CandidateSha256);TaskPhase 'new';[void](CandidateInventory $evidence)
  $recoveryAttempted=$true;Append 'RECOVERY_INTENT'
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
  WaitConsoleAbsence
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
  VerifyRehearsalClone
  Append 'RECOVERY_COMPLETE'
  [ordered]@{status='RECOVERED_OLD_ACTIONS';environment=$Environment;profileSha256=$ProfileSha256;beforeImageSha256=$BeforeImageSha256;journalTailSha256=$script:previous;oldTasksStarted=$false}|ConvertTo-Json
 }catch{
  $originalFailure=$_
  if($recoveryAttempted){try{Append 'RECOVERY_FAILED' $null $originalFailure;Append 'QUARANTINED'}catch{}}
  throw
 }finally{$lock.Dispose()}
 return
}
# Journal is a local protected directory; every record is raw-byte hash linked.
Need ($RecoveryTailSha256 -cmatch '\A[a-f0-9]{64}\z') 'RECOVERY_TAIL'
if($isRehearsal){Need ($profile.journalDirectory -ceq (Join-Path $runRoot 'recovery')) 'JOURNAL_PATH'}else{Need ($profile.journalDirectory -cmatch '\AC:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-recovery-[a-f0-9]{32}\z') 'JOURNAL_PATH'}
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
 VerifyRehearsalClone
 Append 'RESTORED_READY'
 [ordered]@{status='RESTORED_READY';environment=$Environment;profileSha256=$ProfileSha256;beforeImageSha256=$BeforeImageSha256;journalTailSha256=$script:previous;stableSeconds=30;restoreExecuted=$false}|ConvertTo-Json
}catch{
 $originalFailure=$_
 if($rollbackAttempted){try{Append 'ROLLBACK_FAILED' $null $originalFailure;Append 'QUARANTINED'}catch{}}
 throw
}finally{$journalLock.Dispose()}
