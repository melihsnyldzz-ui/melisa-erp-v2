// SOURCE ONLY. Real v2 list queries for the dedicated writer profile. No
// listener, SQL connection, grants, or mutations are created at import time.
import {DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL as DESKTOP_WRITE_PERMISSION_GUARD_SQL} from '../config/desktopLifecyclePermissionPolicy.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../config/desktopMasterV3Policy.mjs';
import {desktopMasterSchema,DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from '../config/desktopMasterVersion.mjs';
import {isDesktopProductCard} from '../../../../packages/shared/src/desktopProductCard.mjs';
import {DESKTOP_PRODUCT_SALE_PRICES_SQL} from './desktopProductSalePricesSql.mjs';
import {isDesktopProductOpening} from '../../../../packages/shared/src/desktopProductOpening.mjs';
import {desktopSeriesFactor,isDesktopProductUnits} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
import {desktopAvailableStock,isDesktopStockAvailability} from '../../../../packages/shared/src/desktopStockAvailability.mjs';
import {isDesktopCustomerCard} from '../../../../packages/shared/src/desktopCustomerCard.mjs';
import {desktopCompanyRateDate} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
import {readDesktopCompanyRates} from './desktopCompanyRateRead.mjs';
import {isDesktopBarcode,isDesktopBarcodeLookup} from '../../../../packages/shared/src/desktopBarcodeLookup.mjs';
const LOGIN='melisa_desktop_test_writer_20261105';
const fail=()=>{throw Object.assign(Error('DESKTOP_LIST_UNAVAILABLE'),{code:'DESKTOP_LIST_UNAVAILABLE'});};
const reservedSql=product=>`(SELECT CONVERT(varchar(40),CONVERT(decimal(18,3),ISNULL(SUM(r.quantity),0))) FROM dbo.desktop_sale_reservations r WITH(HOLDLOCK,INDEX(IX_desktop_active_reservations)) WHERE r.product_id=${product} AND r.state='ACTIVE') reservedExact3`;
function projectStock(row){if(!row||Object.hasOwn(row,'availableExact3'))fail();return {...row,availableExact3:desktopAvailableStock(row.currentStockExact3,row.reservedExact3)};}
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
 const keys=kind==='products'?['stockCode','productName','unit','currency','currentStockExact3','salePriceExact4',...(richCards?['brand','category','supplierId','supplierName','reservedExact3','availableExact3']:[])]:kind==='customers'?['customerCode','customerName','phone','city','country','currency','customerType','balanceExact4']:['supplierCode','supplierName','phone','city','country','currency'];
 const seriesFields=kind==='products'&&richCards&&['seriesUnitId','seriesFactorExact8'].some(k=>Object.hasOwn(row,k))?['seriesUnitId','seriesFactorExact8']:[];
 if(Object.keys(row).sort().join(',')!==['id',...keys,...seriesFields].sort().join(','))fail();
 for(const k of keys)if(row[k]!==null&&typeof row[k]!=='string')fail();
 const required=kind==='products'?['stockCode','productName','unit','currency','currentStockExact3','salePriceExact4']:kind==='customers'?['customerCode','customerName','currency','customerType','balanceExact4']:['supplierCode','supplierName','currency'];
 if(required.some(k=>typeof row[k]!=='string'||row[k].length===0))fail();
 if(kind==='customers'&&!/^-?(?:0|[1-9]\d*)\.\d{4}$/.test(row.balanceExact4))fail();
 if(kind==='products'&&(!/^-?(?:0|[1-9]\d*)\.\d{3}$/.test(row.currentStockExact3)||!/^-?(?:0|[1-9]\d*)\.\d{4}$/.test(row.salePriceExact4)))fail();
 if(kind==='products'&&richCards&&row.supplierId!==null&&!validId(row.supplierId))fail();
 if(kind==='products'&&richCards&&!isDesktopStockAvailability(row))fail();
 if(seriesFields.length){if((row.seriesUnitId===null)!==(row.seriesFactorExact8===null))fail();if(row.seriesUnitId!==null){if(!validId(row.seriesUnitId)||row.unit!=='ADET')fail();desktopSeriesFactor(row.seriesFactorExact8);}}
 return row;
}
export const DESKTOP_WRITE_LIST_LIMITS=Object.freeze({sourceOnly:true,routeMounted:false,requiresVerifiedWriterPool:true,requiresCurrentLockedSession:true,
 sqlExecuted:false,sourceRowsAreLiveLocalOnly:true,noVegaFallback:true,exposesCustomerBalance:true,noFinanceAccountBalances:true,fullErpReady:false});
export function createDesktopWriteListService({pool,sql,verifySession,richCards=false,schemaVersion=richCards?3:2}={}){
 schemaVersion=desktopMasterSchema(richCards,schemaVersion);
 const profileGuard=richCards?guard.replace('schema_version=2',`schema_version=${schemaVersion}`).replace(DESKTOP_WRITE_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL+(schemaVersion===4?DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL:'')):guard;
 if(typeof richCards!=='boolean')fail();
 if(!pool||!sql?.Transaction||!sql?.Request||!sql?.NVarChar||!sql?.Int||!sql?.ISOLATION_LEVEL?.SERIALIZABLE||typeof verifySession!=='function')fail();
 return Object.freeze({async readCompanyRates(actorId,date){
  if(!richCards||!validId(actorId))fail();desktopCompanyRateDate(date);const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;const checked=await new sql.Request(tx).query(profileGuard);if(checked?.recordset?.length!==1||checked.recordset[0].ok!==1||await verifySession({transaction:tx,actorId,permission:'sales.view'})!==true)fail();
   const data=await readDesktopCompanyRates({sql,transaction:tx,date});await tx.commit();begun=false;return data;
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 },async readProductBarcode(actorId,barcode){
  if(!richCards||!validId(actorId)||!isDesktopBarcode(barcode))fail();const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;const checked=await new sql.Request(tx).query(profileGuard);if(checked?.recordset?.length!==1||checked.recordset[0].ok!==1||await verifySession({transaction:tx,actorId,permission:'product.view'})!==true)fail();
   const result=await new sql.Request(tx).input('barcode',sql.NVarChar(100),barcode).query(`SELECT TOP(2) CONVERT(varchar(20),p.id) id,p.stock_code stockCode,p.name productName,p.unit,CONVERT(varchar(40),p.current_stock_qty) currentStockExact3,${reservedSql('p.id')}
FROM dbo.products p WITH(HOLDLOCK) WHERE p.is_active=1 AND p.is_deleted=0 AND EXISTS(SELECT 1 FROM dbo.product_barcodes b WITH(HOLDLOCK) WHERE b.product_id=p.id AND b.is_active=1 AND DATALENGTH(CONVERT(nvarchar(max),b.barcode))=DATALENGTH(@barcode) AND CONVERT(varbinary(200),CONVERT(nvarchar(100),b.barcode))=CONVERT(varbinary(200),@barcode)) ORDER BY p.id;`);
   if(!Array.isArray(result?.recordset)||result.recordset.length>2)fail();if(result.recordset.length===2)throw Object.assign(Error('DESKTOP_BARCODE_AMBIGUOUS'),{code:'DESKTOP_BARCODE_AMBIGUOUS'});if(!result.recordset.length){await tx.commit();begun=false;return null;}const data={barcode,product:projectStock(result.recordset[0])};if(!isDesktopBarcodeLookup(data,barcode))fail();await tx.commit();begun=false;return data;
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 },async list(actorId,kind,input={}){
  let def=definitions[kind];if(!def||!validId(actorId))fail();const {page,limit,search}=options(input),offset=(page-1)*limit;
  if(richCards&&kind==='suppliers')def={...def,baseWhere:'is_deleted=0 AND is_active=1'};
  if(richCards&&kind==='products')def={...def,select:def.select+`,brand,category,CONVERT(varchar(20),supplier_id) supplierId,(SELECT s.name FROM dbo.suppliers s WITH(HOLDLOCK) WHERE s.id=products.supplier_id) supplierName,(SELECT CONVERT(varchar(20),u.id) FROM dbo.desktop_local_product_units u WITH(HOLDLOCK) WHERE u.product_id=products.id AND u.label=N'SERİ' AND u.is_main=0) seriesUnitId,(SELECT CONVERT(varchar(40),u.factor) FROM dbo.desktop_local_product_units u WITH(HOLDLOCK) WHERE u.product_id=products.id AND u.label=N'SERİ' AND u.is_main=0) seriesFactorExact8`};
  if(richCards&&kind==='products')def={...def,select:def.select+','+reservedSql('products.id')};
  const tx=new sql.Transaction(pool);let begun=false;
  const request=()=>new sql.Request(tx).input('search',sql.NVarChar(202),'%'+search.replace(/[~%_\[]/g,'~$&')+'%').input('exactSearch',sql.NVarChar(100),search).input('offset',sql.Int,offset).input('limit',sql.Int,limit);
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   const statement=profileGuard;
   const guardResult=await new sql.Request(tx).query(statement);if(!Array.isArray(guardResult?.recordset)||guardResult.recordset.length!==1||guardResult.recordset[0].ok!==1)fail();
   if(await verifySession({transaction:tx,actorId,permission:def.permission})!==true)fail();
   const from=def.from??`dbo.[${def.table}] WITH(HOLDLOCK)`;
   const exactBarcode=`EXISTS(SELECT 1 FROM dbo.product_barcodes b WITH(HOLDLOCK) WHERE b.barcode=@exactSearch AND b.is_active=1`;
   const fuzzy=`${def.code} LIKE @search ESCAPE N'~' OR ${def.name} LIKE @search ESCAPE N'~'${richCards&&kind==='customers'?" OR phone LIKE @search ESCAPE N'~' OR city LIKE @search ESCAPE N'~' OR country LIKE @search ESCAPE N'~'":''}`;
   const productSearch=richCards&&kind==='products'?`${exactBarcode} AND b.product_id=products.id) OR (NOT ${exactBarcode}) AND (${fuzzy} OR EXISTS(SELECT 1 FROM dbo.product_barcodes b WITH(HOLDLOCK) WHERE b.product_id=products.id AND b.is_active=1 AND b.barcode LIKE @search ESCAPE N'~')))` :fuzzy;
   const where=`${def.baseWhere??'is_deleted=0'} AND (@search=N'%%' OR ${productSearch})`;
   const count=await request().query(`SELECT CONVERT(varchar(20),COUNT_BIG(*)) total FROM ${from} WHERE ${where};`);
   const raw=count?.recordset;if(!Array.isArray(raw)||raw.length!==1||typeof raw[0].total!=='string'||!/^(0|[1-9]\d{0,15})$/.test(raw[0].total)||BigInt(raw[0].total)>9007199254740991n)fail();
   const result=await request().query(`SELECT ${def.select} FROM ${from} WHERE ${where} ORDER BY ${def.order??def.code+',id'} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
   if(!Array.isArray(result?.recordset)||result.recordset.length>limit)fail();const data=result.recordset.map(row=>validateRow(richCards&&kind==='products'?projectStock(row):row,kind,richCards));
   const total=Number(raw[0].total),totalPages=Math.max(1,Math.ceil(total/limit));
   if(data.length>total||offset>=total&&data.length!==0)fail();
   await tx.commit();begun=false;return {data,meta:{page,limit,total,totalPages,hasNextPage:page<totalPages,hasPreviousPage:page>1}};
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 },async readProduct(actorId,productId){
  if(!richCards||!validId(actorId)||!validId(productId))fail();
  const tx=new sql.Transaction(pool);let begun=false;
  try{
   await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   const checked=await new sql.Request(tx).query(profileGuard);
   if(checked?.recordset?.length!==1||checked.recordset[0].ok!==1)fail();
   if(await verifySession({transaction:tx,actorId,permission:['product.view','product.edit']})!==true)fail();
   const request=()=>new sql.Request(tx).input('productId',sql.NVarChar(20),productId);
   const result=await request().query(`SELECT CONVERT(varchar(20),p.id) id,p.stock_code stockCode,p.name,p.brand,p.category,p.unit,p.currency_code currency,
CONVERT(varchar(40),p.sales_price) salePriceExact4,CONVERT(varchar(40),p.purchase_price) purchasePriceExact4,CONVERT(varchar(40),p.purchase_discount_rate) purchaseDiscountRateExact4,
CONVERT(varchar(40),p.average_cost_try) averageCostTryExact4,CONVERT(varchar(40),p.current_stock_qty) currentStockExact3,
CONVERT(varchar(20),p.supplier_id) supplierId,s.name supplierName,p.is_active isActive,${reservedSql('p.id')}
FROM dbo.products p WITH(HOLDLOCK) LEFT JOIN dbo.suppliers s WITH(HOLDLOCK) ON s.id=p.supplier_id
WHERE p.id=TRY_CONVERT(bigint,@productId) AND p.is_deleted=0;`);
   if(!Array.isArray(result?.recordset)||result.recordset.length>1)fail();
   if(result.recordset.length===0){await tx.commit();begun=false;return null;}
   const barcodes=await request().query(`SELECT TOP(101) CONVERT(varchar(20),id) id,CONVERT(varchar(20),product_id) productId,barcode,barcode_type type,is_primary isPrimary FROM dbo.product_barcodes WITH(HOLDLOCK) WHERE product_id=TRY_CONVERT(bigint,@productId) AND is_active=1 ORDER BY is_primary DESC,id;`);
   const card={...projectStock(result.recordset[0]),barcodes:barcodes?.recordset};
   const units=await request().query(`SELECT CONVERT(varchar(20),id) id,CONVERT(varchar(20),product_id) productId,label,CONVERT(varchar(40),factor) factorExact8,is_main isMain FROM dbo.desktop_local_product_units WITH(HOLDLOCK) WHERE product_id=TRY_CONVERT(bigint,@productId) ORDER BY is_main DESC,id;`);if(!Array.isArray(units?.recordset)||units.recordset.length>2)fail();const unitRows=Array.from(units.recordset);if(!isDesktopProductUnits(unitRows,productId,card.unit))fail();card.units=unitRows;
   const prices=await request().query(DESKTOP_PRODUCT_SALE_PRICES_SQL);if(!Array.isArray(prices?.recordset))fail();card.salePrices=Array.from(prices.recordset);
   const audit=await request().query(`SELECT TOP(2) after_json openingJson,reason requestId,CONVERT(varchar(20),actor_user_id) actorId FROM dbo.audit_logs WITH(HOLDLOCK) WHERE entity_id=TRY_CONVERT(bigint,@productId) AND entity_type=N'local-master' AND action=N'product.create' AND source=N'desktop-local-master-v1' AND after_json IS NOT NULL ORDER BY id;`);
   if(!Array.isArray(audit?.recordset)||audit.recordset.length>1)fail();
   if(audit.recordset.length){const a=audit.recordset[0];let detail;try{detail=JSON.parse(a.openingJson);}catch{fail();}if(!isDesktopProductOpening(detail,productId)||detail.actorId!==a.actorId||detail.requestId!==a.requestId)fail();
    const movement=await request().input('movementId',sql.NVarChar(20),detail.movementId).query(`SELECT CONVERT(varchar(20),id) movementId,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(20),created_by) actorId,CONVERT(varchar(40),quantity_in) quantityExact3,CONVERT(varchar(40),unit_cost_try) costExact4,CONVERT(varchar(40),amount_try) amountTryExact4,CONVERT(char(10),document_date,23) documentDate,currency_code currency FROM dbo.stock_movements WITH(HOLDLOCK) WHERE id=TRY_CONVERT(bigint,@movementId) AND product_id=TRY_CONVERT(bigint,@productId) AND movement_type=N'in' AND source_type=N'stock_adjustment' AND source_id IS NULL AND quantity_out=0 AND quantity_net=quantity_in;`);
    if(!Array.isArray(movement?.recordset)||movement.recordset.length!==1||Object.keys(movement.recordset[0]).sort().join(',')!=='actorId,amountTryExact4,costExact4,currency,documentDate,movementId,productId,quantityExact3'||Object.entries(movement.recordset[0]).some(([k,v])=>detail[k]!==v))fail();card.stockOpening=detail;
   }
   if(!isDesktopProductCard(card,productId))fail();
   await tx.commit();begun=false;return card;
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 },async readCustomer(actorId,customerId,{includeSales=false}={}){
  if(!richCards||!validId(actorId)||!validId(customerId)||typeof includeSales!=='boolean')fail();
  const tx=new sql.Transaction(pool);let begun=false;
  try{
   await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   const checked=await new sql.Request(tx).query(profileGuard);
   if(checked?.recordset?.length!==1||checked.recordset[0].ok!==1||await verifySession({transaction:tx,actorId,permission:includeSales?['customer.view','sales.view']:'customer.view'})!==true)fail();
   const request=()=>new sql.Request(tx).input('customerId',sql.NVarChar(20),customerId);
   const result=await request().query(`SELECT CONVERT(varchar(20),c.id) id,c.customer_code customerCode,c.name,c.phone,c.city,c.country,c.customer_type customerType,c.currency_code currency,CONVERT(varchar(40),c.balance) balanceExact4,CONVERT(varchar(20),c.party_entity_id) entityId,c.is_active isActive
FROM dbo.customers c WITH(HOLDLOCK) JOIN dbo.party_entities e WITH(HOLDLOCK) ON e.id=c.party_entity_id AND e.role=N'customer' WHERE c.id=TRY_CONVERT(bigint,@customerId) AND c.is_deleted=0;`);
   if(!Array.isArray(result?.recordset)||result.recordset.length>1)fail();if(!result.recordset.length){await tx.commit();begun=false;return null;}
   const accounts=await request().query(`SELECT TOP(4) CONVERT(varchar(20),id) id,CONVERT(varchar(20),customer_id) customerId,CONVERT(varchar(20),party_entity_id) entityId,CONVERT(varchar(20),supplier_id) supplierId,currency_code currency,CONVERT(varchar(50),current_balance) balanceExact8,balance_status balanceStatus FROM dbo.party_currency_accounts WITH(HOLDLOCK) WHERE customer_id=TRY_CONVERT(bigint,@customerId) ORDER BY currency_code,id;`);
   if(!Array.isArray(accounts?.recordset))fail();let lastSale=null;
   if(includeSales){const latest=await request().query(`SELECT TOP(1) CONVERT(varchar(20),i.id) invoiceId,CONVERT(varchar(20),i.customer_id) customerId,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,i.document_currency currency,CONVERT(varchar(40),i.grand_total) totalExact4 FROM dbo.sales_invoices i WITH(HOLDLOCK) JOIN dbo.desktop_sale_workflows w WITH(HOLDLOCK) ON w.invoice_id=i.id WHERE i.customer_id=TRY_CONVERT(bigint,@customerId) AND i.status=N'finalized' AND w.state='COMPLETED' ORDER BY i.document_date DESC,i.id DESC;`);if(!Array.isArray(latest?.recordset)||latest.recordset.length>1)fail();lastSale=latest.recordset[0]??null;}
   const card={...result.recordset[0],accounts:Array.from(accounts.recordset),salesHistoryAvailable:includeSales,lastSale};if(!isDesktopCustomerCard(card,customerId))fail();await tx.commit();begun=false;return card;
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 }});
}
