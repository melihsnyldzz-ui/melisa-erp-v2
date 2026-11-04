import {validateOperationCopyBootstrap} from './isolatedOperationCopyModel.mjs';

const key='melisa-work-selected-source-collection-v1';
const copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
const fail=()=>{throw Error('Seçili kaynak fiş aktarımı doğrulanamadı.');};

export function clearSelectedSourceHandoff(storage){try{storage.removeItem(key);}catch{fail();}}

export function selectedSourceCopy({profile,location,apiBase}){
 try {
  if(location?.protocol!=='http:'||location?.port!=='5234'||!['127.0.0.1','192.168.1.46'].includes(location.hostname)||location.origin!==`http://${location.hostname}:5234`||apiBase!==`http://${location.hostname}:4184`)return null;
  const copy=validateOperationCopyBootstrap(profile,location);
  return copy.copyId===copyId&&copy.scopeKind==='VERIFIED_BUSINESS_TEST'&&copy.actors.some(a=>a.id==='15'&&a.role==='isolated_test_sales')&&copy.actors.some(a=>a.id==='16'&&a.role==='isolated_test_ilker')?copy:null;
 }catch{return null;}
}

export function verifySelectedSourceReceipt({invoice,context,copy}){
 const selected=context?.meta?.selectedSale;
 if(!copy||context?.meta?.copyId!==copy.copyId||context.meta.sealHash!==copy.sealHash||context.meta.operationOrigin!==copy.operationOrigin||context.meta.date!==copy.date||selected?.source!=='SOURCE'||!id(invoice?.id)||invoice.status!=='finalized'||invoice.currency!=='TRY'||invoice.createdBy!=='15'||invoice.documentDate!==copy.date||invoice.capabilities?.canCollect!==false||invoice.capabilities?.canCancelCollection!==false||!id(invoice.customerId)||invoice.customerId!==selected.customerId||invoice.customerId!==context.scope?.customer?.id||selected.currency!=='TRY'||!Array.isArray(invoice.items)||!invoice.items.length||invoice.items.some(p=>!selected.productIds?.includes(p.productId))||!context.capabilities?.canCreate)fail();
 return invoice.id;
}

export function saveSelectedSourceHandoff({storage,invoice,context,copy,user,now=Date.now()}){
 if(user?.id!==15||user.role?.code!=='isolated_test_sales'||!user.permissions?.includes('sales.view')||!Number.isSafeInteger(now)||now<0)fail();
 const invoiceId=verifySelectedSourceReceipt({invoice,context,copy});
 const record={version:1,invoiceId,copyId:copy.copyId,sealHash:copy.sealHash,fromActorId:15,createdAt:now};
 try{storage.setItem(key,JSON.stringify(record));}catch{fail();}
 return record;
}

export function readSelectedSourceHandoff({storage,copy,user,now=Date.now()}){
 if(!copy||user?.id!==16||user.role?.code!=='isolated_test_ilker'||!['finance.view','customer.view','finance.collection'].every(p=>user.permissions?.includes(p))||!Number.isSafeInteger(now))return null;
 let record;
 try{record=JSON.parse(storage.getItem(key));}catch{return null;}
 if(!record||Object.keys(record).sort().join(',')!=='copyId,createdAt,fromActorId,invoiceId,sealHash,version'||record.version!==1||!id(record.invoiceId)||record.copyId!==copy.copyId||record.sealHash!==copy.sealHash||record.fromActorId!==15||!Number.isSafeInteger(record.createdAt)||record.createdAt>now||now-record.createdAt>15*60*1000)return null;
 return {invoiceId:record.invoiceId};
}
