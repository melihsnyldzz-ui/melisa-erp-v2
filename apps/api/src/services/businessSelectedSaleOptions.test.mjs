import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {businessSelectedSaleOptions,selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';

test('options use every eligible source pair and skip an earlier invalid product or customer',()=>{
 const raw=structuredClone(selectedSaleFixture().c);
  const good=structuredClone(raw.products[0]);
  raw.products.unshift({...good,id:'443',stockCode:'OFFLINE-BAD',sourceKey:'VEGA2026/F0102TBLSTOKLAR/443',quarantined:true}); // gitleaks:allow -- public source identity or synthetic fixture, not a credential
  raw.customers[0].quarantined=true;
 const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);
 const c=validateIsolatedOperationCopyContext(raw);
 const options=businessSelectedSaleOptions(c);
 assert(options.customers.some(p=>p.id==='101'&&p.currency==='TRY'));
 assert(!options.customers.some(p=>p.id==='100'&&p.currency==='TRY'));
 assert(options.products.some(p=>p.id==='444'&&p.currencies.includes('TRY')));
 assert(!options.products.some(p=>p.id==='443'));
 for(const p of options.products)for(const currency of p.currencies){
  for(const customer of options.customers.filter(c=>c.currency===currency))
   assert.equal(selectBusinessSaleWriteIntent(c,{customerId:customer.id,currency,productIds:[p.id]}).currency,currency);
 }
 assert.strictEqual(businessSelectedSaleOptions(c),options);
 assert.equal(Object.isFrozen(options),true);
 assert.deepEqual(options.products[0].barcodes,['00444']);
 assert.equal(options.products[0].costExact4,undefined);
});

test('an account without a matching source sale quote does not appear under a different currency',()=>{
 const {c}=selectedSaleFixture(raw=>{raw.products[0].quotes=raw.products[0].quotes.filter(q=>q.currency==='TRY');});
 const options=businessSelectedSaleOptions(c);
 assert(!options.customers.some(p=>p.currency==='USD'));
 assert.deepEqual(options.products[0].currencies,['TRY']);
});
