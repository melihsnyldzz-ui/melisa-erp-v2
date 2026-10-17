export const canonicalLanHost='192.168.1.46';
export function canonicalListenerPolicy(config,{mode,writes}={}){
 if(!['erp','native','web'].includes(mode)||typeof writes!=='boolean')throw Error('TEST_LISTENER_SCOPE_REJECTED');
 if(config.lanHost!==undefined&&config.lanHost!==canonicalLanHost)throw Error('TEST_LAN_HOST_REJECTED');
 const enabled=config.lanHost===canonicalLanHost&&mode!=='native'&&writes;
 return Object.freeze({hosts:Object.freeze(enabled?['127.0.0.1',canonicalLanHost]:['127.0.0.1']),lanEnabled:enabled,corsOrigins:Object.freeze(['http://127.0.0.1:5194','http://localhost:5194',...(enabled?[`http://${canonicalLanHost}:5194`]:[])])});
}
// Explicit interfaces only: never wildcard-bind another adapter or IPv6.
// Readiness is reported only after all configured listeners have opened.
export async function startCanonicalListeners(app,{port,policy}){
 const servers=[];
 try{
  for(const host of policy.hosts){
   await new Promise((resolve,reject)=>{
    const server=app.listen(port,host,resolve);servers.push(server);server.once('error',reject);
   });
  }
 }catch(error){await Promise.all(servers.map(server=>new Promise(resolve=>server.close(()=>resolve()))));throw error;}
 return {servers,close:()=>Promise.all(servers.map(server=>new Promise(resolve=>server.close(()=>resolve()))))};
}
export function validateCanonicalWebConfig(config){
 if(config.database!=='MELISA_ERP_SIRKET_TEST_20260929_01'||config.server!=='127.0.0.1'||config.sqlPort!==1433||config.host!=='127.0.0.1'||config.erpPort!==4144||config.nativePort!==4146||config.webPort!==5194)throw Error('TEST_CONFIG_IDENTITY_REJECTED');
 return canonicalListenerPolicy(config,{mode:'web',writes:config.salesEnabled===true});
}
export function canonicalInboundAllowed({remoteAddress,host},{port,policy}){
 const address=String(remoteAddress??'').replace(/^::ffff:/,'');
 const loopback=address==='127.0.0.1'||address==='::1';
 const lan=/^192\.168\.1\.(?:0|[1-9]\d{0,2})$/.test(address)&&Number(address.split('.').at(-1))<=255;
 const hosts=[`127.0.0.1:${port}`,`localhost:${port}`,...(policy.lanEnabled?[`${canonicalLanHost}:${port}`]:[])];
 return (loopback||policy.lanEnabled&&lan)&&hosts.includes(host);
}
export function canonicalInboundMiddleware({port,policy}){
 return (req,res,next)=>{
  if(!policy.lanEnabled||canonicalInboundAllowed({remoteAddress:req.socket.remoteAddress,host:req.headers.host},{port,policy}))return next();
  return res.status(403).json({success:false,error:{code:'TEST_NETWORK_SCOPE',message:'Bu bağlantı için erişim izni bulunmuyor.'}});
 };
}
export function canonicalReadiness(){
 let ready=false;
 return {markReady(){ready=true;},send(res,payload){return res.status(ready?200:503).json({...payload,ok:ready});}};
}
