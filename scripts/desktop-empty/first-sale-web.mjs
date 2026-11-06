import http from 'node:http';
import path from 'node:path';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='C:/Users/Xaser/Desktop/ERP/kaynak/apps/sites-workflow/dist-desktop-write-green';
export async function startFirstSaleWeb(assets){
 const checked=name=>{if(!Object.hasOwn(assets,name)||!/^(desktop-write-green\.html|assets\/[A-Za-z0-9_-]+\.js)$/.test(name))throw Error('ASSET_REJECTED');const f=path.resolve(root,name);if(lstatSync(f).isSymbolicLink()||realpathSync(f).toLowerCase()!==f.toLowerCase())throw Error('ASSET_REJECTED');const b=readFileSync(f);if(createHash('sha256').update(b).digest('hex')!==assets[name])throw Error('ASSET_REJECTED');return b;};
 for(const n of Object.keys(assets))checked(n);
 const server=http.createServer((req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:5294'||!['GET','HEAD'].includes(req.method))throw Error();
  const raw=req.url.split('?')[0],name=raw==='/'?'desktop-write-green.html':raw.slice(1),data=checked(name);
  res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http://127.0.0.1:4294; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Cache-Control':'no-store'});res.end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5294,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 return {close:()=>new Promise(resolve=>server.close(resolve))};
}
