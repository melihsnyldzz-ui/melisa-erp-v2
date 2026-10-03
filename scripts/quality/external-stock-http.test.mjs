import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';

// Actual server, routes, auth and source adapter; only SQL/product dependencies
// are replaced. The VM cannot import environment files, drivers or other routes.
test('external stock HTTP source/auth/error contract on an isolated loopback server', async () => {
  const root=path.resolve('apps/api/src'), require=createRequire(path.join(root,'externalReadOnlyServer.js'));
  const express=require('express'), calls=[], outcomes=[];
  const config={database:'VEGA2026',companyCode:'F0102',periodCode:'D0007'};
  const environment={EXTERNAL_READ_ONLY_HOST:'127.0.0.1',EXTERNAL_READ_ONLY_PORT:'0',
    EXTERNAL_READ_ONLY_ENABLED:'false',EXTERNAL_READ_ONLY_API_KEY:'synthetic-http-test-only',EXTERNAL_READ_ONLY_MAX_ROWS:'7'};
  let server, mode='normal';
  const product={source:'vega',sourceId:11,stockCode:'VEGA-TEST',stockQuantity:null,currency:null};
  const vegaList=async query=>{
    calls.push({source:'vega',kind:'list',query});
    if(mode==='offline')throw Object.assign(Error('SYNTHETIC_PRIVATE_DRIVER_DETAIL'),{statusCode:503,code:'TEST_SOURCE_OFFLINE'});
    const data=query.stockCodes?.[0]==='MISSING'?[]:mode==='duplicate'?[product,product]:[product];
    return {data,meta:{source:mode==='wrong-source'?'melisa':'vega-live-read-only'}};
  };
  const bionic={
    getBionicSqlHealth:async()=>({databaseName:'SYNTHETIC_MELISA',readOnly:true}),
    getBionicStockCodeCount:async()=>{calls.push({source:'melisa',kind:'count'});return {stockCodeCount:3,source:'dbo.products'};},
    listBionicStockCodes:async query=>{calls.push({source:'melisa',kind:'list',query});return [{id:22,stockCode:'MELISA-TEST'}];},
    getBionicStockByCode:async code=>{calls.push({source:'melisa',kind:'detail',code});return {id:22,stockCode:code};},
  };
  const wrappedExpress=()=>{
    const app=express(), listen=app.listen.bind(app);
    app.listen=(port,host,callback)=>{assert.equal(port,0);assert.equal(host,'127.0.0.1');server=listen(port,host,callback);return server;};
    return app;
  };
  wrappedExpress.json=express.json;
  const context=vm.createContext({Buffer,URL,console:{log(){},error(){}},setTimeout,clearTimeout,
    process:{env:environment,on(){},exit(){throw Error('Unexpected process exit');}}});
  const allowed=new Set(['externalReadOnlyServer.js','routes/externalReadOnlyRoutes.js',
    'middleware/externalReadOnlyAuth.js','services/externalReadOnlyStockService.js']);
  const synthetic={
    express:{default:wrappedExpress,Router:express.Router},
    'node:crypto':{default:crypto},
    'config/env.js':{env:{vega:config}},
    'services/bionicReadOnlySqlService.js':bionic,
    'services/vegaProductService.js':{getVegaProductsList:vegaList},
    'config/vegaDatabase.js':{getVegaSqlPool:async()=>({request:()=>({query:async sql=>{
      assert.match(sql,/FROM dbo\.F0102TBLSTOKLAR/);calls.push({source:'vega',kind:'count'});
      return {recordset:[{stockCodeCount:2,nonDeletedProductCount:4,activeProductCount:3}]};
    }})})},
  };
  const modules=new Map();
  function load(name){
    if(modules.has(name))return modules.get(name);
    let module;
    if(synthetic[name])module=new vm.SyntheticModule(Object.keys(synthetic[name]),function(){
      for(const [key,value] of Object.entries(synthetic[name]))this.setExport(key,value);
    },{context,identifier:name});
    else {assert.ok(allowed.has(name),`Unexpected import ${name}`);module=new vm.SourceTextModule(fs.readFileSync(path.join(root,name),'utf8'),{context,identifier:name});}
    modules.set(name,module);return module;
  }
  const entry=load('externalReadOnlyServer.js');
  await entry.link((specifier,ref)=>load(specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),specifier)):specifier));
  try {
    await entry.evaluate();if(!server.listening)await once(server,'listening');
    const origin=`http://127.0.0.1:${server.address().port}`;
    async function request(route,status,{key='synthetic-http-test-only',method='GET'}={}){
      const response=await fetch(origin+route,{method,headers:key?{'x-melisa-read-key':key}:{},signal:AbortSignal.timeout(3000)});
      const body=await response.json();assert.equal(response.status,status,`${route}: ${JSON.stringify(body)}`);
      assert.equal(response.headers.get('cache-control'),'no-store');outcomes.push({route,method,status});return body;
    }
    await request('/stock-codes',503);assert.equal(calls.length,0);
    environment.EXTERNAL_READ_ONLY_ENABLED='true';
    await request('/stock-codes',401,{key:''});await request('/stock-codes',401,{key:'wrong'});assert.equal(calls.length,0);
    const vega=await request('/stock-codes?limit=999',200);assert.equal(vega.meta.source,'vega');assert.equal(vega.data[0].sourceId,11);assert.equal(vega.data[0].stockQuantity,null);assert.equal(calls.at(-1).query.limit,7);
    const melisa=await request('/stock-codes?source=melisa',200);assert.equal(melisa.meta.source,'melisa');assert.equal(melisa.data[0].id,22);
    const beforeInvalid=calls.length;await request('/stock-codes?source=unknown',400);await request('/stock-codes?source=vega&source=melisa',400);assert.equal(calls.length,beforeInvalid);
    const count=await request('/stock-codes/count',200);assert.equal(count.data.stockCodeCount,2);assert.equal(count.data.nonDeletedProductCount,4);assert.equal(count.data.database,'VEGA2026');
    assert.equal((await request('/stock-codes/count?source=melisa',200)).data.stockCodeCount,3);
    assert.equal((await request('/stock-codes/VEGA-TEST',200)).data.sourceId,11);
    assert.equal((await request('/stock-codes/MELISA-TEST?source=melisa',200)).data.id,22);
    await request('/stock-codes/MISSING',404);
    mode='duplicate';await request('/stock-codes/VEGA-TEST',409);
    mode='wrong-source';await request('/stock-codes',502);
    mode='offline';const unavailable=await request('/stock-codes',503);assert.ok(!JSON.stringify(unavailable).includes('SYNTHETIC_PRIVATE_DRIVER_DETAIL'));
    const beforeDenied=calls.length;await request('/stock-codes',404,{method:'POST'});await request('/query',404,{method:'POST'});assert.equal(calls.length,beforeDenied);
    console.log(JSON.stringify({httpChecks:outcomes.length,realDatabaseCalls:0,outcomes}));
  } finally {if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
});
