import test from 'node:test';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import {readFileSync,mkdtempSync,rmSync,realpathSync,lstatSync,mkdirSync,symlinkSync} from 'node:fs';import path from 'node:path';import os from 'node:os';
const file=path.join(import.meta.dirname,'test125-bound-api-quiescence.ps1'),ps=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const run=body=>execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`. '${file.replaceAll("'","''")}'; ${body}`],{encoding:'utf8',timeout:20000}).trim();
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
win('negative approval batch requires its exact admission and rejects previous run receipt',()=>{
 assert.equal(run(`
 $selected='PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a';
 $a=[pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$selected;source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01';children=@{api=@{port=4144};native=@{port=4146};web=@{port=5194}}};
 Assert-Test125ApiAdmission $a $selected;
 $a.runId='PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8';
 try{Assert-Test125ApiAdmission $a $selected;throw 'UNEXPECTED_ACCEPT'}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw}};
 'PASS'`),'PASS');
});
win('narrow library imports inertly and supported task actions occur only inside the explicit transition AST',()=>{
 const s=readFileSync(file,'utf8');assert.doesNotMatch(s,/Stop-Process|Start-Process|applyProductCompletionPlan|Register-ScheduledTask|Unregister-ScheduledTask|Invoke-Sqlcmd/);
 assert.match(s,/TerminateProcess\(h,1\)/);assert.match(s,/\[Test125ApiKernel\]::Stop\(\$Binding.handle,\$Binding.birth\)/);
 const script=file.replaceAll("'","''");assert.equal(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`
 function Get-Content {throw 'IMPORT_RUNTIME_READ'};function Get-CimInstance {throw 'IMPORT_PROCESS_READ'};function Get-ScheduledTask {throw 'IMPORT_TASK_READ'};function Stop-ScheduledTask {throw 'IMPORT_TASK_STOP'};function Start-ScheduledTask {throw 'IMPORT_TASK_START'};
 . '${script}';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${script}',[ref]$tokens,[ref]$errors);if($errors.Count){throw 'SOURCE_PARSE'}
 $commands=@($ast.FindAll({param($n);$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-cin@('Stop-ScheduledTask','Start-ScheduledTask','New-ScheduledTaskAction','Set-ScheduledTask')},$true));if($commands.Count-ne4){throw 'SUPPORTED_ACTION_SCOPE'}
 foreach($command in $commands){$owner=$command.Parent;while($owner-and$owner-isnot[Management.Automation.Language.FunctionDefinitionAst]){$owner=$owner.Parent};$expected=if($command.GetCommandName()-cin@('New-ScheduledTaskAction','Set-ScheduledTask')){'Set-Test125ReadPairTaskAction'}else{'Invoke-Test125ReadPairApiTransition'};if(!$owner-or$owner.Name-cne$expected){throw 'TASK_ACTION_OUTSIDE_EXPLICIT_TRANSITION'}};'PASS'`],{encoding:'utf8',timeout:20000}).trim(),'PASS');
});
win('import is inert; wrong target, run, source or API port rejects before process access',()=>{
 assert.equal(run(`
 function Get-Test125BoundMaintenancePlan {throw 'UNEXPECTED_RUNTIME_ACCESS'}
 $a=[pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7';source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01';children=@{api=@{port=4144};native=@{port=4146};web=@{port=5194}}};
 Assert-Test125ApiAdmission $a;
 foreach($field in @('runId','source','database','port')){$copy=$a | ConvertTo-Json -Depth 8 | ConvertFrom-Json;if($field -eq 'port'){$copy.children.api.port=4194}else{$copy.$field='foreign'};$rejected=$false;try{Open-Test125ApiQuiescence $copy | Out-Null}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw};$rejected=$true};if(!$rejected){throw 'ACCEPTED_FOREIGN'}};'PASS'`),'PASS');
});
win('real isolated process handle rejects wrong birth, stops only retained object, and cannot target next child',()=>{
 const node=process.execPath.replaceAll("'","''");
 assert.equal(run(`Initialize-Test125ApiKernel;
 $child=Start-Process -FilePath '${node}' -ArgumentList @('-e','"setTimeout(()=>{},15000)"') -WindowStyle Hidden -PassThru;
 $handle=$null;$other=$null;
 try{
  $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.Id);$birth=$p.CreationDate.ToUniversalTime().Ticks;
  $rejected=$false;try{$bad=[Test125ApiKernel]::Open($child.Id,$birth-10000000);$bad.Dispose()}catch{$rejected=$true};if(!$rejected -or $child.HasExited){throw 'WRONG_BIRTH_DID_NOT_REJECT'};
  $handle=[Test125ApiKernel]::Open($child.Id,$birth);
  $rejected=$false;try{[Test125ApiKernel]::Stop($handle,$birth-10000000)}catch{$rejected=$true};if(!$rejected -or $child.HasExited){throw 'WRONG_STOP_BIRTH'};
  [Test125ApiKernel]::Stop($handle,$birth);if(![Test125ApiKernel]::Exited($handle,$birth)){throw 'NOT_EXITED'};
  $other=Start-Process -FilePath '${node}' -ArgumentList @('-e','"setTimeout(()=>{},15000)"') -WindowStyle Hidden -PassThru;
  $rejected=$false;try{[Test125ApiKernel]::Stop($handle,$birth)}catch{$rejected=$true};if(!$rejected -or $other.HasExited){throw 'OLD_HANDLE_TARGETED_OTHER_CHILD'};
  'PASS'
 }finally{if($handle){$handle.Dispose()};foreach($own in @($child,$other)){if($own -and !$own.HasExited){$own.Kill();$own.WaitForExit()};if($own){$own.Dispose()}}}`),'PASS');
});
win('foreign binding cannot enter, stop, claim pause or release existing ownership',()=>{
 const commands=['Enter-'+ 'Test125ApiQuiescence','Stop-'+ 'Test125BoundApi','Test-'+ 'Test125ApiPhysicalPause','Close-'+ 'Test125ApiQuiescence'];
 const expected=['TEST125','API','BINDING','NOT','OWNED'].join('_');
 assert.equal(run(`foreach($command in @(${commands.map(s=>`'${s}'`).join(',')})){$rejected=$false;try{& $command ([pscustomobject]@{}) | Out-Null}catch{if($_.Exception.Message -ne '${expected}'){throw};$rejected=$true};if(!$rejected){throw 'FOREIGN_BINDING_ACCEPTED'}};'PASS'`),'PASS');
});

win('explicit selected product run is bound in fresh admission; old or arbitrary run cannot stand in',()=>{
 assert.equal(run(`
 $oldRun='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7';$newRun='PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8';
 $a=[pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$newRun;source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01';children=@{api=@{port=4144};native=@{port=4146};web=@{port=5194}}};
 Assert-Test125ApiAdmission $a $newRun;
 $count=0;foreach($expected in @($oldRun,'PRODUCT-00000000-0000-4000-8000-000000000001')){try{Assert-Test125ApiAdmission $a $expected;throw 'UNEXPECTED_ACCEPT'}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw};$count++}};
 $a.runId=$oldRun;try{Assert-Test125ApiAdmission $a $newRun;throw 'OLD_RECEIPT_ACCEPTED'}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw};$count++};Assert-Test125ApiAdmission $a;
 function Read-ErpStartupConfig {throw 'UNEXPECTED_RUNTIME_ACCESS'};
 try{Get-Test125BoundMaintenancePlan -RunId 'PRODUCT-00000000-0000-4000-8000-000000000001';throw 'UNEXPECTED_ACCEPT'}catch{if($_.Exception.Message -ne 'TEST125_RUN_SCOPE_REJECTED'){throw};$count++};
 if($count -ne 4){throw 'NEGATIVE_COUNT'};'PASS'`),'PASS');
 const source=readFileSync(file,'utf8');assert.match(source,/Get-Test125BoundMaintenancePlan -RunId \$ExpectedRunId/);
});
const b6Fixture=String.raw`
# These finite test adapters virtualize only external package/native-owner/OS
# observations and the two fixed IO paths into a disposable directory. The
# actual constructor, issued-reference checks, transition flow and file CAS run.
$script:fixtureRoot=__TEMP__;$script:fixtureStartup=Join-Path $fixtureRoot 'startup.json';$script:fixtureApi=Join-Path $fixtureRoot 'api.json';$script:fixtureBase=Join-Path $fixtureRoot 'base.json';$script:currentLauncher=Join-Path $fixtureRoot 'current-launcher.ps1';$script:nextLauncher=Join-Path $fixtureRoot 'next-launcher.ps1'
[IO.File]::WriteAllText($currentLauncher,'fixed-current-source');[IO.File]::WriteAllText($nextLauncher,'fixed-candidate-source')
function Get-FileHash($LiteralPath,$Algorithm){if($LiteralPath-ceq'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION\start-owned-test.ps1'){$LiteralPath=$script:nextLauncher}elseif($LiteralPath-ceq'C:\Sirket\ERP\melisa-erp-v2\scripts\canonical\start-owned-test.ps1'){$LiteralPath=$script:currentLauncher};if(!([IO.Path]::GetFullPath($LiteralPath).StartsWith($script:fixtureRoot+'\',[StringComparison]::OrdinalIgnoreCase))){throw 'FIXTURE_HASH_OUTSIDE_TEMP'};return @{Hash=(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($LiteralPath))).ToUpperInvariant()}}
function Get-Acl($LiteralPath){if(!([IO.Path]::GetFullPath($LiteralPath).StartsWith($script:fixtureRoot+'\',[StringComparison]::OrdinalIgnoreCase))){throw 'FIXTURE_ACL_OUTSIDE_TEMP'};return [IO.Directory]::GetAccessControl($LiteralPath)}
$scopeBody=(Get-Command Get-Test125ReadPairScope).Definition.Replace('C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json',$fixtureApi)
. ([scriptblock]::Create('function Get-Test125ReadPairScope {'+$scopeBody+'}'))
$constructor=(Get-Command New-Test125ReadPairTransition).Definition.Replace('C:\Sirket\ERP\runtime\canonical-test\startup-config.json',$fixtureStartup)
. ([scriptblock]::Create('function New-Test125ReadPairTransition {'+$constructor+'}'))
$script:scope=Get-Test125ReadPairScope -Name 'TEST125-API-B6-ca620bac-20261028';$script:native=[pscustomobject]@{fixture='opaque-owner-issued'};$script:nativePhase='Prepared';$script:nativeReady=$true;$script:nativeBound=$null;$script:release=[pscustomobject]@{fixture='opaque-release'};$script:releaseClosed=$false;$script:planCalls=0;$script:generation=100;$script:events=[Collections.Generic.List[string]]::new()
$profile=[pscustomobject]@{database=$scope.database;goal8SyntheticDaySeal=[pscustomobject]@{packageId=[IO.Path]::GetFileName($scope.current.ReleaseRoot)}}
[IO.File]::WriteAllText($fixtureApi,($profile|ConvertTo-Json -Depth 20));[IO.File]::WriteAllText($fixtureBase,($profile|ConvertTo-Json -Depth 20))
$candidate=$profile|ConvertTo-Json -Depth 20|ConvertFrom-Json;$candidate.goal8SyntheticDaySeal.packageId=[IO.Path]::GetFileName($scope.candidate.ReleaseRoot);$candidate|Add-Member businessSaleAdmission ([pscustomobject]@{profileHash=('a'*64)})
$script:candidateBytes=[Text.Encoding]::UTF8.GetBytes(($candidate|ConvertTo-Json -Depth 20))
$config=[pscustomobject]@{SourceCommit=$scope.source;ExpectedDatabase=$scope.database;RepoRoot='C:\Sirket\ERP\melisa-erp-v2';TaskName='Melisa-ERP-TEST-Canonical';ApiComponent=$scope.current;ConfigPath=$fixtureBase;RuntimeDir=$fixtureRoot;OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}
[IO.File]::WriteAllText($fixtureStartup,($config|ConvertTo-Json -Depth 20))
function Read-ErpStartupConfig($Path,$PreparedReleaseProof){if($Path-cne$script:fixtureStartup){throw 'FIXTURE_WRONG_STARTUP'};return ([IO.File]::ReadAllText($Path)|ConvertFrom-Json)}
function Get-ErpApiComponentConfig($Config){return $Config.ApiComponent}
function Assert-ErpRelease($Config){return @{packageId=[IO.Path]::GetFileName($Config.ReleaseRoot)}}
function Assert-ErpApiPrivateProfile($Base,$Api,$Manifest){if($Api.goal8SyntheticDaySeal.packageId-cne$Manifest.packageId-or$Api.businessSaleAdmission.profileHash-cne('a'*64)){throw 'FIXTURE_PROFILE_DRIFT'}}
function Assert-ErpBusinessSaleNativeProfileAdmission($Admission,[string]$Phase='Prepared'){
 if($script:nativePhase-ceq'Unknown'){throw 'FIXTURE_NATIVE_OUTCOME_UNKNOWN'}
 if(![object]::ReferenceEquals($Admission,$script:native)-or!$script:nativeReady-or($Phase-cne'Identity'-and$Phase-cne$script:nativePhase)){throw 'FIXTURE_NATIVE_NOT_ISSUED_OR_READY'};return @{phase=$script:nativePhase}
}
function Get-ErpBusinessSaleNativeAdmissionContext($Admission){if(![object]::ReferenceEquals($Admission,$script:native)-or!$script:nativeReady){throw 'FIXTURE_NATIVE_NOT_ISSUED_OR_READY'};return @{transition=$script:nativeBound;phase=$script:nativePhase}}
function Get-ErpBusinessSaleCandidateProfileBytes($Admission){[void](Assert-ErpBusinessSaleNativeProfileAdmission $Admission -Phase Prepared);return ,$script:candidateBytes}
function New-ErpReadPairPreparedReleaseProof($Config,$ScopeName,$NativeProfileAdmission){if($ScopeName-cne$script:scope.name){throw 'FIXTURE_RELEASE_SCOPE'};[void](Assert-ErpBusinessSaleNativeProfileAdmission $NativeProfileAdmission -Phase Prepared);return $script:release}
function Get-ErpReadPairReleaseProofContext($Proof){if(![object]::ReferenceEquals($Proof,$script:release)-or$script:releaseClosed){throw 'FIXTURE_RELEASE_NOT_ISSUED'};return @{fixture=$true}}
function Get-ErpReadPairReleaseProofPins($Proof){[void](Get-ErpReadPairReleaseProofContext $Proof);return @{fixture='sealed-pins'}}
function Get-ErpBusinessSaleTaskLauncherPins($Proof){[void](Get-ErpReadPairReleaseProofContext $Proof);return @{path='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION\start-owned-test.ps1';sha256=(Get-FileHash $script:nextLauncher SHA256).Hash.ToLowerInvariant();coreManifestSha256=('b'*64)}}
function Close-ErpReadPairReleaseProof($Proof){[void](Get-ErpReadPairReleaseProofContext $Proof);$script:releaseClosed=$true}
function Bind-ErpBusinessSaleNativeProfileTransition($Admission,$Transition){[void](Assert-ErpBusinessSaleNativeProfileAdmission $Admission -Phase Prepared);$ctx=Assert-Test125ReadPairIssued $Transition;if(![object]::ReferenceEquals($ctx.nativeProfileAdmission,$Admission)-or$script:nativeBound){throw 'FIXTURE_NATIVE_BIND'};$script:nativeBound=$Transition}
$script:taskSddl='O:SYG:SYD:(A;;GA;;;SY)';$script:taskInstances=0;$script:setCalls=0;$script:setMode='ok'
$taskArgs='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "C:\Sirket\ERP\melisa-erp-v2\scripts\canonical\start-owned-test.ps1" -StartupConfigPath "C:\Sirket\ERP\runtime\canonical-test\startup-config.json"'
$taskExe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$script:taskXml='<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Principals><Principal id="Author"><UserId>'+ $config.OwnerSid+'</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><Enabled>true</Enabled></Settings><Actions Context="Author"><Exec><Command>'+$taskExe+'</Command><Arguments>'+[Security.SecurityElement]::Escape($taskArgs)+'</Arguments><WorkingDirectory>C:\Sirket\ERP\melisa-erp-v2</WorkingDirectory></Exec></Actions></Task>'
function Get-Test125ReadPairTask{$o=[pscustomobject]@{Xml=$script:taskXml};$o|Add-Member ScriptMethod GetInstances {param($n);return @{Count=$script:taskInstances}};$o|Add-Member ScriptMethod GetSecurityDescriptor {param($n);if($n-ne7){throw 'FIXTURE_SDDL_FLAGS'};return $script:taskSddl};return $o}
function New-ScheduledTaskAction($Execute,$Argument,$WorkingDirectory){return @{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory}}
function Set-ScheduledTask($TaskName,$TaskPath,$Action){$script:setCalls++;$script:events.Add('task-set');if($TaskName-cne'Melisa-ERP-TEST-Canonical'-or$TaskPath-cne'\'){throw 'FIXTURE_TASK_SCOPE'};if($script:setMode-ceq'before-fail'){throw 'FIXTURE_SET_FAILED'};$doc=[xml]$script:taskXml;$doc.Task.Actions.Exec.Command=[string]$Action.Execute;$doc.Task.Actions.Exec.Arguments=[string]$Action.Arguments;$doc.Task.Actions.Exec.WorkingDirectory=[string]$Action.WorkingDirectory;if($script:setMode-ceq'unknown'){$doc.Task.Settings.Enabled='false'};$script:taskXml=$doc.OuterXml;if($script:setMode-ceq'acklost'){throw 'FIXTURE_SET_ACK_LOST'}}
function Get-Test125BoundMaintenancePlan($RunId,[switch]$ReadPairPreparation,$ReadPairMode,$PreparedReleaseProof){
 $script:planCalls++;if($RunId-cne$script:scope.name-or!$ReadPairPreparation){throw 'FIXTURE_PLAN_SCOPE'}
 $launcher=if($ReadPairMode-ceq'Candidate'){$script:nextLauncher}else{$script:currentLauncher}
 return [pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$RunId;source=$script:scope.source;database=$script:scope.database;startupHash=(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($script:fixtureStartup))).ToUpperInvariant();launcherHash=(Get-FileHash $launcher SHA256).Hash;manifestHash='base-manifest';taskXmlHash=(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($script:taskXml)));taskInstance=('instance'+$script:generation);supervisor=$script:generation;supervisorBirth='2026-10-28T00:00:00Z';children=@{api=@{pid=101;port=4144;birth='2026-10-28T00:00:00Z'};native=@{pid=102;port=4146;birth='2026-10-28T00:00:00Z'};web=@{pid=103;port=5194;birth='2026-10-28T00:00:00Z'}}}
}
`;
function runB6(body,{tempRoot}={}){const base=realpathSync.native(tempRoot||process.env.RUNNER_TEMP||os.tmpdir()),temp=realpathSync.native(mkdtempSync(path.join(base,'erp-b6-bound-')));try{return run(b6Fixture.replace('__TEMP__',"'"+temp.replaceAll("'","''")+"'")+body);}finally{const full=realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),base.toLowerCase());assert(path.basename(full).startsWith('erp-b6-bound-'));assert(!lstatSync(full).isSymbolicLink());rmSync(full,{recursive:true,force:true});}}
win('B6 constructor requires the native owner-issued ready reference before any plan read and never accepts a copied admission',()=>{
 assert.equal(runB6(String.raw`
 foreach($foreign in @($null,([pscustomobject]@{}),($script:native|ConvertTo-Json|ConvertFrom-Json))){$denied=$false;try{New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $foreign|Out-Null}catch{$denied=$true};if(!$denied-or$script:planCalls-ne0-or$script:Test125ReadPairContext){throw 'B6_UNISSUED_ADMITTED'}}
 $script:nativeReady=$false;$denied=$false;try{New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $script:native|Out-Null}catch{$denied=$true};if(!$denied-or$script:planCalls-ne0){throw 'B6_UNREADY_ADMITTED'};'PASS'`),'PASS');
});
win('B6 preparation retains exact native/transition references, sealed release and candidate bytes without publishing any file',()=>{
 assert.equal(runB6(String.raw`
 $before=[IO.File]::ReadAllBytes($fixtureStartup);$apiBefore=[IO.File]::ReadAllBytes($fixtureApi);$token=New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $script:native;$ctx=Assert-Test125ReadPairIssued $token;
 if(![object]::ReferenceEquals($ctx.nativeProfileAdmission,$script:native)-or![object]::ReferenceEquals($script:nativeBound,$token)-or$token.current.ManifestSha256-cne'8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'-or$token.candidate.ManifestSha256-cne'85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d'-or$token.apiProfileCandidateSha256-cne(Get-Test125ReadPairHash $script:candidateBytes)){throw 'B6_CONSTRUCTOR_BINDING'}
 if((Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne(Get-Test125ReadPairHash $before)-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi)))-cne(Get-Test125ReadPairHash $apiBefore)){throw 'B6_PREPARE_WROTE'}
 $denied=$false;try{Assert-Test125ReadPairIssued ($token|ConvertTo-Json -Depth 20|ConvertFrom-Json)|Out-Null}catch{$denied=$true};if(!$denied){throw 'B6_TOKEN_COPY_ADMITTED'}
 $ctx.nativeProfileAdmission=[pscustomobject]@{fixture='opaque-owner-issued'};$denied=$false;try{Assert-Test125ReadPairIssued $token|Out-Null}catch{$denied=$true};if(!$denied){throw 'B6_NATIVE_COPY_ADMITTED'};$ctx.nativeProfileAdmission=$script:native
 $ctx.thread++;$denied=$false;try{Assert-Test125ReadPairIssued $token|Out-Null}catch{$denied=$true};if(!$denied){throw 'B6_FOREIGN_THREAD_ADMITTED'};$ctx.thread--
 $script:releaseClosed=$true;$denied=$false;try{Assert-Test125ReadPairIssued $token|Out-Null}catch{$denied=$true};if(!$denied){throw 'B6_CLOSED_RELEASE_ADMITTED'};'PASS'`),'PASS');
});
win('historical READ2b constructor remains independent of B6 admission and preserves its original scope and seal-only profile delta',()=>{
 assert.equal(runB6(String.raw`
 $script:scope=Get-Test125ReadPairScope;$config.ApiComponent=$scope.current;[IO.File]::WriteAllText($fixtureStartup,($config|ConvertTo-Json -Depth 20));$profile.goal8SyntheticDaySeal.packageId=[IO.Path]::GetFileName($scope.current.ReleaseRoot);[IO.File]::WriteAllText($fixtureApi,($profile|ConvertTo-Json -Depth 20));[IO.File]::WriteAllText($fixtureBase,($profile|ConvertTo-Json -Depth 20))
 function New-ErpReadPairPreparedReleaseProof($Config,$ScopeName,$NativeProfileAdmission){if($null-ne$ScopeName-or$null-ne$NativeProfileAdmission){throw 'OLD_PATH_GOT_B6_ARGUMENTS'};return $script:release}
 function Assert-ErpApiPrivateProfile($Base,$Api,$Manifest){if($Api.goal8SyntheticDaySeal.packageId-cne$Manifest.packageId-or$Api.PSObject.Properties['businessSaleAdmission']){throw 'OLD_PROFILE_DELTA_CHANGED'}}
 $token=New-Test125ReadPairTransition;if($token.scope-cne'TEST125-API-READ2b-20261028-41d3c213'-or$token.schema-cne'melisa-test125-read2b-api-transition.v1'-or$script:nativeBound){throw 'OLD_SCOPE_CHANGED'};[void](Assert-Test125ReadPairTransition $token Current);if($script:nativePhase-cne'Prepared'){throw 'OLD_PATH_USED_NATIVE'};'PASS'`),'PASS');
});
win('B6 failed late native binding clears the issued context and closes its release seal without file publication',()=>{
 assert.equal(runB6(String.raw`
 $script:nativeBound=[pscustomobject]@{already='bound'};$before=Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup));$apiBefore=Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi));$denied=$false
 try{New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $script:native|Out-Null}catch{if($_.Exception.Message-cne'FIXTURE_NATIVE_BIND'){throw};$denied=$true}
 if(!$denied-or$script:Test125ReadPairContext-or!$script:releaseClosed-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne$before-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi)))-cne$apiBefore){throw 'LATE_BIND_LEAKED'};'PASS'`),'PASS');
});
const b6PausedFixture=String.raw`
$token=New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $script:native;$ctx=Assert-Test125ReadPairIssued $token
$binding=[pscustomobject]@{held=$true;stopped=$true;admission=$ctx.admission;config=$ctx.config;releaseProof=$ctx.releaseProof};$script:Test125ApiBinding=$binding;$ctx.activeBinding=$binding;$ctx.taskStopped=$true;$ctx.vault=Join-Path $fixtureRoot 'vault'
$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($config.OwnerSid));$acl.SetAccessRuleProtection($true,$false);foreach($sid in @($config.OwnerSid,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($ctx.vault,$acl)
function Assert-Test125ApiStoppedSupervisor($Binding){if(![object]::ReferenceEquals($Binding,$script:Test125ApiBinding)-or!$Binding.held-or!$Binding.stopped){throw 'FIXTURE_NOT_PAUSED'}}
function Test-Test125ApiPhysicalPause($Binding){Assert-Test125ApiStoppedSupervisor $Binding;return $true}
function Get-ErpProcess($Id){return $null}
function Assert-Test125ReadPairPaused($Context){if(![object]::ReferenceEquals($Context.activeBinding,$script:Test125ApiBinding)-or!$Context.activeBinding.held-or!$Context.activeBinding.stopped-or!$Context.taskStopped){throw 'FIXTURE_NOT_PAUSED'}}
function Assert-Test125ReadPairCompanions($Context){$script:events.Add('companions')}
function Invoke-ErpBusinessSaleNativeRevision($Admission,$Direction){
 [void](Assert-ErpBusinessSaleNativeProfileAdmission $Admission -Phase Identity);$c=Assert-Test125ReadPairIssued $script:nativeBound;Assert-Test125ReadPairPaused $c
 if($script:failNative){throw 'FIXTURE_NATIVE_EFFECT_PROOF_NOT_READY'}
 $script:events.Add('native-'+$Direction);$script:nativePhase=if($Direction-ceq'Apply'){'Applied'}elseif($Direction-ceq'Inverse'){'Restored'}else{'Prepared'}
}
function Close-Test125ApiQuiescence($Binding){if(![object]::ReferenceEquals($Binding,$script:Test125ApiBinding)){throw 'FIXTURE_UNOWNED_CLOSE'};$script:Test125ApiBinding=$null}
function Start-ScheduledTask($TaskName,$TaskPath){if($TaskName-cne'Melisa-ERP-TEST-Canonical'-or$TaskPath-cne'\'){throw 'FIXTURE_TASK_SCOPE'};$script:generation+=100;$script:events.Add('resume')}
function Open-Test125ApiQuiescence($Admission,$ExpectedRunId){$script:Test125ApiBinding=[pscustomobject]@{held=$true;stopped=$true;admission=$Admission;config=(Read-ErpStartupConfig $script:fixtureStartup);releaseProof=$script:release};return $script:Test125ApiBinding}
$script:failNative=$false
`;
win('B6 native apply precedes candidate CAS and native inverse precedes the exact READ2b rollback; replay has no second native effect',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $before=[IO.File]::ReadAllBytes($fixtureStartup);$apiBefore=[IO.File]::ReadAllBytes($fixtureApi)
 $candidate=Invoke-Test125ReadPairApiTransition $token Candidate;if($candidate.mode-cne'Candidate'-or$ctx.phase-cne'VERIFIED'-or$script:nativePhase-cne'Applied'){throw 'B6_CANDIDATE_NOT_VERIFIED'}
 if($candidate.PSObject.Properties['sqlWrites']-or$candidate.commercialWrites-ne0-or!$candidate.nativeRevisionProcessed-or!$candidate.nativeMetadataApplied-or$candidate.nativePhase-cne'Applied'){throw 'B6_SCHEMA_WRITES_MISREPORTED'}
 $again=Invoke-Test125ReadPairApiTransition $token Candidate;if($again.status-cne'ALREADY_VERIFIED'-or@($script:events|Where-Object{$_-ceq'native-Apply'}).Count-ne1){throw 'B6_NATIVE_REPLAY'}
 $ctx.activeBinding=Open-Test125ApiQuiescence $ctx.admission $token.scope;$ctx.taskStopped=$true
 $rollback=Invoke-Test125ReadPairApiTransition $token Rollback;if($rollback.mode-cne'Current'-or$ctx.phase-cne'VERIFIED'-or$script:nativePhase-cne'Restored'-or@($script:events|Where-Object{$_-ceq'native-Inverse'}).Count-ne1){throw 'B6_ROLLBACK_NOT_VERIFIED'}
 if($rollback.PSObject.Properties['sqlWrites']-or$rollback.commercialWrites-ne0-or$rollback.nativeMetadataApplied-or$rollback.nativePhase-cne'Restored'){throw 'B6_SCHEMA_INVERSE_MISREPORTED'}
 if((Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne(Get-Test125ReadPairHash $before)-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi)))-cne(Get-Test125ReadPairHash $apiBefore)){throw 'B6_ROLLBACK_BYTES'}
 if(($script:events|Where-Object{$_-like'native-*'-or$_-ceq'resume'})-join'|'-cne'native-Rehearse|native-Apply|resume|native-Inverse|resume'){throw 'B6_NATIVE_CAS_ORDER'};'PASS'`),'PASS');
});
win('B6 missing native effect proof fails closed while the API is paused and leaves startup/profile before-images intact',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $script:failNative=$true;$before=[IO.File]::ReadAllBytes($fixtureStartup);$apiBefore=[IO.File]::ReadAllBytes($fixtureApi);$denied=$false
 try{Invoke-Test125ReadPairApiTransition $token Candidate|Out-Null}catch{if($_.Exception.Message-cne'FIXTURE_NATIVE_EFFECT_PROOF_NOT_READY'){throw};$denied=$true}
 if(!$denied-or$ctx.phase-cne'FAILED'-or!$ctx.nativeChangeAttempted-or$ctx.changed-or$ctx.apiChanged-or!$ctx.taskStopped-or!$ctx.activeBinding.held-or$script:events.Contains('resume')){throw 'B6_UNREADY_NOT_CLOSED'}
 if((Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne(Get-Test125ReadPairHash $before)-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi)))-cne(Get-Test125ReadPairHash $apiBefore)){throw 'B6_UNREADY_WROTE'};'PASS'`),'PASS');
});
win('B6 inverse refusal preserves the candidate files and held pause instead of restarting READ2b against unproved native state',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 Invoke-Test125ReadPairApiTransition $token Candidate|Out-Null;$candidateStartup=[IO.File]::ReadAllBytes($fixtureStartup);$candidateApi=[IO.File]::ReadAllBytes($fixtureApi)
 $ctx.activeBinding=Open-Test125ApiQuiescence $ctx.admission $token.scope;$ctx.taskStopped=$true;$script:failNative=$true;$denied=$false
 try{Invoke-Test125ReadPairApiTransition $token Rollback|Out-Null}catch{if($_.Exception.Message-cne'FIXTURE_NATIVE_EFFECT_PROOF_NOT_READY'){throw};$denied=$true}
 if(!$denied-or$ctx.phase-cne'FAILED'-or!$ctx.taskStopped-or!$ctx.activeBinding.held-or@($script:events|Where-Object{$_-ceq'resume'}).Count-ne1){throw 'B6_INVERSE_REFUSAL_NOT_CLOSED'}
 if((Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne(Get-Test125ReadPairHash $candidateStartup)-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi)))-cne(Get-Test125ReadPairHash $candidateApi)){throw 'B6_INVERSE_REFUSAL_RESTORED_FILES'};'PASS'`),'PASS');
});
win('B6 Unknown remains execution-closed while the audit context accepts only both authentic retained references',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $script:nativePhase='Unknown';$ctx.phase='FAILED';$before=Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup));$apiBefore=Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi))
 $denied=$false;try{Assert-Test125ReadPairIssued $token|Out-Null}catch{if($_.Exception.Message-cne'FIXTURE_NATIVE_OUTCOME_UNKNOWN'){throw};$denied=$true};if(!$denied){throw 'UNKNOWN_EXECUTION_ADMITTED'}
 $audit=Get-Test125ReadPairNativeAuditContext $token $script:native;if(![object]::ReferenceEquals($audit,$ctx)){throw 'AUDIT_CONTEXT_NOT_ACTUAL'}
 foreach($case in @('token-copy','native-copy','native-unowned','native-binding','thread','pid','json','scope','release')){
  $transition=$token;$nativeArg=$script:native;$savedJson=$token.scope;$savedNativeBound=$script:nativeBound;$oldReady=$script:nativeReady
  switch($case){'token-copy'{$transition=$token|ConvertTo-Json -Depth 20|ConvertFrom-Json}'native-copy'{$nativeArg=$script:native|ConvertTo-Json|ConvertFrom-Json}'native-unowned'{$script:nativeReady=$false}'native-binding'{$script:nativeBound=[pscustomobject]@{foreign=$true}}'thread'{$ctx.thread++}'pid'{$ctx.pid++}'json'{$token.apiPort=4145}'scope'{$token.scope='TEST125-API-READ2b-20261028-41d3c213'}'release'{$script:releaseClosed=$true}}
  $rejected=$false;try{Get-Test125ReadPairNativeAuditContext $transition $nativeArg|Out-Null}catch{$rejected=$true};if(!$rejected){throw ('AUDIT_FOREIGN_ADMITTED_'+$case)}
  switch($case){'thread'{$ctx.thread--}'pid'{$ctx.pid--}'json'{$token.apiPort=4144}'scope'{$token.scope=$savedJson}'release'{$script:releaseClosed=$false}}
  $script:nativeBound=$savedNativeBound;$script:nativeReady=$oldReady
 }
 $audit=Get-Test125ReadPairNativeAuditContext $token $script:native;$denied=$false;try{Invoke-Test125ReadPairApiTransition $token Candidate|Out-Null}catch{if($_.Exception.Message-cne'FIXTURE_NATIVE_OUTCOME_UNKNOWN'){throw};$denied=$true}
 if(!$denied-or$ctx.candidateAttempted-or$script:events.Contains('native-Apply')-or$script:events.Contains('resume')-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne$before-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi)))-cne$apiBefore){throw 'AUDIT_OPENED_EXECUTION'};'PASS'`),'PASS');
});
win('B6 task-action preparation admits only the sealed fixed launcher and preserves every non-action XML field',()=>{
 assert.equal(runB6(String.raw`
 $original=$script:taskXml;$sddl=$script:taskSddl
 $denied=$false;try{Get-Test125MaintenanceTaskLauncher $config -ScopeName $scope.name -Mode Candidate -PreparedReleaseProof ($release|ConvertTo-Json|ConvertFrom-Json)|Out-Null}catch{$denied=$true};if(!$denied-or$script:setCalls){throw 'FORGED_LAUNCHER_ADMITTED'}
 foreach($field in @('arguments','command','working','second-action','dtd','sddl')){
  $script:taskXml=$original;$script:taskSddl=$sddl;$script:releaseClosed=$false;$doc=[xml]$script:taskXml
  switch($field){'arguments'{$doc.Task.Actions.Exec.Arguments+=' -Once'}'command'{$doc.Task.Actions.Exec.Command='C:\foreign.exe'}'working'{$doc.Task.Actions.Exec.WorkingDirectory='C:\foreign'}'second-action'{[void]$doc.Task.Actions.AppendChild($doc.Task.Actions.Exec.CloneNode($true))}'dtd'{}'sddl'{$script:taskSddl=''}}
  $script:taskXml=if($field-ceq'dtd'){'<!DOCTYPE Task [<!ENTITY x "forbidden">]>'+$original}else{$doc.OuterXml}
  $denied=$false;try{New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $native|Out-Null}catch{$denied=$true};if(!$denied-or$script:Test125ReadPairContext-or$script:setCalls){throw ('TASK_PLAN_DRIFT_ADMITTED_'+$field)}
 }
 $script:taskXml=$original;$script:taskSddl=$sddl;$script:releaseClosed=$false;$token=New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $native;$ctx=Assert-Test125ReadPairIssued $token
 if($token.PSObject.Properties['taskActionPins']-or$ctx.taskAction.mode-cne'Current'-or$ctx.taskAction.beforeXml-cne$original-or$ctx.taskAction.candidateLauncher-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION\start-owned-test.ps1'){throw 'TASK_PLAN_SCOPE'};'PASS'`),'PASS');
});
win('B6 supported task Action lost ACK reconciles once with durable before-images and restores only the original Action',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $original=$script:taskXml;$beforeSignature=Get-Test125TaskXmlSignature $original;$script:nativePhase='Applied';$script:setMode='acklost'
 Set-Test125ReadPairTaskAction $token Candidate
 if($script:setCalls-ne1-or$ctx.taskAction.mode-cne'Candidate'-or$ctx.taskAction.unknown-or!$ctx.taskAction.beforeDurable-or$ctx.admission.taskXmlHash-cne(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes($script:taskXml)))-or![object]::ReferenceEquals($ctx.admission,$ctx.activeBinding.admission)){throw 'TASK_ACK_RECONCILIATION'}
 Set-Test125ReadPairTaskAction $token Candidate;if($script:setCalls-ne1){throw 'SECOND_SET_AFTER_ACK_LOSS'}
 foreach($name in @('task.before.xml.dpapi','task.before.sddl.dpapi')){if(![IO.File]::Exists((Join-Path $ctx.vault $name))){throw 'TASK_DURABLE_BEFOREIMAGE_MISSING'}}
 $saved=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $ctx.vault 'task.before.xml.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);if([Text.Encoding]::UTF8.GetString($saved)-cne$original){throw 'TASK_BEFOREIMAGE_NOT_ORIGINAL'}
 $script:nativePhase='Restored';Set-Test125ReadPairTaskAction $token Current;Set-Test125ReadPairTaskAction $token Current
 if($script:setCalls-ne2-or(Get-Test125TaskXmlSignature $script:taskXml)-cne$beforeSignature-or$ctx.taskAction.unknown-or$ctx.taskAction.mode-cne'Current'){throw 'TASK_ACTION_INVERSE'};'PASS'`),'PASS');
});
win('B6 task Action unchanged after failed Set is not retried and permits only native inverse plus original launcher recovery',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $before=Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup));$script:setMode='before-fail';$denied=$false
 try{Invoke-Test125ReadPairApiTransition $token Candidate|Out-Null}catch{if($_.Exception.Message-cne'B6_TASK_ACTION_NOT_APPLIED'){throw};$denied=$true}
 if(!$denied-or$script:setCalls-ne1-or$ctx.taskAction.unknown-or$ctx.taskAction.mode-cne'Current'-or$ctx.phase-cne'FAILED'-or$ctx.changed-or$ctx.apiChanged-or$script:events.Contains('resume')){throw 'UNCHANGED_TASK_NOT_CLOSED'}
 $denied=$false;try{Set-Test125ReadPairTaskAction $token Candidate}catch{if($_.Exception.Message-cne'B6_TASK_ACTION_ALREADY_ATTEMPTED'){throw};$denied=$true};if(!$denied-or$script:setCalls-ne1){throw 'TASK_SET_RETRIED'}
 Invoke-Test125ReadPairApiTransition $token Rollback|Out-Null
 if($script:nativePhase-cne'Restored'-or$ctx.mode-cne'Current'-or$script:setCalls-ne1-or@($script:events|Where-Object{$_-ceq'resume'}).Count-ne1-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne$before){throw 'UNCHANGED_TASK_RECOVERY_FAILED'};'PASS'`),'PASS');
});
win('B6 unknown task XML after the one supported Set blocks inverse, profile restore, start and any second task mutation',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $before=Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup));$apiBefore=Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi));$script:setMode='unknown';$denied=$false
 try{Invoke-Test125ReadPairApiTransition $token Candidate|Out-Null}catch{if($_.Exception.Message-cne'B6_TASK_ACTION_OUTCOME_UNKNOWN'){throw};$denied=$true}
 if(!$denied-or!$ctx.taskAction.unknown-or$script:setCalls-ne1-or$ctx.phase-cne'FAILED'-or!$ctx.activeBinding.held-or!$ctx.taskStopped-or$script:nativePhase-cne'Applied'){throw 'UNKNOWN_TASK_NOT_CLOSED'}
 foreach($command in @('transition','action')){$denied=$false;try{if($command-ceq'transition'){Invoke-Test125ReadPairApiTransition $token Rollback|Out-Null}else{Set-Test125ReadPairTaskAction $token Current}}catch{if($_.Exception.Message-cne'B6_TASK_ACTION_OUTCOME_UNKNOWN'){throw};$denied=$true};if(!$denied){throw 'UNKNOWN_TASK_REOPENED'}}
 if($script:setCalls-ne1-or$script:events.Contains('native-Inverse')-or$script:events.Contains('resume')-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureStartup)))-cne$before-or(Get-Test125ReadPairHash ([IO.File]::ReadAllBytes($fixtureApi)))-cne$apiBefore){throw 'UNKNOWN_TASK_SECOND_EFFECT'};'PASS'`),'PASS');
});
win('B6 task Action refuses a live supervisor, changed SDDL, lost lease or wrong native phase before its supported write',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $script:nativePhase='Applied';$savedSddl=$script:taskSddl
 foreach($case in @('native','sddl','instances','lease','binding','thread','xml')){
  switch($case){'native'{$script:nativePhase='Prepared'}'sddl'{$script:taskSddl+='D:'}'instances'{$script:taskInstances=1}'lease'{$ctx.activeBinding.held=$false}'binding'{$script:Test125ApiBinding=[pscustomobject]@{held=$true;stopped=$true}}'thread'{$ctx.thread++}'xml'{$script:taskXml+=' '}}
  $denied=$false;try{Set-Test125ReadPairTaskAction $token Candidate}catch{$denied=$true};if(!$denied-or$script:setCalls){throw ('TASK_WRITE_GUARD_'+$case)}
  switch($case){'native'{$script:nativePhase='Applied'}'sddl'{$script:taskSddl=$savedSddl}'instances'{$script:taskInstances=0}'lease'{$ctx.activeBinding.held=$true}'binding'{$script:Test125ApiBinding=$ctx.activeBinding}'thread'{$ctx.thread--}'xml'{$script:taskXml=$ctx.taskAction.beforeXml}}
 };'PASS'`),'PASS');
});
win('B6 stopped-supervisor launcher is bound to the retained API generation instead of the next task Action',()=>{
 assert.equal(runB6(b6PausedFixture+String.raw`
 $old='C:\Sirket\ERP\melisa-erp-v2\scripts\canonical\start-owned-test.ps1';$next='C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION\start-owned-test.ps1'
 if((Get-Test125ReadPairBindingLauncher $ctx.activeBinding)-cne$old){throw 'CURRENT_API_LAUNCHER'}
 $script:nativePhase='Applied';Set-Test125ReadPairTaskAction $token Candidate
 if((Get-Test125ReadPairBindingLauncher $ctx.activeBinding)-cne$old){throw 'FUTURE_ACTION_REBOUND_OLD_API'}
 $ctx.activeBinding.config=$ctx.activeBinding.config|ConvertTo-Json -Depth 20|ConvertFrom-Json;$ctx.activeBinding.config.ApiComponent=$scope.candidate
 if((Get-Test125ReadPairBindingLauncher $ctx.activeBinding)-cne$next){throw 'CANDIDATE_API_LAUNCHER'}
 foreach($case in @('copy-binding','copy-proof','foreign-component')){
  $bindingArg=$ctx.activeBinding;$savedProof=$bindingArg.releaseProof;$savedPart=$bindingArg.config.ApiComponent
  switch($case){'copy-binding'{$bindingArg=$bindingArg|ConvertTo-Json -Depth 20|ConvertFrom-Json}'copy-proof'{$bindingArg.releaseProof=$release|ConvertTo-Json|ConvertFrom-Json}'foreign-component'{$bindingArg.config.ApiComponent=$scope.current.PSObject.Copy();$bindingArg.config.ApiComponent.ReleaseRoot='C:\foreign'}}
  $denied=$false;try{Get-Test125ReadPairBindingLauncher $bindingArg|Out-Null}catch{$denied=$true};if(!$denied){throw ('LAUNCHER_BINDING_DRIFT_'+$case)}
  $ctx.activeBinding.releaseProof=$savedProof;$ctx.activeBinding.config.ApiComponent=$savedPart
 }
 $script:nativePhase='Unknown';if((Get-Test125ReadPairBindingLauncher $ctx.activeBinding)-cne$next){throw 'READONLY_NATIVE_AUDIT_UNAVAILABLE'}
 $denied=$false;try{Set-Test125ReadPairTaskAction $token Current}catch{$denied=$true};if(!$denied-or$script:setCalls-ne1){throw 'READONLY_LAUNCHER_GRANTED_MUTATION'};'PASS'`),'PASS');
});
win('B6 fixture canonicalizes aliased temp roots while hash and ACL adapters still refuse every outside-root path',()=>{
 const parent=realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),root=realpathSync.native(mkdtempSync(path.join(parent,'melisa-b6-fixture-root-')));
 try{
  const physical=path.join(root,'physical'),redirect=path.join(root,'redirect');mkdirSync(physical);symlinkSync(physical,redirect,'junction');assert.equal(realpathSync.native(redirect),realpathSync.native(physical));
  assert.equal(runB6(String.raw`
   if($fixtureRoot-clike'*\redirect\*'){throw 'FIXTURE_ROOT_NOT_CANONICAL'}
   $token=New-Test125ReadPairTransition -ScopeName $scope.name -NativeProfileAdmission $native;[void](Assert-Test125ReadPairIssued $token)
   foreach($command in @('Get-FileHash','Get-Acl')){foreach($outside in @('C:\Windows\System32\cmd.exe',($fixtureRoot+'-sibling\file'),(Join-Path $fixtureRoot '..\outside'))){$denied=$false;try{if($command-ceq'Get-FileHash'){Get-FileHash -LiteralPath $outside -Algorithm SHA256|Out-Null}else{Get-Acl -LiteralPath $outside|Out-Null}}catch{if($_.Exception.Message-cnotin@('FIXTURE_HASH_OUTSIDE_TEMP','FIXTURE_ACL_OUTSIDE_TEMP')){throw};$denied=$true};if(!$denied){throw 'FIXTURE_OUTSIDE_ROOT_ADMITTED'}}}
   if($script:releaseClosed){throw 'CANONICAL_ROOT_ISSUER_FAILED'};'PASS'`,{tempRoot:redirect}),'PASS');
 }finally{const full=realpathSync.native(root);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('melisa-b6-fixture-root-'));assert(!lstatSync(full).isSymbolicLink());rmSync(full,{recursive:true,force:true});}
});
