import {getSqlPool,getSqlDriver} from '../config/database.js';
import {getSalesDraft} from './invoiceDraftService.js';
import {nativeRequestContext} from './nativeTerminalCatalog.mjs';
import {nativeOwnedInvoice} from './nativeTerminalSale.mjs';
import {nativeError,positiveId} from './nativeTerminalPolicy.mjs';
import {pilotProductScopeSql} from './pilotProductScope.mjs';

function validateRequest(query,actor){
 if(!Number.isSafeInteger(Number(actor?.id))||Number(actor?.id)<1)
  nativeError('TERMINAL_OPERATOR_REQUIRED','Personel girişi gerekli.',401);
 if(typeof query?.terminalCode!=='string'||!/^[-A-Za-z0-9_]{1,80}$/.test(query.terminalCode))
  nativeError('TERMINAL_CODE_REQUIRED','Geçerli terminal kodu gerekli.',400);
}

function categoryProductIds(value){
 if(typeof value!=='string'||value.length>3399)
  nativeError('NATIVE_CATEGORY_IDS_INVALID','En fazla 200 farklı ürün kimliği gerekli.',400);
 const parts=value.split(',');
 if(parts.length>200||parts.some(id=>!/^[1-9]\d*$/.test(id)))
  nativeError('NATIVE_CATEGORY_IDS_INVALID','En fazla 200 farklı ürün kimliği gerekli.',400);
 const ids=parts.map(Number);
 if(ids.some(id=>!Number.isSafeInteger(id))||new Set(ids).size!==ids.length)
  nativeError('NATIVE_CATEGORY_IDS_INVALID','Ürün kimlikleri pozitif ve farklı olmalı.',400);
 return ids;
}

async function readProductCategories(ids){
 const pool=await getSqlPool(),sql=getSqlDriver(),request=pool.request();
 const parameters=ids.map((id,index)=>{
  const name=`categoryProduct${index}`;
  request.input(name,sql.BigInt,id);
  return `@${name}`;
 });
 // Existing inactive cards may still belong to a local receipt. Keep the reviewed
 // pilot scope, but do not apply the active-catalog filter to this metadata read.
 return (await request.query(`SELECT p.id AS productId,p.category FROM dbo.products p
  WHERE p.id IN (${parameters.join(',')}) AND ${pilotProductScopeSql('p.id')}
  ORDER BY p.id;`)).recordset;
}

export function createNativeCategoryReports(deps={}){
 const context=deps.context||nativeRequestContext,owned=deps.owned||nativeOwnedInvoice,
  detail=deps.detail||getSalesDraft,categories=deps.categories||readProductCategories;
 return {
  async receipt(invoiceId,query,actor){
   validateRequest(query,actor);
   const id=positiveId(invoiceId);
   // Ownership must be checked before loading any authoritative commercial data.
   await owned(id,query.terminalCode,actor);
   const invoice=await detail(id);
   return {invoiceId:Number(invoice.id),currency:String(invoice.documentCurrency),
    discountRate:String(invoice.discountRate??0),
    items:invoice.items.map(item=>({productId:Number(item.productId),
     stockCode:String(item.stockCode??''),productName:String(item.productName??''),
     category:String(item.category??''),quantity:String(item.quantity),unitPrice:String(item.unitPrice)}))};
  },
  async products(query,actor){
   validateRequest(query,actor);
   const ids=categoryProductIds(query.ids);
   await context(query.terminalCode,actor);
   const rows=await categories(ids);
   return {items:rows.map(item=>({productId:Number(item.productId),category:String(item.category??'')}))};
  }
 };
}

export const nativeCategoryReports=createNativeCategoryReports();
