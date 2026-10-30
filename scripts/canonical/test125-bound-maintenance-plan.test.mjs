import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,realpathSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const file=path.join(import.meta.dirname,'test125-bound-maintenance-plan.ps1');
const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const run=body=>execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`. '${file.replaceAll("'","''")}' -Library; ${body}`],{encoding:'utf8'}).trim();
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
const refreshRunningFixture=String.raw`
 foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','ScheduledTasks')){Microsoft.PowerShell.Core\Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$module,($module+'.psd1'))) -Scope Local}
 $temp=__TEMP__;$scope='TEST125-API-B6-WRITER-20261029';$source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$startup='C:\Sirket\ERP\runtime\canonical-test\startup-config.json';$ownedPath=Join-Path $temp 'owned-processes.json'
 $current=[pscustomobject]@{ReleaseRoot='C:\fixture\current-api';SourceCommit=$source;ManifestSha256=('a'*64);ConfigPath='C:\fixture\private.json'};$candidate=$current.PSObject.Copy();$candidate.ReleaseRoot='C:\fixture\next-api';$candidate.ManifestSha256='b'*64
 $config=[pscustomobject]@{SourceCommit=$source;ExpectedDatabase='MELISA_ERP_SIRKET_TEST_20260929_01';RepoRoot='C:\Sirket\ERP\melisa-erp-v2';TaskName='Melisa-ERP-TEST-Canonical';OwnerSid=$sid;RuntimeDir=$temp;ManifestSha256=('c'*64);ApiComponent=$current}
 $exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe';$oldPath=Join-Path $temp 'running.ps1';$futurePath=Join-Path $temp 'future.ps1';$maintenancePath=Join-Path $temp 'maintenance.ps1';$created=[datetime]'2026-10-29T10:00:00Z';$currentPid=13532
 function Hash-Temp($p){$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash([IO.File]::ReadAllBytes($p))).Replace('-','')}finally{$h.Dispose()}}
 $running=[pscustomobject]@{pid=13532;birth=([long]$created.ToFileTimeUtc()+8).ToString();cimBirth=$created.ToFileTimeUtc().ToString();launcher=[pscustomobject]@{path=$oldPath};ownedRecordPath=$ownedPath;ownedRecordSha256='';ownedRecordSourceCommit=$source;ownedRecordStartedAt='2026-10-29T10:00:01Z';argv=('"'+$exe+'" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$oldPath+'" -StartupConfigPath "'+$startup+'"')}
 function Get-ErpBusinessSalePackageRefreshFixedCase{return @{root='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030'}}
 $proof=[pscustomobject]@{opaque='local-fixture'};$seal=[pscustomobject]@{};$seal|Add-Member ScriptMethod Validate {}; $proofContext=[pscustomobject]@{seal=$seal;packageRefreshTaskSource=[pscustomobject]@{runningSupervisor=$running};packageRefreshTaskState=[pscustomobject]@{maintenanceInstalled=$false}}
 $owned=[pscustomobject]@{sourceCommit=$source;supervisor=13532;startedAt=$running.ownedRecordStartedAt;children=[pscustomobject]@{api=[pscustomobject]@{pid=101;createdAt='2026-10-29T10:00:02Z'};native=[pscustomobject]@{pid=102;createdAt='2026-10-29T10:00:02Z'};web=[pscustomobject]@{pid=103;createdAt='2026-10-29T10:00:02Z'}}};[IO.File]::WriteAllText($ownedPath,($owned|ConvertTo-Json -Depth 12));$running.ownedRecordSha256=(Hash-Temp $ownedPath).ToLowerInvariant()
 function Test-ErpBusinessSalePackageRefreshGeneration{return $true};function Get-ErpReadPairReleaseProofContext($p){if(![object]::ReferenceEquals($p,$proof)){throw 'UNISSUED_PROOF'};return $proofContext};function Read-ErpStartupConfig{return $config};function Get-Test125ReadPairScope{return [pscustomobject]@{source=$source;database=$config.ExpectedDatabase;name=$scope;current=$current;candidate=$candidate}}
 function Get-ErpBusinessSaleWriterTaskLauncherPins($p,$Mode){[void](Get-ErpReadPairReleaseProofContext $p);$p=if($Mode-ceq'Candidate'-or$proofContext.packageRefreshTaskState.maintenanceInstalled){$maintenancePath}else{$futurePath};return @{path=$p;sha256=(Hash-Temp $p)}}
 function Get-ScheduledTask{return $task};function Get-Content($LiteralPath,[switch]$Raw){if($LiteralPath-ne$ownedPath){throw 'UNEXPECTED_FILE_READ'};return [IO.File]::ReadAllText($ownedPath)}
 function Get-FileHash($LiteralPath,$Algorithm){$p=if($LiteralPath-ceq$startup){Join-Path $temp 'startup.json'}else{$LiteralPath};if(![IO.Path]::GetFullPath($p).StartsWith($temp+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'HASH_OUTSIDE_FIXTURE'};return @{Hash=(Hash-Temp $p)}}
 function Get-ErpProcess($n){if($n-ne$currentPid){throw 'UNEXPECTED_PROCESS'};return $supervisor};function Invoke-CimMethod{return @{ReturnValue=0;Sid=$sid}}
 function Get-ErpServiceDefinitions{return @(@{Name='api';Port=4144},@{Name='native';Port=4146},@{Name='web';Port=5194})};function Assert-ErpOwnedProcess($n){return [pscustomobject]@{ProcessId=$n;CreationDate=$created.AddSeconds(2)}};function Get-ErpServiceListeners($d){return @([pscustomobject]@{OwningProcess=$owned.children.($d.Name).pid})};function Assert-ErpHealth{return @{ok=$true;sqlReadOnly=$true;sysadmin=0}}
 $instances=[pscustomobject]@{Count=1};$instances|Add-Member ScriptMethod Item {param($n);return [pscustomobject]@{EnginePID=$currentPid;InstanceGuid='fixed-instance'}};$registered=[pscustomobject]@{Xml='fixed-future-xml'};$registered|Add-Member ScriptMethod GetInstances {param($n);return $instances}
 $folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($n);return $registered};$scheduler=[pscustomobject]@{};$scheduler|Add-Member ScriptMethod Connect {};$scheduler|Add-Member ScriptMethod GetFolder {param($n);return $folder}
 function New-Object($ComObject){if($ComObject-cne'Schedule.Service'){throw 'UNEXPECTED_COM'};return $scheduler}
 $task=[pscustomobject]@{TaskName=$config.TaskName;TaskPath='\';State='Running';Settings=[pscustomobject]@{Enabled=$true;AllowHardTerminate=$true;MultipleInstances='IgnoreNew'};Principal=[pscustomobject]@{UserId=$sid;LogonType='Interactive';RunLevel='Limited'};Actions=@([pscustomobject]@{Execute=$exe;Arguments=('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$futurePath+'" -StartupConfigPath "'+$startup+'"');WorkingDirectory=$config.RepoRoot})}
 $supervisor=[pscustomobject]@{ProcessId=$currentPid;ExecutablePath=$exe;CommandLine=$running.argv;CreationDate=$created}
`;
function runRefreshPlan(body,prefix='',variant='PreviewLink'){
 const temp=realpathSync.native(mkdtempSync(path.join(realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),'b6-refresh-running-'))),q=s=>"'"+s.replaceAll("'","''")+"'";
 try{for(const name of ['owned.json','startup.json','running.ps1','future.ps1','maintenance.ps1'])writeFileSync(path.join(temp,name),name);let script=(prefix+refreshRunningFixture+body).replace('__TEMP__',q(temp));if(variant==='NativeContext')script=script.replaceAll('13532','42864').replaceAll('ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030','ERP-BUSINESS-5244-B6-PREVIEW-CONTEXT-OWNER-20261030');return run(script);}finally{rmSync(temp,{recursive:true,force:true});}
}
for(const variant of ['PreviewLink','NativeContext'])win(variant+' PackageRefresh post-transition observation uses its separate Prepared controller proof for both API modes and only the fresh silent maintenance engine',()=>{
 const quiescence=path.join(import.meta.dirname,'test125-bound-api-quiescence.ps1').replaceAll("'","''");
 assert.equal(runRefreshPlan(String.raw`
 $fixtureChildren=[Collections.Generic.List[object]]::new();$node=(Get-Command node.exe).Source
 try{
  for($i=0;$i-lt4;$i++){$p=Microsoft.PowerShell.Management\Start-Process -FilePath $node -ArgumentList @('-e','"setInterval(()=>{},1000)"') -WindowStyle Hidden -PassThru;$fixtureChildren.Add($p)}
  $currentPid=$fixtureChildren[0].Id;$created=$fixtureChildren[0].StartTime.ToUniversalTime();$owned.supervisor=$currentPid;$owned.startedAt=$created.AddSeconds(1).ToString('o')
  $actual=@{};for($i=0;$i-lt3;$i++){$name=@('api','native','web')[$i];$p=$fixtureChildren[$i+1];$owned.children.$name.pid=$p.Id;$owned.children.$name.createdAt=$p.StartTime.ToUniversalTime().ToString('o');$actual[$p.Id]=[pscustomobject]@{ProcessId=$p.Id;CreationDate=$p.StartTime.ToUniversalTime()}}
  [IO.File]::WriteAllText($ownedPath,($owned|ConvertTo-Json -Depth 12))
  $supervisor.ProcessId=$currentPid;$supervisor.CreationDate=$created;$task.Actions[0].Arguments=$task.Actions[0].Arguments.Replace($futurePath,$maintenancePath);$supervisor.CommandLine='"'+$exe+'" '+$task.Actions[0].Arguments
  function Get-ErpProcess($n){if($n-eq$currentPid){return $supervisor};if($n-eq13532){if($script:oldStillPresent){return [pscustomobject]@{ProcessId=13532}};return $null};throw 'UNEXPECTED_PROCESS'}
  function Assert-ErpOwnedProcess($n){return $actual[[int]$n]}
  $script:oldStillPresent=$false;$profile=Join-Path $temp 'profile.json';[IO.File]::WriteAllText($profile,'unchanged-enabled-profile')
  $nativeCap=[pscustomobject]@{id='controller-native'};$nativeContext=[pscustomobject]@{mode='PackageRefresh';phase='WriterPrepared';transition=$null;ownerInputs=[pscustomobject]@{maintenancePurpose='PreviewLinkPackageRefresh'};profilePath=$profile;profileBeforeHash=(Hash-Temp $profile)}
  $ownerCap=[pscustomobject]@{id='owner-native'};$ownerNative=[pscustomobject]@{mode='PackageRefresh';phase='WriterActivated';transition=[pscustomobject]@{id='owner-issued-transition'}}
  $ownerProof=[pscustomobject]@{opaque='independent-owner-proof'};$ownerContext=[pscustomobject]@{seal=$seal;packageRefreshAdmission=$ownerCap;packageRefreshTaskState=[pscustomobject]@{maintenanceInstalled=$true}}
  $proofContext.PSObject.Properties.Remove('packageRefreshTaskState');$proofContext|Add-Member NoteProperty packageRefreshAdmission $nativeCap
  $proofContext|Add-Member NoteProperty businessSaleOwnerPins ([pscustomobject]@{path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-PREVIEW-LINK-OWNER-20261030\start-owned-test.ps1'})
  $proofContext.packageRefreshTaskSource|Add-Member NoteProperty path $futurePath
  $script:controllerProof=$proof;$script:controllerContext=$proofContext;$script:separateOwnerProof=$ownerProof;$script:separateOwnerContext=$ownerContext
  function Get-ErpReadPairReleaseProofContext($p){if([object]::ReferenceEquals($p,$script:controllerProof)){return $script:controllerContext};if([object]::ReferenceEquals($p,$script:separateOwnerProof)){return $script:separateOwnerContext};throw 'UNISSUED_PROOF'}
  function Assert-ErpBusinessSaleWriterProfileAdmission($p,$Phase){$c=Get-ErpBusinessSaleNativeAdmissionContext $p;if($c.phase-cne$Phase){throw 'NATIVE_PHASE_REJECTED'};return $true}
  function Get-ErpBusinessSaleNativeAdmissionContext($p){if([object]::ReferenceEquals($p,$nativeCap)){return $nativeContext};if([object]::ReferenceEquals($p,$ownerCap)){return $ownerNative};throw 'UNISSUED_NATIVE'}
  function Get-ErpBusinessSaleWriterTaskLauncherPins($p,$Mode){[void](Get-ErpReadPairReleaseProofContext $p);$selected=if($Mode-ceq'Candidate'){$maintenancePath}else{$futurePath};return @{path=$selected;sha256=(Hash-Temp $selected)}}
  $oldArguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$futurePath+'" -StartupConfigPath "'+$startup+'"'
  $beforeXml='<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Actions><Exec><Command>'+[Security.SecurityElement]::Escape($exe)+'</Command><Arguments>'+[Security.SecurityElement]::Escape($oldArguments)+'</Arguments><WorkingDirectory>'+[Security.SecurityElement]::Escape($config.RepoRoot)+'</WorkingDirectory></Exec></Actions></Task>'
  $doc=[xml]$beforeXml;$doc.Task.Actions.Exec.Arguments=$oldArguments.Replace($futurePath,$proofContext.businessSaleOwnerPins.path);$registered.Xml=$doc.OuterXml;$registered|Add-Member ScriptMethod GetSecurityDescriptor {param($flags);return 'D:fixture-only'}
  $manifestPath=Join-Path $temp 'owner-manifest.json';$xmlPath=Join-Path $temp 'current-task.before.xml';$sddlPath=Join-Path $temp 'current-task.before.sddl'
  [IO.File]::WriteAllText($xmlPath,$beforeXml);[IO.File]::WriteAllText($sddlPath,'D:fixture-only');$manifest=[pscustomobject]@{beforeImages=@(@{path='current-task.before.xml';sha256=(Hash-Temp $xmlPath)},@{path='current-task.before.sddl';sha256=(Hash-Temp $sddlPath)})};[IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 8))
  function Read-ErpBusinessSalePackageRefreshOwnerSource{return @{root=$temp;manifestPath=$manifestPath;manifestSha256=(Hash-Temp $manifestPath)}}
  function Read-ErpBusinessSalePinnedFile($p,$h){if((Hash-Temp $p)-ine$h){throw 'PIN_CHANGED'};return ,[IO.File]::ReadAllBytes($p)}
  function Get-ErpBusinessSaleNativeInputs{return @{fixtureOnly=$true}};function Test-ErpBusinessSaleAfter{$script:afterReads++;return $true};$script:afterReads=0
  # The production task check uses the sealed fixed LINK path. Map only that
  # fixed source path to this fixture's inert file, never a runtime path.
  $logical=$proofContext.businessSaleOwnerPins.path
  function Get-FileHash($LiteralPath,$Algorithm){$p=if($LiteralPath-ceq$startup){Join-Path $temp 'startup.json'}elseif($LiteralPath-ceq$logical){$maintenancePath}else{$LiteralPath};if(![IO.Path]::GetFullPath($p).StartsWith($temp+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'HASH_OUTSIDE_FIXTURE'};return @{Hash=(Hash-Temp $p)}}
  function Get-ErpBusinessSaleWriterTaskLauncherPins($p,$Mode){[void](Get-ErpReadPairReleaseProofContext $p);return @{path=$(if($Mode-ceq'Candidate'){$logical}else{$futurePath})}}
  $task.Actions[0].Arguments=$oldArguments.Replace($futurePath,$logical);$supervisor.CommandLine='"'+$exe+'" '+$task.Actions[0].Arguments
  foreach($mode in @('Candidate','Current')){
   $config.ApiComponent=if($mode-ceq'Candidate'){$candidate}else{$current};$ownerNative.phase=if($mode-ceq'Candidate'){'WriterActivated'}else{'WriterRestored'}
   $oldRejected=$false;try{Get-Test125BoundMaintenancePlan -RunId $scope -ReadPairPreparation -ReadPairMode $mode -PreparedReleaseProof $proof|Out-Null}catch{$oldRejected=$true};if(!$oldRejected){throw 'OLD_CONTROLLER_PLAN_ADOPTED_NEW_ENGINE'}
   $result=@(Get-Test125PackageRefreshPostTransitionPlan -Mode $mode -PreparedReleaseProof $proof)
   if($result.Count-ne1-or$result[0].supervisor-ne$currentPid-or$result[0].status-cne'POST_TRANSITION_READONLY_NOT_ADMISSION'-or$result[0].readOnly-cne$true-or$result[0].executionAuthority-cne$false-or$result[0].supportedTaskStopStart-cne$false){throw 'NOT_SCALAR_READONLY_FACTS'}
   if($proofContext.PSObject.Properties['packageRefreshTaskState']-or$nativeContext.phase-cne'WriterPrepared'-or$nativeContext.transition){throw 'OWNER_AUTHORITY_TRANSFERRED'}
  }
  foreach($case in @('oldPid','bound','phase','clone','ownerProof','xml','sddl','profile')){
   $savedXml=$registered.Xml;$savedPhase=$nativeContext.phase;$savedProfile=[IO.File]::ReadAllBytes($profile);$savedSddl=[IO.File]::ReadAllBytes($sddlPath);$arg=$proof
   switch($case){oldPid{$script:oldStillPresent=$true}bound{$nativeContext.transition=[pscustomobject]@{id='forged'}}phase{$nativeContext.phase='WriterActivated'}clone{$arg=$proof.PSObject.Copy()}ownerProof{$arg=$ownerProof}xml{$registered.Xml=$beforeXml}sddl{[IO.File]::WriteAllText($sddlPath,'changed')}profile{[IO.File]::WriteAllText($profile,'changed')}}
   $bad=$false;try{Get-Test125PackageRefreshPostTransitionPlan -Mode Current -PreparedReleaseProof $arg|Out-Null}catch{$bad=$true}
   $registered.Xml=$savedXml;$nativeContext.phase=$savedPhase;$nativeContext.transition=$null;$script:oldStillPresent=$false;[IO.File]::WriteAllBytes($profile,$savedProfile);[IO.File]::WriteAllBytes($sddlPath,$savedSddl)
   if(!$bad){throw 'POST_TRANSITION_OBSERVATION_DRIFT_ACCEPTED'}
  }
  if($script:afterReads-lt2){throw 'FRESH_AFTER_NOT_READ'};'PASS'
 }finally{foreach($p in $fixtureChildren){if(!$p.HasExited){$p.Kill();$p.WaitForExit()};$p.Dispose()}}
 `,`. '${quiescence}'; `,variant),'PASS');
});
win('PackageRefresh actual maintenance plan distinguishes the captured running V2 supervisor from its future steady task and later silent maintenance launcher',()=>{
 assert.equal(runRefreshPlan(String.raw`
 $a=Get-Test125BoundMaintenancePlan -RunId $scope -ReadPairPreparation -PreparedReleaseProof $proof;if($a.launcherHash-cne(Hash-Temp $oldPath)-or$a.launcherHash-ceq(Hash-Temp $futurePath)){throw 'RUNNING_FUTURE_LAUNCHERS_CONFLATED'}
 foreach($case in @('argv','birth','record','future','pid')){$saved=$supervisor.PSObject.Copy();$args=$task.Actions[0].Arguments;$oldHash=$running.ownedRecordSha256;switch($case){argv{$supervisor.CommandLine+=' -Once'}birth{$supervisor.CreationDate=$created.AddSeconds(1)}record{$running.ownedRecordSha256='0'*64}future{$task.Actions[0].Arguments+=' -Once'}pid{$supervisor.ProcessId=13533}};$bad=$false;try{Get-Test125BoundMaintenancePlan -RunId $scope -ReadPairPreparation -PreparedReleaseProof $proof|Out-Null}catch{$bad=$true};$supervisor=$saved;$task.Actions[0].Arguments=$args;$running.ownedRecordSha256=$oldHash;if(!$bad){throw 'SPLIT_CAPTURE_DRIFT_ACCEPTED'}}
 $proofContext.packageRefreshTaskState.maintenanceInstalled=$true;$currentPid=200;$owned.supervisor=200;$supervisor.ProcessId=200;$task.Actions[0].Arguments=$task.Actions[0].Arguments.Replace($futurePath,$maintenancePath);$supervisor.CommandLine='"'+$exe+'" '+$task.Actions[0].Arguments
 [IO.File]::WriteAllText($ownedPath,($owned|ConvertTo-Json -Depth 12));$a=Get-Test125BoundMaintenancePlan -RunId $scope -ReadPairPreparation -PreparedReleaseProof $proof;if($a.supervisor-ne200-or$a.launcherHash-cne(Hash-Temp $maintenancePath)){throw 'ROLLBACK_SILENT_MAINTENANCE_NOT_ADMITTED'};'PASS'
 `),'PASS');
});
win('Writer scope uses sealed pair data and both frozen task launcher modes require the genuine release proof',()=>{
 assert.equal(run(String.raw`
$script:reads=0;$script:pair=[pscustomobject]@{current=[pscustomobject]@{api=[pscustomobject]@{root='old';sourceCommit='source';manifestSha256='old-pin';configPath='profile'}};candidate=[pscustomobject]@{api=[pscustomobject]@{root='new';sourceCommit='source';manifestSha256='new-pin';configPath='profile'}}}
function Read-ErpBusinessSaleWriterOwnerSource {$script:reads++;return [pscustomobject]@{packagePair=$script:pair}}
$scope=Get-Test125ReadPairScope 'TEST125-API-B6-WRITER-20261029';if($scope.current.ReleaseRoot-cne'old'-or$scope.candidate.ManifestSha256-cne'new-pin'-or$script:reads-ne1){throw 'WRITER_SCOPE_NOT_SEALED'}
$proof=[pscustomobject]@{id='fixture-only'};$script:modes=@()
function Get-ErpBusinessSaleWriterTaskLauncherPins {param($PreparedReleaseProof,$Mode);if(![object]::ReferenceEquals($PreparedReleaseProof,$proof)){throw 'NOT_ISSUED'};$script:modes+=,$Mode;return [pscustomobject]@{path=('fixed-'+$Mode)}}
foreach($mode in @('Current','Candidate')){if((Get-Test125MaintenanceTaskLauncher ([pscustomobject]@{}) -ScopeName 'TEST125-API-B6-WRITER-20261029' -Mode $mode -PreparedReleaseProof $proof)-cne('fixed-'+$mode)){throw 'TASK_MODE_MISMATCH'}}
try{Get-Test125MaintenanceTaskLauncher ([pscustomobject]@{}) -ScopeName 'TEST125-API-B6-WRITER-20261029' -Mode Current;throw 'MISSING_REJECTION'}catch{if($_.Exception.Message-ceq'MISSING_REJECTION'){throw}}
if(($script:modes-join'|')-cne'Current|Candidate'){throw 'TASK_PROOF_BYPASS'}
'PASS'
`),'PASS');
});
test('preparation contains no task/process mutation, runtime publication or database writer',()=>{
 const source=readFileSync(file,'utf8');
 assert.doesNotMatch(source,/^\s*(?:Stop-Process|Stop-ScheduledTask|Start-ScheduledTask|Register-ScheduledTask|Unregister-ScheduledTask|Write-ErpState|Invoke-Sqlcmd)\b/m);
 assert.doesNotMatch(source,/\.Stop\(|\.Run\(|applyProductCompletionPlan/);
 assert.match(source,/FileMode\]::CreateNew/);
});
win('library import is inert and CLI preserves execution flag across existing library parameters',()=>{
 assert.equal(run(`if(Get-Command Read-ErpStartupConfig){'PASS'}`),'PASS');
 const script=file.replaceAll("'","''");
 let failure;
 try{execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`function Get-Content {throw 'FIXTURE_CONFIG_OBSERVED'};& '${script}'`],{encoding:'utf8'});}catch(error){failure=error;}
 assert.equal(failure?.status,1);
 assert.equal(JSON.parse(failure.stdout).code,'FIXTURE_CONFIG_OBSERVED');
});
const fixture=`
$cfg=[pscustomobject]@{RepoRoot='C:\\fixture\\repo';OwnerSid='S-1-fixture'};
$exe=Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe';
$argsText='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "C:\\fixture\\repo\\scripts\\canonical\\start-owned-test.ps1" -StartupConfigPath "C:\\fixture\\startup.json"';
$task=[pscustomobject]@{TaskName='Melisa-ERP-TEST-Canonical';TaskPath='\\';State='Running';Settings=[pscustomobject]@{Enabled=$true;AllowHardTerminate=$true;MultipleInstances='IgnoreNew'};Principal=[pscustomobject]@{UserId='S-1-fixture';LogonType='Interactive';RunLevel='Limited'};Actions=@([pscustomobject]@{Execute=$exe;Arguments=$argsText;WorkingDirectory=$cfg.RepoRoot})};
`;
win('exact registered task identity accepts original; altered action, owner, state and restart policy reject',()=>{
 assert.equal(run(`${fixture}
 Assert-Test125MaintenanceTask $task $cfg 'C:\\fixture\\startup.json' | Out-Null;
 foreach($field in @('TaskName','State','owner','arguments','working','policy')){
  $copy=$task | ConvertTo-Json -Depth 8 | ConvertFrom-Json;
  switch($field){TaskName{$copy.TaskName='Other'} State{$copy.State='Ready'} owner{$copy.Principal.UserId='S-1-foreign'} arguments{$copy.Actions[0].Arguments+=' -Once'} working{$copy.Actions[0].WorkingDirectory='C:\\foreign'} policy{$copy.Settings.MultipleInstances='Parallel'}};
  $rejected=$false;try{Assert-Test125MaintenanceTask $copy $cfg 'C:\\fixture\\startup.json' | Out-Null}catch{$rejected=$true};if(!$rejected){throw 'ACCEPTED_BAD_TASK'}
 };'PASS'`),'PASS');
});
win('fresh boundary rejects changed PID birth, instance, source, task and package pins; observation time may advance',()=>{
 assert.equal(run(`
 $before=[pscustomobject]@{runId='run';source='source';database='TEST';startupHash='config';launcherHash='launcher';manifestHash='manifest';taskXmlHash='task';taskInstance='instance';supervisor=100;supervisorBirth='birth';children=@{api=@{pid=101;birth='child'}};observedAt='old'};
 $after=$before | ConvertTo-Json -Depth 8 | ConvertFrom-Json;$after.observedAt='new';Assert-Test125MaintenancePin $before $after;
 foreach($field in @('runId','source','database','startupHash','launcherHash','manifestHash','taskXmlHash','taskInstance','supervisor','supervisorBirth','children')){
  $after=$before | ConvertTo-Json -Depth 8 | ConvertFrom-Json;$after.$field='changed';$rejected=$false;try{Assert-Test125MaintenancePin $before $after}catch{$rejected=$true};if(!$rejected){throw 'ACCEPTED_STALE_BOUNDARY'}
 };'PASS'`),'PASS');
});
win('finite B6 scope starts at READ2b, returns only the pinned B6 component, and preserves the historical default',()=>{
 assert.equal(run(`
 $old=Get-Test125ReadPairScope;$b6=Get-Test125ReadPairScope -Name 'TEST125-API-B6-ca620bac-20261028';
 if($old.name-cne'TEST125-API-READ2b-20261028-41d3c213'-or$old.current.ReleaseRoot-cnotlike'*10cdc0ee'-or$b6.current.ReleaseRoot-cne$old.candidate.ReleaseRoot-or$b6.current.ManifestSha256-cne$old.candidate.ManifestSha256-or$b6.candidate.ManifestSha256-cne'85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d'-or$b6.candidate.SourceCommit-cne$old.source){throw 'B6_PAIR_PINS'}
 foreach($name in @('B6','TEST125-API-B6-ca620bac-20261028 ','test125-api-b6-ca620bac-20261028')){$rejected=$false;try{Get-Test125ReadPairScope -Name $name|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'UNPINNED_SCOPE_ACCEPTED'}};'PASS'`),'PASS');
});
win('B6 Current and Candidate config checks are exact and cannot exchange scopes, manifests or component source',()=>{
 assert.equal(run(`
 $scope=Get-Test125ReadPairScope -Name 'TEST125-API-B6-ca620bac-20261028';
 foreach($mode in @('Current','Candidate')){
  $part=if($mode-ceq'Current'){$scope.current}else{$scope.candidate};$c=[pscustomobject]@{SourceCommit=$scope.source;ExpectedDatabase=$scope.database;RepoRoot='C:\\Sirket\\ERP\\melisa-erp-v2';TaskName='Melisa-ERP-TEST-Canonical';ApiComponent=$part.PSObject.Copy()};[void](Assert-Test125ReadPairConfig $c $mode -ScopeName $scope.name);
  foreach($field in @('SourceCommit','ManifestSha256','ReleaseRoot','ConfigPath','extra')){$copy=$c|ConvertTo-Json -Depth 8|ConvertFrom-Json;if($field-ceq'extra'){$copy.ApiComponent|Add-Member extra 'forged'}else{$copy.ApiComponent.$field='changed'};$rejected=$false;try{Assert-Test125ReadPairConfig $copy $mode -ScopeName $scope.name|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'B6_COMPONENT_DRIFT_ACCEPTED'}}
  $rejected=$false;try{Assert-Test125ReadPairConfig $c $mode|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'B6_AS_OLD_SCOPE_ACCEPTED'}
 }
 function Read-ErpStartupConfig {throw 'UNEXPECTED_CONFIG_READ'};$rejected=$false;try{Get-Test125BoundMaintenancePlan -RunId 'TEST125-API-B6-ca620bac-20261028-foreign' -ReadPairPreparation|Out-Null}catch{if($_.Exception.Message-cne'TEST125_RUN_SCOPE_REJECTED'){throw};$rejected=$true};if(!$rejected){throw 'UNPINNED_PLAN_ACCEPTED'};'PASS'`),'PASS');
});
win('B6 task launcher resolution requires the genuine sealed fixed core and preserves the original principal and arguments',()=>{
 assert.equal(run(`${fixture}
 $proof=[pscustomobject]@{opaque='test-only'};$fixed='C:\\Sirket\\ERP\\releases\\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY\\start-owned-test.ps1';$script:pinPath=$fixed;$script:fileHash=('a'*64)
 function Get-ErpBusinessSaleTaskLauncherPins($Token){if(![object]::ReferenceEquals($Token,$proof)){throw 'FAKE_RELEASE_PROOF'};return @{path=$script:pinPath;sha256=('a'*64);coreManifestSha256=('b'*64)}}
 function Get-FileHash($LiteralPath,$Algorithm){if($LiteralPath-cne$fixed-or$Algorithm-cne'SHA256'){throw 'UNPINNED_HASH_READ'};return @{Hash=$script:fileHash}}
 Assert-Test125MaintenanceTask $task $cfg 'C:\\fixture\\startup.json' -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Current|Out-Null
 $task.Actions[0].Arguments=$argsText.Replace('C:\\fixture\\repo\\scripts\\canonical\\start-owned-test.ps1',$fixed)
 Assert-Test125MaintenanceTask $task $cfg 'C:\\fixture\\startup.json' -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate -PreparedReleaseProof $proof|Out-Null
 foreach($case in @('missing','copy','path','old-rehearsal','hash','owner','arguments')){
  $arg=$proof;$oldArgs=$task.Actions[0].Arguments
  switch($case){'missing'{$arg=$null}'copy'{$arg=$proof|ConvertTo-Json|ConvertFrom-Json}'path'{$script:pinPath='C:\\foreign.ps1'}'old-rehearsal'{$script:pinPath='C:\\Sirket\\ERP\\releases\\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3\\start-owned-test.ps1'}'hash'{$script:fileHash=('c'*64)}'owner'{$task.Principal.UserId='S-1-foreign'}'arguments'{$task.Actions[0].Arguments+=' -Once'}}
  $rejected=$false;try{Assert-Test125MaintenanceTask $task $cfg 'C:\\fixture\\startup.json' -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate -PreparedReleaseProof $arg|Out-Null}catch{$rejected=$true};if(!$rejected){throw ('B6_TASK_LAUNCHER_DRIFT_'+$case)}
  $script:pinPath=$fixed;$script:fileHash=('a'*64);$task.Principal.UserId='S-1-fixture';$task.Actions[0].Arguments=$oldArgs
 };'PASS'`),'PASS');
});
win('finite task XML signature ignores serialization whitespace but retains all action, principal and policy values and rejects DTDs',()=>{
 assert.equal(run(`
 $xml='<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Principals><Principal id="Author"><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><Enabled>true</Enabled></Settings><Actions><Exec><Arguments>-File &quot;fixed&quot;</Arguments></Exec></Actions></Task>'
 $hash=Get-Test125TaskXmlSignature $xml;if($hash-cne(Get-Test125TaskXmlSignature ($xml.Replace('><',('>'+[char]10+'<'))))){throw 'TASK_XML_WHITESPACE'}
 foreach($pair in @(@('LeastPrivilege','HighestAvailable'),@('true','false'),@('fixed','other'))){if($hash-ceq(Get-Test125TaskXmlSignature ($xml.Replace($pair[0],$pair[1])))){throw 'TASK_XML_DRIFT_IGNORED'}}
 foreach($bad in @('<!DOCTYPE Task [<!ENTITY x "forbidden">]>'+$xml,'<Task xmlns="urn:foreign"/>')){$rejected=$false;try{Get-Test125TaskXmlSignature $bad|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'UNSAFE_TASK_XML_ACCEPTED'}};'PASS'`),'PASS');
});
