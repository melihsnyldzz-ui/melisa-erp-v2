import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {buildApiUrl} from './apiUrl.js';
import {demoReadRequest} from '../demo/demoWorkspace.js';
function client(demoMode, result) {
  const calls=[], module={exports:{}};
  const code=transformSync(readFileSync(new URL('./apiClient.js',import.meta.url),'utf8'),{format:'cjs',define:{'import.meta.env.VITE_TEST_READ_ONLY':'"true"'}}).code;
  vm.runInNewContext(code,{module,exports:module.exports,URL,DOMException,window:{location:{origin:'https://erp.example'},localStorage:{getItem:()=>null}},
    fetch:async(...args)=>{calls.push(args);return result;},require:spec=>({
      './apiUrl.js':{buildApiUrl},'../demo/demoWorkspace.js':{demoReadRequest},
      '../config/apiConfig.js':{API_BASE_URL:'/api',apiConfig:{demoMode}},
      './authRetryPolicy.js':{shouldRetryWithRenewedSession:()=>false}
    })[spec]});
  return {api:module.exports,calls};
}
test('nonstandard JSON API errors keep HTTP status and a useful error instead of TypeError',async()=>{
  const c=client(false,{ok:false,status:503,json:async()=>({message:'unavailable'})});
  await assert.rejects(c.api.get('/api/products'),e=>e.status===503&&e.code==='API_ERROR');
  assert.equal(String(c.calls[0][0]),'https://erp.example/api/products');
});
test('demo reads use explicit adapters; writes, downloads and missing routes never fetch live data',async()=>{
  const c=client(true);
  assert.equal((await c.api.get('/api/read-only-parties/customer')).data.length,4);
  await assert.rejects(c.api.post('/api/inventory-receipts',{}),e=>e.code==='DEMO_ROUTE_MISSING');
  await assert.rejects(c.api.get('/api/not-implemented'),e=>e.code==='DEMO_ROUTE_MISSING');
  await assert.rejects(c.api.download('/api/export','data.csv'),e=>e.code==='DEMO_DATASET_UNAVAILABLE');
  assert.equal(c.calls.length,0);
});
test('an aborted demo read stays cancelled',async()=>{
  const c=client(true),controller=new AbortController();controller.abort();
  await assert.rejects(c.api.get('/api/read-only-parties/customer',{}, {signal:controller.signal}),e=>e.name==='AbortError');
});
