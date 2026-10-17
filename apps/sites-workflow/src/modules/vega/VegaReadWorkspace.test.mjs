import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from './vegaReadModel.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function text(node){if(node==null||typeof node==='boolean')return '';if(Array.isArray(node))return node.map(text).join(' ');return typeof node==='object'?text(node.props?.children):String(node);}
function nodes(node,predicate,out=[]){if(Array.isArray(node))node.forEach(n=>nodes(n,predicate,out));else if(node&&typeof node==='object'){if(predicate(node))out.push(node);nodes(node.props?.children,predicate,out);}return out;}
function harness(name,props={}){
 const slots=[],calls=[];let cursor=0,dirty=false,effects=[],tree;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,update=>{const next=typeof update==='function'?update(slots[i].value):update;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
 useRef(initial){const i=cursor++;if(!slots[i])slots[i]={value:{current:initial}};return slots[i].value;},
 useMemo(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
 useEffect(effect,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){effects.push({i,effect,cleanup:slots[i]?.cleanup});slots[i]={deps};}}
 };
 const api=new Proxy({}, {get:(_,method)=>(...args)=>{const d=deferred();calls.push({...d,method,args});return d.promise;}});
 const module={exports:{}};
 const code=transformSync(readFileSync(new URL('./VegaReadWorkspace.jsx',import.meta.url),'utf8')+'\nexport {RecordList,RecordDetail};',{format:'cjs',loader:'jsx'}).code;
 vm.runInNewContext(code,{module,exports:module.exports,AbortController,Intl,Date,require:spec=>{
 if(spec==='react')return react;if(spec==='lucide-react')return new Proxy({}, {get:(_,name)=>name});if(spec.endsWith('.css'))return {};if(spec.endsWith('WorkspaceChrome.jsx'))return {WorkspaceHeading:()=>null};if(spec.endsWith('vegaReadModel.js'))return model;if(spec.endsWith('vegaBridgeApi.js'))return api;throw Error(spec);
 }});
 function render(){for(let n=0;n<30;n++){cursor=0;dirty=false;effects=[];tree=module.exports[name](props);for(const e of effects){e.cleanup?.();slots[e.i].cleanup=e.effect();}if(!dirty)return;}throw Error('Render loop');}
 render();return {calls,render,find:p=>nodes(tree,p),get text(){return text(tree);},get tree(){return tree;},setProps(next){props={...props,...next};render();},async flush(){for(let n=0;n<8;n++)await Promise.resolve();render();}};
}
const row=id=>({sourceId:String(id),name:'Ürün '+id,stockCode:'CODE'+id});
const page=(id,cursor)=>({rows:[row(id)],meta:{pagination:{hasMore:!!cursor,nextCursor:cursor}},unmatched:0});
const button=(h,label)=>h.find(n=>n.type==='button'&&text(n).includes(label))[0];
test('actual product list uses opaque cursor, previous page and search reset',async()=>{
 const h=harness('RecordList');h.calls[0].resolve(page(1,'opaque+/=xyz'));await h.flush();
 button(h,'Sonraki').props.onClick();h.render();assert.equal(h.calls[1].args[0].cursor,'opaque+/=xyz');assert.equal(h.calls[1].args[0].page,2);
 h.calls[1].resolve(page(2));await h.flush();button(h,'Önceki').props.onClick();h.render();assert.equal(h.calls[2].args[0].cursor,undefined);
 h.calls[2].resolve(page(1,'next'));await h.flush();h.find(n=>n.type==='input')[0].props.onChange({target:{value:'ABC'}});h.render();h.find(n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});h.render();
 assert.equal(h.calls[3].args[0].query,'ABC');assert.equal(h.calls[3].args[0].page,1);assert.equal(h.calls[3].args[0].cursor,undefined);
});
test('actual list ignores late responses and distinguishes source errors from empty records',async()=>{
 const h=harness('RecordList');const old=h.calls[0];h.find(n=>n.type==='input')[0].props.onChange({target:{value:'NEW'}});h.render();h.find(n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});h.render();assert.equal(old.args[1].signal.aborted,true);
 old.resolve(page(9));h.calls[1].resolve(page(2));await h.flush();assert.match(h.text,/Ürün 2/);assert.doesNotMatch(h.text,/Ürün 9/);
 button(h,'Yenile').props.onClick();h.render();h.calls.at(-1).reject(Error('offline'));await h.flush();assert.equal(h.find(n=>n.type?.name==='ErrorState').length,1);assert.doesNotMatch(h.text,/kayıt bulunamadı/);
});
test('account page filter closes details that no longer match and never claims global search',async()=>{
 const h=harness('RecordList',{account:true});h.calls[0].resolve(page(1));await h.flush();button(h,'İncele').props.onClick({currentTarget:{}});h.render();assert.equal(h.find(n=>n.type?.name==='RecordDetail').length,1);
 h.find(n=>n.type==='input')[0].props.onChange({target:{value:'UNKNOWN'}});h.render();assert.equal(h.find(n=>n.type?.name==='RecordDetail').length,0);assert.match(h.text,/yalnızca açık sayfadaki/);assert.equal(h.calls.length,1);
});
test('changing selected detail cancels old request and cannot show the wrong product',async()=>{
 const h=harness('RecordDetail',{id:'1'});const old=h.calls[0];h.setProps({id:'2'});assert.equal(old.args[1].signal.aborted,true);
 old.resolve({data:{product:{name:'OLD'}},meta:{}});h.calls[1].resolve({data:{product:{name:'NEW'}},meta:{}});await h.flush();assert.match(h.text,/NEW/);assert.doesNotMatch(h.text,/OLD/);
});

test('returning from a product restores the selected row and keeps the page',async()=>{
 const h=harness('RecordList');h.calls[0].resolve(page(1,'next'));await h.flush();
 const actions=[];const trigger={focus:()=>actions.push('focus'),scrollIntoView:()=>actions.push('scroll')};
 button(h,'İncele').props.onClick({currentTarget:trigger});h.render();
 h.find(n=>n.type?.name==='RecordDetail')[0].props.onClose();h.render();
 assert.deepEqual(actions,['focus','scroll']);assert.equal(h.find(n=>n.type?.name==='RecordDetail').length,0);
 assert.equal(h.calls.length,1);assert.match(h.text,/Ürün 1/);
});

test('product pagination stops when source repeats the current cursor or omits the next cursor',async()=>{
 const h=harness('RecordList');h.calls[0].resolve(page(1,'cursor-a'));await h.flush();
 button(h,'Sonraki').props.onClick();h.render();h.calls[1].resolve(page(2,'cursor-a'));await h.flush();
 assert.equal(button(h,'Sonraki').props.disabled,true);
 button(h,'Yenile').props.onClick();h.render();h.calls.at(-1).resolve({rows:[row(2)],meta:{pagination:{hasMore:true}},unmatched:0});await h.flush();
 assert.equal(button(h,'Sonraki').props.disabled,true);
});
