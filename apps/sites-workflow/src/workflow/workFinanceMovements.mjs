const exact4=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(value);
const id=value=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const currencies=['TRY','USD','EUR'];
const units=value=>BigInt(value.replace('.',''));
const amount=units=>{const negative=units<0n,magnitude=negative?-units:units;return `${negative?'-':''}${magnitude/10000n}.${String(magnitude%10000n).padStart(4,'0')}`;};

export function buildWorkFinanceMovements({salesContext,invoices,paymentContext}){
 const copy=operationCopyFromMeta(salesContext?.meta),synthetic=copy?false:true;
 if(salesContext?.scope?.synthetic!==synthetic||salesContext.scope.customer?.synthetic!==synthetic||!Array.isArray(salesContext.scope.accounts)||!Array.isArray(invoices)||!Array.isArray(paymentContext?.suppliers)||!Array.isArray(paymentContext?.accounts)||!Array.isArray(paymentContext?.payments))throw Error('Hareket kaynağı doğrulanamadı.');
 if(copy){tradeContext(salesContext);validatePaymentContext(paymentContext);const paymentCopy=operationCopyFromMeta(paymentContext.meta);if(paymentCopy?.copyId!==copy.copyId||paymentCopy.sealHash!==copy.sealHash||paymentContext.payments.some(p=>p.ownership!=='work'))throw Error('Hareket kaynağı doğrulanamadı.');invoices.forEach(invoice=>{tradeInvoice(invoice);if(invoice.documentDate!==copy.date)throw Error('Tahsilat kaynağı doğrulanamadı.');});}
 const customer=salesContext.scope.customer,customerAccount=salesContext.scope.accounts[0];
 if(!id(customer.id)||typeof customer.name!=='string'||!customerAccount||customerAccount.synthetic!==synthetic||!id(customerAccount.id)||typeof customerAccount.name!=='string'||customerAccount.currency!=='TRY')throw Error('Tahsilat hesabı doğrulanamadı.');
 const suppliers=new Map(paymentContext.suppliers.map(row=>[row.id,row])),accounts=new Map(paymentContext.accounts.map(row=>[row.id,row]));
 const rows=[];
 for(const invoice of invoices){
  if(invoice?.customerId!==customer.id||typeof invoice.documentNo!=='string'||!Array.isArray(invoice.collections?.items))throw Error('Tahsilat kaynağı doğrulanamadı.');
  for(const collection of invoice.collections.items){
   if(!id(collection.id)||collection.invoiceId!==invoice.id||collection.accountId!==customerAccount.id||!exact4(collection.amountExact4)||collection.currency!=='TRY'||!date(collection.documentDate)||copy&&collection.documentDate!==copy.date||!['active','cancelled'].includes(collection.status))throw Error('Tahsilat hareketi doğrulanamadı.');
   rows.push({id:`collection-${collection.id}`,sourceId:collection.id,date:collection.documentDate,kind:'Müşteri tahsilatı',partyType:'customer',partyId:customer.id,partyCode:customer.code,partyName:customer.name,currency:collection.currency,amountExact4:collection.amountExact4,direction:'in',accountId:customerAccount.id,accountName:customerAccount.name,reference:invoice.documentNo,status:collection.status==='active'?'Aktif':'Geri alındı',at:null});
   if(collection.status==='cancelled'){
    if(!id(collection.reversalId)||collection.reversalAccountId!==collection.accountId||collection.reversalAmountExact4!==collection.amountExact4||collection.reversalCurrency!==collection.currency||!date(collection.reversalDocumentDate)||typeof collection.reversalCreatedAt!=='string')throw Error('Tahsilat ters kaydı doğrulanamadı.');
    rows.push({id:`collection-reversal-${collection.reversalId}`,sourceId:collection.reversalId,date:collection.reversalDocumentDate,kind:'Tahsilat ters kaydı',partyType:'customer',partyId:customer.id,partyCode:customer.code,partyName:customer.name,currency:collection.currency,amountExact4:collection.amountExact4,direction:'out',accountId:customerAccount.id,accountName:customerAccount.name,reference:invoice.documentNo,status:'Ters kayıt',at:collection.reversalCreatedAt});
   }
  }
 }
 for(const movement of paymentContext.payments){
  const supplier=suppliers.get(movement.supplierId),account=accounts.get(movement.accountId);
  if(!id(movement.id)||!supplier||!account||supplier.currency!==movement.currency||account.currency!==movement.currency||!currencies.includes(movement.currency)||!exact4(movement.amountExact4)||!date(movement.documentDate)||!['payment','payment_cancel'].includes(movement.kind)||!['in','out'].includes(movement.direction))throw Error('Tedarikçi hareketi doğrulanamadı.');
  const reversal=movement.kind==='payment_cancel';
  rows.push({id:`supplier-${movement.id}`,sourceId:movement.id,date:movement.documentDate,kind:reversal?'Tedarikçi ödeme ters kaydı':'Tedarikçi ödemesi',partyType:'supplier',partyId:supplier.id,partyCode:supplier.code,partyName:supplier.name,currency:movement.currency,amountExact4:movement.amountExact4,direction:movement.direction,accountId:account.id,accountName:account.name,reference:movement.number||'-',status:reversal?'Ters kayıt':movement.reversedById!==null?'Geri alındı':'Aktif',at:null});
 }
 rows.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const summary=currencies.map(currency=>{const selected=rows.filter(row=>row.currency===currency);const incoming=selected.filter(row=>row.direction==='in').reduce((n,row)=>n+units(row.amountExact4),0n),outgoing=selected.filter(row=>row.direction==='out').reduce((n,row)=>n+units(row.amountExact4),0n);return {currency,incomingExact4:amount(incoming),outgoingExact4:amount(outgoing),netExact4:amount(incoming-outgoing),count:selected.length};});
 return {rows,summary,bankAccounts:paymentContext.accounts.filter(account=>account.type==='bank').map(account=>({id:account.id,name:account.name,currency:account.currency}))};
}
import {operationCopyFromMeta} from './isolatedOperationCopyModel.mjs';
import {tradeContext,tradeInvoice} from './workTradeModel.mjs';
import {paymentContext as validatePaymentContext} from './workSupplierPaymentsModel.mjs';
