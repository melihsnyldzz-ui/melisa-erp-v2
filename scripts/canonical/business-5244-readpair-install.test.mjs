import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';import os from 'node:os';import path from 'node:path';
const dir=import.meta.dirname,q=s=>"'"+s.replaceAll("'","''")+"'";
function run(body){const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'erp-readpair-install-')));try{const file=path.join(temp,'delta.ps1');fs.writeFileSync(file,`$ErrorActionPreference='Stop';. ${q(path.join(dir,'install-business-5244-readpair.ps1'))} -Library;${body}`);return cp.execFileSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();}finally{const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('erp-readpair-install-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true,force:true});}}
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
win('SHA256 value decoder rejects terminal LF CRLF and prefix LF instead of silently dropping non-hex bytes',()=>{
 assert.equal(run(String.raw`$valid='ab'*32;$a=Get-ReadPairSha256Value $valid;$b=Get-ReadPairSha256Value $valid.ToUpperInvariant();if($a.Length-ne32-or[BitConverter]::ToString($a)-cne[BitConverter]::ToString($b)){throw 'HASH_VALUE_CHANGED'};$lf=[string][char]10;$cr=[string][char]13;foreach($bad in @(($valid+$lf),($valid+$cr+$lf),($lf+$valid))){$denied=$false;try{Get-ReadPairSha256Value $bad|Out-Null}catch{if($_.Exception.Message-cne'READPAIR_BASELINE_HASH_REJECTED'){throw};$denied=$true};if(!$denied){throw 'HASH_SUFFIX_ACCEPTED'}};'PASS'`),'PASS');
});
win('installer failure site retains the real strict property error and line without source text or target values',()=>{
 assert.equal(run(String.raw`Set-StrictMode -Version Latest;$record=$null;try{$item=[pscustomobject]@{present=1};$item.missingFixtureField}catch{$record=$_};$site=Get-ReadPairInstallFailureSite $record;$json=$site|ConvertTo-Json -Compress;if($site.errorId-cne'PropertyNotFoundStrict'-or$site.scriptLineNumber-le0-or$site.exceptionType-cne'System.Management.Automation.PropertyNotFoundException'-or$json.Contains('missingFixtureField')-or$json.Contains('present')-or$json.Contains('Message')-or$json.Contains('TargetObject')){throw 'INSTALL_FAILURE_LOCATION_LOST'};'PASS'`),'PASS');
});
win('unknown installer error identifiers are hashed and never carry arbitrary exception messages into the receipt',()=>{
 assert.equal(run(String.raw`$marker='deneme-'+('ab'*16);$record=$null;try{throw $marker}catch{$record=$_};$site=Get-ReadPairInstallFailureSite $record;$json=$site|ConvertTo-Json -Compress;if($site.errorId-or$site.errorIdSha256-cnotmatch'^[a-f0-9]{64}$'-or$json.Contains($marker)-or$json.Contains('Message')-or(Get-ReadPairInstallFailureSite ([pscustomobject]@{Message=$marker}))){throw 'INSTALL_FAILURE_LEAKED_VALUE'};'PASS'`),'PASS');
});
const inert=String.raw`$script:calls=[Collections.Generic.List[string]]::new();function Open-ReadPairPublication{$calls.Add('open')};function Assert-ReadPairColdTarget{$calls.Add('target')};function Stop-ReadPairColdOwner{$calls.Add('coldstop')};function Start-ReadPairPreparedOwner{$calls.Add('start')};function Assert-ReadPairPreparedOwner{$calls.Add('ready')};function Send-ReadPairSingleRetire{$calls.Add('retire')};function Wait-ReadPairFinalState{$calls.Add('readback');return 'CandidateVerified'};function Complete-ReadPairPublication($Outcome){$calls.Add($Outcome)};function Restore-ReadPairBeforeRetire([bool]$OldStopped){$calls.Add('restore:'+ $OldStopped)};function Close-ReadPairPublication{$calls.Add('close')};function Record-Phase($Phase){$calls.Add($Phase)};`;
win('SteadyStartupInstall uses the shared sequence with task publication and never sends a retire or reads a trade outcome',()=>{
 assert.equal(run(inert+String.raw`
 $script:SteadyStartupInstall=$true;$script:WebOnlyRefreshInstall=$true
 function Complete-B6SteadyTaskPublication{$calls.Add('taskpublish')}
 function Send-ReadPairSingleRetire{throw 'STEADY_RETIRE_FORBIDDEN'}
 function Wait-ReadPairFinalState{throw 'STEADY_TRADE_READBACK_FORBIDDEN'}
 $outcome=Invoke-ReadPairInstallSequence
 if($outcome-cne'SteadyStartupVerified'-or($calls-join'|')-cne'open|target|coldstop|start|ready|taskpublish|SteadyStartupVerified|close'){throw 'STEADY_SEQUENCE_CHANGED'};'PASS'`),'PASS');
});
win('SteadyStartupInstall task publication failure enters existing healthy-owner recovery once and never retires or retries publication',()=>{
 assert.equal(run(inert+String.raw`
 $script:SteadyStartupInstall=$true;$script:WebOnlyRefreshInstall=$true;$script:publishes=0
 function Get-B6ReadPairActiveHandoff{return @{stopAttempted=$true}}
 function Complete-B6SteadyTaskPublication{$script:publishes++;$calls.Add('taskpublish');throw 'STEADY_TASK_PUBLICATION_UNCONFIRMED'}
 function Send-ReadPairSingleRetire{throw 'STEADY_RETIRE_FORBIDDEN'}
 function Wait-ReadPairFinalState{throw 'STEADY_TRADE_READBACK_FORBIDDEN'}
 $denied=$false;try{Invoke-ReadPairInstallSequence|Out-Null}catch{if($_.Exception.Message-cne'STEADY_TASK_PUBLICATION_UNCONFIRMED'){throw};$denied=$true}
 if(!$denied-or$publishes-ne1-or($calls-join'|')-cne'open|target|coldstop|start|ready|taskpublish|restore:True|close'){throw 'STEADY_TASK_FAILURE_RETRIED_OR_RETIRED'};'PASS'`),'PASS');
});
win('SteadyStartupInstall Library has inert defaults and only the finite Writer action admits its web-only handoff',()=>{
 assert.equal(run(". "+q(path.join(dir,'install-business-5244-readpair.ps1'))+" -Library -SteadyStartupInstall -ScopeName TEST125-API-B6-WRITER-20261029;if(!$SteadyStartupInstall-or!$WebOnlyRefreshInstall){throw 'STEADY_HANDOFF_MODE_MISSING'};'PASS'"),'PASS');
 for(const extra of [['-WebOnlyRefreshInstall'],['-WriterInstall'],['-CandidateInstall'],['-RehearsalOnly'],['-CurrentOnlySupersession'],['-InitializerCleanRecovery'],['-AfterLoaderRecovery'],['-ScopeName','TEST125-API-B6-ca620bac-20261028']]){
  const r=cp.spawnSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(dir,'install-business-5244-readpair.ps1'),'-Library','-SteadyStartupInstall',...(extra[0]==='-ScopeName'?[]:['-ScopeName','TEST125-API-B6-WRITER-20261029']),...extra],{encoding:'utf8',windowsHide:true,timeout:10000});assert.notEqual(r.status,0);assert.match(r.stderr,/FIXED_ACTION_REQUIRED/);
 }
});
const steadyTaskFixture=String.raw`
$script:SteadyStartupInstall=$true;$script:WebOnlyRefreshInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:result=@{}
$oldLauncher='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2\start-owned-test.ps1';$newLauncher='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029\start-owned-test.ps1'
$oldArgs='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$oldLauncher+'" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
$script:beforeXml='<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task" version="1.3"><RegistrationInfo><Description>synthetic unchanged</Description></RegistrationInfo><Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers><Principals><Principal id="Author"><UserId>S-1-5-21-1-2-3-1001</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><StartWhenAvailable>false</StartWhenAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit></Settings><Actions Context="Author"><Exec><Command>C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe</Command><Arguments>'+[Security.SecurityElement]::Escape($oldArgs)+'</Arguments><WorkingDirectory>C:\Sirket\ERP\melisa-erp-v2</WorkingDirectory></Exec></Actions></Task>'
$script:taskXml=$beforeXml;$script:taskSddl='D:P(A;;FA;;;SY)(A;;FA;;;S-1-5-21-1-2-3-1001)';$script:logon=3;$script:runLevel=0;$script:registrations=[Collections.Generic.List[int]]::new();$script:scenario='success';$script:readyChecks=0;$script:boundaryChecks=0;$script:apiMutators=0
$script:b6=[pscustomobject]@{maintenancePurpose='WebOnlySteadyStartup';taskCapture=[pscustomobject]@{xmlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($beforeXml)))}}
function Get-Test125ReadPairTask{$task=[pscustomobject]@{Xml=$script:taskXml;Definition=[pscustomobject]@{Principal=[pscustomobject]@{LogonType=$script:logon;RunLevel=$script:runLevel;UserId='S-1-5-21-1-2-3-1001'}}};$task|Add-Member ScriptMethod GetSecurityDescriptor {param($flags);if($flags-ne7){throw 'OTHER_SECURITY_QUERY'};return $script:taskSddl};return $task}
function Assert-B6WebOnlyApiBoundary{$script:boundaryChecks++;Assert-B6SteadyTaskXml $script:taskXml;if($script:taskSddl-cne'D:P(A;;FA;;;SY)(A;;FA;;;S-1-5-21-1-2-3-1001)'){throw 'TASK_SDDL_CHANGED'}}
function Assert-ReadPairPreparedOwner{$script:readyChecks++}
function New-Object {param($ComObject);if($ComObject-cne'Schedule.Service'){throw 'OTHER_COM_OBJECT'};$service=[pscustomobject]@{};$service|Add-Member ScriptMethod Connect {};$service|Add-Member ScriptMethod GetFolder {param($path);if($path-cne'\'){throw 'OTHER_TASK_FOLDER'};$folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod RegisterTask {param($name,$xml,$flags,$user,$password,$logon,$sddl);if($name-cne'Melisa-ERP-TEST-Canonical'-or$user-cne'S-1-5-21-1-2-3-1001'-or$null-ne$password-or$logon-ne3-or$null-ne$sddl-or$flags-cnotin@(1,52)){throw 'OTHER_TASK_PUBLICATION'};$script:registrations.Add([int]$flags);if($flags-eq52){if($script:scenario-ceq'not-applied'){throw 'ISOLATED_NO_WRITE'};if($script:scenario-ceq'unknown'){$script:taskXml='<Task>unknown</Task>';throw 'ISOLATED_UNKNOWN'};$script:taskXml=$xml;if($script:scenario-ceq'lost-ack'){throw 'ISOLATED_ACK_LOST'}};return $null};return $folder};return $service}
function Start-ScheduledTask{$script:apiMutators++;throw 'TASK_START_FORBIDDEN'};function Stop-ScheduledTask{$script:apiMutators++;throw 'TASK_STOP_FORBIDDEN'};function New-Test125ReadPairTransition{$script:apiMutators++;throw 'API_TRANSITION_FORBIDDEN'};function Invoke-ErpBusinessSaleNativeRevision{$script:apiMutators++;throw 'SQL_FORBIDDEN'}
`;
win('SteadyStartupInstall pure task XML changes only the exact frozen launcher and preserves principal triggers settings and working directory',()=>{
 assert.equal(run(steadyTaskFixture+String.raw`
 $copy=$beforeXml;$after=New-B6SteadyTaskXml $beforeXml
 if($beforeXml-cne$copy-or$after.Contains($oldLauncher)-or!$after.Contains($newLauncher)){throw 'STEADY_TASK_PROJECTION_CHANGED_SOURCE'}
 $reversed=$after.Replace($newLauncher,$oldLauncher);if((Get-B6SteadyTaskXmlCanonical $reversed)-cne(Get-B6SteadyTaskXmlCanonical $beforeXml)){throw 'STEADY_TASK_CHANGED_UNRELATED_XML'}
 foreach($case in @('command','extra-arg','foreign-launcher','multiple-actions')){
  $xml=$beforeXml;switch($case){command{$xml=$xml.Replace('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','C:\foreign\powershell.exe')}'extra-arg'{$xml=$xml.Replace('</Arguments>',' -Extra</Arguments>')}'foreign-launcher'{$xml=$xml.Replace($oldLauncher,'C:\foreign\start-owned-test.ps1')}'multiple-actions'{$xml=$xml.Replace('</Actions>','<Exec><Command>other</Command></Exec></Actions>')}}
  $denied=$false;try{New-B6SteadyTaskXml $xml|Out-Null}catch{if($_.Exception.Message-cne'B6_STEADY_TASK_ACTION_CHANGED'){throw};$denied=$true};if(!$denied){throw ('STEADY_TASK_PROJECTION_ACCEPTED_'+$case)}
 };if($registrations.Count-or$apiMutators){throw 'PURE_XML_MUTATED_TASK'};'PASS'`),'PASS');
});
win('SteadyStartupInstall task publisher uses validate-only then one update with no registration trigger principal ACE or API restart',()=>{
 assert.equal(run(steadyTaskFixture+String.raw`
 Initialize-B6SteadyTaskPublication
 if(($registrations-join',')-cne'1'-or$taskXml-cne$beforeXml-or$script:SteadyTaskPublication.registerCalls-ne0){throw 'TASK_PREPARATION_WROTE_ACTION'}
 $script:scenario='lost-ack';Complete-B6SteadyTaskPublication
 if(($registrations-join',')-cne'1,52'-or$script:SteadyTaskPublication.phase-cne'Verified'-or$result.taskChanges-ne1-or$result.taskRegistrationCalls-ne1-or!$result.taskRunningInstanceUnchanged-or!$result.taskPermissionUnchanged-or$result.physicalRebootTested-or$apiMutators){throw 'STEADY_TASK_PUBLICATION_NOT_EXACT'}
 $denied=$false;try{Complete-B6SteadyTaskPublication}catch{if($_.Exception.Message-cne'B6_STEADY_TASK_NO_REPLAY'){throw};$denied=$true};if(!$denied-or($registrations-join',')-cne'1,52'){throw 'STEADY_TASK_UPDATE_REPLAY'};'PASS'`),'PASS');
});
win('SteadyStartupInstall task publication rejects changed before-image or permissions and never retries unapplied or unknown updates',()=>{
 assert.equal(run(steadyTaskFixture+String.raw`
 foreach($case in @('before','sddl','not-applied','unknown')){
  Remove-Variable SteadyTaskPublication -Scope Script -ErrorAction SilentlyContinue;$script:taskXml=$beforeXml;$script:taskSddl='D:P(A;;FA;;;SY)(A;;FA;;;S-1-5-21-1-2-3-1001)';$script:registrations.Clear();$script:scenario='success';Initialize-B6SteadyTaskPublication
  switch($case){before{$script:taskXml=$beforeXml.Replace('synthetic unchanged','drift')}sddl{$script:taskSddl='drift'}default{$script:scenario=$case}}
  $denied=$false;try{Complete-B6SteadyTaskPublication}catch{$denied=$true};if(!$denied-or$apiMutators-or($case-cin@('before','sddl')-and($registrations-join',')-cne'1')){throw ('STEADY_TASK_FALSE_PUBLICATION_'+$case)}
  if($case-cin@('not-applied','unknown')){$count=$registrations.Count;$denied=$false;try{Complete-B6SteadyTaskPublication}catch{$denied=$true};if(!$denied-or$registrations.Count-ne$count){throw 'STEADY_TASK_UNKNOWN_RETRY'}}
 };'PASS'`),'PASS');
});
win('SteadyStartupInstall actual prepared-owner guard proves fresh record and HTTP200 before task publication; either drift blocks the task',()=>{
 assert.equal(run(String.raw`
 $realPrepared=(Get-Command Assert-ReadPairPreparedOwner).ScriptBlock
 `+inert+String.raw`
 $script:SteadyStartupInstall=$true;$script:WebOnlyRefreshInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:result=@{retireAttempts=0;final=$null};$script:kind='success'
 $script:newHost=[pscustomobject]@{Id=31001};$script:ready=@{ownerBirth='fixture-owner-birth';childPid=31002;childBirth='fixture-child-birth'};$script:status=[pscustomobject]@{ownerPid=31001;ownerBirth='fixture-owner-birth';childPid=31002;childBirth='fixture-child-birth'};$script:pins=@{apiPackage='unchanged-writer-api';package='steady-workface-web'};$script:expected=@{planHash=('a'*64)}
 function Owner-Status{return $script:status};function Assert-ReadPairProtection{$calls.Add('protection')};function Get-Business5244RetirementPendingPath{return (Join-Path $PSScriptRoot 'absent.pending')}
 function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'UNEXPECTED_HTTP'};$calls.Add('api-health');return [pscustomobject]@{packageId=$pins.apiPackage}}
 function Assert-Business5244ApiHealth($Health,$Pins){if($Health.packageId-cne$Pins.apiPackage){throw 'WRONG_API_PAIR'}}
 function Assert-B6WebOnlyApiBoundary{$calls.Add('boundary')};function Get-B6WebOnlyExpectedProjection{return @{planHash=('a'*64)}}
 function Assert-B6ReadPairCurrentRecoveryRecord($Status,[switch]$Router){if(!$Router-or![object]::ReferenceEquals($Status,$script:status)){throw 'FOREIGN_RECORD_READ'};$calls.Add('record');if($script:kind-ceq'record-drift'){throw 'ISOLATED_CURRENT_RECORD_CHANGED'}}
 function Invoke-WebRequest($Uri,$Method,[switch]$UseBasicParsing,$TimeoutSec){if($Uri-cne'http://127.0.0.1:5244/ornek-akis.html'-or$Method-cne'Head'-or!$UseBasicParsing){throw 'UNEXPECTED_WEB_READ'};$calls.Add('web-http');return [pscustomobject]@{StatusCode=$(if($script:kind-ceq'http-failure'){503}else{200})}}
 function Assert-ReadPairPreparedOwner{&$realPrepared}
 function Complete-B6SteadyTaskPublication{if(!$result.final-or$result.final.webHttp-ne200-or!$result.final.recordRowsPreserved){throw 'TASK_BEFORE_FRESH_RECORD_AND_HTTP'};$calls.Add('taskpublish')}
 function Get-B6ReadPairActiveHandoff{return @{stopAttempted=$true}}
 function Send-ReadPairSingleRetire{throw 'STEADY_RETIRE_FORBIDDEN'};function Wait-ReadPairFinalState{throw 'STEADY_TRADE_READBACK_FORBIDDEN'}
 foreach($kind in @('success','record-drift','http-failure')){
  $calls.Clear();$result.final=$null;$denied=$false;try{Invoke-ReadPairInstallSequence|Out-Null}catch{$denied=$true}
  if($kind-ceq'success'){
   if($denied-or($calls-join'|')-cne'open|target|coldstop|start|protection|api-health|boundary|record|web-http|taskpublish|SteadyStartupVerified|close'-or$result.final.mode-cne'Steady'-or$result.final.ownerPid-ne31001-or$result.final.childPid-ne31002-or$result.final.apiPackage-cne$pins.apiPackage-or$result.final.webPackage-cne$pins.package-or$result.final.observation-cne'READONLY_FRESH_STEADY_STATE_NOT_PRIVATE_TOKEN'){throw 'FRESH_STEADY_PROOF_NOT_BOUND'}
  }elseif(!$denied-or$null-ne$result.final-or$calls.Contains('taskpublish')-or!$calls.Contains('restore:True')-or($kind-ceq'record-drift'-and$calls.Contains('web-http'))){throw ('INVALID_STEADY_PROOF_PUBLISHED_TASK_'+$kind)}
  if($result.retireAttempts-ne0){throw 'STEADY_PROOF_SENT_RETIRE'}
 };'PASS'`),'PASS');
});
const activeFixture=String.raw`
. __STARTUP__ -Library
$nativeSource=[IO.File]::ReadAllText(__PEER__);$nativeLiteral='const string Path="C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027\\5244-retirement.pending";'
if($nativeSource.Split(@($nativeLiteral),[StringSplitOptions]::None).Count-ne2){throw 'ISOLATED_PENDING_LITERAL_NOT_UNIQUE'}
$nativeSource=$nativeSource.Replace($nativeLiteral,('const string Path=@"'+(Join-Path $PSScriptRoot 'fixture.pending')+'";'));Add-Type -TypeDefinition $nativeSource
function Get-Business5244StartupMutexName{return ('Local\MelisaActiveEntryFixture-'+[IO.Path]::GetFileName($PSScriptRoot))}
function Get-Business5244RetirementPendingPath{return (Join-Path $PSScriptRoot 'fixture.pending')}
$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:held=[Collections.Generic.List[object]]::new();$script:created=@();$script:before=@{fixture=$true};$script:oldRoot=$PSScriptRoot;$script:oldHash=('a'*64);$script:result=@{stopCalls=0};$script:foreignLaunch=$false;$script:startCalls=0;$script:skipAutomaticHold=$false
$active=Join-Path $PSScriptRoot 'run-current-owner.ps1';$bytes=[Text.Encoding]::UTF8.GetBytes('inert-active-entry');[IO.File]::WriteAllBytes($active,$bytes);$hash=Get-Business5244StartupHash $bytes
$entries=@(1..6|ForEach-Object{$p=Join-Path $PSScriptRoot ('legacy-'+$_+'.ps1');[IO.File]::WriteAllBytes($p,$bytes);[pscustomobject]@{path=$p;beforeSha256=$hash;afterEqualsBefore=$true}})
$direct=@(1..3|ForEach-Object{$p=Join-Path $PSScriptRoot ('inactive-'+$_+'.ps1');[IO.File]::WriteAllBytes($p,$bytes);[pscustomobject]@{path=$p;sha256=$hash}})+@([pscustomobject]@{path=$active;sha256=$hash})
$script:b6=[pscustomobject]@{owner=[pscustomobject]@{predecessorEntryKind='CurrentCore';core=[pscustomobject]@{root=$PSScriptRoot;manifestSha256=$oldHash};entry=[pscustomobject]@{root=$PSScriptRoot;leaf='run-current-owner.ps1';sha256=$hash;manifestSha256=$oldHash}};entryCapture=[pscustomobject]@{entries=$entries;directEntries=$direct}}
foreach($row in @($entries)+@($direct|Where-Object{$_.path-cne$active})){Hold-B6ReadPairEntry $row.path $hash}
$pipeName='MelisaActiveEntry-'+[guid]::NewGuid().ToString('N');$serverScript=Join-Path $PSScriptRoot 'server.ps1'
[IO.File]::WriteAllText($serverScript,('param($Name,$Entry);$f=[IO.File]::Open($Entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$p=[IO.Pipes.NamedPipeServerStream]::new($Name,[IO.Pipes.PipeDirection]::InOut);[Console]::WriteLine("READY");[Console]::Out.Flush();$p.WaitForConnection();Start-Sleep -Seconds 120'))
$si=[Diagnostics.ProcessStartInfo]::new();$si.FileName=Join-Path $PSHOME 'powershell.exe';$si.Arguments='-NoProfile -NonInteractive -File "'+$serverScript+'" "'+$pipeName+'" "'+$active+'"';$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true;$server=[Diagnostics.Process]::new();$server.StartInfo=$si;[void]$server.Start()
$pipe=$null;$peer=$null;$extra=$null;$busy=$null
try{
 if($server.StandardOutput.ReadLine()-cne'READY'){throw 'ISOLATED_SERVER_NOT_READY'}
 $pipe=[IO.Pipes.NamedPipeClientStream]::new('.',$pipeName,[IO.Pipes.PipeDirection]::InOut);$pipe.Connect(5000);$peer=[Business5244RetirementPeer]::CaptureServer($pipe);$script:control=$peer.OpenControlledShutdown();$peer.Dispose();$peer=$null
 if($control.TargetPid-ne$server.Id){throw 'ISOLATED_TARGET_NOT_OWN_CREATED_SERVER'}
 $script:status=@{ownerPid=$control.TargetPid;ownerBirth=$control.TargetBirth};$script:oldResourceRows=@(@{pid=$server.Id;birth=$control.TargetBirth})
 function Assert-OldTarget($Status){$control.Validate();if($Status.ownerPid-ne$server.Id-or$Status.ownerBirth-cne$control.TargetBirth){throw 'ISOLATED_FOREIGN_OLD_TARGET'}}
 function Get-CimInstance($ClassName){if($ClassName-cne'Win32_Process'){throw 'ISOLATED_FOREIGN_QUERY'};if($script:foreignLaunch){return @([pscustomobject]@{ProcessId=2147483000;CommandLine=('-File "'+$active+'"')})};return @()}
 function Wait-ResourceExit($Rows){return $server.HasExited}
 function Get-NetTCPConnection($LocalPort,$State){if($LocalPort-ne5244-or$State-cne'Listen'){throw 'ISOLATED_FOREIGN_PORT'};return @()}
 function Assert-ReadPairProtection{}
 function Record-Phase($Phase){}
 function Start-Frozen{$script:startCalls++;throw 'UNEXPECTED_OWNER_START'}
 __BEFORE_HOLD__
 if(!$script:skipAutomaticHold){Hold-B6ReadPairActiveEntry}
 __BODY__
}finally{
 if($extra){$extra.Dispose()};if($peer){$peer.Dispose()};if($pipe){$pipe.Dispose()}
 $handoff=if(Get-Variable ReadPairActiveHandoff -Scope Script -ErrorAction SilentlyContinue){$script:ReadPairActiveHandoff}else{$null};if($handoff-and$handoff.marker){$handoff.marker.CloseRetained()};if($handoff-and$handoff.lease){Exit-Business5244StartupLease $handoff.lease;$handoff.lease=$null};if($busy){Exit-Business5244StartupLease $busy}
 foreach($item in $held){$item.stream.Dispose()};if($control){$control.Dispose()};if(!$server.HasExited){$server.Kill();[void]$server.WaitForExit(5000)};$server.Dispose()
};'PASS'
`.replace('__STARTUP__',q(path.join(dir,'business-5244-startup-exclusion.ps1'))).replace('__PEER__',q(path.join(dir,'business-5244-retirement-peer.cs')));
const activeRun=(body,before='',fixture=activeFixture)=>run(fixture.replace('__BEFORE_HOLD__',before).replace('__BODY__',body));
win('RehearsalOnly stop dispatch and managed body contain no force-stop path in their selected AST branch',()=>{
 assert.equal(run(String.raw`
 $tokens=$null;$errors=$null;$source=(Get-Command Stop-ReadPairColdOwner).Definition;$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'STOP_SOURCE_PARSE'}
 $branch=@($ast.FindAll({param($n);$n-is[Management.Automation.Language.IfStatementAst]-and$n.Clauses.Count-eq1-and$n.Clauses[0].Item1.Extent.Text-ceq'$RehearsalOnly-or$CandidateInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$PreviewLinkInstall'},$true));if($branch.Count-ne1){throw 'MANAGED_STOP_BRANCH_MISSING'}
 $managed=@($branch[0].Clauses[0].Item2.FindAll({param($n);$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-ceq'Invoke-B6ReadPairManagedOwnerExit'},$true));if($managed.Count-ne1){throw 'MANAGED_STOP_NOT_DISPATCHED'}
 $force=@($branch[0].Clauses[0].Item2.FindAll({param($n);$n-is[Management.Automation.Language.InvokeMemberExpressionAst]-and$n.Member.Value-cin@('Stop','Kill','TerminateProcess')},$true));if($force.Count){throw 'FORCE_STOP_IN_REHEARSAL_BRANCH'}
 $body=(Get-Command Invoke-B6ReadPairManagedOwnerExit).Definition
 if($body-cmatch'\.Stop\(|\.Kill\(|TerminateProcess|Invoke-Expression'-or$body.IndexOf('[Threading.Mutex]::OpenExisting')-gt$body.IndexOf('Read-B6ReadPairManagedExitSignal')-or$body.IndexOf('.ValidateExited()')-gt$body.IndexOf('.CompleteManagedExit(')){throw 'MANAGED_NATIVE_ORDER_CHANGED'}
 'PASS'`),'PASS');
});
const managedServer=String.raw`param($Name,$Entry,$Mutex);$ErrorActionPreference='Stop';$m=[Threading.Mutex]::new($false,$Mutex);$owned=$false;$f=$null;$p=$null;try{$owned=$m.WaitOne(0);if(!$owned){throw 'ISOLATED_OWNER_MUTEX_BUSY'};$f=[IO.File]::Open($Entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$p=[IO.Pipes.NamedPipeServerStream]::new($Name,[IO.Pipes.PipeDirection]::InOut);[Console]::WriteLine("READY");[Console]::Out.Flush();$p.WaitForConnection();[Console]::WriteLine('CONNECTED');[Console]::Out.Flush();[Console]::ReadLine()|Out-Null}finally{if($p){$p.Dispose()};if($f){$f.Dispose()};if($owned){$m.ReleaseMutex()};$m.Dispose()}`;
const connectedAck="if($server.StandardOutput.ReadLine()-cne'CONNECTED'){throw 'ISOLATED_SERVER_NOT_CONNECTED'};";
const managedFixture=activeFixture
 .replace('@(1..3|ForEach-Object','@(1..11|ForEach-Object')
 .replace("param($Name,$Entry);$f=[IO.File]::Open($Entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$p=[IO.Pipes.NamedPipeServerStream]::new($Name,[IO.Pipes.PipeDirection]::InOut);[Console]::WriteLine(\"READY\");[Console]::Out.Flush();$p.WaitForConnection();Start-Sleep -Seconds 120",managedServer.replaceAll("'","''"))
 .replace("$si.UseShellExecute=$false;","$si.Arguments+=' \"'+(Get-Business5244StartupMutexName)+'\"';$si.UseShellExecute=$false;")
 .replace('$si.RedirectStandardError=$true;','$si.RedirectStandardError=$true;$si.RedirectStandardInput=$true;')
 .replace('$script:control=$peer.OpenControlledShutdown();','$script:control=$peer.OpenControlledShutdown();$script:ReadPairExitObservation=$peer.OpenExitObservation();')
 .replace("if($control.TargetPid-ne$server.Id)",connectedAck+"if($control.TargetPid-ne$server.Id)")
 .replace(' __BEFORE_HOLD__',` $script:RehearsalOnly=$true;$b6|Add-Member rehearsalOnly $true;$b6.owner|Add-Member recordBeforeSha256 '81862843a2595587771a8779b23a965b3139cbd8145680af52e4a663c7d2cc17'
 function Get-FileHash($LiteralPath){if($LiteralPath-ceq'C:\\Sirket\\ERP\\clean\\20261022\\runtime\\erp-processes.json'){return @{Hash=$b6.owner.recordBeforeSha256}};throw 'ISOLATED_FOREIGN_FILE_HASH'}
 __BEFORE_HOLD__`)
 .replace('if(!$server.HasExited){$server.Kill();[void]$server.WaitForExit(5000)};',"if(!$server.HasExited){$server.StandardInput.Close();if(!$server.WaitForExit(5000)){throw 'ISOLATED_COOPERATIVE_CLEANUP_FAILED'}};if(Get-Variable ReadPairExitObservation -Scope Script -ErrorAction SilentlyContinue){if($script:ReadPairExitObservation-is[IDisposable]){$script:ReadPairExitObservation.Dispose()}};if(Get-Variable ReadPairPreheldMutex -Scope Script -ErrorAction SilentlyContinue){if($script:ReadPairPreheldMutex){$script:ReadPairPreheldMutex.Dispose()}};");
win('disposable managed server exposes the broken-pipe race when its client closes before barrier-delayed WaitForConnection',()=>{
 // Reproduce the original fixture lifetime, not a production stop: the old
 // client closed before the server had acknowledged WaitForConnection.
 const delayed=managedFixture.replace(connectedAck,'').replace("$ErrorActionPreference=''Stop'';",'').replace('$peer.Dispose();$peer=$null', '$peer.Dispose();$peer=$null;$pipe.Dispose();$pipe=$null').replace('$p.WaitForConnection();',"while(![IO.File]::Exists($Entry+''.allowwait'')){[Threading.Thread]::Sleep(10)};$p.WaitForConnection();").replace('if(!$server.HasExited){$server.StandardInput.Close();',"if(!$server.HasExited){[IO.File]::WriteAllText(($active+'.allowwait'),'ready');$server.StandardInput.Close();");
 assert.equal(activeRun(String.raw`
 $denied=$false;try{$control.Validate()}catch{$denied=$true};if(!$denied-or!$server.HasExited){throw 'DISPOSABLE_PIPE_RACE_NOT_OBSERVED'};('PASS exit='+$server.ExitCode)
 `,String.raw`
 $script:skipAutomaticHold=$true
 [IO.File]::WriteAllText(($active+'.allowwait'),'ready')
 if(!$server.WaitForExit(5000)){throw 'DISPOSABLE_PIPE_RACE_SERVER_STILL_LIVE'}
 $errorText=$server.StandardError.ReadToEnd();if($errorText-notmatch'(?i)(?:pipe.*broken|IOException|WaitForConnection)'){throw 'DISPOSABLE_PIPE_RACE_NOT_IO_FAILURE'}
 `,delayed).startsWith('PASS exit=0'),true);
});
win('RehearsalOnly managed exit uses a genuine observer and the same contended mutex before normal finally and exclusive handoff',()=>{
 const answer=activeRun(String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_MANAGED_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit
 if(!$control.CompletedStop-or!$server.HasExited-or$server.ExitCode-ne0-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1-or!$script:ReadPairPreheldMutex){throw 'MANAGED_EXIT_PROOF_MISSING'}
 $script:ReadPairExitObservation.ValidateExited();$control.ValidateCompletedStop();Complete-B6ReadPairActiveEntryHandoff
 $h=Get-B6ReadPairActiveHandoff;if($h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$h.lease-or$held.Count-ne18-or@($held|Where-Object{$_.holdMode-cne'Exclusive'}).Count){throw 'MANAGED_EXIT_HANDOFF_NOT_EXCLUSIVE'}
 $lease=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $lease
 `,'',managedFixture);assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('RehearsalOnly managed exit rejects forged and disposed observers before prompting or completing the live target',()=>{
 const answer=activeRun(String.raw`
 $real=$script:ReadPairExitObservation;$script:signals=0;function Read-B6ReadPairManagedExitSignal{$script:signals++;throw 'UNEXPECTED_SIGNAL_READ'}
 foreach($bad in @([pscustomobject]@{TargetPid=$control.TargetPid;TargetBirth=$control.TargetBirth},$null)){
  $script:ReadPairExitObservation=$bad;$denied=$false;try{Invoke-B6ReadPairManagedOwnerExit}catch{$denied=$true};if(!$denied-or$control.CompletedStop-or$server.HasExited-or$script:signals-or(Get-B6ReadPairActiveHandoff).stopAttempted){throw 'FORGED_OBSERVER_ALLOWED_EXIT'}
 }
 $script:ReadPairExitObservation=$real;$real.Dispose();$denied=$false;try{Invoke-B6ReadPairManagedOwnerExit}catch{$denied=$true}
 if(!$denied-or$control.CompletedStop-or$server.HasExited-or$script:signals-or(Get-B6ReadPairActiveHandoff).stopAttempted){throw 'DISPOSED_OBSERVER_ALLOWED_EXIT'}
 `,'',managedFixture);assert.match(answer,/PASS$/);
});
for(const signal of ['WRONG_SIGNAL','MANAGED_EXIT_OBSERVED'])win(`RehearsalOnly console ${signal==='WRONG_SIGNAL'?'wrong signal':'signal before native exit'} is never completion authority`,()=>{
 const answer=activeRun(`function Read-B6ReadPairManagedExitSignal{return '${signal}'};`+String.raw`
 $denied=$false;try{Invoke-B6ReadPairManagedOwnerExit}catch{$denied=$true}
 $h=Get-B6ReadPairActiveHandoff;if(!$denied-or$control.CompletedStop-or$server.HasExited-or$result.stopCalls-ne0-or$h.marker.Deleted-or!$h.stopAttempted-or!$script:ReadPairPreheldMutex){throw 'CONSOLE_TEXT_COMPLETED_LIVE_OWNER'}
 `,'',managedFixture);assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('RehearsalOnly managed exit retains the old mutex so standard abandoned-owner rejection blocks exclusive publication',()=>{
 const abandoned=managedFixture.replace('if($owned){$m.ReleaseMutex()}','if($owned){$owned=$false}');
 const answer=activeRun(String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)){throw 'ISOLATED_EXIT_TIMEOUT'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true}
 $h=Get-B6ReadPairActiveHandoff;if(!$denied-or!$control.CompletedStop-or$h.phase-cne'FailedShared'-or$h.upgradeAttempted-or$h.marker.Deleted-or$result.stopCalls-ne0){throw 'ABANDONED_OLD_MUTEX_BYPASSED'}
 `,'',abandoned);assert.match(answer,/PASS$/);
});
win('active entry shares only reads until the same authenticated native stop then upgrades under an actual isolated maintenance lease',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;if($h.phase-cne'Shared'-or$h.item.holdMode-cne'Shared'-or$control.CompletedStop){throw 'ACTIVE_NOT_SHARED'}
 $extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$extra.Dispose();$extra=$null
 $denied=$false;try{$writer=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::Read);$writer.Dispose()}catch{$denied=$true};if(!$denied){throw 'ACTIVE_WRITABLE_PRESTOP'}
 $denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied-or$h.lease-or$h.upgradeAttempted){throw 'ENTRY_UPGRADED_WITHOUT_NATIVE_STOP'}
 $control.Stop();$control.ValidateCompletedStop();Complete-B6ReadPairActiveEntryHandoff;Assert-B6ReadPairEntryHandoffReady
 if($h.phase-cne'ExclusiveVerified'-or$h.item.holdMode-cne'Exclusive'-or$h.lease){throw 'ACTIVE_UPGRADE_NOT_VERIFIED'}
 foreach($item in $held){$denied=$false;try{$reader=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$reader.Dispose()}catch{$denied=$true};if(!$denied){throw 'ENTRY_NOT_EXCLUSIVE_AFTER_STOP'}}
 $check=Enter-Business5244StartupLease -Kind Maintenance;Exit-Business5244StartupLease $check
 if($control.GetType().GetProperty('CompletedStop').GetSetMethod($false)){throw 'PUBLIC_COMPLETION_SETTER'}
 $control.Dispose();$denied=$false;try{$control.ValidateCompletedStop()}catch{$denied=$true};if(!$denied){throw 'DISPOSED_STOP_PROOF_ACCEPTED'}
 `),'PASS');
});
win('a competing reader after native stop rejects exclusive upgrade, retains the pinned shared seal and maintenance exclusion, and cannot start recovery',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$denied=$false
 try{Complete-B6ReadPairActiveEntryHandoff}catch{if($_.Exception.Message-cne'B6_ACTIVE_ENTRY_HANDOFF_RECOVERY_REQUIRED'){throw};$denied=$true}
 $h=Get-B6ReadPairActiveHandoff;if(!$denied-or$h.phase-cne'FailedShared'-or$h.item.holdMode-cne'Shared'-or!$h.item.stream.CanRead-or!$h.lease){throw 'UPGRADE_FAILURE_DROPPED_SEAL_OR_GATE'}
 Assert-Business5244StartupLease $h.lease -Kind Maintenance
 foreach($call in @('ready','start','restore','close')){$denied=$false;try{switch($call){'ready'{Assert-B6ReadPairEntryHandoffReady}'start'{Start-ReadPairPreparedOwner}'restore'{Restore-ReadPairBeforeRetire -OldStopped $true}'close'{Close-ReadPairPublication}}}catch{$denied=$true};if(!$denied){throw ('UNCERTAIN_HANDOFF_CONTINUED_'+$call)}}
 if($script:startCalls-ne0-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $h.item.stream))-cne$hash){throw 'UNCONFIRMED_HANDOFF_STARTED_OR_CHANGED_ENTRY'}
 `),'PASS');
});
win('maintenance lease contention after the proved stop keeps the active entry shared and never retries the native stop or launcher',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$busy=Enter-Business5244StartupLease -Kind Maintenance;$denied=$false
 try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedShared'-or$h.item.holdMode-cne'Shared'-or$h.upgradeAttempted-or$script:startCalls){throw 'BUSY_GATE_UPGRADED_OR_STARTED'}
 $denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied){throw 'FAILED_HANDOFF_RETRIED'};$control.ValidateCompletedStop()
 `),'PASS');
});
win('foreign entry launch observations after stop prevent upgrade without granting any foreign kill or restart',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$script:foreignLaunch=$true;$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedShared'-or$h.item.holdMode-cne'Shared'-or$h.upgradeAttempted-or!$h.lease-or$script:startCalls){throw 'FOREIGN_LAUNCH_IGNORED'}
 $actual=$control;$script:control=[pscustomobject]@{TargetPid=$actual.TargetPid;TargetBirth=$actual.TargetBirth;CompletedStop=$true};$denied=$false;try{Get-B6ReadPairActiveHandoff|Out-Null}catch{$denied=$true};$script:control=$actual;if(!$denied){throw 'SCALAR_NATIVE_PROOF_ADMITTED'}
 `),'PASS');
});
win('the durable owned pending marker blocks Owner after all process-local leases and handles are released on an uncertain upgrade',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;$pending=Get-Business5244RetirementPendingPath
 if(!(Test-Path -LiteralPath $pending)-or$h.marker.Deleted){throw 'DURABLE_MARKER_MISSING'}
 $control.Stop();$extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied){throw 'UPGRADE_SHOULD_HAVE_FAILED'}
 Exit-Business5244StartupLease $h.lease;$h.lease=$null;$h.marker.CloseRetained()
 $denied=$false;try{$lease=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $lease}catch{if($_.Exception.Message-cne'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'){throw};$denied=$true}
 if(!$denied-or!(Test-Path -LiteralPath $pending)-or$script:startCalls){throw 'PROCESS_EXIT_LOST_DURABLE_EXCLUSION'}
 `),'PASS');
});
win('an existing foreign pending marker is neither adopted nor removed and prevents the native stop',()=>{
 assert.equal(activeRun(String.raw`
 $pending=Get-Business5244RetirementPendingPath;if([IO.File]::ReadAllText($pending)-cne'foreign-marker'-or$control.CompletedStop-or$server.HasExited-or$result.stopCalls){throw 'FOREIGN_MARKER_CHANGED_OR_STOPPED'}
 $denied=$false;try{Stop-ReadPairColdOwner}catch{$denied=$true};if(!$denied-or$server.HasExited-or$result.stopCalls){throw 'FOREIGN_MARKER_ALLOWED_STOP'}
 `,String.raw`
 $script:skipAutomaticHold=$true;[IO.File]::WriteAllText((Get-Business5244RetirementPendingPath),'foreign-marker');$denied=$false
 try{Hold-B6ReadPairActiveEntry}catch{if($_.Exception.Message-cne'B6_ACTIVE_ENTRY_FOREIGN_PENDING_MARKER'){throw};$denied=$true};if(!$denied){throw 'FOREIGN_PENDING_ADOPTED'}
 `),'PASS');
});
win('corrupting the retained marker bytes rejects stop and deletion instead of treating a path or JSON record as authority',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;$flags=[Reflection.BindingFlags]'Instance,NonPublic';$stream=$h.marker.GetType().GetField('stream',$flags).GetValue($h.marker)
 $stream.Position=0;$stream.WriteByte(0);$stream.Flush($true);$denied=$false
 try{Stop-ReadPairColdOwner}catch{$denied=$true};if(!$denied-or$h.stopAttempted-or$server.HasExited-or$result.stopCalls){throw 'CORRUPT_MARKER_ALLOWED_STOP'}
 $denied=$false;try{Cancel-B6ReadPairActiveEntryHandoff}catch{$denied=$true};if(!$denied-or$h.marker.Deleted){throw 'CORRUPT_MARKER_REMOVED'}
 $h.marker.CloseRetained();if(!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'CORRUPT_MARKER_NOT_DURABLE'}
 `),'PASS');
});
win('failed marker flush prevents stop and leaves an untrusted pending file rather than granting a retry',()=>{
 const fixture=activeFixture.replace('Add-Type -TypeDefinition $nativeSource',String.raw`$nativeSource=$nativeSource.Replace('stream.Flush(true);Validate();','stream.Flush(true);throw new IOException("ISOLATED_MARKER_FLUSH_FAILED");');Add-Type -TypeDefinition $nativeSource`);
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;if($h.phase-cne'MarkerPending'-or$h.marker-or$h.stopAttempted-or$server.HasExited-or$result.stopCalls-or!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'FLUSH_FAILURE_GRANTED_HANDOFF'}
 $denied=$false;try{Stop-ReadPairColdOwner}catch{$denied=$true};if(!$denied-or$server.HasExited){throw 'FLUSH_FAILURE_STOPPED_OWNER'}
 `,String.raw`
 $script:skipAutomaticHold=$true;$denied=$false;try{Hold-B6ReadPairActiveEntry}catch{if($_.Exception.ToString()-cnotmatch'ISOLATED_MARKER_FLUSH_FAILED'){throw};$denied=$true};if(!$denied){throw 'MARKER_FLUSH_FAILURE_NOT_REACHED'}
 `,fixture),'PASS');
});
win('maintenance lease exit failure retains the durable marker and cannot report an exclusive ready handoff',()=>{
 assert.equal(activeRun(String.raw`
 $script:originalExit=(Get-Command Exit-Business5244StartupLease).ScriptBlock;$script:failExit=$true
 function Exit-Business5244StartupLease($Lease){if($script:failExit){$script:failExit=$false;throw 'ISOLATED_EXIT_FAILURE'};& $script:originalExit $Lease}
 $control.Stop();$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedExclusive'-or!$h.lease-or$h.marker.Deleted-or!(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'EXIT_FAILURE_REMOVED_PENDING_OR_CLAIMED_READY'}
 $denied=$false;try{Assert-B6ReadPairEntryHandoffReady}catch{$denied=$true};if(!$denied){throw 'EXIT_FAILURE_READY'}
 `),'PASS');
});
win('an unattempted pre-stop abort removes only its own marker while the authenticated native owner is still alive',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;Cancel-B6ReadPairActiveEntryHandoff
 if($h.phase-cne'CancelledBeforeStop'-or!$h.marker.Deleted-or(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))-or$server.HasExited-or$control.CompletedStop){throw 'PRESTOP_CANCEL_NOT_SAFE'}
 $control.Validate();$script:b6ReadProof=$null;$script:b6SourceHandles=@();Close-ReadPairPublication
 if($server.HasExited-or(Get-Business5244StartupHash ([IO.File]::ReadAllBytes($active)))-cne$hash){throw 'PRESTOP_CANCEL_CHANGED_OWNER_OR_ENTRY'}
 `),'PASS');
});

const routerFixture=activeFixture
 .replace("$entries=@(1..6", "$routerRoot=Join-Path $PSScriptRoot 'router';[void][IO.Directory]::CreateDirectory($routerRoot);$routerActive=Join-Path $routerRoot 'start-business-5244-readpair-router.ps1';[IO.File]::WriteAllText($routerActive,'inert-router-entry');$routerEntryHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($routerActive));$coreManifest=$oldHash;$script:oldRoot=$routerRoot;$script:oldHash=('b'*64)\n$entries=@(1..6")
 .replace("foreach($row in @($entries)+@($direct|Where-Object{$_.path-cne$active})){Hold-B6ReadPairEntry $row.path $hash}",String.raw`$direct+=,[pscustomobject]@{path=$routerActive;sha256=$routerEntryHash};$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.core.manifestSha256=$coreManifest;$b6.owner.core|Add-Member files @([pscustomobject]@{path='run-current-owner.ps1';sha256=$hash});$b6.owner|Add-Member router ([pscustomobject]@{root=$routerRoot;manifestSha256=$oldHash;entrySha256=$routerEntryHash});$b6.owner.entry=[pscustomobject]@{root=$routerRoot;leaf='start-business-5244-readpair-router.ps1';sha256=$routerEntryHash;manifestSha256=$oldHash};$b6.entryCapture.directEntries=$direct
foreach($row in @($entries)+@($direct|Where-Object{$_.path-cnotin@($active,$routerActive)})){Hold-B6ReadPairEntry $row.path $hash}`)
 .replace('param($Name,$Entry);$f=', 'param($Name,$Entry,$Router);$routerHold=[IO.File]::Open($Router,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$f=')
 .replace("+$active+'\"';$si.UseShellExecute", "+$active+'\" \"'+$routerActive+'\"';$si.UseShellExecute");
win('a typed ReadPairRouter holds exactly router plus core current read shares then upgrades both only after the same native stop',()=>{
 assert.equal(activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;$descriptors=@(Get-B6ReadPairActiveEntry)
 if($h.items.Count-ne2-or$descriptors.Count-ne2-or$h.items[0].path-cne$routerActive-or$h.items[1].path-cne$active-or$held.Count-ne11){throw 'TYPED_ROUTER_SET_NOT_EXACT_TWO'}
 foreach($item in $h.items){if($item.holdMode-cne'Shared'){throw 'ROUTER_ACTIVE_NOT_SHARED'};$extra=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$extra.Dispose();$extra=$null;$denied=$false;try{$w=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite);$w.Dispose()}catch{$denied=$true};if(!$denied){throw 'ROUTER_ACTIVE_WRITABLE'}}
 Stop-ReadPairColdOwner;Assert-B6ReadPairEntryHandoffReady
 if($result.stopCalls-ne1-or$h.phase-cne'ExclusiveVerified'-or$h.lease-or!$h.marker.Deleted-or(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'ROUTER_DUAL_UPGRADE_UNCONFIRMED'}
 foreach($item in $held){if($item.holdMode-cne'Exclusive'){throw 'ROUTER_ENTRY_NOT_EXCLUSIVE'};$denied=$false;try{$r=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$r.Dispose()}catch{$denied=$true};if(!$denied){throw 'ROUTER_EXCLUSIVE_SHARE_LOST'}}
 `,'',routerFixture),'PASS');
});
win('a second active-entry upgrade conflict preserves the first exclusive handle, second shared seal and durable pending marker',()=>{
 assert.equal(activeRun(String.raw`
 $control.Stop();$extra=[IO.File]::Open($active,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$denied=$false;try{Complete-B6ReadPairActiveEntryHandoff}catch{$denied=$true};$h=Get-B6ReadPairActiveHandoff
 if(!$denied-or$h.phase-cne'FailedShared'-or$h.items[0].holdMode-cne'Exclusive'-or$h.items[1].holdMode-cne'Shared'-or!$h.lease-or$h.marker.Deleted){throw 'PARTIAL_DUAL_UPGRADE_LOST_EXCLUSION'}
 foreach($item in $h.items){if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream))-cne$item.beforeHash){throw 'PARTIAL_DUAL_ENTRY_BYTES_CHANGED'}}
 foreach($call in @('ready','start','restore','close')){$denied=$false;try{switch($call){ready{Assert-B6ReadPairEntryHandoffReady}start{Start-ReadPairPreparedOwner}restore{Restore-ReadPairBeforeRetire -OldStopped $true}close{Close-ReadPairPublication}}}catch{$denied=$true};if(!$denied){throw 'PARTIAL_DUAL_HANDOFF_CONTINUED'}}
 Exit-Business5244StartupLease $h.lease;$h.lease=$null;$h.marker.CloseRetained();$denied=$false;try{$l=Enter-Business5244StartupLease -Kind Owner;Exit-Business5244StartupLease $l}catch{if($_.Exception.Message-cne'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'){throw};$denied=$true};if(!$denied-or$script:startCalls){throw 'PARTIAL_DUAL_DURABILITY_LOST'}
 `,'',routerFixture),'PASS');
});
win('typed router descriptors reject missing duplicate foreign and mismatched core entries before any native stop or marker creation',()=>{
 assert.equal(activeRun(String.raw`
 if($control.CompletedStop-or$server.HasExited-or$result.stopCalls-or(Test-Path -LiteralPath (Get-Business5244RetirementPendingPath))){throw 'INVALID_ROUTER_DESCRIPTOR_EFFECT'}
 `,String.raw`
 $script:skipAutomaticHold=$true;$originalFiles=$b6.owner.core.files;$originalEntry=$b6.owner.entry.PSObject.Copy();$originalDirect=$b6.entryCapture.directEntries
 foreach($kind in @('coreHash','missingCore','duplicateCore','foreignRouter','wrongCaseKind','directCoreHash','duplicateDirectCore')){
  $b6.owner.core.files=$originalFiles;$b6.owner.entry=$originalEntry.PSObject.Copy();$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.entryCapture.directEntries=@($originalDirect|ForEach-Object{$_.PSObject.Copy()})
  switch($kind){coreHash{$b6.owner.core.files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('f'*64)})}missingCore{$b6.owner.core.files=@()}duplicateCore{$b6.owner.core.files=@($originalFiles)+@($originalFiles)}foreignRouter{$b6.owner.entry.root=Join-Path $PSScriptRoot 'foreign'}wrongCaseKind{$b6.owner.predecessorEntryKind='readpairrouter'}directCoreHash{($b6.entryCapture.directEntries|Where-Object{$_.path-ceq$active}).sha256=('f'*64)}duplicateDirectCore{$b6.entryCapture.directEntries+=@($b6.entryCapture.directEntries|Where-Object{$_.path-ceq$active})}}
  $denied=$false;try{Get-B6ReadPairActiveEntry|Out-Null}catch{$denied=$true};if(!$denied){throw ('INVALID_ROUTER_DESCRIPTOR_ADMITTED_'+$kind)}
 }
 $b6.owner.core.files=$originalFiles;$b6.owner.entry=$originalEntry;$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.entryCapture.directEntries=$originalDirect
 `,routerFixture),'PASS');
});
win('typed ReadPairRouter argv retains its exact old router scope while Current recovery remains a separate fixed core entry',()=>{
 assert.equal(run(String.raw`
 $script:b6=@{owner=[pscustomobject]@{predecessorEntryKind='ReadPairRouter';core=@{root='C:\fixed\old-core';manifestSha256=('a'*64)};router=@{root='C:\fixed\old-router';manifestSha256=('b'*64)};entry=@{root='C:\fixed\old-router';leaf='start-business-5244-readpair-router.ps1';manifestSha256=('b'*64)}};routerRoot='C:\fixed\new-router';routerHash=('c'*64);coreRoot='C:\fixed\new-core';coreHash=('d'*64)}
 $old=Get-B6ReadPairOwnerArguments 'C:\fixed\old-router' ('b'*64);$current=Get-B6ReadPairOwnerArguments 'C:\fixed\new-core' ('d'*64)
 if($old-cnotmatch'start-business-5244-readpair-router.ps1 -ManifestSha256 B{64} -ScopeName TEST125-API-B6-ca620bac-20261028$'-or$current-cnotmatch'run-current-owner.ps1 -ManifestSha256 D{64}$'-or$current-cmatch'ScopeName'){throw 'TYPED_ROUTER_ARGV_CHANGED'}
 foreach($kind in @('leaf','root','hash','kind')){$entry=$b6.owner.entry.PSObject.Copy();$k=$b6.owner.predecessorEntryKind;switch($kind){leaf{$b6.owner.entry.leaf='run-current-owner.ps1'}root{$b6.owner.entry.root='C:\foreign'}hash{$b6.owner.entry.manifestSha256=('e'*64)}kind{$b6.owner.predecessorEntryKind='Router'}};$denied=$false;try{Get-B6ReadPairOwnerArguments 'C:\fixed\old-router' ('b'*64)|Out-Null}catch{$denied=$true};$b6.owner.entry=$entry;$b6.owner.predecessorEntryKind=$k;if(!$denied){throw 'TYPED_ROUTER_ARGV_WIDENED'}};'PASS'
 `),'PASS');
});
win('normal sequence admits exact target, one cold handoff and one retire before independently verified commit',()=>{assert.equal(run(inert+`$r=Invoke-ReadPairInstallSequence;if($r-cne'CandidateVerified'-or($calls-join'|')-cne'open|target|coldstop|start|ready|retire|readback|CandidateVerified|close'){throw 'ORDER'};'PASS'`),'PASS');});
win('ACK loss never resends retire and requires readonly final readback',()=>{assert.equal(run(inert+`function Send-ReadPairSingleRetire{$calls.Add('retire');throw 'ACK_LOST'};$r=Invoke-ReadPairInstallSequence;if($r-cne'CandidateVerified'-or@($calls|Where-Object {$_-ceq'retire'}).Count-ne1-or$calls.Contains('restore:True')-or!$calls.Contains('ACK_UNCONFIRMED_READONLY_RECONCILIATION')){throw 'REPLAYED'};'PASS'`),'PASS');});
win('native paired rollback is a distinct verified result, never a second controller API write',()=>{assert.equal(run(inert+`function Wait-ReadPairFinalState{return 'RollbackVerified'};$r=Invoke-ReadPairInstallSequence;if($r-cne'RollbackVerified'-or$calls.Contains('restore:True')-or@($calls|Where-Object {$_-ceq'retire'}).Count-ne1){throw 'ROLLBACK_REPLAYED'};'PASS'`),'PASS');});
win('unknown post-retire result retains gates and refuses stop, inverse or another retire',()=>{assert.equal(run(inert+`function Wait-ReadPairFinalState{throw 'UNKNOWN'};$denied=$false;try{Invoke-ReadPairInstallSequence}catch{$denied=$true};if(!$denied-or$calls.Contains('restore:True')-or$calls.Contains('restore:False')-or!$calls.Contains('OWNER_RECOVERY_REQUIRED_NO_SECOND_RETIRE')-or@($calls|Where-Object {$_-ceq'retire'}).Count-ne1-or$calls[-1]-cne'close'){throw 'UNSAFE_RECOVERY'};'PASS'`),'PASS');});
win('pre-retire startup failure uses cold recovery only; pre-target failure never stops a process',()=>{assert.equal(run(inert+`function Start-ReadPairPreparedOwner{throw 'START_FAILED'};try{Invoke-ReadPairInstallSequence}catch{};if(!$calls.Contains('restore:True')-or$calls.Contains('retire')){throw 'START_RECOVERY'};$calls.Clear();function Assert-ReadPairColdTarget{throw 'FOREIGN'};try{Invoke-ReadPairInstallSequence}catch{};if(!$calls.Contains('restore:False')-or$calls.Contains('coldstop')-or$calls.Contains('retire')){throw 'FOREIGN_STOPPED'};'PASS'`),'PASS');});
win('real temporary exclusive file CAS rejects foreign bytes and restores only its own projected hash',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$file=Join-Path $PSScriptRoot 'inert-entry.txt';$a=[Text.Encoding]::UTF8.GetBytes('original');$b=[Text.Encoding]::UTF8.GetBytes('gated');[IO.File]::WriteAllBytes($file,$a);$s=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);try{$denied=$false;try{Write-ReadPairHeldCas $s ('0'*64) $b}catch{$denied=$true};if(!$denied-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $s))-cne(Get-Business5244StartupHash $a)){throw 'FOREIGN_WRITE'};Write-ReadPairHeldCas $s (Get-Business5244StartupHash $a) $b;Write-ReadPairHeldCas $s (Get-Business5244StartupHash $b) $a;if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $s))-cne(Get-Business5244StartupHash $a)){throw 'INVERSE_FAILED'}}finally{$s.Dispose()};'PASS'`),'PASS');});
test('production entry is default-denied and has no SQL, task registration, blanket process kill or database restore',()=>{const text=fs.readFileSync(path.join(dir,'install-business-5244-readpair.ps1'),'utf8');assert.match(text,/if\(\$Library\)\{return\}/);assert.match(text,/READPAIR_REVIEWED_SOURCE_AND_SEPARATE_API_APPROVAL_REQUIRED/);assert.doesNotMatch(text,/Stop-Process|taskkill|Invoke-Sqlcmd|Register-ScheduledTask|RESTORE DATABASE|Set-MpPreference/i);assert.match(text,/841C99F9EA5CF38F20747F2550A97306EA3F68215600FA2EC5F17675EE2322EE/);});

win('bootstrap archive never counts as a paired commit and prior completed receipts are excluded',()=>{assert.equal(run(`$id='a'*32;$old='b'*32;$files=@([pscustomobject]@{Name=('5244-retirement.pending.'+$id+'.bootstrap.completed');FullName='bootstrap'},[pscustomobject]@{Name=('5244-retirement.pending.'+$id+'.completed');FullName='new'},[pscustomobject]@{Name=('5244-retirement.pending.'+$old+'.completed');FullName='old'});$c=@(Select-ReadPairCommitArchives $files @('old'));if($c.Count-ne1-or$c[0].FullName-cne'new'){throw 'ARCHIVE_SELECTION'};'PASS'`),'PASS');});
win('partial entry bytes block all inverse writes and helper removal instead of falsely reporting recovery',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$script:before=@{present=$true};$script:held=[Collections.Generic.List[object]]::new();$script:created=@();function Assert-ReadPairProtection{};function Record-Phase{throw 'FALSE_VERIFIED'};$a=[Text.Encoding]::UTF8.GetBytes('before');$b=[Text.Encoding]::UTF8.GetBytes('after');$partial=[Text.Encoding]::UTF8.GetBytes('part');foreach($index in @(1,2)){$f=Join-Path $PSScriptRoot ('entry'+$index);[IO.File]::WriteAllBytes($f,$(if($index-eq1){$b}else{$partial}));$h=[IO.File]::Open($f,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$held.Add(@{stream=$h;before=$a;beforeHash=(Get-Business5244StartupHash $a);afterHash=(Get-Business5244StartupHash $b);written=$true})};try{$denied=$false;try{Restore-ReadPairBeforeRetire -OldStopped $false}catch{if($_.Exception.Message-cne'READPAIR_HELD_ENTRY_RECOVERY_REQUIRED'){throw};$denied=$true};if(!$denied-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $held[0].stream))-cne(Get-Business5244StartupHash $b)){throw 'PARTIAL_FALSE_INVERSE'}}finally{foreach($x in $held){$x.stream.Dispose()}};'PASS'`),'PASS');});

win('fixed owner argv allows only Windows one terminal ASCII space, never extra arguments or whitespace',()=>{assert.equal(run(`$e='-NoProfile -File entry.ps1 -ManifestSha256 ABC';foreach($v in @($e,($e+' '))){if(!(Test-ReadPairOwnerArguments $v $e)){throw 'VALID_SERIALIZATION_REJECTED'}};foreach($v in @(($e+'  '),($e+[char]9),(' '+$e),($e+' -Other'))){if(Test-ReadPairOwnerArguments $v $e){throw 'FOREIGN_ARGV_ADMITTED'}};'PASS'`),'PASS');});

win('sealed published entry is readable by real Windows PowerShell while replacement and writes remain denied',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$f=Join-Path $PSScriptRoot 'inert-child.ps1';$bytes=[Text.Encoding]::UTF8.GetBytes("Write-Output 'SEALED_READ_OK'");$h=Publish-ReadPairSealedFile $f $bytes;try{$ps=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe';$answer=& $ps -NoProfile -NonInteractive -File $f;if($LASTEXITCODE-ne0-or$answer-cne'SEALED_READ_OK'){throw 'SCRIPT_LOAD_BLOCKED'};$denied=$false;try{$w=[IO.File]::Open($f,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::Read);$w.Dispose()}catch{$denied=$true};if(!$denied){throw 'SEAL_WRITE_ALLOWED'}}finally{$h.Dispose()};'PASS'`),'PASS');});

win('loader continuation accepts only the finite pre-retire failure plus verified Current recovery, never an issued or changed pair',()=>{assert.equal(run(`$f=@{status='FAILED_REVIEW_RECEIPT';failure='READPAIR_NEW_RESOURCES_RECOVERY_REQUIRED';retireAttempts=0;stopCalls=1;startCalls=1};$r=@{status='CURRENT_PAIR_FRESH_RECOVERED_VERIFIED';retireAttempts=0;apiRestarts=0;stopCalls=0;startCalls=1;protectionPreserved=$true;apiPackage='CANONICAL-TEST125-BUSINESS5244-10cdc0ee';webPackage='ERP-BUSINESS-WEB-5244-5cb682d8'};Assert-ReadPairLoaderContinuation $f $r;foreach($case in @('retire','api','unknown','protection','repeated')){$x=$f.Clone();$y=$r.Clone();switch($case){retire{$x.retireAttempts=1}api{$y.apiPackage='OTHER'}unknown{$x.failure='UNKNOWN'}protection{$y.protectionPreserved=$false}repeated{$y.startCalls=2}};$denied=$false;try{Assert-ReadPairLoaderContinuation $x $y}catch{$denied=$true};if(!$denied){throw 'CONTINUATION_BROADENED'}};'PASS'`),'PASS');});

win('exact baseline comparison ignores map property order but rejects added fields and changed values',()=>{assert.equal(run(`$a=@{planHash='p';baseHash='b';startupPath='s';apiPath='a';basePath='b';Current=@{startup='c';api='d'};Candidate=@{startup='e';api='f'}};$b=[pscustomobject]@{Candidate=[pscustomobject]@{api='f';startup='e'};Current=[pscustomobject]@{api='d';startup='c'};basePath='b';apiPath='a';startupPath='s';baseHash='b';planHash='p'};Assert-ReadPairExpectedEqual $a $b;$b.Candidate.api='other';$denied=$false;try{Assert-ReadPairExpectedEqual $a $b}catch{$denied=$true};if(!$denied){throw 'VALUE_DRIFT'};$s=@{listeners=@(@{LocalPort=1;LocalAddress='loopback';OwningProcess=2});processes=@(@{pid=2;birth='now';exe='fixed'});files=@(@{path='fixed';hash=('a'*64)})};$t=$s|ConvertTo-Json -Depth 8|ConvertFrom-Json;if((Get-ReadPairProtectionSignature $s)-cne(Get-ReadPairProtectionSignature $t)){throw 'ORDER_ONLY_DRIFT'};$t.files[0]|Add-Member -NotePropertyName Extra -NotePropertyValue 'no';$denied=$false;try{Get-ReadPairProtectionSignature $t}catch{$denied=$true};if(!$denied){throw 'ADDITIONAL_FIELD'};'PASS'`),'PASS');});

win('authenticated final Unknown is an immediate readonly terminal failure; a foreign peer cannot settle a result',()=>{assert.equal(run(`$x=@{nativePeerVerified=$true;reply='Status';state=@{ownerPid=42;ownerBirth='1234';phase='Unknown'}};$caught=$null;try{Get-ReadPairFinalPeerState $x 42 '1234'}catch{$caught=$_.Exception.Message};if($caught-cne'READPAIR_FINAL_OWNER_UNKNOWN'){throw 'UNKNOWN_HIDDEN_BY_POLLING'};$x.state.phase='Running';$x.state.ownerPid=43;$caught=$null;try{Get-ReadPairFinalPeerState $x 42 '1234'}catch{$caught=$_.Exception.Message};if($caught-cne'READPAIR_FINAL_PEER_CHANGED'){throw 'FOREIGN_PEER_ACCEPTED'};'PASS'`),'PASS');});

win('metadata baseline has only the three exact observed snapshots and grants no Unknown shutdown admission',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-retirement-state.ps1'))} -Library;$old=Get-Business5244CurrentBootstrapPins;$known=Get-Business5244CurrentBootstrapPins '3bfd7f5df1aaedae5835709fd048f27cf35aa97f97a7c561cbd89ee0342827fc';$second=Get-Business5244CurrentBootstrapPins 'f0ace9f544671c8028d374e41ceb69a743fb01975998ea4bfedf4ec7661823c7';$foreign=Get-Business5244CurrentBootstrapPins ('0'*64);if($second.pid-ne41116-or$second.root-cne$known.root-or$second.source-cne$known.source-or$old.pid-ne2000-or$known.pid-ne25564-or$known.root-cnotlike'*ERP-BUSINESS-WEB-5244-5cb682d8'-or$foreign.hash-ceq('0'*64)){throw 'BASELINE_SCOPE_CHANGED'};'PASS'`),'PASS');});

win('protection snapshot accepts lower capture and upper live SHA256 for four unchanged files without normalizing paths or identities',()=>{
 assert.equal(run(String.raw`
 $script:before=[pscustomobject]@{listeners=@([pscustomobject]@{LocalPort=4146;LocalAddress='127.0.0.1';OwningProcess=11},[pscustomobject]@{LocalPort=5194;LocalAddress='127.0.0.1';OwningProcess=12},[pscustomobject]@{LocalPort=5234;LocalAddress='127.0.0.1';OwningProcess=13});processes=@(11..13|ForEach-Object{[pscustomobject]@{pid=$_;birth='2026-10-29T00:00:00.0000000Z';exe='C:\fixture\node.exe'}});files=@(1..4|ForEach-Object{[pscustomobject]@{path=('C:\fixture\protected-'+$_+'.json');hash=(('a1b2c3d'+$_)*8)}})}
 $script:live=$before|ConvertTo-Json -Depth 8|ConvertFrom-Json
 foreach($file in $live.files){$file.hash=$file.hash.ToUpperInvariant()}
 if((Get-ReadPairProtectionSignature $before)-cne(Get-ReadPairProtectionSignature $live)){throw 'HASH_CASE_ONLY_DRIFT'}
 function Protection-Snapshot{return $script:live};Assert-ReadPairProtection
 foreach($case in @('digit','path-case','pid','birth','exe-case')){
  $script:live=$before|ConvertTo-Json -Depth 8|ConvertFrom-Json
  switch($case){digit{$live.files[0].hash='f'+$live.files[0].hash.Substring(1)}'path-case'{$live.files[0].path=$live.files[0].path.ToUpperInvariant()}pid{$live.processes[0].pid++}birth{$live.processes[0].birth='2026-10-29T00:00:00.0000001Z'}'exe-case'{$live.processes[0].exe=$live.processes[0].exe.ToUpperInvariant()}}
  $caught='';try{Assert-ReadPairProtection}catch{$caught=$_.Exception.Message};if($caught-cne'READPAIR_PROTECTION_CHANGED'){throw ('NON_HASH_VALUE_NORMALIZED_'+$case)}
 };'PASS'`),'PASS');
});
win('protection snapshot rejects missing or extra fields and malformed SHA256 rather than treating them as matching evidence',()=>{
 assert.equal(run(String.raw`
 $saved=[pscustomobject]@{listeners=@();processes=@();files=@([pscustomobject]@{path='C:\fixture\protected.json';hash=('a'*64)})}|ConvertTo-Json -Depth 8
 foreach($bad in @('hash',('a'*63),('a'*65),('g'*64),('a'*63+' '),(([string][char]0xFF21)*64),$null,123)){
  $s=$saved|ConvertFrom-Json;$s.files[0].hash=$bad;$denied=$false;try{Get-ReadPairProtectionSignature $s|Out-Null}catch{$denied=$true};if(!$denied){throw 'MALFORMED_HASH_ACCEPTED'}
 }
 foreach($case in @('missing-hash','extra-file','extra-top','missing-top')){
  $s=$saved|ConvertFrom-Json
  switch($case){'missing-hash'{$s.files[0].PSObject.Properties.Remove('hash')}'extra-file'{$s.files[0]|Add-Member unexpected $true}'extra-top'{$s|Add-Member unexpected $true}'missing-top'{$s.PSObject.Properties.Remove('files')}}
  $denied=$false;try{Get-ReadPairProtectionSignature $s|Out-Null}catch{$denied=$true};if(!$denied){throw ('MALFORMED_SNAPSHOT_ACCEPTED_'+$case)}
 };'PASS'`),'PASS');
});

const projectionSetup=String.raw`. ${q(path.join(dir,'start-business-5244-web.ps1'))} -Library;. ${q(path.join(dir,'test125-bound-maintenance-plan.ps1'))} -Library;
function FixtureStartup([string]$Name){$s=Get-Test125ReadPairScope -Name $Name;return [pscustomobject][ordered]@{SourceCommit=$s.source;ExpectedDatabase=$s.database;RepoRoot='C:\Sirket\ERP\melisa-erp-v2';TaskName='Melisa-ERP-TEST-Canonical';ApiComponent=$s.current;ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778';ManifestSha256='0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64';ConfigPath='C:\fixture\base-profile.json';NodePath=(Get-Business5244WebPins).node;NodeSha256=(Get-Business5244WebPins).nodeHash}};
function Bytes($Value){return ,([Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 100)))};`;
win('READ2b pure projection keeps original seal-only serialized candidate and has no native admission dependency',()=>{assert.equal(run(projectionSetup+`$name='TEST125-API-READ2b-20261028-41d3c213';$startup=Bytes (FixtureStartup $name);$api=Bytes ([pscustomobject][ordered]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-10cdc0ee'};secretFixture='unchanged'});function Assert-ErpBusinessSaleNativeProfileAdmission{throw 'NATIVE_CALLED'};$r=Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64);$after=[Text.Encoding]::UTF8.GetString($api)|ConvertFrom-Json;$after.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213';if($r.Current.api-cne(Get-Business5244StartupHash $api)-or$r.Candidate.api-cne(Get-Business5244StartupHash (Bytes $after))-or$r.baseHash-cne('a'*64)-or$r.planHash-cnotmatch'^[a-f0-9]{64}$'){throw 'LEGACY_PROJECTION_CHANGED'};$deny=$false;try{Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64) -NativeProfileAdmission ([pscustomobject]@{})|Out-Null}catch{$deny=$true};if(!$deny){throw 'OLD_SCOPE_ACCEPTED_NATIVE'};'PASS'`),'PASS');});
win('B6 pure expected projection uses only the issued native candidate bytes and rejects a changed before-image or foreign token',()=>{assert.equal(run(projectionSetup+`$name='TEST125-API-B6-ca620bac-20261028';$startup=Bytes (FixtureStartup $name);$api=Bytes ([pscustomobject]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'};secretFixture='unchanged'});$script:fixtureToken=[pscustomobject]@{fixture='same-object'};$script:fixtureBeforeHash=Get-Business5244StartupHash $api;$candidate=[Text.Encoding]::UTF8.GetString($api)|ConvertFrom-Json;$candidate.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028';$candidate|Add-Member businessSaleWritesEnabled $false;$candidate|Add-Member businessSaleAdmission ([pscustomobject]@{fixture='descriptor'});$script:fixtureCandidate=Bytes $candidate;
function Assert-ErpBusinessSaleNativeProfileAdmission($Admission,$Phase){if(![object]::ReferenceEquals($Admission,$script:fixtureToken)-or$Phase-cne'Prepared'){throw 'FIXTURE_NOT_ISSUED'};return $true};function Get-ErpBusinessSaleNativeAdmissionContext($Admission){[void](Assert-ErpBusinessSaleNativeProfileAdmission $Admission Prepared);return @{profileBeforeHash=$script:fixtureBeforeHash;rehearsalOnly=$false}};function Get-ErpBusinessSaleCandidateProfileBytes($Admission){[void](Assert-ErpBusinessSaleNativeProfileAdmission $Admission Prepared);return ,([byte[]]$script:fixtureCandidate.Clone())};
$r=Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64) -ScopeName $name -NativeProfileAdmission $script:fixtureToken;if($r.Candidate.api-cne(Get-Business5244StartupHash $script:fixtureCandidate)-or$r.Current.api-cne$script:fixtureBeforeHash-or$r.planHash-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_PROJECTION_CHANGED'};foreach($kind in @('foreignToken','before','source','scope')){$st=$startup;$ap=$api;$token=$script:fixtureToken;$n=$name;switch($kind){foreignToken{$token=[pscustomobject]@{fixture='same-object'}}before{$ap=Bytes ([pscustomobject]@{changed=$true})}source{$c=FixtureStartup $name;$c.SourceCommit='ca620bac30f96034b33d4410dc43576a38a38707';$st=Bytes $c}scope{$n='OTHER'}};$deny=$false;try{Get-ReadPairExpectedProjection -StartupBytes $st -ApiBytes $ap -BaseProfileSha256 ('a'*64) -ScopeName $n -NativeProfileAdmission $token|Out-Null}catch{$deny=$true};if(!$deny){throw 'B6_PROJECTION_WIDENED'}};'PASS'`),'PASS');});
win('B6 installer executable entry rejects absent isolated owner bundle before proof directory, private hash, stop or publication',()=>{assert.equal(run(`$source=[IO.File]::ReadAllText(${q(path.join(dir,'install-business-5244-readpair.ps1'))});$production='C:\\Sirket\\ERP\\evidence\\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\\private\\b6-passive-pair-ca620bac-20261028';if(!$source.Contains($production)){throw 'FIXTURE_FIXED_ROOT_MISSING'};$isolated=Join-Path $PSScriptRoot 'absent-private-root';$entry=Join-Path $PSScriptRoot 'isolated-installer.ps1';[IO.File]::WriteAllText($entry,$source.Replace($production,$isolated));$script:calls=0;function Get-FileHash{$script:calls++;throw 'UNEXPECTED_HASH'};function Read-ErpStartupConfig{$script:calls++;throw 'UNEXPECTED_PRIVATE'};function Start-Process{$script:calls++;throw 'UNEXPECTED_START'};$caught='';try{& $entry -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Apply -SourceSha256 ('0'*64)}catch{$caught=$_.Exception.Message};if($caught-cne'B6_OWNER_BUNDLE_NOT_PREPARED'-or$script:calls-ne0){throw 'B6_EXECUTABLE_BROADENED'};'PASS'`),'PASS');});

win('real native admission validator rejects a forged JSON token before SQL or protected-file reads in either expected-hash entry',()=>{assert.equal(run(projectionSetup+`function Open-ErpBusinessSaleSqlConnection{throw 'UNEXPECTED_SQL'};$name='TEST125-API-B6-ca620bac-20261028';$startup=Bytes (FixtureStartup $name);$api=Bytes ([pscustomobject]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'}});foreach($entry in @('projection','files')){$caught='';try{if($entry-ceq'projection'){Get-ReadPairExpectedProjection -StartupBytes $startup -ApiBytes $api -BaseProfileSha256 ('a'*64) -ScopeName $name -NativeProfileAdmission ([pscustomobject]@{schema='melisa-b6-finite-native-profile.v1';id='a'*32})|Out-Null}else{Get-ReadPairExpectedHashes -ScopeName $name -NativeProfileAdmission ([pscustomobject]@{schema='melisa-b6-finite-native-profile.v1';id='a'*32})|Out-Null}}catch{$caught=$_.Exception.Message};if($caught-cne'B6_NATIVE_ADMISSION_NOT_ISSUED'){throw ('FORGED_ADMISSION '+$entry+' '+$caught)}};'PASS'`),'PASS');});

win('B6 controller preflight issues its own native and release proof before any stop and aborts on SQL or task rejection',()=>{assert.equal(run(String.raw`$script:calls=[Collections.Generic.List[string]]::new();$script:cap=[pscustomobject]@{};$script:proof=[pscustomobject]@{};$script:reject='';function Read-ErpStartupConfig($Path){$calls.Add('config');return @{fixture='current'}};function New-ErpBusinessSaleNativeProfileAdmission($Config){$calls.Add('native');if($reject-ceq'native'){throw 'FIXTURE_TLS_REJECT'};return $cap};function Assert-ErpBusinessSaleNativeProfileAdmission($Admission,$Phase){if(![object]::ReferenceEquals($cap,$Admission)-or$Phase-cne'Prepared'){throw 'CAP_CHANGED'};$calls.Add('assert')};function New-ErpReadPairPreparedReleaseProof($Config,$ScopeName,$NativeProfileAdmission){if(![object]::ReferenceEquals($cap,$NativeProfileAdmission)-or$ScopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'PROOF_CHANGED'};$calls.Add('release');return $proof};function Get-Test125BoundMaintenancePlan($RunId,[switch]$ReadPairPreparation,$ReadPairMode,$PreparedReleaseProof){if(![object]::ReferenceEquals($proof,$PreparedReleaseProof)-or!$ReadPairPreparation-or$ReadPairMode-cne'Current'-or$RunId-cne'TEST125-API-B6-ca620bac-20261028'){throw 'TASK_PROOF_CHANGED'};$calls.Add('task');if($reject-ceq'task'){throw 'FIXTURE_TASK_REJECT'}};function Get-ReadPairExpectedHashes($ScopeName,$NativeProfileAdmission){if(![object]::ReferenceEquals($cap,$NativeProfileAdmission)-or$ScopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'PROFILE_PROOF_CHANGED'};$calls.Add('profile')};function Stop-ReadPairColdOwner{throw 'UNEXPECTED_STOP'};Initialize-B6ReadPairControllerPreflight;if(($calls-join'|')-cne'config|native|assert|release|task|profile'){throw 'PREFLIGHT_ORDER'};foreach($kind in @('native','task')){$calls.Clear();$script:reject=$kind;$caught=$false;try{Initialize-B6ReadPairControllerPreflight}catch{$caught=$true};if(!$caught-or$calls.Contains('profile')-or($kind-ceq'native'-and$calls.Contains('release'))){throw 'PREFLIGHT_CONTINUED'}};'PASS'`),'PASS');});

win('B6 exact current and generated owner argv cannot be interchanged or supplied an arbitrary root or hash',()=>{assert.equal(run(String.raw`$script:b6=@{owner=[pscustomobject]@{predecessorEntryKind='CurrentCore';core=@{root='C:\fixed\old';manifestSha256=('a'*64)};entry=@{root='C:\fixed\old';leaf='run-current-owner.ps1';manifestSha256=('a'*64)}};routerRoot='C:\fixed\new';routerHash=('b'*64);coreRoot='C:\fixed\core';coreHash=('c'*64)};$old=Get-B6ReadPairOwnerArguments 'C:\fixed\old' ('a'*64);$new=Get-B6ReadPairOwnerArguments 'C:\fixed\new' ('b'*64);$rollback=Get-B6ReadPairOwnerArguments 'C:\fixed\core' ('c'*64);if($old-cmatch'ScopeName'-or$old-cnotmatch'run-current-owner.ps1 -ManifestSha256 A{64}$'-or$new-cnotmatch' -ScopeName TEST125-API-B6-ca620bac-20261028$'-or$rollback-cnotmatch'run-current-owner.ps1 -ManifestSha256 C{64}$'){throw 'ARGV_MIXED'};foreach($pair in @(@{root='C:\foreign';hash=('a'*64)},@{root='C:\fixed\new';hash=('a'*64)})){$deny=$false;try{Get-B6ReadPairOwnerArguments $pair.root $pair.hash|Out-Null}catch{$deny=$true};if(!$deny){throw 'ARGV_WIDENED'}};$full='C:\Windows\powershell.exe '+$old;$fullHash=Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($full));if($fullHash-ceq(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($old)))-or$fullHash-ceq(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($full+' ')))){throw 'FULL_CIM_ARGV_NORMALIZED'};$b6.owner.predecessorEntryKind='Router';$denied=$false;try{Get-B6ReadPairOwnerArguments 'C:\fixed\old' ('a'*64)|Out-Null}catch{$denied=$true};if(!$denied){throw 'ROUTER_KIND_ACCEPTED'};'PASS'`),'PASS');});

win('B6 current entry hold denies concurrent reads and writes without changing a single byte or writing on inverse',()=>{assert.equal(run(`. ${q(path.join(dir,'business-5244-startup-exclusion.ps1'))} -Library;$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:held=[Collections.Generic.List[object]]::new();$script:created=@();$script:before=@{fixture=$true};$file=Join-Path $PSScriptRoot 'current-entry.ps1';$bytes=[Text.Encoding]::UTF8.GetBytes('fixed-current-entry');[IO.File]::WriteAllBytes($file,$bytes);$hash=Get-Business5244StartupHash $bytes;function Assert-ReadPairProtection{};function Record-Phase{};function Write-ReadPairHeldCas{throw 'UNEXPECTED_WRITE'};try{Hold-B6ReadPairEntry $file $hash;if($held.Count-ne1-or$held[0].stream.CanWrite-or$held[0].written-or$held[0].beforeHash-cne$held[0].afterHash){throw 'HOLD_CHANGED'};foreach($access in @([IO.FileAccess]::Read,[IO.FileAccess]::Write)){$denied=$false;try{$other=[IO.File]::Open($file,[IO.FileMode]::Open,$access,[IO.FileShare]::ReadWrite);$other.Dispose()}catch{$denied=$true};if(!$denied){throw 'ENTRY_NOT_EXCLUSIVE'}};Restore-ReadPairBeforeRetire -OldStopped $false;if((Get-Business5244StartupHash (Read-ReadPairHeldBytes $held[0].stream))-cne$hash){throw 'ENTRY_MUTATED'}}finally{foreach($item in $held){$item.stream.Dispose()}};if((Get-Business5244StartupHash ([IO.File]::ReadAllBytes($file)))-cne$hash){throw 'ENTRY_MUTATED_AFTER_CLOSE'};$denied=$false;try{Hold-B6ReadPairEntry $file ('0'*64)}catch{$denied=$true};if(!$denied){throw 'STALE_ENTRY_ACCEPTED'};'PASS'`),'PASS');});

win('RehearsalOnly CLI rejects wrong scope and combined recovery modes before importing or executing any source action',()=>{
 assert.equal(run(`$entry=${q(path.join(dir,'install-business-5244-readpair.ps1'))};`+String.raw`
 $script:actions=0;function Get-CimInstance{$script:actions++;throw 'UNEXPECTED_PROCESS'};function Stop-ScheduledTask{$script:actions++;throw 'UNEXPECTED_TASK'};function Open-ErpBusinessSaleSqlConnection{$script:actions++;throw 'UNEXPECTED_SQL'}
 foreach($mode in @('wrong-scope','old-loader','supersession','initializer','wrong-case')){
  $args=@{Library=$true;RehearsalOnly=$true;ScopeName='TEST125-API-B6-ca620bac-20261028'}
  switch($mode){'wrong-scope'{$args.ScopeName='TEST125-API-READ2b-20261028-41d3c213'}'old-loader'{$args.AfterLoaderRecovery=$true}supersession{$args.CurrentOnlySupersession=$true}initializer{$args.InitializerCleanRecovery=$true}'wrong-case'{$args.ScopeName='test125-api-b6-ca620bac-20261028'}}
  $expected=if($mode-ceq'wrong-case'){'READPAIR_INSTALL_SCOPE_REJECTED'}else{'B6_REHEARSAL_FIXED_ACTION_REQUIRED'};$caught=''
  try{& $entry @args}catch{$caught=$_.Exception.Message};if($caught-cne$expected-or$script:actions){throw ('REHEARSAL_CLI_GUARD_'+$mode)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly source constructor rejects wrong purpose, scope, entry and hash before native or protected reads',()=>{
 assert.equal(run(String.raw`
 $script:actions=0;function Assert-ReadPairPath{$script:actions++;throw 'UNEXPECTED_FILE'};function Hold-B6ReadPairSource{$script:actions++;throw 'UNEXPECTED_SOURCE'};function Get-CimInstance{$script:actions++;throw 'UNEXPECTED_PROCESS'}
 $fixed='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029\owner-preparation-v3\reviewed-installer-source.ps1'
 foreach($mode in @('no-apply','no-purpose','scope','entry','old-proof','previous-proof','hash')){
  $script:Apply=$mode-cne'no-apply';$script:RehearsalOnly=$mode-cne'no-purpose';$script:ScopeName=if($mode-ceq'scope'){'TEST125-API-READ2b-20261028-41d3c213'}else{'TEST125-API-B6-ca620bac-20261028'};$path=if($mode-ceq'entry'){'C:\wrong\reviewed-installer-source.ps1'}elseif($mode-ceq'old-proof'){$fixed.Replace('owner-preparation-v3','owner-preparation')}elseif($mode-ceq'previous-proof'){$fixed.Replace('owner-preparation-v3','owner-preparation-v2')}else{$fixed};$hash=if($mode-ceq'hash'){'not-a-hash'}else{'a'*64}
  $caught='';try{Open-B6RehearsalPreparedSource $hash $path|Out-Null}catch{$caught=$_.Exception.Message};if($caught-cne'B6_REHEARSAL_REVIEWED_ENTRY_REQUIRED'-or$script:actions){throw ('REHEARSAL_SOURCE_GUARD_'+$mode)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly V3 scoped constructor reaches only the fixed absent bundle hold before verifier, native admission or stop',()=>{
 assert.equal(run(String.raw`
 $script:Apply=$true;$script:RehearsalOnly=$true;$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:holds=0;$script:effects=0
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029';$isolated=Join-Path $PSScriptRoot 'absent-bundle'
 $definition=(Get-Command Open-B6RehearsalPreparedSource).Definition.Replace($private,$isolated);Set-Item Function:Open-B6RehearsalPreparedSource ([scriptblock]::Create($definition))
 function Assert-ReadPairPath($Path){if($Path-cne'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'){throw 'UNEXPECTED_PATH'}}
 function Get-FileHash{[pscustomobject]@{Hash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'}}
 function Hold-B6ReadPairSource($Path,$Hash){$script:holds++;if($Path-cne(Join-Path $isolated 'owner-preparation-v3\reviewed-installer-source.ps1')-or$Hash-cne('a'*64)){throw 'V3_SCOPED_SOURCE_HOLD_WIDENED'};if(Test-Path -LiteralPath $Path){throw 'UNEXPECTED_BUNDLE_PRESENT'};throw 'ISOLATED_BUNDLE_ABSENT'}
 function New-ErpBusinessSaleNativeProfileAdmission{$script:effects++;throw 'UNEXPECTED_ADMISSION'};function Stop-ReadPairColdOwner{$script:effects++;throw 'UNEXPECTED_STOP'}
 $caught='';try{Open-B6RehearsalPreparedSource ('a'*64) (Join-Path $isolated 'owner-preparation-v3\reviewed-installer-source.ps1')|Out-Null}catch{$caught=$_.Exception.Message}
 if($caught-cne'ISOLATED_BUNDLE_ABSENT'-or$script:holds-ne1-or$script:effects-ne0-or(Test-Path -LiteralPath $isolated)){throw 'ABSENT_REHEARSAL_BUNDLE_EXECUTED'};'PASS'`),'PASS');
});
const initializerEntryFixture=String.raw`
$script:RehearsalOnly=$true;$script:ScopeName='TEST125-API-B6-ca620bac-20261028'
$entry=[pscustomobject]@{root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029';leaf='run-current-owner.ps1';manifestSha256='6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0';sha256='ebc933faf015aadc32be74f7abeaef66252ef3bc72dc52ebac265ced9ed577e5';postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false}
$script:b6=[pscustomobject]@{owner=[pscustomobject]@{predecessorEntryKind='CurrentInitializerClean';entry=$entry;owner=[pscustomobject]@{pid=31212}};coreRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3';coreHash=('a'*64);routerRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3';routerHash=('b'*64);entryCapture=[pscustomobject]@{directEntries=@([pscustomobject]@{path=(Join-Path $entry.root $entry.leaf);sha256=$entry.sha256})}}
`;
win('CurrentInitializerClean argv and active-entry mapping bind exact captured root, manifest, leaf and B6 scope',()=>{
 assert.equal(run(initializerEntryFixture+String.raw`
 $args=Get-B6ReadPairOwnerArguments $entry.root $entry.manifestSha256
 $expected='-NoProfile -NonInteractive -WindowStyle Hidden -File '+$entry.root+'\run-current-owner.ps1 -ManifestSha256 '+$entry.manifestSha256.ToUpperInvariant()+' -ScopeName TEST125-API-B6-ca620bac-20261028'
 if($args-cne$expected){throw 'INITIALIZER_ARGV_CHANGED'};$active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne1-or$active[0].path-cne(Join-Path $entry.root $entry.leaf)-or$active[0].hash-cne$entry.sha256){throw 'INITIALIZER_ENTRY_SCOPE_CHANGED'}
 foreach($pair in @(@{root='C:\wrong';hash=$entry.manifestSha256},@{root=$entry.root;hash=('f'*64)})){$denied=$false;try{Get-B6ReadPairOwnerArguments $pair.root $pair.hash|Out-Null}catch{$denied=$true};if(!$denied){throw 'ARBITRARY_OWNER_ARGV_ACCEPTED'}}
 $saved=$entry|ConvertTo-Json -Compress
 foreach($mode in @('purpose','root','leaf','manifest','kind','missing-active','duplicate-active','active-hash')){
  $b6.owner.entry=$saved|ConvertFrom-Json;$entry=$b6.owner.entry;$b6.owner.predecessorEntryKind='CurrentInitializerClean';$script:RehearsalOnly=$mode-cne'purpose';$b6.entryCapture.directEntries=@([pscustomobject]@{path=(Join-Path $entry.root $entry.leaf);sha256=$entry.sha256})
  switch($mode){root{$entry.root+='-OTHER'}leaf{$entry.leaf='start-business-5244-readpair-router.ps1'}manifest{$entry.manifestSha256=('a'*64)}kind{$b6.owner.predecessorEntryKind='Initializer'}'missing-active'{$b6.entryCapture.directEntries=@()}'duplicate-active'{$b6.entryCapture.directEntries+=@($b6.entryCapture.directEntries[0])}'active-hash'{$b6.entryCapture.directEntries[0].sha256=('c'*64)}}
  $denied=$false;try{Get-B6ReadPairActiveEntry|Out-Null}catch{$denied=$true};if(!$denied){throw ('INITIALIZER_ENTRY_WIDENED_'+$mode)}
 };'PASS'`),'PASS');
});
const rehearsalPublicationFixture=initializerEntryFixture+String.raw`
$script:pins=@{runtime='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027'};$script:result=@{};$script:heldPaths=[Collections.Generic.List[string]]::new();$script:phases=[Collections.Generic.List[string]]::new();$script:b6NativeAdmission=[pscustomobject]@{fixture='retained-native'}
$legacy=@('start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'|ForEach-Object{Join-Path $pins.runtime $_})+@('C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1')
$roots=@('ERP-BUSINESS-5244-READ2B-ROUTER-b9416929-20261028','ERP-BUSINESS-5244-OWNER-b9416929-20261028','ERP-BUSINESS-5244-B6-ROUTER-20261028','ERP-BUSINESS-5244-B6-OWNER-20261028','ERP-BUSINESS-5244-B6-ROUTER-20261029','ERP-BUSINESS-5244-B6-OWNER-20261029','ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE','ERP-BUSINESS-5244-B6-OWNER-20261029-HASHCASE','ERP-BUSINESS-5244-B6-ROUTER-20261029-SQLCOLLATION','ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION','ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029','ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029')
$direct=@(foreach($root in $roots){$leaf=if($root.Contains('ROUTER')){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'};$path=Join-Path ('C:\Sirket\ERP\releases\'+$root) $leaf;[pscustomobject]@{path=$path;sha256=$(if($root-ceq'ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029'){$entry.sha256}else{'a'*64})}})
$b6.entryCapture=[pscustomobject]@{schema='melisa-b6-rehearsal-current-entry-capture.v1';observedAt='2026-10-29T00:00:00.0000000Z';readOnly=$true;executionAuthority=$false;entries=@($legacy|ForEach-Object{[pscustomobject]@{path=$_;beforeSha256=('a'*64);afterEqualsBefore=$true}});directEntries=$direct;entryWrites=0;serviceCalls=0;sqlCalls=0;ownerCaptureSha256='2f066cc82af4fe23337a3469091aad40d6d065a66af72f60db34f2e16152c364';gate=[pscustomobject]@{path='C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\business-5244-startup-exclusion-ec316a63.ps1';sha256='a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'};postExitExclusiveEntryCount=18;runtimeValidationComplete=$false}
$protected=[pscustomobject]@{listeners=@();processes=@();files=@([pscustomobject]@{path='fixture-protected';hash=('a'*64)})};$b6.owner|Add-Member protectedSnapshot $protected;$script:observed=$protected|ConvertTo-Json -Depth 20|ConvertFrom-Json
function Protection-Snapshot{return $script:observed}
function Get-ReadPairExpectedHashes($ScopeName,$NativeProfileAdmission){if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or![object]::ReferenceEquals($NativeProfileAdmission,$script:b6NativeAdmission)){throw 'PUBLICATION_NATIVE_REFERENCE_CHANGED'};return @{fixture='expected-only'}}
function Hold-B6ReadPairEntry($Path,$Hash){$script:heldPaths.Add($Path)}
function Hold-B6ReadPairSource($Path,$Hash){if($Path-cne$b6.entryCapture.gate.path-or$Hash-cne$b6.entryCapture.gate.sha256){throw 'UNEXPECTED_GATE'};$script:heldPaths.Add($Path)}
function Get-CimInstance($ClassName){if($ClassName-cne'Win32_Process'){throw 'UNEXPECTED_PROCESS_QUERY'};return @()}
function Get-ChildItem($LiteralPath,$Filter,[switch]$File){if($LiteralPath-cne$pins.runtime-or$Filter-cne'5244-retirement.pending.*.completed'-or!$File){throw 'UNEXPECTED_ARCHIVE_QUERY'};return @()}
function Record-Phase($Phase){$script:phases.Add($Phase)}
`;
win('RehearsalOnly publication accepts the real v1 capture shape without an invented top-level post-exit flag',()=>{
 assert.equal(run(rehearsalPublicationFixture+String.raw`
 $expectedFields=@('schema','observedAt','readOnly','executionAuthority','ownerCaptureSha256','gate','entries','directEntries','entryWrites','serviceCalls','sqlCalls','postExitExclusiveEntryCount','runtimeValidationComplete')
 if((@($b6.entryCapture.PSObject.Properties.Name|Sort-Object)-join'|')-cne(@($expectedFields|Sort-Object)-join'|')-or$b6.entryCapture.PSObject.Properties['postExitExclusiveBytesRequired']-or!$b6.owner.entry.postExitExclusiveBytesRequired-or$b6.owner.entry.runtimeEntryBytesVerified){throw 'NONEXISTENT_CAPTURE_FIELD_PADDED'}
 Open-B6ReadPairPublication
 if($script:heldPaths.Count-ne18-or$script:heldPaths.Contains((Join-Path $entry.root $entry.leaf))-or$script:phases.Count-ne1-or$script:phases[0]-cne'B6_CURRENT_ENTRIES_HELD_UNCHANGED_NOT_RETIRED'-or$b6.entryCapture.runtimeValidationComplete-or$b6.entryCapture.executionAuthority){throw 'PUBLICATION_SCOPE_OR_AUTHORITY_CHANGED'}
 foreach($path in $legacy){if(!$script:heldPaths.Contains($path)){throw 'LEGACY_ENTRY_OMITTED'}};'PASS'`),'PASS');
});
win('RehearsalOnly publication rejects finite scope, protection and proof-claim drift before holding entry bytes',()=>{
 assert.equal(run(rehearsalPublicationFixture+String.raw`
 $saved=$b6.entryCapture|ConvertTo-Json -Depth 20;$savedEntry=$b6.owner.entry|ConvertTo-Json -Compress
 foreach($case in @('direct-count','direct-order','owner-capture','metadata-write','runtime-claim','postexit','entry-runtime-claim','missing-entry-postexit','missing-entry-runtime','gate','protection')){
  $b6.entryCapture=$saved|ConvertFrom-Json;$b6.owner.entry=$savedEntry|ConvertFrom-Json;$entry=$b6.owner.entry;$script:observed=$protected|ConvertTo-Json -Depth 20|ConvertFrom-Json
  switch($case){'direct-count'{$b6.entryCapture.directEntries=@($b6.entryCapture.directEntries|Select-Object -First 11)}'direct-order'{$row=$b6.entryCapture.directEntries[0];$b6.entryCapture.directEntries[0]=$b6.entryCapture.directEntries[1];$b6.entryCapture.directEntries[1]=$row}'owner-capture'{$b6.entryCapture.ownerCaptureSha256=('a'*64)}'metadata-write'{$b6.entryCapture.entryWrites=1}'runtime-claim'{$b6.entryCapture.runtimeValidationComplete=$true}postexit{$b6.owner.entry.postExitExclusiveBytesRequired=$false}'entry-runtime-claim'{$b6.owner.entry.runtimeEntryBytesVerified=$true}'missing-entry-postexit'{$b6.owner.entry.PSObject.Properties.Remove('postExitExclusiveBytesRequired')}'missing-entry-runtime'{$b6.owner.entry.PSObject.Properties.Remove('runtimeEntryBytesVerified')}gate{$b6.entryCapture.gate.sha256=('a'*64)}protection{$script:observed.files[0].hash=('b'*64)}}
  $denied=$false;try{Open-B6ReadPairPublication}catch{$denied=$true};if(!$denied-or$script:heldPaths.Count-or$script:phases.Count){throw ('PUBLICATION_METADATA_ACCEPTED_'+$case)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly pre-retire recovery retains only a fully reverified healthy Current and never calls cleanup kill or restart',()=>{
 assert.equal(run(String.raw`
 $script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:RehearsalOnly=$true;$script:before=@{fixture=$true};$script:calls=[Collections.Generic.List[string]]::new();$script:failStep='';$script:newHost=[pscustomobject]@{HasExited=$false}
 $newHost|Add-Member ScriptMethod Kill {$script:calls.Add('kill');throw 'UNEXPECTED_CLEANUP_KILL'}
 $script:ready=@{fixture='ready'};$script:newResourceRows=@(@{fixture='native-resource'});$script:b6ReadProof=[pscustomobject]@{fixture='retained-release'};$script:pins=@{fixture='current'}
 function Step($Name){$script:calls.Add($Name);if($script:failStep-ceq$Name){throw 'CURRENT_REVERIFY_REJECTED'}}
 function Assert-B6ReadPairEntryHandoffReady{Step 'handoff'};function Assert-B6ReadPairRecoveryOwner{Step 'native-peer'}
 function Owner-Status{Step 'status';return @{fixture='same-current-status'}}
 function Assert-B6ReadPairCurrentRecoveryRecord($Status,[switch]$Router){if(!$Router-or$Status.fixture-cne'same-current-status'){throw 'WRONG_CURRENT_RECORD_ROUTE'};Step 'record-stage'}
 function Get-Test125BoundMaintenancePlan($RunId,[switch]$ReadPairPreparation,$ReadPairMode,$PreparedReleaseProof){if($RunId-cne'TEST125-API-B6-ca620bac-20261028'-or!$ReadPairPreparation-or$ReadPairMode-cne'Current'-or![object]::ReferenceEquals($PreparedReleaseProof,$script:b6ReadProof)){throw 'CURRENT_PLAN_SCOPE_CHANGED'};Step 'current-api-plan';return @{fixture='current-plan'}}
 function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'-or$TimeoutSec-ne5){throw 'WRONG_HEALTH_TARGET'};Step 'health-read';return @{fixture='health'}}
 function Assert-Business5244ApiHealth($Health,$Pins){if($Health.fixture-cne'health'-or![object]::ReferenceEquals($Pins,$script:pins)){throw 'WRONG_HEALTH_PINS'};Step 'health-proof'}
 function Assert-ReadPairProtection{Step 'protection'};function Record-Phase($Phase){Step $Phase};function Start-Frozen{$script:calls.Add('restart');throw 'UNEXPECTED_RESTART'}
 Restore-ReadPairBeforeRetire -OldStopped $true
 if(($script:calls-join'|')-cne'handoff|native-peer|status|record-stage|current-api-plan|health-read|health-proof|protection|PRE_RETIRE_HEALTHY_CURRENT_RETAINED'){throw 'CURRENT_RETENTION_PROOFS_SKIPPED'}
 foreach($step in @('native-peer','record-stage','current-api-plan','health-read','health-proof','protection')){
  $script:calls.Clear();$script:failStep=$step;$denied=$false;try{Restore-ReadPairBeforeRetire -OldStopped $true}catch{$denied=$true}
  if(!$denied-or$script:calls.Contains('kill')-or$script:calls.Contains('restart')-or$script:calls.Contains('PRE_RETIRE_HEALTHY_CURRENT_RETAINED')){throw ('FAILED_CURRENT_PROOF_BYPASSED_'+$step)}
 };'PASS'`),'PASS');
});
win('RehearsalOnly failure before managed wait cancels only the unattempted marker route and never starts a replacement',()=>{
 assert.equal(run(inert+String.raw`
 $script:RehearsalOnly=$true;function Get-B6ReadPairActiveHandoff{return @{stopAttempted=$false}}
 function Stop-ReadPairColdOwner{$script:calls.Add('precheck-reject');throw 'BEFORE_MANAGED_WAIT'}
 $denied=$false;try{Invoke-ReadPairInstallSequence|Out-Null}catch{$denied=$true}
 if(!$denied-or!$script:calls.Contains('restore:False')-or$script:calls.Contains('start')-or$script:calls.Contains('retire')-or$script:calls.Contains('restore:True')){throw 'PREWAIT_FAILURE_ADOPTED_STOP'};'PASS'`),'PASS');
});

test('B6 executable source verifies and retains the closure before native preflight and first mutation, without old projection replay',()=>{const text=fs.readFileSync(path.join(dir,'install-business-5244-readpair.ps1'),'utf8');const branch=text.slice(text.indexOf("if($Library){return}"),text.indexOf("if($ScopeName-cne'TEST125-API-READ2b"));assert.ok(branch.indexOf('Open-B6ReadPairPreparedSource')<branch.indexOf('Initialize-B6ReadPairControllerPreflight'));assert.ok(branch.indexOf('Initialize-B6ReadPairControllerPreflight')<branch.indexOf('[IO.Directory]::CreateDirectory'));assert.ok(branch.indexOf('[IO.Directory]::CreateDirectory')<branch.indexOf('Invoke-ReadPairInstallSequence'));const publication=text.slice(text.indexOf('function Open-B6ReadPairPublication'),text.indexOf('function Open-ReadPairPublication'));assert.doesNotMatch(publication,/Write-ReadPairHeldCas|Publish-ReadPairSealedFile|Add-Business5244LegacyLauncherGate|Add-Business5244StarterWebGate/);assert.match(publication,/current-entry-hold-capture|B6_ENTRY_HOLD_CAPTURE_CHANGED/);});
win('B6 no-ready, foreign, Unknown or published Current owner cannot trigger a cleanup kill, inverse or restart',()=>{assert.equal(run(String.raw`
$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:before=@{fixture=$true};$script:calls=[Collections.Generic.List[string]]::new()
$script:b6InitializationExitProcess=$null
$script:newHost=[pscustomobject]@{Id=42;HasExited=$false};$newHost|Add-Member -MemberType ScriptMethod -Name Kill -Value {$script:calls.Add('kill');throw 'FIXTURE_STOP'}
$script:b6=@{owner=@{recordBeforeSha256=('d'*64)};routerRoot='C:\fixed\new';routerHash=('b'*64)}
function Connect-Business5244RetirementPeer{$calls.Add('connect');return @{fixture=$true}}
function Close-Business5244RetirementPeer($Connection){$calls.Add('close')}
function Send-Business5244RetirementRequest($Connection,$Operation){$calls.Add('status');return $script:observed}
function Assert-OldTarget($Status){$calls.Add('argv')}
function Web-Resources($Status){$calls.Add('resources');return @([pscustomobject]@{pid=43;birth='child'})}
function Get-FileHash($LiteralPath){if($LiteralPath-cne'C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json'){throw 'UNEXPECTED_FILE'};$calls.Add('record');return @{Hash=$(if($script:kind-ceq'published'){'e'*64}else{'d'*64})}}
function Start-Frozen{throw 'UNEXPECTED_RESTART'};function Write-ReadPairHeldCas{throw 'UNEXPECTED_INVERSE'}
foreach($kind in @('noReady','Unknown','foreign','child','published','Running')){
 $calls.Clear();$script:ready=@{ownerBirth='owner';childPid=43;childBirth='child'};$script:newResourceRows=@([pscustomobject]@{pid=43;birth='child'})
 $script:observed=@{nativePeerVerified=$true;reply='Status';state=@{ownerPid=42;ownerBirth='owner';childPid=43;childBirth='child';phase='Running'}}
 switch($kind){noReady{$script:ready=$null}Unknown{$script:observed.state.phase='Unknown'}foreign{$script:observed.state.ownerPid=99}child{$script:observed.state.childBirth='different'}}
 $denied=$false;try{Restore-ReadPairBeforeRetire -OldStopped $true}catch{$denied=$true}
 if(!$denied-or($kind-cne'Running'-and$calls.Contains('kill'))-or($kind-ceq'noReady'-and$calls.Contains('connect'))){throw 'UNPROVEN_CLEANUP'}
 if($kind-ceq'Running'-and($calls-join'|')-cne'connect|status|argv|resources|close|record|kill'){throw 'CLEANUP_BEFORE_NATIVE_CHECK'}
};'PASS'`),'PASS');});
win('B6 verified initialization recovery requires the retained real process reference and exit73 plus fresh unchanged baseline before a single Current start',()=>{assert.equal(run(String.raw`
$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:before=@{fixture=$true};$script:calls=[Collections.Generic.List[string]]::new();$script:held=@();$script:created=@();$script:newResourceRows=@();$script:oldResourceRows=@(@{fixture=$true})
$script:b6=@{owner=@{recordBeforeSha256=('d'*64)};coreRoot='C:\fixed\core';coreHash=('c'*64)}
function Wait-ResourceExit($Rows){$calls.Add('oldexit');return $true};function Get-NetTCPConnection{param($LocalPort,$State,$ErrorAction);$calls.Add('port');return @()}
function Get-FileHash($LiteralPath){$calls.Add('baseline');return @{Hash=$(if($script:kind-ceq'recordDrift'){'e'*64}else{'d'*64})}}
function Assert-ReadPairProtection{$calls.Add('protection');if($script:kind-ceq'protectionDrift'){throw 'FIXTURE_PROTECTION'}}
function Start-Frozen($Root,$Hash,$Label){if($Root-cne'C:\fixed\core'-or$Hash-cne('c'*64)-or$Label-cne'rollback'){throw 'FOREIGN_RECOVERY_START'};$calls.Add('start');$script:newHost=[pscustomobject]@{Id=44};return @{ownerBirth='newOwner';childPid=45;childBirth='newChild'}}
function Owner-Status{return @{ownerPid=44;ownerBirth='newOwner';childPid=45;childBirth='newChild'}}
function Assert-B6ReadPairCurrentRecoveryRecord($Status){$calls.Add('recordVerified')};function Record-Phase($Phase){$calls.Add($Phase)}
$ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe';$child=Join-Path $PSScriptRoot 'inert73.ps1';[IO.File]::WriteAllText($child,'exit 73')
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$ps;$info.Arguments='-NoProfile -NonInteractive -File "'+$child+'"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$process=[Diagnostics.Process]::Start($info);[void]$process.Handle;$wrong=$null;try{if(!$process.WaitForExit(10000)-or$process.ExitCode-ne73){throw 'INERT_CHILD_FAILED'}
 [IO.File]::WriteAllText($child,'exit 1');$wrong=[Diagnostics.Process]::Start($info);[void]$wrong.Handle;if(!$wrong.WaitForExit(10000)-or$wrong.ExitCode-ne1){throw 'INERT_WRONG_CHILD_FAILED'}
 foreach($kind in @('foreignReference','wrongCode','fakeProcess','recordDrift','protectionDrift','verified')){
  $calls.Clear();$script:newHost=if($kind-ceq'wrongCode'){$wrong}elseif($kind-ceq'fakeProcess'){[pscustomobject]@{HasExited=$true;ExitCode=73}}else{$process};$script:b6InitializationExitProcess=if($kind-ceq'foreignReference'){$null}else{$script:newHost};$denied=$false
  try{Restore-ReadPairBeforeRetire -OldStopped $true}catch{$denied=$true}
  if($kind-ceq'verified'){if($denied-or($calls-join'|')-cne'oldexit|port|baseline|protection|start|recordVerified|protection|PRE_RETIRE_INVERSE_VERIFIED'){throw ('RECOVERY_ORDER '+($calls-join'|'))}}
  elseif(!$denied-or$calls.Contains('start')){throw 'UNVERIFIED_RECOVERY_STARTED'}
 }
}finally{$process.Dispose();if($wrong){$wrong.Dispose()}};'PASS'`),'PASS');});

win('legacy READ2b real active-entry hold treats the explicit null descriptor as no work and never reads a B6 control or marker',()=>{
 assert.equal(run(String.raw`
 $script:ScopeName='TEST125-API-READ2b-20261028-41d3c213';$script:touched=0
 $script:control=[pscustomobject]@{};$control|Add-Member ScriptMethod Validate {$script:touched++;throw 'UNEXPECTED_LEGACY_CONTROL'}
 function Get-B6ReadPairActiveHandoff{$script:touched++;throw 'UNEXPECTED_LEGACY_HANDOFF'}
 function Get-Business5244RetirementPendingPath{$script:touched++;throw 'UNEXPECTED_LEGACY_PENDING'}
 $raw=@(Get-B6ReadPairActiveEntry);if($raw.Count-ne1-or$null-ne$raw[0]){throw 'EXPLICIT_NULL_CANARY_NOT_EXERCISED'}
 Hold-B6ReadPairActiveEntry;if($script:touched){throw 'LEGACY_NULL_ENTERED_B6_PATH'};'PASS'
 `),'PASS');
});

const currentInputFixture=String.raw`
function Get-Business5244RetirementPendingPath{return 'C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\5244-retirement.pending'}
$script:currentPins=@{apiManifest='8B39A46F27CE8C6E0B8E41A34E29BEE2AAB0B4575129DA5503C0602C4C9C8090';manifest='91EE8B23C37A46EC89F8060967BC7A0106F68F2DE9A4A1F4199941CCE5A9E0FD'}
function Get-Business5244FinitePairPins{param($ScopeName,$Mode);if($ScopeName-cne'TEST125-API-B6-ca620bac-20261028'-or$Mode-cne'Current'){throw 'FIXTURE_WRONG_PAIR'};return $script:currentPins}
$case=[pscustomobject]@{schema='melisa-5244-current-supersession-case.v1';readOnly=$true;executionAuthority=$false;target=@{pid=48212;birth='134377121934062288';sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value};pending=@{path=(Get-Business5244RetirementPendingPath);sha256='7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab'};record=@{path='C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json';sha256='3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74';actualRecordRead=$false};stopCalls=0;recordWrites=0;sqlWrites=0;serviceCalls=0;entryCaptureSha256='311b3facefe4aa9c0e0629a1fe5ca2e87d11e04f2562a3a237a51be54c116a55';current=@{apiManifest=$currentPins.apiManifest.ToLowerInvariant();webManifest=$currentPins.manifest.ToLowerInvariant();database='MELISA_ERP_SIRKET_TEST_20260929_01';server='Semih\MELISADEV'}}
$boundary=@{schema='melisa-5244-current-supersession-boundary.v1';readOnly=$true;executionAuthority=$false;caseSha256='8965df723ec4bdbbd12360129d54aab47484d67ad76d8c42f4ec7c7b67c6caf8';writes=0;sqlCalls=0;serviceCalls=0}
$entry=@{entries=@(1..6|ForEach-Object{@{path=('fixture-legacy-'+$_);beforeSha256=('a'*64)}});directEntries=@(1..10|ForEach-Object{@{path=('fixture-direct-'+$_);sha256=('b'*64)}});executionAuthority=$false;entryWrites=0;gate=@{path='fixture-gate';sha256=('c'*64)}}
# This fixture replaces ONLY the external private capture provider. It never
# issues an exit observer/admission and cannot reach live records or SQL.
function Read-Business5244CurrentSupersessionCaseFile{param($Leaf,$Sha256);$v=switch -CaseSensitive($Leaf){'supersession-fixed-case.json'{$case}'protected-boundary.json'{$boundary}'current-entry-hold-capture.json'{$entry}'oldrecord.before.json'{'fixture-record'}'oldpending.before.bin'{'fixture-pending'}default{throw 'FIXTURE_UNEXPECTED_LEAF'}};if($v-is[string]){return ,([Text.Encoding]::UTF8.GetBytes($v))};return ,([Text.Encoding]::UTF8.GetBytes(($v|ConvertTo-Json -Depth 12)))}
`;
win('Current-only fixed metadata reader preserves same SHA bytes across hash letter casing and never treats capture as live-record authority',()=>{
 assert.equal(run(currentInputFixture+String.raw`$i=Get-Business5244CurrentSupersessionFixedInputs;if($i.entrySeals.Count-ne16-or$i.case.record.actualRecordRead-ne$false-or$i.ownerPid-ne48212-or$i.scopeName-cne'TEST125-API-B6-ca620bac-20261028'){throw 'FIXED_SCOPE_LOST'};'PASS'`),'PASS');
});
for(const mode of ['digest-drift','wrong-db','capture-write','wrong-owner'])win(`Current-only fixed metadata ${mode} rejects without reading a live target or minting an admission`,()=>{
 const change={'digest-drift':"$case.current.webManifest=('d'*64)",'wrong-db':"$case.current.database='VEGA2026'",'capture-write':'$case.sqlWrites=1','wrong-owner':'$case.target.pid=1'}[mode];
 assert.equal(run(currentInputFixture+change+String.raw`;$denied=$false;try{Get-Business5244CurrentSupersessionFixedInputs|Out-Null}catch{$denied=$true};if(!$denied){throw 'BAD_PASSIVE_CASE_ADMITTED'};'PASS'`),'PASS');
});
win('Current-only source constructor rejects non-current flags and wrong entry before source handles or process actions',()=>{
 assert.equal(run(String.raw`$script:CurrentOnlySupersession=$true;$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:Apply=$false;$script:AfterLoaderRecovery=$false;$script:effects=0;function Hold-B6ReadPairSource{$script:effects++;throw 'UNEXPECTED_SOURCE_READ'};foreach($mode in @('apply','old-loader','wrong-scope','wrong-entry')){$Apply=$mode-ceq'apply';$AfterLoaderRecovery=$mode-ceq'old-loader';$ScopeName=if($mode-ceq'wrong-scope'){'TEST125-API-READ2b-20261028-41d3c213'}else{'TEST125-API-B6-ca620bac-20261028'};$denied=$false;try{Open-Business5244CurrentSupersessionSource ('a'*64) 'C:\not-the-fixed-core\entry.ps1'|Out-Null}catch{$denied=$true};if(!$denied-or$script:effects){throw 'CONSTRUCTOR_CROSSED_GUARD'}};'PASS'`),'PASS');
});
win('INIT-CLEAN constructor rejects combined recovery modes, old roots and widened scope before any source or process action',()=>{
 assert.equal(run(String.raw`$script:effects=0;function Hold-B6ReadPairSource{$script:effects++;throw 'UNEXPECTED_FIXED_SOURCE_READ'};foreach($mode in @('combined','apply','old-root','wrong-scope')){$script:InitializerCleanRecovery=$true;$script:CurrentOnlySupersession=$mode-ceq'combined';$script:Apply=$mode-ceq'apply';$script:AfterLoaderRecovery=$false;$script:ScopeName=if($mode-ceq'wrong-scope'){'TEST125-API-READ2b-20261028-41d3c213'}else{'TEST125-API-B6-ca620bac-20261028'};$entry=if($mode-ceq'old-root'){'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029\install-business-5244-readpair.ps1'}else{'C:\not-the-fixed-root\install-business-5244-readpair.ps1'};$denied=$false;try{Open-Business5244CurrentSupersessionSource ('a'*64) $entry|Out-Null}catch{$denied=$true};if(!$denied-or$script:effects){throw 'INIT_CLEAN_ENTRY_WIDENED'}};'PASS'`),'PASS');
});

win('CandidateInstall fixed CLI excludes legacy scope and every other recovery or rehearsal action',()=>{
 for(const args of [[],['-ScopeName','TEST125-API-B6-ca620bac-20261028','-RehearsalOnly'],['-ScopeName','TEST125-API-B6-ca620bac-20261028','-CurrentOnlySupersession'],['-ScopeName','TEST125-API-B6-ca620bac-20261028','-InitializerCleanRecovery'],['-ScopeName','TEST125-API-B6-ca620bac-20261028','-AfterLoaderRecovery']]){
  const x=cp.spawnSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(dir,'install-business-5244-readpair.ps1'),'-Library','-CandidateInstall',...args],{encoding:'utf8',windowsHide:true,timeout:10000});assert.notEqual(x.status,0);assert.match(x.stderr,/B6_CANDIDATE_FIXED_ACTION_REQUIRED/);
 }
});
win('CandidateInstall constructor rejects missing purpose, wrong scope, alias entry or absent immutable proof before protected work',()=>{
 assert.equal(run(String.raw`
 $script:Apply=$true;$script:CandidateInstall=$true;$script:RehearsalOnly=$false;$script:ScopeName='TEST125-API-B6-ca620bac-20261028';$script:actions=0
 function Assert-ReadPairPath{$script:actions++;throw 'UNEXPECTED_READ'};function Hold-B6ReadPairSource{$script:actions++;throw 'UNEXPECTED_HOLD'}
 $fixed='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-candidate-apply-debafecb-20261029\owner-preparation\reviewed-installer-source.ps1'
 foreach($case in @('no-apply','no-purpose','rehearsal','scope','old-root','hash')){
  $script:Apply=$case-cne'no-apply';$script:CandidateInstall=$case-cne'no-purpose';$script:RehearsalOnly=$case-ceq'rehearsal';$script:ScopeName=if($case-ceq'scope'){'TEST125-API-READ2b-20261028-41d3c213'}else{'TEST125-API-B6-ca620bac-20261028'};$entry=if($case-ceq'old-root'){$fixed.Replace('b6-candidate-apply-debafecb','b6-native-rehearsal-debafecb')}else{$fixed};$hash=if($case-ceq'hash'){'invalid'}else{'a'*64}
  $denied=$false;try{Open-B6CandidatePreparedSource $hash $entry|Out-Null}catch{if($_.Exception.Message-cne'B6_CANDIDATE_REVIEWED_ENTRY_REQUIRED'){throw};$denied=$true};if(!$denied-or$script:actions){throw 'CANDIDATE_CONSTRUCTOR_BYPASS'}
 };'PASS'`),'PASS');
});
const candidatePublicationFixture=rehearsalPublicationFixture
 .replace('$script:RehearsalOnly=$true;',"$script:RehearsalOnly=$false;$script:CandidateInstall=$true;")
 .replaceAll('melisa-b6-rehearsal-current-entry-capture.v1','melisa-b6-candidate-current-entry-capture.v1')
 .replaceAll('2f066cc82af4fe23337a3469091aad40d6d065a66af72f60db34f2e16152c364','3f7d2484310246df0b01d8b1692d16fdfc70b75a4545c0344bcb941118110642')
 .replace('postExitExclusiveEntryCount=18','postExitExclusiveEntryCount=20');
win('CandidateInstall publication binds twenty exact entries and both captured V3 active leaves without inventing capture fields',()=>{
 assert.equal(run(candidatePublicationFixture+String.raw`
 $router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3'
 $b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.entry=[pscustomobject]@{root=$router;leaf='start-business-5244-readpair-router.ps1';manifestSha256=('b'*64);sha256=('c'*64);postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false}
 $b6.owner|Add-Member router ([pscustomobject]@{root=$router;manifestSha256=('b'*64);entrySha256=('c'*64)});$b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('d'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('e'*64);bytes=15})})
 # Native captures can serialize these two fields in either property order.
 $b6.entryCapture.directEntries+=@([pscustomobject]@{sha256=('e'*64);path=(Join-Path $core 'run-current-owner.ps1')},[pscustomobject]@{sha256=('c'*64);path=(Join-Path $router 'start-business-5244-readpair-router.ps1')})
 Open-B6ReadPairPublication
 if($heldPaths.Count-ne19-or$heldPaths.Contains((Join-Path $router 'start-business-5244-readpair-router.ps1'))-or$heldPaths.Contains((Join-Path $core 'run-current-owner.ps1'))-or$b6.entryCapture.directEntries.Count-ne14-or$b6.entryCapture.postExitExclusiveEntryCount-ne20-or$phases.Count-ne1){throw 'CANDIDATE_ENTRY_SCOPE'}
 $active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne2-or$b6.entryCapture.directEntries[12].path-cne(Join-Path $core 'run-current-owner.ps1')-or$b6.entryCapture.directEntries[13].path-cne(Join-Path $router 'start-business-5244-readpair-router.ps1')){throw 'CANDIDATE_CAPTURED_ENTRY_ORDER_CHANGED'}
 $heldPaths.Clear();$phases.Clear();$swap=$b6.entryCapture.directEntries[12];$b6.entryCapture.directEntries[12]=$b6.entryCapture.directEntries[13];$b6.entryCapture.directEntries[13]=$swap;$denied=$false;try{Open-B6ReadPairPublication}catch{if($_.Exception.Message-cne'B6_DIRECT_ENTRY_SCOPE_CHANGED'){throw};$denied=$true};if(!$denied-or$heldPaths.Count-or$phases.Count){throw 'CANDIDATE_INVENTED_ROUTER_FIRST_ACCEPTED'};'PASS'`),'PASS');
});
win('CandidateInstall native purpose is read from the issued admission before release proof and cannot be widened from a caller flag',()=>{
 assert.equal(run(String.raw`
 $script:CandidateInstall=$true;$script:events=[Collections.Generic.List[string]]::new();$script:cap=[pscustomobject]@{fixture='opaque'}
 function Read-ErpStartupConfig{[pscustomobject]@{fixture='config'}};function New-ErpBusinessSaleNativeProfileAdmission{$events.Add('native');return $cap}
 function Get-ErpBusinessSaleNativeAdmissionContext($Admission){if(![object]::ReferenceEquals($Admission,$cap)){throw 'WRONG_CAP'};return $script:purpose}
 function Assert-ErpBusinessSaleNativeProfileAdmission{};function New-ErpReadPairPreparedReleaseProof{$events.Add('release');return [pscustomobject]@{fixture='proof'}};function Get-Test125BoundMaintenancePlan{};function Get-ReadPairExpectedHashes{}
 foreach($case in @('true','string','wrong-purpose','good')){
  $events.Clear();$script:purpose=[pscustomobject]@{rehearsalOnly=$false;ownerInputs=[pscustomobject]@{maintenancePurpose='CandidateMetadataApply'}};switch($case){true{$purpose.rehearsalOnly=$true}string{$purpose.rehearsalOnly='false'}'wrong-purpose'{$purpose.ownerInputs.maintenancePurpose='RehearsalOnly'}}
  $denied=$false;try{Initialize-B6ReadPairControllerPreflight}catch{if($_.Exception.Message-cne'B6_CANDIDATE_NATIVE_PURPOSE_REQUIRED'){throw};$denied=$true}
  if($case-ceq'good'){if($denied-or($events-join'|')-cne'native|release'){throw 'CANDIDATE_ISSUED_PURPOSE_LOST'}}elseif(!$denied-or$events.Contains('release')){throw 'CALLER_WIDENED_NATIVE'}
 };'PASS'`),'PASS');
});

win('CandidateInstall managed exit retains a genuine peer and mutex through twenty exclusive entry gates without force stop',()=>{
 const fixture=managedFixture.replace('@(1..11|ForEach-Object','@(1..13|ForEach-Object');
 const answer=activeRun(String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_CURRENT_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;Complete-B6ReadPairActiveEntryHandoff
 $h=Get-B6ReadPairActiveHandoff;if(!$control.CompletedStop-or!$server.HasExited-or$h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$held.Count-ne20-or@($held|Where-Object{$_.holdMode-cne'Exclusive'}).Count-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1){throw 'CANDIDATE_MANAGED_EXIT_BROKEN'}
 `,String.raw`$script:RehearsalOnly=$false;$script:CandidateInstall=$true;$b6.rehearsalOnly=$false;$b6|Add-Member maintenancePurpose 'CandidateMetadataApply'`,fixture);
 assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('CandidateInstall real source constructor validates issued metadata and exact caller while external file and verifier providers stay isolated',()=>{
 assert.equal(run(String.raw`
 $script:Apply=$true;$script:CandidateInstall=$true;$script:RehearsalOnly=$false;$script:ScopeName='TEST125-API-B6-ca620bac-20261028'
 $private='C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-candidate-apply-debafecb-20261029';$proof=Join-Path $private 'owner-preparation';$entry=Join-Path $proof 'reviewed-installer-source.ps1';$installerHash='a'*64;$script:holds=[Collections.Generic.List[string]]::new()
 $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY'
 $script:verified=[pscustomobject]@{schema='melisa-b6-candidate-owner-verification.v1';rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply';runtimeValidationComplete=$false;postExitExclusiveBytesRequired=$true;postExitExclusiveEntryCount=20;coreFiles=13;beforeImages=6;writes=0;sqlCalls=0;serviceCalls=0;ownerCalls=0;taskChanges=0;installerSourceSha256=$installerHash;coreRoot=$core;routerRoot=$router;coreManifestSha256=('b'*64);routerManifestSha256=('c'*64);ownerSourceCommit=('d'*40)}
 $script:manifest=[pscustomobject]@{kind='BUSINESS5244_FRESH_OWNER_BUNDLE';finiteScope=$ScopeName;sourceCommit=$verified.ownerSourceCommit;rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply';files=@(1..13|ForEach-Object{[pscustomobject]@{path=('source'+$_+'.ps1');sha256=('e'*64)}});beforeImages=@('current-read2b-owner-capture.json','current-erp-processes.before.json','current-entry-hold-capture.json','current-task-capture.json','current-task.before.xml','current-task.before.sddl'|ForEach-Object{[pscustomobject]@{path=$_;sha256=('f'*64)}})}
 $script:routerManifest=[pscustomobject]@{kind='BUSINESS5244_READ_PAIR_ROUTER';rehearsalOnly=$false;maintenancePurpose='CandidateMetadataApply';coreManifestSha256=$verified.coreManifestSha256;coreRoot=$core;entrySha256=('a'*64);routerLibrarySha256=('b'*64)}
 # This is an external process boundary replacement, not a helper-only claim:
 # the actual constructor body, manifest checks, pin routing and native caller
 # comparisons execute. Native package sealing/CI remain verifier responsibilities.
 $definition=(Get-Command Open-B6CandidatePreparedSource).Definition.Replace('& $node $producer --verify-candidate','Invoke-FixtureCandidateVerifier $producer');Set-Item Function:Open-B6CandidatePreparedSource ([scriptblock]::Create($definition))
 function Invoke-FixtureCandidateVerifier($Producer){if($Producer-cne(Join-Path $proof 'verified-owner-producer.mjs')){throw 'VERIFIER_PATH_CHANGED'};$global:LASTEXITCODE=0;return ($verified|ConvertTo-Json -Depth 12 -Compress)}
 function Assert-ReadPairPath($Path){if($Path-cne'C:\Sirket\ERP\tools\node-v24.19.0\node.exe'){throw 'UNEXPECTED_SOURCE_PATH'}}
 function Get-FileHash{[pscustomobject]@{Hash='3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'}}
 function Hold-B6ReadPairSource($Path,$Hash){if($Hash-cnotmatch'^[a-f0-9]{64}$'){throw 'INVALID_SOURCE_PIN'};$holds.Add($Path)}
 function Get-Content($LiteralPath,[switch]$Raw){if(!$Raw){throw 'WRONG_READ_MODE'};switch($LiteralPath){(Join-Path $core 'owner-manifest.json'){return ($manifest|ConvertTo-Json -Depth 12 -Compress)}(Join-Path $router 'owner-manifest.json'){return ($routerManifest|ConvertTo-Json -Depth 12 -Compress)}(Join-Path $core 'current-read2b-owner-capture.json'){return '{"predecessorEntryKind":"ReadPairRouter"}'}(Join-Path $core 'current-entry-hold-capture.json'){return '{"schema":"melisa-b6-candidate-current-entry-capture.v1"}'}default{throw 'UNEXPECTED_PROTECTED_READ'}}}
 $ps='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';$script:command='"'+$ps+'" -NoProfile -NonInteractive -WindowStyle Hidden -File '+$entry+' -Apply -CandidateInstall -SourceSha256 '+$installerHash.ToUpperInvariant()+' -ScopeName '+$ScopeName
 function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'-or$Filter-cne('ProcessId='+$PID)){throw 'FOREIGN_PROCESS_READ'};[pscustomobject]@{CommandLine=$script:command;ExecutablePath=$ps}}
 function Invoke-CimMethod{[pscustomobject]@{ReturnValue=0;Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}}
 $result=Open-B6CandidatePreparedSource $installerHash $entry;if($result.rehearsalOnly-isnot[bool]-or$result.rehearsalOnly-or$result.maintenancePurpose-cne'CandidateMetadataApply'-or$result.coreRoot-cne$core-or$result.proof-cne$proof-or$holds.Count-ne25){throw 'CANDIDATE_SOURCE_CONSTRUCTOR_NOT_COMPLETE'}
 foreach($case in @('purpose','bool','entrycount','caller-extra')){$holds.Clear();$verified.maintenancePurpose='CandidateMetadataApply';$verified.rehearsalOnly=$false;$verified.postExitExclusiveEntryCount=20;switch($case){purpose{$verified.maintenancePurpose='RehearsalOnly'}bool{$verified.rehearsalOnly='false'}entrycount{$verified.postExitExclusiveEntryCount=18}'caller-extra'{$script:command+=' -Other'}};$denied=$false;try{Open-B6CandidatePreparedSource $installerHash $entry|Out-Null}catch{$denied=$true};if(!$denied){throw 'CANDIDATE_SOURCE_ACCEPTED_DRIFT'}};'PASS'`),'PASS');
});

win('WriterInstall CLI remains finite and its supported Library import is inert',()=>{
 assert.equal(run(". "+q(path.join(dir,'install-business-5244-readpair.ps1'))+" -Library -ScopeName 'TEST125-API-B6-WRITER-20261029';'PASS'"),'PASS');
 for(const args of [['-ScopeName','TEST125-API-B6-ca620bac-20261028'],['-ScopeName','TEST125-API-B6-WRITER-20261029','-CandidateInstall'],['-ScopeName','TEST125-API-B6-WRITER-20261029','-RehearsalOnly']]){const r=cp.spawnSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(dir,'install-business-5244-readpair.ps1'),'-Library','-WriterInstall',...args],{encoding:'utf8',windowsHide:true,timeout:10000});assert.notEqual(r.status,0);assert.match(r.stderr,/FIXED_ACTION_REQUIRED/);}
});
win('WriterInstall admission requires new After-proof purpose and never invokes native revision',()=>{
 assert.equal(run(String.raw`
 $script:WriterInstall=$true;$script:CandidateInstall=$false;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:events=[Collections.Generic.List[string]]::new();$script:cap=[pscustomobject]@{fixture='opaque'}
 function Read-ErpStartupConfig{[pscustomobject]@{fixture='config'}};function New-ErpBusinessSaleWriterProfileAdmission{$events.Add('writer');return $cap};function New-ErpBusinessSaleNativeProfileAdmission{throw 'OLD_NATIVE_FACTORY'};function Invoke-ErpBusinessSaleNativeRevision{throw 'DDL_CALLED'}
 function Get-ErpBusinessSaleNativeAdmissionContext($Admission){if(![object]::ReferenceEquals($Admission,$cap)){throw 'WRONG_CAP'};return $script:purpose};function Assert-ErpBusinessSaleWriterProfileAdmission($Admission,$Phase){if(![object]::ReferenceEquals($Admission,$cap)-or$Phase-cne'WriterPrepared'){throw 'WRONG_PHASE'}}
 function New-ErpReadPairPreparedReleaseProof($Config,$ScopeName,$NativeProfileAdmission){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or![object]::ReferenceEquals($NativeProfileAdmission,$cap)){throw 'WRONG_SCOPE'};$events.Add('release');return [pscustomobject]@{fixture='proof'}};function Get-Test125BoundMaintenancePlan{};function Get-ReadPairExpectedHashes{}
 foreach($case in @('old-purpose','mode','good')){$events.Clear();$script:purpose=[pscustomobject]@{mode='WriterProfileActivation';ownerInputs=[pscustomobject]@{maintenancePurpose='WriterProfileActivation'}};if($case-ceq'old-purpose'){$purpose.ownerInputs.maintenancePurpose='CandidateMetadataApply'};if($case-ceq'mode'){$purpose.mode='Applied'};$denied=$false;try{Initialize-B6ReadPairControllerPreflight}catch{if($_.Exception.Message-cne'B6_WRITER_PROFILE_PURPOSE_REQUIRED'){throw};$denied=$true};if($case-ceq'good'){if($denied-or($events-join'|')-cne'writer|release'){throw 'WRITER_SCOPE_LOST'}}elseif(!$denied-or$events.Contains('release')){throw 'OLD_ADMISSION_ACCEPTED'}};'PASS'`),'PASS');
});
const writerPublicationFixture=candidatePublicationFixture.replace('$script:CandidateInstall=$true;',"$script:CandidateInstall=$false;$script:WriterInstall=$true;").replaceAll('TEST125-API-B6-ca620bac-20261028','TEST125-API-B6-WRITER-20261029').replaceAll('melisa-b6-candidate-current-entry-capture.v1','melisa-b6-writer-current-entry-capture.v1').replaceAll('3f7d2484310246df0b01d8b1692d16fdfc70b75a4545c0344bcb941118110642','50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65').replace('postExitExclusiveEntryCount=20','postExitExclusiveEntryCount=24');
win('WriterInstall publication binds twenty-four leaves and exact CORE then ROUTER before any entry hold',()=>{
 assert.equal(run(writerPublicationFixture+String.raw`
 $router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029'
 $b6.owner.predecessorEntryKind='CurrentCore';$b6.owner.entry=[pscustomobject]@{root=$core;leaf='run-current-owner.ps1';manifestSha256=('d'*64);sha256=('e'*64);postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false};$b6.owner|Add-Member router ([pscustomobject]@{root=$router;manifestSha256=('b'*64);entrySha256=('c'*64)});$b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('d'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('e'*64);bytes=15})})
 $b6.entryCapture.directEntries+=@([pscustomobject]@{path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3\run-current-owner.ps1';sha256=('e'*64)},[pscustomobject]@{path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3\start-business-5244-readpair-router.ps1';sha256=('c'*64)},[pscustomobject]@{sha256=('e'*64);path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY\run-current-owner.ps1'},[pscustomobject]@{sha256=('c'*64);path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY\start-business-5244-readpair-router.ps1'},[pscustomobject]@{sha256=('e'*64);path=(Join-Path $core 'run-current-owner.ps1')},[pscustomobject]@{sha256=('c'*64);path=(Join-Path $router 'start-business-5244-readpair-router.ps1')})
 Open-B6ReadPairPublication;if($heldPaths.Count-ne24-or$b6.entryCapture.directEntries.Count-ne18-or$phases.Count-ne1){throw 'WRITER_ENTRY_SCOPE'};$heldPaths.Clear();$phases.Clear();$swap=$b6.entryCapture.directEntries[16];$b6.entryCapture.directEntries[16]=$b6.entryCapture.directEntries[17];$b6.entryCapture.directEntries[17]=$swap;$denied=$false;try{Open-B6ReadPairPublication}catch{if($_.Exception.Message-cne'B6_DIRECT_ENTRY_SCOPE_CHANGED'){throw};$denied=$true};if(!$denied-or$heldPaths.Count-or$phases.Count){throw 'WRITER_REORDER_ACCEPTED'};'PASS'`),'PASS');
});
win('WriterInstall managed exit retains the same mutex and twenty-four exclusive leaves without force stop',()=>{
 const fixture=managedFixture.replace('@(1..11|ForEach-Object','@(1..17|ForEach-Object');
 const answer=activeRun(String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_WRITER_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;Complete-B6ReadPairActiveEntryHandoff
 $h=Get-B6ReadPairActiveHandoff;if(!$control.CompletedStop-or!$server.HasExited-or$h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$held.Count-ne24-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1){throw 'WRITER_MANAGED_EXIT_BROKEN'}
 `,String.raw`$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:RehearsalOnly=$false;$script:CandidateInstall=$false;$script:WriterInstall=$true;$b6.rehearsalOnly=$false;$b6|Add-Member maintenancePurpose 'WriterProfileActivation'`,fixture);
 assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('WebOnlyRefreshInstall is an exact independent finite action and rejects every combined or other-scope flag',()=>{
 assert.equal(run(". "+q(path.join(dir,'install-business-5244-readpair.ps1'))+" -Library -WebOnlyRefreshInstall -ScopeName TEST125-API-B6-WRITER-20261029;'PASS'"),'PASS');
 for(const args of [['-WriterInstall'],['-CandidateInstall'],['-RehearsalOnly'],['-CurrentOnlySupersession'],['-InitializerCleanRecovery'],['-AfterLoaderRecovery'],['-ScopeName','TEST125-API-B6-ca620bac-20261028']]){
  const base=['-NoProfile','-NonInteractive','-File',path.join(dir,'install-business-5244-readpair.ps1'),'-Library','-WebOnlyRefreshInstall',...(args[0]==='-ScopeName'?[]:['-ScopeName','TEST125-API-B6-WRITER-20261029']),...args];const r=cp.spawnSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),base,{encoding:'utf8',windowsHide:true,timeout:10000});assert.notEqual(r.status,0);assert.match(r.stderr,/FIXED_ACTION_REQUIRED/);
 }
});
const noApiMutators=String.raw`
$script:apiMutators=0
function New-ErpBusinessSaleWriterProfileAdmission{$script:apiMutators++;throw 'FORBIDDEN_WRITER_FACTORY'}
function New-ErpBusinessSaleNativeProfileAdmission{$script:apiMutators++;throw 'FORBIDDEN_NATIVE_FACTORY'}
function New-ErpReadPairPreparedReleaseProof{$script:apiMutators++;throw 'FORBIDDEN_API_RELEASE'}
function New-Test125ReadPairApiTransition{$script:apiMutators++;throw 'FORBIDDEN_API_TRANSITION'}
function New-Test125ReadPairTransition{$script:apiMutators++;throw 'FORBIDDEN_API_TRANSITION'}
function Invoke-Test125ReadPairApiTransition{$script:apiMutators++;throw 'FORBIDDEN_API_TRANSITION'}
function Write-Test125ReadPairCas{$script:apiMutators++;throw 'FORBIDDEN_PROFILE_WRITE'}
function New-Test125ReadPairTaskActionPlan{$script:apiMutators++;throw 'FORBIDDEN_TASK_PLAN'}
function Set-Test125ReadPairTaskAction{$script:apiMutators++;throw 'FORBIDDEN_TASK_WRITE'}
function Get-ReadPairExpectedHashes{$script:apiMutators++;throw 'FORBIDDEN_API_PROJECTION'}
function Get-Test125BoundMaintenancePlan{$script:apiMutators++;throw 'FORBIDDEN_API_PLAN'}
function Invoke-ErpBusinessSaleNativeRevision{$script:apiMutators++;throw 'FORBIDDEN_SQL'}
function Set-ScheduledTask{$script:apiMutators++;throw 'FORBIDDEN_TASK_WRITE'}
function Start-ScheduledTask{$script:apiMutators++;throw 'FORBIDDEN_API_RESTART'}
function Stop-ScheduledTask{$script:apiMutators++;throw 'FORBIDDEN_API_STOP'}
`;
win('WebOnlyRefreshInstall plan binds existing web-only identity and refuses any API pair delta without an API admission',()=>{
 assert.equal(run(noApiMutators+String.raw`
 $script:WebOnlyRefreshInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:b6=[pscustomobject]@{maintenancePurpose='WebOnlyFrontendRefresh'}
 $script:current=@{package='current';manifest=('a'*64);apiPackage='fixed-api';apiManifest=('b'*64);baseSource=('c'*40);node='fixed-node';nodeHash=('d'*64);profile='fixed-profile';runtime='fixed-runtime'};$script:next=$current.Clone();$next.package='candidate';$next.manifest='e'*64
 function Get-Business5244FinitePairPins($ScopeName,$Mode){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'){throw 'SCOPE_CHANGED'};if($Mode-ceq'Current'){return $script:current.Clone()};return $script:next.Clone()}
 $expected=Get-B6WebOnlyExpectedProjection;$identity=@($next.package,$next.manifest,$next.apiPackage,$next.apiManifest,$next.nodeHash,$next.profile)-join'|';if($expected.planHash-cne(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($identity)))){throw 'WEBONLY_PLAN_DIFFERS_FROM_EXISTING_OWNER'}
 foreach($key in @('apiPackage','apiManifest','baseSource','node','nodeHash','profile','runtime')){$old=$next[$key];$next[$key]='changed';$denied=$false;try{Get-B6WebOnlyExpectedProjection|Out-Null}catch{$denied=$true};$next[$key]=$old;if(!$denied){throw 'API_PAIR_DELTA_ADMITTED'}}
 if($apiMutators){throw 'API_MUTATOR_CALLED'};'PASS'`),'PASS');
});
win('WebOnlyRefreshInstall invokes the shared once-only sequence and never creates an API transition or replays lost ACK',()=>{
 assert.equal(run(inert+noApiMutators+String.raw`
 $script:WebOnlyRefreshInstall=$true;function Send-ReadPairSingleRetire{$calls.Add('retire');throw 'ISOLATED_ACK_LOST'}
 $result=Invoke-ReadPairInstallSequence
 if($result-cne'CandidateVerified'-or($calls-join'|')-cne'open|target|coldstop|start|ready|retire|ACK_UNCONFIRMED_READONLY_RECONCILIATION|readback|CandidateVerified|close'-or$apiMutators){throw 'WEBONLY_ORDER_OR_API_EFFECT'};'PASS'`),'PASS');
});
win('WebOnlyRefreshInstall healthy pre-retire Current recovery retains its own host without an API plan restart or profile write',()=>{
 assert.equal(run(noApiMutators+String.raw`
 $script:WebOnlyRefreshInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:before=@{inert=$true};$script:held=@();$script:created=@();$script:newResourceRows=@();$script:b6InitializationExitProcess=$null;$script:pins=@{apiPackage='unchanged'};$script:checks=[Collections.Generic.List[string]]::new()
 $si=[Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME 'powershell.exe'),'-NoProfile -NonInteractive -Command "Start-Sleep -Seconds 60"');$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$script:newHost=[Diagnostics.Process]::Start($si);$birth=$newHost.StartTime.ToUniversalTime().Ticks
 function Assert-B6ReadPairEntryHandoffReady{$checks.Add('entries')};function Assert-B6ReadPairRecoveryOwner{$checks.Add('own-ref')};function Owner-Status{return @{ownerPid=$newHost.Id}}
 function Assert-B6ReadPairCurrentRecoveryRecord($Status,[switch]$Router){if(!$Router-or$Status.ownerPid-ne$newHost.Id){throw 'FOREIGN_CURRENT'};$checks.Add('record')}
 function Assert-B6WebOnlyApiBoundary{$checks.Add('api-unchanged')};function Invoke-RestMethod{return @{ok=$true}};function Assert-Business5244ApiHealth{$checks.Add('health')};function Assert-ReadPairProtection{$checks.Add('protection')};function Record-Phase($Phase){$checks.Add($Phase)}
 try{Restore-ReadPairBeforeRetire -OldStopped $true;if($newHost.HasExited-or$apiMutators-or($checks-join'|')-cne'entries|own-ref|record|api-unchanged|health|protection|PRE_RETIRE_HEALTHY_CURRENT_RETAINED'){throw 'WEBONLY_CURRENT_NOT_RETAINED'}}finally{if(!$newHost.HasExited){if($newHost.StartTime.ToUniversalTime().Ticks-ne$birth){throw 'OWN_CHILD_CHANGED'};$newHost.Kill();$newHost.WaitForExit()};$newHost.Dispose()};'PASS'`),'PASS');
});
const webOnlyBoundaryFixture=String.raw`
Set-StrictMode -Version Latest
foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Microsoft.PowerShell.Core\Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules',$name,($name+'.psd1'))) -Scope Local -ErrorAction Stop}
. __STARTUP__ -Library
Add-Type -LiteralPath __PEER__
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(__QUIESCENCE__,[ref]$tokens,[ref]$errors)
$kernel=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Initialize-Test125ApiKernel'},$false));if($kernel.Count-ne1){throw 'KERNEL_SOURCE_MISSING'};. ([scriptblock]::Create($kernel[0].Extent.Text));Initialize-Test125ApiKernel
$si=[Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME 'powershell.exe'),'-NoProfile -NonInteractive -Command "Start-Sleep -Seconds 60"');$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$child=[Diagnostics.Process]::Start($si);$fileBirth=$child.StartTime.ToUniversalTime().ToFileTimeUtc().ToString();$ticks=$child.StartTime.ToUniversalTime().Ticks
$script:WebOnlyApiHandle=$null;try{
$script:WebOnlyApiHandle=$null;$script:WebOnlyRefreshInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:taskXml='<Task>immutable</Task>';$script:sddl='fixed-task-security';$script:instance='fixed-instance';$script:engine=$PID
$files=@(1..4|ForEach-Object{$p=Join-Path $PSScriptRoot ('keep-'+$_+'.json');[IO.File]::WriteAllText($p,'unchanged-'+$_);[pscustomobject]@{path=$p;sha256=(Get-FileHash -LiteralPath $p).Hash.ToLowerInvariant()}})
$taskCapture=[pscustomobject]@{schema='melisa-b6-task-capture.v1';readOnly=$true;taskPath='\Melisa-ERP-TEST-Canonical';instanceCount=1;enginePid=$PID;instanceGuid=$instance;xmlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($taskXml)));sddlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($sddl)));writes=0}
$boundary=[pscustomobject]@{schema='melisa-b6-webonly-api-before.v1';readOnly=$true;executionAuthority=$false;apiPid=$child.Id;apiBirth=$fileBirth;apiParent=$PID;apiManifestSha256=('560c735fcaffa6692f55543840f81066'+'79b43b871e3c19f1990bdd17d46f9946');taskCaptureSha256='075bb030c4fd26a82bf349e95cfcda17d425d8b7ebc08d43fde3d86e75e38fdf';taskWrites=0;apiRestarts=0;sqlWrites=0;files=$files;health=[pscustomobject]@{ok=$true;mode='erp';packageId='fixed-api';port=4144;sysadmin=0}}
$script:b6=[pscustomobject]@{maintenancePurpose='WebOnlyFrontendRefresh';apiBoundary=$boundary;taskCapture=$taskCapture;owner=[pscustomobject]@{protectedSnapshot=[pscustomobject]@{listeners=@(foreach($address in @('127.0.0.1','192.168.1.46')){[pscustomobject]@{LocalPort=4144;LocalAddress=$address;OwningProcess=$child.Id}});processes=@([pscustomobject]@{pid=$child.Id;exe=(Join-Path $PSHOME 'powershell.exe')})}}}
# Only the fixed target identity is translated in this copy. QueryOnlyOpen and
# ValidateReadOnly still exercise real retained process handles, never a fake.
$definition=(Get-Command Assert-B6WebOnlyApiBoundary).Definition.Replace('$b.apiPid-ne41436',('$b.apiPid-ne'+$child.Id)).Replace("'134377688108359820'",("'"+$fileBirth+"'")).Replace('$b.apiParent-ne13532',('$b.apiParent-ne'+$PID));. ([scriptblock]::Create('function Assert-B6WebOnlyApiBoundary {'+$definition+'}'))
$script:apiCim=[pscustomobject]@{ProcessId=$child.Id;ParentProcessId=$PID;ExecutablePath=(Join-Path $PSHOME 'powershell.exe');CreationDate=$child.StartTime};$script:portPid=$child.Id;$script:listenerMissing=$false;$script:listenerExtra=$false;$script:apiOtherPort=$false;$script:taskCount=1;$script:health=$boundary.health|ConvertTo-Json|ConvertFrom-Json
function Get-CimInstance($ClassName,$Filter){if($ClassName-cne'Win32_Process'-or$Filter-cne('ProcessId='+$child.Id)){throw 'QUERY_OUTSIDE_OWN_CHILD'};return $script:apiCim}
function Child-Sid($Proc){return [Business5244RetirementPeer]::CurrentSid}
function Get-NetTCPConnection($State){if($State-cne'Listen'){throw 'OTHER_QUERY'};$addresses=@('127.0.0.1','192.168.1.46');if($script:listenerMissing){$addresses=@('127.0.0.1')};if($script:listenerExtra){$addresses+=@('::1')};foreach($address in $addresses){[pscustomobject]@{LocalPort=4144;LocalAddress=$address;OwningProcess=$script:portPid}};if($script:apiOtherPort){[pscustomobject]@{LocalPort=9999;LocalAddress='127.0.0.1';OwningProcess=$script:portPid}}}
function Get-Test125ReadPairTask{$t=[pscustomobject]@{Xml=$script:taskXml};$t|Add-Member ScriptMethod GetSecurityDescriptor {param($flags);return $script:sddl};$t|Add-Member ScriptMethod GetInstances {param($flags);$o=[pscustomobject]@{Count=$script:taskCount};$o|Add-Member ScriptMethod Item {param($n);return [pscustomobject]@{EnginePID=$script:engine;InstanceGuid=$script:instance}};return $o};return $t}
function Invoke-RestMethod($Uri,$TimeoutSec){if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'OTHER_HTTP'};return $script:health}
$script:WebOnlyApiHandle=[Test125ApiKernel]::QueryOnlyOpen($child.Id,$ticks)
__BODY__
}finally{if($script:WebOnlyApiHandle){$script:WebOnlyApiHandle.Dispose()};if(!$child.HasExited){if($child.StartTime.ToUniversalTime().Ticks-ne$ticks){throw 'OWN_CHILD_CHANGED'};$child.Kill();$child.WaitForExit()};$child.Dispose()};'PASS'
`.replace('__STARTUP__',q(path.join(dir,'business-5244-startup-exclusion.ps1'))).replace('__PEER__',q(path.join(dir,'business-5244-retirement-peer.cs'))).replace('__QUIESCENCE__',q(path.join(dir,'test125-bound-api-quiescence.ps1')));
win('WebOnlyRefreshInstall actual query-only API handle accepts unchanged process files task and health; every drift blocks',()=>{
 assert.equal(run(noApiMutators+webOnlyBoundaryFixture.replace('__BODY__',String.raw`
 Assert-B6WebOnlyApiBoundary
 foreach($case in @('birth','exe','parent','listener','listener-missing','listener-extra','api-other-port','file','task-xml','task-sddl','task-engine','task-instance','task-count','health')){
  $saved=@{birth=$apiCim.CreationDate;exe=$apiCim.ExecutablePath;parent=$apiCim.ParentProcessId;port=$portPid;xml=$taskXml;sddl=$sddl;engine=$engine;instance=$instance;count=$taskCount;mode=$health.mode};$bytes=[IO.File]::ReadAllBytes($files[0].path)
  switch($case){'birth'{$apiCim.CreationDate=$apiCim.CreationDate.AddSeconds(1)}'exe'{$apiCim.ExecutablePath='other.exe'}'parent'{$apiCim.ParentProcessId++}'listener'{$script:portPid++}'listener-missing'{$script:listenerMissing=$true}'listener-extra'{$script:listenerExtra=$true}'api-other-port'{$script:apiOtherPort=$true}'file'{[IO.File]::WriteAllText($files[0].path,'changed')}'task-xml'{$script:taskXml+='x'}'task-sddl'{$script:sddl+='x'}'task-engine'{$script:engine++}'task-instance'{$script:instance+='x'}'task-count'{$script:taskCount=0}'health'{$script:health.mode='other'}}
  $denied=$false;try{Assert-B6WebOnlyApiBoundary}catch{$denied=$true};if(!$denied-or$apiMutators-or$child.HasExited){throw ('WEBONLY_BOUNDARY_ACCEPTED_'+$case)}
  $apiCim.CreationDate=$saved.birth;$apiCim.ExecutablePath=$saved.exe;$apiCim.ParentProcessId=$saved.parent;$script:portPid=$saved.port;$script:listenerMissing=$false;$script:listenerExtra=$false;$script:apiOtherPort=$false;$script:taskXml=$saved.xml;$script:sddl=$saved.sddl;$script:engine=$saved.engine;$script:instance=$saved.instance;$script:taskCount=$saved.count;$script:health.mode=$saved.mode;[IO.File]::WriteAllBytes($files[0].path,$bytes)
 }
 $script:WebOnlyApiHandle.Dispose();$denied=$false;try{Assert-B6WebOnlyApiBoundary}catch{$denied=$true};if(!$denied-or$apiMutators){throw 'CLOSED_API_HANDLE_ACCEPTED'}
 `)),'PASS');
});
win('WebOnlyRefreshInstall real preflight dispatch retains a query-only handle and package seal without API constructors',()=>{
 assert.equal(run(noApiMutators+webOnlyBoundaryFixture.replace('__BODY__',String.raw`
 Add-Type -LiteralPath __WEB_NATIVE__
 $script:WebOnlyApiHandle.Dispose();Remove-Variable WebOnlyApiHandle -Scope Script
 $script:payloadChecks=0;$script:pair=@{package='old-web';manifest=('a'*64);apiPackage='same-api';apiManifest=('b'*64);baseSource=('c'*40);node='same-node';nodeHash=('d'*64);profile='same-profile';runtime='same-runtime'}
 function Get-Business5244FinitePairPins($ScopeName,$Mode){$p=$script:pair.Clone();if($Mode-ceq'Candidate'){$p.package='next-web';$p.manifest='e'*64};return $p}
 function Assert-Business5244OwnedPackage($Pins,$Seal){$script:payloadChecks++;$Seal.Add($files[0].path,$files[0].sha256)}
 try{Initialize-B6ReadPairControllerPreflight;if($apiMutators-or$payloadChecks-ne2-or!$script:WebOnlyApiHandle.QueryOnly){throw 'WEBONLY_PREFLIGHT_USED_API_ADMISSION'};$script:WebOnlyPackageSeal.Validate();[Test125ApiKernel]::ValidateReadOnly($script:WebOnlyApiHandle,$ticks)}finally{if(Get-Variable WebOnlyPackageSeal -Scope Script -ErrorAction SilentlyContinue){$script:WebOnlyPackageSeal.Dispose()}}
 `.replace('__WEB_NATIVE__',q(path.join(dir,'business-5244-web-native.cs'))))),'PASS');
});
win('WebOnlyRefreshInstall normal managed exit proves same mutex and twenty-six unchanged leaves without API mutation',()=>{
 const fixture=managedFixture.replace('@(1..11|ForEach-Object','@(1..19|ForEach-Object');
 const answer=activeRun(noApiMutators+String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_WEBONLY_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;Complete-B6ReadPairActiveEntryHandoff
 $h=Get-B6ReadPairActiveHandoff;if(!$control.CompletedStop-or$h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$held.Count-ne26-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1-or$apiMutators){throw 'WEBONLY_MANAGED_EXIT_BROKEN'}
 `,String.raw`$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:RehearsalOnly=$false;$script:WebOnlyRefreshInstall=$true;$b6.rehearsalOnly=$false;$b6|Add-Member maintenancePurpose 'WebOnlyFrontendRefresh'`,fixture);
 assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('WebOnlyRefreshInstall publication preserves all twenty-six historic leaves and exact active Writer router/core order',()=>{
 const fixture=writerPublicationFixture.replace('$script:WriterInstall=$true;',"$script:WriterInstall=$false;$script:WebOnlyRefreshInstall=$true;").replace('50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65','e480d77c835f3c2170589b9fbafec6da78dd2a19624d486d8822ad7b930d3a09').replace('postExitExclusiveEntryCount=24','postExitExclusiveEntryCount=26');
 assert.equal(run(fixture+noApiMutators+String.raw`
 $b6|Add-Member maintenancePurpose 'WebOnlyFrontendRefresh';function Get-B6WebOnlyExpectedProjection{return @{planHash=('f'*64)}}
 $router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2'
 $b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.entry=[pscustomobject]@{root=$router;leaf='start-business-5244-readpair-router.ps1';manifestSha256=('b'*64);sha256=('c'*64);postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false};$b6.owner|Add-Member router ([pscustomobject]@{root=$router;manifestSha256=('b'*64);entrySha256=('c'*64)});$b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('d'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('e'*64);bytes=15})})
 foreach($name in @('ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3','ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3','ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY','ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY','ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029','ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029','ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2','ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2')){$leaf=if($name.Contains('ROUTER')){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'};$b6.entryCapture.directEntries+=@([pscustomobject]@{path=('C:\Sirket\ERP\releases\'+$name+'\'+$leaf);sha256=$(if($name.EndsWith('-V2')){if($name.Contains('ROUTER')){'c'*64}else{'e'*64}}else{'a'*64})})}
 Open-B6ReadPairPublication
 if($heldPaths.Count-ne25-or$b6.entryCapture.directEntries.Count-ne20-or$heldPaths.Contains((Join-Path $router 'start-business-5244-readpair-router.ps1'))-or$heldPaths.Contains((Join-Path $core 'run-current-owner.ps1'))-or$phases.Count-ne1-or$apiMutators){throw 'WEBONLY_ENTRY_SCOPE_CHANGED'}
 $argsText=Get-B6ReadPairOwnerArguments $router ('b'*64);if(!$argsText.EndsWith(' -ScopeName TEST125-API-B6-WRITER-20261029')){throw 'WRITER_PREDECESSOR_SCOPE_CHANGED'}
 $heldPaths.Clear();$phases.Clear();$swap=$b6.entryCapture.directEntries[18];$b6.entryCapture.directEntries[18]=$b6.entryCapture.directEntries[19];$b6.entryCapture.directEntries[19]=$swap;$denied=$false;try{Open-B6ReadPairPublication}catch{if($_.Exception.Message-cne'B6_DIRECT_ENTRY_SCOPE_CHANGED'){throw};$denied=$true};if(!$denied-or$heldPaths.Count-or$phases.Count-or$apiMutators){throw 'WEBONLY_WRONG_ORDER_ACCEPTED'};'PASS'`),'PASS');
});
win('SteadyStartupInstall production publication binds owner62d3 and twenty-eight leaves with real disposable exclusive file handles',()=>{
 const fixture=writerPublicationFixture.replace('$script:WriterInstall=$true;',"$script:WriterInstall=$false;$script:WebOnlyRefreshInstall=$true;$script:SteadyStartupInstall=$true;").replace('50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65','62d3882ceef3caf71a263ad51e036453eee2d59dbe871b8ccd2a03f3ad9756f8').replace('postExitExclusiveEntryCount=24','postExitExclusiveEntryCount=28');
 assert.equal(run(". "+q(path.join(dir,'business-5244-startup-exclusion.ps1'))+" -Library;"+String.raw`$realEntryHold=(Get-Command Hold-B6ReadPairEntry).ScriptBlock;`+fixture+noApiMutators+String.raw`
 $b6|Add-Member maintenancePurpose 'WebOnlySteadyStartup';function Get-B6WebOnlyExpectedProjection{return @{planHash=('f'*64)}}
 $router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029'
 $b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.entry=[pscustomobject]@{root=$router;leaf='start-business-5244-readpair-router.ps1';manifestSha256=('b'*64);sha256=('c'*64);postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false};$b6.owner|Add-Member router ([pscustomobject]@{root=$router;manifestSha256=('b'*64);entrySha256=('c'*64)});$b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('d'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('e'*64);bytes=15})})
 foreach($name in @(
 'ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029'
 )){$leaf=if($name.Contains('ROUTER')){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'};$b6.entryCapture.directEntries+=@([pscustomobject]@{path=('C:\Sirket\ERP\releases\'+$name+'\'+$leaf);sha256=('a'*64)})}
 $bytes=[Text.Encoding]::UTF8.GetBytes('synthetic unchanged entry bytes');$hash=Get-Business5244StartupHash $bytes;$script:fileMap=@{};$script:held=[Collections.Generic.List[object]]::new();$script:gateStreams=[Collections.Generic.List[IO.FileStream]]::new();$index=0
 foreach($row in @($b6.entryCapture.entries)+@($b6.entryCapture.directEntries)){$index++;$path=Join-Path $PSScriptRoot ('entry-'+$index+'.ps1');[IO.File]::WriteAllBytes($path,$bytes);$fileMap[$row.path]=$path;if($row.PSObject.Properties['beforeSha256']){$row.beforeSha256=$hash}else{$row.sha256=$hash}}
 $b6.owner.entry.sha256=$hash;$b6.owner.router.entrySha256=$hash;$b6.owner.core.files[0].sha256=$hash
 $gate=Join-Path $PSScriptRoot 'inert-gate.ps1';[IO.File]::WriteAllBytes($gate,$bytes)
 # Translate only the fixed approved logical leaves to disposable physical
 # files. The actual production hold opens the real exclusive OS handles.
 function Hold-B6ReadPairEntry($Path,$Hash){if(!$fileMap.ContainsKey($Path)){throw 'UNMAPPED_ENTRY'};$heldPaths.Add($Path);&$realEntryHold $fileMap[$Path] $Hash}
 function Hold-B6ReadPairSource($Path,$Hash){if($Path-cne$b6.entryCapture.gate.path-or$Hash-cne$b6.entryCapture.gate.sha256){throw 'OTHER_GATE'};$gateStreams.Add([IO.File]::Open($gate,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read));$heldPaths.Add($Path)}
 try{
  Open-B6ReadPairPublication
  if($held.Count-ne26-or$heldPaths.Count-ne27-or$gateStreams.Count-ne1-or$b6.entryCapture.directEntries.Count-ne22-or$apiMutators){throw 'STEADY_28_ENTRY_CLOSURE_CHANGED'}
  foreach($item in $held){if($item.stream.CanWrite-or(Get-Business5244StartupHash (Read-ReadPairHeldBytes $item.stream))-cne$hash){throw 'STEADY_ENTRY_BYTES_CHANGED'};$denied=$false;try{$other=[IO.File]::Open($item.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$other.Dispose()}catch{$denied=$true};if(!$denied){throw 'STEADY_ENTRY_NOT_EXCLUSIVE'}}
 }finally{foreach($item in $held){$item.stream.Dispose()};foreach($stream in $gateStreams){$stream.Dispose()}}
 $held.Clear();$gateStreams.Clear();$heldPaths.Clear();$phases.Clear();$saved=$b6.entryCapture|ConvertTo-Json -Depth 20
 foreach($case in @('old-owner','direct-count','direct-order','old-exclusive-count','runtime-claim')){
  $b6.entryCapture=$saved|ConvertFrom-Json
  switch($case){'old-owner'{$b6.entryCapture.ownerCaptureSha256='e480d77c835f3c2170589b9fbafec6da78dd2a19624d486d8822ad7b930d3a09'}'direct-count'{$b6.entryCapture.directEntries=@($b6.entryCapture.directEntries|Select-Object -First 21)}'direct-order'{$swap=$b6.entryCapture.directEntries[20];$b6.entryCapture.directEntries[20]=$b6.entryCapture.directEntries[21];$b6.entryCapture.directEntries[21]=$swap}'old-exclusive-count'{$b6.entryCapture.postExitExclusiveEntryCount=26}'runtime-claim'{$b6.entryCapture.runtimeValidationComplete=$true}}
  $denied=$false;try{Open-B6ReadPairPublication}catch{$denied=$true};if(!$denied-or$held.Count-or$gateStreams.Count-or$heldPaths.Count-or$phases.Count-or$apiMutators){throw ('STEADY_CAPTURE_FALSE_ADMISSION_'+$case)}
 };foreach($path in $fileMap.Values){if((Get-Business5244StartupHash ([IO.File]::ReadAllBytes($path)))-cne$hash){throw 'STEADY_TEST_ENTRY_MUTATION'}};'PASS'`),'PASS');
});

win('PreviewLinkInstall is independent, Writer-scoped and rejects combined modes before reading or preparing a bundle',()=>{
 assert.equal(run('. '+q(path.join(dir,'install-business-5244-readpair.ps1'))+" -Library -PreviewLinkInstall -ScopeName TEST125-API-B6-WRITER-20261029;if(!$PreviewLinkInstall-or$WriterInstall-or$WebOnlyRefreshInstall-or$SteadyStartupInstall){throw 'PREVIEW_ALIAS'};'PASS'"),'PASS');
 for(const extra of ['-WriterInstall','-CandidateInstall','-RehearsalOnly','-WebOnlyRefreshInstall','-SteadyStartupInstall','-AfterLoaderRecovery','-CurrentOnlySupersession','-InitializerCleanRecovery']){
  const r=cp.spawnSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(dir,'install-business-5244-readpair.ps1'),'-Library','-PreviewLinkInstall','-ScopeName','TEST125-API-B6-WRITER-20261029',extra],{encoding:'utf8',windowsHide:true,timeout:10000});assert.notEqual(r.status,0);assert.match(r.stderr,/B6_PREVIEW_LINK_FIXED_ACTION_REQUIRED/);
 }
 assert.equal(run(String.raw`$script:PreviewLinkInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$n=0;function Get-FileHash{$script:n++;throw 'SIDE_EFFECT'};$denied=$false;try{Open-B6PreviewLinkPreparedSource ('a'*64) 'C:\foreign.ps1'|Out-Null}catch{if($_.Exception.Message-cne'B6_PREVIEW_LINK_REVIEWED_ENTRY_REQUIRED'){throw};$denied=$true};if(!$denied-or$n){throw 'PREVIEW_UNSEALED_SOURCE_ACCEPTED'};'PASS'`),'PASS');
});
win('PreviewLinkInstall once-only sequence publishes future startup only after Candidate or Rollback readback; publication failure never retires twice',()=>{
 assert.equal(run(inert+String.raw`
 $script:PreviewLinkInstall=$true;function Get-B6ReadPairActiveHandoff{return @{stopAttempted=$true}};function Complete-B6PreviewLinkTaskPublication($Outcome){$calls.Add('future:'+ $Outcome);if($script:failPublish){throw 'B6_PREVIEW_LINK_TASK_UPDATE_UNCONFIRMED'}}
 foreach($outcome in @('CandidateVerified','RollbackVerified')){$calls.Clear();$script:outcome=$outcome;$script:failPublish=$false;function Wait-ReadPairFinalState{$calls.Add('readback');return $script:outcome};$actual=Invoke-ReadPairInstallSequence;if($actual-cne$outcome-or($calls-join'|')-cne('open|target|coldstop|start|ready|retire|readback|future:'+$outcome+'|'+$outcome+'|close')){throw 'PREVIEW_SEQUENCE_CHANGED'}}
 $calls.Clear();$script:failPublish=$true;$denied=$false;try{Invoke-ReadPairInstallSequence|Out-Null}catch{if($_.Exception.Message-cne'B6_PREVIEW_LINK_TASK_UPDATE_UNCONFIRMED'){throw};$denied=$true};if(!$denied-or($calls-join'|')-cne'open|target|coldstop|start|ready|retire|readback|future:RollbackVerified|OWNER_RECOVERY_REQUIRED_NO_SECOND_RETIRE|close'){throw 'PREVIEW_PUBLICATION_REPLAY_OR_RESTORE'};'PASS'`),'PASS');
});
win('PreviewLinkInstall purpose comes from its native admission; false to true Writer activation and native DDL factories remain unused',()=>{
 assert.equal(run(String.raw`
 $script:PreviewLinkInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:events=[Collections.Generic.List[string]]::new();$script:cap=[pscustomobject]@{opaque='test'}
 function Read-ErpStartupConfig{return @{fixture='startup'}};function New-ErpBusinessSalePackageRefreshAdmission($Config){$events.Add('refresh');return $cap};function New-ErpBusinessSaleWriterProfileAdmission{throw 'WRITER_ACTIVATION_FORBIDDEN'};function New-ErpBusinessSaleNativeProfileAdmission{throw 'SQL_ADMISSION_FORBIDDEN'}
 function Get-ErpBusinessSaleNativeAdmissionContext($Admission){if(![object]::ReferenceEquals($Admission,$cap)){throw 'CAP_CHANGED'};return [pscustomobject]@{mode=$script:purpose;ownerInputs=[pscustomobject]@{maintenancePurpose='PreviewLinkPackageRefresh'}}}
 function Assert-ErpBusinessSaleWriterProfileAdmission($Admission,$Phase){if(![object]::ReferenceEquals($Admission,$cap)-or$Phase-cne'WriterPrepared'){throw 'REFRESH_PHASE_CHANGED'}}
 function New-ErpReadPairPreparedReleaseProof($Config,$ScopeName,$NativeProfileAdmission){if($ScopeName-cne'TEST125-API-B6-WRITER-20261029'-or![object]::ReferenceEquals($NativeProfileAdmission,$cap)){throw 'REFRESH_PROOF_CHANGED'};$events.Add('proof');return [pscustomobject]@{opaque='proof'}}
 function Get-Test125BoundMaintenancePlan{$events.Add('api-before')};function Get-ReadPairExpectedHashes{$events.Add('expected')};function Initialize-B6PreviewLinkTaskPublication{$events.Add('future-before')}
 $script:purpose='PackageRefresh';Initialize-B6ReadPairControllerPreflight;if(($events-join'|')-cne'refresh|proof|api-before|expected|future-before'){throw 'REFRESH_PREFLIGHT_ORDER'}
 $events.Clear();$script:purpose='WriterProfileActivation';$denied=$false;try{Initialize-B6ReadPairControllerPreflight}catch{if($_.Exception.Message-cne'B6_PACKAGE_REFRESH_PURPOSE_REQUIRED'){throw};$denied=$true};if(!$denied-or($events-join'|')-cne'refresh'){throw 'WRITER_PURPOSE_WIDENED'};'PASS'`),'PASS');
});
const previewTaskFixture=steadyTaskFixture.replace("$script:SteadyStartupInstall=$true;$script:WebOnlyRefreshInstall=$true;","$script:SteadyStartupInstall=$false;$script:WebOnlyRefreshInstall=$false;$script:PreviewLinkInstall=$true;").replaceAll('ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2','ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029');
win('PreviewLinkInstall finite task projection preserves all XML except old steady to silent LINK to final selected launcher',()=>{
 assert.equal(run(previewTaskFixture+String.raw`
 $old='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029\start-owned-test.ps1';$silent='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030\start-owned-test.ps1';$candidate='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030\start-owned-test.ps1'
 $first=New-B6PreviewLinkTaskXml $beforeXml Silent;$success=New-B6PreviewLinkTaskXml $first Candidate;$rollback=New-B6PreviewLinkTaskXml $first Rollback
 if(!$first.Contains($silent)-or!$success.Contains($candidate)-or(Get-B6SteadyTaskXmlCanonical $rollback)-cne(Get-B6SteadyTaskXmlCanonical $beforeXml)-or(Get-B6SteadyTaskXmlCanonical $success.Replace($candidate,$old))-cne(Get-B6SteadyTaskXmlCanonical $beforeXml)-or$registrations.Count-or$apiMutators){throw 'PREVIEW_TASK_XML_SCOPE'}
 foreach($case in @('extra','command','wrong-old','multiple','wrong-stage')){$xml=$beforeXml;switch($case){extra{$xml=$xml.Replace('</Arguments>',' -Other</Arguments>')}command{$xml=$xml.Replace('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','C:\foreign.exe')}'wrong-old'{$xml=$xml.Replace($old,$candidate)}multiple{$xml=$xml.Replace('</Actions>','<Exec><Command>x</Command></Exec></Actions>')}};$denied=$false;try{New-B6PreviewLinkTaskXml $xml $(if($case-ceq'wrong-stage'){'Candidate'}else{'Silent'})|Out-Null}catch{if($_.Exception.Message-cne'B6_PREVIEW_LINK_TASK_ACTION_CHANGED'){throw};$denied=$true};if(!$denied){throw 'UNBOUNDED_TASK_PROJECTION'}};'PASS'`),'PASS');
});
win('PreviewLinkInstall protection projection permits only declared API4144 generation changes and preserves every unrelated process file and socket',()=>{
 assert.equal(run(String.raw`
 $before=[pscustomobject]@{listeners=@(@{LocalPort=4144;LocalAddress='127.0.0.1';OwningProcess=41},@{LocalPort=4144;LocalAddress='192.0.2.1';OwningProcess=41},@{LocalPort=4146;LocalAddress='127.0.0.1';OwningProcess=42});processes=@(@{pid=41;birth='api-old';exe='node'},@{pid=42;birth='native';exe='node'},@{pid=99;birth='unrelated';exe='unrelated'});files=@(@{path='protected';hash=('a'*64)})};$signature=Get-ReadPairProtectionSignature (Get-B6PreviewLinkProtectionProjection $before)
 $after=$before|ConvertTo-Json -Depth 10|ConvertFrom-Json;foreach($row in $after.listeners){if($row.LocalPort-eq4144){$row.OwningProcess=43}};$after.processes[0].pid=43;$after.processes[0].birth='api-new';if((Get-ReadPairProtectionSignature (Get-B6PreviewLinkProtectionProjection $after))-cne$signature){throw 'API_RESTART_REJECTED'}
 foreach($case in @('companion','unrelated','file','extra-socket','extra-process')){$next=$after|ConvertTo-Json -Depth 10|ConvertFrom-Json;switch($case){companion{$next.processes[1].birth='changed'}unrelated{$next.processes[2].birth='changed'}file{$next.files[0].hash=('b'*64)}'extra-socket'{$next.listeners+=@([pscustomobject]@{LocalPort=5234;LocalAddress='127.0.0.1';OwningProcess=77})}'extra-process'{$next.processes+=@([pscustomobject]@{pid=77;birth='extra';exe='extra'})}};if((Get-ReadPairProtectionSignature (Get-B6PreviewLinkProtectionProjection $next))-ceq$signature){throw ('PROTECTED_COMPANION_DROPPED_'+$case)}};'PASS'`),'PASS');
});
const previewPublicationFixture=previewTaskFixture+String.raw`
Add-Type 'using System;public sealed class PreviewQueryHandle:IDisposable {public bool Closed;public void Dispose(){Closed=true;}}public static class Test125ApiKernel {public static PreviewQueryHandle QueryOnlyOpen(int pid,long birth){if(pid<1||birth<1)throw new Exception("QUERY_INPUT");return new PreviewQueryHandle();}public static void ValidateReadOnly(PreviewQueryHandle h,long birth){if(h==null||h.Closed)throw new Exception("CLOSED_NATIVE_QUERY");}}'
$script:b6=[pscustomobject]@{maintenancePurpose='PreviewLinkPackageRefresh';taskCapture=[pscustomobject]@{xmlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($beforeXml)));sddlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($script:taskSddl)))}}
$script:b6ReadProof=[pscustomobject]@{opaque='release'};$script:b6NativeAdmission=[pscustomobject]@{opaque='native'};$script:held=@();$script:ready=[pscustomobject]@{ownerBirth='owner-birth'};$script:newHost=[pscustomobject]@{Id=300};$script:pins=@{};$script:result=@{final=@{mode='Candidate';childPid=301;childBirth='child-birth'}};$script:planReads=0;$script:boundaryReads=0
$script:expected=@{startupPath='C:\fixture\startup.json';apiPath='C:\fixture\api.json';basePath='C:\fixture\base.json';baseHash=('a'*64);Current=@{startup=('b'*64);api=('c'*64)};Candidate=@{startup=('d'*64);api=('c'*64)}}
$script:fixtureMode='Candidate';$script:fixtureBirth=[datetime]'2026-10-30T00:00:00Z';$script:fixtureExe='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';$script:fixtureArgv='"'+$fixtureExe+'" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030\start-owned-test.ps1" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
function Get-ErpReadPairReleaseProofContext($Proof){if(![object]::ReferenceEquals($Proof,$b6ReadProof)){throw 'FORGED_RELEASE_PROOF'};$seal=[pscustomobject]@{};$seal|Add-Member ScriptMethod Validate {};return @{seal=$seal}}
function Assert-ErpBusinessSaleWriterProfileAdmission($Admission,$Phase){if(![object]::ReferenceEquals($Admission,$b6NativeAdmission)-or$Phase-cne'WriterPrepared'){throw 'FORGED_NATIVE_ADMISSION'};return $true}
function Get-ErpBusinessSaleNativeAdmissionContext($Admission){if(![object]::ReferenceEquals($Admission,$b6NativeAdmission)){throw 'FORGED_NATIVE_ADMISSION'};return @{mode='PackageRefresh';pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;phase='WriterPrepared';transition=$null}}
function Read-ErpStartupConfig($Path,$PreparedReleaseProof){return @{fixture='startup'}};function Assert-Test125ReadPairConfig{return $true}
function Get-FileHash($LiteralPath){$hash=if($LiteralPath-ceq$expected.startupPath){$expected[$script:fixtureMode].startup}elseif($LiteralPath-ceq$expected.apiPath){$expected[$script:fixtureMode].api}elseif($LiteralPath-ceq$expected.basePath){$expected.baseHash}else{throw 'FOREIGN_PROFILE_READ'};if($script:scenario-ceq'file-change'){$hash='f'*64};return @{Hash=$hash}}
function Owner-Status{return @{phase='Running';ownerPid=300;ownerBirth='owner-birth';childPid=301;childBirth='child-birth'}};function Assert-OldTarget($Status){if($Status.ownerPid-ne300){throw 'WRONG_WEB_OWNER'}}
function Invoke-RestMethod{return @{ok=$true}};function Assert-Business5244ApiHealth{$script:boundaryReads++};function Invoke-WebRequest{return @{StatusCode=200}};function Assert-ReadPairProtection{}
function Get-Test125BoundMaintenancePlan{throw 'OLD_CONTROLLER_PREFLIGHT_PLAN_AT_FINAL_FORBIDDEN'}
function Get-Test125PackageRefreshPostTransitionPlan($Mode,$PreparedReleaseProof){if($Mode-cne$fixtureMode-or![object]::ReferenceEquals($PreparedReleaseProof,$b6ReadProof)){throw 'WRONG_FINAL_OBSERVATION'};$script:planReads++;return @{status=$(if($script:scenario-ceq'observation-kind'){'PREPARED_NOT_REHEARSED'}else{'POST_TRANSITION_READONLY_NOT_ADMISSION'});readOnly=$true;executionAuthority=$false;supervisor=10000;supervisorBirth=$fixtureBirth.ToUniversalTime().ToString('o');taskInstance='silent-engine-instance';children=@{api=@{pid=10001;birth=$fixtureBirth.ToUniversalTime().ToString('o')}}}}
function Get-ErpProcess($ProcessId){if($ProcessId-eq10000){$birth=$fixtureBirth;if($script:scenario-ceq'engine-change'-and$registrations.Count){$birth=$birth.AddSeconds(1)};return [pscustomobject]@{ProcessId=10000;ParentProcessId=1;CreationDate=$birth;ExecutablePath=$fixtureExe;CommandLine=$fixtureArgv}};if($ProcessId-eq10001){return [pscustomobject]@{ProcessId=10001;ParentProcessId=10000;CreationDate=$fixtureBirth;ExecutablePath='C:\Program Files\nodejs\node.exe';CommandLine='"C:\Program Files\nodejs\node.exe" fixed-api-entry'}};throw 'FOREIGN_PROCESS_READ'}
function Invoke-CimMethod($InputObject,$MethodName){if($MethodName-cne'GetOwnerSid'){throw 'FOREIGN_NATIVE_METHOD'};return @{ReturnValue=0;Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}}
function Initialize-Test125ApiKernel{}
function Get-NetTCPConnection($State,$LocalPort){if($State-cne'Listen'-or$LocalPort-ne4144){throw 'FOREIGN_PORT_READ'};$rows=@([pscustomobject]@{LocalPort=4144;LocalAddress='127.0.0.1';OwningProcess=10001},[pscustomobject]@{LocalPort=4144;LocalAddress='192.0.2.1';OwningProcess=10001});if($script:scenario-ceq'listener-change'-and$registrations.Count){$rows+=@([pscustomobject]@{LocalPort=4144;LocalAddress='192.0.2.2';OwningProcess=999})};return $rows}
$script:taskReads=0;function Get-Test125ReadPairTask{$script:taskReads++;$task=[pscustomobject]@{Xml=$script:taskXml;Definition=[pscustomobject]@{Principal=[pscustomobject]@{LogonType=3;RunLevel=0;UserId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}}};$task|Add-Member ScriptMethod GetSecurityDescriptor {param($flags);if($flags-ne7){throw 'OTHER_SECURITY_QUERY'};return $script:taskSddl};$task|Add-Member ScriptMethod GetInstances {param($flags);if($flags-ne0){throw 'OTHER_INSTANCE_QUERY'};$instances=[pscustomobject]@{Count=1};$instances|Add-Member ScriptMethod Item {param($index);if($index-ne1){throw 'OTHER_INSTANCE_INDEX'};return @{EnginePID=$(if($script:scenario-ceq'cas-engine-change'-and$script:taskReads-ge3){999}else{10000});InstanceGuid='silent-engine-instance'}};return $instances};return $task}
function New-Object {param($ComObject);if($ComObject-cne'Schedule.Service'){throw 'OTHER_COM_OBJECT'};$service=[pscustomobject]@{};$service|Add-Member ScriptMethod Connect {};$service|Add-Member ScriptMethod GetFolder {param($path);if($path-cne'\'){throw 'OTHER_TASK_FOLDER'};$folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod RegisterTask {param($name,$xml,$flags,$user,$password,$logon,$sddl);if($name-cne'Melisa-ERP-TEST-Canonical'-or$flags-ne52-or$user-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or$null-ne$password-or$logon-ne3-or$null-ne$sddl){throw 'OTHER_PUBLICATION'};$script:registrations.Add([int]$flags);if($script:scenario-ceq'not-applied'){throw 'ISOLATED_NOT_APPLIED'};if($script:scenario-ceq'unknown'){$script:taskXml='<Task>unknown</Task>';throw 'ISOLATED_UNKNOWN'};$script:taskXml=$xml;if($script:scenario-ceq'lost-ack'){throw 'ISOLATED_ACK_LOST'}};return $folder};return $service}
`;
win('PreviewLinkInstall actual future publisher uses one UPDATE52 after genuine final plan and retains running API engine on Candidate and Rollback with lost ACK',()=>{
 assert.equal(run(previewPublicationFixture+String.raw`
 foreach($mode in @('Candidate','Current')){
  Remove-Variable PreviewLinkTaskPublication -Scope Script -ErrorAction SilentlyContinue;$script:taskXml=$beforeXml;$script:fixtureMode=$mode;$script:scenario='success';$script:registrations.Clear();$script:planReads=0
  Initialize-B6PreviewLinkTaskPublication;$script:taskXml=$script:PreviewLinkTaskPublication.silentXml;$result.final.mode=if($mode-ceq'Candidate'){'Candidate'}else{'Rollback'};$script:scenario='lost-ack'
  Complete-B6PreviewLinkTaskPublication $(if($mode-ceq'Candidate'){'CandidateVerified'}else{'RollbackVerified'})
  $target=if($mode-ceq'Candidate'){'ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030'}else{'ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'}
  if($script:PreviewLinkTaskPublication.phase-cne'Verified'-or($registrations-join',')-cne'52'-or$planReads-ne1-or!$taskXml.Contains($target)-or!$result.futureTaskActionVerified-or$result.futureTaskActionMode-cne$mode-or$result.physicalRebootTested-or$apiMutators){throw 'PREVIEW_FUTURE_PUBLICATION_CHANGED'}
  $denied=$false;try{Complete-B6PreviewLinkTaskPublication CandidateVerified}catch{if($_.Exception.Message-cne'B6_PREVIEW_LINK_TASK_NO_REPLAY'){throw};$denied=$true};if(!$denied-or$registrations.Count-ne1){throw 'PREVIEW_FUTURE_PUBLICATION_REPLAY'}
 };'PASS'`),'PASS');
});
win('PreviewLinkInstall future publisher rejects task proof SDDL profile engine and listener drift without retrying an unknown task update',()=>{
 assert.equal(run(previewPublicationFixture+String.raw`
 $baselineSddl=$taskSddl
 foreach($case in @('before','sddl','file-change','wrong-proof','not-applied','unknown','engine-change','listener-change','cas-engine-change','observation-kind')){
  Remove-Variable PreviewLinkTaskPublication -Scope Script -ErrorAction SilentlyContinue;$script:taskXml=$beforeXml;$script:taskSddl=$baselineSddl;$script:fixtureMode='Candidate';$script:scenario='success';$script:taskReads=0;$registrations.Clear();Initialize-B6PreviewLinkTaskPublication;$script:taskXml=$script:PreviewLinkTaskPublication.silentXml;$result.final.mode='Candidate';$script:scenario=$case
  switch($case){before{$script:taskXml=$taskXml.Replace('synthetic unchanged','drift')}sddl{$script:taskSddl='drift'}'wrong-proof'{$script:PreviewLinkTaskPublication.proof=[pscustomobject]@{opaque='copy'}}}
  $denied=$false;try{Complete-B6PreviewLinkTaskPublication CandidateVerified}catch{$denied=$true};if(!$denied-or$apiMutators-or($case-cin@('before','sddl','file-change','wrong-proof','cas-engine-change','observation-kind')-and$registrations.Count)){throw ('PREVIEW_FALSE_TASK_PUBLICATION_'+$case)}
  if($case-cin@('not-applied','unknown','engine-change','listener-change')){$count=$registrations.Count;$denied=$false;try{Complete-B6PreviewLinkTaskPublication CandidateVerified}catch{$denied=$true};if(!$denied-or$registrations.Count-ne$count){throw 'PREVIEW_UNKNOWN_TASK_REPLAY'}}
 };'PASS'`),'PASS');
});
win('PreviewLinkInstall managed exit retains one genuine peer generation and non-abandoned mutex across twenty-nine exclusive leaves without force stop',()=>{
 const fixture=managedFixture.replace('@(1..11|ForEach-Object','@(1..22|ForEach-Object');
 const answer=activeRun(String.raw`
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_CURRENT_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;Complete-B6ReadPairActiveEntryHandoff
 $h=Get-B6ReadPairActiveHandoff;if(!$control.CompletedStop-or!$server.HasExited-or$h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$held.Count-ne29-or@($held|Where-Object{$_.holdMode-cne'Exclusive'}).Count-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1){throw 'PREVIEW_MANAGED_EXIT_BROKEN'}
 `,String.raw`$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:RehearsalOnly=$false;$script:PreviewLinkInstall=$true;$b6.rehearsalOnly=$false;$b6|Add-Member maintenancePurpose 'PreviewLinkPackageRefresh'`,fixture);
 assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('PreviewLinkInstall publication preserves twenty-three historic direct entries and only one active old steady core with exact current capture schema',()=>{
 const fixture=writerPublicationFixture.replace('$script:WriterInstall=$true;',"$script:WriterInstall=$false;$script:PreviewLinkInstall=$true;").replace('50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65','124e207b8ab0f8f6a5b3b8227c7183c17b69f2f2725b2837b2dc1bc81410c74b').replace('postExitExclusiveEntryCount=24','postExitExclusiveEntryCount=29');
 assert.equal(run(fixture+String.raw`
 $core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029';$b6.owner.predecessorEntryKind='CurrentCore';$b6.owner.entry=[pscustomobject]@{root=$core;leaf='run-current-owner.ps1';manifestSha256=('d'*64);sha256=('e'*64);postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false};$b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('d'*64)})
 foreach($name in @(
 'ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029'
 'ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'
 )){$leaf=if($name.Contains('ROUTER')){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'};$b6.entryCapture.directEntries+=@([pscustomobject]@{path=('C:\Sirket\ERP\releases\'+$name+'\'+$leaf);sha256=$(if($name-ceq'ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'){'e'*64}else{'a'*64})})}
 Open-B6ReadPairPublication;if($heldPaths.Count-ne29-or$heldPaths.Contains((Join-Path $core 'run-current-owner.ps1'))-or$b6.entryCapture.directEntries.Count-ne23-or$phases.Count-ne1){throw 'PREVIEW_HISTORIC_SCOPE_CHANGED'}
 $active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne1-or$active[0].path-cne(Join-Path $core 'run-current-owner.ps1')){throw 'PREVIEW_CURRENT_ENTRY_KIND_CHANGED'}
 $snapshot=$b6.entryCapture|ConvertTo-Json -Depth 20;foreach($case in @('owner','count','order','runtime','exclusive')){$heldPaths.Clear();$phases.Clear();$b6.entryCapture=$snapshot|ConvertFrom-Json;switch($case){owner{$b6.entryCapture.ownerCaptureSha256='62d3882ceef3caf71a263ad51e036453eee2d59dbe871b8ccd2a03f3ad9756f8'}count{$b6.entryCapture.directEntries=@($b6.entryCapture.directEntries|Select-Object -First 22)}order{$swap=$b6.entryCapture.directEntries[21];$b6.entryCapture.directEntries[21]=$b6.entryCapture.directEntries[22];$b6.entryCapture.directEntries[22]=$swap}runtime{$b6.entryCapture.runtimeValidationComplete=$true}exclusive{$b6.entryCapture.postExitExclusiveEntryCount=28}};$denied=$false;try{Open-B6ReadPairPublication}catch{$denied=$true};if(!$denied-or$heldPaths.Count-or$phases.Count){throw ('PREVIEW_CAPTURE_WIDENED_'+$case)}};'PASS'`),'PASS');
});
win('PreviewLinkInstall final boundary retains the actual controller factory admission Prepared while an independent owner factory reaches Activated or Restored',()=>{
 const helper=q(path.join(dir,'canonical-business-sale-maintenance.ps1'));
 const nativeSetup=String.raw`
$profilePath=Join-Path $PSScriptRoot ([IO.Path]::GetFileNameWithoutExtension($PSCommandPath)+'-profile.json');$script:afterReads=0
$descriptor=[pscustomobject]@{profileHash='offline-fixture';readerDefinitions=[pscustomobject]@{reader='same'}}
$profile=[pscustomobject]@{goal8SyntheticDaySeal=[pscustomobject]@{packageId='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'};businessSaleAdmission=$descriptor;businessSaleWritesEnabled=$true}
[IO.File]::WriteAllText($profilePath,($profile|ConvertTo-Json -Depth 20));$config=[pscustomobject]@{OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}
$owner=[pscustomobject]@{manifestSha256='fixed-owner';maintenancePurpose='PreviewLinkPackageRefresh';packagePair=[pscustomobject]@{current=[pscustomobject]@{api=[pscustomobject]@{configPath=$profilePath;packageId=$profile.goal8SyntheticDaySeal.packageId}}}}
function Test-ErpBusinessSalePackageRefreshGeneration{return $true};function Read-ErpStartupConfig{return $config};function Read-ErpBusinessSalePackageRefreshOwnerSource{return $owner};function Read-ErpBusinessSaleWriterOwnerSource{return $owner};function Assert-Test125ReadPairConfig{return $true}
function Get-ErpBusinessSaleNativeInputs{return [pscustomobject]@{artifactHash='35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe';descriptor=$descriptor}}
function Test-ErpBusinessSaleAfter{$script:afterReads++}
function Read-ErpBusinessSalePinnedFile($Path,$Hash){if($Path-ceq$profilePath){$b=[IO.File]::ReadAllBytes($Path);if((Get-ErpBusinessSaleHash $b)-cne$Hash){throw 'FIXTURE_PROFILE_CHANGED'};return ,$b};if($Hash-cnotin@('35b07bba29aca44efc8c4080d543dc5acb50234dd44925289e86ba7a8b94bdbe','050714b39bbf6aa2b02e12738ccbc52e33b9e8a31cf80bd6758c8ac4e6867024')){throw 'FOREIGN_NATIVE_READ'};return ,([byte[]](0))}
function Open-ErpBusinessSaleSqlConnection{throw 'REAL_SQL_FORBIDDEN'}
`;
 const child=`$ErrorActionPreference='Stop';. ${helper};`+nativeSetup+String.raw`
$cap=New-ErpBusinessSalePackageRefreshAdmission $config;$record=Get-ErpBusinessSaleNativeAdmissionContext $cap
$t=[pscustomobject]@{scope='TEST125-API-B6-WRITER-20261029';profileOnlyPurpose='PackageRefresh';apiProfileBeforeSha256=$record.profileBeforeHash;apiProfileCandidateSha256=(Get-ErpBusinessSaleHash $record.candidateBytes)}
$c=[pscustomobject]@{nativeProfileAdmission=$cap;apiPath=$profilePath}
function Assert-Test125ReadPairIssued($Transition){if(![object]::ReferenceEquals($Transition,$t)){throw 'NOT_ISSUED_TRANSITION'};return $c}
function Assert-Test125ReadPairWriterPostCasPause($Transition,$Mode){if(![object]::ReferenceEquals($Transition,$t)-or$Mode-cnotin@('Candidate','Rollback')){throw 'NOT_PAUSED_FIXTURE'};return $c}
Bind-ErpBusinessSaleWriterProfile $cap $t
Complete-ErpBusinessSaleWriterProfilePostCasState $cap Candidate;$candidate=$record.phase
Complete-ErpBusinessSaleWriterProfilePostCasState $cap Rollback
if($candidate-cne'WriterActivated'-or$record.phase-cne'WriterRestored'){throw 'OWNER_PHASE_NOT_ACTUAL'}
# Observation only: no token or registry leaves this independent test process.
[ordered]@{pid=$PID;candidate=$candidate;rollback=$record.phase;afterReads=$afterReads}|ConvertTo-Json -Compress
`;
 assert.equal(run(previewPublicationFixture+`. ${helper};`+nativeSetup+String.raw`
$script:b6NativeAdmission=New-ErpBusinessSalePackageRefreshAdmission $config;$controller=Get-ErpBusinessSaleNativeAdmissionContext $b6NativeAdmission
Initialize-B6PreviewLinkTaskPublication
$childPath=Join-Path $PSScriptRoot 'independent-owner.ps1';[IO.File]::WriteAllText($childPath,__CHILD__)
$observed=& (Join-Path $PSHOME 'powershell.exe') -NoProfile -NonInteractive -File $childPath
if($LASTEXITCODE-ne0){throw 'INDEPENDENT_OWNER_FIXTURE_FAILED'};$observed=$observed|ConvertFrom-Json
if($observed.pid-eq$PID-or$observed.candidate-cne'WriterActivated'-or$observed.rollback-cne'WriterRestored'-or$observed.afterReads-ne3-or$controller.phase-cne'WriterPrepared'-or$null-ne$controller.transition){throw 'CONTROLLER_AND_OWNER_ISSUERS_MIXED'}
function Get-ReadPairExpectedHashes{throw 'PREFLIGHT_PROJECTION_AT_FINAL_FORBIDDEN'}
foreach($mode in @('Candidate','Current')){$script:fixtureMode=$mode;$result.final.mode=if($mode-ceq'Candidate'){'Candidate'}else{'Rollback'};Assert-B6PreviewLinkFinalBoundary $mode}
foreach($phase in @('WriterActivated','WriterRestored')){$controller.phase=$phase;$denied=$false;try{Assert-B6PreviewLinkFinalBoundary Candidate}catch{if($_.Exception.Message-cne'B6_WRITER_ADMISSION_REJECTED'){throw};$denied=$true};if(!$denied){throw 'OWNER_POST_PHASE_ADOPTED'}};$controller.phase='WriterPrepared'
$controller.transition=[pscustomobject]@{notTransferred='owner'};$denied=$false;try{Assert-B6PreviewLinkFinalBoundary Candidate}catch{if($_.Exception.Message-cne'B6_PACKAGE_REFRESH_CONTROLLER_ADMISSION_REQUIRED'){throw};$denied=$true};if(!$denied){throw 'BOUND_OWNER_TOKEN_ADOPTED'};$controller.transition=$null
$copy=$b6NativeAdmission|ConvertTo-Json|ConvertFrom-Json;$denied=$false;try{Get-ErpBusinessSaleNativeAdmissionContext $copy|Out-Null}catch{if($_.Exception.Message-cne'B6_NATIVE_ADMISSION_NOT_ISSUED'){throw};$denied=$true};if(!$denied-or$registrations.Count-or$apiMutators-or$afterReads-ne1){throw 'SERIALIZED_ISSUER_OR_FINAL_EFFECT'};'PASS'
`.replace('__CHILD__',q(child))),'PASS');
});
const nativeContextCaseFixture=String.raw`
$script:PreviewLinkInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029'
$nativeRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030';$nativeRouter='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-ROUTER-20261030';$nativeSteady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030'
$script:fixedCase=[pscustomobject]@{id='NativeContext';root=$nativeRoot;routerRoot=$nativeRouter;steadyRoot=$nativeSteady;pairHash='9c35bf28823b280aa49ee1849b6af44f19a7739e98e84269ab32017a368f056c';captureHash='a77fce94f29a0f818ccad98d9ddd9f77d81327816cc67e82f8393280d3c90d7b';recordHash='31834b4d9fa6eb2b448c430b094851a82a06cd540699ac230e663ee78752adb8';ownerPid=7768;ownerBirth='134377907806868351';childPid=47996;childBirth='134377915674721676';predecessorKind='ReadPairRouter';runningRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030';runningPid=42864;futureRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030'}
$script:caseReads=0;function Get-ErpBusinessSalePackageRefreshFixedCase{if($args.Count){throw 'UNEXPECTED_CASE_ARGUMENTS'};$script:caseReads++;return $script:fixedCase}
$script:b6=[pscustomobject]@{fixedCaseId='NativeContext';coreRoot=$nativeRoot;routerRoot=$nativeRouter;steadyRoot=$nativeSteady;maintenancePurpose='PreviewLinkPackageRefresh';owner=[pscustomobject]@{predecessorEntryKind='ReadPairRouter';owner=[pscustomobject]@{pid=7768;birth='134377907806868351'};child=[pscustomobject]@{pid=47996;birth='134377915674721676'};recordBeforeSha256=$fixedCase.recordHash}}
`;
win('NativeContext corrective generation consumes only the parameterless fixed case and rejects stale case or capture data without effects',()=>{
 assert.equal(run(nativeContextCaseFixture+String.raw`
 Initialize-B6PreviewLinkFixedCase;if($caseReads-ne1-or!$b6.contextCase-or$b6.contextCase.id-cne'NativeContext'){throw 'NATIVE_CASE_NOT_BOUND'}
 $snapshot=$fixedCase|ConvertTo-Json -Depth 10;foreach($kind in @('id','root','pair','capture','owner','running','future','birth')){
  $script:fixedCase=$snapshot|ConvertFrom-Json;switch($kind){id{$fixedCase.id='PreviewLink'}root{$fixedCase.root+='-OTHER'}pair{$fixedCase.pairHash=('0'*64)}capture{$fixedCase.captureHash=('0'*64)}owner{$fixedCase.ownerPid=37032}running{$fixedCase.runningPid=13532}future{$fixedCase.futureRoot='C:\foreign'}birth{$b6.owner.child.birth='other'}}
  $denied=$false;try{Initialize-B6PreviewLinkFixedCase}catch{$denied=$true};if(!$denied){throw ('NATIVE_CASE_MIXED_'+$kind)};$b6.owner.child.birth='134377915674721676'
 };$b6.fixedCaseId='nativecontext';$denied=$false;try{Test-B6PreviewLinkNativeContextCase|Out-Null}catch{if($_.Exception.Message-cne'B6_PREVIEW_LINK_CASE_REJECTED'){throw};$denied=$true};if(!$denied){throw 'NATIVE_CASE_FELL_BACK_TO_LEGACY'};'PASS'`),'PASS');
});
win('NativeContext corrective task projection and final publisher preserve Candidate and Rollback paths without using the old LINK launcher',()=>{
 assert.equal(run(previewPublicationFixture+nativeContextCaseFixture+String.raw`
 $script:beforeXml=$beforeXml.Replace('ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029','ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030');$script:fixtureArgv=$fixtureArgv.Replace('ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030','ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030')
 Initialize-B6PreviewLinkFixedCase;$b6|Add-Member taskCapture ([pscustomobject]@{xmlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($beforeXml)));sddlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($script:taskSddl)))})
 foreach($mode in @('Candidate','Current')){
  Remove-Variable PreviewLinkTaskPublication -Scope Script -ErrorAction SilentlyContinue;$script:taskXml=$beforeXml;$script:fixtureMode=$mode;$script:scenario='success';$registrations.Clear();Initialize-B6PreviewLinkTaskPublication;$script:taskXml=$script:PreviewLinkTaskPublication.silentXml
  if(!$taskXml.Contains('ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030')){throw 'NATIVE_CONTEXT_SILENT_TASK_MISSING'}
  $result.final.mode=if($mode-ceq'Candidate'){'Candidate'}else{'Rollback'};Complete-B6PreviewLinkTaskPublication $(if($mode-ceq'Candidate'){'CandidateVerified'}else{'RollbackVerified'})
  $root=if($mode-ceq'Candidate'){$nativeSteady}else{$fixedCase.futureRoot};if(!$taskXml.Contains($root)-or($registrations-join',')-cne'52'-or$apiMutators){throw 'NATIVE_CONTEXT_FINAL_TASK_CHANGED'}
 };'PASS'`),'PASS');
});
win('NativeContext corrective active router argv retains Writer scope and the exact router plus current-core pair',()=>{
 assert.equal(run(nativeContextCaseFixture+String.raw`
 $current='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-ROUTER-20261030';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030'
 $b6.owner|Add-Member entry ([pscustomobject]@{root=$current;leaf='start-business-5244-readpair-router.ps1';manifestSha256=('a'*64);sha256=('b'*64)})
 $b6.owner|Add-Member router ([pscustomobject]@{root=$current;manifestSha256=('a'*64);entrySha256=('b'*64)})
 $b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('c'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('d'*64)})})
 $b6|Add-Member entryCapture ([pscustomobject]@{directEntries=@([pscustomobject]@{path=(Join-Path $current 'start-business-5244-readpair-router.ps1');sha256=('b'*64)},[pscustomobject]@{path=(Join-Path $core 'run-current-owner.ps1');sha256=('d'*64)})})
 $argv=Get-B6ReadPairOwnerArguments $current ('a'*64);if(!$argv.EndsWith(' -ScopeName TEST125-API-B6-WRITER-20261029')-or$argv.Contains('ca620bac')){throw 'NATIVE_CONTEXT_ROUTER_SCOPE_LOST'};$active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne2-or$active[0].path-cne(Join-Path $current 'start-business-5244-readpair-router.ps1')-or$active[1].path-cne(Join-Path $core 'run-current-owner.ps1')){throw 'NATIVE_CONTEXT_ACTIVE_PAIR_CHANGED'};'PASS'`),'PASS');
});
win('NativeContext corrective managed exit keeps both live router leaves and the same non-abandoned mutex through thirty-two exclusive gates',()=>{
 const fixture=managedFixture
  .replace('@(1..11|ForEach-Object','@(1..24|ForEach-Object')
  .replace("$entries=@(1..6", "$routerRoot=Join-Path $PSScriptRoot 'router';[void][IO.Directory]::CreateDirectory($routerRoot);$routerActive=Join-Path $routerRoot 'start-business-5244-readpair-router.ps1';[IO.File]::WriteAllText($routerActive,'inert-router-entry');$routerEntryHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($routerActive));$coreManifest=$oldHash;$script:oldRoot=$routerRoot;$script:oldHash=('b'*64)\n$entries=@(1..6")
  .replace("foreach($row in @($entries)+@($direct|Where-Object{$_.path-cne$active})){Hold-B6ReadPairEntry $row.path $hash}",String.raw`$direct+=,[pscustomobject]@{path=$routerActive;sha256=$routerEntryHash};$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.core.manifestSha256=$coreManifest;$b6.owner.core|Add-Member files @([pscustomobject]@{path='run-current-owner.ps1';sha256=$hash});$b6.owner|Add-Member router ([pscustomobject]@{root=$routerRoot;manifestSha256=$oldHash;entrySha256=$routerEntryHash});$b6.owner.entry=[pscustomobject]@{root=$routerRoot;leaf='start-business-5244-readpair-router.ps1';sha256=$routerEntryHash;manifestSha256=$oldHash};$b6.entryCapture.directEntries=$direct
foreach($row in @($entries)+@($direct|Where-Object{$_.path-cnotin@($active,$routerActive)})){Hold-B6ReadPairEntry $row.path $hash}`)
  .replace('param($Name,$Entry,$Mutex);','param($Name,$Entry,$Mutex,$Router);')
  .replace('$owned=$false;$f=$null;', '$owned=$false;$routerHold=$null;$f=$null;')
  .replace("$f=[IO.File]::Open($Entry", "$routerHold=[IO.File]::Open($Router,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$f=[IO.File]::Open($Entry")
  .replace('if($f){$f.Dispose()};if($owned)', 'if($f){$f.Dispose()};if($routerHold){$routerHold.Dispose()};if($owned)')
  .replace('$si.UseShellExecute=$false;', '$si.Arguments+=\' "\'+$routerActive+\'"\';$si.UseShellExecute=$false;');
 const answer=activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;if($h.items.Count-ne2-or$h.items[0].path-cne$routerActive-or$h.items[1].path-cne$active){throw 'NATIVE_ROUTER_LIVE_PAIR_CHANGED'}
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_NATIVE_CONTEXT_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;Complete-B6ReadPairActiveEntryHandoff
 if(!$control.CompletedStop-or!$server.HasExited-or$h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$held.Count-ne32-or@($held|Where-Object{$_.holdMode-cne'Exclusive'}).Count-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1){throw 'NATIVE_CONTEXT_MANAGED_EXIT_BROKEN'}
 `,String.raw`$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:RehearsalOnly=$false;$script:PreviewLinkInstall=$true;$b6.rehearsalOnly=$false;$b6|Add-Member fixedCaseId 'NativeContext';$b6|Add-Member maintenancePurpose 'PreviewLinkPackageRefresh'`,fixture);
 assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('NativeContext corrective publication preserves the exact twenty-six captured direct entries and rejects stale order count or runtime claims before holds',()=>{
 const fixture=writerPublicationFixture.replace('$script:WriterInstall=$true;',"$script:WriterInstall=$false;$script:PreviewLinkInstall=$true;")
  .replace('50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65','a77fce94f29a0f818ccad98d9ddd9f77d81327816cc67e82f8393280d3c90d7b')
  .replace('postExitExclusiveEntryCount=24','postExitExclusiveEntryCount=32');
 assert.equal(run(fixture+String.raw`
 $b6|Add-Member fixedCaseId 'NativeContext';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-ROUTER-20261030'
 $b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.entry=[pscustomobject]@{root=$router;leaf='start-business-5244-readpair-router.ps1';manifestSha256=('b'*64);sha256=('c'*64);postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false};$b6.owner|Add-Member router ([pscustomobject]@{root=$router;manifestSha256=('b'*64);entrySha256=('c'*64)});$b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('d'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('e'*64)})})
 foreach($name in @(
 'ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029'
 'ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-PREVIEW-LINK-ROUTER-20261030'
 'ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030'
 'ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030'
 )){$leaf=if($name.Contains('ROUTER')){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'};$path='C:\Sirket\ERP\releases\'+$name+'\'+$leaf;$hash=if($path-ceq(Join-Path $router 'start-business-5244-readpair-router.ps1')){'c'*64}elseif($path-ceq(Join-Path $core 'run-current-owner.ps1')){'e'*64}else{'a'*64};$b6.entryCapture.directEntries+=@([pscustomobject]@{path=$path;sha256=$hash})}
 Open-B6ReadPairPublication;if($heldPaths.Count-ne31-or$b6.entryCapture.directEntries.Count-ne26-or$phases.Count-ne1-or$heldPaths.Contains((Join-Path $core 'run-current-owner.ps1'))-or$heldPaths.Contains((Join-Path $router 'start-business-5244-readpair-router.ps1'))){throw 'NATIVE_CAPTURE_SCOPE_CHANGED'}
 $active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne2-or$active[0].path-cne(Join-Path $router 'start-business-5244-readpair-router.ps1')-or$active[1].path-cne(Join-Path $core 'run-current-owner.ps1')){throw 'NATIVE_CAPTURE_ACTIVE_PAIR_CHANGED'}
 $snapshot=$b6.entryCapture|ConvertTo-Json -Depth 20;foreach($kind in @('owner','count','order','runtime','exclusive')){
  $heldPaths.Clear();$phases.Clear();$b6.entryCapture=$snapshot|ConvertFrom-Json;switch($kind){owner{$b6.entryCapture.ownerCaptureSha256='124e207b8ab0f8f6a5b3b8227c7183c17b69f2f2725b2837b2dc1bc81410c74b'}count{$b6.entryCapture.directEntries=@($b6.entryCapture.directEntries|Select-Object -First 25)}order{$swap=$b6.entryCapture.directEntries[23];$b6.entryCapture.directEntries[23]=$b6.entryCapture.directEntries[24];$b6.entryCapture.directEntries[24]=$swap}runtime{$b6.entryCapture.runtimeValidationComplete=$true}exclusive{$b6.entryCapture.postExitExclusiveEntryCount=29}}
  $denied=$false;try{Open-B6ReadPairPublication}catch{$denied=$true};if(!$denied-or$heldPaths.Count-or$phases.Count){throw ('NATIVE_CAPTURE_FALSE_ADMISSION_'+$kind)}
 };'PASS'`),'PASS');
});

const previewReadCaseFixture=String.raw`
$script:PreviewLinkInstall=$true;$script:ScopeName='TEST125-API-B6-WRITER-20261029'
$nativeRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-OWNER-20261030';$nativeRouter='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-ROUTER-20261030';$nativeSteady='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-READ-STEADY-OWNER-20261030'
$script:fixedCase=[pscustomobject]@{id='PreviewRead';root=$nativeRoot;routerRoot=$nativeRouter;steadyRoot=$nativeSteady;pairHash='30cec0ba88d32b9de61606ded7dc01ffe0932993dd7132a8583c8f07723b0fb6';captureHash='5dfdcd97f2db79304ef9d2ecb0941a9c218652ebd1ed51129b27346f02dedd13';recordHash='62cbcf16f66e1092d5dc3a5c680a68c73f326b6cc99f26148163c55ca8d19928';ownerPid=25428;ownerBirth='134377968521534410';childPid=7916;childBirth='134377976553184634';predecessorKind='ReadPairRouter';runningRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030';runningPid=48088;futureRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030'}
$script:fixedCase|Add-Member overlaySource 'ed706d37c8a78ad41f314f76029b24dd0e38bc80'
$script:caseReads=0;function Get-ErpBusinessSalePackageRefreshFixedCase{if($args.Count){throw 'UNEXPECTED_CASE_ARGUMENTS'};$script:caseReads++;return $script:fixedCase}
$script:b6=[pscustomobject]@{fixedCaseId='PreviewRead';coreRoot=$nativeRoot;routerRoot=$nativeRouter;steadyRoot=$nativeSteady;maintenancePurpose='PreviewLinkPackageRefresh';owner=[pscustomobject]@{predecessorEntryKind='ReadPairRouter';owner=[pscustomobject]@{pid=25428;birth='134377968521534410'};child=[pscustomobject]@{pid=7916;birth='134377976553184634'};recordBeforeSha256=$fixedCase.recordHash}}
`;
win('PreviewRead corrective generation consumes only the parameterless fixed case and rejects stale case or capture data without effects',()=>{
 assert.equal(run(previewReadCaseFixture+String.raw`
 Initialize-B6PreviewLinkFixedCase;if($caseReads-ne1-or!$b6.contextCase-or$b6.contextCase.id-cne'PreviewRead'){throw 'NATIVE_CASE_NOT_BOUND'}
 $snapshot=$fixedCase|ConvertTo-Json -Depth 10;foreach($kind in @('id','root','pair','capture','owner','running','future','birth')){
  $script:fixedCase=$snapshot|ConvertFrom-Json;switch($kind){id{$fixedCase.id='PreviewLink'}root{$fixedCase.root+='-OTHER'}pair{$fixedCase.pairHash=('0'*64)}capture{$fixedCase.captureHash=('0'*64)}owner{$fixedCase.ownerPid=37032}running{$fixedCase.runningPid=13532}future{$fixedCase.futureRoot='C:\foreign'}birth{$b6.owner.child.birth='other'}}
  $denied=$false;try{Initialize-B6PreviewLinkFixedCase}catch{$denied=$true};if(!$denied){throw ('NATIVE_CASE_MIXED_'+$kind)};$b6.owner.child.birth='134377976553184634'
 };$b6.fixedCaseId='nativecontext';$denied=$false;try{Test-B6PreviewLinkNativeContextCase|Out-Null}catch{if($_.Exception.Message-cne'B6_PREVIEW_LINK_CASE_REJECTED'){throw};$denied=$true};if(!$denied){throw 'NATIVE_CASE_FELL_BACK_TO_LEGACY'};'PASS'`),'PASS');
});
win('PreviewRead corrective task projection and final publisher preserve Candidate and Rollback paths without using the old LINK launcher',()=>{
 assert.equal(run(previewPublicationFixture+previewReadCaseFixture+String.raw`
 $script:beforeXml=$beforeXml.Replace('ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029','ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030');$script:fixtureArgv=$fixtureArgv.Replace('ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030','ERP-BUSINESS-5244-B6-PREVIEW-READ-OWNER-20261030')
 Initialize-B6PreviewLinkFixedCase;$b6|Add-Member taskCapture ([pscustomobject]@{xmlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($beforeXml)));sddlSha256=(Get-ReadPairControllerHash ([Text.Encoding]::UTF8.GetBytes($script:taskSddl)))})
 foreach($mode in @('Candidate','Current')){
  Remove-Variable PreviewLinkTaskPublication -Scope Script -ErrorAction SilentlyContinue;$script:taskXml=$beforeXml;$script:fixtureMode=$mode;$script:scenario='success';$registrations.Clear();Initialize-B6PreviewLinkTaskPublication;$script:taskXml=$script:PreviewLinkTaskPublication.silentXml
  if(!$taskXml.Contains('ERP-BUSINESS-5244-B6-PREVIEW-READ-OWNER-20261030')){throw 'NATIVE_CONTEXT_SILENT_TASK_MISSING'}
  $result.final.mode=if($mode-ceq'Candidate'){'Candidate'}else{'Rollback'};Complete-B6PreviewLinkTaskPublication $(if($mode-ceq'Candidate'){'CandidateVerified'}else{'RollbackVerified'})
  $root=if($mode-ceq'Candidate'){$nativeSteady}else{$fixedCase.futureRoot};if(!$taskXml.Contains($root)-or($registrations-join',')-cne'52'-or$apiMutators){throw 'NATIVE_CONTEXT_FINAL_TASK_CHANGED'}
 };'PASS'`),'PASS');
});
win('PreviewRead corrective active router argv retains Writer scope and the exact router plus current-core pair',()=>{
 assert.equal(run(previewReadCaseFixture+String.raw`
 $current='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-ROUTER-20261030';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030'
 $b6.owner|Add-Member entry ([pscustomobject]@{root=$current;leaf='start-business-5244-readpair-router.ps1';manifestSha256=('a'*64);sha256=('b'*64)})
 $b6.owner|Add-Member router ([pscustomobject]@{root=$current;manifestSha256=('a'*64);entrySha256=('b'*64)})
 $b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('c'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('d'*64)})})
 $b6|Add-Member entryCapture ([pscustomobject]@{directEntries=@([pscustomobject]@{path=(Join-Path $current 'start-business-5244-readpair-router.ps1');sha256=('b'*64)},[pscustomobject]@{path=(Join-Path $core 'run-current-owner.ps1');sha256=('d'*64)})})
 $argv=Get-B6ReadPairOwnerArguments $current ('a'*64);if(!$argv.EndsWith(' -ScopeName TEST125-API-B6-WRITER-20261029')-or$argv.Contains('ca620bac')){throw 'NATIVE_CONTEXT_ROUTER_SCOPE_LOST'};$active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne2-or$active[0].path-cne(Join-Path $current 'start-business-5244-readpair-router.ps1')-or$active[1].path-cne(Join-Path $core 'run-current-owner.ps1')){throw 'NATIVE_CONTEXT_ACTIVE_PAIR_CHANGED'};'PASS'`),'PASS');
});
win('PreviewRead corrective managed exit keeps both live router leaves and the same non-abandoned mutex through thirty-five exclusive gates',()=>{
 const fixture=managedFixture
  .replace('@(1..11|ForEach-Object','@(1..27|ForEach-Object')
  .replace("$entries=@(1..6", "$routerRoot=Join-Path $PSScriptRoot 'router';[void][IO.Directory]::CreateDirectory($routerRoot);$routerActive=Join-Path $routerRoot 'start-business-5244-readpair-router.ps1';[IO.File]::WriteAllText($routerActive,'inert-router-entry');$routerEntryHash=Get-Business5244StartupHash ([IO.File]::ReadAllBytes($routerActive));$coreManifest=$oldHash;$script:oldRoot=$routerRoot;$script:oldHash=('b'*64)\n$entries=@(1..6")
  .replace("foreach($row in @($entries)+@($direct|Where-Object{$_.path-cne$active})){Hold-B6ReadPairEntry $row.path $hash}",String.raw`$direct+=,[pscustomobject]@{path=$routerActive;sha256=$routerEntryHash};$b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.core.manifestSha256=$coreManifest;$b6.owner.core|Add-Member files @([pscustomobject]@{path='run-current-owner.ps1';sha256=$hash});$b6.owner|Add-Member router ([pscustomobject]@{root=$routerRoot;manifestSha256=$oldHash;entrySha256=$routerEntryHash});$b6.owner.entry=[pscustomobject]@{root=$routerRoot;leaf='start-business-5244-readpair-router.ps1';sha256=$routerEntryHash;manifestSha256=$oldHash};$b6.entryCapture.directEntries=$direct
foreach($row in @($entries)+@($direct|Where-Object{$_.path-cnotin@($active,$routerActive)})){Hold-B6ReadPairEntry $row.path $hash}`)
  .replace('param($Name,$Entry,$Mutex);','param($Name,$Entry,$Mutex,$Router);')
  .replace('$owned=$false;$f=$null;', '$owned=$false;$routerHold=$null;$f=$null;')
  .replace("$f=[IO.File]::Open($Entry", "$routerHold=[IO.File]::Open($Router,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$f=[IO.File]::Open($Entry")
  .replace('if($f){$f.Dispose()};if($owned)', 'if($f){$f.Dispose()};if($routerHold){$routerHold.Dispose()};if($owned)')
  .replace('$si.UseShellExecute=$false;', '$si.Arguments+=\' "\'+$routerActive+\'"\';$si.UseShellExecute=$false;');
 const answer=activeRun(String.raw`
 $h=Get-B6ReadPairActiveHandoff;if($h.items.Count-ne2-or$h.items[0].path-cne$routerActive-or$h.items[1].path-cne$active){throw 'NATIVE_ROUTER_LIVE_PAIR_CHANGED'}
 function Read-B6ReadPairManagedExitSignal{$server.StandardInput.Close();if(!$server.WaitForExit(5000)-or$server.ExitCode-ne0){throw 'ISOLATED_NATIVE_CONTEXT_EXIT_FAILED'};return 'MANAGED_EXIT_OBSERVED'}
 Invoke-B6ReadPairManagedOwnerExit;Complete-B6ReadPairActiveEntryHandoff
 if(!$control.CompletedStop-or!$server.HasExited-or$h.phase-cne'ExclusiveVerified'-or!$h.marker.Deleted-or$held.Count-ne35-or@($held|Where-Object{$_.holdMode-cne'Exclusive'}).Count-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1){throw 'NATIVE_CONTEXT_MANAGED_EXIT_BROKEN'}
 `,String.raw`$script:ScopeName='TEST125-API-B6-WRITER-20261029';$script:RehearsalOnly=$false;$script:PreviewLinkInstall=$true;$b6.rehearsalOnly=$false;$b6|Add-Member fixedCaseId 'PreviewRead';$b6|Add-Member maintenancePurpose 'PreviewLinkPackageRefresh'`,fixture);
 assert.match(answer,/"phase":"B6_MANAGED_EXIT_READY"/);assert.match(answer,/PASS$/);
});
win('PreviewRead corrective publication preserves the exact twenty-nine captured direct entries and rejects stale order count or runtime claims before holds',()=>{
 const fixture=writerPublicationFixture.replace('$script:WriterInstall=$true;',"$script:WriterInstall=$false;$script:PreviewLinkInstall=$true;")
  .replace('50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65','5dfdcd97f2db79304ef9d2ecb0941a9c218652ebd1ed51129b27346f02dedd13')
  .replace('postExitExclusiveEntryCount=24','postExitExclusiveEntryCount=35');
 assert.equal(run(fixture+String.raw`
 $b6|Add-Member fixedCaseId 'PreviewRead';$core='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030';$router='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-ROUTER-20261030'
 $b6.owner.predecessorEntryKind='ReadPairRouter';$b6.owner.entry=[pscustomobject]@{root=$router;leaf='start-business-5244-readpair-router.ps1';manifestSha256=('b'*64);sha256=('c'*64);postExitExclusiveBytesRequired=$true;runtimeEntryBytesVerified=$false};$b6.owner|Add-Member router ([pscustomobject]@{root=$router;manifestSha256=('b'*64);entrySha256=('c'*64)});$b6.owner|Add-Member core ([pscustomobject]@{root=$core;manifestSha256=('d'*64);files=@([pscustomobject]@{path='run-current-owner.ps1';sha256=('e'*64)})})
 foreach($name in @(
 'ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3'
 'ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029'
 'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2'
 'ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029'
 'ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029'
 'ERP-BUSINESS-5244-B6-PREVIEW-LINK-ROUTER-20261030'
 'ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030'
 'ERP-BUSINESS-5244-B6-PREVIEW-STEADY-OWNER-20261030'

 'ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-ROUTER-20261030'
 'ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030'
 'ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-STEADY-OWNER-20261030'
 )){$leaf=if($name.Contains('ROUTER')){'start-business-5244-readpair-router.ps1'}else{'run-current-owner.ps1'};$path='C:\Sirket\ERP\releases\'+$name+'\'+$leaf;$hash=if($path-ceq(Join-Path $router 'start-business-5244-readpair-router.ps1')){'c'*64}elseif($path-ceq(Join-Path $core 'run-current-owner.ps1')){'e'*64}else{'a'*64};$b6.entryCapture.directEntries+=@([pscustomobject]@{path=$path;sha256=$hash})}
 Open-B6ReadPairPublication;if($heldPaths.Count-ne34-or$b6.entryCapture.directEntries.Count-ne29-or$phases.Count-ne1-or$heldPaths.Contains((Join-Path $core 'run-current-owner.ps1'))-or$heldPaths.Contains((Join-Path $router 'start-business-5244-readpair-router.ps1'))){throw 'NATIVE_CAPTURE_SCOPE_CHANGED'}
 $active=@(Get-B6ReadPairActiveEntry);if($active.Count-ne2-or$active[0].path-cne(Join-Path $router 'start-business-5244-readpair-router.ps1')-or$active[1].path-cne(Join-Path $core 'run-current-owner.ps1')){throw 'NATIVE_CAPTURE_ACTIVE_PAIR_CHANGED'}
 $snapshot=$b6.entryCapture|ConvertTo-Json -Depth 20;foreach($kind in @('owner','count','order','runtime','exclusive')){
  $heldPaths.Clear();$phases.Clear();$b6.entryCapture=$snapshot|ConvertFrom-Json;switch($kind){owner{$b6.entryCapture.ownerCaptureSha256='124e207b8ab0f8f6a5b3b8227c7183c17b69f2f2725b2837b2dc1bc81410c74b'}count{$b6.entryCapture.directEntries=@($b6.entryCapture.directEntries|Select-Object -First 28)}order{$swap=$b6.entryCapture.directEntries[26];$b6.entryCapture.directEntries[26]=$b6.entryCapture.directEntries[27];$b6.entryCapture.directEntries[27]=$swap}runtime{$b6.entryCapture.runtimeValidationComplete=$true}exclusive{$b6.entryCapture.postExitExclusiveEntryCount=29}}
  $denied=$false;try{Open-B6ReadPairPublication}catch{$denied=$true};if(!$denied-or$heldPaths.Count-or$phases.Count){throw ('NATIVE_CAPTURE_FALSE_ADMISSION_'+$kind)}
 };'PASS'`),'PASS');
});
