import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=new URL('./p03-pr54-current-b007-precut-cut.ps1',import.meta.url);
const finalizationFixture=String.raw`
$env:PSModulePath=Join-Path $PSHOME 'Modules';foreach($name in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$name+'\'+$name+'.psd1')) -ErrorAction Stop}
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($env:P03_FIXTURE_WORKER,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'FIXTURE_WORKER_PARSE'}
foreach($name in @('Completed42d0Pins','Finalize42d0Pins','AssertFinalize42d0History','Finalize42d0Empty','Finalize42d0ReadbackPending','WaitFinalize42d0OldReady','FinalizeOld42d0','ObserveStartedOld')){$definition=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq$name},$true));if($definition.Count-ne1){throw 'FIXTURE_DEFINITION'};. ([scriptblock]::Create($definition[0].Extent.Text))}
$originalEngine=[IO.File]::ReadAllText($env:P03_FIXTURE_ENGINE);$tokens=$null;$errors=$null;$engineAst=[Management.Automation.Language.Parser]::ParseInput($originalEngine,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'FIXTURE_ENGINE_PARSE'}
$definitions=@($engineAst.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)|ForEach-Object{$_.Extent.Text})-join [Environment]::NewLine
# Only OS edges are synthetic. AssertEmpty, AssertTasks, AssertOldPidLifetimes,
# StartedOwner and their identity/port checks are the unchanged engine functions.
$edges=@'
function Inventory{return $script:fixtureInventory}
function ProtectedProcesses($inventory){$script:protectedChecks++;if($script:protectedChanged){throw 'P03_PHYSICAL_PROTECTED_PROCESS_CHANGED'}}
function Health($owners,$generation='old'){$script:healthChecks++;if($script:healthFailure){throw 'P03_PHYSICAL_HEALTH_FAILED'}}
function AssertFinalize42d0Packages{$script:packageChecks++;if($script:packageChanged){throw 'P03_PHYSICAL_FINALIZE42_PACKAGE_CONTENT'}}
function AssertFinalize42d0Lock{if($script:lockChanged){throw 'P03_PHYSICAL_FINALIZE42_LOCK_ACL'}}
'@
$script:engineBytes=[Text.Encoding]::UTF8.GetBytes(($definitions+[Environment]::NewLine+$edges))
function Need($value,$code){if(-not$value){throw ('P03_PHYSICAL_'+$code)}}
function Json($bytes){return [Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json}
function ReadWorkerPin($path,$sha){if(-not$script:data.ContainsKey($path)-or$script:hashes[$path]-cne$sha){throw 'FIXTURE_PIN'};return ,[Text.Encoding]::UTF8.GetBytes(($script:data[$path]|ConvertTo-Json -Depth 40 -Compress))}
function Protected($path){if($path-cne(Join-Path $profile.journalDirectory 'recovery.lock')){throw 'FIXTURE_PROTECTED_PATH'}}
function Get-ChildItem{param($LiteralPath,[switch]$Force);if($LiteralPath-cne$profile.journalDirectory){throw 'FIXTURE_DIRECTORY'};foreach($name in $script:journalNames){[pscustomobject]@{Name=$name}}}
function Get-Item{param($LiteralPath,[switch]$Force);if($LiteralPath-cne(Join-Path $profile.journalDirectory 'recovery.lock')){throw 'FIXTURE_ITEM'};return [pscustomobject]@{Length=0}}
function Test-Path{param($LiteralPath);return $script:data.ContainsKey($LiteralPath)}
function AssertCurrentB007StaticContract{param($a,$b,$c,$d,$e,$f,$g);if($before.actualT1-ne$false){throw 'P03_PHYSICAL_FIXTURE_T1'}}
function Inventory{throw 'FIXTURE_NATIVE_INVENTORY_MUST_NOT_RUN'}
function AssertEmpty{throw 'FIXTURE_NATIVE_EMPTY_MUST_NOT_RUN'}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);return [pscustomobject]@{ReturnValue=0;Sid=$owner}}
function New-ScheduledTaskAction{param($Execute,$Argument,$WorkingDirectory);return [pscustomobject]@{Execute=$Execute;Argument=$Argument;WorkingDirectory=$WorkingDirectory}}
function Set-ScheduledTask{param($TaskPath,$TaskName,$Action,$ErrorAction);$script:casCalls++;if($script:partialCas-and$script:casCalls-eq2){throw 'P03_PHYSICAL_FIXTURE_CAS_FAILED'};$entry=$profile.tasks|Where-Object{$_.name-ceq$TaskName};$script:fixtureTasks[$TaskName].Xml=$entry.oldXml}
function Start-ScheduledTask{param($TaskPath,$TaskName,$ErrorAction);$script:startCalls++;$script:fixtureTasks[$TaskName].State=4;if($script:startCalls-eq2){$script:fixtureInventory=$script:startedInventory}}
function WriteFinalize42d0Evidence($leaf,$value){if($Mode-cne'FinalizeOld42d0Apply'-or$leaf-cnotin@('completed-cut-finalize-old-intent.json','completed-cut-finalize-old-result.json')){throw 'FIXTURE_WRITE_SCOPE'};$p=Join-Path $dir $leaf;if($script:data.ContainsKey($p)){throw 'FIXTURE_CREATE_NEW'};$script:data[$p]=$value;$script:writes++;return @{path=$p;sha256=('e'*64)}}
function ResetFinalization{
 $script:Mode='FinalizeOld42d0Inspect';$script:base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:runId='42d0d0536cb115cc4aea43ff1f13afbf';$script:dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId);$script:owner='fixture-owner';$script:Environment='Shared';$script:isRehearsal=$false
 $script:names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$script:ports=@(4184,4186,5234,62700,62701,62702,62703,62704)
 $script:WorkerSourceSha256='f'*64;$script:data=@{};$script:hashes=@{};$script:writes=0;$script:casCalls=0;$script:startCalls=0;$script:healthChecks=0;$script:protectedChecks=0;$script:packageChecks=0;$script:partialCas=$false;$script:protectedChanged=$false;$script:healthFailure=$false;$script:packageChanged=$false;$script:lockChanged=$false
 $script:journalNames=@('event-0000.json','event-0001.json','event-0002.json','event-0003.json','event-0004.json','recovery.lock')
 $old=Completed42d0Pins;$pins=Finalize42d0Pins
 foreach($pin in @($old.Values)+@($pins.Values)){$data[$pin.path]=[pscustomobject]@{unused=$true};$hashes[$pin.path]=$pin.sha256}
 $script:ProfilePath=$old.profile.path;$script:ProfileSha256=$old.profile.sha256;$script:BeforeImagePath=$old.before.path;$script:BeforeImageSha256=$old.before.sha256;$script:ClaimPath=$old.claim.path;$script:ClaimSha256=$old.claim.sha256;$script:ContinuationPath=$old.context.path;$script:ContinuationSha256=$old.context.sha256;$script:RootIntentPath=$old.root.path;$script:RootIntentSha256=$old.root.sha256;$script:AdmittedSnapshotPath=$old.snapshot.path;$script:AdmittedSnapshotSha256=$old.snapshot.sha256
 $script:EnginePath=Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1';$script:EngineSha256='b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'
 $identities=[ordered]@{};$roleNames=@('hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor')
 for($n=0;$n-lt8;$n++){$role=$roleNames[$n];$identities[$role]=[pscustomobject]@{pid=(100+$n);parentPid=107;ownerSid=$owner;nodePath='C:\fixture\node.exe';commandLine=('node '+$role);creationTime='2026-10-20T00:00:00.0000000Z';bindings=@($(if($n-lt7){[pscustomobject]@{port=$ports[$n];address='127.0.0.1'}}))}}
 $script:before=[pscustomobject]@{identities=[pscustomobject]$identities;copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';actualT1=$false}
 $oldXml='<Task><Actions><Exec><Command>C:\fixture\powershell.exe</Command><Arguments>fixture-old</Arguments><WorkingDirectory>C:\fixture</WorkingDirectory></Exec></Actions></Task>';$newXml=$oldXml.Replace('fixture-old','fixture-new')
 function XmlFixtureHash($xml){return [BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes($xml))).Replace('-','').ToLowerInvariant()}
 $script:profile=[pscustomobject]@{journalDirectory=(Join-Path $base ('MelisaERP-P03-recovery-'+$runId));oldSettings=@{sha256='ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'};newSettings=@{sha256='800329af39652d7fcf111a2b8441d7a00cb0bef94b37668e2ed261e4324ba329'};oldWatchers=@(@{pid=108},@{pid=109});protectedProcesses=@();packages=@(@{root='C:\fixture\package'});tasks=@($names|ForEach-Object{[pscustomobject]@{name=$_;oldXml=$oldXml;newXml=$newXml;oldXmlSha256=(XmlFixtureHash $oldXml);newXmlSha256=(XmlFixtureHash $newXml)}})}
 $script:oldSettings=$profile.oldSettings;$script:newSettings=[pscustomobject]@{components=@{erpApiNative=@{sourceCommit='6dc33f41737349c6e3f17fb867a451b570a00acc'}}}
 $script:fixtureTasks=@{};foreach($name in $names){$fixtureTasks[$name]=[pscustomobject]@{State=3;Xml=$newXml}}
 $script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($name);return $script:fixtureTasks[$name]}
 $script:fixtureInventory=[pscustomobject]@{all=@();allListeners=@();listeners=@();instances=@()}
 $script:startedInventory=[pscustomobject]@{all=@();allListeners=@();listeners=@();instances=@()}
 foreach($entry in $before.identities.PSObject.Properties){$p=$entry.Value;$newPid=$p.pid+1000;$newParent=$p.parentPid+1000;$startedInventory.all+=,[pscustomobject]@{ProcessId=$newPid;ParentProcessId=$newParent;ExecutablePath=$p.nodePath;CommandLine=$p.commandLine;CreationDate=[DateTime]::UtcNow.AddHours(1)};foreach($binding in $p.bindings){$startedInventory.listeners+=,[pscustomobject]@{OwningProcess=$newPid;LocalPort=$binding.port;LocalAddress=$binding.address}}}
 foreach($n in 0..1){$name=$names[$n];$pidValue=2000+$n;$startedInventory.all+=,[pscustomobject]@{ProcessId=$pidValue;ParentProcessId=1;ExecutablePath='C:\fixture\powershell.exe';CommandLine='"C:\fixture\powershell.exe" fixture-old';CreationDate=[DateTime]::UtcNow.AddHours(1)};$startedInventory.instances+=,[pscustomobject]@{Name=$name;EnginePID=$pidValue;InstanceGuid=('guid'+$n)}}
 $data[$old.snapshot.path]=@{consolePins=@();probePins=@()}
 $previous=$BeforeImageSha256;$events=@('RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_FAILED','QUARANTINED')
 foreach($n in 0..4){$record=[ordered]@{sequence=$n;previousSha256=$previous;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;event=$events[$n]};if($n-eq3){$record.failure=@{code='P03_PHYSICAL_OLD_REUSE_SCOPE';oldPidFailureRecordSha256=$pins.failure.sha256}};$data[$pins['journal'+$n].path]=$record;$previous=$pins['journal'+$n].sha256}
 $data[$pins.failure.path]=@{sourceFileSha256=$EngineSha256;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;candidateSha256=$pins.zero.sha256;failure=@{code='P03_PHYSICAL_OLD_REUSE_SCOPE'};trigger=@{pid=33652};stopAuthority=$false;fullGuardReplayAvailable=$false}
 $data[$pins.zero.path]=@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;processes=@();receipts=@()}
 $data[$pins.firstIntent.path]=@{schemaVersion='melisa-p03-current-b007-completed-cut-recovery.v1';mode='ROLLBACK_OLD_ONLY';runId=$runId;workerRef=$pins.archivedWorker}
 $data[$pins.firstResult.path]=@{status='QUARANTINED_REQUIRES_ROOT_INSPECTION';reason='B264_SOURCE_ACL';recoveryOnly=$true;newGenerationStarted=$false}
 $data[$pins.postcasIntent.path]=@{schemaVersion='melisa-p03-current-b007-postcas-recovery.v1';mode='ROLLBACK_OLD_ONLY';runId=$runId;firstIntentRef=$pins.firstIntent;firstResultRef=$pins.firstResult}
 $data[$pins.postcasResult.path]=@{status='QUARANTINED_REQUIRES_ROOT_INSPECTION';reason='P03_PHYSICAL_OLD_REUSE_SCOPE';recoveryOnly=$true;newGenerationStarted=$false}
}
function FinalizeOutcome{try{$value=FinalizeOld42d0;return $value.status}catch{return $_.Exception.Message}}
`;
function runFinalization(code,{timeout=15000}={}){
 const temp=realpathSync.native(mkdtempSync(path.join(tmpdir(),'melisa-finalize42-fixture-'))),file=path.join(temp,'isolated.ps1');
 try{writeFileSync(file,"Set-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n"+finalizationFixture+'\n'+code+'\n');return execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout,env:{...process.env,P03_FIXTURE_TEMP:temp,P03_FIXTURE_WORKER:fileURLToPath(source),P03_FIXTURE_ENGINE:fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url))}});}finally{const parent=realpathSync.native(tmpdir())+path.sep,target=path.resolve(temp);assert(target.startsWith(parent)&&path.basename(target).startsWith('melisa-finalize42-fixture-'));rmSync(target,{recursive:true});}
}

test('finalize42d0 PS5 original empty inherited lock is accepted but extra/protected/nonempty/active locks are rejected',()=>{
 const out=runFinalization(String.raw`
& {
 function Get-Item{param($LiteralPath,[switch]$Force);Microsoft.PowerShell.Management\Get-Item -LiteralPath $LiteralPath -Force:$Force}
 foreach($name in @('Need','NoReparse','Protected')){$definition=$engineAst.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq$name},$true);. ([scriptblock]::Create($definition[0].Extent.Text))}
 $definition=$ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq'AssertFinalize42d0Lock'},$true);. ([scriptblock]::Create($definition[0].Extent.Text))
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$journal=Join-Path $env:P03_FIXTURE_TEMP 'journal';$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false);foreach($sid in @($owner,'S-1-5-18')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($journal,$acl)
 # File ownership is not inherited from the directory. Elevated Windows CI
 # may create files owned by Administrators; model the real same-user lock
 # explicitly, without changing the inherited two-ACE contract under test.
 function NewFixtureLock{param($path);$s=[IO.File]::Open($path,'CreateNew','Write','None');$s.Dispose();$created=Get-Acl -LiteralPath $path;$created.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));Set-Acl -LiteralPath $path -AclObject $created}
 $profile=[pscustomobject]@{journalDirectory=$journal};$lock=Join-Path $journal 'recovery.lock';NewFixtureLock $lock;AssertFinalize42d0Lock;'INHERITED_GO'
 $changed=Get-Acl -LiteralPath $lock;$changed.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'),'Read','Allow'));Set-Acl -LiteralPath $lock -AclObject $changed;try{AssertFinalize42d0Lock;throw 'FIXTURE_EXTRA_ACCEPTED'}catch{'EXTRA='+$_.Exception.Message};Need ($lock.StartsWith($env:P03_FIXTURE_TEMP+'\',[StringComparison]::Ordinal)) 'FIXTURE_DELETE_SCOPE';[IO.File]::Delete($lock);NewFixtureLock $lock
 $changed=Get-Acl -LiteralPath $lock;$changed.SetAccessRuleProtection($true,$true);Set-Acl -LiteralPath $lock -AclObject $changed;try{AssertFinalize42d0Lock;throw 'FIXTURE_PROTECTED_ACCEPTED'}catch{'PROTECTED='+$_.Exception.Message};Need ($lock.StartsWith($env:P03_FIXTURE_TEMP+'\',[StringComparison]::Ordinal)) 'FIXTURE_DELETE_SCOPE';[IO.File]::Delete($lock);NewFixtureLock $lock
 $held=[IO.File]::Open($lock,'Open','Read','None');try{try{AssertFinalize42d0Lock;throw 'FIXTURE_ACTIVE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACTIVE_ACCEPTED'){throw};'ACTIVE_REJECTED'}}finally{$held.Dispose()}
 [IO.File]::WriteAllBytes($lock,[byte[]]@(1));try{AssertFinalize42d0Lock;throw 'FIXTURE_SIZE_ACCEPTED'}catch{'NONEMPTY='+$_.Exception.Message}
}
`);assert.match(out,/INHERITED_GO[\s\S]*EXTRA=P03_PHYSICAL_FINALIZE42_LOCK_ACL[\s\S]*PROTECTED=P03_PHYSICAL_FINALIZE42_LOCK_ACL[\s\S]*ACTIVE_REJECTED[\s\S]*NONEMPTY=P03_PHYSICAL_FINALIZE42_LOCK_FILE/);
});

test('finalize42d0 PS5 seven package preflight rejects payload, manifest, Node, shell and external config drift',()=>{
 const out=runFinalization(String.raw`
& {
 foreach($name in @('Need','Hash','Json','PackageManifestSource')){$definition=$engineAst.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq$name},$true);. ([scriptblock]::Create($definition[0].Extent.Text))}
 $definition=$ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq'AssertFinalize42d0Packages'},$true);$body=$definition[0].Extent.Text;Need ($body.Contains('[IO.File]::ReadAllBytes($pkg.manifestPath)')) 'FIXTURE_EDGE';$body=$body.Replace('[IO.File]::ReadAllBytes($pkg.manifestPath)','(FixtureReadAllBytes $pkg.manifestPath)');. ([scriptblock]::Create($body))
 function NoReparse($p){if(-not$script:payload.ContainsKey($p)){throw 'P03_PHYSICAL_FIXTURE_REPARSE'}}
 function FixtureReadAllBytes($p){return ,$script:payload[$p]}
 function Get-FileHash{param($LiteralPath,$Algorithm);return [pscustomobject]@{Hash=(Hash $script:payload[$LiteralPath])}}
 function ReadWorkerPin($p,$sha){$script:configReads++;if(-not$script:payload.ContainsKey($p)-or(Hash $script:payload[$p])-cne$sha){throw 'P03_PHYSICAL_FIXTURE_CONFIG'};return ,$script:payload[$p]}
 function ResetPackages{
  $script:isRehearsal=$false;$script:owner='fixture-owner';$script:database='fixture-db';$script:before=[pscustomobject]@{copyId='fixture-copy'};$script:payload=@{};$script:configReads=0;$script:profile=[pscustomobject]@{packages=@();shell=@{path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe';sha256=''};businessDigest=@{path='C:\fixture\digest';sha256=''};stopper=@{path='C:\fixture\stopper';sha256=''}}
  $script:oldSettings=[pscustomobject]@{ownerSid=$owner;actualT1=$false;database=$database;copyId=$before.copyId;node=@{path='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';sha256=''};components=[pscustomobject]@{}}
  $script:newSettings=$oldSettings|ConvertTo-Json -Depth 10|ConvertFrom-Json
  foreach($settings in @($oldSettings,$newSettings)){$payload[$settings.node.path]=[Text.Encoding]::UTF8.GetBytes('node');$settings.node.sha256=Hash $payload[$settings.node.path]}
  $parts=@()
  foreach($n in 0..6){$root='C:\Sirket\ERP\releases\fixture-'+$n;$config='C:\fixture\config'+$n;$payload[$config]=[Text.Encoding]::UTF8.GetBytes('private'+$n);$filePath=Join-Path $root 'entry.js';$payload[$filePath]=[Text.Encoding]::UTF8.GetBytes('payload'+$n);$commit=([string]$n)*40;$manifest=[ordered]@{sourceCommit=$commit;files=@(@{path='entry.js';sha256=(Hash $payload[$filePath])})};if($n-in@(1,5)){$manifest=[ordered]@{schemaVersion=1;kind='melisa-crm-test-package';environment='TEST';source=@{repository='https://github.com/melihsnyldzz-ui/melisa-crm.git';commit=$commit};files=$manifest.files}};$manifestPath=Join-Path $root 'release-manifest.json';$payload[$manifestPath]=[Text.Encoding]::UTF8.GetBytes(($manifest|ConvertTo-Json -Depth 10 -Compress));$component=[pscustomobject]@{packageRoot=$root;sourceCommit=$commit;manifestSha256=(Hash $payload[$manifestPath])};if($n-notin@(3,6)){$component|Add-Member NoteProperty config ([pscustomobject]@{path=$config;sha256=(Hash $payload[$config])})};$parts+=,$component;$profile.packages+=,[pscustomobject]@{root=$root;sourceCommit=$commit;manifestPath=$manifestPath;manifestSha256=$component.manifestSha256}}
  foreach($pair in @(@($oldSettings,@(0,2,1,0),3),@($newSettings,@(4,2,5,4),6))){$settings=$pair[0];$keys=@('erpApiNative','nativeOrder','crm','hub');foreach($i in 0..3){$settings.components|Add-Member NoteProperty $keys[$i] $parts[$pair[1][$i]]};$settings|Add-Member NoteProperty supervisor $parts[$pair[2]]}
  foreach($ref in @($profile.shell,$profile.businessDigest,$profile.stopper)){$payload[$ref.path]=[Text.Encoding]::UTF8.GetBytes('guard');$ref.sha256=Hash $payload[$ref.path]}
 }
 function PackageOutcome{try{AssertFinalize42d0Packages;'GO'}catch{$_.Exception.Message}}
 ResetPackages;'BASE='+(PackageOutcome);'CONFIG_READS='+$configReads
 ResetPackages;$payload['C:\Sirket\ERP\releases\fixture-0\entry.js']=[byte[]]@(1);'PAYLOAD='+(PackageOutcome)
 ResetPackages;$payload[$profile.packages[0].manifestPath]=[byte[]]@(1);'MANIFEST='+(PackageOutcome)
 ResetPackages;$payload[$oldSettings.node.path]=[byte[]]@(1);'NODE='+(PackageOutcome)
 ResetPackages;$payload[$profile.shell.path]=[byte[]]@(1);'SHELL='+(PackageOutcome)
 ResetPackages;$payload['C:\fixture\config0']=[byte[]]@(1);'CONFIG='+(PackageOutcome)
 ResetPackages;$oldSettings.components.erpApiNative.PSObject.Properties.Remove('config');'MISSING_COMPONENT_CONFIG='+(PackageOutcome)
 ResetPackages;$oldSettings.supervisor|Add-Member NoteProperty config ([pscustomobject]@{path='invented';sha256=('a'*64)});'INVENTED_SUPERVISOR_CONFIG='+(PackageOutcome)
}
`);assert.match(out,/BASE=GO[\s\S]*CONFIG_READS=10[\s\S]*PAYLOAD=P03_PHYSICAL_FINALIZE42_PACKAGE_CONTENT[\s\S]*MANIFEST=P03_PHYSICAL_FINALIZE42_MANIFEST_HASH[\s\S]*NODE=P03_PHYSICAL_FINALIZE42_NODE[\s\S]*SHELL=P03_PHYSICAL_FINALIZE42_SHELL[\s\S]*CONFIG=P03_PHYSICAL_FIXTURE_CONFIG[\s\S]*MISSING_COMPONENT_CONFIG=The property 'config' cannot be found[\s\S]*INVENTED_SUPERVISOR_CONFIG=P03_PHYSICAL_FINALIZE42_SUPERVISOR_SCHEMA/);
});

test('finalize42d0 PS5 Inspect uses isolated original b33 guards and cannot write or start tasks',()=>{
 const out=runFinalization("ResetFinalization;'STATUS='+(FinalizeOutcome);'WRITES='+$writes;'STARTS='+$startCalls;'PROTECTED='+$protectedChecks");assert.match(out,/STATUS=B264_COMPLETED42_FINALIZE_OLD_DRY_RUN[\s\S]*WRITES=0[\s\S]*STARTS=0[\s\S]*PROTECTED=1/);
});

test('finalize42d0 PS5 rejects wrong tails, advanced journals, changed source, old PIDs and protected TEST drift before intent',()=>{
 const edits=["$data[$pins.journal4.path].previousSha256='wrong'","$journalNames+=,'event-0005.json'","$hashes[$pins.firstResult.path]='wrong'","$data[$pins.firstIntent.path].workerRef=@{path='wrong';sha256=('a'*64)}","$fixtureInventory.all+=,[pscustomobject]@{ProcessId=105;CommandLine='unrelated'}","$fixtureInventory.all+=,[pscustomobject]@{ProcessId=12345;CommandLine='node C:\\fixture\\package\\unknown.js'}","$protectedChanged=$true","$packageChanged=$true","$lockChanged=$true","$fixtureTasks[$names[0]].Xml=$profile.tasks[0].oldXml","$data[(Join-Path $dir 'completed-cut-finalize-old-intent.json')]=@{consumed=$true}"];
 const code=edits.map((edit,n)=>`ResetFinalization;$pins=Finalize42d0Pins;${edit};'CASE${n}='+(FinalizeOutcome);if($writes-ne0-or$startCalls-ne0){throw 'FIXTURE_UNSAFE_MUTATION'}`).join('\n');const out=runFinalization(code);for(let n=0;n<edits.length;n++)assert.match(out,new RegExp('CASE'+n+'=(?:P03_PHYSICAL_|FIXTURE_PIN)'));
});

test('finalize42d0 PS5 partial action CAS preserves intent and failed result without starting or retrying',()=>{
 const out=runFinalization("ResetFinalization;$Mode='FinalizeOld42d0Apply';$partialCas=$true;'FIRST='+(FinalizeOutcome);'WRITES='+$writes;'CAS='+$casCalls;'STARTS='+$startCalls;'REPLAY='+(FinalizeOutcome);'REPLAY_WRITES='+$writes");assert.match(out,/FIRST=P03_PHYSICAL_FIXTURE_CAS_FAILED[\s\S]*WRITES=2[\s\S]*CAS=2[\s\S]*STARTS=0[\s\S]*REPLAY=P03_PHYSICAL_FINALIZE42_ONCE[\s\S]*REPLAY_WRITES=2/);
});

test('finalize42d0 PS5 healthy OLD proof uses unchanged StartedOwner identity and port checks for30 real seconds',()=>{
 const out=runFinalization("ResetFinalization;$Mode='FinalizeOld42d0Apply';$saved=@($journalNames)-join '|';$result=FinalizeOld42d0;'STATUS='+$result.status;'STABLE='+$result.stableSeconds;'DIGEST='+$result.identityDigest;'STARTS='+$startCalls;'HEALTH='+$healthChecks;'JOURNAL_UNCHANGED='+($saved-ceq($journalNames-join '|'));'REPLAY='+(FinalizeOutcome)",{timeout:90000});assert.match(out,/STATUS=B264_COMPLETED42_OLD_RESTORED_READY[\s\S]*STABLE=30[\s\S]*DIGEST=[a-f0-9]{64}[\s\S]*STARTS=2[\s\S]*HEALTH=[1-9][0-9]*[\s\S]*JOURNAL_UNCHANGED=True[\s\S]*REPLAY=P03_PHYSICAL_FINALIZE42_ONCE/);
});

test('finalize42d0 waits only for absent roles or bindings; duplicate, foreign port and identity failures never become startup delay',()=>{
 const out=runFinalization(String.raw`
ResetFinalization
function ProtectedProcesses($inventory){}
$full=$startedInventory
'HEALTHY='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_STARTED_ROLE_COUNT' $full)
$pending=[pscustomobject]@{all=@($full.all|Where-Object{$_.ProcessId-ne1100});listeners=$full.listeners;instances=$full.instances}
'ABSENT='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_STARTED_ROLE_COUNT' $pending)
$duplicate=[pscustomobject]@{all=@($full.all)+@($full.all|Where-Object{$_.ProcessId-eq1101});listeners=$full.listeners;instances=$full.instances}
'DUPLICATE='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_STARTED_ROLE_COUNT' $duplicate)
$foreign=[pscustomobject]@{all=$full.all;listeners=@($full.listeners|ForEach-Object{[pscustomobject]@{LocalPort=$_.LocalPort;LocalAddress=$_.LocalAddress;OwningProcess=9999}});instances=$full.instances}
'FOREIGN='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_STARTED_PORT_IDENTITY' $foreign)
$missingPort=[pscustomobject]@{all=$full.all;listeners=@($full.listeners|Where-Object{$_.LocalPort-ne4184});instances=$full.instances}
'MISSING_PORT='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_STARTED_PORT_IDENTITY' $missingPort)
'IDENTITY='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_STARTED_ROLE_IDENTITY' $pending)
'PARENT='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_STARTED_PARENT_IDENTITY' $pending)
'HEALTH='+(Finalize42d0ReadbackPending 'P03_PHYSICAL_HEALTH_IDENTITY' $pending)
`);assert.match(out,/HEALTHY=False[\s\S]*ABSENT=True[\s\S]*DUPLICATE=False[\s\S]*FOREIGN=False[\s\S]*MISSING_PORT=True[\s\S]*IDENTITY=False[\s\S]*PARENT=False[\s\S]*HEALTH=False/);
});

test('normal rollback late observation validates the original eight-event failure chain and released locks without another start or journal write',()=>{
 const out=runFinalization(String.raw`
function Get-ChildItem{param($LiteralPath,[switch]$Force,[switch]$File);Microsoft.PowerShell.Management\Get-ChildItem -LiteralPath $LiteralPath -Force:$Force -File:$File}
function Get-Item{param($LiteralPath,[switch]$Force);Microsoft.PowerShell.Management\Get-Item -LiteralPath $LiteralPath -Force:$Force}
function Get-FileHash{param($LiteralPath,$Algorithm);if(-not$LiteralPath.StartsWith($env:P03_FIXTURE_TEMP+'\',[StringComparison]::Ordinal)){throw 'FIXTURE_HASH_SCOPE'};return [pscustomobject]@{Hash=([BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([IO.File]::ReadAllBytes($LiteralPath))).Replace('-',''))}}
$definition=$ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq'WaitFinalize42d0OldReady'},$true)
. ([scriptblock]::Create($definition[0].Extent.Text.Replace('[DateTime]::UtcNow','(FixtureNow)').Replace('$deadline=$started.AddMinutes(10)','$script:clockBase=$started;$deadline=$started.AddMinutes(10)')))
$originalFixtureEngine=$engineBytes
foreach($case in 0..3){
 ResetFinalization;$script:Mode='ObserveStartedOld';$script:owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$script:base=$env:P03_FIXTURE_TEMP;$script:runId=[guid]::NewGuid().ToString('N')
 $script:ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json');$script:BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json')
 $script:database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$before|Add-Member NoteProperty ownerSid $owner;$before|Add-Member NoteProperty database $database;$before|Add-Member NoteProperty observedAt ([DateTime]::UtcNow.AddHours(-1).ToString('o'))
 $profile|Add-Member NoteProperty ownerSid $owner;$profile|Add-Member NoteProperty database $database;$profile|Add-Member NoteProperty beforeImage ([pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256});$profile.journalDirectory=Join-Path $base ('MelisaERP-P03-recovery-'+$runId);$profile.protectedProcesses=@([pscustomobject]@{kind='ProtectedSqlService'},[pscustomobject]@{name='fixture1'},[pscustomobject]@{name='fixture2'},[pscustomobject]@{name='fixture3'})
 $script:oldSettings=[pscustomobject]@{actualT1=$false};$script:newSettings=[pscustomobject]@{actualT1=$false}
 $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false);foreach($sid in @($owner,'S-1-5-18')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};[void][IO.Directory]::CreateDirectory($profile.journalDirectory,$acl)
 foreach($leaf in @('recovery.lock','rollback.lock')){$p=Join-Path $profile.journalDirectory $leaf;$stream=[IO.File]::Open($p,'CreateNew','Write','None');$stream.Dispose();$fileAcl=Get-Acl -LiteralPath $p;$fileAcl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));Set-Acl -LiteralPath $p -AclObject $fileAcl}
 $events=@('RECOVERY_INTENT','RECOVERY_TASKS_STOPPED','RECOVERY_OLD_ACTION_RESTORE_INTENT','RECOVERY_COMPLETE','ROLLBACK_START_INTENT','ROLLBACK_STARTED','ROLLBACK_FAILED','QUARANTINED');$previous=$BeforeImageSha256;$start=[DateTime]::UtcNow.AddMinutes(-6).ToString('o')
 foreach($n in 0..7){$record=[ordered]@{sequence=$n;previousSha256=$previous;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;event=$events[$n];observedAt=$start};if($n-eq6){$record['failure']=@{code=$(if($case-eq2){'P03_PHYSICAL_STARTED_ROLE_IDENTITY'}else{'P03_PHYSICAL_ROLLBACK_READBACK_FAILED'})}};if($case-eq3-and$n-eq5){$record.previousSha256='wrong'};$p=Join-Path $profile.journalDirectory ('event-'+$n.ToString('0000')+'.json');$bytes=[Text.Encoding]::UTF8.GetBytes(($record|ConvertTo-Json -Depth 10 -Compress));[IO.File]::WriteAllBytes($p,$bytes);$data[$p]=[pscustomobject]$record;$hashes[$p]=(Get-FileHash -LiteralPath $p).Hash.ToLowerInvariant();$previous=$hashes[$p]}
 $script:RollbackFailureTailSha256=if($case-eq1){'0'*64}else{$previous};$script:clockSeconds=360
 $script:engineBytes=[Text.Encoding]::UTF8.GetBytes(([Text.Encoding]::UTF8.GetString($originalFixtureEngine)+[Environment]::NewLine+'function FixtureNow{return $script:clockBase.AddSeconds($script:clockSeconds)}'+[Environment]::NewLine+'function Start-Sleep{param($Milliseconds);$script:clockSeconds+=10}'))
 $script:fixtureInventory=$startedInventory;foreach($name in $names){$fixtureTasks[$name].State=4;$fixtureTasks[$name].Xml=$profile.tasks[0].oldXml}
 try{$result=ObserveStartedOld;'CASE'+$case+'='+$result.status;'MUTATION='+$result.mutationExecuted;'START='+$result.startExecuted}catch{'CASE'+$case+'='+$_.Exception.Message}
 'COUNTERS='+$startCalls+'/'+$writes;'EVENTS='+@(Get-ChildItem -LiteralPath $profile.journalDirectory -File|Where-Object{$_.Name-cmatch'^event-'}).Count
}
`,{timeout:30000});assert.match(out,/CASE0=OLD_READY_LATE_OBSERVED[\s\S]*MUTATION=False[\s\S]*START=False[\s\S]*COUNTERS=0\/0[\s\S]*EVENTS=8[\s\S]*CASE1=P03_PHYSICAL_OLD_OBSERVE_FAILURE[\s\S]*CASE2=P03_PHYSICAL_OLD_OBSERVE_FAILURE[\s\S]*CASE3=P03_PHYSICAL_OLD_OBSERVE_JOURNAL_CHAIN/);
 const fn=readFileSync(source,'utf8').split('function ObserveStartedOld{')[1].split("if($Mode -ceq 'ObserveStartedOld')")[0];assert(!/Start-ScheduledTask|Set-ScheduledTask|WriteFinalize42d0Evidence|\bAppend\s/.test(fn));
});

test('normal owner cut commits one epoch-derived generation claim and keeps the original60 second admission window after genuine held exit',()=>{
 const worker=fileURLToPath(new URL('./p03-pr54-b264-old-owner-cut.ps1',import.meta.url));
 const out=runFinalization(String.raw`
$t=$null;$e=$null;$normal=[Management.Automation.Language.Parser]::ParseFile('__NORMAL__',[ref]$t,[ref]$e);if($e.Count){throw 'NORMAL_PARSE'}
$d=$normal.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq'B264CutAdmissionTime'},$true);. ([scriptblock]::Create($d[0].Extent.Text))
function Need($v,$code){if(-not$v){throw ('P03_PHYSICAL_'+$code)}}
$script:cutWitnessCommitted=$false;$start=[DateTime]::UtcNow;'BEFORE_NOW='+(((B264CutAdmissionTime)-$start).TotalSeconds-lt2)
$script:cutWitnessCommitted=$true;$script:coreQuiesced=$true;$script:coreLifetime=[pscustomobject]@{HasExited=$true};$script:precutWindowOpenedAt=[DateTime]::UtcNow.AddMinutes(-2);$script:coreStopCompletedAt=$precutWindowOpenedAt.AddSeconds(54)
'AFTER_SAME_START='+((B264CutAdmissionTime).Ticks-eq$precutWindowOpenedAt.Ticks)
$script:coreStopCompletedAt=$precutWindowOpenedAt.AddSeconds(60);try{B264CutAdmissionTime;throw 'BAD_WINDOW_ACCEPTED'}catch{'BAD_WINDOW='+$_.Exception.Message}
$script:coreStopCompletedAt=$precutWindowOpenedAt.AddSeconds(54);$coreLifetime.HasExited=$false;try{B264CutAdmissionTime;throw 'LIVE_ACCEPTED'}catch{'LIVE='+$_.Exception.Message}
`.replace('__NORMAL__',worker.replaceAll("'","''")));assert.match(out,/BEFORE_NOW=True[\s\S]*AFTER_SAME_START=True[\s\S]*BAD_WINDOW=P03_PHYSICAL_B264_CUT_POSTCOMMIT_WINDOW[\s\S]*LIVE=P03_PHYSICAL_B264_CUT_POSTCOMMIT_STATE/);
 const s=readFileSync(worker,'utf8');assert(s.includes("'p03-pr54-current-b007-generation-'+$claim.currentOwnerDigest+'.lock.json'"));assert(s.includes("Need ($claim.currentOwnerDigest -ceq $actual) 'B264_CUT_OWNER_DIGEST'"));
});

test('finalize42d0 virtual six-minute sequential startup retains original owner proof and30 seconds stability, with fixed timeout and fatal identity rejection',()=>{
 const out=runFinalization(String.raw`
# Replace only the clock/sleep OS edges; actual original StartedOwner and its
# owner, parent, binding and health checks still run after the delayed spawn.
$definition=$ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq'WaitFinalize42d0OldReady'},$true)
. ([scriptblock]::Create($definition[0].Extent.Text.Replace('[DateTime]::UtcNow','(FixtureNow)').Replace('$deadline=$started.AddMinutes(10)','$script:clockBase=$started;$deadline=$started.AddMinutes(10)')))
$clockEdges=@'
function FixtureNow{return $script:clockBase.AddSeconds($script:clockSeconds)}
function Start-Sleep{param($Milliseconds);$script:clockSeconds+=10}
function Inventory{if($script:startCalls-eq2-and($script:neverReady-or$script:clockSeconds-lt360)){return [pscustomobject]@{all=@($script:startedInventory.all|Where-Object{$_.ProcessId-ne1100});listeners=$script:startedInventory.listeners;instances=$script:startedInventory.instances}};return $script:fixtureInventory}
'@
$originalFixtureEngine=$engineBytes
foreach($never in @($false,$true)){
 ResetFinalization;$Mode='FinalizeOld42d0Apply';$script:clockBase=[DateTime]::UtcNow;$script:clockSeconds=0;$script:neverReady=$never
 $script:engineBytes=[Text.Encoding]::UTF8.GetBytes(([Text.Encoding]::UTF8.GetString($originalFixtureEngine)+[Environment]::NewLine+$clockEdges))
 'NEVER='+$never;'STATUS='+(FinalizeOutcome);'CLOCK='+$clockSeconds;'STARTS='+$startCalls
}
ResetFinalization;$Mode='FinalizeOld42d0Apply';$script:clockBase=[DateTime]::UtcNow;$script:clockSeconds=0;$script:neverReady=$false
$script:engineBytes=[Text.Encoding]::UTF8.GetBytes(([Text.Encoding]::UTF8.GetString($originalFixtureEngine)+[Environment]::NewLine+$clockEdges+[Environment]::NewLine+"function StartedOwner{throw 'P03_PHYSICAL_STARTED_ROLE_IDENTITY'}"))
'FATAL='+(FinalizeOutcome);'FATAL_CLOCK='+$clockSeconds
`);assert.match(out,/NEVER=False[\s\S]*STATUS=B264_COMPLETED42_OLD_RESTORED_READY[\s\S]*CLOCK=390[\s\S]*STARTS=2[\s\S]*NEVER=True[\s\S]*STATUS=P03_PHYSICAL_FINALIZE42_READBACK[\s\S]*CLOCK=600[\s\S]*STARTS=2[\s\S]*FATAL=P03_PHYSICAL_STARTED_ROLE_IDENTITY[\s\S]*FATAL_CLOCK=0/);
});
test('finite continuation adapter exists without changing the historical cut worker',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/melisa-p03-current-b007-precut-continuation\.v1/);
 assert.match(s,/ContinuationPath/);
 assert.match(s.slice(0,s.indexOf('\n)')),/\[string\]\$ContinuationPath,\[string\]\$ContinuationSha256/);
});
const q=s=>"'"+s.replaceAll("'","''")+"'";
const digestExtract=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(source))},[ref]$tokens,[ref]$errors);if($errors.Count){throw 'FIXTURE_PARSE'}
foreach($name in @('ContinuationKeys','CurrentB007OwnerDigestBindings','AssertB264CutCurrentOwner')){$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));if($defs.Count -ne 1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))}`;
const digestFixture=String.raw`
function Hash($bytes){return [BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}
function B264Same($a,$b){return ($a|ConvertTo-Json -Depth 25 -Compress)-ceq($b|ConvertTo-Json -Depth 25 -Compress)}
function B264CutHistoryPins{return @{predecessorBefore=@{path='history';sha256='history-sha'}}}
function ProtectedProcesses($v){}
function Identity($row,$expected){return $row.ProcessId -eq $expected.pid}
function Inventory{return $inv}
function SetupDigest{
 $script:ClaimPath='claim';$script:ClaimSha256='claim-sha';$script:order=@('hub');$script:names=@('Terminal','Hub')
 $bindings=@([pscustomobject]@{port=5234;address='::'},[pscustomobject]@{port=5234;address='0.0.0.0'})
 $script:historical=[pscustomobject]@{identities=[pscustomobject]@{hub=[pscustomobject]@{bindings=$bindings}}}
 $e=[pscustomobject]@{pid=11;parentPid=10;ownerSid='fixture';nodePath='node';commandLine='fixture';creationTime='2026-10-20T09:00:00.1234567Z';bindings=@($bindings[1],$bindings[0])}
 $script:before=[pscustomobject]@{identities=[pscustomobject]@{hub=$e}}
 $script:inv=[pscustomobject]@{all=@([pscustomobject]@{ProcessId=11});instances=@([pscustomobject]@{Name='Terminal';State=4;Path='\Terminal';EnginePID=21;InstanceGuid='guid-1'},[pscustomobject]@{Name='Hub';State=4;Path='\Hub';EnginePID=22;InstanceGuid='guid-2'})}
 $committed=[ordered]@{owners=@([ordered]@{pid=11;parentPid=10;ownerSid='fixture';nodePath='node';commandLine='fixture';creationTime=$e.creationTime;bindings=$bindings});instances=@([ordered]@{name='Terminal';pid=21;guid='guid-1'},[ordered]@{name='Hub';pid=22;guid='guid-2'})}
 $script:claim=[pscustomobject]@{predecessorBefore=[pscustomobject]@{path='history';sha256='history-sha'};currentOwnerDigest=(Hash ([Text.Encoding]::UTF8.GetBytes(($committed|ConvertTo-Json -Depth 25 -Compress))))}
 $script:comPinsBefore=@();$script:b264CutComPins=$comPinsBefore
}
function ReadWorkerPin($path,$sha){if($path-ceq'claim'-and$sha-ceq'claim-sha'){$v=$claim}elseif($path-ceq'history'-and$sha-ceq'history-sha'){$v=$historical}else{throw 'FIXTURE_PIN'};return ,[Text.Encoding]::UTF8.GetBytes(($v|ConvertTo-Json -Depth 25 -Compress))}
function DigestOutcome{try{AssertB264CutCurrentOwner;return 'GO'}catch{return $_.Exception.Message}}
`;
test('Current PS5 owner digest matches the unchanged JS commitment when Windows reverses listener enumeration',()=>{
 const out=run(digestExtract+'\n'+digestFixture+"\nSetupDigest;$saved=$claim|ConvertTo-Json -Compress;'RESULT='+(DigestOutcome);'CLAIM_UNCHANGED='+($saved-ceq($claim|ConvertTo-Json -Compress));'COM_PINS='+$b264CutComPins.Count");
 assert.match(out,/RESULT=GO[\s\S]*CLAIM_UNCHANGED=True[\s\S]*COM_PINS=2/);
});
test('Current PS5 digest rejects missing, extra, duplicate-replaced, changed and malformed listeners and foreign history or COM',()=>{
 const edits=["$before.identities.hub.bindings=@($before.identities.hub.bindings[0])","$before.identities.hub.bindings+=,$before.identities.hub.bindings[0]","$before.identities.hub.bindings=@($before.identities.hub.bindings[0],$before.identities.hub.bindings[0])","$before.identities.hub.bindings[0]=[pscustomobject]@{port=5235;address='0.0.0.0'}","$before.identities.hub.bindings[0]=[pscustomobject]@{port='5234';address='0.0.0.0'}","$before.identities.hub.bindings[0]=[pscustomobject]@{port=5234;address='0.0.0.0';extra=$true}","$claim.predecessorBefore.sha256='foreign'","$inv.instances[0].InstanceGuid='foreign'"];
 const out=run(digestExtract+'\n'+digestFixture+'\n'+edits.map((edit,n)=>`SetupDigest;${edit};'CASE${n}='+(DigestOutcome);if($b264CutComPins.Count-ne0){throw 'PUBLISHED_REJECTED_COM_PINS'}`).join('\n'));
 for(let n=0;n<edits.length;n++)assert.match(out,new RegExp('CASE'+n+'=P03_PHYSICAL_'));
});
test('Current PS5 listener comparison preserves empty and duplicate arrays without mutating either order',()=>{
 const out=run(digestExtract+String.raw`
$empty=CurrentB007OwnerDigestBindings @() @();if($empty.Count-ne0){throw 'EMPTY_SHAPE'}
$a=[pscustomobject]@{port=5234;address='::'};$b=[pscustomobject]@{port=5234;address='0.0.0.0'};$fresh=@($b,$a,$a);$old=@($a,$b,$a)
$x=CurrentB007OwnerDigestBindings $fresh $old;if(($x|ConvertTo-Json -Compress)-cne($old|ConvertTo-Json -Compress)-or$fresh[0].address-cne'0.0.0.0'){throw 'ORDER_CHANGED'};'ARRAYS_PRESERVED'
`);assert.match(out,/ARRAYS_PRESERVED/);
});
const extract=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(source))},[ref]$tokens,[ref]$errors);if($errors.Count){throw 'FIXTURE_PARSE'}
foreach($name in @('B264Same','ContinuationKeys','ContinuationStable','CurrentB007ResumeStable','AssertCurrentB007RetryHistory','AssertCurrentB007ResumeBinding','AssertCurrentB007Continuation','AssertCurrentB007LiveAdmission','DrainB264OldOwner')){$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));if($defs.Count -ne 1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))}`;
const fixture=String.raw`
function Need($value,$code){if(-not $value){throw ('P03_PHYSICAL_'+$code)}}
function Json($bytes){return [Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json}
function ReadWorkerPin($path,$sha){if(-not $data.ContainsKey($path) -or $hashes[$path] -cne $sha){throw 'FIXTURE_PIN'};return ,[Text.Encoding]::UTF8.GetBytes(($data[$path]|ConvertTo-Json -Depth 30 -Compress))}
function Get-FileHash{param($LiteralPath,$Algorithm);return [pscustomobject]@{Hash=$hashes[$LiteralPath]}}
function Get-ChildItem{param($LiteralPath,[switch]$File,[switch]$Force);if($LiteralPath -ceq $failedDir){return $script:files|ForEach-Object{[pscustomobject]@{Name=$_}}};if($LiteralPath -ceq 'old-journal'){return @()};throw 'FIXTURE_DIRECTORY'}
function Clone($v){return $v|ConvertTo-Json -Depth 30|ConvertFrom-Json}
function Reset{
 Remove-Variable continuationLiveAdmission -Scope Script -Force -ErrorAction SilentlyContinue;$script:continuationLiveAdmission=$null
 $script:base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:runId='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';$script:oldRun='cffba2988afcb49502ae73ddd797e966'
 $script:dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId);$script:failedDir=Join-Path $base ('MelisaERP-P03-transition-'+$oldRun)
 $script:ProfilePath=Join-Path $base ('MelisaERP-P03-profile-'+$runId+'.json');$script:BeforeImagePath=Join-Path $base ('MelisaERP-P03-before-'+$runId+'.json');$script:ProfileSha256='new-profile';$script:BeforeImageSha256='new-before';$script:EngineSha256='engine';$script:RecoveryHelperSha256='helper'
 $script:ClaimPath=Join-Path $base 'p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json';$script:ContinuationPath=Join-Path $dir 'precut-continuation.json';$script:ContinuationSha256='a'*64
 $retainedPath=Join-Path $base 'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json'
 $oldProfileRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$oldRun+'.json'));sha256='7c3788d9dc97ae182adddec1b3b5f1106a6c408cc542ef00f8f6bc146ec4df8c'}
 $oldBeforeRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$oldRun+'.json'));sha256='d6aec6a904ca36bccccc2d295a770d8fae53ca3190b0b763e43788d2e3294f5c'}
 $script:claim=[pscustomobject]@{candidate='same-candidate';newSettings='same-settings';protectedSqlEpoch='same-sql';stopOrderDigest='same-stop';currentOwnerDigest='same-owner';ownerObservedAt=[DateTime]::UtcNow.AddMinutes(-5).ToString('o')}
 $retained=Clone $claim;$retained|Add-Member NoteProperty schemaVersion 'melisa-p03-current-b007-epoch-claim.v1';$retained|Add-Member NoteProperty successorRunId $oldRun;$retained|Add-Member NoteProperty transitionAuthority $true;$retained|Add-Member NoteProperty applyExecuted $false;$retained|Add-Member NoteProperty successorProfile $oldProfileRef;$retained|Add-Member NoteProperty successorBefore $oldBeforeRef
 $script:oldProfile=[pscustomobject]@{oldWatchers=@('watcher1','watcher2');protectedProcesses=@('sql','parent');tasks=@('task1','task2');oldSettings='old';newSettings='new';beforeImage=$oldBeforeRef;businessDigest='old-capture';journalDirectory='old-journal';stopper=[pscustomobject]@{path='old-stopper';sha256='same'}}
 $script:profile=Clone $oldProfile;$profile.beforeImage='new-ref';$profile.businessDigest='fresh';$profile.journalDirectory='new-journal';$profile.stopper.path='new-stopper'
 $script:oldBefore=[pscustomobject]@{runId=$oldRun;startedAt='old';observedAt='old';identities=@('old8');plan=[pscustomobject]@{digest='same-plan'}}
 $script:before=Clone $oldBefore;$before.runId=$runId;$before.startedAt='fresh';$before.observedAt='fresh'
 $tailRef=[pscustomobject]@{path=(Join-Path $failedDir 'event-0002.json');sha256='87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82'}
 $script:context=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-precut-continuation.v1';retainedClaimRef=[pscustomobject]@{path=$retainedPath;sha256='3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408'};failureTailRef=$tailRef;profileRef=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};beforeRef=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};claimPath=$ClaimPath}
 $script:AdmittedSnapshotPath=Join-Path $dir 'successor-precut-admission.json';$script:AdmittedSnapshotSha256='snapshot'
 $script:snapshot=[pscustomobject]@{schemaVersion='melisa-p03-successor-precut-admission.v1';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$EngineSha256;recoveryHelperSha256=$RecoveryHelperSha256;observedAt=[DateTime]::UtcNow.ToString('o')}
 $script:data=@{};$script:hashes=@{}
 foreach($entry in @(@($ContinuationPath,$ContinuationSha256,$context),@($retainedPath,$context.retainedClaimRef.sha256,$retained),@($oldProfileRef.path,$oldProfileRef.sha256,$oldProfile),@($oldBeforeRef.path,$oldBeforeRef.sha256,$oldBefore),@($AdmittedSnapshotPath,$AdmittedSnapshotSha256,$snapshot))){$data[$entry[0]]=$entry[2];$hashes[$entry[0]]=$entry[1]}
 $previous=$oldBeforeRef.sha256
 foreach($n in 0..2){$p=Join-Path $failedDir ('event-'+$n.ToString('0000')+'.json');$sha=if($n -eq 2){$tailRef.sha256}else{[string]([char](97+$n))*64};$event=[pscustomobject]@{sequence=$n;previousSha256=$previous;profileSha256=$oldProfileRef.sha256;beforeSha256=$oldBeforeRef.sha256;digest='same-plan';stopOrderDigest='same-stop';event=@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n];target=@('','coreSupervisor','HELD_CORE_CUT')[$n]};$data[$p]=$event;$hashes[$p]=$sha;$previous=$sha}
 $script:files=@('event-0000.json','event-0001.json','event-0002.json')
}
function Outcome{try{AssertCurrentB007Continuation $claim;return 'GO'}catch{return $_.Exception.Message}}
`;
function run(code){return execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';try{& ([scriptblock]::Create([Console]::In.ReadToEnd()))}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 1}"],{input:`Set-StrictMode -Version Latest\n${extract}\n${fixture}\n${code}\n`,encoding:'utf8',timeout:15000,windowsHide:true});}
test('pure native continuation accepts pinned no-cut history and a fresh snapshot without renewing claim time',()=>{
 assert.match(run("Reset;$old=$claim.ownerObservedAt;'RESULT='+(Outcome);'UNCHANGED='+($old -ceq $claim.ownerObservedAt)"),/RESULT=GO[\s\S]*UNCHANGED=True/);
});
test('pure native continuation rejects stale/foreign snapshots, wrong retained refs and changed identity before mutators',()=>{
 const edits=["$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')","$ContinuationPath='foreign'","$context.retainedClaimRef.sha256='wrong'","$before.identities=@('changed')","$profile.oldWatchers=@('changed')","$profile.protectedProcesses=@('changed')","$claim.currentOwnerDigest='changed'","$snapshot.profileSha256='foreign'","$files+=,'successor-core-cut-completed.json'","$files+=,'event-0003.json'"];
 const output=run(edits.map((e,n)=>`Reset;${e};'CASE${n}='+(Outcome)`).join('\n'));
 for(let n=0;n<edits.length;n++){assert.match(output,new RegExp('CASE'+n+'=P03_PHYSICAL_'));assert(!output.includes('CASE'+n+'=GO'));}
});
test('native hold, stop and COM-CAS remain byte equivalent; Current digest alone uses the verified predecessor listener order',()=>{
 const old=readFileSync(new URL('./p03-pr54-b264-old-owner-cut.ps1',import.meta.url),'utf8').replaceAll('\r\n','\n'),s=readFileSync(source,'utf8').replaceAll('\r\n','\n');
 const captureBinding="  $live=CaptureWorkerAdmission;AssertB264CutCurrentOwner\n  Need ($null -eq $script:continuationLiveAdmission) 'CURRENT_CONTINUATION_LIVE_ONCE';$claim=Json (ReadWorkerPin $ClaimPath $ClaimSha256);$rootSnapshot=Json (ReadWorkerPin $AdmittedSnapshotPath $AdmittedSnapshotSha256);AssertCurrentB007LiveAdmission $live $claim $rootSnapshot\n  Set-Variable -Name continuationLiveAdmission -Scope Script -Option ReadOnly -Value (Json ([Text.Encoding]::UTF8.GetBytes(($live|ConvertTo-Json -Depth 25 -Compress))))";
 const withoutDigest=text=>text.replace(/function ContinuationKeys\([^\n]+\n/,'').replace(/function CurrentB007OwnerDigestBindings[\s\S]*?(?=function AssertB264CutCurrentOwner)/,'').replace(/function AssertB264CutCurrentOwner[\s\S]*?(?=function DrainB264OldOwner)/,'');
 const originalRegion=old.slice(old.indexOf('function PausedRemainingCore{'),old.lastIndexOf('\nB264CutAuthority\n'));
 const currentRegion=s.slice(s.indexOf('function PausedRemainingCore{'),s.indexOf('function SeedCompleted42d0Admission(')).trimEnd();
 assert(s.includes(captureBinding));assert.equal(withoutDigest(currentRegion.replace(captureBinding,'  [void](CaptureWorkerAdmission);AssertB264CutCurrentOwner').replace("function Authority{if($Mode -cin @('ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck')){[void](AssertCompleted42d0Authority)}else{B264CutAuthority}}",'function Authority{B264CutAuthority}')),withoutDigest(originalRegion.trimEnd()));
 assert.match(s,/ValidateSet\('CurrentB007InspectOnly'\)/);assert.match(s,/'ContinuationPath','ContinuationSha256'\|/);
 assert(!s.includes('$ownerAge='));assert.match(s,/snapshotAge -lt 60/);
 assert.match(s,/AssertCurrentB007InspectionContract \$profile \$before/);
});
const liveFixture=String.raw`
function WorkerSamePin($a,$b){return B264Same $a $b}
function SetupLive{
 Reset;$script:order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative');$ids=[ordered]@{}
 foreach($n in 0..7){$ids[$order[$n]]=[pscustomobject]@{pid=100+$n;bindings=@()}}
 $before.identities=[pscustomobject]$ids;$oldBefore.identities=Clone $before.identities
 $profile.oldWatchers=@([pscustomobject]@{pid=108},[pscustomobject]@{pid=109});$oldProfile.oldWatchers=$profile.oldWatchers
 $script:live=[pscustomobject]@{schemaVersion=$snapshot.schemaVersion;profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;engineSha256=$EngineSha256;recoveryHelperSha256=$RecoveryHelperSha256;oldIdentities=@($order|ForEach-Object{$before.identities.$_});oldWatchers=@($profile.oldWatchers);observedAt=[DateTime]::UtcNow.ToString('o')}
}
`;
test('native live frame rejects stale/future/foreign identities and cannot arrive through a CLI parameter',()=>{
 const edits=["$live.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')","$live.observedAt=[DateTime]::UtcNow.AddMinutes(1).ToString('o')","$live.profileSha256='wrong'","$live.oldIdentities=@()","$live.oldWatchers=@([pscustomobject]@{pid=108},[pscustomobject]@{pid=108})"];
 const output=run(liveFixture+'\n'+edits.map((e,n)=>`SetupLive;${e};try{AssertCurrentB007LiveAdmission $live $claim $snapshot;'CASE${n}=ACCEPTED'}catch{'CASE${n}='+$_.Exception.Message}`).join('\n'));
 for(let n=0;n<edits.length;n++)assert.match(output,new RegExp('CASE'+n+'=P03_PHYSICAL_'));
 const s=readFileSync(source,'utf8');assert(!s.slice(0,s.indexOf('\n)')).includes('continuationLiveAdmission'));
});
test('Drain SQL selection tolerates exactly the real mixed shape of one SQL and three nonSQL protected rows under StrictMode',()=>{
 const s=readFileSync(source,'utf8'),authority=s.slice(s.indexOf('function B264CutAuthority{'),s.indexOf('function PausedRemainingCore{'));
 const expression=authority.match(/@\(\$profile\.protectedProcesses\|Where-Object\{[^}]+\}\)\[0\]/)?.[0];assert(expression);
 const out=run(`$profile=[pscustomobject]@{protectedProcesses=@([pscustomobject]@{kind='ProtectedSqlService';pid=900},[pscustomobject]@{pid=901},[pscustomobject]@{pid=902},[pscustomobject]@{pid=903})};$selected=${expression};if($selected.pid-ne900){throw 'FIXTURE_SQL_WRONG'};'EXACT_SQL_SELECTED'`);
 assert.match(out,/EXACT_SQL_SELECTED/);
});
test('root snapshot remains pinned but genuine one-time native capture owns subsequent freshness within the unchanged PRECOM window',()=>{
 const code=liveFixture+String.raw`
SetupLive
$script:ClaimSha256='claim';$script:RootIntentSha256='root-intent';$script:b264CutComPins=@();$data[$ClaimPath]=$claim;$hashes[$ClaimPath]=$ClaimSha256
$script:coreLifetime=$null;$script:precutWindowOpenedAt=$null;$script:comCalls=0;$script:trace=@();$script:disposed=$false;$script:expiredPrecom=$false
function Authority{AssertCurrentB007Continuation $claim}
function PrepareProbeSource{}
function SeedWorkerAdmission($value){$age=([DateTime]::UtcNow-[DateTime]::Parse($value.observedAt).ToUniversalTime()).TotalSeconds;Need ($age -ge 0 -and $age -lt 60) 'ROOT_SEED_FRESH';$script:trace+=,'SEED'}
function Test-Path{param($LiteralPath);return $false}
function HoldWorkerCore($core){$held=[pscustomobject]@{HasExited=$false};$held|Add-Member ScriptMethod Dispose {$script:disposed=$true};return $held}
function CaptureWorkerAdmission{Authority;$script:trace+=,'CAPTURE';$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o');$live.observedAt=[DateTime]::UtcNow.ToString('o');return $live}
function AssertB264CutCurrentOwner{$script:trace+=,'OWNER_DIGEST'}
function WriteB264CutEvidence($leaf,$value){Authority;if($script:expiredPrecom){$script:precutWindowOpenedAt=[DateTime]::UtcNow.AddSeconds(-61)};return @{path='fixture';sha256=('a'*64)}}
function StopB264OldCom{Authority;$script:comCalls++;throw 'FIXTURE_STOP_BEFORE_NATIVE_COM'}
try{DrainB264OldOwner}catch{'RESULT='+$_.Exception.Message}
'COM='+$comCalls;'TRACE='+($trace-join '|');'HELD='+($null-ne$continuationLiveAdmission);'DISPOSED='+$disposed
try{Set-Variable -Name continuationLiveAdmission -Scope Script -Value $null;'RENEWED'}catch{'READONLY_RENEWAL_REJECTED'}
`;
 const out=run(code);
 assert.match(out,/RESULT=FIXTURE_STOP_BEFORE_NATIVE_COM/);assert.match(out,/COM=1/);assert.match(out,/TRACE=SEED\|CAPTURE\|OWNER_DIGEST/);assert.match(out,/HELD=True/);assert.match(out,/DISPOSED=True/);assert.match(out,/READONLY_RENEWAL_REJECTED/);assert(!out.includes('\nRENEWED'));
 const expired=run(code.replace('$script:expiredPrecom=$false','$script:expiredPrecom=$true'));
 assert.match(expired,/RESULT=P03_PHYSICAL_B264_CUT_PRECOM_WINDOW/);assert.match(expired,/COM=0/);assert.match(expired,/DISPOSED=True/);
});
const resumeFixture=String.raw`
function SetupResume{
 Reset;$script:resumeRun='452054204a1857ff618b0dd30a59caea';$script:resumeDir=Join-Path $base ('MelisaERP-P03-transition-'+$resumeRun)
 $retainedProfile=Clone $profile;$retainedBefore=Clone $before;$retainedBefore.runId=$resumeRun;$retainedBefore.startedAt=[DateTime]::UtcNow.AddMinutes(-6).ToString('o');$retainedBefore.observedAt=[DateTime]::UtcNow.AddMinutes(-5).ToString('o')
 $before.startedAt=[DateTime]::UtcNow.AddSeconds(-1).ToString('o');$before.observedAt=[DateTime]::UtcNow.ToString('o');$profile.journalDirectory=Join-Path $base ('MelisaERP-P03-recovery-'+$runId);$profile.stopper.path=Join-Path $base ('MelisaERP-P03-stopper-'+$runId+'.ps1');$profile.beforeImage=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256}
 $profileRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$resumeRun+'.json'));sha256='4b808868f23ced8015aad4395a7c390017b374d3c23fe23d48fc6bf7f0397c39'}
 $beforeRef=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$resumeRun+'.json'));sha256='23ae28bc8d01f644c9f56404c6b358bc57afec336bb82bb3ad19158f2bd11d3f'}
 $script:ClaimSha256='a5990db676c6308e0899d81a2f6efdde539544109762802d62137d9ec853e544'
 $claim|Add-Member NoteProperty successorRunId $resumeRun;$claim|Add-Member NoteProperty successorProfile $profileRef;$claim|Add-Member NoteProperty successorBefore $beforeRef
 $script:context=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-precut-resume.v1';retainedClaimRef=[pscustomobject]@{path=$ClaimPath;sha256=$ClaimSha256};failureTailRef=[pscustomobject]@{path=(Join-Path $resumeDir 'event-0002.json');sha256='778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777'};retainedProfileRef=$profileRef;retainedBeforeRef=$beforeRef;profileRef=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};beforeRef=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};claimPath=$ClaimPath}
 foreach($entry in @(@($ClaimPath,$ClaimSha256,(Clone $claim)),@($profileRef.path,$profileRef.sha256,$retainedProfile),@($beforeRef.path,$beforeRef.sha256,$retainedBefore),@($ContinuationPath,$ContinuationSha256,$context),@((Join-Path $resumeDir 'resume-attempt.json'),$ContinuationSha256,(Clone $context)))){$data[$entry[0]]=$entry[2];$hashes[$entry[0]]=$entry[1]}
 $data[$ProfilePath]=$profile;$hashes[$ProfilePath]=$ProfileSha256;$data[$BeforeImagePath]=$before;$hashes[$BeforeImagePath]=$BeforeImageSha256
 $lock=[pscustomobject]@{profileRef=$profileRef;beforeRef=$beforeRef;successorClaimRef=$context.retainedClaimRef};$lockPath=Join-Path $resumeDir 'transition.lock';$data[$lockPath]=$lock;$hashes[$lockPath]='349cf763daa3c4cca0856640d48d82ed3c034325d0ad476b4019a31d7374eb73'
 $oldContext=$data[$ContinuationPath];$prior=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-precut-continuation.v1';retainedClaimRef=[pscustomobject]@{path=(Join-Path $base 'p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json');sha256='3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408'};failureTailRef=[pscustomobject]@{path=(Join-Path $failedDir 'event-0002.json');sha256='87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82'}}
 $data[(Join-Path $resumeDir 'precut-continuation.json')]=$prior;$hashes[(Join-Path $resumeDir 'precut-continuation.json')]='edd1499034512d99153cff12d787a041571195cc59e3a1b01f94bc00dea6b7c1'
 $previous=$beforeRef.sha256;$eventHashes=@('18a78709172e036d3d9f452438af4cf9e21f39c89679271094447f44463da02a','741ea2a53a304ba27aff7bcade2548effa22a63e72ccbcf920189e4c6718330c','778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777')
 foreach($n in 0..2){$p=Join-Path $resumeDir ('event-'+$n.ToString('0000')+'.json');$data[$p]=[pscustomobject]@{sequence=$n;previousSha256=$previous;profileSha256=$profileRef.sha256;beforeSha256=$beforeRef.sha256;digest=$before.plan.digest;stopOrderDigest=$claim.stopOrderDigest;event=@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n];target=@('','coreSupervisor','HELD_CORE_CUT')[$n]};$hashes[$p]=$eventHashes[$n];$previous=$eventHashes[$n]}
 $script:resumeFiles=@('b264-old-owner-cut-intent.json','event-0000.json','event-0001.json','event-0002.json','io-failure-diagnostic.json','p03-current-invariance-capture.ps1','p03-physical-recovery-observe.ps1','p03-physical-rollback-lifetime-v2.ps1','p03-pr54-current-b007-precut-cut.ps1','p03-pr54-current-b007-precut-new-recovery.ps1','p03-pr54-new-owner-empty-recovery.ps1','p03-pr54-new-owner-observe.ps1','p03-pr54-paused-old-recover.ps1','p03-pr54-successor-core-drain.ps1','precut-continuation.json','successor-precut-admission.json','transition.lock','resume-attempt.json')
}
function Get-ChildItem{param($LiteralPath,[switch]$File,[switch]$Force);if($LiteralPath -ceq $resumeDir){return $resumeFiles|ForEach-Object{[pscustomobject]@{Name=$_}}};if($LiteralPath -ceq $failedDir){return $files|ForEach-Object{[pscustomobject]@{Name=$_}}};if($LiteralPath -ceq 'new-journal' -or $LiteralPath -ceq 'old-journal'){return @()};throw 'FIXTURE_DIRECTORY'}
`;
test('same452 retained claim resume requires its one-time pointer and preserves bytes/clock while binding fresh supplemental state',()=>{
 const out=run(resumeFixture+"\nSetupResume;$original=$claim|ConvertTo-Json -Depth 30 -Compress;$oldClock=$claim.ownerObservedAt;AssertCurrentB007Continuation $claim;if(($claim|ConvertTo-Json -Depth 30 -Compress)-cne$original-or$claim.ownerObservedAt-cne$oldClock){throw 'CLAIM_CHANGED'};'RESUME_SAME_CLAIM_FRESH_NATIVE_CONTEXT'");
 assert.match(out,/RESUME_SAME_CLAIM_FRESH_NATIVE_CONTEXT/);
});
test('same452 resume rejects foreign context, rewritten claim, stale snapshot/before, missing pins and advanced/duplicated scopes before mutation',()=>{
 const edits=["$context.claimPath+='x'","$context.retainedClaimRef.sha256='wrong'","$claim.ownerObservedAt=[DateTime]::UtcNow.ToString('o')","$before.identities=@('changed')","$profile.protectedProcesses=@('changed')","$before.observedAt=[DateTime]::UtcNow.AddMinutes(-16).ToString('o');$before.startedAt=$before.observedAt","$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')","$data.Remove((Join-Path $resumeDir 'resume-attempt.json'))","$resumeFiles+=,'event-0003.json'","$context|Add-Member NoteProperty extra $true","$hashes[(Join-Path $resumeDir 'event-0001.json')]='wrong'","$resumeFiles+=,'resume-attempt.json'"];
 const out=run(resumeFixture+'\n'+edits.map((e,n)=>`SetupResume;${e};try{AssertCurrentB007Continuation $claim;'CASE${n}=ACCEPTED'}catch{'CASE${n}=REJECTED'}`).join('\n'));
 for(let n=0;n<edits.length;n++)assert.match(out,new RegExp('CASE'+n+'=REJECTED'));
});
test('resume claim epoch gates select retained refs only for the explicit resume schema',()=>{
 const s=readFileSync(source,'utf8'),authority=s.slice(s.indexOf('function B264CutAuthority{'),s.indexOf('function PausedRemainingCore{'));
 assert.match(authority,/if\(\$bindingContext.schemaVersion -cin @\('melisa-p03-current-b007-precut-resume.v1','melisa-p03-current-b007-precut-retry.v1'\)\)\{\$claimBinding=AssertCurrentB007ResumeBinding \$bindingContext \$claim\}/);
 assert.match(authority,/\$claim.successorRunId -ceq \$claimBinding.runId/);assert.match(authority,/\$claim.successorProfile.sha256 -ceq \$claimBinding.profileRef.sha256/);assert.match(authority,/Parse\(\$claimBinding.before.observedAt\)/);
 assert(!authority.includes('$claim.ownerObservedAt='));assert(!authority.includes('$claim.successorRunId='));
});

const retryFixture=String.raw`
function SetupRetry{
 SetupResume;$script:retryRun='9d2e00d572acc83391a0a2e5ac28d046';$script:retryDir=Join-Path $base ('MelisaERP-P03-transition-'+$retryRun)
 $roles=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative');$ids=[ordered]@{};foreach($n in 0..7){$ids[$roles[$n]]=[pscustomobject][ordered]@{pid=100+$n;parentPid=99;ownerSid='fixture-owner';nodePath='C:\fixture\node.exe';commandLine=('fixture-'+$roles[$n]);creationTime='2026-10-20T09:00:00.1234567Z';bindings=@()}}
 $settings=[pscustomobject]@{path='fixed-settings';sha256=('8'*64)};$watchers=@([pscustomobject]@{pid=108;parentPid=98;ownerSid='fixture-owner';nodePath='powershell';commandLine='terminal-watcher';creationTime='2026-10-20T09:00:00.1234567Z';role='terminalWatcher'},[pscustomobject]@{pid=109;parentPid=98;ownerSid='fixture-owner';nodePath='powershell';commandLine='hub-watcher';creationTime='2026-10-20T09:00:00.1234567Z';role='hubWatcher'})
 $profile=[pscustomobject][ordered]@{schemaVersion='melisa-p03-physical-profile.v1';ownerSid='fixture-owner';database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';beforeImage=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};oldSettings='old';newSettings=$settings;packages=@(1..7|ForEach-Object{[pscustomobject]@{root=('package-'+$_);sourceCommit=('s'+$_);manifestSha256=('m'+$_)}});stopper=[pscustomobject]@{path=(Join-Path $base ('MelisaERP-P03-stopper-'+$runId+'.ps1'));sha256='same'};tasks=@([pscustomobject]@{name='Melisa-Terminal-Completion-Logon';oldXmlSha256='old-core';newXmlSha256='new-core'},[pscustomobject]@{name='Melisa-Hub-TEST-Web';oldXmlSha256='old-hub';newXmlSha256='new-hub'});candidateRules=@($roles|ForEach-Object{[pscustomobject]@{role=$_}});oldWatchers=$watchers;protectedProcesses=@([pscustomobject]@{kind='ProtectedSqlService';pid=900},[pscustomobject]@{pid=901},[pscustomobject]@{pid=902},[pscustomobject]@{pid=903});businessDigest=[pscustomobject]@{path='fresh-capture';sha256='capture'};journalDirectory=(Join-Path $base ('MelisaERP-P03-recovery-'+$runId));shell=[pscustomobject]@{path='powershell';sha256='shell'};health=@('old-health');candidateHealth=@('new-health')}
 $profile.beforeImage=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256}
 $before=[pscustomobject][ordered]@{schemaVersion='melisa-p03-owner-observation.v3';startedAt=[DateTime]::UtcNow.AddSeconds(-1).ToString('o');observedAt=[DateTime]::UtcNow.ToString('o');hubLineage=[pscustomobject]@{verified=$true};ownerSid='fixture-owner';database=$profile.database;copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';actualT1=$false;oldConfig=$profile.oldSettings;oldSupervisor='old-sup';identities=[pscustomobject]$ids;tasks=@([pscustomobject]@{name='Melisa-Terminal-Completion-Logon';state=4;xml='core'},[pscustomobject]@{name='Melisa-Hub-TEST-Web';state=4;xml='hub'});runId=$runId;newConfig=$settings;plan=[pscustomobject]@{digest='same-plan'};profile=[pscustomobject]@{erpSource='fixed-erp';crmSource='fixed-crm';supervisorSource='fixed-sup'}}
 $claim=[pscustomobject][ordered]@{schemaVersion='melisa-p03-current-b007-epoch-claim.v1';currentOwnerDigest=('3'*64);ownerObservedAt=[DateTime]::UtcNow.AddMinutes(-5).ToString('o');protectedSqlEpoch=$profile.protectedProcesses[0];predecessorRunId='b264594b6f93d560d807c8decc4e6699';predecessorProfile=[pscustomobject]@{path='prior-profile';sha256='prior-profile'};predecessorBefore=[pscustomobject]@{path='prior-before';sha256='prior-before'};predecessorLock=[pscustomobject]@{path='prior-lock';sha256='prior-lock'};consumedAncestorClaim=[pscustomobject]@{path='ancestor';sha256='ancestor'};failedOuterTail=[pscustomobject]@{path='tail';sha256='tail'};quarantinedRecoveryTail=[pscustomobject]@{path='recovery-tail';sha256='recovery-tail'};readOnlyOldReady=[pscustomobject]@{path='ready';sha256='ready'};successorRunId=$resumeRun;successorProfile=$context.retainedProfileRef;successorBefore=$context.retainedBeforeRef;newSettings=$settings;candidate=[pscustomobject]@{erpSource='fixed-erp';erpManifest='erp-manifest';crmSource='fixed-crm';crmManifest='crm-manifest';supervisorSource='fixed-sup';supervisorManifest='sup-manifest';supervisorRoot='sup-root';newSettings=$settings};stopOrderDigest='same-stop';transitionAuthority=$true;applyExecuted=$false}
 $retainedProfile=Clone $profile;$retainedProfile.beforeImage=$context.retainedBeforeRef;$retainedProfile.businessDigest=[pscustomobject]@{path='old-capture';sha256='capture'};$retainedProfile.journalDirectory='old-journal';$retainedProfile.stopper.path='old-stopper'
 $retainedBefore=Clone $before;$retainedBefore.runId=$resumeRun;$retainedBefore.startedAt=[DateTime]::UtcNow.AddMinutes(-6).ToString('o');$retainedBefore.observedAt=[DateTime]::UtcNow.AddMinutes(-5).ToString('o')
 $data[$context.retainedProfileRef.path]=$retainedProfile;$data[$context.retainedBeforeRef.path]=$retainedBefore;$data[$ClaimPath]=Clone $claim
 $priorProfileRef=[pscustomobject][ordered]@{path=(Join-Path $base ('MelisaERP-P03-profile-'+$retryRun+'.json'));sha256='ed2c3ad7a253f749bf284ccc6aabe34535a28e3f2f0b71484583387082674c12'};$priorBeforeRef=[pscustomobject][ordered]@{path=(Join-Path $base ('MelisaERP-P03-before-'+$retryRun+'.json'));sha256='97252544d7ff98c0ed3d908bcf785f89cb2bb65dd3f6c79587653f433e740c04'}
 $priorProfile=Clone $profile;$priorProfile.beforeImage=$priorBeforeRef;$priorProfile.stopper.path=Join-Path $base ('MelisaERP-P03-stopper-'+$retryRun+'.ps1');$priorProfile.journalDirectory=Join-Path $base ('MelisaERP-P03-recovery-'+$retryRun);$priorProfile.businessDigest=[pscustomobject]@{path='prior-capture';sha256='capture'}
 $priorBefore=Clone $before;$priorBefore.runId=$retryRun;$priorBefore.startedAt=[DateTime]::UtcNow.AddMinutes(-3).ToString('o');$priorBefore.observedAt=[DateTime]::UtcNow.AddMinutes(-2).ToString('o')
 $priorContext=Clone $context;$priorContext.profileRef=$priorProfileRef;$priorContext.beforeRef=$priorBeforeRef
 $context.schemaVersion='melisa-p03-current-b007-precut-retry.v1';$context.failureTailRef=[pscustomobject]@{path=(Join-Path $retryDir 'event-0002.json');sha256='74d1c6dcdd5597935a9a8f2b814aef4e8167880bbc2c9ebea469d07f8f85af26'}
 $contextSha='7f07000256ed4b1289f36fe5a2290bdfa71e125ff976276f1135b42f0ba4012c';$priorContextRef=[pscustomobject][ordered]@{path=(Join-Path $retryDir 'precut-continuation.json');sha256=$contextSha}
 foreach($entry in @(@($ProfilePath,$ProfileSha256,$profile),@($BeforeImagePath,$BeforeImageSha256,$before),@($priorProfileRef.path,$priorProfileRef.sha256,$priorProfile),@($priorBeforeRef.path,$priorBeforeRef.sha256,$priorBefore),@($ContinuationPath,$ContinuationSha256,$context),@($priorContextRef.path,$contextSha,$priorContext),@((Join-Path $resumeDir 'resume-attempt.json'),$contextSha,(Clone $priorContext)),@((Join-Path $retryDir 'resume-attempt.json'),$ContinuationSha256,(Clone $context)))){$data[$entry[0]]=$entry[2];$hashes[$entry[0]]=$entry[1]}
 $lock=[pscustomobject][ordered]@{profileRef=$priorProfileRef;beforeRef=$priorBeforeRef;currentPreCapture=[pscustomobject]@{snapshotRef='snapshot';proofRef='proof';backupProofRef='backup'};rehearsalProofRef=[pscustomobject]@{path='fixed-proof';sha256='fixed-proof'};successorClaimRef=$context.retainedClaimRef;sourceControlDir='fixed-control';continuationRef=$priorContextRef}
 $snapshot9d=[pscustomobject][ordered]@{schemaVersion='melisa-p03-successor-precut-admission.v1';profileSha256=$priorProfileRef.sha256;beforeSha256=$priorBeforeRef.sha256;engineSha256='b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f';recoveryHelperSha256='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5';observedAt=$priorBefore.observedAt;oldIdentities=@($roles|ForEach-Object{$priorBefore.identities.$_});oldWatchers=@($priorProfile.oldWatchers);consolePins=@();probePins=@();protectedConsolePins=@()}
 $diag=[pscustomobject][ordered]@{phase='HELD_CORE_CUT';reason='P03_OWNER_TRANSITION_STOPPED';failureDiagnostic=[pscustomobject]@{stage='DRAIN';reason='P03_PHYSICAL_B264_CUT_OWNER_DIGEST'};profileSha256=$priorProfileRef.sha256;beforeSha256=$priorBeforeRef.sha256}
 $intent=[pscustomobject][ordered]@{event='B264_OLD_CUT_INTENT';claimSha256=$ClaimSha256;stopOrderDigest=$claim.stopOrderDigest;profileSha256=$priorProfileRef.sha256;beforeSha256=$priorBeforeRef.sha256;observedAt=$priorBefore.observedAt}
 foreach($entry in @(@('transition.lock','a125f57f3d97993ede102504faf379a373be67a1178d53770fb2f3f2916b4255',$lock),@('successor-precut-admission.json','9207fb109e6b2cfe03b9791ed5f1b2e88b100c052094e86350819d83b1550584',$snapshot9d),@('io-failure-diagnostic.json','f65e6e001f7c936d4577b45d70de97565f603eef8900d18227315d2388148cea',$diag),@('b264-old-owner-cut-intent.json','33535a3f165c03892bfb3a225d6ec2ae91b96f47fd2a949b9cf1afa7e2576ee9',$intent))){$p=Join-Path $retryDir $entry[0];$data[$p]=$entry[2];$hashes[$p]=$entry[1]}
 $eventHashes=@('3c25d1da4017da7576cc15dd4a7cb603718cc1a4674897a52048bc56dc703b1f','58741b0f6db3a7596d35d04089d178090412c6f722f9a59a9f09f54d51d519bc','74d1c6dcdd5597935a9a8f2b814aef4e8167880bbc2c9ebea469d07f8f85af26');$previous=$priorBeforeRef.sha256
 foreach($n in 0..2){$p=Join-Path $retryDir ('event-'+$n.ToString('0000')+'.json');$e=[ordered]@{sequence=$n;digest=$before.plan.digest;event=@('TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED')[$n];stopOrderDigest=$claim.stopOrderDigest};if($n-gt0){$e['target']=@('coreSupervisor','HELD_CORE_CUT')[$n-1]};$e['previousSha256']=$previous;$e['profileSha256']=$priorProfileRef.sha256;$e['beforeSha256']=$priorBeforeRef.sha256;$data[$p]=[pscustomobject]$e;$hashes[$p]=$eventHashes[$n];$previous=$eventHashes[$n]}
 $script:retryFiles=@($resumeFiles);$script:profile=$profile;$script:before=$before;$script:claim=$claim
}
function Get-ChildItem{param($LiteralPath,[switch]$File,[switch]$Force);if($LiteralPath -ceq $retryDir){return $retryFiles|ForEach-Object{[pscustomobject]@{Name=$_}}};if($LiteralPath -ceq $resumeDir){return $resumeFiles|ForEach-Object{[pscustomobject]@{Name=$_}}};if($LiteralPath -ceq $failedDir){return $files|ForEach-Object{[pscustomobject]@{Name=$_}}};if($LiteralPath-ceq'old-journal'-or$LiteralPath-ceq'new-journal'-or$LiteralPath-ceq(Join-Path $base ('MelisaERP-P03-recovery-'+$retryRun))){return @()};throw 'FIXTURE_DIRECTORY'}
`;
test('fixed9d2 retry binds full native profile context and unchanged452 claim with two separate one-time pointer hashes',()=>{
 const out=run(resumeFixture+'\n'+retryFixture+"\nSetupRetry;$saved=$claim|ConvertTo-Json -Depth 30 -Compress;$old=$data[(Join-Path $resumeDir 'resume-attempt.json')]|ConvertTo-Json -Depth 30 -Compress;AssertCurrentB007Continuation $claim;if(($saved-cne($claim|ConvertTo-Json -Depth 30 -Compress))-or($old-cne($data[(Join-Path $resumeDir 'resume-attempt.json')]|ConvertTo-Json -Depth 30 -Compress))){throw 'RETAINED_CHANGED'};'RETRY_FIXED9D2_SAME452_TWO_POINTERS'");assert.match(out,/RETRY_FIXED9D2_SAME452_TWO_POINTERS/);
});
test('fixed9d2 retry rejects every historical pin drift, wrong reason, extra cut evidence, pointer replay and fresh admission expiry',()=>{
 const edits=["$context.failureTailRef.sha256='wrong'","$hashes[(Join-Path $resumeDir 'resume-attempt.json')]='wrong'","$hashes[(Join-Path $retryDir 'precut-continuation.json')]='wrong'","$data[(Join-Path $retryDir 'io-failure-diagnostic.json')].failureDiagnostic.reason='OTHER'","$data[(Join-Path $retryDir 'event-0001.json')].previousSha256='wrong'","$data[(Join-Path $retryDir 'transition.lock')].successorClaimRef.sha256='wrong'","$data[(Join-Path $retryDir 'successor-precut-admission.json')].oldIdentities=@()","$data[(Join-Path $retryDir 'b264-old-owner-cut-intent.json')].claimSha256='wrong'","$data.Remove((Join-Path $retryDir 'resume-attempt.json'))","$retryFiles+=,'successor-core-cut-completed.json'","$retryFiles+=,'resume-attempt.json'","$resumeFiles+=,'event-0003.json'","$before.observedAt=[DateTime]::UtcNow.AddMinutes(-16).ToString('o');$before.startedAt=$before.observedAt","$snapshot.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')","$profile.tasks=@('changed')"];
 const out=run(resumeFixture+'\n'+retryFixture+'\n'+edits.map((e,n)=>'SetupRetry;'+e+";try{AssertCurrentB007Continuation $claim;'RETRY"+n+"=ACCEPTED'}catch{'RETRY"+n+"=REJECTED'}").join('\n'));for(let n=0;n<edits.length;n++)assert.match(out,new RegExp('RETRY'+n+'=REJECTED'));
});

test('completed-cut recovery has an explicit read-only ResumeDrain dispatcher and exactly two finite OLD finalization modes',()=>{const s=readFileSync(source,'utf8');assert.match(s,/ValidateSet\('Inspect','Drain','ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck','FinalizeOld42d0Inspect','FinalizeOld42d0Apply','ObserveStartedOld'\)/);assert.match(s,/if\(\$Mode -cin @\('ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck'\)\)\{ResumeCompleted42d0Drain/)});
const completedExtract=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(source))},[ref]$tokens,[ref]$errors);if($errors.Count){throw 'FIXTURE_PARSE'}
foreach($name in @('ContinuationKeys','Completed42d0Pins','AssertCompleted42d0Authority','ResumeCompleted42d0Drain')){$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));if($defs.Count-ne1){throw 'FIXTURE_FUNCTION'};$body=$defs[0].Extent.Text;if($name-ceq'AssertCompleted42d0Authority'){$body=$body.Replace('$PSCommandPath','$script:fixtureWorkerPath')};. ([scriptblock]::Create($body))}`;
const completedFixture=String.raw`
function Need($v,$c){if(-not$v){throw ('P03_PHYSICAL_'+$c)}}
function Json($bytes){return [Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json}
function ReadWorkerPin($p,$s){$script:reads++;if(-not$data.ContainsKey($p)-or$hashes[$p]-cne$s){throw 'FIXTURE_PIN'};return ,[Text.Encoding]::UTF8.GetBytes(($data[$p]|ConvertTo-Json -Depth 30 -Compress))}
function AssertCurrentB007StaticContract{$script:staticChecks++}
function AssertB264CutStopPlan{}
function B264CutHistoryPins{return @{}}
function Test-Path{param($LiteralPath);return $script:exists.ContainsKey($LiteralPath)}
function PrepareProbeSource{}
function SeedCompleted42d0Admission($snapshot){$script:consolePins[4900]=@{};$script:seeded++;if($snapshot.schemaVersion-cne'melisa-p03-successor-precut-admission.v1'){throw 'FIXTURE_BAD_SEED'}}
function Completed42d0AuxProof($snapshot){return [pscustomobject]@{replacementEpochDigest=('a'*64);historicalConsolePins=@();observedAt=[DateTime]::UtcNow.ToString('o');family=@();ancestors=@()}}
function Inventory{return [pscustomobject]@{all=$script:raw}}
function ProtectedProcesses($i){$script:protectedChecks++}
function Identity($p,$e){return $p.ProcessId-eq$e.pid -and $p.match-ceq$true}
function RecoveredRemainingCore{
 $script:remainingChecks++;[void](AssertCompleted42d0Authority)
 foreach($w in $profile.oldWatchers){Need (@($raw|Where-Object{$_.ProcessId-eq$w.pid}).Count-eq0) 'FIXTURE_WATCHER_PRESENT'}
 foreach($r in $order){$e=$before.identities.$r;$rows=@($raw|Where-Object{$_.ProcessId-eq$e.pid});if($e.pid-in$script:drainedPids){Need ($rows.Count-eq0) 'FIXTURE_REAPPEARED'}else{Need ($rows.Count-eq1-and(Identity $rows[0] $e)) 'FIXTURE_REUSED'}}
 if($script:foreignProbe){throw 'FIXTURE_UNKNOWN_LATE_PROBE'}
 return [pscustomobject]@{all=$script:raw}
}
function WriteB264CutEvidence($leaf,$value){$script:writes++;$script:written=$value;return @{path=(Join-Path $dir $leaf);sha256='fixture-write'}}
function SetupCompleted{
 $script:Mode='ResumeDrainDryRun';$script:PolicyGeneration='CurrentB007InspectOnly';$script:base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:runId='42d0d0536cb115cc4aea43ff1f13afbf';$script:dir=Join-Path $base ('MelisaERP-P03-transition-'+$runId)
 $pins=Completed42d0Pins;$script:data=@{};$script:hashes=@{};$script:exists=@{};$script:reads=0;$script:writes=0;$script:staticChecks=0;$script:protectedChecks=0;$script:seeded=0;$script:remainingChecks=0;$script:foreignProbe=$false;$script:probePins=@{};$script:consolePins=@{};$script:protectedConsolePins=@{}
 foreach($k in $pins.Keys){$data[$pins[$k].path]=[pscustomobject]@{};$hashes[$pins[$k].path]=$pins[$k].sha256}
 $script:ProfilePath=$pins.profile.path;$script:ProfileSha256=$pins.profile.sha256;$script:BeforeImagePath=$pins.before.path;$script:BeforeImageSha256=$pins.before.sha256;$script:ClaimPath=$pins.claim.path;$script:ClaimSha256=$pins.claim.sha256;$script:ContinuationPath=$pins.context.path;$script:ContinuationSha256=$pins.context.sha256;$script:RootIntentPath=$pins.root.path;$script:RootIntentSha256=$pins.root.sha256;$script:AdmittedSnapshotPath=$pins.snapshot.path;$script:AdmittedSnapshotSha256=$pins.snapshot.sha256
 $script:EnginePath=Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1';$script:EngineSha256='engine';$script:RecoveryHelperPath=Join-Path $dir 'p03-pr54-paused-old-recover.ps1';$script:RecoveryHelperSha256='helper';$script:DrainerPath='drainer';$script:DrainerSha256='drainer';foreach($r in @(@($EnginePath,$EngineSha256),@($RecoveryHelperPath,$RecoveryHelperSha256),@($DrainerPath,$DrainerSha256))){$data[$r[0]]=@{};$hashes[$r[0]]=$r[1]}
 $script:order=@('coreSupervisor','hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative');$ids=[ordered]@{};foreach($n in 0..7){$ids[$order[$n]]=[pscustomobject]@{pid=100+$n;parentPid=1;nodePath='fixture';ownerSid='fixture';commandLine='fixture';creationTime='2026-10-20T00:00:00Z'}}
 $script:before=[pscustomobject]@{observedAt='2026-10-21T11:52:05.1176953Z';identities=[pscustomobject]$ids};$script:profile=[pscustomobject]@{oldWatchers=@([pscustomobject]@{pid=108},[pscustomobject]@{pid=109})};$script:oldSettings=@{};$script:newSettings=@{};$data[$ProfilePath]=$profile;$data[$BeforeImagePath]=$before
 $script:cut=[pscustomobject]@{event='B264_OLD_OWNER_CORE_CUT_COMPLETED';heldProcessHandle=$true;processAbsent=$true;mechanism='EXACT_OBSERVED_PROCESS_STOPPED';profileSha256=$ProfileSha256;beforeSha256=$BeforeImageSha256;claimSha256=$ClaimSha256;durableIntent=$pins.held;core=$ids.coreSupervisor;windowOpenedAt='2026-10-21T12:05:42.059177Z';cutCompletedAt='2026-10-21T12:06:36.3074653Z'}
 $data[$pins.cut.path]=$cut;$data[$pins.held.path]=[pscustomobject]@{heldProcessHandle=$true;rootIntentSha256=$pins.root.sha256;admittedSnapshotSha256=$pins.snapshot.sha256;windowOpenedAt=$cut.windowOpenedAt;core=$ids.coreSupervisor}
 $data[$pins.root.path]=[pscustomobject]@{claimSha256=$ClaimSha256;stopOrderDigest='stop';observedAt='2026-10-21T12:05:31.138Z'};$data[$pins.snapshot.path]=[pscustomobject]@{schemaVersion='melisa-p03-successor-precut-admission.v1';observedAt='2026-10-21T12:05:30.2257717Z'};$data[$pins.claim.path]=[pscustomobject]@{stopOrderDigest='stop'}
 $data[$pins.context.path]=[pscustomobject]@{retainedProfileRef=$pins.profile;retainedBeforeRef=$pins.before;failureTailRef=$pins.tail};$data[$pins.tail.path]=[pscustomobject]@{event='FAILED'};$data[$pins.diagnostic.path]=[pscustomobject]@{failureDiagnostic=[pscustomobject]@{stage='DRAIN';reason='P03_PHYSICAL_B264_CUT_INTENT_FRESH'}}
 $script:raw=@(1..7|ForEach-Object{[pscustomobject]@{ProcessId=100+$_;ParentProcessId=1;match=$true}})
}
function CompletedOutcome{try{$r=ResumeCompleted42d0Drain;return $r.status}catch{return $_.Exception.Message}}
`;
test('completed-cut DryRun validates the actual expired 42d0 window shape and remaining seven without mutation or pretending a held handle',()=>{
 const out=run(completedExtract+'\n'+completedFixture+"\nSetupCompleted;'RESULT='+(CompletedOutcome);'WRITES='+$writes;'READS='+$reads;'REMAINING_CHECKS='+$remainingChecks;'SEEDED='+$seeded");assert.match(out,/RESULT=B264_COMPLETED_CUT_RESUME_DRY_RUN[\s\S]*WRITES=0[\s\S]*READS=\d+[\s\S]*REMAINING_CHECKS=1[\s\S]*SEEDED=1/);
});
test('completed-cut recovery rejects wrong proof, original window, core/remaining identity, watcher, probe and consumed evidence before writes',()=>{
 const edits=["$ProfileSha256='foreign'","$hashes[(Completed42d0Pins).cut.path]='foreign'","$cut.heldProcessHandle=$false","$cut.core=[pscustomobject]@{pid=999}","$cut.cutCompletedAt='2026-10-21T12:06:42.059177Z'","$before.observedAt='2026-10-21T11:50:42.059177Z'","$script:raw+=,[pscustomobject]@{ProcessId=100;ParentProcessId=1;match=$true}","$script:raw[0].match=$false","$script:raw+=,[pscustomobject]@{ProcessId=108;ParentProcessId=1;match=$true}","$script:foreignProbe=$true","$exists[(Join-Path $dir 'completed-cut-recovery-intent.json')]=$true","$exists[(Join-Path $dir 'successor-core-probe-drain.json')]=$true"];
 const out=run(completedExtract+'\n'+completedFixture+'\n'+edits.map((e,n)=>`SetupCompleted;${e};'CASE${n}='+(CompletedOutcome);'WRITES${n}='+$writes`).join('\n'));for(let n=0;n<edits.length;n++){assert(!out.includes('CASE'+n+'=B264_COMPLETED'),'case '+n);assert.match(out,new RegExp('WRITES'+n+'=0'));}
});
test('completed-cut seed preserves all existing seed checks and changes only the authenticated historical admission clock',()=>{
 const a=readFileSync(new URL('./p03-pr54-successor-core-drain.ps1',import.meta.url),'utf8').replaceAll('\r\n','\n'),b=readFileSync(source,'utf8').replaceAll('\r\n','\n');
 const original=a.slice(a.indexOf('function SeedWorkerAdmission('),a.indexOf('function HoldWorkerCore(')).trim();const actual=b.slice(b.indexOf('function SeedCompleted42d0Admission('),b.indexOf('function PausedTasks{')).trim();
 assert.equal(actual,original.replace('function SeedWorkerAdmission(','function SeedCompleted42d0Admission(').replace('([DateTime]::UtcNow-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime())','($script:completedCutOpenedAt-[DateTime]::Parse($snapshot.observedAt).ToUniversalTime())'));
 const resume=b.slice(b.indexOf('function ResumeCompleted42d0Drain{'),b.indexOf("if($Mode -cin @('ResumeDrain','ResumeDrainDryRun','ResumeDrainCheck')){ResumeCompleted42d0Drain"));assert(!/\b(?:StopWorkerCore|StopB264OldCom|HoldWorkerCore|Stop-Process|CaptureWorkerAdmission)\b/.test(resume));assert(!resume.includes('$script:coreLifetime='));
});
test('completed-cut Apply requires the single exact recovery intent and writes only one truthful drain witness',()=>{
 const setup=String.raw`
 SetupCompleted;$script:WorkerSourceSha256='worker';$script:Mode='ResumeDrain';$script:fixtureWorkerPath=Join-Path $base 'MelisaERP-P03-current-b007-control-aaaaaaaaaaaa\p03-pr54-current-b007-precut-cut.ps1';$pins=Completed42d0Pins
 $script:recoveryIntent=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-completed-cut-recovery.v1';mode='ROLLBACK_OLD_ONLY';runId=$runId;profileRef=$pins.profile;beforeRef=$pins.before;claimRef=$pins.claim;cutRef=$pins.cut;failureTailRef=$pins.tail;workerRef=[pscustomobject]@{path=$fixtureWorkerPath;sha256='worker'}}
 $intentPath=Join-Path $dir 'completed-cut-recovery-intent.json';$data[$intentPath]=$recoveryIntent;$hashes[$intentPath]='intent';$exists[$intentPath]=$true;$data[$fixtureWorkerPath]=@{};$hashes[$fixtureWorkerPath]='worker'
 function Get-FileHash{param($LiteralPath,$Algorithm);if(-not$hashes.ContainsKey($LiteralPath)){throw 'FIXTURE_MISSING_HASH'};return [pscustomobject]@{Hash=$hashes[$LiteralPath]}}
 `;
 const out=run(completedExtract+'\n'+completedFixture+'\n'+setup+"\n'RESULT='+(CompletedOutcome);'WRITES='+$writes;'EVENT='+$written.event;'CUT_SAME='+($written.cutWitness.sha256-ceq$pins.cut.sha256)");assert.match(out,/RESULT=B264_OLD_OWNER_CORE_DRAINED[\s\S]*WRITES=1[\s\S]*EVENT=B264_OLD_OWNER_CORE_PROBES_ABSENT[\s\S]*CUT_SAME=True/);
 const edits=["$recoveryIntent.mode='INSTALL_NEW'","$recoveryIntent.cutRef=@{path=$pins.cut.path;sha256='foreign'}","$recoveryIntent.workerRef.path='foreign'","$hashes[$fixtureWorkerPath]='foreign'","$data.Remove($intentPath)"];
 const negative=run(completedExtract+'\n'+completedFixture+'\n'+edits.map((e,n)=>`${setup}\n${e};'CASE${n}='+(CompletedOutcome);'WRITES${n}='+$writes`).join('\n'));for(let n=0;n<edits.length;n++){assert(!negative.includes('CASE'+n+'=B264_OLD_OWNER_CORE_DRAINED'),'case '+n);assert.match(negative,new RegExp('WRITES'+n+'=0'));}
});
const auxExtract=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(source))},[ref]$tokens,[ref]$errors);if($errors.Count){throw 'FIXTURE_PARSE'}
foreach($name in @('Completed42d0AuxEpochPins','Completed42d0AuxFrame','Completed42d0AuxAbsentFrame','Completed42d0AuxProof')){$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));. ([scriptblock]::Create($defs[0].Extent.Text))}
$ast=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url)))},[ref]$tokens,[ref]$errors);foreach($name in @('NewHistoricalDigest','NewHistoricalIdentity','NewHistoricalKernel')){$defs=@($ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq $name},$true));. ([scriptblock]::Create($defs[0].Extent.Text))}`;
const auxFixture=String.raw`
function Hash($bytes){return [BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}
function NoReparse($p){}
function IsWatcherCommand($s){return $s-ceq'watcher'}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);return [pscustomobject]@{ReturnValue=0;Sid=$InputObject.sid}}
function Get-FileHash{param($LiteralPath,$Algorithm);$p=@($script:modelExpected|Where-Object{$_.nodePath-ceq$LiteralPath})[0];return [pscustomobject]@{Hash=$(if($script:imageDrift){'foreign'}else{$p.image})}}
function Get-AuthenticodeSignature{param($LiteralPath);$p=@($script:modelExpected|Where-Object{$_.nodePath-ceq$LiteralPath})[0];return [pscustomobject]@{Status=$(if($script:badSignature){'Invalid'}else{'Valid'});SignerCertificate=[pscustomobject]@{Subject=$(if($p.signer-ceq'Windows'){'CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'}else{'CN="OpenAI OpCo, LLC", O="OpenAI OpCo, LLC", L=San Francisco, S=California, C=US'})}}}
function ProtectedProcesses($v){}
function Inventory{$script:inventoryReads++;if($script:driftAfterRead-and$script:inventoryReads-gt1){$script:raw.all[3].CommandLine='changed'};return $script:raw}
function NewHistoricalOpenProcess($id){$script:opens++;$row=@($script:raw.all|Where-Object{$_.ProcessId-eq$id})[0];$h=[pscustomobject]@{Id=$id;StartTime=$row.CreationDate;HasExited=$false;MainModule=[pscustomobject]@{FileName=$row.ExecutablePath}};$h|Add-Member -MemberType ScriptMethod -Name Dispose -Value {$script:closes++};return $h}
function NewHistoricalReadProcess($h){if($script:kernelDrift){return [pscustomobject]@{Id=$h.Id;StartTime=$h.StartTime.AddSeconds(1);HasExited=$false;MainModule=$h.MainModule}};return $h}
$script:productionExpected=@(Completed42d0AuxEpochPins)
function Completed42d0AuxEpochPins{return $script:modelExpected}
function SetupAux{
 $script:ProfileSha256='b'*64;$script:BeforeImageSha256='c'*64;$script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001';$script:opens=0;$script:closes=0;$script:inventoryReads=0;$script:imageDrift=$false;$script:badSignature=$false;$script:kernelDrift=$false;$script:driftAfterRead=$false
 $script:modelExpected=@($productionExpected|ForEach-Object{$_|ConvertTo-Json|ConvertFrom-Json});$rows=@();foreach($p in $modelExpected){$argv='fixture-argv-'+$p.pid;$p.argv=Hash ([Text.Encoding]::UTF8.GetBytes($argv));$rows+=,[pscustomobject]@{ProcessId=$p.pid;ParentProcessId=$p.parentPid;Name=$p.name;ExecutablePath=$p.nodePath;CommandLine=$argv;CreationDate=[DateTime]::Parse($p.creationTime);sid=$owner}}
 $script:raw=[pscustomobject]@{all=$rows;allListeners=@();instances=@()};$script:before=[pscustomobject]@{identities=[pscustomobject]@{coreSupervisor=[pscustomobject]@{pid=999}}};$script:profile=[pscustomobject]@{oldWatchers=@();protectedProcesses=@();packages=@([pscustomobject]@{root='C:\Sirket\ERP\releases\managed'})};$script:probePins=@{};$script:protectedConsolePins=@{}
 $script:auxSnapshot=[pscustomobject]@{consolePins=@([pscustomobject]@{pid=4900;parentPid=100;nodePath='C:\Windows\System32\conhost.exe';ownerSid=$owner;commandLine='historical';creationTime='2026-10-20T08:50:12.012338Z'})}
}
function AuxOutcome{try{$p=Completed42d0AuxProof $auxSnapshot;return ('GO:'+ $p.family.Count+':'+$p.ancestors.Count+':'+$p.stopPermitted)}catch{return $_.Exception.Message}}
`;
test('4900 unrelated replacement proof holds six query-only lifetimes and retains the historical console with two full fresh frames',()=>{
 const out=run(auxExtract+'\n'+auxFixture+"\nSetupAux;$saved=$auxSnapshot|ConvertTo-Json -Compress;'RESULT='+(AuxOutcome);'OPEN='+$opens;'CLOSE='+$closes;'FRAMES='+$inventoryReads;'OLD_UNCHANGED='+($saved-ceq($auxSnapshot|ConvertTo-Json -Compress))");assert.match(out,/RESULT=GO:3:3:False[\s\S]*OPEN=6[\s\S]*CLOSE=6[\s\S]*FRAMES=3[\s\S]*OLD_UNCHANGED=True/);
});
test('4900 proof rejects foreign UID/kernel/image/signature/owner, causal graph, managed namespace and listeners without any stop grant',()=>{
 const edits=["$raw.all[3].ParentProcessId=999","$raw.all[3].CreationDate=$raw.all[3].CreationDate.AddSeconds(1)","$raw.all[3].CommandLine='watcher'","$raw.all[3].sid='S-1-5-99'","$script:imageDrift=$true","$script:badSignature=$true","$script:kernelDrift=$true","$script:driftAfterRead=$true","$raw.allListeners=@([pscustomobject]@{OwningProcess=4900})","$profile.protectedProcesses=@([pscustomobject]@{pid=4900})","$raw.all+=,$raw.all[0]","$raw.all+=,[pscustomobject]@{ProcessId=1316;ParentProcessId=0}","$raw.all+=,[pscustomobject]@{ProcessId=9999;ParentProcessId=12092}","$raw.all=@($raw.all|Where-Object{$_.ProcessId-ne46520})","$profile.packages[0].root='fixture-argv-'","$auxSnapshot.consolePins=@()"];
 const out=run(auxExtract+'\n'+auxFixture+'\n'+edits.map((e,n)=>`SetupAux;${e};'CASE${n}='+(AuxOutcome);'CLOSED${n}='+($opens-eq$closes)`).join('\n'));for(let n=0;n<edits.length;n++){assert(!out.includes('CASE'+n+'=GO'),'case '+n+' '+out);assert.match(out,new RegExp('CLOSED'+n+'=True'));}
 const s=readFileSync(source,'utf8');assert.match(s,/777bc48f04fbdd1a48b9cf92aea4deaed4e34a9004139a2b0e9e5eba094445c4/);const proof=s.slice(s.indexOf('function Completed42d0AuxProof'),s.indexOf('function Completed42d0Pins'));assert(!/Stop-Process|StopWorkerCore|StopB264OldCom|Kill\(/.test(proof));
});test('ResumeDrainCheck alone permits exact mixed old/new task CAS XML while preserving stopped state and zero COM instances',()=>{
 const get=`$a=[Management.Automation.Language.Parser]::ParseFile(${q(fileURLToPath(source))},[ref]$null,[ref]$null);$d=@($a.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'PausedTasks'},$true));. ([scriptblock]::Create($d[0].Extent.Text))`;
 const fixture=String.raw`
 function Inventory{return [pscustomobject]@{instances=$script:instances}}
 function XmlHash($xml){return $xml}
 function SetTasks{ $script:Mode='ResumeDrainCheck';$script:instances=@();$script:profile=[pscustomobject]@{tasks=@([pscustomobject]@{name='Terminal';oldXmlSha256='old1';newXmlSha256='new1'},[pscustomobject]@{name='Hub';oldXmlSha256='old2';newXmlSha256='new2'})};$script:tasks=@{Terminal=[pscustomobject]@{State=3;Xml='old1'};Hub=[pscustomobject]@{State=3;Xml='old2'}};$script:folder=New-Object PSObject;$folder|Add-Member -MemberType ScriptMethod -Name GetTask -Value {param($n);return $script:tasks[$n]}}
 function TaskOutcome{try{[void](PausedTasks);return 'GO'}catch{return $_.Exception.Message}}
 `;
 const edits=['',"$tasks.Terminal.Xml='new1'","$tasks.Hub.Xml='new2'","$tasks.Terminal.Xml='new1';$tasks.Hub.Xml='new2'","$tasks.Hub.Xml='foreign'","$tasks.Hub.State=4","$script:instances=@(1)","$script:Mode='ResumeDrain';$tasks.Hub.Xml='new2'","$script:Mode='ResumeDrainDryRun';$tasks.Terminal.Xml='new1'","$script:Mode='Drain';$tasks.Hub.Xml='new2'"];
 const out=run(get+'\n'+fixture+'\n'+edits.map((e,n)=>`SetTasks;${e};'CASE${n}='+(TaskOutcome)`).join('\n'));for(let n=0;n<4;n++)assert.match(out,new RegExp('CASE'+n+'=GO'));for(let n=4;n<edits.length;n++)assert(!out.includes('CASE'+n+'=GO'),'case '+n);
});
test('PS5 real -File child can self-read through a parent read-only code hold; other reads retain exclusive sharing and bad pins fail',()=>{
 const native=readFileSync(source,'utf8').replaceAll('\r\n','\n');const reader=native.slice(native.indexOf('function ReadWorkerPin('),native.indexOf("\nif($Mode -cnotin @('ResumeDrain'"));assert(reader.includes('[switch]$HeldCode'));
 const temp=mkdtempSync(path.join(tmpdir(),'melisa-held-code-')),child=path.join(temp,'fixture-native.ps1');
 const body=String.raw`param([string]$WorkerSourceSha256,[switch]$WrongPath)
$env:PSModulePath=Join-Path $PSHOME 'Modules';foreach($m in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$m+'\'+$m+'.psd1')) -ErrorAction Stop};Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$Mode='ResumeDrainDryRun';$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
`+reader+String.raw`
try{
 $target=if($WrongPath){Join-Path ([IO.Path]::GetDirectoryName($PSCommandPath)) 'other.ps1'}else{$PSCommandPath}
 [void](ReadWorkerPin $target $WorkerSourceSha256 -HeldCode)
 'SELF_FILE_READ_OK'
 try{[void](ReadWorkerPin $PSCommandPath $WorkerSourceSha256);throw 'FIXTURE_EXCLUSIVE_WEAKENED'}catch{if($_.Exception.Message-ceq'FIXTURE_EXCLUSIVE_WEAKENED'){throw};'OTHER_READ_EXCLUSIVE_PRESERVED'}
 exit 0
}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 17}
`;
 writeFileSync(child,body,'utf8');
 const parent=String.raw`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$env:PSModulePath=Join-Path $PSHOME 'Modules';foreach($m in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$m+'\'+$m+'.psd1')) -ErrorAction Stop};Set-StrictMode -Version Latest
 $file=CHILD;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($sid));$acl.SetAccessRuleProtection($true,$false)
 foreach($id in @($sid,'S-1-5-18')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow'))};Set-Acl -LiteralPath $file -AclObject $acl
 $sha=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();$held=[IO.File]::Open($file,'Open','Read','Read')
 try{
  foreach($case in @('good','hash','path')){
   $expected=if($case-ceq'hash'){'0'*64}else{$sha};$args='-NoProfile -NonInteractive -File "'+$file+'" -WorkerSourceSha256 '+$expected;if($case-ceq'path'){$args+=' -WrongPath'}
   $p=New-Object Diagnostics.Process;$p.StartInfo=New-Object Diagnostics.ProcessStartInfo;$p.StartInfo.FileName=Join-Path $PSHOME 'powershell.exe';$p.StartInfo.Arguments=$args;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true
   [void]$p.Start();$out=$p.StandardOutput.ReadToEnd();$err=$p.StandardError.ReadToEnd();$p.WaitForExit();'CASE_'+$case+'='+$p.ExitCode;[Console]::Write($out);[Console]::Write($err);$p.Dispose()
  }
 }finally{$held.Dispose()}
 `.replace('CHILD',q(child));
 try{const out=execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command',parent],{encoding:'utf8',windowsHide:true,timeout:20000});assert.match(out,/CASE_good=0[\s\S]*SELF_FILE_READ_OK[\s\S]*OTHER_READ_EXCLUSIVE_PRESERVED/);assert.match(out,/CASE_hash=17[\s\S]*P03_SUCCESSOR_HASH/);assert.match(out,/CASE_path=17[\s\S]*P03_SUCCESSOR_HELD_CODE_SCOPE/);}finally{rmSync(temp,{recursive:true,force:true});}
 assert.match(native,/WorkerSourceSha256 -cnotmatch/);assert.match(native,/\$PSCommandPath -cnotmatch/);assert.match(native,/ReadWorkerPin \$PSCommandPath \$WorkerSourceSha256 -HeldCode/);
});
test('4900 historical replacement may naturally disappear only with two complete fresh absence frames and no fabricated kernel lifetimes',()=>{
 const out=run(auxExtract+'\n'+auxFixture+String.raw`
SetupAux;$script:raw.all=@($raw.all|Where-Object{$_.ProcessId-notin@(4900,12092,46520)});$saved=$auxSnapshot|ConvertTo-Json -Compress;$p=Completed42d0AuxProof $auxSnapshot
'ABSENT='+$p.replacementEpochState;'DIGEST='+$p.replacementEpochDigest;'FRAMES='+$inventoryReads;'OPEN='+$opens;'CLOSE='+$closes;'STOP='+$p.stopPermitted;'EMPTY_FAMILY='+($p.family.Count-eq0-and$p.ancestors.Count-eq0);'OLD_SAME='+($saved-ceq($auxSnapshot|ConvertTo-Json -Compress));'RAW_COUNT='+$raw.all.Count
if($p.absenceCommitment.first.processCount-ne3-or$p.absenceCommitment.second.processCount-ne3-or-not$p.absenceCommitment.first.directDescendantsAbsent-or-not$p.absenceCommitment.second.listenersAbsent){throw 'FIXTURE_INCOMPLETE_COMMITMENT'}
`);assert.match(out,/ABSENT=ABSENT[\s\S]*DIGEST=[a-f0-9]{64}[\s\S]*FRAMES=2[\s\S]*OPEN=0[\s\S]*CLOSE=0[\s\S]*STOP=False[\s\S]*EMPTY_FAMILY=True[\s\S]*OLD_SAME=True[\s\S]*RAW_COUNT=3/);
});
test('4900 absence cannot hide any live replacement, foreign reused PID, descendant, listener or second-frame reappearance',()=>{
 const absent="SetupAux;$script:raw.all=@($raw.all|Where-Object{$_.ProcessId-notin@(4900,12092,46520)})";
 const edits=["$raw.all+=,[pscustomobject]@{ProcessId=4900;ParentProcessId=55744}","$raw.all+=,[pscustomobject]@{ProcessId=12092;ParentProcessId=1}","$raw.all+=,[pscustomobject]@{ProcessId=46520;ParentProcessId=1}","$raw.all+=,[pscustomobject]@{ProcessId=9999;ParentProcessId=4900}","$raw.all+=,[pscustomobject]@{ProcessId=9999;ParentProcessId=12092}","$raw.all+=,[pscustomobject]@{ProcessId=9999;ParentProcessId=46520}","$raw.allListeners=@([pscustomobject]@{OwningProcess=4900;LocalPort=9999;LocalAddress='127.0.0.1'})","$raw.all+=,$raw.all[0]"];
 const out=run(auxExtract+'\n'+auxFixture+'\n'+edits.map((e,n)=>`${absent};${e};'CASE${n}='+(AuxOutcome)`).join('\n')+String.raw`
SetupAux;$script:raw.all=@($raw.all|Where-Object{$_.ProcessId-notin@(4900,12092,46520)})
function Inventory{$script:inventoryReads++;if($script:inventoryReads-eq2){$script:raw.all+=,[pscustomobject]@{ProcessId=4900;ParentProcessId=55744}};return $script:raw}
'CASE8='+(AuxOutcome)
`);for(let n=0;n<9;n++)assert(!out.includes('CASE'+n+'=GO'),'case '+n+' '+out);assert.match(out,/CASE8=P03_PHYSICAL_COMPLETED42_AUX_ABSENCE_CAS/);
});test('successive fresh absence proofs keep the same epoch digest while preserving different timestamps and unrelated raw inventory evidence',()=>{
 const out=run(auxExtract+'\n'+auxFixture+String.raw`
SetupAux;$script:raw.all=@($raw.all|Where-Object{$_.ProcessId-notin@(4900,12092,46520)})
$a=Completed42d0AuxProof $auxSnapshot
$script:raw.all+=,[pscustomobject]@{ProcessId=9999;ParentProcessId=1}
$b=Completed42d0AuxProof $auxSnapshot
'EPOCH_SAME='+($a.replacementEpochDigest-ceq$b.replacementEpochDigest)
'TIME_DIFFERENT='+($a.observedAt-cne$b.observedAt)
'RAW_COMMIT_DIFFERENT='+($a.absenceCommitment.second.rawRelationsSha256-cne$b.absenceCommitment.first.rawRelationsSha256)
'COUNT='+$b.absenceCommitment.second.processCount
'NO_HANDLES='+($opens-eq0-and$closes-eq0)
`);assert.match(out,/EPOCH_SAME=True[\s\S]*TIME_DIFFERENT=True[\s\S]*RAW_COMMIT_DIFFERENT=True[\s\S]*COUNT=4[\s\S]*NO_HANDLES=True/);
});
