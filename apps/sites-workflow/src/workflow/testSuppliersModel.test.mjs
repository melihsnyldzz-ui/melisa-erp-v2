import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {exactBalance,balanceDirection,accountConfidence,validateSupplierCard,supplierListEnvelope,supplierListPath,supplierRequestGate,supplierContactEligible,supplierContactContext,supplierContactRequest,supplierContactJournal,supplierContactCompletionMatches} from './testSuppliersModel.mjs';
const account=()=>({accountId:'3',currency:'USD',balanceExact:'-5395.21956522',nativeBalanceExact:'-5395.21956522',sourceOpeningBalanceExact:'-5.00000000',confidence:'source-matched',sourceStatus:'SOURCE',reconciled:true,sourceAsOf:'2026-09-30'});
const card=()=>({id:'155',supplierCode:'SYNTHETIC',supplierName:'Sentetik tedarikçi',isPassive:false,quarantine:{blocked:false,reasons:[]},source:{status:'accepted-opening',sourceAsOf:'2026-09-30',freshLive:false},accounts:[account()],accountCount:1,hasUnknownAccounts:false,fields:{phoneMasked:null,city:null,country:null}});
test('exact signed balances preserve eight places and large values without numeric conversion',()=>{assert.equal(exactBalance('-99999999999999999999.12345678'),'-99.999.999.999.999.999.999,12345678');assert.equal(balanceDirection('-0.00000000'),'Borç / alacak yok');assert.equal(balanceDirection('0.00000001'),'Melisa’nın tedarikçiye borcu');assert.equal(balanceDirection('-0.00000001'),'Melisa’nın tedarikçiden alacağı');assert.equal(exactBalance(null),'Bilinmiyor');assert.equal(balanceDirection(null),'Bilinmiyor');for(const x of [undefined,'',0,NaN,'1e8',' 1.0'])assert.throws(()=>exactBalance(x));});
test('unmatched native and unknown currency never become verified balances',()=>{const c=card(),a=c.accounts[0];Object.assign(a,{balanceExact:null,currency:null,reconciled:null,confidence:'native-unverified'});assert.equal(validateSupplierCard(c,{detail:true}),c);assert.equal(accountConfidence(a),'Kayıtlı hesap · Doğrulanmadı');a.balanceExact='0.00000000';assert.throws(()=>validateSupplierCard(c));});
test('source matching alone does not prove current balance and quarantine cannot expose verified totals',()=>{const c=card();c.accounts[0].reconciled=false;c.accounts[0].balanceExact=null;assert.match(accountConfidence(c.accounts[0]),/Güncel bakiye doğrulanmadı/);validateSupplierCard(c);c.accounts[0].balanceExact='1.00000000';assert.throws(()=>validateSupplierCard(c));c.accounts[0].reconciled=true;c.quarantine.blocked=true;assert.throws(()=>validateSupplierCard(c));});
test('native-only cards with no accounts retain unknown nullable contact fields',()=>{const c=card();c.accounts=[];c.accountCount=0;c.source.status='unmapped';c.hasUnknownAccounts=true;assert.equal(validateSupplierCard(c,{detail:true}).fields.city,null);delete c.fields.city;assert.throws(()=>validateSupplierCard(c,{detail:true}));});
test('list contract rejects live/incorrect cutoff, duplicates and missing confidence fields',()=>{const p={success:true,data:[card()],meta:{total:1,page:1,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}};supplierListEnvelope(p);for(const m of [{freshLive:true},{sourceAsOf:'2026-10-04'},{readOnly:false}])assert.throws(()=>supplierListEnvelope({...p,meta:{...p.meta,...m}}));assert.throws(()=>supplierListEnvelope({...p,data:[card(),card()]}));delete p.data[0].accounts[0].reconciled;assert.throws(()=>supplierListEnvelope(p));});
test('search builds only readonly frozen paths and validates pagination/filter values',()=>{const url=new URL(supplierListPath({search:'A&B / tedarikçi',page:2,status:'passive',quarantine:'included'}),'http://test');assert.equal(url.pathname,'/api/supplier-cards');assert.equal(url.searchParams.get('search'),'A&B / tedarikçi');assert.equal(url.searchParams.get('limit'),'25');assert.equal(url.searchParams.get('page'),'2');for(const args of [{page:0},{status:'all;DELETE'},{quarantine:'unknown'},{search:'x'.repeat(121)}])assert.throws(()=>supplierListPath(args));});
test('late search/card replies and disposed page cannot overwrite newer selection',()=>{const list=supplierRequestGate(),detail=supplierRequestGate(),first=list.next(),oldCard=detail.next();assert.equal(list.current(first),true);const next=list.next();detail.next();assert.equal(list.current(first),false);assert.equal(detail.current(oldCard),false);assert.equal(list.current(next),true);list.dispose();detail.dispose();assert.equal(list.current(next),false);assert.equal(list.current(list.next()),false);});

async function controller(document,name='testSuppliers'){
 const context=vm.createContext({document,URLSearchParams,FormData:class{get(k){return {search:'',status:'all',quarantine:'all'}[k];}}});
 const module=new vm.SourceTextModule(await readFile(new URL('./testSuppliers.js',import.meta.url),'utf8'),{context});
 await module.link(async name=>{if(name.endsWith('.css'))return new vm.SyntheticModule([],()=>{},{context});return new vm.SourceTextModule(await readFile(new URL(name,import.meta.url),'utf8'),{context});});
 await module.evaluate();return module.namespace[name];
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('supplier.edit, purchase.view and customer.view cannot substitute supplier.view or issue a card request',async()=>{let requests=0;const create=await controller({getElementById(){throw Error('Denied view touched DOM');}});for(const permissions of [[],['supplier.edit'],['purchase.view'],['customer.view'],['supplier.edit','purchase.view']]){const ui=create({api:()=>{requests++;},esc:String,permissions});assert.match(ui.html(),/görüntüleme yetkiniz yok/);ui.bind();ui.dispose();}assert.equal(requests,0);});
test('controller suppresses out-of-order API search responses and responses after disposal',async()=>{
 const nodes=Object.fromEntries(['supplier-filter','supplier-results','supplier-detail','supplier-summary','supplier-prev','supplier-next'].map(key=>[key,{textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[],querySelector:()=>null}]));
 const host={isConnected:true,querySelector:key=>nodes[key.slice(1)]},create=await controller({getElementById:()=>host}),calls=[];
 const ui=create({api:path=>new Promise(resolve=>calls.push({path,resolve})),esc:String,permissions:['supplier.view']});ui.bind();
 nodes['supplier-filter'].onsubmit({preventDefault(){}});assert.equal(calls.length,2);
 const envelope=name=>({success:true,data:[{...card(),supplierName:name}],meta:{total:1,page:1,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}});
 calls[1].resolve(envelope('Yeni seçim'));await tick();assert.match(nodes['supplier-results'].innerHTML,/Yeni seçim/);
 calls[0].resolve(envelope('Eski seçim'));await tick();assert.doesNotMatch(nodes['supplier-results'].innerHTML,/Eski seçim/);
 nodes['supplier-filter'].onsubmit({preventDefault(){}});ui.dispose();calls[2].resolve(envelope('Geç cevap'));await tick();assert.doesNotMatch(nodes['supplier-results'].innerHTML,/Geç cevap/);
});
const contact=()=>({fixture:{id:'13373',supplierCode:'TEST-DAILY-PUR-S',supplierName:'Sentetik tedarikçi',currency:'TRY',synthetic:true},contact:{phone:null,city:null,country:''},revision:'A'.repeat(64)});
const requestId='12345678-1234-4123-8123-123456789012';
test('contact eligibility requires exact actor, both permissions, fixture and server proof; NULL differs from empty',()=>{
 assert.equal(supplierContactEligible('16',['supplier.view','supplier.edit'],'13373'),true);
 for(const [id,permissions,supplier] of [['14',['supplier.view','supplier.edit'],'13373'],['16',['supplier.edit'],'13373'],['16',['supplier.view'],'13373'],['16',['supplier.view','supplier.edit'],'10160']])assert.equal(supplierContactEligible(id,permissions,supplier),false);
 for(const change of [{synthetic:false},{id:'10160'},{currency:'USD'}])assert.throws(()=>supplierContactContext({...contact(),fixture:{...contact().fixture,...change}}));
 const request=supplierContactRequest(contact(),{phone:null,city:'',country:'TEST'},requestId);assert.equal(request.phone,null);assert.equal(request.city,'');assert.equal(Object.isFrozen(request),true);
 assert.throws(()=>supplierContactRequest(contact(),{phone:'\n',city:null,country:null},requestId));assert.throws(()=>supplierContactRequest(contact(),{phone:null,city:null,country:null,name:'forged'},requestId));
 const journal={status:'pending',context:contact(),fields:{phone:null,city:'',country:'TEST'},request};supplierContactJournal(journal);assert.throws(()=>supplierContactJournal({...journal,request:{...request,city:'changed'}}));
});
test('completion CAS validates full request and cannot downgrade a confirmed request',()=>{const fields={phone:null,city:'',country:'TEST'},request=supplierContactRequest(contact(),fields,requestId),sent={status:'pending',context:contact(),fields,request};assert.equal(supplierContactCompletionMatches(sent,sent,'saved'),true);assert.equal(supplierContactCompletionMatches({...sent,status:'saved'},sent,'stale'),false);assert.equal(supplierContactCompletionMatches({...sent,request:{...request,country:'other'}},sent,'saved'),false);assert.equal(supplierContactCompletionMatches({...sent,fields:{...fields,country:'other'},request:{...request,country:'other'}},sent,'saved'),false);assert.equal(supplierContactCompletionMatches(null,sent,'saved'),false);});
test('native contact bounds count UTF16 code units: city/country100 accepted,101 rejected, phone40 unchanged',()=>{
 const fields={phone:'1'.repeat(40),city:'İ'.repeat(100),country:'😀'.repeat(50)};
 assert.equal(supplierContactRequest(contact(),fields,requestId).city.length,100);
 assert.equal(supplierContactRequest(contact(),fields,requestId).country.length,100);
 for(const patch of [{phone:'1'.repeat(41)},{city:'İ'.repeat(101)},{country:'😀'.repeat(50)+'A'}])assert.throws(()=>supplierContactRequest(contact(),{...fields,...patch},requestId));
 const unknown=supplierContactRequest(contact(),{phone:null,city:'',country:null},requestId);assert.equal(unknown.phone,null);assert.equal(unknown.city,'');assert.equal(unknown.country,null);
});
function editorDom(){const handlers={},elements=Object.fromEntries(['phone','city','country'].flatMap(k=>[[k,{value:k==='city'?'TEST Şehir':'',disabled:false}],[k+'Unknown',{checked:k==='phone'}]]));const form={elements,addEventListener:(name,handler)=>{handlers['form:'+name]=handler;}};const host={isConnected:true,textContent:'',innerHTML:'',querySelector:selector=>selector==='[data-contact-form]'?form:{addEventListener:(_event,handler)=>{handlers[selector]=handler;}}};const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};return {host,handlers,elements,data,storage};}
test('contact controller never asks raw phone for readonly actor14 or unscoped real card',async()=>{let calls=0;const create=await controller({},'createSupplierContactEditor');for(const actorId of ['14','15']){const ui=create({api:()=>{calls++;},esc:String,actorId,permissions:['supplier.view','supplier.edit']});ui.mount(null,{id:'13373'});ui.dispose();}const ui=create({api:()=>{calls++;},esc:String,actorId:'16',permissions:['supplier.view','supplier.edit']});ui.mount(null,{id:'10160'});assert.equal(calls,0);});
test('uncertain save freezes persisted UUID/payload; identical retry replays and closes without extra audit claim',async()=>{
 const dom=editorDom(),calls=[],create=await controller({},'createSupplierContactEditor');let writes=0;
 const api=async(path,options)=>{calls.push({path,options});if(!options)return contact();assert.equal(JSON.parse([...dom.data.values()][0]).status,'pending');if(++writes===1)throw Error('network');return {...contact(),revision:'B'.repeat(64),contact:{phone:options.body.phone,city:options.body.city,country:options.body.country},replayed:true};};
 const ui=create({api,esc:String,actorId:'16',permissions:['supplier.view','supplier.edit'],storage:dom.storage,uuid:()=>requestId});ui.mount(dom.host,{id:'13373',quarantine:{blocked:false}});await tick();dom.handlers['[data-contact-edit]']();dom.handlers['form:submit']({preventDefault(){}});await tick();
 assert.equal(ui.requestClose(()=>{}),false);assert.equal(calls[1].options.body.requestId,requestId);assert.equal(calls[1].options.body.phone,null);assert.equal(calls[1].options.body.country,'');dom.handlers['[data-contact-retry]']();await tick();assert.deepEqual(calls[2].options.body,calls[1].options.body);assert.match(dom.host.innerHTML,/ek düzenleme veya denetim kaydı oluşturulmadı/);assert.equal(ui.requestClose(()=>{}),true);assert.equal(JSON.parse([...dom.data.values()][0]).status,'saved');ui.dispose();
});
test('stale revision stops identical retries; dirty close needs discard; disposed late save persists without DOM mutation',async()=>{
 const dom=editorDom(),create=await controller({},'createSupplierContactEditor');let resolveWrite,calls=0;
 const ui=create({api:async(_path,options)=>{calls++;if(!options)return contact();return new Promise(resolve=>{resolveWrite=resolve;});},esc:String,actorId:'16',permissions:['supplier.view','supplier.edit'],storage:dom.storage,uuid:()=>requestId});ui.mount(dom.host,{id:'13373',quarantine:{blocked:false}});await tick();dom.handlers['[data-contact-edit]']();dom.handlers['form:input']();let closed=false;assert.equal(ui.requestClose(()=>{closed=true;}),false);assert.equal(closed,false);dom.handlers['[data-contact-keep]']();dom.handlers['form:submit']({preventDefault(){}});const html=dom.host.innerHTML;ui.dispose();resolveWrite({...contact(),contact:{phone:null,city:'TEST Şehir',country:''},replayed:false});await tick();assert.equal(dom.host.innerHTML,html);assert.equal(JSON.parse([...dom.data.values()][0]).status,'saved');
 const stale=editorDom();let writes=0;const ui2=create({api:async(_path,options)=>{if(!options)return contact();writes++;throw Object.assign(Error('stale'),{code:'TEST_SUPPLIER_CONTACT_STALE',status:409});},esc:String,actorId:'16',permissions:['supplier.view','supplier.edit'],storage:stale.storage,uuid:()=>requestId});ui2.mount(stale.host,{id:'13373',quarantine:{blocked:false}});await tick();stale.handlers['[data-contact-edit]']();stale.handlers['form:submit']({preventDefault(){}});await tick();assert.match(stale.host.innerHTML,/Güncel bilgileri yeniden yükle/);stale.handlers['[data-contact-retry]']?.();await tick();assert.equal(writes,1);assert.equal(JSON.parse([...stale.data.values()][0]).status,'stale');ui2.dispose();
});
test('two editors completing in reverse order cannot replace newer pending UUID with old success or stale error',async()=>{
 const create=await controller({},'createSupplierContactEditor');
 for(const late of ['success','stale','network']){
  const first=editorDom(),second=editorDom();second.storage=first.storage;second.data=first.data;let resolveFirst,rejectFirst,resolveSecond,calls=0;
  const result=body=>({...contact(),revision:'B'.repeat(64),contact:{phone:body.phone,city:body.city,country:body.country},replayed:true});
  const api=async(_path,options)=>{if(!options)return contact();calls++;if(calls===1)return new Promise((resolve,reject)=>{resolveFirst=()=>resolve(result(options.body));rejectFirst=reject;});if(calls===2)return result(options.body);return new Promise(resolve=>{resolveSecond=()=>resolve(result(options.body));});};
  const props={api,esc:String,actorId:'16',permissions:['supplier.view','supplier.edit'],storage:first.storage};
  const a=create({...props,uuid:()=>requestId});a.mount(first.host,{id:'13373',quarantine:{blocked:false}});await tick();first.handlers['[data-contact-edit]']();first.handlers['form:submit']({preventDefault(){}});a.dispose();
  const request2='87654321-4321-4123-8123-123456789012',b=create({...props,uuid:()=>request2});b.mount(second.host,{id:'13373',quarantine:{blocked:false}});await tick();second.handlers['[data-contact-retry]']();await tick();second.handlers['[data-contact-reload]']();await tick();second.elements.city.value='NEW TEST CITY';second.handlers['form:submit']({preventDefault(){}});
  const key='melisa-test-supplier-contact:16:13373',before=first.storage.getItem(key);assert.equal(JSON.parse(before).request.requestId,request2);assert.equal(JSON.parse(before).status,'pending');
  if(late==='success')resolveFirst();else rejectFirst(Object.assign(Error(late),late==='stale'?{code:'TEST_SUPPLIER_CONTACT_STALE',status:409}:{}));await tick();assert.equal(first.storage.getItem(key),before);
  resolveSecond();await tick();assert.equal(JSON.parse(first.storage.getItem(key)).request.requestId,request2);assert.equal(JSON.parse(first.storage.getItem(key)).status,'saved');assert.equal(first.data.size,2);b.dispose();
 }
});
test('stale card failure cannot bind its retry to a newer selection error',async()=>{
 const bindings=[],button={dataset:{supplierOpen:'155'}},retry={addEventListener:(_event,handler)=>bindings.push(handler)};
 const nodes=Object.fromEntries(['supplier-filter','supplier-results','supplier-detail','supplier-summary','supplier-prev','supplier-next'].map(key=>[key,{textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[],querySelector:()=>null}]));
 nodes['supplier-results'].querySelectorAll=()=>[button];nodes['supplier-detail'].querySelector=()=>retry;
 const host={isConnected:true,querySelector:key=>nodes[key.slice(1)]},create=await controller({getElementById:()=>host}),calls=[];
 const ui=create({api:path=>new Promise((resolve,reject)=>calls.push({path,resolve,reject})),esc:String,permissions:['supplier.view']});ui.bind();
 calls[0].resolve({success:true,data:[card()],meta:{total:1,page:1,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}});await tick();
 button.onclick();button.dataset.supplierOpen='156';button.onclick();
 calls[2].reject(Error('Yeni kart hatası'));await tick();assert.equal(bindings.length,1);assert.match(nodes['supplier-detail'].innerHTML,/Yeni kart hatası/);
 calls[1].reject(Error('Eski kart hatası'));await tick();assert.equal(bindings.length,1);assert.doesNotMatch(nodes['supplier-detail'].innerHTML,/Eski kart hatası/);
 bindings[0]();assert.equal(calls[3].path,'/api/suppliers/156/card');ui.dispose();calls[3].reject(Error('Kapalı kart'));await tick();assert.equal(bindings.length,1);
});
test('actual card rendering uses supplier debt direction and only supported nullable contact fields',async()=>{
 const button={dataset:{supplierOpen:'155'}},close={};
 const nodes=Object.fromEntries(['supplier-filter','supplier-results','supplier-detail','supplier-summary','supplier-prev','supplier-next'].map(key=>[key,{textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[],querySelector:()=>null}]));
 nodes['supplier-results'].querySelectorAll=()=>[button];nodes['supplier-detail'].querySelector=()=>close;nodes['supplier-detail'].scrollIntoView=()=>{};
 const host={isConnected:true,querySelector:key=>nodes[key.slice(1)]},create=await controller({getElementById:()=>host});let calls=0;
 const fixture=card();fixture.accounts.push({...account(),accountId:'4',currency:null,balanceExact:null,nativeBalanceExact:'0.00000000',sourceOpeningBalanceExact:null,confidence:'native-unverified',reconciled:null});fixture.accountCount=2;fixture.hasUnknownAccounts=true;
 const ui=create({api:async()=>++calls===1?{success:true,data:[fixture],meta:{total:1,page:1,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}}:fixture,esc:String,permissions:['supplier.view']});ui.bind();await tick();button.onclick();await tick();
 const html=nodes['supplier-detail'].innerHTML;assert.match(html,/Melisa’nın tedarikçiden alacağı/);assert.match(html,/Döviz bilinmiyor/);assert.match(html,/Kayıtlı bakiye · Doğrulanmadı/);assert.match(html,/Bilinmiyor/);assert.doesNotMatch(html,/<dt>Not|iskonto|discount|undefined/);assert.match(html,/30 Eylül 2026/);assert.match(html,/disabled/);close.onclick();assert.equal(nodes['supplier-detail'].textContent,'');ui.dispose();
});
