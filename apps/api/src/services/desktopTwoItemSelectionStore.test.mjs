import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopTwoItemSelectionStore} from './desktopTwoItemSelectionStore.mjs';

test('locks two products in deterministic order and returns the requested order',async()=>{
 const transaction={},scope={},seen=[];
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(k,_type,v){this.params[k]=v;return this;}async query(){seen.push(this.params.productId);return {recordsets:[[{id:'2',currency:'TRY'}],[{id:this.params.productId}]]};}}
 const select=createDesktopTwoItemSelectionStore({sql:{Request,NVarChar:()=>{}},verifyScope:async value=>value.transaction===transaction&&value.scope===scope&&['5','9'].includes(value.productId)});
 const result=await select({transaction,scope,customerId:'2',productIds:['9','5']});
 assert.deepEqual(seen,['5','9']);assert.deepEqual(result.products.map(p=>p.id),['9','5']);
 await assert.rejects(select({transaction,scope,customerId:'2',productIds:['5','5']}));
 await assert.rejects(select({transaction,scope,customerId:'2',productIds:['5','10']}));
});
test('refuses inconsistent customer snapshots within the transaction',async()=>{
 let count=0;class Request{constructor(){this.params={};}input(k,_type,v){this.params[k]=v;return this;}async query(){return {recordsets:[[{id:'2',balance:++count}],[{id:this.params.productId}]]};}}
 const select=createDesktopTwoItemSelectionStore({sql:{Request,NVarChar:()=>{}},verifyScope:async()=>true});
 await assert.rejects(select({transaction:{},scope:{},customerId:'2',productIds:['5','9']}));
});
