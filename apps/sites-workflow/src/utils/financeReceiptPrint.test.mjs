import {test} from 'node:test';
import assert from 'node:assert/strict';
import {printFinanceReceipt} from './exportUtils.js';
function capture(receipt){
 const prior=globalThis.document,frames=[];
 globalThis.document={createElement:()=>({style:{}}),body:{appendChild:frame=>frames.push(frame)}};
 try{printFinanceReceipt(receipt);assert.equal(frames.length,1);return frames[0].srcdoc;}
 finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
}
test('actual receipt HTML preserves exact source before display rounding, null and currency boundaries',()=>{
 const receipt={amount:'12345678901234.1250',balanceEffect:'-12345678901234.1250',currency:'USD'};
 const saved=structuredClone(receipt),html=capture(receipt);
 assert.ok(html.includes('$12.345.678.901.234,13'));assert.ok(html.includes('-$12.345.678.901.234,13'));assert.deepEqual(receipt,saved);
 const unknown=capture({amount:null,balanceEffect:null,currency:null});assert.ok(unknown.includes('Doğrulanmadı'));assert.equal(unknown.includes('₺0,00'),false);
 assert.ok(capture({amount:'0',balanceEffect:'0',currency:'TRY'}).includes('₺0,00'));
 assert.ok(capture({amount:9007199254740992,currency:'USD'}).includes('Doğrulanmadı'));
 const escaped=capture({amount:'1',currency:'<img src=x onerror=bad>'});
 assert.equal(escaped.includes('<img src=x'),false);assert.ok(escaped.includes('&lt;img'));
});

