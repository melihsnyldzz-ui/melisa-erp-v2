import {createHash} from 'node:crypto';
import {assertIsolatedCopyActor,assertIsolatedCopyContext,assertIsolatedCopyIdentity,copyAssert,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {card,selected,lastPurchaseSqlHash} from './productLastPurchaseReferenceService.mjs';
import {applyRolePermissionDefaults,expandPermissions} from './permissionCatalog.js';
import {ASSERT_SQL as PARENT_ASSERT,READER_SQL as PARENT_READER,PURCHASE_REFERENCE_SQL_PROOF} from '../../../../scripts/migration/product-purchase-reference-sql.mjs';
import {ASSERT_SQL as SELECTED_ASSERT,READER_SQL as SELECTED_READER,LAST_PURCHASE_SQL_PROOF} from '../../../../scripts/migration/product-last-purchase-sql.mjs';

// This reader is registered only by the isolated DB02 startup. The original
// canonical reader and its SQL target guard are deliberately left untouched.
const HEX=/^[a-f0-9]{64}$/;
const identitySQL="SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess";
const expected={...PURCHASE_REFERENCE_SQL_PROOF.moduleHashes,...LAST_PURCHASE_SQL_PROOF.moduleHashes};
const moduleNames=Object.keys(expected).sort();
const triggerNames=moduleNames.filter(n=>n.startsWith('erp_migration.immutable_product_'));
const quoted=moduleNames.map(n=>`N'${n}'`).join(',');
const moduleSQL=`SELECT s.name+N'.'+o.name object_name,LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2)) definition_hash,CONVERT(int,ISNULL(t.is_disabled,0)) trigger_disabled FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id LEFT JOIN sys.triggers t ON t.object_id=o.object_id WHERE s.name+N'.'+o.name IN(${quoted});`;
const proofSQL='SELECT object_name,definition_hash FROM erp_migration.product_purchase_reference_proof UNION ALL SELECT object_name,definition_hash FROM erp_migration.product_last_purchase_proof;';
const runSQL=`SELECT run_id,manifest_hash,row_count,rows_hash,source_hash,source_as_of,status,sealed,manifest_json,manifest_sql_hash FROM erp_migration.product_purchase_reference_runs;
SELECT run_id,manifest_hash,row_count,rows_hash,source_hash,source_as_of,parent_run_id,parent_manifest_hash,parent_rows_hash,status,sealed,manifest_json,manifest_sql_hash FROM erp_migration.product_last_purchase_runs;`;
const compactRunSQL=`SELECT run_id,manifest_hash,row_count,rows_hash,source_hash,source_as_of,status,sealed FROM erp_migration.product_purchase_reference_runs;
SELECT run_id,manifest_hash,row_count,rows_hash,source_hash,source_as_of,parent_run_id,parent_manifest_hash,parent_rows_hash,status,sealed FROM erp_migration.product_last_purchase_runs;`;

const fail=(code='PURCHASE_REFERENCE_UNAVAILABLE',statusCode=503,message='Alış referansı şu anda doğrulanamıyor.')=>Object.assign(new Error(message),{code,statusCode});
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.toSorted().join(',');
const digest=value=>createHash('sha256').update(value).digest('hex');
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&!Number.isNaN(Date.parse(value));
const pinnedRun=(value,selectedRun=false)=>sameKeys(value,selectedRun?['runId','manifestHash','rowCount','rowsHash','sourceHash','sourceAsOf','parentRunId','parentManifestHash','parentRowsHash']:['runId','manifestHash','rowCount','rowsHash','sourceHash','sourceAsOf'])&&typeof value.runId==='string'&&value.runId.length>0&&value.runId.length<=80&&Number.isSafeInteger(value.rowCount)&&value.rowCount>0&&['manifestHash','rowsHash','sourceHash',...(selectedRun?['parentManifestHash','parentRowsHash']:[])].every(k=>HEX.test(value[k]))&&date(value.sourceAsOf)&&(!selectedRun||typeof value.parentRunId==='string'&&value.parentRunId.length>0);

export function validateProductCopyPurchaseReferencePin(copy,pin){
 assertIsolatedCopyContext(copy);
 copyAssert(copy.target.database===BUSINESS_COPY_DATABASE&&sameKeys(pin,['schemaVersion','copyId','copySealHash','server','database','parent','selected','descriptorHash'])&&pin.schemaVersion==='melisa-copy-purchase-reference-read.v1'&&pin.copyId===copy.copyId&&pin.copySealHash===copy.sealHash&&pin.server===copy.target.server&&pin.database===copy.target.database&&pinnedRun(pin.parent)&&pinnedRun(pin.selected,true)&&pin.selected.parentRunId===pin.parent.runId&&pin.selected.parentManifestHash===pin.parent.manifestHash&&pin.selected.parentRowsHash===pin.parent.rowsHash&&pin.parent.rowCount===16668&&pin.selected.rowCount===16667,'COPY_PURCHASE_REFERENCE_PIN');
 const {descriptorHash,...body}=pin;
 copyAssert(HEX.test(descriptorHash)&&digest(JSON.stringify(body))===descriptorHash,'COPY_PURCHASE_REFERENCE_PIN_HASH');
 return Object.freeze({...pin,parent:Object.freeze({...pin.parent}),selected:Object.freeze({...pin.selected})});
}

function requireModules(rows,proofRows){
 if(!Array.isArray(rows)||rows.length!==10||new Set(rows.map(r=>r.object_name)).size!==10||rows.some(r=>expected[r.object_name]!==r.definition_hash||triggerNames.includes(r.object_name)&&r.trigger_disabled!==0))throw fail();
 if(proofRows!==undefined&&(!Array.isArray(proofRows)||proofRows.length!==10||new Set(proofRows.map(r=>r.object_name)).size!==10||proofRows.some(r=>expected[r.object_name]!==r.definition_hash)))throw fail();
}
function requireRuns(sets,pin,{full=false}={}){
 if(!Array.isArray(sets)||sets.length!==2||sets.some(set=>!Array.isArray(set)||set.length!==1))throw fail();
 for(const [actual,locked]of [[sets[0][0],pin.parent],[sets[1][0],pin.selected]]){
  if(actual.run_id!==locked.runId||actual.manifest_hash!==locked.manifestHash||actual.row_count!==locked.rowCount||actual.rows_hash!==locked.rowsHash||actual.source_hash!==locked.sourceHash||actual.source_as_of!==locked.sourceAsOf||actual.status!=='COMMITTED'||actual.sealed!==true&&actual.sealed!==1||full&&(typeof actual.manifest_json!=='string'||lastPurchaseSqlHash(actual.manifest_json)!==actual.manifest_sql_hash))throw fail();
 }
 const child=sets[1][0];if(child.parent_run_id!==pin.selected.parentRunId||child.parent_manifest_hash!==pin.selected.parentManifestHash||child.parent_rows_hash!==pin.selected.parentRowsHash)throw fail();
}
function sourceBody(sql,kind){
 const start=sql.indexOf('IF (SELECT COUNT(*) FROM erp_migration.product_'+kind+'_proof)');
 const end=sql.lastIndexOf('END END');
 if(start<0||end<=start||sql.slice(start,end).split('IF @full=1 BEGIN').length!==2)throw Error('COPY_PURCHASE_REFERENCE_SOURCE_CONTRACT');
 return sql.slice(start,end).replace('IF @full=1 BEGIN','BEGIN')+'END';
}
function selectedGuards(){
 const start=SELECTED_READER.indexOf('IF EXISTS(SELECT 1 FROM erp_migration.product_purchase_reference_rows');
 const end=SELECTED_READER.indexOf('SELECT DB_NAME() databaseName');
 if(start<0||end<=start||!SELECTED_READER.slice(start,end).includes('LAST_PURCHASE_MANUAL_DRIFT')||!SELECTED_READER.slice(start,end).includes('PURCHASE_REFERENCE_NATIVE_DRIFT'))throw Error('COPY_PURCHASE_REFERENCE_READER_CONTRACT');
 return SELECTED_READER.slice(start,end);
}
// The source assertions already define the complete row/manifest/parent proof.
// Only their original-database target guard and proc invocation are excluded;
// DB02 has its own exact sealed-copy identity and cannot EXEC those procs.
const startupProofSQL=sourceBody(PARENT_ASSERT,'purchase_reference')+'\n'+sourceBody(SELECTED_ASSERT,'last_purchase');
const selectedGuardSQL=selectedGuards();
const productSQL=`${selectedGuardSQL}
SELECT CONVERT(varchar(20),p.id) requestedProductId,p.stock_code stockCode FROM dbo.products p WHERE p.id=@product_id AND ISNULL(p.is_deleted,0)=0;
SELECT r.record_json rowJson,r.record_hash rowHash FROM erp_migration.product_purchase_reference_rows r WHERE r.product_id=@product_id;
SELECT r.record_json rowJson,r.record_hash rowHash FROM erp_migration.product_last_purchase_rows r WHERE r.product_id=@product_id;`;

let registered=null;
export function registeredProductCopyPurchaseReferenceRead(){return registered;}
export async function configureProductCopyPurchaseReferenceRead({copy,pin,pool,sql}){
 const locked=validateProductCopyPurchaseReferencePin(copy,pin);
 copyAssert(!registered&&pool&&sql?.Transaction&&sql?.Request&&sql?.ISOLATION_LEVEL?.SERIALIZABLE,'COPY_PURCHASE_REFERENCE_STARTUP');
 let tx;
 try{
  tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const request=()=>new sql.Request(tx);
  assertIsolatedCopyIdentity(copy,(await request().query(identitySQL)).recordset?.[0]);
  const modules=(await request().query(moduleSQL)).recordset;
  const proofs=(await request().query(proofSQL)).recordset;
  requireModules(modules,proofs);
  requireRuns((await request().query(runSQL)).recordsets,locked,{full:true});
  await request().query(startupProofSQL);
  await tx.commit();
  registered=Object.freeze({copy,pin:locked});
  return registered;
 }catch(error){if(tx)try{await tx.rollback();}catch{}throw fail();}
}

async function defaultRuntime(){
 const db=await import('../config/database.js');
 if(!registered||!db.isIsolatedOperationCopyRuntime()||db.getIsolatedOperationCopyConfig()!==registered.copy)throw fail();
 return {...registered,pool:await db.getSqlPool(),sql:db.getSqlDriver()};
}
async function readCurrentActor(request,sql,id){
 const sets=(await request.input('actor_id',sql.BigInt,id).query(`SELECT CONVERT(varchar(20),u.id) id,r.code role_code,CONVERT(bit,u.is_active) user_active,CONVERT(bit,r.is_active) role_active FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=@actor_id;
SELECT p.permission_key,p.can_view,p.can_create,p.can_update,p.can_approve FROM dbo.permissions p JOIN dbo.users u ON u.role_id=p.role_id JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=@actor_id AND u.is_active=1 AND r.is_active=1 AND(p.can_view=1 OR p.can_create=1 OR p.can_update=1 OR p.can_approve=1) ORDER BY p.permission_key;`)).recordsets;
 const row=sets?.[0]?.length===1?sets[0][0]:null,permissions=Array.isArray(sets?.[1])?applyRolePermissionDefaults(expandPermissions(sets[1]),row?.role_code):[];
 if(!row||row.user_active!==true&&row.user_active!==1||row.role_active!==true&&row.role_active!==1)throw fail('AUTH_PERMISSION_DENIED',403,'Bu bilgi için yetkiniz bulunmuyor.');
 return {id:row.id,role:row.role_code,active:true,permissions};
}
export function createProductCopyPurchaseReferenceService({getRuntime=defaultRuntime,getCurrentActor=readCurrentActor}={}){
 return {async read(id,query={},actor){
  if(typeof id!=='string'||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n||!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).length)throw fail('PURCHASE_REFERENCE_INPUT',400,'Ürün kimliği veya okuma isteği geçersiz.');
  if(!actor)throw fail('AUTH_TOKEN_REQUIRED',401,'Oturum gerekli.');
  if(!Array.isArray(actor.permissions)||!['product.view','purchase.view','finance.view'].every(k=>actor.permissions.includes(k)))throw fail('AUTH_PERMISSION_DENIED',403,'Bu bilgi için yetkiniz bulunmuyor.');
  let tx;
  try{
   const runtime=await getRuntime(),{copy,pin,pool,sql}=runtime;
   validateProductCopyPurchaseReferencePin(copy,pin);
   tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
   const request=()=>new sql.Request(tx);
   assertIsolatedCopyIdentity(copy,(await request().query(identitySQL)).recordset?.[0]);
   const actual=await getCurrentActor(request(),sql,actor.id);
   if(actor.role?.code!==actual?.role)throw fail('AUTH_PERMISSION_DENIED',403,'Bu bilgi için yetkiniz bulunmuyor.');
   for(const permission of ['product.view','purchase.view','finance.view'])assertIsolatedCopyActor(copy,actor,actual,permission);
   requireModules((await request().query(moduleSQL)).recordset,(await request().query(proofSQL)).recordset);
   requireRuns((await request().query(compactRunSQL)).recordsets,pin);
   const sets=(await request().input('product_id',sql.BigInt,id).query(productSQL)).recordsets;
   if(!Array.isArray(sets)||sets.length!==3||!Array.isArray(sets[0])||sets[0].length>1||!Array.isArray(sets[1])||sets[1].length>1||!Array.isArray(sets[2])||sets[2].length>1)throw fail();
   if(sets[0].length===0)throw fail('PURCHASE_REFERENCE_NOT_FOUND',404,'Ürün bulunamadı.');
   if(sets[0][0].requestedProductId!==id||typeof sets[0][0].stockCode!=='string'||!sets[0][0].stockCode||sets[1].length!==1||sets[2].length!==1)throw fail();
   const [parent,child]=[sets[1][0],sets[2][0]];
   for(const row of [parent,child])if(typeof row.rowJson!=='string'||!HEX.test(row.rowHash??'')||lastPurchaseSqlHash(row.rowJson)!==row.rowHash)throw fail();
   const c=card(JSON.parse(parent.rowJson),id,sets[0][0].stockCode);
   const data=selected(JSON.parse(child.rowJson),c,parent.rowHash,id,sets[0][0].stockCode,pin.selected.sourceAsOf);
   await tx.commit();return {data,meta:{readOnly:true,financialEffect:false}};
  }catch(error){if(tx)try{await tx.rollback();}catch{}if([400,401,403,404].includes(error?.statusCode))throw error;throw fail();}
 }};
}
export const productCopyPurchaseReferenceService=createProductCopyPurchaseReferenceService();
