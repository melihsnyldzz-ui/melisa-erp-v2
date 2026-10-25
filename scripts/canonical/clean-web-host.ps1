param([switch]$Library,[switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Dot-sourcing the existing library sets its own Apply/Library parameters in
# this scope. Preserve this entry's requested mode before loading that source.
$cleanWebHostApplyRequested=$Apply.IsPresent
$cleanWebHostLibraryRequested=$Library.IsPresent
. (Join-Path $PSScriptRoot 'clean-web-owner.ps1') -Library

function Start-InstalledCleanWebHost {
 # This remains the FIRST runtime operation. No compilation, target read or
 # birth is authorized by a fixture pin, caller JSON, or an empty port.
 $null=Get-InstalledCleanWebHandoff
 throw 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'
}
function Initialize-CleanWebHostSource { Initialize-CleanWebOwnerSource }
if($cleanWebHostApplyRequested){Start-InstalledCleanWebHost}
if(!$cleanWebHostLibraryRequested -and !$cleanWebHostApplyRequested){Get-CleanWebOwnerPlan}
