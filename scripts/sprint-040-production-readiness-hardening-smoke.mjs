import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const hardening = read('docs/erp-v2/production-readiness-remaining-hardening.md');
const runPacket = read('docs/erp-v2/approved-backup-restore-verification-run.md');
const sprintReport = read('docs/erp-v2/production-readiness-remaining-hardening-sprint-040-report.md');
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
  'hardening document states non-destructive scope',
  includesAll(hardening, [
    'does not approve or execute',
    'Status: Non-destructive hardening can continue',
    'Backup/restore verification remains blocked',
  ]),
);

addCheck(
  'hardening document lists P0/P1 production readiness areas',
  includesAll(hardening, [
    'Backup/restore verification',
    'Production host/network/HTTPS',
    'Production env/secrets',
    'Migration path',
    'SQL least privilege/certificate policy',
    'Admin/user onboarding',
    'Monitoring/log retention',
  ]),
);

addCheck(
  'hardening document defines safe queue and prohibitions',
  includesAll(hardening, [
    'PRH-001 - Production Host And Network Checklist',
    'PRH-004 - SQL Least-Privilege Review Checklist',
    'PRH-008 - Import Operator Safety Checklist',
    'Do not:',
    'Touch production DB',
  ]),
);

addCheck(
  'hardening document recommends next safe sprint',
  hardening.includes('Plan P1 Production Host Network Checklist.'),
);

addCheck(
  'backup restore packet still waits for exact execution approval',
  runPacket.includes('Status: Waiting for exact execution approval') &&
    runPacket.includes('If any part of the approval is missing or ambiguous, do not execute'),
);

addCheck(
  'sprint report records no risky execution',
  includesAll(sprintReport, [
    'No SQL backup was created',
    'No `RESTORE VERIFYONLY` was executed',
    'No database restore was executed',
    'No production deploy was executed',
    'No secret values were read, printed or changed',
  ]),
);

addCheck(
  'documentation index links hardening document and sprint report',
  docsIndex.includes('[Production Readiness Remaining Hardening](production-readiness-remaining-hardening.md)') &&
    docsIndex.includes('[Production Readiness Remaining Hardening Sprint 040 Report](production-readiness-remaining-hardening-sprint-040-report.md)'),
);

addCheck(
  'current status points to host network checklist',
  currentStatus.includes('Plan P1 Production Host Network Checklist.'),
);

addCheck(
  'roadmap records Sprint 040 completion',
  roadmap.includes('Sprint 040 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/production-readiness-remaining-hardening.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} production-hardening / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
