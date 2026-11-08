import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopCreditEvaluate,desktopCreditLimit} from './desktopCredit.mjs';
test('missing definition remains unrestricted and does not reinterpret a zero legacy field',()=>{
 assert.deepEqual(desktopCreditEvaluate({limitExact8:null,balanceExact8:'200.00000000',amountExact4:'1.0000'}),{limitExact8:null,balanceExact8:'200.00000000',amountExact4:'1.0000',projectedBalanceExact8:'201.00000000',approvalRequired:false,dueStatus:'unknown'});
 assert.throws(()=>desktopCreditLimit('0.00000000'));
});
test('exact 8-place arithmetic handles negative balance and one-unit boundary',()=>{
 assert.equal(desktopCreditEvaluate({limitExact8:'10.00000000',balanceExact8:'9.99990000',amountExact4:'0.0001'}).approvalRequired,false);
 assert.equal(desktopCreditEvaluate({limitExact8:'10.00000000',balanceExact8:'9.99990001',amountExact4:'0.0001'}).approvalRequired,true);
 assert.equal(desktopCreditEvaluate({limitExact8:'1.00000000',balanceExact8:'-2.00000000',amountExact4:'2.0000'}).projectedBalanceExact8,'0.00000000');
});
test('malformed, negative zero and decimal overflow fail closed',()=>{
 for(const balanceExact8 of ['-0.00000000','01.00000000','1.0000000','99999999999999999999.99999999'])assert.throws(()=>desktopCreditEvaluate({limitExact8:null,balanceExact8,amountExact4:'1.0000'}));
 for(const value of ['0.0000','-1.0000','1e3','1.00000'])assert.throws(()=>desktopCreditEvaluate({limitExact8:null,balanceExact8:'0.00000000',amountExact4:value}));
});
test('rejects extra keys and accessors before evaluating potentially unsafe inputs',()=>{
 const args={limitExact8:null,balanceExact8:'0.00000000',amountExact4:'1.0000'};
 assert.throws(()=>desktopCreditEvaluate({...args,unexpected:true}));
 let called=false;Object.defineProperty(args,'balanceExact8',{enumerable:true,get(){called=true;return '0.00000000';}});
 assert.throws(()=>desktopCreditEvaluate(args));assert.equal(called,false);
});
