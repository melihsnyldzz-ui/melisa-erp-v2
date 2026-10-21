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
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-crm-node24-ready.json'{'439b63db8376a6b9d3ac8baa625ed98367022623';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-crm-node24-hub-ready.json'{'439b63db8376a6b9d3ac8baa625ed98367022623';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e0e6c28.json'{'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-1a03157.json'{'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-c88d7010f831.json'{'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'{'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'{'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'{'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';break}
 'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'{'d1e4425206249e38445fb103e03601f86baa84ec';break}
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
$crmNode24Required=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-crm-node24-ready.json'
$literalCrmNode24=$crmNode24Required-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$crmNode24HubRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-439b63db8376-erp-crm-node24-hub-ready.json'
$literalCrmNode24Hub=$crmNode24HubRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$integratedNodeRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e0e6c28.json'
$literalIntegratedNode=$integratedNodeRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$hubLineageNodeRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-1a03157.json'
$literalHubLineageNode=$hubLineageNodeRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$pr53NodeRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-c88d7010f831.json'
$literalPr53Node=$pr53NodeRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$pr53CiNodeRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'-or$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json'
$pr54B264NodeRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json'
$literalPr54B264Node=$pr54B264NodeRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$literalPr53CiNode=$pr53CiNodeRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$currentSharedNodeRequired=$StartupConfigPath-ceq'C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-d1e442520624-erp-6dc33f417373-current.json'
$literalCurrentSharedNode=$currentSharedNodeRequired-and$c.node.path-ceq'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-and$c.node.sha256-ceq'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
if($c.components.crm.sourceCommit-cne$expectedCrmSource-or$c.ownerSid-cne$owner-or($c.node.path-cne'C:\Program Files\nodejs\node.exe'-and!$literalCandidateNode-and!$literalNativeReadyNode-and!$literalCrmNode24-and!$literalCrmNode24Hub-and!$literalIntegratedNode-and!$literalHubLineageNode-and!$literalPr53Node-and!$literalPr53CiNode-and!$literalPr54B264Node-and!$literalCurrentSharedNode)-or($nativeReadyNodeRequired-and!$literalNativeReadyNode)-or($crmNode24Required-and!$literalCrmNode24)-or($crmNode24HubRequired-and!$literalCrmNode24Hub)-or($integratedNodeRequired-and!$literalIntegratedNode)-or($hubLineageNodeRequired-and!$literalHubLineageNode)-or($pr53NodeRequired-and!$literalPr53Node)-or($pr53CiNodeRequired-and!$literalPr53CiNode-and!$literalPr54B264Node)-or($pr54B264NodeRequired-and!$literalPr54B264Node)-or($currentSharedNodeRequired-and!$literalCurrentSharedNode)-or$c.actualT1-ne$false-or$c.database-cne'MELISA_ERP_CRM_SHARED_TEST_20261009_02'-or$c.copyId-cne'e16b70f0-4057-428b-9abc-6bbcaf35fe82'){throw 'ERP_HUB_WAIT_TARGET'}
if($currentSharedNodeRequired){
 $expectedCurrentApps=@(
  @{name='crm';source='d1e4425206249e38445fb103e03601f86baa84ec';root='C:\Sirket\CRM\releases\node-v24.19.0\crm-shared-test-d1e4425206249e38445fb103e03601f86baa84ec';manifest='a0e86fccbdb95eeb97e4dc08e383db7bf8f12a29b040f34a78f6c37e3093b5ef'},
  @{name='erpApiNative';source='6dc33f41737349c6e3f17fb867a451b570a00acc';root='C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261020-6dc33f41';manifest='6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49'},
  @{name='hub';source='6dc33f41737349c6e3f17fb867a451b570a00acc';root='C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261020-6dc33f41';manifest='6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49'}
 )
 foreach($expected in $expectedCurrentApps){$app=$c.components.($expected.name);if($app.sourceCommit-cne$expected.source-or$app.packageRoot-cne$expected.root-or$app.manifestSha256-cne$expected.manifest){throw 'ERP_HUB_WAIT_TARGET'}}
}
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
