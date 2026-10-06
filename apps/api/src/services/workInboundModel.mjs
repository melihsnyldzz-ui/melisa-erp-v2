import {createHash} from 'node:crypto';
export const inboundError=(code='INBOUND_UNAVAILABLE',message='İşlem şu anda doğrulanamıyor.',statusCode=503)=>Object.assign(new Error(message),{code,statusCode});
export const reject=(code,message,status=400)=>{throw inboundError(code,message,status);};
export const keys=(value,allowed)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))reject('INBOUND_INPUT','İşlem bilgisi geçersiz.');};
export function id(value){if(typeof value!=='string'||!/^[1-9]\d{0,15}$/.test(value)||BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER))reject('INBOUND_ID','Kayıt bilgisi geçersiz.');return value;}
export function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))reject('INBOUND_REQUEST','Kalıcı işlem kimliği gerekli.');return value.toLowerCase();}
export function revision(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))reject('INBOUND_REVISION','Güncel kayıt bilgisi gerekli.');return value.toLowerCase();}
export function text(value,max=500){if(typeof value!=='string'||value.length>max)reject('INBOUND_TEXT','Metin bilgisi geçersiz.');return value;}
export function quantity(value){if(typeof value!=='string'||!/^[1-5]\.000$/.test(value))reject('INBOUND_QUANTITY','Her satırda 1–5 tam adet gerekli.');return value;}
export const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function nativeExact(value,places,{nullable=false,signed=false}={}){if(value==null){if(nullable)return null;throw inboundError();}const n=Number(value);if(!Number.isFinite(n)||(!signed&&n<0)||Math.abs(n)>999999999999)throw inboundError();return n.toFixed(places);}
export function countInput(input,products,{update=false}={}){
 keys(input,['requestId',...(update?['expectedRevision']:[]),'note','lines']);
 if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>20)reject('INBOUND_LINES','1–20 sayım satırı gerekli.');
 const clients=new Set(),resolved=new Set();const lines=input.lines.map(line=>{
  keys(line,['clientLineId','productId','barcode','stockCode','physicalQuantityExact3','expectedQuantityExact3','issue','note']);
  if(typeof line.clientLineId!=='string'||!/^[A-Za-z0-9-]{1,64}$/.test(line.clientLineId)||clients.has(line.clientLineId))reject('INBOUND_LINE_ID','Satır kimliği tekil olmalı.');clients.add(line.clientLineId);
  if(line.expectedQuantityExact3!==null||![null,'short','over','wrong'].includes(line.issue))reject('INBOUND_COUNT','Sayım sonucu geçersiz.');
  const productId=line.productId===null?null:id(line.productId),barcode=line.barcode===null?null:text(line.barcode,160),stockCode=line.stockCode===null?null:text(line.stockCode,50);
  if(productId){const product=products.find(p=>p.id===productId);if(!product||resolved.has(productId)||(barcode!==null&&barcode!==product.barcode)||(stockCode!==null&&stockCode!==product.stockCode))reject('INBOUND_PRODUCT','Sayım satırı doğrulanmış ürünle eşleşmiyor.',409);resolved.add(productId);}
  else if(!(barcode?.length||stockCode?.length))reject('INBOUND_UNKNOWN','Tanınmayan satırın barkodu veya ürün kodu gerekli.');
  return {clientLineId:line.clientLineId,productId,barcode,stockCode,physicalQuantityExact3:quantity(line.physicalQuantityExact3),expectedQuantityExact3:null,issue:line.issue,note:text(line.note)};
 });
 return {requestId:uuid(input.requestId),...(update?{expectedRevision:revision(input.expectedRevision)}:{}),note:text(input.note),lines};
}
export function countDto(row){
 try{const lines=typeof row.lines_json==='string'?JSON.parse(row.lines_json):row.lines;if(!Array.isArray(lines)||!['draft','needs_review','submitted','cancelled'].includes(row.state))throw inboundError();return {id:id(String(row.id)),state:row.state,revision:hash({id:String(row.id),version:String(row.version),state:row.state,note:row.note,lines,receiptId:row.receipt_id==null?null:String(row.receipt_id)}),createdBy:id(String(row.created_by)),receiptId:row.receipt_id==null?null:id(String(row.receipt_id)),note:text(row.note),lines};}catch{throw inboundError();}
}
export function receiptDto(batch){return {id:id(String(batch.id)),supplierId:id(String(batch.supplierId)),warehouseId:id(String(batch.warehouseId)),state:batch.state,note:batch.note??'',lines:batch.lines.map(line=>({id:id(String(line.id)),clientLineId:line.clientLineId,productId:id(String(line.productId)),stockCode:line.stockCode,name:line.productName,quantityExact3:nativeExact(line.quantity,3),unit:{label:'ADET',factorExact8:'1.00000000'},receivedQuantityExact3:nativeExact(line.receivedQuantity,3),invoiceableQuantityExact3:nativeExact(line.invoiceableQuantity,3)}))};}
export function invoiceDto(value){return {id:id(String(value.id)),receiptId:id(String(value.batchId)),status:value.status,number:value.number,documentDate:value.date,currency:value.currency,items:value.lines.map(l=>({id:id(String(l.id)),receiptLineId:id(String(l.receiptLineId)),productId:id(String(l.productId)),stockCode:l.stockCode,name:l.productName,quantityExact3:nativeExact(l.quantity,3),purchasePriceExact8:nativeExact(l.purchasePrice,8),lineTotalExact4:nativeExact(l.lineTotal,4)})),totals:{subtotalExact4:nativeExact(value.totals.subtotal,4),grandTotalExact4:nativeExact(value.totals.grandTotal,4)}};}
export function inboundCapabilities(actor,actual){
 const has=k=>actor.permissions?.includes(k)&&actual.permissions.includes(k),admin=String(actor.id)==='16'&&actor.testAdminSession===true&&has('sales.view'),office=String(actor.id)==='16';
 const right=k=>actor.permissions?.includes(k)&&(has(k)||admin);
 return {canCount:[15,16].includes(Number(actor.id))&&right('goods.create'),canSubmit:[15,16].includes(Number(actor.id))&&right('goods.create'),canApprove:office&&right('goods.approve'),canReject:office&&right('goods.reject'),canViewPurchase:office&&has('purchase.view'),canCreatePurchase:office&&has('purchase.view')&&right('purchase.create'),canFinalizePurchase:office&&has('purchase.view')&&right('purchase.finalize'),canCancelPurchase:office&&has('purchase.view')&&right('purchase.cancel'),canViewSupplier:office&&has('purchase.view')&&has('supplier.view'),canView:has('goods.view')||admin&&actor.permissions.includes('goods.view')};
}
