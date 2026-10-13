import {createHash} from 'node:crypto';
import {assertIsolatedCopyContext,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';

const fail=()=>{throw Object.assign(new Error('Satış fiyatının kayıtlı sürümü doğrulanamadı.'),{code:'BUSINESS_PRICE_SALE_PROOF',statusCode:503});};
const check=v=>{if(!v)fail();};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===k.toSorted().join();
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const amount=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,19})\.\d{8}$/.test(v);
const pricingKeys=['origin','versionId','sourcePriceExact8','nativeRowHash','bindingHash','priceExact8','versionProofHash'];

// Pure content verification only. This does not register a writer or authenticate
// a native result. The transaction owner must first verify the installed reader,
// current native permissions, scope and same connection/transaction provenance.
export function validateBusinessProductPriceSaleDTO(copy,dto,pricingJson,expected,{mode='CURRENT',invoiceId=null}={}){
  assertIsolatedCopyContext(copy);
  check(keys(expected,['profileHash','priceRevisionHash','saleRevisionHash','readerDefinitionHash'])&&Object.values(expected).every(hash));
  check(['CURRENT','HISTORY'].includes(mode)&&(mode==='CURRENT'?invoiceId===null:id(invoiceId)));
  const proof=dto?.pricingProof;
  check(keys(proof,['schemaVersion','copyId','sealHash','profileHash','priceRevisionHash','saleRevisionHash','readerDefinitionHash','mode','invoiceId','pricingHash'])&&proof.schemaVersion==='melisa-business-product-price-sale-proof.v1'&&proof.copyId===copy.copyId&&proof.sealHash===copy.sealHash&&proof.mode===mode&&proof.invoiceId===invoiceId&&Object.entries(expected).every(([k,v])=>proof[k]===v));
  check(typeof pricingJson==='string'&&pricingJson.length<=2000000&&hash(proof.pricingHash)&&createHash('sha256').update(pricingJson,'utf16le').digest('hex').toUpperCase()===proof.pricingHash);
  let rows;try{rows=JSON.parse(pricingJson);}catch{fail();}
  check(Array.isArray(rows)&&rows.length>0&&rows.length<=1200&&Array.isArray(dto.scope?.products));
  const seen=new Set();
  for(const row of rows){
    check(keys(row,['productId','quoteId','currency','pricing'])&&id(row.productId)&&id(row.quoteId)&&['TRY','USD','EUR'].includes(row.currency));
    const key=`${row.productId}:${row.quoteId}`;check(!seen.has(key));seen.add(key);
    const sources=copy.products.filter(p=>p.id===row.productId),product=sources[0];
    check(sources.length===1&&product.identityVerified&&product.sourceKnown&&!product.quarantined);
    const quotes=product.quotes.filter(q=>q.quoteId===row.quoteId&&q.currency===row.currency&&q.type==='sale'&&q.verified&&q.mainUnit);
    check(quotes.length===1);const source=quotes[0],p=row.pricing;
    check(keys(p,pricingKeys)&&['SOURCE','MANUAL'].includes(p.origin)&&amount(p.priceExact8)&&p.sourcePriceExact8===source.priceExact8&&p.nativeRowHash===source.nativeRowHash.toUpperCase()&&p.bindingHash===source.bindingHash.toUpperCase());
    check(p.origin==='SOURCE'?p.versionId===null&&p.versionProofHash===null&&p.priceExact8===p.sourcePriceExact8:id(p.versionId)&&hash(p.versionProofHash));
    const nativeProducts=dto.scope.products.filter(p=>p.id===row.productId);check(nativeProducts.length===1);
    const nativeQuotes=nativeProducts[0].prices?.filter(q=>q.quoteId===row.quoteId&&q.currency===row.currency);check(nativeQuotes?.length===1);
    check(nativeQuotes[0].unitPriceExact8===p.priceExact8&&isolatedCopyJSON(nativeQuotes[0].pricing)===isolatedCopyJSON(p));
  }
  check(new Set(dto.scope.products.map(p=>p.id)).size===dto.scope.products.length&&dto.scope.products.every(p=>Array.isArray(p.prices)&&p.prices.length>0&&new Set(p.prices.map(q=>q.quoteId)).size===p.prices.length)&&dto.scope.products.reduce((n,p)=>n+p.prices.length,0)===rows.length);
  return Object.freeze({proof:Object.freeze({...proof}),pricingJson,rows:Object.freeze(rows.map(r=>Object.freeze({...r,pricing:Object.freeze({...r.pricing})})))});
}
