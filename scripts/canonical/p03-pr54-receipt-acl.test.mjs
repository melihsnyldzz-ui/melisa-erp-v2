import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-pr54-receipt-acl.ps1',import.meta.url));
const engine=fileURLToPath(new URL('./p03-physical-rollback.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const windows={skip:process.platform!=='win32'};
const q=s=>"'"+s.replaceAll("'","''")+"'";
function run(code){
 try{return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))','utf16le').toString('base64')],{input:`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$env:PSModulePath=Join-Path $PSHOME 'Modules';foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\\'+$module+'\\'+$module+'.psd1')) -ErrorAction Stop}\n${code}`,encoding:'utf8',timeout:20000,windowsHide:true,stdio:['pipe','pipe','pipe']});}
 catch(e){throw Error((String(e.stderr??'').match(/(?:P03|FIXTURE)_[A-Z_]+/)?.[0]??String(e.stderr??'').slice(0,2000))+' '+String(e.stdout??'').slice(0,1800));}
}
const definitions=`
$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'}
foreach($d in $a.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){. ([scriptblock]::Create($d.Extent.Text))}
function Rejected($name,[scriptblock]$action){try{&$action|Out-Null}catch{'REJECTED='+$name;return};throw ('FIXTURE_ACCEPTED_'+$name)}
`;
const disposable=String.raw`
$script:owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$script:roles=@('crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative')
$script:processRoles=$roles;$script:TargetScope='Receipts'
$script:testRoot=Join-Path ([IO.Path]::GetTempPath()) ('p03-receipt-acl-fixture-'+[Guid]::NewGuid().ToString('N'))
function FixtureDirectory($path,$ids){
 [void][IO.Directory]::CreateDirectory($path);$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($id in $ids){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};Set-Acl -LiteralPath $path -AclObject $acl
}
FixtureDirectory $testRoot @($owner,'S-1-5-18','S-1-5-32-544')
$script:receiptRoot=$testRoot;$script:dir=Join-Path $testRoot 'evidence';FixtureDirectory $dir @($owner,'S-1-5-18')
$script:receiptPaths=@{};foreach($role in $roles){$path=Join-Path $receiptRoot ($role+'.json');$receiptPaths[$role]=$path;[IO.File]::WriteAllText($path,('fixture-bytes-'+$role),[Text.UTF8Encoding]::new($false))}
$script:parentSddl=(Get-Acl -LiteralPath $receiptRoot).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)
$script:Mode='Inspect';$script:run='fixture-run';$script:scopeCalls=0;$script:scopeFailAt=0
$script:profileRef=@{path='fixture-profile';sha256=('a'*64)};$script:beforeRef=@{path='fixture-before';sha256=('b'*64)};$script:originalRef=@{path='fixture-original';sha256=('c'*64)};$script:claimRef=@{path='fixture-claim';sha256=('d'*64)};$script:failureRef=@{path='fixture-failure';sha256=('e'*64)};$script:outcomeRef=@{path='fixture-outcome';sha256=('f'*64)};$script:CandidatePath='fixture-candidate';$script:CandidateSha256='0'*64
function RaclScope($held){$script:scopeCalls++;if($held.Count-ne@((RaclTargets).roles).Count){throw 'FIXTURE_ALL_TARGETS_NOT_HELD'};if($scopeCalls-eq$scopeFailAt){throw 'P03_RECEIPT_ACL_IDENTITY'};RaclNeed ((Get-Acl -LiteralPath $receiptRoot).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)-ceq$parentSddl) 'PARENT_CHANGED';if($TargetScope-ceq'ConfigArtifacts'){foreach($file in $held){RaclConfig $file}};return @{processCount=10;comCount=2;bindingCount=11;fullInstallAdmission=$false}}
function CleanupFixture{
 $resolved=[IO.Path]::GetFullPath($testRoot);$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath());if(-not$resolved.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($resolved)-notlike'p03-receipt-acl-fixture-*'){throw 'FIXTURE_CLEANUP_SCOPE'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}
`;

test('receipt repair is literal run7b, Inspect default and held-handle ACL only with immutable engine and no lifecycle operations',()=>{
 const s=readFileSync(source,'utf8');
 assert.match(s,/ValidateSet\('Inspect','Harden'\).*Mode='Inspect'/);assert.match(s,/7b0821959737f1da0427b17a7dfd4685/);assert.match(s,/e16b70f0-4057-428b-9abc-6bbcaf35fe82/);assert.match(s,/bd455b43c46e124ae46699f7f32bcd8bab02f67bfc146d040951f66c1a5a0760/);assert.match(s,/7e47bd7fa12baf349783b229a6aa80c48dcb9e7231063c0c76a7c18aca3b9fe2/);
 assert.match(s,/FileSystemRights\]::Read -bor .*ChangePermissions/);assert.match(s,/FileShare\]::None/);assert.match(s,/\$held.stream.SetAccessControl\(\$acl\)/);assert.match(s,/GetFileInformationByHandle/);assert.match(s,/\$info.Links -eq 1/);assert.match(s,/\.Flush\(\$true\)/);assert.match(s,/FileMode\]::CreateNew/);assert.match(s,/fullInstallAdmission=\$false/);
 assert.doesNotMatch(s,/Set-Acl|Stop-Process|taskkill|RegisterTask|\.Kill\(|\.Stop\(|\.Run\(|Invoke-RestMethod|SqlConnection|FileSystemRights\]::WriteData/i);
 assert.ok(s.indexOf("if($Mode -ceq 'Inspect')")<s.indexOf("$beforeEvidence=RaclWriteEvidence"));
});

test('PS5 disposable Inspect holds six files without ACL/content/evidence writes and releases every handle',windows,()=>{
 const out=run(`${definitions}\n${disposable}\ntry{$beforeHashes=@($roles|ForEach-Object{(Get-FileHash -LiteralPath $receiptPaths[$_] -Algorithm SHA256).Hash});$result=RaclRun;'STATUS='+$result.status;'MUTATION='+$result.mutationExecuted;'FILES='+$result.files.Count;'EVIDENCE='+@(Get-ChildItem -LiteralPath $dir).Count;foreach($role in $roles){RaclAcl (Get-Acl -LiteralPath $receiptPaths[$role]) 'Inherited3'};'ALL_INHERITED=PASS';$afterHashes=@($roles|ForEach-Object{(Get-FileHash -LiteralPath $receiptPaths[$_] -Algorithm SHA256).Hash});if(($beforeHashes-join'|')-cne($afterHashes-join'|')){throw 'FIXTURE_CHANGED_BYTES'};'CONTENT=PASS'}finally{CleanupFixture}`);
 for(const x of ['STATUS=RECEIPT_ACL_INSPECTED','MUTATION=False','FILES=6','EVIDENCE=0','ALL_INHERITED=PASS','CONTENT=PASS'])assert.ok(out.includes(x),out);
});

test('PS5 real held handles block replacement/write, harden only DACL to explicit owner+SYSTEM, and persist once-only proofs',windows,()=>{
 const out=run(`${definitions}\n${disposable}\ntry{
$file=RaclOpen 'crmServer';try{Rejected 'concurrent-write' {[IO.File]::WriteAllText($file.path,'replacement')};Rejected 'replacement' {[IO.File]::Move($file.path,($file.path+'.moved'))}}finally{$file.stream.Dispose()}
$beforeHashes=@($roles|ForEach-Object{(Get-FileHash -LiteralPath $receiptPaths[$_] -Algorithm SHA256).Hash});$script:Mode='Harden';$result=RaclRun
'STATUS='+$result.status;'MUTATION='+$result.mutationExecuted;'READBACKS='+$result.readbacks.Count;'SCOPE_CAS='+$scopeCalls;'EVIDENCE='+@(Get-ChildItem -LiteralPath $dir).Count
foreach($role in $roles){RaclAcl (Get-Acl -LiteralPath $receiptPaths[$role]) 'Protected2'};'ALL_PROTECTED=PASS'
$afterHashes=@($roles|ForEach-Object{(Get-FileHash -LiteralPath $receiptPaths[$_] -Algorithm SHA256).Hash});if(($beforeHashes-join'|')-cne($afterHashes-join'|')){throw 'FIXTURE_CHANGED_BYTES'};'CONTENT=PASS'
if((Get-Acl -LiteralPath $receiptRoot).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)-cne$parentSddl){throw 'FIXTURE_PARENT_CHANGED'};'PARENT=PASS'
Rejected 'evidence-replay' {RaclWriteEvidence 'receipt-acl-result.json' @{forged=$true}}
}finally{CleanupFixture}`);
 for(const x of ['REJECTED=concurrent-write','REJECTED=replacement','STATUS=RECEIPT_ACL_HARDENED','MUTATION=True','READBACKS=6','SCOPE_CAS=8','EVIDENCE=8','ALL_PROTECTED=PASS','CONTENT=PASS','PARENT=PASS','REJECTED=evidence-replay'])assert.ok(out.includes(x),out);
});

test('PS5 disposable hardlink, changed sixth ACL and content tamper fail before any DACL mutation',windows,()=>{
 const out=run(`${definitions}\n${disposable}\ntry{
$link=Join-Path $testRoot 'extra-link';[void](New-Item -ItemType HardLink -Path $link -Target $receiptPaths.crmServer);Rejected 'hardlink' {RaclOpen 'crmServer'};Remove-Item -LiteralPath $link
$file=RaclOpen 'crmServer';try{$file.sha256='0'*64;Rejected 'held-content-delta' {RaclAssertHeld $file}}finally{$file.stream.Dispose()}
$acl=Get-Acl -LiteralPath $receiptPaths.erpNative;$acl.SetAccessRuleProtection($true,$true);Set-Acl -LiteralPath $receiptPaths.erpNative -AclObject $acl;$script:Mode='Harden';Rejected 'sixth-acl' {RaclRun}
'EVIDENCE='+@(Get-ChildItem -LiteralPath $dir).Count;RaclAcl (Get-Acl -LiteralPath $receiptPaths.crmServer) 'Inherited3';'FIRST_UNCHANGED=PASS'
$s=[IO.File]::Open($receiptPaths.crmServer,'Open','ReadWrite','None');$s.Dispose();'HANDLES_RELEASED=PASS'
}finally{CleanupFixture}`);
 for(const x of ['REJECTED=hardlink','REJECTED=held-content-delta','REJECTED=sixth-acl','EVIDENCE=0','FIRST_UNCHANGED=PASS','HANDLES_RELEASED=PASS'])assert.ok(out.includes(x),out);
});

test('PS5 partial fresh-identity CAS failure records exact completed roles without touching remaining receipts or retrying',windows,()=>{
 const out=run(`${definitions}\n${disposable}\ntry{$script:Mode='Harden';$script:scopeFailAt=3;Rejected 'changed-generation' {RaclRun};$failed=Get-Content -LiteralPath (Join-Path $dir 'receipt-acl-failed.json') -Raw|ConvertFrom-Json;'COMPLETED='+($failed.completedRoles-join',');'PARTIAL='+$failed.status;'READBACKS='+$failed.readbacks.Count;RaclAcl (Get-Acl -LiteralPath $receiptPaths.crmServer) 'Protected2';RaclAcl (Get-Acl -LiteralPath $receiptPaths.crmOrders) 'Inherited3';'REMAINDER_UNCHANGED=PASS';Rejected 'no-replay' {RaclRun}}finally{CleanupFixture}`);
 for(const x of ['REJECTED=changed-generation','COMPLETED=crmServer','PARTIAL=RECEIPT_ACL_INCOMPLETE','READBACKS=1','REMAINDER_UNCHANGED=PASS','REJECTED=no-replay'])assert.ok(out.includes(x),out);
});

const receiptFixture=String.raw`
$script:copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82'
function ResetReceipt{
 $script:receipt=[pscustomobject]@{run='12345678-1234-1234-1234-123456789abc';pid=200;parentPid=100;parentCreationTime='2026-10-18T10:00:00.0000000Z';creationTime='2026-10-18T10:00:01.0000000Z';stage='erpApi';sourceCommit=('e'*40);configSha256=('c'*64);copyId=$copy;actualT1=$false}
 $bytes=[Text.Encoding]::UTF8.GetBytes(($receipt|ConvertTo-Json -Compress))
 $script:file=[pscustomobject]@{role='erpApi';path='C:\fixture\erpApi.json';bytes=$bytes;sha256=(RaclHash $bytes)}
 $script:candidate=[pscustomobject]@{processes=@([pscustomobject]@{role='erpApi';pid=200;parentPid=100;creationTime=$receipt.creationTime},[pscustomobject]@{role='coreSupervisor';pid=100;creationTime=$receipt.parentCreationTime});receipts=@([pscustomobject]@{role='erpApi';path=$file.path;sha256=$file.sha256})}
 $script:profile=[pscustomobject]@{candidateRules=@([pscustomobject]@{role='erpApi';sourceCommit=$receipt.sourceCommit;config=[pscustomobject]@{sha256=$receipt.configSha256};receipt=[pscustomobject]@{path=$file.path}})}
}
function ReserializeReceipt{$file.bytes=[Text.Encoding]::UTF8.GetBytes(($receipt|ConvertTo-Json -Compress));$file.sha256=RaclHash $file.bytes;$candidate.receipts[0].sha256=$file.sha256}
ResetReceipt
`;
test('receipt exact schema, PID/birth/core parent/source/config/copy/T1 and captured hash remain mandatory',windows,()=>{
 const edits=[['extra-key',"$receipt|Add-Member NoteProperty other 'foreign'"],['missing-key',"$receipt.PSObject.Properties.Remove('run')"],['wrong-role',"$receipt.stage='erpNative'"],['pid',"$receipt.pid=201"],['parent',"$receipt.parentPid=101"],['birth',"$receipt.creationTime='2026-10-18T10:00:02Z'"],['parent-birth',"$receipt.parentCreationTime='2026-10-18T09:59:59Z'"],['source',"$receipt.sourceCommit='0'*40"],['config',"$receipt.configSha256='0'*64"],['copy',"$receipt.copyId='foreign'"],['T1',"$receipt.actualT1=$true"],['run',"$receipt.run='foreign'"]];
 const out=run(`${definitions}\n${receiptFixture}\n[void](RaclReceipt $file $candidate $profile);'EXACT=PASS'\n${edits.map(([n,e])=>`ResetReceipt;${e};ReserializeReceipt;Rejected '${n}' {RaclReceipt $file $candidate $profile}`).join('\n')}\nResetReceipt;$candidate.receipts[0].sha256='0'*64;Rejected 'captured-hash' {RaclReceipt $file $candidate $profile}`);
 assert.match(out,/EXACT=PASS/);for(const [n]of edits)assert.match(out,new RegExp('REJECTED='+n));assert.match(out,/REJECTED=captured-hash/);
});

test('frozen FE import is definitions-only and excludes mutation and SQL functions',windows,()=>{
 const out=run(`${definitions}\nRaclImportEngine ([IO.File]::ReadAllBytes(${q(engine)}));'IDENTITY='+[bool](Get-Command Identity -ErrorAction Stop);'TASK_PHASE='+[bool](Get-Command TaskPhase -ErrorAction Stop);if(Get-Command Append -ErrorAction SilentlyContinue){throw 'FIXTURE_MUTATION_IMPORTED'};if(Get-Command SqlServiceProtection -ErrorAction SilentlyContinue){throw 'FIXTURE_SQL_IMPORTED'};'NO_DISPATCH=PASS'`);
 assert.match(out,/IDENTITY=True/);assert.match(out,/TASK_PHASE=True/);assert.match(out,/NO_DISPATCH=PASS/);
});

test('actual controller outcome shape uses failedPhase and rejects another phase or recovery reason',windows,()=>{
 const out=run(`${definitions}\n$value=[pscustomobject]@{status='QUARANTINED_REQUIRES_ROOT_INSPECTION';failedPhase='READBACK';recoveryReason='P03_PHYSICAL_ACL'};RaclOutcome $value;'ACTUAL_SHAPE=PASS';$value.failedPhase='START';Rejected 'wrong-phase' {RaclOutcome $value};$value.failedPhase='READBACK';$value.recoveryReason='foreign';Rejected 'wrong-recovery' {RaclOutcome $value};$oldShape=[pscustomobject]@{status='QUARANTINED_REQUIRES_ROOT_INSPECTION';phase='READBACK';recoveryReason='P03_PHYSICAL_ACL'};Rejected 'obsolete-shape' {RaclOutcome $oldShape}`);
 assert.match(out,/ACTUAL_SHAPE=PASS/);for(const name of ['wrong-phase','wrong-recovery','obsolete-shape'])assert.match(out,new RegExp('REJECTED='+name));
});

const candidateFixture=String.raw`
$script:owner='S-1-5-21-2170750028-1005938530-2568122015-1001';$script:roles=@('crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative');$script:copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82'
$script:processRoles=$roles;$script:TargetScope='Receipts'
$script:profileRef=[pscustomobject]@{sha256=('a'*64)};$script:beforeRef=[pscustomobject]@{sha256=('b'*64)}
function ResetCandidate{
 $allRoles=@('coreSupervisor','hub')+@($roles)+@('terminalWatcher','hubWatcher');$rows=@();$time=[DateTime]::UtcNow.AddMinutes(-5)
 for($i=0;$i-lt10;$i++){$rows+=,[pscustomobject]@{role=$allRoles[$i];pid=100+$i;parentPid=if($i-eq0){108}else{100};ownerSid=$owner;nodePath='C:\fixture\node.exe';commandLine=('node '+$allRoles[$i]);creationTime=$time.AddSeconds($i).ToString('o');bindings=@()}}
 $script:candidate=[pscustomobject]@{schemaVersion='melisa-p03-physical-candidate.v1';profileSha256=$profileRef.sha256;beforeSha256=$beforeRef.sha256;observedAt=[DateTime]::UtcNow.ToString('o');processes=$rows;receipts=@()}
 $script:invokedAtUtc=[DateTime]::UtcNow
 $script:original=$candidate|ConvertTo-Json -Depth 12 -Compress|ConvertFrom-Json;$original.observedAt=[DateTime]::UtcNow.AddMinutes(-10).ToString('o')
}
ResetCandidate
`;
test('fresh candidate must keep literal original generation, exact ten roles and profile/before scope with less than sixty seconds age',windows,()=>{
 const edits=[['stale',"$candidate.observedAt=[DateTime]::UtcNow.AddSeconds(-61).ToString('o')"],['future',"$candidate.observedAt=[DateTime]::UtcNow.AddSeconds(10).ToString('o')"],['profile',"$candidate.profileSha256='0'*64"],['before',"$candidate.beforeSha256='0'*64"],['duplicate-pid',"$candidate.processes[1].pid=100"],['missing-role',"$candidate.processes=@($candidate.processes|Where-Object{$_.role-ne'hub'})"],['role',"$candidate.processes[1].role='other'"],['PID',"$candidate.processes[1].pid=999"],['parent',"$candidate.processes[1].parentPid=999"],['owner',"$candidate.processes[1].ownerSid='foreign'"],['birth',"$candidate.processes[1].creationTime=[DateTime]::UtcNow.ToString('o')"],['argv',"$candidate.processes[1].commandLine+=' foreign'"],['binary',"$candidate.processes[1].nodePath='C:\\other.exe'"]];
 const out=run(`${definitions}\n${candidateFixture}\nRaclCandidate $candidate;'EXACT_GENERATION=PASS'\n${edits.map(([n,e])=>`ResetCandidate;${e};Rejected '${n}' {RaclCandidate $candidate}`).join('\n')}`);
 assert.match(out,/EXACT_GENERATION=PASS/);for(const [n]of edits)assert.match(out,new RegExp('REJECTED='+n));
});

const scopeFixture=String.raw`
function ResetScope{
 ResetCandidate;$script:kernelCalls=0;$script:kernelFails=$false;$script:sidMode='normal';$script:sidTarget=103;$script:taskState=4;$script:xml='<Task><Actions><Exec>NEW</Exec></Actions></Task>'
 $script:names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$script:ports=@(4184,4186,5234,62700,62701,62702,62703,62704);$script:isRehearsal=$false
 $script:receiptRoot='C:\fixture';$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false);foreach($id in @($owner,'S-1-5-18','S-1-5-32-544')){[void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow'))};$script:parentAcl=$acl;$script:parentSddl=$acl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)
 $script:profile=[pscustomobject]@{candidateRules=@();tasks=@($names|ForEach-Object{[pscustomobject]@{name=$_;oldXml='<Task><Actions><Exec>OLD</Exec></Actions></Task>';newXmlSha256=(XmlHash $xml)}});oldWatchers=@([pscustomobject]@{pid=9},[pscustomobject]@{pid=10})}
 $script:before=[pscustomobject]@{identities=[pscustomobject]@{old=[pscustomobject]@{pid=50}}}
 $pairs=@{hub=@('5234|127.0.0.1','5234|192.168.1.46');erpApi=@('4184|127.0.0.1','4184|192.168.1.46');crmServer=@('62700|127.0.0.1','62700|192.168.1.46','62701|127.0.0.1');erpNative=@('4186|127.0.0.1');crmNativeOrder=@('62704|127.0.0.1');crmCatalog=@('62702|127.0.0.1');crmOrders=@('62703|127.0.0.1');coreSupervisor=@();terminalWatcher=@();hubWatcher=@()}
 $script:all=@();$script:listeners=@();$script:held=@()
 foreach($row in $candidate.processes){
  $rule=[pscustomobject]@{role=$row.role;nodePath=$row.nodePath;commandLine=$row.commandLine;sourceCommit=('e'*40);config=[pscustomobject]@{sha256=('c'*64)};receipt=[pscustomobject]@{path=('C:\fixture\'+$row.role+'.json')}}
  if($row.role-cin@('terminalWatcher','hubWatcher')){$rule|Add-Member NoteProperty taskName $names[@('terminalWatcher','hubWatcher').IndexOf($row.role)]}
  $profile.candidateRules+=,$rule
  foreach($pair in $pairs[$row.role]){$p=$pair.Split('|');$row.bindings+=,[pscustomobject]@{port=[int]$p[0];address=$p[1]};$script:listeners+=,[pscustomobject]@{LocalPort=[int]$p[0];LocalAddress=$p[1];OwningProcess=$row.pid}}
  $script:all+=,[pscustomobject]@{ProcessId=$row.pid;ParentProcessId=$row.parentPid;ExecutablePath=$row.nodePath;CommandLine=$row.commandLine;CreationDate=[DateTime]::Parse($row.creationTime).ToUniversalTime();OwnerSid=$owner}
  if($row.role-cin$roles){$value=[pscustomobject]@{run='12345678-1234-1234-1234-123456789abc';pid=$row.pid;parentPid=100;parentCreationTime=$candidate.processes[0].creationTime;creationTime=$row.creationTime;stage=$row.role;sourceCommit=$rule.sourceCommit;configSha256=$rule.config.sha256;copyId=$copy;actualT1=$false};$bytes=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Compress));$file=[pscustomobject]@{role=$row.role;path=$rule.receipt.path;bytes=$bytes;sha256=(RaclHash $bytes)};$script:held+=,$file;$candidate.receipts+=,[pscustomobject]@{role=$row.role;path=$file.path;sha256=$file.sha256}}
 }
 $script:original=$candidate|ConvertTo-Json -Depth 12 -Compress|ConvertFrom-Json;$original.observedAt=[DateTime]::UtcNow.AddMinutes(-10).ToString('o')
 $script:instances=@(0..1|ForEach-Object{[pscustomobject]@{Name=$names[$_];State=4;EnginePID=108+$_}})
 $script:schedule=[pscustomobject]@{};$schedule|Add-Member ScriptMethod GetRunningTasks {param($flags);if($flags-ne1){throw 'FIXTURE_COM_FLAGS'};$r=[pscustomobject]@{Count=$script:instances.Count};$r|Add-Member ScriptMethod Item {param($i);return $script:instances[$i-1]};return $r}
 $script:folder=[pscustomobject]@{};$folder|Add-Member ScriptMethod GetTask {param($name);return [pscustomobject]@{State=$script:taskState;Xml=$script:xml}}
}
function RaclAuthority{RaclCandidate $script:candidate;return $script:candidate}
function RaclKernel($row){$script:kernelCalls++;if($script:kernelFails){throw 'P03_RECEIPT_ACL_KERNEL_BIRTH'}}
function Get-Acl{param($LiteralPath);return $script:parentAcl}
function Get-CimInstance{param($ClassName,$ErrorAction);if($ClassName-cne'Win32_Process'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_CIM_SCOPE'};return $script:all}
function Get-NetTCPConnection{param($State,$ErrorAction);if($State-cne'Listen'-or$ErrorAction-cne'Stop'){throw 'FIXTURE_LISTENER_SCOPE'};return $script:listeners}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction);if($InputObject.ProcessId-eq$script:sidTarget){if($sidMode-ceq'missing'){return [pscustomobject]@{ReturnValue=0;Sid=$null}};if($sidMode-ceq'denied'){return [pscustomobject]@{ReturnValue=2;Sid=$null}}};return [pscustomobject]@{ReturnValue=0;Sid=$InputObject.OwnerSid}}
function VerifyRule($rule){}
ResetScope
`;
test('actual scope function retains all ten SID/kernel identities, NEW task XML, two COM owners, eleven bindings and receipt content',windows,()=>{
 const edits=[['missing-SID',"$script:sidMode='missing'"],['denied-SID',"$script:sidMode='denied'"],['kernel-birth',"$script:kernelFails=$true"],['PID-reuse',"$all[2].CreationDate=$all[2].CreationDate.AddTicks(1)"],['COM-count',"$script:instances=@($instances[0])"],['COM-owner',"$instances[1].EnginePID=999"],['task-state',"$script:taskState=3"],['task-XML',"$script:xml='<Task><Actions><Exec>FOREIGN</Exec></Actions></Task>'"],['listener-owner',"$listeners[0].OwningProcess=999"],['listener-address',"$listeners[0].LocalAddress='0.0.0.0'"],['extra-listener',"$script:listeners+=,[pscustomobject]@{LocalPort=4184;LocalAddress='::';OwningProcess=999}"],['parent-ACL-delta',"$script:parentSddl='foreign'"],['old-generation',"$old=$all[0]|Select-Object *;$old.ProcessId=50;$script:all+=,$old"]];
 const out=run(`${definitions}\nRaclImportEngine ([IO.File]::ReadAllBytes(${q(engine)}))\n${candidateFixture}\n${scopeFixture}\n$result=RaclScope $held;'SCOPE='+$result.processCount+','+$result.comCount+','+$result.bindingCount;'KERNELS='+$kernelCalls;'ADMISSION='+$result.fullInstallAdmission\n${edits.map(([n,e])=>`ResetScope;${e};Rejected '${n}' {RaclScope $held}`).join('\n')}`);
 assert.match(out,/SCOPE=10,2,11/);assert.match(out,/KERNELS=10/);assert.match(out,/ADMISSION=False/);for(const [n]of edits)assert.match(out,new RegExp('REJECTED='+n));
});

test('entry age fifty-nine seconds survives elapsed wall time while every later scope still rejects identity drift; sixty and future reject',windows,()=>{
 const out=run(`${definitions}\nRaclImportEngine ([IO.File]::ReadAllBytes(${q(engine)}))\n${candidateFixture}\n${scopeFixture}\n$script:invokedAtUtc=[DateTime]::UtcNow.AddSeconds(-120);$candidate.observedAt=$invokedAtUtc.AddSeconds(-59).ToString('o');$original.observedAt=$invokedAtUtc.AddMinutes(-10).ToString('o');$frozen=$candidate.observedAt;$scope=RaclScope $held;'LATE_VALID_SCOPE='+$scope.processCount;if($candidate.observedAt-cne$frozen){throw 'FIXTURE_TIMESTAMP_REFRESH'};'NO_REFRESH=PASS';$all[2].CreationDate=$all[2].CreationDate.AddTicks(1);Rejected 'late-identity-drift' {RaclScope $held};ResetScope;$candidate.observedAt=$invokedAtUtc.AddSeconds(-60).ToString('o');Rejected 'entry-sixty' {RaclCandidate $candidate};ResetScope;$candidate.observedAt=$invokedAtUtc.AddSeconds(1).ToString('o');Rejected 'entry-future' {RaclCandidate $candidate}`);
 assert.match(out,/LATE_VALID_SCOPE=10/);assert.match(out,/NO_REFRESH=PASS/);for(const n of ['late-identity-drift','entry-sixty','entry-future'])assert.match(out,new RegExp('REJECTED='+n));
 const s=readFileSync(source,'utf8');assert.ok(s.indexOf('$invokedAtUtc=[DateTime]::UtcNow')<s.indexOf('Import-Module'));assert.match(s,/\$age=\(\$invokedAtUtc-/);
});

const configFixture=String.raw`
function FixtureConfigs{
 $script:configRefs=@{}
 foreach($key in @('operation','nativeOrder')){$path=Join-Path $receiptRoot ($key+'-offline.json');$bytes=[Text.Encoding]::UTF8.GetBytes(('OFFLINE_PRIVATE_SENTINEL_NOT_JSON_'+$key));[IO.File]::WriteAllBytes($path,$bytes);$configRefs[$key]=[pscustomobject]@{path=$path;sha256=(RaclHash $bytes)}}
 $settings=[pscustomobject]@{components=[pscustomobject]@{erpApiNative=[pscustomobject]@{config=$configRefs.operation};nativeOrder=[pscustomobject]@{config=$configRefs.nativeOrder}};privateSources=[pscustomobject]@{operationConfig=$configRefs.operation;nativeOrderConfig=$configRefs.nativeOrder}}
 $script:oldSettings=$settings|ConvertTo-Json -Depth 8 -Compress|ConvertFrom-Json;$script:newSettings=$settings|ConvertTo-Json -Depth 8 -Compress|ConvertFrom-Json
 $script:profile=[pscustomobject]@{candidateRules=@(@('erpApi','erpNative','hub')|ForEach-Object{[pscustomobject]@{role=$_;config=$configRefs.operation}})+@([pscustomobject]@{role='crmNativeOrder';config=$configRefs.nativeOrder})}
}
`;
test('explicit ConfigArtifacts targets only two fixed files, preserves previous receipt proofs and never decodes or emits config bytes',windows,()=>{
 const out=run(`${definitions}\n${disposable}\n${configFixture}\ntry{
$script:Mode='Harden';$old=RaclRun;$saved=@{};foreach($file in Get-ChildItem -LiteralPath $dir){$saved[$file.Name]=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash};FixtureConfigs
$script:TargetScope='ConfigArtifacts';$script:Mode='Inspect';$script:scopeCalls=0;$inspect=RaclRun;'INSPECT='+$inspect.status;'INSPECT_FILES='+$inspect.files.Count;'INSPECT_MUTATION='+$inspect.mutationExecuted
Rejected 'receipt-role-in-config' {RaclOpen 'erpApi'};Rejected 'receipt-namespace-in-config' {RaclWriteEvidence 'receipt-acl-result.json' @{} }
$script:Mode='Harden';$script:scopeCalls=0;$result=RaclRun;'STATUS='+$result.status;'FILES='+$result.files;'READBACKS='+$result.readbacks.Count;'CAS='+$scopeCalls
foreach($key in @('operation','nativeOrder')){RaclAcl (Get-Acl -LiteralPath $configRefs[$key].path) 'Protected2';if((Get-FileHash -LiteralPath $configRefs[$key].path -Algorithm SHA256).Hash.ToLowerInvariant()-cne$configRefs[$key].sha256){throw 'FIXTURE_CONFIG_BYTES_CHANGED'}}
foreach($name in $saved.Keys){if((Get-FileHash -LiteralPath (Join-Path $dir $name) -Algorithm SHA256).Hash-cne$saved[$name]){throw 'FIXTURE_RECEIPT_PROOF_CHANGED'}};'OLD_PROOFS=PASS'
foreach($proof in Get-ChildItem -LiteralPath $dir -Filter 'config-acl-*'){if([IO.File]::ReadAllText($proof.FullName).Contains('OFFLINE_PRIVATE_SENTINEL')){throw 'FIXTURE_SECRET_EMITTED'}};'NO_SECRET_CONTENT=PASS'
if((Get-Acl -LiteralPath $receiptRoot).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)-cne$parentSddl){throw 'FIXTURE_PARENT_CHANGED'};'PARENT=PASS'
Rejected 'config-once' {RaclWriteEvidence 'config-acl-result.json' @{} };$script:TargetScope='Receipts';Rejected 'config-role-in-receipts' {RaclOpen 'operation'};Rejected 'config-namespace-in-receipts' {RaclWriteEvidence 'config-acl-result.json' @{} }
}finally{CleanupFixture}`);
 for(const x of ['INSPECT=CONFIG_ACL_INSPECTED','INSPECT_FILES=2','INSPECT_MUTATION=False','STATUS=CONFIG_ACL_HARDENED','FILES=2','READBACKS=2','CAS=4','OLD_PROOFS=PASS','NO_SECRET_CONTENT=PASS','PARENT=PASS','REJECTED=receipt-role-in-config','REJECTED=receipt-namespace-in-config','REJECTED=config-once','REJECTED=config-role-in-receipts','REJECTED=config-namespace-in-receipts'])assert.ok(out.includes(x),out);
 const s=readFileSync(source,'utf8');assert.match(s,/ValidateSet\('Receipts','ConfigArtifacts'\).*TargetScope='Receipts'/);assert.match(s,/operation-7a41f6492273\.json/);assert.match(s,/native-order-7a41f6492273\.json/);assert.match(s,/cfb6817797fe3b081aab0fa484d6aded5a44dd5dee98a5b69ffdc1c90f553fd4/);assert.match(s,/617f4792968e20b7b9d30e66a4e920fb6eb93b80c39a2b6fcaff3fba8b200057/);
});

test('ConfigArtifacts rejects off-scope path/hash and old/new component/private/profile reference drift before mutation',windows,()=>{
 const edits=[['path',"$file.path='C:\\foreign\\operation.json'"],['hash',"$file.sha256='0'*64"],['old-component',"$oldSettings.components.erpApiNative.config.path='C:\\foreign.json'"],['new-component',"$newSettings.components.erpApiNative.config.sha256='0'*64"],['old-private',"$oldSettings.privateSources.operationConfig.sha256='0'*64"],['new-private',"$newSettings.privateSources.operationConfig.path='C:\\foreign.json'"],['profile',"$profile.candidateRules[0].config=[pscustomobject]@{path='C:\\foreign.json';sha256=('0'*64)}"],['role',"$file.role='erpApi'"]];
 const out=run(`${definitions}\n${disposable}\n${configFixture}\ntry{$script:TargetScope='ConfigArtifacts';FixtureConfigs;$file=RaclOpen 'operation';try{RaclConfig $file;'EXACT_CONFIG=PASS'}finally{$file.stream.Dispose()}\n${edits.map(([n,e])=>`FixtureConfigs;$file=RaclOpen 'operation';try{${e};Rejected '${n}' {RaclConfig $file}}finally{$file.stream.Dispose()}`).join('\n')}\n'EVIDENCE='+@(Get-ChildItem -LiteralPath $dir).Count;foreach($key in @('operation','nativeOrder')){RaclAcl (Get-Acl -LiteralPath $configRefs[$key].path) 'Inherited3'};'UNCHANGED_ACL=PASS'}finally{CleanupFixture}`);
 assert.match(out,/EXACT_CONFIG=PASS/);assert.match(out,/EVIDENCE=0/);assert.match(out,/UNCHANGED_ACL=PASS/);for(const [n]of edits)assert.match(out,new RegExp('REJECTED='+n));
});

test('ConfigArtifacts actual scope validates all ten processes and unchanged COM/binding gates despite only two metadata targets',windows,()=>{
 const out=run(`${definitions}\nRaclImportEngine ([IO.File]::ReadAllBytes(${q(engine)}))\n${candidateFixture}\n${scopeFixture}\n${String.raw`
$script:TargetScope='ConfigArtifacts';$script:configRefs=@{operation=[pscustomobject]@{path='C:\fixture\operation.json';sha256=('c'*64)};nativeOrder=[pscustomobject]@{path='C:\fixture\native-order.json';sha256=('d'*64)}}
$script:oldSettings=[pscustomobject]@{components=[pscustomobject]@{erpApiNative=[pscustomobject]@{config=$configRefs.operation};nativeOrder=[pscustomobject]@{config=$configRefs.nativeOrder}};privateSources=[pscustomobject]@{operationConfig=$configRefs.operation;nativeOrderConfig=$configRefs.nativeOrder}};$script:newSettings=$oldSettings
foreach($rule in $profile.candidateRules){if($rule.role-cin@('erpApi','erpNative','hub')){$rule.config=$configRefs.operation};if($rule.role-ceq'crmNativeOrder'){$rule.config=$configRefs.nativeOrder}}
$script:held=@(@('operation','nativeOrder')|ForEach-Object{[pscustomobject]@{role=$_;path=$configRefs[$_].path;sha256=$configRefs[$_].sha256}})
$scope=RaclScope $held;'TARGETS='+$held.Count;'PROCESS_ROLES='+$processRoles.Count;'SCOPE='+$scope.processCount+','+$scope.comCount+','+$scope.bindingCount;'KERNELS='+$kernelCalls
$instances[1].EnginePID=999;Rejected 'config-COM-drift' {RaclScope $held};$instances[1].EnginePID=109
$listeners[0].LocalAddress='0.0.0.0';Rejected 'config-binding-drift' {RaclScope $held};$listeners[0].LocalAddress='127.0.0.1'
$script:sidMode='denied';Rejected 'config-SID-denied' {RaclScope $held}
`}`);
 assert.match(out,/TARGETS=2/);assert.match(out,/PROCESS_ROLES=6/);assert.match(out,/SCOPE=10,2,11/);assert.match(out,/KERNELS=10/);for(const n of ['config-COM-drift','config-binding-drift','config-SID-denied'])assert.match(out,new RegExp('REJECTED='+n));
});
