import test from 'node:test';import assert from 'node:assert/strict';import cp from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const q=s=>"'"+s.replaceAll("'","''")+"'";
// Production lease logic runs against per-invocation local resources only.
const isolatedStartup=String.raw`function Get-Business5244StartupMutexName{return ('Local\MelisaRetirementFixture-'+[IO.Path]::GetFileName($env:TEMP))};function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'fixture.retirement.pending')};`;
const setup=`$ErrorActionPreference='Stop';. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;. ${q(path.join(dir,'start-business-5244-web.ps1'))} -Library;. ${q(path.join(dir,'business-5244-retirement-state.ps1'))} -Library;${isolatedStartup}Add-Type -LiteralPath ${q(path.join(dir,'business-5244-web-native.cs'))};$lease=Enter-Business5244StartupLease -Kind Owner;$pins=Get-Business5244ReadPairPins;$script=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($script,'Start-Sleep -Seconds 300');function New-TestChild{$n=[Business5244WebNative]::new();$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$script+'"'),$env:TEMP);return $n};$native=New-TestChild;$state=Register-Business5244OwnedRetirement $lease $native $pins;$rows=@([pscustomobject]@{port=4194;pid=111;entry='keep-api';root='preserved-api'},[pscustomobject]@{port=4196;pid=112;entry='keep-native';root='preserved-native'},[pscustomobject]@{port=5244;pid=$native.ChildPid;entry='vite-preview';sourceCommit=$pins.frontendSource;root=$pins.root;backendPort=4144;businessWorkfaceId=$pins.profile});$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));$recordPath=Join-Path $env:TEMP 'records.json';$pendingPath=Join-Path $env:TEMP 'retirement.pending';$records=$null;$pending=$null;$replacement=$null;`;
const cleanup=`finally{Close-Business5244RetirementState $state;if($replacement){$replacement.Dispose()};if($records){$records.Dispose()};if($pending){$pending.Dispose()};$native.Dispose();Exit-Business5244StartupLease -Lease $lease};'PASS'`;
function run(body){const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'erp-5244-retirement-state-')));try{const file=path.join(temp,'run.ps1');fs.writeFileSync(file,body);return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',timeout:20000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();}finally{const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('erp-5244-retirement-state-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true,force:true});}}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
const streams=`[IO.File]::WriteAllBytes($recordPath,$before);$records=[IO.File]::Open($recordPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);`;
const b6Setup=setup.replace('$lease=Enter-Business5244StartupLease',"function Get-Business5244StartupMutexName{return ('Local\\MelisaB6Bootstrap-'+[IO.Path]::GetFileName($env:TEMP))};$lease=Enter-Business5244StartupLease").replace('Register-Business5244OwnedRetirement $lease $native $pins;','Register-Business5244OwnedRetirement $lease $native $pins -ScopeName \'TEST125-API-B6-ca620bac-20261028\';')+String.raw`
. __NATIVE_PROFILE__
function Assert-Business5244CreatedChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'ISOLATED_CHILD_NOT_ALIVE'}}
function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
$script:oldChildPresent=$false;$script:oldOwnerPresent=$false
function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'){throw 'ISOLATED_WRONG_CIM'};if($Filter-ceq'ProcessId=24520'){if($script:oldChildPresent){return @{ProcessId=24520}}}elseif($Filter-ceq'ProcessId=22260'){if($script:oldOwnerPresent){return @{ProcessId=22260}}}else{throw 'ISOLATED_FOREIGN_PID_READ'}}
$rows[2].pid=24520;$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));$beforeHash=Get-Business5244StartupHash $before
$captureDir=Join-Path $env:TEMP 'capture';[void][IO.Directory]::CreateDirectory($captureDir);$capturePath=Join-Path $captureDir 'current-read2b-owner-capture.json';$imagePath=Join-Path $captureDir 'current-erp-processes.before.json';[IO.File]::WriteAllBytes($imagePath,$before)
$capture=[pscustomobject]@{schema='melisa-b6-current-read2b-owner-capture.v1';predecessorEntryKind='ReadPairRouter';entry=@{root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE';leaf='start-business-5244-readpair-router.ps1';manifestSha256='ef941287977c2913a8c4ca43cfa002e19f006d6239b9059a5c734cd0db6174e2';sha256='e160fd137828a98f6b4faf814243159276a2707667885f4e321d2ed39abbf238'};readOnly=$true;stopAuthorized=$false;recordPath='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';recordBeforeFile='current-erp-processes.before.json';recordBeforeSha256=$beforeHash;webRecord=$rows[2];child=@{pid=24520;parent=22260;birth='134377102174264511';exe=$pins.node};owner=@{pid=22260;birth='134377094829605064'};nativeStatus=@{reply='Status';nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true;state=@{phase='Running';ownerPid=22260;ownerBirth='134377094829605064';childPid=24520;childBirth='134377102174264511'}};installedApiManifest=$pins.apiManifest;installedWebManifest=$pins.manifest;serviceCalls=0;sqlCalls=0;retireCalls=0}
$captureBytes=[Text.Encoding]::UTF8.GetBytes(($capture|ConvertTo-Json -Depth 20));[IO.File]::WriteAllBytes($capturePath,$captureBytes);$captureHash=Get-Business5244StartupHash $captureBytes
# Only the three immutable input literal pins are virtualized to files created
# by this fixture. The production file hash/reparse validation, metadata gates,
# held CAS, real creation handle and durable publication functions execute.
$getPins=(Get-Command Get-Business5244CurrentBootstrapPins).Definition.Replace('C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\sql-collation-recovered-20261029\current-read2b-owner-capture.json',$capturePath).Replace('4eaa68d16be5260071f74ce7e41e33ce6adaa4c7097d661905968d4b5c1b9945',$captureHash).Replace('20dc7ae37497b88ce7f38039d76481b4f1e0f4e07c503737ec193e85c4be5f1f',$beforeHash)
. ([scriptblock]::Create('function Get-Business5244CurrentBootstrapPins {'+$getPins+'}'))
`.replace('__NATIVE_PROFILE__',q(path.join(dir,'canonical-business-sale-maintenance.ps1')));

win('Writer retirement registers only the genuine owned child and exact Applied-B6 or Writer pair, never READ2b or a copied issuer',()=>{
 const body=setup+String.raw`
 $writerState=$null
 try{
  $script:writerCurrent=(Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate).Clone();$script:writerCandidate=$script:writerCurrent.Clone();$script:writerCandidate.package='ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$script:writerCandidate.root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$script:writerCandidate.apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';$script:writerCandidate.apiManifest='a'*64;$script:writerCandidate.manifest='b'*64
  function Get-ErpBusinessSaleWriterPairPins($Mode){if($Mode-ceq'Current'){return $script:writerCurrent};return $script:writerCandidate}
  $name='TEST125-API-B6-WRITER-20261029';$writerState=Register-Business5244OwnedRetirement $lease $native $script:writerCurrent -ScopeName $name;$r=Get-Business5244RetirementState $writerState
  if($r.scopeName-cne$name-or$r.pins.apiManifest-cne'85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d'-or$r.pins.package-cne'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028'){throw 'WRITER_CURRENT_READ2B_FALLBACK'}
  $denied=$false;try{Get-Business5244RetirementState $writerState.PSObject.Copy()|Out-Null}catch{$denied=$true};if(!$denied){throw 'WRITER_COPIED_STATE'}
  foreach($bad in @((Get-Business5244ReadPairPins),$script:writerCurrent.Clone())){if($bad.package-ceq$script:writerCurrent.package){$bad.apiManifest='0'*64};$denied=$false;try{Register-Business5244OwnedRetirement $lease $native $bad -ScopeName $name|Out-Null}catch{$denied=$true};if(!$denied){throw 'WRITER_MIXED_PAIR_ADMITTED'}}
  foreach($scope in @('test125-api-b6-writer-20261029','Other')){$denied=$false;try{Register-Business5244OwnedRetirement $lease $native $script:writerCurrent -ScopeName $scope|Out-Null}catch{$denied=$true};if(!$denied){throw 'WRITER_SCOPE_FALLBACK'}}
  if(!$native.ChildAlive()){throw 'WRITER_REGISTRATION_RETIRED_CHILD'}
 }finally{if($writerState){Close-Business5244RetirementState $writerState};Close-Business5244RetirementState $state;$native.Dispose();Exit-Business5244StartupLease -Lease $lease};'PASS'
 `;
 // setup owns a real disposable child and a uniquely named local lease.
 assert.equal(run(body),'PASS');
});
const b6InitializerSetup=b6Setup+String.raw`
function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'){throw 'ISOLATED_WRONG_CIM'};if($Filter-ceq'ProcessId=44612'){if($script:oldChildPresent){return @{ProcessId=44612}}}elseif($Filter-ceq'ProcessId=31212'){if($script:oldOwnerPresent){return @{ProcessId=31212}}}else{throw 'ISOLATED_FOREIGN_PID_READ'}}
$rows[2].pid=44612;$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));$beforeHash=Get-Business5244StartupHash $before
$initializerDir=Join-Path $env:TEMP 'initializer-capture';[void][IO.Directory]::CreateDirectory($initializerDir);$capturePath=Join-Path $initializerDir 'current-read2b-owner-capture.json';$imagePath=Join-Path $initializerDir 'current-erp-processes.before.json';$manifestPath=Join-Path $initializerDir 'owner-manifest.json';[IO.File]::WriteAllBytes($imagePath,$before)
$files=@(1..13|ForEach-Object{[pscustomobject]@{path=('fixture'+$_);sha256=('a'*64)}})+@([pscustomobject]@{path='run-current-owner.ps1';sha256='ebc933faf015aadc32be74f7abeaef66252ef3bc72dc52ebac265ced9ed577e5'})
$manifest=[pscustomobject]@{kind='CURRENT_INITIALIZER_CLEAN_BUNDLE';finiteScope='TEST125-API-B6-ca620bac-20261028';sourceCommit='1e6ff9f0fa4467cb532c26182b1334558b13bfaa';actualT1=$false;externalOperations=$false;apiPackageId=$pins.apiPackage;appPackageId=$pins.package;apiManifestSha256=$pins.apiManifest;appManifestSha256=$pins.manifest;files=$files}
[IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 20));$manifestHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($manifestPath))
$ownerArgv='isolated-fixed-owner-argv';$childArgv='isolated-fixed-child-argv';$protected=[pscustomobject]@{listeners=@([pscustomobject]@{port=4146;pid=112});processes=@([pscustomobject]@{pid=112;birth='isolated'});files=@([pscustomobject]@{path='isolated-protected';hash=('a'*64)})}
$capture=[pscustomobject]@{schema='melisa-b6-current-read2b-owner-capture.v1';predecessorEntryKind='CurrentInitializerClean';entry=@{root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029';leaf='run-current-owner.ps1';manifestSha256=$manifestHash;sha256='ebc933faf015aadc32be74f7abeaef66252ef3bc72dc52ebac265ced9ed577e5';postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false};readOnly=$true;stopAuthorized=$false;recordPath='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';recordBeforeFile='current-erp-processes.before.json';recordBeforeSha256=$beforeHash;webRecord=$rows[2];child=@{pid=44612;parent=31212;birth='134377336265107097';exe=$pins.node;argv=$childArgv};owner=@{pid=31212;birth='134377334934998450';exe='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';argv=$ownerArgv};nativeStatus=@{reply='Status';nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true;state=@{phase='Running';ownerPid=31212;ownerBirth='134377334934998450';childPid=44612;childBirth='134377336265107097'}};installedApiManifest=$pins.apiManifest;installedWebManifest=$pins.manifest;serviceCalls=0;sqlCalls=0;retireCalls=0;protectedSnapshot=$protected}
[IO.File]::WriteAllText($capturePath,($capture|ConvertTo-Json -Depth 20));$captureHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($capturePath))
$getPins=(Get-Command Get-Business5244CurrentBootstrapPins).Definition.Replace('C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029\current-read2b-owner-capture.json',$capturePath).Replace('C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029\owner-manifest.json',$manifestPath).Replace('2f066cc82af4fe23337a3469091aad40d6d065a66af72f60db34f2e16152c364',$captureHash).Replace('81862843a2595587771a8779b23a965b3139cbd8145680af52e4a663c7d2cc17',$beforeHash).Replace('6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0',$manifestHash).Replace('594c6f86bcbef12b4ad4a291c3672cff772be9239d80dad7a2cc91f2b4530ac9',(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($ownerArgv)))).Replace('142fa836c875280b886d55984bddbe60949a7801f57f937db6ab4520d38f2322',(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($childArgv)))).Replace('332d9cdcc152c8c2668f121e84f1483deb35073a327b5bf7ad763cc30e04b419',(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes(($protected|ConvertTo-Json -Depth 32 -Compress)))))
. ([scriptblock]::Create('function Get-Business5244CurrentBootstrapPins {'+$getPins+'}'))
`;
win('B6 fresh CurrentInitializerClean capture permits only a genuine new Current child and exact held CAS',()=>{
 assert.equal(run(b6InitializerSetup+`try{${streams}
 Assert-Business5244CurrentBootstrapBefore $state $records
 $result=Publish-Business5244HeldCurrentRecord $state $records $pending;$after=Read-Business5244RetirementBytes $records;$again=Publish-Business5244HeldCurrentRecord $state $records $null
 $published=ConvertFrom-Business5244RecordBytes $after
 if(!$result.published-or$result.replayed-or!$again.replayed-or$published[2].pid-ne$native.ChildPid-or$published[2].pid-eq44612-or$published[0].pid-ne111-or$published[1].pid-ne112-or!$native.ChildAlive()-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne(Get-Business5244StartupHash $after)){throw 'INITIALIZER_NATIVE_CAS_FAILED'}
 }`+cleanup),'PASS');
});
for(const mode of ['child','owner'])win(`B6 fresh CurrentInitializerClean rejects still-live predecessor ${mode}`,()=>{
 assert.equal(run(b6InitializerSetup+`try{${streams}$script:${mode==='child'?'oldChildPresent':'oldOwnerPresent'}=$true;$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{if($_.Exception.Message-cne'${mode==='child'?'CURRENT_BOOTSTRAP_OLD_PID_PRESENT':'CURRENT_BOOTSTRAP_OLD_OWNER_PRESENT'}'){throw};$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'INITIALIZER_LIVE_PREDECESSOR_ACCEPTED'}}`+cleanup),'PASS');
});
win('B6 fresh CurrentInitializerClean rejects typed capture drift even after the isolated outer hash is resealed',()=>{
 assert.equal(run(b6InitializerSetup+`try{${streams}
 $saved=[IO.File]::ReadAllText($capturePath);$pinned=$captureHash
 foreach($case in @('kind','entry','owner','birth','child','owner-argv','child-argv','protection','claimed-entry-verified','dropped-postexit','native-authority')){
  $changed=$saved|ConvertFrom-Json
  switch($case){kind{$changed.predecessorEntryKind='ReadPairRouter'}entry{$changed.entry.sha256=('a'*64)}owner{$changed.owner.pid=42920}birth{$changed.owner.birth='134377334934998451'}child{$changed.child.pid=24520}'owner-argv'{$changed.owner.argv+=' '}'child-argv'{$changed.child.argv+=' ' }protection{$changed.protectedSnapshot.files[0].hash=('b'*64)}'claimed-entry-verified'{$changed.entry.runtimeEntryBytesVerified=$true}'dropped-postexit'{$changed.entry.postExitExclusiveBytesRequired=$false}'native-authority'{$changed.nativeStatus.stopAuthorized=$true}}
  [IO.File]::WriteAllText($capturePath,($changed|ConvertTo-Json -Depth 20));$next=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($capturePath));$definition=(Get-Command Get-Business5244CurrentBootstrapPins).Definition.Replace($pinned,$next);Set-Item Function:Get-Business5244CurrentBootstrapPins ([scriptblock]::Create($definition));$pinned=$next
  $denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw ('INITIALIZER_TYPED_DRIFT_'+$case)}
 }
 }`+cleanup),'PASS');
});
win('B6 fresh CurrentInitializerClean rejects an altered source manifest even with matching isolated hash pins',()=>{
 assert.equal(run(b6InitializerSetup+`try{${streams}
 $changed=$manifest|ConvertTo-Json -Depth 20|ConvertFrom-Json;$changed.sourceCommit=('a'*40);[IO.File]::WriteAllText($manifestPath,($changed|ConvertTo-Json -Depth 20));$nextManifest=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($manifestPath))
 $capture.entry.manifestSha256=$nextManifest;[IO.File]::WriteAllText($capturePath,($capture|ConvertTo-Json -Depth 20));$nextCapture=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($capturePath))
 $definition=(Get-Command Get-Business5244CurrentBootstrapPins).Definition.Replace($manifestHash,$nextManifest).Replace($captureHash,$nextCapture);Set-Item Function:Get-Business5244CurrentBootstrapPins ([scriptblock]::Create($definition))
 $denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{if($_.Exception.Message-cne'CURRENT_BOOTSTRAP_B6_INITIALIZER_SOURCE_CHANGED'){throw};$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'INITIALIZER_SOURCE_DRIFT_ACCEPTED'}
 }`+cleanup),'PASS');
});
for(const mode of ['capsule','before-image','manifest'])win(`B6 fresh CurrentInitializerClean rejects byte drift in ${mode}`,()=>{
 const file=mode==='capsule'?'$capturePath':mode==='manifest'?'$manifestPath':'$imagePath';
 assert.equal(run(b6InitializerSetup+`try{${streams}[IO.File]::AppendAllText(${file},' ');$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'INITIALIZER_DRIFTED_BYTES_ACCEPTED'}}`+cleanup),'PASS');
});
win('retirement keeps the actual owner mutex through ACK loss, publication and exact replay',()=>{
 assert.equal(run(setup+`try{${streams}Invoke-Business5244HeldRetirement $state $records $pending;if(!$native.RetirementConfirmed -or (Get-Business5244RetirementSnapshot $state).phase -cne 'Retired'){throw 'RETIREMENT_NOT_CONFIRMED'};Assert-Business5244StartupLease -Lease $lease -Kind Maintenance;$replayDenied=$false;try{Invoke-Business5244HeldRetirement $state $records $pending}catch{if($_.Exception.Message -ceq 'RETIREMENT_ALREADY_REQUESTED'){$replayDenied=$true}else{throw}};if(!$replayDenied){throw 'STOP_REPLAY'};$denied=$false;try{Enter-Business5244StartupLease -Kind Owner|Out-Null}catch{if($_.Exception.Message -ceq 'BUSINESS_5244_STARTUP_BUSY'){$denied=$true}else{throw}};if(!$denied){throw 'GAP_IN_OWNERSHIP'};$replacement=New-TestChild;Publish-Business5244HeldRecord $state $replacement Candidate;$hash=Get-Business5244StartupHash (Read-Business5244RetirementBytes $records);Publish-Business5244HeldRecord $state $replacement Candidate;if((Get-Business5244StartupHash (Read-Business5244RetirementBytes $records)) -cne $hash){throw 'DUPLICATE_PUBLICATION'};$after=ConvertFrom-Business5244RecordBytes (Read-Business5244RetirementBytes $records);if($after[0].pid -ne 111 -or $after[1].pid -ne 112 -or $after[2].pid -ne $replacement.ChildPid){throw 'OTHER_RECORD_CHANGED'};$denied=$false;try{Publish-Business5244HeldRecord $state $replacement Rollback}catch{if($_.Exception.Message -ceq 'RETIREMENT_PUBLICATION_REPLAY_CONFLICT'){$denied=$true}else{throw}};if(!$denied){throw 'DIFFERENT_BODY_REPLAY'}}`+cleanup),'PASS');
});
win('a stale record is rejected before durable retirement or native child stop',()=>{
 assert.equal(run(setup+`try{$rows[2].pid++;$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));${streams}$denied=$false;try{Invoke-Business5244HeldRetirement $state $records $pending}catch{$denied=$true};if(!$denied -or !$native.ChildAlive() -or $pending.Length -ne 0 -or (Get-Business5244RetirementSnapshot $state).phase -cne 'Running'){throw 'STALE_RECORD_RETIRED_CHILD'}}`+cleanup),'PASS');
});
win('B6 pinned predecessor capsule permits only a new held child CAS and replay never republishes the old PID',()=>{
 assert.equal(run(b6Setup+`try{${streams}
 $first=Publish-Business5244HeldCurrentRecord $state $records $pending;$after=Read-Business5244RetirementBytes $records;$again=Publish-Business5244HeldCurrentRecord $state $records $null
 if(!$first.published-or$first.replayed-or!$again.replayed-or$again.childPid-ne$native.ChildPid-or!$native.ChildAlive()-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne(Get-Business5244StartupHash $after)){throw 'B6_BOOTSTRAP_REPLAY'}
 $published=ConvertFrom-Business5244RecordBytes $after;if($published[2].pid-ne$native.ChildPid-or$published[2].pid-eq24520-or$published[0].pid-ne111-or$published[1].pid-ne112-or@([IO.Directory]::GetFiles($env:TEMP,'*.bootstrap.completed')).Count-ne1){throw 'B6_BOOTSTRAP_SCOPE'}
 }`+cleanup),'PASS');
});
for(const mode of ['child','owner'])win(`B6 predecessor ${mode} still alive rejects metadata publication without touching either process`,()=>{
 assert.equal(run(b6Setup+`try{${streams}$script:${mode==='child'?'oldChildPresent':'oldOwnerPresent'}=$true;$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{if($_.Exception.Message-cne'${mode==='child'?'CURRENT_BOOTSTRAP_OLD_PID_PRESENT':'CURRENT_BOOTSTRAP_OLD_OWNER_PRESENT'}'){throw};$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'B6_LIVE_PREDECESSOR_CHANGED'}}`+cleanup),'PASS');
});
for(const mode of ['entry-kind','old-owner','old-child'])win(`B6 recovered ReadPairRouter rejects ${mode} even with matching isolated capture hash`,()=>{
 const change=mode==='entry-kind'?"$changed.predecessorEntryKind='Router'":mode==='old-owner'?"$changed.owner.pid=49668":"$changed.child.pid=16084";
 assert.equal(run(b6Setup+`try{${streams}$prior=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($capturePath));$changed=Get-Content -LiteralPath $capturePath -Raw|ConvertFrom-Json;${change};[IO.File]::WriteAllText($capturePath,($changed|ConvertTo-Json -Depth 20));$next=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($capturePath));$definition=(Get-Command Get-Business5244CurrentBootstrapPins).Definition.Replace($prior,$next);Set-Item Function:Get-Business5244CurrentBootstrapPins ([scriptblock]::Create($definition));$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'RECOVERED_IDENTITY_GUARD_FAILED'}}`+cleanup),'PASS');
});
for(const mode of ['capsule','before-image'])win(`B6 changed ${mode} cannot authorize a current-record rebind`,()=>{
 assert.equal(run(b6Setup+`try{${streams}[IO.File]::AppendAllText(${mode==='capsule'?'$capturePath':'$imagePath'},' ');$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'B6_DRIFTED_PREDECESSOR_CHANGED'}}`+cleanup),'PASS');
});
win('a partial held publication restores its bytes and rollback publishes a new child identity',()=>{
 const fail=String.raw`Add-Type -TypeDefinition @'
using System;using System.IO;public sealed class RetirementFailStream:FileStream {public bool Fail;public RetirementFailStream(string path):base(path,FileMode.Open,FileAccess.ReadWrite,FileShare.None){}public override void Write(byte[] b,int o,int n){if(Fail){Fail=false;base.Write(b,o,Math.Max(1,n/2));base.Flush(true);throw new IOException("ISOLATED_PARTIAL_WRITE");}base.Write(b,o,n);}}
'@;`;
 assert.equal(run(setup+`try{${fail}[IO.File]::WriteAllBytes($recordPath,$before);$records=[RetirementFailStream]::new($recordPath);$pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);Invoke-Business5244HeldRetirement $state $records $pending;$replacement=New-TestChild;$records.Fail=$true;$denied=$false;try{Publish-Business5244HeldRecord $state $replacement Candidate}catch{$denied=$true};if(!$denied -or !$replacement.RetirementConfirmed -or (Get-Business5244StartupHash (Read-Business5244RetirementBytes $records)) -cne (Get-Business5244StartupHash $before)){throw 'INVERSE_NOT_CONFIRMED'};$replacement=New-TestChild;Publish-Business5244HeldRecord $state $replacement Rollback;$after=ConvertFrom-Business5244RecordBytes (Read-Business5244RetirementBytes $records);if($after[2].pid -ne $replacement.ChildPid -or $after[2].pid -eq $native.ChildPid){throw 'STALE_PID_ROLLBACK'};Assert-Business5244StartupLease -Lease $lease -Kind Maintenance}`+cleanup),'PASS');
});
win('a retained pending marker blocks a new owner without becoming a recovery capability',()=>{
 const body=`$ErrorActionPreference='Stop';. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;${isolatedStartup}$script:pending=Join-Path $env:TEMP 'retirement.pending';[IO.File]::WriteAllText($script:pending,'unacknowledged retirement');function Get-Business5244RetirementPendingPath{return $script:pending};$denied=$false;try{Enter-Business5244StartupLease -Kind Owner|Out-Null}catch{if($_.Exception.Message -ceq 'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'){$denied=$true}else{throw}};if(!$denied){throw 'PENDING_ALLOWED_START'};$l=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease -Lease $l;'PASS'`;
 assert.equal(run(body),'PASS');
});
win('an authenticated status operation cannot reach the fixed-path retirement writer',()=>{
 assert.equal(run(setup+`try{function Assert-Business5244RetirementRequest{};$denied=$false;try{Invoke-Business5244OwnedRetirement $state ([pscustomobject]@{}) ([pscustomobject]@{operation='status'})}catch{if($_.Exception.Message -ceq 'RETIREMENT_REQUEST_NOT_RETIRE'){$denied=$true}else{throw}};if(!$denied -or !$native.ChildAlive() -or (Get-Business5244RetirementSnapshot $state).phase -cne 'Running'){throw 'STATUS_MUTATED_STATE'}}`+cleanup),'PASS');
});
win('matching cache bytes never confirm publication while durable flush remains failed',()=>{
 const fail=String.raw`Add-Type -TypeDefinition @'
using System;using System.IO;public sealed class RetirementFlushFailStream:FileStream {public int Failures;public RetirementFlushFailStream(string p):base(p,FileMode.Open,FileAccess.ReadWrite,FileShare.None){}public override void Flush(bool durable){if(Failures>0){Failures--;throw new IOException("ISOLATED_DURABILITY_FAILURE");}base.Flush(durable);}}
'@;`;
 assert.equal(run(setup+`try{${fail}[IO.File]::WriteAllBytes($recordPath,$before);$records=[RetirementFlushFailStream]::new($recordPath);$pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);Invoke-Business5244HeldRetirement $state $records $pending;$replacement=New-TestChild;$records.Failures=2;$denied=$false;try{Publish-Business5244HeldRecord $state $replacement Candidate}catch{$denied=$true};$r=Get-Business5244RetirementState $state;if(!$denied -or $r.phase -cne 'Unknown' -or $r.publication.confirmed){throw 'CACHE_CONFIRMED_DURABILITY'};Assert-Business5244StartupLease -Lease $lease -Kind Maintenance;$records.Failures=0}`+cleanup),'PASS');
});
win('a retried successful durable flush can reconcile a lost publication acknowledgment',()=>{
 const fail=String.raw`Add-Type -TypeDefinition @'
using System;using System.IO;public sealed class RetirementOnceFlushFailStream:FileStream {public bool Fail;public RetirementOnceFlushFailStream(string p):base(p,FileMode.Open,FileAccess.ReadWrite,FileShare.None){}public override void Flush(bool durable){if(Fail){Fail=false;throw new IOException("ISOLATED_LOST_FLUSH_ACK");}base.Flush(durable);}}
'@;`;
 assert.equal(run(setup+`try{${fail}[IO.File]::WriteAllBytes($recordPath,$before);$records=[RetirementOnceFlushFailStream]::new($recordPath);$pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);Invoke-Business5244HeldRetirement $state $records $pending;$replacement=New-TestChild;$records.Fail=$true;Publish-Business5244HeldRecord $state $replacement Candidate;$r=Get-Business5244RetirementState $state;if($r.phase -cne 'Published' -or !$r.publication.confirmed){throw 'DURABLE_RETRY_NOT_RECONCILED'};Publish-Business5244HeldRecord $state $replacement Candidate}`+cleanup),'PASS');
});
win('native handle birth stays exact while the initial CIM witness may be truncated to microseconds',()=>{
 const body=`$ErrorActionPreference='Stop';Add-Type -LiteralPath ${q(path.join(dir,'business-5244-web-native.cs'))};if(![Business5244WebNative]::MatchesCimBirth(123456789,123456780) -or ![Business5244WebNative]::MatchesCimBirth(123456789,123456789) -or [Business5244WebNative]::MatchesCimBirth(123456789,123456770) -or [Business5244WebNative]::MatchesCimBirth(123456789,123456788)){throw 'CIM_PRECISION_WIDENED'};'PASS'`;
 assert.equal(run(body),'PASS');
});
const inverseStreams=String.raw`$pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);`;
win('B6 pre-channel initialization inverse closes only its actual child then restores retained bytes and archives durable proof',()=>{
 assert.equal(run(b6Setup+`try{${streams}
 function Get-NetTCPConnection($State,$LocalPort){if($State-cne'Listen'-or$LocalPort-ne5244){throw 'ISOLATED_FOREIGN_PORT_READ'};return @()}
 Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null;${inverseStreams}
 $r=Get-Business5244RetirementState $state;$beforeOther=$rows[0]|ConvertTo-Json -Compress;$result=Undo-Business5244HeldCurrentBootstrap $state $records $pending
 if(!$result.verified-or!$native.RetirementConfirmed-or$r.phase-cne'InitializationRestored'-or$r.currentBootstrap.inverse.phase-cne'Archived'-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash-or(Test-Path -LiteralPath $pendingPath)){throw 'INIT_INVERSE_NOT_CONFIRMED'}
 $restored=ConvertFrom-Business5244RecordBytes (Read-Business5244RetirementBytes $records);if($restored[2].pid-ne24520-or($restored[0]|ConvertTo-Json -Compress)-cne$beforeOther-or@([IO.Directory]::GetFiles($env:TEMP,'*.init-undone.completed')).Count-ne1){throw 'INIT_INVERSE_SCOPE'}
 $denied=$false;try{Undo-Business5244HeldCurrentBootstrap $state $records $null|Out-Null}catch{$denied=$true};if(!$denied){throw 'INIT_INVERSE_REPLAY_ADMITTED'};Assert-Business5244StartupLease -Lease $lease -Kind Owner
 }`+cleanup),'PASS');
});
win('B6 initialization inverse rejects unissued, post-channel, retired, unknown, API-effect and changed-record states before any child stop',()=>{
 assert.equal(run(b6Setup+`try{${streams}
 Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null;${inverseStreams}$r=Get-Business5244RetirementState $state;$published=Read-Business5244RetirementBytes $records
 foreach($case in @('copy','thread','channel','retired','unknown','request','operation','api-effects','pair-reference','record','archive')){
  $arg=$state;$oldArchive=$r.currentBootstrap.archive;$oldHash=$r.currentBootstrap.afterHash
  switch($case){'copy'{$arg=$state.PSObject.Copy()}'thread'{$r.thread++}'channel'{$r.initializing=$false}'retired'{$r.phase='Retired'}'unknown'{$r.currentBootstrap.phase='Unknown'}'request'{$r.requestProof=@{request='issued'}}'operation'{$r.operationId='issued'}'api-effects'{$r.initializationApiTransition=[pscustomobject]@{opaque='fixture'};function Assert-Test125ReadPairIssued {return @{mode='Current';phase='PREPARED';activeBinding=$null;changed=$false;apiChanged=$false;taskStopped=$false;candidateAttempted=$true;nativeChangeAttempted=$false;nativeApplied=$false}}}'pair-reference'{$r.preparedPair=@{apiTransition=[pscustomobject]@{opaque='unretained'}}}'record'{$r.currentBootstrap.afterHash=('a'*64)}'archive'{$r.currentBootstrap.archive=Join-Path $env:TEMP 'absent.archive'}}
  $denied=$false;try{Undo-Business5244HeldCurrentBootstrap $arg $records $pending|Out-Null}catch{$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne(Get-Business5244StartupHash $published)){throw ('INIT_INVERSE_GATE_'+$case)}
  switch($case){'thread'{$r.thread--}'channel'{$r.initializing=$true}'retired'{$r.phase='Running'}'unknown'{$r.currentBootstrap.phase='Archived'}'request'{$r.requestProof=$null}'operation'{$r.operationId=$null}'api-effects'{$r.initializationApiTransition=$null}'pair-reference'{$r.Remove('preparedPair')}'record'{$r.currentBootstrap.afterHash=$oldHash}'archive'{$r.currentBootstrap.archive=$oldArchive}}
 }
 }`+cleanup),'PASS');
});
win('B6 initialization inverse archive ACK loss reconciles its own completed file without another child stop or record write',()=>{
 assert.equal(run(b6Setup+`try{${streams}
 function Get-NetTCPConnection{return @()};Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null;${inverseStreams}
 function Move-Business5244PendingArchive($From,$To){[IO.File]::Move($From,$To);throw 'ISOLATED_ARCHIVE_ACK_LOST'}
 $result=Undo-Business5244HeldCurrentBootstrap $state $records $pending;$r=Get-Business5244RetirementState $state
 if(!$result.verified-or!$native.RetirementConfirmed-or$r.phase-cne'InitializationRestored'-or(Test-Path -LiteralPath $pendingPath)-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'INIT_ARCHIVE_ACK_NOT_RECONCILED'}
 }`+cleanup),'PASS');
});
win('B6 initialization inverse durable-write uncertainty keeps its pending marker and never issues a restored outcome',()=>{
 const fail=String.raw`Add-Type -TypeDefinition @'
using System;using System.IO;public sealed class InitUndoFlushFailStream:FileStream {public bool Fail;public InitUndoFlushFailStream(string p):base(p,FileMode.Open,FileAccess.ReadWrite,FileShare.None){}public override void Flush(bool durable){if(Fail)throw new IOException("ISOLATED_INIT_INVERSE_FLUSH_FAILURE");base.Flush(durable);}}
'@;`;
 assert.equal(run(b6Setup+`try{${streams}
 function Get-NetTCPConnection{return @()};Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null;$records.Dispose();${fail}$records=[InitUndoFlushFailStream]::new($recordPath);$records.Fail=$true;${inverseStreams}
 $denied=$false;try{Undo-Business5244HeldCurrentBootstrap $state $records $pending|Out-Null}catch{$denied=$true};$r=Get-Business5244RetirementState $state
 if(!$denied-or!$native.RetirementConfirmed-or$r.phase-cne'Unknown'-or$r.currentBootstrap.inverse.phase-cne'Unknown'-or!$r.records-or!$r.pending-or!(Test-Path -LiteralPath $pendingPath)){throw 'INIT_INVERSE_DURABILITY_FALSE_SUCCESS'};Assert-Business5244StartupLease -Lease $lease -Kind Owner;$records.Fail=$false
 }`+cleanup),'PASS');
});
win('B6 initialization inverse refuses to close its child until its inverse evidence is durably flushed',()=>{
 const fail=String.raw`Add-Type -TypeDefinition @'
using System;using System.IO;public sealed class InitUndoPendingFailStream:FileStream {public bool Fail=true;public InitUndoPendingFailStream(string p):base(p,FileMode.CreateNew,FileAccess.ReadWrite,FileShare.Read){}public override void Flush(bool durable){if(Fail&&durable)throw new IOException("ISOLATED_INVERSE_EVIDENCE_FLUSH_FAILURE");base.Flush(durable);}}
'@;`;
 assert.equal(run(b6Setup+`try{${streams}
 function Get-NetTCPConnection{return @()};Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null;$publishedHash=Get-Business5244StartupHash (Read-Business5244RetirementBytes $records);${fail}$pending=[InitUndoPendingFailStream]::new($pendingPath)
 $denied=$false;try{Undo-Business5244HeldCurrentBootstrap $state $records $pending|Out-Null}catch{$denied=$true};$r=Get-Business5244RetirementState $state
 if(!$denied-or!$native.ChildAlive()-or$r.phase-cne'Unknown'-or!$r.records-or!$r.pending-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$publishedHash){throw 'INIT_INVERSE_STOP_BEFORE_DURABLE_EVIDENCE'};$pending.Fail=$false
 }`+cleanup),'PASS');
});
win('B6 initialization inverse can finalize its own already-exited child using the retained creation handle without health or PID adoption',()=>{
 assert.equal(run(b6Setup+`try{${streams}
 function Get-NetTCPConnection{return @()};Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null;$native.Stop();if($native.ChildAlive()){throw 'ISOLATED_CHILD_NOT_EXITED'};${inverseStreams}
 function Assert-Business5244CreatedChild {throw 'INIT_INVERSE_MUST_NOT_ADOPT_CIM'};function Assert-Business5244ReadyChild {throw 'INIT_INVERSE_MUST_NOT_REQUIRE_NETWORK'}
 $result=Undo-Business5244HeldCurrentBootstrap $state $records $pending
 if(!$result.verified-or!$native.RetirementConfirmed-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash-or(Get-Business5244RetirementState $state).phase-cne'InitializationRestored'){throw 'INIT_OWN_EXIT_NOT_RECOVERED'}
 }`+cleanup),'PASS');
});

const supersessionFixture=String.raw`
$ErrorActionPreference='Stop';. '__OWNED__' -Library;Add-Type -LiteralPath '__PEER__';Initialize-Business5244WebNative
$script:mutexName='Local\MelisaSupersessionFixture-'+[IO.Path]::GetFileName($env:TEMP);function Get-Business5244StartupMutexName{return $script:mutexName};function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'supersession.pending')}
$pipeName='MelisaSupersession-'+[guid]::NewGuid().ToString('N');$serverFile=Join-Path $env:TEMP 'old-owner.ps1'
[IO.File]::WriteAllText($serverFile,'param($Name,$MutexName);$m=[Threading.Mutex]::new($false,$MutexName);$held=$m.WaitOne(0);if(!$held){throw "ISOLATED_OLD_GATE_BUSY"};$p=[IO.Pipes.NamedPipeServerStream]::new($Name,[IO.Pipes.PipeDirection]::InOut);try{[Console]::WriteLine("READY");[Console]::Out.Flush();$p.WaitForConnection();$reader=[IO.StreamReader]::new($p);$command=$reader.ReadLine();if($command-ceq"RELEASE"){$m.ReleaseMutex();$held=$false;[Console]::WriteLine("RELEASED");[Console]::Out.Flush();$command=$reader.ReadLine()};if($command-ceq"ABANDON"){[Environment]::Exit(23)};if($command-cne"EXIT"){throw "ISOLATED_BAD_EXIT_REQUEST"}}finally{$p.Dispose();if($held){$m.ReleaseMutex()};$m.Dispose()}')
$si=[Diagnostics.ProcessStartInfo]::new();$si.FileName=Join-Path $PSHOME 'powershell.exe';$si.Arguments='-NoProfile -NonInteractive -File "'+$serverFile+'" "'+$pipeName+'" "'+$script:mutexName+'"';$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$si.RedirectStandardOutput=$true;$server=[Diagnostics.Process]::new();$server.StartInfo=$si;[void]$server.Start()
$client=$null;$observer=$null;$peer=$null;$writer=$null;$token=$null;$script:failBoundary=$false;$script:failStart=$false;$script:boundaryCalls=0;$script:inputCalls=0;$script:createdNatives=[Collections.Generic.List[object]]::new()
try{
 if($server.StandardOutput.ReadLine()-cne'READY'){throw 'ISOLATED_OLD_OWNER_NOT_READY'}
 $client=[IO.Pipes.NamedPipeClientStream]::new('.',$pipeName,[IO.Pipes.PipeDirection]::InOut);$client.Connect(5000);$peer=[Business5244RetirementPeer]::CaptureServer($client);$observer=$peer.OpenExitObservation();$peer.Dispose();$peer=$null
 $writer=[IO.StreamWriter]::new($client,[Text.Encoding]::UTF8,1024,$true)
 $pins=Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Current
 $rows=@([pscustomobject]@{port=4194;pid=111;entry='preserve-api';root='preserve-api'},[pscustomobject]@{port=4196;pid=112;entry='preserve-native';root='preserve-native'},[pscustomobject]@{port=5244;pid=$server.Id;entry='vite-preview';sourceCommit=$pins.frontendSource;root=$pins.root;backendPort=4144;businessWorkfaceId=$pins.profile})
 $before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 8));$beforeHash=Get-Business5244StartupHash $before;$recordsPath=Join-Path $env:TEMP 'supersession-records.json';[IO.File]::WriteAllBytes($recordsPath,$before)
 $oldPending=[Text.Encoding]::UTF8.GetBytes(([ordered]@{schema='business-5244-retirement-before.v1';operationId=('a'*32);ownerPid=$observer.TargetPid;ownerBirth=$observer.TargetBirth;childPid=$server.Id;childBirth=$observer.TargetBirth;beforeSha256=$beforeHash;beforeBase64=[Convert]::ToBase64String($before)}|ConvertTo-Json -Compress));$pendingPath=Get-Business5244RetirementPendingPath;[IO.File]::WriteAllBytes($pendingPath,$oldPending)
 $entries=@(1..16|ForEach-Object{$path=Join-Path $env:TEMP ('entry-'+$_+'.ps1');[IO.File]::WriteAllText($path,('inert-entry-'+$_));[pscustomobject]@{path=$path;hash=(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($path)))}});$gate=Join-Path $env:TEMP 'startup-gate.ps1';[IO.File]::WriteAllText($gate,'inert-gate')
 $script:fixedInputs=[pscustomobject][ordered]@{schema='business-5244-current-supersession-inputs.v1';caseId='CURRENT-ONLY-5244-SUPERSESSION-20261029';scopeName='TEST125-API-B6-ca620bac-20261028';ownerPid=$observer.TargetPid;ownerBirth=$observer.TargetBirth;recordsPath=$recordsPath;recordsHash=$beforeHash;pendingPath=$pendingPath;pendingHash=(Get-Business5244StartupHash $oldPending);originalBeforeHash=$beforeHash;beforeBytes=$before;pendingBeforeBytes=$oldPending;pins=$pins.Clone();entrySeals=$entries;gateSeal=[pscustomobject]@{path=$gate;hash=(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($gate)))}}
 function Get-Business5244CurrentSupersessionFixedInputs{$script:inputCalls++;return $script:fixedInputs}
 # Only the two fixed PID/birth tuples and the immutable record hash are
 # projected into this disposable test copy. Native observer identity, live
 # mutex generation, lease issuance, marker checks and held CAS stay real.
 $caseAssert=(Get-Command Assert-Business5244CurrentSupersessionFixedCase).Definition.Replace('$Inputs.ownerPid-eq48212',('$Inputs.ownerPid-eq'+$observer.TargetPid)).Replace('$Inputs.ownerPid-eq42920',('$Inputs.ownerPid-eq'+$observer.TargetPid)).Replace('134377121934062288',$observer.TargetBirth).Replace('134377286908585811',$observer.TargetBirth).Replace('3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74',$beforeHash)
 . ([scriptblock]::Create('function Assert-Business5244CurrentSupersessionFixedCase {'+$caseAssert+'}'))
 $caseAdmission=(Get-Command New-Business5244CurrentSupersessionAdmission).Definition.Replace('$beforePending.ownerPid-ne42920',('$beforePending.ownerPid-ne'+$observer.TargetPid)).Replace('134377286908585811',$observer.TargetBirth).Replace('3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74',$beforeHash)
 . ([scriptblock]::Create('function New-Business5244CurrentSupersessionAdmission {'+$caseAdmission+'}'))
 function Assert-Business5244CurrentSupersessionBoundary($Inputs){$script:boundaryCalls++;if($script:failBoundary){throw 'ISOLATED_BOUNDARY_REJECTED'};if(![object]::ReferenceEquals($Inputs,$script:fixedInputs)-or!$server.HasExited){throw 'ISOLATED_FOREIGN_BOUNDARY'}}
 function Get-CimInstance($ClassName){if($ClassName-cne'Win32_Process'){throw 'ISOLATED_FOREIGN_CIM'};return @()}
 function Get-NetTCPConnection($LocalPort,$State){if($LocalPort-ne5244-or$State-cne'Listen'){throw 'ISOLATED_FOREIGN_PORT'};return @()}
 function Assert-Business5244CreatedChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'ISOLATED_CREATED_CHILD_DEAD'}}
 function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
 function New-Business5244PinnedChild($Pins,$Lease){Assert-Business5244StartupLease $Lease -Kind Maintenance;if($script:failStart){throw 'ISOLATED_CURRENT_START_FAILED'};$n=[Business5244WebNative]::new();$script:createdNatives.Add($n);$lr=Get-Business5244StartupRecord $Lease;if(!$lr.ContainsKey('ownedNatives')){$lr.ownedNatives=[Collections.Generic.List[object]]::new()};$lr.ownedNatives.Add($n);$sleep=Join-Path $env:TEMP 'new-current-child.ps1';[IO.File]::WriteAllText($sleep,'Start-Sleep -Seconds 300');$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$sleep+'"'),$env:TEMP);return $n}
 function Exit-FixtureOldOwner{if(!$server.HasExited){if(!@($script:Business5244CurrentSupersessionObservations|Where-Object{[object]::ReferenceEquals($_.observer,$observer)-and!$_.closed}).Count){Prepare-Business5244CurrentSupersessionObservation $observer|Out-Null};$writer.WriteLine('EXIT');$writer.Flush();if(!$server.WaitForExit(5000)){throw 'ISOLATED_COOPERATIVE_EXIT_FAILED'}};$observer.ValidateExited()}
 __BODY__
}finally{
 foreach($n in $script:createdNatives){$n.Dispose()}
 foreach($c in $script:Business5244CurrentSupersessions){if($c.records){$c.records.Dispose()};if($c.pending){$c.pending.Dispose()};foreach($r in $c.seals){$r.stream.Dispose()};foreach($r in $c.copies){$r.stream.Dispose()};$lr=Get-Business5244StartupRecord $c.lease;if(!$lr.closed){Exit-Business5244StartupLease $c.lease}}
 if(!$server.HasExited-and$writer){$writer.WriteLine('EXIT');$writer.Flush();[void]$server.WaitForExit(5000)}
 if($observer){Close-Business5244CurrentSupersessionObservation $observer};if($writer){$writer.Dispose()};if($client){$client.Dispose()};if($peer){$peer.Dispose()};if($observer){$observer.Dispose()};$server.Dispose()
};'PASS'
`.replace('__OWNED__',path.join(dir,'start-business-5244-owned.ps1').replaceAll("'","''")).replace('__PEER__',path.join(dir,'business-5244-retirement-peer.cs').replaceAll("'","''"));
const superRun=body=>run(supersessionFixture.replace('__BODY__',body));
const initCleanFixture=supersessionFixture.replace('1..16|ForEach-Object','1..17|ForEach-Object').replace("caseId='CURRENT-ONLY-5244-SUPERSESSION-20261029'","caseId='CURRENT-ONLY-5244-INIT-CLEAN-20261029'").replace(/\$oldPending=\[Text.Encoding\]::UTF8.GetBytes\(.*?;(?=\$pendingPath=)/,String.raw`$oldPending=[Text.Encoding]::UTF8.GetBytes(([ordered]@{schema='business-5244-current-supersession.pending.v1';classification='SUPERSESSION_NOT_ORIGINAL_COMMIT';operationId='5197b99f29984394b07059bea9cc4823';originalOperationId='0cfa751c63644554a4faccd1f1e8d7c6';originalPendingSha256='7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab';originalRecordsSha256=$beforeHash;ownerPid=$observer.TargetPid;ownerBirth=$observer.TargetBirth}|ConvertTo-Json -Compress));`);
const initCleanRun=body=>run(initCleanFixture.replace('__BODY__',body));
win('Current-only supersession needs the real native exit and creates a fresh same-lease Current owner without completing the original retirement',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$c=Get-Business5244CurrentSupersessionContext $token
 Assert-Business5244StartupLease $c.lease -Kind Maintenance;if($c.phase-cne'Prepared'-or!(Test-Path -LiteralPath $pendingPath)-or$c.seals.Count-ne17){throw 'SUPERSESSION_NOT_HELD_OR_DURABLE'}
 foreach($entry in $entries){$denied=$false;try{$f=[IO.File]::Open($entry.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$f.Dispose()}catch{$denied=$true};if(!$denied){throw 'SUPERSESSION_ENTRY_NOT_EXCLUSIVE'}}
 $frame=Initialize-Business5244CurrentSupersessionOwner $token;if(![object]::ReferenceEquals($frame.lease,$c.lease)-or!$frame.native.ChildAlive()-or$frame.native.ChildPid-eq$server.Id-or(Get-Business5244RetirementState $frame.state).phase-cne'Running'){throw 'SUPERSESSION_ADOPTED_OLD_STATE_OR_PID'}
 $result=Complete-Business5244CurrentSupersessionOwner $token
 if($result.classification-cne'SUPERSEDED_NOT_ORIGINAL_COMMIT'-or$result.originalRetireCompleted-or(Test-Path -LiteralPath $pendingPath)-or$c.phase-cne'Completed'){throw 'SUPERSESSION_FAKED_ORIGINAL_COMMIT'}
 $after=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes($recordsPath));if($after[0].pid-ne111-or$after[1].pid-ne112-or$after[2].pid-ne$frame.native.ChildPid){throw 'SUPERSESSION_CHANGED_OTHER_SERVICES'}
 $original=[IO.File]::ReadAllBytes(($pendingPath+'.'+$c.operationId+'.superseded-original'));if((Get-Business5244StartupHash $original)-cne$fixedInputs.pendingHash-or@([IO.Directory]::GetFiles($env:TEMP,'*.completed')).Count){throw 'SUPERSESSION_LOST_OR_RELABELED_ORIGINAL_PENDING'}
 Assert-Business5244StartupLease $c.lease -Kind Owner
 `),'PASS');
});
win('Current-only supersession rejects a still live native owner or a copied observer before source input reads or writes',()=>{
 assert.equal(superRun(String.raw`
 foreach($arg in @($observer,([pscustomobject]@{TargetPid=$observer.TargetPid;TargetBirth=$observer.TargetBirth}))){$denied=$false;try{New-Business5244CurrentSupersessionAdmission $arg|Out-Null}catch{$denied=$true};if(!$denied){throw 'SUPERSESSION_NONEXIT_ADMITTED'}}
 if($script:inputCalls-or$script:boundaryCalls-or$server.HasExited-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($pendingPath)))-cne$fixedInputs.pendingHash){throw 'SUPERSESSION_PRE_EXIT_EFFECT'}
 `),'PASS');
});
for(const drift of ['records','pending','entry','boundary'])win(`Current-only supersession ${drift} drift preserves original pending and refuses creation`,()=>{
 assert.equal(superRun(`Exit-FixtureOldOwner;$drift='${drift}';`+String.raw`
 switch($drift){records{[IO.File]::AppendAllText($recordsPath,' ')}pending{[IO.File]::AppendAllText($pendingPath,' ')}entry{[IO.File]::AppendAllText($entries[3].path,'changed')}boundary{$script:failBoundary=$true}}
 $beforePending=[IO.File]::ReadAllBytes($pendingPath);$beforeRecord=[IO.File]::ReadAllBytes($recordsPath);$denied=$false;try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$denied=$true}
 if(!$denied-or$createdNatives.Count-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($pendingPath)))-cne(Get-Business5244StartupHash $beforePending)-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne(Get-Business5244StartupHash $beforeRecord)){throw 'SUPERSESSION_DRIFT_WRITES'}
 $m=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $m
 `),'PASS');
});
for(const failure of ['start','channel'])win(`Current-only supersession ${failure} initialization failure closes only its child and leaves startup blocked without old commit`,()=>{
 assert.equal(superRun(`Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$failure='${failure}';`+String.raw`
 $c=Get-Business5244CurrentSupersessionContext $token
 if($failure-ceq'start'){$script:failStart=$true;$denied=$false;try{Initialize-Business5244CurrentSupersessionOwner $token|Out-Null}catch{$denied=$true};if(!$denied){throw 'EXPECTED_START_FAILURE_MISSING'}}else{$frame=Initialize-Business5244CurrentSupersessionOwner $token}
 $result=Undo-Business5244CurrentSupersessionOwner $token
 if(!$result.ownInitializationUndone-or!$result.startupBlocked-or$result.originalRetireCompleted-or!(Test-Path -LiteralPath $pendingPath)-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash){throw 'SUPERSESSION_INIT_FAILURE_FAKED_RECOVERY'}
 foreach($n in $createdNatives){if(!$n.RetirementConfirmed){throw 'SUPERSESSION_OWN_CHILD_LEFT_RUNNING'}}
 $denied=$false;try{$o=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $o}catch{if($_.Exception.Message-cne'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'SUPERSESSION_INIT_FAILURE_UNBLOCKED_START'}
 `),'PASS');
});
win('Current-only supersession lost archive ACK reconciles only its own marker and leaves the original pending bytes immutable',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$frame=Initialize-Business5244CurrentSupersessionOwner $token;$c=Get-Business5244CurrentSupersessionContext $token
 function Move-Business5244PendingArchive($Source,$Destination){[IO.File]::Move($Source,$Destination);throw 'ISOLATED_ARCHIVE_ACK_LOST'}
 $result=Complete-Business5244CurrentSupersessionOwner $token
 if($result.classification-cne'SUPERSEDED_NOT_ORIGINAL_COMMIT'-or$c.phase-cne'Completed'-or(Test-Path -LiteralPath $pendingPath)-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes(($pendingPath+'.'+$c.operationId+'.superseded-original'))))-cne$fixedInputs.pendingHash){throw 'SUPERSESSION_ARCHIVE_ACK_NOT_RECONCILED'}
 `),'PASS');
});

win('Current-only supersession cloned admission and foreign issuer thread cannot obtain a fresh-state frame',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$c=Get-Business5244CurrentSupersessionContext $token;$copy=$token|ConvertTo-Json|ConvertFrom-Json
 $denied=$false;try{Initialize-Business5244CurrentSupersessionOwner $copy|Out-Null}catch{$denied=$true};if(!$denied){throw 'SUPERSESSION_CLONED_ADMISSION_GRANTED'}
 $c.thread++;$denied=$false;try{Initialize-Business5244CurrentSupersessionOwner $token|Out-Null}catch{$denied=$true};$c.thread--;if(!$denied-or$createdNatives.Count-or$c.phase-cne'Prepared'){throw 'SUPERSESSION_FOREIGN_THREAD_GRANTED'}
 `),'PASS');
});
win('Current-only supersession retains its marker and refuses both publication and undo on unknown held record bytes',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$c=Get-Business5244CurrentSupersessionContext $token;$c.records.Position=0;$c.records.WriteByte(0);$c.records.Flush($true)
 $observed=Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.records)
 foreach($call in @('initialize','undo')){$denied=$false;try{if($call-ceq'initialize'){Initialize-Business5244CurrentSupersessionOwner $token|Out-Null}else{Undo-Business5244CurrentSupersessionOwner $token|Out-Null}}catch{$denied=$true};if(!$denied){throw 'SUPERSESSION_UNKNOWN_CAS_WAS_OVERWRITTEN'}}
 if($createdNatives.Count-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.records))-cne$observed-or!(Test-Path -LiteralPath $pendingPath)){throw 'SUPERSESSION_UNKNOWN_CAS_EFFECT'}
 `),'PASS');
});
win('Current-only supersession marker flush failure never writes the record or creates a child and preserves a blocking marker',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$body=(Get-Command New-Business5244CurrentSupersessionAdmission).Definition;$needle='$pending.Flush($true);$c.pendingExpected';if($body.Split(@($needle),[StringSplitOptions]::None).Count-ne2){throw 'ISOLATED_FLUSH_SEAM_NOT_UNIQUE'}
 $body=$body.Replace($needle,"throw 'ISOLATED_SUPERSESSION_MARKER_FLUSH';"+'$c.pendingExpected');. ([scriptblock]::Create('function New-Business5244CurrentSupersessionAdmission {'+$body+'}'))
 $caught='';try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$caught=$_.Exception.Message}
 $c=$script:Business5244CurrentSupersessions[0]
 if($caught-cne'ISOLATED_SUPERSESSION_MARKER_FLUSH'-or$c.phase-cne'Unknown'-or$createdNatives.Count-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.records))-cne$beforeHash-or!(Test-Path -LiteralPath $pendingPath)){throw 'SUPERSESSION_FLUSH_FAILURE_ADVANCED'}
 `),'PASS');
});
win('Current-only supersession ambiguous archive bytes recreate only a missing owned marker and cannot authorize undo',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$frame=Initialize-Business5244CurrentSupersessionOwner $token;$c=Get-Business5244CurrentSupersessionContext $token
 function Move-Business5244PendingArchive($Source,$Destination){[IO.File]::Move($Source,$Destination);[IO.File]::WriteAllText($Destination,'unrecognized-archive')}
 $denied=$false;try{Complete-Business5244CurrentSupersessionOwner $token|Out-Null}catch{$denied=$true}
 if(!$denied-or$c.phase-cne'Unknown'-or!$c.pending-or!(Test-Path -LiteralPath $pendingPath)-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $c.pending))-cne$c.pendingExpected){throw 'SUPERSESSION_AMBIGUOUS_MOVE_UNBLOCKED_START'}
 $denied=$false;try{Undo-Business5244CurrentSupersessionOwner $token|Out-Null}catch{$denied=$true};if(!$denied){throw 'SUPERSESSION_UNKNOWN_MOVE_UNDONE'}
 `),'PASS');
});
win('Current-only supersession does not reinterpret an abandoned standard startup mutex as recovery authority',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner
 Add-Type -TypeDefinition 'using System.Threading;public static class SupersessionAbandonedFixture{public static void Leave(string name){var t=new Thread(()=>{var m=new Mutex(false,name);m.WaitOne();});t.Start();t.Join();}}'
 $heldName=[Threading.Mutex]::new($false,$script:mutexName);try{[SupersessionAbandonedFixture]::Leave($script:mutexName);$caught='';try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$caught=$_.Exception.Message};if($caught-cne'BUSINESS_5244_ABANDONED_OWNER'-or$createdNatives.Count-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($pendingPath)))-cne$fixedInputs.pendingHash-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash){throw 'SUPERSESSION_ABANDONMENT_BYPASSED'}}finally{$heldName.Dispose()}
 `),'PASS');
});

win('Current-only full supervisor uses the same fresh native frame, opens its channel before commit, and remains status-only',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$c=Get-Business5244CurrentSupersessionContext $token
 $script:received=0;$script:replies=[Collections.Generic.List[string]]::new();$script:channelClosed=0
 function Open-Business5244RetirementChannel($OwnerLease){Assert-Business5244StartupLease $OwnerLease -Kind Owner;if($c.phase-cne'RecordPublished'){throw 'CHANNEL_AFTER_UNCONFIRMED_BOOTSTRAP'};return [pscustomobject]@{fixtureChannel=$true}}
 function Receive-Business5244RetirementRequest($Channel){$script:received++;if($script:received-eq3){throw 'ISOLATED_SUPERVISOR_LOOP_END'};return [pscustomobject]@{operation=$(if($script:received-eq1){'status'}else{'retire'});requestId=('b'*32)}}
 function Assert-Business5244RetirementRequest($Channel,$Request){}
 function Complete-Business5244RetirementRequest($Channel,$Request,$Reply,$Snapshot){if($c.phase-cne'Completed'-or$Snapshot.phase-cne'Running'){throw 'REPLIED_BEFORE_NEW_CURRENT_READY'};$script:replies.Add($Reply)}
 function Close-Business5244RetirementChannel($Channel){$script:channelClosed++}
 function Invoke-Business5244OwnerMaintenance{throw 'CURRENT_ONLY_RETIRED_AGAIN'}
 $caught='';try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028' -CurrentSupersession $token|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'ISOLATED_SUPERVISOR_LOOP_END'-or($script:replies-join'|')-cne'Status|Rejected'-or$c.phase-cne'Completed'-or!$c.native.RetirementConfirmed-or$script:channelClosed-ne1){throw ('SUPERVISOR_INTEGRATION_FAILED_'+$caught)}
 $leaseRecord=Get-Business5244StartupRecord $c.lease;if(!$leaseRecord.closed-or(Test-Path -LiteralPath $pendingPath)-or@(Get-ChildItem -LiteralPath $env:TEMP -Filter '*.completed').Count){throw 'SUPERVISOR_ADOPTED_OLD_COMPLETION'}
 `),'PASS');
});
win('Current-only supervisor channel initialization failure uses only its own bounded undo and keeps startup blocked',()=>{
 assert.equal(superRun(String.raw`
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer;$c=Get-Business5244CurrentSupersessionContext $token
 function Open-Business5244RetirementChannel($OwnerLease){throw 'ISOLATED_CURRENT_CHANNEL_FAILURE'}
 $caught='';try{Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName 'TEST125-API-B6-ca620bac-20261028' -CurrentSupersession $token|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'ISOLATED_CURRENT_CHANNEL_FAILURE'-or!$c.closed-or$c.phase-cne'InitFailedCleanPendingRecovery'-or!(Test-Path -LiteralPath $pendingPath)-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash){throw ('SUPERVISOR_CHANNEL_UNDO_FAILED_'+$caught)}
 foreach($n in $createdNatives){if(!$n.RetirementConfirmed){throw 'SUPERVISOR_UNDO_LEFT_OWN_CHILD'}}
 $denied=$false;try{$again=Enter-Business5244StartupLease -Kind Owner}catch{$denied=$true};if(!$denied){Exit-Business5244StartupLease $again;throw 'SUPERVISOR_UNDO_UNBLOCKED_START'}
 `),'PASS');
});
win('Current-only supervisor refuses copied admission and incompatible slot/scope without creating a child or taking a second lease',()=>{
 assert.equal(superRun(String.raw`
 $fake=[pscustomobject]@{kind='business-5244-current-supersession'}
 foreach($slot in @('Current','ReadPair')){$denied=$false;try{Start-Business5244OwnedSupervisor -InitialSlot $slot -ScopeName 'TEST125-API-B6-ca620bac-20261028' -CurrentSupersession $fake|Out-Null}catch{$denied=$true};if(!$denied-or$createdNatives.Count-or$script:Business5244CurrentSupersessions.Count){throw 'FORGED_SUPERVISOR_ADMISSION_GRANTED'}}
 `),'PASS');
});
win('pre-exit observation retains the actual old mutex generation so an unclean old process exit is rejected as abandoned before any write',()=>{
 assert.equal(superRun(String.raw`
 Prepare-Business5244CurrentSupersessionObservation $observer|Out-Null;$o=Get-Business5244CurrentSupersessionObservation $observer
 if($o.mutex.SafeWaitHandle.IsClosed-or$o.name-cne$script:mutexName){throw 'PREEXIT_OLD_KERNEL_HANDLE_NOT_RETAINED'}
 $writer.WriteLine('ABANDON');$writer.Flush();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne23){throw 'ISOLATED_UNCLEAN_EXIT_NOT_PROVED'};$observer.ValidateExited()
 $caught='';try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'BUSINESS_5244_ABANDONED_OWNER'-or$o.mutex.SafeWaitHandle.IsClosed-or$createdNatives.Count-or$script:Business5244CurrentSupersessions.Count-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($pendingPath)))-cne$fixedInputs.pendingHash){throw 'OLD_ABANDONMENT_HIDDEN_BY_NEW_MUTEX'}
 `),'PASS');
});
win('a native owner exit without a prior live mutex observation cannot mint supersession admission',()=>{
 assert.equal(superRun(String.raw`
 $writer.WriteLine('EXIT');$writer.Flush();if(!$server.WaitForExit(5000)){throw 'ISOLATED_OLD_EXIT_NOT_PROVED'};$observer.ValidateExited();$caught=''
 try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_REQUIRED'-or$inputCalls-or$createdNatives.Count-or$script:Business5244CurrentSupersessions.Count){throw 'POSTEXIT_NEW_MUTEX_WAS_ADOPTED'}
 `),'PASS');
});
win('a live but unheld old mutex is balanced and rejected instead of being treated as a contention witness',()=>{
 assert.equal(superRun(String.raw`
 $writer.WriteLine('RELEASE');$writer.Flush();if($server.StandardOutput.ReadLine()-cne'RELEASED'-or$observer.Observe()){throw 'ISOLATED_LIVE_RELEASE_NOT_PROVED'}
 $caught='';try{Prepare-Business5244CurrentSupersessionObservation $observer|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'CURRENT_SUPERSESSION_OBSERVATION_NOT_HELD'-or$script:Business5244CurrentSupersessionObservations.Count){throw 'UNHELD_OLD_MUTEX_ADMITTED'}
 $check=[Threading.Mutex]::OpenExisting($script:mutexName);try{if(!$check.WaitOne(0)){throw 'UNEXPECTED_BALANCED_OBSERVATION_OWNERSHIP_LEAK'};$check.ReleaseMutex()}finally{$check.Dispose()}
 `),'PASS');
});
win('closing the pre-exit observation disposes only its own handle and cannot release the live old owner mutex',()=>{
 assert.equal(superRun(String.raw`
 Prepare-Business5244CurrentSupersessionObservation $observer|Out-Null;$o=Get-Business5244CurrentSupersessionObservation $observer;Close-Business5244CurrentSupersessionObservation $observer
 $check=[Threading.Mutex]::OpenExisting($script:mutexName);try{if($check.WaitOne(0)){$check.ReleaseMutex();throw 'OBSERVATION_CLOSE_RELEASED_OLD_OWNER'}}finally{$check.Dispose()}
 if(!$o.closed-or!$o.mutex.SafeWaitHandle.IsClosed-or$observer.Observe()){throw 'OBSERVATION_CLOSE_CHANGED_NATIVE_OWNER'}
 $writer.WriteLine('EXIT');$writer.Flush();[void]$server.WaitForExit(5000);$caught='';try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$caught=$_.Exception.Message};if($caught-cne'CURRENT_SUPERSESSION_PREEXIT_OBSERVATION_REQUIRED'){throw 'CLOSED_OBSERVATION_STILL_GRANTED'}
 `),'PASS');
});

win('Current-only boundary assertions returning true cannot leak into the scalar native admission, frame or completion result',()=>{
 assert.equal(superRun(String.raw`
 $body=(Get-Command Assert-Business5244CurrentSupersessionBoundary).Definition
 . ([scriptblock]::Create('function Assert-Business5244CurrentSupersessionBoundary {'+$body+';return $true}'))
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer
 if($token-is[array]-or@($token).Count-ne1-or$token.kind-cne'business-5244-current-supersession'){throw 'BOUNDARY_OUTPUT_LEAKED_INTO_ADMISSION'}
 $c=Get-Business5244CurrentSupersessionContext $token;$frame=Initialize-Business5244CurrentSupersessionOwner $token
 if($frame-is[array]-or@($frame).Count-ne1-or![object]::ReferenceEquals($frame.lease,$c.lease)-or![object]::ReferenceEquals($frame.native,$c.native)-or![object]::ReferenceEquals($frame.state,$c.state)){throw 'BOUNDARY_OUTPUT_LEAKED_INTO_FRAME'}
 $result=Complete-Business5244CurrentSupersessionOwner $token
 if($result-is[array]-or@($result).Count-ne1-or$result.classification-cne'SUPERSEDED_NOT_ORIGINAL_COMMIT'-or$script:boundaryCalls-ne4-or$c.phase-cne'Completed'){throw 'BOUNDARY_OUTPUT_LEAKED_INTO_COMPLETION'}
 `),'PASS');
});
win('INIT-CLEAN fixed predecessor marker creates only a scalar fresh Current owner under the same native lease',()=>{
 assert.equal(initCleanRun(String.raw`
 if(@(Assert-Business5244CurrentSupersessionFixedCase $fixedInputs).Count){throw 'FIXED_CASE_ASSERTION_OUTPUT'}
 Exit-FixtureOldOwner;$token=New-Business5244CurrentSupersessionAdmission $observer
 if($token-is[array]-or@($token).Count-ne1){throw 'INIT_CLEAN_ADMISSION_NOT_SCALAR'}
 $c=Get-Business5244CurrentSupersessionContext $token;Assert-Business5244StartupLease $c.lease -Kind Maintenance
 if($c.seals.Count-ne18-or$c.phase-cne'Prepared'){throw 'INIT_CLEAN_EXACT_ENTRY_SET_NOT_HELD'}
 $frame=Initialize-Business5244CurrentSupersessionOwner $token
 if($frame-is[array]-or@($frame).Count-ne1-or![object]::ReferenceEquals($frame.lease,$c.lease)-or$frame.native.ChildPid-eq$server.Id-or!$frame.native.ChildAlive()){throw 'INIT_CLEAN_ADOPTED_PREDECESSOR'}
 $result=Complete-Business5244CurrentSupersessionOwner $token
 if($result-is[array]-or@($result).Count-ne1-or$result.classification-cne'SUPERSEDED_NOT_ORIGINAL_COMMIT'-or$result.originalRetireCompleted-or$c.phase-cne'Completed'-or(Test-Path -LiteralPath $pendingPath)){throw 'INIT_CLEAN_FALSE_COMPLETION'}
 $preserved=[IO.File]::ReadAllBytes(($pendingPath+'.'+$c.operationId+'.superseded-original'))
 if((Get-Business5244StartupHash $preserved)-cne$fixedInputs.pendingHash-or@([IO.Directory]::GetFiles($env:TEMP,'*.completed')).Count){throw 'INIT_CLEAN_LOST_OWN_MARKER_OR_GRANTED_OLD_COMMIT'}
 $rowsAfter=ConvertFrom-Business5244RecordBytes ([IO.File]::ReadAllBytes($recordsPath));if($rowsAfter[0].pid-ne111-or$rowsAfter[1].pid-ne112-or$rowsAfter[2].pid-ne$frame.native.ChildPid){throw 'INIT_CLEAN_CHANGED_OTHER_RECORDS'}
 Assert-Business5244StartupLease $c.lease -Kind Owner
 `),'PASS');
});
win('INIT-CLEAN rejects every wrong marker anchor or issuer even when fixture byte hashes match',()=>{
 for(const field of ['schema','classification','operationId','originalOperationId','originalPendingSha256','originalRecordsSha256','ownerPid','ownerBirth']){
  assert.equal(initCleanRun(`Exit-FixtureOldOwner;$field='${field}';`+String.raw`
 $marker=[Text.Encoding]::UTF8.GetString($oldPending)|ConvertFrom-Json
 if($field-ceq'ownerPid'){$marker.ownerPid++}else{$marker.$field='wrong-fixed-anchor'}
 $script:fixedInputs.pendingBeforeBytes=[Text.Encoding]::UTF8.GetBytes(($marker|ConvertTo-Json -Compress));$script:fixedInputs.pendingHash=Get-Business5244StartupHash $script:fixedInputs.pendingBeforeBytes
 [IO.File]::WriteAllBytes($pendingPath,$script:fixedInputs.pendingBeforeBytes);$caught=''
 try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'CURRENT_SUPERSESSION_INIT_CLEAN_PENDING_REJECTED'-or$createdNatives.Count-or$script:Business5244CurrentSupersessions.Count-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($pendingPath)))-cne$fixedInputs.pendingHash){throw ('INIT_CLEAN_MARKER_ACCEPTED_'+$field+'_'+$caught)}
 `),'PASS');
 }
});
win('INIT-CLEAN observation admits only its fixed case tuple and never accepts a copied native observer',()=>{
 assert.equal(initCleanRun(String.raw`
 $original=$script:fixedInputs
 foreach($drift in @('case','pid','birth','entryCount','record')){
  $script:fixedInputs=$original.PSObject.Copy()
  switch($drift){case{$script:fixedInputs.caseId='current-only-5244-init-clean-20261029'}pid{$script:fixedInputs.ownerPid++}birth{$script:fixedInputs.ownerBirth='old'}entryCount{$script:fixedInputs.entrySeals=@($entries|Select-Object -First 16)}record{$script:fixedInputs.recordsHash='0'*64;$script:fixedInputs.originalBeforeHash=$script:fixedInputs.recordsHash}}
  $caught='';try{Prepare-Business5244CurrentSupersessionObservation $observer|Out-Null}catch{$caught=$_.Exception.Message}
  if($caught-cne'CURRENT_SUPERSESSION_FIXED_CASE_REJECTED'-or$script:Business5244CurrentSupersessionObservations.Count){throw ('INIT_CLEAN_TUPLE_ACCEPTED_'+$drift+'_'+$caught)}
 }
 $script:fixedInputs=$original;$fake=[pscustomobject]@{TargetPid=$observer.TargetPid;TargetBirth=$observer.TargetBirth};$caught=''
 try{Prepare-Business5244CurrentSupersessionObservation $fake|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'CURRENT_SUPERSESSION_NATIVE_EXIT_REQUIRED'-or$observer.Observe()-or$createdNatives.Count-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash){throw 'INIT_CLEAN_COPIED_OBSERVER_GRANTED'}
 `),'PASS');
});
win('INIT-CLEAN preserves the pre-exit mutex generation and rejects real abandoned ownership before any CAS or fresh child',()=>{
 assert.equal(initCleanRun(String.raw`
 Prepare-Business5244CurrentSupersessionObservation $observer|Out-Null;$o=Get-Business5244CurrentSupersessionObservation $observer
 $writer.WriteLine('ABANDON');$writer.Flush();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne23){throw 'INIT_CLEAN_ABANDONMENT_NOT_REAL'};$observer.ValidateExited();$caught=''
 try{New-Business5244CurrentSupersessionAdmission $observer|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'BUSINESS_5244_ABANDONED_OWNER'-or$o.mutex.SafeWaitHandle.IsClosed-or$createdNatives.Count-or$script:Business5244CurrentSupersessions.Count-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($recordsPath)))-cne$beforeHash-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($pendingPath)))-cne$fixedInputs.pendingHash){throw ('INIT_CLEAN_ABANDONED_BYPASS_'+$caught)}
 `),'PASS');
});

win('V3 Current predecessor binds its own pinned capture and rejects generation or manifest-purpose drift',()=>{
 const body=setup+String.raw`
 . __NATIVE_PROFILE__
 $fixed=Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Current
 $caseDir=Join-Path $env:TEMP 'candidate-capture';[void][IO.Directory]::CreateDirectory($caseDir)
 $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3'
 $rows[2].pid=46984;$rows[2].root=$fixed.root;$rows[2].sourceCommit=$fixed.frontendSource
 $image=[Text.Encoding]::UTF8.GetBytes(($rows|ConvertTo-Json -Depth 10));$imageHash=Get-Business5244StartupHash $image
 [IO.File]::WriteAllBytes((Join-Path $caseDir 'current-erp-processes.before.json'),$image)
 $cm=@{kind='BUSINESS5244_FRESH_OWNER_BUNDLE';rehearsalOnly=$true;sourceCommit='f18f7bbec0d95ac10e3be91bd5f7137819f16514'}
 $rm=@{kind='BUSINESS5244_READ_PAIR_ROUTER';rehearsalOnly=$true;coreRoot=$core;coreManifestSha256=('a'*64);entrySha256=('b'*64)}
 $c=[pscustomobject]@{schema='melisa-b6-current-read2b-owner-capture.v1';predecessorEntryKind='ReadPairRouter';readOnly=$true;stopAuthorized=$false;recordBeforeSha256=$imageHash;owner=@{pid=38992;birth='134377492746263010'};child=@{pid=46984;birth='134377502264500436';parent=38992;exe=$fixed.node};serviceCalls=0;sqlCalls=0;retireCalls=0;entry=@{root=$router;manifestSha256=('c'*64);sha256=('b'*64);runtimeEntryBytesVerified=$false;postExitExclusiveBytesRequired=$true};router=@{root=$router;manifestSha256=('c'*64)};core=@{root=$core;manifestSha256=('a'*64)};webRecord=$rows[2];installedApiManifest=$fixed.apiManifest;installedWebManifest=$fixed.manifest;nativeStatus=@{reply='Status';nativePeerVerified=$true;state=@{phase='Running';ownerPid=38992;childPid=46984}}}
 $capturePath=Join-Path $caseDir 'current-read2b-owner-capture.json';$cmPath=Join-Path $caseDir 'core-manifest.json';$rmPath=Join-Path $caseDir 'router-manifest.json'
 function Save-CandidateFixture{
  [IO.File]::WriteAllText($capturePath,($c|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false));[IO.File]::WriteAllText($cmPath,($cm|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false));[IO.File]::WriteAllText($rmPath,($rm|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
  $d=$originalDefinition.Replace('3e9a6a8f96185677a654a9b2bd7e890ab838773c424dcc35b1532b928f9f11b8',$imageHash).Replace('C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-candidate-apply-debafecb-20261029\current-read2b-owner-capture.json',$capturePath).Replace('3f7d2484310246df0b01d8b1692d16fdfc70b75a4545c0344bcb941118110642',(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($capturePath))))

  # Replace only fixture input paths and hash pins. All production validators run.
  $d=$d.Replace("(Join-Path "+[char]36+"core 'owner-manifest.json')",'$cmPath').Replace("(Join-Path "+[char]36+"router 'owner-manifest.json')",'$rmPath').Replace('cfc30ab5e3ef7774c92eb2085d66adabc1d0359d7343e63f8eb727ab7d40383f',(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($cmPath)))).Replace('a275fdbe5fc009feeb10f59c71cd915734303c91c2b4c31f2afad255c5de2f58',(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($rmPath))))
  Set-Item Function:script:Get-Business5244CurrentBootstrapPins ([scriptblock]::Create($d))
 }
 $originalDefinition=(Get-Command Get-Business5244CurrentBootstrapPins).Definition
 try{
  Save-CandidateFixture;$r=Get-Business5244CurrentBootstrapPins $imageHash -ScopeName 'TEST125-API-B6-ca620bac-20261028';if($r.pid-ne46984-or$r.ownerPid-ne38992-or$r.hash-cne$imageHash){throw 'V3_FIXED_PREDECESSOR_REJECTED'}
  $c.owner.pid=38993;Save-CandidateFixture;$caught='';try{Get-Business5244CurrentBootstrapPins $imageHash -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$caught=$_.Exception.Message};if($caught-cne'CURRENT_BOOTSTRAP_B6_V3_CAPTURE_CHANGED'){throw 'V3_FOREIGN_GENERATION_ACCEPTED'}
  $c.owner.pid=38992;$rm.rehearsalOnly=$false;Save-CandidateFixture;$caught='';try{Get-Business5244CurrentBootstrapPins $imageHash -ScopeName 'TEST125-API-B6-ca620bac-20261028'|Out-Null}catch{$caught=$_.Exception.Message};if($caught-cne'CURRENT_BOOTSTRAP_B6_V3_SOURCE_CHANGED'){throw 'V3_PURPOSE_DRIFT_ACCEPTED'}
 }__CLEANUP__
 `.replace('__NATIVE_PROFILE__',q(path.join(dir,'canonical-business-sale-maintenance.ps1'))).replace('__CLEANUP__',cleanup);
 assert.equal(run(body),'PASS');
});

win('Writer bootstrap binds its fresh Applied-B6 capture, six before-images and live old-owner exclusion without importing an old admission',()=>{
 const body=setup.replace('$state=Register-Business5244OwnedRetirement $lease $native $pins;','$state=$null;')+String.raw`
 . __NATIVE_PROFILE__
 $script:writerCurrent=(Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate).Clone();$script:writerCandidate=$script:writerCurrent.Clone();$script:writerCandidate.package='ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$script:writerCandidate.root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$script:writerCandidate.apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';$script:writerCandidate.manifest='a'*64;$script:writerCandidate.apiManifest='b'*64
 function Get-ErpBusinessSaleWriterPairPins($Mode){if($Mode-ceq'Current'){return $script:writerCurrent};return $script:writerCandidate}
 $name='TEST125-API-B6-WRITER-20261029';$fixed=Get-Business5244FinitePairPins -ScopeName $name -Mode Current
 $state=Register-Business5244OwnedRetirement $lease $native $fixed -ScopeName $name
 $caseDir=Join-Path $env:TEMP 'writer-capture';[void][IO.Directory]::CreateDirectory($caseDir)
 $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY'
 $rows[2].pid=33576;$rows[2].root=$fixed.root;$rows[2].sourceCommit=$fixed.frontendSource
 $image=[Text.Encoding]::UTF8.GetBytes(($rows|ConvertTo-Json -Depth 10));$imageHash=Get-Business5244StartupHash $image
 [IO.File]::WriteAllBytes((Join-Path $caseDir 'current-erp-processes.before.json'),$image)
 $xml=[Text.Encoding]::UTF8.GetBytes('<Task>synthetic-only</Task>');$sddl=[Text.Encoding]::UTF8.GetBytes('synthetic-no-OS-permission');$xmlHash=Get-Business5244StartupHash $xml;$sddlHash=Get-Business5244StartupHash $sddl
 [IO.File]::WriteAllBytes((Join-Path $caseDir 'current-task.before.xml'),$xml);[IO.File]::WriteAllBytes((Join-Path $caseDir 'current-task.before.sddl'),$sddl)
 $cm=@{kind='BUSINESS5244_FRESH_OWNER_BUNDLE';finiteScope='TEST125-API-B6-ca620bac-20261028';sourceCommit='9f9a45bb36d52daa5ee202520e93c84e544d01ac';rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply';recordingEnabled=$false;files=@(1..13|ForEach-Object{@{path=('synthetic-'+$_+'.ps1');sha256=('a'*64)}})}
 $rm=@{kind='BUSINESS5244_READ_PAIR_ROUTER';finiteScope=$cm.finiteScope;entrySourceCommit=$cm.sourceCommit;rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply';coreRoot=$core;coreManifestSha256='554e46b609961ab3a9186460d09901a050212503770a0eaab7c7cc003b37e41e';entrySha256='6a6dc3f649de4c912a57a7c940def7c4594ae3df8b014079f6a198340994ac8c'}
 $c=[pscustomobject]@{schema='melisa-b6-writer-current-owner-capture.v1';predecessorEntryKind='ReadPairRouter';readOnly=$true;stopAuthorized=$false;recordBeforeSha256=$imageHash;owner=@{pid=45104;birth='134377531591976073';exe=(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe');argv='synthetic-owner-argv'};child=@{pid=33576;birth='134377540528369398';parent=45104;exe=$fixed.node;argv='synthetic-child-argv'};serviceCalls=0;sqlCalls=0;retireCalls=0;entry=@{root=$router;leaf='start-business-5244-readpair-router.ps1';manifestSha256='ee0ba9bbe46d65b0357c7a75d21a2f004eea68c5f5e76f7a4e70c0012cdb135a';sha256=$rm.entrySha256;runtimeEntryBytesVerified=$false;postExitExclusiveBytesRequired=$true};router=@{root=$router;manifestSha256='ee0ba9bbe46d65b0357c7a75d21a2f004eea68c5f5e76f7a4e70c0012cdb135a'};core=@{root=$core;manifestSha256=$rm.coreManifestSha256};webRecord=$rows[2];installedApiManifest=$fixed.apiManifest;installedWebManifest=$fixed.manifest;nativeStatus=@{reply='Status';nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true;state=@{phase='Running';ownerPid=45104;ownerBirth='134377531591976073';childPid=33576;childBirth='134377540528369398'}}}
 $e=@{schema='melisa-b6-writer-current-entry-capture.v1';readOnly=$true;executionAuthority=$false;ownerCaptureSha256=('0'*64);entries=@(1..6|ForEach-Object{@{path=('synthetic-legacy-'+$_)}});directEntries=@(1..16|ForEach-Object{@{path=('synthetic-direct-'+$_)}});postExitExclusiveEntryCount=22;runtimeValidationComplete=$false;entryWrites=0;serviceCalls=0;sqlCalls=0}
 $t=@{schema='melisa-b6-task-capture.v1';readOnly=$true;xmlSha256=$xmlHash;sddlSha256=$sddlHash;writes=0}
 $ownerArgHash=Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($c.owner.argv));$childArgHash=Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($c.child.argv))
 $cmPath=Join-Path $caseDir 'core-manifest.json';$rmPath=Join-Path $caseDir 'router-manifest.json';$capturePath=Join-Path $caseDir 'current-read2b-owner-capture.json';$entryPath=Join-Path $caseDir 'current-entry-hold-capture.json';$taskPath=Join-Path $caseDir 'current-task-capture.json'
 $originalDefinition=(Get-Command Get-Business5244CurrentBootstrapPins).Definition
 function Save-WriterFixture{
  [IO.File]::WriteAllText($cmPath,($cm|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false));$coreHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($cmPath));$rm.coreManifestSha256=$coreHash
  [IO.File]::WriteAllText($rmPath,($rm|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false));$routerHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($rmPath));$c.core.manifestSha256=$coreHash;$c.router.manifestSha256=$routerHash;$c.entry.manifestSha256=$routerHash
  [IO.File]::WriteAllText($capturePath,($c|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false));$captureHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($capturePath));$e.ownerCaptureSha256=$captureHash
  foreach($row in @(@($entryPath,$e),@($taskPath,$t))){[IO.File]::WriteAllText($row[0],($row[1]|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))}
  $d=$originalDefinition.Replace('C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-20261029',$caseDir).Replace('b07100ff411f917c2eaf09e0b14b8844666242badfc4d1556a8e6b3253afadf0',$imageHash).Replace('86b2ee054f3cc9fa794c7013a816faa3a2af5a392e10afef08a09c76f84e7161',$captureHash).Replace('4891f1e095cd0cfaef9221e56a16af29c2b234a9909009db47e00c533c9b957c',(Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($entryPath)))).Replace('208bad4f906d910a2dc247f2cb08db0f2e47f07421b256997a93239cc0f967e6',(Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($taskPath)))).Replace('46fadd9b79c291a8f1aa3299ef5fdb7d8a2f8f26968acf5a92c8f462b77831ec',$xmlHash).Replace('cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',$sddlHash).Replace('57515c57fd7cf81404d098cb265e5914a6f6d8e983c72abfcf7d11c91310e6e4',$ownerArgHash).Replace('81655f3d196151ed6f0f123afa1aa7b9126d5257f012d8fdd9846b555d0851e1',$childArgHash)
  # Only file paths/content pins change in the fixture. Every type, tuple,
  # before-image, native creator and old-live-owner exclusion stays production.
  $d=$d.Replace("(Join-Path "+[char]36+"core 'owner-manifest.json')",'$cmPath').Replace("(Join-Path "+[char]36+"router 'owner-manifest.json')",'$rmPath')
  $d=$d.Replace('554e46b609961ab3a9186460d09901a050212503770a0eaab7c7cc003b37e41e',$coreHash).Replace('ee0ba9bbe46d65b0357c7a75d21a2f004eea68c5f5e76f7a4e70c0012cdb135a',$routerHash)
  Set-Item Function:script:Get-Business5244CurrentBootstrapPins ([scriptblock]::Create($d))
 }
 try{
  Save-WriterFixture
  $r=Get-Business5244CurrentBootstrapPins $imageHash -ScopeName $name;if($r.pid-ne33576-or$r.ownerPid-ne45104-or$r.hash-cne$imageHash-or$r.root-cne$fixed.root){throw 'WRITER_FRESH_PREDECESSOR_REJECTED'}
  foreach($case in @('owner','birth','argv','source','entry','entrycount','task','before')){
   switch($case){owner{$c.owner.pid++}birth{$c.child.birth='wrong'}argv{$c.owner.argv+=' extra'}source{$rm.maintenancePurpose='RehearsalOnly'}entry{$c.entry.runtimeEntryBytesVerified=$true}entrycount{$e.postExitExclusiveEntryCount=21}task{$t.xmlSha256='0'*64}before{$c.webRecord.backendPort=4194}}
   Save-WriterFixture;$denied=$false;try{Get-Business5244CurrentBootstrapPins $imageHash -ScopeName $name|Out-Null}catch{$denied=$true};if(!$denied){throw ('WRITER_DRIFT_ADMITTED '+$case)}
   switch($case){owner{$c.owner.pid--}birth{$c.child.birth='134377540528369398'}argv{$c.owner.argv='synthetic-owner-argv'}source{$rm.maintenancePurpose='CandidateMetadataApply'}entry{$c.entry.runtimeEntryBytesVerified=$false}entrycount{$e.postExitExclusiveEntryCount=22}task{$t.xmlSha256=$xmlHash}before{$c.webRecord.backendPort=4144}}
  }
  Save-WriterFixture;function Assert-Business5244CreatedChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'OWNED_CHILD_NOT_ALIVE'}};function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
  $script:oldOwnerPresent=$false;function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'-or$Filter-cnotin@('ProcessId=45104','ProcessId=33576')){throw 'FOREIGN_CIM'};if($script:oldOwnerPresent-and$Filter-ceq'ProcessId=45104'){return @{pid=45104}};return $null}
  [IO.File]::WriteAllBytes($recordPath,$image);$records=[IO.File]::Open($recordPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);Assert-Business5244CurrentBootstrapBefore $state $records;$script:oldOwnerPresent=$true;$denied=$false;try{Assert-Business5244CurrentBootstrapBefore $state $records}catch{$denied=$_.Exception.Message-ceq'CURRENT_BOOTSTRAP_OLD_OWNER_PRESENT'};if(!$denied-or!$native.ChildAlive()){throw 'WRITER_OLD_LIVE_OWNER_ADMITTED'}
 }__CLEANUP__
 `.replace('__NATIVE_PROFILE__',q(path.join(dir,'canonical-business-sale-maintenance.ps1'))).replace('__CLEANUP__',cleanup);
 assert.equal(run(body),'PASS');
});

win('Writer V2 bootstrap accepts only its typed CurrentCore predecessor and independent Applied-B6 task source',()=>{
 const body=String.raw`
 $ErrorActionPreference='Stop'
 . __WEB__ -Library;. __STATE__ -Library;. __PROFILE__
 $script:fixed=Get-Business5244FinitePairPins -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate
 function Get-ErpBusinessSaleWriterPairPins($Mode){if($Mode-cne'Current'){throw 'FIXTURE_READ_ONLY_MODE'};return $script:fixed}
 $name='TEST125-API-B6-WRITER-20261029';$caseDir=Join-Path $env:TEMP 'writer-v2';[void][IO.Directory]::CreateDirectory($caseDir)
 $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029';$taskRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY';$source='16daf65071da498ae3cdd779157f7004244bb630'
 $row=@{pid=14836;port=5244;root=$fixed.root;sourceCommit=$fixed.frontendSource;entry='vite-preview';backendPort=4144;businessWorkfaceId=$fixed.profile};$image=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject @($row) -Depth 10));$imageHash=Get-ErpBusinessSaleHash $image
 [IO.File]::WriteAllBytes((Join-Path $caseDir 'current-erp-processes.before.json'),$image)
 $xml=[Text.Encoding]::UTF8.GetBytes('synthetic-xml');$sddl=[Text.Encoding]::UTF8.GetBytes('synthetic-sddl');$xmlHash=Get-ErpBusinessSaleHash $xml;$sddlHash=Get-ErpBusinessSaleHash $sddl
 [IO.File]::WriteAllBytes((Join-Path $caseDir 'current-task.before.xml'),$xml);[IO.File]::WriteAllBytes((Join-Path $caseDir 'current-task.before.sddl'),$sddl)
 $taskManifestPath=Join-Path $caseDir 'task-manifest.json';$taskLauncherPath=Join-Path $caseDir 'task-source.bin';[IO.File]::WriteAllText($taskManifestPath,'{"kind":"synthetic-task-source"}');[IO.File]::WriteAllBytes($taskLauncherPath,[byte[]]::new(26901));$taskManifestHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($taskManifestPath));$taskSourceHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($taskLauncherPath))
 $cm=@{kind='BUSINESS5244_FRESH_OWNER_BUNDLE';finiteScope=$name;sourceCommit=$source;rehearsalOnly=$false;maintenancePurpose='WriterProfileActivation';recordingEnabled=$false;files=@(1..13|ForEach-Object{@{path=('synthetic-'+$_+'.ps1');sha256=('a'*64)}})}
 $rm=@{kind='BUSINESS5244_READ_PAIR_ROUTER';finiteScope=$name;entrySourceCommit=$source;rehearsalOnly=$false;maintenancePurpose='WriterProfileActivation';coreRoot=$core;coreManifestSha256=('0'*64);entrySha256='edd0191b0b8107766b1ab4a4ff44cec17e6bc7b69d5024098ae5fe67a3dc99c4'}
 $c=@{schema='melisa-b6-writer-current-owner-capture.v1';predecessorEntryKind='CurrentCore';readOnly=$true;stopAuthorized=$false;recordBeforeSha256=$imageHash;owner=@{pid=17372;birth='134377623115780499';exe=(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe');argv='synthetic-v2-owner'};child=@{pid=14836;parent=17372;birth='134377623535118145';exe=$fixed.node;argv='synthetic-child'};serviceCalls=0;sqlCalls=0;retireCalls=0;entry=@{root=$core;leaf='run-current-owner.ps1';manifestSha256=('0'*64);sha256='f37217b0f6e74bf721160bd056c179e3208ae56f2e25b56656b56f08f333ef8c';runtimeEntryBytesVerified=$false;postExitExclusiveBytesRequired=$true};core=@{root=$core;sourceCommit=$source;manifestSha256=('0'*64)};router=@{root=$router;manifestSha256=('0'*64);entrySha256=$rm.entrySha256};webRecord=$row;installedApiManifest=$fixed.apiManifest;installedWebManifest=$fixed.manifest;nativeStatus=@{reply='Status';nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true;state=@{phase='Running';ownerPid=17372;ownerBirth='134377623115780499';childPid=14836;childBirth='134377623535118145'}};taskLauncher=@{path=(Join-Path $taskRoot 'start-owned-test.ps1');sha256=$taskSourceHash;bytes=26901;coreRoot=$taskRoot;coreManifestSha256=$taskManifestHash}}
 $e=@{schema='melisa-b6-writer-current-entry-capture.v1';readOnly=$true;executionAuthority=$false;ownerCaptureSha256=('0'*64);entries=@(1..6|ForEach-Object{@{path=('synthetic-legacy-'+$_)}});directEntries=@(1..18|ForEach-Object{@{path=('synthetic-direct-'+$_)}});postExitExclusiveEntryCount=24;runtimeValidationComplete=$false;entryWrites=0;serviceCalls=0;sqlCalls=0}
 $t=@{schema='melisa-b6-task-capture.v1';readOnly=$true;xmlSha256=$xmlHash;sddlSha256=$sddlHash;writes=0}
 $ownerArgHash=Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($c.owner.argv));$childArgHash=Get-ErpBusinessSaleHash ([Text.Encoding]::UTF8.GetBytes($c.child.argv));$original=(Get-Command Get-Business5244CurrentBootstrapPins).Definition
 $cmPath=Join-Path $caseDir 'core.json';$rmPath=Join-Path $caseDir 'router.json';$capturePath=Join-Path $caseDir 'current-read2b-owner-capture.json';$entryPath=Join-Path $caseDir 'current-entry-hold-capture.json';$taskPath=Join-Path $caseDir 'current-task-capture.json'
 function Save-V2Fixture{
  [IO.File]::WriteAllText($cmPath,($cm|ConvertTo-Json -Depth 20));$coreHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($cmPath));$rm.coreManifestSha256=$coreHash;[IO.File]::WriteAllText($rmPath,($rm|ConvertTo-Json -Depth 20));$routerHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($rmPath));$c.core.manifestSha256=$coreHash;$c.entry.manifestSha256=$coreHash;$c.router.manifestSha256=$routerHash
  [IO.File]::WriteAllText($capturePath,($c|ConvertTo-Json -Depth 20));$captureHash=Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($capturePath));$e.ownerCaptureSha256=$captureHash;[IO.File]::WriteAllText($entryPath,($e|ConvertTo-Json -Depth 20));[IO.File]::WriteAllText($taskPath,($t|ConvertTo-Json -Depth 20))
  $d=$original.Replace('C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029',$caseDir).Replace('48603c39c67aed102b0887d2a0824d5afc9e27aeade02bd4e0436a34a8f51334',$imageHash).Replace('50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65',$captureHash).Replace('95b27499bd60bba1e32c3a173e5c573e434c9b31014f796ba62a0c7442dc440a',(Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($entryPath)))).Replace('208bad4f906d910a2dc247f2cb08db0f2e47f07421b256997a93239cc0f967e6',(Get-ErpBusinessSaleHash ([IO.File]::ReadAllBytes($taskPath)))).Replace('46fadd9b79c291a8f1aa3299ef5fdb7d8a2f8f26968acf5a92c8f462b77831ec',$xmlHash).Replace('cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',$sddlHash).Replace('add3b1a736b6ad93bbc94aad6abf61c4c4f37d9973115e24f06840b1f503e7c3',$ownerArgHash).Replace('81655f3d196151ed6f0f123afa1aa7b9126d5257f012d8fdd9846b555d0851e1',$childArgHash).Replace('cf470ca1587cfe38c79617f9fd312b3bac430636ff66d83a42dbec4a05d7ffee',$coreHash).Replace('d0875d5ef6c847b2f8df63b6018d3ca5db4ef20bbbbe133cd1b3815e07963eaf',$routerHash).Replace('554e46b609961ab3a9186460d09901a050212503770a0eaab7c7cc003b37e41e',$taskManifestHash).Replace('1728c4d5dcc7eab597640550d068f84140a37d2820620a0a24bcdd3f8e39a917',$taskSourceHash)
  $d=$d.Replace("(Join-Path "+[char]36+"core 'owner-manifest.json')",'$cmPath').Replace("(Join-Path "+[char]36+"router 'owner-manifest.json')",'$rmPath').Replace("(Join-Path "+[char]36+"launcherRoot 'owner-manifest.json')",'$taskManifestPath').Replace('Read-ErpBusinessSalePinnedFile $launcher.path $launcher.sha256','Read-ErpBusinessSalePinnedFile $taskLauncherPath $launcher.sha256')
  Set-Item Function:script:Get-Business5244CurrentBootstrapPins ([scriptblock]::Create($d))
 }
 Save-V2Fixture;$r=Get-Business5244CurrentBootstrapPins $imageHash -ScopeName $name;if($r.pid-ne14836-or$r.ownerPid-ne17372-or$r.birth-cne'134377623535118145'-or$r.ownerBirth-cne'134377623115780499'){throw 'V2_CURRENTCORE_REJECTED'}
 foreach($case in @('wrong-kind','wrong-root','old-owner','old-birth','argv','entry-count','task-source','task-extra','router','purpose')){
  switch($case){wrong-kind{$c.predecessorEntryKind='ReadPairRouter'}wrong-root{$c.entry.root=$router}old-owner{$c.owner.pid=45104}old-birth{$c.child.birth='134377540528369398'}argv{$c.owner.argv+=' extra'}entry-count{$e.postExitExclusiveEntryCount=22}task-source{$c.taskLauncher.path=Join-Path $core 'start-owned-test.ps1'}task-extra{$c.taskLauncher.extra=$true}router{$c.router.entrySha256='0'*64}purpose{$cm.maintenancePurpose='CandidateMetadataApply'}}
  Save-V2Fixture;$denied=$false;try{Get-Business5244CurrentBootstrapPins $imageHash -ScopeName $name|Out-Null}catch{$denied=$true};if(!$denied){throw ('V2_OLD_OR_MIXED_ADMITTED '+$case)}
  switch($case){wrong-kind{$c.predecessorEntryKind='CurrentCore'}wrong-root{$c.entry.root=$core}old-owner{$c.owner.pid=17372}old-birth{$c.child.birth='134377623535118145'}argv{$c.owner.argv='synthetic-v2-owner'}entry-count{$e.postExitExclusiveEntryCount=24}task-source{$c.taskLauncher.path=Join-Path $taskRoot 'start-owned-test.ps1'}task-extra{$c.taskLauncher.Remove('extra')}router{$c.router.entrySha256=$rm.entrySha256}purpose{$cm.maintenancePurpose='WriterProfileActivation'}}
 }
 Save-V2Fixture;$denied=$false;try{Get-Business5244CurrentBootstrapPins ('0'*64) -ScopeName $name|Out-Null}catch{$denied=$true};if(!$denied){throw 'V2_ARBITRARY_BEFORE_ACCEPTED'};'PASS'
 `.replace('__WEB__',q(path.join(dir,'start-business-5244-web.ps1'))).replace('__STATE__',q(path.join(dir,'business-5244-retirement-state.ps1'))).replace('__PROFILE__',q(path.join(dir,'canonical-business-sale-maintenance.ps1')));
 assert.equal(run(body),'PASS');
});


win('Web-only bootstrap binds the corrected router capture and current Writer record without granting stop or accepting the stale CurrentCore label',()=>{
 const body=`$ErrorActionPreference='Stop';. ${q(path.join(dir,'start-business-5244-web.ps1'))} -Library;. ${q(path.join(dir,'business-5244-retirement-state.ps1'))} -Library;`+String.raw`
 function Test-Business5244WriterWebOnlyGeneration{return $true}
 $fixed=(Get-Business5244WebPins).Clone();$fixed.root='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$fixed.frontendSource='1033566d594ad7c02b8469e5c9598541333cd500';$fixed.package='ERP-BUSINESS-WEB-5244-B6-WRITER-20261029';$fixed.manifest='121020af80ef660c4b9a0872f31dd4c3306bff81346f66797a6806bf6b1a4189';$fixed.apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';$fixed.apiManifest=('560c735fcaffa6692f55543840f81066'+'79b43b871e3c19f1990bdd17d46f9946')
 function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or$Mode-cne'Current'){throw 'FIXTURE_FOREIGN_PIN_READ'};return $fixed.Clone()}
 $beforeHash='fe5a222107e2a056d649a26f1dfa86d576f6a3d29fe413731c995c7b295183db';$oldCore='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2';$oldRouter='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2';$coreHash='2d1047887212c9e131a53da0f7f865a48909c90f0d6b84756c589fc8fdbbcdd2';$routerHash='7f44b5b61e4cc8867aa25a84a2820974b632c0bdba318711e67c8ef24c7b5602';$entryHash='2b0c4e83bb8c7f9a3c5f00d1ef90aa66a34a7e2a4eaf207832e9705913c03ecb'
 $row=[pscustomobject]@{port=5244;pid=52420;entry='vite-preview';sourceCommit=$fixed.frontendSource;root=$fixed.root;backendPort=4144;businessWorkfaceId=$fixed.profile}
 $capture=[pscustomobject]@{schema='melisa-b6-writer-current-owner-capture.v1';predecessorEntryKind='ReadPairRouter';readOnly=$true;stopAuthorized=$false;recordPath='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';recordBeforeFile='current-erp-processes.before.json';recordBeforeSha256=$beforeHash;owner=@{pid=45612;birth='134377648982508423'};child=@{pid=52420;parent=45612;birth='134377689444377841';exe=$fixed.node};serviceCalls=0;sqlCalls=0;retireCalls=0;core=@{root=$oldCore;manifestSha256=$coreHash;sourceCommit='d0b457f2ee9911dc2bf0b453723a91264ff551b6'};router=@{root=$oldRouter;manifestSha256=$routerHash};entry=@{root=$oldRouter;leaf='start-business-5244-readpair-router.ps1';manifestSha256=$routerHash;sha256=$entryHash;runtimeEntryBytesVerified=$false;postExitExclusiveBytesRequired=$true};webRecord=$row;installedApiManifest=$fixed.apiManifest;installedWebManifest=$fixed.manifest;nativeStatus=@{reply='Status';nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true;state=@{phase='Running';ownerPid=45612;ownerBirth='134377648982508423';childPid=52420;childBirth='134377689444377841'}}}
 $cm=@{kind='BUSINESS5244_FRESH_OWNER_BUNDLE';finiteScope='TEST125-API-B6-WRITER-20261029';sourceCommit=$capture.core.sourceCommit;maintenancePurpose='WriterProfileActivation'};$rm=@{kind='BUSINESS5244_READ_PAIR_ROUTER';coreRoot=$oldCore;coreManifestSha256=$coreHash;entrySha256=$entryHash}
 function Read-ErpBusinessSalePinnedFile($Path,$Hash){
  $root='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-workface-build-20261029\current-capture-corrected'
  if($Path-ceq(Join-Path $root 'current-read2b-owner-capture.json')-and$Hash-ceq'e480d77c835f3c2170589b9fbafec6da78dd2a19624d486d8822ad7b930d3a09'){$o=$capture}
  elseif($Path-ceq(Join-Path $root 'current-erp-processes.before.json')-and$Hash-ceq$beforeHash){return ,([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject @($row) -Depth 10)))}
  elseif($Path-ceq(Join-Path $oldCore 'owner-manifest.json')-and$Hash-ceq$coreHash){$o=$cm}
  elseif($Path-ceq(Join-Path $oldRouter 'owner-manifest.json')-and$Hash-ceq$routerHash){$o=$rm}
  else{throw 'FIXTURE_FOREIGN_PINNED_READ'};return ,([Text.Encoding]::UTF8.GetBytes(($o|ConvertTo-Json -Depth 20)))
 }
 $v=Get-Business5244CurrentBootstrapPins $beforeHash -ScopeName 'TEST125-API-B6-WRITER-20261029';if($v.pid-ne52420-or$v.ownerPid-ne45612-or$v.birth-cne'134377689444377841'-or$v.root-cne$fixed.root){throw 'WEB_ONLY_BOOTSTRAP_MIXED'}
 foreach($kind in @('before','kind','api','source')){$saved=$capture|ConvertTo-Json -Depth 20;$hash=$beforeHash;switch($kind){before{$hash='0'*64}kind{$capture.predecessorEntryKind='CurrentCore'}api{$capture.installedApiManifest='0'*64}source{$capture.entry.root=$oldCore}};$denied=$false;try{Get-Business5244CurrentBootstrapPins $hash -ScopeName 'TEST125-API-B6-WRITER-20261029'|Out-Null}catch{$denied=$true};if(!$denied){throw 'WEB_ONLY_BOOTSTRAP_DRIFT_ACCEPTED'};$capture=$saved|ConvertFrom-Json}
 'PASS'`;
 assert.equal(run(body),'PASS');
});
