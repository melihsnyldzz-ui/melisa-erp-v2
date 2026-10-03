import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
async function fixture(){
 const calls=[],context=vm.createContext({});const module=new vm.SourceTextModule(await readFile(new URL('./receiptApi.js',import.meta.url),'utf8'),{context});
 await module.link(()=>new vm.SyntheticModule(['get'],function(){this.setExport('get',(...args)=>{calls.push(args);return Promise.resolve({success:true});});},{context}));await module.evaluate();return {api:module.namespace,calls};
}
test('receipt API client uses only existing GET transport and forwards caller abort options without demo fallback',async()=>{
 const f=await fixture(),params={source:'SYNTHETIC',page:2},options={signal:new AbortController().signal};await f.api.fetchInventoryReceipts(params,options);
 assert.equal(f.calls[0][0],'/api/inventory-receipts');assert.equal(f.calls[0][1],params);assert.equal(f.calls[0][2],options);
 await f.api.fetchInventoryReceipt('9007199254740993','SYNTHETIC',options);assert.equal(f.calls[1][0],'/api/inventory-receipts/9007199254740993');assert.equal(f.calls[1][1].source,'SYNTHETIC');assert.equal(f.calls[1][2],options);
 assert.deepEqual(Object.keys(f.api).sort(),['fetchInventoryReceipt','fetchInventoryReceipts','fetchReceiptLineIdentity']);
});
test('receipt API client rejects rounded or injected ID before transport',async()=>{
 const f=await fixture();for(const id of [1,'01','0','1/approve','9223372036854775808',null])assert.throws(()=>f.api.fetchInventoryReceipt(id,'SYNTHETIC'));assert.equal(f.calls.length,0);
});

