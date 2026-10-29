import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const file=path.join(import.meta.dirname,'test125-bound-maintenance-plan.ps1');
const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const run=body=>execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`. '${file.replaceAll("'","''")}' -Library; ${body}`],{encoding:'utf8'}).trim();
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
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
 $proof=[pscustomobject]@{opaque='test-only'};$fixed='C:\\Sirket\\ERP\\releases\\ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3\\start-owned-test.ps1';$script:pinPath=$fixed;$script:fileHash=('a'*64)
 function Get-ErpBusinessSaleTaskLauncherPins($Token){if(![object]::ReferenceEquals($Token,$proof)){throw 'FAKE_RELEASE_PROOF'};return @{path=$script:pinPath;sha256=('a'*64);coreManifestSha256=('b'*64)}}
 function Get-FileHash($LiteralPath,$Algorithm){if($LiteralPath-cne$fixed-or$Algorithm-cne'SHA256'){throw 'UNPINNED_HASH_READ'};return @{Hash=$script:fileHash}}
 Assert-Test125MaintenanceTask $task $cfg 'C:\\fixture\\startup.json' -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Current|Out-Null
 $task.Actions[0].Arguments=$argsText.Replace('C:\\fixture\\repo\\scripts\\canonical\\start-owned-test.ps1',$fixed)
 Assert-Test125MaintenanceTask $task $cfg 'C:\\fixture\\startup.json' -ScopeName 'TEST125-API-B6-ca620bac-20261028' -Mode Candidate -PreparedReleaseProof $proof|Out-Null
 foreach($case in @('missing','copy','path','hash','owner','arguments')){
  $arg=$proof;$oldArgs=$task.Actions[0].Arguments
  switch($case){'missing'{$arg=$null}'copy'{$arg=$proof|ConvertTo-Json|ConvertFrom-Json}'path'{$script:pinPath='C:\\foreign.ps1'}'hash'{$script:fileHash=('c'*64)}'owner'{$task.Principal.UserId='S-1-foreign'}'arguments'{$task.Actions[0].Arguments+=' -Once'}}
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
