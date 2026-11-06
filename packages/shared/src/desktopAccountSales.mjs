import {desktopCustomerCardId} from './desktopCustomerCard.mjs';
import {desktopCompanyRateDate} from './desktopCompanyRates.mjs';
const plain=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const decimal=(v,n,signed=false)=>typeof v==='string'&&new RegExp(`^${signed?'-?':''}(?:0|[1-9]\\d{0,19})\\.\\d{${n}}$`).test(v)&&!new RegExp(`^-0\\.0{${n}}$`).test(v);
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v),code=v=>['TRY','USD','EUR'].includes(v),units=v=>BigInt(v.replace('.',''));
export const desktopAccountSalesPage=p=>Number.isSafeInteger(p)&&p>=1&&p<=100000;
export function isDesktopAccountSales(value,{customerId,accountId,page}={}){
 try{
  if(!plain(value,['customerId','entityId','accountId','currency','balanceExact8','page','pageSize','hasNextPage','invoices'])||!desktopCustomerCardId(customerId)||!desktopCustomerCardId(accountId)||value.customerId!==customerId||value.accountId!==accountId||!desktopCustomerCardId(value.entityId)||!code(value.currency)||!decimal(value.balanceExact8,8,true)||!desktopAccountSalesPage(page)||value.page!==page||value.pageSize!==10||typeof value.hasNextPage!=='boolean'||!Array.isArray(value.invoices)||value.invoices.length>10||value.hasNextPage&&value.invoices.length!==10)return false;
  const ids=new Set();let previous=null;
  for(const invoice of value.invoices){
   if(!plain(invoice,['invoiceId','documentNo','documentDate','currency','totalExact4','subtotalExact4','discountRateExact4','discountTotalExact4','accountCurrency','accountAmountExact4','amountTryExact4','documentRateExact8','accountRateExact8','items'])||!desktopCustomerCardId(invoice.invoiceId)||ids.has(invoice.invoiceId)||!text(invoice.documentNo,60)||!code(invoice.currency)||invoice.accountCurrency!==value.currency||!['totalExact4','subtotalExact4','discountRateExact4','discountTotalExact4','accountAmountExact4','amountTryExact4'].every(k=>decimal(invoice[k],4))||!['documentRateExact8','accountRateExact8'].every(k=>decimal(invoice[k],8)&&units(invoice[k])>0n)||invoice.currency==='TRY'&&invoice.documentRateExact8!=='1.00000000'||invoice.accountCurrency==='TRY'&&invoice.accountRateExact8!=='1.00000000')return false;
   desktopCompanyRateDate(invoice.documentDate);ids.add(invoice.invoiceId);
   if(previous&&(previous.documentDate<invoice.documentDate||previous.documentDate===invoice.documentDate&&BigInt(previous.invoiceId)<=BigInt(invoice.invoiceId)))return false;previous=invoice;
   if(!Array.isArray(invoice.items)||invoice.items.length<1||invoice.items.length>200)return false;let subtotal=0n;const itemIds=new Set();
   for(const item of invoice.items){if(!plain(item,['itemId','productId','stockCode','name','quantityExact3','unitPriceExact4','lineTotalExact4'])||!desktopCustomerCardId(item.itemId)||itemIds.has(item.itemId)||!desktopCustomerCardId(item.productId)||!text(item.stockCode,100)||!text(item.name,250)||!decimal(item.quantityExact3,3)||units(item.quantityExact3)<=0n||!decimal(item.unitPriceExact4,4)||!decimal(item.lineTotalExact4,4)||(units(item.quantityExact3)*units(item.unitPriceExact4)+500n)/1000n!==units(item.lineTotalExact4))return false;itemIds.add(item.itemId);subtotal+=units(item.lineTotalExact4);}
   const rate=units(invoice.discountRateExact4),discount=units(invoice.discountTotalExact4);if(rate>1000000n||subtotal!==units(invoice.subtotalExact4)||(subtotal*rate+500000n)/1000000n!==discount||subtotal-discount!==units(invoice.totalExact4))return false;
  }
  return true;
 }catch{return false;}
}
