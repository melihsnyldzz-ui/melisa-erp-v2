import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopTwoItemLockedSelection} from './desktopTwoItemLockedSelection.mjs';

test('locks both product selections before reading reservation ranges in product order',async()=>{
 const events=[],transaction={},scope={};
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(k,_t,v){this.params[k]=v;return this;}async query(q){
  const id=this.params.productId;if(q.includes('desktop_sale_reservations')){events.push('reserve:'+id);return {recordset:[{reservedExact3:id==='5'?'1.000':'0.000'}]};}
  events.push('product:'+id);return {recordsets:[[{id:'2'}],[{id}]]};
 }}
 const read=createDesktopTwoItemLockedSelection({sql:{Request,NVarChar:()=>{}},verifyScope:async v=>v.transaction===transaction&&v.scope===scope&&['5','9'].includes(v.productId)});
 const result=await read({transaction,scope,customerId:'2',productIds:['9','5']});
 assert.deepEqual(events,['product:5','product:9','reserve:5','reserve:9']);
 assert.deepEqual(result.products.map(v=>v.id),['9','5']);assert.deepEqual(result.reservedExact3,['0.000','1.000']);
});
test('refuses malformed or unavailable reservation totals',async()=>{
 class Request{constructor(){this.params={};}input(k,_t,v){this.params[k]=v;return this;}async query(q){return q.includes('desktop_sale_reservations')?{recordset:[{reservedExact3:'-1.000'}]}:{recordsets:[[{id:'2'}],[{id:this.params.productId}]]};}}
 const read=createDesktopTwoItemLockedSelection({sql:{Request,NVarChar:()=>{}},verifyScope:async()=>true});
 await assert.rejects(read({transaction:{},scope:{},customerId:'2',productIds:['5','9']}));
});
