import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const exec=promisify(execFile);
export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function assertIdentity(live,expected) {
 const norm=s=>String(s).replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
 if(!Number.isInteger(live?.pid)||live.pid<=0||live.pid!==expected.pid||live.created!==expected.created||
   live.port!==expected.port||norm(live.cwd)!==norm(expected.cwd)||norm(live.executable)!==norm(expected.executable)||
   live.commandLine!==expected.commandLine) throw Error('RUNTIME_IDENTITY_CHANGED');
}
export async function health(url,service) {
 try {
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)});
  const b=await r.json();return r.ok&&(b.service??b.data?.service)===service?b:null;
 } catch{return null;}
}
export function controller(script,port) {
 return async(action,options={})=>{
  const args=['-NoProfile','-File',script,'-Action',action,'-Port',String(port)];
  for(const [k,v] of Object.entries(options))if(v!==undefined)args.push('-'+k,String(v));
  try {const r=await exec('powershell.exe',args,{windowsHide:true,timeout:45000,maxBuffer:64000});return JSON.parse(r.stdout.replace(/^\uFEFF/, '').trim());}
  catch(e) {
   // Preserve policy rejection as a stop condition; never change policy or retry
   // through a different shell. Never print process environment or raw errors.
   if(/UnauthorizedAccess|running scripts is disabled|blocked by policy/i.test(String(e.stderr)+String(e.stdout)))throw Error('RUNTIME_EXECUTION_POLICY_REJECTED');
   const match=String(e.stderr).match(/\b(?:RUNTIME|PROCESS|ABSOLUTE_PRIVATE)[A-Z_]+\b/);
   throw Error(match?.[0]??'RUNTIME_CONTROL_FAILED');
  }
 };
}
export async function record(file,value) {await mkdir(path.dirname(file),{recursive:true,mode:0o700});await writeFile(file,JSON.stringify(value,null,2),{mode:0o600});}
export async function waitFor(check,timeout=45000) {const end=Date.now()+timeout;do{const r=await check();if(r)return r;await delay(500);}while(Date.now()<end);throw Error('RUNTIME_READY_TIMEOUT');}
// Tested orchestration; platform operations are injected and independently
// revalidate the handle-bound recorded instance immediately before stopping.
export async function restartTransaction(io) {
 const before=await io.preflight();await io.save(before);
 await io.stop(before);
 await io.waitDown();
 let started;
 try {
  started=await io.start();await io.ready(started);await io.verify(started);
  await io.commit(started);return {deployed:true,rollbackUsed:false};
 } catch(error) {
  if(error.message==='RUNTIME_EXECUTION_POLICY_REJECTED')throw error;
  try {
   if(started)await io.stopStarted(started);
   await io.waitDown();await io.restore();
   const restored=await io.startRollback();await io.ready(restored);
   await io.rollbackCommit(restored);
  } catch {throw Error('RUNTIME_ROLLBACK_FAILED');}
  return {deployed:false,rollbackUsed:true,reason:/^[A-Z_]+$/.test(error.message)?error.message:'RUNTIME_VERIFICATION_FAILED'};
 }
}
export async function readJSON(file){return JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));}

