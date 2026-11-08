// Currency-account limits are opt-in. A missing policy is not a zero limit.
const bad=()=>{throw Error('DESKTOP_CREDIT_INVALID');};
const parse=(v,signed=false)=>{
 if(typeof v!=='string'||!(signed?/^-?(?:0|[1-9]\d{0,19})\.\d{8}$/:/^(?:0|[1-9]\d{0,19})\.\d{8}$/).test(v)||v==='-0.00000000')bad();
 const negative=v[0]==='-',digits=(negative?v.slice(1):v).replace('.',''),n=BigInt(digits);
 if(n>=10n**28n)bad();return negative?-n:n;
};
const fmt=n=>{const neg=n<0n;if(neg)n=-n;if(n>=10n**28n)bad();const s=n.toString().padStart(9,'0');return `${neg?'-':''}${s.slice(0,-8)}.${s.slice(-8)}`;};
export function desktopCreditLimit(value){if(value===null)return null;const n=parse(value);if(n<=0n)bad();return fmt(n);}
export function desktopCreditEvaluate(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))bad();
 const fields=['limitExact8','balanceExact8','amountExact4'],keys=Reflect.ownKeys(input),d=Object.getOwnPropertyDescriptors(input);
 if(keys.length!==fields.length||fields.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))bad();
 const {limitExact8,balanceExact8,amountExact4}=input;
 const limit=desktopCreditLimit(limitExact8),balance=parse(balanceExact8,true);
 if(typeof amountExact4!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(amountExact4))bad();
 const amount=BigInt(amountExact4.replace('.',''))*10000n;if(amount<=0n)bad();
 const projected=balance+amount;return Object.freeze({limitExact8:limit,balanceExact8:fmt(balance),amountExact4,projectedBalanceExact8:fmt(projected),approvalRequired:limit!==null&&projected>parse(limit),dueStatus:'unknown'});
}
