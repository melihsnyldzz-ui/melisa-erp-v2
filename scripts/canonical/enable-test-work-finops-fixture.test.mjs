import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSql,readyDefinition,contextDefinition,effectsDefinition,WORK_SUPPLIER_PAYMENT_SQL_PROOF,GUARDS,PERMISSIONS,TABLE_SQL,SCHEMA_SQL,SEED_SQL,OLD_GUARDS,PROTECTED_TABLES,hash,storedDefinition} from './enable-test-work-finops-fixture.mjs';
import {findInlineCrossColumnChecks} from './enable-test-purchase-batches.mjs';
import {WORK_SUPPLIER_PAYMENT_SQL_PROOF as currentProof} from '../../apps/api/src/services/workSupplierPaymentSqlProof.mjs';
const generated=WORK_SUPPLIER_PAYMENT_SQL_PROOF; // Immutable original installation proof; count upgrade has its own independent check.
test('generated SQL and independent owner proof exactly equal reviewed definitions',()=>{
 assert.equal(fs.readFileSync(new URL('./enable-test-work-finops-fixture.sql',import.meta.url),'utf8').replaceAll('\r\n','\n'),buildSql());
 assert.deepEqual(generated,WORK_SUPPLIER_PAYMENT_SQL_PROOF);
 assert.equal(generated.readyHash,hash(readyDefinition()));assert.equal(generated.contextHash,hash(contextDefinition()));assert.equal(generated.effectsHash,hash(effectsDefinition()));
});
test('every packaged CRLF dynamic DDL literal normalizes to the exact independently pinned stored definition',()=>{
 const packed=buildSql().replaceAll('\n','\r\n');
 const matches=[...packed.matchAll(/SET @definition=REPLACE\(REPLACE\(CAST\(N'((?:''|[^'])*)' AS nvarchar\(max\)\),CHAR\(13\)\+CHAR\(10\),CHAR\(10\)\),CHAR\(13\),CHAR\(10\)\); EXEC\(@definition\);/g)];
 const expected={...GUARDS,usp_work_supplier_payment_ready:readyDefinition(),usp_work_supplier_payment_context:contextDefinition(),usp_work_supplier_payment_effects:effectsDefinition()};
 assert.equal(matches.length,Object.keys(expected).length);
 for(const match of matches){
  const body=match[1].replaceAll("''","'");assert.ok(body.includes('\r\n'));
  const stored=storedDefinition(body),name=stored.match(/^CREATE (?:PROCEDURE|TRIGGER) dbo\.(\w+)/)?.[1];
  assert.equal(stored,expected[name]);assert.equal(hash(stored),hash(expected[name]));
 }
 assert.doesNotMatch(packed,/\bEXEC\(N'/);
});
test('outer TEST/sysadmin transaction required; generator contains no apply, commit, guard rewrite or repair',()=>{
 const s=buildSql();assert.ok(s.indexOf('@@TRANCOUNT=0')<s.indexOf('CREATE TABLE dbo.work_finops_scope'));
 assert.match(s,/Semih\\MELISADEV/);assert.match(s,/WORK_PAYMENT_OPERATOR_REQUIRED/);
 assert.doesNotMatch(s,/\b(?:COMMIT|DISABLE\s+TRIGGER|ALTER\s+TRIGGER|DROP\s+TABLE|IDENTITY_INSERT)\b(?!\.)/i);
 assert.ok(s.indexOf("WORK_PAYMENT_PARTIAL_INSTALL")<s.indexOf('CREATE TABLE dbo.work_finops_scope'));
 const noop=s.slice(s.indexOf("IF OBJECT_ID(N'dbo.work_finops_scope'"),s.indexOf('WORK_PAYMENT_PARTIAL_INSTALL'));
 assert.ok(noop.indexOf(generated.readyHash)<noop.indexOf('EXEC dbo.usp_work_supplier_payment_ready'));
 assert.match(noop,/CAST\(0 AS bit\) installed; RETURN/);
});
test('identity reservation is serialized and locked before scope/native inserts; no fixed future IDs',()=>{
 for(const n of ['suppliers','finance_accounts','products']){
  assert.match(SEED_SQL,new RegExp(`FROM dbo\\.${n} WITH\\(TABLOCKX,HOLDLOCK\\)`));
  assert.match(SEED_SQL,new RegExp(`IDENT_CURRENT\\(N'dbo\\.${n}'\\)`));
 }
 assert.ok(SEED_SQL.indexOf('sp_getapplock')<SEED_SQL.indexOf('INSERT dbo.test_payment_suppliers'));
 assert.ok(SEED_SQL.indexOf('INSERT dbo.test_daily_scope')<SEED_SQL.indexOf('INSERT dbo.products'));
 assert.match(SEED_SQL,/IF @actual<>@supplier/);assert.match(SEED_SQL,/IF @actual<>@product/);assert.match(SEED_SQL,/IF @actual<>@account/);
 assert.doesNotMatch(SEED_SQL,/MAX\(id\)|DBCC|SET IDENTITY_INSERT/);
});
test('physical receipt stock exactly once; native finalized invoice creates separate positive debt',()=>{
 assert.ok(SEED_SQL.indexOf('INSERT dbo.work_finops_receipts')<SEED_SQL.indexOf('UPDATE dbo.products SET current_stock_qty=5'));
 assert.equal((SEED_SQL.match(/INSERT dbo.stock_movements/g)||[]).length,1);
 assert.match(SEED_SQL,/goods_receipt_already_posted/);assert.match(SEED_SQL,/status=N'finalized'/);
 assert.match(SEED_SQL,/N'purchase_invoice',300,N'TRY',300/);assert.match(SEED_SQL,/UPDATE dbo.suppliers SET balance=300/);
 assert.doesNotMatch(SEED_SQL,/INSERT dbo.test_goods_receipts|UPDATE dbo.suppliers[^;]*13370|UPDATE dbo.products[^;]*30198[456]/);
 assert.match(GUARDS.work_finops_native_invoice_guard,/inserted/);assert.match(GUARDS.work_finops_native_invoice_guard,/deleted/);
 assert.match(GUARDS.work_finops_native_product_guard,/inserted/);assert.match(GUARDS.work_finops_native_stock_guard,/deleted/);
});
test('full old native rows, scope bytes, role permissions and old object grants conserved',()=>{
 assert.equal(PROTECTED_TABLES.length,13);
 for(const n of PROTECTED_TABLES)assert.ok(SEED_SQL.includes(`VALUES(N'${n}',`));
 assert.match(SEED_SQL,/WORK_PAYMENT_PROTECTED_ROW_CHANGED/);assert.match(SEED_SQL,/WORK_PAYMENT_OLD_SCOPE_CHANGED/);
 assert.match(SEED_SQL,/WORK_PAYMENT_ROLE_CHANGED/);assert.match(buildSql(),/WORK_PAYMENT_OTHER_PERMISSION_CHANGED/);
 for(const h of Object.values(OLD_GUARDS))assert.ok(readyDefinition().includes(h));
 assert.match(readyDefinition(),/work_trade_assert_ready/);assert.match(readyDefinition(),/OBJECT_DEFINITION[^\n]+IS NULL/);
});
test('all own schemas constraints indexes and foreign keys sealed, and all native/history guard bodies pinned independently',()=>{
 assert.deepEqual(findInlineCrossColumnChecks(TABLE_SQL),[]);
 for(const n of ['sys.columns','sys.check_constraints','sys.indexes','sys.index_columns','sys.foreign_keys','sys.foreign_key_columns'])assert.ok(SCHEMA_SQL.includes(n));
 for(const d of Object.values(GUARDS))assert.ok(readyDefinition().includes(hash(d)));
 assert.ok(readyDefinition().includes(hash(contextDefinition())));assert.ok(readyDefinition().includes(hash(effectsDefinition())));
 assert.match(readyDefinition(),/ExecIsTriggerDisabled/);
});
test('only named writer journal SELECT/INSERT and three new owner EXEC+VIEW DEFINITION granted',()=>{
 assert.equal(PERMISSIONS.filter(p=>p[2]==='G').length,8);
 assert.deepEqual(PERMISSIONS.filter(p=>p[2]==='G'&&!p[0].startsWith('usp_')).map(p=>p[1]),['SELECT','INSERT']);
 assert.equal(PERMISSIONS.filter(p=>p[1]==='VIEW DEFINITION').length,3);
 assert.match(readyDefinition(),/minor_id<>0/);assert.match(readyDefinition(),/COLLATE Latin1_General_100_BIN2/);
 assert.doesNotMatch(buildSql(),/GRANT[^;]+ON dbo\.(?:products|suppliers|finance_accounts|purchase_invoices|stock_movements|test_daily_scope)/);
});
test('immutable full payload actor/UUID/response native identity; one cancellation; payment cap does not consume cancellations',()=>{
 const g=GUARDS.work_payment_requests_guard,e=effectsDefinition();
 for(const p of ['$.actorId','$.operation','$.requestId','$.payment.id'])assert.ok(g.includes(p));
 assert.match(g,/HASHBYTES\('SHA2_256',i.payload_json\)/);assert.match(g,/IF EXISTS\(SELECT 1 FROM deleted\)/);
 assert.match(TABLE_SQL,/UNIQUE INDEX work_payment_one_cancel[^;]+WHERE original_id IS NOT NULL/);
 assert.match(e,/COUNT\(\*\)[^\n]+WHERE operation=N'payment'\)>30/);
 assert.doesNotMatch(e,/COUNT\(\*\) FROM dbo.work_supplier_payment_requests\)>30/);
 assert.match(e,/SELECT m.supplier_id,m.purchase_invoice_id,m.amount,m.currency_code,m.account_currency,m.account_amount,m.amount_try,m.document_exchange_rate_snapshot,m.account_exchange_rate_snapshot EXCEPT SELECT o/);
});
test('USD/EUR are honest opening balances, TRY linked receipt/invoice; unknowns never fabricated or native unsupported columns used',()=>{
 assert.match(SEED_SQL,/N'USD',13371,33,NULL,NULL,NULL/);assert.match(SEED_SQL,/N'EUR',13372,34,NULL,NULL,NULL/);
 assert.match(SEED_SQL,/bankIntegrationVerified\":false/);assert.match(contextDefinition(),/s.debt_kind debtKind/);
 assert.ok(contextDefinition().includes("COALESCE(f.description,N'')"));assert.ok(contextDefinition().includes("N'[]')) payments"));
 assert.equal(contextDefinition().split('r.is_active=1').length-1,3);assert.ok(GUARDS.work_payment_requests_guard.includes('r.is_active=1'));assert.doesNotMatch(SEED_SQL,/after_snapshot_json/);
 assert.match(effectsDefinition(),/m.account_amount IS NULL/);assert.match(effectsDefinition(),/m.document_exchange_rate_snapshot IS NULL/);
});
test('payment actor, context, permissions and immutable journal all reject an inactive role',()=>{
 const context=contextDefinition();assert.ok(context.includes('u.is_active=1 AND r.is_active=1 AND r.code'));
 assert.ok(context.includes('JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=@actor_id AND r.is_active=1 AND p.permission_key'));
 assert.ok(context.includes('JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=@actor_id AND r.is_active=1 AND p.can_view=1'));
 assert.ok(GUARDS.work_payment_requests_guard.includes('u.is_active=1 AND r.is_active=1 AND r.code'));
});test('receipt namespace reservation cannot join old C01 evidence; legacy history is visible and never cancelable here',()=>{
 const s=buildSql(),c=contextDefinition();
 assert.match(s,/MAX\(id\)[^\n]+test_goods_receipts[^\n]+test_daily_drafts[^\n]+source_id[^\n]+goods_receipt/);
 assert.match(s,/IDENTITY\(__FINOPS_RECEIPT_SEED__,1\)/);assert.match(s,/N'__FINOPS_RECEIPT_SEED__',CONVERT\(varchar\(20\),@receiptSeed\)/);
 assert.match(c,/N'work-finops-physical-receipt' receiptKind/);assert.match(c,/N'legacy' ownership FROM dbo.test_payment_requests/);
 assert.match(c,/j.ownership=N'work' AND m.movement_type=N'payment' AND cancel.movement_id IS NULL/);
 assert.match(readyDefinition(),/s.currency=N'TRY' OR NOT EXISTS\(SELECT 1 FROM dbo.test_payment_requests old/);
 assert.match(GUARDS.work_payment_requests_guard,/EXEC dbo.usp_work_supplier_payment_effects @request_id=@insertedRequest/);
});

test('count guard upgrade pins the exact prior audit body and independently derives the new finance ready proof',()=>{
 const source=fs.readFileSync(new URL('./enable-test-daily-count-lines.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const before=fs.readFileSync(new URL('./daily-count-before-audit.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
 assert.equal(hash(before),OLD_GUARDS.test_guard_audit_logs);
 const match=source.match(/\(N'test_guard_audit_logs',CAST\(N'((?:''|[^'])*)' AS nvarchar\(max\)\)\)/);
 assert.ok(match,'Exact reviewed audit prefix must be recoverable without a running database');
 const prefix=match[1].replaceAll("''","'");
 const position=before.indexOf('AS BEGIN')+8;assert.ok(position>8);
 const audit=(before.slice(0,position)+'\n'+prefix+'\n'+before.slice(position));
 const ready=readyDefinition().replace(OLD_GUARDS.test_guard_audit_logs,hash(audit));
 assert.equal(currentProof.readyHash,hash(ready));
 assert.equal(currentProof.contextHash,generated.contextHash);assert.equal(currentProof.effectsHash,generated.effectsHash);
 for(const key of ['melisa_test_count_draft_id','melisa_test_count_actor_id','melisa_test_count_transaction_id'])assert.ok(prefix.includes(key));
 assert.ok(prefix.includes('CURRENT_TRANSACTION_ID()'));assert.ok(prefix.includes('DAILY_COUNT_EXACT_AUDIT_REQUIRED'));
 assert.match(source,/SET @definition=STUFF\(@definition,1,6,N'ALTER'\);EXEC sys\.sp_executesql @definition/);
 assert.match(source,/UPDATE @prefixes SET body=REPLACE\(body,CHAR\(13\)\+CHAR\(10\),CHAR\(10\)\)/);
 const packed=source.replaceAll('\n','\r\n').match(/\(N'test_guard_audit_logs',CAST\(N'((?:''|[^'])*)' AS nvarchar\(max\)\)\)/)[1].replaceAll("''","'").replaceAll('\r\n','\n');
 assert.equal(packed,prefix);
});
