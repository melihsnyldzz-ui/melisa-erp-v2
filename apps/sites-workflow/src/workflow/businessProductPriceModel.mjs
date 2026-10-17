import {canonicalPrice,tupleKey} from './testProductPriceModel.mjs';
export {canonicalPrice,tupleKey};
const fail=()=>{throw Error('Ürün fiyatı doğrulanamadı. Güncel kaydı yeniden açın.');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v);
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const amount=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,19})\.\d{8}$/.test(v);
const tuple=t=>t&&Object.keys(t).sort().join(',')==='currency,tier,type,unitId'&&t.type==='sale'&&(t.unitId===null||id(t.unitId))&&Number.isInteger(t.tier)&&t.tier>=0&&t.tier<=6&&['TRY','USD','EUR'].includes(t.currency);

export function businessPriceContext(raw,productId){
  if(!id(productId)||raw?.schemaVersion!=='melisa-business-product-prices.v1'||raw.productId!==productId||!uuid(raw.copyId)||!hash(raw.sealHash)||!hash(raw.revision)||raw.operationOrigin!=='ISOLATED_TEST_COPY'||typeof raw.canEdit!=='boolean'||!Array.isArray(raw.prices)||!raw.prices.length||!Array.isArray(raw.recentChanges))fail();
  if(raw.prices.some(p=>!id(p.priceId)||!tuple(p.tuple)||!amount(p.priceExact)||(p.currentVersionId!==null&&!id(p.currentVersionId))||p.source?.quoteId!==p.priceId||!amount(p.source.priceExact8)||p.source.priceExact8===null||!hash(p.source.nativeRowHash)||!hash(p.source.bindingHash)||p.source.sourceUnitId!==p.tuple.unitId||(p.currentVersionId===null&&p.priceExact!==p.source.priceExact8)))fail();
  if(new Set(raw.prices.map(p=>p.priceId)).size!==raw.prices.length||new Set(raw.prices.map(p=>tupleKey(p.tuple))).size!==raw.prices.length)fail();
  if(raw.recentChanges.length>100||raw.recentChanges.some(r=>!id(r.versionId)||!uuid(r.requestId)||r.actorId!=='16'||!id(r.priceId)||!tuple(r.tuple)||!amount(r.beforePriceExact)||!amount(r.priceExact)||typeof r.reason!=='string'||r.reason.trim().length<3||r.reason.length>500||/[\u0000-\u001f\u007f]/.test(r.reason)||typeof r.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(r.createdAt)||!Number.isFinite(Date.parse(r.createdAt))||!raw.prices.some(p=>p.priceId===r.priceId&&tupleKey(p.tuple)===tupleKey(r.tuple))))fail();
  if(new Set(raw.recentChanges.map(r=>r.versionId)).size!==raw.recentChanges.length||new Set(raw.recentChanges.map(r=>r.requestId)).size!==raw.recentChanges.length)fail();
  return raw;
}

// Display rounds strings with integer arithmetic; stored/editable exact8 is
// never replaced by this two-decimal representation.
export function businessPriceDisplay(value){
  if(!amount(value))fail();
  if(value===null)return 'Bilinmiyor';
  const n=(BigInt(value.replace('.',''))+500000n)/1000000n;
  return `${n/100n},${String(n%100n).padStart(2,'0')}`;
}
export function businessPriceRequest(context,{priceId,priceExact,reason},requestId){
  businessPriceContext(context,context.productId);
  const p=context.prices.find(p=>p.priceId===priceId);
  if(!p||!uuid(requestId)||!amount(priceExact)||typeof reason!=='string'||reason.trim().length<3||reason.length>500||/[\u0000-\u001f\u007f]/.test(reason))fail();
  return {requestId,expectedRevision:context.revision,priceId,tuple:{...p.tuple},priceExact,reason:reason.trim()};
}
export function businessPricePending(value,context,actorId){
  if(!value||value.productId!==context.productId||value.copyId!==context.copyId||value.sealHash!==context.sealHash||value.actorId!==String(actorId)||!['pending','saved','rejected'].includes(value.status))fail();
  const b=value.body;
  if(!b||Object.keys(b).sort().join(',')!=='expectedRevision,priceExact,priceId,reason,requestId,tuple'||!hash(b.expectedRevision)||!uuid(b.requestId)||!amount(b.priceExact)||!tuple(b.tuple)||typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.length>500||b.reason!==b.reason.trim()||/[\u0000-\u001f\u007f]/.test(b.reason)||!context.prices.some(p=>p.priceId===b.priceId&&tupleKey(p.tuple)===tupleKey(b.tuple)))fail();
  return value;
}
