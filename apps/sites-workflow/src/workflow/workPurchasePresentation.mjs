import {tradeId,tradeExact} from './workTradeModel.mjs';
import {purchaseRateSnapshot,inboundAmount,inboundEsc as esc} from './workInboundModel.mjs';
export const historicalPurchaseRateUnknown='Faturanın kayıtlı kur bilgisi bu görünümde doğrulanamadı.';
const unknown=()=>({confirmed:false,label:'Mal kabulü bağlantısı bu görünümde doğrulanamadı.'});
export function purchaseReceiptPresentation(invoice,context,{warehouse=null}={}){
 if(!tradeId(invoice?.receiptId)||!['TRY','USD','EUR'].includes(invoice.currency)||!Array.isArray(invoice.items)||!invoice.items.length||!tradeId(context?.scope?.supplier?.id)||!Array.isArray(context.receipts))return unknown();
 if(context.scope.supplier.currency!==invoice.currency)return unknown();
 const matches=context.receipts.filter(r=>r.id===invoice.receiptId);if(matches.length!==1)return unknown();const receipt=matches[0];
 if(receipt.supplierId!==context.scope.supplier.id||!tradeId(receipt.warehouseId)||receipt.state!=='accepted'||!Array.isArray(receipt.lines))return unknown();
 const used=new Set(),products=new Set(),lines=[];
 for(const item of invoice.items){
  if(!tradeId(item.receiptLineId)||!tradeId(item.productId)||used.has(item.receiptLineId)||products.has(item.productId)||!tradeExact(item.quantityExact3,3)||BigInt(item.quantityExact3.replace('.',''))<=0n)return unknown();used.add(item.receiptLineId);products.add(item.productId);
  const rows=receipt.lines.filter(line=>line.id===item.receiptLineId);if(rows.length!==1)return unknown();const line=rows[0];
  if(line.productId!==item.productId||!tradeExact(line.quantityExact3,3)||BigInt(item.quantityExact3.replace('.',''))>BigInt(line.quantityExact3.replace('.',''))||line.unit?.label!=='ADET'||line.unit.factorExact8!=='1.00000000')return unknown();
  lines.push({receiptLineId:item.receiptLineId,productId:item.productId,stockCode:item.stockCode,unitLabel:line.unit.label,invoiceQuantityExact3:item.quantityExact3,receiptQuantityExact3:line.quantityExact3});
 }
 return {confirmed:true,receiptId:receipt.id,supplierId:receipt.supplierId,supplierName:typeof context.scope.supplier.name==='string'&&context.scope.supplier.name.trim()?context.scope.supplier.name:null,warehouseId:receipt.warehouseId,warehouseLabel:warehouse?.id===receipt.warehouseId&&typeof warehouse.label==='string'&&warehouse.label.trim()?warehouse.label:null,state:receipt.state,stateLabel:({pending:'İlker kontrolünde',accepted:'Kabul edildi',rejected:'Reddedildi'})[receipt.state],lines};
}
export function purchaseReceiptHtml(invoice,context,options){const linked=purchaseReceiptPresentation(invoice,context,options);if(!linked.confirmed)return `<p class="inbound-note">${esc(linked.label)}</p>`;return `<p>Tedarikçi: ${esc(linked.supplierName??'Tedarikçi adı doğrulanamadı')}<br>Mal kabul #${esc(linked.receiptId)} · ${esc(linked.stateLabel)}<br>Depo: ${esc(linked.warehouseLabel??'Depo bilgisi bu görünümde doğrulanamadı')} · Depo kaydı #${esc(linked.warehouseId)}</p>${linked.lines.map(line=>`<div class="inbound-line"><div><b>${esc(line.stockCode)}</b><small>Mal kabulü: ${esc(inboundAmount(line.receiptQuantityExact3))} ${esc(line.unitLabel)} · Faturalanan: ${esc(inboundAmount(line.invoiceQuantityExact3))} ${esc(line.unitLabel)}</small></div></div>`).join('')}`;}
export function purchaseDraftRateHtml(context){const rate=purchaseRateSnapshot(context);return rate?.currency==='USD'?`<p class="inbound-note" data-purchase-source-rate>Yeni alış taslağı için kayıtlı kur: 1 USD = ${esc(inboundAmount(rate.rateExact8))} TRY · Kur tarihi: ${esc(rate.date)}. Bu kur yeni taslağın dayanağıdır; güncel kur değildir.</p>`:'';}
