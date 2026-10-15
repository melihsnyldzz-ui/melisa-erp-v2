import {assertIsolatedCopyContext,bindIsolatedCopyOperationDTO,BUSINESS_COPY_DATABASE,isolatedCopyOperationDTOContext} from './isolatedOperationCopyContext.mjs';
import {loadBusinessSelectedSaleJournal} from './workTradeStore.mjs';
import {createWorkCollectionService} from './workCollectionService.mjs';
import {workId,workScaled} from './workSalesModel.mjs';
import {withSelectedSaleCollectionReadBridge} from './isolatedOperationCopyStoreFactory.mjs';

// Deliberately unregistered preparation adapter. There is no default store,
// connection, route, native intent or authority to enable the DB02 writer.
// The injected isolated transaction owns the existing journal/effects methods.
const fail=(code='SOURCE_COLLECTION_PREPARATION_SCOPE',statusCode=409)=>{throw Object.assign(new Error('Kaynak satış tahsilat hazırlığı doğrulanamadı.'),{code,statusCode});};
const requireValue=(v,code,status)=>{if(!v)fail(code,status);};
export const SOURCE_COLLECTION_COLLECTOR_SQL=`SELECT CONVERT(varchar(20),u.id) actorId,r.code roleCode,CONVERT(bit,u.is_active) userActive,CONVERT(bit,r.is_active) roleActive,p.permission_key permissionKey,CONVERT(bit,p.can_view) canView
FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id LEFT JOIN dbo.permissions p ON p.role_id=r.id WHERE u.id=@actor;`;
export const SOURCE_COLLECTION_ACCOUNT_SQL=`SELECT CONVERT(varchar(20),a.id) id,a.currency_code currency,CONVERT(bit,a.is_active) isActive,a.account_type type FROM dbo.finance_accounts a WITH(HOLDLOCK) WHERE a.id=@account;`;
const rights=['finance.view','customer.view','finance.collection'];

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

export function createBusinessSelectedSaleCollectionPreparation({withContext}={}){
 requireValue(typeof withContext==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
 // No new finance or idempotence algorithm: the existing service validates
 // money, dates, revisions, preview hashes and invokes the supplied existing
 // collection methods. The isolated transaction's journal owns UUID replay.
 const getStore=async()=>({
  read:(actor,fn)=>withContext(actor,async c=>{
   const a=await authority(c,actor,false);
   const context=bindIsolatedCopyOperationDTO(a.copy,{...c.context,capabilities:{...c.context.capabilities,canCollect:true,canCancelCollection:a.canCancel}});
   return fn({...c,context,invoice:async id=>(await prepareBusinessSelectedSaleCollection(c,actor,id)).invoice(id)});
  }),
  mutate:(actor,operation,payload,fn)=>withContext(actor,async c=>{
   requireValue(['collection_create','collection_cancel'].includes(operation));
   const cancelling=operation==='collection_cancel';
   // Authorize BEFORE reading an original movement or replay journal.
   await authority(c,actor,cancelling);
   const prior=cancelling?await c.collection(payload.id):null;
   const id=cancelling?prior.invoiceId:payload.invoiceId;
   const prepared=await prepareBusinessSelectedSaleCollection(c,actor,id,{cancelling});
   if(cancelling)requireValue(prior.currency===prepared.proof.currency&&prior.accountId===prepared.proof.accountId);
   requireValue(typeof c.journal==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
   return c.journal(operation,payload,()=>fn({...c,context:prepared.context,invoice:prepared.invoice}));
  }),
 });
 return createWorkCollectionService({getStore});
}

// Explicit server-only READ/PREVIEW bridge. No default connection/route and no
// mutable writer DTO escapes. Existing factory identity/READY/actor checks own
// the read transaction; the preparation repeats current collection authority.
export function createBusinessSelectedSaleCollectionReadPreparation({getStore}={}){
 requireValue(typeof getStore==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
 const service=createBusinessSelectedSaleCollectionPreparation({withContext:async(actor,fn)=>{
  const store=await getStore();requireValue(typeof store?.readSelectedSaleCollectionPreparation==='function','SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',503);
  return store.readSelectedSaleCollectionPreparation(actor,bridge=>withSelectedSaleCollectionReadBridge(bridge,async native=>{
   // This unregistered checkpoint supports unpriced SOURCE journals only.
   // A priced creator15 invoice cannot borrow collector16's HISTORY reader.
   const readPriceHistory=()=>fail('WORK_SELECTED_SALE_PRICING_HISTORY_REQUIRED');
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
