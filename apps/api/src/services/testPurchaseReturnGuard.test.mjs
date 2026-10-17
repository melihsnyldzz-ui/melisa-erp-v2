import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPurchaseReturnClear} from './testPurchaseReturnGuard.mjs';

function requestFor(returns){
 let invoice;
 return {input(name,type,value){assert.equal(name,'invoice');assert.equal(type,'bigint');invoice=value;return this},async query(text){
  assert.match(text,/WITH\(UPDLOCK,HOLDLOCK\)/);
  assert.match(text,/source_purchase_invoice_id=@invoice/);
  assert.match(text,/kind=N'purchase' AND status=N'finalized'/);
  return {recordset:[{n:returns.filter(r=>r.source===invoice&&r.kind==='purchase'&&r.status==='finalized').length}]};
 }};
}

test('active source purchase return blocks invoice cancellation before a second debt reversal',async()=>{
 await assert.rejects(assertPurchaseReturnClear(requestFor([{source:25,kind:'purchase',status:'finalized'}]),{BigInt:'bigint'},25),e=>e.code==='ACTIVE_RETURN'&&e.statusCode===409);
});

test('cancelled returns and another invoice do not prevent source invoice cancellation',async()=>{
 await assertPurchaseReturnClear(requestFor([{source:25,kind:'purchase',status:'cancelled'},{source:26,kind:'purchase',status:'finalized'},{source:25,kind:'sales',status:'finalized'}]),{BigInt:'bigint'},25);
});

test('missing return read never silently enables invoice cancellation',async()=>{
 const request={input(){return this},async query(){throw Error('SQL unavailable')}};
 await assert.rejects(assertPurchaseReturnClear(request,{BigInt:'bigint'},25),/SQL unavailable/);
});
