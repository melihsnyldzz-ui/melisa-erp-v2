param([switch]$Library,[string]$ManifestSha256,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){throw 'READPAIR_ROUTER_SCOPE_REJECTED'}
function Get-Business5244ReadPairRouterMode($Config,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213'){
 if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){throw 'READPAIR_ROUTER_SCOPE_REJECTED'}
 if(!$Config -or !$Config.PSObject.Properties['ApiComponent']){throw 'READPAIR_ROUTER_CONFIG_REQUIRED'}
 $pairScope=if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){Get-Test125ReadPairScope}else{Get-Test125ReadPairScope -Name $ScopeName}
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  foreach($mode in @('Current','Candidate')){$pins=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode $mode;$part=if($mode-ceq'Current'){$pairScope.current}else{$pairScope.candidate};if($pins.apiManifest-cne$part.ManifestSha256-or$pins.baseSource-cne$pairScope.source){throw 'READPAIR_ROUTER_FINITE_PAIR_CHANGED'}}
 }
 if($Config.ApiComponent.ReleaseRoot -ceq $pairScope.current.ReleaseRoot){if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){[void](Assert-Test125ReadPairConfig $Config Current)}else{[void](Assert-Test125ReadPairConfig $Config Current -ScopeName $ScopeName)};return 'PrepareCurrent'}
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){[void](Assert-Test125ReadPairConfig $Config Candidate)}else{[void](Assert-Test125ReadPairConfig $Config Candidate -ScopeName $ScopeName)}
 return 'SteadyReadPair'
}
if($Library){return}
if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){throw 'B6_WRITER_OWNER_BUNDLE_NOT_PREPARED'}
# The new core/router/current-entry generation has not been produced or admitted.
# Reject B6 before reading any private/runtime file or starting an owner.
if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){throw 'B6_OWNER_BUNDLE_NOT_PREPARED'}
if($ScopeName-cne'TEST125-API-READ2b-20261028-41d3c213'){throw 'READPAIR_ROUTER_SCOPE_REJECTED'}
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
$mode=Get-Business5244ReadPairRouterMode $config -ScopeName $ScopeName
# Before cutover prepare both exact pairs BEFORE accepting a nonce/request.
# After a verified API commit, a restart must boot ReadPair directly instead
# of requiring the superseded Current API or replaying the old migration.
if($mode -ceq 'PrepareCurrent'){Start-Business5244OwnedSupervisor -InitialSlot Current -PrepareReadPair|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}
else{Start-Business5244OwnedSupervisor -InitialSlot ReadPair|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}
