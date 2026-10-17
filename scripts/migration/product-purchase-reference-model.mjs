// Purchase card evidence only. Native prices, costs, quantities and history stay intact.
import {createHash} from 'node:crypto';
import {decimal,TARGET} from './mapping-opening.mjs';
export {TARGET};
export const SCHEMA='melisa-product-purchase-reference.v1';
export const APPROVAL='ERP-DEC-028';
export const check=(v,c)=>{if(!v)throw Error(c);};
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const sqlHash=v=>createHash('sha256').update(v,'utf16le').digest('hex');
const id=v=>/^[1-9]\d*$/.test(String(v));
export const currency=v=>({TL:'TRY',TRY:'TRY','₺':'TRY','$':'USD',USD:'USD','€':'EUR',EUR:'EUR'}[String(v??'').trim().toUpperCase()]??null);
const amount=v=>{try{return decimal(v);}catch{return null;}};
const fixed=(n,scale)=>`${n<0n?'-':''}${(n<0n?-n:n)/10n**BigInt(scale)}.${String((n<0n?-n:n)%10n**BigInt(scale)).padStart(scale,'0')}`;
export function discountedExact(price,discount){
 const p=decimal(price),d=decimal(discount);check(p!==null&&d!==null,'DECIMAL_REQUIRED');
 const pi=BigInt(p.replace('.','')),di=BigInt(d.replace('.',''));check(pi>=0n&&di>=0n&&di<=10000000000n,'INVALID_PURCHASE_DISCOUNT');
 // 28,8 amount * 28,8 percent /100. Keep all18 fraction digits; never round.
 const n=pi*(10000000000n-di);check(String(n).length<=38,'REFERENCE_DECIMAL_OVERFLOW');return fixed(n,18);
}
export function classifyPurchase({source,units,binding,target,sourceAsOf,priceBasis='UNKNOWN',basisWitnessHash=null,zeroWitnessHash=null}){
 check(source&&binding&&target&&id(target.productId)&&id(source.sourceId),'REFERENCE_INPUT');
 const productId=String(target.productId),sourceId=String(source.sourceId),reasons=[];
 if(target.held===1||target.held===true)return {productId,sourceId,excluded:'HELD_PRODUCT'};
 if(String(binding.source_id)!==sourceId||binding.stock_code!==source.stockCode||target.stockCode!==source.stockCode||binding.native_source_key!==target.nativeKey||Number(target.aliasCount)!==1||String(target.aliasSourceId)!==sourceId)return {productId,sourceId,excluded:'IDENTITY_BINDING_DRIFT'};
 check(['OPENING','GOAL7'].includes(binding.bindingKind)&&/^[a-fA-F0-9]{64}$/.test(binding.binding_hash)&&/^[a-fA-F0-9]{64}$/.test(target.productHash),'BINDING_WITNESS');
 check(['UNKNOWN','GROSS','NET'].includes(priceBasis),'PRICE_BASIS');
 check(priceBasis==='UNKNOWN'||/^[a-f0-9]{64}$/.test(basisWitnessHash??''),'PRICE_BASIS_WITNESS_REQUIRED');
 const c=currency(source.currencyRaw);if(c===null)reasons.push('CURRENCY_UNKNOWN');
 const sourceField=c==='TRY'?'ALISFIYATI':'DALISFIYATI';
 let cardAmount=amount(c==='TRY'?source.purchaseLocal:source.purchaseForeign);
 if(cardAmount===null)reasons.push('PURCHASE_AMOUNT_UNKNOWN_OR_INVALID');
 else if(BigInt(cardAmount.replace('.',''))<0n){cardAmount=null;reasons.push('NEGATIVE_PURCHASE_PRICE');}
 else if(BigInt(cardAmount.replace('.',''))===0n&&!/^[a-f0-9]{64}$/.test(zeroWitnessHash??'')){cardAmount=null;reasons.push('UNEXPLAINED_ZERO_PURCHASE');}
 const matches=units.filter(u=>String(u.unitSourceId)===String(source.mainUnitId)&&String(u.sourceId)===sourceId);
 const u=matches.length===1?matches[0]:null;
 const unitVerified=u&&String(binding.main_unit_source_id)===String(u.unitSourceId)&&u.unit===binding.unit&&u.unit===target.unit&&amount(u.factor)==='1.00000000';
 if(!unitVerified)reasons.push('UNIT_UNVERIFIED');
 const discount=amount(source.discountRaw),validDiscount=discount!==null&&BigInt(discount.replace('.',''))>=0n&&BigInt(discount.replace('.',''))<=10000000000n;
 if(source.discountRaw===null||source.discountRaw===undefined||source.discountRaw==='')reasons.push('DISCOUNT_UNKNOWN');else if(!validDiscount)reasons.push('DISCOUNT_INVALID');
 if(priceBasis==='UNKNOWN')reasons.push('DISCOUNT_BASIS_UNVERIFIED');
 let reference=null,method='SOURCE_CARD_AMOUNT';
 if(cardAmount!==null&&c!==null&&unitVerified){
  if(priceBasis==='NET'){reference=cardAmount;method='SOURCE_ALREADY_NET_NO_SECOND_DISCOUNT';}
  else if(priceBasis==='GROSS'&&validDiscount){reference=discountedExact(cardAmount,discount);method='GROSS_CARD_LESS_RECORDED_DISCOUNT_ONCE';}
 }
 const protectedExistingCost=target.nativeCost!==null&&target.nativeCost!==undefined;
 const protectedManual=target.manualPurchaseProtected===true;
 if(protectedManual){cardAmount=null;reference=null;reasons.push('MANUAL_PURCHASE_PROTECTED');method='PRESERVE_MANUAL_PURCHASE';}
 const status=protectedManual?'PROTECTED_MANUAL_PURCHASE':reference!==null?'REFERENCE_AVAILABLE':cardAmount!==null&&c!==null&&unitVerified?'CARD_AMOUNT_ONLY':cardAmount!==null?'PARTIAL_CARD_AMOUNT':'PURCHASE_UNKNOWN';
 return {schemaVersion:SCHEMA,productId,sourceId,stockCode:source.stockCode,nativeKey:target.nativeKey,bindingKind:binding.bindingKind,bindingRun:binding.bindingRun,bindingHash:binding.binding_hash.toLowerCase(),productHash:target.productHash.toLowerCase(),sourceHash:hash({card:source,units:units.filter(x=>String(x.sourceId)===sourceId)}),sourceAsOf,cardAmountExact:cardAmount,referenceExact:reference,discountExact:validDiscount?discount:null,currency:c,unitId:unitVerified?String(u.unitSourceId):null,unitLabel:unitVerified?u.unit:null,priceBasis,basisWitnessHash,zeroWitnessHash,protectedExistingCost,protectedManual,status,method,reasons,rawSource:{card:source,units:units.filter(x=>String(x.sourceId)===sourceId)},accountingCost:false,financialWrites:0};
}
export function planPurchaseReferences({capture,bindings,products,runId,backup,protectedBefore,moduleBefore,priceBasisBySource={}}){
 check(capture.twoPassStable===true&&hash(capture.cards)===capture.cardsHash&&hash(capture.units)===capture.unitsHash,'SOURCE_CAPTURE_HASH');
 check(capture.identity.server==='DESKTOP-KSRK0EQ'&&capture.identity.database==='VEGA2026'&&Object.values(capture.permissions).every(x=>x===0),'SOURCE_READONLY_IDENTITY');
 check(Number.isFinite(Date.parse(capture.startedAt))&&Date.parse(capture.endedAt)>=Date.parse(capture.startedAt)&&Date.parse(capture.endedAt)-Date.parse(capture.startedAt)<=120000,'SOURCE_CAPTURE_INTERVAL');
 check(/^ERP-MIGUNIFIED01-PURCHASE-[A-Za-z0-9-]+$/.test(runId),'REFERENCE_RUN_ID');
 const sources=new Map(capture.cards.map(s=>[String(s.sourceId),s])),targets=new Map(products.map(s=>[String(s.productId),s]));
 check(sources.size===capture.cards.length&&targets.size===products.length&&new Set(bindings.map(b=>String(b.product_id))).size===bindings.length,'DUPLICATE_REFERENCE_IDENTITY');
 const unitGroups=new Map();for(const u of capture.units){const k=String(u.sourceId);if(!unitGroups.has(k))unitGroups.set(k,[]);unitGroups.get(k).push(u);}
 const rows=[],excluded=[];for(const b of bindings){const source=sources.get(String(b.source_id)),target=targets.get(String(b.product_id));if(!source||!target){excluded.push({productId:String(b.product_id),excluded:'SOURCE_OR_TARGET_ABSENT'});continue;}
 const row=classifyPurchase({source,units:unitGroups.get(String(b.source_id))??[],binding:b,target,sourceAsOf:capture.endedAt,...(priceBasisBySource[String(b.source_id)]??{})});(row.excluded?excluded:rows).push(row);}
 rows.sort((a,b)=>BigInt(a.productId)<BigInt(b.productId)?-1:1);
 const body={schemaVersion:SCHEMA,approval:APPROVAL,runId,target:TARGET,sourceHash:hash({cards:capture.cardsHash,units:capture.unitsHash}),sourceAsOf:capture.endedAt,rows,excluded,backup,protectedBefore,moduleBefore,financialWrites:0,stockWrites:0,salesPriceWrites:0,costWrites:0};
 return {...body,manifestHash:hash(body)};
}
export function validatePlan(plan){
 const {manifestHash,...body}=plan;check(hash(body)===manifestHash&&plan.schemaVersion===SCHEMA&&plan.approval===APPROVAL&&plan.target.server===TARGET.server&&plan.target.database===TARGET.database,'REFERENCE_PLAN_HASH');
 check(plan.financialWrites===0&&plan.stockWrites===0&&plan.salesPriceWrites===0&&plan.costWrites===0,'REFERENCE_METADATA_ONLY');
 check(Array.isArray(plan.rows)&&plan.rows.length>0&&new Set(plan.rows.map(x=>x.productId)).size===plan.rows.length,'REFERENCE_ROWS');
 check(plan.backup?.verified===true&&/^[a-f0-9]{64}$/.test(plan.backup.sha256??'')&&/^[a-f0-9-]{36}$/.test(plan.backup.backupSetUuid??''),'VERIFIED_BACKUP_REQUIRED');
 for(const row of plan.rows){check(row.schemaVersion===SCHEMA&&id(row.productId)&&id(row.sourceId)&&/^[a-f0-9]{64}$/.test(row.productHash)&&row.financialWrites===0&&row.accountingCost===false,'REFERENCE_ROW');check(hash(row.rawSource)===row.sourceHash,'REFERENCE_RAW_HASH');
  check(typeof row.protectedExistingCost==='boolean'&&typeof row.protectedManual==='boolean','REFERENCE_PROTECTION_FLAGS');
  const canonical=classifyPurchase({source:row.rawSource.card,units:row.rawSource.units,binding:{source_id:row.sourceId,stock_code:row.stockCode,native_source_key:row.nativeKey,main_unit_source_id:row.unitId,unit:row.unitLabel,bindingKind:row.bindingKind,bindingRun:row.bindingRun,binding_hash:row.bindingHash},target:{productId:row.productId,stockCode:row.stockCode,nativeKey:row.nativeKey,unit:row.unitLabel,aliasCount:1,aliasSourceId:row.sourceId,productHash:row.productHash,nativeCost:row.protectedExistingCost?'PROTECTED':null,manualPurchaseProtected:row.protectedManual,held:0},sourceAsOf:row.sourceAsOf,priceBasis:row.priceBasis,basisWitnessHash:row.basisWitnessHash,zeroWitnessHash:row.zeroWitnessHash});
  check(JSON.stringify(canonical)===JSON.stringify(row),'REFERENCE_DERIVED_ROW_DRIFT');
 }
 return plan;
}
export function replayDecision(existing,plan){validatePlan(plan);if(!existing)return'INSERT';check(existing.manifest_hash===plan.manifestHash,'REFERENCE_REPLAY_BODY_CHANGED');return'REPLAY_NOOP';}
export function summarize(plan){const counts={scope:plan.rows.length+plan.excluded.length,metadataRows:plan.rows.length,purchaseCardFilled:0,discountApplied:0,cardOnly:0,protectedExistingCosts:0,protectedManual:0,empty:0,excluded:plan.excluded.length};for(const r of plan.rows){if(r.cardAmountExact!==null)counts.purchaseCardFilled++;else counts.empty++;if(r.method==='GROSS_CARD_LESS_RECORDED_DISCOUNT_ONCE')counts.discountApplied++;if(r.status==='CARD_AMOUNT_ONLY')counts.cardOnly++;if(r.protectedExistingCost)counts.protectedExistingCosts++;if(r.protectedManual)counts.protectedManual++;}return{...counts,statusCounts:Object.fromEntries([...new Set(plan.rows.map(r=>r.status))].map(s=>[s,plan.rows.filter(r=>r.status===s).length])),reasonCounts:Object.fromEntries([...new Set(plan.rows.flatMap(r=>r.reasons))].map(s=>[s,plan.rows.filter(r=>r.reasons.includes(s)).length])),exclusionCounts:Object.fromEntries([...new Set(plan.excluded.map(r=>r.excluded))].map(s=>[s,plan.excluded.filter(r=>r.excluded===s).length])),financialWrites:0,stockWrites:0,salesPriceWrites:0,costWrites:0};}
