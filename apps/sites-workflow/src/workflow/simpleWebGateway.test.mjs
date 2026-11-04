import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {createSimpleWebGateway,createWindowsBackendVerifier,startSimpleWebGateway,backendProofBootstrap} from '../../business-web-gateway.mjs';
import {simpleWebFixture} from './simpleWebFixtures.mjs';
import {businessSessionCookie} from '../../business-preview-session.mjs';
const response=(body,status=200,headers={})=>new Response(typeof body==='object'&&!Buffer.isBuffer(body)?JSON.stringify(body):body,{status,headers});
async function call(gateway,{url='/ornek-akis.html',method='GET',headers={},body,local='192.168.1.46',remote='192.168.1.55',rawHeaders=[]}={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);Object.assign(req,{url,method,headers:{host:'192.168.1.46:5244',...headers},socket:{localAddress:local,remoteAddress:remote},rawHeaders});let status,out,bytes;const res={headersSent:false,writeHead(s,h){status=s;out=h;this.headersSent=true;},end(b){bytes=b===undefined?Buffer.alloc(0):Buffer.from(b);}};await gateway.handler(req,res);return {status,headers:out,bytes,json:()=>JSON.parse(bytes)};
}
async function setup({api,asset,verifyBackend=async()=>{}}={}){
 const f=simpleWebFixture(),calls=[];
 const fetchImpl=async(url,o={})=>{calls.push({url,o});if(url===f.release.backend.origin+'/test-health')return response(f.health);if(url.startsWith(f.settings.iisOrigin+'/'))return asset?asset(url,o,f):response(f.pair.candidate.files.get('ui/'+url.slice(f.settings.iisOrigin.length+1)));return api?api(url,o):response({success:true,data:{fixture:true}});};
 const gateway=createSimpleWebGateway({...f,verifyBackend,fetchImpl});await gateway.prepare();return {...f,gateway,calls};
}
test('all manifest public assets are verified once; no auth reaches IIS; old/new chunks and HEAD are served from cache',async()=>{
 const s=await setup();const before=s.calls.length;for(const url of ['/ornek-akis.html','/assets/old.js','/assets/next.js'])assert.equal((await call(s.gateway,{url})).status,200);const head=await call(s.gateway,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.bytes.length,0);assert.equal(s.calls.length,before);for(const c of s.calls.filter(c=>c.url.startsWith(s.settings.iisOrigin)))assert.deepEqual(c.o.headers,{'Accept-Encoding':'identity'});
 for(const url of ['/web.config','/../index.html','/%2e%2e/index.html','/runtime/apps/sites-workflow/business-web-gateway.mjs','/unknown.js'])assert.equal((await call(s.gateway,{url})).status,404);
});
test('socket, exact origin, forwarded and duplicate sensitive headers fail closed',async()=>{
 const {gateway,calls}=await setup();const before=calls.length;
 for(const opts of [{headers:{host:'evil:5244'}},{remote:'192.168.2.5'},{local:'127.0.0.1'},{headers:{origin:'http://evil'}},{headers:{'x-forwarded-something':'1'}},{headers:{forwarded:'x'}},{headers:{'sec-fetch-site':'cross-site'}},{rawHeaders:['Host','x','hOsT','y']},{url:'//evil/'}])assert.equal((await call(gateway,opts)).status,403);
 assert.equal((await call(gateway,{method:'POST',url:'/api/auth/login',body:{}})).status,403);assert.equal(calls.length,before);
});
test('unknown API mutations and legacy admin, SQL, CRM or receiving routes never proxy',async()=>{
 const {gateway,calls}=await setup();const before=calls.length;for(const url of ['/api/admin','/api/sql','/api/receiving','/api/crm/orders','/api/catalog/products/../1'])assert.equal((await call(gateway,{url,method:'POST',body:{},headers:{origin:'http://192.168.1.46:5244'}})).status,403);assert.equal(calls.length,before);
});
test('read proxy strips cookie/claimed identity and response cookies; bearer remains API-owned',async()=>{
 let upstream;const s=await setup({api:async(url,o)=>{upstream={url,o};return response({data:[1]},200,{'Set-Cookie':'foreign=1'});}});
 const r=await call(s.gateway,{url:'/api/catalog/products?pageSize=50',headers:{authorization:'Bearer fixture',cookie:'private-fixture','x-actor-id':'1'}});assert.equal(r.status,200);assert.equal(upstream.o.headers.authorization,'Bearer fixture');assert.equal(upstream.o.headers.cookie,undefined);assert.equal(upstream.o.headers['x-actor-id'],undefined);assert.equal(r.headers['set-cookie'],undefined);
});
test('existing login cookie lifecycle is unchanged and POST fences backend before one upstream call',async()=>{
 let proofs=0;const s=await setup({verifyBackend:async()=>{proofs++;},api:async()=>response({success:true,data:{user:{id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'}},accessToken:'fixture-access',refreshToken:'A'.repeat(43),expiresAt:Date.now()+900000,refreshExpiresAt:Date.now()+86400000}})});
 const before=proofs,r=await call(s.gateway,{url:'/api/auth/login',method:'POST',body:{username:'semih',password:'synthetic-only'},headers:{origin:'http://192.168.1.46:5244'}});assert.equal(r.status,200);assert.match(r.headers['Set-Cookie'],new RegExp('^'+businessSessionCookie+'='));assert.match(r.headers['Set-Cookie'],/Path=\/api\/auth; HttpOnly; SameSite=Strict/);assert.equal(r.json().data.refreshToken,undefined);assert.equal(proofs-before,2);assert.equal(s.calls.filter(c=>c.url.endsWith('/api/auth/login')).length,1);
});
test('wrong actor rejected, and lost sale response is never automatically retried',async()=>{
 const actor={id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'},isActive:true,isAdmin:false,testAdminSession:false,permissions:['sales.view','sales.create','sales.finalize','sales.cancel','customer.view','product.view','finance.view']};let writes=0;
 const s=await setup({api:async(url)=>{if(url.endsWith('/auth/me'))return response({success:true,data:actor,meta:{source:'jwt-auth'}});writes++;throw Error('synthetic lost response');}});
 const body={customerId:'155',customerAccountId:'7',currency:'USD',documentDate:'2026-10-28',items:[{productId:'12',quoteId:'81',quantityExact3:'1.000'}],requestId:'11111111-1111-4111-8111-111111111111',expectedRevision:'a'.repeat(64),previewHash:'b'.repeat(64)};
 const r=await call(s.gateway,{method:'POST',url:'/api/work-sales/drafts',body,headers:{origin:'http://192.168.1.46:5244',authorization:'Bearer fixture'}});assert.equal(r.status,503);assert.equal(writes,1);
 actor.id=1;assert.equal((await call(s.gateway,{method:'POST',url:'/api/work-sales/drafts',body,headers:{origin:'http://192.168.1.46:5244',authorization:'Bearer fixture'}})).status,403);assert.equal(writes,1);
});
test('untrusted IIS compression, redirects, cookie, corrupt or oversized bytes prevent all serving',async()=>{
 for(const mode of ['gzip','redirect','cookie','corrupt','oversize']){
  const f=simpleWebFixture();const gateway=createSimpleWebGateway({...f,verifyBackend:async()=>{},fetchImpl:async(url)=>url.endsWith('/test-health')?response(f.health):mode==='gzip'?response('x',200,{'Content-Encoding':'gzip'}):mode==='redirect'?response('x',302,{Location:'/index.html'}):mode==='cookie'?response('x',200,{'Set-Cookie':'x=1'}):response(mode==='oversize'?'x'.repeat(1024):'corrupt')});
  await assert.rejects(gateway.prepare());assert.equal((await call(gateway)).status,503);await assert.rejects(gateway.prepare());
 }
});
test('backend verifier gates readiness, process drift rejects API reads and fresh mutation fencing cannot fall back',async()=>{
 let rejected=false;const s=await setup({verifyBackend:async()=>{if(rejected)throw Error('synthetic drift');}});rejected=true;const before=s.calls.length;assert.equal((await call(s.gateway,{url:'/api/catalog/products'})).status,503);assert.equal(s.calls.length,before);assert.equal((await call(s.gateway)).status,200);assert.throws(()=>createSimpleWebGateway(s),/WEB_BACKEND_VERIFIER_REQUIRED/);
});
test('Windows probe is injectable offline, bounded, cached only for reads, fresh on writes and never adopts restarted API',async()=>{
 const f=simpleWebFixture();let count=0,now=0,id=40;const calls=[];const execute=async(file,args,o)=>{count++;calls.push({file,args,o});return {stdout:JSON.stringify({schema:'melisa-simple-web-backend-proof.v1',sourceCommit:f.release.backend.sourceCommit,packageId:f.release.backend.packageId,manifestSha256:f.release.backend.manifestSha256,ownerVerified:true,api:{pid:id,birth:'2026-11-02T10:00:00.123456Z'},native:{pid:41,birth:'2026-11-02T10:00:01.123456Z'},runtimeWrites:0,sqlCalls:0})};};
 const v=createWindowsBackendVerifier({root:'synthetic-root',backend:f.release.backend,settings:f.settings,proofSha256:'7'.repeat(64),execute,readFile:()=>Buffer.from('fixture-ps'),clock:()=>now});await v();await v();assert.equal(count,1);await v({fresh:true});assert.equal(count,2);now=5001;await v();assert.equal(count,3);assert(calls[0].args.at(-1).endsWith("'true'"));assert(calls[1].args.at(-1).endsWith("'false'"));assert.match(calls[0].args.at(-1),/FileShare\]::Read/);assert.equal(calls[0].o.env.PSModulePath,'');assert.equal(calls[0].o.timeout,15000);assert(!calls[0].args.some(a=>/EncodedCommand|ExecutionPolicy/.test(a)));id=42;await assert.rejects(v({fresh:true}),/RESTART/);await assert.rejects(v(),/PROOF_REJECTED/);assert.equal(count,4);
});
test('unsupported invocation never starts a listener',async()=>{await assert.rejects(startSimpleWebGateway([]),/WEB_START_NOT_AUTHORIZED/);});
test('probe invocation executes verified held bytes and never reopens the script pathname for execution',()=>{
 assert.match(backendProofBootstrap,/ComputeHash\(\$sourceBytes\)/);assert.match(backendProofBootstrap,/\[scriptblock\]::Create\(\[Text.Encoding\]::UTF8.GetString\(\$sourceBytes\)\)/);assert.doesNotMatch(backendProofBootstrap,/&\s*\$Proof/);
});

 test('customer master uses the actual packaged gateway, fresh normal session, finite paths and one POST on lost ACK',async()=>{
 const actor={id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'},isActive:true,isAdmin:false,testAdminSession:false,nativeTerminalSession:false,permissions:['customer.view','customer.edit']},uuid='11111111-1111-4111-8111-111111111111',body={requestId:uuid,expectedRevision:'A'.repeat(64),customerCode:'00155',customerName:'Fixture',customerType:'wholesale'};let writes=0;
 const s=await setup({api:async(url,o)=>{if(url.endsWith('/auth/me'))return response({success:true,data:actor,meta:{source:'jwt-auth'}});if(o.method==='POST'){writes++;throw Error('synthetic lost ACK');}return response({success:true,data:{fixture:true}});}});
 const headers={origin:'http://192.168.1.46:5244',authorization:'Bearer fixture'},url='/api/customers/155/master';
 assert.equal((await call(s.gateway,{url,headers})).status,200);assert.equal((await call(s.gateway,{url:url+'/requests/'+uuid,headers})).status,200);assert.equal((await call(s.gateway,{url,method:'POST',body,headers})).status,503);assert.equal(writes,1);
 for(const bad of [url+'?x=1',url+'/requests/'+uuid.replace('-4111-','-1111-'),'/api/customers/01/master'])assert.equal((await call(s.gateway,{url:bad,headers})).status,403);
 actor.nativeTerminalSession=true;assert.equal((await call(s.gateway,{url,method:'POST',body,headers})).status,403);assert.equal(writes,1);
});
