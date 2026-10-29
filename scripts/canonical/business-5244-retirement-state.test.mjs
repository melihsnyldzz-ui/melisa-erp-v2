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
