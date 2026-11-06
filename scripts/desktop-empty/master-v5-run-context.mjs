// Pure package validation and semantic attempt identity. No filesystem or SQL.
import {createHash} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Error('MASTER_V5_RUN_CONTEXT_INVALID');};
const hash=/^[a-f0-9]{64}$/;
const helpers=['scripts/desktop-empty/start-master-v5.ps1','scripts/desktop-empty/stop-master-v5-runtime.ps1','scripts/desktop-empty/readmit-master-v5-runtime.ps1','scripts/desktop-empty/master-v3-runner-common.ps1','scripts/desktop-empty/read-first-sale-operator.ps1','scripts/desktop-empty/invoke-master-v5-sql.ps1','scripts/desktop-empty/read-master-v5-permission-seed.ps1'];
const publicName='kurulum/master-v5-export-journal/desktop-target.json',publicHash='d479ab4affb7197b15393e29ae1c6f183f9196e9c8a791ba87dc6944922fa7b6';
const top=['profile','sourceRoot','createdAt','sources','helpers','assets','publicFiles','snapshotSqlSha256','dependencySha256'];

// Only JSON objects and strings occur in this manifest. Reject duplicate keys
// while parsing, before JSON's usual last-key-wins behavior could hide one.
function parse(text){let i=0;const ws=()=>{while(/[\x20\x09\x0a\x0d]/.test(text[i]??'!'))i++;};
 function str(){if(text[i]!=='"')fail();const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"'){try{return JSON.parse(text.slice(start,i));}catch{fail();}}}fail();}
 function value(){ws();if(text[i]==='"')return str();if(text[i++]!=='{')fail();const out=Object.create(null);ws();if(text[i]==='}'){i++;return out;}for(;;){ws();const key=str();if(Object.hasOwn(out,key))fail();ws();if(text[i++]!==':')fail();out[key]=value();ws();if(text[i]==='}'){i++;return out;}if(text[i++]!==',')fail();}}
 const result=value();ws();if(i!==text.length)fail();return result;
}
function keys(obj,expected){if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).length!==expected.length||expected.some(k=>!Object.hasOwn(obj,k)))fail();}
function map(obj,rule){if(!obj||typeof obj!=='object'||Array.isArray(obj))fail();const entries=Object.entries(obj);if(entries.length<1||entries.length>4096)fail();for(const [name,digest] of entries){if(name.length>240||!rule(name)||!hash.test(digest)||typeof digest!=='string')fail();}}
function canonical(v){if(typeof v==='string')return JSON.stringify(v);return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
export function masterV5RunContext({packageBytes,expectedPackageHash}={}){
 if(!(packageBytes instanceof Uint8Array)||packageBytes.byteLength===0||packageBytes.byteLength>1048576||typeof expectedPackageHash!=='string'||!/^[a-fA-F0-9]{64}$/.test(expectedPackageHash))fail();
 const packageSha256=sha(packageBytes);if(packageSha256!==expectedPackageHash.toLowerCase())fail();
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(packageBytes);}catch{fail();}const p=parse(text);keys(p,top);
 if(p.profile!=='desktop-master-v5'||p.sourceRoot!=='C:/Users/Xaser/Desktop/ERP/kaynak-r1'||typeof p.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.createdAt))fail();
 try{if(new Date(p.createdAt).toISOString()!==p.createdAt)fail();}catch{fail();}
 if(typeof p.snapshotSqlSha256!=='string'||!hash.test(p.snapshotSqlSha256)||typeof p.dependencySha256!=='string'||!hash.test(p.dependencySha256))fail();
 const pathSafe=s=>!s.split('/').some(x=>!x||x==='.'||x==='..');
 map(p.sources,s=>pathSafe(s)&&!s.includes('.test.')&&(/^(apps\/api\/|scripts\/|packages\/shared\/)[A-Za-z0-9_./-]+\.(mjs|js)$/.test(s)&&!s.startsWith('apps/api/node_modules/')||/^infra\/sql\/migrations\/[A-Za-z0-9_./-]+\.(mjs|js|sql)$/.test(s)));
 keys(p.helpers,helpers);map(p.helpers,s=>helpers.includes(s));
 map(p.assets,s=>s==='desktop-write-green.html'||/^assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(s));
 const assets=Object.keys(p.assets);if(!assets.includes('desktop-write-green.html')||assets.filter(s=>s.endsWith('.js')).length!==1||assets.filter(s=>s.endsWith('.css')).length>1)fail();
 keys(p.publicFiles,[publicName]);if(p.publicFiles[publicName]!==publicHash)fail();
 const semantic=Object.create(null);for(const key of top)if(key!=='createdAt')semantic[key]=p[key];
 const contextKey=sha(Buffer.from(canonical(semantic),'utf8'));
 return Object.freeze({state:'MASTER_V5_RUN_CONTEXT_VERIFIED',packageSha256,contextKey,artifactDirectory:'C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-runs/'+contextKey});
}
