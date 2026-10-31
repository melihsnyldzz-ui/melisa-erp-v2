param([switch]$BuildWeb,[switch]$ApiOnly,[switch]$MainApiOnly,[switch]$ApiWebOnly)
$ErrorActionPreference='Stop'
throw 'B5_OFFLINE_SOURCE_ONLY: supported fresh clean-owner admission contract is missing; no runtime action permitted'
$cleanRoot='C:\Sirket\ERP\clean\20261022'
$cleanNode='C:\Sirket\ERP\tools\node-v24.19.0\node.exe'
$mainApiSource='349fae354e2a90852cd0594ada485105bf091e43'
$nativeSource='035fcc08d8f56cdd0cbc437a290285328fce1ec9'
$mainApiRoot='C:\Sirket\ERP\releases\CLEAN-ERP-20261026-349fae354e2a-b6de5305-GREENCOMBINED-OFFLINE'
$expectedManifestSha256='3AA51A25970B0EFE512E865B5572C0378931A5EB848E1AB81AB571F4DE19178F'
if(($MainApiOnly -and ($ApiOnly -or $BuildWeb -or $ApiWebOnly)) -or ($ApiWebOnly -and ($ApiOnly -or $BuildWeb))){throw 'MainApiOnly cannot rebuild or replace other components'}
$manifestPath=Join-Path $mainApiRoot 'release-manifest.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -cne $expectedManifestSha256){throw 'API package manifest differs; no process started'}
$apiManifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
if($apiManifest.sourceCommit -cne $mainApiSource -or $apiManifest.nativeSourceCommit -cne $nativeSource -or $apiManifest.database -cne 'MELISA_ERP_CLEAN_TEST_20261022' -or $apiManifest.synthetic -ne $true -or $apiManifest.actualT1 -ne $false){throw 'API package identity differs'}
if($apiManifest.kind -cne 'ERP_API_FRONTEND_COMPOSITE_OFFLINE' -or $apiManifest.frontendPatchCommit -cne 'b6de5305ba46478997ea77beaa41fdb1bb2b3af0' -or $apiManifest.component -cne 'clean-erp-api-web' -or $apiManifest.sourceTree -cne '1240b0752cab2c99daf1bf2f2ca4eaa9093ec187' -or $apiManifest.backendSourceCommit -cne $mainApiSource -or $apiManifest.environmentId -cne 'e662fd94-d797-4b3b-938a-d143ad758b67' -or $apiManifest.externalOperations -ne $false -or $apiManifest.nodeRuntime.version -cne 'v24.19.0' -or $apiManifest.nodeRuntime.path.Replace('/','\') -cne $cleanNode -or $apiManifest.nodeRuntime.sha256 -cne '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237' -or (Get-FileHash -LiteralPath $cleanNode).Hash -ine $apiManifest.nodeRuntime.sha256){throw 'Exact combined profile or Node differs'}
foreach($f in $apiManifest.files){
 $itemPath=Join-Path $mainApiRoot $f.path
 if((Get-FileHash -LiteralPath $itemPath -Algorithm SHA256).Hash -ine $f.sha256){throw 'API package content differs; no process started'}
}
if($MainApiOnly -or $ApiWebOnly){
 $nativeHealth=Invoke-RestMethod 'http://127.0.0.1:4196/test-health' -TimeoutSec 3
 if($nativeHealth.sourceCommit -cne $nativeSource -or $nativeHealth.packageId -cne ('CLEAN-ERP-20261022-'+$nativeSource.Substring(0,12)) -or $nativeHealth.database -cne 'MELISA_ERP_CLEAN_TEST_20261022' -or $nativeHealth.environmentId -cne 'e662fd94-d797-4b3b-938a-d143ad758b67' -or $nativeHealth.synthetic -ne $true -or $nativeHealth.actualT1 -ne $false -or $nativeHealth.externalOperations -ne $false){throw 'Preserved native identity is not ready'}
}
$secretRecord=Import-Clixml -LiteralPath "$cleanRoot\runtime\credentials.clixml"
function Reveal-CleanSecret($v){[Net.NetworkCredential]::new('',$v).Password}
foreach($item in Get-ChildItem Env:){if($item.Name -match '^(VEGA_|MELISA_|OPENAI_|WHATSAPP_|NAKLIYAT_)'){[Environment]::SetEnvironmentVariable($item.Name,$null,'Process')}}
$env:MELISA_CLEAN_UI_NETWORK='lan-tailscale-20261022';$env:MELISA_CLEAN_UI_TAILSCALE_PEERS='100.86.84.62,100.73.186.18,100.119.165.10,100.90.192.55,100.69.88.86,100.84.179.20,100.87.188.3';$env:MELISA_CLEAN_TEST='20261022';$env:SQL_SERVER='127.0.0.1';$env:SQL_PORT='1433';$env:SQL_DATABASE='MELISA_ERP_CLEAN_TEST_20261022';$env:SQL_USER='melisa_clean_test_app_20261022';$env:SQL_PASSWORD=Reveal-CleanSecret $secretRecord.SqlPassword;$env:SQL_READ_ONLY='false';$env:SQL_TRUSTED_CONNECTION='false';$env:SQL_ENCRYPT='false';$env:SQL_TRUST_SERVER_CERTIFICATE='true'
$env:JWT_ACCESS_SECRET=Reveal-CleanSecret $secretRecord.JwtAccess;$env:JWT_REFRESH_SECRET=Reveal-CleanSecret $secretRecord.JwtRefresh;$env:JWT_ACCESS_EXPIRES_IN='15m';$env:JWT_REFRESH_EXPIRES_IN='7d';$env:CLEAN_SOURCE_COMMIT='035fcc08d8f56cdd0cbc437a290285328fce1ec9';$env:CORS_ORIGINS='http://127.0.0.1:5244,http://127.0.0.1:62800';$env:NAKLIYAT_ENABLED='false';$env:WHATSAPP_ENABLED='false';$env:RATE_LIMIT_MAX='1000'
$env:MELISA_CLEAN_SALES='20261022';$env:MELISA_CLEAN_STORE_DAY='20261022';$env:MELISA_CLEAN_FINANCE='20261022';$env:MELISA_CLEAN_FINANCE_B4='20261023';$env:MELISA_CLEAN_FINANCE_CASH='20261023';$env:MELISA_CLEAN_FINANCE_FX='20261023';$env:MELISA_CLEAN_INVENTORY='20261022'
git -C "$cleanRoot\erp" diff --quiet $env:CLEAN_SOURCE_COMMIT -- apps scripts infra package.json package-lock.json
if($LASTEXITCODE -ne 0){throw 'Application source differs from the tested package; no new process started'}
if($BuildWeb){
 $env:VITE_API_BASE_URL='http://127.0.0.1:4194'
 Push-Location "$mainApiRoot\apps\sites-workflow"
 try{& $cleanNode 'node_modules\vite\bin\vite.js' build;if($LASTEXITCODE -ne 0){throw 'ERP web build failed'}}finally{Pop-Location}
}
$env:CLEAN_PACKAGE_ID='CLEAN-ERP-20261022-'+$env:CLEAN_SOURCE_COMMIT.Substring(0,12)
$newProcesses=@()
$checkPorts=if($ApiWebOnly){@(4194,5244)}elseif($MainApiOnly){@(4194)}elseif($ApiOnly){@(4194,4196)}else{@(4194,4196,5244)}
foreach($newPort in $checkPorts){
 if(Get-NetTCPConnection -LocalPort $newPort -State Listen -ErrorAction SilentlyContinue){throw "Port $newPort already has a listener; no takeover performed"}
}
$startPorts=if($MainApiOnly -or $ApiWebOnly){@(4194)}else{@(4194,4196)}
foreach($newPort in $startPorts){
 $processRoot=if($newPort -eq 4194){$mainApiRoot}else{"$cleanRoot\erp"}
 $env:CLEAN_SOURCE_COMMIT=if($newPort -eq 4194){$mainApiSource}else{$nativeSource}
 $env:CLEAN_PACKAGE_ID=if($newPort -eq 4194){$apiManifest.packageId}else{'CLEAN-ERP-20261022-'+$nativeSource.Substring(0,12)}
 $env:CLEAN_SYSTEM_NATIVE_SOURCE_COMMIT=$nativeSource
 $env:API_PORT=[string]$newPort
 if($newPort -eq 4194){$env:MELISA_TEST_PROTECTED_SESSION_PATH='C:\Sirket\ERP\clean\20261022\runtime\protected-erp-sessions\grants.json'}else{Remove-Item Env:MELISA_TEST_PROTECTED_SESSION_PATH -ErrorAction SilentlyContinue}
 if($newPort -eq 4194){$link=Import-Clixml -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\terminal-link.clixml'
 if($link.Schema -cne 'melisa-clean-terminal-link.v1' -or $link.EnvironmentId -cne 'e662fd94-d797-4b3b-938a-d143ad758b67' -or $link.Database -cne 'MELISA_ERP_CLEAN_TEST_20261022' -or $link.Synthetic -ne $true){throw 'Terminal link target differs'}
 $env:MELISA_TERMINAL_LINK_ENABLED='true';$env:MELISA_TERMINAL_LINK_PEER_KEY=Reveal-CleanSecret $link.PeerKey;$env:MELISA_TERMINAL_LINK_RELATIONS=$link.RelationsJson;$link=$null
 }else{foreach($name in @('MELISA_TERMINAL_LINK_ENABLED','MELISA_TERMINAL_LINK_PEER_KEY','MELISA_TERMINAL_LINK_RELATIONS')){Remove-Item "Env:$name" -ErrorAction SilentlyContinue}}
 $newProcess=Start-Process -FilePath $cleanNode -ArgumentList @('src\cleanSyntheticServer.mjs') -WorkingDirectory "$processRoot\apps\api" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$cleanRoot\runtime\erp-$newPort.stdout.log" -RedirectStandardError "$cleanRoot\runtime\erp-$newPort.stderr.log"
 $newProcesses+=[pscustomobject]@{port=$newPort;pid=$newProcess.Id;entry='cleanSyntheticServer.mjs';sourceCommit=$env:CLEAN_SOURCE_COMMIT;packageId=$env:CLEAN_PACKAGE_ID;root=$processRoot}
}
$oldRecords=@(foreach($row in (ConvertFrom-Json -InputObject (Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw))){if($row.port -notin $startPorts){$row}});ConvertTo-Json -InputObject @(@($newProcesses)+$oldRecords)|Set-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Encoding utf8
foreach($name in @('MELISA_TERMINAL_LINK_ENABLED','MELISA_TERMINAL_LINK_PEER_KEY','MELISA_TERMINAL_LINK_RELATIONS')){Remove-Item "Env:$name" -ErrorAction SilentlyContinue}
$env:CLEAN_SOURCE_COMMIT=$mainApiSource
$env:CLEAN_PACKAGE_ID=$apiManifest.packageId
if(!$ApiOnly -and !$MainApiOnly){
 $webPackageRoot='C:\Sirket\ERP\releases\CLEAN-ERP-20261026-349fae354e2a-b6de5305-GREENCOMBINED-OFFLINE'
 $webManifestSha='3AA51A25970B0EFE512E865B5572C0378931A5EB848E1AB81AB571F4DE19178F'
 if((Get-FileHash "$webPackageRoot\release-manifest.json").Hash -cne $webManifestSha){throw 'Frontend immutable manifest differs'}
 $webManifest=Get-Content "$webPackageRoot\release-manifest.json" -Raw|ConvertFrom-Json
 if($webManifest.kind -cne 'ERP_API_FRONTEND_COMPOSITE_OFFLINE' -or $webManifest.frontendPatchCommit -cne 'b6de5305ba46478997ea77beaa41fdb1bb2b3af0' -or $webManifest.component -cne 'clean-erp-api-web' -or $webManifest.sourceCommit -cne $mainApiSource -or $webManifest.frontendSourceCommit -cne $mainApiSource -or $webManifest.backendSourceCommit -cne $mainApiSource -or $webManifest.sourceTree -cne '1240b0752cab2c99daf1bf2f2ca4eaa9093ec187' -or $webManifest.frontendBuildApiBase -cne 'http://127.0.0.1:4194' -or $webManifest.environmentId -cne 'e662fd94-d797-4b3b-938a-d143ad758b67' -or $webManifest.database -cne 'MELISA_ERP_CLEAN_TEST_20261022' -or !$webManifest.synthetic -or $webManifest.actualT1 -or $webManifest.externalOperations){throw 'Frontend exact target differs'}
 foreach($f in $webManifest.files){if((Get-FileHash (Join-Path $webPackageRoot $f.path)).Hash -ine $f.sha256){throw 'Frontend immutable file differs'}}
 $webReady=$false
 $readyDeadline=[DateTime]::UtcNow.AddSeconds(60);while([DateTime]::UtcNow -lt $readyDeadline){try{$h=Invoke-RestMethod 'http://127.0.0.1:4194/test-health' -TimeoutSec 2;if($h.sourceCommit -ceq $env:CLEAN_SOURCE_COMMIT -and $h.packageId -ceq $env:CLEAN_PACKAGE_ID -and $h.database -ceq 'MELISA_ERP_CLEAN_TEST_20261022' -and $h.synthetic -eq $true -and $h.actualT1 -eq $false){$webReady=$true;break}}catch{};Start-Sleep -Milliseconds 250}
 if(!$webReady){throw 'Clean ERP health is not ready; network web was not started'}
 $newProcess=Start-Process -FilePath $cleanNode -ArgumentList @('node_modules\vite\bin\vite.js','preview','--host','127.0.0.1','--port','5244','--strictPort') -WorkingDirectory "$webPackageRoot\apps\sites-workflow" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$cleanRoot\runtime\erp-5244.stdout.log" -RedirectStandardError "$cleanRoot\runtime\erp-5244.stderr.log"
 $newProcesses+=[pscustomobject]@{port=5244;pid=$newProcess.Id;entry='vite-preview';sourceCommit=$webManifest.frontendSourceCommit;root=$webPackageRoot}
 if($ApiWebOnly){$newProcesses+=@(foreach($row in (ConvertFrom-Json -InputObject (Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw))){if($row.port -eq 4196){$row}})}
}else{
 $newProcesses+=@(foreach($row in (ConvertFrom-Json -InputObject (Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw))){if($row.port -notin $startPorts){$row}})
}
ConvertTo-Json -InputObject @($newProcesses)|Set-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Encoding utf8
$newProcesses|Format-Table
