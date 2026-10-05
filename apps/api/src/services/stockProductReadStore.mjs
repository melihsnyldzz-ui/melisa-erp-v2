import {stockProductError,parseStockProductId,stockProductDto,stockReadTimestamp} from './stockProductModel.mjs';
import {STOCK_PRODUCT_SQL_PROOF} from './stockProductSqlProof.mjs';
export const STOCK_PRODUCT_READ_PROC='dbo.usp_read_stock_products';
async function defaultRuntime(){const db=await import('../config/database.js');if(!db.isCanonicalTest())throw stockProductError();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createStockProductReadStore({getRuntime=defaultRuntime}={}){
  return {async readStockProducts({actorId,productId=null,options}){
    parseStockProductId(actorId);if(productId!==null)parseStockProductId(productId);
    let tx;
    try{
      const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const identity=(await new sql.Request(tx).query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server")).recordset?.[0];
      if(identity?.db!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity.server!=='Semih\\MELISADEV')throw stockProductError();
      const req=new sql.Request(tx).input('actor_id',sql.BigInt,actorId).input('product_id',sql.BigInt,productId).input('search',sql.NVarChar(120),options.search).input('barcode',sql.NVarChar(160),options.barcode).input('stock',sql.NVarChar(12),options.stock).input('status',sql.NVarChar(12),options.status).input('page',sql.Int,options.page).input('page_size',sql.Int,options.limit);
      const records=(await req.execute(STOCK_PRODUCT_READ_PROC)).recordset;
      if(!Array.isArray(records)||records.length!==1)throw stockProductError();
      const row=records[0];
      if(row.actorId!==actorId||row.canView!==true||typeof row.canViewFinance!=='boolean'||typeof row.rowsJson!=='string'||Object.entries(STOCK_PRODUCT_SQL_PROOF).some(([key,value])=>row[key]!==value))throw stockProductError();
      if(row.acceptedCount!==16622||row.syntheticCount!==3||row.quarantinedCount!==54)throw stockProductError();
      const rows=JSON.parse(row.rowsJson);if(!Array.isArray(rows))throw stockProductError();
      if(!Number.isSafeInteger(row.total)||row.total<0||row.page!==options.page||row.limit!==options.limit||rows.length!==Math.min(options.limit,Math.max(0,row.total-(options.page-1)*options.limit))||!stockReadTimestamp(row.readAt))throw stockProductError();
      const ids=rows.map(value=>stockProductDto(value,{sqlFinance:row.canViewFinance,canViewFinance:row.canViewFinance,financialExpected:productId!==null&&row.canViewFinance}).id);
      if(new Set(ids).size!==ids.length||productId!==null&&(row.total>1||ids.some(id=>id!==productId)))throw stockProductError();
      const result={actorId:row.actorId,canViewFinance:row.canViewFinance,total:row.total,page:row.page,limit:row.limit,readAt:row.readAt,rows,acceptedCount:row.acceptedCount,syntheticCount:row.syntheticCount,quarantinedCount:row.quarantinedCount};
      await tx.commit();return result;
    }catch(error){if(tx)try{await tx.rollback();}catch{}throw stockProductError();}
  }};
}
export const {readStockProducts}=createStockProductReadStore();
