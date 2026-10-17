// Root-owned explicit TEST preparation/application. Importing has no I/O.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {targetPool} from './goal73-supplier-delta-runtime.mjs';
import {collectTargetBindings,protectedReferenceProof} from './product-purchase-reference-runtime.mjs';
import {TABLES as PARENT_TABLES,PURCHASE_REFERENCE_SQL_PROOF} from './product-purchase-reference-sql.mjs';
import {captureLastPurchaseSource,normalizePurchaseSource} from './product-last-purchase-source.mjs';
import {SCHEMA,APPROVAL,TARGET,hash,sqlHash,check,selectLastPurchase,summarizeLastPurchase,validateLastPurchasePlan} from './product-last-purchase-model.mjs';
import {TABLES,DDL,DEFINITIONS,MODULE_NAMES} from './product-last-purchase-sql.mjs';

const HEX=/^[a-f0-9]{64}$/,id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
const lit=s=>"N'"+String(s).replaceAll("'","''")+"'";
const order=(a,b)=>BigInt(a.productId)<BigInt(b.productId)?-1:BigInt(a.productId)>BigInt(b.productId)?1:0;
export const lastPurchaseRowsHash=rows=>hash([...rows].sort(order).map(r=>sqlHash(JSON.stringify(r))).join(''));
export function sourceIndexes(capture){
 check(Array.isArray(capture.products)&&Array.isArray(capture.candidates),'LAST_PURCHASE_SOURCE_ARRAYS');
 const products=new Map(),uniqueCodes=new Map(),candidates=new Map();
 for(const p of capture.products){const key=String(p.sourceId);check(id(key)&&!products.has(key)&&typeof p.stockCode==='string','LAST_PURCHASE_SOURCE_PRODUCT_IDENTITY');products.set(key,p);uniqueCodes.set(p.stockCode,(uniqueCodes.get(p.stockCode)??0)+1);}
 const seen=new Set();for(const c of capture.candidates){const key=String(c.productSourceId),identity=key+'|'+c.kind+'|'+c.sourceKey;check(products.has(key)&&!seen.has(identity),'LAST_PURCHASE_SOURCE_CANDIDATE_IDENTITY');seen.add(identity);if(!candidates.has(key))candidates.set(key,[]);candidates.get(key).push(c);}
 for(const list of candidates.values())list.sort((a,b)=>String(a.sourceKey).localeCompare(String(b.sourceKey))||String(a.kind).localeCompare(String(b.kind)));
 return {products,uniqueCodes,candidates};
}
function validateCapture(capture){
 check(capture.twoPassStable===true&&capture.identity?.server==='DESKTOP-KSRK0EQ'&&capture.identity?.database==='VEGA2026'&&capture.permissions&&Object.keys(capture.permissions).length>=7&&Object.values(capture.permissions).every(x=>x===0),'LAST_PURCHASE_SOURCE_READONLY');
 check(Number.isFinite(Date.parse(capture.startedAt))&&Date.parse(capture.endedAt)>=Date.parse(capture.startedAt)&&Date.parse(capture.endedAt)-Date.parse(capture.startedAt)<=120000&&capture.sourceAsOf===capture.endedAt,'LAST_PURCHASE_SOURCE_INTERVAL');
 check(Array.isArray(capture.rawOutputs)&&capture.rawOutputs.length>=3&&capture.rawOutputs.every(x=>HEX.test(x.queryHash??'')&&Array.isArray(x.rows)&&hash(x.rows)===x.hash)&&hash(capture.rawOutputs.map(x=>({queryHash:x.queryHash,hash:x.hash})))===capture.sourceHash,'LAST_PURCHASE_SOURCE_CAPTURE_HASH');
 const [cards,units,costs]=capture.rawOutputs.slice(0,3).map(x=>x.rows),derived=normalizePurchaseSource({cards,units,costs,sourceAsOf:capture.sourceAsOf});
 check(hash(derived.products)===hash(capture.products)&&hash(derived.candidates)===hash(capture.candidates)&&derived.unlinked===capture.unlinked&&derived.conflictingLinks===capture.conflictingLinks,'LAST_PURCHASE_SOURCE_DERIVED_DRIFT');
 sourceIndexes(capture);return capture;
}
export async function lastPurchaseModuleProof(request){return(await request().query(`SELECT OBJECT_SCHEMA_NAME(object_id)+N'.'+OBJECT_NAME(object_id) name,LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',definition),2)) hash FROM sys.sql_modules WHERE OBJECT_SCHEMA_NAME(object_id)+N'.'+OBJECT_NAME(object_id) NOT IN(${MODULE_NAMES.map(lit).join(',')}) ORDER BY name`)).recordset;}
function verifyOldPins(modules){const actual=new Map(modules.map(m=>[m.name,m.hash]));for(const [name,expected]of Object.entries(PURCHASE_REFERENCE_SQL_PROOF.moduleHashes))check(actual.get(name)===expected,'LAST_PURCHASE_PARENT_SQL_PIN');}
export async function protectedLastPurchaseProof(request){
 const result=await protectedReferenceProof(request);
 for(const [kind,table]of Object.entries(PARENT_TABLES)){const column=kind==='runs'?'run_id':kind==='rows'?'product_id':'object_name';result[table]=(await request().query(`SELECT LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT * FROM ${table} ORDER BY ${column} FOR JSON PATH,INCLUDE_NULL_VALUES)),2)) hash`)).recordset[0].hash;}
 return result;
}
function parentImage(raw){
 check(id(String(raw.product_id))&&typeof raw.record_json==='string'&&HEX.test(raw.record_hash??'')&&sqlHash(raw.record_json)===raw.record_hash,'LAST_PURCHASE_PARENT_IMAGE');
 const r=JSON.parse(raw.record_json);
 check(r.schemaVersion==='melisa-product-purchase-reference.v1'&&r.productId===String(raw.product_id)&&id(r.sourceId)&&HEX.test(r.productHash??'')&&HEX.test(r.bindingHash??'')&&HEX.test(r.sourceHash??'')&&hash(r.rawSource)===r.sourceHash&&typeof r.protectedManual==='boolean'&&typeof r.protectedExistingCost==='boolean'&&r.accountingCost===false&&r.financialWrites===0,'LAST_PURCHASE_PARENT_ROW');
 return r;
}
export function verifyParentSnapshot(manifest,rows){
 check(manifest&&manifest.row_count===16668&&manifest.sealed===true||manifest&&manifest.row_count===16668&&manifest.sealed===1,'LAST_PURCHASE_PARENT_SCOPE');
 check(manifest.status==='COMMITTED'&&HEX.test(manifest.manifest_hash??'')&&HEX.test(manifest.rows_hash??'')&&typeof manifest.run_id==='string'&&Array.isArray(rows)&&rows.length===16668,'LAST_PURCHASE_PARENT_MANIFEST');
 const byId=new Map();for(const r of rows){const p=parentImage(r);check(!byId.has(p.productId),'LAST_PURCHASE_PARENT_DUPLICATE');byId.set(p.productId,{raw:r,parent:p});}
 const digest=hash([...rows].sort((a,b)=>BigInt(a.product_id)<BigInt(b.product_id)?-1:1).map(r=>r.record_hash).join(''));check(digest===manifest.rows_hash,'LAST_PURCHASE_PARENT_ROWS_HASH');
 return {manifest,rows,byId};
}
export async function readParentSnapshot(request){
 await request().query('EXEC dbo.usp_assert_product_purchase_reference @full=1');
 const manifests=(await request().query(`SELECT * FROM ${PARENT_TABLES.runs} WITH(HOLDLOCK)`)).recordset;check(manifests.length===1,'LAST_PURCHASE_PARENT_SINGLE_RUN');
 const rows=(await request().query(`SELECT CONVERT(varchar(20),r.product_id) product_id,r.record_json,r.record_hash FROM ${PARENT_TABLES.rows} r ORDER BY r.product_id`)).recordset;
 return verifyParentSnapshot(manifests[0],rows);
}
function targetIndexes({products,bindings}){return {products:new Map(products.map(p=>[String(p.productId),p])),bindings:new Map(bindings.map(b=>[String(b.product_id),b]))};}
function nativeReason(parent,targets){
 const p=targets.products.get(parent.productId),b=targets.bindings.get(parent.productId);
 if(!p||!b||p.productHash?.toLowerCase()!==parent.productHash||b.binding_hash?.toLowerCase()!==parent.bindingHash||b.bindingRun!==parent.bindingRun||b.bindingKind!==parent.bindingKind||String(b.source_id)!==parent.sourceId||p.stockCode!==parent.stockCode||p.nativeKey!==parent.nativeKey||Number(p.aliasCount)!==1||String(p.aliasSourceId)!==parent.sourceId)return 'TARGET_OR_BINDING_DRIFT';
 if(p.held)return 'HELD_PRODUCT';
 if(p.manualPurchaseProtected!==parent.protectedManual)return 'MANUAL_PURCHASE_DRIFT';
 return null;
}
function selectedImage(parent,parentRecordHash,source,indexes,sourceAsOf){
 const candidates=indexes.candidates.get(parent.sourceId)??[];
 return {...selectLastPurchase({parent,parentRecordHash,source,candidates,uniqueCodes:indexes.uniqueCodes,sourceAsOf}),sourceProductHash:hash(source),candidatesHash:hash(candidates)};
}
export function buildLastPurchasePlan({capture,parentSnapshot,bindings,products,runId,backup,protectedBefore,moduleBefore}){
 validateCapture(capture);verifyOldPins(moduleBefore);
 const parent=verifyParentSnapshot(parentSnapshot.manifest,parentSnapshot.rows),sources=sourceIndexes(capture),targets=targetIndexes({bindings,products}),rows=[],excluded=[];
 for(const {parent:r,raw}of parent.byId.values()){
  const source=sources.products.get(r.sourceId),reason=nativeReason(r,targets)??(!source?'SOURCE_PRODUCT_ABSENT':source.stockCode!==r.stockCode?'SOURCE_PRODUCT_BINDING_DRIFT':null);
  if(reason){excluded.push({productId:r.productId,reason});continue;}
  rows.push(selectedImage(r,raw.record_hash,source,sources,capture.sourceAsOf));
 }
 rows.sort(order);excluded.sort(order);
 const body={schemaVersion:SCHEMA,approval:APPROVAL,runId,target:TARGET,parentRunId:parent.manifest.run_id,parentManifestHash:parent.manifest.manifest_hash,parentRowsHash:parent.manifest.rows_hash,parentRows:16668,sourceHash:capture.sourceHash,sourceAsOf:capture.sourceAsOf,sourceRead:{startedAt:capture.startedAt,endedAt:capture.endedAt,queryHashes:capture.rawOutputs.map(x=>({queryHash:x.queryHash,rowsHash:x.hash,count:x.rows.length}))},rows,excluded,backup,protectedBefore,moduleBefore,financialWrites:0,costWrites:0,stockWrites:0,salesPriceWrites:0};
 const plan={...body,manifestHash:hash(body)};validateLastPurchasePlan(plan);return plan;
}
async function targetIdentity(request){const x=(await request().query("SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()) admin")).recordset[0];check(x?.server===TARGET.server&&x.database===TARGET.database&&x.admin===1,'LAST_PURCHASE_WRONG_TEST_TARGET');}
export async function prepareLastPurchaseReferences({connectSource,backup,runId,getTarget=targetPool,captureSource=captureLastPurchaseSource}){
 const capture=validateCapture(await captureSource(connectSource)),t=await getTarget();try{
  const request=()=>t.pool.request();await targetIdentity(request);const parentSnapshot=await readParentSnapshot(request),current=await collectTargetBindings(request),moduleBefore=await lastPurchaseModuleProof(request);
  return buildLastPurchasePlan({capture,parentSnapshot,...current,runId,backup,protectedBefore:await protectedLastPurchaseProof(request),moduleBefore});
 }finally{await t.pool.close();}
}
export async function readLastPurchaseRows(request){return(await request().query(`SELECT CONVERT(varchar(20),r.product_id) product_id,r.record_json,r.record_hash FROM ${TABLES.rows} r ORDER BY r.product_id`)).recordset;}
export function validateLastPurchaseReadback(actual,expected){
 const byId=new Map(expected.map(r=>[r.productId,JSON.stringify(r)]));check(byId.size===expected.length&&Array.isArray(actual)&&actual.length===expected.length&&new Set(actual.map(r=>r.product_id)).size===actual.length,'LAST_PURCHASE_READBACK_COUNT');
 for(const r of actual)check(byId.get(r.product_id)===r.record_json&&sqlHash(r.record_json)===r.record_hash,'LAST_PURCHASE_READBACK_IMAGE');return true;
}
export function compareLastPurchaseRows({plan,capture,parentSnapshot,products,bindings}){
 validateLastPurchasePlan(plan);validateCapture(capture);
 const parent=verifyParentSnapshot(parentSnapshot.manifest,parentSnapshot.rows);check(parent.manifest.manifest_hash===plan.parentManifestHash&&parent.manifest.rows_hash===plan.parentRowsHash&&parent.manifest.run_id===plan.parentRunId,'LAST_PURCHASE_PARENT_CAS');
 const sources=sourceIndexes(capture),targets=targetIndexes({products,bindings}),rows=[],skipped=[];
 for(const frozen of plan.rows){
  const entry=parent.byId.get(frozen.productId),source=sources.products.get(frozen.sourceId);let reason=!entry||entry.raw.record_hash!==frozen.parentRecordHash?'PARENT_RECORD_DRIFT':nativeReason(entry.parent,targets);
  if(!reason&&(!source||source.stockCode!==frozen.stockCode||hash(source)!==frozen.sourceProductHash||hash(sources.candidates.get(frozen.sourceId)??[])!==frozen.candidatesHash))reason='SOURCE_PRODUCT_OR_CANDIDATES_DRIFT';
  if(!reason){const fresh=selectedImage(entry.parent,entry.raw.record_hash,source,sources,plan.sourceAsOf);if(JSON.stringify(fresh)!==JSON.stringify(frozen))reason='SOURCE_SELECTION_DRIFT';}
  if(reason)skipped.push({productId:frozen.productId,reason});else rows.push(frozen);
 }
 return {rows:[...rows].sort(order),skipped};
}
export function replayLastPurchaseDecision(existing,plan){validateLastPurchasePlan(plan);if(!existing)return 'INSERT';check(existing.run_id===plan.runId&&existing.manifest_hash===plan.manifestHash&&existing.parent_manifest_hash===plan.parentManifestHash&&existing.parent_rows_hash===plan.parentRowsHash,'LAST_PURCHASE_REPLAY_BODY_CHANGED');return 'REPLAY_NOOP';}
async function verifyBackupFile(backup){const digest=createHash('sha256');for await(const bytes of fs.createReadStream(backup.file))digest.update(bytes);check(digest.digest('hex')===backup.sha256,'LAST_PURCHASE_BACKUP_HASH');}
export async function applyLastPurchaseReferences({plan,connectSource,getTarget=targetPool,captureSource=captureLastPurchaseSource,verifyBackup=verifyBackupFile}){
 validateLastPurchasePlan(plan);const capture=validateCapture(await captureSource(connectSource));await verifyBackup(plan.backup);const t=await getTarget();let tx;
 try{
  tx=new t.sql.Transaction(t.pool);await tx.begin(t.sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>new t.sql.Request(tx),q=s=>request().query(s);await targetIdentity(request);
  await q("SET XACT_ABORT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @lock<0 THROW 51139,'LAST_PURCHASE_LOCK_FAILED',1;");
  const parentSnapshot=await readParentSnapshot(request),moduleBefore=await lastPurchaseModuleProof(request);verifyOldPins(moduleBefore);check(hash(moduleBefore)===hash(plan.moduleBefore),'LAST_PURCHASE_OLD_MODULE_DRIFT');
  const current=await collectTargetBindings(request),comparison=compareLastPurchaseRows({plan,capture,parentSnapshot,...current});
  const exists=(await q(`SELECT OBJECT_ID(N'${TABLES.runs}',N'U') id`)).recordset[0].id;
  if(exists){
   const manifests=(await q(`SELECT * FROM ${TABLES.runs} WITH(UPDLOCK,HOLDLOCK)`)).recordset;check(manifests.length===1,'LAST_PURCHASE_EXISTING_MANIFEST');replayLastPurchaseDecision(manifests[0],plan);await q('EXEC dbo.usp_assert_product_last_purchase @full=1');
   const actual=await readLastPurchaseRows(request),receipt=JSON.parse(manifests[0].manifest_json);check(Array.isArray(receipt.appliedProductIds)&&new Set(receipt.appliedProductIds).size===receipt.appliedProductIds.length,'LAST_PURCHASE_REPLAY_RECEIPT');
   const wanted=new Set(receipt.appliedProductIds),expected=plan.rows.filter(r=>wanted.has(r.productId));check(expected.length===wanted.size&&comparison.skipped.every(s=>!wanted.has(s.productId)),'LAST_PURCHASE_REPLAY_NATIVE_OR_SOURCE_DRIFT');
   validateLastPurchaseReadback(actual,expected);check(lastPurchaseRowsHash(expected)===manifests[0].rows_hash,'LAST_PURCHASE_REPLAY_ROWS_HASH');
   await tx.rollback();tx=null;return {status:'REPLAY_NOOP',manifestHash:plan.manifestHash,metadataWrites:0,financialWrites:0,costWrites:0,stockWrites:0,salesPriceWrites:0,rows:actual.length};
  }
  const partial=(await q(`SELECT COUNT(*) n FROM sys.tables WHERE schema_id=SCHEMA_ID(N'erp_migration') AND name IN(N'product_last_purchase_runs',N'product_last_purchase_rows',N'product_last_purchase_proof')`)).recordset[0].n;check(partial===0,'LAST_PURCHASE_PARTIAL_INSTALL');
  const {rows,skipped}=comparison;check(rows.length>0,'LAST_PURCHASE_NO_SAFE_ROWS');const before=await protectedLastPurchaseProof(request);await q(DDL);
  const receipt={schemaVersion:SCHEMA,runId:plan.runId,manifestHash:plan.manifestHash,parentRunId:plan.parentRunId,parentManifestHash:plan.parentManifestHash,parentRowsHash:plan.parentRowsHash,sourceHash:plan.sourceHash,sourceAsOf:plan.sourceAsOf,applyCaptureHash:capture.sourceHash,applyReadAt:capture.sourceAsOf,appliedProductIds:rows.map(r=>r.productId),skipped,rowCount:rows.length,rowsHash:lastPurchaseRowsHash(rows)},json=JSON.stringify(receipt);
  await request().input('run',t.sql.NVarChar(80),plan.runId).input('manifest',t.sql.Char(64),plan.manifestHash).input('json',t.sql.NVarChar(t.sql.MAX),json).input('sqlhash',t.sql.Char(64),sqlHash(json)).input('n',t.sql.Int,rows.length).input('rowsHash',t.sql.Char(64),lastPurchaseRowsHash(rows)).input('source',t.sql.Char(64),plan.sourceHash).input('at',t.sql.NVarChar(40),plan.sourceAsOf).input('parentRun',t.sql.NVarChar(80),plan.parentRunId).input('parentManifest',t.sql.Char(64),plan.parentManifestHash).input('parentRows',t.sql.Char(64),plan.parentRowsHash).query(`INSERT ${TABLES.runs}(run_id,manifest_hash,manifest_json,manifest_sql_hash,row_count,rows_hash,source_hash,source_as_of,parent_run_id,parent_manifest_hash,parent_rows_hash,status,sealed) VALUES(@run,@manifest,@json,@sqlhash,@n,@rowsHash,@source,@at,@parentRun,@parentManifest,@parentRows,N'COMMITTED',1)`);
  for(let i=0;i<rows.length;i+=100){const values=rows.slice(i,i+100).map(r=>({productId:r.productId,runId:plan.runId,sourceId:r.sourceId,stockCode:r.stockCode,nativeKey:r.nativeKey,bindingKind:r.bindingKind,bindingRun:r.bindingRun,bindingHash:r.bindingHash,productHash:r.productHash,parentRecordHash:r.parentRecordHash,sourceProductHash:r.sourceProductHash,candidatesHash:r.candidatesHash,recordJson:JSON.stringify(r),recordHash:sqlHash(JSON.stringify(r))}));
   await request().input('rows',t.sql.NVarChar(t.sql.MAX),JSON.stringify(values)).query(`INSERT ${TABLES.rows}(product_id,run_id,source_id,stock_code,native_source_key,binding_kind,binding_run,binding_hash,product_hash,parent_record_hash,source_product_hash,candidates_hash,record_json,record_hash) SELECT productId,runId,sourceId,stockCode,nativeKey,bindingKind,bindingRun,bindingHash,productHash,parentRecordHash,sourceProductHash,candidatesHash,recordJson,recordHash FROM OPENJSON(@rows) WITH(productId bigint,runId nvarchar(80),sourceId bigint,stockCode nvarchar(250),nativeKey nvarchar(400),bindingKind nvarchar(20),bindingRun nvarchar(80),bindingHash char(64),productHash char(64),parentRecordHash char(64),sourceProductHash char(64),candidatesHash char(64),recordJson nvarchar(max),recordHash char(64))`);
  }
  const proofTrigger='erp_migration.immutable_product_last_purchase_proof';for(const [name,definition]of DEFINITIONS)if(name!==proofTrigger)await q(definition);
  for(const name of MODULE_NAMES){const expected=sqlHash(DEFINITIONS.get(name));if(name!==proofTrigger){const actual=(await q(`SELECT LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${lit(name)}))),2)) hash`)).recordset[0].hash;check(actual===expected,'LAST_PURCHASE_CREATED_DEFINITION');}
   await request().input('name',t.sql.NVarChar(180),name).input('hash',t.sql.Char(64),expected).query(`INSERT ${TABLES.proof}(object_name,definition_hash) VALUES(@name,@hash)`);
  }
  await q(DEFINITIONS.get(proofTrigger));await q('EXEC dbo.usp_assert_product_last_purchase @full=1');
  check(hash(await protectedLastPurchaseProof(request))===hash(before),'LAST_PURCHASE_PROTECTED_DATA_CHANGED');check(hash(await lastPurchaseModuleProof(request))===hash(plan.moduleBefore),'LAST_PURCHASE_OLD_MODULE_CHANGED');
  const readback=await readLastPurchaseRows(request);validateLastPurchaseReadback(readback,rows);await tx.commit();tx=null;
  return {status:'LAST_PURCHASE_METADATA_COMMITTED',manifestHash:plan.manifestHash,parentManifestHash:plan.parentManifestHash,metadataWrites:rows.length,financialWrites:0,costWrites:0,stockWrites:0,salesPriceWrites:0,skipped,summary:summarizeLastPurchase(rows,plan.excluded),protectedGroups:Object.keys(before).length,applyCaptureHash:capture.sourceHash};
 }catch(e){if(tx)await tx.rollback().catch(()=>{});throw e;}finally{await t.pool.close();}
}
