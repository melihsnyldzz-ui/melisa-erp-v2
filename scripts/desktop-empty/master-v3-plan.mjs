// Emits a fixed-target offline plan. Never opens SQL or receives credentials.
import {readFile} from 'node:fs/promises';
import {compileMasterV3Snapshot,compileMasterV3Transition} from './master-v3-transition.mjs';
const mode=process.argv[2];
if(process.argv.length!==3||!['snapshot','rollback','apply'].includes(mode))throw Error('MASTER_V3_PLAN_ARGUMENT');
let plan;
if(mode==='snapshot')plan=compileMasterV3Snapshot();
else{
 const baseline=JSON.parse(await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/master-v3-baseline.json','utf8'));
 if(baseline.state!=='MASTER_V3_BASELINE_OBSERVED'||baseline.snapshot?.schemaVersion!==2)throw Error('MASTER_V3_BASELINE_FILE');
 const {metadataSha256,securitySha256,businessRowsSha256}=baseline.snapshot;
 plan=compileMasterV3Transition({mode,metadataSha256,securitySha256,businessRowsSha256});
}
process.stdout.write(JSON.stringify({mode,...plan}));
