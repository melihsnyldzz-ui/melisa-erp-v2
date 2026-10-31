import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './product-completion-plan.test.mjs';
import {digest,TARGET} from './goal7-test-delta.mjs';
import {buildProductCompletionPlan,validateProductCompletionPlan} from './product-completion-plan.mjs';

function approved(options){
 const f=fixture(options);f.sourceSnapshot.products[0].quantity='-2.00000000';f.sourceHash=digest(f.sourceSnapshot);
 const sourceKeys=f.sourceSnapshot.products.map(p=>p.sourceKey);
 f.negativeStockApproval={schemaVersion:'melisa-test-negative-stock-approval.v1',decisionId:'ERP-DEC-080',actualT1:false,server:TARGET.server,database:TARGET.database,runId:f.runId,actorId:f.actorId,sourceHash:f.sourceHash,sourceKeys,scopeHash:digest({runId:f.runId,sourceHash:f.sourceHash,sourceKeys:[...sourceKeys].sort()})};
 return f;
}
test('negative approval preserves exact negative source and both explicit local contributions',()=>{
 const p=buildProductCompletionPlan(approved()),s=p.groups[0].stock;
 assert.equal(s.sourceAfter,'-2.00000000');assert.equal(s.sourceDelta,'-12.00000000');assert.equal(s.nativeAfter,'3.00000000');assert.equal(s.localReal,'2.00000000');assert.equal(s.localSynthetic,'3.00000000');validateProductCompletionPlan(p);
});
test('negative approval admits new negative card without guessing purchase or cost',()=>{
 const p=buildProductCompletionPlan(approved({isNew:true})),g=p.groups[0];
 assert.equal(g.stock.nativeAfter,'-2.00000000');assert.equal(g.fields.purchase_price,null);assert.equal(g.fields.average_cost_try,null);validateProductCompletionPlan(p);
});
test('no negative approval retains legacy refusal, unknown lineage and hold remain protected',()=>{
 const f=approved();delete f.negativeStockApproval;assert.equal(buildProductCompletionPlan(f).groups[0].stock,null);
 const n=approved({isNew:true});delete n.negativeStockApproval;assert.equal(buildProductCompletionPlan(n).deferred[0].reason,'PRODUCT_NEGATIVE_SOURCE_QUANTITY_REQUIRES_DECISION');
 const u=buildProductCompletionPlan(approved({unknown:true}));assert.equal(u.groups[0].stock,null);assert.ok(u.groups[0].exceptions.some(e=>e.reason==='PRODUCT_STOCK_UNKNOWN_LINEAGE'));
 const h=approved();h.evidence.products[0].holdRows=[{source_key:'held'}];assert.equal(buildProductCompletionPlan(h).groups.length,0);
});
test('negative approval rejects wrong target, run, actor, source hash, scope and extra identity',()=>{
 for(const [key,value] of [['database','OTHER'],['server','OTHER'],['runId','OTHER'],['actorId','999'],['sourceHash','b'.repeat(64)],['scopeHash','b'.repeat(64)],['actualT1',true],['decisionId','OTHER'],['sourceKeys',['VEGA2026/F0102/TBLSTOKLAR/999']]]){
  const f=approved();f.negativeStockApproval[key]=value;assert.throws(()=>buildProductCompletionPlan(f),/PRODUCT_NEGATIVE_APPROVAL_INVALID/,key);
 }
});
test('negative approval is sealed and cannot be removed after rehashing a plan',()=>{
 const p=buildProductCompletionPlan(approved());delete p.negativeStockApproval;const {planHash,...body}=p;p.planHash=digest(body);assert.throws(()=>validateProductCompletionPlan(p),/PRODUCT_GROUP_RECOMPUTATION/);
 const legacy=buildProductCompletionPlan(fixture());assert.equal(Object.hasOwn(legacy,'negativeStockApproval'),false);validateProductCompletionPlan(legacy);
});
