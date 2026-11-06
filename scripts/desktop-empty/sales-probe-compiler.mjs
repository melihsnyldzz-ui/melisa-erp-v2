// Pure stdin/stdout compiler; it cannot launch processes or connect to SQL.
import {readFileSync} from 'node:fs';
import {compileSalesRollbackProbe,compileSalesRollbackReadback} from './rollback-sales-probe.mjs';
const raw=readFileSync(0,'utf8');if(raw.length>2048)throw Error('INPUT_REJECTED');
const input=JSON.parse(raw);let output;
if(input?.mode==='probe'&&Object.keys(input).length===1)output=compileSalesRollbackProbe();
else if(input?.mode==='readback'&&Object.keys(input).length===2)output=compileSalesRollbackReadback(input.identity);
else throw Error('INPUT_REJECTED');
process.stdout.write(JSON.stringify(output));
