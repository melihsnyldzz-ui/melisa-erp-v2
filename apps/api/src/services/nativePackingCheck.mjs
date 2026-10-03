import {createHash} from 'node:crypto';
import {nativeError,positiveId} from './nativeTerminalPolicy.mjs';
import {nativePacking} from './nativeTerminalPacking.mjs';
import {packingAuditStore} from './nativePackingAudit.mjs';

export const PACKING_EXCEPTION_PERMISSION='terminal.packing.exception';
function quantity(value){
 if(typeof value!=='string'||!/^\d{1,9}(?:\.\d{1,3})?$/.test(value))nativeError('PACKING_QUANTITY_INVALID','Sayım geçerli bir adet olmalı.',400);
 const [whole,fraction='']=value.split('.');return BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'));
}
const format=value=>`${value/1000n}.${(value%1000n).toString().padStart(3,'0')}`.replace(/\.?0+$/,'');
export function packingDecision(order,body,actor){
 if(!order.items?.length||order.status!=='FINALIZED'||order.sourceType!=='sales_invoice')nativeError('PACKING_RECEIPT_INVALID','Paketleme için tamamlanan satış fişi gerekli.',409);
 if(body.revision!==order.revision)nativeError('PACKING_RECEIPT_CHANGED','Fiş değişti; listeyi yeniden açın.',409);
 if(!body.counts||typeof body.counts!=='object'||Array.isArray(body.counts))nativeError('PACKING_COUNTS_INVALID','Sayım bilgisi gerekli.',400);
 const ids=new Set(order.items.map(i=>String(i.id)));
 if(ids.size!==order.items.length||Object.keys(body.counts).some(id=>!ids.has(id)))nativeError('PACKING_COUNTS_INVALID','Sayımda fişe ait olmayan satır var.',400);
 let missing=0n,extra=0n;
 const lines=order.items.map(item=>{
  const expected=quantity(String(item.quantity)),counted=quantity(body.counts[String(item.id)]??'0');
  const short=expected>counted?expected-counted:0n,over=counted>expected?counted-expected:0n;
  missing+=short;extra+=over;
  return {itemId:item.id,productId:item.productId,expected:format(expected),counted:format(counted),missing:format(short),extra:format(over)};
 });
 const differs=missing>0n||extra>0n,status=body.status;
 if(!['PACKED','PACKING_EXCEPTION'].includes(status))nativeError('PACKING_STATUS_INVALID','Paketleme durumu geçersiz.',400);
 if(status==='PACKED'&&differs)nativeError('PACKING_COUNT_MISMATCH','Eksik veya fazla ürün varken normal paketleme tamamlanamaz.',409);
 const reason=typeof body.reason==='string'?body.reason.trim():'';
 if(status==='PACKING_EXCEPTION'){
  if(!actor.permissions?.includes(PACKING_EXCEPTION_PERMISSION))nativeError('PACKING_EXCEPTION_DENIED','Paketleme istisnası için yetkiniz yok.',403);
  if(!differs)nativeError('PACKING_EXCEPTION_NOT_REQUIRED','Sayım tam; normal tamamlamayı kullanın.',400);
  if(!reason||reason.length>500)nativeError('PACKING_REASON_REQUIRED','İstisna gerekçesi zorunlu (en fazla 500 karakter).',400);
 }
 return {status,reason:status==='PACKING_EXCEPTION'?reason:'',missingQuantity:format(missing),extraQuantity:format(extra),lines};
}
export function createPackingCheck({receipt=(id,q,a)=>nativePacking.receipt(id,q,a),store=packingAuditStore()}={}){
 return async(id,body,actor)=>{
  const invoiceId=positiveId(id);positiveId(actor?.id);
  if(!/^[a-f0-9-]{36}$/i.test(body.requestId||''))nativeError('PACKING_REQUEST_INVALID','İşlem kimliği gerekli.',400);
  return store.transaction(invoiceId,async audit=>{
   const order=await receipt(invoiceId,{terminalCode:body.terminalCode},actor);
   const decision=packingDecision(order,body,actor);
   const event={...decision,invoiceId,revision:order.revision,terminalCode:body.terminalCode,actorId:Number(actor.id),actorName:actor.username,requestId:body.requestId};
   const digest=createHash('sha256').update(JSON.stringify(event)).digest('hex');
   const existing=await audit.find(body.requestId);
   if(existing){if(existing.digest!==digest)nativeError('PACKING_REQUEST_CONFLICT','İşlem kimliği başka bir sayımda kullanılmış.',409);return existing;}
   return audit.append({...event,digest});
  });
 };
}
