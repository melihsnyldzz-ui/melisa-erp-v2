import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoLaterIsolatedCopyCount,reverseStockDocument} from './testStockReversalService.mjs';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';

function fixture(){
 const raw=fixtureContext();raw.products[0]={...raw.products[0],id:'29980',sourceKey:['VEGA2026','F0102TBLSTOKLAR','5854'].join('/'),stockCode:'7121 İLK CEMRE'};
 const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),transaction={},calls=[];
 const scope={flow:'count-cancel',product_id:29980};let originalProof=true,later=true;
 const c={copyContext:copy,transaction,scope,actor:{id:'16',permissions:['stock.adjust']},sqlDriver:{UniqueIdentifier:0,BigInt:0,Date:0},req(){const params={};return{input(k,t,v){params[k]=v;return this;},async query(sql){calls.push({sql,params});
  assert.doesNotMatch(sql,/\bUPDATE\b|\bINSERT\s+(?:INTO\s+)?dbo\.|\bDELETE\b/,'blocked inverse has no native writes');
  if(sql.includes('DECLARE @ownedCounts')){
   assert.equal(params.copyCountCopyId,copy.copyId);assert.equal(params.copyCountProductId,29980);
   assert.doesNotMatch(sql,/test_daily_scope/,'selected real product has no legacy fixture row');
   assert.match(sql,/approval\.operation=N'stock_count_approve'/);assert.match(sql,/created\.operation=N'stock_count_draft'/);
   assert.match(sql,/OPENJSON\(doc\.payload_json,'\$\.lines'\)/);assert.match(sql,/OPENJSON\(approval\.response_json,'\$\.result.lines'\)/);
   assert.match(sql,/a\.actor_user_id=approval\.actor_id/);assert.match(sql,/nextCount\.approvalAuditId>originalCount\.approvalAuditId/);
   return{recordsets:[originalProof?[{id:100}]:[],later?[{id:101}]:[]]};
  }
  if(sql.includes('system_settings'))return{recordset:[]};
  if(sql.includes('SELECT id,current_stock_qty'))return{recordset:[{id:29980,current_stock_qty:155,average_cost_try:75}]};
  if(sql.includes('test_stock_reversals'))return{recordset:[]};
  throw Error('Unexpected query: '+sql);
 }}}};
 const d={id:100,kind:'count',state:'approved',payload:{lines:[{productId:'29980',physical:154,system:153}],date:copy.date},result:{lines:[{productId:29980,difference:1,movementCreated:true,movementId:500}]}};
 return{copy,c,d,calls,setProof(v){originalProof=v;},setLater(v){later=v;},run:fn=>withIsolatedOperationCopyScope({context:copy,transaction,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),write:true},fn)};
}

test('later own approved real-product count blocks inverse before any movement despite missing legacy fixture scope',async()=>{
 const f=fixture();await f.run(()=>assert.rejects(reverseStockDocument(f.c,f.d,{date:f.copy.date,reason:'Önceki hatalı sayım'}),{code:'LATER_APPROVED_COUNT',statusCode:409}));
 assert.equal(f.calls.filter(x=>x.sql.includes('DECLARE @ownedCounts')).length,1);
});

test('copy count order proof accepts no later count and fails closed for missing own approval/foreign product/transaction',async()=>{
 const f=fixture();f.setLater(false);
 await assert.rejects(assertNoLaterIsolatedCopyCount(f.c,f.d,29980),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});assert.equal(f.calls.length,0);
 await f.run(async()=>{
  await assertNoLaterIsolatedCopyCount(f.c,f.d,29980);
  f.setProof(false);await assert.rejects(assertNoLaterIsolatedCopyCount(f.c,f.d,29980),{code:'ISOLATED_COPY_COUNT_APPROVAL_PROOF'});
  await assert.rejects(assertNoLaterIsolatedCopyCount(f.c,f.d,30003),{code:'ISOLATED_COPY_REVERSAL_PRODUCT'});
  await assert.rejects(assertNoLaterIsolatedCopyCount({...f.c,transaction:{}},f.d,29980),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
 });
});

test('copy multi-line inverse still rejects explicitly before SQL',async()=>{
 const f=fixture();f.d.payload.lines.push({...f.d.payload.lines[0]});f.d.result.lines.push({...f.d.result.lines[0]});
 await f.run(()=>assert.rejects(reverseStockDocument(f.c,f.d,{date:f.copy.date,reason:'İptal gerekçesi'}),{code:'ISOLATED_COPY_REVERSAL_SINGLE_LINE'}));assert.equal(f.calls.length,0);
});
