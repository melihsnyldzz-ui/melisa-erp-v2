param([switch]$Library,[switch]$Apply,[switch]$AfterLoaderRecovery,[string]$SourceSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
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
 $entryName=if($oldRoot -ceq $newRoot){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'}
 $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$oldRoot+'\'+$entryName+' -ManifestSha256 '+$oldHash.ToUpperInvariant()
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
 $logPrefix=if($AfterLoaderRecovery){'read2b-install-after-loader-recovery-'}else{'read2b-install-'}
 $stdout=Join-Path $base ($logPrefix+$Label+'.stdout.log');$stderr=Join-Path $base ($logPrefix+$Label+'.stderr.log')
 if((Test-Path $stdout) -or (Test-Path $stderr)){throw 'WEB_START_LOG_ALREADY_EXISTS'}
 $saved=@{};foreach($entry in Get-ChildItem Env:){$saved[$entry.Name]=$entry.Value}
 try{
  foreach($name in @($saved.Keys)){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
  foreach($name in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if($saved.ContainsKey($name)){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
  $script:newHost=Microsoft.PowerShell.Management\Start-Process -FilePath $ps -ArgumentList @('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',(Join-Path $Root $(if($Label -ceq 'candidate'){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'})),'-ManifestSha256',$Hash.ToUpperInvariant()) -WindowStyle Hidden -WorkingDirectory $Root -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 }finally{foreach($entry in Get-ChildItem Env:){[Environment]::SetEnvironmentVariable($entry.Name,$null,'Process')};foreach($entry in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($entry.Key,$entry.Value,'Process')};$saved.Clear()}
 $result.startCalls++;$birth=$script:newHost.StartTime.ToUniversalTime().ToFileTimeUtc().ToString();$result.newOwnerPid=$script:newHost.Id;$result.newOwnerBirth=$birth;Record-Phase ('STARTING_'+$Label)
 $deadline=[DateTime]::UtcNow.AddSeconds(900)
 do{
  if($script:newHost.HasExited){throw 'NEW_WEB_OWNER_EXITED_BEFORE_READY'}
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
function Get-ReadPairExpectedHashes {
 # Pure expected-value calculation from protected in-memory bytes. This is
 # NOT an issued transition token and cannot authorize any API action.
 $scope=Get-Test125ReadPairScope;$path='C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
 $startup=[IO.File]::ReadAllBytes($path);$config=[Text.Encoding]::UTF8.GetString($startup)|ConvertFrom-Json
 [void](Assert-Test125ReadPairConfig $config Current)
 $api=[IO.File]::ReadAllBytes($scope.current.ConfigPath);$nextApi=[Text.Encoding]::UTF8.GetString($api)|ConvertFrom-Json
 if($nextApi.goal8SyntheticDaySeal.packageId-cne'CANONICAL-TEST125-BUSINESS5244-10cdc0ee'){throw 'READPAIR_OLD_PROFILE_SEAL_CHANGED'}
 $nextApi.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'
 $apiAfter=[Text.Encoding]::UTF8.GetBytes(($nextApi|ConvertTo-Json -Depth 100))
 $nextConfig=[Text.Encoding]::UTF8.GetString($startup)|ConvertFrom-Json
 $nextConfig.ApiComponent.ReleaseRoot=$scope.candidate.ReleaseRoot;$nextConfig.ApiComponent.ManifestSha256=$scope.candidate.ManifestSha256
 $startupAfter=[Text.Encoding]::UTF8.GetBytes(($nextConfig|ConvertTo-Json -Depth 100))
 $baseHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($config.ConfigPath))
 $shape=[pscustomobject][ordered]@{schema='melisa-test125-read2b-api-transition.v1';scope=$scope.name;source=$scope.source;database=$scope.database;current=$scope.current;candidate=$scope.candidate;apiProfileBeforeSha256=(Get-Business5244StartupHash $api);apiProfileCandidateSha256=(Get-Business5244StartupHash $apiAfter);baseProfileSha256=$baseHash;startupBeforeSha256=(Get-Business5244StartupHash $startup);startupCandidateSha256=(Get-Business5244StartupHash $startupAfter);apiPort=4144;preservedPorts=@(4146,5194);runtimeApplied=$false}
 $contractHash=Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(($shape|ConvertTo-Json -Depth 12 -Compress)))
 $keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile');$new=Get-Business5244ReadPairPins;$old=Get-Business5244WebPins
 $identity='business-5244-read-pair.v1|'+$contractHash+'|'+(($keys|ForEach-Object {$new[$_]})-join'|')+'|'+(($keys|ForEach-Object {$old[$_]})-join'|')
 return @{planHash=(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity)));baseHash=$baseHash;startupPath=$path;apiPath=$scope.current.ConfigPath;basePath=$config.ConfigPath;Current=@{startup=$shape.startupBeforeSha256;api=$shape.apiProfileBeforeSha256};Candidate=@{startup=$shape.startupCandidateSha256;api=$shape.apiProfileCandidateSha256}}
}
function Open-ReadPairPublication {
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
 if($AfterLoaderRecovery-and($status.ownerPid-ne$coldRecovery.newOwnerPid-or$status.ownerBirth-cne$coldRecovery.newOwnerBirth-or$status.childPid-ne$coldRecovery.childPid-or$status.childBirth-cne$coldRecovery.childBirth)){throw 'READPAIR_COLD_RECOVERY_GENERATION_CHANGED'}
 $script:oldResourceRows=@(Web-Resources $status);$script:webResources=$oldResourceRows
 $c=Connect-Business5244RetirementPeer
 try{if($c.serverPid-ne$status.ownerPid-or$c.serverBirth-cne$status.ownerBirth){throw 'READPAIR_OLD_PEER_CHANGED'};$r=Get-Business5244RetirementRecord $c -Client;$script:control=$r.peer.OpenControlledShutdown()}finally{Close-Business5244RetirementPeer $c}
 Assert-OldTarget $status
 if((Web-Resources $status|ConvertTo-Json -Depth 5 -Compress)-cne($oldResourceRows|ConvertTo-Json -Depth 5 -Compress)){throw 'READPAIR_OLD_RESOURCES_CHANGED'}
 Assert-ReadPairProtection;$control.Validate()
}
function Stop-ReadPairColdOwner {
 $control.Stop();$result.stopCalls++
 if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'READPAIR_OLD_RESOURCES_NOT_EXITED'}
 Record-Phase 'COLD_OWNER_EXITED'
}
function Start-ReadPairPreparedOwner {
 $script:ready=Start-Frozen $newRoot $newHash 'candidate'
 $script:newResourceRows=@(Web-Resources $ready)
}
function Assert-ReadPairPreparedOwner {
 $s=Owner-Status
 if($s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth-or$s.childPid-ne$ready.childPid-or$s.childBirth-cne$ready.childBirth){throw 'READPAIR_PREPARED_PEER_CHANGED'}
 Assert-ReadPairProtection
 if(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath)){throw 'READPAIR_PENDING_ALREADY_EXISTS'}
 $h=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $h $pins
 $fresh=Get-ReadPairExpectedHashes
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
   $s=Owner-Status
   if($s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth){throw 'READPAIR_FINAL_PEER_CHANGED'}
   $files=@(Select-ReadPairCommitArchives @(Get-ChildItem -LiteralPath $pins.runtime -Filter '5244-retirement.pending.*.completed' -File) $archives)
   if($files.Count-eq1-and!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){
    $lines=@([IO.File]::ReadAllLines($files[0].FullName)|Where-Object {$_});if($lines.Count-ne2){throw 'READPAIR_ARCHIVE_FORMAT'}
    $a=$lines[0]|ConvertFrom-Json;$c=$lines[1]|ConvertFrom-Json
    if($a.schema-cne'business-5244-retirement-before.v1'-or$c.schema-cne'business-5244-commit-prepared.v1'-or$c.operationId-cnotmatch'^[a-f0-9]{32}$'-or$a.operationId-cne$c.operationId-or$files[0].Name-cne('5244-retirement.pending.'+$c.operationId+'.completed')-or$c.ownerPid-ne$s.ownerPid-or$c.ownerBirth-cne$s.ownerBirth-or$a.ownerPid-ne$s.ownerPid-or$a.ownerBirth-cne$s.ownerBirth-or$a.childPid-ne$ready.childPid-or$a.childBirth-cne$ready.childBirth-or$c.childPid-ne$s.childPid-or$c.childBirth-cne$s.childBirth-or$c.mode-cnotin@('Candidate','Rollback')){throw 'READPAIR_ARCHIVE_IDENTITY'}
    $old=[Convert]::FromBase64String($a.beforeBase64);if((Get-Business5244StartupHash $old)-cne$a.beforeSha256){throw 'READPAIR_ARCHIVE_BEFORE_HASH'}
    $chosen=if($c.mode-ceq'Candidate'){Get-Business5244ReadPairPins}else{Get-Business5244WebPins}
    if($c.package-cne$chosen.package-or$c.manifest-cne$chosen.manifest-or$c.planHash-cne$expected.planHash){throw 'READPAIR_ARCHIVE_PAIR_CHANGED'}
    $record=[IO.File]::ReadAllBytes('C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json')
    if((Get-Business5244StartupHash $record)-cne$c.recordsHash){throw 'READPAIR_RECORD_HASH_CHANGED'}
    Assert-Business5244RecordStage (ConvertFrom-Business5244RecordBytes $old) (ConvertFrom-Business5244RecordBytes $record) $s.childPid $c.mode $chosen
    $config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json';[void](Assert-Test125ReadPairConfig $config $(if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}))
    $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5;Assert-Business5244ApiHealth $health $chosen
    $mode=if($c.mode-ceq'Candidate'){'Candidate'}else{'Current'}
    if((Get-FileHash -LiteralPath $expected.startupPath).Hash-ine$expected[$mode].startup-or(Get-FileHash -LiteralPath $expected.apiPath).Hash-ine$expected[$mode].api-or(Get-FileHash -LiteralPath $expected.basePath).Hash-ine$expected.baseHash){throw 'READPAIR_FINAL_PROFILE_OR_CONFIG_CHANGED'}
    $apiProof=Get-Test125BoundMaintenancePlan -RunId (Get-Test125ReadPairScope).name -ReadPairPreparation -ReadPairMode $mode
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
  }catch{if($_.Exception.Message-cmatch'^READPAIR_(?:ARCHIVE|FINAL_PEER|RECORD|PROTECTION)'){throw}}
  Start-Sleep -Milliseconds 750
 }while([DateTime]::UtcNow-lt$deadline)
 throw 'READPAIR_RECONCILIATION_TIMEOUT_NO_REPLAY'
}
function Complete-ReadPairPublication([string]$Outcome){
 Assert-ReadPairProtection
 foreach($entry in $held){if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $entry.stream))-cne$entry.afterHash){throw 'READPAIR_ENTRY_AFTER_CHANGED'}}
 $result.outcome=$Outcome;Record-Phase $Outcome
}
function Restore-ReadPairBeforeRetire([bool]$OldStopped){
 # Pre-retire only: no API/profile/config mutation was requested. If the
 # created owner is not provably closed, retain all gates for manual recovery.
 if(!$before){return}
 if($OldStopped){
  if($newHost-and!$newHost.HasExited){$newHost.Kill();[void]$newHost.WaitForExit(15000)}
  if($newHost-and(!$newResourceRows.Count-or!(Wait-ResourceExit $newResourceRows))){throw 'READPAIR_NEW_RESOURCES_RECOVERY_REQUIRED'}
  if(!(Wait-ResourceExit $oldResourceRows)-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'READPAIR_RECOVERY_PORT_NOT_EMPTY'}
  $script:ready=Start-Frozen $oldRoot $oldHash 'rollback';$s=Owner-Status
  if($s.ownerPid-ne$newHost.Id-or$s.ownerBirth-cne$ready.ownerBirth-or$s.childPid-ne$ready.childPid-or$s.childBirth-cne$ready.childBirth){throw 'READPAIR_COLD_ROLLBACK_NOT_CONFIRMED'}
 }
 Assert-ReadPairProtection
 # Inspect EVERY held stream first, before undoing any entry or removing a
 # helper. A partial/inverse failure is recovery-required, never skipped.
 foreach($item in $held){$hash=Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream);if($hash-cne$item.beforeHash-and$hash-cne$item.afterHash){throw 'READPAIR_HELD_ENTRY_RECOVERY_REQUIRED'}}
 foreach($item in $held){$hash=Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream);if($hash-ceq$item.afterHash){Write-ReadPairHeldCas $item.stream $item.afterHash $item.before};$item.written=$false}
 # New exact helper/router files are inert before retire; do not remove foreign
 # files, directories, packages, records or any prior evidence.
 foreach($item in $created){if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream))-cne$item.hash){throw 'READPAIR_CREATED_FILE_CHANGED'};$item.stream.Dispose();if(!$item.preexisting){[IO.File]::Delete($item.path)}}
 Record-Phase 'PRE_RETIRE_INVERSE_VERIFIED'
}
function Close-ReadPairPublication {
 foreach($item in $held){$item.stream.Dispose()};foreach($item in $created){$item.stream.Dispose()};if($control){$control.Dispose()}
}
if($Library){return}
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
try{Invoke-ReadPairInstallSequence}catch{$result.failure=if($_.Exception.Message-cmatch'^[A-Z][A-Z0-9_]+$'){$_.Exception.Message}else{'READPAIR_UNCLASSIFIED_FAILURE'};Record-Phase 'FAILED_REVIEW_RECEIPT';throw $result.failure}
