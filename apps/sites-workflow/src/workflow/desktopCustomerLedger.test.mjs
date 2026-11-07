import test from 'node:test';
import assert from 'node:assert/strict';
import {isDesktopCustomerLedgerView,mountDesktopCustomerLedger} from './desktopCustomerLedger.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const customer={id:'2',currency:'TRY',accounts:[{id:'2',currency:'TRY'},{id:'7',currency:'USD'}]};
function root(){let html='',nodes=[];return {get innerHTML(){return html;},set innerHTML(v){html=v;nodes=[...v.matchAll(/<(button|input|select|p|span|div)\b[^>]*>/g)].map(m=>{const attrs=Object.fromEntries([...m[0].matchAll(/([a-zA-Z][\w-]*)(?:="([^"]*)")?/g)].map(a=>[a[1],a[2]??'']));return {attrs,dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_m,c)=>c.toUpperCase()),v])),events:{},disabled:Object.hasOwn(attrs,'disabled'),addEventListener(k,fn){this.events[k]=fn;}};});},querySelectorAll(s){const m=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(s);return m?nodes.filter(n=>Object.hasOwn(n.attrs,m[1])&&(m[2]===undefined||n.attrs[m[1]]===m[2])):[];},querySelector(s){return this.querySelectorAll(s)[0]??null;}};}
const movement=(id='20')=>({id,documentDate:'2026-11-05',movementType:'SALE',invoiceId:'8',documentNo:'F-8',documentCurrency:'EUR',documentAmountExact4:'-10.1250',accountCurrency:'TRY',accountAmountExact4:'-12.2500',balanceEffectExact8:'-12.25000001'});
const result=(accountId='2',currency='TRY',page=1)=>({customerId:'2',accountId,currency,balanceExact8:'-9.50000000',page,hasNext:false,hasUnassignedMovements:false,rows:[]});
test('signed document/account amounts remain distinct, unassigned warning is explicit and only permitted invoice opens',async()=>{
 const el=root(),opened=[],value={...result(),hasUnassignedMovements:true,rows:[{...movement(),movementType:'sales_invoice',documentNo:'<F-8>'},{...movement('19'),movementType:'sales_invoice_cancel',invoiceId:null,documentNo:null}]};
 const view=mountDesktopCustomerLedger({root:el,customer,load:async()=>value,onOpenInvoice:id=>opened.push(id),canOpenInvoice:true});await tick();
 assert.match(el.innerHTML,/Güncel hesap bakiyesi: -9\.50000000 TRY/);assert.match(el.innerHTML,/-10\.1250 EUR/);assert.match(el.innerHTML,/-12\.2500 TRY/);assert.match(el.innerHTML,/-12\.25000001 TRY/);assert.match(el.innerHTML,/hesaba bağlanmamış eski hareketler var/);assert.match(el.innerHTML,/Satış iptali/);assert.doesNotMatch(el.innerHTML,/sales_invoice/);assert.match(el.innerHTML,/&lt;F-8&gt;/);assert.doesNotMatch(el.innerHTML,/<F-8>/);assert.equal(el.querySelectorAll('[data-ledger-invoice]').length,1);el.querySelector('[data-ledger-invoice="8"]').events.click();assert.deepEqual(opened,['8']);view.dispose();
});
test('account changes reset the page and prevent late replies or stale invoice actions',async()=>{
 const el=root(),pending=[],opened=[],view=mountDesktopCustomerLedger({root:el,customer,load:(...args)=>new Promise(resolve=>pending.push({args,resolve})),onOpenInvoice:id=>opened.push(id),canOpenInvoice:true});
 assert.deepEqual(pending[0].args,['2','2',1,'TRY']);el.querySelector('[data-ledger-account]').events.change({target:{value:'7'}});assert.deepEqual(pending[1].args,['2','7',1,'USD']);
 pending[0].resolve({...result(),rows:[movement()]});await tick();assert.doesNotMatch(el.innerHTML,/F-8/);
 pending[1].resolve({...result('7','USD'),balanceExact8:'3.25000000'});await tick();assert.match(el.innerHTML,/3\.25000000 USD/);assert.match(el.innerHTML,/Bu hesapta kayıtlı hareket yok/);const before=el.innerHTML;view.dispose();assert.equal(el.innerHTML,before);
});
test('next page keeps selected account; failures do not impersonate empty data',async()=>{
 const el=root(),calls=[],pending=[],first={...result(),hasNext:true,rows:Array.from({length:10},(_,i)=>movement(String(30-i)))};
 const view=mountDesktopCustomerLedger({root:el,customer,load:(...args)=>{calls.push(args);if(calls.length===1)return Promise.resolve(first);return new Promise((resolve,reject)=>pending.push({resolve,reject}));},canOpenInvoice:true});await tick();
 const stale=el.querySelector('[data-ledger-invoice="8"]');el.querySelector('[data-ledger-next]').events.click();assert.deepEqual(calls[1],['2','2',2,'TRY']);assert.equal(el.querySelectorAll('[data-ledger-invoice]').length,0);stale.events.click();
 pending[0].reject(Error('offline'));await tick();assert.match(el.innerHTML,/ekstresi okunamadı/);assert.doesNotMatch(el.innerHTML,/kayıtlı hareket yok/);assert.doesNotMatch(el.innerHTML,/Güncel hesap bakiyesi/);view.dispose();
});
test('foreign identity, invalid exact values, date, order and malformed invoice are rejected',()=>{
 const base={...result(),rows:[movement()]},scope={customerId:'2',accountId:'2',page:1,currency:'TRY'};assert.equal(isDesktopCustomerLedgerView(base,scope),true);
 for(const bad of [{...base,customerId:'3'},{...base,accountId:'7'},{...base,currency:'USD'},{...base,page:2},{...base,hasUnassignedMovements:null},{...base,hasNext:true},{...base,balanceExact8:0},{...base,rows:[{...movement(),documentDate:'2026-02-30'}]},{...base,rows:[{...movement(),balanceEffectExact8:'1,00000000'}]},{...base,rows:[{...movement(),balanceEffectExact8:'-12.2500'}]},{...base,rows:[{...movement(),balanceEffectExact8:'-0.00000000'}]},{...base,rows:[{...movement(),invoiceId:null}]},{...base,rows:[movement('20'),movement('21')]}])assert.equal(isDesktopCustomerLedgerView(bad,scope),false);
});
test('empty account list does not load and invoice action requires explicit permission',async()=>{
 const el=root();let calls=0;const empty=mountDesktopCustomerLedger({root:el,customer:{...customer,accounts:[]},load:async()=>{calls++;}});assert.match(el.innerHTML,/bağlı döviz hesabı yok/);assert.equal(calls,0);empty.dispose();
 const denied=root(),view=mountDesktopCustomerLedger({root:denied,customer,load:async()=>({...result(),rows:[movement()]})});await tick();assert.equal(denied.querySelectorAll('[data-ledger-invoice]').length,0);view.dispose();
});

test('rejected scoped ledger refresh removes previously rendered invoice and cannot reopen it',async()=>{const el=root(),opened=[];let deny=false;const value={...result(),rows:[movement()]},view=mountDesktopCustomerLedger({root:el,customer,load:async()=>{if(deny)throw Error('forbidden');return value;},onOpenInvoice:id=>opened.push(id),canOpenInvoice:true});await tick();assert.match(el.innerHTML,/F-8/);const old=el.querySelector('[data-ledger-invoice="8"]');deny=true;el.querySelector('[data-ledger-refresh]').events.click();assert.doesNotMatch(el.innerHTML,/F-8/);old.events.click();await tick();assert.deepEqual(opened,[]);assert.match(el.innerHTML,/okunamadı/);view.dispose();});
