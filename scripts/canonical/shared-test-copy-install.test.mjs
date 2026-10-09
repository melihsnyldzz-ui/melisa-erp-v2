import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const installer=fs.readFileSync(new URL('./shared-test-copy-install.ps1',import.meta.url),'utf8');
test('failure diagnostics exclude SQL text and credentials even after transaction rollback',()=>{
 const diagnostic=installer.match(/\$safeFailure=\[ordered\]@\{([^\n]+)\}/)?.[1];assert.ok(diagnostic);
 assert.doesNotMatch(diagnostic,/\.Message|CommandText|definition|sqlPassword|salesSqlPassword|jwt|connectionString|StackTrace/i);
 for(const field of ['phase','currentModuleName','errorType','sqlErrorNumber','sqlProcedure','sqlLineNumber','rollback'])assert.ok(diagnostic.includes(field+'='));
 assert.ok(installer.includes("$phase='INSTALL_NEW_MODULE'"));assert.ok(installer.includes("$phase='REPLACE_MODULE'"));
});
test('private ACL helper refuses source config and unrelated files before filesystem access',{skip:process.platform!=='win32'},()=>{
 const helper=fileURLToPath(new URL('./protect-shared-test-private-file.ps1',import.meta.url));
 const code=`$ErrorActionPreference='Stop'; . '${helper.replaceAll("'","''")}';foreach($p in @('C:\\Sirket\\ERP\\runtime\\ERP-STAGE04-20261008\\copy-config.json','C:\\Sirket\\ERP\\config\\TEST-20260929-01\\runtime-private.json','C:\\outside.json')){try{Protect-SharedPrivateFile $p;throw 'UNBLOCKED'}catch{if($_.Exception.Message -cne 'SHARED_PRIVATE_ACL_PATH'){throw}}};'PRIVATE_ACL_BOUNDARY_PASS'`;
 const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PRIVATE_ACL_BOUNDARY_PASS/);
});
