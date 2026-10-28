param([Alias('Library')][switch]$RetirementStateLibrary)
if(!(Get-Variable Business5244Retirements -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244Retirements=[Collections.Generic.List[object]]::new()}
function Get-Business5244RetirementState($State){
 $rows=@($script:Business5244Retirements|Where-Object{[object]::ReferenceEquals($_.token,$State)})
 if($rows.Count -ne 1){throw 'RETIREMENT_STATE_UNISSUED'};$r=$rows[0]
 if($r.process -ne $PID -or $r.thread -ne [Threading.Thread]::CurrentThread.ManagedThreadId){throw 'RETIREMENT_STATE_FOREIGN_THREAD'}
 Assert-Business5244StartupLease -Lease $r.lease
 return $r
}
function Register-Business5244OwnedRetirement($Lease,$Native,$Pins,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213'){
 if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')){throw 'RETIREMENT_SCOPE_REJECTED'}
 Assert-Business5244StartupLease -Lease $Lease -Kind Owner
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  $exact=$false;foreach($mode in @('Current','Candidate')){$fixed=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode $mode;if(!@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile').Where({$Pins[$_]-cne$fixed[$_]}).Count){$exact=$true}}
  if(!$exact){throw 'RETIREMENT_FINITE_B6_PINS_REQUIRED'}
 }
 if(!($Native -is [Business5244WebNative]) -or !$Native.ChildAlive()){throw 'RETIREMENT_OWNED_CHILD_REQUIRED'}
 $Native.Validate();$token=[pscustomobject]@{kind='business-5244-retirement-state'}
 $r=@{token=$token;scopeName=$ScopeName;lease=$Lease;native=$Native;pins=$Pins.Clone();process=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;ownerBirth=$Native.OwnerBirth;childPid=$Native.ChildPid;childBirth=$Native.ChildBirth;phase='Running';records=$null;pending=$null;pendingHash=$null;before=$null;expected=$null;recordExpected=$null;publication=$null;requestProof=$null;commit=$null;lastCompletion=$null;operationId=$null;initializing=$true;initializationApiTransition=$null}
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
function Get-Business5244CurrentBootstrapPins([string]$BeforeHash='',[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213') {
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  # This fixed, read-only predecessor capture never authorizes a process stop.
  # It only binds a stale record CAS after both old generations are absent.
  $path='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\recovered-owner-20261029\current-read2b-owner-capture.json'
  $capture=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $path '9e5f95931caf67bfe3cfa100a755b0b2324a77caf244bfa99da90b9f1d621605'))|ConvertFrom-Json
  $fixed=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current
  if($capture.schema-cne'melisa-b6-current-read2b-owner-capture.v1'-or$capture.predecessorEntryKind-cne'CurrentCore'-or$capture.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261028'-or$capture.entry.leaf-cne'run-current-owner.ps1'-or$capture.entry.manifestSha256-cne'f6c48a1626d281699e14d783b641fcc95ccf9a9de5ad286332b8a1d9e18da235'-or$capture.entry.sha256-cne'b9e9f0661c3349e8a1b56b17460bffbc776fa7990115cba1c04602a3367641cb'-or$capture.readOnly-ne$true-or$capture.stopAuthorized-ne$false-or$capture.recordPath-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'-or$capture.recordBeforeFile-cne'current-erp-processes.before.json'-or$capture.recordBeforeSha256-cne'ea23776035feadb3f206eeed1dae016eb80de0a325fc3978ac9d534a73f251e2'-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.retireCalls-ne0){throw 'CURRENT_BOOTSTRAP_B6_CAPTURE_CHANGED'}
  $w=$capture.webRecord;$n=$capture.nativeStatus;$owner=$capture.owner;$child=$capture.child
  if($w.port-ne5244-or$w.entry-cne'vite-preview'-or$w.root-cne$fixed.root-or$w.sourceCommit-cne$fixed.frontendSource-or$w.backendPort-ne4144-or$w.businessWorkfaceId-cne$fixed.profile-or$w.pid-ne35268-or$child.pid-ne$w.pid-or$child.parent-ne9512-or$owner.pid-ne$child.parent-or$child.exe-cne$fixed.node-or$child.birth-cne'134377042376772453'-or$owner.birth-cne'134377040921549383'-or$n.reply-cne'Status'-or$n.nativePeerVerified-ne$true-or$n.stopAuthorized-ne$false-or$n.childObservationOnly-ne$true-or$n.state.phase-cne'Running'-or$n.state.ownerPid-ne$owner.pid-or$n.state.ownerBirth-cne$owner.birth-or$n.state.childPid-ne$child.pid-or$n.state.childBirth-cne$child.birth-or$capture.installedApiManifest-ine$fixed.apiManifest-or$capture.installedWebManifest-ine$fixed.manifest){throw 'CURRENT_BOOTSTRAP_B6_CAPTURE_IDENTITY'}
  $image=Read-ErpBusinessSalePinnedFile (Join-Path ([IO.Path]::GetDirectoryName($path)) 'current-erp-processes.before.json') $capture.recordBeforeSha256
  $rows=ConvertFrom-Business5244RecordBytes $image;$old=@($rows|Where-Object{$_.port-eq5244})
  if($old.Count-ne1-or(@($old[0].PSObject.Properties.Name|Sort-Object)-join'|')-cne'backendPort|businessWorkfaceId|entry|pid|port|root|sourceCommit'){throw 'CURRENT_BOOTSTRAP_B6_BEFORE_IMAGE'}
  foreach($key in @('pid','root','sourceCommit','entry','port','backendPort','businessWorkfaceId')){if($old[0].$key-cne$w.$key){throw 'CURRENT_BOOTSTRAP_B6_BEFORE_IMAGE'}}
  return @{hash=$capture.recordBeforeSha256;pid=[int]$child.pid;birth=$child.birth;ownerPid=[int]$owner.pid;ownerBirth=$owner.birth;root=$fixed.root;source=$fixed.frontendSource}
 }

 # This is the exact stale CLEAN record observed before the fresh Current start.
 # A caller cannot supply another baseline, PID or product/database target.
 # The first approved attempt durably published this exact Current after-image
 # before request expiry. It is a metadata baseline ONLY: it grants no stop,
 # no Unknown recovery and no authority from an external outcome assertion.
 # Both callers still reject a live old PID and require a new owned child.
 # Second failed admission published this exact same Current package. This
 # pin permits metadata CAS only after external exit; it cannot stop its owner.
 if($BeforeHash-ceq'f0ace9f544671c8028d374e41ceb69a743fb01975998ea4bfedf4ec7661823c7'){
  return @{hash=$BeforeHash;pid=41116;root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-5cb682d8';source='5cb682d8523552745b81422b1c2f0273cc8feb03'}
 }
 if($BeforeHash-ceq'3bfd7f5df1aaedae5835709fd048f27cf35aa97f97a7c561cbd89ee0342827fc'){
  return @{hash=$BeforeHash;pid=25564;root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-5cb682d8';source='5cb682d8523552745b81422b1c2f0273cc8feb03'}
 }
 return @{hash='24bb8c6553b039981761dd188584c7787798fa1a3be972082e7439f34fd5e560';pid=2000;root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-d4f52345';source='d875dc6e59d70230b8c931f718bac30438778ec1'}
}
function Assert-Business5244CurrentBootstrapBefore($State,[IO.FileStream]$Records){
 $r=Get-Business5244RetirementState $State;$fixed=Get-Business5244FinitePairPins -ScopeName $r.scopeName -Mode Current;$stale=Get-Business5244CurrentBootstrapPins (Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records)) -ScopeName $r.scopeName
 Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 if($r.phase -cne 'Running' -or $r.records -or $r.pending -or !$Records.CanRead -or !$Records.CanWrite -or $r.childPid -ne $r.native.ChildPid -or $r.childBirth -cne $r.native.ChildBirth){throw 'CURRENT_BOOTSTRAP_NOT_ADMITTED'}
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($r.pins[$key] -cne $fixed[$key]){throw 'CURRENT_BOOTSTRAP_NOT_FIXED_CURRENT'}}
 Assert-Business5244CreatedChild $r.native $fixed;Assert-Business5244ReadyChild $r.native $fixed
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records)) -cne $stale.hash){throw 'CURRENT_BOOTSTRAP_BASE_CHANGED'}
 if(Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.pid)){throw 'CURRENT_BOOTSTRAP_OLD_PID_PRESENT'}
 if($stale.ContainsKey('ownerPid')-and(Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.ownerPid))){throw 'CURRENT_BOOTSTRAP_OLD_OWNER_PRESENT'}
}
function Publish-Business5244HeldCurrentRecord($State,[IO.FileStream]$Records,[IO.FileStream]$Pending){
 $r=Get-Business5244RetirementState $State
 Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 $fixed=Get-Business5244FinitePairPins -ScopeName $r.scopeName -Mode Current
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
 $stale=Get-Business5244CurrentBootstrapPins $beforeHash -ScopeName $r.scopeName
 if($beforeHash -cne $stale.hash){throw 'CURRENT_BOOTSTRAP_BASE_CHANGED'}
 $old=@($rows|Where-Object {$_.port -eq 5244})
 if($old.Count -ne 1 -or $old[0].pid -ne $stale.pid -or $old[0].root -cne $stale.root -or $old[0].sourceCommit -cne $stale.source -or $old[0].entry -cne 'vite-preview' -or $old[0].backendPort -ne 4144 -or $old[0].businessWorkfaceId -cne $fixed.profile){throw 'CURRENT_BOOTSTRAP_STALE_IDENTITY_CHANGED'}
 if(Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.pid)){throw 'CURRENT_BOOTSTRAP_OLD_PID_PRESENT'}
 if($stale.ContainsKey('ownerPid')-and(Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.ownerPid))){throw 'CURRENT_BOOTSTRAP_OLD_OWNER_PRESENT'}
 if(!$Pending.CanRead -or !$Pending.CanWrite -or $Pending.Length -ne 0){throw 'CURRENT_BOOTSTRAP_PENDING_NOT_FRESH'}
 $after=@($rows|ForEach-Object {if($_.port -eq 5244){[pscustomobject]@{port=5244;pid=$r.childPid;entry='vite-preview';sourceCommit=$fixed.frontendSource;root=$fixed.root;backendPort=4144;businessWorkfaceId=$fixed.profile}}else{$_}})
 Assert-Business5244RecordStage $rows $after $r.childPid Candidate $fixed
 $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $after -Depth 30));$hash=Get-Business5244StartupHash $bytes
 $id=[Guid]::NewGuid().ToString('N');$archive=$Pending.Name+'.'+$id+'.bootstrap.completed'
 $seal=[Text.Encoding]::UTF8.GetBytes((@{schema='business-5244-current-bootstrap.v1';operationId=$id;ownerPid=$PID;ownerBirth=$r.ownerBirth;childPid=$r.childPid;childBirth=$r.childBirth;beforeHash=$beforeHash;afterHash=$hash;beforeBase64=[Convert]::ToBase64String($before)}|ConvertTo-Json -Compress))
 # Keep both exclusive record ownership and durable evidence through publication.
 # An uncertain write never restores the stale PID or stops any process.
 $r.records=$Records;$r.pending=$Pending;$r.currentBootstrap=@{phase='Preparing';childPid=$r.childPid;childBirth=$r.childBirth;afterHash=$hash;archive=$archive;archiveHash=(Get-Business5244StartupHash $seal);beforeBytes=$before.Clone();beforeHash=$beforeHash;native=$r.native;ownerPid=$PID;ownerBirth=$r.ownerBirth;inverse=$null}
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
function Assert-Business5244BootstrapInitialization($State){
 $r=Get-Business5244RetirementState $State
 Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 if($r.scopeName-cne'TEST125-API-B6-ca620bac-20261028'-or!$r.initializing-or$r.phase-cne'Running'-or$r.requestProof-or$r.operationId-or$r.commit-or$r.publication-or$r.lastCompletion-or($r.ContainsKey('dispatch')-and$r.dispatch)-or$r.records-or$r.pending){throw 'CURRENT_BOOTSTRAP_INIT_INVERSE_NOT_ADMITTED'}
 $b=if($r.ContainsKey('currentBootstrap')){$r.currentBootstrap}else{$null}
 if(!$b-or$b.phase-cne'Archived'-or$b.inverse-or![object]::ReferenceEquals($b.native,$r.native)-or$b.ownerPid-ne$PID-or$b.ownerBirth-cne$r.ownerBirth-or$b.childPid-ne$r.childPid-or$b.childBirth-cne$r.childBirth-or(Get-Business5244StartupHash $b.beforeBytes)-cne$b.beforeHash){throw 'CURRENT_BOOTSTRAP_INIT_INVERSE_NOT_ADMITTED'}
 if($r.ContainsKey('preparedPair')-and$r.preparedPair-and(!$r.initializationApiTransition-or![object]::ReferenceEquals($r.preparedPair.apiTransition,$r.initializationApiTransition))){throw 'CURRENT_BOOTSTRAP_INIT_API_REFERENCE_CHANGED'}
 if($r.initializationApiTransition){
  $api=Assert-Test125ReadPairIssued $r.initializationApiTransition
  if($api.mode-cne'Current'-or$api.phase-cne'PREPARED'-or$api.activeBinding-or$api.changed-or$api.apiChanged-or$api.taskStopped-or$api.candidateAttempted-or$api.nativeChangeAttempted-or$api.nativeApplied){throw 'CURRENT_BOOTSTRAP_INIT_API_EFFECTS_PRESENT'}
  [void](Assert-Test125ReadPairTransition $r.initializationApiTransition -Mode Current)
 }
 $fixed=Get-Business5244FinitePairPins -ScopeName $r.scopeName -Mode Current
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($r.pins[$key]-cne$fixed[$key]){throw 'CURRENT_BOOTSTRAP_INIT_INVERSE_NOT_CURRENT'}}
 # A failed initializer may already have lost its own child. This exact
 # archived/no-effects inverse trusts the retained creation object and kernel
 # birth, never a fresh CIM PID or network health as ownership evidence.
 if(!($r.native-is[Business5244WebNative])-or$r.native.ChildPid-ne$b.childPid-or$r.native.ChildBirth-cne$b.childBirth-or$r.native.OwnerBirth-cne$b.ownerBirth){throw 'CURRENT_BOOTSTRAP_INIT_NATIVE_CHANGED'}
 $r.native.Validate();[void]$r.native.ChildAlive()
 return $r
}
function Undo-Business5244HeldCurrentBootstrap($State,[IO.FileStream]$Records,[IO.FileStream]$Pending){
 # Only the owner which actually created this child can undo a pre-channel
 # bootstrap. Serialized outcomes, archived bytes and external PIDs cannot
 # authorize stopping or restoring a generation.
 $r=Assert-Business5244BootstrapInitialization $State;$b=$r.currentBootstrap;$native=$r.native
 if(!$Records.CanRead-or!$Records.CanWrite-or!$Pending.CanRead-or!$Pending.CanWrite-or$Pending.Length-ne0){throw 'CURRENT_BOOTSTRAP_INIT_STREAMS_REQUIRED'}
 $actual=Read-Business5244RetirementBytes $Records
 if((Get-Business5244StartupHash $actual)-cne$b.afterHash-or(Get-FileHash -LiteralPath $b.archive -Algorithm SHA256).Hash-ine$b.archiveHash){throw 'CURRENT_BOOTSTRAP_INIT_CAS_CHANGED'}
 $beforeRows=ConvertFrom-Business5244RecordBytes $b.beforeBytes;$afterRows=ConvertFrom-Business5244RecordBytes $actual
 Assert-Business5244RecordStage $beforeRows $afterRows $r.childPid Candidate $r.pins
 $stale=Get-Business5244CurrentBootstrapPins $b.beforeHash -ScopeName $r.scopeName
 if($stale.hash-cne$b.beforeHash){throw 'CURRENT_BOOTSTRAP_INIT_BEFORE_CHANGED'}
 $archive=$Pending.Name+'.'+[Guid]::NewGuid().ToString('N')+'.init-undone.completed'
 $seal=[Text.Encoding]::UTF8.GetBytes((@{schema='business-5244-bootstrap-init-inverse.v1';ownerPid=$PID;ownerBirth=$r.ownerBirth;childPid=$r.childPid;childBirth=$r.childBirth;bootstrapArchiveHash=$b.archiveHash;ownedAfterHash=$b.afterHash;restoredBeforeHash=$b.beforeHash}|ConvertTo-Json -Compress))
 $r.records=$Records;$r.pending=$Pending;$b.inverse=@{phase='Preparing';archive=$archive;hash=(Get-Business5244StartupHash $seal)}
 try{
  $Pending.Write($seal,0,$seal.Length);$Pending.Flush($true)
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Pending))-cne$b.inverse.hash){throw 'CURRENT_BOOTSTRAP_INIT_INVERSE_NOT_DURABLE'}
  # Native Dispose closes only its own Job and verifies its retained child
  # kernel handle exited. No lookup/adoption or foreign process stop exists.
  $native.Validate();$native.Dispose()
  if(![object]::ReferenceEquals($native,$r.native)-or!$native.RetirementConfirmed-or$native.ChildPid-ne$b.childPid-or$native.ChildBirth-cne$b.childBirth-or@(Get-NetTCPConnection -State Listen -LocalPort 5244 -ErrorAction SilentlyContinue).Count){throw 'CURRENT_BOOTSTRAP_INIT_EXIT_UNCONFIRMED'}
  Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
  if((Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.pid))-or($stale.ContainsKey('ownerPid')-and(Get-CimInstance Win32_Process -Filter ('ProcessId='+$stale.ownerPid)))){throw 'CURRENT_BOOTSTRAP_INIT_PREDECESSOR_PRESENT'}
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records))-cne$b.afterHash){throw 'CURRENT_BOOTSTRAP_INIT_CAS_CHANGED'}
  $Records.Position=0;$Records.SetLength(0);$Records.Write($b.beforeBytes,0,$b.beforeBytes.Length);$Records.Flush($true)
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $Records))-cne$b.beforeHash){throw 'CURRENT_BOOTSTRAP_INIT_RESTORE_UNCONFIRMED'}
  $pendingName=$Pending.Name;$Pending.Dispose();$r.pending=$null
  try{Move-Business5244PendingArchive $pendingName $archive}catch{if((Test-Path -LiteralPath $pendingName)-or!(Test-Path -LiteralPath $archive)-or(Get-FileHash -LiteralPath $archive).Hash-ine$b.inverse.hash){throw}}
  if((Test-Path -LiteralPath $pendingName)-or(Get-FileHash -LiteralPath $archive).Hash-ine$b.inverse.hash){throw 'CURRENT_BOOTSTRAP_INIT_ARCHIVE_UNCONFIRMED'}
  $b.inverse.phase='Archived';$r.phase='InitializationRestored';$r.records=$null
  return [pscustomobject]@{verified=$true;restoredRecordHash=$b.beforeHash;childPid=$b.childPid;childBirth=$b.childBirth;archive=$archive}
 }catch{
  $r.phase='Unknown';$b.inverse.phase='Unknown'
  if(!$r.pending){try{$marker=[IO.File]::Open($Pending.Name,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);$r.pending=$marker;$marker.Write($seal,0,$seal.Length);$marker.Flush($true)}catch{}}
  throw
 }
}
function Undo-Business5244CurrentBootstrap($State){
 $r=Assert-Business5244BootstrapInitialization $State
 $recordsPath='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';$pendingPath=Get-Business5244RetirementPendingPath;$records=$null;$pending=$null
 try{
  foreach($file in @($recordsPath,$pendingPath,$r.currentBootstrap.archive)){for($part=$file;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Test-Path -LiteralPath $part)-and((Get-Item -LiteralPath $part).Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'CURRENT_BOOTSTRAP_INIT_REPARSE_POINT'}}}
  $records=[IO.File]::Open($recordsPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  return Undo-Business5244HeldCurrentBootstrap $State $records $pending
 }finally{if(!$r.records){if($records){$records.Dispose()};if($pending){$pending.Dispose()}}}
}
function Invoke-Business5244HeldRetirement($State,[IO.FileStream]$Records,[IO.FileStream]$Pending){
 # Core accepts already-held streams; the normal entry below fixes their real
 # paths. No serialized PID, ACK or caller flag can mint this registered state.
 $r=Get-Business5244RetirementState $State
 if($r.phase -cne 'Running'){throw 'RETIREMENT_ALREADY_REQUESTED'}
 $before=Assert-Business5244RetirementRecord $State $Records
 if(!$Pending.CanWrite -or $Pending.Length -ne 0){throw 'RETIREMENT_PENDING_NOT_FRESH'}
 if($r.requestProof){Assert-Business5244RetirementRequest -Channel $r.requestProof.channel -Request $r.requestProof.request}
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
  Assert-Business5244RetirementRequest -Channel $Channel -Request $Request
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
