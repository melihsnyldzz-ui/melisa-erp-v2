import test from 'node:test';import assert from 'node:assert/strict';
import {captureDesktopPackingSource,preserveDesktopPackingRequest,readDesktopPackingRecovery,desktopPackingSourceMatches} from './desktopPackingRecovery.mjs';
test('recovery preserves prior requests and compares original product and ordered quantity exactly',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const record={invoiceId:'12',version:'0x0000000000000001',items:[{itemId:'1',productId:'5',quantityExact3:'5.000'}]};
 captureDesktopPackingSource(storage,'8',record);
 const entry=requestId=>({kind:'transition',body:{invoiceId:'12',requestId,expectedVersion:record.version,operation:'SAVE_CARTONS',cartons:[{cartonNo:1,items:[{itemId:'1',quantityExact3:'2.000'}]}]}});
 const first='da171000-6f42-4f19-8cab-9f4539618647',second='da171000-6f42-4f19-8cab-9f4539618648';
 preserveDesktopPackingRequest(storage,'8',entry(first));const original=readDesktopPackingRecovery(storage,'8','12');
 preserveDesktopPackingRequest(storage,'8',entry(second));assert.equal(readDesktopPackingRecovery(storage,'8','12').previousRequestId,first);assert.deepEqual(readDesktopPackingRecovery(storage,'8','12',first),original);
 assert.equal(desktopPackingSourceMatches(original,record),true);
 assert.equal(desktopPackingSourceMatches(original,{...record,items:[{...record.items[0],quantityExact3:'3.000'}]}),false);
 assert.equal(desktopPackingSourceMatches(original,{...record,items:[{...record.items[0],productId:'9'}]}),false);
 assert.throws(()=>captureDesktopPackingSource(storage,'8',{...record,items:[]}));assert.deepEqual(readDesktopPackingRecovery(storage,'8','12',first),original);
});
test('a failed head write keeps immutable archive and retry repairs discoverability before resolving',()=>{
 const data=new Map();let failHead=true;const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(failHead&&!k.includes('.request.')&&!k.includes('.source.'))throw Error('storage unavailable');data.set(k,v);}};
 const record={invoiceId:'12',version:'0x0000000000000001',items:[{itemId:'1',productId:'5',quantityExact3:'2.000'}]},entry={kind:'transition',body:{invoiceId:'12',requestId:'da171000-6f42-4f19-8cab-9f4539618647',expectedVersion:record.version,operation:'SAVE_CARTONS',cartons:[{cartonNo:1,items:[{itemId:'1',quantityExact3:'2.000'}]}]}};
 captureDesktopPackingSource(storage,'8',record);assert.throws(()=>preserveDesktopPackingRequest(storage,'8',entry));assert.equal(readDesktopPackingRecovery(storage,'8','12'),null);
 failHead=false;preserveDesktopPackingRequest(storage,'8',entry);assert.deepEqual(readDesktopPackingRecovery(storage,'8','12').cartons,entry.body.cartons);
});
