// A read-only selection contract, never a draft, settlement or write authority.
export const businessSaleReadSchema='melisa-business-sale-read.v1';
export const businessSaleReadKeys=Object.freeze(['customerId','accountId','currency','productId','priceId','unitSourceId','tier']);
export const businessSaleReadError=(code='BUSINESS_SALE_READ_INVALID',statusCode=503)=>Object.assign(new Error('Satış seçimi doğrulanamadı.'),{code,statusCode});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const exact=(v,scale)=>typeof v==='string'&&new RegExp(`^-?(?:0|[1-9]\\d{0,19})\\.\\d{${scale}}$`).test(v);
const balance=v=>v===null||typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})\.\d{1,8}$/.test(v);
const text=v=>typeof v==='string'&&v.length>0;
const fail=()=>{throw businessSaleReadError();};
function validateCustomerAccountBalance(a){
 if(!balance(a.balanceExact)||!['B','A','ZERO',null].includes(a.debitCreditDirection)||!balance(a.amountExact))fail();
 if(a.balanceExact===null){if(a.amountExact!==null||a.debitCreditDirection!==null)fail();}
 else {const amount=a.balanceExact.replace(/^-/,'');const direction=BigInt(amount.replace('.',''))===0n?'ZERO':a.balanceExact.startsWith('-')?'A':'B';if(a.amountExact!==amount||a.debitCreditDirection!==direction)fail();}
}
export function parseBusinessSaleReadQuery(query){
 if(!object(query)||Object.keys(query).sort().join(',')!==[...businessSaleReadKeys].sort().join(',')||!['customerId','accountId','productId','priceId','unitSourceId'].every(k=>id(query[k]))||!['TRY','USD','EUR'].includes(query.currency)||typeof query.tier!=='string'||! /^[1-6]$/.test(query.tier))throw businessSaleReadError('BUSINESS_SALE_SELECTION_INVALID',400);
 return Object.fromEntries(businessSaleReadKeys.map(k=>[k,query[k]]));
}
export function businessSaleReadPath(query){return '/api/business-sales/selection?'+new URLSearchParams(parseBusinessSaleReadQuery(query));}
export function businessSaleReadPathAllowed(path){
 if(typeof path!=='string'||!path.startsWith('/api/business-sales/selection?')||path.includes('#')||path.includes('\\'))return false;
 try{const params=new URLSearchParams(path.slice(path.indexOf('?')+1));if([...params.keys()].length!==businessSaleReadKeys.length)return false;parseBusinessSaleReadQuery(Object.fromEntries(params));return true;}catch{return false;}
}
export function buildBusinessSaleReadSelection(query,customer,catalog){
 const q=parseBusinessSaleReadQuery(query),c=customer?.data,p=catalog?.data,m=catalog?.meta;
 if(customer?.meta?.readOnly!==true||customer.meta.freshLive!==false||!object(c)||c.id!==q.customerId||!text(c.customerCode)||!text(c.customerName)||typeof c.isPassive!=='boolean'||!object(c.quarantine)||!Array.isArray(c.accounts)||m?.readOnly!==true||m.freshLive!==false||m.schemaVersion!=='melisa-catalog.v1'||m.canViewSalesPrices!==true||!text(m.readAt)||!Number.isFinite(Date.parse(m.readAt))||!object(p)||p.id!==q.productId||!text(p.stockCode)||typeof p.isActive!=='boolean'||!object(p.unit)||!object(p.hold)||typeof p.hold.blocked!=='boolean'||!Array.isArray(p.salePrices)||!Array.isArray(p.barcodes)||!(p.stockQuantityExact===null||exact(p.stockQuantityExact,8)))fail();
 const accounts=c.accounts.filter(a=>a.accountId===q.accountId&&a.currency===q.currency);
 if(accounts.length!==1)throw businessSaleReadError('BUSINESS_SALE_ACCOUNT_CHANGED',409);
 const a=accounts[0];validateCustomerAccountBalance(a);
 if(p.hold.blocked)throw businessSaleReadError('BUSINESS_SALE_PRODUCT_HELD',409);
 const quotes=p.salePrices.filter(v=>v.id===q.priceId&&v.type==='sale'&&v.unitSourceId===q.unitSourceId&&v.currency===q.currency&&v.tier===Number(q.tier));
 if(quotes.length!==1)throw businessSaleReadError('BUSINESS_SALE_PRICE_CHANGED',409);
 const price=quotes[0];if(!(price.priceExact===null||exact(price.priceExact,8))||typeof price.isMainUnit!=='boolean'||!text(price.sourceKey))fail();
 const issues=[];
 if(c.isPassive)issues.push('CUSTOMER_PASSIVE');
 if(c.quarantine.blocked!==false)issues.push('CUSTOMER_HOLD_OR_UNVERIFIED');
 if(c.source?.status!=='accepted-opening')issues.push('CUSTOMER_SOURCE_UNVERIFIED');
 if(a.reconciled!==true||a.confidence!=='source-matched'||a.balanceExact===null)issues.push('CUSTOMER_ACCOUNT_UNVERIFIED');
 if(!p.isActive)issues.push('PRODUCT_PASSIVE');
 if(p.hold.blocked)issues.push('PRODUCT_HOLD');
 if(p.provenance?.kind!=='accepted-opening'||p.provenance.verified!==true)issues.push('PRODUCT_SOURCE_UNVERIFIED');
 if(p.unit.verified!==true||p.unit.sourceId!==q.unitSourceId||p.unit.label!=='ADET'||p.unit.factorExact8!=='1.00000000'||price.isMainUnit!==true)issues.push('UNIT_NOT_SUPPORTED');
 if(p.stockQuantityExact===null)issues.push('STOCK_UNKNOWN');
 if(price.priceExact===null)issues.push('PRICE_UNKNOWN');
 else if(BigInt(price.priceExact.replace('.',''))<=0n)issues.push('POSITIVE_PRICE_REQUIRED');
 const barcodes=p.barcodes.map(b=>{if(!id(b.id)||!text(b.value)||typeof b.isPrimary!=='boolean')fail();return {id:b.id,value:b.value,isPrimary:b.isPrimary};});
 if(new Set(barcodes.map(b=>b.id)).size!==barcodes.length)fail();
 return {selection:q,customer:{id:c.id,code:c.customerCode,name:c.customerName,account:{id:a.accountId,currency:a.currency,balanceExact:a.balanceExact,debitCreditDirection:a.debitCreditDirection,amountExact:a.amountExact,reconciled:a.reconciled===true}},product:{id:p.id,stockCode:p.stockCode,displayCode:p.displayCode??p.stockCode,name:p.productName??null,stockQuantityExact:p.stockQuantityExact,unit:{sourceId:p.unit.sourceId,label:p.unit.label,factorExact8:p.unit.factorExact8,verified:p.unit.verified===true},barcodes},price:{id:price.id,unitSourceId:price.unitSourceId,tier:price.tier,currency:price.currency,priceExact:price.priceExact,sourceKey:price.sourceKey},selectionVerified:issues.length===0,issues,capabilities:{canSave:false,canFinalize:false,canCollect:false},readEvidence:{customerSourceAsOf:customer.meta.sourceAsOf??null,productSourceAsOf:m.sourceAsOf??null,productReadAt:m.readAt,atomic:false,freshLive:false}};
}
export function validateBusinessSaleReadEnvelope(value,query){
 const q=parseBusinessSaleReadQuery(query),d=value?.data,m=value?.meta;
 if(value?.success!==true||m?.schemaVersion!==businessSaleReadSchema||m.profile!=='ERP-5244-REALDATA-20261027'||m.actorId!=='17'||m.readOnly!==true||m.actualT1!==false||m.externalOperations!==false||m.writeAuthorized!==false||!object(d)||!object(d.selection)||Object.keys(d.selection).length!==businessSaleReadKeys.length||!businessSaleReadKeys.every(k=>d.selection[k]===q[k])||d.customer?.id!==q.customerId||d.customer.account?.id!==q.accountId||d.customer.account.currency!==q.currency||d.product?.id!==q.productId||d.price?.id!==q.priceId||d.price.unitSourceId!==q.unitSourceId||d.price.tier!==Number(q.tier)||d.price.currency!==q.currency||typeof d.selectionVerified!=='boolean'||!Array.isArray(d.issues)||d.issues.some(v=>! /^[A-Z_]+$/.test(v))||d.selectionVerified!==(d.issues.length===0)||d.capabilities?.canSave!==false||d.capabilities.canFinalize!==false||d.capabilities.canCollect!==false||d.readEvidence?.atomic!==false||d.readEvidence.freshLive!==false||!(d.price.priceExact===null||exact(d.price.priceExact,8))||!balance(d.customer.account.balanceExact)||!balance(d.customer.account.amountExact)||!(d.product.stockQuantityExact===null||exact(d.product.stockQuantityExact,8))||!object(d.product.unit)||!Array.isArray(d.product.barcodes)||d.product.barcodes.some(b=>!id(b.id)||!text(b.value)||typeof b.isPrimary!=='boolean'))fail();
 if(d.selectionVerified&&(d.price.priceExact===null||BigInt(d.price.priceExact.replace('.',''))<=0n||d.product.unit.sourceId!==q.unitSourceId||d.product.unit.label!=='ADET'||d.product.unit.factorExact8!=='1.00000000'||d.product.unit.verified!==true||d.product.stockQuantityExact===null||d.customer.account.reconciled!==true||d.customer.account.balanceExact===null))fail();
 validateCustomerAccountBalance(d.customer.account);
 return value;
}
