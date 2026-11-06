import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const markerKey='melisa.supplier-contact.pending.v1',copyId='e662fd94-d797-4b3b-938a-d143ad758b67';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function card(id){return {id,supplierCode:'OFFLINE-S'+id,supplierName:'Offline Supplier '+id,contactEditable:true,isPassive:false,quarantine:{blocked:false,reasons:[]},source:{status:'synthetic',sourceAsOf:null,freshLive:false},accounts:[{accountId:'10'+id,currency:id==='2'?'USD':'TRY',confidence:'native-unverified',sourceStatus:'synthetic',sourceAsOf:null,reconciled:false,balanceExact:null,nativeBalanceExact:'10.00000000',sourceOpeningBalanceExact:null}],accountCount:1,hasUnknownAccounts:true,fields:{phoneMasked:null,city:'City '+id,country:null}};}
function contact(id,city='City '+id){return {schemaVersion:'melisa-supplier-contact-context.v1',supplierId:id,supplierCode:card(id).supplierCode,supplierName:card(id).supplierName,revision:'A'.repeat(64),copyId,sealHash:'B'.repeat(64),contact:{phone:null,city,country:null}};}
async function controller(){
 let source=await readFile(new URL('./workSuppliers.js',import.meta.url),'utf8');
 source=source.replace(/^import ['"]\.\/[^'"]+\.css['"];\s*$/gm,'').replace(/from '(\.\/[^']+)'/g,(_,file)=>'from '+JSON.stringify(new URL(file,import.meta.url).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkSuppliers;
}
// Each paint replaces event nodes, as a root.innerHTML replacement does. This
// is an event/markup double, not browser or native acceptance evidence.
function dom(){
 let html='',nodes=new Map();
 const tags=selector=>{const match=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);if(!match)return [];const [,attr,value]=match;return [...html.matchAll(new RegExp('<[^>]*\\b'+attr+'(?:="([^"]*)")?[^>]*>','g'))].filter(m=>value===undefined||m[1]===value).map(m=>({tag:m[0],attr,value:m[1]}));};
 const make=(selector,match)=>{const key=selector+':'+(match.value??'');if(!nodes.has(key)){const dataset={};for(const m of match.tag.matchAll(/data-([a-z-]+)="([^"]*)"/g))dataset[m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[2];nodes.set(key,{dataset,value:/\bvalue="([^"]*)"/.exec(match.tag)?.[1]??'',disabled:/\bdisabled\b/.test(match.tag),elements:{search:{value:''}},addEventListener(event,fn){this['on'+event]=fn;},setAttribute(k,v){this[k]=v;},querySelector:query,querySelectorAll:queryAll});}return nodes.get(key);};
 function query(selector){const match=tags(selector)[0];return match?make(selector,match):null;}
 function queryAll(selector){return tags(selector).map(match=>make(selector,match));}
 const root={isConnected:true,querySelector:query,querySelectorAll:queryAll};Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;nodes=new Map();}});return root;
}
async function fixture(mode='normal'){
 const priorStorage=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage'),values=new Map(),removed=[],stored=[];
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem(key,value){stored.push({key,value});values.set(key,value);},removeItem(key){removed.push(key);values.delete(key);}}});
 const root=dom(),calls=[],writes=[],cardRequests=[],listRequests=[],recoveries=[],deferIds=new Set();let ui,deferList=false;
 const session={suppliers:async(path,options)=>{
  calls.push({path,options});if(path.startsWith('/api/supplier-cards?')){const result={success:true,data:['1','2','3'].map(card),meta:{readOnly:true,sourceAsOf:null,freshLive:false,total:3,page:1,limit:25,environment:'CLEAN_SYNTHETIC_TEST',environmentId:copyId,synthetic:true,actualT1:false,externalOperations:false}};if(deferList){deferList=false;const wait=deferred();listRequests.push({...wait,result});return wait.promise;}return result;}
  const id=path.split('/')[3];if(deferIds.has(id)){const wait=deferred();cardRequests.push({id,...wait});return wait.promise;}return card(id);
 },supplierContact:async(id,options)=>{
  if(!options){calls.push({contactRead:id});return contact(id);}const wait=deferred();writes.push({id,body:structuredClone(options.body),...wait});return wait.promise;
 },supplierContactRecovery:async(id,requestId)=>{const wait=deferred();recoveries.push({id,requestId,...wait});return wait.promise;}};
 if(mode!=='normal'){session.partyHistoryAvailable=()=>mode==='history-on';session.partyHistory=async()=>{assert.fail('No account history request was selected');};}
 const create=await controller();
 const mount=async()=>{ui=create({root,session,user:{id:10018,permissions:['supplier.view','supplier.edit']}});ui.mount();await tick();};await mount();
 const node=selector=>{const value=root.querySelector(selector);assert.ok(value,'Expected visible '+selector);return value;};
 return {root,calls,writes,cardRequests,listRequests,recoveries,values,removed,stored,node,ui:()=>ui,defer(id){deferIds.add(id);},deferList(){deferList=true;},async open(id){const button=root.querySelectorAll('[data-supplier-card]').find(n=>n.dataset.supplierCard===id);assert.ok(button);void button.onclick();await tick();},async editor(){node('[data-customer-contact-open]').onclick();await tick();},async save(city='Saved A'){
  const field=root.querySelectorAll('[data-customer-contact-field]').find(n=>n.dataset.customerContactField==='city');assert.ok(field);field.value=city;field.oninput();node('[data-customer-contact-form]').onsubmit({preventDefault(){}});await tick();
 },async retry(){node('[data-customer-contact-form]').onsubmit({preventDefault(){}});await tick();},async reload(){ui.dispose();await mount();},close(){ui.dispose();if(priorStorage)Object.defineProperty(globalThis,'sessionStorage',priorStorage);else delete globalThis.sessionStorage;}};
}
const detailName=html=>/<h3>(Offline Supplier [1-3])<\/h3>/.exec(html)?.[1];
async function startRace(h){await h.open('1');await h.editor();h.defer('2');await h.open('2');assert.equal(h.cardRequests.length,1);await h.save();assert.equal(h.writes.length,1);assert.equal(h.ui().requestClose(),false);return h.values.get(markerKey);}
function ack(write,id='1'){write.resolve({context:{...contact(id,write.body.city),revision:'C'.repeat(64)},replayed:false});}

for(const mode of ['normal','history-off'])test(`${mode}: a card GET started before saving cannot replace the saving supplier`,async()=>{
 const h=await fixture(mode);
 try{
  const marker=await startRace(h);assert.equal(JSON.parse(marker).customerId,'1');assert.equal(JSON.parse(marker).actorId,10018);assert.equal(JSON.parse(marker).requestId,h.writes[0].body.requestId);
  h.cardRequests[0].resolve(card('2'));await tick();assert.equal(h.ui().requestClose(),false);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.match(h.root.innerHTML,/Kaydediliyor/);assert.equal(h.values.get(markerKey),marker);assert.deepEqual(h.removed,[]);
  ack(h.writes[0]);await tick();assert.equal(h.ui().requestClose(),true);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.match(h.root.innerHTML,/<dt>Şehir<\/dt><dd>Saved A<\/dd>/);assert.equal(h.values.has(markerKey),false);assert.equal(h.writes.length,1);
 }finally{h.close();}
});

for(const mode of ['normal','history-off'])test(`${mode}: late card response cannot release an uncertain save and retry uses its original UUID/body`,async()=>{
 const h=await fixture(mode);
 try{
  const marker=await startRace(h),sent=structuredClone(h.writes[0].body);h.writes[0].reject(Error('Offline lost acknowledgement'));await tick();assert.match(h.root.innerHTML,/yanıtı alınamadı/);
  h.cardRequests[0].resolve(card('2'));await tick();assert.equal(h.ui().requestClose(),false);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.equal(h.values.get(markerKey),marker);assert.deepEqual(h.removed,[]);
  const reads=h.calls.length;await h.ui().refresh();h.node('[data-supplier-refresh]').onclick();await h.open('2');h.node('[data-supplier-close]').onclick();await tick();assert.equal(h.calls.length,reads);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');
  await h.retry();assert.equal(h.writes.length,2);assert.equal(h.writes[1].id,'1');assert.deepEqual(h.writes[1].body,sent);assert.equal(h.values.get(markerKey),marker);ack(h.writes[1]);await tick();assert.equal(h.ui().requestClose(),true);assert.equal(h.values.has(markerKey),false);assert.match(h.root.innerHTML,/<dt>Şehir<\/dt><dd>Saved A<\/dd>/);
  assert.ok(h.stored.every(entry=>!entry.value.includes('Saved A')&&!entry.value.includes('Offline Supplier')));
 }finally{h.close();}
});

test('a foreign contact acknowledgement stays uncertain and never updates the other card',async()=>{
 const h=await fixture();try{const marker=await startRace(h);h.cardRequests[0].resolve(card('2'));await tick();ack(h.writes[0],'2');await tick();assert.equal(h.ui().requestClose(),false);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.equal(h.values.get(markerKey),marker);await h.retry();assert.deepEqual(h.writes[1].body,h.writes[0].body);ack(h.writes[1]);await tick();assert.equal(h.ui().requestClose(),true);}finally{h.close();}
});

for(const failure of ['network',403])test(`late card ${failure} failure cannot repaint over the saving card status`,async()=>{
 const h=await fixture();try{const marker=await startRace(h);h.cardRequests[0].reject(failure==='network'?Error('Card offline'):{status:failure});await tick();assert.equal(h.ui().requestClose(),false);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.doesNotMatch(h.root.innerHTML,/Bu tedarikçi kartı şu anda açılamıyor/);assert.equal(h.values.get(markerKey),marker);ack(h.writes[0]);await tick();assert.equal(h.ui().requestClose(),true);}finally{h.close();}
});

test('a card response after a confirmed save can switch normally without applying old contact data to it',async()=>{
 const h=await fixture();try{await startRace(h);ack(h.writes[0]);await tick();assert.equal(h.values.has(markerKey),false);h.cardRequests[0].resolve(card('2'));await tick();assert.equal(detailName(h.root.innerHTML),'Offline Supplier 2');assert.match(h.root.innerHTML,/<dt>Şehir<\/dt><dd>City 2<\/dd>/);assert.doesNotMatch(h.root.innerHTML,/<dt>Şehir<\/dt><dd>Saved A<\/dd>/);await h.editor();assert.equal(h.calls.at(-1).contactRead,'2');assert.equal(h.writes.length,1);}finally{h.close();}
});

test('latest card selection wins when responses return in reverse order without a save',async()=>{
 const h=await fixture();try{await h.open('1');h.defer('2');h.defer('3');await h.open('2');await h.open('3');h.cardRequests[1].resolve(card('3'));await tick();h.cardRequests[0].resolve(card('2'));await tick();assert.equal(detailName(h.root.innerHTML),'Offline Supplier 3');await h.editor();assert.equal(h.calls.at(-1).contactRead,'3');assert.equal(h.writes.length,0);}finally{h.close();}
});

for(const outcome of ['network',403,'foreign-id'])test(`ordinary ${outcome} card failure retains the previous card and remains visible when unlocked`,async()=>{
 const h=await fixture();try{await h.open('1');h.defer('2');await h.open('2');if(outcome==='foreign-id')h.cardRequests[0].resolve(card('3'));else h.cardRequests[0].reject(outcome===403?{status:403}:Error('Card offline'));await tick();assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.match(h.root.innerHTML,/Bu tedarikçi kartı şu anda açılamıyor/);assert.equal(h.ui().requestClose(),true);assert.equal(h.writes.length,0);}finally{h.close();}
});

test('dispose revokes both pending card and contact responses without clearing the unresolved marker',async()=>{
 const h=await fixture();try{const marker=await startRace(h),html=h.root.innerHTML;h.ui().dispose();h.cardRequests[0].resolve(card('2'));ack(h.writes[0]);await tick();assert.equal(h.root.innerHTML,html);assert.equal(h.values.get(markerKey),marker);assert.deepEqual(h.removed,[]);}finally{h.close();}
});

test('reload recovers the original supplier marker explicitly without a new contact POST',async()=>{
 const h=await fixture();try{const marker=await startRace(h);h.writes[0].reject(Error('Offline lost acknowledgement'));await tick();h.cardRequests[0].resolve(card('2'));await tick();await h.reload();await h.open('1');await h.editor();assert.equal(h.ui().requestClose(),false);assert.equal(h.values.get(markerKey),marker);await h.retry();assert.equal(h.recoveries.length,1);assert.equal(h.recoveries[0].id,'1');assert.equal(h.recoveries[0].requestId,h.writes[0].body.requestId);assert.equal(h.writes.length,1);h.recoveries[0].resolve({committed:true,context:contact('1','Saved A')});await tick();assert.equal(h.ui().requestClose(),true);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.equal(h.values.has(markerKey),false);}finally{h.close();}
});

test('business history switch clears the old card before waiting and cannot use its detached contact form',async()=>{
 const h=await fixture('history-on');try{await h.open('1');await h.editor();const oldForm=h.node('[data-customer-contact-form]');h.defer('2');await h.open('2');assert.equal(detailName(h.root.innerHTML),undefined);oldForm.onsubmit({preventDefault(){}});await tick();assert.equal(h.writes.length,0);h.cardRequests[0].resolve(card('2'));await tick();assert.equal(detailName(h.root.innerHTML),'Offline Supplier 2');await h.editor();assert.equal(h.calls.at(-1).contactRead,'2');}finally{h.close();}
});

test('business history still blocks card selection while contact saving is already in progress',async()=>{
 const h=await fixture('history-on');try{await h.open('1');await h.editor();await h.save();h.defer('2');await h.open('2');assert.equal(h.cardRequests.length,0);assert.equal(detailName(h.root.innerHTML),'Offline Supplier 1');assert.equal(h.ui().requestClose(),false);ack(h.writes[0]);await tick();assert.equal(h.ui().requestClose(),true);}finally{h.close();}
});

for(const mode of ['normal','history-on'])test(`${mode}: old supplier list selection cannot open a card during or after a newer search`,async()=>{
 const h=await fixture(mode);try{
  const old=h.root.querySelectorAll('[data-supplier-card]').find(n=>n.dataset.supplierCard==='1');assert.ok(old);
  const search=h.node('[data-supplier-search]');search.elements.search.value='Supplier 2';h.deferList();search.onsubmit({preventDefault(){}});await tick();assert.equal(h.listRequests.length,1);
  let reads=h.calls.length;old.onclick();await tick();assert.equal(h.calls.length,reads);assert.equal(detailName(h.root.innerHTML),undefined);
  h.listRequests[0].resolve({...h.listRequests[0].result,data:[card('2')],meta:{...h.listRequests[0].result.meta,total:1}});await tick();
  reads=h.calls.length;old.onclick();await tick();assert.equal(h.calls.length,reads);assert.equal(detailName(h.root.innerHTML),undefined);
  await h.open('2');assert.equal(detailName(h.root.innerHTML),'Offline Supplier 2');assert.equal(h.writes.length,0);
 }finally{h.close();}
});

test('detached supplier callbacks and refresh cannot start requests or change the screen',async()=>{
 const h=await fixture();try{
  const old=h.root.querySelectorAll('[data-supplier-card]')[0],search=h.node('[data-supplier-search]'),refresh=h.node('[data-supplier-refresh]');
  const html=h.root.innerHTML;h.ui().dispose();const reads=h.calls.length;
  old.onclick();search.onsubmit({preventDefault(){}});refresh.onclick();await h.ui().refresh();await tick();
  assert.equal(h.calls.length,reads);assert.equal(h.root.innerHTML,html);assert.equal(h.writes.length,0);
 }finally{h.close();}
});

for(const failure of [403,'offline'])test(`a newer supplier search failure (${failure}) keeps old list callbacks inactive`,async()=>{
 const h=await fixture();try{
  const old=h.root.querySelectorAll('[data-supplier-card]')[0],search=h.node('[data-supplier-search]');
  h.deferList();search.elements.search.value='new search';search.onsubmit({preventDefault(){}});await tick();
  h.listRequests[0].reject(failure===403?{status:403}:Error('Offline list'));await tick();
  assert.match(h.root.innerHTML,/Tedarikçi kartları şu anda açılamıyor/);const reads=h.calls.length;
  old.onclick();await tick();assert.equal(h.calls.length,reads);assert.equal(detailName(h.root.innerHTML),undefined);assert.equal(h.writes.length,0);
 }finally{h.close();}
});

test('refresh restores the exact selected supplier once the new list is ready',async()=>{
 const h=await fixture();try{
  await h.open('2');h.deferList();void h.ui().refresh();await tick();assert.equal(h.listRequests.length,1);assert.equal(detailName(h.root.innerHTML),undefined);
  h.listRequests[0].resolve(h.listRequests[0].result);await tick();await tick();assert.equal(detailName(h.root.innerHTML),'Offline Supplier 2');
  assert.equal(h.calls.filter(c=>c.path==='/api/suppliers/2/card').length,2);assert.equal(h.writes.length,0);
 }finally{h.close();}
});

for(const failure of [403,'offline'])test(`refresh does not reopen a previously selected supplier when the list fails (${failure})`,async()=>{
 const h=await fixture();try{
  await h.open('2');const cardReads=h.calls.filter(c=>c.path==='/api/suppliers/2/card').length;
  h.deferList();void h.ui().refresh();await tick();assert.equal(h.listRequests.length,1);
  h.listRequests[0].reject(failure===403?{status:403}:Error('Offline list'));await tick();await tick();
  assert.match(h.root.innerHTML,/Tedarikçi kartları şu anda açılamıyor/);assert.equal(detailName(h.root.innerHTML),undefined);
  assert.equal(h.calls.filter(c=>c.path==='/api/suppliers/2/card').length,cardReads);assert.equal(h.writes.length,0);
 }finally{h.close();}
});
