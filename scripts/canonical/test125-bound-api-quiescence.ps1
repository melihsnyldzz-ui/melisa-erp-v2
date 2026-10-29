# Narrow library only: no task/host CLI, automatic stop, driver admission or deployment.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'test125-bound-maintenance-plan.ps1') -Library
if((Get-Variable -Name Test125ApiBinding -Scope Script -ErrorAction SilentlyContinue) -and $script:Test125ApiBinding){throw 'TEST125_API_BINDING_ALREADY_OPEN'}
$script:Test125ApiBinding=$null
function Initialize-Test125ApiKernel {
 if('Test125ApiKernel' -as [type]){return}
 # Same retained-handle contract as the existing B5 kernel; separate TEST125 scope.
 Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public sealed class Test125ApiHandle:SafeHandleZeroOrMinusOneIsInvalid{public long Birth;public bool QueryOnly;public Test125ApiHandle():base(true){}protected override bool ReleaseHandle(){return Test125ApiKernel.CloseHandle(handle);}}
public static class Test125ApiKernel{
 [DllImport("kernel32.dll",SetLastError=true)]static extern Test125ApiHandle OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetProcessTimes(Test125ApiHandle h,out long c,out long e,out long k,out long u);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(Test125ApiHandle h,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(Test125ApiHandle h,uint code);
 // CIM timestamps have microsecond precision; retain exact kernel birth after initial binding.
 public static bool MatchesCim(long native,long cim){return cim%10==0?native/10==cim/10:native==cim;}
 static void Check(Test125ApiHandle h,long expected){long c,e,k,u;if(h==null||h.IsClosed||h.IsInvalid||!GetProcessTimes(h,out c,out e,out k,out u)||DateTime.FromFileTimeUtc(c).Ticks!=h.Birth||!MatchesCim(h.Birth,expected))throw new InvalidOperationException("TEST125_API_HANDLE_IDENTITY");}
 public static Test125ApiHandle Open(int pid,long birth){var h=OpenProcess(0x00101001,false,(uint)pid);long c,e,k,u;if(h.IsInvalid||!GetProcessTimes(h,out c,out e,out k,out u)||!MatchesCim(DateTime.FromFileTimeUtc(c).Ticks,birth)||WaitForSingleObject(h,0)!=258){h.Dispose();throw new InvalidOperationException("TEST125_API_HANDLE_IDENTITY");}h.Birth=DateTime.FromFileTimeUtc(c).Ticks;return h;}
 public static Test125ApiHandle QueryOnlyOpen(int pid,long birth){var h=OpenProcess(0x00101000,false,(uint)pid);long c,e,k,u;if(h.IsInvalid||!GetProcessTimes(h,out c,out e,out k,out u)||!MatchesCim(DateTime.FromFileTimeUtc(c).Ticks,birth)||WaitForSingleObject(h,0)!=258){h.Dispose();throw new InvalidOperationException("TEST125_API_HANDLE_IDENTITY");}h.Birth=DateTime.FromFileTimeUtc(c).Ticks;h.QueryOnly=true;return h;}
 public static void ValidateReadOnly(Test125ApiHandle h,long birth){if(h==null||!h.QueryOnly)throw new InvalidOperationException("TEST125_API_READ_HANDLE_REQUIRED");Check(h,birth);if(WaitForSingleObject(h,0)!=258)throw new InvalidOperationException("TEST125_API_READ_HANDLE_EXITED");}
 public static bool Exited(Test125ApiHandle h,long birth){Check(h,birth);return WaitForSingleObject(h,0)==0;}
 public static void Stop(Test125ApiHandle h,long birth){if(h!=null&&h.QueryOnly)throw new InvalidOperationException("TEST125_API_READ_HANDLE_REQUIRED");Check(h,birth);if(WaitForSingleObject(h,0)!=258)throw new InvalidOperationException("TEST125_API_ALREADY_EXITED");if(!TerminateProcess(h,1)||WaitForSingleObject(h,10000)!=0)throw new InvalidOperationException("TEST125_API_STOP_UNCONFIRMED");}
}
'@
}
$script:Test125ReadPairContext=$null
$script:Test125ReadPairRequestAdmissions=[Collections.ArrayList]::new()
function Assert-Test125ApiAdmission($Admission,[string]$ExpectedRunId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7'){
 if($PSVersionTable.PSEdition -cne 'Desktop'){throw 'TEST125_WINDOWS_POWERSHELL_REQUIRED'}
 if($ExpectedRunId-cin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  $ctx=$script:Test125ReadPairContext
  if(!$ctx-or$ctx.token.scope-cne$ExpectedRunId-or![object]::ReferenceEquals($Admission,$ctx.admission)-or$ctx.pid-ne$PID-or$ctx.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId){throw 'TEST125_API_SCOPE_REJECTED'}
  if(($Admission|ConvertTo-Json -Depth 32 -Compress)-cne$ctx.admissionJson){throw 'TEST125_API_SCOPE_REJECTED'};return
 }
 if($ExpectedRunId -cnotin @('PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7','PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8','PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a') -or $Admission.schema -cne 'melisa-test125-bound-maintenance-preparation.v1' -or $Admission.runId -cne $ExpectedRunId -or $Admission.source -cne 'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d' -or $Admission.database -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $Admission.children.api.port -ne 4144 -or $Admission.children.native.port -ne 4146 -or $Admission.children.web.port -ne 5194){throw 'TEST125_API_SCOPE_REJECTED'}
}
function Open-Test125ApiQuiescence($Admission,[string]$ExpectedRunId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7'){
 Assert-Test125ApiAdmission $Admission $ExpectedRunId
 if($script:Test125ApiBinding){throw 'TEST125_API_BINDING_ALREADY_OPEN'}
 $fresh=if($ExpectedRunId-cin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){Get-Test125BoundMaintenancePlan -RunId $ExpectedRunId -ReadPairPreparation -ReadPairMode $script:Test125ReadPairContext.mode -PreparedReleaseProof $script:Test125ReadPairContext.releaseProof}else{Get-Test125BoundMaintenancePlan -RunId $ExpectedRunId}
 Assert-Test125MaintenancePin $Admission $fresh
 $releaseProof=if($ExpectedRunId-cin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){$script:Test125ReadPairContext.releaseProof}else{$null}
 $config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json' -PreparedReleaseProof $releaseProof
 $definition=@(Get-ErpServiceDefinitions $config | Where-Object {$_.Name -eq 'api'})[0]
 $process=Assert-ErpOwnedProcess $Admission.children.api.pid $config $definition $Admission.children.api.birth
 if(!$process){throw 'TEST125_API_MISSING_BEFORE_OPEN'}
 Initialize-Test125ApiKernel
 $birth=$process.CreationDate.ToUniversalTime().Ticks
 $handle=[Test125ApiKernel]::Open($process.ProcessId,$birth)
 try{
  $again=Assert-ErpOwnedProcess $process.ProcessId $config $definition $Admission.children.api.birth
  if(!$again -or $again.CreationDate -ne $process.CreationDate){throw 'TEST125_API_CHANGED_DURING_OPEN'}
  $binding=[pscustomobject]@{admission=$Admission;config=$config;definition=$definition;handle=$handle;birth=$birth;mutex=$null;held=$false;stopped=$false;releaseProof=$releaseProof}
  $script:Test125ApiBinding=$binding;return $binding
 }catch{$handle.Dispose();throw}
}
function Assert-Test125ApiStoppedSupervisor($Binding){
 if(!$Binding -or ![object]::ReferenceEquals($Binding,$script:Test125ApiBinding)){throw 'TEST125_API_BINDING_NOT_OWNED'}
 $a=$Binding.admission;$c=$Binding.config
 $launcher=Get-Test125ReadPairBindingLauncher $Binding
 if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json' -Algorithm SHA256).Hash -cne $a.startupHash -or (Get-FileHash -LiteralPath $launcher -Algorithm SHA256).Hash -cne $a.launcherHash){throw 'TEST125_API_CONFIG_CHANGED'}
 $releaseProof=if($Binding.PSObject.Properties['releaseProof']){$Binding.releaseProof}else{$null}
 if($a.runId-cin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-and$null-eq$releaseProof){throw 'TEST125_RELEASE_PROOF_REQUIRED'}
 Assert-ErpRelease $c -PreparedReleaseProof $releaseProof | Out-Null
 $service=New-Object -ComObject Schedule.Service;$service.Connect();$task=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$task.Xml))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 if($hash -cne $a.taskXmlHash -or $task.GetInstances(0).Count -ne 0 -or (Get-ErpProcess $a.supervisor)){throw 'TEST125_API_SUPERVISOR_NOT_EXCLUDED'}
 if($a.runId-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){$pair=$script:Test125ReadPairContext;if(!$pair.taskAction-or$pair.taskAction.unknown-or[string]$task.GetSecurityDescriptor(7)-cne$pair.taskAction.sddl){throw 'B6_TASK_ACTION_BOUNDARY_CHANGED'}}
 foreach($name in @('web','native')){
  $d=@(Get-ErpServiceDefinitions $c | Where-Object {$_.Name -eq $name})[0]
  $p=Assert-ErpOwnedProcess $a.children.$name.pid $c $d $a.children.$name.birth
  if(!$p){throw 'TEST125_API_COMPANION_LOST'}
  $listeners=@(Get-ErpServiceListeners $d $c)
  if(!$listeners.Count -or @($listeners | Where-Object {$_.OwningProcess -ne $p.ProcessId}).Count){throw 'TEST125_API_COMPANION_PORT_CHANGED'}
  $health=Assert-ErpHealth $c $d
  if($name -eq 'native' -and ($health.sqlReadOnly -ne $true -or $health.sysadmin -ne 0)){throw 'TEST125_API_NATIVE_NOT_READONLY'}
 }
}
function Enter-Test125ApiQuiescence($Binding){
 Assert-Test125ApiStoppedSupervisor $Binding
 if($Binding.held -or $Binding.mutex){throw 'TEST125_API_LEASE_ALREADY_ENTERED'}
 $Binding.mutex=New-Object Threading.Mutex($false,(Get-ErpMutexName $Binding.config.RepoRoot $Binding.config.OwnerSid))
 try{$Binding.held=$Binding.mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$Binding.held=$true}
 if(!$Binding.held){throw 'TEST125_API_EXISTING_MUTEX_UNAVAILABLE'}
 Assert-Test125ApiStoppedSupervisor $Binding
}
function Stop-Test125BoundApi($Binding){
 Assert-Test125ApiStoppedSupervisor $Binding
 if(!$Binding.held -or $Binding.stopped){throw 'TEST125_API_STOP_SCOPE_REJECTED'}
 $a=$Binding.admission;$c=$Binding.config;$d=$Binding.definition
 $p=Assert-ErpOwnedProcess $a.children.api.pid $c $d $a.children.api.birth
 if(!$p -or $p.CreationDate.ToUniversalTime().Ticks -ne $Binding.birth){throw 'TEST125_API_FRESH_PROCESS_CHANGED'}
 $listeners=@(Get-ErpServiceListeners $d $c)
 if(!$listeners.Count -or @($listeners | Where-Object {$_.OwningProcess -ne $p.ProcessId}).Count){throw 'TEST125_API_PORT_CHANGED'}
 Assert-ErpHealth $c $d | Out-Null
 # Action targets only the already opened kernel object, never a fresh PID lookup.
 [Test125ApiKernel]::Stop($Binding.handle,$Binding.birth)
 $Binding.stopped=$true
}
function Test-Test125ApiPhysicalPause($Binding){
 Assert-Test125ApiStoppedSupervisor $Binding
 if(!$Binding.held -or !$Binding.stopped -or ![Test125ApiKernel]::Exited($Binding.handle,$Binding.birth) -or @(Get-NetTCPConnection -State Listen -LocalPort 4144 -ErrorAction SilentlyContinue).Count){throw 'TEST125_API_PAUSE_NOT_PROVEN'}
 return $true
}
function Close-Test125ApiQuiescence($Binding){
 if(!$Binding -or ![object]::ReferenceEquals($Binding,$script:Test125ApiBinding)){throw 'TEST125_API_BINDING_NOT_OWNED'}
 try{if($Binding.held){$Binding.mutex.ReleaseMutex();$Binding.held=$false}}finally{if($Binding.mutex){$Binding.mutex.Dispose()};$Binding.handle.Dispose();$script:Test125ApiBinding=$null}
}

# The only new capability is an object issued in this process/thread. Neither a
# historical PRODUCT receipt nor a caller-built shape can authorize this pair.
function Get-Test125ReadPairHash([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Get-Test125ReadPairBindingLauncher($Binding){
 $config=$Binding.config
 if($Binding.admission.runId-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  $registered=$script:Test125ReadPairContext
  $c=Get-Test125ReadPairNativeAuditContext $registered.token $registered.nativeProfileAdmission
  if(![object]::ReferenceEquals($Binding,$script:Test125ApiBinding)-or![object]::ReferenceEquals($Binding,$c.activeBinding)-or![object]::ReferenceEquals($Binding.releaseProof,$c.releaseProof)){throw 'B6_TASK_BOUND_LAUNCHER_NOT_OWNED'}
  if($c.token.scope-ceq'TEST125-API-B6-WRITER-20261029'-and$c.token.profileOnlyPurpose-ceq'PackageRefresh'){
   $proof=Get-ErpReadPairReleaseProofContext $c.releaseProof;$proof.seal.Validate();$source=$proof.packageRefreshTaskSource
   return $(if($Binding.admission.supervisor-eq$source.runningSupervisor.pid){$source.runningSupervisor.launcher.path}else{$proof.businessSaleOwnerPins.path})
  }
  $mode=if($config.ApiComponent.ReleaseRoot-ceq$c.token.candidate.ReleaseRoot){'Candidate'}elseif($config.ApiComponent.ReleaseRoot-ceq$c.token.current.ReleaseRoot){'Current'}else{throw 'B6_TASK_BOUND_LAUNCHER_NOT_OWNED'}
  [void](Assert-Test125ReadPairConfig $config $mode -ScopeName $c.token.scope)
  return (Get-Test125MaintenanceTaskLauncher $config -ScopeName $c.token.scope -Mode $mode -PreparedReleaseProof $c.releaseProof)
 }
 return (Join-Path $config.RepoRoot 'scripts\canonical\start-owned-test.ps1')
}
function Assert-Test125ReadPairIssued($Transition){
 $c=$script:Test125ReadPairContext
 if(!$c-or![object]::ReferenceEquals($Transition,$c.token)-or$c.pid-ne$PID-or$c.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or($Transition|ConvertTo-Json -Depth 12 -Compress)-cne$c.tokenJson){throw 'TEST125_READPAIR_NOT_ISSUED'}
 [void](Get-ErpReadPairReleaseProofContext $c.releaseProof)
 if($c.token.scope-ceq'TEST125-API-B6-WRITER-20261029'){
  [void](Assert-ErpBusinessSaleWriterProfileAdmission $c.nativeProfileAdmission -Phase Identity)
  if($Transition.schema-cne$(if((Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission).mode-ceq'PackageRefresh'){'melisa-test125-b6-package-refresh-api-transition.v1'}else{'melisa-test125-b6-writer-api-transition.v1'})-or$Transition.PSObject.Properties['rehearsalOnly']-or$Transition.profileOnlyPurpose-cne(Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission).mode-or@($Transition.PSObject.Properties.Name)[-1]-cne'profileOnlyPurpose'){throw 'TEST125_READPAIR_WRITER_PURPOSE_CHANGED'}
 }
 if($c.token.scope-ceq'TEST125-API-B6-ca620bac-20261028'){
  [void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission -Phase Identity)
  $native=Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission
  if($c.rehearsalOnly-isnot[bool]-or$Transition.rehearsalOnly-isnot[bool]-or$native.rehearsalOnly-isnot[bool]-or$c.rehearsalOnly-ne$Transition.rehearsalOnly-or$c.rehearsalOnly-ne$native.rehearsalOnly){throw 'TEST125_READPAIR_NATIVE_PURPOSE_CHANGED'}
 }
 return $c
}
function Get-Test125ReadPairNativeAuditContext($Transition,$NativeAdmission){
 # Audit only: Unknown native outcomes must remain observable without making
 # Assert-Test125ReadPairIssued or any execution admission accept that phase.
 $c=$script:Test125ReadPairContext
 if(!$c-or![object]::ReferenceEquals($Transition,$c.token)-or$c.pid-ne$PID-or$c.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or($Transition|ConvertTo-Json -Depth 12 -Compress)-cne$c.tokenJson){throw 'TEST125_READPAIR_AUDIT_NOT_ISSUED'}
 [void](Get-ErpReadPairReleaseProofContext $c.releaseProof)
 if($Transition.scope-cnotin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-or![object]::ReferenceEquals($NativeAdmission,$c.nativeProfileAdmission)){throw 'TEST125_READPAIR_AUDIT_NOT_ISSUED'}
 $native=Get-ErpBusinessSaleNativeAdmissionContext $NativeAdmission
 if(![object]::ReferenceEquals($native.transition,$Transition)){throw 'TEST125_READPAIR_AUDIT_NOT_ISSUED'}
 if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'){
  [void](Assert-ErpBusinessSaleWriterProfileAdmission $NativeAdmission -Phase Identity)
  if($Transition.schema-cne$(if((Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission).mode-ceq'PackageRefresh'){'melisa-test125-b6-package-refresh-api-transition.v1'}else{'melisa-test125-b6-writer-api-transition.v1'})-or$Transition.PSObject.Properties['rehearsalOnly']-or$Transition.profileOnlyPurpose-cne(Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission).mode){throw 'TEST125_READPAIR_WRITER_PURPOSE_CHANGED'}
 }elseif($c.rehearsalOnly-isnot[bool]-or$Transition.rehearsalOnly-isnot[bool]-or$native.rehearsalOnly-isnot[bool]-or$c.rehearsalOnly-ne$Transition.rehearsalOnly-or$c.rehearsalOnly-ne$native.rehearsalOnly){throw 'TEST125_READPAIR_NATIVE_PURPOSE_CHANGED'}
 return $c
}
function New-Test125ReadPairTaskActionPlan($Config,$Before,$ReleaseProof,[string]$ScopeName='TEST125-API-B6-ca620bac-20261028'){
 if($ScopeName-cnotin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){throw 'B6_TASK_PLAN_SCOPE_REJECTED'}
 $pins=if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){Get-ErpBusinessSaleWriterTaskLauncherPins $ReleaseProof -Mode Candidate}else{Get-ErpBusinessSaleTaskLauncherPins $ReleaseProof}
 $candidateLauncher=Get-Test125MaintenanceTaskLauncher $Config -ScopeName $ScopeName -Mode Candidate -PreparedReleaseProof $ReleaseProof
 $currentLauncher=if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){Get-Test125MaintenanceTaskLauncher $Config -ScopeName $ScopeName -Mode Current -PreparedReleaseProof $ReleaseProof}else{Get-Test125MaintenanceTaskLauncher $Config}
 $task=Get-Test125ReadPairTask;$xml=[string]$task.Xml;$sddl=[string]$task.GetSecurityDescriptor(7)
 if(!$sddl-or(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($xml)))-cne$Before.taskXmlHash){throw 'B6_TASK_PLAN_BASELINE_CHANGED'}
 $beforeSignature=Get-Test125TaskXmlSignature $xml
 $doc=[Xml.XmlDocument]::new();$doc.PreserveWhitespace=$false;$doc.XmlResolver=$null;$doc.LoadXml($xml)
 $ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
 $actions=@($doc.SelectNodes('/t:Task/t:Actions/*',$ns));$exec=@($doc.SelectNodes('/t:Task/t:Actions/t:Exec',$ns));$argsNodes=@($doc.SelectNodes('/t:Task/t:Actions/t:Exec/t:Arguments',$ns))
 $oldArgs='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$currentLauncher+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
 $newArgs='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$candidateLauncher+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
 if($actions.Count-ne1-or$exec.Count-ne1-or$argsNodes.Count-ne1-or$argsNodes[0].InnerText-cne$oldArgs){throw 'B6_TASK_ACTION_BASELINE_REJECTED'}
 $command=$exec[0].SelectSingleNode('t:Command',$ns);$working=$exec[0].SelectSingleNode('t:WorkingDirectory',$ns)
 $exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
 if(!$command-or!$working-or!(Same-ErpPath $command.InnerText $exe)-or!(Same-ErpPath $working.InnerText $Config.RepoRoot)){throw 'B6_TASK_ACTION_BASELINE_REJECTED'}
 $argsNodes[0].InnerText=$newArgs;$candidateXml=$doc.OuterXml
 $plan=[pscustomobject]@{beforeXml=$xml;beforeHash=$Before.taskXmlHash;beforeSignature=$beforeSignature;candidateSignature=(Get-Test125TaskXmlSignature $candidateXml);sddl=$sddl;sddlHash=(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($sddl)));candidateLauncher=$candidateLauncher;candidateLauncherHash=$pins.sha256.ToUpperInvariant();coreManifestHash=$pins.coreManifestSha256;exe=[string]$command.InnerText;workingDirectory=[string]$working.InnerText;currentArguments=$oldArgs;candidateArguments=$newArgs;mode='Current';observedXmlHash=$Before.taskXmlHash;candidateAttempted=$false;currentAttempted=$false;beforeDurable=$false;unknown=$false}
 if(Test-ErpBusinessSalePackageRefreshGeneration){$proof=Get-ErpReadPairReleaseProofContext $ReleaseProof;if(!$proof.PSObject.Properties['packageRefreshTaskSource']){throw 'B6_PACKAGE_REFRESH_TASK_PROOF_REQUIRED'};$plan|Add-Member maintenanceInstalled $false;$proof|Add-Member packageRefreshTaskState $plan}
 return $plan
}
function Write-Test125ReadPairTaskBeforeImage($Context){
 $c=Assert-Test125ReadPairContext $Context;$p=$c.taskAction
 if(!$c.vault-or!$p){throw 'B6_TASK_BEFOREIMAGE_REQUIRED'}
 for($q=$c.vault;$q;$q=[IO.Path]::GetDirectoryName($q)){if((Get-Item -LiteralPath $q -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_TASK_BEFOREIMAGE_REPARSE'}}
 $acl=Get-Acl -LiteralPath $c.vault;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(!$acl.AreAccessRulesProtected-or$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$c.config.OwnerSid-or$rules.Count-ne2){throw 'B6_TASK_BEFOREIMAGE_ACL'}
 foreach($sid in @($c.config.OwnerSid,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and!$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'B6_TASK_BEFOREIMAGE_ACL'}}
 Add-Type -AssemblyName System.Security
 foreach($entry in @(@('task.before.xml.dpapi',$p.beforeXml),@('task.before.sddl.dpapi',$p.sddl))){
  $path=Join-Path $c.vault $entry[0];$plain=[Text.Encoding]::UTF8.GetBytes([string]$entry[1])
  if(!$p.beforeDurable-and!(Test-Path -LiteralPath $path)){$encrypted=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);$f=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$f.Write($encrypted,0,$encrypted.Length);$f.Flush($true)}finally{$f.Dispose()}}
  if((Get-Item -LiteralPath $path -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_TASK_BEFOREIMAGE_REPARSE'}
  $restored=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  if((Get-Test125ReadPairHash $restored)-cne(Get-Test125ReadPairHash $plain)){throw 'B6_TASK_BEFOREIMAGE_READBACK'}
 }
 $p.beforeDurable=$true
}
function Set-Test125ReadPairTaskAction($Transition,[ValidateSet('Current','Candidate')][string]$Mode){
 $c=Assert-Test125ReadPairIssued $Transition
 if($Transition.scope-cnotin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-or!$c.taskAction-or$c.taskAction.unknown){throw 'B6_TASK_ACTION_OUTCOME_UNKNOWN'}
 $p=$c.taskAction;$b=$c.activeBinding;$nativePhase=if($Mode-ceq'Candidate'){'Applied'}else{'Restored'}
 if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'){
  $writerPhase=if($Mode-ceq'Candidate'){'WriterPrepared'}else{'Identity'}
  [void](Assert-ErpBusinessSaleWriterProfileAdmission $c.nativeProfileAdmission -Phase $writerPhase)
  $writer=Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission
  if($Mode-ceq'Current'-and$writer.phase-cnotin@('WriterPrepared','WriterActivated')){throw 'B6_WRITER_PHASE_REJECTED'}
 }else{[void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission -Phase $nativePhase)}
 if(!$c.taskStopped-or!$c.vault-or!$b-or![object]::ReferenceEquals($b,$script:Test125ApiBinding)-or!$b.held-or!$b.stopped){throw 'B6_TASK_ACTION_NOT_QUIESCENT'}
 Assert-Test125ApiStoppedSupervisor $b;[void](Test-Test125ApiPhysicalPause $b);Assert-Test125ReadPairCompanions $c
 [void](Get-Test125MaintenanceTaskLauncher $c.config -ScopeName $Transition.scope -Mode Candidate -PreparedReleaseProof $c.releaseProof)
 $task=Get-Test125ReadPairTask;$raw=[string]$task.Xml;$sig=Get-Test125TaskXmlSignature $raw;$sddl=[string]$task.GetSecurityDescriptor(7)
 if($task.GetInstances(0).Count-ne0-or(Get-ErpProcess $b.admission.supervisor)-or$sddl-cne$p.sddl-or(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($raw)))-cne$p.observedXmlHash){throw 'B6_TASK_ACTION_CAS_CHANGED'}
 $refresh=$Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'-and$Transition.profileOnlyPurpose-ceq'PackageRefresh'
 $sourceSig=if($refresh-and$p.maintenanceInstalled){$p.candidateSignature}elseif($p.mode-ceq'Current'){$p.beforeSignature}else{$p.candidateSignature};$desiredSig=if($refresh){$p.candidateSignature}elseif($Mode-ceq'Current'){$p.beforeSignature}else{$p.candidateSignature}
 if($sig-cne$sourceSig){throw 'B6_TASK_ACTION_CAS_CHANGED'}
 Write-Test125ReadPairTaskBeforeImage $c
 if($refresh-and$sourceSig-ceq$desiredSig){$p.mode=$Mode;return}
 if(!$refresh-and$p.mode-ceq$Mode){return}
 $attemptKey=if($Mode-ceq'Candidate'){'candidateAttempted'}else{'currentAttempted'}
 if($p.$attemptKey){throw 'B6_TASK_ACTION_ALREADY_ATTEMPTED'}
 $argsText=if($refresh-or$Mode-ceq'Candidate'){$p.candidateArguments}else{$p.currentArguments}
 $action=New-ScheduledTaskAction -Execute $p.exe -Argument $argsText -WorkingDirectory $p.workingDirectory
 # DPAPI persistence must not leave a stale task observation at the write.
 Assert-Test125ApiStoppedSupervisor $b;[void](Test-Test125ApiPhysicalPause $b);Assert-Test125ReadPairCompanions $c
 $last=Get-Test125ReadPairTask
 if($last.GetInstances(0).Count-ne0-or(Get-ErpProcess $b.admission.supervisor)-or[string]$last.GetSecurityDescriptor(7)-cne$p.sddl-or(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$last.Xml)))-cne$p.observedXmlHash){throw 'B6_TASK_ACTION_CAS_CHANGED'}
 # Mark before the supported write. An ACK failure permits only readback;
 # neither a second Set nor a caller-supplied XML can repair an unknown task.
 $p.$attemptKey=$true
 try{Set-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\' -Action $action -ErrorAction Stop|Out-Null}catch{}
 try{
  $after=Get-Test125ReadPairTask;$afterRaw=[string]$after.Xml;$afterSig=Get-Test125TaskXmlSignature $afterRaw
  if([string]$after.GetSecurityDescriptor(7)-cne$p.sddl-or$after.GetInstances(0).Count-ne0){throw 'B6_TASK_ACTION_OUTCOME_UNKNOWN'}
  if($afterSig-ceq$desiredSig){
   if($refresh){$p.maintenanceInstalled=$true}
   $p.mode=$Mode;$p.observedXmlHash=Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($afterRaw))
   $a=$c.admission|ConvertTo-Json -Depth 32|ConvertFrom-Json;$a.taskXmlHash=$p.observedXmlHash;$c.admission=$a;$b.admission=$a;$c.admissionJson=($a|ConvertTo-Json -Depth 32 -Compress)
   return
  }
  if($afterSig-ceq$sourceSig-and(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($afterRaw)))-ceq$p.observedXmlHash){throw 'B6_TASK_ACTION_NOT_APPLIED'}
  throw 'B6_TASK_ACTION_OUTCOME_UNKNOWN'
 }catch{
  if($_.Exception.Message-ceq'B6_TASK_ACTION_NOT_APPLIED'){throw}
  $p.unknown=$true;throw 'B6_TASK_ACTION_OUTCOME_UNKNOWN'
 }
}
function New-Test125ReadPairTransition([string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',$NativeProfileAdmission=$null) {
 if($PSVersionTable.PSEdition-cne'Desktop'){throw 'TEST125_WINDOWS_POWERSHELL_REQUIRED'}
 if($script:Test125ReadPairContext-or$script:Test125ApiBinding){throw 'TEST125_READPAIR_ALREADY_ISSUED'}
 $scope=Get-Test125ReadPairScope -Name $ScopeName
 $rehearsalOnly=$false
 $packageRefresh=$scope.name-ceq'TEST125-API-B6-WRITER-20261029'-and(Get-ErpBusinessSaleNativeAdmissionContext $NativeProfileAdmission).mode-ceq'PackageRefresh'
 if($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){[void](Assert-ErpBusinessSaleWriterProfileAdmission $NativeProfileAdmission -Phase WriterPrepared)}
 elseif($scope.name-ceq'TEST125-API-B6-ca620bac-20261028'){
  [void](Assert-ErpBusinessSaleNativeProfileAdmission $NativeProfileAdmission -Phase Prepared)
  $validatedNativeAdmission=Get-ErpBusinessSaleNativeAdmissionContext $NativeProfileAdmission
  if($validatedNativeAdmission.rehearsalOnly-isnot[bool]){throw 'TEST125_READPAIR_NATIVE_PURPOSE_CHANGED'}
  $rehearsalOnly=$validatedNativeAdmission.rehearsalOnly
 }elseif($null-ne$NativeProfileAdmission){throw 'TEST125_READPAIR_NATIVE_SCOPE_REJECTED'}
 $writerReleaseProof=$null;$releaseProof=$null
 try{
 if($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){$preConfig=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json';$writerReleaseProof=New-ErpReadPairPreparedReleaseProof $preConfig -ScopeName $scope.name -NativeProfileAdmission $NativeProfileAdmission;$releaseProof=$writerReleaseProof}
 $before=if($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){Get-Test125BoundMaintenancePlan -RunId $scope.name -ReadPairPreparation -PreparedReleaseProof $writerReleaseProof}else{Get-Test125BoundMaintenancePlan -RunId $scope.name -ReadPairPreparation}
 $path='C:\Sirket\ERP\runtime\canonical-test\startup-config.json';$config=Read-ErpStartupConfig $path;[void](Assert-Test125ReadPairConfig $config Current -ScopeName $scope.name)
 $bytes=[IO.File]::ReadAllBytes($path);if((Get-Test125ReadPairHash $bytes)-cne$before.startupHash.ToLowerInvariant()){throw 'TEST125_READPAIR_STARTUP_DRIFT'}
 $next=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json;$next.ApiComponent.ReleaseRoot=$scope.candidate.ReleaseRoot;$next.ApiComponent.ManifestSha256=$scope.candidate.ManifestSha256
 $comparison=$next.PSObject.Copy();$comparison.ApiComponent=$config.ApiComponent
 if(($comparison|ConvertTo-Json -Depth 100 -Compress)-cne($config|ConvertTo-Json -Depth 100 -Compress)){throw 'TEST125_READPAIR_DELTA_REJECTED'}
 $candidate=Get-ErpApiComponentConfig $next;$manifest=Assert-ErpRelease $candidate
 $apiPath=$scope.current.ConfigPath;$apiBefore=[IO.File]::ReadAllBytes($apiPath);$api=[Text.Encoding]::UTF8.GetString($apiBefore)|ConvertFrom-Json
 if($scope.name-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  $expectedOldSeal=if($packageRefresh){'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'}elseif($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'}else{'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'}
  if($api.goal8SyntheticDaySeal.packageId-cne$expectedOldSeal){throw 'TEST125_READPAIR_OLD_SEAL_CHANGED'}
  [byte[]]$apiCandidate=Get-ErpBusinessSaleCandidateProfileBytes $NativeProfileAdmission
  if(!$apiCandidate-or!$apiCandidate.Length){throw 'TEST125_B6_CANDIDATE_PROFILE_REQUIRED'}
  $apiNext=[Text.Encoding]::UTF8.GetString($apiCandidate)|ConvertFrom-Json
 }else{
  if($api.goal8SyntheticDaySeal.packageId-cne'CANONICAL-TEST125-BUSINESS5244-10cdc0ee'){throw 'TEST125_READPAIR_OLD_SEAL_CHANGED'}
  $apiNext=[Text.Encoding]::UTF8.GetString($apiBefore)|ConvertFrom-Json;$apiNext.goal8SyntheticDaySeal.packageId=$manifest.packageId
  $apiCompare=[Text.Encoding]::UTF8.GetString($apiBefore)|ConvertFrom-Json;$apiCompare.goal8SyntheticDaySeal.packageId=$manifest.packageId
  if(($apiNext|ConvertTo-Json -Depth 100 -Compress)-cne($apiCompare|ConvertTo-Json -Depth 100 -Compress)){throw 'TEST125_READPAIR_PROFILE_DELTA'}
  $apiCandidate=[Text.Encoding]::UTF8.GetBytes(($apiNext|ConvertTo-Json -Depth 100))
 }
 $baseProfileBytes=[IO.File]::ReadAllBytes($config.ConfigPath)
 Assert-ErpApiPrivateProfile ([Text.Encoding]::UTF8.GetString($baseProfileBytes)|ConvertFrom-Json) $apiNext $manifest
 $nextBytes=[Text.Encoding]::UTF8.GetBytes(($next|ConvertTo-Json -Depth 100))
 $releaseProof=$writerReleaseProof
 $releaseProof=if($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){$writerReleaseProof}elseif($scope.name-ceq'TEST125-API-B6-ca620bac-20261028'){New-ErpReadPairPreparedReleaseProof $config -ScopeName $scope.name -NativeProfileAdmission $NativeProfileAdmission}else{New-ErpReadPairPreparedReleaseProof $config};$releasePins=Get-ErpReadPairReleaseProofPins $releaseProof
 $taskAction=if($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){New-Test125ReadPairTaskActionPlan $config $before $releaseProof -ScopeName $scope.name}elseif($scope.name-ceq'TEST125-API-B6-ca620bac-20261028'){New-Test125ReadPairTaskActionPlan $config $before $releaseProof}else{$null}
 $token=[pscustomobject][ordered]@{schema=$(if($packageRefresh){'melisa-test125-b6-package-refresh-api-transition.v1'}elseif($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){'melisa-test125-b6-writer-api-transition.v1'}elseif($scope.name-ceq'TEST125-API-B6-ca620bac-20261028'){'melisa-test125-b6-api-transition.v1'}else{'melisa-test125-read2b-api-transition.v1'});packageProof=$releasePins;scope=$scope.name;source=$scope.source;database=$scope.database;current=$scope.current;candidate=$scope.candidate;apiProfileBeforeSha256=(Get-Test125ReadPairHash $apiBefore);apiProfileCandidateSha256=(Get-Test125ReadPairHash $apiCandidate);baseProfileSha256=(Get-Test125ReadPairHash $baseProfileBytes);startupBeforeSha256=(Get-Test125ReadPairHash $bytes);startupCandidateSha256=(Get-Test125ReadPairHash $nextBytes);apiPort=4144;preservedPorts=@(4146,5194);runtimeApplied=$false}
 if($scope.name-ceq'TEST125-API-B6-ca620bac-20261028'){$token|Add-Member rehearsalOnly ([bool]$rehearsalOnly)}
 if($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){$token|Add-Member profileOnlyPurpose $(if($packageRefresh){'PackageRefresh'}else{'WriterProfileActivation'})}
 $script:Test125ReadPairContext=[pscustomobject]@{token=$token;tokenJson=($token|ConvertTo-Json -Depth 12 -Compress);releaseProof=$releaseProof;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;mode='Current';phase='PREPARED';admission=$before;admissionJson=($before|ConvertTo-Json -Depth 32 -Compress);baseline=$before;config=$config;startupPath=$path;beforeBytes=$bytes;candidateBytes=$nextBytes;apiPath=$apiPath;apiBefore=$apiBefore;apiCandidate=$apiCandidate;apiChanged=$false;activeBinding=$null;taskStopped=$false;manifest=$manifest;changed=$false;vault=$null;resumedEngine=$null;resumedInstance=$null;resumedBirth=$null;candidateAttempted=$false;failedStartProof=$null;requestAdmission=$null;nativeProfileAdmission=$NativeProfileAdmission;nativeChangeAttempted=$false;nativeApplied=$false}
 $script:Test125ReadPairContext|Add-Member taskAction $taskAction
 $script:Test125ReadPairContext|Add-Member rehearsalOnly ([bool]$rehearsalOnly)
 $script:Test125ReadPairContext|Add-Member rehearsalAttempted $false
 if($scope.name-ceq'TEST125-API-B6-WRITER-20261029'){[void](Bind-ErpBusinessSaleWriterProfile $NativeProfileAdmission $token)}
 if($scope.name-ceq'TEST125-API-B6-ca620bac-20261028'){[void](Bind-ErpBusinessSaleNativeProfileTransition $NativeProfileAdmission $token)}
 return $token
 }catch{
  $script:Test125ReadPairContext=$null
  if($releaseProof){Close-ErpReadPairReleaseProof $releaseProof}
  throw
 }
}
function Assert-Test125ReadPairTransition($Transition,[ValidateSet('Current','Candidate')][string]$Mode='Current'){
 $c=Assert-Test125ReadPairIssued $Transition
 if($c.mode-cne$Mode-or$c.phase-cnotin@('PREPARED','VERIFIED')){throw 'TEST125_READPAIR_PHASE_REJECTED'}
 if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'){
  $writer=Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission
  $writerPhase=if($Mode-ceq'Candidate'){'WriterActivated'}elseif($writer.phase-ceq'WriterRestored'){'WriterRestored'}else{'WriterPrepared'}
  [void](Assert-ErpBusinessSaleWriterProfileAdmission $c.nativeProfileAdmission -Phase $writerPhase)
 }
 if($Transition.scope-ceq'TEST125-API-B6-ca620bac-20261028'){
  $nativePhase=if($Mode-ceq'Candidate'){'Applied'}elseif($c.nativeChangeAttempted){'Restored'}else{'Prepared'}
  [void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission -Phase $nativePhase)
 }
 $config=Read-ErpStartupConfig $c.startupPath -PreparedReleaseProof $c.releaseProof;[void](Assert-Test125ReadPairConfig $config $Mode -ScopeName $Transition.scope)
 $expected=if($Mode-ceq'Current'){$Transition.startupBeforeSha256}else{$Transition.startupCandidateSha256}
 if((Get-FileHash -LiteralPath $c.startupPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$expected){throw 'TEST125_READPAIR_STARTUP_DRIFT'}
 $apiExpected=if($Mode-ceq'Current'){$Transition.apiProfileBeforeSha256}else{$Transition.apiProfileCandidateSha256}
 if((Get-FileHash -LiteralPath $c.apiPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$apiExpected-or(Get-FileHash -LiteralPath $config.ConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$Transition.baseProfileSha256){throw 'TEST125_READPAIR_PROFILE_DRIFT'}
 $fresh=Get-Test125BoundMaintenancePlan -RunId $Transition.scope -ReadPairPreparation -ReadPairMode $Mode -PreparedReleaseProof $c.releaseProof
 foreach($name in @('native','web')){if(($fresh.children.$name|ConvertTo-Json -Depth 8 -Compress)-cne($c.baseline.children.$name|ConvertTo-Json -Depth 8 -Compress)){throw 'TEST125_READPAIR_COMPANION_CHANGED'}}
 $stableKeys=if($c.taskAction){@('source','database','manifestHash')}else{@('source','database','launcherHash','manifestHash','taskXmlHash')}
 foreach($key in $stableKeys){if($fresh.$key-cne$c.baseline.$key){throw 'TEST125_READPAIR_BOUNDARY_CHANGED'}}
 if($c.taskAction){$expectedLauncherHash=if(($c.token.scope-ceq'TEST125-API-B6-WRITER-20261029'-and$c.token.profileOnlyPurpose-ceq'PackageRefresh'-and$c.taskAction.maintenanceInstalled)-or$Mode-ceq'Candidate'){$c.taskAction.candidateLauncherHash}else{$c.baseline.launcherHash};if($c.taskAction.unknown-or$c.taskAction.mode-cne$Mode-or$fresh.launcherHash-cne$expectedLauncherHash-or$fresh.taskXmlHash-cne$c.taskAction.observedXmlHash){throw 'B6_TASK_ACTION_BOUNDARY_CHANGED'}}
 if($c.taskAction-and[string](Get-Test125ReadPairTask).GetSecurityDescriptor(7)-cne$c.taskAction.sddl){throw 'B6_TASK_ACTION_BOUNDARY_CHANGED'}
 Assert-Test125MaintenancePin $c.admission $fresh
 return $true
}

# Pre-nonce only. Query/Synchronize handles retain the exact already admitted
# kernel objects but possess no process-termination right or mutation authority.
function Assert-Test125ReadPairRequestPhase($Context){
 $c=Assert-Test125ReadPairContext $Context
 if($c.mode-cne'Current'-or$c.phase-cne'PREPARED'-or$null-ne$c.activeBinding){throw 'TEST125_READPAIR_REQUEST_PHASE_REJECTED'}
 foreach($key in @('changed','apiChanged','taskStopped','candidateAttempted')){if($c.$key-isnot[bool]-or$c.$key){throw 'TEST125_READPAIR_REQUEST_PHASE_REJECTED'}}
 return $c
}
function Prepare-Test125ReadPairRequestAdmission($Transition){
 $c=Assert-Test125ReadPairIssued $Transition;[void](Assert-Test125ReadPairRequestPhase $c)
 if($c.requestAdmission){throw 'TEST125_READPAIR_REQUEST_ALREADY_PREPARED'}
 [void](Assert-Test125ReadPairTransition $Transition Current)
 Initialize-Test125ApiKernel
 if(![Test125ApiKernel].GetMethod('QueryOnlyOpen')-or![Test125ApiKernel].GetMethod('ValidateReadOnly')){throw 'TEST125_READPAIR_REQUEST_NATIVE_GENERATION_REQUIRED'}
 $records=[Collections.ArrayList]::new();$pids=[Collections.Generic.HashSet[int]]::new()
 try{
  foreach($role in @('supervisor','api','native','web')){
   $row=if($role-ceq'supervisor'){[pscustomobject]@{pid=$c.admission.supervisor;birth=$c.admission.supervisorBirth}}else{$c.admission.children.$role}
   $number=[int]$row.pid;$birth=([datetime]$row.birth).ToUniversalTime().Ticks
   if($number-le0-or!$pids.Add($number)){throw 'TEST125_READPAIR_REQUEST_PROCESS_DUPLICATE'}
   $handle=[Test125ApiKernel]::QueryOnlyOpen($number,$birth)
   [void]$records.Add([pscustomobject]@{role=$role;pid=$number;birth=$birth;handle=$handle})
  }
  # Full pre-request validation closes capture races in SID/argv/ports/task
  # identity before an admission is published or any nonce is opened.
  [void](Assert-Test125ReadPairTransition $Transition Current)
  foreach($row in $records){[Test125ApiKernel]::ValidateReadOnly($row.handle,$row.birth)}
  $cap=[pscustomobject]@{transition=$Transition;context=$c;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;admissionJson=$c.admissionJson;records=$records;closed=$false}
  $recordPins=@($records|ForEach-Object{[pscustomobject]@{role=$_.role;pid=$_.pid;birth=$_.birth}})
  [void]$script:Test125ReadPairRequestAdmissions.Add([pscustomobject]@{cap=$cap;admissionJson=$c.admissionJson;recordJson=($recordPins|ConvertTo-Json -Depth 8 -Compress);handles=@($records|ForEach-Object{$_.handle})})
  $c.requestAdmission=$cap
  return [pscustomobject]@{status='READ_ONLY_REQUEST_ADMISSION_PREPARED';processes=4;runtimeMutation=$false}
 }catch{foreach($row in $records){$row.handle.Dispose()};throw}
}
function Assert-Test125ReadPairRequestAdmission($Transition){
 $c=Assert-Test125ReadPairIssued $Transition;[void](Assert-Test125ReadPairRequestPhase $c)
 $cap=$c.requestAdmission;$issued=$null;foreach($row in $script:Test125ReadPairRequestAdmissions){if([object]::ReferenceEquals($row.cap,$cap)){$issued=$row;break}}
 if(!$issued-or!$cap-or$cap.closed-isnot[bool]-or$cap.closed-or![object]::ReferenceEquals($cap.transition,$Transition)-or![object]::ReferenceEquals($cap.context,$c)-or$cap.pid-ne$PID-or$cap.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$cap.admissionJson-cne$issued.admissionJson-or$c.admissionJson-cne$issued.admissionJson-or($c.admission|ConvertTo-Json -Depth 32 -Compress)-cne$c.admissionJson){throw 'TEST125_READPAIR_REQUEST_NOT_ISSUED'}
 $recordPins=@($cap.records|ForEach-Object{[pscustomobject]@{role=$_.role;pid=$_.pid;birth=$_.birth}})
 if($cap.records.Count-ne4-or($recordPins|ConvertTo-Json -Depth 8 -Compress)-cne$issued.recordJson){throw 'TEST125_READPAIR_REQUEST_PROCESS_CHANGED'}
 for($i=0;$i-lt4;$i++){if(![object]::ReferenceEquals($cap.records[$i].handle,$issued.handles[$i])){throw 'TEST125_READPAIR_REQUEST_HANDLE_CHANGED'};[Test125ApiKernel]::ValidateReadOnly($cap.records[$i].handle,$cap.records[$i].birth)}
 # Exactly one prepared startup read: immutable package identity/seal and fresh
 # owner/source/node/manifest/private-profile validation stay mandatory.
 $config=Read-ErpStartupConfig $c.startupPath -PreparedReleaseProof $c.releaseProof;[void](Assert-Test125ReadPairConfig $config Current -ScopeName $Transition.scope)
 foreach($entry in @(@($c.startupPath,$Transition.startupBeforeSha256),@($c.apiPath,$Transition.apiProfileBeforeSha256),@($config.ConfigPath,$Transition.baseProfileSha256))){if((Get-FileHash -LiteralPath $entry[0] -Algorithm SHA256).Hash.ToLowerInvariant()-cne$entry[1]){throw 'TEST125_READPAIR_REQUEST_FILE_CHANGED'}}
 $requestLauncher=if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'){Get-Test125MaintenanceTaskLauncher $config -ScopeName $Transition.scope -Mode Current -PreparedReleaseProof $c.releaseProof}else{Join-Path $config.RepoRoot 'scripts\canonical\start-owned-test.ps1'}
 if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'-and$Transition.profileOnlyPurpose-ceq'PackageRefresh'){$proof=Get-ErpReadPairReleaseProofContext $c.releaseProof;$proof.seal.Validate();$requestLauncher=$proof.packageRefreshTaskSource.runningSupervisor.launcher.path}
 if((Get-FileHash -LiteralPath $requestLauncher -Algorithm SHA256).Hash-cne$c.baseline.launcherHash){throw 'TEST125_READPAIR_REQUEST_LAUNCHER_CHANGED'}
 # The supervisor's mutable ownership journal stays fresh. Compare semantic
 # identity, not a raw heartbeat hash; never defer drift until after web stop.
 $owned=Get-Content -LiteralPath (Join-Path $config.RuntimeDir 'owned-processes.json') -Raw|ConvertFrom-Json
 if($owned.sourceCommit-cne$config.SourceCommit-or$owned.supervisor-ne$c.admission.supervisor-or([datetime]$owned.startedAt).ToUniversalTime()-lt([datetime]$c.admission.supervisorBirth).ToUniversalTime()){throw 'TEST125_READPAIR_REQUEST_OWNED_RECORD_CHANGED'}
 foreach($role in @('api','native','web')){
  $row=$owned.children.$role;$expected=$c.admission.children.$role
  if($row.pid-ne$expected.pid-or![Test125ApiKernel]::MatchesCim(([datetime]$row.createdAt).ToUniversalTime().Ticks,([datetime]$expected.birth).ToUniversalTime().Ticks)){throw 'TEST125_READPAIR_REQUEST_OWNED_RECORD_CHANGED'}
 }

 $task=Get-Test125ReadPairTask;$instances=$task.GetInstances(0)
 if((Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-cne$c.admission.taskXmlHash-or$instances.Count-ne1-or[int]$instances.Item(1).EnginePID-ne$c.admission.supervisor-or[string]$instances.Item(1).InstanceGuid-cne$c.admission.taskInstance){throw 'TEST125_READPAIR_REQUEST_TASK_CHANGED'}
 $tcpErrors=@();$listeners=@(Get-NetTCPConnection -State Listen -LocalPort @(4144,4146,5194) -ErrorAction SilentlyContinue -ErrorVariable +tcpErrors)
 foreach($err in $tcpErrors){if($err.CategoryInfo.Category-ne[Management.Automation.ErrorCategory]::ObjectNotFound){throw 'TEST125_READPAIR_REQUEST_TCP_UNAVAILABLE'}}
 $private=Get-Content -LiteralPath $config.ConfigPath -Raw|ConvertFrom-Json;$lan=if($private.PSObject.Properties['lanHost']){[string]$private.lanHost}else{''}
 foreach($definition in Get-ErpServiceDefinitions $config){
  $expected=$c.admission.children.($definition.Name);$rows=@($listeners|Where-Object{$_.LocalPort-eq$definition.Port})
  if(!$rows.Count-or@($rows|Where-Object{$_.OwningProcess-ne$expected.pid-or($_.LocalAddress-cne'127.0.0.1'-and!($definition.Name-cne'native'-and$lan-and$_.LocalAddress-ceq$lan))}).Count){throw 'TEST125_READPAIR_REQUEST_PORT_CHANGED'}
  $health=Assert-ErpHealth $config $definition
  if($definition.Name-ceq'native'-and($health.sqlReadOnly-ne$true-or$health.sysadmin-ne0)){throw 'TEST125_READPAIR_REQUEST_NATIVE_NOT_READONLY'}
 }
 foreach($row in $cap.records){[Test125ApiKernel]::ValidateReadOnly($row.handle,$row.birth)}
 return $true
}
function Close-Test125ReadPairRequestAdmission($Transition){
 $c=Assert-Test125ReadPairIssued $Transition;$cap=$c.requestAdmission
 if(!$cap){return};$issued=$null;foreach($row in $script:Test125ReadPairRequestAdmissions){if([object]::ReferenceEquals($row.cap,$cap)){$issued=$row;break}}
 if(!$issued-or![object]::ReferenceEquals($cap.transition,$Transition)-or![object]::ReferenceEquals($cap.context,$c)){throw 'TEST125_READPAIR_REQUEST_NOT_ISSUED'}
 if(!$cap.closed){foreach($handle in $issued.handles){$handle.Dispose()};$cap.closed=$true}
}
function Get-Test125ReadPairTransitionContract($Transition){
 $c=Assert-Test125ReadPairIssued $Transition
 return [pscustomobject]@{scope=$Transition.scope;contractSha256=(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($c.tokenJson)));mode=$c.mode;phase=$c.phase;runtimeApplied=($c.mode-ceq'Candidate')}
}
function Write-Test125ReadPairCas([string]$Path,[string]$Expected,[byte[]]$Bytes){
 foreach($q in @($Path)){for($part=$q;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'TEST125_READPAIR_REPARSE'}}}
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{$m=[IO.MemoryStream]::new();$stream.CopyTo($m);$old=$m.ToArray();$m.Dispose();if((Get-Test125ReadPairHash $old)-cne$Expected){throw 'TEST125_READPAIR_CAS_CHANGED'}
  try{$stream.Position=0;$stream.SetLength($Bytes.Length);$stream.Write($Bytes,0,$Bytes.Length);$stream.Flush($true)}catch{$stream.Position=0;$stream.SetLength($old.Length);$stream.Write($old,0,$old.Length);$stream.Flush($true);throw}
 }finally{$stream.Dispose()}
}
function Get-Test125ReadPairTask {
 $scheduler=New-Object -ComObject Schedule.Service;$scheduler.Connect();return $scheduler.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
}
function Assert-Test125ReadPairCompanions($Context){
 $c=$Context.config;$a=$Context.baseline
 foreach($name in @('native','web')){$d=@(Get-ErpServiceDefinitions $c|Where-Object{$_.Name-ceq$name})[0];$p=Assert-ErpOwnedProcess $a.children.$name.pid $c $d $a.children.$name.birth
  if(!$p){throw 'TEST125_READPAIR_COMPANION_CHANGED'};$listeners=@(Get-ErpServiceListeners $d $c);if(!$listeners.Count-or@($listeners|Where-Object{$_.OwningProcess-ne$p.ProcessId}).Count){throw 'TEST125_READPAIR_COMPANION_PORT_CHANGED'}
  $health=Assert-ErpHealth $c $d;if($name-ceq'native'-and($health.sqlReadOnly-ne$true-or$health.sysadmin-ne0)){throw 'TEST125_READPAIR_NATIVE_NOT_READONLY'}
 }
}
function Assert-Test125ReadPairPaused($Context){
 $c=$Context;$b=$c.activeBinding
 if(!$b-or![object]::ReferenceEquals($b,$script:Test125ApiBinding)-or!$b.held-or!$b.stopped-or![Test125ApiKernel]::Exited($b.handle,$b.birth)){throw 'TEST125_READPAIR_PAUSE_NOT_OWNED'}
 $task=Get-Test125ReadPairTask
 if((Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-cne$c.admission.taskXmlHash-or$task.GetInstances(0).Count-ne0-or(Get-ErpProcess $b.admission.supervisor)){throw 'TEST125_READPAIR_TASK_NOT_PAUSED'}
 if($c.taskAction-and($c.taskAction.unknown-or[string]$task.GetSecurityDescriptor(7)-cne$c.taskAction.sddl)){throw 'B6_TASK_ACTION_BOUNDARY_CHANGED'}
 $expected=if($c.changed){$c.token.startupCandidateSha256}else{$c.token.startupBeforeSha256}
 $launcher=Get-Test125ReadPairBindingLauncher $b
 if((Get-FileHash -LiteralPath $c.startupPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$expected-or(Get-FileHash -LiteralPath $launcher -Algorithm SHA256).Hash-cne$b.admission.launcherHash){throw 'TEST125_READPAIR_PAUSED_CONFIG_DRIFT'}
 $apiExpected=if($c.apiChanged){$c.token.apiProfileCandidateSha256}else{$c.token.apiProfileBeforeSha256}
 if((Get-FileHash -LiteralPath $c.apiPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$apiExpected){throw 'TEST125_READPAIR_PAUSED_PROFILE_DRIFT'}
 if(@(Get-NetTCPConnection -State Listen -LocalPort 4144 -ErrorAction SilentlyContinue).Count){throw 'TEST125_READPAIR_API_NOT_EMPTY'}
 Assert-Test125ReadPairCompanions $c
}

function Assert-Test125ReadPairWriterPostCasPause($Transition,[ValidateSet('Candidate','Rollback')][string]$Mode){
 if($Mode-cnotin@('Candidate','Rollback')){throw 'B6_WRITER_PAIR_MODE_REJECTED'}
 $c=Assert-Test125ReadPairIssued $Transition
 if($Transition.scope-cne'TEST125-API-B6-WRITER-20261029'-or$Transition.profileOnlyPurpose-cnotin@('WriterProfileActivation','PackageRefresh')){throw 'B6_WRITER_POST_CAS_NOT_ISSUED'}
 $n=Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission
 if($n.mode-cne$Transition.profileOnlyPurpose-or![object]::ReferenceEquals($n.transition,$Transition)){throw 'B6_WRITER_POST_CAS_NOT_ISSUED'}
 $b=$c.activeBinding;$destination=if($Mode-ceq'Candidate'){'Candidate'}else{'Current'};$candidate=$Mode-ceq'Candidate'
 if(!$b-or![object]::ReferenceEquals($b,$script:Test125ApiBinding)-or![object]::ReferenceEquals($b.releaseProof,$c.releaseProof)-or!$c.taskStopped-or!$c.vault-or$c.changed-isnot[bool]-or$c.apiChanged-isnot[bool]-or$c.changed-ne$candidate-or$c.apiChanged-ne$($candidate-and$n.mode-cne'PackageRefresh')-or!$c.taskAction-or$c.taskAction.unknown-or$c.taskAction.mode-cne$destination){throw 'B6_WRITER_POST_CAS_NOT_PAUSED'}
 [void](Assert-Test125ReadPairPaused $c)
 $proof=Get-ErpReadPairReleaseProofContext $c.releaseProof;$proof.seal.Validate()
 $config=Read-ErpStartupConfig $c.startupPath -PreparedReleaseProof $c.releaseProof
 [void](Assert-Test125ReadPairConfig $config $destination -ScopeName $Transition.scope)
 foreach($entry in @(@($c.startupPath,$(if($candidate){$Transition.startupCandidateSha256}else{$Transition.startupBeforeSha256})),@($c.apiPath,$(if($candidate){$Transition.apiProfileCandidateSha256}else{$Transition.apiProfileBeforeSha256})),@($config.ConfigPath,$Transition.baseProfileSha256))){if((Get-FileHash -LiteralPath $entry[0] -Algorithm SHA256).Hash.ToLowerInvariant()-cne$entry[1]){throw 'B6_WRITER_POST_CAS_FILE_CHANGED'}}
 return $c
}

function Assert-Test125ReadPairContext($Context){
 try{$registered=Assert-Test125ReadPairIssued $Context.token;if(![object]::ReferenceEquals($Context,$registered)){throw 'TEST125_READPAIR_NOT_ISSUED'};return $registered}catch{throw 'TEST125_READPAIR_NOT_ISSUED'}
}
# Unhealthy is not unowned. This finite recovery read grants no authority from
# a PID alone: it requires the COM instance observed after this invocation's
# supported Start request and the exact candidate config and publication.
function Get-Test125ReadPairFailedStartEvidence($Context){
 $c=Assert-Test125ReadPairContext $Context
 try{
 $t=$c.token
 $packageRefresh=$t.scope-ceq'TEST125-API-B6-WRITER-20261029'-and$t.profileOnlyPurpose-ceq'PackageRefresh'
 if($c.mode-cne'Candidate'-or!$c.changed-or(!$packageRefresh-and!$c.apiChanged)-or($packageRefresh-and$c.apiChanged)-or!$c.resumedEngine-or!$c.resumedInstance-or!$c.resumedBirth-or$c.resumedEngine-eq$c.baseline.supervisor){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $config=Read-ErpStartupConfig $c.startupPath -PreparedReleaseProof $c.releaseProof;[void](Assert-Test125ReadPairConfig $config Candidate -ScopeName $t.scope)
 foreach($entry in @(@($c.startupPath,$t.startupCandidateSha256),@($c.apiPath,$t.apiProfileCandidateSha256),@($config.ConfigPath,$t.baseProfileSha256))){if((Get-FileHash -LiteralPath $entry[0] -Algorithm SHA256).Hash.ToLowerInvariant()-cne$entry[1]){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}}
 $launcher=Get-Test125MaintenanceTaskLauncher $config -ScopeName $t.scope -Mode Candidate -PreparedReleaseProof $c.releaseProof
 $launcherHash=if($c.taskAction){$c.taskAction.candidateLauncherHash}else{$c.baseline.launcherHash}
 if((Get-FileHash -LiteralPath $launcher -Algorithm SHA256).Hash-cne$launcherHash){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $task=Get-Test125ReadPairTask;$instances=$task.GetInstances(0)
 if((Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-cne$c.admission.taskXmlHash-or$instances.Count-ne1-or[int]$instances.Item(1).EnginePID-ne$c.resumedEngine-or[string]$instances.Item(1).InstanceGuid-cne$c.resumedInstance){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $taskAction=if($c.taskAction){Assert-Test125MaintenanceTask (Get-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\' -ErrorAction Stop) $config $c.startupPath -ScopeName $t.scope -Mode Candidate -PreparedReleaseProof $c.releaseProof}else{Assert-Test125MaintenanceTask (Get-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\' -ErrorAction Stop) $config $c.startupPath}
 $supervisor=Get-ErpProcess $c.resumedEngine
 if(!$supervisor-or$supervisor-isnot[Microsoft.Management.Infrastructure.CimInstance]-or$supervisor.CimSystemProperties.ClassName-cne'Win32_Process'-or$supervisor.CreationDate.ToUniversalTime().Ticks-ne$c.resumedBirth){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $sid=Invoke-CimMethod -InputObject $supervisor -MethodName GetOwnerSid
 $remaining=[regex]::Replace([string]$supervisor.CommandLine,('^"?'+[regex]::Escape($taskAction.Executable)+'"?\s+'),'')
 if($sid.ReturnValue-ne0-or$sid.Sid-cne$config.OwnerSid-or!(Same-ErpPath $supervisor.ExecutablePath $taskAction.Executable)-or$remaining-cne$taskAction.Arguments){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $recordPath=Join-Path $config.RuntimeDir 'owned-processes.json'
 for($q=$recordPath;$q;$q=[IO.Path]::GetDirectoryName($q)){if((Get-Item -LiteralPath $q -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}}
 $recordBytes=[IO.File]::ReadAllBytes($recordPath);$record=[Text.Encoding]::UTF8.GetString($recordBytes)|ConvertFrom-Json
 if($record.sourceCommit-cne$t.source-or[int]$record.supervisor-ne$c.resumedEngine){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 foreach($name in @('native','web')){if([int]$record.children.$name.pid-ne$c.baseline.children.$name.pid-or([datetime]$record.children.$name.createdAt).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')-cne([datetime]$c.baseline.children.$name.birth).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}}
 Assert-Test125ReadPairCompanions $c
 $definition=@(Get-ErpServiceDefinitions $config|Where-Object{$_.Name-ceq'api'})
 if($definition.Count-ne1-or$definition[0].Port-ne4144-or[int]$record.children.api.pid-le0-or!$record.children.api.createdAt){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $api=Assert-ErpOwnedProcess $record.children.api.pid $config $definition[0] $record.children.api.createdAt
 $listeners=@(Get-ErpServiceListeners $definition[0] $config)
 if($api){
  $expectedArgs=@($definition[0].Script)+$definition[0].Args|ForEach-Object{'"'+[regex]::Escape([string]$_)+'"'}
  $exactCommand='^"?'+[regex]::Escape($config.NodePath)+'"?[ \t]+'+($expectedArgs-join'[ \t]+')+'$'
  if($api-isnot[Microsoft.Management.Infrastructure.CimInstance]-or$api.CimSystemProperties.ClassName-cne'Win32_Process'-or$api.ParentProcessId-ne$c.resumedEngine-or$api.CommandLine-cnotmatch$exactCommand){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
  if($api.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')-cne([datetime]$record.children.api.createdAt).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')-or@($listeners|Where-Object{$_.OwningProcess-ne$api.ProcessId}).Count){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 }elseif(!$c.failedStartProof-or!$c.activeBinding-or![Test125ApiKernel]::Exited($c.activeBinding.handle,$c.activeBinding.birth)-or$listeners.Count){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $evidence=[pscustomobject][ordered]@{engine=$c.resumedEngine;instance=$c.resumedInstance;supervisorBirth=$supervisor.CreationDate.ToUniversalTime().ToString('o');recordSha256=(Get-Test125ReadPairHash $recordBytes);apiPid=[int]$record.children.api.pid;apiBirth=([datetime]$record.children.api.createdAt).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ');apiParentPid=$c.resumedEngine;apiExe=$config.NodePath;apiCommandLine=$(if($api){[string]$api.CommandLine}else{$c.failedStartProof.apiCommandLine});startupSha256=$t.startupCandidateSha256;profileSha256=$t.apiProfileCandidateSha256}
 if((Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($recordPath)))-cne$evidence.recordSha256){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 return [pscustomobject]@{evidence=$evidence;config=$config;definition=$definition[0];api=$api;supervisor=$supervisor}
 }catch{throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
}
function Open-Test125ReadPairFailedStart($Context){
 $c=Assert-Test125ReadPairContext $Context
 if($script:Test125ApiBinding-or$c.failedStartProof){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 try{$first=Get-Test125ReadPairFailedStartEvidence $c}catch{throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 if(!$first.api){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 Initialize-Test125ApiKernel;$birth=$first.api.CreationDate.ToUniversalTime().Ticks;$handle=[Test125ApiKernel]::Open($first.api.ProcessId,$birth)
 try{
  $again=Get-Test125ReadPairFailedStartEvidence $c
  if(($again.evidence|ConvertTo-Json -Depth 12 -Compress)-cne($first.evidence|ConvertTo-Json -Depth 12 -Compress)-or!$again.api-or$again.api.CreationDate-ne$first.api.CreationDate){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
  $a=$c.baseline|ConvertTo-Json -Depth 32|ConvertFrom-Json;$a.startupHash=$c.token.startupCandidateSha256.ToUpperInvariant();$a.supervisor=$c.resumedEngine;$a.supervisorBirth=$first.evidence.supervisorBirth;$a.taskInstance=$c.resumedInstance
  if($c.taskAction){$a.launcherHash=$c.taskAction.candidateLauncherHash;$a.taskXmlHash=$c.taskAction.observedXmlHash}
  $a.children.api=[pscustomobject]@{port=4144;pid=$first.api.ProcessId;birth=$first.api.CreationDate.ToUniversalTime().ToString('o');ownerVerified=$true;healthy=$false}
  $binding=[pscustomobject]@{admission=$a;config=$first.config;definition=$first.definition;handle=$handle;birth=$birth;mutex=$null;held=$false;stopped=$false;releaseProof=$c.releaseProof}
  $c.admission=$a;$c.admissionJson=($a|ConvertTo-Json -Depth 32 -Compress);$c.failedStartProof=$first.evidence;$script:Test125ApiBinding=$binding;return $binding
 }catch{$handle.Dispose();throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
}
function Stop-Test125ReadPairFailedApi($Context){
 $c=Assert-Test125ReadPairContext $Context;$b=$c.activeBinding
 if(!$c.failedStartProof-or!$b-or![object]::ReferenceEquals($b,$script:Test125ApiBinding)-or!$b.held-or$b.stopped){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 Assert-Test125ApiStoppedSupervisor $b
 $listeners=@(Get-ErpServiceListeners $b.definition $b.config)
 if(@($listeners|Where-Object{$_.OwningProcess-ne$b.admission.children.api.pid}).Count){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 if(![Test125ApiKernel]::Exited($b.handle,$b.birth)){
  $p=Assert-ErpOwnedProcess $b.admission.children.api.pid $b.config $b.definition $b.admission.children.api.birth
  if(!$p-or$p.CreationDate.ToUniversalTime().Ticks-ne$b.birth-or$p.ParentProcessId-ne$c.failedStartProof.apiParentPid-or$p.ExecutablePath-ine$c.failedStartProof.apiExe-or$p.CommandLine-cne$c.failedStartProof.apiCommandLine){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
  # No API health is required for recovery; identity, fresh listener exclusion
  # and the exact retained kernel object remain mandatory. Zero listeners is OK.
  [Test125ApiKernel]::Stop($b.handle,$b.birth)
 }
 $b.stopped=$true
}
function Invoke-Test125ReadPairApiTransition($Transition,[ValidateSet('Candidate','Rollback','RehearseOnly')][string]$Mode){
 $c=Assert-Test125ReadPairIssued $Transition;if($Mode-cnotin@('Candidate','Rollback','RehearseOnly')){throw 'TEST125_READPAIR_MODE_REJECTED'};$destination=if($Mode-ceq'Candidate'){'Candidate'}else{'Current'}
 $rehearsalOnly=$Transition.scope-ceq'TEST125-API-B6-ca620bac-20261028'-and$c.rehearsalOnly
 if(($Mode-ceq'RehearseOnly'-and!$rehearsalOnly)-or($rehearsalOnly-and$Mode-ceq'Candidate')){throw 'TEST125_READPAIR_REHEARSAL_ONLY'}
 if($Mode-ceq'RehearseOnly'-and$c.rehearsalAttempted){throw 'TEST125_READPAIR_REHEARSAL_ALREADY_ATTEMPTED'}
 if($c.taskAction-and$c.taskAction.unknown){throw 'B6_TASK_ACTION_OUTCOME_UNKNOWN'}
 if($Mode-cne'RehearseOnly'-and$c.mode-ceq$destination-and$c.phase-cin@('PREPARED','VERIFIED')){
  [void](Assert-Test125ReadPairTransition $Transition $destination)
  if($rehearsalOnly){return [pscustomobject]@{status='ALREADY_VERIFIED';mode=$destination;secondEffect=$false;companionStops=0;commercialWrites=0;nativeMetadataApplied=$false}}
  return [pscustomobject]@{status='ALREADY_VERIFIED';mode=$destination;secondEffect=$false;companionStops=0;sqlWrites=0}
 }
 if($Mode-ceq'Candidate'){if($c.candidateAttempted){throw 'TEST125_READPAIR_CANDIDATE_ALREADY_ATTEMPTED'};$c.candidateAttempted=$true}
 if($c.phase-ceq'FAILED'-and$Mode-cne'Rollback'){throw 'TEST125_READPAIR_FAILED_REQUIRES_ROLLBACK'}
 if($Mode-ceq'RehearseOnly'){$c.rehearsalAttempted=$true}
 if($c.phase-ceq'FAILED'-and$Mode-ceq'Rollback'-and!$c.taskStopped-and$c.activeBinding-and!$c.changed-and!$c.apiChanged){
  # Failure before the first supported task-stop request has no runtime change.
  $fresh=Get-Test125BoundMaintenancePlan -RunId $Transition.scope -ReadPairPreparation -ReadPairMode Current -PreparedReleaseProof $c.releaseProof
  Assert-Test125MaintenancePin $c.admission $fresh;Close-Test125ApiQuiescence $c.activeBinding;$c.activeBinding=$null;$c.phase='PREPARED'
  [void](Assert-Test125ReadPairTransition $Transition Current)
  if($rehearsalOnly){return [pscustomobject]@{status='ALREADY_VERIFIED';mode='Current';secondEffect=$false;companionStops=0;commercialWrites=0;nativeMetadataApplied=$false}}
  return [pscustomobject]@{status='ALREADY_VERIFIED';mode='Current';secondEffect=$false;companionStops=0;sqlWrites=0}
 }

 if($c.phase-cne'FAILED'){[void](Assert-Test125ReadPairTransition $Transition $c.mode)}
 try{
  if(!$c.activeBinding-or($c.failedStartProof-and!$c.taskStopped)){
   if($c.phase-ceq'FAILED'-and!$c.activeBinding){$c.activeBinding=Open-Test125ReadPairFailedStart $c}
   # Open the exact existing API kernel object before pausing its supervisor.
   if(!$c.activeBinding){$c.activeBinding=Open-Test125ApiQuiescence $c.admission $Transition.scope}
   $task=Get-Test125ReadPairTask;$instances=$task.GetInstances(0)
   $xmlHash=Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml))
   if($xmlHash-cne$c.admission.taskXmlHash-or$instances.Count-ne1-or[string]$instances.Item(1).InstanceGuid-cne$c.admission.taskInstance-or[int]$instances.Item(1).EnginePID-ne$c.admission.supervisor){if($c.failedStartProof){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'};throw 'TEST125_READPAIR_TASK_CAS_CHANGED'}
   if(!$c.vault){
    $root='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027';$vault=Join-Path $root ($(if($Transition.scope-ceq'TEST125-API-B6-ca620bac-20261028'){'api-b6-'}else{'api-read2b-'})+[guid]::NewGuid().ToString('N'))
    for($q=$root;$q;$q=[IO.Path]::GetDirectoryName($q)){if((Get-Item -LiteralPath $q -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'TEST125_READPAIR_REPARSE'}}
    if(Test-Path -LiteralPath $vault){throw 'TEST125_READPAIR_BEFOREIMAGE_EXISTS'}
    $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($c.config.OwnerSid));$acl.SetAccessRuleProtection($true,$false)
    foreach($sid in @($c.config.OwnerSid,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
    [void][IO.Directory]::CreateDirectory($vault,$acl);Add-Type -AssemblyName System.Security
    foreach($entry in @(@('startup.before.dpapi',$c.beforeBytes),@('api-profile.before.dpapi',$c.apiBefore))){$encrypted=[Security.Cryptography.ProtectedData]::Protect($entry[1],$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);$f=[IO.File]::Open((Join-Path $vault $entry[0]),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$f.Write($encrypted,0,$encrypted.Length);$f.Flush($true)}finally{$f.Dispose()}}
    for($q=$vault;$q;$q=[IO.Path]::GetDirectoryName($q)){if((Get-Item -LiteralPath $q -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'TEST125_READPAIR_BEFOREIMAGE_REPARSE'}}
    $actualAcl=Get-Acl -LiteralPath $vault;$rules=@($actualAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    if(!$actualAcl.AreAccessRulesProtected-or$actualAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$c.config.OwnerSid-or$rules.Count-ne2){throw 'TEST125_READPAIR_BEFOREIMAGE_ACL'}
    foreach($sid in @($c.config.OwnerSid,'S-1-5-18')){if(@($rules|Where-Object{$_.IdentityReference.Value-ceq$sid-and!$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'TEST125_READPAIR_BEFOREIMAGE_ACL'}}
    foreach($entry in @(@('startup.before.dpapi',$c.beforeBytes),@('api-profile.before.dpapi',$c.apiBefore))){$restored=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $vault $entry[0])),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);if((Get-Test125ReadPairHash $restored)-cne(Get-Test125ReadPairHash $entry[1])){throw 'TEST125_READPAIR_BEFOREIMAGE_READBACK'}}
    $c.vault=$vault
   }
   # Before-image work may take time; task/source/children must still be the
   # exact admitted generation immediately before the supported stop request.
   if($c.failedStartProof){$again=Get-Test125ReadPairFailedStartEvidence $c;if(($again.evidence|ConvertTo-Json -Depth 12 -Compress)-cne($c.failedStartProof|ConvertTo-Json -Depth 12 -Compress)){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}}else{$last=Get-Test125BoundMaintenancePlan -RunId $Transition.scope -ReadPairPreparation -ReadPairMode $c.mode -PreparedReleaseProof $c.releaseProof;Assert-Test125MaintenancePin $c.admission $last}
   $task=Get-Test125ReadPairTask;$instances=$task.GetInstances(0)
   if((Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-cne$c.admission.taskXmlHash-or$instances.Count-ne1-or[string]$instances.Item(1).InstanceGuid-cne$c.admission.taskInstance-or[int]$instances.Item(1).EnginePID-ne$c.admission.supervisor){if($c.failedStartProof){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'};throw 'TEST125_READPAIR_TASK_CAS_CHANGED'}
   $c.phase='PAUSING';$c.taskStopped=$true
   Stop-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\' -ErrorAction Stop
   $end=[DateTime]::UtcNow.AddSeconds(15)
   do{if((Get-Test125ReadPairTask).GetInstances(0).Count-eq0-and!(Get-ErpProcess $c.admission.supervisor)){break};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow-lt$end)
   Enter-Test125ApiQuiescence $c.activeBinding
   if($c.failedStartProof){Stop-Test125ReadPairFailedApi $c}else{Stop-Test125BoundApi $c.activeBinding};[void](Test-Test125ApiPhysicalPause $c.activeBinding)
  }else{
   if(!$c.taskStopped){throw 'TEST125_READPAIR_RECOVERY_NOT_QUIESCENT'}
   if(!$c.activeBinding.held){Enter-Test125ApiQuiescence $c.activeBinding}
   if(!$c.activeBinding.stopped){Stop-Test125BoundApi $c.activeBinding;[void](Test-Test125ApiPhysicalPause $c.activeBinding)}
   Assert-Test125ReadPairPaused $c
  }
  Assert-Test125ReadPairCompanions $c
  if((Get-FileHash -LiteralPath $c.config.ConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$Transition.baseProfileSha256){throw 'TEST125_READPAIR_BASE_PROFILE_CHANGED'}
  if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'){Invoke-ErpBusinessSaleWriterProfileBoundaryCheck $c.nativeProfileAdmission -Mode $Mode}
  if($Transition.scope-ceq'TEST125-API-B6-ca620bac-20261028'){
   # The existing native owner must prove this exact quiesced API/web boundary.
   # A missing runner, unready native proof or committed history stays closed.
   if($Mode-ceq'RehearseOnly'){
    $c.nativeChangeAttempted=$true
    Invoke-ErpBusinessSaleNativeRevision $c.nativeProfileAdmission -Direction Rehearse|Out-Null
    [void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission -Phase Restored);$c.nativeApplied=$false
   }elseif($destination-ceq'Candidate'){
    $c.nativeChangeAttempted=$true
    Invoke-ErpBusinessSaleNativeRevision $c.nativeProfileAdmission -Direction Rehearse|Out-Null
    Invoke-ErpBusinessSaleNativeRevision $c.nativeProfileAdmission -Direction Apply|Out-Null
    [void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission -Phase Applied);$c.nativeApplied=$true
   }elseif($rehearsalOnly-and!$c.nativeChangeAttempted){
    # No DDL was attempted. The original native Prepared admission remains
    # required while the unchanged Current files and task are recovered.
    [void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission -Phase Prepared);$c.nativeApplied=$false
   }else{
    Invoke-ErpBusinessSaleNativeRevision $c.nativeProfileAdmission -Direction Inverse|Out-Null
    [void](Assert-ErpBusinessSaleNativeProfileAdmission $c.nativeProfileAdmission -Phase Restored);$c.nativeApplied=$false
   }
  }
  if($c.taskAction-and!($rehearsalOnly-and!$c.nativeChangeAttempted)){Set-Test125ReadPairTaskAction $Transition -Mode $destination}
  if($destination-ceq'Candidate'){
   if($Transition.scope-cne'TEST125-API-B6-WRITER-20261029'-or$Transition.profileOnlyPurpose-cne'PackageRefresh'){Write-Test125ReadPairCas $c.apiPath $Transition.apiProfileBeforeSha256 $c.apiCandidate;$c.apiChanged=$true}
   Write-Test125ReadPairCas $c.startupPath $Transition.startupBeforeSha256 $c.candidateBytes;$c.changed=$true
  }else{
   if($c.changed){Write-Test125ReadPairCas $c.startupPath $Transition.startupCandidateSha256 $c.beforeBytes;$c.changed=$false}
   if($c.apiChanged){Write-Test125ReadPairCas $c.apiPath $Transition.apiProfileCandidateSha256 $c.apiBefore;$c.apiChanged=$false}
  }
  if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'){Complete-ErpBusinessSaleWriterProfileState $c.nativeProfileAdmission -Mode $Mode}
  $retiredSupervisor=$c.admission.supervisor
  $c.mode=$destination;Close-Test125ApiQuiescence $c.activeBinding;$c.activeBinding=$null;$c.failedStartProof=$null
  $c.phase='STARTING';$c.resumedEngine=$null;$c.resumedInstance=$null;$c.resumedBirth=$null;Start-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\' -ErrorAction Stop;$c.taskStopped=$false
  $deadline=[DateTime]::UtcNow.AddSeconds(300);$observedEngine=$null;$last=$null
  do{
   $instances=(Get-Test125ReadPairTask).GetInstances(0);if($instances.Count-gt1){throw 'TEST125_READPAIR_MULTIPLE_SUPERVISORS'}
   if($instances.Count-eq1){
    $engine=[int]$instances.Item(1).EnginePID;$instance=[string]$instances.Item(1).InstanceGuid;$live=Get-ErpProcess $engine
    if(!$live-or$live-isnot[Microsoft.Management.Infrastructure.CimInstance]-or$live.CimSystemProperties.ClassName-cne'Win32_Process'-or$live.ProcessId-ne$engine-or!$instance){throw 'TEST125_READPAIR_SUPERVISOR_CHANGED'}
    if($null-eq$observedEngine){$observedEngine=$engine;$c.resumedEngine=$engine;$c.resumedInstance=$instance;$c.resumedBirth=$live.CreationDate.ToUniversalTime().Ticks}elseif($engine-ne$observedEngine-or$instance-cne$c.resumedInstance-or$live.CreationDate.ToUniversalTime().Ticks-ne$c.resumedBirth){throw 'TEST125_READPAIR_SUPERVISOR_CHANGED'}
   }
   # Capture identity/handle on first proved publication, without waiting for
   # API health. A missing/unproved publication is not adopted or stopped.
   if($destination-ceq'Candidate'-and$c.resumedEngine-and!$c.activeBinding){try{$c.activeBinding=Open-Test125ReadPairFailedStart $c}catch{}}

   Assert-Test125ReadPairCompanions $c
   try{$last=Get-Test125BoundMaintenancePlan -RunId $Transition.scope -ReadPairPreparation -ReadPairMode $destination -PreparedReleaseProof $c.releaseProof}catch{$last=$null}
   if($last){break};Start-Sleep -Milliseconds 500
  }while([DateTime]::UtcNow-lt$deadline)
  if(!$last-or$last.supervisor-eq$retiredSupervisor){throw 'TEST125_READPAIR_API_READY_TIMEOUT'}
  if($c.activeBinding){Close-Test125ApiQuiescence $c.activeBinding;$c.activeBinding=$null;$c.failedStartProof=$null}
  $c.resumedEngine=$null;$c.resumedInstance=$null;$c.resumedBirth=$null
  $c.admission=$last;$c.admissionJson=($last|ConvertTo-Json -Depth 32 -Compress);$c.phase='VERIFIED';[void](Assert-Test125ReadPairTransition $Transition $destination)
  $outcome=[pscustomobject]@{status='API_COMPONENT_VERIFIED';mode=$destination;beforeImage=$c.vault;apiPort=4144;companionStops=0;sqlWrites=0;runtimeApplied=($destination-ceq'Candidate')}
  if($Transition.scope-ceq'TEST125-API-B6-ca620bac-20261028'){
   # B6 includes declared metadata DDL. Do not report that as zero SQL writes;
   # the separate zero is commercial rows, not schema/permission changes.
   $outcome.PSObject.Properties.Remove('sqlWrites')
   $outcome|Add-Member commercialWrites 0
   $outcome|Add-Member nativeRevisionProcessed ([bool]$c.nativeChangeAttempted)
   $outcome|Add-Member nativeMetadataApplied ([bool]$c.nativeApplied)
   $outcome|Add-Member nativePhase $(if($rehearsalOnly-and!$c.nativeChangeAttempted){'Prepared'}elseif($c.nativeApplied){'Applied'}else{'Restored'})
   if($Mode-ceq'RehearseOnly'){$outcome.status='REHEARSAL_VERIFIED_CURRENT_RESTORED'}
  }
  if($Transition.scope-ceq'TEST125-API-B6-WRITER-20261029'){$outcome|Add-Member profileOnlyPurpose $Transition.profileOnlyPurpose;$outcome|Add-Member nativePhase (Get-ErpBusinessSaleNativeAdmissionContext $c.nativeProfileAdmission).phase}
  return $outcome
 }catch{$c.phase='FAILED';throw}
}

function Resume-Test125ReadPairWriterCandidateAfterCas($Transition,$NativeProfileAdmission,$RecoveryAdmission=$null){
 $outer=Assert-Business5244WriterPostCasRecoveryApiResume $RecoveryAdmission $Transition $NativeProfileAdmission
 $c=Assert-Test125ReadPairIssued $Transition
 if(![object]::ReferenceEquals($outer,$c)){throw 'B6_WRITER_POST_CAS_RECOVERY_NOT_ISSUED'}
 if($Transition.scope-cne'TEST125-API-B6-WRITER-20261029'-or![object]::ReferenceEquals($NativeProfileAdmission,$c.nativeProfileAdmission)-or$c.phase-cne'FAILED'-or$c.mode-cne'Current'-or$c.candidateAttempted-isnot[bool]-or!$c.candidateAttempted-or$c.nativeChangeAttempted-isnot[bool]-or$c.nativeChangeAttempted-or$c.nativeApplied-isnot[bool]-or$c.nativeApplied-or$c.resumedEngine-or$c.resumedInstance-or$c.resumedBirth-or$c.failedStartProof){throw 'B6_WRITER_POST_CAS_RESUME_NOT_ISSUED'}
 $n=Get-ErpBusinessSaleNativeAdmissionContext $NativeProfileAdmission
 if($n.phase-cnotin@('WriterPrepared','WriterActivated')){throw 'B6_WRITER_PHASE_REJECTED'}
 [void](Assert-Test125ReadPairWriterPostCasPause $Transition -Mode Candidate)
 if($n.phase-ceq'WriterPrepared'){Complete-ErpBusinessSaleWriterProfilePostCasState $NativeProfileAdmission -Mode Candidate}
 [void](Assert-ErpBusinessSaleWriterProfileAdmission $NativeProfileAdmission -Phase WriterActivated)
 [void](Assert-Test125ReadPairWriterPostCasPause $Transition -Mode Candidate)
 $destination='Candidate'
 try{
  $retiredSupervisor=$c.admission.supervisor
  $c.mode=$destination;Close-Test125ApiQuiescence $c.activeBinding;$c.activeBinding=$null;$c.failedStartProof=$null
  $c.phase='STARTING';$c.resumedEngine=$null;$c.resumedInstance=$null;$c.resumedBirth=$null;Start-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\' -ErrorAction Stop;$c.taskStopped=$false
  $deadline=[DateTime]::UtcNow.AddSeconds(300);$observedEngine=$null;$last=$null
  do{
   $instances=(Get-Test125ReadPairTask).GetInstances(0);if($instances.Count-gt1){throw 'TEST125_READPAIR_MULTIPLE_SUPERVISORS'}
   if($instances.Count-eq1){
    $engine=[int]$instances.Item(1).EnginePID;$instance=[string]$instances.Item(1).InstanceGuid;$live=Get-ErpProcess $engine
    if(!$live-or$live-isnot[Microsoft.Management.Infrastructure.CimInstance]-or$live.CimSystemProperties.ClassName-cne'Win32_Process'-or$live.ProcessId-ne$engine-or!$instance){throw 'TEST125_READPAIR_SUPERVISOR_CHANGED'}
    if($null-eq$observedEngine){$observedEngine=$engine;$c.resumedEngine=$engine;$c.resumedInstance=$instance;$c.resumedBirth=$live.CreationDate.ToUniversalTime().Ticks}elseif($engine-ne$observedEngine-or$instance-cne$c.resumedInstance-or$live.CreationDate.ToUniversalTime().Ticks-ne$c.resumedBirth){throw 'TEST125_READPAIR_SUPERVISOR_CHANGED'}
   }
   # Capture identity/handle on first proved publication, without waiting for
   # API health. A missing/unproved publication is not adopted or stopped.
   if($destination-ceq'Candidate'-and$c.resumedEngine-and!$c.activeBinding){try{$c.activeBinding=Open-Test125ReadPairFailedStart $c}catch{}}

   Assert-Test125ReadPairCompanions $c
   try{$last=Get-Test125BoundMaintenancePlan -RunId $Transition.scope -ReadPairPreparation -ReadPairMode $destination -PreparedReleaseProof $c.releaseProof}catch{$last=$null}
   if($last){break};Start-Sleep -Milliseconds 500
  }while([DateTime]::UtcNow-lt$deadline)
  if(!$last-or$last.supervisor-eq$retiredSupervisor){throw 'TEST125_READPAIR_API_READY_TIMEOUT'}
  if($c.activeBinding){Close-Test125ApiQuiescence $c.activeBinding;$c.activeBinding=$null;$c.failedStartProof=$null}
  $c.resumedEngine=$null;$c.resumedInstance=$null;$c.resumedBirth=$null
  $c.admission=$last;$c.admissionJson=($last|ConvertTo-Json -Depth 32 -Compress);$c.phase='VERIFIED';[void](Assert-Test125ReadPairTransition $Transition $destination)

  return [pscustomobject]@{status='API_COMPONENT_VERIFIED';mode='Candidate';beforeImage=$c.vault;apiPort=4144;companionStops=0;sqlWrites=0;runtimeApplied=$true;profileOnlyPurpose='WriterProfileActivation';nativePhase='WriterActivated'}
 }catch{$c.phase='FAILED';throw}
}
