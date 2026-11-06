// Offline parity candidate for PR54's productService + pinned Tedious decimal
// encoding. This file neither connects to SQL nor chooses a product's policy.
// Unsupported or floating-point-divergent inputs are rejected, never rounded
// to a different result. Non-TRY zero reproduces PR54, not a verified FX cost.
const fail=()=>{throw Object.assign(new Error('LOCAL_MASTER_COST_UNVERIFIED'),{code:'LOCAL_MASTER_COST_UNVERIFIED'});};
const maxSafe=BigInt(Number.MAX_SAFE_INTEGER);
function exact4(value){
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(value))fail();
 return BigInt(value.replace('.',''));
}
function discount4(value){
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,2})\.\d{4}$/.test(value))fail();
 const n=BigInt(value.replace('.',''));if(n>1000000n)fail();return n;
}
function formatted(value){const text=value.toString().padStart(5,'0');return text.slice(0,-4)+'.'+text.slice(-4);}
function driverUnits(value){const n=Math.round(Math.abs(value*10000));if(!Number.isSafeInteger(n))fail();return BigInt(n);}
export function desktopInitialCostParity({currency,purchasePriceExact4,purchaseDiscountRateExact4}={}){
 if(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency))fail();
 const amount=exact4(purchasePriceExact4),rate=discount4(purchaseDiscountRateExact4);
 // Both original fields use Tedious Decimal(...,4); do not claim parity if
 // passing the same decimal through its JavaScript Number path changes them.
 if(amount>maxSafe||driverUnits(Number(purchasePriceExact4))!==amount||driverUnits(Number(purchaseDiscountRateExact4))!==rate)fail();
 if(currency!=='TRY')return '0.0000';
 // Exact half-up for nonnegative values; PR54's actual binary path must agree.
 const numerator=amount*(1000000n-rate),expected=(numerator+500000n)/1000000n;
 if(expected>maxSafe)fail();
 const prior=Number(purchasePriceExact4)*(1-(Number(purchaseDiscountRateExact4)/100));
 if(!Number.isFinite(prior)||driverUnits(prior)!==expected)fail();
 return formatted(expected);
}
export const DESKTOP_INITIAL_COST_PARITY_LIMITS=Object.freeze({sourceOnly:true,integrated:false,realSqlVerified:false,
 samePinnedTediousVersionRequired:true,fxCostForNonTryVerified:false,roundingDisagreementRejected:true});
export function desktopInitialOpeningAmountParity({quantityExact3,costExact4}={}){
 if(typeof quantityExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(quantityExact3))fail();
 const quantity=BigInt(quantityExact3.replace('.','')),cost=exact4(costExact4),driverQuantity=Math.round(Number(quantityExact3)*1000);
 if(quantity===0n||cost===0n||quantity>maxSafe||cost>maxSafe||!Number.isSafeInteger(driverQuantity)||BigInt(driverQuantity)!==quantity||driverUnits(Number(costExact4))!==cost)fail();
 const expected=(quantity*cost+500n)/1000n;if(expected>maxSafe||driverUnits(Number(quantityExact3)*Number(costExact4))!==expected)fail();return formatted(expected);
}
