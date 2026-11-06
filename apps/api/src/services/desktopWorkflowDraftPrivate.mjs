// Private lifecycle native capabilities. No general transaction runner is
// exposed. Draft and CHECKED-only dispatch use separate fixed entry points.
// A verified writer/session is required for both.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash,randomUUID} from 'node:crypto';
import sql from 'mssql';
import {getDesktopWritePool} from '../config/desktopWriteTlsConnector.mjs';
import {getDesktopWriteSessionVerifier} from './desktopWriteAuthCore.mjs';
import {createDesktopSaleTransactionScope} from './desktopSaleTransactionScope.mjs';
import {createDesktopTwoItemLockedSelection} from './desktopTwoItemLockedSelection.mjs';
import {prepareDesktopTwoItemSale,desktopTwoItemRevision} from './desktopTwoItemSalePreparation.mjs';
import {prepareDesktopPersistedDispatch} from './desktopPersistedDispatchPreparation.mjs';
import {createDesktopDispatchSnapshotReader} from './desktopDispatchSnapshot.mjs';
import {createDesktopSaleAccountPosting} from './desktopSaleAccountPosting.mjs';
import {createDesktopTwoItemOutcomeReader} from './desktopTwoItemOutcome.mjs';
import {lockDesktopResolution} from './desktopWorkflowRequestResolution.mjs';
import {recordDesktopFailure} from './desktopSafeDiagnostics.mjs';
import {getCanonicalBusinessSaleTransaction} from './canonicalBusinessSessionContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
const storage=new AsyncLocalStorage(),owners=new WeakMap();
const fail=(stage='REJECTED')=>{throw Error('DESKTOP_WORKFLOW_DRAFT_'+stage);};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const exact=(v,scale,want)=>typeof v==='number'&&Number.isFinite(v)&&v.toFixed(scale)===want;
function competing(transaction){if(getCanonicalBusinessSaleTransaction(transaction))return true;try{isolatedCopyTransactionContext(transaction,{writeRequired:false});return true;}catch(error){if(error?.code!=='ISOLATED_COPY_TRANSACTION_REQUIRED')throw error;return false;}}
export function tryAssertDesktopWorkflowDraft({transaction,actor,operation,invoiceId,invoice,checkOnly=false}={}){
 const s=storage.getStore();if(!s)return null;
 const required=s.operation??'sale_draft';
 if(!s.open||owners.get(transaction)!==s||s.transaction!==transaction||competing(transaction)||String(actor?.id)!==s.actorId||operation!==required||s.phase!==required)fail();
 if(checkOnly)return true;
 const e=s.prepared.expected,p=s.prepared.invoice,date=invoice?.documentDate instanceof Date?invoice.documentDate.toISOString().slice(0,10):invoice?.documentDate;
 if((required==='sale_draft'?invoiceId!==null:invoiceId!==s.invoiceId)||!invoice||date!==p.documentDate||invoice.documentNo!==p.documentNo||String(invoice.customerId)!==e.customerId||invoice.documentCurrency!=='TRY'||(invoice.accountCurrency??invoice.customerCurrency)!=='TRY'||!exact(invoice.grandTotal,4,e.totalExact4)||!exact(invoice.amountTry,4,e.totalExact4)||(invoice.exchangeRate??invoice.documentRateToTry)!==1||Number(invoice.discountRate)!==0||Number(invoice.discountTotal)!==0||!Array.isArray(invoice.items)||invoice.items.length!==2)fail();
 for(let i=0;i<2;i++){const item=invoice.items[i],wanted=p.items[i],line=e.lines[i];if(String(item.productId)!==line.productId||item.stockCode!==wanted.stockCode||item.productName!==wanted.productName||item.barcode!==wanted.barcode||item.currency!=='TRY'||!exact(item.quantity,3,line.quantityExact3)||!exact(item.unitPrice,4,line.unitPriceExact4)||!exact(item.lineTotal,4,line.lineTotalExact4)||!exact(item.averageCostTry,4,wanted.averageCostTry.toFixed(4)))fail();}
 s.phase=required==='sale_draft'?'draft_verified':'finalize_verified';return true;
}
export function createDesktopWorkflowDraftService({connector,auth}={}){
 const pool=getDesktopWritePool(connector),verifySession=getDesktopWriteSessionVerifier(auth,pool),scope=createDesktopSaleTransactionScope({sql,verifySession}),select=createDesktopTwoItemLockedSelection({sql,verifyScope:scope.verifyScope});
 const service={async createDraft(actorId,raw){let requestId=typeof raw?.requestId==='string'?raw.requestId:null;
  try{
   if(!id(actorId)||!raw||Object.keys(raw).sort().join(',')!=='customerId,documentDate,expectedRevision,items,requestId')fail();
   const request=JSON.parse(JSON.stringify(raw));requestId=request.requestId;if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)||!Array.isArray(request.items)||request.items.length!==2)fail();
   const hash=createHash('sha256').update(JSON.stringify({actorId,request})).digest('hex'),tx=new sql.Transaction(pool);let begun=false;
   try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
    const result=await scope.withScope({transaction:tx,actorId,requestId,customerId:request.customerId,productIds:request.items.map(v=>v.productId)},async context=>{
     if(await lockDesktopResolution({sql,transaction:tx,requestId}))fail();
     const query=(text,values={})=>{const r=new sql.Request(tx);for(const [k,v] of Object.entries(values))r.input(k,sql.NVarChar(k==='json'?sql.MAX:4000),v);return r.query(text);};
     const journalSql=`SELECT CONVERT(varchar(20),actor_id) actorId,CONVERT(varchar(20),invoice_id) invoiceId,operation,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`;
     const old=await query(journalSql,{request:requestId});if(!Array.isArray(old?.recordset)||old.recordset.length>1)fail();
     if(old.recordset.length){const row=old.recordset[0];if(row.actorId!==actorId||row.operation!=='CREATE_DRAFT'||row.hash!==hash||!id(row.invoiceId))fail();const prior=JSON.parse(row.resultJson);if(prior?.state!=='COMMITTED'||prior.requestId!==requestId||prior.invoiceId!==row.invoiceId||prior.workflowState!=='DRAFT'||prior.replayed!==false||!/^0x[0-9A-F]{16}$/.test(prior.version))fail();return {...prior,replayed:true};}
     const locked=await select({transaction:tx,scope:context.scope,customerId:request.customerId,productIds:request.items.map(v=>v.productId)}),prepared=prepareDesktopTwoItemSale(request,locked),state={transaction:tx,actorId,prepared,phase:'sale_draft',open:true};
     if(owners.has(tx)||storage.getStore()||competing(tx))fail();owners.set(tx,state);
     try{return await storage.run(state,async()=>{
      const native=await import('./invoiceDraftService.js');const created=await native.createSalesDraft(prepared.invoice,{id:actorId},{transaction:tx,pool,sqlDriver:sql,desktopPrivateSale:true});
      const invoiceId=String(created?.id??'');if(!id(invoiceId))fail('NATIVE_ID');if(state.phase!=='draft_verified'||competing(tx))fail('NATIVE_PHASE');
      const persisted=await query(`SELECT CONVERT(varchar(20),customer_id) customerId,document_currency currency,CONVERT(varchar(40),grand_total) totalExact4,status FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) WHERE id=TRY_CONVERT(bigint,@invoice); SELECT CONVERT(varchar(20),product_id) productId,CONVERT(varchar(40),quantity) quantityExact3,CONVERT(varchar(40),unit_price) unitPriceExact4,CONVERT(varchar(40),line_total) lineTotalExact4 FROM dbo.sales_invoice_items WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=TRY_CONVERT(bigint,@invoice) ORDER BY id; SELECT (SELECT COUNT_BIG(*) FROM dbo.stock_movements WHERE source_type=N'sales_invoice' AND source_id=TRY_CONVERT(bigint,@invoice)) stockRows,(SELECT COUNT_BIG(*) FROM dbo.customer_movements WHERE sales_invoice_id=TRY_CONVERT(bigint,@invoice)) customerRows;`,{invoice:invoiceId});
      const rs=persisted?.recordsets;if(!Array.isArray(rs)||rs.length!==3||rs[0]?.length!==1||rs[1]?.length!==2||rs[2]?.length!==1)fail('PERSISTED_SHAPE');const h=rs[0][0];if(h.customerId!==request.customerId||h.currency!=='TRY'||h.status!=='draft'||h.totalExact4!==prepared.expected.totalExact4||String(rs[2][0].stockRows)!=='0'||String(rs[2][0].customerRows)!=='0')fail('PERSISTED_HEADER');
      for(let i=0;i<2;i++){const line=rs[1][i],expected=prepared.expected.lines[i];if(['productId','quantityExact3','unitPriceExact4','lineTotalExact4'].some(k=>line[k]!==expected[k]))fail('PERSISTED_ITEMS');}
      const inserted=await query(`INSERT dbo.desktop_sale_workflows(invoice_id,state) OUTPUT CONVERT(varchar(18),CONVERT(binary(8),inserted.version),1) version VALUES(TRY_CONVERT(bigint,@invoice),'DRAFT');`,{invoice:invoiceId});if(inserted?.recordset?.length!==1||!/^0x[0-9A-F]{16}$/.test(inserted.recordset[0].version))fail('WORKFLOW_VERSION');
      const outcome={state:'COMMITTED',requestId,invoiceId,workflowState:'DRAFT',version:inserted.recordset[0].version,replayed:false};
      await query(`INSERT dbo.desktop_sale_workflow_requests(request_id,invoice_id,actor_id,operation,payload_hash,result_json) VALUES(TRY_CONVERT(uniqueidentifier,@request),TRY_CONVERT(bigint,@invoice),TRY_CONVERT(bigint,@actor),'CREATE_DRAFT',CONVERT(binary(32),@hash,2),@json);`,{request:requestId,invoice:invoiceId,actor:actorId,hash,json:JSON.stringify(outcome)});
      const verify=await query(journalSql,{request:requestId});if(verify?.recordset?.length!==1||verify.recordset[0].actorId!==actorId||verify.recordset[0].invoiceId!==invoiceId||verify.recordset[0].operation!=='CREATE_DRAFT'||verify.recordset[0].hash!==hash||verify.recordset[0].resultJson!==JSON.stringify(outcome))fail('JOURNAL_READBACK');return outcome;
     });}finally{state.open=false;owners.delete(tx);}
    });await tx.commit();begun=false;return result;
   }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
  }catch(error){recordDesktopFailure({requestId,error});return {state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY'};}
 }};
 service.preview=async(actorId,input)=>{
  if(!id(actorId)||!input||Object.keys(input).sort().join(',')!=='customerId,documentDate,productIds')fail();
  const c=JSON.parse(JSON.stringify(input)),tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;const requestId=randomUUID();
   const result=await scope.withScope({transaction:tx,actorId,requestId,customerId:c.customerId,productIds:c.productIds},async context=>{
    const locked=await select({transaction:tx,scope:context.scope,customerId:c.customerId,productIds:c.productIds}),revision=desktopTwoItemRevision(locked);
    prepareDesktopTwoItemSale({requestId,customerId:c.customerId,documentDate:c.documentDate,expectedRevision:revision,items:c.productIds.map(productId=>({productId,quantityExact3:'1.000'}))},locked);
    return {customerId:c.customerId,customerCode:locked.customer.customerCode,documentDate:c.documentDate,currency:'TRY',revision,products:locked.products.map((p,i)=>({productId:p.id,stockCode:p.stockCode,name:p.name,barcode:p.barcode,unit:p.unit,priceExact4:p.priceExact4,stockExact3:p.stockExact3,reservedExact3:locked.reservedExact3[i]}))};
   });await tx.commit();begun=false;return result;
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 };
 return auth.bindDraftService(service);
}
export const DESKTOP_WORKFLOW_DRAFT_LIMITS=Object.freeze({sourceOnly:true,requiresCreateAndFinalizePermissions:true,realSqlVerified:false,normalScreenVerified:false,dispatchSourceImplemented:true});

export function createDesktopWorkflowDispatchService({connector,auth}={}){
 const pool=getDesktopWritePool(connector),verifySession=getDesktopWriteSessionVerifier(auth,pool),scope=createDesktopSaleTransactionScope({sql,verifySession});
 const select=createDesktopTwoItemLockedSelection({sql,verifyScope:scope.verifyScope}),readiness=createDesktopDispatchSnapshotReader({sql,verifyScope:scope.verifyScope}),post=createDesktopSaleAccountPosting({sql,verifyScope:scope.verifyScope}),readOutcome=createDesktopTwoItemOutcomeReader({sql,verifyScope:scope.verifyScope});
 const service={async dispatch(actorId,raw){let requestId=typeof raw?.requestId==='string'?raw.requestId:null;
  try{
   if(!id(actorId)||!raw||Object.keys(raw).sort().join(',')!=='customerId,expectedVersion,invoiceId,productIds,requestId')fail();const c=JSON.parse(JSON.stringify(raw));requestId=c.requestId;
   if(!id(c.invoiceId)||!id(c.customerId)||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)||typeof c.expectedVersion!=='string'||!/^0x[0-9A-F]{16}$/.test(c.expectedVersion))fail();
   const hash=createHash('sha256').update(JSON.stringify({actorId,c})).digest('hex'),tx=new sql.Transaction(pool);let begun=false;
   try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
    const result=await scope.withScope({transaction:tx,actorId,requestId,customerId:c.customerId,productIds:c.productIds},async context=>{
     if(await lockDesktopResolution({sql,transaction:tx,requestId}))fail();
     const query=(text,values={})=>{const r=new sql.Request(tx);for(const [k,v] of Object.entries(values))r.input(k,sql.NVarChar(k==='json'?sql.MAX:4000),v);return r.query(text);};
     const journalSql=`SELECT CONVERT(varchar(20),actor_id) actorId,CONVERT(varchar(20),invoice_id) invoiceId,operation,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`;
     const old=await query(journalSql,{request:requestId});if(!Array.isArray(old?.recordset)||old.recordset.length>1)fail();
     if(old.recordset.length){const row=old.recordset[0];if(row.actorId!==actorId||row.invoiceId!==c.invoiceId||row.operation!=='DISPATCH'||row.hash!==hash)fail();const result=JSON.parse(row.resultJson);if(result?.state!=='COMMITTED'||result.requestId!==requestId||result.invoiceId!==c.invoiceId||result.workflowState!=='COMPLETED'||result.replayed!==false||!/^0x[0-9A-F]{16}$/.test(result.version))fail();return {...result,replayed:true};}
     const locked=await select({transaction:tx,scope:context.scope,customerId:c.customerId,productIds:c.productIds});
     const data=await query(`SELECT CONVERT(varchar(20),i.customer_id) customerId,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,i.document_currency currency,i.account_currency accountCurrency,CONVERT(varchar(40),CONVERT(decimal(18,8),i.exchange_rate_snapshot)) documentRate,CONVERT(varchar(40),CONVERT(decimal(18,8),i.account_exchange_rate_snapshot)) accountRate,CONVERT(varchar(40),CONVERT(decimal(18,4),i.discount_rate)) discountRate,CONVERT(varchar(40),i.discount_total) discountTotal,CONVERT(varchar(40),i.grand_total) totalExact4 FROM dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) JOIN dbo.desktop_sale_workflows w WITH(UPDLOCK,HOLDLOCK) ON w.invoice_id=i.id WHERE i.id=TRY_CONVERT(bigint,@invoice) AND i.customer_id=TRY_CONVERT(bigint,@customer) AND i.status=N'draft' AND w.state='CHECKED' AND w.version=CONVERT(binary(8),@version,1);
      SELECT CONVERT(varchar(20),product_id) productId,stock_code_snapshot stockCode,product_name_snapshot name,barcode_snapshot barcode,CONVERT(varchar(40),quantity) quantityExact3,CONVERT(varchar(40),unit_price) unitPriceExact4,CONVERT(varchar(40),line_total) lineTotalExact4,CONVERT(varchar(40),average_cost_try_snapshot) averageCostTryExact4 FROM dbo.sales_invoice_items WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=TRY_CONVERT(bigint,@invoice) ORDER BY id;`,{invoice:c.invoiceId,customer:c.customerId,version:c.expectedVersion});
     const rs=data?.recordsets;if(!Array.isArray(rs)||rs.length!==2||rs[0]?.length!==1||rs[1]?.length!==2)fail();
     const prepared=prepareDesktopPersistedDispatch({requestId,persisted:{header:rs[0][0],items:rs[1]},locked}),bound=context.bindInvoice(prepared.expected,c.invoiceId);
     await readiness({transaction:tx,scope:bound,invoiceId:c.invoiceId,customerId:c.customerId,productIds:c.productIds});
     const state={transaction:tx,actorId,prepared,operation:'sale_finalize',phase:'sale_finalize',invoiceId:c.invoiceId,open:true};if(owners.has(tx)||storage.getStore()||competing(tx))fail();owners.set(tx,state);
     try{return await storage.run(state,async()=>{
      const native=await import('./invoiceDraftService.js');await native.finalizeSalesInvoice(Number(c.invoiceId),{id:actorId},{transaction:tx,pool,sqlDriver:sql,desktopPrivateSale:true});if(state.phase!=='finalize_verified'||competing(tx))fail();
      if(await post({transaction:tx,scope:bound,invoiceId:c.invoiceId})!==true)fail();await readOutcome({transaction:tx,scope:bound,invoiceId:c.invoiceId,documentDate:prepared.invoice.documentDate});
      const closed=await query(`UPDATE dbo.desktop_sale_reservations SET state='DISPATCHED' WHERE invoice_id=TRY_CONVERT(bigint,@invoice) AND state='ACTIVE'; SELECT @@ROWCOUNT changed; UPDATE dbo.desktop_sale_workflows SET state='COMPLETED' OUTPUT CONVERT(varchar(18),CONVERT(binary(8),inserted.version),1) version WHERE invoice_id=TRY_CONVERT(bigint,@invoice) AND state='CHECKED' AND version=CONVERT(binary(8),@version,1);`,{invoice:c.invoiceId,version:c.expectedVersion});
      if(!Array.isArray(closed?.recordsets)||closed.recordsets.length!==2||closed.recordsets[0]?.length!==1||closed.recordsets[0][0].changed!==2||closed.recordsets[1]?.length!==1||!/^0x[0-9A-F]{16}$/.test(closed.recordsets[1][0].version))fail();
      const outcome={state:'COMMITTED',requestId,invoiceId:c.invoiceId,workflowState:'COMPLETED',version:closed.recordsets[1][0].version,replayed:false};
      await query(`INSERT dbo.desktop_sale_workflow_requests(request_id,invoice_id,actor_id,operation,payload_hash,result_json) VALUES(TRY_CONVERT(uniqueidentifier,@request),TRY_CONVERT(bigint,@invoice),TRY_CONVERT(bigint,@actor),'DISPATCH',CONVERT(binary(32),@hash,2),@json);`,{request:requestId,invoice:c.invoiceId,actor:actorId,hash,json:JSON.stringify(outcome)});
      const verify=await query(journalSql,{request:requestId});if(verify?.recordset?.length!==1||verify.recordset[0].actorId!==actorId||verify.recordset[0].invoiceId!==c.invoiceId||verify.recordset[0].operation!=='DISPATCH'||verify.recordset[0].hash!==hash||verify.recordset[0].resultJson!==JSON.stringify(outcome))fail('JOURNAL_READBACK');return outcome;
     });}finally{state.open=false;owners.delete(tx);}
    });await tx.commit();begun=false;return result;
   }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
  }catch(error){recordDesktopFailure({requestId,error});return {state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY'};}
 }};return auth.bindDispatchService(service);
}
