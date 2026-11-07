// Actual PR54 finance module against a synthetic SQL driver and mocked
// transaction guards/currency store. This does not prove SQL Server behavior.
import test from 'node:test';
import assert from 'node:assert/strict';

test('native collection and payment use the caller transaction and write each native effect once',async t=>{
 const tx={},actor={id:7},pool={request(){throw Error('unexpected global pool or DDL');}},events=[];
 let state={customer:80,supplier:40,cash:0,movements:[],cashMoves:[],audit:[]};
 const recordset=(...rows)=>{const a=rows;Object.defineProperty(a,'columns',{value:{id:{}},configurable:true});Object.defineProperty(a,'toTable',{value:()=>{throw Error('metadata function called');},configurable:true});return {recordset:a};};
 class Request{constructor(owner){assert.equal(owner,tx);this.p={};}input(k,_type,v){this.p[k]=v;return this;}async query(q){const p=this.p;
  if(q.includes('FROM dbo.finance_accounts WITH'))return recordset({id:10,account_code:'KASA-TRY',account_name:'Kasa',account_type:'cash',currency_code:'TRY',opening_balance:0,current_balance:state.cash,is_active:true,created_at:new Date('2026-11-07T00:00:00Z')});
  if(q.includes('FROM dbo.customers WITH'))return recordset({id:8,customer_code:'C8',name:'Müşteri',currency_code:'TRY',balance:state.customer});
  if(q.includes('FROM dbo.suppliers WITH'))return recordset({id:18,supplier_code:'S18',name:'Tedarikçi',currency_code:'TRY',balance:state.supplier});
  if(q.includes('INSERT INTO dbo.customer_movements')||q.includes('INSERT INTO dbo.supplier_movements')){const customer=q.includes('customer_movements'),amount=p.amount,id=customer?11:21;assert.equal(p.currency,'TRY');assert.equal(p.balanceEffect,-amount);if(customer)state.customer+=p.balanceEffect;else state.supplier+=p.balanceEffect;state.movements.push({id,amount,role:customer?'customer':'supplier',date:new Date('2026-11-07T00:00:00Z')});events.push('party');return recordset({id});}
  if(q.includes('INSERT INTO dbo.finance_account_movements')){assert.equal(p.accountMovementAmount,20);assert.equal(p.accountMovementCurrency,'TRY');state.cash+=p.accountBalanceEffect;state.cashMoves.push({amount:p.accountMovementAmount,direction:p.accountMovementDirection});events.push('cash');return recordset();}
  if(q.includes('FROM dbo.finance_accounts')&&q.includes('@updatedFinanceAccountId'))return recordset({id:10,account_code:'KASA-TRY',account_name:'Kasa',account_type:'cash',currency_code:'TRY',current_balance:state.cash,is_active:true});
  throw Error('unhandled native SQL');}}
 const sql={Request,BigInt:{},Date:{},NVarChar:()=>({}),Decimal:()=>({})};
 t.mock.module('mssql',{exports:{default:sql}});
 t.mock.module('../config/database.js',{exports:{getSqlDriver:()=>{throw Error('unexpected driver fallback');},getSqlPool:()=>{throw Error('unexpected pool fallback');},isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:()=>null}});
 t.mock.module('./desktopFinanceService.mjs',{exports:{assertDesktopPrivateFinance:({transaction,actorId})=>{assert.equal(transaction,tx);assert.equal(actorId,'7');return true;}}});
 t.mock.module('./operationQuarantineService.js',{exports:{assertOperationQuarantineAllowed:async()=>{events.push('quarantine');},quarantineTransactionContext:()=>({})}});
 t.mock.module('./isolatedOperationCopyScope.mjs',{exports:{isolatedCopyTransactionContext:()=>null}});
 t.mock.module('./isolatedOperationCopyContext.mjs',{exports:{getBusinessDailySelection:()=>null,getBusinessDailyScopeHash:()=>null,BUSINESS_COPY_DATABASE:'COPY'}});
 t.mock.module('./auditService.js',{exports:{writeAuditLog:async(_r,x)=>{state.audit.push(x);events.push('audit');}}});
 t.mock.module('./writeGuardService.js',{exports:{assertMelisaWriteEnabled:()=>{throw Error('unexpected native guard fallback');}}});
 t.mock.module('./periodLockService.js',{exports:{assertAccountingPeriodOpen:async()=>{events.push('period');}}});
 t.mock.module('./currencySettlementStore.mjs',{exports:{assertCurrencySnapshotSchema:async()=>{},hasCurrencySnapshotSchema:async()=>true,hasMovementReturnSchema:async()=>false,resolveCurrencySettlement:async(_r,x)=>({documentCurrency:x.documentCurrency,accountCurrency:x.accountCurrency,documentAmount:x.documentAmount,accountAmount:x.documentAmount,amountTry:x.documentAmount,documentRateToTry:1,accountRateToTry:1}),writeMovementCurrencySnapshot:async()=>{events.push('snapshot');},movementCurrencyColumns:()=>'',movementCurrencyDto:()=>({})}});
 const {createCustomerCollection,createSupplierPayment}=await import('./financeService.js');
 const context={pool,sqlDriver:sql,transaction:tx,desktopPrivateFinance:true,linkedInvoiceId:null},base={accountId:10,amount:20,currency:'TRY',paymentMethod:'cash',documentDate:'2026-11-07',exchangeRate:1,accountExchangeRate:1};
 assert.equal((await createCustomerCollection({...base,customerId:8},actor,context)).id,11);assert.equal(state.customer,60);assert.equal(state.cash,20);
 assert.equal((await createSupplierPayment({...base,supplierId:18},actor,context)).id,21);assert.equal(state.supplier,20);assert.equal(state.cash,0);
 assert.deepEqual(events,['quarantine','period','party','snapshot','cash','audit','quarantine','period','party','snapshot','cash','audit']);assert.equal(state.movements.length,2);assert.equal(state.cashMoves.length,2);assert.equal(state.audit.length,2);
});
