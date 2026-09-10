import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('sale photo lifecycle clears on background, expiry, failed refresh and ignores response after unmount',async()=>{
 let state, effect, listener, pending, timer, removed=false;
 const context=vm.createContext({JSON,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,30000);timer=fn;return 1;},clearTimeout:()=>{timer=null;}});
 const app={currentState:'active',addEventListener:(_event,fn)=>{listener=fn;return {remove(){removed=true;}};}};
 const module=new vm.SourceTextModule(fs.readFileSync('apps/terminal-app/src/components/useFreshSaleImages.js','utf8'),{context});
 const exports={
  react:{useState:initial=>{state??=initial;return [state,value=>{state=value;}];},useEffect:fn=>{effect??=fn;}},
  'react-native':{AppState:app},
  '../services/apiClient':{apiRequest:()=>{}},
  '../services/freshSaleImages':{saleImageIdentity:p=>({id:p.id}),readFreshSaleImages:()=>new Promise(resolve=>{pending=resolve;})},
 };
 await module.link(spec=>new vm.SyntheticModule(Object.keys(exports[spec]),function(){for(const [key,value] of Object.entries(exports[spec]))this.setExport(key,value);},{context}));
 await module.evaluate();
 const lines=[{product:{id:'1'}}],render=()=>module.namespace.useFreshSaleImages(lines,'test-only','http://localhost');
 const tick=async()=>{await Promise.resolve();await Promise.resolve();};
 assert.equal(Object.keys(render()).length,0);
 const cleanup=effect();pending({'1':'verified'});await tick();assert.equal(render()['1'],'verified');
 app.currentState='background';listener('background');assert.equal(Object.keys(render()).length,0);assert.equal(timer,null);
 app.currentState='active';listener('active');pending({'1':'verified'});await tick();assert.equal(render()['1'],'verified');
 const expiry=timer;expiry();assert.equal(Object.keys(render()).length,0);pending({});await tick();assert.equal(Object.keys(render()).length,0);
 timer();cleanup();pending({'1':'late'});await tick();assert.equal(Object.keys(render()).length,0);assert.equal(removed,true);assert.equal(timer,null);
});
