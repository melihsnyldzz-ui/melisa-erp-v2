// Called by the package-pinned executor BEFORE SQL dispatch. Exact canonical
// plan bytes are recompiled from trusted source, including public binding hash.
import {lstat,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {compileMasterV5ReviewPlan} from './master-v5-plan-core.mjs';
const root='C:/Users/Xaser/Desktop/ERP/kurulum/',sha=v=>createHash('sha256').update(v).digest('hex'),fail=()=>{throw Error('MASTER_V5_PLAN_SOURCE_REJECTED');};
async function bytes(name){const file=root+name,s=await lstat(file);if(s.isSymbolicLink()||!s.isFile()||s.size>1048576)fail();return readFile(file);}
try{
 const mode=process.argv[2];if(process.argv.length!==3)fail();
 const plan=await compileMasterV5ReviewPlan(mode,async name=>JSON.parse((await bytes(name)).toString('utf8'))),expected=Buffer.from(JSON.stringify(plan,null,2)+'\n'),actual=await bytes(`master-v5-${mode}-plan.json`);
 if(!expected.equals(actual))fail();process.stdout.write(JSON.stringify({state:'MASTER_V5_PLAN_SOURCE_VERIFIED',planSha256:sha(expected),sqlSha256:plan.sha256}));
}catch{process.stderr.write('MASTER_V5_PLAN_SOURCE_REJECTED');process.exitCode=1;}
