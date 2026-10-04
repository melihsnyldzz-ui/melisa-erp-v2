// Named synthetic TEST scope only; native invoice normalization owns totals.
import {createHash} from 'node:crypto';
const fail=(code,message,statusCode=400)=>{throw Object.assign(new Error(message),{code,statusCode});};
export function strictFields(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('TEST_PAYLOAD','Kapsam dışı veya geçersiz alan.');
}
export function positiveId(value){if(!Number.isSafeInteger(value)||value<1)fail('TEST_ID','Pozitif kayıt kimliği gerekli.');return value;}
export function validateRequestId(value){if(typeof value!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(value))fail('REQUEST_ID_REQUIRED','Kalıcı istek kimliği gerekli.');return value;}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export function testPurchaseRequestHash(input,operation){validateRequestId(input?.requestId);return createHash('sha256').update(JSON.stringify(canonical({...input,operation}))).digest('hex');}
export function testPurchaseReplay(record,payloadHash,actorId){if(record.payload_hash!==payloadHash||Number(record.actor_id)!==Number(actorId))fail('REQUEST_CONFLICT','İstek kimliği farklı işlemde kullanıldı.',409);return {...JSON.parse(record.response_json),replayed:true};}
export function publicTestBatch(batch,canViewPurchase){if(canViewPurchase)return batch;return {...batch,lines:batch.lines.map(({purchasePrice,...line})=>line)};}
export function publicBatchContext(context,canViewPurchase){if(canViewPurchase)return context;const withoutPrice=({purchasePrice,...row})=>row;return {...context,products:context.products.map(withoutPrice),batches:context.batches.map(b=>publicTestBatch(b,false)),invoiceDrafts:[]};}
export async function requiredTestBatch(load,id){positiveId(id);const context=await load(id),batch=context.batches.find(b=>b.id===id);if(!batch)fail('GOODS_NOT_FOUND','Sentetik kabul bulunamadı.',404);return {context,batch};}
function quantity(value){if(!Number.isSafeInteger(value)||value<1||value>5)fail('TEST_QUANTITY','Satır başına 1–5 ADET gerekli.');return value;}
function lines(value){if(!Array.isArray(value)||value.length<1||value.length>2)fail('TEST_LINES','Bir veya iki farklı ürün satırı gerekli.');return value;}
export function normalizeTestBatch(input,products,scope){
 strictFields(input,['requestId','supplierId','warehouseId','note','lines']);validateRequestId(input.requestId);
 if(positiveId(input.supplierId)!==scope.supplierId||positiveId(input.warehouseId)!==scope.warehouseId)fail('TEST_SCOPE','İzinli sentetik tedarikçi ve depo gerekli.',403);
 if(input.note!=null&&(typeof input.note!=='string'||input.note.length>500))fail('TEST_NOTE','Açıklama en fazla 500 karakter.');
 const seen=new Set(),keys=new Set();
 const normalized=lines(input.lines).map(line=>{
  strictFields(line,['clientLineId','productId','quantity','unit']);
  const id=positiveId(line.productId),product=products.find(p=>p.id===id);
  if(!product||line.unit!=='ADET')fail('TEST_SCOPE','Yalnız izinli sentetik ürün ve ADET.',403);
  if(typeof line.clientLineId!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(line.clientLineId)||keys.has(line.clientLineId)||seen.has(id))fail('TEST_DUPLICATE_LINE','Ürün ve satır kimliği tekil olmalı.');
  seen.add(id);keys.add(line.clientLineId);return {clientLineId:line.clientLineId,productId:id,quantity:quantity(line.quantity),unit:'ADET'};
 });
 return {...input,note:input.note||'',lines:normalized};
}
export function normalizeTestInvoiceDraft(input,batch){
 strictFields(input,['requestId','batchId','number','date','currency','lines','invoiceDiscountRate','vatRate']);validateRequestId(input.requestId);
 if(positiveId(input.batchId)!==batch.id||batch.state!=='accepted')fail('TEST_RECEIPT_STATE','Fatura için onaylı kabul gerekli.',409);
 if(typeof input.number!=='string'||!/^TSTB-[A-Za-z0-9-]{1,24}$/.test(input.number))fail('DOCUMENT_NUMBER','TEST fatura numarası TSTB- ile başlamalı.');
 if(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date+'T00:00:00Z'))||new Date(input.date+'T00:00:00Z').toISOString().slice(0,10)!==input.date)fail('TEST_DATE','Geçerli fatura tarihi gerekli.');
 if(input.currency!=='TRY'||input.invoiceDiscountRate!==0||input.vatRate!==0)fail('TEST_COST_SCOPE','Bu sentetik kapsam TRY, iskonto 0 ve açık KDV 0.');
 const seen=new Set();
 const normalized=lines(input.lines).map(line=>{
  strictFields(line,['receiptLineId','quantity','purchasePrice','lineDiscountRate']);const id=positiveId(line.receiptLineId),receipt=batch.lines.find(r=>r.id===id);
  if(!receipt||seen.has(id))fail('TEST_RECEIPT_LINK','Kabul satırı tekil ve aynı kabulden olmalı.',409);seen.add(id);
  const qty=quantity(line.quantity);if(qty>receipt.invoiceableQuantity)fail('TEST_INVOICE_QUANTITY','Fatura miktarı kabulün kalanını aşıyor.',409);
  if(line.purchasePrice!==receipt.purchasePrice||line.lineDiscountRate!==0)fail('TEST_COST_SCOPE','Kaynak sentetik fiyat ve iskonto 0 gerekli.');
  return {...line,productId:receipt.productId,stockCode:receipt.stockCode,productName:receipt.productName};
 });
 return {...input,lines:normalized};
}
export function validateTestBatchDecision(input,reject=false){strictFields(input,['requestId','reason']);validateRequestId(input.requestId);if(reject&&(typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500))fail('TEST_REASON','En az 5 karakter gerekçe gerekli.');}
export function testBatchPurchasePayload(input,batch,supplierName){return {documentNo:input.number,documentDate:input.date,supplierId:batch.supplierId,supplierName,supplierCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,invoiceDiscountRate:0,supplierDiscountRate:0,description:`Sentetik TEST batch #${batch.id}; stok kabulde işlendi`,items:input.lines.map(l=>({productId:l.productId,stockCode:l.stockCode,productName:l.productName,quantity:l.quantity,currency:'TRY',purchasePrice:l.purchasePrice,lineDiscountRate:0,stockEffect:'goods_receipt_already_posted'}))};}
