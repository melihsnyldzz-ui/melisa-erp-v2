// Execute the real worker with a real in-memory input stream and public FS/TLS/HTTP doubles.
// No listener, SQL, child process, private file or real credential is opened.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {PassThrough} from 'node:stream';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {receiveReaderSecret} from './start-initial-green-worker.mjs';
const source=readFileSync(new URL('./start-master-v7-worker.mjs',import.meta.url),'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture({empty=true,badProfile=false,badManifest=false,badWeb=false}={}){
 const base='C:/Users/Xaser/Desktop/ERP/',root=base+(empty?'runtime-clean-v7':'kaynak-r1'),profileId=empty?'empty-db9-v7-v1':null,binding=empty?'kurulum/empty-profile-db9-v1/export-journal/desktop-target.json':'kurulum/master-v5-export-journal/desktop-target.json';
 const publicBytes=Buffer.from('{}'),synthetic=Buffer.from('synthetic source'),events=[],out=[],err=[],stdin=new PassThrough();let received;
 const profileBinding={targetProfile:profileId,publicPath:binding,exportDirectory:base+(empty?'kurulum/empty-profile-db9-v1/export-journal':'kurulum/master-v5-export-journal')};
 const pkg={profile:'desktop-master-v7',sourceRoot:root,targetProfile:profileId,dependencySha256:'a'.repeat(64),createdAt:'2030-01-01T00:00:00.000Z',publicFiles:{[binding]:sha(publicBytes)},sources:{'apps/api/src/fixture.mjs':sha(synthetic)},assets:{'desktop-write-green.html':sha('fixture')}};
 const bytes=Buffer.from(JSON.stringify(pkg)),sql={Request:class{}},connector={};
 const processDouble={argv:['node',root+'/scripts/desktop-empty/start-master-v7-worker.mjs',badManifest?'0'.repeat(64):sha(bytes).toUpperCase(),'b'.repeat(64),...(empty?['empty-db9-v7-v1']:[])],env:{MELISA_INVOICE_EXPORT_JOURNAL:profileBinding.exportDirectory.replaceAll('/','\\')},stdin,stdout:{write:s=>out.push(s)},stderr:{write:s=>err.push(s)},on(){},exit:()=>assert.fail('no fatal process exit expected'),exitCode:0};
 const modules={
  'node:fs/promises':{realpath:async()=> 'C:\\Users\\Xaser\\Desktop\\ERP\\kaynak\\apps\\api\\node_modules',readFile:async(p,encoding)=>{let v;if(p===base+'kurulum/'+(empty?'empty-profile-db9-v1/runtime-package.json':'master-v7-package.json'))v=bytes;else if(p===base+binding)v=publicBytes;else if(p===root+'/apps/api/src/fixture.mjs')v=synthetic;else if(p===base+'kurulum/MELISAERP-sql-public.pem')v=Buffer.from('PUBLIC_FIXTURE_CERT');else throw Error('UNEXPECTED_PUBLIC_PATH');return encoding==='utf8'?v.toString():Buffer.from(v);}},
  'node:crypto':{createHash},'node:url':{fileURLToPath},
  './start-initial-green-worker.mjs':{receiveReaderSecret:s=>{const v=receiveReaderSecret(s);v.input.then(b=>{received=b;}).catch(()=>{});return v;}},
  './sql-login-runtime-integrity.mjs':{inspectDesktopRuntimeTree:()=>({sha256:'a'.repeat(64)})},
  '../../packages/shared/src/desktopRuntimeInfo.mjs':{desktopRuntimeInfo:args=>args},
  './master-v7-profile-binding.mjs':{readMasterV7Profile:()=>{stdin.write(Buffer.from('A9!'+'x'.repeat(43)));if(badProfile)throw Error('PRIVATE_CANARY_MUST_NOT_LEAK');return profileBinding;}},
  '../../apps/api/src/config/desktopWriteTlsConnector.mjs':{openDesktopEmptyV7TlsConnector:async args=>{assert(empty);assert.equal(args.password.length,46);events.push('tls');return connector;},openDesktopMasterV7TlsConnector:async args=>{assert(!empty);assert.equal(args.password.length,46);events.push('tls');return connector;},closeDesktopWriteTlsConnector:async()=>events.push('connector.close')},
  '../../apps/api/src/config/desktopWriteRuntime.mjs':{registerDesktopWriteRuntime:()=>events.push('register')},'../../apps/api/node_modules/mssql/index.js':{default:sql},'../../apps/api/src/services/invoiceDraftService.js':{},
  '../../apps/api/src/desktopWriteApplication.mjs':{createDesktopWriteApplication:()=>({profile:'desktop-master-v7',closeSessions:()=>events.push('sessions.close'),app:{listen(port,host,done){assert.equal(port,4294);assert.equal(host,'127.0.0.1');events.push('api.listen');const api={once(){},close(fn){events.push('api.close');fn();}};queueMicrotask(done);return api;}}})},
  './master-v3-web.mjs':{startMasterV3Web:async(assets,context)=>{assert.equal(context.targetProfile,profileId);assert.equal(context.runtimeRoot,root);assert.equal(assets['desktop-write-green.html'],pkg.assets['desktop-write-green.html']);events.push('web.enter');if(badWeb)throw Error('SENSITIVE_DRIVER_CANARY');return {close:async()=>events.push('web.close')};}}
 };
 const context=vm.createContext({Buffer,process:processDouble,console:{}}),cache=new Map();
 async function resolve(id){assert(Object.hasOwn(modules,id),'Unexpected production import '+id);if(cache.has(id))return cache.get(id);const v=modules[id],m=new vm.SyntheticModule(Object.keys(v),function(){for(const [k,x]of Object.entries(v))this.setExport(k,x);},{context});cache.set(id,m);await m.link(()=>{throw Error('NESTED_IMPORT');});await m.evaluate();return m;}
 const module=new vm.SourceTextModule(source,{context,initializeImportMeta:meta=>{meta.url=pathToFileURL(root+'/scripts/desktop-empty/start-master-v7-worker.mjs').href;},importModuleDynamically:resolve});await module.link(resolve);const completion=module.evaluate();
 return {completion,events,out,err,stdin,processDouble,get received(){return received;}};
}
test('V7 worker forwards the verified finite root for both profiles and normal owner EOF closes resources',async()=>{
 for(const empty of [false,true]){const f=await fixture({empty});for(let n=0;n<30&&!f.out.length;n++)await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.out,['DESKTOP_MASTER_V7_READY\n']);assert(f.received?.every(x=>x===0));f.stdin.end();await f.completion;assert.deepEqual(f.events,['tls','register','api.listen','web.enter','web.close','api.close','sessions.close','connector.close']);assert.deepEqual(f.err,[]);assert.equal(f.processDouble.exitCode,0);}
});
test('early public failure is a finite phase, drains/zeros input and finishes without waiting for parent EOF',async()=>{
 for(const [options,phase]of [[{badProfile:true},'PUBLIC_PROFILE'],[{badManifest:true},'MANIFEST']]){const f=await fixture(options);await f.completion;await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.out,[]);assert.deepEqual(f.events,[]);assert.deepEqual(f.err,[`MASTER_V7_START_FAILED:${phase}\n`]);assert(f.stdin.destroyed);assert(f.received?.every(x=>x===0));assert.equal(f.processDouble.exitCode,1);}
});
test('web failure never emits READY, closes API/session/TLS and exposes no exception content',async()=>{
 const f=await fixture({badWeb:true});await f.completion;await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.out,[]);assert.deepEqual(f.err,['MASTER_V7_START_FAILED:WEB_LISTEN\n']);assert(f.stdin.destroyed);assert(f.received.every(x=>x===0));assert.deepEqual(f.events,['tls','register','api.listen','web.enter','api.close','sessions.close','connector.close']);assert.equal(f.processDouble.exitCode,1);
});
