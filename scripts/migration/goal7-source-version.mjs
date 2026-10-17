// Pure source-version contract. Importing never opens a database or reads private data.
import {createHash} from 'node:crypto';
import {decimal,roundDecimal,requireRule} from './mapping-opening.mjs';
import {canonicalPayload,payloadHash} from './goal7-decision-model.mjs';
export const SOURCE_VERSION_SCHEMA='melisa-goal7.source-version.v1';
export const SOURCE_VERSION_TABLES=Object.freeze({manifest:'erp_migration.goal7_source_version_manifest',products:'erp_migration.goal7_source_version_products',prices:'erp_migration.goal7_source_version_prices',records:'erp_migration.goal7_source_version_records'});
export const sourceVersionHash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const sourceVersionSqlHash=v=>createHash('sha256').update(v,'utf16le').digest('hex').toUpperCase();
export const SOURCE_VERSION_PRODUCT_FIELDS=Object.freeze(['product_id','product_source_key','source_id','native_source_key','stock_code','product_name','currency_code','unit','main_unit_source_id','stage_payload_hash','stage_sql_hash']);
export const SOURCE_VERSION_PRICE_FIELDS=Object.freeze(['price_id','product_id','product_source_key','price_source_key','source_unit_id','price_type','price_tier','currency_code','price_exact','is_main_unit','stage_payload_hash','stage_sql_hash','native_row_hash']);
export const sourceVersionRowHash=(alias,fields)=>`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${fields.map(f=>`${alias}.${f}`).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
const check=requireRule;
const key=p=>{check(typeof p.sourceKey==='string'&&/^VEGA2026\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(p.sourceKey),'VERSION_SOURCE_KEY');return p.sourceKey;};
export function sourceTypedPrices(product){
 const productSourceKey=key(product),rows=[];
 check(product.unitStatus==='VERIFIED_ADET_FACTOR_1'&&decimal(product.unitFactor)==='1.00000000','VERSION_UNIT_PROOF');
 for(const p of product.prices??[]){
  if(p.price===null&&p.currency===null)continue;
  check(['TRY','USD','EUR'].includes(p.currency)&&p.price!==null,'VERSION_PRICE_CURRENCY');
  check(Number.isInteger(p.tier)&&p.tier>=1&&p.tier<=6&&/^[1-9]\d*$/.test(String(p.unitSourceId)),'VERSION_PRICE_TUPLE');
  const priceExact=decimal(p.price);check(BigInt(priceExact.replace('.',''))>=0n,'VERSION_NEGATIVE_PRICE');
  rows.push({productSourceKey,sourceKey:`${productSourceKey}/PRICE/sale/${p.unitSourceId}/${p.tier}/${p.currency}`,type:'sale',unitSourceId:String(p.unitSourceId),tier:p.tier,currency:p.currency,priceExact,isMainUnit:String(p.unitSourceId)===String(product.mainUnitSourceId)});
 }
 const p=product.purchasePrice;
 if(p&&p.price!==null){check(['TRY','USD','EUR'].includes(p.currency),'VERSION_PURCHASE_CURRENCY');const priceExact=decimal(p.price);check(BigInt(priceExact.replace('.',''))>=0n,'VERSION_NEGATIVE_PRICE');rows.push({productSourceKey,sourceKey:`${productSourceKey}/PRICE/purchase/CARD/0/${p.currency}`,type:'purchase',unitSourceId:null,tier:0,currency:p.currency,priceExact,isMainUnit:false});}
 check(new Set(rows.map(p=>p.sourceKey)).size===rows.length,'VERSION_DUPLICATE_PRICE');return rows;
}
const tuple=p=>JSON.stringify([p.type,p.unitSourceId,p.tier,p.currency]);
export function sourcePriceDelta(before,after){
 const old=new Map(sourceTypedPrices({...before,sourceKey:key(after)}).map(p=>[tuple(p),p])),current=sourceTypedPrices(after),result=[];
 for(const p of current){const prior=old.get(tuple(p));old.delete(tuple(p));if(!prior||prior.priceExact!==p.priceExact)result.push({change:prior?'UPDATE':'INSERT',before:prior??null,after:p});}
 for(const p of old.values())result.push({change:'REMOVE',before:p,after:null});
 return result;
}
// Native costs on an existing card always remain operational truth. Source cost
// changes are evidence metadata; a list purchase price is never a cost witness.
export function sourceNativeCost(product,{existing=false}={}){
 if(existing)return {action:'PRESERVE_NATIVE',value:null};
 if(product.averageCostTry===null)return {action:'INSERT_UNKNOWN',value:null};
 const e=product.costEvidence;
 check(product.costStatus==='LATEST_FINALIZED_NET_PURCHASE_VERIFIED_LINK'&&e&&product.costMethod==='LATEST_FINALIZED_NET_PURCHASE_NOT_MOVING_WEIGHTED_AVERAGE','VERSION_VERIFIED_COST_REQUIRED');
 check(e?.linkBasis==='EXACT_UNIQUE_MODEL_PLUS_SUPPLIER_CODE_AND_EXACT_BRAND'&&/^[1-9]\d*$/.test(String(e.headerSourceId))&&/^[1-9]\d*$/.test(String(e.lineSourceId))&&typeof e.date==='string'&&/^20\d{2}-\d{2}-\d{2}T/.test(e.date)&&['D0007','D0006','D0005','D0004'].includes(e.period),'VERSION_COST_LINK_REQUIRED');
 check(product.costStatus==='LATEST_FINALIZED_NET_PURCHASE_VERIFIED_LINK'&&e?.netVerified===true&&e.unit==='ADET'&&decimal(e.multiplier)==='1.00000000'&&String(e.postedCount)==='1'&&decimal(e.quantity)!==null&&BigInt(decimal(e.quantity).replace('.',''))>0n&&decimal(e.exchangeRate)!==null&&BigInt(decimal(e.exchangeRate).replace('.',''))>0n&&decimal(e.netUnitTry)===decimal(product.averageCostTry)&&product.costMethod==='LATEST_FINALIZED_NET_PURCHASE_NOT_MOVING_WEIGHTED_AVERAGE','VERSION_VERIFIED_COST_REQUIRED');
 const exact8=decimal(product.averageCostTry);check(BigInt(exact8.replace('.',''))>=0n,'VERSION_NEGATIVE_COST');return {action:'INSERT_VERIFIED_SOURCE',value:roundDecimal(exact8,4),exact8,nativeRepresentation:'SQL_DECIMAL_18_4_HALF_AWAY_FROM_ZERO'};
}
export function planSourceVersions(decisions,beforeSources){
 check(Array.isArray(decisions)&&Array.isArray(beforeSources),'VERSION_INPUTS');
 const old=new Map(beforeSources.map(p=>[String(p.sourceId),p])),seen=new Set(),rows=[];
 for(const d of decisions){
  if(d.classification!=='GREEN'||!['NEW','CHANGED'].includes(d.change)||!d.source?.scope?.startsWith('IN_SCOPE'))continue;
  const p=d.source;key(p);check(d.sourcePayloadHash===payloadHash(p),'VERSION_SOURCE_PAYLOAD_HASH');check(!seen.has(p.sourceKey),'VERSION_DUPLICATE_SOURCE');seen.add(p.sourceKey);
  check(!(d.hold??[]).length&&p.unit==='ADET'&&decimal(p.quantity,3)!==null,'VERSION_NOT_SAFE');
  const prior=old.get(String(p.sourceId));check(d.change==='NEW'?!prior&&d.nativeId===null:!!prior&&/^[1-9]\d*$/.test(d.nativeId),'VERSION_NATIVE_IDENTITY');
  const prices=d.change==='NEW'?sourceTypedPrices(p).map(after=>({change:'INSERT',before:null,after})):sourcePriceDelta(prior,p);
  const masterFields=['stockCode','name','brand','category','isActive'].filter(f=>!prior||prior[f]!==p[f]);
  const barcodeChanged=!prior||JSON.stringify(canonicalPayload(prior.barcodes))!==JSON.stringify(canonicalPayload(p.barcodes));
  if(d.change==='CHANGED'&&!prices.length&&!masterFields.length&&!barcodeChanged)continue;
  rows.push({sourceKey:p.sourceKey,sourcePayloadHash:d.sourcePayloadHash,change:d.change,nativeId:d.nativeId,beforeSource:prior??null,afterSource:p,masterFields,prices,barcodeChanged,cost:sourceNativeCost(p,{existing:d.change==='CHANGED'})});
 }
 return {schemaVersion:SOURCE_VERSION_SCHEMA,products:rows,counts:{newProducts:rows.filter(r=>r.change==='NEW').length,changedProducts:rows.filter(r=>r.change==='CHANGED').length,priceInserts:rows.flatMap(r=>r.prices).filter(p=>p.change==='INSERT').length,priceUpdates:rows.flatMap(r=>r.prices).filter(p=>p.change==='UPDATE').length,priceRemovals:rows.flatMap(r=>r.prices).filter(p=>p.change==='REMOVE').length}};
}
export const SOURCE_VERSION_DDL_SQL=`
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51107,'VERSION_WRONG_TEST_TARGET',1;
IF SCHEMA_ID(N'erp_migration') IS NULL THROW 51107,'VERSION_BASELINE_REQUIRED',1;
IF OBJECT_ID(N'erp_migration.goal7_source_version_manifest') IS NULL CREATE TABLE erp_migration.goal7_source_version_manifest(run_id nvarchar(80) NOT NULL PRIMARY KEY,source_hash char(64) NOT NULL,plan_hash char(64) NOT NULL,bindings_hash char(64) NOT NULL,source_as_of nvarchar(40) NOT NULL,product_count int NOT NULL,price_count int NOT NULL,sealed bit NOT NULL CHECK(sealed=1));
IF OBJECT_ID(N'erp_migration.goal7_source_version_products') IS NULL BEGIN
 SELECT TOP(0) b.* INTO erp_migration.goal7_source_version_products FROM erp_migration.accepted_price_products b;
 ALTER TABLE erp_migration.goal7_source_version_products ADD version_run_id nvarchar(80) NOT NULL,lineage_run_id nvarchar(80) NOT NULL,lineage_source_as_of nvarchar(40) NOT NULL,lineage_source_key nvarchar(400) NOT NULL;
 ALTER TABLE erp_migration.goal7_source_version_products ADD CONSTRAINT PK_goal7_source_version_products PRIMARY KEY(version_run_id,product_id);
 CREATE UNIQUE INDEX IX_goal7_source_version_products_source ON erp_migration.goal7_source_version_products(version_run_id,product_source_key);
END;
IF OBJECT_ID(N'erp_migration.goal7_source_version_prices') IS NULL BEGIN
 SELECT TOP(0) v.* INTO erp_migration.goal7_source_version_prices FROM erp_migration.accepted_price_values v;
 ALTER TABLE erp_migration.goal7_source_version_prices ADD version_run_id nvarchar(80) NOT NULL,lineage_run_id nvarchar(80) NOT NULL,lineage_source_key nvarchar(400) NOT NULL;
 ALTER TABLE erp_migration.goal7_source_version_prices ADD CONSTRAINT PK_goal7_source_version_prices PRIMARY KEY(version_run_id,price_id);
 CREATE UNIQUE INDEX IX_goal7_source_version_prices_source ON erp_migration.goal7_source_version_prices(version_run_id,price_source_key);
 CREATE INDEX IX_goal7_source_version_prices_product ON erp_migration.goal7_source_version_prices(version_run_id,product_id);
END;
IF OBJECT_ID(N'erp_migration.goal7_source_version_records') IS NULL CREATE TABLE erp_migration.goal7_source_version_records(run_id nvarchar(80) NOT NULL,entity nvarchar(40) NOT NULL,source_key nvarchar(400) NOT NULL,payload_hash char(64) NOT NULL,payload_json nvarchar(max) NOT NULL,CONSTRAINT PK_goal7_source_version_records PRIMARY KEY NONCLUSTERED(run_id,entity,source_key));`;
export function sourceVersionImmutableSql(table){
 check(Object.values(SOURCE_VERSION_TABLES).includes(table),'VERSION_TABLE_REQUIRED');const name=table.split('.')[1];
 // Installed only after the first version transaction seals its rows. Subsequent
 // versions insert rows for another run; existing rows never mutate.
 const insertionCheck=name==='goal7_source_version_manifest'?'':name==='goal7_source_version_records'?`IF EXISTS(SELECT 1 FROM inserted i JOIN erp_migration.goal7_source_version_manifest m ON m.run_id=i.run_id WHERE m.sealed=1) THROW 51107,'VERSION_SEALED',1;`:`IF EXISTS(SELECT 1 FROM inserted i JOIN erp_migration.goal7_source_version_manifest m ON m.run_id=i.version_run_id WHERE m.sealed=1) THROW 51107,'VERSION_SEALED',1;`;
 return `CREATE TRIGGER erp_migration.immutable_${name} ON ${table} AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;IF EXISTS(SELECT 1 FROM deleted) THROW 51107,'VERSION_IMMUTABLE',1;${insertionCheck}END`;
}
export function sourceVersionClassificationIndex({context,products,records,holds}){
 check(context?.productCount===16671&&products.length===context.productCount&&Array.isArray(records)&&Array.isArray(holds),'VERSION_INDEX_INPUTS');
 const byRecord=new Map(records.map(r=>[JSON.stringify([r.run_id,r.entity,r.source_key]),r]));check(byRecord.size===records.length,'VERSION_DUPLICATE_RECORD');
 const nullable=v=>{check(v===null||typeof v==='string','VERSION_INDEX_TEXT');return v===null||!v.trim()?null:v;};
 const entries=products.map(p=>{
  check(p.version_run_id===context.runId,'VERSION_INDEX_RUN');
  const r=byRecord.get(JSON.stringify([p.lineage_run_id,'products',p.lineage_source_key]));check(r&&r.payload_hash.toUpperCase()===p.stage_payload_hash.toUpperCase()&&sourceVersionSqlHash(r.payload_json)===p.stage_sql_hash.toUpperCase(),'VERSION_INDEX_STAGE_HASH');
  const data=JSON.parse(r.payload_json);check(data.stock_code===p.stock_code&&data.name===p.product_name,'VERSION_INDEX_NATIVE_IDENTITY');
  return {productId:String(p.product_id),stockCode:p.stock_code,sourceKey:p.product_source_key,kind:'accepted-opening',brand:nullable(data.brand),productType:nullable(data.category),sourceName:nullable(data.name),stagePayloadHash:p.stage_payload_hash,stageSqlHash:p.stage_sql_hash,lineageRunId:p.lineage_run_id,sourceAsOf:p.lineage_source_as_of};
 });
 const held=holds.filter(h=>h.entity==='product');check(held.length===54,'VERSION_HOLD_SCOPE');
 entries.push(...held.map(h=>({productId:String(h.native_id),stockCode:h.native_code,sourceKey:h.source_key,kind:'quarantined-source',brand:null,productType:null,sourceName:null,stagePayloadHash:null,stageSqlHash:null,lineageRunId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'})));
 check(new Set(entries.map(e=>e.productId)).size===entries.length&&new Set(entries.map(e=>e.sourceKey)).size===entries.length,'VERSION_INDEX_DUPLICATE');
 return {schemaVersion:'melisa-erp.catalog-classification.v2',server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',runId:context.runId,sourceAsOf:context.sourceAsOf,sourceHash:context.sourceHash,entries};
}
function bindingSqlJson(row,fields){
 const numeric=new Set(['product_id','price_id','main_unit_source_id','source_unit_id','price_tier','price_exact']);
 return '{'+fields.map(k=>{
  const value=row[k];check(value!==undefined,'VERSION_BINDING_FIELD_REQUIRED');
  let encoded;if(value===null)encoded='null';else if(numeric.has(k)){encoded=String(value);check(/^-?\d+(\.\d+)?$/.test(encoded),'VERSION_BINDING_NUMERIC');}else encoded=JSON.stringify(value).replaceAll('/','\\/');
  return JSON.stringify(k)+':'+encoded;
 }).join(',')+'}';
}
export const sourceVersionBindingHash=(row,fields)=>sourceVersionSqlHash(bindingSqlJson(row,fields));
const cleanRow=row=>Object.fromEntries(Object.entries(row).filter(([k])=>k!=='__row_hash'));
export function buildResolvedSourceVersion({context,baselineProducts,baselinePrices,baselineRecords,changes,nativeBindings}){
 check(context&&/^GOAL7-/.test(context.runId)&&Array.isArray(changes)&&nativeBindings&&Array.isArray(nativeBindings.products)&&Array.isArray(nativeBindings.prices),'VERSION_RESOLVED_INPUTS');
 const products=new Map(baselineProducts.map(p=>[String(p.product_id),{...cleanRow(p),version_run_id:context.runId,lineage_run_id:'VEGA-OPENING-TEST-20261004-06',lineage_source_as_of:'2026-09-30',lineage_source_key:p.product_source_key}]));
 const prices=new Map(baselinePrices.map(p=>[String(p.price_id),{...cleanRow(p),version_run_id:context.runId,lineage_run_id:'VEGA-OPENING-TEST-20261004-06',lineage_source_key:p.price_source_key}]));
 const records=new Map(baselineRecords.map(r=>[JSON.stringify([r.run_id,r.entity,r.source_key]),cleanRow(r)]));
 const addRecord=(entity,sourceKey,payload)=>{const payload_json=JSON.stringify(payload),record={run_id:context.runId,entity,source_key:sourceKey,payload_hash:sourceVersionHash(payload_json),payload_json};const k=JSON.stringify([record.run_id,entity,sourceKey]);check(!records.has(k),'VERSION_RECORD_REPLAY_CONFLICT');records.set(k,record);return record;};
 for(const change of changes){
  const source=change.afterSource,sourceId=String(source.sourceId),nativeKey='VEGA2026/F0102TBLSTOKLAR/'+sourceId; // Public Vega source key, no credential; gitleaks:allow
  const targets=nativeBindings.products.filter(p=>p.source_record_key===nativeKey);check(targets.length===1,'VERSION_NATIVE_PRODUCT_SINGLETON');const native=targets[0],productId=String(native.id),old=products.get(productId);
  check(change.change==='NEW'?!old:old&&productId===change.nativeId,'VERSION_RESOLVED_IDENTITY');
  check(native.stock_code===source.stockCode&&native.name===source.name&&native.brand===source.brand&&native.category===source.category&&native.unit==='ADET','VERSION_RESOLVED_NATIVE_MASTER');
  const canonicalKey=old?.product_source_key??source.sourceKey;
  const stage=addRecord('products',source.sourceKey,{source_key:source.sourceKey,source_id:sourceId,stock_code:source.stockCode,name:source.name,brand:source.brand,category:source.category,unit:source.unit,is_active:source.isActive,quantity:decimal(source.quantity),average_cost_try:source.averageCostTry,cost_status:source.costStatus,source_payload_hash:sourceVersionHash(JSON.stringify(source)),source_payload_json:JSON.stringify(source)});
  const product={product_id:productId,product_source_key:canonicalKey,source_id:sourceId,native_source_key:nativeKey,stock_code:native.stock_code,product_name:native.name,currency_code:native.currency_code,unit:native.unit,main_unit_source_id:String(source.mainUnitSourceId),price_count:0,stage_payload_hash:stage.payload_hash,stage_sql_hash:sourceVersionSqlHash(stage.payload_json),binding_hash:'',version_run_id:context.runId,lineage_run_id:context.runId,lineage_source_as_of:context.sourceAsOf,lineage_source_key:source.sourceKey};
  products.set(productId,product);
  for(const operation of change.prices){
   check(operation.change!=='REMOVE','VERSION_PRICE_REMOVE_REQUIRES_DESIGN');const p=operation.after;
   const matches=nativeBindings.prices.filter(n=>String(n.product_id)===productId&&n.price_type===p.type&&String(n.source_unit_id??'CARD')===String(p.unitSourceId??'CARD')&&Number(n.price_tier)===p.tier&&n.currency_code===p.currency&&decimal(String(n.price))===p.priceExact);
   check(matches.length===1,'VERSION_NATIVE_PRICE_SINGLETON');const n=matches[0],priceId=String(n.id),prior=prices.get(priceId);check(operation.change==='INSERT'?!prior:!!prior&&String(prior.product_id)===productId,'VERSION_NATIVE_PRICE_OPERATION');
   const nativeHash=n.__row_hash??n.native_row_hash;check(typeof nativeHash==='string'&&/^[a-f0-9]{64}$/i.test(nativeHash),'VERSION_NATIVE_PRICE_SQL_HASH_REQUIRED');
   const record=addRecord('prices',p.sourceKey,{source_key:p.sourceKey,product_source_key:source.sourceKey,unit_source_id:p.unitSourceId,price_type:p.type,tier:p.tier,currency_code:p.currency,price:p.priceExact,price_status:'SOURCE'});
   const price={price_id:priceId,product_id:productId,product_source_key:canonicalKey,price_source_key:prior?.price_source_key??`${canonicalKey}/PRICE/${p.type}/${p.unitSourceId??'CARD'}/${p.tier}/${p.currency}`,source_unit_id:p.unitSourceId,price_type:p.type,price_tier:p.tier,currency_code:p.currency,price_exact:p.priceExact,is_main_unit:p.isMainUnit,stage_payload_hash:record.payload_hash,stage_sql_hash:sourceVersionSqlHash(record.payload_json),native_row_hash:nativeHash.toUpperCase(),binding_hash:'',version_run_id:context.runId,lineage_run_id:context.runId,lineage_source_key:p.sourceKey};
   price.binding_hash=sourceVersionBindingHash(price,SOURCE_VERSION_PRICE_FIELDS);prices.set(priceId,price);
  }
  product.price_count=[...prices.values()].filter(p=>String(p.product_id)===productId).length;product.binding_hash=sourceVersionBindingHash(product,SOURCE_VERSION_PRODUCT_FIELDS);
 }
 const ordered=(items,id)=>[...items.values()].sort((a,b)=>BigInt(a[id])<BigInt(b[id])?-1:BigInt(a[id])>BigInt(b[id])?1:0),productRows=ordered(products,'product_id'),priceRows=ordered(prices,'price_id');
 check(productRows.length===context.productCount&&priceRows.length===context.priceCount,'VERSION_RESOLVED_COUNTS');
 const bindingsHash=sourceVersionHash({products:productRows.map(p=>({product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_as_of:p.lineage_source_as_of,lineage_source_key:p.lineage_source_key})),prices:priceRows.map(p=>({price_id:p.price_id,product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_key:p.lineage_source_key}))});
 return {products:productRows,prices:priceRows,records:[...records.values()],bindingsHash};
}
