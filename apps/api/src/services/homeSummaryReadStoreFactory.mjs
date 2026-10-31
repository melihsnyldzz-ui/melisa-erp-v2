import {homeCapabilities,businessInboundHomeCapabilities,businessDailyHomeCapabilities,homeError} from './homeSummaryModel.mjs';
import {assertIsolatedCopyContext,getBusinessDailySelection,getBusinessDailyScopeHash} from './isolatedOperationCopyContext.mjs';
import {createIsolatedOperationCopyStore} from './isolatedOperationCopyStoreFactory.mjs';
import {CLEAN_IDENTITY_SQL,CLEAN_ENVIRONMENT_ID,assertCleanIdentity} from './cleanSyntheticContext.mjs';
const moneyQuery=(source,where)=>`SELECT currency_code currency,CONVERT(varchar(20),COUNT(amount)) knownCount,CONVERT(varchar(20),COUNT_BIG(*)-COUNT(amount)) unknownCount,CASE WHEN COUNT_BIG(*)=COUNT(amount) THEN CONVERT(varchar(64),CAST(SUM(amount) AS decimal(38,4))) ELSE NULL END amountExact4 FROM ${source} WHERE document_date=@date AND (${where}) GROUP BY currency_code;`;
export const CLEAN_HOME_SUMMARY_SQL=`
SELECT
 (SELECT COUNT(*) FROM dbo.sales_invoices WHERE @sales=1 AND status=N'finalized' AND document_date=@date) salesCount,
 (SELECT COUNT(*) FROM dbo.sales_invoices WHERE @sales=1 AND status=N'cancelled' AND document_date=@date) salesCancelledCount,
 (SELECT COUNT(*) FROM dbo.test_goods_batches WHERE @goods=1 AND state=N'pending') goodsPendingCount,
 0 salesReturnCount,
 (SELECT COUNT(*) FROM dbo.invoice_returns WHERE @purchase=1 AND status=N'finalized' AND document_date=@date) purchaseReturnCount,
 (SELECT COUNT(*) FROM dbo.invoice_returns WHERE @purchase=1 AND status=N'cancelled' AND document_date=@date) returnCancelledCount,
 (SELECT COUNT(*) FROM dbo.test_daily_drafts WHERE @count=1 AND flow=N'count' AND state=N'pending') countPendingCount,
 (SELECT COUNT(*) FROM dbo.test_goods_batches WHERE @approve_goods=1 AND state=N'pending')+(SELECT COUNT(*) FROM dbo.test_daily_drafts WHERE state=N'pending' AND((@count=1 AND flow=N'count')OR(@purchase_return=1 AND flow=N'purchase'))) approvalPendingCount;
SELECT document_currency currency,CONVERT(varchar(20),COUNT(grand_total)) knownCount,CONVERT(varchar(20),COUNT_BIG(*)-COUNT(grand_total)) unknownCount,CONVERT(varchar(64),CAST(SUM(grand_total) AS decimal(38,4))) amountExact4 FROM dbo.sales_invoices WHERE @sales=1 AND status=N'finalized' AND document_date=@date GROUP BY document_currency;
${moneyQuery('dbo.customer_movements',"@finance=1 AND movement_type=N'collection'")}
${moneyQuery('dbo.supplier_movements',"@finance=1 AND movement_type=N'payment'")}
SELECT CAST(NULL AS nvarchar(3)) currency,CAST(NULL AS varchar(20)) knownCount,CAST(NULL AS varchar(20)) unknownCount,CAST(NULL AS varchar(64)) amountExact4 WHERE 1=0;
SELECT TOP(5) id,kind,state,[date] FROM(
 SELECT N'goods-batch:'+CONVERT(varchar(20),id) id,N'goods' kind,state,CAST(NULL AS varchar(10)) [date] FROM dbo.test_goods_batches WHERE @goods=1 AND state=N'pending'
 UNION ALL SELECT N'daily:'+CONVERT(varchar(20),id),CASE WHEN flow=N'count' THEN N'count' ELSE N'return-purchase' END,state,CONVERT(varchar(10),TRY_CONVERT(date,JSON_VALUE(payload_json,'$.date')),23) FROM dbo.test_daily_drafts WHERE state=N'pending' AND((@count=1 AND flow=N'count')OR(@purchase_return=1 AND flow=N'purchase'))
) tasks ORDER BY id;`;
async function readCleanHome(runtime,{actorId,sessionPermissions,date}){
 const {pool,sql,cleanContext:c}=runtime;
 if(runtime.port!==4194||c.environmentId!==CLEAN_ENVIRONMENT_ID||c.synthetic!==true||c.actualT1!==false||c.externalOperations!==false)throw homeError();
 assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset?.[0]);
 const rows=(await pool.request().input('actor',sql.BigInt,Number(actorId)).query('SELECT u.id,r.code,p.permission_key FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id LEFT JOIN dbo.permissions p ON p.role_id=r.id AND p.can_view=1 WHERE u.id=@actor AND u.is_active=1 AND r.is_active=1')).recordset;
 if(!rows?.length||rows.some(r=>String(r.id)!==String(actorId)||!r.code.startsWith('clean_test_')))throw homeError(403);
 const capabilities=homeCapabilities(rows.map(r=>r.permission_key),sessionPermissions);capabilities.salesReturn=false;
 const req=pool.request().input('date',sql.Date,date);for(const [k,n] of Object.entries({sales:'sales',goods:'goods',purchase:'purchase',finance:'finance',count:'count',approveGoods:'approve_goods',purchaseReturn:'purchase_return'}))req.input(n,sql.Bit,capabilities[k]);
 const s=(await req.query(CLEAN_HOME_SUMMARY_SQL)).recordsets;
 if(s?.length!==6||s[0]?.length!==1)throw homeError();
 return {capabilities,counts:s[0][0],salesTotals:s[1],collections:s[2],payments:s[3],reversals:s[4],tasks:s[5],cleanMeta:{environmentId:CLEAN_ENVIRONMENT_ID}};
}
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
export function createHomeSummaryReadStore({getRuntime,getDailySelection=getBusinessDailySelection,getDailyScopeHash=getBusinessDailyScopeHash}={}){if(typeof getRuntime!=='function')throw homeError();
return {async read({actorId,sessionPermissions,date}){
 let tx;try{const runtime=await getRuntime();if(runtime.cleanContext)return await readCleanHome(runtime,{actorId,sessionPermissions,date});if(runtime.copyContext)return await readCopyHome(runtime,{actorId,sessionPermissions,date},getDailySelection,getDailyScopeHash);const {pool,sql}=runtime;tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
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

// v4 daily and v5 profit registration still use the v4 selected profile. These
// reads do not imply a v6 installation or any cash opening authorization.
export const BUSINESS_DAILY_HOME_SUMMARY_SQL=`
DECLARE @HomeDailyProfile nvarchar(max);
SELECT @HomeDailyProfile=d.daily_profile_json FROM dbo.stage4_copy_business_daily_revisions d WHERE d.copy_id=@copy_id AND d.revision=4 AND d.name=N'dbo.usp_stage4_copy_context' AND d.base_seal_hash=@seal_hash AND d.daily_scope_hash=@daily_scope_hash AND CONVERT(varchar(64),HASHBYTES('SHA2_256',d.daily_profile_json),2)=@daily_scope_hash;
IF @HomeDailyProfile IS NULL OR ISNULL(JSON_VALUE(@HomeDailyProfile,'$.copyId'),'')<>LOWER(CONVERT(varchar(36),@copy_id)) OR ISNULL(JSON_VALUE(@HomeDailyProfile,'$.baseSealHash'),'')<>@seal_hash THROW 51904,'BUSINESS_HOME_SCOPE_DRIFT',1;
-- Cache only verified finite actors. Creation ownership below limits staff
-- rows; an office decision can certify the state of staff's OWN invoice.
DECLARE @HomeJournal TABLE(request_id uniqueidentifier PRIMARY KEY,actor_id bigint,operation nvarchar(40),payload_json nvarchar(max),response_json nvarchar(max));
INSERT @HomeJournal SELECT j.request_id,j.actor_id,j.operation,j.payload_json,j.response_json FROM dbo.stage4_copy_requests j
WHERE j.copy_id=@copy_id AND j.actor_id IN(15,16)
 AND LOWER(JSON_VALUE(j.payload_json,'$.copyId'))=LOWER(CONVERT(varchar(36),@copy_id)) AND JSON_VALUE(j.payload_json,'$.sealHash')=@seal_hash AND JSON_VALUE(j.payload_json,'$.actorId')=CONVERT(varchar(20),j.actor_id) AND JSON_VALUE(j.payload_json,'$.operation')=j.operation AND JSON_VALUE(j.payload_json,'$.operationOrigin')=N'ISOLATED_TEST_COPY'
 AND LOWER(JSON_VALUE(j.payload_json,'$.requestId'))=LOWER(CONVERT(varchar(36),j.request_id)) AND CONVERT(varchar(64),HASHBYTES('SHA2_256',j.payload_json),2)=j.payload_hash
 AND JSON_VALUE(j.effect_proof_json,'$.valid')=N'true' AND LOWER(JSON_VALUE(j.effect_proof_json,'$.copyId'))=LOWER(CONVERT(varchar(36),@copy_id)) AND JSON_VALUE(j.effect_proof_json,'$.sealHash')=@seal_hash AND LOWER(JSON_VALUE(j.effect_proof_json,'$.requestId'))=LOWER(CONVERT(varchar(36),j.request_id)) AND JSON_VALUE(j.effect_proof_json,'$.actorId')=CONVERT(varchar(20),j.actor_id) AND JSON_VALUE(j.effect_proof_json,'$.operation')=j.operation AND JSON_VALUE(j.effect_proof_json,'$.payloadHash')=j.payload_hash
 AND JSON_VALUE(j.effect_proof_json,'$.stockVerified')=N'true' AND JSON_VALUE(j.effect_proof_json,'$.partyAccountsVerified')=N'true' AND JSON_VALUE(j.effect_proof_json,'$.financeAccountsVerified')=N'true' AND JSON_VALUE(j.effect_proof_json,'$.protectedRowsVerified')=N'true'
 AND (j.operation IN(N'count_create',N'count_update',N'count_submit',N'count_cancel',N'goods_accept',N'goods_reject',N'purchase_draft',N'purchase_finalize') OR j.operation IN(N'sale_draft',N'sale_finalize',N'sale_cancel',N'collection_create',N'collection_cancel',N'payment',N'payment_cancel',N'stock_count_draft',N'stock_count_approve',N'stock_count_reject',N'stock_count_cancel',N'purchase_return_draft',N'purchase_return_approve',N'purchase_return_reject',N'purchase_return_cancel',N'purchase_cancel') AND JSON_VALUE(j.payload_json,'$.businessDailyScopeHash')=@daily_scope_hash);
DECLARE @HomeSales TABLE(id bigint PRIMARY KEY);
INSERT @HomeSales SELECT DISTINCT h.id FROM dbo.sales_invoices h JOIN dbo.work_sales_links l ON l.invoice_id=h.id JOIN OPENJSON(@HomeDailyProfile,'$.customers')WITH(id bigint,currency nvarchar(3))s ON s.id=h.customer_id AND s.currency=h.document_currency
WHERE @sales=1 AND JSON_VALUE(l.preview_json,'$.copyId')=LOWER(CONVERT(varchar(36),@copy_id)) AND EXISTS(SELECT 1 FROM @HomeJournal j WHERE (j.actor_id=@actor OR @actor=16) AND j.operation=N'sale_draft' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.invoice.id'))=h.id AND h.created_by=j.actor_id AND l.request_id=j.request_id AND l.actor_id=j.actor_id AND JSON_VALUE(l.preview_json,'$.sealHash')=@seal_hash)
 AND (h.status=N'draft' OR h.status=N'finalized' AND EXISTS(SELECT 1 FROM @HomeJournal j JOIN dbo.stage4_copy_effect_components e ON e.copy_id=@copy_id AND e.request_id=j.request_id AND e.entity=N'customer' JOIN dbo.customer_movements m ON m.id=e.native_id AND m.sales_invoice_id=h.id AND m.customer_id=h.customer_id AND m.currency_code=h.document_currency AND m.created_by=j.actor_id WHERE j.operation=N'sale_finalize' AND TRY_CONVERT(bigint,JSON_VALUE(j.payload_json,'$.id'))=h.id AND m.movement_type=N'sales_invoice' AND m.amount=h.grand_total AND e.effect_json COLLATE Latin1_General_100_BIN2=(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) COLLATE Latin1_General_100_BIN2)
 OR h.status=N'cancelled' AND EXISTS(SELECT 1 FROM @HomeJournal j WHERE j.operation=N'sale_cancel' AND TRY_CONVERT(bigint,JSON_VALUE(j.payload_json,'$.id'))=h.id));
DECLARE @HomeInbound TABLE(id bigint PRIMARY KEY);
INSERT @HomeInbound SELECT DISTINCT c.id FROM dbo.work_inbound_counts c JOIN dbo.work_business_count_bindings b ON b.count_id=c.id WHERE EXISTS(SELECT 1 FROM @HomeJournal j WHERE (j.actor_id=@actor OR @actor=16) AND j.operation=N'count_create' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.draft.id'))=c.id AND c.created_by=j.actor_id);
DECLARE @HomeBatches TABLE(id bigint PRIMARY KEY);
INSERT @HomeBatches SELECT DISTINCT b.id FROM dbo.test_goods_batches b WHERE EXISTS(SELECT 1 FROM @HomeJournal j WHERE (j.actor_id=@actor OR @actor=16) AND j.operation=N'count_submit' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.receipt.id'))=b.id AND b.created_by=j.actor_id);
DECLARE @HomePurchases TABLE(id bigint PRIMARY KEY);
INSERT @HomePurchases SELECT DISTINCT p.id FROM dbo.purchase_invoices p JOIN OPENJSON(@HomeDailyProfile,'$.suppliers')WITH(id bigint,currency nvarchar(3))s ON s.id=p.supplier_id AND s.currency=p.document_currency WHERE @purchase=1 AND EXISTS(SELECT 1 FROM @HomeJournal j WHERE (j.actor_id=@actor OR @actor=16) AND j.operation=N'purchase_draft' AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.id'))=p.id);
DECLARE @HomeDrafts TABLE(id bigint PRIMARY KEY);
INSERT @HomeDrafts SELECT DISTINCT d.id FROM dbo.test_daily_drafts d WHERE EXISTS(SELECT 1 FROM @HomeJournal j WHERE (j.actor_id=@actor OR @actor=16) AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.id'))=d.id AND d.created_by=j.actor_id AND ((j.operation=N'stock_count_draft' AND d.kind=N'count' AND d.flow=N'count') OR(j.operation=N'purchase_return_draft' AND d.kind=N'invoice-return' AND d.flow=N'purchase')));
DECLARE @HomeReturns TABLE(id bigint PRIMARY KEY);
INSERT @HomeReturns SELECT DISTINCT r.id FROM dbo.invoice_returns r JOIN dbo.test_daily_drafts d ON TRY_CONVERT(bigint,JSON_VALUE(d.result_json,'$.id'))=r.id JOIN @HomeDrafts own ON own.id=d.id JOIN @HomePurchases p ON p.id=r.source_purchase_invoice_id WHERE d.kind=N'invoice-return' AND d.flow=N'purchase' AND r.kind=N'purchase' AND EXISTS(SELECT 1 FROM @HomeJournal j WHERE TRY_CONVERT(bigint,JSON_VALUE(j.payload_json,'$.id'))=d.id AND ((r.status=N'finalized' AND j.operation=N'purchase_return_approve') OR(r.status=N'cancelled' AND j.operation=N'purchase_return_cancel')));
DECLARE @HomeMoney TABLE(entity nvarchar(10),id bigint,currency nvarchar(3),movement_type nvarchar(80),document_date date,amount decimal(38,4),PRIMARY KEY(entity,id));
INSERT @HomeMoney SELECT N'customer',m.id,m.currency_code,m.movement_type,m.document_date,CAST(m.amount AS decimal(38,4)) FROM dbo.customer_movements m JOIN OPENJSON(@HomeDailyProfile,'$.customers')WITH(id bigint,accountId bigint,partyId bigint,currency nvarchar(3))s ON s.id=m.customer_id AND s.accountId=m.party_currency_account_id AND s.partyId=m.party_entity_id AND s.currency=m.currency_code
WHERE @actor=16 AND @finance=1 AND @collection=1 AND m.balance_effect_exact IS NOT NULL AND EXISTS(SELECT 1 FROM dbo.stage4_copy_effect_components e JOIN @HomeJournal j ON j.request_id=e.request_id WHERE e.copy_id=@copy_id AND e.entity=N'customer' AND e.native_id=m.id AND m.created_by=j.actor_id AND ((j.operation=N'collection_create' AND m.movement_type=N'collection') OR(j.operation=N'collection_cancel' AND m.movement_type=N'collection_cancel')) AND e.effect_json COLLATE Latin1_General_100_BIN2=(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) COLLATE Latin1_General_100_BIN2 AND EXISTS(SELECT 1 FROM dbo.stage4_copy_effect_components cash JOIN dbo.finance_account_movements f ON f.id=cash.native_id JOIN OPENJSON(@HomeDailyProfile,'$.financeAccounts')WITH(id bigint)a ON a.id=f.account_id WHERE cash.copy_id=@copy_id AND cash.request_id=j.request_id AND cash.entity=N'cash' AND f.party_type=N'customer' AND f.party_movement_id=m.id AND f.source_type=m.movement_type AND f.created_by=j.actor_id AND cash.effect_json COLLATE Latin1_General_100_BIN2=(SELECT f.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) COLLATE Latin1_General_100_BIN2));
INSERT @HomeMoney SELECT N'supplier',m.id,m.currency_code,m.movement_type,m.document_date,CAST(m.amount AS decimal(38,4)) FROM dbo.supplier_movements m JOIN OPENJSON(@HomeDailyProfile,'$.suppliers')WITH(id bigint,accountId bigint,partyId bigint,currency nvarchar(3))s ON s.id=m.supplier_id AND s.accountId=m.party_currency_account_id AND s.partyId=m.party_entity_id AND s.currency=m.currency_code
WHERE @actor=16 AND @finance=1 AND @payment=1 AND m.balance_effect_exact IS NOT NULL AND EXISTS(SELECT 1 FROM dbo.stage4_copy_effect_components e JOIN @HomeJournal j ON j.request_id=e.request_id WHERE e.copy_id=@copy_id AND e.entity=N'supplier' AND e.native_id=m.id AND m.created_by=j.actor_id AND ((j.operation=N'payment' AND m.movement_type=N'payment') OR(j.operation=N'payment_cancel' AND m.movement_type=N'payment_cancel')) AND e.effect_json COLLATE Latin1_General_100_BIN2=(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) COLLATE Latin1_General_100_BIN2 AND EXISTS(SELECT 1 FROM dbo.stage4_copy_effect_components cash JOIN dbo.finance_account_movements f ON f.id=cash.native_id JOIN OPENJSON(@HomeDailyProfile,'$.financeAccounts')WITH(id bigint)a ON a.id=f.account_id WHERE cash.copy_id=@copy_id AND cash.request_id=j.request_id AND cash.entity=N'cash' AND f.party_type=N'supplier' AND f.party_movement_id=m.id AND f.source_type=m.movement_type AND f.created_by=j.actor_id AND cash.effect_json COLLATE Latin1_General_100_BIN2=(SELECT f.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) COLLATE Latin1_General_100_BIN2));
SELECT CASE WHEN @sales=1 THEN(SELECT COUNT_BIG(*) FROM dbo.sales_invoices h JOIN @HomeSales own ON own.id=h.id WHERE h.status=N'finalized' AND h.document_date=@date) END salesCount,
 CASE WHEN @sales=1 THEN(SELECT COUNT_BIG(*) FROM dbo.sales_invoices h JOIN @HomeSales own ON own.id=h.id WHERE h.status=N'cancelled' AND h.document_date=@date) END salesCancelledCount,
 CASE WHEN @goods=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches b JOIN @HomeBatches own ON own.id=b.id WHERE b.state=N'pending') END goodsPendingCount,
 CAST(NULL AS bigint) salesReturnCount,CASE WHEN @purchase_return=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns r JOIN @HomeReturns own ON own.id=r.id WHERE r.status=N'finalized' AND r.document_date=@date) END purchaseReturnCount,
 CASE WHEN @purchase_return=1 THEN(SELECT COUNT_BIG(*) FROM dbo.invoice_returns r JOIN @HomeReturns own ON own.id=r.id WHERE r.status=N'cancelled' AND r.document_date=@date) END returnCancelledCount,
 CASE WHEN @count=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts d JOIN @HomeDrafts own ON own.id=d.id WHERE d.kind=N'count' AND d.state=N'pending') END countPendingCount,
 CASE WHEN @approval=1 THEN(CASE WHEN @approve_goods=1 THEN(SELECT COUNT_BIG(*) FROM dbo.test_goods_batches b JOIN @HomeBatches own ON own.id=b.id WHERE b.state=N'pending') ELSE 0 END)+(SELECT COUNT_BIG(*) FROM dbo.test_daily_drafts d JOIN @HomeDrafts own ON own.id=d.id WHERE d.state=N'pending' AND ((@count=1 AND d.kind=N'count') OR(@purchase_return=1 AND d.kind=N'invoice-return' AND d.flow=N'purchase'))) END approvalPendingCount;
SELECT h.document_currency currency,CONVERT(varchar(20),COUNT(h.grand_total)) knownCount,CONVERT(varchar(20),COUNT_BIG(*)-COUNT(h.grand_total)) unknownCount,CASE WHEN COUNT_BIG(*)=COUNT(h.grand_total) THEN CONVERT(varchar(64),CAST(SUM(CAST(h.grand_total AS decimal(38,4))) AS decimal(38,4))) END amountExact4 FROM dbo.sales_invoices h JOIN @HomeSales own ON own.id=h.id WHERE @sales=1 AND h.status=N'finalized' AND h.document_date=@date GROUP BY h.document_currency;
${moneyQuery('@HomeMoney',"entity=N'customer' AND @collection=1 AND movement_type=N'collection'").replaceAll('currency_code','currency')}
${moneyQuery('@HomeMoney',"entity=N'supplier' AND @payment=1 AND movement_type=N'payment'").replaceAll('currency_code','currency')}
${moneyQuery('@HomeMoney',"movement_type IN(N'collection_cancel',N'payment_cancel')").replaceAll('currency_code','currency')}
SELECT TOP(5) id,kind,state,[date] FROM(
 SELECT N'inbound-count:'+CONVERT(varchar(20),c.id) id,N'goods' kind,N'draft' state,CAST(NULL AS varchar(10)) [date],1 priority FROM dbo.work_inbound_counts c JOIN @HomeInbound own ON own.id=c.id WHERE @goods=1 AND c.state IN(N'draft',N'needs_review')
 UNION ALL SELECT N'goods-batch:'+CONVERT(varchar(20),b.id),N'goods',N'pending',NULL,2 FROM dbo.test_goods_batches b JOIN @HomeBatches own ON own.id=b.id WHERE @goods=1 AND b.state=N'pending'
 UNION ALL SELECT N'daily:'+CONVERT(varchar(20),d.id),CASE WHEN d.kind=N'count' THEN N'count' ELSE N'return-purchase' END,N'pending',CONVERT(varchar(10),TRY_CONVERT(date,COALESCE(JSON_VALUE(d.payload_json,'$.date'),JSON_VALUE(d.payload_json,'$.documentDate'))),23),3 FROM dbo.test_daily_drafts d JOIN @HomeDrafts own ON own.id=d.id WHERE d.state=N'pending' AND ((@count=1 AND d.kind=N'count') OR(@purchase_return=1 AND d.kind=N'invoice-return' AND d.flow=N'purchase'))
 UNION ALL SELECT N'sales-draft:'+CONVERT(varchar(20),h.id),N'sales-draft',N'draft',CONVERT(varchar(10),h.document_date,23),4 FROM dbo.sales_invoices h JOIN @HomeSales own ON own.id=h.id WHERE @sales=1 AND h.status=N'draft'
 UNION ALL SELECT N'purchase-draft:'+CONVERT(varchar(20),p.id),N'purchase-draft',N'draft',CONVERT(varchar(10),p.document_date,23),4 FROM dbo.purchase_invoices p JOIN @HomePurchases own ON own.id=p.id WHERE @purchase=1 AND p.status=N'draft'
)jobs ORDER BY priority,id;`;

async function readCopyHome(runtime,{actorId,sessionPermissions,date},getDailySelection,getDailyScopeHash){
 const copy=assertIsolatedCopyContext(runtime.copyContext),actor={id:actorId,permissions:sessionPermissions};
 const business=copy.target.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
 const store=createIsolatedOperationCopyStore({getRuntime:async()=>runtime,domain:business?'inbound':'daily',readPermission:business?'goods.view':'product.view',buildDomain:async({context,actual,request})=>({context,summary:async()=>{
  // buildDomain is entered only after identity, ready registry, native/FK
  // proofs and current actor checks. The registered selection admits only the
  // daily copy-owned reader; native and session permissions still intersect.
  const dailySelection=business?getDailySelection(copy):null,dailySelectionReady=business&&dailySelection!==null&&typeof dailySelection==='object';
  const capabilities=business?(dailySelectionReady?businessDailyHomeCapabilities(actual.permissions,sessionPermissions,actorId):businessInboundHomeCapabilities(actual.permissions,sessionPermissions,actorId)):homeCapabilities(actual.permissions,sessionPermissions),sql=runtime.sql,req=request().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('date',sql.Date,copy.date);
  if(dailySelectionReady){const scopeHash=getDailyScopeHash(copy);if(typeof scopeHash!=='string'||! /^[A-F0-9]{64}$/.test(scopeHash))throw homeError();req.input('seal_hash',sql.Char(64),copy.sealHash).input('daily_scope_hash',sql.Char(64),scopeHash).input('collection',sql.Bit,capabilities.collection).input('payment',sql.Bit,capabilities.payment);}
  if(business)req.input('actor',sql.BigInt,actorId);
  for(const [key,name] of Object.entries({sales:'sales',goods:'goods',purchase:'purchase',finance:'finance',count:'count',approval:'approval',approveGoods:'approve_goods',salesReturn:'sales_return',purchaseReturn:'purchase_return'}))req.input(name,sql.Bit,capabilities[key]);
  const sets=(await req.query(business?(dailySelectionReady?BUSINESS_DAILY_HOME_SUMMARY_SQL:BUSINESS_INBOUND_HOME_SUMMARY_SQL):COPY_HOME_SUMMARY_SQL)).recordsets;if(!Array.isArray(sets)||sets.length!==6||sets[0]?.length!==1)throw homeError();
  return {capabilities,counts:sets[0][0],salesTotals:sets[1],collections:sets[2],payments:sets[3],reversals:sets[4],tasks:sets[5],copyMeta:{operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash,date:copy.date,...(business?{scopeKind:copy.scopeKind,dailySelectionReady,currentDate:date,dateBasis:'sealed-copy-date'}:{} )}};
 }})});return store.readHome(actor,c=>c.summary());
}
