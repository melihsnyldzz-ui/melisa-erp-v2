import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
const dir=import.meta.dirname,ps=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,q=s=>"'"+s.replaceAll("'","''")+"'",win={skip:process.platform!=='win32'};
const startup=fs.readFileSync(path.join(dir,'start-owned-test.ps1'),'utf8'),plan=fs.readFileSync(path.join(dir,'test125-bound-maintenance-plan.ps1'),'utf8'),api=fs.readFileSync(path.join(dir,'test125-bound-api-quiescence.ps1'),'utf8');
function run(code){return execFileSync(ps,['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd();&([scriptblock]::Create($s))'],{input:`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;foreach($m in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules/'+$m+'/'+$m+'.psd1'))};${code}`,encoding:'utf8',timeout:30000,windowsHide:true}).trim();}
// Use CI's visible temp root and canonical long paths without weakening production path guards.
function withTemp(fn){const tempRoot=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(tempRoot,'melisa-prepared-api-')));try{return fn(temp);}finally{const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),tempRoot.toLowerCase());assert(path.basename(full).startsWith('melisa-prepared-api-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true});}}
const loadSeal=`$native=[IO.File]::ReadAllText(${q(path.join(dir,'business-5244-web-native.cs'))});$offset=$native.IndexOf('public sealed class Business5244PackageSeal:');if($offset-lt0){throw 'NATIVE_CLASS'};Add-Type -TypeDefinition ('using System;using System.Text;using System.Runtime.InteropServices;'+$native.Substring($offset));`;
test('standalone defaults retain full payload verification and all paired indirect readers carry the same proof',()=>{
 assert.match(startup,/function Read-ErpStartupConfig\(\$Path,\$PreparedReleaseProof=\$null\)/);assert.match(startup,/function Assert-ErpRelease\(\$Config,\$PreparedReleaseProof=\$null,\$RetainedSeal=\$null\)/);
 assert.match(startup,/elseif\(\(Get-FileHash -LiteralPath \$target -Algorithm SHA256\).Hash -ne \$file.sha256\)/);assert.match(startup,/ReferenceEquals\(\$configRef,\$Config\)/);assert.match(startup,/Read-ErpStartupConfig 'C:\\Sirket\\ERP\\runtime\\canonical-test\\startup-config.json'/);
 assert.match(plan,/Read-ErpStartupConfig \$startup -PreparedReleaseProof \$PreparedReleaseProof/);
 const tail=api.slice(api.indexOf('function Assert-Test125ReadPairTransition'));
 for(const line of tail.split(/\r?\n/).filter(l=>/Read-ErpStartupConfig|Get-Test125BoundMaintenancePlan/.test(l)))assert.match(line,/-PreparedReleaseProof \$c.releaseProof/,line);
 assert.match(api,/Assert-ErpRelease \$c -PreparedReleaseProof \$releaseProof/);assert.match(api,/packageProof=\$releasePins/);assert.match(api,/releaseProof=\$c.releaseProof/);
});
test('standalone full release validation works without loading the paired native class',win,()=>withTemp(temp=>{
 assert.equal(run(`. ${q(path.join(dir,'start-owned-test.ps1'))} -Library;$temp=${q(temp)};`+String.raw`
if('Business5244PackageSeal'-as[type]){throw 'UNEXPECTED_NATIVE_LOAD'}
$node=Join-Path $temp 'node';$payload=Join-Path $temp 'payload';[IO.File]::WriteAllText($node,'inert');[IO.File]::WriteAllText($payload,'payload');$manifest=Join-Path $temp 'release-manifest.json';$m=@{sourceCommit='fixture';database='fixture';writes=$true;writeScope='existing-named-test-records';baselineReproduced=$true;files=@(@{path='payload';sha256=(Get-FileHash $payload).Hash})};[IO.File]::WriteAllText($manifest,($m|ConvertTo-Json -Depth 10));$c=[pscustomobject]@{NodePath=$node;NodeSha256=(Get-FileHash $node).Hash;ReleaseRoot=$temp;ManifestSha256=(Get-FileHash $manifest).Hash;SourceCommit='fixture';ExpectedDatabase='fixture'};[void](Assert-ErpRelease $c);[IO.File]::AppendAllText($payload,'changed');$rejected=$false;try{Assert-ErpRelease $c|Out-Null}catch{if($_.Exception.Message-cne'TEST_STARTUP_RELEASE_HASH_MISMATCH'){throw};$rejected=$true};if(!$rejected){throw 'FULL_SKIPPED'};'PASS'
`),'PASS');
}));
test('real inert native seal denies payload writes/deletion and ancestor rename while unrelated temp writes remain possible',win,()=>withTemp(temp=>{
 const out=run(`$temp=${q(temp)};${loadSeal}`+String.raw`
function Reject([scriptblock]$f){try{&$f|Out-Null}catch{return};throw 'EXPECTED_DENIAL'}
$tree=Join-Path $temp 'tree';$nested=Join-Path $tree 'nested';[void][IO.Directory]::CreateDirectory($nested);$file=Join-Path $nested 'payload.bin';[IO.File]::WriteAllText($file,'immutable');$sha=(Get-FileHash $file).Hash
$seal=[Business5244PackageSeal]::new();try{
 if($seal.PolicyVersion-cne'test125-package-file-identity.v2'){throw 'POLICY'};$seal.Add($file,$sha);$seal.Freeze();$seal.Validate()
 Reject {[IO.File]::WriteAllText($file,'changed')};Reject {[IO.File]::Delete($file)};Reject {[IO.Directory]::Move($nested,($nested+'-moved'))};Reject {[IO.Directory]::Move($tree,($tree+'-moved'))};Reject {[IO.Directory]::Delete($tree,$true)}
 [IO.File]::WriteAllText((Join-Path $temp 'unrelated.txt'),'permitted');if([IO.File]::ReadAllText($file)-cne'immutable'){throw 'PAYLOAD_CHANGED'};$seal.Validate()
}finally{$seal.Dispose()};Reject {$seal.Validate()};[IO.File]::WriteAllText($file,'after-close');'PASS'
`);assert.equal(out,'PASS');
}));
const fixture=String.raw`
function Reject([scriptblock]$f,[string]$code){try{&$f|Out-Null}catch{if($code-and$_.Exception.Message-cne$code){throw};return};throw 'EXPECTED_REJECTION'}
$repo=Join-Path $temp 'repo';$releases=Join-Path $temp 'releases';$base=Join-Path $releases 'base';$old=Join-Path $releases 'old';$new=Join-Path $releases 'candidate';$runtime=Join-Path $temp 'runtime';$logs=Join-Path $temp 'logs';$profile=Join-Path $temp 'base.json';$apiProfile=Join-Path $temp 'api.json';$startup=Join-Path $temp 'startup.json';$node=Join-Path $temp 'node.bin'
foreach($folder in @($repo,$base,$old,$new,$runtime,$logs,(Join-Path $repo 'scripts\canonical'))){[void][IO.Directory]::CreateDirectory($folder)}
[IO.File]::WriteAllText($node,'inert-node');[IO.File]::WriteAllText((Join-Path $repo 'scripts\canonical\start-owned-test.ps1'),'inert-launcher')
$source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';$db='MELISA_ERP_SIRKET_TEST_20260929_01'
function MakeManifest($root,$package){
 $files=@();foreach($leaf in @('payload-a.bin','nested\payload-b.bin')){$full=Join-Path $root $leaf;[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($full));[IO.File]::WriteAllText($full,($package+'-'+$leaf));$files+=@{path=$leaf;sha256=(Get-FileHash $full).Hash}}
 $m=[ordered]@{sourceCommit=$source;database=$db;writes=$true;writeScope='existing-named-test-records';baselineReproduced=$true;packageId=$package;files=$files;kind='CANONICAL_TEST125_BUSINESS_WORKFACE_CANDIDATE';businessWorkfaceId='ERP-5244-REALDATA-20261027';businessWorkfaceReadOnly=$true;normalSessionSourceCommit=$source;businessSessionSignerDomain='dedicated-business-key-v1'}
 $path=Join-Path $root 'release-manifest.json';[IO.File]::WriteAllText($path,($m|ConvertTo-Json -Depth 20));return (Get-FileHash $path).Hash.ToLowerInvariant()
}
$baseHash=MakeManifest $base 'base';$oldHash=MakeManifest $old 'CANONICAL-TEST125-BUSINESS5244-10cdc0ee';$newHash=MakeManifest $new 'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'
$p=[ordered]@{database=$db;server='127.0.0.1';sqlPort=1433;erpPort=4144;nativePort=4146;webPort=5194;goal8SyntheticDaySeal=@{sourceCommit=$source;dayId='fixture';definitionHash='fixture';packageId='base'}}
[IO.File]::WriteAllText($profile,($p|ConvertTo-Json -Depth 20));$a=($p|ConvertTo-Json -Depth 20|ConvertFrom-Json);$a.goal8SyntheticDaySeal.packageId='CANONICAL-TEST125-BUSINESS5244-10cdc0ee';$a|Add-Member businessWorkface @{id='ERP-5244-REALDATA-20261027';userId=17;actualT1=$false;externalOperations=$false};[IO.File]::WriteAllText($apiProfile,($a|ConvertTo-Json -Depth 20))
$config=[ordered]@{RepoRoot=$repo;ReleaseRoot=$base;ConfigPath=$profile;RuntimeDir=$runtime;LogDir=$logs;NodePath=$node;NodeSha256=(Get-FileHash $node).Hash;OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;SourceCommit=$source;ManifestSha256=$baseHash;ExpectedDatabase=$db;TaskName='Melisa-ERP-TEST-Canonical';ApiComponent=@{ReleaseRoot=$old;SourceCommit=$source;ManifestSha256=$oldHash;ConfigPath=$apiProfile}}
[IO.File]::WriteAllText($startup,($config|ConvertTo-Json -Depth 20))
function git{$global:LASTEXITCODE=0;return 'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'}
# Test-only literal relocation of the existing production functions. There is
# no configurable production path or callback; everything lives under os.tmp.
$replace=[ordered]@{
 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'=$startup;
 'C:\Sirket\ERP\melisa-erp-v2'=$repo;
 'C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'=$apiProfile;
 'C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778'=$base;
 'C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-10cdc0ee'=$old;
 'C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'=$new;
 'C:\Sirket\ERP\releases\'=($releases+'\');
 '0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64'=$baseHash;
 '3e498c4fe89853e295c3ef0a66f88abcbd640b22750c6a54d4348b309b5c2f33'=$oldHash;
 '8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'=$newHash
}
foreach($name in @('Read-ErpStartupConfig','Get-ErpApiComponentConfig','New-ErpReadPairPreparedReleaseProof','Get-Test125ReadPairScope','Assert-Test125ReadPairConfig','Get-Test125BoundMaintenancePlan','New-Test125ReadPairTransition','Open-Test125ApiQuiescence','Assert-Test125ApiStoppedSupervisor','Get-ReadPairExpectedReleasePins','Get-ReadPairExpectedHashes')){
 $text=(Get-Command $name).Definition;foreach($entry in $replace.GetEnumerator()){$text=$text.Replace($entry.Key,$entry.Value)};. ([scriptblock]::Create('function '+$name+' {'+$text+'}'))
}
$realPlan=(Get-Command Get-Test125BoundMaintenancePlan).ScriptBlock
function Get-Test125BoundMaintenancePlan{param($RunId,[switch]$ReadPairPreparation,$ReadPairMode,$PreparedReleaseProof);$c=Read-ErpStartupConfig $startup -PreparedReleaseProof $PreparedReleaseProof;return [pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$RunId;source=$source;database=$db;startupHash=(Get-FileHash $startup).Hash;launcherHash=(Get-FileHash (Join-Path $repo 'scripts\canonical\start-owned-test.ps1')).Hash;manifestHash=$baseHash;taskXmlHash='fixture-task';taskInstance='fixture-guid';supervisor=100;supervisorBirth='fixture-birth';children=@{api=@{port=4144;pid=101;birth='api'};native=@{port=4146;pid=102;birth='native'};web=@{port=5194;pid=103;birth='web'}}}}
$global:payloadReads=0;$global:external=0
function Get-FileHash{param($LiteralPath,$Algorithm);if($LiteralPath-like'*payload-*.bin'){$global:payloadReads++};return Microsoft.PowerShell.Utility\Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256}
function Get-ScheduledTask{$global:external++;throw 'FIXTURE_TASK_BOUNDARY'}
function New-Object{param($ComObject);$global:external++;throw 'FIXTURE_COM_BOUNDARY'}
function Stop-ScheduledTask{throw 'UNEXPECTED_MUTATION'};function Start-ScheduledTask{throw 'UNEXPECTED_MUTATION'};function Invoke-RestMethod{throw 'UNEXPECTED_HTTP'};function Invoke-CimMethod{throw 'UNEXPECTED_CIM'}
`;
test('real inert junction path substitution is rejected by the native seal',win,()=>withTemp(temp=>{
 const target=path.join(temp,'foreign'),junction=path.join(temp,'junction');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'payload.bin'),'inert');fs.symlinkSync(target,junction,'junction');
 assert.equal(run(`$temp=${q(temp)};${loadSeal};$seal=[Business5244PackageSeal]::new();try{$rejected=$false;try{$seal.Add(${q(path.join(junction,'payload.bin'))},(Get-FileHash ${q(path.join(target,'payload.bin'))}).Hash)}catch{$rejected=$true};if(!$rejected){throw 'JUNCTION_ACCEPTED'}}finally{$seal.Dispose()};'PASS'`),'PASS');
}));
test('production prepared API reads retain default FULL checks and require issued refs; request preflight hashes no payload',win,()=>withTemp(temp=>{
 const out=run(`. ${q(path.join(dir,'test125-bound-api-quiescence.ps1'))};. ${q(path.join(dir,'install-business-5244-readpair.ps1'))} -Library;$temp=${q(temp)};${loadSeal};${fixture}`+String.raw`
$t=New-Test125ReadPairTransition;$context=$script:Test125ReadPairContext;$proof=$context.releaseProof
if($t.packageProof.currentApiRoot-cne$old-or$t.packageProof.candidateApiRoot-cne$new-or$t.packageProof.baseRoot-cne$base){throw 'TRIPLE'}
$native=Get-ErpReadPairReleaseProofContext $proof;if($native.seal.Count-ne10){throw 'UNSEALED_PAYLOAD'}
$global:payloadReads=0;$current=Read-ErpStartupConfig $startup -PreparedReleaseProof $proof;$projection=Get-ErpApiComponentConfig $current -PreparedReleaseProof $proof;[void](Assert-ErpRelease $projection -PreparedReleaseProof $proof)
if($global:payloadReads-ne0){throw 'REQUEST_PAYLOAD_REHASH'}
$copy=$current|ConvertTo-Json -Depth 20|ConvertFrom-Json;Reject {Assert-ErpRelease $copy -PreparedReleaseProof $proof} 'TEST125_RELEASE_CONFIG_NOT_ISSUED'
$foreign=$proof|ConvertTo-Json|ConvertFrom-Json;Reject {Read-ErpStartupConfig $startup -PreparedReleaseProof $foreign} 'TEST125_RELEASE_PROOF_NOT_ISSUED'
$oldThread=$native.thread;$native.thread++;Reject {Read-ErpStartupConfig $startup -PreparedReleaseProof $proof} 'TEST125_RELEASE_PROOF_NOT_ISSUED';$native.thread=$oldThread
$oldId=$proof.id;$proof.id='foreign';Reject {Read-ErpStartupConfig $startup -PreparedReleaseProof $proof} 'TEST125_RELEASE_PROOF_NOT_ISSUED';$proof.id=$oldId
$oldProof=$context.releaseProof;$context.releaseProof=$null;Reject {Assert-Test125ReadPairTransition $t Current} 'TEST125_RELEASE_PROOF_NOT_ISSUED';$context.releaseProof=$oldProof
$profileBefore=[IO.File]::ReadAllBytes($apiProfile);$changed=Get-Content -Raw $apiProfile|ConvertFrom-Json;$changed.businessWorkface.userId=18;[IO.File]::WriteAllText($apiProfile,($changed|ConvertTo-Json -Depth 20));Reject {Read-ErpStartupConfig $startup -PreparedReleaseProof $proof} 'TEST_STARTUP_COMPONENT_PROFILE_REJECTED';[IO.File]::WriteAllBytes($apiProfile,$profileBefore)
$startupBefore=[IO.File]::ReadAllBytes($startup);$changed=Get-Content -Raw $startup|ConvertFrom-Json;$changed.ApiComponent.ManifestSha256='0'*64;[IO.File]::WriteAllText($startup,($changed|ConvertTo-Json -Depth 20));Reject {Read-ErpStartupConfig $startup -PreparedReleaseProof $proof} 'TEST125_RELEASE_PROOF_CONFIG_CHANGED';[IO.File]::WriteAllBytes($startup,$startupBefore)
[IO.File]::WriteAllBytes($startup,$context.candidateBytes);[IO.File]::WriteAllBytes($apiProfile,$context.apiCandidate);$candidateRead=Read-ErpStartupConfig $startup -PreparedReleaseProof $proof;$candidateProjection=Get-ErpApiComponentConfig $candidateRead -PreparedReleaseProof $proof;[void](Assert-ErpRelease $candidateProjection -PreparedReleaseProof $proof);if($global:payloadReads-ne0-or$candidateRead.ApiComponent.ReleaseRoot-cne$new){throw 'CANDIDATE_REHASH'};[IO.File]::WriteAllBytes($startup,$startupBefore);[IO.File]::WriteAllBytes($apiProfile,$profileBefore)

[void](Read-ErpStartupConfig $startup);if($global:payloadReads-ne4){throw 'DEFAULT_FULL_LOST'};$global:payloadReads=0
# Restore the actual production maintenance reader. External task IO is the
# first sentinel after its actual sealed startup validation; no host access.
. ([scriptblock]::Create('function Get-Test125BoundMaintenancePlan {'+$realPlan.ToString()+'}'))
Reject {Assert-Test125ReadPairTransition $t Current} 'FIXTURE_TASK_BOUNDARY'
Reject {Open-Test125ApiQuiescence $context.admission $t.scope} 'FIXTURE_TASK_BOUNDARY'
Reject {Invoke-Test125ReadPairApiTransition $t Candidate} 'FIXTURE_TASK_BOUNDARY'
Reject {Invoke-Test125ReadPairApiTransition $t Rollback} 'FIXTURE_TASK_BOUNDARY'
$binding=[pscustomobject]@{admission=$context.admission;config=$current;releaseProof=$proof};$script:Test125ApiBinding=$binding
Reject {Assert-Test125ApiStoppedSupervisor $binding} 'FIXTURE_COM_BOUNDARY';$script:Test125ApiBinding=$null
if($global:payloadReads-ne0-or$global:external-ne5){throw 'INDIRECT_REHASH'}
Close-ErpReadPairReleaseProof $proof;Reject {Read-ErpStartupConfig $startup -PreparedReleaseProof $proof} 'TEST125_RELEASE_PROOF_NOT_ISSUED';[IO.File]::AppendAllText((Join-Path $new 'payload-a.bin'),'corrupt');Reject {New-ErpReadPairPreparedReleaseProof $current} ''; 'PASS'
`);assert.equal(out,'PASS');
}));

test('installer expected contract includes the actual issued immutable proof pins and agrees with the owner plan hash',win,()=>withTemp(temp=>{
 const out=run(`. ${q(path.join(dir,'test125-bound-api-quiescence.ps1'))};. ${q(path.join(dir,'install-business-5244-readpair.ps1'))} -Library;. ${q(path.join(dir,'start-business-5244-web.ps1'))} -Library;$temp=${q(temp)};${loadSeal};${fixture}`+String.raw`
$t=New-Test125ReadPairTransition;$context=$script:Test125ReadPairContext
try{
 $pins=Get-ReadPairExpectedReleasePins $context.config (Get-Test125ReadPairScope)
 if(($pins|ConvertTo-Json -Depth 8 -Compress)-cne($t.packageProof|ConvertTo-Json -Depth 8 -Compress)){throw 'EXPECTED_IMMUTABLE_PINS_DIFFER'}
 $expected=Get-ReadPairExpectedHashes;$contract=Get-Test125ReadPairTransitionContract $t;$newPins=Get-Business5244ReadPairPins;$oldPins=Get-Business5244WebPins
 $keys=@('root','package','manifest','frontendSource','apiPackage','apiManifest','baseSource','node','nodeHash','profile')
 $identity='business-5244-read-pair.v1|'+$contract.contractSha256+'|'+(($keys|ForEach-Object {$newPins[$_]})-join'|')+'|'+(($keys|ForEach-Object {$oldPins[$_]})-join'|')
 if($expected.planHash-cne(Get-Business5244StartupHash ([Text.Encoding]::UTF8.GetBytes($identity)))){throw 'INSTALLER_OWNER_PLAN_DISAGREE'}
 if(($pins.PSObject.Properties.Name)-contains'id'){throw 'OPAQUE_TOKEN_EXPOSED'}
}finally{Close-ErpReadPairReleaseProof $context.releaseProof};'PASS'
`);assert.equal(out,'PASS');
}));

test('query-only kernel handles validate their exact lifetime and reject termination access',win,()=>{
 const quick=api.slice(api.indexOf('function Assert-Test125ReadPairRequestAdmission'),api.indexOf('function Close-Test125ReadPairRequestAdmission'));assert.doesNotMatch(quick,/Get-CimInstance|Invoke-CimMethod|Get-Test125BoundMaintenancePlan|Assert-Test125ReadPairTransition/);
 assert.match(api,/QueryOnlyOpen\(int pid,long birth\)\{var h=OpenProcess\(0x00101000,false/);
 assert.equal(run(`. ${q(path.join(dir,'test125-bound-api-quiescence.ps1'))};Initialize-Test125ApiKernel;$child=$null;$handle=$null;try{
 $si=[Diagnostics.ProcessStartInfo]::new(${q(process.execPath)},'-e "setTimeout(()=>{},1200)"');$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$child=[Diagnostics.Process]::Start($si);$birth=$child.StartTime.ToUniversalTime().Ticks;$handle=[Test125ApiKernel]::QueryOnlyOpen($child.Id,$birth);[Test125ApiKernel]::ValidateReadOnly($handle,$birth);
 $rejected=$false;try{[Test125ApiKernel]::Stop($handle,$birth)}catch{$rejected=$true};if(!$rejected-or$child.HasExited){throw 'QUERY_HANDLE_MUTATED'};
 $rejected=$false;try{[Test125ApiKernel]::ValidateReadOnly($handle,$birth+10)}catch{$rejected=$true};if(!$rejected){throw 'WRONG_BIRTH'};
 if(!$child.WaitForExit(10000)){throw 'CHILD_TIMEOUT'};$rejected=$false;try{[Test125ApiKernel]::ValidateReadOnly($handle,$birth)}catch{$rejected=$true};if(!$rejected){throw 'EXITED_ACCEPTED'};$handle.Dispose();$rejected=$false;try{[Test125ApiKernel]::ValidateReadOnly($handle,$birth)}catch{$rejected=$true};if(!$rejected){throw 'CLOSED_ACCEPTED'};'PASS'
 }finally{if($handle){$handle.Dispose()};if($child){if(!$child.HasExited){if($child.StartTime.ToUniversalTime().Ticks-ne$birth){throw 'CHILD_CHANGED'};$child.Kill();$child.WaitForExit()};$child.Dispose()}}`),'PASS');
});
test('quick request admission uses retained live native objects plus fresh mutable guards, with no CIM/full boundary rescans',win,()=>withTemp(temp=>{
 const out=run(`. ${q(path.join(dir,'test125-bound-api-quiescence.ps1'))};. ${q(path.join(dir,'install-business-5244-readpair.ps1'))} -Library;$temp=${q(temp)};${loadSeal};${fixture};$testNode=${q(process.execPath)};`+String.raw`
$children=[Collections.ArrayList]::new();$rows=@{};$t=$null
try{
 foreach($role in @('supervisor','api','native','web')){$si=[Diagnostics.ProcessStartInfo]::new($testNode,'-e "setTimeout(()=>{},60000)"');$si.UseShellExecute=$false;$si.CreateNoWindow=$true;$child=[Diagnostics.Process]::Start($si);[void]$children.Add($child);$rows[$role]=@{pid=$child.Id;birth=$child.StartTime.ToUniversalTime().ToString('o')}}
 function Get-Test125BoundMaintenancePlan{param($RunId,[switch]$ReadPairPreparation,$ReadPairMode,$PreparedReleaseProof);$cfg=Read-ErpStartupConfig $startup -PreparedReleaseProof $PreparedReleaseProof;return [pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$RunId;source=$source;database=$db;startupHash=(Get-FileHash $startup).Hash;launcherHash=(Get-FileHash (Join-Path $repo 'scripts\canonical\start-owned-test.ps1')).Hash;manifestHash=$baseHash;taskXmlHash=(Get-Test125ReadPairHash ([Text.Encoding]::UTF8.GetBytes('fixture-xml')));taskInstance='fixture-guid';supervisor=$rows.supervisor.pid;supervisorBirth=$rows.supervisor.birth;children=@{api=@{port=4144;pid=$rows.api.pid;birth=$rows.api.birth};native=@{port=4146;pid=$rows.native.pid;birth=$rows.native.birth};web=@{port=5194;pid=$rows.web.pid;birth=$rows.web.birth}}}}
 $ownedPath=Join-Path $runtime 'owned-processes.json';$ownedFixture=@{sourceCommit=$source;supervisor=$rows.supervisor.pid;startedAt=$rows.supervisor.birth;children=@{}};foreach($role in @('api','native','web')){$ownedFixture.children[$role]=@{pid=$rows[$role].pid;createdAt=$rows[$role].birth}};[IO.File]::WriteAllText($ownedPath,($ownedFixture|ConvertTo-Json -Depth 10))
 $t=New-Test125ReadPairTransition;$c=$script:Test125ReadPairContext;$full=(Get-Command Assert-Test125ReadPairTransition).ScriptBlock;$global:fullChecks=0
 function Assert-Test125ReadPairTransition{param($Transition,$Mode);$global:fullChecks++;&$full $Transition $Mode}
 $prepared=Prepare-Test125ReadPairRequestAdmission $t;if($prepared.processes-ne4-or$global:fullChecks-ne2){throw 'PREPARE_NOT_FULL'}
 $global:payloadReads=0;$global:tcp=0;$global:health=0;$global:mode='ok';$global:sourceReads=0
 function Get-Test125BoundMaintenancePlan{throw 'UNEXPECTED_FULL_PLAN'};function Assert-Test125ReadPairTransition{throw 'UNEXPECTED_FULL_BOUNDARY'};function Get-CimInstance{throw 'UNEXPECTED_CIM'};function Invoke-CimMethod{throw 'UNEXPECTED_CIM'}
 $reader=(Get-Command Read-ErpStartupConfig).ScriptBlock;function Read-ErpStartupConfig{param($Path,$PreparedReleaseProof);$global:sourceReads++;&$reader $Path $PreparedReleaseProof}
 function Get-Test125ReadPairTask{
  $task=[pscustomobject]@{Xml=$(if($global:mode-ceq'task-xml'){'foreign'}else{'fixture-xml'})};$task|Add-Member ScriptMethod GetInstances {param($unused);$list=[pscustomobject]@{Count=$(if($global:mode-ceq'multiple-com'){2}else{1})};$list|Add-Member ScriptMethod Item {param($index);return [pscustomobject]@{InstanceGuid=$(if($global:mode-ceq'guid'){'foreign'}else{'fixture-guid'});EnginePID=$(if($global:mode-ceq'engine'){99999}else{$rows.supervisor.pid})}};return $list};return $task
 }
 function Get-NetTCPConnection{[CmdletBinding()]param($State,$LocalPort);$global:tcp++;if(($LocalPort-join'|')-cne'4144|4146|5194'-or$State-cne'Listen'){throw 'TCP_SCOPE'};if($global:mode-ceq'tcp-error'){throw 'FIXTURE_TCP_UNAVAILABLE'};foreach($role in @('api','native','web')){if($global:mode-ceq'missing-port'-and$role-ceq'native'){continue};[pscustomobject]@{LocalPort=$c.admission.children.$role.port;OwningProcess=$(if($global:mode-ceq'foreign-port'-and$role-ceq'api'){99999}else{$rows[$role].pid});LocalAddress=$(if($global:mode-ceq'foreign-bind'){'0.0.0.0'}else{'127.0.0.1'})}}}
 function Assert-ErpHealth{param($Config,$Definition);$global:health++;if($global:mode-ceq'api-health'-and$Definition.Name-ceq'api'){throw 'FIXTURE_HEALTH'};return [pscustomobject]@{ok=$true;sqlReadOnly=($global:mode-cne'native-write');sysadmin=0}}
 [void](Assert-Test125ReadPairRequestAdmission $t);if($global:sourceReads-ne1-or$global:tcp-ne1-or$global:health-ne3-or$global:payloadReads-ne0){throw 'QUICK_CALLPATH'}
 $ownedBytes=[IO.File]::ReadAllBytes($ownedPath)
 foreach($case in @('source','supervisor','startedAt','api-pid','native-birth','web-pid')){
  $o=Get-Content -LiteralPath $ownedPath -Raw|ConvertFrom-Json
  switch($case){source{$o.sourceCommit='foreign'}supervisor{$o.supervisor=99999}startedAt{$o.startedAt=([datetime]$rows.supervisor.birth).AddSeconds(-1).ToString('o')}'api-pid'{$o.children.api.pid=99999}'native-birth'{$o.children.native.createdAt=([datetime]$rows.native.birth).AddSeconds(1).ToString('o')}'web-pid'{$o.children.web.pid=99999}}
  [IO.File]::WriteAllText($ownedPath,($o|ConvertTo-Json -Depth 10));Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_OWNED_RECORD_CHANGED';[IO.File]::WriteAllBytes($ownedPath,$ownedBytes)
 }
 # Legitimate journal heartbeat/extra observation fields do not change identity.
 $o=Get-Content -LiteralPath $ownedPath -Raw|ConvertFrom-Json;$o|Add-Member heartbeat 'later';[IO.File]::WriteAllText($ownedPath,($o|ConvertTo-Json -Depth 10));[void](Assert-Test125ReadPairRequestAdmission $t);[IO.File]::WriteAllBytes($ownedPath,$ownedBytes)
 Reject {Prepare-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_ALREADY_PREPARED'
 $copy=$t|ConvertTo-Json -Depth 20|ConvertFrom-Json;Reject {Assert-Test125ReadPairRequestAdmission $copy} 'TEST125_READPAIR_NOT_ISSUED'
 $cap=$c.requestAdmission;$c.requestAdmission=$cap.PSObject.Copy();Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_NOT_ISSUED';$c.requestAdmission=$cap
 foreach($key in @('changed','apiChanged','taskStopped','candidateAttempted')){foreach($bad in @($true,$null,0,'false')){$c.$key=$bad;Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_PHASE_REJECTED'};$c.$key=$false}
 foreach($bad in @($false,0,'',([pscustomobject]@{}))){$c.activeBinding=$bad;Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_PHASE_REJECTED'};$c.activeBinding=$null
 $old=$c.phase;$c.phase='FAILED';Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_PHASE_REJECTED';$c.phase=$old
 $old=$cap.thread;$cap.thread++;Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_NOT_ISSUED';$cap.thread=$old
 $old=$cap.records[0].birth;$cap.records[0].birth++;Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_PROCESS_CHANGED';$cap.records[0].birth=$old
 foreach($case in @('task-xml','multiple-com','guid','engine','missing-port','foreign-port','foreign-bind','tcp-error','api-health','native-write')){$global:mode=$case;Reject {Assert-Test125ReadPairRequestAdmission $t} ''};$global:mode='ok'
 $before=[IO.File]::ReadAllBytes($apiProfile);$a=Get-Content -Raw $apiProfile|ConvertFrom-Json;$a.businessWorkface.userId=18;[IO.File]::WriteAllText($apiProfile,($a|ConvertTo-Json -Depth 20));Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST_STARTUP_COMPONENT_PROFILE_REJECTED';[IO.File]::WriteAllBytes($apiProfile,$before)
 [void](Assert-Test125ReadPairRequestAdmission $t);if($global:payloadReads-ne0){throw 'REHASH_IN_REQUEST'}
 $cap.records[1].handle.Dispose();Reject {Assert-Test125ReadPairRequestAdmission $t} '';Close-Test125ReadPairRequestAdmission $t;Reject {Assert-Test125ReadPairRequestAdmission $t} 'TEST125_READPAIR_REQUEST_NOT_ISSUED';'PASS'
}finally{if($t){Close-Test125ReadPairRequestAdmission $t;Close-ErpReadPairReleaseProof $c.releaseProof};foreach($child in $children){if(!$child.HasExited){$expected=@($rows.Values|Where-Object{$_.pid-eq$child.Id})[0];if($child.StartTime.ToUniversalTime().ToString('o')-cne$expected.birth){throw 'CHILD_CHANGED'};$child.Kill();$child.WaitForExit()};$child.Dispose()}}
`);assert.equal(out,'PASS');
}));
