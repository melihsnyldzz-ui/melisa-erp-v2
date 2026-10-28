param([Alias('Library')][switch]$OwnedLibrary)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'business-5244-startup-exclusion.ps1') -Library
. (Join-Path $PSScriptRoot 'start-business-5244-web.ps1') -Library

function Initialize-Business5244WebNative {
 if(!('Business5244WebNative' -as [type])){Add-Type -LiteralPath (Join-Path $PSScriptRoot 'business-5244-web-native.cs')}
}
function Assert-Business5244OwnedListeners($Rows,[int]$ChildPid){
 $addresses=@('100.87.188.3','127.0.0.1','192.168.1.46');$rows=@($Rows)
 if($ChildPid -le 0 -or $rows.Count -ne 3 -or @($rows|Where-Object {$_.OwningProcess -ne $ChildPid -or $_.LocalPort -ne 5244}).Count -or ((@($rows|ForEach-Object {$_.LocalAddress}|Sort-Object) -join '|') -cne ($addresses -join '|'))){throw 'OWNED_WEB_LISTENER_MISMATCH'}
}
function Assert-Business5244OwnedPackage($Pins){
 # This entry point has one fixed passive candidate. It accepts no executable,
 # PID, root, arbitrary command, credentials or process adoption parameters.
 $exact=Get-Business5244ReadPairPins
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Pins[$key] -cne $exact[$key]){throw 'OWNED_WEB_PIN_CHANGED'}}
 foreach($item in @($Pins.root,$Pins.node,(Join-Path $Pins.root 'release-manifest.json'))){for($part=$item;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'OWNED_WEB_REPARSE_POINT'}}}
 if((Get-FileHash -LiteralPath $Pins.node).Hash -cne $Pins.nodeHash -or (Get-FileHash -LiteralPath (Join-Path $Pins.root 'release-manifest.json')).Hash -cne $Pins.manifest){throw 'OWNED_WEB_PACKAGE_CHANGED'}
 $manifest=Get-Content -LiteralPath (Join-Path $Pins.root 'release-manifest.json') -Raw|ConvertFrom-Json
 Assert-Business5244WebManifest $manifest $Pins
 $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
 foreach($file in $manifest.files){
  if(!$file.path -or [IO.Path]::IsPathRooted($file.path) -or @($file.path -split '[\\/]'|Where-Object {$_ -eq '..' -or $_ -eq ''}).Count -or !$seen.Add($file.path)){throw 'OWNED_WEB_MANIFEST_PATH'}
  $full=[IO.Path]::GetFullPath((Join-Path $Pins.root $file.path))
  if(!$full.StartsWith($Pins.root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'OWNED_WEB_PATH_ESCAPE'}
  for($part=$full;$part -and $part.Length -ge $Pins.root.Length;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'OWNED_WEB_REPARSE_POINT'}}
  if((Get-FileHash -LiteralPath $full).Hash -ine $file.sha256){throw 'OWNED_WEB_CONTENT_CHANGED'}
 }
}
function Start-Business5244OwnedSupervisor {
 # A fresh empty-port start only. DEC084 first maintenance, restart exclusion
 # of unmodified legacy entries, and record publication remain separate gates.
 $lease=Enter-Business5244StartupLease -Kind Owner
 $native=$null
 try{
  $pins=Get-Business5244ReadPairPins
  Assert-Business5244OwnedPackage $pins
  $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 3
  Assert-Business5244ApiHealth $health $pins
  if(@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'OWNED_WEB_PORT_OCCUPIED_NO_ADOPTION'}
  Initialize-Business5244WebNative
  $native=[Business5244WebNative]::new()
  $saved=@{};foreach($entry in Get-ChildItem Env:){$saved[$entry.Name]=$entry.Value}
  try{
   foreach($name in @($saved.Keys)){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
   foreach($name in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if($saved.ContainsKey($name)){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
   $env:NODE_ENV='production';$env:MELISA_BUSINESS_UI_NETWORK='lan-tailscale-20261027';$env:MELISA_BUSINESS_WORKFACE=$pins.profile;$env:VITE_ERP_WORKFACE=$pins.profile;$env:VITE_API_BASE_URL='http://127.0.0.1:4144';$env:BUSINESS_SOURCE_COMMIT=$pins.baseSource;$env:BUSINESS_PACKAGE_ID=$pins.apiPackage
   $env:MELISA_BUSINESS_UI_TAILSCALE_PEERS='100.86.84.62,100.73.186.18,100.119.165.10,100.90.192.55,100.69.88.86,100.84.179.20,100.87.188.3'
   $cwd=Join-Path $pins.root 'apps\sites-workflow';$vite=Join-Path $cwd 'node_modules\vite\bin\vite.js'
   Assert-Business5244StartupLease -Lease $lease -Kind Owner
   $native.Spawn($pins.node,('"'+$vite+'" preview --host 127.0.0.1 --port 5244 --strictPort'),$cwd)
  }finally{foreach($entry in Get-ChildItem Env:){[Environment]::SetEnvironmentVariable($entry.Name,$null,'Process')};foreach($entry in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($entry.Key,$entry.Value,'Process')};$saved.Clear()}
  $ready=$false;$deadline=[DateTime]::UtcNow.AddSeconds(20)
  do{
   Assert-Business5244StartupLease -Lease $lease -Kind Owner
   if(!$native.ChildAlive()){throw 'OWNED_WEB_EXITED_BEFORE_READY'}
   $all=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
   $rows=@($all|Where-Object {$_.OwningProcess -eq $native.ChildPid -or $_.LocalPort -eq 5244})
   if($rows.Count -ge 3 -or @($rows|Where-Object {$_.OwningProcess -ne $native.ChildPid -or $_.LocalPort -ne 5244}).Count){Assert-Business5244OwnedListeners $rows $native.ChildPid;$ready=$true;break}
   Start-Sleep -Milliseconds 250
  }while([DateTime]::UtcNow -lt $deadline)
  if(!$ready){throw 'OWNED_WEB_START_TIMEOUT'}
  # Retain the real creation handle and Job for the entire child lifetime.
  # Merely serializing this observation never grants maintenance authority.
  [pscustomobject]@{kind='business-5244-owned-start';ownerPid=$PID;ownerBirth=$native.OwnerBirth;childPid=$native.ChildPid;childBirth=$native.ChildBirth;package=$pins.package;networkReady=$true;installedRecordPublished=$false}
  while($native.ChildAlive()){Assert-Business5244StartupLease -Lease $lease -Kind Owner;Start-Sleep -Milliseconds 500}
  throw 'OWNED_WEB_CHILD_EXITED'
 }finally{if($native){$native.Dispose()};Exit-Business5244StartupLease -Lease $lease}
}
if(!$OwnedLibrary){Start-Business5244OwnedSupervisor}
