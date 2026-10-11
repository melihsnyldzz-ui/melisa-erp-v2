param([Parameter(Mandatory=$true)][ValidatePattern('^(4184|4186|5234|5244|62700|62701|62702|62703|62704)(,(4184|4186|5234|5244|62700|62701|62702|62703|62704))*$')][string]$Ports,[ValidateRange(1,2147483647)][int]$ProcessId)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Read-only OS observation. No process/task/grant or network mutation.
$bindings=@(Get-NetTCPConnection -State Listen -LocalPort @($Ports.Split(',')|ForEach-Object {[int]$_}) -ErrorAction SilentlyContinue)
$rows=@()
$ids=if($PSBoundParameters.ContainsKey('ProcessId')){@($ProcessId)}else{@($bindings|ForEach-Object {$_.OwningProcess}|Select-Object -Unique)}
foreach($procId in $ids){
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$procId)
 if(!$p){throw 'HUB_STACK_OS_PROCESS_DISAPPEARED'}
 $managed=Get-Process -Id $procId -ErrorAction Stop
 $parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$p.ParentProcessId)
 $rows+=,[pscustomobject]@{pid=[int]$procId;parentPid=[int]$p.ParentProcessId;ownerSid=(Invoke-CimMethod $p -MethodName GetOwnerSid).Sid;nodePath=$p.ExecutablePath;commandLine=$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');managedCreationTime=$managed.StartTime.ToUniversalTime().ToString('o');parentOwnerSid=if($parent){(Invoke-CimMethod $parent -MethodName GetOwnerSid).Sid}else{$null};parentNodePath=if($parent){$parent.ExecutablePath}else{$null};parentCommandLine=if($parent){$parent.CommandLine}else{$null};parentCreationTime=if($parent){$parent.CreationDate.ToUniversalTime().ToString('o')}else{$null};bindings=@($bindings|Where-Object OwningProcess -eq $procId|ForEach-Object {[pscustomobject]@{address=$_.LocalAddress;port=$_.LocalPort}})}
}
ConvertTo-Json -InputObject @($rows) -Depth 4 -Compress
