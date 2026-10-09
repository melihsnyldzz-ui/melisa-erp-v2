import {homeCapabilities,businessInboundHomeCapabilities,homeError} from './homeSummaryModel.mjs';
import {assertIsolatedCopyContext} from './isolatedOperationCopyContext.mjs';
import {createIsolatedOperationCopyStore} from './isolatedOperationCopyStore.mjs';
async function defaultRuntime(){const db=await import('../config/database.js');if(db.isIsolatedOperationCopyRuntime())return {pool:await db.getSqlPool(),sql:db.getSqlDriver(),copyContext:assertIsolatedCopyContext(db.getIsolatedOperationCopyConfig())};if(!db.isCanonicalTest())throw homeError();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
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
 let tx;try{const runtime=await getRuntime();if(runtime.copyContext)return await readCopyHome(runtime,{actorId,sessionPermissions});const {pool,sql}=runtime;tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
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

// Copy ownership is explicit. Restored historical invoices, fixtures and
// unrelated source movements cannot enter the day's summary.
export const COPY_HOME_SUMMARY_SQL=`
DECLARE @CopyHomeSales TABLE(id bigint PRIMARY KEY);
INSERT @CopyHomeSales SELECT DISTINCT h.id FROM dbo.sales_invoices h JOIN dbo.work_sales_links l ON l.invoice_id=h.id WHERE JSON_VALUE(l.preview_json,'$.copyId')=LOWER(CONVERT(varchar(36),@copy_id)) AND EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation=N'sale_draft' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.invoice.id'))=h.id);
DECLARE @Batches TABLE(id bigint PRIMARY KEY);
INSERT @Batches SELECT DISTINCT b.id FROM dbo.test_goods_batches b WHERE EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation=N'count_submit' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.receipt.id'))=b.id);
DECLARE @Inbound TABLE(id bigint PRIMARY KEY);
INSERT @Inbound SELECT DISTINCT d.id FROM dbo.work_inbound_counts d WHERE EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation=N'count_create' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.draft.id'))=d.id);
DECLARE @Purchases TABLE(id bigint PRIMARY KEY);
INSERT @Purchases SELECT DISTINCT p.id FROM dbo.purchase_invoices p WHERE EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation=N'purchase_draft' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.id'))=p.id);
DECLARE @Daily TABLE(id bigint PRIMARY KEY);
INSERT @Daily SELECT DISTINCT d.id FROM dbo.test_daily_drafts d WHERE EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation IN(N'stock_count_draft',N'purchase_return_draft') AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.id'))=d.id);
DECLARE @Returns TABLE(id bigint PRIMARY KEY);
INSERT @Returns SELECT DISTINCT r.id FROM dbo.invoice_returns r JOIN dbo.test_daily_drafts d ON TRY_CONVERT(bigint,JSON_VALUE(d.result_json,'$.id'))=r.id JOIN @Daily own ON own.id=d.id WHERE d.kind=N'invoice-return';
DECLARE @Money TABLE(entity varchar(32),id bigint,currency nvarchar(32),movement_type nvarchar(80),document_date date,amount decimal(38,4));
INSERT @Money SELECT 'customer',m.id,m.currency_code,m.movement_type,m.document_date,CAST(m.amount AS decimal(38,4)) FROM dbo.customer_movements m WHERE @finance=1 AND EXISTS(SELECT 1 FROM dbo.stage4_copy_effect_components e JOIN dbo.stage4_copy_requests j ON j.copy_id=e.copy_id AND j.request_id=e.request_id WHERE e.copy_id=@copy_id AND e.entity=N'customer' AND e.native_id=m.id AND e.effect_json COLLATE Latin1_General_100_BIN2=(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) COLLATE Latin1_General_100_BIN2);
INSERT @Money SELECT 'supplier',m.id,m.currency_code,m.movement_type,m.document_date,CAST(m.amount AS decimal(38,4)) FROM dbo.supplier_movements m WHERE @finance=1 AND EXISTS(SELECT 1 FROM dbo.stage4_copy_effect_components e JOIN dbo.stage4_copy_requests j ON j.copy_id=e.copy_id AND j.request_id=e.request_id WHERE e.copy_id=@copy_id AND e.entity=N'supplier' AND e.native_id=m.id AND e.effect_json COLLATE Latin1_General_100_BIN2=(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) COLLATE Latin1_General_100_BIN2);
SELECT
 CASE WHEN @sales=1 THEN(SELECT COUNT_BIG(*) FROM dbo.sales_invoices h JOIN @CopyHomeSales o ON o.id=h.id WHERE h.status=N'finalized' AND h.document_date=@date) END salesCount,
 CASE WHEN @sales=1 THEN(SELECT COUNT_BIG(*) FROM dbo.sales_invoices h JOIN @CopyHomeSales o ON o.id=h.id WHERE h.status=N'cancelled' AND h.document_date=@date) END salesCancelledCount,
 CASE WHEN @goods=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches b JOIN @Batches o ON o.id=b.id WHERE b.state=N'pending') END goodsPendingCount,
 CASE WHEN @sales=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns r JOIN @Returns o ON o.id=r.id WHERE r.kind=N'sales' AND r.status=N'finalized' AND r.document_date=@date) END salesReturnCount,
 CASE WHEN @purchase=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns r JOIN @Returns o ON o.id=r.id WHERE r.kind=N'purchase' AND r.status=N'finalized' AND r.document_date=@date) END purchaseReturnCount,
 CASE WHEN @sales=1 OR @purchase=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns r JOIN @Returns o ON o.id=r.id WHERE r.status=N'cancelled' AND r.document_date=@date AND ((@sales=1 AND r.kind=N'sales') OR(@purchase=1 AND r.kind=N'purchase'))) END returnCancelledCount,
 CASE WHEN @count=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts d JOIN @Daily o ON o.id=d.id WHERE d.kind=N'count' AND d.state=N'pending') END countPendingCount,
 CASE WHEN @approval=1 THEN
 (CASE WHEN @approve_goods=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches b JOIN @Batches o ON o.id=b.id WHERE b.state=N'pending') ELSE 0 END)+
 (SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts d JOIN @Daily o ON o.id=d.id WHERE d.state=N'pending' AND ((@count=1 AND d.kind=N'count') OR(@purchase_return=1 AND d.kind=N'invoice-return' AND d.flow=N'purchase'))) END approvalPendingCount;
SELECT h.document_currency currency,CONVERT(varchar(20),COUNT(h.grand_total)) knownCount,CONVERT(varchar(20),COUNT_BIG(*)-COUNT(h.grand_total)) unknownCount,CASE WHEN COUNT_BIG(*)=COUNT(h.grand_total) THEN CONVERT(varchar(64),CAST(SUM(CAST(h.grand_total AS decimal(38,4))) AS decimal(38,4))) END amountExact4 FROM dbo.sales_invoices h JOIN @CopyHomeSales o ON o.id=h.id WHERE @sales=1 AND h.status=N'finalized' AND h.document_date=@date GROUP BY h.document_currency;
${moneyQuery('@Money',"entity='customer' AND @finance=1 AND movement_type=N'collection'").replaceAll('currency_code','currency')}
${moneyQuery('@Money',"entity='supplier' AND @finance=1 AND movement_type=N'payment'").replaceAll('currency_code','currency')}
${moneyQuery('@Money',"@finance=1 AND movement_type IN(N'collection_cancel',N'collection_refund',N'collection_refund_cancel',N'payment_cancel',N'supplier_refund',N'supplier_refund_cancel')").replaceAll('currency_code','currency')}
SELECT TOP(5) id,kind,state,[date] FROM(
 SELECT N'goods-batch:'+CONVERT(varchar(20),b.id) id,N'goods' kind,b.state,CAST(NULL AS varchar(10)) [date],1 priority FROM dbo.test_goods_batches b JOIN @Batches o ON o.id=b.id WHERE @goods=1 AND b.state=N'pending'
 UNION ALL SELECT N'inbound-count:'+CONVERT(varchar(20),d.id),N'goods',N'draft',NULL,2 FROM dbo.work_inbound_counts d JOIN @Inbound o ON o.id=d.id WHERE @goods=1 AND d.state IN(N'draft',N'needs_review')
 UNION ALL SELECT N'daily:'+CONVERT(varchar(20),d.id),CASE WHEN d.kind=N'count' THEN N'count' ELSE N'return-purchase' END,d.state,CONVERT(varchar(10),TRY_CONVERT(date,COALESCE(JSON_VALUE(d.payload_json,'$.date'),JSON_VALUE(d.payload_json,'$.documentDate'))),23),3 FROM dbo.test_daily_drafts d JOIN @Daily o ON o.id=d.id WHERE d.state=N'pending' AND ((@count=1 AND d.kind=N'count') OR(@purchase_return=1 AND d.kind=N'invoice-return' AND d.flow=N'purchase'))
 UNION ALL SELECT N'sales-draft:'+CONVERT(varchar(20),h.id),N'sales-draft',N'draft',CONVERT(varchar(10),h.document_date,23),4 FROM dbo.sales_invoices h JOIN @CopyHomeSales o ON o.id=h.id WHERE @sales=1 AND h.status=N'draft'
 UNION ALL SELECT N'purchase-draft:'+CONVERT(varchar(20),h.id),N'purchase-draft',N'draft',CONVERT(varchar(10),h.document_date,23),4 FROM dbo.purchase_invoices h JOIN @Purchases o ON o.id=h.id WHERE @purchase=1 AND h.status=N'draft'
) jobs ORDER BY priority,id;`;

// Only copy-owned inbound journal rows enter this summary. Restored historical
// counts, fixtures, sales and financial aggregates remain outside this scope.
export const BUSINESS_INBOUND_HOME_SUMMARY_SQL=`
DECLARE @BusinessInbound TABLE(id bigint PRIMARY KEY);
INSERT @BusinessInbound SELECT DISTINCT c.id FROM dbo.work_inbound_counts c JOIN dbo.work_business_count_bindings binding ON binding.count_id=c.id WHERE (c.created_by=@actor OR @actor=16) AND EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation=N'count_create' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.draft.id'))=c.id);
DECLARE @BusinessBatches TABLE(id bigint PRIMARY KEY);
INSERT @BusinessBatches SELECT DISTINCT b.id FROM dbo.test_goods_batches b WHERE (b.created_by=@actor OR @actor=16) AND EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation=N'count_submit' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.receipt.id'))=b.id);
DECLARE @BusinessPurchases TABLE(id bigint PRIMARY KEY);
INSERT @BusinessPurchases SELECT DISTINCT p.id FROM dbo.purchase_invoices p WHERE @purchase=1 AND EXISTS(SELECT 1 FROM dbo.stage4_copy_requests j WHERE j.copy_id=@copy_id AND j.operation=N'purchase_draft' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.id'))=p.id);
SELECT CAST(NULL AS bigint) salesCount,CAST(NULL AS bigint) salesCancelledCount,
 CASE WHEN @goods=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches b JOIN @BusinessBatches own ON own.id=b.id WHERE b.state=N'pending') END goodsPendingCount,
 CAST(NULL AS bigint) salesReturnCount,CAST(NULL AS bigint) purchaseReturnCount,CAST(NULL AS bigint) returnCancelledCount,CAST(NULL AS bigint) countPendingCount,
 CASE WHEN @approval=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches b JOIN @BusinessBatches own ON own.id=b.id WHERE b.state=N'pending') END approvalPendingCount;
SELECT CAST(NULL AS nvarchar(3)) currency,CAST(NULL AS varchar(20)) knownCount,CAST(NULL AS varchar(20)) unknownCount,CAST(NULL AS varchar(64)) amountExact4 WHERE 1=0;
SELECT CAST(NULL AS nvarchar(3)) currency,CAST(NULL AS varchar(20)) knownCount,CAST(NULL AS varchar(20)) unknownCount,CAST(NULL AS varchar(64)) amountExact4 WHERE 1=0;
SELECT CAST(NULL AS nvarchar(3)) currency,CAST(NULL AS varchar(20)) knownCount,CAST(NULL AS varchar(20)) unknownCount,CAST(NULL AS varchar(64)) amountExact4 WHERE 1=0;
SELECT CAST(NULL AS nvarchar(3)) currency,CAST(NULL AS varchar(20)) knownCount,CAST(NULL AS varchar(20)) unknownCount,CAST(NULL AS varchar(64)) amountExact4 WHERE 1=0;
SELECT TOP(5) id,kind,state,[date] FROM(
 SELECT N'inbound-count:'+CONVERT(varchar(20),c.id) id,N'goods' kind,N'draft' state,CAST(NULL AS varchar(10)) [date],1 priority FROM dbo.work_inbound_counts c JOIN @BusinessInbound own ON own.id=c.id WHERE @goods=1 AND c.state IN(N'draft',N'needs_review')
 UNION ALL SELECT N'goods-batch:'+CONVERT(varchar(20),b.id),N'goods',N'pending',NULL,2 FROM dbo.test_goods_batches b JOIN @BusinessBatches own ON own.id=b.id WHERE @goods=1 AND b.state=N'pending'
 UNION ALL SELECT N'purchase-draft:'+CONVERT(varchar(20),p.id),N'purchase-draft',N'draft',CONVERT(varchar(10),p.document_date,23),3 FROM dbo.purchase_invoices p JOIN @BusinessPurchases own ON own.id=p.id WHERE @purchase=1 AND p.status=N'draft'
)jobs ORDER BY priority,id;`;

async function readCopyHome(runtime,{actorId,sessionPermissions}){
 const copy=assertIsolatedCopyContext(runtime.copyContext),actor={id:actorId,permissions:sessionPermissions};
 const business=copy.target.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
 const store=createIsolatedOperationCopyStore({getRuntime:async()=>runtime,domain:business?'inbound':'daily',readPermission:business?'goods.view':'product.view',buildDomain:async({context,actual,request})=>({context,summary:async()=>{
  const capabilities=business?businessInboundHomeCapabilities(actual.permissions,sessionPermissions,actorId):homeCapabilities(actual.permissions,sessionPermissions),sql=runtime.sql,req=request().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('date',sql.Date,copy.date);
  if(business)req.input('actor',sql.BigInt,actorId);
  for(const [key,name] of Object.entries({sales:'sales',goods:'goods',purchase:'purchase',finance:'finance',count:'count',approval:'approval',approveGoods:'approve_goods',salesReturn:'sales_return',purchaseReturn:'purchase_return'}))req.input(name,sql.Bit,capabilities[key]);
  const sets=(await req.query(business?BUSINESS_INBOUND_HOME_SUMMARY_SQL:COPY_HOME_SUMMARY_SQL)).recordsets;if(!Array.isArray(sets)||sets.length!==6||sets[0]?.length!==1)throw homeError();
  return {capabilities,counts:sets[0][0],salesTotals:sets[1],collections:sets[2],payments:sets[3],reversals:sets[4],tasks:sets[5],copyMeta:{operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash,date:copy.date,...(business?{scopeKind:copy.scopeKind}:{} )}};
 }})});return store.read(actor,c=>c.summary());
}
