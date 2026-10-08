import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {withIsolatedOperationCopyScope,isIsolatedOperationCopyMutation,isIsolatedCopyProduct,isIsolatedCopyCustomer} from './isolatedOperationCopyScope.mjs';
test('copy grant exists only for the same active write transaction and exact copied IDs',async()=>{
 const context=validateIsolatedOperationCopyContext(fixtureContext()),transaction={},input={context,transaction,identity:fixtureIdentity(context),readProof:fixtureProof(context),write:true},runtime={database:context.target.database,server:context.target.server,user:context.target.login,readOnly:false};let pending;
 await withIsolatedOperationCopyScope(input,async()=>{
  assert.equal(isIsolatedOperationCopyMutation(runtime,transaction),true);assert.equal(isIsolatedCopyProduct('34765',transaction),true);assert.equal(isIsolatedCopyProduct('301985',transaction),false);assert.equal(isIsolatedCopyProduct('34765',{}),false);
  assert.equal(isIsolatedCopyCustomer('20','TRY',transaction),true);assert.equal(isIsolatedCopyCustomer('20','USD',transaction),false);
  assert.equal(isIsolatedOperationCopyMutation({...runtime,database:'MELISA_ERP_SIRKET_TEST_20260929_01'},transaction),false);
  await assert.rejects(withIsolatedOperationCopyScope({...input,transaction:{}},async()=>{}));
  pending=new Promise(resolve=>setTimeout(()=>resolve(isIsolatedOperationCopyMutation(runtime,transaction)),10));
 });
 assert.equal(await pending,false);assert.equal(isIsolatedOperationCopyMutation(runtime,transaction),false);
 await withIsolatedOperationCopyScope({...input,write:false},async()=>assert.equal(isIsolatedOperationCopyMutation(runtime,transaction),false));
});
test('plain JSON profile and unverified SQL proof cannot become a native grant',async()=>{const context=validateIsolatedOperationCopyContext(fixtureContext()),i={context,transaction:{},identity:fixtureIdentity(context),readProof:fixtureProof(context),write:true};await assert.rejects(withIsolatedOperationCopyScope({...i,context:structuredClone(context)},async()=>{}));await assert.rejects(withIsolatedOperationCopyScope({...i,readProof:{...i.readProof,valid:false}},async()=>{}));});

test('real copied count preserves stock153 while rejecting negative, unknown and excessive differences',async()=>{
 const {normalizeIsolatedCopyCountLines}=await import('./isolatedOperationCopyScope.mjs');
 const products=[{id:'29980',stockCode:'7121 İLK CEMRE',stockQuantity:153}],line={productId:'29980',stockCode:'7121 İLK CEMRE',physical:154,system:153,reason:'Tek adet fark',movementFingerprint:'a'.repeat(64)};
 assert.equal(normalizeIsolatedCopyCountLines([line],products)[0].system,153);
 for(const bad of [{...line,physical:-1},{...line,physical:159},{...line,productId:'301985'},{...line,stockCode:'7121'},{...line,cost:0},{...line,movementFingerprint:'unknown'}])assert.throws(()=>normalizeIsolatedCopyCountLines([bad],products));
 assert.throws(()=>normalizeIsolatedCopyCountLines([line,line],products));
});

test('copied native trade cost stays server-side while exact source quote remains usable',async()=>{
 const {buildIsolatedCopyTradeDomain}=await import('./workTradeStore.mjs');
 const copy=validateIsolatedOperationCopyContext(fixtureContext());
 const context={meta:{date:copy.date},scope:{customer:{id:'20'},accounts:[],products:[{id:'34765',stockCode:'0161 MOLLY',costExact4:'75.0000',prices:[{quoteId:'100',unitPriceExact8:'92.00000000'}]}]}};
 const c=await buildIsolatedCopyTradeDomain({runtime:{sql:{}},copyContext:copy,context,actor:{id:'15'},nativeContext:{transaction:{}},request:()=>{throw Error('No database read expected');}});
 assert.equal(Object.hasOwn(c.context.scope.products[0],'costExact4'),false);
 assert.equal(c.context.scope.products[0].prices[0].unitPriceExact8,'92.00000000');
 assert.equal(JSON.stringify(c.context).includes('75.0000'),false);
});
