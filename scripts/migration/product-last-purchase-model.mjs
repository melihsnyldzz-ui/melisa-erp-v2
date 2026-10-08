// V2 selection overlays the immutable V1 card evidence. No native cost writer.
import {decimal} from './mapping-opening.mjs';
import {TARGET,check,hash,sqlHash,currency} from './product-purchase-reference-model.mjs';
export {TARGET,check,hash,sqlHash};
export const SCHEMA='melisa-product-last-purchase.v2';
export const APPROVAL='ERP-DEC-029';
export const SELECTION_REASONS=Object.freeze(['LATEST_VERIFIED_PURCHASE_DOCUMENT','LATEST_VERIFIED_COMMERCIAL_ENTRY','OLDER_VERIFIED_WITH_NEWER_AMBIGUITY','CARD_FALLBACK_NO_VERIFIED_NET_SOURCE','NO_VERIFIED_SOURCE','MANUAL_PURCHASE_PROTECTED']);
const integer=v=>/^\d+$/.test(String(v));
const units=v=>{const d=decimal(v);check(d!==null,'LAST_PURCHASE_DECIMAL_REQUIRED');return BigInt(d.replace('.',''));};
const gcd=(a,b)=>{while(b){[a,b]=[b,a%b];}return a;};
export function rationalUnit(amount,quantity){
 const n=units(amount),d=units(quantity);check(n>0n&&d>0n,'LAST_PURCHASE_POSITIVE_AMOUNT_QUANTITY');
 const g=gcd(n,d),numerator=n/g,denominator=d/g,scale=10n**18n,q=numerator*scale/denominator;
 check(q>0n&&String(q/scale).length<=20,'LAST_PURCHASE_DECIMAL_OVERFLOW');
 return {referenceExact:`${q/scale}.${String(q%scale).padStart(18,'0')}`,referenceNumerator:String(numerator),referenceDenominator:String(denominator),precisionStatus:numerator*scale%denominator===0n?'EXACT':'TRUNCATED_18'};
}
const safeAmount=v=>{try{return decimal(v);}catch{return null;}};
const equal=(a,b)=>safeAmount(a)!==null&&safeAmount(a)===safeAmount(b);
const positive=v=>{try{return units(v)>0n;}catch{return false;}};
const isZero=v=>safeAmount(v)==='0.00000000';
function linkValid(c,source,uniqueCodes){
 const raw=c.raw?.sourceRow??{},full=String(source.stockCode??'');
 if(uniqueCodes.get(full)!==1)return false;
 if(c.linkBasis==='EXACT_UNIQUE_STOCK_CODE'){
  const candidate=raw.stockCode;
  return candidate===full&&!['URUN','ÜRÜN','KDV','KUTU','YASTIK',''].includes(String(candidate).toUpperCase());
 }
 if(c.linkBasis==='EXACT_UNIQUE_MODEL_PLUS_SUPPLIER_CODE_AND_EXACT_BRAND')return typeof raw.model==='string'&&typeof raw.supplierCode==='string'&&raw.model+' '+raw.supplierCode===full&&source.brand===raw.supplierCode;
 if(c.linkBasis==='EXACT_COUNTERPART_CODE_AND_UNIQUE_BARCODE')return raw.counterpartCode===full&&typeof raw.counterpartBarcode==='string'&&source.barcodes?.includes(raw.counterpartBarcode)&&raw.barcodeProductMatches===1;
 return false;
}
export function validateCandidate(c,{source,parent,uniqueCodes,sourceAsOf}){
 const reasons=[...(c.reasons??[])];const raw=c.raw?.sourceRow??{};
 if(source.canceled===true||source.canceled===1||source.deleted===true||source.deleted===1)reasons.push('SOURCE_PRODUCT_INACTIVE');
 if(!['PURCHASE_DOCUMENT','COMMERCIAL_ENTRY'].includes(c.kind)||String(c.productSourceId)!==parent.sourceId||!/^VEGA2026\/F010[23]\/D000[1-7]\/[A-Z0-9_]+\/[1-9]\d*$/.test(c.sourceKey??''))reasons.push('SOURCE_IDENTITY_UNVERIFIED');
 if(!linkValid(c,source,uniqueCodes))reasons.push('PRODUCT_LINK_UNVERIFIED');
 if(!Number.isFinite(Date.parse(c.date))||Date.parse(c.date)>Date.parse(sourceAsOf)||c.date!==raw.date)reasons.push('SOURCE_DATE_UNVERIFIED');
 if(raw.canceled!==0&&raw.canceled!==false||raw.returnFlag!==0&&raw.returnFlag!==false||raw.deleted===1)reasons.push('CANCELED_RETURN_OR_UNKNOWN_STATE');
 if(c.unit!==parent.unitLabel||c.unit!==source.unit||safeAmount(c.unitFactor)!=='1.00000000'||source.unitFactor!=='1.00000000')reasons.push('UNIT_UNVERIFIED');
 if(!['TRY','USD','EUR'].includes(c.currency)||currency(raw.lineCurrencyRaw)!==c.currency)reasons.push('CURRENCY_UNVERIFIED');
 const w=c.raw?.netWitness??{};
 if(c.kind==='PURCHASE_DOCUMENT'){
  if(Number(raw.documentType)!==20)reasons.push('NOT_PURCHASE_DOCUMENT');
  if(w.rule!=='EXPLICIT_LINE_TL_AND_LINE_RATE_ONE;NET_STORED_LINE_DIV_POSITIVE_QTY;ZERO_VAT_RATE_AND_ZERO_FEE;EXACT_HEADER_SUM_POSTED;NULL_TAX_AMOUNTS_NOT_ZERO_ASSUMED;NO_HEADER_FX_CONVERSION'||String(w.postedCount)!=='1'||!positive(w.postedCredit)||!equal(w.headerTotal,w.headerLineSum)||!equal(w.headerTotal,w.postedCredit)||!equal(w.headerTotal,raw.headerTotalTry)||!equal(w.headerLineSum,raw.headerLineSumTry)||!equal(w.postedCredit,raw.postedCreditTry)||String(raw.postedCount)!=='1'||!isZero(raw.vatRate)||!isZero(raw.extraCharge)||!equal(raw.lineExchangeRate,'1')||!equal(raw.multiplier,'1')||!equal(raw.seriesMultiplier,'1')||c.currency!=='TRY')reasons.push('DOCUMENT_NET_UNVERIFIED');
 }else if(w.kind!=='VERIFIED_COMMERCIAL_ENTRY'||w.tradeKind!=='PURCHASE'||!w.headerLinkVerified||!w.netFieldVerified||w.duplicatesDocument===true||raw.opening===true||raw.transfer===true||raw.count===true||raw.sale===true)reasons.push('ENTRY_NET_UNVERIFIED');
 if(!['NET_LINE_DIV_QTY','ALREADY_NET_UNIT'].includes(c.netBasis))reasons.push('NET_BASIS_UNVERIFIED');
 let arithmetic=null;
 try{arithmetic=rationalUnit(c.netBasis==='ALREADY_NET_UNIT'?c.netUnitAmount:c.netLineAmount,c.netBasis==='ALREADY_NET_UNIT'?'1':c.quantity);}catch{reasons.push('NET_AMOUNT_OR_QUANTITY_UNVERIFIED');}
 if(c.netBasis==='NET_LINE_DIV_QTY'&&(!equal(c.netLineAmount,raw.netLineTotalTry)||!equal(c.quantity,raw.quantity)))reasons.push('NET_INPUT_DRIFT');
 if(c.netBasis==='ALREADY_NET_UNIT'&&!equal(c.netUnitAmount,raw.netUnitAmount))reasons.push('NET_INPUT_DRIFT');
 const rowHash=hash(raw);if(c.sourceRowHash!==rowHash||c.linkWitnessHash!==hash(c.raw?.linkWitness)||c.netWitnessHash!==hash(w))reasons.push('SOURCE_WITNESS_DRIFT');
 return {...c,valid:reasons.length===0,reasons:[...new Set([...(c.reasons??[]),...reasons])],arithmetic};
}
function chooseLatest(candidates){
 const day=c=>typeof c.date==='string'?c.date.slice(0,10):'';
 const valid=candidates.filter(c=>c.valid),dates=[...new Set(valid.map(day))].sort((a,b)=>Date.parse(b)-Date.parse(a));let ambiguous=false;
 for(const date of dates){const at=valid.filter(c=>c.date.slice(0,10)===date),tuples=new Set(at.map(c=>`${c.arithmetic.referenceNumerator}/${c.arithmetic.referenceDenominator}|${c.currency}|${c.unit}`));
  if(tuples.size!==1){ambiguous=true;continue;}
  // Equivalent records can have a deterministic representative; IDs do not rank costs.
  const selected=[...at].sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey))[0];
  return {selected,ambiguous:ambiguous||candidates.some(c=>!c.valid&&day(c)>=date)};
 }return {selected:null,ambiguous:ambiguous||candidates.some(c=>!c.valid)};
}
export function selectLastPurchase({parent,parentRecordHash,source,candidates,uniqueCodes,sourceAsOf}){
 const classified=candidates.map(c=>validateCandidate(c,{source,parent,uniqueCodes,sourceAsOf}));
 const documents=chooseLatest(classified.filter(c=>c.kind==='PURCHASE_DOCUMENT'));
 const reflected=new Set(classified.filter(c=>c.kind==='PURCHASE_DOCUMENT'&&c.valid&&c.reflectionKey).map(c=>c.reflectionKey));
 const entries=chooseLatest(classified.filter(c=>c.kind==='COMMERCIAL_ENTRY'&&(!c.reflectionKey||!reflected.has(c.reflectionKey))));
 let picked=documents.selected??entries.selected,sourceKind=picked?.kind??(parent.cardAmountExact!==null?'CARD':'UNKNOWN');
 const protectedManual=parent.protectedManual===true;if(protectedManual){picked=null;sourceKind='UNKNOWN';}
 const ambiguous=picked?.kind==='PURCHASE_DOCUMENT'?documents.ambiguous:documents.ambiguous||entries.ambiguous;
 const selectionReason=protectedManual?'MANUAL_PURCHASE_PROTECTED':picked?ambiguous?'OLDER_VERIFIED_WITH_NEWER_AMBIGUITY':picked.kind==='PURCHASE_DOCUMENT'?'LATEST_VERIFIED_PURCHASE_DOCUMENT':'LATEST_VERIFIED_COMMERCIAL_ENTRY':sourceKind==='CARD'?'CARD_FALLBACK_NO_VERIFIED_NET_SOURCE':'NO_VERIFIED_SOURCE';
 const reasons=[...new Set(classified.filter(c=>!c.valid).flatMap(c=>c.reasons))];if(ambiguous)reasons.push('NEWER_OR_SAME_DAY_SOURCE_AMBIGUOUS');
 const alternatives=[documents.selected,entries.selected].filter(c=>c&&c!==picked).map(c=>({sourceKind:c.kind,amountExact:c.arithmetic.referenceExact,currency:c.currency,unitLabel:c.unit,date:c.date,reason:'LOWER_PRIORITY_VERIFIED_SOURCE'}));
 if(picked&&parent.cardAmountExact!==null)alternatives.push({sourceKind:'CARD',amountExact:parent.cardAmountExact,currency:parent.currency,unitLabel:parent.unitLabel,date:null,reason:'PRESERVED_CARD_VALUE'});
 return {schemaVersion:SCHEMA,productId:parent.productId,sourceId:parent.sourceId,stockCode:parent.stockCode,nativeKey:parent.nativeKey,bindingKind:parent.bindingKind,bindingRun:parent.bindingRun,bindingHash:parent.bindingHash,productHash:parent.productHash,parentRecordHash,sourceAsOf,sourceKind,selectionReason,status:protectedManual?'PROTECTED_MANUAL':picked?'NET_REFERENCE':sourceKind==='CARD'?parent.currency&&parent.unitLabel?'CARD_ONLY':'PARTIAL_CARD':'PURCHASE_UNKNOWN',referenceExact:picked?.arithmetic.referenceExact??null,referenceNumerator:picked?.arithmetic.referenceNumerator??null,referenceDenominator:picked?.arithmetic.referenceDenominator??null,precisionStatus:picked?.arithmetic.precisionStatus??null,referenceCurrency:picked?.currency??null,referenceUnitLabel:picked?.unit??null,referenceDate:picked?.date??null,protectedManual,protectedExistingCost:parent.protectedExistingCost,alternatives:alternatives.slice(0,3),reasons,selection:picked?{sourceKey:picked.sourceKey,reflectionKey:picked.reflectionKey??null,linkBasis:picked.linkBasis,netBasis:picked.netBasis,sourceRowHash:picked.sourceRowHash,linkWitnessHash:picked.linkWitnessHash,netWitnessHash:picked.netWitnessHash,raw:picked.raw,netLineAmount:picked.netLineAmount??null,quantity:picked.quantity??null,netUnitAmount:picked.netUnitAmount??null}:null,candidateEvidence:classified.map(c=>({sourceKey:c.sourceKey,date:c.date,kind:c.kind,valid:c.valid,reasons:c.reasons,sourceRowHash:c.sourceRowHash})),accountingCost:false,financialWrites:0};
}
export function summarizeLastPurchase(rows,excluded=[]){return {metadataRows:rows.length,netReferenceFilled:rows.filter(r=>r.referenceExact!==null).length,sourceCounts:Object.fromEntries(['PURCHASE_DOCUMENT','COMMERCIAL_ENTRY','CARD','UNKNOWN'].map(k=>[k,rows.filter(r=>r.sourceKind===k).length])),statusCounts:Object.fromEntries([...new Set(rows.map(r=>r.status))].map(k=>[k,rows.filter(r=>r.status===k).length])),netMissing:rows.filter(r=>r.referenceExact===null).length,newerAmbiguity:rows.filter(r=>r.reasons.includes('NEWER_OR_SAME_DAY_SOURCE_AMBIGUOUS')).length,protectedCosts:rows.filter(r=>r.protectedExistingCost).length,protectedManual:rows.filter(r=>r.protectedManual).length,excluded:excluded.length,reasonCounts:Object.fromEntries([...new Set(rows.flatMap(r=>r.reasons))].map(k=>[k,rows.filter(r=>r.reasons.includes(k)).length])),financialWrites:0,costWrites:0,stockWrites:0,salesPriceWrites:0};}
export function validateLastPurchasePlan(plan){const {manifestHash,...body}=plan;check(hash(body)===manifestHash&&plan.schemaVersion===SCHEMA&&plan.approval===APPROVAL&&plan.target.server===TARGET.server&&plan.target.database===TARGET.database,'LAST_PURCHASE_PLAN_HASH');check(plan.backup?.verified===true&&/^[a-f0-9]{64}$/.test(plan.backup.sha256??'')&&/^[a-f0-9-]{36}$/.test(plan.backup.backupSetUuid??''),'LAST_PURCHASE_VERIFIED_BACKUP_REQUIRED');check(/^[a-f0-9]{64}$/.test(plan.parentManifestHash??'')&&/^[a-f0-9]{64}$/.test(plan.parentRowsHash??'')&&/^ERP-MIGUNIFIED01-NET-[A-Za-z0-9-]+$/.test(plan.runId),'LAST_PURCHASE_PARENT_REQUIRED');check(plan.financialWrites===0&&plan.costWrites===0&&plan.stockWrites===0&&plan.salesPriceWrites===0&&plan.rows.length>0,'LAST_PURCHASE_METADATA_ONLY');check(new Set(plan.rows.map(r=>r.productId)).size===plan.rows.length,'LAST_PURCHASE_DUPLICATE_PRODUCTS');for(const r of plan.rows){check(r.schemaVersion===SCHEMA&&integer(r.productId)&&integer(r.sourceId)&&/^[a-f0-9]{64}$/.test(r.parentRecordHash)&&r.accountingCost===false&&r.financialWrites===0&&SELECTION_REASONS.includes(r.selectionReason),'LAST_PURCHASE_ROW');if(r.referenceExact!==null){check(r.sourceKind==='PURCHASE_DOCUMENT'||r.sourceKind==='COMMERCIAL_ENTRY','LAST_PURCHASE_SOURCE_REQUIRED');check(r.referenceCurrency&&r.referenceUnitLabel&&Number.isFinite(Date.parse(r.referenceDate))&&positive(r.selection.netLineAmount??r.selection.netUnitAmount),'LAST_PURCHASE_NET_REQUIRED');const derived=rationalUnit(r.selection.netBasis==='ALREADY_NET_UNIT'?r.selection.netUnitAmount:r.selection.netLineAmount,r.selection.netBasis==='ALREADY_NET_UNIT'?'1':r.selection.quantity);check(Object.entries(derived).every(([k,v])=>r[k]===v),'LAST_PURCHASE_ARITHMETIC_DRIFT');check(hash(r.selection.raw.sourceRow)===r.selection.sourceRowHash&&hash(r.selection.raw.netWitness)===r.selection.netWitnessHash&&hash(r.selection.raw.linkWitness)===r.selection.linkWitnessHash,'LAST_PURCHASE_EVIDENCE_DRIFT');}check(!r.protectedManual||r.referenceExact===null,'LAST_PURCHASE_MANUAL_OVERWRITE');}return plan;}
