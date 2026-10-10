import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assertStableServeBefore,assertOnlyStableServeAdded,stableAccessHash} from './hub-stable-access-plan.mjs';
export function verifyStableAccessPair(mode,before,after){
 assertStableServeBefore(before);
 if(mode==='Before'){if(stableAccessHash(before)!==stableAccessHash(after))throw Error('HUB_STABLE_ACCESS_BEFORE_DRIFT');return true;}
 if(mode==='After')return assertOnlyStableServeAdded(before,after);
 throw Error('HUB_STABLE_ACCESS_MODE_REJECTED');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{const [mode,beforeFile,afterFile,...extra]=process.argv.slice(2);if(extra.length)throw Error('ARGS');verifyStableAccessPair(mode,JSON.parse(fs.readFileSync(beforeFile,'utf8').replace(/^\ufeff/,'')),JSON.parse(fs.readFileSync(afterFile,'utf8').replace(/^\ufeff/,'')));process.stdout.write('HUB_STABLE_ACCESS_PAIR_VERIFIED\n');}
 catch{process.stderr.write('HUB_STABLE_ACCESS_PAIR_REJECTED\n');process.exitCode=1;}
}
