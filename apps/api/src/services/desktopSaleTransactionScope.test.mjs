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
test('dispatch-only view requirement rejects a create/finalize actor before SQL and preserves draft default',async()=>{
 let reads=0,entered=false;const rights=new Set(['sales.create','sales.finalize']),seen=[];
 class Request{async query(){reads++;return {recordset:[{targetDatabase:'desktop',sessionId:3,transactionId:'19',transactionCount:1,transactionState:1}]};}}
 const verifySession=async({transaction,actorId,permission})=>{assert.equal(transaction,args.transaction);assert.equal(actorId,args.actorId);seen.push(permission);return permission.every(p=>rights.has(p));};
 const dispatch=createDesktopSaleTransactionScope({sql:{Request},verifySession,requireSalesView:true});
 await assert.rejects(dispatch.withScope(args,()=>{entered=true;}));assert.equal(entered,false);assert.equal(reads,0);assert.deepEqual(seen[0],['sales.create','sales.finalize','sales.view']);
 const draft=createDesktopSaleTransactionScope({sql:{Request},verifySession});await draft.withScope(args,()=>{entered=true;});assert.equal(entered,true);assert.deepEqual(seen[1],['sales.create','sales.finalize']);
 rights.add('sales.view');await dispatch.withScope(args,()=>{});assert.equal(reads,2);
 assert.throws(()=>createDesktopSaleTransactionScope({sql:{Request},verifySession,requireSalesView:'true'}));
});
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
 for(const productIds of [['5','5'],[],['5','9','10']])await assert.rejects(f.api.withScope({...rest,productIds},()=>{}));
 await assert.rejects(f.api.withScope({...multi,productId},()=>{}));
});

test('one-element selection retains transaction, product and invoice binding',async()=>{
 const f=setup(),{productId,...rest}=args;
 await f.api.withScope({...rest,productIds:['5']},async({scope,bindInvoice})=>{
  assert.deepEqual(scope.productIds,['5']);
  assert.equal(f.api.verifyScope({transaction:args.transaction,scope,productId:'5'}),true);
  assert.equal(f.api.verifyScope({transaction:args.transaction,scope,productId:'9'}),false);
  assert.throws(()=>bindInvoice({customerId:'2',lines:[]},'12'));
  assert.throws(()=>bindInvoice({customerId:'2',lines:[{productId:'5'},{productId:'9'}]},'12'));
  const bound=bindInvoice({customerId:'2',lines:[{productId:'5'}]},'12');
  assert.equal(f.api.verifyScope({transaction:args.transaction,scope:bound,invoiceId:'12',productId:'5'}),true);
 });
});
