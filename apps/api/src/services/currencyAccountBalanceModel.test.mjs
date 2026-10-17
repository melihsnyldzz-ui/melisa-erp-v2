import test from 'node:test';
import assert from 'node:assert/strict';
import {currencyAccountBalanceFields as fields} from './currencyAccountBalanceModel.mjs';
test('role-based B/A preserves exact magnitude, opposite signs and tiny eight-place amounts',()=>{
 for(const [role,positive,negative] of [['customer','B','A'],['supplier','A','B']]){
  assert.deepEqual(fields({role,balanceExact:'123.00000001',localDeltaExact:'-2.00000000',proven:true}),{debitCreditDirection:positive,amountExact:'123.00000001',localDeltaExact:'-2.00000000'});
  assert.equal(fields({role,balanceExact:'-0.00000001',localDeltaExact:'0.00000000',proven:true}).debitCreditDirection,negative);
 }
});
test('real zero stays exact ZERO; unknown proof or balance never becomes zero or discloses local movement',()=>{
 for(const role of ['customer','supplier'])for(const balanceExact of ['0.00000000','-0.0000'])assert.equal(fields({role,balanceExact,localDeltaExact:'2.00000000',proven:true}).debitCreditDirection,'ZERO');
 for(const input of [{balanceExact:null,proven:true},{balanceExact:'9.00000000',proven:false},{balanceExact:'9.00000000',proven:null}])assert.deepEqual(fields({role:'customer',localDeltaExact:'7.00000000',...input}),{debitCreditDirection:null,amountExact:null,localDeltaExact:null});
});
test('no floating conversion, guessed role or missing proven local delta accepted',()=>{
 for(const input of [{role:'other',balanceExact:'1.0',localDeltaExact:'0.0'},{role:'customer',balanceExact:1,localDeltaExact:'0.0'},{role:'supplier',balanceExact:'1.0',localDeltaExact:null}])assert.throws(()=>fields({...input,proven:true}));
});
