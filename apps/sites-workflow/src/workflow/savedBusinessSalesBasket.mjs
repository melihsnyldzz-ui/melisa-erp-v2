import {businessSalesBasketPreparation,emptyBusinessSalesBasket,addBusinessSalesBasketLine} from './workBusinessSalesBasketModel.mjs';

const fail=code=>{throw Object.assign(Error('Saklanan sepet açılamadı.'),{code:'SAVED_BASKET_'+code});};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,19}$/.test(v);
const keys=(v,list)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...list].sort().join(',');
const copy=v=>JSON.parse(JSON.stringify(v));
const validDate=v=>v===null||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function preparation(p){
 if(!keys(p,['scope','documentDate','items'])||!keys(p.scope,['customerId','accountId','currency'])||!id(p.scope.customerId)||!id(p.scope.accountId)||!['TRY','USD','EUR'].includes(p.scope.currency)||!validDate(p.documentDate)||!Array.isArray(p.items)||!p.items.length||p.items.length>100)fail('INVALID');
 const seen=new Set();
 for(const item of p.items){
  const s=item?.selection;
  if(!keys(item,['selection','quantity','unitPriceExact8'])||!keys(s,['customerId','accountId','currency','productId','priceId','unitSourceId','tier'])||s.customerId!==p.scope.customerId||s.accountId!==p.scope.accountId||s.currency!==p.scope.currency||!['productId','priceId','unitSourceId','tier'].every(k=>id(s[k]))||!id(item.quantity)||typeof item.unitPriceExact8!=='string'||!/^(?:0|[1-9]\d{0,19})\.\d{8}$/.test(item.unitPriceExact8)||BigInt(item.unitPriceExact8.replace('.',''))<=0n)fail('INVALID');
  const key=[s.productId,s.priceId,s.unitSourceId,s.tier].join(':');if(seen.has(key))fail('INVALID');seen.add(key);
 }
 return p;
}
export function businessBasketOperationStamp(journal){
 const row=journal?.read?.()??null;if(row===null)return 'none';
 if(row.status==='pending')fail('OPERATION_PENDING');
 if(row.version!==1||row.status!=='done'||typeof row.path!=='string'||typeof row.body?.requestId!=='string')fail('OPERATION_UNKNOWN');
 return JSON.stringify([row.version,row.status,row.path,row.body.requestId]);
}
export function createSavedBusinessBasket({storage,host,actorId,locks=globalThis.navigator?.locks}){
 if(typeof host!=='string'||!host||host.length>255||!/^[A-Za-z0-9.:[\]-]+$/.test(host)||!id(String(actorId))||!['getItem','setItem','removeItem'].every(k=>typeof storage?.[k]==='function'))fail('STORAGE_UNAVAILABLE');
 const key=`melisa-work-sale-basket-v1:${host}:${actorId}`;
 function read(){
  const raw=storage.getItem(key);if(raw===null)return null;
  if(typeof raw!=='string'||raw.length>32768)fail('INVALID');let record;try{record=JSON.parse(raw);}catch{fail('INVALID');}
  if(!keys(record,['version','host','actorId','preparation','operationStamp'])||record.version!==1||record.host!==host||record.actorId!==String(actorId)||typeof record.operationStamp!=='string'||record.operationStamp.length>512)fail('INVALID');
  preparation(record.preparation);return {raw,record};
 }
 const current=snapshot=>storage.getItem(key)===(snapshot?.raw??null);
 const writable=typeof locks?.request==='function';
 async function mutate(allowed,action){
  if(!writable)fail('LOCK_UNAVAILABLE');
  return locks.request(key,{mode:'exclusive'},()=>{if(typeof allowed!=='function'||!allowed())fail('VIEW_CHANGED');return action();});
 }
 return Object.freeze({read,current,writable,
  async save(basket,date,operationStamp,before,allowed){
   const record={version:1,host,actorId:String(actorId),preparation:preparation(businessSalesBasketPreparation(basket,date)),operationStamp};
   if(typeof operationStamp!=='string'||operationStamp.length>512)fail('OPERATION_UNKNOWN');
   const raw=JSON.stringify(record);if(raw.length>32768)fail('INVALID');
   return mutate(allowed,()=>{if(before===undefined)fail('CHANGED');read();if(!current(before))fail('CHANGED');storage.setItem(key,raw);if(storage.getItem(key)!==raw)fail('SAVE_UNCONFIRMED');return {raw,record:copy(record)};});
  },
  async remove(snapshot,allowed){return mutate(allowed,()=>{if(!snapshot||!current(snapshot))fail('CHANGED');storage.removeItem(key);if(storage.getItem(key)!==null)fail('REMOVE_UNCONFIRMED');});}
 });
}
export async function restoreSavedBusinessBasket(saved,selectionRead){
 const p=preparation(copy(saved?.record?.preparation));if(typeof selectionRead!=='function')fail('READER_UNAVAILABLE');let basket=emptyBusinessSalesBasket();
 for(const item of p.items){
  const fresh=await selectionRead({...item.selection});
  if(!fresh?.data?.selection||Object.keys(item.selection).some(k=>fresh.data.selection[k]!==item.selection[k]))fail('SELECTION_CHANGED');
  if(fresh?.data?.price?.priceExact!==item.unitPriceExact8)fail('PRICE_CHANGED');
  basket=addBusinessSalesBasketLine(basket,fresh,item.quantity);
 }
 return basket;
}
