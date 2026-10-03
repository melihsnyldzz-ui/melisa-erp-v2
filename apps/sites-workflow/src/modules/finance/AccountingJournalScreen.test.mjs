import * as money from './cashReadMoney.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {transformSync}=createRequire(import.meta.url)('esbuild');
function harness(){
 let slots=[],cursor=0,effect,tree;const pending=[],exports=[];
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'fragment',
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
  useRef(initial){const i=cursor++;return slots[i]??= {current:initial}},useMemo(fn){return fn()},useEffect(fn){effect??=fn}};
 const request=params=>new Promise((resolve,reject)=>pending.push({resolve:value=>resolve(params&&value?.data
  ?{...value,data:{...params,...value.data}}:value),reject}));
 const code=transformSync(readFileSync(new URL('./AccountingJournalScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,Intl,Date,require:spec=>spec==='react'?react:
  spec.endsWith('financeApi.js')?{fetchFinanceJournal:request}:
  spec.endsWith('cashReadMoney.js')?money:
  spec.endsWith('ledgerNavigation.js')?{ledgerTargetActionLabel:()=>'',openLedgerTarget:()=>{}}:
  {exportRowsToExcel:r=>exports.push(r),printRowsReport:r=>exports.push(r)}});
 const render=()=>{cursor=0;tree=module.exports.AccountingJournalScreen({});return tree};
 const nodes=(t=tree)=>t==null||typeof t==='boolean'?[]:Array.isArray(t)?t.flatMap(child=>nodes(child??null)):typeof t==='object'?
  [t,...nodes((typeof t.type==='function'?t.type(t.props):t.props?.children)??null)]:[];
 const text=t=>t==null||typeof t==='boolean'?'':Array.isArray(t)?t.map(text).join(' '):typeof t==='object'?
  text(typeof t.type==='function'?t.type(t.props):t.props?.children):String(t);
 render();const cleanup=effect();
 return {pending,exports,cleanup,render,text:()=>text(tree),nodes,
  button:label=>nodes().find(n=>n.type==='button'&&text(n)===label),
  async settle(){for(let i=0;i<8;i++)await Promise.resolve();render()}};
}

const data=amount=>({rows:[],summary:{byCurrency:[{currency:'USD',debit:amount,credit:amount}],balanced:true,debit:999999,credit:999999}});
test('actual journal component uses currency DTO and never claims synthesized pairs prove accounting balance',async()=>{
 const h=harness();assert.equal(h.button('Excel').props.disabled,true);
 h.pending[0].resolve({data:data('12345678901234.1234')});await h.settle();
 assert.match(h.text(),/12\.345\.678\.901\.234,12/);assert.match(h.text(),/Doğrulanmadı/);
 assert.doesNotMatch(h.text(),/999\.999|Borç\/alacak dengeli|Canlı SQL/);
 h.button('Yazdır').props.onClick();assert.match(h.exports[0].subtitle,/mutabakatı doğrulanmadı/);
});
test('actual journal effect ignores old results/errors, rejects missing DTO and stops failed export',async()=>{
 for(const reject of [false,true]){
  const h=harness();h.button('Yenile').props.onClick();h.pending[1].resolve({data:data('222')});await h.settle();
  if(reject)h.pending[0].reject(Error('OLD_ERROR'));else h.pending[0].resolve({data:data('999')});await h.settle();
  assert.match(h.text(),/222/);assert.doesNotMatch(h.text(),/999|OLD_ERROR/);
 }
 const h=harness();h.pending[0].resolve({data:{rows:[]}});await h.settle();
 assert.match(h.text(),/kapsamı doğrulanamadı/);assert.equal(h.button('Excel').props.disabled,true);
 h.button('Excel').props.onClick();assert.equal(h.exports.length,0);
 const gone=harness();gone.cleanup();gone.pending[0].resolve({data:data('999')});await gone.settle();assert.doesNotMatch(gone.text(),/999/);
});


