import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {paymentContext,paymentSelection,paymentPreview,paymentRecord,createPaymentJournal} from './workSupplierPaymentsModel.mjs';
import {supplierPaymentContext,supplierPaymentPreview} from '../../../api/src/services/workSupplierPaymentModel.mjs';
import {CLEAN_FINANCE_FX_CASES} from '../../../api/src/services/cleanFinanceRehearsalModel.mjs';
const requestId='00000000-0000-4000-8000-000000000001',apiBase='http://192.168.1.46:4144';
const actor={id:'16',permissions:['finance.view','supplier.view','finance.payment','finance.payment.cancel']};
function raw(){return {actorId:'16',roleCode:'isolated_test_ilker',permissions:actor.permissions,documentDate:'2026-10-06',maxAmountExact4:'500.0000',maxPayments:30,suppliers:['TRY','USD','EUR'].map((currency,i)=>({id:String(101+i),code:'SUP-'+currency,name:'Tedarikçi '+currency,currency,balanceExact4:['140.0000','20.0000','30.0000'][i],debtKind:i?'opening':'invoice',snapshotVerified:true,invoices:i?[]:[{id:'139',receiptId:'105',number:'TSTB-PAY',status:'finalized',documentDate:'2026-10-06',receiptKind:'work-finops-physical-receipt',documentCurrency:'USD',documentAmountExact4:'3.5000',accountCurrency:'TRY',accountAmountExact4:'140.0000',paidExact4:'0.0000',returnedExact4:'0.0000',remainingExact4:'140.0000'}]})),accounts:['TRY','USD','EUR'].map((currency,i)=>({id:String(201+i),code:'ACC-'+currency,name:'Hesap '+currency,type:i?'bank':'cash',currency,openingVerified:true,openingBalanceExact4:'1000.0000',balanceExact4:'1000.0000'})),rates:['USD','EUR'].map((currency,i)=>({id:String(401+i),currency,rateToTryExact8:i?'45.00000000':'40.00000000',date:'2026-10-04'})),payments:[]};}

test('unknown historical opening exception cannot be applied to original synthetic payment accounts',()=>{
 const c=context();assert.equal(paymentContext(c),c);
 for(const openingBalanceExact4 of ['1000.0000',null]){const invalid=structuredClone(c);Object.assign(invalid.accounts[0],{openingBalanceExact4,openingVerified:false,openingOrigin:'UNKNOWN',startingBalanceVerified:true,startingBalanceExact4:'1000.0000'});assert.throws(()=>paymentContext(invalid));}
});
const context=()=>supplierPaymentContext(raw(),actor);
const selected=(amount='50.0000')=>({supplierId:'101',invoiceId:'139',accountId:'201',currency:'TRY',amountExact4:amount,documentDate:'2026-10-06',description:'Kısmi ödeme'});
function record(s=selected()){return {id:'701',supplierId:s.supplierId,accountId:s.accountId,invoiceId:s.invoiceId,receiptId:s.invoiceId?'105':null,receiptKind:s.invoiceId?'work-finops-physical-receipt':null,invoiceNumber:s.invoiceId?'TSTB-PAY':null,ownership:'work',canCancel:true,kind:'payment',direction:'out',currency:s.currency,amountExact4:s.amountExact4,accountCurrency:s.currency,accountAmountExact4:s.amountExact4,amountTryExact4:s.currency==='TRY'?s.amountExact4:'400.0000',documentRateExact8:s.currency==='TRY'?'1.00000000':'40.00000000',accountRateExact8:s.currency==='TRY'?'1.00000000':'40.00000000',documentDate:s.documentDate,description:s.description,number:'OD-701',originalId:null,reversedById:null};}
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}
async function controller(){let s=await readFile(new URL('./workSupplierPayments.js',import.meta.url),'utf8');s=s.replace("import './workSupplierPayments.css';",'');for(const file of ['workCopyPresentation.mjs','workSupplierPaymentsModel.mjs','workInboundModel.mjs','workTradeModel.mjs','testAdminSession.mjs'])s=s.replace("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));}
const tick=()=>new Promise(r=>setImmediate(r));
test('unsupported 5244 payment journal permits leaving without touching storage or sending requests',async()=>{
 const {createWorkSupplierPayments}=await controller(),d=dom();let reads=0,writes=0,calls=0;
 const ui=createWorkSupplierPayments({root:d.root,user:{id:17},apiBase:'http://192.168.1.46:5244',location:{protocol:'http:',hostname:'192.168.1.46',port:'5244'},storage:{getItem(){reads++;throw Error();},setItem(){writes++;throw Error();}},session:{inbound(){calls++;throw Error();},supplierPayments(){calls++;throw Error();}}});
 ui.mount();await tick();assert.match(d.root.innerHTML,/Ödeme bağlantısı doğrulanamadı/);assert.equal(ui.requestClose(),true);assert.equal(reads,0);assert.equal(writes,0);assert.equal(calls,0);ui.dispose();
});
test('a real pending payment still blocks leaving and preserves the request without automatic resend',async()=>{
 const {createWorkSupplierPayments}=await controller(),d=dom(),store=storage(),calls=[];
 const journal=createPaymentJournal({storage:store,actorId:'16',apiBase,makeUuid:()=>requestId});
 journal.begin('/api/work-supplier-payments/payments',{supplierId:'101',invoiceId:null,accountId:'201',amountExact4:'1.0000',documentDate:'2026-10-06'});
 const before=[...store.map.entries()];
 const ui=createWorkSupplierPayments({root:d.root,user:{id:16},storage:store,apiBase,session:{inbound:async()=>receiving(),supplierPayments:async(path,options)=>{calls.push({path,options});if(path.endsWith('/context'))return context();throw {status:404};}}});
 ui.mount();await tick();assert.equal(ui.requestClose(),false);assert.match(d.root.innerHTML,/Son ödemeyi doğruladıktan sonra/);assert.deepEqual([...store.map.entries()],before);assert.ok(calls.every(c=>c.options?.method!=='POST'));ui.dispose();
});
test('payment history retains the escaped audit description inside closed details with no write',async()=>{
 const {createWorkSupplierPayments}=await controller(),d=dom(),c=context(),calls=[];
 c.payments=[record({...selected(),description:'Audit <note & detail>'})];
 const before=JSON.stringify(c.payments);
 const ui=createWorkSupplierPayments({root:d.root,session:{inbound:async()=>receiving(),supplierPayments:async(path,options)=>{calls.push({path,options});return c;}},user:{id:16},storage:storage(),apiBase});
 ui.mount();await tick();d.node('[data-sp-supplier]').onchange({target:{value:'101'}});
 assert.match(d.root.innerHTML,/<h2>Ödeme geçmişi<\/h2>/);
 assert.match(d.root.innerHTML,/<details class="payment-description"><summary>Açıklama<\/summary><p>Audit &lt;note &amp; detail&gt;<\/p><\/details>/);
 assert.doesNotMatch(d.root.innerHTML,/<details[^>]*\bopen\b/);
 assert.equal(JSON.stringify(c.payments),before);
 assert.ok(calls.every(call=>!call.options));
 ui.dispose();
});
function dom(){let html='',paints=0;const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',value:'',dataset:{},elements:{reason:{value:'Yanlış ödeme'},date:{value:'2026-10-06'}},setAttribute(k,v){this[k]=v;},remove(){this.removed=true;},querySelector:node,addEventListener(e,f){this['on'+e]=f;}});return nodes.get(k);};const root={isConnected:true,get innerHTML(){return html;},set innerHTML(v){html=v;paints++;},querySelector:node,querySelectorAll(selector){const field=selector.slice(1,-1),key=field.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return [...html.matchAll(new RegExp(field+'="([^"]+)"','g'))].map(m=>{const n=node(selector+m[1]);n.dataset[key]=m[1];return n;});}};return {root,node,paints:()=>paints};}
function receiving(can=true){return {meta:{schemaVersion:'melisa-work-inbound.v1',source:'native-test',timeZone:'Europe/Istanbul'},capabilities:Object.fromEntries(['canCount','canSubmit','canApprove','canReject','canViewPurchase','canViewSupplier','canCreatePurchase','canFinalizePurchase','canCancelPurchase'].map(k=>[k,k==='canViewPurchase'?can:false])),scope:{synthetic:true,supplier:{id:'1',code:'S',name:'S'},warehouse:{id:'1',label:'Depo'},products:['2','3'].map(id=>({id,stockCode:id,name:id,barcode:null,unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:null,writeEligible:true}))},countDrafts:[],receipts:[]};}
test('actual backend typed context and partial/full preview retain invoice document USD separately from TRY payment and account debt',()=>{const c=paymentContext(context()),s=selected(),p=supplierPaymentPreview(s,c);assert.equal(paymentPreview(p,s,c),p);assert.equal(c.suppliers[0].invoices[0].documentCurrency,'USD');assert.equal(p.currency,'TRY');assert.equal(p.balanceAfterExact4,'90.0000');assert.equal(p.invoiceRemainingAfterExact4,'90.0000');assert.equal(paymentPreview(supplierPaymentPreview(selected('140.0000'),c),selected('140.0000'),c).balanceAfterExact4,'0.0000');const usd={...s,supplierId:'102',invoiceId:null,accountId:'202',currency:'USD',amountExact4:'10.0000'};assert.equal(paymentPreview(supplierPaymentPreview(usd,c),usd,c).settlement.amountTryExact4,'400.0000');});
test('zero, negative, overpayment, wrong currency/account/date and missing FX never produce a writable client selection',()=>{const c=context();for(const patch of [s=>s.amountExact4='0.0000',s=>s.amountExact4='-1.0000',s=>s.amountExact4='141.0000',s=>s.currency='USD',s=>s.accountId='202',s=>s.invoiceId=null,s=>s.documentDate='2026-02-31',s=>s.documentDate='2026-10-07']){const s=selected();patch(s);assert.throws(()=>paymentSelection(s,c));}c.rates=[];assert.throws(()=>paymentSelection({...selected(),supplierId:'102',invoiceId:null,accountId:'202',currency:'USD',amountExact4:'10.0000'},c),e=>e.code==='PAYMENT_RATE_UNAVAILABLE');});
test('preview and recorded identity reject source/totals/revision corruption and payment cancellation preserves original link',()=>{const c=context(),s=selected(),p=supplierPaymentPreview(s,c);for(const mutate of [x=>x.selection.supplierId='102',x=>x.balanceAfterExact4='89.9999',x=>x.accountBalanceAfterExact4='999.0000',x=>x.settlement.amountTryExact4='1.0000',x=>x.revision='b'.repeat(64),x=>x.settlement.accountCurrency='USD']){const x=structuredClone(p);mutate(x);assert.throws(()=>paymentPreview(x,s,c));}const r=record();assert.equal(paymentRecord(r),r);assert.throws(()=>paymentRecord({...r,kind:'payment_cancel',direction:'in'}));assert.equal(paymentRecord({...r,id:'702',kind:'payment_cancel',canCancel:false,direction:'in',originalId:'701'}).originalId,'701');});
test('actor/API-bound journal stores full UUID request before POST and prevents mutation, late completion and unavailable storage/RNG',()=>{const store=storage(),j=createPaymentJournal({storage:store,actorId:'16',apiBase,makeUuid:()=>requestId});j.backup({amount:'50'});const p=j.begin('/api/work-supplier-payments/payments',{...selected(),previewHash:'a'.repeat(64),expectedRevision:'b'.repeat(64)});assert.deepEqual(j.read().request,p);assert.throws(()=>j.backup({amount:'60'}));assert.throws(()=>j.begin('/api/work-supplier-payments/payments',{}));assert.equal(j.finish({...p,body:{...p.body,amountExact4:'60.0000'}},{}),null);assert.equal(createPaymentJournal({storage:store,actorId:'15',apiBase}).read().request,null);assert.equal(createPaymentJournal({storage:store,actorId:'16',apiBase:'http://127.0.0.1:4144'}).read().request,null);assert.throws(()=>createPaymentJournal({storage:{getItem:()=>null,setItem(){throw Error();}},actorId:'16',apiBase}).begin('/api/work-supplier-payments/payments',{}),/Kayıt gönderilmedi|kayıt gönderilmedi/);assert.throws(()=>createPaymentJournal({storage:storage(),actorId:'16',apiBase,makeUuid(){throw Error();}}).begin('/api/work-supplier-payments/payments',{}),/kayıt gönderilmedi/);});
test('actual preflight hides denied personnel finance before any payment GET and late disposal cannot paint',async()=>{const {createWorkSupplierPayments}=await controller();for(const id of [14,15]){const d=dom(),calls=[],ui=createWorkSupplierPayments({root:d.root,session:{inbound:async()=>receiving(false),supplierPayments:async path=>{calls.push(path);throw Error();}},user:{id},storage:storage(),apiBase});ui.mount();await tick();assert.equal(calls.length,0);assert.match(d.root.innerHTML,/görüntüleme yetkiniz yok/);ui.dispose();}let resolve;const d=dom(),ui=createWorkSupplierPayments({root:d.root,session:{inbound:()=>new Promise(r=>resolve=r)},user:{id:16},storage:storage(),apiBase});ui.mount();const before=d.root.innerHTML;ui.dispose();resolve(receiving());await tick();assert.equal(d.root.innerHTML,before);});
test('actual input→preview captures amount before paint and pending create locks every selection; loss/reload recovers confirmed actor request once',async()=>{const {createWorkSupplierPayments}=await controller(),d=dom(),store=storage(),c=context(),calls=[];let finishWrite;const session={inbound:async()=>receiving(),supplierPayments:async(path,o)=>{calls.push({path,o});if(!o)return c;if(path.endsWith('/preview'))return supplierPaymentPreview(o.body,c);if(path.endsWith('/payments'))return new Promise(r=>finishWrite=r);throw Error(path);}};const ui=createWorkSupplierPayments({root:d.root,session,user:{id:16},storage:store,apiBase,uuid:()=>requestId});ui.mount();await tick();d.node('[data-sp-supplier]').onchange({target:{value:'101'}});d.node('[data-sp-invoice]').onchange({target:{value:'139'}});for(const [selector,value] of [['[data-sp-account]','201'],['[data-sp-amount]','50'],['[data-sp-date]','2026-10-06'],['[data-sp-description]','Kısmi ödeme']]){const input=d.node(selector),before=d.paints();input.value=value;input.oninput({target:input});input.onchange({target:input});assert.equal(d.paints(),before);}d.node('[data-sp-check]').onclick();await tick();assert.equal(calls.find(x=>x.path.endsWith('/preview')).o.body.amountExact4,'50.0000');assert.match(d.root.innerHTML,/İşlem sonrası kalan borç: 90,00 TRY/);assert.match(d.root.innerHTML,/Belge toplamı: 3,50 USD/);assert.match(d.root.innerHTML,/Borç kaynağı bağlı değil/);d.node('[data-sp-save]').onclick();await tick();const sent=calls.find(x=>x.path.endsWith('/payments')).o.body,rawStored=store.getItem('melisa-work-supplier-payment:'+apiBase+':16');d.node('[data-sp-supplier]').onchange({target:{value:'102'}});d.node('[data-sp-amount]').value='100';d.node('[data-sp-amount]').oninput({target:{value:'100'}});assert.equal(store.getItem('melisa-work-supplier-payment:'+apiBase+':16'),rawStored);assert.equal(ui.requestClose(),false);ui.dispose();const result={payment:record(sent),requestId,replayed:false};finishWrite(result);await tick();const stored=JSON.parse(store.getItem('melisa-work-supplier-payment:'+apiBase+':16'));assert.equal(stored.request.status,'confirmed');stored.request.status='pending';store.setItem('melisa-work-supplier-payment:'+apiBase+':16',JSON.stringify(stored));const e=dom(),recoverCalls=[],next=createWorkSupplierPayments({root:e.root,session:{inbound:async()=>receiving(),supplierPayments:async(path,o)=>{recoverCalls.push({path,o});return path.includes('/requests/')?{requestId,operation:'payment',response:result}:c;}},user:{id:16},storage:store,apiBase});next.mount();await tick();assert.match(e.root.innerHTML,/Son ödeme sonucu doğrulandı/);assert.ok(recoverCalls.every(x=>!x.o));assert.equal(next.requestClose(),true);next.dispose();});

test('source-bound invoice/rate proof rejects consistent-looking altered preview and record',()=>{const c=context(),s=selected(),p=supplierPaymentPreview(s,c);for(const change of [x=>{x.invoiceRemainingBeforeExact4='150.0000';x.invoiceRemainingAfterExact4='100.0000';},x=>{x.settlement.documentRateExact8=x.settlement.accountRateExact8='2.00000000';x.settlement.amountTryExact4='100.0000';}]){const x=structuredClone(p);change(x);assert.throws(()=>paymentPreview(x,s,c));}const broken=structuredClone(c);broken.suppliers[0].invoices[0].accountCurrency='USD';assert.throws(()=>paymentContext(broken));const usd={...selected('10.0000'),supplierId:'102',invoiceId:null,accountId:'202',currency:'USD'},q=supplierPaymentPreview(usd,c);assert.throws(()=>paymentPreview({...q,settlement:{...q.settlement,rateSource:null}},usd,c));assert.throws(()=>paymentRecord({...record(),amountTryExact4:'51.0000'}));});

test('lost response with missing request lookup retries exact full body once without new UUID; conflict remains locked',async()=>{const {createWorkSupplierPayments}=await controller(),store=storage(),j=createPaymentJournal({storage:store,actorId:'16',apiBase,makeUuid:()=>requestId}),c=context(),s=selected();const p=supplierPaymentPreview(s,c),intent=j.begin('/api/work-supplier-payments/payments',{...s,expectedRevision:p.revision,previewHash:p.previewHash}),d=dom(),calls=[];let tries=0;const ui=createWorkSupplierPayments({root:d.root,session:{inbound:async()=>receiving(),supplierPayments:async(path,o)=>{calls.push({path,o});if(!o){if(path.includes('/requests/'))throw {status:404};return c;}assert.deepEqual(o.body,intent.body);if(++tries===1)throw {status:409,code:'WORK_PAYMENT_REQUEST_CONFLICT'};return {payment:record(o.body),requestId,replayed:true};}},user:{id:16},storage:store,apiBase,uuid(){throw Error('New UUID forbidden');}});ui.mount();await tick();assert.equal(ui.requestClose(),false);d.node('[data-sp-retry]').onclick();await tick();assert.equal(j.read().request.status,'pending');assert.equal(ui.requestClose(),false);d.node('[data-sp-retry]').onclick();await tick();assert.equal(j.read().request.status,'confirmed');assert.equal(ui.requestClose(),true);assert.equal(calls.filter(x=>x.o).length,2);assert.match(d.root.innerHTML,/ikinci kez kaydedilmedi/);ui.dispose();});

test('partial then full invoice payment and cancel show persisted native source history/debt/account effect on refresh',async()=>{const {createWorkSupplierPayments}=await controller(),d=dom(),store=storage();let c=context(),seq=0;const session={inbound:async()=>receiving(),supplierPayments:async(path,o)=>{if(!o)return c;if(path.endsWith('/preview'))return supplierPaymentPreview(o.body,c);const p=path.endsWith('/cancel')?{...c.payments.find(p=>p.id===path.split('/').at(-2)),id:String(703),kind:'payment_cancel',canCancel:false,direction:'in',originalId:path.split('/').at(-2),reversedById:null,description:o.body.reason}:record(o.body);if(!path.endsWith('/cancel'))p.id=String(701+seq++);const delta=BigInt(p.amountExact4.replace('.',''))*(p.kind==='payment'?-1n:1n),exact=v=>{const n=BigInt(v.replace('.',''))+delta;return `${n/10000n}.${String(n%10000n).padStart(4,'0')}`;};c=structuredClone(c);c.suppliers[0].balanceExact4=exact(c.suppliers[0].balanceExact4);c.accounts[0].balanceExact4=exact(c.accounts[0].balanceExact4);const invoice=c.suppliers[0].invoices[0];invoice.remainingExact4=exact(invoice.remainingExact4);if(p.kind==='payment_cancel'){const original=c.payments.find(x=>x.id===p.originalId);original.reversedById=p.id;original.canCancel=false;}c.payments.push(p);return {payment:p,requestId:o.body.requestId,replayed:false};}};const ui=createWorkSupplierPayments({root:d.root,session,user:{id:16},storage:store,apiBase,uuid:()=>`00000000-0000-4000-8000-${String(seq+1).padStart(12,'0')}`});ui.mount();await tick();d.node('[data-sp-supplier]').onchange({target:{value:'101'}});d.node('[data-sp-invoice]').onchange({target:{value:'139'}});async function pay(amount){for(const [selector,value] of [['[data-sp-account]','201'],['[data-sp-amount]',amount],['[data-sp-date]','2026-10-06'],['[data-sp-description]','Ödeme']]){const n=d.node(selector);n.value=value;n.oninput({target:n});}d.node('[data-sp-check]').onclick();await tick();d.node('[data-sp-save]').onclick();await tick();}await pay('50');assert.equal(c.suppliers[0].balanceExact4,'90.0000');assert.match(d.root.innerHTML,/Ödeme kaydedildi/);await pay('90');assert.equal(c.suppliers[0].balanceExact4,'0.0000');assert.equal(c.accounts[0].balanceExact4,'860.0000');const cancel=d.root.querySelectorAll('[data-sp-cancel]').find(n=>n.dataset.spCancel==='701');cancel.onclick();const form=d.node('[data-sp-cancel-form]').querySelector('form');form.onsubmit({preventDefault(){}});await tick();assert.equal(c.suppliers[0].balanceExact4,'50.0000');assert.equal(c.accounts[0].balanceExact4,'910.0000');assert.match(d.root.innerHTML,/Ödeme iptali \/ ters kayıt/);assert.match(d.root.innerHTML,/Mal kabul #105 → Fatura TSTB-PAY/);assert.match(d.root.innerHTML,/İptal edildi/);ui.refresh();await tick();assert.equal(c.payments.length,3);assert.match(d.root.innerHTML,/Ödeme iptali \/ ters kayıt/);ui.dispose();});

test('earlier scoped payment history remains visible but only work-owned cancelable records expose a cancel action',async()=>{const {createWorkSupplierPayments}=await controller(),c=context(),d=dom(),previous={...record(),id:'801',ownership:'legacy',canCancel:false,number:'OD-801'},newPayment={...record(),id:'802',number:'OD-802'};c.payments=[previous,newPayment];assert.equal(paymentContext(c),c);assert.throws(()=>paymentRecord({...previous,canCancel:true}));const ui=createWorkSupplierPayments({root:d.root,session:{inbound:async()=>receiving(),supplierPayments:async()=>c},user:{id:16},storage:storage(),apiBase});ui.mount();await tick();d.node('[data-sp-supplier]').onchange({target:{value:'101'}});assert.match(d.root.innerHTML,/OD-801/);assert.match(d.root.innerHTML,/Önceki kayıt · Görüntüleme/);assert.doesNotMatch(d.root.innerHTML,/data-sp-cancel="801"/);assert.match(d.root.innerHTML,/data-sp-cancel="802"/);ui.dispose();});

function goal8Context(){
 const r=raw();r.documentDate='2026-10-07';r.rates=[];r.suppliers=[r.suppliers[0]];r.accounts=[r.accounts[0]];
 Object.assign(r.suppliers[0],{id:'13370',code:'TEST-V70-GOODS-S'});
 Object.assign(r.suppliers[0].invoices[0],{receiptKind:'work-goal8-batch-receipt',number:'TSTB-G8-FIXTURE',documentDate:r.documentDate,documentCurrency:'TRY',documentAmountExact4:'140.0000'});
 Object.assign(r.accounts[0],{code:'TEST-NIGHT-20261006-K',openingBalanceExact4:'0.0000'});
 r.testProfile={id:'ERP-GOAL8-20261007',sealed:true,synthetic:true,dayId:requestId,productId:'325503',supplierId:'13370',customerId:'30598',accountId:r.accounts[0].id,currency:'TRY',definitionHash:'A'.repeat(64)};
 r.payments=[{...record(),supplierId:'13370',documentDate:r.documentDate,receiptKind:'work-goal8-batch-receipt',invoiceNumber:'TSTB-G8-FIXTURE'}];
 return supplierPaymentContext(r,actor,true);
}

test('sealed Goal8 backend DTO preserves its exact receipt kind while legacy context remains unchanged',()=>{
 const legacy=context(),before=JSON.stringify(legacy),c=goal8Context();
 assert.equal(paymentContext(legacy),legacy);assert.equal(JSON.stringify(legacy),before);
 assert.equal(paymentContext(c),c);assert.equal(paymentRecord(c.payments[0]),c.payments[0]);
 for(const mutate of [x=>delete x.meta.testProfile,x=>x.meta.testProfile.id='OTHER',x=>x.meta.testProfile.sealed=false,x=>x.meta.testProfile.synthetic=false,x=>x.meta.testProfile.dayId='bad',x=>x.meta.testProfile.definitionHash='a'.repeat(64),x=>x.meta.testProfile.accountId='202',x=>x.meta.date='2026-10-08',x=>x.payments[0].receiptKind='work-finops-physical-receipt',x=>x.suppliers[0].invoices[0].receiptKind='unknown']){
  const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>paymentContext(invalid));
 }
 assert.throws(()=>paymentRecord({...c.payments[0],receiptKind:'unknown'}));
 assert.throws(()=>paymentRecord({...c.payments[0],receiptId:null}));
 assert.throws(()=>paymentRecord({...c.payments[0],ownership:'legacy',canCancel:true}));
 assert.throws(()=>paymentRecord({...c.payments[0],amountExact4:'0.0000'}));
 const mixed=structuredClone(legacy);mixed.payments=[c.payments[0]];assert.throws(()=>paymentContext(mixed));
});

test('supplier payment controller renders valid Goal8 history without writes and still hides denied personnel',async()=>{
 const {createWorkSupplierPayments}=await controller(),c=goal8Context(),d=dom(),calls=[];
 const ui=createWorkSupplierPayments({root:d.root,session:{inbound:async()=>receiving(),supplierPayments:async(path,options)=>{calls.push({path,options});assert.equal(options,undefined);return c;}},user:{id:16},storage:storage(),apiBase});
 ui.mount();await tick();d.node('[data-sp-supplier]').onchange({target:{value:'13370'}});
 assert.match(d.root.innerHTML,/OD-701/);assert.match(d.root.innerHTML,/TSTB-G8-FIXTURE/);assert.doesNotMatch(d.root.innerHTML,/Ödeme bilgileri doğrulanamadı/);
 assert.equal(calls.length,1);ui.refresh();await tick();assert.match(d.root.innerHTML,/OD-701/);assert.equal(calls.length,2);ui.dispose();
 const denied=dom();let reads=0;
 const blocked=createWorkSupplierPayments({root:denied.root,session:{inbound:async()=>receiving(false),supplierPayments:async()=>{reads++;return c;}},user:{id:15},storage:storage(),apiBase});
 blocked.mount();await tick();assert.equal(reads,0);assert.match(denied.root.innerHTML,/yetkiniz yok/);blocked.dispose();
});

test('normal supplier history renders the same Goal8 DTO and refresh remains read-only',async()=>{
 let source=await readFile(new URL('./workSuppliers.js',import.meta.url),'utf8');
 source=source.replace(/import '\.\/[^']+\.css';/g,'').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,import.meta.url).href));
 const {createWorkSuppliers}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),d=dom(),c=goal8Context(),calls=[];
 const ui=createWorkSuppliers({root:d.root,session:{supplierPayments:async(path,options)=>{calls.push({path,options});assert.equal(options,undefined);return c;}},user:{id:16,permissions:['finance.view','supplier.view']}});
 ui.mount();await tick();assert.match(d.root.innerHTML,/Ödeme ve borç geçmişi/);assert.match(d.root.innerHTML,/OD-701/);assert.match(d.root.innerHTML,/TSTB-G8-FIXTURE/);assert.doesNotMatch(d.root.innerHTML,/Ödeme geçmişi şu anda açılamıyor/);
 ui.refresh();await tick();assert.equal(calls.length,2);assert.match(d.root.innerHTML,/OD-701/);ui.dispose();
});

test('supplier history with no invoice still opens and retains existing payment rows on refresh',async()=>{
 let source=await readFile(new URL('./workSuppliers.js',import.meta.url),'utf8');
 source=source.replace(/import '\.\/[^']+\.css';/g,'').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,import.meta.url).href));
 const {createWorkSuppliers}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),d=dom(),c=goal8Context(),calls=[];
 c.suppliers[0].invoices=[];Object.assign(c.payments[0],{invoiceId:null,receiptId:null,receiptKind:null,invoiceNumber:null});
 assert.equal(paymentContext(c),c);
 const ui=createWorkSuppliers({root:d.root,session:{supplierPayments:async(path,options)=>{calls.push({path,options});assert.equal(options,undefined);return c;}},user:{id:16,permissions:['finance.view','supplier.view']}});
 ui.mount();await tick();assert.match(d.root.innerHTML,/Henüz bağlı alış faturası yok/);assert.match(d.root.innerHTML,/OD-701/);assert.match(d.root.innerHTML,/Ödemeler ve ters kayıtlar/);assert.doesNotMatch(d.root.innerHTML,/Ödeme geçmişi şu anda açılamıyor|Alış faturası undefined/);
 ui.refresh();await tick();assert.equal(calls.length,2);assert.match(d.root.innerHTML,/OD-701/);ui.dispose();
});
function cleanFinanceContext(){
 const c=context();Object.assign(c.meta,{date:'2026-10-22',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67'});
 c.suppliers=[{...c.suppliers[0],id:'1',currency:'TRY',balanceExact4:'120.0000',invoices:[{...c.suppliers[0].invoices[0],id:'4',receiptId:'3',receiptKind:'work-clean-store-day-receipt',documentDate:'2026-10-22',documentCurrency:'TRY',documentAmountExact4:'120.0000',accountAmountExact4:'120.0000',remainingExact4:'120.0000'}]}];
 c.accounts=[{...c.accounts[0],id:'1',openingBalanceExact4:'0.0000',balanceExact4:'376.5000'}];c.rates=[];
 return c;
}

test('B4 keeps the original paid source alongside one separately identified partial payment case',()=>{
 const c=cleanFinanceContext();c.meta.financeCase='B4-TRY-20261023';
 c.suppliers.push({...c.suppliers[0],id:'2',balanceExact4:'200.0000',invoices:[{...c.suppliers[0].invoices[0],id:'5',receiptId:null,receiptKind:null,documentAmountExact4:'200.0000',accountAmountExact4:'200.0000',remainingExact4:'200.0000'}]});
 c.accounts.push({...c.accounts[0],id:'2',balanceExact4:'100.0000'});
 assert.equal(paymentContext(c),c);
 const selection={supplierId:'2',invoiceId:'5',accountId:'2',currency:'TRY',amountExact4:'80.0000',documentDate:'2026-10-22',description:'Kısmi örnek ödeme'};
 const p=supplierPaymentPreview(selection,c);assert.equal(p.balanceAfterExact4,'120.0000');assert.equal(p.accountBalanceAfterExact4,'20.0000');
 assert.throws(()=>supplierPaymentPreview({...selection,accountId:'1'},c),{code:'WORK_PAYMENT_SCOPE'});
 for(const change of [v=>delete v.meta.financeCase,v=>v.accounts[1].id='3',v=>v.suppliers[1].invoices[0].id='6',v=>v.suppliers[1].invoices[0].receiptId='3',v=>v.suppliers[1].currency='USD']){const bad=structuredClone(c);change(bad);assert.throws(()=>paymentContext(bad));}
 const journal=createPaymentJournal({storage:storage(),actorId:'23',apiBase:'http://127.0.0.1:4194',location:{protocol:'http:',hostname:'127.0.0.1',port:'5244'},makeUuid:()=>requestId});assert.equal(journal.read().request,null);
});
test('B4 FX payment screen accepts only the exact native currency/document/drawer/rate tuples and preserves TRY',()=>{
 const c=cleanFinanceContext();c.meta.financeCase='B4-TRY-20261023';c.meta.financeFxCases=CLEAN_FINANCE_FX_CASES.map(p=>p.id);
 c.suppliers.push({...c.suppliers[0],id:'2',balanceExact4:'200.0000',invoices:[{...c.suppliers[0].invoices[0],id:'5',receiptId:null,receiptKind:null,documentAmountExact4:'200.0000',accountAmountExact4:'200.0000',remainingExact4:'200.0000'}]});c.accounts.push({...c.accounts[0],id:'2',balanceExact4:'131.0000'});
 for(const p of CLEAN_FINANCE_FX_CASES){
  c.suppliers.push({...c.suppliers[0],id:p.supplierId,currency:p.currency,balanceExact4:'200.0000',invoices:[{...c.suppliers[1].invoices[0],id:p.purchaseInvoiceId,number:p.purchaseNumber,documentCurrency:p.currency,accountCurrency:p.currency}]});
  c.accounts.push({...c.accounts[0],id:p.accountId,currency:p.currency,balanceExact4:'180.0000'});c.rates.push({id:p.fxFixtureId,currency:p.currency,rateToTryExact8:p.rateExact8,date:p.date,caseId:p.id,source:'explicit-synthetic-B4-input'});
 }
 assert.equal(paymentContext(c),c);
 for(const p of CLEAN_FINANCE_FX_CASES){const selection={supplierId:p.supplierId,invoiceId:p.purchaseInvoiceId,accountId:p.accountId,currency:p.currency,amountExact4:'80.0000',documentDate:p.date,description:'Yapay döviz kısmi ödeme'},preview=supplierPaymentPreview(selection,c);assert.equal(paymentPreview(preview,selection,c),preview);assert.equal(preview.balanceAfterExact4,'120.0000');assert.equal(preview.accountBalanceAfterExact4,'100.0000');assert.equal(preview.settlement.amountTryExact4,p.currency==='USD'?'3200.0000':'3600.0000');}
 for(const change of [v=>delete v.meta.financeFxCases,v=>v.meta.financeFxCases.reverse(),v=>v.accounts[2].id='6',v=>v.suppliers[2].invoices[0].id='5',v=>v.suppliers[3].currency='TRY',v=>v.rates[0].rateToTryExact8='45.00000000',v=>v.rates[0].source='market']){const bad=structuredClone(c);change(bad);assert.throws(()=>paymentContext(bad));}
});

test('clean store day retains the actual receipt3 purchase4 link without relabelling legacy receipts',()=>{
 const c=cleanFinanceContext();assert.equal(paymentContext(c),c);
 const p=supplierPaymentPreview({supplierId:'1',invoiceId:'4',accountId:'1',currency:'TRY',amountExact4:'120.0000',documentDate:'2026-10-22',description:'Örnek alış ödemesi'},c);
 assert.equal(p.balanceAfterExact4,'0.0000');assert.equal(p.accountBalanceAfterExact4,'256.5000');
 for(const mutate of [v=>v.meta.environmentId='other',v=>v.suppliers[0].invoices[0].id='5',v=>v.suppliers[0].invoices[0].receiptId='2',v=>v.suppliers[0].invoices[0].receiptKind='work-finops-physical-receipt']){
  const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>paymentContext(invalid));
 }
});

test('clean payment journal is bound to actor20 and exact loopback5244 to4194; old endpoints retain old behavior',()=>{
 const location={protocol:'http:',hostname:'127.0.0.1',port:'5244'},base={storage:storage(),actorId:'20',apiBase:'http://127.0.0.1:4194',location,makeUuid:()=>requestId};
 const journal=createPaymentJournal(base);const pending=journal.begin('/api/work-supplier-payments/payments',{amountExact4:'120.0000'});assert.equal(journal.read().request.body.requestId,pending.body.requestId);
 for(const patch of [{actorId:'16'},{actorId:'19'},{apiBase:'http://127.0.0.1:4196'},{location:{...location,port:'5234'}},{location:{...location,hostname:'192.168.1.46'}}])assert.throws(()=>createPaymentJournal({...base,...patch}));
 assert.doesNotThrow(()=>createPaymentJournal({storage:storage(),actorId:'16',apiBase}));
});

test('normal clean finance screen loads its own authorized context and refresh without requiring warehouse permission',async()=>{
 const {createWorkSupplierPayments}=await controller(),d=dom(),calls=[],c=cleanFinanceContext();
 const ui=createWorkSupplierPayments({root:d.root,user:{id:20},apiBase:'http://127.0.0.1:4194',location:{protocol:'http:',hostname:'127.0.0.1',port:'5244'},storage:storage(),session:{
  inbound:async()=>assert.fail('Finance actor must not be routed through warehouse permissions'),
  supplierPayments:async(path,options)=>{assert.equal(options,undefined);calls.push(path);return c;},
 }});
 ui.mount();await tick();assert.deepEqual(calls,['/api/work-supplier-payments/context']);assert.doesNotMatch(d.root.innerHTML,/Ödeme bağlantısı doğrulanamadı/);
 d.node('[data-sp-supplier]').onchange({target:{value:'1'}});assert.match(d.root.innerHTML,/120,00/);
 ui.refresh();await tick();assert.equal(calls.length,2);assert.equal(ui.requestClose(),true);ui.dispose();
});
