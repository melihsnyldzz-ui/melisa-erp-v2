import test from 'node:test';import assert from 'node:assert/strict';import {prepareDesktopDueCollection,DUE_ACCOUNT_ROWS_SQL,DUE_AUDITS_SQL} from './desktopDueAllocationStore.mjs';
const uuid=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
function fixture(){const tx={}, invoices=[{invoiceId:'1',customerId:'2',entityId:'5',accountId:'3',currency:'TRY',documentCurrency:'TRY',documentAmountExact4:'1000.0000',documentDate:'2026-11-01',status:'finalized',hasFinalized:1,amountExact4:'1000.0000'},{invoiceId:'2',customerId:'2',entityId:'5',accountId:'3',currency:'TRY',documentCurrency:'TRY',documentAmountExact4:'600.0000',documentDate:'2026-11-02',status:'finalized',hasFinalized:1,amountExact4:'600.0000'}];const movements=invoices.map((i,n)=>({movementId:String(10+n),customerId:'2',entityId:'5',accountId:'3',invoiceId:i.invoiceId,movementType:'sales_invoice',currency:'TRY',documentCurrency:'TRY',documentAmountExact4:i.amountExact4,documentDate:i.documentDate,amountExact4:i.amountExact4,balanceEffectExact4:i.amountExact4,actorId:null}));const audits=invoices.map((i,n)=>({auditId:String(20+n),actorId:'8',entityId:i.invoiceId,action:'invoice.due.snapshot',reason:uuid(n+1),json:JSON.stringify({version:1,actorId:'8',requestId:uuid(n+1),invoiceId:i.invoiceId,customerId:'2',accountId:'3',currency:'TRY',documentDate:i.documentDate,dueDate:n?'2026-12-02':'2026-12-01',termDays:30,termsRevision:'a'.repeat(64),amountExact4:i.amountExact4})}));let calls=[];class Request{constructor(t){assert.equal(t,tx);this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){calls.push(q);if(q===DUE_ACCOUNT_ROWS_SQL)return {recordsets:[invoices,movements]};if(q===DUE_AUDITS_SQL)return {recordset:audits};throw Error('unexpected');}}const sql={Request,NVarChar:()=>null,MAX:0};return {params:{sql,transaction:tx,actorId:'9',requestId:uuid(9),customerId:'2',entityId:'5',accountId:'3',currency:'TRY',balanceExact8:'1600.00000000',amountExact4:'1200.0000',invoiceId:null},invoices,movements,audits,calls};}
test('FIFO binds two locked invoices and allocates exactly 1200 once',async()=>{const f=fixture(),p=await prepareDesktopDueCollection(f.params);assert.deepEqual(p.publicRows,[{invoiceId:'1',dueDate:'2026-12-01',allocatedExact4:'1000.0000',remainingExact4:'0.0000'},{invoiceId:'2',dueDate:'2026-12-02',allocatedExact4:'200.0000',remainingExact4:'400.0000'}]);});
test('missing due, unallocated legacy collection, foreign account and unmatched balance fail closed',async()=>{for(const mutate of [f=>f.audits.pop(),f=>f.movements.push({movementId:'19',customerId:'2',entityId:'5',accountId:'3',invoiceId:null,movementType:'collection',currency:'TRY',documentCurrency:'TRY',documentAmountExact4:'20.0000',amountExact4:'20.0000',balanceEffectExact4:'-20.0000'}),f=>{f.invoices[0].customerId='99';},f=>{f.params.balanceExact8='1599.00000000';},f=>{f.params.invoiceId='1';}]){const f=fixture();mutate(f);await assert.rejects(prepareDesktopDueCollection(f.params));}});
test('prior collection allocation is replayed from immutable proof and mismatched finance movement rejects',async()=>{const f=fixture(),u=uuid(3),rows=[{invoiceId:'1',documentDate:'2026-11-01',dueDate:'2026-12-01',beforeExact4:'1000.0000',allocatedExact4:'100.0000',remainingExact4:'900.0000'},{invoiceId:'2',documentDate:'2026-11-02',dueDate:'2026-12-02',beforeExact4:'600.0000',allocatedExact4:'0.0000',remainingExact4:'600.0000'}];f.movements.push({movementId:'30',customerId:'2',entityId:'5',accountId:'3',invoiceId:null,movementType:'collection',currency:'TRY',documentCurrency:'TRY',documentAmountExact4:'100.0000',amountExact4:'100.0000',balanceEffectExact4:'-100.0000',actorId:'8',financeMovementId:'31',financeActorId:'8',financeDirection:'in',financeCurrency:'TRY',financeAmountExact4:'100.0000'});f.audits.push({auditId:'40',actorId:'8',entityId:'30',action:'collection.allocation',reason:u,json:JSON.stringify({version:1,actorId:'8',requestId:u,movementId:'30',financeMovementId:'31',customerId:'2',accountId:'3',currency:'TRY',amountExact4:'100.0000',rows})});f.params.balanceExact8='1500.00000000';const p=await prepareDesktopDueCollection(f.params);assert.deepEqual(p.publicRows.map(r=>r.remainingExact4),['0.0000','300.0000']);f.movements.at(-1).financeMovementId='32';await assert.rejects(prepareDesktopDueCollection(f.params));});
import {readDesktopDueReceiptRows} from './desktopDueAllocationStore.mjs';

function addCancelledUnpostedDraft(f){
 const draft={...f.invoices[0],invoiceId:'3',entityId:null,accountId:null,status:'cancelled',hasFinalized:0};
 f.invoices.push(draft);return draft;
}
test('a cancelled unposted draft with no ledger or due snapshot does not block collection',async()=>{
 const f=fixture();addCancelledUnpostedDraft(f);
 const plan=await prepareDesktopDueCollection(f.params);
 assert.deepEqual(plan.publicRows,[{invoiceId:'1',dueDate:'2026-12-01',allocatedExact4:'1000.0000',remainingExact4:'0.0000'},{invoiceId:'2',dueDate:'2026-12-02',allocatedExact4:'200.0000',remainingExact4:'400.0000'}]);
 assert.deepEqual(plan.rows.map(x=>x.invoiceId),['1','2']);
});
test('posted sale cancellation and an unposted cancelled draft coexist without changing FIFO',async()=>{
 const f=cancelledFixture();addCancelledUnpostedDraft(f);
 const plan=await prepareDesktopDueCollection(f.params);
 assert.deepEqual(plan.publicRows,[{invoiceId:'2',dueDate:'2026-12-02',allocatedExact4:'200.0000',remainingExact4:'400.0000'}]);
 assert.deepEqual(plan.rows.map(x=>x.invoiceId),['2']);
});
test('unposted draft markers never hide posted ledger effects or malformed posting provenance',async()=>{
 for(const mutate of [
  f=>f.movements.push({...f.movements[0],movementId:'90',invoiceId:'3'}),
  f=>f.movements.push({...f.movements[0],movementId:'90',invoiceId:'3',movementType:'sales_invoice_cancel',actorId:'9',balanceEffectExact4:'-1000.0000',financeMovementId:null,financeActorId:null,financeDirection:null,financeCurrency:null,financeAmountExact4:null}),
  f=>{f.invoices[0].hasFinalized=0;},f=>{f.invoices[0].hasFinalized=2;},
  f=>{f.invoices.at(-1).hasFinalized=null;},f=>{delete f.invoices.at(-1).hasFinalized;},
  f=>{f.invoices.at(-1).customerId='99';},f=>{f.invoices.at(-1).accountId='3';},f=>{f.invoices.at(-1).entityId='5';},
  f=>{const proof=JSON.parse(f.audits[0].json);f.audits.push({...f.audits[0],auditId:'90',entityId:'3',json:JSON.stringify({...proof,invoiceId:'3'})});}
 ]){const f=fixture();addCancelledUnpostedDraft(f);mutate(f);await assert.rejects(prepareDesktopDueCollection(f.params),{message:'DESKTOP_DUE_ALLOCATION_UNAVAILABLE'});}
});
test('reopened receipt reads only its exact persisted allocation bound to movement and actor',async()=>{const requestId=uuid(4),rows=[{invoiceId:'1',documentDate:'2026-11-01',dueDate:'2026-12-01',beforeExact4:'1000.0000',allocatedExact4:'1000.0000',remainingExact4:'0.0000'},{invoiceId:'2',documentDate:'2026-11-02',dueDate:'2026-12-02',beforeExact4:'600.0000',allocatedExact4:'200.0000',remainingExact4:'400.0000'}],proof={version:1,actorId:'9',requestId,movementId:'30',financeMovementId:'31',customerId:'2',accountId:'3',currency:'TRY',amountExact4:'1200.0000',rows},receipt={movementId:'30',financeMovementId:'31',partyId:'2',partyAccountId:'3',currency:'TRY',amountExact4:'1200.0000'},tx={};let saved=JSON.stringify(proof);class Request{constructor(t){assert.equal(t,tx);}input(){return this;}async query(){return {recordset:[{actorId:'9',movementId:'30',reason:requestId,json:saved}]};}}const args={sql:{Request,NVarChar:()=>null},transaction:tx,receipt,requestId,actorId:'9'};assert.deepEqual(await readDesktopDueReceiptRows(args),[{invoiceId:'1',dueDate:'2026-12-01',allocatedExact4:'1000.0000',remainingExact4:'0.0000'},{invoiceId:'2',dueDate:'2026-12-02',allocatedExact4:'200.0000',remainingExact4:'400.0000'}]);saved=JSON.stringify({...proof,financeMovementId:'32'});await assert.rejects(readDesktopDueReceiptRows(args));});

test('v2 invoice exception participates in due ordering while legacy unknown and malformed provenance still reject',async()=>{
 const f=fixture(),legacy=JSON.parse(f.audits[1].json),v2={...legacy,version:2,termsRevision:null,termDays:0,dueDate:legacy.documentDate,exception:{requestRecordId:'40',approvalId:'41',consumeId:'42',snapshotHash:'b'.repeat(64),approverId:'9',authorityRevision:'c'.repeat(64),approvedAt:1000000,expiresAt:1600000,baseTermDays:null}};f.audits[1].json=JSON.stringify(v2);const p=await prepareDesktopDueCollection(f.params);assert.deepEqual(p.publicRows.map(r=>[r.invoiceId,r.allocatedExact4]),[['2','600.0000'],['1','600.0000']]);
 for(const proof of [{...v2,exception:{...v2.exception,consumeId:'41'}},{...legacy,termDays:null,termsRevision:null,dueDate:null},{...v2,termsRevision:'a'.repeat(64)},{...v2,documentDate:'2026-11-03',dueDate:'2026-11-03'}]){f.audits[1].json=JSON.stringify(proof);await assert.rejects(prepareDesktopDueCollection(f.params));}
});

function cancelledFixture(){
 const f=fixture();f.invoices[0].status='cancelled';f.movements[1].movementId='12';f.audits[1].auditId='22';
 f.movements.push({...f.movements[0],movementId:'11',movementType:'sales_invoice_cancel',balanceEffectExact4:'-1000.0000',actorId:'9',financeMovementId:null,financeActorId:null,financeDirection:null,financeCurrency:null,financeAmountExact4:null});
 f.params.balanceExact8='600.00000000';f.params.amountExact4='200.0000';return f;
}
function priorCollection(f,{movementId='20',auditId='30',amount='100.0000',rows}={}){
 const financeId=String(BigInt(movementId)+1n),requestId=uuid(Number(movementId));
 f.movements.push({movementId,customerId:'2',entityId:'5',accountId:'3',invoiceId:null,movementType:'collection',currency:'TRY',documentCurrency:'TRY',documentAmountExact4:amount,documentDate:'2026-11-01',amountExact4:amount,balanceEffectExact4:'-'+amount,actorId:'8',financeMovementId:financeId,financeActorId:'8',financeDirection:'in',financeCurrency:'TRY',financeAmountExact4:amount});
 f.audits.push({auditId,actorId:'8',entityId:movementId,action:'collection.allocation',reason:requestId,json:JSON.stringify({version:1,actorId:'8',requestId,movementId,financeMovementId:financeId,customerId:'2',accountId:'3',currency:'TRY',amountExact4:amount,rows})});
}
test('full unpaid cancellation followed by a fresh 600 sale allows ordinary 200 collection',async()=>{
 const f=cancelledFixture(),plan=await prepareDesktopDueCollection(f.params);
 assert.deepEqual(plan.publicRows,[{invoiceId:'2',dueDate:'2026-12-02',allocatedExact4:'200.0000',remainingExact4:'400.0000'}]);
 assert.deepEqual(plan.rows.map(r=>r.invoiceId),['2']);
 assert.equal(f.invoices[0].status,'cancelled');assert.equal(f.movements.filter(m=>m.invoiceId==='1').length,2);
});
test('unproven or malformed cancellation histories remain unavailable',async()=>{
 const mutations=[
  f=>f.movements.pop(),f=>f.movements.push({...f.movements.at(-1),movementId:'13'}),f=>{f.movements.at(-1).invoiceId='99';},
  f=>{f.invoices[0].status='finalized';},f=>{f.movements.at(-1).accountId='99';},f=>{f.movements.at(-1).entityId='99';},
  f=>{f.movements.at(-1).customerId='99';},f=>{f.movements.at(-1).currency='USD';},f=>{f.movements.at(-1).documentCurrency='USD';},
  f=>{f.movements.at(-1).documentDate='2026-11-02';},f=>{f.movements.at(-1).amountExact4='999.0000';f.movements.at(-1).balanceEffectExact4='-999.0000';},
  f=>{f.movements.at(-1).documentAmountExact4='999.0000';},f=>{f.movements.at(-1).balanceEffectExact4='1000.0000';},
  f=>{f.movements.at(-1).actorId=null;},f=>{f.movements.at(-1).financeMovementId='99';},f=>{f.movements.at(-1).movementId='9';},
  f=>f.movements.shift(),f=>{f.movements.at(-1).movementType='unverified_adjustment';}
 ];
 for(const mutate of mutations){const f=cancelledFixture();mutate(f);await assert.rejects(prepareDesktopDueCollection(f.params),{message:'DESKTOP_DUE_ALLOCATION_UNAVAILABLE'});}
});
test('historical allocation made after cancellation excludes its closed invoice during exact replay',async()=>{
 const f=cancelledFixture();priorCollection(f,{rows:[{invoiceId:'2',documentDate:'2026-11-02',dueDate:'2026-12-02',beforeExact4:'600.0000',allocatedExact4:'100.0000',remainingExact4:'500.0000'}]});f.params.balanceExact8='500.00000000';
 const plan=await prepareDesktopDueCollection(f.params);assert.deepEqual(plan.publicRows,[{invoiceId:'2',dueDate:'2026-12-02',allocatedExact4:'200.0000',remainingExact4:'300.0000'}]);
});
test('any positive allocation before cancellation forbids closing the invoice even with a matching net balance',async()=>{
 const f=cancelledFixture();f.movements.at(-1).movementId='40';f.movements[1].movementId='50';f.audits[1].auditId='50';
 priorCollection(f,{movementId:'30',auditId:'40',rows:[{invoiceId:'1',documentDate:'2026-11-01',dueDate:'2026-12-01',beforeExact4:'1000.0000',allocatedExact4:'100.0000',remainingExact4:'900.0000'}]});f.params.balanceExact8='500.00000000';
 await assert.rejects(prepareDesktopDueCollection(f.params),{message:'DESKTOP_DUE_ALLOCATION_UNAVAILABLE'});
});
test('pre-cancellation proof keeps its zero allocation row while future FIFO omits only the closed invoice',async()=>{
 const f=cancelledFixture();f.movements.at(-1).movementId='30';f.movements[1].movementId='40';f.audits[1].auditId='50';
 const old={...f.invoices[1],invoiceId:'3',documentDate:'2026-10-15',documentAmountExact4:'100.0000',amountExact4:'100.0000'};f.invoices.push(old);
 f.movements.push({...f.movements[0],movementId:'5',invoiceId:'3',documentDate:old.documentDate,documentAmountExact4:old.amountExact4,amountExact4:old.amountExact4,balanceEffectExact4:old.amountExact4});
 f.audits.push({auditId:'10',actorId:'8',entityId:'3',action:'invoice.due.snapshot',reason:uuid(3),json:JSON.stringify({version:1,actorId:'8',requestId:uuid(3),invoiceId:'3',customerId:'2',accountId:'3',currency:'TRY',documentDate:old.documentDate,dueDate:'2026-11-14',termDays:30,termsRevision:'a'.repeat(64),amountExact4:old.amountExact4})});
 priorCollection(f,{rows:[{invoiceId:'3',documentDate:old.documentDate,dueDate:'2026-11-14',beforeExact4:'100.0000',allocatedExact4:'100.0000',remainingExact4:'0.0000'},{invoiceId:'1',documentDate:'2026-11-01',dueDate:'2026-12-01',beforeExact4:'1000.0000',allocatedExact4:'0.0000',remainingExact4:'1000.0000'}]});
 const plan=await prepareDesktopDueCollection(f.params);assert.deepEqual(plan.publicRows,[{invoiceId:'2',dueDate:'2026-12-02',allocatedExact4:'200.0000',remainingExact4:'400.0000'}]);assert.deepEqual(plan.rows.map(r=>r.invoiceId),['3','2']);
 const saved=JSON.parse(f.audits.at(-1).json);assert.equal(saved.rows[1].invoiceId,'1');assert.equal(saved.rows[1].allocatedExact4,'0.0000');
 saved.rows[1].remainingExact4='999.0000';f.audits.at(-1).json=JSON.stringify(saved);await assert.rejects(prepareDesktopDueCollection(f.params));
});
test('unknown dates v2 provenance and unsupported account currency protections remain unchanged',async()=>{
 for(const index of [0,1]){const f=cancelledFixture(),v=JSON.parse(f.audits[index].json);f.audits[index].json=JSON.stringify({...v,termDays:null,termsRevision:null,dueDate:null});await assert.rejects(prepareDesktopDueCollection(f.params));}
 const f=cancelledFixture();f.params.currency='USD';await assert.rejects(prepareDesktopDueCollection(f.params));
 const fx=cancelledFixture();fx.invoices[0].documentCurrency='USD';fx.invoices[0].documentAmountExact4='300.0000';for(const m of fx.movements.filter(m=>m.invoiceId==='1')){m.documentCurrency='USD';m.documentAmountExact4='300.0000';}
 assert.equal((await prepareDesktopDueCollection(fx.params)).publicRows[0].remainingExact4,'400.0000');
 const v2=cancelledFixture(),old=JSON.parse(v2.audits[0].json),proof={...old,version:2,termsRevision:null,termDays:0,dueDate:old.documentDate,exception:{requestRecordId:'40',approvalId:'41',consumeId:'42',snapshotHash:'b'.repeat(64),approverId:'9',authorityRevision:'c'.repeat(64),approvedAt:1000000,expiresAt:1600000,baseTermDays:null}};
 v2.audits[0].json=JSON.stringify(proof);assert.equal((await prepareDesktopDueCollection(v2.params)).publicRows[0].remainingExact4,'400.0000');
 proof.exception.consumeId='41';v2.audits[0].json=JSON.stringify(proof);await assert.rejects(prepareDesktopDueCollection(v2.params));
});
