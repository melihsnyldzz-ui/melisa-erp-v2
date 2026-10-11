import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,assertIsolatedCopyActor,assertIsolatedCopyReadProof,bindIsolatedCopyOperationDTO,BUSINESS_COPY_DATABASE,copyAssert,isolatedCopyHash,isolatedCopyJSON,getBusinessDailyHomeReadRevisions} from './isolatedOperationCopyContext.mjs';
import {workKeys,workId,workScaled,workBusinessCurrencyRate,workSelection,workSalePreview,workHash} from './workSalesModel.mjs';
import {verifyBusinessDailyHomeReadProof} from './businessDailyHomeReadProof.mjs';
import {verifyBusinessDailyNativeCheck} from './businessDailyNativeCheck.mjs';
import {assertPreparedBusinessSelectedSaleContext,SELECTED_SALE_READER} from '../../../../scripts/canonical/shared-business-selected-sale-preview-sql.mjs';

const selections=new WeakMap(),contexts=new WeakMap();
const hex=v=>typeof v==='string'&&/^[A-Fa-f0-9]{64}$/.test(v);
const frozen=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))frozen(x);Object.freeze(v);}return v;};
const parse=v=>{copyAssert(typeof v==='string','SELECTED_SALE_NATIVE_JSON');try{return JSON.parse(v);}catch{copyAssert(false,'SELECTED_SALE_NATIVE_JSON');}};

// A finite SOURCE sale selection, not a daily write grant or a cash selection.
export function selectBusinessSalePreview(copy,input){
 assertIsolatedCopyContext(copy);workKeys(input,['customerId','currency','productIds']);
 copyAssert(copy.target.database===BUSINESS_COPY_DATABASE,'SELECTED_SALE_DB02_ONLY');
 const customerId=workId(input.customerId),currency=input.currency;
 const rate=workBusinessCurrencyRate(copy,currency);
 const customers=copy.customers.filter(p=>p.id===customerId&&p.currency===currency);
 copyAssert(customers.length===1&&customers[0].sourceKnown===true&&customers[0].accountIdentityVerified===true&&customers[0].sourceAccountWitnessCount===1&&customers[0].openingHumanAccepted===false&&!customers[0].quarantined&&!customers[0].excludedLL&&hex(customers[0].sourceWitnessHash)&&!['591','592'].includes(customerId),'SELECTED_SALE_SOURCE_CUSTOMER');
 copyAssert(Array.isArray(input.productIds)&&input.productIds.length>=1&&input.productIds.length<=2&&new Set(input.productIds).size===input.productIds.length,'SELECTED_SALE_ITEMS',400);
 const productIds=input.productIds.map(workId);
 const products=productIds.map(id=>{
  const matches=copy.products.filter(p=>p.id===id);copyAssert(matches.length===1,'SELECTED_SALE_SOURCE_PRODUCT');const p=matches[0];
  copyAssert(p.identityVerified===true&&p.sourceKnown===true&&!p.quarantined&&hex(p.sourceWitnessHash)&&p.unit==='ADET'&&p.unitFactorExact8==='1.00000000'&&workScaled(p.costExact4,4)>0n&&workScaled(p.stockUnitCostTryExact8,8)===workScaled(p.costExact4,4)*10000n,'SELECTED_SALE_SOURCE_COST_UNIT');
  const quotes=p.quotes?.filter(q=>q.currency===currency&&q.type==='sale'&&q.verified===true&&q.mainUnit===true);
  copyAssert(quotes?.length>0&&new Set(quotes.map(q=>q.quoteId)).size===quotes.length&&quotes.every(q=>p.priceIds.includes(q.quoteId)&&workScaled(q.priceExact8,8)>0n&&hex(q.nativeRowHash)&&hex(q.bindingHash)),'SELECTED_SALE_SOURCE_QUOTE');
  return {id:p.id,sourceKey:p.sourceKey,sourceWitnessHash:p.sourceWitnessHash,costExact4:p.costExact4,quotes};
 });
 const source={copyId:copy.copyId,sealHash:copy.sealHash,customer:customers[0],currency,productIds,products,rate};
 const selected=frozen({customerId,customerAccountId:customers[0].accountId,currency,productIds:[...productIds],copyId:copy.copyId,sealHash:copy.sealHash,sourceSelectionHash:isolatedCopyHash(source)});
 selections.set(selected,{copy,source});return selected;
}

export const SELECTED_SALE_METADATA_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${SELECTED_SALE_READER}',N'P'))),2) readerDefinitionHash;`;

function validateMetadata(copy,artifact,row){
 assertIsolatedCopyIdentity(copy,row);
 copyAssert(row?.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&row.copyLockMode==='Shared'&&Number.isInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&row.readerDefinitionHash===artifact.definitionHash,'SELECTED_SALE_NATIVE_READ_PIN');
 return row;
}
function nativeContext(copy,selected,artifact,row,actor){
 const selectedSource=selections.get(selected);copyAssert(selectedSource?.copy===copy,'SELECTED_SALE_SERVER_SELECTION_REQUIRED');
 assertIsolatedCopyReadProof(copy,parse(row?.proof_json));
 const actual=parse(row?.actor_json);assertIsolatedCopyActor(copy,actor,actual,'sales.view');assertIsolatedCopyActor(copy,actor,actual,'sales.create');
 copyAssert(row.readerDefinitionHash===artifact.definitionHash,'SELECTED_SALE_NATIVE_READER_PROOF');
 const dto=parse(row?.context_json),{source}=selectedSource;
 copyAssert(dto?.meta?.schemaVersion==='melisa-selected-sale-context.v1'&&dto.meta.readOnly===true&&dto.writable===false&&dto.meta.businessDailyScopeHash===undefined&&dto.scope?.accounts?.length===0,'SELECTED_SALE_PREVIEW_ONLY');
 const p=dto.policy;
 copyAssert(p?.basis==='SOURCE_BUSINESS_INVOICE_DOCUMENT_AMOUNT_PREVIEW_ONLY'&&p.currency===selected.currency&&copy.businessInvoiceMaxExact4==='20000.0000'&&p.maxInvoiceAmountExact4===copy.businessInvoiceMaxExact4&&p.maxItems===2&&p.maxQuantityPerLine===5&&p.existingWriterCurrency==='TRY'&&p.existingWriterMaxInvoiceAmountExact4==='500.0000'&&p.dailyScopeHash===artifact.dailyScopeHash&&p.dailyRevisionHash===artifact.dailyRevisionHash,'SELECTED_SALE_POLICY_PROVENANCE');
 copyAssert(isolatedCopyJSON(dto.rate)===isolatedCopyJSON(source.rate),'SELECTED_SALE_NATIVE_RATE');
 const customer=dto.scope.customer;
 copyAssert(customer&&['id','accountId','partyId','sourceKey','sourceWitnessHash','currency'].every(k=>customer[k]===source.customer[k])&&!Object.keys(customer).some(k=>/balance|opening/i.test(k)),'SELECTED_SALE_NATIVE_CUSTOMER');
 copyAssert(Array.isArray(dto.scope.products)&&dto.scope.products.length===selected.productIds.length&&new Set(dto.scope.products.map(p=>p.id)).size===selected.productIds.length,'SELECTED_SALE_NATIVE_PRODUCTS');
 const privateCosts={};
 for(const native of dto.scope.products){
  const product=source.products.find(p=>p.id===native.id);
  copyAssert(product&&native.sourceKey===product.sourceKey&&native.sourceWitnessHash===product.sourceWitnessHash&&native.costExact4===product.costExact4&&workScaled(native.stockQuantityExact3,3)>=0n,'SELECTED_SALE_NATIVE_PRODUCT_WITNESS');
  copyAssert(Array.isArray(native.prices)&&native.prices.length===product.quotes.length&&new Set(native.prices.map(q=>q.quoteId)).size===native.prices.length&&native.prices.every(q=>product.quotes.some(s=>s.quoteId===q.quoteId&&s.currency===q.currency&&s.priceExact8===q.unitPriceExact8)),'SELECTED_SALE_NATIVE_QUOTES');
  privateCosts[native.id]=native.costExact4;delete native.costExact4;
 }
 dto.limits={maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:copy.businessInvoiceMaxExact4};
 dto.meta.sourceSelectionHash=selected.sourceSelectionHash;
 bindIsolatedCopyOperationDTO(copy,dto);
 contexts.set(dto,{copy,selected,privateCosts,actorId:actual.id});return frozen(dto);
}

// The caller owns an existing SERIALIZABLE transaction and Shared copy lock.
// The same request factory must stay on that transaction; before/after/native
// SPID+transaction IDs make an accidental pool request fail closed.
export async function readBusinessSelectedSalePreviewContext({copy,sql,request,artifact,selected,actor}){
 assertPreparedBusinessSelectedSaleContext(artifact,copy);
 copyAssert(selections.get(selected)?.copy===copy&&getBusinessDailyHomeReadRevisions(copy),'SELECTED_SALE_SERVER_SELECTION_REQUIRED');
 copyAssert(sql&&typeof request==='function','SELECTED_SALE_REQUEST_REQUIRED');
 const metadata=async()=>{const result=await request().input('copy_id',sql.UniqueIdentifier,copy.copyId).query(SELECTED_SALE_METADATA_SQL);copyAssert(result.recordset?.length===1,'SELECTED_SALE_NATIVE_METADATA');return validateMetadata(copy,artifact,result.recordset[0]);};
 const before=await metadata();
 await verifyBusinessDailyNativeCheck(copy,request());
 copyAssert(await verifyBusinessDailyHomeReadProof(copy,request().input('copy_id',sql.UniqueIdentifier,copy.copyId),{domain:'inbound',write:false,automatic:null}),'SELECTED_SALE_REGISTERED_PROOF_REQUIRED');
 const result=await request().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('actor_id',sql.BigInt,workId(String(actor?.id))).input('customer_id',sql.BigInt,selected.customerId).input('currency',sql.NVarChar(3),selected.currency).input('product_ids_json',sql.NVarChar(sql.MAX),JSON.stringify(selected.productIds)).execute(artifact.name);
 copyAssert(result.recordset?.length===1,'SELECTED_SALE_NATIVE_RESULT');const row=result.recordset[0];
 const after=await metadata();
 copyAssert(before.sessionId===after.sessionId&&before.sessionId===row.sessionId&&String(before.transactionId)===String(after.transactionId)&&String(before.transactionId)===String(row.transactionId),'SELECTED_SALE_SAME_NATIVE_TRANSACTION');
 return nativeContext(copy,selected,artifact,row,actor);
}

export function businessSelectedSalePreview(input,context,actor){
 const binding=contexts.get(context);copyAssert(binding&&String(actor?.id)===binding.actorId&&actor.permissions?.includes('sales.create'),'SELECTED_SALE_BOUND_PREVIEW_REQUIRED',403);
 const selection=workSelection(input,{allowBusinessCurrencies:true}),s=binding.selected;
 copyAssert(selection.customerId===s.customerId&&selection.currency===s.currency&&selection.items.length===s.productIds.length&&selection.items.every(p=>s.productIds.includes(p.productId)),'SELECTED_SALE_EXACT_SELECTION');
 const {previewHash,...calculated}=workSalePreview(selection,context);
 const value={...calculated,schemaVersion:'melisa-selected-sale-preview.v1',writable:false,writeAuthorized:false,sourceSelectionHash:s.sourceSelectionHash,policy:context.policy};
 return frozen({...value,previewHash:workHash(value)});
}
