import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudSession,validateCloudSession} from './session.js';
import {tradeContext} from './workTradeModel.mjs';
import {receivingContext} from './workInboundModel.mjs';

const hash='a'.repeat(64),unit={label:'ADET',factorExact8:'1.00000000'};
const selected={synthetic:true,csrfToken:'synthetic-csrf',accessToken:'synthetic-access',user:{id:15,role:'personnel',name:'Sentetik personel',synthetic:true,permissions:['sales.view']}};
const context=()=>({meta:{schemaVersion:'melisa-work-trade.v1',source:'cloud-shared-synthetic',cloudSynthetic:true,date:'2026-10-19',timeZone:'Europe/Istanbul'},revision:hash,
  capabilities:{canCreate:true,canFinalize:true,canCancel:false,canCollect:false,canCancelCollection:false},scope:{synthetic:true,
    customer:{id:'501',code:'SYN-C-501',name:'Sentetik müşteri',synthetic:true,writeEligible:true,balanceExact4:'0.0000',revision:hash,currency:'TRY'},
    products:[101,102].map(id=>({id:String(id),stockCode:'SYN-'+id,name:'Sentetik ürün',barcode:String(id),synthetic:true,writeEligible:true,stockQuantityExact3:'10.000',unit,revision:hash,
      prices:[{quoteId:'quote-'+id,currency:'TRY',unitPriceExact8:'25.00000000',revision:hash,source:{kind:'synthetic-test'}}]})),accounts:[]},supportedCurrencies:['TRY'],limits:{maxItems:2,maxQuantityPerLine:100,maxInvoiceAmountExact4:'10000.0000'}});

test('cloud trade wrapper keeps cloud provenance visible and delegates original contract checks',()=>{
  const value=context(),before=JSON.stringify(value);assert.equal(tradeContext(value),value);assert.equal(JSON.stringify(value),before);
  for(const mutate of [c=>delete c.meta.cloudSynthetic,c=>c.meta.source='native-test',c=>c.scope.synthetic=false,c=>c.scope.products[0].prices[0].currency='ABC',c=>c.meta.copyId='fake-native-copy',c=>c.scope.customer.revision='bad']){
    const bad=context();mutate(bad);assert.throws(()=>tradeContext(bad));
  }
});
test('cloud receiving wrapper validates real count context without rewriting returned metadata',()=>{
  const value={meta:{schemaVersion:'melisa-work-inbound.v1',source:'cloud-shared-synthetic',cloudSynthetic:true,timeZone:'Europe/Istanbul'},
    capabilities:{canCount:true,canSubmit:true,canApprove:false,canReject:false,canViewPurchase:false,canViewSupplier:false,canCreatePurchase:false,canFinalizePurchase:false,canCancelPurchase:false},
    scope:{synthetic:true,supplier:{id:'601',code:'SYN-S-601',name:'Sentetik'},warehouse:{id:'1',label:'Sentetik alan'},products:[101,102].map(id=>({id:String(id),stockCode:'SYN-'+id,name:'Sentetik',barcode:String(id),unit,stockQuantityExact3:'10.000',writeEligible:true}))},countDrafts:[],receipts:[]};
  assert.equal(receivingContext(value),value);assert.equal(value.meta.source,'cloud-shared-synthetic');
  const invalid=structuredClone(value);invalid.scope.products[0].purchasePrice='secret-price';assert.throws(()=>receivingContext(invalid));
});
test('injected session binds controllers to same synthetic cookie actor and CSRF; remaps only allowed routes',async()=>{
  const calls=[];let active=selected;
  const api=createCloudSession(async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:url.endsWith('/session')?active:{saved:true}});});
  const bound=api.bind(selected);await bound.inbound('/api/work-receiving/count-drafts',{method:'POST',body:{requestId:'synthetic-operation'}});
  assert.equal(calls.at(-1).url,'/api/cloud-test/work-receiving/count-drafts');
  assert.equal(calls.at(-1).options.headers['X-Cloud-CSRF'],selected.csrfToken);
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer '+selected.accessToken);
  active={...selected,accessToken:'changed'};const before=calls.length;
  await assert.rejects(()=>bound.work('/api/work-sales/context'),{status:401});assert.equal(calls.length,before+1);
  await assert.rejects(()=>bound.work('/api/auth/login'));assert.equal(calls.length,before+1);
  assert.throws(()=>validateCloudSession({...selected,user:{...selected.user,synthetic:false}}));
});
