import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCrmOrderRequest,crmOrderFingerprint,crmOrderGatewayOrigin,normalizeCrmOpeningProduct,CRM_ORDER_OPENING,crmOrderNativeId,crmOrderPublicId,crmOrderTotals} from './testCrmOrderContract.mjs';
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
const opening=()=>({sourceId:'vega-12',stockCode:'0007',productName:'Fixture',erpProductId:'9007199254740993',nativeProductId:'9007199254740993',nativePriceId:'9007199254740994',productSourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12',priceSourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12/PRICE/sale/1/1/TRY',type:'sale',unitSourceId:'1',mainUnitSourceId:'1',isMainUnit:true,tier:1,unit:'ADET',factorExact8:'1.00000000',currency:'TRY',priceExact8:'1.23455000',nativePriceExact4:'1.2346',unitPrice:1.2346,...CRM_ORDER_OPENING});
test('typed opening projection uses exact8 HALF_UP4 and preserves all BIGINT identities',()=>{
 const result=normalizeCrmOpeningProduct(opening());assert.equal(result.erpProductId,'9007199254740993');assert.equal(result.nativePriceId,'9007199254740994');assert.equal(result.roundingRequired,true);assert.equal(result.nativePriceExact4,'1.2346');assert.equal(result.roundingRule,'HALF_UP');
 assert.equal(crmOrderPublicId('301982'),301982);assert.equal(crmOrderNativeId('9223372036854775807'),'9223372036854775807');
 for(const value of [9007199254740992,'9223372036854775808','01','1.0',0])assert.throws(()=>crmOrderNativeId(value));
});
test('NULL, untyped scalar-only, inferred unit and forged projection are never acceptable prices',()=>{
 for(const change of [{priceExact8:null},{priceExact8:'1.23455'},{nativePriceExact4:'1.2345'},{unitPrice:1.2345},{priceSourceKey:'wrong'},{factorExact8:'1'},{mainUnitSourceId:'2'},{tier:0},{type:'purchase'},{isMainUnit:1},{nativePriceId:null}])assert.throws(()=>normalizeCrmOpeningProduct({...opening(),...change}));
 const row=opening();delete row.priceExact8;row.sales_price=1.2346;assert.throws(()=>normalizeCrmOpeningProduct(row));
 const zero=normalizeCrmOpeningProduct({...opening(),priceExact8:'0.00000000',nativePriceExact4:'0.0000',unitPrice:0});assert.equal(zero.unitPrice,0);assert.equal(zero.roundingRequired,false);
});
test('SQL-equivalent exact document totals avoid binary FX half-tie and accumulating line errors',()=>{
 assert.deepEqual(crmOrderTotals([{quantity:1,unitPrice:1}],1.00105),{lineTotals:[1],grandTotal:1,amountTry:1.0011});
 assert.deepEqual(crmOrderTotals([{quantity:3,unitPrice:0.0001},{quantity:7,unitPrice:0.0001}],1),{lineTotals:[0.0003,0.0007],grandTotal:0.001,amountTry:0.001});
 assert.throws(()=>crmOrderTotals([{quantity:9999,unitPrice:1000000}],10000));
});
