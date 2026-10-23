import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCleanStoreDayDefinitions,buildCleanStoreDayCohortSql,buildCleanStoreDayInventoryDefinitions} from './clean-store-day-cohort-sql.mjs';
import {buildCleanCompatibleSaleBegin,buildCleanOrderSaleProcedures} from './clean-order-sale-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildCleanStoreAdministratorDefinitions,buildCleanStoreAdministratorSql,CLEAN_ADMIN_PERMISSIONS} from './clean-store-day-cohort-sql.mjs';
import {buildCleanFinanceRehearsalPredecessors,buildCleanFinanceRehearsalDefinitions,buildCleanFinanceCashDefinitions,buildCleanFinanceCashSql,cleanFinanceCashSchemaSql,buildCleanFinanceFxDefinitions,buildCleanFinanceFxSql} from './clean-finance-rehearsal-sql.mjs';
import {buildCleanFinanceFxCaseFieldRepairSql} from './clean-finance-rehearsal-sql.mjs';
import {buildCleanFinanceAdministratorDefinitions,buildCleanFinanceAdministratorSql,buildCleanFinanceFxCaseFieldRepairDefinitions} from './clean-finance-rehearsal-sql.mjs';

test('authorized Semih financial reversal extends only his existing role and seals exact installed predecessors',()=>{
 const prior={...buildCleanFinanceRehearsalDefinitions().definitions,...buildCleanFinanceCashDefinitions().definitions,...buildCleanFinanceFxDefinitions().definitions,...buildCleanFinanceFxCaseFieldRepairDefinitions().after},hashes=Object.fromEntries(Object.entries(prior).map(([n,b])=>[n,moduleHash(b)]));
 const {definitions,before,total}=buildCleanFinanceAdministratorDefinitions();assert.equal(total,9);assert.equal(Object.keys(before).length,7);for(const[n,b]of Object.entries(before))assert.equal(b,prior[n]);
 for(const name of ['usp_clean_finance_b4_bind','usp_clean_finance_b4_fx_usd_bind','usp_clean_finance_b4_fx_eur_bind']){const b=definitions[name];assert.ok(b.includes("@operation IN(N'collection_cancel',N'payment_cancel') AND ((u.id=23"));assert.ok(b.includes("OR(u.id=10018 AND u.username=N'semih' AND r.id=28 AND r.code=N'clean_test_administrator')"));assert.match(b,/p.permission_key=@permission AND p.can_create=1/);assert.match(b,/CLEAN_STORE_DAY_20261022/);assert.match(b,/CLEAN_FINANCE_REHEARSAL_DENIED/);}
 assert.deepEqual(Object.fromEntries(Object.entries({...buildCleanFinanceRehearsalDefinitions().definitions,...buildCleanFinanceCashDefinitions().definitions,...buildCleanFinanceFxDefinitions().definitions,...buildCleanFinanceFxCaseFieldRepairDefinitions().after}).map(([n,b])=>[n,moduleHash(b)])),hashes);
 const sql=buildCleanFinanceAdministratorSql({probe:true});assert.match(sql,/B5_ADMIN_PROBE_ROLLED_BACK/);assert.match(sql,/B5_ADMIN_ALREADY_INSTALLED/);assert.match(sql,/WITH CHECK ADD CONSTRAINT CK_clean_inventory_requests/);assert.match(sql,/actor_id=10018 AND operation IN\(N''collection_cancel'',N''payment_cancel''\)/);assert.match(sql,/before_permissions_json/);assert.match(sql,/before_constraints_json/);assert.match(sql,/@preserve<>HASHBYTES/);assert.match(sql,/VALUES\(28,N'finance.collection.cancel',1,1,0,0,1\)/);assert.match(sql,/VALUES\(28,N'finance.payment.cancel',1,1,0,0,1\)/);assert.match(sql,/DENY INSERT,UPDATE,DELETE ON dbo.clean_finance_b5_admin_manifest/);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|DROP TRIGGER|UPDATE dbo\.(?:users|roles|permissions|products|customers|suppliers|finance_accounts)|DELETE dbo\.|INSERT dbo\.(?:work_trade_requests|finance_account_movements|customer_movements|supplier_movements)\(/);
});

test('FX case identity is allowed only alongside its exact required value; installed correction preserves all old seals',()=>{
 for(const [currency]of [['USD'],['EUR']]){const bind=buildCleanFinanceFxDefinitions().definitions['usp_clean_finance_b4_fx_'+currency.toLowerCase()+'_bind'];assert.match(bind,/NOT IN\(N'financeCaseId',N'actorId'/);assert.ok(bind.includes("'$.financeCaseId'),N'')<>N'B4-"+currency+"-20261023'"));}
 const sql=buildCleanFinanceFxCaseFieldRepairSql({probe:true});assert.match(sql,/B4_FX_CASEFIELD_PROBE_ROLLED_BACK/);assert.match(sql,/before_quoted_identifier/);assert.match(sql,/@fixtures<>HASHBYTES/);assert.match(sql,/@seals<>HASHBYTES/);assert.match(sql,/ExecIsTriggerDisabled/);assert.match(sql,/B4_FX_CASEFIELD_ALREADY_INSTALLED/);assert.doesNotMatch(sql,/DISABLE TRIGGER|DROP TRIGGER|UPDATE dbo\.clean_finance_b4_fx_manifest|DELETE dbo\.|INSERT dbo\.(?:customers|suppliers|finance_account_movements|work_trade_requests)\b/);
});

test('B4 FX adds two finite currency cases while preserving the installed TRY and cash definition history',()=>{
 const prior={...buildCleanFinanceRehearsalDefinitions().definitions,...buildCleanFinanceCashDefinitions().definitions},hashes=Object.fromEntries(Object.entries(prior).map(([n,b])=>[n,moduleHash(b)]));
 const fx=buildCleanFinanceFxDefinitions();assert.equal(fx.total,22);assert.equal(Object.keys(fx.before).length,10);
 for(const [name,body]of Object.entries(fx.before))assert.equal(body,prior[name]);
 assert.deepEqual(Object.fromEntries(Object.entries({...buildCleanFinanceRehearsalDefinitions().definitions,...buildCleanFinanceCashDefinitions().definitions}).map(([n,b])=>[n,moduleHash(b)])),hashes);
 for(const [currency,party,purchase,rate]of [['USD',3,6,40],['EUR',4,7,45]]){
  const prefix='usp_clean_finance_b4_fx_'+currency.toLowerCase(),bind=fx.definitions[prefix+'_bind'],guard=fx.definitions[prefix+'_guard'],finish=fx.definitions[prefix+'_finish'];
  assert.match(bind,new RegExp('B4-'+currency+'-20261023'));assert.ok(bind.includes("N'"+currency+"'"));assert.ok(bind.includes('WHERE id='+party));assert.ok(bind.includes('m.purchase_invoice_id='+purchase));
  assert.match(bind,/CLEAN_STORE_DAY_20261022/);assert.match(bind,/CURRENT_TRANSACTION_ID/);assert.match(bind,/clean_finance_b4_cash_intents/);assert.match(bind,/clean_finance_b4_intents/);
  assert.ok(guard.includes("N'_id')),-1)<>"+party));assert.ok(guard.includes('THEN '+party+' ELSE '+purchase+' END'));assert.ok(guard.includes('CONVERT(decimal(18,4),@amount*'+rate+')'));
  assert.ok(finish.includes('m.document_exchange_rate_snapshot='+rate));assert.ok(finish.includes('m.amount_try=CONVERT(decimal(18,4),@amount*'+rate+')'));
  assert.doesNotMatch(bind+guard+finish,/\b(?:customer_id|supplier_id|sales_invoice_id|account_id|invoice_id)=2\b|\bpurchase_invoice_id=5\b/);
 }
});

test('B4 FX setup is owner-only, replay-safe, preserves old money and stock, and cannot create cash accounts',()=>{
 const sql=buildCleanFinanceFxSql({probe:true}),{definitions}=buildCleanFinanceFxDefinitions();
 assert.match(sql,/^SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;/);
 assert.match(sql,/IS_SRVROLEMEMBER\(N'sysadmin',ORIGINAL_LOGIN\(\)\)/);assert.match(sql,/B4_FX_ALREADY_INSTALLED/);assert.match(sql,/after_hash=/);assert.match(sql,/B4_FX_FIXTURE_PROBE_ROLLED_BACK/);assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK/);assert.match(sql,/@preserve<>HASHBYTES/);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|DROP TRIGGER|UPDATE dbo\.clean_finance_b4_manifest|UPDATE dbo\.clean_finance_b4_cash_manifest|DELETE dbo\.work_trade_requests|INSERT dbo\.finance_accounts|UPDATE dbo\.finance_accounts SET|UPDATE dbo\.products SET/);
 assert.match(sql,/session_status=N'open'/);assert.match(sql,/DENY INSERT,UPDATE,DELETE ON dbo\.clean_finance_b4_fx_intents/);assert.match(sql,/synthetic_rate decimal\(18,8\)/);
 for(const currency of ['usd','eur'])assert.match(definitions['usp_clean_finance_b4_fx_'+currency+'_guard'],/IF @op=N'fixture_prepare' BEGIN IF @table_name=N'finance_accounts' THROW/);
});

test('B4 cash companion preserves exact old finance bodies and retains native schema, constraints and narrow target',()=>{
 const original=buildCleanFinanceRehearsalDefinitions().definitions,hashes=Object.fromEntries(Object.entries(original).map(([n,b])=>[n,moduleHash(b)])),cash=buildCleanFinanceCashDefinitions();
 assert.deepEqual(Object.keys(cash.before).sort(),['clean_sale_audit_logs_guard','usp_clean_finance_b4_ready','usp_clean_store_day_ready','usp_clean_store_finance_guard']);
 for(const [name,body] of Object.entries(cash.before))assert.equal(body,original[name]);
 assert.deepEqual(Object.fromEntries(Object.entries(buildCleanFinanceRehearsalDefinitions().definitions).map(([n,b])=>[n,moduleHash(b)])),hashes);
 const schema=cleanFinanceCashSchemaSql();assert.equal((schema.match(/CREATE TABLE dbo\./g)||[]).length,8);assert.match(schema,/DECIMAL\(18,4\)/);assert.match(schema,/FOREIGN KEY/);assert.doesNotMatch(schema,/INSERT INTO|UPDATE |DELETE |ALTER |DROP /);
 const probe=buildCleanFinanceCashSql({probe:true});assert.match(probe,/B4_CASH_FIXTURE_PROBE_ROLLED_BACK/);assert.match(probe,/protected_hash/);assert.match(probe,/schema_hash/);assert.match(probe,/CLEAN_STORE_DAY_20261022/);assert.match(probe,/CURRENT_TRANSACTION_ID\(\)/);assert.match(probe,/CK_clean_inventory_requests CHECK\(\('/);assert.match(probe,/DENY INSERT ON dbo\.cash_drawers/);
 assert.doesNotMatch(probe,/DISABLE TRIGGER|ENABLE TRIGGER|EXECUTE AS LOGIN|TRUNCATE TABLE|RESTORE DATABASE|UPDATE dbo\.clean_finance_b4_manifest/);
 for(const [name,body] of Object.entries(cash.definitions)){assert(!body.includes('/*CASH_COUNT*/'));assert.match(body,name.startsWith('clean_b4_')?/EXEC dbo\.usp_clean_finance_b4_cash_guard N'/:/THROW 51\d{3}/);}
});

const auditGuard='clean_sale_audit_logs_guard';
function assertCurrentFinanceAuditPredecessor(selected){
 const cohort=buildCleanStoreDayDefinitions();
 const guard=cohort.guards.find(g=>g.name===auditGuard);
 assert.equal(moduleHash(selected[auditGuard]),guard.afterHash,'B4 must expect the installed inbound audit guard, not the original sale-only guard');
 const original=buildCleanOrderSaleProcedures()[auditGuard];
 assert.notEqual(moduleHash(selected[auditGuard]),moduleHash(original));
 assert.ok(selected[auditGuard].endsWith(original.slice(original.indexOf('AS BEGIN')+8)),'The complete original SALE guard must remain');
 assert.match(selected[auditGuard],/EXEC dbo\.usp_clean_store_day_guard/);
}

async function financePredecessorMutation(from,to){
 const url=new URL('./clean-finance-rehearsal-sql.mjs',import.meta.url);
 const source=readFileSync(url,'utf8');
 assert.equal(source.split(from).length-1,1,'The mutation must affect exactly the intended source boundary');
 const mutant=source.replace(from,to).replace(/(from\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,(_,prefix,quote,path)=>prefix+quote+new URL(path,url).href+quote);
 return import('data:text/javascript;base64,'+Buffer.from(mutant).toString('base64'));
}

test('B4 predecessor regression: current inbound audit guard retains the complete SALE protection',()=>{
 const selected=buildCleanFinanceRehearsalPredecessors();
 assertCurrentFinanceAuditPredecessor(selected);
 for(const guard of buildCleanStoreDayDefinitions().guards)assert.equal(moduleHash(selected[guard.name]),guard.afterHash);
 const finance=buildCleanStoreDayFinanceDefinitions(),inventory=buildCleanStoreDayInventoryDefinitions(),admin=buildCleanStoreAdministratorDefinitions();
 assert.equal(selected.clean_sale_customers_guard,finance.definitions.clean_sale_customers_guard);
 assert.equal(selected.usp_clean_store_finance_guard,admin.definitions.usp_clean_store_finance_guard);
 assert.equal(selected.clean_finance_work_trade_requests_guard,inventory.definitions.clean_finance_work_trade_requests_guard);
 assert.equal(selected.usp_clean_store_day_ready,admin.definitions.usp_clean_store_day_ready);
});

test('B4 predecessor regression rejects the old definitions-only selection using the same contract',async()=>{
 const legacy=await financePredecessorMutation('...day.definitions,...guards,','...day.definitions,');
 assert.throws(()=>assertCurrentFinanceAuditPredecessor(legacy.buildCleanFinanceRehearsalPredecessors()),{code:'ERR_ASSERTION'},'The regression must fail when the original omission is restored');
 assertCurrentFinanceAuditPredecessor(buildCleanFinanceRehearsalPredecessors());
});

test('B4 predecessor regression rejects exact-body drift and retains native hash denial',async()=>{
 const drifted=await financePredecessorMutation("const body=g.definition.replace(/^ALTER TRIGGER/,'CREATE TRIGGER');","const body=g.definition.replace(/^ALTER TRIGGER/,'CREATE TRIGGER')+' ';");
 assert.throws(()=>drifted.buildCleanFinanceRehearsalPredecessors(),/B4 inbound guard predecessor changed/);
 const hash='$2b$12$'+'.'.repeat(53),sql=buildCleanStoreDayCohortSql(hash,hash);
 for(const g of buildCleanStoreDayDefinitions().guards){
  assert.ok(sql.includes(`IF CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${g.name}'))),2)<>N'${g.beforeHash}' THROW 51960,'CLEAN_INBOUND_BEFORE_HASH',1;`));
  assert.ok(sql.includes(g.afterHash));
 }
 assert.doesNotMatch(sql,/DISABLE TRIGGER|DROP TRIGGER|UPDATE dbo\.clean_order_sale_definitions/);
});

test('Semih normal admin cohort preserves predecessor hashes, original actors and finite business boundaries',()=>{
 const {definitions:d,before,total}=buildCleanStoreAdministratorDefinitions(),sql=buildCleanStoreAdministratorSql();
 assert.equal(total,11);assert.equal(Object.keys(before).length,10);
 for(const name of Object.keys(before)){assert.notEqual(moduleHash(d[name]),moduleHash(before[name]));assert.ok(sql.includes(moduleHash(before[name])));}
 assert.match(d.usp_clean_store_day_bind,/au\.id=10018.*ar\.id=28.*clean_test_administrator/);
 assert.match(d.usp_clean_store_day_bind,/created_by=@actor_id OR @admin=1 AND created_by IN\(18,10018\)/);
 assert.match(d.usp_clean_store_finance_bind,/@request_id,@actor_id,@operation/);
 assert.doesNotMatch(d.usp_clean_store_finance_bind,/@request_id,20,@operation/);
 assert.match(d.usp_clean_store_inventory_bind,/actor_id=\(SELECT created_by FROM dbo.test_daily_drafts WHERE id=@id\)/);
 assert.match(d.usp_clean_store_inventory_guard,/original_approved_by.*SELECT decided_by FROM dbo.test_daily_drafts/);
 assert.match(sql,/UPDATE dbo.users SET role_id=28 WHERE id=10018 AND username=N'semih' AND role_id=2/);
 assert.ok(CLEAN_ADMIN_PERMISSIONS.includes('goods.approve'));assert.ok(CLEAN_ADMIN_PERMISSIONS.includes('stock.adjust'));
 assert.match(sql,/WITH CHECK ADD CONSTRAINT CK_clean_inventory_requests/);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|UPDATE dbo\.permissions|UPDATE dbo\.clean_store_inventory_manifest|UPDATE dbo\.products|UPDATE dbo\.suppliers SET balance|password_hash\s*=/);
 assert.match(d.usp_clean_store_inventory_bind,/@stock\+@qty<0/);assert.match(d.usp_clean_store_finance_bind,/@amount>@account/);
 assert.match(d.usp_clean_store_day_ready,/a\.before_hash=|SELECT a.before_hash/);assert.match(d.usp_clean_store_day_ready,/clean_inventory_cost_manifest/);
});
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

test('inventory continuation versions only exact installed verifiers and seals constraints without rewriting old manifests',async()=>{
 const {buildCleanStoreDayInventoryDefinitions,buildCleanStoreDayInventorySql,buildCleanStoreDayFinanceDefinitions}=await import('./clean-store-day-cohort-sql.mjs');
 const old=buildCleanStoreDayFinanceDefinitions().definitions,r=buildCleanStoreDayInventoryDefinitions();assert.equal(r.total,12);assert.equal(r.operations.length,8);
 assert.deepEqual(Object.keys(r.before).sort(),['clean_finance_work_trade_requests_guard','usp_clean_store_day_guard','usp_clean_store_day_ready']);for(const [name,body]of Object.entries(r.before))assert.equal(body,old[name]);
 assert.match(r.definitions.usp_clean_store_day_ready,/before_hash/);assert.match(r.definitions.usp_clean_store_day_ready,/after_constraints_hash/);assert.match(r.definitions.usp_clean_store_inventory_bind,/ORIGINAL_LOGIN/);assert.match(r.definitions.usp_clean_store_inventory_bind,/CURRENT_TRANSACTION_ID/);assert.match(r.definitions.usp_clean_store_inventory_bind,/role_id=@role/);
 const ddl=buildCleanStoreDayInventorySql('$2b$12$'+'A'.repeat(53),'$2b$12$'+'B'.repeat(53));assert.doesNotMatch(ddl,/DISABLE TRIGGER|UPDATE dbo\.clean_store_finance_manifest|DELETE dbo\.work_trade_requests|UPDATE dbo\.products SET|UPDATE dbo\.suppliers SET/);assert.match(ddl,/WITH CHECK ADD CONSTRAINT CK_clean_inventory_requests/);assert.match(ddl,/before_constraints_json/);assert.throws(()=>buildCleanStoreDayInventorySql('plain','plain'));
});

test('explicit synthetic cost setup is owner-only, exact one-shot valuation with a bounded inverse and unchanged historic ledgers',async()=>{
 const {buildCleanInventoryCostFixtureDefinitions,buildCleanInventoryCostFixtureSql}=await import('./clean-store-day-cohort-sql.mjs');const r=buildCleanInventoryCostFixtureDefinitions();assert.equal(r.total,4);assert.deepEqual(Object.keys(r.before).sort(),['usp_clean_store_day_guard','usp_clean_store_day_ready']);
 const p=r.definitions.usp_clean_inventory_cost_fixture_prepare,g=r.definitions.usp_clean_store_day_guard;
 assert.match(p,/IS_SRVROLEMEMBER\(N'sysadmin',ORIGINAL_LOGIN\(\)\)/);assert.match(p,/current_stock_qty=23 AND average_cost_try=@before/);assert.match(p,/SYNTHETIC_SCENARIO_COST_INPUT/);assert.match(p,/IF @old IS NOT NULL/);assert.match(p,/@undo=1/);assert.match(p,/EXISTS\(SELECT 1 FROM dbo.test_daily_drafts\)/);assert.match(g,/CURRENT_TRANSACTION_ID/);assert.match(g,/NOT IN\(N'average_cost_try',N'updated_at',N'row_version'\)/);
 const ddl=buildCleanInventoryCostFixtureSql();assert.doesNotMatch(ddl,/DISABLE TRIGGER|GRANT EXECUTE|UPDATE dbo\.clean_store_inventory_manifest|DELETE dbo\.stock_movements|UPDATE dbo\.sales_invoice/);assert.match(ddl,/before_definition/);assert.match(ddl,/clean_inventory_cost_manifest_immutable/);
});
