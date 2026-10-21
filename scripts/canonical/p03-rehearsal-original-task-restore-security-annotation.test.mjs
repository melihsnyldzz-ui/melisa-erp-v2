import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-rehearsal-original-task-restore-security-annotation.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const q=s=>"'"+s.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
// Plain stdin is only an offline AST/function-fixture runner, never the helper Main.
function run(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-Command','-'],{input:`try {\n$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }\n\n`,encoding:'utf8',windowsHide:true,timeout:30000,stdio:['pipe','pipe','pipe']});}
function extract(names){return `$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(source)},[ref]$t,[ref]$e);if($e.Count){throw ('PARSE '+$e[0].Message)}\n`+names.map(n=>`$f=@($a.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq${q(n)}},$true));if($f.Count-ne1){throw 'DEF'};. ([scriptblock]::Create($f[0].Extent.Text))`).join('\n');}
const base=['Need','Hash','TextHash','AssertTarget','TaskMissing','FindTask','AssertOriginalXml','ValidateBefore','DaclBytes','AssertAllowEquivalent','CompareTaskSecurity','CompareTaskXml','AssertExisting','AssertQuietData','RestoreOriginalTasks'];
test('only one direct literal SD line may differ; complete remaining XML bytes and independent security guard remain exact',windows,()=>{
 const out=run(extract(base)+String.raw`
$sddl='O:SYG:SYD:P(A;;FA;;;SY)(A;;FR;;;BA)(A;;FW;;;BU)(A;;FX;;;WD)'
$original="<Task xmlns=""http://schemas.microsoft.com/windows/2004/02/mit/task"">\r\n  <RegistrationInfo>\r\n    <Author>fixture</Author>\r\n  </RegistrationInfo>\r\n  <Settings/>\r\n</Task>".Replace('\r',([string][char]13)).Replace('\n',([string][char]10))
$line='    <SecurityDescriptor>'+$sddl+'</SecurityDescriptor>'+([string][char]13+[char]10)
$actual=$original.Replace('  </RegistrationInfo>',$line+'  </RegistrationInfo>')
$ok=CompareTaskXml $original $actual $sddl
if($ok.xmlMode-cne'REGISTRATION_SECURITY_DESCRIPTOR_ANNOTATION_ONLY'-or$ok.expectedXmlSha256-ceq$ok.actualXmlSha256){throw 'METADATA'}
if((CompareTaskXml $original $original $sddl).xmlMode-cne'RAW_ORIGINAL_EXACT'){throw 'RAW'}
function RejectXml($label,$value){try{CompareTaskXml $original $value $sddl|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED='+$label}}
RejectXml 'wrong-value' ($actual.Replace($sddl,$sddl+'x'))
RejectXml 'duplicate' ($actual.Replace($line,$line+$line))
RejectXml 'attribute' ($actual.Replace('<SecurityDescriptor>','<SecurityDescriptor x="1">'))
RejectXml 'cdata' ($actual.Replace($sddl,'<![CDATA['+$sddl+']]>'))
RejectXml 'child' ($actual.Replace($sddl,'<Value>'+$sddl+'</Value>'))
RejectXml 'comment' ($actual.Replace($sddl,'<!--x-->'+$sddl))
RejectXml 'wrong-location' ($actual.Replace($line,'').Replace('  <Settings/>',$line+'  <Settings/>'))
RejectXml 'extra' ($actual.Replace('<Settings/>','<Settings/><Extra/>'))
RejectXml 'other-change' ($actual.Replace('fixture','changed'))
RejectXml 'newline' ($actual.Replace(([string][char]13+[char]10),([string][char]10)))
RejectXml 'inline' ($actual.Replace(([string][char]13+[char]10)+$line,$line.TrimEnd()))
RejectXml 'namespace' ($actual.Replace('mit/task','mit/other'))
$task=[pscustomobject]@{Enabled=$true;State=3;Xml=$actual;security=$sddl}
$task|Add-Member ScriptMethod GetInstances {param($flags) @()}
$task|Add-Member ScriptMethod GetSecurityDescriptor {param($flags) $this.security}
$expected=[pscustomobject]@{xml=$original;sddl=$sddl}
if((AssertExisting $task $expected)-cne'RAW_ORIGINAL_EXACT'){throw 'INDEPENDENT_SECURITY'}
$task.security=$sddl.Replace('(A;;FX','(D;;FX')
try{AssertExisting $task $expected|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'SECURITY_REJECTED'}
'ANNOTATION_ONLY_COMPLETE'
`);for(const x of ['wrong-value','duplicate','attribute','cdata','child','comment','wrong-location','extra','other-change','newline','inline','namespace'])assert.match(out,new RegExp('REJECTED='+x));assert.match(out,/SECURITY_REJECTED/);assert.match(out,/ANNOTATION_ONLY_COMPLETE/);
});
const fixture=String.raw`
$script:owner='S-1-5-21-111-222-333-1001'
$sddl='O:SYG:SYD:P(A;;FA;;;SY)(A;;FR;;;BA)(A;;FW;;;BU)(A;;FX;;;WD)'
function Xml($kind){$run='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-'+('a'*32);return '<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Triggers/><Principals><Principal><UserId>'+$owner+'</UserId><LogonType>InteractiveToken</LogonType></Principal></Principals><Actions><Exec><Command>C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe</Command><Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File &quot;'+$run+'\packages\old\p03-rehearsal-watch-'+$kind+'.ps1&quot; -StartupConfigPath &quot;'+$run+'\settings-old.json&quot; -StartupConfigSha256 '+('b'*64)+'</Arguments><WorkingDirectory>'+$run+'\packages\old</WorkingDirectory></Exec></Actions></Task>'}
$before=[pscustomobject]@{owner=$owner;mutationExecuted=$false;tasks=@([pscustomobject]@{name='Melisa-P03-Rehearsal-Core';state=3;xml=(Xml 'core');sddl=$sddl},[pscustomobject]@{name='Melisa-P03-Rehearsal-Hub';state=3;xml=(Xml 'hub');sddl=$sddl})}
function Reject($name,[scriptblock]$call){try{&$call|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED='+$name}}
function Task($expected){$o=[pscustomobject]@{Enabled=$true;State=3;Xml=$expected.xml;security=$expected.sddl};$o|Add-Member ScriptMethod GetInstances {param($flags)return @()};$o|Add-Member ScriptMethod GetSecurityDescriptor {param($flags)if($flags-ne7){throw 'SDDL_SCOPE'};return $this.security};return $o}
function Reset {
 $script:created=@();$script:quietCalls=0;$script:frameCalls=0;$script:case='valid';$script:queries=0;$script:store=@{};$store[$before.tasks[0].name]=Task $before.tasks[0]
 $script:folder=[pscustomobject]@{}
 $folder|Add-Member ScriptMethod GetTask {param($name)$script:queries++;if($case-ceq'access'){throw [UnauthorizedAccessException]::new('DENIED')};if($store.ContainsKey($name)){return $store[$name]};throw [IO.FileNotFoundException]::new('missing')}
 $folder|Add-Member ScriptMethod RegisterTask {param($name,$xml,$flags,$sid,$password,$logon,$acl)
  if($name-cnotin@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')-or$flags-ne18-or$sid-cne$owner-or$null-ne$password-or$logon-ne3){throw 'MUTATOR_SCOPE'}
  if($case-ceq'race'){$store[$name]=Task $before.tasks[1];throw [Runtime.InteropServices.COMException]::new('exists',-2147024713)}
  if($case-ceq'register-fail'){throw 'CREATE_FAILED'}
  if($store.ContainsKey($name)){throw 'OVERWRITE'};$script:created+=,$name;$store[$name]=Task ([pscustomobject]@{xml=$xml;sddl=$acl});return $store[$name]
 }
}
function AssertQuiet($folder){$script:quietCalls++;if($case-ceq'orphan'){throw 'ORPHAN'}}
function ProtectedFrame($folder){$script:frameCalls++;if($case-ceq'drift'-and$frameCalls-ge3){return 'changed'};return 'stable'}
function AssertProtected($folder,$expected){Need ((ProtectedFrame $folder)-ceq$expected) 'PROTECTED_DRIFT'}
function ReadOriginalBefore{return $before}
Reset
`;
test('annotated Core is retained and only absent Hub created; both readbacks explicitly expose XML annotation mode',windows,()=>{
 const out=run(extract(base)+fixture+String.raw`
$nl=[string][char]13+[char]10
foreach($e in $before.tasks){$e.xml=$e.xml.Replace('<Triggers/>',$nl+'<RegistrationInfo>'+$nl+'</RegistrationInfo>'+$nl+'<Triggers/>')}
function Annotated($xml){$xml.Replace('</RegistrationInfo>','  <SecurityDescriptor>'+$sddl+'</SecurityDescriptor>'+$nl+'</RegistrationInfo>')}
Reset
$core=$store[$before.tasks[0].name];$core.Xml=Annotated $before.tasks[0].xml
$folder|Add-Member -Force ScriptMethod RegisterTask {param($name,$xml,$flags,$sid,$password,$logon,$acl)
 if($name-cne'Melisa-P03-Rehearsal-Hub'-or$flags-ne18-or$sid-cne$owner-or$null-ne$password-or$logon-ne3-or$store.ContainsKey($name)){throw 'SCOPE'}
 $script:created+=,$name;$t=Task ([pscustomobject]@{xml=(Annotated $xml);sddl=$acl});$store[$name]=$t;return $t
}
$result=RestoreOriginalTasks $folder $before 'Restore'
if(-not[object]::ReferenceEquals($core,$store[$before.tasks[0].name])-or$created.Count-ne1-or$created[0]-cne'Melisa-P03-Rehearsal-Hub'-or-not$result.finalReadback-or$result.saclScope-cne'NOT_OBSERVED'){throw 'ORCHESTRATION'}
foreach($t in $result.tasks){if($t.xml.xmlMode-cne'REGISTRATION_SECURITY_DESCRIPTOR_ANNOTATION_ONLY'-or$t.xml.expectedXmlSha256-ceq$t.xml.actualXmlSha256){throw 'OUTPUT_METADATA'}}
'ANNOTATED_CORE_RETAINED_HUB_ONLY_CREATED'
`);assert.match(out,/ANNOTATED_CORE_RETAINED_HUB_ONLY_CREATED/);
});
test('finite source defaults Inspect; only CREATE18 mutation, explicit root, safe failure exit and parser',windows,()=>{
 const s=readFileSync(source,'utf8');assert.match(s,/\$Mode='Inspect'/);assert.match(s,/GetFolder\('\\'\)/);assert.equal((s.match(/\.RegisterTask\(/g)||[]).length,1);assert.match(s,/RegisterTask\(\$expected.name,\$expected.xml,18,\$script:owner,\$null,3,\$expected.sddl\)/);assert.doesNotMatch(s,/\.SetSecurityDescriptor\(|\.DeleteTask\(|\.Run\(|\.Stop\(|Invoke-Expression|EncodedCommand/);assert.match(s,/catch\{[\s\S]*finalReadback=\$false[\s\S]*exit 1\}/);assert.match(s,/GetAttributes\(\$p\)/);assert.match(s,/61f545642ee32ecb88a7a58a1f76a6f97e944d0400c5678ec2d89e0a9cbd2fe0/);
 assert.match(run(extract(base)+"\n'PARSED_FUNCTIONS_ONLY'"),/PARSED_FUNCTIONS_ONLY/);
 assert.throws(()=>run("function OfflineFailure {\n throw 'OFFLINE_RUNNER_FAILURE'\n}\nOfflineFailure\n'UNREACHABLE'"),e=>e.status===1&&e.stderr.includes('OFFLINE_RUNNER_FAILURE')&&!e.stdout.includes('UNREACHABLE'));
});
test('GetTask missing recognizes only typed HRESULT80070002 including mapped file-not-found and nested wrappers',windows,()=>{
 const out=run(extract(['Need','AssertTarget','TaskMissing','FindTask'])+String.raw`
$missing=[Runtime.InteropServices.COMException]::new('missing',-2147024894);$mapped=[IO.FileNotFoundException]::new('missing');$nested=[Exception]::new('wrapper',$mapped)
foreach($e in @($missing,$mapped,$nested)){if(-not(TaskMissing $e)){throw 'MISSING_NOT_RECOGNIZED'}}
foreach($e in @([Runtime.InteropServices.COMException]::new('denied',-2147024891),[UnauthorizedAccessException]::new('denied'),[IO.IOException]::new('other'),[Exception]::new('wrapper',[Exception]::new('unknown')))){if(TaskMissing $e){throw 'UNKNOWN_MAPPED_TO_MISSING'}}
'TYPED_MISSING_ONLY'
`);assert.match(out,/TYPED_MISSING_ONLY/);
});
test('original XML predicates reject target, principal, action, trigger and path drifts without touching task service',windows,()=>{
 const out=run(extract(base)+fixture+String.raw`
ValidateBefore $before
foreach($change in @('target','owner','trigger','exec','run','multiprincipal')){Reject $change {switch($change){target{AssertTarget 'Melisa-Hub-TEST-Web'}owner{AssertOriginalXml $before.tasks[0].xml $before.tasks[0].name 'S-1-5-18'}trigger{AssertOriginalXml ($before.tasks[0].xml-replace'<Triggers/>','<Triggers><BootTrigger/></Triggers>') $before.tasks[0].name $owner}exec{AssertOriginalXml ($before.tasks[0].xml-replace'powershell.exe','cmd.exe') $before.tasks[0].name $owner}run{AssertOriginalXml ($before.tasks[0].xml-replace'settings-old.json','settings-new.json') $before.tasks[0].name $owner}multiprincipal{AssertOriginalXml ($before.tasks[0].xml-replace'</Principals>','<Principal/></Principals>') $before.tasks[0].name $owner}}}}
'XML_SCOPE_VALIDATED'
`);for(const x of ['target','owner','trigger','exec','run','multiprincipal'])assert.match(out,new RegExp('REJECTED='+x));
});
test('security accepts original or reordered four simple allows; rejects deny, missing owner, duplicate drift, flags/revision/RM differences',windows,()=>{
 const out=run(extract(base)+fixture+String.raw`
if((CompareTaskSecurity $sddl $sddl)-cne'RAW_ORIGINAL_EXACT'){throw 'RAW'}
$reorder='O:SYG:SYD:PAI(A;;FX;;;WD)(A;;FW;;;BU)(A;;FR;;;BA)(A;;FA;;;SY)'
if((CompareTaskSecurity $sddl $reorder)-cne'ALLOW4_EFFECTIVE_EQUIVALENT_SACL_NOT_OBSERVED'){throw 'EQUIVALENT'}
Reject 'deny' {CompareTaskSecurity $sddl ($reorder-replace'\(A;;FX','(D;;FX')}
Reject 'owner' {CompareTaskSecurity $sddl ($reorder-replace'O:SY','')}
Reject 'extra' {CompareTaskSecurity $sddl ($reorder+'(A;;FR;;;SY)')}
Reject 'duplicate' {CompareTaskSecurity $sddl ($reorder-replace'FR;;;BA','FW;;;BU')}
Reject 'flags' {CompareTaskSecurity $sddl ($reorder-replace'D:PAI','D:AI')}
$old=[Security.AccessControl.RawSecurityDescriptor]::new($sddl);$now=[Security.AccessControl.RawSecurityDescriptor]::new($reorder)
$now.ResourceManagerControl=1;Reject 'rm' {AssertAllowEquivalent $old $now}
$now=[Security.AccessControl.RawSecurityDescriptor]::new($reorder);$dacl=[Security.AccessControl.RawAcl]::new(4,4);foreach($ace in $now.DiscretionaryAcl){$dacl.InsertAce($dacl.Count,$ace)};$now.DiscretionaryAcl=$dacl;Reject 'revision' {AssertAllowEquivalent $old $now}
'SDDL_NARROW_EQUIVALENCE'
`);for(const x of ['deny','owner','extra','duplicate','flags','rm','revision'])assert.match(out,new RegExp('REJECTED='+x));assert.match(out,/SDDL_NARROW_EQUIVALENCE/);
});
test('quiet data rejects portless run-root orphan and unknown root process while ignoring only reader PID',windows,()=>{
 const out=run(extract(base)+fixture+String.raw`
$p=[pscustomobject]@{ProcessId=200;CommandLine='node C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\fixture.mjs';ExecutablePath='C:\node.exe'}
Reject 'portless' {AssertQuietData @($p) @() @() 999}
$p.CommandLine='unrelated';$p.ExecutablePath='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\unknown.exe';Reject 'unknown' {AssertQuietData @($p) @() @() 999}
AssertQuietData @($p) @() @() 200
Reject 'port' {AssertQuietData @() @('listener') @() 999};Reject 'instance' {AssertQuietData @() @() @('instance') 999}
'QUIET_READONLY'
`);for(const x of ['portless','unknown','port','instance'])assert.match(out,new RegExp('REJECTED='+x));
});
test('mocked orchestration preserves existing Core; Inspect writes zero; Restore missing Hub once and verifies final readback',windows,()=>{
 const out=run(extract(base)+fixture+String.raw`
$r=RestoreOriginalTasks $folder $before 'Inspect';if($created.Count-ne0-or$r.tasks[1].status-cne'ABSENT'){throw 'INSPECT_WRITES'}
$r=RestoreOriginalTasks $folder $before 'Restore';if($created.Count-ne1-or$created[0]-cne'Melisa-P03-Rehearsal-Hub'-or-not$r.finalReadback){throw 'CREATE_ONCE'}
$r=RestoreOriginalTasks $folder $before 'Restore';if($created.Count-ne1-or$r.tasks[1].status-cne'EXISTING_VERIFIED'){throw 'REPLAY_WRITE'}
Reset;$store=@{};$r=RestoreOriginalTasks $folder $before 'Restore';if($created.Count-ne2){throw 'FIRST_MISSING'}
'INSPECT_ZERO_RESTORE_ONCE_REPLAY_ZERO'
`);assert.match(out,/INSPECT_ZERO_RESTORE_ONCE_REPLAY_ZERO/);
});
test('mocked orchestration fails closed on denied read, racing create, protected drift, orphan and failed registration',windows,()=>{
 const out=run(extract(base)+fixture+String.raw`
foreach($c in @('access','race','drift','orphan','register-fail')){Reset;$script:case=$c;Reject $c {RestoreOriginalTasks $folder $before 'Restore'};if($created.Count-ne0){throw 'UNEXPECTED_CREATE'}}
'NO_OVERWRITE_NO_STOP_NO_DELETE'
`);for(const x of ['access','race','drift','orphan','register-fail'])assert.match(out,new RegExp('REJECTED='+x));
});
