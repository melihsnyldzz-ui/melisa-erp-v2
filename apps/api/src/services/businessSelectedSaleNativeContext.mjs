import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,assertIsolatedCopyReadProof,assertIsolatedCopyActor,bindIsolatedCopyOperationDTO,copyAssert,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {workScaled} from './workSalesModel.mjs';
import {SELECTED_SALE_CONTEXT} from '../../../../scripts/canonical/shared-business-selected-sale-revision-contract.mjs';
import {assertPreparedSelectedRevisionArtifact} from '../../../../scripts/canonical/shared-business-selected-sale-revision-sql.mjs';
import {getRegisteredBusinessProductPriceSaleRevision,verifyBusinessProductPriceSaleRevision} from '../../../../scripts/canonical/shared-business-product-price-sale-bootstrap.mjs';
import {assertPreparedBusinessProductPriceSaleArtifact} from '../../../../scripts/canonical/shared-business-product-price-sale-sql.mjs';
import {bindBusinessProductPriceSaleDTO} from './businessProductPriceSaleScope.mjs';
import {getRegisteredBusinessCollectionHistoryRevision,verifyBusinessCollectionHistoryRevision} from '../../../../scripts/canonical/shared-business-collection-history-bootstrap.mjs';
import {assertPreparedBusinessCollectionHistoryArtifact} from '../../../../scripts/canonical/shared-business-collection-history-sql.mjs';

const parse=value=>{copyAssert(typeof value==='string','SELECTED_SALE_NATIVE_JSON');try{return JSON.parse(value);}catch{copyAssert(false,'SELECTED_SALE_NATIVE_JSON');}};
export const SELECTED_SALE_CONTEXT_METADATA_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${SELECTED_SALE_CONTEXT}',N'P'))),2) readerDefinitionHash;`;
function metadata(copy,artifact,row){
 assertIsolatedCopyIdentity(copy,row);
 copyAssert(row?.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&['Shared','Exclusive'].includes(row.copyLockMode)&&Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&(typeof row.transactionId!=='number'||Number.isSafeInteger(row.transactionId))&&row.readerDefinitionHash===artifact.definitionHash,'SELECTED_SALE_NATIVE_CONTEXT_PIN');
 return row;
}
// A fresh read is separate from the intent reader. After finalize/cancel the
// stock/account state changes legitimately; no stale before-image grant is
// reused. This function never enters a native write scope.
export async function readBusinessSelectedSaleNativeContext({copy,transaction,sql,request,artifact,actor,selection,priceConsumer=null,invoiceId=null,collectionHistoryConsumer=null}){
 assertIsolatedCopyContext(copy);
 if(priceConsumer){
  copyAssert(priceConsumer===getRegisteredBusinessProductPriceSaleRevision(copy),'PRICE_SALE_SERVER_CONSUMER');
  if(collectionHistoryConsumer){
   copyAssert(collectionHistoryConsumer===getRegisteredBusinessCollectionHistoryRevision(copy)&&collectionHistoryConsumer.consumer===priceConsumer&&collectionHistoryConsumer.readOnly===true&&collectionHistoryConsumer.canCollect===false&&collectionHistoryConsumer.canCancelCollection===false&&invoiceId!==null&&String(actor?.id)==='16'&&actor?.role?.code==='isolated_test_ilker'&&!actor.testAdminSession&&actor.isAdmin!==true,'COLLECTION_HISTORY_REGISTERED_CAPABILITY');
   artifact=collectionHistoryConsumer.bundle.historyArtifact;assertPreparedBusinessCollectionHistoryArtifact(artifact,copy,'history');
  }else{artifact=invoiceId===null?priceConsumer.bundle.contextArtifact:priceConsumer.bundle.historyArtifact;assertPreparedBusinessProductPriceSaleArtifact(artifact,copy,invoiceId===null?'context':'history');}
 }else{copyAssert(collectionHistoryConsumer===null&&invoiceId===null,'PRICE_SALE_HISTORY_CONSUMER_REQUIRED');assertPreparedSelectedRevisionArtifact(artifact,copy,'context');}
 copyAssert(isolatedCopyTransactionContext(transaction,{writeRequired:false})===copy&&typeof request==='function','SELECTED_SALE_READ_TRANSACTION');
 const selected=selectBusinessSaleWriteIntent(copy,{customerId:selection?.customerId,currency:selection?.currency,productIds:selection?.productIds});
 // The write scope carries operation fields as well. Only its SOURCE selection
 // is used here; the read does not depend on the original selected revision.
 for(const [key,value] of Object.entries(selected))copyAssert(isolatedCopyJSON(selection[key])===isolatedCopyJSON(value),'SELECTED_SALE_NATIVE_CONTEXT_SELECTION');
 const a={id:String(actor?.id),permissions:[...(actor?.permissions??[])]};
 const boundRequest=()=>{const r=request();if(priceConsumer)copyAssert(r.parent===transaction,'PRICE_SALE_BOUND_REQUEST');return r;};
 const metaSQL=priceConsumer?SELECTED_SALE_CONTEXT_METADATA_SQL.replace(`N'${SELECTED_SALE_CONTEXT}'`,`N'${artifact.name}'`):SELECTED_SALE_CONTEXT_METADATA_SQL;
 const verify=async()=>{if(collectionHistoryConsumer)copyAssert(await verifyBusinessCollectionHistoryRevision(copy,boundRequest().input('copy_id',sql.UniqueIdentifier,copy.copyId))===collectionHistoryConsumer,'COLLECTION_HISTORY_REGISTERED_CAPABILITY');else if(priceConsumer)copyAssert(await verifyBusinessProductPriceSaleRevision(copy,boundRequest().input('copy_id',sql.UniqueIdentifier,copy.copyId))===priceConsumer,'PRICE_SALE_FRESH_CONSUMER');};
 await verify();
 const readMeta=async()=>{const rows=(await boundRequest().input('copy_id',sql.UniqueIdentifier,copy.copyId).query(metaSQL)).recordset;copyAssert(rows?.length===1,'SELECTED_SALE_NATIVE_METADATA');return metadata(copy,artifact,rows[0]);};
 const before=await readMeta();
 let nativeRequest=boundRequest().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('actor_id',sql.BigInt,a.id);
 if(invoiceId!==null){copyAssert(typeof invoiceId==='string'&&/^[1-9]\d{0,18}$/.test(invoiceId)&&BigInt(invoiceId)<=9223372036854775807n,'PRICE_SALE_HISTORY_ID');nativeRequest.input('invoice_id',sql.BigInt,invoiceId);}
 else nativeRequest.input('customer_id',sql.BigInt,selected.customerId).input('currency',sql.NVarChar(3),selected.currency).input('product_ids_json',sql.NVarChar(sql.MAX),JSON.stringify(selected.productIds));
 const rows=(await nativeRequest.execute(artifact.name)).recordset;
 copyAssert(rows?.length===1,'SELECTED_SALE_NATIVE_RESULT');const row=rows[0],after=await readMeta();
 if(collectionHistoryConsumer)copyAssert(Object.keys(row).sort().join()===['proof_json','actor_json','context_json','sessionId','transactionId','readerDefinitionHash','pricing_json','collection_history_proof_json'].toSorted().join(),'COLLECTION_HISTORY_READ_PROOF');
 copyAssert(row.readerDefinitionHash===artifact.definitionHash&&before.sessionId===row.sessionId&&before.sessionId===after.sessionId&&String(before.transactionId)===String(row.transactionId)&&String(before.transactionId)===String(after.transactionId)&&before.copyLockMode===after.copyLockMode,'SELECTED_SALE_SAME_NATIVE_TRANSACTION');
 const proof=parse(row.proof_json);assertIsolatedCopyReadProof(copy,proof);
 // The collection leaf separately proves all seven v13 module pins through
 // verify(). Its unchanged proof_json still describes the original copy
 // parent modules, not that new adjunct's seven-module lineage.
 const proofParents=collectionHistoryConsumer?priceConsumer.bundle.contextArtifact.parentHashes:artifact.parentHashes;
 copyAssert(isolatedCopyJSON(proof.definitionHashes)===isolatedCopyJSON(proofParents),'SELECTED_SALE_NATIVE_PARENT_PINS');
 const actual=parse(row.actor_json);assertIsolatedCopyActor(copy,a,actual,'sales.view');
 if(collectionHistoryConsumer)for(const permission of ['finance.view','customer.view','finance.collection'])assertIsolatedCopyActor(copy,a,actual,permission);
 const dto=parse(row.context_json),customer=copy.customers.find(c=>c.id===selected.customerId&&c.currency===selected.currency),native=dto.scope?.customer;
 if(priceConsumer)bindBusinessProductPriceSaleDTO({copy,transaction,artifact,dto,pricingJson:row.pricing_json,mode:invoiceId===null?'CURRENT':'HISTORY',invoiceId,...(collectionHistoryConsumer?{collectionHistoryProof:parse(row.collection_history_proof_json)}:{})});
 copyAssert(dto.meta?.schemaVersion==='melisa-selected-sale-context.v1'&&dto.meta.readOnly===true&&dto.writable===false&&dto.meta.businessDailyScopeHash===undefined&&dto.scope?.accounts?.length===0,'SELECTED_SALE_NATIVE_READ_ONLY');
 copyAssert(native&&['id','accountId','partyId','currency','sourceKey','sourceWitnessHash'].every(key=>native[key]===customer[key]),'SELECTED_SALE_NATIVE_CUSTOMER');
 copyAssert(isolatedCopyJSON(dto.rate)===isolatedCopyJSON(copy.currencyRates.find(r=>r.currency===selected.currency))&&typeof dto.revision==='string'&&/^[a-f0-9]{64}$/.test(dto.revision),'SELECTED_SALE_NATIVE_RATE');
 const products=dto.scope?.products;
 copyAssert(Array.isArray(products)&&products.length===selected.productIds.length&&new Set(products.map(p=>p.id)).size===products.length,'SELECTED_SALE_NATIVE_PRODUCTS');
 for(const p of products){
  const source=copy.products.find(s=>s.id===p.id&&selected.productIds.includes(s.id));
  copyAssert(source&&p.sourceKey===source.sourceKey&&p.sourceWitnessHash===source.sourceWitnessHash&&p.stockCode===source.stockCode&&p.costExact4===source.costExact4&&p.unit?.label==='ADET'&&p.unit.factorExact8==='1.00000000'&&workScaled(p.stockQuantityExact3,3)>=0n,'SELECTED_SALE_NATIVE_PRODUCT');
  const quotes=source.quotes.filter(q=>q.currency===selected.currency&&q.type==='sale'&&q.verified&&q.mainUnit);
  copyAssert(Array.isArray(p.prices)&&p.prices.length===quotes.length&&new Set(p.prices.map(q=>q.quoteId)).size===quotes.length&&p.prices.every(q=>quotes.some(s=>s.quoteId===q.quoteId&&s.currency===q.currency&&(priceConsumer?s.priceExact8===q.pricing?.sourcePriceExact8:s.priceExact8===q.unitPriceExact8))),'SELECTED_SALE_NATIVE_QUOTES');
 }
 copyAssert(dto.limits?.maxItems===200&&dto.limits.maxInvoiceAmountExact4===copy.businessInvoiceMaxExact4&&dto.policy?.currency===selected.currency&&dto.policy.maxItems===200&&dto.policy.quantity==='POSITIVE_WHOLE_MAIN_UNIT','SELECTED_SALE_NATIVE_POLICY');
 await verify();return bindIsolatedCopyOperationDTO(copy,dto);
}
