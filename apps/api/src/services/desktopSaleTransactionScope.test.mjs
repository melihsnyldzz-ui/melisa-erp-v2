import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopSaleTransactionScope} from './desktopSaleTransactionScope.mjs';
const args={transaction:{},actorId:'8',requestId:'da171000-6f42-4f19-8cab-9f4539618647',customerId:'2',productId:'5'};
function setup(allowed=true,row={targetDatabase:'desktop',sessionId:3,transactionId:'19',transactionCount:1,transactionState:1}){let calls=[];class Request{constructor(tx){calls.push(tx);}async query(){return {recordset:[row]};}}return {api:createDesktopSaleTransactionScope({sql:{Request},verifySession:async a=>{calls.push(a);return allowed;}}),calls};}
test('both current sale permissions are required and scope binds transaction, selection and invoice',async()=>{
 const f=setup();let base,bound;await f.api.withScope(args,async context=>{base=context.scope;assert.equal(f.api.verifyScope({transaction:args.transaction,scope:base,customerId:'2',productId:'5'}),true);assert.equal(f.api.verifyScope({transaction:{},scope:base}),false);assert.equal(f.api.verifyScope({transaction:args.transaction,scope:{...base}}),false);
  bound=context.bindInvoice({customerId:'2',productId:'5',accountId:'4'},'12');assert.equal(f.api.verifyScope({transaction:args.transaction,scope:bound,invoiceId:'12'}),true);assert.equal(f.api.verifyScope({transaction:args.transaction,scope:bound,invoiceId:'13'}),false);assert.throws(()=>context.bindInvoice({customerId:'2',productId:'5'},'13'));});
 assert.deepEqual(f.calls[0].permission,['sales.create','sales.finalize']);assert.equal(f.api.verifyScope({transaction:args.transaction,scope:base}),false);assert.equal(f.api.verifyScope({transaction:args.transaction,scope:bound}),false);
});
test('denied authority and invalid transaction state cannot construct sale scope',async()=>{const denied=setup(false);await assert.rejects(denied.api.withScope(args,()=>{}));assert.equal(denied.calls.length,1);const bad=setup(true,{targetDatabase:'desktop',sessionId:3,transactionId:'19',transactionCount:1,transactionState:-1});await assert.rejects(bad.api.withScope(args,()=>{}));});
test('two distinct products share one authenticated transaction and invoice scope',async()=>{
 const f=setup(),{productId,...rest}=args,multi={...rest,productIds:['5','9']};
 await f.api.withScope(multi,async ({scope,bindInvoice})=>{
  assert.equal(f.api.verifyScope({transaction:args.transaction,scope,productId:'5'}),true);
  assert.equal(f.api.verifyScope({transaction:args.transaction,scope,productId:'9'}),true);
  assert.equal(f.api.verifyScope({transaction:args.transaction,scope,productId:'10'}),false);
  assert.throws(()=>bindInvoice({customerId:'2',lines:[{productId:'9'},{productId:'5'}]},'12'));
  const bound=bindInvoice({customerId:'2',lines:[{productId:'5'},{productId:'9'}]},'12');
  assert.equal(f.api.verifyScope({transaction:args.transaction,scope:bound,invoiceId:'12'}),true);
 });
 for(const productIds of [['5','5'],['5'],['5','9','10']])await assert.rejects(f.api.withScope({...rest,productIds},()=>{}));
 await assert.rejects(f.api.withScope({...multi,productId},()=>{}));
});
