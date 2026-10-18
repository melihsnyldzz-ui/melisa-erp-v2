import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cli=fs.readFileSync(new URL('./p03-pr53-ci-prepare-owner-cli.mjs',import.meta.url),'utf8');
const ps=fs.readFileSync(new URL('./p03-pr53-ci-protected-create.ps1',import.meta.url),'utf8');

test('Node child loads exact Windows built-ins with module discovery disabled, read only',{skip:process.platform!=='win32'},()=>{
 const bootstrap=ps.match(/try\{\s*foreach\(\$moduleName[\s\S]*?\n\}catch\{[\s\S]*?\n\}/)?.[0];assert.ok(bootstrap);
 assert.doesNotMatch(bootstrap,/Set-ExecutionPolicy|PSModulePath\s*=/);
 const file=fileURLToPath(new URL('./p03-pr53-ci-protected-create.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$ErrorActionPreference='Stop';$PSModuleAutoLoadingPreference='None';${bootstrap};$acl=Get-Acl -LiteralPath '${file}';$item=Get-Item -LiteralPath '${file}';$hash=Get-FileHash -LiteralPath '${file}' -Algorithm SHA256;if(-not $acl-or-not $item-or$hash.Hash.Length-ne64){exit 2};'BUILTIN_READONLY_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:''}});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'BUILTIN_READONLY_PASS');
 assert.match(cli,/P03_BUILTIN_MODULE_IMPORT_FAILED/);assert.match(cli,/P03_PROTECTED_WRITER_EXEC_FAILED/);
});
test('owner CLI defaults to DryRun and admits only one explicit creation mode',()=>{
 assert.match(cli,/\['--DryRun','--PrepareNew',undefined\]\.includes/);
 assert.match(cli,/const prepareNew=process\.argv\[2\]==='--PrepareNew'/);
 assert.match(cli,/if\(prepareNew\)\{/);
 assert.doesNotMatch(cli,/Stop-ScheduledTask|Start-ScheduledTask|runP03OwnerTransition|\.unlinkSync|\.rmSync|--write|--finish-receipt/);
 assert.ok(cli.indexOf('SUPERVISOR_INVENTORY_CHANGED')<cli.indexOf('dotenv.parse'));
 assert.match(cli,/manifest\.files\.length!==316/);
 assert.match(cli,/evidence\.references\.length!==29/);
 assert.match(cli,/NEW_TARGET_EXISTS/);
 assert.match(cli,/PREPARATION_FAILED_PARTIAL_FILES_RETAINED/);
 for(const line of cli.split('\n').filter(x=>/console\.(log|error)/.test(x)))assert.doesNotMatch(line,/baseline|prepared\.activation|parentInputs|password/i);
});
test('protected creator permits only seven new literal paths and exact existing ACL templates',()=>{
 const block=ps.match(/\$allowed=@\(([\s\S]*?)\n\)/)?.[1];assert.ok(block);
 const leaves=[...block.matchAll(/\+'\\([^']+)'/g)].map(x=>x[1]);
 assert.equal(leaves.length,7);assert.equal(new Set(leaves).size,7);
 assert.ok(leaves.every(x=>x.includes('e59e07abf7ae')));
 assert.match(ps,/\[IO\.FileMode\]::CreateNew/);assert.match(ps,/\.Flush\(\$true\)/);
 assert.match(ps,/\$templateAces.Count -ne 2/);assert.match(ps,/AreAccessRulesProtected/);
 assert.match(ps,/\$expectedTemplate=if\(\$Target.StartsWith/);
 assert.doesNotMatch(ps,/Remove-Item|Move-Item|Set-Acl|CreateDirectory/);
});
test('owner CLI and PS5 creator parse without executing preparation',{skip:process.platform!=='win32'},()=>{
 const node=spawnSync(process.execPath,['--check',fileURLToPath(new URL('./p03-pr53-ci-prepare-owner-cli.mjs',import.meta.url))],{encoding:'utf8',windowsHide:true});assert.equal(node.status,0,node.stderr);
 const file=fileURLToPath(new URL('./p03-pr53-ci-protected-create.ps1',import.meta.url)).replaceAll("'","''");
 const command=`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){exit 1}`;
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
});
