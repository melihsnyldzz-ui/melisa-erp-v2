param([switch]$Library,[switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Get-CleanWebOwnerPlan {
 [pscustomobject]@{port=5244;database='MELISA_ERP_CLEAN_TEST_20261022';environment='e662fd94-d797-4b3b-938a-d143ad758b67';synthetic=$true;actualT1=$false;externalOperations=$false
  node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeHash='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
  candidate='C:\Sirket\ERP\releases\CLEAN-ERP-WEB-20261025-b89cc651-B6AUTHHEIGHT-WEBONLY';candidateManifest='61328e6bced8de827c00a4672329b5fae3e417ff04007e3b60549085b5a3bab2'
  baseline='b89cc651dc26b40eb9a30a0382d52336c3d1f5be';patch='b6de5305ba46478997ea77beaa41fdb1bb2b3af0'
  rollback='C:\Sirket\ERP\releases\CLEAN-ERP-WEB-20261025-b89cc651dc26-B5FINANCEPROFILE';rollbackManifest='ded6325d0c9bc55316199a7e21463135e42fc0ae5b08fb4d00fa26eb7aa58a72'}
}
function Get-InstalledCleanWebHandoff {
 # The accepted launcher never issued a cooperating birth claim/retained handle.
 # Do not mint one from PID/CIM/JSON, empty ports, a mutex or the new component.
 throw 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'
}
function Initialize-CleanWebOwnerSource {
 if('Melisa.CleanWeb1056.Owner' -as [type]){return}
 Add-Type -Path (Join-Path $PSScriptRoot 'clean-web-owner.cs')
}
if($Apply){$null=Get-InstalledCleanWebHandoff}
if(!$Library -and !$Apply){Get-CleanWebOwnerPlan}
