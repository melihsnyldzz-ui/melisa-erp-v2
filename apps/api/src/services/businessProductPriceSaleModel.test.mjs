import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';
import {validateBusinessProductPriceSaleDTO} from './businessProductPriceSaleModel.mjs';
function fixture(origin='SOURCE'){
  const {copy}=businessProductPriceFixture(),expected={profileHash:'A'.repeat(64),priceRevisionHash:'B'.repeat(64),saleRevisionHash:'C'.repeat(64),readerDefinitionHash:'D'.repeat(64)};
  const p={origin,versionId:origin==='SOURCE'?null:'1',sourcePriceExact8:'3.00000000',nativeRowHash:'F'.repeat(64),bindingHash:'E'.repeat(64),priceExact8:origin==='SOURCE'?'3.00000000':'1.23456789',versionProofHash:origin==='SOURCE'?null:'9'.repeat(64)};
  const rows=[{productId:'444',quoteId:'100',currency:'TRY',pricing:p}],pricingJson=JSON.stringify(rows);
  const dto={pricingProof:{schemaVersion:'melisa-business-product-price-sale-proof.v1',copyId:copy.copyId,sealHash:copy.sealHash,...expected,mode:'CURRENT',invoiceId:null,pricingHash:createHash('sha256').update(pricingJson,'utf16le').digest('hex').toUpperCase()},scope:{products:[{id:'444',prices:[{quoteId:'100',currency:'TRY',unitPriceExact8:p.priceExact8,pricing:structuredClone(p)}]}]}};
  return {copy,expected,rows,pricingJson,dto};
}
test('manual price verifies alongside immutable source, retaining exact8 and NULL distinction',()=>{
  for(const origin of ['SOURCE','MANUAL']){
    const f=fixture(origin),result=validateBusinessProductPriceSaleDTO(f.copy,f.dto,f.pricingJson,f.expected);
    assert.equal(result.rows[0].pricing.origin,origin);assert.equal(f.copy.products[0].quotes[0].priceExact8,'3.00000000');
  }
  const f=fixture('MANUAL');f.rows[0].pricing.priceExact8=null;f.pricingJson=JSON.stringify(f.rows);f.dto.pricingProof.pricingHash=createHash('sha256').update(f.pricingJson,'utf16le').digest('hex').toUpperCase();
  f.dto.scope.products[0].prices[0].unitPriceExact8=null;f.dto.scope.products[0].prices[0].pricing.priceExact8=null;
  assert.equal(validateBusinessProductPriceSaleDTO(f.copy,f.dto,f.pricingJson,f.expected).rows[0].pricing.priceExact8,null);
});
test('context alteration, substituted quote, detached body or wrong reader pin reject',()=>{
  for(const mutate of [f=>{f.dto.scope.products[0].prices[0].unitPriceExact8='99.00000000';},f=>{f.dto.scope.products[0].prices[0].quoteId='101';},f=>{f.pricingJson+=' ';},f=>{f.dto.pricingProof.readerDefinitionHash='E'.repeat(64);}]){
    const f=fixture('MANUAL');mutate(f);assert.throws(()=>validateBusinessProductPriceSaleDTO(f.copy,f.dto,f.pricingJson,f.expected),{code:'BUSINESS_PRICE_SALE_PROOF'});
  }
});
test('history requires exact invoice scope and cannot masquerade as current pricing',()=>{
  const f=fixture('MANUAL');f.dto.pricingProof.mode='HISTORY';f.dto.pricingProof.invoiceId='12';
  assert.throws(()=>validateBusinessProductPriceSaleDTO(f.copy,f.dto,f.pricingJson,f.expected));
  assert.throws(()=>validateBusinessProductPriceSaleDTO(f.copy,f.dto,f.pricingJson,f.expected,{mode:'HISTORY',invoiceId:'13'}));
  assert.equal(validateBusinessProductPriceSaleDTO(f.copy,f.dto,f.pricingJson,f.expected,{mode:'HISTORY',invoiceId:'12'}).proof.invoiceId,'12');
});
