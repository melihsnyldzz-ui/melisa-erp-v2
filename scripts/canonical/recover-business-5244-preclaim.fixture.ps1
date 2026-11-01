param([Parameter(Mandatory=$true)][ValidateSet('tr-TR','en-US')][string]$Culture,[Parameter(Mandatory=$true)][string]$SourceDirectory,[Parameter(Mandatory=$true)][string]$TempRoot,[ValidateRange(0,3)][int]$Group)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition-cne'Desktop'-or$PSVersionTable.PSVersion.Major-ne5){throw 'FIXTURE_PS51_REQUIRED'}
foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$module,($module+'.psd1'))) -Scope Local -ErrorAction Stop}
[Threading.Thread]::CurrentThread.CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo($Culture)
[Threading.Thread]::CurrentThread.CurrentUICulture=[Globalization.CultureInfo]::GetCultureInfo($Culture)
if([IO.Path]::GetFullPath($TempRoot)-cne$TempRoot-or[IO.Path]::GetFileName($TempRoot)-notlike'b6-preclaim-*'-or(Get-Item -LiteralPath $TempRoot).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'FIXTURE_TEMP_SCOPE'}
# This inert witness never opens a Windows mutex or a recovery capability.
Add-Type -TypeDefinition @'
using System;
public sealed class B6PreclaimWitness:IDisposable {
 public string Mode;public int Waits,Releases,Disposals;
 public bool WaitOne(int ms){if(ms!=0)throw new Exception("FIXTURE_WAIT");Waits++;if(Mode=="abandoned")throw new System.Threading.AbandonedMutexException();return Mode=="free";}
 public void ReleaseMutex(){Releases++;}public void Dispose(){Disposals++;}
}
'@
$script:count=0;$script:positive=0;$script:negative=0;$script:statusCases=0
$script:fixtureEntryText=[IO.File]::ReadAllText((Join-Path $SourceDirectory 'recover-business-5244-retained-handoff.ps1')).Replace("`r`n","`n")
$script:fixtureNativeText=[IO.File]::ReadAllText((Join-Path $SourceDirectory 'business-5244-retirement-peer.cs')).Replace("`r`n","`n")
$script:fixtureProducerText=[IO.File]::ReadAllText((Join-Path $SourceDirectory 'prepare-business-5244-retained-recovery.mjs')).Replace("`r`n","`n")
function Save-Fixture([string]$Path,[string]$Text){[IO.File]::WriteAllText($Path,$Text,[Text.UTF8Encoding]::new($false));return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Save-FixtureJson([string]$Path,$Value){return Save-Fixture $Path ($Value|ConvertTo-Json -Depth 12 -Compress)}
function Start-FixtureCase {
 $script:count++;$script:caseRoot=Join-Path $TempRoot $script:count;[void][IO.Directory]::CreateDirectory($caseRoot)
 foreach($name in @('source','before','peer','shared')){[void][IO.Directory]::CreateDirectory((Join-Path $caseRoot $name))}
 [void][IO.Directory]::CreateDirectory((Join-Path $caseRoot 'before\install-once'))
 $script:entry=Join-Path $caseRoot 'source\recover-business-5244-retained-handoff.ps1'
 $script:entryHash=Save-Fixture $entry $script:fixtureEntryText
 . $entry -Library -SourceSha256 $entryHash
 $script:actualInitializer=(Get-Item function:Initialize-B6RetainedRecoveryNative).ScriptBlock
 $script:SourceSha256=$entryHash
 $script:case=Get-B6RetainedRecoveryCase
 $case.sourceRoot=Join-Path $caseRoot 'source';$case.beforeRoot=Join-Path $caseRoot 'before';$case.peerRoot=Join-Path $caseRoot 'peer';$case.root=Join-Path $caseRoot 'shared'
 $case.marker=Join-Path $caseRoot 'marker.json';$case.before=Join-Path $caseRoot 'before.json';$case.beforeManifest=Join-Path $caseRoot 'before-manifest.json'
 function script:Get-B6RetainedRecoveryCase {return $script:case}
 $script:B6RecoveryHolds=[Collections.Generic.List[IO.FileStream]]::new();$script:B6RecoveryInputs=@{};$script:trace=[Collections.Generic.List[string]]::new()
 $script:witness=[B6PreclaimWitness]::new();$script:mode='valid';$script:ciManifest=$null
 [void](Save-Fixture (Join-Path $case.sourceRoot 'business-5244-retirement-peer.cs') $script:fixtureNativeText)
 $script:producerHash=Save-Fixture (Join-Path $case.sourceRoot 'prepare-business-5244-retained-recovery.mjs') $script:fixtureProducerText
 $proofHash=Save-Fixture (Join-Path $case.sourceRoot 'ci-provenance.json') '{"synthetic":true}'
 $script:ciManifest=@{schema='melisa-b6-retained-recovery-source.v2';generation='ERP-B6-RECOVERY-PS51-PREFLIGHT-20261101-0839';sourceCommit=('a'*40);binding=@{sourceRoot=$case.sourceRoot;recoveryRoot=$case.root};provenance=@{path='ci-provenance.json';sha256=$proofHash}}
 [void](Save-FixtureJson (Join-Path $case.sourceRoot 'source-manifest.json') $ciManifest)
 $script:when=[datetime]'2026-10-31T20:00:00Z'
 $script:protectedFile=Join-Path $caseRoot 'protected.txt';$protectedHash=Save-Fixture $protectedFile 'protected'
 $script:failure=@{status='FAILED_REVIEW_RECEIPT';failure='B6_ACTIVE_ENTRY_HANDOFF_GATES_RETAINED';outcome=$null;scope='TEST125-API-B6-WRITER-20261029';stopCalls=0;startCalls=0;retireAttempts=0;taskChanges=0;apiRestarts=0;profileWrites=0;sqlWrites=0;before=@{files=@(@{path=$protectedFile;hash=$protectedHash});processes=@(@{pid=31124;exe='fixture-api';birth=$when.ToString('o')});listeners=@(@{LocalPort=4144;LocalAddress='127.0.0.1';OwningProcess=31124})}}
 $case.failureHash=Save-FixtureJson (Join-Path $case.beforeRoot 'install-once\result.json') $failure
 $script:coreEntry=Join-Path $case.peerRoot 'run-current-owner.ps1';$coreEntryHash=Save-Fixture $coreEntry 'fixture-core-entry'
 $script:record=Join-Path $caseRoot 'record.json';$recordHash=Save-Fixture $record 'record'
 $files=@();foreach($name in @('startup','business-profile','runtime-private','journal')){$p=Join-Path $caseRoot ($name+'.txt');$files+=@{path=$p;sha256=(Save-Fixture $p $name)}}
 $script:before=@{files=$files;entries=@(@{path=$coreEntry;sha256=$coreEntryHash});recordPath=$record;recordSha256=$recordHash}
 $case.beforeHash=Save-FixtureJson $case.before $before
 $script:marker=@{schema='business-5244-cold-handoff.pending.v1';controllerPid=$case.controllerPid;controllerBirth=$case.controllerBirth;ownerPid=$case.ownerPid;ownerBirth=$case.ownerBirth;operationId=('b'*32);entries=@(@{path=$coreEntry;sha256=$coreEntryHash})}
 $case.markerHash=Save-FixtureJson $case.marker $marker
 $ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 $script:self=[pscustomobject]@{ExecutablePath=$ps;CommandLine=('"'+$ps+'" -NoProfile -NonInteractive -WindowStyle Hidden -File '+$entry+' -Apply -SourceSha256 '+$entryHash.ToUpperInvariant())}
 $script:selfSid=[pscustomobject]@{ReturnValue=0;Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}
 $script:owner=[pscustomobject]@{ExecutablePath='fixture-owner.exe';CommandLine='fixture-owner-argv'}
 $script:child=[pscustomobject]@{ExecutablePath='fixture-node.exe';ParentProcessId=$case.ownerPid;CommandLine='"fixture-node.exe" "C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030\apps\sites-workflow\node_modules\vite\bin\vite.js" preview --host 127.0.0.1 --port 5244 --strictPort'}
 $script:protectedProcess=[pscustomobject]@{ExecutablePath='fixture-api';CreationDate=$when}
 $savedOwner=@{owner=@{exe=$owner.ExecutablePath;argv=$owner.CommandLine};child=@{exe=$child.ExecutablePath}}
 $script:taskCapture=@{instanceCount=1;enginePid=27732;instanceGuid='fixture-instance'}
 $images=@();foreach($name in @('current-entry-hold-capture.json','current-erp-processes.before.json','current-read2b-owner-capture.json','current-task-capture.json','current-task.before.sddl','current-task.before.xml','pending-web-before.json','webonly-api-before.json')){
  $text=switch -CaseSensitive ($name){'current-read2b-owner-capture.json'{$savedOwner|ConvertTo-Json -Depth 5 -Compress}'current-task-capture.json'{$taskCapture|ConvertTo-Json -Compress}'current-task.before.xml'{'fixture-task-xml'}'current-task.before.sddl'{'fixture-task-sddl'}default{'{}'}}
  $p=Join-Path $case.beforeRoot $name;$images+=@{path=$p;sha256=(Save-Fixture $p $text)}
 }
 $script:frozen=@{privateBeforeImages=$images};$case.beforeManifestHash=Save-FixtureJson $case.beforeManifest $frozen
 $coreFiles=@(@{path='run-current-owner.ps1';sha256=$coreEntryHash})
 foreach($name in @('business-5244-retirement-channel.ps1','peer-data.json')){$p=Join-Path $case.peerRoot $name;$coreFiles+=@{path=$name;sha256=(Save-Fixture $p ('fixture-'+$name))}}
 $case.peerManifestHash=Save-FixtureJson (Join-Path $case.peerRoot 'owner-manifest.json') @{files=$coreFiles}
 $script:listeners=@(@{LocalPort=4144;LocalAddress='127.0.0.1';OwningProcess=31124})+@('127.0.0.1','192.168.1.46','100.87.188.3'|ForEach-Object {@{LocalPort=5244;LocalAddress=$_;OwningProcess=7052}})
 $script:task=[pscustomobject]@{Xml='fixture-task-xml';Sddl='fixture-task-sddl'};$task|Add-Member ScriptMethod GetSecurityDescriptor {param($flags);if($flags-ne7){throw 'FIXTURE_SDDL_FLAGS'};return $this.Sddl}
 $script:instance=[pscustomobject]@{EnginePID=27732;InstanceGuid='fixture-instance'};$script:instances=[pscustomobject]@{Count=1};$instances|Add-Member ScriptMethod Item {param($number);if($number-ne1){throw 'FIXTURE_INSTANCE_INDEX'};return $script:instance}
 $task|Add-Member ScriptMethod GetInstances {param($flags);return $script:instances}
 $script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($name);if($name-cne'Melisa-ERP-TEST-Canonical'){throw 'FIXTURE_TASK_NAME'};return $script:task}
 $script:service=[pscustomobject]@{};$service|Add-Member ScriptMethod Connect {};$service|Add-Member ScriptMethod GetFolder {param($name);if($name-cne'\'){throw 'FIXTURE_TASK_FOLDER'};return $script:folder}
 function script:Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'){throw 'FIXTURE_CIM_SCOPE'};switch($Filter){('ProcessId='+$PID){$script:trace.Add('caller');return $script:self}'ProcessId=31124'{return $script:protectedProcess}'ProcessId=33080'{return $script:owner}'ProcessId=7052'{return $script:child}default{throw 'FIXTURE_CIM_PID'}}}
 function script:Invoke-CimMethod($InputObject,$MethodName){if($InputObject-ne$script:self-or$MethodName-cne'GetOwnerSid'){throw 'FIXTURE_CIM_METHOD'};return $script:selfSid}
 function script:New-Object($ComObject){if($ComObject-cne'Schedule.Service'){throw 'FIXTURE_COM_SCOPE'};return $script:service}
 function script:Get-NetTCPConnection($State){if($State-cne'Listen'){throw 'FIXTURE_LISTENER_STATE'};return $script:listeners}
 function script:Invoke-WebRequest($Uri,[switch]$UseBasicParsing,$TimeoutSec){if($Uri-cnotin@('http://127.0.0.1:5244/ornek-akis.html','http://127.0.0.1:4144/api/health')-or!$UseBasicParsing-or$TimeoutSec-ne15){throw 'FIXTURE_HTTP_SCOPE'};if($script:mode-ceq'http-exception'){throw 'FIXTURE_NETWORK_UNAVAILABLE'};return @{StatusCode=$(if($script:mode-ceq'health'){503}else{200})}}
 function script:Initialize-B6RetainedRecoveryNative([byte[]]$Bytes){if([Text.Encoding]::UTF8.GetString($Bytes)-cne$script:fixtureNativeText){throw 'FIXTURE_NATIVE_BYTES'};$script:trace.Add('native-initializer');if($script:mode-ceq'native-loader'){throw 'FIXTURE_NATIVE_LOAD_FAILED'}}
 function script:Get-B6RetainedRecoveryOwnerMutex {$script:trace.Add('witness-provider');if($script:mode-ceq'witness-missing'){throw 'FIXTURE_MUTEX_MISSING'};return $script:witness}
 function script:Invoke-B6RetainedRecoveryCiProcess($Producer){
  if($Producer-cne(Join-Path $script:case.sourceRoot 'prepare-business-5244-retained-recovery.mjs')){throw 'FIXTURE_PRODUCER_SCOPE'}
  $script:trace.Add('live-ci');if($script:mode-ceq'ci-network'){throw 'FIXTURE_CI_NETWORK'}
  $digest=Get-B6RetainedRecoveryHash (Join-Path $script:case.sourceRoot 'source-manifest.json')
  $answer=@{schema='melisa-b6-retained-recovery-ci-verification.v2';generation=$script:ciManifest.generation;sourceCommit=$script:ciManifest.sourceCommit;sourceRoot=$script:case.sourceRoot;recoveryRoot=$script:case.root;manifestSha256=$digest;entrySha256=$script:entryHash;producerSha256=$script:producerHash;liveGithubVerified=$true;executionAuthority=$false;installed=$false;applied=$false;admissionIssued=$false;runtimeValidationComplete=$false}
  switch($script:mode){ci-schema{$answer.schema='wrong'}ci-source{$answer.sourceCommit='wrong'}ci-root{$answer.sourceRoot='wrong'}ci-recovery-root{$answer.recoveryRoot='wrong'}ci-generation{$answer.generation='wrong'}ci-manifest{$answer.manifestSha256='0'*64}ci-entry{$answer.entrySha256='0'*64}ci-producer{$answer.producerSha256='0'*64}ci-unverified{$answer.liveGithubVerified=$false}ci-string{$answer.liveGithubVerified='True'}ci-authority{$answer.executionAuthority=$true}ci-installed{$answer.installed=$true}ci-applied{$answer.applied=$true}ci-admission{$answer.admissionIssued=$true}ci-runtime{$answer.runtimeValidationComplete=$true}ci-authority-string{$answer.executionAuthority='False'}}
  return $answer|ConvertTo-Json -Depth 5 -Compress
 }
}
function Update-Frozen {$script:case.beforeManifestHash=Save-FixtureJson $script:case.beforeManifest $script:frozen}
function Update-Manifest {[void](Save-FixtureJson (Join-Path $script:case.sourceRoot 'source-manifest.json') $script:ciManifest)}
$kinds=@('valid','permuted','hash-case','missing','extra','duplicate','path-case','root-case','relative','traversal','ads','foreign-root','hash-shape','hash-type','path-type','not-array','image-drift','self-hash','self-path','caller-exe','caller-argv','caller-sid','caller-sid-failure','manifest-schema','manifest-generation','manifest-source','manifest-root','manifest-recovery-root','proof-path','proof-drift','producer-drift','native-drift','failure-drift','before-drift','frozen-drift','marker-drift','failure-status','failure-outcome','failure-scope','failure-stop','failure-start','failure-retire','failure-task','failure-api','failure-profile','failure-sql','marker-schema','marker-controller','marker-controller-birth','marker-owner','marker-owner-birth','marker-operation','marker-entry','marker-count','core-manifest-drift','core-payload-drift','protected-file','protected-exe','protected-birth','listener-extra','listener-owned-extra','web-extra','web-owner','startup','business-profile','runtime-private','journal','entry-drift','record','task-xml','task-sddl','task-count','task-engine','task-guid','owner-exe','owner-argv','child-exe','child-parent','child-argv','health','http-exception','native-loader','witness-missing','witness-free','witness-abandoned','existing-once','existing-claim','ci-network','ci-schema','ci-source','ci-root','ci-recovery-root','ci-generation','ci-manifest','ci-entry','ci-producer','ci-unverified','ci-string','ci-authority','ci-installed','ci-applied','ci-admission','ci-runtime','ci-authority-string')
$selected=@();for($index=0;$index-lt$kinds.Count;$index++){if($index%4-eq$Group){$selected+=,$kinds[$index]}}
# Every independent PS5 process proves the unchanged positive path before
# its partition's negatives; exact error codes below prove the failing guard.
. Start-FixtureCase
$baseline=$null
try{
 $baseline=. Open-B6RetainedRecoveryPreclaim
 if($baseline-is[Array]-or$baseline.mutex-ne$witness-or$B6RecoveryHolds.Count-ne20-or$witness.Waits-ne1-or($trace-join'|')-cne'caller|live-ci|native-initializer|witness-provider'){throw 'FIXTURE_GROUP_BASELINE'}
}finally{if($baseline){$baseline.mutex.Dispose()};foreach($h in $B6RecoveryHolds){$h.Dispose()};$B6RecoveryHolds.Clear()}
foreach($kind in $selected){
 . Start-FixtureCase;$script:mode=$kind
 switch($kind){
  permuted{[array]::Reverse($frozen.privateBeforeImages);Update-Frozen}
  hash-case{foreach($f in $frozen.privateBeforeImages){$f.sha256=$f.sha256.ToUpperInvariant()};Update-Frozen}
  missing{$frozen.privateBeforeImages=@($frozen.privateBeforeImages[0..6]);Update-Frozen}
  extra{$frozen.privateBeforeImages+=@{path=(Join-Path $case.beforeRoot 'extra.json');sha256=('0'*64)};Update-Frozen}
  duplicate{$frozen.privateBeforeImages[7]=$frozen.privateBeforeImages[0];Update-Frozen}
  path-case{$frozen.privateBeforeImages[0].path=$frozen.privateBeforeImages[0].path.Replace('current-entry','CURRENT-entry');Update-Frozen}
  root-case{$frozen.privateBeforeImages[0].path=$frozen.privateBeforeImages[0].path.Replace('\before\','\BEFORE\');Update-Frozen}
  relative{$frozen.privateBeforeImages[0].path='current-entry-hold-capture.json';Update-Frozen}
  traversal{$frozen.privateBeforeImages[0].path=$case.beforeRoot+'\..\before\current-entry-hold-capture.json';Update-Frozen}
  ads{$frozen.privateBeforeImages[0].path+=':alias';Update-Frozen}
  foreign-root{$frozen.privateBeforeImages[0].path=(Join-Path $caseRoot 'current-entry-hold-capture.json');Update-Frozen}
  hash-shape{$frozen.privateBeforeImages[0].sha256+= [char]10;Update-Frozen}
  hash-type{$frozen.privateBeforeImages[0].sha256=42;Update-Frozen}
  path-type{$frozen.privateBeforeImages[0].path=42;Update-Frozen}
  not-array{$frozen.privateBeforeImages=@{only=$frozen.privateBeforeImages};Update-Frozen}
  image-drift{[void](Save-Fixture $frozen.privateBeforeImages[0].path 'changed')}
  self-hash{$script:SourceSha256='0'*64}
  self-path{$case.sourceRoot=$caseRoot}
  caller-exe{$self.ExecutablePath='wrong.exe'}caller-argv{$self.CommandLine+=' extra'}caller-sid{$selfSid.Sid='S-1-5-18'}caller-sid-failure{$selfSid.ReturnValue=1}
  manifest-schema{$ciManifest.schema='wrong';Update-Manifest}manifest-generation{$ciManifest.generation='old';Update-Manifest}manifest-source{$ciManifest.sourceCommit='wrong';Update-Manifest}manifest-root{$ciManifest.binding.sourceRoot='wrong';Update-Manifest}manifest-recovery-root{$ciManifest.binding.recoveryRoot='wrong';Update-Manifest}
  proof-path{$ciManifest.provenance.path='../proof';Update-Manifest}proof-drift{[void](Save-Fixture (Join-Path $case.sourceRoot 'ci-provenance.json') 'changed')}
  producer-drift{[void](Save-Fixture (Join-Path $case.sourceRoot 'prepare-business-5244-retained-recovery.mjs') 'changed')}
  native-drift{[void](Save-Fixture (Join-Path $case.sourceRoot 'business-5244-retirement-peer.cs') 'changed')}
  failure-drift{[void](Save-Fixture (Join-Path $case.beforeRoot 'install-once\result.json') 'changed')}before-drift{[void](Save-Fixture $case.before 'changed')}frozen-drift{[void](Save-Fixture $case.beforeManifest 'changed')}marker-drift{[void](Save-Fixture $case.marker 'changed')}
  failure-status{$failure.status='wrong'}failure-outcome{$failure.outcome=@{effect=1}}failure-scope{$failure.scope='wrong'}failure-stop{$failure.stopCalls=1}failure-start{$failure.startCalls=1}failure-retire{$failure.retireAttempts=1}failure-task{$failure.taskChanges=1}failure-api{$failure.apiRestarts=1}failure-profile{$failure.profileWrites=1}failure-sql{$failure.sqlWrites=1}
  marker-schema{$marker.schema='wrong'}marker-controller{$marker.controllerPid++}marker-controller-birth{$marker.controllerBirth='wrong'}marker-owner{$marker.ownerPid++}marker-owner-birth{$marker.ownerBirth='wrong'}marker-operation{$marker.operationId='wrong'}marker-entry{$marker.entries[0].sha256='0'*64}marker-count{$marker.entries+=@{path='other';sha256=('0'*64)}}
  core-manifest-drift{[void](Save-Fixture (Join-Path $case.peerRoot 'owner-manifest.json') 'changed')}core-payload-drift{[void](Save-Fixture (Join-Path $case.peerRoot 'peer-data.json') 'changed')}
  protected-file{[void](Save-Fixture $protectedFile 'changed')}protected-exe{$protectedProcess.ExecutablePath='wrong'}protected-birth{$protectedProcess.CreationDate=$when.AddTicks(10)}
  listener-extra{$script:listeners+=@{LocalPort=4144;LocalAddress='192.0.2.1';OwningProcess=999}}listener-owned-extra{$script:listeners+=@{LocalPort=5555;LocalAddress='127.0.0.1';OwningProcess=31124}}
  web-extra{$script:listeners+=@{LocalPort=5244;LocalAddress='192.0.2.1';OwningProcess=999}}web-owner{$script:listeners[1].OwningProcess=999}
  startup{[void](Save-Fixture (Join-Path $caseRoot 'startup.txt') 'changed')}business-profile{[void](Save-Fixture (Join-Path $caseRoot 'business-profile.txt') 'changed')}runtime-private{[void](Save-Fixture (Join-Path $caseRoot 'runtime-private.txt') 'changed')}journal{[void](Save-Fixture (Join-Path $caseRoot 'journal.txt') 'changed')}
  entry-drift{[void](Save-Fixture $coreEntry 'changed')}record{[void](Save-Fixture $record 'changed')}
  task-xml{$task.Xml='changed'}task-sddl{$task.Sddl='changed'}task-count{$instances.Count=2}task-engine{$instance.EnginePID++}task-guid{$instance.InstanceGuid='wrong'}
  owner-exe{$owner.ExecutablePath='wrong'}owner-argv{$owner.CommandLine+=' extra'}child-exe{$child.ExecutablePath='wrong'}child-parent{$child.ParentProcessId++}child-argv{$child.CommandLine+=' extra'}
  witness-free{$witness.Mode='free'}witness-abandoned{$witness.Mode='abandoned'}
  existing-once{[void][IO.Directory]::CreateDirectory((Join-Path $case.root 'recovery-once'))}existing-claim{[void](Save-Fixture (Join-Path $case.root 'recovery-claim.json') '{}')}
 }
 if($kind-like'failure-*'-and$kind-cne'failure-drift'){$case.failureHash=Save-FixtureJson (Join-Path $case.beforeRoot 'install-once\result.json') $failure}
 if($kind-like'marker-*'-and$kind-cne'marker-drift'){$case.markerHash=Save-FixtureJson $case.marker $marker}
 $frame=$null;$caught=$null
 try{$frame=. Open-B6RetainedRecoveryPreclaim}catch{$caught=$_}
 try{
  if($kind-cin@('valid','permuted','hash-case')){
   if($caught){throw ('FIXTURE_VALID_REJECTED_'+$kind+': '+$caught.Exception.Message)}
   if($frame-is[Array]-or$frame.mutex-ne$witness-or$B6RecoveryHolds.Count-ne20-or$witness.Waits-ne1-or$witness.Disposals-ne0-or$witness.Releases-ne0-or($trace-join'|')-cne'caller|live-ci|native-initializer|witness-provider'){throw 'FIXTURE_PREFLIGHT_FRAME_OR_ORDER'}
   $denied=$false;try{[void](Save-Fixture $frozen.privateBeforeImages[0].path 'blocked-change')}catch{$denied=$true};if(!$denied){throw 'FIXTURE_HELD_INPUT_WRITABLE'}
   $script:positive++
  }else{
   if(!$caught){throw ('FIXTURE_FALSE_ACCEPT_'+$kind)}
   $expectedCode=switch -Regex -CaseSensitive ($kind){
    '^(missing|extra|duplicate|path-case|ads|not-array)$'{'RETAINED_RECOVERY_BEFORE_CLOSURE';break}
    '^(root-case|relative|traversal|foreign-root)$'{'RETAINED_RECOVERY_BEFORE_SCOPE';break}
    '^(hash-shape|hash-type|path-type)$'{'RETAINED_RECOVERY_BEFORE_SHAPE';break}
    '^(image-drift|proof-drift|producer-drift|native-drift|failure-drift|before-drift|frozen-drift|core-manifest-drift|core-payload-drift|entry-drift)$'{'RETAINED_RECOVERY_HELD_INPUT_CHANGED';break}
    '^self-'{'RETAINED_RECOVERY_FROZEN_ENTRY_REQUIRED';break}
    '^caller-'{'RETAINED_RECOVERY_NATIVE_CALLER_CHANGED';break}
    '^manifest-'{'RETAINED_RECOVERY_CI_MANIFEST';break}
    '^proof-path$'{'RETAINED_RECOVERY_CI_PROOF_PATH';break}
    '^marker-drift$'{'RETAINED_RECOVERY_MARKER_HASH';break}
    '^failure-(status|outcome|scope)$'{'RETAINED_RECOVERY_WRONG_FAILURE';break}
    '^failure-'{'RETAINED_RECOVERY_EFFECTS_NOT_ZERO';break}
    '^marker-entry$'{'RETAINED_RECOVERY_ENTRY_MISMATCH';break}
    '^marker-'{'RETAINED_RECOVERY_MARKER_IDENTITY';break}
    '^protected-file$'{'RETAINED_RECOVERY_PROTECTED_FILE_CHANGED';break}
    '^protected-'{'RETAINED_RECOVERY_PROTECTED_PROCESS_CHANGED';break}
    '^listener-'{'RETAINED_RECOVERY_LISTENER_CHANGED';break}
    '^web-'{'RETAINED_RECOVERY_WEB_LISTENER_CHANGED';break}
    '^(startup|business-profile|runtime-private|journal)$'{'RETAINED_RECOVERY_BASELINE_FILE_CHANGED';break}
    '^record$'{'RETAINED_RECOVERY_RECORD_CHANGED';break}
    '^task-(xml|sddl)$'{'RETAINED_RECOVERY_TASK_CHANGED';break}
    '^task-'{'RETAINED_RECOVERY_TASK_INSTANCE_CHANGED';break}
    '^child-argv$'{'RETAINED_RECOVERY_CHILD_ARGV_CHANGED';break}
    '^(owner-|child-)'{'RETAINED_RECOVERY_OWNER_CHANGED';break}
    '^health$'{'RETAINED_RECOVERY_HEALTH_FAILED';break}
    '^http-exception$'{'FIXTURE_NETWORK_UNAVAILABLE';break}
    '^native-loader$'{'FIXTURE_NATIVE_LOAD_FAILED';break}
    '^witness-missing$'{'FIXTURE_MUTEX_MISSING';break}
    '^witness-free$'{'RETAINED_RECOVERY_OWNER_MUTEX_NOT_HELD';break}
    '^witness-abandoned$'{'RETAINED_RECOVERY_ABANDONED_OWNER';break}
    '^existing-'{'RETAINED_RECOVERY_USE_EXISTING_RECEIPT';break}
    '^ci-network$'{'FIXTURE_CI_NETWORK';break}
    '^ci-'{'RETAINED_RECOVERY_LIVE_CI_BINDING';break}
    default{throw ('FIXTURE_UNCLASSIFIED_CASE_'+$kind)}
   }
   if($caught.Exception.Message-cne$expectedCode){throw ('FIXTURE_WRONG_REJECTION_'+$kind+': '+$caught.Exception.Message+' expected '+$expectedCode)}
   if($B6RecoveryHolds.Count-ne0){throw ('FIXTURE_HELD_STREAM_LEAK_'+$kind)}
   if($trace.Contains('witness-provider')-and$kind-cne'witness-missing'-and$witness.Disposals-ne1){throw ('FIXTURE_WITNESS_LEAK_'+$kind)}
   if($kind-cin@('witness-free','witness-abandoned')-and$witness.Releases-ne1){throw 'FIXTURE_WITNESS_NOT_RELEASED'}
   if($kind-cin@('existing-once','existing-claim')-and$witness.Releases-ne0){throw 'FIXTURE_FOREIGN_OWNER_RELEASED'}
   $script:negative++
  }
 }finally{if($frame){$frame.mutex.Dispose()};foreach($h in $B6RecoveryHolds){$h.Dispose()};$B6RecoveryHolds.Clear()}
}
# Subsequent read-only status assumptions use the very same sequence guard.
if($Group-eq0){foreach($kind in @('valid','peer','peer-string','stop','stop-string','observation','observation-string','reply','phase','owner','owner-birth','child','child-birth')){
 $status=@{nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true;reply='Status';state=@{phase='Running';ownerPid=$case.ownerPid;ownerBirth=$case.ownerBirth;childPid=$case.childPid;childBirth=$case.childBirth}}
 switch($kind){peer{$status.nativePeerVerified=$false}peer-string{$status.nativePeerVerified='True'}stop{$status.stopAuthorized=$true}stop-string{$status.stopAuthorized='False'}observation{$status.childObservationOnly=$false}observation-string{$status.childObservationOnly='True'}reply{$status.reply='Other'}phase{$status.state.phase='Unknown'}owner{$status.state.ownerPid++}owner-birth{$status.state.ownerBirth='wrong'}child{$status.state.childPid++}child-birth{$status.state.childBirth='wrong'}}
 $denied=$false;try{Assert-B6RetainedRecoveryStatus $status}catch{$denied=$true}
 if(($kind-ceq'valid'-and$denied)-or($kind-cne'valid'-and!$denied)){throw ('FIXTURE_STATUS_FALSE_RESULT_'+$kind)};$script:statusCases++
}}
$libraryVisible=$null
if($Group-eq0){
 . Start-FixtureCase
 $core=Get-Content -LiteralPath (Join-Path $case.peerRoot 'owner-manifest.json') -Raw|ConvertFrom-Json
 foreach($name in @('business-5244-retirement-channel.ps1','business-5244-startup-exclusion.ps1')){
  $text=[IO.File]::ReadAllText((Join-Path $SourceDirectory $name)).Replace("`r`n","`n")
  $h=Save-Fixture (Join-Path $case.peerRoot $name) $text
  $found=@($core.files|Where-Object path -CEQ $name)
  if($found.Count){$found[0].sha256=$h}else{$core.files+=@{path=$name;sha256=$h}}
 }
 $case.peerManifestHash=Save-FixtureJson (Join-Path $case.peerRoot 'owner-manifest.json') $core
 Set-Item function:Initialize-B6RetainedRecoveryNative -Value $script:actualInitializer
 $frame=$null
 try{
  $frame=. Open-B6RetainedRecoveryPreclaim
  if($frame-is[Array]-or$frame.mutex-ne$witness-or$B6RecoveryHolds.Count-ne21){throw 'FIXTURE_REAL_LIBRARY_FRAME'}
  foreach($name in @('Get-Business5244StartupMutexName','Connect-Business5244RetirementPeer','Get-Business5244RetirementRecord','Send-Business5244RetirementRequest','Close-Business5244RetirementPeer')){
   $command=Get-Command $name -CommandType Function -ErrorAction Stop
   if(!$command.ScriptBlock.File.StartsWith($case.peerRoot,[StringComparison]::Ordinal)){throw ('FIXTURE_REAL_LIBRARY_SCOPE_'+$name)}
  }
  $libraryVisible=$true
 }finally{if($frame){$frame.mutex.Dispose()};foreach($h in $B6RecoveryHolds){$h.Dispose()};$B6RecoveryHolds.Clear()}
}
[pscustomobject]@{culture=[Threading.Thread]::CurrentThread.CurrentCulture.Name;psVersion=$PSVersionTable.PSVersion.ToString();group=$Group;positiveGroupBaseline=$true;totalCases=$kinds.Count;cases=$selected;positive=$positive;negative=$negative;statusCases=$statusCases;realLibraryVisibleAfterPreclaim=$libraryVisible;failed=0;sharedContract='Open-B6RetainedRecoveryPreclaim';realRuntimeCalls=0}|ConvertTo-Json -Compress
