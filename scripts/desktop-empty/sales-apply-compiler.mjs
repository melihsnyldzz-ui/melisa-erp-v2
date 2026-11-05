// Pure compiler process. No SQL client, process launch or journal operations.
import {readFileSync} from 'node:fs';
import {compileDesktopSalesBootstrap} from './bootstrap-sales-proposal.mjs';
import {compileSalesRollbackReadback} from './rollback-sales-probe.mjs';
const raw=readFileSync(0,'utf8');if(raw.length>2048)throw Error('INPUT_REJECTED');
const input=JSON.parse(raw);let output;
if(input?.mode==='bootstrap'&&Object.keys(input).length===1)output=compileDesktopSalesBootstrap();
else if(input?.mode==='empty'&&Object.keys(input).length===2)output=compileSalesRollbackReadback(input.identity);
else if(input?.mode==='applied'&&Object.keys(input).length===2){
 const {compileApplySalesReadback}=await import('./apply-sales-readback.mjs');
 output=compileApplySalesReadback(input.identity);
}else throw Error('INPUT_REJECTED');
process.stdout.write(JSON.stringify(output));
