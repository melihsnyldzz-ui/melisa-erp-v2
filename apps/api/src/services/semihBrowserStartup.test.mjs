import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../start-shared-test-copy.mjs',import.meta.url),'utf8');
const start=source.indexOf('if(config.semihBrowserSessionEnabled===true){'),end=source.indexOf("const {env}=await import",start);
const body=source.slice(start,end).replace("await import('./src/services/semihTestIdentityPolicy.mjs')",'await loadIdentity()');
const run=new (Object.getPrototypeOf(async function(){}).constructor)('config','context','writes','process','copyAssert','loadIdentity',body);
test('production startup flag only reaches ERP after exact configured17; native, disabled and identity drift do not enable it',async()=>{
 const config={semihBrowserSessionEnabled:true,semihTestIdentity:{path:'fixture',sha256:'fixture'}},context={copyId:'fixture'},check=(v,c)=>assert(v,c);
 for(const writes of [false,true]){const process={env:{}};await run(config,context,writes,process,check,async()=>({configuredSemihTestIdentity:()=>({userId:'17'})}));assert.equal(process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED,writes?'true':undefined);}
 for(const identity of [null,{userId:'15'},{userId:'16'},{userId:'18'}]){const process={env:{}};await assert.rejects(run(config,context,true,process,check,async()=>({configuredSemihTestIdentity:()=>identity})));assert.deepEqual(process.env,{});}
 const process={env:{}};await run({...config,semihBrowserSessionEnabled:false},context,true,process,check,()=>assert.fail('Must not load identity'));assert.deepEqual(process.env,{});
 assert(source.indexOf("delete process.env[key]")<start);assert(source.includes('semihBrowserSession:config.semihBrowserSessionEnabled===true'));
});
