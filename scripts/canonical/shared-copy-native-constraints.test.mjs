import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedRevisionFixture} from '../../apps/api/src/services/isolatedOperationCopyRevision.test.mjs';
import {isolatedCopyHash,SHARED_COPY_DATABASE,ISOLATED_COPY_SOURCE_DATABASE} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {sharedCopyStockCheckBranch,buildSharedNativeConstraintAdjunct,sharedCopyCanonicalCheckDefinition,buildReviewedSharedNativeConstraintAdjunct,sharedCopyIntentPriceCheckBranch,buildSharedIntentPriceConstraintAdjunct,SHARED_STOCK_CHECK,SHARED_STOCK_BEFORE_HASH,SHARED_INTENT_PRICE_CHECK,SHARED_INTENT_PRICE_BEFORE_HASH} from './shared-copy-native-constraints.mjs';
// SQL CHECK metadata of the already installed legacy TEST fixtures; no row data.
const legacyDefinition="([source_type]=N'goods_receipt' OR [source_type]=N'sales_invoice' OR [source_type]=N'purchase_invoice' OR [source_type]=N'stock_adjustment' OR [source_type]=N'terminal_sync' OR [source_type]=N'stock_count' OR [source_type]=N'invoice_return' OR [source_type]=N'invoice_return_cancel' OR [source_record_key] IS NOT NULL AND [source_type]=N'vega_history' AND [affects_inventory]=(0) OR ([source_type]=N'uninvoiced_return_cancel' OR [source_type]=N'stock_count_cancel') AND [source_id] IS NOT NULL AND [created_by]=(16) AND ([product_id]=(301989) OR [product_id]=(301986) OR [product_id]=(301990) OR [product_id]=(301988)) OR case when [source_type]=N'goods_receipt_batch' AND [movement_type]=N'in' AND [source_id]>(0) AND [created_by]=(16) AND [supplier_id]=(13370) AND [currency_code]=N'TRY' AND [warehouse_name]=N'TEST V70 MAL KABUL DEPOSU' AND [source_warehouse]=N'TEST-V70-GOODS-WH' AND [source_record_key] IS NULL AND [migration_run_id] IS NULL AND [affects_inventory]=(1) AND ([quantity_in]>=(1) AND [quantity_in]<=(5)) AND [quantity_in]=floor([quantity_in]) AND [quantity_out]=(0) AND [quantity_net]=[quantity_in] AND ([product_id]=(301985) AND [unit_cost_try]=(60) AND [unit_price]=(60) AND [average_cost_try_after]=(60) AND [amount_try]=[quantity_in]*(60) OR [product_id]=(325503) AND [unit_cost_try]=(80) AND [unit_price]=(80) AND [average_cost_try_after]=(80) AND [amount_try]=[quantity_in]*(80)) then (1) else (0) end=(1))";
const fields=['source_type','movement_type','source_id','created_by','supplier_id','customer_id','currency_code','document_date','warehouse_name','source_warehouse','source_record_key','migration_run_id','affects_inventory','quantity_in','quantity_out','quantity_net','product_id','unit_cost_try','unit_price','average_cost_try_after','amount_try'];
function fixture(){
 const c=structuredClone(sharedRevisionFixture());c.warehouse={id:'1',code:'TEST-WH',label:'TEST warehouse'};c.products[0].costExact4='12.2500';c.products[1].costExact4='19.0000';const {sealHash,...body}=c;c.sealHash=isolatedCopyHash(body);
 const stock={schemaName:'dbo',tableName:'stock_movements',name:SHARED_STOCK_CHECK,definition:legacyDefinition,definitionHash:moduleHash(legacyDefinition),isDisabled:false,isNotTrusted:false,isNotForReplication:false,parentColumnId:0};
 const other={...stock,tableName:'supplier_movements',name:'CK_supplier_movements_type_native',definition:"([movement_type]=N'purchase_invoice')"};other.definitionHash=moduleHash(other.definition);
 const data=db=>({identity:{database:db,server:c.target.server},constraints:structuredClone([stock,other]),schema:fields.map(columnName=>({schemaName:'dbo',tableName:'stock_movements',columnName}))});
 return {schemaVersion:'melisa-shared-native-constraints-input.v1',copyContext:c,businessWrites:0,[ISOLATED_COPY_SOURCE_DATABASE]:data(ISOLATED_COPY_SOURCE_DATABASE),[SHARED_COPY_DATABASE]:data(SHARED_COPY_DATABASE)};
}
const reseal=c=>{const {sealHash,...body}=c;c.sealHash=isolatedCopyHash(body);};
test('one CHECK preserves complete legacy branch and immutable profile with before/after definition pins',()=>{
 const input=fixture(),snapshot=JSON.stringify(input),a=buildSharedNativeConstraintAdjunct(input),r=a.replacements[0];
 assert.equal(moduleHash(legacyDefinition),SHARED_STOCK_BEFORE_HASH);assert.equal(a.replacements.length,1);assert.equal(r.beforeDefinition,legacyDefinition);assert.equal(r.beforeHash,SHARED_STOCK_BEFORE_HASH);assert.equal(r.afterDefinition,`(${legacyDefinition} OR case when ${r.branch} then (1) else (0) end=(1))`);assert.equal(moduleHash(r.afterDefinition),r.afterHash);assert.equal(a.baseSealHash,input.copyContext.sealHash);assert.equal(JSON.stringify(input),snapshot);
 assert.equal(a.baseModuleManifestCount,184);assert.equal(a.adapterRevisionRows,3);assert.equal(a.registryWrites,0);assert.equal(a.normalSourceWrites,0);assert.equal(a.businessWrites,0);assert.equal(a.normalRolesChanged,false);assert.equal(a.unchangedChecks.length,1);assert.match(r.sql,/WITH CHECK ADD CONSTRAINT/);assert.match(r.sql,/WITH CHECK CHECK CONSTRAINT/);assert.doesNotMatch(r.sql,/NOCHECK|DISABLE|INSERT|UPDATE|DELETE|CREATE (?:FUNCTION|PROCEDURE|LOGIN)|ALTER ROLE/i);
});
test('new branch retains actual native source and exact finite identity, quantities, costs and warehouse markers',()=>{
 const c=fixture().copyContext,b=sharedCopyStockCheckBranch(c);
 for(const needle of [SHARED_COPY_DATABASE,'Semih\\MELISADEV','melisa_shared_test_rw_20261009_01',"[created_by]=(16)","[supplier_id]=(10162)","[product_id]=(29980)","[product_id]=(30003)","[currency_code]=N'TRY'","[source_type]=N'goods_receipt_batch'","[movement_type]=N'in'","[quantity_in]>=(1)","[quantity_in]<=(5)",'[quantity_in]=floor([quantity_in])','[quantity_out]=(0)','[quantity_net]=[quantity_in]','[source_record_key] IS NULL','[migration_run_id] IS NULL','[customer_id] IS NULL',"[warehouse_name]=N'TEST V70 MAL KABUL DEPOSU'","[source_warehouse]=N'TEST-V70-GOODS-WH'"])assert.ok(b.includes(needle),needle);
 assert.ok(b.includes('[unit_cost_try]=(12.2500)'));assert.ok(b.includes('[unit_price]=(12.2500)'));assert.ok(b.includes('[average_cost_try_after]=(12.2500)'));assert.ok(b.includes('[amount_try]=[quantity_in]*(12.2500)'));assert.ok(b.includes('[amount_try]=[quantity_in]*(19.0000)'));
 assert.doesNotMatch(b,/stock_adjustment|stock_count|supplier_refund|ISOLATED_COPY_SOURCE_DATABASE|SESSION_CONTEXT|CREATE FUNCTION|SELECT/i);
});
test('source target, old copy, alternate principal/actor/product/supplier/warehouse and unsealed cost changes fail closed',()=>{
 const mutations=[c=>c.target.database=ISOLATED_COPY_SOURCE_DATABASE,c=>c.target.database='MELISA_ERP_STAGE04_COPY_TEST_20261008_01',c=>c.target.login='other',c=>c.actors[1].id='1',c=>c.products[0].id='40000',c=>c.suppliers[0].id='1',c=>c.warehouse.id='2',c=>c.products[0].unitFactorExact8='2.00000000',c=>c.products[0].costExact4='12.25',c=>c.products[0].costExact4='0.0000',c=>c.products[0].costExact4='12.2500;DROP TABLE x',c=>c.actualT1=true];
 for(const change of mutations){const i=fixture();change(i.copyContext);reseal(i.copyContext);assert.throws(()=>buildSharedNativeConstraintAdjunct(i));}
 const i=fixture();i.copyContext.products[0].costExact4='13.0000';assert.throws(()=>buildSharedNativeConstraintAdjunct(i));
});
test('unknown CHECK text/hash, wrong table, missing fields, disabled, untrusted and replication bypass cannot produce adjunct',()=>{
 for(const mutate of [i=>i[SHARED_COPY_DATABASE].constraints[0].definition+=' ',i=>i[SHARED_COPY_DATABASE].constraints[0].definitionHash='A'.repeat(64),i=>i[ISOLATED_COPY_SOURCE_DATABASE].constraints[0].definition+=' ',i=>i[SHARED_COPY_DATABASE].constraints[0].tableName='products',i=>i[SHARED_COPY_DATABASE].constraints[0].isDisabled=true,i=>i[SHARED_COPY_DATABASE].constraints[0].isNotTrusted=true,i=>i[SHARED_COPY_DATABASE].constraints[0].isNotForReplication=true,i=>i[SHARED_COPY_DATABASE].constraints[0].parentColumnId=1,i=>i[SHARED_COPY_DATABASE].schema.pop(),i=>i[SHARED_COPY_DATABASE].constraints.push({...i[SHARED_COPY_DATABASE].constraints[0]}),i=>i.businessWrites=1]){const i=fixture();mutate(i);assert.throws(()=>buildSharedNativeConstraintAdjunct(i));}
});
function rehearsal(i){const a=buildSharedNativeConstraintAdjunct(i),r=a.replacements[0],definition=sharedCopyCanonicalCheckDefinition(r.beforeDefinition,r.branch);return {target:a.target,copyId:a.copyId,baseSealHash:a.baseSealHash,constraint:r.constraint,beforeHash:r.beforeHash,definition,actualHash:moduleHash(definition),inputSHA:'A'.repeat(64),rolledBack:true,trustedEnabled:true,businessBefore:'unchanged proof',businessAfter:'unchanged proof'};}
test('captured trusted WITH CHECK rollback pins only the exact two SQL Server formatting rewrites',()=>{
 const i=fixture(),p=rehearsal(i),old=buildSharedNativeConstraintAdjunct(i),a=buildReviewedSharedNativeConstraintAdjunct(i,p,'a'.repeat(64));
 assert.equal(a.replacements[0].sql,old.replacements[0].sql);assert.equal(a.replacements[0].beforeDefinition,legacyDefinition);assert.equal(a.replacements[0].sourceExpression,old.replacements[0].afterDefinition);assert.equal(a.replacements[0].afterHash,p.actualHash);assert.ok(a.replacements[0].afterDefinition.startsWith('('+legacyDefinition.slice(1,-1)+' OR case when '));assert.equal(a.canonicalReview.originalInnerExpressionVerbatim,true);assert.equal(a.canonicalReview.normalizations.length,2);assert.equal(a.registryWrites,0);
});
test('a permissive predicate change, a different cost or incomplete/unproved rollback cannot be promoted to canonical v2',()=>{
 for(const change of [p=>p.rolledBack=false,p=>p.trustedEnabled=false,p=>p.businessAfter='changed',p=>p.beforeHash='B'.repeat(64),p=>p.actualHash='B'.repeat(64),p=>p.copyId='different',p=>p.inputSHA='B'.repeat(64),p=>p.definition=p.definition.replace('[quantity_in]<=(5)','[quantity_in]<=(6)'),p=>p.definition=p.definition.replace('[unit_cost_try]=(12.2500)','[unit_cost_try]=(13.2500)'),p=>p.definition=p.definition.replace(' AND [quantity_out]=(0)',' OR [quantity_out]=(0)')]){
  const i=fixture(),p=rehearsal(i),definition=p.definition;change(p);if(p.definition!==definition)p.actualHash=moduleHash(p.definition);assert.throws(()=>buildReviewedSharedNativeConstraintAdjunct(i,p,'A'.repeat(64)));
 }
});
function priceFixture(){
 const raw=fixture(),definitions=[
  [SHARED_INTENT_PRICE_CHECK,'([purchase_price]=(80) OR [purchase_price]=(60))',5],
  ['CK__test_purc__line___6C43F744','([line_discount_rate]=(0))',6],
  ['CK__test_purc__quant__6A5BAED2','([quantity]>=(1) AND [quantity]<=(5) AND [quantity]=floor([quantity]))',4],
  ['CK_test_batch_intent_line_total','([line_total]=[quantity]*[purchase_price])',0]
 ];
 raw.schemaVersion='melisa-shared-intent-price-check-input.v1';
 for(const db of [ISOLATED_COPY_SOURCE_DATABASE,SHARED_COPY_DATABASE]){raw[db].constraints=definitions.map(([name,definition,parentColumnId])=>({schemaName:'dbo',tableName:'test_purchase_batch_intent_lines',name,definition,parentColumnId,definitionHash:moduleHash(definition),isDisabled:false,isNotTrusted:false,isNotForReplication:false}));raw[db].schema=['draft_id','receipt_line_id','product_id','quantity','purchase_price','line_discount_rate','line_total'].map(columnName=>({schemaName:'dbo',tableName:'test_purchase_batch_intent_lines',columnName}));}
 return raw;
}
test('intent line price adjunct retains legacy prices and changes exactly one trusted CHECK with exact tuple limits',()=>{
 const i=priceFixture(),snapshot=JSON.stringify(i),a=buildSharedIntentPriceConstraintAdjunct(i),r=a.replacements[0];
 assert.equal(r.beforeHash,SHARED_INTENT_PRICE_BEFORE_HASH);assert.equal(a.replacements.length,1);assert.equal(a.unchangedChecks.length,3);assert.equal(r.beforeDefinition,'([purchase_price]=(80) OR [purchase_price]=(60))');assert.ok(r.afterDefinition.startsWith('([purchase_price]=(80) OR [purchase_price]=(60) OR case when '));assert.equal(r.afterHash,moduleHash(r.afterDefinition));assert.equal(r.beforeParentColumnId,5);assert.equal(r.afterParentColumnId,0);assert.equal(JSON.stringify(i),snapshot);
 for(const needle of [SHARED_COPY_DATABASE,'melisa_shared_test_rw_20261009_01','[draft_id]>(0)','[receipt_line_id]>(0)','[quantity]>=(1)','[quantity]<=(5)','[quantity]=floor([quantity])','[line_discount_rate]=(0)','[line_total]=[quantity]*[purchase_price]','[product_id]=(29980) AND [purchase_price]=(12.2500)','[product_id]=(30003) AND [purchase_price]=(19.0000)'])assert.ok(r.branch.includes(needle),needle);
 assert.doesNotMatch(r.branch,/\[created_by\]|\[actor_id\]|\[currency_code\]/);assert.equal(a.allowedActorId,'16');assert.equal(a.requiredHeaderCurrency,'TRY');assert.equal(a.businessWrites,0);assert.equal(a.registryWrites,0);assert.match(r.sql,/WITH CHECK ADD/);assert.match(r.sql,/WITH CHECK CHECK/);assert.doesNotMatch(r.sql,/NOCHECK|DISABLE|INSERT|UPDATE|DELETE|CREATE (?:FUNCTION|PROCEDURE|LOGIN)|ALTER ROLE/i);
});
test('intent line price adapter refuses source/alternate scopes, nonexistent columns, changed companion constraints and unknown baseline',()=>{
 for(const mutate of [i=>{i.copyContext.target.database=ISOLATED_COPY_SOURCE_DATABASE;reseal(i.copyContext);},i=>i.copyContext.products[0].costExact4='13.0000',i=>{i.copyContext.products[0].id='99999';reseal(i.copyContext);},i=>i[SHARED_COPY_DATABASE].constraints[0].definition='([purchase_price]>=(0))',i=>i[SHARED_COPY_DATABASE].constraints[0].isNotTrusted=true,i=>i[SHARED_COPY_DATABASE].constraints[0].isDisabled=true,i=>i[SHARED_COPY_DATABASE].constraints[0].parentColumnId=0,i=>i[SHARED_COPY_DATABASE].schema.pop(),i=>i[SHARED_COPY_DATABASE].constraints.pop(),i=>i[ISOLATED_COPY_SOURCE_DATABASE].constraints[1].definition='([line_discount_rate]=(1))',i=>i[SHARED_COPY_DATABASE].constraints[1].definitionHash='B'.repeat(64)]){const i=priceFixture();mutate(i);assert.throws(()=>buildSharedIntentPriceConstraintAdjunct(i));}
});
test('broader fixture metadata pins nine unchanged checks and refuses unchecked companion drift',()=>{
 const i=priceFixture(),wide=structuredClone(i);
 for(const db of [ISOLATED_COPY_SOURCE_DATABASE,SHARED_COPY_DATABASE]){
  for(let n=0;n<6;n++){const definition=`([fixture_value]>=(${n}))`;wide[db].constraints.push({schemaName:'dbo',tableName:n<4?'test_purchase_batch_drafts':'test_purchase_batch_links',name:'CK_fixture_'+n,definition,definitionHash:moduleHash(definition),isDisabled:false,isNotTrusted:false,isNotForReplication:false,parentColumnId:0});}
 }
 assert.equal(buildSharedIntentPriceConstraintAdjunct(i,wide).unchangedChecks.length,9);
 for(const change of [w=>w[SHARED_COPY_DATABASE].constraints[9].isNotTrusted=true,w=>w[SHARED_COPY_DATABASE].constraints[9].tableName='products',w=>w[ISOLATED_COPY_SOURCE_DATABASE].constraints.pop(),w=>w.copyContext.sealHash='B'.repeat(64)]){const w=structuredClone(wide);change(w);assert.throws(()=>buildSharedIntentPriceConstraintAdjunct(i,w));}
});
