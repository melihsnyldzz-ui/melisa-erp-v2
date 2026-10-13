import test from 'node:test';
import assert from 'node:assert/strict';
import {businessPriceContext,businessPriceDisplay,businessPriceRequest,businessPricePending,canonicalPrice} from './businessProductPriceModel.mjs';
const context=()=>({schemaVersion:'melisa-business-product-prices.v1',productId:'444',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',sealHash:'A'.repeat(64),revision:'B'.repeat(64),operationOrigin:'ISOLATED_TEST_COPY',canEdit:true,prices:[{priceId:'100',tuple:{type:'sale',unitId:null,tier:0,currency:'TRY'},priceExact:'3.12345678',currentVersionId:null,source:{quoteId:'100',priceExact8:'3.12345678',nativeRowHash:'C'.repeat(64),bindingHash:'D'.repeat(64),sourceUnitId:null}}],recentChanges:[]});
const requestId='4c758081-465d-445f-b024-aad40355f9d0';
test('display keeps two decimals without losing the editable source precision',()=>{
  assert.equal(businessPriceDisplay('3.12345678'),'3,12');
  assert.equal(businessPriceDisplay('3.12500000'),'3,13');
  assert.equal(businessPriceDisplay('99999999999999999999.99999999'),'100000000000000000000,00');
  assert.equal(businessPriceDisplay(null),'Bilinmiyor');assert.equal(businessPriceDisplay('0.00000000'),'0,00');
  assert.equal(canonicalPrice('3,12345678'),'3.12345678');
});
test('product context cannot substitute another product or silently default manual NULL',()=>{
  const c=context();assert.equal(businessPriceContext(c,'444'),c);
  assert.throws(()=>businessPriceContext(c,'445'));
  c.prices[0].priceExact=null;assert.throws(()=>businessPriceContext(c,'444'));
  c.prices[0].currentVersionId='1';assert.equal(businessPriceContext(c,'444').prices[0].priceExact,null);
});
test('pending request stays bound to actor/copy/tuple and keeps old CAS for replay',()=>{
  const c=context(),body=businessPriceRequest(c,{priceId:'100',priceExact:'1.23456789',reason:'Yeni fiyat'},requestId);
  const pending={actorId:'16',copyId:c.copyId,sealHash:c.sealHash,productId:c.productId,status:'pending',body};
  c.revision='E'.repeat(64);
  assert.equal(businessPricePending(pending,c,'16').body.expectedRevision,'B'.repeat(64));
  assert.throws(()=>businessPricePending(pending,c,'15'));
  assert.throws(()=>businessPricePending({...pending,copyId:'bad'},c,'16'));
  assert.throws(()=>businessPricePending({...pending,body:{...body,tuple:{...body.tuple,currency:'USD'}}},c,'16'));
});
test('save acknowledgement cannot substitute another currency or tier in change history',()=>{
  const c=context();
  c.recentChanges=[{versionId:'1',requestId,actorId:'16',priceId:'100',tuple:{...c.prices[0].tuple},beforePriceExact:'3.12345678',priceExact:'1.23456789',reason:'Yeni fiyat',createdAt:'2026-10-13T10:00:00.000Z'}];
  assert.equal(businessPriceContext(c,'444'),c);
  for(const patch of [{currency:'USD'},{tier:6},{unitId:'2'}]){
    const altered=structuredClone(c);Object.assign(altered.recentChanges[0].tuple,patch);
    assert.throws(()=>businessPriceContext(altered,'444'));
  }
  c.recentChanges.push({...c.recentChanges[0]});assert.throws(()=>businessPriceContext(c,'444'));
});
