import test from 'node:test';import assert from 'node:assert/strict';
import {renderPurchaseBatches,renderPurchaseDrafts,renderPurchaseTotals} from './testPurchaseView.js';
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const btn=(label,action,id,disabled=false)=>`<button data-action="${action}" data-id="${id}" ${disabled?'disabled':''}>${label}</button>`;
const money=(value,currency)=>`${(value/100).toFixed(2)} ${currency}`;
const lines=[{id:21,stockCode:'TST-A',productName:'Birinci <TEST>',quantity:3,invoiceableQuantity:3,purchasePrice:60},{id:22,stockCode:'TST-B',productName:'İkinci TEST',quantity:2,invoiceableQuantity:2,purchasePrice:80}];
test('batch display shows both SQL product rows and draft action only after acceptance',()=>{
 const render=state=>renderPurchaseBatches({batches:[{id:1,state,lines,note:'<not>'}],esc,btn,canApprove:true,canDraft:true});
 assert.match(render('pending'),/TST-A/);assert.match(render('pending'),/TST-B/);assert.match(render('pending'),/Birinci &lt;TEST>/);assert.doesNotMatch(render('pending'),/draft-from-batch/);assert.match(render('accepted'),/draft-from-batch/);
 const denied=renderPurchaseBatches({batches:[{id:1,state:'accepted',lines}],esc,btn,canDraft:false});assert.match(denied,/data-action="draft-from-batch"[^>]*disabled/);
});
test('new multi line invoice shows backend total, true status, and unavailable return scope',()=>{
 const html=renderPurchaseDrafts({drafts:[{id:1,batchId:7,status:'finalized',number:'TSTB-1',currency:'TRY',lines,totals:{grandTotal:340}}],esc,btn,money});
 assert.match(html,/Kesinleşti/);assert.match(html,/340.00 TRY/);assert.match(html,/TST-B/);assert.match(html,/iade ve ödeme işlemi henüz açık değil/);assert.doesNotMatch(html,/invoice-return/);
});
test('empty and unknown totals are honest',()=>{
 assert.match(renderPurchaseDrafts({drafts:[],esc,btn,money}),/Henüz alış taslağı yok/);assert.match(renderPurchaseTotals(null,money),/Bilinmiyor/);assert.doesNotMatch(renderPurchaseTotals(null,money),/0.00/);
});
