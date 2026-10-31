import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import config,{assertBusinessBuildEnvironment} from '../../vite.config.mjs';

const profile='ERP-5244-REALDATA-20261027';
test('business build requires the explicit profile, loopback API and normal login',()=>{
 const good={VITE_ERP_WORKFACE:profile,VITE_API_BASE_URL:'http://127.0.0.1:4144',VITE_LOCAL_PASSWORDLESS_LOGIN:'false'};
 assert.doesNotThrow(()=>assertBusinessBuildEnvironment(good,'business'));
 for(const value of [{},{...good,VITE_ERP_WORKFACE:'wrong'},{...good,VITE_API_BASE_URL:'http://127.0.0.1:4194'},{...good,VITE_LOCAL_PASSWORDLESS_LOGIN:'true'}])assert.throws(()=>assertBusinessBuildEnvironment(value,'business'),/BUSINESS_BUILD_PROFILE_REQUIRED/);
 assert.doesNotThrow(()=>assertBusinessBuildEnvironment({},'production'));
});
test('actual emitted business assets resolve the default session target before normal authentication',async()=>{
 const values={VITE_ERP_WORKFACE:profile,VITE_API_BASE_URL:'http://127.0.0.1:4144',VITE_LOCAL_PASSWORDLESS_LOGIN:'false'};
 const before=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
 Object.assign(process.env,values);
 try{
  const entry=new URL('./workingCatalogSession.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/,'$1');
  const resolver=new URL('./testAdminSession.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/,'$1');
  const code=`import {createWorkingCatalogSession} from ${JSON.stringify(entry)};import {resolveTestApiBase} from ${JSON.stringify(resolver)};
export async function inspect(host,port='5244'){const location={protocol:'http:',hostname:host,port,origin:'http://'+host+':'+port},apiBase=import.meta.env.VITE_API_BASE_URL,calls=[];const session=createWorkingCatalogSession({location,apiBase,protectedDevice:null,storage:{getItem(){return null},setItem(){},removeItem(){}},fetchImpl:async(url,options)=>{calls.push({url,method:options.method});return{ok:false,status:401,json:async()=>({success:false})}}});try{await session.start();return{target:resolveTestApiBase({location,apiBase}),calls}}finally{session.dispose()}}`;
  const result=await build({configFile:false,mode:'business',logLevel:'silent',plugins:[config.plugins[0],{name:'business-session-probe',resolveId:id=>id==='virtual:business-session-probe'?id:null,load:id=>id==='virtual:business-session-probe'?code:null}],build:{write:false,minify:true,rollupOptions:{input:'virtual:business-session-probe',preserveEntrySignatures:'strict',output:{format:'es',inlineDynamicImports:true}}}});
  const module=await import('data:text/javascript;base64,'+Buffer.from(result.output.find(x=>x.type==='chunk').code+'\n//# sourceURL=business-build-contract.mjs').toString('base64'));
  for(const host of ['127.0.0.1','192.168.1.46']){const actual=await module.inspect(host);assert.equal(actual.target,`http://${host}:5244`);assert.deepEqual(actual.calls,[{url:`http://${host}:5244/api/auth/refresh`,method:'POST'}]);}
  for(const [host,port]of [['foreign','5244'],['192.168.1.46','5245']])await assert.rejects(()=>module.inspect(host,port),/Bu çalışma bağlantısı kullanılamıyor/);
 }finally{for(const [key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
