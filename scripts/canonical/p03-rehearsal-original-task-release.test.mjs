import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source=fileURLToPath(new URL('./p03-rehearsal-original-task-release.ps1',import.meta.url));
const restore=fileURLToPath(new URL('./p03-rehearsal-original-task-restore-security-annotation.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const q=s=>"'"+s.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
function run(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-Command','-'],{input:`try {\n$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }\n\n`,encoding:'utf8',windowsHide:true,timeout:30000,stdio:['pipe','pipe','pipe']});}
function extract(file,names){return `$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$t,[ref]$e);if($e.Count){throw ('PARSE '+$e[0].Message)}\n`+names.map(n=>`$f=@($a.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq${q(n)}},$true));if($f.Count-ne1){throw 'DEF'};. ([scriptblock]::Create($f[0].Extent.Text))`).join('\n');}
const restoreNames=['Need','Hash','TextHash','AssertTarget','TaskMissing','FindTask','AssertOriginalXml','ValidateBefore','DaclBytes','AssertAllowEquivalent','CompareTaskSecurity','CompareTaskXml','AssertExisting','AssertQuietData','RestoreOriginalTasks'];
const releaseNames=['ReleaseNeed','ReleaseHash','RestoreDefinitionText','ReleaseStates','ReleaseGate','ReleaseOriginalTasks'];
const oldTests=readFileSync(new URL('./p03-rehearsal-original-task-restore.test.mjs',import.meta.url),'utf8');
// Reuse only the existing synthetic fixture text, never import a test module or a helper Main.
const fixture=oldTests.match(/const fixture=String.raw`([\s\S]*?)`;\r?\n/)[1];
const releaseFixture=String.raw`
function ResetRelease {
 Reset;$script:releaseCase='valid';$script:events=@();$script:deleted=@();$script:receiptNumber=0
 $store[$before.tasks[1].name]=Task $before.tasks[1]
 $folder|Add-Member ScriptMethod GetTask {param($name)
  if($releaseCase-ceq'denied'-and$name-ceq'Melisa-P03-Rehearsal-Hub'){throw [UnauthorizedAccessException]::new('denied')}
  if($releaseCase-ceq'unknownmissing'-and$name-ceq'Melisa-P03-Rehearsal-Hub'){throw [IO.IOException]::new('unknown')}
  if($store.ContainsKey($name)){return $store[$name]};throw [IO.FileNotFoundException]::new('missing')
 } -Force
 $folder|Add-Member ScriptMethod DeleteTask {param($name,$flags)
  if($name-cnotin@('Melisa-P03-Rehearsal-Core','Melisa-P03-Rehearsal-Hub')-or$flags-ne0){throw 'DELETE_SCOPE'}
  if($events.Count-lt2-or$events[-1]-cne('DELETE_INTENT:'+$name)){throw 'NO_DURABLE_INTENT'}
  if($releaseCase-ceq'partial'-and$name-ceq'Melisa-P03-Rehearsal-Hub'){$script:releaseCase='valid';throw 'PARTIAL_DELETE_FAILED'}
  $store.Remove($name);$script:deleted+=,$name;$script:events+=,'DELETE_CALLED'
  if($releaseCase-ceq'lost-reply'){$script:releaseCase='valid';throw 'DELETE_RESPONSE_LOST'}
  if($releaseCase-ceq'second-drift'-and$name-ceq'Melisa-P03-Rehearsal-Core'){$store['Melisa-P03-Rehearsal-Hub'].Xml+=' '}
 }
}
function WriteReleaseReceipt($run,$step,$body){$script:receiptNumber++;$script:events+=,($body.event+':'+$(if($body.Contains('name')){$body.name}else{''}));[ordered]@{path='synthetic-receipt';sha256='c'*64}}
ResetRelease
`;
const setup=()=>extract(restore,restoreNames)+'\n'+extract(source,releaseNames)+'\n'+fixture+'\n'+releaseFixture;
test('finite release source imports pinned functions only and permits just fixed DeleteTask0 plus protected CreateNew receipts',windows,()=>{
 const s=readFileSync(source,'utf8');assert.match(s,/\$Mode='Inspect'/);assert.match(s,/source-p03-original-restore-c64624a3f45e.ps1/);assert.match(s,/c64624a3f45ef5791dcb82b648f3560c830f354ede2bc814c596099547c9aac9/);assert.match(s,/FileMode\]::CreateNew/);assert.match(s,/FileShare\]::None/);assert.match(s,/WriteThrough/);assert.match(s,/Flush\(\$true\)/);assert.match(s,/GetFolder\('\\'\)/);assert.equal((s.match(/\.DeleteTask\(/g)||[]).length,1);assert.match(s,/DeleteTask\(\$e.name,0\)/);assert.doesNotMatch(s,/\.Run\(|\.Stop\(|\.SetSecurityDescriptor\(|\.RegisterTask\(|EncodedCommand/);assert.match(s,/\$result.status-ceq'FAILED'\)\{exit 1\}/);
 assert.match(s,/FileSystemAccessRule\]::new\(\[Security.Principal.SecurityIdentifier\]::new\(\$sid\),'FullControl','Allow'\)/);
 const raw=readFileSync(restore,'utf8').replaceAll('\r\n','\n');assert.equal(createHash('sha256').update(raw).digest('hex'),'bbc7e5dd14f0f4d85d4971f6e1beefdd814151df4f0f8ed19cf6f5aa230c1435');
 const out=run(extract(source,releaseNames)+`\n$defs=RestoreDefinitionText ([IO.File]::ReadAllText(${q(restore)}));if($defs-match'function Main|exit 0|New-Object -ComObject'){throw 'IMPORTED_MAIN'};if($defs-notmatch'function RestoreOriginalTasks'){throw 'MISSING_RESTORER'};'AST_DEFINITIONS_ONLY'`);assert.match(out,/AST_DEFINITIONS_ONLY/);
 assert.throws(()=>run("function FixtureFail {\n throw 'EXPECTED_FIXTURE_FAILURE'\n}\nFixtureFail\n'UNREACHABLE'"),e=>e.status===1&&e.stderr.includes('EXPECTED_FIXTURE_FAILURE')&&!e.stdout.includes('UNREACHABLE'));
});
test('Inspect is read-only; release deletes exactly two original tasks with prior intents and absent final readback',windows,()=>{
 const out=run(setup()+String.raw`
$r=ReleaseOriginalTasks $folder $before 'Inspect';if($r.status-cne'INSPECTED'-or$deleted.Count-ne0-or$receiptNumber-ne0){throw 'INSPECT_WROTE'}
$r=ReleaseOriginalTasks $folder $before 'ReleaseForRehearsal';if($r.status-cne'RELEASED_FOR_REHEARSAL'-or-not$r.finalReadback-or-not$r.finallyRestoreRequired-or$deleted.Count-ne2-or$store.Count-ne0-or$created.Count-ne0){throw 'RELEASE_RESULT'}
if(($deleted-join',')-cne'Melisa-P03-Rehearsal-Core,Melisa-P03-Rehearsal-Hub'-or$receiptNumber-ne6){throw 'EXACT_RELEASE'}
'INSPECT_ZERO_RELEASE_TWO_ABSENT'
`);assert.match(out,/INSPECT_ZERO_RELEASE_TWO_ABSENT/);
});
test('second task drift, denied reads and unknown missing cannot be deleted or mistaken for success',windows,()=>{
 const out=run(setup()+String.raw`
foreach($c in @('denied','unknownmissing')){ResetRelease;$script:releaseCase=$c;Reject $c {ReleaseOriginalTasks $folder $before 'ReleaseForRehearsal'};if($deleted.Count-ne0-or$receiptNumber-ne0){throw 'EARLY_MUTATION'}}
ResetRelease;$script:releaseCase='second-drift';$r=ReleaseOriginalTasks $folder $before 'ReleaseForRehearsal';if($r.status-cne'FAILED'-or$r.finalReadback-or$deleted.Count-ne1-or$store.Count-ne2-or$r.recovery-cne'BLOCKED_OR_INCOMPLETE'){throw 'DRIFT_HANDLED_AS_SUCCESS'}
'FAILED_DRIFT_PRESERVED_FOREIGN_TASK'
`);assert.match(out,/REJECTED=denied/);assert.match(out,/REJECTED=unknownmissing/);assert.match(out,/FAILED_DRIFT_PRESERVED_FOREIGN_TASK/);
});
test('foreign orphan and protected drift reject without release; lost delete response safely restores only missing originals',windows,()=>{
 const out=run(setup()+String.raw`
foreach($c in @('orphan','drift')){ResetRelease;$script:case=$c;try{$r=ReleaseOriginalTasks $folder $before 'ReleaseForRehearsal';if($r.status-cne'FAILED'){throw 'ACCEPTED'}}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw}};if($deleted.Count-ne0-or$created.Count-ne0){throw 'PROTECTED_MUTATION'}}
ResetRelease;$script:releaseCase='partial';$r=ReleaseOriginalTasks $folder $before 'ReleaseForRehearsal';if($r.status-cne'FAILED'-or$r.recovery-cne'RESTORED_ORIGINALS_VERIFIED'-or$r.finalReadback-or$deleted.Count-ne1-or$store.Count-ne2-or$created.Count-ne1-or$created[0]-cne'Melisa-P03-Rehearsal-Core'){throw 'MISSING_ONLY_RECOVERY'}
foreach($e in $before.tasks){$null=AssertExisting ($store[$e.name]) $e}
ResetRelease;$script:releaseCase='lost-reply';$r=ReleaseOriginalTasks $folder $before 'ReleaseForRehearsal';if($r.status-cne'FAILED'-or$r.recovery-cne'RESTORED_ORIGINALS_VERIFIED'-or$deleted.Count-ne1-or$store.Count-ne2-or$created.Count-ne1){throw 'LOST_RESPONSE_RECOVERY'}
'PARTIAL_FAILURE_NON_SUCCESS_ORIGINALS_RECOVERED'
`);assert.match(out,/PARTIAL_FAILURE_NON_SUCCESS_ORIGINALS_RECOVERED/);
});
