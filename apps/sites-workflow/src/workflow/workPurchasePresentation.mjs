import {tradeId,tradeExact} from './workTradeModel.mjs';
import {purchaseRateSnapshot,inboundAmount,moneyDisplay,inboundEsc as esc} from './workInboundModel.mjs';
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
export function recordedPurchaseBasis(invoice,context){
 const value=invoice?.recordedInvoiceBasis,linked=purchaseReceiptPresentation(invoice,context),fields=['source','invoiceId','supplierId','receiptId','documentCurrency','documentExchangeRateExact8','accountCurrency','accountExchangeRateExact8','accountAmountExact4','amountTryExact4'];
 if(!linked.confirmed||!tradeId(invoice.id)||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==fields.sort().join(',')||value.source!=='stored-native-invoice'||value.invoiceId!==invoice.id||value.receiptId!==linked.receiptId||value.supplierId!==linked.supplierId||value.documentCurrency!==invoice.currency||value.accountCurrency!==value.documentCurrency)return null;
 for(const key of ['documentExchangeRateExact8','accountExchangeRateExact8'])if(!tradeExact(value[key],8)||BigInt(value[key].replace('.',''))<=0n)return null;
 for(const key of ['accountAmountExact4','amountTryExact4'])if(!tradeExact(value[key],4)||BigInt(value[key].replace('.',''))<=0n)return null;
 if(!tradeExact(invoice.totals?.grandTotalExact4,4)||value.accountAmountExact4!==invoice.totals.grandTotalExact4)return null;
 return value;
}
export function recordedPurchaseBasisHtml(invoice,context){const basis=recordedPurchaseBasis(invoice,context);if(!basis)return `<p class="inbound-note">${esc(historicalPurchaseRateUnknown)}</p>`;return `<p class="inbound-note" data-purchase-recorded-rate>Faturaya kayıtlı kur: 1 ${esc(basis.documentCurrency)} = ${esc(inboundAmount(basis.documentExchangeRateExact8))} TRY<br>Cari hesabına kayıtlı kur: 1 ${esc(basis.accountCurrency)} = ${esc(inboundAmount(basis.accountExchangeRateExact8))} TRY<br>Faturaya kayıtlı hesap tutarı: ${esc(moneyDisplay(basis.accountAmountExact4))} ${esc(basis.accountCurrency)}<br>Kayıtlı TRY karşılığı: ${esc(moneyDisplay(basis.amountTryExact4))} TRY<br>Dayanak: Fatura kaydı</p>`;}
