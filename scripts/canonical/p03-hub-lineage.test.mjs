import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(here,name),'utf8');
const start=read('start-hub-web.ps1'),watch=read('watch-hub-web.ps1');

test('candidate19 actual PowerShell admission binds exact date, eight-character source prefix and rooted family',()=>{
 const fn=start.match(/function Assert-HubPath[\s\S]*?\r?\n}/)?.[0];
 const begin=start.indexOf("Assert-HubPath $c.PackageRoot 'C:\\Sirket\\ERP\\releases'"),end=start.indexOf("if((Get-FileHash -LiteralPath $c.NodePath",begin);
 assert.ok(fn&&begin>0&&end>begin);
 const cases=[
  ['C:\\Sirket\\ERP\\releases\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a','01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2',true],
  ['C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae','e59e07abf7ae2567cdc2adb93811fe29e0032fe5',true],
  ['C:\\Sirket\\ERP\\releases\\CANONICAL-HUB-TEST-accepted','a'.repeat(40),true],
  ...['CANONICAL-CANDIDATE-TEST-20261018-01ef3e3a','CANONICAL-CANDIDATE-TEST-20261020-01ef3e3a','CANONICAL-CANDIDATE-TEST-20261019-01EF3E3A','CANONICAL-CANDIDATE-TEST-20261019-01ef3e3','CANONICAL-CANDIDATE-TEST-20261019-01ef3e3aa','CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a-extra','UNKNOWN-TEST-20261019-01ef3e3a'].map(name=>['C:\\Sirket\\ERP\\releases\\'+name,'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2',false]),
  ['C:\\Sirket\\ERP\\releases\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a','f'.repeat(40),false],
  ['C:\\Sirket\\ERP\\releases\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a','01ef3e3a'+'A'.repeat(32),false],
  ['C:\\foreign\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a','01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2',false]
 ];
 const input=Buffer.from(JSON.stringify(cases)).toString('base64');
 const program=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
function Get-Item {param($LiteralPath) [pscustomobject]@{Attributes=0}}
${fn}
$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${input}'))|ConvertFrom-Json
foreach($row in $cases){$c=[pscustomobject]@{PackageRoot=$row[0];SourceCommit=$row[1]};$accepted=$false;try{
${start.slice(begin,end)}
$accepted=$true}catch{if($_.Exception.Message-cnotin@('HUB_PACKAGE_SCOPE_REJECTED','HUB_PACKAGE_PATH_REJECTED')){throw}}
if($accepted-ne$row[2]){throw 'ADMISSION_RESULT_MISMATCH'}};'ADMISSION_CASES_VERIFIED'`;
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',program],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,`${result.stderr} ${result.stdout}`);
 assert.equal(result.stdout.trim(),'ADMISSION_CASES_VERIFIED');
});

test('candidate19 actual Inspect preflight validates full package and dependencies without starting a port',()=>{
 const source=Buffer.from(start).toString('base64');
 const program=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$root='C:\\Sirket\\ERP\\releases\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a';$commit='01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2';$digest='a'*64
$c=[pscustomobject]@{PackageRoot=$root;SourceCommit=$commit;ManifestSha256=$digest;OperationConfigPath='C:\\private\\operation.json';HubConfigPath='C:\\private\\hub.json';NodePath='C:\\tools\\node.exe';NodeSha256=$digest;OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;RuntimeDir='C:\\private\\hub-runtime'}
$manifest=[pscustomobject]@{sourceCommit=$commit;baselineReproduced=$true;sharedTestCopy=[pscustomobject]@{database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';webPort=5234;actualT1=$false};files=@([pscustomobject]@{path='apps/api/start-shared-test-copy-web.mjs';sha256=$digest})}
$operation=[pscustomobject]@{database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';webPort=5234;erpPort=4184;nativePort=4186;host='127.0.0.1';lanHost='192.168.1.46';copyContext=[pscustomobject]@{copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82'}}
function Get-Content {param($LiteralPath,[switch]$Raw) switch -CaseSensitive($LiteralPath){'C:\\private\\startup.json'{$c|ConvertTo-Json -Depth 6;break};'C:\\private\\operation.json'{$operation|ConvertTo-Json -Depth 6;break};'C:\\private\\hub.json'{[pscustomobject]@{apiSourceCommit=$commit}|ConvertTo-Json;break};default{if($LiteralPath-cne(Join-Path $root 'release-manifest.json')){throw 'UNEXPECTED_READ'};$manifest|ConvertTo-Json -Depth 6}}}
function Get-Item {param($LiteralPath) [pscustomobject]@{Attributes=0}}
function Get-FileHash {param($LiteralPath,$Algorithm) if($LiteralPath-cnotin@($c.NodePath,(Join-Path $root 'release-manifest.json'),(Join-Path $root 'apps/api/start-shared-test-copy-web.mjs'))){throw 'UNEXPECTED_HASH'};[pscustomobject]@{Hash=$digest}}
function Invoke-RestMethod {param($Uri,$TimeoutSec,$MaximumRedirection) if($Uri-cnotin@('http://127.0.0.1:4184/test-health','http://127.0.0.1:4186/test-health')){throw 'UNEXPECTED_HTTP'};$port=if($Uri.Contains(':4184/')){4184}else{4186};[pscustomobject]@{ok=$true;environment='ISOLATED_TEST_COPY';port=$port;databaseName=$operation.database;copyId=$operation.copyContext.copyId;sourceCommit=$commit;actualT1=$false;sysadmin=0;databaseControl=0;liveDatabaseAccess=0;originalDatabaseAccess=0}}
function Start-Process {throw 'MUTATION_FORBIDDEN'}
function New-Item {throw 'MUTATION_FORBIDDEN'}
function Set-Content {throw 'MUTATION_FORBIDDEN'}
function Get-NetTCPConnection {throw 'PORT_PROBE_FORBIDDEN_IN_INSPECT'}
& ([scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${source}')))) -StartupConfigPath 'C:\\private\\startup.json' -Action Inspect
throw 'INSPECT_DID_NOT_EXIT'`;
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','-'],{input:program,encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,`${result.stderr} ${result.stdout}`);
 assert.match(result.stdout,/HUB_WEB_PACKAGE_AND_DEPENDENCIES_VERIFIED/);
 assert.doesNotMatch(result.stderr,/MUTATION_FORBIDDEN|PORT_PROBE_FORBIDDEN/);
});

const readinessBlock=()=>{
 const block=start.match(/\$ready=\$false[\s\S]*?if\(!\$ready\)\{throw 'HUB_WEB_READINESS_FAILED'\}/)?.[0];
 assert.ok(block,'launcher readiness extraction failed');
 return block;
};

test('readiness polling never assigns the case-insensitive Attempt parameter',()=>{
 assert.doesNotMatch(readinessBlock(),/\$attempt\s*(?:=|\+\+|--|\+=|-=)/i);
});

test('readiness polling preserves caller retry identity and receipt filenames',()=>{
 const readiness=readinessBlock();
 const lineagePath=start.match(/^\$lineagePath=Join-Path[^\r\n]+/m)?.[0];
 const pointerPath=start.match(/^\$pointer=Join-Path[^\r\n]+/m)?.[0];
 assert.ok(lineagePath&&pointerPath,'launcher receipt path extraction failed');
 const command=`
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Invoke-RestMethod {
 param($Uri,$TimeoutSec,$MaximumRedirection)
 if($script:readyPoll -lt 0 -or $script:poll -lt $script:readyPoll){throw 'NOT_READY'}
 return [pscustomobject]@{
  ok=$true;environment='ISOLATED_TEST_COPY';port=5234;copyId='copy'
  actualT1=$false;databaseName='test';sourceCommit='commit'
 }
}
function Get-NetTCPConnection {
 param($State,$LocalPort,$ErrorAction)
 return @(
  [pscustomobject]@{OwningProcess=42;LocalAddress='127.0.0.1'}
  [pscustomobject]@{OwningProcess=42;LocalAddress='192.168.1.46'}
 )
}
function Start-Sleep {param($Milliseconds)}
$exercise={
 param([int]$Attempt,[int]$ReadyOn)
 $script:poll=-1
 $script:readyPoll=$ReadyOn
 $child=[pscustomobject]@{Id=42;HasExited=$false}
 $child|Add-Member -MemberType ScriptMethod -Name Refresh -Value {$script:poll++}
 $operation=[pscustomobject]@{
  copyContext=[pscustomobject]@{copyId='copy'};database='test'
 }
 $c=[pscustomobject]@{SourceCommit='commit';RuntimeDir='C:\\runtime'}
 $run='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
 $failure=$null
 try{
${readiness}
 }catch{$failure=$_.Exception.Message}
${lineagePath}
${pointerPath}
 [pscustomobject]@{
  attempt=$Attempt;readyOn=$ReadyOn;ready=$ready;failure=$failure
  polls=$script:poll+1
  lineageName=[IO.Path]::GetFileName($lineagePath)
  pointerName=[IO.Path]::GetFileName($pointer)
 }
}
$results=@(
 foreach($inputAttempt in 0..3){
  foreach($readyOn in @(0,2,-1)){
   & $exercise $inputAttempt $readyOn
  }
 }
)
ConvertTo-Json -InputObject $results -Compress
`;
 const result=spawnSync('powershell.exe',[
  '-NoProfile','-NonInteractive','-Command',command
 ],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,`${result.stderr} ${result.stdout}`);
 const rows=JSON.parse(result.stdout.trim());
 assert.equal(rows.length,12);
 for(let attempt=0;attempt<=3;attempt++){
  for(const readyOn of [0,2,-1]){
   const row=rows[attempt*3+[0,2,-1].indexOf(readyOn)];
   assert.equal(row.attempt,attempt,`attempt ${attempt}, readyOn ${readyOn}`);
   assert.equal(row.ready,readyOn>=0);
   assert.equal(row.failure,readyOn<0?'HUB_WEB_READINESS_FAILED':null);
   assert.equal(row.polls,readyOn<0?20:readyOn+1);
   assert.equal(row.lineageName,`hub-web-lineage-${'a'.repeat(32)}-${attempt}.json`);
   assert.equal(row.pointerName,`hub-web-process-${'a'.repeat(32)}-${attempt}.json`);
  }
 }
});

test('both PowerShell sources parse without running startup or stop actions',()=>{
 for(const name of ['start-hub-web.ps1','watch-hub-web.ps1']){
  const file=path.join(here,name).replaceAll("'","''");
  const command=`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,`${name}: ${result.stderr} ${result.stdout}`);
 }
});

test('source admits only exact pinned completion package dates and keeps Hub family',()=>{
 const admission=/\^CANONICAL-COMPLETE-TEST-\(\?:20261011\|20261017\|20261018\)-\(\[a-f0-9\]\{7,12\}\)\$/;
 assert.match(start,admission);
 const pattern=/^CANONICAL-COMPLETE-TEST-(?:20261011|20261017|20261018)-([a-f0-9]{7,12})$/;
 for(const [name,commit] of [['CANONICAL-COMPLETE-TEST-20261018-7abf962a6446','7abf962a6446eb3a800babd5b54312a8b913d814'],['CANONICAL-COMPLETE-TEST-20261011-bbbbbbb','b'.repeat(40)],['CANONICAL-COMPLETE-TEST-20261017-e0e6c28','e0e6c288373478208a1fb2b48fca36b18b092dac']]){
  const match=pattern.exec(name);assert.ok(match&&commit.startsWith(match[1]));
 }
 for(const name of ['CANONICAL-COMPLETE-TEST-20261019-7abf962a6446','CANONICAL-COMPLETE-TEST-20261018-7ABF962A6446','CANONICAL-COMPLETE-TEST-20261018-7abf962a6446-extra','CANONICAL-COMPLETE-TEST-20261012-e0e6c28','CANONICAL-COMPLETE-TEST-20261017-e0e6c28-extra','CANONICAL-COMPLETE-TEST-20261017-E0E6C28'])assert.equal(pattern.test(name),false);
 assert.match(start,/CANONICAL-HUB-TEST-/);
});

test('manual run identity rejects uppercase while lowercase stays valid',()=>{
 assert.match(start,/\$run -cnotmatch '\^\[a-f0-9\]\{32\}\$'/);
 const command="if(('a' * 32) -cnotmatch '^[a-f0-9]{32}$'){exit 1};if(('A' * 32) -cnotmatch '^[a-f0-9]{32}$'){exit 0};exit 2";
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);
});

test('durable receipt is born protected, create only, flushed, hashed and independently published',()=>{
 for(const pattern of [/FileMode\]::CreateNew/,/FileOptions\]::WriteThrough/,/\.Flush\(\$true\)/,/SetAccessRuleProtection\(\$true,\$false\)/,/Get-FileHash -LiteralPath \$file/,/FileSystemRights\]::FullControl,\[IO\.FileShare\]::None,4096,\[IO\.FileOptions\]::WriteThrough,\$security/,/lineageSha256=\$lineageSha/,/hub-web-process-'\+\$run\+'-'\+\$Attempt\+'\.json'/])assert.match(start,pattern);
 assert.doesNotMatch(start,/\[IO\.File\]::Replace|Set-Acl|Join-Path \$c\.RuntimeDir 'hub-web-process\.json'/);
 for(const pattern of [/lineageSha256 -notmatch/,/HUB_WATCH_LINEAGE_HASH_REJECTED/,/HUB_WATCH_LINEAGE_ACL_REJECTED/,/HUB_WATCH_LAUNCHER_REJECTED/,/HUB_WATCH_CHILD_REJECTED/,/HUB_WATCH_BINDINGS_REJECTED/])assert.match(watch,pattern);
 assert.doesNotMatch(watch,/Join-Path \$c\.RuntimeDir 'hub-web-process\.json'/);
 assert.match(start,/\$child\.Kill\(\)/);
 assert.match(start,/\$child\.WaitForExit\(5000\)/);
 assert.match(watch,/HUB_WATCH_UNVERIFIED_CHILD_OR_PORT/);
 assert.match(watch,/ParentProcessId='\+\$starter\.Id/);
 assert.match(start,/\$node\.CommandLine\.TrimEnd\(\) -cne \$expectedNode/);
 assert.match(watch,/\$lineage\.launcher\.argv\.TrimEnd\(\) -cne \$expectedLauncher/);
 assert.match(watch,/for\(\$attempt=0;\$attempt -le 3;\$attempt\+\+\)/);
});
