param([Parameter(Mandatory=$true)][string]$StartupConfigPath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$StartupConfigSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules',$name,$name+'.psd1')) -ErrorAction Stop}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-cne$owner){throw 'REHEARSAL_OWNER'}
if($StartupConfigPath-cnotmatch '\AC:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018\\run-[a-f0-9]{32}\\settings-(old|new)\.json\z'){throw 'REHEARSAL_PATH'}
$generation=$Matches[1]
for($p=$StartupConfigPath;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'REHEARSAL_REPARSE'}}
if((Get-FileHash -LiteralPath $StartupConfigPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$StartupConfigSha256){throw 'REHEARSAL_SETTINGS_HASH'}
$c=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
if($c.environment-cne'P03_REHEARSAL'-or$c.actualT1-ne$false-or$c.database-cne'MELISA_ERP_P03_RESTORE_TEST_20261018_01'-or$c.node.path-cne'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-or$c.node.sha256-cne'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'){throw 'REHEARSAL_SCOPE'}
if((Get-FileHash -LiteralPath $c.node.path -Algorithm SHA256).Hash.ToLowerInvariant()-cne$c.node.sha256){throw 'REHEARSAL_NODE'}
$packageRoot=$c.supervisor.packageRoot
if($packageRoot-cne([IO.Path]::Combine([IO.Path]::GetDirectoryName($StartupConfigPath),'packages',$generation))){throw 'REHEARSAL_PACKAGE'}
$manifestPath=Join-Path $packageRoot 'release-manifest.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()-cne$c.supervisor.manifestSha256){throw 'REHEARSAL_MANIFEST'}
$m=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
foreach($file in $m.files){$target=[IO.Path]::GetFullPath((Join-Path $packageRoot $file.path));if(-not$target.StartsWith($packageRoot+'\',[StringComparison]::Ordinal)-or(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()-cne$file.sha256){throw 'REHEARSAL_PAYLOAD'}}
$cfg=$c.supervisor.config
if((Get-FileHash -LiteralPath $cfg.path -Algorithm SHA256).Hash.ToLowerInvariant()-cne$cfg.sha256){throw 'REHEARSAL_CONFIG'}
$psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$c.node.path;$psi.Arguments='--no-maglev "'+(Join-Path $packageRoot 'p03-rehearsal-fixture.mjs')+'" --role coreSupervisor --config "'+$cfg.path+'" --generation '+$generation;$psi.WorkingDirectory=$packageRoot;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
$psi.EnvironmentVariables['PSModulePath']='C:\Windows\System32\WindowsPowerShell\v1.0\Modules'
$child=[Diagnostics.Process]::Start($psi)
$child.WaitForExit()
exit $child.ExitCode
