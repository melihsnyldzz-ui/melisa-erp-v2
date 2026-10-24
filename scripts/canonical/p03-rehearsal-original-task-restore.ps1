param([ValidateSet('Inspect','Restore')][string]$Mode='Inspect')
# Source-reviewed, finite mock-task recovery. Inspect is the default. This file is
# not an authorization to execute a restore or to bypass an endpoint protection decision.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Need($ok,[string]$code){if(-not $ok){throw ('P03_ORIGINAL_'+$code)}}
function Hash([byte[]]$bytes){$h=[Security.Cryptography.SHA256]::Create();try{[BitConverter]::ToString($h.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function TextHash([string]$s){Hash ([Text.UTF8Encoding]::new($false).GetBytes($s))}
function NoReparse([string]$path){for($p=[IO.Path]::GetFullPath($path);$p;$p=[IO.Path]::GetDirectoryName($p)){Need (([IO.File]::GetAttributes($p)-band[IO.FileAttributes]::ReparsePoint)-eq0) 'REPARSE'}}
function ReadOriginalBefore {
 $path='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\FileAttributesV1-original-tasks-20261020-2208.json'
 NoReparse $path;$acl=Get-Acl -LiteralPath $path
 Need ($acl.AreAccessRulesProtected-and$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-ceq$script:owner-and@($acl.Access).Count-eq2) 'BEFORE_ACL'
 $seen=@();foreach($a in $acl.Access){$sid=$a.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;Need ($sid-cin@($script:owner,'S-1-5-18')-and$sid-cnotin$seen-and$a.AccessControlType-eq'Allow'-and-not$a.IsInherited-and$a.FileSystemRights-eq[Security.AccessControl.FileSystemRights]::FullControl) 'BEFORE_ACE';$seen+=$sid}
 $file=Get-Item -LiteralPath $path -Force;Need (-not$file.LinkType-and-not$file.Target) 'BEFORE_LINK'
 $s=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
 try{$m=[IO.MemoryStream]::new();try{Need ($s.Length-gt0-and$s.Length-le1048576) 'BEFORE_SIZE';$s.CopyTo($m);$bytes=$m.ToArray();Need ((Hash $bytes)-ceq'61f545642ee32ecb88a7a58a1f76a6f97e944d0400c5678ec2d89e0a9cbd2fe0') 'BEFORE_HASH';[Text.UTF8Encoding]::new($false,$true).GetString($bytes)|ConvertFrom-Json -ErrorAction Stop}finally{$m.Dispose()}}finally{$s.Dispose()}
}
function AssertTarget([string]$name){Need ($name-cin@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')) 'TARGET'}
function TaskMissing($exception){
 for($e=$exception;$null-ne$e;$e=$e.InnerException){if(($e-is[Runtime.InteropServices.COMException]-or$e-is[IO.FileNotFoundException])-and$e.HResult-eq-2147024894){return $true}}
 return $false
}
function FindTask($folder,[string]$name){AssertTarget $name;try{return $folder.GetTask($name)}catch{if(TaskMissing $_.Exception){return $null};throw}}
function AssertOriginalXml([string]$xml,[string]$name,[string]$sid){
 AssertTarget $name;$settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
 $r=[Xml.XmlReader]::Create([IO.StringReader]::new($xml),$settings);try{$x=[Xml.XmlDocument]::new();$x.XmlResolver=$null;$x.Load($r)}finally{$r.Dispose()}
 $n=[Xml.XmlNamespaceManager]::new($x.NameTable);$n.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
 $principals=@($x.SelectNodes('/t:Task/t:Principals/t:Principal',$n));Need ($principals.Count-eq1) 'PRINCIPAL'
 Need ($principals[0].SelectSingleNode('t:UserId',$n).InnerText-ceq$sid-and$principals[0].SelectSingleNode('t:LogonType',$n).InnerText-ceq'InteractiveToken') 'LOGON'
 $level=$principals[0].SelectSingleNode('t:RunLevel',$n);Need ($null-eq$level-or$level.InnerText-ceq'LeastPrivilege') 'RUNLEVEL'
 Need (@($x.SelectNodes('/t:Task/t:Triggers/*',$n)).Count-eq0) 'TRIGGERS'
 $actions=@($x.SelectNodes('/t:Task/t:Actions/*',$n));Need ($actions.Count-eq1-and$actions[0].LocalName-ceq'Exec') 'ACTION'
 $exec=$actions[0];Need ($exec.SelectSingleNode('t:Command',$n).InnerText-ieq'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe') 'COMMAND'
 $kind=if($name-ceq'Melisa-P03-Rehearsal-Core'){'core'}else{'hub'}
 $base='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-';$pattern='\A-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+[regex]::Escape($base)+'(?<run>[a-f0-9]{32})\\packages\\old\\p03-rehearsal-watch-'+$kind+'\.ps1" -StartupConfigPath "'+[regex]::Escape($base)+'\k<run>\\settings-old\.json" -StartupConfigSha256 [a-f0-9]{64}\z'
 $match=[regex]::Match($exec.SelectSingleNode('t:Arguments',$n).InnerText,$pattern);Need $match.Success 'ARGUMENTS'
 Need ($exec.SelectSingleNode('t:WorkingDirectory',$n).InnerText-ceq($base+$match.Groups['run'].Value+'\packages\old')) 'WORKDIR'
}
function ValidateBefore($before){
 Need ($before.owner-ceq$script:owner-and@($before.tasks).Count-eq2-and$before.mutationExecuted-eq$false) 'BEFORE_SCOPE'
 $seen=@();foreach($t in $before.tasks){AssertTarget $t.name;Need ($t.name-cnotin$seen-and[int]$t.state-eq3) 'BEFORE_TASK';$seen+=$t.name;AssertOriginalXml $t.xml $t.name $before.owner}
}
function DaclBytes($d){
 Need ($null-ne$d.DiscretionaryAcl-and$d.DiscretionaryAcl.Count-eq4) 'DACL_COUNT';$parts=@()
 foreach($a in $d.DiscretionaryAcl){Need ($a-is[Security.AccessControl.CommonAce]-and[int]$a.AceType-eq0-and-not$a.IsCallback-and$a.OpaqueLength-eq0) 'DACL_SIMPLE_ALLOW';$b=New-Object byte[] $a.BinaryLength;$a.GetBinaryForm($b,0);$parts+=,[Convert]::ToBase64String($b)}
 return ,@($parts|Sort-Object -CaseSensitive)
}
function CompareTaskSecurity([string]$original,[string]$actual){
 $old=[Security.AccessControl.RawSecurityDescriptor]::new($original);$now=[Security.AccessControl.RawSecurityDescriptor]::new($actual)
 Need ($null-ne$old.Owner-and$null-ne$old.Group-and$null-ne$now.Owner-and$null-ne$now.Group) 'SDDL_OWNER'
 if($original-ceq$actual){return 'RAW_ORIGINAL_EXACT'}
 AssertAllowEquivalent $old $now
 return 'ALLOW4_EFFECTIVE_EQUIVALENT_SACL_NOT_OBSERVED'
}
function AssertAllowEquivalent($old,$now){
 Need ($null-ne$old.Owner-and$null-ne$old.Group-and$null-ne$now.Owner-and$null-ne$now.Group) 'SDDL_OWNER'
 Need ($old.Owner.Value-ceq$now.Owner.Value-and$old.Group.Value-ceq$now.Group.Value) 'SDDL_IDENTITY'
 $left=DaclBytes $old;$right=DaclBytes $now
 Need ($old.DiscretionaryAcl.Revision-eq$now.DiscretionaryAcl.Revision-and$old.ResourceManagerControl-eq$now.ResourceManagerControl) 'SDDL_REVISION_RM'
 $xor=[int]$old.ControlFlags-bxor[int]$now.ControlFlags;Need ($xor-eq0-or$xor-eq1024) 'SDDL_FLAGS'
 Need (($left-join'|')-ceq($right-join'|')) 'SDDL_ACE_BYTES'
}
function AssertExisting($task,$expected){
 Need ($task.Enabled-and[int]$task.State-eq3-and@($task.GetInstances(0)).Count-eq0) 'TASK_NOT_READY'
 Need ((TextHash $task.Xml)-ceq(TextHash $expected.xml)) 'TASK_XML_DRIFT'
 CompareTaskSecurity $expected.sddl ($task.GetSecurityDescriptor(7))
}
function AssertQuietData($processes,$listeners,$instances,[int]$reader){
 Need (@($listeners).Count-eq0-and@($instances).Count-eq0) 'NOT_QUIET'
 $root='(?i)C:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}(?:\\|["\s]|$)'
 foreach($p in $processes){if([int]$p.ProcessId-eq$reader){continue};Need (-not([string]$p.CommandLine-match$root)-and-not([string]$p.ExecutablePath-match$root)) 'ORPHAN_OR_UNKNOWN_RUN_PROCESS'}
}
function AssertQuiet($folder){
 $instances=@();foreach($name in @('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')){$t=FindTask $folder $name;if($null-ne$t){$instances+=@($t.GetInstances(0))}}
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort-in@(4284,4286,5334,62710,62711,62712,62713,62714)})
 AssertQuietData @(Get-CimInstance Win32_Process -ErrorAction Stop) $listeners $instances $PID
}
function ProcessFrame([int]$id){
 $p=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction Stop);Need ($p.Count-eq1) 'PROTECTED_PROCESS'
 $who=Invoke-CimMethod -InputObject $p[0] -MethodName GetOwnerSid -ErrorAction Stop;Need ($who.ReturnValue-eq0-and$who.Sid) 'PROTECTED_OWNER'
 Need ($p[0].CreationDate-and$p[0].CommandLine-and$p[0].ExecutablePath) 'PROTECTED_METADATA'
 [ordered]@{pid=$id;parent=[int]$p[0].ParentProcessId;birth=$p[0].CreationDate.ToUniversalTime().ToString('o');owner=$who.Sid;image=$p[0].ExecutablePath;argvSha256=(TextHash $p[0].CommandLine)}
}
function ProtectedFrame($folder){
 $tasks=@();$ids=@();foreach($name in @('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')){
  $t=$folder.GetTask($name);$instances=@($t.GetInstances(0)|ForEach-Object{$ids+=[int]$_.EnginePID;[ordered]@{id=[string]$_.InstanceGuid;pid=[int]$_.EnginePID}}|Sort-Object{$_['id']})
  $tasks+=,[ordered]@{name=$name;xml=(TextHash $t.Xml);sddl=(TextHash ($t.GetSecurityDescriptor(7)));state=[int]$t.State;enabled=[bool]$t.Enabled;instances=$instances}
 }
 $bindings=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort-in@(4184,4186,5234,62700,62701,62702,62703,62704,4144,4146,5194)}|Sort-Object LocalPort,LocalAddress,OwningProcess|ForEach-Object{$ids+=[int]$_.OwningProcess;[ordered]@{address=$_.LocalAddress;port=[int]$_.LocalPort;pid=[int]$_.OwningProcess}})
 $svc=@(Get-CimInstance Win32_Service -Filter "Name='MSSQL`$MELISADEV'" -ErrorAction Stop);Need ($svc.Count-eq1-and$svc[0].State-ceq'Running'-and$svc[0].ProcessId-gt0) 'SQL_SERVICE'
 $sql=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$svc[0].ProcessId) -ErrorAction Stop);Need ($sql.Count-eq1-and$sql[0].CreationDate) 'SQL_PROCESS'
 $processes=@($ids|Sort-Object -Unique|ForEach-Object{ProcessFrame $_})
 $data=[ordered]@{tasks=$tasks;bindings=$bindings;processes=$processes;sql=[ordered]@{name=$svc[0].Name;state=$svc[0].State;pid=[int]$svc[0].ProcessId;account=$svc[0].StartName;path=$svc[0].PathName;processName=$sql[0].Name;birth=$sql[0].CreationDate.ToUniversalTime().ToString('o')}}
 TextHash ($data|ConvertTo-Json -Depth 12 -Compress)
}
function AssertProtected($folder,[string]$expected){Need ((ProtectedFrame $folder)-ceq$expected) 'PROTECTED_DRIFT'}
function RestoreOriginalTasks($folder,$before,[string]$mode){
 Need ($mode-cin@('Inspect','Restore')) 'MODE';ValidateBefore $before;AssertQuiet $folder;$protected=ProtectedFrame $folder;$out=@()
 foreach($expected in $before.tasks){
  AssertQuiet $folder;AssertProtected $folder $protected;$existing=FindTask $folder $expected.name
  if($null-ne$existing){$security=AssertExisting $existing $expected;$out+=,[ordered]@{name=$expected.name;status='EXISTING_VERIFIED';security=$security};continue}
  if($mode-ceq'Inspect'){$out+=,[ordered]@{name=$expected.name;status='ABSENT'};continue}
  $fresh=ReadOriginalBefore;ValidateBefore $fresh;Need ((TextHash ($fresh|ConvertTo-Json -Depth 10 -Compress))-ceq(TextHash ($before|ConvertTo-Json -Depth 10 -Compress))) 'BEFORE_CAS'
  AssertQuiet $folder;AssertProtected $folder $protected;Need ($null-eq(FindTask $folder $expected.name)) 'TASK_CREATE_RACE'
  AssertTarget $expected.name
  $null=$folder.RegisterTask($expected.name,$expected.xml,18,$script:owner,$null,3,$expected.sddl)
  $readback=FindTask $folder $expected.name;Need ($null-ne$readback) 'CREATE_READBACK';$security=AssertExisting $readback $expected
  $out+=,[ordered]@{name=$expected.name;status='CREATED_VERIFIED';security=$security}
 }
 AssertQuiet $folder;AssertProtected $folder $protected
 if($mode-ceq'Restore'){foreach($expected in $before.tasks){$t=FindTask $folder $expected.name;Need ($null-ne$t) 'FINAL_MISSING';$null=AssertExisting $t $expected}}
 [ordered]@{mode=$mode;tasks=$out;protectedFrameSha256=$protected;saclScope='NOT_OBSERVED';finalReadback=$true}
}
function Main {
 $script:owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $before=ReadOriginalBefore;ValidateBefore $before
 $service=New-Object -ComObject 'Schedule.Service';$service.Connect();$folder=$service.GetFolder('\')
 RestoreOriginalTasks $folder $before $Mode
}
try{Main|ConvertTo-Json -Depth 8 -Compress;exit 0}catch{[ordered]@{status='FAILED';code='P03_ORIGINAL_REJECTED';errorSha256=(TextHash $_.Exception.GetType().FullName);finalReadback=$false}|ConvertTo-Json -Compress;exit 1}
