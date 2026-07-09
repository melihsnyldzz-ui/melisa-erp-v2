import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const sources = {
  plan: readFile('docs/erp-v2/erp-core-write-smoke-approval-plan-sprint-018.md'),
  report: readFile('docs/erp-v2/erp-core-write-smoke-approval-plan-sprint-018-report.md'),
  currentStatus: readFile('docs/erp-v2/current-status.md'),
  roadmap: readFile('docs/erp-v2/master-roadmap-v3.md'),
  packageJson: readFile('apps/web-admin/package.json'),
};

const checks = [];

function readFile(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

addCheck(
  'approval plan defines controlled write-smoke scope without execution',
  includesAll(sources.plan, [
    'purchase -> sales -> finance',
    'This sprint does not execute the write smokes',
    'planning-only and static',
    'Not allowed without separate explicit Melih approval',
  ]),
);

addCheck(
  'approval plan requires exact run-specific approval details',
  includesAll(sources.plan, [
    'Target environment',
    'Run window',
    'QA records',
    'Allowed actions',
    'Evidence scope',
    'Reversal strategy',
    'Stop conditions',
    'A generic',
  ]),
);

addCheck(
  'approval plan defines target environment and QA record strategy',
  includesAll(sources.plan, [
    'Lab/test SQL database',
    'Local development database',
    'Production database only',
    'QA-S018-',
    'QA product',
    'QA supplier',
    'QA customer',
    'QA-safe cash/bank account',
  ]),
);

addCheck(
  'approval plan covers purchase, sales, and finance write smokes',
  includesAll(sources.plan, [
    'Purchase Smoke',
    'Sales Smoke',
    'Finance Smoke',
    'Verify the draft has no stock',
    'Verify stock increased',
    'Verify stock decreased',
    'finance account movement impact',
  ]),
);

addCheck(
  'approval plan protects evidence and secrets boundaries',
  includesAll(sources.plan, [
    'Evidence must prove behavior without exposing private business data',
    '.env.local',
    'SQL credentials, tokens, passwords, API keys',
    'Private customer/supplier names',
    'Full database rows or unrestricted exports',
  ]),
);

addCheck(
  'approval plan defines reversal expectations and stop gate',
  includesAll(sources.plan, [
    'normal ERP cancellation or reversing entry',
    'Direct SQL delete/update',
    'Do not attempt direct SQL repair',
    'Actual controlled write execution remains blocked',
  ]),
);

addCheck(
  'Sprint 018 report marks completion without risky execution',
  includesAll(sources.report, [
    'Status: Completed',
    'No DB writes',
    'No SQL migrations',
    'No WhatsApp, SMS, email, catalog publishing, or external message sending',
    'No risky action required approval',
  ]),
);

addCheck(
  'current status preserves Sprint 018 plan and records Sprint 019 execution',
  includesAll(sources.currentStatus, [
    'Sprint 018 controlled ERP core write smoke approval plan documented',
    'Sprint 019 controlled ERP core write smoke execution documented',
    'Sprint 020 audit browser and coverage documented',
    'Sprint 021 whole ERP screen completion audit documented',
    'Plan P1 Post-Test Findings Fix Pass.',
  ]),
);

addCheck(
  'roadmap marks Sprint 018 completed',
  includesAll(sources.roadmap, [
    '### Sprint 018: Controlled ERP Core Write Smoke Approval Plan',
    'Status:** Completed on 2026-07-08',
    'docs/erp-v2/erp-core-write-smoke-approval-plan-sprint-018-report.md',
  ]),
);

addCheck(
  'web-admin package exposes Sprint 018 smoke',
  sources.packageJson.includes('"smoke:erp-core-write-plan"'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Sprint 018 / ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exitCode = 1;
}
