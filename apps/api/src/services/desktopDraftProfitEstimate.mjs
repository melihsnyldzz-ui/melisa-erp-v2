// Dedicated TRY draft estimate from the same decimal(18,4) line values that
// SQL stores. Unknown costs remain unknown; binary/decimal disagreement fails.
import {desktopDiscountedProfitPlan} from './desktopDiscountedTwoItemSale.mjs';
const fail=()=>{throw Error('DESKTOP_DRAFT_PROFIT_UNVERIFIED');};
const scaled=(value,scale)=>{
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)fail();
 const n=Math.round(value*10**scale);if(!Number.isSafeInteger(n))fail();return BigInt(n);
};
const rounded4=value=>{const negative=value<0n,n=negative?-value:value;return (negative?-1n:1n)*((n+500n)/1000n);};
export function desktopDraftProfitEstimate(draft){
 if(draft?.discountRate!==0)return desktopDiscountedProfitPlan(draft).estimatedProfitTry;
 if(draft?.documentCurrency!=='TRY'||draft.exchangeRate!==1||draft.discountRate!==0||!Array.isArray(draft.items)||!draft.items.length)fail();
 let exact7=0n,native=0;
 for(const item of draft.items){
  const quantity=scaled(item.quantity,3),cost=scaled(item.averageCostTry,4),line=scaled(item.lineTotal,4);
  if(quantity===0n||cost===0n||Number(quantity)/1000!==item.quantity||Number(cost)/10000!==item.averageCostTry)fail();
  exact7+=line*1000n-quantity*cost;
  // Match finalize's calculation from persisted line_total and locked cost.
  native+=Number(line)/10000-item.averageCostTry*item.quantity;
 }
 const expected=rounded4(exact7),magnitude=Math.round(Math.abs(native*10000));
 if(!Number.isSafeInteger(magnitude)||BigInt(magnitude)*(native<0?-1n:1n)!==expected)fail();
 const value=Number(expected)/10000;if(!Number.isSafeInteger(Number(expected))||BigInt(Math.round(Math.abs(value*10000)))*(value<0?-1n:1n)!==expected)fail();
 return value;
}
