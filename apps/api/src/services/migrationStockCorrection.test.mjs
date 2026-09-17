import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateApproval,applyApprovedStockCorrections,hash,sameTimestamp,RUN_ID,TARGET_DATABASE} from './migrationStockCorrection.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('../../../../docs/operations/stock-audit-3-approved-package-20260917.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(fixture);
test('persisted ISO snapshot and SQL Date compare by instant',()=>assert.equal(sameTimestamp('2026-09-17T14:47:04.000Z',new Date('2026-09-17T14:47:04.000Z')),true));
test('timestamp drift and null mismatch are not hidden',()=>{assert.equal(sameTimestamp('2026-09-17T14:47:04.000Z',new Date('2026-09-17T14:47:05.000Z')),false);assert.equal(sameTimestamp(null,new Date(0)),false);});
test('exact owner-approved frozen package passes',()=>assert.equal(validateApproval(fixture.pkg,fixture.rows,fixture.approval),true));
for(const [name,mutate] of [
 ['live target',f=>f.approval.targetDatabase='MELISA_ERP_V2'],
 ['no explicit commit approval',f=>f.approval.commitTest=false],
 ['quantity change',f=>f.rows[0].quantityIn++],
 ['missing product',f=>f.rows.pop()],
 ['duplicate source key',f=>f.rows[1].idempotencyKey=f.rows[0].idempotencyKey],
 ['ambiguous product',f=>f.rows[1].classification='AMBIGUOUS'],
 ['financial posting',f=>f.rows[0].financialPostingAllowed=true],
 ['lost source documents',f=>f.rows[0].sourceDocuments=[]],
 ['tampered frozen original',f=>f.pkg.candidates[0].quantityIn++],
 ['unapproved destination product',f=>f.rows[0].target.productId='1'],
])test('rejects '+name,()=>{const f=copy();mutate(f);assert.throws(()=>validateApproval(f.pkg,f.rows,f.approval));});
function fake(existing,database=TARGET_DATABASE){
 const state={commits:0,rollbacks:0,mutations:0};
 class Transaction{async begin(){}async commit(){state.commits++;}async rollback(){state.rollbacks++;}}
 class Request{async query(q){if(/INSERT|UPDATE dbo|DELETE/.test(q))state.mutations++;return {recordset:q.includes('SELECT id,product_id')?existing:[]};}}
 const pool={request:()=>({query:async()=>({recordset:[{db:database,server:'Semih\\MELISADEV'}]})})};
 return {pool,sql:{Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4}},state};
}
const existing=fixture.rows.map((r,i)=>({id:i+1,product_id:r.target.productId,quantity_in:r.quantityIn,quantity_out:0,source_record_key:r.idempotencyKey,source_payload_hash:hash(r),migration_run_id:RUN_ID}));
test('exact replay has zero stock/audit mutations and no posting callback',async()=>{const f=fake(existing);const r=await applyApprovedStockCorrections({...f,...fixture,verifyBefore:()=>{throw Error('MUST_NOT_POST');}});assert.equal(r.status,'ALREADY_APPLIED');assert.equal(r.quantityAdded,0);assert.equal(f.state.mutations,0);assert.equal(f.state.commits,1);});
test('partial prior run fails closed without inserting remaining rows',async()=>{const f=fake(existing.slice(0,1));await assert.rejects(applyApprovedStockCorrections({...f,...fixture}),/PARTIAL_OR_CONFLICTING/);assert.equal(f.state.mutations,0);assert.equal(f.state.rollbacks,1);});
test('changed replay payload fails closed',async()=>{const entries=structuredClone(existing);entries[0].quantity_in++;const f=fake(entries);await assert.rejects(applyApprovedStockCorrections({...f,...fixture}),/IDEMPOTENCY_PAYLOAD/);assert.equal(f.state.mutations,0);});
test('wrong connected database rejected before transaction',async()=>{const f=fake([],'MELISA_ERP_V2');await assert.rejects(applyApprovedStockCorrections({...f,...fixture}),/EXACT_TEST_TARGET/);assert.equal(f.state.commits,0);assert.equal(f.state.mutations,0);});
