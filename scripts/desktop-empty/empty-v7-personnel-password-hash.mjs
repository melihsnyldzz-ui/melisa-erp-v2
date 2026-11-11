// Private anonymous-pipe worker for the separately reviewed human window.
// It retrieves no credential, opens no SQL connection and creates no account.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const PERSONNEL_PASSWORD_KEYS=Object.freeze(['sales','warehouse','manager','boss','accounting','creditSetup']);
export const PERSONNEL_PASSWORD_TARGET=Object.freeze({profileId:'empty-db9-v7-v1',databaseGuid:'6d773db9-bd69-4906-b791-d63a490ab1f2'});
export const PERSONNEL_PASSWORD_ROSTER_SHA256='b81f71c79a5722d7fa708295b040696c472e27fda50cfcd38c9ad5485b5d7dcb';
const fail=()=>{throw Error('PERSONNEL_PASSWORD_INPUT_REJECTED');};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});
export function validatePersonnelPasswordInput(v,expectedRosterSha256){
 if(!hex(expectedRosterSha256)||!exact(v,['version','rosterOperationId','profileId','databaseGuid','rosterSha256','password','passwordConfirmation'])||v.version!==1||!uuid(v.rosterOperationId)||v.profileId!==PERSONNEL_PASSWORD_TARGET.profileId||v.databaseGuid!==PERSONNEL_PASSWORD_TARGET.databaseGuid||v.rosterSha256!==expectedRosterSha256)fail();
 const p=v.password;if(typeof p!=='string'||p.length<8||p.length>64||!p.isWellFormed()||/[\0\r\n]/.test(p)||Buffer.byteLength(p,'utf8')>72||v.passwordConfirmation!==p)fail();
 return true;
}
export async function hashPersonnelPasswords(v,{bcrypt,expectedRosterSha256}={}){
 validatePersonnelPasswordInput(v,expectedRosterSha256);if(typeof bcrypt?.hash!=='function'||typeof bcrypt?.getRounds!=='function')fail();
 const hashes={};try{for(const key of PERSONNEL_PASSWORD_KEYS){const h=await bcrypt.hash(v.password,12);if(typeof h!=='string'||!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(h)||bcrypt.getRounds(h)!==12||Object.values(hashes).includes(h))fail();hashes[key]=h;}}
 catch{for(const key of Object.keys(hashes))hashes[key]=null;fail();}
 return {version:1,rosterOperationId:v.rosterOperationId,profileId:v.profileId,databaseGuid:v.databaseGuid,rosterSha256:v.rosterSha256,origin:'HUMAN_ENTRY',hashes};
}
export async function readPersonnelPasswordBytes(input,max=4096){
 const chunks=[];let size=0;try{for await(const original of input){const b=Buffer.from(original);if(Buffer.isBuffer(original))original.fill(0);chunks.push(b);size+=b.length;if(size>max)fail();}if(size===0)fail();return Buffer.concat(chunks);}finally{for(const b of chunks)b.fill(0);}
}
const sha=b=>createHash('sha256').update(b).digest('hex');
function pinned(file,digest,max=2097152){
 if(!hex(digest))fail();for(let at=path.resolve(file);;){const s=fs.lstatSync(at);if(s.isSymbolicLink())fail();const up=path.dirname(at);if(up===at)break;at=up;}
 const s=fs.lstatSync(file);if(!s.isFile()||s.nlink!==1||s.size<1||s.size>max)fail();const b=fs.readFileSync(file);if(sha(b)!==digest)fail();return b;
}
async function main(){
 let input,raw,out;try{
  const root='C:/Users/Xaser/Desktop/ERP',runtime=root+'/runtime-clean-v7',source='C:/Sirket/ERP/melisa-erp-v2/.git/codex-worktrees/db9-r1-personnel-20261111';
  const own=fileURLToPath(import.meta.url).replaceAll('\\','/'),[selfSha,coreSha,rosterSha]=process.argv.slice(2);
  if(process.platform!=='win32'||own!==source+'/scripts/desktop-empty/empty-v7-personnel-password-hash.mjs'||process.execPath.replaceAll('\\','/')!=='C:/Program Files/nodejs/node.exe'||process.argv.length!==5||![selfSha,coreSha,rosterSha].every(hex)||Object.keys(process.env).some(k=>/^(?:NODE_OPTIONS|NODE_PATH|NODE_REPL_EXTERNAL_MODULE|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|OPENSSL_CONF|SSL_CERT_FILE)$/.test(k)))fail();
  pinned(own,selfSha);pinned(process.execPath,'3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5',134217728);
  // Pin the declared core provenance without executing its transitive source
  // imports. This dedicated window supports one reviewed six-person roster.
  const coreFile=source+'/scripts/desktop-empty/empty-v7-personnel-core.mjs';pinned(coreFile,coreSha);if(rosterSha!==PERSONNEL_PASSWORD_ROSTER_SHA256)fail();
  const pkg=JSON.parse(pinned(root+'/kurulum/empty-profile-db9-v1/runtime-package.json','50fa9aa4cc1f8237f28b7294da0b3989abfa4c878c63edbae17d7a2324ce61df'));
  const rel='scripts/desktop-empty/sql-login-runtime-integrity.mjs';pinned(runtime+'/'+rel,pkg.sources?.[rel]);const {inspectDesktopRuntimeTree}=await import(pathToFileURL(runtime+'/'+rel).href);const tree=inspectDesktopRuntimeTree();if(tree.sha256!=='8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346'||tree.entryCount!==11623)fail();
  const require=createRequire(runtime+'/apps/api/__personnel_password_worker__.cjs'),bcrypt=require('bcrypt');
  raw=await readPersonnelPasswordBytes(process.stdin);input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));raw.fill(0);raw=null;
  const packet=await hashPersonnelPasswords(input,{bcrypt,expectedRosterSha256:rosterSha});out=Buffer.from(JSON.stringify(packet),'utf8');
  // This stdout is a PRIVATE protocol. The window owns and captures the pipe;
  // it protects the packet with CurrentUser DPAPI and never prints its bytes.
  await new Promise((resolve,reject)=>process.stdout.write(out,e=>e?reject(e):resolve()));
  for(const k of PERSONNEL_PASSWORD_KEYS)packet.hashes[k]=null;
 }catch{process.stderr.write('PERSONNEL_PASSWORD_HASH_FAILED\n');process.exitCode=1;}
 finally{raw?.fill(0);out?.fill(0);if(input){input.password=null;input.passwordConfirmation=null;}input=null;}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){for(const key of ['log','info','warn','error','debug'])console[key]=()=>{};await main();}
