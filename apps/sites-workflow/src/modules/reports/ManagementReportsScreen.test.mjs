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
 const code=transformSync(readFileSync(new URL('./ManagementReportsScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,Intl,Date,require:spec=>spec==='react'?react:
  spec.endsWith('dashboardApi.js')?{fetchManagementReporting:request,fetchPeriodicAccounting:request}:
  {exportRowsToExcel:r=>exports.push(r),printRowsReport:r=>exports.push(r)}});
 const render=()=>{cursor=0;tree=module.exports.ManagementReportsScreen();return tree};
 const nodes=(t=tree)=>t==null||typeof t==='boolean'?[]:Array.isArray(t)?t.flatMap(child=>nodes(child??null)):typeof t==='object'?
  [t,...nodes((typeof t.type==='function'?t.type(t.props):t.props?.children)??null)]:[];
 const text=t=>t==null||typeof t==='boolean'?'':Array.isArray(t)?t.map(text).join(' '):typeof t==='object'?
  text(typeof t.type==='function'?t.type(t.props):t.props?.children):String(t);
 render();const cleanup=effect();
 return {pending,exports,cleanup,render,text:()=>text(tree),nodes,
  button:label=>nodes().find(n=>n.type==='button'&&text(n)===label),
  async settle(){for(let i=0;i<8;i++)await Promise.resolve();render()}};
}
test('actual report screen keeps read error/empty distinct from zero and prevents failed report export',async()=>{
 for(const empty of [false,true]){const h=harness();assert.equal(h.button('Excel').props.disabled,true);
  if(empty){h.pending[0].resolve({success:true,data:null});h.pending[1].resolve({success:true,data:{}})}else h.pending[0].reject(Error('NETWORK_ERROR'));
  await h.settle();assert.match(h.text(),empty?/yanıtı boş/:/NETWORK_ERROR/);assert.doesNotMatch(h.text(),/Bugün satış|Kritik uyarı/);
  h.button('Excel').props.onClick();assert.equal(h.exports.length,0);assert.ok(h.nodes().some(n=>n.type==='form'));
 }
 const h=harness();h.pending[0].resolve({success:true,data:{widgets:{todaySalesTry:0},criticalWarnings:[]}});h.pending[1].resolve({success:true,data:{}});
 await h.settle();assert.match(h.text(),/Bugün satış/);assert.match(h.text(),/Doğrulanmadı/);assert.equal(h.button('Excel').props.disabled,false);
});
test('actual report effects ignore stale success/error and unmount; export identifies loaded filters',async()=>{
 for(const reject of [false,true]){const h=harness();h.button('Yenile').props.onClick();
  h.pending[2].resolve({success:true,data:{widgets:{todaySalesTry:222}}});h.pending[3].resolve({success:true,data:{}});await h.settle();
  if(reject)h.pending[0].reject(Error('OLD_ERROR'));else {h.pending[0].resolve({success:true,data:{widgets:{todaySalesTry:999}}});h.pending[1].resolve({success:true,data:{}})}
  await h.settle();assert.match(h.text(),/222/);assert.doesNotMatch(h.text(),/999|OLD_ERROR/);
  const input=h.nodes().find(n=>n.type==='input');const original=input.props.value;
  input.props.onChange({target:{value:'2001-01-01'}});h.render();h.button('Excel').props.onClick();
  assert.ok(h.exports[0].filename.includes(original));assert.ok(!h.exports[0].filename.includes('2001-01-01'));
 }
 const h=harness();h.cleanup();h.pending[0].resolve({success:true,data:{widgets:{todaySalesTry:999}}});h.pending[1].resolve({success:true,data:{}});
 await h.settle();assert.doesNotMatch(h.text(),/999/);assert.equal(h.button('Excel').props.disabled,true);
});

test('management cards render separate recorded currencies and distinguish missing/empty from zero',async()=>{
 const h=harness();h.pending[0].resolve({success:true,data:{widgets:{customerBalanceTry:999999,customerBalances:[
  {currency:'USD',balance:'125.0000'},{currency:'EUR',balance:null},{currency:'TRY',balance:'0.0000'}],supplierBalances:[]}}});
 h.pending[1].resolve({success:true,data:{}});await h.settle();
 assert.match(h.text(),/125/);assert.match(h.text(),/Doğrulanmadı/);assert.match(h.text(),/Kayıt yok/);
 assert.match(h.text(),/mutabakat doğrulanmadı/);assert.doesNotMatch(h.text(),/999\.999/);
});

test('actual screen rejects a response for another period and keeps export disabled',async()=>{
 const h=harness();h.pending[0].resolve({success:true,data:{widgets:{todaySalesTry:1}}});
 h.pending[1].resolve({success:true,data:{dateFrom:'1900-01-01',dateTo:'1900-01-02'}});await h.settle();
 assert.match(h.text(),/tarih kapsamı/);assert.equal(h.button('Excel').props.disabled,true);
 h.button('Excel').props.onClick();assert.equal(h.exports.length,0);
});

test('failed response with data and malformed row collections cannot become an exportable report',async()=>{
 for(const data of [{success:false,data:{widgets:{todaySalesTry:123}}},{success:true,data:{topProducts:{}}},{success:true,data:{criticalWarnings:[null]}}]){
  const h=harness();h.pending[0].resolve(data);h.pending[1].resolve({success:true,data:{}});await h.settle();
  assert.match(h.text(),/doğrulanamadı|doğrulanmadı/);assert.equal(h.button('Excel').props.disabled,true);
  h.button('Excel').props.onClick();assert.equal(h.exports.length,0);assert.doesNotMatch(h.text(),/Bugün satış/);
 }
});

test('missing dataset differs from explicitly empty dataset in actual report panels',async()=>{
 const h=harness();h.pending[0].resolve({success:true,data:{topProducts:[]}});h.pending[1].resolve({success:true,data:{}});await h.settle();
 const panel=title=>h.nodes().find(n=>typeof n.type==='function'&&n.props.title===title&&Array.isArray(n.props.rows));
 assert.equal(panel('En Çok Satan Ürünler').props.complete,true);
 assert.equal(panel('Kritik Uyarılar').props.complete,false);
 assert.equal(panel('Günlük Kasa Raporu').props.complete,false);
 assert.match(h.text(),/Veri doğrulanmadı/);assert.match(h.text(),/kayıt yok sonucu çıkarılamaz/);assert.match(h.text(),/Kayıt yok\./);
});

test('Excel and print carry missing versus empty dataset scope inside output rows',async()=>{
 const h=harness();h.pending[0].resolve({success:true,data:{topProducts:[]}});h.pending[1].resolve({success:true,data:{}});await h.settle();
 h.button('Excel').props.onClick();h.button('Yazdır').props.onClick();assert.equal(h.exports.length,2);
 for(const output of h.exports){
  const scope=output.rows.filter(r=>r.section==='Veri kapsamı');
  assert.equal(scope.find(r=>r.metric==='En Çok Satan Ürünler').value,'Boş liste alındı');
  assert.equal(scope.find(r=>r.metric==='Günlük Kasa').value,'Doğrulanmadı');
  assert.match(scope.find(r=>r.metric==='Günlük Kasa').detail,/sıfır veya kayıt yok sonucu çıkarılamaz/);
 }
 assert.match(h.exports[0].title,/kapsamı eksik/);assert.match(h.exports[1].subtitle,/kapsamı eksik/);
});

test('captured export handlers cannot use stale data during refresh or after unmount',async()=>{
 const h=harness();h.pending[0].resolve({success:true,data:{}});h.pending[1].resolve({success:true,data:{}});await h.settle();
 const excel=h.button('Excel').props.onClick,print=h.button('Yazdır').props.onClick;
 h.button('Yenile').props.onClick();excel();print();assert.equal(h.exports.length,0);
 h.pending[2].resolve({success:true,data:{}});h.pending[3].resolve({success:true,data:{}});await h.settle();
 excel();print();assert.equal(h.exports.length,0);
 h.button('Excel').props.onClick();assert.equal(h.exports.length,1);
 const current=h.button('Yazdır').props.onClick;h.cleanup();current();assert.equal(h.exports.length,1);
});

