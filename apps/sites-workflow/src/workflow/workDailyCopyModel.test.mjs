import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCopyContext,dailyCopyCountLines} from './workDailyCopyModel.mjs';
import {testDaily} from './testDaily.js';
import {dailyDraftCanReverse} from './dailyReversalModel.mjs';

const location={protocol:'http:',hostname:'127.0.0.1',port:'5204'};
const copyId='00000000-0000-4000-8000-000000000001',sealHash='A'.repeat(64),fingerprint='b'.repeat(64);
function profile(){return{schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:'ISOLATED_TEST_COPY',copyId,sealHash,backupSHA:'C'.repeat(64),date:'2026-10-08',sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01'},actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:['301','302'].map(id=>({id,sourceKey:['VEGA2026','F0102TBLSTOKLAR',''].join('/')+id,stockCode:'K-'+id,unit:'ADET',unitFactorExact8:'1.00000000',priceIds:['8'+id],barcodes:['000'+id]})),customers:[{id:'501',partyId:'901',accountId:'1001',currency:'TRY',sourceKey:['VEGA2026','F0102TBLCARI','501'].join('/')}],suppliers:[{id:'601',partyId:'902',accountId:'1002',currency:'TRY',sourceKey:['VEGA2026','F0103TBLCARI','601'].join('/')}],financeAccounts:[{id:'701',currency:'TRY'}]};}
function data(){return{meta:{date:'2026-10-08',operationOrigin:'ISOLATED_TEST_COPY',copyId,sealHash},operationOrigin:'ISOLATED_TEST_COPY',scope:{flow:'count',product_id:301,stock_code:'K-301',current_stock_qty:153},countProducts:profile().products.map(p=>({id:p.id,stockCode:p.stockCode,name:'Ürün '+p.id,unit:'ADET',stockQuantity:153,barcode:p.barcodes[0],movementFingerprint:fingerprint})),drafts:[],items:[],source:null,party:null,accounts:[],availablePurchaseSources:[]};}
const options=()=>({profile:profile(),location});
const line=(physical=153)=>({productId:'301',stockCode:'K-301',physical,system:153,reason:'Raf tekrar sayıldı',movementFingerprint:fingerprint});

test('copied native stock153 is allowed; rehearsal applies to difference5 rather than an absolute30/40 fixture limit',()=>{
 const d=data(),p=dailyCopyContext(d,'count',options()),before=JSON.stringify(d);
 for(const physical of [148,153,158]){const lines=[line(physical)];assert.equal(dailyCopyCountLines(lines,d,p),lines);}
 for(const physical of [147,159,-1,153.5,NaN,Infinity])assert.throws(()=>dailyCopyCountLines([line(physical)],d,p));
 assert.equal(JSON.stringify(d),before);
});
test('copy DTO rejects foreign units, selectedIDs, barcodes, duplicate identities and unknown/missing trusted scope',()=>{
 for(const mutate of [d=>d.countProducts[0].id='999',d=>d.countProducts[0].stockCode='FOREIGN',d=>d.countProducts[0].unit='KOLİ',d=>d.countProducts[0].barcode='999',d=>d.countProducts[0].stockQuantity=-1,d=>d.countProducts[0].movementFingerprint='unknown',d=>d.countProducts[1]=d.countProducts[0],d=>d.meta.sealHash='D'.repeat(64),d=>delete d.meta,d=>d.operationOrigin='OTHER',d=>d.scope.product_id=999]){const d=data();mutate(d);assert.throws(()=>dailyCopyContext(d,'count',options()));}
 assert.throws(()=>dailyCopyContext(data(),'count',{...options(),location:{...location,port:'5194'}}));
 assert.throws(()=>dailyCopyContext(data(),'count',{...options(),profile:null}));
});
test('copy count request requires unchanged live stock fingerprint and selected exact identity, with a real discrepancy reason',()=>{
 const d=data(),p=dailyCopyContext(d,'count',options());
 for(const patch of [{productId:'999'},{stockCode:'FOREIGN'},{system:152},{movementFingerprint:'d'.repeat(64)},{physical:154,reason:'ab'}])assert.throws(()=>dailyCopyCountLines([{...line(),...patch}],d,p));
 assert.throws(()=>dailyCopyCountLines([line(),line()],d,p));
 assert.throws(()=>dailyCopyCountLines([],d,p));
 assert.equal(dailyCopyCountLines([line(153)],d,p)[0].physical,153);
});
test('original synthetic contracts are passed through without enabling copy rules or changing saved drafts',()=>{
 const d={scope:{flow:'count'},drafts:[{id:1}]},before=structuredClone(d);
 const p=dailyCopyContext(d,'count',{location:{...location,port:'5194'}}),lines=[{physical:30,system:40}];
 assert.equal(p,null);assert.equal(dailyCopyCountLines(lines,d,p),lines);assert.deepEqual(d,before);
});
test('normal green count view renders copied stock153 read-only with no API or automatic write',()=>{
 const saved={window:globalThis.window,localStorage:globalThis.localStorage};const values=new Map();let calls=0;
 globalThis.window={location,__MELISA_OPERATION_COPY__:profile()};globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 try{const d=data(),before=JSON.stringify(d),ui=testDaily({api:async()=>{calls++;},user:{id:15,displayName:'Satış ekibi',permissions:['product.view']},data:d,flow:'count',refresh:async()=>{},esc:String,normalScreen:true});const html=ui.html();assert.match(html,/Sayım/);assert.match(html,/153 adet/);assert.equal(calls,0);assert.equal(values.size,0);assert.equal(JSON.stringify(d),before);}
 finally{for(const[key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('only a verified copy single-line native count result exposes inverse; original batch, foreign result and multiple lines stay closed',()=>{
 const p=profile(),row={state:'approved',kind:'count',created_by:15,payload:{lines:[line(154)]},result:{lines:[{productId:301,difference:1,movementCreated:true,movementId:81}]}};
 assert.equal(dailyDraftCanReverse(row,p),true);assert.equal(dailyDraftCanReverse(row),false);
 for(const change of [r=>r.payload.lines.push(line(154)),r=>r.result.lines.push(r.result.lines[0]),r=>r.created_by=1,r=>r.payload.lines[0].productId='999',r=>r.payload.lines[0].stockCode='FOREIGN',r=>r.result.lines[0].productId=302,r=>r.result.lines[0].difference=2,r=>r.result.lines[0].movementId=null,r=>r.result.lines[0].movementCreated=false,r=>r.state='pending']){const r=structuredClone(row);change(r);assert.equal(dailyDraftCanReverse(r,p),false);}
 const unchanged=structuredClone(row);unchanged.payload.lines[0]=line(153);unchanged.result.lines[0]={productId:301,difference:0,movementCreated:false};assert.equal(dailyDraftCanReverse(unchanged,p),true);
});

test('normal copy count inverse posts the sealed8Oct date on9Oct; original keeps todays date and invalid copy never sends',async()=>{
 const keys=['window','document','localStorage','FormData','Date'],saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),NativeDate=globalThis.Date;
 globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-09T10:00:00Z']));}};
 try{for(const copied of [true,false]){
  const d=data();if(!copied){delete d.meta;delete d.operationOrigin;}
  const payload=copied?{lines:[line(154)]}:{physical:154,system:153},result=copied?{lines:[{productId:301,difference:1,movementCreated:true,movementId:81}]}:{movementCreated:true,movementId:81};
  d.drafts=[{id:8,kind:'count',state:'approved',created_by:15,payload_json:JSON.stringify(payload),result_json:JSON.stringify(result)}];
  const values=new Map(),calls=[],button={dataset:{dailyAction:'cancel',id:'8'}},modal={innerHTML:''},form={},status={textContent:'',setAttribute(){}},back={style:{}},close={};
  globalThis.window={location:{...location,port:copied?'5204':'5194'},__MELISA_OPERATION_COPY__:profile()};globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};globalThis.document={getElementById:id=>({modal,'demo-form':form,'demo-error':status,'daily-status':status,modalback:back,'daily-close':close})[id],querySelectorAll:q=>q==='[data-daily-action]'?[button]:[]};globalThis.FormData=class{constructor(){return [['reason','Hatalı sayım geri alınacak']];}};
  const options={api:async(path,o)=>{calls.push({path,...o});return {id:8};},user:{id:16,displayName:'İlker',permissions:['product.view','stock.adjust']},data:d,flow:'count',refresh:async()=>{},esc:String,normalScreen:true};
  const ui=testDaily(options);assert.match(ui.html(),/Ters kayıtla iptal et/);ui.bind();button.onclick();form.onsubmit({preventDefault(){},target:form});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/test-daily/count/cancel');assert.equal(calls[0].body.date,copied?'2026-10-08':'2026-10-09');assert.equal(calls[0].body.id,8);assert.equal(calls[0].body.reason,'Hatalı sayım geri alınacak');
  if(copied)for(const change of [x=>x.meta.date='2026-10-09',x=>x.meta.date=null,x=>delete x.meta]){const invalid=structuredClone(d);change(invalid);assert.throws(()=>testDaily({...options,data:invalid}));assert.equal(calls.length,1);}
 }}finally{for(const[key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('normal copy returns use two-decimal user text and disable unsupported uninvoiced flow; lab and original text stay intact',()=>{
 const saved=Object.fromEntries(['window','document','localStorage','sessionStorage'].map(k=>[k,globalThis[k]]));let formReads=0,calls=0;const notices=[];
 try{
  const d=data();d.scope.flow='purchase';d.party={name:'Tedarikçi',balance:1.234567,currency_code:'TRY'};d.availablePurchaseSources=[{id:9,document_no:'ALIS-9',document_currency:'TRY',supplierName:'Tedarikçi',supplierBalance:1.234567,supplierCurrency:'TRY',items:[{id:91,stock_code:'K-301',product_name:'Ürün',quantity:1,line_total:100.123456,returnableQuantity:1,pendingQuantity:0,returnedQuantity:0,current_stock_qty:153}]}];
  const button={dataset:{dailyAction:'uninvoiced-return'}},opts={api:async()=>{calls++;},user:{id:16,displayName:'İlker',permissions:['purchase.view','purchase.cancel']},data:d,flow:'purchase',refresh:async()=>{},esc:String,normalScreen:true};
  globalThis.window={location,__MELISA_OPERATION_COPY__:profile(),toast:m=>notices.push(m)};globalThis.localStorage={getItem:()=>null};globalThis.sessionStorage={getItem:()=>null};globalThis.document={getElementById(){formReads++;},querySelectorAll:q=>q==='[data-daily-action]'?[button]:[]};
  const before=JSON.stringify(d),ui=testDaily(opts),html=ui.html();assert.doesNotMatch(html,/TEST SQL/);assert.match(html,/Faturalar, onaylı iadeler ve ödemeler/);assert.match(html,/100,12 TRY/);assert.doesNotMatch(html,/100,1235/);assert.match(html,/data-daily-action="uninvoiced-return"[^>]*disabled/);assert.match(html,/Faturasız iade bu işlem kapsamında henüz açık değil/);ui.bind();button.onclick();assert.equal(formReads,0);assert.equal(calls,0);assert.equal(notices.length,1);assert.equal(JSON.stringify(d),before);
  const lab=testDaily({...opts,normalScreen:false}).html();assert.match(lab,/TEST SQL/);assert.match(lab,/100,1235 TRY/);
  globalThis.window={location:{...location,port:'5194'}};const original=structuredClone(d);delete original.meta;delete original.operationOrigin;const old=testDaily({...opts,data:original}).html();assert.match(old,/TEST SQL/);assert.doesNotMatch(old,/data-daily-action="uninvoiced-return"[^>]*disabled/);
 }finally{for(const[key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
