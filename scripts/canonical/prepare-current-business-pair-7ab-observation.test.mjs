// Synthetic observations and a read-only source ordering check; no child,
// Git, output-path access or SQL.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertC06Added7abObservation,prepareC06BusinessPair,C06_7AB_SOURCE_PIN} from './prepare-current-business-pair.mjs';
const rows=()=>Array.from({length:54},(_,i)=>({file:'fixture/'+i,sha256:'a'.repeat(64)}));
const observed=inputs=>({schema:'c06-7ab-added-local-observation.v1',scope:'PRODUCER',nodeSha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237',inputs,summary:{count:55,passed:55,failed:0,cancelled:0,skipped:0,todo:0},stdoutSha256:'b'.repeat(64),stderrSha256:'c'.repeat(64),historical176:'NOT_RUN',coverage:'UNVERIFIED',sourceImmutability:'UNVERIFIED',testRunObserved:true,testRunVerified:false,executionAuthority:false});
test('added observation binds all 54 exact input hashes and cannot claim install authority',()=>{
 const expected=rows();assert(assertC06Added7abObservation(observed(expected),expected));
 for(const mutate of [o=>o.scope='ISOLATED',o=>o.nodeSha256='0'.repeat(64),o=>o.summary.count=54,o=>o.summary.skipped=1,o=>o.summary.failed=1,o=>o.summary.todo=1,o=>o.summary.cancelled=1,o=>o.historical176='PASS',o=>o.coverage='VERIFIED',o=>o.sourceImmutability='VERIFIED',o=>o.testRunVerified=true,o=>o.executionAuthority=true,o=>o.stdoutSha256='bad',o=>o.inputs[0].sha256='d'.repeat(64),o=>o.inputs.pop()]){
  const candidate=observed(rows());mutate(candidate);assert.throws(()=>assertC06Added7abObservation(candidate,expected),/C06_7AB_LOCAL_OBSERVATION/);
 }
 const duplicate=rows();duplicate[1].file=duplicate[0].file;assert.throws(()=>assertC06Added7abObservation(observed(duplicate),duplicate),/C06_7AB_LOCAL_OBSERVATION/);
});
test('output-parent guard still rejects before producer IO',async()=>{
 await assert.rejects(()=>prepareC06BusinessPair('9'.repeat(40),C06_7AB_SOURCE_PIN),/C06_7AB_OUTPUT_PARENT_UNVERIFIED/);
});
test('both separate observations precede the closure barrier and all output',()=>{
 const text=readFileSync(new URL('./prepare-current-business-pair.mjs',import.meta.url),'utf8');
 const src=text.slice(text.indexOf('export async function prepareC06BusinessPair('));
 const first=src.indexOf("C06_7AB_OUTPUT_PARENT_UNVERIFIED"),entry=src.indexOf("C06_ENTRY_PATH"),old=src.indexOf('localRunner.observeC06LocalTests()'),added=src.indexOf('localRunner.observeC06Added7abTests()'),closed=src.indexOf("throw Error('C06_7AB_LOCAL_TEST_CLOSURE_UNVERIFIED')"),base=src.indexOf('const raw=[C06_BASE.api,C06_BASE.web]');
 assert(first>=0&&entry>first&&old>entry&&added>old&&closed>added&&base>closed);
});
