import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopGoodsRequestBinding,desktopGoodsRequestDisposition} from './desktopGoodsReceiptPlanning.mjs';
const requestId='00000000-0000-4000-8000-000000000001';
const binding=()=>desktopGoodsRequestBinding({actorId:'12',operation:'goods_approval',body:{requestId,receiptId:'9'}});

test('an undefined store result cannot authorise a new dispatch',()=>{assert.throws(()=>desktopGoodsRequestDisposition(binding(),undefined),/DESKTOP_GOODS_JOURNAL_INVALID/);});
test('new, pending and committed are distinct; committed replay preserves result',()=>{const b=binding();assert.equal(desktopGoodsRequestDisposition(b,null).kind,'new');assert.equal(desktopGoodsRequestDisposition(b,{...b,state:'pending'}).kind,'unknown_same_request_only');assert.deepEqual(desktopGoodsRequestDisposition(b,{...b,state:'committed',entityId:'9'}),{kind:'replay',entityId:'9'});});
test('same UUID with altered actor, body or operation cannot replay',()=>{const b=binding(),r={...b,state:'committed',entityId:'9'};for(const alt of [{actorId:'13',operation:'goods_approval',body:{requestId,receiptId:'9'}},{actorId:'12',operation:'goods_approval',body:{requestId,receiptId:'10'}},{actorId:'12',operation:'goods_draft',body:{requestId,receiptId:'9'}}])assert.throws(()=>desktopGoodsRequestDisposition(desktopGoodsRequestBinding(alt),r));});
test('binding is independent of key ordering and rejects accessor values',()=>{const a=binding(),b=desktopGoodsRequestBinding({actorId:'12',operation:'goods_approval',body:{receiptId:'9',requestId}});assert.equal(a.bodyHash,b.bodyHash);const body={requestId};Object.defineProperty(body,'receiptId',{enumerable:true,get(){throw Error('executed');}});assert.throws(()=>desktopGoodsRequestBinding({actorId:'12',operation:'goods_approval',body}),/DESKTOP_GOODS_JOURNAL_INVALID/);});
