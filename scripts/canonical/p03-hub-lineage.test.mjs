import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(here,name),'utf8');
const start=read('start-hub-web.ps1'),watch=read('watch-hub-web.ps1');

test('both PowerShell sources parse without running startup or stop actions',()=>{
 for(const name of ['start-hub-web.ps1','watch-hub-web.ps1']){
  const file=path.join(here,name).replaceAll("'","''");
  const command=`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,`${name}: ${result.stderr} ${result.stdout}`);
 }
});

test('source admits only exact pinned completion package dates and keeps Hub family',()=>{
 const admission=/\^CANONICAL-COMPLETE-TEST-\(\?:20261011\|20261017\)-\(\[a-f0-9\]\{7,12\}\)\$/;
 assert.match(start,admission);
 const pattern=/^CANONICAL-COMPLETE-TEST-(?:20261011|20261017)-([a-f0-9]{7,12})$/;
 for(const [name,commit] of [['CANONICAL-COMPLETE-TEST-20261011-bbbbbbb','b'.repeat(40)],['CANONICAL-COMPLETE-TEST-20261017-e0e6c28','e0e6c288373478208a1fb2b48fca36b18b092dac']]){
  const match=pattern.exec(name);assert.ok(match&&commit.startsWith(match[1]));
 }
 for(const name of ['CANONICAL-COMPLETE-TEST-20261012-e0e6c28','CANONICAL-COMPLETE-TEST-20261017-e0e6c28-extra','CANONICAL-COMPLETE-TEST-20261017-E0E6C28'])assert.equal(pattern.test(name),false);
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
