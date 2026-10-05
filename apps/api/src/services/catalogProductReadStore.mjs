import {catalogError,parseCatalogId,catalogReadResult} from './catalogModel.mjs';
import {CATALOG_SQL_PROOF} from './catalogSqlProof.mjs';
import {catalogClassificationStore} from './catalogClassificationStore.mjs';
export const CATALOG_READ_PROC='dbo.usp_read_work_catalog';
async function defaultRuntime(){const db=await import('../config/database.js');if(!db.isCanonicalTest())throw catalogError();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createCatalogProductReadStore({getRuntime=defaultRuntime,classificationStore=catalogClassificationStore}={}){
  return {async readCatalogProducts({actorId,productId=null,options,mediaBindingsJson='[]'}){
    parseCatalogId(actorId);if(productId!==null)parseCatalogId(productId);let tx;
    try{
      const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const identity=(await new sql.Request(tx).query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server")).recordset?.[0];
      if(identity?.db!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity.server!=='Semih\\MELISADEV')throw catalogError();
      const selection=classificationStore.selection({productId,options});
      const req=new sql.Request(tx).input('actor_id',sql.BigInt,actorId).input('product_id',sql.BigInt,productId).input('search',sql.NVarChar(120),options.search).input('barcode',sql.NVarChar(160),options.barcode).input('stock',sql.NVarChar(12),options.stock).input('status',sql.NVarChar(12),options.status).input('page',sql.Int,options.page).input('page_size',sql.Int,options.limit);
      req.input('brand',sql.NVarChar(250),options.brand).input('product_type',sql.NVarChar(250),options.productType).input('image',sql.NVarChar(12),options.image).input('sort',sql.NVarChar(12),options.sort).input('media_bindings',sql.NVarChar(sql.MAX),mediaBindingsJson);
      req.input('candidate_bindings',sql.NVarChar(sql.MAX),selection.candidatesJson);
      const records=(await req.execute(CATALOG_READ_PROC)).recordset;if(!Array.isArray(records)||records.length!==1)throw catalogError();const row=records[0];
      if(row.actorId!==actorId||row.canView!==true||typeof row.rowsJson!=='string'||Object.entries(CATALOG_SQL_PROOF).some(([key,value])=>row[key]!==value))throw catalogError();
      const result={actorId:row.actorId,canViewSalesPrices:row.canViewSalesPrices,total:row.total,page:row.page,limit:row.limit,readAt:row.readAt,acceptedCount:row.acceptedCount,syntheticCount:row.syntheticCount,quarantinedCount:row.quarantinedCount,rows:JSON.parse(row.rowsJson),filters:selection.filters};
      const validated=catalogReadResult(result,{actorId,productId,options,canViewSalesPrices:row.canViewSalesPrices});for(const row of validated.data)classificationStore.assertRow(row);await tx.commit();return result;
    }catch{if(tx)try{await tx.rollback();}catch{}throw catalogError();}
  },async validateCatalogClassification({entriesJson,actorId}){
    parseCatalogId(actorId);let tx;
    try{
      const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const identity=(await new sql.Request(tx).query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server")).recordset?.[0];
      if(identity?.db!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity.server!=='Semih\\MELISADEV')throw catalogError();
      const rows=(await new sql.Request(tx).input('actor_id',sql.BigInt,actorId).input('classification_validation',sql.Bit,true).input('classification_bindings',sql.NVarChar(sql.MAX),entriesJson).execute(CATALOG_READ_PROC)).recordset;
      if(!Array.isArray(rows)||rows.length!==1||rows[0].actorId!==actorId||rows[0].canView!==true||rows[0].classificationValidated!==true||Object.entries(CATALOG_SQL_PROOF).some(([key,value])=>rows[0][key]!==value))throw catalogError();
      await tx.commit();return {validated:true};
    }catch{if(tx)try{await tx.rollback();}catch{}throw catalogError();}
  }};
}
export const {readCatalogProducts,validateCatalogClassification}=createCatalogProductReadStore();
