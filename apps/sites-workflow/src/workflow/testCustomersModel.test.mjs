import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {exactBalance,balanceDirection,accountConfidence,validateCustomerCard,customerListEnvelope,customerListPath,customerRequestGate} from './testCustomersModel.mjs';
const account=()=>({accountId:'3',currency:'USD',balanceExact:'-5395.21956522',nativeBalanceExact:'-5395.21956522',sourceOpeningBalanceExact:'-5.00000000',confidence:'source-matched',sourceStatus:'SOURCE',reconciled:true,sourceAsOf:'2026-09-30'});
const card=()=>({id:'155',customerCode:'SYNTHETIC',customerName:'Sentetik müşteri',isPassive:false,quarantine:{blocked:false,reasons:[]},source:{status:'accepted-opening',sourceAsOf:'2026-09-30',freshLive:false},accounts:[account()],accountCount:1,hasUnknownAccounts:false,fields:{phoneMasked:null,city:null,country:null,note:null}});
test('exact signed balances preserve eight places and large values without numeric conversion',()=>{assert.equal(exactBalance('-99999999999999999999.12345678'),'-99.999.999.999.999.999.999,12345678');assert.equal(balanceDirection('-0.00000000'),'Borç / alacak yok');assert.equal(balanceDirection('0.00000001'),'Müşterinin borcu');assert.equal(balanceDirection('-0.00000001'),'Müşterinin alacağı');assert.equal(exactBalance(null),'Bilinmiyor');assert.equal(balanceDirection(null),'Bilinmiyor');for(const x of [undefined,'',0,NaN,'1e8',' 1.0'])assert.throws(()=>exactBalance(x));});
test('unmatched native and unknown currency never become verified balances',()=>{const c=card(),a=c.accounts[0];Object.assign(a,{balanceExact:null,currency:null,reconciled:null,confidence:'native-unverified'});assert.equal(validateCustomerCard(c,{detail:true}),c);assert.equal(accountConfidence(a),'Kayıtlı hesap · Doğrulanmadı');a.balanceExact='0.00000000';assert.throws(()=>validateCustomerCard(c));});
test('source matching alone does not prove current balance and quarantine cannot expose verified totals',()=>{const c=card();c.accounts[0].reconciled=false;c.accounts[0].balanceExact=null;assert.match(accountConfidence(c.accounts[0]),/Güncel bakiye doğrulanmadı/);validateCustomerCard(c);c.accounts[0].balanceExact='1.00000000';assert.throws(()=>validateCustomerCard(c));c.accounts[0].reconciled=true;c.quarantine.blocked=true;assert.throws(()=>validateCustomerCard(c));});
test('native-only cards with no accounts retain unknown nullable contact fields',()=>{const c=card();c.accounts=[];c.accountCount=0;c.source.status='unmapped';c.hasUnknownAccounts=true;assert.equal(validateCustomerCard(c,{detail:true}).fields.note,null);delete c.fields.note;assert.throws(()=>validateCustomerCard(c,{detail:true}));});
test('list contract rejects live/incorrect cutoff, duplicates and missing confidence fields',()=>{const p={success:true,data:[card()],meta:{total:1,page:1,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}};customerListEnvelope(p);for(const m of [{freshLive:true},{sourceAsOf:'2026-10-04'},{readOnly:false}])assert.throws(()=>customerListEnvelope({...p,meta:{...p.meta,...m}}));assert.throws(()=>customerListEnvelope({...p,data:[card(),card()]}));delete p.data[0].accounts[0].reconciled;assert.throws(()=>customerListEnvelope(p));});
test('search builds only readonly frozen paths and validates pagination/filter values',()=>{const url=new URL(customerListPath({search:'A&B / müşteri',page:2,status:'passive',quarantine:'included'}),'http://test');assert.equal(url.pathname,'/api/customer-cards');assert.equal(url.searchParams.get('search'),'A&B / müşteri');assert.equal(url.searchParams.get('limit'),'25');assert.equal(url.searchParams.get('page'),'2');for(const args of [{page:0},{status:'all;DELETE'},{quarantine:'unknown'},{search:'x'.repeat(121)}])assert.throws(()=>customerListPath(args));});
test('late search/card replies and disposed page cannot overwrite newer selection',()=>{const list=customerRequestGate(),detail=customerRequestGate(),first=list.next(),oldCard=detail.next();assert.equal(list.current(first),true);const next=list.next();detail.next();assert.equal(list.current(first),false);assert.equal(detail.current(oldCard),false);assert.equal(list.current(next),true);list.dispose();detail.dispose();assert.equal(list.current(next),false);assert.equal(list.current(list.next()),false);});

async function controller(document){
 const context=vm.createContext({document,URLSearchParams,FormData:class{get(k){return {search:'',status:'all',quarantine:'all'}[k];}}});
 const module=new vm.SourceTextModule(await readFile(new URL('./testCustomers.js',import.meta.url),'utf8'),{context});
 await module.link(async name=>{if(name.endsWith('.css'))return new vm.SyntheticModule([],()=>{},{context});return new vm.SourceTextModule(await readFile(new URL(name,import.meta.url),'utf8'),{context});});
 await module.evaluate();return module.namespace.testCustomers;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('permission denied controller performs no request and shows denied state without touching DOM',async()=>{let requests=0;const create=await controller({getElementById(){throw Error('Denied view touched DOM');}}),ui=create({api:()=>{requests++;},esc:String,permissions:['sales.view']});assert.match(ui.html(),/görüntüleme yetkiniz yok/);ui.bind();assert.equal(requests,0);ui.dispose();});
test('controller suppresses out-of-order API search responses and responses after disposal',async()=>{
 const nodes=Object.fromEntries(['customer-filter','customer-results','customer-detail','customer-summary','customer-prev','customer-next'].map(key=>[key,{textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[],querySelector:()=>null}]));
 const host={isConnected:true,querySelector:key=>nodes[key.slice(1)]},create=await controller({getElementById:()=>host}),calls=[];
 const ui=create({api:path=>new Promise(resolve=>calls.push({path,resolve})),esc:String,permissions:['customer.view']});ui.bind();
 nodes['customer-filter'].onsubmit({preventDefault(){}});assert.equal(calls.length,2);
 const envelope=name=>({success:true,data:[{...card(),customerName:name}],meta:{total:1,page:1,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}});
 calls[1].resolve(envelope('Yeni seçim'));await tick();assert.match(nodes['customer-results'].innerHTML,/Yeni seçim/);
 calls[0].resolve(envelope('Eski seçim'));await tick();assert.doesNotMatch(nodes['customer-results'].innerHTML,/Eski seçim/);
 nodes['customer-filter'].onsubmit({preventDefault(){}});ui.dispose();calls[2].resolve(envelope('Geç cevap'));await tick();assert.doesNotMatch(nodes['customer-results'].innerHTML,/Geç cevap/);
});
test('stale card failure cannot bind its retry to a newer selection error',async()=>{
 const bindings=[],button={dataset:{customerOpen:'155'}},retry={addEventListener:(_event,handler)=>bindings.push(handler)};
 const nodes=Object.fromEntries(['customer-filter','customer-results','customer-detail','customer-summary','customer-prev','customer-next'].map(key=>[key,{textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[],querySelector:()=>null}]));
 nodes['customer-results'].querySelectorAll=()=>[button];nodes['customer-detail'].querySelector=()=>retry;
 const host={isConnected:true,querySelector:key=>nodes[key.slice(1)]},create=await controller({getElementById:()=>host}),calls=[];
 const ui=create({api:path=>new Promise((resolve,reject)=>calls.push({path,resolve,reject})),esc:String,permissions:['customer.view']});ui.bind();
 calls[0].resolve({success:true,data:[card()],meta:{total:1,page:1,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}});await tick();
 button.onclick();button.dataset.customerOpen='156';button.onclick();
 calls[2].reject(Error('Yeni kart hatası'));await tick();assert.equal(bindings.length,1);assert.match(nodes['customer-detail'].innerHTML,/Yeni kart hatası/);
 calls[1].reject(Error('Eski kart hatası'));await tick();assert.equal(bindings.length,1);assert.doesNotMatch(nodes['customer-detail'].innerHTML,/Eski kart hatası/);
 bindings[0]();assert.equal(calls[3].path,'/api/customers/156/card');ui.dispose();calls[3].reject(Error('Kapalı kart'));await tick();assert.equal(bindings.length,1);
});
