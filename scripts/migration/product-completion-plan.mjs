// Dated TEST snapshot planning only. Importing performs no I/O.
import {digest,sqlJsonHash,TARGET} from './goal7-test-delta.mjs';
import {decimal,roundDecimal,sumDecimals,requireRule as check} from './mapping-opening.mjs';
import {sourceTypedPrices} from './goal7-source-version.mjs';
export const PRODUCT_COMPLETION_SCHEMA='melisa-product-completion-plan.v1';
export const validId=v=>typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v);
export const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
export const sourceNativeKey=p=>`VEGA2026/F0102TBLSTOKLAR/${p.sourceId}`;
export const priceTuple=p=>JSON.stringify([p.price_type??p.type,String(p.source_unit_id??p.unitSourceId??''),Number(p.price_tier??p.tier),p.currency_code??p.currency]);
export const barcodeComparisonKey=b=>b.trimEnd().toLocaleUpperCase('tr-TR');
const exactQty=v=>decimal(v,3);
const subtraction=(a,b)=>sumDecimals([a,decimal(b).startsWith('-')?decimal(b).slice(1):'-'+decimal(b)]);
const masterMap={stockCode:'stock_code',name:'name',brand:'brand',category:'category',isActive:'is_active'};
// New cards may carry a verified source discount, independently of an unknown
// purchase price. No existing purchase metadata is updated by this planner.
export function newCardPurchaseDiscount(source){
 const value=source.purchasePrice?.discountRate;
 let rate;try{rate=decimal(value,4);}catch(error){check(false,error.message==='DECIMAL_PRECISION_LOSS'?'PRODUCT_NEW_DISCOUNT_PRECISION_UNSUPPORTED':'PRODUCT_NEW_DISCOUNT_INVALID');}
 if(rate!==null){const scaled=BigInt(rate.replace('.',''));check(scaled>=0n&&scaled<=1000000n,'PRODUCT_NEW_DISCOUNT_OUT_OF_RANGE');}
 return rate;
}
export function productCompletionContext({runId,sourceAsOf,sourceHash,planHash,previousVersion,productCount,priceCount,bindingsHash=null}){
 check(/^PRODUCT-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(runId),'PRODUCT_RUN_UUID');
 check(/^20\d{2}-\d{2}-\d{2}$/.test(sourceAsOf)&&hex(sourceHash)&&hex(planHash)&&previousVersion?.context&&Number.isInteger(productCount)&&productCount>0&&Number.isInteger(priceCount)&&priceCount>=0,'PRODUCT_CONTEXT');
 const suffix=runId.replaceAll('-','_').toLowerCase();
 return {schemaVersion:'melisa-product-completion-catalog-context.v1',evidenceKind:'DATED_TEST_PRODUCT_SCOPE',runId,sourceAsOf,sourceHash,snapshotHash:sourceHash,planHash,bindingsHash,productCount,priceCount,actualT1:false,previousSourceVersion:previousVersion.context,previousVersionHash:digest(previousVersion),
  ancestry:[{runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'},{runId:'GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d',sourceAsOf:'2026-10-07'},{runId,sourceAsOf}],
  procedures:{catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`}};
}
export function verifyProductStockProof(p,e){
 const proof=e.stockProof;check(proof&&Array.isArray(proof.acceptedSourceEffects)&&Array.isArray(proof.localEffects)&&Array.isArray(proof.unknownEffects)&&proof.unknownEffects.length===0,'PRODUCT_STOCK_UNKNOWN_LINEAGE');
 const movements=[...(proof.openingEffects??[]),...proof.acceptedSourceEffects,...proof.localEffects];
 check(movements.every(m=>validId(m.id)&&hex(m.hash)&&typeof m.qty==='string')&&new Set(movements.map(m=>m.id)).size===movements.length,'PRODUCT_STOCK_MOVEMENT_PROOF');
 check(proof.localEffects.every(m=>['REAL_LOCAL','SYNTHETIC_LOCAL'].includes(m.kind)&&m.proof&&hex(m.proofHash)&&digest(m.proof)===m.proofHash),'PRODUCT_LOCAL_EXPLICIT_PROOF');
 check(Array.isArray(proof.openingEffects)&&(proof.openingEffects.length>0||proof.openingWitness&&hex(proof.openingWitnessHash)&&digest(proof.openingWitness)===proof.openingWitnessHash)&&sumDecimals(proof.openingEffects.map(m=>m.qty))===decimal(proof.openingSourceQty),'PRODUCT_STOCK_OPENING_PROOF');
 const prior=sumDecimals([proof.openingSourceQty,...proof.acceptedSourceEffects.map(m=>m.qty)]);
 check(prior===decimal(proof.previousAppliedSourceQty),'PRODUCT_STOCK_PRIOR_SOURCE');
 const local=sumDecimals(proof.localEffects.map(m=>m.qty));
 check(sumDecimals([prior,local])===decimal(proof.ledgerQty)&&decimal(e.currentStockQty)===decimal(proof.ledgerQty),'PRODUCT_STOCK_NATIVE_CLOSURE');
 check(proof.ledgerRowsHash===digest(movements.map(m=>({id:m.id,hash:m.hash})).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1)),'PRODUCT_STOCK_LEDGER_BINDING');
 const sourceDelta=subtraction(p.quantity,prior),after=sumDecimals([p.quantity,local]);exactQty(sourceDelta);exactQty(after);
 return {sourceBefore:prior,sourceAfter:decimal(p.quantity),sourceDelta,localReal:sumDecimals(proof.localEffects.filter(m=>m.kind==='REAL_LOCAL').map(m=>m.qty)),localSynthetic:sumDecimals(proof.localEffects.filter(m=>m.kind==='SYNTHETIC_LOCAL').map(m=>m.qty)),nativeBefore:decimal(proof.ledgerQty),nativeAfter:after,ledgerRowsHash:proof.ledgerRowsHash,proof};
}
function makeGroup(p,e,input,publishedIds=null){
 check(validId(String(p.sourceId))&&p.sourceKey===`VEGA2026/F0102/TBLSTOKLAR/${p.sourceId}`&&(p.sourceUid===null||typeof p.sourceUid==='string'&&p.sourceUid.length>0),'PRODUCT_SOURCE_IDENTITY');
 check(p.company===undefined||p.company==='F0102','PRODUCT_PHYSICAL_COMPANY');
 const published=publishedIds??new Set(input.previousVersion.products.map(n=>String(n.product_id)));
 check(e.nativeId===null||validId(e.nativeId),'PRODUCT_NATIVE_ID');if(e.nativeId!==null)check(published.has(e.nativeId),'PRODUCT_EXISTING_UNPUBLISHED_LEGACY');
 const acceptedOutside=p.scope==='EXCLUDED_PASSIVE_ZERO'&&e.nativeId!==null&&published.has(e.nativeId)&&p.isActive===false&&decimal(p.quantity)==='0.00000000';
 check((p.scope?.startsWith('IN_SCOPE')||acceptedOutside)&&p.unit==='ADET'&&p.unitStatus==='VERIFIED_ADET_FACTOR_1'&&decimal(p.unitFactor)==='1.00000000'&&validId(String(p.mainUnitSourceId)),'PRODUCT_UNIT_SCOPE');
 check(typeof p.stockCode==='string'&&p.stockCode.length>0&&p.stockCode.length<=50&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=250&&[p.brand,p.category].every(v=>v===null||typeof v==='string'&&v.length<=120)&&typeof p.isActive==='boolean','PRODUCT_MASTER_SOURCE');
 check(Array.isArray(e.holdRows)&&e.holdRows.length===0&&Array.isArray(e.aliasRows)&&Array.isArray(e.codeOwners)&&Array.isArray(e.barcodeOwners)&&Array.isArray(e.prices),'PRODUCT_OWNERSHIP_EVIDENCE');
 const isNew=e.nativeId===null;check(isNew||validId(e.nativeId),'PRODUCT_NATIVE_ID');
 check(e.sourceIdentityProof?.company==='F0102'&&e.sourceIdentityProof.table==='F0102TBLSTOKLAR'&&String(e.sourceIdentityProof.sourceId)===String(p.sourceId)&&e.sourceIdentityProof.sourceUid===p.sourceUid&&hex(e.sourceIdentityProofHash)&&digest(e.sourceIdentityProof)===e.sourceIdentityProofHash,'PRODUCT_PHYSICAL_IDENTITY_PROOF');
 check(e.physicalSourceProof?.physical===true&&String(e.physicalSourceProof.sourceId)===String(p.sourceId)&&hex(e.physicalSourceProofHash)&&digest(e.physicalSourceProof)===e.physicalSourceProofHash,isNew?'PRODUCT_NEW_PHYSICAL_TYPE_REQUIRED':'PRODUCT_PHYSICAL_TYPE_UNVERIFIED');
 const native=isNew?null:JSON.parse(e.nativeJSON);
 if(isNew)check(e.aliasRows.length===0&&e.codeOwners.length===0,'PRODUCT_NEW_COLLISION');
 else{check(hex(e.nativeHash)&&sqlJsonHash(e.nativeJSON)===e.nativeHash.toUpperCase()&&String(native.id)===e.nativeId&&native.unit==='ADET'&&native.source_record_key===sourceNativeKey(p),'PRODUCT_NATIVE_PREIMAGE');check(e.aliasRows.length===1&&String(e.aliasRows[0].product_id)===e.nativeId&&String(e.aliasRows[0].source_product_id)===String(p.sourceId)&&e.codeOwners.every(r=>String(r.id)===e.nativeId),'PRODUCT_EXISTING_ALIAS');check(e.previousSource&&String(e.previousSource.sourceId)===String(p.sourceId),'PRODUCT_APPLIED_SOURCE_REQUIRED');const previousUid=e.previousSource.sourceUid;if(previousUid!==null&&previousUid!==undefined&&p.sourceUid!==null)check(previousUid===p.sourceUid,'PRODUCT_PHYSICAL_UID_CHANGED');}
 const exceptions=[],fields={},prices=[];
 for(const [s,n] of Object.entries(masterMap)){
  if(isNew)fields[n]=p[s];else if(native[n]===e.previousSource[s]){if(native[n]!==p[s])fields[n]=p[s];}else if(native[n]!==p[s])exceptions.push({kind:'MASTER',field:n,reason:'LOCAL_MASTER_CONFLICT'});
 }
 if(exceptions.some(e=>e.kind==='MASTER'))for(const field of Object.values(masterMap))delete fields[field];
 // Sale-only extraction: purchase/cost references are deliberately not consumed.
 const saleSource=[],seen=new Set();for(const price of p.prices??[]){try{saleSource.push(...sourceTypedPrices({...p,prices:[price],purchasePrice:null}));}catch(error){check(/^[A-Z0-9_]+$/.test(error.message),'PRODUCT_UNEXPECTED_PRICE_ERROR');exceptions.push({kind:'PRICE',tuple:priceTuple({...price,type:'sale'}),reason:error.message});}}
 for(const v of saleSource){const k=priceTuple(v);check(!seen.has(k),'PRODUCT_PRICE_DUPLICATE');seen.add(k);
  const matches=e.prices.filter(n=>priceTuple(n)===k);check(matches.length<=1,'PRODUCT_NATIVE_PRICE_DUPLICATE');
  if(!matches.length)prices.push({change:'INSERT',before:null,after:v});
  else{const n=matches[0];check(validId(String(n.id))&&hex(n.nativeHash),'PRODUCT_PRICE_NATIVE_ID');
   if(decimal(n.priceExact)===v.priceExact)continue;
   check(typeof n.nativeJSON==='string'&&sqlJsonHash(n.nativeJSON)===n.nativeHash.toUpperCase(),'PRODUCT_PRICE_PREIMAGE');
   if(n.manual===true||n.acceptedPriceExact===undefined||n.acceptedNativeHash===undefined||decimal(n.priceExact)!==decimal(n.acceptedPriceExact)||n.nativeHash.toUpperCase()!==n.acceptedNativeHash.toUpperCase()){exceptions.push({kind:'PRICE',tuple:k,reason:'LOCAL_OR_UNPROVEN_PRICE'});continue;}
   prices.push({change:'UPDATE',before:n,after:v});
  }
 }
 const supersededSalePrices=[];
 if(!isNew)for(const old of e.prices){if((old.price_type??old.type)!=='sale'||seen.has(priceTuple(old)))continue;const replacement=saleSource.filter(p=>p.unitSourceId===String(old.source_unit_id??old.unitSourceId)&&p.tier===Number(old.price_tier??old.tier)&&p.currency!==(old.currency_code??old.currency)&&!exceptions.some(x=>x.kind==='PRICE'&&x.tuple===priceTuple(p)));if(replacement.length!==1)continue;
  if(old.manual===true||!hex(old.acceptedNativeHash)||!hex(old.nativeHash)||old.acceptedNativeHash.toUpperCase()!==old.nativeHash.toUpperCase()||old.acceptedPriceExact===undefined||decimal(old.priceExact)!==decimal(old.acceptedPriceExact)){exceptions.push({kind:'PRICE_PROJECTION',tuple:priceTuple(old),reason:'LOCAL_OR_UNPROVEN_SUPERSEDED_PRICE'});continue;}
  supersededSalePrices.push({priceId:String(old.id),before:old,replacement:replacement[0],reason:'CONFIRMED_SOURCE_CURRENCY_REPLACEMENT',nativeUntouched:true,historicalVersionsUntouched:true});
 }
 const main=saleSource.filter(v=>v.isMainUnit&&v.tier===1);
 if(isNew)check(main.length===1,'PRODUCT_NEW_MAIN_CURRENCY_REQUIRED');
 const currency=isNew?main[0].currency:native.currency_code;
 const mainSafe=main.filter(v=>v.currency===currency&&!exceptions.some(x=>x.kind==='PRICE'&&x.tuple===priceTuple(v)));
 if(mainSafe.length===1){if(isNew)fields.sales_price=roundDecimal(mainSafe[0].priceExact,4);else{check(typeof e.salesPriceExact==='string','PRODUCT_SCALAR_EXACT');const previousMain=(e.prices??[]).find(n=>priceTuple(n)===priceTuple(mainSafe[0]));if(previousMain&&decimal(e.salesPriceExact)===decimal(roundDecimal(previousMain.acceptedPriceExact??previousMain.priceExact,4)))fields.sales_price=roundDecimal(mainSafe[0].priceExact,4);else if(decimal(e.salesPriceExact)!==decimal(roundDecimal(mainSafe[0].priceExact,4)))exceptions.push({kind:'SCALAR_PRICE',reason:'LOCAL_SCALAR_PRICE'});}}
 const barcodes=[];check(Array.isArray(p.barcodes),'PRODUCT_BARCODES');
 for(const b of p.barcodes){check(b&&typeof b.barcode==='string'&&b.barcode.length>0&&b.barcode.length<=80,'PRODUCT_BARCODE_STRING');if(b.unit!=='ADET'||b.factor===null||b.factor===undefined||decimal(b.factor)!=='1.00000000'||!validId(String(b.sourceId))){exceptions.push({kind:'BARCODE',barcode:b.barcode,reason:'BARCODE_UNIT_FACTOR_UNVERIFIED'});continue;}const owners=e.barcodeOwners.filter(o=>barcodeComparisonKey(o.barcode)===barcodeComparisonKey(b.barcode));
  if(owners.some(o=>isNew||String(o.product_id)!==e.nativeId)||owners.length&&!owners.some(o=>o.is_active===true)){exceptions.push({kind:'BARCODE',barcode:b.barcode,reason:'BARCODE_OWNER_CONFLICT'});continue;}
  if(!owners.length&&!barcodes.some(x=>barcodeComparisonKey(x.barcode)===barcodeComparisonKey(b.barcode)))barcodes.push(b);
 }
 let stock=null;try{check(p.quantity!==null&&decimal(p.quantity)!==null,'PRODUCT_SOURCE_QUANTITY_UNKNOWN');check(BigInt(decimal(p.quantity).replace('.',''))>=0n,'PRODUCT_NEGATIVE_SOURCE_QUANTITY_REQUIRES_DECISION');if(isNew){check(exactQty(p.quantity)!==null,'PRODUCT_NEW_QUANTITY_UNKNOWN');stock={sourceBefore:'0.00000000',sourceAfter:decimal(p.quantity),sourceDelta:decimal(p.quantity),localReal:'0.00000000',localSynthetic:'0.00000000',nativeBefore:'0.00000000',nativeAfter:decimal(p.quantity),ledgerRowsHash:digest([]),proof:null};}else{check(e.averageCostTryExact===null||typeof e.averageCostTryExact==='string','PRODUCT_NATIVE_COST_EXACT');stock=verifyProductStockProof(p,e);}}catch(error){if(isNew)throw error;exceptions.push({kind:'STOCK',reason:error.message});}
 if(isNew){Object.assign(fields,{unit:'ADET',currency_code:currency,purchase_price:null,average_cost_try:null,current_stock_qty:exactQty(stock.nativeAfter),is_deleted:false,passive_at:null,passive_reason:null,created_by:input.actorId,updated_at:null,updated_by:null,purchase_discount_rate:newCardPurchaseDiscount(p),supplier_id:null,source_record_key:sourceNativeKey(p),migration_run_id:input.runId,source_payload_hash:digest(p),source_payload_json:JSON.stringify(p),source_document_key:null,original_document_date:null,source_notes:'Verified dated source product',source_sales_currency:currency,source_purchase_currency:null,migration_scope_status:'IN_SCOPE'});}
 else{if(stock&&stock.sourceDelta!=='0.00000000')fields.current_stock_qty=exactQty(stock.nativeAfter);if(Object.hasOwn(fields,'sales_price')&&decimal(fields.sales_price)===decimal(e.salesPriceExact))delete fields.sales_price;}
 return {sourceId:String(p.sourceId),sourceKey:p.sourceKey,sourceUid:p.sourceUid,sourcePayloadHash:digest(p),source:p,nativeId:e.nativeId,isNew,fields,prices,supersededSalePrices,barcodes,stock,exceptions,evidence:e};
}
export function buildProductCompletionPlan(input){
 check(input&&validId(input.actorId)&&input.sourceSnapshot&&Array.isArray(input.sourceSnapshot.products)&&digest(input.sourceSnapshot)===input.sourceHash&&(input.sourceSnapshot.twoPassStable===true||input.sourceProof?.sourceHash===input.sourceHash&&input.sourceProof.twoPassStable===true),'PRODUCT_FROZEN_SNAPSHOT');
 const identity=input.sourceSnapshot.identity??input.sourceSnapshot.source;
 check(input.sourceSnapshot.actualT1!==true&&identity?.server==='DESKTOP-KSRK0EQ'&&identity.database==='VEGA2026'&&(input.sourceSnapshot.selectOnly===true||identity.selectOnly===true||identity.sourceSELECTOnly===true),'PRODUCT_READONLY_SOURCE');
 check(input.previousVersion?.context&&Array.isArray(input.previousVersion.products)&&Array.isArray(input.previousVersion.prices)&&Array.isArray(input.previousVersion.records)&&Array.isArray(input.evidence?.products)&&Array.isArray(input.evidence.schema)&&Array.isArray(input.evidence.guards)&&Array.isArray(input.evidence.constraints),'PRODUCT_INPUT_PROOFS');
 check(new Set(input.sourceSnapshot.products.map(p=>p.sourceKey)).size===input.sourceSnapshot.products.length&&new Set(input.evidence.products.map(p=>String(p.sourceId))).size===input.evidence.products.length,'PRODUCT_INPUT_DUPLICATE');
 const groups=[],deferred=[],bySource=new Map(input.evidence.products.map(e=>[String(e.sourceId),e])),publishedIds=new Set(input.previousVersion.products.map(n=>String(n.product_id)));
 for(const p of input.sourceSnapshot.products){const e=bySource.get(String(p.sourceId));if(!e){deferred.push({sourceId:String(p.sourceId),sourceKey:p.sourceKey,reason:'NATIVE_PROOF_MISSING'});continue;}try{groups.push(makeGroup(p,e,input,publishedIds));}catch(error){check(/^[A-Z0-9_]+$/.test(error.message),'PRODUCT_UNEXPECTED_PLAN_ERROR');deferred.push({sourceId:String(p.sourceId),sourceKey:p.sourceKey,reason:error.message});}}
 const body={schemaVersion:PRODUCT_COMPLETION_SCHEMA,runId:input.runId,actorId:input.actorId,server:TARGET.server,database:TARGET.database,sourceAsOf:input.sourceAsOf,documentDate:input.documentDate,sourceHash:input.sourceHash,actualT1:false,previousVersion:input.previousVersion,evidence:input.evidence,groups,deferred,
  counts:{source:input.sourceSnapshot.products.length,newProducts:groups.filter(g=>g.isNew).length,existingProducts:groups.filter(g=>!g.isNew).length,stockEffects:groups.filter(g=>g.stock&&g.stock.sourceDelta!=='0.00000000').length,priceInserts:groups.flatMap(g=>g.prices).filter(p=>p.change==='INSERT').length,priceUpdates:groups.flatMap(g=>g.prices).filter(p=>p.change==='UPDATE').length,supersededSalePrices:groups.reduce((n,g)=>n+g.supersededSalePrices.length,0),barcodeInserts:groups.reduce((n,g)=>n+g.barcodes.length,0),deferred:deferred.length}};
 const planHash=digest(body);productCompletionContext({...body,planHash,productCount:body.previousVersion.products.length+body.counts.newProducts,priceCount:body.previousVersion.prices.length+body.counts.priceInserts-body.counts.supersededSalePrices});return {...body,planHash};
}
export function validateProductCompletionPlan(plan){const {planHash,...body}=plan??{};check(plan?.schemaVersion===PRODUCT_COMPLETION_SCHEMA&&hex(planHash)&&digest(body)===planHash&&plan.actualT1===false&&plan.server===TARGET.server&&plan.database===TARGET.database,'PRODUCT_SEALED_PLAN');check(new Set([...plan.groups,...plan.deferred].map(g=>g.sourceKey)).size===plan.groups.length+plan.deferred.length&&new Set(plan.groups.filter(g=>g.nativeId).map(g=>g.nativeId)).size===plan.groups.filter(g=>g.nativeId).length,'PRODUCT_SCOPE_DUPLICATE');const publishedIds=new Set(plan.previousVersion.products.map(n=>String(n.product_id)));for(const g of plan.groups)check(digest(makeGroup(g.source,g.evidence,plan,publishedIds))===digest(g),'PRODUCT_GROUP_RECOMPUTATION');check(plan.groups.length+plan.deferred.length===plan.counts.source,'PRODUCT_SCOPE_COVERAGE');productCompletionContext({...plan,productCount:plan.previousVersion.products.length+plan.counts.newProducts,priceCount:plan.previousVersion.prices.length+plan.counts.priceInserts-plan.counts.supersededSalePrices});return plan;}
