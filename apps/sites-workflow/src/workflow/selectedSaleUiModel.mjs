import {operationCopyEntity} from './isolatedOperationCopyModel.mjs';
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const currencies=['TRY','USD','EUR'];
const bad=()=>{throw Error('Satış seçimi doğrulanamadı. Yenileyerek tekrar deneyin.');};
export function selectedSaleOptions(value){
 if(!value||typeof value.enabled!=='boolean')bad();
 if(!value.enabled)return {enabled:false};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||value.maxItems!==200||!Array.isArray(value.customers)||!Array.isArray(value.products))bad();
 if(value.customers.some(c=>!id(c.id)||typeof c.code!=='string'||typeof c.name!=='string'||!currencies.includes(c.currency))||new Set(value.customers.map(c=>c.id+':'+c.currency)).size!==value.customers.length)bad();
 if(value.products.some(p=>!id(p.id)||typeof p.stockCode!=='string'||typeof p.name!=='string'||!Array.isArray(p.barcodes)||p.barcodes.some(b=>typeof b!=='string'||!b)||!Array.isArray(p.currencies)||!p.currencies.length||p.currencies.some(c=>!currencies.includes(c)))||new Set(value.products.map(p=>p.id)).size!==value.products.length)bad();
 return value;
}
export const isSelectedSaleContext=c=>c?.meta?.selectedSale!==undefined;
export function selectedSaleContext(c,copy){
 const s=c?.meta?.selectedSale;
 if(!copy||copy.scopeKind!=='VERIFIED_BUSINESS_TEST'||c.meta.businessDailyScopeHash!==undefined||s?.source!=='SOURCE'||!id(s.customerId)||!id(s.customerAccountId)||!currencies.includes(s.currency)||!Array.isArray(s.productIds)||!s.productIds.length||s.productIds.length>200||new Set(s.productIds).size!==s.productIds.length||s.productIds.some(p=>!id(p)))bad();
 const expected=copy.customers.filter(p=>p.id===s.customerId&&p.accountId===s.customerAccountId&&p.currency===s.currency);
 const customer=c.scope?.customer;
 if(expected.length!==1||customer?.id!==s.customerId||customer.accountId!==s.customerAccountId||customer.partyId!==expected[0].partyId||customer.sourceKey!==expected[0].sourceKey||customer.currency!==s.currency||c.scope.accounts?.length!==0||c.supportedCurrencies?.length!==1||c.supportedCurrencies[0]!==s.currency||c.limits?.maxItems!==200||c.limits.maxInvoiceAmountExact4!=='20000.0000'||c.limits.maxQuantityPerLine!==2147483647||c.scope.products?.length!==s.productIds.length)bad();
 operationCopyEntity(customer,'customers',copy);
 for(const p of c.scope.products){if(!s.productIds.includes(p.id)||Object.hasOwn(p,'costExact4'))bad();operationCopyEntity(p,'products',copy);for(const q of p.prices??[])selectedSaleQuote(q,p.id,copy,s.currency);}
 return s;
}
export function selectedSaleQuote(q,productId,copy,currency){
 const source=copy.products.find(p=>p.id===productId);
 if(!source||!source.priceIds.includes(q?.quoteId)||q.currency!==currency||q.source?.kind!=='isolated-test-copy'||q.source.copyId!==copy.copyId||q.source.sealHash!==copy.sealHash||!hash(q.revision))bad();
 return q;
}
export function selectedSaleRequest(customerId,currency,productIds){
 if(!id(customerId)||!currencies.includes(currency)||!Array.isArray(productIds)||!productIds.length||productIds.length>200||productIds.some(p=>!id(p))||new Set(productIds).size!==productIds.length)bad();
 return {customerId,currency,productIds:[...productIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)};
}
// A slower read must never replace a newer customer/currency selection or its
// basket. This fence has no storage/journal authority.
export function createSelectedSaleReadFence(){let generation=0;return {next(){return ++generation;},current(value){return generation===value;},invalidate(){generation++;}};}
