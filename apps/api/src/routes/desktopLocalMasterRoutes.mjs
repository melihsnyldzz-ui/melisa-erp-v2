// SOURCE ONLY: no listener, SQL connection, session provider or writable route
// is installed by importing this file. The integrator must supply a verified
// normal-session authenticator and the existing atomic master coordinator.
import {Router} from 'express';
import {isDurableProductRejection} from '../services/desktopProductRejection.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const customerRequired=['requestId','customerCode','phone','customerType','currency'];
const customerOptional=['name','customerName','city','country'];
const productRequired=['requestId','stockCode','barcode','unit','currency','salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','saleTier'];
const productOptional=['name','productName','openingQuantityExact3','openingDate'];
const fail=()=>{throw Error('DESKTOP_LOCAL_ROUTE_CONFIGURATION');};
const unknown=requestId=>({state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY',requiresRecovery:true});
const id=value=>{
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)value=String(value);
 return typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n?value:null;
};
const persistedId=value=>typeof value==='string'&&id(value)===value;
function ownObject(value,required,optional){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const desc=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
 if(keys.some(k=>typeof k!=='string'||![...required,...optional].includes(k)||!desc[k].enumerable||!Object.hasOwn(desc[k],'value'))||required.some(k=>!Object.hasOwn(desc,k)))return null;
 return Object.fromEntries(keys.map(k=>[k,desc[k].value]));
}
function adapt(input,kind,richCards){
 if(kind==='supplier')return ownObject(input,['requestId','supplierCode','name','phone','city','country','currency','purchaseDiscountRateExact4'],[]);
 const customer=kind==='customer';const x=ownObject(input,customer?customerRequired:productRequired,customer?customerOptional:[...productOptional,...(richCards?['brand','category','supplierId','additionalBarcodes']:[])]);
 if(!x)return null;const legacy=customer?'customerName':'productName';
 // Exactly one spelling: refuse accidental overwrite or undisclosed data loss.
 if(Object.hasOwn(x,'name')===Object.hasOwn(x,legacy))return null;
 const {name,[legacy]:legacyName,...rest}=x;
 return {...rest,name:name??legacyName};
}
function trustedLocal(req){return ['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)
 &&req.get('host')==='127.0.0.1:4294'&&req.get('origin')==='http://127.0.0.1:5294'&&req.is('application/json')&&Object.keys(req.query||{}).length===0;}
function committedEntity(value,kind,input){
 if(kind==='supplier'){
  const s=ownObject(value,['kind','id','entityId','selectedCurrency','accounts'],[]);
  if(!s||s.kind!=='local'||!persistedId(s.id)||!persistedId(s.entityId)||s.selectedCurrency!==input.currency||!Array.isArray(s.accounts)||s.accounts.length!==1)return false;
  const a=ownObject(s.accounts[0],['id','supplierId','currency','currentBalanceExact8'],[]);
  return !!a&&persistedId(a.id)&&a.supplierId===s.id&&a.currency===input.currency&&a.currentBalanceExact8==='0.00000000';
 }
 if(kind==='customer'){
  const c=ownObject(value,['kind','id','entityId','selectedCurrency','accounts'],[]);
  if(!c||c.kind!=='local'||!persistedId(c.id)||!persistedId(c.entityId)||c.selectedCurrency!==input.currency||!Array.isArray(c.accounts)||c.accounts.length!==1)return false;
  const a=ownObject(c.accounts[0],['id','customerId','currency','currentBalanceExact8'],[]);
  return !!a&&persistedId(a.id)&&a.customerId===c.id&&a.currency===input.currency&&a.currentBalanceExact8==='0.00000000';
 }
 const p=ownObject(value,['kind','id','name','units','prices'],[]);
 if(!p||p.kind!=='local'||!persistedId(p.id)||p.name!==input.name||!Array.isArray(p.units)||p.units.length!==1||!Array.isArray(p.prices)||p.prices.length!==1)return false;
 const u=ownObject(p.units[0],['id','label','factorExact8','isMain'],[]),q=ownObject(p.prices[0],['id','type','unitId','tier','currency','priceExact8'],[]);
 return !!u&&!!q&&persistedId(u.id)&&persistedId(q.id)&&u.label===input.unit&&u.factorExact8==='1.00000000'&&u.isMain===true&&
  q.type==='sale'&&q.unitId===u.id&&q.tier===input.saleTier&&q.currency===input.currency&&typeof input.salePriceExact4==='string'&&q.priceExact8===input.salePriceExact4+'0000';
}

export const DESKTOP_LOCAL_MASTER_ROUTES_LIMITS=Object.freeze({sourceOnly:true,routerMounted:false,writableProfileInstalled:false,
 requiresVerifiedNormalSession:true,requiresCurrentSessionAndAuthorityRecheckInSqlTransaction:true,
 requiresDedicatedWriterAndTargetIdentity:true,requiresJournalAndExactBodyReplay:true,realSqlVerified:false,fullErpReady:false});

// authenticateNormal(req) must verify the actual bearer credential, current
// active user/role and session, reject TEST-admin/native/impersonated sessions,
// and return {kind:'normal',userId,permissions}. Never populate it from a
// client body, unsigned header, static flag or role selector. This factory is
// not a production readiness check; the writer rechecks the same authority
// and locks it within the transaction. Errors for a valid UUID are UNKNOWN,
// because a previous same-UUID request may already have committed.
export function createDesktopLocalMasterRoutes({service,authenticateNormal,richCards=false}={}){
 if(typeof richCards!=='boolean'||richCards&&typeof service?.createSupplier!=='function')fail();
 if(!service||typeof service.createCustomer!=='function'||typeof service.createProduct!=='function'||typeof authenticateNormal!=='function')fail();
 const router=Router({caseSensitive:true,strict:true});
 function handler(kind){return async(req,res)=>{
  res.set('Cache-Control','no-store');
  const descriptor=req.body&&typeof req.body==='object'?Object.getOwnPropertyDescriptor(req.body,'requestId'):null;
  const requestId=descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:null;
  if(typeof requestId!=='string'||!uuid.test(requestId))return res.status(400).json({success:false,error:{code:'REQUEST_ID_INVALID'}});
  const uncertain=()=>res.status(503).json({success:false,data:unknown(requestId),error:{code:'LOCAL_REQUEST_UNKNOWN'}});
  if(!trustedLocal(req))return uncertain();
  const input=adapt(req.body,kind,richCards);if(!input)return uncertain();
  let session;try{session=await authenticateNormal(req);}catch{return uncertain();}
  const actor=id(session?.userId),permission={customer:'customer.edit',product:'product.edit',supplier:'supplier.edit'}[kind];
  if(!actor||session?.kind!=='normal'||!Array.isArray(session.permissions)||!session.permissions.includes(permission))return uncertain();
  let result;try{result=await service[{customer:'createCustomer',product:'createProduct',supplier:'createSupplier'}[kind]](actor,input);}catch{return uncertain();}
  if(richCards&&kind==='product'&&isDurableProductRejection(result,requestId))return res.status(409).json({success:false,data:result,error:{code:result.reason}});
  if(!result||result.state!=='COMMITTED'||result.requestId!==requestId||result.operation!==kind+'.create'||typeof result.replayed!=='boolean'||!committedEntity(result.entity,kind,input))return uncertain();
  return res.status(result.replayed===true?200:201).json({success:true,data:result});
 };}
 router.post('/api/desktop-local/customers',handler('customer'));
 router.post('/api/desktop-local/products',handler('product'));
 if(richCards)router.post('/api/desktop-local/suppliers',handler('supplier'));
 return router;
}
