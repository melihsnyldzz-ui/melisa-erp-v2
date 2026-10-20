import vm from 'node:vm';
import {crm06StaffJournalExcludedPaths} from './crm06-staff-journal-preflight.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const cli=fs.readFileSync(new URL('./p03-pr54-reads-prepare-owner-cli.mjs',import.meta.url),'utf8'),ps=fs.readFileSync(new URL('./p03-pr54-reads-protected-create.ps1',import.meta.url),'utf8');
test('new preparer binds committed Git bytes and preserves current runtime before seven CreateNew outputs',()=>{
 assert.match(cli,/CLEAN_SOURCE_REQUIRED/);assert.match(cli,/SOURCE_REPO_REJECTED/);assert.match(cli,/supervisorSource\+':'.*row\.path/);assert.match(cli,/supervisorManifest=sha\(manifestBytes\)/);assert.match(cli,/evidence\.references\.length!==journal\.crm06StaffJournalExcludedPaths\(source,variant\).length/);assert.match(cli,/erpManifest\.files\.length!==2089/);
 assert.match(cli,/const prepareNew=process\.argv\[2\]==='--PrepareNew'/);assert.ok(cli.indexOf('CURRENT_RUNTIME_CHANGED')<cli.indexOf("for(const [name,value,ref] of pending){const bytes"));
 assert.doesNotMatch(cli,/Stop-ScheduledTask|Start-ScheduledTask|runP03OwnerTransition|\.unlinkSync|\.rmSync/);for(const line of cli.split('\n').filter(x=>/console\.(log|error)/.test(x)))assert.doesNotMatch(line,/baseline|prepared\.activation|parentInputs|password/i);
});
test('protected writer uses seven exact new paths and current e59 ACL templates without overwriting',()=>{
 const block=ps.match(/\$allowed=@\(([\s\S]*?)\n\)/)?.[1];assert.ok(block);const leaves=[...block.matchAll(/\+'\\([^']+)'/g)].map(x=>x[1]);assert.equal(leaves.length,7);assert.equal(new Set(leaves).size,7);assert.ok(leaves.every(x=>x.includes('01ef3e3aa3bd')));
 assert.match(ps,/\$oldSettings=.*settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae\.json/);assert.match(ps,/\$oldReceipt=.*staff-refresh-successor-6bc82e6fe972-erp-e59e07abf7ae\.json/);assert.match(ps,/\[IO\.FileMode\]::CreateNew/);assert.match(ps,/\.Flush\(\$true\)/);assert.match(ps,/AreAccessRulesProtected/);assert.match(ps,/\$templateAces.Count -ne 2/);assert.doesNotMatch(ps,/Remove-Item|Move-Item|Set-Acl|CreateDirectory/);
});
test('new CLI and Windows PowerShell creator parse without executing preparation',{skip:process.platform!=='win32'},()=>{
 const node=spawnSync(process.execPath,['--check',fileURLToPath(new URL('./p03-pr54-reads-prepare-owner-cli.mjs',import.meta.url))],{encoding:'utf8',windowsHide:true});assert.equal(node.status,0,node.stderr);
 for(const leaf of ['p03-pr54-reads-protected-create.ps1','crm06-staff-journal-preflight.ps1','watch-hub-after-erp.ps1']){const file=fileURLToPath(new URL('./'+leaf,import.meta.url)).replaceAll("'","''");const command=`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count-ne0){exit 2};'PARSE_ONLY'`;const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,leaf);assert.equal(result.stdout.trim(),'PARSE_ONLY');}
});


test('B264 writer policy accepts only its six new paths and the shared exact dependency lock',{skip:process.platform!=='win32'},()=>{
 const policy=ps.slice(ps.indexOf("$erp='"),ps.indexOf("if(-not($allowed -ccontains $Target))"));
 const program=`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;function Policy([ValidateSet('Legacy','B264')][string]$Generation){${policy};return ,$allowed};$legacy=Policy 'Legacy';$current=Policy 'B264';if($legacy.Count-ne7-or$current.Count-ne7){throw 'COUNT'};if(@($current|Where-Object{$_-clike'*-b264-successor.json'}).Count-ne6){throw 'SUFFIX'};if(@($current|Where-Object{$_-cin$legacy}).Count-ne1){throw 'REUSE_SCOPE'};foreach($path in $current){if($path.Contains('..')-or$path.Contains('/')){throw 'ESCAPE'};if($path.ToUpperInvariant()-cin$current){throw 'CASE_ALIAS'}};try{Policy 'Foreign';throw 'EXPECTED_REJECTION'}catch{if($_.Exception.Message-ceq'EXPECTED_REJECTION'){throw}};'B264_FINITE_WRITER_SCOPE_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','& ([scriptblock]::Create([Console]::In.ReadToEnd()))'],{input:program,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/B264_FINITE_WRITER_SCOPE_PASS/);
});

test('CLI rejects unknown generation or extra arguments before package or private input access',()=>{
 for(const args of [['--DryRun','--Other'],['--PrepareNew','--B264','--Extra'],['--B264']]){const result=spawnSync(process.execPath,[fileURLToPath(new URL('./p03-pr54-reads-prepare-owner-cli.mjs',import.meta.url)),...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status,1);assert.match(result.stderr,/MODE_REJECTED/);assert.doesNotMatch(result.stderr,/password|baseline|activationObject/i);}
 assert.match(cli,/const b264=process.argv\[3\]==='--B264'/);assert.match(cli,/reusedErpDependency\)readPinned\(erpDependencyLockRef\)/);assert.match(cli,/b264\?preparePr54B264OwnerProfile:preparePr54ReadOwnerProfile/);
});


test('actual CLI journal guard accepts legacy30 and B26431 and rejects missing or added references',()=>{
 const guard=cli.match(/if\(evidence.status!=='READY'[^\n]+throw Error\('JOURNAL_NOT_READY'\);/)[0],source='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';
 for(const [variant,count] of [['erp-crm-pr54-reads-20261019',30],['erp-crm-pr54-b264-20261020',31]]){
  assert.equal(crm06StaffJournalExcludedPaths(source,variant).length,count);
  const run=n=>vm.runInNewContext(guard,{evidence:{status:'READY',references:Array(n)},journal:{crm06StaffJournalExcludedPaths},source,variant,Error});
  assert.doesNotThrow(()=>run(count));for(const n of [count-1,count+1])assert.throws(()=>run(n),/JOURNAL_NOT_READY/);
 }
});
