// Root-operated real Windows rehearsal. Default inspection writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
export const P03_B264_V2_ENGINE=Object.freeze({path:String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-recovery-control-eb5b37a555cb\p03-physical-rollback.ps1`,sha256:'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'});
export function parseP03RehearsalMode(args){if(args.length>1||!['--DryRun','--Run','--LightHubRun','--B264V2DryRun','--B264V2Run',undefined].includes(args[0]))throw Error('P03_REHEARSAL_MODE');return args[0]?.startsWith('--B264V2')?args[0].slice(2):args[0]==='--LightHubRun'?'LightHubRun':args[0]==='--Run'?'Run':'DryRun';}
export function p03RehearsalSourceRequest(directory,mode){
 const v2=['B264V2DryRun','B264V2Run'].includes(mode),driverMode=v2?mode.slice(6):mode;
 if(!['DryRun','Run'].includes(driverMode))throw Error('P03_REHEARSAL_MODE');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const names=['p03-rehearsal-fixture.mjs','p03-rehearsal-watch-core.ps1','p03-rehearsal-watch-hub.ps1'];
 const files=names.map(name=>{const source=path.join(directory,name),stat=fs.lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('P03_REHEARSAL_SOURCE');const bytes=fs.readFileSync(source);return {name,sha256:hash(bytes),bytesBase64:bytes.toString('base64')};});
 const engine=v2?P03_B264_V2_ENGINE.path:path.join(directory,'p03-physical-rollback.ps1'),engineBytes=fs.readFileSync(engine);
 if(v2&&hash(engineBytes)!==P03_B264_V2_ENGINE.sha256)throw Error('P03_REHEARSAL_V2_ENGINE');
 return {mode:driverMode,...(v2?{engineGeneration:'B264V2'}:{}),files,engine:{path:engine,sha256:hash(engineBytes)},cloneProof:{path:'C:\\Sirket\\ERP\\backups\\P03-20261018-121000\\isolated-restore-v4\\restore-rehearsal-verified.json',sha256:'e820511b06f64c21b0fe9c0a1338af355f0e440bdfe0459136cdb14cfe2f5353'}};
}
async function main(){
 const mode=parseP03RehearsalMode(process.argv.slice(2));if(process.platform!=='win32')throw Error('P03_REHEARSAL_PLATFORM');
 if(mode==='LightHubRun'){const {runLightHubRehearsal}=await import('./p03-light-hub-driver.mjs');const request=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(await runLightHubRehearsal(request))+'\n');return;}
 const directory=path.dirname(fileURLToPath(import.meta.url)),request=p03RehearsalSourceRequest(directory,mode);
 const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(directory,'p03-rehearsal-driver.ps1'),'-Mode',request.mode,...(request.engineGeneration?['-EngineGeneration',request.engineGeneration]:[])],{input:JSON.stringify(request),encoding:'utf8',windowsHide:true,timeout:request.mode==='Run'?600000:60000,maxBuffer:65536,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 if(child.status!==0||child.error){const stderr=String(child.stderr??''),codes=stderr.match(/\bP03_[A-Z_]+\b/g)??[];process.stderr.write(JSON.stringify({status:'P03_REHEARSAL_FAILED_RETAIN_ALL_ARTIFACTS',reason:codes.at(-1)??'P03_REHEARSAL_EXECUTION_REJECTED',errorType:stderr.match(/\bTYPE_(MethodInvocationException|RuntimeException|UnauthorizedAccessException|IOException|OtherException)\b/)?.[1]??'OtherException',method:stderr.match(/\bMETHOD_(Invoke|InvokeMethod|CreateDirectory|Write|Flush|AddAccessRule|SetOwner|CheckActionPreference|UnknownMethod)\b/)?.[1]??'UnknownMethod'})+'\n');process.exitCode=1;return;}
 const result=JSON.parse(child.stdout);if(!['DRY_RUN_READY','REHEARSAL_ROLLBACK_READY'].includes(result.status))throw Error('P03_REHEARSAL_RESULT');
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){main().catch(()=>{process.stderr.write('P03_REHEARSAL_REJECTED\n');process.exitCode=1;});}
