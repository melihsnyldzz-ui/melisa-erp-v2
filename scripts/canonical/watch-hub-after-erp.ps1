param([Parameter(Mandatory=$true)][string]$StartupConfigPath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$StartupConfigSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$expectedCrmSource=switch -CaseSensitive ($StartupConfigPath){
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-da82fc6644c1-parent-probe.json'{'da82fc6644c1d9dba0c10eaa861773534d43c288';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-5ce452b01ef2.json'{'5ce452b01ef20fc84a09c52b78311db8eb1dd1d8';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-5bcd5ad136ff.json'{'5bcd5ad136ff7ca35d623d436b8724cc491641be';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-5bcd5ad136ff-receipt-wait.json'{'5bcd5ad136ff7ca35d623d436b8724cc491641be';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-bb8966c59a6c.json'{'bb8966c59a6cfbdc1cc83472cb331e48b720a173';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-957f98773695.json'{'957f98773695874ea3d101b7eb4816f9ea080880';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-89427492f27c.json'{'89427492f27caf72c511a27262b55e73d782c407';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-94f2a75322a3.json'{'94f2a75322a3daa695d38010a6f2c8ef23f6c17b';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-a7243dedf9ca.json'{'a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376.json'{'439b63db8376a6b9d3ac8baa625ed98367022623';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-candidate.json'{'439b63db8376a6b9d3ac8baa625ed98367022623';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-candidate-native-ready.json'{'439b63db8376a6b9d3ac8baa625ed98367022623';break}
 default {throw 'ERP_HUB_WAIT_CONFIG_SCOPE'}
}
function Read-PinnedJson([string]$p,[string]$hash){
 for($q=$p;$q.Length-gt3;$q=[IO.Path]::GetDirectoryName($q)){if((Get-Item -LiteralPath $q -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'ERP_HUB_WAIT_REPARSE'}}
 if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()-cne$hash){throw 'ERP_HUB_WAIT_PIN'}
 return Get-Content -LiteralPath $p -Raw|ConvertFrom-Json
}
$c=Read-PinnedJson $StartupConfigPath $StartupConfigSha256
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$literalCandidateNode=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-candidate.json'-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$nativeReadyNodeRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-candidate-native-ready.json'
$literalNativeReadyNode=$nativeReadyNodeRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
if($c.components.crm.sourceCommit-cne$expectedCrmSource-or$c.ownerSid-cne$owner-or($c.node.path-cne'C:\Program Files\nodejs\node.exe'-and!$literalCandidateNode-and!$literalNativeReadyNode)-or($nativeReadyNodeRequired-and!$literalNativeReadyNode)-or$c.actualT1-ne$false-or$c.database-cne'MELISA_ERP_CRM_SHARED_TEST_20261009_02'-or$c.copyId-cne'e16b70f0-4057-428b-9abc-6bbcaf35fe82'){throw 'ERP_HUB_WAIT_TARGET'}
$manifest=Read-PinnedJson (Join-Path $c.supervisor.packageRoot 'release-manifest.json') $c.supervisor.manifestSha256
if($manifest.sourceCommit-cne$c.supervisor.sourceCommit-or$manifest.packageRole-cne'SUPERVISOR_ONLY'-or$manifest.applicationDeployment-ne$false-or[IO.Path]::GetFullPath($PSCommandPath)-ine(Join-Path $c.supervisor.packageRoot 'scripts\canonical\watch-hub-after-erp.ps1')){throw 'ERP_HUB_WAIT_PACKAGE'}
foreach($name in @('watch-hub-after-erp.ps1','wait-erp-for-hub.mjs')){$pins=@($manifest.files|Where-Object{$_.path-ceq('scripts/canonical/'+$name)});if($pins.Count-ne1-or(Get-FileHash -LiteralPath(Join-Path $c.supervisor.packageRoot ('scripts\canonical\'+$name)) -Algorithm SHA256).Hash.ToLowerInvariant()-cne$pins[0].sha256){throw 'ERP_HUB_WAIT_ENTRY_PIN'}}
if((Get-FileHash -LiteralPath $c.node.path -Algorithm SHA256).Hash.ToLowerInvariant()-cne$c.node.sha256){throw 'ERP_HUB_WAIT_NODE_PIN'}
$receipt=Join-Path 'C:\Sirket\ERP\runtime\terminal-completion-logon\hub-web' ('erp-prerequisites-'+[guid]::NewGuid().ToString('N')+'.json')
& $c.node.path --no-maglev (Join-Path $c.supervisor.packageRoot 'scripts\canonical\wait-erp-for-hub.mjs') --config $StartupConfigPath --sha256 $StartupConfigSha256 --owner-sid $owner --receipt $receipt
if($LASTEXITCODE-ne0){throw 'ERP_HUB_WAIT_DRIVER_FAILED'}
$fresh=Read-PinnedJson $StartupConfigPath $StartupConfigSha256
if($fresh.ownerSid-cne$owner-or$fresh.components.crm.sourceCommit-cne$expectedCrmSource){throw 'ERP_HUB_WAIT_OWNER'}
$hubManifest=Read-PinnedJson (Join-Path $fresh.components.hub.packageRoot 'release-manifest.json') $fresh.components.hub.manifestSha256
$hubStartup=Read-PinnedJson $fresh.privateSources.hubStartupConfig.path $fresh.privateSources.hubStartupConfig.sha256
if($hubManifest.sourceCommit-cne$fresh.components.hub.sourceCommit-or$hubStartup.OwnerSid-cne$owner-or$hubStartup.SourceCommit-cne$fresh.components.hub.sourceCommit-or$hubStartup.PackageRoot-cne$fresh.components.hub.packageRoot-or$hubStartup.ManifestSha256-cne$fresh.components.hub.manifestSha256-or$hubStartup.HubConfigPath-cne$fresh.privateSources.hubPinConfig.path-or$hubStartup.OperationConfigPath-cne$fresh.privateSources.operationConfig.path-or$hubStartup.NodePath-cne$fresh.node.path-or$hubStartup.NodeSha256-cne$fresh.node.sha256){throw 'ERP_HUB_WAIT_HUB_LINK'}
$watcher=Join-Path $fresh.components.hub.packageRoot 'scripts\canonical\watch-hub-web.ps1'
$pin=@($hubManifest.files|Where-Object{$_.path-ceq'scripts/canonical/watch-hub-web.ps1'})
if($pin.Count-ne1-or(Get-FileHash -LiteralPath $watcher -Algorithm SHA256).Hash.ToLowerInvariant()-cne$pin[0].sha256){throw 'ERP_HUB_WAIT_HUB_WATCHER_PIN'}
# Invoke the unchanged supported watcher in this same scheduled-task process.
# Its own source/Node/manifest checks and initial+3 retry budget remain intact.
& $watcher -StartupConfigPath $fresh.privateSources.hubStartupConfig.path
