// Execute the real worker module against in-memory process/FS/TLS/HTTP doubles.
// No child, listener, credential file, SQL connection or real app is opened.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {desktopRuntimeInfo} from '../../packages/shared/src/desktopRuntimeInfo.mjs';
const source=readFileSync(new URL('./start-master-v5-worker.mjs',import.meta.url),'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(options={}){
 const root='C:/Users/Xaser/Desktop/ERP/kaynak-r1',base='C:/Users/Xaser/Desktop/ERP/',binding='kurulum/master-v5-export-journal/desktop-target.json',bindingBytes=Buffer.from('{}'),synthetic=Buffer.from('export const value=true;'),events=[],out=[],err=[],secret=Buffer.from('A9!'+'x'.repeat(43));
 const pkg={profile:options.profile??'desktop-master-v5',sourceRoot:root,dependencySha256:'a'.repeat(64),createdAt:'2026-11-06T15:00:00.000Z',publicFiles:{[binding]:options.badBinding?'b'.repeat(64):sha(bindingBytes)},sources:{[options.traversal?'apps/api/../private.mjs':'apps/api/src/fixture.mjs']:options.badSource?'c'.repeat(64):sha(synthetic)},assets:{'desktop-write-green.html':sha('synthetic')}};
 const bytes=Buffer.from(JSON.stringify(pkg)),connector={},sql={Request:class{}};let finish;
 const input={input:Promise.resolve(secret),isClosed:()=>options.earlyEof===true,done:new Promise(resolve=>{finish=resolve;})};
 const processDouble={argv:['node','worker',options.badManifest?'D'.repeat(64):sha(bytes).toUpperCase()],stdin:{},env:{MELISA_INVOICE_EXPORT_JOURNAL:options.badEnv?'C:\\elsewhere':'C:\\Users\\Xaser\\Desktop\\ERP\\kurulum\\master-v5-export-journal'},stdout:{write:x=>out.push(x)},stderr:{write:x=>err.push(x)},on(){},exitCode:0};
 const readFile=async(path,encoding)=>{let value;if(path===base+'kurulum/master-v5-package.json')value=bytes;else if(path===base+binding)value=bindingBytes;else if(path===root+'/apps/api/src/fixture.mjs')value=synthetic;else if(path===base+'kurulum/MELISAERP-sql-public.pem')value=Buffer.from('SYNTHETIC_PUBLIC_CERT');else throw Error('UNEXPECTED_FIXTURE_FILE');return encoding==='utf8'?value.toString('utf8'):Buffer.from(value);};
 const modules={
  'node:fs/promises':{readFile,realpath:async()=>options.badDependency?'C:\\foreign':'C:\\Users\\Xaser\\Desktop\\ERP\\kaynak\\apps\\api\\node_modules'},'node:crypto':{createHash},
  './start-initial-green-worker.mjs':{receiveReaderSecret:()=>input},'./sql-login-runtime-integrity.mjs':{inspectDesktopRuntimeTree:()=>({sha256:'a'.repeat(64)})},'../../packages/shared/src/desktopRuntimeInfo.mjs':{desktopRuntimeInfo},
  '../../apps/api/src/config/desktopWriteTlsConnector.mjs':{openDesktopMasterV5TlsConnector:async args=>{events.push('tls');assert.equal(args.password.length,46);return connector;},closeDesktopWriteTlsConnector:async c=>{assert.equal(c,connector);events.push('connector.close');}},
  '../../apps/api/src/config/desktopWriteRuntime.mjs':{registerDesktopWriteRuntime:c=>{assert.equal(c,connector);events.push('register');}},'../../apps/api/node_modules/mssql/index.js':{default:sql},'../../apps/api/src/services/invoiceDraftService.js':{},
  '../../apps/api/src/desktopWriteApplication.mjs':{createDesktopWriteApplication:args=>{assert.equal(args.connector,connector);assert.equal(args.runtimeInfo.schemaVersion,5);return {profile:options.wrongApp?'desktop-master-v4':'desktop-master-v5',closeSessions(){events.push('sessions.close');},app:{listen(port,host,done){assert.equal(port,4294);assert.equal(host,'127.0.0.1');events.push('api.listen');const server={once(){},close(fn){events.push('api.close');fn();}};queueMicrotask(done);return server;}}};}},
  './master-v3-web.mjs':{startMasterV3Web:async()=>{events.push('web.listen');return {async close(){events.push('web.close');}};}}
 };
 const context=vm.createContext({Buffer,process:processDouble,console:{},setTimeout,clearTimeout});const cache=new Map();
 async function resolve(id){assert(Object.hasOwn(modules,id),'No production import is allowed: '+id);if(cache.has(id))return cache.get(id);const values=modules[id],m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});cache.set(id,m);await m.link(()=>{throw Error('UNEXPECTED_NESTED_IMPORT');});await m.evaluate();return m;}
 const module=new vm.SourceTextModule(source,{context,importModuleDynamically:resolve});await module.link(resolve);const completion=module.evaluate();return {completion,finish,events,out,err,secret,processDouble};
}
test('V5 worker validates pins before startup and closes web/API/session/TLS on its owner pipe EOF',async()=>{
 const f=await fixture();for(let n=0;n<20&&!f.out.length;n++)await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.out,['DESKTOP_MASTER_V5_READY\n']);assert(f.secret.every(v=>v===0));f.finish();await f.completion;assert.deepEqual(f.events,['tls','register','api.listen','web.listen','web.close','api.close','sessions.close','connector.close']);assert.deepEqual(f.err,[]);assert.equal(f.processDouble.exitCode,0);
});
test('wrong manifest/profile/binding/env/source/dependency cannot open a writer or a listener',async()=>{
 for(const option of [{badManifest:true},{profile:'desktop-master-v4'},{badBinding:true},{badEnv:true},{badSource:true},{badDependency:true},{traversal:true}]){const f=await fixture(option);await f.completion;assert.deepEqual(f.events,[],JSON.stringify(option));assert.deepEqual(f.out,[]);assert.deepEqual(f.err,['MASTER_V5_START_FAILED\n']);assert(f.secret.every(v=>v===0));assert.equal(f.processDouble.exitCode,1);}
});
test('an owner disappearing during startup or wrong application profile closes all already-opened resources without READY',async()=>{
 for(const option of [{earlyEof:true},{wrongApp:true}]){const f=await fixture(option);await f.completion;assert.deepEqual(f.out,[]);assert.equal(f.events.at(-1),'connector.close');assert(f.secret.every(v=>v===0));if(option.earlyEof)assert(f.events.includes('api.close')&&f.events.includes('web.close'));assert.equal(f.processDouble.exitCode,1);}
});
