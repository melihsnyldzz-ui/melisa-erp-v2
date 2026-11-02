param([switch]$Library)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# This is a finite future generation, not an exit path for the installed cf8.
if(!(Get-Variable Business5244PostbootContexts -Scope Script -ErrorAction SilentlyContinue)){$script:Business5244PostbootContexts=[Collections.Generic.List[object]]::new()}
function Get-Business5244PostbootCase {
 $roots=@{Old='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-STEADY-8530-20261101';Candidate='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-STEADY-F5F8-20261101'}
 $slot=if($PSScriptRoot-ceq$roots.Candidate){'Candidate'}else{'Old'};$steady=$PSScriptRoot-cin@($roots.Old,$roots.Candidate)
 return @{root=$(if($steady){$roots[$slot]}else{'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-2230-20261101'});steady=$steady;slot=$slot;steadyRoots=$roots;privateRoot='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-postboot-recovery-20261101-2230';runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027';config='C:\Sirket\ERP\runtime\canonical-test\startup-config.json';records='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'}
}
function Assert-Business5244PostbootPath([string]$Path){for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force -ErrorAction Stop).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'POSTBOOT_REPARSE_REJECTED'}}}
function Get-Business5244PostbootHash([byte[]]$Bytes){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Assert-Business5244PostbootManifest($m){
 $required=@('business-5244-postboot.ps1','business-5244-postboot-native.cs','postboot-task.ps1','postboot-owner.ps1','postboot-control.ps1','start-owned-test.ps1','start-business-5244-owned.ps1','start-business-5244-web.ps1','business-5244-startup-exclusion.ps1','business-5244-retirement-state.ps1','business-5244-retirement-channel.ps1','business-5244-retirement-peer.cs','business-5244-web-native.cs','business-5244-maintenance-dispatch.ps1','canonical-business-sale-maintenance.ps1','test125-bound-maintenance-plan.ps1','capture-business-5244-postboot.ps1','prepare-business-5244-postboot-recovery.mjs','test125-bound-api-quiescence.ps1')
 if(@($m.files).Count-ne$required.Count-or(($m.files.path|Sort-Object)-join'|')-cne(($required|Sort-Object)-join'|')){throw 'POSTBOOT_SOURCE_CLOSURE_REJECTED'}
 $expectedBackendDigest='afdb66b5c3450459778630d27bd1ff409ecb80c8ad53058fa048cf3e8e28085c'
 if($m.oldWeb.manifestSha256-cne'853025ef7df10eec9a4feff026b767c6c323e5e5259c7bcbc2f7f19186743855'-or
    $m.candidateWeb.manifestSha256-cne'f5f87a6ec42e2e1273d40e2ce030e3c19d836bb96b0d56a0dc289d27a2911afc'-or
    $m.api.manifestSha256-cne$expectedBackendDigest-or
    $m.node.sha256-cne'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'){throw 'POSTBOOT_PACKAGE_BINDING_REJECTED'}
 $fixed=@{oldWeb=@('ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030','ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030','fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a');candidateWeb=@('ERP-BUSINESS-WEB-5244-B6-PENDING-5457e450-PASSIVE-20261031','ERP-BUSINESS-WEB-5244-B6-PENDING-5457e450-PASSIVE-20261031','5457e450ad153894c2f81112f08217a16c70330a');api=@('CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-READ-VERIFIED-20261030','CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029','edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d')}
 foreach($key in $fixed.Keys){$p=$m.$key;$v=$fixed[$key];if($p.root-cne('C:\Sirket\ERP\releases\'+$v[0])-or$p.packageId-cne$v[1]-or$p.sourceCommit-cne$v[2]){throw 'POSTBOOT_PACKAGE_BINDING_REJECTED'}}
 if($m.node.path-cne'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'-or$m.beforeBootFileTime-cnotmatch'\A[0-9]{17,18}\z'-or$m.capturedFileTime-cnotmatch'\A[0-9]{17,18}\z'-or$m.sourceCommit-cnotmatch'\A[a-f0-9]{40}\z'){throw 'POSTBOOT_FINITE_BASELINE_REJECTED'}
 if($m.base.root-cne'C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778'-or$m.base.manifestSha256-cne'0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64'-or$m.base.sourceCommit-cne$m.api.sourceCommit){throw 'POSTBOOT_BASE_PACKAGE_REJECTED'}
 $c=Get-Business5244PostbootCase
 if($m.phase-cne$(if($c.steady){'STEADY'}else{'FINITE'})-or$m.initialSlot-cne$c.slot-or$m.planSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'POSTBOOT_PHASE_REJECTED'}
 if(!$c.steady){foreach($slot in @('Old','Candidate')){if($m.steady.$slot.root-cne$c.steadyRoots[$slot]-or$m.steady.$slot.manifestSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'POSTBOOT_STEADY_BINDING_REJECTED'}}}
}
function Get-Business5244PostbootContext($Token){$rows=@($script:Business5244PostbootContexts|Where-Object{[object]::ReferenceEquals($_.token,$Token)});if($rows.Count-ne1){throw 'POSTBOOT_UNISSUED_CONTEXT'};$r=$rows[0];if($r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$r.closed){throw 'POSTBOOT_CONTEXT_CHANGED'};$r.epoch.Validate();$r.sourceSeal.Validate();return $r}
function Assert-Business5244PostbootTask($Manifest,[string]$ManifestHash,[string]$Role,[switch]$AllowSteadyAction,[ValidateSet('','Old','Candidate')][string]$RequireSteadySlot=''){
 $c=Get-Business5244PostbootCase;$s=New-Object -ComObject Schedule.Service;$s.Connect();$task=$s.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
 $actual=[xml][string]$task.Xml;$expected=[xml][IO.File]::ReadAllText((Join-Path $c.privateRoot 'task-before.xml'))
 $expected.Task.Actions.Exec.Arguments='-NoProfile -NonInteractive -WindowStyle Hidden -File "'+(Join-Path $c.root 'postboot-task.ps1')+'" -ManifestSha256 '+$ManifestHash
 $matches=$actual.OuterXml-ceq$expected.OuterXml
 if($RequireSteadySlot){$matches=$false}
 if(($AllowSteadyAction-or$RequireSteadySlot)-and$Manifest.phase-ceq'FINITE'){
  foreach($slot in @('Old','Candidate')){if($RequireSteadySlot-and$RequireSteadySlot-cne$slot){continue};$target=$Manifest.steady.$slot;$expected.Task.Actions.Exec.Arguments='-NoProfile -NonInteractive -WindowStyle Hidden -File "'+(Join-Path $target.root 'postboot-task.ps1')+'" -ManifestSha256 '+$target.manifestSha256;if($actual.OuterXml-ceq$expected.OuterXml){$matches=$true}}
 }
 if(!$matches-or(Get-Business5244PostbootHash ([Text.Encoding]::UTF8.GetBytes([string]$task.GetSecurityDescriptor(7))))-cne$Manifest.taskSddlSha256){throw 'POSTBOOT_TASK_ADMISSION_REJECTED'}
 $instances=$task.GetInstances(0);if($instances.Count-ne1){throw 'POSTBOOT_SINGLE_TASK_REQUIRED'};$hostPid=[int]$instances.Item(1).EnginePID
 if($Role-ceq'Task'-and$hostPid-ne$PID){throw 'POSTBOOT_TASK_HOST_REQUIRED'}
 if($Role-ceq'Owner'){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);if(!$p-or$p.ParentProcessId-ne$hostPid){throw 'POSTBOOT_OWNER_PARENT_REQUIRED'}}
 return $hostPid
}
function Get-Business5244PostbootFinalProof($Manifest,[string]$ManifestHash){
 $c=Get-Business5244PostbootCase;$base=Join-Path $c.privateRoot 'web-once';$receiptPath=Join-Path $base 'finalize-receipt.json';$markerPath=Join-Path $base 'postboot-successor.completed';$intentPath=Join-Path $base 'finalize-intent.json'
 foreach($path in @($receiptPath,$markerPath,$intentPath)){Assert-Business5244PostbootPath $path;if((Get-Item -LiteralPath $path).Length-gt1048576){throw 'POSTBOOT_FINAL_PROOF_REJECTED'}}
 $receipt=Get-Content -LiteralPath $receiptPath -Raw|ConvertFrom-Json;$marker=Get-Content -LiteralPath $markerPath -Raw|ConvertFrom-Json;$intent=Get-Content -LiteralPath $intentPath -Raw|ConvertFrom-Json
 $w=if($Manifest.initialSlot-ceq'Old'){$Manifest.oldWeb}else{$Manifest.candidateWeb}
 if($receipt.schema-cne'melisa-b6-postboot-finalized.v1'-or$receipt.state-cne'FIXED_STEADY_COMMITTED'-or$receipt.slot-cne$Manifest.initialSlot-or$receipt.planSha256-cne$Manifest.planSha256-or$receipt.sourceCommit-cne$Manifest.sourceCommit-or$receipt.steadyManifestSha256-cne$ManifestHash-or$receipt.webManifestSha256-cne$w.manifestSha256-or$receipt.pendingSha256-cne(Get-FileHash -LiteralPath $markerPath).Hash.ToLowerInvariant()-or$receipt.finalizeIntentSha256-cne(Get-FileHash -LiteralPath $intentPath).Hash.ToLowerInvariant()-or$marker.schema-cne'melisa-b6-postboot-successor.pending.v1'-or$marker.ownerPid-ne$receipt.ownerPid-or$marker.ownerBirth-cne$receipt.ownerBirth-or$intent.schema-cne'melisa-b6-postboot-finalize-intent.v1'-or$intent.planSha256-cne$receipt.planSha256-or$intent.slot-cne$receipt.slot-or$intent.steadyManifestSha256-cne$ManifestHash){throw 'POSTBOOT_FINAL_PROOF_REJECTED'}
 return @(foreach($path in @($receiptPath,$markerPath,$intentPath)){@{path=$path;sha256=(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()}})
}
function New-Business5244PostbootContext([ValidateSet('Task','Owner','Control')][string]$Role,[string]$ManifestSha256){
 $c=Get-Business5244PostbootCase
 if($PSScriptRoot-cne$c.root-or$ManifestSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'POSTBOOT_FROZEN_GENERATION_REQUIRED'}
 $manifestPath=Join-Path $c.root 'postboot-manifest.json';Assert-Business5244PostbootPath $manifestPath
 $raw=[IO.File]::ReadAllBytes($manifestPath);if((Get-Business5244PostbootHash $raw)-cne$ManifestSha256){throw 'POSTBOOT_MANIFEST_CHANGED'}
 $m=[Text.UTF8Encoding]::new($false,$true).GetString($raw)|ConvertFrom-Json
 if($m.schema-cne'melisa-b6-postboot-generation.v1'-or$m.id-cne'ERP-B6-POSTBOOT-RECOVERY-PREP-20261101-2230'-or$m.root-cne$c.root-or$m.privateRoot-cne$c.privateRoot-or$m.origin-cne'http://192.168.1.46:5244'-or$m.originalRequestId-cne'd3d54eed-5de6-46ed-8881-1d3f004c37d8'-or$m.originalBodySha256-cne'9a9fa1be7ffe3158f1c05f433fe07e2a9f4c2333005ca1243489d403673a76ed'){throw 'POSTBOOT_FINITE_CASE_REJECTED'}
 foreach($key in @('installed','applied','executionAuthority','runtimeGo','actualT1','externalOperations')){if($m.$key-isnot[bool]-or$m.$key){throw 'POSTBOOT_ARTIFACT_FLAGS_REJECTED'}}
 if($m.originalPath-cne'/api/work-sales/drafts'){throw 'POSTBOOT_ORIGINAL_PATH_CHANGED'}
 Assert-Business5244PostbootManifest $m
 $argv=[Environment]::GetCommandLineArgs();$leaf=@{Task='postboot-task.ps1';Owner='postboot-owner.ps1';Control='postboot-control.ps1'}[$Role]
 $expected=@($c.ps,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',(Join-Path $c.root $leaf),'-ManifestSha256',$ManifestSha256)
 if($Role-ceq'Control'){$expected+=@('-Action',$script:PostbootControlAction)}
 if(($argv|ConvertTo-Json -Compress)-cne($expected|ConvertTo-Json -Compress)){throw 'POSTBOOT_EXACT_ENTRY_REQUIRED'}
 foreach($leaf in @('business-5244-web-native.cs','business-5244-postboot-native.cs')){$row=@($m.files|Where-Object path -CEQ $leaf);if($row.Count-ne1-or(Get-FileHash -LiteralPath (Join-Path $c.root $leaf)).Hash-ine$row[0].sha256){throw 'POSTBOOT_NATIVE_SOURCE_CHANGED'}}
 if('Business5244PostbootEpoch'-as[type]-or'Business5244WebNative'-as[type]){throw 'POSTBOOT_NATIVE_TYPE_PRELOADED'}
 Add-Type -LiteralPath (Join-Path $c.root 'business-5244-web-native.cs')
 $seal=[Business5244PackageSeal]::new();$sourceSeal=[Business5244PackageSeal]::new();$epoch=$null
 try{
  $sourceSeal.Add($manifestPath,$ManifestSha256)
  foreach($f in $m.files){if($f.path-cnotmatch'\A[a-zA-Z0-9._-]+\z'-or$f.sha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'POSTBOOT_SOURCE_CLOSURE_REJECTED'};$sourceSeal.Add((Join-Path $c.root $f.path),$f.sha256)}
  foreach($f in $m.protected){$sourceSeal.Add($f.path,$f.sha256)}
  if($c.steady){foreach($f in Get-Business5244PostbootFinalProof $m $ManifestSha256){$sourceSeal.Add($f.path,$f.sha256)}}
  foreach($p in @($m.oldWeb,$m.candidateWeb,$m.api,$m.base)){
   $mp=Join-Path $p.root 'release-manifest.json';$sourceSeal.Add($mp,$p.manifestSha256);$pm=Get-Content -LiteralPath $mp -Raw|ConvertFrom-Json
   foreach($f in $pm.files){$path=[IO.Path]::GetFullPath((Join-Path $p.root $f.path));if(!$path.StartsWith($p.root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'POSTBOOT_PAYLOAD_SCOPE_REJECTED'};$seal.Add($path,$f.sha256)}
  }
  $sourceSeal.Add($m.node.path,$m.node.sha256);$sourceSeal.Freeze();$sourceSeal.Validate();$seal.Freeze();$seal.Validate()
  Add-Type -LiteralPath (Join-Path $c.root 'business-5244-postboot-native.cs') -ReferencedAssemblies @('System.Management')
  $epoch=[Business5244PostbootEpoch]::new($m.beforeBootFileTime,$m.capturedFileTime,[bool]$c.steady)
  $allowSteadyAction=$Role-ceq'Control'-and$script:PostbootControlAction-cin@('Finalize','Status')
  $hostPid=Assert-Business5244PostbootTask $m $ManifestSha256 $Role -AllowSteadyAction:$allowSteadyAction
  if($Role-cne'Task'){$epoch.BindTaskHost($hostPid)}
  $token=[pscustomobject]@{kind='postboot-finite-source-bound'};$r=@{token=$token;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;role=$Role;manifest=$m;manifestHash=$ManifestSha256;seal=$seal;sourceSeal=$sourceSeal;epoch=$epoch;closed=$false;lease=$null;native=$null;slot=$c.slot;metadataHash=$null;metadataSlot=$c.slot;metadataUnknown=$false;transitionRecordStream=$null;pending=$null;hostPid=$hostPid;allowSteadyAction=$allowSteadyAction}
  $script:Business5244PostbootContexts.Add($r);return $token
 }catch{if($epoch){$epoch.Dispose()};$seal.Dispose();$sourceSeal.Dispose();throw}
}
function Get-Business5244PostbootPins([ValidateSet('Old','Candidate')][string]$Slot){
 $r=Get-Business5244PostbootContext $script:Business5244PostbootOwner;$m=$r.manifest;$w=if($Slot-ceq'Old'){$m.oldWeb}else{$m.candidateWeb}
 return @{root=$w.root;package=$w.packageId;manifest=$w.manifestSha256;frontendSource=$w.sourceCommit;apiPackage=$m.api.packageId;apiManifest=$m.api.manifestSha256;baseSource=$m.api.sourceCommit;node=$m.node.path;nodeHash=$m.node.sha256.ToUpperInvariant();profile='ERP-5244-REALDATA-20261027';runtime=(Get-Business5244PostbootCase).runtime}
}
function Assert-Business5244PostbootPackage($Pins){$r=Get-Business5244PostbootContext $script:Business5244PostbootOwner;Assert-Business5244StartupLease $r.lease -Kind Owner;$r.epoch.ValidateLease();$fixed=Get-Business5244PostbootPins $r.slot;foreach($key in $fixed.Keys){if($Pins[$key]-cne$fixed[$key]){throw 'POSTBOOT_FIXED_PACKAGE_REQUIRED'}};return $fixed}
function Assert-Business5244PostbootPayload($Pins){$r=Get-Business5244PostbootContext $script:Business5244PostbootOwner;$r.seal.Validate();return Get-Content -LiteralPath (Join-Path $Pins.root 'release-manifest.json') -Raw|ConvertFrom-Json}
function Assert-Business5244PostbootServiceAdmission($Config){
 $r=Get-Business5244PostbootContext $script:Business5244PostbootTask
 if($r.role-cne'Task'-or$r.epoch.ClaimedRole-cne'services'-or!$r.ContainsKey('serviceConfig')-or![object]::ReferenceEquals($Config,$r.serviceConfig)-or($Config|ConvertTo-Json -Depth 100 -Compress)-cne$r.serviceConfigJson){throw 'POSTBOOT_SERVICE_CONFIG_NOT_ISSUED'}
 if((Assert-Business5244PostbootTask $r.manifest $r.manifestHash Task)-ne$PID){throw 'POSTBOOT_TASK_HOST_CHANGED'}
}
function Assert-Business5244PostbootProtection($Token){
 $r=Get-Business5244PostbootContext $Token;$taskHost=Assert-Business5244PostbootTask $r.manifest $r.manifestHash $r.role -AllowSteadyAction:$r.allowSteadyAction;if($taskHost-ne$r.hostPid){throw 'POSTBOOT_TASK_HOST_CHANGED'}
 $health=Invoke-RestMethod 'http://127.0.0.1:4144/test-health' -TimeoutSec 5
 if((($health.PSObject.Properties.Name|Sort-Object)-join',')-cne(($r.manifest.health.PSObject.Properties.Name|Sort-Object)-join',')){throw 'POSTBOOT_HEALTH_SHAPE_CHANGED'}
 foreach($p in $r.manifest.health.PSObject.Properties){if(($health.($p.Name)|ConvertTo-Json -Compress)-cne($p.Value|ConvertTo-Json -Compress)){throw 'POSTBOOT_API_IDENTITY_CHANGED'}}
 if($health.actualT1-ne$false-or$health.externalOperations-ne$false-or$health.automaticJobs-ne$false){throw 'POSTBOOT_RUNTIME_BOUNDARY_REJECTED'}
 $config=Get-Content -LiteralPath (Get-Business5244PostbootCase).config -Raw|ConvertFrom-Json
 $owned=Get-Content -LiteralPath (Join-Path $config.RuntimeDir 'owned-processes.json') -Raw|ConvertFrom-Json
 if($owned.supervisor-ne$r.hostPid-or$owned.sourceCommit-cne$r.manifest.base.sourceCommit){throw 'POSTBOOT_CANONICAL_HOST_RECORD_CHANGED'}
 foreach($definition in Get-ErpServiceDefinitions $config){
  $record=$owned.children.($definition.Name);if(!$record-or$record.pid-le0){throw 'POSTBOOT_CANONICAL_CHILD_MISSING'}
  $actor=Assert-ErpOwnedProcess $record.pid (Get-ErpServiceConfig $config $definition) $definition $record.createdAt
  if(!$actor-or$actor.ParentProcessId-ne$r.hostPid){throw 'POSTBOOT_CANONICAL_CHILD_CHANGED'}
  $r.epoch.BindOrValidateActor(($definition.Name+[string]$definition.Port),[int]$actor.ProcessId,$actor.CreationDate.ToUniversalTime().ToFileTimeUtc().ToString())
 }
}
function Write-Business5244PostbootRecord($Token,[string]$Leaf,$Value,[switch]$Raw){$r=Get-Business5244PostbootContext $Token;$bytes=if($Raw){[byte[]]$Value}else{[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 12 -Compress))};return $r.epoch.WriteNew($Leaf,$bytes)}
function Register-Business5244PostbootNative($Token,$Native,[switch]$Created){$r=Get-Business5244PostbootContext $Token;Assert-Business5244StartupLease $r.lease -Kind Owner;if(!($Native-is[Business5244WebNative])){throw 'POSTBOOT_CREATED_NATIVE_REQUIRED'};if($Created){if(![object]::ReferenceEquals($r.native,$Native)){throw 'POSTBOOT_NATIVE_CHANGED'};$r.epoch.ObserveCreatedChild($Native)}else{$r.epoch.BindChild($Native);$r.native=$Native}}
function Assert-Business5244PostbootHttp($Token){
 $r=Get-Business5244PostbootContext $Token;$pins=Get-Business5244PostbootPins $r.slot;$expected=[IO.File]::ReadAllBytes((Join-Path $pins.root 'apps\sites-workflow\dist\ornek-akis.html'))
 $response=Invoke-WebRequest 'http://127.0.0.1:5244/ornek-akis.html' -UseBasicParsing -TimeoutSec 5
 if($response.StatusCode-ne200){throw 'POSTBOOT_HTTP_NOT_READY'};$ms=[IO.MemoryStream]::new();try{$response.RawContentStream.Position=0;$response.RawContentStream.CopyTo($ms);if((Get-Business5244PostbootHash $ms.ToArray())-cne(Get-Business5244PostbootHash $expected)){throw 'POSTBOOT_HTTP_PAYLOAD_CHANGED'}}finally{$ms.Dispose()}
}
function Open-Business5244PostbootGuiProof($Token,[ValidateSet('Old','Candidate')][string]$Slot='Old'){
 $r=Get-Business5244PostbootContext $Token;$c=Get-Business5244PostbootCase;$path=Join-Path $c.privateRoot ('gui-'+$Slot.ToLowerInvariant()+'.json');Assert-Business5244PostbootPath $path
 $seal=[Business5244PackageSeal]::new()
 try{
  $seal.Add($path,((Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()));$proof=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
  $expectedWeb=if($Slot-ceq'Old'){$r.manifest.oldWeb}else{$r.manifest.candidateWeb}
  if($proof.schema-cne'melisa-b6-postboot-normal-gui.v1'-or$proof.method-cne'NORMAL_BROWSER'-or$proof.synthetic-isnot[bool]-or$proof.synthetic-or$proof.humanAcceptance-isnot[bool]-or$proof.humanAcceptance-or$proof.url-cne'http://192.168.1.46:5244/ornek-akis.html#stock'-or$proof.ownerPid-ne$PID-or$proof.ownerBirth-cne[Business5244PostbootEpoch]::CurrentBirth-or$proof.childPid-ne$r.native.ChildPid-or$proof.childBirth-cne$r.native.ChildBirth-or$proof.webManifestSha256-cne$expectedWeb.manifestSha256-or$proof.boot-cne$r.epoch.Boot){throw 'POSTBOOT_NORMAL_GUI_REQUIRED'}
  $readyAt=if($Slot-ceq'Old'){$r.oldReadyUtc}else{$r.candidateReadyUtc};$when=[DateTimeOffset]::Parse([string]$proof.observedUtc).UtcDateTime;if($when-lt$readyAt-or$when-gt[DateTime]::UtcNow){throw 'POSTBOOT_GUI_TIME_REJECTED'}
  $image=[IO.Path]::GetFullPath([string]$proof.screenshotPath)
  if(!$image.StartsWith($c.privateRoot+'\',[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetExtension($image)-cne'.png'-or$proof.screenshotSha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'POSTBOOT_GUI_IMAGE_REJECTED'}
  if((Get-Item -LiteralPath $image).Length-gt10485760){throw 'POSTBOOT_GUI_IMAGE_REJECTED'};$seal.Add($image,$proof.screenshotSha256);$imageBytes=[IO.File]::ReadAllBytes($image);if($imageBytes.Length-lt24-or[BitConverter]::ToString($imageBytes,0,8)-cne'89-50-4E-47-0D-0A-1A-0A'){throw 'POSTBOOT_GUI_IMAGE_REJECTED'};$seal.Freeze();$seal.Validate();return $seal
 }catch{$seal.Dispose();throw}
}
function Publish-Business5244PostbootChild($Token,[ValidateSet('old','candidate','rollback','steady')][string]$Stage){
 $r=Get-Business5244PostbootContext $Token;Assert-Business5244PostbootProtection $Token;Assert-Business5244StartupLease $r.lease -Kind Owner;$r.epoch.ValidateLease()
 $pins=Get-Business5244PostbootPins $r.slot;Assert-Business5244CreatedChild $r.native $pins;Assert-Business5244ReadyChild $r.native $pins
 $path=(Get-Business5244PostbootCase).records;$r.epoch.HoldRecordDirectory();Assert-Business5244PostbootPath $path
 $ownsStream=$null-eq$r.transitionRecordStream;$stream=if($ownsStream){[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}else{$r.transitionRecordStream};$stream.Position=0
 try{
  $ms=[IO.MemoryStream]::new();try{$stream.CopyTo($ms);$before=$ms.ToArray()}finally{$ms.Dispose()}
  $beforeHash=Get-Business5244PostbootHash $before
  if($r.metadataHash-and$r.metadataHash-cne$beforeHash){throw 'POSTBOOT_RECORD_CAS_CHANGED'}
  $text=[Text.UTF8Encoding]::new($false,$true).GetString($before);$matches=@([regex]::Matches($text,'\{[^{}]*\}')|Where-Object{try{($_.Value|ConvertFrom-Json).port-eq5244}catch{$false}})
  if($matches.Count-ne1){throw 'POSTBOOT_RECORD_SHAPE_REJECTED'};$match=$matches[0];$row=$match.Value|ConvertFrom-Json
  if(($row.PSObject.Properties.Name|Sort-Object)-join','-cne'backendPort,businessWorkfaceId,entry,pid,port,root,sourceCommit'-or$row.backendPort-ne4144-or$row.entry-cne'vite-preview'-or$row.businessWorkfaceId-cne$pins.profile){throw 'POSTBOOT_RECORD_SCOPE_REJECTED'}
  $previous=if($r.metadataSlot-ceq'Candidate'){$r.manifest.candidateWeb}else{$r.manifest.oldWeb}
  if($row.root-cne$previous.root-or$row.sourceCommit-cne$previous.sourceCommit){throw 'POSTBOOT_RECORD_PREDECESSOR_CHANGED'}
  # A verified new boot ended the old cohort. A reused historical numeric PID
  # is neither an actor to stop/adopt nor a reason to reject unrelated work.
  [void](Write-Business5244PostbootRecord $Token ($Stage+'-metadata-before.bin') $before -Raw)
  $row.pid=[int]$r.native.ChildPid;$row.root=$pins.root;$row.sourceCommit=$pins.frontendSource
  $replacement=$row|ConvertTo-Json -Compress;$afterText=$text.Substring(0,$match.Index)+$replacement+$text.Substring($match.Index+$match.Length);$after=[Text.Encoding]::UTF8.GetBytes($afterText)
  # Only this one flat WEB record changes. All other bytes remain identical.
  [void](Write-Business5244PostbootRecord $Token ($Stage+'-metadata-after.bin') $after -Raw)
  Assert-Business5244StartupLease $r.lease -Kind Owner;$r.epoch.ValidateLease();$r.metadataUnknown=$true;$stream.Position=0;$stream.Write($after,0,$after.Length);$stream.SetLength($after.Length);$stream.Flush($true);$stream.Position=0;$actual=[byte[]]::new($after.Length)
  if($stream.Read($actual,0,$actual.Length)-ne$actual.Length-or(Get-Business5244PostbootHash $actual)-cne(Get-Business5244PostbootHash $after)){throw 'POSTBOOT_RECORD_WRITE_UNKNOWN'}
  $r.metadataHash=Get-Business5244PostbootHash $after;$r.metadataSlot=$r.slot;$r.metadataUnknown=$false
 }finally{if($ownsStream){$stream.Dispose()}else{$stream.Position=0}}
 Assert-Business5244PostbootProtection $Token;Assert-Business5244PostbootHttp $Token;$r.epoch.Ready($r.native)
 if($Stage-cin@('old','rollback')){$r.oldReadyUtc=[DateTime]::UtcNow};if($Stage-ceq'candidate'){$r.candidateReadyUtc=[DateTime]::UtcNow}
 [void](Write-Business5244PostbootRecord $Token ($Stage+'-ready.json') @{schema='melisa-b6-postboot-child-ready.v1';boot=$r.epoch.Boot;stage=$Stage;pid=$r.native.ChildPid;birth=$r.native.ChildBirth;manifest=$pins.manifest;metadataSha256=$r.metadataHash;normalGuiVerified=$false;humanAcceptance='BEKLIYOR';runtimeGo=$false})
}
function Assert-Business5244PostbootRequest($Token,$Channel,$Request,[string]$Action){
 $r=Get-Business5244PostbootContext $Token;Assert-Business5244RetirementRequest $Channel $Request;$connection=Get-Business5244RetirementRecord $Channel;$connection.peer.Validate()
 $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$connection.peer.Pid)
 if(!$process-or![Business5244WebNative]::MatchesCimBirth([long]$connection.peer.Birth,$process.CreationDate.ToUniversalTime().ToFileTimeUtc())){throw 'POSTBOOT_CONTROLLER_CHANGED'}
 $c=Get-Business5244PostbootCase;$argv=[Business5244PostbootEpoch]::SplitArguments($process.CommandLine)
 $expected=@($c.ps,'-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',(Join-Path $c.root 'postboot-control.ps1'),'-ManifestSha256',$r.manifestHash,'-Action',$Action)
 if(($argv|ConvertTo-Json -Compress)-cne($expected|ConvertTo-Json -Compress)){throw 'POSTBOOT_CONTROLLER_ENTRY_REJECTED'};$connection.peer.Validate()
}
function Invoke-Business5244PostbootSuccessor($Token,$Channel,$Request,[ValidateSet('Promote','Rollback')][string]$Action){
 $r=Get-Business5244PostbootContext $Token;Assert-Business5244PostbootRequest $Token $Channel $Request $Action;Assert-Business5244PostbootProtection $Token
 if($r.manifest.phase-cne'FINITE'){throw 'POSTBOOT_FINITE_TRANSITION_REQUIRED'}
 $gui=$null;if($Action-ceq'Promote'){$gui=Open-Business5244PostbootGuiProof $Token}
 try{
 $r.epoch.HoldRecordDirectory();$recordPath=(Get-Business5244PostbootCase).records;Assert-Business5244PostbootPath $recordPath
 $r.transitionRecordStream=[IO.File]::Open($recordPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $ms=[IO.MemoryStream]::new();try{$r.transitionRecordStream.CopyTo($ms);$hash=Get-Business5244PostbootHash $ms.ToArray()}finally{$ms.Dispose();$r.transitionRecordStream.Position=0}
 if(!$r.metadataHash-or$hash-cne$r.metadataHash){throw 'POSTBOOT_RECORD_CAS_CHANGED'}
 $old=$r.native;$r.epoch.HoldPendingDirectory();$r.epoch.BeginSuccessor($Action)
 $intent=[ordered]@{schema='melisa-b6-postboot-successor-intent.v1';boot=$r.epoch.Boot;action=$Action;ownerPid=$PID;ownerBirth=[Business5244PostbootEpoch]::CurrentBirth;oldChildPid=$old.ChildPid;oldChildBirth=$old.ChildBirth;requestId=$Request.requestId;manifestSha256=$r.manifestHash;originalRequestId=$r.manifest.originalRequestId;originalPath=$r.manifest.originalPath;originalBodySha256=$r.manifest.originalBodySha256;conditionalRollback='ONLY_VERIFIED_OWN_CANDIDATE_CLEANUP';rollbackManifestSha256=$r.manifest.oldWeb.manifestSha256;automaticRetry=$false}
 $intentHash=Write-Business5244PostbootRecord $Token ($Action.ToLowerInvariant()+'-intent.json') $intent
 if($null-eq$r.pending){
  $bytes=[Text.Encoding]::UTF8.GetBytes((@{schema='melisa-b6-postboot-successor.pending.v1';boot=$r.epoch.Boot;ownerPid=$PID;ownerBirth=[Business5244PostbootEpoch]::CurrentBirth;intentSha256=$intentHash;automaticRestartAllowed=$false}|ConvertTo-Json -Compress));$r.pending=$r.epoch.CreatePending($bytes)
 }
 # The SAME genuine Owner lease stays held throughout. No pending bypass,
 # reacquisition, archive, q/stdin deadline, external Stop or PID adoption.
 if($gui){$gui.Validate()};Assert-Business5244PostbootRequest $Token $Channel $Request $Action;Assert-Business5244StartupLease $r.lease -Kind Owner;$r.epoch.ValidateLease()
 $old.Dispose();$r.epoch.ConfirmOldChildClosed($old);$r.native=$null
 $r.slot=if($Action-ceq'Promote'){'Candidate'}else{'Old'}
 try{$r.native=New-Business5244PinnedChild (Get-Business5244PostbootPins $r.slot) $r.lease -PostbootContext $Token;Publish-Business5244PostbootChild $Token $(if($Action-ceq'Promote'){'candidate'}else{'rollback'})}
 catch{
  if($Action-cne'Promote'-or$null-eq$r.native-or$r.metadataUnknown){throw}
  # Only a known genuine candidate and observed own cleanup can admit this
  # predeclared conditional rollback. Unknown effects remain stopped/UNKNOWN.
  $r.native.Dispose();$r.epoch.AdmitRollbackAfterFailedCandidate($r.native);$r.native=$null
  [void](Write-Business5244PostbootRecord $Token 'promotion-failed.json' @{schema='melisa-b6-postboot-promotion-failed.v1';cleanupVerified=$true;requestId=$Request.requestId;retryCalls=0})
  $r.slot='Old';$r.native=New-Business5244PinnedChild (Get-Business5244PostbootPins Old) $r.lease -PostbootContext $Token;Publish-Business5244PostbootChild $Token rollback
 }
 $r.epoch.EndSuccessor()
 }finally{if($r.transitionRecordStream){$r.transitionRecordStream.Dispose();$r.transitionRecordStream=$null};if($gui){$gui.Dispose()}}
}
function Open-Business5244PostbootSteadySeal($Token){
 $r=Get-Business5244PostbootContext $Token;$target=$r.manifest.steady.($r.slot);$seal=[Business5244PackageSeal]::new()
 try{
  $path=Join-Path $target.root 'postboot-manifest.json';Assert-Business5244PostbootPath $path;$seal.Add($path,$target.manifestSha256)
  $actual=[IO.File]::ReadAllText($path)|ConvertFrom-Json
  $expected=$r.manifest|ConvertTo-Json -Depth 100|ConvertFrom-Json
  $expected.PSObject.Properties.Remove('steady');$expected.root=$target.root;$expected.phase='STEADY';$expected.initialSlot=$r.slot
  if((($actual.PSObject.Properties.Name|Sort-Object)-join'|')-cne(($expected.PSObject.Properties.Name|Sort-Object)-join'|')){throw 'POSTBOOT_STEADY_MANIFEST_CHANGED'}
  foreach($p in $expected.PSObject.Properties){if(($actual.($p.Name)|ConvertTo-Json -Depth 100 -Compress)-cne($p.Value|ConvertTo-Json -Depth 100 -Compress)){throw 'POSTBOOT_STEADY_MANIFEST_CHANGED'}}
  foreach($f in $r.manifest.files){if($f.path-cnotmatch'\A[a-zA-Z0-9._-]+\z'){throw 'POSTBOOT_STEADY_SOURCE_REJECTED'};$seal.Add((Join-Path $target.root $f.path),$f.sha256)}
  $r.sourceSeal.Validate();$r.seal.Validate();$seal.Freeze();$seal.Validate();return $seal
 }catch{$seal.Dispose();throw}
}
function Complete-Business5244PostbootGeneration($Token,$Channel,$Request){
 $r=Get-Business5244PostbootContext $Token
 if($r.manifest.phase-cne'FINITE'-or$r.epoch.Stage-cnotin@('OldReady','CandidateReady','RollbackReady')-or$r.metadataUnknown){throw 'POSTBOOT_FINALIZE_NOT_READY'}
 Assert-Business5244PostbootRequest $Token $Channel $Request Finalize
 $r.allowSteadyAction=$true;Assert-Business5244PostbootProtection $Token
 [void](Assert-Business5244PostbootTask $r.manifest $r.manifestHash $r.role -RequireSteadySlot $r.slot)
 $target=$r.manifest.steady.($r.slot);$pins=Get-Business5244PostbootPins $r.slot
 Assert-Business5244CreatedChild $r.native $pins;Assert-Business5244ReadyChild $r.native $pins;Assert-Business5244PostbootHttp $Token
 $gui=$null;$steadySeal=$null;$stream=$null
 try{
  # The selected future launcher must exist with the same held canonical
  # source/payload closure before intent; retain these handles through commit.
  $steadySeal=Open-Business5244PostbootSteadySeal $Token
  $gui=Open-Business5244PostbootGuiProof $Token $r.slot
  $r.epoch.HoldRecordDirectory();$path=(Get-Business5244PostbootCase).records;Assert-Business5244PostbootPath $path;$stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $ms=[IO.MemoryStream]::new();try{$stream.CopyTo($ms);if((Get-Business5244PostbootHash $ms.ToArray())-cne$r.metadataHash){throw 'POSTBOOT_RECORD_CAS_CHANGED'}}finally{$ms.Dispose()}
  $gui.Validate();$r.epoch.HoldPendingDirectory();$r.epoch.BeginFinalize()
  $intentHash=Write-Business5244PostbootRecord $Token 'finalize-intent.json' @{schema='melisa-b6-postboot-finalize-intent.v1';planSha256=$r.manifest.planSha256;slot=$r.slot;steadyManifestSha256=$target.manifestSha256;ownerPid=$PID;ownerBirth=[Business5244PostbootEpoch]::CurrentBirth;childPid=$r.native.ChildPid;childBirth=$r.native.ChildBirth;requestId=$Request.requestId;metadataSha256=$r.metadataHash}
  if($null-eq$r.pending){$bytes=[Text.Encoding]::UTF8.GetBytes((@{schema='melisa-b6-postboot-successor.pending.v1';boot=$r.epoch.Boot;ownerPid=$PID;ownerBirth=[Business5244PostbootEpoch]::CurrentBirth;intentSha256=$intentHash;automaticRestartAllowed=$false}|ConvertTo-Json -Compress));$r.pending=$r.epoch.CreatePending($bytes)}
  Assert-Business5244PostbootRequest $Token $Channel $Request Finalize;[void](Assert-Business5244PostbootTask $r.manifest $r.manifestHash $r.role -RequireSteadySlot $r.slot);$r.epoch.ValidateLease();$gui.Validate()
  $steadySeal.Validate();$r.sourceSeal.Validate();$r.seal.Validate()
  $pendingHash=$r.epoch.PendingSha256;$r.epoch.CompleteOwnBarrier()
  [void](Write-Business5244PostbootRecord $Token 'finalize-receipt.json' @{schema='melisa-b6-postboot-finalized.v1';state='FIXED_STEADY_COMMITTED';planSha256=$r.manifest.planSha256;sourceCommit=$r.manifest.sourceCommit;slot=$r.slot;steadyManifestSha256=$target.manifestSha256;webManifestSha256=$pins.manifest;pendingSha256=$pendingHash;finalizeIntentSha256=$intentHash;boot=$r.epoch.Boot;ownerPid=$PID;ownerBirth=[Business5244PostbootEpoch]::CurrentBirth;childPid=$r.native.ChildPid;childBirth=$r.native.ChildBirth;metadataSha256=$r.metadataHash;humanAcceptance='BEKLIYOR';sqlWrites=0;taskWrites=0})
  $r.epoch.CommitFinalization()
 }finally{if($stream){$stream.Dispose()};if($gui){$gui.Dispose()};if($steadySeal){$steadySeal.Dispose()}}
}
function Start-Business5244PostbootOwner([string]$ManifestSha256){
 $token=New-Business5244PostbootContext Owner $ManifestSha256;$script:Business5244PostbootOwner=$token;$r=Get-Business5244PostbootContext $token;$channel=$null
 try{
  Assert-Business5244PostbootProtection $token;$r.lease=Enter-Business5244StartupLease -Kind Owner;$leaseRecord=Get-Business5244StartupRecord $r.lease;$r.epoch.BindLease($leaseRecord.mutex,$leaseRecord.name);$r.epoch.Claim('web')
  [void](Write-Business5244PostbootRecord $token 'claim.json' @{schema='melisa-b6-postboot-owner-claim.v1';boot=$r.epoch.Boot;manifestSha256=$ManifestSha256;ownerPid=$PID;ownerBirth=[Business5244PostbootEpoch]::CurrentBirth;oldNamespacesReused=$false;runtimeGo=$false})
  $r.native=New-Business5244PinnedChild (Get-Business5244PostbootPins $r.slot) $r.lease -PostbootContext $token;Publish-Business5244PostbootChild $token $(if((Get-Business5244PostbootCase).steady){'steady'}else{'old'})
  $channel=Open-Business5244RetirementChannel -OwnerLease $r.lease
  while($true){
   Assert-Business5244StartupLease $r.lease -Kind Owner;$r.epoch.ValidateLease();if(!$r.native-or!$r.native.ChildAlive()){throw 'POSTBOOT_OWN_CHILD_EXITED'}
   $request=$null
   try{$request=Receive-Business5244RetirementRequest $channel}catch{if($_.Exception.Message-cin@('RETIREMENT_REQUEST_NOT_CONFIRMED','RETIREMENT_CHANNEL_UNAVAILABLE')){Start-Sleep -Milliseconds 200;continue};throw}
   if($request){$reply='Status';try{
    if($request.operation-ceq'retire'){Invoke-Business5244PostbootSuccessor $token $channel $request Promote;$reply='RetireAccepted'}
    elseif($request.operation-ceq'recover'){Invoke-Business5244PostbootSuccessor $token $channel $request Rollback;$reply='RecoveryAccepted'}
    elseif($request.operation-ceq'complete'){Complete-Business5244PostbootGeneration $token $channel $request;$reply='CompletionAccepted'}
    elseif($request.operation-cne'status'){throw 'POSTBOOT_OPERATION_REJECTED'}
   }catch{$reply='Rejected';if($r.metadataUnknown-or!$r.native-or!$r.native.ChildAlive()){throw};$r.seal.Validate()}
   try{Complete-Business5244RetirementRequest $channel $request $reply @{phase=$(if($r.epoch.Stage-cin@('OldReady','CandidateReady','RollbackReady','SteadyReady','Committed')){'Running'}else{'Unknown'});ownerPid=$PID;ownerBirth=[Business5244PostbootEpoch]::CurrentBirth;childPid=$r.native.ChildPid;childBirth=$r.native.ChildBirth;requestId=$request.requestId}|Out-Null}catch{if($_.Exception.Message-cnotin@('RETIREMENT_ADMISSION_EXPIRED','RETIREMENT_ACK_NOT_CONFIRMED','RETIREMENT_NATIVE_PEER_CHANGED')){throw}}}
   Start-Sleep -Milliseconds 100
  }
 }finally{
  if($channel){Close-Business5244RetirementChannel $channel};if($r.native){$r.native.Dispose()};if($r.lease){Exit-Business5244StartupLease $r.lease};$r.epoch.Dispose();if($r.pending){$r.pending.Dispose()};$r.seal.Dispose();$r.sourceSeal.Dispose();$r.closed=$true
 }
}
function Start-Business5244PostbootWeb {
 $r=Get-Business5244PostbootContext $script:Business5244PostbootTask
 if($r.role-cne'Task'-or$PSScriptRoot-cne(Get-Business5244PostbootCase).root){throw 'POSTBOOT_TASK_CONTEXT_REQUIRED'}
 if($r.ContainsKey('webAttempt')){return $r.webAttempt}
 Assert-Business5244PostbootProtection $r.token
 if(@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'POSTBOOT_WEB_ALREADY_PRESENT_NO_ADOPTION'}
 $r.webAttempt=@{state='unknown';attempted=$true;owner=$null}
 $c=Get-Business5244PostbootCase;$child=Start-Process -FilePath $c.ps -ArgumentList @('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',(Join-Path $c.root 'postboot-owner.ps1'),'-ManifestSha256',$r.manifestHash) -WorkingDirectory $c.root -WindowStyle Hidden -PassThru
 [void]$child.Handle;$r.webAttempt.owner=$child;$r.webAttempt.state='started-unverified';return $r.webAttempt
}
