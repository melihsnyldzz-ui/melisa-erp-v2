// Dedicated, hash-pinned green desktop preview. Import starts no listener.
import http from 'node:http';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';

const root='C:\\Users\\Xaser\\Desktop\\ERP\\kaynak\\apps\\sites-workflow\\dist-desktop-empty-green';
const assets=Object.freeze({
 'desktop-empty-green.html':'6deed9a0e1ecf3d68d0e852479941e5c4744b3f53ff11a8641ac5d727db7480c',
 'assets/desktop-empty-green-D_opztB0.js':'07494a9f1b06e96ce5fe945657db90d7eda782d226caeb5659fd9a0c103256d1',
});
const fail=()=>{throw Error('DESKTOP_GREEN_WEB_REJECTED');};
export function resolveGreenWebPath(url){
 if(typeof url!=='string'||url.length>2048)fail();
 let pathname;try{pathname=decodeURIComponent(url.split('?')[0]);}catch{fail();}
 if(!pathname.startsWith('/')||pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').some(x=>x==='..'||x==='.')||pathname.startsWith('/api/'))fail();
 const name=pathname==='/'?'desktop-empty-green.html':pathname.slice(1);
 if(!Object.hasOwn(assets,name))fail();return name;
}
function checkedAsset(name){
 if(!Object.hasOwn(assets,name)||process.platform!=='win32'||realpathSync(root).toLowerCase()!==root.toLowerCase())fail();
 let current=root;for(const part of name.split('/')){current=path.join(current,part);if(lstatSync(current).isSymbolicLink()||realpathSync(current).toLowerCase()!==current.toLowerCase())fail();}
 const stat=lstatSync(current);if(!stat.isFile()||stat.size>5000000)fail();const data=readFileSync(current);
 if(createHash('sha256').update(data).digest('hex')!==assets[name])fail();return data;
}
export async function startInitialReadWeb(){
 for(const name of Object.keys(assets))checkedAsset(name);
 const server=http.createServer((req,res)=>{
  try{
   if(req.headers.host!=='127.0.0.1:5294'||!['GET','HEAD'].includes(req.method)){res.writeHead(403);return res.end();}
   const name=resolveGreenWebPath(req.url),data=checkedAsset(name);
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Content-Length':data.length,
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src http://127.0.0.1:4294; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
   return res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404,{'Cache-Control':'no-store'});return res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5294,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 return Object.freeze({close:()=>new Promise(resolve=>server.close(resolve))});
}
