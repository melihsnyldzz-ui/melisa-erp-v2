// Offline preparation only. Rates must already be explicitly chosen/locked by
// the caller's future quote provider. This module selects no source/date, grants
// no sale capability, opens no SQL and never substitutes a missing rate with 1.
import {calculateCurrencySettlement} from '../../../../packages/shared/src/currencySettlement.mjs';
const CODE='DESKTOP_CURRENCY_SETTLEMENT_UNVERIFIED',MAX=BigInt(Number.MAX_SAFE_INTEGER),currencies=new Set(['TRY','USD','EUR']);
const fail=()=>{throw Object.assign(Error(CODE),{code:CODE});};
function record(v,keys){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)fail();
 const d=Object.getOwnPropertyDescriptors(v);if(keys.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))fail();return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
function exact(v,scale,{signed=false,positive=false}={}){
 const whole=scale===4?14:20;
 if(typeof v!=='string'||!new RegExp(`^${signed?'-?':''}(?:0|[1-9]\\d{0,${whole-1}})\\.\\d{${scale}}$`).test(v))fail();
 const n=BigInt(v.replace('.',''));if(n>MAX||n< -MAX||n===0n&&(v.startsWith('-')||positive)||positive&&n<0n)fail();return n;
}
const fixed=(n,scale)=>{const neg=n<0n;if(neg)n=-n;const s=n.toString().padStart(scale+1,'0');return(neg?'-':'')+s.slice(0,-scale)+'.'+s.slice(-scale);};
const rounded=(n,d)=>(n+d/2n)/d;
function wireUnits(value,scale){
 if(typeof value!=='number'||!Number.isFinite(value))fail();const n=Math.round(Math.abs(value*10**scale));if(!Number.isSafeInteger(n))fail();return value<0?-BigInt(n):BigInt(n);
}
function parity(value,scale,wanted){if(wireUnits(value,scale)!==wanted)fail();}
function currency(v){if(!currencies.has(v))fail();return v;}

export function desktopCurrencySettlementParity(input){
 const v=record(input,['documentAmountExact4','documentCurrency','accountCurrency','documentRateToTryExact8','accountRateToTryExact8']);currency(v.documentCurrency);currency(v.accountCurrency);
 const amount=exact(v.documentAmountExact4,4),documentRate=exact(v.documentRateToTryExact8,8,{positive:true}),accountRate=exact(v.accountRateToTryExact8,8,{positive:true});
 if(v.documentCurrency==='TRY'&&documentRate!==100000000n||v.accountCurrency==='TRY'&&accountRate!==100000000n||v.documentCurrency===v.accountCurrency&&documentRate!==accountRate)fail();
 // PR54's exact half-up policy and the pinned Number/Tedious path must agree.
 const account=rounded(amount*documentRate,accountRate),amountTry=rounded(amount*documentRate,100000000n);if(account>MAX||amountTry>MAX)fail();
 parity(Number(v.documentAmountExact4),4,amount);parity(Number(v.documentRateToTryExact8),8,documentRate);parity(Number(v.accountRateToTryExact8),8,accountRate);
 const native=calculateCurrencySettlement({documentAmount:v.documentAmountExact4,documentCurrency:v.documentCurrency,accountCurrency:v.accountCurrency,documentRateToTry:v.documentRateToTryExact8,accountRateToTry:v.accountRateToTryExact8});
 parity(native.documentAmount,4,amount);parity(native.accountAmount,4,account);parity(native.amountTry,4,amountTry);parity(native.documentRateToTry,8,documentRate);parity(native.accountRateToTry,8,accountRate);
 return Object.freeze({...v,accountAmountExact4:fixed(account,4),amountTryExact4:fixed(amountTry,4),native:Object.freeze({...native})});
}

export function desktopCurrencyAccountProjection(input){
 const v=record(input,['customerCurrency','accountCurrency','customerBalanceExact4','accountBalanceExact8','accountAmountExact4']);currency(v.customerCurrency);currency(v.accountCurrency);
 const customer=exact(v.customerBalanceExact4,4,{signed:true}),account=exact(v.accountBalanceExact8,8,{signed:true}),amount=exact(v.accountAmountExact4,4),primary=v.customerCurrency===v.accountCurrency;
 if(primary&&customer*10000n!==account)fail();const customerAfter=customer+(primary?amount:0n),accountAfter=account+amount*10000n;
 if([customerAfter,accountAfter].some(n=>n>MAX||n< -MAX))fail();
 parity(Number(v.customerBalanceExact4),4,customer);parity(Number(v.accountBalanceExact8),8,account);parity(Number(v.accountAmountExact4),4,amount);parity(Number(fixed(customerAfter,4)),4,customerAfter);parity(Number(fixed(accountAfter,8)),8,accountAfter);
 return Object.freeze({updatesLegacyBalance:primary,customerBeforeExact4:v.customerBalanceExact4,customerAfterExact4:fixed(customerAfter,4),customerEffectExact4:primary?v.accountAmountExact4:'0.0000',accountBeforeExact8:v.accountBalanceExact8,accountAfterExact8:fixed(accountAfter,8),accountEffectExact8:fixed(amount*10000n,8)});
}
export const DESKTOP_CURRENCY_SETTLEMENT_PARITY_LIMITS=Object.freeze({sourceOnly:true,sqlExecuted:false,rateProviderSelected:false,rateProvenanceVerified:false,selectedAccountPostingIntegrated:false,realSqlVerified:false});
