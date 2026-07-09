import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const findingsLog = read('docs/erp-v2/final-testing-findings-log.md');
const runbook = read('docs/erp-v2/final-testing-runbook.md');
const docsIndex = read('docs/erp-v2/README.md');
const currentStatus = read('docs/erp-v2/current-status.md');
const roadmap = read('docs/erp-v2/master-roadmap-v3.md');

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

addCheck(
  'findings log states no fake findings before human testing',
  findingsLog.includes('No human final-testing findings have been recorded yet') &&
    findingsLog.includes('not a general wishlist'),
);

addCheck(
  'findings log defines P0-P3 priority rules',
  includesAll(findingsLog, [
    'P0: blocks final testing',
    'P1: should be fixed before final acceptance',
    'P2: can wait until after final acceptance',
    'P3: future improvement',
  ]),
);

addCheck(
  'findings log defines required evidence format',
  includesAll(findingsLog, [
    'ID: `FT-YYYYMMDD-###`',
    'Steps to reproduce',
    'Expected result',
    'Actual result',
    'Business impact',
    'Retest result',
  ]),
);

addCheck(
  'findings log keeps risky actions approval-gated',
  includesAll(findingsLog, [
    'Do not execute DB writes',
    'migrations',
    'backup/restore/reset',
    'WhatsApp sending',
    'production deploys',
  ]),
);

addCheck(
  'runbook links finding IDs and fix pass',
  runbook.includes('Finding IDs from `docs/erp-v2/final-testing-findings-log.md`') &&
    runbook.includes('Finding Fix Pass') &&
    runbook.includes('Fix P0 findings before P1 findings'),
);

addCheck(
  'documentation index links findings log',
  docsIndex.includes('[Final Testing Findings Log](final-testing-findings-log.md)'),
);

addCheck(
  'current status points to guided final test execution',
  currentStatus.includes('Plan P1 Approved ERP Core Write Test.'),
);

addCheck(
  'roadmap records Sprint 028 completion',
  roadmap.includes('Sprint 028 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/final-testing-findings-log.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} final-testing-findings / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
