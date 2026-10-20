// Root-operated real Windows rehearsal. Default inspection writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
export const P03_B264_V2_ENGINE=Object.freeze({path:String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-recovery-control-eb5b37a555cb\p03-physical-rollback.ps1`,sha256:'99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def'});
// Separate finite candidate, not staged or admitted by this source declaration.
export const P03_FAILURE_RECORD_V1_ENGINE=Object.freeze({path:String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\engine-candidate-1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054.ps1`,sha256:'1b1919ba707171ab561ed09eb60b494276a5b1728fc6779976562e6919a91054'});
export const P03_FILE_ATTRIBUTES_V1_ENGINE=Object.freeze({path:String.raw`C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\engine-candidate-b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f.ps1`,sha256:'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'});
export function parseP03RehearsalMode(args){if(args.length>1||!['--DryRun','--Run','--LightHubRun','--B264V2DryRun','--B264V2Run','--FailureRecordV1DryRun','--FailureRecordV1Run','--FileAttributesV1DryRun','--FileAttributesV1Run',undefined].includes(args[0]))throw Error('P03_REHEARSAL_MODE');return args[0]?.startsWith('--B264V2')||args[0]?.startsWith('--FailureRecordV1')||args[0]?.startsWith('--FileAttributesV1')?args[0].slice(2):args[0]==='--LightHubRun'?'LightHubRun':args[0]==='--Run'?'Run':'DryRun';}
export function p03RehearsalSourceRequest(directory,mode){
 const v2=['B264V2DryRun','B264V2Run'].includes(mode),candidate=['FailureRecordV1DryRun','FailureRecordV1Run'].includes(mode),attributes=['FileAttributesV1DryRun','FileAttributesV1Run'].includes(mode),driverMode=v2?mode.slice(6):candidate?mode.slice('FailureRecordV1'.length):attributes?mode.slice('FileAttributesV1'.length):mode;
 if(!['DryRun','Run'].includes(driverMode))throw Error('P03_REHEARSAL_MODE');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const names=['p03-rehearsal-fixture.mjs','p03-rehearsal-watch-core.ps1','p03-rehearsal-watch-hub.ps1'];
 const files=names.map(name=>{const source=path.join(directory,name),stat=fs.lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('P03_REHEARSAL_SOURCE');const bytes=fs.readFileSync(source);return {name,sha256:hash(bytes),bytesBase64:bytes.toString('base64')};});
 const engine=v2?P03_B264_V2_ENGINE.path:candidate?P03_FAILURE_RECORD_V1_ENGINE.path:attributes?P03_FILE_ATTRIBUTES_V1_ENGINE.path:path.join(directory,'p03-physical-rollback.ps1'),engineBytes=fs.readFileSync(engine);
 if(v2&&hash(engineBytes)!==P03_B264_V2_ENGINE.sha256)throw Error('P03_REHEARSAL_V2_ENGINE');
 if(candidate&&hash(engineBytes)!==P03_FAILURE_RECORD_V1_ENGINE.sha256)throw Error('P03_REHEARSAL_FAILURE_RECORD_ENGINE');
 if(attributes&&hash(engineBytes)!==P03_FILE_ATTRIBUTES_V1_ENGINE.sha256)throw Error('P03_REHEARSAL_FILE_ATTRIBUTES_ENGINE');
 return {mode:driverMode,...(v2?{engineGeneration:'B264V2'}:candidate?{engineGeneration:'FailureRecordV1'}:attributes?{engineGeneration:'FileAttributesV1'}:{}),files,engine:{path:engine,sha256:hash(engineBytes)},cloneProof:{path:'C:\\Sirket\\ERP\\backups\\P03-20261018-121000\\isolated-restore-v4\\restore-rehearsal-verified.json',sha256:'e820511b06f64c21b0fe9c0a1338af355f0e440bdfe0459136cdb14cfe2f5353'}};
}
export function p03RehearsalFailureMetadata(stderr){
 const value=String(stderr??''),codes=value.match(/\bP03_[A-Z_]+\b/g)??[],line=value.match(/\bLINE_([0-9]{1,7})(?=\s|$)/)?.[1],number=line===undefined?null:Number(line);
 return {status:'P03_REHEARSAL_FAILED_RETAIN_ALL_ARTIFACTS',reason:codes.at(-1)??'P03_REHEARSAL_EXECUTION_REJECTED',errorType:value.match(/\bTYPE_(MethodInvocationException|RuntimeException|UnauthorizedAccessException|IOException|ArgumentException|InvalidOperationException|PropertyNotFoundException|ParameterBindingException|PSInvalidCastException|OtherException)\b/)?.[1]??'OtherException',method:value.match(/\bMETHOD_(Invoke|InvokeMethod|CreateDirectory|Write|Flush|AddAccessRule|SetOwner|CheckActionPreference|UnknownMethod)\b/)?.[1]??'UnknownMethod',line:Number.isSafeInteger(number)&&number>=0&&number<=1000000?number:null};
}
async function main(){
 const mode=parseP03RehearsalMode(process.argv.slice(2));if(process.platform!=='win32')throw Error('P03_REHEARSAL_PLATFORM');
 if(mode==='LightHubRun'){const {runLightHubRehearsal}=await import('./p03-light-hub-driver.mjs');const request=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(await runLightHubRehearsal(request))+'\n');return;}
 const directory=path.dirname(fileURLToPath(import.meta.url)),request=p03RehearsalSourceRequest(directory,mode);
 const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(directory,'p03-rehearsal-driver.ps1'),'-Mode',request.mode,...(request.engineGeneration?['-EngineGeneration',request.engineGeneration]:[])],{input:JSON.stringify(request),encoding:'utf8',windowsHide:true,timeout:request.mode==='Run'?600000:60000,maxBuffer:65536,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 if(child.status!==0||child.error){process.stderr.write(JSON.stringify(p03RehearsalFailureMetadata(child.stderr))+'\n');process.exitCode=1;return;}
 const result=JSON.parse(child.stdout);if(!['DRY_RUN_READY','REHEARSAL_ROLLBACK_READY'].includes(result.status))throw Error('P03_REHEARSAL_RESULT');
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){main().catch(()=>{process.stderr.write('P03_REHEARSAL_REJECTED\n');process.exitCode=1;});}
