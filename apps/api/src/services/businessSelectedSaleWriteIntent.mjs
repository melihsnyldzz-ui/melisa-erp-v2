import {assertIsolatedCopyContext,BUSINESS_COPY_DATABASE,copyAssert,isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {workKeys,workId,workScaled,workBusinessCurrencyRate} from './workSalesModel.mjs';

const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const hash=value=>typeof value==='string'&&/^[A-F0-9]{64}$/i.test(value);
const optionsCache=new WeakMap();
function sourceCustomer(copy,customerId,currency){
 const matches=copy.customers.filter(p=>p.id===customerId&&p.currency===currency),customer=matches[0];
 copyAssert(matches.length===1&&customer.sourceKnown===true&&customer.accountIdentityVerified===true&&customer.sourceAccountWitnessCount===1&&customer.openingHumanAccepted===false&&!customer.quarantined&&!customer.excludedLL&&!['591','592'].includes(customerId)&&hash(customer.sourceWitnessHash),'SELECTED_SALE_SOURCE_CUSTOMER');
 return customer;
}
function sourceProduct(copy,id,currency){
 const rows=copy.products.filter(p=>p.id===id),p=rows[0];
 copyAssert(rows.length===1&&p.identityVerified===true&&p.sourceKnown===true&&!p.quarantined&&hash(p.sourceWitnessHash)&&p.unit==='ADET'&&p.unitFactorExact8==='1.00000000'&&workScaled(p.costExact4,4)>0n&&workScaled(p.stockUnitCostTryExact8,8)===workScaled(p.costExact4,4)*10000n,'SELECTED_SALE_SOURCE_COST_UNIT');
 const quotes=p.quotes.filter(q=>q.currency===currency&&q.type==='sale'&&q.verified===true&&q.mainUnit===true).toSorted((a,b)=>BigInt(a.quoteId)<BigInt(b.quoteId)?-1:1);
 copyAssert(quotes.length>0&&new Set(quotes.map(q=>q.quoteId)).size===quotes.length&&quotes.every(q=>p.priceIds.includes(q.quoteId)&&workScaled(q.priceExact8,8)>0n&&hash(q.nativeRowHash)&&hash(q.bindingHash)),'SELECTED_SALE_SOURCE_QUOTE');
 return {id:p.id,sourceKey:p.sourceKey,sourceWitnessHash:p.sourceWitnessHash,costExact4:p.costExact4,quotes:structuredClone(quotes)};
}
// Only immutable SOURCE eligibility is cached. Every selection still reads
// current native stock, account, quote and revision before preview or writing.
export function businessSelectedSaleOptions(copy){
 assertIsolatedCopyContext(copy);copyAssert(copy.target.database===BUSINESS_COPY_DATABASE&&copy.businessInvoiceMaxExact4==='20000.0000','SELECTED_SALE_SOURCE_POLICY');
 if(optionsCache.has(copy))return optionsCache.get(copy);
 const customers=[],products=[];
 for(const currency of ['TRY','USD','EUR']){
  try{workBusinessCurrencyRate(copy,currency);}catch{continue;}
  const eligibleCustomers=copy.customers.filter(c=>{if(c.currency!==currency)return false;try{sourceCustomer(copy,c.id,currency);return true;}catch{return false;}});
  if(!eligibleCustomers.length)continue;
  const eligibleProducts=copy.products.filter(p=>{try{sourceProduct(copy,p.id,currency);return true;}catch{return false;}});
  if(!eligibleProducts.length)continue;
  customers.push(...eligibleCustomers.map(({id,code,name,currency})=>({id,code,name,currency})));
  for(const p of eligibleProducts){let row=products.find(x=>x.id===p.id);if(!row){row={id:p.id,stockCode:p.stockCode,name:p.name,barcodes:[...p.barcodes],currencies:[]};products.push(row);}row.currencies.push(currency);}
 }
 const result=freeze({enabled:true,date:copy.date,maxItems:200,customers,products});optionsCache.set(copy,result);return result;
}

// SOURCE identity and policy preparation only. Neither this value nor the
// read-only preview grants access to an invoice writer. The native same-TX
// intent and existing copy guards must authorize every later mutation.
export function selectBusinessSaleWriteIntent(copy,input){
 assertIsolatedCopyContext(copy);workKeys(input,['customerId','currency','productIds']);
 copyAssert(copy.target.database===BUSINESS_COPY_DATABASE,'SELECTED_SALE_DB02_ONLY');
 const customerId=workId(input.customerId),currency=input.currency,rate=workBusinessCurrencyRate(copy,currency);
 const customer=sourceCustomer(copy,customerId,currency);
 copyAssert(Array.isArray(input.productIds)&&input.productIds.length>0&&input.productIds.length<=200,'SELECTED_SALE_ITEMS',400);
 const productIds=input.productIds.map(workId).toSorted((a,b)=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0);
 copyAssert(new Set(productIds).size===productIds.length,'SELECTED_SALE_ITEMS',400);
 const products=productIds.map(id=>sourceProduct(copy,id,currency));
 copyAssert(copy.businessInvoiceMaxExact4==='20000.0000','SELECTED_SALE_SOURCE_POLICY');
 const policy={schemaVersion:'melisa-selected-sale-intent-policy.v1',copyId:copy.copyId,sealHash:copy.sealHash,profileHash:isolatedCopyHash(copy),maxItems:200,maxInvoiceAmountExact4:copy.businessInvoiceMaxExact4,quantity:'POSITIVE_WHOLE_MAIN_UNIT',currency,role:'customer',operations:['sale_draft','sale_finalize','sale_cancel']};
 const source={copyId:copy.copyId,sealHash:copy.sealHash,customer:structuredClone(customer),currency,productIds,products,rate:structuredClone(rate)};
 return freeze({copyId:copy.copyId,sealHash:copy.sealHash,customerId,customerAccountId:customer.accountId,partyId:customer.partyId,currency,productIds,rateExact8:rate.rateExact8,maxInvoiceAmountExact4:policy.maxInvoiceAmountExact4,maxItems:policy.maxItems,sourceSelectionHash:isolatedCopyHash(source),policyHash:isolatedCopyHash(policy)});
}
