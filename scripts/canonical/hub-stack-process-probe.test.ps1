param([Parameter(Mandatory=$true)][string]$SourcePath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Each subprocess shadows EVERY OS observation; production failure exit1 cannot
# abort this test harness. No live TCP/CIM/managed-process query is performed.
$source=[IO.File]::ReadAllText((Resolve-Path -LiteralPath $SourcePath).Path)
if($source-notmatch'Get-NetTCPConnection -State Listen -LocalPort @\(\$Ports.Split\(''[,]''\)\|ForEach-Object \{\[int\]\$_\}\) -ErrorAction SilentlyContinue'){throw 'OFFLINE_WINDOWS_BINDING_QUERY_CHANGED'}
foreach($file in @($SourcePath,$PSCommandPath)){
 $tokens=$null;$errors=$null
 [void][Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)
 if($errors.Count-ne0){throw 'OFFLINE_PARSER_FAILED'}
}
$shell=Join-Path $PSHOME 'powershell.exe'
if(!(Test-Path -LiteralPath $shell)){$shell=Join-Path $PSHOME 'pwsh.exe'}
$escapedSource=(Resolve-Path -LiteralPath $SourcePath).Path.Replace("'","''")
function Run-Fixture([string]$mode,[string]$ports='4184',[bool]$boundPid=$false){
 $template=@'
$ProgressPreference='SilentlyContinue'
$global:probeFixtureMode='__MODE__'
$global:probeFixturePorts='__PORTS__'
$global:probeFixtureOwnerCalls=0
$global:probeFixtureParentCimCalls=0
$global:probeFixtureParentOwnerCalls=0
function Throw-FixtureCimError([string]$category){
 $exception=[Microsoft.Management.Infrastructure.CimException]::new('PRIVATE_OS_SECRET native owner')
 throw [Management.Automation.ErrorRecord]::new($exception,'PRIVATE_NATIVE_OWNER',[Management.Automation.ErrorCategory]$category,$null)
}
function Get-NetTCPConnection {
 [CmdletBinding()]param($State,$LocalPort)
 if($State-cne'Listen'-or$PSBoundParameters['ErrorAction']-cne'SilentlyContinue'-or$PSBoundParameters['ErrorVariable']-cne'probeNetErrors'-or(@($LocalPort)-join',')-cne$global:probeFixturePorts){throw 'OFFLINE_TRANSPORT_ARGUMENTS_CHANGED'}
 if($global:probeFixtureMode-eq'NETTCP'){throw [InvalidOperationException]::new('PRIVATE_OS_SECRET S-1-5-21-999 C:\secret --password hidden')}
 if($global:probeFixtureMode-eq'NETTCP_PERMISSION'){Write-Error -Message 'PRIVATE_OS_SECRET permission' -Category PermissionDenied -ErrorId PRIVATE_PERMISSION;return @()}
 if($global:probeFixtureMode-eq'NETTCP_FOREIGN_NOTFOUND'){Write-Error -Message 'PRIVATE_OS_SECRET foreign notfound' -Category ObjectNotFound -ErrorId FOREIGN_NOTFOUND;return @()}
 if($global:probeFixtureMode-eq'NETTCP_NOMATCH'){Write-Error -Message 'PRIVATE_OS_SECRET expected no match' -Category ObjectNotFound -ErrorId CmdletizationQuery_NotFound;return @()}
 if($global:probeFixtureMode-eq'NETTCP_NOMATCH_WRONG_CATEGORY'){Write-Error -Message 'PRIVATE_OS_SECRET wrong category' -Category PermissionDenied -ErrorId CmdletizationQuery_NotFound;return @()}
 if($global:probeFixtureMode-eq'NETTCP_MIXED'){Write-Error -Message 'PRIVATE_OS_SECRET expected no match' -Category ObjectNotFound -ErrorId CmdletizationQuery_NotFound;Write-Error -Message 'PRIVATE_OS_SECRET permission' -Category PermissionDenied -ErrorId PRIVATE_PERMISSION;return @()}
 if($global:probeFixtureMode-eq'EMPTY'-or$global:probeFixtureMode-eq'BOUND_EMPTY'){return @()}
 if($global:probeFixturePorts-eq'62700,62701'){return @([pscustomobject]@{OwningProcess=12;LocalAddress='127.0.0.1';LocalPort=62700},[pscustomobject]@{OwningProcess=12;LocalAddress='192.168.1.46';LocalPort=62700},[pscustomobject]@{OwningProcess=12;LocalAddress='127.0.0.1';LocalPort=62701})}
 return @([pscustomobject]@{OwningProcess=12;LocalAddress='127.0.0.1';LocalPort=4184},[pscustomobject]@{OwningProcess=12;LocalAddress='192.168.1.46';LocalPort=4184})
}
function Get-CimInstance {
 param($ClassName,$Filter)
 if($ClassName-cne'Win32_Process'){throw 'OFFLINE_CIM_CLASS_CHANGED'}
 $id=[int]($Filter.Split('=')[1])
 if($id-eq11){
  $global:probeFixtureParentCimCalls++
  if($global:probeFixtureParentCimCalls-gt2){throw 'OFFLINE_PARENT_REOBSERVE_LIMIT'}
  if($global:probeFixtureParentCimCalls-eq2-and$global:probeFixtureMode-eq'PARENT_RACE_GONE'){return $null}
  if($global:probeFixtureParentCimCalls-eq2-and$global:probeFixtureMode-eq'PARENT_RACE_REOBSERVE_DENIED'){Throw-FixtureCimError 'PermissionDenied'}
 }
 if($global:probeFixtureMode-eq'DISAPPEARED'-and$id-eq12){return $null}
 if($global:probeFixtureMode-eq'CHILD_CIM'-and$id-eq12){throw [InvalidOperationException]::new('PRIVATE_OS_SECRET child CIM')}
 if($global:probeFixtureMode-eq'PARENT_CIM'-and$id-eq11){throw [InvalidOperationException]::new('PRIVATE_OS_SECRET parent CIM')}
 if($global:probeFixtureMode-eq'NO_PARENT'-and$id-eq11){return $null}
 $date=[datetime]::SpecifyKind([datetime]'2026-10-11T12:00:00',[DateTimeKind]::Utc)
 if($id-eq11-and$global:probeFixtureParentCimCalls-eq2){
  if($global:probeFixtureMode-eq'PARENT_RACE_REUSED'){$date=$date.AddSeconds(1)}
  if($global:probeFixtureMode-eq'PARENT_RACE_MALFORMED'){$date='PRIVATE_OS_SECRET malformed parent'}
  if($global:probeFixtureMode-eq'PARENT_RACE_PID_CHANGED'){$id=99}
 }
 if($global:probeFixtureMode-eq'CREATION'-and$id-eq12){$date='PRIVATE_OS_SECRET malformed time'}
 return [pscustomobject]@{ProcessId=$id;ParentProcessId=if($id-eq12){11}else{10};ExecutablePath='C:\Program Files\nodejs\node.exe';CommandLine='synthetic fixture';CreationDate=$date}
}
function Get-Process {param($Id,$ErrorAction) if($Id-ne12-or$ErrorAction-cne'Stop'){throw 'OFFLINE_MANAGED_ARGUMENTS_CHANGED'};if($global:probeFixtureMode-eq'CHILD_MANAGED'){throw [InvalidOperationException]::new('PRIVATE_OS_SECRET managed')};return [pscustomobject]@{StartTime=[datetime]::SpecifyKind([datetime]'2026-10-11T12:00:00',[DateTimeKind]::Utc)}}
function Invoke-CimMethod {
 param($InputObject,$MethodName)
 if($MethodName-cne'GetOwnerSid'){throw 'OFFLINE_OWNER_METHOD_CHANGED'}
 if($InputObject.ProcessId-eq11){$global:probeFixtureParentOwnerCalls++;if($global:probeFixtureParentOwnerCalls-gt1){throw 'OFFLINE_PARENT_OWNER_RETRY_FORBIDDEN'}}
 if($InputObject.ProcessId-eq11-and$global:probeFixtureMode.StartsWith('PARENT_RACE_')){Throw-FixtureCimError 'ObjectNotFound'}
 if($InputObject.ProcessId-eq11-and$global:probeFixtureMode-eq'PARENT_NATIVE_PERMISSION'){Throw-FixtureCimError 'PermissionDenied'}
 if($InputObject.ProcessId-eq12-and$global:probeFixtureMode-eq'CHILD_NATIVE_NOTFOUND'){Throw-FixtureCimError 'ObjectNotFound'}
 if($InputObject.ProcessId-eq11-and$global:probeFixtureMode-eq'PARENT_FOREIGN_NOTFOUND'){throw [Management.Automation.ErrorRecord]::new([InvalidOperationException]::new('PRIVATE_OS_SECRET foreign type'),'PRIVATE_OTHER',[Management.Automation.ErrorCategory]::ObjectNotFound,$null)}
 if($InputObject.ProcessId-eq12-and$global:probeFixtureMode-eq'CHILD_OWNER'){throw [InvalidOperationException]::new('PRIVATE_OS_SECRET child owner')}
 if($InputObject.ProcessId-eq11-and$global:probeFixtureMode-eq'PARENT_OWNER'){throw [InvalidOperationException]::new('PRIVATE_OS_SECRET parent owner')}
 if($InputObject.ProcessId-eq12-and$global:probeFixtureMode-eq'OWNER_NONZERO'){return [pscustomobject]@{ReturnValue=[uint32]2;Sid='PRIVATE_OS_SECRET'}}
 if($InputObject.ProcessId-eq11-and$global:probeFixtureMode-eq'PARENT_NONZERO'){return [pscustomobject]@{ReturnValue=[uint32]3;Sid='PRIVATE_OS_SECRET'}}
 if($InputObject.ProcessId-eq12-and$global:probeFixtureMode-eq'OWNER_MISSING_SID'){return [pscustomobject]@{ReturnValue=[uint32]0}}
 if($InputObject.ProcessId-eq12-and$global:probeFixtureMode-eq'OWNER_BAD_SID'){return [pscustomobject]@{ReturnValue=[uint32]0;Sid='PRIVATE_OS_SECRET'}}
 if($InputObject.ProcessId-eq11-and$global:probeFixtureMode-eq'PARENT_BAD_SID'){return [pscustomobject]@{ReturnValue=[uint32]0;Sid='PRIVATE_OS_SECRET'}}
 if($InputObject.ProcessId-eq12-and$global:probeFixtureMode-eq'OWNER_MISSING_RETURN'){return [pscustomobject]@{Sid='S-1-5-21-123-456-789-1001'}}
 return [pscustomobject]@{ReturnValue=[uint32]0;Sid='S-1-5-21-123-456-789-1001'}
}
if($global:probeFixtureMode-eq'SERIALIZE'){function ConvertTo-Json {param($InputObject,$Depth,[switch]$Compress) throw [InvalidOperationException]::new('PRIVATE_OS_SECRET serialize')}}
& '__SOURCE__' -Ports '__PORTS__' __BOUND__
if($global:probeFixtureMode-eq'PARENT_RACE_GONE'-and($global:probeFixtureParentCimCalls-ne2-or$global:probeFixtureParentOwnerCalls-ne1)){throw 'OFFLINE_PARENT_RACE_OBSERVATION_COUNTS'}
'@
 $text=$template.Replace('__MODE__',$mode).Replace('__PORTS__',$ports).Replace('__SOURCE__',$escapedSource).Replace('__BOUND__',$(if($boundPid){'-ProcessId 12'}else{''}))
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$shell;$info.Arguments='-NoProfile -NonInteractive -EncodedCommand '+[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($text));$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden';$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 $child=[Diagnostics.Process]::new();$child.StartInfo=$info
 try{[void]$child.Start();$stdout=$child.StandardOutput.ReadToEnd();$stderr=$child.StandardError.ReadToEnd();$child.WaitForExit();return [pscustomobject]@{exitCode=$child.ExitCode;stdout=$stdout.Trim();stderr=$stderr.Trim()}}finally{$child.Dispose()}
}
function Assert-Diagnostic([string]$mode,[string]$phase,$returnValue=$null){
 $v=Run-Fixture $mode
 if($v.exitCode-ne1-or$v.stdout-cne''-or$v.stderr-match'PRIVATE_OS_SECRET|C:\\secret|--password|hidden'){throw 'OFFLINE_FAILURE_REDACTION_FAILED'}
 $lines=@($v.stderr-split'\r?\n');if($mode-eq'DISAPPEARED'){if($lines[0]-cne'HUB_STACK_OS_PROCESS_DISAPPEARED'){throw 'OFFLINE_DISAPPEARED_COMPATIBILITY_FAILED'};$lines=@($lines|Select-Object -Skip 1)}
 if($lines.Count-ne1-or!$lines[0].StartsWith('HUB_STACK_OS_PROBE_FAILURE ')){throw 'OFFLINE_DIAGNOSTIC_ENVELOPE_FAILED'}
 $d=ConvertFrom-Json $lines[0].Substring('HUB_STACK_OS_PROBE_FAILURE '.Length)
 $keys=@($d.PSObject.Properties.Name|Sort-Object);$expected=@('schemaVersion','phase','errorCategory','errorType','nativeHResult');if($null-ne$returnValue){$expected+=,'finiteReturnValue'}
 if(($keys-join',')-cne(@($expected|Sort-Object)-join',')-or$d.schemaVersion-cne'melisa-hub-stack-os-probe-failure.v1'-or$d.phase-cne$phase){throw 'OFFLINE_DIAGNOSTIC_FIELDS_FAILED'}
 if(@('NotSpecified','ObjectNotFound','PermissionDenied','InvalidOperation','InvalidArgument','InvalidData','ResourceUnavailable','OperationStopped','OtherCategory')-cnotcontains$d.errorCategory-or@('RuntimeException','CimException','CimJobException','ItemNotFoundException','MethodInvocationException','PropertyNotFoundException','ArgumentException','InvalidOperationException','Win32Exception','OtherError')-cnotcontains$d.errorType){throw 'OFFLINE_DIAGNOSTIC_ENUM_FAILED'}
 if($d.nativeHResult-isnot[int]-and$d.nativeHResult-isnot[int64]){throw 'OFFLINE_DIAGNOSTIC_HRESULT_FAILED'}
 if($null-ne$returnValue-and$d.finiteReturnValue-ne$returnValue){throw 'OFFLINE_DIAGNOSTIC_RETURN_FAILED'}
 Write-Output ('PASS '+$mode+'_'+$phase+'_failclosed_redacted')
}
$empty=Run-Fixture 'EMPTY';if($empty.exitCode-ne0-or$empty.stdout-cne'[]'-or$empty.stderr-cne''){throw 'OFFLINE_EMPTY_BINDINGS_FAILED'}
Write-Output 'PASS PS5_StrictMode_empty_bindings_returns_empty_json'
foreach($ports in @('4184','62700,62701')){
 $v=Run-Fixture 'NORMAL' $ports;$decoded=ConvertFrom-Json $v.stdout;$rows=@($decoded)
 if($v.exitCode-ne0-or$v.stderr-cne''-or$rows.Count-ne1-or$rows[0].pid-ne12-or$rows[0].parentPid-ne11-or$rows[0].ownerSid-cne'S-1-5-21-123-456-789-1001'-or$rows[0].parentOwnerSid-cne$rows[0].ownerSid){throw 'OFFLINE_POPULATED_BINDINGS_FAILED'}
 if($rows[0].bindings.Count-ne$(if($ports-eq'4184'){2}else{3})){throw 'OFFLINE_DUAL_BINDINGS_FAILED'}
 if((@($rows[0].PSObject.Properties.Name|Sort-Object)-join',')-cne'bindings,commandLine,creationTime,managedCreationTime,nodePath,ownerSid,parentCommandLine,parentCreationTime,parentNodePath,parentOwnerSid,parentPid,pid'){throw 'OFFLINE_NORMAL_SCHEMA_CHANGED'}
 Write-Output ('PASS normal_'+$ports.Replace(',','_')+'_schema_binding_identity_preserved')
}
$bound=Run-Fixture 'BOUND_EMPTY' '4184' $true;$decoded=ConvertFrom-Json $bound.stdout;$row=@($decoded);if($bound.exitCode-ne0-or$row.Count-ne1-or$row[0].bindings.Count-ne0){throw 'OFFLINE_BOUND_PID_BEFORE_LISTEN_FAILED'}
Write-Output 'PASS bound_PID_before_listen_remains_unready_row'
$absent=Run-Fixture 'NO_PARENT';$decoded=ConvertFrom-Json $absent.stdout;$row=@($decoded);if($absent.exitCode-ne0-or$null-ne$row[0].parentOwnerSid-or$null-ne$row[0].parentCreationTime){throw 'OFFLINE_ABSENT_PARENT_SHAPE_CHANGED'}
Write-Output 'PASS absent_parent_remains_null_for_external_guard_rejection'
$gone=Run-Fixture 'PARENT_RACE_GONE';$decoded=ConvertFrom-Json $gone.stdout;$row=@($decoded)
if($gone.exitCode-ne0-or$gone.stderr-cne''-or$row.Count-ne1-or$row[0].pid-ne12-or$row[0].parentPid-ne11-or$row[0].ownerSid-cne'S-1-5-21-123-456-789-1001'-or$row[0].creationTime-cne$row[0].managedCreationTime-or$row[0].bindings.Count-ne2){throw 'OFFLINE_PARENT_RACE_CHILD_IDENTITY_CHANGED'}
foreach($key in @('parentOwnerSid','parentNodePath','parentCommandLine','parentCreationTime')){if($null-ne$row[0].$key){throw 'OFFLINE_PARENT_RACE_NOT_ABSENT'}}
Write-Output 'PASS exact_native_parent_owner_notfound_then_single_absent_reobserve_preserves_child'
foreach($mode in @('PARENT_RACE_PRESENT','PARENT_RACE_REUSED','PARENT_RACE_PID_CHANGED','PARENT_RACE_MALFORMED','PARENT_RACE_REOBSERVE_DENIED','PARENT_NATIVE_PERMISSION','PARENT_FOREIGN_NOTFOUND')){Assert-Diagnostic $mode 'PARENT_OWNER'}
Assert-Diagnostic 'CHILD_NATIVE_NOTFOUND' 'CHILD_OWNER'
foreach($phase in @('NETTCP','CHILD_CIM','CHILD_MANAGED','PARENT_CIM','CHILD_OWNER','PARENT_OWNER','CREATION','SERIALIZE')){Assert-Diagnostic $phase $phase}
Assert-Diagnostic 'NETTCP_PERMISSION' 'NETTCP'
Assert-Diagnostic 'NETTCP_FOREIGN_NOTFOUND' 'NETTCP'
Assert-Diagnostic 'NETTCP_NOMATCH_WRONG_CATEGORY' 'NETTCP'
Assert-Diagnostic 'NETTCP_MIXED' 'NETTCP'
$noMatch=Run-Fixture 'NETTCP_NOMATCH';if($noMatch.exitCode-ne0-or$noMatch.stdout-cne'[]'-or$noMatch.stderr-cne''){throw 'OFFLINE_EXACT_NOMATCH_FAILED'}
Write-Output 'PASS exact_native_no_match_id_empty_is_preserved'
Assert-Diagnostic 'DISAPPEARED' 'CHILD_CIM'
Assert-Diagnostic 'OWNER_NONZERO' 'CHILD_OWNER' 2
Assert-Diagnostic 'PARENT_NONZERO' 'PARENT_OWNER' 3
Assert-Diagnostic 'OWNER_MISSING_SID' 'CHILD_OWNER' 0
Assert-Diagnostic 'OWNER_BAD_SID' 'CHILD_OWNER' 0
Assert-Diagnostic 'PARENT_BAD_SID' 'PARENT_OWNER' 0
Assert-Diagnostic 'OWNER_MISSING_RETURN' 'CHILD_OWNER'
Write-Output 'PASS parser_zero_errors_no_live_OS_queries'
