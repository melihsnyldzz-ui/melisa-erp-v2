import test,{mock} from 'node:test';import assert from 'node:assert/strict';import express from 'express';
// Execute the actual canonical entry, replacing every environment/native
// dependency. No installed process, SQL connection or fixed port is used.
let enabled=false,appUnderTest,ready=false;
const noop=(_req,_res,next)=>next(),noSql=()=>assert.fail('Bootstrap fixture must not access SQL');
mock.module('../../canonical-test-env.mjs',{namedExports:{configureCanonicalTest:async()=>({identity:{},port:4144,networkPolicy:{},release:{sourceCommit:'fixture',packageId:'fixture'},pool:{close:noSql},writes:false,env:{},config:{businessWorkface:{id:'ERP-5244-REALDATA-20261027'}},listenerPolicy:{hosts:['127.0.0.1']},businessSession:enabled?{userId:17}:null})}});
mock.module('../../canonical-test-listeners.mjs',{namedExports:{canonicalInboundAllowed:noSql,canonicalLanHost:noSql,canonicalInboundMiddleware:()=>noop,canonicalReadiness:()=>({markReady(){ready=true;},send(){}}),startCanonicalListeners:async app=>{appUnderTest=app;return {close:async()=>{}};}}});
mock.module('./catalogProductReadStore.mjs',{namedExports:{configureCatalogSourceVersion:noSql}});
mock.module('./currentFinanceDeltaRead.mjs',{namedExports:{configureCurrentFinanceContext(){}}});
mock.module('./partyCurrencyComparisonStore.mjs',{namedExports:{configurePartyCurrencyComparisonStore:async()=>{}}});
mock.module('./canonicalTestRoutePolicy.mjs',{namedExports:{isCanonicalTestWriteAllowed:()=>false}});
mock.module('../middleware/security.js',{namedExports:{securityHeaders:()=>noop,corsOptions:()=>({}),apiRateLimit:()=>noop}});
mock.module('../middleware/requestContext.js',{namedExports:{requestContext:noop}});
mock.module('../middleware/errorHandler.js',{namedExports:{errorHandler:(e,_req,res,_next)=>res.status(e.statusCode??500).json({code:e.code})}});
mock.module('./authService.js',{namedExports:{getUserById:noSql,verifyAccessToken:noSql,verifyNormalTestAccessSession:noSql}});
mock.module('./workSystemService.mjs',{namedExports:{configureWorkSystem(){}}});
mock.module('./dailyWebPolicy.mjs',{namedExports:{resolveDailyWebPolicy:()=>({}),dailyWebScopeMiddleware:()=>noop}});
for(const [file,name] of [['workSystemRoutes.mjs','workSystemRoutes'],['workReportsRoutes.mjs','workReportsRoutes'],['homeSummaryRoutes.mjs','homeSummaryRoutes'],['stockProductRoutes.mjs','stockProductRoutes'],['catalogRoutes.mjs','catalogProductsRoutes'],['pilotTerminalRoutes.mjs','pilotTerminalRoutes']])mock.module('../routes/'+file,{namedExports:{[name]:express.Router()}});
mock.module('../app.js',{namedExports:{createApp:()=>{const app=express();app.use((_req,res)=>res.status(404).json({code:'FIXTURE_NOT_FOUND'}));return app;}}});
test('actual canonical bootstrap mounts business selection after app/security and before fallback only for the registered profile',async()=>{
 const argv=process.argv,log=console.log,signals=new Map(['SIGINT','SIGTERM'].map(k=>[k,new Set(process.listeners(k))]));
 try{
  process.argv=['node','fixture','erp','fixture-config'];console.log=()=>{};
  for(const value of [false,true]){
   enabled=value;ready=false;appUnderTest=null;await import('../../start-canonical-test.mjs?selection-fixture='+value);assert.equal(ready,true);assert(appUnderTest);
   const server=appUnderTest.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
   try{for(const path of ['/api/business-sales/selection','/api/business-party-history/customer/155/7?currency=USD']){const response=await fetch('http://127.0.0.1:'+server.address().port+path);assert.equal(response.status,value?401:404);assert.equal(response.headers.get('x-melisa-environment'),'CANONICAL-TEST');}}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  }
 }finally{process.argv=argv;console.log=log;for(const [name,before] of signals)for(const listener of process.listeners(name))if(!before.has(listener))process.removeListener(name,listener);}
});
