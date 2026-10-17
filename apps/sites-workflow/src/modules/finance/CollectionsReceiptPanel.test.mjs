import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import * as money from './cashReadMoney.js';
const {transformSync}=createRequire(import.meta.url)('esbuild');
const text=n=>n==null?'':Array.isArray(n)?n.map(text).join(' '):typeof n==='object'?text(n.props?.children):String(n);
test('actual receipt panel preserves exact display, missing/zero and source response without form fallback',()=>{
 const module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./CollectionsReceiptPanel.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,
  {module,exports:module.exports,require:s=>s==='react'?{createElement:(type,props,...children)=>({type,props:{...props,children}})}:s.includes('cashReadMoney')?money:{partyLabel:v=>v}});
 const render=selectedReceipt=>text(module.exports.CollectionsReceiptPanel({selectedReceipt}));
 assert.match(render({amount:'12345678901234.1250',balanceEffect:'0',currency:'USD'}),/12\.345\.678\.901\.234,13/);
 assert.match(render({amount:null,balanceEffect:null,currency:null}),/Doğrulanmadı/);
 assert.match(render({amount:'0',balanceEffect:'0',currency:'TRY'}),/₺0,00/);
 const source=readFileSync(new URL('./CollectionsOverviewScreen.jsx',import.meta.url),'utf8');
 const start=source.indexOf('  function buildReceiptFromResponse('),end=source.indexOf('  function selectReceipt(',start);assert.ok(start>=0&&end>start);
 const build=new Function('form','amount','partyCode','partyName','paymentMethodLabel','accountReceiptLabel',source.slice(start,end)+'return buildReceiptFromResponse;')(
  {amount:'999',currency:'TRY'},999,()=>'',()=>'',v=>v,()=>'-');
 const missing=build({}, {},'payment');assert.equal(missing.amount,null);assert.equal(missing.balanceEffect,null);assert.equal(missing.currency,null);
 const zero=build({amount:'0',balanceEffect:'0',currency:'EUR'}, {},'payment');assert.equal(zero.amount,'0');assert.equal(zero.balanceEffect,'0');
});

