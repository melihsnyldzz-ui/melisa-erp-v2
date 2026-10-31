import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as journalModel from './workTradeModel.mjs';
import * as cleanModel from './cleanSyntheticCatalogModel.mjs';
const {transformSync}=createRequire(import.meta.url)('esbuild');
const id='90b71867-7272-4d73-98b0-e5f295d4cd68',date='2026-10-22',base='/api/finance/cash-register';
const location={protocol:'http:',hostname:'127.0.0.1',host:'127.0.0.1:5244',port:'5244'};
const user={id:20,permissions:['finance.view','finance.collection','finance.payment']};
const storage=()=>{const data=new Map();return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const overview=()=>({revision:'a'.repeat(64),meta:{environment:'CLEAN_SYNTHETIC_TEST',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67',synthetic:true,actualT1:false,externalOperations:false,profile:'B4-CASH-20261023',date},capabilities:{canOpenOrClose:true,canRecordExpenseOrTransfer:true},accounts:[[2,'TRY','drawer'],[3,'USD','drawer'],[4,'EUR','drawer'],[5,'TRY','main'],[6,'USD','main'],[7,'EUR','main']].map(([id,currency,kind])=>({id,currency,kind,balanceExact4:'0.0000'}))});
function harness({store=storage(),work,place=location}={}){
 let props;const module={exports:{}};
 const code=transformSync(readFileSync(new URL('./workCash.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code;
 vm.runInNewContext(code,{module,exports:module.exports,structuredClone,URL,Set,Map,require:spec=>spec==='react'?{createElement:(_type,p)=>p}:spec==='react-dom/client'?{createRoot:()=>({render:p=>{props=p;},unmount(){}})}:spec.endsWith('workTradeModel.mjs')?journalModel:spec.endsWith('cleanSyntheticCatalogModel.mjs')?cleanModel:{CashRegisterScreen:()=>null}});
 const ui=module.exports.createWorkCash({root:{},session:{cash:work},user,storage:store,location:place,uuid:()=>id});
 return {ui,store,api(){return props.api;}};
}
const opening={drawerId:1,businessDate:date,openingNote:'Örnek açılış',counts:Object.fromEntries(['TRY','USD','EUR'].map(c=>[c,{physicalOpening:0,openingTransfer:10}]))};

test('cash UI retries a lost response with the same durable UUID and body after reopening, never a new command',async()=>{
 const store=storage(),writes=[];let lose=true;
 const work=async(path,options)=>{
  if(!options)return overview();writes.push({path,body:JSON.parse(JSON.stringify(options.body))});
  if(lose){lose=false;throw Error('Lost response');}return {requestId:id,replayed:true};
 };
 const first=harness({store,work});first.ui.mount();await first.api().fetchCashRegister({businessDate:date});
 await assert.rejects(first.api().openCashRegister(opening),/Lost response/);assert.equal(first.ui.requestClose(),false);
 await assert.rejects(first.api().createCashExpense({sessionId:1}),/son kasa işlemini/);assert.equal(writes.length,1);first.ui.dispose();
 const next=harness({store,work});next.ui.mount();await next.api().fetchCashRegister({businessDate:date});
 assert.deepEqual(writes[1],writes[0]);assert.equal(writes.length,2);assert.equal(writes[0].body.requestId,id);assert.equal(next.ui.requestClose(),true);next.ui.dispose();
});

test('cash UI cannot send a command when the journal cannot persist, and a mismatched receipt keeps the command pending',async()=>{
 const store=storage();let writes=0;
 const h=harness({store,work:async(_path,o)=>{if(!o)return overview();writes++;return {requestId:'different',replayed:false};}});h.ui.mount();await h.api().fetchCashRegister({businessDate:date});
 const save=store.setItem;store.setItem=()=>{throw Error('storage unavailable');};
 await assert.rejects(h.api().openCashRegister(opening),/saklanamadı/);assert.equal(writes,0);store.setItem=save;
 await assert.rejects(h.api().openCashRegister(opening),/sonucu doğrulanamadı/);assert.equal(writes,1);assert.equal(h.ui.requestClose(),false);h.ui.dispose();
});

test('cash scope rejects wrong target, currency mapping, T1 and unknown balances before enabling a command',async()=>{
 const wrong=harness({place:{...location,port:'5194'}});assert.throws(()=>wrong.ui.mount(),/bağlantısı/);
 for(const mutate of [v=>{v.meta.actualT1=true;},v=>{v.accounts[0].currency='USD';},v=>{v.accounts[1].balanceExact4=null;},v=>{v.revision='';}]){
  const data=overview();mutate(data);let writes=0;const h=harness({work:async(_path,options)=>{if(options)writes++;return data;}});h.ui.mount();
  await assert.rejects(h.api().fetchCashRegister({businessDate:date}));await assert.rejects(h.api().openCashRegister(opening));assert.equal(writes,0);h.ui.dispose();
 }
});

test('cash definite fresh conflict can unlock; a denied unknown-outcome retry remains pending',async()=>{
 for(const fresh of [true,false]){
  const store=storage();if(!fresh)journalModel.createTradeJournal({storage:store,key:'melisa-work-cash-v1:'+location.host+':20'}).begin(base+'/open',{...opening,requestId:id,expectedRevision:'a'.repeat(64)});
  const h=harness({store,work:async(_path,o)=>{if(o)throw Object.assign(Error('Conflict'),{status:409});return overview();}});h.ui.mount();
  if(fresh){await h.api().fetchCashRegister({businessDate:date});await assert.rejects(h.api().openCashRegister(opening));}else await assert.rejects(h.api().fetchCashRegister({businessDate:date}));
  assert.equal(h.ui.requestClose(),fresh);h.ui.dispose();
 }
});
