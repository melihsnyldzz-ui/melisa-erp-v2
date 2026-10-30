param([switch]$Library,[switch]$Apply,[switch]$AfterLoaderRecovery,[switch]$CurrentOnlySupersession,[switch]$InitializerCleanRecovery,[switch]$RehearsalOnly,[switch]$CandidateInstall,[switch]$WriterInstall,[switch]$WebOnlyRefreshInstall,[switch]$SteadyStartupInstall,[switch]$PreviewLinkInstall,[switch]$ReadContextRepairInstall,[string]$SourceSha256,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){throw 'READPAIR_INSTALL_SCOPE_REJECTED'}
if($ReadContextRepairInstall-and($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$AfterLoaderRecovery-or$CurrentOnlySupersession-or$InitializerCleanRecovery-or$RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$SteadyStartupInstall-or$PreviewLinkInstall)){throw 'B6_READ_REPAIR_FIXED_ACTION_REQUIRED'}
if($PreviewLinkInstall-and($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$WriterInstall-or$CandidateInstall-or$RehearsalOnly-or$AfterLoaderRecovery-or$CurrentOnlySupersession-or$InitializerCleanRecovery-or$WebOnlyRefreshInstall-or$SteadyStartupInstall)){throw 'B6_PREVIEW_LINK_FIXED_ACTION_REQUIRED'}
if($RehearsalOnly-and($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$AfterLoaderRecovery-or$CurrentOnlySupersession-or$InitializerCleanRecovery)){throw 'B6_REHEARSAL_FIXED_ACTION_REQUIRED'}
if($CandidateInstall-and($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$AfterLoaderRecovery-or$CurrentOnlySupersession-or$InitializerCleanRecovery-or$RehearsalOnly)){throw 'B6_CANDIDATE_FIXED_ACTION_REQUIRED'}
if($WriterInstall-and($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$AfterLoaderRecovery-or$CurrentOnlySupersession-or$InitializerCleanRecovery-or$RehearsalOnly-or$CandidateInstall)){throw 'B6_WRITER_FIXED_ACTION_REQUIRED'}
if($WebOnlyRefreshInstall-and($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$WriterInstall-or$CandidateInstall-or$RehearsalOnly-or$AfterLoaderRecovery-or$CurrentOnlySupersession-or$InitializerCleanRecovery)){throw 'B6_WEBONLY_FIXED_ACTION_REQUIRED'}
if($SteadyStartupInstall-and($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$WriterInstall-or$CandidateInstall-or$RehearsalOnly-or$AfterLoaderRecovery-or$CurrentOnlySupersession-or$InitializerCleanRecovery-or$WebOnlyRefreshInstall)){throw 'B6_STEADY_FIXED_ACTION_REQUIRED'}
# The steady action reuses the existing web-only native handoff. It never
# constructs an API transition or sends a retirement request.
if($SteadyStartupInstall){$WebOnlyRefreshInstall=$true}
if(!$Library-and$ScopeName-ceq'TEST125-API-B6-WRITER-20261029'-and!$WriterInstall-and!$WebOnlyRefreshInstall-and!$PreviewLinkInstall-and!$ReadContextRepairInstall){throw 'B6_WRITER_FIXED_ACTION_REQUIRED'}
# Internal reuse of task-publication plumbing only. The SQL repair remains a
# distinct exact-case issuer, native mode and caller argument contract.
if($ReadContextRepairInstall){$PreviewLinkInstall=$true}
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
function Get-ReadPairSha256Value($Hash){
 if($Hash-isnot[string]-or$Hash.Length-ne64-or$Hash-cnotmatch'\A[a-fA-F0-9]{64}\z'){throw 'READPAIR_BASELINE_HASH_REJECTED'}
 $bytes=New-Object byte[] 32
 for($i=0;$i-lt32;$i++){$bytes[$i]=[Convert]::ToByte($Hash.Substring($i*2,2),16)}
 return ,$bytes
}
function Get-ReadPairProtectionSignature($Snapshot){
 Assert-ReadPairExactFields $Snapshot @('listeners','processes','files')
 $ls=@(@(foreach($r in $Snapshot.listeners){Assert-ReadPairExactFields $r @('LocalPort','LocalAddress','OwningProcess');'{0}|{1}|{2}'-f$r.LocalPort,$r.LocalAddress,$r.OwningProcess})|Sort-Object)
 $ps=@(@(foreach($r in $Snapshot.processes){Assert-ReadPairExactFields $r @('pid','birth','exe');'{0}|{1}|{2}'-f$r.pid,$r.birth,$r.exe})|Sort-Object)
 $fs=@(@(foreach($r in $Snapshot.files){Assert-ReadPairExactFields $r @('path','hash');$value=Get-ReadPairSha256Value $r.hash;'{0}|{1}'-f$r.path,([BitConverter]::ToString($value).Replace('-','').ToLowerInvariant())})|Sort-Object)
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
  if($SteadyStartupInstall){
   Complete-B6SteadyTaskPublication
   Complete-ReadPairPublication 'SteadyStartupVerified'
   return 'SteadyStartupVerified'
  }
  $issued=$true
  try{Send-ReadPairSingleRetire}catch{Record-Phase 'ACK_UNCONFIRMED_READONLY_RECONCILIATION'}
  $outcome=Wait-ReadPairFinalState
  if($outcome -cnotin @('CandidateVerified','RollbackVerified')){throw 'READPAIR_FINAL_STATE_UNKNOWN'}
  if($PreviewLinkInstall){Complete-B6PreviewLinkTaskPublication $outcome}
  Complete-ReadPairPublication $outcome
  return $outcome
 }catch{
  if(!$issued){
   $actualStopped=$stopped
   if($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){$h=Get-B6ReadPairActiveHandoff;if($h-and!$h.stopAttempted){$actualStopped=$false}}
   Restore-ReadPairBeforeRetire -OldStopped $actualStopped
  }
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
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  $expected=Get-B6ReadPairOwnerArguments $oldRoot $oldHash
  if(($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall)-and$oldRoot-ceq$b6.owner.entry.root){
   if($Status.ownerPid-ne$b6.owner.owner.pid-or$Status.ownerBirth-cne$b6.owner.owner.birth-or$Status.childPid-ne$b6.owner.child.pid-or$Status.childBirth-cne$b6.owner.child.birth-or!(Test-ReadPairOwnerArguments ([string]$p.CommandLine) ([string]$b6.owner.owner.argv))){throw 'B6_CURRENT_OWNER_CAPTURE_CHANGED'}
  }elseif($oldRoot-ceq$b6.owner.entry.root){
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
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){$script:b6InitializationExitProcess=$null}
 $logPrefix=if($AfterLoaderRecovery){'read2b-install-after-loader-recovery-'}else{'read2b-install-'}
 $stdout=Join-Path $base ($logPrefix+$Label+'.stdout.log');$stderr=Join-Path $base ($logPrefix+$Label+'.stderr.log')
 if((Test-Path $stdout) -or (Test-Path $stderr)){throw 'WEB_START_LOG_ALREADY_EXISTS'}
 $saved=@{};foreach($entry in Get-ChildItem Env:){$saved[$entry.Name]=$entry.Value}
 try{
  foreach($name in @($saved.Keys)){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
  foreach($name in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if($saved.ContainsKey($name)){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
  $argv=@('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',(Join-Path $Root $(if($Label -ceq 'candidate'){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'})),'-ManifestSha256',$Hash.ToUpperInvariant())
  if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
   [void](Get-B6ReadPairOwnerArguments $Root $Hash)
   if($Label-ceq'candidate'){$argv+=@('-ScopeName',$ScopeName)}
  }
  $script:newHost=Microsoft.PowerShell.Management\Start-Process -FilePath $ps -ArgumentList $argv -WindowStyle Hidden -WorkingDirectory $Root -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
   # Retain the real kernel process handle from this exact source-bound spawn.
   # Later ExitCode readback must not reopen/adopt a recycled numeric PID.
   if(!($script:newHost-is[Diagnostics.Process])-or$script:newHost.Handle-eq[IntPtr]::Zero){throw 'B6_OWNER_KERNEL_HANDLE_REQUIRED'}
  }
 }finally{foreach($entry in Get-ChildItem Env:){[Environment]::SetEnvironmentVariable($entry.Name,$null,'Process')};foreach($entry in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($entry.Key,$entry.Value,'Process')};$saved.Clear()}
 $result.startCalls++;$birth=$script:newHost.StartTime.ToUniversalTime().ToFileTimeUtc().ToString();$result.newOwnerPid=$script:newHost.Id;$result.newOwnerBirth=$birth;Record-Phase ('STARTING_'+$Label)
 $deadline=[DateTime]::UtcNow.AddSeconds(900)
 do{
  if($script:newHost.HasExited){
   if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-and($Label-ceq'candidate'-or($SteadyStartupInstall-and$Label-ceq'steady'))-and$Root-ceq$b6.routerRoot-and$Hash-ceq$b6.routerHash-and$script:newHost.ExitCode-eq73){
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
 if($WebOnlyRefreshInstall-or$PreviewLinkInstall){$ports=@(4144)+$ports}
 $listeners=@(Get-NetTCPConnection -State Listen|Where-Object {$_.LocalPort -in $ports}|Sort-Object LocalPort,LocalAddress,OwningProcess|Select-Object LocalPort,LocalAddress,OwningProcess)
 $processes=@($listeners.OwningProcess|Sort-Object -Unique|ForEach-Object {$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$_);if(!$p){throw 'READPAIR_PROTECTED_PROCESS_MISSING'};[ordered]@{pid=$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o');exe=$p.ExecutablePath}})
 $files=@('C:\Sirket\ERP\clean\20261022\runtime\start-crm.ps1','C:\Sirket\ERP\clean\20261022\runtime\crm-processes.json','C:\Sirket\ERP\config\TEST-20260929-01\runtime-private.json','C:\Sirket\ERP\melisa-erp-v2\scripts\canonical\start-owned-test.ps1')
 return [ordered]@{listeners=$listeners;processes=$processes;files=@($files|ForEach-Object {@{path=$_;hash=(Get-FileHash -LiteralPath $_).Hash}})}
}
function Assert-ReadPairProtection {
 if($WebOnlyRefreshInstall){Assert-B6WebOnlyApiBoundary;if(!(Get-Variable WebOnlyPackageSeal -Scope Script -ErrorAction SilentlyContinue)-or!$script:WebOnlyPackageSeal){throw 'B6_WEBONLY_PACKAGE_SEAL_REQUIRED'};$script:WebOnlyPackageSeal.Validate()}
 if($PreviewLinkInstall){
  # Only API4144 is the admitted paired transition. Initial publication still
  # compares the complete captured snapshot; actual API before/after identity
  # is independently checked by the genuine quiescence/release proof.
  if((Get-ReadPairProtectionSignature (Get-B6PreviewLinkProtectionProjection (Protection-Snapshot)))-cne(Get-ReadPairProtectionSignature (Get-B6PreviewLinkProtectionProjection $before))){throw 'READPAIR_PROTECTION_CHANGED'}
  return
 }
 if((Get-ReadPairProtectionSignature (Protection-Snapshot))-cne(Get-ReadPairProtectionSignature $before)){throw 'READPAIR_PROTECTION_CHANGED'}
}
function Get-B6PreviewLinkProtectionProjection($Snapshot){
 [void](Get-ReadPairProtectionSignature $Snapshot)
 $listeners=@($Snapshot.listeners|Where-Object{$_.LocalPort-ne4144});$protectedPids=@($listeners.OwningProcess);$apiPids=@($Snapshot.listeners|Where-Object{$_.LocalPort-eq4144}|ForEach-Object {$_.OwningProcess}|Sort-Object -Unique)
 return [ordered]@{listeners=$listeners;processes=@($Snapshot.processes|Where-Object{$_.pid-notin$apiPids-or$_.pid-in$protectedPids});files=@($Snapshot.files)}
}
function Get-ReadPairExpectedProjection {
 param([byte[]]$StartupBytes,[byte[]]$ApiBytes,[string]$BaseProfileSha256,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',$NativeProfileAdmission=$null)
 # Pure hash projection only. Supplied bytes are never written or authority.
 $pairScope=if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){Get-Test125ReadPairScope}else{Get-Test125ReadPairScope -Name $ScopeName};$path='C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $config=[Text.Encoding]::UTF8.GetString($StartupBytes)|ConvertFrom-Json
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){[void](Assert-Test125ReadPairConfig $config Current)}else{[void](Assert-Test125ReadPairConfig $config Current -ScopeName $ScopeName)}
 if($BaseProfileSha256-cnotmatch'^[a-f0-9]{64}$'){throw 'READPAIR_EXPECTED_BASE_HASH_CHANGED'}
 $nextApi=[Text.Encoding]::UTF8.GetString($ApiBytes)|ConvertFrom-Json
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){[void](Assert-ErpBusinessSaleWriterProfileAdmission $NativeProfileAdmission -Phase WriterPrepared)}else{[void](Assert-ErpBusinessSaleNativeProfileAdmission $NativeProfileAdmission -Phase Prepared)}
  $native=Get-ErpBusinessSaleNativeAdmissionContext $NativeProfileAdmission
  if($native.profileBeforeHash-cne(Get-Business5244StartupHash $ApiBytes)){throw 'B6_NATIVE_PROFILE_BEFORE_CHANGED'}
  [byte[]]$apiAfter=Get-ErpBusinessSaleCandidateProfileBytes $NativeProfileAdmission
  if(!$apiAfter-or!$apiAfter.Length){throw 'READPAIR_B6_CANDIDATE_PROFILE_REQUIRED'}
  $schema=if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'-and$native.mode-ceq'ReadContextRepair'){'melisa-test125-b6-read-context-repair-api-transition.v1'}elseif($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'-and$native.mode-ceq'PackageRefresh'){'melisa-test125-b6-package-refresh-api-transition.v1'}elseif($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){'melisa-test125-b6-writer-api-transition.v1'}else{'melisa-test125-b6-api-transition.v1'}
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
 if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'-and$native.mode-ceq'ReadContextRepair'){
  if(($nextConfig|ConvertTo-Json -Depth 100 -Compress)-cne($config|ConvertTo-Json -Depth 100 -Compress)){throw 'B6_READ_REPAIR_STARTUP_DELTA_FORBIDDEN'}
  $startupAfter=[byte[]]$StartupBytes.Clone()
 }
 $releasePins=Get-ReadPairExpectedReleasePins $config $pairScope
 $shape=[pscustomobject][ordered]@{schema=$schema;packageProof=$releasePins;scope=$pairScope.name;source=$pairScope.source;database=$pairScope.database;current=$pairScope.current;candidate=$pairScope.candidate;apiProfileBeforeSha256=(Get-Business5244StartupHash $ApiBytes);apiProfileCandidateSha256=(Get-Business5244StartupHash $apiAfter);baseProfileSha256=$BaseProfileSha256;startupBeforeSha256=(Get-Business5244StartupHash $StartupBytes);startupCandidateSha256=(Get-Business5244StartupHash $startupAfter);apiPort=4144;preservedPorts=@(4146,5194);runtimeApplied=$false}
 if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){
  if($native.mode-cnotin@('WriterProfileActivation','PackageRefresh','ReadContextRepair')){throw 'B6_WRITER_PROFILE_PURPOSE_REJECTED'}
  if($native.mode-ceq'PackageRefresh'-and(Get-Business5244StartupHash $apiAfter)-cne(Get-Business5244StartupHash $ApiBytes)){throw 'B6_PACKAGE_REFRESH_PROFILE_CHANGED'}
  $shape|Add-Member profileOnlyPurpose $native.mode
 }elseif($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  if($native.rehearsalOnly-isnot[bool]){throw 'B6_NATIVE_PURPOSE_REJECTED'}
  # Match the actual transition's final, issuer-bound purpose member. Omitting
  # it would predict a different plan even for otherwise identical profiles.
  $shape|Add-Member rehearsalOnly $native.rehearsalOnly
 }
 $contractHash=Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(($shape|ConvertTo-Json -Depth 12 -Compress)))
 $keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')
 # The frozen READ2b core predates the additive finite selector. Preserve its
 # original getters; only B6 uses the new shared source selector.
 if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){$new=Get-Business5244ReadPairPins;$old=Get-Business5244WebPins}else{$new=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Candidate;$old=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current}
 $identity='business-5244-read-pair.v1|'+$contractHash+'|'+(($keys|ForEach-Object {$new[$_]})-join'|')+'|'+(($keys|ForEach-Object {$old[$_]})-join'|')
 return @{planHash=(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity)));baseHash=$BaseProfileSha256;startupPath=$path;apiPath=$pairScope.current.ConfigPath;basePath=$config.ConfigPath;Current=@{startup=$shape.startupBeforeSha256;api=$shape.apiProfileBeforeSha256};Candidate=@{startup=$shape.startupCandidateSha256;api=$shape.apiProfileCandidateSha256}}
}
function Get-ReadPairExpectedHashes {
 param([ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213',$NativeProfileAdmission=$null)
 $pairScope=if($ScopeName-ceq'TEST125-API-READ2b-20261028-41d3c213'){Get-Test125ReadPairScope}else{Get-Test125ReadPairScope -Name $ScopeName};$path='C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){[void](Assert-ErpBusinessSaleWriterProfileAdmission $NativeProfileAdmission -Phase WriterPrepared)}else{[void](Assert-ErpBusinessSaleNativeProfileAdmission $NativeProfileAdmission -Phase Prepared)}}elseif($null-ne$NativeProfileAdmission){throw 'READPAIR_NATIVE_SCOPE_REJECTED'}
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
function Get-ReadPairInstallFailureSite($Failure){
 # Location only: never Message, source text, target object, stack or argv.
 if($Failure-isnot[Management.Automation.ErrorRecord]){return $null}
 if(!$Failure.InvocationInfo){return [ordered]@{diagnosticUnavailable=$true}}
 $knownLeaves=@(
  'reviewed-installer-source.ps1'
  'install-business-5244-readpair.ps1'
  'business-5244-startup-exclusion.ps1'
  'start-business-5244-web.ps1'
  'business-5244-retirement-channel.ps1'
  'business-5244-retirement-state.ps1'
  'business-5244-maintenance-dispatch.ps1'
  'start-business-5244-owned.ps1'
  'test125-bound-api-quiescence.ps1'
  'test125-bound-maintenance-plan.ps1'
  'start-owned-test.ps1'
  'canonical-business-sale-maintenance.ps1'
  'run-current-owner.ps1'
 )
 $leaf=[IO.Path]::GetFileName([string]$Failure.InvocationInfo.ScriptName);$id=[string]$Failure.FullyQualifiedErrorId;$type=$Failure.Exception.GetType().FullName
 $safeId=if($id-cin@('PropertyNotFoundStrict','VariableIsUndefined','MethodNotFound','ParameterArgumentValidationError','ParameterBindingValidationException')){$id}else{$null}
 $safeType=if($type-cin@('System.Management.Automation.RuntimeException','System.Management.Automation.PropertyNotFoundException','System.Management.Automation.MethodInvocationException','System.Management.Automation.ParameterBindingValidationException','System.ArgumentException','System.InvalidOperationException','System.IO.IOException','System.UnauthorizedAccessException','System.Data.SqlClient.SqlException')){$type}else{$null}
 return [ordered]@{scriptLeaf=$(if($leaf-cin$knownLeaves){$leaf}else{$null});scriptLineNumber=[int]$Failure.InvocationInfo.ScriptLineNumber;errorId=$safeId;errorIdSha256=$(if($id-and!$safeId){Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($id))}else{$null});exceptionType=$safeType;exceptionTypeSha256=$(if(!$safeType){Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($type))}else{$null})}
}
function Get-B6ReadPairOwnerArguments([string]$Root,[string]$Hash){
 if($SteadyStartupInstall-and$Root-ceq$b6.coreRoot){return ('-NoProfile -NonInteractive -WindowStyle Hidden -File '+$Root+'\run-current-owner.ps1 -ManifestSha256 '+$Hash.ToUpperInvariant())}
 $kind=$b6.owner.predecessorEntryKind
 if($kind-ceq'CurrentInitializerClean'){
  if(!$RehearsalOnly-or$b6.owner.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029'-or$b6.owner.entry.leaf-cne'run-current-owner.ps1'-or$b6.owner.entry.manifestSha256-cne'6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0'){throw 'B6_CURRENT_ENTRY_KIND_REJECTED'}
 }elseif($kind-ceq'CurrentCore'){
  if($b6.owner.entry.leaf-cne'run-current-owner.ps1'-or$b6.owner.entry.root-cne$b6.owner.core.root-or$b6.owner.entry.manifestSha256-cne$b6.owner.core.manifestSha256){throw 'B6_CURRENT_ENTRY_KIND_REJECTED'}
 }elseif($kind-ceq'ReadPairRouter'){
  if($b6.owner.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$b6.owner.entry.root-cne$b6.owner.router.root-or$b6.owner.entry.manifestSha256-cne$b6.owner.router.manifestSha256){throw 'B6_CURRENT_ENTRY_KIND_REJECTED'}
 }else{throw 'B6_CURRENT_ENTRY_KIND_REJECTED'}
 if($Root-ceq$b6.owner.entry.root-and$Hash-ceq$b6.owner.entry.manifestSha256){$leaf=$b6.owner.entry.leaf;$suffix=if($kind-cin@('ReadPairRouter','CurrentInitializerClean')){' -ScopeName TEST125-API-B6-ca620bac-20261028'}else{''}}
 elseif($Root-ceq$b6.routerRoot-and$Hash-ceq$b6.routerHash){$leaf='start-business-5244-readpair-router.ps1';$suffix=' -ScopeName '+$(if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){'TEST125-API-B6-WRITER-20261029'}else{'TEST125-API-B6-ca620bac-20261028'})}
 elseif($Root-ceq$b6.coreRoot-and$Hash-ceq$b6.coreHash){$leaf='run-current-owner.ps1';$suffix=''}
 else{throw 'B6_OWNER_ARGV_SCOPE_REJECTED'}
 if(($WebOnlyRefreshInstall-or(Test-B6PreviewLinkNativeContextCase))-and$kind-ceq'ReadPairRouter'-and$Root-ceq$b6.owner.entry.root){$suffix=' -ScopeName TEST125-API-B6-WRITER-20261029'}
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
 if($ScopeName-cnotin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){return $null}
 if(!$b6.owner.PSObject.Properties['predecessorEntryKind']){return $null}
 $entry=$b6.owner.entry;$kind=$b6.owner.predecessorEntryKind
 if($entry.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_ACTIVE_ENTRY_DESCRIPTOR_REJECTED'}
 if($kind-ceq'CurrentInitializerClean'){
  [void](Get-B6ReadPairOwnerArguments $entry.root $entry.manifestSha256)
  $expected=@(@{path=(Join-Path $entry.root 'run-current-owner.ps1');hash=$entry.sha256})
 }elseif($kind-ceq'CurrentCore'){
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
  if($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){
   $postExitCount=if(Test-B6ReadContextRepairCase){44}elseif(Test-B6PreviewLinkPreviewReadCase){38}elseif(Test-B6PreviewLinkNativeContextCase){32}elseif($PreviewLinkInstall){29}elseif($SteadyStartupInstall){28}elseif($WebOnlyRefreshInstall){26}elseif($WriterInstall){24}elseif($CandidateInstall){20}else{18}
   if($held.Count-ne$postExitCount-or!$script:ReadPairPreheldMutex-or(Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_MANAGED_EXIT_POST_EXIT_CAS_CHANGED'}
   $script:ReadPairExitObservation.ValidateExited();Assert-ReadPairProtection
  }
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
function Open-B6RehearsalPreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 # Separate immutable generation: legacy failed packages are never rewritten.
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029';$proof=Join-Path $private 'owner-preparation-v3'
 if(!$Apply-or!$RehearsalOnly-or$ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$PSVersionTable.PSEdition-cne'Desktop'-or$EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')-or$ReviewedSourceHash-cnotmatch'^[a-fA-F0-9]{64}$'){throw 'B6_REHEARSAL_REVIEWED_ENTRY_REQUIRED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  $producer=Join-Path $proof 'verified-owner-producer.mjs';Hold-B6ReadPairSource $producer 'd8ca8148b7d7fcebc5c28504da009125935e0cc55bccf9a019eed69b7252034b'
  $verifiedText=& $node $producer --verify-rehearsal
  if($LASTEXITCODE-ne0){throw 'B6_OWNER_SOURCE_VERIFICATION_FAILED'};$v=$verifiedText|ConvertFrom-Json
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3'
  if($v.schema-cne'melisa-b6-rehearsal-owner-verification.v1'-or$v.rehearsalOnly-isnot[bool]-or!$v.rehearsalOnly-or$v.runtimeValidationComplete-ne$false-or$v.postExitExclusiveBytesRequired-ne$true-or$v.postExitExclusiveEntryCount-ne18-or$v.coreFiles-ne13-or$v.beforeImages-ne6-or$v.writes-ne0-or$v.sqlCalls-ne0-or$v.serviceCalls-ne0-or$v.ownerCalls-ne0-or$v.taskChanges-ne0-or$v.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()-or$v.coreRoot-cne$core-or$v.routerRoot-cne$router){throw 'B6_REHEARSAL_SOURCE_NOT_VERIFIED'}
  Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $v.coreManifestSha256;Hold-B6ReadPairSource (Join-Path $router 'owner-manifest.json') $v.routerManifestSha256
  $m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json;$rm=Get-Content -LiteralPath (Join-Path $router 'owner-manifest.json') -Raw|ConvertFrom-Json
  if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne$ScopeName-or$m.sourceCommit-cne$v.ownerSourceCommit-or$m.rehearsalOnly-ne$true-or@($m.files).Count-ne13-or$rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.rehearsalOnly-ne$true-or$rm.coreManifestSha256-cne$v.coreManifestSha256-or$rm.coreRoot-cne$core){throw 'B6_REHEARSAL_CORE_IDENTITY_CHANGED'}
  foreach($file in @($m.files)+@($m.beforeImages)){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
  Hold-B6ReadPairSource (Join-Path $router 'start-business-5244-readpair-router.ps1') $rm.entrySha256;Hold-B6ReadPairSource (Join-Path $router 'readpair-router-library.ps1') $rm.routerLibrarySha256
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json;$entries=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -RehearsalOnly -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-ca620bac-20261028'
  $sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  if($self.ExecutablePath-ine$ps-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  return [pscustomobject]@{coreRoot=$core;coreHash=$v.coreManifestSha256;routerRoot=$router;routerHash=$v.routerManifestSha256;sourceCommit=$v.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entries;rehearsalOnly=$true}
 }catch{foreach($stream in $script:b6SourceHandles){$stream.Dispose()};throw}
}
function Open-B6CandidatePreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 # Separate immutable generation: legacy failed packages are never rewritten.
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-candidate-apply-debafecb-20261029';$proof=Join-Path $private 'owner-preparation'
 if(!$Apply-or!$CandidateInstall-or$RehearsalOnly-or$ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$PSVersionTable.PSEdition-cne'Desktop'-or$EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')-or$ReviewedSourceHash-cnotmatch'^[a-fA-F0-9]{64}$'){throw 'B6_CANDIDATE_REVIEWED_ENTRY_REQUIRED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  $producer=Join-Path $proof 'verified-owner-producer.mjs';Hold-B6ReadPairSource $producer 'd8ca8148b7d7fcebc5c28504da009125935e0cc55bccf9a019eed69b7252034b'
  $verifiedText=& $node $producer --verify-candidate
  if($LASTEXITCODE-ne0){throw 'B6_OWNER_SOURCE_VERIFICATION_FAILED'};$v=$verifiedText|ConvertFrom-Json
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY'
  if($v.schema-cne'melisa-b6-candidate-owner-verification.v1'-or$v.rehearsalOnly-isnot[bool]-or$v.rehearsalOnly-or$v.maintenancePurpose-cne'CandidateMetadataApply'-or$v.runtimeValidationComplete-ne$false-or$v.postExitExclusiveBytesRequired-ne$true-or$v.postExitExclusiveEntryCount-ne20-or$v.coreFiles-ne13-or$v.beforeImages-ne6-or$v.writes-ne0-or$v.sqlCalls-ne0-or$v.serviceCalls-ne0-or$v.ownerCalls-ne0-or$v.taskChanges-ne0-or$v.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()-or$v.coreRoot-cne$core-or$v.routerRoot-cne$router){throw 'B6_CANDIDATE_SOURCE_NOT_VERIFIED'}
  Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $v.coreManifestSha256;Hold-B6ReadPairSource (Join-Path $router 'owner-manifest.json') $v.routerManifestSha256
  $m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json;$rm=Get-Content -LiteralPath (Join-Path $router 'owner-manifest.json') -Raw|ConvertFrom-Json
  if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne$ScopeName-or$m.sourceCommit-cne$v.ownerSourceCommit-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.maintenancePurpose-cne'CandidateMetadataApply'-or@($m.files).Count-ne13-or$rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.rehearsalOnly-isnot[bool]-or$rm.rehearsalOnly-or$rm.maintenancePurpose-cne'CandidateMetadataApply'-or$rm.coreManifestSha256-cne$v.coreManifestSha256-or$rm.coreRoot-cne$core){throw 'B6_CANDIDATE_CORE_IDENTITY_CHANGED'}
  foreach($file in @($m.files)+@($m.beforeImages)){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
  Hold-B6ReadPairSource (Join-Path $router 'start-business-5244-readpair-router.ps1') $rm.entrySha256;Hold-B6ReadPairSource (Join-Path $router 'readpair-router-library.ps1') $rm.routerLibrarySha256
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json;$entries=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -CandidateInstall -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-ca620bac-20261028'
  $sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  if($self.ExecutablePath-ine$ps-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  return [pscustomobject]@{coreRoot=$core;coreHash=$v.coreManifestSha256;routerRoot=$router;routerHash=$v.routerManifestSha256;sourceCommit=$v.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entries;rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply'}
 }catch{foreach($stream in $script:b6SourceHandles){$stream.Dispose()};throw}
}
function Open-B6PreviewLinkPreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 $basePrivate='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-preview-link-20261030'
 $previewRead=$EntryPath-ceq(Join-Path $basePrivate 'native-context-fix\preview-read-indexed-current\owner-preparation\reviewed-installer-source.ps1')
 $nativeContext=$EntryPath-ceq(Join-Path $basePrivate 'native-context-fix\owner-preparation\reviewed-installer-source.ps1')
 $private=if($previewRead){Join-Path $basePrivate 'native-context-fix\preview-read-indexed-current'}elseif($nativeContext){Join-Path $basePrivate 'native-context-fix'}else{$basePrivate};$proof=Join-Path $private 'owner-preparation'
 if(!$Apply-or!$PreviewLinkInstall-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$PSVersionTable.PSEdition-cne'Desktop'-or$EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')-or$ReviewedSourceHash-cnotmatch'\A[a-fA-F0-9]{64}\z'){throw 'B6_PREVIEW_LINK_REVIEWED_ENTRY_REQUIRED'}
 $producerHash=if($previewRead){'d56ac42fb63d5c628eb62f9009e29c66b861b966ef3334b8c7e77a07d7523d52'}elseif($nativeContext){'a5ec0ddf1b945c6a42ba6f41b59e1b541fa1b1847d3ee42dd28a4ab8193b1fb6'}else{'b7d5dc1c8e77cba16e064df1eaa60c97daf62eb9c423a7622c0f6bd54fd11ab8'}
 if($previewRead-and($producerHash-isnot[string]-or$producerHash-cnotmatch'\A[a-f0-9]{64}\z')){throw 'B6_PREVIEW_READ_NOT_PREPARED'}
 if($nativeContext-and($producerHash-isnot[string]-or$producerHash-cnotmatch'\A[a-f0-9]{64}\z')){throw 'B6_NATIVE_CONTEXT_NOT_PREPARED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  $producer=Join-Path $proof 'verified-owner-producer.mjs'
  if($previewRead){Hold-B6ReadPairSource $producer 'd56ac42fb63d5c628eb62f9009e29c66b861b966ef3334b8c7e77a07d7523d52'}elseif($nativeContext){Hold-B6ReadPairSource $producer 'a5ec0ddf1b945c6a42ba6f41b59e1b541fa1b1847d3ee42dd28a4ab8193b1fb6'}else{Hold-B6ReadPairSource $producer 'b7d5dc1c8e77cba16e064df1eaa60c97daf62eb9c423a7622c0f6bd54fd11ab8'}
  $verifiedText=if($previewRead){& $node $producer --verify-preview-read}elseif($nativeContext){& $node $producer --verify-native-context}else{& $node $producer --verify-preview-link}
  if($LASTEXITCODE-ne0){throw 'B6_OWNER_SOURCE_VERIFICATION_FAILED'};$v=$verifiedText|ConvertFrom-Json
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-ROUTER-20261030';$steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030'
  $pairHash='7cf2b950e878cbe591040d28e930a9abc6380ec61f13dcd5bd5834d27739c94a'
  $schema='melisa-b6-preview-link-owner-verification.v1';$postExitCount=29
  if($nativeContext){$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-ROUTER-20261030';$steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030';$pairHash='9c35bf28823b280aa49ee1849b6af44f19a7739e98e84269ab32017a368f056c';$schema='melisa-b6-native-context-owner-verification.v1';$postExitCount=32}
  if($previewRead){$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-OWNER-20261030';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-ROUTER-20261030';$steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-STEADY-OWNER-20261030';$pairHash='37400e17acb11f8cccceb600304dda7fedb3ce76543ada07198695edaa964cd3';$schema='melisa-b6-preview-read-owner-verification.v1';$postExitCount=38;if($pairHash-isnot[string]-or$pairHash-cnotmatch'\A[a-f0-9]{64}\z'){throw 'B6_PREVIEW_READ_NOT_PREPARED'}}
  if($v.schema-cne$schema-or$v.scope-cne$ScopeName-or$v.maintenancePurpose-cne'PreviewLinkPackageRefresh'-or$v.coreRoot-cne$core-or$v.routerRoot-cne$router-or$v.steadyRoot-cne$steady-or$v.coreFiles-ne13-or$v.steadyFiles-ne13-or$v.beforeImages-ne6-or$v.packagePairSha256-cne$pairHash-or$v.runtimeValidationComplete-isnot[bool]-or$v.runtimeValidationComplete-or$v.postExitExclusiveBytesRequired-isnot[bool]-or!$v.postExitExclusiveBytesRequired-or$v.postExitExclusiveEntryCount-ne$postExitCount-or$v.installed-isnot[bool]-or$v.installed-or$v.recordingEnabled-isnot[bool]-or$v.recordingEnabled-or$v.executable-isnot[bool]-or$v.executable-or$v.executionAuthority-isnot[bool]-or$v.executionAuthority-or$v.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()-or$v.writes-ne0-or$v.sqlCalls-ne0-or$v.serviceCalls-ne0-or$v.ownerCalls-ne0-or$v.taskChanges-ne0){throw 'B6_PREVIEW_LINK_SOURCE_NOT_VERIFIED'}
  foreach($h in @($v.coreManifestSha256,$v.routerManifestSha256,$v.steadyManifestSha256)){if($h-isnot[string]-or$h-cnotmatch'\A[a-f0-9]{64}\z'){throw 'B6_PREVIEW_LINK_MANIFEST_HASH_REQUIRED'}}
  if($v.ownerSourceCommit-isnot[string]-or$v.ownerSourceCommit-cnotmatch'\A[a-f0-9]{40}\z'){throw 'B6_PREVIEW_LINK_SOURCE_NOT_VERIFIED'}
  Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $v.coreManifestSha256;Hold-B6ReadPairSource (Join-Path $router 'owner-manifest.json') $v.routerManifestSha256;Hold-B6ReadPairSource (Join-Path $steady 'owner-manifest.json') $v.steadyManifestSha256
  $m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json;$rm=Get-Content -LiteralPath (Join-Path $router 'owner-manifest.json') -Raw|ConvertFrom-Json;$sm=Get-Content -LiteralPath (Join-Path $steady 'owner-manifest.json') -Raw|ConvertFrom-Json
  foreach($item in @(@{manifest=$m;purpose='PreviewLinkPackageRefresh';transition=$true},@{manifest=$sm;purpose='WebOnlySteadyStartup';transition=$false})){
   $manifest=$item.manifest
   if($manifest.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$manifest.finiteScope-cne$ScopeName-or$manifest.sourceCommit-cne$v.ownerSourceCommit-or$manifest.maintenancePurpose-cne$item.purpose-or$manifest.apiTransitionEnabled-isnot[bool]-or$manifest.apiTransitionEnabled-ne$item.transition-or$manifest.readPairMaintenanceEnabled-isnot[bool]-or$manifest.readPairMaintenanceEnabled-ne$item.transition-or$manifest.rehearsalOnly-isnot[bool]-or$manifest.rehearsalOnly-or$manifest.recordingEnabled-isnot[bool]-or$manifest.recordingEnabled-or$manifest.actualT1-ne$false-or$manifest.externalOperations-ne$false-or@($manifest.files).Count-ne13-or@($manifest.beforeImages).Count-ne6-or$manifest.packagePair.path-cne'preview-package-pair.json'-or$manifest.packagePair.sha256-cne$pairHash){throw 'B6_PREVIEW_LINK_CORE_IDENTITY_CHANGED'}
  }
  if($rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.finiteScope-cne$ScopeName-or$rm.entrySourceCommit-cne$v.ownerSourceCommit-or$rm.maintenancePurpose-cne'PreviewLinkPackageRefresh'-or$rm.coreRoot-cne$core-or$rm.coreManifestSha256-cne$v.coreManifestSha256-or$rm.readPairMaintenanceEnabled-ne$true){throw 'B6_PREVIEW_LINK_ROUTER_IDENTITY_CHANGED'}
  foreach($bundle in @(@{root=$core;manifest=$m},@{root=$steady;manifest=$sm})){
   foreach($file in @($bundle.manifest.files)+@($bundle.manifest.beforeImages)){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $bundle.root $file.path) $file.sha256}
   Hold-B6ReadPairSource (Join-Path $bundle.root 'preview-package-pair.json') $pairHash
  }
  Hold-B6ReadPairSource (Join-Path $router 'start-business-5244-readpair-router.ps1') $rm.entrySha256;Hold-B6ReadPairSource (Join-Path $router 'readpair-router-library.ps1') $rm.routerLibrarySha256
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json;$entries=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json;$taskCapture=Get-Content -LiteralPath (Join-Path $core 'current-task-capture.json') -Raw|ConvertFrom-Json
  if($previewRead){if($owner.predecessorEntryKind-cne'CurrentCore'-or$null-ne$owner.router-or$owner.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-VERIFIED-OWNER-20261030'-or$owner.owner.pid-ne39708-or$owner.child.pid-ne48876){throw 'B6_PREVIEW_LINK_PREDECESSOR_CHANGED'}}elseif($nativeContext){if($owner.predecessorEntryKind-cne'ReadPairRouter'-or!$owner.router-or$owner.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-ROUTER-20261030'-or$owner.owner.pid-ne7768-or$owner.child.pid-ne47996){throw 'B6_PREVIEW_LINK_PREDECESSOR_CHANGED'}}elseif($owner.predecessorEntryKind-cne'CurrentCore'-or$owner.router-ne$null-or$owner.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'-or$owner.owner.pid-ne37032-or$owner.child.pid-ne49856){throw 'B6_PREVIEW_LINK_PREDECESSOR_CHANGED'}
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -PreviewLinkInstall -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-WRITER-20261029'
  $sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  if($self.ExecutablePath-ine$ps-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  return [pscustomobject]@{fixedCaseId=$(if($previewRead){'PreviewRead'}elseif($nativeContext){'NativeContext'}else{'PreviewLink'});coreRoot=$core;coreHash=$v.coreManifestSha256;routerRoot=$router;routerHash=$v.routerManifestSha256;steadyRoot=$steady;steadyHash=$v.steadyManifestSha256;sourceCommit=$v.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entries;taskCapture=$taskCapture;rehearsalOnly=$false;maintenancePurpose='PreviewLinkPackageRefresh'}
 }catch{foreach($stream in $script:b6SourceHandles){$stream.Dispose()};throw}
}
function Open-B6ReadContextRepairPreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-preview-link-20261030\native-context-fix\array-repair-v2-20261030';$proof=Join-Path $private 'owner-preparation'
 if(!$Apply-or!$ReadContextRepairInstall-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$PSVersionTable.PSEdition-cne'Desktop'-or$EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')-or$ReviewedSourceHash-cnotmatch'\A[a-fA-F0-9]{64}\z'){throw 'B6_READ_REPAIR_REVIEWED_ENTRY_REQUIRED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  $producer=Join-Path $proof 'verified-array-repair-producer.mjs'
  Hold-B6ReadPairSource $producer 'ef09aaf88917a0151bd620cec68f93cc20af3f969203ad47d692e5616f8069b7'
  $text=& $node $producer --verify
  if($LASTEXITCODE-ne0){throw 'B6_READ_REPAIR_SOURCE_VERIFICATION_FAILED'};$v=$text|ConvertFrom-Json
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-OWNER-20261030';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-ROUTER-20261030';$steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-V2-STEADY-OWNER-20261030'
  if($v.schema-cne'melisa-b6-read-context-repair-owner-verification.v1'-or$v.scope-cne$ScopeName-or$v.maintenancePurpose-cne'ReadContextRepair'-or$v.coreRoot-cne$core-or$v.routerRoot-cne$router-or$v.steadyRoot-cne$steady-or$v.coreFiles-ne13-or$v.steadyFiles-ne13-or$v.beforeImages-ne6-or$v.dataFiles-ne7-or$v.postExitExclusiveEntryCount-ne44-or$v.postExitExclusiveBytesRequired-ne$true-or$v.runtimeValidationComplete-ne$false-or$v.installed-ne$false-or$v.recordingEnabled-ne$false-or$v.executable-ne$false-or$v.executionAuthority-ne$false-or$v.sqlCalls-ne0-or$v.serviceCalls-ne0-or$v.taskChanges-ne0-or$v.ownerCalls-ne0-or$v.writes-ne0-or$v.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()-or$v.repairPacketSha256-cne'78d6e2c98354e90fadb98fb0d667b5a46c03bce889d798bd265f7010fc450411'-or$v.ownerSourceCommit-cnotmatch'\A[a-f0-9]{40}\z'){throw 'B6_READ_REPAIR_SOURCE_NOT_VERIFIED'}
  foreach($pair in @(@{root=$core;hash=$v.coreManifestSha256;transition=$true},@{root=$steady;hash=$v.steadyManifestSha256;transition=$false})){
   Hold-B6ReadPairSource (Join-Path $pair.root 'owner-manifest.json') $pair.hash
   $m=Get-Content -LiteralPath (Join-Path $pair.root 'owner-manifest.json') -Raw|ConvertFrom-Json
   if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne$ScopeName-or$m.sourceCommit-cne$v.ownerSourceCommit-or$m.maintenancePurpose-cne'ReadContextRepair'-or$m.rehearsalOnly-ne$false-or$m.recordingEnabled-ne$false-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.apiTransitionEnabled-ne$pair.transition-or$m.readPairMaintenanceEnabled-ne$pair.transition-or@($m.files).Count-ne13-or@($m.beforeImages).Count-ne6){throw 'B6_READ_REPAIR_CORE_CHANGED'}
   foreach($leaf in @($m.files)+@($m.beforeImages)+@($m.repairPacket)){if($leaf.path-match'[\\/]'-or$leaf.sha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'B6_READ_REPAIR_LEAF_REJECTED'};Hold-B6ReadPairSource (Join-Path $pair.root $leaf.path) $leaf.sha256}
  }
  Hold-B6ReadPairSource (Join-Path $router 'owner-manifest.json') $v.routerManifestSha256
  $rm=Get-Content -LiteralPath (Join-Path $router 'owner-manifest.json') -Raw|ConvertFrom-Json
  if($rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.finiteScope-cne$ScopeName-or$rm.entrySourceCommit-cne$v.ownerSourceCommit-or$rm.coreRoot-cne$core-or$rm.coreManifestSha256-cne$v.coreManifestSha256-or$rm.maintenancePurpose-cne'ReadContextRepair'-or$rm.actualT1-ne$false-or$rm.externalOperations-ne$false){throw 'B6_READ_REPAIR_ROUTER_CHANGED'}
  Hold-B6ReadPairSource (Join-Path $router 'start-business-5244-readpair-router.ps1') $rm.entrySha256;Hold-B6ReadPairSource (Join-Path $router 'readpair-router-library.ps1') $rm.routerLibrarySha256
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json;$entries=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json;$task=Get-Content -LiteralPath (Join-Path $core 'current-task-capture.json') -Raw|ConvertFrom-Json
  if($owner.predecessorEntryKind-cne'ReadPairRouter'-or$owner.owner.pid-ne18572-or$owner.owner.birth-cne'134378104151292349'-or$owner.child.pid-ne33788-or$owner.child.birth-cne'134378112314707445'-or$owner.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-ROUTER-20261030'-or$entries.postExitExclusiveEntryCount-ne44){throw 'B6_READ_REPAIR_PREDECESSOR_CHANGED'}
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -ReadContextRepairInstall -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-WRITER-20261029'
  if($self.ExecutablePath-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  Hold-B6ReadPairSource (Join-Path $private 'read-context-repair-backup.json') '32c1b1bff618901418ebe0ec17324bd4b15f78216d8be5355f6b575c0d90ba15'
  $backup=Get-Content -LiteralPath (Join-Path $private 'read-context-repair-backup.json') -Raw|ConvertFrom-Json
  if($backup.status-cne'COPY_ONLY_CHECKSUM_VERIFYONLY_PASSED'-or$backup.databaseId-ne18-or$backup.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or$backup.backupFile-cne'C:\Sirket\ERP\backups\B6\B6-ARRAY-REPAIR-20261030-01.bak'-or$backup.copyOnly-ne$true-or$backup.checksumVerified-ne$true-or$backup.restoreVerifyOnly-ne$true-or$backup.restoreRehearsed-ne$false-or$backup.tradeWrites-ne0-or$backup.actualT1-ne$false){throw 'B6_READ_REPAIR_BACKUP_REQUIRED'}
  # Expensive backup hashing is performed once before any cold-owner action,
  # outside the owner's ten-second request-admission budget. Retain the read
  # handle until this controller completes; no backup bytes can be replaced.
  for($at=$backup.backupFile;$at;$at=[IO.Path]::GetDirectoryName($at)){if((Get-Item -LiteralPath $at -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_READ_REPAIR_BACKUP_REPARSE'}}
  $backupStream=[IO.File]::Open($backup.backupFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  $hash=[Security.Cryptography.SHA256]::Create();try{$actual=[BitConverter]::ToString($hash.ComputeHash($backupStream)).Replace('-','').ToLowerInvariant();$backupStream.Position=0;if($actual-cne$backup.sha256){throw 'B6_READ_REPAIR_BACKUP_CHANGED'}}catch{$backupStream.Dispose();throw}finally{$hash.Dispose()}
  if($backupStream.Length-ne9709158400){$backupStream.Dispose();throw 'B6_READ_REPAIR_BACKUP_CHANGED'}
  $script:b6SourceHandles.Add($backupStream)
  return [pscustomobject]@{fixedCaseId='ReadContextRepair';coreRoot=$core;coreHash=$v.coreManifestSha256;routerRoot=$router;routerHash=$v.routerManifestSha256;steadyRoot=$steady;steadyHash=$v.steadyManifestSha256;sourceCommit=$v.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entries;taskCapture=$task;rehearsalOnly=$false;maintenancePurpose='ReadContextRepair'}
 }catch{foreach($h in $script:b6SourceHandles){$h.Dispose()};throw}
}
function Open-B6WriterPreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 # Separate immutable generation: legacy failed packages are never rewritten.
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029';$proof=Join-Path $private 'owner-preparation'
 if(!$Apply-or!$WriterInstall-or$RehearsalOnly-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$PSVersionTable.PSEdition-cne'Desktop'-or$EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')-or$ReviewedSourceHash-cnotmatch'^[a-fA-F0-9]{64}$'){throw 'B6_WRITER_REVIEWED_ENTRY_REQUIRED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  $producer=Join-Path $proof 'verified-owner-producer.mjs';Hold-B6ReadPairSource $producer '058e345d6bb8af3d6ce4b43951d7a56a454388f2955d97625db6cb2bcfe1bc4f'
  $verifiedText=& $node $producer --verify-writer
  if($LASTEXITCODE-ne0){throw 'B6_OWNER_SOURCE_VERIFICATION_FAILED'};$v=$verifiedText|ConvertFrom-Json
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2'
  if($v.schema-cne'melisa-b6-writer-owner-verification.v1'-or$v.rehearsalOnly-isnot[bool]-or$v.rehearsalOnly-or$v.maintenancePurpose-cne'WriterProfileActivation'-or$v.runtimeValidationComplete-ne$false-or$v.postExitExclusiveBytesRequired-ne$true-or$v.postExitExclusiveEntryCount-ne24-or$v.coreFiles-ne13-or$v.beforeImages-ne6-or$v.writes-ne0-or$v.sqlCalls-ne0-or$v.serviceCalls-ne0-or$v.ownerCalls-ne0-or$v.taskChanges-ne0-or$v.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()-or$v.coreRoot-cne$core-or$v.routerRoot-cne$router){throw 'B6_WRITER_SOURCE_NOT_VERIFIED'}
  Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $v.coreManifestSha256;Hold-B6ReadPairSource (Join-Path $router 'owner-manifest.json') $v.routerManifestSha256
  $m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json;$rm=Get-Content -LiteralPath (Join-Path $router 'owner-manifest.json') -Raw|ConvertFrom-Json
  if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne$ScopeName-or$m.sourceCommit-cne$v.ownerSourceCommit-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.maintenancePurpose-cne'WriterProfileActivation'-or@($m.files).Count-ne13-or$rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.rehearsalOnly-isnot[bool]-or$rm.rehearsalOnly-or$rm.maintenancePurpose-cne'WriterProfileActivation'-or$rm.coreManifestSha256-cne$v.coreManifestSha256-or$rm.coreRoot-cne$core){throw 'B6_WRITER_CORE_IDENTITY_CHANGED'}
  if($m.packagePair.path-cne'writer-package-pair.json'-or$m.packagePair.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_WRITER_PACKAGE_PAIR_CHANGED'};Hold-B6ReadPairSource (Join-Path $core 'writer-package-pair.json') $m.packagePair.sha256
  foreach($file in @($m.files)+@($m.beforeImages)){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
  Hold-B6ReadPairSource (Join-Path $router 'start-business-5244-readpair-router.ps1') $rm.entrySha256;Hold-B6ReadPairSource (Join-Path $router 'readpair-router-library.ps1') $rm.routerLibrarySha256
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json;$entries=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -WriterInstall -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-WRITER-20261029'
  $sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  if($self.ExecutablePath-ine$ps-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  return [pscustomobject]@{coreRoot=$core;coreHash=$v.coreManifestSha256;routerRoot=$router;routerHash=$v.routerManifestSha256;sourceCommit=$v.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entries;rehearsalOnly=$false;maintenancePurpose='WriterProfileActivation'}
 }catch{foreach($stream in $script:b6SourceHandles){$stream.Dispose()};throw}
}
function Open-B6SteadyPreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-steady-startup-20261029';$proof=Join-Path $private 'owner-preparation'
 if(!$Apply-or!$SteadyStartupInstall-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$PSVersionTable.PSEdition-cne'Desktop'-or$EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')-or$ReviewedSourceHash-cnotmatch'\A[a-fA-F0-9]{64}\z'){throw 'B6_STEADY_REVIEWED_ENTRY_REQUIRED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  $producer=Join-Path $proof 'verified-owner-producer.mjs'
  Hold-B6ReadPairSource $producer '66fa87f122d329081c4de97b18c486d4755b4aaca194022e21644b23260c2e54'
  $verifiedText=& $node $producer --verify-steady
  if($LASTEXITCODE-ne0){throw 'B6_OWNER_SOURCE_VERIFICATION_FAILED'};$v=$verifiedText|ConvertFrom-Json
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'
  if($v.schema-cne'melisa-b6-steady-owner-verification.v1'-or$v.ownerSourceCommit-cnotmatch'\A[a-f0-9]{40}\z'-or$v.coreRoot-cne$core-or$v.coreFiles-ne13-or$v.beforeImages-ne6-or$v.maintenancePurpose-cne'WebOnlySteadyStartup'-or$v.scope-cne$ScopeName-or$v.apiTransitionEnabled-ne$false-or$v.readPairMaintenanceEnabled-ne$false-or$v.runtimeValidationComplete-ne$false-or$v.writes-ne0-or$v.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()){throw 'B6_STEADY_SOURCE_NOT_VERIFIED'}
  Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $v.coreManifestSha256
  $m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
  if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.sourceCommit-cne$v.ownerSourceCommit-or$m.finiteScope-cne$ScopeName-or$m.maintenancePurpose-cne'WebOnlySteadyStartup'-or$m.apiTransitionEnabled-ne$false-or$m.readPairMaintenanceEnabled-ne$false-or@($m.files).Count-ne13-or@($m.beforeImages).Count-ne6){throw 'B6_STEADY_CORE_CHANGED'}
  foreach($file in @($m.files)+@($m.beforeImages)){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json
  $entries=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json
  $task=Get-Content -LiteralPath (Join-Path $core 'current-task-capture.json') -Raw|ConvertFrom-Json
  $boundaryPath='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-workface-build-20261029\webonly-api-before.json'
  $boundaryHash='29e427273264176273aa25d68a5f043d18b19d21b0171d496361a9871959a9b4'
  Hold-B6ReadPairSource $boundaryPath $boundaryHash;$boundary=Get-Content -LiteralPath $boundaryPath -Raw|ConvertFrom-Json
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -SteadyStartupInstall -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-WRITER-20261029'
  $sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  if($self.ExecutablePath-ine$ps-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  return [pscustomobject]@{coreRoot=$core;coreHash=$v.coreManifestSha256;routerRoot=$core;routerHash=$v.coreManifestSha256;sourceCommit=$v.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entries;apiBoundary=$boundary;taskCapture=$task;rehearsalOnly=$false;maintenancePurpose='WebOnlySteadyStartup'}
 }catch{foreach($stream in $script:b6SourceHandles){$stream.Dispose()};throw}
}
function Open-B6WebOnlyPreparedSource([string]$ReviewedSourceHash,[string]$EntryPath){
 # Separate immutable generation: legacy failed packages are never rewritten.
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-workface-build-20261029';$proof=Join-Path $private 'owner-preparation'
 if(!$Apply-or!$WebOnlyRefreshInstall-or$RehearsalOnly-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$PSVersionTable.PSEdition-cne'Desktop'-or$EntryPath-cne(Join-Path $proof 'reviewed-installer-source.ps1')-or$ReviewedSourceHash-cnotmatch'^[a-fA-F0-9]{64}$'){throw 'B6_WEBONLY_REVIEWED_ENTRY_REQUIRED'}
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';Assert-ReadPairPath $node
 if((Get-FileHash -LiteralPath $node).Hash-cne'3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'){throw 'B6_CONTROLLER_NODE_CHANGED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 try{
  Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
  $producer=Join-Path $proof 'verified-owner-producer.mjs';Hold-B6ReadPairSource $producer '058e345d6bb8af3d6ce4b43951d7a56a454388f2955d97625db6cb2bcfe1bc4f'
  $verifiedText=& $node $producer --verify-webonly
  if($LASTEXITCODE-ne0){throw 'B6_OWNER_SOURCE_VERIFICATION_FAILED'};$v=$verifiedText|ConvertFrom-Json
  $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029'
  if($v.schema-cne'melisa-b6-webonly-owner-verification.v1'-or$v.rehearsalOnly-isnot[bool]-or$v.rehearsalOnly-or$v.maintenancePurpose-cne'WebOnlyFrontendRefresh'-or$v.runtimeValidationComplete-ne$false-or$v.postExitExclusiveBytesRequired-ne$true-or$v.postExitExclusiveEntryCount-ne26-or$v.coreFiles-ne13-or$v.beforeImages-ne6-or$v.writes-ne0-or$v.sqlCalls-ne0-or$v.serviceCalls-ne0-or$v.ownerCalls-ne0-or$v.taskChanges-ne0-or$v.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()-or$v.coreRoot-cne$core-or$v.routerRoot-cne$router){throw 'B6_WEBONLY_SOURCE_NOT_VERIFIED'}
  Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $v.coreManifestSha256;Hold-B6ReadPairSource (Join-Path $router 'owner-manifest.json') $v.routerManifestSha256
  $m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json;$rm=Get-Content -LiteralPath (Join-Path $router 'owner-manifest.json') -Raw|ConvertFrom-Json
  if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne$ScopeName-or$m.sourceCommit-cne$v.ownerSourceCommit-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.maintenancePurpose-cne'WebOnlyFrontendRefresh'-or@($m.files).Count-ne13-or$rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.rehearsalOnly-isnot[bool]-or$rm.rehearsalOnly-or$rm.maintenancePurpose-cne'WebOnlyFrontendRefresh'-or$rm.coreManifestSha256-cne$v.coreManifestSha256-or$rm.coreRoot-cne$core){throw 'B6_WEBONLY_CORE_IDENTITY_CHANGED'}
  if($m.packagePair.path-cne'writer-webonly-package-pair.json'-or$m.packagePair.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_WEBONLY_PACKAGE_PAIR_CHANGED'};Hold-B6ReadPairSource (Join-Path $core 'writer-webonly-package-pair.json') $m.packagePair.sha256
  foreach($file in @($m.files)+@($m.beforeImages)){if($file.path-match'[\\/]'){throw 'B6_CONTROLLER_LEAF_CHANGED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
  Hold-B6ReadPairSource (Join-Path $router 'start-business-5244-readpair-router.ps1') $rm.entrySha256;Hold-B6ReadPairSource (Join-Path $router 'readpair-router-library.ps1') $rm.routerLibrarySha256
  if($m.recordingEnabled-isnot[bool]-or$m.recordingEnabled-or$rm.recordingEnabled-isnot[bool]-or$rm.recordingEnabled-or$m.packagePair.sha256-cne'f1672081cc695941cd3691cde503a0bb27c1ab58537362fb6907a5cd5dc0d4e4'-or$m.apiBoundary.path-cne'webonly-api-before.json'-or$m.apiBoundary.sha256-cne'29e427273264176273aa25d68a5f043d18b19d21b0171d496361a9871959a9b4'){throw 'B6_WEBONLY_BOUNDARY_CHANGED'}
  Hold-B6ReadPairSource (Join-Path $core $m.apiBoundary.path) $m.apiBoundary.sha256
  $boundary=Get-Content -LiteralPath (Join-Path $core $m.apiBoundary.path) -Raw|ConvertFrom-Json;$task=Get-Content -LiteralPath (Join-Path $core 'current-task-capture.json') -Raw|ConvertFrom-Json
  $owner=Get-Content -LiteralPath (Join-Path $core 'current-read2b-owner-capture.json') -Raw|ConvertFrom-Json;$entries=Get-Content -LiteralPath (Join-Path $core 'current-entry-hold-capture.json') -Raw|ConvertFrom-Json
  $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $argsText=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$EntryPath+' -Apply -WebOnlyRefreshInstall -SourceSha256 '+$ReviewedSourceHash.ToUpperInvariant()+' -ScopeName TEST125-API-B6-WRITER-20261029'
  $sid=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid
  if($self.ExecutablePath-ine$ps-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or!(Test-ReadPairOwnerArguments $argsText $expected)){throw 'B6_CONTROLLER_NATIVE_CALLER_CHANGED'}
  return [pscustomobject]@{coreRoot=$core;coreHash=$v.coreManifestSha256;routerRoot=$router;routerHash=$v.routerManifestSha256;sourceCommit=$v.ownerSourceCommit;private=$private;proof=$proof;owner=$owner;entryCapture=$entries;apiBoundary=$boundary;taskCapture=$task;rehearsalOnly=$false;maintenancePurpose='WebOnlyFrontendRefresh'}
 }catch{foreach($stream in $script:b6SourceHandles){$stream.Dispose()};throw}
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
  Hold-B6ReadPairSource $producer 'd8ca8148b7d7fcebc5c28504da009125935e0cc55bccf9a019eed69b7252034b'
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
function Get-B6WebOnlyExpectedProjection {
 if(!$WebOnlyRefreshInstall-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$b6.maintenancePurpose-cnotin@('WebOnlyFrontendRefresh','WebOnlySteadyStartup')){throw 'B6_WEBONLY_FIXED_ACTION_REQUIRED'}
 $current=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current;$candidate=if($SteadyStartupInstall){$current.Clone()}else{Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Candidate}
 foreach($key in @('apiPackage','apiManifest','baseSource','node','nodeHash','profile','runtime')){if($candidate[$key]-cne$current[$key]){throw 'B6_WEBONLY_API_PAIR_CHANGED'}}
 $identity=@($candidate.package,$candidate.manifest,$candidate.apiPackage,$candidate.apiManifest,$candidate.nodeHash,$candidate.profile)-join'|'
 $boundaryDigest='29e427273264176273aa25d68a5f043d18b19d21b0171d496361a9871959a9b4'
 return @{planHash=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($identity)));apiBoundarySha256=$boundaryDigest}
}
function Assert-B6WebOnlyApiBoundary {
 if(!$WebOnlyRefreshInstall-or$ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$b6.maintenancePurpose-cnotin@('WebOnlyFrontendRefresh','WebOnlySteadyStartup')){throw 'B6_WEBONLY_FIXED_ACTION_REQUIRED'}
 $b=$b6.apiBoundary;$t=$b6.taskCapture
 if($b.schema-cne'melisa-b6-webonly-api-before.v1'-or$b.readOnly-isnot[bool]-or!$b.readOnly-or$b.executionAuthority-isnot[bool]-or$b.executionAuthority-or$b.apiPid-ne41436-or$b.apiBirth-cne'134377688108359820'-or$b.apiParent-ne13532-or$b.apiManifestSha256-cne'560c735fcaffa6692f55543840f8106679b43b871e3c19f1990bdd17d46f9946'-or$b.taskCaptureSha256-cne'075bb030c4fd26a82bf349e95cfcda17d425d8b7ebc08d43fde3d86e75e38fdf'-or$b.taskWrites-ne0-or$b.apiRestarts-ne0-or$b.sqlWrites-ne0-or@($b.files).Count-ne4){throw 'B6_WEBONLY_API_BOUNDARY_CHANGED'}
 if($t.schema-cne'melisa-b6-task-capture.v1'-or$t.readOnly-ne$true-or$t.taskPath-cne'\Melisa-ERP-TEST-Canonical'-or$t.instanceCount-ne1-or$t.enginePid-ne$b.apiParent-or$t.writes-ne0){throw 'B6_WEBONLY_TASK_BOUNDARY_CHANGED'}
 $birth=[DateTime]::FromFileTimeUtc([long]$b.apiBirth).Ticks
 if(!(Get-Variable WebOnlyApiHandle -Scope Script -ErrorAction SilentlyContinue)-or!$script:WebOnlyApiHandle){throw 'B6_WEBONLY_QUERY_HANDLE_REQUIRED'}
 [Test125ApiKernel]::ValidateReadOnly($script:WebOnlyApiHandle,$birth)
 $capturedApi=@($b6.owner.protectedSnapshot.processes|Where-Object{$_.pid-eq$b.apiPid});if($capturedApi.Count-ne1-or!$capturedApi[0].exe){throw 'B6_WEBONLY_API_CAPTURE_CHANGED'}
 $api=Get-CimInstance Win32_Process -Filter ('ProcessId='+$b.apiPid)
 if(!$api-or$api.ProcessId-ne$b.apiPid-or$api.ParentProcessId-ne$b.apiParent-or$api.ExecutablePath-cne$capturedApi[0].exe-or$api.CreationDate.ToUniversalTime().ToFileTimeUtc().ToString()-cne$b.apiBirth-or(Child-Sid $api)-cne[Business5244RetirementPeer]::CurrentSid){throw 'B6_WEBONLY_API_PROCESS_CHANGED'}
 $expectedListeners=@($b6.owner.protectedSnapshot.listeners|Where-Object{$_.LocalPort-eq4144-or$_.OwningProcess-eq$b.apiPid})
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort-eq4144-or$_.OwningProcess-eq$b.apiPid}|Select-Object LocalPort,LocalAddress,OwningProcess)
 if($expectedListeners.Count-ne2-or@($expectedListeners|Where-Object{$_.LocalPort-ne4144-or$_.OwningProcess-ne$b.apiPid}).Count-or(Get-ReadPairProtectionSignature @{listeners=$listeners;processes=@();files=@()})-cne(Get-ReadPairProtectionSignature @{listeners=$expectedListeners;processes=@();files=@()})){throw 'B6_WEBONLY_API_LISTENER_CHANGED'}
 foreach($file in $b.files){Assert-ReadPairPath $file.path;if((Get-FileHash -LiteralPath $file.path -Algorithm SHA256).Hash-ine$file.sha256){throw 'B6_WEBONLY_PROFILE_OR_JOURNAL_CHANGED'}}
 $task=Get-Test125ReadPairTask;$instances=$task.GetInstances(0)
 if($instances.Count-ne1-or$instances.Item(1).EnginePID-ne$t.enginePid-or[string]$instances.Item(1).InstanceGuid-cne$t.instanceGuid-or(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes([string]$task.GetSecurityDescriptor(7))))-cne$t.sddlSha256){throw 'B6_WEBONLY_TASK_CHANGED'}
 if($SteadyStartupInstall){Assert-B6SteadyTaskXml ([string]$task.Xml)}elseif((Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml)))-cne$t.xmlSha256){throw 'B6_WEBONLY_TASK_CHANGED'}
 $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5
 foreach($property in $b.health.PSObject.Properties){$actual=$health.PSObject.Properties[$property.Name];if(!$actual-or$actual.Value.GetType()-ne$property.Value.GetType()-or$actual.Value-cne$property.Value){throw 'B6_WEBONLY_API_HEALTH_CHANGED'}}
}
function Get-B6SteadyTaskXmlCanonical([string]$Text){
 $doc=[Xml.XmlDocument]::new();$doc.XmlResolver=$null;$doc.LoadXml($Text);return $doc.OuterXml
}
function New-B6SteadyTaskXml([string]$BeforeXml){
 # Pure, finite projection. The actual publisher separately checks the held
 # before-image, unchanged running instance and SDDL; XML grants no authority.
 $doc=[Xml.XmlDocument]::new();$doc.XmlResolver=$null;$doc.PreserveWhitespace=$true;$doc.LoadXml($BeforeXml)
 $ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
 $actions=@($doc.SelectNodes('/t:Task/t:Actions/*',$ns));$command=$doc.SelectSingleNode('/t:Task/t:Actions/t:Exec/t:Command',$ns);$arguments=$doc.SelectSingleNode('/t:Task/t:Actions/t:Exec/t:Arguments',$ns)
 $old='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2\start-owned-test.ps1'
 $expected='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$old+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
 if($actions.Count-ne1-or!$command-or!$arguments-or$command.InnerText-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or$arguments.InnerText-cne$expected){throw 'B6_STEADY_TASK_ACTION_CHANGED'}
 $arguments.InnerText=$expected.Replace($old,'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029\start-owned-test.ps1')
 return $doc.OuterXml
}
function Assert-B6SteadyTaskXml([string]$Xml){
 $hash=Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($Xml))
 if(Get-Variable SteadyTaskPublication -Scope Script -ErrorAction SilentlyContinue){
  $publication=$script:SteadyTaskPublication
  if($publication.phase-cin@('Attempted','Verified')){
   if((Get-B6SteadyTaskXmlCanonical $Xml)-cne(Get-B6SteadyTaskXmlCanonical $publication.afterXml)){throw 'B6_STEADY_TASK_AFTER_CHANGED'}
   return
  }
 }
 if($hash-cne$b6.taskCapture.xmlSha256){throw 'B6_WEBONLY_TASK_CHANGED'}
}
function Initialize-B6SteadyTaskPublication {
 if(!$SteadyStartupInstall-or$b6.maintenancePurpose-cne'WebOnlySteadyStartup'-or(Get-Variable SteadyTaskPublication -Scope Script -ErrorAction SilentlyContinue)){throw 'B6_STEADY_TASK_PREPARATION_REQUIRED'}
 $task=Get-Test125ReadPairTask;Assert-B6SteadyTaskXml ([string]$task.Xml)
 if($task.Definition.Principal.LogonType-ne3-or$task.Definition.Principal.RunLevel-ne0){throw 'B6_STEADY_TASK_PRINCIPAL_CHANGED'}
 $before=[string]$task.Xml;$after=New-B6SteadyTaskXml $before
 # Syntax validation only: TASK_VALIDATE_ONLY never registers or runs a task.
 $service=New-Object -ComObject Schedule.Service;$service.Connect();$folder=$service.GetFolder('\')
 [void]$folder.RegisterTask('Melisa-ERP-TEST-Canonical',$after,1,$task.Definition.Principal.UserId,$null,3,$null)
 $script:SteadyTaskPublication=@{phase='Prepared';beforeXml=$before;afterXml=$after;beforeSddl=[string]$task.GetSecurityDescriptor(7);registerCalls=0}
 Assert-B6WebOnlyApiBoundary
}
function Complete-B6SteadyTaskPublication {
 if(!$SteadyStartupInstall-or!(Get-Variable SteadyTaskPublication -Scope Script -ErrorAction SilentlyContinue)){throw 'B6_STEADY_TASK_PREPARATION_REQUIRED'}
 $p=$script:SteadyTaskPublication
 if($p.phase-cne'Prepared'-or$p.registerCalls-ne0){throw 'B6_STEADY_TASK_NO_REPLAY'}
 Assert-ReadPairPreparedOwner
 $task=Get-Test125ReadPairTask;Assert-B6WebOnlyApiBoundary
 if([string]$task.Xml-cne$p.beforeXml-or[string]$task.GetSecurityDescriptor(7)-cne$p.beforeSddl){throw 'B6_STEADY_TASK_BEFORE_CAS_CHANGED'}
 # TASK_UPDATE (not create) + no principal ACE changes + ignore registration
 # triggers. The already running canonical supervisor is never stopped/run.
 $service=New-Object -ComObject Schedule.Service;$service.Connect();$folder=$service.GetFolder('\')
 $p.phase='Attempted';$p.registerCalls=1;$registrationFailure=$null
 try{[void]$folder.RegisterTask('Melisa-ERP-TEST-Canonical',$p.afterXml,52,$task.Definition.Principal.UserId,$null,3,$null)}catch{$registrationFailure=$_}
 $task=Get-Test125ReadPairTask
 if((Get-B6SteadyTaskXmlCanonical ([string]$task.Xml))-cne(Get-B6SteadyTaskXmlCanonical $p.afterXml)){
  if([string]$task.Xml-ceq$p.beforeXml){$p.phase='Prepared';throw 'B6_STEADY_TASK_UPDATE_NOT_APPLIED'}
  throw 'B6_STEADY_TASK_UPDATE_UNCONFIRMED'
 }
 Assert-B6WebOnlyApiBoundary
 $p.phase='Verified';$result.taskChanges=1;$result.taskRegistrationCalls=1
 $result.taskAfterSha256=Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml))
 $result.taskRunningInstanceUnchanged=$true;$result.taskPermissionUnchanged=$true;$result.physicalRebootTested=$false
}
function Test-B6ReadContextRepairCase {
 $flag=Get-Variable ReadContextRepairInstall -ErrorAction SilentlyContinue
 return [bool]($flag-and$flag.Value-and(Get-Variable b6 -ErrorAction SilentlyContinue)-and$b6.PSObject.Properties['fixedCaseId']-and$b6.fixedCaseId-ceq'ReadContextRepair')
}
function Test-B6PreviewLinkNativeContextCase {
 if(!$PreviewLinkInstall){return $false}
 if(!(Get-Variable b6 -ErrorAction SilentlyContinue)){return $false}
 if(!$b6.PSObject.Properties['fixedCaseId']){return $false}
 if($b6.fixedCaseId-cnotin@('PreviewLink','NativeContext','PreviewRead','ReadContextRepair')){throw 'B6_PREVIEW_LINK_CASE_REJECTED'}
 if($b6.fixedCaseId-ceq'ReadContextRepair'){return Test-B6ReadContextRepairCase}
 return $b6.fixedCaseId-cin@('NativeContext','PreviewRead')
}
function Test-B6PreviewLinkPreviewReadCase {
 return (Test-B6PreviewLinkNativeContextCase)-and$b6.fixedCaseId-ceq'PreviewRead'
}
function Initialize-B6PreviewLinkFixedCase {
 if(!(Test-B6PreviewLinkNativeContextCase)){return}
 if(Test-B6ReadContextRepairCase){
  $case=Get-ErpBusinessSaleReadContextRepairFixedCase
  if($case.id-cne'ReadContextRepair'-or$case.captureHash-cne'6f6a7f567629a05310e3260ab72a7adff2d2fa33eadca8cc6d4c6b07fb95f211'-or$case.recordsHash-cne'fc69404723c6a387411ee2e8bd2f7dce910e7618beb41e1b58651d79bb162caf'-or$case.postExitExclusiveEntryCount-ne44-or$case.runningPid-ne50348-or$case.runningBirth-cne'134378110068801561'-or$case.root-cne$b6.coreRoot-or$case.steadyRoot-cne$b6.steadyRoot){throw 'B6_READ_REPAIR_CASE_CHANGED'}
  $case|Add-Member -NotePropertyMembers @{routerRoot=$b6.routerRoot;predecessorKind='ReadPairRouter';ownerPid=18572;ownerBirth='134378104151292349';childPid=33788;childBirth='134378112314707445';recordHash=$case.recordsHash}
  if($b6.owner.predecessorEntryKind-cne$case.predecessorKind-or$b6.owner.owner.pid-ne$case.ownerPid-or$b6.owner.owner.birth-cne$case.ownerBirth-or$b6.owner.child.pid-ne$case.childPid-or$b6.owner.child.birth-cne$case.childBirth-or$b6.owner.recordBeforeSha256-cne$case.recordHash){throw 'B6_READ_REPAIR_CAPTURE_CHANGED'}
  $b6|Add-Member -NotePropertyName contextCase -NotePropertyValue $case
  return
 }
 # Only a parameterless getter in the held core selects these data pins.
 # These observations never replace a peer, native handle, lease or CAS.
 $case=Get-ErpBusinessSalePackageRefreshFixedCase
 if(Test-B6PreviewLinkPreviewReadCase){
  $pairHash='37400e17acb11f8cccceb600304dda7fedb3ce76543ada07198695edaa964cd3';if($pairHash-isnot[string]-or$pairHash-cnotmatch'\A[a-f0-9]{64}\z'){throw 'B6_PREVIEW_READ_NOT_PREPARED'}
  if($case.id-cne'PreviewRead'-or$case.pairHash-cne$pairHash-or$case.captureHash-cne'4a699552f86bb6e637ddcfa4b653c4ce64633797cfb1474213d4e8780254d88b'-or$case.recordHash-cne'68025a8bc238d2e64d5018a0ef65866bc1c953166343de93f40ea609f2387f36'-or$case.ownerPid-ne39708-or$case.ownerBirth-cne'134378060279382913'-or$case.childPid-ne48876-or$case.childBirth-cne'134378060799417065'-or$case.runningRoot-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030'-or$case.futureRoot-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030'-or$case.runningPid-ne48088-or$case.overlaySource-cne'ed706d37c8a78ad41f314f76029b24dd0e38bc80'){throw 'B6_PREVIEW_READ_CASE_CHANGED'}
 }else{
  if($case.id-cne'NativeContext'-or$case.pairHash-cne'9c35bf28823b280aa49ee1849b6af44f19a7739e98e84269ab32017a368f056c'-or$case.captureHash-cne'a77fce94f29a0f818ccad98d9ddd9f77d81327816cc67e82f8393280d3c90d7b'-or$case.recordHash-cne'31834b4d9fa6eb2b448c430b094851a82a06cd540699ac230e663ee78752adb8'-or$case.ownerPid-ne7768-or$case.ownerBirth-cne'134377907806868351'-or$case.childPid-ne47996-or$case.childBirth-cne'134377915674721676'-or$case.runningRoot-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030'-or$case.futureRoot-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030'-or$case.runningPid-ne42864){throw 'B6_NATIVE_CONTEXT_CASE_CHANGED'}
 }
 if($case.root-cne$b6.coreRoot-or$case.routerRoot-cne$b6.routerRoot-or$case.steadyRoot-cne$b6.steadyRoot-or$case.predecessorKind-cne$(if(Test-B6PreviewLinkPreviewReadCase){'CurrentCore'}else{'ReadPairRouter'})){throw 'B6_NATIVE_CONTEXT_CASE_CHANGED'}
 if($b6.owner.predecessorEntryKind-cne$case.predecessorKind-or$b6.owner.owner.pid-ne$case.ownerPid-or$b6.owner.owner.birth-cne$case.ownerBirth-or$b6.owner.child.pid-ne$case.childPid-or$b6.owner.child.birth-cne$case.childBirth-or$b6.owner.recordBeforeSha256-cne$case.recordHash){throw 'B6_NATIVE_CONTEXT_CAPTURE_CHANGED'}
 $b6|Add-Member -NotePropertyName contextCase -NotePropertyValue $case
}
function New-B6PreviewLinkTaskXml([string]$BeforeXml,[ValidateSet('Silent','Candidate','Rollback')][string]$Mode){
 if($Mode-cnotin@('Silent','Candidate','Rollback')){throw 'B6_PREVIEW_LINK_TASK_MODE_REJECTED'}
 $old='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029\start-owned-test.ps1'
 $silent='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030\start-owned-test.ps1'
 $steady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030\start-owned-test.ps1'
 if(Test-B6PreviewLinkNativeContextCase){$old=Join-Path $b6.contextCase.futureRoot 'start-owned-test.ps1';$silent=Join-Path $b6.contextCase.root 'start-owned-test.ps1';$steady=Join-Path $b6.contextCase.steadyRoot 'start-owned-test.ps1'}
 $from=if($Mode-ceq'Silent'){$old}else{$silent};$to=if($Mode-ceq'Silent'){$silent}elseif($Mode-ceq'Candidate'){$steady}else{$old}
 $doc=[Xml.XmlDocument]::new();$doc.XmlResolver=$null;$doc.PreserveWhitespace=$true;$doc.LoadXml($BeforeXml)
 $ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
 $actions=@($doc.SelectNodes('/t:Task/t:Actions/*',$ns));$command=$doc.SelectSingleNode('/t:Task/t:Actions/t:Exec/t:Command',$ns);$arguments=$doc.SelectSingleNode('/t:Task/t:Actions/t:Exec/t:Arguments',$ns)
 $expected='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$from+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
 if($actions.Count-ne1-or!$command-or!$arguments-or$command.InnerText-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or$arguments.InnerText-cne$expected){throw 'B6_PREVIEW_LINK_TASK_ACTION_CHANGED'}
 $arguments.InnerText=$expected.Replace($from,$to);return $doc.OuterXml
}
function Initialize-B6PreviewLinkTaskPublication {
 if(!$PreviewLinkInstall-or$b6.maintenancePurpose-cne$(if(Test-B6ReadContextRepairCase){'ReadContextRepair'}else{'PreviewLinkPackageRefresh'})-or(Get-Variable PreviewLinkTaskPublication -Scope Script -ErrorAction SilentlyContinue)){throw 'B6_PREVIEW_LINK_TASK_PREPARATION_REQUIRED'}
 $task=Get-Test125ReadPairTask;$xml=[string]$task.Xml;$sddl=[string]$task.GetSecurityDescriptor(7)
 if((Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($xml)))-cne$b6.taskCapture.xmlSha256-or(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($sddl)))-cne$b6.taskCapture.sddlSha256-or$task.Definition.Principal.LogonType-ne3-or$task.Definition.Principal.RunLevel-ne0){throw 'B6_PREVIEW_LINK_TASK_BEFORE_CHANGED'}
 $silent=New-B6PreviewLinkTaskXml $xml Silent
 $script:PreviewLinkTaskPublication=@{phase='Prepared';beforeXml=$xml;silentXml=$silent;candidateXml=(New-B6PreviewLinkTaskXml $silent Candidate);rollbackXml=(New-B6PreviewLinkTaskXml $silent Rollback);sddl=$sddl;registerCalls=0;process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;proof=$b6ReadProof}
}
function Assert-B6PreviewLinkFinalBoundary([ValidateSet('Candidate','Current')][string]$Mode){
 if(!$PreviewLinkInstall-or$Mode-cnotin@('Candidate','Current')-or$b6.maintenancePurpose-cne$(if(Test-B6ReadContextRepairCase){'ReadContextRepair'}else{'PreviewLinkPackageRefresh'})){throw 'B6_PREVIEW_LINK_FINAL_BOUNDARY_REQUIRED'}
 $publication=$script:PreviewLinkTaskPublication
 if($publication.process-ne$PID-or$publication.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or![object]::ReferenceEquals($publication.proof,$b6ReadProof)){throw 'B6_PREVIEW_LINK_TASK_NOT_OWNED'}
 # This is the controller's unbound preflight admission, never the separate
 # owner's transaction admission. The latter becomes Activated/Restored in
 # its own process; no registry/token or post-phase crosses that boundary.
 $proof=Get-ErpReadPairReleaseProofContext $b6ReadProof;$proof.seal.Validate();[void](Assert-ErpBusinessSaleWriterProfileAdmission $b6NativeAdmission -Phase WriterPrepared)
 $native=Get-ErpBusinessSaleNativeAdmissionContext $b6NativeAdmission
 if($native.pid-ne$PID-or$native.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$native.phase-cne'WriterPrepared'-or$null-ne$native.transition){throw 'B6_PACKAGE_REFRESH_CONTROLLER_ADMISSION_REQUIRED'}
 if($publication.ContainsKey('apiNative')){
  $api=$publication.apiNative;[Test125ApiKernel]::ValidateReadOnly($api.kernel,$api.birth)
  $process=Get-ErpProcess $api.pid
  if(!$process-or$process.CreationDate.ToUniversalTime().Ticks-ne$api.birth-or$process.ParentProcessId-ne$api.parent-or[string]$process.ExecutablePath-cne$api.exe-or[string]$process.CommandLine-cne$api.argv){throw 'B6_PREVIEW_LINK_FINAL_API_CHANGED'}
  $rows=@(Get-NetTCPConnection -State Listen -LocalPort 4144 -ErrorAction Stop|Sort-Object LocalPort,LocalAddress,OwningProcess|Select-Object LocalPort,LocalAddress,OwningProcess)
  if(($rows|ConvertTo-Json -Compress)-cne$api.listeners){throw 'B6_PREVIEW_LINK_FINAL_API_LISTENERS_CHANGED'}
 }
 if(Test-B6ReadContextRepairCase){[void](Assert-ErpBusinessSaleReadContextRepairObservation $b6NativeAdmission $Mode)}elseif($native.mode-cne'PackageRefresh'){throw 'B6_PACKAGE_REFRESH_PURPOSE_REQUIRED'}
 $config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json' -PreparedReleaseProof $b6ReadProof;[void](Assert-Test125ReadPairConfig $config $Mode -ScopeName $ScopeName)
 if((Get-FileHash -LiteralPath $expected.startupPath).Hash-ine$expected[$Mode].startup-or(Get-FileHash -LiteralPath $expected.apiPath).Hash-ine$expected[$Mode].api-or(Get-FileHash -LiteralPath $expected.basePath).Hash-ine$expected.baseHash-or$(if(Test-B6ReadContextRepairCase){$expected.Current.api-ceq$expected.Candidate.api-or$expected.Current.startup-cne$expected.Candidate.startup}else{$expected.Current.api-cne$expected.Candidate.api})){throw 'B6_PREVIEW_LINK_FINAL_PROFILE_CHANGED'}
 $s=Owner-Status
 if(!$result.final-or$result.final.mode-cne$(if($Mode-ceq'Candidate'){'Candidate'}else{'Rollback'})-or$s.phase-cne'Running'-or$s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth-or$s.childPid-ne$result.final.childPid-or$s.childBirth-cne$result.final.childBirth){throw 'B6_PREVIEW_LINK_FINAL_OWNER_CHANGED'}
 Assert-OldTarget $s
 $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $health $pins
 $http=Invoke-WebRequest 'http://127.0.0.1:5244/ornek-akis.html' -Method Head -UseBasicParsing -TimeoutSec 10;if($http.StatusCode-ne200){throw 'B6_PREVIEW_LINK_FINAL_WEB_FAILED'}
 Assert-ReadPairProtection
 foreach($entry in $held){if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $entry.stream))-cne$entry.afterHash){throw 'READPAIR_ENTRY_AFTER_CHANGED'}}
}
function Get-B6ProfilePostTransitionPlan([ValidateSet('Current','Candidate')][string]$Mode){
 if(Test-B6ReadContextRepairCase){return Get-Test125ReadContextRepairPostTransitionPlan -Mode $Mode -PreparedReleaseProof $b6ReadProof}
 return Get-Test125PackageRefreshPostTransitionPlan -Mode $Mode -PreparedReleaseProof $b6ReadProof
}
function Complete-B6PreviewLinkTaskPublication([ValidateSet('CandidateVerified','RollbackVerified')][string]$Outcome){
 if(!$PreviewLinkInstall-or$Outcome-cnotin@('CandidateVerified','RollbackVerified')-or!(Get-Variable PreviewLinkTaskPublication -Scope Script -ErrorAction SilentlyContinue)){throw 'B6_PREVIEW_LINK_TASK_PREPARATION_REQUIRED'}
 $p=$script:PreviewLinkTaskPublication;if($p.phase-cne'Prepared'-or$p.registerCalls-ne0){throw 'B6_PREVIEW_LINK_TASK_NO_REPLAY'}
 $mode=if($Outcome-ceq'CandidateVerified'){'Candidate'}else{'Current'}
 Assert-B6PreviewLinkFinalBoundary $mode
 # This last genuine plan still expects the SILENT LINK action. After the
 # future pointer changes, the running engine remains that same instance;
 # never compare it with the new future-start action via the old plan.
 $plan=Get-B6ProfilePostTransitionPlan -Mode $mode
 if($plan.status-cne'POST_TRANSITION_READONLY_NOT_ADMISSION'-or$plan.readOnly-isnot[bool]-or!$plan.readOnly-or$plan.executionAuthority-isnot[bool]-or$plan.executionAuthority){throw 'B6_PREVIEW_LINK_POST_OBSERVATION_REQUIRED'}
 $task=Get-Test125ReadPairTask;$instances=$task.GetInstances(0);$beforeXml=[string]$task.Xml
 if((Get-B6SteadyTaskXmlCanonical $beforeXml)-cne(Get-B6SteadyTaskXmlCanonical $p.silentXml)-or[string]$task.GetSecurityDescriptor(7)-cne$p.sddl-or$instances.Count-ne1-or[int]$instances.Item(1).EnginePID-ne$plan.supervisor-or[string]$instances.Item(1).InstanceGuid-cne$plan.taskInstance-or$task.Definition.Principal.LogonType-ne3-or$task.Definition.Principal.RunLevel-ne0){throw 'B6_PREVIEW_LINK_TASK_BEFORE_CAS_CHANGED'}
 $engine=Get-ErpProcess $plan.supervisor;if(!$engine-or$engine.CreationDate.ToUniversalTime().ToString('o')-cne$plan.supervisorBirth){throw 'B6_PREVIEW_LINK_RUNNING_ENGINE_CHANGED'}
 $sid=Invoke-CimMethod -InputObject $engine -MethodName GetOwnerSid
 $launcher=if(Test-B6PreviewLinkNativeContextCase){Join-Path $b6.contextCase.root 'start-owned-test.ps1'}else{'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030\start-owned-test.ps1'}
 $argv=[string]$engine.CommandLine
 $remaining=[regex]::Replace($argv,('^"?'+[regex]::Escape([string]$engine.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
 $engineArguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$launcher+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
 if($engine.ExecutablePath-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or!(Test-ReadPairOwnerArguments $remaining $engineArguments)-or$sid.ReturnValue-ne0-or$sid.Sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value){throw 'B6_PREVIEW_LINK_RUNNING_ENGINE_CHANGED'}
 Initialize-Test125ApiKernel;$kernel=[Test125ApiKernel]::QueryOnlyOpen([int]$engine.ProcessId,$engine.CreationDate.ToUniversalTime().Ticks);$apiKernel=$null
 try{
  $apiProcess=Get-ErpProcess $plan.children.api.pid;$apiBirth=([datetime]$plan.children.api.birth).ToUniversalTime().Ticks
  if(!$apiProcess-or$apiProcess.CreationDate.ToUniversalTime().Ticks-ne$apiBirth){throw 'B6_PREVIEW_LINK_FINAL_API_CHANGED'}
  $apiKernel=[Test125ApiKernel]::QueryOnlyOpen([int]$apiProcess.ProcessId,$apiBirth)
  $rows=@(Get-NetTCPConnection -State Listen -LocalPort 4144 -ErrorAction Stop|Sort-Object LocalPort,LocalAddress,OwningProcess|Select-Object LocalPort,LocalAddress,OwningProcess)
  if(!$rows.Count-or@($rows|Where-Object OwningProcess -ne $apiProcess.ProcessId).Count){throw 'B6_PREVIEW_LINK_FINAL_API_LISTENERS_CHANGED'}
  $p.apiNative=@{pid=$apiProcess.ProcessId;birth=$apiBirth;parent=$apiProcess.ParentProcessId;exe=[string]$apiProcess.ExecutablePath;argv=[string]$apiProcess.CommandLine;listeners=($rows|ConvertTo-Json -Compress);kernel=$apiKernel}
  $afterXml=if($mode-ceq'Candidate'){$p.candidateXml}else{$p.rollbackXml}
  $service=New-Object -ComObject Schedule.Service;$service.Connect();$folder=$service.GetFolder('\')
  Assert-B6PreviewLinkFinalBoundary $mode
  $again=Get-Test125ReadPairTask;$againInstances=$again.GetInstances(0)
  if([string]$again.Xml-cne$beforeXml-or[string]$again.GetSecurityDescriptor(7)-cne$p.sddl-or$againInstances.Count-ne1-or$againInstances.Item(1).InstanceGuid-cne$plan.taskInstance-or[int]$againInstances.Item(1).EnginePID-ne$plan.supervisor){throw 'B6_PREVIEW_LINK_TASK_BEFORE_CAS_CHANGED'}
  [Test125ApiKernel]::ValidateReadOnly($kernel,$engine.CreationDate.ToUniversalTime().Ticks)
  $p.phase='Attempted';$p.registerCalls=1
  try{[void]$folder.RegisterTask('Melisa-ERP-TEST-Canonical',$afterXml,52,$task.Definition.Principal.UserId,$null,3,$null)}catch{}
  $after=Get-Test125ReadPairTask;$afterInstances=$after.GetInstances(0)
  if((Get-B6SteadyTaskXmlCanonical ([string]$after.Xml))-cne(Get-B6SteadyTaskXmlCanonical $afterXml)-or[string]$after.GetSecurityDescriptor(7)-cne$p.sddl-or$afterInstances.Count-ne1-or$afterInstances.Item(1).InstanceGuid-cne$plan.taskInstance-or[int]$afterInstances.Item(1).EnginePID-ne$plan.supervisor){throw 'B6_PREVIEW_LINK_TASK_UPDATE_UNCONFIRMED'}
  [Test125ApiKernel]::ValidateReadOnly($kernel,$engine.CreationDate.ToUniversalTime().Ticks)
  $fresh=Get-ErpProcess $plan.supervisor;if(!$fresh-or$fresh.CreationDate-ne$engine.CreationDate-or[string]$fresh.CommandLine-cne$argv){throw 'B6_PREVIEW_LINK_RUNNING_ENGINE_CHANGED'}
  Assert-B6PreviewLinkFinalBoundary $mode
  $p.phase='Verified';$result.futureTaskActionVerified=$true;$result.futureTaskActionMode=$mode;$result.futureTaskRegistrationCalls=1;$result.physicalRebootTested=$false
 }finally{if($apiKernel){$apiKernel.Dispose()};$kernel.Dispose()}
}
function Initialize-B6WebOnlyControllerPreflight {
 [void](Get-B6WebOnlyExpectedProjection)
 Initialize-Test125ApiKernel
 if(Get-Variable WebOnlyApiHandle -Scope Script -ErrorAction SilentlyContinue){throw 'B6_WEBONLY_PREFLIGHT_ALREADY_ATTEMPTED'}
 $script:WebOnlyApiHandle=[Test125ApiKernel]::QueryOnlyOpen([int]$b6.apiBoundary.apiPid,[DateTime]::FromFileTimeUtc([long]$b6.apiBoundary.apiBirth).Ticks)
 Assert-B6WebOnlyApiBoundary
 # Both immutable web payloads are verified before the old owner exits. API,
 # profile, task and native SQL constructors are deliberately not part of this.
 $script:WebOnlyPackageSeal=[Business5244PackageSeal]::new()
 try{foreach($mode in $(if($SteadyStartupInstall){@('Current')}else{@('Current','Candidate')})){$package=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode $mode;Assert-Business5244OwnedPackage $package $script:WebOnlyPackageSeal};$script:WebOnlyPackageSeal.Freeze();$script:WebOnlyPackageSeal.Validate()}catch{$script:WebOnlyPackageSeal.Dispose();throw}
 Assert-B6WebOnlyApiBoundary
 if($SteadyStartupInstall){Initialize-B6SteadyTaskPublication}
}
function Initialize-B6ReadPairControllerPreflight {
 if($WebOnlyRefreshInstall){Initialize-B6WebOnlyControllerPreflight;return}
 if($PreviewLinkInstall){Initialize-B6PreviewLinkFixedCase}
 # Constructor and immutable release proof are native issued in THIS process.
 # They are never serialized/transferred to the replacement owner. Its own
 # independent admission is still required before it publishes a nonce.
 $activeScope=if($WriterInstall-or$PreviewLinkInstall){'TEST125-API-B6-WRITER-20261029'}else{'TEST125-API-B6-ca620bac-20261028'}
 $config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $script:b6NativeAdmission=if(Test-B6ReadContextRepairCase){New-ErpBusinessSaleReadContextRepairAdmission $config}elseif($PreviewLinkInstall){New-ErpBusinessSalePackageRefreshAdmission $config}elseif($WriterInstall){New-ErpBusinessSaleWriterProfileAdmission $config}else{New-ErpBusinessSaleNativeProfileAdmission $config}
 if($PreviewLinkInstall){$purpose=Get-ErpBusinessSaleNativeAdmissionContext $script:b6NativeAdmission;$mode=if(Test-B6ReadContextRepairCase){'ReadContextRepair'}else{'PackageRefresh'};$label=if(Test-B6ReadContextRepairCase){'ReadContextRepair'}else{'PreviewLinkPackageRefresh'};if($purpose.mode-cne$mode-or$purpose.ownerInputs.maintenancePurpose-cne$label){throw 'B6_PACKAGE_REFRESH_PURPOSE_REQUIRED'}}
 if($WriterInstall){$purpose=Get-ErpBusinessSaleNativeAdmissionContext $script:b6NativeAdmission;if($purpose.mode-cne'WriterProfileActivation'-or$purpose.ownerInputs.maintenancePurpose-cne'WriterProfileActivation'){throw 'B6_WRITER_PROFILE_PURPOSE_REQUIRED'}}
 if($CandidateInstall){$purpose=Get-ErpBusinessSaleNativeAdmissionContext $script:b6NativeAdmission;if($purpose.rehearsalOnly-isnot[bool]-or$purpose.rehearsalOnly-or$purpose.ownerInputs.maintenancePurpose-cne'CandidateMetadataApply'){throw 'B6_CANDIDATE_NATIVE_PURPOSE_REQUIRED'}}
 if($WriterInstall-or$PreviewLinkInstall){[void](Assert-ErpBusinessSaleWriterProfileAdmission $script:b6NativeAdmission -Phase WriterPrepared)}else{[void](Assert-ErpBusinessSaleNativeProfileAdmission $script:b6NativeAdmission -Phase Prepared)}
 $script:b6ReadProof=New-ErpReadPairPreparedReleaseProof $config -ScopeName $activeScope -NativeProfileAdmission $script:b6NativeAdmission
 [void](Get-Test125BoundMaintenancePlan -RunId $activeScope -ReadPairPreparation -ReadPairMode Current -PreparedReleaseProof $script:b6ReadProof)
 [void](Get-ReadPairExpectedHashes -ScopeName $activeScope -NativeProfileAdmission $script:b6NativeAdmission)
 if($PreviewLinkInstall){Initialize-B6PreviewLinkTaskPublication}
}
function Open-B6ReadPairPublication {
 # READ2b entries already contain the accepted global gate. Hold current
 # bytes; B6 never rewrites a legacy entry or replays its old projection.
 $capture=$b6.entryCapture
 $captureSchema=if($WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){'melisa-b6-writer-current-entry-capture.v1'}elseif($CandidateInstall){'melisa-b6-candidate-current-entry-capture.v1'}elseif($RehearsalOnly){'melisa-b6-rehearsal-current-entry-capture.v1'}else{'melisa-b6-current-entry-hold-capture.v1'};$directCount=if($PreviewLinkInstall){23}elseif($SteadyStartupInstall){22}elseif($WebOnlyRefreshInstall){20}elseif($WriterInstall){18}elseif($CandidateInstall){14}elseif($RehearsalOnly){12}else{8};$ownerHash=if($PreviewLinkInstall){'124e207b8ab0f8f6a5b3b8227c7183c17b69f2f2725b2837b2dc1bc81410c74b'}elseif($SteadyStartupInstall){'62d3882ceef3caf71a263ad51e036453eee2d59dbe871b8ccd2a03f3ad9756f8'}elseif($WebOnlyRefreshInstall){'e480d77c835f3c2170589b9fbafec6da78dd2a19624d486d8822ad7b930d3a09'}elseif($WriterInstall){'50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65'}elseif($CandidateInstall){'3f7d2484310246df0b01d8b1692d16fdfc70b75a4545c0344bcb941118110642'}elseif($RehearsalOnly){'2f066cc82af4fe23337a3469091aad40d6d065a66af72f60db34f2e16152c364'}else{'4eaa68d16be5260071f74ce7e41e33ce6adaa4c7097d661905968d4b5c1b9945'}
 if(Test-B6PreviewLinkNativeContextCase){$directCount=26;$ownerHash='a77fce94f29a0f818ccad98d9ddd9f77d81327816cc67e82f8393280d3c90d7b'}
 if(Test-B6PreviewLinkPreviewReadCase){$directCount=32;$ownerHash='4a699552f86bb6e637ddcfa4b653c4ce64633797cfb1474213d4e8780254d88b'}
 if(Test-B6ReadContextRepairCase){$directCount=38;$ownerHash='6f6a7f567629a05310e3260ab72a7adff2d2fa33eadca8cc6d4c6b07fb95f211'}
 if($capture.schema-cne$captureSchema-or$capture.readOnly-ne$true-or$capture.executionAuthority-ne$false-or$capture.entries.Count-ne6-or$capture.directEntries.Count-ne$directCount-or$capture.entryWrites-ne0-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.ownerCaptureSha256-cne$ownerHash-or$capture.gate.path-cne'C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\business-5244-startup-exclusion-ec316a63.ps1'-or$capture.gate.sha256-cne'a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'){throw 'B6_ENTRY_HOLD_CAPTURE_CHANGED'}
 $paths=@('start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'|ForEach-Object {Join-Path $pins.runtime $_})+@('C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1')
 if(($capture.entries.path-join'|')-cne($paths-join'|')){throw 'B6_ENTRY_HOLD_SCOPE_CHANGED'}
 $direct=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-READ2B-ROUTER-b9416929-20261028\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-OWNER-b9416929-20261028\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261028\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261028\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029\run-current-owner.ps1')
 if(!$RehearsalOnly-and!$CandidateInstall-and!$WriterInstall-and!$WebOnlyRefreshInstall-and!$PreviewLinkInstall){$direct+=@((Join-Path $b6.owner.router.root 'start-business-5244-readpair-router.ps1'),(Join-Path $b6.owner.core.root 'run-current-owner.ps1'))}
 if($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){
  $direct=@($direct|Select-Object -First 6)+@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-HASHCASE\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-SQLCOLLATION\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029\run-current-owner.ps1')
  if($CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3\start-business-5244-readpair-router.ps1')}
  if($WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY\start-business-5244-readpair-router.ps1')}
  if($WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029\start-business-5244-readpair-router.ps1')}
  if($WebOnlyRefreshInstall-or$PreviewLinkInstall){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2\start-business-5244-readpair-router.ps1')}
  if($SteadyStartupInstall-or$PreviewLinkInstall){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029\start-business-5244-readpair-router.ps1')}
  if($PreviewLinkInstall){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029\run-current-owner.ps1')}
  if(Test-B6PreviewLinkNativeContextCase){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-ROUTER-20261030\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030\run-current-owner.ps1')}
  if((Test-B6PreviewLinkPreviewReadCase)-or(Test-B6ReadContextRepairCase)){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-ROUTER-20261030\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030\run-current-owner.ps1');$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-VERIFIED-ROUTER-20261030\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-VERIFIED-OWNER-20261030\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-VERIFIED-STEADY-OWNER-20261030\run-current-owner.ps1')}
 if(Test-B6ReadContextRepairCase){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-ROUTER-20261030\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-OWNER-20261030\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-STEADY-OWNER-20261030\run-current-owner.ps1')}
 if(Test-B6ReadContextRepairCase){$direct+=@('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-ROUTER-20261030\start-business-5244-readpair-router.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-OWNER-20261030\run-current-owner.ps1','C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ARRAY-REPAIR-STEADY-OWNER-20261030\run-current-owner.ps1')}
 $postExitCount=if(Test-B6ReadContextRepairCase){44}elseif(Test-B6PreviewLinkPreviewReadCase){38}elseif(Test-B6PreviewLinkNativeContextCase){32}elseif($PreviewLinkInstall){29}elseif($SteadyStartupInstall){28}elseif($WebOnlyRefreshInstall){26}elseif($WriterInstall){24}elseif($CandidateInstall){20}else{18}
  if($capture.runtimeValidationComplete-ne$false-or$b6.owner.entry.postExitExclusiveBytesRequired-ne$true-or$b6.owner.entry.runtimeEntryBytesVerified-ne$false-or$capture.postExitExclusiveEntryCount-ne$postExitCount){throw 'B6_ENTRY_RUNTIME_PROOF_REQUIRED'}
 }
 if(($capture.directEntries.path-join'|')-cne($direct-join'|')){throw 'B6_DIRECT_ENTRY_SCOPE_CHANGED'}
 $script:before=Protection-Snapshot;$result.before=$before
 if(($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall)-and(Get-ReadPairProtectionSignature $before)-cne(Get-ReadPairProtectionSignature $b6.owner.protectedSnapshot)){throw 'B6_REHEARSAL_PROTECTION_DRIFT'}
 $script:expected=if($WebOnlyRefreshInstall){Get-B6WebOnlyExpectedProjection}else{Get-ReadPairExpectedHashes -ScopeName $ScopeName -NativeProfileAdmission $b6NativeAdmission};$result.expected=$expected
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
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){Open-B6ReadPairPublication;return}
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
 if($PreviewLinkInstall){
  $plan=Get-Test125BoundMaintenancePlan -RunId $ScopeName -ReadPairPreparation -ReadPairMode Current -PreparedReleaseProof $b6ReadProof
  $apiPids=@($b6.owner.protectedSnapshot.listeners|Where-Object LocalPort -eq 4144|Select-Object -ExpandProperty OwningProcess -Unique)
  if($apiPids.Count-ne1-or$plan.children.api.pid-ne$apiPids[0]){throw 'B6_PREVIEW_LINK_API_BEFORE_CHANGED'}
 }
 $script:status=Owner-Status;Assert-OldTarget $status
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-and(Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_CURRENT_RECORD_CHANGED_BEFORE_STOP'}
 if($AfterLoaderRecovery-and($status.ownerPid-ne$coldRecovery.newOwnerPid-or$status.ownerBirth-cne$coldRecovery.newOwnerBirth-or$status.childPid-ne$coldRecovery.childPid-or$status.childBirth-cne$coldRecovery.childBirth)){throw 'READPAIR_COLD_RECOVERY_GENERATION_CHANGED'}
 $script:oldResourceRows=@(Web-Resources $status);$script:webResources=$oldResourceRows
 $c=Connect-Business5244RetirementPeer
 try{if($c.serverPid-ne$status.ownerPid-or$c.serverBirth-cne$status.ownerBirth){throw 'READPAIR_OLD_PEER_CHANGED'};$r=Get-Business5244RetirementRecord $c -Client;$script:control=$r.peer.OpenControlledShutdown();if($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){$script:ReadPairExitObservation=$r.peer.OpenExitObservation()}}finally{Close-Business5244RetirementPeer $c}
 Assert-OldTarget $status
 if((Web-Resources $status|ConvertTo-Json -Depth 5 -Compress)-cne($oldResourceRows|ConvertTo-Json -Depth 5 -Compress)){throw 'READPAIR_OLD_RESOURCES_CHANGED'}
 Assert-ReadPairProtection;$control.Validate()
 Hold-B6ReadPairActiveEntry
}
function Read-B6ReadPairManagedExitSignal {return [Console]::ReadLine()}
function Invoke-B6ReadPairManagedOwnerExit {
 # The console signal is NOT authority. It only ends a wait after the normal
 # Microsoft debugger quit. Two retained native handles then prove the exit;
 # the SAME pre-existing mutex must pass standard non-abandoned acquisition.
 if((!$RehearsalOnly-and!$CandidateInstall-and!$WriterInstall-and!$WebOnlyRefreshInstall-and!$PreviewLinkInstall)-or$ScopeName-cnotin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-or($RehearsalOnly-and!$b6.rehearsalOnly)-or($CandidateInstall-and($b6.rehearsalOnly-isnot[bool]-or$b6.rehearsalOnly-or$b6.maintenancePurpose-cne'CandidateMetadataApply'))-or($WriterInstall-and($b6.rehearsalOnly-isnot[bool]-or$b6.rehearsalOnly-or$b6.maintenancePurpose-cne'WriterProfileActivation'))-or!($script:ReadPairExitObservation-is[Business5244RetirementPeer+ExitObservation])){throw 'B6_MANAGED_EXIT_ADMISSION_REQUIRED'}
 $control.Validate();Assert-OldTarget $status
 if($WebOnlyRefreshInstall-and($b6.maintenancePurpose-cne$(if($SteadyStartupInstall){'WebOnlySteadyStartup'}else{'WebOnlyFrontendRefresh'})-or$b6.rehearsalOnly-isnot[bool]-or$b6.rehearsalOnly)){throw 'B6_WEBONLY_PURPOSE_REQUIRED'}
 if($PreviewLinkInstall-and($b6.maintenancePurpose-cne$(if(Test-B6ReadContextRepairCase){'ReadContextRepair'}else{'PreviewLinkPackageRefresh'})-or$b6.rehearsalOnly-isnot[bool]-or$b6.rehearsalOnly)){throw 'B6_PACKAGE_REFRESH_PURPOSE_REQUIRED'}
 if($script:ReadPairExitObservation.TargetPid-ne$control.TargetPid-or$script:ReadPairExitObservation.TargetBirth-cne$control.TargetBirth-or$script:ReadPairExitObservation.Observe()){throw 'B6_MANAGED_EXIT_GENERATION_CHANGED'}
 $handoff=Get-B6ReadPairActiveHandoff
 if(!$handoff-or$handoff.phase-cne'Shared'-or$handoff.stopAttempted){throw 'B6_MANAGED_EXIT_MARKER_REQUIRED'}
 $handoff.marker.Validate();Assert-B6ReadPairEntrySet -AllowActiveShared;Assert-ReadPairProtection
 if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_CURRENT_RECORD_CHANGED_BEFORE_STOP'}
 # OpenExisting retains this exact kernel object before the old owner exits.
 # An abandoned acquisition is never accepted, drained, or retried.
 $script:ReadPairPreheldMutex=[Threading.Mutex]::OpenExisting((Get-Business5244StartupMutexName))
 try{$free=$script:ReadPairPreheldMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$script:ReadPairPreheldMutex.ReleaseMutex();throw 'BUSINESS_5244_ABANDONED_OWNER'}
 if($free){$script:ReadPairPreheldMutex.ReleaseMutex();throw 'B6_MANAGED_EXIT_LIVE_MUTEX_NOT_HELD'}
 $control.Validate();$handoff.marker.Validate()
 $handoff.stopAttempted=$true
 Record-Phase 'B6_MANAGED_EXIT_WAITING_FOR_NORMAL_DEBUGGER_Q'
 [Console]::WriteLine(([ordered]@{phase='B6_MANAGED_EXIT_READY';ownerPid=$control.TargetPid;ownerBirth=$control.TargetBirth;runspace=1;normalDebuggerQuitOnly=$true;stopCalls=0}|ConvertTo-Json -Compress));[Console]::Out.Flush()
 if((Read-B6ReadPairManagedExitSignal)-cne'MANAGED_EXIT_OBSERVED'){throw 'B6_MANAGED_EXIT_SIGNAL_NOT_RECEIVED'}
 $script:ReadPairExitObservation.ValidateExited();$control.CompleteManagedExit($script:ReadPairExitObservation)
 $control.ValidateCompletedStop();$handoff.marker.Validate()
 $result.managedExitRequests=1
}
function Stop-ReadPairColdOwner {
 if(Get-B6ReadPairActiveEntry){$handoff=Get-B6ReadPairActiveHandoff;if(!$handoff-or$handoff.phase-cne'Shared'){throw 'B6_ACTIVE_ENTRY_HANDOFF_MISSING'};$control.Validate();$handoff.marker.Validate();Assert-B6ReadPairEntrySet -AllowActiveShared;if(!$RehearsalOnly-and!$CandidateInstall-and!$WriterInstall-and!$WebOnlyRefreshInstall-and!$PreviewLinkInstall){$handoff.stopAttempted=$true}}
 if($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){Invoke-B6ReadPairManagedOwnerExit}else{$control.Stop();$result.stopCalls++}
 if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'READPAIR_OLD_RESOURCES_NOT_EXITED'}
 Complete-B6ReadPairActiveEntryHandoff
 Record-Phase 'COLD_OWNER_EXITED'
}
function Start-ReadPairPreparedOwner {
 Assert-B6ReadPairEntryHandoffReady
 $script:ready=Start-Frozen $newRoot $newHash $(if($SteadyStartupInstall){'steady'}else{'candidate'})
 $script:newResourceRows=@(Web-Resources $ready)
}
function Assert-ReadPairPreparedOwner {
 $s=Owner-Status
 if($s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth-or$s.childPid-ne$ready.childPid-or$s.childBirth-cne$ready.childBirth){throw 'READPAIR_PREPARED_PEER_CHANGED'}
 Assert-ReadPairProtection
 if(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath)){throw 'READPAIR_PENDING_ALREADY_EXISTS'}
 $h=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $h $pins
 if($WebOnlyRefreshInstall){
  Assert-B6WebOnlyApiBoundary;$fresh=Get-B6WebOnlyExpectedProjection;if($fresh.planHash-cne$expected.planHash){throw 'B6_WEBONLY_PLAN_CHANGED'}
  if($SteadyStartupInstall){
   Assert-B6ReadPairCurrentRecoveryRecord $s -Router
   $http=Invoke-WebRequest 'http://127.0.0.1:5244/ornek-akis.html' -Method Head -UseBasicParsing -TimeoutSec 10
   if($http.StatusCode-ne200){throw 'B6_STEADY_WEB_HTTP_FAILED'}
   $result.final=@{mode='Steady';ownerPid=$s.ownerPid;ownerBirth=$s.ownerBirth;childPid=$s.childPid;childBirth=$s.childBirth;apiPackage=$h.packageId;webPackage=$pins.package;webHttp=200;recordRowsPreserved=$true;observation='READONLY_FRESH_STEADY_STATE_NOT_PRIVATE_TOKEN'}
  }
  return
 }
 $fresh=if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){Get-ReadPairExpectedHashes -ScopeName $ScopeName -NativeProfileAdmission $b6NativeAdmission}else{Get-ReadPairExpectedHashes}
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
    $chosen=if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode $(if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'})}elseif($c.mode-ceq'Candidate'){Get-Business5244ReadPairPins}else{Get-Business5244WebPins}
    if($c.package-cne$chosen.package-or$c.manifest-cne$chosen.manifest-or$c.planHash-cne$expected.planHash){throw 'READPAIR_ARCHIVE_PAIR_CHANGED'}
    $record=[IO.File]::ReadAllBytes('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json')
    if((Get-Business5244StartupHash $record)-cne$c.recordsHash){throw 'READPAIR_RECORD_HASH_CHANGED'}
    Assert-Business5244RecordStage (ConvertFrom-Business5244RecordBytes $old) (ConvertFrom-Business5244RecordBytes $record) $s.childPid $c.mode $chosen
    if($WebOnlyRefreshInstall){Assert-B6WebOnlyApiBoundary}elseif($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){$config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json' -PreparedReleaseProof $b6ReadProof;[void](Assert-Test125ReadPairConfig $config $(if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}) -ScopeName $ScopeName)}else{$config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json';[void](Assert-Test125ReadPairConfig $config $(if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}))}
    $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $health $chosen
    $mode=if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}
    if(!$WebOnlyRefreshInstall){
     if((Get-FileHash -LiteralPath $expected.startupPath).Hash-ine$expected[$mode].startup-or(Get-FileHash -LiteralPath $expected.apiPath).Hash-ine$expected[$mode].api-or(Get-FileHash -LiteralPath $expected.basePath).Hash-ine$expected.baseHash){throw 'READPAIR_FINAL_PROFILE_OR_CONFIG_CHANGED'}
     $apiProof=if($PreviewLinkInstall){Get-B6ProfilePostTransitionPlan -Mode $mode}elseif($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){Get-Test125BoundMaintenancePlan -RunId $ScopeName -ReadPairPreparation -ReadPairMode $mode -PreparedReleaseProof $b6ReadProof}else{Get-Test125BoundMaintenancePlan -RunId (Get-Test125ReadPairScope).name -ReadPairPreparation -ReadPairMode $mode}
     if($PreviewLinkInstall-and($apiProof.status-cne'POST_TRANSITION_READONLY_NOT_ADMISSION'-or$apiProof.readOnly-isnot[bool]-or!$apiProof.readOnly-or$apiProof.executionAuthority-isnot[bool]-or$apiProof.executionAuthority)){throw 'B6_PREVIEW_LINK_POST_OBSERVATION_REQUIRED'}
     if($apiProof.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'){throw 'READPAIR_FINAL_API_DATABASE_CHANGED'}
    }
    # This is independent final-state readback, never a reconstructed owner
    # token or a claim that its private Dispatch.Completed state was observed.
    $script:pins=$chosen;$script:oldRoot=$newRoot;$script:oldHash=$newHash
    Assert-OldTarget $s
    $web=@(Web-Resources $s);$http=Invoke-WebRequest 'http://127.0.0.1:5244/ornek-akis.html' -Method Head -UseBasicParsing -TimeoutSec 10
    if($http.StatusCode-ne200){throw 'READPAIR_WEB_HTTP_FAILED'};Assert-ReadPairProtection
    $result.final=@{mode=$c.mode;ownerPid=$s.ownerPid;ownerBirth=$s.ownerBirth;childPid=$s.childPid;childBirth=$s.childBirth;archiveSha256=(Get-FileHash $files[0].FullName).Hash;planHash=$c.planHash;apiPackage=$health.packageId;webPackage=$chosen.package;webHttp=200;observation='READONLY_FINAL_STATE_NOT_PRIVATE_TOKEN'}
    return $(if($c.mode-ceq'Candidate'){'CandidateVerified'}else{'RollbackVerified'})
   }
  }catch{if($_.Exception.Message-cmatch'^READPAIR_(?:ARCHIVE|FINAL_PEER|FINAL_OWNER|RECORD|PROTECTION)'-or($WebOnlyRefreshInstall-and$_.Exception.Message-cmatch'^B6_WEBONLY_')){throw}}
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
function Assert-B6ReadPairCurrentRecoveryRecord($Status,[switch]$Router){
 $oldRoot=if($Router){$b6.routerRoot}else{$b6.coreRoot};$oldHash=if($Router){$b6.routerHash}else{$b6.coreHash};Assert-OldTarget $Status
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
  if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
   $verifiedInitializationExit=$newHost-is[Diagnostics.Process]-and[object]::ReferenceEquals($newHost,$script:b6InitializationExitProcess)-and$newHost.HasExited-and$newHost.ExitCode-eq73
  }
  if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-and$newHost-and!$newHost.HasExited){
   Assert-B6ReadPairRecoveryOwner
   if($RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall){
    # A prepared, healthy Current owner already published its own bootstrap.
    # Preserve it rather than killing it or externally rewriting its record.
    $s=Owner-Status
    Assert-B6ReadPairCurrentRecoveryRecord $s -Router
    if($WebOnlyRefreshInstall){Assert-B6WebOnlyApiBoundary}else{[void](Get-Test125BoundMaintenancePlan -RunId $ScopeName -ReadPairPreparation -ReadPairMode Current -PreparedReleaseProof $b6ReadProof)}
    $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $health $pins
    Assert-ReadPairProtection
    Record-Phase 'PRE_RETIRE_HEALTHY_CURRENT_RETAINED'
    return
   }
   # Keep a healthy Current owner alive when it already owns a published
   # bootstrap. An external Process.Kill cannot perform its native inverse.
   if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_PRE_RETIRE_BOOTSTRAP_RECOVERY_REQUIRED'}
  }
  if($newHost-and!$newHost.HasExited){$newHost.Kill();[void]$newHost.WaitForExit(15000)}
  if($newHost-and(!$newResourceRows.Count-or!(Wait-ResourceExit $newResourceRows))-and!$verifiedInitializationExit){throw 'READPAIR_NEW_RESOURCES_RECOVERY_REQUIRED'}
  if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'READPAIR_RECOVERY_PORT_NOT_EMPTY'}
  if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
   # A published bootstrap is not raw before-image authority. Until the
   # native-owned bootstrap inverse is proved, leave uncertain metadata alone.
   if((Get-FileHash -LiteralPath 'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json').Hash-ine$b6.owner.recordBeforeSha256){throw 'B6_PRE_RETIRE_BOOTSTRAP_RECOVERY_REQUIRED'}
   Assert-ReadPairProtection
   $script:ready=Start-Frozen $b6.coreRoot $b6.coreHash 'rollback'
  }else{$script:ready=Start-Frozen $oldRoot $oldHash 'rollback'}
  $s=Owner-Status
  if($s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth-or$s.childPid-ne$ready.childPid-or$s.childBirth-cne$ready.childBirth){throw 'READPAIR_COLD_ROLLBACK_NOT_CONFIRMED'}
  if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
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
 foreach($name in @('ReadPairExitObservation','ReadPairPreheldMutex')){if(Get-Variable $name -Scope Script -ErrorAction SilentlyContinue){$resource=Get-Variable $name -Scope Script -ValueOnly;if($resource){$resource.Dispose();Set-Variable $name -Scope Script -Value $null}}}
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  if($b6ReadProof){Close-ErpReadPairReleaseProof $b6ReadProof;$script:b6ReadProof=$null}
  foreach($stream in $script:b6SourceHandles){$stream.Dispose()}
 }
}
function Read-Business5244CurrentSupersessionCaseFile([string]$Leaf,[string]$Sha256){
 $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\current-only-supersession-20261029'
 $allowed=@('supersession-fixed-case.json','protected-boundary.json','oldpending.before.bin','oldrecord.before.json','current-entry-hold-capture.json')
 if($InitializerCleanRecovery){$root=Join-Path $root 'initializer-clean-20261029';$allowed=@('initializer-fixed-case.json','initializer.pending.before.json','records.before.json','entry-hold-capture.json','protected-boundary.json','original-retirement.before.bin')}
 if($Leaf-cnotin$allowed-or$Sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'CURRENT_SUPERSESSION_CASE_INPUT_REJECTED'}
 $path=Join-Path $root $Leaf
 for($part=$path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'CURRENT_SUPERSESSION_INPUT_REPARSE'}}
 $bytes=[IO.File]::ReadAllBytes($path)
 if((Get-Business5244StartupHash $bytes)-cne$Sha256){throw 'CURRENT_SUPERSESSION_CASE_CHANGED'}
 return ,$bytes
}
function Get-Business5244CurrentSupersessionFixedInputs {
 # Frozen observations are DATA only. The state factory additionally requires
 # a genuine retained native exit observer, a fresh non-abandoned OS lease,
 # exclusive live-file CAS and independent Current API / SQL Before checks.
 if($InitializerCleanRecovery){return Get-Business5244InitializerCleanFixedInputs}
 $caseBytes=Read-Business5244CurrentSupersessionCaseFile 'supersession-fixed-case.json' '8965df723ec4bdbbd12360129d54aab47484d67ad76d8c42f4ec7c7b67c6caf8'
 $boundaryBytes=Read-Business5244CurrentSupersessionCaseFile 'protected-boundary.json' 'a0edcc36f31103db37ae90ec3727ecd1f450eeb8bac1714c442b678cbfd45a3e'
 $before=Read-Business5244CurrentSupersessionCaseFile 'oldrecord.before.json' '3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74'
 $pendingBefore=Read-Business5244CurrentSupersessionCaseFile 'oldpending.before.bin' '7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab'
 $entryBytes=Read-Business5244CurrentSupersessionCaseFile 'current-entry-hold-capture.json' '311b3facefe4aa9c0e0629a1fe5ca2e87d11e04f2562a3a237a51be54c116a55'
 $c=[Text.Encoding]::UTF8.GetString($caseBytes)|ConvertFrom-Json;$b=[Text.Encoding]::UTF8.GetString($boundaryBytes)|ConvertFrom-Json;$e=[Text.Encoding]::UTF8.GetString($entryBytes)|ConvertFrom-Json
 if($c.schema-cne'melisa-5244-current-supersession-case.v1'-or$c.readOnly-ne$true-or$c.executionAuthority-ne$false-or$c.target.pid-ne48212-or$c.target.birth-cne'134377121934062288'-or$c.target.sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$c.pending.path-cne(Get-Business5244RetirementPendingPath)-or$c.pending.sha256-cne'7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab'-or$c.record.path-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'-or$c.record.sha256-cne'3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74'-or$c.record.actualRecordRead-ne$false-or$c.stopCalls-ne0-or$c.recordWrites-ne0-or$c.sqlWrites-ne0-or$c.serviceCalls-ne0){throw 'CURRENT_SUPERSESSION_CASE_SCOPE_CHANGED'}
 if($b.schema-cne'melisa-5244-current-supersession-boundary.v1'-or$b.readOnly-ne$true-or$b.executionAuthority-ne$false-or$b.caseSha256-cne'8965df723ec4bdbbd12360129d54aab47484d67ad76d8c42f4ec7c7b67c6caf8'-or$b.writes-ne0-or$b.sqlCalls-ne0-or$b.serviceCalls-ne0-or$c.entryCaptureSha256-cne'311b3facefe4aa9c0e0629a1fe5ca2e87d11e04f2562a3a237a51be54c116a55'-or$e.entries.Count-ne6-or$e.directEntries.Count-ne10-or$e.executionAuthority-ne$false-or$e.entryWrites-ne0){throw 'CURRENT_SUPERSESSION_BOUNDARY_SCOPE_CHANGED'}
 $pins=Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Current
 if($pins.apiManifest-ine$c.current.apiManifest-or$pins.manifest-ine$c.current.webManifest-or$c.current.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or$c.current.server-cne'Semih\MELISADEV'){throw 'CURRENT_SUPERSESSION_CURRENT_TARGET_CHANGED'}
 $entries=@(foreach($row in $e.entries){[pscustomobject]@{path=$row.path;hash=$row.beforeSha256}})+@(foreach($row in $e.directEntries){[pscustomobject]@{path=$row.path;hash=$row.sha256}})
 return [pscustomobject]@{schema='business-5244-current-supersession-inputs.v1';caseId='CURRENT-ONLY-5244-SUPERSESSION-20261029';scopeName='TEST125-API-B6-ca620bac-20261028';ownerPid=48212;ownerBirth='134377121934062288';recordsPath=$c.record.path;recordsHash=$c.record.sha256;originalBeforeHash=$c.record.sha256;pendingPath=$c.pending.path;pendingHash=$c.pending.sha256;archiveRoot='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\current-only-supersession-20261029\bootstrap-evidence';beforeBytes=$before;pendingBeforeBytes=$pendingBefore;pins=$pins;currentPins=$pins;entries=$entries;entrySeals=$entries;gateSeal=([pscustomobject]@{path=$e.gate.path;hash=$e.gate.sha256});case=$c;boundary=$b}
}
function Get-Business5244InitializerCleanFixedInputs {
 # This is expected immutable DATA, not an Undo ACK or a new owner grant.
 # The native observer, original mutex generation, post-exit live CAS and
 # Current boundary must all pass independently before any file mutation.
 $caseBytes=Read-Business5244CurrentSupersessionCaseFile 'initializer-fixed-case.json' '854d7b2e37e04eacf2c586dc195d50712255dd454e43918a2c4f7153451f3ce3'
 $boundaryBytes=Read-Business5244CurrentSupersessionCaseFile 'protected-boundary.json' 'c737aedba3efd5e270f48a38cc84afd3e5080fe2b59c7c72e4c7245a940d15ff'
 $before=Read-Business5244CurrentSupersessionCaseFile 'records.before.json' '3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74'
 $pendingBefore=Read-Business5244CurrentSupersessionCaseFile 'initializer.pending.before.json' '5891a78ce6f5811cc443ce6fa0b1f894c53f12d63b426955e8aa008ac7bf23b4'
 $entryBytes=Read-Business5244CurrentSupersessionCaseFile 'entry-hold-capture.json' '7b93d26f5b927088921d577d6c4bee6856dc15efb5aac47aaf59aef6cb8bb854'
 $original=Read-Business5244CurrentSupersessionCaseFile 'original-retirement.before.bin' '7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab'
 $c=[Text.Encoding]::UTF8.GetString($caseBytes)|ConvertFrom-Json;$b=[Text.Encoding]::UTF8.GetString($boundaryBytes)|ConvertFrom-Json;$e=[Text.Encoding]::UTF8.GetString($entryBytes)|ConvertFrom-Json
 if($c.schema-cne'melisa-5244-current-initializer-clean-case.v1'-or$c.readOnly-ne$true-or$c.executionAuthority-ne$false-or$c.target.pid-ne42920-or$c.target.birth-cne'134377286908585811'-or$c.target.sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$c.pending.path-cne(Get-Business5244RetirementPendingPath)-or$c.pending.sha256-cne'5891a78ce6f5811cc443ce6fa0b1f894c53f12d63b426955e8aa008ac7bf23b4'-or$c.pending.bytes-ne449-or$c.pending.expectedReconstructedBytesOnly-ne$true-or$c.pending.actualReadAfterUndoRequired-ne$true-or$c.record.path-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'-or$c.record.sha256-cne'3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74'-or$c.record.actualRecordRead-ne$false-or$c.nativeObservationRequired-ne$true-or$c.preExitSameMutexRequired-ne$true-or$c.stopCalls-ne0-or$c.recordWrites-ne0-or$c.sqlWrites-ne0-or$c.serviceCalls-ne0){throw 'CURRENT_INIT_CLEAN_CASE_SCOPE_CHANGED'}
 if($b.schema-cne'melisa-5244-current-initializer-clean-boundary.v1'-or$b.readOnly-ne$true-or$b.executionAuthority-ne$false-or$b.caseSha256-cne'854d7b2e37e04eacf2c586dc195d50712255dd454e43918a2c4f7153451f3ce3'-or$b.writes-ne0-or$b.sqlCalls-ne0-or$b.serviceCalls-ne0-or$c.entryCaptureSha256-cne'7b93d26f5b927088921d577d6c4bee6856dc15efb5aac47aaf59aef6cb8bb854'-or$e.entries.Count-ne6-or$e.directEntries.Count-ne11-or$e.executionAuthority-ne$false-or$e.entryWrites-ne0){throw 'CURRENT_INIT_CLEAN_BOUNDARY_SCOPE_CHANGED'}
 if($c.active.coreRoot-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029'-or$c.active.coreManifestSha256-cne'727499c2f42fb8d542d408fa38a764541cd1ba2f7341586f14a46976e3c2b985'-or$c.active.coreEntrySha256-cne'712bf4cf5777346c17c018f7cec89291da4b59e8ce47171234e66edfa3cacbf2'-or$c.active.coreSource-cne'a16e14ac80d2d88304209fe7c5fc4e252ab02a43'-or$c.active.coreFiles.Count-ne14){throw 'CURRENT_INIT_CLEAN_PREDECESSOR_CHANGED'}
 foreach($copy in @(@{path=$c.original.pendingCopyPath;hash='7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab'},@{path=$c.original.recordCopyPath;hash='3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74'})){[void](Read-ErpBusinessSalePinnedFile $copy.path $copy.hash)}
 $p=[Text.Encoding]::UTF8.GetString($original)|ConvertFrom-Json
 if($p.operationId-cne'0cfa751c63644554a4faccd1f1e8d7c6'-or$p.ownerPid-ne48212-or$p.ownerBirth-cne'134377121934062288'-or$p.beforeSha256-cne$c.record.sha256-or(Get-Business5244StartupHash ([Convert]::FromBase64String($p.beforeBase64)))-cne$c.record.sha256){throw 'CURRENT_INIT_CLEAN_ORIGINAL_CHAIN_CHANGED'}
 $pins=Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Current
 if($pins.apiManifest-ine$c.current.apiManifest-or$pins.manifest-ine$c.current.webManifest-or$c.current.database-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or$c.current.server-cne'Semih\MELISADEV'){throw 'CURRENT_SUPERSESSION_CURRENT_TARGET_CHANGED'}
 $entries=@(foreach($row in $e.entries){[pscustomobject]@{path=$row.path;hash=$row.beforeSha256}})+@(foreach($row in $e.directEntries){[pscustomobject]@{path=$row.path;hash=$row.sha256}})
 return [pscustomobject]@{schema='business-5244-current-supersession-inputs.v1';caseId='CURRENT-ONLY-5244-INIT-CLEAN-20261029';scopeName='TEST125-API-B6-ca620bac-20261028';ownerPid=42920;ownerBirth='134377286908585811';recordsPath=$c.record.path;recordsHash=$c.record.sha256;originalBeforeHash=$c.record.sha256;pendingPath=$c.pending.path;pendingHash=$c.pending.sha256;beforeBytes=$before;pendingBeforeBytes=$pendingBefore;pins=$pins;currentPins=$pins;entries=$entries;entrySeals=$entries;gateSeal=([pscustomobject]@{path=$e.gate.path;hash=$e.gate.sha256});case=$c;boundary=$b}
}
function Assert-Business5244CurrentSupersessionBoundary($Inputs,[switch]$AllowLiveOriginalOwner){
 $fixed=Get-Business5244CurrentSupersessionFixedInputs
 if($Inputs.schema-cne$fixed.schema-or$Inputs.caseId-cne$fixed.caseId-or$Inputs.ownerPid-ne$fixed.ownerPid-or$Inputs.ownerBirth-cne$fixed.ownerBirth-or$Inputs.recordsPath-cne$fixed.recordsPath-or$Inputs.recordsHash-cne$fixed.recordsHash-or$Inputs.pendingPath-cne$fixed.pendingPath-or$Inputs.pendingHash-cne$fixed.pendingHash){throw 'CURRENT_SUPERSESSION_BOUNDARY_INPUT_CHANGED'}
 foreach($file in $fixed.case.protectedFiles){
  for($part=$file.path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'CURRENT_SUPERSESSION_PROTECTED_REPARSE'}}
  if((Get-FileHash -LiteralPath $file.path).Hash-ine$file.sha256){throw 'CURRENT_SUPERSESSION_PROTECTED_FILE_CHANGED'}
 }
 $service=New-Object -ComObject Schedule.Service;$service.Connect();$task=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
 if((Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($task.Xml)))-cne$fixed.boundary.task.xmlSha256-or(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($task.GetSecurityDescriptor(7))))-cne$fixed.boundary.task.sddlSha256){throw 'CURRENT_SUPERSESSION_TASK_CHANGED'}
 foreach($row in $fixed.boundary.processes){
  $p=Get-Process -Id $row.pid -ErrorAction Stop;$cim=Get-CimInstance Win32_Process -Filter ('ProcessId='+$row.pid)
  if($p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()-cne$row.birth-or$cim.ExecutablePath-cne$row.exe-or$cim.ParentProcessId-ne$row.parent-or(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($cim.CommandLine)))-cne$row.argvSha256){throw 'CURRENT_SUPERSESSION_PROTECTED_PROCESS_CHANGED'}
 }
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object {$_.LocalPort-in@(4144,4146,5194,5234)}|Select-Object LocalPort,OwningProcess -Unique)
 if(($listeners|Sort-Object LocalPort,OwningProcess|ConvertTo-Json -Compress)-cne($fixed.case.protectedProcesses|Sort-Object LocalPort,OwningProcess|ConvertTo-Json -Compress)){throw 'CURRENT_SUPERSESSION_PROTECTED_LISTENER_CHANGED'}
 $old=Get-CimInstance Win32_Process -Filter ('ProcessId='+$fixed.ownerPid)
 if(!$AllowLiveOriginalOwner-and$old-and[Business5244WebNative]::MatchesCimBirth([long]$fixed.ownerBirth,$old.CreationDate.ToUniversalTime().ToFileTimeUtc())){throw 'CURRENT_SUPERSESSION_OLD_OWNER_STILL_LIVE'}
 $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5
 Assert-Business5244ApiHealth $health $fixed.pins
 if($health.serverName-cne'Semih\MELISADEV'-or$health.databaseName-cne'MELISA_ERP_SIRKET_TEST_20260929_01'-or$health.actualT1-ne$false-or$health.sysadmin-ne0-or$health.databaseControl-ne0-or$health.liveDatabaseAccess-ne0){throw 'CURRENT_SUPERSESSION_API_NOT_CURRENT'}
 $nativeInputs=Get-ErpBusinessSaleNativeInputs
 Test-ErpBusinessSaleBefore $nativeInputs
 return $true
}
function Open-Business5244CurrentSupersessionSource([string]$ReviewedSourceHash,[string]$EntryPath){
 if(([bool]$CurrentOnlySupersession-eq[bool]$InitializerCleanRecovery)-or$Apply-or$AfterLoaderRecovery-or$ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$PSVersionTable.PSEdition-cne'Desktop'){throw 'CURRENT_SUPERSESSION_FIXED_ENTRY_REQUIRED'}
 $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029'
 $proof='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\current-only-supersession-20261029\owner-preparation'
 if($InitializerCleanRecovery){$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029';$proof='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\current-only-supersession-20261029\initializer-clean-20261029\owner-preparation'}
 if($EntryPath-cne(Join-Path $core 'install-business-5244-readpair.ps1')-or$ReviewedSourceHash-cnotmatch'^[a-fA-F0-9]{64}$'){throw 'CURRENT_SUPERSESSION_FROZEN_ENTRY_REQUIRED'}
 $script:b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 Hold-B6ReadPairSource $EntryPath $ReviewedSourceHash
 $producer=Join-Path $proof 'verified-owner-producer.mjs'
 Hold-B6ReadPairSource $producer 'd8ca8148b7d7fcebc5c28504da009125935e0cc55bccf9a019eed69b7252034b'
 $node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe'
 if((Get-FileHash -LiteralPath $node).Hash-ine'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'){throw 'CURRENT_SUPERSESSION_NODE_CHANGED'}
 $action=if($InitializerCleanRecovery){'--verify-initializer-clean-recovery'}else{'--verify-current-supersession'}
 $text=& $node $producer $action
 if($LASTEXITCODE-ne0){throw 'CURRENT_SUPERSESSION_SOURCE_VERIFICATION_FAILED'}
 $verified=$text|ConvertFrom-Json
 $beforeCount=if($InitializerCleanRecovery){6}else{5};$verificationSchema=if($InitializerCleanRecovery){'melisa-initializer-clean-recovery-passive-verification.v1'}else{'melisa-current-supersession-passive-verification.v1'}
 if($verified.schema-cne$verificationSchema-or$verified.coreRoot-cne$core-or$verified.coreFiles-ne13-or$verified.installerFiles-ne1-or$verified.beforeImages-ne$beforeCount-or$verified.writes-ne0-or$verified.sqlCalls-ne0-or$verified.serviceCalls-ne0-or$verified.ownerCalls-ne0-or$verified.taskChanges-ne0-or$verified.installerSourceSha256-cne$ReviewedSourceHash.ToLowerInvariant()){throw 'CURRENT_SUPERSESSION_SOURCE_NOT_VERIFIED'}
 if($InitializerCleanRecovery-and($verified.runtimeValidationComplete-ne$false-or$verified.originalContextAssertHeldRequired-ne$true-or$verified.postExitExclusiveEntryCount-ne17-or$verified.deferredEntryCount-ne16)){throw 'CURRENT_INIT_CLEAN_RUNTIME_VALIDATION_STILL_REQUIRED'}
 Hold-B6ReadPairSource (Join-Path $core 'owner-manifest.json') $verified.coreManifestSha256
 $manifest=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
 $manifestKind=if($InitializerCleanRecovery){'CURRENT_INITIALIZER_CLEAN_BUNDLE'}else{'CURRENT_ONLY_SUPERSESSION_BUNDLE'}
 if($manifest.kind-cne$manifestKind-or$manifest.finiteScope-cne$ScopeName-or$manifest.sourceCommit-cne$verified.ownerSourceCommit-or$manifest.initialSlot-cne'Current'-or$manifest.actualT1-ne$false-or$manifest.externalOperations-ne$false-or$manifest.files.Count-ne14-or$manifest.beforeImages.Count-ne$beforeCount){throw 'CURRENT_SUPERSESSION_CORE_CHANGED'}
 if($InitializerCleanRecovery-and($manifest.runtimeValidationComplete-ne$false-or$manifest.originalContextAssertHeldRequired-ne$true-or$manifest.postExitExclusiveEntryCount-ne17-or$manifest.deferredEntryCount-ne16)){throw 'CURRENT_INIT_CLEAN_PASSIVE_METADATA_NOT_RUNTIME_PROOF'}
 foreach($file in @($manifest.files)+@($manifest.beforeImages)){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'CURRENT_SUPERSESSION_SOURCE_LEAF_REJECTED'};Hold-B6ReadPairSource (Join-Path $core $file.path) $file.sha256}
 $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID)
 $actual=[regex]::Replace([string]$self.CommandLine,('^"?'+[regex]::Escape($self.ExecutablePath)+'"?\s+'),'',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
 $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+(Join-Path $core 'run-current-owner.ps1')+' -ManifestSha256 '+$verified.coreManifestSha256.ToUpperInvariant()+' -ScopeName TEST125-API-B6-ca620bac-20261028'
 if($self.ExecutablePath-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or!(Test-ReadPairOwnerArguments $actual $expected)){throw 'CURRENT_SUPERSESSION_NATIVE_CALLER_CHANGED'}
 return [pscustomobject]@{core=$core;proof=$proof;sourceCommit=$verified.ownerSourceCommit;manifestSha256=$verified.coreManifestSha256}
}
function Invoke-Business5244CurrentOnlySupersession {
 $source=Open-Business5244CurrentSupersessionSource $SourceSha256 $PSCommandPath
 . (Join-Path $source.core 'start-business-5244-owned.ps1') -Library -OwnerScopeName 'TEST125-API-B6-ca620bac-20261028'
 . (Join-Path $source.core 'start-owned-test.ps1') -Library
 Initialize-Business5244WebNative;Initialize-Business5244RetirementPeer
 $inputs=Get-Business5244CurrentSupersessionFixedInputs
 $target=Get-CimInstance Win32_Process -Filter ('ProcessId='+$inputs.ownerPid)
 if(!$target-or$target.ExecutablePath-ine$inputs.case.target.exe-or(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($target.CommandLine)))-cne$inputs.case.target.argvSha256){throw 'CURRENT_SUPERSESSION_LIVE_PREDECESSOR_CHANGED'}
 $oldRoots=if($InitializerCleanRecovery){@($inputs.case.active.coreRoot)}else{@($inputs.case.active.coreRoot,$inputs.case.active.routerRoot)}
 foreach($root in $oldRoots){
  $expected=if($root-ceq$inputs.case.active.coreRoot){$inputs.case.active.coreManifestSha256}else{$inputs.case.active.routerManifestSha256}
  Hold-B6ReadPairSource (Join-Path $root 'owner-manifest.json') $expected
 }
 $observer=$null;$admission=$null;$packageSeal=$null
 try{
  if($InitializerCleanRecovery){
   # One observation-only server created by the original, guarded maintenance
   # context. It accepts no JSON/control operation and grants no retirement.
   # CaptureServer authenticates the actual connected kernel pipe peer.
   $pipe=[IO.Pipes.NamedPipeClientStream]::new('.',(Get-Business5244RetirementPipeName),[IO.Pipes.PipeDirection]::InOut)
   $nativePeer=$null
   try{$pipe.Connect(10000);$nativePeer=[Business5244RetirementPeer]::CaptureServer($pipe);$nativePeer.Validate();$observer=$nativePeer.OpenExitObservation()}finally{if($nativePeer){$nativePeer.Dispose()};$pipe.Dispose()}
   if($observer.TargetPid-ne42920-or$observer.TargetBirth-cne'134377286908585811'){throw 'CURRENT_INIT_CLEAN_ACTUAL_PIPE_PEER_REQUIRED'}
  }else{
   $peer=Connect-Business5244RetirementPeer
   try{$nativePeer=Get-Business5244RetirementRecord $peer -Client;$observer=$nativePeer.peer.OpenExitObservation();$status=Send-Business5244RetirementRequest $peer status}finally{Close-Business5244RetirementPeer $peer}
   if($observer.TargetPid-ne$inputs.ownerPid-or$observer.TargetBirth-cne$inputs.ownerBirth-or$status.reply-cne'Status'-or$status.state.phase-cne'Unknown'-or$status.state.ownerPid-ne$observer.TargetPid-or$status.state.ownerBirth-cne$observer.TargetBirth-or!$status.nativePeerVerified-or$status.stopAuthorized){throw 'CURRENT_SUPERSESSION_UNKNOWN_NATIVE_PEER_REQUIRED'}
  }
  Prepare-Business5244CurrentSupersessionObservation $observer|Out-Null
  $packageSeal=[Business5244PackageSeal]::new()
  Assert-Business5244OwnedPackage $inputs.pins $packageSeal;$packageSeal.Freeze();$packageSeal.Validate()
  [void](Assert-Business5244CurrentSupersessionBoundary $inputs -AllowLiveOriginalOwner)
  [Console]::WriteLine((@{phase='CURRENT_ONLY_READY_FOR_COOPERATIVE_EXIT';sourceCommit=$source.sourceCommit;newOwnerPid=$PID;oldOwnerPid=$observer.TargetPid;oldOwnerBirth=$observer.TargetBirth;sqlWrites=0;stopCalls=0}|ConvertTo-Json -Compress));[Console]::Out.Flush()
  $deadline=[Diagnostics.Stopwatch]::StartNew()
  while(!$observer.Observe()){
   if($deadline.ElapsedMilliseconds-ge1800000){throw 'CURRENT_SUPERSESSION_COOPERATIVE_EXIT_NOT_OBSERVED'}
   Start-Sleep -Milliseconds 200
  }
  $observer.ValidateExited();$packageSeal.Validate()
  $admission=New-Business5244CurrentSupersessionAdmission $observer
  Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028' -CurrentSupersession $admission
 }catch{
  # Once a new initializer has an uncertain durable effect, preserve its
  # actual native/file/lease references in THIS process. No external receipt,
  # PID observation, repeat retirement or generic cleanup grants recovery.
  $owned=@($script:Business5244CurrentSupersessions|Where-Object{$_.pid-eq$PID-and!$_.closed-and$_.phase-cne'Completed'})
  if($owned.Count){
   [Console]::WriteLine((@{phase='CURRENT_ONLY_BLOCKED_RETAINED_RESOURCES';ownerPid=$PID;sqlWrites=0;originalRetireCompleted=$false}|ConvertTo-Json -Compress));[Console]::Out.Flush()
   while($true){Start-Sleep -Seconds 1}
  }
  throw
 }finally{if($packageSeal){$packageSeal.Dispose()};if($observer){Close-Business5244CurrentSupersessionObservation $observer;$observer.Dispose()}}
}
if($Library){return}
if($CurrentOnlySupersession-or$InitializerCleanRecovery){
 foreach($builtinName in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets','NetTCPIP','ScheduledTasks')){Microsoft.PowerShell.Core\Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules',$builtinName,($builtinName+'.psd1'))) -Scope Local -ErrorAction Stop}
 Invoke-Business5244CurrentOnlySupersession
 return
}
if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
 if($PSVersionTable.PSEdition-cne'Desktop'){throw 'READPAIR_WINDOWS_POWERSHELL_REQUIRED'}
 foreach($builtinName in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets','NetTCPIP','ScheduledTasks')){
  $builtinManifest=[IO.Path]::Combine($PSHOME,'Modules',$builtinName,($builtinName+'.psd1'))
  Microsoft.PowerShell.Core\Import-Module -Name $builtinManifest -Scope Local -ErrorAction Stop
 }
 $b6ReadProof=$null;$b6NativeAdmission=$null;$b6InitializationExitProcess=$null;$b6SourceHandles=[Collections.Generic.List[IO.FileStream]]::new()
 $b6=if($ReadContextRepairInstall){Open-B6ReadContextRepairPreparedSource $SourceSha256 $PSCommandPath}elseif($PreviewLinkInstall){Open-B6PreviewLinkPreparedSource $SourceSha256 $PSCommandPath}elseif($SteadyStartupInstall){Open-B6SteadyPreparedSource $SourceSha256 $PSCommandPath}elseif($WebOnlyRefreshInstall){Open-B6WebOnlyPreparedSource $SourceSha256 $PSCommandPath}elseif($WriterInstall){Open-B6WriterPreparedSource $SourceSha256 $PSCommandPath}elseif($CandidateInstall){Open-B6CandidatePreparedSource $SourceSha256 $PSCommandPath}elseif($RehearsalOnly){Open-B6RehearsalPreparedSource $SourceSha256 $PSCommandPath}else{Open-B6ReadPairPreparedSource $SourceSha256 $PSCommandPath}
 try{
  # All executable bytes came from the committed, hosted-CI verified bundle
  # and remain held against replacement while the existing sequence runs.
  . (Join-Path $b6.coreRoot 'start-business-5244-owned.ps1') -Library -OwnerScopeName $ScopeName
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
  if($WebOnlyRefreshInstall){$result.maintenancePurpose=$b6.maintenancePurpose;$result.apiRestarts=0;$result.taskChanges=0;$result.profileWrites=0;$result.sqlWrites=0}
  $held=[Collections.Generic.List[object]]::new();$created=[Collections.Generic.List[object]]::new();$control=$null;$newHost=$null;$newResourceRows=@();$oldResourceRows=@();$before=$null;$ready=$null;$status=$null;$webResources=@();$archives=@()
  function Record-Phase([string]$Phase){$result.status=$Phase;[IO.File]::WriteAllText($resultPath,($result|ConvertTo-Json -Depth 16));[Console]::WriteLine((@{phase=$Phase;utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress));[Console]::Out.Flush()}
  try{Invoke-ReadPairInstallSequence}catch{$result.failureSite=Get-ReadPairInstallFailureSite $_;$result.failure=if($_.Exception.Message-cmatch'^[A-Z][A-Z0-9_]+$'){$_.Exception.Message}else{'READPAIR_UNCLASSIFIED_FAILURE'};Record-Phase 'FAILED_REVIEW_RECEIPT';throw $result.failure}
 }finally{
  if($WebOnlyRefreshInstall){foreach($name in @('WebOnlyApiHandle','WebOnlyPackageSeal')){if(Get-Variable $name -Scope Script -ErrorAction SilentlyContinue){$resource=Get-Variable $name -Scope Script -ValueOnly;if($resource){$resource.Dispose()}}}}
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
try{Invoke-ReadPairInstallSequence}catch{$result.failureSite=Get-ReadPairInstallFailureSite $_;$result.failure=if($_.Exception.Message-cmatch'^[A-Z][A-Z0-9_]+$'){$_.Exception.Message}else{'READPAIR_UNCLASSIFIED_FAILURE'};Record-Phase 'FAILED_REVIEW_RECEIPT';throw $result.failure}
