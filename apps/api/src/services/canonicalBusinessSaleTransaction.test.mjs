import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS_SESSION,projectCanonicalBusinessSaleContext,getCanonicalBusinessSaleContextProof,validateCanonicalBusinessSaleTransactionProof,getCanonicalBusinessSaleTransaction,withCanonicalBusinessSaleTransaction,runCanonicalBusinessSaleTransaction} from './canonicalBusinessSessionContext.mjs';
const hash='A'.repeat(64),requestId='11111111-1111-4111-8111-111111111111';
function fixture(){
 const product={productId:'12',quoteId:'81',unitSourceId:'9',stockCode:'0012 SYN',name:'Synthetic product',barcode:'000012',unit:'ADET',factorExact8:'1.00000000',quantityExact3:'2.000',unitPriceExact8:'1.23456789',unitPriceExact4:'1.2346',lineTotalExact4:'2.4692',averageCostTryExact4:'0.5000',sourceKey:'SYN-SOURCE/12',sourceWitnessHash:hash};
 const proof={database:BUSINESS_SESSION.database,server:BUSINESS_SESSION.server,profileHash:hash,actorId:'17',sessionId:55,transactionId:'700',requestId,operation:'sale_draft',bodyHash:hash,invoiceId:null,selectionHash:hash,revision:hash,previewHash:hash,customerId:'155',partyEntityId:'6',accountId:'7',accountSourceKey:'synthetic/account',accountSourceWitnessHash:hash,write:true,currency:'USD',rateExact8:'2.00000000',grandTotalExact4:'2.4692',amountTryExact4:'4.9384',products:[product]};
 const body={documentDate:'2026-10-28',expectedRevision:hash,previewHash:hash,customerId:'155',customerAccountId:'7',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]};
 proof.context=sqlContextFixture(proof,body.documentDate);
 const expected={profile:{profileHash:hash},before:{sessionId:55,transactionId:'700'},requestId,operation:'sale_draft',invoiceId:null,bodyHash:hash,body};return {proof,expected};
}
test('native four-place price/total and selected account are preserved; a pure DTO never grants a transaction',()=>{
 const f=fixture(),out=validateCanonicalBusinessSaleTransactionProof(f.proof,f.expected);
 assert.equal(out.products[0].barcode,'000012');assert.equal(out.products[0].unitPriceExact4,'1.2346');assert.equal(out.accountId,'7');
 assert(Object.isFrozen(out));assert(Object.isFrozen(out.products[0]));
 assert.equal(getCanonicalBusinessSaleTransaction({binding:out}),null);
});
test('foreign target, actor, account, native transaction, invoice and monetary drift reject',()=>{
 const changes=[p=>{p.database='LIVE';},p=>{p.actorId='15';},p=>{p.accountId='8';},p=>{p.transactionId='701';},p=>{p.sessionId=56;},p=>{p.invoiceId='99';},p=>{p.bodyHash='B'.repeat(64);},p=>{p.revision='B'.repeat(64);},p=>{p.previewHash='B'.repeat(64);},p=>{p.currency='EUR';},p=>{p.products[0].quoteId='82';},p=>{p.products[0].unitSourceId='0';},p=>{p.products[0].unitPriceExact4='1.2345';},p=>{p.products[0].lineTotalExact4='2.4693';},p=>{p.products[0].averageCostTryExact4=null;},p=>{p.grandTotalExact4='500.0001';},p=>{p.amountTryExact4='500.0001';},p=>{p.amountTryExact4='4.9385';}];
 for(const change of changes){const f=fixture();change(f.proof);assert.throws(()=>validateCanonicalBusinessSaleTransactionProof(f.proof,f.expected),{code:'CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED'});}
});
test('whole-unit quantity and exact duplicate-product limits cannot be relaxed by owner-shaped JSON',()=>{
 for(const quantity of ['0.000','1.500','6.000']){const f=fixture();f.proof.products[0].quantityExact3=quantity;f.expected.body.items[0].quantityExact3=quantity;assert.throws(()=>validateCanonicalBusinessSaleTransactionProof(f.proof,f.expected));}
 const f=fixture();f.proof.products.push({...f.proof.products[0]});f.expected.body.items.push({...f.expected.body.items[0]});assert.throws(()=>validateCanonicalBusinessSaleTransactionProof(f.proof,f.expected));
});
test('finalize and cancel require original invoice binding rather than a caller-selected account',()=>{
 for(const operation of ['sale_finalize','sale_cancel']){const f=fixture();f.proof.operation=operation;f.proof.invoiceId='91';f.expected.operation=operation;f.expected.invoiceId='91';f.expected.body={id:'91',expectedRevision:hash};assert.equal(validateCanonicalBusinessSaleTransactionProof(f.proof,f.expected).invoiceId,'91');f.expected.invoiceId='92';assert.throws(()=>validateCanonicalBusinessSaleTransactionProof(f.proof,f.expected));}
});
test('an unconfigured source installation rejects before making any SQL call or entering native code',async()=>{
 let invoked=0;await assert.rejects(withCanonicalBusinessSaleTransaction({transaction:{},request:()=>{invoked++;throw Error('SQL forbidden');},sql:{},actor:{id:17},requestId,operation:'sale_draft',bodyJson:'{}'},()=>{invoked++;}));assert.equal(invoked,0);
});
test('forged request/driver/transaction factories cannot register a native scope even with valid-shaped proof',async()=>{
 const {proof,expected}=fixture(),transaction={};let calls=0;
 const fake={parent:transaction,input(){return this;},query(){calls++;return {recordset:[expected.before]};},execute(){calls++;return {recordset:[{proof_json:JSON.stringify(proof)}]};}};
 await assert.rejects(withCanonicalBusinessSaleTransaction({transaction,request:()=>fake,sql:{},actor:{id:17},requestId,operation:'sale_draft',bodyJson:'{}'},()=>{calls++;}),{code:'CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED'});
 await assert.rejects(runCanonicalBusinessSaleTransaction({transaction,request:()=>fake,sql:{}},()=>{calls++;}),{code:'CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED'});
 assert.equal(calls,0);assert.equal(getCanonicalBusinessSaleTransaction(transaction),null);
});
test('draft proof requires the same private context profile, revision, preview and selected party/account',()=>{
 const changes=[p=>{delete p.context;},p=>{p.context.profileHash='B'.repeat(64);},p=>{p.context.revision='B'.repeat(64);},p=>{p.context.nativePreviewHash='B'.repeat(64);},p=>{p.context.scope.customer.id='156';},p=>{p.context.scope.customer.accountId='8';},p=>{p.context.scope.customer.partyId='9';},p=>{p.context.scope.customer.currency='TRY';}];for(const change of changes){const f=fixture();change(f.proof);assert.throws(()=>validateCanonicalBusinessSaleTransactionProof(f.proof,f.expected),{code:'CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED'});}
});

// Mirrors the frozen resolve context SELECT: private account/product source
// witnesses are in proof_json only, never invented inside context_json.
function sqlContextFixture(p,documentDate='2026-10-28'){
 const origin='CANONICAL_TEST_BUSINESS_SALE';
 return {profileHash:p.profileHash,meta:{schemaVersion:'melisa-work-trade.v1',date:documentDate,source:'canonical-business-test',operationOrigin:origin},revision:p.revision,nativePreviewHash:p.previewHash,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:false,canCancelCollection:false},scope:{synthetic:false,operationOrigin:origin,customer:{id:p.customerId,accountId:p.accountId,partyId:p.partyEntityId,currency:p.currency,name:'Synthetic customer',balanceExact8:'0.00000000',writeEligible:true,synthetic:false,operationOrigin:origin},products:p.products.map(x=>({id:x.productId,stockCode:x.stockCode,name:x.name,barcode:x.barcode,synthetic:false,operationOrigin:origin,writeEligible:true,stockQuantityExact3:'9.000',unit:{label:x.unit,factorExact8:x.factorExact8,sourceId:x.unitSourceId},costExact4:x.averageCostTryExact4,prices:[{quoteId:x.quoteId,currency:p.currency,unitPriceExact8:x.unitPriceExact8,revision:p.revision}]}))},nativeExpected:{items:p.products.map(x=>Object.fromEntries(['productId','quoteId','quantityExact3','unitPriceExact4','lineTotalExact4'].map(k=>[k,x[k]]))),grandTotalExact4:p.grandTotalExact4,amountTryExact4:p.amountTryExact4},supportedCurrencies:[p.currency],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000',maxAmountTryExact4:'500.0000'},rate:{currency:p.currency,rateExact8:p.rateExact8,rateDate:'2026-10-27',sourceKey:'synthetic/fx'}};
}

test('pure projection preserves raw evidence but grants neither a context brand nor transaction authority',()=>{
 const f=fixture(),raw=JSON.stringify(f.proof),context=f.proof.context,projected=projectCanonicalBusinessSaleContext(context,f.proof,{...f.expected,selection:f.expected.body,operation:'sale_draft'});
 assert.equal(projected.scope.customer.sourceKey,'synthetic/account');assert.notEqual(projected,context);assert(Object.isFrozen(projected));assert.equal(JSON.stringify(f.proof),raw);assert.equal(getCanonicalBusinessSaleContextProof(projected),null);assert.equal(getCanonicalBusinessSaleTransaction(projected),null);
 for(const change of [p=>{p.write=false;},p=>{p.accountSourceWitnessHash='bad';},p=>{p.products[0].sourceWitnessHash=null;},p=>{p.context.scope.customer.sourceKey='wrong-account';},p=>{p.context.scope.products[0].sourceWitnessHash='B'.repeat(64);},p=>{p.context.scope.products[0].unit.sourceId='10';}]){const bad=fixture();change(bad.proof);assert.throws(()=>validateCanonicalBusinessSaleTransactionProof(bad.proof,bad.expected),{code:'CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED'});}
});
