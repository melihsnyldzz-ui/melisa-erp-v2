// Pure, isolated SQL-engine rehearsal planning. No connections, I/O or execution.
import {hash} from '../migration/party-currency-readonly-plan.mjs';
import {sourceVersionHash,sourceVersionSqlHash,sourceVersionBindingHash,SOURCE_VERSION_PRODUCT_FIELDS as PF,SOURCE_VERSION_PRICE_FIELDS as VF,SOURCE_VERSION_TABLES,sourceVersionImmutableSql} from '../migration/goal7-source-version.mjs';
import {buildFinalPriceReaders,buildFinalPriceSnapshot,finalPriceSnapshotHash,validateFinalPriceBaseline} from '../migration/final-cutover-price-reader.mjs';
import {buildFinalCutoverPlan,captureRowsHash} from '../migration/final-cutover-plan.mjs';
import {STOCK_PRODUCT_RUNTIME_READY_SQL,STOCK_PRODUCT_STORED_DEFINITION,STOCK_PRODUCT_SQL_PROOF} from './enable-test-stock-products.mjs';
import {CATALOG_STOCK_PIN_SQL,CATALOG_INDEX_INSTALL_SQL} from './enable-test-work-catalog.mjs';
import {SUPPLIER_CARD_READY_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
import {SUPPLIER_CARD_PRESERVED_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
export const FINAL_READER_FIXTURE_SCHEMAS=Object.freeze({nativeSchema:'final_cutover_fixture_reader_n',journalSchema:'final_cutover_fixture_reader_j'});
const opening='VEGA-OPENING-TEST-20261004-06',goal7='GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d';
const check=(v,c)=>{if(!v)throw Error(c);},hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v),ident=v=>{check(/^[A-Za-z_][A-Za-z0-9_]*$/.test(v),'FULL_FIXTURE_IDENTIFIER');return '['+v+']';},lit=v=>"N'"+String(v).replaceAll("'","''")+"'";
const tableKey=t=>t.schema+'.'+t.name;
const bindings=(products,prices)=>sourceVersionHash({products:products.map(p=>({product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_as_of:p.lineage_source_as_of,lineage_source_key:p.lineage_source_key})),prices:prices.map(p=>({price_id:p.price_id,product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_key:p.lineage_source_key}))});
const jsonSql=v=>JSON.stringify(v).replaceAll('/','\\/');
// Typed FOR JSON serialization: bigint literals stay exact, not JS Number.
const orderedSqlJson=(row,fields,numeric=new Set())=>'{'+fields.map(k=>JSON.stringify(k)+':'+(row[k]===null?'null':numeric.has(k)?String(row[k]):jsonSql(row[k]))).join(',')+'}';
const holdFields=['entity','source_key','source_id','source_company','source_code','source_name','native_id','native_entity_id','native_source_key','native_code','native_name','status','reasons_json','binding_basis'];
// Rehearse only the new FINAL reader body. The unchanged historical readiness
// block is an accepted baseline dependency, recorded by exact hash and omitted
// from this explicitly instrumented fixture, never from production readers.
export function compileGoal8FinalReaderDeltaFixture({publication,baselineContext,namespace=FINAL_READER_FIXTURE_SCHEMAS}){
 const ns=schemas(namespace),built=buildFinalPriceReaders({publication,baselineContext}),map=s=>s.replaceAll('erp_migration.',ns.journalSchema+'.').replaceAll('dbo.',ns.nativeSchema+'.'),guards=Object.values(SOURCE_VERSION_TABLES).map(table=>({sourceObject:'erp_migration.immutable_'+table.split('.')[1],object:ns.journalSchema+'.immutable_'+table.split('.')[1],sql:map(sourceVersionImmutableSql(table))}));
 for(const g of guards)g.definitionHash=sourceVersionSqlHash(g.sql);
 const baselineReader={procedure:ns.nativeSchema+'.usp_read_stock_products',sql:map(STOCK_PRODUCT_STORED_DEFINITION),sourceDefinitionHash:sourceVersionSqlHash(STOCK_PRODUCT_STORED_DEFINITION)};check(baselineReader.sourceDefinitionHash===STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash,'DELTA_FIXTURE_ACCEPTED_STOCK_SOURCE_PIN');baselineReader.definitionHash=sourceVersionSqlHash(baselineReader.sql);
 const indexInstallSql='DECLARE @index_writes int=0;'+map(CATALOG_INDEX_INSTALL_SQL);
 const readers={},omissions=[];
 for(const [kind,r]of Object.entries(built.readers)){
  let sql=r.sql,old;
  if(kind==='catalog')old=STOCK_PRODUCT_RUNTIME_READY_SQL.replace(SUPPLIER_CARD_READY_SQL,'');
  else if(kind==='stock')old=STOCK_PRODUCT_RUNTIME_READY_SQL;
  else {const a=sql.indexOf(' AS BEGIN SET NOCOUNT ON;')+' AS BEGIN SET NOCOUNT ON;'.length,b=sql.indexOf(' DECLARE @classification_validation bit=0;',a);check(a>25&&b>a,'DELTA_FIXTURE_OPENING_READY_BOUNDARY');old=sql.slice(a,b);}
  check(old.length>100&&sql.split(old).length===2,'DELTA_FIXTURE_ACCEPTED_READY_EXACT');omissions.push({kind,sourceHash:sourceVersionSqlHash(old),bytes:old.length,reason:'UNCHANGED_ACCEPTED_HISTORICAL_BASELINE'});
  sql=sql.replace(old,'/* fixture: accepted historical readiness omitted; FINAL checks retained */');
  if(kind==='catalog'){check(sql.split(CATALOG_STOCK_PIN_SQL).length===2,'DELTA_FIXTURE_ACCEPTED_STOCK_PIN_EXACT');sql=sql.replace(CATALOG_STOCK_PIN_SQL,CATALOG_STOCK_PIN_SQL.replace(STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash,baselineReader.definitionHash));}
  for(const [i,table]of Object.values(SOURCE_VERSION_TABLES).entries())sql=sql.replaceAll(sourceVersionSqlHash(sourceVersionImmutableSql(table)),guards[i].definitionHash);
  sql=map(sql);const storedDefinition=sql.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE ');
  check(!/\b(?:dbo|erp_migration)\./.test(sql),'DELTA_FIXTURE_UNMAPPED_REFERENCE');readers[kind]={...r,procedure:map(r.procedure),sql,storedDefinition,definitionHash:sourceVersionSqlHash(storedDefinition)};
 }
 const tables=[...new Set(Object.values(readers).flatMap(r=>[...r.sql.matchAll(new RegExp('(?:'+ns.nativeSchema+'|'+ns.journalSchema+')\\.([A-Za-z_][A-Za-z0-9_]*)','g'))].map(m=>m[0])).filter(n=>!n.includes('.usp_')&&!n.includes('.immutable_')))];
 return {fixtureOnly:true,deltaOnly:true,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,historicalReadinessReproved:false,normalReaderSqlEngineProved:false,namespace:ns,readers,guards,baselineReader,indexInstallSql,requiredTables:tables,acceptedBaselineOmissions:omissions,productionContext:built.context,contractHash:hash({readers:Object.values(readers).map(r=>({procedure:r.procedure,definitionHash:r.definitionHash})),guards,omissions,baselineReader,indexInstallSql})};
}
export function buildGoal8FullSyntheticReaderData(){
 const products=[],prices=[],records=[],nativeProducts=[],nativePrices=[],aliases=[],holds=[];
 let priceId=1000000;
 for(let n=0;n<16671;n++){
  const id=String(100000+n),sourceId=String(500000+n),run=n<61?goal7:opening,prefix=run===goal7?'VEGA2026':'VEGA_CAPTURE_20260930_01',key=prefix+'/F0102/TBLSTOKLAR/'+sourceId,code=String(n).padStart(6,'0')+' FIXTURE'; // gitleaks:allow anonymous synthetic identities
  const original={mainUnitSourceId:'1',unitStatus:'VERIFIED_ADET_FACTOR_1',unitFactor:'1.00000000',unit:'ADET'},payload_json=JSON.stringify({source_key:key,stock_code:code,name:'Anonymous '+n,brand:'FIXTURE',category:'TYPE',source_payload_json:JSON.stringify(original),fixtureOrigin:n<49?'NEW':n<61?'MASTER':'OPENING'}),r={run_id:run,entity:'products',source_key:key,payload_json,payload_hash:sourceVersionHash(payload_json)};records.push(r);
  const p={product_id:id,product_source_key:key,source_id:sourceId,native_source_key:prefix+'/F0102TBLSTOKLAR/'+sourceId,stock_code:code,product_name:'Anonymous '+n,currency_code:'USD',unit:'ADET',main_unit_source_id:'1',price_count:0,stage_payload_hash:r.payload_hash,stage_sql_hash:sourceVersionSqlHash(payload_json),version_run_id:goal7,lineage_run_id:run,lineage_source_as_of:run===goal7?'2026-10-07':'2026-09-30',lineage_source_key:key};
  nativeProducts.push({id,stock_code:code,name:p.product_name,brand:'FIXTURE',category:'TYPE',currency_code:'USD',unit:'ADET',current_stock_qty:'1.000',average_cost_try:null,is_active:true,is_deleted:false,source_record_key:p.native_source_key,migration_run_id:run});aliases.push({id:String(200000+n),product_id:id,source_product_id:sourceId});
  // 49 NEW cards, 12 MASTER changes. Historical products exclude the NEW49.
  // Only one NEW card has a price; historical16622 own exactly63774 prices.
  const tiers=n===0?1:n<49?0:4;
  for(let tier=1;tier<=tiers&&prices.length<63775;tier++){
   const value=n===49&&tier===1?'0.00000000':'9.00000000',priceKey=key+'/PRICE/sale/1/'+tier+'/USD',payload=JSON.stringify({source_key:priceKey,price:value}),stage={run_id:run,entity:'prices',source_key:priceKey,payload_json:payload,payload_hash:sourceVersionHash(payload)};records.push(stage);
   const v={price_id:String(priceId++),product_id:id,product_source_key:key,price_source_key:priceKey,source_unit_id:'1',price_type:'sale',price_tier:tier,currency_code:'USD',price_exact:value,is_main_unit:true,stage_payload_hash:stage.payload_hash,stage_sql_hash:sourceVersionSqlHash(payload),native_row_hash:null,version_run_id:goal7,lineage_run_id:run,lineage_source_key:priceKey};prices.push(v);p.price_count++;
   nativePrices.push({id:v.price_id,product_id:id,source_unit_id:'1',price_type:'sale',price_tier:tier,currency_code:'USD',price:value});
  }p.binding_hash=sourceVersionBindingHash(p,PF);products.push(p);
 }
 for(let n=0;n<176;n++){
  const product=n<54,missing=n>=172,id=missing?null:String(800000+n),sourceId=String(900000+n),entity=product?'product':'supplier',key='VEGA_CAPTURE_20260930_01/'+(product?'F0102/TBLSTOKLAR/':'F0103/TBLCARI/')+sourceId,code='HOLD-'+n,name='Anonymous hold '+n; // gitleaks:allow anonymous synthetic identities
  const h={entity,source_key:key,source_id:sourceId,source_company:product?'F0102':'F0103',source_code:code,source_name:name,native_id:id,native_entity_id:null,native_source_key:missing?null:key.replace('/TBL','TBL'),native_code:missing?null:code,native_name:missing?null:name,status:missing?'not_present':'blocked',reasons_json:'["SYNTHETIC_HOLD"]',binding_basis:'SYNTHETIC_NATIVE_SQL'};h.row_hash=sourceVersionSqlHash(orderedSqlJson(h,holdFields,new Set(['native_id','native_entity_id'])));holds.push(h);
  if(product){nativeProducts.push({id,stock_code:code,name,currency_code:'TRY',unit:'ADET',current_stock_qty:'0.000',average_cost_try:null,is_active:true,is_deleted:false,source_record_key:h.native_source_key,migration_run_id:opening});aliases.push({id:String(900000+n),product_id:id,source_product_id:sourceId});}
 }
 for(const [id,stock_code,supplier_id]of [['301984','TEST-V70-20260929-P',null],['301985','TEST-V70-GOODS-P',null],['301986','TEST-DAILY-PURCHASE','13373']])nativeProducts.push({id,stock_code,name:'Anonymous TEST',supplier_id,unit:'ADET',currency_code:'TRY',current_stock_qty:'0.000',average_cost_try:null,is_active:true,is_deleted:false,source_record_key:null,migration_run_id:null});
 // Existing Goal7 representation excludes empty NULL price/currency slots.
 // Keep a genuine native NULL outside sealed typed rows; never coerce to zero.
 nativePrices.push({id:'9999999',product_id:'301984',source_unit_id:null,price_type:'purchase',price_tier:0,currency_code:null,price:null});
 const supplierRecords=Array.from({length:998},(_,n)=>{const source_key='SYNTHETIC/SUPPLIER/'+n,payload_json=JSON.stringify({role:'supplier',name:'Anonymous supplier '+n,synthetic:true});return {run_id:opening,entity:n%2?'accounts':'parties',source_key,payload_json,payload_hash:sourceVersionHash(payload_json)};}); // gitleaks:allow anonymous synthetic source identifier
 const sortedSupplier=[...supplierRecords].sort((a,b)=>a.entity.localeCompare(b.entity,'en')||a.source_key.localeCompare(b.source_key,'en'));
 const supplierStageHash=sourceVersionSqlHash(sortedSupplier.map(r=>[r.entity,r.source_key,r.payload_hash,sourceVersionSqlHash(r.payload_json)].join('|')).join(';'));
 const holdSealHash=sourceVersionSqlHash('['+[...holds].sort((a,b)=>a.source_key.localeCompare(b.source_key,'en')).map(h=>orderedSqlJson(h,['source_key','row_hash'])).join(',')+']').toLowerCase();
 const sourceHash=hash({nativeProducts,nativePrices,records,holds,supplierRecords}),planHash=hash({sourceHash,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false});
 return {fixtureOnly:true,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,ancestralLabelsOnly:true,sourceHash,planHash,products,prices,records,nativeProducts,nativePrices,aliases,holds,supplierRecords,holdSealHash,supplierStageHash};
}
// Call only after read-only SQL native row-hash readback of the synthetic clone.
// It rejects made-up/missing hashes and does not learn expected procedure pins.
export function sealGoal8FullSyntheticReaderBaseline(data,nativeWitnesses){
 check(data?.fixtureOnly===true&&data.evidenceKind==='SYNTHETIC_NATIVE_SQL'&&data.actualT1===false,'FULL_FIXTURE_DATA');
 check(Array.isArray(nativeWitnesses)&&nativeWitnesses.length===data.nativePrices.length,'FULL_FIXTURE_NATIVE_COUNT');const byId=new Map(nativeWitnesses.map(n=>[String(n.id),n]));check(byId.size===nativeWitnesses.length,'FULL_FIXTURE_NATIVE_DUPLICATE');
 const nullSlot=byId.get('9999999');check(nullSlot&&sourceVersionSqlHash(nullSlot.nativeJSON)===nullSlot.nativeRowHash.toUpperCase()&&JSON.parse(nullSlot.nativeJSON).price===null&&JSON.parse(nullSlot.nativeJSON).currency_code===null,'FULL_FIXTURE_NATIVE_NULL_SLOT');
 const prices=data.prices.map(v=>{const n=byId.get(v.price_id);check(n&&typeof n.nativeJSON==='string'&&hex(n.nativeRowHash)&&sourceVersionSqlHash(n.nativeJSON)===n.nativeRowHash.toUpperCase(),'FULL_FIXTURE_NATIVE_HASH');const actual=JSON.parse(n.nativeJSON.replace(/"(id|product_id|source_unit_id|price)":(-?\d+(?:\.\d+)?)(?=[,}])/g,(_,k,value)=>JSON.stringify(k)+':'+JSON.stringify(value)));check(String(actual.id)===v.price_id&&String(actual.product_id)===v.product_id&&actual.price_type===v.price_type&&actual.price_tier===v.price_tier&&actual.currency_code===v.currency_code&&String(actual.source_unit_id)===v.source_unit_id&&(v.price_exact===null?actual.price===null:new RegExp('^'+v.price_exact.split('.')[0]+'(?:\\.0{1,8})?$').test(String(actual.price))),'FULL_FIXTURE_NATIVE_TUPLE');const row={...v,native_row_hash:n.nativeRowHash.toUpperCase()};row.binding_hash=sourceVersionBindingHash(row,VF);return row;});
 const products=data.products.map(p=>({...p})),manifest={runId:goal7,sourceHash:data.sourceHash,planHash:data.planHash,sourceAsOf:'2026-10-07',productCount:16671,priceCount:63775,sealed:true,bindingsHash:bindings(products,prices)};
 const oldProducts=products.slice(49).map(({version_run_id,lineage_run_id,lineage_source_as_of,lineage_source_key,...p})=>p),oldPrices=prices.filter(p=>p.product_id!=='100000').map(({version_run_id,lineage_run_id,lineage_source_key,...p})=>p);check(oldProducts.length===16622&&oldPrices.length===63774,'FULL_FIXTURE_HISTORICAL_COUNTS');
 return {fixtureOnly:true,evidenceKind:data.evidenceKind,actualT1:false,nativeNullWitnessHash:nullSlot.nativeRowHash.toUpperCase(),baseline:{manifest,products,prices,records:data.records},historical:{products:oldProducts,prices:oldPrices,bindingsHash:hash({products:oldProducts,prices:oldPrices})}};
}
function schemas(v){check(v&&/^final_cutover_fixture_[a-z0-9_]+$/.test(v.nativeSchema)&&/^final_cutover_fixture_[a-z0-9_]+$/.test(v.journalSchema)&&v.nativeSchema!==v.journalSchema,'FULL_FIXTURE_SCHEMAS');return v;}
export function compileGoal8FixtureModules({modules,data,sealed,batchManifest,fxManifest,namespace=FINAL_READER_FIXTURE_SCHEMAS}){
 const ns=schemas(namespace);check(data?.fixtureOnly===true&&sealed?.fixtureOnly===true&&Array.isArray(modules)&&modules.length>0,'FULL_FIXTURE_MODULE_INPUT');
 modules=modules.map(m=>({...m,schema:m.schema??m.schemaName,table:m.table??m.tableName,type:m.type??m.type_desc}));
 const key=m=>m.schema+'.'+m.name;check(new Set(modules.map(key)).size===modules.length,'FULL_FIXTURE_MODULE_DUPLICATE');
 for(const m of modules)check(['dbo','erp_migration'].includes(m.schema)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(m.name)&&typeof m.definition==='string'&&/^CREATE\s+(?:OR\s+ALTER\s+)?(?:PROCEDURE|TRIGGER|VIEW)\b/i.test(m.definition)&&!m.disabled,'FULL_FIXTURE_MODULE_DEFINITION');
 const map=s=>s.replaceAll('[dbo].','['+ns.nativeSchema+'].').replaceAll('[erp_migration].','['+ns.journalSchema+'].').replaceAll('dbo.',ns.nativeSchema+'.').replaceAll('erp_migration.',ns.journalSchema+'.');
 const names=new Map(modules.map(m=>[key(m),(m.schema==='dbo'?ns.nativeSchema:ns.journalSchema)+'.'+(m.name.startsWith('usp_read_work_catalog_final_')||m.name.startsWith('usp_read_stock_products_final_')||m.name.startsWith('usp_get_source_version_prices_final_')||m.name.startsWith('usp_list_source_version_products_final_')?m.name:'fixture_'+m.name)]));
 const aggregate=SUPPLIER_CARD_PRESERVED_SQL.replace(' WHERE ',` WHERE OBJECT_SCHEMA_NAME(parent_id) IN(${lit(ns.nativeSchema)},${lit(ns.journalSchema)}) AND (`)+')';
 const replacements=new Map([
  ['36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',data.sourceHash],['18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',data.planHash],['5842be926d493c8973566fd922ef840d9fe6f7cecd9d83f17f506be5aa3fbd72',sealed.historical.bindingsHash],['69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7',data.holdSealHash],['59A82329B54B3B08FF5A1AF23B1AC2ED4322ADC2785772604558F1F32BFB8644',data.supplierStageHash]
 ]);
 const base=modules.map(m=>{
  let s=m.definition.replaceAll(SUPPLIER_CARD_PRESERVED_SQL,aggregate).replaceAll("FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%'",`FROM sys.triggers WHERE OBJECT_SCHEMA_NAME(parent_id)=${lit(ns.nativeSchema)} AND name LIKE N'fixture[_]operation[_]quarantine[_]%'`);
  s=map(s);for(const [old,name]of [...names].sort((a,b)=>b[0].length-a[0].length)){const token=map(old).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');s=s.replace(new RegExp(token+'(?![A-Za-z0-9_])','g'),name).replaceAll(lit(old.split('.')[1]),lit(name.split('.')[1]));}
  // Prefixes make global sys.objects names unique to this fixture. Preserved
  // trigger aggregation must use the prefixed patterns as well.
  s=s.replaceAll("name LIKE N'operation[_]quarantine[_]%'","name LIKE N'fixture[_]operation[_]quarantine[_]%'").replaceAll("name LIKE N'immutable[_]operation[_]%'","name LIKE N'fixture[_]immutable[_]operation[_]%'").replaceAll("name LIKE N'immutable[_]accepted[_]%'","name LIKE N'fixture[_]immutable[_]accepted[_]%'");
  for(const [old,value]of replacements)s=s.replaceAll(old,value);
  check(!/\b(?:dbo|erp_migration)\s*\.|\[(?:dbo|erp_migration)\]\s*\./i.test(s)&&!/^\s*USE\b/im.test(s),'FULL_FIXTURE_UNMAPPED_SOURCE');return s;
 });
 const originalHashes=modules.map(m=>sourceVersionSqlHash(m.definition));let definitions=base,preserved=null,stable=false;
 for(let round=0;round<32;round++){
  const current=definitions.map(sourceVersionSqlHash),guardRows=modules.map((m,i)=>({...m,i})).filter(m=>/^(?:operation_quarantine_|immutable_operation_|immutable_accepted_)/.test(m.name)).sort((a,b)=>('fixture_'+a.name).localeCompare('fixture_'+b.name,'en'));
  preserved=sourceVersionSqlHash(guardRows.map(m=>['fixture_'+m.name,current[m.i],0,m.first_i?1:0,m.first_u?1:0,m.first_d?1:0].join('|')).join(';'));
  const next=base.map(s=>{for(let i=0;i<modules.length;i++)s=s.replaceAll(originalHashes[i],current[i]);return s.replaceAll('9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E',preserved);});
  if(next.every((s,i)=>s===definitions[i])){definitions=next;stable=true;break;}definitions=next;
 }
 check(stable,'FULL_FIXTURE_MODULE_PIN_CYCLE');
 const compiled=modules.map((m,i)=>({sourceObject:key(m),object:names.get(key(m)),sql:definitions[i],definitionHash:sourceVersionSqlHash(definitions[i]),type:m.type,table:m.table,first_i:!!m.first_i,first_u:!!m.first_u,first_d:!!m.first_d}));
 const quarantine=modules.filter(m=>m.name.startsWith('operation_quarantine_'));check(quarantine.length===37&&quarantine.every(m=>m.first_i&&m.first_u&&m.first_d),'FULL_FIXTURE_REQUIRED_FIRST_GUARDS');
 check(['immutable_goal7_source_version_manifest','immutable_goal7_source_version_products','immutable_goal7_source_version_prices','immutable_goal7_source_version_records'].every(name=>modules.some(m=>m.name===name)),'FULL_FIXTURE_REQUIRED_VERSION_GUARDS');
 check(Array.isArray(batchManifest)&&batchManifest.length===15&&Array.isArray(fxManifest)&&fxManifest.length===17,'FULL_FIXTURE_EXACT_MANIFEST_REQUIRED');
 return {fixtureOnly:true,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,normalReaderSqlEngineProved:false,provisioningReady:false,namespace:ns,modules:compiled,batchManifest:structuredClone(batchManifest),fxManifest:structuredClone(fxManifest),preservedGuardHash:preserved,contractHash:hash({namespace:ns,sourceHash:data.sourceHash,holdSealHash:data.holdSealHash,supplierStageHash:data.supplierStageHash,modules:compiled.map(m=>({object:m.object,definitionHash:m.definitionHash})),batchManifest,fxManifest})};
}
function sqlType(c){
 if(c.type==='timestamp')return 'rowversion';
 if(c.type==='sysname')return 'nvarchar(128)';
 if(['nvarchar','nchar','varchar','char','varbinary','binary'].includes(c.type)){check(Number.isInteger(c.max_length)&&(c.max_length===-1||c.max_length>0&&c.max_length<=8000)&&(!['nvarchar','nchar'].includes(c.type)||c.max_length===-1||c.max_length%2===0),'FULL_FIXTURE_COLUMN_LENGTH');return `${c.type}(${c.max_length===-1?'max':['nvarchar','nchar'].includes(c.type)?c.max_length/2:c.max_length})`;}
 if(['decimal','numeric'].includes(c.type)){check(Number.isInteger(c.precision)&&c.precision>=1&&c.precision<=38&&Number.isInteger(c.scale)&&c.scale>=0&&c.scale<=c.precision,'FULL_FIXTURE_COLUMN_PRECISION');return `${c.type}(${c.precision},${c.scale})`;}
 if(['datetime2','datetimeoffset','time'].includes(c.type)){check(Number.isInteger(c.scale)&&c.scale>=0&&c.scale<=7,'FULL_FIXTURE_COLUMN_SCALE');return `${c.type}(${c.scale})`;}
 check(['bigint','int','bit','date','datetime','smalldatetime','smallint','tinyint','uniqueidentifier','money','smallmoney','float','real'].includes(c.type),'FULL_FIXTURE_COLUMN_TYPE');return c.type;
}

const sets=r=>r?.recordsets??[r?.recordset??r??[]];
async function fixtureQuery(tx,sql,params={}){check(!/\b(?:dbo|erp_migration)\./i.test(sql),'DELTA_FIXTURE_ORIGINAL_REFERENCE');return tx.query(sql,params,{operation:'FINAL_READER_SYNTHETIC_FIXTURE'});}
async function appendSnapshot(tx,snapshot,metadata,ns){
 for(const [table,rows]of [['goal7_source_version_products',snapshot.products],['goal7_source_version_prices',snapshot.prices],['goal7_source_version_records',snapshot.records.filter(r=>r.run_id===snapshot.manifest.runId)]]){
  const cols=metadata.filter(c=>(c.schema??c.schemaName)==='erp_migration'&&(c.table??c.tableName)===table),keys=[...new Set(rows.flatMap(Object.keys))];check(keys.every(k=>cols.some(c=>c.name===k)),'DELTA_FIXTURE_APPEND_COLUMNS');
  for(let offset=0;offset<rows.length;offset+=500)await fixtureQuery(tx,`INSERT ${ident(ns.journalSchema)}.${ident(table)}(${keys.map(ident).join(',')}) SELECT ${keys.map(ident).join(',')} FROM OPENJSON(@rows) WITH(${keys.map(k=>`${ident(k)} ${sqlType(cols.find(c=>c.name===k))} '$.${k}'`).join(',')});`,{rows:JSON.stringify(rows.slice(offset,offset+500))});
 }
 const m=snapshot.manifest;await fixtureQuery(tx,`INSERT ${ident(ns.journalSchema)}.goal7_source_version_manifest(run_id,source_hash,plan_hash,bindings_hash,source_as_of,product_count,price_count,sealed)VALUES(@run,@source,@plan,@bindings,@date,@products,@prices,1);`,{run:m.runId,source:m.sourceHash,plan:m.planHash,bindings:m.bindingsHash,date:m.sourceAsOf,products:m.productCount,prices:m.priceCount});
}
// One injected-driver entry point; importing or compiling never connects.
// Metadata-only clones intentionally exclude unrelated commercial constraints:
// this proves changed reader/publication SQL, not the accepted writer baseline.
export async function runGoal8FinalReaderFixture(driver,{metadata,authorization,namespace=FINAL_READER_FIXTURE_SCHEMAS,resumeBootstrap=false}={}){
 const ns=schemas(namespace),target={server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'};check(authorization?.action===(resumeBootstrap?'RESUME_SYNTHETIC_FINAL_READER_FIXTURE':'CREATE_SYNTHETIC_FINAL_READER_FIXTURE')&&hash(authorization.target)===hash(target)&&typeof driver?.transaction==='function'&&Array.isArray(metadata),'DELTA_FIXTURE_AUTHORIZATION');
 const data=buildGoal8FullSyntheticReaderData(),bootstrap={fixtureOnly:true,deltaOnly:true,namespace:ns,requiredTables:[...new Set(metadata.filter(c=>['dbo','erp_migration'].includes(c.schema??c.schemaName)).map(c=>((c.schema??c.schemaName)==='dbo'?ns.nativeSchema:ns.journalSchema)+'.'+(c.table??c.tableName)))]};let sealed;
 await driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const id=sets(await fixtureQuery(tx,'SELECT @@SERVERNAME server,DB_NAME() [database]'))[0][0];check(id?.server===target.server&&id.database===target.database,'DELTA_FIXTURE_TEST_IDENTITY');
  check(sets(await fixtureQuery(tx,`SELECT name FROM sys.schemas WHERE name IN(${lit(ns.nativeSchema)},${lit(ns.journalSchema)})`))[0].length===(resumeBootstrap?2:0),'DELTA_FIXTURE_ALREADY_EXISTS_PRESERVED');
  if(!resumeBootstrap){for(const schema of Object.values(ns))await fixtureQuery(tx,'CREATE SCHEMA '+ident(schema)+' AUTHORIZATION [dbo];');for(const d of planGoal8FinalReaderFixtureTables({compiled:bootstrap,metadata}).ddl)await fixtureQuery(tx,d.sql);}
  const seed=planGoal8FinalReaderNativeSeed({data,compiled:bootstrap,metadata});if(!resumeBootstrap)for(const b of seed.batches)await fixtureQuery(tx,b.sql,b.params);
  sealed=sealGoal8FullSyntheticReaderBaseline(data,sets(await fixtureQuery(tx,seed.nativeWitnessReadSql))[0]);
  if(!resumeBootstrap)for(const b of planGoal8FullReaderSeed({data,sealed,metadata,compiled:bootstrap,namespace:ns,phase:'after-native-witness'}).batches)await fixtureQuery(tx,b.sql,b.params);
  else {
   const manifestRows=sets(await fixtureQuery(tx,`SELECT run_id runId,source_hash sourceHash,plan_hash planHash,bindings_hash bindingsHash,source_as_of sourceAsOf,product_count productCount,price_count priceCount,sealed FROM ${ident(ns.journalSchema)}.goal7_source_version_manifest`))[0];check(manifestRows.length===1,'DELTA_FIXTURE_RESUME_BASELINE_ONLY');
   const select=rows=>Object.keys(rows[0]).map(k=>['product_id','price_id','main_unit_source_id','source_unit_id','price_exact'].includes(k)?`CONVERT(varchar(60),${ident(k)}) ${ident(k)}`:ident(k)).join(',');
   const products=sets(await fixtureQuery(tx,`SELECT ${select(sealed.baseline.products)} FROM ${ident(ns.journalSchema)}.goal7_source_version_products`))[0],prices=sets(await fixtureQuery(tx,`SELECT ${select(sealed.baseline.prices)} FROM ${ident(ns.journalSchema)}.goal7_source_version_prices`))[0],records=sets(await fixtureQuery(tx,`SELECT run_id,entity,source_key,payload_hash,payload_json FROM ${ident(ns.journalSchema)}.goal7_source_version_records`))[0];
   validateFinalPriceBaseline({manifest:manifestRows[0],products,prices,records},finalPriceSnapshotHash(sealed.baseline));
   const drift=sets(await fixtureQuery(tx,`SELECT COUNT_BIG(*) bad FROM ${ident(ns.journalSchema)}.goal7_source_version_products b LEFT JOIN ${ident(ns.nativeSchema)}.products p ON p.id=b.product_id JOIN ${ident(ns.journalSchema)}.goal7_source_version_records r ON r.run_id=b.lineage_run_id AND r.entity=N'products' AND r.source_key=b.lineage_source_key WHERE p.id IS NULL OR EXISTS(SELECT CONVERT(varbinary(max),p.stock_code),CONVERT(varbinary(max),p.name),CONVERT(varbinary(max),p.unit),CONVERT(varbinary(max),p.currency_code),CONVERT(varbinary(max),p.source_record_key),CONVERT(varbinary(max),p.brand),CONVERT(varbinary(max),p.category) EXCEPT SELECT CONVERT(varbinary(max),b.stock_code),CONVERT(varbinary(max),b.product_name),CONVERT(varbinary(max),b.unit),CONVERT(varbinary(max),b.currency_code),CONVERT(varbinary(max),b.native_source_key),CONVERT(varbinary(max),JSON_VALUE(r.payload_json,'$.brand')),CONVERT(varbinary(max),JSON_VALUE(r.payload_json,'$.category')))`))[0][0];check(String(drift?.bad)==='0','DELTA_FIXTURE_RESUME_NATIVE_MASTER_DRIFT');
  }
 });
 const chosen=sealed.baseline.prices.slice(0,3),h=data.sourceHash,input={target,cutoverId:'22222222-2222-4222-8222-222222222222',acceptedBaselineHash:finalPriceSnapshotHash(sealed.baseline),freeze:{allVegaWritersStopped:true,offlineQueuesDrained:true,writerInventoryHash:h,evidenceHash:h,stoppedAt:'2026-10-09T16:00:00Z',melisaWritesPaused:true,nativePauseProofHash:h},capture:{sourceServer:'DESKTOP-KSRK0EQ',database:'VEGA2026',period:'D0007',startedAt:'2026-10-09T16:01:00Z',finishedAt:'2026-10-09T16:02:00Z',commonScopeHash:h,beforeHash:h,afterHash:h,allDomainsIncluded:true,businessDate:'2026-10-09',reportDateTo:'2026-10-09'},accounts:[],stocks:[],prices:chosen.map((v,n)=>({identityVerified:true,held:false,nativeId:v.product_id,nativeWitnessHash:v.native_row_hash.toLowerCase(),acceptedBaselineHash:h,sourceSemanticsVerified:true,sourceKey:v.product_source_key,currency:v.currency_code,priceType:v.price_type,unitSourceId:v.source_unit_id,tier:v.price_tier,localOverride:false,sourceT0:v.price_exact,acceptedSourceLatest:v.price_exact,nativeBefore:v.price_exact,sourceT1:['10.00000001','1.00000000','2.00000000'][n]})),excluded:[]};input.capture.rowsHash=captureRowsHash(input);const plan=buildFinalCutoverPlan(input),negativeProofs=[];let forward;
 const publish=async inverse=>driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const native=[];for(let n=0;n<chosen.length;n++){const v=chosen[n],row=plan.rows.find(r=>r.nativeId===v.product_id&&r.priceType===v.price_type&&r.unitSourceId===v.source_unit_id&&r.tier===v.price_tier&&r.currency===v.currency_code);check(row,'DELTA_FIXTURE_PLAN_TUPLE');if(row.operation==='NOOP')continue;const value=inverse?v.price_exact:input.prices[n].sourceT1;await fixtureQuery(tx,`UPDATE ${ident(ns.nativeSchema)}.product_prices SET price=CONVERT(decimal(28,8),@value) WHERE id=@id;IF @@ROWCOUNT<>1 THROW 51980,'FIXTURE_PRICE_TARGET',1;`,{id:v.price_id,value});native.push(sets(await fixtureQuery(tx,`SELECT CONVERT(varchar(20),p.id) id,(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) nativeJSON,CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) nativeRowHash FROM ${ident(ns.nativeSchema)}.product_prices p WHERE p.id=@id`,{id:v.price_id}))[0][0]);}
  const publication=buildFinalPriceSnapshot({plan,baseline:inverse?forward.snapshot:sealed.baseline,expectedBaselineHash:inverse?forward.snapshotHash:finalPriceSnapshotHash(sealed.baseline),nativeRows:native,inverse,restoreBaseline:inverse?sealed.baseline:null,restoreBaselineHash:inverse?finalPriceSnapshotHash(sealed.baseline):null,evidenceKind:'SYNTHETIC_NATIVE_SQL'}),compiled=compileGoal8FinalReaderDeltaFixture({publication,baselineContext:sealed.baseline.manifest,namespace:ns});
  if(!inverse){const present=sets(await fixtureQuery(tx,'SELECT CONVERT(char(64),HASHBYTES(\'SHA2_256\',OBJECT_DEFINITION(OBJECT_ID(@proc))),2) h',{proc:compiled.baselineReader.procedure}))[0][0];if(present?.h)check(present.h===compiled.baselineReader.definitionHash,'DELTA_FIXTURE_BASELINE_STOCK_PIN_DRIFT');else await fixtureQuery(tx,compiled.baselineReader.sql);await fixtureQuery(tx,compiled.indexInstallSql);}
  if(!inverse)for(const g of compiled.guards)await fixtureQuery(tx,g.sql);await appendSnapshot(tx,publication.snapshot,metadata,ns);
  for(const r of Object.values(compiled.readers))await fixtureQuery(tx,r.sql);
  await verifyReaders(tx,compiled,publication.snapshot,chosen);
  const nullSlot=sets(await fixtureQuery(tx,`SELECT (SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) nativeJSON,CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) nativeRowHash,(SELECT COUNT(*) FROM ${ident(ns.journalSchema)}.goal7_source_version_prices v WHERE v.price_id=p.id) boundCount FROM ${ident(ns.nativeSchema)}.product_prices p WHERE p.id=9999999`))[0][0];
  check(nullSlot&&JSON.parse(nullSlot.nativeJSON).price===null&&JSON.parse(nullSlot.nativeJSON).currency_code===null&&nullSlot.nativeRowHash===sealed.nativeNullWitnessHash&&nullSlot.boundCount===0,'DELTA_FIXTURE_NATIVE_NULL_COERCION');return {...publication,compiled};
 });
 forward=await publish(false);
 const reject=async(name,sql,params,readKind='catalog')=>{let rejected=false;try{await driver.transaction({isolation:'SERIALIZABLE'},async tx=>{await fixtureQuery(tx,sql,params);await verifyReaders(tx,forward.compiled,forward.snapshot,chosen,readKind);throw Error('DELTA_FIXTURE_NEGATIVE_PASSED');});}catch(e){if(!/(?:VERSION_IMMUTABLE|(?:STOCK_PRODUCT|WORK_CATALOG|OPENING_PRICE|VERSION_CATALOG)_BINDING_DRIFT|(?:STOCK_PRODUCT|WORK_CATALOG)_READ_FORBIDDEN)/.test(e.message))throw e;rejected=true;}check(rejected,'DELTA_FIXTURE_NEGATIVE_NOT_REJECTED');negativeProofs.push(name);};
 await reject('immutable-sealed-version',`UPDATE ${ident(ns.journalSchema)}.goal7_source_version_manifest SET bindings_hash=@h WHERE run_id=@run`,{h:'0'.repeat(64),run:forward.snapshot.manifest.runId});
 await reject('native-price-drift',`UPDATE ${ident(ns.nativeSchema)}.product_prices SET price=99 WHERE id=@id`,{id:chosen[0].price_id});
 await reject('actor-permission',`UPDATE ${ident(ns.nativeSchema)}.permissions SET can_view=0 WHERE permission_key=N'product.view'`,{});
 await reject('native-tuple-type',`UPDATE ${ident(ns.nativeSchema)}.product_prices SET currency_code=N'EUR' WHERE id=@id`,{id:chosen[0].price_id},'detail');
 const inverse=await publish(true);
 return {fixtureOnly:true,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,historicalReadinessReproved:false,normalErpRuntimeActivated:false,normalReaderSqlEngineProved:true,nativeNullPreserved:true,boundNullExcluded:true,productCount:16671,priceCount:63775,heldCount:54,changedTypedPrices:3,negativeProofs,forward:{runId:forward.snapshot.manifest.runId,snapshotHash:forward.snapshotHash,contractHash:forward.compiled.contractHash},inverse:{runId:inverse.snapshot.manifest.runId,snapshotHash:inverse.snapshotHash,contractHash:inverse.compiled.contractHash},commercialWrites:0};
}
async function verifyReaders(tx,compiled,snapshot,chosen,only=null){
 for(const [kind,r]of Object.entries(compiled.readers)){if(only&&kind!==only)continue;const pin=sets(await fixtureQuery(tx,'SELECT CONVERT(char(64),HASHBYTES(\'SHA2_256\',OBJECT_DEFINITION(OBJECT_ID(@proc))),2) h',{proc:r.procedure}))[0][0];check(pin?.h===r.definitionHash,'DELTA_FIXTURE_NATIVE_DEFINITION_PIN');
  for(const productId of new Set(chosen.map(v=>v.product_id))){const sql=kind==='catalog'||kind==='stock'?`EXEC ${r.procedure} @actor_id=13,@product_id=@product${kind==='catalog'?',@candidate_bindings=@candidates':''}`:kind==='detail'?`EXEC ${r.procedure} @product_id=@product`:`EXEC ${r.procedure} @search=@search,@page=1,@page_size=100`,result=sets(await fixtureQuery(tx,sql,{product:productId,candidates:JSON.stringify([[productId,1]]),search:snapshot.products.find(p=>p.product_id===productId).stock_code})),meta=result[0][0];
   check(meta?.readerDefinitionHash===r.definitionHash,'DELTA_FIXTURE_READER_PIN');
   if(kind==='catalog'||kind==='stock'){check(meta.sourceVersionRunId===snapshot.manifest.runId&&meta.sourceVersionBindingsHash===snapshot.manifest.bindingsHash&&meta.actorId==='13'&&meta.canView===true,'DELTA_FIXTURE_READER_CONTEXT');const row=JSON.parse(meta.rowsJson).find(p=>p.id===productId);check(row&&!row.hold?.blocked,'DELTA_FIXTURE_PRODUCT');if(kind==='catalog')for(const v of chosen.filter(v=>v.product_id===productId)){const expected=snapshot.prices.find(p=>p.price_id===v.price_id);check(meta.canViewSalesPrices===true&&row.salePrices.some(p=>p.unitSourceId===v.source_unit_id&&p.tier===v.price_tier&&p.currency===v.currency_code&&p.priceExact===expected.price_exact),'DELTA_FIXTURE_PRICE_EXACT');}}
   else {check(meta.run_id===snapshot.manifest.runId&&meta.plan_hash===snapshot.manifest.planHash&&meta.source_hash===snapshot.manifest.sourceHash,'DELTA_FIXTURE_OPENING_CONTEXT');if(kind==='detail')check(meta.accepted===true&&meta.product_id===productId,'DELTA_FIXTURE_DETAIL_ID');const priceSet=result[kind==='detail'?1:2];check(Array.isArray(priceSet),'DELTA_FIXTURE_MULTIPLE_RECORDSETS_REQUIRED');for(const v of chosen.filter(v=>v.product_id===productId)){const expected=snapshot.prices.find(p=>p.price_id===v.price_id),actual=priceSet.find(p=>p.price_id===v.price_id);check(actual&&actual.price_exact===expected.price_exact,'DELTA_FIXTURE_OPENING_PRICE_EXACT');}}
  }
 }
}
export function planGoal8FinalReaderFixtureTables({compiled,metadata}){
 check(compiled?.fixtureOnly===true&&compiled.deltaOnly===true&&Array.isArray(metadata),'DELTA_FIXTURE_TABLE_INPUT');const ns=schemas(compiled.namespace),ddl=[];
 for(const object of compiled.requiredTables){const [schema,table]=object.split('.'),source=schema===ns.nativeSchema?'dbo':schema===ns.journalSchema?'erp_migration':null;check(source,'DELTA_FIXTURE_TABLE_NAMESPACE');const cols=metadata.filter(c=>(c.schema??c.schemaName)===source&&(c.table??c.tableName)===table);check(cols.length>0,'DELTA_FIXTURE_METADATA_'+table);
  const definition=cols.map(c=>{const d=c.default_definition??c.defaultDefinition;check(!d||!/[;]|\b(?:dbo|erp_migration)\./i.test(d),'DELTA_FIXTURE_DEFAULT_REFERENCE');return ident(c.name)+' '+sqlType(c)+(c.is_identity?' IDENTITY(1,1)':'')+(c.type==='timestamp'?'':c.is_nullable?' NULL':' NOT NULL')+(d&&!c.is_identity?' DEFAULT '+d:'');}).join(',');ddl.push({object,sql:'CREATE TABLE '+ident(schema)+'.'+ident(table)+'('+definition+');'});
 }
 return {fixtureOnly:true,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,ddl};
}
// Bootstrap only synthetic native rows; actual native FOR JSON readback must
// precede sealGoal8FullSyntheticReaderBaseline and immutable version inserts.
export function planGoal8FinalReaderNativeSeed({data,compiled,metadata}){
 check(data?.fixtureOnly&&compiled?.fixtureOnly&&compiled.deltaOnly&&Array.isArray(metadata),'DELTA_FIXTURE_NATIVE_INPUT');const ns=schemas(compiled.namespace),batches=[];
 for(const [table,rows]of [['products',data.nativeProducts],['product_prices',data.nativePrices],['product_source_aliases',data.aliases]]){
  const cols=metadata.filter(c=>(c.schema??c.schemaName)==='dbo'&&(c.table??c.tableName)===table&&!c.is_computed&&!['timestamp','rowversion'].includes(c.type)),keys=[...new Set(rows.flatMap(Object.keys))];check(cols.length&&keys.every(k=>cols.some(c=>c.name===k)),'DELTA_FIXTURE_NATIVE_COLUMNS_'+table);
  for(const c of cols.filter(c=>!c.is_identity&&!c.is_nullable&&!(c.default_definition??c.defaultDefinition)))check(rows.every(r=>r[c.name]!==undefined&&r[c.name]!==null),'DELTA_FIXTURE_NATIVE_REQUIRED_'+table+'_'+c.name);
  const object=ident(ns.nativeSchema)+'.'+ident(table),identity=cols.some(c=>c.is_identity&&keys.includes(c.name));
  for(let offset=0;offset<rows.length;offset+=500)batches.push({operation:'FULL_SYNTHETIC_NATIVE_SEED',object,sql:`${identity?'SET IDENTITY_INSERT '+object+' ON;':''}INSERT ${object}(${keys.map(ident).join(',')}) SELECT ${keys.map(ident).join(',')} FROM OPENJSON(@rows) WITH(${keys.map(k=>`${ident(k)} ${sqlType(cols.find(c=>c.name===k))} '$.${k}'`).join(',')});${identity?'SET IDENTITY_INSERT '+object+' OFF;':''}`,params:{rows:JSON.stringify(rows.slice(offset,offset+500))}});
 }
 return {fixtureOnly:true,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,batches,nativeWitnessReadSql:`SELECT CONVERT(varchar(20),p.id) id,(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) nativeJSON,CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) nativeRowHash FROM ${ident(ns.nativeSchema)}.[product_prices] p ORDER BY p.id;`};
}
// Return parameterized batches only. Unknown required fields are never invented.
// Caller must create metadata-only tables BEFORE seeding, and install guards AFTER.
export function planGoal8FullReaderSeed({data,sealed,metadata,compiled,namespace=FINAL_READER_FIXTURE_SCHEMAS,phase='all'}){
 const ns=schemas(namespace);check(data?.fixtureOnly===true&&sealed?.fixtureOnly===true&&compiled?.fixtureOnly===true&&Array.isArray(metadata),'FULL_FIXTURE_SEED_INPUT');
 check(['all','after-native-witness'].includes(phase),'FULL_FIXTURE_SEED_PHASE');
 metadata=metadata.map(c=>({...c,schema:c.schema??c.schemaName,table:c.table??c.tableName,default_definition:c.default_definition??c.defaultDefinition}));
 const historicalManifest={run_id:opening,source_hash:data.sourceHash,plan_hash:data.planHash,bindings_hash:sealed.historical.bindingsHash,source_as_of:'2026-09-30',product_count:16622,price_count:63774,sealed:true};
 const v=sealed.baseline.manifest,versionManifest={run_id:v.runId,source_hash:v.sourceHash,plan_hash:v.planHash,bindings_hash:v.bindingsHash,source_as_of:v.sourceAsOf,product_count:v.productCount,price_count:v.priceCount,sealed:true};
 const module=m=>compiled.modules.find(x=>x.sourceObject===m);
 // Modules must be selected from independently exported exact source manifests,
 // rather than padding arbitrary objects to reach the expected count.
 check(compiled.deltaOnly===true||(compiled.batchManifest?.length===15&&compiled.fxManifest?.length===17),'FULL_FIXTURE_EXACT_MANIFEST_REQUIRED');
 const batch=(compiled.batchManifest??[]).map(m=>{const x=module('dbo.'+m.name);check(x,'FULL_FIXTURE_BATCH_MODULE');return {...m,name:x.object.split('.')[1],after_hash:x.definitionHash};}),fx=(compiled.fxManifest??[]).map(m=>{const x=module('dbo.'+m.name);check(x,'FULL_FIXTURE_FX_MODULE');return {...m,name:x.object.split('.')[1],definition_hash:x.definitionHash};});
 const groups=[['dbo','products',data.nativeProducts],['dbo','product_prices',data.nativePrices],['dbo','product_source_aliases',data.aliases],['erp_migration','operation_quarantine_holds',data.holds],['erp_migration','records',[...data.records,...data.supplierRecords]],['erp_migration','runs',[{run_id:opening,status:'COMMITTED',actor:'SYNTHETIC_NATIVE_SQL',source_hash:data.sourceHash,plan_hash:data.planHash,source_as_of:'2026-09-30'}]],['erp_migration','accepted_price_products',sealed.historical.products],['erp_migration','accepted_price_values',sealed.historical.prices],['erp_migration','accepted_price_manifest',[historicalManifest]],['erp_migration','operation_quarantine_manifest',[{run_id:opening,source_hash:data.sourceHash,plan_hash:data.planHash,source_as_of:'2026-09-30',sealed:true,seal_hash:data.holdSealHash,source_rows:176,native_holds:172,not_present:4}]],['erp_migration','goal7_source_version_products',sealed.baseline.products],['erp_migration','goal7_source_version_prices',sealed.baseline.prices],['erp_migration','goal7_source_version_records',data.records],['erp_migration','goal7_source_version_manifest',[versionManifest]],['dbo','test_purchase_batch_guard_manifest',batch],['dbo','test_purchase_fx_guard_manifest',fx],['dbo','suppliers',[{id:'13373',supplier_code:'TEST-DAILY-PUR-S',name:'TEST GÜNLÜK ALIŞ İADE TEDARİKÇİ',currency_code:'TRY',is_active:true,is_deleted:false,purchase_discount_rate:'0.0000',balance:'0.0000'}]],['dbo','test_daily_scope',[{flow:'purchase',product_id:'301986',supplier_id:'13373'}]],['dbo','test_purchase_fx_scope',[{id:'1',product_id:'301986',supplier_id:'13373'}]],['dbo','roles',[{id:'1',code:'FULL_READER_FIXTURE',name:'Full reader fixture',is_active:true}]],['dbo','users',[{id:'13',username:'FULL_READER_FIXTURE',display_name:'Full reader fixture',password_hash:'TEST_DISABLED',role_id:'1',is_active:true}]],['dbo','permissions',['product.view','sales.view','purchase.view','stock.adjust','customer.view','supplier.view'].map((permission_key,n)=>({id:String(500+n),role_id:'1',permission_key,can_view:true}))]];
 const batches=[];
 for(const [schema,table,allRows]of groups){
  if(compiled.deltaOnly&&!['products','product_prices','product_source_aliases','operation_quarantine_holds','records','accepted_price_products','accepted_price_values','goal7_source_version_products','goal7_source_version_prices','goal7_source_version_records','goal7_source_version_manifest','roles','users','permissions'].includes(table))continue;
  if(phase==='after-native-witness'&&schema==='dbo'&&['products','product_prices','product_source_aliases'].includes(table))continue;
  if(compiled.deltaOnly&&!compiled.requiredTables.includes((schema==='dbo'?ns.nativeSchema:ns.journalSchema)+'.'+table))continue;
  const rows=compiled.deltaOnly&&table==='records'?data.records:compiled.deltaOnly&&table==='operation_quarantine_holds'?allRows.filter(r=>r.entity==='product'):allRows;
  const columns=metadata.filter(c=>c.schema===schema&&c.table===table&&!c.is_computed&&c.type!=='timestamp');check(columns.length>0,'FULL_FIXTURE_SEED_SCHEMA_'+table);
  const keys=[...new Set(rows.flatMap(Object.keys))];check(keys.every(k=>columns.some(c=>c.name===k)),'FULL_FIXTURE_SEED_COLUMN_'+table);
  for(const c of columns.filter(c=>!c.is_identity&&!c.is_nullable&&!c.default_definition))check(rows.every(r=>r[c.name]!==undefined&&r[c.name]!==null),'FULL_FIXTURE_REQUIRED_FIELD_'+table+'_'+c.name);
  const object=ident(schema==='dbo'?ns.nativeSchema:ns.journalSchema)+'.'+ident(table),identity=columns.some(c=>c.is_identity&&keys.includes(c.name));
  for(let offset=0;offset<rows.length;offset+=500){const part=rows.slice(offset,offset+500);batches.push({operation:'FULL_SYNTHETIC_SEED',object,sql:`${identity?'SET IDENTITY_INSERT '+object+' ON;':''}INSERT ${object}(${keys.map(ident).join(',')}) SELECT ${keys.map(ident).join(',')} FROM OPENJSON(@rows) WITH(${keys.map(k=>`${ident(k)} ${sqlType(columns.find(c=>c.name===k))} '$.${k}'`).join(',')});${identity?'SET IDENTITY_INSERT '+object+' OFF;':''}`,params:{rows:JSON.stringify(part)}});}
 }
 return {fixtureOnly:true,evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,normalReaderSqlEngineProved:false,provisioningReady:false,namespace:ns,commercialWrites:0,batches,seedHash:hash(batches)};
}
