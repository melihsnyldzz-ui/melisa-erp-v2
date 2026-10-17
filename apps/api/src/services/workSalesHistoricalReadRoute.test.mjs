import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorkSalesService} from './workSalesService.mjs';
const actor={id:'15',permissions:['sales.view','sales.create']};
function fixture(historical=true){const calls=[],context={capabilities:{canCreate:true}},domain={context,selectedSaleEnabled:true,selectedSaleOptions:()=>({enabled:true}),selectedSaleContext:()=>context,invoice:async id=>({id}),list:async p=>({data:[],meta:p})};const store={read:async function(a,fn){assert.equal(this,store);calls.push('read');return fn(domain);},context:async()=>{calls.push('context');return context;},selectedSaleEnabled:async()=>true};if(historical)store.readHistoricalSale=async function(a,fn){assert.equal(this,store);calls.push('historical');return fn(domain);};return {calls,service:createWorkSalesService({getStore:async()=>store})};}
test('only invoice/list choose historical route; context/options/selectedContext keep existing read',async()=>{
 const f=fixture();assert.deepEqual(await f.service.invoice('34634',actor),{id:'34634'});assert.deepEqual((await f.service.list({page:'2',limit:'50'},actor)).meta,{page:2,limit:50});await f.service.context(actor);await f.service.selectionOptions(actor);await f.service.selectedContext({customerId:'1',currency:'TRY',productIds:['1']},actor);assert.deepEqual(f.calls,['historical','historical','context','read','read']);
});
test('legacy store uses original read; query/permission strictness remains',async()=>{
 const f=fixture(false);await f.service.invoice('34634',actor);await f.service.list({},actor);assert.deepEqual(f.calls,['read','read']);await assert.rejects(f.service.invoice('34634',{id:'15',permissions:[]}));await assert.rejects(f.service.list({skipReady:'true'},actor));await assert.rejects(f.service.list({limit:'51'},actor));
});
test('trade wrapper forwards historical flag only explicit method and leaves mutation dispatch unchanged',()=>{
 const source=fs.readFileSync(new URL('./workTradeStore.mjs',import.meta.url),'utf8');assert.match(source,/readHistoricalSale:\(actor,fn,permission\)=>transaction\(actor,false,null,null,fn,permission,true\)/);assert.match(source,/read:\(actor,fn,permission\)=>transaction\(actor,false,null,null,fn,permission\)/);assert.match(source,/return write\?store\.mutate\(actor,operation,payload,fn\):\(historicalSale\?store\.readHistoricalSale\?\?store\.read:store\.read\)\.call\(store,actor,fn,readPermission\)/);
});
