export const currencies=['TRY','USD','EUR'];
export const financialChannels={CASH:'Nakit',BANK:'Banka',CARD:'Kart',OTHER:'Diğer'};
export const kinds={receipt:'Mal kabul',purchase:'Alış',sale:'Satış',collection:'Tahsilat',payment:'Tedarikçi ödemesi','order-payment':'Sipariş ödemesi','customer-refund':'Müşteriye geri ödeme','supplier-refund':'Tedarikçiden geri tahsilat','sales-return':'Satış iadesi','purchase-return':'Alış iadesi','delivery-correction':'Eksik teslim düzeltmesi',count:'Sayım',expense:'Masraf','cash-open':'Kasa açılışı','cash-close':'Kasa kapanışı',transfer:'Virman / döviz bozdurma','cash-adjustment':'Kasa sayım düzeltmesi','finance-reversal':'Finans düzeltmesi'};
export const orderStatuses={DRAFT:'Taslak',COLLECTING:'Ürünler hazırlanıyor',CUSTOMER_APPROVAL:'Müşteri onayı',AWAITING_PAYMENT:'Ödeme bekliyor',PARTIALLY_PAID:'Kısmi ödendi',PAID:'Ödendi',ON_ACCOUNT:'Vadeli satış',PACKING:'Paketleniyor',SHIPPED:'Sevk edildi',COMPLETED:'Tamamlandı',CANCELLED:'İptal'};
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
export const clone=value=>structuredClone(value);
export const assert=(condition,message)=>{if(!condition)throw Error(message);};
export function cents(value){assert(/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(String(value)),'Tutar pozitif olmalı ve en çok iki ondalık içermeli.');const [whole,fraction='']=String(value).split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
export function quantity(value,zero=false){const n=Number(value);assert(String(value).trim()!==''&&Number.isSafeInteger(n)&&n>=(zero?0:1)&&n<=1000000,'Adet tam sayı olmalı; geçersiz miktar.');return n;}
export function validDate(value,message='Geçerli bir işlem tarihi seçin.'){assert(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,message);}
