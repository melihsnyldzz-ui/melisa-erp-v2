param([switch]$Library)
# Future-owner opt-in only. No shipped entry issues this capability. This file
# is not a bootstrap, installer, stop command or authority for an existing owner.
if(!(Get-Variable Business5244CooperativeExits -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244CooperativeExits=[Collections.Generic.List[object]]::new()}
function Get-Business5244CooperativeExitCase {
 return @{root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-COOPERATIVE-OWNER-V1-20261101';auditParent='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-cooperative-exit-v1-20261101'}
}
function Get-Business5244CooperativeExit($Token){
 $rows=@($script:Business5244CooperativeExits|Where-Object{[object]::ReferenceEquals($_.token,$Token)})
 if($rows.Count-ne1){throw 'COOPERATIVE_EXIT_UNISSUED'};$r=$rows[0]
 if($r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$r.birth-cne[Business5244RetirementPeer]::CurrentBirth){throw 'COOPERATIVE_EXIT_ISSUER_CHANGED'}
 return $r
}
function Write-Business5244CooperativeExitRecord($Record,[string]$Leaf,$Value){
 if($Leaf-cnotin@('claim.json','intent.json','clean.json')){throw 'COOPERATIVE_EXIT_RECORD_SCOPE'}
 $Record.seal.ValidateJournal()
 $path=Join-Path $Record.root $Leaf;$stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 6 -Compress));$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);$stream.Position=0;$actual=[byte[]]::new($bytes.Length);if($stream.Read($actual,0,$actual.Length)-ne$actual.Length-or(Get-Business5244StartupHash $actual)-cne(Get-Business5244StartupHash $bytes)){throw 'COOPERATIVE_EXIT_RECORD_NOT_DURABLE'};$Record.seal.ValidateJournal();$Record.records.Add($stream);return Get-Business5244StartupHash $bytes}catch{$stream.Dispose();throw}
}
function New-Business5244CooperativeExit {
 param([Parameter(Mandatory)]$Lease,[Parameter(Mandatory)]$Native,[Parameter(Mandatory)]$Plan,$ColdCurrentRecovery=$null)
 Assert-Business5244StartupLease $Lease -Kind Owner
 if(!($Native-is[Business5244WebNative])-or!$Native.ChildAlive()){throw 'COOPERATIVE_EXIT_OWN_CHILD_REQUIRED'};$Native.Validate()
 # A future pinned launcher supplies this one controller generation. The plan
 # alone grants nothing: native live identity, source handles, genuine Owner
 # lease and child creation handle are all required in this owner/runspace.
 if($Plan.schema-cne'melisa-b6-cooperative-exit-plan.v1'-or$Plan.scope-cne'TEST125-API-B6-WRITER-20261029'-or$Plan.purpose-cne'FiniteNormalExit'-or$Plan.generation-isnot[string]-or$Plan.generation-cnotmatch'\A[a-f0-9]{32}\z'-or$Plan.actualT1-isnot[bool]-or$Plan.actualT1-or$Plan.installed-isnot[bool]-or$Plan.installed){throw 'COOPERATIVE_EXIT_FINITE_PLAN_REQUIRED'}
 $fixed=Get-Business5244CooperativeExitCase
 if($PSScriptRoot-cne$fixed.root){throw 'COOPERATIVE_EXIT_FROZEN_FUTURE_ROOT_REQUIRED'}
 $root=[IO.Path]::GetFullPath([string]$Plan.auditRoot)
 if(!(Test-Path -LiteralPath $root -PathType Container)-or$root-cne(Join-Path $fixed.auditParent ('cooperative-exit-'+$Plan.generation))){throw 'COOPERATIVE_EXIT_FRESH_ROOT_REQUIRED'}
 $manifestPath=Join-Path $fixed.root 'cooperative-exit-manifest.json'
 if($Plan.manifestSha256-isnot[string]-or$Plan.manifestSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'COOPERATIVE_EXIT_MANIFEST_PIN_REQUIRED'}
 foreach($role in @('owner','client')){
  $argv=$Plan.($role+'Argv');$entry=if($role-ceq'owner'){'start-business-5244-cooperative-owner.ps1'}else{'business-5244-cooperative-controller.ps1'}
  if(@($argv).Count-ne7-or$argv[4]-cne(Join-Path $fixed.root $entry)-or$argv[5]-cne'-ManifestSha256'-or$argv[6]-cne$Plan.manifestSha256){throw 'COOPERATIVE_EXIT_FUTURE_ENTRY_REQUIRED'}
 }
 $manifestHold=[IO.File]::Open($manifestPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{$mbytes=[byte[]]::new([int]$manifestHold.Length);if($mbytes.Length-gt32768-or$manifestHold.Read($mbytes,0,$mbytes.Length)-ne$mbytes.Length-or(Get-Business5244StartupHash $mbytes)-cne$Plan.manifestSha256){throw 'COOPERATIVE_EXIT_MANIFEST_CHANGED'};$manifest=[Text.UTF8Encoding]::new($false,$true).GetString($mbytes)|ConvertFrom-Json}finally{$manifestHold.Dispose()}
 if(($manifest.PSObject.Properties.Name|Sort-Object)-join','-cne'executionAuthority,files,generation,installed,purpose,schema,scope'-or$manifest.schema-cne'melisa-b6-cooperative-exit-generation.v1'-or$manifest.scope-cne$Plan.scope-or$manifest.purpose-cne$Plan.purpose-or$manifest.generation-cne$Plan.generation-or$manifest.installed-isnot[bool]-or$manifest.installed-or$manifest.executionAuthority-isnot[bool]-or$manifest.executionAuthority){throw 'COOPERATIVE_EXIT_MANIFEST_SCOPE'}
 $required=@('start-business-5244-owned.ps1','business-5244-cooperative-exit.ps1','business-5244-cooperative-exit-native.cs','business-5244-startup-exclusion.ps1','business-5244-retirement-channel.ps1','business-5244-retirement-peer.cs','business-5244-web-native.cs','business-5244-retirement-state.ps1','business-5244-cold-current-recovery.cs','start-business-5244-web.ps1','business-5244-maintenance-dispatch.ps1','start-business-5244-cooperative-owner.ps1','business-5244-cooperative-controller.ps1')
 if(@($Plan.sources).Count-ne$required.Count-or@($manifest.files).Count-ne$required.Count){throw 'COOPERATIVE_EXIT_SOURCE_CLOSURE_REQUIRED'}
 $paths=[Collections.Generic.List[string]]::new();$hashes=[Collections.Generic.List[string]]::new()
 foreach($row in $Plan.sources){if($row.path-isnot[string]-or$row.sha256-isnot[string]-or$row.sha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'COOPERATIVE_EXIT_SOURCE_PIN_REQUIRED'};$paths.Add([IO.Path]::GetFullPath($row.path));$hashes.Add($row.sha256)}
 foreach($leaf in $required){$exact=Join-Path $PSScriptRoot $leaf;$rows=@($manifest.files|Where-Object{$_.path-ceq$leaf});if(@($paths|Where-Object{$_-ceq$exact}).Count-ne1-or$rows.Count-ne1-or($rows[0].PSObject.Properties.Name|Sort-Object)-join','-cne'path,sha256'-or$hashes[$paths.IndexOf($exact)]-cne$rows[0].sha256){throw 'COOPERATIVE_EXIT_SOURCE_CLOSURE_REQUIRED'}}
 $paths.Add($manifestPath);$hashes.Add($Plan.manifestSha256)
 $helper=Join-Path $PSScriptRoot 'business-5244-cooperative-exit-native.cs';$index=$paths.IndexOf($helper)
 # A preloaded type from elsewhere cannot be treated as this pinned source.
 if('Business5244CooperativeExitSeal'-as[type]){throw 'COOPERATIVE_EXIT_NATIVE_TYPE_PRELOADED'}
 $held=[IO.File]::Open($helper,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $seal=$null;$r=$null
 try{
  $bytes=[byte[]]::new([int]$held.Length);if($held.Read($bytes,0,$bytes.Length)-ne$bytes.Length-or(Get-Business5244StartupHash $bytes)-cne$hashes[$index]){throw 'COOPERATIVE_EXIT_SOURCE_CHANGED'}
  Add-Type -LiteralPath $helper
  $pendingPath=Get-Business5244RetirementPendingPath
  $seal=[Business5244CooperativeExitSeal]::new([int]$Plan.clientPid,[string]$Plan.clientBirth,[string[]]$Plan.ownerArgv,[string[]]$Plan.clientArgv,$paths.ToArray(),$hashes.ToArray(),$root,$pendingPath)
  $leaseRecord=Get-Business5244StartupRecord $Lease
  if($null-ne$ColdCurrentRecovery){$t='Business5244ColdCurrentRecovery'-as[type];if(!$t-or$ColdCurrentRecovery.GetType()-ne$t-or!$t.GetProperty('NormalExitCleanupComplete')-or!$t.GetMethod('AssertNormalExitBinding')-or!$leaseRecord.ContainsKey('coldOwnerWitness')){throw 'COOPERATIVE_EXIT_FUTURE_COLD_REQUIRED'};$ColdCurrentRecovery.AssertNormalExitBinding($leaseRecord.coldOwnerWitness,[int]$Native.ChildPid,[string]$Native.ChildBirth)}elseif($leaseRecord.ContainsKey('coldOwnerWitness')){throw 'COOPERATIVE_EXIT_FUTURE_COLD_REQUIRED'}
  $token=[pscustomobject]@{kind='business-5244-finite-cooperative-exit'}
  $r=@{token=$token;pid=$PID;birth=[Business5244RetirementPeer]::CurrentBirth;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;root=$root;generation=$Plan.generation;lease=$Lease;native=$Native;childPid=$Native.ChildPid;childBirth=$Native.ChildBirth;cold=$ColdCurrentRecovery;seal=$seal;records=[Collections.Generic.List[IO.FileStream]]::new();phase='Running';requestId=$null;intentHash=$null;cleanupReturned=$false;claimHash=$null;pendingPath=$pendingPath;pending=$null}
  $r.claimHash=Write-Business5244CooperativeExitRecord $r 'claim.json' ([ordered]@{schema='melisa-b6-cooperative-exit-claim.v1';generation=$r.generation;ownerPid=$r.pid;ownerBirth=$r.birth;childPid=$r.childPid;childBirth=$r.childBirth;clientPid=[int]$Plan.clientPid;clientBirth=[string]$Plan.clientBirth;scope=$Plan.scope;sourceDigest=(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(($Plan.sources|ConvertTo-Json -Compress -Depth 4))))})
  $script:Business5244CooperativeExits.Add($r);return $token
 }catch{if($r){foreach($f in $r.records){$f.Dispose()}};if($seal){$seal.Dispose()};throw}finally{$held.Dispose()}
}
function Request-Business5244CooperativeExit {
 param([Parameter(Mandatory)]$Token,[Parameter(Mandatory)]$Channel,[Parameter(Mandatory)]$Request)
 $r=Get-Business5244CooperativeExit $Token
 if($r.phase-cne'Running'){throw 'COOPERATIVE_EXIT_ONCE_CONSUMED'}
 Assert-Business5244StartupLease $r.lease -Kind Owner;$r.native.Validate()
 if(!$r.native.ChildAlive()-or$r.native.ChildPid-ne$r.childPid-or$r.native.ChildBirth-cne$r.childBirth){throw 'COOPERATIVE_EXIT_CHILD_CHANGED'}
 Assert-Business5244RetirementRequest $Channel $Request
 $c=Get-Business5244RetirementRecord $Channel
 if(![object]::ReferenceEquals($c.lease,$r.lease)-or$Request.operation-cne'exit'){throw 'COOPERATIVE_EXIT_CHANNEL_BINDING'}
 $c.peer.Validate();$r.seal.AssertClient($c.peer.Pid,$c.peer.Birth,$c.peer.Sid)
 # Consume before any I/O. An uncertain write never authorizes a second attempt.
 # On any rejection/write failure the caller stays in supervision, not finally.
 $r.phase='IntentUnknown';$r.requestId=$Request.requestId
 $r.intentHash=Write-Business5244CooperativeExitRecord $r 'intent.json' ([ordered]@{schema='melisa-b6-cooperative-exit-intent.v1';generation=$r.generation;claimSha256=$r.claimHash;requestId=$r.requestId;ownerPid=$r.pid;ownerBirth=$r.birth;childPid=$r.childPid;childBirth=$r.childBirth;state='EXIT_ACCEPTED_CLEANUP_NOT_YET_PROVEN';observedUtc=[DateTime]::UtcNow.ToString('o')})
 # Existing normal startup already rejects this exact pending path. Preserve
 # the barrier after exit; this component never deletes, archives or adopts it.
 $pending=[IO.File]::Open($r.pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 $r.pending=$pending;$r.records.Add($pending)
 $bytes=[Text.Encoding]::UTF8.GetBytes((@{schema='melisa-b6-cooperative-exit-pending.v1';generation=$r.generation;ownerPid=$r.pid;ownerBirth=$r.birth;requestId=$r.requestId;intentSha256=$r.intentHash;state='NORMAL_EXIT_PENDING';automaticRestartAllowed=$false}|ConvertTo-Json -Compress))
 $pending.Write($bytes,0,$bytes.Length);$pending.Flush($true);$pending.Position=0;$read=[byte[]]::new($bytes.Length)
 if($pending.Read($read,0,$read.Length)-ne$read.Length-or(Get-Business5244StartupHash $read)-cne(Get-Business5244StartupHash $bytes)){throw 'COOPERATIVE_EXIT_PENDING_NOT_DURABLE'}
 # Recheck the original monotonic admission and source/identity seals after the
 # durable write; it cannot renew authority if storage was slow or peer exited.
 Assert-Business5244RetirementRequest $Channel $Request;$r.seal.Validate();Assert-Business5244StartupLease $r.lease -Kind Owner
 $r.phase='Accepted';return $true
}
function Exit-Business5244CooperativeOwnerLease {
 param([Parameter(Mandatory)]$Token)
 $r=Get-Business5244CooperativeExit $Token
 if($r.phase-cne'Accepted'-or!$r.native.RetirementConfirmed-or(Get-Business5244StartupRecord $r.lease).closed){throw 'COOPERATIVE_EXIT_LEASE_RELEASE_NOT_PROVEN'}
 Exit-Business5244StartupLease $r.lease
 # Record successful RETURN, not the mutable closed flag set before ReleaseMutex.
 $r.leaseReleaseReturned=$true
}
function Complete-Business5244CooperativeExitCleanup {
 param([Parameter(Mandatory)]$Token)
 $r=Get-Business5244CooperativeExit $Token
 if($r.phase-cne'Accepted'-or!$r.ContainsKey('leaseReleaseReturned')-or!$r.leaseReleaseReturned-or!$r.native.RetirementConfirmed-or!(Get-Business5244StartupRecord $r.lease).closed){throw 'COOPERATIVE_EXIT_CLEANUP_NOT_PROVEN'}
 # Called only after normal finally returned from every child/lease operation.
 # The future outer launcher must finish Cold.Dispose before calling here.
 # This native read-only property is set at the END of successful disposal;
 # it is not the lease/witness closed flag set before ReleaseMutex.
 if($null-ne$r.cold-and!$r.cold.NormalExitCleanupComplete){throw 'COOPERATIVE_EXIT_COLD_CLEANUP_NOT_PROVEN'}
 $r.seal.ReleaseSources();$r.cleanupReturned=$true
 $r.phase='CleanupUnknown'
 $hash=Write-Business5244CooperativeExitRecord $r 'clean.json' ([ordered]@{schema='melisa-b6-cooperative-exit-clean.v1';generation=$r.generation;intentSha256=$r.intentHash;requestId=$r.requestId;ownerPid=$r.pid;ownerBirth=$r.birth;childPid=$r.childPid;childBirth=$r.childBirth;state='NORMAL_CLEANUP_COMPLETED';observedUtc=[DateTime]::UtcNow.ToString('o');sqlWrites=0;configWrites=0;terminateCalls=0})
 foreach($f in $r.records){$f.Dispose()};$r.records.Clear();$r.seal.Dispose();$r.phase='Clean'
 return [pscustomobject]@{generation=$r.generation;state='NORMAL_CLEANUP_COMPLETED';receiptSha256=$hash;runtimeGo=$false}
}
function Close-Business5244UncompletedCooperativeExit {
 param([Parameter(Mandatory)]$Token)
 $r=Get-Business5244CooperativeExit $Token
 if($r.phase-ceq'Clean'){return}
 $r.seal.Dispose();foreach($f in $r.records){$f.Dispose()};$r.records.Clear()
 # No success receipt and no deletion. An intent/pending barrier stays unknown.
}
if(!$Library){throw 'COOPERATIVE_EXIT_LIBRARY_ONLY'}
