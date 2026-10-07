// Goal8 E02: an audit of a connected day, not a bundle of unrelated module tests.
// Import with private, authenticated read adapters. This file never loads secrets,
// connects to SQL implicitly, provisions fixtures, or mutates the running service.
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {GOAL8_DAY_SQL_PROFILE_META} from '../../apps/api/src/services/goal8DaySqlProof.mjs';

export const GOAL8_DAY_TARGET=Object.freeze({
 // /test-health manifest identity differs from the containing release folder.
 packageId:'CANONICAL-TEST-769031cb88de',
 releaseDirectoryName:'CANONICAL-GOAL73-TEST-20261007-86',
 sourceCommit:'769031cb88de8ab26720266c62ce0e63d62d0877',
 server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',
 login:'melisa_sirket_sales_test_20260929_01',baseUrl:'http://127.0.0.1:4144',
 productId:'325503',supplierId:'13370',customerId:'30598',currency:'TRY'
});
const fail=code=>{throw Object.assign(new Error(code),{code});};
const requireTrue=(condition,code)=>{if(!condition)fail(code);};
const id=value=>{requireTrue(typeof value==='string'&&/^[1-9]\d*$/.test(value)&&BigInt(value)<=BigInt(Number.MAX_SAFE_INTEGER),'GOAL8_ID_INVALID');return value;};
const exact=(value,places)=>{requireTrue(typeof value==='string'&&new RegExp(`^-?(?:0|[1-9]\\d*)\\.\\d{${places}}$`).test(value),'GOAL8_EXACT_REQUIRED');return BigInt(value.replace('.',''));};
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const ids=rows=>{requireTrue(Array.isArray(rows),'GOAL8_SCOPE_MISSING');const values=rows.map(row=>id(row.id)).sort();requireTrue(new Set(values).size===values.length,'GOAL8_DUPLICATE_SCOPE');return values;};
const first=result=>{const rows=result?.recordset??result;requireTrue(Array.isArray(rows)&&rows.length===1,'GOAL8_SQL_SINGLE_ROW_REQUIRED');return rows[0];};
const data=response=>{requireTrue(response?.success===true&&response.data&&typeof response.data==='object','GOAL8_HTTP_RESPONSE_INVALID');return response.data;};

// SELECT-only, exact existing fixture identity; no arbitrary SQL from CLI input.
export const GOAL8_DAY_IDENTITY_SQL=`SELECT DB_NAME() databaseName,
 CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,
 SUSER_SNAME() loginName,USER_NAME() databaseUser,
 IS_SRVROLEMEMBER('sysadmin') sysadmin,
 HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,
 HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') liveAccess,
 (SELECT COUNT(*) FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id
 WHERE u.is_active=1 AND ((u.id=15 AND r.code=N'isolated_test_sales')
 OR(u.id=16 AND r.code=N'isolated_test_ilker'))) fixedActors;`;

export const GOAL8_DAY_SNAPSHOT_SQL=`SELECT
 CONVERT(varchar(20),p.id) productId,p.stock_code productCode,
 CONVERT(varchar(20),s.id) supplierId,s.supplier_code supplierCode,
 CONVERT(varchar(20),c.id) customerId,c.customer_code customerCode,
 CONVERT(varchar(20),a.id) accountId,a.account_code accountCode,
 p.unit,p.currency_code productCurrency,s.currency_code supplierCurrency,
 c.currency_code customerCurrency,a.currency_code accountCurrency,
 CONVERT(varchar(40),CAST(p.current_stock_qty AS decimal(18,3))) stockExact3,
 CONVERT(varchar(40),CAST(p.average_cost_try AS decimal(18,4))) costExact4,
 CONVERT(varchar(40),CAST(s.balance AS decimal(18,4))) supplierExact4,
 CONVERT(varchar(40),CAST(c.balance AS decimal(18,4))) customerExact4,
 CONVERT(varchar(40),CAST(a.current_balance AS decimal(18,4))) cashExact4,
 CAST(CASE WHEN p.source_record_key IS NULL AND p.migration_run_id IS NULL
 AND c.source_record_key IS NULL AND c.migration_run_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM erp_migration.accepted_price_products ap WHERE ap.product_id=p.id)
 THEN 1 ELSE 0 END AS bit) syntheticProvenance,
 (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds h
 WHERE (h.entity=N'product' AND h.native_id=p.id)
 OR(h.entity=N'supplier' AND h.native_id=s.id)
 OR(h.entity=N'customer' AND h.native_id=c.id)) holdCount
 FROM dbo.products p JOIN dbo.suppliers s ON s.id=p.supplier_id
 JOIN dbo.customers c ON c.id=30598
 JOIN dbo.finance_accounts a ON a.account_code=N'TEST-NIGHT-20261006-K'
 WHERE p.id=325503 AND s.id=13370;`;

export const GOAL8_PROFILE_DEPENDENCIES=Object.freeze([
 'Receiving/count fixture: keep 325503 / TEST-FINISH-GOODS-P2 and supplier13370; do not remap original fixture tables.',
 'Trade: add an explicit Goal8 profile selector with a synthetic TRY price120 for 325503; preserve NIGHT profile context and journal ownership.',
 'Trade SQL ready/context/effects and native guards: validate received/count/return movements on the shared product and supplier payment movements on the shared cash account; original NIGHT requires sales-only stock and collection-only cash.',
 'Payment: add a Goal8 context/ready/effects path bound to supplier13370, the newly finalized batch invoice, its receipt and the trade cash account; immutable FINOPS invoice300/receipt5 is not that purchase.',
 'Return: extend the existing purchase return source adapter with exact test_purchase_batch_links -> receipt line -> finalized invoice item ownership; current selector reads only test_purchase_links.',
 'Preserve current native guard manifests and old profile read/replay proofs; add reviewed profile definitions and proof hashes. No role or grant changes.',
 'Bind independent SQL stage readback and seven daily report kinds to the new request/receipt/invoice/movement IDs; CRM acceptance remains separate.'
]);

function verifyIdentity(row,health,t){
 requireTrue(row?.databaseName===t.database&&row.serverName===t.server&&row.loginName===t.login&&row.databaseUser===t.login&&row.sysadmin===0&&row.control===0&&row.liveAccess===0&&row.fixedActors===2,'GOAL8_SQL_TARGET_REJECTED');
 requireTrue(health?.ok===true&&health.environment==='CANONICAL_TEST'&&health.mode==='erp'&&health.port===4144&&health.databaseName===t.database&&health.serverName===t.server&&health.loginName===t.login&&health.databaseUser===t.login&&health.sysadmin===0&&health.databaseControl===0&&health.liveDatabaseAccess===0&&health.sourceCommit===t.sourceCommit&&health.packageId===t.packageId&&health.sqlReadOnly===false&&health.writes===true&&health.externalOperations===false&&health.automaticJobs===false,'GOAL8_RUNTIME_TARGET_REJECTED');
}
export function verifyGoal8Identity(row,health){return verifyIdentity(row,health,GOAL8_DAY_TARGET);}
export function verifyGoal8SealedIdentity(row,health,seal){
 requireTrue(seal?.profileId==='ERP-GOAL8-20261007'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(seal.dayId??'')&&/^[A-F0-9]{64}$/.test(seal.definitionHash??'')&&/^[a-f0-9]{40}$/.test(seal.sourceCommit??'')&&seal.packageId==='CANONICAL-TEST-'+seal.sourceCommit.slice(0,12),'GOAL8_EXPLICIT_RUNTIME_SEAL_REQUIRED');
 requireTrue(GOAL8_DAY_SQL_PROFILE_META?.id===seal.profileId&&GOAL8_DAY_SQL_PROFILE_META.dayId===seal.dayId&&GOAL8_DAY_SQL_PROFILE_META.definitionHash===seal.definitionHash,'GOAL8_COMPILED_PROFILE_SEAL_REQUIRED');
 verifyIdentity(row,health,{...GOAL8_DAY_TARGET,sourceCommit:seal.sourceCommit,packageId:seal.packageId});
}

export function goal8DayRequestId(dayId,step){
 requireTrue(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(dayId??'')&&/^[a-z-]{3,40}$/.test(step??''),'GOAL8_REQUEST_PLAN_INVALID');
 const h=createHash('sha256').update(dayId+'|'+step).digest('hex').slice(0,32).split('');h[12]='4';h[16]=(8+(parseInt(h[16],16)%4)).toString(16);
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].map(x=>x.join('')).join('-');
}
export function goal8NativeProofSql(refs,dayId,accountId){
 requireTrue(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(dayId??''),'GOAL8_DAY_ID_INVALID');id(accountId);
 const n=key=>refs[key]===undefined?'NULL':id(String(refs[key]));
 return `SELECT
 CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.test_goods_batches b JOIN dbo.test_goods_batch_lines l ON l.batch_id=b.id WHERE b.id=${n('receiptId')} AND b.state=N'accepted' AND b.supplier_id=13370 AND b.decided_by=16 AND b.note=N'GOAL8:${dayId}' AND l.product_id=325503 AND l.quantity=2 AND l.unit=N'ADET' AND l.unit_factor=1) THEN 1 ELSE 0 END AS bit) receiptVerified,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.purchase_invoices p JOIN dbo.test_purchase_batch_links l ON l.invoice_id=p.id JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id JOIN dbo.purchase_invoice_items i ON i.id=l.invoice_item_id WHERE p.id=${n('purchaseInvoiceId')} AND p.status=N'finalized' AND p.supplier_id=13370 AND p.document_date=CONVERT(date,N'2026-10-07') AND p.document_no LIKE N'TSTB-G8-%' AND p.grand_total=160 AND p.account_amount=160 AND p.amount_try=160 AND p.document_currency=N'TRY' AND p.account_currency=N'TRY' AND p.exchange_rate_snapshot=1 AND p.account_exchange_rate_snapshot=1 AND g.batch_id=${n('receiptId')} AND i.product_id=325503 AND i.quantity=2 AND l.quantity=2 AND i.purchase_price=80) THEN 1 ELSE 0 END AS bit) purchaseVerified,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.sales_invoices s JOIN dbo.sales_invoice_items i ON i.sales_invoice_id=s.id WHERE s.id=${n('salesInvoiceId')} AND s.status=N'finalized' AND s.customer_id=30598 AND s.document_date=CONVERT(date,N'2026-10-07') AND s.grand_total=120 AND s.document_currency=N'TRY' AND s.account_currency=N'TRY' AND s.exchange_rate_snapshot=1 AND s.account_exchange_rate_snapshot=1 AND i.product_id=325503 AND i.quantity=1 AND i.unit_price=120 AND i.average_cost_try_snapshot=80) THEN 1 ELSE 0 END AS bit) saleVerified,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.customer_movements m JOIN dbo.finance_account_movements f ON f.party_type=N'customer' AND f.party_movement_id=m.id AND f.source_type=N'collection' WHERE m.id=${n('collectionId')} AND m.customer_id=30598 AND m.sales_invoice_id=${n('salesInvoiceId')} AND m.movement_type=N'collection' AND m.amount=120 AND m.balance_effect=-120 AND m.account_amount=120 AND m.amount_try=120 AND m.document_exchange_rate_snapshot=1 AND m.account_exchange_rate_snapshot=1 AND f.account_id=${accountId} AND f.direction=N'in' AND f.amount=120 AND f.currency_code=N'TRY') THEN 1 ELSE 0 END AS bit) collectionVerified,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.supplier_movements m JOIN dbo.finance_account_movements f ON f.party_type=N'supplier' AND f.party_movement_id=m.id AND f.source_type=N'payment' WHERE m.id=${n('paymentId')} AND m.supplier_id=13370 AND m.purchase_invoice_id=${n('purchaseInvoiceId')} AND m.movement_type=N'payment' AND m.amount=80 AND m.balance_effect=-80 AND m.account_amount=80 AND m.amount_try=80 AND m.document_exchange_rate_snapshot=1 AND m.account_exchange_rate_snapshot=1 AND f.account_id=${accountId} AND f.direction=N'out' AND f.amount=80 AND f.currency_code=N'TRY') THEN 1 ELSE 0 END AS bit) paymentVerified,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.test_daily_drafts d CROSS APPLY OPENJSON(d.payload_json,'$.lines') WITH(productId bigint,physical decimal(18,3),system decimal(18,3)) l WHERE d.id=${n('countDraftId')} AND d.flow=N'count' AND d.state=N'approved' AND d.decided_by=16 AND l.productId=325503 AND l.physical=l.system AND JSON_VALUE(d.result_json,'$.movementCreated')=N'false') THEN 1 ELSE 0 END AS bit) countVerified,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.invoice_returns r JOIN dbo.invoice_return_items i ON i.invoice_return_id=r.id JOIN dbo.stock_movements m ON m.source_type=N'invoice_return' AND m.source_id=r.id AND m.product_id=i.product_id JOIN dbo.supplier_movements s ON s.invoice_return_id=r.id WHERE r.id=${n('returnId')} AND r.source_purchase_invoice_id=${n('purchaseInvoiceId')} AND r.kind=N'purchase' AND r.status=N'finalized' AND r.supplier_id=13370 AND r.amount=80 AND r.account_amount=80 AND r.amount_try=80 AND i.product_id=325503 AND i.quantity=1 AND i.unit_cost_try=80 AND m.quantity_net=-1 AND m.unit_cost_try=80 AND s.supplier_id=13370 AND s.movement_type=N'purchase_return' AND s.balance_effect=-80) THEN 1 ELSE 0 END AS bit) returnVerified,
 (SELECT CONVERT(varchar(20),id) FROM dbo.customer_movements WHERE sales_invoice_id=${n('salesInvoiceId')} AND movement_type=N'sales_invoice') customerSaleMovementId,
 (SELECT CONVERT(varchar(20),id) FROM dbo.supplier_movements WHERE purchase_invoice_id=${n('purchaseInvoiceId')} AND movement_type=N'purchase_invoice') supplierPurchaseMovementId,
 (SELECT CONVERT(varchar(20),id) FROM dbo.supplier_movements WHERE invoice_return_id=${n('returnId')} AND movement_type=N'purchase_return') supplierReturnMovementId,
 JSON_QUERY((SELECT CONVERT(varchar(20),id) id,source_type sourceType FROM dbo.stock_movements WHERE product_id=325503 AND((source_type=N'sales_invoice' AND source_id=${n('salesInvoiceId')}) OR(source_type=N'invoice_return' AND source_id=${n('returnId')}) OR(source_type=N'goods_receipt_batch' AND source_id IN(SELECT id FROM dbo.test_goods_batch_lines WHERE batch_id=${n('receiptId')}))) ORDER BY id FOR JSON PATH)) stockMovementIds,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(
 (SELECT * FROM dbo.products WHERE id=325503 FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.suppliers WHERE id=13370 FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.customers WHERE id=30598 FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.finance_accounts WHERE id=${accountId} FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.stock_movements WHERE product_id=325503 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.supplier_movements WHERE supplier_id=13370 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.customer_movements WHERE customer_id=30598 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.finance_account_movements WHERE account_id=${accountId} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.purchase_invoices WHERE supplier_id=13370 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=${n('purchaseInvoiceId')} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.sales_invoices WHERE customer_id=30598 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.sales_invoice_items WHERE sales_invoice_id=${n('salesInvoiceId')} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.invoice_returns WHERE supplier_id=13370 ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.invoice_return_items WHERE invoice_return_id=${n('returnId')} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.test_goods_batches WHERE id=${n('receiptId')} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.test_goods_batch_lines WHERE batch_id=${n('receiptId')} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.test_purchase_batch_links WHERE invoice_id=${n('purchaseInvoiceId')} ORDER BY invoice_id,invoice_item_id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.work_inbound_counts WHERE note=N'GOAL8:${dayId}' ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.test_daily_drafts WHERE id IN(${n('countDraftId')},${n('returnDraftId')}) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.work_trade_requests WHERE JSON_VALUE(payload_json,'$.testDayId')=N'${dayId}' ORDER BY request_id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.test_daily_requests WHERE request_id IN(N'${goal8DayRequestId(dayId,'physical-count-draft')}',N'${goal8DayRequestId(dayId,'physical-count-approve')}',N'${goal8DayRequestId(dayId,'return-draft')}',N'${goal8DayRequestId(dayId,'return-approve')}') ORDER BY request_id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.audit_logs WHERE (entity_type=N'sales_invoice' AND entity_id=${n('salesInvoiceId')}) OR(entity_type=N'purchase_invoice' AND entity_id=${n('purchaseInvoiceId')}) OR(entity_type=N'supplier_movement' AND entity_id=${n('paymentId')}) OR(entity_type=N'customer_movement' AND entity_id=${n('collectionId')}) OR(entity_type=N'invoice_return' AND entity_id=${n('returnId')}) OR(entity_type=N'test_daily_draft' AND entity_id IN(${n('countDraftId')},${n('returnDraftId')})) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES),
 (SELECT * FROM dbo.work_supplier_payment_requests WHERE JSON_VALUE(payload_json,'$.testDayId')=N'${dayId}' ORDER BY request_id FOR JSON PATH,INCLUDE_NULL_VALUES)
 )),2) effectHash;`;
}

function sealedContext(context,seal){const p=context?.meta?.testProfile;requireTrue(p?.id===seal.profileId&&p.dayId===seal.dayId&&p.definitionHash===seal.definitionHash&&p.sealed===true&&p.synthetic===true&&p.productId==='325503'&&p.supplierId==='13370'&&p.customerId==='30598'&&p.currency==='TRY','GOAL8_CONTEXT_SEAL_REJECTED');return p;}
export async function auditGoal8SealedProfile({httpGet,sqlRead,seal}={}){
 requireTrue(typeof httpGet==='function'&&typeof sqlRead==='function','GOAL8_READ_ADAPTERS_REQUIRED');
 const health=await httpGet('/test-health'),identity=first(await sqlRead(GOAL8_DAY_IDENTITY_SQL));verifyGoal8SealedIdentity(identity,health,seal);
 const snapshot=verifyGoal8Snapshot(first(await sqlRead(GOAL8_DAY_SNAPSHOT_SQL))),sales=data(await httpGet('/api/work-sales/context',{actorId:'16'})),payments=data(await httpGet('/api/work-supplier-payments/context',{actorId:'16'}));
 const trade=sealedContext(sales,seal),payment=sealedContext(payments,seal);
 requireTrue(trade.accountId===snapshot.accountId&&payment.accountId===snapshot.accountId&&sales.scope?.customer?.id==='30598'&&sales.scope.products.some(p=>p.id==='325503'&&p.prices.some(q=>q.unitPriceExact8==='120.00000000'&&q.source?.quotedPrice===true&&q.source.fixture===seal.profileId))&&payments.suppliers?.length===1&&payments.suppliers[0].id==='13370'&&payments.accounts?.length===1&&payments.accounts[0].id===snapshot.accountId,'GOAL8_CONNECTED_CONTEXT_REQUIRED');
 return {schemaVersion:'melisa-goal8-sealed-profile-readiness.v1',mode:'read-only',status:'READY_FOR_EXPLICIT_SYNTHETIC_DAY',runtime:{sourceCommit:health.sourceCommit,packageId:health.packageId},seal,snapshot,chainExecuted:false,technicalPass:false,humanAccepted:false};
}
export function verifyGoal8CrmDay(evidence){
 requireTrue(evidence?.conversationVerified===true&&evidence.translationBaselineReused===true&&evidence.catalogCompared===true&&evidence.catalogPriceProvenanceVerified===true&&evidence.customerId==='30598'&&evidence.orderCustomerId==='30598'&&evidence.orderDraftVerified===true&&evidence.orderIndependentGet===true&&evidence.orderStockEffect===false&&evidence.orderFinanceEffect===false&&evidence.messageSent===false&&evidence.assignmentChanged===false&&evidence.rolesChanged===false,'GOAL8_CRM_CHAIN_NOT_VERIFIED');
 id(evidence.orderProductId);id(evidence.orderId);
 requireTrue(evidence.orderProductId!=='325503'&&evidence.distinctAcceptedCatalogItem===true,'GOAL8_CRM_PRICE_PROVENANCE_CONFLICT');
 return {technicalVerified:true,humanAccepted:false,customerId:'30598',orderId:evidence.orderId,orderProductId:evidence.orderProductId,distinctAcceptedCatalogItem:true,stockEffect:false,financeEffect:false,messageSent:false};
}

// Root supplies private authenticated adapters and a reviewed compiled profile.
// No arbitrary endpoints/SQL, automatic fixture installation or implicit writes.
// Every mutation is followed by normal GET + independent native SELECT + exact
// full-body replay; stale revisions are intentionally reused only for replay.
export async function runGoal8SyntheticDay({httpGet,httpPost,sqlRead,seal,runSyntheticDay=false,crmEvidence=null,onStage=async()=>{}}={}){
 if(!runSyntheticDay)return seal?auditGoal8SealedProfile({httpGet,sqlRead,seal}):auditGoal8TestDay({httpGet,sqlRead});
 requireTrue(typeof httpGet==='function'&&typeof httpPost==='function'&&typeof sqlRead==='function','GOAL8_DAY_ADAPTERS_REQUIRED');
 const get=async(path,actorId='16')=>data(await httpGet(path,{actorId}));
 const post=async(path,body,actorId='16')=>data(await httpPost(path,body,{actorId}));
 const health=await httpGet('/test-health'),identity=first(await sqlRead(GOAL8_DAY_IDENTITY_SQL));verifyGoal8SealedIdentity(identity,health,seal);
 for(const [actorId,role] of [['15','isolated_test_sales'],['16','isolated_test_ilker']]){const me=await get('/api/auth/me',actorId);requireTrue(String(me.id)===actorId&&me.role?.code===role,'GOAL8_HTTP_ACTOR_REJECTED');}
 const baseline=verifyGoal8Snapshot(first(await sqlRead(GOAL8_DAY_SNAPSHOT_SQL)));
 requireTrue(exact(baseline.stockExact3,3)%1000n===0n&&exact(baseline.stockExact3,3)<=29000n,'GOAL8_RECEIVING_COUNT_CAPACITY');
 const office=await get('/api/work-sales/context'),profile=sealedContext(office,seal),paymentContext=await get('/api/work-supplier-payments/context');sealedContext(paymentContext,seal);
 requireTrue(profile.accountId===baseline.accountId&&office.scope?.synthetic===true&&office.scope.customer?.id==='30598'&&office.scope.products.some(p=>p.id==='325503'&&p.prices.some(q=>q.unitPriceExact8==='120.00000000'&&q.source?.quotedPrice===true&&q.source.fixture===seal.profileId))&&paymentContext.suppliers?.length===1&&paymentContext.suppliers[0].id==='13370'&&paymentContext.accounts?.length===1&&paymentContext.accounts[0].id===baseline.accountId,'GOAL8_CONNECTED_CONTEXT_REQUIRED');
 const refs={},stages=[],calls=[],request=step=>goal8DayRequestId(seal.dayId,step),snapshot=async()=>verifyGoal8Snapshot(first(await sqlRead(GOAL8_DAY_SNAPSHOT_SQL))),proof=async()=>first(await sqlRead(goal8NativeProofSql(refs,seal.dayId,baseline.accountId)));
 const nativeChecks={receive:['receiptVerified','GOAL8_RECEIPT_NATIVE_PROOF'],purchase:['purchaseVerified','GOAL8_PURCHASE_NATIVE_PROOF'],sale:['saleVerified','GOAL8_SALE_NATIVE_PROOF'],collect:['collectionVerified','GOAL8_COLLECTION_NATIVE_PROOF'],pay:['paymentVerified','GOAL8_PAYMENT_NATIVE_PROOF'],count:['countVerified','GOAL8_COUNT_NATIVE_PROOF'],return:['returnVerified','GOAL8_RETURN_NATIVE_PROOF']};
 const append=async(stage,values={})=>{const row=await snapshot(),native=await proof();requireTrue(/^[A-F0-9]{64}$/.test(native.effectHash??''),'GOAL8_EFFECT_FINGERPRINT_REQUIRED');const check=nativeChecks[stage];if(check)requireTrue(native[check[0]]===true,check[1]);const item={stage,...row,currency:'TRY',synthetic:true,independentNativeReadback:true,...values,nativeProof:native};stages.push(item);await onStage(structuredClone(item));return item;};
 const mutate=async(step,path,body,actorId='16')=>{const result=await post(path,body,actorId);calls.push({step,path,actorId,requestId:body.requestId});return result;};
 const replay=async(path,body,actorId='16')=>{const before=await proof(),result=await post(path,body,actorId),after=await proof();requireTrue(result.replayed===true&&before.effectHash===after.effectHash,'GOAL8_REPLAY_NATIVE_EFFECT');return {replayed:true,replayAdditionalEffects:0};};
 await append('baseline');
 const receiving=await get('/api/work-receiving/context','15'),product=receiving.scope?.products.find(p=>p.id==='325503');requireTrue(product?.writeEligible===true&&receiving.scope.supplier?.id==='13370','GOAL8_RECEIVING_SCOPE');
 const createCountBody={requestId:request('receive-count'),note:'GOAL8:'+seal.dayId,lines:[{clientLineId:'G8-P2',productId:'325503',barcode:product.barcode??null,stockCode:product.stockCode,physicalQuantityExact3:'2.000',expectedQuantityExact3:null,issue:null,note:''}]};
 const receivedCount=await mutate('receive-count','/api/work-receiving/count-drafts',createCountBody,'15');
 const submitBody={requestId:request('receive-submit'),expectedRevision:receivedCount.draft.revision};
 const submitted=await mutate('receive-submit','/api/work-receiving/count-drafts/'+id(receivedCount.draft.id)+'/submit',submitBody,'15');refs.receiptId=id(submitted.receipt.id);
 const approveBody={requestId:request('receive-approve')},approvePath='/api/work-receiving/receipts/'+refs.receiptId+'/approve';
 const received=await mutate('receive-approve',approvePath,approveBody);requireTrue(received.receipt?.state==='accepted'&&received.receipt.lines?.length===1,'GOAL8_RECEIPT_NOT_ACCEPTED');refs.receiptLineId=id(received.receipt.lines[0].id);
 const receivingRead=await get('/api/work-purchases/context');requireTrue(receivingRead.receipts.some(r=>r.id===refs.receiptId&&r.state==='accepted'),'GOAL8_RECEIPT_NORMAL_GET');
 await append('receive',{requestId:approveBody.requestId,...refs,quantityExact3:'2.000',...await replay(approvePath,approveBody)});requireTrue(stages.at(-1).nativeProof.receiptVerified===true,'GOAL8_RECEIPT_NATIVE_PROOF');
 const purchaseBody={requestId:request('purchase-draft'),receiptId:refs.receiptId,number:'TSTB-G8-'+seal.dayId.slice(0,8),documentDate:'2026-10-07',currency:'TRY',lines:[{receiptLineId:refs.receiptLineId,quantityExact3:'2.000'}]};
 const purchase=await mutate('purchase-draft','/api/work-purchases/drafts',purchaseBody);refs.purchaseInvoiceId=id(purchase.invoice.id);refs.purchaseItemId=id(purchase.invoice.items[0].id);
 const finalizePurchaseBody={requestId:request('purchase-finalize')},finalizePurchasePath='/api/work-purchases/drafts/'+refs.purchaseInvoiceId+'/finalize';await mutate('purchase-finalize',finalizePurchasePath,finalizePurchaseBody);
 const purchaseRead=await get('/api/work-purchases/drafts/'+refs.purchaseInvoiceId),supplierRead=await get('/api/work-suppliers/history');requireTrue(purchaseRead.status==='finalized'&&purchaseRead.receiptId===refs.receiptId&&purchaseRead.totals.grandTotalExact4==='160.0000'&&supplierRead.supplier.id==='13370','GOAL8_PURCHASE_NORMAL_GET');
 await append('purchase',{requestId:finalizePurchaseBody.requestId,...refs,amountExact4:'160.0000',...await replay(finalizePurchasePath,finalizePurchaseBody)});requireTrue(stages.at(-1).nativeProof.purchaseVerified===true,'GOAL8_PURCHASE_NATIVE_PROOF');
 const saleContext=await get('/api/work-sales/context','15');sealedContext(saleContext,seal);const quote=saleContext.scope.products.find(p=>p.id==='325503').prices[0];
 const selection={customerId:'30598',documentDate:'2026-10-07',currency:'TRY',items:[{productId:'325503',quoteId:quote.quoteId,quantityExact3:'1.000'}]};
 const salePreview=await post('/api/work-sales/preview',selection,'15'),saleBody={...selection,requestId:request('sale-draft'),expectedRevision:saleContext.revision,previewHash:salePreview.previewHash};
 const sale=await mutate('sale-draft','/api/work-sales/drafts',saleBody,'15');refs.salesInvoiceId=id(sale.invoice.id);
 const finalizeSaleBody={requestId:request('sale-finalize'),expectedRevision:sale.invoice.revision},finalizeSalePath='/api/work-sales/drafts/'+refs.salesInvoiceId+'/finalize';await mutate('sale-finalize',finalizeSalePath,finalizeSaleBody,'15');
 const saleRead=await get('/api/work-sales/invoices/'+refs.salesInvoiceId);requireTrue(saleRead.status==='finalized'&&saleRead.customerId==='30598'&&saleRead.grandTotalExact4==='120.0000','GOAL8_SALE_NORMAL_GET');
 await append('sale',{requestId:finalizeSaleBody.requestId,...refs,quantityExact3:'1.000',amountExact4:'120.0000',...await replay(finalizeSalePath,finalizeSaleBody,'15')});requireTrue(stages.at(-1).nativeProof.saleVerified===true,'GOAL8_SALE_NATIVE_PROOF');
 const collectionSelection={invoiceId:refs.salesInvoiceId,accountId:baseline.accountId,amountExact4:'120.0000',documentDate:'2026-10-07'},collectionPreview=await post('/api/work-collections/preview',collectionSelection),collectionBody={...collectionSelection,requestId:request('collection'),expectedRevision:collectionPreview.revision,previewHash:collectionPreview.previewHash};
 const collected=await mutate('collection','/api/work-collections',collectionBody);refs.collectionId=id(collected.collection.id);
 const collectionRead=await get('/api/work-collections/context?invoiceId='+refs.salesInvoiceId);requireTrue(collectionRead.invoice.collections.receivedExact4==='120.0000'&&collectionRead.invoice.collections.outstandingExact4==='0.0000','GOAL8_COLLECTION_NORMAL_GET');
 await append('collect',{requestId:collectionBody.requestId,...refs,amountExact4:'120.0000',direction:'in',...await replay('/api/work-collections',collectionBody)});requireTrue(stages.at(-1).nativeProof.collectionVerified===true,'GOAL8_COLLECTION_NATIVE_PROOF');
 const paymentBefore=await get('/api/work-supplier-payments/context');sealedContext(paymentBefore,seal);const linked=paymentBefore.suppliers[0].invoices.find(i=>i.id===refs.purchaseInvoiceId);requireTrue(linked?.receiptId===refs.receiptId&&linked.receiptKind==='work-goal8-batch-receipt'&&linked.remainingExact4==='160.0000','GOAL8_PAYMENT_PURCHASE_RECEIPT_LINK');
 const paymentSelection={supplierId:'13370',invoiceId:refs.purchaseInvoiceId,accountId:baseline.accountId,currency:'TRY',amountExact4:'80.0000',documentDate:'2026-10-07',description:'GOAL8:'+seal.dayId},paymentPreview=await post('/api/work-supplier-payments/preview',paymentSelection),paymentBody={...paymentSelection,requestId:request('payment'),expectedRevision:paymentBefore.revision,previewHash:paymentPreview.previewHash};
 const paid=await mutate('payment','/api/work-supplier-payments/payments',paymentBody);refs.paymentId=id(paid.payment.id);
 const paymentRead=await get('/api/work-supplier-payments/context');requireTrue(paymentRead.payments.some(p=>p.id===refs.paymentId&&p.accountId===baseline.accountId&&p.invoiceId===refs.purchaseInvoiceId&&p.receiptId===refs.receiptId),'GOAL8_PAYMENT_NORMAL_GET');
 await append('pay',{requestId:paymentBody.requestId,...refs,amountExact4:'80.0000',direction:'out',...await replay('/api/work-supplier-payments/payments',paymentBody)});requireTrue(stages.at(-1).nativeProof.paymentVerified===true,'GOAL8_PAYMENT_NATIVE_PROOF');
 const countContext=await get('/api/test-daily/count'),countProduct=countContext.countProducts.find(p=>p.id==='325503');requireTrue(countProduct&&Number.isSafeInteger(countProduct.stockQuantity),'GOAL8_COUNT_NATIVE_QUANTITY');
 const physicalBody={requestId:request('physical-count-draft'),date:'2026-10-07',unit:'ADET',warehouse:'TEST-DAILY-WH',unknownScans:[],lines:[{productId:'325503',stockCode:countProduct.stockCode,physical:countProduct.stockQuantity,system:countProduct.stockQuantity,reason:'Fark yok',movementFingerprint:countProduct.movementFingerprint}]};
 const physical=await mutate('physical-count-draft','/api/test-daily/count/draft',physicalBody);refs.countDraftId=id(String(physical.id));
 const countApproveBody={requestId:request('physical-count-approve'),id:Number(refs.countDraftId),reason:'Goal8 aynı ürün fiziksel sayımı'};await mutate('physical-count-approve','/api/test-daily/count/approve',countApproveBody);
 const countRead=await get('/api/test-daily/count');requireTrue(countRead.drafts.some(d=>String(d.id)===refs.countDraftId&&d.state==='approved'),'GOAL8_COUNT_NORMAL_GET');
 await append('count',{requestId:countApproveBody.requestId,...refs,quantityExact3:'0.000',...await replay('/api/test-daily/count/approve',countApproveBody)});requireTrue(stages.at(-1).nativeProof.countVerified===true,'GOAL8_COUNT_NATIVE_PROOF');
 const returnContext=await get('/api/test-daily/purchase'),returnSource=returnContext.availablePurchaseSources.find(s=>String(s.id)===refs.purchaseInvoiceId);requireTrue(returnSource?.items.some(i=>String(i.id)===refs.purchaseItemId&&i.product_id===325503&&i.returnableQuantity>=1),'GOAL8_RETURN_SOURCE_NORMAL_GET');
 const returnBody={requestId:request('return-draft'),date:'2026-10-07',sourceInvoiceId:Number(refs.purchaseInvoiceId),sourceItemId:Number(refs.purchaseItemId),quantity:1,reason:'Goal8 kalan tek ürün tedarikçiye iade'};const returnDraft=await mutate('return-draft','/api/test-daily/purchase/draft',returnBody);refs.returnDraftId=id(String(returnDraft.id));
 const returnApproveBody={requestId:request('return-approve'),id:Number(refs.returnDraftId)};const returned=await mutate('return-approve','/api/test-daily/purchase/approve',returnApproveBody);refs.returnId=id(String(returned.result.id));
 const returnRead=await get('/api/test-daily/purchase');requireTrue(returnRead.drafts.some(d=>String(d.id)===refs.returnDraftId&&d.state==='approved'),'GOAL8_RETURN_NORMAL_GET');
 await append('return',{requestId:returnApproveBody.requestId,...refs,quantityExact3:'1.000',amountExact4:'80.0000',...await replay('/api/test-daily/purchase/approve',returnApproveBody)});requireTrue(stages.at(-1).nativeProof.returnVerified===true,'GOAL8_RETURN_NATIVE_PROOF');
 const reports={},native=await proof();
 for(const kind of ['sales','purchases','collections','supplier-payments','stock-movements','customer-movements','supplier-movements']){const rows=[];let offset=0;for(let page=0;page<1000;page++){const r=await get('/api/work-reports?kind='+kind+'&period=custom&from=2026-10-07&to=2026-10-07&currency=TRY&limit=100&offset='+offset);requireTrue(Array.isArray(r.rows)&&r.filters?.from==='2026-10-07'&&r.filters.to==='2026-10-07','GOAL8_REPORT_SOURCE_INVALID');rows.push(...r.rows);if(!r.pagination.hasMore)break;offset+=100;requireTrue(page<999,'GOAL8_REPORT_PAGE_LIMIT');}reports[kind]=rows;}
 const reportRow=(kind,target,amount)=>requireTrue(reports[kind].filter(r=>String(r.id)===target&&r.currency==='TRY'&&r.amount===amount).length===1,'GOAL8_REPORT_NATIVE_LINK');
 reportRow('sales',refs.salesInvoiceId,'120.0000');reportRow('purchases',refs.purchaseInvoiceId,'160.0000');reportRow('collections',refs.collectionId,'120.0000');reportRow('supplier-payments',refs.paymentId,'80.0000');reportRow('customer-movements',id(native.customerSaleMovementId),'120.0000');reportRow('supplier-movements',id(native.supplierPurchaseMovementId),'160.0000');reportRow('supplier-movements',id(native.supplierReturnMovementId),'-80.0000');
 const stockIds=typeof native.stockMovementIds==='string'?JSON.parse(native.stockMovementIds):native.stockMovementIds;requireTrue(Array.isArray(stockIds)&&stockIds.length===3&&stockIds.every(s=>reports['stock-movements'].filter(r=>r.id===s.id&&r.currency==='TRY').length===1),'GOAL8_REPORT_STOCK_LINK');
 await append('daily-report',{...refs,reportVerified:true,reportSalesInvoiceId:refs.salesInvoiceId,reportPurchaseInvoiceId:refs.purchaseInvoiceId,reportReceiptId:refs.receiptId,reportSalesExact4:'120.0000',reportPurchasesExact4:'160.0000',reportCollectionsExact4:'120.0000',reportPaymentsExact4:'80.0000',reportReturnsExact4:'80.0000'});
 const consistency=verifyGoal8LinkedDay(stages),crm=crmEvidence?verifyGoal8CrmDay(crmEvidence):null;
 return {schemaVersion:'melisa-goal8-connected-day.v1',runtime:{sourceCommit:health.sourceCommit,packageId:health.packageId},seal,mode:'synthetic-test-day',chainExecuted:true,nativeTechnicalPass:true,technicalPass:crm!==null,fullDayVerified:crm!==null,humanAccepted:false,crm,remaining:crm?[]:['CURRENT_CRM_DAY_LINK_REQUIRED'],refs,stages,calls,reports,consistency};
}

export function verifyGoal8Snapshot(row){
 const t=GOAL8_DAY_TARGET;
 requireTrue(row?.productId===t.productId&&row.productCode==='TEST-FINISH-GOODS-P2'&&row.supplierId===t.supplierId&&row.supplierCode==='TEST-V70-GOODS-S'&&row.customerId===t.customerId&&row.customerCode==='TEST-NIGHT-20261006-C'&&row.accountCode==='TEST-NIGHT-20261006-K'&&row.unit==='ADET'&&['productCurrency','supplierCurrency','customerCurrency','accountCurrency'].every(k=>row[k]==='TRY')&&row.syntheticProvenance===true&&row.holdCount===0,'GOAL8_SYNTHETIC_OR_HOLD_REJECTED');
 id(row.accountId);requireTrue(exact(row.costExact4,4)===800000n,'GOAL8_COST_DRIFT');
 for(const [key,places] of [['stockExact3',3],['supplierExact4',4],['customerExact4',4],['cashExact4',4]])exact(row[key],places);
 return row;
}

export function assessGoal8Scopes({receiving,purchases,sales,payments,count},snapshot){
 requireTrue(receiving?.scope?.synthetic===true&&purchases?.scope?.synthetic===true&&sales?.scope?.synthetic===true,'GOAL8_SYNTHETIC_FLAG_REQUIRED');
 const inbound=ids(receiving.scope.products),buy=ids(purchases.scope.products),sell=ids(sales.scope.products),countIds=ids(count?.countProducts);
 requireTrue(same(inbound,['301985','325503'])&&same(inbound,buy)&&same(inbound,countIds)&&receiving.scope.products.every(p=>p.writeEligible===true)&&sales.scope.products.every(p=>p.synthetic===true&&p.writeEligible===true)&&sales.scope.customer?.synthetic===true,'GOAL8_SCOPE_DRIFT');
 requireTrue(receiving.scope.supplier?.id==='13370'&&purchases.scope.supplier?.id==='13370'&&sales.scope.customer?.id==='30598','GOAL8_PARTY_DRIFT');
 requireTrue(Array.isArray(sales.scope.accounts)&&sales.scope.accounts.length===1&&sales.scope.accounts[0].id===snapshot.accountId&&sales.scope.accounts[0].currency==='TRY'&&sales.scope.accounts[0].synthetic===true,'GOAL8_COLLECTION_CASH_SCOPE_DRIFT');
 const paymentSuppliers=payments?.suppliers,paymentAccounts=payments?.accounts;
 requireTrue(Array.isArray(paymentSuppliers)&&Array.isArray(paymentAccounts)&&paymentSuppliers.every(p=>p.synthetic===true&&p.writeEligible===true)&&paymentAccounts.every(p=>p.synthetic===true),'GOAL8_PAYMENT_SYNTHETIC_FLAG_REQUIRED');
 const invoiceSupplier=paymentSuppliers.find(p=>p.currency==='TRY'),cash=paymentAccounts.find(p=>p.currency==='TRY');
 requireTrue(invoiceSupplier&&cash&&invoiceSupplier.debtKind==='invoice'&&Array.isArray(invoiceSupplier.invoices),'GOAL8_PAYMENT_SCOPE_INVALID');
 const breaks=[];
 if(!sell.includes(snapshot.productId))breaks.push({code:'RECEIVE_SALE_PRODUCT_DISCONNECTED',receivingProduct:snapshot.productId,salesProducts:sell});
 if(invoiceSupplier.id!==snapshot.supplierId)breaks.push({code:'PURCHASE_PAYMENT_SUPPLIER_DISCONNECTED',purchaseSupplier:snapshot.supplierId,paymentSupplier:invoiceSupplier.id});
 if(cash.id!==snapshot.accountId)breaks.push({code:'COLLECTION_PAYMENT_CASH_DISCONNECTED',collectionAccount:snapshot.accountId,paymentAccount:cash.id});
 // Current runtime's pinned source cannot select a newly made batch invoice as a return source.
 breaks.push({code:'BATCH_PURCHASE_RETURN_SOURCE_UNSUPPORTED',sourceCommit:GOAL8_DAY_TARGET.sourceCommit});
 return {status:'BLOCKED_PROFILE',connected:false,chainExecuted:false,technicalPass:false,breaks,profileDependencies:[...GOAL8_PROFILE_DEPENDENCIES]};
}

export async function auditGoal8TestDay({httpGet,sqlRead,runSyntheticDay=false}={}){
 requireTrue(typeof httpGet==='function'&&typeof sqlRead==='function','GOAL8_READ_ADAPTERS_REQUIRED');
 // Adapters must perform authenticated GET as actor16 and SELECT as the TEST login.
 // They are injected by private host glue; this public module contains no credentials.
 const health=await httpGet('/test-health');
 const identity=first(await sqlRead(GOAL8_DAY_IDENTITY_SQL));verifyGoal8Identity(identity,health);
 const me=data(await httpGet('/api/auth/me'));
 requireTrue(String(me.id)==='16'&&me.role?.code==='isolated_test_ilker','GOAL8_HTTP_ACTOR_REJECTED');
 const snapshot=verifyGoal8Snapshot(first(await sqlRead(GOAL8_DAY_SNAPSHOT_SQL)));
 const contexts={};
 for(const [key,path] of [['receiving','/api/work-receiving/context'],['purchases','/api/work-purchases/context'],['sales','/api/work-sales/context'],['payments','/api/work-supplier-payments/context'],['count','/api/test-daily/count']])contexts[key]=data(await httpGet(path));
 const assessment=assessGoal8Scopes(contexts,snapshot);
 if(runSyntheticDay)throw Object.assign(new Error('GOAL8_CONNECTED_PROFILE_REQUIRED'),{code:'GOAL8_CONNECTED_PROFILE_REQUIRED',assessment});
 return {schemaVersion:'melisa-goal8-day-readiness.v1',mode:'read-only',runtime:{packageId:health.packageId,sourceCommit:health.sourceCommit},target:{server:identity.serverName,database:identity.databaseName},fixture:{productId:snapshot.productId,supplierId:snapshot.supplierId,customerId:snapshot.customerId,accountId:snapshot.accountId,currency:'TRY'},...assessment};
}

// Independent observed-evidence validator for the intended day. It performs no writes.
// Caller supplies native SQL/API evidence after every committed stage, not predictions.
export function verifyGoal8LinkedDay(stages){
 const names=['baseline','receive','purchase','sale','collect','pay','count','return','daily-report'];
 requireTrue(Array.isArray(stages)&&stages.length===names.length&&same(stages.map(s=>s.stage),names),'GOAL8_STAGE_SEQUENCE');
 const baseline=stages[0],accountId=id(baseline.accountId),references={},requestIds=new Set();
 const deltas=[ [0,0,0,0],[2000,0,0,0],[2000,1600000,0,0],[1000,1600000,1200000,0],[1000,1600000,0,1200000],[1000,800000,0,400000],[1000,800000,0,400000],[0,0,0,400000],[0,0,0,400000] ];
 const keys=['stockExact3','supplierExact4','customerExact4','cashExact4'];
 stages.forEach((s,index)=>{
  requireTrue(s.productId==='325503'&&s.supplierId==='13370'&&s.customerId==='30598'&&s.accountId===accountId&&s.currency==='TRY'&&s.synthetic===true&&s.holdCount===0&&s.independentNativeReadback===true,'GOAL8_STAGE_SCOPE_OR_PROOF');
  keys.forEach((key,k)=>requireTrue(exact(s[key],k===0?3:4)-exact(baseline[key],k===0?3:4)===BigInt(deltas[index][k]),'GOAL8_STAGE_DELTA'));
  if(index>0&&s.stage!=='daily-report'){requireTrue(typeof s.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s.requestId)&&!requestIds.has(s.requestId),'GOAL8_REQUEST_ID_REQUIRED');requestIds.add(s.requestId);requireTrue(s.replayed===true&&s.replayAdditionalEffects===0,'GOAL8_REPLAY_PROOF_REQUIRED');}
  if(s.stage==='receive')references.receiptId=id(s.receiptId);
  if(s.stage==='purchase'){requireTrue(s.receiptId===references.receiptId,'GOAL8_RECEIPT_LINK');references.purchaseInvoiceId=id(s.purchaseInvoiceId);}
  if(s.stage==='sale')references.salesInvoiceId=id(s.salesInvoiceId);
  if(s.stage==='collect')requireTrue(s.salesInvoiceId===references.salesInvoiceId&&s.amountExact4==='120.0000'&&s.direction==='in','GOAL8_COLLECTION_LINK');
  if(s.stage==='pay')requireTrue(s.purchaseInvoiceId===references.purchaseInvoiceId&&s.receiptId===references.receiptId&&s.amountExact4==='80.0000'&&s.direction==='out','GOAL8_PAYMENT_LINK');
  if(s.stage==='return')requireTrue(s.purchaseInvoiceId===references.purchaseInvoiceId&&s.receiptId===references.receiptId&&s.quantityExact3==='1.000'&&s.amountExact4==='80.0000','GOAL8_RETURN_LINK');
 });
 const report=stages.at(-1);
 requireTrue(report.reportVerified===true&&report.reportSalesInvoiceId===references.salesInvoiceId&&report.reportPurchaseInvoiceId===references.purchaseInvoiceId&&report.reportReceiptId===references.receiptId&&report.reportSalesExact4==='120.0000'&&report.reportPurchasesExact4==='160.0000'&&report.reportCollectionsExact4==='120.0000'&&report.reportPaymentsExact4==='80.0000'&&report.reportReturnsExact4==='80.0000','GOAL8_DAILY_REPORT_LINK');
 return {status:'LINKED_EVIDENCE_CONSISTENT',consistencyVerified:true,stockDeltaExact3:'0.000',supplierDeltaExact4:'0.0000',customerDeltaExact4:'0.0000',cashDeltaExact4:'40.0000',references,humanAccepted:false,crmChainIncluded:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 if(args.length===0)console.log(JSON.stringify({mode:'source-plan-only',runtimeVerified:false,chainExecuted:false,technicalPass:false,target:GOAL8_DAY_TARGET,profileDependencies:GOAL8_PROFILE_DEPENDENCIES},null,2));
 else {console.error(JSON.stringify({code:args.includes('--run-synthetic-day')?'GOAL8_CONNECTED_PROFILE_REQUIRED':'GOAL8_IMPORT_PRIVATE_READ_ADAPTERS'}));process.exitCode=2;}
}
