import test from 'node:test';
import assert from 'node:assert/strict';
import {readFreshSaleImages,saleImageIdentity} from '../../apps/terminal-app/src/services/freshSaleImages.js';
const hash='a'.repeat(64),base='http://127.0.0.1:4100';
const row={id:'vega-1',sourceId:1,stockCode:'ABC',matchedBarcode:'123',imageIdentityStatus:'VERIFIED',imageIdentityHash:hash,imageUrl:`/uploads/verified-products/${hash}--test.jpg`};
const expected=saleImageIdentity(row);
test('fresh exact approval yields display URL without changing draft values',async()=>{
 const frozen=Object.freeze({...row,salePrice:20});let called='';
 const images=await readFreshSaleImages([saleImageIdentity(frozen)],async path=>{called=path;return {data:{...row,salePrice:900}};},base);
 assert.equal(called,'/terminal/products/barcode/123');assert.equal(images['vega-1'],base+row.imageUrl);assert.equal(frozen.salePrice,20);
});
test('revoked, stale, absent, different product, wrong hash and errors never return cached photos',async()=>{
 for(const changed of [{imageIdentityStatus:'CONFLICT'},{imageIdentityStatus:'STALE'},{imageIdentityStatus:undefined},{id:'vega-2'},{sourceId:2},{stockCode:'OTHER'},{matchedBarcode:'999'},{isPassive:true},{imageIdentityHash:'b'.repeat(64)},{imageUrl:'/uploads/vega-products/test.jpg'}]){
  assert.deepEqual(await readFreshSaleImages([expected],async()=>({data:{...row,...changed}}),base),{});
 }
 assert.deepEqual(await readFreshSaleImages([expected],async()=>{throw Error('offline');},base),{});
});
test('late results after product or app context changes are discarded',async()=>{
 let active=true;
 assert.deepEqual(await readFreshSaleImages([expected],async()=>{active=false;return {data:row};},base,()=>active),{});
});
test('fresh reads are bounded to four simultaneous requests and empty barcode does not query',async()=>{
 let active=0,peak=0,calls=0;
 const ids=Array.from({length:11},()=>({...expected}));ids.push({...expected,barcode:''});
 await readFreshSaleImages(ids,async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return {data:row};},base);
 assert.equal(calls,11);assert.equal(peak,4);
});
