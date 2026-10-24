import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleHash} from './stage4-copy-sql.mjs';
import {buildCleanOrderSaleProcedures} from './clean-order-sale-sql.mjs';
import {cleanInboundGuardUpgradePlan,compileCleanInboundGuardBranch,cleanInboundEffectiveDefinitionHashSql} from './clean-store-day-sql.mjs';

test('inbound extension preserves every original SALE guard byte after its closed branch',()=>{
 const before=buildCleanOrderSaleProcedures(),plan=cleanInboundGuardUpgradePlan();
 assert.deepEqual(plan.map(x=>x.table),['products','stock_movements','audit_logs']);
 for(const p of plan){
  assert.equal(p.beforeHash,moduleHash(before[p.name]));
  assert.equal(p.afterHash,moduleHash(p.definition.replace(/^ALTER TRIGGER/,'CREATE TRIGGER')));
  const originalBody=before[p.name].slice(before[p.name].indexOf('AS BEGIN')+'AS BEGIN'.length);
  assert.ok(p.definition.endsWith(originalBody));
  assert.ok(p.definition.includes('session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID()'));
  assert.ok(p.definition.includes('EXEC dbo.usp_clean_store_day_guard'));
  assert.ok(p.definition.includes("N'MELISA_ERP_CLEAN_TEST_20261022'"));
  assert.match(p.definition,/external_operations=0/);
  assert.doesNotMatch(p.definition,/DISABLE TRIGGER|ENABLE TRIGGER|GRANT |EXECUTE AS LOGIN|UPDATE dbo\.clean_order_sale_definitions/);
 }
});

test('unknown objects, drifted originals and injected aliases never compile',()=>{
 const before=buildCleanOrderSaleProcedures();
 for(const name of ['clean_sale_customers_guard','__proto__','products;DROP TABLE x'])assert.throws(()=>compileCleanInboundGuardBranch(name,before[name]));
 assert.throws(()=>compileCleanInboundGuardBranch('clean_sale_products_guard',before.clean_sale_products_guard+' '));
 assert.throws(()=>compileCleanInboundGuardBranch('clean_sale_products_guard',before.clean_sale_stock_movements_guard));
 assert.throws(()=>cleanInboundEffectiveDefinitionHashSql('d;DROP TABLE x'));
});

test('a new hash is substituted only for an exact object and immutable before hash',()=>{
 const sql=cleanInboundEffectiveDefinitionHashSql();
 assert.ok(sql.includes('e.name=d.name AND e.before_hash=d.definition_hash'));
 assert.ok(sql.endsWith(',d.definition_hash)'));
 assert.doesNotMatch(sql,/UPDATE |DELETE |INSERT |CREATE |ALTER |GRANT /);
});
