// Additive source-only publisher. No connection, capture, filesystem or SQL on import.
import {hash} from './party-currency-readonly-plan.mjs';
import {check,sqlHash,units,exact} from './goal73-supplier-delta.mjs';
import {verifyFinalCutoverPlan} from './final-cutover-plan.mjs';
import {buildSourceVersionReaders} from '../canonical/goal7-source-catalog-readers.mjs';
import {SOURCE_VERSION_PRODUCT_FIELDS as PF,SOURCE_VERSION_PRICE_FIELDS as VF,sourceVersionBindingHash,SOURCE_VERSION_TABLES,sourceVersionHash,sourceVersionClassificationIndex} from './goal7-source-version.mjs';
import {validateFinalCatalogContext} from '../../apps/api/src/services/finalCatalogContext.mjs';
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const lit=v=>"N'"+String(v).replaceAll("'","''")+"'";
const tuple=p=>[String(p.product_id),p.price_type,String(p.source_unit_id??'CARD'),Number(p.price_tier),p.currency_code].join('/');
const norm=v=>{if(v===null)return null;check(typeof v==='string'&&/^-?\d+(?:\.\d{1,8})?$/.test(v),'FINAL_PRICE_DECIMAL');const [whole,fraction='']=v.split('.');return exact(units(whole+'.'+fraction.padEnd(8,'0')));};
const nativePriceJSON=raw=>JSON.parse(raw.replace(/"(id|product_id|source_unit_id|price)":(-?\d+(?:\.\d+)?)(?=[,}])/g,(_,key,value)=>JSON.stringify(key)+':'+JSON.stringify(value)));
const bindings=(products,prices)=>sourceVersionHash({products:products.map(p=>({product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_as_of:p.lineage_source_as_of,lineage_source_key:p.lineage_source_key})),prices:prices.map(p=>({price_id:p.price_id,product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_key:p.lineage_source_key}))});
const orderedSnapshot=s=>({...s,products:[...s.products].sort((a,b)=>BigInt(a.product_id)<BigInt(b.product_id)?-1:1),prices:[...s.prices].sort((a,b)=>BigInt(a.price_id)<BigInt(b.price_id)?-1:1),records:[...s.records].sort((a,b)=>JSON.stringify([a.run_id,a.entity,a.source_key]).localeCompare(JSON.stringify([b.run_id,b.entity,b.source_key]),'en'))});
export const finalPriceSnapshotHash=s=>hash(orderedSnapshot(s));
export function validateFinalPriceBaseline(s,expectedHash){
 check(s&&hex(expectedHash)&&finalPriceSnapshotHash(s)===expectedHash&&s.manifest?.sealed===true,'FINAL_PRICE_BASELINE_HASH');
 check(Array.isArray(s.products)&&Array.isArray(s.prices)&&Array.isArray(s.records)&&s.products.length===s.manifest.productCount&&s.prices.length===s.manifest.priceCount,'FINAL_PRICE_BASELINE_COUNTS');
 check(s.prices.every(p=>p.price_exact!==null),'FINAL_PRICE_BOUND_NULL_UNSUPPORTED');
 for(const [rows,key,fields] of [[s.products,'product_id',PF],[s.prices,'price_id',VF]]){
  check(new Set(rows.map(p=>String(p[key]))).size===rows.length,'FINAL_PRICE_BASELINE_DUPLICATE');
  const allowed=new Set([...fields,'binding_hash','version_run_id','lineage_run_id','lineage_source_key',...(key==='product_id'?['price_count','lineage_source_as_of']:[])]);
  for(const p of rows)check(Object.keys(p).every(k=>allowed.has(k))&&p.version_run_id===s.manifest.runId&&sourceVersionBindingHash(p,fields)===p.binding_hash.toUpperCase(),'FINAL_PRICE_BASELINE_BINDING');
 }
 const productCounts=new Map(s.products.map(p=>[String(p.product_id),0])),tuples=new Set();for(const v of s.prices){const k=tuple(v);check(productCounts.has(String(v.product_id))&&!tuples.has(k),'FINAL_PRICE_BASELINE_TUPLE');tuples.add(k);productCounts.set(String(v.product_id),productCounts.get(String(v.product_id))+1);}check(s.products.every(p=>p.price_count===productCounts.get(String(p.product_id))),'FINAL_PRICE_BASELINE_PRODUCT_COUNT');
 const records=new Map(s.records.map(r=>[JSON.stringify([r.run_id,r.entity,r.source_key]),r]));check(records.size===s.records.length&&s.records.every(r=>Object.keys(r).every(k=>['run_id','entity','source_key','payload_hash','payload_json'].includes(k))),'FINAL_PRICE_RECORD_DUPLICATE');
 for(const [rows,entity,key] of [[s.products,'products','product_source_key'],[s.prices,'prices','price_source_key']])for(const p of rows){
  const r=records.get(JSON.stringify([p.lineage_run_id,entity,p.lineage_source_key??p[key]]));
  check(r&&r.payload_hash.toUpperCase()===p.stage_payload_hash.toUpperCase()&&sqlHash(r.payload_json)===p.stage_sql_hash.toUpperCase(),'FINAL_PRICE_BASELINE_STAGE');
 }
 check(bindings(s.products,s.prices)===s.manifest.bindingsHash,'FINAL_PRICE_BASELINE_SEAL');return s;
}
// Preserve complete immutable product/classification provenance, including Goal7's
// new/master records. Only changed typed price atoms receive fresh stage lineage.
export function buildFinalPriceSnapshot({plan,baseline,expectedBaselineHash,nativeRows,inverse=false,restoreBaseline=null,restoreBaselineHash=null,evidenceKind}){
 verifyFinalCutoverPlan(plan);validateFinalPriceBaseline(baseline,expectedBaselineHash);
 validateFinalPricePlan(plan,inverse?restoreBaseline:baseline);
 check(['FROZEN_SOURCE','SYNTHETIC_NATIVE_SQL'].includes(evidenceKind),'FINAL_PRICE_EVIDENCE_KIND');
 if(inverse)validateFinalPriceBaseline(restoreBaseline,restoreBaselineHash);
 const runId=`FINAL-${inverse?'INVERSE-':''}${plan.cutoverId}`,original=inverse?restoreBaseline:baseline;
 const products=baseline.products.map(p=>({...p,version_run_id:runId})),prices=baseline.prices.map(p=>({...p,version_run_id:runId})),records=baseline.records.map(r=>({...r}));
 const changed=plan.rows.filter(r=>r.kind==='price'&&r.operation!=='NOOP');check(Array.isArray(nativeRows)&&nativeRows.length===changed.length,'FINAL_PRICE_NATIVE_COUNT');
 const seen=new Set();
 for(const row of changed){
  const key=[row.nativeId,row.priceType,String(row.unitSourceId??'CARD'),row.tier,row.currency].join('/'),matches=prices.filter(p=>tuple(p)===key);check(matches.length===1,'FINAL_PRICE_TUPLE');const p=matches[0];
  const states=nativeRows.filter(n=>String(n.id)===String(p.price_id));check(states.length===1&&!seen.has(String(p.price_id)),'FINAL_PRICE_NATIVE_SINGLE');seen.add(String(p.price_id));const n=states[0],j=nativePriceJSON(n.nativeJSON);
  check(hex(n.nativeRowHash)&&sqlHash(n.nativeJSON)===n.nativeRowHash.toUpperCase()&&String(j.id)===String(p.price_id)&&tuple(j)===key&&norm(j.price)===(inverse?row.nativeBefore:row.afterValue),'FINAL_PRICE_NATIVE_WITNESS');
  check(norm(p.price_exact)===(inverse?row.afterValue:row.nativeBefore),'FINAL_PRICE_BASELINE_NATIVE_VALUE');
  if(inverse){const prior=original.prices.find(x=>String(x.price_id)===String(p.price_id));check(prior&&tuple(prior)===key&&norm(prior.price_exact)===row.nativeBefore,'FINAL_PRICE_RESTORE_ATOM');Object.assign(p,prior,{version_run_id:runId,native_row_hash:n.nativeRowHash.toUpperCase()});}
  else{
   const sourceKey=row.sourceKey+'/PRICE/'+row.priceType+'/'+String(row.unitSourceId??'CARD')+'/'+row.tier+'/'+row.currency;
   const payload_json=JSON.stringify({source_key:sourceKey,product_source_key:row.sourceKey,unit_source_id:row.unitSourceId,price_type:row.priceType,tier:row.tier,currency_code:row.currency,price:row.afterValue,price_status:'SOURCE',final_cutover_plan:plan.planHash});
   const record={run_id:runId,entity:'prices',source_key:sourceKey,payload_hash:sourceVersionHash(payload_json),payload_json};records.push(record);
   Object.assign(p,{price_exact:row.afterValue,stage_payload_hash:record.payload_hash,stage_sql_hash:sqlHash(payload_json),native_row_hash:n.nativeRowHash.toUpperCase(),lineage_run_id:runId,lineage_source_key:sourceKey});
  }
  p.binding_hash=sourceVersionBindingHash(p,VF);
 }
 if(inverse){const recordKeys=new Set(records.map(r=>JSON.stringify([r.run_id,r.entity,r.source_key])));for(const r of original.records){const key=JSON.stringify([r.run_id,r.entity,r.source_key]);if(!recordKeys.has(key)){records.push({...r});recordKeys.add(key);}}}
 const manifest={runId,sourceHash:plan.capture.beforeHash,planHash:plan.planHash,bindingsHash:bindings(products,prices),sourceAsOf:plan.capture.businessDate,productCount:products.length,priceCount:prices.length,sealed:true};
 const snapshot=orderedSnapshot({manifest,products,prices,records});validateFinalPriceBaseline(snapshot,finalPriceSnapshotHash(snapshot));
 const ancestry=[...new Map(products.map(p=>[p.lineage_run_id,{runId:p.lineage_run_id,sourceAsOf:p.lineage_source_as_of}])).values(),{runId,sourceAsOf:manifest.sourceAsOf}];
 return {snapshot,snapshotHash:finalPriceSnapshotHash(snapshot),ancestry,evidenceKind,originSnapshotHash:inverse?restoreBaselineHash:expectedBaselineHash};
}
export function validateFinalPricePlan(plan,baseline){
 verifyFinalCutoverPlan(plan);check(baseline&&Array.isArray(baseline.prices),'FINAL_PRICE_PLAN_BASELINE');
 for(const r of plan.rows.filter(r=>r.kind==='price')){
  check(r.afterValue!==null&&r.nativeBefore!==null,'FINAL_PRICE_NULL_TUPLE_REQUIRES_EXCLUSION');
  const p=baseline.prices.find(p=>tuple(p)===[r.nativeId,r.priceType,r.unitSourceId??'CARD',r.tier,r.currency].join('/'));
  check(p&&p.price_exact!==null&&norm(p.price_exact)===norm(r.nativeBefore),'FINAL_PRICE_PLAN_ACCEPTED_TUPLE');
 }
 return {planHash:plan.planHash,nullableBoundPrices:false};
}
export function buildFinalPriceReaders({publication,baselineContext}){
 validateFinalPriceBaseline(publication.snapshot,publication.snapshotHash);
 const c=publication.snapshot.manifest,old=buildSourceVersionReaders(baselineContext),suffix=c.runId.replaceAll('-','_').toLowerCase();
 const names={catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`};
 const ancestry=JSON.stringify(publication.ancestry),readers={};
 for(const kind of ['catalog','stock','detail','list']){
  const base=old[kind];let sql=base.sql.replaceAll(base.procedure,names[kind]);
  for(const k of ['runId','sourceHash','planHash','bindingsHash','sourceAsOf'])sql=sql.replaceAll(lit(baselineContext[k]),lit(c[k]));
  // The frozen Goal7 templates allow RUN06/current only. Add the exact pinned
  // ancestry while retaining all native tuple, stage, hash and hold checks.
  sql=sql.replaceAll(`lineage_run_id NOT IN(N'VEGA-OPENING-TEST-20261004-06',${lit(c.runId)})`,`lineage_run_id NOT IN(${publication.ancestry.map(a=>lit(a.runId)).join(',')})`);
  sql=sql.replaceAll(`b.lineage_source_as_of<>CASE WHEN b.lineage_run_id=${lit(c.runId)} THEN ${lit(c.sourceAsOf)} ELSE N'2026-09-30' END`,`NOT EXISTS(SELECT 1 FROM OPENJSON(${lit(ancestry)}) WITH(runId nvarchar(80),sourceAsOf nvarchar(40)) anc WHERE anc.runId=b.lineage_run_id AND anc.sourceAsOf=b.lineage_source_as_of)`);
  sql=sql.replaceAll(`lineage_run_id=${lit(c.runId)} THEN N'VEGA2026/F0102/TBLSTOKLAR/'`,`lineage_run_id<>N'VEGA-OPENING-TEST-20261004-06' THEN N'VEGA2026/F0102/TBLSTOKLAR/'`);
  sql=sql.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE PROCEDURE ');
  const storedDefinition=sql;readers[kind]={procedure:names[kind],sql,storedDefinition,definitionHash:sqlHash(storedDefinition)};
 }
 const context=validateFinalCatalogContext({...c,schemaVersion:'melisa-final-catalog-context.v1',snapshotHash:publication.snapshotHash,evidenceKind:publication.evidenceKind,ancestry:publication.ancestry,procedures:names,readerDefinitionHash:readers.catalog.definitionHash,stockReaderDefinitionHash:readers.stock.definitionHash,openingDetailDefinitionHash:readers.detail.definitionHash,openingListDefinitionHash:readers.list.definitionHash});
 return {readers,context};
}
export function buildFinalClassificationIndex({publication,context,holds}){
 validateFinalPriceBaseline(publication.snapshot,publication.snapshotHash);validateFinalCatalogContext(context);
 check(context.snapshotHash===publication.snapshotHash&&context.runId===publication.snapshot.manifest.runId,'FINAL_CLASSIFICATION_PUBLICATION');
 return sourceVersionClassificationIndex({context,products:publication.snapshot.products,records:publication.snapshot.records,holds});
}
// The publisher is not a connection/credential boundary. query is supplied by
// the approved writer inside its existing SERIALIZABLE transaction.
export function createFinalPricePublication({baseline,expectedBaselineHash,baselineContext,evidenceKind}){
 validateFinalPriceBaseline(baseline,expectedBaselineHash);
 check(['runId','sourceHash','planHash','bindingsHash','sourceAsOf','productCount','priceCount'].every(k=>baselineContext?.[k]===baseline.manifest[k]),'FINAL_PRICE_BASELINE_CONTEXT');
 const baselineReaders=buildSourceVersionReaders(baselineContext);
 const implementationHash=hash([norm,tuple,bindings,orderedSnapshot,nativePriceJSON,finalPriceSnapshotHash,validateFinalPriceBaseline,validateFinalPricePlan,buildFinalPriceSnapshot,buildFinalPriceReaders,createFinalPricePublication,validateFinalCatalogContext,verifyFinalCutoverPlan,sourceVersionBindingHash,sourceVersionHash,hash,sqlHash,units,exact].map(fn=>fn.toString()));
 const contractHash=hash({implementationHash,readerImplementation:Object.fromEntries(['catalog','stock','detail','list'].map(k=>[k,baselineReaders[k].proof.readerDefinitionHash])),implementation:'melisa-final-price-publication.v1',baselineHash:expectedBaselineHash,baselineContext,evidenceKind});
 const publications=new Map();
 async function forwardPublication(query,plan){
  if(publications.has(plan.planHash))return publications.get(plan.planHash);
  const child=(await query('final-price-forward-child',"SELECT receipt_json FROM erp_migration.final_cutover_children WHERE child_id=@id",{id:plan.cutoverId+'/price'}))[0];check(child,'FINAL_PRICE_INVERSE_PUBLICATION_REQUIRED');const receipt=JSON.parse(child.receipt_json),{receiptHash,...childBody}=receipt;check(hash(childBody)===receiptHash&&receipt.planHash===plan.planHash&&receipt.inverse===false,'FINAL_PRICE_FORWARD_CHILD');
  const run=receipt.publication?.versionContext?.runId;check(run==='FINAL-'+plan.cutoverId,'FINAL_PRICE_FORWARD_RUN');
  const [manifest]=await query('final-price-forward-manifest',`SELECT run_id runId,source_hash sourceHash,plan_hash planHash,bindings_hash bindingsHash,source_as_of sourceAsOf,product_count productCount,price_count priceCount,sealed FROM ${SOURCE_VERSION_TABLES.manifest} WHERE run_id=@run`,{run});
  const select=rows=>Object.keys(rows[0]).map(k=>['product_id','price_id','main_unit_source_id','source_unit_id','price_exact'].includes(k)?`CONVERT(varchar(60),[${k}]) [${k}]`:`[${k}]`).join(',');
  const products=await query('final-price-forward-products',`SELECT ${select(baseline.products)} FROM ${SOURCE_VERSION_TABLES.products} WHERE version_run_id=@run`,{run}),prices=await query('final-price-forward-prices',`SELECT ${select(baseline.prices)} FROM ${SOURCE_VERSION_TABLES.prices} WHERE version_run_id=@run`,{run}),newRecords=await query('final-price-forward-records',`SELECT * FROM ${SOURCE_VERSION_TABLES.records} WHERE run_id=@run`,{run});
  const snapshot=orderedSnapshot({manifest,products,prices,records:[...baseline.records,...newRecords]});validateFinalPriceBaseline(snapshot,receipt.publication.snapshotHash);const p={snapshot,snapshotHash:receipt.publication.snapshotHash,result:receipt.publication};publications.set(plan.planHash,p);return p;
 }
 const native=async(query,receipt)=>{const out=[];for(const e of receipt.effects.filter(e=>e.operation!=='NOOP')){const id=String(JSON.parse(e.beforeJSON).id),rows=await query('final-price-native',"SELECT CONVERT(varchar(20),p.id) id,(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) nativeJSON,CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) nativeRowHash FROM dbo.product_prices p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=@id",{id});check(rows.length===1&&rows[0].nativeRowHash.toUpperCase()===e.afterWitnessHash.toUpperCase(),'FINAL_PRICE_EFFECT_NATIVE');out.push(rows[0]);}return out;};
 return {contractHash,preflight({plan}){validateFinalPricePlan(plan,baseline);return true;},async publish({query,plan,receipt,inverse}){
  const forward=inverse?await forwardPublication(query,plan):null;
  const publication=buildFinalPriceSnapshot({plan,baseline:inverse?forward.snapshot:baseline,expectedBaselineHash:inverse?forward.snapshotHash:expectedBaselineHash,nativeRows:await native(query,receipt),inverse,restoreBaseline:inverse?baseline:null,restoreBaselineHash:inverse?expectedBaselineHash:null,evidenceKind});
  const built=buildFinalPriceReaders({publication,baselineContext});
  // Existing immutable Goal7 rows/guards are untouched; this new run has fresh rows.
  for(const [table,rows] of [[SOURCE_VERSION_TABLES.products,publication.snapshot.products],[SOURCE_VERSION_TABLES.prices,publication.snapshot.prices],[SOURCE_VERSION_TABLES.records,publication.snapshot.records.filter(r=>r.run_id===publication.snapshot.manifest.runId)]])for(const row of rows){const cols=Object.keys(row);await query('final-price-version-insert',`INSERT ${table}(${cols.map(k=>'['+k+']').join(',')}) SELECT ${cols.map(k=>'['+k+']').join(',')} FROM OPENJSON(@row) WITH(${cols.map(k=>`[${k}] ${['product_id','price_id','main_unit_source_id','source_unit_id'].includes(k)?'bigint':k==='price_tier'||k==='price_count'?'int':k==='price_exact'?'decimal(28,8)':k==='is_main_unit'?'bit':'nvarchar(max)'} '$.${k}'`).join(',')})`,{row:JSON.stringify(row)});}
  const m=publication.snapshot.manifest;await query('final-price-version-seal',`INSERT ${SOURCE_VERSION_TABLES.manifest}(run_id,source_hash,plan_hash,bindings_hash,source_as_of,product_count,price_count,sealed) VALUES(@run,@source,@plan,@bindings,@date,@products,@prices,1)`,{run:m.runId,source:m.sourceHash,plan:m.planHash,bindings:m.bindingsHash,date:m.sourceAsOf,products:m.productCount,prices:m.priceCount});
  for(const r of Object.values(built.readers)){await query('final-price-reader-create',r.sql);for(const principal of ['melisa_sirket_test_20260929_01','melisa_sirket_sales_test_20260929_01'])await query('final-price-reader-access',`IF DATABASE_PRINCIPAL_ID(${lit(principal)}) IS NULL THROW 51808,'FINAL_READER_EXISTING_PRINCIPAL_REQUIRED',1;GRANT EXECUTE ON OBJECT::${r.procedure} TO [${principal}];`);}
  const body={childId:receipt.id,planHash:plan.planHash,effectsHash:hash(receipt.effects),snapshotHash:publication.snapshotHash,versionContext:{...built.context,partyBindingsHash:hash(plan.rows.filter(r=>r.kind==='account'))}};
  publication.result={...body,publicationHash:hash(body)};publications.set(inverse?plan.planHash+'/inverse':plan.planHash,publication);return publication.result;
 },async verify({query,plan,receipt,inverse}){
  const publication=receipt.publication??publications.get(inverse?plan.planHash+'/inverse':plan.planHash)?.result;check(publication&&publication.planHash===plan.planHash&&publication.effectsHash===hash(receipt.effects),'FINAL_PRICE_PUBLICATION_BINDING');
  const {publicationHash,...body}=publication;check(hash(body)===publicationHash,'FINAL_PRICE_PUBLICATION_HASH');const context=validateFinalCatalogContext(publication.versionContext);
  check(publication.childId===receipt.id&&context.runId===`FINAL-${inverse?'INVERSE-':''}${plan.cutoverId}`&&context.planHash===plan.planHash&&context.sourceHash===plan.capture.beforeHash&&context.sourceAsOf===plan.capture.businessDate&&context.snapshotHash===publication.snapshotHash&&context.partyBindingsHash===hash(plan.rows.filter(r=>r.kind==='account')),'FINAL_PRICE_PUBLICATION_CONTEXT');
  // Genuine consumers use the same four pinned procedures after explicit context
  // configuration. Here SQL executes each normal reader with real actor permission.
  for(const [kind,definitionHash] of [['catalog',context.readerDefinitionHash],['stock',context.stockReaderDefinitionHash],['detail',context.openingDetailDefinitionHash],['list',context.openingListDefinitionHash]]){
   const rows=await query('final-price-reader-pin',"SELECT CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(@proc))),2) h",{proc:context.procedures[kind]});check(rows.length===1&&rows[0].h===definitionHash.toUpperCase(),'FINAL_PRICE_READER_PIN');
  }
  const priceRows=plan.rows.filter(r=>r.kind==='price'),products=[...new Set(priceRows.map(r=>r.nativeId))];
  if(products.length===0){const candidate=(await query('final-price-reader-empty-scope',`SELECT TOP(1) CONVERT(varchar(20),b.product_id) productId FROM ${SOURCE_VERSION_TABLES.products} b JOIN dbo.products p ON p.id=b.product_id WHERE b.version_run_id=@run AND p.is_active=1 AND p.is_deleted=0 AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND(h.native_id=p.id OR h.native_source_key=p.source_record_key)) ORDER BY b.product_id`,{run:context.runId}))[0];check(candidate&&baseline.products.some(p=>p.product_id===candidate.productId),'FINAL_PRICE_READER_PRODUCT');products.push(candidate.productId);}
  for(const productId of products){
   for(const kind of ['catalog','stock']){const rows=await query('final-price-reader-readback',`EXEC ${context.procedures[kind]} @actor_id=@actor,@product_id=@product${kind==='catalog'?",@candidate_bindings=@candidates":''}`,{actor:receipt.actorId,product:productId,...(kind==='catalog'?{candidates:JSON.stringify([[productId,1]])}:{})});check(rows.length===1&&rows[0].readerDefinitionHash===context[kind==='catalog'?'readerDefinitionHash':'stockReaderDefinitionHash'].toUpperCase()&&rows[0].sourceVersionRunId===context.runId&&rows[0].sourceVersionBindingsHash===context.bindingsHash&&rows[0].actorId===receipt.actorId&&rows[0].canView===true,'FINAL_PRICE_NORMAL_READBACK');const product=JSON.parse(rows[0].rowsJson).find(p=>p.id===productId);check(product&&!product.hold?.blocked,'FINAL_PRICE_NORMAL_PRODUCT');
    if(kind==='catalog')for(const r of priceRows.filter(r=>r.nativeId===productId&&r.priceType==='sale'))check(rows[0].canViewSalesPrices===true&&product.salePrices.some(p=>p.type===r.priceType&&p.unitSourceId===r.unitSourceId&&p.tier===r.tier&&p.currency===r.currency&&p.priceExact===(inverse?r.nativeBefore:r.afterValue)),'FINAL_PRICE_NORMAL_EXACT_PRICE');
   }
   const detail=(await query('final-price-detail-readback',`EXEC ${context.procedures.detail} @product_id=@product`,{product:productId}))[0];check(detail?.readerDefinitionHash===context.openingDetailDefinitionHash.toUpperCase()&&detail.run_id===context.runId&&detail.plan_hash===context.planHash&&detail.source_hash===context.sourceHash&&detail.accepted===true&&detail.product_id===productId,'FINAL_PRICE_NORMAL_DETAIL');
  }
  const list=(await query('final-price-list-readback',`EXEC ${context.procedures.list} @page=1,@page_size=1`))[0];check(list?.readerDefinitionHash===context.openingListDefinitionHash.toUpperCase()&&list.run_id===context.runId&&list.plan_hash===context.planHash&&list.source_hash===context.sourceHash,'FINAL_PRICE_NORMAL_LIST');
  return true;
 }};
}
