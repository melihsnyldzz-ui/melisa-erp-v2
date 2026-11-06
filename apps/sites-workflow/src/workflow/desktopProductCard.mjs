import {desktopProductCardId,isDesktopProductCard} from '../../../../packages/shared/src/desktopProductCard.mjs';
import {desktopSeriesStockLabel} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountDesktopProductCard({root,productId,load,onClose=()=>{}}={}){
 if(!root||typeof root.querySelector!=='function'||!desktopProductCardId(productId)||typeof load!=='function'||typeof onClose!=='function')throw Error('PRODUCT_CARD_INVALID');
 let disposed=false;
 root.innerHTML='<section class="card panel desktop-product-card"><p role="status">Ürün kartı okunuyor…</p></section>';
 void (async()=>{
  try{
   const p=await load(productId);if(disposed)return;if(!isDesktopProductCard(p,productId))throw Error('PRODUCT_CARD_INVALID');
   const fields=[['Stok kodu',p.stockCode],['Ürün adı',p.name],['Marka',p.brand],['Ürün türü',p.category],['Birim',p.unit],['Ana tedarikçi',p.supplierName],['Fiziksel stok',p.currentStockExact3+' '+p.unit],['Satış fiyatı',p.salePriceExact4+' '+p.currency],['Alış fiyatı',p.purchasePriceExact4+' '+p.currency],['Alış indirimi',p.purchaseDiscountRateExact4+' %'],['Ortalama maliyet',p.averageCostTryExact4+' TRY'],['Durum',p.isActive?'Aktif':'Pasif']];
   fields.splice(7,0,['Rezerve stok',p.reservedExact3===undefined?'Bilinmiyor':p.reservedExact3+' '+p.unit],['Satılabilir stok',p.availableExact3===undefined?'Bilinmiyor':p.availableExact3+' '+p.unit]);
   if(p.units?.length===2)fields.push(['Bir serideki adet',p.units[1].factorExact8.split('.')[0]],['Fiziksel stokun seri karşılığı',desktopSeriesStockLabel(p.currentStockExact3,p.units[1].factorExact8)]);
   if(p.stockOpening)fields.push(['Başlangıç stok gerekçesi',p.stockOpening.reason],['Açılış tarihi',p.stockOpening.documentDate],['Açılış miktarı',p.stockOpening.quantityExact3+' ADET'],['Açılış tutarı',p.stockOpening.amountTryExact4+' TRY'],['Açılış hareketi',p.stockOpening.movementId],['Kaydeden kullanıcı',p.stockOpening.actorId],['Açılış istek numarası',p.stockOpening.requestId]);
   root.innerHTML=`<section class="card panel desktop-product-card" aria-label="Ürün kartı"><header><div><p class="eyebrow">ÜRÜN KARTI</p><h2>${esc(p.name)}</h2></div><button type="button" class="btn" data-close-card>Kartı kapat</button></header><dl class="desktop-product-details">${fields.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><h3>Barkodlar</h3>${p.barcodes.length?`<ul class="desktop-product-barcodes">${p.barcodes.map(b=>`<li><span>${b.isPrimary?'Ana barkod':b.type==='package'?'Paket barkodu':'Ek barkod'}</span><code>${esc(b.barcode)}</code></li>`).join('')}</ul>`:'<p>Aktif barkod yok.</p>'}</section>`;
   root.querySelector('[data-close-card]').addEventListener('click',()=>{if(disposed)return;disposed=true;onClose();});
  }catch{if(!disposed)root.innerHTML='<section class="card panel desktop-product-card"><p role="alert">Ürün kartı okunamadı. Listeyi yenileyip tekrar deneyin.</p></section>';}
 })();
 return Object.freeze({dispose(){disposed=true;}});
}
