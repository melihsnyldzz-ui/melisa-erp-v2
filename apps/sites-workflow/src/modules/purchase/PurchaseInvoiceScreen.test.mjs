import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
const module={exports:{}};
const code=transformSync(readFileSync(new URL('./PurchaseInvoiceScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',target:'es2022'}).code;
vm.runInNewContext(code,{module,exports:module.exports,require:()=>({}),Date,console});
const {mapDraftItems,buildPurchaseDraftItems}=module.exports;
test('actual screen mapper keeps database identity distinct from generated UI keys',()=>{
 const input=[{productId:3},{id:'9007199254740993',productId:3},{id:2,productId:3},
  {id:9007199254740992},{id:'9223372036854775808'},{id:'0'},{id:'01'}];
 const before=structuredClone(input),rows=mapDraftItems(input);
 assert.deepEqual(Array.from(rows,r=>r.persistedItemId),[null,'9007199254740993','2',null,null,null,null]);
 assert.equal(rows[0].id,1);assert.equal(rows[1].productId,rows[2].productId);
 assert.notEqual(rows[1].persistedItemId,rows[2].persistedItemId);assert.deepEqual(input,before);
});
test('actual draft payload never substitutes a row position for missing product identity',()=>{
 for(const productId of [undefined,null,0,-1,'0','01','wrong',9007199254740992,'9223372036854775808'])
  assert.throws(()=>buildPurchaseDraftItems([{productId}]),/ürün kimliği/);
 const input=[{productId:'9007199254740993',quantity:2,purchasePrice:3,persistedItemId:'17'},
  {productId:3,quantity:1,purchasePrice:4}];
 const before=structuredClone(input),result=buildPurchaseDraftItems(input);
 assert.equal(result[0].productId,'9007199254740993');assert.equal(result[1].productId,3);
 assert.equal(result[0].quantity,2);assert.equal(result[0].purchasePrice,3);
 assert.equal('persistedItemId' in result[0],false);assert.deepEqual(input,before);
});

