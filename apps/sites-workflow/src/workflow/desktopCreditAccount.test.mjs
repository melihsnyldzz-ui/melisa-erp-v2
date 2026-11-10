import test from 'node:test';import assert from 'node:assert/strict';import {mountDesktopCreditAccount} from './desktopCreditAccount.mjs';
const tick=()=>new Promise(r=>setImmediate(r));function root(){let html='',nodes={};return{get innerHTML(){return html},set innerHTML(v){html=v;nodes={};for(const m of v.matchAll(/data-credit-(account|limit|reason|save|term-reason|term-save|term|retry|resolve)/g))nodes['[data-credit-'+m[1]+']']={value:'',events:{},addEventListener(k,f){this.events[k]=f}};},querySelector:s=>nodes[s]??null};}
const customer={id:'2',accounts:[{id:'7',currency:'USD'}]},account={customerId:'2',accountId:'7',currency:'USD',definition:null,termsDefinition:null,canManage:true,vadeStatus:'unknown',balanceExact8:'0.00000000'};
test('unknown terms stay unknown and explicit zero-day term is saved without inventing a default',async()=>{const el=root(),calls=[];let current=account;const credit={pending:()=>null,readAccount:async()=>current,savePolicy:async()=>{},saveTerms:async b=>{calls.push(b);current={...account,vadeStatus:'defined',termsDefinition:{termDays:0,revision:'a'.repeat(64)}};return {state:'COMMITTED'};},retry:async()=>{},resolve:async()=>{}};const view=mountDesktopCreditAccount({root:el,customer,credit});await tick();assert.match(el.innerHTML,/Vade tanımı henüz yok/);assert.doesNotMatch(el.innerHTML,/Vade: 30/);assert.ok(el.innerHTML.includes('Kalan limit (limit - bakiye): Tanımlı değil'));assert.ok(!el.innerHTML.includes('Kalan limit (limit - bakiye): 0.00000000'));el.querySelector('[data-credit-term]').value='0';el.querySelector('[data-credit-term-reason]').value='Peşin anlaşma';el.querySelector('[data-credit-term-save]').events.click();await tick();assert.equal(calls[0].termDays,0);assert.equal(calls[0].expectedRevision,null);assert.match(el.innerHTML,/Vade: 0 gün/);view.dispose();});
test('actor without management authority sees terms and remaining limit without edit controls',async()=>{const el=root(),credit={pending:()=>null,readAccount:async()=>({...account,canManage:false,definition:{limitExact8:'10.00000000',revision:'b'.repeat(64)},balanceExact8:'24.00000000',vadeStatus:'defined',termsDefinition:{termDays:30,revision:'a'.repeat(64)}}),savePolicy:async()=>{},saveTerms:async()=>{},retry:async()=>{},resolve:async()=>{}};const view=mountDesktopCreditAccount({root:el,customer,credit});await tick();assert.match(el.innerHTML,/Vade: 30 gün/);assert.ok(el.innerHTML.includes('Kalan limit (limit - bakiye): -14.00000000 USD'));assert.equal(el.querySelector('[data-credit-term-save]'),null);assert.equal(el.querySelector('[data-credit-save]'),null);view.dispose();});

test('remaining limit display uses exact signed eight-decimal arithmetic in each account currency without writes',async()=>{
 const cases=[
  ['TRY','10.00000000','24.00000000','-14.00000000'],
  ['USD','10.00000000','-24.00000000','34.00000000'],
  ['EUR','10.00000000','10.00000000','0.00000000'],
  ['TRY','9007199254740992.00000001','9007199254740992.00000000','0.00000001'],
  ['USD','99999999999999999999.99999999','-99999999999999999999.99999999','199999999999999999999.99999998'],
  ['EUR','0.00000001','0.00000002','-0.00000001'],
 ];
 for(const [currency,limitExact8,balanceExact8,expected]of cases){
  const el=root();let writes=0;const write=async()=>{writes++;throw Error('UNEXPECTED_WRITE');};
  const credit={pending:()=>null,readAccount:async()=>({...account,currency,definition:{limitExact8,revision:'a'.repeat(64)},balanceExact8}),savePolicy:write,saveTerms:write,retry:write,resolve:write};
  const view=mountDesktopCreditAccount({root:el,customer:{...customer,accounts:[{id:'7',currency}]},credit});await tick();
  assert.ok(el.innerHTML.includes('Kalan limit (limit - bakiye): '+expected+' '+currency),currency+' '+expected);
  assert.ok(!el.innerHTML.includes('-0.00000000'));assert.equal(writes,0);view.dispose();
 }
});

test('account switch clears the previous remaining limit while loading and after a failed read',async()=>{
 const el=root();let rejectRead,writes=0;const write=async()=>{writes++;throw Error('UNEXPECTED_WRITE');};
 const credit={pending:()=>null,readAccount:async(_customer,id)=>id==='7'?{...account,definition:{limitExact8:'10.00000000',revision:'a'.repeat(64)},balanceExact8:'24.00000000'}:new Promise((_resolve,reject)=>{rejectRead=reject;}),savePolicy:write,saveTerms:write,retry:write,resolve:write};
 const view=mountDesktopCreditAccount({root:el,customer:{...customer,accounts:[...customer.accounts,{id:'8',currency:'EUR'}]},credit});await tick();
 assert.ok(el.innerHTML.includes('Kalan limit (limit - bakiye): -14.00000000 USD'));
 el.querySelector('[data-credit-account]').events.change({target:{value:'8'}});
 assert.match(el.innerHTML,/Limit okunuyor/);assert.ok(!el.innerHTML.includes('Kalan limit (limit - bakiye):'));
 rejectRead(Error('READ_FAILED'));await tick();assert.match(el.innerHTML,/Limit okunamadı/);
 assert.ok(!el.innerHTML.includes('Kalan limit (limit - bakiye):'));assert.equal(writes,0);view.dispose();
});
