import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
async function setup(enabled=true,focused=true){
 let effect,listener,timer,removed=false,blurs=0,focuses=0;
 const ref={current:{isFocused:()=>focused,blur:()=>{focused=false;blurs++;},focus:()=>{focused=true;focuses++;}}};
 const context=vm.createContext({Boolean,setTimeout:(fn,ms)=>{assert.equal(ms,150);timer=fn;return 1;},clearTimeout:()=>{timer=null;}});
 const module=new vm.SourceTextModule(fs.readFileSync('apps/terminal-app/src/components/useScannerResumeFocus.js','utf8'),{context});
 await module.link(spec=>{const obj=spec==='react'?{useEffect:fn=>{effect=fn;}}:{AppState:{addEventListener:(_name,fn)=>{listener=fn;return {remove:()=>{removed=true;}};}}};return new vm.SyntheticModule(Object.keys(obj),function(){for(const [k,v]of Object.entries(obj))this.setExport(k,v);},{context});});await module.evaluate();module.namespace.useScannerResumeFocus(ref,enabled);const cleanup=effect();
 return {event:state=>listener?.(state),run:()=>timer?.(),cleanup,state:()=>({focused,removed,blurs,focuses,hasTimer:Boolean(timer),hasListener:Boolean(listener)})};
}
test('only previously focused scanner is blurred and restored; unmount cancels pending focus',async()=>{
 const h=await setup();h.event('background');assert.equal(h.state().focused,false);h.event('active');assert.equal(h.state().focuses,0);h.run();assert.equal(h.state().focuses,1);h.event('background');h.event('active');h.cleanup();assert.equal(h.state().hasTimer,false);assert.equal(h.state().removed,true);
});
test('stock mode or another focused field is not disturbed',async()=>{
 const disabled=await setup(false);assert.equal(disabled.state().hasListener,false);
 const other=await setup(true,false);other.event('background');other.event('active');assert.equal(other.state().blurs,0);assert.equal(other.state().hasTimer,false);other.cleanup();
});
