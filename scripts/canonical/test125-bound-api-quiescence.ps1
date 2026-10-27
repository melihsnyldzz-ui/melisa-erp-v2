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
public sealed class Test125ApiHandle:SafeHandleZeroOrMinusOneIsInvalid{public long Birth;public Test125ApiHandle():base(true){}protected override bool ReleaseHandle(){return Test125ApiKernel.CloseHandle(handle);}}
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
 public static bool Exited(Test125ApiHandle h,long birth){Check(h,birth);return WaitForSingleObject(h,0)==0;}
 public static void Stop(Test125ApiHandle h,long birth){Check(h,birth);if(WaitForSingleObject(h,0)!=258)throw new InvalidOperationException("TEST125_API_ALREADY_EXITED");if(!TerminateProcess(h,1)||WaitForSingleObject(h,10000)!=0)throw new InvalidOperationException("TEST125_API_STOP_UNCONFIRMED");}
}
'@
}
function Assert-Test125ApiAdmission($Admission){
 if($PSVersionTable.PSEdition -cne 'Desktop'){throw 'TEST125_WINDOWS_POWERSHELL_REQUIRED'}
 if($Admission.schema -cne 'melisa-test125-bound-maintenance-preparation.v1' -or $Admission.runId -cne 'PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7' -or $Admission.source -cne 'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d' -or $Admission.database -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $Admission.children.api.port -ne 4144 -or $Admission.children.native.port -ne 4146 -or $Admission.children.web.port -ne 5194){throw 'TEST125_API_SCOPE_REJECTED'}
}
function Open-Test125ApiQuiescence($Admission){
 Assert-Test125ApiAdmission $Admission
 if($script:Test125ApiBinding){throw 'TEST125_API_BINDING_ALREADY_OPEN'}
 $fresh=Get-Test125BoundMaintenancePlan
 Assert-Test125MaintenancePin $Admission $fresh
 $config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $definition=@(Get-ErpServiceDefinitions $config | Where-Object {$_.Name -eq 'api'})[0]
 $process=Assert-ErpOwnedProcess $Admission.children.api.pid $config $definition $Admission.children.api.birth
 if(!$process){throw 'TEST125_API_MISSING_BEFORE_OPEN'}
 Initialize-Test125ApiKernel
 $birth=$process.CreationDate.ToUniversalTime().Ticks
 $handle=[Test125ApiKernel]::Open($process.ProcessId,$birth)
 try{
  $again=Assert-ErpOwnedProcess $process.ProcessId $config $definition $Admission.children.api.birth
  if(!$again -or $again.CreationDate -ne $process.CreationDate){throw 'TEST125_API_CHANGED_DURING_OPEN'}
  $binding=[pscustomobject]@{admission=$Admission;config=$config;definition=$definition;handle=$handle;birth=$birth;mutex=$null;held=$false;stopped=$false}
  $script:Test125ApiBinding=$binding;return $binding
 }catch{$handle.Dispose();throw}
}
function Assert-Test125ApiStoppedSupervisor($Binding){
 if(!$Binding -or ![object]::ReferenceEquals($Binding,$script:Test125ApiBinding)){throw 'TEST125_API_BINDING_NOT_OWNED'}
 $a=$Binding.admission;$c=$Binding.config
 if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json' -Algorithm SHA256).Hash -cne $a.startupHash -or (Get-FileHash -LiteralPath (Join-Path $c.RepoRoot 'scripts\canonical\start-owned-test.ps1') -Algorithm SHA256).Hash -cne $a.launcherHash){throw 'TEST125_API_CONFIG_CHANGED'}
 Assert-ErpRelease $c | Out-Null
 $service=New-Object -ComObject Schedule.Service;$service.Connect();$task=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$task.Xml))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 if($hash -cne $a.taskXmlHash -or $task.GetInstances(0).Count -ne 0 -or (Get-ErpProcess $a.supervisor)){throw 'TEST125_API_SUPERVISOR_NOT_EXCLUDED'}
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
