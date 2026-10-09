import {parseStockProductId} from './stockProductModel.mjs';
export const homeError=(statusCode=503)=>Object.assign(new Error(statusCode===403?'Ana sayfa için yetkiniz bulunmuyor.':'Günlük özet şu anda okunamıyor.'),{statusCode,code:statusCode===403?'HOME_FORBIDDEN':'HOME_UNAVAILABLE'});
const fail=()=>{throw homeError();};
export const homeActorId=value=>{try{return parseStockProductId(String(value));}catch{throw homeError(403);}};
export function homeDate(now){if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail();return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function homeCapabilities(actual,session){
 if(!Array.isArray(actual)||!Array.isArray(session))throw homeError(403);
 const has=key=>actual.includes(key)&&session.includes(key),both=(...keys)=>keys.every(has);
 return {home:true,goods:has('goods.view'),purchase:has('purchase.view'),sales:has('sales.view'),collection:both('finance.view','customer.view','finance.collection'),product:has('product.view'),customer:has('customer.view'),supplier:has('supplier.view'),finance:has('finance.view'),payment:both('finance.view','purchase.view','finance.payment'),count:both('product.view','stock.adjust'),returns:both('sales.view','sales.cancel')||both('purchase.view','purchase.cancel'),approval:both('goods.view','goods.approve')||both('product.view','stock.adjust')||both('sales.view','sales.cancel')||both('purchase.view','purchase.cancel'),approveGoods:both('goods.view','goods.approve'),salesReturn:both('sales.view','sales.cancel'),purchaseReturn:both('purchase.view','purchase.cancel')};
}
// The second business copy has only the proved inbound workflow. Native role
// permissions alone do not turn an unverified business domain into a grant.
export function businessInboundHomeCapabilities(actual,session,actorId){
 const native=homeCapabilities(actual,session),office=String(actorId)==='16';
 return {...native,goods:native.goods,purchase:office&&native.purchase,supplier:office&&native.purchase&&native.supplier,approval:office&&native.approveGoods,approveGoods:office&&native.approveGoods,sales:false,collection:false,product:native.product,customer:false,finance:false,payment:false,count:false,returns:false,salesReturn:false,purchaseReturn:false};
}
const count=value=>{if(!/^(?:0|[1-9]\d*)$/.test(String(value))||!Number.isSafeInteger(Number(value)))fail();return Number(value);};
const unavailable=(fields,status='unavailable')=>({status,...Object.fromEntries(fields.map(key=>[key,null]))});
export function homeCurrencyTotals(rows){
 if(!Array.isArray(rows)||rows.length>3)fail();const seen=new Set();
 const values=rows.map(row=>{if(!['TRY','USD','EUR'].includes(row.currency)||seen.has(row.currency))fail();seen.add(row.currency);
  const knownCount=count(row.knownCount),unknownCount=count(row.unknownCount);
  if(row.amountExact4!==null&&(typeof row.amountExact4!=='string'||!/^\-?(?:0|[1-9]\d{0,33})\.\d{4}$/.test(row.amountExact4))||unknownCount>0&&row.amountExact4!==null||unknownCount===0&&row.amountExact4===null)fail();
  return {currency:row.currency,amountExact4:row.amountExact4,knownCount,unknownCount};});
 return ['TRY','USD','EUR'].map(currency=>values.find(value=>value.currency===currency)??{currency,amountExact4:'0.0000',knownCount:0,unknownCount:0});
}
export const HOME_TASKS=Object.freeze({
 goods:{label:'Mal kabulü bekliyor',target:'/is-akisi-taslagi.html#goods',right:'goods'},
 'sales-draft':{label:'Satış taslağı',target:'/is-akisi-taslagi.html#sales',right:'sales'},
 'purchase-draft':{label:'Alış taslağı',target:'/is-akisi-taslagi.html#purchases',right:'purchase'},
 count:{label:'Sayım onayı bekliyor',target:'/is-akisi-taslagi.html#count-test',right:'count'},
 'count-cancel':{label:'Sayım iptali onayı bekliyor',target:'/is-akisi-taslagi.html#count-cancel',right:'count'},
 'return-sales':{label:'Satış iadesi onayı bekliyor',target:'/is-akisi-taslagi.html#return-sales',right:'salesReturn'},
 'return-purchase':{label:'Alış iadesi onayı bekliyor',target:'/is-akisi-taslagi.html#return-purchase',right:'purchaseReturn'}
});
export function homeSummaryDto(raw,{date,readAt}){
 const c=raw.capabilities;if(!c?.home)throw homeError(403);if(!raw.counts||!Array.isArray(raw.tasks)||raw.tasks.length>5)fail();
 const n=raw.counts,sections={},business=raw.copyMeta?.scopeKind==='VERIFIED_BUSINESS_TEST';
 const operationsReady=c.sales===true&&c.customer===true&&c.product===true;
 const navigationReady=Object.fromEntries(['goods','sales','collection','product','customer','supplier','purchase','count','returns','approval'].map(key=>[key,c[key]===true&&(['product','customer','supplier'].includes(key)||operationsReady&&(key!=='purchase'||c.goods===true)&&(key!=='goods'||c.purchase===true))]));
 if(business)for(const key of Object.keys(navigationReady))navigationReady[key]=['goods','purchase','supplier','product','approval'].includes(key)&&c[key]===true;
 sections.sales=c.sales?{status:'available',count:count(n.salesCount),cancelledCount:count(n.salesCancelledCount),currencyTotals:homeCurrencyTotals(raw.salesTotals)}:{...unavailable(['count','cancelledCount'],'forbidden'),currencyTotals:[]};
 sections.goods=c.goods?{status:'available',pendingCount:count(n.goodsPendingCount)}:unavailable(['pendingCount'],'forbidden');
 sections.finance=c.finance?{status:'available',collections:homeCurrencyTotals(raw.collections),payments:homeCurrencyTotals(raw.payments),reversals:homeCurrencyTotals(raw.reversals),cash:{status:'unavailable',currencyTotals:[]}}:{status:'forbidden',collections:[],payments:[],reversals:[],cash:{status:'forbidden',currencyTotals:[]}};
 sections.refunds=business?unavailable(['salesCount','purchaseCount','cancelledCount']):c.sales||c.purchase?{status:'available',salesCount:c.sales?count(n.salesReturnCount):null,purchaseCount:c.purchase?count(n.purchaseReturnCount):null,cancelledCount:count(n.returnCancelledCount)}:unavailable(['salesCount','purchaseCount','cancelledCount'],'forbidden');
 sections.counts=c.count?{status:'available',pendingCount:count(n.countPendingCount)}:unavailable(['pendingCount'],'forbidden');
 sections.approvals=c.approval?{status:'available',pendingCount:count(n.approvalPendingCount),sourceCoverage:['goods','count','sales-return','purchase-return'],complete:false}:unavailable(['pendingCount'],'forbidden');
 if(business){
  sections.sales={...unavailable(['count','cancelledCount']),currencyTotals:[]};
  sections.finance={status:'unavailable',collections:[],payments:[],reversals:[],cash:{status:'unavailable',currencyTotals:[]}};
  sections.refunds=unavailable(['salesCount','purchaseCount','cancelledCount']);sections.counts=unavailable(['pendingCount']);
  if(c.approval)sections.approvals.sourceCoverage=['goods'];
 }
 const tasks=raw.tasks.map(row=>{const spec=HOME_TASKS[row.kind];if(!spec||!c[spec.right]||typeof row.id!=='string'||!/^[-a-z]+:[1-9]\d{0,18}$/.test(row.id)||row.state!=='pending'&&row.state!=='draft'||row.date!==null&&(typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))))fail();return {id:row.id,kind:row.kind,label:spec.label,state:row.state,date:row.date,target:spec.target};});
 if(new Set(tasks.map(row=>row.id)).size!==tasks.length)fail();
 const capabilities=Object.fromEntries(['goods','purchase','sales','collection','product','customer','supplier','finance','payment','count','returns','approval'].map(key=>[key,c[key]===true]));
 for(const task of tasks)task.ready=business?['goods','purchase-draft'].includes(task.kind)&&c[HOME_TASKS[task.kind].right]===true:operationsReady&&c[HOME_TASKS[task.kind].right]===true&&(task.kind!=='goods'||c.purchase===true);
 return {meta:{schemaVersion:'melisa-home.v1',date,timeZone:'Europe/Istanbul',readAt,source:'native-test',readOnly:true},capabilities,navigationReady,sections,tasks};
}
