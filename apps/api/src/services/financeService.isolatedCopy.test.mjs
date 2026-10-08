import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';
let registered=null,stampCalls=0,calls=[],wrongMovement=false;
const tx={};
const cash={id:40,account_type:'cash',currency_code:'TRY',is_active:true,current_balance:360,opening_balance:null};
class Request{
 constructor(transaction){assert.equal(transaction,tx);this.params={};}
 input(key,type,value){this.params[key]=value;return this;}
 async query(query){
  calls.push({query,params:this.params});
  if('financeAccountId' in this.params||'updatedFinanceAccountId' in this.params)return{recordset:[cash]};
  if('customerId' in this.params)return{recordset:[{id:20,customer_code:'Musteri',name:'Müşteri',currency_code:'TRY',balance:7395.28000001}]};
  if('supplierId' in this.params)return{recordset:[{id:30,supplier_code:'Tedarikci',name:'Tedarikçi',currency_code:'TRY',balance:166600}]};
  if(/INSERT INTO dbo.(customer|supplier)_movements/.test(query)){
   const role='movementCustomerId' in this.params?'customer':'supplier';
   return{recordset:[{id:90,[role+'_id']:this.params[role==='customer'?'movementCustomerId':'movementSupplierId'],created_by:this.params.createdBy,amount:this.params.amount,currency_code:'TRY',balance_effect:this.params.balanceEffect,document_date:this.params.documentDate,account_currency:wrongMovement?'USD':'TRY',account_amount:this.params.amount,amount_try:this.params.amount,document_exchange_rate_snapshot:1,account_exchange_rate_snapshot:1}]};
  }
  if(query.includes('INSERT INTO dbo.finance_account_movements'))return{recordset:[]};
  throw Error('Unexpected offline SQL');
 }
}
const driver={Request,BigInt:0,NVarChar:()=>0,Decimal:()=>0,Date:0};
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>{throw Error('Copy engine must reuse same TX');},getSqlDriver:()=>driver,isIsolatedOperationCopyRuntime:()=>!!registered,getIsolatedOperationCopyConfig:()=>registered}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{}}});
mock.module('./periodLockService.js',{namedExports:{assertAccountingPeriodOpen:async()=>{}}});
mock.module('./operationQuarantineService.js',{namedExports:{assertOperationQuarantineAllowed:async()=>{},quarantineTransactionContext:(driver,transaction)=>({driver,transaction})}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async()=>{}}});
mock.module('./currencySettlementStore.mjs',{namedExports:{assertCurrencySnapshotSchema:async()=>{},hasCurrencySnapshotSchema:async()=>true,hasMovementReturnSchema:async()=>true,resolveCurrencySettlement:async(_request,value)=>({...value,documentRateToTry:1,accountRateToTry:1,accountAmount:value.documentAmount,amountTry:value.documentAmount}),writeMovementCurrencySnapshot:async()=>{stampCalls++;},movementCurrencyColumns:()=>'',movementCurrencyDto:v=>v}});
const {createCustomerCollection,createSupplierPayment,isolatedCopyFinanceSettlement}=await import('./financeService.js');
function copyFixture(){const raw=fixtureContext();raw.suppliers[0].currency='TRY';const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);return validateIsolatedOperationCopyContext(raw);}

test('copy payment and collection atomically include native settlement while original path still stamps',async()=>{
 const copy=copyFixture(),actor={id:'16'},payload={amount:20,currency:'TRY',paymentMethod:'cash',accountId:40,documentDate:copy.date},context={transaction:tx,pool:{},sqlDriver:driver};
 registered=copy;calls=[];stampCalls=0;
 try{
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
   for(const [role,method,id] of [['customer',createCustomerCollection,20],['supplier',createSupplierPayment,30]]){
    const result=await method({...payload,[role+'Id']:id},actor,context);assert.equal(result.accountAmount,20);
    const insert=calls.findLast(c=>c.query.includes('INSERT INTO dbo.'+role+'_movements'));
    assert.match(insert.query,/created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try/);
    assert.match(insert.query,/@createdBy,N'TRY',@amount,1,1,@amount/);assert.equal(insert.params.createdBy,16);assert.equal(insert.params.balanceEffect,-20);
   }
  });
  assert.equal(stampCalls,0);
  wrongMovement=true;
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
   await assert.rejects(createSupplierPayment({...payload,supplierId:30},actor,context),{code:'ISOLATED_COPY_FINANCE_SETTLEMENT'});
  });
 }finally{registered=null;wrongMovement=false;}
 await createCustomerCollection({...payload,customerId:20},actor,context);await createSupplierPayment({...payload,supplierId:30},actor,context);assert.equal(stampCalls,2);
 const legacyInserts=calls.filter(c=>/INSERT INTO dbo.(customer|supplier)_movements/.test(c.query)).slice(-2);assert.equal(legacyInserts.length,2);for(const insert of legacyInserts)assert.doesNotMatch(insert.query,/account_currency|document_exchange_rate_snapshot/);
});
test('copy finance settlement rejects wrong transaction, source party/cash/date/actor and currency before insert',async()=>{
 const copy=copyFixture(),snapshot={documentCurrency:'TRY',accountCurrency:'TRY',documentRateToTry:1,accountRateToTry:1,documentAmount:20,accountAmount:20,amountTry:20},value={role:'customer',partyId:20,accountId:40,documentDate:copy.date,actor:{id:'16'},snapshot};
 registered=copy;
 try{
  assert.throws(()=>isolatedCopyFinanceSettlement(tx,value),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
   assert.equal(isolatedCopyFinanceSettlement(tx,value),copy);
   for(const change of [{partyId:21},{accountId:41},{documentDate:'2026-10-09'},{actor:{id:'1'}},{snapshot:{...snapshot,accountCurrency:'USD'}},{snapshot:{...snapshot,amountTry:21}},{snapshot:null}])assert.throws(()=>isolatedCopyFinanceSettlement(tx,{...value,...change}),{code:'ISOLATED_COPY_FINANCE_SETTLEMENT'});
  });
 }finally{registered=null;}
});
