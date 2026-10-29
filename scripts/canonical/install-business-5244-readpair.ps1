param([switch]$Library,[switch]$Apply,[switch]$AfterLoaderRecovery,[string]$SourceSha256,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')){throw 'READPAIR_INSTALL_SCOPE_REJECTED'}
# Fixed READ2b maintenance composition. The library path defines procedures only.
# It neither grants API approval nor executes the retained private prototype.
function Read-ReadPairHeldBytes($Stream){
 $m=[IO.MemoryStream]::new();try{$Stream.Position=0;$Stream.CopyTo($m);return ,$m.ToArray()}finally{$m.Dispose();$Stream.Position=0}
}
function Select-ReadPairCommitArchives($Files,$Before){
 return @($Files|Where-Object {$_.FullName-cnotin$Before-and$_.Name-cmatch'^5244-retirement\.pending\.[a-f0-9]{32}\.completed$'})
}
function Test-ReadPairOwnerArguments([string]$Actual,[string]$Expected){
 return ($Actual -cin @($Expected,($Expected+' ')))
}
function Assert-ReadPairLoaderContinuation($Failed,$Recovered){
 if($Failed.status-cne'FAILED_REVIEW_RECEIPT'-or$Failed.failure-cne'READPAIR_NEW_RESOURCES_RECOVERY_REQUIRED'-or$Failed.retireAttempts-ne0-or$Failed.stopCalls-ne1-or$Failed.startCalls-ne1-or$Recovered.status-cne'CURRENT_PAIR_FRESH_RECOVERED_VERIFIED'-or$Recovered.retireAttempts-ne0-or$Recovered.apiRestarts-ne0-or$Recovered.stopCalls-ne0-or$Recovered.startCalls-ne1-or$Recovered.protectionPreserved-ne$true-or$Recovered.apiPackage-cne'CANONICAL-TEST125-BUSINESS5244-10cdc0ee'-or$Recovered.webPackage-cne'ERP-BUSINESS-WEB-5244-5cb682d8'){throw 'READPAIR_LOADER_CONTINUATION_NOT_ADMITTED'}
 # Shape validation only. This receipt grants no stop capability: production
 # still requires fresh exact native peer/creator generation, hashes and CAS.
}
function Assert-ReadPairExactFields($Object,[string[]]$Names){
 $keys=if($Object-is[Collections.IDictionary]){@($Object.Keys)}else{@($Object.PSObject.Properties.Name)}
 if((($keys|Sort-Object -CaseSensitive)-join'|')-cne(($Names|Sort-Object -CaseSensitive)-join'|')){throw 'READPAIR_BASELINE_FIELDS_CHANGED'}
}
function Get-ReadPairProtectionSignature($Snapshot){
 Assert-ReadPairExactFields $Snapshot @('listeners','processes','files')
 $ls=@(@(foreach($r in $Snapshot.listeners){Assert-ReadPairExactFields $r @('LocalPort','LocalAddress','OwningProcess');'{0}|{1}|{2}'-f$r.LocalPort,$r.LocalAddress,$r.OwningProcess})|Sort-Object)
 $ps=@(@(foreach($r in $Snapshot.processes){Assert-ReadPairExactFields $r @('pid','birth','exe');'{0}|{1}|{2}'-f$r.pid,$r.birth,$r.exe})|Sort-Object)
 $fs=@(@(foreach($r in $Snapshot.files){Assert-ReadPairExactFields $r @('path','hash');'{0}|{1}'-f$r.path,$r.hash})|Sort-Object)
 return ([ordered]@{listeners=$ls;processes=$ps;files=$fs}|ConvertTo-Json -Depth 6 -Compress)
}
function Assert-ReadPairExpectedEqual($Left,$Right){
 foreach($o in @($Left,$Right)){Assert-ReadPairExactFields $o @('planHash','baseHash','startupPath','apiPath','basePath','Current','Candidate');foreach($mode in @('Current','Candidate')){Assert-ReadPairExactFields $o.$mode @('startup','api')}}
 foreach($key in @('planHash','baseHash','startupPath','apiPath','basePath')){if($Left.$key-cne$Right.$key){throw 'READPAIR_EXPECTED_PLAN_DRIFT'}}
 foreach($mode in @('Current','Candidate')){foreach($key in @('startup','api')){if($Left.$mode.$key-cne$Right.$mode.$key){throw 'READPAIR_EXPECTED_PLAN_DRIFT'}}}
}
function Get-ReadPairFinalPeerState($Observed,[int]$OwnerPid,[string]$OwnerBirth){
 if(!$Observed.nativePeerVerified-or$Observed.reply-cne'Status'-or$Observed.state.ownerPid-ne$OwnerPid-or$Observed.state.ownerBirth-cne$OwnerBirth){throw 'READPAIR_FINAL_PEER_CHANGED'}
 if($Observed.state.phase-ceq'Unknown'){throw 'READPAIR_FINAL_OWNER_UNKNOWN'}
 return $Observed.state
}
function Publish-ReadPairSealedFile([string]$Path,[byte[]]$Bytes){
 $hash=Get-Business5244StartupHash $Bytes
 $writer=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{$writer.Write($Bytes,0,$Bytes.Length);$writer.Flush($true);if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $writer))-cne$hash){throw 'READPAIR_CREATED_FILE_FLUSH_UNCONFIRMED'}}finally{$writer.Dispose()}
 # PowerShell script loading shares READ, not WRITE. A still-open writer,
 # even with FileShare.Read, conflicts symmetrically with that reader.
 # Reopen READ-ONLY and validate the exact bytes before executing anything.
 Assert-ReadPairPath $Path
 $reader=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $reader))-cne$hash){throw 'READPAIR_CREATED_FILE_CHANGED'};return $reader}catch{$reader.Dispose();throw}
}
function Write-ReadPairHeldCas($Stream,[string]$Expected,[byte[]]$Bytes){
 $prior=Read-ReadPairHeldBytes $Stream
 if((Get-Business5244StartupHash $prior)-cne$Expected){throw 'READPAIR_ENTRY_CAS_CHANGED'}
 try{$Stream.Position=0;$Stream.SetLength($Bytes.Length);$Stream.Write($Bytes,0,$Bytes.Length);$Stream.Flush($true)
  if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $Stream))-cne(Get-Business5244StartupHash $Bytes)){throw 'READPAIR_ENTRY_FLUSH_UNCONFIRMED'}
 }catch{$failure=$_;$Stream.Position=0;$Stream.SetLength($prior.Length);$Stream.Write($prior,0,$prior.Length);$Stream.Flush($true);if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $Stream))-cne$Expected){throw 'READPAIR_HELD_INVERSE_UNCONFIRMED'};throw $failure}
}
function Invoke-ReadPairInstallSequence {
 # Finite operation, not a scriptblock/callback or arbitrary-target executor.
 # After a retire exchange is attempted it is NEVER resent, including after
 # timeout. Only fresh, independently checked state may settle the outcome.
 $stopped=$false;$issued=$false
 try{
  Open-ReadPairPublication
  Assert-ReadPairColdTarget
  $stopped=$true;Stop-ReadPairColdOwner
  Start-ReadPairPreparedOwner
  Assert-ReadPairPreparedOwner
  $issued=$true
  try{Send-ReadPairSingleRetire}catch{Record-Phase 'ACK_UNCONFIRMED_READONLY_RECONCILIATION'}
  $outcome=Wait-ReadPairFinalState
  if($outcome -cnotin @('CandidateVerified','RollbackVerified')){throw 'READPAIR_FINAL_STATE_UNKNOWN'}
  Complete-ReadPairPublication $outcome
  return $outcome
 }catch{
  if(!$issued){Restore-ReadPairBeforeRetire -OldStopped $stopped}
  # Never stop/replay/restore a possibly active paired API transition.
  else{Record-Phase 'OWNER_RECOVERY_REQUIRED_NO_SECOND_RETIRE'}
  throw
 }finally{Close-ReadPairPublication}
}
function Check-Bundle([string]$Root,[string]$Hash,[string]$Source){
 for($part=$Root;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'OWNER_BUNDLE_REPARSE_POINT'}}
 if((Get-FileHash -LiteralPath (Join-Path $Root 'owner-manifest.json')).Hash -ine $Hash){throw 'OWNER_MANIFEST_CHANGED'}
 $m=Get-Content -LiteralPath (Join-Path $Root 'owner-manifest.json') -Raw|ConvertFrom-Json
 if($m.kind -cne 'BUSINESS5244_FRESH_OWNER_BUNDLE' -or $m.sourceCommit -cne $Source -or $m.initialSlot -cne 'Current' -or $m.apiPackageId -cne 'CANONICAL-TEST125-BUSINESS5244-10cdc0ee' -or $m.actualT1 -ne $false -or $m.externalOperations -ne $false){throw 'OWNER_MANIFEST_IDENTITY'}
 foreach($f in $m.files){if($f.path -match '[\\/]' -or (Get-Item -LiteralPath (Join-Path $Root $f.path)).Attributes -band [IO.FileAttributes]::ReparsePoint -or (Get-FileHash -LiteralPath (Join-Path $Root $f.path)).Hash -ine $f.sha256){throw 'OWNER_SOURCE_CHANGED'}}
}
function Child-Sid($Proc){$sid=Invoke-CimMethod -InputObject $Proc -MethodName GetOwnerSid;if($sid.ReturnValue -ne 0){throw 'PROCESS_SID_UNAVAILABLE'};return $sid.Sid}
function Web-Resources($Status){
 $console=Join-Path $env:SystemRoot 'System32\conhost.exe';$esbuild=Join-Path $pins.root 'apps\sites-workflow\node_modules\@esbuild\win32-x64\esbuild.exe'
 $signature=Get-AuthenticodeSignature -LiteralPath $console
 if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -cne 'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'){throw 'WEB_CONSOLE_SIGNATURE_CHANGED'}
 $manifest=Get-Content -LiteralPath (Join-Path $pins.root 'release-manifest.json') -Raw|ConvertFrom-Json
 $esbuildRecord=@($manifest.files|Where-Object {$_.path.Replace('/','\') -ceq 'apps\sites-workflow\node_modules\@esbuild\win32-x64\esbuild.exe'})
 if($esbuildRecord.Count -ne 1 -or (Get-FileHash -LiteralPath $esbuild).Hash -ine $esbuildRecord[0].sha256){throw 'WEB_ESBUILD_CONTENT_CHANGED'}
 $pending=[Collections.Generic.Queue[object]]::new();$pending.Enqueue(@{pid=[int]$Status.ownerPid;depth=0});$rows=[Collections.Generic.List[object]]::new()
 $rows.Add([pscustomobject]@{pid=[int]$Status.ownerPid;birth=[string]$Status.ownerBirth;kind='owner';nativeBirth=$true})
 $rows.Add([pscustomobject]@{pid=[int]$Status.childPid;birth=[string]$Status.childBirth;kind='web';nativeBirth=$true})
 $foundNode=0
 while($pending.Count){$parent=$pending.Dequeue();$kids=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$parent.pid))
  foreach($p in $kids){
   if($parent.depth -ge 3 -or (Child-Sid $p) -cne [Business5244RetirementPeer]::CurrentSid){throw 'WEB_RESOURCE_SCOPE_CHANGED'}
   if($p.ProcessId -eq $Status.childPid -and $p.ParentProcessId -eq $Status.ownerPid){$foundNode++;$pending.Enqueue(@{pid=$p.ProcessId;depth=1});continue}
   if(Same-ErpPath $p.ExecutablePath $console){
    $expected='\??\'+$p.ExecutablePath+' 0x4';if($p.CommandLine -ine $expected -or $p.ParentProcessId -notin @([int]$Status.ownerPid,[int]$Status.childPid)){throw 'WEB_CONSOLE_SCOPE_CHANGED'};$kind='signed-console'
   }elseif((Same-ErpPath $p.ExecutablePath $esbuild) -and $p.ParentProcessId -eq $Status.childPid){
    if($p.CommandLine -cne ($esbuild+' --service=0.27.7 --ping')){throw 'WEB_ESBUILD_ARGV_CHANGED'};$kind='pinned-web-esbuild'
   }else{throw 'WEB_RESOURCE_SCOPE_CHANGED'}
   if(@(Get-NetTCPConnection -State Listen -OwningProcess $p.ProcessId -ErrorAction SilentlyContinue).Count){throw 'WEB_AUXILIARY_LISTENER'}
   $rows.Add([pscustomobject]@{pid=$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToFileTimeUtc().ToString();kind=$kind;nativeBirth=$false});$pending.Enqueue(@{pid=$p.ProcessId;depth=($parent.depth+1)})
  }
 }
 if($foundNode -ne 1){throw 'WEB_NODE_RESOURCE_CHANGED'}
 return @($rows|Sort-Object pid)
}
function Wait-ResourceExit($Resources){
 $deadline=[DateTime]::UtcNow.AddSeconds(15)
 do{$remaining=@($Resources|Where-Object {$proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$_.pid);$proc -and [Business5244WebNative]::MatchesCimBirth([long]$_.birth,$proc.CreationDate.ToUniversalTime().ToFileTimeUtc())});if(!$remaining.Count){return $true};Start-Sleep -Milliseconds 250}while([DateTime]::UtcNow -lt $deadline)
 return $false
}
function Owner-Status {
 $connection=Connect-Business5244RetirementPeer
 $status=Send-Business5244RetirementRequest -Connection $connection -Operation status
 if(!$status.nativePeerVerified -or $status.reply -cne 'Status' -or $status.state.phase -cne 'Running'){throw 'WEB_OWNER_NOT_RUNNING'}
 return $status.state
}
function Assert-OldTarget($Status){
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$Status.ownerPid);$child=Get-CimInstance Win32_Process -Filter ('ProcessId='+$Status.childPid)
 if(!$p -or !$child -or !(Same-ErpPath $p.ExecutablePath $ps) -or $child.ParentProcessId -ne $p.ProcessId -or !(Same-ErpPath $child.ExecutablePath $pins.node) -or (Child-Sid $p) -cne [Business5244RetirementPeer]::CurrentSid -or (Child-Sid $child) -cne [Business5244RetirementPeer]::CurrentSid){throw 'WEB_OWNER_TARGET_CHANGED'}
 if(![Business5244WebNative]::MatchesCimBirth([long]$Status.ownerBirth,$p.CreationDate.ToUniversalTime().ToFileTimeUtc()) -or ![Business5244WebNative]::MatchesCimBirth([long]$Status.childBirth,$child.CreationDate.ToUniversalTime().ToFileTimeUtc())){throw 'WEB_OWNER_BIRTH_CHANGED'}
 $argsText=[regex]::Replace([string]$p.CommandLine,('^"?'+[regex]::Escape($p.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  $expected=Get-B6ReadPairOwnerArguments $oldRoot $oldHash
  if($oldRoot-ceq$b6.owner.entry.root){
   if($Status.ownerPid-ne$b6.owner.owner.pid-or$Status.ownerBirth-cne$b6.owner.owner.birth-or$Status.childPid-ne$b6.owner.child.pid-or$Status.childBirth-cne$b6.owner.child.birth-or(Child-Sid $p)-cne$b6.owner.owner.sid-or(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes([string]$p.CommandLine)))-cne$b6.owner.owner.argvSha256){throw 'B6_CURRENT_OWNER_CAPTURE_CHANGED'}
  }
 }else{
  $entryName=if($oldRoot -ceq $newRoot){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'}
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$oldRoot+'\'+$entryName+' -ManifestSha256 '+$oldHash.ToUpperInvariant()
 }
 # Windows Start-Process serializes one optional terminal ASCII space for
 # this exact fixed argv. Do not Trim or accept extra arguments/whitespace.
 if(!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'FROZEN_OWNER_ARGV_CHANGED'}
 $actual=@{parent=$child.ParentProcessId;exe=$child.ExecutablePath;sid=(Child-Sid $child);command=$child.CommandLine}
 # Same exact Vite/Node argument contract as a fresh child; actual parent is
 # the authenticated source-pinned owner, rather than this maintenance caller.
 $entry=Join-Path $pins.root 'apps\sites-workflow\node_modules\vite\bin\vite.js'
 if($actual.command -cne ('"'+$pins.node+'" "'+$entry+'" preview --host 127.0.0.1 --port 5244 --strictPort')){throw 'WEB_CHILD_ARGV_CHANGED'}
 $all=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 $rows=@($all|Where-Object {$_.OwningProcess -eq $p.ProcessId -or $_.OwningProcess -eq $child.ProcessId -or $_.LocalPort -eq 5244})
 Assert-Business5244OwnedListeners $rows $child.ProcessId
}
function Start-Frozen([string]$Root,[string]$Hash,[string]$Label){
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){$script:b6InitializationExitProcess=$null}
 $logPrefix=if($AfterLoaderRecovery){'read2b-install-after-loader-recovery-'}else{'read2b-install-'}
 $stdout=Join-Path $base ($logPrefix+$Label+'.stdout.log');$stderr=Join-Path $base ($logPrefix+$Label+'.stderr.log')
 if((Test-Path $stdout) -or (Test-Path $stderr)){throw 'WEB_START_LOG_ALREADY_EXISTS'}
 $saved=@{};foreach($entry in Get-ChildItem Env:){$saved[$entry.Name]=$entry.Value}
 try{
  foreach($name in @($saved.Keys)){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
  foreach($name in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if($saved.ContainsKey($name)){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
  $argv=@('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',(Join-Path $Root $(if($Label -ceq 'candidate'){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'})),'-ManifestSha256',$Hash.ToUpperInvariant())
  if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
   [void](Get-B6ReadPairOwnerArguments $Root $Hash)
   if($Label-ceq'candidate'){$argv+=@('-ScopeName',$ScopeName)}
  }
  $script:newHost=Microsoft.PowerShell.Management\Start-Process -FilePath $ps -ArgumentList $argv -WindowStyle Hidden -WorkingDirectory $Root -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
   # Retain the real kernel process handle from this exact source-bound spawn.
   # Later ExitCode readback must not reopen/adopt a recycled numeric PID.
   if(!($script:newHost-is[Diagnostics.Process])-or$script:newHost.Handle-eq[IntPtr]::Zero){throw 'B6_OWNER_KERNEL_HANDLE_REQUIRED'}
  }
 }finally{foreach($entry in Get-ChildItem Env:){[Environment]::SetEnvironmentVariable($entry.Name,$null,'Process')};foreach($entry in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($entry.Key,$entry.Value,'Process')};$saved.Clear()}
 $result.startCalls++;$birth=$script:newHost.StartTime.ToUniversalTime().ToFileTimeUtc().ToString();$result.newOwnerPid=$script:newHost.Id;$result.newOwnerBirth=$birth;Record-Phase ('STARTING_'+$Label)
 $deadline=[DateTime]::UtcNow.AddSeconds(900)
 do{
  if($script:newHost.HasExited){
   if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and$Label-ceq'candidate'-and$Root-ceq$b6.routerRoot-and$Hash-ceq$b6.routerHash-and$script:newHost.ExitCode-eq73){
    $script:b6InitializationExitProcess=$script:newHost
    throw 'B6_NEW_OWNER_INITIALIZATION_CLEANUP_VERIFIED'
   }
   throw 'NEW_WEB_OWNER_EXITED_BEFORE_READY'
  }
  $lines=@(Get-Content -LiteralPath $stdout -ErrorAction SilentlyContinue)
  if($lines.Count){$ready=$lines|Where-Object {$_ -like '*business-5244-owned-start*'}|Select-Object -First 1;if($ready){$ready=$ready|ConvertFrom-Json;if($ready.ownerPid -ne $script:newHost.Id -or $ready.ownerBirth -cne $birth -or $ready.package -cne $pins.package){throw 'NEW_WEB_OWNER_RECEIPT_CHANGED'};return $ready}}
  Start-Sleep -Milliseconds 500
 }while([DateTime]::UtcNow -lt $deadline)
 throw 'NEW_WEB_OWNER_READY_TIMEOUT'
}

function Assert-ReadPairPath([string]$Path){
 for($part=$Path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Test-Path -LiteralPath $part)-and((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'READPAIR_REPARSE_POINT'}}
}
function Protection-Snapshot {
 $ports=@(4146,5194,4194,4196,5234,5235,5236,62400,62700,62701,62702,62703,62704,62800,62801,62802,62803)
 $listeners=@(Get-NetTCPConnection -State Listen|Where-Object {$_.LocalPort -in $ports}|Sort-Object LocalPort,LocalAddress,OwningProcess|Select-Object LocalPort,LocalAddress,OwningProcess)
 $processes=@($listeners.OwningProcess|Sort-Object -Unique|ForEach-Object {$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$_);if(!$p){throw 'READPAIR_PROTECTED_PROCESS_MISSING'};[ordered]@{pid=$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o');exe=$p.ExecutablePath}})
 $files=@('C:\Sirket\ERP\clean\20261022\runtime\start-crm.ps1','C:\Sirket\ERP\clean\20261022\runtime\crm-processes.json','C:\Sirket\ERP\config\TEST-20260929-01\runtime-private.json','C:\Sirket\ERP\melisa-erp-v2\scripts\canonical\start-owned-test.ps1')
 return [ordered]@{listeners=$listeners;processes=$processes;files=@($files|ForEach-Object {@{path=$_;hash=(Get-FileHash -LiteralPath $_).Hash}})}
}
function Assert-ReadPairProtection {
 if((Get-ReadPairProtectionSignature (Protection-Snapshot))-cne(Get-ReadPairProtectionSignature $before)){throw 'READPAIR_PROTECTION_CHANGED'}
}
function Get-ReadPairExpectedProjection {
 param([byte[]]$StartupBytes,[byte[]]$ApiBytes,[string]$BaseProfileSha256,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',$NativeProfileAdmission=$null)
 # Pure hash projection only. Supplied bytes are never written or authority.
 $pairScope=if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){Get-Test125ReadPairScope}else{Get-Test125ReadPairScope -Name $ScopeName};$path='C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $config=[Text.Encoding]::UTF8.GetString($StartupBytes)|ConvertFrom-Json
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){[void](Assert-Test125ReadPairConfig $config Current)}else{[void](Assert-Test125ReadPairConfig $config Current -ScopeName $ScopeName)}
 if($BaseProfileSha256-cnotmatch'^[a-f0-9]{64}$'){throw 'READPAIR_EXPECTED_BASE_HASH_CHANGED'}
 $nextApi=[Text.Encoding]::UTF8.GetString($ApiBytes)|ConvertFrom-Json
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  [void](Assert-ErpBusinessSaleNativeProfileAdmission $NativeProfileAdmission -Phase Prepared)
  $native=Get-ErpBusinessSaleNativeAdmissionContext $NativeProfileAdmission
  if($native.profileBeforeHash-cne(Get-Business5244StartupHash $ApiBytes)){throw 'B6_NATIVE_PROFILE_BEFORE_CHANGED'}
  [byte[]]$apiAfter=Get-ErpBusinessSaleCandidateProfileBytes $NativeProfileAdmission
  if(!$apiAfter-or!$apiAfter.Length){throw 'READPAIR_B6_CANDIDATE_PROFILE_REQUIRED'}
  $schema='melisa-test125-b6-api-transition.v1'
 }else{
  if($null-ne$NativeProfileAdmission){throw 'READPAIR_NATIVE_SCOPE_REJECTED'}
  if($nextApi.goal8SyntheticDaySeal.packageId-cne'CANONICAL-TEST125-BUSINESS5244-10cdc0ee'){throw 'READPAIR_OLD_PROFILE_SEAL_CHANGED'}
  $nextApi.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'
  $apiAfter=[Text.Encoding]::UTF8.GetBytes(($nextApi|ConvertTo-Json -Depth 100));$schema='melisa-test125-read2b-api-transition.v1'
 }
 $nextConfig=[Text.Encoding]::UTF8.GetString($StartupBytes)|ConvertFrom-Json
 $nextConfig.ApiComponent.ReleaseRoot=$pairScope.candidate.ReleaseRoot;$nextConfig.ApiComponent.ManifestSha256=$pairScope.candidate.ManifestSha256
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){[void](Assert-Test125ReadPairConfig $nextConfig Candidate)}else{[void](Assert-Test125ReadPairConfig $nextConfig Candidate -ScopeName $ScopeName)}
 $startupAfter=[Text.Encoding]::UTF8.GetBytes(($nextConfig|ConvertTo-Json -Depth 100))
 $releasePins=Get-ReadPairExpectedReleasePins $config $pairScope
 $shape=[pscustomobject][ordered]@{schema=$schema;packageProof=$releasePins;scope=$pairScope.name;source=$pairScope.source;database=$pairScope.database;current=$pairScope.current;candidate=$pairScope.candidate;apiProfileBeforeSha256=(Get-Business5244StartupHash $ApiBytes);apiProfileCandidateSha256=(Get-Business5244StartupHash $apiAfter);baseProfileSha256=$BaseProfileSha256;startupBeforeSha256=(Get-Business5244StartupHash $StartupBytes);startupCandidateSha256=(Get-Business5244StartupHash $startupAfter);apiPort=4144;preservedPorts=@(4146,5194);runtimeApplied=$false}
 $contractHash=Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(($shape|ConvertTo-Json -Depth 12 -Compress)))
 $keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')
 # The frozen READ2b core predates the additive finite selector. Preserve its
 # original getters; only B6 uses the new shared source selector.
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){$new=Get-Business5244ReadPairPins;$old=Get-Business5244WebPins}else{$new=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Candidate;$old=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current}
 $identity='business-5244-read-pair.v1|'+$contractHash+'|'+(($keys|ForEach-Object {$new[$_]})-join'|')+'|'+(($keys|ForEach-Object {$old[$_]})-join'|')
 return @{planHash=(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity)));baseHash=$BaseProfileSha256;startupPath=$path;apiPath=$pairScope.current.ConfigPath;basePath=$config.ConfigPath;Current=@{startup=$shape.startupBeforeSha256;api=$shape.apiProfileBeforeSha256};Candidate=@{startup=$shape.startupCandidateSha256;api=$shape.apiProfileCandidateSha256}}
}
function Get-ReadPairExpectedHashes {
 param([ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',$NativeProfileAdmission=$null)
 $pairScope=if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){Get-Test125ReadPairScope}else{Get-Test125ReadPairScope -Name $ScopeName};$path='C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){[void](Assert-ErpBusinessSaleNativeProfileAdmission $NativeProfileAdmission -Phase Prepared)}elseif($null-ne$NativeProfileAdmission){throw 'READPAIR_NATIVE_SCOPE_REJECTED'}
 $startup=[IO.File]::ReadAllBytes($path);$config=[Text.Encoding]::UTF8.GetString($startup)|ConvertFrom-Json
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){[void](Assert-Test125ReadPairConfig $config Current)}else{[void](Assert-Test125ReadPairConfig $config Current -ScopeName $ScopeName)}
 $api=[IO.File]::ReadAllBytes($pairScope.current.ConfigPath);$baseHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($config.ConfigPath))
 return Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 $baseHash -ScopeName $ScopeName -NativeProfileAdmission $NativeProfileAdmission
}
function Get-ReadPairExpectedReleasePins($Config,$Scope){
 # Deterministic public pins only; no opaque token, registry id or capability.
 if($Config.ReleaseRoot-cne'C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778'-or$Config.ManifestSha256-cne'0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64'){throw 'READPAIR_EXPECTED_BASE_RELEASE_CHANGED'}
 return [pscustomobject][ordered]@{policy='test125-package-file-identity.v2';baseRoot=$Config.ReleaseRoot;baseManifest=$Config.ManifestSha256;currentApiRoot=$Scope.current.ReleaseRoot;currentApiManifest=$Scope.current.ManifestSha256;candidateApiRoot=$Scope.candidate.ReleaseRoot;candidateApiManifest=$Scope.candidate.ManifestSha256;node=$Config.NodePath;nodeSha256=$Config.NodeSha256;source=$Config.SourceCommit;database=$Config.ExpectedDatabase}
}
function Get-ReadPairControllerHash([byte[]]$Bytes){$sha=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Get-B6ReadPairOwnerArguments([string]$Root,[string]$Hash){
 $kind=$b6.owner.predecessorEntryKind
 if($kind-ceq'CurrentCore'){
  if($b6.owner.entry.leaf-cne'run-current-owner.ps1'-or$b6.owner.entry.root-cne$b6.owner.core.root-or$b6.owner.entry.manifestSha256-cne$b6.owner.core.manifestSha256){throw 'B6_CURRENT_ENTRY_KIND_REJECTED'}
 }elseif($kind-ceq'ReadPairRouter'){
  if($b6.owner.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$b6.owner.entry.root-cne$b6.owner.router.root-or$b6.owner.entry.manifestSha256-cne$b6.owner.router.manifestSha256){throw 'B6_CURRENT_ENTRY_KIND_REJECTED'}
 }else{throw 'B6_CURRENT_ENTRY_KIND_REJECTED'}
 if($Root-ceq$b6.owner.entry.root-and$Hash-ceq$b6.owner.entry.manifestSha256){$leaf=$b6.owner.entry.leaf;$suffix=if($kind-ceq'ReadPairRouter'){' -ScopeName TEST125-API-B6-ca620bac-20261028'}else{''}}
 elseif($Root-ceq$b6.routerRoot-and$Hash-ceq$b6.routerHash){$leaf='start-business-5244-readpair-router.ps1';$suffix=' -ScopeName TEST125-API-B6-ca620bac-20261028'}
 elseif($Root-ceq$b6.coreRoot-and$Hash-ceq$b6.coreHash){$leaf='run-current-owner.ps1';$suffix=''}
 else{throw 'B6_OWNER_ARGV_SCOPE_REJECTED'}
 return '-NoProfile -NonInteractive -WindowStyle Hidden -File '+$Root+'\'+$leaf+' -ManifestSha256 '+$Hash.ToUpperInvariant()+$suffix
}
function Hold-B6ReadPairSource([string]$Path,[string]$Hash){
 Assert-ReadPairPath $Path
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{if((Get-ReadPairControllerHash (Read-ReadPairHeldBytes $stream))-cne$Hash.ToLowerInvariant()){throw 'B6_CONTROLLER_SOURCE_CHANGED'};$script:b6SourceHandles.Add($stream)}catch{$stream.Dispose();throw}
}
function Hold-B6ReadPairEntry([string]$Path,[string]$Hash){
 Assert-ReadPairPath $Path
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
 try{
  $bytes=Read-ReadPairHeldBytes $stream
  if((Get-Business5244StartupHash $bytes)-cne$Hash){throw 'B6_ENTRY_BEFORE_CHANGED'}
  $held.Add(@{stream=$stream;path=$Path;before=$bytes;beforeHash=$Hash;afterHash=$Hash;after=$bytes;written=$false;holdMode='Exclusive'})
 }catch{$stream.Dispose();throw}
}
function Get-B6ReadPairActiveEntry {
 if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'){return $null}
 if(!$b6.owner.PSObject.Properties['predecessorEntryKind']){return $null}
 $entry=$b6.owner.entry;$kind=$b6.owner.predecessorEntryKind
 if($entry.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_ACTIVE_ENTRY_DESCRIPTOR_REJECTED'}
 if($kind-ceq'CurrentCore'){
  if($entry.root-cne$b6.owner.core.root-or$entry.leaf-cne'run-current-owner.ps1'-or$entry.manifestSha256-ine$b6.owner.core.manifestSha256){throw 'B6_ACTIVE_ENTRY_DESCRIPTOR_REJECTED'}
  $expected=@(@{path=(Join-Path $entry.root 'run-current-owner.ps1');hash=$entry.sha256})
 }elseif($kind-ceq'ReadPairRouter'){
  if($entry.root-cne$b6.owner.router.root-or$entry.root-ceq$b6.owner.core.root-or$entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$entry.manifestSha256-ine$b6.owner.router.manifestSha256-or$entry.sha256-cne$b6.owner.router.entrySha256){throw 'B6_ACTIVE_ENTRY_DESCRIPTOR_REJECTED'}
  $coreRows=@($b6.owner.core.files|Where-Object{$_.path-ceq'run-current-owner.ps1'})
  if($coreRows.Count-ne1-or$coreRows[0].sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_ACTIVE_CORE_ENTRY_REJECTED'}
  $expected=@(@{path=(Join-Path $entry.root 'start-business-5244-readpair-router.ps1');hash=$entry.sha256},@{path=(Join-Path $b6.owner.core.root 'run-current-owner.ps1');hash=$coreRows[0].sha256})
 }else{throw 'B6_ACTIVE_ENTRY_DESCRIPTOR_REJECTED'}
 foreach($item in $expected){$rows=@($b6.entryCapture.directEntries|Where-Object{$_.path-ceq$item.path});if($rows.Count-ne1-or$rows[0].sha256-cne$item.hash){throw 'B6_ACTIVE_ENTRY_CAPTURE_CHANGED'}}
 return $expected
}
function Get-B6ReadPairActiveHandoff {
 $h=if(Get-Variable ReadPairActiveHandoff -Scope Script -ErrorAction SilentlyContinue){$script:ReadPairActiveHandoff}else{$null}
 if(!$h){return $null}
 if($h.process-ne$PID-or$h.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or!($control-is[Business5244RetirementPeer+ControlledShutdown])-or![object]::ReferenceEquals($h.control,$control)-or$control.TargetPid-ne$h.ownerPid-or$control.TargetBirth-cne$h.ownerBirth){throw 'B6_ACTIVE_ENTRY_HANDOFF_NOT_OWNED'}
 $entries=@(Get-B6ReadPairActiveEntry)
 if(@($h.items).Count-ne$entries.Count-or![object]::ReferenceEquals($h.item,$h.items[0])){throw 'B6_ACTIVE_ENTRY_HANDOFF_NOT_OWNED'}
 foreach($entry in $entries){$items=@($h.items|Where-Object{$_.path-ceq$entry.path});if($items.Count-ne1-or$items[0].beforeHash-cne$entry.hash-or@($held|Where-Object{[object]::ReferenceEquals($_,$items[0])}).Count-ne1){throw 'B6_ACTIVE_ENTRY_HANDOFF_NOT_OWNED'}}
 return $h
}
function Assert-B6ReadPairEntrySet([switch]$AllowActiveShared){
 $h=Get-B6ReadPairActiveHandoff;$all=@($b6.entryCapture.entries)+@($b6.entryCapture.directEntries)
 if(!$h-or$held.Count-ne$all.Count){throw 'B6_ENTRY_SET_NOT_EXCLUSIVELY_HELD'}
 foreach($row in $all){$items=@($held|Where-Object{$_.path-ceq$row.path});if($items.Count-ne1){throw 'B6_ENTRY_SET_NOT_EXCLUSIVELY_HELD'};$item=$items[0];$hash=if($row.PSObject.Properties['beforeSha256']){$row.beforeSha256}else{$row.sha256}
  $shared=$AllowActiveShared-and@($h.items|Where-Object{[object]::ReferenceEquals($_,$item)}).Count-eq1-and$item.holdMode-ceq'Shared'
  if((!$shared-and$item.holdMode-cne'Exclusive')-or!($item.stream-is[IO.FileStream])-or!$item.stream.CanRead-or$item.stream.CanWrite-or$item.stream.SafeFileHandle.IsClosed-or$item.beforeHash-cne$hash-or$item.afterHash-cne$hash-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream))-cne$hash){throw 'B6_ENTRY_SET_NOT_EXCLUSIVELY_HELD'}
 }
}
function Assert-B6ReadPairNoForeignEntryLaunch {
 $paths=@($held|ForEach-Object{$_.path})
 $foreign=@(Get-CimInstance Win32_Process|Where-Object{$command=$_.CommandLine;$_.ProcessId-ne$PID-and$command-and@($paths|Where-Object{$command.IndexOf($_,[StringComparison]::OrdinalIgnoreCase)-ge0}).Count})
 if($foreign.Count){throw 'B6_FOREIGN_ENTRY_LAUNCH_DETECTED'}
}
function Hold-B6ReadPairActiveEntry {
 $entries=@(Get-B6ReadPairActiveEntry|Where-Object{$null-ne$_});if(!$entries.Count){return}
 if(Get-B6ReadPairActiveHandoff){throw 'B6_ACTIVE_ENTRY_ALREADY_HELD'}
 if(!($control-is[Business5244RetirementPeer+ControlledShutdown])-or!$control.GetType().GetMethod('ValidateCompletedStop')-or!$control.GetType().GetProperty('CompletedStop')){throw 'B6_CONTROL_GENERATION_RESTART_REQUIRED'}
 $control.Validate();Assert-OldTarget $status
 if($oldRoot-cne$b6.owner.entry.root-or$oldHash-ine$b6.owner.entry.manifestSha256){throw 'B6_ACTIVE_ENTRY_PRESTOP_GENERATION_CHANGED'}
 if($control.TargetPid-ne$status.ownerPid-or$control.TargetBirth-cne$status.ownerBirth){throw 'B6_ACTIVE_ENTRY_OWNER_CHANGED'}
 $items=[Collections.Generic.List[object]]::new()
 try{
  foreach($entry in $entries){
   if(@($held|Where-Object{$_.path-ceq$entry.path}).Count){throw 'B6_ACTIVE_ENTRY_OWNER_CHANGED'}
   Assert-ReadPairPath $entry.path;$stream=[IO.File]::Open($entry.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
   try{$bytes=Read-ReadPairHeldBytes $stream;if((Get-Business5244StartupHash $bytes)-cne$entry.hash){throw 'B6_ACTIVE_ENTRY_BEFORE_CHANGED'}
    $item=@{stream=$stream;path=$entry.path;before=$bytes;beforeHash=$entry.hash;afterHash=$entry.hash;after=$bytes;written=$false;holdMode='Shared'};$held.Add($item);$items.Add($item)
   }catch{$stream.Dispose();throw}
  }
  $script:ReadPairActiveHandoff=@{process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;control=$control;ownerPid=$control.TargetPid;ownerBirth=$control.TargetBirth;item=$items[0];items=$items;phase='MarkerPending';lease=$null;marker=$null;stopAttempted=$false;upgradeAttempted=$false}
  Assert-B6ReadPairEntrySet -AllowActiveShared
  $pending=Get-Business5244RetirementPendingPath;Assert-ReadPairPath $pending
  if(Test-Path -LiteralPath $pending){throw 'B6_ACTIVE_ENTRY_FOREIGN_PENDING_MARKER'}
  $bytes=[Text.Encoding]::UTF8.GetBytes(([ordered]@{schema='business-5244-cold-handoff.pending.v1';controllerPid=$PID;controllerBirth=[Business5244RetirementPeer]::CurrentBirth;ownerPid=$control.TargetPid;ownerBirth=$control.TargetBirth;entries=@($entries|ForEach-Object{@{path=$_.path;sha256=$_.hash}});operationId=[guid]::NewGuid().ToString('N')}|ConvertTo-Json -Depth 5 -Compress))
  $script:ReadPairActiveHandoff.marker=$control.CreateMaintenanceMarker($bytes)
  $script:ReadPairActiveHandoff.marker.Validate();$script:ReadPairActiveHandoff.phase='Shared'
 }catch{if(!(Get-Variable ReadPairActiveHandoff -Scope Script -ErrorAction SilentlyContinue)){foreach($item in $items){$item.stream.Dispose();[void]$held.Remove($item)}};throw}
}
function Complete-B6ReadPairActiveEntryHandoff {
 $h=Get-B6ReadPairActiveHandoff;if(!$h){if(Get-B6ReadPairActiveEntry){throw 'B6_ACTIVE_ENTRY_HANDOFF_MISSING'};return}
 if($h.phase-cne'Shared'-or$h.upgradeAttempted){throw 'B6_ACTIVE_ENTRY_HANDOFF_ALREADY_ATTEMPTED'}
 $control.ValidateCompletedStop();$h.marker.Validate();Assert-B6ReadPairEntrySet -AllowActiveShared
 if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'B6_ACTIVE_ENTRY_RESOURCES_NOT_EXITED'}
 try{
  $h.lease=Enter-Business5244StartupLease -Kind Maintenance
  $control.ValidateCompletedStop();$h.marker.Validate();Assert-Business5244StartupLease $h.lease -Kind Maintenance;Assert-B6ReadPairNoForeignEntryLaunch
  $h.upgradeAttempted=$true
  foreach($item in $h.items){
   $control.ValidateCompletedStop();$h.marker.Validate();Assert-Business5244StartupLease $h.lease -Kind Maintenance
   $item.stream.Dispose();$item.holdMode='ClosedForUpgrade'
   Assert-ReadPairPath $item.path;$exclusive=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
   $item.stream=$exclusive;$item.holdMode='Exclusive'
   if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $exclusive))-cne$item.beforeHash){throw 'B6_ACTIVE_ENTRY_UPGRADE_CAS_CHANGED'}
  }
  $control.ValidateCompletedStop();Assert-B6ReadPairEntrySet;Assert-B6ReadPairNoForeignEntryLaunch
  if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'B6_ACTIVE_ENTRY_RESOURCES_CHANGED'}
  $h.marker.Validate();Exit-Business5244StartupLease $h.lease;$h.lease=$null
  $h.marker.DeleteForCompletedStop();$h.phase='ExclusiveVerified'
 }catch{
  $h.phase=if(@($h.items|Where-Object{$_.holdMode-cne'Exclusive'}).Count){'FailedShared'}else{'FailedExclusive'}
  foreach($item in @($h.items|Where-Object{$_.holdMode-ceq'ClosedForUpgrade'})){
   try{$reader=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $reader))-cne$item.beforeHash){$reader.Dispose();throw 'B6_ACTIVE_ENTRY_SHARED_CAS_CHANGED'};$item.stream=$reader;$item.holdMode='Shared'}catch{$h.phase='Unknown';$item.holdMode='Unconfirmed'}
  }
  throw 'B6_ACTIVE_ENTRY_HANDOFF_RECOVERY_REQUIRED'
 }
}
function Assert-B6ReadPairEntryHandoffReady {
 $h=Get-B6ReadPairActiveHandoff;if(!$h){if(Get-B6ReadPairActiveEntry){throw 'B6_ACTIVE_ENTRY_HANDOFF_MISSING'};return}
 if($h.phase-cne'ExclusiveVerified'-or$h.lease-or!$h.marker.Deleted){throw 'B6_ACTIVE_ENTRY_HANDOFF_RECOVERY_REQUIRED'}
 $control.ValidateCompletedStop();Assert-B6ReadPairEntrySet
}
function Cancel-B6ReadPairActiveEntryHandoff {
 $h=Get-B6ReadPairActiveHandoff;if(!$h){return}
 if($h.phase-cne'Shared'-or$h.stopAttempted-or$h.upgradeAttempted-or$h.lease){throw 'B6_ACTIVE_ENTRY_HANDOFF_RECOVERY_REQUIRED'}
 $control.Validate();Assert-OldTarget $status;Assert-B6ReadPairEntrySet -AllowActiveShared;$h.marker.Validate()
 $h.marker.DeleteForUnattemptedStop();$h.phase='CancelledBeforeStop'
}
function Open-B6ReadPairPreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\sql-collation-recovered-20261029';$proof=Join-Path $private 'owner-preparation';$receiptPath=Join-Path $proof 'preparation-receipt.json'
 if(![IO.File]::Exists($receiptPath)){throw 'B6_OWNER_BUNDLE_NOT_PREPARED'}
 if(!$Apply){throw 'READPAIR_REVIEWED_SOURCE_AND_SEPARATE_API_APPROVAL_REQUIRED'}
 if($EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')){throw 'B6_FROZEN_CONTROLLER_ENTRY_REQUIRED'}
 if($ReviewedSourceHash-cnotmatch'^[a-fA-F0-9]{64}$'-or(Get-FileHash -LiteralPath $EntryPath).Hash-ine$ReviewedSourceHash){throw 'READPAIR_REVIEWED_SOURCE_AND_SEPARATE_API_APPROVAL_REQUIRED'}
 if($PSVersionTable.PSEdition-cne'Desktop'){throw 'READPAIR_WINDOWS_POWERSHELL_REQUIRED'}
 if($AfterLoaderRecovery){throw 'B6_OLD_LOADER_RECOVERY_NOT_ADMITTED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  # The verifier itself is a held committed blob, never mutable worktree code.
  # Its literal pin has no self-cycle: the producer reads installer Git bytes
  # only at preparation time; it embeds no installer/content hash in its source.
  $producer=Join-Path $proof 'verified-owner-producer.mjs'
  Hold-B6ReadPairSource $producer 'c2b5f3a4f0192b373cc430abb5207aa57710f8c1fe296051f46fef974b4a618b'
  $verifiedText=& $node $producer --verify
  if($LASTEXITCODE-ne0){throw 'B6_OWNER_SOURCE_VERIFICATION_FAILED'}
  $verified=$verifiedText|ConvertFrom-Json
  if($verified.schema-cne'melisa-b6-passive-owner-verification.v1'-or$verified.coreFiles-ne13-or$verified.beforeImages-ne6-or$verified.writes-ne0-or$verified.sqlCalls-ne0-or$verified.serviceCalls-ne0-or$verified.ownerCalls-ne0-or$verified.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()){throw 'B6_CONTROLLER_SOURCE_NOT_VERIFIED'}
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-SQLCOLLATION'
  Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $verified.coreManifestSha256
  Hold-B6ReadPairSource (Join-Path $router 'owner-manifest.json') $verified.routerManifestSha256
  $manifest=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json;$routerManifest=Get-Content -LiteralPath (Join-Path $router 'owner-manifest.json') -Raw|ConvertFrom-Json
  if($manifest.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$manifest.finiteScope-cne'TEST125-API-B6-ca620bac-20261028'-or$manifest.sourceCommit-cne$verified.ownerSourceCommit-or@($manifest.files).Count-ne13-or$routerManifest.coreManifestSha256-cne$verified.coreManifestSha256-or$routerManifest.coreRoot-cne$core){throw 'B6_CONTROLLER_CORE_IDENTITY_CHANGED'}
  foreach($file in $manifest.files){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
  foreach($file in $manifest.beforeImages){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
  Hold-B6ReadPairSource (Join-Path $router 'start-business-5244-readpair-router.ps1') $routerManifest.entrySha256
  Hold-B6ReadPairSource (Join-Path $router 'readpair-router-library.ps1') $routerManifest.routerLibrarySha256
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json;$entryCapture=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json
  if($owner.predecessorEntryKind-cne'ReadPairRouter'-or$owner.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE'-or$owner.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$owner.entry.manifestSha256-cne'ef941287977c2913a8c4ca43cfa002e19f006d6239b9059a5c734cd0db6174e2'-or$owner.entry.sha256-cne'e160fd137828a98f6b4faf814243159276a2707667885f4e321d2ed39abbf238'-or$owner.recordBeforeSha256-cne'20dc7ae37497b88ce7f38039d76481b4f1e0f4e07c503737ec193e85c4be5f1f'){throw 'B6_RECOVERED_CURRENT_ENTRY_CHANGED'}
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-ca620bac-20261028'
  $sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  if($self.ExecutablePath-ine$ps-or$sid.ReturnValue-ne0-or$sid.Sid-cne$owner.owner.sid-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  return [pscustomobject]@{coreRoot=$core;coreHash=$verified.coreManifestSha256;routerRoot=$router;routerHash=$verified.routerManifestSha256;sourceCommit=$verified.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entryCapture}
 }catch{foreach($stream in $script:b6SourceHandles){$stream.Dispose()};throw}
}
function Initialize-B6ReadPairControllerPreflight {
 # Constructor and immutable release proof are native issued in THIS process.
 # They are never serialized/transferred to the replacement owner. Its own
 # independent admission is still required before it publishes a nonce.
 $config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $script:b6NativeAdmission=New-ErpBusinessSaleNativeProfileAdmission $config
 [void](Assert-ErpBusinessSaleNativeProfileAdmission $script:b6NativeAdmission -Phase Prepared)
 $script:b6ReadProof=New-ErpReadPairPreparedReleaseProof $config -ScopeName 'TEST125-API-B6-ca620bac-20261028' -NativeProfileAdmission $script:b6NativeAdmission
 [void](Get-Test125BoundMaintenancePlan -RunId 'TEST125-API-B6-ca620bac-20261028' -ReadPairPreparation -ReadPairMode Current -PreparedReleaseProof $script:b6ReadProof)
 [void](Get-ReadPairExpectedHashes -ScopeName 'TEST125-API-B6-ca620bac-20261028' -NativeProfileAdmission $script:b6NativeAdmission)
}
function Open-B6ReadPairPublication {
 # READ2b entries already contain the accepted global gate. Hold current
 # bytes; B6 never rewrites a legacy entry or replays its old projection.
 $capture=$b6.entryCapture
 if($capture.schema-cne'melisa-b6-current-entry-hold-capture.v1'-or$capture.readOnly-ne$true-or$capture.executionAuthority-ne$false-or$capture.entries.Count-ne6-or$capture.directEntries.Count-ne8-or$capture.entryWrites-ne0-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.ownerCaptureSha256-cne'4eaa68d16be5260071f74ce7e41e33ce6adaa4c7097d661905968d4b5c1b9945'-or$capture.gate.path-cne'C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\business-5244-startup-exclusion-ec316a63.ps1'-or$capture.gate.sha256-cne'a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'){throw 'B6_ENTRY_HOLD_CAPTURE_CHANGED'}
 $paths=@('start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'|ForEach-Object {Join-Path $pins.runtime $_})+@('C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1')
 if(($capture.entries.path-join'|')-cne($paths-join'|')){throw 'B6_ENTRY_HOLD_SCOPE_CHANGED'}
 $direct=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-READ2B-ROUTER-b9416929-20261028\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-OWNER-b9416929-20261028\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261028\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261028\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029\run-current-owner.ps1',(Join-Path $b6.owner.router.root 'start-business-5244-readpair-router.ps1'),(Join-Path $b6.owner.core.root 'run-current-owner.ps1'))
 if(($capture.directEntries.path-join'|')-cne($direct-join'|')){throw 'B6_DIRECT_ENTRY_SCOPE_CHANGED'}
 $script:before=Protection-Snapshot;$result.before=$before
 $script:expected=Get-ReadPairExpectedHashes -ScopeName $ScopeName -NativeProfileAdmission $b6NativeAdmission;$result.expected=$expected
 foreach($row in @($capture.entries)+@($capture.directEntries)){
  $hash=if($row.PSObject.Properties['beforeSha256']){if($row.afterEqualsBefore-ne$true){throw 'B6_ENTRY_AFTER_CHANGED'};$row.beforeSha256}else{$row.sha256}
  $active=@(Get-B6ReadPairActiveEntry|Where-Object{$_.path-ceq$row.path})
  if($active.Count){if($active.Count-ne1-or$hash-cne$active[0].hash){throw 'B6_ACTIVE_ENTRY_CAPTURE_CHANGED'}}else{Hold-B6ReadPairEntry $row.path $hash}
 }
 Hold-B6ReadPairSource $capture.gate.path $capture.gate.sha256
 $active=@(Get-CimInstance Win32_Process|Where-Object {$command=$_.CommandLine;$_.ProcessId-ne$b6.owner.owner.pid-and$command-and@(@($paths)+@($direct)|Where-Object {$command.IndexOf($_,[StringComparison]::OrdinalIgnoreCase)-ge0}).Count})
 if($active.Count){throw 'B6_ENTRY_ALREADY_RUNNING'}
 $script:archives=@(Get-ChildItem -LiteralPath $pins.runtime -Filter '5244-retirement.pending.*.completed' -File|ForEach-Object FullName)
 Record-Phase 'B6_CURRENT_ENTRIES_HELD_UNCHANGED_NOT_RETIRED'
}
function Open-ReadPairPublication {
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){Open-B6ReadPairPublication;return}
 # First pin every source, then lock ALL six legacy entry files. While held,
 # Windows cannot read/start a legacy entry during the cold-owner mutex gap.
 # A pre-existing invocation is separately rejected after all locks are held.
 Check-Bundle $oldRoot $oldHash 'ec316a63b535544e53a566370b1614a1721f940c'
 foreach($f in @('owner-manifest.json','start-business-5244-readpair-router.ps1')){Assert-ReadPairPath (Join-Path $overlay $f)}
 if((Get-FileHash (Join-Path $overlay 'owner-manifest.json')).Hash -ine $newHash-or(Get-FileHash (Join-Path $overlay 'start-business-5244-readpair-router.ps1')).Hash -ine 'd5be558155303cba7e1b5f852ee35ae0974c343eb700c7b134a6e7b1932dc783'){throw 'READPAIR_OVERLAY_CHANGED'}
 $projectionPath=Join-Path $base 'read2b-entry-gate-projection-20261028.json'
 if((Get-FileHash -LiteralPath $projectionPath).Hash -cne '841C99F9EA5CF38F20747F2550A97306EA3F68215600FA2EC5F17675EE2322EE'){throw 'READPAIR_PROJECTION_CHANGED'}
 $projection=Get-Content -LiteralPath $projectionPath -Raw|ConvertFrom-Json
 if($projection.gateTarget -cne 'C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\business-5244-startup-exclusion-ec316a63.ps1'){throw 'READPAIR_HELPER_TARGET_CHANGED'}
 if($projection.entries.Count-ne6-or$projection.gateSha256-cne'a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'){throw 'READPAIR_PROJECTION_CHANGED'}
 $expectedPaths=@('start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'|ForEach-Object {Join-Path $pins.runtime $_})+@('C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1')
 if(($projection.entries.target-join'|')-cne($expectedPaths-join'|')){throw 'READPAIR_ENTRY_SCOPE_CHANGED'}
 $script:before=Protection-Snapshot;$result.before=$before
 $script:expected=Get-ReadPairExpectedHashes;$result.expected=$expected
 if($AfterLoaderRecovery){
  if((Get-ReadPairProtectionSignature $before)-cne(Get-ReadPairProtectionSignature $failedReceipt.before)){throw 'READPAIR_LOADER_RECOVERY_BASELINE_CHANGED'}
  Assert-ReadPairExpectedEqual $expected $failedReceipt.expected
 }
 $gate=[IO.File]::ReadAllBytes((Join-Path $oldRoot 'business-5244-startup-exclusion.ps1'));$d4=$null
 foreach($row in $projection.entries){
  Assert-ReadPairPath $row.target
  $handle=[IO.File]::Open($row.target,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $observed=Read-ReadPairHeldBytes $handle
  $item=@{stream=$handle;path=$row.target;before=$observed;beforeHash=$(if($AfterLoaderRecovery){$row.afterSha256}else{$row.beforeSha256});afterHash=$row.afterSha256;after=$null;written=$false};$held.Add($item)
  if((Get-Business5244StartupHash $observed)-cne$item.beforeHash){throw 'READPAIR_ENTRY_BASE_CHANGED'}
  $sourceBefore=if($AfterLoaderRecovery){[IO.File]::ReadAllBytes((Join-Path (Join-Path $base 'read2b-install-once') (([IO.Path]::GetFileName($row.target))+'.before')))}else{$observed}
  if((Get-Business5244StartupHash $sourceBefore)-cne$row.beforeSha256){throw 'READPAIR_ORIGINAL_BEFORE_IMAGE_CHANGED'}
  if($row.target-ceq$expectedPaths[-1]){
   $projected=Add-Business5244StarterWebGate -SourceBytes $sourceBefore -ExpectedSha256 $row.beforeSha256 -GatePath $projection.gateTarget -GateSha256 $projection.gateSha256
   $text=[Text.Encoding]::UTF8.GetString($projected);$old='55CCE81E4B242E2EE82BBDE846D2FA83491027C9FE865EDBE444378FC52AB121'
   if(!$d4-or([regex]::Matches($text,$old)).Count-ne1){throw 'READPAIR_D4_LINK_CHANGED'};$projected=[Text.Encoding]::UTF8.GetBytes($text.Replace($old,$d4.ToUpperInvariant()))
  }else{$projected=Add-Business5244LegacyLauncherGate -SourceBytes $sourceBefore -ExpectedSha256 $row.beforeSha256 -GatePath $projection.gateTarget -GateSha256 $projection.gateSha256;if($row.target-ceq$expectedPaths[4]){$d4=Get-Business5244StartupHash $projected}}
  if((Get-Business5244StartupHash $projected)-cne$row.afterSha256){throw 'READPAIR_PROJECTION_HASH_CHANGED'};$item.after=$projected
  $image=Join-Path $proofDir (([IO.Path]::GetFileName($row.target))+'.before')
  $imageStream=[IO.File]::Open($image,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  try{$imageStream.Write($item.before,0,$item.before.Length);$imageStream.Flush($true);if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $imageStream))-cne$item.beforeHash){throw 'READPAIR_BEFORE_IMAGE_UNCONFIRMED'}}finally{$imageStream.Dispose()}
 }
 $active=@(Get-CimInstance Win32_Process|Where-Object {$c=$_.CommandLine;$c-and@($expectedPaths|Where-Object {$c.IndexOf($_,[StringComparison]::OrdinalIgnoreCase)-ge0}).Count})
 if($active.Count){throw 'READPAIR_LEGACY_ENTRY_ALREADY_RUNNING'}
 # All partial writes have held original bytes and an exact inverse. Before
 # truncate, mark attempted; recovery refuses any content other than our bytes.
 foreach($item in $held){if($item.beforeHash-cne$item.afterHash){$item.written=$true;Write-ReadPairHeldCas $item.stream $item.beforeHash $item.after}}
 foreach($file in @(@{path=$projection.gateTarget;bytes=$gate},@{path=(Join-Path $newRoot 'owner-manifest.json');bytes=[IO.File]::ReadAllBytes((Join-Path $overlay 'owner-manifest.json'))},@{path=(Join-Path $newRoot 'start-business-5244-readpair-router.ps1');bytes=[IO.File]::ReadAllBytes((Join-Path $overlay 'start-business-5244-readpair-router.ps1'))})){
  Assert-ReadPairPath $file.path
  if(!(Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($file.path)))){[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file.path))}
  if($AfterLoaderRecovery){
   $h=[IO.File]::Open($file.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
   if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $h))-cne(Get-Business5244StartupHash $file.bytes)){$h.Dispose();throw 'READPAIR_LOADER_AFTER_IMAGE_CHANGED'}
  }else{$h=Publish-ReadPairSealedFile $file.path $file.bytes}
  $created.Add(@{stream=$h;path=$file.path;hash=(Get-Business5244StartupHash $file.bytes);preexisting=[bool]$AfterLoaderRecovery})
 }
 $script:archives=@(Get-ChildItem -LiteralPath $pins.runtime -Filter '5244-retirement.pending.*.completed' -File|ForEach-Object FullName)
 Record-Phase 'ENTRIES_LOCKED_ROUTER_PUBLISHED_NOT_RETIRED'
}
function Assert-ReadPairColdTarget {
 $script:status=Owner-Status;Assert-OldTarget $status
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and(Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_CURRENT_RECORD_CHANGED_BEFORE_STOP'}
 if($AfterLoaderRecovery-and($status.ownerPid-ne$coldRecovery.newOwnerPid-or$status.ownerBirth-cne$coldRecovery.newOwnerBirth-or$status.childPid-ne$coldRecovery.childPid-or$status.childBirth-cne$coldRecovery.childBirth)){throw 'READPAIR_COLD_RECOVERY_GENERATION_CHANGED'}
 $script:oldResourceRows=@(Web-Resources $status);$script:webResources=$oldResourceRows
 $c=Connect-Business5244RetirementPeer
 try{if($c.serverPid-ne$status.ownerPid-or$c.serverBirth-cne$status.ownerBirth){throw 'READPAIR_OLD_PEER_CHANGED'};$r=Get-Business5244RetirementRecord $c -Client;$script:control=$r.peer.OpenControlledShutdown()}finally{Close-Business5244RetirementPeer $c}
 Assert-OldTarget $status
 if((Web-Resources $status|ConvertTo-Json -Depth 5 -Compress)-cne($oldResourceRows|ConvertTo-Json -Depth 5 -Compress)){throw 'READPAIR_OLD_RESOURCES_CHANGED'}
 Assert-ReadPairProtection;$control.Validate()
 Hold-B6ReadPairActiveEntry
}
function Stop-ReadPairColdOwner {
 if(Get-B6ReadPairActiveEntry){$handoff=Get-B6ReadPairActiveHandoff;if(!$handoff-or$handoff.phase-cne'Shared'){throw 'B6_ACTIVE_ENTRY_HANDOFF_MISSING'};$control.Validate();$handoff.marker.Validate();Assert-B6ReadPairEntrySet -AllowActiveShared;$handoff.stopAttempted=$true}
 $control.Stop();$result.stopCalls++
 if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'READPAIR_OLD_RESOURCES_NOT_EXITED'}
 Complete-B6ReadPairActiveEntryHandoff
 Record-Phase 'COLD_OWNER_EXITED'
}
function Start-ReadPairPreparedOwner {
 Assert-B6ReadPairEntryHandoffReady
 $script:ready=Start-Frozen $newRoot $newHash 'candidate'
 $script:newResourceRows=@(Web-Resources $ready)
}
function Assert-ReadPairPreparedOwner {
 $s=Owner-Status
 if($s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth-or$s.childPid-ne$ready.childPid-or$s.childBirth-cne$ready.childBirth){throw 'READPAIR_PREPARED_PEER_CHANGED'}
 Assert-ReadPairProtection
 if(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath)){throw 'READPAIR_PENDING_ALREADY_EXISTS'}
 $h=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $h $pins
 $fresh=if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){Get-ReadPairExpectedHashes -ScopeName $ScopeName -NativeProfileAdmission $b6NativeAdmission}else{Get-ReadPairExpectedHashes}
 Assert-ReadPairExpectedEqual $fresh $expected
}
function Send-ReadPairSingleRetire {
 $connection=Connect-Business5244RetirementPeer
 if($connection.serverPid-ne$newHost.Id-or$connection.serverBirth-cne$ready.ownerBirth){Close-Business5244RetirementPeer $connection;throw 'READPAIR_NEW_PEER_CHANGED'}
 $result.retireAttempts++;Record-Phase 'RETIRE_ATTEMPTED_NO_RESEND'
 Send-Business5244RetirementRequest $connection retire|Out-Null
}
function Wait-ReadPairFinalState {
 $deadline=[DateTime]::UtcNow.AddMinutes(15)
 do{
  if($newHost.HasExited){throw 'READPAIR_PREPARED_OWNER_EXITED'}
  try{
   $connection=Connect-Business5244RetirementPeer
   $observed=Send-Business5244RetirementRequest $connection status
   $s=Get-ReadPairFinalPeerState $observed $newHost.Id $ready.ownerBirth
   if($s.phase-cne'Running'){throw 'READPAIR_FINAL_STATE_NOT_TERMINAL'}
   $files=@(Select-ReadPairCommitArchives @(Get-ChildItem -LiteralPath $pins.runtime -Filter '5244-retirement.pending.*.completed' -File) $archives)
   if($files.Count-eq1-and!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){
    $lines=@([IO.File]::ReadAllLines($files[0].FullName)|Where-Object {$_});if($lines.Count-ne2){throw 'READPAIR_ARCHIVE_FORMAT'}
    $a=$lines[0]|ConvertFrom-Json;$c=$lines[1]|ConvertFrom-Json
    if($a.schema-cne'business-5244-retirement-before.v1'-or$c.schema-cne'business-5244-commit-prepared.v1'-or$c.operationId-cnotmatch'^[a-f0-9]{32}$'-or$a.operationId-cne$c.operationId-or$files[0].Name-cne('5244-retirement.pending.'+$c.operationId+'.completed')-or$c.ownerPid-ne$s.ownerPid-or$c.ownerBirth-cne$s.ownerBirth-or$a.ownerPid-ne$s.ownerPid-or$a.ownerBirth-cne$s.ownerBirth-or$a.childPid-ne$ready.childPid-or$a.childBirth-cne$ready.childBirth-or$c.childPid-ne$s.childPid-or$c.childBirth-cne$s.childBirth-or$c.mode-cnotin@('Candidate','Rollback')){throw 'READPAIR_ARCHIVE_IDENTITY'}
    $old=[Convert]::FromBase64String($a.beforeBase64);if((Get-Business5244StartupHash $old)-cne$a.beforeSha256){throw 'READPAIR_ARCHIVE_BEFORE_HASH'}
    $chosen=if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode $(if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'})}elseif($c.mode-ceq'Candidate'){Get-Business5244ReadPairPins}else{Get-Business5244WebPins}
    if($c.package-cne$chosen.package-or$c.manifest-cne$chosen.manifest-or$c.planHash-cne$expected.planHash){throw 'READPAIR_ARCHIVE_PAIR_CHANGED'}
    $record=[IO.File]::ReadAllBytes('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json')
    if((Get-Business5244StartupHash $record)-cne$c.recordsHash){throw 'READPAIR_RECORD_HASH_CHANGED'}
    Assert-Business5244RecordStage (ConvertFrom-Business5244RecordBytes $old) (ConvertFrom-Business5244RecordBytes $record) $s.childPid $c.mode $chosen
    if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){$config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json' -PreparedReleaseProof $b6ReadProof;[void](Assert-Test125ReadPairConfig $config $(if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}) -ScopeName $ScopeName)}else{$config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json';[void](Assert-Test125ReadPairConfig $config $(if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}))}
    $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $health $chosen
    $mode=if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}
    if((Get-FileHash -LiteralPath $expected.startupPath).Hash-ine$expected[$mode].startup-or(Get-FileHash -LiteralPath $expected.apiPath).Hash-ine$expected[$mode].api-or(Get-FileHash -LiteralPath $expected.basePath).Hash-ine$expected.baseHash){throw 'READPAIR_FINAL_PROFILE_OR_CONFIG_CHANGED'}
    $apiProof=if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){Get-Test125BoundMaintenancePlan -RunId $ScopeName -ReadPairPreparation -ReadPairMode $mode -PreparedReleaseProof $b6ReadProof}else{Get-Test125BoundMaintenancePlan -RunId (Get-Test125ReadPairScope).name -ReadPairPreparation -ReadPairMode $mode}
    if($apiProof.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'){throw 'READPAIR_FINAL_API_DATABASE_CHANGED'}
    # This is independent final-state readback, never a reconstructed owner
    # token or a claim that its private Dispatch.Completed state was observed.
    $script:pins=$chosen;$script:oldRoot=$newRoot;$script:oldHash=$newHash
    Assert-OldTarget $s
    $web=@(Web-Resources $s);$http=Invoke-WebRequest 'http://127.0.0.1:5244/ornek-akis.html' -Method Head -UseBasicParsing -TimeoutSec 10
    if($http.StatusCode-ne200){throw 'READPAIR_WEB_HTTP_FAILED'};Assert-ReadPairProtection
    $result.final=@{mode=$c.mode;ownerPid=$s.ownerPid;ownerBirth=$s.ownerBirth;childPid=$s.childPid;childBirth=$s.childBirth;archiveSha256=(Get-FileHash $files[0].FullName).Hash;planHash=$c.planHash;apiPackage=$health.packageId;webPackage=$chosen.package;webHttp=200;observation='READONLY_FINAL_STATE_NOT_PRIVATE_TOKEN'}
    return $(if($c.mode-ceq'Candidate'){'CandidateVerified'}else{'RollbackVerified'})
   }
  }catch{if($_.Exception.Message-cmatch'^READPAIR_(?:ARCHIVE|FINAL_PEER|FINAL_OWNER|RECORD|PROTECTION)'){throw}}
  Start-Sleep -Milliseconds 750
 }while([DateTime]::UtcNow-lt$deadline)
 throw 'READPAIR_RECONCILIATION_TIMEOUT_NO_REPLAY'
}
function Complete-ReadPairPublication([string]$Outcome){
 Assert-ReadPairProtection
 foreach($entry in $held){if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $entry.stream))-cne$entry.afterHash){throw 'READPAIR_ENTRY_AFTER_CHANGED'}}
 $result.outcome=$Outcome;Record-Phase $Outcome
}
function Assert-B6ReadPairRecoveryOwner {
 # A retained Process object alone cannot settle a channel/bootstrap Unknown.
 # No-ready or unauthenticated state requires review without a cleanup kill.
 if(!$ready-or!$newResourceRows.Count){throw 'B6_PRE_RETIRE_NATIVE_RECOVERY_REQUIRED'}
 $connection=Connect-Business5244RetirementPeer
 try{
  $observed=Send-Business5244RetirementRequest $connection status
  $s=Get-ReadPairFinalPeerState $observed $newHost.Id $ready.ownerBirth
  if($s.phase-cne'Running'-or$s.childPid-ne$ready.childPid-or$s.childBirth-cne$ready.childBirth){throw 'B6_PRE_RETIRE_NATIVE_RECOVERY_REQUIRED'}
  # Dynamic scope selects only the verified new router for this observation.
  $oldRoot=$b6.routerRoot;$oldHash=$b6.routerHash
  Assert-OldTarget $s
  if((Web-Resources $s|ConvertTo-Json -Depth 5 -Compress)-cne($newResourceRows|ConvertTo-Json -Depth 5 -Compress)){throw 'B6_PRE_RETIRE_NATIVE_RECOVERY_REQUIRED'}
 }finally{Close-Business5244RetirementPeer $connection}
}
function Assert-B6ReadPairCurrentRecoveryRecord($Status){
 $oldRoot=$b6.coreRoot;$oldHash=$b6.coreHash;Assert-OldTarget $Status
 $original=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes((Join-Path $b6.coreRoot 'current-erp-processes.before.json')))
 $current=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'))
 Assert-Business5244RecordStage $original $current $Status.childPid Candidate $pins
}
function Restore-ReadPairBeforeRetire([bool]$OldStopped){
 # Pre-retire only: no API/profile/config mutation was requested. If the
 # created owner is not provably closed, retain all gates for manual recovery.
 if(!$before){return}
 if(!$OldStopped){Cancel-B6ReadPairActiveEntryHandoff}
 if($OldStopped){Assert-B6ReadPairEntryHandoffReady}
 if($OldStopped){
  $verifiedInitializationExit=$false
  if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
   $verifiedInitializationExit=$newHost-is[Diagnostics.Process]-and[object]::ReferenceEquals($newHost,$script:b6InitializationExitProcess)-and$newHost.HasExited-and$newHost.ExitCode-eq73
  }
  if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'-and$newHost-and!$newHost.HasExited){
   Assert-B6ReadPairRecoveryOwner
   # Keep a healthy Current owner alive when it already owns a published
   # bootstrap. An external Process.Kill cannot perform its native inverse.
   if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_PRE_RETIRE_BOOTSTRAP_RECOVERY_REQUIRED'}
  }
  if($newHost-and!$newHost.HasExited){$newHost.Kill();[void]$newHost.WaitForExit(15000)}
  if($newHost-and(!$newResourceRows.Count-or!(Wait-ResourceExit $newResourceRows))-and!$verifiedInitializationExit){throw 'READPAIR_NEW_RESOURCES_RECOVERY_REQUIRED'}
  if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'READPAIR_RECOVERY_PORT_NOT_EMPTY'}
  if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
   # A published bootstrap is not raw before-image authority. Until the
   # native-owned bootstrap inverse is proved, leave uncertain metadata alone.
   if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_PRE_RETIRE_BOOTSTRAP_RECOVERY_REQUIRED'}
   Assert-ReadPairProtection
   $script:ready=Start-Frozen $b6.coreRoot $b6.coreHash 'rollback'
  }else{$script:ready=Start-Frozen $oldRoot $oldHash 'rollback'}
  $s=Owner-Status
  if($s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth-or$s.childPid-ne$ready.childPid-or$s.childBirth-cne$ready.childBirth){throw 'READPAIR_COLD_ROLLBACK_NOT_CONFIRMED'}
  if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
   Assert-B6ReadPairCurrentRecoveryRecord $s
  }
 }
 Assert-ReadPairProtection
 # Inspect EVERY held stream first, before undoing any entry or removing a
 # helper. A partial/inverse failure is recovery-required, never skipped.
 foreach($item in $held){$hash=Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream);if($hash-cne$item.beforeHash-and$hash-cne$item.afterHash){throw 'READPAIR_HELD_ENTRY_RECOVERY_REQUIRED'}}
 foreach($item in $held){$hash=Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream);if($item.beforeHash-cne$item.afterHash-and$hash-ceq$item.afterHash){Write-ReadPairHeldCas $item.stream $item.afterHash $item.before};$item.written=$false}
 # New exact helper/router files are inert before retire; do not remove foreign
 # files, directories, packages, records or any prior evidence.
 foreach($item in $created){if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream))-cne$item.hash){throw 'READPAIR_CREATED_FILE_CHANGED'};$item.stream.Dispose();if(!$item.preexisting){[IO.File]::Delete($item.path)}}
 Record-Phase 'PRE_RETIRE_INVERSE_VERIFIED'
}
function Close-ReadPairPublication {
 $active=Get-B6ReadPairActiveHandoff
 if($active-and$active.phase-cnotin@('ExclusiveVerified','CancelledBeforeStop')){throw 'B6_ACTIVE_ENTRY_HANDOFF_GATES_RETAINED'}
 foreach($item in $held){$item.stream.Dispose()};foreach($item in $created){$item.stream.Dispose()};if($control){$control.Dispose()}
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  if($b6ReadProof){Close-ErpReadPairReleaseProof $b6ReadProof;$script:b6ReadProof=$null}
  foreach($stream in $script:b6SourceHandles){$stream.Dispose()}
 }
}
if($Library){return}
if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
 if($PSVersionTable.PSEdition-cne'Desktop'){throw 'READPAIR_WINDOWS_POWERSHELL_REQUIRED'}
 foreach($builtinName in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets','NetTCPIP','ScheduledTasks')){
  $builtinManifest=[IO.Path]::Combine($PSHOME,'Modules',$builtinName,($builtinName+'.psd1'))
  Microsoft.PowerShell.Core\Import-Module -Name $builtinManifest -Scope Local -ErrorAction Stop
 }
 $b6ReadProof=$null;$b6NativeAdmission=$null;$b6InitializationExitProcess=$null;$b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 $b6=Open-B6ReadPairPreparedSource $SourceSha256 $PSCommandPath
 try{
  # All executable bytes came from the committed, hosted-CI verified bundle
  # and remain held against replacement while the existing sequence runs.
  . (Join-Path $b6.coreRoot 'start-business-5244-owned.ps1') -Library -OwnerScopeName 'TEST125-API-B6-ca620bac-20261028'
  . (Join-Path $b6.coreRoot 'start-owned-test.ps1') -Library
  . (Join-Path $b6.coreRoot 'test125-bound-api-quiescence.ps1')
  Initialize-Business5244WebNative;Initialize-Business5244RetirementPeer
  $pins=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current
  $base=$b6.proof;$oldRoot=$b6.owner.entry.root;$oldHash=$b6.owner.entry.manifestSha256;$newRoot=$b6.routerRoot;$newHash=$b6.routerHash
  $ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';$failedReceipt=$null;$coldRecovery=$null
  Initialize-B6ReadPairControllerPreflight
  # This is the first write. SQL/TLS, native Windows components, both package
  # identities and existing scheduler identity were checked before cold STOP.
  $proofDir=Join-Path $base 'install-once';if(Test-Path -LiteralPath $proofDir){throw 'READPAIR_USE_EXISTING_RECEIPT_NO_RERUN'}
  Assert-ReadPairPath $proofDir;[void][IO.Directory]::CreateDirectory($proofDir)
  $resultPath=Join-Path $proofDir 'result.json';$result=[ordered]@{status='PREPARING';scope=$ScopeName;sourceCommit=$b6.sourceCommit;stopCalls=0;startCalls=0;retireAttempts=0;outcome=$null;before=$null;final=$null;failure=$null}
  $held=[Collections.Generic.List[object]]::new();$created=[Collections.Generic.List[object]]::new();$control=$null;$newHost=$null;$newResourceRows=@();$oldResourceRows=@();$before=$null;$ready=$null;$status=$null;$webResources=@();$archives=@()
  function Record-Phase([string]$Phase){$result.status=$Phase;[IO.File]::WriteAllText($resultPath,($result|ConvertTo-Json -Depth 16));[Console]::WriteLine((@{phase=$Phase;utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress));[Console]::Out.Flush()}
  try{Invoke-ReadPairInstallSequence}catch{$result.failure=if($_.Exception.Message-cmatch'^[A-Z][A-Z0-9_]+$'){$_.Exception.Message}else{'READPAIR_UNCLASSIFIED_FAILURE'};Record-Phase 'FAILED_REVIEW_RECEIPT';throw $result.failure}
 }finally{
  if($b6ReadProof){Close-ErpReadPairReleaseProof $b6ReadProof;$b6ReadProof=$null}
  foreach($stream in $b6SourceHandles){$stream.Dispose()}
 }
 return
}
if($ScopeName-cne'TEST125-API-READ2b-20261028-41d3c213'){throw 'READPAIR_INSTALL_SCOPE_REJECTED'}
if(!$Apply-or$SourceSha256-cnotmatch'^[a-fA-F0-9]{64}$'-or(Get-FileHash -LiteralPath $PSCommandPath).Hash-ine$SourceSha256){throw 'READPAIR_REVIEWED_SOURCE_AND_SEPARATE_API_APPROVAL_REQUIRED'}
if($PSVersionTable.PSEdition-cne'Desktop'){throw 'READPAIR_WINDOWS_POWERSHELL_REQUIRED'}
$base='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private'
$oldRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-OWNER-ec316a63-20261028';$oldHash='61c2b43bf61b9a0ad750d992eab20398d04fcb65318e64c168943899224d64ec'
$newRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-READ2B-ROUTER-ec316a63-20261028';$newHash='aef6011640248608e0049f34dfd33e37e05e8ae232c320b858b59e12af94c93a'
$overlay=Join-Path $base 'read2b-router-overlay-4b511e5b'
$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$failedReceipt=$null;$coldRecovery=$null
if($AfterLoaderRecovery){
 $failedReceipt=Get-Content -LiteralPath (Join-Path $base 'read2b-install-once\result.json') -Raw|ConvertFrom-Json
 $coldRecovery=Get-Content -LiteralPath (Join-Path $base 'read2b-loader-failure-current-recovery.json') -Raw|ConvertFrom-Json
 Assert-ReadPairLoaderContinuation $failedReceipt $coldRecovery
}
$proofDir=Join-Path $base $(if($AfterLoaderRecovery){'read2b-install-after-loader-recovery-once'}else{'read2b-install-once'});if(Test-Path -LiteralPath $proofDir){throw 'READPAIR_USE_EXISTING_RECEIPT_NO_RERUN'}
Assert-ReadPairPath $proofDir;[void][IO.Directory]::CreateDirectory($proofDir)
$resultPath=Join-Path $proofDir 'result.json';$result=[ordered]@{status='PREPARING';stopCalls=0;startCalls=0;retireAttempts=0;outcome=$null;before=$null;final=$null;failure=$null}
$held=[Collections.Generic.List[object]]::new();$created=[Collections.Generic.List[object]]::new();$control=$null;$newHost=$null;$newResourceRows=@();$oldResourceRows=@();$before=$null;$ready=$null;$status=$null;$webResources=@();$archives=@()
function Record-Phase([string]$Phase){$result.status=$Phase;[IO.File]::WriteAllText($resultPath,($result|ConvertTo-Json -Depth 16));[Console]::WriteLine((@{phase=$Phase;utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress));[Console]::Out.Flush()}
# Verify the fixed frozen core BEFORE executing any of it.
Check-Bundle $oldRoot $oldHash 'ec316a63b535544e53a566370b1614a1721f940c'
. (Join-Path $oldRoot 'start-business-5244-owned.ps1') -Library
. (Join-Path $oldRoot 'start-owned-test.ps1') -Library
. (Join-Path $oldRoot 'test125-bound-api-quiescence.ps1')
Initialize-Business5244WebNative;Initialize-Business5244RetirementPeer;$pins=Get-Business5244WebPins
$generation=[Business5244PackageSeal]::new()
try{if(!$generation.GetType().GetProperty('PolicyVersion')-or$generation.PolicyVersion-cne'test125-package-file-identity.v2'){throw 'READPAIR_PREPARED_API_CORE_GENERATION_REQUIRED'}}finally{$generation.Dispose()}
try{Invoke-ReadPairInstallSequence}catch{$result.failure=if($_.Exception.Message-cmatch'^[A-Z][A-Z0-9_]+$'){$_.Exception.Message}else{'READPAIR_UNCLASSIFIED_FAILURE'};Record-Phase 'FAILED_REVIEW_RECEIPT';throw $result.failure}
