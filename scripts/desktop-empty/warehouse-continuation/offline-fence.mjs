// Test preload only: never part of the ERP/runtime or production login path.
// Fail before native network/process calls or protected credential file reads.
import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';

const counts={network:0,process:0,protectedRead:0};
const publicDescriptors=new Set();
const deny=kind=>()=>{
 counts[kind]++;
 const error=new Error('WAREHOUSE_OFFLINE_'+kind.toUpperCase()+'_BLOCKED');
 error.code='WAREHOUSE_OFFLINE_BLOCKED';
 throw error;
};
const replace=(object,keys,kind)=>{
 for(const key of keys)if(typeof object[key]==='function')object[key]=deny(kind);
};
replace(net,['connect','createConnection','createServer'],'network');
replace(net.Socket.prototype,['connect'],'network');
replace(tls,['connect','createServer'],'network');
replace(http,['request','get','createServer'],'network');
replace(https,['request','get','createServer'],'network');
replace(http2,['connect','createServer','createSecureServer'],'network');
replace(dgram,['createSocket'],'network');
replace(dns,['lookup','resolve','resolve4','resolve6','lookupService'],'network');
replace(dns.promises,['lookup','resolve','resolve4','resolve6','lookupService'],'network');
replace(childProcess,['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'],'process');
globalThis.fetch=deny('network');
if(typeof globalThis.WebSocket==='function')globalThis.WebSocket=deny('network');

function guardedPath(value){
 let name=value;
 if(value instanceof URL)name=fileURLToPath(value);
 if(Buffer.isBuffer(name))name=name.toString('utf8');
 // No existing descriptor may be used as a hidden credential read channel.
 if(typeof name==='number')deny('protectedRead')();
 if(typeof name!=='string')return;
 const normalized=name.replaceAll('\\','/').toLowerCase();
 const segments=normalized.split('/').map(part=>part.split(':')[0].replace(/[ .]+$/,''));
 if(normalized.includes('.dpapi')||segments.some(part=>part==='protected-personas'||part==='private'))deny('protectedRead')();
}
for(const key of ['read','readSync','readv','readvSync']){
 const original=fs[key];
 fs[key]=function(fd,...args){
  if(!publicDescriptors.has(fd))deny('protectedRead')();
  return Reflect.apply(original,this,[fd,...args]);
 };
}
const originalCloseSync=fs.closeSync;
fs.closeSync=function(fd){publicDescriptors.delete(fd);return Reflect.apply(originalCloseSync,this,[fd]);};
const originalClose=fs.close;
fs.close=function(fd,...args){publicDescriptors.delete(fd);return Reflect.apply(originalClose,this,[fd,...args]);};
for(const key of ['readFile','readFileSync','open','openSync','createReadStream','opendir','opendirSync','readdir','readdirSync']){
 const original=fs[key];
 if(typeof original==='function')fs[key]=function(file,...args){
  guardedPath(file);
  const result=Reflect.apply(original,this,[file,...args]);
  if(key==='openSync')publicDescriptors.add(result);
  return result;
 };
}
for(const key of ['readFile','open','opendir','readdir']){
 const original=fs.promises[key];
 if(typeof original==='function')fs.promises[key]=function(file,...args){guardedPath(file);return Reflect.apply(original,this,[file,...args]);};
}
syncBuiltinESMExports();
Object.defineProperty(globalThis,Symbol.for('melisa.warehouse.offlineFence'),{
 value:Object.freeze({state:'PROCESS_NETWORK_AND_SECRET_READ_FENCE',snapshot:()=>Object.freeze({...counts})}),
 configurable:false,writable:false
});
