// Source-only candidate. Only sell() is exposed. The transaction, journal,
// proof issuer, native invocation, posting and readback remain in this module.
// Native invoice service is deliberately NOT wired to this capability yet.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import sql from 'mssql';
import {getDesktopWritePool} from '../config/desktopWriteTlsConnector.mjs';
import {getDesktopWriteSessionVerifier} from './desktopWriteAuthCore.mjs';
import {createDesktopSaleTransactionScope} from './desktopSaleTransactionScope.mjs';
import {createDesktopSaleSelectionStore} from './desktopSaleSelectionStore.mjs';
import {createDesktopSaleOutcomeRead} from './desktopSaleOutcomeRead.mjs';
import {createDesktopSaleAccountPosting} from './desktopSaleAccountPosting.mjs';
import {prepareDesktopSale} from './desktopSalePreparation.mjs';
import {getCanonicalBusinessSaleTransaction} from './canonicalBusinessSessionContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {tryAssertDesktopWorkflowDraft} from './desktopWorkflowDraftPrivate.mjs';
export {getDesktopWorkflowCurrencyAccount} from './desktopWorkflowDraftPrivate.mjs';
const storage=new AsyncLocalStorage(),nativeOwners=new WeakMap();
const fail=()=>{throw Error('DESKTOP_PRIVATE_SALE_REJECTED');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const exact=(v,n,s)=>typeof v==='number'&&Number.isFinite(v)&&v.toFixed(n)===s;
function competing(tx){if(getCanonicalBusinessSaleTransaction(tx))return true;try{isolatedCopyTransactionContext(tx,{writeRequired:false});return true;}catch(e){if(e?.code!=='ISOLATED_COPY_TRANSACTION_REQUIRED')throw e;return false;}}
export function assertDesktopPrivateSale({transaction,actor,operation,invoiceId,invoice,checkOnly=false}={}){
 if(tryAssertDesktopWorkflowDraft({transaction,actor,operation,invoiceId,invoice,checkOnly})===true)return true;
 const s=storage.getStore();if(!s?.open||nativeOwners.get(transaction)!==s||s.transaction!==transaction||String(actor?.id)!==s.actorId||s.phase!==operation)fail();
 if(checkOnly)return true;const e=s.prepared.expected,p=s.locked.product,item=invoice?.items?.[0],date=invoice?.documentDate instanceof Date&&!Number.isNaN(invoice.documentDate.valueOf())?invoice.documentDate.toISOString().slice(0,10):invoice?.documentDate;
 if(!invoice||!Array.isArray(invoice.items)||invoice.items.length!==1||(operation==='sale_draft'?invoiceId!==null:operation!=='sale_finalize'||invoiceId!==s.invoiceId)||date!==e.documentDate||invoice.documentNo!==s.prepared.invoice.documentNo||String(invoice.customerId)!==e.customerId||invoice.documentCurrency!=='TRY'||(invoice.accountCurrency??invoice.customerCurrency)!=='TRY'||!exact(invoice.grandTotal??invoice.documentAmount,4,e.totalExact4)||!exact(invoice.amountTry,4,e.totalExact4)||!exact(invoice.exchangeRate??invoice.documentRateToTry,8,'1.00000000')||Number(invoice.discountRate??0)!==0||Number(invoice.discountTotal??0)!==0||String(item.productId)!==e.productId||item.currency!=='TRY'||item.stockCode!==p.stockCode||(item.productName??item.name)!==p.name||(item.barcode??null)!==p.barcode||!exact(item.quantity,3,e.quantityExact3)||!exact(item.unitPrice,4,e.unitPriceExact4)||!exact(item.lineTotal,4,e.totalExact4)||!exact(item.averageCostTry,4,p.averageCostTryExact4))fail();
 s.phase=operation==='sale_draft'?'draft_verified':'finalize_verified';return true;
}
function outcome(row,e,invoiceId){return !!row&&row.invoiceId===invoiceId&&row.receiptInvoiceId===invoiceId&&row.stockMovementInvoiceId===invoiceId&&row.customerMovementInvoiceId===invoiceId&&row.status==='FINALIZED'&&row.invoiceCustomerId===e.customerId&&row.movementCustomerId===e.customerId&&row.productId===e.productId&&row.stockMovementProductId===e.productId&&row.stockMovementType==='out'&&row.stockMovementInExact3==='0.000'&&row.stockMovementOutExact3===e.quantityExact3&&row.stockMovementNetExact3==='-'+e.quantityExact3&&row.stockMovementCurrency===e.currency&&row.stockMovementDocumentDate===e.documentDate&&row.entityId===e.entityId&&row.accountId===e.accountId&&row.movementEntityId===e.entityId&&row.movementAccountId===e.accountId&&row.currency===e.currency&&row.accountCurrency===e.currency&&row.movementCurrency===e.currency&&row.quantityExact3===e.quantityExact3&&row.unitPriceExact4===e.unitPriceExact4&&row.totalExact4===e.totalExact4&&row.customerMovementAmountExact4===e.totalExact4&&row.accountPostingAmountExact8===e.totalExact4+'0000'&&row.stockBeforeExact3===e.stockBeforeExact3&&row.stockAfterExact3===e.stockAfterExact3&&row.customerBeforeExact4===e.customerBeforeExact4&&row.customerAfterExact4===e.customerAfterExact4&&row.accountBeforeExact8===e.accountBeforeExact8&&row.accountAfterExact8===e.accountAfterExact8&&row.stockMovementCount===1&&row.customerMovementCount===1&&row.accountPostingCount===1&&row.invoiceItemCount===1;}
export function createDesktopSalePrivateService({connector,auth}={}){
 const pool=getDesktopWritePool(connector),verifySession=getDesktopWriteSessionVerifier(auth,pool),scope=createDesktopSaleTransactionScope({sql,verifySession}),select=createDesktopSaleSelectionStore({sql,verifyScope:scope.verifyScope}),read=createDesktopSaleOutcomeRead({sql,verifyScope:scope.verifyScope}),post=createDesktopSaleAccountPosting({sql,verifyScope:scope.verifyScope});
 const impl={async sell(actorId,raw){let requestId=typeof raw?.requestId==='string'?raw.requestId:null;
  try{const fields=['requestId','customerId','productId','quantityExact3','documentDate','expectedRevision'];if(!id(actorId)||!raw||typeof raw!=='object'||Array.isArray(raw))fail();const d=Object.getOwnPropertyDescriptors(raw);if(Reflect.ownKeys(raw).length!==fields.length||fields.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail();const request=Object.fromEntries(fields.map(k=>[k,d[k].value]));requestId=request.requestId;if(!uuid(requestId))fail();
   const hash=createHash('sha256').update(JSON.stringify({actorId,...request}),'utf8').digest('hex'),transaction=new sql.Transaction(pool);let begun=false;
   try{await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
    const result=await scope.withScope({transaction,actorId,requestId,customerId:request.customerId,productId:request.productId},async ctx=>{
     const query=(statement,params)=>{const r=new sql.Request(transaction);for(const [k,v,n] of params)r.input(k,sql.NVarChar(n),v);return r.query(statement);};
     const existing=await query(`SELECT CONVERT(varchar(20),actor_id) actorId,payload_hash payloadHash,CONVERT(varchar(20),invoice_id) invoiceId,state FROM dbo.desktop_sale_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@requestId);`,[['requestId',requestId,36]]);
     if(!Array.isArray(existing?.recordset)||existing.recordset.length>1)fail();const prior=existing.recordset[0];if(prior){if(prior.actorId!==actorId||prior.payloadHash!==hash||prior.state!=='COMMITTED'||!id(prior.invoiceId))fail();return {state:'COMMITTED',requestId,invoiceId:prior.invoiceId,replayed:true};}
     const locked=await select({transaction,scope:ctx.scope,customerId:request.customerId,productId:request.productId}),prepared=prepareDesktopSale(request,locked),state={transaction,actorId,locked,prepared,phase:'sale_draft',invoiceId:null,open:true};
     if(nativeOwners.has(transaction)||storage.getStore()||competing(transaction))fail();nativeOwners.set(transaction,state);
     try{return await storage.run(state,async()=>{
      const native=await import('./invoiceDraftService.js'),nativeContext={transaction,pool,sqlDriver:sql,desktopPrivateSale:true},actor={id:actorId};
      const created=await native.createSalesDraft(prepared.invoice,actor,nativeContext),invoiceId=String(created?.id??'');if(!id(invoiceId)||state.phase!=='draft_verified')fail();
      const e=prepared.expected,check=await query(`SELECT CASE WHEN (SELECT COUNT_BIG(*) FROM dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) JOIN dbo.sales_invoice_items x WITH(UPDLOCK,HOLDLOCK) ON x.sales_invoice_id=i.id WHERE i.id=TRY_CONVERT(bigint,@invoice) AND i.customer_id=TRY_CONVERT(bigint,@customer) AND i.status=N'draft' AND i.document_currency=N'TRY' AND i.grand_total=TRY_CONVERT(decimal(18,4),@total) AND x.product_id=TRY_CONVERT(bigint,@product))=1 AND (SELECT COUNT_BIG(*) FROM dbo.sales_invoice_items WHERE sales_invoice_id=TRY_CONVERT(bigint,@invoice))=1 THEN 1 ELSE 0 END ok;`,[['invoice',invoiceId,20],['customer',e.customerId,20],['product',e.productId,20],['total',e.totalExact4,40]]);
      if(check?.recordset?.length!==1||check.recordset[0].ok!==1)fail();state.invoiceId=invoiceId;state.phase='sale_finalize';await native.finalizeSalesInvoice(Number(invoiceId),actor,nativeContext);if(state.phase!=='finalize_verified'||competing(transaction))fail();
      const bound=ctx.bindInvoice(e,invoiceId);if(await post({transaction,scope:bound,invoiceId})!==true)fail();const actual=await read({transaction,scope:bound,invoiceId});if(!outcome(actual,e,invoiceId))fail();
      const insert=await query(`INSERT dbo.desktop_sale_requests(request_id,actor_id,payload_hash,invoice_id,state) VALUES(TRY_CONVERT(uniqueidentifier,@requestId),TRY_CONVERT(bigint,@actorId),@payloadHash,TRY_CONVERT(bigint,@invoiceId),N'COMMITTED');SELECT @@ROWCOUNT changed;`,[['requestId',requestId,36],['actorId',actorId,20],['payloadHash',hash,64],['invoiceId',invoiceId,20]]);if(insert?.recordset?.length!==1||insert.recordset[0].changed!==1)fail();
      const verify=await query(`SELECT CONVERT(varchar(20),actor_id) actorId,payload_hash payloadHash,CONVERT(varchar(20),invoice_id) invoiceId,state FROM dbo.desktop_sale_requests WITH(HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@requestId);`,[['requestId',requestId,36]]),j=verify?.recordset?.[0];if(verify?.recordset?.length!==1||j.actorId!==actorId||j.payloadHash!==hash||j.invoiceId!==invoiceId||j.state!=='COMMITTED')fail();return {state:'COMMITTED',requestId,invoiceId,replayed:false};
     });}finally{state.open=false;nativeOwners.delete(transaction);}
    });await transaction.commit();begun=false;return result;
   }catch(error){if(begun)try{await transaction.rollback();}catch{}throw error;}
  }catch{return {state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY'};}
 }};
 return auth.bindSaleService(impl);
}
export const DESKTOP_PRIVATE_SALE_LIMITS=Object.freeze({sourceOnly:true,nativeGuardIntegrated:false,journalInstalled:false,saleGrantsInstalled:false,initialSyntheticAcceptanceCurrency:'TRY',multiCurrencySalesImplemented:false,realSqlVerified:false});
