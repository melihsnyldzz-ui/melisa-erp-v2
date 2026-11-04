param([switch]$Library,[string]$OutputPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$test125LibraryOnly=[bool]$Library
$test125OutputPath=$OutputPath
. (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library

# Preparation only. This file deliberately has no stop/start/apply mode.
function Get-Test125MaintenanceTaskLauncher($Config,[string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',[ValidateSet('Current','Candidate')][string]$Mode='Current',$PreparedReleaseProof=$null){
 if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){
  if(!$PreparedReleaseProof){throw 'B6_TASK_FROZEN_LAUNCHER_PROOF_REQUIRED'}
  $pins=Get-ErpBusinessSaleWriterTaskLauncherPins $PreparedReleaseProof -Mode $Mode
  return $pins.path
 }
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and$Mode-ceq'Candidate'){
  if($null-eq$PreparedReleaseProof){throw 'B6_TASK_FROZEN_LAUNCHER_PROOF_REQUIRED'}
  $pins=Get-ErpBusinessSaleTaskLauncherPins $PreparedReleaseProof
  if($pins.path-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY\start-owned-test.ps1'-or$pins.sha256-cnotmatch'^[a-fA-F0-9]{64}$'-or$pins.coreManifestSha256-cnotmatch'^[a-fA-F0-9]{64}$'){throw 'B6_TASK_FROZEN_LAUNCHER_PROOF_REQUIRED'}
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
 if($Name-ceq'TEST125-API-B6-WRITER-20261029'){
  $o=Read-ErpBusinessSaleWriterOwnerSource
  $scope=[pscustomobject][ordered]@{name=$Name;source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01';current=$null;candidate=$null}
  foreach($mode in @('current','candidate')){$v=$o.packagePair.$mode.api;$scope.$mode=[pscustomobject][ordered]@{ReleaseRoot=$v.root;SourceCommit=$v.sourceCommit;ManifestSha256=$v.manifestSha256;ConfigPath=$v.configPath}}
  return $scope
 }
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

function Assert-Test125PackageRefreshObservationProof($Proof){
 $p=Get-ErpReadPairReleaseProofContext $Proof;$p.seal.Validate()
 $case=Get-ErpBusinessSalePackageRefreshFixedCase
 if(!$p.PSObject.Properties['packageRefreshAdmission']-or!$p.PSObject.Properties['packageRefreshTaskSource']-or!$p.businessSaleOwnerPins-or$p.businessSaleOwnerPins.path-cne(Join-Path $case.root 'start-owned-test.ps1')){throw 'B6_PACKAGE_REFRESH_OBSERVATION_NOT_ISSUED'}
 [void](Assert-ErpBusinessSaleWriterProfileAdmission $p.packageRefreshAdmission -Phase WriterPrepared);$n=Get-ErpBusinessSaleNativeAdmissionContext $p.packageRefreshAdmission
 if($n.mode-cne'PackageRefresh'-or$n.transition-or$n.ownerInputs.maintenancePurpose-cne'PreviewLinkPackageRefresh'){throw 'B6_PACKAGE_REFRESH_OBSERVATION_NOT_ISSUED'}
 [void](Read-ErpBusinessSalePinnedFile $n.profilePath $n.profileBeforeHash)
 return $p
}
function Assert-Test125ReadContextRepairObservationProof($Proof,[ValidateSet('Current','Candidate')][string]$Mode){
 $p=Get-ErpReadPairReleaseProofContext $Proof;$p.seal.Validate();$case=Get-ErpBusinessSaleReadContextRepairFixedCase
 if(!$p.PSObject.Properties['readContextRepairAdmission']-or!$p.PSObject.Properties['packageRefreshTaskSource']-or!$p.businessSaleOwnerPins-or$p.businessSaleOwnerPins.path-cne(Join-Path $case.root 'start-owned-test.ps1')){throw 'B6_READ_REPAIR_OBSERVATION_NOT_ISSUED'}
 [void](Assert-ErpBusinessSaleReadContextRepairObservation $p.readContextRepairAdmission $Mode)
 return $p
}
function Get-Test125BoundMaintenancePlan([string]$RunId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7',[switch]$ReadPairPreparation,[ValidateSet('Current','Candidate')][string]$ReadPairMode='Current',$PreparedReleaseProof=$null,[switch]$PackageRefreshPostTransitionObservation,[switch]$ReadContextRepairPostTransitionObservation) {
 if($ReadContextRepairPostTransitionObservation){if($PackageRefreshPostTransitionObservation-or!$ReadPairPreparation-or$RunId-cne'TEST125-API-B6-WRITER-20261029'){throw 'B6_READ_REPAIR_OBSERVATION_NOT_ISSUED'};[void](Assert-Test125ReadContextRepairObservationProof $PreparedReleaseProof $ReadPairMode)}
 if($PackageRefreshPostTransitionObservation){if(!$ReadPairPreparation-or$RunId-cne'TEST125-API-B6-WRITER-20261029'){throw 'B6_PACKAGE_REFRESH_OBSERVATION_NOT_ISSUED'};[void](Assert-Test125PackageRefreshObservationProof $PreparedReleaseProof)}
 if($ReadPairPreparation){try{[void](Get-Test125ReadPairScope -Name $RunId)}catch{throw 'TEST125_RUN_SCOPE_REJECTED'}}elseif($RunId -cnotin @('PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7','PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8','PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a')){throw 'TEST125_RUN_SCOPE_REJECTED'}
 if($null-ne$PreparedReleaseProof-and!$ReadPairPreparation){throw 'TEST125_RELEASE_PROOF_SCOPE_REJECTED'}
 $startup='C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $config=Read-ErpStartupConfig $startup -PreparedReleaseProof $PreparedReleaseProof
 if($ReadPairPreparation){[void](Assert-Test125ReadPairConfig $config $ReadPairMode -ScopeName $RunId)}
 if(!(Same-ErpPath $config.RepoRoot 'C:\Sirket\ERP\melisa-erp-v2') -or $config.SourceCommit -cne 'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d' -or $config.ExpectedDatabase -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $config.TaskName -cne 'Melisa-ERP-TEST-Canonical'){throw 'TEST125_EXACT_TARGET_REJECTED'}
 $task=Get-ScheduledTask -TaskName $config.TaskName -TaskPath '\' -ErrorAction Stop
 $taskMode=if($PackageRefreshPostTransitionObservation-or$ReadContextRepairPostTransitionObservation){'Candidate'}else{$ReadPairMode}
 $action=if($ReadPairPreparation-and$RunId-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){Assert-Test125MaintenanceTask $task $config $startup -ScopeName $RunId -Mode $taskMode -PreparedReleaseProof $PreparedReleaseProof}else{Assert-Test125MaintenanceTask $task $config $startup}
 foreach($command in @('Stop-ScheduledTask','Start-ScheduledTask')){if(!(Get-Command $command -Module ScheduledTasks -ErrorAction SilentlyContinue)){throw 'TEST125_SUPPORTED_TASK_COMMAND_MISSING'}}
 if($ReadPairPreparation-and$RunId-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){foreach($command in @('New-ScheduledTaskAction','Set-ScheduledTask')){if(!(Get-Command $command -Module ScheduledTasks -ErrorAction SilentlyContinue)){throw 'B6_SUPPORTED_TASK_ACTION_COMMAND_MISSING'}}}
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
 $runningArguments=$action.Arguments;$runningLauncher=$action.Launcher
 if($PreparedReleaseProof-and((Test-ErpBusinessSalePackageRefreshGeneration)-or(Test-ErpBusinessSaleReadContextRepairGeneration))){
  $release=Get-ErpReadPairReleaseProofContext $PreparedReleaseProof;$release.seal.Validate()
  if($release.PSObject.Properties['packageRefreshTaskSource']){
   $source=$release.packageRefreshTaskSource;$old=$source.runningSupervisor;$installed=$release.PSObject.Properties['packageRefreshTaskState']-and$release.packageRefreshTaskState.maintenanceInstalled
   if($PackageRefreshPostTransitionObservation-or$ReadContextRepairPostTransitionObservation){if($supervisor.ProcessId-eq$old.pid-or(Get-ErpProcess $old.pid)){throw 'B6_PACKAGE_REFRESH_OLD_SUPERVISOR_PRESENT'}}elseif(!$installed){
    if($supervisor.ProcessId-ne$old.pid-or$supervisor.CreationDate.ToUniversalTime().ToFileTimeUtc().ToString()-cne$old.cimBirth-or$old.birth.Substring(0,17)-cne$old.cimBirth.Substring(0,17)-or[string]$supervisor.CommandLine-cne$old.argv-or$owned.sourceCommit-cne$old.ownedRecordSourceCommit-or$owned.startedAt-cne$old.ownedRecordStartedAt-or(Get-FileHash -LiteralPath $old.ownedRecordPath -Algorithm SHA256).Hash-ine$old.ownedRecordSha256){throw 'B6_PACKAGE_REFRESH_RUNNING_SUPERVISOR_CHANGED'}
    $runningLauncher=$old.launcher.path;$runningArguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$runningLauncher+'" -StartupConfigPath "'+$startup+'"'
   }elseif($supervisor.ProcessId-eq$old.pid){throw 'B6_PACKAGE_REFRESH_OLD_SUPERVISOR_PRESENT'}
  }
 }
 if($owner.ReturnValue -ne 0 -or $owner.Sid -cne $config.OwnerSid -or !(Same-ErpPath $supervisor.ExecutablePath $action.Executable) -or $remaining -cne $runningArguments -or $supervisor.CreationDate.ToUniversalTime() -gt ([datetime]$owned.startedAt).ToUniversalTime()){throw 'TEST125_SUPERVISOR_IDENTITY_REJECTED'}
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
  launcherHash=(Get-FileHash -LiteralPath $runningLauncher -Algorithm SHA256).Hash
  manifestHash=$config.ManifestSha256;taskXmlHash=$xmlHash;taskInstance=[string]$instance.InstanceGuid
  supervisor=$supervisor.ProcessId;supervisorBirth=$supervisor.CreationDate.ToUniversalTime().ToString('o');children=$children
  supportedTaskStopStart=$true;pauseReady=$false;status='PREPARED_NOT_REHEARSED';stopStartCalls=0;taskChanges=0;commercialWrites=0
 }
}

function Get-Test125PackageRefreshPostTransitionPlan([ValidateSet('Candidate','Current')][string]$Mode,[Parameter(Mandatory)]$PreparedReleaseProof){
 if($Mode-cnotin@('Candidate','Current')){throw 'B6_PACKAGE_REFRESH_OBSERVATION_NOT_ISSUED'}
 $proof=Assert-Test125PackageRefreshObservationProof $PreparedReleaseProof;$holds=[Collections.Generic.List[object]]::new()
 try{
  # The controller's own admission stays Prepared and unbound. No owner-local
  # task state or activation phase is imported to make this read succeed.
  [void](Test-ErpBusinessSaleAfter (Get-ErpBusinessSaleNativeInputs))
  $plan=Get-Test125BoundMaintenancePlan -RunId 'TEST125-API-B6-WRITER-20261029' -ReadPairPreparation -ReadPairMode $Mode -PreparedReleaseProof $PreparedReleaseProof -PackageRefreshPostTransitionObservation
  Initialize-Test125ApiKernel
  foreach($role in @('supervisor','api','native','web')){
   $r=if($role-ceq'supervisor'){@{pid=$plan.supervisor;birth=$plan.supervisorBirth}}else{$plan.children.$role}
   $birth=([datetime]$r.birth).ToUniversalTime().Ticks;$handle=[Test125ApiKernel]::QueryOnlyOpen([int]$r.pid,$birth);$holds.Add(@{handle=$handle;birth=$birth})
  }
  $o=Read-ErpBusinessSalePackageRefreshOwnerSource;$m=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $o.manifestPath $o.manifestSha256))|ConvertFrom-Json
  $xmlPin=@($m.beforeImages|Where-Object path -ceq 'current-task.before.xml');$sddlPin=@($m.beforeImages|Where-Object path -ceq 'current-task.before.sddl')
  if($xmlPin.Count-ne1-or$sddlPin.Count-ne1){throw 'B6_PACKAGE_REFRESH_OBSERVATION_TASK_CHANGED'}
  $xml=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $o.root $xmlPin[0].path) $xmlPin[0].sha256));$sddl=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $o.root $sddlPin[0].path) $sddlPin[0].sha256))
  $doc=[Xml.XmlDocument]::new();$doc.XmlResolver=$null;$doc.LoadXml($xml);$ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task');$args=@($doc.SelectNodes('/t:Task/t:Actions/t:Exec/t:Arguments',$ns))
  $future=$proof.packageRefreshTaskSource.path;$old='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$future+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
  if($args.Count-ne1-or$args[0].InnerText-cne$old){throw 'B6_PACKAGE_REFRESH_OBSERVATION_TASK_CHANGED'}
  $args[0].InnerText=$old.Replace($future,$proof.businessSaleOwnerPins.path);$expected=Get-Test125TaskXmlSignature $doc.OuterXml
  $service=New-Object -ComObject Schedule.Service;$service.Connect();$registered=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
  if((Get-Test125TaskXmlSignature ([string]$registered.Xml))-cne$expected-or[string]$registered.GetSecurityDescriptor(7)-cne$sddl){throw 'B6_PACKAGE_REFRESH_OBSERVATION_TASK_CHANGED'}
  $again=Get-Test125BoundMaintenancePlan -RunId 'TEST125-API-B6-WRITER-20261029' -ReadPairPreparation -ReadPairMode $Mode -PreparedReleaseProof $PreparedReleaseProof -PackageRefreshPostTransitionObservation
  Assert-Test125MaintenancePin $plan $again
  foreach($h in $holds){[Test125ApiKernel]::ValidateReadOnly($h.handle,$h.birth)}
  [void](Assert-Test125PackageRefreshObservationProof $PreparedReleaseProof)
  $plan.supportedTaskStopStart=$false;$plan.status='POST_TRANSITION_READONLY_NOT_ADMISSION';$plan.schema='melisa-test125-package-refresh-readonly-observation.v1';$plan.readOnly=$true;$plan.executionAuthority=$false
  return $plan
 }finally{foreach($h in $holds){$h.handle.Dispose()}}
}
function Get-Test125ReadContextRepairPostTransitionPlan([ValidateSet('Candidate','Current')][string]$Mode,[Parameter(Mandatory)]$PreparedReleaseProof){
 if($Mode-cnotin@('Candidate','Current')){throw 'B6_READ_REPAIR_OBSERVATION_NOT_ISSUED'}
 $proof=Assert-Test125ReadContextRepairObservationProof $PreparedReleaseProof $Mode;$holds=[Collections.Generic.List[object]]::new()
 try{
  # The controller's own admission stays Prepared and unbound. No owner-local
  # task state or activation phase is imported to make this read succeed.
  [void](Assert-ErpBusinessSaleReadContextRepairObservation $proof.readContextRepairAdmission $Mode)
  $plan=Get-Test125BoundMaintenancePlan -RunId 'TEST125-API-B6-WRITER-20261029' -ReadPairPreparation -ReadPairMode $Mode -PreparedReleaseProof $PreparedReleaseProof -ReadContextRepairPostTransitionObservation
  Initialize-Test125ApiKernel
  foreach($role in @('supervisor','api','native','web')){
   $r=if($role-ceq'supervisor'){@{pid=$plan.supervisor;birth=$plan.supervisorBirth}}else{$plan.children.$role}
   $birth=([datetime]$r.birth).ToUniversalTime().Ticks;$handle=[Test125ApiKernel]::QueryOnlyOpen([int]$r.pid,$birth);$holds.Add(@{handle=$handle;birth=$birth})
  }
  $o=Read-ErpBusinessSaleReadContextRepairOwnerSource;$m=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $o.manifestPath $o.manifestSha256))|ConvertFrom-Json
  $xmlPin=@($m.beforeImages|Where-Object path -ceq 'current-task.before.xml');$sddlPin=@($m.beforeImages|Where-Object path -ceq 'current-task.before.sddl')
  if($xmlPin.Count-ne1-or$sddlPin.Count-ne1){throw 'B6_READ_REPAIR_OBSERVATION_TASK_CHANGED'}
  $xml=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $o.root $xmlPin[0].path) $xmlPin[0].sha256));$sddl=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $o.root $sddlPin[0].path) $sddlPin[0].sha256))
  $doc=[Xml.XmlDocument]::new();$doc.XmlResolver=$null;$doc.LoadXml($xml);$ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task');$args=@($doc.SelectNodes('/t:Task/t:Actions/t:Exec/t:Arguments',$ns))
  $future=$proof.packageRefreshTaskSource.path;$old='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$future+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
  if($args.Count-ne1-or$args[0].InnerText-cne$old){throw 'B6_READ_REPAIR_OBSERVATION_TASK_CHANGED'}
  $args[0].InnerText=$old.Replace($future,$proof.businessSaleOwnerPins.path);$expected=Get-Test125TaskXmlSignature $doc.OuterXml
  $service=New-Object -ComObject Schedule.Service;$service.Connect();$registered=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
  if((Get-Test125TaskXmlSignature ([string]$registered.Xml))-cne$expected-or[string]$registered.GetSecurityDescriptor(7)-cne$sddl){throw 'B6_READ_REPAIR_OBSERVATION_TASK_CHANGED'}
  $again=Get-Test125BoundMaintenancePlan -RunId 'TEST125-API-B6-WRITER-20261029' -ReadPairPreparation -ReadPairMode $Mode -PreparedReleaseProof $PreparedReleaseProof -ReadContextRepairPostTransitionObservation
  Assert-Test125MaintenancePin $plan $again
  foreach($h in $holds){[Test125ApiKernel]::ValidateReadOnly($h.handle,$h.birth)}
  [void](Assert-Test125ReadContextRepairObservationProof $PreparedReleaseProof $Mode)
  $plan.supportedTaskStopStart=$false;$plan.status='POST_TRANSITION_READONLY_NOT_ADMISSION';$plan.schema='melisa-test125-read-context-repair-readonly-observation.v1';$plan.readOnly=$true;$plan.executionAuthority=$false
  return $plan
 }finally{foreach($h in $holds){$h.handle.Dispose()}}
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
# B6-BEGIN-API-FORWARD-V1 is a pure proposal model. It consumes supplied JSON
# only; it does not issue admission, inspect runtime, stop services, write SQL,
# change config or authorize installation. The controller must separately obtain
# a fresh target-bound owner and transaction/CAS proof through a supported path.
function Assert-Test125ForwardModelKeys($Value,[string[]]$Names){
 if($null-eq$Value-or$Value-isnot[pscustomobject]){throw 'B6_FORWARD_MODEL_SHAPE'}
 $actual=@($Value.PSObject.Properties.Name | Sort-Object -CaseSensitive);$expected=@($Names | Sort-Object -CaseSensitive)
 if(($actual-join'|')-cne($expected-join'|')){throw 'B6_FORWARD_MODEL_SHAPE'}
}
function Test-Test125ForwardModelHash($Value,[switch]$Uppercase){if($Value-isnot[string]){return $false};if($Uppercase){return $Value-cmatch'\A[A-F0-9]{64}\z'};return $Value-cmatch'\A[a-f0-9]{64}\z'}
function Get-Test125B6ForwardOnlyModel([string]$CaseJson,[string]$BeforeJson,[string]$RecheckJson){
 foreach($v in @($CaseJson,$BeforeJson,$RecheckJson)){if(!$v-or$v.Length-gt16384){throw 'B6_FORWARD_MODEL_INPUT'}}
 try{$case=$CaseJson|ConvertFrom-Json -ErrorAction Stop;$before=$BeforeJson|ConvertFrom-Json -ErrorAction Stop;$recheck=$RecheckJson|ConvertFrom-Json -ErrorAction Stop}catch{throw 'B6_FORWARD_MODEL_INPUT'}
 foreach($pair in @(@($CaseJson,$case),@($BeforeJson,$before),@($RecheckJson,$recheck))){if($pair[0]-cne($pair[1]|ConvertTo-Json -Depth 10 -Compress)){throw 'B6_FORWARD_MODEL_CANONICAL_JSON'}}
 Assert-Test125ForwardModelKeys $case @('schema','purpose','database','server','sourceCommit','actorId','roleId','oldApi','newApi','oldWeb','newWeb','oldBegin','newBegin','profileField')
 if($case.schema-cne'melisa-b6-forward-case-model.v1'-or$case.purpose-cne'B6_BEGIN_API_FORWARD_V1'-or$case.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or$case.server-cne'Semih\MELISADEV'-or$case.sourceCommit-cne'fce4d7aa21d2828c32576a8e5a51adb84fb000fe'-or($case.actorId-isnot[int]-and$case.actorId-isnot[long])-or$case.actorId-ne17-or($case.roleId-isnot[int]-and$case.roleId-isnot[long])-or$case.roleId-ne17-or$case.profileField-cne'businessSaleAdmission.beginDefinitionHash'){throw 'B6_FORWARD_MODEL_TARGET'}
 foreach($name in @('oldApi','newApi','oldWeb','newWeb')){if(!(Test-Test125ForwardModelHash $case.$name)){throw 'B6_FORWARD_MODEL_HASH'}}
 foreach($name in @('oldBegin','newBegin')){if(!(Test-Test125ForwardModelHash $case.$name -Uppercase)){throw 'B6_FORWARD_MODEL_HASH'}}
 $oldApi=@('342fa6b6','ac7448a8','ac515cbd','118638b8','57d44c56','fc621b74','ac0070dd','209c0a5f')-join''
 $oldWeb=@('fbedc4da','026b4ac2','57440ddc','d54166b5','69a623c0','67d7c5a5','c712fa6a','f5d99ab6')-join''
 if($case.oldApi-cne$oldApi-or$case.oldWeb-cne$oldWeb){throw 'B6_FORWARD_MODEL_BASE_PIN'}
 $oldBegin=@('C91F4302','8BFA9E3A','B9448167','09B2A235','0767340C','3447AECB','AABAA524','E7CA18FA')-join''
 $newBegin=@('3353D341','EA93FE97','BBB911C4','4D113E8A','E3E07BF5','6ACE2900','2F3414AB','539E8305')-join''
 if($case.oldBegin-cne$oldBegin-or$case.newBegin-cne$newBegin){throw 'B6_FORWARD_MODEL_BEGIN_PIN'}
 if($case.oldApi-ceq$case.newApi-or$case.oldWeb-ceq$case.newWeb-or$case.oldBegin-ceq$case.newBegin){throw 'B6_FORWARD_MODEL_NO_CHANGE'}
 $keys=@('schema','purpose','database','server','apiPort','nativePort','webPort','actualT1','externalOperations','actorId','roleId','observedUtc','ownerSid','taskInstance','supervisorPid','supervisorBirth','apiPid','apiBirth','nativePid','nativeBirth','webPid','webBirth','taskHash','profileHash','beginHash','apiHash','webHash','journalHash','dataHash')
 foreach($v in @($before,$recheck)){
  Assert-Test125ForwardModelKeys $v $keys
  if($v.schema-cne'melisa-b6-forward-observation-model.v1'-or$v.purpose-cne$case.purpose-or$v.database-cne$case.database-or$v.server-cne$case.server-or($v.apiPort-isnot[int]-and$v.apiPort-isnot[long])-or$v.apiPort-ne4144-or($v.nativePort-isnot[int]-and$v.nativePort-isnot[long])-or$v.nativePort-ne4146-or($v.webPort-isnot[int]-and$v.webPort-isnot[long])-or$v.webPort-ne5244-or$v.actualT1-isnot[bool]-or$v.actualT1-ne$false-or$v.externalOperations-isnot[bool]-or$v.externalOperations-ne$false-or($v.actorId-isnot[int]-and$v.actorId-isnot[long])-or$v.actorId-ne17-or($v.roleId-isnot[int]-and$v.roleId-isnot[long])-or$v.roleId-ne17){throw 'B6_FORWARD_MODEL_TARGET'}
  if($v.ownerSid-isnot[string]-or$v.ownerSid-cnotmatch'\AS-1-(?:\d+-){1,14}\d+\z'-or$v.taskInstance-isnot[string]-or$v.taskInstance-cnotmatch'\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z'){throw 'B6_FORWARD_MODEL_OWNER'}
  $ids=@($v.supervisorPid,$v.apiPid,$v.nativePid,$v.webPid);if(@($ids|Where-Object{($_-isnot[int]-and$_-isnot[long])-or$_-le0-or$_-gt2147483647}).Count-or@($ids|Sort-Object -Unique).Count-ne4){throw 'B6_FORWARD_MODEL_OWNER'}
  foreach($name in @('supervisorBirth','apiBirth','nativeBirth','webBirth')){if($v.$name-isnot[string]-or$v.$name-cnotmatch'\A[0-9]{18}\z'){throw 'B6_FORWARD_MODEL_OWNER'}}
  foreach($name in @('taskHash','profileHash','apiHash','webHash','journalHash','dataHash')){if(!(Test-Test125ForwardModelHash $v.$name)){throw 'B6_FORWARD_MODEL_HASH'}}
  if(!(Test-Test125ForwardModelHash $v.beginHash -Uppercase)){throw 'B6_FORWARD_MODEL_HASH'}
  if($v.apiHash-cne$case.oldApi-or$v.webHash-cne$case.oldWeb-or$v.beginHash-cne$case.oldBegin){throw 'B6_FORWARD_MODEL_CAS'}
 }
 $oldTime=[datetimeoffset]::MinValue;$newTime=[datetimeoffset]::MinValue
 if(![datetimeoffset]::TryParseExact($before.observedUtc,'yyyy-MM-ddTHH:mm:ss.fffffffZ',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal,[ref]$oldTime)-or![datetimeoffset]::TryParseExact($recheck.observedUtc,'yyyy-MM-ddTHH:mm:ss.fffffffZ',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal,[ref]$newTime)){throw 'B6_FORWARD_MODEL_TIME'}
 $now=[datetimeoffset]::UtcNow;if($newTime-lt$oldTime-or($newTime-$oldTime).TotalSeconds-gt120-or($now-$newTime).TotalSeconds-lt0-or($now-$newTime).TotalSeconds-gt120-or($now-$oldTime).TotalSeconds-gt120){throw 'B6_FORWARD_MODEL_TIME'}
 foreach($name in $keys){if($name-ceq'observedUtc'){continue};if(($before.$name|ConvertTo-Json -Compress)-cne($recheck.$name|ConvertTo-Json -Compress)){throw 'B6_FORWARD_MODEL_DRIFT'}}
 return [pscustomobject][ordered]@{schema='melisa-b6-forward-plan-model.v1';purpose=$case.purpose;status='MODEL_ONLY_NOT_ADMISSION';sourceCommit=$case.sourceCommit;database=$case.database;server=$case.server;oldApi=$case.oldApi;newApi=$case.newApi;oldWeb=$case.oldWeb;newWeb=$case.newWeb;sqlModule='dbo.usp_canonical_business_sale_begin_v1';oldBegin=$case.oldBegin;newBegin=$case.newBegin;profileField=$case.profileField;candidateManifestProvenance='UNVERIFIED_INPUT';observationProvenance='UNVERIFIED_INPUT';dataAndJournal='BEFORE_ONLY_NOT_POSTVALIDATED';rollbackStatus='NOT_REQUIRED_FOR_MODEL';installed=$false;runtimeVerified=$false;executionAuthority=$false;sqlCalls=0;serviceChanges=0;configChanges=0;commercialWrites=0}
}
