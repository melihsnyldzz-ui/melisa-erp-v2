import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHubMiddleware,HUB_CSP} from './melisaHubReadiness.mjs';
import {stableEdgeRoute,assertStableEdgeRequest,stableUpstreamHeaders} from './stableHubEdge.mjs';
import {STABLE_HUB_ORIGIN} from './sharedCopyTransport.mjs';
const assets=['index.html','model.mjs','progress.mjs','progress.css','evidence.json'];
const routes=['/progress/',...assets.map(name=>'/progress/'+name)];
async function fixture(run){
 const temp=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(temp,'hub-progress-routing-')),root=path.join(dir,'site'),progress=path.join(root,'melisa-hub','progress');
 fs.mkdirSync(progress,{recursive:true});
 for(const name of assets)fs.writeFileSync(path.join(progress,name),'safe fixture '+name);
 let probes=0;
 const handler=createHubMiddleware({root,context:{},pin:{},trainingValid:false,fetchImpl:async()=>{probes++;throw Error('NO_PROBE_ALLOWED');},readHealth:()=>{probes++;throw Error('NO_HEALTH_READ_ALLOWED');}});
 const request=async(p,method='GET',headers={host:'127.0.0.1:5234'})=>{
  const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},type(v){this.typeValue=v;return this;},sendStatus(v){this.code=v;return this;},send(v){this.body=v;return this;},end(){return this;}};
  await handler({path:p,originalUrl:'/melisa-hub'+p,method,headers},res);return res;
 };
 try{await run({request,dir,root,progress,probeCount:()=>probes});}
 finally{assert.equal(path.dirname(fs.realpathSync(dir)),temp);fs.rmSync(dir,{recursive:true,force:true});}
}
test('progress middleware serves only the exact directory entry and five assets without probes',()=>fixture(async({request,probeCount})=>{
 for(const route of routes){const result=await request(route),name=route==='/progress/'?'index.html':route.split('/').at(-1);assert.equal(result.code,200,route);assert.equal(result.body.toString(),'safe fixture '+name);assert.equal(result.typeValue,path.extname(name));assert.equal(result.headers['Content-Security-Policy'],HUB_CSP);assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(result.headers['X-Content-Type-Options'],'nosniff');}
 assert.equal(probeCount(),0);
}));
test('progress HEAD has no body and write methods remain blocked in both routing layers',()=>fixture(async({request,probeCount})=>{
 for(const route of routes){const r=await request(route,'HEAD');assert.equal(r.code,200);assert.equal(r.body,undefined);assert.equal(stableEdgeRoute('HEAD','/melisa-hub'+route).kind,'hub');for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){const denied=await request(route,method);assert.equal(denied.code,405);assert.equal(denied.headers.Allow,'GET, HEAD');assert.throws(()=>stableEdgeRoute(method,'/melisa-hub'+route));}}
 assert.equal(probeCount(),0);
}));
test('stable progress routing stays finite same-port Hub content with intact request guards',()=>{
 const authority=new URL(STABLE_HUB_ORIGIN).host;
 for(const p of routes){const raw='/melisa-hub'+p,route=stableEdgeRoute('GET',raw);assert.deepEqual(route,{port:5234,path:raw,kind:'hub'});const req={method:'GET',url:raw,socket:{remoteAddress:'127.0.0.1'},rawHeaders:[],headers:{host:authority,'x-forwarded-host':authority,'x-forwarded-proto':'https','x-forwarded-for':'100.87.188.4','tailscale-user-login':'routing-fixture@example.invalid'}};assert.deepEqual(assertStableEdgeRequest(req),route);for(const h of [{origin:'https://foreign.invalid'},{host:'foreign.invalid'},{'x-forwarded-proto':'http'},{'tailscale-user-login':''}])assert.throws(()=>assertStableEdgeRequest({...req,headers:{...req.headers,...h}}));}
});
test('unknown nested files aliases encoded traversal and private paths stay denied',()=>fixture(async({request,probeCount})=>{
 for(const p of ['/progress','/progress/private.json','/progress/settings.json','/progress/status.json','/progress/extra.mjs','/progress/index.html/extra','/progress/../index.html','/progress/%2e%2e/index.html','/progress/%69ndex.html','/progress//model.mjs','/progress/./model.mjs','/progress\\model.mjs']){assert.equal((await request(p)).code,404,p);assert.throws(()=>stableEdgeRoute('GET','/melisa-hub'+p),p);}
 assert.equal(probeCount(),0);
}));
test('progress middleware keeps cross-site and forwarding refusals before reading any asset',()=>fixture(async({request,probeCount})=>{
 for(const p of routes)for(const extra of [{origin:'https://foreign.invalid'},{'sec-fetch-site':'cross-site'},{'x-forwarded-for':'127.0.0.1'},{forwarded:'for=fixture'}])assert.equal((await request(p,'GET',{host:'127.0.0.1:5234',...extra})).code,403);
 assert.equal(probeCount(),0);
}));
test('nested progress directory junction or symlink cannot expose files outside the admitted directory',()=>fixture(async({request,dir,progress,probeCount})=>{
 const elsewhere=path.join(dir,'elsewhere');fs.renameSync(progress,elsewhere);fs.symlinkSync(elsewhere,progress,process.platform==='win32'?'junction':'dir');
 for(const p of routes)assert.equal((await request(p)).code,404,p);assert.equal(probeCount(),0);
}));
test('progress Hub transport does not acquire cookies identity or operational scope headers',()=>{
 const headers=stableUpstreamHeaders({cookie:'never-forward','tailscale-user-login':'routing-fixture@example.invalid','x-forwarded-for':'100.87.188.4'},5234,'hub','/melisa-hub/progress/evidence.json');assert.deepEqual(headers,{host:'127.0.0.1:5234',origin:STABLE_HUB_ORIGIN});
 for(const scope of [{'x-melisa-supplier-id':'1','x-melisa-currency':'TRY'},{'x-crm-conversation-id':'1'},{'x-erp-token':'fixture.payload.signature'}])assert.throws(()=>stableUpstreamHeaders(scope,5234,'hub','/melisa-hub/progress/evidence.json'));
});
