param([Alias('Library')][switch]$RetirementStateLibrary)
if(!(Get-Variable Business5244Retirements -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244Retirements=[Collections.Generic.List[object]]::new()}
function Get-Business5244RetirementState($State){
 $rows=@($script:Business5244Retirements|Where-Object{[object]::ReferenceEquals($_.token,$State)})
 if($rows.Count -ne 1){throw 'RETIREMENT_STATE_UNISSUED'};$r=$rows[0]
 if($r.process -ne $PID -or $r.thread -ne [Threading.Thread]::CurrentThread.ManagedThreadId){throw 'RETIREMENT_STATE_FOREIGN_THREAD'}
 Assert-Business5244StartupLease -Lease $r.lease
 return $r
}
function Register-Business5244OwnedRetirement($Lease,$Native,$Pins){
 Assert-Business5244StartupLease -Lease $Lease -Kind Owner
 if(!($Native -is [Business5244WebNative]) -or !$Native.ChildAlive()){throw 'RETIREMENT_OWNED_CHILD_REQUIRED'}
 $Native.Validate();$token=[pscustomobject]@{kind='business-5244-retirement-state'}
 $r=@{token=$token;lease=$Lease;native=$Native;pins=$Pins.Clone();process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;ownerBirth=$Native.OwnerBirth;childPid=$Native.ChildPid;childBirth=$Native.ChildBirth;phase='Running';records=$null;pending=$null;pendingHash=$null;before=$null;expected=$null;recordExpected=$null;publication=$null;requestProof=$null;commit=$null;lastCompletion=$null;operationId=$null}
 $script:Business5244Retirements.Add($r);return $token
}
function Get-Business5244RetirementSnapshot($State){
 $r=Get-Business5244RetirementState $State
 return @{phase=$(if($r.phase -ceq 'Published'){'Retired'}else{$r.phase});ownerPid=$PID;ownerBirth=$r.ownerBirth;childPid=$r.childPid;childBirth=$r.childBirth}
}
function Read-Business5244RetirementBytes([IO.FileStream]$Stream){
 $m=[IO.MemoryStream]::new();try{$Stream.Position=0;$Stream.CopyTo($m);return ,$m.ToArray()}finally{$m.Dispose();$Stream.Position=0}
}
function ConvertFrom-Business5244RecordBytes([byte[]]$Bytes){
 $text=[Text.UTF8Encoding]::new($false,$true).GetString($Bytes).TrimStart([char]0xFEFF)
 $parsed=Microsoft.PowerShell.Utility\ConvertFrom-Json -InputObject $text
 return ,@(foreach($row in $parsed){$row})
}
function Assert-Business5244RetirementRecord($State,[IO.FileStream]$Records){
 $r=Get-Business5244RetirementState $State
 if($r.phase -cne 'Running' -or !$Records.CanRead -or !$Records.CanWrite -or !$r.native.ChildAlive() -or $r.native.ChildPid -ne $r.childPid -or $r.native.ChildBirth -cne $r.childBirth){throw 'RETIREMENT_TARGET_NOT_CURRENT'}
 $before=Read-Business5244RetirementBytes $Records;$rows=ConvertFrom-Business5244RecordBytes $before
 Assert-Business5244RecordStage $rows $rows $r.childPid Candidate $r.pins
 return ,$before
}
function Get-Business5244CurrentBootstrapPins([string]$BeforeHash='') {
 # This is the exact stale CLEAN record observed before the fresh Current start.
 # A caller cannot supply another baseline, PID or product/database target.
 # The first approved attempt durably published this exact Current after-image
 # before request expiry. It is a metadata baseline ONLY: it grants no stop,
 # no Unknown recovery and no authority from an external outcome assertion.
 # Both callers still reject a live old PID and require a new owned child.
 if($BeforeHash-ceq'3bfd7f5df1aaedae5835709fd048f27cf35aa97f97a7c561cbd89ee0342827fc'){
  return @{hash=$BeforeHash;pid=25564;root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-5cb682d8';source='5cb682d8523552745b81422b1c2f0273cc8feb03'}
 }
 return @{hash='24bb8c6553b039981761dd188584c7787798fa1a3be972082e7439f34fd5e560';pid=2000;root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-d4f52345';source='d875dc6e59d70230b8c931f718bac30438778ec1'}
}
function Assert-Business5244CurrentBootstrapBefore($State,[IO.FileStream]$Records){
 $r=Get-Business5244RetirementState $State;$fixed=Get-Business5244WebPins;$stale=Get-Business5244CurrentBootstrapPins (Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records))
 Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 if($r.phase -cne 'Running' -or $r.records -or $r.pending -or !$Records.CanRead -or !$Records.CanWrite -or $r.childPid -ne $r.native.ChildPid -or $r.childBirth -cne $r.native.ChildBirth){throw 'CURRENT_BOOTSTRAP_NOT_ADMITTED'}
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($r.pins[$key] -cne $fixed[$key]){throw 'CURRENT_BOOTSTRAP_NOT_FIXED_CURRENT'}}
 Assert-Business5244CreatedChild $r.native $fixed;Assert-Business5244ReadyChild $r.native $fixed
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records)) -cne $stale.hash){throw 'CURRENT_BOOTSTRAP_BASE_CHANGED'}
 if(Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.pid)){throw 'CURRENT_BOOTSTRAP_OLD_PID_PRESENT'}
}
function Publish-Business5244HeldCurrentRecord($State,[IO.FileStream]$Records,[IO.FileStream]$Pending){
 $r=Get-Business5244RetirementState $State
 Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 $fixed=Get-Business5244WebPins
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($r.pins[$key] -cne $fixed[$key]){throw 'CURRENT_BOOTSTRAP_NOT_FIXED_CURRENT'}}
 if($r.phase -cne 'Running' -or $r.records -or $r.pending -or !$Records.CanRead -or !$Records.CanWrite -or $r.childPid -ne $r.native.ChildPid -or $r.childBirth -cne $r.native.ChildBirth){throw 'CURRENT_BOOTSTRAP_NOT_ADMITTED'}
 Assert-Business5244CreatedChild $r.native $fixed;Assert-Business5244ReadyChild $r.native $fixed
 $before=Read-Business5244RetirementBytes $Records;$beforeHash=Get-Business5244StartupHash $before
 $rows=ConvertFrom-Business5244RecordBytes $before
 if($r.ContainsKey('currentBootstrap') -and $r.currentBootstrap){
  $last=$r.currentBootstrap
  if($last.phase -cne 'Archived' -or $last.childPid -ne $r.childPid -or $last.childBirth -cne $r.childBirth -or $beforeHash -cne $last.afterHash){throw 'CURRENT_BOOTSTRAP_REPLAY_CONFLICT'}
  Assert-Business5244RecordStage $rows $rows $r.childPid Candidate $fixed
  return [pscustomobject]@{published=$true;replayed=$true;childPid=$r.childPid;recordHash=$beforeHash}
 }
 $stale=Get-Business5244CurrentBootstrapPins $beforeHash
 if($beforeHash -cne $stale.hash){throw 'CURRENT_BOOTSTRAP_BASE_CHANGED'}
 $old=@($rows|Where-Object {$_.port -eq 5244})
 if($old.Count -ne 1 -or $old[0].pid -ne $stale.pid -or $old[0].root -cne $stale.root -or $old[0].sourceCommit -cne $stale.source -or $old[0].entry -cne 'vite-preview' -or $old[0].backendPort -ne 4144 -or $old[0].businessWorkfaceId -cne $fixed.profile){throw 'CURRENT_BOOTSTRAP_STALE_IDENTITY_CHANGED'}
 if(Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.pid)){throw 'CURRENT_BOOTSTRAP_OLD_PID_PRESENT'}
 if(!$Pending.CanRead -or !$Pending.CanWrite -or $Pending.Length -ne 0){throw 'CURRENT_BOOTSTRAP_PENDING_NOT_FRESH'}
 $after=@($rows|ForEach-Object {if($_.port -eq 5244){[pscustomobject]@{port=5244;pid=$r.childPid;entry='vite-preview';sourceCommit=$fixed.frontendSource;root=$fixed.root;backendPort=4144;businessWorkfaceId=$fixed.profile}}else{$_}})
 Assert-Business5244RecordStage $rows $after $r.childPid Candidate $fixed
 $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $after -Depth 30));$hash=Get-Business5244StartupHash $bytes
 $id=[Guid]::NewGuid().ToString('N');$archive=$Pending.Name+'.'+$id+'.bootstrap.completed'
 $seal=[Text.Encoding]::UTF8.GetBytes((@{schema='business-5244-current-bootstrap.v1';operationId=$id;ownerPid=$PID;ownerBirth=$r.ownerBirth;childPid=$r.childPid;childBirth=$r.childBirth;beforeHash=$beforeHash;afterHash=$hash;beforeBase64=[Convert]::ToBase64String($before)}|ConvertTo-Json -Compress))
 # Keep both exclusive record ownership and durable evidence through publication.
 # An uncertain write never restores the stale PID or stops any process.
 $r.records=$Records;$r.pending=$Pending;$r.currentBootstrap=@{phase='Preparing';childPid=$r.childPid;childBirth=$r.childBirth;afterHash=$hash;archive=$archive}
 try{
  $Pending.Write($seal,0,$seal.Length);$Pending.Flush($true)
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Pending)) -cne (Get-Business5244StartupHash $seal)){throw 'CURRENT_BOOTSTRAP_BEFORE_NOT_DURABLE'}
  Assert-Business5244CreatedChild $r.native $fixed;Assert-Business5244ReadyChild $r.native $fixed
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records)) -cne $beforeHash){throw 'CURRENT_BOOTSTRAP_RECORD_CAS_CHANGED'}
  $Records.Position=0;$Records.SetLength(0);$Records.Write($bytes,0,$bytes.Length);$Records.Flush($true)
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records)) -cne $hash){throw 'CURRENT_BOOTSTRAP_WRITE_UNCONFIRMED'}
  Assert-Business5244CreatedChild $r.native $fixed;Assert-Business5244ReadyChild $r.native $fixed
  $pendingName=$Pending.Name;$Pending.Dispose();$r.pending=$null
  try{Move-Business5244PendingArchive $pendingName $archive}catch{if((Test-Path -LiteralPath $pendingName) -or !(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive).Hash -ine (Get-Business5244StartupHash $seal)){throw}}
  if((Test-Path -LiteralPath $pendingName) -or (Get-FileHash -LiteralPath $archive).Hash -ine (Get-Business5244StartupHash $seal)){throw 'CURRENT_BOOTSTRAP_ARCHIVE_UNCONFIRMED'}
  $r.currentBootstrap.phase='Archived';$r.records=$null
  return [pscustomobject]@{published=$true;replayed=$false;childPid=$r.childPid;recordHash=$hash}
 }catch{
  $failure=$_;$r.phase='Unknown';$r.currentBootstrap.phase='Unknown'
  if(!$r.pending){
   # Even a failure after archival must keep restart blocked. Never turn a
   # missing ACK into permission to publish the stale predecessor again.
   try{$marker=[IO.File]::Open($Pending.Name,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);$r.pending=$marker;$marker.Write($seal,0,$seal.Length);$marker.Flush($true)}catch{}
  }
  throw $failure
 }
}
function Publish-Business5244CurrentRecord($State){
 $r=Get-Business5244RetirementState $State
 $recordsPath='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';$pendingPath=Get-Business5244RetirementPendingPath
 $records=$null;$pending=$null
 try{
  foreach($file in @($recordsPath,$pendingPath)){for($part=$file;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Test-Path -LiteralPath $part) -and ((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'CURRENT_BOOTSTRAP_REPARSE_POINT'}}}
  $records=[IO.File]::Open($recordsPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  # Replayed successful bootstrap only reads the published record; it cannot
  # manufacture a new empty pending file or repeat a CAS write.
  if($r.ContainsKey('currentBootstrap') -and $r.currentBootstrap -and $r.currentBootstrap.phase -ceq 'Archived'){
   return Publish-Business5244HeldCurrentRecord $State $records $null
  }else{
   Assert-Business5244CurrentBootstrapBefore $State $records
   $pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  }
  return Publish-Business5244HeldCurrentRecord $State $records $pending
 }finally{if(!$r.records){if($records){$records.Dispose()};if($pending){$pending.Dispose()}}}
}
function Invoke-Business5244HeldRetirement($State,[IO.FileStream]$Records,[IO.FileStream]$Pending){
 # Core accepts already-held streams; the normal entry below fixes their real
 # paths. No serialized PID, ACK or caller flag can mint this registered state.
 $r=Get-Business5244RetirementState $State
 if($r.phase -cne 'Running'){throw 'RETIREMENT_ALREADY_REQUESTED'}
 $before=Assert-Business5244RetirementRecord $State $Records
 if(!$Pending.CanWrite -or $Pending.Length -ne 0){throw 'RETIREMENT_PENDING_NOT_FRESH'}
 $r.operationId=[Guid]::NewGuid().ToString('N')
 $seal=[ordered]@{schema='business-5244-retirement-before.v1';operationId=$r.operationId;ownerPid=$PID;ownerBirth=$r.ownerBirth;childPid=$r.childPid;childBirth=$r.childBirth;beforeSha256=(Get-Business5244StartupHash $before);beforeBase64=[Convert]::ToBase64String($before)}
 $bytes=[Text.Encoding]::UTF8.GetBytes(($seal|ConvertTo-Json -Compress))
 $Pending.Write($bytes,0,$bytes.Length);$Pending.Flush($true)
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Pending)) -cne (Get-Business5244StartupHash $bytes)){throw 'RETIREMENT_BEFORE_NOT_DURABLE'}
 $r.records=$Records;$r.pending=$Pending;$r.pendingHash=Get-Business5244StartupHash $bytes;$r.before=$before;$r.expected=Get-Business5244StartupHash $before;$r.recordExpected=$r.expected;$r.commit=$null;$r.publication=$null;$r.phase='Retiring'
 try{
  if($r.requestProof){Assert-Business5244RetirementRequest -Channel $r.requestProof.channel -Request $r.requestProof.request}
  # The owner keeps the SAME mutex throughout retirement and publication.
  $r.native.Dispose()
  if(!$r.native.RetirementConfirmed){throw 'RETIREMENT_NATIVE_EXIT_UNCONFIRMED'}
  $r.phase='Retired';$leaseRecord=Get-Business5244StartupRecord $r.lease;$leaseRecord.kind='Maintenance'
 }catch{$r.phase='Unknown';throw}
}
function Invoke-Business5244OwnedRetirement($State,[Parameter(Mandatory)]$Channel,[Parameter(Mandatory)]$Request){
 $r=Get-Business5244RetirementState $State
 Assert-Business5244RetirementRequest -Channel $Channel -Request $Request
 if($Request.operation -isnot [string] -or $Request.operation -cne 'retire'){throw 'RETIREMENT_REQUEST_NOT_RETIRE'}
 if($r.phase -ceq 'Retired'){return}
 if($r.phase -cne 'Running'){throw 'RETIREMENT_NOT_RUNNING'}
 $r.requestProof=@{channel=$Channel;request=$Request}
 $records=$null;$pending=$null;$recordsPath='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'
 try{
  foreach($file in @($recordsPath,(Get-Business5244RetirementPendingPath))){for($part=$file;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Test-Path -LiteralPath $part) -and ((Get-Item -LiteralPath $part).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'RETIREMENT_REPARSE_POINT'}}}
  $records=[IO.File]::Open($recordsPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $null=Assert-Business5244RetirementRecord $State $records
  $pending=[IO.File]::Open((Get-Business5244RetirementPendingPath),[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  Invoke-Business5244HeldRetirement $State $records $pending
 }finally{
  # Once sealed, the owner retains both streams even if stop/ACK is uncertain.
  if(!$r.records){if($pending){$pending.Dispose()};if($records){$records.Dispose()}}
 }
}
function Publish-Business5244RetiredRecord($State,$ReplacementNative,[ValidateSet('Candidate','Rollback')][string]$Mode='Candidate',$Pins=$null){
 $r=Get-Business5244RetirementState $State
 if(!$Pins){$Pins=$r.pins}
 Assert-Business5244CreatedChild $ReplacementNative $Pins
 Publish-Business5244HeldRecord $State $ReplacementNative $Mode $Pins
}
function Publish-Business5244HeldRecord($State,$ReplacementNative,[ValidateSet('Candidate','Rollback')][string]$Mode='Candidate',$Pins=$null){
 # Held publication core; the normal entry above additionally verifies the
 # actual executable/argv/SID through the retained native child identity.
 $r=Get-Business5244RetirementState $State
 if(!$Pins){$Pins=$r.pins}
 Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
 if($r.phase -cnotin @('Retired','Published') -or !($ReplacementNative -is [Business5244WebNative]) -or !$ReplacementNative.ChildAlive()){throw 'RETIREMENT_PUBLICATION_NOT_ADMITTED'}
 if((Get-Business5244StartupHash $r.before) -cne $r.expected -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.pending)) -cne $r.pendingHash){throw 'RETIREMENT_BEFORE_IMAGE_CHANGED'}
 $ReplacementNative.Validate()
 $before=ConvertFrom-Business5244RecordBytes $r.before
 $after=@($before|ForEach-Object {if($_.port -eq 5244){if($Mode -ceq 'Rollback'){$copy=$_.PSObject.Copy();$copy.pid=$ReplacementNative.ChildPid;$copy}else{[pscustomobject]@{port=5244;pid=$ReplacementNative.ChildPid;entry='vite-preview';sourceCommit=$Pins.frontendSource;root=$Pins.root;backendPort=4144;businessWorkfaceId=$Pins.profile}}}else{$_}})
 Assert-Business5244RecordStage $before $after $ReplacementNative.ChildPid $Mode $Pins
 $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $after -Depth 30));$hash=Get-Business5244StartupHash $bytes
 $priorBytes=Read-Business5244RetirementBytes $r.records;$current=Get-Business5244StartupHash $priorBytes
 if($r.publication){if(![object]::ReferenceEquals($r.publication.native,$ReplacementNative) -or $r.publication.hash -cne $hash -or $r.publication.mode -cne $Mode -or $current -cne $hash){throw 'RETIREMENT_PUBLICATION_REPLAY_CONFLICT'};return}
 if($current -cne $r.recordExpected){throw 'RETIREMENT_RECORD_CAS_CHANGED'}
 $r.publication=@{native=$ReplacementNative;hash=$hash;mode=$Mode;pins=$Pins.Clone();confirmed=$false;priorBytes=$priorBytes;priorHash=$current}
 try{
  $r.records.Position=0;$r.records.SetLength(0);$r.records.Write($bytes,0,$bytes.Length);$r.records.Flush($true)
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $hash){throw 'RETIREMENT_RECORD_WRITE_UNCONFIRMED'}
  $r.publication.confirmed=$true;$r.recordExpected=$hash;$r.phase='Published'
 }catch{
  $failure=$_;$r.phase='Unknown'
  try{$observed=Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)}catch{throw $failure}
  if($observed -ceq $hash){
   # A matching cache read is not a durable ACK. Re-flush successfully before
   # reconciling a lost response; otherwise retain Unknown and the held gate.
   try{$r.records.Flush($true);if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $hash){throw 'RETIREMENT_DURABLE_RECHECK_CHANGED'}}catch{throw $failure}
   $r.publication.confirmed=$true;$r.recordExpected=$hash;$r.phase='Published';return
  }
  # The exclusive stream prevents concurrent later local writes. Restore only
  # this held publication's bytes; pending marker still blocks normal startup.
  try{$r.records.Position=0;$r.records.SetLength(0);$r.records.Write($priorBytes,0,$priorBytes.Length);$r.records.Flush($true);if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $current){throw 'RETIREMENT_RECORD_INVERSE_UNCONFIRMED'};$ReplacementNative.Dispose();$r.recordExpected=$current;$r.publication=$null;$r.phase='Retired'}catch{$r.phase='Unknown'}
  throw $failure
 }
}
function Reset-Business5244FailedCandidate($State){
 $r=Get-Business5244RetirementState $State
 Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
 if($r.phase -cnotin @('Retired','Published','Committing') -or ($r.commit -and $r.commit.phase -cnotin @('None','PendingDurable')) -or !$r.native.RetirementConfirmed){throw 'MAINTENANCE_ROLLBACK_NOT_ADMITTED'}
 if(!$r.pending -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.pending)) -cne $r.pendingHash -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $r.recordExpected){throw 'MAINTENANCE_ROLLBACK_CONTROL_CHANGED'}
 $owned=if($r.publication){$r.publication.native}elseif($r.ContainsKey('dispatch') -and $r.dispatch.candidateNative){$r.dispatch.candidateNative}else{$null}
 if($owned){if(!($owned -is [Business5244WebNative])){throw 'MAINTENANCE_ROLLBACK_NATIVE_REQUIRED'};if(!$owned.RetirementConfirmed){$owned.Validate();$owned.Dispose()};if(!$owned.RetirementConfirmed){throw 'OWNED_WEB_CLEANUP_UNCONFIRMED'}}
 $r.publication=$null;$r.commit=$null;$r.phase='Retired'
}
function Move-Business5244PendingArchive([string]$Source,[string]$Destination){[IO.File]::Move($Source,$Destination)}
function Open-Business5244RetirementRecoveryMarker($State){
 $r=Get-Business5244RetirementState $State
 if($r.pending){return}
 $path=$r.commit.pendingPath
 if(Test-Path -LiteralPath $path){$r.pending=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);return}
 $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 try{$body=[Text.Encoding]::UTF8.GetBytes((@{schema='business-5244-commit-uncertain.v1';operationId=$r.operationId;archivePath=$r.commit.archivePath;archiveHash=$r.commit.hash}|ConvertTo-Json -Compress));$stream.Write($body,0,$body.Length);$stream.Flush($true);$r.pending=$stream;$r.pendingHash=Get-Business5244StartupHash $body}catch{$stream.Dispose();throw}
}
function Complete-Business5244OwnedMaintenance($State,$ReplacementNative,$Pins,[ValidateSet('Candidate','Rollback')][string]$Mode,[string]$PlanHash){
 $r=Get-Business5244RetirementState $State
 if($PlanHash -cnotmatch '^[a-f0-9]{64}$'){throw 'MAINTENANCE_PLAN_HASH_REQUIRED'}
 if($r.phase -ceq 'Running' -and $r.lastCompletion){
  $last=$r.lastCompletion
  if($last.planHash -cne $PlanHash -or $last.mode -cne $Mode -or ![object]::ReferenceEquals($last.native,$ReplacementNative) -or !$ReplacementNative.ChildAlive() -or $ReplacementNative.ChildPid -ne $last.childPid -or $ReplacementNative.ChildBirth -cne $last.childBirth){throw 'MAINTENANCE_COMPLETION_REPLAY_CONFLICT'}
  foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Pins[$key] -cne $last.pins[$key] -or $Pins[$key] -cne $r.pins[$key]){throw 'MAINTENANCE_COMPLETION_REPLAY_PINS_CHANGED'}}
  return
 }
 Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
 if($r.phase -cnotin @('Published','Committing') -or !$r.publication -or !$r.publication.confirmed -or $r.publication.mode -cne $Mode -or ![object]::ReferenceEquals($r.publication.native,$ReplacementNative)){throw 'MAINTENANCE_COMMIT_NOT_ADMITTED'}
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($Pins[$key] -cne $r.publication.pins[$key]){throw 'MAINTENANCE_COMMIT_PINS_CHANGED'}}
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $r.publication.hash -or (Get-Business5244StartupHash $r.before) -cne $r.expected){throw 'MAINTENANCE_COMMIT_CONTROL_CHANGED'}
 Assert-Business5244ReadyChild $ReplacementNative $Pins
 if(!$r.commit){
  if(!$r.pending -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.pending)) -cne $r.pendingHash){throw 'MAINTENANCE_COMMIT_BEFORE_CHANGED'}
  $pendingPath=[IO.Path]::GetFullPath($r.pending.Name);$archivePath=$pendingPath+'.'+$r.operationId+'.completed'
  if([IO.Path]::GetDirectoryName($archivePath) -cne [IO.Path]::GetDirectoryName($pendingPath)){throw 'MAINTENANCE_ARCHIVE_SCOPE'}
  $receipt=[ordered]@{schema='business-5244-commit-prepared.v1';operationId=$r.operationId;ownerPid=$PID;ownerBirth=$r.ownerBirth;planHash=$PlanHash;mode=$Mode;childPid=$ReplacementNative.ChildPid;childBirth=$ReplacementNative.ChildBirth;package=$Pins.package;manifest=$Pins.manifest;recordsHash=$r.publication.hash}
  $prefix=[Text.Encoding]::UTF8.GetString((Read-Business5244RetirementBytes $r.pending));$bytes=[Text.Encoding]::UTF8.GetBytes($prefix+"`n"+($receipt|ConvertTo-Json -Compress)+"`n")
  $r.commit=@{phase='None';planHash=$PlanHash;mode=$Mode;childPid=$ReplacementNative.ChildPid;childBirth=$ReplacementNative.ChildBirth;pendingPath=$pendingPath;archivePath=$archivePath;bytes=$bytes;hash=(Get-Business5244StartupHash $bytes)}
 }
 $commit=$r.commit
 if($commit.planHash -cne $PlanHash -or $commit.mode -cne $Mode -or $commit.childPid -ne $ReplacementNative.ChildPid -or $commit.childBirth -cne $ReplacementNative.ChildBirth){throw 'MAINTENANCE_COMMIT_REPLAY_CONFLICT'}
 $r.phase='Committing'
 try{
  if($commit.phase -ceq 'None'){
   try{$r.pending.Position=0;$r.pending.SetLength(0);$r.pending.Write($commit.bytes,0,$commit.bytes.Length);$r.pending.Flush($true);if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.pending)) -cne $commit.hash){throw 'MAINTENANCE_COMMIT_FLUSH_UNCONFIRMED'}}catch{$commit.phase='Unknown';throw}
   $r.pendingHash=$commit.hash;$commit.phase='PendingDurable'
  }
  if($commit.phase -ceq 'PendingDurable'){
   if($r.pending){$r.pending.Dispose();$r.pending=$null}
   try{Move-Business5244PendingArchive $commit.pendingPath $commit.archivePath}catch{
    $moveFailure=$_
    if((Test-Path -LiteralPath $commit.archivePath) -and !(Test-Path -LiteralPath $commit.pendingPath) -and (Get-FileHash -LiteralPath $commit.archivePath).Hash -ieq $commit.hash){$commit.phase='Archived'}
    elseif((Test-Path -LiteralPath $commit.pendingPath) -and !(Test-Path -LiteralPath $commit.archivePath) -and (Get-FileHash -LiteralPath $commit.pendingPath).Hash -ieq $commit.hash){$r.pending=[IO.File]::Open($commit.pendingPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);throw $moveFailure}
    else{$commit.phase='Unknown';throw $moveFailure}
   }
   if($commit.phase -ceq 'PendingDurable'){$commit.phase='Archived'}
  }
  if($commit.phase -cne 'Archived' -or (Test-Path -LiteralPath $commit.pendingPath) -or (Get-FileHash -LiteralPath $commit.archivePath).Hash -ine $commit.hash){throw 'MAINTENANCE_ARCHIVE_UNCONFIRMED'}
  Assert-Business5244ReadyChild $ReplacementNative $Pins
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $r.publication.hash){throw 'MAINTENANCE_FINAL_RECORD_CHANGED'}
  $r.records.Dispose();$r.records=$null
  $r.native=$ReplacementNative;$r.pins=$Pins.Clone();$r.childPid=$ReplacementNative.ChildPid;$r.childBirth=$ReplacementNative.ChildBirth
  $r.lastCompletion=@{planHash=$PlanHash;mode=$Mode;native=$ReplacementNative;pins=$Pins.Clone();childPid=$r.childPid;childBirth=$r.childBirth;archivePath=$commit.archivePath;hash=$commit.hash}
  $r.publication=$null;$r.pendingHash=$null;$r.before=$null;$r.expected=$null;$r.recordExpected=$null;$r.requestProof=$null
  $leaseRecord=Get-Business5244StartupRecord $r.lease;$leaseRecord.kind='Owner';$r.phase='Running'
 }catch{
  $failure=$_
  if($commit.phase -ceq 'PendingDurable' -and $r.pending){$r.phase='Committing'}else{$r.phase='Unknown';try{Open-Business5244RetirementRecoveryMarker $State}catch{}}
  throw $failure
 }
}
function Close-Business5244RetirementState($State){
 $r=Get-Business5244RetirementState $State
 $natives=[Collections.Generic.List[object]]::new();$failed=$false
 $candidates=@($r.native)+@(if($r.publication){$r.publication.native})+@(if($r.ContainsKey('dispatch') -and $r.dispatch){$r.dispatch.candidateNative;$r.dispatch.rollbackNative})
 foreach($native in $candidates){if(!$native){continue};$seen=$false;foreach($prior in $natives){if([object]::ReferenceEquals($prior,$native)){$seen=$true;break}};if(!$seen){$natives.Add($native);try{$native.Dispose()}catch{$failed=$true}}}
 if($r.ContainsKey('preparedPair') -and $r.preparedPair){try{$r.preparedPair.seal.Dispose()}catch{$failed=$true}}
 if($r.records){try{$r.records.Dispose();$r.records=$null}catch{$failed=$true}};if($r.pending){try{$r.pending.Dispose();$r.pending=$null}catch{$failed=$true}}
 if($failed){throw 'RETIREMENT_CLEANUP_UNCONFIRMED'}
 # Pending file is deliberately retained. It is evidence and a fail-closed
 # restart marker; this source adds no automatic rollback/reset/adoption.
}
if(!$RetirementStateLibrary){throw 'RETIREMENT_STATE_LIBRARY_ONLY'}
