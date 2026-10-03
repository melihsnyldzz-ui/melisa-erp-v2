import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
function harness(){
 let state=[],cursor=0,effects=[],pending=[],tree;const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}];},useEffect(fn,deps){if(!effects.length)effects.push(fn);}};
 const code=transformSync(readFileSync(new URL('./DashboardScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',define:{'import.meta.env.VITE_TEST_READ_ONLY':'"true"'}}).code;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,AbortController,Intl,Date,require:spec=>spec==='react'?react:spec.endsWith('dashboardApi.js')?{fetchDashboardSummary:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),fetchDashboardAlerts:()=>{throw Error('DISABLED_ALERTS_CALLED')}}:{}});
 const Component=module.exports.DashboardScreen;function render(){cursor=0;const outer=Component({permissions:['product.view']});tree=outer.type(outer.props);return tree;}render();const cleanup=effects[0]();
 function text(t){return t==null||typeof t==='boolean'?'':Array.isArray(t)?t.map(text).join(' '):typeof t==='object'?text(t.props?.children):String(t)}
 return {pending,cleanup,async settle(){for(let i=0;i<5;i++)await Promise.resolve();render();return text(tree)},text:()=>text(tree)};
}
test('actual TEST dashboard distinguishes error, missing values, empty response and genuine zero without alerts route',async()=>{
 for(const [data,expected] of [[{totalProducts:0,activeProducts:0},/Aktif kart:  0/],[{totalProducts:null,activeProducts:null},/Veri doğrulanmadı/],[null,/Özet yanıtı boş/],[{totalProducts:'',activeProducts:''},/Veri doğrulanmadı/]]){const h=harness();h.pending[0].resolve({data});const text=await h.settle();assert.match(text,expected);assert.doesNotMatch(text,/Kritik uyarı bulunmuyor/);}
 const h=harness();h.pending[0].reject(Object.assign(Error('NETWORK_ERROR'),{status:503}));const text=await h.settle();assert.match(text,/Özet okunamadı/);assert.match(text,/Aktif kart:  Okunamadı/);assert.doesNotMatch(text,/Kritik uyarı bulunmuyor/);
});
test('actual TEST dashboard ignores success after cleanup',async()=>{const h=harness();h.cleanup();h.pending[0].resolve({data:{totalProducts:999,activeProducts:999}});assert.doesNotMatch(await h.settle(),/999/)});

