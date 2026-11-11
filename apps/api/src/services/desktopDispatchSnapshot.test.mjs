import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopDispatchSnapshotReader} from './desktopDispatchSnapshot.mjs';

function fixture(single=false){
 const transaction={},scope={},events=[];let lastQuantity='1.000';
 class Request{constructor(tx){assert.equal(tx,transaction);this.args={};}input(k,_t,v){this.args[k]=v;return this;}async query(sql){
  if(sql.includes('desktop_sale_workflows w')){events.push('workflow');const recordsets=[[{workflowState:'CHECKED',invoiceState:'draft',invoiceId:'12'}],[{itemId:'1',productId:'5',quantityExact3:'2.000'},{itemId:'2',productId:'9',quantityExact3:'1.000'}],[{itemId:'1',productId:'5',state:'ACTIVE',quantityExact3:'2.000'},{itemId:'2',productId:'9',state:'ACTIVE',quantityExact3:'1.000'}],[{cartonNo:1,itemId:'1',productId:'5',quantityExact3:'2.000'},{cartonNo:2,itemId:'2',productId:'9',quantityExact3:lastQuantity}]];if(single)for(let i=1;i<recordsets.length;i++)recordsets[i]=recordsets[i].slice(0,1);return {recordsets};}
  if(sql.includes('desktop_sale_reservations')){events.push(sql.includes('invoice_id<>')?'other:'+this.args.productId:'all:'+this.args.productId);return {recordset:[sql.includes('invoice_id<>')?{otherReservedExact3:'0.000'}:{reservedExact3:'2.000'}]};}
  events.push('product:'+this.args.productId);return {recordsets:[[{id:'2'}],[{id:this.args.productId,stockExact3:'4.000'}]]};
 }}
 const read=createDesktopDispatchSnapshotReader({sql:{Request,NVarChar:()=>{}},verifyScope:async v=>v.transaction===transaction&&v.scope===scope&&v.customerId==='2'&&['5','9'].includes(v.productId)&&(!v.invoiceId||v.invoiceId==='12')});
 return {read,transaction,scope,events,incomplete(){lastQuantity='0.500';}};
}
test('locks one invoice and both product/reservation ranges before validating packing',async()=>{
 const f=fixture(),result=await f.read({transaction:f.transaction,scope:f.scope,invoiceId:'12',customerId:'2',productIds:['9','5']});
 assert.equal(result.invoiceId,'12');assert.deepEqual(f.events,['product:5','product:9','all:5','all:9','workflow','other:5','other:9']);
});
test('incomplete packing and wrong invoice scope reject before dispatch',async()=>{
 const f=fixture();f.incomplete();await assert.rejects(f.read({transaction:f.transaction,scope:f.scope,invoiceId:'12',customerId:'2',productIds:['5','9']}));
 await assert.rejects(f.read({transaction:f.transaction,scope:f.scope,invoiceId:'13',customerId:'2',productIds:['5','9']}));
});

test('one-line snapshot locks only its selected product and rejects mismatched persisted rows',async()=>{
 const f=fixture(true),result=await f.read({transaction:f.transaction,scope:f.scope,invoiceId:'12',customerId:'2',productIds:['5']});
 assert.equal(result.lines.length,1);assert.equal(result.reservations.length,1);assert.deepEqual(f.events,['product:5','all:5','workflow','other:5']);
 const mismatch=fixture();await assert.rejects(mismatch.read({transaction:mismatch.transaction,scope:mismatch.scope,invoiceId:'12',customerId:'2',productIds:['5']}));
 for(const productIds of [[],['5','5'],['5','9','10']]){const invalid=fixture(true);await assert.rejects(invalid.read({transaction:invalid.transaction,scope:invalid.scope,invoiceId:'12',customerId:'2',productIds}));assert.deepEqual(invalid.events,[]);}
});
