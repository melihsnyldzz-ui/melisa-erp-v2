import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const readinessSource = readFileSync(resolve(repoRoot, 'docs/erp-v2/ai-automation-readiness.md'), 'utf8');
const reportSource = readFileSync(resolve(repoRoot, 'docs/erp-v2/ai-automation-readiness-sprint-015-report.md'), 'utf8');
const localRulesSource = readFileSync(resolve(repoRoot, 'docs/ai/local-agent-rules.md'), 'utf8');
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
  'readiness document defines safe read-only AI use cases',
  includesAll(readinessSource, [
    'Allowed Read-Only AI Use Cases',
    'Summarize management reports',
    'Draft customer or supplier follow-up notes without sending them',
    'Help compare ERP behavior against documented rules',
  ]),
);

addCheck(
  'readiness document prohibits risky autonomous actions',
  includesAll(readinessSource, [
    'Prohibited AI Actions Without Explicit Approval',
    'Create, update, delete, import, cleanup, reset, restore, or migrate ERP data',
    'Send WhatsApp, SMS, email, catalog messages, or any external communication',
    'Use or expose secrets, tokens, passwords, SQL credentials, or `.env.local` values',
  ]),
);

addCheck(
  'readiness document requires human approval and audit traceability',
  includesAll(readinessSource, [
    'Human Approval Requirements',
    'A named human owner',
    'Visible before/after summary',
    'Audit trail with authenticated actor',
    'Approval cannot be inferred',
  ]),
);

addCheck(
  'readiness document keeps humans responsible for business decisions',
  includesAll(readinessSource, [
    'humans remain responsible for business decisions',
    'AI-generated recommendations must not appear as final business decisions',
    'required human verification',
  ]),
);

addCheck(
  'readiness document protects public product and WhatsApp boundaries',
  includesAll(readinessSource, [
    'Public And External Communication Boundary',
    'Customer-facing content must obey the Melisa OS public product data contract',
    'Prices, exact stock, delivery promises',
    'must not send or publish',
  ]),
);

addCheck(
  'readiness document lists future automation candidates without implementation',
  includesAll(readinessSource, [
    'Future Automation Candidates',
    'Read-only AI report summarizer',
    'Terminal failed-sync triage assistant',
    'CRM follow-up draft assistant without automatic outreach',
  ]),
);

addCheck(
  'local AI rules include ERP AI and automation boundaries',
  includesAll(localRulesSource, [
    '## AI And Automation',
    'AI-assisted ERP work is read-only by default',
    'AI must not create, update, delete, import, cleanup, reset, restore, migrate, publish, deploy, or send messages',
    'AI analysis must separate known ERP data, inference, missing data, and human verification',
  ]),
);

addCheck(
  'current status marks Sprint 015 complete and has progressed beyond Sprint 016',
  includesAll(currentStatusSource, [
    'Sprint 015 AI and automation readiness documented',
    'Sprint 016 full ERP core smoke path documented',
    'Sprint 021 whole ERP screen completion audit documented',
    'Plan P1 Guided Final Test Execution.',
  ]),
);

addCheck(
  'roadmap marks Sprint 015 completed',
  includesAll(roadmapSource, [
    '### Sprint 015: AI And Automation Readiness',
    'Status:** Completed on 2026-07-08',
    'docs/erp-v2/ai-automation-readiness-sprint-015-report.md',
  ]),
);

addCheck(
  'Sprint 015 report documents no risky actions',
  includesAll(reportSource, [
    'Status: Completed',
    'No DB writes',
    'No WhatsApp, SMS, email, or external message sending',
    'No risky action required approval',
  ]),
);

addCheck(
  'web-admin package exposes Sprint 015 smoke',
  packageSource.includes('"smoke:ai-readiness"'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Sprint 015 / ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exitCode = 1;
}
