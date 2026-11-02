param([Parameter(Mandatory)][string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','CimCmdlets','NetTCPIP')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
. (Join-Path $PSScriptRoot 'business-5244-postboot.ps1') -Library
. (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
. (Join-Path $PSScriptRoot 'start-business-5244-owned.ps1') -Library
Start-Business5244PostbootOwner $ManifestSha256
