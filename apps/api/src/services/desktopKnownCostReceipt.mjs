// Pure source-only projection. Inputs must be independently read, locked and
// authorized in one transaction by a future store. This module issues no
// capability, performs no SQL and cannot prove that a quote is genuine.
import {calculateWeightedAverageCostTry} from './purchaseCostAccumulator.mjs';
import {planDesktopLinkedPurchase} from '../../../../packages/shared/src/desktopGoodsReceiptModel.mjs';
const fail=()=>{throw Error('DESKTOP_KNOWN_RECEIPT_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function shape(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail();}
function array(v){if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||!v.length||Reflect.ownKeys(v).length!==v.length+1)fail();return Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();return d.value;});}
const limit=9007199254740991n;
function dec(v,n,{signed=false,positive=false}={}){if(typeof v!=='string'||!new RegExp(`^${signed?'-?':''}(?:0|[1-9]\\d{0,15})\\.\\d{${n}}$`).test(v)||v===`-0.${'0'.repeat(n)}`)fail();const x=BigInt(v.replace('.',''));if(x>limit||x< -limit||positive&&x<=0n||!signed&&x<0n)fail();return x;}
function fixed(v,n){const negative=v<0n,s=(negative?-v:v).toString().padStart(n+1,'0');return `${negative?'-':''}${s.slice(0,-n)}.${s.slice(-n)}`;}
const rounded=(a,b)=>(a+b/2n)/b;
function parity(actual,scaled){if(!Number.isFinite(actual)||!Number.isSafeInteger(Math.round(actual*10000))||BigInt(Math.round(actual*10000))!==scaled)fail();}
// The candidate purchase is recomputed with the existing ordered-discount and
// FX model. The future caller must lock and authenticate every input; these
// data shapes and a confirmed flag do not themselves confer authority.
export function planDesktopKnownCostReceipt({requestId,receipt,quote,products}={}){
 if(!uuid(requestId))fail();shape(receipt,['id','state','supplierId','lines']);shape(quote,['id','state','purchaseCommand','purchaseLocked']);
 if(!id(receipt.id)||receipt.state!=='draft'||!id(receipt.supplierId)||!id(quote.id)||quote.state!=='confirmed')fail();
 shape(quote.purchaseLocked,['receipt','account','rates']);shape(quote.purchaseLocked.receipt,['id','state','supplierId','lines']);if(quote.purchaseLocked.receipt.state!=='draft')fail();
 // The purchase model's accepted state is a prospective calculation only;
 // no receipt state is persisted or capability to finalize is issued here.
 const projectedLocked={...quote.purchaseLocked,receipt:{...quote.purchaseLocked.receipt,state:'accepted'}};
 const purchase=planDesktopLinkedPurchase(quote.purchaseCommand,projectedLocked);if(purchase.receiptId!==receipt.id||purchase.supplierId!==receipt.supplierId||purchase.kind!=='purchase_finalize')fail();
 const lines=array(receipt.lines),quoted=array(purchase.lines),projected=array(purchase.projection.lines),lockedLines=array(quote.purchaseLocked.receipt.lines),stock=array(products),seen=new Set(),stockSeen=new Set();if(lines.length!==quoted.length||lockedLines.length!==lines.length||projected.length!==quoted.length||stock.length!==lines.length)fail();
 const effects=lines.map(line=>{shape(line,['lineId','productId','quantityBaseExact3']);if(!uuid(line.lineId)||!id(line.productId)||seen.has(line.lineId)||stockSeen.has(line.productId))fail();seen.add(line.lineId);stockSeen.add(line.productId);
  const index=quoted.findIndex(x=>x?.receiptLineId===line.lineId),ps=stock.filter(x=>x?.id===line.productId);if(index<0||ps.length!==1)fail();const q=quoted[index],v=projected[index],p=ps[0];shape(p,['id','stockExact3','averageCostTryExact4']);
  const matches=lockedLines.filter(x=>x.lineId===line.lineId);if(matches.length!==1||matches[0].costTryExact4!==v.unitCostTryExact4||q.productId!==line.productId||q.quantityBaseExact3!==line.quantityBaseExact3)fail();const qty=dec(line.quantityBaseExact3,3,{positive:true}),amount=dec(v.lineTotalTryExact4,4),cost=dec(v.unitCostTryExact4,4),before=dec(p.stockExact3,3,{signed:true}),old=dec(p.averageCostTryExact4,4);const next=before+qty;if(next>limit||next< -limit)fail();
  const expectedUnit=rounded(amount*1000n,qty);if(cost!==expectedUnit)fail();const average=before<=0n?expectedUnit:rounded(before*old+amount*1000n,next);if(average>limit)fail();
  const native=calculateWeightedAverageCostTry({currentStock:Number(p.stockExact3),currentAverageCostTry:Number(p.averageCostTryExact4),purchaseQuantity:Number(line.quantityBaseExact3),purchaseAmountTry:Number(v.lineTotalTryExact4)});parity(native,average);parity(Number(v.lineTotalTryExact4)/Number(line.quantityBaseExact3),cost);
  return Object.freeze({lineId:line.lineId,productId:line.productId,quantityInExact3:line.quantityBaseExact3,lineTotalTryExact4:v.lineTotalTryExact4,unitCostTryExact4:v.unitCostTryExact4,stockBeforeExact3:p.stockExact3,stockAfterExact3:fixed(next,3),averageBeforeExact4:p.averageCostTryExact4,averageAfterExact4:fixed(average,4)});
 });
 return Object.freeze({kind:'known_cost_goods_approval',requestId,receiptId:receipt.id,supplierId:receipt.supplierId,quoteId:quote.id,effects:Object.freeze(effects),supplierCharges:0,requiresLockedQuote:true,requiresAtomicJournal:true});
}
// Readback comparison is a pure fail-closed contract; it cannot replace a
// transaction-owned database query, uniqueness constraint or journal lock.
export function assertDesktopKnownCostReceiptReadback(plan,record){
 shape(record,['requestId','receiptId','quoteId','state','movementCount','effects']);if(record.requestId!==plan.requestId||record.receiptId!==plan.receiptId||record.quoteId!==plan.quoteId||record.state!=='accepted'||record.movementCount!==plan.effects.length)fail();
 const actual=array(record.effects);if(actual.length!==plan.effects.length)fail();for(let i=0;i<actual.length;i++){const expected=plan.effects[i];shape(actual[i],Object.keys(expected));for(const k of Object.keys(expected))if(actual[i][k]!==expected[k])fail();}return true;
}
