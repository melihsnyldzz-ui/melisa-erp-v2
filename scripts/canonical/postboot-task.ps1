param([Parameter(Mandatory)][string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','CimCmdlets','NetTCPIP','ScheduledTasks')){Microsoft.PowerShell.Core\Import-Module (Join-Path $PSHOME ('Modules\'+$name+'\'+$name+'.psd1')) -Scope Local -ErrorAction Stop}
. (Join-Path $PSScriptRoot 'business-5244-postboot.ps1') -Library
. (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
$script:Business5244PostbootTask=New-Business5244PostbootContext Task $ManifestSha256
$r=Get-Business5244PostbootContext $script:Business5244PostbootTask
try{
 $r.epoch.Claim('services')
 [void](Write-Business5244PostbootRecord $r.token 'claim.json' @{schema='melisa-b6-postboot-services-claim.v1';boot=$r.epoch.Boot;manifestSha256=$ManifestSha256;taskHost=$PID;oldNamespacesReused=$false;runtimeGo=$false})
 $config=Read-ErpStartupConfig (Get-Business5244PostbootCase).config
 $r.serviceConfig=$config;$r.serviceConfigJson=$config|ConvertTo-Json -Depth 100 -Compress
 # The unchanged canonical service loop owns only its original three services.
 # Its existing ready hook starts the new finite WEB owner exactly once.
 Invoke-ErpOwnedSession $config
}finally{$r.epoch.Dispose();$r.sourceSeal.Dispose();$r.seal.Dispose();$r.closed=$true}
