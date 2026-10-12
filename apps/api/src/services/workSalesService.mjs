import {workActor,workActionInput,workFail,workHash,workId,workKeys,workRevision,workSalePreview,workScaled,workDate,workRequestId,workSelection,workDraftInput} from './workSalesModel.mjs';
async function defaultStore(){return (await import('./workTradeStore.mjs')).workTradeStore;}
const requireCapability=(context,key)=>{if(context.capabilities?.[key]!==true)workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);};
const requireRevision=(actual,expected)=>{if(workRevision(actual)!==expected)workFail('WORK_STALE','Kayıt değişti. Güncel bilgiyi yükleyip yeniden deneyin.',409);};
function selectedReadError(error){
 const info=error?.originalError?.info;
 if(error?.code==='EREQUEST'&&error.number===51904&&info?.number===51904&&info.message==='SELECTED_SALE_NATIVE_PRODUCT_DRIFT')workFail('WORK_SELECTED_PRODUCT_CHANGED','Seçilen ürün satış için uygun değil veya bilgisi değişti. Ürünü ve stoğunu kontrol edin.',409);
 throw error;
}
// Expanded parsing is only preparation. Legacy contexts retain their own narrow
// validator; only the server-owned selected adapter can calculate this policy.
export function workSelectedSaleInput(input,{draft=false}={}){
 workKeys(input,draft?['requestId','previewHash','expectedRevision','customerId','documentDate','currency','items']:['customerId','documentDate','currency','items']);
 if(!['TRY','USD','EUR'].includes(input.currency)||!Array.isArray(input.items)||input.items.length<1||input.items.length>200)workFail('WORK_ITEMS_INVALID','Satış kalemleri geçersiz.');
 const seen=new Set(),items=input.items.map(row=>{workKeys(row,['productId','quoteId','quantityExact3']);const productId=workId(row.productId),quoteId=workId(row.quoteId),quantity=workScaled(row.quantityExact3,3);if(seen.has(productId)||quantity<=0n||quantity%1000n!==0n)workFail('WORK_QUANTITY_INVALID','Pozitif tam ana birim miktarı gerekli.');seen.add(productId);return {productId,quoteId,quantityExact3:row.quantityExact3};});
 return {...(draft?{requestId:workRequestId(input.requestId),previewHash:workRevision(input.previewHash),expectedRevision:workRevision(input.expectedRevision)}:{}),customerId:workId(input.customerId),documentDate:workDate(input.documentDate),currency:input.currency,items};
}
export function workSalesListFilter(query){
 const customer=Object.hasOwn(query,'customerId'),currency=Object.hasOwn(query,'currency');
 if(customer!==currency)workFail('WORK_QUERY_INVALID','Müşteri ve döviz birlikte seçilmelidir.');
 if(!customer)return {};
 if(!['TRY','USD','EUR'].includes(query.currency))workFail('WORK_QUERY_INVALID','Döviz seçimi geçersiz.');
 return {customerId:workId(query.customerId),currency:query.currency};
}
export function createWorkSalesService({getStore=defaultStore}={}){
 const mutateSale=async(actor,operation,payload,fn)=>{const store=await getStore();return (store.mutateSelectedSale??store.mutate).call(store,actor,operation,payload,fn);};
 return {
  async context(actor){actor=workActor(actor,'sales.view');return (await getStore()).context(actor);},
  async selectionOptions(actor){actor=workActor(actor,'sales.view');const store=await getStore();if(typeof store.selectedSaleEnabled!=='function'||!await store.selectedSaleEnabled(actor))return {enabled:false};return store.read(actor,c=>{if(!c.selectedSaleEnabled||typeof c.selectedSaleOptions!=='function')workFail('WORK_SELECTED_SALE_UNAVAILABLE','Satış bilgileri doğrulanamadı.',503);return c.selectedSaleOptions();});},
  async selectedContext(input,actor){actor=workActor(actor,'sales.create');workKeys(input,['customerId','currency','productIds']);if(!Array.isArray(input.productIds)||input.productIds.length<1||input.productIds.length>200||new Set(input.productIds).size!==input.productIds.length||!['TRY','USD','EUR'].includes(input.currency))workFail('WORK_ITEMS_INVALID','Satış seçimi geçersiz.');const selection={customerId:workId(input.customerId),currency:input.currency,productIds:input.productIds.map(workId)};try{return await (await getStore()).read(actor,c=>{requireCapability(c.context,'canCreate');if(!c.selectedSaleEnabled||typeof c.selectedSaleContext!=='function')workFail('WORK_SELECTED_SALE_UNAVAILABLE','Satış bilgileri doğrulanamadı.',503);return c.selectedSaleContext(selection);});}catch(error){selectedReadError(error);}},
  async preview(input,actor){actor=workActor(actor,'sales.create');return (await getStore()).read(actor,async c=>{requireCapability(c.context,'canCreate');const selection=c.selectedSaleEnabled===true?workSelectedSaleInput(input):workSelection(input,{allowBusinessCurrencies:true});return c.selectedSaleEnabled===true?c.selectedSalePreview(selection):workSalePreview(selection,c.context);});},
  async createDraft(input,actor){actor=workActor(actor,'sales.create');const store=await getStore(),enabled=typeof store.selectedSaleEnabled==='function'&&await store.selectedSaleEnabled(actor),payload=enabled?workSelectedSaleInput(input,{draft:true}):workDraftInput(input,{allowBusinessCurrencies:true});return (store.mutateSelectedSale??store.mutate).call(store,actor,'sale_draft',payload,async c=>{
   requireCapability(c.context,'canCreate');requireRevision(c.context.revision,payload.expectedRevision);
   const {requestId,previewHash,expectedRevision,...selection}=payload,preview=c.selectedSaleEnabled===true?await c.selectedSalePreview(selection):workSalePreview(selection,c.context);
   if(preview.previewHash!==previewHash)workFail('WORK_PREVIEW_CHANGED','Önizleme değişti. Yeniden kontrol edin.',409);
   const invoice=await c.createDraft(preview,requestId);return {invoice,requestId,replayed:false};
  });},
  async finalize(id,input,actor){actor=workActor(actor,'sales.finalize');id=workId(id);const payload={...workActionInput(input),id};return mutateSale(actor,'sale_finalize',payload,async c=>{
   requireCapability(c.context,'canFinalize');const invoice=await c.invoice(id);requireRevision(invoice.revision,payload.expectedRevision);
   if(invoice.status!=='draft')workFail('WORK_INVOICE_STATE','Yalnız taslak satış tamamlanabilir.',409);
   return {invoice:await c.finalize(id),requestId:payload.requestId,replayed:false};
  });},
  async cancel(id,input,actor){actor=workActor(actor,'sales.cancel');id=workId(id);const payload={...workActionInput(input,{cancel:true}),id};return mutateSale(actor,'sale_cancel',payload,async c=>{
   requireCapability(c.context,'canCancel');const invoice=await c.invoice(id);requireRevision(invoice.revision,payload.expectedRevision);
   if(!['draft','finalized'].includes(invoice.status))workFail('WORK_INVOICE_STATE','Bu satış iptal edilemez.',409);
   if(invoice.collections.receivedExact4!=='0.0000')workFail('WORK_COLLECTIONS_ACTIVE','Önce bu satışın tahsilatlarını iptal edin.',409);
   return {invoice:await c.cancel(id,payload.reason),requestId:payload.requestId,replayed:false};
  });},
  async invoice(id,actor){actor=workActor(actor,'sales.view');const store=await getStore();return (store.readHistoricalSale??store.read).call(store,actor,c=>c.invoice(workId(id)));},
  async list(query,actor){actor=workActor(actor,'sales.view');workKeys(query,['page','limit','customerId','currency']);const positive=(v,d,max)=>{if(v===undefined)return d;if(typeof v!=='string'||!/^[1-9]\d*$/.test(v)||Number(v)>max)workFail('WORK_QUERY_INVALID','Sayfalama bilgisi geçersiz.');return Number(v);};const filter=workSalesListFilter(query),options={page:positive(query.page,1,10000),limit:positive(query.limit,25,50),...filter},store=await getStore();return (store.readHistoricalSale??store.read).call(store,actor,c=>c.list(options));},
  async request(id,actor){actor=workActor(actor,'sales.view');const {workRequestId,workSelection,workDraftInput}=await import('./workSalesModel.mjs');return (await getStore()).read(actor,c=>c.request(workRequestId(id)));}
 };
}
export const workSalesService=createWorkSalesService();
