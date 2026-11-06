// Pure parser and fixed-input tests. No subprocess, filesystem fixture or SQL.
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
import {localC06InputPaths,localC06InputPaths7ab,localC06ObservedInputs7ab,parseC06Added7abTap} from './local-c06-test-runner.mjs';
const valid=`TAP version 13\n# Subtest: grouped\n    # Subtest: a\n    ok 1 - a\n    # Subtest: b\n    ok 2 - b\n    1..2\nok 1 - grouped\n# Subtest: single\nok 2 - single\n1..2\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
test('7ab nested TAP validates all result counts independently of root plan',()=>{
 assert.deepEqual(parseC06Added7abTap(valid),{count:4,passed:4,failed:0,cancelled:0,skipped:0,todo:0});
 for(const bad of [valid.replace('TAP version 13','TAP version 12'),valid+'TAP version 13\n',valid.replace('# suites 0','# suites 1'),valid.replace('# pass 4','# pass 3'),valid.replace('# fail 0','# fail 1'),valid.replace('# skipped 0','# skipped 1'),valid.replace('# cancelled 0','# cancelled 1'),valid.replace('# todo 0','# todo 1'),valid+'# pass 4\n',valid+'garbage\n',valid.replace('    ok 2 - b','    ok 3 - b'),valid.replace('    1..2','    1..3'),valid.replace('ok 2 - single','not ok 2 - single'),valid.replace('ok 2 - single','ok 2 - single # SKIP'),valid.replace('ok 2 - single','ok 2 - single # TODO'),valid.replace('1..2\n# tests','1..3\n# tests'),valid.replace('    ok 2 - b\n','')])assert.throws(()=>parseC06Added7abTap(bad));
 const orphan=`TAP version 13\n    # Subtest: orphan\n    ok 1 - orphan\n    1..1\n# Subtest: outer\nok 1 - outer\n1..1\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
 assert.throws(()=>parseC06Added7abTap(orphan),/C06_7AB_TAP_PLAN/);
 assert.throws(()=>parseC06Added7abTap(valid.replace('# Subtest: grouped','# Subtest: other')),/C06_7AB_TAP_PLAN/);
 assert.throws(()=>parseC06Added7abTap(valid+'ok 99\n'),/C06_7AB_TAP_FORMAT/);
});
test('7ab records fixed test roots and relevant runtime inputs without claiming transitive closure',()=>{
 const root=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`,old=localC06InputPaths(),added=localC06InputPaths7ab(),observed=localC06ObservedInputs7ab();
 assert.equal(old.length,36);assert.equal(added.length,42);assert.deepEqual(added.slice(0,36),old);assert.equal(observed.length,54);assert.equal(new Set(observed).size,54);
 const rel=observed.map(p=>path.win32.relative(root,p).replaceAll('\\','/'));
 for(const p of ['scripts/canonical/local-c06-test-runner.mjs','apps/api/src/config/canonicalReadonlyAuthQuery.test.mjs','apps/api/src/routes/c06SaleReadonlyMetadataAuthIntegration.test.mjs','apps/sites-workflow/src/workflow/workSupplierCardSwitch.test.mjs','apps/api/package-lock.json','apps/api/src/services/authService.js','apps/sites-workflow/src/workflow/workSuppliers.js'])assert(rel.includes(p));
});
