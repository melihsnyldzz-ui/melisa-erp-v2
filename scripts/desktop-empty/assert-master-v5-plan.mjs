// Recompile and compare exact plan bytes in the verified package namespace.
import {createHash} from 'node:crypto';
import {loadMasterV5RunContext,readMasterV5RunFile} from './master-v5-run-files.mjs';
import {compileMasterV5ReviewPlan} from './master-v5-plan-core.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex'),fail=()=>{throw Error('MASTER_V5_PLAN_SOURCE_REJECTED');};
try{const [mode,hash]=process.argv.slice(2);if(process.argv.length!==4||!['context','snapshot','rollback','apply','revert','diagnose'].includes(mode))fail();
 const ctx=await loadMasterV5RunContext(hash);if(mode==='context')process.stdout.write(JSON.stringify({state:ctx.state,packageSha256:ctx.packageSha256,contextKey:ctx.contextKey,artifactDirectory:ctx.artifactDirectory}));
 else{const plan=await compileMasterV5ReviewPlan(mode,async name=>JSON.parse((await readMasterV5RunFile(ctx.root,name)).toString('utf8')),ctx),expected=Buffer.from(JSON.stringify(plan,null,2)+'\n'),actual=await readMasterV5RunFile(ctx.root,`master-v5-${mode}-plan.json`);if(!expected.equals(actual))fail();process.stdout.write(JSON.stringify({state:'MASTER_V5_PLAN_SOURCE_VERIFIED',contextKey:ctx.contextKey,packageSha256:ctx.packageSha256,planSha256:sha(expected),sqlSha256:plan.sha256}));}
}catch{process.stderr.write('MASTER_V5_PLAN_SOURCE_REJECTED');process.exitCode=1;}
