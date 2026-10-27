// Bounded connector capture -> existing native product/source-version contract.
// No database, filesystem, credentials, writer, opening batch or runtime on import.
import {decimal,hash,requireRule as check} from './mapping-opening.mjs';
import {sourceTypedPrices} from './goal7-source-version.mjs';
import {sourceNativeKey} from './product-completion-plan.mjs';

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
