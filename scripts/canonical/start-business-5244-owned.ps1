param([Alias('Library')][switch]$OwnedLibrary)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'business-5244-startup-exclusion.ps1') -Library
. (Join-Path $PSScriptRoot 'start-business-5244-web.ps1') -Library
. (Join-Path $PSScriptRoot 'business-5244-retirement-state.ps1') -Library
. (Join-Path $PSScriptRoot 'business-5244-retirement-channel.ps1') -Library
. (Join-Path $PSScriptRoot 'business-5244-maintenance-dispatch.ps1') -Library

function Initialize-Business5244WebNative {
 if(!('Business5244WebNative' -as [type])){Add-Type -LiteralPath (Join-Path $PSScriptRoot 'business-5244-web-native.cs')}
}
function Assert-Business5244OwnedListeners($Rows,[int]$ChildPid){
 $addresses=@('100.87.188.3','127.0.0.1','192.168.1.46');$rows=@($Rows)
 if($ChildPid -le 0 -or $rows.Count -ne 3 -or @($rows|Where-Object {$_.OwningProcess -ne $ChildPid -or $_.LocalPort -ne 5244}).Count -or ((@($rows|ForEach-Object {$_.LocalAddress}|Sort-Object) -join '|') -cne ($addresses -join '|'))){throw 'OWNED_WEB_LISTENER_MISMATCH'}
}
function Assert-Business5244CreatedChild($Native,$Pins){
 if(!($Native -is [Business5244WebNative]) -or !$Native.ChildAlive()){throw 'OWNED_WEB_NATIVE_CHILD_REQUIRED'}
 $Native.Validate();$actual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$Native.ChildPid)
 if(!$actual -or ![Business5244WebNative]::MatchesCimBirth([long]$Native.ChildBirth,$actual.CreationDate.ToUniversalTime().ToFileTimeUtc())){throw 'OWNED_WEB_CREATION_CHANGED'}
 $owner=Invoke-CimMethod -InputObject $actual -MethodName GetOwnerSid
 if($owner.ReturnValue -ne 0){throw 'OWNED_WEB_SID_UNAVAILABLE'}
 Assert-Business5244FreshSpawnArguments @{parent=$actual.ParentProcessId;exe=$actual.ExecutablePath;sid=$owner.Sid;command=$actual.CommandLine} $Pins
}
function Assert-Business5244OwnedPackage($Pins){
 # Only the two fixed source pins are supported (current/ReadPair). No executable,
 # PID, root, arbitrary command, credentials or process adoption parameters.
 $exact=if($Pins.package -ceq (Get-Business5244ReadPairPins).package){Get-Business5244ReadPairPins}else{Get-Business5244WebPins}
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
function Get-Business5244MaintenancePlan($State){
 $r=Get-Business5244RetirementState $State;$candidate=Get-Business5244ReadPairPins
 $identity=@($candidate.package,$candidate.manifest,$candidate.apiPackage,$candidate.apiManifest,$candidate.nodeHash,$candidate.profile) -join '|'
 return @{candidate=$candidate;rollback=$r.pins.Clone();hash=(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity)))}
}
function Assert-Business5244MaintenancePlan($Plan,$State){
 $r=Get-Business5244RetirementState $State
 if($r.phase -cnotin @('Running','Retired') -or $Plan.hash -cne (Get-Business5244MaintenancePlan $State).hash){throw 'OWNED_WEB_MAINTENANCE_PLAN_CHANGED'}
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Plan.rollback[$key] -cne $r.pins[$key]){throw 'OWNED_WEB_ROLLBACK_PINS_CHANGED'}}
 Assert-Business5244OwnedPackage $Plan.candidate
 # API upgrades are outside this web-only dispatcher. Both the candidate and
 # rollback must work against the SAME current API before the old child stops.
 $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 3
 Assert-Business5244ApiHealth $health $Plan.candidate
 Assert-Business5244ApiHealth $health $Plan.rollback
 if($Plan.rollback.root -cne $Plan.candidate.root -or $Plan.rollback.manifest -cne $Plan.candidate.manifest){Assert-Business5244OwnedPackage $Plan.rollback}
 if((Get-FileHash -LiteralPath (Join-Path $Plan.rollback.root 'release-manifest.json')).Hash -cne $Plan.rollback.manifest){throw 'OWNED_WEB_ROLLBACK_MANIFEST_CHANGED'}
 if($r.phase -ceq 'Running'){Assert-Business5244CreatedChild $r.native $r.pins;Assert-Business5244ReadyChild $r.native $r.pins}
 else{
  Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
  if(!$r.native.RetirementConfirmed -or !$r.records -or !$r.pending -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $r.recordExpected -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.pending)) -cne $r.pendingHash){throw 'OWNED_WEB_RETIRED_SCOPE_CHANGED'}
 }
}
function Assert-Business5244ReadyChild($Native,$Pins){
 Assert-Business5244CreatedChild $Native $Pins
 $all=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 $rows=@($all|Where-Object {$_.OwningProcess -eq $Native.ChildPid -or $_.LocalPort -eq 5244})
 Assert-Business5244OwnedListeners $rows $Native.ChildPid
}
function New-Business5244PinnedChild($Pins,$Lease){
 Assert-Business5244StartupLease -Lease $Lease
 $native=$null
 try{
  $pins=$Pins
  Assert-Business5244OwnedPackage $pins
  $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 3
  Assert-Business5244ApiHealth $health $pins
  if(@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'OWNED_WEB_PORT_OCCUPIED_NO_ADOPTION'}
  Initialize-Business5244WebNative
  $native=[Business5244WebNative]::new()
  $leaseRecord=Get-Business5244StartupRecord $Lease
  if(!$leaseRecord.ContainsKey('ownedNatives')){$leaseRecord.ownedNatives=[Collections.Generic.List[object]]::new()}
  $leaseRecord.ownedNatives.Add($native)
  $saved=@{};foreach($entry in Get-ChildItem Env:){$saved[$entry.Name]=$entry.Value}
  try{
   foreach($name in @($saved.Keys)){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
   foreach($name in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if($saved.ContainsKey($name)){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
   $env:NODE_ENV='production';$env:MELISA_BUSINESS_UI_NETWORK='lan-tailscale-20261027';$env:MELISA_BUSINESS_WORKFACE=$pins.profile;$env:VITE_ERP_WORKFACE=$pins.profile;$env:VITE_API_BASE_URL='http://127.0.0.1:4144';$env:BUSINESS_SOURCE_COMMIT=$pins.baseSource;$env:BUSINESS_PACKAGE_ID=$pins.apiPackage
   $env:MELISA_BUSINESS_UI_TAILSCALE_PEERS='100.86.84.62,100.73.186.18,100.119.165.10,100.90.192.55,100.69.88.86,100.84.179.20,100.87.188.3'
   $cwd=Join-Path $pins.root 'apps\sites-workflow';$vite=Join-Path $cwd 'node_modules\vite\bin\vite.js'
   Assert-Business5244StartupLease -Lease $Lease
   $native.Spawn($pins.node,('"'+$vite+'" preview --host 127.0.0.1 --port 5244 --strictPort'),$cwd)
  }finally{foreach($entry in Get-ChildItem Env:){[Environment]::SetEnvironmentVariable($entry.Name,$null,'Process')};foreach($entry in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($entry.Key,$entry.Value,'Process')};$saved.Clear()}
  Assert-Business5244CreatedChild $native $pins
  $ready=$false;$deadline=[DateTime]::UtcNow.AddSeconds(20)
  do{
   Assert-Business5244StartupLease -Lease $Lease
   if(!$native.ChildAlive()){throw 'OWNED_WEB_EXITED_BEFORE_READY'}
   $all=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
   $rows=@($all|Where-Object {$_.OwningProcess -eq $native.ChildPid -or $_.LocalPort -eq 5244})
   if($rows.Count -ge 3 -or @($rows|Where-Object {$_.OwningProcess -ne $native.ChildPid -or $_.LocalPort -ne 5244}).Count){Assert-Business5244OwnedListeners $rows $native.ChildPid;$ready=$true;break}
   Start-Sleep -Milliseconds 250
  }while([DateTime]::UtcNow -lt $deadline)
  if(!$ready){throw 'OWNED_WEB_START_TIMEOUT'}
  return $native
 }catch{
  $failure=$_
  if($native){try{$native.Dispose()}catch{throw 'OWNED_WEB_CLEANUP_UNCONFIRMED'}}
  throw $failure
 }
}
function Close-Business5244PinnedChildren($Lease){
 Assert-Business5244StartupLease -Lease $Lease
 $r=Get-Business5244StartupRecord $Lease;$failed=$false
 if($r.ContainsKey('ownedNatives')){foreach($native in $r.ownedNatives){try{$native.Dispose()}catch{$failed=$true}}}
 if($failed){throw 'OWNED_WEB_CLEANUP_UNCONFIRMED'}
}
function Start-Business5244OwnedSupervisor {
 # A fresh empty-port start only. DEC084 first maintenance, restart exclusion
 # of unmodified legacy entries, and initial publication remain separate gates.
 $lease=Enter-Business5244StartupLease -Kind Owner
 $native=$null;$retirement=$null;$channel=$null
 try{
  $pins=Get-Business5244ReadPairPins
  $native=New-Business5244PinnedChild $pins $lease
  $retirement=Register-Business5244OwnedRetirement $lease $native $pins
  $channel=Open-Business5244RetirementChannel -OwnerLease $lease
  # Retain the real creation handle and Job for the entire child lifetime.
  # Merely serializing this observation never grants maintenance authority.
  [pscustomobject]@{kind='business-5244-owned-start';ownerPid=$PID;ownerBirth=$native.OwnerBirth;childPid=$native.ChildPid;childBirth=$native.ChildBirth;package=$pins.package;networkReady=$true;installedRecordPublished=$false}
  while($true){
   Assert-Business5244StartupLease -Lease $lease
   $snapshot=Get-Business5244RetirementSnapshot $retirement
   if($snapshot.phase -ceq 'Running' -and !(Get-Business5244RetirementState $retirement).native.ChildAlive()){throw 'OWNED_WEB_CHILD_EXITED'}
   $request=$null
   try{$request=Receive-Business5244RetirementRequest -Channel $channel}catch{if($_.Exception.Message -ceq 'RETIREMENT_REQUEST_NOT_CONFIRMED'){Start-Sleep -Milliseconds 200;continue};throw}
   if($request){
    $reply='Status'
    try{
     Assert-Business5244RetirementRequest -Channel $channel -Request $request
     if($request.operation -ceq 'retire'){Invoke-Business5244OwnerMaintenance $retirement $channel $request|Out-Null;$reply='RetireAccepted'}
    }catch{$reply='Rejected'}
    $snapshot=Get-Business5244RetirementSnapshot $retirement
    $snapshot.requestId=$request.requestId
    # ACK loss never rolls the state back or replays a native stop. A later
    # authenticated status request observes the retained retirement state.
    try{Complete-Business5244RetirementRequest -Channel $channel -Request $request -Reply $reply -Snapshot $snapshot|Out-Null}catch{}
   }
   Start-Sleep -Milliseconds 200
  }
 }finally{
  $cleanupFailed=$false
  if($channel){try{Close-Business5244RetirementChannel -Channel $channel}catch{$cleanupFailed=$true}}
  if($retirement){try{Close-Business5244RetirementState $retirement}catch{$cleanupFailed=$true}}
  if($native){try{$native.Dispose()}catch{$cleanupFailed=$true}}
  try{Close-Business5244PinnedChildren $lease}catch{$cleanupFailed=$true}
  if($cleanupFailed){throw 'OWNED_WEB_CLEANUP_UNCONFIRMED'}
  Exit-Business5244StartupLease -Lease $lease
 }
}
if(!$OwnedLibrary){Start-Business5244OwnedSupervisor}
