// Recompile a pinned fixed-target plan before dispatch. Never opens SQL.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compileMasterV6BaselineObserver,compileMasterV6Transition,compileMasterV6ApplyObserver,compileMasterV6Readback} from './master-v6-transition.mjs';
const fail=()=>{throw Error('MASTER_V6_PLAN_SOURCE_REJECTED');};
try{
 const [mode,planHash,packageHash]=process.argv.slice(2);
 if(process.argv.length!==5||!['baseline','rollback','apply','observe-apply','readback','readback-running'].includes(mode)||![planHash,packageHash].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))fail();
 const bytes=await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/v6-goods-install-v1/'+mode+'-plan.json');
 if(bytes.length>2000000||createHash('sha256').update(bytes).digest('hex')!==planHash)fail();const plan=JSON.parse(bytes);
 if(Object.keys(plan).sort().join(',')!=='compilerInput,mode,packageSha256,plan'||plan.mode!==mode||plan.packageSha256!==packageHash)fail();
 const compiled=mode==='baseline'?compileMasterV6BaselineObserver():['rollback','apply'].includes(mode)?compileMasterV6Transition(plan.compilerInput):mode==='observe-apply'?compileMasterV6ApplyObserver(plan.compilerInput):compileMasterV6Readback({appMayBeRunning:mode==='readback-running'});
 if(['baseline','readback','readback-running'].includes(mode)&&plan.compilerInput!==null)fail();
 if(JSON.stringify(plan.plan)!==JSON.stringify(compiled))fail();
 process.stdout.write(JSON.stringify({state:'MASTER_V6_PLAN_SOURCE_VERIFIED',mode,planSha256:planHash,sqlSha256:compiled.sha256,packageSha256:packageHash}));
}catch{process.stderr.write('MASTER_V6_PLAN_SOURCE_REJECTED');process.exitCode=1;}
