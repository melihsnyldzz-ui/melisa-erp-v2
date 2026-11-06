// Synthetic observations and a read-only source ordering check; no child,
// Git, output-path access or SQL.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {assertC06Added7abObservation,assertC06Added7abInputPaths,c06Added7abInputCommit,C06_7AB_LOCAL_SELECTED_INPUTS,C06_7AB_LOCAL_EXECUTED_TESTS,PAIR_REPO,prepareC06BusinessPair,C06_7AB_SOURCE_PIN} from './prepare-current-business-pair.mjs';
import {localC06ObservedInputs7ab} from './local-c06-test-runner.mjs';
const fixedPaths=()=>C06_7AB_LOCAL_SELECTED_INPUTS.map(p=>path.join(PAIR_REPO,...p.split('/')));
const executed=()=>C06_7AB_LOCAL_EXECUTED_TESTS.map(p=>path.join(PAIR_REPO,...p.split('/')));
const rows=()=>fixedPaths().map(file=>({file,sha256:'a'.repeat(64)}));
const observed=inputs=>({schema:'c06-7ab-added-local-observation.v1',scope:'PRODUCER',nodeSha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237',inputs,executedTests:executed(),inputCoverage:'SELECTED_INPUTS_ONLY',summary:{count:55,passed:55,failed:0,cancelled:0,skipped:0,todo:0},stdoutSha256:'b'.repeat(64),stderrSha256:'c'.repeat(64),historical176:'NOT_RUN',coverage:'UNVERIFIED',sourceImmutability:'UNVERIFIED',testRunObserved:true,testRunVerified:false,executionAuthority:false});
test('added observation binds all 54 exact input hashes and cannot claim install authority',()=>{
 const expected=rows();assert(assertC06Added7abObservation(observed(expected),expected));
 for(const mutate of [o=>o.scope='ISOLATED',o=>o.nodeSha256='0'.repeat(64),o=>o.summary.count=54,o=>o.summary.skipped=1,o=>o.summary.failed=1,o=>o.summary.todo=1,o=>o.summary.cancelled=1,o=>o.historical176='PASS',o=>o.coverage='VERIFIED',o=>o.sourceImmutability='VERIFIED',o=>o.testRunVerified=true,o=>o.executionAuthority=true,o=>o.stdoutSha256='bad',o=>o.inputs[0].sha256='d'.repeat(64),o=>o.inputs.pop(),o=>o.inputCoverage='COMPLETE',o=>delete o.executedTests,o=>o.executedTests.pop(),o=>o.executedTests.reverse(),o=>o.executedTests[0]=o.inputs[0].file,o=>o.executedTests=Array(6),o=>o.inputs=Array(54),o=>o.inputs[0].file+='-other']){
  const candidate=observed(rows());mutate(candidate);assert.throws(()=>assertC06Added7abObservation(candidate,expected),/C06_7AB_LOCAL_OBSERVATION/);
 }
 const duplicate=rows();duplicate[1].file=duplicate[0].file;assert.throws(()=>assertC06Added7abObservation(observed(duplicate),duplicate),/C06_7AB_LOCAL_INPUT_PATHS/);
 const badHash=rows();badHash[0].sha256='not-a-sha';assert.throws(()=>assertC06Added7abObservation(observed(badHash),badHash),/C06_7AB_LOCAL_OBSERVATION/);
});

test('expected paths match the real runner selection; arbitrary, sparse or aliased sets reject',()=>{
 assert.deepEqual(localC06ObservedInputs7ab(),fixedPaths());assert.equal(fixedPaths().length,54);assert.equal(executed().length,6);
 assert(assertC06Added7abInputPaths(fixedPaths()));
 for(const paths of [Array.from({length:54},(_,i)=>'fixture/'+i),Array(54),fixedPaths().reverse(),fixedPaths().slice(1)])
  assert.throws(()=>assertC06Added7abInputPaths(paths),/C06_7AB_LOCAL_INPUT_PATHS/);
 for(const spelling of [fixedPaths()[0].toUpperCase(),fixedPaths()[0]+'/../offline-guard.cjs',fixedPaths()[0]+'-other']){
  const paths=fixedPaths();paths[0]=spelling;assert.throws(()=>assertC06Added7abInputPaths(paths),/C06_7AB_LOCAL_INPUT_PATHS/);
 }
 const disguised=Array.from({length:54},(_,i)=>'fixture/'+i);disguised.toJSON=fixedPaths;
 assert.throws(()=>assertC06Added7abInputPaths(disguised),/C06_7AB_LOCAL_INPUT_PATHS/);
});

test('application inputs bind to exact 7ab; runner/guard/canonical witnesses bind to producer',()=>{
 const producer='9'.repeat(40);
 for(const file of C06_7AB_LOCAL_SELECTED_INPUTS){const expected=file.startsWith('apps/')?C06_7AB_SOURCE_PIN:producer;assert.equal(c06Added7abInputCommit(file,C06_7AB_SOURCE_PIN,producer),expected);}
 for(const args of [['apps/api/src/config/database.js','0'.repeat(40),producer],['scripts/ci/offline-guard.cjs',C06_7AB_SOURCE_PIN,'bad'],['scripts/ci/offline-guard.cjs',C06_7AB_SOURCE_PIN,producer+'\n'],['apps/api/not-selected.mjs',C06_7AB_SOURCE_PIN,producer]])
  assert.throws(()=>c06Added7abInputCommit(...args),/C06_7AB_LOCAL_INPUT_REVISION/);
 const text=readFileSync(new URL('./prepare-current-business-pair.mjs',import.meta.url),'utf8');
 assert(text.includes('const commit=c06Added7abInputCommit(rel,sourcePin,producer)'));
 assert(text.includes("git(['show',commit+':'+rel],true)"));
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
