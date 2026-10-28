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
 $r=@{token=$token;lease=$Lease;native=$Native;pins=$Pins.Clone();process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;ownerBirth=$Native.OwnerBirth;childPid=$Native.ChildPid;childBirth=$Native.ChildBirth;phase='Running';records=$null;pending=$null;pendingHash=$null;before=$null;expected=$null;publication=$null;requestProof=$null}
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
function Invoke-Business5244HeldRetirement($State,[IO.FileStream]$Records,[IO.FileStream]$Pending){
 # Core accepts already-held streams; the normal entry below fixes their real
 # paths. No serialized PID, ACK or caller flag can mint this registered state.
 $r=Get-Business5244RetirementState $State
 if($r.phase -cne 'Running'){throw 'RETIREMENT_ALREADY_REQUESTED'}
 $before=Assert-Business5244RetirementRecord $State $Records
 if(!$Pending.CanWrite -or $Pending.Length -ne 0){throw 'RETIREMENT_PENDING_NOT_FRESH'}
 $seal=[ordered]@{schema='business-5244-retirement-before.v1';ownerPid=$PID;ownerBirth=$r.ownerBirth;childPid=$r.childPid;childBirth=$r.childBirth;beforeSha256=(Get-Business5244StartupHash $before);beforeBase64=[Convert]::ToBase64String($before)}
 $bytes=[Text.Encoding]::UTF8.GetBytes(($seal|ConvertTo-Json -Compress))
 $Pending.Write($bytes,0,$bytes.Length);$Pending.Flush($true)
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Pending)) -cne (Get-Business5244StartupHash $bytes)){throw 'RETIREMENT_BEFORE_NOT_DURABLE'}
 $r.records=$Records;$r.pending=$Pending;$r.pendingHash=Get-Business5244StartupHash $bytes;$r.before=$before;$r.expected=Get-Business5244StartupHash $before;$r.phase='Retiring'
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
function Publish-Business5244RetiredRecord($State,$ReplacementNative,[ValidateSet('Candidate','Rollback')][string]$Mode='Candidate'){
 $r=Get-Business5244RetirementState $State
 Assert-Business5244CreatedChild $ReplacementNative $r.pins
 Publish-Business5244HeldRecord $State $ReplacementNative $Mode
}
function Publish-Business5244HeldRecord($State,$ReplacementNative,[ValidateSet('Candidate','Rollback')][string]$Mode='Candidate'){
 # Held publication core; the normal entry above additionally verifies the
 # actual executable/argv/SID through the retained native child identity.
 $r=Get-Business5244RetirementState $State
 Assert-Business5244StartupLease -Lease $r.lease -Kind Maintenance
 if($r.phase -cnotin @('Retired','Published') -or !($ReplacementNative -is [Business5244WebNative]) -or !$ReplacementNative.ChildAlive()){throw 'RETIREMENT_PUBLICATION_NOT_ADMITTED'}
 if((Get-Business5244StartupHash $r.before) -cne $r.expected -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.pending)) -cne $r.pendingHash){throw 'RETIREMENT_BEFORE_IMAGE_CHANGED'}
 $ReplacementNative.Validate()
 $before=ConvertFrom-Business5244RecordBytes $r.before
 $after=@($before|ForEach-Object {if($_.port -eq 5244){if($Mode -ceq 'Rollback'){$copy=$_.PSObject.Copy();$copy.pid=$ReplacementNative.ChildPid;$copy}else{[pscustomobject]@{port=5244;pid=$ReplacementNative.ChildPid;entry='vite-preview';sourceCommit=$r.pins.frontendSource;root=$r.pins.root;backendPort=4144;businessWorkfaceId=$r.pins.profile}}}else{$_}})
 Assert-Business5244RecordStage $before $after $ReplacementNative.ChildPid $Mode $r.pins
 $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $after -Depth 30));$hash=Get-Business5244StartupHash $bytes
 $current=Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)
 if($r.publication){if(![object]::ReferenceEquals($r.publication.native,$ReplacementNative) -or $r.publication.hash -cne $hash -or $r.publication.mode -cne $Mode -or $current -cne $hash){throw 'RETIREMENT_PUBLICATION_REPLAY_CONFLICT'};return}
 if($current -cne $r.expected){throw 'RETIREMENT_RECORD_CAS_CHANGED'}
 $r.publication=@{native=$ReplacementNative;hash=$hash;mode=$Mode;confirmed=$false}
 try{
  $r.records.Position=0;$r.records.SetLength(0);$r.records.Write($bytes,0,$bytes.Length);$r.records.Flush($true)
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $hash){throw 'RETIREMENT_RECORD_WRITE_UNCONFIRMED'}
  $r.publication.confirmed=$true;$r.phase='Published'
 }catch{
  $failure=$_;$r.phase='Unknown'
  try{$observed=Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)}catch{throw $failure}
  if($observed -ceq $hash){
   # A matching cache read is not a durable ACK. Re-flush successfully before
   # reconciling a lost response; otherwise retain Unknown and the held gate.
   try{$r.records.Flush($true);if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $hash){throw 'RETIREMENT_DURABLE_RECHECK_CHANGED'}}catch{throw $failure}
   $r.publication.confirmed=$true;$r.phase='Published';return
  }
  # The exclusive stream prevents concurrent later local writes. Restore only
  # this held publication's bytes; pending marker still blocks normal startup.
  try{$r.records.Position=0;$r.records.SetLength(0);$r.records.Write($r.before,0,$r.before.Length);$r.records.Flush($true);if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $r.records)) -cne $r.expected){throw 'RETIREMENT_RECORD_INVERSE_UNCONFIRMED'};$ReplacementNative.Dispose();$r.publication=$null;$r.phase='Retired'}catch{$r.phase='Unknown'}
  throw $failure
 }
}
function Close-Business5244RetirementState($State){
 $r=Get-Business5244RetirementState $State
 if($r.publication -and $r.publication.native){$r.publication.native.Dispose()}
 if($r.records){$r.records.Dispose();$r.records=$null};if($r.pending){$r.pending.Dispose();$r.pending=$null}
 # Pending file is deliberately retained. It is evidence and a fail-closed
 # restart marker; this source adds no automatic rollback/reset/adoption.
}
if(!$RetirementStateLibrary){throw 'RETIREMENT_STATE_LIBRARY_ONLY'}
