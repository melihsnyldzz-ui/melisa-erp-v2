import {assertIsolatedCopyContext,assertIsolatedCopyActor,BUSINESS_COPY_DATABASE,isolatedCopyUUID} from './isolatedOperationCopyContext.mjs';
import {BUSINESS_PRICE_SCHEMA,BUSINESS_PRICE_BODY_KEYS,BUSINESS_PRICE_TUPLE_KEYS,BUSINESS_PRICE_READ_PERMISSIONS,BUSINESS_PRICE_WRITE_PERMISSION} from '../../../../scripts/canonical/shared-business-product-price-revision-contract.mjs';

export const businessProductPriceError=(code,statusCode=400)=>Object.assign(new Error('Ürün fiyatının kapsamı, yetkisi veya kayıtlı kaynağı doğrulanamadı.'),{code,statusCode});
const check=(ok,code='BUSINESS_PRODUCT_PRICE_INVALID',status=400)=>{if(!ok)throw businessProductPriceError(code,status);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const unitId=v=>id(v)&&BigInt(v)<=2147483647n;
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const decimal=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,19})\.\d{8}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.trim().length>=3&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const sameTuple=(a,b)=>['type','unitId','tier','currency'].every(k=>a[k]===b[k]);
const tuple=v=>exact(v,BUSINESS_PRICE_TUPLE_KEYS)&&v.type==='sale'&&(v.unitId===null||unitId(v.unitId))&&Number.isInteger(v.tier)&&v.tier>=0&&v.tier<=6&&['TRY','USD','EUR'].includes(v.currency);
function product(copy,productId){
 assertIsolatedCopyContext(copy);
 check(copy.target.database===BUSINESS_COPY_DATABASE&&copy.scopeKind==='VERIFIED_BUSINESS_TEST'&&copy.actualT1===false&&id(productId),'BUSINESS_PRODUCT_PRICE_SCOPE',403);
 const matches=copy.products.filter(p=>p.id===productId),p=matches[0];
 check(matches.length===1&&p.identityVerified===true&&p.sourceKnown===true&&!p.quarantined&&p.unit==='ADET'&&p.unitFactorExact8==='1.00000000','BUSINESS_PRODUCT_PRICE_SCOPE',403);
 return p;
}
function sourceQuote(copy,p,priceId){
 const matches=p.quotes.filter(q=>q.quoteId===priceId&&q.type==='sale'&&q.verified===true&&q.mainUnit===true),q=matches[0];
 check(matches.length===1&&p.priceIds.includes(priceId)&&decimal(q.priceExact8)&&q.priceExact8!==null&&BigInt(q.priceExact8.replace('.',''))>0n&&typeof q.nativeRowHash==='string'&&hash(q.nativeRowHash.toUpperCase())&&typeof q.bindingHash==='string'&&hash(q.bindingHash.toUpperCase()),'BUSINESS_PRODUCT_PRICE_SOURCE',503);
 check(Object.hasOwn(q,'unitSourceId')&&(q.unitSourceId===null||unitId(q.unitSourceId)||Number.isSafeInteger(q.unitSourceId)&&q.unitSourceId>0&&q.unitSourceId<=2147483647),'BUSINESS_PRODUCT_PRICE_SOURCE',503);
 return q;
}

// The store authenticates its native proof/capability before supplying actual
// actor and canEdit. This pure model never registers or grants a capability.
export function assertBusinessProductPriceActor(copy,actor,actual,{write=false,canEdit=false}={}){
 assertIsolatedCopyContext(copy);
 check(typeof write==='boolean'&&typeof canEdit==='boolean','BUSINESS_PRODUCT_PRICE_FORBIDDEN',403);
 for(const permission of BUSINESS_PRICE_READ_PERMISSIONS)assertIsolatedCopyActor(copy,actor,actual,permission);
 if(write){check(String(actor.id)==='16'&&canEdit===true,'BUSINESS_PRODUCT_PRICE_FORBIDDEN',403);assertIsolatedCopyActor(copy,actor,actual,BUSINESS_PRICE_WRITE_PERMISSION);}
}

export function parseBusinessProductPrice(copy,productId,body){
 const p=product(copy,productId);
 check(exact(body,BUSINESS_PRICE_BODY_KEYS)&&isolatedCopyUUID(body.requestId)&&typeof body.expectedRevision==='string'&&/^[a-f0-9]{64}$/i.test(body.expectedRevision)&&id(body.priceId)&&tuple(body.tuple)&&decimal(body.priceExact)&&text(body.reason,500));
 const q=sourceQuote(copy,p,body.priceId);
 check(body.tuple.currency===q.currency&&body.tuple.unitId===(q.unitSourceId===null?null:String(q.unitSourceId)),'BUSINESS_PRODUCT_PRICE_UNSUPPORTED',409);
 const input={requestId:body.requestId,expectedRevision:body.expectedRevision.toUpperCase(),priceId:body.priceId,tuple:{...body.tuple},priceExact:body.priceExact,reason:body.reason.trim()};
 return {...input,payloadJson:JSON.stringify(input)};
}

export function businessProductPriceContext(copy,raw,{canEdit=false}={}){
 const p=product(copy,raw?.productId),unavailable=ok=>check(ok,'BUSINESS_PRODUCT_PRICE_UNAVAILABLE',503);
 unavailable(exact(raw,['schemaVersion','productId','copyId','sealHash','operationOrigin','revision','canEdit','prices','recentChanges'])&&raw.schemaVersion===BUSINESS_PRICE_SCHEMA&&raw.copyId===copy.copyId&&raw.sealHash===copy.sealHash&&raw.operationOrigin==='ISOLATED_TEST_COPY'&&hash(raw.revision)&&typeof raw.canEdit==='boolean'&&typeof canEdit==='boolean'&&Array.isArray(raw.prices)&&raw.prices.length>0&&raw.prices.length===p.quotes.filter(q=>q.type==='sale'&&q.verified===true&&q.mainUnit===true).length&&Array.isArray(raw.recentChanges)&&raw.recentChanges.length<=100);
 const prices=raw.prices.map(row=>{
  unavailable(exact(row,['priceId','tuple','priceExact','currentVersionId','source'])&&id(row.priceId)&&tuple(row.tuple)&&decimal(row.priceExact)&&(row.currentVersionId===null||id(row.currentVersionId)));
  const q=sourceQuote(copy,p,row.priceId),s=row.source;
  unavailable(exact(s,['quoteId','priceExact8','nativeRowHash','bindingHash','sourceKey','sourceUnitId','versionRunId'])&&s.quoteId===row.priceId&&s.priceExact8===q.priceExact8&&s.nativeRowHash===q.nativeRowHash.toUpperCase()&&s.bindingHash===q.bindingHash.toUpperCase()&&s.sourceKey===p.sourceKey&&s.sourceUnitId===(q.unitSourceId===null?null:String(q.unitSourceId))&&s.versionRunId===copy.currentProductSourceVersionRunId&&row.tuple.unitId===s.sourceUnitId&&row.tuple.currency===q.currency);
  // Native proof binds tier/unit/currency to the exact source row hash. Never
  // invent a main-unit id, default tier, or a previously absent tuple here.
  unavailable(row.currentVersionId!==null||row.priceExact===s.priceExact8);
  return {...row,tuple:{...row.tuple},source:{...s}};
 });
 unavailable(new Set(prices.map(r=>r.priceId)).size===prices.length&&new Set(prices.map(r=>JSON.stringify(r.tuple))).size===prices.length);
 const recentChanges=raw.recentChanges.map(row=>{
  unavailable(exact(row,['versionId','requestId','actorId','priceId','tuple','beforePriceExact','priceExact','reason','createdAt'])&&id(row.versionId)&&isolatedCopyUUID(row.requestId)&&row.actorId==='16'&&id(row.priceId)&&tuple(row.tuple)&&decimal(row.beforePriceExact)&&decimal(row.priceExact)&&text(row.reason,500)&&typeof row.createdAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(row.createdAt)&&Number.isFinite(Date.parse(row.createdAt))&&prices.some(p=>p.priceId===row.priceId&&sameTuple(p.tuple,row.tuple)));
  return {...row,tuple:{...row.tuple}};
 });
 unavailable(new Set(recentChanges.map(r=>r.versionId)).size===recentChanges.length&&new Set(recentChanges.map(r=>r.requestId)).size===recentChanges.length);
 return {...raw,canEdit:canEdit&&raw.canEdit,prices,recentChanges};
}

export function assertSupportedBusinessProductPrice(input,context){
 check(context.prices.some(p=>p.priceId===input.priceId&&sameTuple(p.tuple,input.tuple)),'BUSINESS_PRODUCT_PRICE_UNSUPPORTED',409);
 // Native owner performs full-body UUID replay before current revision CAS.
 // An old expectedRevision must reach that owner; this model cannot preempt it.
}
