param([ValidateSet('DryRun','Run')][string]$Mode='DryRun',[ValidateSet('Legacy','B264V2','FailureRecordV1')][string]$EngineGeneration='Legacy')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
trap{$kind=$_.Exception.GetType().Name;if($kind-cnotin@('MethodInvocationException','RuntimeException','UnauthorizedAccessException','IOException','ArgumentException','InvalidOperationException','PropertyNotFoundException','ParameterBindingException','PSInvalidCastException')){$kind='OtherException'};$site=$_.Exception.TargetSite;$method=if($null-ne$site){$site.Name}else{'UnknownMethod'};if($method-cnotin@('Invoke','InvokeMethod','CreateDirectory','Write','Flush','AddAccessRule','SetOwner','CheckActionPreference')){$method='UnknownMethod'};$code=if([string]$_.Exception.Message-cmatch'\bP03_[A-Z_]+\b'){$Matches[0]}else{'P03_REHEARSAL_EXECUTION_REJECTED'};$line=0;if($null-ne$_.InvocationInfo){$line=[int]$_.InvocationInfo.ScriptLineNumber};[Console]::Error.WriteLine(($code+' TYPE_'+$kind+' METHOD_'+$method+' LINE_'+$line));exit 1}
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules',$name,$name+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
$root='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018'
$node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe'
$nodeSha='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$shell='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$names=@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')
$ports=@(4284,4286,5334,62710,62711,62712,62713,62714)
$protectedPorts=@(4184,4186,5234,62700,62701,62702,62703,62704,4144,4146,5194)
$roles=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor')
$db='MELISA_ERP_P03_RESTORE_TEST_20261018_01'
$copy='P03-RECOVERY-REHEARSAL-20261018'
$stopperSource='C:\Sirket\CRM\runtime\CRM06-TEST-ACTORS-20261014\stop-exact-observed-process.ps1'
$stopperSha='79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'
function Need($v,[string]$code){if(-not$v){throw ('P03_REHEARSAL_'+$code)}}
function Hash([byte[]]$bytes){[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}
function Bytes($v){,[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+'[END]'.Replace('[END]',[Environment]::NewLine))}
function NoReparse([string]$p){for($q=$p;$q;$q=[IO.Path]::GetDirectoryName($q)){if(Test-Path -LiteralPath $q){Need (((Get-Item -LiteralPath $q -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0) 'REPARSE'}}}
function FileSecurity{
 $s=[Security.AccessControl.FileSecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$s.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))};return $s
}
function DirectoryNew([string]$p){
 NoReparse $p;Need (-not(Test-Path -LiteralPath $p)) 'DIRECTORY_EXISTS'
 $s=[Security.AccessControl.DirectorySecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$s.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 [void][IO.Directory]::CreateDirectory($p,$s)
}
function WriteNew([string]$p,[byte[]]$bytes){
 NoReparse ([IO.Path]::GetDirectoryName($p));Need (-not(Test-Path -LiteralPath $p)) 'FILE_EXISTS'
 $stream=[IO.FileStream]::new($p,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,(FileSecurity))
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 $sha=Hash $bytes;Need ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$sha) 'WRITE_READBACK';return [ordered]@{path=$p;sha256=$sha}
}
function Identity($p){
 $sid=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction Stop;Need ($sid.ReturnValue-eq0-and$p.ExecutablePath-and$p.CommandLine) 'IDENTITY_UNAVAILABLE'
 return [ordered]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=[string]$p.ExecutablePath;ownerSid=[string]$sid.Sid;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');bindings=@()}
}
function ProtectedSnapshot{
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort-in$protectedPorts}|ForEach-Object{[ordered]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress;pid=[int]$_.OwningProcess}}|Sort-Object port,address,pid)
 $ids=@($listeners|ForEach-Object{$_.pid})+@(Get-CimInstance Win32_Process -Filter "Name='sqlservr.exe'"|ForEach-Object{$_.ProcessId})
 $processes=@(foreach($id in @($ids|Sort-Object -Unique)){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$id);if($p.Name-ceq'sqlservr.exe'){
  $services=@(Get-CimInstance Win32_Service -Filter 'Name="MSSQL$MELISADEV"');Need ($services.Count-eq1-and$services[0].ProcessId-eq$p.ProcessId-and$services[0].State-ceq'Running') 'SQL_SERVICE'
  $connection=[Data.SqlClient.SqlConnection]::new('Server=Semih\MELISADEV;Database=master;Integrated Security=True;Connect Timeout=5;Application Name=P03RehearsalProtectOnly');$connection.Open();try{$cmd=$connection.CreateCommand();$cmd.CommandTimeout=5;$cmd.CommandText="SELECT CAST(SERVERPROPERTY('ProcessID') AS int),CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)),DB_NAME()";$reader=$cmd.ExecuteReader();try{Need ($reader.Read()) 'SQL_IDENTITY';$sql=[ordered]@{serverName=$reader.GetString(1);databaseName=$reader.GetString(2);processId=$reader.GetInt32(0)}}finally{$reader.Dispose()}}finally{$connection.Dispose()}
  Need ($sql.serverName-ceq'Semih\MELISADEV'-and$sql.databaseName-ceq'master'-and$sql.processId-eq$p.ProcessId) 'SQL_MASTER_IDENTITY'
  [ordered]@{kind='ProtectedSqlService';name='sqlservr.exe';pid=[int]$p.ProcessId;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');service=[ordered]@{name=$services[0].Name;processId=[int]$services[0].ProcessId;state=$services[0].State;startName=$services[0].StartName;pathName=$services[0].PathName};sql=$sql}
 }else{$value=Identity $p;$value['name']=[string]$p.Name;$value}})
 Need (@($processes|Where-Object{$_.name-ceq'sqlservr.exe'}).Count-gt0) 'SQL_PROTECTED'
 $sharedTasks=@();$sharedInstances=@();$running=$schedule.GetRunningTasks(1)
 foreach($name in @('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')){$task=$folder.GetTask($name);$sharedTasks+=,[ordered]@{name=$name;state=[int]$task.State;xml=[string]$task.Xml};for($i=1;$i-le$running.Count;$i++){$r=$running.Item($i);if($r.Name-ceq$name){$sharedInstances+=,[ordered]@{name=[string]$r.Name;path=[string]$r.Path;enginePid=[int]$r.EnginePID;instanceGuid=[string]$r.InstanceGuid;state=[int]$r.State};if([int]$r.EnginePID-notin@($processes|ForEach-Object{$_.pid})){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$r.EnginePID);$value=Identity $p;$value['name']=[string]$p.Name;$processes+=,$value}}}}
 return [ordered]@{processes=@($processes|Sort-Object pid);bindings=$listeners;sharedTasks=$sharedTasks;sharedInstances=@($sharedInstances|Sort-Object name)}
}
function Snapshot{
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop);$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort-in$ports})
 $processes=@();foreach($p in $all){if(([string]$p.CommandLine).IndexOf($runRoot,[StringComparison]::OrdinalIgnoreCase)-lt0){continue};if($p.ProcessId-eq$PID){continue};$v=Identity $p
  if([string]$p.CommandLine-match'--role ([A-Za-z]+)'){$v['role']=$Matches[1]}else{continue}
  $v.bindings=@($listeners|Where-Object{$_.OwningProcess-eq$p.ProcessId}|ForEach-Object{[ordered]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress}});$processes+=,$v
 }
 $running=$schedule.GetRunningTasks(1);$watchers=@();$taskRows=@()
 foreach($name in $names){$task=$folder.GetTask($name);$instances=@();for($i=1;$i-le$running.Count;$i++){$r=$running.Item($i);if($r.Name-ceq$name){$instances+=,$r}};Need ($instances.Count-le1) 'DUPLICATE_TASK'
  $row=[ordered]@{name=$name;state=[int]$task.State;xml=[string]$task.Xml};if($instances.Count-eq1){$row['enginePid']=[int]$instances[0].EnginePID;$row['instanceGuid']=[string]$instances[0].InstanceGuid;$p=@($all|Where-Object{$_.ProcessId-eq$instances[0].EnginePID});Need ($p.Count-eq1) 'WATCHER_MISSING';$v=Identity $p[0];$v['role']=$(if($name-ceq$names[0]){'terminalWatcher'}else{'hubWatcher'});$watchers+=,$v};$taskRows+=,$row
 }
 return [ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');processes=$processes;watchers=$watchers;tasks=$taskRows;listeners=@($listeners|ForEach-Object{[ordered]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress;pid=[int]$_.OwningProcess}})}
}
function WaitOldReady{
 $until=[DateTime]::UtcNow.AddSeconds(90)
 do{$s=Snapshot;if($s.processes.Count-eq8-and$s.watchers.Count-eq2-and$s.listeners.Count-eq8){Need (@($s.listeners|Where-Object{$_.address-cne'127.0.0.1'}).Count-eq0) 'NON_LOOPBACK';return $s};Start-Sleep -Milliseconds 500}while([DateTime]::UtcNow-lt$until)
 throw 'P03_REHEARSAL_OLD_READINESS_TIMEOUT'
}
function ActionArgs([string]$generation,[int]$index){$leaf=$(if($index-eq0){'p03-rehearsal-watch-core.ps1'}else{'p03-rehearsal-watch-hub.ps1'});return '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+[IO.Path]::Combine($runRoot,'packages',$generation,$leaf)+'" -StartupConfigPath "'+$settings[$generation].path+'" -StartupConfigSha256 '+$settings[$generation].sha256}
function Journal([string]$event){$record=[ordered]@{sequence=$script:seq;event=$event;observedAt=[DateTime]::UtcNow.ToString('o');runId=$runId};[void](WriteNew (Join-Path $runRoot ('driver-event-'+$script:seq.ToString('0000')+'.json')) (Bytes $record));$script:seq++}
function RegisterFixtureTask([int]$index,[string]$generation,[bool]$update){
 $definition=$schedule.NewTask(0);$definition.RegistrationInfo.Description='P03 isolated SQL-free OS recovery rehearsal';$definition.Principal.UserId=$owner;$definition.Principal.LogonType=3;$definition.Principal.RunLevel=0;$definition.Settings.Enabled=$true;$definition.Settings.ExecutionTimeLimit='PT0S';$definition.Settings.MultipleInstances=2
 $action=$definition.Actions.Create(0);$action.Path=$shell;$action.Arguments=ActionArgs $generation $index;$action.WorkingDirectory=Join-Path (Join-Path $runRoot 'packages') $generation
 if($update){$existing=$folder.GetTask($names[$index]);Need ([int]$existing.State-eq3-and(Hash ([Text.Encoding]::UTF8.GetBytes([string]$existing.Xml)))-ceq$profile.tasks[$index].oldXmlSha256) 'TASK_CAS'}
 [void]$folder.RegisterTaskDefinition($names[$index],$definition,$(if($update){4}else{2}),$owner,$null,3,$null)
}
Need ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-ceq$owner) 'OWNER'
$request=[Console]::In.ReadToEnd()|ConvertFrom-Json;Need ($request.mode-ceq$Mode-and@($request.files).Count-eq3) 'REQUEST'
Need ((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$nodeSha) 'NODE_PIN'
Need (@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort-in$ports}).Count-eq0) 'PORT_ALREADY_USED'
$schedule=New-Object -ComObject Schedule.Service;$schedule.Connect();$folder=$schedule.GetFolder('\')
foreach($name in $names){$exists=$null;try{$exists=$folder.GetTask($name)}catch{};Need ($null-eq$exists) 'TASK_ALREADY_EXISTS'}
function AssertRehearsalEngineRequest($value,[string]$generation){
 if($generation -ceq 'B264V2'){
  Need ($value.PSObject.Properties.Name -ccontains 'engineGeneration' -and $value.engineGeneration -ceq 'B264V2') 'V2_ENGINE_GENERATION'
  Need ((@($value.engine.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'path|sha256') 'V2_ENGINE_FIELDS'
  Need ($value.engine.path -ceq 'C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-recovery-control-eb5b37a555cb\p03-physical-rollback.ps1' -and $value.engine.sha256 -ceq '99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def') 'V2_ENGINE_SCOPE'
 }elseif($generation -ceq 'FailureRecordV1'){
  Need ($value.PSObject.Properties.Name -ccontains 'engineGeneration' -and $value.engineGeneration -ceq 'FailureRecordV1') 'FAILURE_RECORD_ENGINE_GENERATION'
  Need ((@($value.engine.PSObject.Properties.Name|Sort-Object)-join '|') -ceq 'path|sha256') 'FAILURE_RECORD_ENGINE_FIELDS'
  Need ($value.engine.path -ceq 'C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\engine-candidate-1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054.ps1' -and $value.engine.sha256 -ceq '1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054') 'FAILURE_RECORD_ENGINE_SCOPE'
 }else{
  Need ($generation -ceq 'Legacy' -and $value.PSObject.Properties.Name -cnotcontains 'engineGeneration') 'ENGINE_GENERATION'
  Need ($value.engine.path.EndsWith('\scripts\canonical\p03-physical-rollback.ps1',[StringComparison]::OrdinalIgnoreCase)) 'ENGINE_PIN'
 }
}
AssertRehearsalEngineRequest $request $EngineGeneration
if($EngineGeneration -ceq 'FailureRecordV1'){Need ($args.Count -eq 0) 'FAILURE_RECORD_PARAMETERS'}
NoReparse $request.engine.path
Need ((Get-FileHash -LiteralPath $request.engine.path -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$request.engine.sha256) 'ENGINE_PIN'

$protectedBefore=ProtectedSnapshot;$protectedBeforeSha=Hash (Bytes $protectedBefore)
if($Mode-ceq'DryRun'){$dry=[ordered]@{status='DRY_RUN_READY';ports=$ports;tasks=$names;protectedBeforeSha256=$protectedBeforeSha;sqlFreeFixture=$true;runtimeMutation=$false};if($EngineGeneration -cin @('B264V2','FailureRecordV1')){$dry['engineGeneration']=$EngineGeneration;$dry['engineSha256']=$request.engine.sha256};$dry|ConvertTo-Json -Depth 5;return}
Need ($request.PSObject.Properties.Name-contains'cloneProof') 'CLONE_PROOF_REQUIRED'
Need ((Get-FileHash -LiteralPath $request.cloneProof.path -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$request.cloneProof.sha256) 'CLONE_PROOF_HASH'
NoReparse $root;if(-not(Test-Path -LiteralPath 'C:\Sirket\ERP\rehearsal')){DirectoryNew 'C:\Sirket\ERP\rehearsal'}
if(-not(Test-Path -LiteralPath $root)){DirectoryNew $root}
$runId=[guid]::NewGuid().ToString('N');$runRoot=Join-Path $root ('run-'+$runId);DirectoryNew $runRoot;$script:seq=0
foreach($leaf in @('packages','packages\old','packages\new','receipts-old','receipts-new','recovery')){DirectoryNew (Join-Path $runRoot $leaf)}
$engineRef=WriteNew (Join-Path $runRoot 'recovery-engine.ps1') ([IO.File]::ReadAllBytes($request.engine.path));Need ($engineRef.sha256-ceq$request.engine.sha256) 'ENGINE_COPY_HASH'
NoReparse $stopperSource;$stopperBytes=[IO.File]::ReadAllBytes($stopperSource);Need ((Hash $stopperBytes)-ceq$stopperSha) 'STOPPER_SOURCE_HASH';$stopperRef=WriteNew (Join-Path $runRoot 'stop-exact-observed-process.ps1') $stopperBytes;Need ($stopperRef.sha256-ceq$stopperSha) 'STOPPER_COPY_HASH';$stopper=$stopperRef.path
$cloneProof=WriteNew (Join-Path $runRoot 'clone-proof.json') ([IO.File]::ReadAllBytes($request.cloneProof.path));Need ($cloneProof.sha256-ceq$request.cloneProof.sha256) 'CLONE_PROOF_COPY'
$settings=@{};$packagePins=@();$fixtureSource=([string]($request.files|Where-Object{$_.name-ceq'p03-rehearsal-fixture.mjs'}).sha256).Substring(0,40)
foreach($generation in @('old','new')){
 $packageRoot=Join-Path (Join-Path $runRoot 'packages') $generation;$manifestFiles=@()
 foreach($file in $request.files){Need ($file.name-cin@('p03-rehearsal-fixture.mjs','p03-rehearsal-watch-core.ps1','p03-rehearsal-watch-hub.ps1')) 'SOURCE_NAME';$bytes=[Convert]::FromBase64String($file.bytesBase64);Need ((Hash $bytes)-ceq$file.sha256) 'SOURCE_HASH';[void](WriteNew (Join-Path $packageRoot $file.name) $bytes);$manifestFiles+=,[ordered]@{path=$file.name;sha256=$file.sha256}}
 $cfg=[ordered]@{environment='P03_REHEARSAL';runRoot=$runRoot;generation=$generation;database=$db;copyId=$copy;sourceCommit=$fixtureSource;partial=($generation-ceq'new');packageRoot=$packageRoot;nodePath=$node;actualT1=$false;runUuid=[guid]::NewGuid().ToString()}
 $cfgRef=WriteNew (Join-Path $packageRoot 'fixture-config.json') (Bytes $cfg);$manifestFiles+=,[ordered]@{path='fixture-config.json';sha256=$cfgRef.sha256}
 $manifest=[ordered]@{sourceCommit=$fixtureSource;environment='P03_REHEARSAL';files=$manifestFiles};$manifestRef=WriteNew (Join-Path $packageRoot 'release-manifest.json') (Bytes $manifest)
 $component=[ordered]@{packageRoot=$packageRoot;sourceCommit=$fixtureSource;manifestSha256=$manifestRef.sha256;config=$cfgRef}
 $value=[ordered]@{schemaVersion=1;environment='P03_REHEARSAL';generation=$generation;runtimeDirectory=$runRoot;ownerSid=$owner;database=$db;copyId=$copy;actualT1=$false;node=[ordered]@{path=$node;sha256=$nodeSha};components=[ordered]@{erpApiNative=$component;nativeOrder=$component;crm=$component;hub=$component};supervisor=$component}
 $settings[$generation]=WriteNew (Join-Path $runRoot ('settings-'+$generation+'.json')) (Bytes $value);$packagePins+=,[ordered]@{root=$packageRoot;sourceCommit=$fixtureSource;manifestPath=$manifestRef.path;manifestSha256=$manifestRef.sha256}
}
Journal 'REGISTER_OLD_TASKS_INTENT';RegisterFixtureTask 0 'old' $false;RegisterFixtureTask 1 'old' $false;Journal 'START_OLD_INTENT';[void]$folder.GetTask($names[0]).Run($null);[void]$folder.GetTask($names[1]).Run($null)
$old=WaitOldReady;$identities=[ordered]@{};foreach($role in $roles){$rows=@($old.processes|Where-Object{$_.role-ceq$role});Need ($rows.Count-eq1) 'OLD_ROLE_COUNT';$identities[$role]=$rows[0]}
$before=[ordered]@{schemaVersion='melisa-p03-owner-observation.v3';environment='P03_REHEARSAL';ownerSid=$owner;database=$db;copyId=$copy;actualT1=$false;observedAt=$old.observedAt;oldConfig=$settings.old;newConfig=$settings.new;tasks=$old.tasks;identities=$identities;oldSupervisor=[ordered]@{root=$packagePins[0].root;manifest=$packagePins[0].manifestSha256};profile=[ordered]@{erpSource=$fixtureSource;crmSource=$fixtureSource;supervisorSource=$fixtureSource;erpManifest=$packagePins[1].manifestSha256;crmManifest=$packagePins[1].manifestSha256;supervisorManifest=$packagePins[1].manifestSha256}}
$beforeRef=WriteNew (Join-Path $runRoot 'before.json') (Bytes $before)
$taskPins=@();foreach($index in 0,1){$xml=[string]$old.tasks[$index].xml;$argument=(ActionArgs 'new' $index).Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;');$working=(Join-Path (Join-Path $runRoot 'packages') 'new').Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;');$newText=[regex]::Replace($xml,'<Arguments>[\s\S]*?</Arguments>',('<Arguments>'+$argument+'</Arguments>'));$newText=[regex]::Replace($newText,'<WorkingDirectory>[\s\S]*?</WorkingDirectory>',('<WorkingDirectory>'+$working+'</WorkingDirectory>'));$taskPins+=,[ordered]@{name=$names[$index];oldXml=$xml;oldXmlSha256=(Hash ([Text.Encoding]::UTF8.GetBytes($xml)));newXml=$newText;newXmlSha256=(Hash ([Text.Encoding]::UTF8.GetBytes($newText)))}}
$newSettings=Get-Content -LiteralPath $settings.new.path -Raw|ConvertFrom-Json;$rules=@();$newPackage=$newSettings.supervisor.packageRoot
foreach($role in $roles){$rules+=,[ordered]@{role=$role;nodePath=$node;commandLine=('"'+$node+'" --no-maglev "'+(Join-Path $newPackage 'p03-rehearsal-fixture.mjs')+'" --role '+$role+' --config "'+$newSettings.supervisor.config.path+'" --generation new');packageRoot=$newPackage;sourceCommit=$fixtureSource;config=$newSettings.supervisor.config;receipt=$(if($role-ceq'coreSupervisor'){$null}else{[ordered]@{path=(Join-Path (Join-Path $runRoot 'receipts-new') ($role+'.json'));schemaVersion=$null;exactKeys=@('run','pid','parentPid','parentCreationTime','creationTime','stage','sourceCommit','configSha256','copyId','actualT1');fields=[ordered]@{schema=$null;pid='pid';parentPid='parentPid';birth='creationTime';parentBirth='parentCreationTime';sourceCommit='sourceCommit';configSha256='configSha256';copyId='copyId';actualT1='actualT1'}}})}}
foreach($index in 0,1){$rules+=,[ordered]@{role=$(if($index-eq0){'terminalWatcher'}else{'hubWatcher'});taskName=$names[$index];nodePath=$shell;commandLine=('"'+$shell+'" '+(ActionArgs 'new' $index));packageRoot=$newPackage;sourceCommit=$fixtureSource;config=$settings.new;receipt=$null}}
$protectedTasks=@(foreach($task in $protectedBefore.sharedTasks){$instance=@($protectedBefore.sharedInstances|Where-Object{$_.name-ceq$task.name});Need ($instance.Count-eq1-and$task.state-eq4) 'SHARED_TASK_NOT_RUNNING';[ordered]@{name=$task.name;xmlSha256=(Hash ([Text.Encoding]::UTF8.GetBytes($task.xml)));state=$task.state;instanceGuid=$instance[0].instanceGuid;enginePid=$instance[0].enginePid}})
$profile=[ordered]@{schemaVersion='melisa-p03-physical-profile.v1';environment='P03_REHEARSAL';ownerSid=$owner;database=$db;beforeImage=$beforeRef;oldSettings=$settings.old;newSettings=$settings.new;packages=$packagePins;stopper=[ordered]@{path=$stopper;sha256=$stopperSha};tasks=$taskPins;candidateRules=$rules;oldWatchers=$old.watchers;protectedProcesses=$protectedBefore.processes;protectedBindings=$protectedBefore.bindings;protectedTasks=$protectedTasks;cloneProof=$cloneProof;businessDigest=$cloneProof;journalDirectory=(Join-Path $runRoot 'recovery');shell=[ordered]@{path=$shell;sha256=(Get-FileHash -LiteralPath $shell -Algorithm SHA256).Hash.ToLowerInvariant()};health=@(4284,4286|ForEach-Object{[ordered]@{url=('http://127.0.0.1:'+$_+'/test-health');databasePath='databaseName';sourcePath='sourceCommit';expectedSource=$fixtureSource;expectedGeneration='old'}})}
$profileRef=WriteNew (Join-Path $runRoot 'profile.json') (Bytes $profile)
$common=@{Environment='Rehearsal';ProfilePath=$profileRef.path;ProfileSha256=$profileRef.sha256;BeforeImagePath=$beforeRef.path;BeforeImageSha256=$beforeRef.sha256}
Need ((Get-FileHash -LiteralPath $engineRef.path -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$engineRef.sha256) 'ENGINE_PHASE_PIN'
$engineResult=(& $engineRef.path @common -Mode PreflightOld)|ConvertFrom-Json;Need ($engineResult.status-ceq'OLD_PHYSICAL_PREFLIGHT') 'OLD_PREFLIGHT'
Need ((Get-FileHash -LiteralPath $stopper -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$stopperSha) 'STOPPER_PRESTOP_PIN'
Journal 'STOP_OLD_FIXTURE_INTENT'
$fresh=Snapshot;Need ((Hash (Bytes (ProtectedSnapshot)))-ceq$protectedBeforeSha) 'PROTECTED_BEFORE_STOP'
foreach($entry in $old.tasks){$now=@($fresh.tasks|Where-Object{$_.name-ceq$entry.name});Need ($now.Count-eq1-and$now[0].state-eq4-and$now[0].xml-ceq$entry.xml-and$now[0].enginePid-eq$entry.enginePid-and$now[0].instanceGuid-ceq$entry.instanceGuid) 'OLD_TASK_INSTANCE_CAS'}
foreach($role in $roles){$actual=@($fresh.processes|Where-Object{$_.role-ceq$role});Need ($actual.Count-eq1-and(($actual[0]|ConvertTo-Json -Depth 8 -Compress)-ceq($identities[$role]|ConvertTo-Json -Depth 8 -Compress))) 'OLD_PROCESS_CAS'}
$active=$schedule.GetRunningTasks(1);$exact=@();foreach($entry in $old.tasks){$match=@();for($i=1;$i-le$active.Count;$i++){$r=$active.Item($i);if($r.Name-ceq$entry.name){$match+=,$r}};Need ($match.Count-eq1-and$match[0].InstanceGuid-ceq$entry.instanceGuid-and$match[0].EnginePID-eq$entry.enginePid) 'COM_INSTANCE_CAS';$exact+=,$match[0]};foreach($instance in $exact){$instance.Stop()}
foreach($role in $roles){$v=$identities[$role];$proof=[ordered]@{pid=$v.pid;parentPid=$v.parentPid;nodePath=$v.nodePath;ownerSid=$v.ownerSid;commandLine=$v.commandLine;creationTime=([string]$v.creationTime-replace'(\.\d{6})0Z$','$1Z')};$encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($proof|ConvertTo-Json -Compress)));Need ((Get-FileHash -LiteralPath $stopper -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$stopperSha) 'STOPPER_EACH_STOP_PIN';$result=& $stopper -ExpectedJsonBase64 $encoded;Need ($result-cin@('EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE')) 'OLD_EXACT_STOP'}
$stopUntil=[DateTime]::UtcNow.AddSeconds(20)
 do{$stopState=Snapshot;$orphanWatchers=@(Get-CimInstance Win32_Process|Where-Object{([string]$_.CommandLine).IndexOf($runRoot,[StringComparison]::OrdinalIgnoreCase)-ge0-and[string]$_.CommandLine-match'p03-rehearsal-watch-(?:core|hub)\.ps1'});if(@($stopState.tasks|Where-Object{$_.state-ne3}).Count-eq0-and$stopState.watchers.Count-eq0-and$orphanWatchers.Count-eq0){break};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow-lt$stopUntil)
 Need (@($stopState.tasks|Where-Object{$_.state-ne3}).Count-eq0-and$stopState.watchers.Count-eq0-and$orphanWatchers.Count-eq0) 'OLD_TASK_STOP_NOT_PROVEN'
Need (@(Get-NetTCPConnection -State Listen|Where-Object{$_.LocalPort-in$ports}).Count-eq0) 'OLD_PORTS_NOT_EMPTY'
Journal 'SET_NEW_ACTIONS_INTENT';foreach($entry in $profile.tasks){$task=$folder.GetTask($entry.name);Need ([int]$task.State-eq3-and(Hash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-ceq$entry.oldXmlSha256) 'ACTION_CAS';[void]$folder.RegisterTask($entry.name,$entry.newXml,4,$owner,$null,3,$null)}
Need (@(Get-NetTCPConnection -State Listen|Where-Object{$_.LocalPort-in$ports}).Count-eq0) 'BEFORE_START_PORTS'
foreach($entry in $profile.tasks){$task=$folder.GetTask($entry.name);Need ([int]$task.State-eq3-and(Hash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-ceq$entry.newXmlSha256) 'BEFORE_START_ACTION'}
Need ((Hash (Bytes (ProtectedSnapshot)))-ceq$protectedBeforeSha) 'PROTECTED_BEFORE_START'
Journal 'PARTIAL_START_INTENT';[void]$folder.GetTask($names[0]).Run($null)
$until=[DateTime]::UtcNow.AddSeconds(60);do{$partial=Snapshot;if($partial.processes.Count-eq2-and$partial.watchers.Count-eq1-and$partial.listeners.Count-eq1){break};Start-Sleep -Milliseconds 500}while([DateTime]::UtcNow-lt$until)
Need ($partial.processes.Count-eq2-and$partial.watchers.Count-eq1-and$partial.listeners[0].port-eq4286) 'PARTIAL_START_NOT_PROVEN'
$receipts=@($partial.processes|Where-Object{$_.role-ceq'erpNative'}|ForEach-Object{$p=Join-Path (Join-Path $runRoot 'receipts-new') ($_.role+'.json');[ordered]@{role=$_.role;path=$p;sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}})
$candidate=[ordered]@{schemaVersion='melisa-p03-physical-candidate.v1';environment='P03_REHEARSAL';profileSha256=$profileRef.sha256;beforeSha256=$beforeRef.sha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=@($partial.processes)+@($partial.watchers);receipts=$receipts}
$candidateRef=WriteNew (Join-Path $runRoot 'candidate.json') (Bytes $candidate);Journal 'RECOVER_PARTIAL_INTENT'
Need ((Get-FileHash -LiteralPath $engineRef.path -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$engineRef.sha256) 'ENGINE_PHASE_PIN'
$engineResult=(& $engineRef.path @common -Mode StopNew -CandidatePath $candidateRef.path -CandidateSha256 $candidateRef.sha256)|ConvertFrom-Json;Need ($engineResult.status-ceq'RECOVERED_OLD_ACTIONS') 'STOP_NEW'
$tail=@(Get-ChildItem -LiteralPath $profile.journalDirectory -Filter 'event-*.json' -File|Sort-Object Name)[-1];$tailSha=(Get-FileHash -LiteralPath $tail.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
Need ((Get-FileHash -LiteralPath $engineRef.path -Algorithm SHA256).Hash.ToLowerInvariant()-ceq$engineRef.sha256) 'ENGINE_PHASE_PIN'
$engineResult=(& $engineRef.path @common -Mode RollbackOld -RecoveryTailSha256 $tailSha)|ConvertFrom-Json;Need ($engineResult.status-ceq'RESTORED_READY') 'ROLLBACK_OLD'
$after=WaitOldReady;$protectedAfter=ProtectedSnapshot;Need ((Hash (Bytes $protectedAfter))-ceq$protectedBeforeSha) 'PROTECTED_BASELINE_CHANGED';Journal 'REHEARSAL_COMPLETE'
$report=[ordered]@{status='REHEARSAL_ROLLBACK_READY';environment='P03_REHEARSAL';runRoot=$runRoot;engine=$engineRef;engineSha256=$engineRef.sha256;profile=$profileRef;before=$beforeRef;candidate=$candidateRef;protectedBeforeSha256=$protectedBeforeSha;protectedAfterSha256=(Hash (Bytes $protectedAfter));sqlFreeFixture=$true;applicationRollbackVerified=$false;databaseRollbackVerified=$false;sharedTestMutation=$false;cleanupPerformed=$false}
if($EngineGeneration -cin @('B264V2','FailureRecordV1')){$report['engineGeneration']=$EngineGeneration}
$reportRef=WriteNew (Join-Path $runRoot 'result.json') (Bytes $report);$report['result']=$reportRef;$report|ConvertTo-Json -Depth 12
