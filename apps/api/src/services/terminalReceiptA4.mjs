const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
const symbols = { USD: '$', EUR: '€', TRY: '₺' };
const currencyWords = { USD: ['DOLAR','CENT'], EUR: ['EURO','CENT'], TRY: ['TÜRK LİRASI','KURUŞ'] };
const ones = ['', 'BİR','İKİ','ÜÇ','DÖRT','BEŞ','ALTI','YEDİ','SEKİZ','DOKUZ'];
const tens = ['', 'ON','YİRMİ','OTUZ','KIRK','ELLİ','ALTMIŞ','YETMİŞ','SEKSEN','DOKSAN'];
function underThousand(n) {
 const words=[];
 if(n>=100){if(n>=200)words.push(ones[Math.floor(n/100)]);words.push('YÜZ');}
 if(n%100>=10)words.push(tens[Math.floor(n%100/10)]);
 if(n%10)words.push(ones[n%10]);
 return words.join(' ');
}
function wholeWords(n) {
 if(n===0n)return 'SIFIR';
 const scales=['','BİN','MİLYON','MİLYAR','TRİLYON'];
 const groups=[];
 for(let index=0;n>0n;index++,n/=1000n){
  if(index>=scales.length)throw Error('Tutar yazıyla gösterim sınırını aşıyor.');
  const part=Number(n%1000n);if(!part)continue;
  groups.unshift([index===1&&part===1?'':underThousand(part),scales[index]].filter(Boolean).join(' '));
 }
 return groups.join(' ');
}
function amount(value) {
 const n=Number(value);
 if(value===null||value===undefined||value===''||!Number.isFinite(n)||n<0||n>9999999999999)throw Error('Yazdırılacak tutar geçersiz.');
 return n;
}
export function amountInTurkish(value,currency) {
 if(!currencyWords[currency])throw Error('Fiş para birimi desteklenmiyor.');
 const [whole,cents]=amount(value).toFixed(2).split('.');
 return 'Yalnız: '+wholeWords(BigInt(whole))+' '+currencyWords[currency][0]+' '+wholeWords(BigInt(cents))+' '+currencyWords[currency][1];
}
export function buildTerminalA4Model(invoice) {
 const currency=invoice.documentCurrency||invoice.customerCurrency||'TRY';
 if(!symbols[currency])throw Error('Fiş para birimi desteklenmiyor.');
 const money=value=>new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount(value))+' '+symbols[currency];
 const parsed=new Date(invoice.documentDate||invoice.updatedAt);
 if(Number.isNaN(parsed.getTime()))throw Error('Fiş tarihi geçersiz.');
 const rows=(invoice.items||[]).map(item=>{
  if(item.currency&&item.currency!==currency)throw Error('Satır ve fiş para birimi farklı.');
  const quantity=Number(item.quantity);
  if(!Number.isFinite(quantity)||quantity<=0)throw Error('Fiş miktarı geçersiz.');
  return [clean(item.stockCode),clean(item.productName),
   new Intl.NumberFormat('tr-TR',{maximumFractionDigits:4}).format(quantity),
   clean(item.unitName||item.unit||'ADET'),
   money(item.unitPrice),money(item.lineTotal??quantity*amount(item.unitPrice))];
 });
 if(!rows.length)throw Error('Boş fiş yazdırılamaz.');
 return {
  format:'A4',title:'KOLİ',documentNumber:clean(invoice.documentNo||invoice.id),
  date:new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Istanbul'}).format(parsed),
  customer:clean(invoice.customerName),headers:['Stok Kodu','Malın Cinsi','Miktar','','Fiyat','Tutar'],rows,
  subtotal:money(invoice.subtotal),discount:money(invoice.discountTotal??0),hasDiscount:amount(invoice.discountTotal??0)>0,
  grandTotal:money(invoice.grandTotal),amountWords:amountInTurkish(invoice.grandTotal,currency)
 };
}
