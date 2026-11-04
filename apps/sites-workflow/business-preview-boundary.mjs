import os from 'node:os';
import {businessWorkfaceId} from './src/workflow/businessWorkface.mjs';

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
