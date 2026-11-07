// Not mounted. A physically owned sales.cancel transaction must supply the
// scope verifier. All reads use the supplied transaction; no pool fallback.
import {prepareDesktopSaleCancellation} from './desktopSaleCancellationPlan.mjs';
const fail=()=>{throw Error('DESKTOP_FINAL_CANCEL_READ_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
// node-mssql annotates each recordset with two non-enumerable data properties.
// Strip only that exact driver shape at this boundary; the planner still
// receives dense ordinary arrays and performs its own strict row validation.
function bareRows(value,allowMetadata){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value),length=descriptors.length?.value;
 if(!Number.isSafeInteger(length)||length<0)fail();
 const hasColumns=Object.hasOwn(descriptors,'columns'),hasTable=Object.hasOwn(descriptors,'toTable');
 if(hasColumns!==hasTable||!allowMetadata&&hasColumns||keys.length!==length+1+(hasColumns?2:0))fail();
 if(hasColumns){const c=descriptors.columns,t=descriptors.toTable,valid=d=>Object.hasOwn(d,'value')&&d.enumerable===false&&d.configurable===true&&d.writable===false;
  if(!valid(c)||!valid(t)||!c.value||typeof c.value!=='object'||Array.isArray(c.value)||Object.getPrototypeOf(c.value)!==Object.prototype||typeof t.value!=='function')fail();}
 const out=[];for(let i=0;i<length;i++){const d=descriptors[String(i)];if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();out.push(d.value);}return out;
}
export const DESKTOP_FINAL_CANCELLATION_READ_SQL=`SET NOCOUNT ON;
SELECT CASE WHEN (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation WITH(HOLDLOCK))=1
 AND EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WITH(HOLDLOCK) WHERE id=1 AND actual_t1=0 AND external_operations=0 AND read_only=0)
 AND OBJECT_ID(N'dbo.invoice_returns',N'U') IS NULL
 AND OBJECT_ID(N'dbo.finance_account_movements',N'U') IS NULL
 AND NOT EXISTS(SELECT 1 FROM dbo.terminal_sync_queue WITH(UPDLOCK,HOLDLOCK)
  WHERE target_entity IS NULL OR LTRIM(RTRIM(target_entity))=N'' OR target_entity_id IS NULL OR target_entity_id<=0
   OR (target_entity=N'sales_invoice' AND target_entity_id=TRY_CONVERT(bigint,@invoiceId))) THEN 1 ELSE 0 END isolated;
SELECT CONVERT(varchar(20),i.id) id,CONVERT(varchar(20),i.customer_id) customerId,CONVERT(varchar(20),i.party_entity_id) entityId,CONVERT(varchar(20),i.party_currency_account_id) accountId,
 i.document_currency currency,i.account_currency accountCurrency,i.customer_currency customerCurrency,
 CONVERT(varchar(40),i.grand_total) totalExact4,CONVERT(varchar(40),i.account_amount) accountAmountExact4,CONVERT(varchar(40),i.amount_try) amountTryExact4,
 UPPER(i.status COLLATE Latin1_General_100_BIN2) state,w.state workflowState,CONVERT(varchar(18),CONVERT(binary(8),w.version),1) version
 FROM dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) JOIN dbo.desktop_sale_workflows w WITH(UPDLOCK,HOLDLOCK) ON w.invoice_id=i.id
 WHERE i.id=TRY_CONVERT(bigint,@invoiceId);
SELECT CONVERT(varchar(20),c.id) id,CONVERT(varchar(20),c.party_entity_id) entityId,c.currency_code currency,CONVERT(varchar(40),c.balance) balanceExact4
 FROM dbo.customers c WITH(UPDLOCK,HOLDLOCK) JOIN dbo.sales_invoices i WITH(HOLDLOCK) ON i.customer_id=c.id WHERE i.id=TRY_CONVERT(bigint,@invoiceId);
SELECT CONVERT(varchar(20),a.id) id,CONVERT(varchar(20),a.customer_id) customerId,CONVERT(varchar(20),a.party_entity_id) entityId,a.currency_code currency,CONVERT(varchar(40),a.current_balance) balanceExact8
 FROM dbo.party_currency_accounts a WITH(UPDLOCK,HOLDLOCK) JOIN dbo.sales_invoices i WITH(HOLDLOCK) ON i.party_currency_account_id=a.id
 WHERE i.id=TRY_CONVERT(bigint,@invoiceId) AND a.supplier_id IS NULL;
SELECT CONVERT(varchar(20),x.id) id,CONVERT(varchar(20),x.product_id) productId,CONVERT(varchar(40),x.quantity) quantityExact3,
 CONVERT(varchar(40),p.current_stock_qty) stockBeforeExact3,CONVERT(varchar(40),x.average_cost_try_snapshot) unitCostTryExact4
 FROM dbo.sales_invoice_items x WITH(UPDLOCK,HOLDLOCK) JOIN dbo.products p WITH(UPDLOCK,HOLDLOCK) ON p.id=x.product_id
 WHERE x.sales_invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY x.id;
SELECT CONVERT(varchar(20),m.id) id,CONVERT(varchar(20),m.source_id) invoiceId,CONVERT(varchar(20),m.product_id) productId,m.movement_type type,
 CONVERT(varchar(40),m.quantity_in) quantityInExact3,CONVERT(varchar(40),m.quantity_out) quantityOutExact3,CONVERT(varchar(40),m.amount_try) amountTryExact4,CONVERT(varchar(40),m.unit_cost_try) unitCostTryExact4
 FROM dbo.stock_movements m WITH(UPDLOCK,HOLDLOCK) WHERE m.source_type=N'sales_invoice' AND m.source_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY m.id;
SELECT CONVERT(varchar(20),m.id) id,CONVERT(varchar(20),m.sales_invoice_id) invoiceId,CONVERT(varchar(20),m.customer_id) customerId,
 CONVERT(varchar(20),m.party_entity_id) entityId,CONVERT(varchar(20),m.party_currency_account_id) accountId,m.movement_type type,m.currency_code currency,m.account_currency accountCurrency,
 CONVERT(varchar(40),m.amount) amountExact4,CONVERT(varchar(40),m.account_amount) accountAmountExact4,CONVERT(varchar(40),m.balance_effect) balanceEffectExact4,CONVERT(varchar(40),m.amount_try) amountTryExact4
 FROM dbo.customer_movements m WITH(UPDLOCK,HOLDLOCK) WHERE m.sales_invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY m.id;
SELECT CONVERT(varchar(20),item_id) itemId,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(40),quantity) quantityExact3,state
 FROM dbo.desktop_sale_reservations WITH(UPDLOCK,HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY item_id;`;
const oldFinanceCheck="AND OBJECT_ID(N'dbo.finance_account_movements',N'U') IS NULL";
const v7FinanceCheck=`AND OBJECT_ID(N'dbo.finance_account_movements',N'U') IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM dbo.customer_movements cm WITH(UPDLOCK,HOLDLOCK)
 JOIN dbo.finance_account_movements fm WITH(UPDLOCK,HOLDLOCK) ON fm.party_movement_id=cm.id AND fm.party_type=N'customer'
 WHERE cm.sales_invoice_id=TRY_CONVERT(bigint,@invoiceId))`;
const oldMarker='WHERE id=1 AND actual_t1=0';
if(DESKTOP_FINAL_CANCELLATION_READ_SQL.split(oldFinanceCheck).length!==2||DESKTOP_FINAL_CANCELLATION_READ_SQL.split(oldMarker).length!==2)fail();
export const DESKTOP_FINAL_CANCELLATION_V7_READ_SQL=DESKTOP_FINAL_CANCELLATION_READ_SQL.replace(oldFinanceCheck,v7FinanceCheck).replace(oldMarker,'WHERE id=1 AND schema_version=7 AND actual_t1=0');
export function createDesktopFinalCancellationReader({sql,verifyScope,verifyExport,profile='desktop-master-v5'}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyScope!=='function'||typeof verifyExport!=='function'||!['desktop-master-v5','desktop-master-v6','desktop-master-v7'].includes(profile))fail();
 return async function read({transaction,scope,invoiceId,expectedVersion,reason}={}){
  if(!transaction||!id(invoiceId)||await verifyScope({transaction,scope,invoiceId})!==true)fail();
  // Production must bind the existing file-based Vega export guard here.
  // Absence of SQL export tables is not proof that its journal is empty.
  if(await verifyExport({transaction,scope,invoiceId})!==true)fail();
  const result=await new sql.Request(transaction).input('invoiceId',sql.NVarChar(20),invoiceId).query(profile==='desktop-master-v7'?DESKTOP_FINAL_CANCELLATION_V7_READ_SQL:DESKTOP_FINAL_CANCELLATION_READ_SQL),outer=bareRows(result?.recordsets,false);
  if(outer.length!==8)fail();const rs=outer.map(r=>bareRows(r,true));
  if(rs[0].length!==1||rs[0][0]?.isolated!==1||rs[1].length!==1||rs[2].length!==1||rs[3].length!==1||rs[1][0]?.id!==invoiceId||rs[1][0]?.version!==expectedVersion)fail();
  const snapshot={invoice:rs[1][0],customer:rs[2][0],account:rs[3][0],items:rs[4],stockMovements:rs[5],customerMovements:rs[6],reservations:rs[7],linkedFinanceRows:'0',returnRows:'0',exportRows:'0',reason};
  // Exact one sales_invoice customer movement is required by the planner;
  // linked collections or cancellation rows therefore reject. Other finance
  // and return schemas must be absent. A linked or unresolved Native queue row
  // rejects; its range locks must remain held through the eventual inverse.
  // The existing file-based Vega export guard must ALSO remain in the native
  // cancellation path; it must not be skipped on the strength of SQL metadata.
  const plan=prepareDesktopSaleCancellation(snapshot);
  if(await verifyScope({transaction,scope,invoiceId})!==true)fail();return plan;
 };
}
