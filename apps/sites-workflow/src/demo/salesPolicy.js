import { assert, validDate } from './operationsShared.js';
import { rateFor } from './operationsCards.js';
import { balance } from './operationsSelectors.js';

export function minimumOrderEUR(state,{date,currency,amount}){
 if(currency==='EUR')return amount;
 const eur=rateFor(state,'EUR',date),own=rateFor(state,currency,date);
 return eur&&own?Math.round(amount*own/eur):null;
}

// Version 2 applies to newly created UI transactions; historical demo documents keep their snapshots.
export function validateSalesPolicy(state,input,items,amount){
 if(input.salesPolicyVersion!==2){assert(!items.some(line=>line.discount>3),'%3 üzeri satış iskontosu için yeni politika ve yönetici onayı gerekir.');return {version:1,minimumEur:null,priceExceptionReason:'',minimumExceptionReason:''};}
 const priceExceptionReason=String(input.priceExceptionReason||'').trim();
 const minimumExceptionReason=String(input.minimumExceptionReason||input.exceptionReason||'').trim();
 const overrides=items.filter(line=>{
  const product=state.products.find(p=>p.id===line.productId);
  return product.prices?.[input.currency]!==line.unitPrice;
 });
 const effectiveDiscounts=items.map(line=>{
  const reference=state.products.find(p=>p.id===line.productId)?.prices?.[input.currency];
  assert(Number.isSafeInteger(reference)&&reference>0,'Ürün para biriminde kayıtlı satış fiyatı bulunmalı.');
  return Math.max(0,100*(1-line.unitPrice*(1-line.discount/100)/reference));
 });
 assert(effectiveDiscounts.every(rate=>rate<=5+1e-9),'%5 üzeri toplam indirim için gerçek sahip onayı gerekir.');
 const managerDiscount=effectiveDiscounts.some(rate=>rate>3+1e-9);
 assert(!overrides.length||priceExceptionReason,'Etiket fiyatından sapma için fiyat istisnası gerekçesi yazın.');
 assert(!managerDiscount||priceExceptionReason,'%3 üzeri iskonto için yönetici gerekçesi yazın.');
 const minimumEur=minimumOrderEUR(state,{date:input.date,currency:input.currency,amount});
 assert(minimumEur!=null||minimumExceptionReason,'Minimum sipariş karşılığı için tarihli EUR kuru veya istisna gerekçesi gerekli.');
 assert(minimumEur==null||minimumEur>=100000||minimumExceptionReason,'1.000 EUR altındaki sipariş için istisna gerekçesi yazın.');
 return {version:2,minimumEur,priceExceptionReason,minimumExceptionReason,maxEffectiveDiscount:Math.max(...effectiveDiscounts),requiresManager:Boolean(overrides.length||managerDiscount||minimumEur==null||minimumEur<100000)};
}

export function validateCredit(state,{customerId,currency,amount,dueDate,date,creditExceptionReason}){
 validDate(dueDate,'Geçerli bir vade seçin.');assert(dueDate>=date,'Vade işlem tarihinden önce olamaz.');
 const customer=state.customers.find(c=>c.id===customerId);
 const limit=customer?.creditLimits?.[currency]??0;
 const exposure=Math.max(0,balance(state,customerId,currency)+amount);
 const reason=String(creditExceptionReason||'').trim();
 assert(limit>0&&exposure<=limit||reason,'Müşteri limiti yok veya aşıldı; yönetici istisna gerekçesi yazın.');
 return {limit,exposure,reason};
}
