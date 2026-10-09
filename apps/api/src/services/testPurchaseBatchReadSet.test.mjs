import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {testBatchHeaderIdsJSON,TEST_BATCH_RECEIPT_READ_SQL,testBatchInvoiceTotalsMatch} from './testPurchaseBatchReadSet.mjs';
test('a selected USD receipt keeps its lines after 101 newer TRY/other-supplier/copy receipts',()=>{
 const selected=[{id:10,currency:'USD',supplier:1,copy:'A'}],other=Array.from({length:101},(_,i)=>({id:100+i,currency:'TRY',supplier:2,copy:'B'}));
 const allLines=[...selected,...other].map(h=>({id:h.id+1000,batch_id:h.id}));
 const globalRecent=new Set([...selected,...other].sort((a,b)=>b.id-a.id).slice(0,100).map(h=>h.id));assert.equal(allLines.filter(l=>globalRecent.has(l.batch_id)&&l.batch_id===10).length,0);
 const ids=new Set(JSON.parse(testBatchHeaderIdsJSON(selected)).map(Number));assert.deepEqual(allLines.filter(l=>ids.has(l.batch_id)),[{id:1010,batch_id:10}]);assert.ok(TEST_BATCH_RECEIPT_READ_SQL.includes('OPENJSON(@batchHeaderIds)'));assert.ok(!TEST_BATCH_RECEIPT_READ_SQL.includes('TOP(100)'));
});
test('exact 100 selected headers plus a named older source form one bounded read set; empty sets stay empty',()=>{
 const headers=[{id:1},...Array.from({length:100},(_,i)=>({id:100+i}))];assert.equal(JSON.parse(testBatchHeaderIdsJSON(headers)).length,101);assert.deepEqual(JSON.parse(testBatchHeaderIdsJSON([])),[]);
 assert.throws(()=>testBatchHeaderIdsJSON([...headers,{id:500}]));assert.throws(()=>testBatchHeaderIdsJSON([{id:1},{id:1}]));assert.throws(()=>testBatchHeaderIdsJSON([{id:'9007199254740992'}]));
});
test('the native context feeds its exact returned header IDs into the receipt query and scopes recent headers to the selected supplier',()=>{
 const src=fs.readFileSync(new URL('./testPurchaseService.mjs',import.meta.url),'utf8');assert.ok(src.includes('testBatchHeaderIdsJSON(headers)).query(TEST_BATCH_RECEIPT_READ_SQL)'));assert.ok(src.includes("AND supplier_id=${d.s.supplier_id} ORDER BY id DESC"));
});
test('actual source prices 4.45+4.65 match native9.1000 without accepting a one-unit decimal4 mismatch',()=>{
 assert.notEqual(4.45+4.65,9.1);const items=[{line_total_exact4:'4.4500'},{line_total_exact4:'4.6500'}];assert.equal(testBatchInvoiceTotalsMatch(items,'9.1000'),true);assert.equal(testBatchInvoiceTotalsMatch(items,'9.1001'),false);
 assert.equal(testBatchInvoiceTotalsMatch([{line_total_exact4:'0.0001'},{line_total_exact4:'19999.9999'}],'20000.0000'),true);assert.equal(testBatchInvoiceTotalsMatch([{line_total_exact4:'1.2345'}],'1.2345'),true);
 for(const total of ['9.1','9.10000',9.1,null,'-9.1000'])assert.equal(testBatchInvoiceTotalsMatch(items,total),false);
 assert.equal(testBatchInvoiceTotalsMatch([{line_total_exact4:'4.4500'},{line_total_exact4:null}],'9.1000'),false);
 const src=fs.readFileSync(new URL('./testPurchaseService.mjs',import.meta.url),'utf8');assert.ok(src.includes('testBatchInvoiceTotalsMatch(items,header.grand_total_exact4)'));assert.ok(src.includes('CONVERT(decimal(28,4),i.line_total)'));assert.ok(src.includes('CONVERT(decimal(28,4),p.grand_total)'));
});
