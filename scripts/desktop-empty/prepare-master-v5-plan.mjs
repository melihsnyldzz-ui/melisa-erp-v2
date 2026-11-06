// Source-only plan generation; immutable per semantic package context.
import {createHash} from 'node:crypto';
import {loadMasterV5RunContext,readMasterV5RunFile,writeMasterV5RunFile} from './master-v5-run-files.mjs';
import {compileMasterV5ReviewPlan} from './master-v5-plan-core.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex'),fail=()=>{throw Error('MASTER_V5_PLAN_REJECTED');};
try{const [mode,hash]=process.argv.slice(2);if(process.argv.length!==4||!['snapshot','rollback','apply','revert','diagnose'].includes(mode))fail();
 const ctx=await loadMasterV5RunContext(hash,{prepare:true}),plan=await compileMasterV5ReviewPlan(mode,async name=>JSON.parse((await readMasterV5RunFile(ctx.root,name)).toString('utf8')),ctx);
 const bytes=Buffer.from(JSON.stringify(plan,null,2)+'\n'),name=`master-v5-${mode}-plan.json`;await writeMasterV5RunFile(ctx.root,name,bytes);
 process.stdout.write(JSON.stringify({mode,planSha256:sha(bytes),sqlSha256:plan.sha256,file:ctx.root+name,contextKey:ctx.contextKey}));
}catch{process.stderr.write('MASTER_V5_PLAN_REJECTED');process.exitCode=1;}
