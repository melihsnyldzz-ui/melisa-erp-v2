import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,assertIsolatedCopyReadProof,assertIsolatedCopyActor,bindIsolatedCopyOperationDTO,copyAssert,isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {workScaled} from './workSalesModel.mjs';
import {SELECTED_SALE_CONTEXT_METADATA_SQL} from './businessSelectedSaleNativeContext.mjs';
import {assertPreparedSelectedRevisionArtifact} from '../../../../scripts/canonical/shared-business-selected-sale-revision-sql.mjs';

// Called only by the read-only trade store after its owner READY and owner
// context have verified the entire immutable profile, current holds, roles,
// registry and module pins in this same SERIALIZABLE/shared-copy transaction.
// This SELECT rechecks every mutable predicate of the full selected reader;
// it neither executes that procedure nor claims a new owner-procedure proof.
export const SELECTED_SALE_INVOICE_STATE_SQL=`
DECLARE @products TABLE(id bigint PRIMARY KEY,barcodes nvarchar(max),quotes nvarchar(max));
INSERT @products SELECT id,barcodes,quotes FROM OPENJSON(@invoice_source_json)WITH(id bigint,barcodes nvarchar(max) AS JSON,quotes nvarchar(max) AS JSON);
SELECT CONVERT(varchar(20),c.id) id,CONVERT(varchar(20),a.id) accountId,CONVERT(varchar(20),a.party_entity_id) partyId,c.source_record_key sourceKey,c.customer_code code,c.name,a.currency_code currency,CONVERT(varchar(60),CONVERT(decimal(28,4),a.current_balance)) balanceExact4,CONVERT(varchar(60),CONVERT(decimal(28,8),a.current_balance)) balanceExact8,
CAST(CASE WHEN c.is_active=1 AND c.is_deleted=0 AND a.customer_id=c.id AND a.supplier_id IS NULL AND c.party_entity_id=a.party_entity_id AND a.current_balance IS NOT NULL THEN 1 ELSE 0 END AS bit) valid
FROM dbo.customers c WITH(HOLDLOCK) JOIN dbo.party_currency_accounts a WITH(HOLDLOCK) ON a.id=@invoice_account_id WHERE c.id=@invoice_customer_id;
SELECT CONVERT(varchar(20),s.id) id,CONVERT(varchar(20),p.id) nativeId,p.stock_code stockCode,p.source_record_key sourceKey,p.name,p.unit,
CONVERT(varchar(60),CONVERT(decimal(28,4),p.average_cost_try)) costExact4,
CAST(CASE WHEN p.average_cost_try=CONVERT(decimal(28,4),p.average_cost_try) AND p.average_cost_try>0 THEN 1 ELSE 0 END AS bit) costValid,
CONVERT(varchar(60),CONVERT(decimal(28,3),p.current_stock_qty)) stockQuantityExact3,
CAST(CASE WHEN p.is_active=1 AND p.is_deleted=0 AND p.current_stock_qty IS NOT NULL AND CONVERT(decimal(28,3),p.current_stock_qty)=p.current_stock_qty AND p.current_stock_qty>=0 THEN 1 ELSE 0 END AS bit) valid
FROM @products s LEFT JOIN dbo.products p WITH(HOLDLOCK) ON p.id=s.id ORDER BY s.id;
SELECT CONVERT(varchar(20),s.id) productId,CONVERT(varchar(20),q.quoteId) quoteId,CONVERT(varchar(20),v.id) nativeId,CONVERT(varchar(20),v.product_id) nativeProductId,v.price_type type,v.currency_code currency,CONVERT(varchar(60),CONVERT(decimal(28,8),v.price)) priceExact8,CONVERT(varchar(20),v.source_unit_id) unitSourceId,
CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT v.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) nativeRowHash
FROM @products s CROSS APPLY OPENJSON(s.quotes)WITH(quoteId bigint)q LEFT JOIN dbo.product_prices v WITH(HOLDLOCK) ON v.id=q.quoteId ORDER BY s.id,q.quoteId;
SELECT CONVERT(varchar(20),s.id) productId,b.barcode FROM @products s JOIN dbo.product_barcodes b WITH(HOLDLOCK) ON b.product_id=s.id AND b.is_active=1
WHERE EXISTS(SELECT 1 FROM OPENJSON(s.barcodes)x WHERE x.value COLLATE Latin1_General_100_BIN2=b.barcode COLLATE Latin1_General_100_BIN2) ORDER BY s.id,b.is_primary DESC,b.id;
SELECT CONVERT(varchar(20),id) id,currency_code currency,CONVERT(char(10),rate_date,23) date,CONVERT(varchar(60),CONVERT(decimal(28,8),rate_to_try)) rateExact8,source FROM dbo.currency_rates WITH(HOLDLOCK) WHERE @invoice_currency<>N'TRY' AND id=@invoice_rate_id;
SELECT COUNT_BIG(*) requestCount FROM dbo.stage4_copy_requests WITH(HOLDLOCK) WHERE copy_id=@copy_id;
`;
const yes=value=>value===true||value===1;
const balance=(value,places)=>copyAssert(typeof value==='string'&&new RegExp('^-?(?:0|[1-9]\\d{0,'+(27-places)+'})\\.\\d{'+places+'}$').test(value),'SELECTED_SALE_INVOICE_BALANCE');
export function selectedSaleInvoiceMetadataSQL(copy){
 assertIsolatedCopyContext(copy);
 const parents=Object.entries(copy.sql).map(([key,m])=>{copyAssert(/^[a-z]+$/.test(key)&&/^dbo\.usp_stage4_copy_[a-z]+$/.test(m.name),'SELECTED_SALE_INVOICE_PARENT_NAME');return `CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${m.name}',N'P'))),2) ${key}DefinitionHash`;});
 return SELECTED_SALE_CONTEXT_METADATA_SQL.slice(0,-1)+','+parents.join(',')+';';
}
function metadata(copy,artifact,pins,row){
 assertIsolatedCopyIdentity(copy,row);
 copyAssert(row?.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&row.copyLockMode==='Shared'&&Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&(typeof row.transactionId!=='number'||Number.isSafeInteger(row.transactionId))&&row.readerDefinitionHash===artifact.definitionHash&&Object.keys(copy.sql).every(key=>row[key+'DefinitionHash']===pins[key]),'SELECTED_SALE_INVOICE_READ_PIN');return row;
}
export function createBusinessSelectedSaleInvoiceReader({copy,transaction,sql,request,artifact,actor,actual,readProof}){
 assertIsolatedCopyContext(copy);assertPreparedSelectedRevisionArtifact(artifact,copy,'context');assertIsolatedCopyReadProof(copy,readProof);
 const a={id:String(actor?.id),permissions:[...(actor?.permissions??[])]};assertIsolatedCopyActor(copy,a,actual,'sales.view');copyAssert(transaction&&typeof request==='function','SELECTED_SALE_INVOICE_READ_FACTORY');
 const parentPins=Object.freeze({...readProof.definitionHashes}),metaSQL=selectedSaleInvoiceMetadataSQL(copy);
 return async selection=>{
  copyAssert(isolatedCopyTransactionContext(transaction,{writeRequired:false})===copy,'SELECTED_SALE_INVOICE_READ_TRANSACTION');
  const selected=selectBusinessSaleWriteIntent(copy,{customerId:selection?.customerId,currency:selection?.currency,productIds:selection?.productIds});for(const [key,value] of Object.entries(selected))copyAssert(isolatedCopyJSON(selection[key])===isolatedCopyJSON(value),'SELECTED_SALE_INVOICE_READ_SELECTION');
  const readMeta=async()=>{const rows=(await request().input('copy_id',sql.UniqueIdentifier,copy.copyId).query(metaSQL)).recordset;copyAssert(rows?.length===1,'SELECTED_SALE_INVOICE_READ_METADATA');return metadata(copy,artifact,parentPins,rows[0]);};const before=await readMeta();
  const sources=selected.productIds.map(id=>copy.products.find(p=>p.id===id)),customer=copy.customers.find(c=>c.id===selected.customerId&&c.currency===selected.currency),rate=copy.currencyRates.find(r=>r.currency===selected.currency);
  copyAssert(rate&&rate.date<=copy.date&&workScaled(rate.rateExact8,8)>0n&&(selected.currency!=='TRY'||rate.rateExact8==='1.00000000'),'SELECTED_SALE_INVOICE_RATE');
  const projection=sources.map(p=>{const quotes=p.quotes.filter(q=>q.currency===selected.currency&&q.type==='sale'&&q.verified===true&&q.mainUnit===true);copyAssert(p.unit==='ADET'&&p.unitFactorExact8==='1.00000000'&&quotes.length>0&&quotes.every(q=>/^[A-Fa-f0-9]{64}$/.test(q.nativeRowHash)),'SELECTED_SALE_INVOICE_SOURCE');return {id:p.id,barcodes:p.barcodes,quotes:quotes.map(q=>({quoteId:q.quoteId}))};});
  const sets=(await request().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('invoice_source_json',sql.NVarChar(sql.MAX),JSON.stringify(projection)).input('invoice_customer_id',sql.BigInt,customer.id).input('invoice_account_id',sql.BigInt,customer.accountId).input('invoice_currency',sql.NVarChar(3),selected.currency).input('invoice_rate_id',sql.BigInt,selected.currency==='TRY'?null:rate.id).query(SELECTED_SALE_INVOICE_STATE_SQL)).recordsets;
  copyAssert(sets?.length===6&&sets[0].length===1&&sets[1].length===sources.length&&sets[5].length===1,'SELECTED_SALE_INVOICE_STATE_ROWS');
  const native=sets[0][0];copyAssert(yes(native.valid)&&['id','accountId','partyId','currency','sourceKey'].every(k=>native[k]===customer[k]),'SELECTED_SALE_INVOICE_CUSTOMER');balance(native.balanceExact4,4);balance(native.balanceExact8,8);
  copyAssert(new Set(sets[1].map(p=>p.id)).size===sources.length,'SELECTED_SALE_INVOICE_PRODUCTS');
  const origin={synthetic:false,operationOrigin:copy.operationOrigin};const products=sources.toSorted((x,y)=>BigInt(x.id)<BigInt(y.id)?-1:1).map(source=>{
   const p=sets[1].find(v=>v.id===source.id);copyAssert(p&&p.nativeId===source.id&&yes(p.valid)&&yes(p.costValid)&&p.stockCode===source.stockCode&&p.sourceKey===source.sourceKey&&p.unit==='ADET'&&p.costExact4===source.costExact4&&workScaled(p.costExact4,4)>0n&&workScaled(p.stockQuantityExact3,3)>=0n,'SELECTED_SALE_INVOICE_PRODUCT');
   const expected=source.quotes.filter(q=>q.currency===selected.currency&&q.type==='sale'&&q.verified===true&&q.mainUnit===true),quotes=sets[2].filter(q=>q.productId===source.id);copyAssert(quotes.length===expected.length&&new Set(quotes.map(q=>q.quoteId)).size===expected.length,'SELECTED_SALE_INVOICE_QUOTES');
   const prices=expected.toSorted((x,y)=>BigInt(x.quoteId)<BigInt(y.quoteId)?-1:1).map(q=>{const v=quotes.find(v=>v.quoteId===q.quoteId);copyAssert(v&&v.nativeId===q.quoteId&&v.nativeProductId===source.id&&v.type==='sale'&&v.currency===selected.currency&&v.priceExact8===q.priceExact8&&workScaled(v.priceExact8,8)>0n&&v.unitSourceId===(q.unitSourceId==null?null:String(q.unitSourceId))&&v.nativeRowHash===q.nativeRowHash.toUpperCase(),'SELECTED_SALE_INVOICE_PRICE');return {quoteId:q.quoteId,currency:v.currency,unitPriceExact8:v.priceExact8,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}};});
   const barcodes=sets[3].filter(b=>b.productId===source.id);copyAssert(barcodes.every(b=>source.barcodes.includes(b.barcode)),'SELECTED_SALE_INVOICE_BARCODE');
   return {...origin,id:source.id,stockCode:p.stockCode,sourceKey:p.sourceKey,sourceWitnessHash:source.sourceWitnessHash,name:p.name,barcode:barcodes[0]?.barcode??null,stockQuantityExact3:p.stockQuantityExact3,unit:{label:'ADET',factorExact8:'1.00000000'},costExact4:p.costExact4,writeEligible:true,prices};
  });
  copyAssert(sets[2].length===products.reduce((n,p)=>n+p.prices.length,0)&&sets[3].every(b=>selected.productIds.includes(b.productId)),'SELECTED_SALE_INVOICE_EXTRA_ROWS');
  if(selected.currency==='TRY')copyAssert(sets[4].length===0,'SELECTED_SALE_INVOICE_RATE');else copyAssert(sets[4].length===1&&['id','currency','date','rateExact8','source'].every(k=>sets[4][0][k]===rate[k]),'SELECTED_SALE_INVOICE_RATE');
  const count=sets[5][0].requestCount;copyAssert(Number.isSafeInteger(count)&&count>=0||typeof count==='string'&&/^(0|[1-9]\d*)$/.test(count),'SELECTED_SALE_INVOICE_REQUEST_COUNT');
  const after=await readMeta();copyAssert(before.sessionId===after.sessionId&&String(before.transactionId)===String(after.transactionId)&&before.copyLockMode===after.copyLockMode,'SELECTED_SALE_SAME_NATIVE_TRANSACTION');
  const currentCustomer={...origin,...Object.fromEntries(['id','accountId','partyId','sourceKey','code','name','currency','balanceExact4','balanceExact8'].map(k=>[k,native[k]])),sourceWitnessHash:customer.sourceWitnessHash,writeEligible:true};
  const revision=isolatedCopyHash({customer:currentCustomer,products,rate,requests:String(count)});
  return bindIsolatedCopyOperationDTO(copy,{meta:{schemaVersion:'melisa-selected-sale-context.v1',operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash,date:copy.date,readOnly:true},revision,scope:{...origin,customer:currentCustomer,products,accounts:[]},rate,policy:{basis:'SOURCE_BUSINESS_INVOICE_DOCUMENT_AMOUNT_PREVIEW_ONLY',currency:selected.currency,maxInvoiceAmountExact4:selected.maxInvoiceAmountExact4,maxItems:200,quantity:'POSITIVE_WHOLE_MAIN_UNIT'},limits:{maxItems:200,maxInvoiceAmountExact4:selected.maxInvoiceAmountExact4,quantity:'POSITIVE_WHOLE_MAIN_UNIT'},writable:false});
 };
}
