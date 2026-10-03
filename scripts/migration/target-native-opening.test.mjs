import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,safeFailureCode} from './target-native-opening.mjs';
import {hash} from './mapping-opening.mjs';
import {RUN} from './target-opening-runtime.mjs';
function approved(plans=[{table:'products',targetId:'001',sourceKey:'F0102/001',beforeHash:'a'.repeat(64),fields:{current_stock_qty:'-2.000',average_cost_try:null}}]){
  const payload={run:RUN,sourceHash:'b'.repeat(64),plans};return {...payload,planHash:hash(payload)};
}
test('opening plan preserves negative native stock and explicit unknown cost',()=>assert.equal(validatePlan(approved()),true));
test('a changed source or planned postimage cannot reuse approval hash',()=>{
 const p=approved();p.sourceHash='c'.repeat(64);assert.throws(()=>validatePlan(p),/IMMUTABLE_PLAN_HASH_CHANGED/);
 const q=approved();q.plans[0].fields.current_stock_qty='100.000';assert.throws(()=>validatePlan(q),/IMMUTABLE_PLAN_HASH_CHANGED/);
});
test('rehashed plan cannot modify an identity, history or commercial document',()=>{
 assert.throws(()=>validatePlan(approved([{table:'products',targetId:'1',sourceKey:'F0102/1',fields:{stock_code:'DIFFERENT'}}])),/UNPLANNED_NATIVE_COLUMN/);
 assert.throws(()=>validatePlan(approved([{table:'sales_invoices',targetId:'1',sourceKey:'F0102/1',fields:{grand_total:'1'}}])),/NATIVE_TABLE_NOT_ALLOWED/);
});
test('multiple source keys cannot update the same native entity twice',()=>assert.throws(()=>validatePlan(approved([{table:'customers',targetId:'7',sourceKey:'F0102/1',fields:{balance:'1'}},{table:'customers',targetId:'7',sourceKey:'F0102/2',fields:{balance:'2'}}])),/DUPLICATE_NATIVE_TARGET/));
test('a different run cannot reuse a plan even with a matching payload hash',()=>{
 const p=approved();p.run='LIVE';delete p.planHash;p.planHash=hash(p);assert.throws(()=>validatePlan(p),/IMMUTABLE_PLAN_HASH_CHANGED/);
});
test('ODBC diagnostic preserves the guard rule without printing raw SQL or business data',()=>{
 assert.equal(safeFailureCode({message:'[Microsoft][SQL Server]MIGRATION_UPDATE_OUTSIDE_PLAN',originalError:{message:'ignored'}}),'MIGRATION_UPDATE_OUTSIDE_PLAN');
 assert.equal(safeFailureCode({message:'ODBC request failed',originalError:{message:'[SQL Server]NATIVE_PREIMAGE_CHANGED'}}),'NATIVE_PREIMAGE_CHANGED');
 assert.equal(safeFailureCode({message:'Sensitive row detail'}),'NATIVE_OPENING_FAILED');
});
