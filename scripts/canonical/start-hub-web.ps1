param([Parameter(Mandatory=$true)][string]$StartupConfigPath,[ValidateSet('Inspect','Start')][string]$Action='Inspect')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
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
Assert-HubPath $c.PackageRoot 'C:\Sirket\ERP\releases'
if(!(Split-Path $c.PackageRoot -Leaf).StartsWith('CANONICAL-HUB-TEST-')){throw 'HUB_PACKAGE_SCOPE_REJECTED'}
if((Get-FileHash -LiteralPath $c.NodePath -Algorithm SHA256).Hash -ne $c.NodeSha256){throw 'HUB_NODE_PIN_REJECTED'}
$manifestFile=Join-Path $c.PackageRoot 'release-manifest.json'
if((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash -ne $c.ManifestSha256){throw 'HUB_MANIFEST_PIN_REJECTED'}
$m=Get-Content -LiteralPath $manifestFile -Raw|ConvertFrom-Json
if($m.sourceCommit -ne $c.SourceCommit -or !$m.baselineReproduced -or $m.sharedTestCopy.database -ne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $m.sharedTestCopy.webPort -ne 5234 -or $m.sharedTestCopy.actualT1 -ne $false){throw 'HUB_RELEASE_SCOPE_REJECTED'}
foreach($file in $m.files){$target=Join-Path $c.PackageRoot $file.path;Assert-HubPath $target $c.PackageRoot;if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $file.sha256){throw 'HUB_PACKAGE_HASH_REJECTED'}}
$operation=Get-Content -LiteralPath $c.OperationConfigPath -Raw|ConvertFrom-Json
$pin=Get-Content -LiteralPath $c.HubConfigPath -Raw|ConvertFrom-Json
if($operation.database -ne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $operation.webPort -ne 5234 -or $operation.erpPort -ne 4184 -or $operation.nativePort -ne 4186 -or $operation.host -ne '127.0.0.1' -or $operation.lanHost -ne '192.168.1.46'){throw 'HUB_OPERATION_SCOPE_REJECTED'}
foreach($port in @(4184,4186)){
 $health=Invoke-RestMethod ('http://127.0.0.1:'+$port+'/test-health') -TimeoutSec 3
 if(!$health.ok -or $health.environment -ne 'ISOLATED_TEST_COPY' -or $health.port -ne $port -or $health.databaseName -ne $operation.database -or $health.copyId -ne $operation.copyContext.copyId -or $health.sourceCommit -ne $pin.apiSourceCommit -or $health.actualT1 -ne $false -or $health.sysadmin -ne 0 -or $health.databaseControl -ne 0 -or $health.liveDatabaseAccess -ne 0 -or $health.originalDatabaseAccess -ne 0){throw 'HUB_DEPENDENCY_IDENTITY_REJECTED'}
}
if($Action -eq 'Inspect'){Write-Output 'HUB_WEB_PACKAGE_AND_DEPENDENCIES_VERIFIED';exit 0}
if(@(Get-NetTCPConnection -State Listen -LocalPort 5234 -ErrorAction SilentlyContinue).Count){throw 'HUB_WEB_PORT_ALREADY_OWNED'}
New-Item -ItemType Directory -Force -Path $c.RuntimeDir|Out-Null
$entry=Join-Path $c.PackageRoot 'apps\api\start-shared-test-copy-web.mjs'
$previous=$env:MELISA_HUB_CONFIG_PATH
try{
 $env:MELISA_HUB_CONFIG_PATH=$c.HubConfigPath
 $child=Start-Process -FilePath $c.NodePath -ArgumentList @('"'+$entry+'"','"'+$c.OperationConfigPath+'"') -WorkingDirectory (Join-Path $c.PackageRoot 'apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $c.RuntimeDir 'hub-web.out.log') -RedirectStandardError (Join-Path $c.RuntimeDir 'hub-web.err.log')
}finally{$env:MELISA_HUB_CONFIG_PATH=$previous}
[pscustomobject]@{pid=$child.Id;sourceCommit=$c.SourceCommit;packageRoot=$c.PackageRoot;port=5234;startedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $c.RuntimeDir 'hub-web-process.json') -Encoding utf8
Write-Output ('HUB_WEB_STARTED_PID_'+$child.Id)
