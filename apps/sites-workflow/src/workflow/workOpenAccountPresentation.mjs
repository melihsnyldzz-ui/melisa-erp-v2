import {tradeExact,tradeId,tradeInvoice} from './workTradeModel.mjs';
const currencies=['TRY','USD','EUR'];
const bad=()=>{throw Error('Müşteri geçmişi doğrulanamadı.');};
export const unknownInvoiceDue='Vade bilgisi kayıtlı değil';
export function invoicePaymentState(invoice){
 const result=(state,label)=>({state,label,due:unknownInvoiceDue});
 if(invoice?.status==='draft')return result('draft','Taslak');
 if(invoice?.status==='cancelled')return result('cancelled','İptal edildi');
 const unknown=()=>result('unknown','Tahsilat durumu doğrulanamadı');
 if(invoice?.status!=='finalized'||!tradeId(invoice.id)||!currencies.includes(invoice.currency)||!tradeExact(invoice.grandTotalExact4,4)||!tradeExact(invoice.collections?.receivedExact4,4)||!tradeExact(invoice.collections?.outstandingExact4,4)||!Array.isArray(invoice.collections.items))return unknown();
 const units=v=>BigInt(v.replace('.','')),total=units(invoice.grandTotalExact4),received=units(invoice.collections.receivedExact4),outstanding=units(invoice.collections.outstandingExact4);
 if(total<=0n||received<0n||outstanding<0n||received+outstanding!==total)return unknown();
 let active=0n;const ids=new Set();
 for(const item of invoice.collections.items){if(!tradeId(item.id)||ids.has(item.id)||item.invoiceId!==invoice.id||item.currency!==invoice.currency||!['active','cancelled'].includes(item.status)||!tradeExact(item.amountExact4,4)||units(item.amountExact4)<=0n)return unknown();ids.add(item.id);if(item.status==='active')active+=units(item.amountExact4);}
 if(active!==received)return unknown();
 return received===0n?result('unpaid','Açık hesap'):outstanding===0n?result('paid','Tamamı tahsil edildi'):result('partial','Kısmi tahsilat');
}
export function invoiceCustomerName(invoice,{contextCustomer,sourceOptions}={}){
 const unknown='Müşteri bilgisi doğrulanamadı';if(!tradeId(invoice?.customerId)||!currencies.includes(invoice.currency))return unknown;
 if(sourceOptions?.enabled===true&&Array.isArray(sourceOptions.customers)){const matches=sourceOptions.customers.filter(c=>c.id===invoice.customerId&&c.currency===invoice.currency);if(matches.length>1)return unknown;if(matches.length===1&&typeof matches[0].name==='string'&&matches[0].name.trim())return matches[0].name;}
 return contextCustomer?.id===invoice.customerId&&contextCustomer.currency===invoice.currency&&typeof contextCustomer.name==='string'&&contextCustomer.name.trim()?contextCustomer.name:unknown;
}
export function customerHistoryCurrencies(card){return currencies.filter(currency=>Array.isArray(card?.accounts)&&card.accounts.some(a=>(tradeId(a.accountId)||card.source?.status==='synthetic'&&a.nativeCustomerId===String(card.id))&&a.currency===currency));}
export function customerHistoryPath({customerId,currency,page=1}={}){if(!tradeId(customerId)||!currencies.includes(currency)||!Number.isInteger(page)||page<1||page>10000)bad();return '/api/work-sales/invoices?'+new URLSearchParams({page:String(page),limit:'25',customerId,currency});}
export function validateCustomerHistory(value,selection){customerHistoryPath(selection);const m=value?.meta,p=selection.page??1;if(!m||m.page!==p||m.limit!==25||!Number.isSafeInteger(m.total)||m.total<0||!Array.isArray(value.data)||value.data.length!==Math.min(25,Math.max(0,m.total-(p-1)*25)))bad();const ids=new Set();for(const invoice of value.data){tradeInvoice(invoice);if(invoice.customerId!==selection.customerId||invoice.currency!==selection.currency||ids.has(invoice.id))bad();ids.add(invoice.id);}return value;}
export function createCustomerHistoryReader(read){let active=true,version=0;return {invalidate(){version++;},dispose(){active=false;version++;},async load(selection){const n=++version,path=customerHistoryPath(selection);try{const value=await read(path);if(!active||n!==version)return {stale:true};return {stale:false,value:validateCustomerHistory(value,selection)};}catch(error){if(!active||n!==version)return {stale:true};throw error;}}};}
