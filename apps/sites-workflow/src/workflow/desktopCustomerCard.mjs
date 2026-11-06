import {desktopCustomerCardId,isDesktopCustomerCard} from '../../../../packages/shared/src/desktopCustomerCard.mjs';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={customer:'Müşteri',wholesale:'Toptan',retail:'Perakende',mixed:'Karma'};
export function mountDesktopCustomerCard({root,customerId,load,onClose=()=>{},onOpenInvoice=()=>{}}={}){
 if(!root||typeof root.querySelector!=='function'||!desktopCustomerCardId(customerId)||typeof load!=='function'||typeof onClose!=='function'||typeof onOpenInvoice!=='function')throw Error('CUSTOMER_CARD_INVALID');let disposed=false;
 root.innerHTML='<section class="card panel desktop-product-card"><p role="status">Müşteri kartı okunuyor…</p></section>';
 void (async()=>{try{const c=await load(customerId);if(disposed)return;if(!isDesktopCustomerCard(c,customerId))throw Error();
  const fields=[['Müşteri kodu',c.customerCode],['Telefon',c.phone],['Şehir',c.city],['Ülke',c.country],['Müşteri türü',types[c.customerType]],['Durum',c.isActive?'Aktif':'Pasif']];
  root.innerHTML=`<section class="card panel desktop-product-card" aria-label="Müşteri kartı"><header><div><p class="eyebrow">MÜŞTERİ KARTI</p><h2>${esc(c.name)}</h2></div><button type="button" class="btn" data-close-customer>Listeye dön</button></header><dl class="desktop-product-details">${fields.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><h3>Döviz hesapları</h3><p>Her hesap kendi para birimindedir.</p><div class="tablewrap"><table><thead><tr><th>Para birimi</th><th>Bakiye</th></tr></thead><tbody>${c.accounts.map(a=>`<tr><td>${esc(a.currency)}</td><td>${esc(a.balanceExact8)}</td></tr>`).join('')}</tbody></table></div><h3>Son tamamlanan satış</h3>${!c.salesHistoryAvailable?'<p>Satış geçmişini görüntüleme yetkiniz yok.</p>':c.lastSale?`<p>${esc(c.lastSale.documentNo)} · ${esc(c.lastSale.documentDate)} · ${esc(c.lastSale.totalExact4)} ${esc(c.lastSale.currency)}</p><button type="button" class="btn" data-open-customer-invoice>Son fişi aç</button>`:'<p>Henüz tamamlanan satış yok.</p>'}</section>`;
  root.querySelector('[data-close-customer]').addEventListener('click',()=>{if(disposed)return;disposed=true;onClose();});
  root.querySelector('[data-open-customer-invoice]')?.addEventListener('click',()=>{if(disposed)return;disposed=true;onOpenInvoice(c.lastSale.invoiceId);});
 }catch{if(!disposed)root.innerHTML='<section class="card panel desktop-product-card"><p role="alert">Müşteri kartı okunamadı. Listeyi yenileyip tekrar deneyin.</p></section>';}})();
 return Object.freeze({dispose(){disposed=true;}});
}
