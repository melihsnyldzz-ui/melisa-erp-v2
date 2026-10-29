param([switch]$Library,[string]$OutputPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$test125LibraryOnly=[bool]$Library
$test125OutputPath=$OutputPath
. (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library

# Preparation only. This file deliberately has no stop/start/apply mode.
function Get-Test125MaintenanceTaskLauncher($Config,[string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',[ValidateSet('Current','Candidate')][string]$Mode='Current',$PreparedReleaseProof=$null){
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and$Mode-ceq'Candidate'){
  if($null-eq$PreparedReleaseProof){throw 'B6_TASK_FROZEN_LAUNCHER_PROOF_REQUIRED'}
  $pins=Get-ErpBusinessSaleTaskLauncherPins $PreparedReleaseProof
  if($pins.path-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V2\start-owned-test.ps1'-or$pins.sha256-cnotmatch'^[a-fA-F0-9]{64}$'-or$pins.coreManifestSha256-cnotmatch'^[a-fA-F0-9]{64}$'){throw 'B6_TASK_FROZEN_LAUNCHER_PROOF_REQUIRED'}
  if((Get-FileHash -LiteralPath $pins.path -Algorithm SHA256).Hash-ine$pins.sha256){throw 'B6_TASK_FROZEN_LAUNCHER_CHANGED'}
  return $pins.path
 }
 if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')){throw 'TEST125_READPAIR_SCOPE_REJECTED'}
 return (Join-Path $Config.RepoRoot 'scripts\canonical\start-owned-test.ps1')
}
function Get-Test125TaskXmlSignature([string]$Xml){
 if(!$Xml-or$Xml.Length-gt1048576){throw 'B6_TASK_XML_REQUIRED'}
 $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
 $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($Xml),$settings);$doc=[Xml.XmlDocument]::new();$doc.PreserveWhitespace=$false;$doc.XmlResolver=$null
 try{$doc.Load($reader)}finally{$reader.Dispose()}
 if($doc.DocumentElement.LocalName-cne'Task'-or$doc.DocumentElement.NamespaceURI-cne'http://schemas.microsoft.com/windows/2004/02/mit/task'){throw 'B6_TASK_XML_SCOPE'}
 Add-Type -AssemblyName System.Security
 $canonical=[Security.Cryptography.Xml.XmlDsigC14NTransform]::new();$canonical.LoadInput($doc);$stream=$canonical.GetOutput([IO.Stream]);$hash=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose();$stream.Dispose()}
}
function Assert-Test125MaintenanceTask($Task,$Config,$StartupPath,[string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',[ValidateSet('Current','Candidate')][string]$Mode='Current',$PreparedReleaseProof=$null) {
 $exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
 $launcher=Get-Test125MaintenanceTaskLauncher $Config -ScopeName $ScopeName -Mode $Mode -PreparedReleaseProof $PreparedReleaseProof
 $argsText='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$launcher+'" -StartupConfigPath "'+$StartupPath+'"'
 $sid=if($Task.Principal.UserId -like 'S-1-*'){$Task.Principal.UserId}else{(New-Object Security.Principal.NTAccount($Task.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value}
 if($Task.TaskName -cne 'Melisa-ERP-TEST-Canonical' -or $Task.TaskPath -cne '\' -or [string]$Task.State -cne 'Running' -or !$Task.Settings.Enabled -or !$Task.Settings.AllowHardTerminate -or [string]$Task.Settings.MultipleInstances -cne 'IgnoreNew' -or [string]$Task.Principal.LogonType -cne 'Interactive' -or [string]$Task.Principal.RunLevel -cne 'Limited' -or $sid -cne $Config.OwnerSid -or @($Task.Actions).Count -ne 1){throw 'TEST125_TASK_IDENTITY_REJECTED'}
 $action=$Task.Actions[0]
 if(!(Same-ErpPath $action.Execute $exe) -or $action.Arguments -cne $argsText -or !(Same-ErpPath $action.WorkingDirectory $Config.RepoRoot)){throw 'TEST125_TASK_ACTION_REJECTED'}
 return @{Executable=$exe;Arguments=$argsText;Launcher=$launcher}
}

function Assert-Test125MaintenancePin($Before,$After) {
 # Only stable admission fields; observation time and supervisor heartbeat are not pins.
 foreach($key in @('runId','source','database','startupHash','launcherHash','manifestHash','taskXmlHash','taskInstance','supervisor','supervisorBirth','children')) {
  if(($Before.$key | ConvertTo-Json -Depth 8 -Compress) -cne ($After.$key | ConvertTo-Json -Depth 8 -Compress)){throw 'TEST125_BOUNDARY_CHANGED'}
 }
}

# Finite READ2b preparation; selecting a historical PRODUCT run cannot issue it.
function Get-Test125ReadPairScope([string]$Name='TEST125-API-READ2b-20261028-41d3c213') {
 if($Name-ceq'TEST125-API-B6-ca620bac-20261028'){
  return [pscustomobject][ordered]@{
   name=$Name;source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01'
   current=[pscustomobject][ordered]@{ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213';SourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';ManifestSha256='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090';ConfigPath='C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'}
   candidate=[pscustomobject][ordered]@{ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028';SourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';ManifestSha256='85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d';ConfigPath='C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'}
  }
 }
 if($Name-cne'TEST125-API-READ2b-20261028-41d3c213'){throw 'TEST125_READPAIR_SCOPE_REJECTED'}
 return [pscustomobject][ordered]@{
  name='TEST125-API-READ2b-20261028-41d3c213';source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01'
  current=[pscustomobject][ordered]@{ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-10cdc0ee';SourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';ManifestSha256='3e498c4fe89853e295c3ef0a66f88abcbd640b22750c6a54d4348b309b5c2f33';ConfigPath='C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'}
  candidate=[pscustomobject][ordered]@{ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213';SourceCommit='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';ManifestSha256='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090';ConfigPath='C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'}
 }
}
function Assert-Test125ReadPairConfig($Config,[ValidateSet('Current','Candidate')][string]$Mode='Current',[string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213') {
 $scope=Get-Test125ReadPairScope -Name $ScopeName;$expected=if($Mode-ceq'Current'){$scope.current}else{$scope.candidate}
 if($Config.SourceCommit-cne$scope.source-or$Config.ExpectedDatabase-cne$scope.database-or!(Same-ErpPath $Config.RepoRoot 'C:\Sirket\ERP\melisa-erp-v2')-or$Config.TaskName-cne'Melisa-ERP-TEST-Canonical'-or!$Config.PSObject.Properties['ApiComponent']){throw 'TEST125_READPAIR_TARGET_REJECTED'}
 $part=$Config.ApiComponent
 if(@($part.PSObject.Properties.Name).Count-ne4-or@($part.PSObject.Properties.Name|Where-Object{$_-cnotin@('ReleaseRoot','SourceCommit','ManifestSha256','ConfigPath')}).Count){throw 'TEST125_READPAIR_COMPONENT_REJECTED'}
 foreach($key in @('ReleaseRoot','SourceCommit','ManifestSha256','ConfigPath')){if($part.$key-cne$expected.$key){throw 'TEST125_READPAIR_COMPONENT_REJECTED'}}
 return $scope
}

function Get-Test125BoundMaintenancePlan([string]$RunId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7',[switch]$ReadPairPreparation,[ValidateSet('Current','Candidate')][string]$ReadPairMode='Current',$PreparedReleaseProof=$null) {
 if($ReadPairPreparation){try{[void](Get-Test125ReadPairScope -Name $RunId)}catch{throw 'TEST125_RUN_SCOPE_REJECTED'}}elseif($RunId -cnotin @('PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7','PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8','PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a')){throw 'TEST125_RUN_SCOPE_REJECTED'}
 if($null-ne$PreparedReleaseProof-and!$ReadPairPreparation){throw 'TEST125_RELEASE_PROOF_SCOPE_REJECTED'}
 $startup='C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $config=Read-ErpStartupConfig $startup -PreparedReleaseProof $PreparedReleaseProof
 if($ReadPairPreparation){[void](Assert-Test125ReadPairConfig $config $ReadPairMode -ScopeName $RunId)}
 if(!(Same-ErpPath $config.RepoRoot 'C:\Sirket\ERP\melisa-erp-v2') -or $config.SourceCommit -cne 'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d' -or $config.ExpectedDatabase -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $config.TaskName -cne 'Melisa-ERP-TEST-Canonical'){throw 'TEST125_EXACT_TARGET_REJECTED'}
 $task=Get-ScheduledTask -TaskName $config.TaskName -TaskPath '\' -ErrorAction Stop
 $action=if($ReadPairPreparation-and$RunId-ceq'TEST125-API-B6-ca620bac-20261028'){Assert-Test125MaintenanceTask $task $config $startup -ScopeName $RunId -Mode $ReadPairMode -PreparedReleaseProof $PreparedReleaseProof}else{Assert-Test125MaintenanceTask $task $config $startup}
 foreach($command in @('Stop-ScheduledTask','Start-ScheduledTask')){if(!(Get-Command $command -Module ScheduledTasks -ErrorAction SilentlyContinue)){throw 'TEST125_SUPPORTED_TASK_COMMAND_MISSING'}}
 if($ReadPairPreparation-and$RunId-ceq'TEST125-API-B6-ca620bac-20261028'){foreach($command in @('New-ScheduledTaskAction','Set-ScheduledTask')){if(!(Get-Command $command -Module ScheduledTasks -ErrorAction SilentlyContinue)){throw 'B6_SUPPORTED_TASK_ACTION_COMMAND_MISSING'}}}
 $owned=Get-Content -Raw -LiteralPath (Join-Path $config.RuntimeDir 'owned-processes.json') | ConvertFrom-Json
 if($owned.sourceCommit -cne $config.SourceCommit){throw 'TEST125_OWNED_SOURCE_CHANGED'}
 $scheduler=New-Object -ComObject Schedule.Service
 $scheduler.Connect()
 $registered=$scheduler.GetFolder('\').GetTask($config.TaskName)
 $instances=$registered.GetInstances(0)
 if($instances.Count -ne 1){throw 'TEST125_TASK_INSTANCE_COUNT_REJECTED'}
 $instance=$instances.Item(1)
 $supervisor=Get-ErpProcess $owned.supervisor
 if(!$supervisor -or [int]$instance.EnginePID -ne [int]$supervisor.ProcessId){throw 'TEST125_TASK_SUPERVISOR_NOT_BOUND'}
 $owner=Invoke-CimMethod -InputObject $supervisor -MethodName GetOwnerSid
 $remaining=[regex]::Replace([string]$supervisor.CommandLine,('^"?'+[regex]::Escape($action.Executable)+'"?\s+'),'')
 if($owner.ReturnValue -ne 0 -or $owner.Sid -cne $config.OwnerSid -or !(Same-ErpPath $supervisor.ExecutablePath $action.Executable) -or $remaining -cne $action.Arguments -or $supervisor.CreationDate.ToUniversalTime() -gt ([datetime]$owned.startedAt).ToUniversalTime()){throw 'TEST125_SUPERVISOR_IDENTITY_REJECTED'}
 $children=[ordered]@{}
 foreach($definition in Get-ErpServiceDefinitions $config){
  $record=$owned.children.($definition.Name)
  $process=Assert-ErpOwnedProcess $record.pid $config $definition $record.createdAt
  if(!$process){throw 'TEST125_CHILD_MISSING'}
  $listeners=@(Get-ErpServiceListeners $definition $config)
  if(!$listeners.Count -or @($listeners | Where-Object {$_.OwningProcess -ne $process.ProcessId}).Count){throw 'TEST125_CHILD_LISTENER_CHANGED'}
  $health=Assert-ErpHealth $config $definition
  if($definition.Name -eq 'native' -and ($health.sqlReadOnly -ne $true -or $health.sysadmin -ne 0)){throw 'TEST125_NATIVE_READONLY_CHANGED'}
  $children[$definition.Name]=[ordered]@{port=$definition.Port;pid=$process.ProcessId;birth=$process.CreationDate.ToUniversalTime().ToString('o');ownerVerified=$true;healthy=[bool]$health.ok}
 }
 $fresh=Get-ErpProcess $owned.supervisor
 $again=$registered.GetInstances(0)
 if(!$fresh -or $fresh.CreationDate -ne $supervisor.CreationDate -or $again.Count -ne 1 -or $again.Item(1).InstanceGuid -cne $instance.InstanceGuid -or [int]$again.Item(1).EnginePID -ne [int]$fresh.ProcessId){throw 'TEST125_SUPERVISOR_CHANGED_DURING_PROBE'}
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$xmlHash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$registered.Xml))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 return [ordered]@{
  schema='melisa-test125-bound-maintenance-preparation.v1';observedAt=(Get-Date).ToUniversalTime().ToString('o')
  runId=$RunId;source=$config.SourceCommit;database=$config.ExpectedDatabase
  startupHash=(Get-FileHash -LiteralPath $startup -Algorithm SHA256).Hash
  launcherHash=(Get-FileHash -LiteralPath $action.Launcher -Algorithm SHA256).Hash
  manifestHash=$config.ManifestSha256;taskXmlHash=$xmlHash;taskInstance=[string]$instance.InstanceGuid
  supervisor=$supervisor.ProcessId;supervisorBirth=$supervisor.CreationDate.ToUniversalTime().ToString('o');children=$children
  supportedTaskStopStart=$true;pauseReady=$false;status='PREPARED_NOT_REHEARSED';stopStartCalls=0;taskChanges=0;commercialWrites=0
 }
}

if(!$test125LibraryOnly){
 try{
  $result=Get-Test125BoundMaintenancePlan
  if($test125OutputPath){
   $full=[IO.Path]::GetFullPath($test125OutputPath)
   $base='C:\Sirket\ERP\evidence\ERP-GREENCOMBINED-APIWEB-PREFLIGHT-20261026\private\business-catalog-20261027\'
   if(!$full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($full) -notmatch '^active-221-test125-maintenance-preparation-[a-z0-9-]+\.json$'){throw 'TEST125_OUTPUT_SCOPE_REJECTED'}
   $bytes=[Text.Encoding]::UTF8.GetBytes(($result | ConvertTo-Json -Depth 10))
   $stream=[IO.File]::Open($full,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
   try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  }
  [ordered]@{status=$result.status;runId=$result.runId;taskIdentityVerified=$true;taskEngineBoundToSupervisor=$true;childrenVerified=3;supportedTaskStopStart=$true;pauseReady=$false;stopStartCalls=0;taskChanges=0;commercialWrites=0} | ConvertTo-Json -Compress
 }catch{[ordered]@{status='REJECTED';code=(Get-ErpSafeCode $_.Exception);stopStartCalls=0;taskChanges=0;commercialWrites=0} | ConvertTo-Json -Compress;exit 1}
}
