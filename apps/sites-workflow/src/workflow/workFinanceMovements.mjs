const exact4=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(value);
const id=value=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const currencies=['TRY','USD','EUR'];
const units=value=>BigInt(value.replace('.',''));
const amount=units=>{const negative=units<0n,magnitude=negative?-units:units;return `${negative?'-':''}${magnitude/10000n}.${String(magnitude%10000n).padStart(4,'0')}`;};

const cleanEnvironmentId='e662fd94-d797-4b3b-938a-d143ad758b67';
const text=v=>typeof v==='string'&&v.trim().length>0;
const sameFields=(a,b,keys)=>keys.every(k=>a?.[k]===b?.[k]);
const collectionFields=['id','invoiceId','accountId','amountExact4','currency','documentDate','status','revision','reversalId','reversalAccountId','reversalAmountExact4','reversalCurrency','reversalDocumentDate','reversalCreatedAt'];
function sameRows(a,b,keys,key='id'){
 if(a.length!==b.length||new Set(a.map(r=>r[key])).size!==a.length||new Set(b.map(r=>r[key])).size!==b.length)return false;
 const rows=new Map(b.map(r=>[r[key],r]));return a.every(r=>rows.has(r[key])&&sameFields(r,rows.get(r[key]),keys));
}
function cleanCollectionSources(sales,payments,invoices,contexts){
 tradeContext(sales);validatePaymentContext(payments);
 if(sales.meta.environment!=='CLEAN_SYNTHETIC_TEST'||sales.meta.environmentId!==cleanEnvironmentId||sales.meta.cleanSaleReadOnly!==true||sales.meta.date!=='2026-10-22'||payments.meta.environmentId!==cleanEnvironmentId||payments.meta.date!==sales.meta.date||payments.capabilities.canView!==true||!Array.isArray(contexts)||contexts.length!==invoices.length)throw Error('Hareket kaynağı doğrulanamadı.');
 const accounts=new Map(payments.accounts.map(a=>[a.id,a])),sources=new Map(),parties=new Map(),listed=new Map(),originalIds=new Set();
 for(const i of invoices){tradeInvoice(i);if(listed.has(i.id)||i.documentDate!==sales.meta.date)throw Error('Tahsilat kaynağı doğrulanamadı.');listed.set(i.id,i);for(const c of i.collections.items){if(originalIds.has(c.id))throw Error('Tahsilat kaynağı doğrulanamadı.');originalIds.add(c.id);}}
 for(const c of contexts){
  tradeInvoice(c?.invoice);const i=listed.get(c.invoice.id),customer=c.customer;
  if(!i||sources.has(i.id)||c.meta!==undefined||c.revision!==c.invoice.collections.revision||!sameFields(i,c.invoice,['id','customerId','currency','documentNo','documentDate','status','revision','subtotalExact4','grandTotalExact4','amountTryExact4','customerBalanceExact4'])||!sameFields(i.collections,c.invoice.collections,['revision','receivedExact4','outstandingExact4'])||!sameRows(i.collections.items,c.invoice.collections.items,collectionFields)||!sameRows(i.items,c.invoice.items,['productId','stockCode','name','quantityExact3','unitPriceExact8','unitPriceExact4','lineTotalExact4','currency'],'productId'))throw Error('Tahsilat kaynağı doğrulanamadı.');
  if(!id(customer?.id)||customer.id!==i.customerId||customer.synthetic!==true||customer.writeEligible!==true||customer.currency!==i.currency||!text(customer.code)||!text(customer.name)||customer.balanceExact4!==i.customerBalanceExact4||!['canCollect','canCancelCollection'].every(k=>typeof c.capabilities?.[k]==='boolean')||!Array.isArray(c.accounts)||!c.accounts.length||new Set(c.accounts.map(a=>a.id)).size!==c.accounts.length)throw Error('Tahsilat hesabı doğrulanamadı.');
  if(parties.has(customer.id)&&!sameFields(customer,parties.get(customer.id),['code','name','currency']))throw Error('Tahsilat hesabı doğrulanamadı.');parties.set(customer.id,customer);
  for(const a of c.accounts){const shared=accounts.get(a.id);if(!id(a.id)||a.synthetic!==true||!text(a.code)||!text(a.name)||a.currency!==i.currency||!shared||!sameFields(a,shared,['id','code','name','currency','type']))throw Error('Tahsilat hesabı doğrulanamadı.');}
  const received=i.collections.items.filter(r=>r.status==='active').reduce((sum,r)=>sum+units(r.amountExact4),0n),total=units(i.grandTotalExact4);
  if(received!==units(i.collections.receivedExact4)||received<0n||received>total||units(i.collections.outstandingExact4)!==(i.status==='finalized'?total-received:0n))throw Error('Tahsilat kaynağı doğrulanamadı.');
  sources.set(i.id,{customer,accounts:new Map(c.accounts.map(a=>[a.id,a]))});
 }
 const movements=new Map(payments.payments.map(p=>[p.id,p]));
 for(const p of payments.payments){
  if(p.ownership!=='work'||p.documentDate!==sales.meta.date)throw Error('Tedarikçi hareketi doğrulanamadı.');
  const other=p.kind==='payment_cancel'?movements.get(p.originalId):p.reversedById===null?null:movements.get(p.reversedById);
  if(p.kind==='payment_cancel'&&(!other||other.kind!=='payment'||other.reversedById!==p.id)||p.kind==='payment'&&p.reversedById!==null&&(!other||other.kind!=='payment_cancel'||other.originalId!==p.id)||other&&!sameFields(p,other,['supplierId','accountId','invoiceId','currency','amountExact4']))throw Error('Tedarikçi ters kaydı doğrulanamadı.');
 }
 return {sources,originalIds};
}

export function buildWorkFinanceMovements({salesContext,invoices,paymentContext,collectionContexts}){
 const copy=operationCopyFromMeta(salesContext?.meta),synthetic=copy?false:true;
 if(salesContext?.scope?.synthetic!==synthetic||salesContext.scope.customer?.synthetic!==synthetic||!Array.isArray(salesContext.scope.accounts)||!Array.isArray(invoices)||!Array.isArray(paymentContext?.suppliers)||!Array.isArray(paymentContext?.accounts)||!Array.isArray(paymentContext?.payments))throw Error('Hareket kaynağı doğrulanamadı.');
 if(copy){tradeContext(salesContext);validatePaymentContext(paymentContext);const paymentCopy=operationCopyFromMeta(paymentContext.meta);if(paymentCopy?.copyId!==copy.copyId||paymentCopy.sealHash!==copy.sealHash||paymentContext.payments.some(p=>p.ownership!=='work'))throw Error('Hareket kaynağı doğrulanamadı.');invoices.forEach(invoice=>{tradeInvoice(invoice);if(invoice.documentDate!==copy.date)throw Error('Tahsilat kaynağı doğrulanamadı.');});}
 const clean=salesContext.meta?.cleanSaleReadOnly===true||salesContext.meta?.environment==='CLEAN_SYNTHETIC_TEST'||salesContext.meta?.environmentId===cleanEnvironmentId;
 if(clean&&copy||!clean&&collectionContexts!==undefined)throw Error('Hareket kaynağı doğrulanamadı.');
 const verified=clean?cleanCollectionSources(salesContext,paymentContext,invoices,collectionContexts):null,reversals=new Set();
 const legacyCustomer=salesContext.scope.customer,legacyAccount=salesContext.scope.accounts[0];
 if(!clean&&(!id(legacyCustomer.id)||typeof legacyCustomer.name!=='string'||!legacyAccount||legacyAccount.synthetic!==synthetic||!id(legacyAccount.id)||typeof legacyAccount.name!=='string'||legacyAccount.currency!=='TRY'))throw Error('Tahsilat hesabı doğrulanamadı.');
 const suppliers=new Map(paymentContext.suppliers.map(row=>[row.id,row])),accounts=new Map(paymentContext.accounts.map(row=>[row.id,row]));
 const rows=[];
 for(const invoice of invoices){
  const source=verified?.sources.get(invoice.id),customer=clean?source.customer:legacyCustomer;
  if(invoice?.customerId!==customer.id||typeof invoice.documentNo!=='string'||!Array.isArray(invoice.collections?.items))throw Error('Tahsilat kaynağı doğrulanamadı.');
  for(const collection of invoice.collections.items){
   const customerAccount=clean?source.accounts.get(collection.accountId):legacyAccount;
   if(!id(collection.id)||collection.invoiceId!==invoice.id||!customerAccount||collection.accountId!==customerAccount.id||!exact4(collection.amountExact4)||collection.currency!==(clean?invoice.currency:'TRY')||customerAccount.currency!==collection.currency||!date(collection.documentDate)||copy&&collection.documentDate!==copy.date||clean&&(units(collection.amountExact4)<=0n||collection.documentDate!==salesContext.meta.date)||!['active','cancelled'].includes(collection.status))throw Error('Tahsilat hareketi doğrulanamadı.');
   if(clean&&collection.status==='active'&&['reversalId','reversalAccountId','reversalAmountExact4','reversalCurrency','reversalDocumentDate','reversalCreatedAt'].some(k=>collection[k]!=null))throw Error('Tahsilat ters kaydı doğrulanamadı.');
   rows.push({id:`collection-${collection.id}`,sourceId:collection.id,date:collection.documentDate,kind:'Müşteri tahsilatı',partyType:'customer',partyId:customer.id,partyCode:customer.code,partyName:customer.name,currency:collection.currency,amountExact4:collection.amountExact4,direction:'in',accountId:customerAccount.id,accountName:customerAccount.name,reference:invoice.documentNo,status:collection.status==='active'?'Aktif':'Geri alındı',at:null});
   if(collection.status==='cancelled'){
    if(!id(collection.reversalId)||collection.reversalAccountId!==collection.accountId||collection.reversalAmountExact4!==collection.amountExact4||collection.reversalCurrency!==collection.currency||!date(collection.reversalDocumentDate)||typeof collection.reversalCreatedAt!=='string')throw Error('Tahsilat ters kaydı doğrulanamadı.');
    if(clean&&(verified.originalIds.has(collection.reversalId)||reversals.has(collection.reversalId)||collection.reversalDocumentDate!==salesContext.meta.date||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(collection.reversalCreatedAt)||!paymentDate(collection.reversalCreatedAt.slice(0,10))))throw Error('Tahsilat ters kaydı doğrulanamadı.');
    reversals.add(collection.reversalId);
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
import {paymentContext as validatePaymentContext,paymentDate} from './workSupplierPaymentsModel.mjs';
