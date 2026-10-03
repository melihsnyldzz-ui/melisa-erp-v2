import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild'),module={exports:{}};
vm.runInNewContext(transformSync(readFileSync(new URL('./ExportCenterScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,require:()=>({})});
const fetchAllPages=module.exports.fetchAllPages;
const response=(page,total,ids,limit=2)=>({success:true,data:ids.map(id=>({id,amount:null})),meta:{page,limit,total,source:'SYNTHETIC'}});
test('actual export loader follows server-clamped page size, preserves null and does not claim snapshot consistency',async()=>{
 const calls=[],r=await fetchAllPages(async q=>{calls.push(q);return q.page===1?response(1,3,['1','2']):response(2,3,['3']);},{search:'x'});
 assert.equal(calls.length,2);assert.equal(calls[1].page,2);assert.equal(calls[0].limit,500);assert.equal(calls[1].search,'x');
 assert.equal(r.data.length,3);assert.equal(r.data[0].amount,null);assert.equal(r.meta.truncated,false);assert.equal(r.meta.snapshotVerified,false);
});
test('actual export loader distinguishes empty data from API failure and refuses partial/changing/duplicate pages',async()=>{
 assert.equal((await fetchAllPages(async()=>response(1,0,[]),{})).meta.total,0);
 for(const bad of [{success:false,data:[],meta:{page:1,limit:2,total:0}},response(1,3,['1']),{success:true,data:[],meta:{}}]){
  await assert.rejects(fetchAllPages(async()=>bad,{}));
 }
 for(const second of [response(2,4,['3','4']),response(2,3,['2']),{...response(2,3,['3']),meta:{page:2,total:3,limit:2,source:'OTHER'}}]){
  await assert.rejects(fetchAllPages(async q=>q.page===1?response(1,3,['1','2']):second,{}));
 }
});
test('export cap is an explicit subset, not a completed total',async()=>{
 const r=await fetchAllPages(async q=>response(q.page,5,q.page===1?['1','2']:['3','4']),{},{maxRows:3});
 assert.equal(r.data.length,3);assert.equal(r.meta.total,5);assert.equal(r.meta.loaded,3);assert.equal(r.meta.truncated,true);
});

function screen(){
 let cursor=0,slots=[],effect,tree,writes=0;const pending=[],exports=[];
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{writes++;slots[i]=typeof v==='function'?v(slots[i]):v;}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useMemo:fn=>fn(),useEffect:fn=>{effect??=fn;}};
 const request=params=>new Promise((resolve,reject)=>pending.push({resolve,reject,params}));
 const module={exports:{}};vm.runInNewContext(transformSync(readFileSync(new URL('./ExportCenterScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,
  {module,exports:module.exports,require:spec=>spec==='react'?react:spec.endsWith('exportUtils.js')?{exportRowsToCsv:r=>exports.push(r),exportRowsToExcel:r=>exports.push(r),printRowsReport:r=>exports.push(r)}:{fetchProducts:request,fetchCustomers:request,fetchPurchaseDrafts:request}});
 const render=()=>{cursor=0;tree=module.exports.ExportCenterScreen();};
 const nodes=(t=tree)=>t==null||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(x=>nodes(x??null)):[t,...nodes(t.props?.children??null)];
 const text=t=>t==null?'':Array.isArray(t)?t.map(text).join(' '):typeof t==='object'?text(t.props?.children):String(t);
 render();const cleanup=effect();return{pending,exports,render,cleanup,nodes,get writes(){return writes;},text:()=>text(tree),
  load:()=>nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}}),
  button:label=>nodes().find(n=>n.type==='button'&&text(n)===label),
  async flush(){for(let i=0;i<10;i++)await Promise.resolve();render();}};
}
test('actual export screen discards old success/error after report switch and blocks captured stale export handlers',async()=>{
 for(const failOld of [false,true]){
  const h=screen(),old=h.load();h.render();h.nodes().find(n=>n.type==='select').props.onChange({target:{value:'customers'}});h.render();
  const fresh=h.load();h.pending[1].resolve(response(1,1,['new']));await fresh;h.render();
  if(failOld)h.pending[0].reject(Error('OLD_ERROR'));else h.pending[0].resolve(response(1,1,['old']));await old;h.render();
  h.button('Excel İndir').props.onClick();assert.equal(h.exports[0].rows[0].id,'new');assert.doesNotMatch(h.text(),/OLD_ERROR/);
  const stale=h.button('Excel İndir').props.onClick;h.nodes().find(n=>n.type==='input').props.onChange({target:{value:'changed'}});
  stale();assert.equal(h.exports.length,1);h.render();assert.equal(h.button('Excel İndir').props.disabled,true);
 }
});
test('actual export screen clears old output during refresh and ignores completion after unmount',async()=>{
 const h=screen(),first=h.load();h.pending[0].resolve(response(1,1,['one']));await first;h.render();
 const stale=h.button('CSV İndir').props.onClick,second=h.load();stale();assert.equal(h.exports.length,0);h.render();
 h.cleanup();const writes=h.writes;h.pending[1].resolve(response(1,1,['two']));await second;
 assert.equal(h.writes,writes);stale();assert.equal(h.exports.length,0);
});
test('CSV, Excel and print carry loaded scope without claiming a transactional snapshot',async()=>{
 const h=screen(),load=h.load();h.pending[0].resolve(response(1,1,['one']));await load;h.render();
 h.button('CSV İndir').props.onClick();h.button('Excel İndir').props.onClick();h.button('Yazdır / PDF').props.onClick();
 assert.match(h.exports[0].filename,/1-satir$/);
 const scope=h.exports[0].columns.at(-1);assert.equal(scope.label,'Rapor kapsamı');assert.match(scope.value(),/Yüklenen 1 \/ toplam 1 kayıt/);
 assert.match(h.exports[1].title,/Tek zamanlı veri görüntüsü doğrulanmadı/);assert.match(h.exports[2].subtitle,/Yüklenen 1 \/ toplam 1 kayıt/);
 assert.equal(h.exports[0].rows[0].amount,null);
});
test('actual screen cancels further pages of obsolete reports after filter changes or unmount',async()=>{
 for(const unmount of [false,true]){
  const h=screen(),load=h.load();assert.equal(h.pending.length,1);
  if(unmount)h.cleanup();else h.nodes().find(n=>n.type==='input').props.onChange({target:{value:'new filter'}});
  h.pending[0].resolve(response(1,3,['one','two']));await load;h.render();
  assert.equal(h.pending.length,1);assert.equal(h.button('Excel İndir').props.disabled,true);assert.equal(h.exports.length,0);
 }
});
test('purchase export passes date filters; undated product list cannot claim those dates in print',async()=>{
 const h=screen();assert.ok(h.nodes().filter(n=>n.type==='input'&&n.props.type==='date').every(n=>n.props.disabled));
 let p=h.load();h.pending[0].resolve(response(1,1,['1']));await p;h.render();h.button('Yazdır / PDF').props.onClick();
 assert.match(h.exports[0].subtitle,/Tarih filtresi uygulanmaz/);
 h.nodes().find(n=>n.type==='select').props.onChange({target:{value:'purchases'}});h.render();
 let dates=h.nodes().filter(n=>n.type==='input'&&n.props.type==='date');assert.ok(dates.every(n=>!n.props.disabled));
 dates[0].props.onChange({target:{value:'2026-09-01'}});h.render();dates=h.nodes().filter(n=>n.type==='input'&&n.props.type==='date');
 dates[1].props.onChange({target:{value:'2026-09-24'}});h.render();p=h.load();
 assert.equal(h.pending[1].params.dateFrom,'2026-09-01');assert.equal(h.pending[1].params.dateTo,'2026-09-24');
 h.pending[1].resolve(response(1,1,['2']));await p;h.render();h.button('Yazdır / PDF').props.onClick();assert.match(h.exports[1].subtitle,/2026-09-01 \/ 2026-09-24/);
});

