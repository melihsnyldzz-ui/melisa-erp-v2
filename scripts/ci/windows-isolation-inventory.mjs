import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHARDS = Object.freeze(['windows-startup-core', 'windows-b6-profile', 'windows-business-5244']);
const B6 = 'B6 finite native profile and rollback with isolated source fixtures';
const BUSINESS = 'Business 5244 cooperative exclusion and owned native lifetime';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Deliberately handles only the audited, simple job format. YAML changes require
// a fresh audit, rather than silently dropping new steps or interpreting YAML.
export function windowsInventory(workflow) {
  const match = workflow.match(/^  windows-startup-test:\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/m);
  if (!match) throw Error('WINDOWS_JOB_MISSING');
  const [setup, ...rows] = match[1].split('      - name: ');
  if (!setup.includes('    name: windows-startup-test\n') ||
      !setup.includes('    runs-on: windows-latest\n') ||
      !setup.includes('    timeout-minutes: 20\n') ||
      !setup.includes('persist-credentials: false') ||
      !setup.includes("node-version: '24'")) throw Error('WINDOWS_SETUP_CHANGED');
  const steps = rows.map(row => {
    const entry = row.match(/^([^\n]+)\n        run: ([^\n]+)\n$/);
    if (!entry) throw Error('UNSUPPORTED_WINDOWS_STEP');
    return { name: entry[1], run: entry[2] };
  });
  if (steps.filter(s => s.name === B6).length !== 1 || steps.filter(s => s.name === BUSINESS).length !== 1 ||
      new Set(steps.map(s => s.name)).size !== steps.length) throw Error('WINDOWS_GROUP_MISSING_OR_DUPLICATE');
  return { setup, steps };
}

export function proposedPartitions(inventory) {
  return Object.fromEntries(SHARDS.map(id => [id, inventory.steps.filter(step =>
    id === SHARDS[1] ? step.name === B6 : id === SHARDS[2] ? step.name === BUSINESS : ![B6, BUSINESS].includes(step.name))]));
}

export function validatePartitions(inventory, partitions) {
  if (Object.keys(partitions).sort().join() !== [...SHARDS].sort().join()) throw Error('PARTITION_NAMES_CHANGED');
  const expected = proposedPartitions(inventory);
  for (const id of SHARDS) {
    if (JSON.stringify(partitions[id]) !== JSON.stringify(expected[id])) throw Error('COMMAND_COVERAGE_OR_ORDER_CHANGED');
  }
  return true;
}

// Model of the REQUIRED future aggregate: skipped/cancelled/missing cannot pass.
// This is not a workflow implementation or proof of a deployed aggregate.
export function aggregateSucceeded(needs) {
  return needs !== null && typeof needs === 'object' && !Array.isArray(needs) &&
    Object.keys(needs).sort().join() === [...SHARDS].sort().join() &&
    SHARDS.every(id => needs[id]?.result === 'success');
}

// Conservative pin of the entire canonical subtree, not an inferred dependency
// closure. A changed/new/deleted helper or fixture invalidates this snapshot.
export function canonicalDigest(root) {
  const files = [];
  function visit(relative) {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(name);
      else if (entry.isFile()) files.push(name);
      else throw Error('UNSUPPORTED_SOURCE_ENTRY');
    }
  }
  visit('scripts/canonical');
  const records = files.sort().map(name => [name, sha256(readFileSync(path.join(root, name)))]);
  return { fileCount: records.length, sha256: sha256(JSON.stringify(records)) };
}

export function checkSnapshot(root, fixture) {
  const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  if (sha256(workflow) !== fixture.workflowSha256) throw Error('WORKFLOW_SNAPSHOT_DRIFT');
  const inventory = windowsInventory(workflow);
  if (JSON.stringify(inventory) !== JSON.stringify(fixture.inventory)) throw Error('INVENTORY_SNAPSHOT_DRIFT');
  if (JSON.stringify(canonicalDigest(root)) !== JSON.stringify(fixture.canonical)) throw Error('CANONICAL_SNAPSHOT_DRIFT');
  for (const [name, expected] of Object.entries(fixture.extraSources)) {
    if (sha256(readFileSync(path.join(root, name))) !== expected) throw Error('EXTRA_SOURCE_SNAPSHOT_DRIFT');
  }
  validatePartitions(inventory, fixture.partitions);
  return {
    sourceSnapshot: fixture.sourceSnapshot,
    status: 'SNAPSHOT_MATCH_ONLY',
    workflowApplied: false,
    windowsExecutionVerified: false,
    ownershipCleared: false,
    steps: Object.fromEntries(SHARDS.map(id => [id, fixture.partitions[id].length])),
    canonicalFilesPinned: fixture.canonical.fileCount,
    remaining: ['active owner handoff', 'fresh source audit after owner changes', 'clean Windows shard execution and result comparison'],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/windows-isolation/snapshot.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(checkSnapshot(root, fixture), null, 2));
}
