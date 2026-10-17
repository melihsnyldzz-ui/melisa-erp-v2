import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {canonicalListenerPolicy,validateCanonicalWebConfig,startCanonicalListeners,canonicalInboundAllowed,canonicalInboundMiddleware,canonicalReadiness} from './canonical-test-listeners.mjs';
import {canonicalTestAdminContext,assertTestAdminRequest,resolveTestAdminUser,testAdminClaims} from './src/services/canonicalTestAdminSession.mjs';
const config={database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'127.0.0.1',sqlPort:1433,host:'127.0.0.1',erpPort:4144,nativePort:4146,webPort:5194,salesEnabled:true,lanHost:'192.168.1.46'};
const lan=()=>canonicalListenerPolicy(config,{mode:'erp',writes:true});
test('opt-in exact adapter only; local, native and readonly scopes remain loopback',()=>{
 assert.deepEqual(lan().hosts,['127.0.0.1','192.168.1.46']);
 assert.deepEqual(canonicalListenerPolicy({}, {mode:'erp',writes:true}).hosts,['127.0.0.1']);
 for(const mode of ['native','erp'])assert.deepEqual(canonicalListenerPolicy(config,{mode,writes:mode==='native'}).hosts,['127.0.0.1']);
 for(const lanHost of ['0.0.0.0','::','192.168.1.47','192.168.1.46 ',null,''])assert.throws(()=>canonicalListenerPolicy({...config,lanHost},{mode:'erp',writes:true}),/TEST_LAN_HOST_REJECTED/);
});
test('web validates named TEST identity and CORS adds only exact LAN web origin',()=>{
 assert.equal(validateCanonicalWebConfig(config).lanEnabled,true);
 for(const patch of [{database:'LIVE'},{host:'0.0.0.0'},{server:'192.168.1.46'},{webPort:5195}])assert.throws(()=>validateCanonicalWebConfig({...config,...patch}),/TEST_CONFIG_IDENTITY_REJECTED/);
 assert.deepEqual(lan().corsOrigins,['http://127.0.0.1:5194','http://localhost:5194','http://192.168.1.46:5194']);
});
test('two explicit listeners finish before readiness; second failure closes both',async()=>{
 const opened=[],closed=[];
 const app={listen(port,host,ready){const server=new EventEmitter();opened.push({port,host});server.close=done=>{closed.push(host);done();};queueMicrotask(ready);return server;}};
 const listeners=await startCanonicalListeners(app,{port:4144,policy:lan()});assert.equal(opened.length,2);await listeners.close();assert.equal(closed.length,2);
 opened.length=0;closed.length=0;
 const failing={listen(port,host,ready){const server=app.listen(port,host,()=>host==='192.168.1.46'?server.emit('error',Error('bind failed')):ready());return server;}};
 await assert.rejects(startCanonicalListeners(failing,{port:4144,policy:lan()}),/bind failed/);assert.equal(closed.length,2);
});
test('LAN inbound requires actual peer /24 and exact Host; forwarded identity cannot override',()=>{
 const opts={port:4144,policy:lan()};
 for(const remoteAddress of ['127.0.0.1','192.168.1.80','::ffff:192.168.1.80'])assert.equal(canonicalInboundAllowed({remoteAddress,host:'192.168.1.46:4144'},opts),true);
 for(const remoteAddress of ['10.0.0.1','100.100.1.1','192.168.2.1','192.168.1.256','192.168.1.080',undefined])assert.equal(canonicalInboundAllowed({remoteAddress,host:'192.168.1.46:4144'},opts),false);
 for(const host of ['evil.example:4144','192.168.1.46','192.168.1.47:4144','192.168.1.46:5194',undefined])assert.equal(canonicalInboundAllowed({remoteAddress:'192.168.1.80',host},opts),false);
 let denied=false,next=false;
 canonicalInboundMiddleware(opts)({socket:{remoteAddress:'10.0.0.1'},headers:{host:'192.168.1.46:4144','x-forwarded-for':'127.0.0.1'}},{status:n=>{assert.equal(n,403);return{json:()=>{denied=true;}};}},()=>{next=true;});assert.equal(denied,true);assert.equal(next,false);
});
test('health remains 503 while second interface is pending and becomes ready only after both',async()=>{
 const gate=canonicalReadiness();let secondReady;const statuses=[];
 const response={status:n=>{statuses.push(n);return{json:body=>{assert.equal(body.ok,n===200);}};}};
 const app={listen(_port,host,ready){const server=new EventEmitter();server.close=done=>done();if(host==='127.0.0.1')queueMicrotask(ready);else secondReady=ready;return server;}};
 const pending=startCanonicalListeners(app,{port:4144,policy:lan()}).then(listeners=>{gate.markReady();return listeners;});
 await new Promise(resolve=>setImmediate(resolve));gate.send(response,{ok:true});assert.deepEqual(statuses,[503]);
 secondReady();const listeners=await pending;gate.send(response,{ok:true});assert.deepEqual(statuses,[503,200]);await listeners.close();
});
test('existing TEST ADMIN bootstrap and copied admin bearer remain rejected from LAN peer',()=>{
 const identity={databaseName:config.database,serverName:'Semih\\MELISADEV',loginName:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',sysadmin:0,databaseControl:0,liveDatabaseAccess:0};
 const middleware=canonicalTestAdminContext({identity,mode:'erp',port:4144,writes:true,env:{sql:{database:config.database}}});
 const req={socket:{remoteAddress:'192.168.1.80'},get:key=>key==='host'?'127.0.0.1:4144':'http://127.0.0.1:5194'};middleware(req,{},()=>{});
 assert.throws(()=>assertTestAdminRequest(req,{bootstrap:true}),{code:'TEST_ADMIN_SCOPE'});assert.throws(()=>resolveTestAdminUser(req,testAdminClaims,{id:16}),{code:'TEST_ADMIN_SCOPE'});
 assert.deepEqual(resolveTestAdminUser(req,{sub:'14'},{id:14}),{id:14});
});
test('source integration preserves outbound restrictions and passes config to web launch',()=>{
 const env=fs.readFileSync(new URL('./canonical-test-env.mjs',import.meta.url),'utf8'),starter=fs.readFileSync(new URL('./start-canonical-test.mjs',import.meta.url),'utf8'),web=fs.readFileSync(new URL('./start-canonical-web.mjs',import.meta.url),'utf8'),ps=fs.readFileSync(new URL('../../scripts/canonical/start-test.ps1',import.meta.url),'utf8'),network=fs.readFileSync(new URL('./canonical-test-network.mjs',import.meta.url),'utf8');
 assert.match(env,/CORS_ORIGINS:listenerPolicy.corsOrigins.join/);assert.match(starter,/canonicalInboundMiddleware/);assert.match(web,/validateCanonicalWebConfig/);assert.match(ps,/start-canonical-web.mjs'\);Args=@\(\$ConfigPath\)/);
 for(const source of [starter,web]){assert.match(source,/readiness.send\(res/);assert.ok(source.indexOf('readiness.markReady();')>source.indexOf('await startCanonicalListeners('));}
 assert.doesNotMatch(network,/192\.168/);assert.match(network,/externalMessages: false/);
});
