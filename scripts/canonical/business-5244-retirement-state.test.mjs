import test from 'node:test';import assert from 'node:assert/strict';import cp from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const q=s=>"'"+s.replaceAll("'","''")+"'";
// Production lease logic runs against per-invocation local resources only.
const isolatedStartup=String.raw`function Get-Business5244StartupMutexName{return ('Local\MelisaRetirementFixture-'+[IO.Path]::GetFileName($env:TEMP))};function Get-Business5244RetirementPendingPath{return (Join-Path $env:TEMP 'fixture.retirement.pending')};`;
const setup=`$ErrorActionPreference='Stop';. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;. ${q(path.join(dir,'start-business-5244-web.ps1'))} -Library;. ${q(path.join(dir,'business-5244-retirement-state.ps1'))} -Library;${isolatedStartup}Add-Type -LiteralPath ${q(path.join(dir,'business-5244-web-native.cs'))};$lease=Enter-Business5244StartupLease -Kind Owner;$pins=Get-Business5244ReadPairPins;$script=Join-Path $env:TEMP 'sleep.ps1';[IO.File]::WriteAllText($script,'Start-Sleep -Seconds 300');function New-TestChild{$n=[Business5244WebNative]::new();$n.Spawn((Join-Path $PSHOME 'powershell.exe'),('-NoProfile -NonInteractive -File "'+$script+'"'),$env:TEMP);return $n};$native=New-TestChild;$state=Register-Business5244OwnedRetirement $lease $native $pins;$rows=@([pscustomobject]@{port=4194;pid=111;entry='keep-api';root='preserved-api'},[pscustomobject]@{port=4196;pid=112;entry='keep-native';root='preserved-native'},[pscustomobject]@{port=5244;pid=$native.ChildPid;entry='vite-preview';sourceCommit=$pins.frontendSource;root=$pins.root;backendPort=4144;businessWorkfaceId=$pins.profile});$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));$recordPath=Join-Path $env:TEMP 'records.json';$pendingPath=Join-Path $env:TEMP 'retirement.pending';$records=$null;$pending=$null;$replacement=$null;`;
const cleanup=`finally{Close-Business5244RetirementState $state;if($replacement){$replacement.Dispose()};if($records){$records.Dispose()};if($pending){$pending.Dispose()};$native.Dispose();Exit-Business5244StartupLease -Lease $lease};'PASS'`;
function run(body){const temp=fs.mkdtempSync(path.join(os.tmpdir(),'erp-5244-retirement-state-'));try{const file=path.join(temp,'run.ps1');fs.writeFileSync(file,body);return cp.execFileSync(ps,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',timeout:20000,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,PATH:path.join(process.env.SystemRoot??'C:/Windows','System32'),TEMP:temp,TMP:temp}}).trim();}finally{fs.rmSync(temp,{recursive:true,force:true});}}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
const streams=`[IO.File]::WriteAllBytes($recordPath,$before);$records=[IO.File]::Open($recordPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$pending=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);`;
const b6Setup=setup.replace('$lease=Enter-Business5244StartupLease',"function Get-Business5244StartupMutexName{return ('Local\\MelisaB6Bootstrap-'+[IO.Path]::GetFileName($env:TEMP))};$lease=Enter-Business5244StartupLease").replace('Register-Business5244OwnedRetirement $lease $native $pins;','Register-Business5244OwnedRetirement $lease $native $pins -ScopeName \'TEST125-API-B6-ca620bac-20261028\';')+String.raw`
. __NATIVE_PROFILE__
function Assert-Business5244CreatedChild($Native,$Pins){$Native.Validate();if(!$Native.ChildAlive()){throw 'ISOLATED_CHILD_NOT_ALIVE'}}
function Assert-Business5244ReadyChild($Native,$Pins){Assert-Business5244CreatedChild $Native $Pins}
$script:oldChildPresent=$false;$script:oldOwnerPresent=$false
function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'){throw 'ISOLATED_WRONG_CIM'};if($Filter-ceq'ProcessId=35268'){if($script:oldChildPresent){return @{ProcessId=35268}}}elseif($Filter-ceq'ProcessId=9512'){if($script:oldOwnerPresent){return @{ProcessId=9512}}}else{throw 'ISOLATED_FOREIGN_PID_READ'}}
$rows[2].pid=35268;$before=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 20));$beforeHash=Get-Business5244StartupHash $before
$captureDir=Join-Path $env:TEMP 'capture';[void][IO.Directory]::CreateDirectory($captureDir);$capturePath=Join-Path $captureDir 'current-read2b-owner-capture.json';$imagePath=Join-Path $captureDir 'current-erp-processes.before.json';[IO.File]::WriteAllBytes($imagePath,$before)
$capture=[pscustomobject]@{schema='melisa-b6-current-read2b-owner-capture.v1';predecessorEntryKind='CurrentCore';entry=@{root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261028';leaf='run-current-owner.ps1';manifestSha256='f6c48a1626d281699e14d783b641fcc95ccf9a9de5ad286332b8a1d9e18da235';sha256='b9e9f0661c3349e8a1b56b17460bffbc776fa7990115cba1c04602a3367641cb'};readOnly=$true;stopAuthorized=$false;recordPath='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';recordBeforeFile='current-erp-processes.before.json';recordBeforeSha256=$beforeHash;webRecord=$rows[2];child=@{pid=35268;parent=9512;birth='134377042376772453';exe=$pins.node};owner=@{pid=9512;birth='134377040921549383'};nativeStatus=@{reply='Status';nativePeerVerified=$true;stopAuthorized=$false;childObservationOnly=$true;state=@{phase='Running';ownerPid=9512;ownerBirth='134377040921549383';childPid=35268;childBirth='134377042376772453'}};installedApiManifest=$pins.apiManifest;installedWebManifest=$pins.manifest;serviceCalls=0;sqlCalls=0;retireCalls=0}
$captureBytes=[Text.Encoding]::UTF8.GetBytes(($capture|ConvertTo-Json -Depth 20));[IO.File]::WriteAllBytes($capturePath,$captureBytes);$captureHash=Get-Business5244StartupHash $captureBytes
# Only the three immutable input literal pins are virtualized to files created
# by this fixture. The production file hash/reparse validation, metadata gates,
# held CAS, real creation handle and durable publication functions execute.
$getPins=(Get-Command Get-Business5244CurrentBootstrapPins).Definition.Replace('C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\recovered-owner-20261029\current-read2b-owner-capture.json',$capturePath).Replace('9e5f95931caf67bfe3cfa100a755b0b2324a77caf244bfa99da90b9f1d621605',$captureHash).Replace('ea23776035feadb3f206eeed1dae016eb80de0a325fc3978ac9d534a73f251e2',$beforeHash)
. ([scriptblock]::Create('function Get-Business5244CurrentBootstrapPins {'+$getPins+'}'))
`.replace('__NATIVE_PROFILE__',q(path.join(dir,'canonical-business-sale-maintenance.ps1')));
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
 $published=ConvertFrom-Business5244RecordBytes $after;if($published[2].pid-ne$native.ChildPid-or$published[2].pid-eq35268-or$published[0].pid-ne111-or$published[1].pid-ne112-or@([IO.Directory]::GetFiles($env:TEMP,'*.bootstrap.completed')).Count-ne1){throw 'B6_BOOTSTRAP_SCOPE'}
 }`+cleanup),'PASS');
});
for(const mode of ['child','owner'])win(`B6 predecessor ${mode} still alive rejects metadata publication without touching either process`,()=>{
 assert.equal(run(b6Setup+`try{${streams}$script:${mode==='child'?'oldChildPresent':'oldOwnerPresent'}=$true;$denied=$false;try{Publish-Business5244HeldCurrentRecord $state $records $pending|Out-Null}catch{if($_.Exception.Message-cne'${mode==='child'?'CURRENT_BOOTSTRAP_OLD_PID_PRESENT':'CURRENT_BOOTSTRAP_OLD_OWNER_PRESENT'}'){throw};$denied=$true};if(!$denied-or!$native.ChildAlive()-or$pending.Length-ne0-or(Get-Business5244StartupHash (Read-Business5244RetirementBytes $records))-cne$beforeHash){throw 'B6_LIVE_PREDECESSOR_CHANGED'}}`+cleanup),'PASS');
});
for(const mode of ['entry-kind','old-owner','old-child'])win(`B6 recovered CurrentCore rejects ${mode} even with matching isolated capture hash`,()=>{
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
 $restored=ConvertFrom-Business5244RecordBytes (Read-Business5244RetirementBytes $records);if($restored[2].pid-ne35268-or($restored[0]|ConvertTo-Json -Compress)-cne$beforeOther-or@([IO.Directory]::GetFiles($env:TEMP,'*.init-undone.completed')).Count-ne1){throw 'INIT_INVERSE_SCOPE'}
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
