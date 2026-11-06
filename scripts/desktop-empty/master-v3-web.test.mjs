import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {readFileSync} from 'node:fs';
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
