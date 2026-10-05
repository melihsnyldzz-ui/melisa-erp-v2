import {homeCapabilities,homeError} from './homeSummaryModel.mjs';
async function defaultRuntime(){const db=await import('../config/database.js');if(!db.isCanonicalTest())throw homeError();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
const moneyQuery=(source,where)=>`SELECT currency_code currency,CONVERT(varchar(20),COUNT(amount)) knownCount,CONVERT(varchar(20),COUNT_BIG(*)-COUNT(amount)) unknownCount,CASE WHEN COUNT_BIG(*)=COUNT(amount) THEN CONVERT(varchar(64),CAST(SUM(amount) AS decimal(38,4))) ELSE NULL END amountExact4 FROM ${source} WHERE document_date=@date AND (${where}) GROUP BY currency_code;`;
export const HOME_SUMMARY_SQL=`
DECLARE @HomeSales TABLE(currency nvarchar(32),finalizedCount bigint,cancelledCount bigint,knownCount bigint,unknownCount bigint,amount decimal(38,4));
INSERT @HomeSales
SELECT document_currency currency,SUM(CASE WHEN status=N'finalized' THEN CONVERT(bigint,1) ELSE 0 END) finalizedCount,SUM(CASE WHEN status=N'cancelled' THEN CONVERT(bigint,1) ELSE 0 END) cancelledCount,COUNT(CASE WHEN status=N'finalized' THEN grand_total END) knownCount,SUM(CASE WHEN status=N'finalized' AND grand_total IS NULL THEN CONVERT(bigint,1) ELSE 0 END) unknownCount,SUM(CASE WHEN status=N'finalized' THEN CAST(grand_total AS decimal(38,4)) END) amount FROM dbo.sales_invoices WHERE @sales=1 AND status IN(N'finalized',N'cancelled') AND document_date=@date GROUP BY document_currency;
SELECT
 CASE WHEN @sales=1 THEN(SELECT COALESCE(SUM(finalizedCount),0) FROM @HomeSales) END salesCount,
 CASE WHEN @sales=1 THEN(SELECT COALESCE(SUM(cancelledCount),0) FROM @HomeSales) END salesCancelledCount,
 CASE WHEN @goods=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_receipts WHERE state=N'pending')+(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches WHERE state=N'pending')+(SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts WHERE kind=N'goods' AND state=N'pending') END goodsPendingCount,
 CASE WHEN @sales=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns WHERE kind=N'sales' AND status=N'finalized' AND document_date=@date) END salesReturnCount,
 CASE WHEN @purchase=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns WHERE kind=N'purchase' AND status=N'finalized' AND document_date=@date) END purchaseReturnCount,
 CASE WHEN @sales=1 OR @purchase=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns WHERE status=N'cancelled' AND document_date=@date AND ((@sales=1 AND kind=N'sales') OR(@purchase=1 AND kind=N'purchase'))) END returnCancelledCount,
 CASE WHEN @count=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts WHERE kind=N'count' AND state=N'pending') END countPendingCount,
 CASE WHEN @approval=1 THEN
 (CASE WHEN @approve_goods=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_receipts WHERE state=N'pending')+(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches WHERE state=N'pending')+(SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts WHERE kind=N'goods' AND state=N'pending') ELSE 0 END)+
 (CASE WHEN @count=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts WHERE kind=N'count' AND state=N'pending') ELSE 0 END)+
 (SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts WHERE state=N'pending' AND kind IN(N'invoice-return',N'uninvoiced') AND((@sales_return=1 AND flow=N'sales') OR(@purchase_return=1 AND flow=N'purchase'))) END approvalPendingCount;
SELECT currency,CONVERT(varchar(20),knownCount) knownCount,CONVERT(varchar(20),unknownCount) unknownCount,CASE WHEN unknownCount=0 THEN CONVERT(varchar(64),amount) ELSE NULL END amountExact4 FROM @HomeSales WHERE finalizedCount>0;
${moneyQuery('dbo.customer_movements',"@finance=1 AND movement_type=N'collection'")}
${moneyQuery('dbo.supplier_movements',"@finance=1 AND movement_type=N'payment'")}
${moneyQuery("(SELECT currency_code,amount,document_date,movement_type FROM dbo.customer_movements UNION ALL SELECT currency_code,amount,document_date,movement_type FROM dbo.supplier_movements) m","@finance=1 AND movement_type IN(N'collection_cancel',N'collection_refund',N'collection_refund_cancel',N'payment_cancel',N'supplier_refund',N'supplier_refund_cancel')")}
SELECT TOP(5) id,kind,state,[date] FROM (
 SELECT N'goods-receipt:'+CONVERT(varchar(20),id) id,N'goods' kind,state,CONVERT(varchar(10),created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Turkey Standard Time',23) [date],created_at ordering,1 priority FROM dbo.test_goods_receipts WHERE @goods=1 AND state=N'pending'
 UNION ALL SELECT N'goods-batch:'+CONVERT(varchar(20),id),N'goods',state,NULL,NULL,1 FROM dbo.test_goods_batches WHERE @goods=1 AND state=N'pending'
 UNION ALL SELECT N'daily:'+CONVERT(varchar(20),id),CASE WHEN kind=N'goods' THEN N'goods' WHEN kind=N'count' AND flow=N'count-cancel' THEN N'count-cancel' WHEN kind=N'count' THEN N'count' WHEN flow=N'sales' THEN N'return-sales' ELSE N'return-purchase' END,state,CONVERT(varchar(10),TRY_CONVERT(date,COALESCE(JSON_VALUE(CASE WHEN ISJSON(payload_json)=1 THEN payload_json ELSE N'{}' END,'$.date'),JSON_VALUE(CASE WHEN ISJSON(payload_json)=1 THEN payload_json ELSE N'{}' END,'$.documentDate'))),23),created_at,2
 FROM dbo.test_daily_drafts WHERE state=N'pending' AND((@goods=1 AND kind=N'goods') OR(@count=1 AND kind=N'count') OR(kind IN(N'invoice-return',N'uninvoiced') AND((@sales_return=1 AND flow=N'sales') OR(@purchase_return=1 AND flow=N'purchase'))))
) jobs ORDER BY priority,CASE WHEN ordering IS NULL THEN 1 ELSE 0 END,ordering,id;
`;
export function createHomeSummaryReadStore({getRuntime=defaultRuntime}={}){return {async read({actorId,sessionPermissions,date}){
 let tx;try{const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  const identity=(await new sql.Request(tx).query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live")).recordset?.[0];
  if(identity?.db!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity.server!=='Semih\\MELISADEV'||!['melisa_sirket_test_20260929_01','melisa_sirket_sales_test_20260929_01'].includes(identity.login)||identity.databaseUser!==identity.login||identity.sysadmin!==0||identity.control!==0||identity.live!==0)throw homeError();
  const roles=(await new sql.Request(tx).input('actor',sql.BigInt,actorId).query('SELECT CONVERT(varchar(20),u.id) actorId,p.permission_key permissionKey,p.can_view canView FROM dbo.users u LEFT JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=@actor AND u.is_active=1;')).recordset;
  if(!Array.isArray(roles)||!roles.length||roles.some(row=>row.actorId!==actorId))throw homeError(403);
  const capabilities=homeCapabilities(roles.filter(row=>row.canView===true).map(row=>row.permissionKey),sessionPermissions);
  const req=new sql.Request(tx).input('date',sql.Date,date);for(const [key,name] of Object.entries({sales:'sales',goods:'goods',purchase:'purchase',finance:'finance',count:'count',approval:'approval',approveGoods:'approve_goods',salesReturn:'sales_return',purchaseReturn:'purchase_return'}))req.input(name,sql.Bit,capabilities[key]);
  const sets=(await req.query(HOME_SUMMARY_SQL)).recordsets;
  if(!Array.isArray(sets)||sets.length!==6||sets[0]?.length!==1)throw homeError();
  const value={capabilities,counts:sets[0][0],salesTotals:sets[1],collections:sets[2],payments:sets[3],reversals:sets[4],tasks:sets[5]};await tx.commit();return value;
 }catch(error){if(tx)try{await tx.rollback();}catch{}throw error?.statusCode===403?homeError(403):homeError();}
}};}
export const homeSummaryReadStore=createHomeSummaryReadStore();
