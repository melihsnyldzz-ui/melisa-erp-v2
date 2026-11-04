import {assertIsolatedCopyContext,bindIsolatedCopyOperationDTO,BUSINESS_COPY_DATABASE,isolatedCopyOperationDTOContext} from './isolatedOperationCopyContext.mjs';
import {loadBusinessSelectedSaleJournal} from './workTradeStore.mjs';
import {createWorkCollectionService} from './workCollectionService.mjs';
import {workId,workScaled,workFail,workKeys,workRequestId,workRevision,workDate,workReason} from './workSalesModel.mjs';
import {withSelectedSaleCollectionReadBridge,withSelectedCollectionNativeBridge,isIsolatedSelectedCollectionNativeStore,isolatedCopySelectedCollectionRequestBody,assertIsolatedCopyEffectProof} from './isolatedOperationCopyStoreFactory.mjs';

import {getBusinessSelectedCollectionWriteScope} from './businessSelectedCollectionWriteScope.mjs';
import {getRegisteredBusinessSelectedCollectionRevision,verifyBusinessSelectedCollectionRevision} from '../../../../scripts/canonical/shared-business-selected-collection-revision-bootstrap.mjs';

// Deliberately unregistered preparation adapter. There is no default store,
// connection, route, native intent or authority to enable the DB02 writer.
// The injected isolated transaction owns the existing journal/effects methods.
const fail=(code='SOURCE_COLLECTION_PREPARATION_SCOPE',statusCode=409)=>{throw Object.assign(new Error('Kaynak satış tahsilat hazırlığı doğrulanamadı.'),{code,statusCode});};
const requireValue=(v,code,status)=>{if(!v)fail(code,status);};
export const SOURCE_COLLECTION_COLLECTOR_SQL=`SELECT CONVERT(varchar(20),u.id) actorId,r.code roleCode,CONVERT(bit,u.is_active) userActive,CONVERT(bit,r.is_active) roleActive,p.permission_key permissionKey,CONVERT(bit,p.can_view) canView
FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id LEFT JOIN dbo.permissions p ON p.role_id=r.id WHERE u.id=@actor;`;
export const SOURCE_COLLECTION_ACCOUNT_SQL=`SELECT CONVERT(varchar(20),a.id) id,a.currency_code currency,CONVERT(bit,a.is_active) isActive,a.account_type type FROM dbo.finance_accounts a WITH(HOLDLOCK) WHERE a.id=@account;`;
const rights=['finance.view','customer.view','finance.collection'];
const preparedServices=new WeakSet();
export const isBusinessSelectedSaleCollectionPreparationService=service=>service!==null&&typeof service==='object'&&preparedServices.has(service);

async function authority(c,actor,cancelling){
 const copy=assertIsolatedCopyContext(c.copyContext);
 requireValue(copy.target.database===BUSINESS_COPY_DATABASE&&c.transaction&&typeof c.request==='function'&&c.sql,'SOURCE_COLLECTION_PREPARATION_CONTEXT',503);
 requireValue(String(actor?.id)==='16'&&actor?.role?.code==='isolated_test_ilker'&&!actor.testAdminSession&&actor.isAdmin!==true&&Array.isArray(actor.permissions),'SOURCE_COLLECTION_PREPARATION_FORBIDDEN',403);
 requireValue(copy.actors.some(a=>a.id==='16'&&a.role==='isolated_test_ilker')&&copy.actors.some(a=>a.id==='15'&&a.role==='isolated_test_sales'),'SOURCE_COLLECTION_PREPARATION_FORBIDDEN',403);
 const request=()=>{const r=c.request();requireValue(r?.parent===c.transaction,'SOURCE_COLLECTION_PREPARATION_TRANSACTION',503);return r;};
 const rows=(await request().input('actor',c.sql.BigInt,'16').query(SOURCE_COLLECTION_COLLECTOR_SQL)).recordset;
 requireValue(Array.isArray(rows)&&rows.length>0&&rows.every(r=>r.actorId==='16'&&r.roleCode==='isolated_test_ilker'&&r.userActive===true&&r.roleActive===true),'SOURCE_COLLECTION_PREPARATION_FORBIDDEN',403);
 const actual=new Set(rows.filter(r=>r.canView===true).map(r=>r.permissionKey)),has=k=>actual.has(k)&&actor.permissions.includes(k);
 requireValue(rights.every(has)&&(!cancelling||has('finance.collection.cancel')),'SOURCE_COLLECTION_PREPARATION_FORBIDDEN',403);
 requireValue(isolatedCopyOperationDTOContext(c.context)===copy,'SOURCE_COLLECTION_PREPARATION_CONTEXT',503);
 return {copy,request,canCancel:has('finance.collection.cancel')};
}

export async function prepareBusinessSelectedSaleCollection(c,actor,invoiceId,{cancelling=false}={}){
 workId(invoiceId);
 const {copy,request,canCancel}=await authority(c,actor,cancelling);
 // Creator15 is a FIXED journal verifier identity, not impersonation of the
 // collector. Its result supplies no finance permission. Collector16 was
 // independently checked above, under the very same supplied transaction.
 const original=await loadBusinessSelectedSaleJournal({copy,actor:{id:'15'},request,sql:c.sql,id:invoiceId,readPriceHistory:c.readPriceHistory});
 const s=original.selection,h=original.record.invoice;
 requireValue(original.creation.invoiceId===invoiceId&&original.creation.actorId==='15'&&h.createdBy==='15'&&h.status==='finalized'&&s.currency==='TRY');
 const customer=copy.customers.filter(p=>p.id===s.customerId&&p.accountId===s.customerAccountId&&p.currency===s.currency);
 requireValue(customer.length===1&&c.context.scope.customer.id===s.customerId&&c.context.scope.customer.accountId===s.customerAccountId&&c.context.scope.customer.currency===s.currency);
 const accounts=c.context.scope.accounts;
 requireValue(Array.isArray(accounts)&&accounts.length===1&&copy.financeAccounts.filter(a=>a.id===accounts[0].id&&a.currency===s.currency).length===1&&accounts[0].currency===s.currency);
 const sealedAccount=copy.financeAccounts.find(a=>a.id===accounts[0].id);
 requireValue(['cash','bank'].includes(sealedAccount.type)&&accounts[0].type===sealedAccount.type);
 const currentAccounts=(await request().input('account',c.sql.BigInt,accounts[0].id).query(SOURCE_COLLECTION_ACCOUNT_SQL)).recordset;
 requireValue(Array.isArray(currentAccounts)&&currentAccounts.length===1&&currentAccounts[0].id===accounts[0].id&&currentAccounts[0].currency===s.currency&&currentAccounts[0].isActive===true&&currentAccounts[0].type===sealedAccount.type,'SOURCE_COLLECTION_PREPARATION_ACCOUNT');
 const context=bindIsolatedCopyOperationDTO(copy,{...c.context,capabilities:{...c.context.capabilities,canCollect:true,canCancelCollection:canCancel}});
 const invoice=async id=>{
  requireValue(id===invoiceId);
  const current=await c.invoice(id);
  requireValue(current.id===invoiceId&&current.customerId===s.customerId&&current.currency===s.currency&&current.status==='finalized'&&current.grandTotalExact4===h.grandTotalExact4);
  const total=workScaled(h.grandTotalExact4,4),received=workScaled(current.collections?.receivedExact4,4),outstanding=workScaled(current.collections?.outstandingExact4,4);
  requireValue(total>0n&&received>=0n&&outstanding>=0n&&received+outstanding===total);
  return current;
 };
 await invoice(invoiceId);
 return {context,invoice,proof:Object.freeze({preparationOnly:true,copyId:copy.copyId,invoiceId,creatorId:'15',collectorId:'16',customerId:s.customerId,customerAccountId:s.customerAccountId,accountId:accounts[0].id,currency:s.currency,creationRequestId:original.creation.requestId,policyHash:s.policyHash,sourceSelectionHash:s.sourceSelectionHash})};
}

// Read-only result comparison. The input is never returned or added to a URL;
// only a server-owned selected SOURCE journal with its intact effect proof can
// match. Missing/ambiguous rows and transport errors remain UNKNOWN.
function retainedSelectedCollection(input){
 workKeys(input,['operation','invoiceId','collectionId','body']);
 const operation=input.operation,invoiceId=workId(input.invoiceId),body=input.body;
 if(operation==='collection_create'){
  if(input.collectionId!==undefined)fail();workKeys(body,['requestId','previewHash','expectedRevision','invoiceId','accountId','amountExact4','documentDate']);
  if(workRequestId(body.requestId)!==body.requestId||workRevision(body.previewHash)!==body.previewHash||workRevision(body.expectedRevision)!==body.expectedRevision||workId(body.invoiceId)!==invoiceId||workId(body.accountId)!==body.accountId||workScaled(body.amountExact4,4)<=0n||workDate(body.documentDate)!==body.documentDate)fail();
  return {operation,invoiceId,payload:{requestId:body.requestId,previewHash:body.previewHash,expectedRevision:body.expectedRevision,invoiceId:body.invoiceId,accountId:body.accountId,amountExact4:body.amountExact4,documentDate:body.documentDate}};
 }
 if(operation==='collection_cancel'){
  const id=workId(input.collectionId);workKeys(body,['requestId','expectedRevision','reason','documentDate']);
  if(workRequestId(body.requestId)!==body.requestId||workRevision(body.expectedRevision)!==body.expectedRevision||workReason(body.reason)!==body.reason||workDate(body.documentDate)!==body.documentDate)fail();
  return {operation,invoiceId,payload:{id,requestId:body.requestId,expectedRevision:body.expectedRevision,reason:body.reason,documentDate:body.documentDate}};
 }
 fail();
}
const SELECTED_COLLECTION_JOURNAL_READ_SQL='SELECT actor_id,operation,payload_hash,payload_json,response_json,effect_proof_json FROM dbo.stage4_copy_requests WHERE copy_id=@copy_id AND request_id=@request_id AND actor_id=@actor_id;';
const SELECTED_COLLECTION_LINK_READ_SQL='SELECT CONVERT(varchar(20),movement_id) movementId,CONVERT(varchar(20),invoice_id) invoiceId,CONVERT(varchar(20),original_id) originalId FROM dbo.work_collection_links WHERE request_id=@request_id AND invoice_id=@invoice_id;';
async function verifySelectedCollectionRequest(withContext,input,actor){
 try{
  const retained=retainedSelectedCollection(input);
  return await withContext(actor,async c=>{
   const {copy,request}=await authority(c,actor,retained.operation==='collection_cancel');
   const registered=getRegisteredBusinessSelectedCollectionRevision(copy);requireValue(registered&&await verifyBusinessSelectedCollectionRevision(copy,request().input('copy_id',c.sql.UniqueIdentifier,copy.copyId),{write:false})===registered);
   const prepared=await prepareBusinessSelectedSaleCollection(c,actor,retained.invoiceId,{cancelling:retained.operation==='collection_cancel'});
   requireValue(retained.payload.documentDate===copy.date);
   const keys=['invoiceId','creatorId','collectorId','customerId','customerAccountId','accountId','currency','creationRequestId','policyHash','sourceSelectionHash'];
   const selection=Object.fromEntries(keys.map(k=>[k,prepared.proof[k]]));
   const expected=isolatedCopySelectedCollectionRequestBody(copy,actor,retained.operation,retained.payload,selection);
   const result=await request().input('copy_id',c.sql.UniqueIdentifier,copy.copyId).input('request_id',c.sql.UniqueIdentifier,expected.requestId).input('actor_id',c.sql.BigInt,'16').query(SELECTED_COLLECTION_JOURNAL_READ_SQL);
   const rows=result?.recordset;requireValue(Array.isArray(rows)&&rows.length===1);const row=rows[0];
   requireValue(String(row.actor_id)==='16'&&row.operation===retained.operation&&row.payload_hash===expected.hash&&row.payload_json===expected.json);
   assertIsolatedCopyEffectProof(row.effect_proof_json,copy,actor,retained.operation,expected);
   requireValue(typeof row.response_json==='string'&&row.response_json.length<=262144);let response;try{response=JSON.parse(row.response_json);}catch{fail();}
   const i=response?.invoice,r=response?.collection;
   requireValue(response.requestId===expected.requestId&&i?.id===selection.invoiceId&&i.customerId===selection.customerId&&i.currency===selection.currency&&r?.invoiceId===selection.invoiceId&&r.accountId===selection.accountId&&r.currency===selection.currency&&r.documentDate===retained.payload.documentDate);
   if(retained.operation==='collection_create')requireValue(r.status==='active'&&r.amountExact4===retained.payload.amountExact4);
   else requireValue(r.id===retained.payload.id&&r.status==='cancelled');
   const live=await c.collection(workId(r.id));
   requireValue(live&&live.id===r.id&&live.invoiceId===selection.invoiceId&&live.accountId===selection.accountId&&live.currency===selection.currency&&live.amountExact4===r.amountExact4&&live.documentDate===r.documentDate&&(retained.operation!=='collection_cancel'||live.status==='cancelled'));
   const linked=await request().input('request_id',c.sql.UniqueIdentifier,expected.requestId).input('invoice_id',c.sql.BigInt,selection.invoiceId).query(SELECTED_COLLECTION_LINK_READ_SQL);
   requireValue(Array.isArray(linked?.recordset)&&linked.recordset.length===1);const link=linked.recordset[0];
   requireValue(link.invoiceId===selection.invoiceId&&(retained.operation==='collection_create'?link.movementId===r.id&&link.originalId===null:link.originalId===r.id&&workId(live.reversalId)===link.movementId));
   requireValue(await verifyBusinessSelectedCollectionRevision(copy,request().input('copy_id',c.sql.UniqueIdentifier,copy.copyId),{write:false})===registered);
   return Object.freeze({status:'MATCHED'});
  },{write:false});
 }catch{return Object.freeze({status:'UNKNOWN'});}
}

export function createBusinessSelectedSaleCollectionPreparation({withContext}={}){
 requireValue(typeof withContext==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
 // No new finance or idempotence algorithm: the existing service validates
 // money, dates, revisions, preview hashes and invokes the supplied existing
 // collection methods. The isolated transaction's journal owns UUID replay.
 const checkAmount=amountExact4=>{
  if(workScaled(amountExact4,4)>5000000n)workFail('WORK_OPERATION_LIMIT','Kaynak satış tahsilatı işlem başına 500 TRY sınırını aşamaz.',409);
 };
 const getStore=async previewAmount=>({
  read:(actor,fn)=>withContext(actor,async c=>{
   const a=await authority(c,actor,false);
   if(previewAmount!==undefined)checkAmount(previewAmount);
   const context=bindIsolatedCopyOperationDTO(a.copy,{...c.context,capabilities:{...c.context.capabilities,canCollect:true,canCancelCollection:a.canCancel}});
   return fn({...c,context,invoice:async id=>(await prepareBusinessSelectedSaleCollection(c,actor,id)).invoice(id)});
  },{write:false}),
  mutate:(actor,operation,payload,fn)=>withContext(actor,async c=>{
   requireValue(['collection_create','collection_cancel'].includes(operation));
   const cancelling=operation==='collection_cancel';
   // Authorize BEFORE reading an original movement or replay journal.
   await authority(c,actor,cancelling);
   if(!cancelling)checkAmount(payload.amountExact4);
   const prior=cancelling?await c.collection(payload.id):null;
   const id=cancelling?prior.invoiceId:payload.invoiceId;
   const prepared=await prepareBusinessSelectedSaleCollection(c,actor,id,{cancelling});
   if(cancelling)requireValue(prior.currency===prepared.proof.currency&&prior.accountId===prepared.proof.accountId);
   requireValue(typeof c.journal==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
   const execute=()=>fn({...c,context:prepared.context,invoice:prepared.invoice});
   return typeof c.selectedCollectionJournal==='function'?c.selectedCollectionJournal(operation,payload,prepared.proof,execute):c.journal(operation,payload,execute);
  },{write:true,operation,payload}),
 });
 const base=createWorkCollectionService({getStore});
 // A per-call store closure binds only this preview amount; concurrent requests
 // cannot exchange policy inputs. Mutation checks its validated payload below.
 const service=Object.freeze({...base,preview:(input,actor)=>createWorkCollectionService({getStore:()=>getStore(input.amountExact4)}).preview(input,actor),verifyRetained:(input,actor)=>verifySelectedCollectionRequest(withContext,input,actor)});
 preparedServices.add(service);
 return service;
}

// Explicit server-only READ/PREVIEW bridge. No default connection/route and no
// mutable writer DTO escapes. Existing factory identity/READY/actor checks own
// the read transaction; the preparation repeats current collection authority.
export function createBusinessSelectedSaleCollectionReadPreparation({getStore}={}){
 requireValue(typeof getStore==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
 const service=createBusinessSelectedSaleCollectionPreparation({withContext:async(actor,fn)=>{
  const store=await getStore();requireValue(typeof store?.readSelectedSaleCollectionPreparation==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
  return store.readSelectedSaleCollectionPreparation(actor,bridge=>withSelectedSaleCollectionReadBridge(bridge,async native=>{
   // Only an earned factory-owned collection-history reader may admit prices.
   // Absence retains the explicit rejection; ordinary HISTORY is never used.
   const readPriceHistory=typeof native.readPriceHistory==='function'?native.readPriceHistory:()=>fail('WORK_SELECTED_SALE_PRICING_HISTORY_REQUIRED');
   const c={copyContext:native.copyContext,context:native.context,transaction:native.transaction,sql:native.sql,request:native.request,readPriceHistory};
   // Verify creator records inside this same read transaction, independently
   // of the collector16's current permissions and finance-account checks.
   let verified;
   c.invoice=async id=>{verified=await loadBusinessSelectedSaleJournal({copy:native.copyContext,actor:{id:'15'},request:native.request,sql:native.sql,id,readPriceHistory});return native.invoice(verified);};
   const result=await fn(c);requireValue(verified);
   return {...result,preparationProof:Object.freeze({creatorId:'15',collectorId:'16',copyId:native.copyContext.copyId,sealHash:native.copyContext.sealHash,invoiceId:verified.creation.invoiceId,creationRequestId:verified.creation.requestId,policyHash:verified.selection.policyHash,sourceSelectionHash:verified.selection.sourceSelectionHash})};
  }));
 }});
 return Object.freeze({
  preview:async(input,actor)=>Object.freeze({...await service.preview(input,actor),preparationOnly:true,readOnly:true,capabilities:Object.freeze({canCollect:false,canCancelCollection:false})}),
  collect:async()=>fail('ISOLATED_COPY_READ_ONLY',403),
  cancel:async()=>fail('ISOLATED_COPY_READ_ONLY',403),
 });
}


// Explicit opt-in source adapter: no default runtime, route or installed grant.
// Only the native factory can mint a transaction-local bridge. Its owner begin
// and effects are selected by that bridge; the synthetic preparation factory
// cannot substitute an arbitrary SQL request or collection writer.
export function createBusinessSelectedSaleCollectionNativePreparation({getStore}={}){
 requireValue(typeof getStore==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
 return createBusinessSelectedSaleCollectionPreparation({withContext:async(actor,fn,{write=false}={})=>{
  const store=await getStore();requireValue(isIsolatedSelectedCollectionNativeStore(store),'SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
  return store.withSelectedCollectionNative(actor,write,bridge=>withSelectedCollectionNativeBridge(bridge,async native=>{
   const domain=native.domain;
   requireValue(domain&&typeof domain.readSelectedSaleCollectionInvoice==='function');
   const readPriceHistory=typeof native.readPriceHistory==='function'?native.readPriceHistory:()=>fail('WORK_SELECTED_SALE_PRICING_HISTORY_REQUIRED');
   const c={copyContext:native.copyContext,context:native.context,transaction:native.transaction,sql:native.sql,request:native.request,readPriceHistory};
   c.invoice=async id=>domain.readSelectedSaleCollectionInvoice(await loadBusinessSelectedSaleJournal({copy:native.copyContext,actor:{id:'15'},request:native.request,sql:native.sql,id,readPriceHistory}));
   c.collection=id=>domain.collection(id);
   const active=(operation,invoiceId,accountId)=>{
    const s=getBusinessSelectedCollectionWriteScope(native.copyContext,native.transaction);
    requireValue(s&&s.operation===operation&&s.collectorId==='16'&&s.creatorId==='15'&&s.invoiceId===invoiceId&&s.accountId===accountId,'SELECTED_COLLECTION_NATIVE_SCOPE');return s;
   };
   c.collect=(preview,requestId)=>{const s=active('collection_create',preview.selection.invoiceId,preview.selection.accountId);requireValue(s.requestId===requestId,'SELECTED_COLLECTION_NATIVE_SCOPE');return domain.collect(preview,requestId);};
   c.cancelCollection=async(id,input)=>{const prior=await domain.collection(id),s=active('collection_cancel',prior.invoiceId,prior.accountId);requireValue(s.requestId===input.requestId,'SELECTED_COLLECTION_NATIVE_SCOPE');return domain.cancelCollection(id,input);};
   c.selectedCollectionJournal=(operation,payload,proof,execute)=>{
    const keys=['invoiceId','creatorId','collectorId','customerId','customerAccountId','accountId','currency','creationRequestId','policyHash','sourceSelectionHash'];
    return native.journal(operation,payload,Object.fromEntries(keys.map(k=>[k,proof[k]])),execute);
   };
   c.journal=()=>fail('SELECTED_COLLECTION_NATIVE_SCOPE');
   return fn(c);
  }));
 }});
}

