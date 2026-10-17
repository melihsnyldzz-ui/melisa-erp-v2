import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as cashMoney from './cashReadMoney.js';
const {transformSync}=createRequire(import.meta.url)('esbuild');
function harness(){
 let slots=[],cursor=0,effects=[],tree;const pending=[],writes=[];
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'fragment',
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial}},useMemo(fn){return fn()},useEffect(fn){if(effects)effects.push(fn)}};
 const code=transformSync(readFileSync(new URL('./CashRegisterScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,Intl,Date,require:spec=>spec==='react'?react:
  spec==='lucide-react'?new Proxy({},{get:()=>()=>null}):spec.endsWith('financeApi.js')?{
   fetchCashRegister:q=>new Promise((resolve,reject)=>pending.push({q,resolve,reject})),
   ...Object.fromEntries(['closeCashRegister','createCashExpense','createCashTransfer','openCashRegister'].map(k=>[k,()=>writes.push(k)]))}:
  spec.endsWith('cashReadMoney.js')?cashMoney:spec.endsWith('cashRegisterDate.js')?{businessDateInIstanbul:()=> '2026-09-24'}:
  {resolveCashRegisterCapabilities:()=>({canOpenOrClose:true,canRecordExpenseOrTransfer:true,isReadOnly:false})}});
 const render=()=>{cursor=0;tree=module.exports.CashRegisterScreen({});return tree};
 const nodes=(t=tree)=>t==null||typeof t==='boolean'?[]:Array.isArray(t)?t.flatMap(nodes):typeof t==='object'?[t,...nodes(typeof t.type==='function'?t.type(t.props):t.props?.children)]:[];
 const text=t=>t==null||typeof t==='boolean'?'':Array.isArray(t)?t.map(text).join(' '):typeof t==='object'?text(typeof t.type==='function'?t.type(t.props):t.props?.children):String(t);
 render();const initial=effects;effects=null;const cleanup=initial.map(fn=>fn()).filter(Boolean);
 return {pending,writes,render,nodes,cleanup:()=>cleanup.forEach(fn=>fn()),text:()=>text(tree),
  refresh:()=>nodes().find(n=>n.type==='button'&&text(n).includes('Yenile')).props.onClick(),
  date:value=>{nodes().find(n=>n.type==='input'&&n.props.type==='date').props.onChange({target:{value}});render()},
  async settle(){for(let i=0;i<8;i++)await Promise.resolve();render()}};
}
const data=(id=1)=>({drawers:[{id:1}],categories:[],session:{id,drawerId:1,status:'open'},currencies:[{currency:'TRY',expected:0,physicalOpening:0}],movements:[]});
test('cash display totals preserve precision and round only rendered cents',()=>{
 const total=cashMoney.sumCashAmounts(['12345678901234.1234','0.0001']);
 assert.equal(total,'12345678901234.12350000');
 assert.equal(cashMoney.formatCashMoney(total,'TRY'),'₺12.345.678.901.234,12');
 assert.equal(cashMoney.sumCashAmounts(['1',null]),null);
 assert.equal(cashMoney.formatCashMoney(null,'TRY'),'Doğrulanmadı');
 assert.equal(cashMoney.formatCashMoney('0.00000000','TRY'),'₺0,00');
});
test('cash screen ignores old success/error after date selection and unmount; only current read exposes forms',async()=>{
 for(const reject of [false,true]){
  const h=harness();h.date('2026-09-23');h.refresh();
  assert.equal(h.pending[1].q.businessDate,'2026-09-23');
  h.pending[1].resolve({data:data(2)});await h.settle();assert.match(h.text(),/Kasa Açık/);
  if(reject)h.pending[0].reject(Error('OLD_ERROR'));else h.pending[0].resolve({data:{...data(),session:null}});
  await h.settle();assert.match(h.text(),/Kasa Açık/);assert.doesNotMatch(h.text(),/OLD_ERROR|Sabah Sayımı/);
  h.date('2026-09-22');assert.match(h.text(),/durumu doğrulanmadı/);assert.equal(h.nodes().filter(n=>n.type==='form').length,0);assert.deepEqual(h.writes,[]);
 }
 const h=harness();h.cleanup();h.pending[0].resolve({data:data()});await h.settle();assert.doesNotMatch(h.text(),/Kasa Açık/);
});
test('cash response error or missing data cannot mean no session; missing currency amount cannot become zero',async()=>{
 for(const result of [null,{}]){const h=harness();h.pending[0].resolve({data:result});await h.settle();assert.match(h.text(),/CASH_RESPONSE_INVALID/);assert.doesNotMatch(h.text(),/Kasa Açılmadı|Kasayı Aç/)}
 const h=harness();h.pending[0].resolve({data:data()});await h.settle();assert.match(h.text(),/Doğrulanmadı/);assert.match(h.text(),/₺0,00/);
 h.refresh();h.pending[1].reject(Error('NETWORK_ERROR'));await h.settle();assert.match(h.text(),/NETWORK_ERROR/);assert.doesNotMatch(h.text(),/Kasa Açılmadı|Günlük Nakit Hareketleri/);
});

