import test from 'node:test';
import assert from 'node:assert/strict';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyJSON,isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {workHash,workExact,workScaled} from './workSalesModel.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {deriveBusinessSelectedSaleJournal} from './businessSelectedSaleJournal.mjs';
import {privateBusinessPriceLeafSources,earnedBusinessProductPriceNativeFixture,modeledBusinessPriceSaleRead} from './businessProductPriceNative.test-fixture.mjs';
import {workSalePreview} from './workSalesModel.mjs';

function fixture(currency='TRY'){
 const raw=structuredClone(businessInboundFixture().copy),product=raw.products[0];
 Object.assign(product,{identityVerified:true,sourceKnown:true,sourceWitnessHash:'E'.repeat(64)});
 product.quotes=['TRY','USD'].map((currency,i)=>({quoteId:String(100+i),currency,priceExact8:'3.00000000',type:'sale',mainUnit:true,verified:true,nativeRowHash:'F'.repeat(64),bindingHash:'E'.repeat(64)}));product.priceIds=['100','101'];
 Object.assign(raw.customers[0],{accountIdentityVerified:true,sourceAccountWitnessCount:1,openingHumanAccepted:false});
 raw.customers.push({...raw.customers[0],accountId:'23',currency:'USD'});
 const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),actor={id:'15',permissions:['sales.view']};
 const selected=selectBusinessSaleWriteIntent(copy,{customerId:'20',currency,productIds:[product.id]}),requestId='10000000-0000-4000-8000-000000000001',rate=copy.currencyRates.find(r=>r.currency===currency);
 const selection={customerId:'20',customerAccountId:selected.customerAccountId,documentDate:copy.date,currency,items:[{productId:product.id,quoteId:currency==='TRY'?'100':'101',quantityExact3:'8.000'}]};
 const item={...selection.items[0],stockCode:product.stockCode,name:'Offline item',unit:{label:'ADET',factorExact8:'1.00000000'},unitPriceExact8:'3.00000000',unitPriceExact4:'3.0000',lineTotalExact4:'24.0000',barcode:product.barcodes[0]};
 const amountTryExact4=workExact((240000n*workScaled(rate.rateExact8,8)+50000000n)/100000000n,4);
 const previewBody={selection,scopeRevision:'a'.repeat(64),currency,subtotalExact4:'24.0000',grandTotalExact4:'24.0000',amountTryExact4,items:[item],settlement:{documentCurrency:currency,accountCurrency:currency,accountId:selected.customerAccountId,documentRateExact8:rate.rateExact8,accountRateExact8:rate.rateExact8,rateSource:rate},sourceSelectionHash:selected.sourceSelectionHash,policyHash:selected.policyHash};
 const preview={...previewBody,previewHash:workHash(previewBody),copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin};
 const payload={requestId,expectedRevision:preview.scopeRevision,previewHash:preview.previewHash,customerId:selection.customerId,documentDate:copy.date,currency,items:selection.items,businessCustomerId:selected.customerId,businessAccountId:selected.customerAccountId,businessCurrency:currency,businessProductIds:selected.productIds,sourceSelectionHash:selected.sourceSelectionHash,businessSelectedSalePolicyHash:selected.policyHash,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,actorId:actor.id,operation:'sale_draft'};
 const invoice={id:'1000',documentNo:'NIGHT-'+requestId.replaceAll('-','').slice(0,24),documentDate:copy.date,status:'draft',customerId:'20',currency,subtotalExact4:'24.0000',grandTotalExact4:'24.0000',amountTryExact4};
 const record={link:{invoice_id:invoice.id,request_id:requestId,actor_id:actor.id,preview_json:JSON.stringify(preview)},journal:{copy_id:copy.copyId,request_id:requestId,actor_id:actor.id,operation:'sale_draft',payload_hash:isolatedCopyHash(payload),payload_json:isolatedCopyJSON(payload),response_json:isolatedCopyJSON({invoice:{...invoice,items:[{...item,currency}]},requestId,replayed:false})},invoice:{...invoice,accountCurrency:currency,accountAmountExact4:'24.0000',documentRateExact8:rate.rateExact8,accountRateExact8:rate.rateExact8,createdBy:actor.id},items:[{...item,currency,averageCostTryExact4:product.costExact4}]};
 return {copy,actor,record};
}
const derive=f=>deriveBusinessSelectedSaleJournal(f.copy,f.actor,f.record);
const changeJSON=(record,key,mutate)=>{const object=JSON.parse(record[key]);mutate(object);record[key]=key==='preview_json'?JSON.stringify(object):isolatedCopyJSON(object);};
test('caller pricing snapshot and generic HISTORY DTO cannot bypass immutable native pricing authority',()=>{
 const f=fixture();changeJSON(f.record.link,'preview_json',p=>{p.pricing={pricingJson:'[]',pricingHash:'A'.repeat(64)};});
 for(const priceHistory of [null,{pricingProof:{mode:'HISTORY',invoiceId:'1000'},scope:{products:[]}}])assert.throws(()=>deriveBusinessSelectedSaleJournal(f.copy,f.actor,f.record,{priceHistory}),{code:'WORK_SELECTED_SALE_DRIFT'});
});
test('creation journal derives full SOURCE account and permits changed lifecycle only',()=>{
 for(const currency of ['TRY','USD']){
  const f=fixture(currency);f.record.invoice.status='finalized';f.record.invoice.revision='b'.repeat(64);
  const result=derive(f);assert.equal(result.selection.customerAccountId,currency==='TRY'?'22':'23');assert.equal(result.selection.currency,currency);assert.equal(result.creation.invoiceId,'1000');assert.ok(Object.isFrozen(result.selection.productIds));assert.equal(result.writeAuthorized,undefined);
 }
});
test('caller preview, link-only or missing journal is not creation evidence',()=>{
 const f=fixture();assert.throws(()=>deriveBusinessSelectedSaleJournal(f.copy,f.actor,null),{code:'WORK_INVOICE_NOT_FOUND',statusCode:404});delete f.record.journal;assert.throws(()=>derive(f),{code:'WORK_INVOICE_NOT_FOUND'});
});
test('wrong actor or copy fails scope rather than deriving a selection',()=>{
 const f=fixture();f.actor.id='16';assert.throws(()=>derive(f),{code:'WORK_SELECTED_SALE_FORBIDDEN',statusCode:403});
 const g=fixture();g.record.journal.copy_id='10000000-0000-4000-8000-000000000002';assert.throws(()=>derive(g),{code:'WORK_INVOICE_NOT_FOUND',statusCode:404});
});
test('request, operation, hash, canonical text and creation invoice tamper fail',()=>{
 const mutations=[r=>r.link.request_id='10000000-0000-4000-8000-000000000002',r=>r.journal.operation='sale_finalize',r=>r.journal.payload_hash='E'.repeat(64),r=>r.journal.payload_json=' '+r.journal.payload_json,r=>changeJSON(r.journal,'response_json',o=>o.invoice.id='2000'),r=>changeJSON(r.journal,'payload_json',o=>o.actorId='16')];
 for(const mutate of mutations){const f=fixture();mutate(f.record);assert.throws(()=>derive(f),{code:'WORK_SELECTED_SALE_DRIFT',statusCode:409});}
});
test('native header, line, cost, currency, FX and preview drift fail',()=>{
 const mutations=[r=>r.invoice.currency='USD',r=>r.invoice.customerId='21',r=>r.invoice.accountCurrency='USD',r=>r.invoice.accountRateExact8='2.00000000',r=>r.invoice.amountTryExact4='25.0000',r=>r.items[0].quantityExact3='7.000',r=>r.items[0].unitPriceExact4='4.0000',r=>r.items[0].averageCostTryExact4='1.0000',r=>r.items[0].barcode='other',r=>changeJSON(r.link,'preview_json',p=>p.items[0].unit.factorExact8='2.00000000'),r=>changeJSON(r.link,'preview_json',p=>p.selection.customerAccountId='23')];
 for(const mutate of mutations){const f=fixture();mutate(f.record);assert.throws(()=>derive(f),{code:'WORK_SELECTED_SALE_DRIFT'});}
});
test('self-consistent forged preview cannot replace immutable creation response',()=>{
 const f=fixture(),p=JSON.parse(f.record.link.preview_json),payload=JSON.parse(f.record.journal.payload_json);
 p.items[0].name='Changed immutable name';const {previewHash,copyId,sealHash,operationOrigin,...body}=p;p.previewHash=workHash(body);payload.previewHash=p.previewHash;
 f.record.link.preview_json=JSON.stringify(p);f.record.journal.payload_json=isolatedCopyJSON(payload);f.record.journal.payload_hash=isolatedCopyHash(payload);
 assert.throws(()=>derive(f),{code:'WORK_SELECTED_SALE_DRIFT'});
});
test('coherently rehashed payload still cannot substitute SOURCE account, policy or selection',()=>{
 const mutations=[p=>p.businessAccountId='23',p=>p.businessCustomerId='21',p=>p.businessCurrency='USD',p=>p.businessProductIds=['99'],p=>p.sourceSelectionHash='E'.repeat(64),p=>p.businessSelectedSalePolicyHash='E'.repeat(64),p=>p.sealHash='E'.repeat(64),p=>p.operationOrigin='LIVE'];
 for(const mutate of mutations){const f=fixture(),p=JSON.parse(f.record.journal.payload_json);mutate(p);f.record.journal.payload_json=isolatedCopyJSON(p);f.record.journal.payload_hash=isolatedCopyHash(p);assert.throws(()=>derive(f),{code:'WORK_SELECTED_SALE_DRIFT'});}
});
test('response cannot silently change immutable original line or creation status',()=>{
 for(const mutate of [o=>o.invoice.items[0].unitPriceExact8='4.00000000',o=>o.invoice.items[0].unit.factorExact8='2.00000000',o=>o.invoice.items[0].currency='USD',o=>o.invoice.status='finalized']){const f=fixture();changeJSON(f.record.journal,'response_json',mutate);assert.throws(()=>derive(f),{code:'WORK_SELECTED_SALE_DRIFT'});}
});
test('earned synthetic HISTORY verifies saved manual invoice after later CURRENT price, without repricing its journal',{skip:!process.env.ERP04_V11_LEAF_INPUT||!process.env.ERP04_V11_LEAF_SHA256},async()=>{
 const f=await earnedBusinessProductPriceNativeFixture(privateBusinessPriceLeafSources(process.env.ERP04_V11_LEAF_INPUT,process.env.ERP04_V11_LEAF_SHA256)),h=modeledBusinessPriceSaleRead(f),requestId='10000000-0000-4000-8000-000000000001';
 const preview=await h.run(dto=>{
  const original=workSalePreview({customerId:'100',currency:'TRY',documentDate:f.copy.date,items:[{productId:'444',quoteId:'100',quantityExact3:'1.000'}]},dto),{previewHash,...value}=original;
  value.selection.customerAccountId=h.selection.customerAccountId;value.items[0].barcode=f.copy.products[0].barcodes[0];value.sourceSelectionHash=h.selection.sourceSelectionHash;value.policyHash=h.selection.policyHash;
  return {...value,previewHash:workHash(value),copyId:f.copy.copyId,sealHash:f.copy.sealHash,operationOrigin:f.copy.operationOrigin};
 });
 const payload={requestId,expectedRevision:preview.scopeRevision,previewHash:preview.previewHash,customerId:'100',documentDate:f.copy.date,currency:'TRY',items:preview.selection.items,businessCustomerId:'100',businessAccountId:h.selection.customerAccountId,businessCurrency:'TRY',businessProductIds:['444'],sourceSelectionHash:h.selection.sourceSelectionHash,businessSelectedSalePolicyHash:h.selection.policyHash,copyId:f.copy.copyId,sealHash:f.copy.sealHash,operationOrigin:f.copy.operationOrigin,actorId:'15',operation:'sale_draft'};
 const header={id:'500',documentNo:'NIGHT-'+requestId.replaceAll('-','').slice(0,24),documentDate:f.copy.date,status:'draft',customerId:'100',currency:'TRY',subtotalExact4:preview.subtotalExact4,grandTotalExact4:preview.grandTotalExact4,amountTryExact4:preview.amountTryExact4};
 const item={...preview.items[0],currency:'TRY'},record={link:{invoice_id:'500',request_id:requestId,actor_id:'15',preview_json:JSON.stringify(preview)},journal:{copy_id:f.copy.copyId,request_id:requestId,actor_id:'15',operation:'sale_draft',payload_hash:isolatedCopyHash(payload),payload_json:isolatedCopyJSON(payload),response_json:isolatedCopyJSON({invoice:{...header,items:[item]},requestId,replayed:false})},invoice:{...header,status:'finalized',accountCurrency:'TRY',accountAmountExact4:preview.grandTotalExact4,documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',createdBy:'15'},items:[{...item,averageCostTryExact4:f.copy.products[0].costExact4}]};
 const serialized=isolatedCopyJSON(record);
 const later=modeledBusinessPriceSaleRead(f,{priceExact8:'9.00000000'});await later.run(dto=>assert.equal(dto.scope.products[0].prices[0].unitPriceExact8,'9.00000000'));
 const history=modeledBusinessPriceSaleRead(f,{mode:'HISTORY',invoiceId:'500'});
 await history.run(dto=>{const result=deriveBusinessSelectedSaleJournal(f.copy,h.actor,record,{priceHistory:dto});assert.equal(result.creation.invoiceId,'500');assert.equal(record.items[0].unitPriceExact4,'4.2500');assert.throws(()=>deriveBusinessSelectedSaleJournal(f.copy,h.actor,record,{priceHistory:structuredClone(dto)}));});
 assert.equal(isolatedCopyJSON(record),serialized);assert.equal(f.copy.products[0].quotes[0].priceExact8,'3.00000000');
});
