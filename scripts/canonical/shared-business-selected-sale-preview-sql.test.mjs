import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleHash} from './stage4-copy-sql.mjs';
import {prepareBusinessSelectedSaleContextSQL,assertPreparedBusinessSelectedSaleContext,SELECTED_SALE_READER} from './shared-business-selected-sale-preview-sql.mjs';
import {selectedSaleFixture,configureSelectedSaleFixture} from '../../apps/api/src/services/businessSelectedSalePreview.test.mjs';

// Structural syntax check only; native compilation remains a separate proof.
// Ignore SQL strings (including escaped quotes) and line comments so JSON and
// SQL literals cannot conceal an unbalanced emitted expression.
function assertSqlParentheses(sql){
 let depth=0,quoted=false,comment=false;
 for(let i=0;i<sql.length;i++){
  const c=sql[i];
  if(comment){if(c==='\n')comment=false;continue;}
  if(quoted){if(c==="'"){if(sql[i+1]==="'")i++;else quoted=false;}continue;}
  if(c==="'"){quoted=true;continue;}
  if(c==='-'&&sql[i+1]==='-'){comment=true;i++;continue;}
  if(c==='(')depth++;
  if(c===')'){depth--;assert(depth>=0,`unexpected closing parenthesis at ${i}`);}
 }
 assert.equal(quoted,false,'unterminated SQL string');assert.equal(depth,0,'unclosed SQL expression');
}

test('new reader is deterministic stored CREATE with exact server artifact identity',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture()),a=prepareBusinessSelectedSaleContextSQL(f.c),b=prepareBusinessSelectedSaleContextSQL(f.c);
 assert.equal(a.name,SELECTED_SALE_READER);assert.equal(a.definition,b.definition);assert.equal(a.executionSQL,a.storedDefinition);assert.equal(a.definitionHash,moduleHash(a.storedDefinition));assert.notEqual(moduleHash(a.definition.replace(/^CREATE/,'ALTER')),a.definitionHash);
 assert.equal(assertPreparedBusinessSelectedSaleContext(a,f.c),a);assert.throws(()=>assertPreparedBusinessSelectedSaleContext({...a},f.c));assert.throws(()=>assertPreparedBusinessSelectedSaleContext(a,structuredClone(f.c)));
 assert.equal(a.previewOnly,true);assert.equal(a.businessWrites,0);assert.equal(a.grants,0);assert(Object.isFrozen(a.parentHashes));
});
test('unregistered or serialized copy cannot choose parent hashes or native reader',()=>{
 const f=selectedSaleFixture();assert.throws(()=>prepareBusinessSelectedSaleContextSQL(f.c),/REGISTERED_V4_V5/);assert.throws(()=>prepareBusinessSelectedSaleContextSQL(structuredClone(f.c)),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
});
test('SQL uses full manifest and one unconditional full READY with fresh selected source/native proofs',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture()),a=prepareBusinessSelectedSaleContextSQL(f.c),s=a.definition;
 assert.equal(s.split('EXEC dbo.usp_stage4_copy_ready @copy_id;').length-1,1);
 for(const hash of Object.values(a.parentHashes))assert(s.includes(hash));
 for(const clause of ["ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2","@@TRANCOUNT<>1","XACT_STATE()<>1","N'Transaction'),N'')<>N'Shared'","transaction_isolation_level","HASHBYTES('SHA2_256',@p)","permissionsRowsHash","sales.view","sales.create","a.party_entity_id=s.partyId","c.party_entity_id=s.partyId","a.supplier_id IS NULL","s.sourceWitnessHash","p.current_stock_qty","CONVERT(decimal(28,3),p.current_stock_qty)=p.current_stock_qty","p.average_cost_try","v.source_unit_id=q.unitSourceId","SELECT v.* FOR JSON PATH","dbo.currency_rates","rate_to_try=TRY_CONVERT(decimal(28,8)","CURRENT_TRANSACTION_ID() transactionId",`OBJECT_ID(N'${SELECTED_SALE_READER}',N'P')`])assert(s.includes(clause),clause);
 assert(!s.includes("JSON_MODIFY(@p,'$.products'"));assert(!s.includes('finance_accounts'));assert(!s.includes('purchaseQuote'));assert(!s.includes('purchasePriceExact8'));assert(!s.includes('balanceExact4'));
 assert.equal((s.match(/\bINSERT\b/g)||[]).length,1);assert(s.includes('INSERT @ids SELECT'));assert(!/\b(?:UPDATE|DELETE|MERGE|GRANT|REVOKE|COMMIT|ALTER|DROP|TRUNCATE)\b/.test(s));
});
test('finite selection, exact FK structure, native schema and preview policy are guarded explicitly',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture()),s=prepareBusinessSelectedSaleContextSQL(f.c).definition;
 for(const clause of ["NOT BETWEEN 1 AND 2","type<>1","COUNT(DISTINCT value)","@customer_id IN(591,592)","@actor_id NOT IN(15,16)","pc.name=N'product_id'","rt.name=N'products'","rc.name=N'id'","constraint_column_id=1","f.delete_referential_action=0","f.update_referential_action=0","SOURCE_BUSINESS_INVOICE_DOCUMENT_AMOUNT_PREVIEW_ONLY","JSON_VALUE(@p,'$.businessInvoiceMaxExact4') maxInvoiceAmountExact4","N'TRY' existingWriterCurrency","N'500.0000' existingWriterMaxInvoiceAmountExact4","CAST(0 AS bit) writable"])assert(s.includes(clause),clause);
 assert(!/a\.party_id\b/.test(s));assert(!s.includes('500.0000\' maxInvoiceAmountExact4'));assert(!s.includes('amount_try>20000'));
});
test('emitted nested quote query has balanced OPENJSON WITH and FOR JSON expressions',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture()),s=prepareBusinessSelectedSaleContextSQL(f.c).definition;
 assertSqlParentheses(s);
 assert.match(s,/OPENJSON\(s\.quotes\) WITH\([^\n]*unitSourceId bigint\)q JOIN dbo\.product_prices/);
 assert.throws(()=>assertSqlParentheses(s.replace('unitSourceId bigint)q JOIN','unitSourceId bigint))q JOIN')));
 assert.throws(()=>assertSqlParentheses(s.replace('FOR JSON PATH)) prices','FOR JSON PATH) prices')));
});
