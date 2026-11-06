import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDesktopSaleCancellation,desktopSaleCancellationReason} from './desktopSaleCancellation.mjs';
const command=()=>({requestId:'7cbb7e06-ef75-4456-92e5-99f6d99b8312',invoiceId:'13',expectedVersion:'0x0000000000000013',reason:'Yanlış fiş denemesi'});
test('canonical command includes reason and version while invoice amounts and account remain server-owned',()=>{
 const original=command(),result=normalizeDesktopSaleCancellation(original);assert.deepEqual(result,original);assert.notEqual(result,original);assert(Object.isFrozen(result));
 const shuffled={reason:original.reason,expectedVersion:original.expectedVersion,invoiceId:original.invoiceId,requestId:original.requestId};assert.equal(JSON.stringify(normalizeDesktopSaleCancellation(shuffled)),JSON.stringify(result));
 assert.notEqual(JSON.stringify(normalizeDesktopSaleCancellation({...original,reason:'Farklı gerekçe'})),JSON.stringify(result));
 for(const field of ['accountId','customerId','productIds','amount','canCancel','desktopPrivateSale'])assert.throws(()=>normalizeDesktopSaleCancellation({...original,[field]:'1'}));
});
test('rejects invalid identities, versions, data accessors and unknown fields before write preparation',()=>{
 for(const patch of [{requestId:'bad'},{requestId:'7CBB7E06-EF75-4456-92E5-99F6D99B8312'},{invoiceId:'013'},{invoiceId:'9007199254740992'},{invoiceId:13},{expectedVersion:'0x13'},{reason:''}])assert.throws(()=>normalizeDesktopSaleCancellation({...command(),...patch}));
 const missing=command();delete missing.reason;assert.throws(()=>normalizeDesktopSaleCancellation(missing));
 const accessor=command();Object.defineProperty(accessor,'reason',{enumerable:true,get(){throw Error('GETTER_CALLED');}});assert.throws(()=>normalizeDesktopSaleCancellation(accessor),/INVALID/);
 const symbol=command();symbol[Symbol('extra')]=true;assert.throws(()=>normalizeDesktopSaleCancellation(symbol));
});
test('reason respects actual nvarchar 250 without silently truncating or changing replay body',()=>{
 assert.equal(desktopSaleCancellationReason('a'.repeat(250)).length,250);assert.equal(desktopSaleCancellationReason('🙂'.repeat(125)).length,250);
 for(const value of ['a'.repeat(251),'🙂'.repeat(126),' a','a ','a\nb','a\u0000b',null,1])assert.throws(()=>desktopSaleCancellationReason(value));
});
