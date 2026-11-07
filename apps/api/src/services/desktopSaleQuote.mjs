// Read-only TRY preview. PR54 normalizes unrounded line values before applying
// the invoice-wide percentage. Never use rounded line totals as its subtotal.
const fail=()=>{throw Object.assign(Error('DESKTOP_SALE_QUOTE_UNVERIFIED'),{code:'DESKTOP_SALE_QUOTE_UNVERIFIED'});};
const units=(value,scale)=>{if(typeof value!=='string'||!new RegExp(`^(?:0|[1-9]\\d{0,13})\\.\\d{${scale}}$`).test(value))fail();const n=BigInt(value.replace('.',''));if(n>BigInt(Number.MAX_SAFE_INTEGER))fail();return n;};
const fixed=n=>{const s=n.toString().padStart(5,'0');return s.slice(0,-4)+'.'+s.slice(-4);};
const rounded=(n,d)=>(n+d/2n)/d;
function parity(native,expected){const n=Math.round(native*10000);if(!Number.isFinite(native)||native<0||!Number.isSafeInteger(n)||BigInt(n)!==expected)fail();return fixed(expected);}
export function desktopSaleQuote({prepared,locked,discountRateExact4,maxDiscountRateExact4,normalizeSalesPayload}={}){
 const rate=units(discountRateExact4,4),limit=units(maxDiscountRateExact4,4);
 if(limit>999999n||typeof normalizeSalesPayload!=='function'||!prepared?.invoice||prepared.invoice.documentCurrency!=='TRY'||!Array.isArray(prepared.expected?.lines)||prepared.expected.lines.length!==2||locked?.products?.length!==2)fail();
 if(rate>limit)throw Object.assign(Error('DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED'),{code:'DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED'});
 const base=prepared.expected.lines.reduce((sum,l)=>sum+units(l.quantityExact3,3)*units(l.unitPriceExact4,4),0n);
 const native=normalizeSalesPayload({...prepared.invoice,discountRate:Number(discountRateExact4)});
 const subtotalExact4=parity(native.subtotal,rounded(base,1000n)),discountTotalExact4=parity(native.discountTotal,rounded(base*rate,1000000000n)),totalExact4=parity(native.grandTotal,rounded(base*(1000000n-rate),1000000000n));
 const lines=prepared.expected.lines.map((l,i)=>{const n=native.items[i];if(String(n.productId)!==l.productId||Number(l.quantityExact3)!==n.quantity||Number(l.unitPriceExact4)!==n.unitPrice)fail();return {productId:l.productId,quantityExact3:l.quantityExact3,unitPriceExact4:l.unitPriceExact4,lineTotalExact4:parity(n.lineTotal,units(l.lineTotalExact4,4))};});
 const belowCostWarning=locked.products.some(p=>units(p.priceExact4,4)*(1000000n-rate)<units(p.averageCostTryExact4,4)*1000000n);
 return Object.freeze({currency:'TRY',lines,subtotalExact4,discountRateExact4,discountTotalExact4,totalExact4,maxDiscountRateExact4,belowCostWarning,writeSupported:rate===0n});
}
