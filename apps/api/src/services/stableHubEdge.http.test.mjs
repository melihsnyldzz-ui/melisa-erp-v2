import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Writable,Readable} from 'node:stream';
import {createStableEdgeServer} from './stableHubEdge.mjs';
import {STABLE_HUB_ORIGIN} from './sharedCopyTransport.mjs';
const authority=new URL(STABLE_HUB_ORIGIN).host;
const baseHeaders={host:authority,'x-forwarded-host':authority,'x-forwarded-proto':'https','x-forwarded-for':'100.87.188.4','tailscale-user-login':'offline@example.invalid'};
async function fixture(run){
 const requests=[];
 const server=createStableEdgeServer({requestImpl(options,callback){
  const parts=[];
  const sink=new Writable({write(chunk,_encoding,done){parts.push(chunk);done();}});
  sink.on('finish',()=>{
   requests.push({...options,body:Buffer.concat(parts).toString()});
   const response=Readable.from([options.path.includes('/photo')?Buffer.from([1,2,3]):JSON.stringify({source:'offline fixture'})]);
   response.statusCode=options.path.includes('/auth/login')?401:options.path.includes('/v2/drafts')?403:options.path.includes('/sales-rules')?302:200;
   response.headers={'content-type':options.path.includes('/photo')?'image/jpeg':'application/json','set-cookie':['fixture=never-forward'],location:'https://foreign.invalid'};
   callback(response);
  });
  return sink;
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=(url,method='GET',extra={},body=null)=>new Promise((resolve,reject)=>{
  const headers={...baseHeaders,...extra};if(body!==null){headers['content-type']='application/json';headers['content-length']=String(Buffer.byteLength(body));}
  const req=http.request({host:'127.0.0.1',port:server.address().port,path:url,method,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});
  req.once('error',reject);req.end(body??undefined);
 });
 try{await run(request,requests);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('real HTTP edge preserves supplier selection and encoded zero-leading barcode without network backend',()=>fixture(async(request,seen)=>{
 const result=await request('/api/work-receiving/context?barcode=0000123%20AB','GET',{'x-melisa-supplier-id':'601','x-melisa-currency':'EUR',authorization:'Bearer opaque-fixture'});
 assert.equal(result.status,200);assert.equal(seen.length,1);assert.equal(seen[0].path,'/api/work-receiving/context?barcode=0000123%20AB');
 assert.equal(seen[0].headers['x-melisa-currency'],'EUR');assert.equal(seen[0].headers['x-melisa-supplier-id'],'601');assert.equal(seen[0].headers.authorization,'Bearer opaque-fixture');
 assert.equal(seen[0].headers.host,'127.0.0.1:4184');assert.equal(seen[0].headers['x-forwarded-host'],undefined);assert.equal(result.headers['set-cookie'],undefined);
 assert.equal((await request('/api/test-daily/count','GET',{'x-melisa-supplier-id':'601','x-melisa-currency':'USD'})).status,200);
}));
test('normal login denial and separate CRM/ERP token denial propagate unchanged through HTTP',()=>fixture(async(request,seen)=>{
 const login=await request('/api/auth/login','POST',{origin:STABLE_HUB_ORIGIN},'{"username":"offline"}');assert.equal(login.status,401);assert.equal(seen[0].body,'{"username":"offline"}');assert.equal(seen[0].headers.origin,STABLE_HUB_ORIGIN);
 const draft=await request('/crm/api/live/crm/erp/v2/drafts','POST',{origin:STABLE_HUB_ORIGIN,authorization:'Bearer crm.fixture.signature','x-erp-token':'erp.fixture.signature'},'{}');
 assert.equal(draft.status,403);assert.equal(seen[1].path,'/crm/api/live/crm/erp/v2/drafts');assert.equal(seen[1].headers.authorization,'Bearer crm.fixture.signature');assert.equal(seen[1].headers['x-erp-token'],'erp.fixture.signature');
 assert.equal(seen[1].headers['x-crm-authorization'],undefined);
 const logout=await request('/crm/api/live/crm/catalog/auth/sign-out','POST',{origin:STABLE_HUB_ORIGIN,authorization:'Bearer crm.fixture.signature'},'{}');assert.equal(logout.status,200);assert.equal(seen[2].path,'/crm/api/live/crm/catalog/auth/sign-out');assert.equal(seen[2].headers.authorization,'Bearer crm.fixture.signature');assert.equal(seen[2].headers['x-erp-token'],undefined);
 assert.equal((await request('/crm/api/live/crm/catalog/auth/sign-in','POST',{origin:STABLE_HUB_ORIGIN},'{}')).status,403);assert.equal(seen.length,3);
}));
test('photo bytes and assignment scope survive; provider and bootstrap requests never reach fixture',()=>fixture(async(request,seen)=>{
 const photo=await request('/crm/api/live/crm/catalog/products/1/photo?variant=thumbnail','GET',{'x-crm-conversation-id':'55'});assert.equal(photo.status,200);assert.deepEqual(photo.body,Buffer.from([1,2,3]));assert.equal(seen[0].headers['x-crm-conversation-id'],'55');
 for(const path of ['/crm/api/test-personnel/session','/crm/api/test-admin/session','/crm/api/live/crm/conversations/55/messages','/api/test-daily/count/prepare'])assert.equal((await request(path,'POST',{origin:STABLE_HUB_ORIGIN},'{}')).status,403);
 assert.equal(seen.length,1);
 assert.equal((await request('/api/work-receiving/context','GET',{'x-melisa-supplier-id':'601'})).status,403);assert.equal(seen.length,1);
}));
test('upstream redirects fail closed and CRM fallback CSP remains same-origin',()=>fixture(async(request)=>{
 const redirect=await request('/crm/api/live/crm/sales-rules');assert.equal(redirect.status,502);assert.equal(redirect.headers.location,undefined);
 const crm=await request('/crm/');assert.equal(crm.status,200);assert.match(crm.headers['content-security-policy'],/connect-src 'self'/);assert.match(crm.headers['content-security-policy'],/frame-ancestors 'self'/);
}));
