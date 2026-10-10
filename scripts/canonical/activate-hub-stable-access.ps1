param([Parameter(Mandatory=$true)][string]$ReviewPlanPath,[Parameter(Mandatory=$true)][string]$ReviewPlanSha256,[ValidateSet('Inspect','Apply','Rollback')][string]$Action='Inspect',[switch]$Library)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Reviewable source. No installation, elevation/UAC, reboot or task changes.
# Apply/Rollback are only for the exact separately approved network bundle.
function Assert-HubAccessPath([string]$Path,[string]$Root=''){
 if($Path -cnotmatch '^C:\\' -or [IO.Path]::GetFullPath($Path) -cne $Path -or $Path -match '[\x00-\x1f\x7f"''/%`$<>|?*]' -or $Path.Substring(2).Contains(':')){throw 'HUB_ACCESS_PATH_REJECTED'}
 foreach($part in $Path.Substring(3).Split('\')){if(!$part -or $part -in @('.','..') -or $part -match '[. ]$' -or $part -match '^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)'){throw 'HUB_ACCESS_PATH_REJECTED'}}
 if($Root -and !$Path.StartsWith($Root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'HUB_ACCESS_PATH_REJECTED'}
 $cursor=$Path;while($cursor.Length -gt 3){if(((Get-Item -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'HUB_ACCESS_REPARSE_REJECTED'};$cursor=[IO.Path]::GetDirectoryName($cursor)}
}
function Assert-HubAccessPin([string]$Path,[string]$Sha){
 Assert-HubAccessPath $Path
 if($Sha -cnotmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ine $Sha){throw 'HUB_ACCESS_PIN_REJECTED'}
}
function Invoke-HubAccessTailscale($Settings,[string[]]$Tokens){
 Assert-HubAccessPin $Settings.tailscalePath $Settings.tailscaleSha256
 if($Tokens[0] -ceq 'set' -or ($Tokens[0] -ceq 'serve' -and $Tokens[1] -cne 'status')){Assert-HubAccessIdentity $Settings}
 $output=@(& $Settings.tailscalePath @Tokens 2>&1)
 if($LASTEXITCODE -ne 0){throw 'HUB_ACCESS_TAILSCALE_FAILED'}
 return ($output -join "`n")
}
function Get-HubAccessIdentity($Settings){
 $status=(Invoke-HubAccessTailscale $Settings @('status','--json'))|ConvertFrom-Json
 $profiles=@((Invoke-HubAccessTailscale $Settings @('switch','--list','--json'))|ConvertFrom-Json)
 $selected=@($profiles|Where-Object {$_.selected -is [bool] -and $_.selected -eq $true})
 if($selected.Count -ne 1 -or $status.BackendState -cne 'Running' -or $status.HaveNodeKey -ne $true){throw 'HUB_ACCESS_IDENTITY_REJECTED'}
 return [pscustomobject][ordered]@{schemaVersion=1;profileId=[string]$selected[0].id;nodeId=[string]$status.Self.ID;hostName=[string]$status.Self.HostName;dnsName=[string]$status.Self.DNSName;tailnetName=[string]$status.CurrentTailnet.Name;magicDnsSuffix=[string]$status.CurrentTailnet.MagicDNSSuffix}
}
function Assert-HubAccessIdentity($Settings){
 Assert-HubAccessPin $Settings.tailscaleIdentityPath $Settings.tailscaleIdentitySha256
 $before=Get-Content -LiteralPath $Settings.tailscaleIdentityPath -Raw|ConvertFrom-Json
 $current=Get-HubAccessIdentity $Settings
 $keys=@('schemaVersion','profileId','nodeId','hostName','dnsName','tailnetName','magicDnsSuffix')
 if(@($before.PSObject.Properties.Name).Count -ne $keys.Count -or $before.schemaVersion -ne 1 -or $before.dnsName -cne 'semih.tail295701.ts.net.' -or $before.magicDnsSuffix -cne 'tail295701.ts.net' -or @($keys|Where-Object {!$before.PSObject.Properties[$_] -or $before.$_ -cne $current.$_}).Count){throw 'HUB_ACCESS_IDENTITY_DRIFT'}
}
function Get-HubAccessPrefs($Settings){
 $prefs=(Invoke-HubAccessTailscale $Settings @('debug','prefs'))|ConvertFrom-Json
 if(!$prefs.WantRunning){throw 'HUB_ACCESS_PREFS_REJECTED'}
 return [bool]($prefs.PSObject.Properties['ForceDaemon'] -and $prefs.ForceDaemon -eq $true)
}
function Test-HubAccessServe($Settings,[string]$Mode){
 $current=Invoke-HubAccessTailscale $Settings @('serve','status','--json')
 $currentPath=Join-Path $Settings.receiptRoot 'serve-current.json'
 [IO.File]::WriteAllText($currentPath,$current,[Text.UTF8Encoding]::new($false))
 $checker=Join-Path $Settings.packageRoot 'scripts\canonical\hub-stable-access-verify.mjs'
 $output=@(& $Settings.nodePath $checker $Mode $Settings.serveBeforePath $currentPath 2>&1)
 if($LASTEXITCODE -ne 0){throw 'HUB_ACCESS_SERVE_SCOPE_REJECTED'}
}
function Save-HubAccessReceipt($Settings,[string]$Stage){
 $path=Join-Path $Settings.receiptRoot 'access-application.json'
 $record=[ordered]@{schemaVersion=1;ownerSid=$Settings.ownerSid;sourceCommit=$Settings.sourceCommit;manifestSha256=$Settings.manifestSha256;serveBeforeSha256=$Settings.serveBeforeSha256;tailscaleIdentitySha256=$Settings.tailscaleIdentitySha256;stage=$Stage}
 [IO.File]::WriteAllText($path,($record|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
}
function Get-HubAccessReceipt($Settings){
 $path=Join-Path $Settings.receiptRoot 'access-application.json';Assert-HubAccessPath $path 'C:\Sirket\ERP\runtime'
 $record=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
 if(@($record.PSObject.Properties.Name).Count -ne 7 -or $record.schemaVersion -ne 1 -or $record.ownerSid -cne $Settings.ownerSid -or $record.sourceCommit -cne $Settings.sourceCommit -or $record.manifestSha256 -cne $Settings.manifestSha256 -or $record.serveBeforeSha256 -cne $Settings.serveBeforeSha256 -or $record.tailscaleIdentitySha256 -cne $Settings.tailscaleIdentitySha256 -or $record.stage -cnotin @('UNATTENDED_REQUESTED','UNATTENDED_APPLIED','APPLIED','ROLLED_BACK')){throw 'HUB_ACCESS_RECEIPT_REJECTED'}
 return $record
}
function Undo-HubAccessApplication($Settings){
 Assert-HubAccessIdentity $Settings
 $receipt=Get-HubAccessReceipt $Settings
 # Partial application may have changed unattended before Serve failed. Accept
 # only the complete before or after image; never overwrite foreign drift.
 $mode='Before'
 try{Test-HubAccessServe $Settings 'Before'}catch{
  if($_.Exception.Message -cne 'HUB_ACCESS_SERVE_SCOPE_REJECTED'){throw}
  Test-HubAccessServe $Settings 'After';$mode='After'
 }
 if($receipt.stage -ceq 'ROLLED_BACK' -and ($mode -ne 'Before' -or (Get-HubAccessPrefs $Settings))){throw 'HUB_ACCESS_RECEIPT_DRIFT'}
 if($mode -eq 'After'){
  $null=Invoke-HubAccessTailscale $Settings @('serve','--https=8443','--set-path=/','off')
  Test-HubAccessServe $Settings 'Before'
 }
 if(Get-HubAccessPrefs $Settings){$null=Invoke-HubAccessTailscale $Settings @('set','--unattended=false')}
 if(Get-HubAccessPrefs $Settings){throw 'HUB_ACCESS_PREFS_ROLLBACK_FAILED'}
 Save-HubAccessReceipt $Settings 'ROLLED_BACK'
 return [pscustomobject]@{rolledBack=$true;sourceCommit=$Settings.sourceCommit;serveWas=$mode;serveReset=$false;taskChanged=$false;actualRebootTested=$false}
}
function Assert-HubAccessSettings($Settings,[string]$OwnerSid){
 $keys=@('schemaVersion','ownerSid','packageRoot','sourceCommit','manifestSha256','nodePath','nodeSha256','tailscalePath','tailscaleSha256','tailscaleVersion','tailscaleIdentityPath','tailscaleIdentitySha256','serveBeforePath','serveBeforeSha256','forceDaemonBefore','receiptRoot')
 if(@($Settings.PSObject.Properties.Name).Count -ne $keys.Count -or @($keys|Where-Object {!$Settings.PSObject.Properties[$_]}).Count -or $Settings.schemaVersion -ne 1 -or $Settings.ownerSid -cne $OwnerSid -or $Settings.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $Settings.forceDaemonBefore -isnot [bool] -or $Settings.forceDaemonBefore -ne $false -or $Settings.tailscaleVersion -cne '1.102.2'){throw 'HUB_ACCESS_SETTINGS_REJECTED'}
 Assert-HubAccessPath $Settings.packageRoot 'C:\Sirket\ERP\releases';Assert-HubAccessPath $Settings.serveBeforePath 'C:\Sirket\ERP\evidence';Assert-HubAccessPath $Settings.receiptRoot 'C:\Sirket\ERP\runtime';Assert-HubAccessPath $Settings.tailscaleIdentityPath 'C:\Sirket\ERP\evidence'
 if($Settings.tailscalePath -ine 'C:\Program Files\Tailscale\tailscale.exe'){throw 'HUB_ACCESS_TAILSCALE_SCOPE_REJECTED'}
 Assert-HubAccessPin $Settings.nodePath $Settings.nodeSha256;Assert-HubAccessPin $Settings.tailscalePath $Settings.tailscaleSha256;Assert-HubAccessPin $Settings.serveBeforePath $Settings.serveBeforeSha256;Assert-HubAccessPin $Settings.tailscaleIdentityPath $Settings.tailscaleIdentitySha256
 $manifestPath=Join-Path $Settings.packageRoot 'release-manifest.json';Assert-HubAccessPin $manifestPath $Settings.manifestSha256
 $manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
 if($manifest.repository -cne 'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git' -or $manifest.sourceCommit -cne $Settings.sourceCommit -or $manifest.sharedTestCopy.database -cne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02'){throw 'HUB_ACCESS_PACKAGE_REJECTED'}
 foreach($name in @('activate-hub-stable-access.ps1','hub-stable-access-verify.mjs','hub-stable-access-plan.mjs')){
  $relative='scripts/canonical/'+$name;$rows=@($manifest.files|Where-Object {$_.path -ceq $relative});if($rows.Count -ne 1){throw 'HUB_ACCESS_SOURCE_PIN_REQUIRED'};Assert-HubAccessPin (Join-Path $Settings.packageRoot $relative) $rows[0].sha256
 }
}
if($Library){return}
Assert-HubAccessPath $ReviewPlanPath 'C:\Sirket\ERP\runtime';Assert-HubAccessPin $ReviewPlanPath $ReviewPlanSha256
$settings=Get-Content -LiteralPath $ReviewPlanPath -Raw|ConvertFrom-Json
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Assert-HubAccessSettings $settings $owner
if([IO.Path]::GetFullPath($PSCommandPath) -ine (Join-Path $settings.packageRoot 'scripts\canonical\activate-hub-stable-access.ps1')){throw 'HUB_ACCESS_EXECUTION_PACKAGE_REJECTED'}
if($Action -eq 'Inspect'){
 [pscustomobject]@{prepared=$true;applied=$false;ownerSid=$owner;sourceCommit=$settings.sourceCommit;newAddress='https://semih.tail295701.ts.net:8443/melisa-hub/';changes=@('Only8443HTTPS toloopback5244','OnlyForceDaemon false totrue');taskChanged=$false;deviceAclChanged=$false;expiryChanged=$false;rebootApproved=$false}|ConvertTo-Json -Depth 3;exit 0
}
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'HUB_ACCESS_APPROVED_ADMIN_EXECUTION_REQUIRED'}
if($Action -eq 'Apply'){
 Assert-HubAccessIdentity $settings
 if(Test-Path -LiteralPath (Join-Path $settings.receiptRoot 'access-application.json')){throw 'HUB_ACCESS_APPLICATION_ALREADY_RECORDED'}
 Test-HubAccessServe $settings 'Before';if(Get-HubAccessPrefs $settings){throw 'HUB_ACCESS_PREFS_BEFORE_DRIFT'}
 $health=Invoke-RestMethod 'http://127.0.0.1:5244/test-health' -MaximumRedirection 0 -TimeoutSec 4
 if($health.ok -ne $true -or $health.sourceCommit -cne $settings.sourceCommit -or $health.databaseName -cne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $health.copyId -cne 'e16b70f0-4057-428b-9abc-6bbcaf35fe82' -or $health.actualT1 -ne $false){throw 'HUB_ACCESS_EDGE_NOT_VERIFIED'}
 Save-HubAccessReceipt $settings 'UNATTENDED_REQUESTED'
 $null=Invoke-HubAccessTailscale $settings @('set','--unattended=true')
 if(!(Get-HubAccessPrefs $settings)){throw 'HUB_ACCESS_UNATTENDED_NOT_VERIFIED'}
 Save-HubAccessReceipt $settings 'UNATTENDED_APPLIED'
 $null=Invoke-HubAccessTailscale $settings @('serve','--bg','--https=8443','http://127.0.0.1:5244')
 Test-HubAccessServe $settings 'After';if(!(Get-HubAccessPrefs $settings)){throw 'HUB_ACCESS_UNATTENDED_NOT_VERIFIED'}
 Save-HubAccessReceipt $settings 'APPLIED'
 [pscustomobject]@{applied=$true;sourceCommit=$settings.sourceCommit;only8443Changed=$true;funnel8443=$false;unattended=$true;actualRebootTested=$false}|ConvertTo-Json;exit 0
}
Undo-HubAccessApplication $settings|ConvertTo-Json
