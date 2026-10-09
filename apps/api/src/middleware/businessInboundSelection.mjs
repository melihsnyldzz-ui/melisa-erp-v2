import {AsyncLocalStorage} from 'node:async_hooks';
const selections=new AsyncLocalStorage();
const database='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const fail=(code,statusCode=400)=>{throw Object.assign(Error('Doğrulanmış tedarikçi ve döviz seçimi gerekli.'),{code,statusCode});};
export function parseBusinessInboundSelection(copy,headers={}){
 const supplierId=headers.supplierId,currency=headers.currency;
 if(supplierId===undefined&&currency===undefined)return null;
 if(copy?.target?.database!==database)fail('INBOUND_SELECTION_OUTSIDE_SCOPE',403);
 if(typeof supplierId!=='string'||!/^[1-9]\d{0,15}$/.test(supplierId)||BigInt(supplierId)>BigInt(Number.MAX_SAFE_INTEGER)||!['TRY','USD','EUR'].includes(currency))fail('INBOUND_SELECTION_INVALID');
 const matches=copy.suppliers?.filter(p=>p.id===supplierId&&p.currency===currency);
 if(matches?.length!==1)fail('INBOUND_SUPPLIER_OUTSIDE_SCOPE',403);
 return Object.freeze({supplierId,currency,accountId:matches[0].accountId});
}
export function withBusinessInboundSelection(copy,selection,fn){return selections.run({copy,selection},fn);}
export function getBusinessInboundSelection(copy){const current=selections.getStore();if(!current)return null;if(copy&&current.copy!==copy)fail('INBOUND_SELECTION_CONTEXT_CHANGED',403);return current.selection;}
export function createBusinessInboundSelectionMiddleware({getContext=async()=>{const db=await import('../config/database.js');return db.isIsolatedOperationCopyRuntime?.()?db.getIsolatedOperationCopyConfig():null;}}={}){
 return async(req,_res,next)=>{try{const copy=await getContext(),selection=parseBusinessInboundSelection(copy,{supplierId:req.get('x-melisa-supplier-id'),currency:req.get('x-melisa-currency')});withBusinessInboundSelection(copy,selection,next);}catch(error){next(error);}};
}
