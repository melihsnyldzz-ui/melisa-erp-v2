import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import * as safety from './stockCountSafety.js';
const {transformSync}=createRequire(import.meta.url)('esbuild');
function fixture(readOnly){
 const states=['',[],{id:7,stockQuantity:2},'3','Kontrollü sayım',false,false,true,'','',null],calls=[];
 let cursor=0;
 const react={useState:()=>{const i=cursor++;return [states[i],v=>{states[i]=v;}];},useEffect(){},useMemo:fn=>fn(),createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./StockCountScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,require:spec=>spec==='react'?react:spec.endsWith('stockCountSafety.js')?safety:spec.endsWith('movementApi.js')?{applyStockCountAdjustment:async body=>{calls.push(body);return {data:{countedQuantity:3}};}}:{fetchProducts:async()=>({data:[]})}});
 const tree=module.exports.StockCountScreen({readOnly}),forms=[];
 function walk(node){if(Array.isArray(node))node.forEach(walk);else if(node&&typeof node==='object'){if(node.type==='form')forms.push(node);walk(node.props?.children);}}
 walk(tree);
 return {calls,states,submit:()=>forms[1].props.onSubmit({preventDefault(){}})};
}
test('TEST count handler refuses a valid confirmed adjustment without calling the client',async()=>{const f=fixture(true);await f.submit();assert.equal(f.calls.length,0);assert.match(f.states[9],/stok düzeltmesi gönderilmedi/);});
test('normal count handler retains its existing confirmed adjustment contract (mock only)',async()=>{const f=fixture(false);await f.submit();assert.equal(f.calls.length,1);assert.equal(f.calls[0].productId,7);assert.equal(f.calls[0].expectedCurrentQuantity,2);assert.equal(f.calls[0].countedQuantity,'3');});

