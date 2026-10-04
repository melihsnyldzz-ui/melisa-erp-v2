import test from 'node:test';import assert from 'node:assert/strict';
import {exactAmount,acceptedPriceEnvelope} from './testPrices.js';
test('exact decimals retain precision, zero and unknown independently',()=>{
 assert.equal(exactAmount('12345678901234567890.12345678'),'12.345.678.901.234.567.890,12345678');
 assert.equal(exactAmount('0.00000000'),'0,00000000');assert.equal(exactAmount(null),'Bilinmiyor');assert.throws(()=>exactAmount(1));
});
test('stale scalar or unaccepted source envelope cannot render',()=>{
 const p={success:true,data:[],meta:{readOnly:true,sourceFreshLive:false,cutoverAccepted:false,runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a'}};
 assert.equal(acceptedPriceEnvelope(p),p);assert.throws(()=>acceptedPriceEnvelope({...p,meta:{...p.meta,runId:'other'}}));assert.throws(()=>acceptedPriceEnvelope({data:{items:[]}}));assert.throws(()=>acceptedPriceEnvelope({...p,meta:{...p.meta,sourceFreshLive:true}}));
});
