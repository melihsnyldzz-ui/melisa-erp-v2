import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {verifyPlan,rejectLinks,SOURCE_ROOT,INSTALL_ROOT} from './prepare-plan.mjs';

const fail=()=>{throw Error('EMPTY_LOCAL_WEB_REJECTED');};
const health=()=>new Promise((resolve,reject)=>{
  // The sole outbound request is a direct fixed loopback health request. No
  // redirects, proxy, remote assets, upstream fetch, or browser launch exists.
  const request=http.get({hostname:'127.0.0.1',port:4294,path:'/api/health',agent:false,timeout:5000},response=>{
    const chunks=[];let size=0;
    response.on('data',chunk=>{size+=chunk.length;if(size>8192){request.destroy();reject(Error());}else chunks.push(chunk);});
    response.on('error',reject);
    response.on('end',()=>{
      try{
        if(response.statusCode!==200)fail();
        const body=JSON.parse(Buffer.concat(chunks)),d=body.data;
        if(body.success!==true||d?.status!=='ok'||d.profile!=='empty-local-20261105'||d.environment!=='EMPTY_LOCAL_TEST'
          ||d.environmentId!=='94a8324f-124a-49e4-ad70-be3232989f47'||d.readOnly!==true||d.actualT1!==false||d.externalOperations!==false)fail();
        resolve();
      }catch(error){reject(error);}
    });
  });
  request.on('timeout',()=>request.destroy(Error()));request.on('error',reject);
});
async function main(){
  if(process.argv.length!==2)fail();
  const {plan,sha256}=verifyPlan();
  const receiptPath=path.join(INSTALL_ROOT,'runtime/bootstrap-success.json');rejectLinks(receiptPath);
  const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  if(receipt.status!=='setup_complete_listeners_not_started'||receipt.planSha256!==sha256||receipt.environmentId!==plan.environmentId||receipt.businessRows!==0)fail();
  const dist=path.join(SOURCE_ROOT,'apps/web-admin/dist');rejectLinks(dist);
  const assets=new Map(plan.sources.filter(s=>s.path.startsWith('apps/web-admin/dist/')).map(s=>[s.path.slice('apps/web-admin/dist/'.length),s.sha256]));
  if(!assets.has('index.html'))fail();
  await health();
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.webp':'image/webp'};
  const server=http.createServer((request,response)=>{
    try{
      if(request.headers.host!=='127.0.0.1:5294'||!['GET','HEAD'].includes(request.method)){response.writeHead(403);return response.end();}
      const target=decodeURIComponent((request.url||'/').split('?')[0]);
      if(!target.startsWith('/')||target.includes('\\')||target.includes('\0')||target.split('/').some(s=>s==='..'||s==='.')||target.startsWith('/api/')){response.writeHead(404);return response.end();}
      let asset=target.slice(1)||'index.html';
      if(!assets.has(asset)){
        if(path.posix.extname(asset)){response.writeHead(404);return response.end();}
        asset='index.html';
      }
      const full=path.resolve(dist,...asset.split('/'));
      if(!full.startsWith(dist+path.sep))fail();rejectLinks(full);
      const bytes=fs.readFileSync(full);
      if(createHash('sha256').update(bytes).digest('hex')!==assets.get(asset))fail();
      response.writeHead(200,{'Content-Type':mime[path.extname(asset)]||'application/octet-stream','Content-Length':bytes.length,
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src http://127.0.0.1:4294; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      response.end(request.method==='HEAD'?undefined:bytes);
    }catch{if(!response.headersSent)response.writeHead(503);response.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5294,'127.0.0.1',resolve);});
  server.on('error',()=>{process.stderr.write('EMPTY_LOCAL_WEB_STOPPED\n');server.close();process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
  process.stdout.write(JSON.stringify({status:'listening',profile:'empty-local-20261105',port:5294})+'\n');
}
main().catch(()=>{process.stderr.write('EMPTY_LOCAL_WEB_REJECTED\n');process.exitCode=1;});
