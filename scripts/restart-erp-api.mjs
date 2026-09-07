import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {controller,health,record,readJSON,waitFor,restartTransaction} from './guarded-runtime.mjs';
const run=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=k=>process.argv[process.argv.indexOf(k)+1];
const feature=arg('--commit'),rollback=arg('--rollback-commit'),ai=arg('--ai-source');
const privateRoot=path.join(homedir(),'.melisa-ai','erp-restart');
const lease=path.join(process.env.LOCALAPPDATA,'MelisaERPServer','api-restart-lease.json');
const healthUrl='http://127.0.0.1:4100/api/health',api=path.join(root,'apps/api');
const control=controller(path.join(root,'scripts/runtime-process-control.ps1'),4100);
const portOpen=()=>new Promise(resolve=>{const s=createConnection({host:'127.0.0.1',port:4100});const done=x=>{s.destroy();resolve(x)};s.once('connect',()=>done(true));s.once('error',()=>done(false));s.setTimeout(2000,()=>done(true));});
let held=false,attempt;
try {
 if(!/^[a-f0-9]{40}$/.test(feature)||!/^[a-f0-9]{40}$/.test(rollback)||!path.isAbsolute(ai))throw Error('EXACT_RESTART_INPUT_REQUIRED');
 await run('git',['merge-base','--is-ancestor',rollback,feature],{cwd:root});
 // Application route must still be exactly the requested feature; unrelated
 // dirty files remain in place and are recorded as an explicit working overlay.
 const paths=['apps/api/src/routes/index.js','apps/api/src/routes/productSalesEvidenceRoutes.js','apps/api/src/controllers/productSalesEvidenceController.js','apps/api/src/services/vegaProductSalesEvidenceService.js'];
 await run('git',['diff','--exit-code',feature,'--',...paths],{cwd:root});
 await run(process.execPath,['--test','src/services/vegaProductSalesEvidenceService.test.js','src/services/vegaProductIntelligenceService.test.js'],{cwd:api,windowsHide:true,timeout:30000,maxBuffer:64000});
 attempt=path.join(privateRoot,String(Date.now()));await mkdir(attempt,{recursive:true,mode:0o700});
 const registry=path.join(attempt,'previous-process.json'),startedRecord=path.join(attempt,'started-process.json');
 const index=path.join(api,'src/routes/index.js'),originalIndex=await readFile(index);
 const oldIndex=(await run('git',['show',rollback+':apps/api/src/routes/index.js'],{cwd:root,encoding:'buffer',maxBuffer:64000})).stdout;
 await writeFile(path.join(attempt,'new-index.js'),originalIndex);await writeFile(path.join(attempt,'rollback-index.js'),oldIndex);
 const status=(await run('git',['status','--porcelain'],{cwd:root})).stdout;
 const checkConfig=async()=>{for(const name of ['.env','.env.local']){const file=path.join(api,name);let bytes;try{bytes=await readFile(file)}catch(e){if(e.code!=='ENOENT')throw e}if(bytes)config.set(file,bytes)}};
 const config=new Map();await checkConfig();
 const unchanged=async()=>{for(const [file,bytes] of config)if(!(await readFile(file)).equals(bytes))throw Error('RUNTIME_CONFIG_CHANGED');};
 const fresh=()=>health(healthUrl,'melisa-erp-api');
 await mkdir(path.dirname(lease),{recursive:true});await writeFile(lease,JSON.stringify({ownerPid:process.pid,expiresAt:Date.now()+300000}),{flag:'wx'});held=true;
 const register=async(file,pid)=>control('Register',{WorkingDirectory:api,EntryPoint:'src/server.js',Record:file,KnownPid:pid});
 const result=await restartTransaction({
  preflight:async()=>{const h=await fresh();if(!h||h.data.status!=='ok')throw Error('ERP_HEALTH_NOT_READY');await unchanged();await register(registry);return {health:h,featureCommit:feature,rollbackCommit:rollback,workingOverlay:status};},
  save:before=>record(path.join(attempt,'before.json'),before),
  stop:()=>control('Stop',{Record:registry}),
  waitDown:()=>waitFor(async()=>!(await portOpen()),20000),
  start:()=>control('Start',{Record:registry}),
  ready:async started=>{await waitFor(fresh);const s=await control('Inspect');if(s.pid!==started.pid)throw Error('RUNTIME_START_OWNER_MISMATCH');await unchanged();},
  verify:async()=>{try{const r=await run(process.execPath,[path.join(ai,'scripts/verify-step5-erp.mjs')],{cwd:ai,windowsHide:true,timeout:150000,maxBuffer:64000});await record(path.join(attempt,'reads.json'),JSON.parse(r.stdout.trim()));}catch{throw Error('ERP_EXISTING_READ_REGRESSION');}},
  commit:async started=>{await register(startedRecord,started.pid);await record(path.join(privateRoot,'state.json'),{featureCommit:feature,launcherCommit:(await run('git',['rev-parse','HEAD'],{cwd:root})).stdout.trim(),pid:started.pid,cwd:api,workingOverlay:status,attempt,rollbackUsed:false});},
  stopStarted:async started=>{try{await register(startedRecord,started.pid);}catch(e){if(await portOpen())throw e;return;}await control('Stop',{Record:startedRecord});},
  restore:async()=>{await unchanged();if(!(await readFile(index)).equals(originalIndex))throw Error('RUNTIME_SOURCE_CHANGED');await writeFile(index,oldIndex);},
  startRollback:()=>control('Start',{Record:registry}),
  rollbackCommit:async started=>record(path.join(privateRoot,'state.json'),{featureCommit:rollback,pid:started.pid,cwd:api,attempt,rollbackUsed:true})
 });
 console.log(JSON.stringify({...result,featureCommit:result.deployed?feature:rollback,attempt}));
 if(!result.deployed)process.exitCode=2;
} catch(e){console.log(JSON.stringify({deployed:false,error:/^[A-Z_]+$/.test(e.message)?e.message:'ERP_RESTART_FAILED',attempt}));process.exitCode=2;}
finally{if(held)await rm(lease,{force:true});}

