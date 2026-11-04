param([Parameter(Mandatory)][string]$ManifestSha256,[Parameter(Mandatory)][ValidateSet('Status','Promote','Rollback','Finalize')][string]$Action)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','CimCmdlets','NetTCPIP')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
$script:PostbootControlAction=$Action
. (Join-Path $PSScriptRoot 'business-5244-postboot.ps1') -Library
. (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
. (Join-Path $PSScriptRoot 'start-business-5244-owned.ps1') -Library
$token=New-Business5244PostbootContext Control $ManifestSha256;$r=Get-Business5244PostbootContext $token;$connection=$null;$serverExecutable=$null
try{
 if($r.manifest.phase-ceq'STEADY'-and$Action-cne'Status'){throw 'POSTBOOT_STEADY_STATUS_ONLY'}
 Assert-Business5244PostbootProtection $token
 $connection=Connect-Business5244RetirementPeer;$peer=Get-Business5244RetirementRecord $connection -Client;$peer.peer.Validate()
 $server=Get-CimInstance Win32_Process -Filter ('ProcessId='+$connection.serverPid)
 if(!$server-or$server.ParentProcessId-ne$r.hostPid-or![Business5244WebNative]::MatchesCimBirth([long]$connection.serverBirth,$server.CreationDate.ToUniversalTime().ToFileTimeUtc())){throw 'POSTBOOT_SERVER_CHANGED'}
 $c=Get-Business5244PostbootCase;$expected=@($c.ps,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',(Join-Path $c.root 'postboot-owner.ps1'),'-ManifestSha256',$ManifestSha256)
 $serverArgs=[Business5244PostbootEpoch]::SplitArguments($server.CommandLine);Assert-Business5244PostbootArgumentTail $serverArgs $expected
 $serverExecutable=[Business5244PostbootExecutable]::CaptureProcess([int]$connection.serverPid,[string]$connection.serverBirth,[Security.Principal.WindowsIdentity]::GetCurrent().User.Value,$serverArgs[0],$c.ps,$r.manifest.windowsPowerShell.sha256)
 $peer.peer.Validate();$operation=@{Status='status';Promote='retire';Rollback='recover';Finalize='complete'}[$Action]
 # One explicit action, one send. Lost reply remains UNKNOWN, never retried.
 $result=Send-Business5244RetirementRequest $connection $operation
 [pscustomobject]@{action=$Action;reply=$result.reply;state=$result.state;deliveryIsNotCompletion=$true;normalGuiVerified=$false;humanAcceptance='BEKLIYOR';runtimeGo=$false}|ConvertTo-Json -Depth 5 -Compress
}finally{if($connection){Close-Business5244RetirementPeer $connection};if($serverExecutable){$serverExecutable.Dispose()};Close-Business5244PostbootProfileScope $r.profileScope;$r.epoch.Dispose();$r.executable.Dispose();$r.sourceSeal.Dispose();$r.protectedSeal.Dispose();$r.seal.Dispose();$r.closed=$true}
