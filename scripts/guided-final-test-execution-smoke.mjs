import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const executionLog = read('docs/erp-v2/guided-final-test-execution-log.md');
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
  'execution log separates automated evidence from human acceptance',
  includesAll(executionLog, [
    'separates automated/static evidence from human operator evidence',
    'does not replace Melih/operator screen-by-screen acceptance',
    'Human Operator Evidence',
  ]),
);

addCheck(
  'execution log records automated pass scope',
  includesAll(executionLog, [
    'Execution 001: AI-Assisted Automated Readiness Pass',
    'Final testing runbook preflight',
    'Static final ERP smoke pack',
    'Web-admin production build',
  ]),
);

addCheck(
  'execution log records warning and skipped write smoke',
  includesAll(executionLog, [
    'Controlled write smoke remained skipped',
    'FINAL_ERP_WRITE_SMOKE_APPROVED',
    'Live API read-only smoke returned route not found',
    'Pass with warning/skip review',
  ]),
);

addCheck(
  'execution log does not invent human findings',
  includesAll(executionLog, [
    'No human operator findings recorded',
    'No automated P0/P1 finding was created',
  ]) &&
    findingsLog.includes('No human final-testing findings have been recorded yet'),
);

addCheck(
  'docs index links guided final test execution log',
  docsIndex.includes('[Guided Final Test Execution Log](guided-final-test-execution-log.md)'),
);

addCheck(
  'runbook remains the human walkthrough source',
  runbook.includes('Recommended Human Test Order') &&
    runbook.includes('Evidence To Record'),
);

addCheck(
  'current status points to approved backup restore verification run',
  currentStatus.includes('Await Explicit Backup Restore Execution Approval.'),
);

addCheck(
  'roadmap records Sprint 029 completion',
  roadmap.includes('Sprint 029 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/guided-final-test-execution-log.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} guided-final-test / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
