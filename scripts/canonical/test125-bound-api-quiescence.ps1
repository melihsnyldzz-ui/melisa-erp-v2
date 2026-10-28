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
$script:Test125ReadPairContext=$null
function Assert-Test125ApiAdmission($Admission,[string]$ExpectedRunId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7'){
 if($PSVersionTable.PSEdition -cne 'Desktop'){throw 'TEST125_WINDOWS_POWERSHELL_REQUIRED'}
 if($ExpectedRunId-ceq(Get-Test125ReadPairScope).name){
  $ctx=$script:Test125ReadPairContext
  if(!$ctx-or![object]::ReferenceEquals($Admission,$ctx.admission)-or$ctx.pid-ne$PID-or$ctx.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId){throw 'TEST125_API_SCOPE_REJECTED'}
  if(($Admission|ConvertTo-Json -Depth 32 -Compress)-cne$ctx.admissionJson){throw 'TEST125_API_SCOPE_REJECTED'};return
 }
 if($ExpectedRunId -cnotin @('PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7','PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8','PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a') -or $Admission.schema -cne 'melisa-test125-bound-maintenance-preparation.v1' -or $Admission.runId -cne $ExpectedRunId -or $Admission.source -cne 'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d' -or $Admission.database -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $Admission.children.api.port -ne 4144 -or $Admission.children.native.port -ne 4146 -or $Admission.children.web.port -ne 5194){throw 'TEST125_API_SCOPE_REJECTED'}
}
function Open-Test125ApiQuiescence($Admission,[string]$ExpectedRunId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7'){
 Assert-Test125ApiAdmission $Admission $ExpectedRunId
 if($script:Test125ApiBinding){throw 'TEST125_API_BINDING_ALREADY_OPEN'}
 $fresh=if($ExpectedRunId-ceq(Get-Test125ReadPairScope).name){Get-Test125BoundMaintenancePlan -RunId $ExpectedRunId -ReadPairPreparation -ReadPairMode $script:Test125ReadPairContext.mode -PreparedReleaseProof $script:Test125ReadPairContext.releaseProof}else{Get-Test125BoundMaintenancePlan -RunId $ExpectedRunId}
 Assert-Test125MaintenancePin $Admission $fresh
 $releaseProof=if($ExpectedRunId-ceq(Get-Test125ReadPairScope).name){$script:Test125ReadPairContext.releaseProof}else{$null}
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
 if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json' -Algorithm SHA256).Hash -cne $a.startupHash -or (Get-FileHash -LiteralPath (Join-Path $c.RepoRoot 'scripts\canonical\start-owned-test.ps1') -Algorithm SHA256).Hash -cne $a.launcherHash){throw 'TEST125_API_CONFIG_CHANGED'}
 $releaseProof=if($Binding.PSObject.Properties['releaseProof']){$Binding.releaseProof}else{$null}
 if($a.runId-ceq(Get-Test125ReadPairScope).name-and$null-eq$releaseProof){throw 'TEST125_RELEASE_PROOF_REQUIRED'}
 Assert-ErpRelease $c -PreparedReleaseProof $releaseProof | Out-Null
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

# The only new capability is an object issued in this process/thread. Neither a
# historical PRODUCT receipt nor a caller-built shape can authorize this pair.
function Get-Test125ReadPairHash([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Assert-Test125ReadPairIssued($Transition){
 $c=$script:Test125ReadPairContext
 if(!$c-or![object]::ReferenceEquals($Transition,$c.token)-or$c.pid-ne$PID-or$c.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or($Transition|ConvertTo-Json -Depth 12 -Compress)-cne$c.tokenJson){throw 'TEST125_READPAIR_NOT_ISSUED'}
 [void](Get-ErpReadPairReleaseProofContext $c.releaseProof)
 return $c
}
function New-Test125ReadPairTransition {
 if($PSVersionTable.PSEdition-cne'Desktop'){throw 'TEST125_WINDOWS_POWERSHELL_REQUIRED'}
 if($script:Test125ReadPairContext-or$script:Test125ApiBinding){throw 'TEST125_READPAIR_ALREADY_ISSUED'}
 $scope=Get-Test125ReadPairScope;$before=Get-Test125BoundMaintenancePlan -RunId $scope.name -ReadPairPreparation
 $path='C:\Sirket\ERP\runtime\canonical-test\startup-config.json';$config=Read-ErpStartupConfig $path;[void](Assert-Test125ReadPairConfig $config Current)
 $bytes=[IO.File]::ReadAllBytes($path);if((Get-Test125ReadPairHash $bytes)-cne$before.startupHash.ToLowerInvariant()){throw 'TEST125_READPAIR_STARTUP_DRIFT'}
 $next=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json;$next.ApiComponent.ReleaseRoot=$scope.candidate.ReleaseRoot;$next.ApiComponent.ManifestSha256=$scope.candidate.ManifestSha256
 $comparison=$next.PSObject.Copy();$comparison.ApiComponent=$config.ApiComponent
 if(($comparison|ConvertTo-Json -Depth 100 -Compress)-cne($config|ConvertTo-Json -Depth 100 -Compress)){throw 'TEST125_READPAIR_DELTA_REJECTED'}
 $candidate=Get-ErpApiComponentConfig $next;$manifest=Assert-ErpRelease $candidate
 $apiPath=$scope.current.ConfigPath;$apiBefore=[IO.File]::ReadAllBytes($apiPath);$api=[Text.Encoding]::UTF8.GetString($apiBefore)|ConvertFrom-Json
 if($api.goal8SyntheticDaySeal.packageId-cne'CANONICAL-TEST125-BUSINESS5244-10cdc0ee'){throw 'TEST125_READPAIR_OLD_SEAL_CHANGED'}
 $apiNext=[Text.Encoding]::UTF8.GetString($apiBefore)|ConvertFrom-Json;$apiNext.goal8SyntheticDaySeal.packageId=$manifest.packageId
 $apiCompare=[Text.Encoding]::UTF8.GetString($apiBefore)|ConvertFrom-Json;$apiCompare.goal8SyntheticDaySeal.packageId=$manifest.packageId
 if(($apiNext|ConvertTo-Json -Depth 100 -Compress)-cne($apiCompare|ConvertTo-Json -Depth 100 -Compress)){throw 'TEST125_READPAIR_PROFILE_DELTA'}
 $baseProfileBytes=[IO.File]::ReadAllBytes($config.ConfigPath)
 Assert-ErpApiPrivateProfile ([Text.Encoding]::UTF8.GetString($baseProfileBytes)|ConvertFrom-Json) $apiNext $manifest
 $apiCandidate=[Text.Encoding]::UTF8.GetBytes(($apiNext|ConvertTo-Json -Depth 100))
 $nextBytes=[Text.Encoding]::UTF8.GetBytes(($next|ConvertTo-Json -Depth 100))
 $releaseProof=New-ErpReadPairPreparedReleaseProof $config;$releasePins=Get-ErpReadPairReleaseProofPins $releaseProof
 $token=[pscustomobject][ordered]@{schema='melisa-test125-read2b-api-transition.v1';packageProof=$releasePins;scope=$scope.name;source=$scope.source;database=$scope.database;current=$scope.current;candidate=$scope.candidate;apiProfileBeforeSha256=(Get-Test125ReadPairHash $apiBefore);apiProfileCandidateSha256=(Get-Test125ReadPairHash $apiCandidate);baseProfileSha256=(Get-Test125ReadPairHash $baseProfileBytes);startupBeforeSha256=(Get-Test125ReadPairHash $bytes);startupCandidateSha256=(Get-Test125ReadPairHash $nextBytes);apiPort=4144;preservedPorts=@(4146,5194);runtimeApplied=$false}
 $script:Test125ReadPairContext=[pscustomobject]@{token=$token;tokenJson=($token|ConvertTo-Json -Depth 12 -Compress);releaseProof=$releaseProof;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;mode='Current';phase='PREPARED';admission=$before;admissionJson=($before|ConvertTo-Json -Depth 32 -Compress);baseline=$before;config=$config;startupPath=$path;beforeBytes=$bytes;candidateBytes=$nextBytes;apiPath=$apiPath;apiBefore=$apiBefore;apiCandidate=$apiCandidate;apiChanged=$false;activeBinding=$null;taskStopped=$false;manifest=$manifest;changed=$false;vault=$null;resumedEngine=$null;resumedInstance=$null;resumedBirth=$null;candidateAttempted=$false;failedStartProof=$null}
 return $token
}
function Assert-Test125ReadPairTransition($Transition,[ValidateSet('Current','Candidate')][string]$Mode='Current'){
 $c=Assert-Test125ReadPairIssued $Transition
 if($c.mode-cne$Mode-or$c.phase-cnotin@('PREPARED','VERIFIED')){throw 'TEST125_READPAIR_PHASE_REJECTED'}
 $config=Read-ErpStartupConfig $c.startupPath -PreparedReleaseProof $c.releaseProof;[void](Assert-Test125ReadPairConfig $config $Mode)
 $expected=if($Mode-ceq'Current'){$Transition.startupBeforeSha256}else{$Transition.startupCandidateSha256}
 if((Get-FileHash -LiteralPath $c.startupPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$expected){throw 'TEST125_READPAIR_STARTUP_DRIFT'}
 $apiExpected=if($Mode-ceq'Current'){$Transition.apiProfileBeforeSha256}else{$Transition.apiProfileCandidateSha256}
 if((Get-FileHash -LiteralPath $c.apiPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$apiExpected-or(Get-FileHash -LiteralPath $config.ConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$Transition.baseProfileSha256){throw 'TEST125_READPAIR_PROFILE_DRIFT'}
 $fresh=Get-Test125BoundMaintenancePlan -RunId $Transition.scope -ReadPairPreparation -ReadPairMode $Mode -PreparedReleaseProof $c.releaseProof
 foreach($name in @('native','web')){if(($fresh.children.$name|ConvertTo-Json -Depth 8 -Compress)-cne($c.baseline.children.$name|ConvertTo-Json -Depth 8 -Compress)){throw 'TEST125_READPAIR_COMPANION_CHANGED'}}
 foreach($key in @('source','database','launcherHash','manifestHash','taskXmlHash')){if($fresh.$key-cne$c.baseline.$key){throw 'TEST125_READPAIR_BOUNDARY_CHANGED'}}
 Assert-Test125MaintenancePin $c.admission $fresh
 return $true
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
 if((Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-cne$c.baseline.taskXmlHash-or$task.GetInstances(0).Count-ne0-or(Get-ErpProcess $b.admission.supervisor)){throw 'TEST125_READPAIR_TASK_NOT_PAUSED'}
 $expected=if($c.changed){$c.token.startupCandidateSha256}else{$c.token.startupBeforeSha256}
 if((Get-FileHash -LiteralPath $c.startupPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$expected-or(Get-FileHash -LiteralPath (Join-Path $c.config.RepoRoot 'scripts\canonical\start-owned-test.ps1') -Algorithm SHA256).Hash-cne$c.baseline.launcherHash){throw 'TEST125_READPAIR_PAUSED_CONFIG_DRIFT'}
 $apiExpected=if($c.apiChanged){$c.token.apiProfileCandidateSha256}else{$c.token.apiProfileBeforeSha256}
 if((Get-FileHash -LiteralPath $c.apiPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$apiExpected){throw 'TEST125_READPAIR_PAUSED_PROFILE_DRIFT'}
 if(@(Get-NetTCPConnection -State Listen -LocalPort 4144 -ErrorAction SilentlyContinue).Count){throw 'TEST125_READPAIR_API_NOT_EMPTY'}
 Assert-Test125ReadPairCompanions $c
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
 if($c.mode-cne'Candidate'-or!$c.changed-or!$c.apiChanged-or!$c.resumedEngine-or!$c.resumedInstance-or!$c.resumedBirth-or$c.resumedEngine-eq$c.baseline.supervisor){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $config=Read-ErpStartupConfig $c.startupPath -PreparedReleaseProof $c.releaseProof;[void](Assert-Test125ReadPairConfig $config Candidate)
 foreach($entry in @(@($c.startupPath,$t.startupCandidateSha256),@($c.apiPath,$t.apiProfileCandidateSha256),@($config.ConfigPath,$t.baseProfileSha256))){if((Get-FileHash -LiteralPath $entry[0] -Algorithm SHA256).Hash.ToLowerInvariant()-cne$entry[1]){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}}
 if((Get-FileHash -LiteralPath (Join-Path $config.RepoRoot 'scripts\canonical\start-owned-test.ps1') -Algorithm SHA256).Hash-cne$c.baseline.launcherHash){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $task=Get-Test125ReadPairTask;$instances=$task.GetInstances(0)
 if((Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-cne$c.baseline.taskXmlHash-or$instances.Count-ne1-or[int]$instances.Item(1).EnginePID-ne$c.resumedEngine-or[string]$instances.Item(1).InstanceGuid-cne$c.resumedInstance){throw 'TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER'}
 $taskAction=Assert-Test125MaintenanceTask (Get-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\' -ErrorAction Stop) $config $c.startupPath
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
function Invoke-Test125ReadPairApiTransition($Transition,[ValidateSet('Candidate','Rollback')][string]$Mode){
 $c=Assert-Test125ReadPairIssued $Transition;if($Mode-cnotin@('Candidate','Rollback')){throw 'TEST125_READPAIR_MODE_REJECTED'};$destination=if($Mode-ceq'Candidate'){'Candidate'}else{'Current'}
 if($c.mode-ceq$destination-and$c.phase-cin@('PREPARED','VERIFIED')){[void](Assert-Test125ReadPairTransition $Transition $destination);return [pscustomobject]@{status='ALREADY_VERIFIED';mode=$destination;secondEffect=$false;companionStops=0;sqlWrites=0}}
 if($Mode-ceq'Candidate'){if($c.candidateAttempted){throw 'TEST125_READPAIR_CANDIDATE_ALREADY_ATTEMPTED'};$c.candidateAttempted=$true}
 if($c.phase-ceq'FAILED'-and$Mode-cne'Rollback'){throw 'TEST125_READPAIR_FAILED_REQUIRES_ROLLBACK'}
 if($c.phase-ceq'FAILED'-and$Mode-ceq'Rollback'-and!$c.taskStopped-and$c.activeBinding-and!$c.changed-and!$c.apiChanged){
  # Failure before the first supported task-stop request has no runtime change.
  $fresh=Get-Test125BoundMaintenancePlan -RunId $Transition.scope -ReadPairPreparation -ReadPairMode Current -PreparedReleaseProof $c.releaseProof
  Assert-Test125MaintenancePin $c.admission $fresh;Close-Test125ApiQuiescence $c.activeBinding;$c.activeBinding=$null;$c.phase='PREPARED'
  [void](Assert-Test125ReadPairTransition $Transition Current);return [pscustomobject]@{status='ALREADY_VERIFIED';mode='Current';secondEffect=$false;companionStops=0;sqlWrites=0}
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
    $root='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027';$vault=Join-Path $root ('api-read2b-'+[guid]::NewGuid().ToString('N'))
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
  if($destination-ceq'Candidate'){
   Write-Test125ReadPairCas $c.apiPath $Transition.apiProfileBeforeSha256 $c.apiCandidate;$c.apiChanged=$true
   Write-Test125ReadPairCas $c.startupPath $Transition.startupBeforeSha256 $c.candidateBytes;$c.changed=$true
  }else{
   if($c.changed){Write-Test125ReadPairCas $c.startupPath $Transition.startupCandidateSha256 $c.beforeBytes;$c.changed=$false}
   if($c.apiChanged){Write-Test125ReadPairCas $c.apiPath $Transition.apiProfileCandidateSha256 $c.apiBefore;$c.apiChanged=$false}
  }
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
  return [pscustomobject]@{status='API_COMPONENT_VERIFIED';mode=$destination;beforeImage=$c.vault;apiPort=4144;companionStops=0;sqlWrites=0;runtimeApplied=($destination-ceq'Candidate')}
 }catch{$c.phase='FAILED';throw}
}
