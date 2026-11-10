import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {compileCompletionRecoveryRead,compileCompletionTechnicalAlter,RECOVERY_READ_FIELDS,assertRecoveryReadback,assertRecoveryPublicDataUnchanged} from './empty-v7-completion-recovery-core.mjs';
import {compileEmptyV7FirstSetup} from './empty-v7-setup-core.mjs';
const identity={adminPid:101,adminSidHex:'0x010100000000000512000000'},owner={userId:'1',roleId:'1',userVersion:'0000000000000815'};
test('read and technical-only ALTER compile finite DB9 guards and public snapshots without selecting a human hash',()=>{
 for(const descriptor of [compileCompletionRecoveryRead(identity,owner),compileCompletionTechnicalAlter(identity,owner)]){
  assert.equal(descriptor.target.databaseId,9);assert.deepEqual(descriptor.fieldNames,RECOVERY_READ_FIELDS);assert.equal(descriptor.executionAuthorized,false);assert.equal(descriptor.sha256,createHash('sha256').update(descriptor.sql).digest('hex'));
  for(const text of ['<>502','<>35','<>1','row_version=0x0000000000000815',"N'Shared memory'",'host_process_id','101',identity.adminSidHex,'ROLLBACK TRANSACTION','CONVERT(binary(8),row_version)'])assert(descriptor.sql.includes(text),text);
  for(const text of ['password_hash','INSERT ','CREATE LOGIN','CREATE USER','GRANT ','DBCC','RESEED','UPDATE dbo.users'])assert(!descriptor.sql.includes(text),text);
 }
 const read=compileCompletionRecoveryRead(identity,owner),alter=compileCompletionTechnicalAlter(identity,owner);
 assert(!read.sql.includes('COMMIT TRANSACTION'));assert(!read.sql.includes('ALTER LOGIN'));assert.equal(alter.humanCredentialTouched,false);assert.equal(alter.rolesOrGrantsChanged,false);
 assert.equal((alter.sql.match(/ALTER LOGIN \[/g)||[]).length,1);assert.equal((alter.sql.match(/COMMIT TRANSACTION/g)||[]).length,1);assert(alter.sql.includes('ALTER LOGIN [melisa_empty_profile_db9_writer_v1] WITH PASSWORD='));
 assert(alter.sql.indexOf('EMPTY_RECOVERY_DATA_CHANGED')<alter.sql.indexOf('COMMIT TRANSACTION'));
 for(const patch of [{userId:'2'},{roleId:'2'},{userVersion:'0000000000000816'},{userVersion:'12345678'}])assert.throws(()=>compileCompletionTechnicalAlter(identity,{...owner,...patch}));
 for(const adminPid of [0,-1,'101',1.2])assert.throws(()=>compileCompletionRecoveryRead({...identity,adminPid},owner));
});
test('timestamp final select uses explicit binary8; an eight-character version is never accepted',()=>{
 const original=compileEmptyV7FirstSetup(identity).sql;
 assert(original.includes('LOWER(CONVERT(varchar(16),CONVERT(binary(8),row_version),2))'));
 const row={state:'EMPTY_V7_COMPLETION_RECOVERY_READ',...owner,...Object.fromEntries(RECOVERY_READ_FIELDS.slice(4).map(k=>[k,'a'.repeat(64)]))};
 assert.equal(assertRecoveryReadback(row,owner),true);assert.throws(()=>assertRecoveryReadback({...row,userVersion:'12345678'},owner));
 assert.equal(assertRecoveryPublicDataUnchanged(row,{...row,state:'EMPTY_V7_TECHNICAL_PASSWORD_CHANGED'}),true);
 for(const key of ['userId','roleId','userVersion',...RECOVERY_READ_FIELDS.slice(4)])assert.throws(()=>assertRecoveryPublicDataUnchanged(row,{...row,[key]:'changed'}));
 assert.throws(()=>assertRecoveryReadback({...row,unexpected:'x'},owner));
});
test('actual wrapper ordering durably stores and verifies the cipher before the only SQL child; its failure branch never retries',()=>{
 const ps=fs.readFileSync(new URL('./empty-v7-completion-recovery.ps1',import.meta.url),'utf8'),local=fs.readFileSync(new URL('./empty-v7-completion-recovery-local.mjs',import.meta.url),'utf8');
 const positions=[ps.indexOf('$f.Flush($true)'),ps.indexOf('Set-Acl -LiteralPath $secretFile'),ps.indexOf("$storageSha=Public-New 'completion-recovery-storage.v1.json'"),ps.indexOf("$phase='TECHNICAL_RECOVERY_CHILD'")];
 assert(positions.every(x=>x>=0));assert.deepEqual([...positions].sort((a,b)=>a-b),positions);assert(ps.includes('$fa.SetOwner($who.User)'));assert(ps.includes('FileShare]::None'));assert(ps.includes('s.nlink!==1'));
 assert(ps.includes('function Start-Node([string[]]$nodeArguments'));assert(ps.includes('foreach($arg in $nodeArguments)'));assert(ps.includes('else{$child.WaitForExit()}'));assert(ps.indexOf('if(-not$publicOnly){$script:nodeStarted=$true}')<ps.indexOf('$child.StandardInput.Write($inputText)'));
 assert(!ps.includes('Unprotect'));assert(!ps.includes('ALTER LOGIN'));assert(!ps.includes('Remove-Item'));
 const durable=local.indexOf("'DURABLE_STORAGE');hold("),attempt=local.indexOf("const recoveryAttemptSha256=record("),submit=local.indexOf("submitted=true;const after=");assert(durable>0&&attempt>durable&&submit>attempt);
 assert(local.indexOf("phase='FRESH_STRICT_TLS'")>submit);assert(local.indexOf("record('first-owner-setup-receipt.v1.json'")>local.indexOf("'TLS_RIGHTS_READBACK'"));
 assert(!local.includes('password_hash'));assert(!local.includes('Unprotect'));assert(!local.includes('setTimeout'));assert(!local.includes('retry('));
});
