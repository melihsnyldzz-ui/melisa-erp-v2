import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyStage5TestOrderWitness,reviewStage5CancelledClosure} from './stage5-origin-review.mjs';
import {buildCrmV2Procedures,buildCrmV2Guards} from './crm-order-v2-sql.mjs';
import {crmV2Fingerprint} from '../../apps/api/src/services/crmOrderV2Contract.mjs';
const sha=(v,encoding='utf8')=>createHash('sha256').update(v,encoding).digest('hex');
const wrap=value=>{const json=JSON.stringify(value);return {json,rowHash:sha(json,'utf16le')};};
function witness(){
 const requestId='1b66bb6e-23c5-4ba3-9afe-accbb99ad100',body={requestId,conversationId:'99',peer:'9050000017733',customerId:10,customerMatch:{basis:'exact-phone',phone:'9050000017733',revision:'a'.repeat(64),reason:null},documentCurrency:'TRY',exchangeRateExact8:'1.00000000',items:[{productId:20,stockCode:'0010 SOURCE',quantity:2,priceId:30,unitSourceId:40,tier:1,currency:'TRY',priceExact8:'2.50000000',priceSourceKey:'fixture:price:30'}]};
 const header=wrap({id:7000,status:'draft',source_offer_id:null,customer_id:10,document_currency:'TRY',document_no:'CR2-'+requestId.toUpperCase().replaceAll('-','').slice(0,26),grand_total:5,amount_try:5,subtotal:5,discount_rate:0,discount_total:0});
 const item=wrap({id:8000,sales_order_id:7000,product_id:20,stock_code_snapshot:'0010 SOURCE',quantity:2,currency_code:'TRY',unit_price:2.5,line_total:5});
 return {identity:{server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'},modules:Object.entries({...buildCrmV2Procedures(),...buildCrmV2Guards()}).map(([name,body])=>({schemaName:'dbo',name,disabled:0,definitionSHA256:sha(body,'utf16le')})),request:wrap({request_id:requestId,order_id:7000,actor_id:15,crm_actor_id:'fixture-actor',body_json:JSON.stringify(body),payload_hash:crmV2Fingerprint(body,15,'fixture-actor'),header_hash:header.rowHash}),header,items:[item],links:[wrap({request_id:requestId,position:0,item_id:8000,native_hash:item.rowHash})]};
}
const rewrap=(w,changes)=>wrap({...JSON.parse(w.json),...changes});
test('exact guarded TEST order witness resolves origin without business effects',()=>{const r=verifyStage5TestOrderWitness(witness());assert.equal(r.classification,'SYNTHETIC_LOCAL');assert.equal(r.modulePins.length,8);assert.deepEqual([r.stockEffect,r.partyEffect,r.cashEffect,r.reservationEffect],[false,false,false,false]);});
for(const [name,mutate]of [
 ['foreign DB',w=>{w.identity.database='OTHER_TEST';}],
 ['disabled guard',w=>{w.modules[0].disabled=1;}],
 ['changed guard',w=>{w.modules[0].definitionSHA256='b'.repeat(64);} ],
 ['duplicate guard',w=>{w.modules.push(w.modules[0]);}],
 ['changed actor',w=>{w.request=rewrap(w.request,{actor_id:16});}],
 ['unsealed native row',w=>{w.header.json=w.header.json.replace('7000','7001');}],
 ['committed order',w=>{w.header=rewrap(w.header,{status:'finalized'});w.request=rewrap(w.request,{header_hash:w.header.rowHash});}],
 ['wrong request link',w=>{w.request=rewrap(w.request,{order_id:7001});}],
 ['missing item',w=>{w.items=[];}],
 ['wrong line owner',w=>{w.items[0]=rewrap(w.items[0],{sales_order_id:7001});w.links[0]=rewrap(w.links[0],{native_hash:w.items[0].rowHash});}],
 ['duplicate line position',w=>{w.links[0]=rewrap(w.links[0],{position:1});}],
 ['changed exact price',w=>{w.items[0]=rewrap(w.items[0],{unit_price:2.5001});w.links[0]=rewrap(w.links[0],{native_hash:w.items[0].rowHash});}],
 ['missing exact total',w=>{const h=JSON.parse(w.header.json);delete h.grand_total;w.header=wrap(h);w.request=rewrap(w.request,{header_hash:w.header.rowHash});}]
])test('order proof rejects '+name,()=>{const w=witness();mutate(w);assert.throws(()=>verifyStage5TestOrderWitness(w));});
function cancelled(dimension=['20','MERKEZ','ADET']){return {documentId:'7000',status:'cancelled',cancelledAt:'2026-01-01T00:00:00Z',expectedEffects:['stock/1','stock/2'],effects:[{key:'stock/1',documentId:'7000',rowHash:'a'.repeat(64),domain:'STOCK',dimension,effectExact:'1.00000001'},{key:'stock/2',documentId:'7000',rowHash:'b'.repeat(64),domain:'STOCK',dimension,effectExact:'-1.00000001'}]};}
test('cancelled exact8 closure keeps unresolved origin',()=>{const r=reviewStage5CancelledClosure(cancelled());assert.equal(r.status,'CLOSED_ZERO_EFFECT_ORIGIN_UNRESOLVED');assert.equal(r.origin,'UNKNOWN');assert.equal(r.rows[0].netExact,'0.00000000');});
test('null warehouse cannot be cured by zero net quantity',()=>{const r=reviewStage5CancelledClosure(cancelled(['20',null,'ADET']));assert.equal(r.status,'ZERO_NET_BUT_DIMENSION_UNRESOLVED');assert.equal(r.dimensionsVerified,false);});
test('incomplete stock dimension stays unresolved even with exact zero net',()=>{assert.equal(reviewStage5CancelledClosure(cancelled(['20'])).status,'ZERO_NET_BUT_DIMENSION_UNRESOLVED');assert.equal(reviewStage5CancelledClosure(cancelled([])).status,'ZERO_NET_BUT_DIMENSION_UNRESOLVED');});
test('party closure requires both account and currency',()=>{const c=cancelled(['20']);c.effects.forEach(e=>{e.domain='PARTY';});assert.equal(reviewStage5CancelledClosure(c).status,'ZERO_NET_BUT_DIMENSION_UNRESOLVED');});
test('different warehouses are never summed into a zero stock effect',()=>{const c=cancelled();c.effects[1].dimension=['20','SECOND','ADET'];assert.equal(reviewStage5CancelledClosure(c).status,'BLOCKED_NONZERO_EFFECT');});
test('one missing native cancellation side is rejected',()=>{const c=cancelled();c.effects.pop();assert.throws(()=>reviewStage5CancelledClosure(c));});
test('typed linkage and duplicate effects are checked',()=>{const c=cancelled();c.effects[1].key=c.effects[0].key;assert.throws(()=>reviewStage5CancelledClosure(c));c.effects[1].key='stock/2';c.effects[1].documentId='7001';assert.throws(()=>reviewStage5CancelledClosure(c));});
