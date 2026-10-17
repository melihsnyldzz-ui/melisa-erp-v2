import test from 'node:test';import assert from 'node:assert/strict';
import {createLazyVegaClient} from './lazyVegaClient.mjs';
test('unrelated legacy target is never initialized by loading the ERP catalog',()=>{
 const client=createLazyVegaClient({baseUrl:'http://127.0.0.1:4144',allowLocalTest:false});
 assert.equal(typeof client.get,'function');
 assert.throws(()=>client.hasSession(),/Geçersiz Vega/);
});
test('legacy requests retain original options and initialize once on first use',()=>{
 let calls=0;const options={baseUrl:'https://example.invalid'},client=createLazyVegaClient(options,{create:value=>{assert.equal(value,options);calls++;return {hasSession:()=>false,get:(...args)=>args};}});
 assert.equal(calls,0);assert.equal(client.hasSession(),false);assert.deepEqual(client.get('/x',{a:1}),['/x',{a:1}]);assert.equal(calls,1);
});
