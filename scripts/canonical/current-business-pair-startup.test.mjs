import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {STARTUP_FILES,BEFORE_FILES,makeStartupBundle,assertStartupCi,readStartupCi,passiveProjectionScript} from './prepare-current-business-pair-startup.mjs';
const dir=import.meta.dirname,q=s=>"'"+s.replaceAll("'","''")+"'";
const source=readFileSync(path.join(dir,'current-business-pair-startup.ps1'),'utf8');
const entry=readFileSync(path.join(dir,'start-current-business-pair.ps1'),'utf8');
const fixture=String.raw`
$i=Get-ErpCurrentPairIdentity
$root='C:\Sirket\ERP\releases\ERP-CURRENT-PAIR-STARTUP-SOURCE-'+('a'*40);$sourceHash='b'*64
$cfg=[pscustomobject][ordered]@{RepoRoot='C:\Sirket\ERP\melisa-erp-v2';ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778';ConfigPath='C:\fixture\base-private.json';RuntimeDir='C:\Sirket\ERP\runtime\canonical-test';LogDir='C:\fixture\logs';NodePath='C:\Program Files\nodejs\node.exe';NodeSha256='3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5';OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;SourceCommit=$i.legacySource;ManifestSha256='0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64';ExpectedDatabase=$i.database;TaskName='Melisa-ERP-TEST-Canonical';ApiComponent=[pscustomobject][ordered]@{ReleaseRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-READ-VERIFIED-20261030';SourceCommit=$i.legacySource;ManifestSha256='afdb66b5c3450459778630d27bd1ff409ecb80c8ad53058fa048cf3e8e28085c';ConfigPath='C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'}}
$before=$cfg|ConvertTo-Json -Depth 100 -Compress
$xml='<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><RegistrationInfo><URI>\Melisa-ERP-TEST-Canonical</URI></RegistrationInfo><Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers><Principals><Principal id="Author"><UserId>fixture-owner</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><ExecutionTimeLimit>PT0S</ExecutionTimeLimit></Settings><Actions Context="Author"><Exec><Command>C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe</Command><Arguments>old immutable entry</Arguments><WorkingDirectory>C:\Windows\System32</WorkingDirectory></Exec></Actions></Task>'
$sddl='D:P(A;;GRGX;;;BA)'
function NewPlan {New-ErpCurrentPairProjection -BeforeConfig $before -BeforeTask $xml -BeforeSddl $sddl -ExpectedConfigHash (Get-ErpCurrentPairTextHash $before) -ExpectedTaskHash (Get-ErpCurrentPairTextHash $xml) -BundleRoot $root -SourceManifestHash $sourceHash -PlanPath (Join-Path $root 'startup-plan.json')}
function Reject([scriptblock]$Action,[string]$Code){$rejected=$false;try{&$Action|Out-Null}catch{if($_.Exception.Message-notlike$Code){throw};$rejected=$true};if(!$rejected){throw ('EXPECTED_REJECTION_'+$Code)}}
function RegisterFixtureBinding($Plan){
 $config=$Plan.afterConfig|ConvertFrom-Json;$token=[pscustomobject]@{caseId=$i.caseId;sourceManifestHash=$sourceHash}
 $planText=$Plan|ConvertTo-Json -Depth 100 -Compress
 $script:ErpCurrentPairBindings.Add(@{token=$token;tokenText=($token|ConvertTo-Json -Compress);config=$config;configText=$Plan.afterConfig;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;closed=$false;plan=($planText|ConvertFrom-Json);planText=$planText;root=$root;sourceHash=$sourceHash});return $token
}
`;
function run(body){
 const temp=mkdtempSync(path.join(os.tmpdir(),'erp-pair-source-'));
 try{
  const file=path.join(temp,'test.ps1');
  writeFileSync(file,"$ErrorActionPreference='Stop'\n. "+q(path.join(dir,'start-owned-test.ps1'))+" -Library\n. "+q(path.join(dir,'start-business-5244-owned.ps1'))+" -Library\n. "+q(path.join(dir,'current-business-pair-startup.ps1'))+"\n. "+q(path.join(dir,'start-current-business-pair.ps1'))+" -Library\n"+fixture+'\n'+body+"\n'PASS'\n");
  const env={...process.env};delete env.PSModulePath;
  return cp.execFileSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',file],{env,encoding:'utf8',timeout:120000}).trim();
 }finally{rmSync(temp,{recursive:true,force:true});}
}
const win=(name,body)=>test(name,{skip:process.platform!=='win32'},()=>assert.equal(run(body),'PASS'));
test('current normal entry consumes real libraries after full held hash closure, not the legacy three-service loop',()=>{
 assert.ok(entry.indexOf('Read-ErpCurrentPairSources $PSScriptRoot')<entry.indexOf(". (Join-Path $PSScriptRoot 'start-owned-test.ps1')"));
 assert.match(entry,/Invoke-ErpCurrentPairSession \$binding/);
 assert.doesNotMatch(source,/Invoke-ErpOwnedSession|Stop-Process|Register-ScheduledTask|Set-ScheduledTask|EncodedCommand|ExecutionPolicy|taskkill|handle64|Set-Acl/);
 assert.match(source,/New-Business5244PinnedChild \$pins \$lease -NormalPairBinding \$Binding/);
 assert.match(source,/Assert-ErpRelease \(Get-ErpApiComponentConfig \$config\) -RetainedSeal \$seal/);
 assert.match(source,/Assert-Business5244OwnedPackage \$pins \$seal -NormalPairBinding \$Binding/);
});
win('real projection changes exactly two API fields and task Arguments; preserves all other task/profile/legacy values',String.raw`
$plan=NewPlan
Assert-ErpCurrentPairProjection $plan $plan.afterConfig $plan.afterTask $sddl $root $sourceHash
$after=$plan.afterConfig|ConvertFrom-Json
if($after.ApiComponent.ReleaseRoot-cne$i.componentRoot-or$after.ApiComponent.ManifestSha256-cne$i.digests[0]){throw 'PAIR_NOT_CONSUMED'}
$after.ApiComponent.ReleaseRoot=$cfg.ApiComponent.ReleaseRoot;$after.ApiComponent.ManifestSha256=$cfg.ApiComponent.ManifestSha256
if(($after|ConvertTo-Json -Depth 100 -Compress)-cne$before){throw 'EXTRA_CONFIG_DELTA'}
$task=ConvertFrom-ErpCurrentPairTaskXml $plan.afterTask;(Get-ErpCurrentPairTaskExec $task).InnerText='old immutable entry'
if($task.OuterXml-cne$xml){throw 'EXTRA_TASK_DELTA'}
if($plan.arguments-notlike('*-File "'+$root+'\start-current-business-pair.ps1"*')-or$plan.arguments-notlike('*-SourceManifestHash '+$sourceHash+'*')){throw 'ENTRY_NOT_BOUND'}
$xml=$xml.Replace('C:\Windows\System32\WindowsPowerShell','C:\WINDOWS\System32\WindowsPowerShell');$upper=NewPlan
if($upper.afterTask-notlike'*<Command>C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe</Command>*'){throw 'TASK_EXECUTABLE_REWRITTEN'}
$upperNode=$before|ConvertFrom-Json;$upperNode.NodeSha256=$upperNode.NodeSha256.ToUpperInvariant();$before=$upperNode|ConvertTo-Json -Depth 100 -Compress;$upper=NewPlan
if(($upper.afterConfig|ConvertFrom-Json).NodeSha256-cne$upperNode.NodeSha256){throw 'LEGACY_NODE_PIN_REWRITTEN'}
`);
win('projection rejects stale CAS, wrong DB/legacy source/node/profile/base/candidate/task executable/extra task actions',String.raw`
$saved=$before
foreach($field in @('ExpectedDatabase','SourceCommit','NodePath','NodeSha256','ReleaseRoot','TaskName')){$bad=$saved|ConvertFrom-Json;$bad.$field='WRONG';$before=$bad|ConvertTo-Json -Depth 100 -Compress;Reject {NewPlan} 'CURRENT_PAIR_BASE_SCOPE'}
foreach($field in @('SourceCommit','ConfigPath')){$bad=$saved|ConvertFrom-Json;$bad.ApiComponent.$field='WRONG';$before=$bad|ConvertTo-Json -Depth 100 -Compress;Reject {NewPlan} 'CURRENT_PAIR_BASE_SCOPE'}
$bad=$saved|ConvertFrom-Json;$bad.ApiComponent.ReleaseRoot=$i.componentRoot;$before=$bad|ConvertTo-Json -Depth 100 -Compress;Reject {NewPlan} 'CURRENT_PAIR_BEFORE_COMPONENT';$before=$saved
Reject {New-ErpCurrentPairProjection $before $xml $sddl ('0'*64) (Get-ErpCurrentPairTextHash $xml) $root $sourceHash (Join-Path $root 'startup-plan.json')} 'CURRENT_PAIR_BEFORE_CAS'
$savedXml=$xml;$xml=$xml.Replace('powershell.exe','cmd.exe');Reject {NewPlan} 'CURRENT_PAIR_TASK_EXECUTABLE';$xml=$savedXml.Replace('</Actions>','<ComHandler /></Actions>');Reject {NewPlan} 'CURRENT_PAIR_TASK_ACTIONS';$xml=$savedXml
Reject {ConvertFrom-ErpCurrentPairTaskXml '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///secret">]><Task />'} '*'
`);
win('actual task reader requests owner/group/DACL matching the preserved full descriptor; no SACL or write',String.raw`
$script:descriptorFlags=$null;$script:requestedTask=$null;$script:requestedFolder=$null
$script:fakeTask=[pscustomobject]@{Xml=$xml}
$script:fakeTask|Add-Member ScriptMethod GetSecurityDescriptor {param($Flags);$script:descriptorFlags=$Flags;return 'O:fixture-ownerG:fixture-groupD:P(A;;GRGX;;;BA)'}
$script:fakeFolder=[pscustomobject]@{}
$script:fakeFolder|Add-Member ScriptMethod GetTask {param($Name);$script:requestedTask=$Name;return $script:fakeTask}
$script:fakeService=[pscustomobject]@{}
$script:fakeService|Add-Member ScriptMethod Connect {}
$script:fakeService|Add-Member ScriptMethod GetFolder {param($Path);$script:requestedFolder=$Path;return $script:fakeFolder}
function New-Object {param($ComObject);if($ComObject-cne'Schedule.Service'){throw 'FOREIGN_COM'};return $script:fakeService}
$value=Read-ErpCurrentPairTask
if($script:descriptorFlags-ne7-or$script:requestedTask-cne'Melisa-ERP-TEST-Canonical'-or$script:requestedFolder-cne'\'-or$value.xml-cne$xml-or$value.sddl-cne'O:fixture-ownerG:fixture-groupD:P(A;;GRGX;;;BA)'){throw 'TASK_READER_BEFOREIMAGE_SCOPE_MISMATCH'}
`);
win('actual projection consumer rejects extra delta, task/principal/settings/credential/SDDL drift, wrong manifest/root and forged plan',String.raw`
$plan=NewPlan
foreach($target in @('config','principal','trigger','settings','runlevel','workingdir','credential','sddl','hash','root','plan')){
 $c=$plan.afterConfig;$t=$plan.afterTask;$s=$sddl;$r=$root;$h=$sourceHash;$p=$plan|ConvertTo-Json -Depth 100|ConvertFrom-Json
 switch($target){config {$c=$c.Replace('C:\\fixture\\logs','C:\\elsewhere')} principal {$t=$t.Replace('fixture-owner','other')} trigger {$t=$t.Replace('<Enabled>true','<Enabled>false')} settings {$t=$t.Replace('IgnoreNew','Parallel')} runlevel {$t=$t.Replace('LeastPrivilege','HighestAvailable')} workingdir {$t=$t.Replace('<WorkingDirectory>C:\Windows','<WorkingDirectory>C:\Other')} credential {$t=$t.Replace('InteractiveToken','Password')} sddl {$s+='x'} hash {$h='c'*64} root {$r+='-other'} plan {$p.changedConfigFields+=@('ConfigPath')}}
 Reject {Assert-ErpCurrentPairProjection $p $c $t $s $r $h} 'CURRENT_PAIR_*'
}
Reject {Get-ErpCurrentPairBoundPins ([pscustomobject]@{caseId=$i.caseId;sourceManifestHash=$sourceHash})} 'CURRENT_PAIR_BINDING_REQUIRED'
$b=RegisterFixtureBinding $plan;$pins=Get-ErpCurrentPairBoundPins $b
if($pins.apiManifest-cne$i.digests[0]-or$pins.manifest-cne$i.digests[1]-or$pins.baseSource-cne$i.legacySource-or$pins.frontendSource-cne$i.frontendSource){throw 'LEGACY_APP_SOURCE_MIXED'}
$b.caseId='forged';Reject {Get-ErpCurrentPairBoundPins $b} 'CURRENT_PAIR_BINDING_CHANGED'
$plan=NewPlan;$b=RegisterFixtureBinding $plan;$plan.beforeSddl='changed-by-caller';[void](Get-ErpCurrentPairBoundPins $b)
$record=Get-ErpCurrentPairBinding $b
if($record.plan.beforeSddl-cne$sddl){throw 'CALLER_MUTATED_HELD_BEFORE_IMAGE'}
$record.plan.beforeSddl='changed-in-registry';Reject {Get-ErpCurrentPairBoundPins $b} 'CURRENT_PAIR_BINDING_CHANGED'
`);
win('owned package actual consumer rejects foreign tuple before payload IO; no default-case widening',String.raw`
$plan=NewPlan;$b=RegisterFixtureBinding $plan;$pins=Get-ErpCurrentPairBoundPins $b
foreach($key in @('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')){$wrong=$pins.Clone();$wrong[$key]='wrong';Reject {Assert-Business5244OwnedPackage $wrong -NormalPairBinding $b} 'OWNED_WEB_PIN_CHANGED'}
Reject {Assert-Business5244OwnedPackage $pins -NormalPairBinding ([pscustomobject]@{})} 'CURRENT_PAIR_BINDING_REQUIRED'
Reject {Assert-Business5244OwnedPackage $pins} 'OWNED_WEB_PIN_CHANGED'
`);
win('current repaired profile is byte pinned and still uses original Writer and base-profile comparators',String.raw`
$plan=NewPlan;$b=RegisterFixtureBinding $plan
$script:profileCalls=0
function Read-ErpBusinessSalePinnedFile($Path,$Hash){if($Path-cne'C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'-or$Hash-cne'74d72c0c2ce685f126ae941249c69a1168bf90e7dbbf45269639e19ef466c7c3'){throw 'PROFILE_PIN_CHANGED'};return ,[Text.Encoding]::UTF8.GetBytes(($script:profile|ConvertTo-Json -Depth 100 -Compress))}
function Assert-ErpBusinessSaleWriterProfileFields($Api,$Manifest){$script:profileCalls++;if($Api.businessSaleWritesEnabled-ne$true-or$Manifest.packageId-cne'fixed-writer'){throw 'WRITER_FIELDS_FAILED'}}
$base=[pscustomobject][ordered]@{database='TEST';jwtAccessSecret='fixture-secret';goal8SyntheticDaySeal=[pscustomobject]@{sourceCommit='source';dayId='day';definitionHash='definition';packageId='base'}}
$script:profile=$base|ConvertTo-Json -Depth 100|ConvertFrom-Json;$script:profile.goal8SyntheticDaySeal.packageId='fixed-writer';$script:profile|Add-Member businessWorkface ([pscustomobject]@{id='fixture'});$script:profile|Add-Member businessSessionAccessSecret 'separate-fixture';$script:profile|Add-Member businessSaleAdmission ([pscustomobject]@{fixed='original-metadata'});$script:profile|Add-Member businessSaleWritesEnabled $true
$m=[pscustomobject]@{packageId='fixed-writer'};Assert-ErpApiPrivateProfile $base $script:profile $m -NormalPairBinding $b
if($script:profileCalls-ne1){throw 'WRITER_CHECK_NOT_USED'}
$bad=$script:profile|ConvertTo-Json -Depth 100|ConvertFrom-Json;$bad.database='LIVE';Reject {Assert-ErpApiPrivateProfile $base $bad $m -NormalPairBinding $b} 'CURRENT_PAIR_PROFILE_CHANGED'
$script:profile.database='OTHER';Reject {Assert-ErpApiPrivateProfile $base $script:profile $m -NormalPairBinding $b} 'TEST_STARTUP_COMPONENT_PROFILE_DELTA_REJECTED'
`);
win('actual source closure verifies every held file before import and rejects hash, missing, duplicate and path tampering',String.raw`
$entrySource=[IO.File]::ReadAllText((${q(path.join(dir,'start-current-business-pair.ps1'))}))
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($entrySource,[ref]$tokens,[ref]$errors)
$fn=$ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Read-ErpCurrentPairSources'},$true)[0]
$array=$fn.FindAll({param($n)$n-is[Management.Automation.Language.AssignmentStatementAst]-and$n.Left.Extent.Text-ceq'$names'},$true)[0]
$names=Invoke-Expression $array.Right.Extent.Text
$script:files=@{};$rows=@();foreach($name in $names){$script:files[$name]='# held fixture '+$name;$rows+=@{path=$name;sha256=(Get-ErpCurrentPairTextHash $script:files[$name]);bytes=[Text.Encoding]::UTF8.GetByteCount($script:files[$name])}}
$manifest=[pscustomobject]@{schema='melisa-current-pair-startup-source.v1';root=$root;sourceCommit=('a'*40);applicationProducer=$i.producerSource;installed=$false;executionAuthority=$false;files=$rows}
$script:files['startup-source-manifest.json']=$manifest|ConvertTo-Json -Depth 10 -Compress
function Open-ErpCurrentPairSourceFile($Root,$Leaf){if(!$script:files.ContainsKey($Leaf)){throw 'FIXTURE_FILE_MISSING'};return ,([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($script:files[$Leaf])))}
$hash=Get-ErpCurrentPairTextHash $script:files['startup-source-manifest.json']
$held=Read-ErpCurrentPairSources $root $hash;if($held.holds.Count-ne16){throw 'CLOSURE_NOT_HELD'};foreach($h in $held.holds){$h.Dispose()}
$first=$names[0];$save=$script:files[$first];$script:files[$first]+=' changed';Reject {Read-ErpCurrentPairSources $root $hash} 'CURRENT_PAIR_SOURCE_CHANGED';$script:files[$first]=$save
Reject {Read-ErpCurrentPairSources $root ('0'*64)} 'CURRENT_PAIR_SOURCE_MANIFEST_HASH'
$saveManifest=$script:files['startup-source-manifest.json']
foreach($kind in @('duplicate','escape','missing')){$bad=$manifest|ConvertTo-Json -Depth 10|ConvertFrom-Json;if($kind-eq'duplicate'){$bad.files[1]=$bad.files[0]}elseif($kind-eq'escape'){$bad.files[0].path='../escape.ps1'}else{$bad.files=@($bad.files|Select-Object -Skip 1)};$script:files['startup-source-manifest.json']=$bad|ConvertTo-Json -Depth 10 -Compress;Reject {Read-ErpCurrentPairSources $root (Get-ErpCurrentPairTextHash $script:files['startup-source-manifest.json'])} 'CURRENT_PAIR_SOURCE_*'}
$script:files['startup-source-manifest.json']=$saveManifest
`);
const osFixture=String.raw`
# Only OS boundaries are injected. Actual pair session, API definition,
# registered configuration binding, WEB consumer and order remain production.
Add-Type @'
using System;
public sealed class Business5244PackageSeal:IDisposable { public static bool FailDispose=false; public void Add(string p,string h){} public void Freeze(){} public void Validate(){} public void Dispose(){if(FailDispose)throw new Exception("FIXTURE_SEAL_DISPOSE");} }
public sealed class Business5244WebNative:IDisposable { public int ChildPid=9012; public string ChildBirth="fixture"; public bool Alive=true; public bool ChildAlive(){return Alive;} public void Validate(){} public void Spawn(string exe,string args,string cwd){} public void Dispose(){Alive=false;} }
public static class MutexProbe { public static bool Try(string name){ bool acquired=false; var thread=new System.Threading.Thread(()=>{using(var m=new System.Threading.Mutex(false,name)){acquired=m.WaitOne(100);if(acquired)m.ReleaseMutex();}});thread.Start();thread.Join();return acquired;} }
public sealed class ThrowingDiagnostic: System.IO.StringWriter { public override void WriteLine(string s){throw new System.IO.IOException("FIXTURE_CLOSED_STDERR");} }
'@
$script:trace=[Collections.Generic.List[string]]::new();$script:started=$false;$script:foreignPort=$false;$script:busy=$false;$script:claim=$false;$script:mutateAfterSeal=$false
$script:mutexName='Local\ERP-OFFLINE-PAIR-'+[guid]::NewGuid().ToString('N')
function Get-ErpMutexName {$script:mutexName}
function Enter-Business5244StartupLease {param($Kind);if($script:busy){throw 'BUSINESS_5244_STARTUP_BUSY'};if($script:claim){throw 'BUSINESS_5244_RETIREMENT_RECOVERY_REQUIRED'};return [pscustomobject]@{fixture='lease'}}
function Assert-Business5244StartupLease {param($Lease,$Kind)}
function Get-Business5244StartupRecord {param($Lease);return $script:leaseRecord}
function Exit-Business5244StartupLease {param($Lease);$script:trace.Add('lease-close')}
function Assert-ErpCurrentPairLiveBinding {param($Binding);[void](Get-ErpCurrentPairBinding $Binding);if($script:mutateAfterSeal-and$script:trace.Contains('seal-web')){throw 'CURRENT_PAIR_PROJECTION_CHANGED'}}
function Get-ErpServiceListeners {param($Definition,$Config);if($Definition.Port-ne4144){throw 'PROTECTED_PORT_ACCESSED'};if($script:foreignPort){return [pscustomobject]@{OwningProcess=666;LocalPort=4144;LocalAddress='127.0.0.1'}};if($script:started){return [pscustomobject]@{OwningProcess=9011;LocalPort=4144;LocalAddress='127.0.0.1'}}}
function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction);if($LocalPort-and$LocalPort-ne5244){throw 'OTHER_PORT_ACCESSED'};if($script:trace.Contains('web-created')){foreach($a in @('100.87.188.3','127.0.0.1','192.168.1.46')){[pscustomobject]@{OwningProcess=9012;LocalPort=5244;LocalAddress=$a}}}}
function Initialize-Business5244WebNative {}
function Assert-ErpRelease {param($Config,$RetainedSeal);if($Config.ReleaseRoot-cne$i.componentRoot){throw 'WRONG_API_PACKAGE'};$script:trace.Add('seal-api')}
function Assert-Business5244OwnedPackage {param($Pins,$Seal,$NormalPairBinding);$exact=Get-ErpCurrentPairBoundPins $NormalPairBinding;if($Pins.root-cne$exact.root-or$Pins.apiManifest-cne$exact.apiManifest){throw 'WRONG_PAIR'};if($Seal){$script:trace.Add('seal-web')}else{$script:trace.Add('web-package')}}
function Start-Process {param($FilePath,$ArgumentList,$WorkingDirectory,$WindowStyle,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
 if($FilePath-cne$cfg.NodePath-or$ArgumentList[0]-cne('"'+$i.componentRoot+'\apps\api\start-canonical-test.mjs"')-or$ArgumentList[1]-cne'"erp"'-or$ArgumentList[2]-cne('"'+$cfg.ApiComponent.ConfigPath+'"')-or$WindowStyle-cne'Hidden'){throw 'WRONG_START_COMMAND'}
 $script:trace.Add('start-api');$script:started=$true
 $child=[pscustomobject]@{Id=9011;StartTime=[datetime]'2026-11-03T12:00:00Z';HasExited=$false;Handle=[IntPtr]123}
 $child|Add-Member ScriptMethod Kill {$script:trace.Add('api-kill');$this.HasExited=$true}
 $child|Add-Member ScriptMethod WaitForExit {param($Milliseconds);return $true}
 $child|Add-Member ScriptMethod Dispose {};return $child
}
function Assert-ErpOwnedProcess {param($ProcessId,$Config,$Definition,$CreatedAt);if($ProcessId-ne9011-or$Definition.Port-ne4144){throw 'OTHER_PROCESS_ACCESSED'};return [pscustomobject]@{CreationDate=[datetime]'2026-11-03T12:00:00Z'}}
function Assert-ErpHealth {param($Config,$Definition);$script:trace.Add('api-ready');return [pscustomobject]@{ok=$true}}
function Assert-Business5244ApiHealth {param($Health,$Pins)}
function Invoke-RestMethod {param($Uri,$TimeoutSec);if($Uri-cne'http://127.0.0.1:4144/test-health'){throw 'FOREIGN_HTTP'};return [pscustomobject]@{ok=$true}}
function Assert-Business5244CreatedChild {param($Native,$Pins);$script:trace.Add('web-created')}
function Close-Business5244PinnedChildren {param($Lease);foreach($child in $script:leaseRecord.ownedNatives){$child.Dispose()};$script:trace.Add('web-close')}
function Start-Sleep {param($Milliseconds,$Seconds);throw 'FIXTURE_UNEXPECTED_WAIT'}
$script:leaseRecord=@{ownedNatives=[Collections.Generic.List[object]]::new()}
`;
win('actual session starts only API4144 then real WEB consumer5244 and validates refresh; closes only own children',osFixture+String.raw`
$plan=NewPlan;$b=RegisterFixtureBinding $plan;$result=Invoke-ErpCurrentPairSession $b -SinglePass
if(($result.startedPorts-join',')-cne'4144,5244'-or$result.metadata-cne'UNKNOWN'-or$result.masterwriter){throw 'UNPROVEN_ACCEPTANCE'}
$trace=$script:trace-join','
if($trace-notlike'*seal-api,seal-web,start-api,api-ready,web-package,web-created*'-or$trace-notlike'*web-close,api-kill,lease-close'){throw ('WRONG_ORDER_'+$trace)}
Reject {Get-ErpCurrentPairBoundPins $b} 'CURRENT_PAIR_BINDING_CHANGED'
`);
win('actual session rejects busy owner, pending claim, occupied port and CAS drift before spawn without adoption/restart',osFixture+String.raw`
foreach($kind in @('busy','claim','port','cas')){
 $script:trace.Clear();$script:busy=$kind-eq'busy';$script:claim=$kind-eq'claim';$script:foreignPort=$kind-eq'port';$script:mutateAfterSeal=$kind-eq'cas';$script:leaseRecord=@{ownedNatives=[Collections.Generic.List[object]]::new()}
 $plan=NewPlan;$b=RegisterFixtureBinding $plan
 Reject {Invoke-ErpCurrentPairSession $b -SinglePass} '*'
 if($script:trace.Contains('start-api')-or$script:trace.Contains('web-package')){throw 'REJECTION_STARTED_CHILD'}
}
`);
win('actual lifecycle independently releases canonical mutex and closes binding after seal/lease cleanup failure; preserves primary rejection',osFixture+String.raw`
[Business5244PackageSeal]::FailDispose=$true
function Exit-Business5244StartupLease {param($Lease);$script:trace.Add('lease-close-attempt');throw 'FIXTURE_EXIT_LEASE_FAILED'}
$plan=NewPlan;$b=RegisterFixtureBinding $plan
Reject {Invoke-ErpCurrentPairSession $b -SinglePass} 'CURRENT_PAIR_CLEANUP_UNCONFIRMED'
if(!$script:trace.Contains('api-kill')-or!$script:trace.Contains('lease-close-attempt')-or![MutexProbe]::Try($script:mutexName)){throw 'INDEPENDENT_CLEANUP_SKIPPED'}
Reject {Get-ErpCurrentPairBoundPins $b} 'CURRENT_PAIR_BINDING_CHANGED'
$script:trace.Clear();$script:started=$false;$script:mutateAfterSeal=$true
$plan=NewPlan;$b=RegisterFixtureBinding $plan
$stderr=[Console]::Error
try{[Console]::SetError([ThrowingDiagnostic]::new());Reject {Invoke-ErpCurrentPairSession $b -SinglePass} 'CURRENT_PAIR_PROJECTION_CHANGED'}finally{[Console]::SetError($stderr)}
if(![MutexProbe]::Try($script:mutexName)){throw 'PRIMARY_ERROR_LEFT_MUTEX'}
`);
test('passive startup bundle uses exact Git closure and immutable before images; application pair is not rebuilt',()=>{
 const snapshot=new Map(BEFORE_FILES.map(f=>[f,Buffer.from('immutable '+f)]));
 const bundle=makeStartupBundle({commit:'a'.repeat(40),readGit:f=>Buffer.from('git-only:'+f),before:snapshot});
 assert.equal(bundle.files.size,16);assert.equal(bundle.manifest.files.length,15);
 for(const leaf of STARTUP_FILES)assert.equal(bundle.files.get(leaf).toString(),'git-only:scripts/canonical/'+leaf);
 snapshot.get(BEFORE_FILES[0])[0]=0;assert.equal(bundle.files.get(BEFORE_FILES[0]).toString(),'immutable '+BEFORE_FILES[0]);
 assert.equal(bundle.manifestHash,crypto.createHash('sha256').update(bundle.files.get('startup-source-manifest.json')).digest('hex'));
 assert.equal(bundle.manifest.installed,false);assert.equal(bundle.manifest.executionAuthority,false);
 const prep=passiveProjectionScript();assert.ok(prep.indexOf('Get-FileHash')<prep.indexOf('. $entry -Library'));assert.ok(prep.indexOf('Read-ErpCurrentPairSources')<prep.indexOf(". (Join-Path $Root 'current-business-pair-startup.ps1')"));assert.doesNotMatch(prep,/Invoke-ErpCurrentPairSession|Read-ErpStartupConfig|Read-ErpCurrentPairTask|Invoke-RestMethod|Start-Process/);
 assert.throws(()=>makeStartupBundle({commit:'bad',readGit:()=>Buffer.from('x'),before:snapshot}),/COMMIT/);
 assert.throws(()=>makeStartupBundle({commit:'a'.repeat(40),readGit:()=>Buffer.from('x'),before:new Map()}),/BEFORE_IMAGES/);
});
test('passive producer requires two exact-head complete CI runs including all jobs and steps; no earlier head or partial green',()=>{
 const commit='a'.repeat(40),make=()=>['push','pull_request'].map((event,index)=>({id:index+1,repository:'melihsnyldzz-ui/melisa-erp-v2',workflow:'CI',branch:'codex/erp-p03-pr53-candidate-20261018',event,headSha:commit,status:'completed',conclusion:'success',attempt:1,jobs:['quality-build-test','secret-scan','windows-startup-test'].map((name,j)=>({id:j+10,run_id:index+1,run_attempt:1,head_sha:commit,name,status:'completed',conclusion:'success',steps:[{status:'completed',conclusion:'success'}]}))}));
 assertStartupCi(commit,make());
 for(const mutate of [r=>r.pop(),r=>r[0].headSha='b'.repeat(40),r=>r[1].status='in_progress',r=>r[1].attempt=2,r=>r[0].jobs[1].steps[0].conclusion='skipped',r=>r[0].jobs.pop(),r=>r[0].jobs[0].conclusion='cancelled',r=>r[0].event='pull_request',r=>r[0].jobs[0].name='made-up-job',r=>r[0].jobs[0].head_sha='c'.repeat(40),r=>r[0].jobs[0].run_id=123,r=>r[0].repository='other/repo']){const rows=make();mutate(rows);assert.throws(()=>assertStartupCi(commit,rows),/EXACT_CI/);}
 const calls=[],gh=endpoint=>{calls.push(endpoint);const id=Number(endpoint.match(/runs\/(\d+)/)[1]),row=make()[id-1];return endpoint.includes('/jobs?')?{total_count:3,jobs:row.jobs}:{id,repository:{full_name:row.repository},path:'.github/workflows/ci.yml',name:'CI',head_branch:row.branch,event:row.event,head_sha:row.headSha,status:row.status,conclusion:row.conclusion,run_attempt:1};};
 assert.equal(readStartupCi(commit,[1,2],gh).length,2);assert.equal(calls.length,4);
 assert.throws(()=>readStartupCi(commit,make(),gh),/CI_RUN_IDS/);
 assert.throws(()=>readStartupCi(commit,[1,2],endpoint=>({...gh(endpoint),path:'.github/workflows/fake.yml'})),/CI_PROVENANCE/);
});
