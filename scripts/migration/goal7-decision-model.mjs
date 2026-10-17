import {decimal, sumDecimals, hash, requireRule} from './mapping-opening.mjs';

// Pure analysis only. A GREEN source decision is not authority to run a writer.
export const GREEN='GREEN', YELLOW='YELLOW', RED='RED';
export function canonicalPayload(value) {
  if(Array.isArray(value)) return value.map(canonicalPayload);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).filter(k=>k!=='sourceKey').sort().map(k=>[k,canonicalPayload(value[k])]));
  return typeof value==='number'?String(value):value;
}
export const payloadHash=value=>hash(canonicalPayload(value));
export function compareCaptureRows(before,after,key) {
  const index=rows=>{const result=new Map();for(const row of rows){const id=key(row);requireRule(!result.has(id),'DUPLICATE_SOURCE_IDENTITY');result.set(id,row);}return result;};
  const old=index(before),current=index(after),records=[];
  for(const [sourceIdentity,row] of current){const prior=old.get(sourceIdentity);old.delete(sourceIdentity);const beforeHash=prior?payloadHash(prior):null,afterHash=payloadHash(row);
    const changedFields=prior?[...new Set([...Object.keys(prior),...Object.keys(row)])].filter(k=>k!=='sourceKey'&&hash([Object.hasOwn(prior,k),canonicalPayload(prior[k]??null)])!==hash([Object.hasOwn(row,k),canonicalPayload(row[k]??null)])):Object.keys(row).filter(k=>k!=='sourceKey');
    records.push({sourceIdentity,change:!prior?'NEW':beforeHash===afterHash?'UNCHANGED':'CHANGED',beforeHash,afterHash,changedFields,before:prior??null,after:row});
  }
  for(const [sourceIdentity,row] of old) records.push({sourceIdentity,change:'MISSING',beforeHash:payloadHash(row),afterHash:null,changedFields:[],before:row,after:null});
  return records;
}
export function exactSign(value) {const v=decimal(value);return v===null?null:BigInt(v.replace('.',''))<0n?-1:BigInt(v.replace('.',''))>0n?1:0;}
// value is source BORC-minus-ALACAK / historical rate, never supplier-native sign.
export function sourceAccountDirection(role,value,signProven) {
  requireRule(['customer','supplier'].includes(role),'PARTY_ROLE_REQUIRED');
  if(!signProven||value===null) return 'Yön doğrulanmadı';
  const sign=exactSign(value);
  return sign===0?'Bakiye sıfır':role==='customer'?(sign>0?'Müşteri bize borçlu':'Müşteriye borçluyuz'):(sign<0?'Tedarikçiye borçluyuz':'Tedarikçi bize borçlu');
}
export function classifySourceRecord({entity,record,facts={}}) {
  const red=[],yellow=[],notes=[];const block=(condition,reason,list=red)=>{if(condition)list.push(reason);};
  block(!record,'SOURCE_RECORD_MISSING');
  block(!['product','party'].includes(entity),'UNKNOWN_ENTITY');
  block(facts.sourceIdentityVerified!==true,'SOURCE_IDENTITY_NOT_VERIFIED');
  block(facts.sourceCodeOwners!==1,'SOURCE_CODE_NOT_UNIQUE');
  block(facts.nativeOwners>1,'MULTIPLE_NATIVE_TARGETS');
  block(facts.nativeOwners!==1&&!(facts.nativeOwners===0&&facts.nativeCreationChecked===true),'NATIVE_OWNER_OR_CREATION_NOT_VERIFIED');
  block(facts.nativeWrongOwner===true,'WRONG_NATIVE_OWNER');
  block(facts.nativeBeforeImageVerified!==true,'NATIVE_BEFORE_IMAGE_NOT_VERIFIED');
  block(facts.hold===true,'EXISTING_OPERATION_QUARANTINE',yellow);
  block(facts.specialCard===true,'SPECIAL_CARD_MEANING_UNDETERMINED',yellow);
  if(record)block(typeof record.isActive!=='boolean','UNKNOWN_SOURCE_ACTIVE_STATUS',yellow);
  try { if(record&&entity==='product') {
    block(record.quantity===null,'UNKNOWN_SOURCE_QUANTITY',yellow);
    block(record.quantity!==null&&exactSign(record.quantity)<0,'NEGATIVE_SOURCE_QUANTITY');
    try{decimal(record.quantity,3);}catch{red.push('SOURCE_QUANTITY_NOT_REPRESENTABLE');}
    block(record.unitStatus!=='VERIFIED_ADET_FACTOR_1','UNVERIFIED_UNIT_OR_FACTOR',yellow);
    block(facts.barcodeMultipleOwners===true,'SOURCE_BARCODE_MULTIPLE_OWNERS',yellow);
    block(facts.barcodeWrongOwner===true,'WRONG_TARGET_BARCODE_OWNER');
    block((record.prices??[]).some(p=>(p.price!==null||p.currencyRaw!==null&&p.currencyRaw!==undefined&&String(p.currencyRaw).trim()!=='')&&exactSign(p.price)!==0&&(!['TRY','USD','EUR'].includes(p.currency)||p.price===null)),'UNKNOWN_SALES_PRICE_OR_CURRENCY',yellow);
    block((record.prices??[]).some(p=>exactSign(p.price)<0),'NEGATIVE_SALES_PRICE');
    const purchase=record.purchasePrice;
    block(purchase&&!['TRY','USD','EUR'].includes(purchase.currency)&&[purchase.price,purchase.local,purchase.foreign].some(v=>v!==null&&v!==undefined&&exactSign(v)!==0),'UNKNOWN_PURCHASE_PRICE_CURRENCY',yellow);
    block(purchase&&[purchase.price,purchase.local,purchase.foreign].some(v=>v!==null&&v!==undefined&&exactSign(v)<0),'NEGATIVE_PURCHASE_PRICE');
    if(record.averageCostTry===null)notes.push('COST_REMAINS_NULL_NO_PRICE_FALLBACK');
    block(facts.localCostConflict===true,'SOURCE_COST_VS_LOCAL_PURCHASE_REQUIRES_POLICY',yellow);
  }else if(record) {
    block(!['customer','supplier'].includes(record.role),'UNKNOWN_PARTY_ROLE');
    block(record.company!==(record.role==='customer'?'F0102':'F0103'),'PARTY_COMPANY_ROLE_CONFLICT');
    block(!['TRY','USD','EUR'].includes(record.currency),'UNKNOWN_MAIN_ACCOUNT_CURRENCY',yellow);
    block(record.nativeBalanceMapped===null,'UNKNOWN_MAIN_ACCOUNT_BALANCE',yellow);
    block((record.accounts??[]).some(a=>!['TRY','USD','EUR'].includes(a.currency)||a.nativeBalanceMapped===null),'UNKNOWN_FX_ACCOUNT_OR_BALANCE',yellow);
    const knownAccounts=(record.accounts??[]).filter(a=>['TRY','USD','EUR'].includes(a.currency));
    block(new Set(knownAccounts.map(a=>a.currency)).size!==knownAccounts.length,'DUPLICATE_ACCOUNT_CURRENCY');
    for(const a of record.accounts??[])decimal(a.nativeBalanceMapped);
    decimal(record.nativeBalanceMapped);
    block(facts.signProven!==true,'SOURCE_SIGN_DIRECTION_NOT_PROVEN',yellow);
    block(facts.cardFxConsistent!==true,'CARD_VS_FX_RELATION_UNPROVEN_OR_MISMATCH',yellow);
    block(facts.accountOwnershipVerified!==true,'FX_ACCOUNT_TARGET_NOT_VERIFIED',yellow);
  } }catch(error){if(/DECIMAL|EXACT_DECIMAL_STRING/.test(error.message))red.push('INVALID_SOURCE_DECIMAL');else throw error;}
  block(facts.localMovementsReconciled!==true,'LOCAL_NATIVE_EFFECTS_NOT_RECONCILED',yellow);
  const reasons=[...new Set([...red,...yellow])];
  return {classification:red.length?RED:yellow.length?YELLOW:GREEN,reasons,notes,sourcePayloadHash:record?payloadHash(record):null,
    applyReady:red.length===0&&yellow.length===0&&facts.readerVersionReady===true,
    applicationBlockers:red.length||yellow.length?['SOURCE_DECISION_REQUIRED']:facts.readerVersionReady===true?[]:['IMMUTABLE_DELTA_READER_VERSION_REQUIRED']};
}
export function classifyStockEffect({record,facts={}}) {
  const isolated=record?{...record,prices:[],purchasePrice:null,averageCostTry:null}:record;
  const result=classifySourceRecord({entity:'product',record:isolated,facts:{...facts,localCostConflict:false}});
  if(facts.nativeOwners!==1)return {...result,classification:RED,reasons:[...new Set([...result.reasons,'STOCK_EFFECT_EXISTING_NATIVE_OWNER_REQUIRED'])],applyReady:false};
  return {...result,scope:'STOCK_QUANTITY_ONLY',excludedFields:['cost','prices','purchasePrice','brand','category','name','stockCode','status','barcodes'],notes:result.notes.filter(n=>n!=='COST_REMAINS_NULL_NO_PRICE_FALLBACK')};
}
export function preserveLocalEffects(sourceBase,localEffects) {requireRule(sourceBase!==null,'UNKNOWN_NOT_ZERO');return sumDecimals([sourceBase,...localEffects]);}
export function validateCaptureIdentity(manifest,expectedHash,actualHash) {
  requireRule(expectedHash===actualHash,'SOURCE_CAPTURE_HASH_CHANGED');
  requireRule(manifest.sourceSELECTOnly===true&&manifest.twoPassStable===true,'STABLE_SELECT_CAPTURE_REQUIRED');
  requireRule(manifest.source?.server==='DESKTOP-KSRK0EQ'&&manifest.source?.database==='VEGA2026','WRONG_SOURCE_DATABASE');
}
