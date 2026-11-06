import {prepareDesktopTwoItemSale} from './desktopTwoItemSalePreparation.mjs';
import {desktopSaleQuote} from './desktopSaleQuote.mjs';
const fail=()=>{throw Error('DESKTOP_DISCOUNTED_SALE_UNVERIFIED');};
const scaled=v=>BigInt(v.replace('.',''));
const fixed=(n,s)=>{const negative=n<0n;if(negative)n=-n;const text=n.toString().padStart(s+1,'0');return (negative?'-':'')+text.slice(0,-s)+'.'+text.slice(-s);};
export function prepareDesktopDiscountedTwoItemSale({request,locked,maxDiscountRateExact4,normalizeSalesPayload}={}){
 if(!request||Object.keys(request).sort().join(',')!=='customerId,discountRateExact4,documentDate,expectedRevision,items,requestId')fail();
 const {discountRateExact4,...original}=request,base=prepareDesktopTwoItemSale(original,locked),quote=desktopSaleQuote({prepared:base,locked,discountRateExact4,maxDiscountRateExact4,normalizeSalesPayload});
 const total=scaled(quote.totalExact4),subtotal=scaled(quote.subtotalExact4),discount=scaled(quote.discountTotalExact4),rate=scaled(discountRateExact4);
 // This first writable discount flow admits only values for which independent
 // decimal persistence and PR54's unrounded binary calculation agree exactly.
 if(subtotal-discount!==total||discount!==(subtotal*rate+500000n)/1000000n)fail();
 const customerAfter=scaled(base.expected.customerBeforeExact4)+total,accountAfter=scaled(base.expected.accountBeforeExact8)+total*10000n;
 if([customerAfter,accountAfter].some(n=>n>9007199254740991n||n< -9007199254740991n))fail();
 const invoice={...base.invoice,discountRate:Number(discountRateExact4)},normalized=normalizeSalesPayload(invoice);
 const profit=desktopDiscountedProfitPlan(normalized);
 return Object.freeze({...base,invoice,expected:Object.freeze({...base.expected,totalExact4:quote.totalExact4,subtotalExact4:quote.subtotalExact4,discountRateExact4,discountTotalExact4:quote.discountTotalExact4,estimatedProfitTryExact4:profit.estimatedProfitTryExact4,lines:Object.freeze(base.expected.lines.map((line,i)=>Object.freeze({...line,...profit.lines[i]}))),customerAfterExact4:fixed(customerAfter,4),accountAfterExact8:fixed(accountAfter,8)})});
}
function nativeUnits(value,scale,exact=false){if(typeof value!=='number'||!Number.isFinite(value)||value<0)fail();const n=Math.round(value*10**scale);if(!Number.isSafeInteger(n)||exact&&n/10**scale!==value)fail();return BigInt(n);}
const roundSigned=(n,d)=>n<0n?-((-n+d/2n)/d):(n+d/2n)/d;
function nativeSigned4(value,expected){const n=Math.round(Math.abs(value)*10000);if(!Number.isFinite(value)||!Number.isSafeInteger(n)||BigInt(n)*(value<0?-1n:1n)!==expected)fail();}
export function desktopDiscountedProfitPlan(draft){
 if(draft?.documentCurrency!=='TRY'||draft.exchangeRate!==1||!Array.isArray(draft.items)||draft.items.length!==2)fail();
 const rate=nativeUnits(draft.discountRate,4,true),subtotal=nativeUnits(draft.subtotal,4),discount=nativeUnits(draft.discountTotal,4),total=nativeUnits(draft.grandTotal,4);
 if(rate>30000n||subtotal-discount!==total||discount!==(subtotal*rate+500000n)/1000000n)fail();
 let gross=0n,net=0n,profit7=0n,nativeProfit=0,storedProfit=0n;const lines=[];
 const salesAmountsTry=draft.items.map(item=>{
  const line=nativeUnits(item.lineTotal,4),quantity=nativeUnits(item.quantity,3,true),cost=nativeUnits(item.averageCostTry,4,true);if(quantity===0n||cost===0n)fail();
  const discounted=(line*(1000000n-rate)+500000n)/1000000n,amount=Number(discounted)/10000;nativeSigned4(amount,discounted);
  const rawProfit=amount-item.quantity*item.averageCostTry,exactProfit7=discounted*1000n-quantity*cost,exactProfit4=roundSigned(exactProfit7,1000n);nativeSigned4(rawProfit,exactProfit4);
  gross+=line;net+=discounted;profit7+=exactProfit7;nativeProfit+=rawProfit;storedProfit+=exactProfit4;lines.push(Object.freeze({salesAmountTryExact4:fixed(discounted,4),unitCostTryExact4:fixed(cost,4),grossProfitTryExact4:fixed(exactProfit4,4)}));return amount;
 });
 const expected=roundSigned(profit7,1000n);if(gross!==subtotal||net!==total||storedProfit!==expected)fail();nativeSigned4(nativeProfit,expected);
 const estimatedProfitTry=Number(expected)/10000;nativeSigned4(estimatedProfitTry,expected);return Object.freeze({salesAmountsTry:Object.freeze(salesAmountsTry),estimatedProfitTry,estimatedProfitTryExact4:fixed(expected,4),lines:Object.freeze(lines)});
}
