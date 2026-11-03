param([ValidatePattern('^[a-f0-9]{64}$')][string]$SourceManifestHash,[string]$PlanPath,[switch]$Library)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Bootstrap imports nothing until every source and before-image is verified
# and held read-only. The task argument pins this manifest, not HEAD or WIP.
function Open-ErpCurrentPairSourceFile([string]$Root,[string]$Leaf) {
 $full=Join-Path $Root $Leaf
 for($p=$full;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'CURRENT_PAIR_SOURCE_REPARSE'}}
 return ,([IO.File]::Open($full,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read))
}
function Read-ErpCurrentPairSources([string]$Root,[string]$ManifestHash) {
 if($Root-cnotmatch '^C:\\Sirket\\ERP\\releases\\ERP-CURRENT-PAIR-STARTUP-SOURCE-[a-f0-9]{40}$'-or$ManifestHash-cnotmatch '^[a-f0-9]{64}$'){throw 'CURRENT_PAIR_ENTRY_ROOT'}
 $holds=[Collections.Generic.List[object]]::new();$texts=@{}
 try{
 $names=@('start-current-business-pair.ps1','current-business-pair-startup.ps1','start-owned-test.ps1','canonical-business-sale-maintenance.ps1','start-business-5244-owned.ps1','start-business-5244-web.ps1','business-5244-startup-exclusion.ps1','business-5244-retirement-state.ps1','business-5244-retirement-channel.ps1','business-5244-maintenance-dispatch.ps1','business-5244-web-native.cs','business-5244-retirement-peer.cs','startup-before-config.json','startup-before-task.xml','startup-before-sddl.txt')
 foreach($leaf in @('startup-source-manifest.json')+$names){
  $stream=Open-ErpCurrentPairSourceFile $Root $leaf;$holds.Add($stream)
  $memory=[IO.MemoryStream]::new();try{$stream.CopyTo($memory);$bytes=$memory.ToArray()}finally{$memory.Dispose()}
  $sha=[Security.Cryptography.SHA256]::Create();try{$digest=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  $texts[$leaf]=@{digest=$digest;bytes=$bytes.Length;text=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)}
 }
 if($texts['startup-source-manifest.json'].digest-cne$ManifestHash){throw 'CURRENT_PAIR_SOURCE_MANIFEST_HASH'}
 $manifest=$texts['startup-source-manifest.json'].text|ConvertFrom-Json
 if((@($manifest.PSObject.Properties.Name|Sort-Object)-join'|')-cne'applicationProducer|executionAuthority|files|installed|root|schema|sourceCommit'-or$manifest.applicationProducer-cne'7c6dcc72749862958aa3fad9011837eda900cf83'-or$manifest.installed-isnot[bool]-or$manifest.installed-or$manifest.executionAuthority-isnot[bool]-or$manifest.executionAuthority-or$manifest.schema-cne'melisa-current-pair-startup-source.v1'-or$manifest.root-cne$Root-or$manifest.sourceCommit-cne([IO.Path]::GetFileName($Root).Substring('ERP-CURRENT-PAIR-STARTUP-SOURCE-'.Length))-or@($manifest.files).Count-ne$names.Count){throw 'CURRENT_PAIR_SOURCE_MANIFEST_SCOPE'}
 $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach($row in $manifest.files){if((@($row.PSObject.Properties.Name|Sort-Object)-join'|')-cne'bytes|path|sha256'-or$row.path-cnotin$names-or!$seen.Add($row.path)-or$row.sha256-cne$texts[$row.path].digest-or$row.bytes-isnot[int]-or$row.bytes-ne$texts[$row.path].bytes){throw 'CURRENT_PAIR_SOURCE_CHANGED'}}
 return @{holds=$holds;texts=$texts}
 }catch{foreach($stream in $holds){$stream.Dispose()};throw}
}
function Invoke-ErpCurrentPairEntry([string]$ManifestHash,[string]$PlanFile) {
 if($PlanFile-cne(Join-Path $PSScriptRoot 'startup-plan.json')){throw 'CURRENT_PAIR_ENTRY_PLAN'}
 $source=Read-ErpCurrentPairSources $PSScriptRoot $ManifestHash;$texts=$source.texts
 try{
 # No AST extraction or mutable unverified import. These ordinary libraries
 # and their relative import closure are the exact held source bytes.
 . (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
 . (Join-Path $PSScriptRoot 'start-business-5244-owned.ps1') -Library
 . (Join-Path $PSScriptRoot 'current-business-pair-startup.ps1')
 $before=$texts['startup-before-config.json'].text;$beforeTask=$texts['startup-before-task.xml'].text;$beforeSddl=$texts['startup-before-sddl.txt'].text
 $expected=New-ErpCurrentPairProjection -BeforeConfig $before -BeforeTask $beforeTask -BeforeSddl $beforeSddl -ExpectedConfigHash $texts['startup-before-config.json'].digest -ExpectedTaskHash $texts['startup-before-task.xml'].digest -BundleRoot $PSScriptRoot -SourceManifestHash $ManifestHash -PlanPath $PlanFile
 $plan=Get-Content -LiteralPath $PlanFile -Raw|ConvertFrom-Json
 if(($plan|ConvertTo-Json -Depth 100 -Compress)-cne($expected|ConvertTo-Json -Depth 100 -Compress)){throw 'CURRENT_PAIR_PLAN_BEFORE_IMAGE_CHANGED'}
 $task=Read-ErpCurrentPairTask
 $receipt='C:\Sirket\ERP\evidence\ERP-C06-METADATA-ROUTE-RUNTIME-20261102-2254\current-pair-7c6dcc72749862958aa3fad9011837eda900cf83-receipt.json'
 $binding=Open-ErpCurrentPairBinding $plan ([IO.File]::ReadAllText($plan.startupConfig)) $task.xml $task.sddl $PSScriptRoot $ManifestHash ([IO.File]::ReadAllText($receipt))
 Invoke-ErpCurrentPairSession $binding
 }finally{foreach($stream in $source.holds){$stream.Dispose()}}
}
if(!$Library){
 try{Invoke-ErpCurrentPairEntry $SourceManifestHash $PlanPath}catch{
  $safe=if($_.Exception.Message-cmatch'^[A-Z][A-Z0-9_]{0,100}$'){$_.Exception.Message}else{'CURRENT_PAIR_STARTUP_UNAVAILABLE'}
  Write-Error ('CURRENT_PAIR_STARTUP_FAILED: '+$safe);exit 1
 }
}
