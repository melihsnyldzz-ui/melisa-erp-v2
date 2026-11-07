// TRY finance calculation only. Locked inputs require independent transaction,
// actor and origin verification. No SQL, account authority or posting is issued.
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('DESKTOP_FINANCE_PLAN_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function shape(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail();}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail();const [y,m,d]=v.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d));if(y<1900||x.getUTCFullYear()!==y||x.getUTCMonth()!==m-1||x.getUTCDate()!==d)fail();}
function decimal(v,scale,{signed=false,positive=false,max=9007199254740991n}={}){if(typeof v!=='string'||!new RegExp(`^${signed?'-?':''}(?:0|[1-9]\\d{0,19})\\.\\d{${scale}}$`).test(v)||v===`-0.${'0'.repeat(scale)}`)fail();const n=BigInt(v.replace('.',''));if(n>max||n< -max||positive&&n<=0n)fail();return n;}
function fixed(n,scale){const neg=n<0n,s=(neg?-n:n).toString().padStart(scale+1,'0');return `${neg?'-':''}${s.slice(0,-scale)}.${s.slice(-scale)}`;}
const money=n=>{if(n>9007199254740991n||n< -9007199254740991n)fail();const s=fixed(n,4),v=Number(s),scaled=Math.round(Math.abs(v)*10000);if(!Number.isFinite(v)||v.toFixed(4)!==s||!Number.isSafeInteger(scaled)||BigInt(scaled)!==(n<0n?-n:n))fail();return s;};
export function bindDesktopFinanceRequest({operation,actorId,command}={}){
 if(!['collection','payment'].includes(operation)||!id(actorId))fail();shape(command,['requestId','partyId','partyAccountId','financeAccountId','invoiceId','amountExact4','documentDate','currency','description']);
 if(!uuid(command.requestId)||![command.partyId,command.partyAccountId,command.financeAccountId].every(id)||(command.invoiceId!==null&&!id(command.invoiceId))||command.currency!=='TRY'||typeof command.description!=='string'||command.description.length>500||/[\u0000-\u001f\u007f]/.test(command.description))fail();date(command.documentDate);
 decimal(command.amountExact4,4,{positive:true});const normalized=Object.freeze(Object.fromEntries(['requestId','partyId','partyAccountId','financeAccountId','invoiceId','amountExact4','documentDate','currency','description'].map(k=>[k,command[k]])));const requestHash=createHash('sha256').update(JSON.stringify({operation,actorId,command:normalized}),'utf8').digest('hex');return Object.freeze({operation,actorId,command:normalized,requestHash});
}
export function planDesktopFinance({operation,actorId,command,locked}={}){
 const binding=bindDesktopFinanceRequest({operation,actorId,command});command=binding.command;
 shape(locked,['party','account','finance','invoice']);shape(locked.party,['id','entityId','role','currency','active','balanceExact4']);shape(locked.account,['id','partyId','entityId','role','currency','active','balanceExact8']);shape(locked.finance,['id','currency','type','active','balanceExact4']);
 const role=operation==='collection'?'customer':'supplier',p=locked.party,a=locked.account,f=locked.finance;
 if(p.id!==command.partyId||!id(p.entityId)||p.role!==role||p.currency!=='TRY'||p.active!==true||a.id!==command.partyAccountId||a.partyId!==p.id||a.entityId!==p.entityId||a.role!==role||a.currency!=='TRY'||a.active!==true||f.id!==command.financeAccountId||f.currency!=='TRY'||f.type!=='cash'||f.active!==true)fail();
 const amount=decimal(command.amountExact4,4,{positive:true}),party=decimal(p.balanceExact4,4,{signed:true}),balance=decimal(a.balanceExact8,8,{signed:true,max:9999999999999999999999999999n}),cash=decimal(f.balanceExact4,4,{signed:true});
 if(balance!==party*10000n||party<amount||operation==='payment'&&cash<amount)fail();
 if(command.invoiceId===null){if(locked.invoice!==null)fail();}else{shape(locked.invoice,['id','partyId','currency','entityId','accountId','accountCurrency','status','remainingExact4']);const i=locked.invoice;if(i.id!==command.invoiceId||i.partyId!==p.id||i.entityId!==p.entityId||i.accountId!==a.id||i.currency!=='TRY'||i.accountCurrency!=='TRY'||i.status!=='finalized'||decimal(i.remainingExact4,4)<amount)fail();}
 const effect=operation==='collection'?amount:-amount,afterParty=party-amount,afterCash=cash+effect;
 const result={...binding,partyId:p.id,entityId:p.entityId,partyAccountId:a.id,financeAccountId:f.id,amountExact4:money(amount),partyBeforeExact4:money(party),partyAfterExact4:money(afterParty),partyAccountBeforeExact8:a.balanceExact8,partyAccountAfterExact8:fixed(afterParty*10000n,8),financeBeforeExact4:money(cash),financeAfterExact4:money(afterCash),partyMovementCount:1,financeMovementCount:1,partyAccountEffects:1};return Object.freeze({...result,sourceOnly:true});
}
