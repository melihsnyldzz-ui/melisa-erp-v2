import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const preflight = read('docs/erp-v2/backup-restore-dry-run-preflight.md');
const evidenceLog = read('docs/erp-v2/backup-restore-evidence-log.md');
const sprintReport = read('docs/erp-v2/backup-restore-dry-run-preflight-sprint-038-report.md');
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
  'preflight declares dry-run only and no execution',
  includesAll(preflight, [
    'This is a dry-run preflight document',
    'does not approve or execute',
    'Status: Dry-run preflight ready',
  ]),
);

addCheck(
  'preflight names source and restore-test databases',
  includesAll(preflight, [
    '`MELISA_ERP_V2`',
    '`MELISA_ERP_V2_RESTORE_TEST`',
    'Vega databases',
    'Production API usage',
  ]),
);

addCheck(
  'preflight reviews command shapes without approval',
  includesAll(preflight, [
    'node scripts\\backup-reset-melisa-db.mjs --backup --execute --confirm=MELISA_ERP_V2_BACKUP_AL',
    'RESTORE VERIFYONLY FROM DISK',
    'Expected restore target',
  ]),
);

addCheck(
  'preflight requires human inputs before real run',
  includesAll(preflight, [
    'SQL Server host name',
    'Backup destination class',
    'Backup retention rule',
    'Rollback owner',
    'Staging API base URL',
  ]),
);

addCheck(
  'preflight defines stop conditions and exact approval wording',
  includesAll(preflight, [
    'Stop Conditions',
    'Backup destination is inside Git',
    'I approve the backup/restore verification run for MELISA_ERP_V2',
    'Not approved:',
  ]),
);

addCheck(
  'evidence log remains pending real verification',
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
  'documentation index links preflight and sprint report',
  docsIndex.includes('[Backup Restore Dry-Run Preflight](backup-restore-dry-run-preflight.md)') &&
    docsIndex.includes('[Backup Restore Dry-Run Preflight Sprint 038 Report](backup-restore-dry-run-preflight-sprint-038-report.md)'),
);

addCheck(
  'current status points to approved verification run',
  currentStatus.includes('Plan P1 Migration Rehearsal Checklist.'),
);

addCheck(
  'roadmap records Sprint 038 completion',
  roadmap.includes('Sprint 038 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/backup-restore-dry-run-preflight.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} backup-restore-preflight / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
