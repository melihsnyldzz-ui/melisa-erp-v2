import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {localC06InputPaths,observeC06LocalTests,parseC06Tap} from './local-c06-test-runner.mjs';

const tap=(counts='2 2 0 0 0 0')=>{
  const [tests,pass,fail,cancelled,skipped,todo]=counts.split(' ');
  return `TAP version 13\nok 1 - one\nok 2 - two\n1..2\n# tests ${tests}\n# pass ${pass}\n# fail ${fail}\n# cancelled ${cancelled}\n# skipped ${skipped}\n# todo ${todo}\n`;
};
test('fixed TAP summary requires actual complete zero-failure counts',()=>{
  assert.deepEqual(parseC06Tap(tap()),{count:2,passed:2,failed:0,cancelled:0,skipped:0,todo:0});
  for(const invalid of [tap('2 1 1 0 0 0'),tap('2 1 0 0 1 0'),tap('2 1 0 1 0 0'),tap('2 1 0 0 0 1'),tap('2 1 0 0 0 0'),tap('0 0 0 0 0 0'),tap().replace('# pass 2\n',''),tap()+'# pass 2\n',tap().replace('TAP version 13','TAP version 12'),tap().replace('ok 1 - one\n',''),tap().replace('1..2','1..3')]) assert.throws(()=>parseC06Tap(invalid));
});

test('Windows input paths normalize to exact Git paths',()=>{
  const root=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`;
  const names=localC06InputPaths().map(file=>path.win32.relative(root,file).replaceAll('\\','/'));
  assert.equal(names.length,36);assert.equal(new Set(names).size,36);
  assert.equal(names[0],'scripts/ci/offline-guard.cjs');
  assert(names.slice(1,8).every(n=>/^apps\/sites-workflow\/src\/workflow\/[^/]+\.test\.mjs$/.test(n)));
  assert(names.slice(8).includes('scripts/canonical/shared-business-daily-revision-sql.mjs'));
  assert(names.slice(8).includes('scripts/canonical/stage4-copy-context-sql.mjs'));
  assert(names.slice(8).every(n=>/^scripts\/canonical\/[^/]+\.mjs$/.test(n)));
});

test('fixed seven-file local command actually runs and cannot grant installation authority',{timeout:125000},()=>{
  const observed=observeC06LocalTests();
  assert.equal(observed.summary.count,176);
  assert.equal(observed.coverage,'UNVERIFIED');
  assert.equal(observed.sourceImmutability,'UNVERIFIED');
  assert.equal(observed.testRunVerified,false);
  assert.equal(observed.executionAuthority,false);
});
