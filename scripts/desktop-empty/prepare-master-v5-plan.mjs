// Pure compilation to fixed review files only. Never executes SQL or replaces
// a prior plan. An attempt/outcome and independent observation are separate.
import {lstat,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {compileMasterV5ReviewPlan} from './master-v5-plan-core.mjs';
const root='C:/Users/Xaser/Desktop/ERP/kurulum/',sha=v=>createHash('sha256').update(v).digest('hex'),fail=()=>{throw Error('MASTER_V5_PLAN_REJECTED');};
async function read(name){const file=root+name,s=await lstat(file);if(s.isSymbolicLink()||!s.isFile()||s.size>1048576)fail();return JSON.parse(await readFile(file,'utf8'));}
try{
 const mode=process.argv[2];if(process.argv.length!==3||!['snapshot','rollback','apply','revert'].includes(mode))fail();
 const plan=await compileMasterV5ReviewPlan(mode,read);
 const bytes=Buffer.from(JSON.stringify(plan,null,2)+'\n'),file=root+`master-v5-${mode}-plan.json`;
 try{await writeFile(file,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;const old=await lstat(file);if(old.isSymbolicLink()||!old.isFile()||old.size>1048576||!Buffer.from(await readFile(file)).equals(bytes))throw error;}
 process.stdout.write(JSON.stringify({mode,planSha256:sha(bytes),sqlSha256:plan.sha256,file}));
}catch{process.stderr.write('MASTER_V5_PLAN_REJECTED');process.exitCode=1;}
