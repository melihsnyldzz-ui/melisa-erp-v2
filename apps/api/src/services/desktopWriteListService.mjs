// SOURCE ONLY. Real v2 list queries for the dedicated writer profile. No
// listener, SQL connection, grants, or mutations are created at import time.
import {DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL as DESKTOP_WRITE_PERMISSION_GUARD_SQL} from '../config/desktopLifecyclePermissionPolicy.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../config/desktopMasterV3Policy.mjs';
const LOGIN='melisa_desktop_test_writer_20261105';
const fail=()=>{throw Object.assign(Error('DESKTOP_LIST_UNAVAILABLE'),{code:'DESKTOP_LIST_UNAVAILABLE'});};
const definitions=Object.freeze({
 products:Object.freeze({permission:'product.view',table:'products',code:'stock_code',name:'name',select:`CONVERT(varchar(20),id) id,stock_code stockCode,name productName,unit,currency_code currency,CONVERT(varchar(40),current_stock_qty) currentStockExact3,CONVERT(varchar(40),sales_price) salePriceExact4`}),
 customers:Object.freeze({permission:'customer.view',table:'customers',code:'customer_code',name:'name',select:`CONVERT(varchar(20),id) id,customer_code customerCode,name customerName,phone,city,country,currency_code currency,customer_type customerType,CONVERT(varchar(40),balance) balanceExact4`}),
 suppliers:Object.freeze({permission:'supplier.view',table:'suppliers',code:'supplier_code',name:'name',select:`CONVERT(varchar(20),id) id,supplier_code supplierCode,name supplierName,phone,city,country,currency_code currency`}),
 receipts:Object.freeze({permission:'sales.view',code:'i.document_no',name:'c.name',from:'dbo.sales_invoices i WITH(HOLDLOCK) JOIN dbo.desktop_sale_workflows w WITH(HOLDLOCK) ON w.invoice_id=i.id JOIN dbo.customers c WITH(HOLDLOCK) ON c.id=i.customer_id',baseWhere:'1=1',order:'i.id DESC',select:`CONVERT(varchar(20),i.id) id,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,c.name customerName,w.state workflowState,i.document_currency currency,CONVERT(varchar(40),i.grand_total) totalExact4`}),
});
const guard=`SET NOCOUNT ON;
IF DB_NAME() IS NULL OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_DESKTOP_TEST_20261105')
 OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')
 OR SUSER_SNAME() IS NULL OR DATALENGTH(SUSER_SNAME())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),SUSER_SNAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR ORIGINAL_LOGIN() IS NULL OR DATALENGTH(ORIGINAL_LOGIN())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),ORIGINAL_LOGIN())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR USER_NAME() IS NULL OR DATALENGTH(USER_NAME())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),USER_NAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'TCP'
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WITH(HOLDLOCK) WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=2 AND actual_t1=0 AND external_operations=0 AND read_only=0)
 THROW 51995,'DESKTOP_LIST_TARGET_REJECTED',1;
${DESKTOP_WRITE_PERMISSION_GUARD_SQL}
SELECT 1 ok;`;

const validId=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
function options(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const d=Object.getOwnPropertyDescriptors(value),keys=['page','limit','search'];if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||!keys.includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail();
 const {page=1,limit=100,search=''}=value;
 if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>100||typeof search!=='string'||search.length>100||/[\u0000-\u001f\u007f]/.test(search))fail();
 return {page,limit,search:search.trim()};
}
function validateRow(row,kind,richCards=false){
 if(!row||typeof row!=='object'||!validId(row.id))fail();
 if(kind==='receipts'){
  if(Object.keys(row).sort().join(',')!=='currency,customerName,documentDate,documentNo,id,totalExact4,workflowState'||['documentNo','customerName'].some(k=>typeof row[k]!=='string'||!row[k])||typeof row.documentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.documentDate)||row.currency!=='TRY'||typeof row.totalExact4!=='string'||!/^(?:0|[1-9]\d*)\.\d{4}$/.test(row.totalExact4)||!['DRAFT','PREPARING','READY','CHECKED','COMPLETED','CANCELLED'].includes(row.workflowState))fail();
  return row;
 }
 const keys=kind==='products'?['stockCode','productName','unit','currency','currentStockExact3','salePriceExact4',...(richCards?['brand','category','supplierId','supplierName']:[])]:kind==='customers'?['customerCode','customerName','phone','city','country','currency','customerType','balanceExact4']:['supplierCode','supplierName','phone','city','country','currency'];
 if(Object.keys(row).sort().join(',')!==['id',...keys].sort().join(','))fail();
 for(const k of keys)if(row[k]!==null&&typeof row[k]!=='string')fail();
 const required=kind==='products'?['stockCode','productName','unit','currency','currentStockExact3','salePriceExact4']:kind==='customers'?['customerCode','customerName','currency','customerType','balanceExact4']:['supplierCode','supplierName','currency'];
 if(required.some(k=>typeof row[k]!=='string'||row[k].length===0))fail();
 if(kind==='customers'&&!/^-?(?:0|[1-9]\d*)\.\d{4}$/.test(row.balanceExact4))fail();
 if(kind==='products'&&(!/^-?(?:0|[1-9]\d*)\.\d{3}$/.test(row.currentStockExact3)||!/^-?(?:0|[1-9]\d*)\.\d{4}$/.test(row.salePriceExact4)))fail();
 if(kind==='products'&&richCards&&row.supplierId!==null&&!validId(row.supplierId))fail();
 return row;
}
export const DESKTOP_WRITE_LIST_LIMITS=Object.freeze({sourceOnly:true,routeMounted:false,requiresVerifiedWriterPool:true,requiresCurrentLockedSession:true,
 sqlExecuted:false,sourceRowsAreLiveLocalOnly:true,noVegaFallback:true,exposesCustomerBalance:true,noFinanceAccountBalances:true,fullErpReady:false});
export function createDesktopWriteListService({pool,sql,verifySession,richCards=false}={}){
 if(typeof richCards!=='boolean')fail();
 if(!pool||!sql?.Transaction||!sql?.Request||!sql?.NVarChar||!sql?.Int||!sql?.ISOLATION_LEVEL?.SERIALIZABLE||typeof verifySession!=='function')fail();
 return Object.freeze({async list(actorId,kind,input={}){
  let def=definitions[kind];if(!def||!validId(actorId))fail();const {page,limit,search}=options(input),offset=(page-1)*limit;
  if(richCards&&kind==='suppliers')def={...def,baseWhere:'is_deleted=0 AND is_active=1'};
  if(richCards&&kind==='products')def={...def,select:def.select+',brand,category,CONVERT(varchar(20),supplier_id) supplierId,(SELECT s.name FROM dbo.suppliers s WITH(HOLDLOCK) WHERE s.id=products.supplier_id) supplierName'};
  const tx=new sql.Transaction(pool);let begun=false;
  const request=()=>new sql.Request(tx).input('search',sql.NVarChar(202),'%'+search.replace(/[~%_\[]/g,'~$&')+'%').input('offset',sql.Int,offset).input('limit',sql.Int,limit);
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   const statement=richCards?guard.replace('schema_version=2','schema_version=3').replace(DESKTOP_WRITE_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL):guard;
   const guardResult=await new sql.Request(tx).query(statement);if(!Array.isArray(guardResult?.recordset)||guardResult.recordset.length!==1||guardResult.recordset[0].ok!==1)fail();
   if(await verifySession({transaction:tx,actorId,permission:def.permission})!==true)fail();
   const from=def.from??`dbo.[${def.table}] WITH(HOLDLOCK)`,where=`${def.baseWhere??'is_deleted=0'} AND (@search=N'%%' OR ${def.code} LIKE @search ESCAPE N'~' OR ${def.name} LIKE @search ESCAPE N'~')`;
   const count=await request().query(`SELECT CONVERT(varchar(20),COUNT_BIG(*)) total FROM ${from} WHERE ${where};`);
   const raw=count?.recordset;if(!Array.isArray(raw)||raw.length!==1||typeof raw[0].total!=='string'||!/^(0|[1-9]\d{0,15})$/.test(raw[0].total)||BigInt(raw[0].total)>9007199254740991n)fail();
   const result=await request().query(`SELECT ${def.select} FROM ${from} WHERE ${where} ORDER BY ${def.order??def.code+',id'} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
   if(!Array.isArray(result?.recordset)||result.recordset.length>limit)fail();const data=result.recordset.map(row=>validateRow(row,kind,richCards));
   const total=Number(raw[0].total),totalPages=Math.max(1,Math.ceil(total/limit));
   if(data.length>total||offset>=total&&data.length!==0)fail();
   await tx.commit();begun=false;return {data,meta:{page,limit,total,totalPages,hasNextPage:page<totalPages,hasPreviousPage:page>1}};
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 }});
}
