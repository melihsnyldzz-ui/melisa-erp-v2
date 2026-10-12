import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const semihSetupRoot='C:\\Sirket\\ERP\\runtime\\SEMIH-TEST-20261012';
const fail=()=>{throw Error('SEMIH_TEST_CREDENTIAL_UNAVAILABLE');};
export function checkSemihPrivatePath(file,{exists=true}={}){
 const resolved=path.win32.resolve(file),relative=path.win32.relative(semihSetupRoot,resolved);
 if(process.platform!=='win32'||!path.win32.isAbsolute(file)||!relative||relative==='..'||relative.startsWith('..\\')||path.win32.isAbsolute(relative)||resolved!==file)fail();
 for(let p=path.resolve(file);;p=path.dirname(p)){
  if(fs.existsSync(p)){const s=fs.lstatSync(p);if(s.isSymbolicLink()||p===path.resolve(file)&&(!s.isFile()||s.nlink!==1||s.size>65536))fail();}
  else if(p===path.resolve(file)&&exists)fail();
  if(p===path.dirname(p))break;
 }
}
export async function transformSemihCredential(mode,bytes,{spawnChild=spawn}={}){
 if(process.platform!=='win32'||!['protect','unprotect'].includes(mode)||!Buffer.isBuffer(bytes)||bytes.length>32768)fail();
 const helper=fileURLToPath(new URL('./semih-test-credential.ps1',import.meta.url));
 return new Promise((resolve,reject)=>{
  const child=spawnChild('powershell.exe',['-NoProfile','-NonInteractive','-File',helper,'-Mode',mode],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const output=[];let size=0,done=false;
  const rejectSafe=()=>{if(!done){done=true;reject(Error('SEMIH_TEST_CREDENTIAL_UNAVAILABLE'));}};
  const timer=setTimeout(()=>{child.kill();rejectSafe();},10000);
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>65536){child.kill();rejectSafe();}else output.push(chunk);});
  child.stderr.on('data',()=>{});child.on('error',rejectSafe);
  child.on('close',code=>{clearTimeout(timer);if(done)return;done=true;const encoded=Buffer.concat(output).toString();for(const b of output)b.fill(0);if(code!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)){reject(Error('SEMIH_TEST_CREDENTIAL_UNAVAILABLE'));return;}resolve(Buffer.from(encoded,'base64'));});
  child.stdin.on('error',rejectSafe);child.stdin.end(bytes.toString('base64'));
 });
}
export async function readSemihFirstLogin(file){
 checkSemihPrivatePath(file);const plain=await transformSemihCredential('unprotect',fs.readFileSync(file));
 try{const value=JSON.parse(plain.toString());if(Object.keys(value).sort().join(',')!=='copyId,password,schemaVersion,username'||value.schemaVersion!=='melisa-semih-test-credential.v1'||value.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||value.username!=='erp-semih-test-20261012'||typeof value.password!=='string'||value.password.length<32||value.password.length>128)fail();return value;}finally{plain.fill(0);}
}
export async function readCrmSemihFirstLogin(){
 const prepared=path.join(semihSetupRoot,'crm-first-login.dpapi');
 if(fs.existsSync(prepared)){
  checkSemihPrivatePath(prepared);const plain=await transformSemihCredential('unprotect',fs.readFileSync(prepared));
  try{const v=JSON.parse(plain.toString());if(Object.keys(v).sort().join(',')!=='copyId,password,schemaVersion,username'||v.schemaVersion!=='melisa-semih-test-credential.v1'||v.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||v.username!=='crm-semih-test'||typeof v.password!=='string'||v.password.length<32||v.password.length>128)fail();return{username:v.username,password:v.password};}finally{plain.fill(0);}
 }
 fail(); // No fallback to an unverified older protection format or identity.
}
