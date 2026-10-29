import http from 'node:http';
import os from 'node:os';
import {businessWorkfaceId,businessWorkfaceRequestAllowed,businessSaleBrowserRequestAllowed} from './src/workflow/businessWorkface.mjs';
import {createBusinessBrowserSessionTransport} from './business-preview-session.mjs';

// The existing preview serves only this explicitly installed synthetic package.
// Native/API listeners remain loopback; remote browsers use this same-origin proxy.
export function cleanPreviewRequestAllowed(req,tailPeers=[]){
  const local=req.socket?.localAddress,remote=req.socket?.remoteAddress,headers=req.headers??{};
  const ipv4=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)&&value.split('.').every(n=>Number(n)<=255);
  let hosts=[];
  if(local==='127.0.0.1'&&remote==='127.0.0.1')hosts=['127.0.0.1:5244','localhost:5244'];
  else if(local==='192.168.1.46'&&ipv4(remote)&&remote.startsWith('192.168.1.')&&![0,255].includes(Number(remote.split('.')[3])))hosts=['192.168.1.46:5244'];
  else if(local==='100.87.188.3'&&ipv4(remote)&&(remote==='100.87.188.3'||tailPeers.includes(remote)))hosts=['100.87.188.3:5244'];
  if(!hosts.includes(headers.host)||['forwarded','x-real-ip','x-forwarded-for','x-forwarded-host','x-forwarded-proto'].some(k=>headers[k]!==undefined))return false;
  const origin='http://'+headers.host;
  if(headers.origin!==undefined&&headers.origin!==origin)return false;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&headers.origin!==origin)return false;
  if(headers['sec-fetch-site']&&!['same-origin','none'].includes(headers['sec-fetch-site']))return false;
  return typeof req.url==='string'&&req.url.startsWith('/')&&!req.url.startsWith('//');
}
export function cleanPreviewTailPeers(value){
  if(typeof value!=='string'||!value)throw Error('CLEAN_UI_TAILSCALE_PEERS_REQUIRED');
  const peers=value.split(',');
  if(peers.length>32||new Set(peers).size!==peers.length||peers.some(ip=>!/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.(?:0|[1-9]\d{0,2})\.(?:0|[1-9]\d{0,2})$/.test(ip)||ip.split('.').some(n=>Number(n)>255)))throw Error('CLEAN_UI_TAILSCALE_PEERS_INVALID');
  return peers;
}
export function cleanPreviewNetwork(environment=process.env,interfaces=os.networkInterfaces()){
  if(!environment.MELISA_CLEAN_UI_NETWORK)return false;
  if(environment.MELISA_CLEAN_UI_NETWORK!=='lan-tailscale-20261022'||environment.MELISA_CLEAN_TEST!=='20261022')throw Error('CLEAN_UI_NETWORK_PROFILE_REQUIRED');
  cleanPreviewTailPeers(environment.MELISA_CLEAN_UI_TAILSCALE_PEERS);
  for(const [address,netmask] of [['192.168.1.46','255.255.255.0'],['100.87.188.3','255.255.255.255']]){
    if(!Object.values(interfaces).flat().some(e=>e?.family==='IPv4'&&!e.internal&&e.address===address&&e.netmask===netmask))throw Error('CLEAN_UI_NETWORK_INTERFACE_REQUIRED');
  }
  return true;
}
const cleanPreview={
  name:'melisa-clean-preview-network',
  config(){
    if(!cleanPreviewNetwork())return;
    return {preview:{host:'127.0.0.1',port:5244,strictPort:true,cors:false,proxy:{'^/api/':{target:'http://127.0.0.1:4194',changeOrigin:true,ws:false}}}};
  },
  async configurePreviewServer(server){
    if(!cleanPreviewNetwork())return;
    const tailPeers=cleanPreviewTailPeers(process.env.MELISA_CLEAN_UI_TAILSCALE_PEERS);
    if(server.config.preview.host!=='127.0.0.1'||server.config.preview.port!==5244||server.config.preview.strictPort!==true)throw Error('CLEAN_UI_PREVIEW_TARGET_REQUIRED');
    const response=await fetch('http://127.0.0.1:4194/test-health',{redirect:'error',signal:AbortSignal.timeout(10000)}),identity=await response.json();
    if(!response.ok||identity.environment!=='CLEAN_SYNTHETIC_TEST'||identity.environmentId!=='e662fd94-d797-4b3b-938a-d143ad758b67'||identity.database!=='MELISA_ERP_CLEAN_TEST_20261022'||identity.synthetic!==true||identity.actualT1!==false||identity.externalOperations!==false||identity.port!==4194||identity.sourceCommit!==process.env.CLEAN_SOURCE_COMMIT||identity.packageId!==process.env.CLEAN_PACKAGE_ID||![identity.originalDatabaseAccess,identity.liveDatabaseAccess,identity.sysadmin,identity.databaseControl].every(v=>v===0))throw Error('CLEAN_UI_API_IDENTITY_REQUIRED');
    server.middlewares.use((req,res,next)=>{
      if(!cleanPreviewRequestAllowed(req,tailPeers)){res.writeHead(403,{'cache-control':'no-store'});res.end('CLEAN_UI_ORIGIN_REQUIRED');return;}
      next();
    });
    const extra=[];
    server.httpServer.once('close',()=>extra.forEach(s=>s.close()));
    try{
      for(const address of ['192.168.1.46','100.87.188.3']){
        const listener=http.createServer(server.middlewares);extra.push(listener);
        await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(5244,address,resolve);});
      }
    }catch(error){extra.forEach(s=>s.close());throw error;}
  },
};
export function businessPreviewNetwork(environment=process.env,interfaces=os.networkInterfaces()){
 if(environment.MELISA_BUSINESS_UI_NETWORK===undefined)return false;
 if(environment.MELISA_BUSINESS_UI_NETWORK!=='lan-tailscale-20261027'||environment.MELISA_BUSINESS_WORKFACE!==businessWorkfaceId||environment.MELISA_CLEAN_TEST||environment.MELISA_CLEAN_UI_NETWORK||environment.VITE_API_BASE_URL!=='http://127.0.0.1:4144'||environment.VITE_ERP_WORKFACE!==businessWorkfaceId||! /^[a-f0-9]{40}$/.test(environment.BUSINESS_SOURCE_COMMIT??'')||typeof environment.BUSINESS_PACKAGE_ID!=='string'||!environment.BUSINESS_PACKAGE_ID)throw Error('BUSINESS_UI_PROFILE_REQUIRED');
 cleanPreviewTailPeers(environment.MELISA_BUSINESS_UI_TAILSCALE_PEERS);
 for(const [address,netmask] of [['192.168.1.46','255.255.255.0'],['100.87.188.3','255.255.255.255']])if(!Object.values(interfaces).flat().some(e=>e?.family==='IPv4'&&!e.internal&&e.address===address&&e.netmask===netmask))throw Error('BUSINESS_UI_INTERFACE_REQUIRED');
 return true;
}
export function validateBusinessPreviewHealth(h,environment=process.env){
 if(h?.ok!==true||h.environment!=='CANONICAL_TEST'||h.mode!=='erp'||h.port!==4144||h.databaseName!=='MELISA_ERP_SIRKET_TEST_20260929_01'||h.serverName?.toLowerCase()!=='semih\\melisadev'||h.loginName!=='melisa_sirket_sales_test_20260929_01'||h.databaseUser!==h.loginName||h.sysadmin!==0||h.databaseControl!==0||h.liveDatabaseAccess!==0||h.writes!==true||h.sqlReadOnly!==false||h.actualT1!==false||h.externalOperations!==false||h.automaticJobs!==false||h.businessWorkfaceId!==businessWorkfaceId||h.normalSessionUserId!==17||h.persistentNormalSession!==true||h.businessSessionSignerDomain!=='dedicated-business-key-v1'||h.sourceCommit!==environment.BUSINESS_SOURCE_COMMIT||h.packageId!==environment.BUSINESS_PACKAGE_ID)throw Error('BUSINESS_UI_API_IDENTITY_REQUIRED');return h;
}
const businessPreview={
 name:'melisa-business-preview-network',
 config(){if(!businessPreviewNetwork())return;return{preview:{host:'127.0.0.1',port:5244,strictPort:true,cors:false,proxy:{'^/api/':{target:'http://127.0.0.1:4144',changeOrigin:true,ws:false}}}};},
 async configurePreviewServer(server){
  if(!businessPreviewNetwork())return;
  if(server.config.preview.host!=='127.0.0.1'||server.config.preview.port!==5244||server.config.preview.strictPort!==true)throw Error('BUSINESS_UI_PREVIEW_TARGET_REQUIRED');
  const response=await fetch('http://127.0.0.1:4144/test-health',{redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('BUSINESS_UI_API_NOT_READY');validateBusinessPreviewHealth(await response.json());
  const peers=cleanPreviewTailPeers(process.env.MELISA_BUSINESS_UI_TAILSCALE_PEERS);
  const sessionTransport=createBusinessBrowserSessionTransport();
  server.middlewares.use((req,res,next)=>{if(!cleanPreviewRequestAllowed(req,peers)||!['GET','HEAD'].includes(req.method)&&!req.url.startsWith('/api/')){res.writeHead(403,{'Cache-Control':'no-store'});res.end('BUSINESS_UI_ORIGIN_REQUIRED');return;}if(req.url.startsWith('/api/')&&!businessWorkfaceRequestAllowed(req.method,req.url)&&!businessSaleBrowserRequestAllowed(req.method,req.url)){res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{code:'BUSINESS_UI_READ_ONLY'}}));return;}void sessionTransport(req,res,next);});
  const extra=[];server.httpServer.once('close',()=>extra.forEach(s=>s.close()));
  try{for(const address of ['192.168.1.46','100.87.188.3']){const listener=http.createServer(server.middlewares);extra.push(listener);await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(5244,address,resolve);});}}
  catch(error){extra.forEach(s=>s.close());throw error;}
 },
};
// Business assets need their explicit target at BUILD time. A preview process
// cannot add Vite constants to JavaScript which has already been emitted.
export function assertBusinessBuildEnvironment(environment,mode){
 if(mode!=='business')return;
 if(environment.VITE_ERP_WORKFACE!==businessWorkfaceId||environment.VITE_API_BASE_URL!=='http://127.0.0.1:4144'||environment.VITE_LOCAL_PASSWORDLESS_LOGIN!=='false')throw Error('BUSINESS_BUILD_PROFILE_REQUIRED');
}
const businessBuild={name:'melisa-business-build-contract',config(_,{command,mode}){if(command==='build')assertBusinessBuildEnvironment(process.env,mode);}};
export default {
  plugins:[businessBuild,cleanPreview,businessPreview],
  build: { rollupOptions: { input: { main: 'index.html', workflow: 'is-akisi-taslagi.html', example: 'ornek-akis.html', terminal: 'terminal.html', legacy: 'legacy-admin.html', acceptance: 'responsive-acceptance.html', trainingGuide: 'kullanim-egitimi.html' } } },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
};
