import test from 'node:test';import assert from 'node:assert/strict';
import {buildCleanPersonnelUsernameRepairDefinitions,buildCleanReadyExpressionRepairDefinitions,buildCleanReadyExpressionRepairSql,buildCleanPersonnelWorkDefinitions} from './clean-personnel-work-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';

test('username repair changes exactly the bracket-set literal and preserves all native actor, role, protected-record and length rules',()=>{
 const {before,definitions}=buildCleanPersonnelUsernameRepairDefinitions();
 const old=before.usp_clean_personnel_guard,next=definitions.usp_clean_personnel_guard;
 assert.equal(moduleHash(old),'FCCAC68074B877180CBDA6F33DA982C59EF0BCEF42B5BDF6FBA1F74F8584CC37');
 assert.equal(old,buildCleanPersonnelWorkDefinitions().definitions.usp_clean_personnel_guard);
 assert.equal(next,old.replace("N'%[^a-zA-Z0-9._-]%'","N'%[^-a-zA-Z0-9._]%'"));
 assert.match(next,/NOT BETWEEN 3 AND 80/);assert.match(next,/COLLATE Latin1_General_100_BIN2 LIKE N'%\[\^-a-zA-Z0-9\._\]%'/);
 assert.match(next,/NOT EXISTS\(SELECT 1 FROM dbo\.clean_personnel_members WHERE user_id=@target\)/);assert.match(next,/@@TRANCOUNT<>1/);
 assert.match(next,/transaction_id=CURRENT_TRANSACTION_ID\(\)/);
});

test('installed C1 definitions stay byte-identical and become exact predecessors of the finite username layer',()=>{
 const c1=buildCleanReadyExpressionRepairDefinitions().definitions;
 const digest=moduleHash(Object.entries(c1).sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>n+'='+moduleHash(b)).join('|'));
 assert.equal(digest,'E960C56965054C0A3E1ED3EBCFAA1AEDCCCFE5004452BE4670AE6E3A6C14CB6B');
 const {before,definitions}=buildCleanPersonnelUsernameRepairDefinitions();
 assert.equal(Object.keys(before).length,12);assert.equal(Object.keys(definitions).length,14);
 for(const name of Object.keys(before).filter(n=>n.endsWith('_ready'))){assert.equal(before[name],c1[name]);assert.match(definitions[name],/EXEC dbo\.usp_clean_personnel_username_ready;DECLARE @usernamePredecessors/);}
 assert.equal(before.clean_ready_expression_immutable,undefined,'old immutable trigger is not altered');
});

test('fresh actual module proofs precede C1 literal-pin and historical before-hash projection; unreadable definitions fail closed',()=>{
 const {definitions}=buildCleanPersonnelUsernameRepairDefinitions(),guard=definitions.usp_clean_personnel_username_ready;
 assert.match(guard,/m\.object_id IS NULL OR m\.definition IS NULL OR d\.after_hash/);
 assert.match(guard,/m\.uses_ansi_nulls<>1 OR m\.uses_quoted_identifier<>1/);
 assert.match(guard,/ExecIsTriggerDisabled/);
 for(const [name,body]of Object.entries(definitions).filter(([n])=>n.endsWith('_ready')&&n!=='usp_clean_personnel_username_ready')){
  assert.ok(body.includes(moduleHash(guard)),name+' exact new guard');
  assert.ok(body.indexOf('EXEC dbo.usp_clean_personnel_username_ready;')<body.indexOf('DECLARE @usernamePredecessors'),name);
  assert.match(body,/ISNULL\(JSON_VALUE\(@usernamePredecessors/);
  if(name!=='usp_clean_ready_expression_ready')assert.match(body,/JSON_VALUE\(@usernamePredecessors,N'\$\.usp_clean_ready_expression_ready'\)/,'existing C1 literal pin sees its proven predecessor only');
 }
});

test('same existing installer supports only this finite repair with transactional before images, exact replay and no business/role writes',()=>{
 const sql=buildCleanReadyExpressionRepairSql({username:true}),probe=buildCleanReadyExpressionRepairSql({username:true,probe:true});
 const statements=sql.replace(/N?'(?:''|[^'])*'/g,"''");
 assert.match(sql,/CREATE TABLE dbo\.clean_personnel_username_manifest/);assert.match(sql,/SERIALIZABLE;BEGIN TRANSACTION/);
 assert.match(sql,/before_definition nvarchar\(max\)/);assert.match(sql,/@Resource=N'CLEAN_STORE_DAY_20261022'/);
 assert.match(sql,/PERSONNEL_USERNAME_ALREADY_INSTALLED/);assert.match(probe,/ROLLBACK;SELECT N'PERSONNEL_USERNAME_PROBE_ROLLED_BACK'/);
 assert.match(sql,/DENY INSERT,UPDATE,DELETE ON dbo\.clean_personnel_username_manifest/);
 assert.doesNotMatch(statements,/\b(?:INSERT (?:INTO )?|UPDATE |DELETE FROM )(?:dbo\.)?(?:users|roles|permissions|employees|products|sales_invoices)\b/i);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|NOCHECK CONSTRAINT|UPDATE dbo\.clean_ready_expression_manifest|UPDATE dbo\.clean_personnel_work_manifest|SESSION_CONTEXT|CONTEXT_INFO/);
});
