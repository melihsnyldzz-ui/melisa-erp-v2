import http from 'node:http';
import {businessWorkfaceId,businessWorkfaceRequestAllowed,businessCustomerMasterBrowserRequestAllowed,businessSaleBrowserRequestAllowed} from './src/workflow/businessWorkface.mjs';
import {createBusinessBrowserSessionTransport} from './business-preview-session.mjs';

import {cleanPreviewRequestAllowed,cleanPreviewTailPeers,cleanPreviewNetwork,businessPreviewNetwork,validateBusinessPreviewHealth} from './business-preview-boundary.mjs';
export {cleanPreviewRequestAllowed,cleanPreviewTailPeers,cleanPreviewNetwork,businessPreviewNetwork,validateBusinessPreviewHealth};

// The existing preview serves only this explicitly installed synthetic package.
// Native/API listeners remain loopback; remote browsers use this same-origin proxy.
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
const businessPreview={
 name:'melisa-business-preview-network',
 config(){if(!businessPreviewNetwork())return;return{preview:{host:'127.0.0.1',port:5244,strictPort:true,cors:false,proxy:{'^/api/':{target:'http://127.0.0.1:4144',changeOrigin:true,ws:false}}}};},
 async configurePreviewServer(server){
  if(!businessPreviewNetwork())return;
  if(server.config.preview.host!=='127.0.0.1'||server.config.preview.port!==5244||server.config.preview.strictPort!==true)throw Error('BUSINESS_UI_PREVIEW_TARGET_REQUIRED');
  const response=await fetch('http://127.0.0.1:4144/test-health',{redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('BUSINESS_UI_API_NOT_READY');validateBusinessPreviewHealth(await response.json());
  const peers=cleanPreviewTailPeers(process.env.MELISA_BUSINESS_UI_TAILSCALE_PEERS);
  const sessionTransport=createBusinessBrowserSessionTransport();
  server.middlewares.use((req,res,next)=>{if(!cleanPreviewRequestAllowed(req,peers)||!['GET','HEAD'].includes(req.method)&&!req.url.startsWith('/api/')){res.writeHead(403,{'Cache-Control':'no-store'});res.end('BUSINESS_UI_ORIGIN_REQUIRED');return;}if(req.url.startsWith('/api/')&&!businessWorkfaceRequestAllowed(req.method,req.url)&&!businessCustomerMasterBrowserRequestAllowed(req.method,req.url)&&!businessSaleBrowserRequestAllowed(req.method,req.url)){res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{code:'BUSINESS_UI_READ_ONLY'}}));return;}void sessionTransport(req,res,next);});
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
