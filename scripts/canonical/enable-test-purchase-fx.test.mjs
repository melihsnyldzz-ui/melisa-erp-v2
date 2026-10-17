import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildObjects,buildSql} from './enable-test-purchase-fx.mjs';
import {findInlineCrossColumnChecks} from './enable-test-purchase-batches.mjs';

const sql=buildSql();
const objects=buildObjects();
const object=name=>objects.find(x=>x.startsWith(`CREATE TRIGGER dbo.${name} `)||x.startsWith(`CREATE PROCEDURE dbo.${name} `));
function balanced(text){
  let depth=0;
  for(const c of text.replace(/N?'(?:''|[^'])*'/g,'')){
    if(c==='(')depth++;
    if(c===')'&&--depth<0)return false;
  }
  return depth===0;
}

test('generated artifact is exact and all SQL bodies are structurally balanced',()=>{
  assert.equal(fs.readFileSync(new URL('./enable-test-purchase-fx.sql',import.meta.url),'utf8'),sql);
  assert.equal(objects.length,16);
  for(const body of objects)assert.ok(balanced(body),body.slice(0,100));
  assert.equal(balanced("SELECT (N')''(');"),true);
  assert.equal(balanced('SELECT ((1);'),false);
  assert.equal(balanced('SELECT 1);'),false);
  assert.deepEqual(findInlineCrossColumnChecks(sql),[]);
  assert.ok(findInlineCrossColumnChecks('CREATE TABLE dbo.t(a int, b int CHECK(b=a));').length);
});
test('exact target, atomic lock, portable index options and original guards preserved',()=>{
  assert.match(sql,/MELISA_ERP_SIRKET_TEST_20260929_01/);
  assert.match(sql,/COALESCE\(IS_SRVROLEMEMBER\(N'sysadmin'\),0\)<>1/);
  assert.match(sql,/@Resource=N'MELISA-TEST-V70-SALES'/);
  assert.match(sql,/SET QUOTED_IDENTIFIER ON/);
  assert.match(sql,/SET NUMERIC_ROUNDABORT OFF/);
  assert.match(sql,/BEGIN TRY BEGIN TRANSACTION/);
  assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK; THROW/);
  assert.doesNotMatch(sql,/ALTER TRIGGER|DISABLE TRIGGER|SESSION_CONTEXT|UPDATE dbo\.product_prices|UPDATE erp_migration\./i);
  assert.match(sql,/COUNT\(\*\) FROM dbo\.test_purchase_batch_guard_manifest\)<>15/);
  assert.match(sql,/<>37 THROW/);
});
test('every runtime object requires own manifest hashes and enabled guards',()=>{
  for(const body of objects){
    assert.match(body,/COUNT\(\*\) FROM dbo\.test_purchase_fx_guard_manifest\)<>17/);
    assert.match(body,/OBJECT_DEFINITION\(o.object_id\) IS NULL/);
    assert.match(body,/COALESCE\(OBJECTPROPERTY\(o.object_id,'ExecIsTriggerDisabled'\),1\)<>0/);
    assert.match(body,/C03_RATE_DRIFT/);
    assert.match(body,/C03_COPY_SOURCE_DRIFT/);
  }
  const preflight=sql.slice(0,sql.indexOf("IF OBJECT_ID(N'dbo.test_purchase_fx_guard_manifest',N'U') IS NOT NULL"));
  assert.doesNotMatch(preflight,/FROM dbo\.test_purchase_fx_guard_manifest/);
  assert.match(sql,/PASS_IDENTICAL_NOOP.*0 writes/);
});
test('source copies retain exact8 CARD price, hashed ADET factor1 evidence and separate native4',()=>{
  const proof=object('usp_get_test_purchase_fx_unit_evidence');
  assert.match(proof,/n.price=v.price_exact/);
  assert.match(proof,/CAST\(v.price_exact AS decimal\(18,4\)\)/);
  assert.match(proof,/v.source_unit_id IS NULL/);
  assert.match(proof,/VERIFIED_ADET_FACTOR_1/);
  assert.match(proof,/r.payload_hash=b.stage_payload_hash/);
  assert.match(proof,/HASHBYTES\('SHA2_256',r.payload_json\)/);
  assert.match(proof,/v.native_row_hash/);
  assert.doesNotMatch(proof,/v.is_main_unit=1/);
  assert.match(sql,/WHERE m.run_id=N'VEGA-OPENING-TEST-20261004-06' AND m.sealed=1 AND v.currency_code=N'USD'/);
  assert.match(sql,/price_exact decimal\(28,8\)/);
});
test('synthetic FX is frozen by exact date, values and hashes, without current-market inference',()=>{
  assert.match(sql,/C03-FX-20261004/);
  assert.match(sql,/CAST\(40 AS decimal\(18,8\)\)/);
  assert.match(sql,/CAST\(45 AS decimal\(18,8\)\)/);
  assert.match(object('usp_get_test_purchase_fx_context'),/r.source<>N'synthetic-test'/);
  assert.match(sql,/account_rate decimal\(18,8\) NOT NULL CHECK\(account_rate=1\)/);
  assert.match(sql,/document_rate_id int NOT NULL REFERENCES dbo.test_purchase_fx_rates/);
});
test('receipt acceptance has exact before/after weighted cost, stock cap and one ledger row',()=>{
  const intents=object('c03_guard_intents');
  assert.match(intents,/i.stock_before IS NOT NULL AND i.cost_before IS NOT NULL/);
  assert.match(intents,/i.stock_after<=40/);
  assert.match(intents,/i.cost_after=ROUND\(\(i.stock_before\*i.cost_before\+i.amount_try\)\/i.stock_after,4\)/);
  assert.match(intents,/p.current_stock_qty=i.stock_before AND p.average_cost_try=i.cost_before/);
  assert.match(intents,/ap.current_stock_qty=i.stock_after AND ap.average_cost_try=i.cost_after/);
  assert.match(object('c03_guard_stock'),/ap.current_stock_qty=t.stock_after AND ap.average_cost_try=t.cost_after/);
  assert.doesNotMatch(object('usp_assert_test_purchase_fx_received'),/ap.current_stock_qty=t.stock_after/);
  assert.match(intents,/m.source_id=i.receipt_id\)=1/);
  assert.match(sql,/quantity BETWEEN 1 AND 5 AND quantity=FLOOR\(quantity\)/);
  assert.match(sql,/amount_try>0 AND amount_try<=200/);
  assert.match(object('c03_guard_stock'),/m.source_type=N'purchase_invoice'/);
  assert.match(object('usp_assert_test_purchase_fx_received'),/NOT EXISTS\(SELECT 1 FROM dbo.stock_movements m WHERE m.source_type=N'purchase_invoice'/);
});
test('journal binds receipt identity and preview hash separately from request payload digest',()=>{
  const body=object('c03_guard_requests');
  assert.match(body,/i.operation=N'quote_create' AND t.receipt_id=i.entity_id/);
  assert.match(body,/t.payload_hash=JSON_VALUE\(i.response_json,'\$\.previewHash'\)/);
  assert.doesNotMatch(body,/t.payload_hash=i.payload_hash|quote_create' AND t.id=i.entity_id/);
  assert.match(body,/TRY_CONVERT\(bigint,JSON_VALUE\(i.response_json,'\$\.id'\)\) IS NULL/);
  assert.match(body,/qd.state=N'pending'/);
  assert.match(body,/COUNT\(\*\) FROM dbo.test_purchase_fx_requests\)>50/);
  for(const op of ['quote_create','receipt_accept','receipt_reject','draft_create','draft_finalize','draft_cancel'])assert.ok(body.includes(`i.operation=N'${op}'`));
});
test('stored replay response binds immutable financial/source/rate/unit fields and excludes historical status',()=>{
  const body=object('c03_guard_requests');
  const required=['intentId','receiptId','previewHash','number','date','currency','accountCurrency','quantity','priceExact','nativePriceExact4','documentAmountExact4','accountAmountExact4','amountTryExact4','sourceProof.productId','sourceProof.priceId','sourceProof.bindingsHash','sourceProof.readOnly','sourceProof.sourceFreshLive','operationalUnit.mainUnitSourceId','operationalUnit.factorExact8','operationalUnit.hash','rates.document.rateToTryExact8','rates.document.hash','rates.account.rateToTryExact8','rates.account.hash'];
  function validate(text){
    assert.match(text,/NOT EXISTS\(SELECT 1 FROM dbo.test_purchase_fx_intents t WHERE EXISTS\(SELECT 1 FROM dbo.test_purchase_fx_sources js/);
    for(const key of required)assert.ok(text.includes(`JSON_VALUE(i.response_json,'$.${key}')`),key);
    assert.doesNotMatch(text,/JSON_VALUE\(i.response_json,'\$\.status'\)/);
  }
  validate(body);
  // Removing the financial binding must fail the structural contract, even if
  // all ledger guards are intact. The positive EXISTS also rejects JSON NULL.
  assert.throws(()=>validate(body.replaceAll("JSON_VALUE(i.response_json,'$.amountTryExact4')","NULL")));
  assert.match(body,/JSON_VALUE\(i.response_json,'\$\.amountTryExact4'\)=CONVERT\(varchar\(40\),t.amount_try\)/);
});
test('rejection is reasoned, exact receipt payload is shared across all three states and no stock',()=>{
  const receipt=object('c03_guard_daily_receipts');
  assert.match(receipt,/WHERE d.id=i.id\)\) OR \(i.state=N'approved'/);
  assert.match(receipt,/t.stock_after<=40[^;]* OR \(i.state=N'rejected'/);
  assert.match(receipt,/LEN\(LTRIM\(RTRIM\(i.reason\)\)\)>=3/);
  assert.match(object('c03_guard_requests'),/receipt_reject[^;]*NOT EXISTS\(SELECT 1 FROM dbo.stock_movements rm/);
  const audit=object('c03_guard_audit');
  assert.match(audit,/t.receipt_id=a.entity_id/);
  assert.match(audit,/a.entity_type=N'test_daily_draft'/);
  assert.match(audit,/JSON_VALUE\(a.after_json,'\$\.previewHash'\)=t.payload_hash/);
  assert.match(audit,/test_fx_receipt_rejected/);
});
test('native invoice staging permits null actor and optional initial snapshots, complete linkage needs one item',()=>{
  const headers=object('c03_guard_headers');
  assert.match(headers,/i.created_by IS NULL/);
  assert.match(headers,/i.account_currency IS NULL OR i.account_currency=N'TRY'/);
  assert.match(headers,/d.status=N'draft' AND i.status=N'draft' AND t.status=N'registered'/);
  assert.match(object('c03_guard_items'),/t.invoice_id IS NULL/);
  assert.match(object('usp_assert_test_purchase_fx_received'),/pi.purchase_invoice_id=p.id\)=1/);
  assert.match(object('usp_assert_test_purchase_fx_received'),/AS bit\) valid/);
});
test('native posting NULLs fail closed, finalize requires stamped debt and cancel requires exact reversal',()=>{
  const movement=object('c03_guard_supplier_movements');
  for(const col of ['account_currency','account_amount','document_exchange_rate_snapshot','account_exchange_rate_snapshot','amount_try','balance_effect'])assert.ok(movement.includes(`i.${col} IS NULL`),col);
  assert.match(movement,/m.amount IS NOT NULL AND m.balance_effect IS NOT NULL/);
  const header=object('c03_guard_headers');
  assert.match(header,/pm.balance_effect=1\*t.account_total/);
  assert.match(header,/pm.balance_effect=-1\*t.account_total/);
  assert.match(header,/d.status=N'draft' AND NOT EXISTS\(SELECT 1 FROM dbo.supplier_movements pm/);
  assert.match(header,/source_purchase_invoice_id=t.invoice_id/);
  assert.match(header,/i.cancel_reason IS NOT NULL/);
});
test('manifest self hash is seeded before immutable activation and grants remain object scoped',()=>{
  const seed=sql.indexOf("INSERT dbo.test_purchase_fx_guard_manifest VALUES(N'c03_immutable_test_purchase_fx_guard_manifest'");
  assert.ok(seed>0);
  assert.ok(sql.indexOf('EXEC sys.sp_executesql',seed)>seed);
  assert.match(sql,/DENY SELECT,INSERT,UPDATE,DELETE ON dbo.test_purchase_fx_guard_manifest/);
  assert.match(sql,/GRANT EXECUTE ON dbo.usp_get_test_purchase_fx_unit_evidence/);
  assert.doesNotMatch(sql,/GRANT (?:CONTROL|ALTER|EXECUTE) TO|GRANT .* ON SCHEMA|GRANT .* ON DATABASE/i);
});
