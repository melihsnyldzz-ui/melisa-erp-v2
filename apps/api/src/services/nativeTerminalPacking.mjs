import {createHash} from 'node:crypto';
import {getTerminalPersonnelContext} from './terminalService.js';
import {getSalesDraftsList,getSalesDraft} from './invoiceDraftService.js';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {nativeError,positiveId} from './nativeTerminalPolicy.mjs';

const sourceType='sales_invoice';
const context=(terminalCode,actor)=>getTerminalPersonnelContext(terminalCode,actor?.id);
const documentDate=value=>value instanceof Date?value.toISOString().slice(0,10):String(value??'').slice(0,10);
const documentVersion=value=>value==null||value===''?'':new Date(value).toISOString();
const header=doc=>({id:Number(doc.id),documentNo:String(doc.documentNo??doc.invoiceNo??''),
 customerName:String(doc.customerName??''),documentDate:documentDate(doc.documentDate),
 itemCount:Number(doc.itemCount??doc.items?.length??0),status:'FINALIZED',documentVersion:documentVersion(doc.updatedAt)});

async function readBarcodes(invoiceId){
 const pool=await getSqlPool(),sql=getSqlDriver();
 return (await pool.request().input('invoiceId',sql.BigInt,invoiceId).query(`
 SELECT DISTINCT b.product_id,b.barcode FROM dbo.product_barcodes b
 INNER JOIN dbo.sales_invoice_items i ON i.product_id=b.product_id
 WHERE i.sales_invoice_id=@invoiceId AND b.is_active=1
 ORDER BY b.product_id,b.barcode;`)).recordset;
}

export function createNativePacking(deps={}){
 const personnel=deps.context||context,list=deps.list||getSalesDraftsList,
 detail=deps.detail||getSalesDraft,barcodes=deps.barcodes||readBarcodes;
 async function validate(query,actor){
  if(!Number.isSafeInteger(Number(actor?.id))||Number(actor?.id)<1)
   nativeError('TERMINAL_OPERATOR_REQUIRED','Personel girişi gerekli.',401);
  if(typeof query?.terminalCode!=='string'||!query.terminalCode.trim()||query.terminalCode.length>80)
   nativeError('TERMINAL_CODE_REQUIRED','Geçerli terminal kodu gerekli.',400);
  await personnel(query.terminalCode,actor);
 }
 return {
  async receipts(query,actor){
   await validate(query,actor);
   const page=Number(query.page??1),search=String(query.search??'').trim();
   if(!Number.isSafeInteger(page)||page<1||page>100000||search.length>120)
    nativeError('NATIVE_PAGE_INVALID','Arama veya sayfa geçersiz.',400);
   const result=await list({page,limit:30,search,status:'FINALIZED'});
   // Only finalized sales are eligible; never expose a leaked draft/cancelled row.
   const orders=result.data.filter(doc=>doc.status==='FINALIZED').map(header);
   return {orders,page,hasMore:result.meta.hasNextPage===true,total:Number(result.meta.total)};
  },
  async receipt(id,query,actor){
   await validate(query,actor);
   const invoiceId=positiveId(id),doc=await detail(invoiceId);
   if(doc.status!=='FINALIZED')
    nativeError('NATIVE_PACKING_RECEIPT_UNAVAILABLE','Bu fiş artık paketleme için açık değil. Listeyi yenileyin.',409);
   const codes=await barcodes(invoiceId);
   const items=doc.items.map(item=>({id:Number(item.id),productId:Number(item.productId),
    stockCode:String(item.stockCode??''),productName:String(item.productName??''),quantity:String(item.quantity),
    barcodes:[...new Set([item.barcode,...codes.filter(code=>Number(code.product_id)===Number(item.productId)).map(code=>code.barcode)]
     .filter(code=>typeof code==='string'&&code.trim()).map(code=>code.trim()))].sort()}));
   const receipt={...header(doc),itemCount:items.length,sourceType,items};
   // Source type prevents old sales-order counts being reused for the same numeric ID.
   // Only packaging data affects progress: financial corrections do not reset counts.
   const {documentVersion:_version,...content}=receipt;
   const revision=createHash('sha256').update(JSON.stringify(content)).digest('hex');
   return {...receipt,revision};
  }
 };
}
export const nativePacking=createNativePacking();
