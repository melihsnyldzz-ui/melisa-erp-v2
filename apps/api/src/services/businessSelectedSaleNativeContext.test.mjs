import test from 'node:test';
import assert from 'node:assert/strict';
import {privateBusinessPriceLeafSources,earnedBusinessProductPriceNativeFixture,modeledBusinessPriceSaleRead,modeledBusinessPriceSaleWrite} from './businessProductPriceNative.test-fixture.mjs';
import {getRegisteredBusinessProductPriceSaleRevision} from '../../../../scripts/canonical/shared-business-product-price-sale-bootstrap.mjs';
import {getBusinessProductPriceSaleDTO,transferBusinessProductPriceSaleDTO,clearBusinessProductPriceSaleDTO} from './businessProductPriceSaleScope.mjs';
import {workSalePreview} from './workSalesModel.mjs';
import {getBusinessSelectedSaleWriteScope} from './businessSelectedSaleWriteScope.mjs';
const path=process.env.ERP04_V11_LEAF_INPUT,sha=process.env.ERP04_V11_LEAF_SHA256;
const fixture=()=>earnedBusinessProductPriceNativeFixture(privateBusinessPriceLeafSources(path,sha));

test('earned modeled v11/12/13 chain preserves the genuine frozen header and parent source bytes',{skip:!path||!sha},async()=>{
 const f=await fixture(),source=f.selected.bundle.contextArtifact.storedDefinition;
 assert.equal(f.synthetic,true);assert.equal(f.nativeExecution,false);assert.equal(f.selected.stockPredicateRevision.version,11);assert.equal(f.metadata.revision.version,12);assert.equal(f.consumer.revision.version,13);
 assert.strictEqual(getRegisteredBusinessProductPriceSaleRevision(f.copy),f.consumer);
 assert.match(source,/^CREATE   PROCEDURE /);assert.match(f.consumer.bundle.contextArtifact.definition,/^CREATE PROCEDURE /);
 assert.equal(f.selected.bundle.contextArtifact.storedDefinition,source);
 assert.equal(f.consumer.bundle.revision.baseSelectedRevisionHash,f.selected.stockPredicateRevision.revisionHash);
 assert.equal(f.consumer.bundle.revision.sourceContextHash,f.selected.bundle.contextArtifact.definitionHash);
});
test('earned CURRENT native result permits exact manual preview; copied or changed DTO loses authority',{skip:!path||!sha},async()=>{
 const f=await fixture(),h=modeledBusinessPriceSaleRead(f);
 const value=await h.run(dto=>{
  const proof=getBusinessProductPriceSaleDTO(f.copy,dto,{transaction:h.transaction});assert.equal(proof.rows[0].pricing.priceExact8,'4.25000000');
  const preview=workSalePreview({customerId:'100',currency:'TRY',documentDate:f.copy.date,items:[{productId:'444',quoteId:'100',quantityExact3:'1.000'}]},dto);
  assert.equal(preview.grandTotalExact4,'4.2500');assert.equal(preview.pricing.pricingJson,h.row.pricing_json);
  const copied=structuredClone(dto);assert.equal(getBusinessProductPriceSaleDTO(f.copy,copied),null);assert.throws(()=>workSalePreview(preview.selection,copied));
  const target={...dto};transferBusinessProductPriceSaleDTO(f.copy,dto,target);assert(getBusinessProductPriceSaleDTO(f.copy,target));clearBusinessProductPriceSaleDTO(target);assert.equal(getBusinessProductPriceSaleDTO(f.copy,target),null);
  dto.scope.products[0].prices[0].unitPriceExact8='99.00000000';assert.throws(()=>getBusinessProductPriceSaleDTO(f.copy,dto),{code:'PRICE_SALE_DTO_CHANGED'});
  return preview;
 });
 assert.equal(value.items[0].unitPriceExact8,'4.25000000');assert.equal(f.copy.products[0].quotes[0].priceExact8,'3.00000000');
});
test('native HISTORY binds immutable invoice and never grants a new CURRENT preview; unknown stays unknown',{skip:!path||!sha},async()=>{
 const f=await fixture();
 for(const priceExact8 of ['4.25000000',null]){
  const h=modeledBusinessPriceSaleRead(f,{mode:'HISTORY',invoiceId:'500',priceExact8});
  await h.run(dto=>{const info=getBusinessProductPriceSaleDTO(f.copy,dto);assert.equal(info.proof.invoiceId,'500');assert.equal(dto.scope.products[0].prices[0].unitPriceExact8,priceExact8);assert.throws(()=>workSalePreview({customerId:'100',currency:'TRY',documentDate:f.copy.date,items:[{productId:'444',quoteId:'100',quantityExact3:'1.000'}]},dto),{code:'WORK_PRODUCT_SCOPE'});});
 }
 const unknown=modeledBusinessPriceSaleRead(f,{priceExact8:null});await unknown.run(dto=>assert.throws(()=>workSalePreview({customerId:'100',currency:'TRY',documentDate:f.copy.date,items:[{productId:'444',quoteId:'100',quantityExact3:'1.000'}]},dto),{code:'WORK_PRICE_UNKNOWN'}));
});
test('earned same-TX owner intent accepts manual CURRENT and immutable HISTORY only, then expires',{skip:!path||!sha},async()=>{
 const f=await fixture();
 for(const operation of ['sale_draft','sale_finalize','sale_cancel']){
  const h=modeledBusinessPriceSaleWrite(f,{operation});let dto;
  await h.run(value=>{dto=value;const selection=getBusinessSelectedSaleWriteScope(f.copy,h.transaction),pricing=getBusinessProductPriceSaleDTO(f.copy,value);assert.equal(selection.operation,operation);assert.equal(pricing.rows[0].pricing.priceExact8,'4.25000000');assert.equal(pricing.proof.mode,operation==='sale_draft'?'CURRENT':'HISTORY');});
  assert.equal(getBusinessSelectedSaleWriteScope(f.copy,h.transaction),null);assert.throws(()=>getBusinessProductPriceSaleDTO(f.copy,dto),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
 }
 const bad=modeledBusinessPriceSaleWrite(f,{mutate:(kind,row)=>{if(kind==='row')row.pricing_json+=' ';}});await assert.rejects(bad.run(()=>{}),{code:'BUSINESS_PRICE_SALE_PROOF'});
});
