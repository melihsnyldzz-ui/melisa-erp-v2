import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const root=import.meta.dirname,script=path.join(root,'clean-b5-pair-transition.ps1').replaceAll("'","''"),fixture=path.join(root,'clean-b5-pair-transition.fixture.ps1').replaceAll("'","''"),template=path.join(root,'clean-b5-pair-start.template.ps1').replaceAll("'","''");
const ps=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
function runWin(body,timeout=30000){const pre=String.raw`$ErrorActionPreference='Stop';. '${script}' -Library;function Get-NetTCPConnection{throw 'LIVE_NETWORK_FORBIDDEN'};function Get-CimInstance{throw 'LIVE_PROCESS_FORBIDDEN'};function Invoke-RestMethod{throw 'LIVE_HTTP_FORBIDDEN'};function Invoke-WebRequest{throw 'LIVE_HTTP_FORBIDDEN'};function Start-Process{throw 'LIVE_SPAWN_FORBIDDEN'};function Stop-Process{throw 'LIVE_STOP_FORBIDDEN'};function Invoke-CimMethod{throw 'LIVE_CIM_FORBIDDEN'};`;const out=execFileSync(ps,['-NoProfile','-NonInteractive','-Command',pre+body],{encoding:'utf8',timeout,windowsHide:true,stdio:['ignore','pipe','pipe']});assert.equal(out.trim(),'PASS',out);}
const win=(name,body)=>test(name,{skip:process.platform!=='win32'},()=>runWin(body));
const setup=String.raw`$script:fixtureTemplate='${template}';. '${fixture}';$c=Reset-B5Fixture;`;
const oneOffSetup=setup+String.raw`
 Add-Type -TypeDefinition 'public sealed class B5OneOffMemoryFixture:System.IO.MemoryStream{public void Flush(bool flushToDisk){base.Flush();}}'
 $p=Get-B5Pins;$script:onePins=$p;function Get-B5Pins{return $script:onePins}
 $script:newStarter=[Text.Encoding]::UTF8.GetBytes('fixed-composite-starter');$script:onePins.oneOffStarter=B5Hash $script:newStarter
 $c.stopped=@(4194,5244);$script:witnessLive=$true;$script:writeCount=0;$script:spawnCount=0;$script:failure='';$script:apiMode='Candidate'
 function Get-B5WriterHandoff{throw 'GENERIC_HANDOFF_MUST_NOT_RUN'}
 function Assert-B5Lease($Lease){throw 'GENERIC_LEASE_MUST_NOT_RUN'}
 function Assert-B5Path($Path){if(!$Path.StartsWith('C:\Sirket\ERP\')){throw 'FIXTURE_PATH_SCOPE'}}
 function Get-B5HeldPublicationStream($Scope,$Name){if($Name -cnotin @('starter','records') -or !$Scope.streams[$Name].CanRead){throw 'B5_HELD_CONTROL_STREAM'};return $Scope.streams[$Name]}
 function Assert-B5HeldPublicationChildren($Scope){foreach($child in $Scope.context.children){if($child.handle.disposed -or !$script:fx.processes.ContainsKey([int]$child.facts.pid)){throw 'B5_HELD_CHILD_IDENTITY'}}}
 function New-B5OsChild($FilePath,$ArgumentList,$WorkingDirectory,$RedirectStandardOutput,$RedirectStandardError){
  $script:spawnCount++;$script:fx.next++;$id=$script:fx.next;$port=if($WorkingDirectory -like '*sites-workflow'){5244}else{4194};$root=if($script:apiMode -eq 'Candidate'){$p.root}elseif($port -eq 4194){$p.oldApiRoot}else{$p.oldWebRoot}
  $script:fx.processes[$id]=New-B5FixtureFacts $id $root $port;return [pscustomobject]@{Id=$id}
 }
 function Capture-B5OneOffApiChild($Scope,$Process,$Mode){if($script:failure -eq 'capture'){throw 'FIXTURE_CAPTURE_OPEN_FAILED'};$facts=$script:fx.processes[$Process.Id];$h=Open-B5BoundProcess $facts;$child=@{port=4194;facts=$facts;handle=$h;mode=$Mode;parentChecked=$true};$Scope.context.children+=,$child;return $child}
 function Fx-OneOffRow($child){$candidate=$child.mode -ceq 'Candidate';$row=[ordered]@{port=$child.port;pid=$child.facts.pid;entry=$(if($child.port -eq 4194){'cleanSyntheticServer.mjs'}else{'vite-preview'});sourceCommit=$(if($candidate){$p.source}elseif($child.port -eq 4194){$p.oldApi}else{$p.oldWeb})};if($child.port -eq 4194){$row.packageId=if($candidate){'candidate-package'}else{'old-api-package'}};$row.root=if($candidate){$p.root}elseif($child.port -eq 4194){$p.oldApiRoot}else{$p.oldWebRoot};return $row}
 function Invoke-B5OneOffNormalApiStarter($StarterFile){
  $root=if($script:apiMode -eq 'Candidate'){$p.root}else{$p.oldApiRoot};$process=Start-Process -FilePath $p.node -ArgumentList @('src\cleanSyntheticServer.mjs') -WorkingDirectory ($root+'\apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput 'fixture.out' -RedirectStandardError 'fixture.err'
  $lines=[IO.File]::ReadAllText('${template}') -split "\r?\n";$startPorts=@(4194);$newProcesses=@((Fx-OneOffRow $c.children[-1]));$cleanRoot=Split-Path $p.runtime -Parent
  $line=@($lines|Where-Object {$_ -like '$oldRecords=*'})[0];. ([scriptblock]::Create($line))
  $first=Get-Content -LiteralPath (Join-Path $p.runtime 'erp-processes.json') -Raw
  if(@(ConvertFrom-B5Records ([Text.Encoding]::UTF8.GetBytes($first))|Where-Object pid -eq $process.Id).Count -ne 1){throw 'RAM_FIRST_WRITE_NOT_VISIBLE'}
  $line=@($lines|Where-Object {$_ -like ' $newProcesses+=@(*'})[0];. ([scriptblock]::Create($line))
  $line=@($lines|Where-Object {$_ -like 'ConvertTo-Json -InputObject @($newProcesses)*'})[0];. ([scriptblock]::Create($line))
 }
 $script:candidatePath='C:\Sirket\ERP\evidence\fixture\candidate.ps1';$script:rollbackPath='C:\Sirket\ERP\evidence\fixture\rollback.ps1'
 $script:fx.files[$script:candidatePath]=$script:newStarter;$script:fx.files[$script:rollbackPath]=$c.controls.starter
 $script:realHeldCas=(Get-Command Write-B5HeldPublicationCas -CommandType Function).ScriptBlock
 function Write-B5HeldPublicationCas($Scope,$Name,$Expected,$Bytes){
  if($Name -eq 'records' -and $script:failure -eq 'record-before'){throw 'FIXTURE_RECORD_WRITE_FAILED'}
  if($Name -eq 'records' -and $script:failure -eq 'partial'){$s=$Scope.streams.records;$s.SetLength(0);$s.WriteByte(33);$script:writeCount++;throw 'FIXTURE_PARTIAL_WRITE'}
  & $script:realHeldCas $Scope $Name $Expected $Bytes;$script:writeCount++
  if(($Name -eq 'records' -and $script:failure -eq 'lost-ack') -or ($script:failure -ceq ('inverse-ack-'+$Name))){$script:failure='';throw 'FIXTURE_RESPONSE_LOST'}
 }
 function Fx-OneOffScope{
  $a=[B5OneOffMemoryFixture]::new();$a.Write($c.controls.starter,0,$c.controls.starter.Length);$a.Position=0
  $b=[B5OneOffMemoryFixture]::new();$b.Write($c.controls.records,0,$c.controls.records.Length);$b.Position=0
  return (New-B5HeldPublication $c $a $b {param($scope)if(!$script:witnessLive){throw 'FIXTURE_WITNESS_LOST'};if($scope.context.controlHash -cne $scope.expected.starter -or $scope.context.recordHash -cne $scope.expected.records){throw 'FIXTURE_REAL_CONTEXT_HASH_STALE'}})
 }
 function Fx-OneOffAddWeb{
  $root=if($script:apiMode -eq 'Candidate'){$p.root}else{$p.oldWebRoot};$process=New-B5OsChild $p.node @() ($root+'\apps\sites-workflow') 'fixture.out' 'fixture.err';$facts=$script:fx.processes[$process.Id];$h=Open-B5BoundProcess $facts
  $c.children+=,@{port=5244;facts=$facts;handle=$h;mode=$(if($script:apiMode -eq 'Candidate'){'Candidate'}else{'OldPair'})}
  $native=@(ConvertFrom-B5Records $c.controls.records|Where-Object port -eq 4196)[0]
  $rows=@((Fx-OneOffRow $c.children[0]),(Fx-OneOffRow $c.children[1]),$native)
  Set-B5OwnedRecordStage $c ([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $rows -Depth 8)))
 }
`;
win('one-off API entry stages both actual record statements and replay uses the same captured child',oneOffSetup+String.raw`
 $scope=Fx-OneOffScope;$before=$c.recordHash
 Start-B5OneOffApiWithRecordView $scope $script:candidatePath
 if($script:spawnCount -ne 1 -or $c.children.Count -ne 1 -or $c.recordHash -cne $before -or (B5Hash (Read-B5HeldPublicationBytes $scope 'records')) -cne $before -or $script:writeCount){throw 'ONEOFF_STAGE_WROTE_DISK'}
 $same=$c.children[0];Start-B5OneOffApiWithRecordView $scope $script:candidatePath
 if($script:spawnCount -ne 1 -or ![object]::ReferenceEquals($same,$c.children[0])){throw 'ONEOFF_REPLAY_SPAWNED'}
 $rejected=$false;try{Publish-B5HeldControls $scope $script:newStarter $c.stagedRecordBytes}catch{$rejected=$true;if($_.Exception.Message -ne 'B5_FINAL_RECORD_MISSING_CHILD'){throw}};if(!$rejected -or $script:writeCount){throw 'API_ONLY_PUBLISHED_AS_PAIR'};'PASS'`);
win('one-off held two-file publication reconciles lost ACK without duplicate writes or child adoption',oneOffSetup+String.raw`
 $scope=Fx-OneOffScope;Start-B5OneOffApiWithRecordView $scope $script:candidatePath;Fx-OneOffAddWeb;$script:failure='lost-ack'
 $failed=$false;try{Publish-B5HeldControls $scope $script:newStarter $c.stagedRecordBytes}catch{$failed=$true;if($_.Exception.Message -ne 'FIXTURE_RESPONSE_LOST'){throw}};if(!$failed -or $script:writeCount -ne 2){throw 'LOST_ACK_EFFECT'}
 $children=@($c.children);Publish-B5HeldControls $scope $script:newStarter $c.stagedRecordBytes
 if($script:writeCount -ne 2 -or $scope.phase -cne 'Committed' -or $c.recordHash -cne $c.stagedRecordHash){throw 'LOST_ACK_NOT_RECONCILED'}
 Publish-B5HeldControls $scope $script:newStarter $c.stagedRecordBytes;Start-B5OneOffApiWithRecordView $scope $script:candidatePath
 if($script:writeCount -ne 2 -or $script:spawnCount -ne 2 -or ![object]::ReferenceEquals($children[0],$c.children[0])){throw 'PUBLICATION_REPLAY_EFFECT'}
 $bad=@(ConvertFrom-B5Records $c.stagedRecordBytes);$bad[0].pid=777;$rejected=$false;try{Set-B5OwnedRecordStage $c ([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $bad -Depth 8)))}catch{$rejected=$true};if(!$rejected){throw 'OBSERVED_PID_ADOPTED'};'PASS'`);
win('one-off second control write failure has exact inverse and repeated inverse is inert',oneOffSetup+String.raw`
 $scope=Fx-OneOffScope;Start-B5OneOffApiWithRecordView $scope $script:candidatePath;Fx-OneOffAddWeb;$script:failure='record-before'
 $failed=$false;try{Publish-B5HeldControls $scope $script:newStarter $c.stagedRecordBytes}catch{$failed=$true};if(!$failed -or $script:writeCount -ne 1){throw 'SECOND_WRITE_FAILURE_NOT_PARTIAL'}
 $script:failure='';Undo-B5HeldPublication $scope
 foreach($name in @('starter','records')){if((B5Hash (Read-B5HeldPublicationBytes $scope $name)) -cne $scope.beforeHash[$name]){throw 'INVERSE_NOT_EXACT'}}
 $count=$script:writeCount;Undo-B5HeldPublication $scope;if($script:writeCount -ne $count -or $script:spawnCount -ne 2){throw 'INVERSE_REPLAY_EFFECT'};'PASS'`);
win('one-off unknown partial write foreign bytes and lost witness fail closed',oneOffSetup+String.raw`
 $scope=Fx-OneOffScope;Start-B5OneOffApiWithRecordView $scope $script:candidatePath;Fx-OneOffAddWeb;$script:failure='partial'
 try{Publish-B5HeldControls $scope $script:newStarter $c.stagedRecordBytes}catch{};$count=$script:writeCount
 $failed=$false;try{Undo-B5HeldPublication $scope}catch{$failed=$true;if($_.Exception.Message -ne 'B5_HELD_PARTIAL_WRITE_UNCERTAIN'){throw}};if(!$failed -or $script:writeCount -ne $count){throw 'UNCERTAIN_WRITE_OVERWRITTEN'}
 $c.controlHash=B5Hash $c.controls.starter;$c.recordHash=B5Hash $c.controls.records;$scope2=Fx-OneOffScope;$script:failure='';$script:witnessLive=$false
 $failed=$false;try{Publish-B5HeldControls $scope2 $script:newStarter $c.stagedRecordBytes}catch{$failed=$true;if($_.Exception.Message -ne 'FIXTURE_WITNESS_LOST'){throw}};if(!$failed -or $script:writeCount -ne $count){throw 'WITNESS_LOSS_MUTATION'}
 $script:witnessLive=$true;$scope3=Fx-OneOffScope;$script:failure='record-before';try{Publish-B5HeldControls $scope3 $script:newStarter $c.stagedRecordBytes}catch{}
 $foreign=[Text.Encoding]::UTF8.GetBytes('foreign');$scope3.streams.starter.SetLength(0);$scope3.streams.starter.Write($foreign,0,$foreign.Length);$count=$script:writeCount
 $failed=$false;try{Undo-B5HeldPublication $scope3}catch{$failed=$true;if($_.Exception.Message -ne 'B5_HELD_CONTROL_RACE'){throw}};if(!$failed -or $script:writeCount -ne $count -or (B5Hash (Read-B5HeldPublicationBytes $scope3 'starter')) -cne (B5Hash $foreign)){throw 'FOREIGN_BYTES_OVERWRITTEN'};'PASS'`);
win('one-off API then web failure preserves disk and rollback publishes real new rollback child rows once',oneOffSetup+String.raw`
 $scope=Fx-OneOffScope;Start-B5OneOffApiWithRecordView $scope $script:candidatePath;$ownApi=$c.children[0]
 if($script:writeCount -or $scope.phase -cne 'Staging'){throw 'API_PARTIAL_ALREADY_PUBLISHED'}
 # The already-authorized one-off caller compensates its captured child;
 # publication itself never discovers/adopts a PID or stops an old process.
 Stop-B5Handle $ownApi.handle $ownApi.facts;$ownApi.handle.Dispose();$c.children=@();Undo-B5HeldPublication $scope
 $rollback=New-B5HeldPublication $c $scope.streams.starter $scope.streams.records {param($s)if(!$script:witnessLive){throw 'FIXTURE_WITNESS_LOST'}}
 $script:apiMode='OldPair';Start-B5OneOffApiWithRecordView $rollback $script:rollbackPath -Mode Rollback;Fx-OneOffAddWeb
 Publish-B5HeldControls $rollback $c.controls.starter $c.stagedRecordBytes
 $actual=@(ConvertFrom-B5Records (Read-B5HeldPublicationBytes $rollback 'records'))
 if(@($actual|Where-Object {$_.port -in @(4194,5244) -and $_.pid -in @(101,102)}).Count -or @($actual|Where-Object {$_.port -eq 4196 -and $_.pid -eq 103}).Count -ne 1){throw 'ROLLBACK_PUBLISHED_DEAD_OR_NATIVE_PID'}
 $count=$script:writeCount;$spawns=$script:spawnCount;$stops=@($script:fx.events|Where-Object {$_ -like 'stop-*'}).Count
 Undo-B5HeldPublication $scope;Publish-B5HeldControls $rollback $c.controls.starter $c.stagedRecordBytes
 if($script:writeCount -ne $count -or $script:spawnCount -ne $spawns -or @($script:fx.events|Where-Object {$_ -like 'stop-*'}).Count -ne $stops){throw 'ROLLBACK_SECOND_CALL_EFFECT'};'PASS'`);
win('one-off inverse lost ACK at first or last write preserves exact context and repeat has no duplicate effect',oneOffSetup+String.raw`
 foreach($lost in @('records','starter')){
  $c=Reset-B5Fixture;$c.stopped=@(4194,5244);$script:fx.files[$script:candidatePath]=$script:newStarter;$script:fx.files[$script:rollbackPath]=$c.controls.starter
  $scope=Fx-OneOffScope;Start-B5OneOffApiWithRecordView $scope $script:candidatePath;Fx-OneOffAddWeb;Publish-B5HeldControls $scope $script:newStarter $c.stagedRecordBytes
  $script:failure='inverse-ack-'+$lost;$failed=$false;try{Undo-B5HeldPublication $scope}catch{$failed=$true;if($_.Exception.Message -ne 'FIXTURE_RESPONSE_LOST'){throw}};if(!$failed){throw 'INVERSE_LOST_ACK_NOT_EXERCISED'}
  if($c.controlHash -cne $scope.expected.starter -or $c.recordHash -cne $scope.expected.records){throw 'INVERSE_CONTEXT_NOT_RECONCILED'}
  $count=$script:writeCount;Undo-B5HeldPublication $scope;$expectedRemaining=if($lost -eq 'records'){1}else{0}
  if($script:writeCount -ne ($count+$expectedRemaining)){throw 'INVERSE_DUPLICATE_WRITE'}
  foreach($name in @('starter','records')){if((B5Hash (Read-B5HeldPublicationBytes $scope $name)) -cne $scope.beforeHash[$name]){throw 'INVERSE_LOST_ACK_NOT_EXACT'}}
  $count=$script:writeCount;Undo-B5HeldPublication $scope;if($script:writeCount -ne $count){throw 'FINAL_INVERSE_REPLAY_EFFECT'}
 };'PASS'`);
win('one-off OS receipt survives failed capture and cannot trigger a duplicate spawn or unknown stop',oneOffSetup+String.raw`
 $scope=Fx-OneOffScope;$script:failure='capture';$failed=$false;try{Start-B5OneOffApiWithRecordView $scope $script:candidatePath}catch{$failed=$true;if($_.Exception.Message -ne 'FIXTURE_CAPTURE_OPEN_FAILED'){throw}}
 if(!$failed -or $script:spawnCount -ne 1 -or $c.children.Count -or !$scope.pendingApiSpawn.process -or $scope.pendingApiSpawn.capturedChild){throw 'PENDING_OS_RECEIPT_LOST'}
 $receipt=$scope.pendingApiSpawn.process;$failed=$false;try{Start-B5OneOffApiWithRecordView $scope $script:candidatePath}catch{$failed=$true;if($_.Exception.Message -ne 'B5_ONEOFF_API_CAPTURE_PENDING'){throw}}
 if(!$failed -or $script:spawnCount -ne 1 -or ![object]::ReferenceEquals($receipt,$scope.pendingApiSpawn.process) -or @($script:fx.events|Where-Object {$_ -like 'stop-*'}).Count -or $script:writeCount){throw 'PENDING_RECEIPT_ADOPTED_OR_DUPLICATED'};'PASS'`);
win('review old recovery locks use their own pinned raw bytes without converting CRLF',String.raw`
 $p=Get-B5Pins;$script:pins=$p;function Get-B5Pins{return $script:pins}
 $crlf=[string][char]13+[char]10;$lfOnly=[string][char]10
 $raw=[Text.Encoding]::UTF8.GetBytes('{'+$crlf+'}'+$crlf);$lf=[Text.Encoding]::UTF8.GetBytes('{'+$lfOnly+'}'+$lfOnly);$script:raw=$raw
 $deps=@(foreach($app in @('api','sites-workflow','web-admin')){[pscustomobject]@{app=$app;files=1;inventorySha256=('a'*64);lockSha256=(B5Hash $lf)}})
 $own=@(foreach($app in @('api','sites-workflow','web-admin')){[pscustomobject]@{path=('apps/'+$app+'/package-lock.json');sha256=(B5Hash $raw)}})
 $old=[pscustomobject]@{sourceCommit=$p.oldApi;files=$own}
 $donor=[pscustomobject]@{dependencies=$deps;dependencyDonorManifestSha256=$p.oldApiHash}
 $script:donorBytes=[Text.Encoding]::UTF8.GetBytes(($donor|ConvertTo-Json -Depth 8));$script:pins.dependencyManifest=B5Hash $script:donorBytes
 function Assert-B5Manifest($Manifest,$Source,[switch]$Combined){}
 function B5ReadFrozen($Path,$Lease){if($Path -ceq (Join-Path $script:pins.dependencyRoot 'release-manifest.json')){return ,$script:donorBytes};if($Path.EndsWith('release-manifest.json')){throw 'UNEXPECTED_DONOR_READ'};return ,$script:raw}
 function Get-B5DependencyFiles($Base){return [pscustomobject]@{path='fixture.js';full=(Join-Path $Base 'fixture.js')}}
 function Get-B5DependencyDigest($Rows){return ('a'*64)}
 function Get-B5ModuleLookupDirectories($Root,$Manifest){return 'C:\fixture\node_modules'}
 function Assert-B5ModuleLookupContext($Context){}
 Read-B5Dependencies $p.oldApiRoot $old $null
 foreach($bad in @('missing','duplicate','changed')){
  $old.files=if($bad -eq 'missing'){@($own|Select-Object -Skip 1)}elseif($bad -eq 'duplicate'){@($own)+@($own[0])}else{@(foreach($f in $own){[pscustomobject]@{path=$f.path;sha256=('b'*64)}})}
  $failed=$false;try{Read-B5Dependencies $p.oldApiRoot $old $null}catch{$failed=$true};if(!$failed){throw ('OWN_RAW_LOCK_NOT_PINNED_'+$bad)}
 };'PASS'`);

test('review Node intermediate and ancestor shadows are rejected before and after dependency freeze',{skip:process.platform!=='win32'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'b5-shadow-')),dir=fs.realpathSync.native(temp),hash=b=>createHash('sha256').update(b).digest('hex');
 const pack=path.join(dir,'owned','package'),files=[],deps=[];
 for(const app of ['api','sites-workflow','web-admin']){const base=path.join(pack,'apps',app);fs.mkdirSync(path.join(base,'node_modules','mssql'),{recursive:true});fs.writeFileSync(path.join(base,'node_modules','mssql','index.js'),'throw new Error("MUST_NOT_EXECUTE")');fs.writeFileSync(path.join(base,'package-lock.json'),'{}');const row={path:'mssql/index.js',sha256:hash(fs.readFileSync(path.join(base,'node_modules','mssql','index.js')))};files.push({path:`apps/${app}/package-lock.json`,sha256:hash('{}')});deps.push({app,files:1,inventorySha256:hash(JSON.stringify([row])),lockSha256:hash('{}')});}
 const entry=path.join(pack,'apps','api','src','services','entry.js');fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(entry,'// Not executed');files.push({path:'apps/api/src/services/entry.js',sha256:hash('// Not executed')});
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64'),quote=v=>v.replaceAll("'","''"),node=fs.realpathSync.native(process.execPath);
 try{runWin(String.raw`
  $p=Get-B5Pins;$script:pins=$p;$script:pins.root='${quote(pack)}';$script:pins.node='${quote(node)}';$script:pins.nodeHash='${hash(fs.readFileSync(node)).toUpperCase()}'
  function Get-B5Pins{return $script:pins};function Assert-B5Lease($Lease){}
  function Assert-B5Path($Path){$full=[IO.Path]::GetFullPath($Path);if($full -cne $script:pins.node -and !$full.StartsWith('${quote(dir)}\',[StringComparison]::OrdinalIgnoreCase)){throw 'FIXTURE_PATH_ESCAPE'};Assert-B5NoReparse $full}
  # CI TEMP is under hidden AppData; read its actual attributes, preserving
  # reparse rejection and the exact fixture path restriction above.
  function Get-Item{param($LiteralPath,[switch]$Force);return Microsoft.PowerShell.Management\Get-Item -LiteralPath $LiteralPath -Force}
  [IO.File]::SetAttributes('${quote(dir)}',([IO.File]::GetAttributes('${quote(dir)}') -bor [IO.FileAttributes]::Hidden))
  $m=[pscustomobject]@{sourceCommit=$p.source;files=(ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${enc(files)}'))));dependencies=(ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${enc(deps)}'))))}
  $lease=[pscustomobject]@{resources=(New-Object Collections.Generic.List[IDisposable])}
  try{
   Read-B5Dependencies $script:pins.root $m $lease;Assert-B5DependencyDirectories $lease
   foreach($relative in @('apps\api\src\services\node_modules','apps\api\src\node_modules','apps\api\node_modules\mssql\node_modules','apps\node_modules','node_modules','..\node_modules')){
    $shadow=[IO.Path]::GetFullPath((Join-Path $script:pins.root $relative))
    if(!$shadow.StartsWith('${quote(dir)}\',[StringComparison]::OrdinalIgnoreCase)){throw 'FIXTURE_DELETE_PATH_ESCAPE'}
    # Nested under sealed node_modules is independently rejected by its inventory.
    $null=[IO.Directory]::CreateDirectory((Join-Path $shadow 'mssql'));[IO.File]::WriteAllText((Join-Path $shadow 'mssql\index.js'),'throw "MUST_NOT_EXECUTE"')
    if($relative -ceq 'apps\api\src\services\node_modules'){
     $resolved=& $script:pins.node -e "process.stdout.write(require('node:module').createRequire(process.argv[1]).resolve('mssql'))" '${quote(entry)}'
     if($LASTEXITCODE -ne 0 -or $resolved -ine (Join-Path $shadow 'mssql\index.js')){throw 'ACTUAL_NODE_SHADOW_NOT_PROVEN'}
     $fresh=[pscustomobject]@{resources=(New-Object Collections.Generic.List[IDisposable])};$initialBlocked=$false
     try{try{Read-B5Dependencies $script:pins.root $m $fresh}catch{$initialBlocked=$_.Exception.Message -ceq 'B5_DEPENDENCY_LOOKUP_SHADOW'}}finally{foreach($f in $fresh.resources){$f.Dispose()}}
     if(!$initialBlocked){throw 'INITIAL_SHADOW_ACCEPTED'}
    }
    $failed=$false;try{Assert-B5DependencyDirectories $lease}catch{$failed=$true}
    if(!$failed){throw ('SHADOW_PATH_ACCEPTED_'+$relative)}
    [IO.Directory]::Delete($shadow,$true)
   };Assert-B5DependencyDirectories $lease
   $saved=$lease.moduleSearchContexts[0].environment;$lease.moduleSearchContexts[0].environment='changed-fixture-stamp';$blocked=$false
   try{Assert-B5DependencyDirectories $lease}catch{$blocked=$_.Exception.Message -ceq 'B5_DEPENDENCY_LOOKUP_ENVIRONMENT_CHANGED'}
   if(!$blocked){throw 'LOOKUP_ENVIRONMENT_CHANGE_ACCEPTED'};$lease.moduleSearchContexts[0].environment=$saved
  }finally{foreach($f in $lease.resources){$f.Dispose()}};'PASS'`,60000);
 }finally{assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));assert.match(path.basename(temp),/^b5-shadow-/);fs.rmSync(temp,{recursive:true,force:true});}
});
win('production handoff is closed before any mutex, filesystem or runtime operation',String.raw`function Enter-B5Lease{throw 'MUTEX_MUST_NOT_RUN'};try{Invoke-B5CleanTransition;throw 'unexpected'}catch{if($_.Exception.Message -ne 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'){throw}};'PASS'`);
win('caller booleans and idle/empty-port claims are not a live lease or writer handoff',String.raw`foreach($claim in @([pscustomobject]@{exclusive=$true;writerIdle=$true;portsEmpty=$true},[pscustomobject]@{held=$true;handoff=$true})){$failed=$false;try{Assert-B5Lease $claim}catch{$failed=$true};if(!$failed){throw 'accepted forged lease'}};'PASS'`);
win('legacy mutex naming is reused without importing or widening the legacy runtime profile',String.raw`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${path.join(root,'start-owned-test.ps1').replaceAll("'","''")}',[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-ErpMutexName'},$true);. ([scriptblock]::Create($f.Extent.Text));if((Get-B5MutexName 'C:\fixture\repo' 'S-1-fixture') -cne (Get-ErpMutexName 'c:/fixture/repo/.' 'S-1-fixture')){throw 'mutex mismatch'};'PASS'`);
const manifest=String.raw`$p=Get-B5Pins;$m=[pscustomobject]@{sourceCommit=$p.source;database=$p.database;environmentId=$p.environment;synthetic=$true;actualT1=$false;externalOperations=$false;nativeSourceCommit=$p.native;kind='ERP_API_FRONTEND_COMPOSITE_OFFLINE';frontendPatchCommit=$p.frontendPatch;component='clean-erp-api-web';sourceTree=$p.tree;backendSourceCommit=$p.source;frontendSourceCommit=$p.source;frontendBuildApiBase='http://127.0.0.1:4194';nodeRuntime=[pscustomobject]@{path=$p.node;version='v24.19.0';sha256=$p.nodeHash.ToLowerInvariant()}};`;
win('green composite exact pins and actual template guards retain CSS rollback and closed gates',manifest+String.raw`
 if($p.manifest -cne '3AA51A25970B0EFE512E865B5572C0378931A5EB848E1AB81AB571F4DE19178F' -or $p.oldWebHash -cne '61328E6BCED8DE827C00A4672329B5FAE3E417FF04007E3B60549085B5A3BAB2' -or $p.dependencyManifest -cne '9614E9CF5747908D44FB5CEF181BA3D840820878FDBE6CF522BF0176E5C50059' -or $p.root -cnotlike '*GREENCOMBINED-OFFLINE' -or $p.oldWebRoot -cnotlike '*B6AUTHHEIGHT-WEBONLY'){throw 'GREEN_PIN_BINDING'}
 $text=[IO.File]::ReadAllText('${template}');if((B5Hash ([IO.File]::ReadAllBytes('${template}'))) -cne $p.template){throw 'GREEN_TEMPLATE_PIN'}
 if(([regex]::Matches($text,"throw 'B5_OFFLINE_SOURCE_ONLY: supported fresh clean-owner admission contract is missing; no runtime action permitted'")).Count -ne 1){throw 'GREEN_TEMPLATE_GATE_CHANGED'}
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'GREEN_TEMPLATE_SYNTAX'}
 $apiGuard=$ast.Find({param($n)$n -is [Management.Automation.Language.IfStatementAst] -and $n.Extent.Text -like 'if($apiManifest.kind*'},$true)
 $webGuard=$ast.Find({param($n)$n -is [Management.Automation.Language.IfStatementAst] -and $n.Extent.Text -like 'if($webManifest.kind*'},$true)
 if(!$apiGuard -or !$webGuard){throw 'GREEN_TEMPLATE_GUARD_MISSING'}
 function Get-FileHash{param($LiteralPath);if($LiteralPath -cne $p.node){throw 'UNEXPECTED_FIXTURE_HASH'};return [pscustomobject]@{Hash=$p.nodeHash}}
 $mainApiSource=$p.source;$cleanNode=$p.node;$apiManifest=$m;$webManifest=$m
 . ([scriptblock]::Create($apiGuard.Extent.Text));. ([scriptblock]::Create($webGuard.Extent.Text))
 foreach($field in @('kind','frontendPatchCommit','sourceTree','environmentId','backendSourceCommit')){
  $bad=$m.PSObject.Copy();$bad.$field='wrong';$apiManifest=$bad;$webManifest=$bad
  foreach($guard in @($apiGuard,$webGuard)){$rejected=$false;try{. ([scriptblock]::Create($guard.Extent.Text))}catch{$rejected=$true};if(!$rejected){throw ('GREEN_TEMPLATE_ACCEPTED_'+$field)}}
 };'PASS'`);
win('green current WEBONLY rollback verifies its one Sites inventory and absent API shadows',String.raw`
 $p=Get-B5Pins;$script:lock=[Text.Encoding]::UTF8.GetBytes('{}');$script:file=[Text.Encoding]::UTF8.GetBytes('fixture');$lockHash=B5Hash $script:lock
 $d=[pscustomobject]@{app='sites-workflow';files=1;inventorySha256=('a'*64);lockSha256=$lockHash}
 $m=[pscustomobject]@{component='clean-erp-web';kind='ERP_FRONTEND_ONLY';sourceCommit=$p.oldWeb;frontendSourceCommit=$p.oldWeb;backendSourceCommit=$p.oldApi;frontendPatchCommit=$p.frontendPatch;dependencies=@($d);files=@([pscustomobject]@{path='apps/sites-workflow/package-lock.json';sha256=$lockHash})}
 $script:site=Join-Path $p.oldWebRoot 'apps\sites-workflow\node_modules';$script:api=Join-Path $p.oldWebRoot 'apps\api\node_modules';$script:web=Join-Path $p.oldWebRoot 'apps\web-admin\node_modules';$script:shadow='';$script:digest='a'*64
 function B5ReadFrozen($Path,$Lease){if($Path -ceq (Join-Path $script:site 'fixture.js')){return ,$script:file};if($Path -ceq (Join-Path $p.oldWebRoot 'apps\sites-workflow\package-lock.json')){return ,$script:lock};throw 'UNEXPECTED_FIXTURE_READ'}
 function Get-B5DependencyFiles($Base){if($Base -cne $script:site){throw 'WEBONLY_READ_UNRELATED_APP'};return [pscustomobject]@{path='fixture.js';full=(Join-Path $Base 'fixture.js')}}
 function Get-B5DependencyDigest($Rows){return $script:digest}
 function Get-B5LookupEnvironmentStamp{return 'fixture-env'}
 function Get-B5ModuleLookupDirectories($Root,$Manifest){return @($script:site,$script:api,$script:web)}
 function Test-Path{param($LiteralPath);return ($LiteralPath -ceq $script:shadow)}
 function Get-Item{param($LiteralPath,[switch]$Force);return [pscustomobject]@{Attributes=[IO.FileAttributes]::Normal}}
 $script:realLookup=(Get-Command Assert-B5ModuleLookupContext -CommandType Function).ScriptBlock
 function Assert-B5ModuleLookupContext($Context){$script:captured=$Context;& $script:realLookup $Context}
 Read-B5Dependencies $p.oldWebRoot $m $null
 if($script:captured.absent -cnotcontains $script:api -or $script:captured.absent -cnotcontains $script:web){throw 'WEBONLY_SHADOW_SCOPE_REDUCED'}
 foreach($case in @('extra','missing','wrong-app','wrong-patch','own-lock','inventory')){
  $bad=$m.PSObject.Copy();$script:digest='a'*64
  if($case -eq 'extra'){$bad.dependencies=@($d,$d)}elseif($case -eq 'missing'){$bad.dependencies=@()}elseif($case -eq 'wrong-app'){$wrong=$d.PSObject.Copy();$wrong.app='api';$bad.dependencies=@($wrong)}elseif($case -eq 'wrong-patch'){$bad.frontendPatchCommit='wrong'}elseif($case -eq 'own-lock'){$bad.files=@([pscustomobject]@{path='apps/sites-workflow/package-lock.json';sha256=('b'*64)})}else{$script:digest='b'*64}
  $rejected=$false;try{Read-B5Dependencies $p.oldWebRoot $bad $null}catch{$rejected=$true};if(!$rejected){throw ('WEBONLY_ACCEPTED_'+$case)}
 }
 $script:shadow=$script:api;$rejected=$false;try{& $script:realLookup $script:captured}catch{$rejected=$true;if($_.Exception.Message -ne 'B5_DEPENDENCY_LOOKUP_SHADOW'){throw}};if(!$rejected){throw 'WEBONLY_LATE_SHADOW_ACCEPTED'};'PASS'`);
win('clean exact profile accepted; wrong DB/env/source/tree/node/base and string booleans rejected',manifest+String.raw`Assert-B5Manifest $m $p.source -Combined;foreach($field in @('kind','frontendPatchCommit','database','environmentId','sourceCommit','sourceTree','frontendBuildApiBase','synthetic','actualT1','externalOperations')){$copy=$m.PSObject.Copy();$copy.$field='wrong';$bad=$false;try{Assert-B5Manifest $copy $p.source -Combined}catch{$bad=$true};if(!$bad){throw ('accepted '+$field)}};$m.synthetic='true';$bad=$false;try{Assert-B5Manifest $m $p.source -Combined}catch{$bad=$true};if(!$bad){throw 'accepted string bool'};'PASS'`);
win('artifact reader checks exact bytes, traversal, duplicate entries and changed payload using memory-only reads',manifest+String.raw`
 $script:pins=$p;$node=[Text.Encoding]::UTF8.GetBytes('fixture-node');$script:pins.nodeHash=B5Hash $node;$m.nodeRuntime.sha256=$script:pins.nodeHash
 function Get-B5Pins{return $script:pins}
 function Read-B5Dependencies($Root,$Manifest,$Lease){} # This older test isolates payload validation; real dependencies are covered below.
 $payload=[Text.Encoding]::UTF8.GetBytes('fixture-payload');$good=[pscustomobject]@{path='apps/api/source.mjs';sha256=(B5Hash $payload)};$m|Add-Member -NotePropertyName files -NotePropertyValue @($good)
 function B5ReadFrozen([string]$Path,$Lease){if($Path -ceq $script:pins.node){return ,$script:nodeBytes};if($Path -ceq (Join-Path $script:pins.root 'release-manifest.json')){return ,$script:manifestBytes};if($Path -ceq (Join-Path $script:pins.root 'apps/api/source.mjs')){return ,$script:payloadBytes};throw 'UNEXPECTED_FIXTURE_READ'}
 $script:nodeBytes=$node;$script:payloadBytes=$payload
 foreach($case in @('valid','traversal','duplicate','empty','payload','manifest','node')){
  $m.files=if($case -eq 'traversal'){@([pscustomobject]@{path='../outside';sha256=$good.sha256})}elseif($case -eq 'duplicate'){@($good,$good)}elseif($case -eq 'empty'){@()}else{@($good)}
  $script:manifestBytes=[Text.Encoding]::UTF8.GetBytes(($m|ConvertTo-Json -Depth 8));$hash=B5Hash $script:manifestBytes
  $script:payloadBytes=if($case -eq 'payload'){[byte[]]@(1)}else{$payload};$script:nodeBytes=if($case -eq 'node'){[byte[]]@(1)}else{$node};if($case -eq 'manifest'){$hash='WRONG'}
  $failed=$false;try{Read-B5Artifact $p.root $hash $p.source -Combined|Out-Null}catch{$failed=$true;if($_.Exception.Message -notmatch '^B5_(PAYLOAD_PATH|EMPTY_PAYLOAD|PAYLOAD_CHANGED|MANIFEST_CHANGED|NODE_CHANGED)$'){throw}}
  if($failed -ne ($case -ne 'valid')){throw ('artifact case '+$case)}
 };'PASS'`);
win('missing handoff does not accept a guessed relative working directory',setup+String.raw`$p=Get-B5Pins;$f=New-B5FixtureFacts 101 $p.oldApiRoot 4194;$f.command='"'+$p.node+'" src\cleanSyntheticServer.mjs';Fx-ExpectedError {Assert-B5TargetArguments $f $p.oldApiRoot 4194 $null} 'B5_UNISSUED_WRITER_HANDOFF';'PASS'`);
win('health rejects foreign source/currency-independent DB privilege and fake numeric zeros',setup+String.raw`$p=Get-B5Pins;$h=Read-B5Health 4194;Assert-B5Health $h 4194 $p.oldApi 'old-api-package';foreach($field in @('databaseName','serverName','environmentId','sourceCommit','packageId','synthetic','actualT1','externalOperations','originalDatabaseAccess','liveDatabaseAccess','sysadmin','databaseControl')){$x=$h.PSObject.Copy();$x.$field='wrong';Fx-ExpectedError {Assert-B5Health $x 4194 $p.oldApi 'old-api-package'} 'B5_HEALTH_TARGET'};$h.sysadmin='0';Fx-ExpectedError {Assert-B5Health $h 4194 $p.oldApi 'old-api-package'} 'B5_HEALTH_TARGET';'PASS'`);
for(const field of ['pid','birth','exe','command','sid'])win('live identity change '+field+' fails before termination',setup+String.raw`$x=$c.originalTargets[4194].PSObject.Copy();$x.${field}=${field==='pid'?'999':"'changed'"};Fx-ExpectedError {Assert-B5Process $x $c.originalTargets[4194]} 'B5_PROCESS_CHANGED';Assert-Fx ($script:fx.events.Count -eq 0) 'no-effects';'PASS'`);
win('new live ticket is single-use; old generation/timeout and control drift fail closed',setup+String.raw`$c.lease=Enter-B5Lease (Get-B5WriterHandoff);$t=Assert-B5Boundary $c;Use-B5Boundary $c $t;Fx-ExpectedError {Use-B5Boundary $c $t} 'B5_STALE_ACTION_TICKET';$t=Assert-B5Boundary $c;$script:fx.clock+=61;Fx-ExpectedError {Use-B5Boundary $c $t} 'B5_STALE_ACTION_TICKET';$script:fx.clock=100;$t=Assert-B5Boundary $c;$p=Get-B5Pins;$script:fx.files[(Join-Path $p.runtime 'start-erp.ps1')]=[Text.Encoding]::UTF8.GetBytes('foreign');Fx-ExpectedError {Use-B5Boundary $c $t} 'B5_CONTROL_RACE';'PASS'`);
win('protection drift and a respawned target are rejected before any stop',setup+String.raw`$c.lease=Enter-B5Lease (Get-B5WriterHandoff);$script:fx.protected.native='changed';Fx-ExpectedError {Stop-B5Old $c 4194} 'B5_PROTECTION_CHANGED';Assert-Fx (!@($script:fx.events|Where-Object {$_ -like 'stop-*'}).Count) 'no-stop';$script:fx.protected.native='N';$script:fx.listeners[0].OwningProcess=777;Fx-ExpectedError {Stop-B5Old $c 4194} 'B5_PORT_OWNER_CHANGED';'PASS'`);
win('process reuse between boundary and handle action is refused without PID-based kill',setup+String.raw`$c.lease=Enter-B5Lease (Get-B5WriterHandoff);function Open-B5BoundProcess($Facts){$script:fx.processes[$Facts.pid]=$Facts.PSObject.Copy();$script:fx.processes[$Facts.pid].birth='reused';$h=[pscustomobject]@{test=1};$h|Add-Member -MemberType ScriptMethod -Name Dispose -Value {};return $h};Fx-ExpectedError {Stop-B5Old $c 4194} 'B5_PROCESS_CHANGED|Method';Assert-Fx (!@($script:fx.events|Where-Object {$_ -like 'stop-*'}).Count) 'no-kill';'PASS'`);
win('real executor path stops pair, captures children, commits under held lease, and leaves native',setup+String.raw`$r=Invoke-B5CleanTransition;Assert-Fx ($r.status -eq 'CLEAN_PAIR_INSTALLED') 'installed';Assert-Fx ($script:fx.events.Contains('start-Candidate-4194') -and $script:fx.events.Contains('start-Candidate-5244')) 'two-starts';Assert-Fx $script:fx.events.Contains('handoff-CandidateCommitted') 'commit-before-exit';Assert-Fx ($script:fx.events[$script:fx.events.Count-1] -eq 'lease-exit') 'released-last';Assert-Fx (@($script:fx.listeners|Where-Object LocalPort -eq 4196)[0].OwningProcess -eq 103) 'native-kept';'PASS'`);
for(const fail of ['stop-web','stop-api-after-exit','stop-web-after-exit','start-api','start-web','served-wrong'])win('real executor partial '+fail+' returns accepted old pair with no database restore',setup+String.raw`$c=Reset-B5Fixture '${fail}';Fx-ExpectedError {Invoke-B5CleanTransition} 'B5_TEST_|B5_SERVED_WEB_CHANGED';$p=Get-B5Pins;$h=Read-B5Health 4194;Assert-Fx ($h.sourceCommit -eq $p.oldApi) 'old-api';Assert-Fx $script:fx.events.Contains('handoff-OldPairRestored') 'old-verified';Assert-Fx (!@($script:fx.events|Where-Object {$_ -like 'stop-103'}).Count) 'native-not-stopped';if('${fail}' -in @('stop-web','stop-api-after-exit')){Assert-Fx (!@($script:fx.events|Where-Object {$_ -eq 'start-OldApi-5244'}).Count) 'old-web-not-restarted'};'PASS'`);
for(const fail of ['foreign-after-start','protection-after-start','lease-lost'])win('recovery '+fail+' cannot overwrite or stop a stranger after lost safety proof',setup+String.raw`$c=Reset-B5Fixture '${fail}';Fx-ExpectedError {Invoke-B5CleanTransition} 'B5_RECOVERY_NOT_PROVEN_MANUAL_REVIEW';Assert-Fx (!@($script:fx.events|Where-Object {$_ -like 'start-Old*'}).Count) 'no-unsafe-old-start';Assert-Fx (!@($script:fx.events|Where-Object {$_ -like 'stop-900*'}).Count) 'no-replacement-stopped-without-proof';if('${fail}' -ne 'lease-lost'){Assert-Fx ($script:fx.events.Contains('start-Candidate-4194') -and $script:fx.events.Contains('start-Candidate-5244')) 'reached-candidate-before-safety-loss'};if('${fail}' -eq 'foreign-after-start'){Assert-Fx (!@($script:fx.events|Where-Object {$_ -eq 'stop-777'}).Count) 'stranger-preserved'};'PASS'`);
win('incomplete before-image fails before the first stop',setup+String.raw`$c.lease=Enter-B5Lease (Get-B5WriterHandoff);$c.before='C:\fixture\missing';Fx-ExpectedError {Assert-B5BeforeImage $c} 'FIXTURE_UNKNOWN_READ';Assert-Fx (!@($script:fx.events|Where-Object {$_ -like 'stop-*'}).Count) 'no-stop';'PASS'`);
win('new source and template parse; native interop compiles and birth-precision math is bounded',String.raw`foreach($file in @('${script}','${template}')){$t=$null;$e=$null;[Management.Automation.Language.Parser]::ParseFile($file,[ref]$t,[ref]$e)|Out-Null;if($e.Count){throw 'syntax'}};Initialize-B5Kernel;if(![B5PairKernel]::MatchesCim(638000000000000009,638000000000000000)){throw 'CIM microsecond'};if([B5PairKernel]::MatchesCim(638000000000000010,638000000000000000)){throw 'accepted other microsecond'};if([B5PairKernel]::MatchesCim(638000000000000009,638000000000000008)){throw 'accepted other native tick'};'PASS'`);
win('PS5 records stay individual; duplicate or unissued rows cannot become owned records',setup+String.raw`$rows=@(ConvertFrom-B5Records $c.controls.records);Assert-Fx ($rows.Count -eq 3) 'flat-rows';Fx-ExpectedError {ConvertFrom-B5Records ([Text.Encoding]::UTF8.GetBytes('{"port":4194}'))} 'B5_RECORD_ARRAY_REQUIRED';$p=Get-B5Pins;$rows[0].pid=777;$script:fx.files[(Join-Path $p.runtime 'erp-processes.json')]=[Text.Encoding]::UTF8.GetBytes(($rows|ConvertTo-Json -Depth 8));Fx-ExpectedError {Sync-B5OwnedRecords $c} 'B5_LAUNCH_RECORD_RACE';'PASS'`);
win('busy native request intents fail closed; the fixed guard query has no mutating SQL',String.raw`$q=Get-B5IdleQuery;if($q -notmatch "DB_NAME\(\)<>N'MELISA_ERP_CLEAN_TEST_20261022'" -or $q -notmatch 'actual_t1=0' -or $q -match '\b(UPDATE|INSERT|DELETE|ALTER|CREATE|EXEC)\b'){throw 'query-boundary'};function Invoke-B5IdleRead([string]$Query){return 1};$bad=$false;try{Assert-B5NativeIdle}catch{$bad=$_.Exception.Message -ceq 'B5_NATIVE_NOT_IDLE'};if(!$bad){throw 'busy accepted'};'PASS'`);
test('reviewed template bytes match their updated pin and the production handoff remains closed',()=>{const s=fs.readFileSync(script,'utf8');assert.ok(s.includes("B5Fail 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'"));assert.ok(!s.includes('Stop-Process -Id'));assert.ok(!s.includes('Register-ScheduledTask'));assert.ok(fs.readFileSync(template,'utf8').includes("throw 'B5_OFFLINE_SOURCE_ONLY"));assert.equal(createHash('sha256').update(fs.readFileSync(template)).digest('hex'),s.match(/template='([A-F0-9]{64})'/)[1].toLowerCase());});
test('real file CAS and frozen payload stream use only an isolated temporary fixture',{skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b5-source-cas-')),file=path.join(dir,'fixture.txt');fs.writeFileSync(file,'old');
 try{const quoted=file.replaceAll("'","''");const body=String.raw`$ErrorActionPreference='Stop';. '${script}' -Library;$file='${quoted}';function Assert-B5Path([string]$Path){if($Path -cne $file){throw 'FIXTURE_PATH_ESCAPE'}};$old=B5Hash ([Text.Encoding]::UTF8.GetBytes('old'));Write-B5Control $file $old ([Text.Encoding]::UTF8.GetBytes('new'));if([IO.File]::ReadAllText($file) -cne 'new'){throw 'cas'};[IO.File]::WriteAllText($file,'foreign');$blocked=$false;try{Write-B5Control $file $old ([Text.Encoding]::UTF8.GetBytes('bad'))}catch{$blocked=$true};if(!$blocked -or [IO.File]::ReadAllText($file) -cne 'foreign'){throw 'overwrote stranger'};function Assert-B5Lease($Lease){};$lease=[pscustomobject]@{resources=(New-Object Collections.Generic.List[IDisposable])};try{$bytes=B5ReadFrozen $file $lease;$blocked=$false;try{[IO.File]::WriteAllText($file,'tamper')}catch{$blocked=$true};if(!$blocked){throw 'frozen file mutated'}}finally{foreach($s in $lease.resources){$s.Dispose()}};'PASS'`;
 const out=execFileSync(ps,['-NoProfile','-NonInteractive','-Command',body],{encoding:'utf8',timeout:30000,windowsHide:true,stdio:['ignore','pipe','pipe']});assert.equal(out.trim(),'PASS');
 }finally{fs.unlinkSync(file);fs.rmdirSync(dir);}
});

// Review regressions deliberately leave stop/write leaves without extra lease
// checks: the production orchestrator, rather than a safer fake, must gate them.
for(const drift of ['protection-after-stop','lease-after-write','port-after-stop','control-after-write'])win('review recovery rejects '+drift+' before its next effect',setup+String.raw`
 Invoke-B5CleanTransition|Out-Null;$c=$script:fx.context;$c.lease=Enter-B5Lease (Get-B5WriterHandoff);$script:fx.events.Clear()
 function Stop-B5Handle($Handle,$Facts){$script:fx.events.Add('review-stop');$script:fx.listeners=@($script:fx.listeners|Where-Object OwningProcess -ne $Facts.pid);$script:fx.processes.Remove([int]$Facts.pid);if('${drift}' -eq 'protection-after-stop'){$script:fx.protected.native='CHANGED'};if('${drift}' -eq 'port-after-stop'){$script:fx.listeners=@($script:fx.listeners|Where-Object LocalPort -ne 5244);$script:fx.listeners+=[pscustomobject]@{LocalPort=5244;LocalAddress='127.0.0.1';OwningProcess=777}}}
 function Write-B5Control([string]$Path,[string]$ExpectedHash,[byte[]]$Bytes){if((B5Hash (B5Read $Path)) -cne $ExpectedHash){throw 'B5_CONTROL_WRITE_RACE'};$script:fx.files[$Path]=$Bytes;$script:fx.events.Add('review-write');if('${drift}' -eq 'lease-after-write'){$script:fx.held=$false};if('${drift}' -eq 'control-after-write'){$script:fx.files[(Join-Path (Get-B5Pins).runtime 'erp-processes.json')]=[Text.Encoding]::UTF8.GetBytes('foreign')}}
 $failed=$false;try{Restore-B5Pair $c}catch{$failed=$true};Assert-Fx $failed 'drift-must-reject'
 $stops=@($script:fx.events|Where-Object {$_ -eq 'review-stop'}).Count;$writes=@($script:fx.events|Where-Object {$_ -eq 'review-write'}).Count
 if('${drift}' -like '*after-stop'){Assert-Fx ($stops -eq 1 -and $writes -eq 0) 'effect-after-stop-drift'}else{Assert-Fx ($stops -eq 2 -and $writes -eq 1) 'second-write-after-drift'};'PASS'`);

win('review actual template PS5 record publication preserves flat native rows in both branches',String.raw`
 $text=[IO.File]::ReadAllText('${template}');$lines=$text -split "\r?\n";$script:json='[{"port":4194,"pid":101},{"port":4196,"pid":103},{"port":5244,"pid":102}]'
 function Get-Content{param($LiteralPath,[switch]$Raw);return $script:json}
 function Set-Content{param($LiteralPath,$Encoding,[Parameter(ValueFromPipeline=$true)]$Value);process{$script:json=$Value}}
 $cleanRoot='C:\fixture';$startPorts=@(4194);$newProcesses=@([pscustomobject]@{port=4194;pid=9001})
 $line=@($lines|Where-Object {$_ -like '$oldRecords=*'})[0];. ([scriptblock]::Create($line));$rows=@(ConvertFrom-B5Records ([Text.Encoding]::UTF8.GetBytes($script:json)));if($rows.Count -ne 3 -or @($rows|Where-Object port -eq 4196).Count -ne 1){throw 'REAL_TEMPLATE_ROWS_LOST'}
 $newProcesses=@([pscustomobject]@{port=4194;pid=9001});$line=@($lines|Where-Object {$_ -like ' $newProcesses+=@(*'})[0];. ([scriptblock]::Create($line));if(@($newProcesses|Where-Object {$_.port -eq 4196}).Count -ne 1){throw 'REAL_MAIN_API_ROWS_LOST'}
 $newProcesses=@([pscustomobject]@{port=4194;pid=9001},[pscustomobject]@{port=5244;pid=9002});$ApiWebOnly=$true;$line=@($lines|Where-Object {$_ -like ' if($ApiWebOnly)*'})[0];. ([scriptblock]::Create($line));if($newProcesses.Count -ne 3 -or @($newProcesses|Where-Object port -eq 4196).Count -ne 1){throw 'REAL_PAIR_NATIVE_LOST'};'PASS'`);

win('review original rollback JSON statements work under the real scoped PS5 compatibility wrapper',String.raw`
 # Original record expressions from template6875903d:58/74/76/78. They are
 # deliberately NOT replaced by the new explicit-enumeration implementation.
 $script:json='[{"port":4194,"pid":101},{"port":4196,"pid":103},{"port":5244,"pid":102}]'
 function Get-Content{param($LiteralPath,[switch]$Raw);return $script:json}
 function Set-Content{param($LiteralPath,$Encoding,[Parameter(ValueFromPipeline=$true)]$Value);process{$script:json=$Value}}
 $cleanRoot='C:\fixture';$startPorts=@(4194);$newProcesses=@([pscustomobject]@{port=4194;pid=9001})
 Invoke-B5JsonCompatible {
  $oldRecords=@(Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw|ConvertFrom-Json|Where-Object { $_.port -notin $startPorts });@($newProcesses)+$oldRecords|ConvertTo-Json|Set-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Encoding utf8
 }
 if(@(ConvertFrom-B5Records ([Text.Encoding]::UTF8.GetBytes($script:json))).Count -ne 3){throw 'LEGACY_ROLLBACK_ROWS'}
 Invoke-B5JsonCompatible {
  $newProcesses=@([pscustomobject]@{port=4194;pid=9001});$newProcesses+=@(Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw|ConvertFrom-Json|Where-Object { $_.port -notin $startPorts });if($newProcesses.Count -ne 3){throw 'LEGACY_MAIN_API_ROWS'}
  $newProcesses=@([pscustomobject]@{port=4194;pid=9001},[pscustomobject]@{port=5244;pid=9002});$newProcesses+=@(Get-Content -LiteralPath "$cleanRoot\runtime\erp-processes.json" -Raw|ConvertFrom-Json|Where-Object port -eq 4196);if($newProcesses.Count -ne 3){throw 'LEGACY_PAIR_NATIVE'}
 };'PASS'`);

test('review real dependency inventories and frozen API/vite files reject changed, missing, extra, unsafe or reparse input',{skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b5-dependencies-')),hash=b=>createHash('sha256').update(b).digest('hex'),apps=['api','sites-workflow','web-admin'],relative={api:'lib/index.js','sites-workflow':'vite/bin/vite.js','web-admin':'lib/index.js'};
 const files=[];const deps=[];
 for(const app of apps){const base=path.join(dir,'apps',app),lock=path.join(base,'package-lock.json'),rows=[];for(const name of [relative[app],'.bin/tool.cmd','z-package/package.json','unicode/ç.txt']){const dep=path.join(base,'node_modules',name);fs.mkdirSync(path.dirname(dep),{recursive:true});fs.writeFileSync(dep,name===relative[app]?'fixture-'+app:'fixture-extra');rows.push({path:name,sha256:hash(fs.readFileSync(dep))});}rows.sort((a,b)=>a.path.localeCompare(b.path));fs.writeFileSync(lock,'{}');files.push({path:'apps/'+app+'/package-lock.json',sha256:hash(fs.readFileSync(lock))});deps.push({app,files:rows.length,lockSha256:hash(fs.readFileSync(lock)),inventorySha256:hash(JSON.stringify(rows))});}
 // GitHub Windows TEMP may contain RUNNER~1. FileInfo expands that alias;
 // admit the same canonical real directory, never a broader prefix.
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64'),quoted=fs.realpathSync.native(dir).replaceAll("'","''"),node=fs.realpathSync.native(process.execPath).replaceAll("'","''"),nodeHash=hash(fs.readFileSync(process.execPath)).toUpperCase();
 try{runWin(manifest+String.raw`
  $script:pins=$p;$script:pins.node='${node}';$script:pins.nodeHash='${nodeHash}';$script:pins.root='${quoted}';$m.nodeRuntime.path=$script:pins.node;$m.nodeRuntime.sha256=$script:pins.nodeHash
  function Get-B5Pins{return $script:pins};function Assert-B5Lease($Lease){}
  function Assert-B5Path([string]$Path){$full=[IO.Path]::GetFullPath($Path);if($full -cne $script:pins.node -and !$full.StartsWith($script:pins.root+'\',[StringComparison]::OrdinalIgnoreCase) -and $full -cne $script:pins.root){throw 'FIXTURE_PATH_ESCAPE'};if(Get-Command Assert-B5NoReparse -ErrorAction SilentlyContinue){Assert-B5NoReparse $full}}
  function Get-Item{param($LiteralPath,[switch]$Force);if($script:depCase -eq 'reparse' -and $LiteralPath -like '*node_modules\vite'){return [pscustomobject]@{Attributes=[IO.FileAttributes]::ReparsePoint}};return Microsoft.PowerShell.Management\Get-Item -LiteralPath $LiteralPath -Force}
  $goodFiles=@(foreach($row in (ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${enc(files)}'))))){$row});$goodDeps=@(foreach($row in (ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${enc(deps)}'))))){$row})
  $m|Add-Member -NotePropertyName files -NotePropertyValue $goodFiles;$m|Add-Member -NotePropertyName dependencies -NotePropertyValue $goodDeps
  $api=Join-Path $script:pins.root 'apps\api\node_modules\lib\index.js';$vite=Join-Path $script:pins.root 'apps\sites-workflow\node_modules\vite\bin\vite.js';$extra=Join-Path $script:pins.root 'apps\api\node_modules\extra.js';$lock=Join-Path $script:pins.root 'apps\api\package-lock.json'
  foreach($case in @('api-changed','vite-changed','missing','extra','lock-changed','missing-inventory','unsafe-app','duplicate-app','reparse','valid')){
   $script:depCase=$case;[IO.File]::WriteAllText($api,'fixture-api');[IO.File]::WriteAllText($vite,'fixture-sites-workflow');[IO.File]::WriteAllText($lock,'{}');if(Test-Path -LiteralPath $extra){[IO.File]::Delete($extra)}
   $m.dependencies=@(foreach($row in (ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${enc(deps)}'))))){$row})
   if($case -eq 'api-changed'){[IO.File]::WriteAllText($api,'changed')};if($case -eq 'vite-changed'){[IO.File]::WriteAllText($vite,'changed')};if($case -eq 'missing'){[IO.File]::Delete($api)};if($case -eq 'extra'){[IO.File]::WriteAllText($extra,'extra')};if($case -eq 'lock-changed'){[IO.File]::WriteAllText($lock,'changed')};if($case -eq 'missing-inventory'){$m.dependencies=@()};if($case -eq 'unsafe-app'){$m.dependencies[0].app='../outside'};if($case -eq 'duplicate-app'){$m.dependencies=@($m.dependencies[0],$m.dependencies[0],$m.dependencies[2])}
   $bytes=[Text.Encoding]::UTF8.GetBytes(($m|ConvertTo-Json -Depth 8));[IO.File]::WriteAllBytes((Join-Path $script:pins.root 'release-manifest.json'),$bytes);$lease=[pscustomobject]@{resources=(New-Object Collections.Generic.List[IDisposable])}
   try{$failed=$false;try{Read-B5Artifact $script:pins.root (B5Hash $bytes) $p.source -Combined -Lease $lease|Out-Null}catch{$failed=$true;if($_.Exception.Message -notmatch 'B5_(DEPENDENCY_|PAYLOAD_CHANGED|REPARSE)'){throw}}
    if($failed -ne ($case -ne 'valid')){throw ('DEPENDENCY_CASE_ACCEPTED_'+$case)}
    if($case -eq 'valid'){foreach($file in @($api,$vite)){$blocked=$false;try{[IO.File]::WriteAllText($file,'tamper')}catch{$blocked=$true};if(!$blocked){throw 'DEPENDENCY_NOT_FROZEN'}};[IO.File]::WriteAllText($extra,'late-module');$blocked=$false;try{Assert-B5DependencyDirectories $lease}catch{$blocked=$_.Exception.Message -ceq 'B5_DEPENDENCY_DIRECTORY_CHANGED'};if(!$blocked){throw 'LATE_DEPENDENCY_NOT_REJECTED'};[IO.File]::Delete($extra);Assert-B5DependencyDirectories $lease}
   }finally{foreach($stream in $lease.resources){$stream.Dispose()}}
  };'PASS'`,60000);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.match(path.basename(dir),/^b5-dependencies-/);fs.rmSync(dir,{recursive:true,force:true});}
});
