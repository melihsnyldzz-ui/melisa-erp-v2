import {AsyncLocalStorage} from 'node:async_hooks';
import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,assertIsolatedCopyReadProof,assertIsolatedCopyActor,bindIsolatedCopyOperationDTO,copyAssert,isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {workId,workScaled} from './workSalesModel.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {SELECTED_SALE_INTENT_READER,assertPreparedBusinessSelectedSaleWriteScope} from '../../../../scripts/canonical/shared-business-selected-sale-write-scope-sql.mjs';
import {getRegisteredBusinessProductPriceSaleRevision,verifyBusinessProductPriceSaleRevision} from '../../../../scripts/canonical/shared-business-product-price-sale-bootstrap.mjs';
import {assertPreparedBusinessProductPriceSaleArtifact} from '../../../../scripts/canonical/shared-business-product-price-sale-sql.mjs';
import {bindBusinessProductPriceSaleDTO} from './businessProductPriceSaleScope.mjs';

const scopes=new AsyncLocalStorage();
const permissions={sale_draft:'sales.create',sale_finalize:'sales.finalize',sale_cancel:'sales.cancel'};
const parse=value=>{copyAssert(typeof value==='string','SELECTED_SALE_INTENT_JSON');try{return JSON.parse(value);}catch{copyAssert(false,'SELECTED_SALE_INTENT_JSON');}};
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const SELECTED_SALE_WRITE_METADATA_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${SELECTED_SALE_INTENT_READER}',N'P'))),2) readerDefinitionHash;`;

function metadata(copy,artifact,row){
 assertIsolatedCopyIdentity(copy,row);
 copyAssert(row?.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&row.copyLockMode==='Exclusive'&&Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&(typeof row.transactionId!=='number'||Number.isSafeInteger(row.transactionId))&&row.readerDefinitionHash===artifact.definitionHash,'SELECTED_SALE_NATIVE_WRITE_PIN');
 return row;
}
function intentScope(copy,artifact,row,actor,operation,requestId,transaction,priceConsumer){
 const proof=parse(row?.proof_json);assertIsolatedCopyReadProof(copy,proof);
 copyAssert(isolatedCopyJSON(proof.definitionHashes)===isolatedCopyJSON(artifact.parentHashes),'SELECTED_SALE_NATIVE_PARENT_PINS');
 const actual=parse(row.actor_json);assertIsolatedCopyActor(copy,actor,actual,'sales.view');assertIsolatedCopyActor(copy,actor,actual,permissions[operation]);
 const payload=parse(row.payload_json),intent=parse(row.intent_json),dto=parse(row.context_json);
 if(priceConsumer)bindBusinessProductPriceSaleDTO({copy,transaction,artifact,dto,pricingJson:row.pricing_json,mode:operation==='sale_draft'?'CURRENT':'HISTORY',invoiceId:operation==='sale_draft'?null:workId(payload.id)});
 copyAssert(row.payload_json===isolatedCopyJSON(payload)&&row.payloadHash===isolatedCopyHash(payload),'SELECTED_SALE_CANONICAL_INTENT');
 copyAssert(payload.copyId===copy.copyId&&payload.sealHash===copy.sealHash&&payload.operationOrigin===copy.operationOrigin&&payload.actorId===actor.id&&payload.requestId===requestId&&payload.operation===operation,'SELECTED_SALE_INTENT_IDENTITY');
 const selected=selectBusinessSaleWriteIntent(copy,{customerId:payload.businessCustomerId,currency:payload.businessCurrency,productIds:payload.businessProductIds});
 copyAssert(payload.businessAccountId===selected.customerAccountId&&payload.businessSelectedSalePolicyHash===selected.policyHash&&payload.sourceSelectionHash===selected.sourceSelectionHash,'SELECTED_SALE_INTENT_SELECTION');
 const expected={schemaVersion:'melisa-selected-sale-native-intent.v1',profileHash:isolatedCopyHash(copy),copyId:copy.copyId,sealHash:copy.sealHash,actorId:actor.id,operation,requestId,payloadHash:row.payloadHash,customerId:selected.customerId,customerAccountId:selected.customerAccountId,currency:selected.currency,productIds:selected.productIds,policyHash:selected.policyHash,sourceSelectionHash:selected.sourceSelectionHash};
 copyAssert(Object.entries(expected).every(([key,value])=>isolatedCopyJSON(intent[key])===isolatedCopyJSON(value)),'SELECTED_SALE_OWNER_INTENT_REQUIRED');
 const invoiceId=operation==='sale_draft'?null:workId(payload.id);
 copyAssert((intent.invoiceId??null)===invoiceId&&intent.partyId===selected.partyId&&intent.rateExact8===selected.rateExact8&&intent.maxInvoiceAmountExact4===selected.maxInvoiceAmountExact4,'SELECTED_SALE_OWNER_ACCOUNT_POLICY');
 copyAssert(typeof dto.revision==='string'&&/^[a-f0-9]{64}$/.test(dto.revision)&&intent.selectedRevision===dto.revision&&(operation==='sale_draft'?payload.expectedRevision===dto.revision:typeof intent.invoiceRevision==='string'&&/^[a-f0-9]{64}$/.test(intent.invoiceRevision)&&intent.invoiceRevision===payload.expectedRevision),'SELECTED_SALE_OWNER_REVISION');
 const sourceCustomer=copy.customers.find(c=>c.id===selected.customerId&&c.currency===selected.currency),nativeCustomer=dto.scope?.customer;
 copyAssert(nativeCustomer&&['id','accountId','partyId','currency','sourceKey','sourceWitnessHash'].every(key=>nativeCustomer[key]===sourceCustomer[key]),'SELECTED_SALE_NATIVE_CUSTOMER');
 copyAssert(isolatedCopyJSON(dto.rate)===isolatedCopyJSON(copy.currencyRates.find(r=>r.currency===selected.currency)),'SELECTED_SALE_NATIVE_RATE');
 const products=dto.scope?.products;
 copyAssert(Array.isArray(products)&&products.length===selected.productIds.length&&new Set(products.map(p=>p.id)).size===products.length,'SELECTED_SALE_NATIVE_PRODUCTS');
 for(const p of products){
  const source=copy.products.find(s=>s.id===p.id&&selected.productIds.includes(s.id));
  copyAssert(source&&p.sourceKey===source.sourceKey&&p.sourceWitnessHash===source.sourceWitnessHash&&p.stockCode===source.stockCode&&p.costExact4===source.costExact4&&p.unit?.label==='ADET'&&p.unit.factorExact8==='1.00000000'&&workScaled(p.stockQuantityExact3,3)>=0n,'SELECTED_SALE_NATIVE_PRODUCT');
  const quotes=source.quotes.filter(q=>q.currency===selected.currency&&q.type==='sale'&&q.verified&&q.mainUnit);
  copyAssert(Array.isArray(p.prices)&&p.prices.length===quotes.length&&new Set(p.prices.map(q=>q.quoteId)).size===quotes.length&&p.prices.every(q=>quotes.some(s=>s.quoteId===q.quoteId&&s.currency===q.currency&&(priceConsumer?s.priceExact8===q.pricing?.sourcePriceExact8:s.priceExact8===q.unitPriceExact8))),'SELECTED_SALE_NATIVE_QUOTES');
 }
 return freeze({...selected,operation,actorId:actor.id,requestId,invoiceId,payloadHash:row.payloadHash});
}

// No DTO setter. Called only after the existing owner begin has sealed an
// intent, inside an already-authorized isolated write transaction. Same UUID
// journal replay is resolved before reaching this function.
export async function withBusinessSelectedSaleWriteScope({copy,transaction,sql,request,artifact,actor,operation,requestId,priceConsumer=null},fn){
 assertIsolatedCopyContext(copy);
 if(priceConsumer){copyAssert(priceConsumer===getRegisteredBusinessProductPriceSaleRevision(copy),'PRICE_SALE_SERVER_CONSUMER');artifact=priceConsumer.bundle.writeScopeArtifact;assertPreparedBusinessProductPriceSaleArtifact(artifact,copy,'intent');}
 else assertPreparedBusinessSelectedSaleWriteScope(artifact,copy);
 copyAssert(isolatedCopyTransactionContext(transaction)===copy&&typeof request==='function'&&typeof fn==='function'&&Object.hasOwn(permissions,operation),'SELECTED_SALE_WRITE_TRANSACTION');
 const a=freeze({id:workId(String(actor?.id)),permissions:[...(actor?.permissions??[])]});
 copyAssert(a.permissions.includes('sales.view')&&a.permissions.includes(permissions[operation]),'ISOLATED_COPY_FORBIDDEN',403);
 copyAssert(typeof requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId),'SELECTED_SALE_INTENT_REQUEST');
 copyAssert(!scopes.getStore()?.active,'SELECTED_SALE_NESTED_WRITE_SCOPE');
 const boundRequest=()=>{const r=request();if(priceConsumer)copyAssert(r.parent===transaction,'PRICE_SALE_BOUND_REQUEST');return r;};
 const metaSQL=priceConsumer?SELECTED_SALE_WRITE_METADATA_SQL.replace(`N'${SELECTED_SALE_INTENT_READER}'`,`N'${artifact.name}'`):SELECTED_SALE_WRITE_METADATA_SQL;
 const verify=async()=>{if(priceConsumer)copyAssert(await verifyBusinessProductPriceSaleRevision(copy,boundRequest().input('copy_id',sql.UniqueIdentifier,copy.copyId),{write:true})===priceConsumer,'PRICE_SALE_FRESH_CONSUMER');};
 await verify();
 const readMeta=async()=>{const rows=(await boundRequest().input('copy_id',sql.UniqueIdentifier,copy.copyId).query(metaSQL)).recordset;copyAssert(rows?.length===1,'SELECTED_SALE_NATIVE_METADATA');return metadata(copy,artifact,rows[0]);};
 const before=await readMeta();
 const rows=(await boundRequest().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('actor_id',sql.BigInt,a.id).input('request_id',sql.UniqueIdentifier,requestId).input('operation',sql.NVarChar(40),operation).execute(artifact.name)).recordset;
 copyAssert(rows?.length===1,'SELECTED_SALE_NATIVE_INTENT_RESULT');
 const row=rows[0],after=await readMeta();
 copyAssert(row.readerDefinitionHash===artifact.definitionHash&&before.sessionId===row.sessionId&&before.sessionId===after.sessionId&&String(before.transactionId)===String(row.transactionId)&&String(before.transactionId)===String(after.transactionId),'SELECTED_SALE_SAME_NATIVE_TRANSACTION');
 const value={copy,transaction,active:true,selection:intentScope(copy,artifact,row,a,operation,requestId,transaction,priceConsumer)};
 const dto=parse(row.context_json);
 if(priceConsumer)bindBusinessProductPriceSaleDTO({copy,transaction,artifact,dto,pricingJson:row.pricing_json,mode:operation==='sale_draft'?'CURRENT':'HISTORY',invoiceId:operation==='sale_draft'?null:value.selection.invoiceId});
 bindIsolatedCopyOperationDTO(copy,dto);await verify();
 try{return await scopes.run(value,()=>fn(dto));}finally{value.active=false;}
}
export function getBusinessSelectedSaleWriteScope(copy,transaction){
 const value=scopes.getStore();if(!value?.active)return null;
 copyAssert(value.copy===copy&&value.transaction===transaction&&isolatedCopyTransactionContext(transaction)===copy,'SELECTED_SALE_SCOPE_TRANSACTION_CHANGED');
 return value.selection;
}
