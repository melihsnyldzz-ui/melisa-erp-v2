import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const file=fileURLToPath(new URL('./p03-current-invariance-pre-revision.ps1',import.meta.url)),source=fs.readFileSync(file,'utf8'),q=s=>"'"+s.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
function run(code){return execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command','-'],{input:`try {\n$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'}\n${code}\n} catch { [Console]::Error.WriteLine($_.Exception.Message);exit 1 }\n\n`,encoding:'utf8',windowsHide:true,timeout:20000});}
const policy=String.raw`
$gates=@($a.EndBlock.Statements|Where-Object{$_.Extent.StartLineNumber-le3})
$leaf=@($a.EndBlock.Statements|Where-Object{$_.Extent.Text.StartsWith('$leafRevision=')})
if($gates.Count-ne2-or$leaf.Count-ne1){throw 'POLICY_SHAPE'}
$text='function Policy {'+$a.ParamBlock.Extent.Text+[Environment]::NewLine+($gates.Extent.Text-join[Environment]::NewLine)+[Environment]::NewLine+$leaf[0].Extent.Text+[Environment]::NewLine+'return @((''source-''+$Phase.ToLowerInvariant()+''-snapshot''+$leafRevision+''.json''),(''source-''+$Phase.ToLowerInvariant()+''-proof''+$leafRevision+''.json''))}'
. ([scriptblock]::Create($text))
`;
test('revision policy executes only AST parameters and early scope gates; default historical leaves remain unchanged',windows,()=>{
 const out=run(policy+String.raw`
foreach($day in @('19','20','21')){foreach($phase in @('Pre','Post')){$r=@(Policy -Phase $phase -RunId ('P03-202610'+$day+'-123456'));if(($r-join'|')-cne('source-'+$phase.ToLowerInvariant()+'-snapshot.json|source-'+$phase.ToLowerInvariant()+'-proof.json')){throw 'DEFAULT_DRIFT'}}}
$r=@(Policy -Phase Pre -RunId P03-20261021-123456 -CaptureRevision ('a'*32));if(($r-join'|')-cne('source-pre-snapshot-'+('a'*32)+'.json|source-pre-proof-'+('a'*32)+'.json')){throw 'REVISION_LEAF'}
'DEFAULT_AND_REVISION_PASS'
`);assert.match(out,/DEFAULT_AND_REVISION_PASS/);
});
test('invalid revision or revision with Post/old runs rejects before any filesystem or SQL body',windows,()=>{
 const out=run(policy+String.raw`
$cases=@(@{Phase='Post';RunId='P03-20261021-123456';CaptureRevision=('a'*32)},@{Phase='Pre';RunId='P03-20261020-123456';CaptureRevision=('a'*32)},@{Phase='Pre';RunId='P03-20261019-123456';CaptureRevision=('a'*32)},@{Phase='Pre';RunId='P03-20261021-123456';CaptureRevision=('A'*32)},@{Phase='Pre';RunId='P03-20261021-123456';CaptureRevision=('a'*31)},@{Phase='Pre';RunId='P03-20261021-123456';CaptureRevision=('a'*32+'\other')},@{Phase='Pre';RunId='P03-20261021-123456';CaptureRevision=''})
foreach($case in $cases){try{Policy @case|Out-Null;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw}}}
'FINITE_NEGATIVES_PASS'
`);assert.match(out,/FINITE_NEGATIVES_PASS/);
});
test('snapshot algorithm, readonly transaction,51-table proof, ACL and CreateNew implementation stay byte-identical',()=>{
 const old=execFileSync('git',['show','HEAD:scripts/canonical/p03-current-invariance-capture.ps1'],{cwd:fileURLToPath(new URL('../..',import.meta.url)),encoding:'utf8'}).replaceAll('\r\n','\n'),now=source.replaceAll('\r\n','\n');
 const functions=s=>s.slice(s.indexOf('function Assert-True('),s.indexOf('$leafRevision=')>=0?s.indexOf('$leafRevision='):s.indexOf('$leafPhase='));
 assert.equal(functions(now),functions(old));assert.match(now,/\[IO.FileMode\]::CreateNew/);assert.match(now,/criticalTablesHashed=51/);assert(!/ALTER DATABASE|RESTORE DATABASE|BACKUP DATABASE|INSERT INTO|DELETE FROM/i.test(now));
 assert(source.indexOf("throw 'SOURCE_CAPTURE_REVISION_SCOPE'")<source.indexOf('Open-Database'));
 assert.equal((source.match(/\+\$leafRevision\+'\.json'/g)||[]).length,4);
 assert.equal(createHash('sha256').update(functions(now)).digest('hex'),createHash('sha256').update(functions(old)).digest('hex'));
});
