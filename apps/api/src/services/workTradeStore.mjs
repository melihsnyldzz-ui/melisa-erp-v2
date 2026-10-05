import {createHash} from 'node:crypto';
import {workDate,workError,workFail,workHash,workId,workRevision,workScaled,workExact} from './workSalesModel.mjs';
import {withWorkNightScope} from './workNightScope.mjs';
const DB='MELISA_ERP_SIRKET_TEST_20260929_01',SERVER='Semih\\MELISADEV';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const workPayloadJson=(actor,operation,payload)=>JSON.stringify(stable({...payload,operation,actorId:actor.id}));
const nativeId=value=>{workId(String(value));if(BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER))throw workError();return Number(value);};
const nativeNumber=(value,places)=>{workScaled(value,places);const n=Number(value);if(!Number.isFinite(n)||n.toFixed(places)!==value)throw workError();return n;};
const signedExact=(value,places)=>{if(typeof value!=='string'||!new RegExp(`^-?(?:0|[1-9]\\d{0,13})\\.\\d{${places}}$`).test(value))throw workError();return value;};
async function defaultRuntime(){
 const db=await import('../config/database.js');if(!db.isCanonicalTest())throw workError();
 const [invoice,finance,audit,test,period,proof]=await Promise.all([import('./invoiceDraftService.js'),import('./financeService.js'),import('./auditService.js'),import('./testSalesScope.mjs'),import('./periodLockService.js'),import('./workTradeSqlProof.mjs')]);
 return {pool:await db.getSqlPool(),sql:db.getSqlDriver(),invoice,finance,audit,period,withMutation:test.withTestSalesMutation,proof:proof.WORK_TRADE_SQL_PROOF};
}
function capabilities(actor,raw){
 if(!Array.isArray(raw.permissions))throw workError();const has=key=>actor.permissions.includes(key)&&raw.permissions.includes(key);
 const admin=actor.id==='16'&&actor.testAdminSession===true&&has('sales.view'),seller=actor.id==='15';
 return {canCreate:actor.permissions.includes('sales.create')&&(admin||seller&&has('sales.create')),canFinalize:actor.permissions.includes('sales.finalize')&&(admin||seller&&has('sales.finalize')),canCancel:actor.permissions.includes('sales.cancel')&&(admin||seller&&has('sales.cancel')),canCollect:actor.id==='16'&&has('finance.collection')&&has('customer.view'),canCancelCollection:actor.id==='16'&&has('finance.collection.cancel')&&has('customer.view')};
}
export function workContextDto(raw,actor){
 try{
 if(!raw||raw.currency!=='TRY'||raw.documentDate!=='2026-10-06'||raw.maxQuantity!==5||raw.maxOperations!==30||raw.maxTotalExact4!=='500.0000'||!Array.isArray(raw.products)||raw.products.length!==2)throw workError();
 const customer={id:workId(raw.customer?.id),code:raw.customer.code,name:raw.customer.name,currency:raw.customer.currency,synthetic:true,writeEligible:true,balanceExact4:signedExact(raw.customer.balanceExact4,4),revision:workRevision(raw.revision)};
 if(customer.currency!=='TRY'||typeof customer.code!=='string'||typeof customer.name!=='string')throw workError();
 const products=raw.products.map(row=>{
  const id=workId(row.id),quoteId=workId(row.priceId);workScaled(row.stockQuantityExact3,3);workScaled(row.unitPriceExact8,8);workScaled(row.costExact4,4);
  if(row.unit!=='ADET'||typeof row.stockCode!=='string'||typeof row.name!=='string'||(row.barcode!==null&&typeof row.barcode!=='string')||nativeId(id)===301986)throw workError();
  return {id,stockCode:row.stockCode,name:row.name,barcode:row.barcode,synthetic:true,writeEligible:true,stockQuantityExact3:row.stockQuantityExact3,unit:{label:'ADET',factorExact8:'1.00000000'},revision:workRevision(raw.revision),prices:[{quoteId,currency:'TRY',unitPriceExact8:row.unitPriceExact8,source:{kind:'synthetic-test'},revision:workRevision(raw.revision)}]};
 });
 if(new Set(products.map(row=>row.id)).size!==2)throw workError();
 const cap=capabilities(actor,raw),finance=actor.id==='16'&&actor.permissions.includes('finance.view')&&raw.permissions.includes('finance.view'),a=raw.account;
 if(!a||a.currency!=='TRY'||!['cash','bank','pos'].includes(a.type))throw workError();
 const account={id:workId(a.id),code:a.code,name:a.name,type:a.type,currency:'TRY',balanceExact4:signedExact(a.balanceExact4,4),synthetic:true};
 return {meta:{schemaVersion:'melisa-work-trade.v1',date:raw.documentDate,timeZone:'Europe/Istanbul',source:'native-test'},revision:workRevision(raw.revision),capabilities:cap,scope:{synthetic:true,customer,products,accounts:finance?[account]:[]},supportedCurrencies:['TRY'],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000',maxOpenInvoices:30,maxOperations:30}};
 }catch{throw workError();}
}
export function createWorkTradeStore({getRuntime=defaultRuntime}={}){
 async function transaction(actor,write,operation,payload,fn,readPermission='sales.view'){
  const r=await getRuntime(),run=async()=>{
   const tx=new r.sql.Transaction(r.pool);await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new r.sql.Request(tx),q=r.sql;
   try{
    if(write)await req().query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51100,'WORK_LOCK_TIMEOUT',1;");
    const identity=(await req().query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live")).recordset?.[0];
    if(identity?.db!==DB||identity.server!==SERVER||identity.login!=='melisa_sirket_sales_test_20260929_01'||identity.databaseUser!==identity.login||identity.sysadmin!==0||identity.control!==0||identity.live!==0)throw workError();
    await req().execute('dbo.work_trade_assert_ready');
    const row=(await req().input('actor_id',q.Int,nativeId(actor.id)).execute('dbo.work_trade_get_context')).recordset?.[0];
    if(!r.proof||Object.keys(r.proof).length!==3||Object.entries(r.proof).some(([key,value])=>typeof value!=='string'||row?.[key]!==value)||typeof row?.context_json!=='string')throw workError();
    const raw=JSON.parse(row.context_json),context=workContextDto(raw,actor),ctx={pool:r.pool,sqlDriver:q,transaction:tx};
    if(!write&&(!actor.permissions.includes(readPermission)||!raw.permissions.includes(readPermission)))workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);
    const c={context};
    async function collection(id){
     const found=(await req().input('id',q.BigInt,id).query(`SELECT CONVERT(varchar(20),m.id) id,CONVERT(varchar(20),l.invoice_id) invoiceId,CONVERT(varchar(20),f.account_id) accountId,CONVERT(varchar(64),CONVERT(decimal(18,4),m.amount)) amountExact4,m.currency_code currency,CONVERT(char(10),m.document_date,23) documentDate,CASE WHEN EXISTS(SELECT 1 FROM dbo.work_collection_links r WHERE r.original_id=m.id) THEN N'cancelled' ELSE N'active' END status FROM dbo.work_collection_links l JOIN dbo.customer_movements m ON m.id=l.movement_id JOIN dbo.finance_account_movements f ON f.party_movement_id=m.id AND f.source_type=N'collection' WHERE l.movement_id=@id AND l.original_id IS NULL;`)).recordset;
     if(found?.length!==1)workFail('WORK_COLLECTION_NOT_FOUND','Tahsilat bulunamadı.',404);const value=found[0];workId(value.id);workId(value.invoiceId);workId(value.accountId);workScaled(value.amountExact4,4);if(value.currency!=='TRY'||!['active','cancelled'].includes(value.status))throw workError();workDate(value.documentDate);return {...value,revision:workHash(value)};
    }
    async function invoice(id){
     const data=(await req().input('id',q.BigInt,id).query(`SELECT CONVERT(varchar(20),i.id) id,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,i.status,CONVERT(varchar(20),i.customer_id) customerId,i.document_currency currency,CONVERT(varchar(64),CONVERT(decimal(18,4),i.subtotal)) subtotalExact4,CONVERT(varchar(64),CONVERT(decimal(18,4),i.grand_total)) grandTotalExact4,CONVERT(varchar(64),CONVERT(decimal(18,4),i.amount_try)) amountTryExact4,l.preview_json FROM dbo.work_sales_links l JOIN dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) ON i.id=l.invoice_id WHERE i.id=@id; SELECT CONVERT(varchar(20),s.product_id) productId,s.stock_code_snapshot stockCode,s.product_name_snapshot name,CONVERT(varchar(64),CONVERT(decimal(18,3),s.quantity)) quantityExact3,CONVERT(varchar(64),CONVERT(decimal(18,4),s.unit_price)) unitPriceExact4,CONVERT(varchar(64),CONVERT(decimal(18,4),s.line_total)) lineTotalExact4,s.currency_code currency FROM dbo.sales_invoice_items s WHERE s.sales_invoice_id=@id ORDER BY s.id; SELECT CONVERT(varchar(20),movement_id) id FROM dbo.work_collection_links WHERE invoice_id=@id AND original_id IS NULL ORDER BY movement_id;`)).recordsets;
     if(data?.length!==3||data[0]?.length!==1)workFail('WORK_INVOICE_NOT_FOUND','Satış kaydı bulunamadı.',404);
     const h=data[0][0],p=JSON.parse(h.preview_json);delete h.preview_json;
     if(h.customerId!==context.scope.customer.id||h.currency!=='TRY'||!['draft','finalized','cancelled'].includes(h.status)||h.documentDate!==raw.documentDate||!Array.isArray(p.items)||p.items.length!==data[1].length)throw workError();
     for(const key of ['subtotalExact4','grandTotalExact4','amountTryExact4'])workScaled(h[key],4);
     const items=data[1].map((item,index)=>{const original=p.items[index];if(item.productId!==original.productId||item.quantityExact3!==original.quantityExact3||item.unitPriceExact4!==original.unitPriceExact4||item.lineTotalExact4!==original.lineTotalExact4||item.currency!=='TRY'||item.stockCode!==original.stockCode||item.name!==original.name||original.unit?.label!=='ADET'||original.unit.factorExact8!=='1.00000000')throw workError();return {...item,quoteId:original.quoteId,unit:original.unit,unitPriceExact8:original.unitPriceExact8};});
     const collections=[];for(const row of data[2])collections.push(await collection(row.id));const received=collections.filter(row=>row.status==='active').reduce((sum,row)=>sum+workScaled(row.amountExact4,4),0n),total=workScaled(h.grandTotalExact4,4);
     if(received>total)throw workError();
     const value={...h,items,collections:{receivedExact4:workExact(received,4),outstandingExact4:h.status==='finalized'?workExact(total-received,4):'0.0000',items:collections},customerBalanceExact4:context.scope.customer.balanceExact4};
     value.collections.revision=workHash({invoiceId:h.id,status:h.status,total:h.grandTotalExact4,collections});value.revision=workHash(value);return value;
    }
    c.invoice=invoice;c.collection=collection;
    c.list=async({page,limit})=>{const sets=(await req().input('offset',q.Int,(page-1)*limit).input('limit',q.Int,limit).query('SELECT COUNT_BIG(*) total FROM dbo.work_sales_links;SELECT CONVERT(varchar(20),invoice_id) id FROM dbo.work_sales_links ORDER BY invoice_id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;')).recordsets;const data=[];for(const row of sets[1])data.push(await invoice(row.id));return {data,meta:{total:Number(sets[0][0].total),page,limit}};};
    c.request=async id=>{const old=(await req().input('id',q.UniqueIdentifier,id).input('actor',q.BigInt,actor.id).query('SELECT operation,response_json FROM dbo.work_trade_requests WHERE request_id=@id AND actor_id=@actor;')).recordset?.[0];if(!old)workFail('WORK_REQUEST_NOT_FOUND','İşlem kaydı bulunamadı.',404);return {requestId:id,operation:old.operation,response:JSON.parse(old.response_json)};};
    const refresh=async()=>{const current=(await req().input('actor_id',q.Int,nativeId(actor.id)).execute('dbo.work_trade_get_context')).recordset?.[0];if(Object.entries(r.proof).some(([key,value])=>current?.[key]!==value))throw workError();const next=workContextDto(JSON.parse(current.context_json),actor);Object.assign(context,next);};
    c.createDraft=async(preview,requestId)=>{
     const created=await r.invoice.createSalesDraft({documentNo:'NIGHT-'+requestId.replaceAll('-','').slice(0,24),documentDate:preview.selection.documentDate,customerId:nativeId(preview.selection.customerId),customerCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,description:'Sentetik günlük satış',items:preview.items.map(item=>{const privateProduct=raw.products.find(p=>p.id===item.productId);return {productId:nativeId(item.productId),stockCode:item.stockCode,productName:item.name,barcode:privateProduct.barcode,quantity:nativeNumber(item.quantityExact3,3),unitPrice:nativeNumber(item.unitPriceExact4,4),currency:'TRY',averageCostTry:nativeNumber(privateProduct.costExact4,4)};})},actor,ctx);
     const id=String(created.id);nativeId(id);await req().input('id',q.BigInt,id).query('UPDATE dbo.work_trade_intents SET invoice_id=@id WHERE session_id=@@SPID;');
     await req().input('id',q.BigInt,id).input('actor',q.BigInt,actor.id).query('UPDATE dbo.sales_invoices SET created_by=@actor,updated_by=@actor WHERE id=@id;');
     await req().input('id',q.BigInt,id).input('request',q.UniqueIdentifier,requestId).input('actor',q.BigInt,actor.id).input('preview',q.NVarChar(q.MAX),JSON.stringify(preview)).query('INSERT dbo.work_sales_links(invoice_id,request_id,actor_id,preview_json)VALUES(@id,@request,@actor,@preview);');return invoice(id);
    };
    c.finalize=async id=>{await r.invoice.finalizeSalesInvoice(nativeId(id),actor,ctx);await refresh();return invoice(id);};
    c.cancel=async(id,reason)=>{const before=await invoice(id);if(before.status==='draft'){
      await r.period.assertAccountingPeriodOpen(req(),before.documentDate,'Satış taslağı iptal');
      await req().input('id',q.BigInt,id).input('actor',q.BigInt,actor.id).input('reason',q.NVarChar(500),reason).query("UPDATE dbo.sales_invoices SET status=N'cancelled',cancelled_at=SYSUTCDATETIME(),cancel_reason=@reason,updated_by=@actor,updated_at=SYSUTCDATETIME() WHERE id=@id AND status=N'draft';IF @@ROWCOUNT<>1 THROW 51100,'WORK_STALE',1;");
      await r.audit.writeAuditLog(req(),{actor,action:'work_sales_draft_cancelled',entityType:'sales_invoice',entityId:nativeId(id),afterSnapshot:{reason}});
     }else await r.invoice.cancelSalesInvoice(nativeId(id),{reason},actor,ctx);await refresh();return invoice(id);};
    c.collect=async(preview,requestId)=>{const s=preview.selection,result=await r.finance.createCustomerCollection({customerId:nativeId(raw.customer.id),accountId:nativeId(s.accountId),amount:nativeNumber(s.amountExact4,4),currency:'TRY',paymentMethod:raw.account.type,documentDate:s.documentDate,exchangeRate:1,accountExchangeRate:1,description:'Satışa bağlı tahsilat'},actor,{...ctx,linkedInvoiceId:nativeId(s.invoiceId)});
     const id=String(result.id);nativeId(id);await req().input('id',q.BigInt,id).input('invoice',q.BigInt,s.invoiceId).input('request',q.UniqueIdentifier,requestId).query('INSERT dbo.work_collection_links(movement_id,invoice_id,request_id,original_id)VALUES(@id,@invoice,@request,NULL);');await refresh();return collection(id);};
    c.cancelCollection=async(id,input)=>{
     const original=await collection(id);if(original.status!=='active')workFail('WORK_COLLECTION_STATE','Tahsilat daha önce iptal edilmiş.',409);
     await req().input('id',q.BigInt,original.invoiceId).query('UPDATE dbo.work_trade_intents SET invoice_id=@id WHERE session_id=@@SPID;');
     await r.period.assertAccountingPeriodOpen(req(),input.documentDate,'Tahsilat iptal');
     const account=await r.finance.resolveFinanceAccount(tx,q,{accountId:nativeId(original.accountId),currency:'TRY',paymentMethod:raw.account.type});
     if(account.currentBalance==null||Number(account.currentBalance)<nativeNumber(original.amountExact4,4))workFail('WORK_FUNDS_REQUIRED','Hesap bakiyesi iptal için yeterli değil.',409);
     const found=(await req().input('id',q.BigInt,id).input('date',q.Date,input.documentDate).input('actor',q.BigInt,actor.id).query(`DECLARE @ids TABLE(id bigint);INSERT dbo.customer_movements(customer_id,sales_invoice_id,movement_type,amount,currency_code,balance_effect,document_date,created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try) OUTPUT inserted.id INTO @ids SELECT customer_id,sales_invoice_id,N'collection_cancel',amount,currency_code,account_amount,@date,@actor,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try FROM dbo.customer_movements WHERE id=@id AND movement_type=N'collection';UPDATE c SET balance=c.balance+m.account_amount,updated_at=SYSUTCDATETIME() FROM dbo.customers c JOIN dbo.customer_movements m ON m.customer_id=c.id WHERE m.id=@id;SELECT CONVERT(varchar(20),id) id FROM @ids;`)).recordset;
     if(found?.length!==1)throw workError();const reversed=found[0].id;nativeId(reversed);
     await r.finance.writeFinanceAccountMovement(tx,q,{account,sourceType:'collection_cancel',partyType:'customer',partyMovementId:nativeId(reversed),amount:nativeNumber(original.amountExact4,4),currency:'TRY',paymentMethod:raw.account.type,documentNo:`NIGHT-C-${reversed}`,documentDate:input.documentDate,description:input.reason,actor});
     await req().input('id',q.BigInt,reversed).input('invoice',q.BigInt,original.invoiceId).input('request',q.UniqueIdentifier,input.requestId).input('original',q.BigInt,id).query('INSERT dbo.work_collection_links(movement_id,invoice_id,request_id,original_id)VALUES(@id,@invoice,@request,@original);');
     await r.audit.writeAuditLog(req(),{actor,action:'collection_cancel',entityType:'customer_movement',entityId:nativeId(reversed),afterSnapshot:{originalMovementId:id,invoiceId:original.invoiceId,reason:input.reason}});await refresh();return collection(id);
    };
    let value;
    if(write){
     const right={sale_draft:'canCreate',sale_finalize:'canFinalize',sale_cancel:'canCancel',collection_create:'canCollect',collection_cancel:'canCancelCollection'}[operation];
     if(!right||context.capabilities[right]!==true)workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);
     const json=workPayloadJson(actor,operation,payload),hash=createHash('sha256').update(json,'utf16le').digest('hex').toUpperCase();
     const old=(await req().input('id',q.UniqueIdentifier,payload.requestId).query('SELECT actor_id,operation,payload_hash,payload_json,response_json FROM dbo.work_trade_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@id;')).recordset?.[0];
     if(old){if(String(old.actor_id)!==actor.id||old.operation!==operation||old.payload_hash!==hash||old.payload_json!==json)workFail('WORK_REQUEST_CONFLICT','Bu işlem kimliği başka bir istekte kullanılmış.',409);value={...JSON.parse(old.response_json),replayed:true};}
     else{
      const used=(await req().query('SELECT COUNT_BIG(*) n FROM dbo.work_trade_requests;')).recordset?.[0]?.n;
      if(used==null||!Number.isSafeInteger(Number(used))||Number(used)<0)throw workError();
      if(Number(used)>=raw.maxOperations)workFail('WORK_OPERATION_LIMIT','Deneme işlem sınırına ulaşıldı.',409);
      await req().input('id',q.UniqueIdentifier,payload.requestId).input('actor',q.BigInt,actor.id).input('operation',q.NVarChar(30),operation).input('payload',q.NVarChar(q.MAX),json).input('invoice',q.BigInt,['sale_finalize','sale_cancel'].includes(operation)?payload.id:operation==='collection_create'?payload.invoiceId:null).query('INSERT dbo.work_trade_intents(session_id,request_id,actor_id,operation,payload_json,invoice_id)VALUES(@@SPID,@id,@actor,@operation,@payload,@invoice);');
      value=await withWorkNightScope({database:DB,server:SERVER,transaction:tx,validated:true,products:context.scope.products},()=>fn(c));
      await req().input('request_id',q.UniqueIdentifier,payload.requestId).execute('dbo.work_trade_assert_effects');
      await req().input('id',q.UniqueIdentifier,payload.requestId).input('actor',q.BigInt,actor.id).input('operation',q.NVarChar(30),operation).input('hash',q.Char(64),hash).input('payload',q.NVarChar(q.MAX),json).input('response',q.NVarChar(q.MAX),JSON.stringify(value)).query('INSERT dbo.work_trade_requests(request_id,actor_id,operation,payload_hash,payload_json,response_json)VALUES(@id,@actor,@operation,@hash,@payload,@response);DELETE dbo.work_trade_intents WHERE session_id=@@SPID AND request_id=@id;');
     }
    }else value=await fn(c);
    await tx.commit();return value;
   }catch(error){try{await tx.rollback();}catch{}if(error?.statusCode)throw error;throw workError();}
  };
  return write?r.withMutation(run):run();
 }
 return {context:actor=>transaction(actor,false,null,null,c=>c.context),read:(actor,fn,permission)=>transaction(actor,false,null,null,fn,permission),mutate:(actor,operation,payload,fn)=>transaction(actor,true,operation,payload,fn)};
}
export const workTradeStore=createWorkTradeStore();
