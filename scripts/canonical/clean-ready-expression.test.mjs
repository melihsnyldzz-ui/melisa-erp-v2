import test from 'node:test';
import assert from 'node:assert/strict';
import {rewriteCleanReadyHashFallbacks,buildCleanReadyExpressionRepairDefinitions,buildCleanReadyExpressionRepairSql,buildCleanPersonnelWorkDefinitions} from './clean-personnel-work-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';

test('only two-argument predecessor hashes are evaluated once; Unicode and overlength fallback values cannot be truncated',()=>{
 const expression="COALESCE((SELECT m.before_hash FROM dbo.example m WHERE m.name=d.name),COALESCE(JSON_VALUE(@workPredecessors,N'$.'+d.name),CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2)))";
 const {body,replacements}=rewriteCleanReadyHashFallbacks(expression);
 assert.equal(replacements,2);
 assert.equal(body,"ISNULL(CONVERT(nvarchar(max),(SELECT m.before_hash FROM dbo.example m WHERE m.name=d.name)),ISNULL(CONVERT(nvarchar(max),JSON_VALUE(@workPredecessors,N'$.'+d.name)),CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2)))");
 for(const untouched of ["COALESCE(balance,0)","COALESCE((SELECT amount FROM dbo.sales),0)","COALESCE(JSON_VALUE(@payload,'$.amount'),0)","COALESCE(JSON_VALUE(@workPredecessors,'$.a'),'x','y')","N'COALESCE(JSON_VALUE(@workPredecessors,''$.a''),x)'","-- COALESCE(JSON_VALUE(@workPredecessors,'$.a'),x)\nSELECT 1","/* COALESCE(JSON_VALUE(@workPredecessors,'$.a'),x) */ SELECT 1"]){
  assert.equal(rewriteCleanReadyHashFallbacks(untouched).body,untouched);
 }
 assert.throws(()=>rewriteCleanReadyHashFallbacks('COALESCE((SELECT a.before_hash FROM dbo.x a),x'),/Unbalanced/);
});

test('every replacement is a read-only ready module; original sealed predecessors and business binders remain byte-identical',()=>{
 const prior=buildCleanPersonnelWorkDefinitions().definitions;
 const {before,definitions,counts}=buildCleanReadyExpressionRepairDefinitions();
 assert.deepEqual(Object.keys(before).sort(),Object.keys(prior).filter(n=>n.endsWith('_ready')).sort());
 assert.ok(counts.usp_clean_store_day_ready>2000);
 for(const [name,body]of Object.entries(before)){
  assert.equal(body,prior[name]);assert.ok(name.endsWith('_ready'));
  const next=definitions[name];
  assert.match(next,/EXEC dbo\.usp_clean_ready_expression_ready;DECLARE @readyExpressionPredecessors/);
  assert.match(next,/ISNULL\(JSON_VALUE\(@readyExpressionPredecessors/);
  assert.ok(next.indexOf('EXEC dbo.usp_clean_ready_expression_ready;')<next.indexOf('DECLARE @readyExpressionPredecessors'));
  // Existing denial codes, actor checks and semantic leaf predicates survive.
  assert.deepEqual([...next.matchAll(/THROW (\d+)/g)].map(m=>m[1]).filter(v=>v!=='51976'),[...body.matchAll(/THROW (\d+)/g)].map(m=>m[1]));
 }
 assert.ok(Object.keys(definitions).every(n=>n.endsWith('_ready')||n==='clean_ready_expression_immutable'));
 assert.doesNotMatch(Object.values(definitions).join('\n'),/SESSION_CONTEXT|CONTEXT_INFO|WAITFOR|CACHE|DISABLE TRIGGER|NOCHECK/);
});

test('new projection requires exact current module hashes, flags and immutable seal before exposing any predecessor',()=>{
 const {definitions}=buildCleanReadyExpressionRepairDefinitions();
 const guard=definitions.usp_clean_ready_expression_ready;
 assert.match(guard,/m\.uses_ansi_nulls<>1 OR m\.uses_quoted_identifier<>1/);
 assert.match(guard,/ExecIsTriggerDisabled/);
 // A present but encrypted/unreadable module has a NULL definition. A hash
 // comparison alone is UNKNOWN and must never authorize its old hash.
 assert.match(guard,/WHERE m\.object_id IS NULL OR m\.definition IS NULL OR d\.after_hash/);
 assert.match(guard,/d\.after_hash<>CONVERT\(char\(64\),HASHBYTES\('SHA2_256',m\.definition\),2\)/);
 for(const [name,body] of Object.entries(definitions).filter(([n])=>n!=='usp_clean_ready_expression_ready'&&n.endsWith('_ready'))){
  assert.ok(body.includes(moduleHash(guard)),name+' pins the exact new guard');
  assert.ok(body.includes(moduleHash(definitions.clean_ready_expression_immutable)),name+' pins its enabled immutable trigger');
 }
});

test('existing repair transaction retains exact target, shared lock, before images and metadata-only rollback/replay',()=>{
 const {before,definitions}=buildCleanReadyExpressionRepairDefinitions();
 const sql=buildCleanReadyExpressionRepairSql(),probe=buildCleanReadyExpressionRepairSql({probe:true});
 assert.match(sql,/MELISA_ERP_CLEAN_TEST_20261022/);assert.match(sql,/actual_t1=0 AND external_operations=0/);
 assert.match(sql,/SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION/);
 assert.match(sql,/@Resource=N'CLEAN_STORE_DAY_20261022'.*@LockMode=N'Exclusive'/);
 assert.match(sql,/before_definition nvarchar\(max\)/);assert.match(sql,/before_quoted_identifier bit/);
 assert.match(sql,/DENY INSERT,UPDATE,DELETE ON dbo\.clean_ready_expression_manifest/);
 assert.match(sql,/READY_EXPRESSION_ALREADY_INSTALLED/);
 assert.match(probe,/ROLLBACK;SELECT N'READY_EXPRESSION_PROBE_ROLLED_BACK'/);
 assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK;THROW/);
 assert.doesNotMatch(sql,/INSERT (?:INTO )?dbo\.(?:users|employees|roles|permissions|products|stock_movements|sales_invoices|supplier_movements)\b|UPDATE dbo\.|DELETE FROM dbo\.|DISABLE TRIGGER|DROP TABLE|NOCHECK CONSTRAINT/);
 for(const [name,body]of Object.entries(before))assert.ok(sql.includes(moduleHash(body)),name+' exact predecessor');
 for(const [name,body]of Object.entries(definitions))assert.ok(sql.includes(moduleHash(body)),name+' expected after bytes');
});
