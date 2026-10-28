param([switch]$Library,[string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Get-Business5244ReadPairRouterMode($Config){
 if(!$Config -or !$Config.PSObject.Properties['ApiComponent']){throw 'READPAIR_ROUTER_CONFIG_REQUIRED'}
 $scope=Get-Test125ReadPairScope
 if($Config.ApiComponent.ReleaseRoot -ceq $scope.current.ReleaseRoot){[void](Assert-Test125ReadPairConfig $Config Current);return 'PrepareCurrent'}
 [void](Assert-Test125ReadPairConfig $Config Candidate)
 return 'SteadyReadPair'
}
if($Library){return}
# This is a two-file entry overlay on the already frozen ec316a63 libraries.
# No general package rebuild or arbitrary path/mode/command input is accepted.
$root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-READ2B-ROUTER-ec316a63-20261028'
$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-OWNER-ec316a63-20261028'
$coreHash='61c2b43bf61b9a0ad750d992eab20398d04fcb65318e64c168943899224d64ec'
if($PSScriptRoot -cne $root -or $ManifestSha256 -cnotmatch '^[a-fA-F0-9]{64}$'){throw 'READPAIR_ROUTER_ENTRY_PIN_REQUIRED'}
foreach($path in @($root,$core)){for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'READPAIR_ROUTER_REPARSE_POINT'}}}
$manifestPath=Join-Path $root 'owner-manifest.json'
if((Get-FileHash -LiteralPath $manifestPath).Hash -ine $ManifestSha256){throw 'READPAIR_ROUTER_MANIFEST_CHANGED'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
if($manifest.kind -cne 'BUSINESS5244_READ_PAIR_ROUTER' -or $manifest.coreRoot -cne $core -or $manifest.coreManifestSha256 -cne $coreHash -or $manifest.readPairMaintenanceEnabled -ne $true -or $manifest.actualT1 -ne $false -or $manifest.externalOperations -ne $false -or $manifest.entry -cne 'start-business-5244-readpair-router.ps1' -or (Get-FileHash -LiteralPath $PSCommandPath).Hash -ine $manifest.entrySha256){throw 'READPAIR_ROUTER_IDENTITY_CHANGED'}
if((Get-FileHash -LiteralPath (Join-Path $core 'owner-manifest.json')).Hash -ine $coreHash){throw 'READPAIR_ROUTER_CORE_CHANGED'}
$coreManifest=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($coreManifest.sourceCommit -cne 'ec316a63b535544e53a566370b1614a1721f940c' -or @($coreManifest.files).Count -ne 12){throw 'READPAIR_ROUTER_CORE_IDENTITY'}
foreach($file in $coreManifest.files){$path=Join-Path $core $file.path;if($file.path -match '[\\/]' -or (Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint -or (Get-FileHash -LiteralPath $path).Hash -ine $file.sha256){throw 'READPAIR_ROUTER_CORE_FILE_CHANGED'}}
. (Join-Path $core 'start-business-5244-owned.ps1') -Library
. (Join-Path $core 'test125-bound-api-quiescence.ps1')
$config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
$mode=Get-Business5244ReadPairRouterMode $config
# Before cutover prepare both exact pairs BEFORE accepting a nonce/request.
# After a verified API commit, a restart must boot ReadPair directly instead
# of requiring the superseded Current API or replaying the old migration.
if($mode -ceq 'PrepareCurrent'){Start-Business5244OwnedSupervisor -InitialSlot Current -PrepareReadPair|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}
else{Start-Business5244OwnedSupervisor -InitialSlot ReadPair|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}
