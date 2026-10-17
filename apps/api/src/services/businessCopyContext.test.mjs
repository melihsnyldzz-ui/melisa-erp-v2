import test from 'node:test';import assert from 'node:assert/strict';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyHash,assertIsolatedCopyIdentity} from './isolatedOperationCopyContext.mjs';
const reseal=c=>{const {sealHash,...body}=c;return {...body,sealHash:isolatedCopyHash(body)};};
test('large source-known scope keeps account/currency identity and rejects LL/unknown witnesses before activation',()=>{
 const raw=structuredClone(businessInboundFixture().copy);
 raw.products=Array.from({length:80},(_,i)=>({...raw.products[0],id:String(1000+i),priceIds:[String(3000+i)],sourceKey:'VEGA2026/F0102TBLSTOKLAR/'+(1000+i)})); // gitleaks:allow anonymous synthetic source keys only
 raw.customers=Array.from({length:90},(_,i)=>({...raw.customers[0],id:String(2000+i),accountId:String(5000+i),currency:i%2?'USD':'TRY'}));
 const c=validateIsolatedOperationCopyContext(reseal(raw));assert.equal(c.products.length,80);assert.equal(c.customers.length,90);assert.equal(Object.isFrozen(c.products),true);
 for(const change of [c=>c.customers[0].id='591',c=>c.customers[0].id='592',c=>c.customers[0].sourceKnown=false,c=>c.suppliers[0].sourceWitnessHash=null,c=>c.customers[1].accountId=c.customers[0].accountId]){const bad=structuredClone(raw);change(bad);assert.throws(()=>validateIsolatedOperationCopyContext(reseal(bad)));}
 assert.throws(()=>assertIsolatedCopyIdentity(c,{db:c.target.database,server:c.target.server,login:c.target.login,databaseUser:c.target.databaseUser,sysadmin:0,control:0,live:1,originalDatabaseAccess:0}));
});
test('dated rates and bounded invoice cap stay sealed and never become unknown zero or future rates',()=>{
 const raw=structuredClone(businessInboundFixture().copy);
 for(const change of [c=>c.businessInvoiceMaxExact4='500000.0000',c=>c.currencyRates[1].rateExact8='0.00000000',c=>c.currencyRates[1].date='2026-10-10',c=>c.currencyRates[1].source='',c=>c.currencyRates.push({...c.currencyRates[1]}),c=>c.currencyRates[0].rateExact8='47.80000000']){const bad=structuredClone(raw);change(bad);assert.throws(()=>validateIsolatedOperationCopyContext(reseal(bad)));}
 const mutated=structuredClone(raw);mutated.currencyRates[1].rateExact8='50.00000000';assert.throws(()=>validateIsolatedOperationCopyContext(mutated));
});
