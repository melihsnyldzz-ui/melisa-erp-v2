param([Alias('Library')][switch]$OwnedLibrary,[ValidateSet('Current','ReadPair')][string]$OwnerInitialSlot='ReadPair',[switch]$PrepareReadPairMaintenance,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')][string]$OwnerScopeName='TEST125-API-READ2b-20261028-41d3c213')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'business-5244-startup-exclusion.ps1') -Library
. (Join-Path $PSScriptRoot 'start-business-5244-web.ps1') -Library
. (Join-Path $PSScriptRoot 'business-5244-retirement-state.ps1') -Library
. (Join-Path $PSScriptRoot 'business-5244-retirement-channel.ps1') -Library
. (Join-Path $PSScriptRoot 'business-5244-maintenance-dispatch.ps1') -Library

function Initialize-Business5244WebNative {
 if(!('Business5244WebNative' -as [type])){Add-Type -LiteralPath (Join-Path $PSScriptRoot 'business-5244-web-native.cs')}
 if(!('Business5244PackageSeal' -as [type])){throw 'OWNED_WEB_NATIVE_GENERATION_RESTART_REQUIRED'}
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
function Assert-Business5244OwnedPackage($Pins,$Seal=$null){
 # Only the two fixed finite pairs are supported. No executable,
 # PID, root, arbitrary command, credentials or process adoption parameters.
 $exact=if($Pins.package -ceq (Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate).package){Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate}elseif($Pins.package -ceq (Get-Business5244ReadPairPins).package){Get-Business5244ReadPairPins}else{Get-Business5244WebPins}
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Pins[$key] -cne $exact[$key]){throw 'OWNED_WEB_PIN_CHANGED'}}
 foreach($item in @($Pins.root,$Pins.node,(Join-Path $Pins.root 'release-manifest.json'))){for($part=$item;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'OWNED_WEB_REPARSE_POINT'}}}
 if((Get-FileHash -LiteralPath $Pins.node).Hash -ine $Pins.nodeHash -or (Get-FileHash -LiteralPath (Join-Path $Pins.root 'release-manifest.json')).Hash -ine $Pins.manifest){throw 'OWNED_WEB_PACKAGE_CHANGED'}
 if($null -ne $Seal){if(!($Seal -is [Business5244PackageSeal])){throw 'OWNED_WEB_PACKAGE_SEAL_REQUIRED'};$Seal.Add($Pins.node,$Pins.nodeHash);$Seal.Add((Join-Path $Pins.root 'release-manifest.json'),$Pins.manifest)}
 $manifest=Get-Content -LiteralPath (Join-Path $Pins.root 'release-manifest.json') -Raw|ConvertFrom-Json
 Assert-Business5244WebManifest $manifest $Pins
 $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
 foreach($file in $manifest.files){
  if(!$file.path -or [IO.Path]::IsPathRooted($file.path) -or @($file.path -split '[\\/]'|Where-Object {$_ -eq '..' -or $_ -eq ''}).Count -or !$seen.Add($file.path)){throw 'OWNED_WEB_MANIFEST_PATH'}
  $full=[IO.Path]::GetFullPath((Join-Path $Pins.root $file.path))
  if(!$full.StartsWith($Pins.root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'OWNED_WEB_PATH_ESCAPE'}
  for($part=$full;$part -and $part.Length -ge $Pins.root.Length;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'OWNED_WEB_REPARSE_POINT'}}
  if($null -ne $Seal){$Seal.Add($full,$file.sha256)}elseif((Get-FileHash -LiteralPath $full).Hash -ine $file.sha256){throw 'OWNED_WEB_CONTENT_CHANGED'}
 }
}
function Get-Business5244MaintenancePlan($State,$ApiTransition=$null){
 $r=Get-Business5244RetirementState $State;$scopeName=if($r.ContainsKey('scopeName')){$r.scopeName}else{'TEST125-API-READ2b-20261028-41d3c213'};$candidate=Get-Business5244FinitePairPins -ScopeName $scopeName -Mode Candidate
 $identity=@($candidate.package,$candidate.manifest,$candidate.apiPackage,$candidate.apiManifest,$candidate.nodeHash,$candidate.profile) -join '|'
 if($null -ne $ApiTransition){
  $old=Get-Business5244FinitePairPins -ScopeName $scopeName -Mode Current
  $keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')
  foreach($key in $keys){if($r.pins[$key] -cne $old[$key]){throw 'OWNED_WEB_PAIRED_BASE_CHANGED'}}
  $contract=Get-Test125ReadPairTransitionContract -Transition $ApiTransition
  if($contract.scope -cne $scopeName -or $contract.contractSha256 -cnotmatch '^[a-f0-9]{64}$' -or $contract.mode -cne 'Current' -or $contract.phase -cnotin @('PREPARED','VERIFIED')){throw 'OWNED_WEB_API_CONTRACT_CHANGED'}
  $identity='business-5244-read-pair.v1|'+$contract.contractSha256+'|'+(($keys|ForEach-Object {$candidate[$_]}) -join '|')+'|'+(($keys|ForEach-Object {$old[$_]}) -join '|')
 }
 return @{candidate=$candidate;rollback=$r.pins.Clone();hash=(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity)))}
}
function Prepare-Business5244PairedMaintenance($State,$ApiTransition){
 $r=Get-Business5244RetirementState $State
 Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 if($r.phase -cne 'Running' -or $r.ContainsKey('preparedPair')){throw 'OWNED_WEB_PAIR_PREPARATION_NOT_ADMITTED'}
 [void](Assert-Test125ReadPairTransition -Transition $ApiTransition -Mode Current)
 if($r.scopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  if($r.initializationApiTransition-and![object]::ReferenceEquals($r.initializationApiTransition,$ApiTransition)){throw 'OWNED_WEB_INIT_API_REFERENCE_CHANGED'}
  $r.initializationApiTransition=$ApiTransition
 }
 $plan=Get-Business5244MaintenancePlan $State $ApiTransition
 Initialize-Business5244WebNative;$seal=[Business5244PackageSeal]::new()
 try{
  # Full payload verification and immutable read locks precede opening the
  # request channel. No nonce/deadline exists yet; no stop/write happens here.
  Assert-Business5244OwnedPackage $plan.rollback $seal
  Assert-Business5244OwnedPackage $plan.candidate $seal
  $seal.Freeze();Assert-Business5244ReadyChild $r.native $r.pins
  [void](Assert-Test125ReadPairTransition -Transition $ApiTransition -Mode Current)
  Prepare-Test125ReadPairRequestAdmission $ApiTransition
  # Metadata rebind and its durable archive finish before opening any nonce.
  # This remains an exact stale-record CAS, never process adoption.
  Publish-Business5244CurrentRecord -State $State|Out-Null
  $r.preparedPair=@{apiTransition=$ApiTransition;planHash=$plan.hash;seal=$seal;ownerPid=$PID;ownerBirth=$r.ownerBirth;childPid=$r.childPid;childBirth=$r.childBirth}
  # Exercise the full read-only admission path while no request exists.
  # Keep margin below the independent 15-second client ACK wait; the server
  # admission ceiling does not authorize a disconnected peer.
  $clock=[Diagnostics.Stopwatch]::StartNew()
  Assert-Business5244MaintenancePlan -Plan $plan -State $State -ApiTransition $ApiTransition
  $recordStream=[IO.File]::Open('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json',[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  try{[void](Assert-Business5244RetirementRecord $State $recordStream);[void](Assert-Business5244RetirementRecord $State $recordStream)}finally{$recordStream.Dispose()}
  $clock.Stop();$r.preparedPair.preflightMilliseconds=$clock.ElapsedMilliseconds
  if($clock.ElapsedMilliseconds -ge 10000){throw 'OWNED_WEB_PAIR_PREFLIGHT_BUDGET_EXCEEDED'}
 }catch{$seal.Dispose();throw}
}
function Assert-Business5244PreparedPair($State,$ApiTransition,[string]$PlanHash){
 $r=Get-Business5244RetirementState $State
 if(!$r.ContainsKey('preparedPair') -or !$r.preparedPair){throw 'OWNED_WEB_PAIR_NOT_PREPARED'}
 $p=$r.preparedPair
 if(![object]::ReferenceEquals($p.apiTransition,$ApiTransition) -or $p.planHash -cne $PlanHash -or $p.ownerPid -ne $PID -or $p.ownerBirth -cne $r.ownerBirth -or $p.childPid -ne $r.childPid -or $p.childBirth -cne $r.childBirth -or !($p.seal -is [Business5244PackageSeal])){throw 'OWNED_WEB_PREPARED_PAIR_CHANGED'}
 $p.seal.Validate()
}
function Assert-Business5244MaintenancePlan($Plan,$State,$ApiTransition=$null){
 $r=Get-Business5244RetirementState $State
 if($r.phase -cnotin @('Running','Retired') -or $Plan.hash -cne (Get-Business5244MaintenancePlan $State $ApiTransition).hash){throw 'OWNED_WEB_MAINTENANCE_PLAN_CHANGED'}
 $fixedCandidate=Get-Business5244FinitePairPins -ScopeName $(if($r.ContainsKey('scopeName')){$r.scopeName}else{'TEST125-API-READ2b-20261028-41d3c213'}) -Mode Candidate
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Plan.candidate[$key] -cne $fixedCandidate[$key]){throw 'OWNED_WEB_CANDIDATE_PINS_CHANGED'}}
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Plan.rollback[$key] -cne $r.pins[$key]){throw 'OWNED_WEB_ROLLBACK_PINS_CHANGED'}}
 if($null -eq $ApiTransition){Assert-Business5244OwnedPackage $Plan.candidate}else{Assert-Business5244PreparedPair $State $ApiTransition $Plan.hash}
 # API upgrades are outside this web-only dispatcher. Both the candidate and
 # rollback must work against the SAME current API before the old child stops.
 $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 3
 if($null -eq $ApiTransition){Assert-Business5244ApiHealth $health $Plan.candidate}
 else{[void](Assert-Test125ReadPairRequestAdmission -Transition $ApiTransition)}
 Assert-Business5244ApiHealth $health $Plan.rollback
 if($null -eq $ApiTransition -and ($Plan.rollback.root -cne $Plan.candidate.root -or $Plan.rollback.manifest -cne $Plan.candidate.manifest)){Assert-Business5244OwnedPackage $Plan.rollback}
 if((Get-FileHash -LiteralPath (Join-Path $Plan.rollback.root 'release-manifest.json')).Hash -ine $Plan.rollback.manifest){throw 'OWNED_WEB_ROLLBACK_MANIFEST_CHANGED'}
 if($r.phase -ceq 'Running'){
  if($null -eq $ApiTransition){Assert-Business5244CreatedChild $r.native $r.pins;Assert-Business5244ReadyChild $r.native $r.pins}
  else{
   # The sealed preparation verified SID/argv/CIM before nonce. The same
   # creation handle/Job and immutable child identity cannot be reconstructed
   # from an observation. Fresh native and TCP checks remain mandatory here.
   $r.native.Validate()
   if(!$r.native.ChildAlive() -or $r.native.RetirementConfirmed -or $r.native.ChildPid -ne $r.childPid -or $r.native.ChildBirth -cne $r.childBirth){throw 'OWNED_WEB_PREPARED_CHILD_CHANGED'}
   $allListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
   Assert-Business5244OwnedListeners @($allListeners|Where-Object {$_.OwningProcess -eq $r.childPid -or $_.LocalPort -eq 5244}) $r.childPid
   $r.native.Validate()
  }
 }
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
 param([ValidateSet('Current','ReadPair')][string]$InitialSlot='ReadPair',[switch]$PrepareReadPair,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213')
 if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')){throw 'OWNED_WEB_SCOPE_REJECTED'}
 if($PrepareReadPair -and $InitialSlot -ine 'Current'){throw 'OWNED_WEB_PAIR_REQUIRES_CURRENT_START'}
 # A fresh empty-port start only. DEC084 first maintenance, restart exclusion
 # of unmodified legacy entries, and initial publication remain separate gates.
 $lease=Enter-Business5244StartupLease -Kind Owner
 $native=$null;$retirement=$null;$channel=$null;$apiTransition=$null;$initializationFailure=$null;$verifiedInitCleanup=$null;$initRecoveryBlocked=$false
 $script:Business5244LastInitializationOutcome=$null
 try{
  $pins=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode $(if($InitialSlot -ieq 'Current'){'Current'}else{'Candidate'})
  $native=New-Business5244PinnedChild $pins $lease
  $retirement=Register-Business5244OwnedRetirement $lease $native $pins -ScopeName $ScopeName
  if($PrepareReadPair){
   . (Join-Path $PSScriptRoot 'test125-bound-api-quiescence.ps1')
   if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){$startup=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json';$nativeProfileAdmission=New-ErpBusinessSaleNativeProfileAdmission $startup;$apiTransition=New-Test125ReadPairTransition -ScopeName $ScopeName -NativeProfileAdmission $nativeProfileAdmission}else{$apiTransition=New-Test125ReadPairTransition}
   (Get-Business5244RetirementState $retirement).initializationApiTransition=$apiTransition
   Prepare-Business5244PairedMaintenance $retirement $apiTransition
  }elseif($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and$InitialSlot-ieq'Current'){
   # The finite recovery wrapper publishes only its own fresh Current child.
   # It does not issue an API transition or change any component/profile.
   . (Join-Path $PSScriptRoot 'start-owned-test.ps1') -Library
   Publish-Business5244CurrentRecord $retirement|Out-Null
  }
  $channel=Open-Business5244RetirementChannel -OwnerLease $lease
  (Get-Business5244RetirementState $retirement).initializing=$false
  # Retain the real creation handle and Job for the entire child lifetime.
  # Merely serializing this observation never grants maintenance authority.
  $startupRecord=Get-Business5244RetirementState $retirement
  $recordPublished=$ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and$startupRecord.ContainsKey('currentBootstrap')-and$startupRecord.currentBootstrap-and$startupRecord.currentBootstrap.phase-ceq'Archived'
  [pscustomobject]@{kind='business-5244-owned-start';ownerPid=$PID;ownerBirth=$native.OwnerBirth;childPid=$native.ChildPid;childBirth=$native.ChildBirth;package=$pins.package;networkReady=$true;installedRecordPublished=[bool]$recordPublished}
  while($true){
   Assert-Business5244StartupLease -Lease $lease
   $snapshot=Get-Business5244RetirementSnapshot $retirement
   if($snapshot.phase -ceq 'Running' -and !(Get-Business5244RetirementState $retirement).native.ChildAlive()){throw 'OWNED_WEB_CHILD_EXITED'}
   $request=$null
   try{$request=Receive-Business5244RetirementRequest -Channel $channel}catch{if($_.Exception.Message -cin @('RETIREMENT_REQUEST_NOT_CONFIRMED','RETIREMENT_CHANNEL_UNAVAILABLE')){Start-Sleep -Milliseconds 200;continue};throw}
   if($request){
    $reply='Status'
    try{
     Assert-Business5244RetirementRequest -Channel $channel -Request $request
     if($request.operation -ceq 'retire'){
      if($null -ne $apiTransition){Invoke-Business5244PairedOwnerMaintenance $retirement $channel $request $apiTransition|Out-Null}else{Invoke-Business5244OwnerMaintenance $retirement $channel $request|Out-Null}
      $reply='RetireAccepted'
     }elseif($request.operation -ceq 'recover'){
      if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$null-eq$apiTransition){throw 'BUSINESS_5244_RECOVERY_SCOPE_REQUIRED'}
      Resume-Business5244BlockedRollback -State $retirement -Channel $channel -Request $request -ApiTransition $apiTransition|Out-Null
      $reply='RecoveryAccepted'
     }
    }catch{$reply='Rejected'}
    $snapshot=Get-Business5244RetirementSnapshot $retirement
    $snapshot.requestId=$request.requestId
    # ACK loss never rolls the state back or replays a native stop. A later
    # authenticated status request observes the retained retirement state.
    try{Complete-Business5244RetirementRequest -Channel $channel -Request $request -Reply $reply -Snapshot $snapshot|Out-Null}catch{}
   }
   Start-Sleep -Milliseconds 200
  }
 }catch{
  $initializationFailure=$_
  if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and$InitialSlot-ieq'Current'-and$retirement){
   $r=Get-Business5244RetirementState $retirement
   if($r.initializing-and$r.ContainsKey('currentBootstrap')-and$r.currentBootstrap){
    try{$verifiedInitCleanup=Undo-Business5244CurrentBootstrap $retirement}catch{$initRecoveryBlocked=$true;throw 'OWNED_WEB_INITIALIZATION_RECOVERY_UNCONFIRMED'}
   }
  }
  throw
 }finally{
  $cleanupFailed=$initRecoveryBlocked
  if($channel){try{Close-Business5244RetirementChannel -Channel $channel}catch{$cleanupFailed=$true}}
  if($retirement){try{Close-Business5244RetirementState $retirement}catch{$cleanupFailed=$true}}
  if($native){try{$native.Dispose()}catch{$cleanupFailed=$true}}
  try{Close-Business5244PinnedChildren $lease}catch{$cleanupFailed=$true}
  if($apiTransition){try{Close-Test125ReadPairRequestAdmission $apiTransition;$apiContext=Assert-Test125ReadPairIssued $apiTransition;Close-ErpReadPairReleaseProof $apiContext.releaseProof}catch{$cleanupFailed=$true}}
  if($cleanupFailed){throw 'OWNED_WEB_CLEANUP_UNCONFIRMED'}
  Exit-Business5244StartupLease -Lease $lease
  if($verifiedInitCleanup-and$initializationFailure){
   # Issue the finite process outcome only after every cleanup and lease
   # release succeeded. The original exception reference cannot be serialized.
   $script:Business5244LastInitializationOutcome=@{exception=$initializationFailure.Exception;process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;stateRecord=$r;native=$native;verified=$verifiedInitCleanup;exitCode=73}
  }
 }
}
function Get-Business5244VerifiedInitializationExitCode($Exception){
 $o=if(Get-Variable Business5244LastInitializationOutcome -Scope Script -ErrorAction SilentlyContinue){$script:Business5244LastInitializationOutcome}else{$null}
 if(!$o-or!$Exception-or![object]::ReferenceEquals($Exception,$o.exception)-or$o.process-ne$PID-or$o.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$o.exitCode-ne73-or!$o.verified.verified-or!$o.native.RetirementConfirmed-or$o.stateRecord.phase-cne'InitializationRestored'-or$o.stateRecord.currentBootstrap.inverse.phase-cne'Archived'-or![object]::ReferenceEquals($o.native,$o.stateRecord.native)){return 1}
 return 73
}
if(!$OwnedLibrary){try{Start-Business5244OwnedSupervisor -InitialSlot $OwnerInitialSlot -PrepareReadPair:$PrepareReadPairMaintenance -ScopeName $OwnerScopeName}catch{if((Get-Business5244VerifiedInitializationExitCode $_.Exception)-eq73){exit 73};throw}}
