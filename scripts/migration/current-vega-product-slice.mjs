// Bounded connector capture -> existing native product/source-version contract.
// No database, filesystem, credentials, writer, opening batch or runtime on import.
import {decimal,sumDecimals,hash,requireRule as check} from './mapping-opening.mjs';
import {sourceTypedPrices} from './goal7-source-version.mjs';
import {sourceNativeKey,buildProductCompletionPlan} from './product-completion-plan.mjs';

const id=v=>{check((typeof v==='string'&&/^[1-9]\d*$/.test(v))||(Number.isSafeInteger(v)&&v>0),'CURRENT_PRODUCT_SOURCE_ID');return String(v);};
const optionalText=v=>{check(v===null||typeof v==='string','CURRENT_PRODUCT_SOURCE_TEXT');return v===null||!v.trim()?null:v;};
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const currency=v=>({'$':'USD','USD':'USD','€':'EUR','EUR':'EUR','TL':'TRY','TRY':'TRY','₺':'TRY'})[v]??null;
function envelope(e,object,{period=null}={}){
 check(e?.source==='vega'&&e.database==='VEGA2026'&&e.company==='F0102'&&e.readOnly===true,'CURRENT_PRODUCT_SOURCE_SCOPE');
 check(iso(e.readAt)&&Array.isArray(e.items)&&e.hasMore===false&&e.nextCursor===null,'CURRENT_PRODUCT_CAPTURE_INCOMPLETE');
 check(Array.isArray(e.objects)&&e.objects.some(o=>o.schemaName==='dbo'&&o.objectName===object),'CURRENT_PRODUCT_SOURCE_OBJECT');
 check(period===null?e.period===null:e.period===period&&e.periodYear===2026,'CURRENT_PRODUCT_SOURCE_PERIOD');
 return e.items;
}
function perProduct(envelopes,object,sourceId,options){
 check(Array.isArray(envelopes),'CURRENT_PRODUCT_CAPTURE_REQUIRED');
 const candidates=envelopes.filter(e=>object==='F0102D0007TBLSTOKHAREKETLERI'
  ?Array.isArray(e.items)&&e.items.length===1&&String(e.items[0].source_id)===sourceId
  :Array.isArray(e.filters)&&e.filters.some(f=>f.field==='STOKNO'&&f.op==='eq'&&String(f.value)===sourceId));
 check(candidates.length===1,'CURRENT_PRODUCT_CAPTURE_SINGLETON');
 return {e:candidates[0],rows:envelope(candidates[0],object,options)};
}
export function selectActiveVegaProductCards(cards){
 const all=envelope(cards,'F0102TBLSTOKLAR');
 check(new Set(all.map(r=>id(r.IND))).size===all.length,'CURRENT_PRODUCT_CARD_SINGLETON');
 const active=all.filter(r=>r.STATUS===1&&r.DELETED!==true&&r.IPTAL!==true);
 return {...cards,items:active,selection:{kind:'ACTIVE_STOCK_CARDS_ONLY',read:all.length,selected:active.length,
  excluded:all.length-active.length,unknownActive:all.filter(r=>r.STATUS===null).length,
  stockQuantityFilter:false,movementDateFilter:false,partyScopeUnchanged:true}};
}
export function buildCurrentVegaProductSlice({cards,units,prices,quantities}){
 const rows=envelope(cards,'F0102TBLSTOKLAR');
 check(rows.length>0&&new Set(rows.map(r=>id(r.IND))).size===rows.length,'CURRENT_PRODUCT_CARD_SINGLETON');
 const allowed=new Set(rows.map(r=>id(r.IND)));
 for(const captures of [units,prices,quantities])check(Array.isArray(captures)&&captures.length===rows.length,'CURRENT_PRODUCT_SCOPE_COVERAGE');
 const readTimes=[cards.readAt],products=[];
 for(const row of rows){
  const sourceId=id(row.IND),sourceKey=`VEGA2026/F0102/TBLSTOKLAR/${sourceId}`;
  check(typeof row.STOKKODU==='string'&&row.STOKKODU.length>0&&typeof row.MALINCINSI==='string'&&row.MALINCINSI.length>0,'CURRENT_PRODUCT_CARD_IDENTITY');
  check(row.STATUS===1&&row.DELETED!==true&&row.IPTAL!==true,'CURRENT_PRODUCT_ACTIVE_SCOPE_ONLY');
  check([true,false,null].includes(row.DELETED)&&[true,false,null].includes(row.IPTAL),'CURRENT_PRODUCT_DELETE_UNKNOWN');
  const u=perProduct(units,'F0102TBLBIRIMLEREX',sourceId),p=perProduct(prices,'F0102TBLBIRIMLEREX',sourceId);
  const q=perProduct(quantities,'F0102D0007TBLSTOKHAREKETLERI',sourceId,{period:'D0007'});
  readTimes.push(u.e.readAt,p.e.readAt,q.e.readAt);
  check(u.rows.every(r=>id(r.STOKNO)===sourceId)&&p.rows.every(r=>id(r.STOKNO)===sourceId),'CURRENT_PRODUCT_UNIT_OWNER');
  check(new Set(u.rows.map(r=>id(r.IND))).size===u.rows.length&&new Set(p.rows.map(r=>id(r.IND))).size===p.rows.length,'CURRENT_PRODUCT_UNIT_SINGLETON');
  check(q.rows.length===1&&id(q.rows[0].source_id)===sourceId&&q.rows[0].stock_code===row.STOKKODU,'CURRENT_PRODUCT_QUANTITY_OWNER');
  const mainId=row.ANABIRIM===null?null:id(row.ANABIRIM),main=u.rows.filter(r=>id(r.IND)===mainId);
  const verified=main.length===1&&main[0].BIRIMADI==='ADET'&&decimal(main[0].CARPAN)==='1.00000000';
  const issues=[];
  if(!verified)issues.push({field:'unit',reason:'SOURCE_MAIN_ADET_FACTOR_NOT_VERIFIED'});
  const barcodes=[];
  for(const unit of u.rows){
   check(unit.BARCODE===null||typeof unit.BARCODE==='string','CURRENT_PRODUCT_BARCODE_MUST_BE_TEXT');
   if(unit.BARCODE!==null&&unit.BARCODE!=='')barcodes.push({sourceId:id(unit.IND),barcode:unit.BARCODE,unitSourceId:id(unit.IND),isPrimary:id(unit.IND)===mainId});
  }
  const saleSlots=[];
  for(const unit of p.rows){
   const unitId=id(unit.IND),known=u.rows.find(r=>id(r.IND)===unitId);
   check(known&&known.BIRIMADI===unit.BIRIMADI&&decimal(known.CARPAN)===decimal(unit.CARPAN)&&known.BARCODE===unit.BARCODE,'CURRENT_PRODUCT_UNIT_READ_DRIFT');
   for(let tier=1;tier<=6;tier++){
    const amount=decimal(unit['SATISFIYATI'+tier]),rawCurrency=unit['PB'+tier],code=currency(rawCurrency);
    if(amount===null&&rawCurrency===null)continue;
    saleSlots.push({unitSourceId:unitId,tier,price:amount,currency:code,sourceCurrency:rawCurrency});
    if(amount===null||code===null)issues.push({field:'salePrice',unitSourceId:unitId,tier,reason:'SOURCE_PRICE_OR_CURRENCY_UNKNOWN'});
    if(amount!==null&&BigInt(amount.replace('.',''))<0n)issues.push({field:'salePrice',unitSourceId:unitId,tier,reason:'SOURCE_NEGATIVE_SALE_PRICE'});
   }
  }
  const quantity=q.rows[0],unitQuantityVerified=verified&&quantity.source_unit==='ADET'&&String(quantity.source_unit_id)===mainId;
  if(!unitQuantityVerified)issues.push({field:'quantity',reason:'SOURCE_QUANTITY_UNIT_NOT_VERIFIED'});
  if(quantity.erp_quantity===null)issues.push({field:'quantity',reason:'SOURCE_QUANTITY_UNKNOWN'});
  const product={company:'F0102',period:'D0007',sourceId,sourceKey,stockCode:row.STOKKODU,name:row.MALINCINSI,
   brand:optionalText(row.KOD1),category:optionalText(row.KOD4),isActive:true,
   unit:verified?'ADET':null,mainUnitSourceId:mainId,unitFactor:verified?'1.00000000':null,
   unitStatus:verified?'VERIFIED_ADET_FACTOR_1':'UNKNOWN',
   quantity:unitQuantityVerified?decimal(quantity.erp_quantity):null,quantityBasis:quantity.quantity_basis,
   // A product-wide total is not a depot allocation or an opening contribution.
   warehouseAllocation:null,stockApplicationReady:false,unitPolicy:'ALL_PRODUCTS_ADET_SOURCE_FACTOR_PRESERVED',
   units:u.rows.map(r=>({...r})),barcodes,prices:saleSlots,purchasePrice:null,averageCostTry:null,costStatus:'NOT_READ',
   provenance:{kind:'DATED_SOURCE_READ',accepted:false},issues};
  product.nativeSourceKey=sourceNativeKey(product);
  product.typedSalePrices=verified?sourceTypedPrices({...product,prices:saleSlots.filter(s=>s.price!==null&&s.currency!==null&&BigInt(s.price.replace('.',''))>=0n)}):[];
  product.sourcePayloadHash=hash({card:row,units:u.rows,prices:p.rows,quantity});
  products.push(product);
 }
 // Cross-product barcode collisions are evidence, never an automatic merge.
 const owners=new Map();for(const p of products)for(const b of p.barcodes){const k=b.barcode.trimEnd().toLocaleUpperCase('tr');if(!owners.has(k))owners.set(k,new Set());owners.get(k).add(p.sourceId);}
 for(const p of products)for(const b of p.barcodes)if(owners.get(b.barcode.trimEnd().toLocaleUpperCase('tr')).size>1)p.issues.push({field:'barcode',barcode:b.barcode,reason:'SOURCE_BARCODE_MULTIPLE_PRODUCTS'});
 check(products.every(p=>allowed.has(p.sourceId)),'CURRENT_PRODUCT_SCOPE_CHANGED');
 const ordered=[...readTimes].sort(),body={schemaVersion:'melisa-current-vega-product-slice.v1',
  source:{database:'VEGA2026',company:'F0102',period:'D0007',year:2026,readOnly:true,readStartedAt:ordered[0],readCompletedAt:ordered.at(-1),atomic:false,actualT1:false,selection:'ACTIVE_STOCK_CARDS_ONLY'},
  products,requiresNativeBeforeImages:true,requiresWarehouseContributionProof:true,acceptedOpening:false};
 return {...body,snapshotHash:hash(body)};
}

// Readback comparison only: equality of total stock does not authorize a delta.
export function compareCurrentVegaSliceWithNative(slice,native){
 const {snapshotHash,...body}=slice;
 check(hash(body)===snapshotHash&&slice.acceptedOpening===false,'CURRENT_PRODUCT_SLICE_HASH');
 check(native?.server==='Semih\\MELISADEV'&&native.database==='MELISA_ERP_SIRKET_TEST_20260929_01','CURRENT_PRODUCT_NATIVE_TARGET');
 check(Array.isArray(native.products)&&Array.isArray(native.barcodes)&&Array.isArray(native.prices)&&Number.isSafeInteger(native.holdsCount)&&native.holdsCount>=0,'CURRENT_PRODUCT_NATIVE_READBACK');
 check(native.holdsCount===0?native.holds===null||Array.isArray(native.holds)&&native.holds.length===0:Array.isArray(native.holds)&&native.holds.length===native.holdsCount,'CURRENT_PRODUCT_NATIVE_HOLD_PROOF');
 const results=slice.products.map(p=>{
  const matches=native.products.filter(n=>n.source_record_key===p.nativeSourceKey);
  if(matches.length!==1)return {sourceId:p.sourceId,status:'BLOCKED',reason:'NATIVE_SOURCE_SINGLETON'};
  const n=matches[0],pid=id(n.id),hold=(native.holds??[]).some(h=>String(h.native_id)===pid),differences=[];
  for(const [sourceField,nativeField] of [['stockCode','stock_code'],['name','name'],['brand','brand'],['category','category'],['unit','unit'],['isActive','is_active']])if(p[sourceField]!==n[nativeField])differences.push({field:sourceField,reason:'SOURCE_NATIVE_DIFFERENCE'});
  const barcodeRows=native.barcodes.filter(b=>String(b.product_id)===pid&&b.is_active===true);
  for(const b of p.barcodes)if(!barcodeRows.some(n=>n.barcode===b.barcode))differences.push({field:'barcode',reason:'NATIVE_BARCODE_MISSING',sourceUnitId:b.unitSourceId});
  for(const q of p.typedSalePrices){
   const prices=native.prices.filter(v=>String(v.product_id)===pid&&v.price_type==='sale'&&String(v.source_unit_id)===q.unitSourceId&&v.price_tier===q.tier&&v.currency_code===q.currency);
   if(prices.length!==1||decimal(prices[0].priceExact)!==q.priceExact)differences.push({field:'salePrice',reason:prices.length>1?'NATIVE_PRICE_MULTIPLE_ROWS':'SOURCE_NATIVE_PRICE_DIFFERENCE',unitSourceId:q.unitSourceId,tier:q.tier,currency:q.currency});
  }
  return {sourceId:p.sourceId,nativeId:pid,stockCode:p.stockCode,status:hold?'HELD':differences.length?'DIFFERENCES':p.issues.length?'SOURCE_GAPS':'OBSERVED_EQUAL',differences,
   observedQuantitySame:p.quantity!==null&&decimal(n.stockExact)===p.quantity,
   stockApplicationReady:false,requiresContributionSeparation:true,sourceIssues:p.issues};
 });
 return {schemaVersion:'melisa-current-product-readback.v1',snapshotHash,results,sourceWrites:0,targetWrites:0,openingApplied:false};
}

// Adapts two REAL bounded SELECT passes to the EXISTING completion writer.
// No connection, account, SQL write, guard change or default stock is created.
export function buildCurrentVegaCompletionInput({capture,nativeInput,warehouseMapping=null}){
 check(capture?.schemaVersion==='melisa-active-stock-bounded-two-pass.v1'&&capture.actualT1===false&&capture.atomic===false,'CURRENT_COMPLETION_CAPTURE');
 const proof=capture.sourceIdentity,identity=proof?.identity,perms=proof?.permissions;
 check(identity?.server==='DESKTOP-KSRK0EQ'&&identity.database==='VEGA2026'&&proof.readOnly===true&&iso(proof.readAt),'CURRENT_COMPLETION_SOURCE_IDENTITY');
 const permissionKeys=['sysadmin','controlServer','dbControl','dbInsert','dbUpdate','dbDelete','dbExecute','dbAlter','dbCreateTable'];
 check(perms&&permissionKeys.every(k=>perms[k]===0),'CURRENT_COMPLETION_SOURCE_SELECT_ONLY');
 const tables=['F0102TBLSTOKLAR','F0102TBLBIRIMLEREX','F0102D0007TBLSTOKHAREKETLERI'];
 check(Array.isArray(proof.tablePermissions)&&proof.tablePermissions.length===3&&new Set(proof.tablePermissions.map(t=>t.name)).size===3&&tables.every(n=>proof.tablePermissions.some(t=>t.name===n&&t.canSelect===1&&['canInsert','canUpdate','canDelete','canAlter'].every(k=>t[k]===0))),'CURRENT_COMPLETION_TABLE_PERMISSIONS');
 check(proof.companies?.length===1&&proof.companies[0].IND===102&&proof.periods?.length===1&&proof.periods[0].FIND===102&&proof.periods[0].IND===7&&proof.periods[0].DONEM===2026,'CURRENT_COMPLETION_SOURCE_PERIOD');
 check(Array.isArray(capture.expectedSourceIds)&&capture.expectedSourceIds.length>0,'CURRENT_COMPLETION_SCOPE');
 const expected=capture.expectedSourceIds.map(id),scope=new Set(expected);
 check(scope.size===expected.length&&Array.isArray(capture.passes)&&capture.passes.length===2,'CURRENT_COMPLETION_TWO_PASSES');
 const [a,b]=capture.passes;
 for(const pass of [a,b]){
  check(iso(pass.readStartedAt)&&iso(pass.readCompletedAt)&&pass.readStartedAt<=pass.readCompletedAt&&['cards','units','warehouseRows'].every(k=>Array.isArray(pass[k])),'CURRENT_COMPLETION_PASS_SHAPE');
  check(new Set(pass.cards.map(r=>id(r.IND))).size===pass.cards.length&&new Set(pass.units.map(r=>id(r.IND))).size===pass.units.length,'CURRENT_COMPLETION_SOURCE_DUPLICATE');
  check(pass.cards.every(r=>scope.has(id(r.IND))&&Object.hasOwn(r,'UID')&&(r.UID===null||typeof r.UID==='string'))&&pass.units.every(r=>scope.has(id(r.STOKNO))&&Object.hasOwn(r,'UID')&&(r.UID===null||typeof r.UID==='string'))&&pass.warehouseRows.every(r=>scope.has(id(r.STOKNO))),'CURRENT_COMPLETION_UID_AND_SCOPE');
  check(new Set(pass.warehouseRows.map(r=>JSON.stringify([r.STOKNO,r.BIRIMEX,r.DEPO]))).size===pass.warehouseRows.length,'CURRENT_COMPLETION_DEPOT_DUPLICATE');
 }
 check(a.readCompletedAt<=b.readStartedAt,'CURRENT_COMPLETION_INDEPENDENT_PASSES');
 check(nativeInput?.targetIdentity?.server==='Semih\\MELISADEV'&&nativeInput.targetIdentity.database==='MELISA_ERP_SIRKET_TEST_20260929_01','CURRENT_COMPLETION_NATIVE_TARGET');
 check(Array.isArray(nativeInput.evidence?.products)&&new Set(nativeInput.evidence.products.map(e=>id(e.sourceId))).size===nativeInput.evidence.products.length,'CURRENT_COMPLETION_NATIVE_EVIDENCE');
 if(warehouseMapping){const p=warehouseMapping.proof;check(p?.kind==='ACCEPTED_SOURCE_DEPOT_MAPPING'&&p.sourceCompany==='F0102'&&typeof p.sourceWarehouseId==='string'&&/^[1-9]\d*$/.test(p.sourceWarehouseId)&&p.targetWarehouse==='MERKEZ'&&p.target?.server===nativeInput.targetIdentity.server&&p.target.database===nativeInput.targetIdentity.database&&Array.isArray(p.nativeWitnessRows)&&p.nativeWitnessRows.length>0&&p.nativeWitnessRows.every(r=>r.sourceWarehouseId===p.sourceWarehouseId&&r.targetWarehouse===p.targetWarehouse)&&hash(p)===warehouseMapping.proofHash,'CURRENT_COMPLETION_DEPOT_MAPPING');}
 const project=(pass,sid)=>({cards:pass.cards.filter(r=>String(r.IND)===sid),units:pass.units.filter(r=>String(r.STOKNO)===sid),warehouseRows:pass.warehouseRows.filter(r=>String(r.STOKNO)===sid)});
 const unstable=expected.filter(sid=>project(a,sid).cards.length!==1||project(b,sid).cards.length!==1||hash(project(a,sid))!==hash(project(b,sid)));
 const stable=expected.filter(sid=>!unstable.includes(sid)),products=[],evidenceRows=[],fieldIssues=[];
 check(stable.length>0,'CURRENT_COMPLETION_NO_STABLE_PRODUCTS');
 for(const sid of stable){
  const raw=project(a,sid),row=raw.cards[0],sourceUid=optionalText(row.UID),e=nativeInput.evidence.products.find(e=>String(e.sourceId)===sid);
  check(e,'CURRENT_COMPLETION_NATIVE_EVIDENCE_MISSING');
  const main=raw.units.find(u=>String(u.IND)===String(row.ANABIRIM)),mainKnown=main?.BIRIMADI==='ADET'&&decimal(main.CARPAN)==='1.00000000';
  const validMovement=raw.warehouseRows.length>0&&raw.warehouseRows.every(m=>m.invalid_quantity===0&&m.quantity!==null&&raw.units.some(u=>String(u.IND)===String(m.BIRIMEX)&&u.BIRIMADI==='ADET'&&decimal(u.CARPAN)==='1.00000000'));
  const observedQuantity=mainKnown?(raw.warehouseRows.length?(validMovement?sumDecimals(raw.warehouseRows.map(r=>r.quantity)):null):decimal(row.KALAN)):null;
  const depotIds=raw.warehouseRows.length?[...new Set(raw.warehouseRows.map(r=>r.DEPO===null?null:String(r.DEPO)))]:[row.DEPO===null||row.DEPO===undefined?null:String(row.DEPO)];
  const depotKnown=warehouseMapping!==null&&depotIds.length===1&&depotIds[0]===warehouseMapping.proof.sourceWarehouseId;
  const makeEnvelope=(object,items,period=null)=>({source:'vega',database:'VEGA2026',company:'F0102',readOnly:true,readAt:a.readCompletedAt,objects:[{schemaName:'dbo',objectName:object}],period,periodYear:period?2026:null,items,hasMore:false,nextCursor:null,filters:[{field:'STOKNO',op:'eq',value:Number(sid)}]});
  const quantity={source_id:Number(sid),stock_code:row.STOKKODU,source_unit:mainKnown?'ADET':null,source_unit_id:mainKnown?row.ANABIRIM:null,erp_quantity:observedQuantity,quantity_basis:raw.warehouseRows.length?'period_movements':'stock_card_fallback'};
  let p;
  try{p=buildCurrentVegaProductSlice({cards:makeEnvelope('F0102TBLSTOKLAR',[row]),units:[makeEnvelope('F0102TBLBIRIMLEREX',raw.units)],prices:[makeEnvelope('F0102TBLBIRIMLEREX',raw.units)],quantities:[makeEnvelope('F0102D0007TBLSTOKHAREKETLERI',[quantity],'D0007')]}).products[0];}
  catch(error){check(['CURRENT_PRODUCT_CARD_IDENTITY','CURRENT_PRODUCT_ACTIVE_SCOPE_ONLY'].includes(error.message),'CURRENT_COMPLETION_SOURCE_NORMALIZATION');p={sourceId:sid,sourceKey:['VEGA2026','F0102','TBLSTOKLAR',sid].join('/'),stockCode:row.STOKKODU,name:row.MALINCINSI,brand:optionalText(row.KOD1),category:optionalText(row.KOD4),isActive:row.STATUS===1&&!row.DELETED&&!row.IPTAL,unit:null,unitFactor:null,unitStatus:'UNKNOWN',mainUnitSourceId:null,barcodes:[],prices:[],issues:[{reason:error.message}]};}
  const issues=[...(p.issues??[])];if(!depotKnown)issues.push({field:'quantity',reason:'SOURCE_DEPOT_MAPPING_NOT_VERIFIED'});
  const prices=(p.prices??[]).filter(v=>{const u=raw.units.find(u=>String(u.IND)===v.unitSourceId);const okay=u?.BIRIMADI==='ADET'&&decimal(u.CARPAN)==='1.00000000';if(!okay)issues.push({field:'salePrice',reason:'SOURCE_PRICE_UNIT_UNSUPPORTED',unitSourceId:v.unitSourceId,tier:v.tier});return okay;});
  const product={...p,sourceUid,company:'F0102',sourceCompany:'F0102',sourceTable:'F0102TBLSTOKLAR',scope:p.isActive===true?'IN_SCOPE_ACTIVE':'OUTSIDE_ACTIVE_SCOPE',quantity:depotKnown?observedQuantity:null,observedSourceQuantity:observedQuantity,warehouseSourceId:depotKnown?depotIds[0]:null,warehouseGroups:raw.warehouseRows,mainUnitUid:main?optionalText(main.UID):null,prices,barcodes:(p.barcodes??[]).map(v=>{const u=raw.units.find(u=>String(u.IND)===v.sourceId);return {...v,sourceUid:optionalText(u.UID),unit:u.BIRIMADI,factor:decimal(u.CARPAN)};}),purchasePrice:null,issues};
  if(Array.isArray(p.typedSalePrices))product.typedSalePrices=p.typedSalePrices.filter(v=>prices.some(s=>s.unitSourceId===v.unitSourceId&&s.tier===v.tier&&s.currency===v.currency));
  if(e.nativeId===null&&product.barcodes.some(b=>(e.barcodeOwners??[]).some(o=>o.barcode.trimEnd().toLocaleUpperCase('tr-TR')===b.barcode.trimEnd().toLocaleUpperCase('tr-TR')))){product.scope='REVIEW_NATIVE_BARCODE_OWNER_CONFLICT';issues.push({field:'barcode',reason:'NATIVE_BARCODE_OWNER_CONFLICT'});}
  const sourceIdentityProof={company:'F0102',table:'F0102TBLSTOKLAR',sourceId:sid,sourceUid,captureProductHash:hash(raw)};
  const physicalSourceProof={sourceId:sid,stockType:row.STOKTIPI,physical:row.STOKTIPI===0,sameFrozenCardFingerprint:true,twoPassStable:true,captureProductHash:hash(raw)};
  products.push(product);evidenceRows.push({...e,sourceIdentityProof,sourceIdentityProofHash:hash(sourceIdentityProof),physicalSourceProof,physicalSourceProofHash:hash(physicalSourceProof)});fieldIssues.push({sourceId:sid,issues});
 }
 const sourceSnapshot={schemaVersion:'melisa-product-current-source.v1',identity:{...identity,selectOnly:true},selectOnly:true,twoPassStable:true,actualT1:false,atomicSnapshot:false,captureStartedAt:a.readStartedAt,exportAt:b.readCompletedAt,consistencyBasis:'TWO_COMPLETE_BOUNDED_PASSES_EQUAL_FOR_SELECTED_PRODUCTS',captureHash:hash(capture),sourceReadProof:proof,expectedSourceIds:expected,unstableSourceIds:unstable,products};
 const input={...nativeInput,sourceSnapshot,sourceHash:hash(sourceSnapshot),evidence:{...nativeInput.evidence,products:evidenceRows}};
 return {input,report:{expected:expected.length,stable:stable.length,unstableSourceIds:unstable,fieldIssues,sourceWrites:0,targetWrites:0,accountChanges:0,actualT1:false}};
}
export function buildCurrentVegaCompletionPlan(options){const adapted=buildCurrentVegaCompletionInput(options);return {...adapted,plan:buildProductCompletionPlan(adapted.input)};}
