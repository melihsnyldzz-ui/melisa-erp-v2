import {post} from './apiClient.js';

// Prepared command client only. No caller in the running read-only Workspace,
// no activation endpoint, no generated retry key and no automatic resubmission.
// Server authentication, own EXECUTE proof and exact native gates remain mandatory.
const id=value=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
const common=['source','requestId'];
function command(body,fields){
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k))
  ||typeof body.source!=='string'||!body.source.trim()||typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))
  throw new Error('Kabul komutu veya istek kimliği geçersiz.');
 return structuredClone(body);
}
function existing(receiptId,body,fields){
 if(!id(receiptId)||!Number.isSafeInteger(body?.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=Number.MAX_SAFE_INTEGER)
  throw new Error('Kabul kimliği veya sürümü geçersiz.');
 return command(body,[...common,'expectedVersion',...fields]);
}
export function createInventoryReceipt(body){
 const snapshot=command(body,[...common,'supplierId','documentDate','dispatchNumber','observedOpenReceipts']);
 if(!id(snapshot.supplierId)||!Array.isArray(snapshot.observedOpenReceipts))throw new Error('Açık kabul bilgisi doğrulanmadı.');
 return post('/api/inventory-receipts',snapshot);
}
export function appendInventoryReceiptLine(receiptId,body){
 return post(`/api/inventory-receipts/${encodeURIComponent(receiptId)}/lines`,existing(receiptId,body,['productId','quantity']));
}
export function captureInventoryReceiptLine(receiptId,body){
 return post(`/api/inventory-receipts/${encodeURIComponent(receiptId)}/captured-lines`,existing(receiptId,body,['barcode','supplierModelCode','quantity']));
}
export function editInventoryReceiptQuantities(receiptId,body){
 return post(`/api/inventory-receipts/${encodeURIComponent(receiptId)}/draft-quantities`,existing(receiptId,body,['quantities']));
}
export function resolveInventoryReceiptLine(receiptId,lineId,body){
 if(!id(lineId))throw new Error('Kabul satırı kimliği geçersiz.');
 const snapshot=existing(receiptId,body,['productId','observedEvidenceHash','confirmedUnit','confirmedUnitMultiplier','reason']);
 if(!id(snapshot.productId)||!/^[a-f0-9]{64}$/.test(snapshot.observedEvidenceHash||'')
  ||typeof snapshot.confirmedUnit!=='string'||!snapshot.confirmedUnit.trim()||snapshot.confirmedUnit.length>40
  ||snapshot.confirmedUnitMultiplier!=='1'||typeof snapshot.reason!=='string'||!snapshot.reason.trim()||snapshot.reason.length>500)
  throw new Error('Ürün, birim veya incelenmiş eşleştirme kanıtı eksik.');
 return post(`/api/inventory-receipts/${encodeURIComponent(receiptId)}/lines/${encodeURIComponent(lineId)}/resolve`,snapshot);
}
export function transitionInventoryReceipt(receiptId,action,body){
 if(!['submit','return','approve','correct'].includes(action))throw new Error('Kabul geçişi geçersiz.');
 const fields=action==='correct'?['reason','quantities']:action==='return'?['reason']:[];
 return post(`/api/inventory-receipts/${encodeURIComponent(receiptId)}/${action}`,existing(receiptId,body,fields));
}
export function allocatePurchaseReceiptLines(invoiceId,body){
 if(!id(invoiceId)||!/^0x[0-9a-fA-F]{16}$/.test(body?.expectedInvoiceVersion||''))throw new Error('Alış kimliği veya sürümü geçersiz.');
 const snapshot=command(body,[...common,'expectedInvoiceVersion','allocations']);
 if(!Array.isArray(snapshot.allocations)||!snapshot.allocations.length||snapshot.allocations.length>24)throw new Error('Tahsis satırları gerekli.');
 return post(`/api/purchase-invoices/${encodeURIComponent(invoiceId)}/receipt-allocations`,snapshot);
}

