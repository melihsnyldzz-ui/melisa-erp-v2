import {workActor,workActionInput,workDraftInput,workFail,workHash,workId,workKeys,workRevision,workSalePreview,workSelection} from './workSalesModel.mjs';
async function defaultStore(){return (await import('./workTradeStore.mjs')).workTradeStore;}
const requireCapability=(context,key)=>{if(context.capabilities?.[key]!==true)workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);};
const requireRevision=(actual,expected)=>{if(workRevision(actual)!==expected)workFail('WORK_STALE','Kayıt değişti. Güncel bilgiyi yükleyip yeniden deneyin.',409);};
export function createWorkSalesService({getStore=defaultStore}={}){
 return {
  async context(actor){actor=workActor(actor,'sales.view');return (await getStore()).context(actor);},
  async preview(input,actor){actor=workActor(actor,'sales.create');const selection=workSelection(input);return (await getStore()).read(actor,async c=>{requireCapability(c.context,'canCreate');return workSalePreview(selection,c.context);});},
  async createDraft(input,actor){actor=workActor(actor,'sales.create');const payload=workDraftInput(input);return (await getStore()).mutate(actor,'sale_draft',payload,async c=>{
   requireCapability(c.context,'canCreate');requireRevision(c.context.revision,payload.expectedRevision);
   const {requestId,previewHash,expectedRevision,...selection}=payload,preview=workSalePreview(selection,c.context);
   if(preview.previewHash!==previewHash)workFail('WORK_PREVIEW_CHANGED','Önizleme değişti. Yeniden kontrol edin.',409);
   const invoice=await c.createDraft(preview,requestId);return {invoice,requestId,replayed:false};
  });},
  async finalize(id,input,actor){actor=workActor(actor,'sales.finalize');id=workId(id);const payload={...workActionInput(input),id};return (await getStore()).mutate(actor,'sale_finalize',payload,async c=>{
   requireCapability(c.context,'canFinalize');const invoice=await c.invoice(id);requireRevision(invoice.revision,payload.expectedRevision);
   if(invoice.status!=='draft')workFail('WORK_INVOICE_STATE','Yalnız taslak satış tamamlanabilir.',409);
   return {invoice:await c.finalize(id),requestId:payload.requestId,replayed:false};
  });},
  async cancel(id,input,actor){actor=workActor(actor,'sales.cancel');id=workId(id);const payload={...workActionInput(input,{cancel:true}),id};return (await getStore()).mutate(actor,'sale_cancel',payload,async c=>{
   requireCapability(c.context,'canCancel');const invoice=await c.invoice(id);requireRevision(invoice.revision,payload.expectedRevision);
   if(!['draft','finalized'].includes(invoice.status))workFail('WORK_INVOICE_STATE','Bu satış iptal edilemez.',409);
   if(invoice.collections.receivedExact4!=='0.0000')workFail('WORK_COLLECTIONS_ACTIVE','Önce bu satışın tahsilatlarını iptal edin.',409);
   return {invoice:await c.cancel(id,payload.reason),requestId:payload.requestId,replayed:false};
  });},
  async invoice(id,actor){actor=workActor(actor,'sales.view');return (await getStore()).read(actor,c=>c.invoice(workId(id)));},
  async list(query,actor){actor=workActor(actor,'sales.view');workKeys(query,['page','limit']);const positive=(v,d,max)=>{if(v===undefined)return d;if(typeof v!=='string'||!/^[1-9]\d*$/.test(v)||Number(v)>max)workFail('WORK_QUERY_INVALID','Sayfalama bilgisi geçersiz.');return Number(v);};return (await getStore()).read(actor,c=>c.list({page:positive(query.page,1,10000),limit:positive(query.limit,25,50)}));},
  async request(id,actor){actor=workActor(actor,'sales.view');const {workRequestId}=await import('./workSalesModel.mjs');return (await getStore()).read(actor,c=>c.request(workRequestId(id)));}
 };
}
export const workSalesService=createWorkSalesService();
