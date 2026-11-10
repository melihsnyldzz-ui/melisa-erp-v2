import test from 'node:test';
import assert from 'node:assert/strict';
import {listDesktopGoodsReceipts,GOODS_RECEIPTS_LIST_SQL} from './desktopGoodsReadService.mjs';
const header=id=>({id:String(id),version:1,state:'draft',documentNo:'F-'+id,documentDate:'2026-11-10',supplierId:'2',purchaseInvoiceId:String(id+100)});
function fixture(rows){const calls=[],transaction={};class Request{constructor(tx){assert.equal(tx,transaction);}input(...args){calls.push(args);return this;}async query(text){calls.push(text);return {recordset:rows};}}return {sql:{Request,BigInt:'bigint',Int:'int'},transaction,calls};}
test('goods history binds only current actor and bounded offset, returns first twenty in descending order',async()=>{
 const f=fixture(Array.from({length:21},(_,i)=>header(50-i)));const value=await listDesktopGoodsReceipts({...f,actorId:'30002',page:2});
 assert.deepEqual(f.calls.slice(0,2),[['actor','bigint','30002'],['offset','int',20]]);assert.equal(f.calls[2],GOODS_RECEIPTS_LIST_SQL);assert.match(GOODS_RECEIPTS_LIST_SQL,/WHERE created_by=@actor ORDER BY id DESC OFFSET @offset ROWS FETCH NEXT 21 ROWS ONLY/);assert.doesNotMatch(GOODS_RECEIPTS_LIST_SQL,/INSERT|UPDATE|DELETE|MERGE|quote_json/i);assert.equal(value.rows.length,20);assert.equal(value.rows[0].id,'50');assert.equal(value.rows[19].id,'31');assert.equal(value.hasNext,true);assert.equal(value.page,2);
});
test('goods history handles empty and last pages; invalid bounds and corrupt headers fail closed',async()=>{
 for(const rows of [[],[header(1)]]){const value=await listDesktopGoodsReceipts({...fixture(rows),actorId:'7',page:10000});assert.equal(value.hasNext,false);assert.deepEqual(value.rows,rows);}
 for(const page of [0,-1,10001,1.5,'1',null]){const f=fixture([]);await assert.rejects(listDesktopGoodsReceipts({...f,actorId:'7',page}));assert.equal(f.calls.length,0);}
 for(const rows of [[header(1),header(2)],[header(1),header(1)],Array.from({length:22},(_,i)=>header(30-i)),[{...header(1),documentDate:'2026-02-30'}],[{...header(1),state:'cancelled'}],[{...header(1),documentNo:'x\n'}]])await assert.rejects(listDesktopGoodsReceipts({...fixture(rows),actorId:'7'}));
});
