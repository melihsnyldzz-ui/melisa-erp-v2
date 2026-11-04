param([Parameter(Mandatory=$true)][string]$StartupConfigPath,[ValidateSet('Inspect','Start')][string]$Action='Inspect',[switch]$Watch,[switch]$LightRehearsal,[string]$RunId,[int]$Attempt=0)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($LightRehearsal-and($Watch-or$PSBoundParameters.ContainsKey('RunId')-or$PSBoundParameters.ContainsKey('Attempt'))){throw 'HUB_LIGHT_LINEAGE_FLAGS_REJECTED'}
# Manual, web-only launcher. Does not install tasks, stop owners or start API/SQL.
function Assert-HubPath($Target,$Root){
 $full=[IO.Path]::GetFullPath($Target);$base=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
 if(!$full.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'HUB_PACKAGE_PATH_REJECTED'}
 $cursor=$full
 while($cursor -and $cursor.Length -ge $base.Length){if(((Get-Item -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'HUB_REPARSE_POINT_REJECTED'};if($cursor -eq $base){break};$cursor=[IO.Path]::GetDirectoryName($cursor)}
}
if(![IO.Path]::IsPathRooted($StartupConfigPath)){throw 'HUB_STARTUP_CONFIG_REQUIRED'}
$c=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
$keys=@('PackageRoot','SourceCommit','ManifestSha256','OperationConfigPath','HubConfigPath','NodePath','NodeSha256','OwnerSid','RuntimeDir')
if(@($c.PSObject.Properties).Count -ne $keys.Count){throw 'HUB_STARTUP_FIELDS_REJECTED'}
foreach($key in $keys){if(!$c.PSObject.Properties[$key] -or !$c.$key){throw 'HUB_STARTUP_FIELD_REQUIRED'}}
foreach($key in @('PackageRoot','OperationConfigPath','HubConfigPath','NodePath','RuntimeDir')){if(![IO.Path]::IsPathRooted($c.$key) -or $c.$key -match '["\r\n]'){throw 'HUB_STARTUP_PATH_REJECTED'}}
foreach($private in @($StartupConfigPath,$c.OperationConfigPath,$c.HubConfigPath,$c.RuntimeDir)){if([IO.Path]::GetFullPath($private).StartsWith([IO.Path]::GetFullPath($c.PackageRoot).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'HUB_PRIVATE_STATE_OVERLAP'}}
if($c.SourceCommit -notmatch '^[a-f0-9]{40}$' -or $c.ManifestSha256 -notmatch '^[a-fA-F0-9]{64}$' -or $c.NodeSha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'HUB_STARTUP_PIN_REJECTED'}
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne $c.OwnerSid){throw 'HUB_STARTUP_OWNER_REJECTED'}
if($LightRehearsal){
 if($c.PackageRoot-cnotmatch'\AC:\\Sirket\\ERP\\rehearsal\\ERP-LIGHT-REHEARSAL-20261019-1253\\run-[a-f0-9]{32}\\(?:old|new)\\CANONICAL-(?:COMPLETE|CANDIDATE)-TEST-[a-z0-9-]+\z'){throw 'HUB_LIGHT_ROOT_REJECTED'}
 Assert-HubPath $c.PackageRoot 'C:\Sirket\ERP\rehearsal\ERP-LIGHT-REHEARSAL-20261019-1253'
}else{Assert-HubPath $c.PackageRoot 'C:\Sirket\ERP\releases'}
$packageName=Split-Path $c.PackageRoot -Leaf
# Retain the approved Hub package family and admit only the exact current
# completion family whose suffix identifies this pinned source commit.
$completionName=$packageName -cmatch '^CANONICAL-COMPLETE-TEST-(?:20261011|20261017|20261018)-([a-f0-9]{7,12})$'
$completionSource=$completionName -and $c.SourceCommit.StartsWith($Matches[1])
# The reviewed candidate family uses an eight-character prefix on this date.
# The full source and every package byte remain pinned by the manifest below.
$candidateName=$packageName -cmatch '^CANONICAL-CANDIDATE-TEST-20261019-([a-f0-9]{8})$'
$candidateSource=$candidateName -and [regex]::IsMatch($c.SourceCommit,'\A[a-f0-9]{40}\z') -and $c.SourceCommit.StartsWith($Matches[1],[StringComparison]::Ordinal)
if(!$packageName.StartsWith('CANONICAL-HUB-TEST-') -and !$completionSource -and !$candidateSource){throw 'HUB_PACKAGE_SCOPE_REJECTED'}
if((Get-FileHash -LiteralPath $c.NodePath -Algorithm SHA256).Hash -ne $c.NodeSha256){throw 'HUB_NODE_PIN_REJECTED'}
$manifestFile=Join-Path $c.PackageRoot 'release-manifest.json'
if((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash -ne $c.ManifestSha256){throw 'HUB_MANIFEST_PIN_REJECTED'}
$m=Get-Content -LiteralPath $manifestFile -Raw|ConvertFrom-Json
if($LightRehearsal){if((@($m.PSObject.Properties.Name|Sort-Object)-join'|')-cne'actualT1|childConfigSha256|environment|files|generation|launcherSource|port|schemaVersion|sourceCommit|sqlFree'-or$m.schemaVersion-cne'melisa-p03-light-hub-package.v1'-or$m.environment-cne'P03_LIGHT_REHEARSAL'-or$m.sourceCommit-cne$c.SourceCommit-or$m.sqlFree-ne$true-or$m.port-ne5354-or$m.actualT1-ne$false-or(Get-FileHash -LiteralPath $c.OperationConfigPath -Algorithm SHA256).Hash-ine$m.childConfigSha256-or$m.PSObject.Properties.Name-contains'sharedTestCopy'){throw 'HUB_LIGHT_RELEASE_SCOPE_REJECTED'}}else{if($m.sourceCommit -ne $c.SourceCommit -or !$m.baselineReproduced -or $m.sharedTestCopy.database -ne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $m.sharedTestCopy.webPort -ne 5234 -or $m.sharedTestCopy.actualT1 -ne $false){throw 'HUB_RELEASE_SCOPE_REJECTED'}}
foreach($file in $m.files){$target=Join-Path $c.PackageRoot $file.path;Assert-HubPath $target $c.PackageRoot;if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $file.sha256){throw 'HUB_PACKAGE_HASH_REJECTED'}}
if($LightRehearsal){
 $lightEntry=Join-Path $c.PackageRoot 'launcher\start-hub-light-rehearsal.ps1'
 Assert-HubPath $lightEntry $c.PackageRoot
 if(@($m.files|Where-Object{$_.path-ceq'launcher/start-hub-light-rehearsal.ps1'}).Count-ne1){throw 'HUB_LIGHT_LAUNCHER_PIN_REQUIRED'}
 & $lightEntry -StartupConfigPath $StartupConfigPath -Action $Action
 exit 0
}
$operation=Get-Content -LiteralPath $c.OperationConfigPath -Raw|ConvertFrom-Json
$pin=Get-Content -LiteralPath $c.HubConfigPath -Raw|ConvertFrom-Json
if($operation.database -ne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $operation.webPort -ne 5234 -or $operation.erpPort -ne 4184 -or $operation.nativePort -ne 4186 -or $operation.host -ne '127.0.0.1' -or $operation.lanHost -ne '192.168.1.46'){throw 'HUB_OPERATION_SCOPE_REJECTED'}
foreach($port in @(4184,4186)){
 $health=Invoke-RestMethod ('http://127.0.0.1:'+$port+'/test-health') -TimeoutSec 3 -MaximumRedirection 0
 if(!$health.ok -or $health.environment -ne 'ISOLATED_TEST_COPY' -or $health.port -ne $port -or $health.databaseName -ne $operation.database -or $health.copyId -ne $operation.copyContext.copyId -or $health.sourceCommit -ne $pin.apiSourceCommit -or $health.actualT1 -ne $false -or $health.sysadmin -ne 0 -or $health.databaseControl -ne 0 -or $health.liveDatabaseAccess -ne 0 -or $health.originalDatabaseAccess -ne 0){throw 'HUB_DEPENDENCY_IDENTITY_REJECTED'}
}
if($Action -eq 'Inspect'){Write-Output 'HUB_WEB_PACKAGE_AND_DEPENDENCIES_VERIFIED';exit 0}
if(@(Get-NetTCPConnection -State Listen -LocalPort 5234 -ErrorAction SilentlyContinue).Count){throw 'HUB_WEB_PORT_ALREADY_OWNED'}
New-Item -ItemType Directory -Force -Path $c.RuntimeDir|Out-Null
$entry=Join-Path $c.PackageRoot 'apps\api\start-shared-test-copy-web.mjs'
$run=if($RunId){$RunId}else{[guid]::NewGuid().ToString('N')}
if($run -cnotmatch '^[a-f0-9]{32}$' -or $Attempt -lt 0 -or $Attempt -gt 3){throw 'HUB_LINEAGE_ATTEMPT_REJECTED'}
$launcher=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID)
$parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$launcher.ParentProcessId)
if(!$parent -or (Invoke-CimMethod $parent -MethodName GetOwnerSid).Sid -ne $c.OwnerSid){throw 'HUB_LAUNCHER_PARENT_REJECTED'}
# The scheduled wrapper invokes watch-hub-web.ps1 in its own process;
# manual starts retain the owner-scoped path and receive a receipt too. The
# parent must have the same owner SID so its recorded chain has a trusted root.
$launcherSid=(Invoke-CimMethod $launcher -MethodName GetOwnerSid).Sid
if($launcherSid -ne $c.OwnerSid){throw 'HUB_LAUNCHER_OWNER_REJECTED'}
$previous=$env:MELISA_HUB_CONFIG_PATH
try{
 $env:MELISA_HUB_CONFIG_PATH=$c.HubConfigPath
 $child=Start-Process -FilePath $c.NodePath -ArgumentList @('"'+$entry+'"','"'+$c.OperationConfigPath+'"') -WorkingDirectory (Join-Path $c.PackageRoot 'apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $c.RuntimeDir ('hub-web-'+$run+'.out.log')) -RedirectStandardError (Join-Path $c.RuntimeDir ('hub-web-'+$run+'.err.log'))
}finally{$env:MELISA_HUB_CONFIG_PATH=$previous}
try{
$ready=$false
for($readinessAttempt=0;$readinessAttempt -lt 20;$readinessAttempt++){
 $child.Refresh();if($child.HasExited){throw 'HUB_WEB_CHILD_EXITED'}
 try{
  $web=Invoke-RestMethod 'http://127.0.0.1:5234/test-health' -TimeoutSec 1 -MaximumRedirection 0
  $bindings=@(Get-NetTCPConnection -State Listen -LocalPort 5234 -ErrorAction SilentlyContinue)
  $listeners=@($bindings|Select-Object -ExpandProperty OwningProcess -Unique)
  $addresses=@($bindings|Select-Object -ExpandProperty LocalAddress -Unique)
  if($web.ok -eq $true -and $web.environment -eq 'ISOLATED_TEST_COPY' -and $web.port -eq 5234 -and $web.copyId -eq $operation.copyContext.copyId -and $web.actualT1 -eq $false -and $web.databaseName -eq $operation.database -and $web.sourceCommit -eq $c.SourceCommit -and $listeners.Count -eq 1 -and $listeners[0] -eq $child.Id -and $addresses.Count -eq 2 -and $addresses -contains '127.0.0.1' -and $addresses -contains '192.168.1.46'){$ready=$true;break}
 }catch{}
 Start-Sleep -Milliseconds 250
}
if(!$ready){throw 'HUB_WEB_READINESS_FAILED'}
$node=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.Id)
$bindings=@(Get-NetTCPConnection -State Listen -LocalPort 5234 -ErrorAction SilentlyContinue)
$entry=Join-Path $c.PackageRoot 'apps\api\start-shared-test-copy-web.mjs'
$expectedNode='"'+$c.NodePath+'" "'+$entry+'" "'+$c.OperationConfigPath+'"'
if(!$node -or $node.ParentProcessId -ne $PID -or (Invoke-CimMethod $node -MethodName GetOwnerSid).Sid -ne $c.OwnerSid -or $node.ExecutablePath -ne $c.NodePath -or $node.CommandLine.TrimEnd() -cne $expectedNode -or $bindings.Count -ne 2 -or @($bindings|Where-Object {$_.OwningProcess -ne $child.Id -or $_.LocalAddress -notin @('127.0.0.1','192.168.1.46')}).Count -ne 0){throw 'HUB_LINEAGE_CHILD_REJECTED'}
function New-ReceiptSecurity{
 $security=New-Object Security.AccessControl.FileSecurity
 $security.SetAccessRuleProtection($true,$false)
 foreach($value in @($c.OwnerSid,'S-1-5-18')){
  $sid=[Security.Principal.SecurityIdentifier]::new($value)
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow)
  $security.AddAccessRule($rule)
 }
 return $security
}
function Assert-ReceiptSecurity([string]$file){
 $read=Get-Acl -LiteralPath $file
 $sids=@($read.Access|ForEach-Object {$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value})
 if(!$read.AreAccessRulesProtected -or @($read.Access).Count -ne 2 -or @($read.Access|Where-Object {$_.AccessControlType -ne 'Allow' -or $_.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl}).Count -or @($sids|Sort-Object -Unique).Count -ne 2 -or $c.OwnerSid -notin $sids -or 'S-1-5-18' -notin $sids){throw 'HUB_RECEIPT_ACL_REJECTED'}
}
function Write-ProtectedJson([string]$file,$value){
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12 -Compress))
 $security=New-ReceiptSecurity
 $stream=[IO.FileStream]::new($file,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::FullControl,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$security)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 Assert-ReceiptSecurity $file
 $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$expected=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 if($hash -ne $expected){throw 'HUB_RECEIPT_HASH_REJECTED'}
 return $hash
}
$lineage=[ordered]@{
 schemaVersion=1;run=$run;attempt=$Attempt;ownerSid=$c.OwnerSid;sourceCommit=$c.SourceCommit;packageRoot=$c.PackageRoot;manifestSha256=$c.ManifestSha256;nodeSha256=$c.NodeSha256
 startupConfig=[ordered]@{path=$StartupConfigPath;sha256=(Get-FileHash -LiteralPath $StartupConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()}
 operationConfig=[ordered]@{path=$c.OperationConfigPath;sha256=(Get-FileHash -LiteralPath $c.OperationConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()}
 hubConfig=[ordered]@{path=$c.HubConfigPath;sha256=(Get-FileHash -LiteralPath $c.HubConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()}
 watcher=[ordered]@{pid=[int]$parent.ProcessId;birth=$parent.CreationDate.ToUniversalTime().ToString('o');sid=$c.OwnerSid;argv=$parent.CommandLine}
 launcher=[ordered]@{pid=$PID;birth=$launcher.CreationDate.ToUniversalTime().ToString('o');sid=$launcherSid;argv=$launcher.CommandLine;parentPid=[int]$parent.ProcessId}
 node=[ordered]@{pid=$child.Id;birth=$node.CreationDate.ToUniversalTime().ToString('o');sid=$c.OwnerSid;argv=$node.CommandLine;parentPid=$PID}
 bindings=@($bindings|ForEach-Object {[ordered]@{address=$_.LocalAddress;port=5234;pid=$child.Id}})
 startedAt=(Get-Date).ToUniversalTime().ToString('o')
}
$lineagePath=Join-Path $c.RuntimeDir ('hub-web-lineage-'+$run+'-'+$Attempt+'.json')
$lineageSha=Write-ProtectedJson $lineagePath $lineage
$legacy=[ordered]@{pid=$child.Id;sourceCommit=$c.SourceCommit;packageRoot=$c.PackageRoot;port=5234;startedAt=$lineage.startedAt;run=$run;attempt=$Attempt;lineagePath=$lineagePath;lineageSha256=$lineageSha}
$pointer=Join-Path $c.RuntimeDir ('hub-web-process-'+$run+'-'+$Attempt+'.json')
$pointerSha=Write-ProtectedJson $pointer $legacy
$published=Get-Content -LiteralPath $pointer -Raw|ConvertFrom-Json
if($published.lineageSha256 -ne $lineageSha -or (Get-FileHash -LiteralPath $lineagePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $lineageSha -or (Get-FileHash -LiteralPath $pointer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pointerSha){throw 'HUB_RECEIPT_PUBLISH_REJECTED'}
Assert-ReceiptSecurity $pointer
}catch{
 $failure=$_
 # Only the Process handle returned by this invocation can be stopped here.
 try{
  $child.Refresh()
  if(!$child.HasExited){$child.Kill()}
  if(!$child.WaitForExit(5000) -or !$child.HasExited){throw 'HUB_WEB_OWN_CHILD_CLEANUP_UNCONFIRMED'}
 }catch{throw 'HUB_WEB_OWN_CHILD_CLEANUP_UNCONFIRMED'}
 throw $failure
}
Write-Output ('HUB_WEB_STARTED_PID_'+$child.Id)
if($Watch){
 # The task remains attached to this exact child. Scheduler retries are bounded;
 # another owner is never killed and API/native/CRM are never started here.
 $child.WaitForExit()
 throw 'HUB_WEB_CHILD_EXITED'
}
