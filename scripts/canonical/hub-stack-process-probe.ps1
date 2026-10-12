param([Parameter(Mandatory=$true)][ValidatePattern('^(4184|4186|5234|5244|62700|62701|62702|62703|62704)(,(4184|4186|5234|5244|62700|62701|62702|62703|62704))*$')][string]$Ports,[ValidateRange(1,2147483647)][int]$ProcessId)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Read-only OS observation. No process/task/grant or network mutation.
$script:probePhase='NETTCP'
$script:probeReturnValue=$null
$script:probeChildMissing=$false
function Get-VerifiedProbeOwnerSid($process){
 $script:probeReturnValue=$null
 $owner=Invoke-CimMethod $process -MethodName GetOwnerSid
 if(!$owner-or!$owner.PSObject.Properties['ReturnValue']){throw 'HUB_STACK_OS_OWNER_RESULT_INVALID'}
 $value=$owner.ReturnValue
 if($value-is[int]-or$value-is[uint32]-or$value-is[int64]-or$value-is[uint64]){
  if($value-ge0-and$value-le65535){$script:probeReturnValue=[int]$value}
 }
 if($null-eq$script:probeReturnValue-or$script:probeReturnValue-ne0-or!$owner.PSObject.Properties['Sid']-or$owner.Sid-isnot[string]){throw 'HUB_STACK_OS_OWNER_RESULT_INVALID'}
 $sid=$owner.Sid
 if($sid.length-gt184-or$sid-cnotmatch'^S-1-[0-9]+(?:-[0-9]+){1,15}$'){throw 'HUB_STACK_OS_OWNER_SID_INVALID'}
 $validated=[System.Security.Principal.SecurityIdentifier]::new($sid)
 if($validated.Value-cne$sid){throw 'HUB_STACK_OS_OWNER_SID_INVALID'}
 return $sid
}
try{
 # Root observed this exact Windows no-match ID on an unused allowed port.
 # Preserve valid empty results; do not suppress other nonterminating errors.
 $probeNetErrors=@()
 $bindings=@(Get-NetTCPConnection -State Listen -LocalPort @($Ports.Split(',')|ForEach-Object {[int]$_}) -ErrorAction SilentlyContinue -ErrorVariable probeNetErrors)
 foreach($netError in @($probeNetErrors)){
  if($netError.FullyQualifiedErrorId-cne'CmdletizationQuery_NotFound,Get-NetTCPConnection'-or[string]$netError.CategoryInfo.Category-cne'ObjectNotFound'){throw $netError}
 }
 $rows=@()
 $ids=if($PSBoundParameters.ContainsKey('ProcessId')){@($ProcessId)}else{@($bindings|ForEach-Object {$_.OwningProcess}|Select-Object -Unique)}
 foreach($procId in $ids){
  $script:probeReturnValue=$null;$script:probePhase='CHILD_CIM'
  $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$procId)
  if(!$p){$script:probeChildMissing=$true;throw 'HUB_STACK_OS_PROCESS_DISAPPEARED'}
  $script:probePhase='CHILD_MANAGED';$managed=Get-Process -Id $procId -ErrorAction Stop
  $script:probePhase='PARENT_CIM';$parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$p.ParentProcessId)
  $script:probePhase='CHILD_OWNER';$ownerSid=Get-VerifiedProbeOwnerSid $p
  $parentOwnerSid=$null
  if($parent){$script:probePhase='PARENT_OWNER';$parentOwnerSid=Get-VerifiedProbeOwnerSid $parent}
  $script:probeReturnValue=$null;$script:probePhase='CREATION'
  $creationTime=$p.CreationDate.ToUniversalTime().ToString('o')
  $managedCreationTime=$managed.StartTime.ToUniversalTime().ToString('o')
  $parentCreationTime=if($parent){$parent.CreationDate.ToUniversalTime().ToString('o')}else{$null}
  $rows+=,[pscustomobject]@{pid=[int]$procId;parentPid=[int]$p.ParentProcessId;ownerSid=$ownerSid;nodePath=$p.ExecutablePath;commandLine=$p.CommandLine;creationTime=$creationTime;managedCreationTime=$managedCreationTime;parentOwnerSid=$parentOwnerSid;parentNodePath=if($parent){$parent.ExecutablePath}else{$null};parentCommandLine=if($parent){$parent.CommandLine}else{$null};parentCreationTime=$parentCreationTime;bindings=@($bindings|Where-Object OwningProcess -eq $procId|ForEach-Object {[pscustomobject]@{address=$_.LocalAddress;port=$_.LocalPort}})}
 }
 $script:probeReturnValue=$null;$script:probePhase='SERIALIZE'
 ConvertTo-Json -InputObject @($rows) -Depth 4 -Compress
}catch{
 $caught=$_
 $categories=@('NotSpecified','ObjectNotFound','PermissionDenied','InvalidOperation','InvalidArgument','InvalidData','ResourceUnavailable','OperationStopped')
 $types=@('RuntimeException','CimException','CimJobException','ItemNotFoundException','MethodInvocationException','PropertyNotFoundException','ArgumentException','InvalidOperationException','Win32Exception')
 $category=[string]$caught.CategoryInfo.Category;if($categories-cnotcontains$category){$category='OtherCategory'}
 $type=$caught.Exception.GetType().Name;if($types-cnotcontains$type){$type='OtherError'}
 $nativeHResult=0;$value=$caught.Exception.HResult
 if(($value-is[int]-or$value-is[int64])-and$value-ge[int]::MinValue-and$value-le[int]::MaxValue){$nativeHResult=[int]$value}
 # Every string is an internal finite enum, every number a bounded integer.
 # Manual serialization also cannot leak a second serializer exception.
 $diagnostic='{"schemaVersion":"melisa-hub-stack-os-probe-failure.v1","phase":"'+$script:probePhase+'","errorCategory":"'+$category+'","errorType":"'+$type+'","nativeHResult":'+$nativeHResult.ToString([Globalization.CultureInfo]::InvariantCulture)
 if($null-ne$script:probeReturnValue){$diagnostic+=',"finiteReturnValue":'+$script:probeReturnValue.ToString([Globalization.CultureInfo]::InvariantCulture)}
 $diagnostic+='}'
 # Preserve the prior missing-child marker using control flow, never messages.
 if($script:probeChildMissing){[Console]::Error.WriteLine('HUB_STACK_OS_PROCESS_DISAPPEARED')}
 [Console]::Error.WriteLine('HUB_STACK_OS_PROBE_FAILURE '+$diagnostic)
 exit 1
}
