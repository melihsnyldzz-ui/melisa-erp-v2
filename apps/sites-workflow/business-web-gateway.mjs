import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createBusinessBrowserSessionTransport} from './business-preview-session.mjs';
import {cleanPreviewRequestAllowed,businessPreviewNetwork,validateBusinessPreviewHealth} from './business-preview-boundary.mjs';
import {businessWorkfaceId,businessWorkfaceRequestAllowed,businessSaleBrowserRequestAllowed} from './src/workflow/businessWorkface.mjs';
import {validateWebRelease,loadWebRelease,validateWebSettings,publicAssetPath,webSha256,webAssetLimit} from './business-web-release.mjs';

const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',ico:'image/x-icon',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf'};
const fail=(code,status=503)=>Object.assign(Error(code),{code,status});
function json(res,status,code){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{code}}));}
async function readLimited(stream,limit){let size=0;const chunks=[];if(stream)for await(const chunk of stream){const b=Buffer.from(chunk);size+=b.length;if(size>limit)throw fail('WEB_BODY_LIMIT',413);chunks.push(b);}return Buffer.concat(chunks);}
function extraHeadersAllowed(req){
 if(Object.keys(req.headers??{}).some(k=>/^x-forwarded-/i.test(k)))return false;
 const counts=new Map();for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const key=String(req.rawHeaders[i]).toLowerCase();counts.set(key,(counts.get(key)??0)+1);}
 return ['host','origin','authorization','cookie','content-length'].every(k=>(counts.get(k)??0)<=1);
}
// Literal, non-encoded bootstrap. FileShare.Read keeps the manifest-pinned script
// non-writable/non-replaceable through its invocation; no credential or policy bypass.
export const backendProofBootstrap=String.raw`& { param([string]$Proof,[string]$Hash,[string]$Source,[string]$Package,[string]$Manifest,[string]$Full) $ErrorActionPreference='Stop';$held=$null;try {for($p=[IO.Path]::GetFullPath($Proof);$p;$p=[IO.Path]::GetDirectoryName($p)){if(([IO.File]::GetAttributes($p)-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'WEB_PROOF_PATH'}};$held=[IO.File]::Open($Proof,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$sha=[Security.Cryptography.SHA256]::Create();try{$memory=[IO.MemoryStream]::new();try{$held.CopyTo($memory);$sourceBytes=$memory.ToArray()}finally{$memory.Dispose()};$actual=[BitConverter]::ToString($sha.ComputeHash($sourceBytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()};if($actual-cne$Hash){throw 'WEB_PROOF_SOURCE'};& ([scriptblock]::Create([Text.Encoding]::UTF8.GetString($sourceBytes))) -ExpectedSource $Source -ExpectedPackage $Package -ExpectedManifestSha256 $Manifest -FullHash:($Full-ceq'true')} catch {[Console]::Error.WriteLine('WEB_BACKEND_PROOF_REJECTED');exit 1} finally {if($held){$held.Dispose()}} }`;
export function createWindowsBackendVerifier({root,backend,settings,proofSha256,execute=promisify(execFile),readFile=fs.readFileSync,clock=()=>performance.now()}){
 if(!/^[a-f0-9]{64}$/.test(proofSha256??''))throw fail('WEB_BACKEND_PROOF_SOURCE_REQUIRED');
 const ps=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
 const proof=path.join(root,'runtime/apps/sites-workflow/business-web-backend-proof.ps1');
 let baseline=null,last=-Infinity,pending=null,rejected=false;
 return async({fresh=false}={})=>{
  if(rejected)throw fail('WEB_BACKEND_PROOF_REJECTED');
  if(pending){await pending;if(!fresh)return;}
  if(!fresh&&baseline&&clock()-last<5000)return;
  pending=(async()=>{
   if(webSha256(readFile(ps))!==settings.powerShellSha256)throw fail('WEB_BACKEND_PROOF_BINARY');
   const env={SystemRoot:String.raw`C:\Windows`,WINDIR:String.raw`C:\Windows`,TEMP:process.env.TEMP,TMP:process.env.TMP,PSModulePath:''};
   const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
   const command=backendProofBootstrap+' '+[proof,proofSha256,backend.sourceCommit,backend.packageId,backend.manifestSha256,baseline?'false':'true'].map(quote).join(' ');
   const args=['-NoLogo','-NoProfile','-NonInteractive','-Command',command];
   const {stdout}=await execute(ps,args,{windowsHide:true,timeout:15000,maxBuffer:16384,env});
   const value=JSON.parse(stdout);
   if(value.schema!=='melisa-simple-web-backend-proof.v1'||value.sourceCommit!==backend.sourceCommit||value.packageId!==backend.packageId||value.manifestSha256!==backend.manifestSha256||value.ownerVerified!==true||value.runtimeWrites!==0||value.sqlCalls!==0||!['api','native'].every(k=>Number.isSafeInteger(value[k]?.pid)&&value[k].pid>0&&typeof value[k].birth==='string'&&Number.isFinite(Date.parse(value[k].birth))))throw fail('WEB_BACKEND_PROOF_REJECTED');
   const actors=JSON.stringify([value.api,value.native]);if(baseline&&baseline!==actors)throw fail('WEB_BACKEND_RESTART_REQUIRES_ADMISSION');
   baseline=actors;last=clock();
  })();
  try{await pending;}catch(error){rejected=true;throw error;}finally{pending=null;}
 };
}
export function createSimpleWebGateway({release,settings,verifyBackend,fetchImpl=globalThis.fetch}){
 const m=validateWebRelease(release);validateWebSettings(settings,settings.releaseDigest);
 if(typeof verifyBackend!=='function')throw fail('WEB_BACKEND_VERIFIER_REQUIRED');
 const assets=new Map();let prepared=null,ready=false;
 const identity=async(fresh=false)=>{
  await verifyBackend({fresh});
  const r=await fetchImpl(m.backend.origin+'/test-health',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw fail('WEB_BACKEND_NOT_READY');const bytes=await readLimited(r.body,131072);
  validateBusinessPreviewHealth(JSON.parse(bytes.toString('utf8')),{BUSINESS_SOURCE_COMMIT:m.backend.sourceCommit,BUSINESS_PACKAGE_ID:m.backend.packageId});
 };
 const transport=createBusinessBrowserSessionTransport({fetchImpl:async(url,options)=>{if(options.method==='POST')await identity(true);return fetchImpl(url,options);}});
 async function prepare(){
  if(prepared)return prepared;
  prepared=(async()=>{
   await identity();
   // Only public, manifest-pinned GETs reach IIS. Browser auth/cookies, API
   // traffic and original request headers never cross this static-content hop.
   for(const f of m.files.filter(f=>f.path.startsWith('ui/')&&publicAssetPath(f.path.slice(3)))){
    const asset=f.path.slice(3),r=await fetchImpl(settings.iisOrigin+'/'+asset,{method:'GET',redirect:'error',cache:'no-store',headers:{'Accept-Encoding':'identity'},signal:AbortSignal.timeout(10000)});
    if(r.status!==200||r.headers.get('set-cookie')||r.headers.get('location')||![null,'identity'].includes(r.headers.get('content-encoding')))throw fail('WEB_IIS_ASSET_REJECTED');
    const bytes=await readLimited(r.body,Math.min(webAssetLimit,f.bytes+1));
    if(bytes.length!==f.bytes||webSha256(bytes)!==f.sha256)throw fail('WEB_IIS_ASSET_REJECTED');assets.set('/'+asset,{bytes,sha256:f.sha256});
   }
   ready=true;
  })();return prepared;
 }
 async function proxyReadOrNativeAuth(req,res){
  const body=await readLimited(req,8192),isNativeAuth=req.method==='POST'&&req.headers['x-melisa-session-transport']==='native'&&/^\/api\/auth\/(?:login|refresh|logout|session-confirm)$/.test(req.url);
  if(req.method==='POST'&&!isNativeAuth)throw fail('BUSINESS_UI_READ_ONLY',403);
  if(req.method!=='POST'&&body.length)throw fail('BUSINESS_PREVIEW_INPUT',400);
  const headers={};for(const key of ['authorization','accept','accept-language','if-none-match','range'])if(typeof req.headers[key]==='string')headers[key]=req.headers[key];
  if(isNativeAuth){headers['content-type']=typeof req.headers['content-type']==='string'?req.headers['content-type']:'application/json';headers['x-melisa-session-transport']='native';}
  if(isNativeAuth)await identity(true);
  const r=await fetchImpl(m.backend.origin+req.url,{method:req.method,headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),...(isNativeAuth?{body}:{} )});
  const bytes=await readLimited(r.body,128*1024*1024),out={'Cache-Control':'no-store'};
  for(const key of ['content-type','content-disposition','content-range','accept-ranges','etag']){const value=r.headers.get(key);if(value!==null)out[key]=value;}
  // Only the existing session adapter may issue the browser refresh cookie.
  res.writeHead(r.status,out);res.end(req.method==='HEAD'?undefined:bytes);
 }
 async function handler(req,res){
  try{
   if(!cleanPreviewRequestAllowed(req,settings.tailPeers)||!extraHeadersAllowed(req)||!['GET','HEAD'].includes(req.method)&&!req.url.startsWith('/api/')){json(res,403,'BUSINESS_UI_ORIGIN_REQUIRED');return;}
   if(req.url.startsWith('/api/')&&!businessWorkfaceRequestAllowed(req.method,req.url)&&!businessSaleBrowserRequestAllowed(req.method,req.url)){json(res,403,'BUSINESS_UI_READ_ONLY');return;}
   if(!ready){json(res,503,'WEB_RELEASE_NOT_READY');return;}
   if(req.url.startsWith('/api/')){
    await verifyBackend();
    // Every explicit mutation additionally fences the fixed backend identity.
    // There is no retry, mutation queue, actor cache, signer or SQL client.
    let next=false;await transport(req,res,()=>{next=true;});if(next)await proxyReadOrNativeAuth(req,res);return;
   }
   const raw=req.url.split('?')[0],assetPath=raw==='/'?'/index.html':raw;
   if(raw.includes('#')||!publicAssetPath(assetPath.slice(1))){json(res,404,'WEB_ASSET_NOT_FOUND');return;}
   const asset=assets.get(assetPath);if(!asset){json(res,404,'WEB_ASSET_NOT_FOUND');return;}
   const etag='"'+asset.sha256+'"',headers={'Content-Type':mime[assetPath.split('.').at(-1)],'Cache-Control':'no-store',ETag:etag,'X-Content-Type-Options':'nosniff'};
   if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;}
   res.writeHead(200,{...headers,'Content-Length':asset.bytes.length});res.end(req.method==='HEAD'?undefined:asset.bytes);
  }catch(error){const code=/^[A-Z][A-Z0-9_]{0,80}$/.test(error.code??'')?error.code:'WEB_GATEWAY_UNAVAILABLE';if(!res.headersSent)json(res,[400,403,413].includes(error.status)?error.status:503,code);else res.destroy?.();}
 }
 return Object.freeze({prepare,handler});
}

// This entry is not called by imports, preparation or offline tests. Installing
// a wrapper/IIS site or producing an authorized private settings file is a
// separate, explicitly approved WEB-only maintenance action.
export async function startSimpleWebGateway(args){
 if(args.length!==7||args[0]!=='--serve'||args[1]!=='--manifest'||args[3]!=='--digest'||args[5]!=='--settings')throw fail('WEB_START_NOT_AUTHORIZED');
 if(process.platform!=='win32'||['NODE_OPTIONS','NODE_PATH','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED'].some(k=>process.env[k]))throw fail('WEB_START_ENVIRONMENT');
 const loaded=loadWebRelease(args[2],args[4]),settings=validateWebSettings(JSON.parse(fs.readFileSync(args[6],'utf8')),loaded.digest);
 if((path.resolve(args[6])+path.sep).toLowerCase().startsWith((loaded.root+path.sep).toLowerCase())||webSha256(fs.readFileSync(process.execPath))!==settings.nodeSha256||path.resolve(fileURLToPath(import.meta.url)).toLowerCase()!==path.resolve(loaded.root,'runtime/apps/sites-workflow/business-web-gateway.mjs').toLowerCase())throw fail('WEB_START_BINDING');
 businessPreviewNetwork({MELISA_BUSINESS_UI_NETWORK:'lan-tailscale-20261027',MELISA_BUSINESS_WORKFACE:businessWorkfaceId,VITE_API_BASE_URL:loaded.manifest.backend.origin,VITE_ERP_WORKFACE:businessWorkfaceId,BUSINESS_SOURCE_COMMIT:loaded.manifest.backend.sourceCommit,BUSINESS_PACKAGE_ID:loaded.manifest.backend.packageId,MELISA_BUSINESS_UI_TAILSCALE_PEERS:settings.tailPeers.join(',')});
 const verifyBackend=createWindowsBackendVerifier({root:loaded.root,backend:loaded.manifest.backend,settings,proofSha256:loaded.manifest.files.find(f=>f.path==='runtime/apps/sites-workflow/business-web-backend-proof.ps1').sha256});
 const gateway=createSimpleWebGateway({release:loaded.manifest,settings,verifyBackend});await gateway.prepare();const servers=[];
 try{for(const host of ['127.0.0.1','192.168.1.46','100.87.188.3']){const server=http.createServer((req,res)=>{void gateway.handler(req,res);});servers.push(server);server.on('upgrade',(_req,socket)=>socket.destroy());await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host,port:5244,exclusive:true},resolve);});}}
 catch(error){for(const server of servers)server.close();throw error;}
 const close=()=>{for(const server of servers)server.close();};process.once('SIGINT',close);process.once('SIGTERM',close);return {close};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){startSimpleWebGateway(process.argv.slice(2)).then(()=>{process.stdout.write('WEB_GATEWAY_READY\n');}).catch(()=>{process.stderr.write('WEB_GATEWAY_START_REJECTED\n');process.exitCode=1;});}
