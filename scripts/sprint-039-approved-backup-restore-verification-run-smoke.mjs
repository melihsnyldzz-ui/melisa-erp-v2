import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const runPacket = read('docs/erp-v2/approved-backup-restore-verification-run.md');
const preflight = read('docs/erp-v2/backup-restore-dry-run-preflight.md');
const evidenceLog = read('docs/erp-v2/backup-restore-evidence-log.md');
const sprintReport = read('docs/erp-v2/approved-backup-restore-verification-run-sprint-039-report.md');
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
  'run packet waits for exact approval and does not execute',
  includesAll(runPacket, [
    'Status: Waiting for exact execution approval',
    'does not by itself approve or execute',
    'If any part of the approval is missing or ambiguous, do not execute',
  ]),
);

addCheck(
  'run packet includes exact approval wording',
  includesAll(runPacket, [
    'I approve the backup/restore verification run for MELISA_ERP_V2',
    'create SQL backup for MELISA_ERP_V2',
    'run RESTORE VERIFYONLY on the created backup',
    'restore only to MELISA_ERP_V2_RESTORE_TEST',
    'run read-only restore smoke against staging/test API',
  ]),
);

addCheck(
  'run packet excludes production and destructive actions',
  includesAll(runPacket, [
    'production restore',
    'reset',
    'cleanup',
    'migration',
    'production deploy',
    'WhatsApp/external sending',
  ]),
);

addCheck(
  'run packet defines target names and execution checklist',
  includesAll(runPacket, [
    'Source database',
    '`MELISA_ERP_V2`',
    'Restore-test database',
    '`MELISA_ERP_V2_RESTORE_TEST`',
    'Step 0 - Pre-Execution Confirmation',
    'Step 4 - Read-Only Restore Smoke',
  ]),
);

addCheck(
  'run packet defines stop conditions',
  includesAll(runPacket, [
    'Stop Conditions',
    'Exact approval is missing',
    'Restore would overwrite production',
    'Backup destination is inside Git',
    'RESTORE VERIFYONLY',
  ]),
);

addCheck(
  'preflight points to approved run',
  preflight.includes('Plan P1 Approved Backup Restore Verification Run.'),
);

addCheck(
  'evidence log remains pending before real run',
  includesAll(evidenceLog, [
    'Status: Pending real verification',
    'No approved backup/restore verification entries are recorded yet',
  ]),
);

addCheck(
  'sprint report records no risky execution',
  includesAll(sprintReport, [
    'No SQL backup was created',
    'No `RESTORE VERIFYONLY` was executed',
    'No database restore was executed',
    'No production deploy was executed',
  ]),
);

addCheck(
  'documentation index links approved run packet and sprint report',
  docsIndex.includes('[Approved Backup Restore Verification Run](approved-backup-restore-verification-run.md)') &&
    docsIndex.includes('[Approved Backup Restore Verification Run Sprint 039 Report](approved-backup-restore-verification-run-sprint-039-report.md)'),
);

addCheck(
  'current status points to the production acceptance session',
  currentStatus.includes('Run ERP Production Acceptance Session.'),
);

addCheck(
  'roadmap records Sprint 039 completion',
  roadmap.includes('Sprint 039 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/approved-backup-restore-verification-run.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} approved-backup-restore-run / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
