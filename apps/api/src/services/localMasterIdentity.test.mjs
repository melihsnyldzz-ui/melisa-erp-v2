import test from 'node:test';
import assert from 'node:assert/strict';
import {localProductIdentity,localCustomerIdentity,LOCAL_MASTER_IDENTITY_LIMITS} from './localMasterIdentity.mjs';

const product=()=>({product:{id:'420',name:'Örnek ürün'},units:[
 {id:'101',productId:'420',label:'METRE',factorExact8:'1.00000000',isMain:true},
 {id:'102',productId:'420',label:'TOP',factorExact8:'50.00000000',isMain:false}],prices:[
 {id:'701',productId:'420',type:'sale',unitId:'101',tier:1,currency:'EUR',priceExact8:'19.50000000'},
 {id:'702',productId:'420',type:'sale',unitId:'102',tier:2,currency:'USD',priceExact8:'0.00000000'},
 {id:'703',productId:'420',type:'purchase',unitId:null,tier:0,currency:'EUR',priceExact8:'9.50000000'}]});
const customer=()=>({customer:{id:'55',entityId:'250',currency:'USD'},entity:{id:'250',role:'customer'},accounts:[
 {id:'501',entityId:'250',customerId:'55',supplierId:null,currency:'USD',currentBalanceExact8:'0.00000000'},
 {id:'502',entityId:'250',customerId:'55',supplierId:null,currency:'EUR',currentBalanceExact8:null}]});
const bad=fn=>assert.throws(fn,{code:'LOCAL_MASTER_IDENTITY_INVALID'});

test('local product preserves user-selected units and currencies without Vega identity',()=>{
 const value=localProductIdentity(product());assert.equal(value.kind,'local');
 assert.equal(value.units[0].label,'METRE');assert.equal(value.units[1].label,'TOP');
 assert.equal(value.prices[0].currency,'EUR');assert.equal(value.prices[1].currency,'USD');
 assert.equal(value.prices[1].priceExact8,'0.00000000');
 assert.deepEqual([value.prices[0].type,value.prices[2].type,value.prices[2].unitId,value.prices[2].tier],['sale','purchase',null,0]);
 assert.equal(Object.hasOwn(value.units[0],'sourceUnitId'),false);
 assert.equal(LOCAL_MASTER_IDENTITY_LIMITS.sqlExecuted,false);assert.equal(LOCAL_MASTER_IDENTITY_LIMITS.writesEnabled,false);
 assert.equal(LOCAL_MASTER_IDENTITY_LIMITS.legacyReadersCompatible,false);
 assert.equal(LOCAL_MASTER_IDENTITY_LIMITS.confirmsPriceEligibility,false);
});
test('preserves distinct sale and purchase tuples, including nullable unit and observed tier shapes',()=>{
 const p=product();p.prices.push(
  {id:'704',productId:'420',type:'sale',unitId:null,tier:0,currency:'TRY',priceExact8:'5.00000000'},
  {id:'705',productId:'420',type:'purchase',unitId:'101',tier:1,currency:'EUR',priceExact8:'8.00000000'},
  {id:'706',productId:'420',type:'purchase',unitId:null,tier:1,currency:'USD',priceExact8:'7.00000000'},
  {id:'707',productId:'420',type:'sale',unitId:'101',tier:null,currency:'USD',priceExact8:null});
 const v=localProductIdentity(p);
 assert.equal(v.prices.length,7);
 assert.deepEqual(v.prices.slice(3).map(q=>[q.type,q.unitId,q.tier]),[['sale',null,0],['purchase','101',1],['purchase',null,1],['sale','101',null]]);
 assert.equal(v.prices[6].priceExact8,null);
});
test('product rejects unrelated or ambiguous units and prices rather than selecting one',()=>{
 for(const change of [
  p=>{p.units[0].productId='421';},p=>{p.units[0].factorExact8='2.00000000';},
  p=>{p.units[0].isMain=false;},p=>{p.units[1].isMain=true;p.units[1].factorExact8='1.00000000';},
  p=>{p.prices[0].productId='421';},p=>{p.prices[0].unitId='103';},p=>{p.prices[0].currency='';},
  p=>{p.prices[0].priceExact8='-1.00000000';},p=>{p.prices[0].tier=2147483648;},
  p=>{p.prices[0].tier=0.5;},p=>{p.prices[0].tier=undefined;},p=>{p.prices[0].type='other';},
  p=>{p.prices.push({...p.prices[0],id:'999'});},p=>{p.units.push({...p.units[0]});},
  p=>{p.prices.push({...p.prices[2],id:'999'});},
  p=>{p.prices[0].tier=null;p.prices.push({...p.prices[0],id:'999'});},
 ]){const p=product();change(p);bad(()=>localProductIdentity(p));}
});
test('selected customer currency stays explicit and unknown differs from zero',()=>{
 const c=localCustomerIdentity(customer());assert.equal(c.selectedCurrency,'USD');
 assert.equal(c.accounts[0].currentBalanceExact8,'0.00000000');assert.equal(c.accounts[1].currentBalanceExact8,null);
 const shared=customer();shared.accounts[0].customerId=null;
 assert.equal(localCustomerIdentity(shared).accounts[0].customerId,null);
 const v=customer();v.accounts[0].currentBalanceExact8='-123.25000000';
 assert.equal(localCustomerIdentity(v).accounts[0].currentBalanceExact8,'-123.25000000');
});
test('customer rejects mismatched entity, owner, supplier, currency and duplicate accounts',()=>{
 for(const change of [
  c=>{c.entity.id='251';},c=>{c.entity.role='supplier';},c=>{c.customer.currency='TRY';},
  c=>{c.accounts[0].entityId='251';},c=>{c.accounts[0].customerId='56';},
  c=>{c.accounts[0].customerId=null;c.accounts[0].entityId='251';},
  c=>{c.accounts[0].customerId=null;c.accounts[0].supplierId='56';},
  c=>{c.accounts[0].supplierId='56';},c=>{c.accounts[0].currentBalanceExact8='NaN';},
  c=>{c.accounts.push({...c.accounts[0],id:'503'});},
 ]){const c=customer();change(c);bad(()=>localCustomerIdentity(c));}
});
test('IDs and exact amounts reject malformed values and do not coerce numbers',()=>{
 for(const value of ['01','0','9223372036854775808',42]){const p=product();p.product.id=value;bad(()=>localProductIdentity(p));}
 for(const value of ['1','1.0','1.000000001','100000000000000000000.00000000',1]){
  const p=product();p.prices[0].priceExact8=value;bad(()=>localProductIdentity(p));
 }
});
test('unexpected fields or accessors are rejected without invoking getters',()=>{
 const p=product();Object.defineProperty(p,'product',{get(){throw Error('getter executed');},enumerable:true});
 bad(()=>localProductIdentity(p));
 const c=customer();c.extra='not part of the contract';bad(()=>localCustomerIdentity(c));
});
