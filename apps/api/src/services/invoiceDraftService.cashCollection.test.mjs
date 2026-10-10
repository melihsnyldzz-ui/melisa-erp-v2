import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./invoiceDraftService.js',import.meta.url),'utf8');
const start=source.indexOf('    let autoCashCollection = null;',source.indexOf('export async function finalizeSalesInvoice('));
const end=source.indexOf('    const finalizeResult =',start);
assert(start>0&&end>start);
const productionBlock=source.slice(start,end);

// Execute the production automatic collection branch with a trigger-bearing
// database mock. Its result is consumed by currency and cash account writers.
async function collect({nativeTransaction=false,isolatedCopy=false,cashCustomer=true,amount=125,sqlFailure=false}={}){
 const transaction={},queries=[],snapshotCalls=[],financeCalls=[];
 const inserted={id:91,customer_id:21,sales_invoice_id:31,movement_type:'collection',amount,currency_code:'TRY'};
 class Request{
  constructor(tx){assert.equal(tx,transaction);this.params={};}
  input(name,_type,value){this.params[name]=value;return this;}
  async query(sql){
   queries.push({sql,params:this.params});
   // SQL Server rejects an OUTPUT result sent directly from enabled-trigger DML.
   if(/OUTPUT\s+inserted\.\*/i.test(sql)||!/OUTPUT\s+inserted\.id\s+INTO\s+@cashCollectionMovementIds\(id\)/i.test(sql))throw Object.assign(Error('trigger output conflict'),{number:334});
   assert.match(sql,/SELECT m\.\* FROM dbo\.customer_movements m\s+JOIN @cashCollectionMovementIds captured ON captured\.id = m\.id/);
   assert.equal(this.params.cashCollectionCustomerId,inserted.customer_id);
   assert.equal(this.params.cashCollectionInvoiceId,inserted.sales_invoice_id);
   assert.equal(this.params.cashCollectionAmount,amount);
   assert.equal(this.params.cashCollectionCreatedBy,16);
   if(sqlFailure)throw Object.assign(Error('native guard rejected'),{number:51904});
   // Return the row reread after the guard triggers, not trigger row counts.
   return {rowsAffected:[0,1,0],recordset:[inserted]};
  }
 }
 const sqlDriver={Request},sql={BigInt:0,Decimal:()=>0,NVarChar:()=>0,Date:0};
 const sandbox={transaction,sqlDriver,sql,nativeTransaction,invoiceId:31,actor:{id:'16'},beforeSnapshot:{customerId:21,customerCode:'CASH-TRY',documentNo:'SALE-31',grandTotal:amount,documentCurrency:'TRY',documentDate:'2026-10-09'},settlement:{accountAmount:amount},isIsolatedOperationCopyRuntime:()=>isolatedCopy,isCashCustomerCode:()=>cashCustomer,resolveFinanceAccount:async(tx,driver,args)=>{assert.equal(tx,transaction);assert.equal(driver,sqlDriver);assert.equal(args.currency,'TRY');return{id:41};},writeMovementCurrencySnapshot:async(req,kind,id,snapshot,effect)=>{assert(req instanceof Request);snapshotCalls.push({kind,id,snapshot,effect});},writeFinanceAccountMovement:async(tx,driver,args)=>{assert.equal(tx,transaction);assert.equal(driver,sqlDriver);financeCalls.push(args);return{id:41,code:'CASH-41'};}};
 vm.createContext(sandbox);vm.runInContext('globalThis.run=async()=>{'+productionBlock+'return autoCashCollection;}',sandbox);
 return {result:await sandbox.run(),queries,snapshotCalls,financeCalls,inserted};
}

test('trigger-safe cash collection rereads captured movement and retains currency/cash result semantics',async()=>{
 const f=await collect();
 assert.equal(f.queries.length,1);
 assert.equal(f.snapshotCalls.length,1);assert.equal(f.snapshotCalls[0].kind,'customer');assert.equal(f.snapshotCalls[0].id,91);assert.equal(f.snapshotCalls[0].effect,-125);
 assert.equal(f.financeCalls.length,1);assert.equal(f.financeCalls[0].partyMovementId,91);assert.equal(f.financeCalls[0].sourceType,'collection');assert.equal(f.financeCalls[0].amount,125);
 assert.deepEqual(JSON.parse(JSON.stringify(f.result)),{movementId:91,customerId:21,customerCode:'CASH-TRY',amount:125,currency:'TRY',accountId:41,accountCode:'CASH-41'});
});

test('native, non-cash and zero-total sales retain automatic collection exclusion',async()=>{
 for(const options of [{nativeTransaction:true},{cashCustomer:false},{amount:0}]){const f=await collect(options);assert.equal(f.result,null);assert.equal(f.queries.length,0);assert.equal(f.snapshotCalls.length,0);assert.equal(f.financeCalls.length,0);}
});

test('isolated cash customer sale preserves debt for its separately journaled explicit collection',async()=>{
 const f=await collect({isolatedCopy:true});
 assert.equal(f.result,null);assert.equal(f.queries.length,0);assert.equal(f.snapshotCalls.length,0);assert.equal(f.financeCalls.length,0);
});

test('native collection guard failure propagates before currency and cash account linking',async()=>{
 await assert.rejects(()=>collect({sqlFailure:true}),{number:51904});
});
