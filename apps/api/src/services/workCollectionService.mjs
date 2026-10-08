import {workActor,workDate,workExact,workFail,workHash,workId,workKeys,workReason,workRequestId,workRevision,workScaled} from './workSalesModel.mjs';
import {isolatedCopyOperationDTOContext,ISOLATED_COPY_ORIGIN} from './isolatedOperationCopyContext.mjs';
async function defaultStore(){return (await import('./workTradeStore.mjs')).workTradeStore;}
function selection(input){workKeys(input,['invoiceId','accountId','amountExact4','documentDate']);const amount=workScaled(input.amountExact4,4);if(amount<=0n)workFail('WORK_AMOUNT_INVALID','Pozitif tahsilat tutarı gerekli.');return {invoiceId:workId(input.invoiceId),accountId:workId(input.accountId),amountExact4:input.amountExact4,documentDate:workDate(input.documentDate)};}
const capability=(c,key)=>{if(c.context.capabilities?.[key]!==true)workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);};
async function preview(c,input){
 const s=selection(input),invoice=await c.invoice(s.invoiceId),account=c.context.scope.accounts.find(row=>row.id===s.accountId);
 if(s.documentDate!==c.context.meta?.date)workFail('WORK_DATE_SCOPE','Bu işlem için geçerli günün tarihi gerekli.',409);
 const copy=isolatedCopyOperationDTOContext(c.context),eligible=copy?account?.synthetic===false&&account.operationOrigin===ISOLATED_COPY_ORIGIN&&copy.financeAccounts.some(a=>a.id===account.id&&a.currency==='TRY'):account?.synthetic===true;
 if(invoice.status!=='finalized'||invoice.currency!=='TRY'||!account||account.currency!=='TRY'||!eligible)workFail('WORK_COLLECTION_SCOPE','Satış veya tahsilat hesabı uygun değil.',409);
 const amount=workScaled(s.amountExact4,4),outstanding=workScaled(invoice.collections.outstandingExact4,4),received=workScaled(invoice.collections.receivedExact4,4);
 if(amount>outstanding)workFail('WORK_COLLECTION_EXCESS','Tahsilat tutarı kalan satış tutarını aşıyor.',409);
 const value={selection:s,revision:workRevision(invoice.collections.revision),currency:'TRY',amountExact4:s.amountExact4,receivedAfterExact4:workExact(received+amount,4),outstandingAfterExact4:workExact(outstanding-amount,4)};
 return {...value,previewHash:workHash(value)};
}
export function createWorkCollectionService({getStore=defaultStore}={}){return {
 async context(query,actor){actor=workActor(actor,'customer.view');workKeys(query,['invoiceId']);const invoiceId=workId(query.invoiceId);return (await getStore()).read(actor,async c=>{const invoice=await c.invoice(invoiceId);return {invoice,customer:c.context.scope.customer,accounts:c.context.scope.accounts,capabilities:c.context.capabilities,revision:invoice.collections.revision};},'customer.view');},
 async preview(input,actor){actor=workActor(actor,'finance.collection');const s=selection(input);return (await getStore()).read(actor,async c=>{capability(c,'canCollect');return preview(c,s);},'customer.view');},
 async collect(input,actor){actor=workActor(actor,'finance.collection');workKeys(input,['requestId','previewHash','expectedRevision','invoiceId','accountId','amountExact4','documentDate']);const {requestId,previewHash,expectedRevision,...s}=input,payload={requestId:workRequestId(requestId),previewHash:workRevision(previewHash),expectedRevision:workRevision(expectedRevision),...selection(s)};
  return (await getStore()).mutate(actor,'collection_create',payload,async c=>{capability(c,'canCollect');const p=await preview(c,payloadSelection(payload));if(p.revision!==payload.expectedRevision||p.previewHash!==payload.previewHash)workFail('WORK_STALE','Tahsilat bilgisi değişti. Yeniden kontrol edin.',409);const collection=await c.collect(p,payload.requestId);return {collection,invoice:await c.invoice(payload.invoiceId),requestId:payload.requestId,replayed:false};});
 },
 async cancel(id,input,actor){actor=workActor(actor,'finance.collection.cancel');id=workId(id);workKeys(input,['requestId','expectedRevision','reason','documentDate']);const payload={id,requestId:workRequestId(input.requestId),expectedRevision:workRevision(input.expectedRevision),reason:workReason(input.reason),documentDate:workDate(input.documentDate)};
  return (await getStore()).mutate(actor,'collection_cancel',payload,async c=>{capability(c,'canCancelCollection');if(payload.documentDate!==c.context.meta?.date)workFail('WORK_DATE_SCOPE','Bu işlem için geçerli günün tarihi gerekli.',409);const collection=await c.collection(id);if(workRevision(collection.revision)!==payload.expectedRevision||collection.status!=='active')workFail('WORK_STALE','Tahsilat değişti. Güncel bilgiyi yükleyin.',409);const result=await c.cancelCollection(id,payload);return {collection:result,invoice:await c.invoice(collection.invoiceId),requestId:payload.requestId,replayed:false};});
 }
};}
const payloadSelection=({invoiceId,accountId,amountExact4,documentDate})=>({invoiceId,accountId,amountExact4,documentDate});
export const workCollectionService=createWorkCollectionService();
