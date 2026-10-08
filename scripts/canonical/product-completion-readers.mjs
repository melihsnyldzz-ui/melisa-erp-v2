// Additive dated TEST readers. The historical opening and Goal7 remain sealed.
import {buildSourceVersionReaders,validateSourceCatalogContext} from './goal7-source-catalog-readers.mjs';
import {sourceVersionSqlHash,SOURCE_VERSION_PRODUCT_FIELDS,SOURCE_VERSION_PRICE_FIELDS,sourceVersionBindingHash} from '../migration/goal7-source-version.mjs';
import {validateCurrentProductCatalogContext} from '../../apps/api/src/services/currentProductCatalogContext.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const lit=v=>"N'"+String(v).replaceAll("'","''")+"'";
const hashKeys={catalog:'readerDefinitionHash',stock:'stockReaderDefinitionHash',detail:'openingDetailDefinitionHash',list:'openingListDefinitionHash'};
const inheritedPayloadScalar="JSON_VALUE(r.payload_json,'$.source_payload_json')";
const maxPayloadScalar="(SELECT nested_source.source_payload_json FROM OPENJSON(r.payload_json) WITH(source_payload_json nvarchar(max) '$.source_payload_json') nested_source)";
const inheritedTimestamp="CONVERT(varchar(23),CAST(SYSUTCDATETIME() AS datetime2(3)),126)+N'Z'";
const canonicalTimestamp="REPLACE(CONVERT(varchar(23),CAST(SYSUTCDATETIME() AS datetime2(3)),121),' ','T')+N'Z'";
export function productPayloadReaderRevision2(sql,kind){
 check(typeof sql==='string'&&['catalog','stock'].includes(kind),'PRODUCT_PAYLOAD_REVISION_KIND');
 // All eight inherited reads (two binding checks and six unit presentation
 // reads) must advance together. A changed template cannot silently skip one.
 check(sql.split(inheritedPayloadScalar).length-1===8&&sql.split("'$.source_payload_json'").length-1===8,'PRODUCT_PAYLOAD_REVISION_TEMPLATE');
 const revised=sql.replaceAll(inheritedPayloadScalar,maxPayloadScalar);
 check(!revised.includes(inheritedPayloadScalar)&&revised.split(maxPayloadScalar).length-1===8,'PRODUCT_PAYLOAD_REVISION_INCOMPLETE');
 return revised;
}
export function productTimestampReaderRevision3(sql,kind){
 check(typeof sql==='string'&&['catalog','stock'].includes(kind),'PRODUCT_TIMESTAMP_REVISION_KIND');
 check(sql.split(inheritedTimestamp).length-1===1&&sql.split('@read_at varchar(24)=').length-1===1,'PRODUCT_TIMESTAMP_REVISION_TEMPLATE');
 const revised=sql.replace(inheritedTimestamp,canonicalTimestamp);
 check(!revised.includes(inheritedTimestamp)&&revised.split(canonicalTimestamp).length-1===1,'PRODUCT_TIMESTAMP_REVISION_INCOMPLETE');
 return revised;
}
export function buildProductCompletionReaders({context,baselineContext}){
 validateSourceCatalogContext(baselineContext);
 const old=buildSourceVersionReaders(baselineContext),suffix=context.runId.replaceAll('-','_').toLowerCase()+([2,3].includes(context.readerRevision)?'_r'+context.readerRevision:'');
 const procedures={catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`};
 const placeholders=Object.fromEntries(Object.values(hashKeys).map(k=>[k,'0'.repeat(64)]));
 validateCurrentProductCatalogContext({...context,...placeholders,procedures});
 const ancestry=JSON.stringify(context.ancestry),readers={};
 for(const kind of Object.keys(procedures)){
  const base=old[kind];let sql=base.sql.replaceAll(base.procedure,procedures[kind]);
  for(const k of ['runId','sourceHash','planHash','bindingsHash','sourceAsOf'])sql=sql.replaceAll(lit(baselineContext[k]),lit(context[k]));
  // These counts occur only in the newer sealed version and classification
  // scope. The historical 16,622/63,774 checks are deliberately unchanged.
  const countMap=new Map([[String(baselineContext.productCount),String(context.productCount)],[String(baselineContext.priceCount),String(context.priceCount)],[String(baselineContext.productCount+54),String(context.productCount+54)]]);
  sql=sql.replace(new RegExp('\\b(?:'+[...countMap.keys()].join('|')+')\\b','g'),value=>countMap.get(value));
  sql=sql.replaceAll(`lineage_run_id NOT IN(N'VEGA-OPENING-TEST-20261004-06',${lit(context.runId)})`,`lineage_run_id NOT IN(${context.ancestry.map(a=>lit(a.runId)).join(',')})`);
  sql=sql.replaceAll(`b.lineage_source_as_of<>CASE WHEN b.lineage_run_id=${lit(context.runId)} THEN ${lit(context.sourceAsOf)} ELSE N'2026-09-30' END`,`NOT EXISTS(SELECT 1 FROM OPENJSON(${lit(ancestry)}) WITH(runId nvarchar(80),sourceAsOf nvarchar(40)) anc WHERE anc.runId=b.lineage_run_id AND anc.sourceAsOf=b.lineage_source_as_of)`);
  sql=sql.replaceAll(`lineage_run_id=${lit(context.runId)} THEN N'VEGA2026/F0102/TBLSTOKLAR/'`,`lineage_run_id<>N'VEGA-OPENING-TEST-20261004-06' THEN N'VEGA2026/F0102/TBLSTOKLAR/'`);
  sql=sql.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE PROCEDURE ');
  if(kind==='catalog'){
   const oldCode='CONVERT(varbinary(max),old.stock_code)=CONVERT(varbinary(max),p.stock_code)';
   const oldMediaCode='CONVERT(varbinary(max),old_media.stock_code)=CONVERT(varbinary(max),p.stock_code)';
   const photoIdentity='EXISTS(SELECT 1 FROM erp_migration.accepted_price_products old_photo WHERE old_photo.product_id=p.id AND old_photo.source_id=b.source_id AND CONVERT(varbinary(max),old_photo.native_source_key)=CONVERT(varbinary(max),p.source_record_key) AND CONVERT(varbinary(max),old_photo.stock_code)=CONVERT(varbinary(max),m.stock_code) AND CONVERT(varbinary(max),old_photo.product_source_key)=CONVERT(varbinary(max),m.source_key))';
   check(sql.includes(oldCode)&&sql.includes(oldMediaCode),'PRODUCT_MEDIA_IDENTITY_TEMPLATE');
   sql=sql.replaceAll(oldCode,'CONVERT(varbinary(max),old.native_source_key)=CONVERT(varbinary(max),p.source_record_key) AND old.source_id=b.source_id')
    .replaceAll(oldMediaCode,'CONVERT(varbinary(max),old_media.native_source_key)=CONVERT(varbinary(max),p.source_record_key) AND old_media.source_id=b.source_id')
    .replaceAll('CONVERT(varbinary(max),m.stock_code)=CONVERT(varbinary(max),p.stock_code)',photoIdentity)
    .replaceAll('CONVERT(varbinary(max),m.stock_code)=CONVERT(varbinary(max),b.stock_code)',photoIdentity);
  }
  // Like the existing catalog reader, the companion executes its sealed SQL
  // metadata checks as owner. Only the two existing TEST service principals
  // receive EXECUTE; application user permissions remain unchanged.
  if(kind==='detail'||kind==='list'){
   check(sql.includes(' AS BEGIN SET NOCOUNT ON;')&&!sql.includes('WITH EXECUTE AS OWNER'),'PRODUCT_PRICE_EXECUTION_TEMPLATE');
   sql=sql.replace(' AS BEGIN SET NOCOUNT ON;',' WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;');
  }
  if([2,3].includes(context.readerRevision)&&(kind==='catalog'||kind==='stock'))sql=productPayloadReaderRevision2(sql,kind);
  if(context.readerRevision===3&&(kind==='catalog'||kind==='stock'))sql=productTimestampReaderRevision3(sql,kind);
  check(sql.startsWith('CREATE PROCEDURE '+procedures[kind])&&sql.includes('MELISA_ERP_SIRKET_TEST_20260929_01')&&sql.includes('product_count=16622 AND price_count=63774'),'PRODUCT_READER_HISTORICAL_PIN');
  check(sql.includes('product_count='+context.productCount+' AND price_count='+context.priceCount)&&sql.includes('r.run_id=b.lineage_run_id')&&sql.includes('r.run_id=v.lineage_run_id'),'PRODUCT_READER_SEALED_LINEAGE');
  readers[kind]={procedure:procedures[kind],sql,definitionHash:sourceVersionSqlHash(sql),storedDefinition:sql};
 }
 const result=validateCurrentProductCatalogContext({...context,procedures,...Object.fromEntries(Object.entries(hashKeys).map(([kind,key])=>[key,readers[kind].definitionHash]))});
 return {context:result,readers};
}
export function buildProductCompletionClassification({context,version,holds}){
 validateCurrentProductCatalogContext(context);
 check(version.products.length===context.productCount&&version.prices.length===context.priceCount&&version.bindingsHash===context.bindingsHash,'PRODUCT_CLASSIFICATION_COUNTS');
 const records=[...version.ancestryRecords,...version.newRecords],lookup=new Map(records.map(r=>[JSON.stringify([r.run_id,r.entity,r.source_key]),r]));
 check(lookup.size===records.length,'PRODUCT_CLASSIFICATION_RECORD_DUPLICATE');
 for(const [rows,fields] of [[version.products,SOURCE_VERSION_PRODUCT_FIELDS],[version.prices,SOURCE_VERSION_PRICE_FIELDS]])for(const r of rows)check(r.version_run_id===context.runId&&sourceVersionBindingHash(r,fields)===r.binding_hash.toUpperCase(),'PRODUCT_CLASSIFICATION_BINDING');
 const nullable=v=>{check(v===null||typeof v==='string','PRODUCT_CLASSIFICATION_TEXT');return v===null||!v.trim()?null:v;};
 const entries=version.products.map(p=>{
  check(context.ancestry.some(a=>a.runId===p.lineage_run_id&&a.sourceAsOf===p.lineage_source_as_of),'PRODUCT_CLASSIFICATION_ANCESTRY');
  const r=lookup.get(JSON.stringify([p.lineage_run_id,'products',p.lineage_source_key]));
  check(r&&r.payload_hash.toUpperCase()===p.stage_payload_hash.toUpperCase()&&sourceVersionSqlHash(r.payload_json)===p.stage_sql_hash.toUpperCase(),'PRODUCT_CLASSIFICATION_STAGE');
  const data=JSON.parse(r.payload_json);check(data.stock_code===p.stock_code&&data.name===p.product_name,'PRODUCT_CLASSIFICATION_MASTER');
  return {productId:String(p.product_id),stockCode:p.stock_code,sourceKey:p.product_source_key,kind:'accepted-opening',brand:nullable(data.brand),productType:nullable(data.category),sourceName:nullable(data.name),stagePayloadHash:p.stage_payload_hash,stageSqlHash:p.stage_sql_hash,lineageRunId:p.lineage_run_id,sourceAsOf:p.lineage_source_as_of};
 });
 const held=holds.filter(h=>h.entity==='product');check(held.length===54,'PRODUCT_CLASSIFICATION_HOLD_SCOPE');
 entries.push(...held.map(h=>({productId:String(h.native_id),stockCode:h.native_code,sourceKey:h.source_key,kind:'quarantined-source',brand:null,productType:null,sourceName:null,stagePayloadHash:null,stageSqlHash:null,lineageRunId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'})));
 check(new Set(entries.map(e=>e.productId)).size===entries.length&&new Set(entries.map(e=>e.sourceKey)).size===entries.length,'PRODUCT_CLASSIFICATION_DUPLICATE');
 return {schemaVersion:'melisa-erp.catalog-classification.v2',server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',runId:context.runId,sourceAsOf:context.sourceAsOf,sourceHash:context.sourceHash,entries};
}
