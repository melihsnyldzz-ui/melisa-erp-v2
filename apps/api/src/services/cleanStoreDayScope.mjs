// Internal transaction adapter for existing native engines. No HTTP issuer.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {assertRegisteredCleanContext,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {isCleanOrderSaleMutation} from './cleanOrderSaleScope.mjs';
const scope=new AsyncLocalStorage();
const permissions=Object.freeze({
 count_create:[18,'goods.create'],count_update:[18,'goods.create'],count_submit:[18,'goods.create'],count_cancel:[18,'goods.create'],
 goods_accept:[19,'goods.approve'],goods_reject:[19,'goods.reject'],
 purchase_draft:[19,'purchase.create'],purchase_finalize:[19,'purchase.finalize'],
 collection_create:[20,'finance.collection'],payment:[20,'finance.payment'],
});
const deny=()=>{throw Object.assign(new Error('Mal kabul işlem kapsamı doğrulanamadı.'),{code:'CLEAN_INBOUND_SCOPE_REQUIRED',statusCode:403});};
const positive=v=>Number.isSafeInteger(v)&&v>0;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
function target(){assertRegisteredCleanContext();if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_STORE_DAY!=='20261022')deny();}
function binding(input){
 target();
 if(!input||!input.transaction||!input.sqlDriver||!Object.hasOwn(permissions,input.operation)||!positive(input.actor?.id)||!Array.isArray(input.actor.permissions)||!input.actor.permissions.includes(permissions[input.operation][1])||input.actor.id!==permissions[input.operation][0]||!uuid(input.requestId)||typeof input.payloadJson!=='string'||input.payloadJson.length>16000||!/^[a-f0-9]{64}$/.test(input.payloadHash??''))deny();
 if(input.receiptId!==null&&!positive(input.receiptId)||input.invoiceId!==null&&!positive(input.invoiceId))deny();
 const financial=['collection_create','payment'].includes(input.operation);
 if(financial&&process.env.MELISA_CLEAN_FINANCE!=='20261022')deny();
 if(financial?(input.operation==='collection_create'?input.invoiceId!==1||input.receiptId!==null:input.invoiceId!==4||input.receiptId!==3):input.operation==='purchase_finalize'?(!positive(input.receiptId)||!positive(input.invoiceId)):
  input.invoiceId!==null||(['goods_accept','goods_reject','purchase_draft'].includes(input.operation)&&!positive(input.receiptId)))deny();
 let payload;try{payload=JSON.parse(input.payloadJson);}catch{deny();}
 if(!payload||Array.isArray(payload)||payload.requestId!==input.requestId||payload.operation!==input.operation||payload.actorId!==String(input.actor.id)||createHash('sha256').update(input.payloadJson,'utf16le').digest('hex')!==input.payloadHash)deny();
 return Object.freeze({...input,actor:Object.freeze({id:input.actor.id})});
}
function witness(row,s,field){
 if(row?.[field]!==true||row.environmentId?.toLowerCase()!==CLEAN_ENVIRONMENT_ID||row.requestId?.toLowerCase()!==s.requestId||Number(row.actorId)!==s.actor.id||row.operation!==s.operation||row.payloadHash?.toLowerCase()!==s.payloadHash)deny();
}
export function isCleanStoreDayMutation(){
 const s=scope.getStore();if(!s)return false;target();return true;
}
export async function assertCleanPurchaseSupplierItems(sqlDriver,transaction,supplierId,items){
 const s=scope.getStore();if(!s||!isCleanStoreDayMutation()||!['purchase_draft','purchase_finalize'].includes(s.operation)||s.transaction!==transaction||s.sqlDriver!==sqlDriver||supplierId!==1||!Array.isArray(items)||items.length!==1)deny();
 const row=(await new sqlDriver.Request(transaction).input('request_id',sqlDriver.UniqueIdentifier,s.requestId)
  .input('supplier_id',sqlDriver.BigInt,supplierId).input('items_json',sqlDriver.NVarChar(sqlDriver.MAX),JSON.stringify(items))
  .execute('dbo.usp_clean_store_purchase_party_proof')).recordset?.[0];witness(row,s,'verified');
}
export async function withCleanStoreDayMutation(input,execute){
 if(scope.getStore()||isCleanOrderSaleMutation()||typeof execute!=='function')deny();
 const s=binding(input),q=s.sqlDriver;
 // Missing/old SQL cohort cannot admit this JS scope. The future native binder
 // checks the actual role, exact target, same TX, payload and mixed intents.
 const accepted=(await new q.Request(s.transaction)
  .input('actor_id',q.BigInt,s.actor.id).input('operation',q.NVarChar(40),s.operation)
  .input('request_id',q.UniqueIdentifier,s.requestId).input('payload_hash',q.Char(64),s.payloadHash)
  .input('payload_json',q.NVarChar(q.MAX),s.payloadJson)
  .input('receipt_id',q.BigInt,s.receiptId).input('invoice_id',q.BigInt,s.invoiceId)
  .execute(['collection_create','payment'].includes(s.operation)?'dbo.usp_clean_store_finance_bind':'dbo.usp_clean_store_day_bind')).recordset?.[0];
 witness(accepted,s,'accepted');
 return scope.run(s,async()=>{
  const result=await execute();
  const checked=(await new q.Request(s.transaction).input('request_id',q.UniqueIdentifier,s.requestId)
   .execute(['collection_create','payment'].includes(s.operation)?'dbo.usp_clean_store_finance_finish':'dbo.usp_clean_store_day_finish')).recordset?.[0];
  witness(checked,s,'verified');
  return result;
 });
}
export async function assertCleanReceivedPurchaseContext(context,invoiceId){
 const s=scope.getStore();
 if(!s||!isCleanStoreDayMutation()||s.operation!=='purchase_finalize'||context?.transaction!==s.transaction||context.sqlDriver!==s.sqlDriver||context.cleanStoreDayReceived!==true||!positive(invoiceId)||s.invoiceId!==invoiceId||!positive(s.receiptId))deny();
 const q=s.sqlDriver,row=(await new q.Request(s.transaction)
  .input('request_id',q.UniqueIdentifier,s.requestId).input('receipt_id',q.BigInt,s.receiptId)
  .input('invoice_id',q.BigInt,invoiceId).execute('dbo.usp_clean_store_received_purchase_proof')).recordset?.[0];
 witness(row,s,'verified');
 if(Number(row.receiptId)!==s.receiptId||Number(row.invoiceId)!==invoiceId||row.stockAlreadyPosted!==true)deny();
}
