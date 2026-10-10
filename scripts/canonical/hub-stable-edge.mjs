import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createStableEdgeServer} from '../../apps/api/src/services/stableHubEdge.mjs';
import {STABLE_HUB_ORIGIN,BUSINESS_COPY_DATABASE} from '../../apps/api/src/services/sharedCopyTransport.mjs';
const copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export function stableConfigReferenceAllowed(value){
 if(typeof value!=='string'||!/^C:\\Sirket\\ERP\\runtime\\/i.test(value)||path.win32.normalize(value)!==value||/[\x00-\x1f\x7f"'/%`$<>|?*]/.test(value)||value.slice(2).includes(':'))return false;
 return value.slice(3).split('\\').every(part=>part&&!/[. ]$/.test(part)&&! /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))&&path.win32.extname(value).toLowerCase()==='.json';
}
function readPinnedConfig(filename){
 for(let cursor=path.dirname(filename);;cursor=path.dirname(cursor)){
  const stat=fs.lstatSync(cursor);if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync.native(cursor).toLowerCase()!==cursor.toLowerCase())throw Error('STABLE_EDGE_CONFIG_REFERENCE_REJECTED');
  if(path.dirname(cursor)===cursor)break;
 }
 const before=fs.lstatSync(filename);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>65536||fs.realpathSync.native(filename).toLowerCase()!==filename.toLowerCase())throw Error('STABLE_EDGE_CONFIG_REFERENCE_REJECTED');
 const bytes=fs.readFileSync(filename),after=fs.lstatSync(filename);
 if(before.size!==bytes.length||before.size!==after.size||before.mtimeMs!==after.mtimeMs||after.nlink!==1)throw Error('STABLE_EDGE_CONFIG_CHANGED');
 return bytes;
}
export function validateStableEdgeConfig(c,release){
 const keys=['schemaVersion','sourceCommit','copyId','database','origin','host','port'];
 if(!c||Object.keys(c).length!==keys.length||!keys.every(k=>Object.hasOwn(c,k))||c.schemaVersion!==1||!/^[a-f0-9]{40}$/.test(c.sourceCommit)||c.sourceCommit!==release?.sourceCommit||c.copyId!==copyId||c.database!==BUSINESS_COPY_DATABASE||c.origin!==STABLE_HUB_ORIGIN||c.host!=='127.0.0.1'||c.port!==5244||release.repository!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'||release.sharedTestCopy?.database!==BUSINESS_COPY_DATABASE)throw Error('STABLE_EDGE_CONFIG_REJECTED');
 return Object.freeze({...c});
}
export async function startStableEdge({configPath,configSha256,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')}={}){
 if(!stableConfigReferenceAllowed(configPath)||!/^[a-f0-9]{64}$/i.test(configSha256??''))throw Error('STABLE_EDGE_CONFIG_REFERENCE_REJECTED');
 const bytes=readPinnedConfig(configPath);if(sha(bytes)!==configSha256.toLowerCase())throw Error('STABLE_EDGE_CONFIG_HASH_REJECTED');
 const release=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
 const config=validateStableEdgeConfig(JSON.parse(bytes),release);
 const edge=createStableEdgeServer();
 // Dedicated loopback readiness. This route is absent from public edge allowlist.
 const main=edge.listeners('request')[0];edge.removeAllListeners('request');
 edge.on('request',(req,res)=>{
  if(req.url==='/test-health'){
   if(!['GET','HEAD'].includes(req.method)||req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!=='127.0.0.1:5244'||req.headers['x-forwarded-for']!==undefined||req.headers.origin!==undefined){res.writeHead(403);res.end();return;}
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,environment:'ISOLATED_TEST_COPY',port:5244,sourceCommit:config.sourceCommit,copyId:config.copyId,databaseName:config.database,actualT1:false}));return;
  }
  main(req,res);
 });
 await new Promise((resolve,reject)=>{edge.once('error',reject);edge.listen(5244,'127.0.0.1',resolve);});
 return edge;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 startStableEdge({configPath:process.env.MELISA_HUB_EDGE_CONFIG_PATH,configSha256:process.env.MELISA_HUB_EDGE_CONFIG_SHA256}).then(edge=>{
  console.log(JSON.stringify({event:'STABLE_EDGE_READY',port:5244}));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>edge.close(()=>process.exit(0)));
 }).catch(()=>{console.error('STABLE_EDGE_START_REJECTED');process.exitCode=1;});
}
