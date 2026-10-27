param([switch]$Library)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Get-Business5244WebPins {
 return @{root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-ba09a225';manifest='5801A9CEE6514477CC040A291563F07E2BDE076104C2DD0765967B5A453CC773';package='ERP-BUSINESS-WEB-5244-ba09a225';apiPackage='CANONICAL-TEST125-BUSINESS5244-ba09a225';apiManifest='1f6656c0210de6029686951927afb9a7c76f7be9e013e80b2803965d35c8ffff';baseSource='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';frontendSource='87447c7004a55af925af9698cee0b90242ec2f8b';profile='ERP-5244-REALDATA-20261027';node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeHash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237';runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'}
}
function Assert-Business5244WebManifest($Manifest){
 $p=Get-Business5244WebPins
 if($Manifest.kind -cne 'ERP_BUSINESS_WORKFACE_WEB_CANDIDATE' -or $Manifest.packageId -cne $p.package -or $Manifest.database -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $Manifest.sourceCommit -cne $p.frontendSource -or $Manifest.businessWorkfaceId -cne $p.profile -or $Manifest.backendPackageId -cne $p.apiPackage -or $Manifest.backendManifestSha256 -cne $p.apiManifest -or $Manifest.actualT1 -ne $false -or $Manifest.externalOperations -ne $false -or $Manifest.businessSessionSignerDomain -cne 'dedicated-business-key-v1'){throw 'BUSINESS_WEB_MANIFEST_REJECTED'}
}
function Assert-Business5244ApiHealth($Health){
 $p=Get-Business5244WebPins
 if($Health.ok -ne $true -or $Health.environment -cne 'CANONICAL_TEST' -or $Health.mode -cne 'erp' -or $Health.port -ne 4144 -or $Health.databaseName -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $Health.serverName -ine 'Semih\MELISADEV' -or $Health.loginName -cne 'melisa_sirket_sales_test_20260929_01' -or $Health.databaseUser -cne $Health.loginName -or $Health.sysadmin -ne 0 -or $Health.databaseControl -ne 0 -or $Health.liveDatabaseAccess -ne 0 -or $Health.sourceCommit -cne $p.baseSource -or $Health.packageId -cne $p.apiPackage -or $Health.businessWorkfaceId -cne $p.profile -or $Health.normalSessionUserId -ne 17 -or $Health.persistentNormalSession -ne $true -or $Health.businessSessionSignerDomain -cne 'dedicated-business-key-v1' -or $Health.actualT1 -ne $false -or $Health.externalOperations -ne $false -or $Health.automaticJobs -ne $false){throw 'BUSINESS_WEB_API_REJECTED'}
}
function Start-Business5244Web {
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
}
if(!$Library){Start-Business5244Web|Select-Object Id,StartTime}
