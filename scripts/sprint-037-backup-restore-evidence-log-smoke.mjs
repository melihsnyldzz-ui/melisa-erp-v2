import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const evidenceLog = read('docs/erp-v2/backup-restore-evidence-log.md');
const verificationPlan = read('docs/erp-v2/backup-restore-verification-plan.md');
const sprintReport = read('docs/erp-v2/backup-restore-evidence-log-sprint-037-report.md');
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
  'evidence log states pending verification and no execution',
  includesAll(evidenceLog, [
    'Status: Pending real verification',
    'This document is an evidence shell',
    'No approved backup/restore verification entries are recorded yet',
  ]),
);

addCheck(
  'evidence log keeps risky actions separately approval-gated',
  includesAll(evidenceLog, [
    'SQL backup creation',
    'RESTORE VERIFYONLY',
    'Staging/test restore',
    'Production restore',
    'Routine sprint approval is not enough',
  ]),
);

addCheck(
  'evidence log includes complete entry template',
  includesAll(evidenceLog, [
    'Entry ID: BRE-YYYYMMDD-001',
    'Backup file name:',
    'Backup file size:',
    'VERIFYONLY result:',
    'Restore target database:',
    'Staging API DB target confirmed: yes/no',
    'Decision: pending / pass / pass with warnings / fail',
  ]),
);

addCheck(
  'evidence log defines stop conditions and production rule',
  includesAll(evidenceLog, [
    'Stop Conditions',
    'A command would expose secrets',
    'Production readiness cannot pass',
    'Rollback owner recorded',
  ]),
);

addCheck(
  'verification plan points toward evidence log',
  verificationPlan.includes('Plan P1 Backup Restore Evidence Log.'),
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
  'documentation index links evidence log and sprint report',
  docsIndex.includes('[Backup Restore Evidence Log](backup-restore-evidence-log.md)') &&
    docsIndex.includes('[Backup Restore Evidence Log Sprint 037 Report](backup-restore-evidence-log-sprint-037-report.md)'),
);

addCheck(
  'current status points to approved backup restore verification run',
  currentStatus.includes('Await Explicit Backup Restore Execution Approval.'),
);

addCheck(
  'roadmap records Sprint 037 completion',
  roadmap.includes('Sprint 037 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/backup-restore-evidence-log.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} backup-restore-evidence-log / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
