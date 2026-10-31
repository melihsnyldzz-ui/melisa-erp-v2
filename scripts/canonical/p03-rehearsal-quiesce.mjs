// Root-operated cleanup of only the two owned P03 fixture tasks and processes.
// Files/evidence remain. Default DryRun performs no mutation.
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
export function parseP03QuiesceArgs(args){
 if(args.length!==6&&args.length!==8)throw Error('P03_QUIESCE_ARGUMENTS');
 const values=new Map();for(let i=0;i<args.length;i+=2){if(!['--run-id','--profile-sha256','--before-sha256','--mode'].includes(args[i])||values.has(args[i]))throw Error('P03_QUIESCE_FLAG');values.set(args[i],args[i+1]);}
 const runId=values.get('--run-id'),profileSha256=values.get('--profile-sha256'),beforeSha256=values.get('--before-sha256'),mode=values.get('--mode')??'DryRun';
 if(!/^[a-f0-9]{32}$/.test(runId??'')||!/[a-f0-9]{64}/.test(profileSha256??'')||!/[a-f0-9]{64}/.test(beforeSha256??'')||!['DryRun','Quiesce'].includes(mode))throw Error('P03_QUIESCE_SCOPE');
 if(profileSha256.length!==64||beforeSha256.length!==64)throw Error('P03_QUIESCE_SHA');return {runId,profileSha256,beforeSha256,mode};
}
function main(){const args=parseP03QuiesceArgs(process.argv.slice(2));if(process.platform!=='win32')throw Error('P03_QUIESCE_PLATFORM');
 const file=fileURLToPath(new URL('./p03-rehearsal-quiesce.ps1',import.meta.url));
 const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',file,'-RunId',args.runId,'-ProfileSha256',args.profileSha256,'-BeforeImageSha256',args.beforeSha256,'-Mode',args.mode],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:65536,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 if(child.status!==0||child.error){process.stderr.write(JSON.stringify({status:'P03_QUIESCE_REJECTED_RETAIN_ALL_EVIDENCE',reason:String(child.stderr??'').match(/\bP03_[A-Z_]+\b/g)?.at(-1)??'P03_QUIESCE_EXECUTION_FAILED'})+'\n');process.exitCode=1;return;}
 const result=JSON.parse(child.stdout);if(!['QUIESCE_DRY_RUN_READY','OWNED_REHEARSAL_QUIESCED'].includes(result.status))throw Error('P03_QUIESCE_RESULT');process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{main();}catch{process.stderr.write('P03_QUIESCE_REJECTED\n');process.exitCode=1;}}
