import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCopyContext,dailyCopyCountLines} from './workDailyCopyModel.mjs';
import {testDaily} from './testDaily.js';

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
