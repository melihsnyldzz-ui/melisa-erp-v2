import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
async function fixture(){
 const calls=[],context=vm.createContext({structuredClone}),module=new vm.SourceTextModule(await readFile(new URL('./receiptDraftApi.js',import.meta.url),'utf8'),{context});
 await module.link(()=>new vm.SyntheticModule(['post'],function(){this.setExport('post',(path,body)=>{calls.push({path,body});return Promise.resolve({success:true})})},{context}));
 await module.evaluate();return {calls,api:module.namespace};
}

test('resolution client preserves reviewed evidence and rejects invented unit multiplier or injected line identity',async()=>{
 const f=await fixture(),body={source:'SYNTHETIC',requestId:'request-0001',expectedVersion:0,productId:'8',observedEvidenceHash:'a'.repeat(64),confirmedUnit:'adet',confirmedUnitMultiplier:'1',reason:'incelendi'};
 await f.api.resolveInventoryReceiptLine('1','9',body);assert.equal(f.calls[0].path,'/api/inventory-receipts/1/lines/9/resolve');assert.equal(f.calls[0].body.observedEvidenceHash,body.observedEvidenceHash);
 for(const patch of [{lineId:'99'},{actorId:'7'},{confirmedUnitMultiplier:'2'},{observedEvidenceHash:'bad'}])assert.throws(()=>f.api.resolveInventoryReceiptLine('1','9',{...body,...patch}));assert.equal(f.calls.length,1);
});
test('prepared client binds four routes, preserves request/decimal/code text and snapshots arrays',async()=>{
 const f=await fixture(),base={source:'SYNTHETIC',requestId:'request-0001',expectedVersion:0};
 const create={source:base.source,requestId:base.requestId,supplierId:'9',documentDate:'2026-09-24',dispatchNumber:'0001',observedOpenReceipts:[{id:'8',version:2}]};
 await f.api.createInventoryReceipt(create);create.observedOpenReceipts[0].version=9;assert.equal(f.calls[0].body.observedOpenReceipts[0].version,2);
 await f.api.appendInventoryReceiptLine('9007199254740993',{...base,productId:'44',quantity:'2.125'});
 await f.api.captureInventoryReceiptLine('42',{...base,barcode:'0000123',supplierModelCode:null,quantity:'0.000'});
 await f.api.editInventoryReceiptQuantities('42',{...base,quantities:[{lineId:'2',quantity:'1.125'}]});
 assert.deepEqual(f.calls.map(c=>c.path),['/api/inventory-receipts','/api/inventory-receipts/9007199254740993/lines','/api/inventory-receipts/42/captured-lines','/api/inventory-receipts/42/draft-quantities']);
 assert.equal(f.calls[2].body.barcode,'0000123');assert.equal(f.calls[2].body.quantity,'0.000');assert.equal(f.calls[3].body.requestId,base.requestId);
});
test('client refuses injected action/actor, rounded ID or missing request identity before transport',async()=>{
 const f=await fixture(),base={source:'SYNTHETIC',requestId:'request-0001',expectedVersion:0,productId:'1',quantity:'1'};
 for(const identity of [1,'01','1/approve','9223372036854775808'])assert.throws(()=>f.api.appendInventoryReceiptLine(identity,base));
 for(const patch of [{actorId:'7'},{action:'approve'},{requestId:''},{expectedVersion:null}])assert.throws(()=>f.api.appendInventoryReceiptLine('42',{...base,...patch}));
 assert.equal(f.calls.length,0);
});
test('transition client maps exact actions, requires stable identity and excludes injected fields',async()=>{
 const f=await fixture(),base={source:'SYNTHETIC',requestId:'request-0001',expectedVersion:2};
 for(const action of ['submit','return','approve','correct'])await f.api.transitionInventoryReceipt('42',action,{...base,...(['return','correct'].includes(action)?{reason:'fixture'}:{}),...(action==='correct'?{quantities:[{lineId:'8',quantity:'0.125'}]}:{})});
 assert.deepEqual(f.calls.map(c=>c.path),['submit','return','approve','correct'].map(a=>`/api/inventory-receipts/42/${a}`));
 assert.throws(()=>f.api.transitionInventoryReceipt('42','cancel',base));assert.throws(()=>f.api.transitionInventoryReceipt('42','approve',{...base,actorId:'1'}));
});
test('allocation client binds exact invoice rowversion and snapshots receipt revisions',async()=>{const f=await fixture(),body={source:'SYNTHETIC',requestId:'allocation-0001',expectedInvoiceVersion:'0x0000000000000001',allocations:[{receiptLineId:'8',invoiceLineId:'9',expectedReceiptVersion:2,quantity:'0.125'}]};await f.api.allocatePurchaseReceiptLines('42',body);body.allocations[0].quantity='99';assert.equal(f.calls[0].path,'/api/purchase-invoices/42/receipt-allocations');assert.equal(f.calls[0].body.allocations[0].quantity,'0.125');assert.throws(()=>f.api.allocatePurchaseReceiptLines('42',{...body,expectedInvoiceVersion:1}));});

