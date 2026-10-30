param([switch]$Library)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'business-5244-startup-exclusion.ps1') -Library
function Get-Business5244WebPins {
 return @{root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-5cb682d8';manifest='BFB85A12333772BD40467F6258984CE08277F643DC544FF85B3D7BA39E86A617';package='ERP-BUSINESS-WEB-5244-5cb682d8';apiPackage='CANONICAL-TEST125-BUSINESS5244-10cdc0ee';apiManifest='3e498c4fe89853e295c3ef0a66f88abcbd640b22750c6a54d4348b309b5c2f33';baseSource='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';frontendSource='5cb682d8523552745b81422b1c2f0273cc8feb03';profile='ERP-5244-REALDATA-20261027';node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeHash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237';runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'}
}
function Get-Business5244ReadPairPins {
 $p=Get-Business5244WebPins
 $p.root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'
 $p.package='ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'
 $p.manifest='91EE8B23C37A46EC89F8060967BC7A0106F68F2DE9A4A1F4199941CCE5A9E0FD'
 $p.frontendSource='2b744f5b9ebda05b1355602126b1a8e5f114be83'
 $p.apiPackage='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'
 $p.apiManifest='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'
 return $p
}
function Test-Business5244WriterWebOnlyGeneration {
 # A source location selects this single immutable generation, never a CLI flag.
 return $PSScriptRoot-ceq'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029'
}
function Test-Business5244SteadyGeneration {
 return $PSScriptRoot-cin@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V2-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-STEADY-OWNER-20261030')
}
function Test-Business5244ReadContextRepairGeneration {
 return $PSScriptRoot-ceq'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-OWNER-20261030'
}
function Test-Business5244PackageRefreshGeneration {
 return $PSScriptRoot-cin@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V2-OWNER-20261030')
}
function Get-Business5244SteadyPins {
 if(!(Test-Business5244SteadyGeneration)){throw 'BUSINESS_STEADY_GENERATION_REQUIRED'}
 if($PSScriptRoot-ceq'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-STEADY-OWNER-20261030'){
  $repair=Read-ErpBusinessSaleReadContextRepairOwnerSource;$m=Get-Content -LiteralPath $repair.manifestPath -Raw|ConvertFrom-Json
  if($m.apiTransitionEnabled-ne$false-or$m.readPairMaintenanceEnabled-ne$false-or$m.maintenancePurpose-cne'ReadContextRepair'){throw 'BUSINESS_READ_REPAIR_STEADY_CHANGED'}
  return (Get-ErpBusinessSaleReadContextRepairPairPins -Mode Candidate).Clone()
 }
 $preview=$PSScriptRoot-cin@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-STEADY-OWNER-20261030','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-DIAGNOSTIC-V2-STEADY-OWNER-20261030');$case=if($preview){Get-ErpBusinessSalePackageRefreshFixedCase}else{$null}
 $root=if($preview){$case.steadyRoot}else{'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'}
 $path=Join-Path $root 'owner-manifest.json'
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'BUSINESS_STEADY_REPARSE_POINT'}}
 $m=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
 if($m.kind-isnot[string]-or$m.finiteScope-isnot[string]-or$m.maintenancePurpose-isnot[string]-or$m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne'TEST125-API-B6-WRITER-20261029'-or$m.maintenancePurpose-cne'WebOnlySteadyStartup'-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.recordingEnabled-isnot[bool]-or$m.recordingEnabled-or$m.apiTransitionEnabled-isnot[bool]-or$m.apiTransitionEnabled-or$m.readPairMaintenanceEnabled-isnot[bool]-or$m.readPairMaintenanceEnabled-or$m.actualT1-isnot[bool]-or$m.actualT1-or$m.externalOperations-isnot[bool]-or$m.externalOperations){throw 'BUSINESS_STEADY_OWNER_CHANGED'}
 if($preview){if($m.packagePair.path-cne'preview-package-pair.json'-or$m.packagePair.sha256-cne$case.pairHash-or(Get-FileHash -LiteralPath (Join-Path $root $m.packagePair.path)).Hash-ine$m.packagePair.sha256){throw 'BUSINESS_STEADY_PAIR_CHANGED'};return (Get-ErpBusinessSaleWriterPairPins -Mode Candidate).Clone()}
 $backendDigest='560c735fcaffa6692f55543840f8106679'+'b43b871e3c19f1990bdd17d46f9946'
 return @{root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029';package='ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029';manifest='5cebcda8e9937a4db7135bdd18e48fc1585e0d5b1854f63711fe546886ec4bf6';frontendSource='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a';apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';apiManifest=$backendDigest;baseSource='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeHash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237';profile='ERP-5244-REALDATA-20261027';runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'}
}
function Get-Business5244WriterWebOnlyPins {
 param([ValidateSet('Current','Candidate')][string]$Mode='Current')
 if($Mode-cnotin@('Current','Candidate')-or!(Test-Business5244WriterWebOnlyGeneration)){throw 'BUSINESS_WEB_ONLY_GENERATION_REQUIRED'}
 $root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029';$pairHash='f1672081cc695941cd3691cde503a0bb27c1ab58537362fb6907a5cd5dc0d4e4'
 if($pairHash-cnotmatch'\A[a-f0-9]{64}\z'){throw 'BUSINESS_WEB_ONLY_PAIR_NOT_PREPARED'}
 foreach($path in @($root,(Join-Path $root 'owner-manifest.json'),(Join-Path $root 'writer-webonly-package-pair.json'))){for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'BUSINESS_WEB_ONLY_REPARSE_POINT'}}}
 $m=Get-Content -LiteralPath (Join-Path $root 'owner-manifest.json') -Raw|ConvertFrom-Json
 if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne'TEST125-API-B6-WRITER-20261029'-or$m.maintenancePurpose-cne'WebOnlyFrontendRefresh'-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.recordingEnabled-isnot[bool]-or$m.recordingEnabled-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.packagePair.path-cne'writer-webonly-package-pair.json'-or$m.packagePair.sha256-cne$pairHash){throw 'BUSINESS_WEB_ONLY_OWNER_CHANGED'}
 $pairPath=Join-Path $root 'writer-webonly-package-pair.json'
 if((Get-FileHash -LiteralPath $pairPath).Hash-ine$pairHash){throw 'BUSINESS_WEB_ONLY_PAIR_CHANGED'}
 $p=Get-Content -LiteralPath $pairPath -Raw|ConvertFrom-Json
 if((@($p.PSObject.Properties.Name|Sort-Object)-join'|')-cne'candidate|current|purpose|schema|scope'-or$p.schema-cne'melisa-b6-writer-webonly-pair.v1'-or$p.scope-cne'TEST125-API-B6-WRITER-20261029'-or$p.purpose-cne'WebOnlyFrontendRefresh'){throw 'BUSINESS_WEB_ONLY_PAIR_CHANGED'}
 foreach($which in @('current','candidate')){
  $v=$p.$which;$a=$v.api;$w=$v.web
  if((@($v.PSObject.Properties.Name|Sort-Object)-join'|')-cne'api|web'-or(@($a.PSObject.Properties.Name|Sort-Object)-join'|')-cne'configPath|manifestSha256|packageId|root|sourceCommit'-or(@($w.PSObject.Properties.Name|Sort-Object)-join'|')-cne'backendManifestSha256|backendPackageId|frontendSourceCommit|manifestSha256|packageId|root'){throw 'BUSINESS_WEB_ONLY_PAIR_CHANGED'}
  if($a.root-cne'C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'-or$a.packageId-cne'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'-or$a.manifestSha256-cne'560c735fcaffa6692f55543840f8106679b43b871e3c19f1990bdd17d46f9946'-or$a.sourceCommit-cne'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'-or$a.configPath-cne'C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'-or$w.backendPackageId-cne$a.packageId-or$w.backendManifestSha256-cne$a.manifestSha256){throw 'BUSINESS_WEB_ONLY_API_CHANGED'}
  $webPackage=if($which-ceq'current'){'ERP-BUSINESS-WEB-5244-B6-WRITER-20261029'}else{'ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029'}
  $webHash=if($which-ceq'current'){'121020af80ef660c4b9a0872f31dd4c3306bff81346f66797a6806bf6b1a4189'}else{'5cebcda8e9937a4db7135bdd18e48fc1585e0d5b1854f63711fe546886ec4bf6'}
  $webSource=if($which-ceq'current'){'1033566d594ad7c02b8469e5c9598541333cd500'}else{'fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'}
  if($webHash-cnotmatch'\A[a-f0-9]{64}\z'-or$w.packageId-cne$webPackage-or$w.root-cne('C:\Sirket\ERP\releases\'+$webPackage)-or$w.manifestSha256-cne$webHash-or$w.frontendSourceCommit-cne$webSource){throw 'BUSINESS_WEB_ONLY_WEB_CHANGED'}
 }
 $v=if($Mode-ceq'Current'){$p.current}else{$p.candidate}
 return @{root=$v.web.root;package=$v.web.packageId;manifest=$v.web.manifestSha256;frontendSource=$v.web.frontendSourceCommit;apiPackage=$v.api.packageId;apiManifest=$v.api.manifestSha256;baseSource=$v.api.sourceCommit;node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeHash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237';profile='ERP-5244-REALDATA-20261027';runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'}
}
function Get-Business5244FinitePairPins {
 param([ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',[ValidateSet('Current','Candidate')][string]$Mode='Current')
 if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-or$Mode-cnotin@('Current','Candidate')){throw 'BUSINESS_WEB_FINITE_PAIR_SCOPE_REJECTED'}
 if(Test-Business5244SteadyGeneration){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$Mode-cne'Current'){throw 'BUSINESS_STEADY_CURRENT_ONLY'};return Get-Business5244SteadyPins}
 if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){
  if(Test-Business5244PackageRefreshGeneration){return (Get-ErpBusinessSaleWriterPairPins -Mode $Mode).Clone()}
  if(Test-Business5244WriterWebOnlyGeneration){return (Get-Business5244WriterWebOnlyPins -Mode $Mode).Clone()}
  # Only the fixed new owner's sealed pair data supplies Writer package hashes.
  # This getter issues metadata, never a profile activation capability.
  return (Get-ErpBusinessSaleWriterPairPins -Mode $Mode).Clone()
 }
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){if($Mode-ceq'Current'){return Get-Business5244WebPins};if($Mode-ceq'Candidate'){return Get-Business5244ReadPairPins}}
 elseif($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  $pins=Get-Business5244ReadPairPins
  if($Mode-ceq'Current'){return $pins}
  if($Mode-ceq'Candidate'){
   $pins.root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028'
   $pins.package='ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028'
   $pins.manifest='3881c27d0dd5ae126ead89d72a5ae28614386b040183eec3f1486c73f5bd0877'
   $pins.frontendSource='ca620bac30f96034b33d4410dc43576a38a38707'
   $pins.apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'
   $pins.apiManifest='85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d'
   return $pins
  }
 }
 throw 'BUSINESS_WEB_FINITE_PAIR_SCOPE_REJECTED'
}
function Get-Business5244StarterBytes([byte[]]$Baseline,[string]$LauncherHash){
 $sha=[Security.Cryptography.SHA256]::Create();try{$hash=[BitConverter]::ToString($sha.ComputeHash($Baseline)).Replace('-','')}finally{$sha.Dispose()}
 if($hash -cne '5B2995C261C64726A19A1F21CE8680FB97A8516A31CF0F979E4779DBF9C6FD6A' -or $LauncherHash -cnotmatch '^[A-F0-9]{64}$'){throw 'BUSINESS_WEB_STARTER_BASE_CHANGED'}
 return Get-Business5244StarterProjection $Baseline $LauncherHash
}
function Assert-Business5244FreshSpawnArguments($Facts,$Pins=(Get-Business5244WebPins)){
 # Argument validation only, not recovery admission. The caller must retain
 # its original Start-Process object/native birth handle and prove the child
 # was born after its live publication scope. Never apply to an orphan.
 $p=$Pins
 if(!$Facts -or $Facts.parent -ne $PID -or $Facts.exe -cne $p.node -or $Facts.sid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value){throw 'BUSINESS_WEB_FRESH_CHILD_REQUIRED'}
 $entry=Join-Path $p.root 'apps\sites-workflow\node_modules\vite\bin\vite.js'
 $prefix='"'+$p.node+'" ';$suffix=' preview --host 127.0.0.1 --port 5244 --strictPort'
 $exact=@(($prefix+$entry+$suffix),($prefix+'"'+$entry+'"'+$suffix))
 # Start-Process may serialize one terminal ASCII space; no extra argument.
 $allowed=@($exact)+@($exact|ForEach-Object {$_+' '})
 if($Facts.command -cnotin $allowed){throw 'BUSINESS_WEB_FRESH_ARGUMENTS_REJECTED'}
}
function Assert-Business5244MaintenanceTarget($Actual,$Expected,$Listeners,[string]$OwnerSid){
 # ERP-DEC-084 explicit new maintenance authority. This validates the CURRENT
 # target, never an original child/issuer or an adoption/publication grant.
 # The caller must hold its new birth-bound native handle, publication locks,
 # restart exclusion and persisted protection before-image throughout stop.
 $p=Get-Business5244WebPins
 if(!$Actual -or !$Expected -or !$OwnerSid -or $Actual.pid -le 0 -or $Actual.pid -ne $Expected.pid -or $Actual.birth -cne $Expected.birth -or $Actual.exe -cne $p.node -or $Actual.exe -cne $Expected.exe -or $Actual.sid -cne $OwnerSid -or $Actual.sid -cne $Expected.sid -or $Actual.command -cne $Expected.command -or $Actual.parent -ne $Expected.parent){throw 'BUSINESS_WEB_MAINTENANCE_TARGET_CHANGED'}
 $root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-5cb682d8'
 $entry=Join-Path $root 'apps\sites-workflow\node_modules\vite\bin\vite.js'
 $prefix='"'+$p.node+'" ';$suffix=' preview --host 127.0.0.1 --port 5244 --strictPort'
 $exact=@(($prefix+$entry+$suffix),($prefix+'"'+$entry+'"'+$suffix));$allowed=@($exact)+@($exact|ForEach-Object {$_+' '})
 if($Actual.command -cnotin $allowed){throw 'BUSINESS_WEB_MAINTENANCE_ARGUMENTS'}
 $rows=@($Listeners);$addresses=@('100.87.188.3','127.0.0.1','192.168.1.46')
 if($rows.Count -ne 3 -or @($rows|Where-Object {$_.OwningProcess -ne $Actual.pid -or $_.LocalPort -ne 5244}).Count -or ((@($rows|ForEach-Object {$_.LocalAddress}|Sort-Object) -join '|') -cne ($addresses -join '|'))){throw 'BUSINESS_WEB_MAINTENANCE_LISTENERS'}
}
function Get-Business5244StarterProjection([byte[]]$Baseline,[string]$LauncherHash){
 # Pure transformation. The maintenance owner calls the exact-hash wrapper.
 if($LauncherHash -cnotmatch '^[A-F0-9]{64}$'){throw 'BUSINESS_WEB_LAUNCHER_HASH'}
 $p=Get-Business5244WebPins;$encoding=New-Object Text.UTF8Encoding($false,$true);$text=$encoding.GetString($Baseline);$eol=if($text.Contains("`r`n")){"`r`n"}else{"`n"}
 $start='if(!$ApiOnly -and !$MainApiOnly){';$end='$newProcesses|ConvertTo-Json|Set-Content'
 if(([regex]::Matches($text,[regex]::Escape($start))).Count -ne 1 -or ([regex]::Matches($text,[regex]::Escape($end))).Count -ne 1){throw 'BUSINESS_WEB_STARTER_SEAM'}
 $a=$text.IndexOf($start,[StringComparison]::Ordinal);$b=$text.IndexOf($end,[StringComparison]::Ordinal);if($b -le $a){throw 'BUSINESS_WEB_STARTER_SEAM'}
 $body=@'
if(!$ApiOnly -and !$MainApiOnly){
 $businessLauncher='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\start-business-5244-web-5cb682d8.ps1'
 if((Get-FileHash -LiteralPath $businessLauncher).Hash -cne '{LAUNCHER_HASH}'){throw 'BUSINESS_WEB_LAUNCHER_CHANGED'}
 . $businessLauncher -Library
 $newProcess=Start-Business5244Web
 $newProcesses+=[pscustomobject]@{port=5244;pid=$newProcess.Id;entry='vite-preview';sourceCommit='{FRONTEND_SOURCE}';root='{WEB_ROOT}';backendPort=4144;businessWorkfaceId='ERP-5244-REALDATA-20261027'}
 if($ApiWebOnly){$newProcesses+=@(Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw|ConvertFrom-Json|Where-Object port -eq 4196)}
}else{
 $newProcesses+=@(Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw|ConvertFrom-Json|Where-Object { $_.port -notin $startPorts })
}
'@
 $body=$body.Replace('{LAUNCHER_HASH}',$LauncherHash).Replace('{FRONTEND_SOURCE}',$p.frontendSource).Replace('{WEB_ROOT}',$p.root)
 $body=($body -split '\r?\n') -join $eol
 return ,$encoding.GetBytes($text.Substring(0,$a)+$body+$eol+$text.Substring($b))
}
function Assert-Business5244WebManifest($Manifest,$Pins=(Get-Business5244WebPins)){
 $p=$Pins
 if($Manifest.kind -cne 'ERP_BUSINESS_WORKFACE_WEB_CANDIDATE' -or $Manifest.packageId -cne $p.package -or $Manifest.database -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $Manifest.sourceCommit -cne $p.frontendSource -or $Manifest.businessWorkfaceId -cne $p.profile -or $Manifest.backendPackageId -cne $p.apiPackage -or $Manifest.backendManifestSha256 -cne $p.apiManifest -or $Manifest.actualT1 -ne $false -or $Manifest.externalOperations -ne $false -or $Manifest.businessSessionSignerDomain -cne 'dedicated-business-key-v1'){throw 'BUSINESS_WEB_MANIFEST_REJECTED'}
  if($p.package-cin@('ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029','ERP-BUSINESS-WEB-5244-B6-PREVIEW-LINK-20261030','ERP-BUSINESS-WEB-5244-B6-PREVIEW-CONTEXT-20261030','ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030')){
  if($Manifest.webHostSourceCommit-cne'fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'-or$Manifest.backendSourceCommit-cne'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'-or$Manifest.businessSaleCandidate.kind-cne'ADMITTED_B6_WRITER_UI'-or$Manifest.businessSaleCandidate.sourceCommit-cne'1033566d594ad7c02b8469e5c9598541333cd500'-or$Manifest.businessSaleCandidate.recordingEnabled-isnot[bool]-or!$Manifest.businessSaleCandidate.recordingEnabled){throw 'BUSINESS_WEB_ONLY_MANIFEST_CHANGED'}
 }
}
function Assert-Business5244ApiHealth($Health,$Pins=(Get-Business5244WebPins)){
 $p=$Pins
 if($Health.ok -ne $true -or $Health.environment -cne 'CANONICAL_TEST' -or $Health.mode -cne 'erp' -or $Health.port -ne 4144 -or $Health.databaseName -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $Health.serverName -ine 'Semih\MELISADEV' -or $Health.loginName -cne 'melisa_sirket_sales_test_20260929_01' -or $Health.databaseUser -cne $Health.loginName -or $Health.sysadmin -ne 0 -or $Health.databaseControl -ne 0 -or $Health.liveDatabaseAccess -ne 0 -or $Health.sourceCommit -cne $p.baseSource -or $Health.packageId -cne $p.apiPackage -or $Health.businessWorkfaceId -cne $p.profile -or $Health.normalSessionUserId -ne 17 -or $Health.persistentNormalSession -ne $true -or $Health.businessSessionSignerDomain -cne 'dedicated-business-key-v1' -or $Health.actualT1 -ne $false -or $Health.externalOperations -ne $false -or $Health.automaticJobs -ne $false){throw 'BUSINESS_WEB_API_REJECTED'}
}
function Assert-Business5244RecordStage($Before,$After,[int]$ExpectedPid,[ValidateSet('Candidate','Rollback')][string]$Mode,$Pins=(Get-Business5244WebPins)){
 if($ExpectedPid -le 0 -or @($Before).Count -ne 3 -or @($After).Count -ne 3 -or ((@($Before|ForEach-Object {$_.port}|Sort-Object) -join '|') -cne '4194|4196|5244') -or ((@($After|ForEach-Object {$_.port}|Sort-Object) -join '|') -cne '4194|4196|5244')){throw 'BUSINESS_WEB_RECORD_SCOPE'}
 $oldKept=ConvertTo-Json -InputObject @($Before|Where-Object {$_.port -ne 5244}) -Depth 30 -Compress;$newKept=ConvertTo-Json -InputObject @($After|Where-Object {$_.port -ne 5244}) -Depth 30 -Compress
 if($oldKept -cne $newKept){throw 'BUSINESS_WEB_PRESERVED_RECORD_CHANGED'}
 $old=@($Before|Where-Object {$_.port -eq 5244})[0];$row=@($After|Where-Object {$_.port -eq 5244})[0]
 if($row.pid -ne $ExpectedPid -or $row.entry -cne 'vite-preview'){throw 'BUSINESS_WEB_NEW_RECORD_IDENTITY'}
 if($Mode -ceq 'Candidate'){$p=$Pins;if((@($row.PSObject.Properties.Name|Sort-Object) -join '|') -cne 'backendPort|businessWorkfaceId|entry|pid|port|root|sourceCommit' -or $row.root -cne $p.root -or $row.sourceCommit -cne $p.frontendSource -or $row.backendPort -ne 4144 -or $row.businessWorkfaceId -cne $p.profile){throw 'BUSINESS_WEB_NEW_RECORD_IDENTITY'}}
 else{$copy=$old.PSObject.Copy();$copy.pid=$ExpectedPid;if(($copy|ConvertTo-Json -Depth 30 -Compress) -cne ($row|ConvertTo-Json -Depth 30 -Compress)){throw 'BUSINESS_WEB_ROLLBACK_RECORD_CHANGED'}}
}
function Start-Business5244Web {
 param($StartupLease)
 $ownsStartupLease=($null -eq $StartupLease)
 if($ownsStartupLease){$StartupLease=Enter-Business5244StartupLease -Kind Owner}else{Assert-Business5244StartupLease -Lease $StartupLease -Kind Owner}
 try{
 $p=Get-Business5244WebPins
 if((Get-FileHash -LiteralPath $p.node).Hash -cne $p.nodeHash -or (Get-FileHash -LiteralPath (Join-Path $p.root 'release-manifest.json')).Hash -cne $p.manifest){throw 'BUSINESS_WEB_PACKAGE_PIN_CHANGED'}
 $m=Get-Content -LiteralPath (Join-Path $p.root 'release-manifest.json') -Raw|ConvertFrom-Json;Assert-Business5244WebManifest $m
 foreach($f in $m.files){$full=[IO.Path]::GetFullPath((Join-Path $p.root $f.path));if(!$full.StartsWith($p.root+'\',[StringComparison]::OrdinalIgnoreCase) -or ((Get-Item -LiteralPath $full).Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-FileHash -LiteralPath $full).Hash -ine $f.sha256){throw 'BUSINESS_WEB_PAYLOAD_CHANGED'}}
 $ready=$false;$deadline=(Get-Date).AddSeconds(300)
 do{$h=$null;try{$h=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 3}catch{};if($h -and $h.ok){Assert-Business5244ApiHealth $h;$ready=$true;break};Start-Sleep -Seconds 1}while((Get-Date)-lt$deadline)
 if(!$ready){throw 'BUSINESS_WEB_API_NOT_READY'}
 if(@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'BUSINESS_WEB_PORT_OCCUPIED'}
 # Only this launcher process changes its environment, for one normal spawn.
 # The child never inherits SQL/JWT/provider/CLEAN credentials. Restore the
 # caller's environment in memory; no credentials enter files or output.
 $saved=@{};foreach($e in Get-ChildItem Env:){$saved[$e.Name]=$e.Value}
 try{
  foreach($name in @($saved.Keys)){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
  foreach($name in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if($saved.ContainsKey($name)){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
  $env:NODE_ENV='production';$env:MELISA_BUSINESS_UI_NETWORK='lan-tailscale-20261027';$env:MELISA_BUSINESS_WORKFACE=$p.profile;$env:VITE_ERP_WORKFACE=$p.profile;$env:VITE_API_BASE_URL='http://127.0.0.1:4144';$env:BUSINESS_SOURCE_COMMIT=$p.baseSource;$env:BUSINESS_PACKAGE_ID=$p.apiPackage
  $env:MELISA_BUSINESS_UI_TAILSCALE_PEERS='100.86.84.62,100.73.186.18,100.119.165.10,100.90.192.55,100.69.88.86,100.84.179.20,100.87.188.3'
  $cwd=Join-Path $p.root 'apps\sites-workflow';$entry=Join-Path $cwd 'node_modules\vite\bin\vite.js'
  return Microsoft.PowerShell.Management\Start-Process -FilePath $p.node -ArgumentList @($entry,'preview','--host','127.0.0.1','--port','5244','--strictPort') -WorkingDirectory $cwd -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $p.runtime 'web.stdout.log') -RedirectStandardError (Join-Path $p.runtime 'web.stderr.log')
 }finally{foreach($e in Get-ChildItem Env:){[Environment]::SetEnvironmentVariable($e.Name,$null,'Process')};foreach($e in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($e.Key,$e.Value,'Process')};$saved.Clear()}
 }finally{if($ownsStartupLease){Exit-Business5244StartupLease -Lease $StartupLease}}
}
if(!$Library){Start-Business5244Web|Select-Object Id,StartTime}
