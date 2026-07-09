import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

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
  'runbook defines preflight and final smoke command',
  includesAll(runbook, [
    'Before Starting',
    'npm.cmd --prefix apps\\web-admin run smoke:final-erp',
    'Review warnings and skips',
  ]),
);

addCheck(
  'runbook separates safe read-only checks',
  includesAll(runbook, [
    'Safe Read-Only Checks',
    'Login and session',
    'Stock and product',
    'Customer and supplier',
    'Terminal and operational health',
    'Settings and definitions',
  ]),
);

addCheck(
  'runbook lists approval-gated writes',
  includesAll(runbook, [
    'Approval-Gated Write Checks',
    'Create a purchase draft',
    'Finalize the purchase',
    'Create a sales draft',
    'Finalize the sale',
    'Terminal sale send',
  ]),
);

addCheck(
  'runbook blocks high-risk operations',
  includesAll(runbook, [
    'Never Run During Routine Final Testing',
    'Backup restore or reset',
    'Destructive SQL',
    'Production deploy',
    'WhatsApp or external message sending',
  ]),
);

addCheck(
  'runbook defines stop conditions and evidence',
  includesAll(runbook, [
    'Stop Conditions',
    'Final smoke has any failed check',
    'Evidence To Record',
    'Branch and commit hash',
    'Decision: pass, pass with warnings, or fail',
  ]),
);

addCheck(
  'runbook defines done criteria',
  includesAll(runbook, [
    'Final Testing Done Criteria',
    'Static final smoke passes with 0 failed checks',
    'Open P0/P1 blockers',
  ]),
);

addCheck(
  'documentation index links final testing runbook',
  docsIndex.includes('[Final Testing Runbook](final-testing-runbook.md)'),
);

addCheck(
  'current status points to the next practical readiness sprint',
  currentStatus.includes('Plan P1 P0/P1 Findings Fix Pass.'),
);

addCheck(
  'roadmap records Sprint 027 completion',
  roadmap.includes('Sprint 027 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/final-testing-runbook.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} final-testing-runbook / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
