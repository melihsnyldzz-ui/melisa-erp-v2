import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const checklistSource = readFileSync(resolve(repoRoot, 'docs/erp-v2/erp-core-smoke-path-sprint-016.md'), 'utf8');
const reportSource = readFileSync(resolve(repoRoot, 'docs/erp-v2/erp-core-smoke-path-sprint-016-report.md'), 'utf8');
const currentStatusSource = readFileSync(resolve(repoRoot, 'docs/erp-v2/current-status.md'), 'utf8');
const roadmapSource = readFileSync(resolve(repoRoot, 'docs/erp-v2/master-roadmap-v3.md'), 'utf8');
const packageSource = readFileSync(resolve(repoRoot, 'apps/web-admin/package.json'), 'utf8');

const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

addCheck(
  'checklist defines the connected ERP Core path',
  includesAll(checklistSource, [
    'login -> stock -> purchase -> sales -> finance -> reports',
    'The default Sprint 016 path is read-first',
    'Read-Only Checks',
    'Approval-Gated Write Checks',
  ]),
);

addCheck(
  'checklist separates safe read-only checks from approval-gated writes',
  includesAll(checklistSource, [
    'No approval is required for static source checks',
    'Explicit Melih approval is required',
    'Create purchase draft, finalize it',
    'Create sales draft, finalize it',
    'Create collection/payment',
  ]),
);

addCheck(
  'checklist protects commercial truth rules',
  includesAll(checklistSource, [
    'Draft sales and purchase documents must not affect stock or cari movements',
    'Finalized sales reduce stock',
    'Finalized purchases increase stock',
    'Cancellations must reverse stock and ledger impact',
    'Finance is operational finance, not official accounting',
  ]),
);

addCheck(
  'report marks Sprint 016 completed without risky execution',
  includesAll(reportSource, [
    'Status: Completed',
    'No DB writes',
    'No SQL migrations',
    'No WhatsApp, SMS, email, catalog publishing, or external message sending',
    'No risky action required approval',
  ]),
);

addCheck(
  'current status preserves Sprint 016 completion and later ERP Core validation context',
  includesAll(currentStatusSource, [
    'Sprint 016 full ERP core smoke path documented',
    'Sprint 017 ERP core read-only smoke execution documented',
    'Sprint 018 controlled ERP core write smoke approval plan documented',
    'Sprint 019 controlled ERP core write smoke execution documented',
    'Sprint 021 whole ERP screen completion audit documented',
    'Plan P1 Production Host Network Checklist.',
  ]),
);

addCheck(
  'roadmap marks Sprint 016 completed',
  includesAll(roadmapSource, [
    '### Sprint 016: Full ERP Core Smoke Path',
    'Status:** Completed on 2026-07-08',
    'docs/erp-v2/erp-core-smoke-path-sprint-016-report.md',
  ]),
);

addCheck(
  'web-admin package exposes Sprint 016 smoke',
  packageSource.includes('"smoke:erp-core-path"'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Sprint 016 / ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exitCode = 1;
}
