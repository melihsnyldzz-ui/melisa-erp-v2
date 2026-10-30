import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARDS, windowsInventory, proposedPartitions, validatePartitions, aggregateSucceeded, canonicalDigest, checkSnapshot } from './windows-isolation-inventory.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/windows-isolation/snapshot.json', import.meta.url), 'utf8'));
const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const clone = value => structuredClone(value);

test('audited snapshot matches; it does not assert ownership, runtime success or workflow application', () => {
  const result = checkSnapshot(root, fixture);
  assert.equal(result.status, 'SNAPSHOT_MATCH_ONLY');
  assert.equal(result.sourceSnapshot, '35d3eeb267e4292fd0aca3aece1dbaf9e1a7b34a');
  assert.deepEqual(result.steps, { 'windows-startup-core': 12, 'windows-b6-profile': 1, 'windows-business-5244': 1 });
  for (const key of ['workflowApplied', 'windowsExecutionVerified', 'ownershipCleared']) assert.equal(result[key], false);
});

test('all 14 commands retained exactly once; B6 has 8 and Business has 12 entry files', () => {
  const inventory = windowsInventory(workflow);
  const partitions = proposedPartitions(inventory);
  assert.equal(validatePartitions(inventory, partitions), true);
  assert.equal(Object.values(partitions).flat().length, 14);
  assert.equal(new Set(Object.values(partitions).flat().map(s => s.name)).size, 14);
  for (const [id, count] of [[SHARDS[1], 8], [SHARDS[2], 12]]) {
    const run = partitions[id][0].run;
    assert.ok(run.startsWith('node --test --test-concurrency=1 '));
    assert.equal(run.split(' ').filter(s => s.endsWith('.test.mjs')).length, count);
  }
  assert.ok(partitions[SHARDS[0]].some(s => s.run === 'node scripts/ci/run.mjs windows-process-probe'));
});

test('omission, duplication, movement and core reordering invalidate coverage', () => {
  const mutations = [
    p => p[SHARDS[0]].pop(),
    p => p[SHARDS[1]].push(clone(p[SHARDS[1]][0])),
    p => p[SHARDS[0]].push(p[SHARDS[2]].pop()),
    p => p[SHARDS[0]].reverse(),
  ];
  for (const mutate of mutations) {
    const p = clone(fixture.partitions); mutate(p);
    assert.throws(() => validatePartitions(fixture.inventory, p), /COVERAGE_OR_ORDER/);
  }
});

test('test filters, concurrency changes, removed files and extra commands invalidate coverage', () => {
  const original = fixture.partitions[SHARDS[1]][0].run;
  for (const run of [original.replace('=1', '=2'), original + ' --test-name-pattern=fast', original.replace(/ \S+$/, ''), original + ' extra.test.mjs']) {
    const p = clone(fixture.partitions); p[SHARDS[1]][0].run = run;
    assert.throws(() => validatePartitions(fixture.inventory, p), /COVERAGE_OR_ORDER/);
  }
  const p = clone(fixture.partitions); p.extra = [];
  assert.throws(() => validatePartitions(fixture.inventory, p), /PARTITION_NAMES/);
});

test('parser rejects missing groups and unsupported conditional/multiline steps', () => {
  assert.throws(() => windowsInventory('jobs:\n'), /JOB_MISSING/);
  assert.throws(() => windowsInventory(workflow.replace('B6 finite native profile', 'Other finite native profile')), /GROUP_MISSING/);
  assert.throws(() => windowsInventory(workflow.replace('        run: node --test ', '        if: false\n        run: node --test ')), /UNSUPPORTED/);
  assert.throws(() => windowsInventory(workflow.replace('        run: node --test ', '        run: |\n          node --test ')), /UNSUPPORTED/);
});

test('runner, Node version, timeout and credential setup changes require re-audit', () => {
  for (const [from, to] of [['runs-on: windows-latest','runs-on: ubuntu-latest'], ["node-version: '24'","node-version: '22'"], ['timeout-minutes: 20','timeout-minutes: 30'], ['persist-credentials: false','persist-credentials: true']]) {
    assert.throws(() => windowsInventory(workflow.replace(from, to)), /SETUP_CHANGED/);
  }
});

test('aggregate succeeds only for every expected shard success', () => {
  const good = Object.fromEntries(SHARDS.map(id => [id, {result:'success'}]));
  assert.equal(aggregateSucceeded(good), true);
  for (const id of SHARDS) {
    for (const result of ['failure','cancelled','skipped','in_progress',null,undefined]) {
      assert.equal(aggregateSucceeded({...good, [id]:{result}}), false);
    }
    const missing = {...good}; delete missing[id];
    assert.equal(aggregateSucceeded(missing), false);
  }
  for (const needs of [null, [], {}, {...good, unexpected:{result:'success'}}, {...good, [SHARDS[0]]:null}]) {
    assert.equal(aggregateSucceeded(needs), false);
  }
});

test('workflow, inventory, canonical tree and extra source drift fail closed', () => {
  const cases = [
    [f => f.workflowSha256 = '0'.repeat(64), /WORKFLOW_SNAPSHOT_DRIFT/],
    [f => f.inventory.steps.pop(), /INVENTORY_SNAPSHOT_DRIFT/],
    [f => f.canonical.sha256 = '0'.repeat(64), /CANONICAL_SNAPSHOT_DRIFT/],
    [f => f.extraSources['scripts/ci/run.mjs'] = '0'.repeat(64), /EXTRA_SOURCE_SNAPSHOT_DRIFT/],
  ];
  for (const [mutate, error] of cases) {
    const f = clone(fixture); mutate(f);
    assert.throws(() => checkSnapshot(root, f), error);
  }
});

test('canonical digest includes nested helper edits, additions and deletions, deterministically', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'windows-inventory-test-'));
  t.after(() => rmSync(dir, {recursive:true, force:true}));
  mkdirSync(path.join(dir,'scripts/canonical/nested'),{recursive:true});
  const file = path.join(dir,'scripts/canonical/nested/helper.ps1');
  writeFileSync(file,'fixture only\n');
  const first = canonicalDigest(dir);
  assert.deepEqual(canonicalDigest(dir), first);
  writeFileSync(file,'changed fixture only\n');
  assert.notEqual(canonicalDigest(dir).sha256, first.sha256);
  const added = path.join(dir,'scripts/canonical/extra.test.mjs');
  writeFileSync(added,'fixture only');
  assert.equal(canonicalDigest(dir).fileCount,2);
  unlinkSync(file);
  assert.equal(canonicalDigest(dir).fileCount,1);
  assert.notEqual(canonicalDigest(dir).sha256,first.sha256);
});
