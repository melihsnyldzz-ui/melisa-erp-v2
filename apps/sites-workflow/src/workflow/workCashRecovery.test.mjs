import test from 'node:test';
import assert from 'node:assert/strict';
import {cashPendingValid,cashReadWithRecovery} from './workCashRecovery.mjs';
const pending=()=>({version:1,status:'pending',path:'/api/finance/cash-register/open',body:{requestId:'90b71867-7272-4d73-98b0-e5f295d4cd68',expectedRevision:'a'.repeat(64),counts:{USD:{physicalOpening:'0.0000'}}}});
test('pending recovery only masks capabilities; never rewrites source values, UUID, body or read result',()=>{
 const p=pending(),before=JSON.stringify(p),data={accounts:[{currency:'USD',balanceExact4:'14.0000'}],movements:[{currency:'EUR',amount:null}],capabilities:{canOpenOrClose:true,canRecordExpenseOrTransfer:true}};
 const r=cashReadWithRecovery(data,p);
 assert.equal(cashPendingValid(p),true);assert.equal(JSON.stringify(p),before);assert.equal(r.accounts,data.accounts);assert.equal(r.movements,data.movements);
 assert.deepEqual(r.capabilities,{canOpenOrClose:false,canRecordExpenseOrTransfer:false});assert.equal(data.capabilities.canOpenOrClose,true);
 assert.equal(cashReadWithRecovery(data,null),data);assert.equal(cashReadWithRecovery(data,{...p,status:'done'}),data);
});
test('all four retained command kinds stay valid, incomplete or foreign pending stays blocked',()=>{
 for(const action of ['open','close','expenses','transfers'])assert.equal(cashPendingValid({...pending(),path:'/api/finance/cash-register/'+action}),true);
 for(const change of [p=>p.version=2,p=>p.path='/api/finance/payments',p=>p.body=null,p=>p.body=[],p=>p.body.requestId='different',p=>p.body.expectedRevision=null]){
  const p=pending();change(p);assert.equal(cashPendingValid(p),false);assert.throws(()=>cashReadWithRecovery({capabilities:{}},p),/doğrulanamadı/);
 }
});
