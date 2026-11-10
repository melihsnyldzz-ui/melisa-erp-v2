import {desktopSqlForProfile} from '../config/desktopEmptyV7Profile.mjs';
// Source-only TRY pilot. No query execution, authority or posting is provided.
// The future caller must supply an authenticated, locked single transaction.
const fail=()=>{throw Error('DESKTOP_PURCHASE_ACCOUNT_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
function shape(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail();}
function dec(v,scale,whole,{positive=false}={}){if(typeof v!=='string'||!new RegExp(`^-?(?:0|[1-9]\\d{0,${whole-1}})\\.\\d{${scale}}$`).test(v)||v===`-0.${'0'.repeat(scale)}`)fail();const n=BigInt(v.replace('.',''));if(positive&&n<0n)fail();return n;}
function fixed(n,scale,whole){if(n<=-(10n**BigInt(scale+whole))||n>=10n**BigInt(scale+whole))fail();const neg=n<0n,s=(neg?-n:n).toString().padStart(scale+1,'0');return `${neg?'-':''}${s.slice(0,-scale)}.${s.slice(-scale)}`;}
export function planDesktopPurchaseAccount(input){
 shape(input,['invoiceId','supplierId','entityId','accountId','documentCurrency','supplierCurrency','accountCurrency','documentRateExact8','accountRateExact8','amountExact4','supplierBeforeExact4','accountBeforeExact8']);
 if(![input.invoiceId,input.supplierId,input.entityId,input.accountId].every(id)||[input.documentCurrency,input.supplierCurrency,input.accountCurrency].some(x=>x!=='TRY')||input.documentRateExact8!=='1.00000000'||input.accountRateExact8!=='1.00000000')fail();
 const amount=dec(input.amountExact4,4,14,{positive:true}),supplier=dec(input.supplierBeforeExact4,4,14),account=dec(input.accountBeforeExact8,8,20);
 return Object.freeze({...input,supplierAfterExact4:fixed(supplier+amount,4,14),accountAfterExact8:fixed(account+amount*10000n,8,20),nativeSupplierEffects:1,additionalSupplierEffects:0,accountEffects:1,sourceOnly:true});
}
// The SQL is fixed and read-only. @sessionId and @transactionId must come from
// the transaction owner, not the client. Executing or binding is not provided.
export const DESKTOP_PURCHASE_ACCOUNT_READBACK_SQL=`SET NOCOUNT ON;
IF DB_NAME()<>N'MELISA_ERP_DESKTOP_TEST_20261105' OR @@SPID<>@sessionId OR CURRENT_TRANSACTION_ID()<>@transactionId OR @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51981,'DESKTOP_PURCHASE_TX',1;
SELECT CONVERT(varchar(20),p.id) invoiceId,CONVERT(varchar(20),p.supplier_id) supplierId,p.status,p.document_currency documentCurrency,p.account_currency accountCurrency,CONVERT(varchar(40),p.grand_total) amountExact4,CONVERT(varchar(40),p.account_amount) accountAmountExact4 FROM dbo.purchase_invoices p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=TRY_CONVERT(bigint,@invoiceId);
SELECT CONVERT(varchar(20),s.id) supplierId,CONVERT(varchar(20),s.party_entity_id) entityId,s.currency_code currency,CONVERT(varchar(40),s.balance) balanceExact4 FROM dbo.suppliers s WITH(UPDLOCK,HOLDLOCK) WHERE s.id=TRY_CONVERT(bigint,@supplierId) AND s.is_active=1 AND s.is_deleted=0;
SELECT CONVERT(varchar(20),a.id) accountId,CONVERT(varchar(20),a.supplier_id) supplierId,CONVERT(varchar(20),a.party_entity_id) entityId,a.currency_code currency,CONVERT(varchar(50),a.current_balance) balanceExact8 FROM dbo.party_currency_accounts a WITH(UPDLOCK,HOLDLOCK) WHERE a.id=TRY_CONVERT(bigint,@accountId) AND a.customer_id IS NULL;
SELECT CONVERT(varchar(20),m.id) movementId,CONVERT(varchar(20),m.purchase_invoice_id) invoiceId,CONVERT(varchar(20),m.supplier_id) supplierId,CONVERT(varchar(20),m.party_entity_id) entityId,CONVERT(varchar(20),m.party_currency_account_id) accountId,m.movement_type movementType,m.currency_code currency,m.account_currency accountCurrency,CONVERT(varchar(40),m.amount) amountExact4,CONVERT(varchar(40),m.account_amount) accountAmountExact4,CONVERT(varchar(40),m.balance_effect) balanceEffectExact4 FROM dbo.supplier_movements m WITH(UPDLOCK,HOLDLOCK) WHERE m.purchase_invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY m.id;`;
// These nullable columns are not in the observed DB5 schema. This describes a
// migration prerequisite only; caller-supplied metadata is not SQL authority.
export const DESKTOP_PURCHASE_REQUIRED_SCHEMA=Object.freeze([
 ...['purchase_invoices','supplier_movements'].flatMap(tableName=>[
  {tableName,columnName:'account_currency',typeName:'nvarchar',maxLength:6,precision:0,scale:0,isNullable:true},
  {tableName,columnName:'account_amount',typeName:'decimal',maxLength:9,precision:18,scale:4,isNullable:true},
  {tableName,columnName:'account_exchange_rate_snapshot',typeName:'decimal',maxLength:9,precision:18,scale:8,isNullable:true},
  ...['party_entity_id','party_currency_account_id'].map(columnName=>({tableName,columnName,typeName:'bigint',maxLength:8,precision:19,scale:0,isNullable:true}))]),
 {tableName:'supplier_movements',columnName:'document_exchange_rate_snapshot',typeName:'decimal',maxLength:9,precision:18,scale:8,isNullable:true},
 {tableName:'supplier_movements',columnName:'amount_try',typeName:'decimal',maxLength:9,precision:18,scale:4,isNullable:true}
].map(Object.freeze));
export function assertDesktopPurchaseRequiredSchema(columns){
 if(!Array.isArray(columns))fail();for(const required of DESKTOP_PURCHASE_REQUIRED_SCHEMA){const found=columns.filter(x=>x?.tableName===required.tableName&&x?.columnName===required.columnName);if(found.length!==1||Object.keys(required).some(k=>found[0][k]!==required[k]))fail();}return true;
}
export function compileDesktopPurchaseAccountReadback({invoiceId,supplierId,accountId,sessionId,transactionId,schemaColumns,targetProfile=null}={}){
 assertDesktopPurchaseRequiredSchema(schemaColumns);
 if(![invoiceId,supplierId,accountId,transactionId].every(id)||!Number.isInteger(sessionId)||sessionId<1||sessionId>2147483647)fail();
 return Object.freeze({sql:desktopSqlForProfile(DESKTOP_PURCHASE_ACCOUNT_READBACK_SQL,targetProfile),parameters:Object.freeze({invoiceId,supplierId,accountId,sessionId,transactionId})});
}
// Exactly one row for each result set is mandatory. This validates persisted
// facts, not origin or transaction ownership, and issues no replay authority.
export function verifyDesktopPurchaseAccountReadback(plan,sets){
 if(!plan||!Array.isArray(sets)||sets.length!==4||sets.some(a=>!Array.isArray(a)||a.length!==1))fail();
 const [invoice,supplier,account,movement]=sets.map(x=>x[0]);
 if(invoice.invoiceId!==plan.invoiceId||invoice.supplierId!==plan.supplierId||invoice.status!=='finalized'||invoice.documentCurrency!=='TRY'||invoice.accountCurrency!=='TRY'||invoice.amountExact4!==plan.amountExact4||invoice.accountAmountExact4!==plan.amountExact4||supplier.supplierId!==plan.supplierId||supplier.entityId!==plan.entityId||supplier.currency!=='TRY'||supplier.balanceExact4!==plan.supplierAfterExact4||account.accountId!==plan.accountId||account.supplierId!==plan.supplierId||account.entityId!==plan.entityId||account.currency!=='TRY'||account.balanceExact8!==plan.accountAfterExact8||!id(movement.movementId)||movement.invoiceId!==plan.invoiceId||movement.supplierId!==plan.supplierId||movement.entityId!==plan.entityId||movement.accountId!==plan.accountId||movement.movementType!=='purchase_invoice'||movement.currency!=='TRY'||movement.accountCurrency!=='TRY'||movement.amountExact4!==plan.amountExact4||movement.accountAmountExact4!==plan.amountExact4||movement.balanceEffectExact4!==plan.amountExact4)fail();return true;
}
