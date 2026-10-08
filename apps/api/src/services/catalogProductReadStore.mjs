import {catalogError,parseCatalogId,catalogReadResult} from './catalogModel.mjs';
import {CATALOG_SQL_PROOF} from './catalogSqlProof.mjs';
import {catalogClassificationStore} from './catalogClassificationStore.mjs';
import {isBoundCatalogContext,validateBoundCatalogContext} from './currentProductCatalogContext.mjs';
import {isIsolatedOperationCopyRuntime,getIsolatedOperationCopyConfig} from '../config/isolatedOperationCopyRuntime.mjs';
export const CATALOG_READ_PROC='dbo.usp_read_work_catalog';
export const SOURCE_VERSION_CATALOG_READ_PROC='dbo.usp_read_work_catalog_goal7';
function sourceVersionContext(v){
 if(isBoundCatalogContext(v))return validateBoundCatalogContext(v);
 if(!v||!/^GOAL7-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.runId)||v.sourceAsOf!=='2026-10-07'||v.productCount!==16671||!Number.isInteger(v.priceCount)||v.priceCount<=63774||['sourceHash','planHash','bindingsHash','readerDefinitionHash'].some(k=>typeof v[k]!=='string'||!/^[a-f0-9]{64}$/i.test(v[k])))throw catalogError();
 return Object.freeze({...v});
}
async function defaultRuntime(){const db=await import('../config/database.js');if(!db.isCanonicalTest()&&!isIsolatedOperationCopyRuntime())throw catalogError();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createCatalogProductReadStore({getRuntime=defaultRuntime,classificationStore=catalogClassificationStore}={}){
  let version=null,versionRequested=false;
  const proof=()=>({...CATALOG_SQL_PROOF,...(isIsolatedOperationCopyRuntime()?getIsolatedOperationCopyConfig().catalogProof:{}),...(version?{readerDefinitionHash:version.readerDefinitionHash.toUpperCase()}:{})});
  const assertVersion=row=>{if(versionRequested&&!version)throw catalogError();if(version&&['RunId','SourceHash','PlanHash','BindingsHash'].some(k=>row['sourceVersion'+k]!==version[k[0].toLowerCase()+k.slice(1)]))throw catalogError();};
  return {configureSourceVersion(context){versionRequested=true;version=null;version=sourceVersionContext(context);},sourceVersion(){if(versionRequested&&!version)throw catalogError();return version;},async readCatalogProducts({actorId,productId=null,options,mediaBindingsJson='[]'}){
    parseCatalogId(actorId);if(productId!==null)parseCatalogId(productId);let tx;
    try{
      const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const identity=(await new sql.Request(tx).query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server")).recordset?.[0];
      if(identity?.db!==(isIsolatedOperationCopyRuntime()?getIsolatedOperationCopyConfig().target.database:'MELISA_ERP_SIRKET_TEST_20260929_01')||identity.server!=='Semih\\MELISADEV')throw catalogError();
      const selection=classificationStore.selection({productId,options});
      const req=new sql.Request(tx).input('actor_id',sql.BigInt,actorId).input('product_id',sql.BigInt,productId).input('search',sql.NVarChar(120),options.search).input('barcode',sql.NVarChar(160),options.barcode).input('stock',sql.NVarChar(12),options.stock).input('status',sql.NVarChar(12),options.status).input('page',sql.Int,options.page).input('page_size',sql.Int,options.limit);
      req.input('brand',sql.NVarChar(250),options.brand).input('product_type',sql.NVarChar(250),options.productType).input('image',sql.NVarChar(12),options.image).input('sort',sql.NVarChar(12),options.sort).input('media_bindings',sql.NVarChar(sql.MAX),mediaBindingsJson);
      req.input('candidate_bindings',sql.NVarChar(sql.MAX),selection.candidatesJson);
      if(versionRequested&&!version)throw catalogError();
      const records=(await req.execute(isBoundCatalogContext(version)?version.procedures.catalog:version?SOURCE_VERSION_CATALOG_READ_PROC:CATALOG_READ_PROC)).recordset;if(!Array.isArray(records)||records.length!==1)throw catalogError();const row=records[0];assertVersion(row);
      if(row.actorId!==actorId||row.canView!==true||typeof row.rowsJson!=='string'||Object.entries(proof()).some(([key,value])=>row[key]!==value))throw catalogError();
      const result={actorId:row.actorId,canViewSalesPrices:row.canViewSalesPrices,total:row.total,page:row.page,limit:row.limit,readAt:row.readAt,acceptedCount:row.acceptedCount,syntheticCount:row.syntheticCount,quarantinedCount:row.quarantinedCount,rows:JSON.parse(row.rowsJson),filters:selection.filters,...(version?{sourceVersion:version}:{})};
      const validated=catalogReadResult(result,{actorId,productId,options,canViewSalesPrices:row.canViewSalesPrices});for(const row of validated.data)classificationStore.assertRow(row);await tx.commit();return result;
    }catch{if(tx)try{await tx.rollback();}catch{}throw catalogError();}
  },async validateCatalogClassification({entriesJson,actorId}){
    parseCatalogId(actorId);let tx;
    try{
      const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const identity=(await new sql.Request(tx).query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server")).recordset?.[0];
      if(identity?.db!==(isIsolatedOperationCopyRuntime()?getIsolatedOperationCopyConfig().target.database:'MELISA_ERP_SIRKET_TEST_20260929_01')||identity.server!=='Semih\\MELISADEV')throw catalogError();
      if(versionRequested&&!version)throw catalogError();
      const rows=(await new sql.Request(tx,{requestTimeout:60000}).input('actor_id',sql.BigInt,actorId).input('classification_validation',sql.Bit,true).input('classification_bindings',sql.NVarChar(sql.MAX),entriesJson).execute(isBoundCatalogContext(version)?version.procedures.catalog:version?SOURCE_VERSION_CATALOG_READ_PROC:CATALOG_READ_PROC)).recordset;
      if(!Array.isArray(rows)||rows.length!==1||rows[0].actorId!==actorId||rows[0].canView!==true||rows[0].classificationValidated!==true||Object.entries(proof()).some(([key,value])=>rows[0][key]!==value))throw catalogError();assertVersion(rows[0]);
      await tx.commit();return {validated:true};
    }catch{if(tx)try{await tx.rollback();}catch{}throw catalogError();}
  }};
}
export const {readCatalogProducts,validateCatalogClassification,configureSourceVersion:configureCatalogSourceVersion,sourceVersion:catalogSourceVersion}=createCatalogProductReadStore();
