import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCleanStoreDayDefinitions,buildCleanStoreDayCohortSql} from './clean-store-day-cohort-sql.mjs';
import {buildCleanCompatibleSaleBegin,buildCleanOrderSaleProcedures} from './clean-order-sale-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
test('closed cohort replaces only native readiness and keeps old immutable definition history',()=>{
 const {definitions:d,guards,total}=buildCleanStoreDayDefinitions();
 assert.equal(total,Object.keys(d).length+3);assert.equal(guards.length,3);
 assert.match(d.usp_clean_order_sale_begin_v3,/usp_clean_store_day_ready/);
 assert.match(d.usp_clean_order_sale_finish_v2,/usp_clean_store_day_ready/);
 assert.match(d.usp_clean_order_sale_begin_v3,/EXISTS\(SELECT 1 FROM dbo.clean_store_day_intents/);
 assert.equal(moduleHash(buildCleanCompatibleSaleBegin()),'32EB590A7B2846D27C61074457F577C6B1D47F9624EE15870E0E674E53F2E23B');
 for(const g of guards)assert.equal(g.beforeHash,moduleHash(buildCleanOrderSaleProcedures()[g.name]));
 const hash='$2b$12$'+'.'.repeat(53),sql=buildCleanStoreDayCohortSql(hash,hash);
 assert.match(sql,/BEGIN TRY BEGIN TRANSACTION/);assert.match(sql,/END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW/);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|DROP TRIGGER|UPDATE dbo\.clean_order_sale_definitions|UPDATE dbo\.crm_order_v2_definitions/);
 assert.match(sql,/CLEAN_INBOUND_BEFORE_HASH/);assert.match(sql,/GRANT UPDATE\(balance,updated_at\)/);
});
test('native admission and finish constrain role, account, receipt and exactly one effect',()=>{
 const {definitions:d}=buildCleanStoreDayDefinitions();
 assert.match(d.usp_clean_store_day_bind,/@@TRANCOUNT<>1/);
 assert.match(d.usp_clean_store_day_bind,/CLEAN_STORE_DAY_20261022/);
 assert.match(d.usp_clean_store_day_bind,/HASHBYTES\('SHA2_256',@payload_json\)/);
 assert.match(d.usp_clean_store_day_bind,/@actor_id=18.*clean_test_warehouse/);
 assert.match(d.usp_clean_store_day_bind,/@actor_id=19.*clean_test_inbound_supervisor/);
 assert.match(d.usp_clean_store_day_finish,/@stock\+@stockDelta/);
 assert.match(d.usp_clean_store_day_finish,/@balance\+@balanceDelta/);
 assert.match(d.usp_clean_store_day_finish,/c.balance=n.customer_balance_before/);
 assert.match(d.usp_clean_store_received_purchase_proof,/stockAlreadyPosted/);
 assert.match(d.usp_clean_store_received_purchase_proof,/quantity_net=g.quantity/);
 assert.match(d.usp_clean_store_day_guard,/FULL JOIN OPENJSON/);
 assert.match(d.usp_clean_store_day_guard,/stock_cost_effect_try'\)\),-999999\)<>@total/);
 for(const table of ['clean_order_sale_definitions','clean_order_sale_compatibility'])assert.match(d.usp_clean_store_day_ready,new RegExp(table+'.*ExecIsTriggerDisabled'));
});
import {buildCleanStoreDayFinanceDefinitions,buildCleanStoreDayFinanceSql} from './clean-store-day-cohort-sql.mjs';

test('finance continuation preserves the immutable old cohort and only versions exact native guards',()=>{
 const f=buildCleanStoreDayFinanceDefinitions();assert.equal(f.total,Object.keys(f.definitions).length);
 assert.deepEqual(Object.keys(f.before).sort(),['clean_sale_customer_movements_guard','clean_sale_customers_guard','usp_clean_store_day_guard','usp_clean_store_day_ready']);
 for(const name of ['clean_sale_customers_guard','clean_sale_customer_movements_guard']){
  const body=f.before[name],suffix=body.slice(body.indexOf('AS BEGIN')+8);assert.ok(f.definitions[name].endsWith(suffix));
 }
 assert.match(f.definitions.usp_clean_store_day_ready,/f\.before_hash=e\.after_hash/);
 const install=buildCleanStoreDayFinanceSql('$2b$10$'+'a'.repeat(53));
 assert.doesNotMatch(install,/DISABLE TRIGGER|DROP TABLE|UPDATE dbo\.clean_store_day_module_manifest|DELETE dbo\.clean_store_day_module_manifest/);
 assert.match(install,/WITH CHECK ADD CONSTRAINT CK_customer_movements_type/);
 assert.match(install,/ORNEK-TRY-20261022/);assert.match(install,/opening_balance decimal\(18,4\) NOT NULL DEFAULT\(0\)/);
 assert.throws(()=>buildCleanStoreDayFinanceSql('plain credential'));
});

test('finance native binder and finish require exact actor, target, current ledger and one cash counterpart',()=>{
 const {definitions:d}=buildCleanStoreDayFinanceDefinitions(),b=d.usp_clean_store_finance_bind,g=d.usp_clean_store_finance_guard,f=d.usp_clean_store_finance_finish;
 assert.match(b,/ISNULL\(@actor_id,-1\)<>20/);assert.match(b,/ISNULL\(@invoice_id,-1\)<>4/);assert.match(b,/ISNULL\(@receipt_id,-1\)<>3/);
 assert.match(b,/CLEAN_STORE_DAY_20261022/);assert.match(b,/CURRENT_TRANSACTION_ID/);assert.match(b,/@amount>120-@paid/);assert.match(b,/@amount>376\.5-@paid/);assert.match(b,/@amount>@account/);
 assert.match(g,/customer_max_before/);assert.match(g,/supplier_max_before/);assert.match(g,/unchanged|FULL JOIN OPENJSON/);
 assert.match(f,/customer_count_before/);assert.match(f,/finance_count_before/);assert.match(f,/stock_count_before/);assert.match(f,/DELETE dbo\.work_trade_intents/);
 assert.doesNotMatch(f,/UPDATE dbo\.products|UPDATE dbo\.sales_invoices|UPDATE dbo\.purchase_invoices/);
});

test('clean bootstrap static import graph cannot load database/auth before its verified context is registered',()=>{
 const forbidden=new URL('../../apps/api/src/config/database.js',import.meta.url).href;
 function trace(start){
  const seen=new Set(),paths=[];
  function visit(url,chain=[]){if(seen.has(url.href))return;seen.add(url.href);if(url.href===forbidden){paths.push([...chain,url.href]);return;}
   const source=readFileSync(url,'utf8'),imports=/^\s*(?:import\s+(?:[^;'\"]*?\s+from\s+)?|export\s+[^;'\"]*?\s+from\s+)['\"](\.[^'\"]+)['\"]/gm;
   for(const match of source.matchAll(imports))visit(new URL(match[1],url),[...chain,url.href]);
  }
  visit(start);return {seen,paths};
 }
 const entry=new URL('../../apps/api/src/cleanSyntheticServer.mjs',import.meta.url),beforeRegistration=trace(entry);
 assert.ok(beforeRegistration.seen.size>20);assert.deepEqual(beforeRegistration.paths,[],'An eager import defeats clean SQL-auth selection and loads the unused native trusted driver');
 const auth=trace(new URL('../../apps/api/src/routes/workCollectionRoutes.mjs',import.meta.url));
 assert.ok(auth.paths.some(p=>p.at(-1)===forbidden),'Regression analyzer must recognize the actual transitive auth/database import');
 assert.ok(fileURLToPath(entry).endsWith('cleanSyntheticServer.mjs'));
});
