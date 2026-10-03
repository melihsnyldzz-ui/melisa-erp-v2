import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCrmOrderRequest,crmOrderFingerprint,crmOrderGatewayOrigin} from './testCrmOrderContract.mjs';
const input=()=>({requestId:'e735b2dc-95d4-4b10-99ac-3b1a0beafbc8',conversationId:'55',customerId:593,exchangeRate:1,items:[{sourceId:'vega-161466',stockCode:'41140 SÜPERMİNİ',quantity:2,unitPrice:196,currency:'TRY'}]});
test('CRM draft contract preserves exact catalog identity and four decimal money',()=>{
  assert.deepEqual(normalizeCrmOrderRequest(input()),input());
  const request=input();request.items[0].stockCode='000123';request.items[0].unitPrice=12.3456;assert.equal(normalizeCrmOrderRequest(request).items[0].stockCode,'000123');
  for(const value of [12.34567,NaN,Infinity,-1,'196']){const invalid=input();invalid.items[0].unitPrice=value;assert.throws(()=>normalizeCrmOrderRequest(invalid));}
});
test('CRM draft rejects other peer/conversation/customer, unexpected fields and ambiguous lines',()=>{
  for(const change of [{conversationId:55},{conversationId:'56'},{customerId:594},{peer:'905387217733'},{crmActorId:'claimed'},{requestId:'not-uuid'},{exchangeRate:2}])assert.throws(()=>normalizeCrmOrderRequest({...input(),...change}));
  for(const value of [0,10000,1.5,'2']){const invalid=input();invalid.items[0].quantity=value;assert.throws(()=>normalizeCrmOrderRequest(invalid));}
  for(const change of [{sourceId:'vega-0161466'},{stockCode:' 41140 SÜPERMİNİ'},{currency:'try'},{productId:301982}]){const invalid=input();Object.assign(invalid.items[0],change);assert.throws(()=>normalizeCrmOrderRequest(invalid));}
  const duplicate=input();duplicate.items.push({...duplicate.items[0]});assert.throws(()=>normalizeCrmOrderRequest(duplicate));
  assert.throws(()=>normalizeCrmOrderRequest({...input(),items:[]}));
});
test('idempotency fingerprint binds native actor, verified CRM actor and exact payload',()=>{
  const digest=crmOrderFingerprint(input(),1,'crm-user');assert.equal(digest,crmOrderFingerprint(input(),1,'crm-user'));
  assert.notEqual(digest,crmOrderFingerprint(input(),2,'crm-user'));assert.notEqual(digest,crmOrderFingerprint(input(),1,'other-user'));
  const different=input();different.items[0].quantity=3;assert.notEqual(digest,crmOrderFingerprint(different,1,'crm-user'));
});
test('CRM verification origin can only target the isolated62401 gateway',()=>{
  assert.equal(crmOrderGatewayOrigin(),'http://127.0.0.1:62401');
  for(const origin of ['http://127.0.0.1:4200','http://example.com:62401','http://user:pass@127.0.0.1:62401','http://127.0.0.1:62401/auth/me'])assert.throws(()=>crmOrderGatewayOrigin(origin));
});
