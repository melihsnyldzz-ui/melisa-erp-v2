import {assertOperationQuarantineAllowed,quarantineTransactionContext} from './operationQuarantineService.js';
import {invoiceQuarantineEntities} from './operationQuarantineGate.mjs';
import { assertInvoiceNotExported } from './vegaInvoiceExportJournal.mjs';
import sql from 'mssql';
import { getSqlDriver, getSqlPool, isIsolatedOperationCopyRuntime, getIsolatedOperationCopyConfig } from '../config/database.js';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';
import { parseOptionalQueryId } from './queryIdentityFilters.mjs';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { assertAccountingPeriodOpen } from './periodLockService.js';
import { ensureCashCustomers, getCashCustomerCurrency, isCashCustomerCode } from './customerService.js';
import { ensureFinanceAccountTables, resolveFinanceAccount, writeFinanceAccountMovement } from './financeService.js';
import { assertOpenSaleCashCollection, reverseSaleCashCollection } from './salesCashReversal.mjs';
import { assertPilotCashCustomer, assertPilotSaleProducts } from './pilotCashPolicy.mjs';
import { assertDailyWebCurrency, isDailyWebRequest } from './dailyWebPolicy.mjs';
import { assertWebInvoiceMutationSupported } from './nativeInvoiceWebGuard.mjs';
import { getPurchaseTotals } from '../../../../packages/shared/src/purchaseDiscounts.mjs';
import { settlementFromInvoice, recalculateInvoiceSettlement } from './currencySettlement.mjs';
import { assertCurrencySnapshotSchema, resolveCurrencySettlement, readInvoiceCurrencySnapshot, writeInvoiceCurrencySnapshot, writeMovementCurrencySnapshot } from './currencySettlementStore.mjs';
import { assertInvoiceHasNoReturns } from './invoiceReturnGuard.mjs';
import { createPurchaseCostAccumulator } from './purchaseCostAccumulator.mjs';
import {CURRENT_PRICE_PURCHASE_SQL_PROOF} from './testProductPriceSqlProof.mjs';
import {getBusinessInboundSelection} from '../middleware/businessInboundSelection.mjs';
import {getBusinessDailySelection} from './isolatedOperationCopyContext.mjs';
import {getBusinessSelectedSaleWriteScope} from './businessSelectedSaleWriteScope.mjs';
import {assertSelectedSaleCashlessCancellation} from './selectedSaleCashlessCancellation.mjs';

const VALID_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);
const BUSINESS_COPY_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
function businessInvoiceSelection(transaction,kind,partyId,currency){
 if(!isIsolatedOperationCopyRuntime()||getIsolatedOperationCopyConfig()?.target.database!==BUSINESS_COPY_DATABASE)return null;
 if(kind==='sales'){
  const copy=isolatedCopyTransactionContext(transaction),scope=getBusinessSelectedSaleWriteScope(copy,transaction);
  if(!scope)return null;
  const account=copy.customers.find(a=>a.id===scope.customerId&&a.accountId===scope.customerAccountId&&a.partyId===scope.partyId&&a.currency===scope.currency);
  if(copy!==getIsolatedOperationCopyConfig()||!account||(partyId!==null&&String(partyId)!==scope.customerId)||currency!==scope.currency||!/^\d+\.\d{8}$/.test(scope.rateExact8)||Number(scope.rateExact8)<=0||(currency==='TRY'&&scope.rateExact8!=='1.00000000')||!/^\d+\.\d{4}$/.test(scope.maxInvoiceAmountExact4)||Number(scope.maxInvoiceAmountExact4)<=0)throw makeServiceError('ISOLATED_COPY_INVOICE_ACCOUNT_SCOPE','Doğrulanmış seçili müşteri döviz hesabı gerekli.',409);
  return {copy,account,scope,role:'customer',rate:Number(scope.rateExact8),currency,maxAmount:Number(scope.maxInvoiceAmountExact4)};
 }
 if(kind!=='purchase')return null;
 const copy=isolatedCopyTransactionContext(transaction),selection=getBusinessInboundSelection(copy);
 if(!selection){const daily=getBusinessDailySelection(copy),account=copy.suppliers.find(a=>a.accountId===daily?.supplierAccountId);if(daily?.currency==='TRY'&&currency==='TRY'&&account&&(partyId===null||String(partyId)===account.id))return null;}
 const account=copy.suppliers.find(a=>a.id===String(partyId??selection?.supplierId)&&a.currency===currency&&a.accountId===selection?.accountId);
 const rate=copy.currencyRates?.find(r=>r.currency===currency);
 if(copy!==getIsolatedOperationCopyConfig()||!selection||selection.supplierId!==account?.id||selection.currency!==currency||!account||!rate||!/^\d+\.\d{8}$/.test(rate.rateExact8)||Number(rate.rateExact8)<=0||(currency==='TRY'&&Number(rate.rateExact8)!==1))throw makeServiceError('ISOLATED_COPY_INVOICE_ACCOUNT_SCOPE','Doğrulanmış tedarikçi döviz hesabı ve tarihli TEST kuru gerekli.',409);
 if(copy.businessInvoiceMaxExact4!=='20000.0000')throw makeServiceError('ISOLATED_COPY_INVOICE_AMOUNT_SCOPE','Kayıtlı TEST tutar sınırı gerekli.',409);
 return {copy,account,role:'supplier',rate:Number(rate.rateExact8),currency,maxAmount:20000};
}
async function assertBusinessInvoiceAccount(sqlDriver,transaction,binding){
 const a=binding.account,role=binding.role??'supplier',other=role==='customer'?'supplier':'customer';
 const proof=await new sqlDriver.Request(transaction).input('businessInvoiceParty',sqlDriver.BigInt,a.id).input('businessInvoiceEntity',sqlDriver.BigInt,a.partyId).input('businessInvoiceAccount',sqlDriver.BigInt,a.accountId).input('businessInvoiceCurrency',sqlDriver.NVarChar(3),a.currency).query(`SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.party_currency_accounts a WITH(UPDLOCK,HOLDLOCK) JOIN dbo.${role}s s ON s.id=a.${role}_id AND s.party_entity_id=a.party_entity_id WHERE a.id=@businessInvoiceAccount AND a.${role}_id=@businessInvoiceParty AND a.${other}_id IS NULL AND a.party_entity_id=@businessInvoiceEntity AND a.currency_code=@businessInvoiceCurrency AND a.current_balance IS NOT NULL AND s.is_active=1 AND s.is_deleted=0) AND (SELECT COUNT(*) FROM dbo.party_currency_accounts WHERE ${role}_id=@businessInvoiceParty AND party_entity_id=@businessInvoiceEntity AND currency_code=@businessInvoiceCurrency)=1 THEN 1 ELSE 0 END valid;`);
 if(Number(proof.recordset?.[0]?.valid)!==1)throw makeServiceError('ISOLATED_COPY_INVOICE_ACCOUNT_SCOPE','Tedarikçi döviz hesabı değişti.',409);
}

function assertSelectedSaleInvocation(transaction,operation,actor,invoiceId,invoice){
 if(!isIsolatedOperationCopyRuntime()||getIsolatedOperationCopyConfig()?.target.database!==BUSINESS_COPY_DATABASE)return null;
 const copy=isolatedCopyTransactionContext(transaction),scope=getBusinessSelectedSaleWriteScope(copy,transaction);
 if(!scope)return null;
 const amount=Number(invoice.grandTotal??invoice.documentAmount),account=businessInvoiceSelection(transaction,'sales',invoice.customerId,invoice.accountCurrency??invoice.customerCurrency);
 if(scope.operation!==operation||String(actor?.id)!==scope.actorId||(operation==='sale_draft'?scope.invoiceId!==null:String(invoiceId)!==scope.invoiceId)||!account||invoice.documentCurrency!==scope.currency||!Number.isFinite(amount)||amount<=0||amount>account.maxAmount||!Array.isArray(invoice.items)||invoice.items.length<1||invoice.items.length>200||invoice.items.length!==scope.productIds.length||new Set(invoice.items.map(i=>String(i.productId))).size!==invoice.items.length||invoice.items.some(i=>!scope.productIds.includes(String(i.productId))||!Number.isSafeInteger(Number(i.quantity))||Number(i.quantity)<=0))throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satış işlem kapsamı uyuşmuyor.',409);
 return account;
}

function preserveSelectedSourceSalesNames(payload,draft,selectedSale){
 if(!selectedSale)return;
 const {copy,scope}=selectedSale;
 if(!Array.isArray(payload?.items)||payload.items.length!==draft.items.length)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satış işlem kapsamı uyuşmuyor.',409);
 const names=payload.items.map((item,index)=>{
  const id=String(item?.productId),rows=copy.products.filter(p=>p.id===id),product=rows[0];
  if(rows.length!==1||!scope.productIds.includes(id)||String(draft.items[index].productId)!==id||product.sourceKnown!==true||product.identityVerified!==true||typeof product.name!=='string'||product.name.length>250||!product.name.trim()||item.productName!==product.name)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili ürün adı kaynakla uyuşmuyor.',409);
  return product.name;
 });
 names.forEach((name,index)=>{draft.items[index].productName=name;});
}

function selectedSourceSalesItemsJSON(items,selectedSale){
 const scope=selectedSale?.scope;
 if(!scope||scope.operation!=='sale_draft'||!Array.isArray(items)||items.length<2||items.length>200||items.length!==scope.productIds.length||new Set(items.map(i=>String(i.productId))).size!==items.length)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satış işlem kapsamı uyuşmuyor.',409);
 const decimal=(value,precision)=>{if(!Number.isFinite(value)||value<0)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır miktarı doğrulanamadı.',409);const text=value.toFixed(precision);if(!new RegExp('^\\d{1,'+(18-precision)+'}\\.\\d{'+precision+'}$').test(text))throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır tutarı doğrulanamadı.',409);return text;};
 const text=(value,max,nullable=false)=>{if(nullable&&!value)return null;if(typeof value!=='string'||value.length>max)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır bilgisi doğrulanamadı.',409);return value;};
 return JSON.stringify(items.map(item=>{
  const productId=String(item.productId);if(!Number.isSafeInteger(item.productId)||item.productId<=0||!scope.productIds.includes(productId)||!Number.isSafeInteger(item.quantity)||item.quantity<=0||item.currency!==scope.currency)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır kapsamı uyuşmuyor.',409);
  return {productId,stockCode:text(item.stockCode,50),barcode:text(item.barcode,80,true),productName:text(item.productName,250),quantity:decimal(item.quantity,3),currency:item.currency,unitPrice:decimal(item.unitPrice,4),lineTotal:decimal(item.lineTotal,4),averageCostTry:decimal(item.averageCostTry,4),stockStatus:text(item.stockStatus,50,true),note:text(item.note,250,true)};
 }));
}

async function insertSelectedSourceSalesItems(sqlDriver,transaction,invoiceId,items,selectedSale){
 if(!selectedSale||isolatedCopyTransactionContext(transaction)!==selectedSale.copy||getBusinessSelectedSaleWriteScope(selectedSale.copy,transaction)!==selectedSale.scope)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satış işlem kapsamı uyuşmuyor.',409);
 const itemsJSON=selectedSourceSalesItemsJSON(items,selectedSale);
 await new sqlDriver.Request(transaction).input('invoiceId',sql.BigInt,invoiceId).input('selectedItemsJSON',sql.NVarChar(sql.MAX),itemsJSON).query(`
  INSERT INTO dbo.sales_invoice_items (sales_invoice_id,product_id,stock_code_snapshot,barcode_snapshot,product_name_snapshot,quantity,currency_code,unit_price,line_total,average_cost_try_snapshot,stock_status_snapshot,note)
  SELECT @invoiceId,v.productId,v.stockCode,v.barcode,v.productName,v.quantity,v.currency,v.unitPrice,v.lineTotal,v.averageCostTry,v.stockStatus,v.note
  FROM OPENJSON(@selectedItemsJSON) j
  CROSS APPLY OPENJSON(j.value) WITH(productId bigint '$.productId',stockCode nvarchar(50) '$.stockCode',barcode nvarchar(80) '$.barcode',productName nvarchar(250) '$.productName',quantity decimal(18,3) '$.quantity',currency nvarchar(3) '$.currency',unitPrice decimal(18,4) '$.unitPrice',lineTotal decimal(18,4) '$.lineTotal',averageCostTry decimal(18,4) '$.averageCostTry',stockStatus nvarchar(50) '$.stockStatus',note nvarchar(250) '$.note') v
  ORDER BY CONVERT(int,j.[key]) ASC;
 `);
}

// Native SQL BIGINT snapshots may be canonical strings. Never round or trim IDs.
function canonicalNativeBigIntId(value){
 const text=typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):typeof value==='string'?value:null;
 if(text===null||!/^[1-9][0-9]{0,18}$/.test(text)||BigInt(text)>9223372036854775807n)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır kimliği doğrulanamadı.',409);
 return text;
}

async function finalizeSelectedSourceSalesItems(sqlDriver,transaction,invoiceId,before,rows,selectedSale,actorId){
 const scope=selectedSale?.scope;
 if(!scope||scope.operation!=='sale_finalize'||scope.invoiceId!==String(invoiceId)||scope.actorId!==String(actorId)||isolatedCopyTransactionContext(transaction)!==selectedSale.copy||getBusinessSelectedSaleWriteScope(selectedSale.copy,transaction)!==scope||rows.length<2||rows.length>200||rows.length!==before.items.length||rows.length!==scope.productIds.length||new Set(rows.map(r=>canonicalNativeBigIntId(r.productId))).size!==rows.length||new Set(rows.map(r=>canonicalNativeBigIntId(r.itemId))).size!==rows.length)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satış kesinleştirme kapsamı uyuşmuyor.',409);
 const decimal=(value,precision,nullable=false)=>{if(nullable&&value===null)return null;if(!Number.isFinite(value))throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır görüntüsü doğrulanamadı.',409);const text=value.toFixed(precision);if(!new RegExp('^-?\\d{1,'+(18-precision)+'}\\.\\d{'+precision+'}$').test(text))throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır görüntüsü doğrulanamadı.',409);return text;};
 const payload=rows.map((r,index)=>{const original=before.items[index],itemId=canonicalNativeBigIntId(r.itemId),productId=canonicalNativeBigIntId(r.productId);if(canonicalNativeBigIntId(original.id)!==itemId||canonicalNativeBigIntId(original.productId)!==productId||!scope.productIds.includes(productId)||!Number.isSafeInteger(r.quantity)||r.quantity<=0||r.quantity!==Number(original.quantity)||r.currency!==scope.currency||r.currency!==original.currency)throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır kimliği doğrulanamadı.',409);return {itemId,productId,quantity:decimal(r.quantity,3),unitPrice:decimal(r.unitPrice,4),currency:r.currency,averageCostTry:decimal(r.averageCostTrySnapshot,4,true),grossProfitTry:decimal(r.grossProfitTry,4,true),grossProfitRate:decimal(r.grossProfitRate,6,true),amountTry:decimal(r.salesAmountTry,4)};});
 const json=JSON.stringify(payload),request=()=>new sqlDriver.Request(transaction).input('invoiceId',sql.BigInt,invoiceId).input('selectedFinalizeJSON',sql.NVarChar(sql.MAX),json);
 const assertCount=result=>{const count=result?.recordset?.[0]?.verifiedCount;if(result?.recordset?.length!==1||!(Number.isSafeInteger(count)&&count===rows.length||typeof count==='string'&&count===String(rows.length)))throw makeServiceError('ISOLATED_COPY_SELECTED_SALE_SCOPE','Seçili satır etkisi doğrulanamadı.',409);};
 assertCount(await request().query(`DECLARE @profitIds TABLE(id bigint PRIMARY KEY);
  UPDATE s SET average_cost_try_snapshot=v.averageCostTry,gross_profit_try=v.grossProfitTry,gross_profit_rate=v.grossProfitRate
  OUTPUT inserted.id INTO @profitIds(id)
  FROM dbo.sales_invoice_items s JOIN OPENJSON(@selectedFinalizeJSON) WITH(itemId bigint '$.itemId',productId bigint '$.productId',averageCostTry decimal(18,4) '$.averageCostTry',grossProfitTry decimal(18,4) '$.grossProfitTry',grossProfitRate decimal(18,6) '$.grossProfitRate')v ON s.id=v.itemId AND s.product_id=v.productId AND s.sales_invoice_id=@invoiceId;
  SELECT COUNT_BIG(*) verifiedCount FROM @profitIds;`));
 assertCount(await request().query(`DECLARE @productIds TABLE(id bigint PRIMARY KEY);
  UPDATE p SET current_stock_qty=p.current_stock_qty-v.quantity,updated_at=SYSUTCDATETIME()
  OUTPUT inserted.id INTO @productIds(id)
  FROM dbo.products p JOIN OPENJSON(@selectedFinalizeJSON) WITH(productId bigint '$.productId',quantity decimal(18,3) '$.quantity')v ON p.id=v.productId;
  SELECT COUNT_BIG(*) verifiedCount FROM @productIds;`));
 assertCount(await request().input('documentDate',sql.Date,before.documentDate).input('customerId',sql.BigInt,before.customerId).input('actorId',sql.BigInt,actorId).query(`DECLARE @stockIds TABLE(id bigint PRIMARY KEY);
  INSERT INTO dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,customer_id,created_at,created_by,unit_price,currency_code,amount_try)
  OUTPUT inserted.id INTO @stockIds(id)
  SELECT v.productId,N'out',N'sales_invoice',@invoiceId,0,v.quantity,-v.quantity,v.averageCostTry,v.averageCostTry,@documentDate,@customerId,SYSUTCDATETIME(),@actorId,v.unitPrice,v.currency,v.amountTry
  FROM OPENJSON(@selectedFinalizeJSON)j CROSS APPLY OPENJSON(j.value) WITH(productId bigint '$.productId',quantity decimal(18,3) '$.quantity',averageCostTry decimal(18,4) '$.averageCostTry',unitPrice decimal(18,4) '$.unitPrice',currency nvarchar(3) '$.currency',amountTry decimal(18,4) '$.amountTry')v
  ORDER BY CONVERT(int,j.[key]) ASC;
  SELECT COUNT_BIG(*) verifiedCount FROM @stockIds;`));
}

// Trigger row-count messages are not the guarded header UPDATE's row count.
// The SQL batch returns one named count from OUTPUT ... INTO instead.
export function purchaseStatusMutationSucceeded(result) {
  const rows = result?.recordset;
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const count = rows[0]?.purchaseStatusRows;
  return count === 1 || count === '1';
}

// Internal service context only; HTTP payloads never grant Native behavior.
function isNativeInvoiceTransaction(context) {
  if (context?.nativeTerminalV1 !== true) return false;
  if (!context.transaction || !context.sqlDriver || !context.pool) {
    throw makeServiceError('NATIVE_TRANSACTION_REQUIRED', 'Native fişi tek dış işlem içinde kaydedilmelidir.', 409);
  }
  return true;
}

async function prepareInvoiceCurrency(sqlDriver, transaction, kind, draft, beforeSnapshot = null) {
  await assertCurrencySnapshotSchema(new sqlDriver.Request(transaction), kind);
  await assertCurrencySnapshotSchema(new sqlDriver.Request(transaction), kind === 'sales' ? 'customer' : 'supplier');
  const partyKey = kind === 'sales' ? 'customer' : 'supplier';
  const partyId = draft[`${partyKey}Id`];
  const business=businessInvoiceSelection(transaction,kind,partyId,draft[`${partyKey}Currency`]);
  if(business){await assertBusinessInvoiceAccount(sqlDriver,transaction,business);if(draft.documentCurrency!==business.currency||Number(draft.exchangeRate)!==business.rate||Number(draft.accountExchangeRate)!==business.rate)throw makeServiceError('ISOLATED_COPY_INVOICE_RATE_SCOPE','Kayıtlı aynı döviz ve TEST kur görüntüsü gerekli.',409);}
  const party = (await new sqlDriver.Request(transaction).input('settlementPartyId', sql.BigInt, partyId).query(`
    SELECT currency_code, is_active, is_deleted FROM dbo.${partyKey === 'customer' ? 'customers' : 'suppliers'} WITH(UPDLOCK,HOLDLOCK) WHERE id=@settlementPartyId;
  `)).recordset?.[0];
  if (!party || !party.is_active || party.is_deleted) throw makeServiceError('INVOICE_PARTY_UNAVAILABLE', 'Aktif ve silinmemiş cari gerekli.', 409);
  if (!business&&draft[`${partyKey}Currency`] !== party.currency_code) throw makeServiceError('INVOICE_PARTY_CURRENCY_CHANGED', 'Cari kartının para birimi değişti. Fişi güncel kartla yeniden kontrol edin.', 409);
  let snapshot;
  if (beforeSnapshot?.status === 'FINALIZED') {
    if (beforeSnapshot[`${partyKey}Id`] !== partyId || beforeSnapshot.documentCurrency !== draft.documentCurrency || beforeSnapshot[`${partyKey}Currency`] !== party.currency_code) {
      throw makeServiceError('INVOICE_FINALIZED_IDENTITY_LOCKED', 'Kesinleşmiş fişin cari veya para birimi değiştirilemez.', 409);
    }
    const original = settlementFromInvoice(beforeSnapshot);
    if (Number(draft.exchangeRate) !== original.documentRateToTry || (draft.accountExchangeRate != null && Number(draft.accountExchangeRate) !== original.accountRateToTry)) {
      throw makeServiceError('INVOICE_CURRENCY_SNAPSHOT_LOCKED', 'Kesinleşmiş fişin iki kur snapshotı korunmalıdır.', 409);
    }
    snapshot = recalculateInvoiceSettlement(beforeSnapshot, draft.grandTotal);
  } else {
    snapshot = await resolveCurrencySettlement(new sqlDriver.Request(transaction), {
      documentAmount: draft.grandTotal, documentCurrency: draft.documentCurrency, accountCurrency: business?.currency??party.currency_code,
      documentRateToTry: draft.exchangeRate, accountRateToTry: draft.accountExchangeRate, documentDate: draft.documentDate,
    });
  }
  Object.assign(draft, { accountCurrency: snapshot.accountCurrency, accountAmount: snapshot.accountAmount, accountExchangeRate: snapshot.accountRateToTry, exchangeRate: snapshot.documentRateToTry, amountTry: snapshot.amountTry });
  return snapshot;
}

function copyInvoiceDocumentDate(value){
 if(value instanceof Date){
  if(!Number.isFinite(value.getTime())||value.getUTCHours()!==0||value.getUTCMinutes()!==0||value.getUTCSeconds()!==0||value.getUTCMilliseconds()!==0)return null;
  return value.toISOString().slice(0,10);
 }
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
}

function copyInvoiceMovementBinding(transaction,kind,invoiceId,movementType,snapshot,direction,actor,partyId=null,documentDate=null){
 const copy=isolatedCopyTransactionContext(transaction),role=kind==='sales'?'customer':kind==='purchase'?'supplier':null;
 const operation={sales_invoice:'sale_finalize',sales_invoice_cancel:'sale_cancel',purchase_invoice:'purchase_finalize',purchase_invoice_cancel:'purchase_cancel'}[movementType];
 const amount=typeof snapshot?.documentAmount==='number'&&Number.isFinite(snapshot.documentAmount)?snapshot.documentAmount.toFixed(4):null;
 const business=businessInvoiceSelection(transaction,kind,partyId,snapshot?.accountCurrency),currency=business?.currency??'TRY',rate=business?.rate??1,amountTry=amount===null?null:(Number(amount)*rate).toFixed(4);
 if(copy!==getIsolatedOperationCopyConfig()||!role||!operation||movementType!==(kind==='sales'?'sales_invoice':'purchase_invoice')+(direction===-1?'_cancel':'')||![1,-1].includes(direction)||!copy.actors.some(a=>a.id===String(actor?.id))||!Number.isSafeInteger(Number(invoiceId))||Number(invoiceId)<1||!snapshot||snapshot.documentCurrency!==currency||snapshot.accountCurrency!==currency||snapshot.documentRateToTry!==rate||snapshot.accountRateToTry!==rate||amount===null||Number(amount)!==snapshot.documentAmount||snapshot.documentAmount<=0||snapshot.documentAmount>(business?.maxAmount??500)||snapshot.accountAmount!==snapshot.documentAmount||snapshot.amountTry!==Number(amountTry)||(documentDate!==null&&copyInvoiceDocumentDate(documentDate)!==copy.date))throw makeServiceError('ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE','Fişin cari hareket kapsamı doğrulanamadı.',409);
 if(business?.scope&&(business.scope.operation!==operation||business.scope.actorId!==String(actor?.id)||business.scope.invoiceId!==String(invoiceId)))throw makeServiceError('ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE','Seçili satış işlem kapsamı uyuşmuyor.',409);
 const daily=copy.target.database===BUSINESS_COPY_DATABASE?getBusinessDailySelection(copy):null;
 if(copy.target.database===BUSINESS_COPY_DATABASE&&!business&&!daily)throw makeServiceError('ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE','Fişin seçili günlük kapsamı doğrulanamadı.',409);
 const selected=business?.account??(role==='customer'?copy.customers:copy.suppliers).find(p=>p.currency==='TRY'&&(partyId===null||p.id===String(partyId))&&(!daily||p.accountId===(role==='customer'?daily.customerAccountId:daily.supplierAccountId)));
 if(!selected)throw makeServiceError('ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE','Fişin cari hesabı doğrulanamadı.',409);
 return{copy,role,partyId:selected.id,operation,amount,effect:direction===-1?'-'+amount:amount,table:role+'_movements',foreignKey:kind==='sales'?'sales_invoice_id':'purchase_invoice_id',header:kind==='sales'?'sales_invoices':'purchase_invoices',movementType,business,currency,rate,amountTry};
}

// Only the registered copy enters this adapter. All immutable settlement
// columns are inserted together; the native currency-account bridge links the
// resulting movement later without rewriting its amount or rate snapshot.
export async function insertIsolatedCopyInvoiceMovement(sqlDriver,transaction,{kind,invoiceId,movementType,snapshot,direction,actor,partyId,documentDate}){
 if(!isIsolatedOperationCopyRuntime())return false;
 const b=copyInvoiceMovementBinding(transaction,kind,invoiceId,movementType,snapshot,direction,actor,partyId,documentDate);
 if(b.business){await assertBusinessInvoiceAccount(sqlDriver,transaction,b.business);await new sqlDriver.Request(transaction).input('copyMovementDatabase',sqlDriver.NVarChar(128),b.copy.target.database).input('copyMovementCopyId',sqlDriver.UniqueIdentifier,b.copy.copyId).input('copyMovementActor',sqlDriver.BigInt,actor.id).input('copyMovementInvoice',sqlDriver.BigInt,invoiceId).input('copyMovementParty',sqlDriver.BigInt,b.partyId).input('copyMovementAccount',sqlDriver.BigInt,b.business.account.accountId).input('copyMovementOperation',sqlDriver.NVarChar(40),b.operation).input('copyMovementType',sqlDriver.NVarChar(40),b.movementType).input('selectedSalePolicyHash',sqlDriver.NVarChar(64),b.business?.scope?.policyHash??null).input('selectedSaleRequestId',sqlDriver.NVarChar(100),b.business?.scope?.requestId??null).input('copyMovementAmount',sqlDriver.Decimal(18,4),b.amount).input('copyMovementEffect',sqlDriver.Decimal(18,4),b.effect).input('copyMovementDate',sqlDriver.Date,b.copy.date).input('copyMovementCurrency',sqlDriver.NVarChar(3),b.currency).input('copyMovementRate',sqlDriver.Decimal(18,8),b.rate).input('copyMovementTry',sqlDriver.Decimal(18,4),b.amountTry).query(`
 IF DB_NAME() COLLATE Latin1_General_100_BIN2<>@copyMovementDatabase COLLATE Latin1_General_100_BIN2
 OR NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_intents WHERE copy_id=@copyMovementCopyId AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID() AND actor_id=@copyMovementActor AND operation=@copyMovementOperation AND JSON_VALUE(payload_json,'$.${b.role==='customer'?'businessCustomerId':'businessSupplierId'}')=CONVERT(nvarchar(20),@copyMovementParty) AND JSON_VALUE(payload_json,'$.businessAccountId')=CONVERT(nvarchar(20),@copyMovementAccount) AND JSON_VALUE(payload_json,'$.businessCurrency')=@copyMovementCurrency ${b.business.scope?"AND JSON_VALUE(payload_json,'$.businessSelectedSalePolicyHash')=@selectedSalePolicyHash AND JSON_VALUE(payload_json,'$.requestId')=@selectedSaleRequestId":''})
 OR NOT EXISTS(SELECT 1 FROM dbo.${b.header} WHERE id=@copyMovementInvoice AND ${b.role}_id=@copyMovementParty AND document_currency=@copyMovementCurrency AND account_currency=@copyMovementCurrency AND document_date=@copyMovementDate AND grand_total=@copyMovementAmount AND account_amount=@copyMovementAmount AND amount_try=@copyMovementTry AND exchange_rate_snapshot=@copyMovementRate AND account_exchange_rate_snapshot=@copyMovementRate AND status=N'${direction===1?'draft':'finalized'}')
 OR EXISTS(SELECT 1 FROM dbo.${b.table} WHERE ${b.foreignKey}=@copyMovementInvoice AND movement_type=@copyMovementType) THROW 51416,'ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE',1;
 INSERT dbo.${b.table}(${b.role}_id,${b.foreignKey},movement_type,amount,currency_code,balance_effect,document_date,created_at,created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try)
 VALUES(@copyMovementParty,@copyMovementInvoice,@copyMovementType,@copyMovementAmount,@copyMovementCurrency,@copyMovementEffect,@copyMovementDate,SYSUTCDATETIME(),@copyMovementActor,@copyMovementCurrency,@copyMovementAmount,@copyMovementRate,@copyMovementRate,@copyMovementTry);`);return true;}
 await new sqlDriver.Request(transaction).input('copyMovementDatabase',sqlDriver.NVarChar(128),b.copy.target.database).input('copyMovementCopyId',sqlDriver.UniqueIdentifier,b.copy.copyId).input('copyMovementActor',sqlDriver.BigInt,actor.id).input('copyMovementInvoice',sqlDriver.BigInt,invoiceId).input('copyMovementParty',sqlDriver.BigInt,b.partyId).input('copyMovementOperation',sqlDriver.NVarChar(40),b.operation).input('copyMovementType',sqlDriver.NVarChar(40),b.movementType).input('copyMovementAmount',sqlDriver.Decimal(18,4),b.amount).input('copyMovementEffect',sqlDriver.Decimal(18,4),b.effect).input('copyMovementDate',sqlDriver.Date,b.copy.date).query(`
 IF DB_NAME() COLLATE Latin1_General_100_BIN2<>@copyMovementDatabase COLLATE Latin1_General_100_BIN2
 OR NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_intents WHERE copy_id=@copyMovementCopyId AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID() AND actor_id=@copyMovementActor AND operation=@copyMovementOperation)
 OR NOT EXISTS(SELECT 1 FROM dbo.${b.header} WHERE id=@copyMovementInvoice AND ${b.role}_id=@copyMovementParty AND document_currency=N'TRY' AND account_currency=N'TRY' AND document_date=@copyMovementDate AND grand_total=@copyMovementAmount AND account_amount=@copyMovementAmount AND exchange_rate_snapshot=1 AND account_exchange_rate_snapshot=1 AND status=N'${direction===1?'draft':'finalized'}')
 OR EXISTS(SELECT 1 FROM dbo.${b.table} WHERE ${b.foreignKey}=@copyMovementInvoice AND movement_type=@copyMovementType)
 THROW 51416,'ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE',1;
 INSERT dbo.${b.table}(${b.role}_id,${b.foreignKey},movement_type,amount,currency_code,balance_effect,document_date,created_at,created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try)
 VALUES(@copyMovementParty,@copyMovementInvoice,@copyMovementType,@copyMovementAmount,N'TRY',@copyMovementEffect,@copyMovementDate,SYSUTCDATETIME(),@copyMovementActor,N'TRY',@copyMovementAmount,1,1,@copyMovementAmount);
 `);
 return true;
}

export async function stampInvoiceMovement(sqlDriver, transaction, kind, invoiceId, movementType, snapshot, direction,actor=null) {
 if(isIsolatedOperationCopyRuntime()){
  const b=copyInvoiceMovementBinding(transaction,kind,invoiceId,movementType,snapshot,direction,actor);
  if(b.business){const r=await new sqlDriver.Request(transaction).input('businessStampCopy',sqlDriver.UniqueIdentifier,b.copy.copyId).input('businessStampActor',sqlDriver.BigInt,actor.id).input('businessStampInvoice',sqlDriver.BigInt,invoiceId).input('businessStampParty',sqlDriver.BigInt,b.partyId).input('businessStampAccount',sqlDriver.BigInt,b.business.account.accountId).input('businessStampOperation',sqlDriver.NVarChar(40),b.operation).input('businessStampType',sqlDriver.NVarChar(40),movementType).input('selectedSalePolicyHash',sqlDriver.NVarChar(64),b.business?.scope?.policyHash??null).input('selectedSaleRequestId',sqlDriver.NVarChar(100),b.business?.scope?.requestId??null).input('businessStampAmount',sqlDriver.Decimal(18,4),b.amount).input('businessStampEffect',sqlDriver.Decimal(18,4),b.effect).input('businessStampDate',sqlDriver.Date,b.copy.date).input('businessStampCurrency',sqlDriver.NVarChar(3),b.currency).input('businessStampRate',sqlDriver.Decimal(18,8),b.rate).input('businessStampTry',sqlDriver.Decimal(18,4),b.amountTry).query(`SELECT m.id FROM dbo.${b.table} m JOIN dbo.stage4_copy_intents n ON n.copy_id=@businessStampCopy AND n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID() AND n.actor_id=@businessStampActor AND n.operation=@businessStampOperation WHERE m.${b.foreignKey}=@businessStampInvoice AND m.${b.role}_id=@businessStampParty AND m.movement_type=@businessStampType AND m.created_by=@businessStampActor AND m.created_at>=n.created_at AND m.document_date=@businessStampDate AND m.currency_code=@businessStampCurrency AND m.account_currency=@businessStampCurrency AND m.amount=@businessStampAmount AND m.account_amount=@businessStampAmount AND m.amount_try=@businessStampTry AND m.balance_effect=@businessStampEffect AND m.document_exchange_rate_snapshot=@businessStampRate AND m.account_exchange_rate_snapshot=@businessStampRate AND JSON_VALUE(n.payload_json,'$.${b.role==='customer'?'businessCustomerId':'businessSupplierId'}')=CONVERT(nvarchar(20),@businessStampParty) AND JSON_VALUE(n.payload_json,'$.businessAccountId')=CONVERT(nvarchar(20),@businessStampAccount) AND JSON_VALUE(n.payload_json,'$.businessCurrency')=@businessStampCurrency ${b.business.scope?"AND JSON_VALUE(n.payload_json,'$.businessSelectedSalePolicyHash')=@selectedSalePolicyHash AND JSON_VALUE(n.payload_json,'$.requestId')=@selectedSaleRequestId":''};`);if(r.recordset?.length!==1)throw makeServiceError('INVOICE_MOVEMENT_SNAPSHOT_AMBIGUOUS','Fişin cari hareketi tam doğrulanamadı.',409);return;}
  const r=await new sqlDriver.Request(transaction).input('copyStampCopy',sqlDriver.UniqueIdentifier,b.copy.copyId).input('copyStampActor',sqlDriver.BigInt,actor.id).input('copyStampInvoice',sqlDriver.BigInt,invoiceId).input('copyStampParty',sqlDriver.BigInt,b.partyId).input('copyStampOperation',sqlDriver.NVarChar(40),b.operation).input('copyStampType',sqlDriver.NVarChar(40),movementType).input('copyStampAmount',sqlDriver.Decimal(18,4),b.amount).input('copyStampEffect',sqlDriver.Decimal(18,4),b.effect).input('copyStampDate',sqlDriver.Date,b.copy.date).query(`SELECT m.id FROM dbo.${b.table} m JOIN dbo.stage4_copy_intents n ON n.copy_id=@copyStampCopy AND n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID() AND n.actor_id=@copyStampActor AND n.operation=@copyStampOperation WHERE m.${b.foreignKey}=@copyStampInvoice AND m.${b.role}_id=@copyStampParty AND m.movement_type=@copyStampType AND m.created_by=@copyStampActor AND m.created_at>=n.created_at AND m.document_date=@copyStampDate AND m.currency_code=N'TRY' AND m.account_currency=N'TRY' AND m.amount=@copyStampAmount AND m.account_amount=@copyStampAmount AND m.amount_try=@copyStampAmount AND m.balance_effect=@copyStampEffect AND m.document_exchange_rate_snapshot=1 AND m.account_exchange_rate_snapshot=1;`);
  if(r.recordset?.length!==1)throw makeServiceError('INVOICE_MOVEMENT_SNAPSHOT_AMBIGUOUS','Fişin cari hareketi tam doğrulanamadı.',409);
  return;
 }
  const table = kind === 'sales' ? 'customer_movements' : 'supplier_movements';
  const foreignKey = kind === 'sales' ? 'sales_invoice_id' : 'purchase_invoice_id';
  const rows = (await new sqlDriver.Request(transaction).input('stampInvoice', sql.BigInt, invoiceId).input('stampType', sql.NVarChar(40), movementType)
    .query(`SELECT id FROM dbo.${table} WHERE ${foreignKey}=@stampInvoice AND movement_type=@stampType;`)).recordset || [];
  if (rows.length !== 1) throw makeServiceError('INVOICE_MOVEMENT_SNAPSHOT_AMBIGUOUS', 'Fişin cari hareketi tekil değil; işlem geri alındı.', 409);
  await writeMovementCurrencySnapshot(new sqlDriver.Request(transaction), kind === 'sales' ? 'customer' : 'supplier', rows[0].id, snapshot, direction * snapshot.accountAmount);
}

async function assertInvoiceSettlementParty(sqlDriver, transaction, kind, invoice, settlement, { active = false } = {}) {
  const business=businessInvoiceSelection(transaction,kind,invoice[`${kind==='sales'?'customer':'supplier'}Id`],settlement.accountCurrency);
  if(business){await assertBusinessInvoiceAccount(sqlDriver,transaction,business);if(settlement.documentCurrency!==business.currency||settlement.documentRateToTry!==business.rate||settlement.accountRateToTry!==business.rate)throw makeServiceError('ISOLATED_COPY_INVOICE_RATE_SCOPE','Kayıtlı aynı döviz ve TEST kur görüntüsü gerekli.',409);return;}
  const party = kind === 'sales' ? 'customer' : 'supplier';
  const row = (await new sqlDriver.Request(transaction).input('settlementCurrentPartyId', sql.BigInt, invoice[`${party}Id`])
    .query(`SELECT currency_code, is_active, is_deleted FROM dbo.${party === 'customer' ? 'customers' : 'suppliers'} WITH(UPDLOCK,HOLDLOCK) WHERE id=@settlementCurrentPartyId;`)).recordset?.[0];
  if (!row || row.currency_code !== settlement.accountCurrency || (active && (!row.is_active || row.is_deleted))) {
    throw makeServiceError('INVOICE_PARTY_CURRENCY_CHANGED', 'Cari kartı fişin kayıtlı döviz bilgisiyle uyuşmuyor; bakiye değiştirilemez.', 409);
  }
}

async function hasPurchaseDiscountSchema(request) {
  return (await request.query("SELECT CASE WHEN COL_LENGTH(N'dbo.purchase_invoices',N'invoice_discount_type') IS NOT NULL AND COL_LENGTH(N'dbo.purchase_invoices',N'invoice_discount_amount') IS NOT NULL THEN 1 ELSE 0 END AS discount_ready;")).recordset?.[0]?.discount_ready === 1;
}

async function readPurchaseDiscountSnapshot(request, id) {
  const ready = await hasPurchaseDiscountSchema(request);
  if (!ready) return { invoiceDiscountType: 'rate', invoiceDiscountAmount: 0 };
  const row = (await request.input('discountSnapshotId', sql.BigInt, id).query('SELECT invoice_discount_type, invoice_discount_amount FROM dbo.purchase_invoices WHERE id=@discountSnapshotId;')).recordset?.[0];
  return { invoiceDiscountType: row?.invoice_discount_type || 'rate', invoiceDiscountAmount: Number(row?.invoice_discount_amount || 0) };
}

async function writePurchaseDiscountSnapshot(sqlDriver, transaction, id, draft) {
  const ready = await hasPurchaseDiscountSchema(new sqlDriver.Request(transaction));
  if (!ready) {
    if (draft.invoiceDiscountType === 'amount') throw makeServiceError('PURCHASE_DISCOUNT_SCHEMA_REQUIRED', 'Sabit alış indirimi için 0020 kaynak geçişi kurulmalıdır.', 503);
    return;
  }
  await new sqlDriver.Request(transaction).input('discountInvoiceId', sql.BigInt, id).input('discountType', sql.NVarChar(10), draft.invoiceDiscountType)
    .input('discountAmount', sql.Decimal(18, 4), draft.invoiceDiscountAmount)
    .query('UPDATE dbo.purchase_invoices SET invoice_discount_type=@discountType, invoice_discount_amount=@discountAmount WHERE id=@discountInvoiceId;');
}

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function hasPersonnelSalesSchema(request) {
  const result = await request.query(`
    SELECT CASE
      WHEN OBJECT_ID(N'dbo.employees', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_devices', N'assigned_employee_id') IS NOT NULL
       AND COL_LENGTH(N'dbo.sales_invoices', N'employee_id') IS NOT NULL
      THEN 1 ELSE 0
    END AS is_ready;
  `);
  return Boolean(result.recordset?.[0]?.is_ready);
}

function numberValue(value, fieldName, { min = 0, allowZero = true } = {}) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || (!allowZero && number === 0)) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `${fieldName} is invalid`);
  }

  return number;
}

function normalizeCurrency(value) {
  return trimText(value || 'TRY').toUpperCase();
}

function normalizeDate(value) {
  return trimText(value) || new Date().toISOString().slice(0, 10);
}

function normalizeCancelReason(value, code = 'SALES_CANCEL_REASON_REQUIRED') {
  const reason = trimText(value);

  if (!reason) {
    throw makeServiceError(code, 'Cancel reason is required', 400);
  }

  return reason.slice(0, 500);
}

function createDocumentNo(prefix) {
  const now = new Date();
  const stamp = [
    String(now.getUTCFullYear()).slice(-2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');

  return `${prefix}-${stamp}`;
}

function parseDraftListQuery(query = {}, partyType) {
  const options = parseListQuery(query);
  const partyIdKey = `${partyType}Id`;
  const otherPartyIdKey = partyType === 'customer' ? 'supplierId' : 'customerId';
  if (query[otherPartyIdKey] !== undefined) {
    throw makeServiceError('INVOICE_LIST_PARTY_SCOPE_INVALID', `${otherPartyIdKey} is not supported for this invoice list`);
  }
  const partyId = parseOptionalQueryId(query[partyIdKey], partyIdKey, 'INVOICE_LIST_PARTY_ID_INVALID');
  const status = trimText(query.status || 'DRAFT').toUpperCase();
  const partySearch = trimText(query.customer || query.supplier || query.party);
  const dateFrom = trimText(query.dateFrom);
  const dateTo = trimText(query.dateTo);
  const currency = trimText(query.currency).toUpperCase();
  const amountMinText = trimText(query.amountMin);
  const amountMaxText = trimText(query.amountMax);
  const amountMin = amountMinText === '' ? null : Number(amountMinText);
  const amountMax = amountMaxText === '' ? null : Number(amountMaxText);
  const allowedStatuses = new Set(['DRAFT', 'FINALIZED', 'CANCELLED', 'ARCHIVED_TEST']);

  if (currency && currency !== 'ALL' && !VALID_CURRENCIES.has(currency)) {
    throw makeServiceError('INVOICE_LIST_CURRENCY_INVALID', 'Currency filter must be TRY, USD or EUR');
  }
  if (amountMin !== null && (!Number.isFinite(amountMin) || amountMin < 0)) {
    throw makeServiceError('INVOICE_LIST_AMOUNT_MIN_INVALID', 'Minimum amount must be zero or greater');
  }
  if (amountMax !== null && (!Number.isFinite(amountMax) || amountMax < 0)) {
    throw makeServiceError('INVOICE_LIST_AMOUNT_MAX_INVALID', 'Maximum amount must be zero or greater');
  }
  if (amountMin !== null && amountMax !== null && amountMin > amountMax) {
    throw makeServiceError('INVOICE_LIST_AMOUNT_RANGE_INVALID', 'Minimum amount cannot exceed maximum amount');
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw makeServiceError('INVOICE_LIST_DATE_RANGE_INVALID', 'Start date cannot be after end date');
  }

  return {
    ...options,
    status: status === 'ALL' || status === '' ? 'all' : allowedStatuses.has(status) ? status.toLowerCase() : 'unsupported',
    partySearch,
    partyId,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    currency: currency === 'ALL' ? null : currency || null,
    amountMin,
    amountMax,
    employeeSearch: trimText(query.employee),
    terminalSearch: trimText(query.terminal),
  };
}

function toSalesListDto(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    customerId: row.customer_id ?? null,
    customerName: row.customer_name || '-',
    terminalCode: row.terminal_code || '',
    employeeId: row.employee_id ? Number(row.employee_id) : null,
    employeeName: row.employee_name || '',
    currency: row.currency_code,
    totalAmount: Number(row.total_amount || 0),
    status: String(row.status || '').toUpperCase(),
    itemCount: Number(row.item_count || 0),
    documentDate: row.document_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPurchaseListDto(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    supplierId: row.supplier_id ?? null,
    supplierName: row.supplier_name || '-',
    currency: row.currency_code,
    totalAmount: Number(row.total_amount || 0),
    status: String(row.status || '').toUpperCase(),
    itemCount: Number(row.item_count || 0),
    documentDate: row.document_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFinalizeResult(snapshot, warnings = []) {
  return {
    ...snapshot,
    finalizedAt: snapshot.finalizedAt || null,
    commercialEffect: true,
    warnings,
  };
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function recalculateProductAverageCostTry(sqlDriver, transaction, productId, actor = null) {
  const returnedValuation = (await new sqlDriver.Request(transaction).input('averageReturnProductId', sql.BigInt, productId).query(`
    SELECT COALESCE(SUM(quantity_net),0) AS net_quantity, COALESCE(SUM(quantity_net * unit_cost_try),0) AS net_cost
    FROM dbo.stock_movements WHERE product_id=@averageReturnProductId AND source_type IN(N'invoice_return',N'invoice_return_cancel');
  `)).recordset?.[0];
  if (Math.abs(Number(returnedValuation?.net_quantity || 0)) > 0.0001 || Math.abs(Number(returnedValuation?.net_cost || 0)) > 0.0001) {
    throw makeServiceError('PURCHASE_VALUATION_HAS_RETURNS', 'Üründe iade maliyet etkisi var; eski alış düzeltme/iptal maliyet hesabı bunu güvenle koruyamıyor. İşlem kaydedilmedi.', 409);
  }
  const purchaseTotals = await new sqlDriver.Request(transaction)
    .input('averageCostProductId', sql.BigInt, productId)
    .query(`
      SELECT
        COALESCE(SUM(quantity_net), 0) AS net_purchase_quantity,
        COALESCE(SUM(amount_try), 0) AS net_purchase_amount_try
      FROM dbo.stock_movements
      WHERE product_id = @averageCostProductId
        AND source_type = N'purchase_invoice';
    `);

  const totalRow = purchaseTotals.recordset?.[0] || {};
  const netPurchaseQuantity = safeNumber(totalRow.net_purchase_quantity);
  const netPurchaseAmountTry = safeNumber(totalRow.net_purchase_amount_try);
  const nextAverageCostTry = netPurchaseQuantity > 0 ? netPurchaseAmountTry / netPurchaseQuantity : 0;

  const beforeProduct = await new sqlDriver.Request(transaction)
    .input('averageCostBeforeProductId', sql.BigInt, productId)
    .query(`
      SELECT TOP (1)
        average_cost_try AS averageCostTry
      FROM dbo.products
      WHERE id = @averageCostBeforeProductId;
    `);
  const beforeAverageCostTry = safeNumber(beforeProduct.recordset?.[0]?.averageCostTry);

  await new sqlDriver.Request(transaction)
    .input('averageCostUpdateProductId', sql.BigInt, productId)
    .input('averageCostUpdateValue', sql.Decimal(18, 4), nextAverageCostTry)
    .query(`
      UPDATE dbo.products
      SET
        average_cost_try = @averageCostUpdateValue,
        updated_at = SYSUTCDATETIME()
      WHERE id = @averageCostUpdateProductId;
    `);

  await writeAuditLog(new sqlDriver.Request(transaction), {
    action: 'product_average_cost_recalculated',
    entityType: 'product',
    entityId: productId,
    beforeSnapshot: {
      averageCostTry: beforeAverageCostTry,
    },
    afterSnapshot: {
      averageCostTry: nextAverageCostTry,
      netPurchaseQuantity,
      netPurchaseAmountTry,
      policy: 'recalculate_from_purchase_stock_movements',
    },
    actor,
  });

  return nextAverageCostTry;
}

export function calculateSalesProfitSnapshot({ salesAmountTry, averageCostTry, quantity }) {
  if (averageCostTry == null || !Number.isFinite(Number(averageCostTry)) || Number(averageCostTry) <= 0) {
    return { grossProfitTry: null, grossProfitRate: null };
  }
  const costAmountTry = averageCostTry * quantity;
  const grossProfitTry = salesAmountTry - costAmountTry;

  return {
    grossProfitTry,
    grossProfitRate: salesAmountTry > 0 ? grossProfitTry / salesAmountTry : 0,
  };
}

function purchaseLineCostTry(item, exchangeRate) {
  const lineTotal = safeNumber(item.lineTotal);
  const lineTotalTry = safeNumber(item.lineTotalTry);
  const rate = safeNumber(exchangeRate, 1);

  // Persisted net TRY includes every discount; zero and totals below the gross line are valid.
  if (item.lineTotalTry != null && Number.isFinite(Number(item.lineTotalTry)) && lineTotalTry >= 0) {
    return lineTotalTry;
  }

  return lineTotal * rate;
}

function applyDiscount(amount, discountRate) {
  const rate = Math.min(100, Math.max(0, safeNumber(discountRate)));
  return safeNumber(amount) * (1 - (rate / 100));
}

function rateToTryForCurrency(currencyRateMap, currency, fallback = 1) {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === 'TRY') {
    return 1;
  }

  return safeNumber(currencyRateMap?.get(normalizedCurrency), fallback);
}


async function readCurrencyRateMap(request) {
  const result = await request.query(`
    WITH latest_rates AS (
      SELECT
        currency_code,
        rate_to_try,
        ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY rate_date DESC, id DESC) AS row_number
      FROM dbo.currency_rates
      WHERE currency_code IN (N'USD', N'EUR')
    )
    SELECT currency_code, rate_to_try
    FROM latest_rates
    WHERE row_number = 1;
  `);

  return new Map((result.recordset || []).map((row) => [row.currency_code, safeNumber(row.rate_to_try)]));
}

export function resolveSalesUnitCostTry(item, documentCurrency, exchangeRate, currencyRateMap = new Map()) {
  // Card purchase price and a later rate do not prove the opening stock valuation.
  const productAverageCostTry = safeNumber(item.productAverageCostTry);
  if (productAverageCostTry > 0) {
    return productAverageCostTry;
  }

  const itemAverageCostTry = safeNumber(item.averageCostTry);
  if (itemAverageCostTry > 0) {
    return itemAverageCostTry;
  }

  return null;
}

function invoiceDocumentRate(payload) {
  if (normalizeCurrency(payload.documentCurrency) !== 'TRY' && (payload.exchangeRate == null || payload.exchangeRate === '')) {
    throw makeServiceError('CURRENCY_SETTLEMENT_RATE_REQUIRED', 'Fiş tarihindeki işlem kuru gerekli. Eksik döviz kuru 1 kabul edilemez.');
  }
  return numberValue(payload.exchangeRate ?? 1, 'exchangeRate', { min: 0, allowZero: false });
}

export function normalizeSalesPayload(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const discountRate = numberValue(payload.discountRate ?? 0, 'discountRate');
  const subtotal = items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const discountTotal = subtotal * (discountRate / 100);
  const grandTotal = subtotal - discountTotal;

  if (!payload.customerId) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'customerId is required');
  }

  if (items.length < 1) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'At least one product line is required');
  }

  if (grandTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'grandTotal cannot be negative');
  }

  return {
    documentNo: trimText(payload.documentNo) || createDocumentNo('SDR'),
    documentDate: normalizeDate(payload.documentDate),
    customerId: Number(payload.customerId),
    terminalDeviceId: payload.terminalDeviceId !== null && payload.terminalDeviceId !== undefined ? Number(payload.terminalDeviceId) : null,
    employeeId: payload.employeeId ? Number(payload.employeeId) : null,
    customerCurrency: normalizeCurrency(payload.customerCurrency),
    documentCurrency: normalizeCurrency(payload.documentCurrency),
    exchangeRate: invoiceDocumentRate(payload),
    accountExchangeRate: payload.accountExchangeRate == null || payload.accountExchangeRate === "" ? null : numberValue(payload.accountExchangeRate, "accountExchangeRate", { min: 0, allowZero: false }),
    description: trimText(payload.description),
    discountRate,
    subtotal,
    discountTotal,
    grandTotal,
    amountTry: grandTotal * invoiceDocumentRate(payload),
    estimatedProfitTry: null,
    items: items.map((item, index) => normalizeSalesItem(item, index)),
  };
}

function normalizeSalesItem(item, index) {
  const quantity = numberValue(item.quantity, `items[${index}].quantity`, { min: 0, allowZero: false });
  const unitPrice = numberValue(item.unitPrice, `items[${index}].unitPrice`);
  const lineTotal = quantity * unitPrice;

  if (!item.productId) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].productId is required`);
  }

  if (lineTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].lineTotal cannot be negative`);
  }

  return {
    productId: Number(item.productId),
    stockCode: trimText(item.stockCode),
    barcode: trimText(item.barcode),
    productName: trimText(item.productName),
    quantity,
    currency: normalizeCurrency(item.currency),
    unitPrice,
    lineTotal,
    averageCostTry: numberValue(item.averageCostTry ?? 0, `items[${index}].averageCostTry`),
    stockStatus: trimText(item.stockStatus),
    note: trimText(item.note),
  };
}

export function normalizePurchasePayload(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const invoiceDiscountRate = numberValue(payload.invoiceDiscountRate ?? 0, 'invoiceDiscountRate');
  const supplierDiscountRate = numberValue(payload.supplierDiscountRate ?? 0, 'supplierDiscountRate');
  const exchangeRate = invoiceDocumentRate(payload);
  const normalizedItems = items.map((item, index) => normalizePurchaseItem(item, index));
  const totals = getPurchaseTotals({ items: normalizedItems, invoiceDiscountRate, invoiceDiscountType: payload.invoiceDiscountType ?? "rate", invoiceDiscountAmount: payload.invoiceDiscountAmount ?? 0, supplierDiscountRate, exchangeRate });

  if (!payload.supplierId && !trimText(payload.supplierName)) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'supplierId or supplierName is required');
  }

  if (items.length < 1) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'At least one product line is required');
  }

  if (totals.grandTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'grandTotal cannot be negative');
  }

  return {
    documentNo: trimText(payload.documentNo) || createDocumentNo('PDR'),
    documentDate: normalizeDate(payload.documentDate),
    supplierId: payload.supplierId ? Number(payload.supplierId) : null,
    supplierName: trimText(payload.supplierName),
    supplierCurrency: normalizeCurrency(payload.supplierCurrency),
    documentCurrency: normalizeCurrency(payload.documentCurrency),
    exchangeRate,
    accountExchangeRate: payload.accountExchangeRate == null || payload.accountExchangeRate === "" ? null : numberValue(payload.accountExchangeRate, "accountExchangeRate", { min: 0, allowZero: false }),
    description: trimText(payload.description),
    subtotal: totals.subtotal,
    lineDiscountTotal: totals.lineDiscountTotal,
    invoiceDiscountType: totals.invoiceDiscountType,
    invoiceDiscountAmount: totals.invoiceDiscountAmount,
    invoiceDiscountRate: totals.invoiceDiscountRate,
    supplierDiscountRate: totals.supplierDiscountRate,
    discountTotal: totals.discountTotal,
    grandTotal: totals.grandTotal,
    amountTry: totals.amountTry,
    stockCostEffectTry: totals.stockCostEffectTry,
    items: totals.items.map((entry) => ({
      ...entry.item,
      lineTotal: entry.lineTotal,
      lineTotalTry: entry.lineTotalTry,
    })),
  };
}

function normalizePurchaseItem(item, index) {
  const quantity = numberValue(item.quantity, `items[${index}].quantity`, { min: 0, allowZero: false });
  const purchasePrice = numberValue(item.purchasePrice, `items[${index}].purchasePrice`);
  const lineDiscountRate = numberValue(item.lineDiscountRate ?? 0, `items[${index}].lineDiscountRate`);
  const gross = quantity * purchasePrice;
  const lineTotal = gross - gross * (lineDiscountRate / 100);

  if (!item.productId) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].productId is required`);
  }

  if (lineTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].lineTotal cannot be negative`);
  }

  return {
    productId: Number(item.productId),
    stockCode: trimText(item.stockCode),
    barcode: trimText(item.barcode),
    productName: trimText(item.productName),
    quantity,
    currency: normalizeCurrency(item.currency),
    purchasePrice,
    lineDiscountRate,
    lineTotal,
    lineTotalTry: lineTotal,
    stockEffect: trimText(item.stockEffect),
    note: trimText(item.note),
  };
}

async function getSalesSnapshot(request, id) {
  const personnelReady = await hasPersonnelSalesSchema(request);
  const ownershipColumns = personnelReady
    ? `si.terminal_device_id AS terminalDeviceId,
        td.device_code AS terminalCode,
        td.device_name AS terminalName,
        si.employee_id AS employeeId,
        e.employee_code AS employeeCode,
        e.full_name AS employeeName,`
    : `CAST(NULL AS BIGINT) AS terminalDeviceId,
        CAST(NULL AS NVARCHAR(80)) AS terminalCode,
        CAST(NULL AS NVARCHAR(150)) AS terminalName,
        CAST(NULL AS BIGINT) AS employeeId,
        CAST(NULL AS NVARCHAR(50)) AS employeeCode,
        CAST(NULL AS NVARCHAR(150)) AS employeeName,`;
  const ownershipJoins = personnelReady
    ? `LEFT JOIN dbo.terminal_devices td ON td.id = si.terminal_device_id
       LEFT JOIN dbo.employees e ON e.id = si.employee_id`
    : '';
  const header = await request
    .input('salesSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        si.id,
        si.document_no AS documentNo,
        si.document_date AS documentDate,
        si.customer_id AS customerId,
        c.customer_code AS customerCode,
        c.name AS customerName,
        ${ownershipColumns}
        CASE WHEN COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE si.status END AS status,
        si.customer_currency AS customerCurrency,
        si.document_currency AS documentCurrency,
        si.exchange_rate_snapshot AS exchangeRate,
        si.description,
        si.subtotal,
        si.discount_rate AS discountRate,
        si.discount_total AS discountTotal,
        si.grand_total AS grandTotal,
        si.amount_try AS amountTry,
        si.estimated_profit_try AS estimatedProfitTry,
        si.updated_at AS updatedAt
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      ${ownershipJoins}
      WHERE si.id = @salesSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('salesItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        sii.id,
        sii.product_id AS productId,
        p.category,
        sii.stock_code_snapshot AS stockCode,
        sii.barcode_snapshot AS barcode,
        sii.product_name_snapshot AS productName,
        sii.quantity,
        sii.currency_code AS currency,
        sii.unit_price AS unitPrice,
        sii.line_total AS lineTotal,
        sii.average_cost_try_snapshot AS averageCostTry,
        sii.gross_profit_try AS grossProfitTry,
        sii.gross_profit_rate AS grossProfitRate,
        sii.stock_status_snapshot AS stockStatus,
        sii.note
      FROM dbo.sales_invoice_items sii
      LEFT JOIN dbo.products p ON p.id = sii.product_id
      WHERE sii.sales_invoice_id = @salesItemsSnapshotId
      ORDER BY sii.id ASC;
    `);

  return {
    ...row,
    ...(await readInvoiceCurrencySnapshot(request, 'sales', id)),
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function getPurchaseSnapshot(request, id) {
  const header = await request
    .input('purchaseSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        pi.id,
        pi.document_no AS documentNo,
        pi.document_date AS documentDate,
        pi.supplier_id AS supplierId,
        s.name AS supplierName,
        pi.status,
        pi.supplier_currency AS supplierCurrency,
        pi.document_currency AS documentCurrency,
        pi.exchange_rate_snapshot AS exchangeRate,
        pi.description,
        pi.subtotal,
        pi.line_discount_total AS lineDiscountTotal,
        pi.invoice_discount_rate AS invoiceDiscountRate,
        pi.supplier_discount_rate AS supplierDiscountRate,
        pi.discount_total AS discountTotal,
        pi.grand_total AS grandTotal,
        pi.amount_try AS amountTry,
        pi.stock_cost_effect_try AS stockCostEffectTry,
        pi.updated_at AS updatedAt
      FROM dbo.purchase_invoices pi
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      WHERE pi.id = @purchaseSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('purchaseItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        id,
        product_id AS productId,
        stock_code_snapshot AS stockCode,
        barcode_snapshot AS barcode,
        product_name_snapshot AS productName,
        quantity,
        currency_code AS currency,
        purchase_price AS purchasePrice,
        line_discount_rate AS lineDiscountRate,
        line_total AS lineTotal,
        line_total_try AS lineTotalTry,
        stock_effect_snapshot AS stockEffect,
        note
      FROM dbo.purchase_invoice_items
      WHERE purchase_invoice_id = @purchaseItemsSnapshotId
      ORDER BY id ASC;
    `);

  return {
    ...row,
    ...(await readInvoiceCurrencySnapshot(request, 'purchase', id)),
    ...(await readPurchaseDiscountSnapshot(request, id)),
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function getSalesFinalizeSnapshot(request, id, { lockHeader = false } = {}) {
  const personnelReady = await hasPersonnelSalesSchema(request);
  const ownershipColumns = personnelReady
    ? `si.terminal_device_id AS terminalDeviceId,
        td.device_code AS terminalCode,
        td.device_name AS terminalName,
        si.employee_id AS employeeId,
        e.employee_code AS employeeCode,
        e.full_name AS employeeName,`
    : `CAST(NULL AS BIGINT) AS terminalDeviceId,
        CAST(NULL AS NVARCHAR(80)) AS terminalCode,
        CAST(NULL AS NVARCHAR(150)) AS terminalName,
        CAST(NULL AS BIGINT) AS employeeId,
        CAST(NULL AS NVARCHAR(50)) AS employeeCode,
        CAST(NULL AS NVARCHAR(150)) AS employeeName,`;
  const ownershipJoins = personnelReady
    ? `LEFT JOIN dbo.terminal_devices td ON td.id = si.terminal_device_id
       LEFT JOIN dbo.employees e ON e.id = si.employee_id`
    : '';
  const invoiceTable = lockHeader ? 'dbo.sales_invoices si WITH (UPDLOCK, HOLDLOCK)' : 'dbo.sales_invoices si';
  const header = await request
    .input('finalizeSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        si.id,
        si.document_no AS documentNo,
        si.document_date AS documentDate,
        si.customer_id AS customerId,
        c.customer_code AS customerCode,
        c.name AS customerName,
        ${ownershipColumns}
        c.is_active AS customerIsActive,
        CASE WHEN COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE si.status END AS status,
        si.customer_currency AS customerCurrency,
        si.document_currency AS documentCurrency,
        si.exchange_rate_snapshot AS exchangeRate,
        si.description,
        si.subtotal,
        si.discount_rate AS discountRate,
        si.discount_total AS discountTotal,
        si.grand_total AS grandTotal,
        si.amount_try AS amountTry,
        si.estimated_profit_try AS estimatedProfitTry,
        si.finalized_at AS finalizedAt,
        si.updated_at AS updatedAt
      FROM ${invoiceTable}
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      ${ownershipJoins}
      WHERE si.id = @finalizeSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('finalizeItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        sii.id,
        sii.product_id AS productId,
        p.current_stock_qty AS currentStockQty,
        p.category,
        p.currency_code AS productCurrency,
        p.purchase_price AS productPurchasePrice,
        p.purchase_discount_rate AS productPurchaseDiscountRate,
        p.average_cost_try AS productAverageCostTry,
        sii.stock_code_snapshot AS stockCode,
        sii.barcode_snapshot AS barcode,
        sii.product_name_snapshot AS productName,
        sii.quantity,
        sii.currency_code AS currency,
        sii.unit_price AS unitPrice,
        sii.line_total AS lineTotal,
        sii.average_cost_try_snapshot AS averageCostTry,
        sii.gross_profit_try AS grossProfitTry,
        sii.gross_profit_rate AS grossProfitRate,
        sii.stock_status_snapshot AS stockStatus,
        sii.note
      FROM dbo.sales_invoice_items sii
      INNER JOIN dbo.products p ON p.id = sii.product_id
      WHERE sii.sales_invoice_id = @finalizeItemsSnapshotId
      ORDER BY sii.id ASC;
    `);

  return {
    ...row,
    ...(await readInvoiceCurrencySnapshot(request, 'sales', id)),
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function getPurchaseFinalizeSnapshot(request, id, { lockHeader = false } = {}) {
  const invoiceTable = lockHeader ? 'dbo.purchase_invoices pi WITH (UPDLOCK, HOLDLOCK)' : 'dbo.purchase_invoices pi';
  const header = await request
    .input('purchaseFinalizeSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        pi.id,
        pi.document_no AS documentNo,
        pi.document_date AS documentDate,
        pi.supplier_id AS supplierId,
        s.name AS supplierName,
        s.is_active AS supplierIsActive,
        pi.status,
        pi.supplier_currency AS supplierCurrency,
        pi.document_currency AS documentCurrency,
        pi.exchange_rate_snapshot AS exchangeRate,
        pi.description,
        pi.subtotal,
        pi.line_discount_total AS lineDiscountTotal,
        pi.invoice_discount_rate AS invoiceDiscountRate,
        pi.supplier_discount_rate AS supplierDiscountRate,
        pi.discount_total AS discountTotal,
        pi.grand_total AS grandTotal,
        pi.amount_try AS amountTry,
        pi.stock_cost_effect_try AS stockCostEffectTry,
        pi.finalized_at AS finalizedAt,
        pi.updated_at AS updatedAt
      FROM ${invoiceTable}
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      WHERE pi.id = @purchaseFinalizeSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('purchaseFinalizeItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        pii.id,
        pii.product_id AS productId,
        p.current_stock_qty AS currentStockQty,
        p.average_cost_try AS currentAverageCostTry,
        pii.stock_code_snapshot AS stockCode,
        pii.barcode_snapshot AS barcode,
        pii.product_name_snapshot AS productName,
        pii.quantity,
        pii.currency_code AS currency,
        pii.purchase_price AS purchasePrice,
        pii.line_discount_rate AS lineDiscountRate,
        pii.line_total AS lineTotal,
        pii.line_total_try AS lineTotalTry,
        pii.stock_effect_snapshot AS stockEffect,
        pii.note
      FROM dbo.purchase_invoice_items pii
      INNER JOIN dbo.products p ${lockHeader ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} ON p.id = pii.product_id
      WHERE pii.purchase_invoice_id = @purchaseFinalizeItemsSnapshotId
      ORDER BY pii.id ASC;
    `);

  return {
    ...row,
    ...(await readInvoiceCurrencySnapshot(request, 'purchase', id)),
    ...(await readPurchaseDiscountSnapshot(request, id)),
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function updateSalesItems(sqlDriver, transaction, invoiceId, items) {
  const existing = await new sqlDriver.Request(transaction)
    .input('invoiceIdForItems', sql.BigInt, invoiceId)
    .query(`
      SELECT id
      FROM dbo.sales_invoice_items
      WHERE sales_invoice_id = @invoiceIdForItems
      ORDER BY id ASC;
    `);

  const existingRows = existing.recordset || [];

  for (const [index, item] of items.entries()) {
    const existingId = existingRows[index]?.id;

    if (existingId) {
      await new sqlDriver.Request(transaction)
        .input('itemId', sql.BigInt, existingId)
        .input('productId', sql.BigInt, item.productId)
        .input('stockCode', sql.NVarChar(50), item.stockCode)
        .input('barcode', sql.NVarChar(80), item.barcode || null)
        .input('productName', sql.NVarChar(250), item.productName)
        .input('quantity', sql.Decimal(18, 3), item.quantity)
        .input('currency', sql.NVarChar(3), item.currency)
        .input('unitPrice', sql.Decimal(18, 4), item.unitPrice)
        .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
        .input('averageCostTry', sql.Decimal(18, 4), item.averageCostTry)
        .input('stockStatus', sql.NVarChar(50), item.stockStatus || null)
        .input('note', sql.NVarChar(250), item.note || null)
        .query(`
          UPDATE dbo.sales_invoice_items
          SET
            product_id = @productId,
            stock_code_snapshot = @stockCode,
            barcode_snapshot = @barcode,
            product_name_snapshot = @productName,
            quantity = @quantity,
            currency_code = @currency,
            unit_price = @unitPrice,
            line_total = @lineTotal,
            average_cost_try_snapshot = @averageCostTry,
            stock_status_snapshot = @stockStatus,
            note = @note
          WHERE id = @itemId;
        `);
    } else {
      await insertSalesItem(sqlDriver, transaction, invoiceId, item);
    }
  }

  for (const obsoleteRow of existingRows.slice(items.length)) {
    await new sqlDriver.Request(transaction)
      .input('obsoleteSalesItemId', sql.BigInt, obsoleteRow.id)
      .query('DELETE FROM dbo.sales_invoice_items WHERE id = @obsoleteSalesItemId;');
  }
}

async function insertSalesItem(sqlDriver, transaction, invoiceId, item) {
  await new sqlDriver.Request(transaction)
    .input('invoiceId', sql.BigInt, invoiceId)
    .input('productId', sql.BigInt, item.productId)
    .input('stockCode', sql.NVarChar(50), item.stockCode)
    .input('barcode', sql.NVarChar(80), item.barcode || null)
    .input('productName', sql.NVarChar(250), item.productName)
    .input('quantity', sql.Decimal(18, 3), item.quantity)
    .input('currency', sql.NVarChar(3), item.currency)
    .input('unitPrice', sql.Decimal(18, 4), item.unitPrice)
    .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
    .input('averageCostTry', sql.Decimal(18, 4), item.averageCostTry)
    .input('stockStatus', sql.NVarChar(50), item.stockStatus || null)
    .input('note', sql.NVarChar(250), item.note || null)
    .query(`
      INSERT INTO dbo.sales_invoice_items (
        sales_invoice_id,
        product_id,
        stock_code_snapshot,
        barcode_snapshot,
        product_name_snapshot,
        quantity,
        currency_code,
        unit_price,
        line_total,
        average_cost_try_snapshot,
        stock_status_snapshot,
        note
      )
      VALUES (
        @invoiceId,
        @productId,
        @stockCode,
        @barcode,
        @productName,
        @quantity,
        @currency,
        @unitPrice,
        @lineTotal,
        @averageCostTry,
        @stockStatus,
        @note
      );
    `);
}

async function updatePurchaseItems(sqlDriver, transaction, invoiceId, items) {
  const existing = await new sqlDriver.Request(transaction)
    .input('invoiceIdForItems', sql.BigInt, invoiceId)
    .query(`
      SELECT id
      FROM dbo.purchase_invoice_items
      WHERE purchase_invoice_id = @invoiceIdForItems
      ORDER BY id ASC;
    `);

  const existingRows = existing.recordset || [];

  for (const [index, item] of items.entries()) {
    const existingId = existingRows[index]?.id;

    if (existingId) {
      await new sqlDriver.Request(transaction)
        .input('itemId', sql.BigInt, existingId)
        .input('productId', sql.BigInt, item.productId)
        .input('stockCode', sql.NVarChar(50), item.stockCode)
        .input('barcode', sql.NVarChar(80), item.barcode || null)
        .input('productName', sql.NVarChar(250), item.productName)
        .input('quantity', sql.Decimal(18, 3), item.quantity)
        .input('currency', sql.NVarChar(3), item.currency)
        .input('purchasePrice', sql.Decimal(18, 4), item.purchasePrice)
        .input('lineDiscountRate', sql.Decimal(9, 4), item.lineDiscountRate)
        .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
        .input('lineTotalTry', sql.Decimal(18, 4), item.lineTotalTry)
        .input('stockEffect', sql.NVarChar(50), item.stockEffect || null)
        .input('note', sql.NVarChar(250), item.note || null)
        .query(`
          UPDATE dbo.purchase_invoice_items
          SET
            product_id = @productId,
            stock_code_snapshot = @stockCode,
            barcode_snapshot = @barcode,
            product_name_snapshot = @productName,
            quantity = @quantity,
            currency_code = @currency,
            purchase_price = @purchasePrice,
            line_discount_rate = @lineDiscountRate,
            line_total = @lineTotal,
            line_total_try = @lineTotalTry,
            stock_effect_snapshot = @stockEffect,
            note = @note
          WHERE id = @itemId;
        `);
    } else {
      await insertPurchaseItem(sqlDriver, transaction, invoiceId, item);
    }
  }

  for (const obsoleteRow of existingRows.slice(items.length)) {
    await new sqlDriver.Request(transaction)
      .input('obsoletePurchaseItemId', sql.BigInt, obsoleteRow.id)
      .query('DELETE FROM dbo.purchase_invoice_items WHERE id = @obsoletePurchaseItemId;');
  }
}

async function insertPurchaseItem(sqlDriver, transaction, invoiceId, item) {
  await new sqlDriver.Request(transaction)
    .input('invoiceId', sql.BigInt, invoiceId)
    .input('productId', sql.BigInt, item.productId)
    .input('stockCode', sql.NVarChar(50), item.stockCode)
    .input('barcode', sql.NVarChar(80), item.barcode || null)
    .input('productName', sql.NVarChar(250), item.productName)
    .input('quantity', sql.Decimal(18, 3), item.quantity)
    .input('currency', sql.NVarChar(3), item.currency)
    .input('purchasePrice', sql.Decimal(18, 4), item.purchasePrice)
    .input('lineDiscountRate', sql.Decimal(9, 4), item.lineDiscountRate)
    .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
    .input('lineTotalTry', sql.Decimal(18, 4), item.lineTotalTry)
    .input('stockEffect', sql.NVarChar(50), item.stockEffect || null)
    .input('note', sql.NVarChar(250), item.note || null)
    .query(`
      INSERT INTO dbo.purchase_invoice_items (
        purchase_invoice_id,
        product_id,
        stock_code_snapshot,
        barcode_snapshot,
        product_name_snapshot,
        quantity,
        currency_code,
        purchase_price,
        line_discount_rate,
        line_total,
        line_total_try,
        stock_effect_snapshot,
        note
      )
      VALUES (
        @invoiceId,
        @productId,
        @stockCode,
        @barcode,
        @productName,
        @quantity,
        @currency,
        @purchasePrice,
        @lineDiscountRate,
        @lineTotal,
        @lineTotalTry,
        @stockEffect,
        @note
      );
    `);
}

function quantityByProduct(items = []) {
  const quantities = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    quantities.set(productId, safeNumber(quantities.get(productId)) + safeNumber(item.quantity));
  }
  return quantities;
}

async function applyFinalizedStockDifference(sqlDriver, transaction, beforeItems, afterItems, direction) {
  const before = quantityByProduct(beforeItems);
  const after = quantityByProduct(afterItems);
  const productIds = new Set([...before.keys(), ...after.keys()]);

  for (const productId of productIds) {
    const oldQuantity = safeNumber(before.get(productId));
    const newQuantity = safeNumber(after.get(productId));
    const stockDifference = direction === 'sale'
      ? oldQuantity - newQuantity
      : newQuantity - oldQuantity;

    if (stockDifference === 0) continue;

    await new sqlDriver.Request(transaction)
      .input('correctionStockProductId', sql.BigInt, productId)
      .input('correctionStockDifference', sql.Decimal(18, 3), stockDifference)
      .query(`
        UPDATE dbo.products
        SET
          current_stock_qty = current_stock_qty + @correctionStockDifference,
          updated_at = SYSUTCDATETIME()
        WHERE id = @correctionStockProductId;
      `);
  }

  return productIds;
}

async function replaceFinalizedSalesEffects(sqlDriver, transaction, invoiceId, beforeSnapshot, draft, actor) {
  if (Number(beforeSnapshot.customerId) !== Number(draft.customerId)
    || normalizeCurrency(beforeSnapshot.customerCurrency) !== draft.customerCurrency
    || normalizeCurrency(beforeSnapshot.documentCurrency) !== draft.documentCurrency) {
    throw makeServiceError(
      'SALES_FINALIZED_IDENTITY_LOCKED',
      'Kesinlesmis satis fisinde cari ve para birimi degistirilemez',
      409,
    );
  }

  await applyFinalizedStockDifference(sqlDriver, transaction, beforeSnapshot.items, draft.items, 'sale');
  await new sqlDriver.Request(transaction)
    .input('salesCorrectionInvoiceId', sql.BigInt, invoiceId)
    .query(`
      DELETE FROM dbo.stock_movements
      WHERE source_type = N'sales_invoice'
        AND source_id = @salesCorrectionInvoiceId
        AND movement_type = N'out';
    `);

  const afterSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);
  const currencyRateMap = await readCurrencyRateMap(new sqlDriver.Request(transaction));
  let estimatedProfitTry = 0;
  let profitCostUnknown = false;

  for (const item of afterSnapshot.items) {
    const amountTry = safeNumber(item.lineTotal) * safeNumber(draft.exchangeRate, 1);
    const averageCostTry = resolveSalesUnitCostTry(item, draft.documentCurrency, draft.exchangeRate, currencyRateMap);
    const profit = calculateSalesProfitSnapshot({
      salesAmountTry: amountTry,
      averageCostTry,
      quantity: safeNumber(item.quantity),
    });
    if (profit.grossProfitTry == null) profitCostUnknown = true;
    else estimatedProfitTry += profit.grossProfitTry;

    await new sqlDriver.Request(transaction)
      .input('salesCorrectionItemId', sql.BigInt, item.id)
      .input('salesCorrectionAverageCost', sql.Decimal(18, 4), averageCostTry)
      .input('salesCorrectionProfit', sql.Decimal(18, 4), profit.grossProfitTry)
      .input('salesCorrectionProfitRate', sql.Decimal(18, 6), profit.grossProfitRate)
      .query(`
        UPDATE dbo.sales_invoice_items
        SET
          average_cost_try_snapshot = @salesCorrectionAverageCost,
          gross_profit_try = @salesCorrectionProfit,
          gross_profit_rate = @salesCorrectionProfitRate
        WHERE id = @salesCorrectionItemId;
      `);

    await new sqlDriver.Request(transaction)
      .input('salesCorrectionProductId', sql.BigInt, item.productId)
      .input('salesCorrectionSourceId', sql.BigInt, invoiceId)
      .input('salesCorrectionQuantity', sql.Decimal(18, 3), item.quantity)
      .input('salesCorrectionUnitCost', sql.Decimal(18, 4), averageCostTry)
      .input('salesCorrectionUnitPrice', sql.Decimal(18, 4), item.unitPrice)
      .input('salesCorrectionCurrency', sql.NVarChar(3), item.currency)
      .input('salesCorrectionAmountTry', sql.Decimal(18, 4), amountTry)
      .input('salesCorrectionDate', sql.Date, draft.documentDate)
      .input('salesCorrectionCustomerId', sql.BigInt, draft.customerId)
      .input('salesCorrectionCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.stock_movements (
          product_id, movement_type, source_type, source_id, quantity_in, quantity_out,
          quantity_net, unit_cost_try, average_cost_try_after, document_date, customer_id,
          created_at, created_by, unit_price, currency_code, amount_try
        ) VALUES (
          @salesCorrectionProductId, N'out', N'sales_invoice', @salesCorrectionSourceId, 0,
          @salesCorrectionQuantity, -@salesCorrectionQuantity, @salesCorrectionUnitCost,
          @salesCorrectionUnitCost, @salesCorrectionDate, @salesCorrectionCustomerId,
          SYSUTCDATETIME(), @salesCorrectionCreatedBy, @salesCorrectionUnitPrice,
          @salesCorrectionCurrency, @salesCorrectionAmountTry
        );
      `);
  }

  const settlement = settlementFromInvoice(draft);
  const balanceDifference = Number((settlement.accountAmount - settlementFromInvoice(beforeSnapshot).accountAmount).toFixed(4));
  await new sqlDriver.Request(transaction)
    .input('salesCorrectionCustomerId', sql.BigInt, draft.customerId)
    .input('salesCorrectionBalanceDifference', sql.Decimal(18, 4), balanceDifference)
    .input('salesCorrectionInvoiceId', sql.BigInt, invoiceId)
    .input('salesCorrectionAmount', sql.Decimal(18, 4), draft.grandTotal)
    .input('salesCorrectionCurrency', sql.NVarChar(3), draft.documentCurrency)
    .input('salesCorrectionDate', sql.Date, draft.documentDate)
    .query(`
      UPDATE dbo.customers
      SET balance = balance + @salesCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
      WHERE id = @salesCorrectionCustomerId;

      UPDATE dbo.customer_movements
      SET
        amount = @salesCorrectionAmount,
        currency_code = @salesCorrectionCurrency,
        balance_effect = @salesCorrectionAmount,
        document_date = @salesCorrectionDate
      WHERE sales_invoice_id = @salesCorrectionInvoiceId
        AND movement_type = N'sales_invoice';
    `);

  await stampInvoiceMovement(sqlDriver, transaction, 'sales', invoiceId, 'sales_invoice', settlement, 1);

  if (isCashCustomerCode(beforeSnapshot.customerCode)) {
    await assertOpenSaleCashCollection(sqlDriver, transaction, beforeSnapshot);
    await new sqlDriver.Request(transaction)
      .input('cashCorrectionInvoiceId', sql.BigInt, invoiceId)
      .input('cashCorrectionCustomerId', sql.BigInt, draft.customerId)
      .input('cashCorrectionAmount', sql.Decimal(18, 4), draft.grandTotal)
      .input('cashCorrectionBalanceDifference', sql.Decimal(18, 4), balanceDifference)
      .input('cashCorrectionCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('cashCorrectionDate', sql.Date, draft.documentDate)
      .query(`
        DECLARE @cashMovementId BIGINT;
        DECLARE @cashAccountId BIGINT;

        SELECT TOP (1) @cashMovementId = id
        FROM dbo.customer_movements
        WHERE sales_invoice_id = @cashCorrectionInvoiceId AND movement_type = N'collection';

        SELECT TOP (1) @cashAccountId = account_id
        FROM dbo.finance_account_movements
        WHERE source_type = N'collection' AND party_type = N'customer' AND party_movement_id = @cashMovementId;

        UPDATE dbo.customer_movements
        SET
          amount = @cashCorrectionAmount,
          currency_code = @cashCorrectionCurrency,
          balance_effect = -@cashCorrectionAmount,
          document_date = @cashCorrectionDate
        WHERE id = @cashMovementId;

        UPDATE dbo.customers
        SET balance = balance - @cashCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
        WHERE id = @cashCorrectionCustomerId;

        UPDATE dbo.finance_account_movements
        SET amount = @cashCorrectionAmount, currency_code = @cashCorrectionCurrency, document_date = @cashCorrectionDate
        WHERE source_type = N'collection' AND party_type = N'customer' AND party_movement_id = @cashMovementId;

        UPDATE dbo.finance_accounts
        SET current_balance = current_balance + @cashCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
        WHERE id = @cashAccountId;
      `);
  }

  if (isCashCustomerCode(beforeSnapshot.customerCode)) await stampInvoiceMovement(sqlDriver, transaction, 'sales', invoiceId, 'collection', settlement, -1);

  await new sqlDriver.Request(transaction)
    .input('salesCorrectionProfitInvoiceId', sql.BigInt, invoiceId)
    .input('salesCorrectionEstimatedProfit', sql.Decimal(18, 4), profitCostUnknown ? null : estimatedProfitTry)
    .query(`
      UPDATE dbo.sales_invoices
      SET estimated_profit_try = @salesCorrectionEstimatedProfit
      WHERE id = @salesCorrectionProfitInvoiceId;
    `);
}

async function replaceFinalizedPurchaseEffects(sqlDriver, transaction, invoiceId, beforeSnapshot, draft, supplierId, actor) {
  if (Number(beforeSnapshot.supplierId) !== Number(supplierId)
    || normalizeCurrency(beforeSnapshot.supplierCurrency) !== draft.supplierCurrency
    || normalizeCurrency(beforeSnapshot.documentCurrency) !== draft.documentCurrency) {
    throw makeServiceError(
      'PURCHASE_FINALIZED_IDENTITY_LOCKED',
      'Kesinlesmis alis fisinde tedarikci ve para birimi degistirilemez',
      409,
    );
  }

  const affectedProductIds = await applyFinalizedStockDifference(
    sqlDriver,
    transaction,
    beforeSnapshot.items,
    draft.items,
    'purchase',
  );

  await new sqlDriver.Request(transaction)
    .input('purchaseCorrectionInvoiceId', sql.BigInt, invoiceId)
    .query(`
      DELETE FROM dbo.stock_movements
      WHERE source_type = N'purchase_invoice'
        AND source_id = @purchaseCorrectionInvoiceId
        AND movement_type = N'in';
    `);

  const afterSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);
  for (const item of afterSnapshot.items) {
    const amountTry = purchaseLineCostTry(item, draft.exchangeRate);
    const unitCostTry = safeNumber(item.quantity) > 0 ? amountTry / safeNumber(item.quantity) : 0;
    await new sqlDriver.Request(transaction)
      .input('purchaseCorrectionProductId', sql.BigInt, item.productId)
      .input('purchaseCorrectionSourceId', sql.BigInt, invoiceId)
      .input('purchaseCorrectionQuantity', sql.Decimal(18, 3), item.quantity)
      .input('purchaseCorrectionUnitCost', sql.Decimal(18, 4), unitCostTry)
      .input('purchaseCorrectionUnitPrice', sql.Decimal(18, 4), item.purchasePrice)
      .input('purchaseCorrectionCurrency', sql.NVarChar(3), item.currency)
      .input('purchaseCorrectionAmountTry', sql.Decimal(18, 4), amountTry)
      .input('purchaseCorrectionDate', sql.Date, draft.documentDate)
      .input('purchaseCorrectionSupplierId', sql.BigInt, supplierId)
      .input('purchaseCorrectionCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.stock_movements (
          product_id, movement_type, source_type, source_id, quantity_in, quantity_out,
          quantity_net, unit_cost_try, average_cost_try_after, document_date, supplier_id,
          created_at, created_by, unit_price, currency_code, amount_try
        ) VALUES (
          @purchaseCorrectionProductId, N'in', N'purchase_invoice', @purchaseCorrectionSourceId,
          @purchaseCorrectionQuantity, 0, @purchaseCorrectionQuantity, @purchaseCorrectionUnitCost,
          @purchaseCorrectionUnitCost, @purchaseCorrectionDate, @purchaseCorrectionSupplierId,
          SYSUTCDATETIME(), @purchaseCorrectionCreatedBy, @purchaseCorrectionUnitPrice,
          @purchaseCorrectionCurrency, @purchaseCorrectionAmountTry
        );
      `);
  }

  const settlement = settlementFromInvoice(draft);
  const balanceDifference = Number((settlement.accountAmount - settlementFromInvoice(beforeSnapshot).accountAmount).toFixed(4));
  await new sqlDriver.Request(transaction)
    .input('purchaseCorrectionSupplierId', sql.BigInt, supplierId)
    .input('purchaseCorrectionBalanceDifference', sql.Decimal(18, 4), balanceDifference)
    .input('purchaseCorrectionInvoiceId', sql.BigInt, invoiceId)
    .input('purchaseCorrectionAmount', sql.Decimal(18, 4), draft.grandTotal)
    .input('purchaseCorrectionCurrency', sql.NVarChar(3), draft.documentCurrency)
    .input('purchaseCorrectionDate', sql.Date, draft.documentDate)
    .query(`
      UPDATE dbo.suppliers
      SET balance = balance + @purchaseCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
      WHERE id = @purchaseCorrectionSupplierId;

      UPDATE dbo.supplier_movements
      SET
        amount = @purchaseCorrectionAmount,
        currency_code = @purchaseCorrectionCurrency,
        balance_effect = @purchaseCorrectionAmount,
        document_date = @purchaseCorrectionDate
      WHERE purchase_invoice_id = @purchaseCorrectionInvoiceId
        AND movement_type = N'purchase_invoice';
    `);

  await stampInvoiceMovement(sqlDriver, transaction, 'purchase', invoiceId, 'purchase_invoice', settlement, 1);

  for (const productId of affectedProductIds) {
    await recalculateProductAverageCostTry(sqlDriver, transaction, productId, actor);
  }
}

export async function assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, supplierId, items) {
  const dailyWeb = isDailyWebRequest();
  const copy=isIsolatedOperationCopyRuntime()?isolatedCopyTransactionContext(transaction):null;
  if(copy&&(copy!==getIsolatedOperationCopyConfig()||!copy.suppliers.some(s=>s.id===String(supplierId)&&(copy.target.database===BUSINESS_COPY_DATABASE?s.accountId===getBusinessInboundSelection(copy)?.accountId:s.currency==='TRY'))||!items.length||items.some(i=>!copy.products.some(p=>p.id===String(i.productId)))))throw makeServiceError('PURCHASE_PRODUCT_SUPPLIER_MISMATCH','Mal kabulün ürün veya tedarikçi kapsamı değişti.',409);
  for (const [index, item] of items.entries()) {
    const result = await new sqlDriver.Request(transaction)
      .input('purchaseSupplierCheckProductId', sql.BigInt, item.productId)
      .query(`
        SELECT TOP (1)
          id,
          stock_code,
          name,
          supplier_id,
          is_active
        FROM dbo.products WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @purchaseSupplierCheckProductId
          AND is_deleted = 0;
      `);

    const product = result.recordset?.[0];

    if (!product) {
      throw makeServiceError('PURCHASE_PRODUCT_NOT_FOUND', `items[${index}].productId not found`, 400);
    }

    if ((dailyWeb||copy) && !product.is_active) {
      throw makeServiceError('PURCHASE_PRODUCT_INACTIVE', `Product ${product.stock_code || item.productId} is inactive`, 400);
    }

    // Main supplier is a card default, not a restriction on the actual purchase.
    if(copy&&!copy.products.some(p=>p.id===String(product.id)&&p.stockCode===product.stock_code))throw makeServiceError('PURCHASE_PRODUCT_SUPPLIER_MISMATCH','Mal kabul ürününün kaynak kimliği değişti.',409);
    if (!dailyWeb && !copy && String(product.supplier_id || '') !== String(supplierId)) {
      throw makeServiceError(
        'PURCHASE_PRODUCT_SUPPLIER_MISMATCH',
        `Product ${product.stock_code || item.productId} does not belong to selected supplier`,
        400,
      );
    }
  }
}

async function assertDailyPurchaseSupplierCurrency(sqlDriver, transaction, supplierId, documentCurrency, supplierCurrency) {
  if (!isDailyWebRequest()) return;

  const result = await new sqlDriver.Request(transaction)
    .input('dailyPurchaseSupplierId', sql.BigInt, supplierId)
    .query(`
      SELECT TOP (1) currency_code, is_active, is_deleted
      FROM dbo.suppliers WITH (UPDLOCK, HOLDLOCK)
      WHERE id = @dailyPurchaseSupplierId;
    `);
  const supplier = result.recordset?.[0];
  if (!supplier || !supplier.is_active || supplier.is_deleted) {
    throw makeServiceError('DAILY_WEB_SUPPLIER_UNAVAILABLE', 'Günlük alış için aktif, silinmemiş bir tedarikçi gerekli.', 409);
  }
  if (!VALID_CURRENCIES.has(documentCurrency)) throw makeServiceError("CURRENCY_SETTLEMENT_INVALID", "İşlem dövizi desteklenmiyor.");
  const business=businessInvoiceSelection(transaction,'purchase',supplierId,supplierCurrency);
  if(business){await assertBusinessInvoiceAccount(sqlDriver,transaction,business);if(documentCurrency!==business.currency)throw makeServiceError('ISOLATED_COPY_INVOICE_ACCOUNT_SCOPE','Aynı döviz hesabı gerekli.',409);return;}
  assertDailyWebCurrency(supplier.currency_code, supplierCurrency);
}

async function ensureSupplier(sqlDriver, transaction, payload) {
  if (payload.supplierId) {
    return payload.supplierId;
  }

  const supplierName = payload.supplierName || 'Draft Supplier';
  const supplierCode = `DRAFT-${supplierName.replace(/[^A-Za-z0-9]/g, '').slice(0, 18).toUpperCase() || 'SUPPLIER'}`;
  const lookup = await new sqlDriver.Request(transaction)
    .input('supplierCode', sql.NVarChar(50), supplierCode)
    .query(`
      SELECT TOP (1) id
      FROM dbo.suppliers
      WHERE supplier_code = @supplierCode;
    `);

  if (lookup.recordset?.[0]?.id) {
    return Number(lookup.recordset[0].id);
  }

  const insert = await new sqlDriver.Request(transaction)
    .input('supplierCode', sql.NVarChar(50), supplierCode)
    .input('supplierName', sql.NVarChar(250), supplierName)
    .input('currency', sql.NVarChar(3), payload.supplierCurrency)
    .query(`
      INSERT INTO dbo.suppliers (
        supplier_code,
        name,
        currency_code,
        balance,
        is_active,
        is_deleted
      )
      OUTPUT INSERTED.id AS supplierId
      VALUES (
        @supplierCode,
        @supplierName,
        @currency,
        0,
        1,
        0
      );
    `);

  return Number(insert.recordset?.[0]?.supplierId);
}

export async function getSalesDraft(id, transactionContext = null) {
  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_DRAFT_ID_INVALID', 'Sales draft id is invalid');
  }

  const pool = transactionContext?.pool || await getSqlPool();
  const snapshot = await getSalesSnapshot(transactionContext?.transaction
    ? new transactionContext.sqlDriver.Request(transactionContext.transaction) : pool.request(), invoiceId);

  if (!snapshot) {
    throw makeServiceError('SALES_DRAFT_NOT_FOUND', 'Sales draft not found', 404);
  }

  return snapshot;
}

export async function getSalesDraftsList(query) {
  const options = parseDraftListQuery(query, 'customer');

  if (options.status === 'unsupported') {
    return {
      data: [],
      meta: buildListMeta({
        ...options,
        total: 0,
        source: 'sql-select-only',
        filters: {
          search: options.search || null,
          status: 'DRAFT',
          customer: options.partySearch || null,
          customerId: options.partyId,
        },
      }),
    };
  }

  const pool = await getSqlPool();
  const personnelReady = await hasPersonnelSalesSchema(pool.request());
  const ownershipColumns = personnelReady
    ? `td.device_code AS terminal_code,
        si.employee_id,
        e.full_name AS employee_name,`
    : `CAST(NULL AS NVARCHAR(80)) AS terminal_code,
        CAST(NULL AS BIGINT) AS employee_id,
        CAST(NULL AS NVARCHAR(150)) AS employee_name,`;
  const ownershipJoins = personnelReady
    ? `LEFT JOIN dbo.terminal_devices td ON td.id = si.terminal_device_id
       LEFT JOIN dbo.employees e ON e.id = si.employee_id`
    : '';
  const ownershipFilters = personnelReady
    ? `AND (
         @employeeSearch IS NULL
         OR ${sqlNormalizedLike('e.full_name', '@employeeSearch')}
       )
       AND (
         @terminalSearch IS NULL
         OR ${sqlNormalizedLike('td.device_code', '@terminalSearch')}
       )`
    : 'AND @employeeSearch IS NULL AND @terminalSearch IS NULL';
  const request = pool.request()
    .input('search', sql.NVarChar(160), toSearchPattern(options.search))
    .input('customerSearch', sql.NVarChar(160), toSearchPattern(options.partySearch))
    .input('customerId', sql.BigInt, options.partyId)
    .input('status', sql.NVarChar(20), options.status === 'all' ? null : options.status)
    .input('dateFrom', sql.Date, options.dateFrom)
    .input('dateTo', sql.Date, options.dateTo)
    .input('currency', sql.NVarChar(3), options.currency)
    .input('amountMin', sql.Decimal(18, 4), options.amountMin)
    .input('amountMax', sql.Decimal(18, 4), options.amountMax)
    .input('employeeSearch', sql.NVarChar(160), toSearchPattern(options.employeeSearch))
    .input('terminalSearch', sql.NVarChar(160), toSearchPattern(options.terminalSearch))
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_sales AS (
      SELECT
        si.id,
        si.document_no AS invoice_no,
        si.customer_id,
        c.name AS customer_name,
        ${ownershipColumns}
        si.document_currency AS currency_code,
        si.grand_total AS total_amount,
        CASE WHEN COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE si.status END AS status,
        si.document_date,
        si.created_at,
        si.updated_at,
        item_counts.item_count
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      ${ownershipJoins}
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS item_count
        FROM dbo.sales_invoice_items sii
        WHERE sii.sales_invoice_id = si.id
      ) item_counts
      WHERE
        (
          (@status IS NULL AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
          OR (@status = N'archived_test' AND COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%')
          OR (@status IS NOT NULL AND @status <> N'archived_test' AND si.status = @status AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
        )
        AND (@customerId IS NULL OR si.customer_id = @customerId)
        AND (@dateFrom IS NULL OR si.document_date >= @dateFrom)
        AND (@dateTo IS NULL OR si.document_date <= @dateTo)
        AND (@currency IS NULL OR si.document_currency = @currency)
        AND (@amountMin IS NULL OR si.grand_total >= @amountMin)
        AND (@amountMax IS NULL OR si.grand_total <= @amountMax)
        AND (
          @search IS NULL
          OR ${sqlNormalizedLike('si.document_no')}
          OR ${sqlNormalizedLike('c.name')}
          OR ${sqlNormalizedLike('c.customer_code')}
          OR EXISTS (
            SELECT 1
            FROM dbo.sales_invoice_items search_item
            WHERE search_item.sales_invoice_id = si.id
              AND (
                ${sqlNormalizedLike('search_item.stock_code_snapshot')}
                OR ${sqlNormalizedLike('search_item.barcode_snapshot')}
                OR ${sqlNormalizedLike('search_item.product_name_snapshot')}
              )
          )
        )
        AND (
          @customerSearch IS NULL
          OR ${sqlNormalizedLike('c.name', '@customerSearch')}
          OR ${sqlNormalizedLike('c.customer_code', '@customerSearch')}
        )
        ${ownershipFilters}
    ),
    numbered_sales AS (
      SELECT
        fs.*,
        ROW_NUMBER() OVER (ORDER BY fs.created_at DESC, fs.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_sales fs
    )
    SELECT TOP (${options.limit}) ns.*
    FROM numbered_sales ns
    WHERE ns.row_number > @offset
    ORDER BY ns.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toSalesListDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-select-only',
      filters: {
        search: options.search || null,
        status: options.status,
        customer: options.partySearch || null,
        customerId: options.partyId,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        currency: options.currency,
        amountMin: options.amountMin,
        amountMax: options.amountMax,
        employee: options.employeeSearch || null,
        terminal: options.terminalSearch || null,
      },
    }),
  };
}

export async function createSalesDraft(payload, actor = null, transactionContext = null) {
  assertMelisaWriteEnabled();

  const draft = normalizeSalesPayload(payload);
  const pool = transactionContext?.pool || await getSqlPool();
  const sqlDriver = transactionContext?.sqlDriver || getSqlDriver();
  const ownsTransaction = !transactionContext?.transaction;
  const transaction = transactionContext?.transaction || new sqlDriver.Transaction(pool);

  if (ownsTransaction) await transaction.begin();

  try {
    await assertOperationQuarantineAllowed(invoiceQuarantineEntities('sales',draft),quarantineTransactionContext(sqlDriver,transaction));
    const personnelReady = await hasPersonnelSalesSchema(new sqlDriver.Request(transaction));
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Satış fişi taslak kaydı');
    const selectedSale=assertSelectedSaleInvocation(transaction,'sale_draft',actor,null,draft);
    if(selectedSale)await assertBusinessInvoiceAccount(sqlDriver,transaction,selectedSale);
    else await assertPilotCashCustomer(new sqlDriver.Request(transaction), draft.customerId, draft.documentCurrency);
    preserveSelectedSourceSalesNames(payload,draft,selectedSale);
    if(selectedSale&&draft.items.length>1)selectedSourceSalesItemsJSON(draft.items,selectedSale);
    const settlement = await prepareInvoiceCurrency(sqlDriver, transaction, 'sales', draft);
    await assertPilotSaleProducts(() => new sqlDriver.Request(transaction), draft.items);

    const insert = await new sqlDriver.Request(transaction)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('customerId', sql.BigInt, draft.customerId)
      .input('terminalDeviceId', sql.BigInt, draft.terminalDeviceId)
      .input('employeeId', sql.BigInt, draft.employeeId)
      .input('customerCurrency', sql.NVarChar(3), draft.customerCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('initialSalesAccountCurrency',sql.NVarChar(3),settlement.accountCurrency)
      .input('initialSalesAccountAmount',sql.Decimal(18,4),settlement.accountAmount)
      .input('initialSalesAccountRate',sql.Decimal(18,8),settlement.accountRateToTry)
      .input('initialSalesActor',sql.BigInt,selectedSale?selectedSale.scope.actorId:null)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('discountRate', sql.Decimal(9, 4), draft.discountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('estimatedProfitTry', sql.Decimal(18, 4), draft.estimatedProfitTry)
      .query(`
        DECLARE @createdSalesIds TABLE(invoiceId bigint);
        INSERT INTO dbo.sales_invoices (
          document_no,
          document_date,
          customer_id,
          ${personnelReady ? 'terminal_device_id, employee_id,' : ''}
          status,
          customer_currency,
          document_currency,
          exchange_rate_snapshot,
          ${selectedSale ? 'account_currency, account_amount, account_exchange_rate_snapshot,' : ''}
          description,
          subtotal,
          discount_rate,
          discount_total,
          grand_total,
          amount_try,
          estimated_profit_try,
          created_by,
          updated_by
        )
        OUTPUT INSERTED.id INTO @createdSalesIds(invoiceId)
        VALUES (
          @documentNo,
          @documentDate,
          @customerId,
          ${personnelReady ? '@terminalDeviceId, @employeeId,' : ''}
          N'draft',
          @customerCurrency,
          @documentCurrency,
          @exchangeRate,
          ${selectedSale ? '@initialSalesAccountCurrency, @initialSalesAccountAmount, @initialSalesAccountRate,' : ''}
          @description,
          @subtotal,
          @discountRate,
          @discountTotal,
          @grandTotal,
          @amountTry,
          @estimatedProfitTry,
          ${selectedSale ? '@initialSalesActor' : 'NULL'},
          ${selectedSale ? '@initialSalesActor' : 'NULL'}
        );
        SELECT invoiceId FROM @createdSalesIds;
      `);

    const invoiceId = Number(insert.recordset?.[0]?.invoiceId);
    await writeInvoiceCurrencySnapshot(new sqlDriver.Request(transaction), 'sales', invoiceId, settlement);

    if(selectedSale&&draft.items.length>1)await insertSelectedSourceSalesItems(sqlDriver,transaction,invoiceId,draft.items,selectedSale);
    else for (const item of draft.items) {
      await insertSalesItem(sqlDriver, transaction, invoiceId, item);
    }

    const afterSnapshot = await getSalesSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_draft_created',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      afterSnapshot,
      actor,
    });

    if (ownsTransaction) await transaction.commit();

    return ownsTransaction ? getSalesDraft(invoiceId) : afterSnapshot;
  } catch (error) {
    if (ownsTransaction) await transaction.rollback();
    throw error;
  }
}

export async function updateSalesDraft(id, payload, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_DRAFT_ID_INVALID', 'Sales draft id is invalid');
  }

  const draft = normalizeSalesPayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getSalesFinalizeSnapshot(
      new sqlDriver.Request(transaction),
      invoiceId,
      { lockHeader: true },
    );

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_DRAFT_NOT_FOUND', 'Sales draft not found', 404);
    }
    await assertOperationQuarantineAllowed([...invoiceQuarantineEntities('sales',beforeSnapshot),...invoiceQuarantineEntities('sales',draft)],quarantineTransactionContext(sqlDriver,transaction));

    await assertWebInvoiceMutationSupported(new sqlDriver.Request(transaction), invoiceId);
    await assertInvoiceHasNoReturns(() => new sqlDriver.Request(transaction), 'sales', invoiceId, { mutation: 'correction' });
    await assertInvoiceNotExported(invoiceId);
    if (!['DRAFT', 'FINALIZED'].includes(beforeSnapshot.status)) {
      throw makeServiceError('SALES_DRAFT_STATUS_INVALID', 'Only DRAFT or FINALIZED sales invoices can be corrected', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Satış fişi düzeltme');
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Satış fişi düzeltme');
    await assertPilotCashCustomer(new sqlDriver.Request(transaction), draft.customerId, draft.documentCurrency);
    const settlement = await prepareInvoiceCurrency(sqlDriver, transaction, 'sales', draft, beforeSnapshot);
    await assertPilotSaleProducts(() => new sqlDriver.Request(transaction), draft.items, {
      consume: beforeSnapshot.status === 'FINALIZED',
      previousItems: beforeSnapshot.status === 'FINALIZED' ? beforeSnapshot.items : [],
    });

    await new sqlDriver.Request(transaction)
      .input('invoiceId', sql.BigInt, invoiceId)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('customerId', sql.BigInt, draft.customerId)
      .input('customerCurrency', sql.NVarChar(3), draft.customerCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('discountRate', sql.Decimal(9, 4), draft.discountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('estimatedProfitTry', sql.Decimal(18, 4), draft.estimatedProfitTry)
      .query(`
        UPDATE dbo.sales_invoices
        SET
          document_no = @documentNo,
          document_date = @documentDate,
          customer_id = @customerId,
          customer_currency = @customerCurrency,
          document_currency = @documentCurrency,
          exchange_rate_snapshot = @exchangeRate,
          description = @description,
          subtotal = @subtotal,
          discount_rate = @discountRate,
          discount_total = @discountTotal,
          grand_total = @grandTotal,
          amount_try = @amountTry,
          estimated_profit_try = @estimatedProfitTry,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @invoiceId
          AND status IN (N'draft', N'finalized');
      `);

    await writeInvoiceCurrencySnapshot(new sqlDriver.Request(transaction), 'sales', invoiceId, settlement);
    await updateSalesItems(sqlDriver, transaction, invoiceId, draft.items);

    if (beforeSnapshot.status === 'FINALIZED') {
      await replaceFinalizedSalesEffects(sqlDriver, transaction, invoiceId, beforeSnapshot, draft, actor);
    }

    const afterSnapshot = await getSalesSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: beforeSnapshot.status === 'FINALIZED' ? 'sales_invoice_finalized_corrected' : 'sales_invoice_draft_updated',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getSalesDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function finalizeSalesInvoice(id, actor = null, transactionContext = null) {
  assertMelisaWriteEnabled();
  const nativeTransaction = isNativeInvoiceTransaction(transactionContext);

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_FINALIZE_ID_INVALID', 'Sales invoice id is invalid');
  }

  const actorId = typeof actor?.id === 'number' ? actor.id : typeof actor?.id === 'string' && /^[1-9][0-9]*$/.test(actor.id) ? Number(actor.id) : NaN;
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    throw makeServiceError('SALES_FINALIZE_ACTOR_REQUIRED', 'Verified transaction actor is required', 403);
  }

  const pool = transactionContext?.pool || await getSqlPool();
  const ownsTransaction = !transactionContext?.transaction;
  // The terminal caller validates schema before taking its locks. All sale
  // effects and its idempotency record then share the same transaction.
  if (ownsTransaction) {
    await ensureCashCustomers(pool);
    await ensureFinanceAccountTables(pool);
  }
  const sqlDriver = transactionContext?.sqlDriver || getSqlDriver();
  const transaction = transactionContext?.transaction || new sqlDriver.Transaction(pool);

  if (ownsTransaction) await transaction.begin();

  try {
    const beforeSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_FINALIZE_NOT_FOUND', 'Sales invoice not found', 404);
    }
    await assertOperationQuarantineAllowed(invoiceQuarantineEntities('sales',beforeSnapshot),quarantineTransactionContext(sqlDriver,transaction));

    if (beforeSnapshot.status !== 'DRAFT') {
      throw makeServiceError('SALES_FINALIZE_STATUS_INVALID', 'Only DRAFT sales invoices can be finalized', 409);
    }

    await assertCurrencySnapshotSchema(new sqlDriver.Request(transaction), 'customer');
    const settlement = settlementFromInvoice(beforeSnapshot);
    await assertInvoiceSettlementParty(sqlDriver, transaction, 'sales', beforeSnapshot, settlement, { active: true });
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Satış fişi kesinleştirme');
    const selectedSale=assertSelectedSaleInvocation(transaction,'sale_finalize',actor,invoiceId,beforeSnapshot);
    if(selectedSale)await assertBusinessInvoiceAccount(sqlDriver,transaction,selectedSale);
    else await assertPilotCashCustomer(new sqlDriver.Request(transaction), beforeSnapshot.customerId, beforeSnapshot.documentCurrency);
    await assertPilotSaleProducts(() => new sqlDriver.Request(transaction), beforeSnapshot.items, {consume: true, allowNegativeStock: nativeTransaction});

    if (!beforeSnapshot.customerId || !beforeSnapshot.customerName) {
      throw makeServiceError('SALES_FINALIZE_CUSTOMER_INVALID', 'Sales invoice customer is missing', 400);
    }

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('SALES_FINALIZE_ITEMS_REQUIRED', 'Sales invoice must contain at least one item', 400);
    }

    if (Number(beforeSnapshot.grandTotal || 0) < 0) {
      throw makeServiceError('SALES_FINALIZE_TOTAL_INVALID', 'Sales invoice total cannot be negative', 400);
    }

    const cashCustomerCurrency = getCashCustomerCurrency(beforeSnapshot.customerCode);
    if (cashCustomerCurrency && cashCustomerCurrency !== beforeSnapshot.documentCurrency) {
      throw makeServiceError(
        'SALES_FINALIZE_CASH_CUSTOMER_CURRENCY_MISMATCH',
        'Pesin cari para birimi ile fis para birimi ayni olmali',
        400,
      );
    }

    const warnings = [];
    const profitSnapshots = [];
    const selectedFinalizeRows=selectedSale&&beforeSnapshot.items.length>1?[]:null;
    const currencyRateMap = await readCurrencyRateMap(new sqlDriver.Request(transaction));

    for (const item of beforeSnapshot.items) {
      const quantity = safeNumber(item.quantity);
      const currentStock = safeNumber(item.currentStockQty);
      const nextStock = currentStock - quantity;
      const amountTry = safeNumber(item.lineTotal) * safeNumber(beforeSnapshot.exchangeRate, 1);
      const averageCostTrySnapshot = resolveSalesUnitCostTry(
        item,
        beforeSnapshot.documentCurrency,
        beforeSnapshot.exchangeRate,
        currencyRateMap,
      );
      const profitSnapshot = calculateSalesProfitSnapshot({
        salesAmountTry: amountTry,
        averageCostTry: averageCostTrySnapshot,
        quantity,
      });

      profitSnapshots.push({
        itemId: item.id,
        productId: item.productId,
        stockCode: item.stockCode,
        quantity,
        salesAmountTry: amountTry,
        averageCostTrySnapshot,
        grossProfitTry: profitSnapshot.grossProfitTry,
        grossProfitRate: profitSnapshot.grossProfitRate,
      });

      if (nextStock < 0) {
        warnings.push({
          code: 'NEGATIVE_STOCK',
          productId: item.productId,
          stockCode: item.stockCode,
          currentStock,
          quantity,
          projectedStock: nextStock,
        });
      }

      if(selectedFinalizeRows){selectedFinalizeRows.push({...profitSnapshots.at(-1),unitPrice:Number(item.unitPrice||0),currency:item.currency});continue;}

      await new sqlDriver.Request(transaction)
        .input('profitSnapshotItemId', sql.BigInt, item.id)
        .input('profitSnapshotAverageCostTry', sql.Decimal(18, 4), averageCostTrySnapshot)
        .input('profitSnapshotGrossProfitTry', sql.Decimal(18, 4), profitSnapshot.grossProfitTry)
        .input('profitSnapshotGrossProfitRate', sql.Decimal(18, 6), profitSnapshot.grossProfitRate)
        .query(`
          UPDATE dbo.sales_invoice_items
          SET
            average_cost_try_snapshot = @profitSnapshotAverageCostTry,
            gross_profit_try = @profitSnapshotGrossProfitTry,
            gross_profit_rate = @profitSnapshotGrossProfitRate
          WHERE id = @profitSnapshotItemId;
        `);

      await new sqlDriver.Request(transaction)
        .input('productIdForStockUpdate', sql.BigInt, item.productId)
        .input('quantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty - @quantityForStockUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @productIdForStockUpdate;
        `);

      await new sqlDriver.Request(transaction)
        .input('movementProductId', sql.BigInt, item.productId)
        .input('movementSourceId', sql.BigInt, invoiceId)
        .input('movementQuantityOut', sql.Decimal(18, 3), quantity)
        .input('movementQuantityNet', sql.Decimal(18, 3), -quantity)
        .input('movementUnitCostTry', sql.Decimal(18, 4), averageCostTrySnapshot)
        .input('movementUnitPrice', sql.Decimal(18, 4), Number(item.unitPrice || 0))
        .input('movementCurrency', sql.NVarChar(3), item.currency)
        .input('movementAmountTry', sql.Decimal(18, 4), amountTry)
        .input('movementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('movementCustomerId', sql.BigInt, beforeSnapshot.customerId)
        .input('movementCreatedBy', sql.BigInt, actorId)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            customer_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          VALUES (
            @movementProductId,
            N'out',
            N'sales_invoice',
            @movementSourceId,
            0,
            @movementQuantityOut,
            @movementQuantityNet,
            @movementUnitCostTry,
            @movementUnitCostTry,
            @movementDocumentDate,
            @movementCustomerId,
            SYSUTCDATETIME(),
            @movementCreatedBy,
            @movementUnitPrice,
            @movementCurrency,
            @movementAmountTry
          );
        `);
    }

    if(selectedFinalizeRows)await finalizeSelectedSourceSalesItems(sqlDriver,transaction,invoiceId,beforeSnapshot,selectedFinalizeRows,selectedSale,actorId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_profit_snapshot_created',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      afterSnapshot: {
        invoiceId,
        snapshots: profitSnapshots,
      },
      actor,
    });

    const estimatedProfitTry = profitSnapshots.some((snapshot) => snapshot.grossProfitTry == null)
      ? null
      : profitSnapshots.reduce((total, snapshot) => total + snapshot.grossProfitTry, 0);

    if(!await insertIsolatedCopyInvoiceMovement(sqlDriver,transaction,{kind:'sales',invoiceId,movementType:'sales_invoice',snapshot:settlement,direction:1,actor,partyId:beforeSnapshot.customerId,documentDate:beforeSnapshot.documentDate}))await new sqlDriver.Request(transaction)
      .input('customerMovementCustomerId', sql.BigInt, beforeSnapshot.customerId)
      .input('customerMovementInvoiceId', sql.BigInt, invoiceId)
      .input('customerMovementAmount', sql.Decimal(18, 4), Number(beforeSnapshot.grandTotal || 0))
      .input('customerMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('customerMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .input('customerMovementCreatedBy', sql.BigInt, actorId)
      .query(`
        INSERT INTO dbo.customer_movements (
          customer_id,
          sales_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @customerMovementCustomerId,
          @customerMovementInvoiceId,
          N'sales_invoice',
          @customerMovementAmount,
          @customerMovementCurrency,
          @customerMovementAmount,
          @customerMovementDocumentDate,
          SYSUTCDATETIME(),
          @customerMovementCreatedBy
        );
      `);

    await stampInvoiceMovement(sqlDriver, transaction, 'sales', invoiceId, 'sales_invoice', settlement, 1,actor);

    await new sqlDriver.Request(transaction)
      .input('customerBalanceId', sql.BigInt, beforeSnapshot.customerId)
      .input('customerBalanceEffect', sql.Decimal(18, 4), settlement.accountAmount)
      .query(`
        UPDATE dbo.customers
        SET
          balance = balance + @customerBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @customerBalanceId ${selectedSale ? "AND currency_code=N'"+settlement.accountCurrency+"'" : ''};
      `);

    let autoCashCollection = null;

    // Isolated copy sales and collections have separate guarded request UUIDs.
    if (!nativeTransaction && !isIsolatedOperationCopyRuntime() && isCashCustomerCode(beforeSnapshot.customerCode) && Number(beforeSnapshot.grandTotal || 0) > 0) {
      const cashAmount = Number(beforeSnapshot.grandTotal || 0);
      const cashCurrency = beforeSnapshot.documentCurrency;
      const paymentMethod = 'cash';
      const account = await resolveFinanceAccount(transaction, sqlDriver, {
        paymentMethod,
        currency: cashCurrency,
      });

      const cashMovementResult = await new sqlDriver.Request(transaction)
        .input('cashCollectionCustomerId', sql.BigInt, beforeSnapshot.customerId)
        .input('cashCollectionInvoiceId', sql.BigInt, invoiceId)
        .input('cashCollectionAmount', sql.Decimal(18, 4), cashAmount)
        .input('cashCollectionCurrency', sql.NVarChar(3), cashCurrency)
        .input('cashCollectionDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('cashCollectionCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          DECLARE @cashCollectionMovementIds TABLE (id bigint);
          INSERT INTO dbo.customer_movements (
            customer_id,
            sales_invoice_id,
            movement_type,
            amount,
            currency_code,
            balance_effect,
            document_date,
            created_at,
            created_by
          )
          OUTPUT inserted.id INTO @cashCollectionMovementIds(id)
          VALUES (
            @cashCollectionCustomerId,
            @cashCollectionInvoiceId,
            N'collection',
            @cashCollectionAmount,
            @cashCollectionCurrency,
            -@cashCollectionAmount,
            @cashCollectionDocumentDate,
            SYSUTCDATETIME(),
            @cashCollectionCreatedBy
          );

          UPDATE dbo.customers
          SET
            balance = balance - @cashCollectionAmount,
            updated_at = SYSUTCDATETIME()
          WHERE id = @cashCollectionCustomerId;

          SELECT m.* FROM dbo.customer_movements m
          JOIN @cashCollectionMovementIds captured ON captured.id = m.id;
        `);

      const cashMovement = cashMovementResult.recordset?.[0];
      await writeMovementCurrencySnapshot(new sqlDriver.Request(transaction), 'customer', cashMovement.id, settlement, -settlement.accountAmount);
      const updatedAccount = await writeFinanceAccountMovement(transaction, sqlDriver, {
        account,
        sourceType: 'collection',
        partyType: 'customer',
        partyMovementId: cashMovement.id,
        amount: cashAmount,
        currency: cashCurrency,
        paymentMethod,
        documentNo: `PS-${beforeSnapshot.documentNo || invoiceId}`,
        documentDate: beforeSnapshot.documentDate,
        description: `Pesin satis otomatik tahsilat - ${beforeSnapshot.documentNo || invoiceId}`,
        actor,
      });

      autoCashCollection = {
        movementId: Number(cashMovement.id),
        customerId: Number(beforeSnapshot.customerId),
        customerCode: beforeSnapshot.customerCode,
        amount: cashAmount,
        currency: cashCurrency,
        accountId: updatedAccount.id,
        accountCode: updatedAccount.code,
      };
    }

    const finalizeResult = await new sqlDriver.Request(transaction)
      .input('finalizeInvoiceId', sql.BigInt, invoiceId)
      .input('finalizeEstimatedProfitTry', sql.Decimal(18, 4), estimatedProfitTry)
      .query(`
        UPDATE dbo.sales_invoices
        SET
          status = N'finalized',
          estimated_profit_try = @finalizeEstimatedProfitTry,
          finalized_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
        WHERE id = @finalizeInvoiceId
          AND status = N'draft';
      `);

    if (Number(finalizeResult.rowsAffected?.[0] || 0) !== 1) {
      throw makeServiceError('SALES_FINALIZE_STATUS_CHANGED', 'Sales invoice status changed during finalize', 409);
    }

    const afterSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_finalized',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        warnings,
        autoCashCollection,
      },
      actor,
    });

    if (ownsTransaction) await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    if (ownsTransaction) await transaction.rollback();
    throw error;
  }
}

export async function cancelSalesInvoice(id, payload = {}, actor = null, transactionContext = null) {
  assertMelisaWriteEnabled();
  const nativeTransaction = isNativeInvoiceTransaction(transactionContext);
  if ((nativeTransaction || transactionContext?.nativeApproval === true) && (!nativeTransaction || transactionContext.nativeApproval !== true)) {
    throw makeServiceError('NATIVE_CANCEL_APPROVAL_REQUIRED', 'Native fiş iptali doğrulanmış yetkili onayı ve dış işlem bağlamı gerektirir.', 403);
  }

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_CANCEL_ID_INVALID', 'Sales invoice id is invalid');
  }

  const reason = normalizeCancelReason(payload.reason);
  const pool = transactionContext?.pool || await getSqlPool();
  const sqlDriver = transactionContext?.sqlDriver || getSqlDriver();
  const ownsTransaction = !transactionContext?.transaction;
  const transaction = transactionContext?.transaction || new sqlDriver.Transaction(pool);

  if (ownsTransaction) await transaction.begin();

  try {
    const beforeSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_CANCEL_NOT_FOUND', 'Sales invoice not found', 404);
    }
    await assertOperationQuarantineAllowed(invoiceQuarantineEntities('sales',beforeSnapshot),quarantineTransactionContext(sqlDriver,transaction));
    const selectedSale=assertSelectedSaleInvocation(transaction,'sale_cancel',actor,invoiceId,beforeSnapshot);
    if(selectedSale)await assertBusinessInvoiceAccount(sqlDriver,transaction,selectedSale);

    let nativeSale = false;
    if (nativeTransaction) {
      const nativeRows = (await new sqlDriver.Request(transaction).input('nativeApprovedInvoiceId', sql.BigInt, invoiceId).query(`
        SELECT TOP (1) id FROM dbo.terminal_sync_queue
        WHERE event_type=N'invoice_created' AND target_entity=N'sales_invoice' AND target_entity_id=@nativeApprovedInvoiceId
          AND JSON_VALUE(CASE WHEN ISJSON(payload_json)=1 THEN payload_json ELSE N'{}' END,N'$.kind')=N'native_sale_v1';
      `)).recordset || [];
      nativeSale = nativeRows.length > 0;
      if (!nativeSale) throw makeServiceError('NATIVE_CANCEL_SOURCE_REQUIRED', 'Yetkili terminal iptali yalnız kayıtlı Native fişine uygulanabilir.', 409);
    } else {
      await assertWebInvoiceMutationSupported(new sqlDriver.Request(transaction), invoiceId);
    }
    await assertInvoiceNotExported(invoiceId);

    await assertInvoiceHasNoReturns(() => new sqlDriver.Request(transaction), 'sales', invoiceId);
    await assertCurrencySnapshotSchema(new sqlDriver.Request(transaction), 'customer');
    const settlement = settlementFromInvoice(beforeSnapshot);
    await assertInvoiceSettlementParty(sqlDriver, transaction, 'sales', beforeSnapshot, settlement, { active: false });

    if (nativeSale) {
      const collections = (await new sqlDriver.Request(transaction).input('nativeCollectionInvoiceId', sql.BigInt, invoiceId).query(`
        SELECT id FROM dbo.customer_movements WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=@nativeCollectionInvoiceId AND movement_type=N'collection';
      `)).recordset || [];
      if (collections.length) throw makeServiceError('NATIVE_COLLECTION_REVIEW_REQUIRED', 'Bu fişe ERP tahsilatı bağlanmış; tahsilat ERP tarafında incelenmelidir.', 409);
    }

    if (beforeSnapshot.status !== 'FINALIZED') {
      throw makeServiceError('SALES_CANCEL_STATUS_INVALID', 'Only FINALIZED sales invoices can be cancelled', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Satış fişi iptal');

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('SALES_CANCEL_ITEMS_REQUIRED', 'Sales invoice must contain at least one item', 400);
    }

    const warnings = [];
    let reversedStockTotal = 0;

    if(selectedSale)await assertSelectedSaleCashlessCancellation(sqlDriver,transaction,beforeSnapshot);

    for (const item of beforeSnapshot.items) {
      const quantity = safeNumber(item.quantity);
      const amountTry = safeNumber(item.lineTotal) * safeNumber(beforeSnapshot.exchangeRate, 1);
      const averageCostTrySnapshot = item.averageCostTry != null && Number.isFinite(Number(item.averageCostTry))
        && Number(item.averageCostTry) >= 0 ? Number(item.averageCostTry) : null;

      reversedStockTotal += quantity;

      await new sqlDriver.Request(transaction)
        .input('cancelProductIdForStockUpdate', sql.BigInt, item.productId)
        .input('cancelQuantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty + @cancelQuantityForStockUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @cancelProductIdForStockUpdate;
        `);

      await new sqlDriver.Request(transaction)
        .input('cancelMovementProductId', sql.BigInt, item.productId)
        .input('cancelMovementSourceId', sql.BigInt, invoiceId)
        .input('cancelMovementQuantityIn', sql.Decimal(18, 3), quantity)
        .input('cancelMovementQuantityNet', sql.Decimal(18, 3), quantity)
        .input('cancelMovementUnitCostTry', sql.Decimal(18, 4), averageCostTrySnapshot)
        .input('cancelMovementUnitPrice', sql.Decimal(18, 4), Number(item.unitPrice || 0))
        .input('cancelMovementCurrency', sql.NVarChar(3), item.currency)
        .input('cancelMovementAmountTry', sql.Decimal(18, 4), -amountTry)
        .input('cancelMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('cancelMovementCustomerId', sql.BigInt, beforeSnapshot.customerId)
        .input('cancelMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            customer_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          VALUES (
            @cancelMovementProductId,
            N'in',
            N'sales_invoice',
            @cancelMovementSourceId,
            @cancelMovementQuantityIn,
            0,
            @cancelMovementQuantityNet,
            @cancelMovementUnitCostTry,
            @cancelMovementUnitCostTry,
            @cancelMovementDocumentDate,
            @cancelMovementCustomerId,
            SYSUTCDATETIME(),
            @cancelMovementCreatedBy,
            @cancelMovementUnitPrice,
            @cancelMovementCurrency,
            @cancelMovementAmountTry
          );
        `);
    }

    const reversedCustomerAmount = Number(beforeSnapshot.grandTotal || 0);

    if (!selectedSale && !nativeSale && isCashCustomerCode(beforeSnapshot.customerCode) && reversedCustomerAmount > 0) {
      await reverseSaleCashCollection(sqlDriver, transaction, beforeSnapshot, actor, reason);
    }

    if(!await insertIsolatedCopyInvoiceMovement(sqlDriver,transaction,{kind:'sales',invoiceId,movementType:'sales_invoice_cancel',snapshot:settlement,direction:-1,actor,partyId:beforeSnapshot.customerId,documentDate:beforeSnapshot.documentDate}))await new sqlDriver.Request(transaction)
      .input('cancelCustomerMovementCustomerId', sql.BigInt, beforeSnapshot.customerId)
      .input('cancelCustomerMovementInvoiceId', sql.BigInt, invoiceId)
      .input('cancelCustomerMovementAmount', sql.Decimal(18, 4), reversedCustomerAmount)
      .input('cancelCustomerMovementBalanceEffect', sql.Decimal(18, 4), -reversedCustomerAmount)
      .input('cancelCustomerMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('cancelCustomerMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .input('cancelCustomerMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.customer_movements (
          customer_id,
          sales_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @cancelCustomerMovementCustomerId,
          @cancelCustomerMovementInvoiceId,
          N'sales_invoice_cancel',
          @cancelCustomerMovementAmount,
          @cancelCustomerMovementCurrency,
          @cancelCustomerMovementBalanceEffect,
          @cancelCustomerMovementDocumentDate,
          SYSUTCDATETIME(),
          @cancelCustomerMovementCreatedBy
        );
      `);

    await stampInvoiceMovement(sqlDriver, transaction, 'sales', invoiceId, 'sales_invoice_cancel', settlement, -1,actor);

    await new sqlDriver.Request(transaction)
      .input('cancelCustomerBalanceId', sql.BigInt, beforeSnapshot.customerId)
      .input('cancelCustomerBalanceEffect', sql.Decimal(18, 4), settlement.accountAmount)
      .query(`
        UPDATE dbo.customers
        SET
          balance = balance - @cancelCustomerBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @cancelCustomerBalanceId ${selectedSale ? "AND currency_code=N'"+settlement.accountCurrency+"'" : ''};
      `);

    const cancelResult = await new sqlDriver.Request(transaction)
      .input('cancelInvoiceId', sql.BigInt, invoiceId)
      .input('cancelReason', sql.NVarChar(500), reason)
      .input('cancelUpdatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.sales_invoices
        SET
          status = N'cancelled',
          cancelled_at = SYSUTCDATETIME(),
          cancel_reason = @cancelReason,
          updated_at = SYSUTCDATETIME(),
          updated_by = @cancelUpdatedBy
        WHERE id = @cancelInvoiceId
          AND status = N'finalized';
      `);

    if (Number(cancelResult.rowsAffected?.[0] || 0) !== 1) {
      throw makeServiceError('SALES_CANCEL_STATUS_INVALID', 'Sales invoice status changed during cancel', 409);
    }

    const afterSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_cancelled',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        reason,
        reversedStockTotal,
        reversedCustomerAmount,
        warnings,
      },
      actor,
    });

    if (ownsTransaction) await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    if (ownsTransaction) await transaction.rollback();
    throw error;
  }
}

export async function getPurchaseDraft(id, transactionContext = null) {
  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_DRAFT_ID_INVALID', 'Purchase draft id is invalid');
  }

  const pool = transactionContext?.pool || await getSqlPool();
  const snapshot = await getPurchaseSnapshot(transactionContext ? new transactionContext.sqlDriver.Request(transactionContext.transaction) : pool.request(), invoiceId);

  if (!snapshot) {
    throw makeServiceError('PURCHASE_DRAFT_NOT_FOUND', 'Purchase draft not found', 404);
  }

  return snapshot;
}

export async function getPurchaseDraftsList(query) {
  const options = parseDraftListQuery(query, 'supplier');

  if (options.status === 'unsupported') {
    return {
      data: [],
      meta: buildListMeta({
        ...options,
        total: 0,
        source: 'sql-select-only',
        filters: {
          search: options.search || null,
          status: 'DRAFT',
          supplier: options.partySearch || null,
          supplierId: options.partyId,
        },
      }),
    };
  }

  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(160), toSearchPattern(options.search))
    .input('supplierSearch', sql.NVarChar(160), toSearchPattern(options.partySearch))
    .input('supplierId', sql.BigInt, options.partyId)
    .input('status', sql.NVarChar(20), options.status === 'all' ? null : options.status)
    .input('dateFrom', sql.Date, options.dateFrom)
    .input('dateTo', sql.Date, options.dateTo)
    .input('currency', sql.NVarChar(3), options.currency)
    .input('amountMin', sql.Decimal(18, 4), options.amountMin)
    .input('amountMax', sql.Decimal(18, 4), options.amountMax)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_purchase AS (
      SELECT
        pi.id,
        pi.document_no AS invoice_no,
        pi.supplier_id,
        s.name AS supplier_name,
        pi.document_currency AS currency_code,
        pi.grand_total AS total_amount,
        CASE WHEN COALESCE(pi.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE pi.status END AS status,
        pi.document_date,
        pi.created_at,
        pi.updated_at,
        item_counts.item_count
      FROM dbo.purchase_invoices pi
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS item_count
        FROM dbo.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = pi.id
      ) item_counts
      WHERE
        (
          (@status IS NULL AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
          OR (@status = N'archived_test' AND COALESCE(pi.description, N'') LIKE N'%TEST_ARCHIVED%')
          OR (@status IS NOT NULL AND @status <> N'archived_test' AND pi.status = @status AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
        )
        AND (@supplierId IS NULL OR pi.supplier_id = @supplierId)
        AND (@dateFrom IS NULL OR pi.document_date >= @dateFrom)
        AND (@dateTo IS NULL OR pi.document_date <= @dateTo)
        AND (@currency IS NULL OR pi.document_currency = @currency)
        AND (@amountMin IS NULL OR pi.grand_total >= @amountMin)
        AND (@amountMax IS NULL OR pi.grand_total <= @amountMax)
        AND (
          @search IS NULL
          OR ${sqlNormalizedLike('pi.document_no')}
          OR ${sqlNormalizedLike('s.name')}
          OR ${sqlNormalizedLike('s.supplier_code')}
          OR EXISTS (
            SELECT 1
            FROM dbo.purchase_invoice_items search_item
            WHERE search_item.purchase_invoice_id = pi.id
              AND (
                ${sqlNormalizedLike('search_item.stock_code_snapshot')}
                OR ${sqlNormalizedLike('search_item.barcode_snapshot')}
                OR ${sqlNormalizedLike('search_item.product_name_snapshot')}
              )
          )
        )
        AND (
          @supplierSearch IS NULL
          OR ${sqlNormalizedLike('s.name', '@supplierSearch')}
          OR ${sqlNormalizedLike('s.supplier_code', '@supplierSearch')}
        )
    ),
    numbered_purchase AS (
      SELECT
        fp.*,
        ROW_NUMBER() OVER (ORDER BY fp.created_at DESC, fp.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_purchase fp
    )
    SELECT TOP (${options.limit}) np.*
    FROM numbered_purchase np
    WHERE np.row_number > @offset
    ORDER BY np.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toPurchaseListDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-select-only',
      filters: {
        search: options.search || null,
        status: options.status,
        supplier: options.partySearch || null,
        supplierId: options.partyId,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        currency: options.currency,
        amountMin: options.amountMin,
        amountMax: options.amountMax,
      },
    }),
  };
}

export async function createPurchaseDraft(payload, actor = null, transactionContext = null) {
  assertMelisaWriteEnabled();

  const draft = normalizePurchasePayload(payload);
  const pool = transactionContext?.pool || await getSqlPool();
  const sqlDriver = transactionContext?.sqlDriver || getSqlDriver();
  const transaction = transactionContext?.transaction || new sqlDriver.Transaction(pool);

  if (!transactionContext) await transaction.begin();

  try {
    await assertOperationQuarantineAllowed(invoiceQuarantineEntities('purchase',draft),quarantineTransactionContext(sqlDriver,transaction));
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Alış fişi taslak kaydı');

    const supplierId = await ensureSupplier(sqlDriver, transaction, draft);
    draft.supplierId = supplierId;
    await assertOperationQuarantineAllowed([{entity:'supplier',nativeId:supplierId}],quarantineTransactionContext(sqlDriver,transaction));

    const settlement = await prepareInvoiceCurrency(sqlDriver, transaction, 'purchase', draft);
    await assertDailyPurchaseSupplierCurrency(sqlDriver, transaction, supplierId, draft.documentCurrency, draft.supplierCurrency);
    await assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, supplierId, draft.items);
    // The business-copy INSERT guard validates the account snapshot immediately.
    // Bind the already verified settlement before that first guarded header write.
    const initialAccountSnapshot = businessInvoiceSelection(transaction, 'purchase', supplierId, settlement.accountCurrency);
    const insertRequest = new sqlDriver.Request(transaction)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('supplierId', sql.BigInt, supplierId)
      .input('supplierCurrency', sql.NVarChar(3), draft.supplierCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('lineDiscountTotal', sql.Decimal(18, 4), draft.lineDiscountTotal)
      .input('invoiceDiscountRate', sql.Decimal(9, 4), draft.invoiceDiscountRate)
      .input('supplierDiscountRate', sql.Decimal(9, 4), draft.supplierDiscountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('stockCostEffectTry', sql.Decimal(18, 4), draft.stockCostEffectTry);
    if (initialAccountSnapshot) insertRequest
      .input('initialAccountCurrency', sql.NVarChar(3), settlement.accountCurrency)
      .input('initialAccountAmount', sql.Decimal(18, 4), settlement.accountAmount)
      .input('initialAccountRate', sql.Decimal(18, 8), settlement.accountRateToTry);
    const insert = await insertRequest.query(`
        DECLARE @newPurchaseIds TABLE(invoiceId bigint);
        INSERT INTO dbo.purchase_invoices (
          document_no,
          document_date,
          supplier_id,
          status,
          supplier_currency,
          document_currency,
          exchange_rate_snapshot,
          description,
          subtotal,
          line_discount_total,
          invoice_discount_rate,
          supplier_discount_rate,
          discount_total,
          grand_total,
          amount_try,
          stock_cost_effect_try,
          ${initialAccountSnapshot ? 'account_currency, account_amount, account_exchange_rate_snapshot,' : ''}
          created_by,
          updated_by
        )
        OUTPUT INSERTED.id INTO @newPurchaseIds
        VALUES (
          @documentNo,
          @documentDate,
          @supplierId,
          N'draft',
          @supplierCurrency,
          @documentCurrency,
          @exchangeRate,
          @description,
          @subtotal,
          @lineDiscountTotal,
          @invoiceDiscountRate,
          @supplierDiscountRate,
          @discountTotal,
          @grandTotal,
          @amountTry,
          @stockCostEffectTry,
          ${initialAccountSnapshot ? '@initialAccountCurrency, @initialAccountAmount, @initialAccountRate,' : ''}
          NULL,
          NULL
        );
        SELECT invoiceId FROM @newPurchaseIds;
      `);

    const invoiceId = Number(insert.recordset?.[0]?.invoiceId);
    await writeInvoiceCurrencySnapshot(new sqlDriver.Request(transaction), 'purchase', invoiceId, settlement);
    await writePurchaseDiscountSnapshot(sqlDriver, transaction, invoiceId, draft);

    for (const item of draft.items) {
      await insertPurchaseItem(sqlDriver, transaction, invoiceId, item);
    }

    const afterSnapshot = await getPurchaseSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'purchase_invoice_draft_created',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      afterSnapshot,
      actor,
    });

    if (!transactionContext) await transaction.commit();

    return getPurchaseDraft(invoiceId, transactionContext);
  } catch (error) {
    if (!transactionContext) await transaction.rollback();
    throw error;
  }
}

export async function updatePurchaseDraft(id, payload, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_DRAFT_ID_INVALID', 'Purchase draft id is invalid');
  }

  const draft = normalizePurchasePayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getPurchaseFinalizeSnapshot(
      new sqlDriver.Request(transaction),
      invoiceId,
      { lockHeader: true },
    );

    if (!beforeSnapshot) {
      throw makeServiceError('PURCHASE_DRAFT_NOT_FOUND', 'Purchase draft not found', 404);
    }
    await assertOperationQuarantineAllowed([...invoiceQuarantineEntities('purchase',beforeSnapshot),...invoiceQuarantineEntities('purchase',draft)],quarantineTransactionContext(sqlDriver,transaction));

    await assertInvoiceHasNoReturns(() => new sqlDriver.Request(transaction), 'purchase', invoiceId, { mutation: 'correction' });
    await assertInvoiceNotExported(invoiceId);
    if (!['DRAFT', 'FINALIZED'].includes(beforeSnapshot.status)) {
      throw makeServiceError('PURCHASE_DRAFT_STATUS_INVALID', 'Only DRAFT or FINALIZED purchase invoices can be corrected', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Alış fişi düzeltme');
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Alış fişi düzeltme');

    const supplierId = await ensureSupplier(sqlDriver, transaction, draft);
    draft.supplierId = supplierId;
    await assertOperationQuarantineAllowed([{entity:'supplier',nativeId:supplierId}],quarantineTransactionContext(sqlDriver,transaction));

    const settlement = await prepareInvoiceCurrency(sqlDriver, transaction, 'purchase', draft, beforeSnapshot);
    await assertDailyPurchaseSupplierCurrency(sqlDriver, transaction, supplierId, draft.documentCurrency, draft.supplierCurrency);
    await assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, supplierId, draft.items);
    const discountReady = await hasPurchaseDiscountSchema(new sqlDriver.Request(transaction));
    if (!discountReady && draft.invoiceDiscountType === 'amount') throw makeServiceError('PURCHASE_DISCOUNT_SCHEMA_REQUIRED', 'Sabit alış indirimi için 0020 kaynak geçişi kurulmalıdır.', 503);

    await new sqlDriver.Request(transaction)
      .input('invoiceId', sql.BigInt, invoiceId)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('supplierId', sql.BigInt, supplierId)
      .input('supplierCurrency', sql.NVarChar(3), draft.supplierCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('lineDiscountTotal', sql.Decimal(18, 4), draft.lineDiscountTotal)
      .input('invoiceDiscountRate', sql.Decimal(9, 4), draft.invoiceDiscountRate)
      .input('invoiceDiscountType', sql.NVarChar(10), draft.invoiceDiscountType)
      .input('invoiceDiscountAmount', sql.Decimal(18, 4), draft.invoiceDiscountAmount)
      .input('supplierDiscountRate', sql.Decimal(9, 4), draft.supplierDiscountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('stockCostEffectTry', sql.Decimal(18, 4), draft.stockCostEffectTry)
      .query(`
        UPDATE dbo.purchase_invoices
        SET
          document_no = @documentNo,
          document_date = @documentDate,
          supplier_id = @supplierId,
          supplier_currency = @supplierCurrency,
          document_currency = @documentCurrency,
          exchange_rate_snapshot = @exchangeRate,
          description = @description,
          subtotal = @subtotal,
          line_discount_total = @lineDiscountTotal,
          invoice_discount_rate = @invoiceDiscountRate,
          ${discountReady ? 'invoice_discount_type = @invoiceDiscountType, invoice_discount_amount = @invoiceDiscountAmount,' : ''}
          supplier_discount_rate = @supplierDiscountRate,
          discount_total = @discountTotal,
          grand_total = @grandTotal,
          amount_try = @amountTry,
          stock_cost_effect_try = @stockCostEffectTry,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @invoiceId
          AND status IN (N'draft', N'finalized');
      `);

    await writeInvoiceCurrencySnapshot(new sqlDriver.Request(transaction), 'purchase', invoiceId, settlement);
    await updatePurchaseItems(sqlDriver, transaction, invoiceId, draft.items);

    if (beforeSnapshot.status === 'FINALIZED') {
      await replaceFinalizedPurchaseEffects(
        sqlDriver,
        transaction,
        invoiceId,
        beforeSnapshot,
        draft,
        supplierId,
        actor,
      );
    }

    const afterSnapshot = await getPurchaseSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: beforeSnapshot.status === 'FINALIZED' ? 'purchase_invoice_finalized_corrected' : 'purchase_invoice_draft_updated',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getPurchaseDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function assertBusinessReceivedPurchaseContext(context,invoiceId,copy){
 const supplier=context.isolatedCopyReceivedSupplier,selected=businessInvoiceSelection(context.transaction,'purchase',supplier?.id,supplier?.currency);
 if(!supplier||selected.account.accountId!==supplier.accountId)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Mal kabulün tedarikçi döviz hesabı değişti.',409);
 const proof=await new context.sqlDriver.Request(context.transaction).input('copyReceiptDatabase',context.sqlDriver.NVarChar(128),copy.target.database).input('invoice',context.sqlDriver.BigInt,invoiceId).input('copy',context.sqlDriver.UniqueIdentifier,copy.copyId).input('supplier',context.sqlDriver.BigInt,supplier.id).input('currency',context.sqlDriver.NVarChar(3),supplier.currency).input('account',context.sqlDriver.BigInt,supplier.accountId).input('rate',context.sqlDriver.Decimal(18,8),selected.rate).input('products',context.sqlDriver.NVarChar(context.sqlDriver.MAX),JSON.stringify(copy.products)).query(`
 SELECT CASE WHEN DB_NAME() COLLATE Latin1_General_100_BIN2=@copyReceiptDatabase COLLATE Latin1_General_100_BIN2
 AND EXISTS(SELECT 1 FROM dbo.stage4_copy_intents WHERE copy_id=@copy AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID() AND JSON_VALUE(payload_json,'$.businessSupplierId')=CONVERT(nvarchar(20),@supplier) AND JSON_VALUE(payload_json,'$.businessAccountId')=CONVERT(nvarchar(20),@account) AND JSON_VALUE(payload_json,'$.businessCurrency')=@currency)
 AND EXISTS(SELECT 1 FROM dbo.test_purchase_batch_drafts d JOIN dbo.purchase_invoices p ON p.id=d.invoice_id JOIN dbo.test_goods_batches b ON b.id=d.batch_id
 WHERE d.invoice_id=@invoice AND d.state=N'linked' AND b.state=N'accepted' AND b.note LIKE N'STAGE4:'+LOWER(CONVERT(varchar(36),@copy))+N':'+@currency+N':%' AND p.supplier_id=@supplier AND b.supplier_id=@supplier AND p.document_no=d.document_no AND p.document_currency=@currency AND p.account_currency=@currency AND d.currency=@currency AND p.subtotal=d.subtotal AND p.grand_total=d.grand_total AND p.discount_total=0 AND p.exchange_rate_snapshot=@rate AND p.account_exchange_rate_snapshot=@rate)
 AND (SELECT COUNT(*) FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@invoice) BETWEEN 1 AND 2
 AND NOT EXISTS(SELECT 1 FROM dbo.purchase_invoice_items i WHERE i.purchase_invoice_id=@invoice AND NOT EXISTS(
 SELECT 1 FROM dbo.test_purchase_batch_links l JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id JOIN dbo.test_goods_batches b ON b.id=g.batch_id
 JOIN dbo.test_purchase_batch_drafts d ON d.invoice_id=l.invoice_id AND d.batch_id=b.id JOIN dbo.test_purchase_batch_intent_lines n ON n.draft_id=d.id AND n.receipt_line_id=g.id
 CROSS APPLY OPENJSON(@products) WITH(id bigint,stockUnitCostTryExact8 decimal(18,8),purchasePriceExact8 decimal(18,8),purchaseCurrency nvarchar(3)) quote
 WHERE l.invoice_id=@invoice AND l.invoice_item_id=i.id AND b.state=N'accepted' AND b.supplier_id=@supplier AND b.warehouse_id=1 AND quote.id=g.product_id AND quote.purchaseCurrency=@currency AND quote.purchasePriceExact8>0
 AND i.product_id=g.product_id AND i.quantity=l.quantity AND i.quantity=n.quantity AND i.purchase_price=n.purchase_price AND i.purchase_price=ROUND(quote.purchasePriceExact8,4)
 AND i.line_total=n.line_total AND i.line_discount_rate=0 AND i.currency_code=@currency AND g.unit=N'ADET' AND g.unit_factor=1 AND l.quantity>0 AND l.quantity<=g.quantity
 AND (SELECT COUNT(*) FROM dbo.stock_movements m WHERE m.source_type=N'goods_receipt_batch' AND m.source_id=g.id AND m.product_id=g.product_id AND m.quantity_in=g.quantity AND m.quantity_out=0 AND m.quantity_net=g.quantity AND m.unit_cost_try=ROUND(quote.stockUnitCostTryExact8,4) AND m.currency_code=N'TRY')=1
 AND (SELECT COALESCE(SUM(x.quantity),0) FROM dbo.test_purchase_batch_links x JOIN dbo.purchase_invoices h ON h.id=x.invoice_id WHERE x.receipt_line_id=g.id AND h.status<>N'cancelled')<=g.quantity))
 AND (SELECT COUNT(*) FROM dbo.test_purchase_batch_links WHERE invoice_id=@invoice)=(SELECT COUNT(*) FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@invoice) THEN 1 ELSE 0 END valid;`);
 if(Number(proof.recordset?.[0]?.valid)!==1)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Mal kabul, kaynak alış fiyatı, döviz ve tek stok etkisi tam doğrulanamadı.',409);
}
export async function assertReceivedPurchaseContext(context, invoiceId) {
  if (!context?.stockAlreadyReceived) return;
  if(context.cleanStoreDayReceived===true){
    const {assertCleanReceivedPurchaseContext}=await import('./cleanStoreDayScope.mjs');
    await assertCleanReceivedPurchaseContext(context,invoiceId);return;
  }
  if(context.isolatedCopyReceived===true){
    const {isolatedCopyTransactionContext}=await import('./isolatedOperationCopyScope.mjs');
    const copy=isolatedCopyTransactionContext(context.transaction);
    if(copy!==context.isolatedOperationCopy)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Mal kabul işlem kapsamı doğrulanamadı.',409);
    if(copy.target.database===BUSINESS_COPY_DATABASE){await assertBusinessReceivedPurchaseContext(context,invoiceId,copy);return;}
    const ids=copy.products.map(p=>p.id),supplier=copy.suppliers.find(p=>p.currency==='TRY');
    if(ids.length!==2||!supplier)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Mal kabul işlem kapsamı doğrulanamadı.',409);
    const proof=await new context.sqlDriver.Request(context.transaction).input('copyReceiptDatabase',context.sqlDriver.NVarChar(128),copy.target.database).input('invoice',context.sqlDriver.BigInt,invoiceId).input('copy',context.sqlDriver.UniqueIdentifier,copy.copyId).input('supplier',context.sqlDriver.BigInt,supplier.id).input('copyReceiptProductA',context.sqlDriver.BigInt,ids[0]).input('copyReceiptProductB',context.sqlDriver.BigInt,ids[1]).query(`
      SELECT CASE WHEN DB_NAME() COLLATE Latin1_General_100_BIN2=@copyReceiptDatabase COLLATE Latin1_General_100_BIN2
      AND EXISTS(SELECT 1 FROM dbo.stage4_copy_intents WHERE copy_id=@copy AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID())
      AND EXISTS(SELECT 1 FROM dbo.test_purchase_batch_drafts d JOIN dbo.purchase_invoices p ON p.id=d.invoice_id JOIN dbo.test_goods_batches b ON b.id=d.batch_id
       WHERE d.invoice_id=@invoice AND d.state=N'linked' AND b.state=N'accepted' AND b.note LIKE N'STAGE4:'+LOWER(CONVERT(varchar(36),@copy))+N'%'
       AND p.supplier_id=@supplier AND b.supplier_id=@supplier AND p.document_no=d.document_no AND p.document_currency=N'TRY' AND p.account_currency=N'TRY'
       AND p.subtotal=d.subtotal AND p.grand_total=d.grand_total AND p.discount_total=0 AND p.exchange_rate_snapshot=1 AND p.account_exchange_rate_snapshot=1)
      AND (SELECT COUNT(*) FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@invoice) BETWEEN 1 AND 2
      AND NOT EXISTS(SELECT 1 FROM dbo.purchase_invoice_items i WHERE i.purchase_invoice_id=@invoice AND NOT EXISTS(
       SELECT 1 FROM dbo.test_purchase_batch_links l JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id JOIN dbo.test_goods_batches b ON b.id=g.batch_id
       JOIN dbo.test_purchase_batch_drafts d ON d.invoice_id=l.invoice_id AND d.batch_id=b.id JOIN dbo.test_purchase_batch_intent_lines n ON n.draft_id=d.id AND n.receipt_line_id=g.id
       WHERE l.invoice_id=@invoice AND l.invoice_item_id=i.id AND b.state=N'accepted' AND b.supplier_id=@supplier AND b.warehouse_id=1
       AND g.product_id IN(@copyReceiptProductA,@copyReceiptProductB) AND i.product_id=g.product_id AND i.quantity=l.quantity AND i.quantity=n.quantity AND i.purchase_price=n.purchase_price
       AND i.line_total=n.line_total AND i.line_discount_rate=0 AND i.currency_code=N'TRY' AND g.unit=N'ADET' AND g.unit_factor=1 AND l.quantity>0 AND l.quantity<=g.quantity
       AND (SELECT COUNT(*) FROM dbo.stock_movements m WHERE m.source_type=N'goods_receipt_batch' AND m.source_id=g.id AND m.product_id=g.product_id
        AND m.quantity_in=g.quantity AND m.quantity_out=0 AND m.quantity_net=g.quantity AND m.unit_cost_try=n.purchase_price)=1
       AND (SELECT COALESCE(SUM(x.quantity),0) FROM dbo.test_purchase_batch_links x JOIN dbo.purchase_invoices h ON h.id=x.invoice_id WHERE x.receipt_line_id=g.id AND h.status<>N'cancelled')<=g.quantity))
      AND (SELECT COUNT(*) FROM dbo.test_purchase_batch_links WHERE invoice_id=@invoice)=(SELECT COUNT(*) FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@invoice)
      THEN 1 ELSE 0 END valid;`);
    if(Number(proof.recordset?.[0]?.valid)!==1)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Mal kabul, fatura ve tek stok etkisi tam doğrulanamadı.',409);return;
  }
  if(context.testC09Received===true){
    const proof=await new context.sqlDriver.Request(context.transaction)
      .input('invoice_id',context.sqlDriver.BigInt,invoiceId)
      .execute('dbo.usp_assert_test_current_price_purchase_received');
    if(proof.recordset?.length!==1||Object.entries(CURRENT_PRICE_PURCHASE_SQL_PROOF).some(([key,expected])=>proof.recordset[0][key]!==expected))throw makeServiceError('PURCHASE_RECEIPT_SQL_DRIFT','Kayıtlı TEST fiyat sürümünün SQL tanımları doğrulanamadı.',503);
    if(Number(proof.recordset[0].valid)!==1)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Kayıtlı TEST fiyat sürümünün kabul, kur ve tek stok hareketi bağı doğrulanamadı.',409);
    return;
  }
  if(context.testPurchaseFxReceived===true){
    const proof=await new context.sqlDriver.Request(context.transaction)
      .input('invoice_id',context.sqlDriver.BigInt,invoiceId)
      .execute('dbo.usp_assert_test_purchase_fx_received');
    if(Number(proof.recordset?.[0]?.valid)!==1)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Dövizli TEST kabulünün fiyat, kur ve tek stok hareketi bağı doğrulanamadı.',409);
    return;
  }
  if(context.testBatchReceived){
    const result=await new context.sqlDriver.Request(context.transaction).input('invoice',context.sqlDriver.BigInt,invoiceId).query(`
      SELECT CASE WHEN DB_NAME() COLLATE Latin1_General_100_BIN2=N'MELISA_ERP_SIRKET_TEST_20260929_01' COLLATE Latin1_General_100_BIN2
      AND CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2=N'Semih\\MELISADEV' COLLATE Latin1_General_100_BIN2
      AND EXISTS(SELECT 1 FROM dbo.test_purchase_batch_drafts d JOIN dbo.purchase_invoices p ON p.id=d.invoice_id
        JOIN dbo.test_goods_batches b ON b.id=d.batch_id WHERE d.invoice_id=@invoice AND d.state=N'linked' AND b.state=N'accepted'
        AND p.supplier_id=b.supplier_id AND p.document_no=d.document_no AND p.document_currency=N'TRY'
        AND p.subtotal=d.subtotal AND p.grand_total=d.grand_total AND p.discount_total=0)
      AND (SELECT COUNT(*) FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@invoice) BETWEEN 1 AND 2
      AND NOT EXISTS(SELECT 1 FROM dbo.purchase_invoice_items i WHERE i.purchase_invoice_id=@invoice AND NOT EXISTS(
        SELECT 1 FROM dbo.test_purchase_batch_links l JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id
        JOIN dbo.test_goods_batches b ON b.id=g.batch_id JOIN dbo.test_purchase_batch_scope s ON s.product_id=g.product_id
        JOIN dbo.test_purchase_batch_drafts d ON d.invoice_id=l.invoice_id AND d.batch_id=b.id
        JOIN dbo.test_purchase_batch_intent_lines intent ON intent.draft_id=d.id AND intent.receipt_line_id=g.id
        WHERE l.invoice_id=@invoice AND l.invoice_item_id=i.id AND b.state=N'accepted' AND i.product_id=g.product_id
        AND s.supplier_id=b.supplier_id AND s.warehouse_id=b.warehouse_id AND i.quantity=l.quantity AND i.quantity=intent.quantity
        AND i.purchase_price=s.unit_cost AND i.purchase_price=intent.purchase_price AND i.line_discount_rate=0
        AND i.line_total=intent.line_total AND i.currency_code=N'TRY' AND g.unit=N'ADET' AND g.unit_factor=1
        AND l.quantity<=g.quantity AND EXISTS(SELECT 1 FROM dbo.stock_movements m WHERE m.source_type=N'goods_receipt_batch'
          AND m.source_id=g.id AND m.product_id=g.product_id AND m.quantity_in=g.quantity AND m.quantity_out=0 AND m.quantity_net=g.quantity)
        AND (SELECT COALESCE(SUM(x.quantity),0) FROM dbo.test_purchase_batch_links x JOIN dbo.purchase_invoices h ON h.id=x.invoice_id
          WHERE x.receipt_line_id=g.id AND h.status<>N'cancelled')<=g.quantity))
      AND (SELECT COUNT(*) FROM dbo.test_purchase_batch_links WHERE invoice_id=@invoice)=(SELECT COUNT(*) FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@invoice)
      THEN 1 ELSE 0 END valid`);
    if(Number(result.recordset?.[0]?.valid)!==1)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Sentetik çok satırlı kabul/fatura bağlantısı tam doğrulanamadı.',409);return;
  }
  if(context.dailyGoodsId){
    const r=await new context.sqlDriver.Request(context.transaction).input('goodsId',context.sqlDriver.BigInt,context.dailyGoodsId).input('invoiceId',context.sqlDriver.BigInt,invoiceId).query(`SELECT COUNT(*) n FROM dbo.test_daily_drafts g JOIN dbo.test_daily_scope s ON s.flow=g.flow JOIN dbo.purchase_invoices p ON p.id=@invoiceId AND p.supplier_id=s.supplier_id JOIN dbo.purchase_invoice_items i ON i.purchase_invoice_id=p.id AND i.product_id=s.product_id WHERE DB_NAME()=N'MELISA_ERP_SIRKET_TEST_20260929_01' AND g.id=@goodsId AND g.flow=N'purchase' AND g.kind=N'goods' AND g.state=N'approved' AND TRY_CONVERT(bigint,JSON_VALUE(g.payload_json,'$.invoiceId'))=p.id AND i.quantity=TRY_CONVERT(decimal(18,3),JSON_VALUE(g.payload_json,'$.invoicedQuantity')) AND i.quantity<=TRY_CONVERT(decimal(18,3),JSON_VALUE(g.payload_json,'$.quantity')) AND i.purchase_price=60 AND p.document_currency=N'TRY' AND JSON_VALUE(g.payload_json,'$.unit')=N'ADET' AND JSON_VALUE(g.payload_json,'$.warehouse')=N'TEST-DAILY-WH' AND EXISTS(SELECT 1 FROM dbo.stock_movements m WHERE m.product_id=s.product_id AND m.source_type=N'goods_receipt' AND m.source_id=g.id AND m.quantity_in=TRY_CONVERT(decimal(18,3),JSON_VALUE(g.payload_json,'$.quantity')))`);
    if(Number(r.recordset?.[0]?.n)!==1)throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED','Yeni TEST kabul bağlantısı doğrulanamadı.',409);return;
  }

  const result = await new context.sqlDriver.Request(context.transaction)
    .input('receivedInvoiceId', context.sqlDriver.BigInt, invoiceId)
    .query(`SELECT COUNT(*) n FROM dbo.test_purchase_links l
      JOIN dbo.test_goods_receipts g ON g.id=l.goods_id
      JOIN dbo.test_purchase_scope t ON t.product_id=g.product_id AND t.supplier_id=g.supplier_id AND t.warehouse_id=g.warehouse_id
      JOIN dbo.purchase_invoices p ON p.id=l.invoice_id AND p.supplier_id=g.supplier_id
      JOIN dbo.purchase_invoice_items i ON i.purchase_invoice_id=p.id AND i.product_id=g.product_id
      WHERE DB_NAME()=N'MELISA_ERP_SIRKET_TEST_20260929_01' AND l.invoice_id=@receivedInvoiceId
        AND g.state=N'accepted' AND i.quantity=l.quantity AND i.purchase_price=t.unit_cost
        AND t.unit_cost=60 AND p.document_currency=N'TRY' AND g.unit_factor=1;`);
  if (Number(result.recordset?.[0]?.n) !== 1) throw makeServiceError('PURCHASE_RECEIPT_LINK_REQUIRED', 'Stok atlanmadan önce tek ve doğrulanmış TEST kabul bağlantısı gerekli.', 409);
}

export async function finalizePurchaseInvoice(id, actor = null, transactionContext = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_FINALIZE_ID_INVALID', 'Purchase invoice id is invalid');
  }

  const pool = transactionContext?.pool || await getSqlPool();
  const sqlDriver = transactionContext?.sqlDriver || getSqlDriver();
  const transaction = transactionContext?.transaction || new sqlDriver.Transaction(pool);

  if (!transactionContext) await transaction.begin();

  try {
    const beforeSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('PURCHASE_FINALIZE_NOT_FOUND', 'Purchase invoice not found', 404);
    }
    await assertOperationQuarantineAllowed(invoiceQuarantineEntities('purchase',beforeSnapshot),quarantineTransactionContext(sqlDriver,transaction));

    if (beforeSnapshot.status !== 'DRAFT') {
      throw makeServiceError('PURCHASE_FINALIZE_STATUS_INVALID', 'Only DRAFT purchase invoices can be finalized', 409);
    }

    await assertCurrencySnapshotSchema(new sqlDriver.Request(transaction), 'supplier');
    const settlement = settlementFromInvoice(beforeSnapshot);
    await assertInvoiceSettlementParty(sqlDriver, transaction, 'purchase', beforeSnapshot, settlement, { active: true });
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Alış fişi kesinleştirme');

    if (!beforeSnapshot.supplierId || !beforeSnapshot.supplierName) {
      throw makeServiceError('PURCHASE_FINALIZE_SUPPLIER_INVALID', 'Purchase invoice supplier is missing', 400);
    }

    await assertDailyPurchaseSupplierCurrency(sqlDriver, transaction, beforeSnapshot.supplierId, beforeSnapshot.documentCurrency, beforeSnapshot.supplierCurrency);
    if (isDailyWebRequest()) {
      await assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, beforeSnapshot.supplierId, beforeSnapshot.items);
    }

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('PURCHASE_FINALIZE_ITEMS_REQUIRED', 'Purchase invoice must contain at least one item', 400);
    }

    if (Number(beforeSnapshot.grandTotal || 0) < 0) {
      throw makeServiceError('PURCHASE_FINALIZE_TOTAL_INVALID', 'Purchase invoice total cannot be negative', 400);
    }

    const warnings = [];
    const accumulatePurchaseCost = createPurchaseCostAccumulator();
    await assertReceivedPurchaseContext(transactionContext, invoiceId);

    for (const item of (transactionContext?.stockAlreadyReceived ? [] : beforeSnapshot.items)) {
      const quantity = safeNumber(item.quantity);
      const lineTotalTry = purchaseLineCostTry(item, beforeSnapshot.exchangeRate);
      const unitCostTry = quantity > 0 ? lineTotalTry / quantity : 0;
      const { currentStock, currentAverageCostTry, nextStock, nextAverageCostTry } = accumulatePurchaseCost({
        productId: item.productId,
        currentStock: safeNumber(item.currentStockQty),
        currentAverageCostTry: safeNumber(item.currentAverageCostTry),
        purchaseQuantity: quantity,
        purchaseAmountTry: lineTotalTry,
      });

      await new sqlDriver.Request(transaction)
        .input('purchaseProductIdForStockUpdate', sql.BigInt, item.productId)
        .input('purchaseQuantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .input('purchaseAverageCostTryForUpdate', sql.Decimal(18, 4), nextAverageCostTry)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty + @purchaseQuantityForStockUpdate,
            average_cost_try = @purchaseAverageCostTryForUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @purchaseProductIdForStockUpdate;
        `);

      await writeAuditLog(new sqlDriver.Request(transaction), {
        action: 'product_average_cost_updated',
        entityType: 'product',
        entityId: item.productId,
        beforeSnapshot: {
          productId: item.productId,
          purchaseInvoiceId: invoiceId,
          currentStock,
          averageCostTry: currentAverageCostTry,
        },
        afterSnapshot: {
          productId: item.productId,
          purchaseInvoiceId: invoiceId,
          quantity,
          purchaseAmountTry: lineTotalTry,
          unitCostTry,
          nextStock,
          averageCostTry: nextAverageCostTry,
        },
        actor,
      });

      await new sqlDriver.Request(transaction)
        .input('purchaseMovementProductId', sql.BigInt, item.productId)
        .input('purchaseMovementSourceId', sql.BigInt, invoiceId)
        .input('purchaseMovementQuantityIn', sql.Decimal(18, 3), quantity)
        .input('purchaseMovementQuantityNet', sql.Decimal(18, 3), quantity)
        .input('purchaseMovementUnitCostTry', sql.Decimal(18, 4), unitCostTry)
        .input('purchaseMovementAverageCostTry', sql.Decimal(18, 4), nextAverageCostTry)
        .input('purchaseMovementUnitPrice', sql.Decimal(18, 4), Number(item.purchasePrice || 0))
        .input('purchaseMovementCurrency', sql.NVarChar(3), item.currency)
        .input('purchaseMovementAmountTry', sql.Decimal(18, 4), lineTotalTry)
        .input('purchaseMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('purchaseMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            supplier_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          VALUES (
            @purchaseMovementProductId,
            N'in',
            N'purchase_invoice',
            @purchaseMovementSourceId,
            @purchaseMovementQuantityIn,
            0,
            @purchaseMovementQuantityNet,
            @purchaseMovementUnitCostTry,
            @purchaseMovementAverageCostTry,
            @purchaseMovementDocumentDate,
            @purchaseMovementSupplierId,
            SYSUTCDATETIME(),
            NULL,
            @purchaseMovementUnitPrice,
            @purchaseMovementCurrency,
            @purchaseMovementAmountTry
          );
        `);
    }

    if(!await insertIsolatedCopyInvoiceMovement(sqlDriver,transaction,{kind:'purchase',invoiceId,movementType:'purchase_invoice',snapshot:settlement,direction:1,actor,partyId:beforeSnapshot.supplierId,documentDate:beforeSnapshot.documentDate}))await new sqlDriver.Request(transaction)
      .input('supplierMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
      .input('supplierMovementInvoiceId', sql.BigInt, invoiceId)
      .input('supplierMovementAmount', sql.Decimal(18, 4), Number(beforeSnapshot.grandTotal || 0))
      .input('supplierMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('supplierMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .query(`
        INSERT INTO dbo.supplier_movements (
          supplier_id,
          purchase_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @supplierMovementSupplierId,
          @supplierMovementInvoiceId,
          N'purchase_invoice',
          @supplierMovementAmount,
          @supplierMovementCurrency,
          @supplierMovementAmount,
          @supplierMovementDocumentDate,
          SYSUTCDATETIME(),
          NULL
        );
      `);

    await stampInvoiceMovement(sqlDriver, transaction, 'purchase', invoiceId, 'purchase_invoice', settlement, 1,actor);

    await new sqlDriver.Request(transaction)
      .input('supplierBalanceId', sql.BigInt, beforeSnapshot.supplierId)
      .input('supplierBalanceEffect', sql.Decimal(18, 4), settlement.accountAmount)
      .query(`
        UPDATE dbo.suppliers
        SET
          balance = balance + @supplierBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @supplierBalanceId ${isIsolatedOperationCopyRuntime()&&getIsolatedOperationCopyConfig()?.target.database===BUSINESS_COPY_DATABASE?"AND currency_code=N'"+settlement.accountCurrency+"'":''};
      `);

    const finalizeResult = await new sqlDriver.Request(transaction)
      .input('finalizePurchaseInvoiceId', sql.BigInt, invoiceId)
      .query(`
        DECLARE @finalizedPurchaseRows TABLE (id bigint);
        UPDATE dbo.purchase_invoices
        SET
          status = N'finalized',
          finalized_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
        OUTPUT inserted.id INTO @finalizedPurchaseRows(id)
        WHERE id = @finalizePurchaseInvoiceId
          AND status = N'draft';
        SELECT COUNT_BIG(*) AS purchaseStatusRows FROM @finalizedPurchaseRows;
      `);

    if (!purchaseStatusMutationSucceeded(finalizeResult)) {
      throw makeServiceError('PURCHASE_FINALIZE_STATUS_CHANGED', 'Purchase invoice status changed during finalize', 409);
    }

    const afterSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'purchase_invoice_finalized',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        warnings,
      },
      actor,
    });

    if (!transactionContext) await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    if (!transactionContext) await transaction.rollback();
    throw error;
  }
}

export async function cancelPurchaseInvoice(id, payload = {}, actor = null, transactionContext = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_CANCEL_ID_INVALID', 'Purchase invoice id is invalid');
  }

  const reason = normalizeCancelReason(payload.reason, 'PURCHASE_CANCEL_REASON_REQUIRED');
  const averageCostPolicy = {
    average_cost_cancel_policy: 'recalculate_from_purchase_stock_movements',
    reason: 'Purchase cancellation recalculates product average cost from net purchase stock movements for the affected product.',
  };
  const pool = transactionContext?.pool || await getSqlPool();
  const sqlDriver = transactionContext?.sqlDriver || getSqlDriver();
  const transaction = transactionContext?.transaction || new sqlDriver.Transaction(pool);

  if (!transactionContext) await transaction.begin();

  try {
    const beforeSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('PURCHASE_CANCEL_NOT_FOUND', 'Purchase invoice not found', 404);
    }
    await assertOperationQuarantineAllowed(invoiceQuarantineEntities('purchase',beforeSnapshot),quarantineTransactionContext(sqlDriver,transaction));

    await assertInvoiceHasNoReturns(() => new sqlDriver.Request(transaction), 'purchase', invoiceId);
    await assertCurrencySnapshotSchema(new sqlDriver.Request(transaction), 'supplier');
    const settlement = settlementFromInvoice(beforeSnapshot);
    await assertInvoiceSettlementParty(sqlDriver, transaction, 'purchase', beforeSnapshot, settlement, { active: false });

    if (beforeSnapshot.status !== 'FINALIZED') {
      throw makeServiceError('PURCHASE_CANCEL_STATUS_INVALID', 'Only FINALIZED purchase invoices can be cancelled', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Alış fişi iptal');

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('PURCHASE_CANCEL_ITEMS_REQUIRED', 'Purchase invoice must contain at least one item', 400);
    }

    const warnings = [];
    let reversedStockTotal = 0;
    await assertReceivedPurchaseContext(transactionContext, invoiceId);

    for (const item of (transactionContext?.stockAlreadyReceived ? [] : beforeSnapshot.items)) {
      const quantity = safeNumber(item.quantity);
      const currentStock = safeNumber(item.currentStockQty);
      const nextStock = currentStock - quantity;
      const lineTotalTry = purchaseLineCostTry(item, beforeSnapshot.exchangeRate);
      const currentAverageCostTry = safeNumber(item.currentAverageCostTry);

      reversedStockTotal += quantity;

      if (nextStock < 0) {
        warnings.push({
          code: 'NEGATIVE_STOCK_AFTER_PURCHASE_CANCEL',
          productId: item.productId,
          stockCode: item.stockCode,
          currentStock,
          quantity,
          projectedStock: nextStock,
        });
      }

      await new sqlDriver.Request(transaction)
        .input('cancelPurchaseProductIdForStockUpdate', sql.BigInt, item.productId)
        .input('cancelPurchaseQuantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty - @cancelPurchaseQuantityForStockUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @cancelPurchaseProductIdForStockUpdate;
        `);

      const cancelMovementInsert = await new sqlDriver.Request(transaction)
        .input('cancelPurchaseMovementProductId', sql.BigInt, item.productId)
        .input('cancelPurchaseMovementSourceId', sql.BigInt, invoiceId)
        .input('cancelPurchaseMovementQuantityOut', sql.Decimal(18, 3), quantity)
        .input('cancelPurchaseMovementQuantityNet', sql.Decimal(18, 3), -quantity)
        .input('cancelPurchaseMovementUnitCostTry', sql.Decimal(18, 4), currentAverageCostTry)
        .input('cancelPurchaseMovementUnitPrice', sql.Decimal(18, 4), Number(item.purchasePrice || 0))
        .input('cancelPurchaseMovementCurrency', sql.NVarChar(3), item.currency)
        .input('cancelPurchaseMovementAmountTry', sql.Decimal(18, 4), -lineTotalTry)
        .input('cancelPurchaseMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('cancelPurchaseMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
        .input('cancelPurchaseMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            supplier_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          OUTPUT INSERTED.id AS movementId
          VALUES (
            @cancelPurchaseMovementProductId,
            N'out',
            N'purchase_invoice',
            @cancelPurchaseMovementSourceId,
            0,
            @cancelPurchaseMovementQuantityOut,
            @cancelPurchaseMovementQuantityNet,
            @cancelPurchaseMovementUnitCostTry,
            @cancelPurchaseMovementUnitCostTry,
            @cancelPurchaseMovementDocumentDate,
            @cancelPurchaseMovementSupplierId,
            SYSUTCDATETIME(),
            @cancelPurchaseMovementCreatedBy,
            @cancelPurchaseMovementUnitPrice,
            @cancelPurchaseMovementCurrency,
            @cancelPurchaseMovementAmountTry
          );
        `);

      const recalculatedAverageCostTry = await recalculateProductAverageCostTry(
        sqlDriver,
        transaction,
        item.productId,
        actor,
      );
      const movementId = Number(cancelMovementInsert.recordset?.[0]?.movementId || 0);

      if (movementId > 0) {
        await new sqlDriver.Request(transaction)
          .input('cancelPurchaseMovementAverageAfterId', sql.BigInt, movementId)
          .input('cancelPurchaseMovementAverageAfterValue', sql.Decimal(18, 4), recalculatedAverageCostTry)
          .query(`
            UPDATE dbo.stock_movements
            SET average_cost_try_after = @cancelPurchaseMovementAverageAfterValue
            WHERE id = @cancelPurchaseMovementAverageAfterId;
          `);
      }
    }

    const reversedSupplierAmount = Number(beforeSnapshot.grandTotal || 0);

    if(!await insertIsolatedCopyInvoiceMovement(sqlDriver,transaction,{kind:'purchase',invoiceId,movementType:'purchase_invoice_cancel',snapshot:settlement,direction:-1,actor,partyId:beforeSnapshot.supplierId,documentDate:beforeSnapshot.documentDate}))await new sqlDriver.Request(transaction)
      .input('cancelSupplierMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
      .input('cancelSupplierMovementInvoiceId', sql.BigInt, invoiceId)
      .input('cancelSupplierMovementAmount', sql.Decimal(18, 4), reversedSupplierAmount)
      .input('cancelSupplierMovementBalanceEffect', sql.Decimal(18, 4), -reversedSupplierAmount)
      .input('cancelSupplierMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('cancelSupplierMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .input('cancelSupplierMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.supplier_movements (
          supplier_id,
          purchase_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @cancelSupplierMovementSupplierId,
          @cancelSupplierMovementInvoiceId,
          N'purchase_invoice_cancel',
          @cancelSupplierMovementAmount,
          @cancelSupplierMovementCurrency,
          @cancelSupplierMovementBalanceEffect,
          @cancelSupplierMovementDocumentDate,
          SYSUTCDATETIME(),
          @cancelSupplierMovementCreatedBy
        );
      `);

    await stampInvoiceMovement(sqlDriver, transaction, 'purchase', invoiceId, 'purchase_invoice_cancel', settlement, -1,actor);

    await new sqlDriver.Request(transaction)
      .input('cancelSupplierBalanceId', sql.BigInt, beforeSnapshot.supplierId)
      .input('cancelSupplierBalanceEffect', sql.Decimal(18, 4), settlement.accountAmount)
      .query(`
        UPDATE dbo.suppliers
        SET
          balance = balance - @cancelSupplierBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @cancelSupplierBalanceId ${isIsolatedOperationCopyRuntime()&&getIsolatedOperationCopyConfig()?.target.database===BUSINESS_COPY_DATABASE?"AND currency_code=N'"+settlement.accountCurrency+"'":''};
      `);

    const cancelResult = await new sqlDriver.Request(transaction)
      .input('cancelPurchaseInvoiceId', sql.BigInt, invoiceId)
      .input('cancelPurchaseReason', sql.NVarChar(500), reason)
      .input('cancelPurchaseUpdatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        DECLARE @cancelledPurchaseRows TABLE (id bigint);
        UPDATE dbo.purchase_invoices
        SET
          status = N'cancelled',
          cancelled_at = SYSUTCDATETIME(),
          cancel_reason = @cancelPurchaseReason,
          updated_at = SYSUTCDATETIME(),
          updated_by = @cancelPurchaseUpdatedBy
        OUTPUT inserted.id INTO @cancelledPurchaseRows(id)
        WHERE id = @cancelPurchaseInvoiceId
          AND status = N'finalized';
        SELECT COUNT_BIG(*) AS purchaseStatusRows FROM @cancelledPurchaseRows;
      `);

    if (!purchaseStatusMutationSucceeded(cancelResult)) {
      throw makeServiceError('PURCHASE_CANCEL_STATUS_INVALID', 'Purchase invoice status changed during cancel', 409);
    }

    const afterSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'purchase_invoice_cancelled',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        reason,
        reversedStockTotal,
        reversedSupplierAmount,
        averageCostPolicy,
        warnings,
      },
      actor,
    });

    if (!transactionContext) await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    if (!transactionContext) await transaction.rollback();
    throw error;
  }
}
