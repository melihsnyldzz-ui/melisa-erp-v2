import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVegaProductClient } from './vegaProductClient.js';
test('local read-only deployment permits only its explicit loopback HTTP origin', async () => {
  let requests = 0;
  const client = createVegaProductClient({baseUrl:'http://127.0.0.1:4144',allowLocalTest:true,fetchImpl:async url => {requests++;assert.equal(url.origin,'http://127.0.0.1:4144');return {ok:true,json:async()=>({success:true,data:{}})}}});
  await client.get('/api/auth/me');
  await assert.rejects(client.get('/api/products'), e => e.code === 'VEGA_READ_ONLY');
  assert.equal(requests,1);
  assert.throws(()=>createVegaProductClient({baseUrl:'http://127.0.0.1:4144'}));
  for(const baseUrl of ['http://127.0.0.1:4114','http://192.168.1.46:4144','http://public.example','http://user:pass@127.0.0.1:4144','http://127.0.0.1:4144/path']) assert.throws(()=>createVegaProductClient({baseUrl,allowLocalTest:true}));
});
