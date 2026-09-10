import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

async function harness() {
 let state, effect, listener, removed=false, time=0, nextTimer=0;
 const timers=new Map(), requests=[];
 const context=vm.createContext({JSON,Promise,Map,performance:{now:()=>time},
  setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:time+ms});return id;},
  clearTimeout:id=>timers.delete(id)});
 const app={currentState:'active',addEventListener:(_event,fn)=>{listener=fn;return {remove(){removed=true;}};}};
 const module=new vm.SourceTextModule(fs.readFileSync('apps/terminal-app/src/components/useFreshSaleImages.js','utf8'),{context});
 const exports={
  react:{useState:initial=>{state??=initial;return [state,value=>{state=typeof value==='function'?value(state):value;}];},useEffect:fn=>{effect??=fn;}},
  'react-native':{AppState:app},
  '../services/apiClient':{apiRequest:()=>{}},
  '../services/freshSaleImages':{SALE_IMAGE_MAX_AGE_MS:30000,saleImageIdentity:p=>({id:p.id}),
   readFreshSaleImages:(_ids,_read,_base,isCurrent,{onImage})=>new Promise(resolve=>requests.push({isCurrent,onImage,resolve}))},
 };
 await module.link(spec=>new vm.SyntheticModule(Object.keys(exports[spec]),function(){for(const [key,value] of Object.entries(exports[spec]))this.setExport(key,value);},{context}));
 await module.evaluate();
 const lines=[{product:{id:'1'}},{product:{id:'2'}}];
 const render=(token='test-only')=>module.namespace.useFreshSaleImages(lines,token,'http://localhost');
 render();const cleanup=effect();
 return {render,requests,cleanup,timers,get removed(){return removed;},
  appState(value){app.currentState=value;listener(value);},
  async tick(){await Promise.resolve();await Promise.resolve();},
  advance(ms){time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}}};
}

test('early photo expires while the rest of the batch is still pending; completion cannot restore it',async()=>{
 const h=await harness(),r=h.requests[0];
 h.advance(1000);r.onImage('1','first',30000);assert.equal(h.render()['1'],'first');
 h.advance(29000);assert.equal(Object.keys(h.render()).length,0);
 r.onImage('1','late',30000);assert.equal(Object.keys(h.render()).length,0);
 r.onImage('2','second',50000);assert.equal(h.render()['2'],'second');
 r.resolve({'1':'expired','2':'second'});await h.tick();assert.equal(h.render()['1'],undefined);
 h.advance(999);assert.equal(h.requests.length,1);
 h.advance(1);assert.equal(h.requests.length,2);assert.equal(Object.keys(h.render()).length,0);
 h.cleanup();assert.equal(h.timers.size,0);
});

test('background, context change and unmount reject old callbacks and cancel every expiry',async()=>{
 const h=await harness(),old=h.requests[0];
 old.onImage('1','verified',30000);assert.equal(h.render()['1'],'verified');
 assert.equal(Object.keys(h.render('different-session')).length,0);
 h.appState('background');assert.equal(Object.keys(h.render()).length,0);assert.equal(h.timers.size,0);
 old.onImage('1','late',30000);assert.equal(Object.keys(h.render()).length,0);assert.equal(old.isCurrent(),false);
 h.appState('active');const current=h.requests[1];
 old.resolve({'1':'late'});await h.tick();assert.equal(Object.keys(h.render()).length,0);
 current.onImage('1','fresh',30000);current.onImage('2','fresh2',30000);assert.equal(h.timers.size,2);
 current.resolve({});await h.tick();assert.equal(h.timers.size,3);
 h.cleanup();assert.equal(h.timers.size,0);assert.equal(h.removed,true);assert.equal(current.isCurrent(),false);
 current.onImage('1','after-unmount',30000);assert.equal(h.render()['1'],'fresh');
});
