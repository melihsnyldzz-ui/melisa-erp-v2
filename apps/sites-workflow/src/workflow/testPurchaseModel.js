// The API context is the source of product identities and allowed purchase prices.
export function purchaseProducts(data){
 const s=data.scope;
 return (data.products?.length?data.products:[{id:s.product_id,stockCode:s.stock_code,name:s.product_name,unit:'ADET',purchasePrice:60,currentStockQuantity:s.current_stock_qty}]).map(p=>({...p,id:Number(p.id),purchasePrice:p.purchasePrice==null?null:Number(p.purchasePrice),currentStockQuantity:p.currentStockQuantity==null?null:Number(p.currentStockQuantity)}));
}
const requireValue=(ok,message)=>{if(!ok)throw Error(message)};
export function goodsBatchBody(scope,products,lines,note=''){
 requireValue(Array.isArray(lines)&&lines.length>=1&&lines.length<=2,'Bir veya iki ürün satırı girin.');
 const seen=new Set();
 const normalized=lines.map((line,index)=>{
  const product=products.find(p=>p.stockCode===line.code||p.id===Number(line.productId));
  requireValue(product,'Bu TEST kabulünde kullanılabilecek bir ürün seçin.');
  requireValue(!seen.has(product.id),'Aynı ürünü iki satıra eklemeyin.');seen.add(product.id);
  const quantity=Number(line.quantity);
  requireValue(Number.isInteger(quantity)&&quantity>=1&&quantity<=5,'Her ürün için 1 ile 5 arasında tam adet girin.');
  return {clientLineId:line.clientLineId||`line-${index+1}`,productId:product.id,quantity,unit:'ADET'};
 });
 return {supplierId:Number(scope.supplier_id),warehouseId:Number(scope.warehouse_id),note:note.trim(),lines:normalized};
}
export function draftBody(batch,products,values,selectedLines){
 requireValue(batch?.state==='accepted','Önce mal kabulünü onaylayın.');
 requireValue(typeof values.number==='string'&&/^TSTB-[A-Za-z0-9-]{1,24}$/.test(values.number.trim()),'TEST fatura numarası TSTB- ile başlamalı; devamına harf, rakam veya tire yazın.');
 requireValue(/^\d{4}-\d{2}-\d{2}$/.test(values.date)&&Number.isFinite(Date.parse(values.date))&&new Date(values.date).toISOString().slice(0,10)===values.date,'Geçerli belge tarihi girin.');
 requireValue(selectedLines.length>=1&&selectedLines.length<=2,'Faturalanacak ürün satırlarını seçin.');
 const seen=new Set();
 const lines=selectedLines.map(row=>{
  const line=batch.lines.find(l=>String(l.id)===String(row.receiptLineId));
  requireValue(line&&!seen.has(String(line.id)),'Mal kabulü satırı bulunamadı veya iki kez seçildi.');seen.add(String(line.id));
  const quantity=Number(row.quantity),product=products.find(p=>p.id===Number(line.productId));
  requireValue(Number.isInteger(quantity)&&quantity>=1&&quantity<=5&&quantity<=Number(line.invoiceableQuantity),'Faturalanan adet, kullanılabilir kabul adedini aşamaz.');
  requireValue(product&&Number.isFinite(product.purchasePrice),'Alış fiyatı bilinmiyor; faturayı kaydedemezsiniz.');
  return {receiptLineId:Number(line.id),quantity,purchasePrice:product.purchasePrice,lineDiscountRate:0};
 });
 return {batchId:Number(batch.id),number:values.number.trim(),date:values.date,currency:'TRY',lines,invoiceDiscountRate:0,vatRate:0};
}
export function previewTotals(lines){
 let subtotal=0;
 for(const line of lines){const qty=Number(line.quantity),price=line.purchasePrice;if(!Number.isInteger(qty)||qty<0||typeof price!=='number'||!Number.isFinite(price)||price<0)return null;subtotal+=Math.round(qty*price*100)}
 return {subtotal:subtotal/100,discountTotal:0,taxableTotal:subtotal/100,vatTotal:0,grandTotal:subtotal/100};
}
export function purchaseStateLabel(state){return ({pending:'Kontrol bekliyor',accepted:'Kabul edildi',rejected:'Reddedildi',draft:'Taslak',DRAFT:'Taslak',finalized:'Kesinleşti',FINALIZED:'Kesinleşti',cancelled:'İptal edildi',CANCELLED:'İptal edildi'})[state]||'Durum bilinmiyor'}
