import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveReviewedProductImage} from '../../apps/terminal-app/src/services/reviewedProductImage.js';
const reference='/uploads/verified-products/'+'a'.repeat(64)+'--test.jpg';
test('reviewed image renders only through the configured API origin',()=>{
  assert.equal(resolveReviewedProductImage(reference,'http://192.168.1.46:4100'),'http://192.168.1.46:4100'+reference);
  assert.equal(resolveReviewedProductImage('http://host.docker.internal:4100'+reference,'https://erp.example/api'),'https://erp.example'+reference);
});
test('raw cached/detail photos and unsafe URI variants cannot become display fallbacks',()=>{
  for(const value of [null,'','/uploads/vega-products/old.jpg','/uploads/products/old.jpg','file:///old.jpg','data:image/png;base64,a','content://old.jpg',reference+'?x=1',reference+'#x','http://u:p@host'+reference,reference.replace('test.jpg','x%2Fy.jpg'),reference.replace('verified-products','verified-products\\'),reference.replace('a'.repeat(64),'a'.repeat(63))]) {
    assert.equal(resolveReviewedProductImage(value,'http://localhost:4100'),'');
  }
  for(const base of ['', 'file:///tmp','https://u:p@example.com','https://erp.example?token=x']) assert.equal(resolveReviewedProductImage(reference,base),'');
});
