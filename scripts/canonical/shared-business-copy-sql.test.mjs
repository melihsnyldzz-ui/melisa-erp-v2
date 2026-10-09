import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {buildBusinessNativeChecks} from './shared-business-native-checks.mjs';
import {businessCopyReadySQL,businessCopyBeginSQL,businessCopyNativeGuardSQL} from './shared-business-native-guards.mjs';
const nativeStock=JSON.parse(fs.readFileSync(new URL('./shared-copy-native-constraints.test.mjs',import.meta.url),'utf8').match(/const legacyDefinition=("[^\n]+?");/)[1]);
function fixture(){
 const rows=[['stock_movements','CK_stock_movements_source_type_native',nativeStock,0],['test_purchase_batch_intent_lines','CK__test_purc__purch__6B4FD30B','([purchase_price]=(80) OR [purchase_price]=(60))',5],['test_purchase_batch_drafts','CK__test_purc__curre__60D24498',"([currency]=N'TRY')",9],['test_purchase_batch_drafts','CK__test_purc__subto__5FDE205F','([subtotal]>(0) AND [subtotal]<=(700))',7]];
 const constraints=rows.map(([tableName,name,definition,parentColumnId])=>({schemaName:'dbo',tableName,name,definition,parentColumnId,definitionHash:moduleHash(definition),isDisabled:false,isNotTrusted:false,isNotForReplication:false}));
 const profile={target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',server:'Semih\\MELISADEV',login:'melisa_shared_test_rw_20261009_02'},products:Array.from({length:1158},()=>({})),businessInvoiceMaxExact4:'20000.0000'};
 const guard='BUSINESS_NATIVE_STOCK_COST_SCOPE BUSINESS_NATIVE_PURCHASE_QUOTE_SCOPE BUSINESS_SELECTED_INTENT_SCOPE';
 return {constraints,profile,guard};
}
test('four additive native CHECKs retain source predicates and fail closed outside the fresh copy identity',()=>{
 const i=fixture(),b=buildBusinessNativeChecks(i.constraints,i.profile,i.guard);assert.equal(b.replacements.length,4);assert.equal(b.requiredNativeGuardHash,moduleHash(i.guard));assert.equal(b.requiredQuarantineFirstCount,37);
 for(const r of b.replacements){assert.ok(r.afterDefinition.startsWith('('+r.beforeDefinition.slice(1,-1)+' OR case when '));assert.match(r.afterDefinition,/MELISA_ERP_CRM_SHARED_TEST_20261009_02/);assert.match(r.afterDefinition,/melisa_shared_test_rw_20261009_02/);assert.match(r.afterDefinition,/else \(0\) end=\(1\)/);assert.doesNotMatch(r.sql,/NOCHECK|DISABLE|ALTER ROLE|CREATE LOGIN|INSERT|UPDATE|DELETE/);assert.equal(r.afterHash,moduleHash(r.afterDefinition));}
 assert.match(b.replacements[0].afterDefinition,/currency_code\]=N'TRY'/);assert.match(b.replacements[1].afterDefinition,/purchase_price\]<=\(1179.80\)/);assert.match(b.replacements[2].afterDefinition,/\[currency\]=N'USD'/);assert.match(b.replacements[3].afterDefinition,/\[subtotal\]<=\(20000\)/);
 assert.deepEqual(b.replacements.map(r=>r.afterParentColumnId),[0,0,9,7]);
});
test('changed legacy CHECKs, disabled/untrusted baselines, uncoupled native guard and broader copy targets refuse compilation',()=>{
 for(const change of [i=>i.profile.target.database='MELISA_ERP_SIRKET_TEST_20260929_01',i=>i.profile.target.login='other',i=>i.profile.products.pop(),i=>i.profile.businessInvoiceMaxExact4='500000.0000',i=>i.constraints[1].isDisabled=true,i=>i.constraints[2].isNotTrusted=true,i=>i.constraints[3].definition+=' ',i=>i.constraints[0].definitionHash='A'.repeat(64),i=>i.guard='BUSINESS_SELECTED_INTENT_SCOPE']){const i=fixture();change(i);assert.throws(()=>buildBusinessNativeChecks(i.constraints,i.profile,i.guard));}
});
test('ready and intent validators require current source witnesses, original quarantine-first state and exact selected source account',()=>{
 const ready=businessCopyReadySQL(),begin=businessCopyBeginSQL();
 for(const needle of ['BUSINESS_PROFILE_SCOPE_DRIFT','<>1158','<>37','<>176','BUSINESS_PRICE_WITNESS_DRIFT','Latin1_General_100_BIN2_UTF8','BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT','IN(591,592)','SOURCE'])assert.ok(ready.includes(needle),needle);
 for(const needle of ['BUSINESS_OPERATION_NOT_VERIFIED','@actor_id<>16','businessSupplierId','businessAccountId','businessCurrency','CURRENT_TRANSACTION_ID()','STAGE4_COPY_LOCK_REQUIRED'])assert.ok(begin.includes(needle),needle);
 assert.doesNotMatch(ready+begin,/MELISA_ERP_CRM_SHARED_TEST_20261009_01/);
});
test('native guards retain legacy history protections while binding costs, purchase quotes, supplier FX, copy receipts and immutable counts',()=>{
 const columns=['id','created_by','state','decided_by','decided_at','reason','supplier_id','warehouse_id','note'];const schema=columns.map(columnName=>({schemaName:'dbo',tableName:'test_goods_batches',columnName,typeName:columnName==='id'?'bigint':'nvarchar'}));
 const guard=businessCopyNativeGuardSQL(schema);
 for(const needle of ['BUSINESS_SELECTED_INTENT_SCOPE','BUSINESS_MAIN_SUPPLIER_SCOPE','BUSINESS_EXACT_ACCOUNT_SCOPE','BUSINESS_PRODUCT_SUPPLIER_SCOPE','BUSINESS_NATIVE_STOCK_COST_SCOPE','BUSINESS_NATIVE_PURCHASE_QUOTE_SCOPE','BUSINESS_PURCHASE_CURRENCY_RATE_SCOPE','BUSINESS_PURCHASE_DRAFT_RECEIPT_SCOPE','BUSINESS_COUNT_EXACT_BINDING_SCOPE','STAGE4_OLD_HISTORY_PROTECTED','STAGE4_GOODS_DECISION_SCOPE','STAGE4_SAME_TX_INTENT_REQUIRED'])assert.ok(guard.includes(needle),needle);
 assert.ok(guard.includes("r.rateExact8=TRY_CONVERT(decimal(28,8),JSON_VALUE(i.value,'$.exchange_rate_snapshot'))) OR TRY_CONVERT"));
 const expression=guard.split('\n').find(l=>l.startsWith("IF @table_name=N'purchase_invoices' AND EXISTS"));let depth=0;
 for(const ch of expression.replace(/N?'(?:''|[^'])*'/g,"''")){if(ch==='(')depth++;else if(ch===')')depth--;assert.ok(depth>=0,'SQL parentheses may not close before their containing EXISTS');}assert.equal(depth,0);
 const begin=businessCopyBeginSQL();assert.ok(begin.includes("N'count_update'"));assert.ok(begin.includes("N'count_cancel'"));assert.ok(!begin.includes("N'count_lines'"));
 assert.ok(guard.includes("l.id=TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.source_id')) AND b.id=@target AND b.state=N'accepted'"));assert.ok(guard.includes('BUSINESS_RECEIPT_STOCK_ONCE'));assert.ok(guard.includes('BUSINESS_INVOICE_SUPPLIER_EFFECT_ONCE'));
});
test('installer defaults to rollback, requires reviewed bundle before Apply, hashes all 51 protected tables and never changes original database roles',()=>{
 const s=fs.readFileSync(new URL('./shared-business-copy-install.ps1',import.meta.url),'utf8');
 for(const needle of ["$Mode='Rehearse'","BUSINESS_INSTALL_REHEARSAL_REQUIRED",'VERIFY_FULL_BUSINESS_BEFORE','VERIFY_FULL_BUSINESS_AFTER','ROLLBACK_REHEARSAL','BUSINESS_REHEARSAL_ROLLBACK_PROOF','337','227','51','DENY CONNECT','GRANT INSERT ON dbo.work_business_count_bindings','VIEW DEFINITION','BUSINESS_INSTALL_UNCHANGED_CHECK_DRIFT'])assert.ok(s.includes(needle),needle);
 assert.doesNotMatch(s,/ALTER ROLE|NOCHECK|DISABLE TRIGGER|UPDATE dbo\.(products|customers|suppliers)|BACKUP DATABASE|RESTORE DATABASE/);
});
