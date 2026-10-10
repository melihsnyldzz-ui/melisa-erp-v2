// Network transport is independent from DB identity and commercial permissions.
// Adding a normal HTTPS origin never adds it to convenience actor bootstrap.
export const STABLE_HUB_ORIGIN='https://semih.tail295701.ts.net:8443';
export const BUSINESS_COPY_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const fail=()=>{throw Error('SHARED_TRANSPORT_REJECTED');};
export function resolveSharedCopyTransport(config,topology){
 const legacyOrigins=['127.0.0.1','localhost','192.168.1.46'].map(host=>`http://${host}:${topology.webPort}`);
 if(config.transport===undefined)return {stable:false,lanAddress:'192.168.1.46',lanRequired:true,bootstrapOrigins:legacyOrigins,normalOrigins:legacyOrigins};
 const t=config.transport;
 if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).length!==3||!['mode','origin','lanAddress'].every(k=>Object.hasOwn(t,k))||t.mode!=='stable-https-v1'||t.origin!==STABLE_HUB_ORIGIN||config.database!==BUSINESS_COPY_DATABASE||topology.webPort!==5234||topology.apiPort!==4184||topology.nativePort!==4186)fail();
 if(t.lanAddress!==null&&(typeof t.lanAddress!=='string'||!/^192\.168\.1\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(t.lanAddress)))fail();
 return {stable:true,lanAddress:t.lanAddress,lanRequired:false,bootstrapOrigins:legacyOrigins,normalOrigins:[...new Set([...legacyOrigins,...(t.lanAddress?[`http://${t.lanAddress}:5234`]:[]),STABLE_HUB_ORIGIN])]};
}
export function sharedCopyHosts(port,transport){
 return [`127.0.0.1:${port}`,`localhost:${port}`,...(transport.lanAddress?[`${transport.lanAddress}:${port}`]:[])];
}
// The caller supplies an already validated optional physical company address.
// A failed optional LAN bind cannot terminate the independent loopback core.
export async function bindSharedCopyLan(app,port,transport,onUnavailable=()=>{}){
 if(!transport.lanAddress)return null;
 return new Promise((resolve,reject)=>{
  let server;
  try{server=app.listen(port,transport.lanAddress,()=>resolve(server));}
  catch(error){if(transport.lanRequired)return reject(error);onUnavailable('SHARED_OPTIONAL_LAN_UNAVAILABLE');return resolve(null);}
  server.once('error',error=>{if(transport.lanRequired)return reject(error);onUnavailable('SHARED_OPTIONAL_LAN_UNAVAILABLE');resolve(null);});
 });
}
