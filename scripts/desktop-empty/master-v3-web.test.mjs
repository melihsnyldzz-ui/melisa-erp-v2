import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('./master-v3-web.mjs',import.meta.url),'utf8');
async function setup({badHash=false}={}){
 const bodies={'desktop-write-green.html':Buffer.from('<html></html>'),'assets/card-Abc_1.js':Buffer.from('export{}'),'assets/card-Abc_1.css':Buffer.from('body{color:green}')} ,assets=Object.fromEntries(Object.entries(bodies).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]));
 if(badHash)assets['assets/card-Abc_1.css']='0'.repeat(64);let handler,listens=0;
 const server={once(){},off(){},listen(port,host,done){assert.equal(port,5294);assert.equal(host,'127.0.0.1');listens++;done();},close(done){done();}};
 const exports={ 'node:http':{default:{createServer(fn){handler=fn;return server;}}},'node:path':{default:path},'node:fs':{lstatSync:()=>({isSymbolicLink:()=>false}),realpathSync:f=>f,readFileSync:f=>{const name=f.replaceAll('\\','/').split('/dist-desktop-write-green/')[1];if(!Object.hasOwn(bodies,name))throw Error('not in fixture');return bodies[name];}},'node:crypto':{createHash}};
 const context=vm.createContext({});const module=new vm.SourceTextModule(source,{context});await module.link(async id=>{assert.ok(Object.hasOwn(exports,id));const values=exports[id];return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});await module.evaluate();
 return {assets,bodies,start:()=>module.namespace.startMasterV3Web(assets),get listens(){return listens;},request(url,{method='GET',host='127.0.0.1:5294'}={}){let status,headers,body;handler({url,method,headers:{host}},{writeHead(s,h){status=s;headers=h;},end(v){body=v;}});return {status,headers,body};}};
}
test('only manifest-hashed stylesheet and script assets are served on the fixed loopback host',async()=>{
 const x=await setup();const runtime=await x.start();assert.equal(x.listens,1);const css=x.request('/assets/card-Abc_1.css');assert.equal(css.status,200);assert.equal(css.headers['Content-Type'],'text/css; charset=utf-8');assert.equal(css.headers['X-Content-Type-Options'],'nosniff');assert.equal(css.body.toString(),'body{color:green}');assert.equal(x.request('/assets/card-Abc_1.css',{method:'HEAD'}).body,undefined);
 for(const [url,opts] of [['/assets/unknown.css',{}],['/../desktop-write-green.html',{}],['/assets/card-Abc_1.css',{host:'foreign'}],['/',{method:'POST'}]])assert.equal(x.request(url,opts).status,404);
 x.bodies['assets/card-Abc_1.css']=Buffer.from('tampered');assert.equal(x.request('/assets/card-Abc_1.css').status,404);await runtime.close();
});
test('tampered stylesheet prevents listener startup',async()=>{const x=await setup({badHash:true});await assert.rejects(x.start(),/ASSET_REJECTED/);assert.equal(x.listens,0);});

test('real isolated old/new asset bytes reproduce the old-root failure and serve the verified DB9 root without fallback',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-web-root-')),legacy='C:/Users/Xaser/Desktop/ERP/kaynak-r1',empty='C:/Users/Xaser/Desktop/ERP/runtime-clean-v7';
 const roots=new Map([[legacy,path.join(temp,'legacy')],[empty,path.join(temp,'empty')]]);let listens=0,handler;
 try{
  const old={'desktop-write-green.html':'<html>old</html>','assets/old.js':'old script','assets/shared.css':'css'},next={'desktop-write-green.html':'<html>new</html>','assets/new.js':'new script','assets/shared.css':'css'};
  for(const [root,items]of [[legacy,old],[empty,next]])for(const [name,body]of Object.entries(items)){const p=path.join(roots.get(root),'apps/sites-workflow/dist-desktop-write-green',name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body,{flag:'wx'});}
  const map=p=>{p=p.replaceAll('\\','/');for(const [root,to]of roots)if(p.startsWith(root+'/'))return path.join(to,p.slice(root.length+1));throw Error('OUTSIDE_ISOLATED_ROOTS');};
  const server={once(){},off(){},listen(port,host,done){assert.equal(port,5294);assert.equal(host,'127.0.0.1');listens++;done();},close(done){done();}};
  const values={'node:http':{default:{createServer(fn){handler=fn;return server;}}},'node:path':{default:path},'node:crypto':{createHash},'node:fs':{readFileSync:p=>fs.readFileSync(map(p)),lstatSync:p=>fs.lstatSync(map(p)),realpathSync:p=>{const actual=map(p);assert.equal(fs.realpathSync(actual).toLowerCase(),path.resolve(actual).toLowerCase());return path.resolve(p);}}};
  const context=vm.createContext({}),module=new vm.SourceTextModule(source,{context});await module.link(id=>{assert(Object.hasOwn(values,id));const v=values[id];return new vm.SyntheticModule(Object.keys(v),function(){for(const [k,x]of Object.entries(v))this.setExport(k,x);},{context});});await module.evaluate();
  const assets=Object.fromEntries(Object.entries(next).map(([n,b])=>[n,createHash('sha256').update(b).digest('hex')]));
  await assert.rejects(module.namespace.startMasterV3Web(assets));assert.equal(listens,0); // New HTML differs and new JS is absent in the actual old fixture tree.
  for(const ctx of [{targetProfile:'empty-db9-v7-v1',runtimeRoot:legacy},{targetProfile:'empty-db9-v7-v1'},{targetProfile:null,runtimeRoot:empty},{targetProfile:'empty-db9-v7-v1',runtimeRoot:temp}])await assert.rejects(module.namespace.startMasterV3Web(assets,ctx),/ASSET_REJECTED/);
  const runtime=await module.namespace.startMasterV3Web(assets,{targetProfile:'empty-db9-v7-v1',runtimeRoot:empty});assert.equal(listens,1);let result;handler({url:'/',method:'GET',headers:{host:'127.0.0.1:5294'}},{writeHead:s=>result=s,end:b=>assert.equal(b.toString(),next['desktop-write-green.html'])});assert.equal(result,200);await runtime.close();
 }finally{const resolved=path.resolve(temp);assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('melisa-web-root-'));fs.rmSync(resolved,{recursive:true,force:true});}
});
