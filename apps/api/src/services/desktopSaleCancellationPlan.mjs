// Source-only inverse calculation. This module cannot authorize cancellation,
// acquire a SQL scope, post a movement or change an invoice. A future adapter
// must obtain all rows and sales.cancel in the same verified transaction.
const fail=()=>{throw Error('DESKTOP_SALE_CANCELLATION_UNVERIFIED');};
const currencies=['TRY','USD','EUR'];
function own(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(value).length!==keys.length||keys.some(k=>!descriptors[k]?.enumerable||!Object.hasOwn(descriptors[k],'value')))fail();
 return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}
const id=v=>{if(typeof v!=='string'||! /^[1-9]\d{0,15}$/.test(v)||BigInt(v)>9007199254740991n)fail();return v;};
function scaled(v,s,{signed=false,positive=false}={}){
 if(typeof v!=='string'||v.length>32||!new RegExp(`^${signed?'-?':''}(?:0|[1-9]\\d*)\\.\\d{${s}}$`).test(v))fail();
 const n=BigInt(v.replace('.','')),limit=10n**BigInt(s===8?28:18)-1n;
 if(n>limit||n< -limit||v.startsWith('-')&&n===0n||positive&&n<=0n)fail();return n;
}
function fixed(n,s){const negative=n<0n;if(negative)n=-n;const t=n.toString().padStart(s+1,'0'),v=(negative?'-':'')+t.slice(0,-s)+'.'+t.slice(-s);scaled(v,s,{signed:true});return v;}
function rows(value,length){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length!==length||Reflect.ownKeys(value).length!==length+1)fail();
 for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();}
 return value;
}
export function prepareDesktopSaleCancellation(raw){
 const s=own(raw,['invoice','customer','account','items','stockMovements','customerMovements','reservations','linkedFinanceRows','returnRows','exportRows','reason']);
 // Current SQL cancel_reason is nvarchar(250), verified read-only on schema 4.
 if(typeof s.reason!=='string'||s.reason.trim()!==s.reason||s.reason.length<1||s.reason.length>250||/[\u0000-\u001f\u007f]/.test(s.reason)||[s.linkedFinanceRows,s.returnRows,s.exportRows].some(v=>v!=='0'))fail();
 const i=own(s.invoice,['id','customerId','entityId','accountId','currency','accountCurrency','customerCurrency','totalExact4','accountAmountExact4','amountTryExact4','state','workflowState','version']);
 for(const k of ['id','customerId','entityId','accountId'])id(i[k]);
 if(![i.currency,i.accountCurrency,i.customerCurrency].every(c=>currencies.includes(c))||i.state!=='FINALIZED'||i.workflowState!=='COMPLETED'||typeof i.version!=='string'||!/^0x[0-9A-F]{16}$/.test(i.version))fail();
 const total=scaled(i.totalExact4,4,{positive:true}),amount=scaled(i.accountAmountExact4,4,{positive:true}),tryAmount=scaled(i.amountTryExact4,4,{positive:true});
 if(i.currency===i.accountCurrency&&total!==amount||i.currency==='TRY'&&total!==tryAmount||i.accountCurrency==='TRY'&&amount!==tryAmount)fail();
 const c=own(s.customer,['id','entityId','currency','balanceExact4']),a=own(s.account,['id','customerId','entityId','currency','balanceExact8']);
 if(c.id!==i.customerId||c.entityId!==i.entityId||c.currency!==i.customerCurrency||a.id!==i.accountId||a.customerId!==i.customerId||a.entityId!==i.entityId||a.currency!==i.accountCurrency)fail();
 const balance=scaled(c.balanceExact4,4,{signed:true}),accountBalance=scaled(a.balanceExact8,8,{signed:true});
 if(i.accountCurrency===i.customerCurrency&&accountBalance!==balance*10000n)fail();
 const items=rows(s.items,2).map(v=>own(v,['id','productId','quantityExact3','stockBeforeExact3','unitCostTryExact4']));
 if(new Set(items.map(v=>id(v.id))).size!==2||new Set(items.map(v=>id(v.productId))).size!==2)fail();
 const movements=rows(s.stockMovements,2).map(v=>own(v,['id','invoiceId','productId','type','quantityInExact3','quantityOutExact3','amountTryExact4','unitCostTryExact4']));
 if(new Set(movements.map(v=>id(v.id))).size!==2)fail();
 const reservations=rows(s.reservations,2).map(v=>own(v,['itemId','productId','quantityExact3','state']));
 if(new Set(reservations.map(v=>v.itemId)).size!==2)fail();
 let sum=0n;
 const stock=items.map(item=>{
  const quantity=scaled(item.quantityExact3,3,{positive:true}),physical=scaled(item.stockBeforeExact3,3,{signed:true}),cost=scaled(item.unitCostTryExact4,4,{positive:true});
  const matches=movements.filter(v=>v.productId===item.productId),reserved=reservations.filter(v=>v.itemId===item.id);
  if(matches.length!==1||reserved.length!==1)fail();const m=matches[0],r=reserved[0];
  if(m.invoiceId!==i.id||m.type!=='out'||m.quantityInExact3!=='0.000'||scaled(m.quantityOutExact3,3,{positive:true})!==quantity||scaled(m.unitCostTryExact4,4,{positive:true})!==cost||r.productId!==item.productId||r.quantityExact3!==item.quantityExact3||r.state!=='DISPATCHED')fail();
  const posted=scaled(m.amountTryExact4,4);sum+=posted;
  return Object.freeze({productId:item.productId,itemId:item.id,originalMovementId:m.id,quantityInExact3:item.quantityExact3,quantityOutExact3:'0.000',stockBeforeExact3:item.stockBeforeExact3,stockAfterExact3:fixed(physical+quantity,3),unitCostTryExact4:item.unitCostTryExact4,amountTryExact4:fixed(-posted,4)});
 });
 if(sum!==tryAmount)fail();
 const movement=own(rows(s.customerMovements,1)[0],['id','invoiceId','customerId','entityId','accountId','type','currency','accountCurrency','amountExact4','accountAmountExact4','balanceEffectExact4','amountTryExact4']);id(movement.id);
 if(movement.invoiceId!==i.id||movement.customerId!==i.customerId||movement.entityId!==i.entityId||movement.accountId!==i.accountId||movement.type!=='sales_invoice'||movement.currency!==i.currency||movement.accountCurrency!==i.accountCurrency||movement.amountExact4!==i.totalExact4||movement.accountAmountExact4!==i.accountAmountExact4||movement.balanceEffectExact4!==i.accountAmountExact4||movement.amountTryExact4!==i.amountTryExact4)fail();
 const preserveLegacyBalance=i.accountCurrency!==i.customerCurrency;
 return Object.freeze({invoiceId:i.id,expectedVersion:i.version,reason:s.reason,customerId:i.customerId,entityId:i.entityId,accountId:i.accountId,currency:i.currency,accountCurrency:i.accountCurrency,stock:Object.freeze(stock),customerMovement:Object.freeze({originalMovementId:movement.id,amountExact4:i.totalExact4,accountAmountExact4:i.accountAmountExact4,balanceEffectExact4:fixed(-amount,4),amountTryExact4:fixed(-tryAmount,4)}),accountBeforeExact8:a.balanceExact8,accountAfterExact8:fixed(accountBalance-amount*10000n,8),preserveLegacyBalance,customerBeforeExact4:c.balanceExact4,customerAfterExact4:fixed(preserveLegacyBalance?balance:balance-amount,4)});
}
