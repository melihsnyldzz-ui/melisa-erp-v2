import {createHash} from 'node:crypto';
import {nativeRequestContext} from './nativeTerminalCatalog.mjs';
import {nativeError,positiveId} from './nativeTerminalPolicy.mjs';
import {getCurrencyRates,upsertCurrencyRates} from './currencyRateService.js';
import {listPipelineDocuments,getPipelineDocument} from './salesPipelineService.js';
import {getSqlPool,getSqlDriver} from '../config/database.js';

const permission=(actor,key)=>{if(!actor?.permissions?.includes(key))nativeError('AUTH_PERMISSION_DENIED',key==='sales.view'?'Sipariş görüntüleme yetkiniz bulunmuyor. ERP personel yetkisini kontrol edin.':'Bu işlem için yetkiniz bulunmuyor.',403);};
const orderHeader=d=>({id:Number(d.id),documentNo:d.documentNo,customerName:d.customerName,documentDate:String(d.documentDate).slice(0,10),itemCount:Number(d.itemCount),status:d.status});
async function readBarcodes(id){
 const pool=await getSqlPool(),sql=getSqlDriver();
 return (await pool.request().input('order',sql.BigInt,id).query(`
 SELECT DISTINCT b.product_id,b.barcode FROM dbo.product_barcodes b
 INNER JOIN dbo.sales_order_items i ON i.product_id=b.product_id
 WHERE i.sales_order_id=@order AND b.is_active=1;`)).recordset;
}
export function createNativeWorkflows(deps={}){
 const context=deps.context||nativeRequestContext,readRates=deps.readRates||getCurrencyRates,
 writeRates=deps.writeRates||upsertCurrencyRates,list=deps.list||listPipelineDocuments,
 detail=deps.detail||getPipelineDocument,barcodes=deps.barcodes||readBarcodes;
 return {
  async settings(query,actor){
   await context(query.terminalCode,actor);
   const set=await readRates();
   return {rates:set.rates.map(r=>({currency:r.currency,rateToTry:r.defined?String(r.rateToTry):null,defined:r.defined,rateDate:r.rateDate})),
    canEditRates:actor.permissions?.includes('settings.manage')===true,
    printerName:process.env.TERMINAL_RECEIPT_PRINTER_NAME||'',paperFormat:'A4',
    fetchedAt:new Date().toISOString()};
  },
  async saveRates(body,actor){
   permission(actor,'settings.manage');await context(body.terminalCode,actor);
   for(const currency of ['USD','EUR']){
    const value=String(body.rates?.[currency]??'');
    if(!/^\d{1,9}(\.\d{1,8})?$/.test(value)||Number(value)<=0)
     nativeError('NATIVE_RATE_INVALID','USD ve EUR için sıfırdan büyük geçerli kur girin.',400);
   }
   await writeRates({rates:{USD:body.rates.USD,EUR:body.rates.EUR},source:'native-terminal'},actor);
   return this.settings(body,actor);
  },
  async orders(query,actor){
   permission(actor,'sales.view');await context(query.terminalCode,actor);
   const page=Number(query.page||1),search=String(query.search||'').trim();
   if(!Number.isSafeInteger(page)||page<1||page>100000||search.length>120)nativeError('NATIVE_PAGE_INVALID','Arama veya sayfa geçersiz.',400);
   const result=await list('order',{page,limit:30,search,status:'confirmed'});
   return {orders:result.data.map(orderHeader),page,hasMore:result.meta.hasNextPage,total:result.meta.total};
  },
  async order(id,query,actor){
   permission(actor,'sales.view');await context(query.terminalCode,actor);
   const orderId=positiveId(id),doc=await detail('order',orderId);
   if(doc.status!=='CONFIRMED')nativeError('NATIVE_ORDER_NOT_OPEN','Bu sipariş toplama için açık değil. Listeyi yenileyin.',409);
   const codes=await barcodes(orderId);
   const items=doc.items.map(i=>({id:Number(i.id),productId:Number(i.productId),stockCode:i.stockCode,productName:i.productName,
     quantity:String(i.quantity),barcodes:[...new Set([i.barcode,...codes.filter(b=>Number(b.product_id)===Number(i.productId)).map(b=>b.barcode)].filter(Boolean))]}));
   const header=orderHeader(doc);
   // A changed order never silently reuses quantities from an older picking session.
   const revision=createHash('sha256').update(JSON.stringify({header,items})).digest('hex');
   return {...header,items,revision};
  }
 };
}
export const nativeWorkflows=createNativeWorkflows();


