const revision=/^[a-f0-9]{64}$/i, uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=message=>{throw Error(message || 'Kayıtlı TEST fiyatı doğrulanamadı.');};
export const canViewCurrentPrices=permissions=>['product.view','purchase.view'].every(p=>permissions.includes(p));
export const canEditCurrentPrices=(actorId,permissions)=>String(actorId)==='16'&&canViewCurrentPrices(permissions)&&permissions.includes('product.price.edit');
export const tupleKey=t=>JSON.stringify([t.type,t.unitId,t.tier,t.currency]);
export function supportedPriceTuples(c){
 if(!Array.isArray(c.supportedTuples)||!c.supportedTuples.length)fail();
 return c.supportedTuples;
}
export function canonicalPrice(value,unknown=false){
 if(unknown)return null;
 if(typeof value!=='string')fail('Fiyatı metin olarak girin.');
 const s=value.trim().replace(',','.');
 if(!/^(0|[1-9]\d{0,19})(?:\.\d{1,8})?$/.test(s))fail('Pozitif fiyat veya gerçek sıfır girin; en fazla sekiz ondalık basamak kullanın.');
 const [whole,fraction='']=s.split('.');return `${whole}.${fraction.padEnd(8,'0')}`;
}
export function currentPriceContext(value){
 const c=value?.capabilities,p=value?.product;
 if(p?.id!=='301986'||p.synthetic!==true||typeof p.name!=='string'||typeof p.stockCode!=='string'||!revision.test(value.revision||'')||!c||typeof c.canEdit!=='boolean'||!Array.isArray(c.currencies)||!c.currencies.length||c.currencies.some(x=>!['TRY','USD','EUR'].includes(x))||!Array.isArray(c.units)||!c.units.length||c.units.some(u=>typeof u.id!=='string'||typeof u.label!=='string'||!/^\d+\.\d{8}$/.test(u.factorExact8||'')||typeof u.isMainUnit!=='boolean')||c.purchaseTier!==0||!Array.isArray(c.saleTiers)||c.saleTiers.some(x=>!Number.isInteger(x)||x<1||x>6)||!Array.isArray(value.prices)||!Array.isArray(value.recentChanges))fail();
 const tuples=supportedPriceTuples(c),seen=new Set();
 if(tuples.some(t=>!t||Object.keys(t).length!==4||!['type','unitId','tier','currency'].every(k=>Object.hasOwn(t,k))||!c.currencies.includes(t.currency)||!['purchase','sale'].includes(t.type)||(t.type==='purchase'&&(t.unitId!==null||t.tier!==c.purchaseTier))||(t.type==='sale'&&(!c.units.some(u=>u.id===t.unitId)||!c.saleTiers.includes(t.tier))))||new Set(tuples.map(tupleKey)).size!==tuples.length)fail();
 for(const row of [...value.prices,...value.recentChanges]){
  if(typeof row.id!=='string'||!/^[1-9]\d*$/.test(row.id)||typeof row.versionId!=='string'||!/^[1-9]\d*$/.test(row.versionId)||!revision.test(row.revision||'')||!tuples.some(t=>tupleKey(t)===tupleKey(row))||!(row.priceExact===null||typeof row.priceExact==='string'&&canonicalPrice(row.priceExact)===row.priceExact)||row.provenance?.source!=='synthetic-native-price-card'||typeof row.provenance?.reason!=='string'||row.provenance?.actorId!=='16'||!Number.isFinite(Date.parse(row.provenance?.changedAt)))fail();
 }
 for(const row of value.prices){if(seen.has(tupleKey(row)))fail();seen.add(tupleKey(row));}
 return value;
}
export function currentPriceRequest(context,{tuple,priceId=null,priceExact,reason},requestId){
 currentPriceContext(context);
 if(!uuid.test(requestId||'')||!supportedPriceTuples(context.capabilities).some(t=>tupleKey(t)===tupleKey(tuple))||!(priceExact===null||canonicalPrice(priceExact)===priceExact)||typeof reason!=='string'||reason.trim().length<3||reason.length>500||/[\u0000-\u001f\u007f]/.test(reason))fail('Fiyat seçimini ve en az üç karakterlik değişiklik gerekçesini kontrol edin.');
 const existing=context.prices.find(p=>tupleKey(p)===tupleKey(tuple));if((existing?.id??null)!==priceId)fail('Fiyat kaydı değişti. Güncel fiyatları yükleyin.');
 return {requestId,expectedRevision:context.revision,priceId,tuple:{type:tuple.type,unitId:tuple.unitId,tier:tuple.tier,currency:tuple.currency},priceExact,reason:reason.trim()};
}
export function priceJournal(value){
 if(!value||!['dirty','pending','saved','stale'].includes(value.status))fail('Önceki fiyat isteği okunamıyor; düzenleme kapalı.');
 currentPriceContext(value.context);
 const f=value.fields;if(!f||typeof f.tupleKey!=='string'||!supportedPriceTuples(value.context.capabilities).some(t=>tupleKey(t)===f.tupleKey)||typeof f.price!=='string'||typeof f.reason!=='string'||typeof f.unknown!=='boolean'||!(f.priceId===null||typeof f.priceId==='string'))fail();
 if(value.request){const checked=currentPriceRequest(value.context,value.request,value.request.requestId);if(JSON.stringify(checked)!==JSON.stringify(value.request))fail();}
 if(value.request&&(tupleKey(value.request.tuple)!==f.tupleKey||value.request.priceId!==f.priceId||value.request.priceExact!==canonicalPrice(f.price,f.unknown)||value.request.reason!==f.reason.trim()))fail();
 if(['pending','saved'].includes(value.status)&&!value.request)fail();return value;
}
export function priceCompletionMatches(current,sent,next){
 try{priceJournal(current);priceJournal(sent);}catch{return false;}
 return !!current.request&&JSON.stringify(current.request)===JSON.stringify(sent.request)&&!(current.status==='saved'&&next!=='saved');
}
