param([Alias('Library')][switch]$RetirementStateLibrary)
if(!(Get-Variable Business5244Retirements -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244Retirements=[Collections.Generic.List[object]]::new()}
function Get-Business5244RetirementState($State){
 $rows=@($script:Business5244Retirements|Where-Object{[object]::ReferenceEquals($_.token,$State)})
 if($rows.Count -ne 1){throw 'RETIREMENT_STATE_UNISSUED'};$r=$rows[0]
 if($r.process -ne $PID -or $r.thread -ne [Threading.Thread]::CurrentThread.ManagedThreadId){throw 'RETIREMENT_STATE_FOREIGN_THREAD'}
 Assert-Business5244StartupLease -Lease $r.lease
 return $r
}
function Register-Business5244OwnedRetirement($Lease,$Native,$Pins,[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213'){
 if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){throw 'RETIREMENT_SCOPE_REJECTED'}
 Assert-Business5244StartupLease -Lease $Lease -Kind Owner
 if($ScopeName-cin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){
  $modes=if(Test-Business5244SteadyGeneration){@('Current')}else{@('Current','Candidate')}
  $exact=$false;foreach($mode in $modes){$fixed=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode $mode;if(!@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile').Where({$Pins[$_]-cne$fixed[$_]}).Count){$exact=$true}}
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
function Get-Business5244WriterWebOnlyBootstrapPins([string]$BeforeHash){
 if(!(Test-Business5244WriterWebOnlyGeneration)){throw 'CURRENT_BOOTSTRAP_WEB_ONLY_GENERATION_REQUIRED'}
 $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-workface-build-20261029\current-capture-corrected'
 $captureHash='e480d77c835f3c2170589b9fbafec6da78dd2a19624d486d8822ad7b930d3a09';$recordHash='fe5a222107e2a056d649a26f1dfa86d576f6a3d29fe413731c995c7b295183db'
 if($captureHash-cnotmatch'\A[a-f0-9]{64}\z'-or$recordHash-cnotmatch'\A[a-f0-9]{64}\z'-or$BeforeHash-cne$recordHash){throw 'CURRENT_BOOTSTRAP_WEB_ONLY_BEFORE_CHANGED'}
 $capture=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-read2b-owner-capture.json') $captureHash))|ConvertFrom-Json
 $fixed=Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-WRITER-20261029' -Mode Current
 if($capture.schema-cne'melisa-b6-writer-current-owner-capture.v1'-or$capture.predecessorEntryKind-cne'ReadPairRouter'-or$capture.readOnly-isnot[bool]-or!$capture.readOnly-or$capture.stopAuthorized-isnot[bool]-or$capture.stopAuthorized-or$capture.recordPath-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'-or$capture.recordBeforeFile-cne'current-erp-processes.before.json'-or$capture.recordBeforeSha256-cne$recordHash-or$capture.owner.pid-ne45612-or$capture.owner.birth-cne'134377648982508423'-or$capture.child.pid-ne52420-or$capture.child.parent-ne45612-or$capture.child.birth-cne'134377689444377841'-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.retireCalls-ne0){throw 'CURRENT_BOOTSTRAP_WEB_ONLY_CAPTURE_CHANGED'}
 $oldCore='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2';$oldRouter='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2'
 $oldCoreHash='2d1047887212c9e131a53da0f7f865a48909c90f0d6b84756c589fc8fdbbcdd2';$oldRouterHash='7f44b5b61e4cc8867aa25a84a2820974b632c0bdba318711e67c8ef24c7b5602'
 $cm=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $oldCore 'owner-manifest.json') $oldCoreHash))|ConvertFrom-Json
 $rm=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $oldRouter 'owner-manifest.json') $oldRouterHash))|ConvertFrom-Json
 if($capture.core.root-cne$oldCore-or$capture.core.manifestSha256-cne$oldCoreHash-or$capture.core.sourceCommit-cne'd0b457f2ee9911dc2bf0b453723a91264ff551b6'-or$capture.router.root-cne$oldRouter-or$capture.router.manifestSha256-cne$oldRouterHash-or$capture.entry.root-cne$oldRouter-or$capture.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$capture.entry.manifestSha256-cne$oldRouterHash-or$capture.entry.sha256-cne'2b0c4e83bb8c7f9a3c5f00d1ef90aa66a34a7e2a4eaf207832e9705913c03ecb'-or$capture.entry.runtimeEntryBytesVerified-ne$false-or$capture.entry.postExitExclusiveBytesRequired-ne$true-or$cm.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$cm.finiteScope-cne'TEST125-API-B6-WRITER-20261029'-or$cm.sourceCommit-cne$capture.core.sourceCommit-or$cm.maintenancePurpose-cne'WriterProfileActivation'-or$rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.coreRoot-cne$oldCore-or$rm.coreManifestSha256-cne$oldCoreHash-or$rm.entrySha256-cne$capture.entry.sha256){throw 'CURRENT_BOOTSTRAP_WEB_ONLY_SOURCE_CHANGED'}
 $image=Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-erp-processes.before.json') $recordHash
 $rows=ConvertFrom-Business5244RecordBytes $image;$old=@($rows|Where-Object port -eq 5244);$w=$capture.webRecord;$n=$capture.nativeStatus
 if($old.Count-ne1-or(@($old[0].PSObject.Properties.Name|Sort-Object)-join'|')-cne'backendPort|businessWorkfaceId|entry|pid|port|root|sourceCommit'-or$w.pid-ne$capture.child.pid-or$w.root-cne$fixed.root-or$w.sourceCommit-cne$fixed.frontendSource-or$w.port-ne5244-or$w.entry-cne'vite-preview'-or$w.backendPort-ne4144-or$w.businessWorkfaceId-cne$fixed.profile-or$capture.child.exe-cne$fixed.node-or$capture.installedApiManifest-cne$fixed.apiManifest-or$capture.installedWebManifest-cne$fixed.manifest-or$n.reply-cne'Status'-or$n.nativePeerVerified-isnot[bool]-or!$n.nativePeerVerified-or$n.stopAuthorized-isnot[bool]-or$n.stopAuthorized-or$n.childObservationOnly-isnot[bool]-or!$n.childObservationOnly-or$n.state.phase-cne'Running'-or$n.state.ownerPid-ne45612-or$n.state.ownerBirth-cne$capture.owner.birth-or$n.state.childPid-ne52420-or$n.state.childBirth-cne$capture.child.birth){throw 'CURRENT_BOOTSTRAP_WEB_ONLY_IDENTITY_CHANGED'}
 foreach($key in @('pid','root','sourceCommit','entry','port','backendPort','businessWorkfaceId')){if($old[0].$key-cne$w.$key){throw 'CURRENT_BOOTSTRAP_WEB_ONLY_RECORD_CHANGED'}}
 return @{hash=$recordHash;pid=[int]$capture.child.pid;birth=$capture.child.birth;ownerPid=[int]$capture.owner.pid;ownerBirth=$capture.owner.birth;root=$fixed.root;source=$fixed.frontendSource}
}
function Get-Business5244CurrentBootstrapPins([string]$BeforeHash='',[ValidateSet('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')][string]$ScopeName='TEST125-API-READ2b-20261028-41d3c213') {
 if($ScopeName-cnotin@('TEST125-API-READ2b-20261028-41d3c213','TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')){throw 'CURRENT_BOOTSTRAP_SCOPE_REJECTED'}
 if($ScopeName-ceq'TEST125-API-B6-WRITER-20261029'){
  if(Test-Business5244WriterWebOnlyGeneration){return Get-Business5244WriterWebOnlyBootstrapPins $BeforeHash}
  # This immutable observation identifies the Applied-B6 metadata predecessor;
  # it grants no stop, process adoption, profile change or native SQL replay.
  $v2=$BeforeHash-ceq'48603c39c67aed102b0887d2a0824d5afc9e27aeade02bd4e0436a34a8f51334'
  if(!$v2-and$BeforeHash-cne'b07100ff411f917c2eaf09e0b14b8844666242badfc4d1556a8e6b3253afadf0'){throw 'CURRENT_BOOTSTRAP_WRITER_BEFORE_CHANGED'}
  if($v2){
   $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029';$captureHash='50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65';$entriesHash='95b27499bd60bba1e32c3a173e5c573e434c9b31014f796ba62a0c7442dc440a';$entryCount=24;$directCount=18
   $oldOwner=17372;$oldOwnerBirth='134377623115780499';$oldChild=14836;$oldChildBirth='134377623535118145';$ownerArgvHash='add3b1a736b6ad93bbc94aad6abf61c4c4f37d9973115e24f06840b1f503e7c3';$oldKind='CurrentCore'
   $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029';$coreHash='cf470ca1587cfe38c79617f9fd312b3bac430636ff66d83a42dbec4a05d7ffee';$routerHash='d0875d5ef6c847b2f8df63b6018d3ca5db4ef20bbbbe133cd1b3815e07963eaf';$entryHash='f37217b0f6e74bf721160bd056c179e3208ae56f2e25b56656b56f08f333ef8c';$entryRoot=$core;$entryLeaf='run-current-owner.ps1';$entryManifestHash=$coreHash;$oldScope='TEST125-API-B6-WRITER-20261029';$oldPurpose='WriterProfileActivation';$oldSource='16daf65071da498ae3cdd779157f7004244bb630'
  }else{
   $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-20261029';$captureHash='86b2ee054f3cc9fa794c7013a816faa3a2af5a392e10afef08a09c76f84e7161';$entriesHash='4891f1e095cd0cfaef9221e56a16af29c2b234a9909009db47e00c533c9b957c';$entryCount=22;$directCount=16
   $oldOwner=45104;$oldOwnerBirth='134377531591976073';$oldChild=33576;$oldChildBirth='134377540528369398';$ownerArgvHash='57515c57fd7cf81404d098cb265e5914a6f6d8e983c72abfcf7d11c91310e6e4';$oldKind='ReadPairRouter'
   $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY';$coreHash='554e46b609961ab3a9186460d09901a050212503770a0eaab7c7cc003b37e41e';$routerHash='ee0ba9bbe46d65b0357c7a75d21a2f004eea68c5f5e76f7a4e70c0012cdb135a';$entryHash='6a6dc3f649de4c912a57a7c940def7c4594ae3df8b014079f6a198340994ac8c';$entryRoot=$router;$entryLeaf='start-business-5244-readpair-router.ps1';$entryManifestHash=$routerHash;$oldScope='TEST125-API-B6-ca620bac-20261028';$oldPurpose='CandidateMetadataApply';$oldSource='9f9a45bb36d52daa5ee202520e93c84e544d01ac'
  }
  $capture=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-read2b-owner-capture.json') $captureHash))|ConvertFrom-Json
  $entries=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-entry-hold-capture.json') $entriesHash))|ConvertFrom-Json
  $task=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-task-capture.json') '208bad4f906d910a2dc247f2cb08db0f2e47f07421b256997a93239cc0f967e6'))|ConvertFrom-Json
  [void](Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-task.before.xml') '46fadd9b79c291a8f1aa3299ef5fdb7d8a2f8f26968acf5a92c8f462b77831ec')
  [void](Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-task.before.sddl') 'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4')
  $image=Read-ErpBusinessSalePinnedFile (Join-Path $root 'current-erp-processes.before.json') $BeforeHash
  $fixed=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current
  if($capture.schema-cne'melisa-b6-writer-current-owner-capture.v1'-or$capture.predecessorEntryKind-cne$oldKind-or$capture.readOnly-isnot[bool]-or!$capture.readOnly-or$capture.stopAuthorized-isnot[bool]-or$capture.stopAuthorized-or$capture.recordBeforeSha256-cne$BeforeHash-or$capture.owner.pid-ne$oldOwner-or$capture.owner.birth-cne$oldOwnerBirth-or$capture.child.pid-ne$oldChild-or$capture.child.birth-cne$oldChildBirth-or$capture.child.parent-ne$oldOwner-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.retireCalls-ne0){throw 'CURRENT_BOOTSTRAP_WRITER_CAPTURE_CHANGED'}
  if((Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($capture.owner.argv)))-cne$ownerArgvHash-or(Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($capture.child.argv)))-cne'81655f3d196151ed6f0f123afa1aa7b9126d5257f012d8fdd9846b555d0851e1'){throw 'CURRENT_BOOTSTRAP_WRITER_ARGV_CHANGED'}
  if($entries.schema-cne'melisa-b6-writer-current-entry-capture.v1'-or$entries.readOnly-isnot[bool]-or!$entries.readOnly-or$entries.executionAuthority-isnot[bool]-or$entries.executionAuthority-or$entries.ownerCaptureSha256-cne$captureHash-or@($entries.entries).Count-ne6-or@($entries.directEntries).Count-ne$directCount-or$entries.postExitExclusiveEntryCount-ne$entryCount-or$entries.runtimeValidationComplete-isnot[bool]-or$entries.runtimeValidationComplete-or$entries.entryWrites-ne0-or$entries.serviceCalls-ne0-or$entries.sqlCalls-ne0){throw 'CURRENT_BOOTSTRAP_WRITER_ENTRY_CAPTURE_CHANGED'}
  if($task.schema-cne'melisa-b6-task-capture.v1'-or$task.readOnly-isnot[bool]-or!$task.readOnly-or$task.xmlSha256-cne'46fadd9b79c291a8f1aa3299ef5fdb7d8a2f8f26968acf5a92c8f462b77831ec'-or$task.sddlSha256-cne'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4'-or$task.writes-ne0){throw 'CURRENT_BOOTSTRAP_WRITER_TASK_CAPTURE_CHANGED'}
  $cm=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $core 'owner-manifest.json') $coreHash))|ConvertFrom-Json
  $rm=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $router 'owner-manifest.json') $routerHash))|ConvertFrom-Json
  if($cm.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$cm.finiteScope-cne$oldScope-or$cm.sourceCommit-cne$oldSource-or$cm.rehearsalOnly-isnot[bool]-or$cm.rehearsalOnly-or$cm.maintenancePurpose-cne$oldPurpose-or$cm.recordingEnabled-isnot[bool]-or$cm.recordingEnabled-or@($cm.files).Count-ne13-or$rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.finiteScope-cne$cm.finiteScope-or$rm.entrySourceCommit-cne$cm.sourceCommit-or$rm.rehearsalOnly-isnot[bool]-or$rm.rehearsalOnly-or$rm.maintenancePurpose-cne$oldPurpose-or$rm.coreRoot-cne$core-or$rm.coreManifestSha256-cne$capture.core.manifestSha256-or$capture.core.manifestSha256-cne$coreHash-or$capture.core.root-cne$core-or$capture.router.root-cne$router-or$capture.router.manifestSha256-cne$routerHash-or$capture.entry.root-cne$entryRoot-or$capture.entry.leaf-cne$entryLeaf-or$capture.entry.manifestSha256-cne$entryManifestHash-or$capture.entry.sha256-cne$entryHash-or(!$v2-and$capture.entry.sha256-cne$rm.entrySha256)-or$capture.entry.runtimeEntryBytesVerified-isnot[bool]-or$capture.entry.runtimeEntryBytesVerified-or$capture.entry.postExitExclusiveBytesRequired-isnot[bool]-or!$capture.entry.postExitExclusiveBytesRequired){throw 'CURRENT_BOOTSTRAP_WRITER_SOURCE_CHANGED'}
  if($v2){
   if($capture.core.sourceCommit-cne$oldSource-or$capture.router.entrySha256-cne'edd0191b0b8107766b1ab4a4ff44cec17e6bc7b69d5024098ae5fe67a3dc99c4'-or$rm.entrySha256-cne$capture.router.entrySha256){throw 'CURRENT_BOOTSTRAP_WRITER_V2_SOURCE_CHANGED'}
   $launcher=$capture.taskLauncher;$launcherRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY'
   if((@($launcher.PSObject.Properties.Name|Sort-Object)-join'|')-cne'bytes|coreManifestSha256|coreRoot|path|sha256'-or$launcher.path-cne(Join-Path $launcherRoot 'start-owned-test.ps1')-or$launcher.sha256-cne'1728c4d5dcc7eab597640550d068f84140a37d2820620a0a24bcdd3f8e39a917'-or$launcher.bytes-ne26901-or$launcher.coreRoot-cne$launcherRoot-or$launcher.coreManifestSha256-cne'554e46b609961ab3a9186460d09901a050212503770a0eaab7c7cc003b37e41e'){throw 'CURRENT_BOOTSTRAP_WRITER_V2_TASK_SOURCE_CHANGED'}
   [void](Read-ErpBusinessSalePinnedFile (Join-Path $launcherRoot 'owner-manifest.json') $launcher.coreManifestSha256)
   $launcherBytes=Read-ErpBusinessSalePinnedFile $launcher.path $launcher.sha256;if($launcherBytes.Length-ne$launcher.bytes){throw 'CURRENT_BOOTSTRAP_WRITER_V2_TASK_SOURCE_CHANGED'}
  }
  $rows=ConvertFrom-Business5244RecordBytes $image;$old=@($rows|Where-Object port -eq 5244);$w=$capture.webRecord;$n=$capture.nativeStatus
  if($old.Count-ne1-or(@($old[0].PSObject.Properties.Name|Sort-Object)-join'|')-cne'backendPort|businessWorkfaceId|entry|pid|port|root|sourceCommit'-or$w.pid-ne$oldChild-or$w.port-ne5244-or$w.root-cne$fixed.root-or$w.sourceCommit-cne$fixed.frontendSource-or$w.entry-cne'vite-preview'-or$w.backendPort-ne4144-or$w.businessWorkfaceId-cne$fixed.profile-or$capture.child.exe-cne$fixed.node-or$capture.owner.exe-ine(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')-or$capture.installedApiManifest-cne$fixed.apiManifest-or$capture.installedWebManifest-cne$fixed.manifest-or$n.reply-cne'Status'-or$n.nativePeerVerified-isnot[bool]-or!$n.nativePeerVerified-or$n.stopAuthorized-isnot[bool]-or$n.stopAuthorized-or$n.childObservationOnly-isnot[bool]-or!$n.childObservationOnly-or$n.state.phase-cne'Running'-or$n.state.ownerPid-ne$oldOwner-or$n.state.ownerBirth-cne$capture.owner.birth-or$n.state.childPid-ne$oldChild-or$n.state.childBirth-cne$capture.child.birth){throw 'CURRENT_BOOTSTRAP_WRITER_IDENTITY_CHANGED'}
  foreach($key in @('pid','root','sourceCommit','entry','port','backendPort','businessWorkfaceId')){if($old[0].$key-cne$w.$key){throw 'CURRENT_BOOTSTRAP_WRITER_BEFORE_IMAGE_CHANGED'}}
  return @{hash=$BeforeHash;pid=$oldChild;birth=$oldChildBirth;ownerPid=$oldOwner;ownerBirth=$oldOwnerBirth;root=$fixed.root;source=$fixed.frontendSource}
 }
 if($ScopeName-ceq'TEST125-API-B6-ca620bac-20261028'){
  if($BeforeHash-ceq'3e9a6a8f96185677a654a9b2bd7e890ab838773c424dcc35b1532b928f9f11b8'){
   # Read-only evidence of the completed V3 Current return. This finite CAS
   # predecessor does not grant stop authority or reuse its restored admission.
   $path='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-candidate-apply-debafecb-20261029\current-read2b-owner-capture.json'
   $capture=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $path '3f7d2484310246df0b01d8b1692d16fdfc70b75a4545c0344bcb941118110642'))|ConvertFrom-Json
   $fixed=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current
   if($capture.schema-cne'melisa-b6-current-read2b-owner-capture.v1'-or$capture.predecessorEntryKind-cne'ReadPairRouter'-or$capture.readOnly-ne$true-or$capture.stopAuthorized-ne$false-or$capture.recordBeforeSha256-cne$BeforeHash-or$capture.owner.pid-ne38992-or$capture.owner.birth-cne'134377492746263010'-or$capture.child.pid-ne46984-or$capture.child.birth-cne'134377502264500436'-or$capture.child.parent-ne38992-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.retireCalls-ne0){throw 'CURRENT_BOOTSTRAP_B6_V3_CAPTURE_CHANGED'}
   $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3'
   $cm=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $core 'owner-manifest.json') 'cfc30ab5e3ef7774c92eb2085d66adabc1d0359d7343e63f8eb727ab7d40383f'))|ConvertFrom-Json
   $rm=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile (Join-Path $router 'owner-manifest.json') 'a275fdbe5fc009feeb10f59c71cd915734303c91c2b4c31f2afad255c5de2f58'))|ConvertFrom-Json
   if($cm.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$cm.rehearsalOnly-ne$true-or$cm.sourceCommit-cne'f18f7bbec0d95ac10e3be91bd5f7137819f16514'-or$rm.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$rm.rehearsalOnly-ne$true-or$rm.coreRoot-cne$core-or$rm.coreManifestSha256-cne$capture.core.manifestSha256-or$capture.entry.root-cne$router-or$capture.router.root-cne$router-or$capture.core.root-cne$core-or$capture.entry.manifestSha256-cne$capture.router.manifestSha256-or$capture.entry.sha256-cne$rm.entrySha256-or$capture.entry.runtimeEntryBytesVerified-ne$false-or$capture.entry.postExitExclusiveBytesRequired-ne$true){throw 'CURRENT_BOOTSTRAP_B6_V3_SOURCE_CHANGED'}
   $image=Read-ErpBusinessSalePinnedFile (Join-Path ([IO.Path]::GetDirectoryName($path)) 'current-erp-processes.before.json') $BeforeHash
   $rows=ConvertFrom-Business5244RecordBytes $image;$old=@($rows|Where-Object port -eq 5244);$w=$capture.webRecord;$n=$capture.nativeStatus
   if($old.Count-ne1-or$w.pid-ne46984-or$w.root-cne$fixed.root-or$w.sourceCommit-cne$fixed.frontendSource-or$w.entry-cne'vite-preview'-or$w.backendPort-ne4144-or$w.businessWorkfaceId-cne$fixed.profile-or$capture.child.exe-cne$fixed.node-or$capture.installedApiManifest-ine$fixed.apiManifest-or$capture.installedWebManifest-ine$fixed.manifest-or$n.reply-cne'Status'-or$n.nativePeerVerified-ne$true-or$n.state.phase-cne'Running'-or$n.state.ownerPid-ne38992-or$n.state.childPid-ne46984){throw 'CURRENT_BOOTSTRAP_B6_V3_IDENTITY_CHANGED'}
   foreach($key in @('pid','root','sourceCommit','entry','port','backendPort','businessWorkfaceId')){if($old[0].$key-cne$w.$key){throw 'CURRENT_BOOTSTRAP_B6_V3_BEFORE_IMAGE_CHANGED'}}
   return @{hash=$BeforeHash;pid=46984;birth='134377502264500436';ownerPid=38992;ownerBirth='134377492746263010';root=$fixed.root;source=$fixed.frontendSource}
  }
  if($BeforeHash-ceq'81862843a2595587771a8779b23a965b3139cbd8145680af52e4a663c7d2cc17'){
   # A second finite predecessor, selected only by the actual held before-image.
   # Its captured status/argv/protection data is metadata, never stop authority.
   # The existing bootstrap still requires a genuine new native child, absent
   # old owner/child and the exclusive durable record CAS before publication.
   $path='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029\current-read2b-owner-capture.json'
   $capture=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $path '2f066cc82af4fe23337a3469091aad40d6d065a66af72f60db34f2e16152c364'))|ConvertFrom-Json
   $fixed=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current
   if($capture.schema-cne'melisa-b6-current-read2b-owner-capture.v1'-or$capture.predecessorEntryKind-cne'CurrentInitializerClean'-or$capture.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029'-or$capture.entry.leaf-cne'run-current-owner.ps1'-or$capture.entry.manifestSha256-cne'6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0'-or$capture.entry.sha256-cne'ebc933faf015aadc32be74f7abeaef66252ef3bc72dc52ebac265ced9ed577e5'-or$capture.entry.postExitExclusiveBytesRequired-ne$true-or$capture.entry.runtimeEntryBytesVerified-ne$false-or$capture.readOnly-ne$true-or$capture.stopAuthorized-ne$false-or$capture.recordPath-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'-or$capture.recordBeforeFile-cne'current-erp-processes.before.json'-or$capture.recordBeforeSha256-cne'81862843a2595587771a8779b23a965b3139cbd8145680af52e4a663c7d2cc17'-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.retireCalls-ne0){throw 'CURRENT_BOOTSTRAP_B6_INITIALIZER_CAPTURE_CHANGED'}
   $manifestPath='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029\owner-manifest.json'
   $manifest=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $manifestPath '6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0'))|ConvertFrom-Json
   $entry=@($manifest.files|Where-Object path -ceq 'run-current-owner.ps1')
   if($manifest.kind-cne'CURRENT_INITIALIZER_CLEAN_BUNDLE'-or$manifest.finiteScope-cne$ScopeName-or$manifest.sourceCommit-cne'1e6ff9f0fa4467cb532c26182b1334558b13bfaa'-or$manifest.actualT1-ne$false-or$manifest.externalOperations-ne$false-or$manifest.apiPackageId-cne$fixed.apiPackage-or$manifest.appPackageId-cne$fixed.package-or$manifest.apiManifestSha256-ine$fixed.apiManifest-or$manifest.appManifestSha256-ine$fixed.manifest-or@($manifest.files).Count-ne14-or$entry.Count-ne1-or$entry[0].sha256-cne$capture.entry.sha256){throw 'CURRENT_BOOTSTRAP_B6_INITIALIZER_SOURCE_CHANGED'}
   $w=$capture.webRecord;$n=$capture.nativeStatus;$owner=$capture.owner;$child=$capture.child
   if($w.port-ne5244-or$w.entry-cne'vite-preview'-or$w.root-cne$fixed.root-or$w.sourceCommit-cne$fixed.frontendSource-or$w.backendPort-ne4144-or$w.businessWorkfaceId-cne$fixed.profile-or$w.pid-ne44612-or$child.pid-ne$w.pid-or$child.parent-ne31212-or$owner.pid-ne$child.parent-or$child.exe-cne$fixed.node-or$child.birth-cne'134377336265107097'-or$owner.birth-cne'134377334934998450'-or$owner.exe-cne'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'-or$n.reply-cne'Status'-or$n.nativePeerVerified-ne$true-or$n.stopAuthorized-ne$false-or$n.childObservationOnly-ne$true-or$n.state.phase-cne'Running'-or$n.state.ownerPid-ne$owner.pid-or$n.state.ownerBirth-cne$owner.birth-or$n.state.childPid-ne$child.pid-or$n.state.childBirth-cne$child.birth-or$capture.installedApiManifest-ine$fixed.apiManifest-or$capture.installedWebManifest-ine$fixed.manifest){throw 'CURRENT_BOOTSTRAP_B6_INITIALIZER_IDENTITY'}
   if((Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes([string]$owner.argv)))-cne'594c6f86bcbef12b4ad4a291c3672cff772be9239d80dad7a2cc91f2b4530ac9'-or(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes([string]$child.argv)))-cne'142fa836c875280b886d55984bddbe60949a7801f57f937db6ab4520d38f2322'-or(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(($capture.protectedSnapshot|ConvertTo-Json -Depth 32 -Compress))))-cne'332d9cdcc152c8c2668f121e84f1483deb35073a327b5bf7ad763cc30e04b419'){throw 'CURRENT_BOOTSTRAP_B6_INITIALIZER_METADATA'}
   $image=Read-ErpBusinessSalePinnedFile (Join-Path ([IO.Path]::GetDirectoryName($path)) 'current-erp-processes.before.json') $capture.recordBeforeSha256
   $rows=ConvertFrom-Business5244RecordBytes $image;$old=@($rows|Where-Object{$_.port-eq5244})
   if($old.Count-ne1-or(@($old[0].PSObject.Properties.Name|Sort-Object)-join'|')-cne'backendPort|businessWorkfaceId|entry|pid|port|root|sourceCommit'){throw 'CURRENT_BOOTSTRAP_B6_INITIALIZER_BEFORE_IMAGE'}
   foreach($key in @('pid','root','sourceCommit','entry','port','backendPort','businessWorkfaceId')){if($old[0].$key-cne$w.$key){throw 'CURRENT_BOOTSTRAP_B6_INITIALIZER_BEFORE_IMAGE'}}
   return @{hash=$capture.recordBeforeSha256;pid=[int]$child.pid;birth=$child.birth;ownerPid=[int]$owner.pid;ownerBirth=$owner.birth;root=$fixed.root;source=$fixed.frontendSource}
  }
  # This fixed, read-only predecessor capture never authorizes a process stop.
  # It only binds a stale record CAS after both old generations are absent.
  $path='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\sql-collation-recovered-20261029\current-read2b-owner-capture.json'
  $capture=[Text.Encoding]::UTF8.GetString((Read-ErpBusinessSalePinnedFile $path '4eaa68d16be5260071f74ce7e41e33ce6adaa4c7097d661905968d4b5c1b9945'))|ConvertFrom-Json
  $fixed=Get-Business5244FinitePairPins -ScopeName $ScopeName -Mode Current
  if($capture.schema-cne'melisa-b6-current-read2b-owner-capture.v1'-or$capture.predecessorEntryKind-cne'ReadPairRouter'-or$capture.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE'-or$capture.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$capture.entry.manifestSha256-cne'ef941287977c2913a8c4ca43cfa002e19f006d6239b9059a5c734cd0db6174e2'-or$capture.entry.sha256-cne'e160fd137828a98f6b4faf814243159276a2707667885f4e321d2ed39abbf238'-or$capture.readOnly-ne$true-or$capture.stopAuthorized-ne$false-or$capture.recordPath-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'-or$capture.recordBeforeFile-cne'current-erp-processes.before.json'-or$capture.recordBeforeSha256-cne'20dc7ae37497b88ce7f38039d76481b4f1e0f4e07c503737ec193e85c4be5f1f'-or$capture.serviceCalls-ne0-or$capture.sqlCalls-ne0-or$capture.retireCalls-ne0){throw 'CURRENT_BOOTSTRAP_B6_CAPTURE_CHANGED'}
  $w=$capture.webRecord;$n=$capture.nativeStatus;$owner=$capture.owner;$child=$capture.child
  if($w.port-ne5244-or$w.entry-cne'vite-preview'-or$w.root-cne$fixed.root-or$w.sourceCommit-cne$fixed.frontendSource-or$w.backendPort-ne4144-or$w.businessWorkfaceId-cne$fixed.profile-or$w.pid-ne24520-or$child.pid-ne$w.pid-or$child.parent-ne22260-or$owner.pid-ne$child.parent-or$child.exe-cne$fixed.node-or$child.birth-cne'134377102174264511'-or$owner.birth-cne'134377094829605064'-or$n.reply-cne'Status'-or$n.nativePeerVerified-ne$true-or$n.stopAuthorized-ne$false-or$n.childObservationOnly-ne$true-or$n.state.phase-cne'Running'-or$n.state.ownerPid-ne$owner.pid-or$n.state.ownerBirth-cne$owner.birth-or$n.state.childPid-ne$child.pid-or$n.state.childBirth-cne$child.birth-or$capture.installedApiManifest-ine$fixed.apiManifest-or$capture.installedWebManifest-ine$fixed.manifest){throw 'CURRENT_BOOTSTRAP_B6_CAPTURE_IDENTITY'}
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
function Get-Business5244SteadyBootstrapBefore($State,[byte[]]$Bytes){
 # Only fresh, held record bytes are presentation metadata. They cannot adopt
 # or stop a process, issue a maintenance request or replace the native child.
 $r=Get-Business5244RetirementState $State
 if(!(Test-Business5244SteadyGeneration)-or$r.scopeName-cne'TEST125-API-B6-WRITER-20261029'-or!$r.initializing-or$r.phase-cne'Running'-or$r.initializationApiTransition-or$r.requestProof-or$r.operationId-or$r.commit-or$r.publication-or$r.records-or$r.pending){throw 'CURRENT_STEADY_BOOTSTRAP_NOT_ADMITTED'}
 $fixed=Get-Business5244FinitePairPins -ScopeName $r.scopeName -Mode Current
 $rows=ConvertFrom-Business5244RecordBytes $Bytes;$old=@($rows|Where-Object port -eq 5244)
 if($old.Count-ne1-or(@($old[0].PSObject.Properties.Name|Sort-Object)-join'|')-cne'backendPort|businessWorkfaceId|entry|pid|port|root|sourceCommit'-or$old[0].pid-isnot[int]-or$old[0].pid-le0-or$old[0].port-isnot[int]-or$old[0].port-ne5244-or$old[0].backendPort-isnot[int]-or$old[0].backendPort-ne4144-or$old[0].root-isnot[string]-or$old[0].root-cne$fixed.root-or$old[0].sourceCommit-isnot[string]-or$old[0].sourceCommit-cne$fixed.frontendSource-or$old[0].entry-isnot[string]-or$old[0].entry-cne'vite-preview'-or$old[0].businessWorkfaceId-isnot[string]-or$old[0].businessWorkfaceId-cne$fixed.profile){throw 'CURRENT_STEADY_RECORD_REJECTED'}
 Assert-Business5244RecordStage $rows $rows $old[0].pid Candidate $fixed
 return @{hash=(Get-Business5244StartupHash $Bytes);pid=$old[0].pid;root=$fixed.root;source=$fixed.frontendSource}
}
function Assert-Business5244CurrentBootstrapBefore($State,[IO.FileStream]$Records){
 $r=Get-Business5244RetirementState $State;$fixed=Get-Business5244FinitePairPins -ScopeName $r.scopeName -Mode Current
 $before=Read-Business5244RetirementBytes $Records
 $stale=if(Test-Business5244SteadyGeneration){Get-Business5244SteadyBootstrapBefore $State $before}else{Get-Business5244CurrentBootstrapPins (Get-Business5244StartupHash $before) -ScopeName $r.scopeName}
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
 $stale=if(Test-Business5244SteadyGeneration){Get-Business5244SteadyBootstrapBefore $State $before}else{Get-Business5244CurrentBootstrapPins $beforeHash -ScopeName $r.scopeName}
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
 if(Test-Business5244SteadyGeneration){$r.currentBootstrap.steadyBefore=$stale.Clone()}
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
 if($r.scopeName-cnotin@('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029')-or!$r.initializing-or$r.phase-cne'Running'-or$r.requestProof-or$r.operationId-or$r.commit-or$r.publication-or$r.lastCompletion-or($r.ContainsKey('dispatch')-and$r.dispatch)-or$r.records-or$r.pending){throw 'CURRENT_BOOTSTRAP_INIT_INVERSE_NOT_ADMITTED'}
 $b=if($r.ContainsKey('currentBootstrap')){$r.currentBootstrap}else{$null}
 if(!$b-or$b.phase-cne'Archived'-or$b.inverse-or![object]::ReferenceEquals($b.native,$r.native)-or$b.ownerPid-ne$PID-or$b.ownerBirth-cne$r.ownerBirth-or$b.childPid-ne$r.childPid-or$b.childBirth-cne$r.childBirth-or(Get-Business5244StartupHash $b.beforeBytes)-cne$b.beforeHash){throw 'CURRENT_BOOTSTRAP_INIT_INVERSE_NOT_ADMITTED'}
 if(Test-Business5244SteadyGeneration){$verified=Get-Business5244SteadyBootstrapBefore $State $b.beforeBytes;if(!$b.ContainsKey('steadyBefore')-or$b.steadyBefore.hash-cne$verified.hash-or$b.steadyBefore.pid-ne$verified.pid-or$b.steadyBefore.root-cne$verified.root-or$b.steadyBefore.source-cne$verified.source){throw 'CURRENT_STEADY_INVERSE_BEFORE_CHANGED'}}
 if($r.ContainsKey('preparedPair')-and$r.preparedPair){
  if((Test-Business5244WriterWebOnlyGeneration)-and$r.scopeName-ceq'TEST125-API-B6-WRITER-20261029'-and$null-eq$r.initializationApiTransition-and$null-eq$r.preparedPair.apiTransition){
   Assert-Business5244PreparedPair $State $null $r.preparedPair.planHash
  }elseif(!$r.initializationApiTransition-or![object]::ReferenceEquals($r.preparedPair.apiTransition,$r.initializationApiTransition)){throw 'CURRENT_BOOTSTRAP_INIT_API_REFERENCE_CHANGED'}
 }
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
 $stale=if(Test-Business5244SteadyGeneration){$verified=Get-Business5244SteadyBootstrapBefore $State $b.beforeBytes;if(!$b.ContainsKey('steadyBefore')-or$b.steadyBefore.hash-cne$verified.hash-or$b.steadyBefore.pid-ne$verified.pid-or$b.steadyBefore.root-cne$verified.root-or$b.steadyBefore.source-cne$verified.source){throw 'CURRENT_STEADY_INVERSE_BEFORE_CHANGED'};$verified}else{Get-Business5244CurrentBootstrapPins $b.beforeHash -ScopeName $r.scopeName}
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
 if(Test-Business5244SteadyGeneration){throw 'RETIREMENT_STEADY_CURRENT_ONLY'}
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
 if(Test-Business5244SteadyGeneration){throw 'RETIREMENT_STEADY_CURRENT_ONLY'}
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
# A new Current-only initialization may supersede a separately exited owner.
# It never imports that owner's retirement state or completes its old request.
if(!(Get-Variable Business5244CurrentSupersessions -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244CurrentSupersessions=[Collections.Generic.List[object]]::new()}
if(!(Get-Variable Business5244CurrentSupersessionObservations -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244CurrentSupersessionObservations=[Collections.Generic.List[object]]::new()}
function Assert-Business5244CurrentSupersessionFixedCase($Inputs){
 if($Inputs.schema-cne'business-5244-current-supersession-inputs.v1'-or$Inputs.scopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'CURRENT_SUPERSESSION_FIXED_CASE_REJECTED'}
 if($Inputs.caseId-ceq'CURRENT-ONLY-5244-SUPERSESSION-20261029'-and$Inputs.ownerPid-eq48212-and$Inputs.ownerBirth-ceq'134377121934062288'-and$Inputs.entrySeals.Count-eq16){return}
 if($Inputs.caseId-ceq'CURRENT-ONLY-5244-INIT-CLEAN-20261029'-and$Inputs.ownerPid-eq42920-and$Inputs.ownerBirth-ceq'134377286908585811'-and$Inputs.entrySeals.Count-eq17-and$Inputs.recordsHash-ceq'3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74'-and$Inputs.originalBeforeHash-ceq$Inputs.recordsHash){return}
 throw 'CURRENT_SUPERSESSION_FIXED_CASE_REJECTED'
}
function Prepare-Business5244CurrentSupersessionObservation($ExitObservation){
 if(!($ExitObservation-is[Business5244RetirementPeer+ExitObservation])){throw 'CURRENT_SUPERSESSION_NATIVE_EXIT_REQUIRED'}
 if($ExitObservation.Observe()){throw 'CURRENT_SUPERSESSION_OBSERVATION_REQUIRES_LIVE_OWNER'}
 $i=Get-Business5244CurrentSupersessionFixedInputs;$name=Get-Business5244StartupMutexName
 Assert-Business5244CurrentSupersessionFixedCase $i
 if($ExitObservation.TargetPid-ne$i.ownerPid-or$ExitObservation.TargetBirth-cne$i.ownerBirth-or@($script:Business5244CurrentSupersessionObservations|Where-Object{!$_.closed-and$_.name-ceq$name}).Count){throw 'CURRENT_SUPERSESSION_OBSERVATION_FIXED_CASE_CHANGED'}
 # OpenExisting cannot recreate the named object after its last old handle is
 # closed. Retain this handle from the live, contended generation until all
 # later standard Maintenance acquisition and owner cleanup have completed.
 $rights=[Security.AccessControl.MutexRights]::Synchronize-bor[Security.AccessControl.MutexRights]::Modify
 $mutex=[Threading.Mutex]::OpenExisting($name,$rights)
 try{
  try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();throw 'CURRENT_SUPERSESSION_OBSERVATION_ABANDONED'}
  if($acquired){$mutex.ReleaseMutex();throw 'CURRENT_SUPERSESSION_OBSERVATION_NOT_HELD'}
  if($ExitObservation.Observe()){throw 'CURRENT_SUPERSESSION_OBSERVATION_OWNER_EXITED_DURING_CAPTURE'}
  $token=[pscustomobject]@{kind='business-5244-current-supersession-observation'}
  $record=@{token=$token;observer=$ExitObservation;mutex=$mutex;name=$name;caseId=$i.caseId;scopeName=$i.scopeName;ownerPid=$i.ownerPid;ownerBirth=$i.ownerBirth;pid=$PID;birth=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString();thread=[Threading.Thread]::CurrentThread.ManagedThreadId;sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;closed=$false}
  $script:Business5244CurrentSupersessionObservations.Add($record);return $token
 }catch{$mutex.Dispose();throw}
}
function Get-Business5244CurrentSupersessionObservation($ExitObservation){
 $rows=@($script:Business5244CurrentSupersessionObservations|Where-Object{[object]::ReferenceEquals($_.observer,$ExitObservation)-and!$_.closed})
 if($rows.Count-ne1){throw 'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_REQUIRED'};$o=$rows[0]
 if(!($ExitObservation-is[Business5244RetirementPeer+ExitObservation])-or$o.pid-ne$PID-or$o.birth-cne[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString()-or$o.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$o.sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$o.name-cne(Get-Business5244StartupMutexName)-or!($o.mutex-is[Threading.Mutex])-or$o.mutex.SafeWaitHandle.IsClosed-or$o.mutex.SafeWaitHandle.IsInvalid-or$o.ownerPid-ne$ExitObservation.TargetPid-or$o.ownerBirth-cne$ExitObservation.TargetBirth){throw 'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_CHANGED'}
 return $o
}
function Close-Business5244CurrentSupersessionObservation($ExitObservation){
 if($null-eq$ExitObservation){return}
 if(!($ExitObservation-is[Business5244RetirementPeer+ExitObservation])){throw 'CURRENT_SUPERSESSION_NATIVE_EXIT_REQUIRED'}
 $rows=@($script:Business5244CurrentSupersessionObservations|Where-Object{[object]::ReferenceEquals($_.observer,$ExitObservation)})
 if(!$rows.Count){[void]$ExitObservation.Observe();return}
 if($rows.Count-ne1){throw 'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_REQUIRED'};$o=$rows[0]
 if($o.pid-ne$PID-or$o.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$o.sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$o.birth-cne[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString()){throw 'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_CHANGED'}
 if(!$o.closed){$o.mutex.Dispose();$o.closed=$true}
}
function Get-Business5244CurrentSupersessionContext($Admission){
 $rows=@($script:Business5244CurrentSupersessions|Where-Object{[object]::ReferenceEquals($_.token,$Admission)})
 if($rows.Count-ne1){throw 'CURRENT_SUPERSESSION_NOT_ISSUED'};$c=$rows[0]
 if($c.closed-or$c.pid-ne$PID-or$c.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$c.sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$c.birth-cne[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString()-or($c.inputs|ConvertTo-Json -Depth 32 -Compress)-cne$c.inputJson-or!($c.observer-is[Business5244RetirementPeer+ExitObservation])){throw 'CURRENT_SUPERSESSION_CONTEXT_CHANGED'}
 $observation=Get-Business5244CurrentSupersessionObservation $c.observer;if(![object]::ReferenceEquals($observation,$c.observation)){throw 'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_CHANGED'}
 $c.observer.ValidateExited();Assert-Business5244StartupLease $c.lease
 return $c
}
function Assert-Business5244CurrentSupersessionHeld($Admission){
 $c=Get-Business5244CurrentSupersessionContext $Admission
 foreach($row in $c.seals){if(!($row.stream-is[IO.FileStream])-or!$row.stream.CanRead-or$row.stream.CanWrite-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $row.stream))-cne$row.hash){throw 'CURRENT_SUPERSESSION_ENTRY_SEAL_CHANGED'}}
 if(!($c.records-is[IO.FileStream])-or!($c.pending-is[IO.FileStream])-or!$c.records.CanWrite-or!$c.pending.CanWrite-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.records))-cne$c.recordExpected-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.pending))-cne$c.pendingExpected){throw 'CURRENT_SUPERSESSION_HELD_CAS_CHANGED'}
 return $c
}
function New-Business5244CurrentSupersessionAdmission($ExitObservation){
 if(!($ExitObservation-is[Business5244RetirementPeer+ExitObservation])){throw 'CURRENT_SUPERSESSION_NATIVE_EXIT_REQUIRED'}
 $observation=Get-Business5244CurrentSupersessionObservation $ExitObservation;$ExitObservation.ValidateExited();$i=Get-Business5244CurrentSupersessionFixedInputs
 Assert-Business5244CurrentSupersessionFixedCase $i
 if($observation.caseId-cne$i.caseId-or$observation.scopeName-cne$i.scopeName-or$observation.ownerPid-ne$i.ownerPid-or$observation.ownerBirth-cne$i.ownerBirth){throw 'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_CHANGED'}
 if($ExitObservation.TargetPid-ne$i.ownerPid-or$ExitObservation.TargetBirth-cne$i.ownerBirth-or$i.recordsHash-cnotmatch'^[a-f0-9]{64}$'-or$i.pendingHash-cnotmatch'^[a-f0-9]{64}$'-or$i.originalBeforeHash-cne$i.recordsHash-or(Get-Business5244StartupHash $i.beforeBytes)-cne$i.recordsHash-or(Get-Business5244StartupHash $i.pendingBeforeBytes)-cne$i.pendingHash){throw 'CURRENT_SUPERSESSION_FIXED_INPUT_CHANGED'}
 $fixed=Get-Business5244FinitePairPins -ScopeName $i.scopeName -Mode Current
 foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){if($i.pins[$key]-cne$fixed[$key]){throw 'CURRENT_SUPERSESSION_NOT_FIXED_CURRENT'}}
 $beforePending=[Text.UTF8Encoding]::new($false,$true).GetString($i.pendingBeforeBytes)|ConvertFrom-Json
 if($i.caseId-ceq'CURRENT-ONLY-5244-SUPERSESSION-20261029'){
  if($beforePending.schema-cne'business-5244-retirement-before.v1'-or$beforePending.ownerPid-ne$i.ownerPid-or[string]$beforePending.ownerBirth-cne$i.ownerBirth-or$beforePending.operationId-cnotmatch'^[a-f0-9]{32}$'-or$beforePending.beforeSha256-cne$i.recordsHash-or(Get-Business5244StartupHash ([Convert]::FromBase64String($beforePending.beforeBase64)))-cne$i.recordsHash){throw 'CURRENT_SUPERSESSION_ORIGINAL_PENDING_REJECTED'}
 }else{
  if($beforePending.schema-cne'business-5244-current-supersession.pending.v1'-or$beforePending.classification-cne'SUPERSESSION_NOT_ORIGINAL_COMMIT'-or$beforePending.operationId-cne'5197b99f29984394b07059bea9cc4823'-or$beforePending.originalOperationId-cne'0cfa751c63644554a4faccd1f1e8d7c6'-or$beforePending.originalPendingSha256-cne'7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab'-or$beforePending.originalRecordsSha256-cne'3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74'-or$beforePending.originalRecordsSha256-cne$i.recordsHash-or$beforePending.ownerPid-ne42920-or[string]$beforePending.ownerBirth-cne'134377286908585811'-or$beforePending.ownerPid-ne$i.ownerPid-or[string]$beforePending.ownerBirth-cne$i.ownerBirth){throw 'CURRENT_SUPERSESSION_INIT_CLEAN_PENDING_REJECTED'}
 }
 $lease=Enter-Business5244StartupLease -Kind Maintenance;$c=$null;$records=$null;$pending=$null;$seals=[Collections.Generic.List[object]]::new()
 try{
  $ExitObservation.ValidateExited();[void](Assert-Business5244CurrentSupersessionBoundary $i)
  $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach($row in @($i.entrySeals)+@($i.gateSeal)){
   if(!$row.path-or$row.hash-cnotmatch'^[a-f0-9]{64}$'-or!$seen.Add($row.path)){throw 'CURRENT_SUPERSESSION_ENTRY_SET_REJECTED'}
   for($p=$row.path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'CURRENT_SUPERSESSION_REPARSE_POINT'}}
   $stream=[IO.File]::Open($row.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,$(if($row.path-ceq$i.gateSeal.path){[IO.FileShare]::Read}else{[IO.FileShare]::None}))
   $seals.Add(@{stream=$stream;path=$row.path;hash=$row.hash})
   if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $stream))-cne$row.hash){throw 'CURRENT_SUPERSESSION_ENTRY_CHANGED'}
  }
  $paths=@($i.entrySeals|ForEach-Object{$_.path})
  if(@(Get-CimInstance Win32_Process|Where-Object{$command=$_.CommandLine;$_.ProcessId-ne$PID-and$command-and@($paths|Where-Object{$command.IndexOf($_,[StringComparison]::OrdinalIgnoreCase)-ge0}).Count}).Count-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'CURRENT_SUPERSESSION_FOREIGN_LAUNCH_OR_LISTENER'}
  foreach($path in @($i.recordsPath,$i.pendingPath)){for($p=$path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'CURRENT_SUPERSESSION_REPARSE_POINT'}}}
  $records=[IO.File]::Open($i.recordsPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$pending=[IO.File]::Open($i.pendingPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$i.recordsHash-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $pending))-cne$i.pendingHash){throw 'CURRENT_SUPERSESSION_ORIGINAL_CAS_CHANGED'}
  $id=[guid]::NewGuid().ToString('N');$token=[pscustomobject]@{kind='business-5244-current-supersession'}
  $c=@{token=$token;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;birth=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString();inputs=$i;inputJson=($i|ConvertTo-Json -Depth 32 -Compress);observer=$ExitObservation;observation=$observation;lease=$lease;records=$records;pending=$pending;seals=$seals;copies=[Collections.Generic.List[object]]::new();before=([byte[]]$i.beforeBytes.Clone());oldPending=([byte[]]$i.pendingBeforeBytes.Clone());recordExpected=$i.recordsHash;pendingExpected=$i.pendingHash;operationId=$id;markerAttempted=$false;native=$null;state=$null;phase='Preparing';closed=$false;after=$null;receiptHash=$null}
  $script:Business5244CurrentSupersessions.Add($c)
  foreach($row in @(@{suffix='superseded-original';bytes=$c.oldPending},@{suffix='superseded-record.before';bytes=$c.before})){
   $path=$i.pendingPath+'.'+$id+'.'+$row.suffix;$writer=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
   try{$writer.Write($row.bytes,0,$row.bytes.Length);$writer.Flush($true);if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $writer))-cne(Get-Business5244StartupHash $row.bytes)){throw 'CURRENT_SUPERSESSION_BEFORE_COPY_UNCONFIRMED'}}finally{$writer.Dispose()}
   $reader=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
   if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $reader))-cne(Get-Business5244StartupHash $row.bytes)){$reader.Dispose();throw 'CURRENT_SUPERSESSION_BEFORE_COPY_CHANGED'}
   $c.copies.Add(@{path=$path;stream=$reader;hash=(Get-Business5244StartupHash $row.bytes)})
  }
  $marker=[Text.Encoding]::UTF8.GetBytes(([ordered]@{schema='business-5244-current-supersession.pending.v1';classification='SUPERSESSION_NOT_ORIGINAL_COMMIT';operationId=$id;originalOperationId=$beforePending.operationId;originalPendingSha256=$i.pendingHash;originalRecordsSha256=$i.recordsHash;ownerPid=$PID;ownerBirth=[Business5244RetirementPeer]::CurrentBirth}|ConvertTo-Json -Compress))
  [void](Assert-Business5244CurrentSupersessionHeld $token);$c.markerBytes=$marker;$c.markerAttempted=$true;$pending.Position=0;$pending.SetLength($marker.Length);$pending.Write($marker,0,$marker.Length);$pending.Flush($true);$c.pendingExpected=Get-Business5244StartupHash $marker
  [void](Assert-Business5244CurrentSupersessionHeld $token);$c.phase='Prepared';return $token
 }catch{
  if($c-and$c.markerAttempted){$c.phase='Unknown';throw}
  foreach($row in $seals){$row.stream.Dispose()};if($records){$records.Dispose()};if($pending){$pending.Dispose()};if($c){foreach($row in $c.copies){$row.stream.Dispose()};$c.closed=$true};Exit-Business5244StartupLease $lease;throw
 }
}
function Initialize-Business5244CurrentSupersessionOwner($Admission){
 $c=Assert-Business5244CurrentSupersessionHeld $Admission
 if($c.phase-cne'Prepared'-or$c.native-or$c.state){throw 'CURRENT_SUPERSESSION_INITIALIZATION_ALREADY_ATTEMPTED'}
 Assert-Business5244StartupLease $c.lease -Kind Maintenance;[void](Assert-Business5244CurrentSupersessionBoundary $c.inputs);$c.phase='Creating'
 try{
  $c.native=New-Business5244PinnedChild -Pins $c.inputs.pins -Lease $c.lease
  Assert-Business5244CreatedChild $c.native $c.inputs.pins;Assert-Business5244ReadyChild $c.native $c.inputs.pins
  [void](Assert-Business5244CurrentSupersessionHeld $Admission);[void](Assert-Business5244CurrentSupersessionBoundary $c.inputs)
  # This promotion remains on the same held native mutex and issuing thread.
  (Get-Business5244StartupRecord $c.lease).kind='Owner'
  $c.state=Register-Business5244OwnedRetirement $c.lease $c.native $c.inputs.pins -ScopeName $c.inputs.scopeName
  $r=Get-Business5244RetirementState $c.state;$r.currentSupersession=$c
  $rows=ConvertFrom-Business5244RecordBytes $c.before
  $after=@($rows|ForEach-Object{if($_.port-eq5244){[pscustomobject]@{port=5244;pid=$c.native.ChildPid;entry='vite-preview';sourceCommit=$c.inputs.pins.frontendSource;root=$c.inputs.pins.root;backendPort=4144;businessWorkfaceId=$c.inputs.pins.profile}}else{$_}})
  Assert-Business5244RecordStage $rows $after $c.native.ChildPid Candidate $c.inputs.pins
  $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $after -Depth 30));$c.after=$bytes;$c.phase='WritingRecord'
  [void](Assert-Business5244CurrentSupersessionHeld $Admission);$c.records.Position=0;$c.records.SetLength($bytes.Length);$c.records.Write($bytes,0,$bytes.Length);$c.records.Flush($true);$c.recordExpected=Get-Business5244StartupHash $bytes
  [void](Assert-Business5244CurrentSupersessionHeld $Admission);$c.phase='RecordPublished'
  return [pscustomobject]@{lease=$c.lease;native=$c.native;state=$c.state}
 }catch{if($c.phase-ceq'WritingRecord'){$c.phase='Unknown'}else{$c.phase='InitializationFailed'};throw}
}
function Complete-Business5244CurrentSupersessionOwner($Admission){
 $c=Assert-Business5244CurrentSupersessionHeld $Admission
 if($c.phase-cne'RecordPublished'-or!$c.native-or!$c.state){throw 'CURRENT_SUPERSESSION_COMPLETION_NOT_ADMITTED'}
 $r=Get-Business5244RetirementState $c.state
 if(![object]::ReferenceEquals($r.currentSupersession,$c)-or![object]::ReferenceEquals($r.native,$c.native)-or$r.phase-cne'Running'-or!$r.initializing){throw 'CURRENT_SUPERSESSION_FRESH_STATE_CHANGED'}
 Assert-Business5244StartupLease $c.lease -Kind Owner;Assert-Business5244CreatedChild $c.native $c.inputs.pins;Assert-Business5244ReadyChild $c.native $c.inputs.pins;[void](Assert-Business5244CurrentSupersessionBoundary $c.inputs)
 foreach($copy in $c.copies){if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $copy.stream))-cne$copy.hash){throw 'CURRENT_SUPERSESSION_ORIGINAL_COPY_CHANGED'}}
 $receipt=[Text.Encoding]::UTF8.GetBytes(([ordered]@{schema='business-5244-current-supersession.v1';classification='SUPERSEDED_NOT_ORIGINAL_COMMIT';caseId=$c.inputs.caseId;operationId=$c.operationId;oldOwnerPid=$c.inputs.ownerPid;oldOwnerBirth=$c.inputs.ownerBirth;oldPendingSha256=$c.inputs.pendingHash;beforeRecordsSha256=$c.inputs.recordsHash;afterRecordsSha256=$c.recordExpected;ownerPid=$PID;ownerBirth=$c.native.OwnerBirth;childPid=$c.native.ChildPid;childBirth=$c.native.ChildBirth;package=$c.inputs.pins.package;manifest=$c.inputs.pins.manifest;commercialWrites=0}|ConvertTo-Json -Compress))
 $receiptPath=$c.inputs.pendingPath+'.'+$c.operationId+'.superseded.receipt.json';$writer=[IO.File]::Open($receiptPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{$writer.Write($receipt,0,$receipt.Length);$writer.Flush($true);if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $writer))-cne(Get-Business5244StartupHash $receipt)){throw 'CURRENT_SUPERSESSION_RECEIPT_UNCONFIRMED'}}finally{$writer.Dispose()}
 $c.receiptHash=Get-Business5244StartupHash $receipt
 $receiptSeal=[IO.File]::Open($receiptPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $receiptSeal))-cne$c.receiptHash){$receiptSeal.Dispose();throw 'CURRENT_SUPERSESSION_RECEIPT_CHANGED'}
 $c.copies.Add(@{path=$receiptPath;stream=$receiptSeal;hash=$c.receiptHash});$c.phase='ReceiptDurable';$archive=$c.inputs.pendingPath+'.'+$c.operationId+'.superseded-marker'
 try{
  [void](Assert-Business5244CurrentSupersessionHeld $Admission);$c.pending.Dispose();$c.pending=$null
  try{Move-Business5244PendingArchive $c.inputs.pendingPath $archive}catch{
   if((Test-Path -LiteralPath $archive)-and!(Test-Path -LiteralPath $c.inputs.pendingPath)-and(Get-FileHash -LiteralPath $archive).Hash-ieq$c.pendingExpected){}
   elseif((Test-Path -LiteralPath $c.inputs.pendingPath)-and!(Test-Path -LiteralPath $archive)-and(Get-FileHash -LiteralPath $c.inputs.pendingPath).Hash-ieq$c.pendingExpected){$c.pending=[IO.File]::Open($c.inputs.pendingPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$c.phase='RecordPublished';throw}
   else{$c.phase='Unknown';throw}
  }
  if((Test-Path -LiteralPath $c.inputs.pendingPath)-or(Get-FileHash -LiteralPath $archive).Hash-ine$c.pendingExpected){throw 'CURRENT_SUPERSESSION_ARCHIVE_UNCONFIRMED'}
  $c.records.Dispose();$c.records=$null;foreach($row in $c.seals){$row.stream.Dispose()};foreach($row in $c.copies){$row.stream.Dispose()};$c.phase='Completed'
  return [pscustomobject]@{classification='SUPERSEDED_NOT_ORIGINAL_COMMIT';childPid=$c.native.ChildPid;childBirth=$c.native.ChildBirth;recordHash=$c.recordExpected;originalRetireCompleted=$false}
 }catch{
  if($c.phase-cne'RecordPublished'){
   $c.phase='Unknown'
   # An unconfirmed move/close must not leave normal startup unblocked.
   # Recreate only a missing marker from this admission's retained bytes;
   # never replace an existing or foreign path and never assert old commit.
   if(!$c.pending-and!(Test-Path -LiteralPath $c.inputs.pendingPath)){
    try{$c.pending=[IO.File]::Open($c.inputs.pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$c.pending.Write($c.markerBytes,0,$c.markerBytes.Length);$c.pending.Flush($true)}catch{}
   }
  }
  throw
 }
}
function Undo-Business5244CurrentSupersessionOwner($Admission){
 $c=Get-Business5244CurrentSupersessionContext $Admission
 if($c.phase-cnotin@('Prepared','Creating','InitializationFailed','RecordPublished')){throw 'CURRENT_SUPERSESSION_UNDO_NOT_ADMITTED'}
 $observed=Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.records)
 $afterHash=if($c.after){Get-Business5244StartupHash $c.after}else{$null}
 if($observed-cne$c.inputs.recordsHash-and$observed-cne$afterHash){throw 'CURRENT_SUPERSESSION_UNDO_CAS_CHANGED'}
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.pending))-cne$c.pendingExpected){throw 'CURRENT_SUPERSESSION_UNDO_PENDING_CHANGED'}
 $lr=Get-Business5244StartupRecord $c.lease
 if($lr.ContainsKey('ownedNatives')){foreach($n in $lr.ownedNatives){if(!($n-is[Business5244WebNative])-or$n.OwnerBirth-cne[Business5244RetirementPeer]::CurrentBirth){throw 'CURRENT_SUPERSESSION_UNDO_NATIVE_CHANGED'};$n.Dispose();if(!$n.RetirementConfirmed){throw 'CURRENT_SUPERSESSION_UNDO_CHILD_UNCONFIRMED'}}}
 if(@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'CURRENT_SUPERSESSION_UNDO_PORT_NOT_EMPTY'}
 # A historical dead PID may reappear only behind the retained blocking marker;
 # this is an init before-image, never a runnable old-owner restoration or ACK.
 $c.records.Position=0;$c.records.SetLength($c.before.Length);$c.records.Write($c.before,0,$c.before.Length);$c.records.Flush($true)
 if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.records))-cne$c.inputs.recordsHash){throw 'CURRENT_SUPERSESSION_UNDO_WRITE_UNCONFIRMED'}
 $c.recordExpected=$c.inputs.recordsHash;$c.phase='InitFailedCleanPendingRecovery'
 $c.records.Dispose();$c.records=$null;$c.pending.Dispose();$c.pending=$null;foreach($row in $c.seals){$row.stream.Dispose()};foreach($row in $c.copies){$row.stream.Dispose()}
 Exit-Business5244StartupLease $c.lease;$c.closed=$true
 return [pscustomobject]@{ownInitializationUndone=$true;startupBlocked=$true;originalRetireCompleted=$false}
}
if(!$RetirementStateLibrary){throw 'RETIREMENT_STATE_LIBRARY_ONLY'}
