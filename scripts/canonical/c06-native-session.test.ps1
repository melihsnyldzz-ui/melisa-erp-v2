$ErrorActionPreference='Stop'
# Clean b07b1ed5 production source. Only this test's managed boundary doubles
# run: no real mutex/process/task/network/SQL or application file writes.
$sourcePath=Join-Path $PSScriptRoot 'start-owned-test.ps1'
function Source-Digest {
 $bytes=[Text.Encoding]::UTF8.GetBytes([IO.File]::ReadAllText($sourcePath).Replace("`r`n","`n"))
 $sha=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
$expectedSource='9c54183bd00c7e87f656ddc2bab02682391e58611409eaf313a79872ad65792c'
if((Source-Digest)-cne$expectedSource){throw 'FIXTURE_CLEAN_B07_SOURCE_REQUIRED'}
. $sourcePath -Library
$actual=Get-Command Invoke-ErpOwnedSession
if($actual.ScriptBlock.File-cne$sourcePath){throw 'FIXTURE_ACTUAL_FUNCTION_REQUIRED'}
if((@($actual.ScriptBlock.Ast.Parameters|ForEach-Object {$_.Name.VariablePath.UserPath})-join ',')-cne'Config,SinglePass,NativeProjection'){throw 'FIXTURE_CLEAN_SIGNATURE_REQUIRED'}

class C06NativeSessionFakeMutex {
 [string]$Mode
 [int]$Waits=0
 [int]$Releases=0
 [int]$Disposes=0
 C06NativeSessionFakeMutex([string]$mode){$this.Mode=$mode}
 [bool] WaitOne([int]$ms){
  if($ms-ne0){throw 'FIXTURE_WAIT_BUDGET_CHANGED'}
  $this.Waits++
  if($this.Mode-ceq'abandoned'){throw [Threading.AbandonedMutexException]::new('managed fake only')}
  return $this.Mode-cne'busy'
 }
 [void] ReleaseMutex(){$this.Releases++}
 [void] Dispose(){$this.Disposes++}
}
function Check($condition,[string]$code){if(!$condition){throw ('FIXTURE_'+$code)}}
$config=[pscustomobject]@{RepoRoot='C:\c06-inert-fixture';OwnerSid='FIXTURE-NOT-AN-OS-SID';RuntimeDir='C:\c06-inert-fixture\runtime';LogDir='C:\c06-inert-fixture\logs';SourceCommit=('a'*40);TaskName='FIXTURE-NOT-A-REAL-TASK';ExpectedDatabase='FIXTURE-NO-SQL'}
$native=[pscustomobject]@{scope='REVIEW_ONLY';executionAuthority=$false}
$script:cases=[Collections.Generic.List[string]]::new()
function Reset-Case([string]$mode='normal'){
 $script:f=@{mutex=[C06NativeSessionFakeMutex]::new($mode);constructors=0;names=0;directories=0;releases=0;listeners=0;owned=0;health=0;tasks=0;steadyTests=0;steady=0;unhealthy=$false;releaseError=$false;healthError=$false;writes=[Collections.Generic.List[object]]::new()}
}
function Get-ErpMutexName($Root,$OwnerSid){Check ($Root-ceq$config.RepoRoot-and$OwnerSid-ceq$config.OwnerSid) 'MUTEX_NAME_INPUT';$script:f.names++;return 'FIXTURE-NO-KERNEL-OBJECT'}
function New-Object {
 param([string]$TypeName,[object[]]$ArgumentList)
 Check ($TypeName-ceq'Threading.Mutex'-and$ArgumentList.Count-eq2-and$ArgumentList[0]-is[bool]-and!$ArgumentList[0]-and$ArgumentList[1]-ceq'FIXTURE-NO-KERNEL-OBJECT') 'MUTEX_CONSTRUCTOR_INPUT'
 $script:f.constructors++;return $script:f.mutex
}
function New-Item {param([string]$ItemType,[switch]$Force,[string[]]$Path);Check ($ItemType-ceq'Directory'-and$Force-and$Path.Count-eq2-and$Path[0]-ceq$config.RuntimeDir-and$Path[1]-ceq$config.LogDir) 'VIRTUAL_DIRECTORY_INPUT';$script:f.directories++}
function Assert-ErpRelease($Config){Check ([object]::ReferenceEquals($Config,$script:config)) 'RELEASE_CONFIG';$script:f.releases++;if($script:f.releaseError){throw 'FIXTURE_RELEASE_REJECTED'};return @{packageId='FIXTURE-NO-PACKAGE'}}
function Get-ErpServiceDefinitions($Config){Check ([object]::ReferenceEquals($Config,$script:config)) 'DEFINITIONS_CONFIG';return @(@{Name='web';Port=5194},@{Name='native';Port=4146},@{Name='api';Port=4144})}
function Test-Path {param([string]$LiteralPath);Check ($LiteralPath-ceq(Join-Path $config.RuntimeDir 'owned-processes.json')) 'VIRTUAL_RECORD_PATH';return $false}
function Get-ErpServiceListeners($Definition,$Config){Check ([object]::ReferenceEquals($Config,$script:config)) 'LISTENER_CONFIG';$script:f.listeners++;return [pscustomobject]@{OwningProcess=900001+@('web','native','api').IndexOf($Definition.Name)}}
function Assert-ErpOwnedProcess($PidValue,$Config,$Definition,$Created){Check ([object]::ReferenceEquals($Config,$script:config)-and$PidValue-eq(900001+@('web','native','api').IndexOf($Definition.Name))) 'SYNTHETIC_OWNER';$script:f.owned++;return [pscustomobject]@{ProcessId=$PidValue;CreationDate=[datetime]'2026-01-01T00:00:00Z'}}
function Assert-ErpHealth($Config,$Definition){$script:f.health++;if($script:f.healthError){throw 'TEST_STARTUP_HEALTH_FIXTURE_REJECTED'};if($script:f.unhealthy){throw 'FIXTURE_HEALTH_NOT_READY'}}
function Write-ErpState($Path,$Value){Check ($Path-ceq(Join-Path $config.RuntimeDir 'owned-processes.json')-or$Path-ceq(Join-Path $config.RuntimeDir 'health-status.json')-or$Path-ceq(Join-Path $config.LogDir 'steady-web-startup.json')) 'UNEXPECTED_VIRTUAL_WRITE';[void]$script:f.writes.Add(@{path=$Path;value=$Value})}
function Test-ErpSteadyWebStartupGeneration {$script:f.steadyTests++;return $true}
function Start-ErpSteadyWebStartup {$script:f.steady++;return @{state='fixture';attempted=$false}}
function Get-ScheduledTask {param($TaskName,$TaskPath,$ErrorAction);Check ($TaskName-ceq$config.TaskName-and$TaskPath-ceq'\') 'TASK_INPUT';$script:f.tasks++;return $null}
function Start-Process {throw 'FIXTURE_FORBIDDEN_START_PROCESS'}
function Stop-Process {throw 'FIXTURE_FORBIDDEN_STOP_PROCESS'}
function Get-Process {throw 'FIXTURE_FORBIDDEN_GET_PROCESS'}
function Get-CimInstance {throw 'FIXTURE_FORBIDDEN_CIM'}
function Invoke-WebRequest {throw 'FIXTURE_FORBIDDEN_HTTP'}
function Start-Sleep {throw 'FIXTURE_UNEXPECTED_SECOND_LOOP'}
function Assert-Business5244PostbootServiceAdmission {throw 'FIXTURE_UNEXPECTED_POSTBOOT'}
function Expect-Code([scriptblock]$Body,[string]$Expected){$code='';try{& $Body|Out-Null}catch{$code=$_.Exception.Message};Check ($code-ceq$Expected) ('EXACT_CODE_EXPECTED_'+$Expected+'_ACTUAL_'+$code)}
function Check-Closed([int]$releases=1){Check ($script:f.mutex.Waits-eq1-and$script:f.mutex.Releases-eq$releases-and$script:f.mutex.Disposes-eq1) 'MUTEX_LIFETIME'}
function Check-Ready {
 Check ($script:f.health-eq3-and$script:f.listeners-eq3-and$script:f.owned-eq3-and$script:f.directories-eq1-and$script:f.releases-eq1-and$script:f.tasks-eq1) 'SINGLE_PASS_BOUNDARIES'
 Check ($script:f.steadyTests-eq1-and$script:f.steady-eq1-and$script:f.writes.Count-eq3) 'LEGACY_STEADY_BRANCH'
 Check ($script:f.writes[2].value.startup.state-ceq'running') 'RUNNING_PROJECTION';Check-Closed
}

# Real PowerShell positional binding: the switch is named, not an extra bool
# argument. Every non-null NativeProjection rejects before touching Config.
foreach($body in @({Invoke-ErpOwnedSession $config -SinglePass -NativeProjection $native},{Invoke-ErpOwnedSession $config $native -SinglePass},{Invoke-ErpOwnedSession $config -NativeProjection $false},{Invoke-ErpOwnedSession $config -NativeProjection 0},{Invoke-ErpOwnedSession ([pscustomobject]@{}) -NativeProjection $native})){
 Reset-Case;Expect-Code $body 'TEST_NATIVE_ISSUER_UNAVAILABLE'
 Check ($script:f.names-eq0-and$script:f.constructors-eq0-and$script:f.directories-eq0-and$script:f.releases-eq0-and$script:f.listeners-eq0-and$script:f.tasks-eq0-and$script:f.writes.Count-eq0) 'NATIVE_PRE_EFFECT_REJECTION'
 [void]$script:cases.Add('non-null Native pre-effect rejection')
}
foreach($body in @({Invoke-ErpOwnedSession $config -SinglePass},{Invoke-ErpOwnedSession $config -SinglePass -NativeProjection $null},{Invoke-ErpOwnedSession $config $null -SinglePass})){
 Reset-Case;& $body;Check-Ready;[void]$script:cases.Add('legacy omitted/named/positional null')
}
Reset-Case 'abandoned';Invoke-ErpOwnedSession $config -SinglePass;Check-Ready
[void]$script:cases.Add('legacy abandoned acquire/finally')

Reset-Case 'busy';$output=@(Invoke-ErpOwnedSession $config -SinglePass)
Check ($output.Count-eq1-and$output[0]-ceq'TEST_STARTUP_ALREADY_OWNED'-and$script:f.directories-eq0-and$script:f.writes.Count-eq0-and$script:f.listeners-eq0-and$script:f.tasks-eq0) 'BUSY_NO_EFFECTS';Check-Closed 0
[void]$script:cases.Add('busy mutex no acquisition/no writes')

Reset-Case;$script:f.unhealthy=$true;Invoke-ErpOwnedSession $config -SinglePass
Check ($script:f.health-eq3-and$script:f.steadyTests-eq0-and$script:f.steady-eq0-and$script:f.writes.Count-eq2-and$script:f.writes[1].value.startup.state-ceq'degraded') 'NOT_READY_NO_STEADY';Check-Closed
[void]$script:cases.Add('not-ready suppresses steady')

Reset-Case;$script:f.releaseError=$true
Expect-Code {Invoke-ErpOwnedSession $config -SinglePass} 'FIXTURE_RELEASE_REJECTED'
Check ($script:f.listeners-eq0-and$script:f.writes.Count-eq0-and$script:f.tasks-eq0) 'RELEASE_FAILURE_NO_LATER_EFFECTS';Check-Closed
[void]$script:cases.Add('release guard failure/finally')

Reset-Case;$script:f.healthError=$true
Expect-Code {Invoke-ErpOwnedSession $config -SinglePass} 'TEST_STARTUP_HEALTH_FIXTURE_REJECTED'
Check ($script:f.health-eq1-and$script:f.steady-eq0-and$script:f.writes.Count-eq0-and$script:f.tasks-eq0) 'HEALTH_GUARD_NO_LATER_EFFECTS';Check-Closed
[void]$script:cases.Add('health guard failure/finally')

Check ((Source-Digest)-ceq$expectedSource) 'PRODUCTION_SOURCE_CHANGED'
Check ($script:cases.Count-eq13) 'CASE_COUNT'
[pscustomobject]@{status='PASS';cases=$script:cases.Count;sourceCommit='b07b1ed5e96dfcc9689aef4a721209b2af73de91';productionSourceNormalizedSha256=$expectedSource;fixtureOnly=$true;realMutexCalls=0;realProcessCalls=0;realFileWrites=0;realTaskCalls=0;realNetworkCalls=0;sqlCalls=0;runtimeAuthority=$false}|ConvertTo-Json -Compress
