import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopFinanceController} from './desktopFinanceController.mjs';
import {mountDesktopFinance} from './desktopFinanceView.mjs';

const uuid='12345678-1234-4234-8234-123456789abc';
const nextUuid='22345678-1234-4234-8234-123456789abc';
const body={requestId:uuid,partyId:'8',partyAccountId:'9',financeAccountId:'10',invoiceId:null,amountExact4:'20.5000',documentDate:'2026-11-07',currency:'TRY',description:'Synthetic consent regression'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function surface(){let html='',elements={};const element=()=>({handlers:{},addEventListener(n,fn){this.handlers[n]=fn;}});return {isConnected:true,set innerHTML(v){html=v;elements={'[data-retry]':element(),'[data-confirm]':element(),'[data-cancel-confirm]':element(),form:{elements:Object.fromEntries(['party','cash','amount','date','note'].map(n=>[n,element()]))}};this.buttons=['collection','payment'].map(op=>({dataset:{op}}));},get innerHTML(){return html;},querySelector(s){return elements[s]??null;},querySelectorAll(){return this.buttons;},replaceChildren(){html='';}};}
function fixture(operation='payment',{pending=true,transport,locks}={}){
 let saved=pending?JSON.stringify({actorId:'7',operation,body}):null,posts=0,ids=0;
 const sent=[],storage={getItem:()=>saved,setItem:(_k,v)=>{saved=v;},removeItem:()=>{saved=null;}};
 const core=createDesktopFinanceController({actorId:'7',storage,locks:locks??{request:(_k,_o,fn)=>fn({})},newId:()=>{ids++;return uuid;},transport:async(op,b)=>{posts++;sent.push(JSON.stringify({op,body:b}));if(transport)return transport(op,b);return {state:'UNKNOWN'};}});
 const controller={...core,can:()=>true,options:async()=>({parties:[{id:'8',accountId:'9',code:'S01',name:'Synthetic party'}],cash:[{id:'10',name:'Synthetic cash'}],hasNext:false}),list:async()=>({data:[],hasNext:false})};
 return {core,controller,sent,get saved(){return saved;},set saved(v){saved=v;},get posts(){return posts;},get ids(){return ids;}};
}

test('retry is visibly a resend and cancellation keeps the exact pending request without transport',async()=>{
 for(const op of ['payment','collection']){const f=fixture(op),root=surface(),before=f.saved;
  mountDesktopFinance({root,controller:f.controller});await tick();
  assert.match(root.innerHTML,/Aynı işlemi yeniden gönder/);assert.doesNotMatch(root.innerHTML,/İşlemi tekrar kontrol et/);assert.match(root.innerHTML,/kasa ve cari hareketi oluşturabilir/);
  await root.querySelector('[data-retry]').handlers.click();assert.equal(f.posts,0);assert.equal(f.ids,0);assert.equal(f.saved,before);
  assert.match(root.innerHTML,/cari #8, kasa #10, 20\.5000 TRY, 2026-11-07/);assert.match(root.innerHTML,/Henüz kaydedilmediyse yeni hareket oluşur/);assert.match(root.innerHTML,op==='payment'?/tedarikçi ödemesini.*Kasa azalabilir/:/tahsilatı.*Kasa artabilir/);
  root.querySelector('[data-cancel-confirm]').handlers.click();assert.equal(f.posts,0);assert.equal(f.saved,before);assert.doesNotMatch(root.innerHTML,/role="alertdialog"/);
 }
});

test('cancel of the original form creates no UUID, journal or retryable request',async()=>{
 const f=fixture('payment',{pending:false}),root=surface();mountDesktopFinance({root,controller:f.controller});await tick();root.buttons[1].onclick();await tick();
 const form=root.querySelector('form');for(const [name,value] of Object.entries({party:'8',cash:'10',amount:'20,5',date:'2026-11-07'}))form.elements[name].handlers.input({target:{value}});
 await form.onsubmit({preventDefault(){}});root.querySelector('[data-cancel-confirm]').handlers.click();assert.equal(f.ids,0);assert.equal(f.posts,0);assert.equal(f.saved,null);assert.doesNotMatch(root.innerHTML,/data-retry/);
});

test('confirmation cannot authorize changed pending UUID or body, logout, or revoked permission',async()=>{
 for(const change of ['uuid','body','logout','permission']){const f=fixture(),root=surface();let allowed=true;f.controller.can=()=>allowed;
  mountDesktopFinance({root,controller:f.controller});await tick();root.querySelector('[data-retry]').handlers.click();if(change==='uuid'||change==='body'){const p=JSON.parse(f.saved);if(change==='uuid')p.body.requestId=nextUuid;else p.body.amountExact4='21.0000';f.saved=JSON.stringify(p);}else if(change==='logout')root.isConnected=false;else allowed=false;
  await root.querySelector('[data-confirm]').handlers.click();assert.equal(f.posts,0,change);
 }
});

test('controller requires the full consent pin and checks it after the Web Lock is acquired',async()=>{
 for(const change of ['actor','operation','uuid','body']){let f;const locks={request:(_k,_o,fn)=>{const p=JSON.parse(f.saved);if(change==='actor')p.actorId='9';if(change==='operation')p.operation='collection';if(change==='uuid')p.body.requestId=nextUuid;if(change==='body')p.body.description='Changed after consent';f.saved=JSON.stringify(p);return fn({});}};f=fixture('payment',{locks});
  assert.throws(()=>f.core.retry());const expected=f.core.pending();await assert.rejects(f.core.retry(expected));assert.equal(f.posts,0,change);assert.notEqual(f.saved,null);
 }
});

test('approved resend preserves one UUID/body, rejects a fast second click, and retains unknown state',async()=>{
 let finish;const f=fixture('payment',{transport:()=>new Promise(resolve=>{finish=resolve;})}),root=surface(),before=f.saved;
 mountDesktopFinance({root,controller:f.controller});await tick();const start=root.querySelector('[data-retry]').handlers.click;start();start();assert.equal(f.posts,0);const click=root.querySelector('[data-confirm]').handlers.click;
 const first=click(),second=click();assert.equal(f.posts,1);assert.equal(f.ids,0);finish({state:'UNKNOWN'});await Promise.all([first,second]);assert.equal(f.saved,before);assert.equal(f.sent[0],JSON.stringify({op:'payment',body}));
});

test('approved matching replay clears only its matching pending request',async()=>{
 const f=fixture('payment',{transport:async(op,b)=>({state:'COMMITTED',requestId:b.requestId,operation:op,replayed:true,movementId:'11',receipt:{movementId:'11',partyId:b.partyId,partyAccountId:b.partyAccountId,financeAccountId:b.financeAccountId,invoiceId:b.invoiceId,amountExact4:b.amountExact4,documentDate:b.documentDate,currency:'TRY'}})}),root=surface();
 mountDesktopFinance({root,controller:f.controller});await tick();root.querySelector('[data-retry]').handlers.click();await root.querySelector('[data-confirm]').handlers.click();assert.equal(f.posts,1);assert.equal(f.saved,null);assert.match(root.innerHTML,/Önceki işlem doğrulandı/);
});

test('cancelled confirmation callbacks cannot approve a later pending request',async()=>{
 const f=fixture(),root=surface();mountDesktopFinance({root,controller:f.controller});await tick();root.querySelector('[data-retry]').handlers.click();const staleConfirm=root.querySelector('[data-confirm]').handlers.click,staleCancel=root.querySelector('[data-cancel-confirm]').handlers.click;
 staleCancel();const changed=JSON.parse(f.saved);changed.body.requestId=nextUuid;f.saved=JSON.stringify(changed);
 root.buttons[1].onclick();await tick();root.querySelector('[data-retry]').handlers.click();assert.match(root.innerHTML,/role="alertdialog"/);
 await staleConfirm();staleCancel();assert.equal(f.posts,0);assert.match(root.innerHTML,/role="alertdialog"/);assert.equal(f.core.pending().body.requestId,nextUuid);
});
