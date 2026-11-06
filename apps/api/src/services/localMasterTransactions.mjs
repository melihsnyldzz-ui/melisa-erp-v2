// Transaction coordinator only. It does not open SQL, install schema, grant
// permission, or create an HTTP route. A real store must implement the atomic
// contract below on the same verified physical database connection.
import {createHash} from 'node:crypto';
import {localCustomerIdentity,localProductIdentity} from './localMasterIdentity.mjs';
import {desktopInitialCostParity,desktopInitialOpeningAmountParity} from './desktopInitialCostParity.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const maxId=9223372036854775807n;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function id(v){if(typeof v!=='string'||!/^[1-9]\d*$/.test(v)||BigInt(v)>maxId)fail('LOCAL_MASTER_INPUT_INVALID');return v;}
function rec(v,keys){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('LOCAL_MASTER_INPUT_INVALID');
 const d=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(v);
 if(own.length!==keys.length||keys.some(k=>!Object.hasOwn(d,k)||!Object.hasOwn(d[k],'value')||!d[k].enumerable)
  ||own.some(k=>typeof k!=='string'||!keys.includes(k)))fail('LOCAL_MASTER_INPUT_INVALID');
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
function text(v,max){if(typeof v!=='string'||!v||v.trim()!==v||v.length>max||/[\u0000-\u001f\u007f]/.test(v))fail('LOCAL_MASTER_INPUT_INVALID');return v;}
function optionalLocation(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))fail('LOCAL_MASTER_INPUT_INVALID');
 const normalized=value.trim();if(normalized.length>100)fail('LOCAL_MASTER_INPUT_INVALID');return normalized||null;
}
function currency(v){if(typeof v!=='string'||!/^[A-Z]{3}$/.test(v))fail('LOCAL_MASTER_INPUT_INVALID');return v;}
function money4(v){if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v))fail('LOCAL_MASTER_INPUT_INVALID');return v;}
function discount4(v){
 if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,2})\.\d{4}$/.test(v)||BigInt(v.replace('.',''))>1000000n)fail('LOCAL_MASTER_INPUT_INVALID');
 return v;
}
function initialCost4(currencyCode,purchase,discount){
 // Reproduce the installed PR54 Number + Tedious path only when it agrees
 // with exact decimal arithmetic. The selected driver version must remain
 // pinned by startup; SQL integration and non-TRY cost are not yet proven.
 return desktopInitialCostParity({currency:currencyCode,purchasePriceExact4:purchase,purchaseDiscountRateExact4:discount});
}
function command(input,operation){
 const fields=operation==='customer.create'?['requestId','customerCode','name','phone','customerType','currency']:
  ['requestId','stockCode','name','barcode','unit','currency','salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','saleTier'];
 const optional=operation==='customer.create'?['city','country']:['openingQuantityExact3','openingDate'];
 const descriptors=input&&typeof input==='object'&&!Array.isArray(input)?Object.getOwnPropertyDescriptors(input):null;
 if(!descriptors||![Object.prototype,null].includes(Object.getPrototypeOf(input))||
  Reflect.ownKeys(input).some(k=>typeof k!=='string'||![...fields,...optional].includes(k)||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value'))||
  fields.some(k=>!Object.hasOwn(descriptors,k)))fail('LOCAL_MASTER_INPUT_INVALID');
 const v=Object.fromEntries([...fields,...optional].filter(k=>Object.hasOwn(descriptors,k)).map(k=>[k,descriptors[k].value]));
 if(typeof v.requestId!=='string'||!uuid.test(v.requestId))fail('LOCAL_MASTER_INPUT_INVALID');
 if(operation==='customer.create'){
  if(!['customer','wholesale','retail','mixed'].includes(v.customerType))fail('LOCAL_MASTER_INPUT_INVALID');
  return Object.freeze({requestId:v.requestId,customerCode:text(v.customerCode,50),name:text(v.name,250),phone:text(v.phone,40),
   customerType:v.customerType,currency:currency(v.currency),city:optionalLocation(v.city),country:optionalLocation(v.country)});
 }
 if(v.saleTier!==null&&(!Number.isInteger(v.saleTier)||v.saleTier< -2147483648||v.saleTier>2147483647))fail('LOCAL_MASTER_INPUT_INVALID');
 let opening={};if(Object.hasOwn(v,'openingQuantityExact3')||Object.hasOwn(v,'openingDate')){
  if(typeof v.openingQuantityExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(v.openingQuantityExact3)||typeof v.openingDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.openingDate))fail('LOCAL_MASTER_INPUT_INVALID');
  const [year,month,day]=v.openingDate.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));if(year<1900||year>9999||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)fail('LOCAL_MASTER_INPUT_INVALID');
  if(BigInt(v.openingQuantityExact3.replace('.',''))>9007199254740991n||v.openingQuantityExact3!=='0.000'&&(v.currency!=='TRY'||v.unit!=='ADET'))fail('LOCAL_MASTER_INPUT_INVALID');
  opening={openingQuantityExact3:v.openingQuantityExact3,openingDate:v.openingDate};
 }
 return Object.freeze({requestId:v.requestId,stockCode:text(v.stockCode,50),name:text(v.name,250),barcode:text(v.barcode,80),
  unit:text(v.unit,20),currency:currency(v.currency),salePriceExact4:money4(v.salePriceExact4),
  purchasePriceExact4:money4(v.purchasePriceExact4),purchaseDiscountRateExact4:discount4(v.purchaseDiscountRateExact4),saleTier:v.saleTier,...opening});
}
const digest=value=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const unknown=requestId=>Object.freeze({state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY',requiresRecovery:true});
export const LOCAL_MASTER_TRANSACTION_LIMITS=Object.freeze({sqlAdapterImplemented:false,routeInstalled:false,sourceOriginProven:false,
 requiresVerifiedSameConnection:true,requiresLockedDatabaseAuthority:true,requiresDatabaseAtomicJournal:true,requiresDatabaseUniqueness:true,
 requiresIndependentSqlRollbackProof:true,requiresCostNumericParityProof:true,firstSendFreshnessProven:false,
 nativePurchaseQuoteIntegrated:false,realErpComplete:false});

// Store contract: withTransaction(work) must use one verified connection and
// commit work + durable request journal atomically. On any throw it must roll
// back; commit acknowledgement loss can occur after commit and stays UNKNOWN.
// beginRequest must serialize by requestId, verify operation/actor/hash, return
// NEW, REPLAY (with the original response), or CONFLICT. finishRequest writes
// that response in the same transaction; it may never generate a new request.
// lockAndVerifyAuthority must check target, authenticated current session and
// actor/permission on this connection and hold the relevant authority stable
// through commit; the coordinator cannot itself verify this contract.
export function createLocalMasterTransactions({store,authorize,onFailure=()=>{}}={}){
 if(!store||typeof store.withTransaction!=='function'||typeof authorize!=='function')fail('LOCAL_MASTER_CONFIGURATION_INVALID');
 async function run(operation,actor,input){
  // For an existing valid request id, invalid input or lost permission cannot
  // prove a previous send was rejected. Never convert that state to a denial.
  const descriptor=input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,'requestId'):null;
  const requestId=descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:null;
  if(typeof requestId!=='string'||!uuid.test(requestId))fail('LOCAL_MASTER_INPUT_INVALID');
  try{
   const principal=id(actor),payload=command(input,operation),permission=operation==='customer.create'?'customer.edit':'product.edit';
   if(await authorize({actorId:principal,permission})!==true)return unknown(requestId);
   const averageCostTryExact4=operation==='product.create'?initialCost4(payload.currency,payload.purchasePriceExact4,payload.purchaseDiscountRateExact4):null;
   const openingAmountTryExact4=operation==='product.create'&&payload.openingQuantityExact3&&payload.openingQuantityExact3!=='0.000'?desktopInitialOpeningAmountParity({quantityExact3:payload.openingQuantityExact3,costExact4:averageCostTryExact4}):null;
   const payloadHash=digest({operation,actorId:principal,payload});
   const result=await store.withTransaction(async tx=>{
    if(await tx.lockAndVerifyAuthority({actorId:principal,permission})!==true)fail('LOCAL_MASTER_AUTHORITY_UNAVAILABLE');
    const reservation=await tx.beginRequest({requestId,operation,actorId:principal,payloadHash});
    if(reservation?.state==='CONFLICT')return unknown(requestId);
    if(reservation?.state==='REPLAY'){
     if(!reservation.response||reservation.response.requestId!==requestId||reservation.response.operation!==operation)fail('LOCAL_MASTER_JOURNAL_INVALID');
     return {state:'COMMITTED',requestId,operation,replayed:true,entity:reservation.response.entity};
    }
    if(reservation?.state!=='NEW')fail('LOCAL_MASTER_JOURNAL_INVALID');
    let entity;
    if(operation==='customer.create'){
     const customerId=id(await tx.insertCustomer({actorId:principal,...payload}));
     const entityId=id(await tx.insertPartyEntity({actorId:principal,role:'customer',name:payload.name,country:payload.country}));
     await tx.attachCustomerEntity({customerId,entityId});
     const accountId=id(await tx.insertCurrencyAccount({customerId,entityId,currency:payload.currency,currentBalanceExact8:'0.00000000'}));
     const rows=rec(await tx.readCustomerPersistence({customerId,entityId,accountId}),['customer','entity','account']);
     const c=rec(rows.customer,['id','entityId','currency','customerCode','name','phone','customerType','city','country']);
     const e=rec(rows.entity,['id','role','name','country']);
     const a=rec(rows.account,['id','entityId','customerId','supplierId','currency','currentBalanceExact8']);
     if(c.id!==customerId||c.entityId!==entityId||c.currency!==payload.currency||c.customerCode!==payload.customerCode
      ||c.name!==payload.name||c.phone!==payload.phone||c.customerType!==payload.customerType||c.city!==payload.city||c.country!==payload.country
      ||e.id!==entityId||e.role!=='customer'||e.name!==payload.name||e.country!==payload.country||a.id!==accountId||a.entityId!==entityId
      ||a.customerId!==customerId||a.supplierId!==null||a.currency!==payload.currency||a.currentBalanceExact8!=='0.00000000')fail('LOCAL_MASTER_CUSTOMER_READBACK_INVALID');
     entity=localCustomerIdentity({customer:{id:c.id,entityId:c.entityId,currency:c.currency},entity:{id:e.id,role:e.role},accounts:[a]});
    }else{
     const initialStockExact3=payload.openingQuantityExact3??'0.000';
     const productId=id(await tx.insertProduct({actorId:principal,...payload,averageCostTryExact4,initialStockExact3}));
     const unitId=id(await tx.insertLocalUnit({productId,label:payload.unit,factorExact8:'1.00000000',isMain:true}));
     const barcodeId=id(await tx.insertBarcode({actorId:principal,productId,barcode:payload.barcode}));
     const priceExact8=payload.salePriceExact4+'0000';
     const priceId=id(await tx.insertNativePrice({productId,type:'sale',tier:payload.saleTier,currency:payload.currency,priceExact8,sourceUnitId:null}));
     await tx.linkLocalPriceUnit({productId,unitId,priceId});
     if(initialStockExact3!=='0.000'){
      const amountTryExact4=openingAmountTryExact4;
      const movementId=id(await tx.insertOpeningMovement({productId,actorId:principal,quantityExact3:initialStockExact3,averageCostTryExact4,unitPriceExact4:payload.purchasePriceExact4,amountTryExact4,documentDate:payload.openingDate}));
      const opening=rec(await tx.readOpeningMovement({productId,movementId}),['id','productId','actorId','quantityInExact3','quantityOutExact3','quantityNetExact3','unitCostTryExact4','unitPriceExact4','amountTryExact4','documentDate','currency','movementType','sourceType','sourceId','productMovementCount']);
      if(opening.id!==movementId||opening.productId!==productId||opening.actorId!==principal||opening.quantityInExact3!==initialStockExact3||opening.quantityOutExact3!=='0.000'||opening.quantityNetExact3!==initialStockExact3||opening.unitCostTryExact4!==averageCostTryExact4||opening.unitPriceExact4!==payload.purchasePriceExact4||opening.amountTryExact4!==amountTryExact4||opening.documentDate!==payload.openingDate||opening.currency!=='TRY'||opening.movementType!=='in'||opening.sourceType!=='stock_adjustment'||opening.sourceId!==null||opening.productMovementCount!=='1')fail('LOCAL_MASTER_OPENING_READBACK_INVALID');
     }
     // Explicit readback contract: no successful journal if legacy purchase,
     // discount, cost, currency or sales values failed to persist exactly.
     const rows=rec(await tx.readProductPersistence({productId,unitId,barcodeId,priceId}),['product','unit','barcode','price','link']);
     const p=rec(rows.product,['id','stockCode','name','unit','currency','salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','averageCostTryExact4','initialStockExact3']);
     const u=rec(rows.unit,['id','productId','label','factorExact8','isMain']);
     const b=rec(rows.barcode,['id','productId','barcode','isPrimary','isActive']);
     const q=rec(rows.price,['id','productId','type','tier','currency','priceExact8','sourceUnitId']);
     const l=rec(rows.link,['productId','unitId','priceId']);
     if(p.id!==productId||p.stockCode!==payload.stockCode||p.name!==payload.name||p.unit!==payload.unit||p.currency!==payload.currency
      ||p.salePriceExact4!==payload.salePriceExact4||p.purchasePriceExact4!==payload.purchasePriceExact4
      ||p.purchaseDiscountRateExact4!==payload.purchaseDiscountRateExact4||p.averageCostTryExact4!==averageCostTryExact4||p.initialStockExact3!==initialStockExact3
      ||u.id!==unitId||u.productId!==productId||u.label!==payload.unit||u.factorExact8!=='1.00000000'||u.isMain!==true
      ||b.id!==barcodeId||b.productId!==productId||b.barcode!==payload.barcode||b.isPrimary!==true||b.isActive!==true
      ||q.id!==priceId||q.productId!==productId||q.type!=='sale'||q.tier!==payload.saleTier||q.currency!==payload.currency||q.priceExact8!==priceExact8||q.sourceUnitId!==null
      ||l.productId!==productId||l.unitId!==unitId||l.priceId!==priceId)fail('LOCAL_MASTER_PRODUCT_READBACK_INVALID');
     entity=localProductIdentity({product:{id:p.id,name:p.name},units:[u],
      prices:[{id:q.id,productId:q.productId,type:q.type,unitId:l.unitId,tier:q.tier,currency:q.currency,priceExact8:q.priceExact8}]});
    }
    await tx.appendAudit({actorId:principal,operation,entityId:entity.id,requestId});
    const audit=rec(await tx.readMasterAudit({requestId}),['requestId','actorId','operation','entityId']);
    if(audit.requestId!==requestId||audit.actorId!==principal||audit.operation!==operation||audit.entityId!==entity.id)fail('LOCAL_MASTER_AUDIT_READBACK_INVALID');
    const response={requestId,operation,entity};
    await tx.finishRequest({requestId,operation,actorId:principal,payloadHash,response});
    const journal=rec(await tx.readFinishedRequest({requestId}),['requestId','operation','actorId','payloadHash','response']);
    if(journal.requestId!==requestId||journal.operation!==operation||journal.actorId!==principal||journal.payloadHash!==payloadHash
     ||JSON.stringify(journal.response)!==JSON.stringify(response))fail('LOCAL_MASTER_JOURNAL_READBACK_INVALID');
    return {state:'COMMITTED',requestId,operation,replayed:false,entity};
   });
   if(!result||!['COMMITTED','UNKNOWN'].includes(result.state)||result.requestId!==requestId)fail('LOCAL_MASTER_JOURNAL_INVALID');
   return Object.freeze(result);
  }catch(error){try{onFailure({requestId,error});}catch{}return unknown(requestId);}
 }
 return Object.freeze({createCustomer:(actor,input)=>run('customer.create',actor,input),
  createProduct:(actor,input)=>run('product.create',actor,input)});
}
