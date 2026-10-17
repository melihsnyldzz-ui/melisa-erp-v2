import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {tokenCodec,saleIdentity,validateQuotedLines} from './nativeTerminalPolicy.mjs';
const actor={id:3},signer=tokenCodec(randomBytes(32).toString('hex'));
const quoted={actorId:3,terminalCode:'TERM-V2-001',customerId:10,productId:20,currency:'USD',unitPrice:'12.80',exchangeRate:'47.8',stock:'-2'};
const payload=()=>({clientEventId:'cb55a41b-afdc-4f76-868a-16e142b870d1',terminalCode:'TERM-V2-001',customerId:10,documentCurrency:'USD',discountRate:'0',note:'',changes:[],items:[{productId:20,quantity:1,unitPrice:'12.80',quoteToken:signer.issue('quote',quoted)}]});
test('signed price snapshot preserves negative stock and receipt currency',()=>{const {business}=saleIdentity(payload(),actor);const p=validateQuotedLines(business,actor,{canChangeSalePrice:false},signer);assert.equal(p.items[0].unitPrice,12.8);assert.equal(p.items[0].quote.stock,'-2');assert.equal(p.exchangeRate,47.8);});

test('only an explicitly signed common-currency price can bind another same-currency customer',()=>{
 const p=payload();p.customerId=99;
 assert.throws(()=>validateQuotedLines(saleIdentity(p,actor).business,actor,{canChangeSalePrice:false},signer),{code:'NATIVE_QUOTE_OWNER'});
 p.items[0].quoteToken=signer.issue('quote',{...quoted,priceScope:'currency-v1'});
 assert.equal(validateQuotedLines(saleIdentity(p,actor).business,actor,{canChangeSalePrice:false},signer).items[0].quote.unitPrice,'12.80');
 for(const [field,value] of [['actorId',4],['terminalCode','OTHER'],['productId',21],['currency','EUR']]){
  p.items[0].quoteToken=signer.issue('quote',{...quoted,priceScope:'currency-v1',[field]:value});
  assert.throws(()=>validateQuotedLines(saleIdentity(p,actor).business,actor,{canChangeSalePrice:false},signer),{code:'NATIVE_QUOTE_OWNER'});
 }
});
test('tampered quote cannot authorize a price',()=>{const token=signer.issue('quote',quoted),[raw,sig]=token.split('.');const changed=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(raw,'base64url')),data:{...quoted,unitPrice:'0.01'}})).toString('base64url');assert.throws(()=>signer.verify(changed+'.'+sig,'quote'),{code:'NATIVE_SNAPSHOT_UNTRUSTED'});});
for(const [field,value] of [['actorId',4],['terminalCode','OTHER'],['customerId',11],['productId',21],['currency','EUR']])test(`quote ownership rejects different ${field}`,()=>{const p=payload();p.items[0].quoteToken=signer.issue('quote',{...quoted,[field]:value});assert.throws(()=>validateQuotedLines(saleIdentity(p,actor).business,actor,{canChangeSalePrice:true},signer),{code:'NATIVE_QUOTE_OWNER'});});
test('manual price requires existing personnel permission and audit',()=>{const p=payload();p.items[0].unitPrice='10.00';const {business}=saleIdentity(p,actor);assert.throws(()=>validateQuotedLines(business,actor,{canChangeSalePrice:false},signer),{code:'NATIVE_PRICE_PERMISSION'});assert.throws(()=>validateQuotedLines(business,actor,{canChangeSalePrice:true},signer),{code:'NATIVE_PRICE_AUDIT_REQUIRED'});p.changes=[{id:'one',field:'price',productId:20,oldValue:'12.80',newValue:'10.00',actorId:3,at:new Date().toISOString()}];assert.equal(validateQuotedLines(saleIdentity(p,actor).business,actor,{canChangeSalePrice:true},signer).items[0].unitPrice,10);});
test('frozen payload has stable digest and changed content conflicts',()=>{const p=payload(),first=saleIdentity(p,actor);assert.equal(first.digest,saleIdentity(JSON.parse(JSON.stringify(p)),actor).digest);p.items[0].quantity=2;assert.notEqual(first.digest,saleIdentity(p,actor).digest);});
test('approval expires while quote remains a durable price snapshot',()=>{let now=1000;const c=tokenCodec(randomBytes(32).toString('hex'),()=>now),q=c.issue('quote',quoted),approval=c.issue('discount',{id:1},300000);now+=400000;assert.deepEqual(c.verify(q,'quote'),quoted);assert.throws(()=>c.verify(approval,'discount'),{code:'NATIVE_SNAPSHOT_EXPIRED'});});
test('invalid discounts, quantity, duplicate products and impersonated audit rejected',()=>{for(const discount of ['-1','100','NaN','1e2']){const p=payload();p.discountRate=discount;assert.throws(()=>saleIdentity(p,actor));}const p=payload();p.items.push(p.items[0]);assert.throws(()=>saleIdentity(p,actor),{code:'NATIVE_QUANTITY_INVALID'});p.items.pop();p.changes=[{id:'one',field:'price',productId:20,oldValue:'12.80',newValue:'10',actorId:4,at:new Date().toISOString()}];assert.throws(()=>saleIdentity(p,actor),{code:'NATIVE_AUDIT_OWNER'});});
