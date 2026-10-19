import test from 'node:test';
import assert from 'node:assert/strict';
import {isReceivingApprovalRecovery,receivingApprovalReadback} from './workReceivingRecovery.mjs';
const requestId='00000000-0000-4000-8000-000000000001';
function fixture(){
 const pending={path:'/api/work-receiving/receipts/7/approve',body:{requestId},status:'pending'};
 const line={id:'1',productId:'301',clientLineId:'line-a',stockCode:'SAFE CODE',quantityExact3:'2.000',unit:{label:'ADET',factorExact8:'1.00000000'},receivedQuantityExact3:'2.000',invoiceableQuantityExact3:'2.000'};
 const receipt={id:'7',state:'accepted',supplierId:'601',warehouseId:'1',lines:[line]};
 const context={meta:{scopeKind:'VERIFIED_BUSINESS_TEST',operationOrigin:'ISOLATED_TEST_COPY'},capabilities:{canApprove:true},scope:{supplier:{id:'601',currency:'USD'},warehouse:{id:'1'}},receipts:[receipt]};
 const record={requestId,operation:'goods_accept',response:{id:7,state:'accepted',supplierId:601,currency:'USD',warehouseId:1,replayed:false,lines:[{id:1,productId:301,clientLineId:'line-a',stockCode:'SAFE CODE',quantity:2,receivedQuantity:2,unit:'ADET'}]}};
 return {pending,record,context};
}
test('confirmed journal and current receipt resolve the existing approval without altering source objects',()=>{
 const f=fixture(),before=JSON.stringify(f),r=receivingApprovalReadback(f.pending,f.record,f.context);
 assert.equal(r.receipt.id,'7');assert.equal(r.recoveredReadOnly,true);assert.equal(r.replayed,false);assert.equal(r.requestId,requestId);assert.equal(JSON.stringify(f),before);
 r.receipt.lines[0].quantityExact3='1.000';assert.equal(f.context.receipts[0].lines[0].quantityExact3,'2.000');
});
for(const [label,change] of [
 ['wrong UUID',f=>f.record.requestId='00000000-0000-4000-8000-000000000002'],
 ['wrong operation',f=>f.record.operation='goods_reject'],
 ['different receipt',f=>f.record.response.id=8],
 ['different supplier',f=>f.record.response.supplierId=602],
 ['different currency',f=>f.record.response.currency='TRY'],
 ['different warehouse',f=>f.record.response.warehouseId=2],
 ['not accepted',f=>f.record.response.state='pending'],
 ['wrong product',f=>f.record.response.lines[0].productId=302],
 ['wrong client line',f=>f.record.response.lines[0].clientLineId='line-b'],
 ['wrong quantity',f=>f.record.response.lines[0].quantity=3],
 ['wrong received quantity',f=>f.record.response.lines[0].receivedQuantity=1],
 ['wrong stock code',f=>f.record.response.lines[0].stockCode='OTHER'],
 ['unknown unit',f=>f.record.response.lines[0].unit='SERI'],
 ['wrong multiplier',f=>f.context.receipts[0].lines[0].unit.factorExact8='2.00000000'],
 ['duplicate line',f=>f.record.response.lines.push({...f.record.response.lines[0]})],
 ['different current state',f=>f.context.receipts[0].state='pending'],
 ['permission revoked',f=>f.context.capabilities.canApprove=false],
 ['different copy scope',f=>f.context.meta.scopeKind='OTHER'],
 ['original TEST',f=>f.context.meta.operationOrigin='NATIVE_TEST'],
 ['different body',f=>f.pending.body.reason='unrelated'],
 ['rejected decision',f=>f.pending.path=f.pending.path.replace('approve','reject')],
 ['already resolved',f=>f.pending.status='done'],
 ['journal missing',f=>f.record=null],
])test('recovery remains closed: '+label,()=>{const f=fixture();change(f);const before=JSON.stringify(f);assert.throws(()=>receivingApprovalReadback(f.pending,f.record,f.context));assert.equal(JSON.stringify(f),before);});
test('unknown or incomplete pending request never selects the read-only approval recovery',()=>{for(const pending of [null,{}, {status:'pending',path:'/api/work-receiving/receipts/7/approve',body:{} }])assert.equal(Boolean(isReceivingApprovalRecovery(pending,fixture().context)),false);});
