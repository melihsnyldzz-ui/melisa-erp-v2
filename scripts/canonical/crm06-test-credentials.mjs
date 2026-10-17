// Dedicated TEST credentials only. Official normal login remains mandatory.
// No users, roles, sessions, settings or journals are changed by this module.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),ROOT='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014';
const COPY='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const actors=Object.freeze({manager:Object.freeze({id:'crm-crm06-manager-test-20261014',username:'crm-crm06-manager',role:'mudur',chatwootAgentId:2}),staff:Object.freeze({id:'crm-crm06-staff-test-20261014',username:'crm-crm06-staff',role:'personel',chatwootAgentId:2})});
const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
// This helper launches Windows PowerShell 5.1, even when the caller uses PS7.
// Do not let the caller's PS7 module path break the owner ACL/DPAPI checks.
const shellEnvironment=()=>({...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Object.assign(Error('CRM06_CREDENTIAL_REJECTED'),{code:'CRM06_CREDENTIAL_REJECTED'});};
function actor(kind){if(!Object.hasOwn(actors,kind))fail();return actors[kind];}
function noReparse(file){for(let p=file;;p=path.dirname(p)){if(fs.lstatSync(p).isSymbolicLink())fail();if(p===path.dirname(p))break;}}
async function checkPrivate(){
 if(process.platform!=='win32')fail();noReparse(ROOT);
 const command='$a=Get-Acl -LiteralPath "C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014";$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid -or !$a.AreAccessRulesProtected){exit 2};foreach($r in $a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($r.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $r.IdentityReference.Value -notin @($sid,"S-1-5-18")){exit 3}};[Console]::Write("PRIVATE_OWNER_SYSTEM")';
 try{const r=await run(shell,['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000,maxBuffer:4096,env:shellEnvironment()});if(r.stdout!=='PRIVATE_OWNER_SYSTEM'||r.stderr)fail();}catch{fail();}
}
function transform(mode,buffer){return new Promise((resolve,reject)=>{
 const child=spawn(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',path.join(import.meta.dirname,'crm06-test-credential.ps1'),'-Mode',mode],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:shellEnvironment()});let out='',bad=false;
 const timer=setTimeout(()=>{bad=true;child.kill();},15000);
 child.stdout.on('data',b=>{out+=b.toString();if(out.length>16384){bad=true;child.kill();}});child.stderr.on('data',()=>{bad=true;});child.on('error',()=>{clearTimeout(timer);reject(Object.assign(Error('CRM06_CREDENTIAL_REJECTED'),{code:'CRM06_CREDENTIAL_REJECTED'}));});
 child.on('close',code=>{clearTimeout(timer);if(code!==0||bad||!out||!/^[A-Za-z0-9+/]+={0,2}$/.test(out)){reject(Object.assign(Error('CRM06_CREDENTIAL_REJECTED'),{code:'CRM06_CREDENTIAL_REJECTED'}));return;}resolve(Buffer.from(out,'base64'));});
 child.stdin.on('error',()=>{bad=true;});child.stdin.end(buffer.toString('base64'));
 });}
export function decodeCrm06CredentialEnvelope(buffer,kind){
 const a=actor(kind);let v;try{v=JSON.parse(buffer.toString('utf8'));}catch{fail();}
 const keys=['schemaVersion','copyId','actorId','username','password'];
 if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k))||v.schemaVersion!=='melisa-crm06-test-credential.v1'||v.copyId!==COPY||v.actorId!==a.id||v.username!==a.username||typeof v.password!=='string'||!/^[-_A-Za-z0-9]{48}$/.test(v.password))fail();
 const result={username:v.username};Object.defineProperty(result,'password',{value:v.password});return Object.freeze(result);
}
export async function readCrm06TestCredential(kind,{expectedSha256}={}){
 const a=actor(kind);if(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/i.test(expectedSha256))fail();await checkPrivate();
 const file=path.join(ROOT,kind+'-first-login.dpapi');noReparse(file);const cipher=fs.readFileSync(file);
 if(hash(cipher)!==expectedSha256.toLowerCase())fail();let plain;try{plain=await transform('Unprotect',cipher);return decodeCrm06CredentialEnvelope(plain,kind);}finally{cipher.fill(0);plain?.fill(0);}
}
export async function prepareCrm06TestCredentials(){
 await checkPrivate();const targets=['manager','staff'].map(kind=>path.join(ROOT,kind+'-first-login.dpapi'));if(targets.some(file=>fs.existsSync(file)))fail();
 const index=path.join(ROOT,'credential-index.json');if(fs.existsSync(index))fail();const records=[];
 for(const kind of ['manager','staff']){
  const a=actor(kind),password=crypto.randomBytes(36).toString('base64url'),plain=Buffer.from(JSON.stringify({schemaVersion:'melisa-crm06-test-credential.v1',copyId:COPY,actorId:a.id,username:a.username,password}));let cipher;
  try{cipher=await transform('Protect',plain);}finally{plain.fill(0);}
  const file=path.join(ROOT,kind+'-first-login.dpapi'),fd=fs.openSync(file,'wx',0o600);
  try{fs.writeFileSync(fd,cipher);fs.fsyncSync(fd);records.push({kind,...a,filePath:file,sha256:hash(cipher)});}finally{fs.closeSync(fd);cipher.fill(0);}
 }
 const metadata={schemaVersion:'crm06-test-credential-index.v1',copyId:COPY,protectedBy:'CurrentUserDPAPI',installed:false,actors:records};const fd=fs.openSync(index,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(metadata,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return Object.freeze(metadata);
}
