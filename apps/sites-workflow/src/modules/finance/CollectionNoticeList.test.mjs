import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
const source='PROMPT-2-20260923-01';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const eq=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function runtime(){
 const slots=[];let cursor=0,dirty=false,effects=[],writes=0;
 const hooks={
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{writes++;const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
  useRef(initial){const i=cursor++;if(!slots[i])slots[i]={value:{current:initial}};return slots[i].value;},
  useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||!eq(old.deps,deps)){effects.push({i,effect,cleanup:old?.cleanup});slots[i]={deps,cleanup:old?.cleanup};}},
  useMemo(fn,deps){const i=cursor++;if(!slots[i]||!eq(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;}
 };
 return {hooks,start(){cursor=0;dirty=false;effects=[];},finish(){for(const e of effects){e.cleanup?.();slots[e.i].cleanup=e.effect();}return dirty;},unmount(){for(const s of slots)s.cleanup?.();},get writes(){return writes;}};
}
function nodes(tree,predicate,out=[]){if(Array.isArray(tree)){for(const t of tree)nodes(t,predicate,out);}else if(tree&&typeof tree==='object'){if(predicate(tree))out.push(tree);nodes(tree.props?.children,predicate,out);}return out;}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(Array.isArray(tree))return tree.map(text).join('');if(typeof tree!=='object')return String(tree);return text(tree.props?.children);}
function listHarness(props={source}){const run=runtime(),lists=[],details=[];let tree;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 const api={fetchCollectionNotices:(...args)=>{const d=deferred();lists.push({...d,args});return d.promise;},fetchCollectionNotice:(...args)=>{const d=deferred();details.push({...d,args});return d.promise;}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./CollectionNoticeList.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,AbortController,require:spec=>spec==='react'?react:spec.endsWith('CollectionNoticeReviewForm.jsx')?{CollectionNoticeReviewForm:()=>null}:api});
 function render(){for(let i=0;i<30;i++){run.start();tree=module.exports.CollectionNoticeList(props);if(!run.finish())return;}throw Error('loop');}
 render();return{run,lists,details,render,props,get text(){return text(tree);},click(label){const b=nodes(tree,n=>n.type==='button'&&text(n)===label)[0];assert.ok(b,label);const result=b.props.onClick();render();return result;},async flush(){for(let i=0;i<8;i++)await Promise.resolve();render();}};
}
const row=id=>({id,source,customerId:'8',currency:'USD',reportedAmount:'1.2345',reportedOn:'2026-09-24',status:'pending'});
const result=(data,extra={})=>({success:true,data,meta:{source,sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'},amountScope:'REPORTED_AMOUNT_NOT_APPROVED_COLLECTION',scope:'OWN_REPORTED_NOTICES',readAt:'2026-09-24T12:00:00Z',page:1,pageSize:4,total:Array.isArray(data)?data.length:1,...extra}});
test('list explicitly loads, retains out-of-range totals and never sums currencies',async()=>{const h=listHarness();assert.equal(h.lists.length,0);h.click('Bildirimleri oku');h.lists[0].resolve(result([row('1'),row('2'),row('3'),row('4')],{total:5}));await h.flush();assert.match(h.text,/1.2345 USD/);h.click('Sonraki');h.lists[1].resolve(result([],{page:2,total:4}));await h.flush();assert.match(h.text,/4 bildirim/);assert.match(h.text,/Sayfa aralığı dışında/);});
test('select same source ID; old error and closed panel result cannot restore old detail',async()=>{const h=listHarness();h.click('Bildirimleri oku');h.lists[0].resolve(result([row('1'),row('2')]));await h.flush();const old=h.click('#1'),current=h.click('#2');h.details[1].resolve(result(row('2')));await current;await h.flush();h.details[0].reject(Error('OLD_ERROR'));await old;await h.flush();assert.doesNotMatch(h.text,/OLD_ERROR/);assert.match(h.text,/Bildirim #2/);const late=h.click('#1');h.click('Kapat');h.details[2].resolve(result(row('1')));await late;await h.flush();assert.doesNotMatch(h.text,/Bildirim #1/);});
test('source drift stays an error, not empty result',async()=>{const h=listHarness();h.click('Bildirimleri oku');h.lists[0].resolve(result([],{source:'OTHER'}));await h.flush();assert.match(h.text,/Kayıtlar boş sayılmadı/);assert.doesNotMatch(h.text,/Bu filtrede kayıt yok/);});



test('incomplete page cannot masquerade as a valid filtered total',async()=>{const h=listHarness();h.click('Bildirimleri oku');assert.equal(h.lists[0].args[0].pageSize,4);h.lists[0].resolve(result([row('1')],{total:5}));await h.flush();assert.match(h.text,/Bildirim sayfası doğrulanamadı/);});


test('dashboard link opens exact notice without first-page assumption and rejects stale linked detail',async()=>{
 const props={source,initialNotice:{kind:'collection_notice',source:'/api/collection-notices',documentId:'90'}};
 const h=listHarness(props);assert.equal(h.lists.length,0);assert.equal(h.details[0].args[0],'90');
 props.initialNotice={...props.initialNotice,documentId:'91'};h.render();assert.equal(h.details[1].args[0],'91');
 h.details[1].resolve(result(row('91')));await h.flush();h.details[0].resolve(result(row('90')));await h.flush();
 assert.match(h.text,/Bildirim #91/);assert.doesNotMatch(h.text,/Bildirim #90/);
 h.click('Kapat');await h.flush();assert.doesNotMatch(h.text,/Bildirim #91/);
 props.initialNotice={...props.initialNotice,source:'/api/OTHER'};h.render();assert.equal(h.details.length,2);assert.match(h.text,/bağlantı kimliği doğrulanamadı/);
});

