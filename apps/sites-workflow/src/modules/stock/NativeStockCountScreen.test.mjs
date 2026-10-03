import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const {transformSync}=createRequire(import.meta.url)('esbuild');
const source='PROMPT-2-20260923-01';
function nodes(t,p,out=[]){if(Array.isArray(t))t.forEach(n=>nodes(n,p,out));else if(t&&typeof t==='object'){if(p(t))out.push(t);nodes(t.props?.children,p,out);}return out;}
function text(t){if(Array.isArray(t))return t.map(text).join(' ');if(t&&typeof t==='object')return text(t.props?.children);return t==null?'':String(t);}
function fixture(initialCount=null){
 let cursor=0,tree;const slots=[],pending=[],cleanup=[];
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=v;}];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;cleanup.push(fn());}},createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const api={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('../../services/stockCountApi.js',import.meta.url),'utf8'),{loader:'js',format:'cjs'}).code,{module:api,exports:api.exports,require:()=>({get:(url,query,options)=>new Promise((resolve,reject)=>pending.push({url,query,options,resolve,reject}))})});
 const module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./NativeStockCountScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,AbortController,require:spec=>spec==='react'?react:api.exports});
 function render(){cursor=0;tree=module.exports.NativeStockCountScreen({initialCount});}render();
 return {pending,render,click(label){const result=nodes(tree,n=>n.type==='button'&&text(n)===label)[0].props.onClick({preventDefault(){}});render();return result;},filter(value){nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value}});render();},get text(){render();return text(tree);},input(v){nodes(tree,n=>n.type==='input')[0].props.onChange({target:{value:v}});render();},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});},close(){nodes(tree,n=>n.type==='button')[1].props.onClick();render();},unmount(){cleanup.forEach(fn=>fn?.());}};
}
function response(id){return {success:true,data:{source,documentId:id,status:'counting',revision:'0',startedAt:'2026-09-24T10:00:00Z',readAt:'2026-09-24T11:00:00Z',readOnly:true,sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'},areas:[{itemId:'1',productId:'9',areaKey:'A',areaRevision:'0',quantity:null,unit:'adet',observationId:null,countedAt:null,receivedAt:null,timeState:null,zeroConfirmed:null},{itemId:'2',productId:'10',areaKey:'B',areaRevision:'1',quantity:'0.000',unit:'adet',observationId:'5',countedAt:null,receivedAt:'2026-09-24T10:01:00Z',timeState:'unverified',zeroConfirmed:true}]}};}
test('actual component/client reads exact document and distinguishes unknown from zero',async()=>{
 const f=fixture();f.input('20');const p=f.submit();assert.equal(f.pending[0].url,'/api/stock-counts/20');assert.equal(f.pending[0].query.source,source);
 f.pending[0].resolve(response('20'));await p;assert.match(f.text,/Sayım # 20/);assert.match(f.text,/Henüz gözlenmedi/);assert.match(f.text,/0.000 adet/);assert.match(f.text,/Sıfır ayrıca doğrulandı/);
});

test('queue selection reaches exact detail and foreign navigation cannot request a document',async()=>{
 const f=fixture({kind:'stock_count',source:'/api/stock-counts',documentId:'99'});
 assert.equal(f.pending.length,1);assert.equal(f.pending[0].url,'/api/stock-counts/99');
 f.pending[0].resolve(response('99'));await new Promise(resolve=>setImmediate(resolve));assert.match(f.text,/Sayım # 99/);
 const bad=fixture({kind:'cheque',source:'/api/cheques',documentId:'99'});assert.equal(bad.pending.length,0);assert.match(bad.text,/bağlantısının türü/);
});
test('late success/error, close and unmount cannot resurrect an old count',async()=>{
 for(const mode of ['success','error','close','unmount']){
  const f=fixture();f.input('20');const old=f.submit();
  if(mode==='close')f.close();else if(mode==='unmount')f.unmount();else{f.input('21');const next=f.submit();f.pending[1].resolve(response('21'));await next;}
  assert.equal(f.pending[0].options.signal.aborted,true);
  if(mode==='error')f.pending[0].reject(Error('old error'));else f.pending[0].resolve(response('20'));await old;
  assert.doesNotMatch(f.text,/Sayım # 20|old error/);if(['success','error'].includes(mode))assert.match(f.text,/Sayım # 21/);
 }
});
test('wrong document or failed read shows an error and never a zero balance',async()=>{
 const f=fixture();f.input('20');const p=f.submit();f.pending[0].resolve(response('21'));await p;assert.match(f.text,/doğrulanamadı/);assert.doesNotMatch(f.text,/0.000 adet/);
});

function listResponse(page,total,ids){return {success:true,data:{source,items:ids.map(id=>({source,documentId:id,status:'counting',revision:'0',startedAt:'2026-09-24T10:00:00Z'})),page,pageSize:8,total,outOfRange:total>0&&!ids.length,readOnly:true,readAt:'2026-09-24T11:00:00Z',sourceContext:response('1').data.sourceContext}};}
test('actual list/client pages then opens the selected same count; filter aborts stale results',async()=>{
 const f=fixture();const first=f.click('Görev sayımlarını listele');assert.equal(f.pending[0].url,'/api/stock-counts');assert.equal(f.pending[0].query.page,1);
 f.pending[0].resolve(listResponse(1,9,['1','2','3','4','5','6','7','8']));await first;f.render();
 const second=f.click('Sonraki sayfa');assert.equal(f.pending[1].query.page,2);f.pending[1].resolve(listResponse(2,9,['9']));await second;f.render();
 const selected=f.click('Sayım # 9  ·  Sayılıyor');assert.equal(f.pending[2].url,'/api/stock-counts/9');f.pending[2].resolve(response('9'));await selected;assert.match(f.text,/Sayım # 9/);
 const old=f.click('Görev sayımlarını listele');f.filter('closed');assert.equal(f.pending[3].options.signal.aborted,true);f.pending[3].resolve(listResponse(1,9,['1','2','3','4','5','6','7','8']));await old;
 assert.doesNotMatch(f.text,/Filtrelenmiş belge sayısı|Sayım # 9/);
 const filtered=f.click('Görev sayımlarını listele');assert.equal(f.pending[4].query.page,1);assert.equal(f.pending[4].query.status,'closed');
 f.pending[4].resolve(listResponse(1,0,[]));await filtered;assert.match(f.text,/sayım bulunamadı/);
});

