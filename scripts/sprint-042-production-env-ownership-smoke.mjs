import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const ownership = read('docs/erp-v2/production-env-ownership-checklist.md');
const envChecklist = read('docs/erp-v2/production-env-checklist.md');
const hostNetwork = read('docs/erp-v2/production-host-network-checklist.md');
const sprintReport = read('docs/erp-v2/production-env-ownership-checklist-sprint-042-report.md');
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
  'ownership checklist states no secret execution',
  includesAll(ownership, [
    'does not read, print, change, generate, rotate, validate or commit secret values',
    'Status: Pending human env ownership confirmation',
    'Production env names are documented',
  ]),
);

addCheck(
  'ownership checklist covers required env groups',
  includesAll(ownership, [
    'API runtime',
    'CORS and request policy',
    'SQL credentials',
    'JWT secrets',
    'WhatsApp integration',
    'Web-admin public config',
    'Terminal public config',
    'Desktop/Electron config',
  ]),
);

addCheck(
  'ownership checklist defines storage and secret rules',
  includesAll(ownership, [
    'Protected production host environment variables',
    'Approved secret manager',
    'Not allowed',
    'Git',
    'Chat messages',
    '`VITE_*` and `EXPO_PUBLIC_*` values are public-facing',
  ]),
);

addCheck(
  'ownership checklist includes sign-off and stop conditions',
  includesAll(ownership, [
    'Production Env Ownership Sign-Off',
    'Stop Conditions',
    'WHATSAPP_ENABLED=true',
    'VITE_LOCAL_PASSWORDLESS_LOGIN',
    'SQL_DATABASE',
  ]),
);

addCheck(
  'ownership checklist points to migration rehearsal next',
  ownership.includes('Plan P1 Migration Rehearsal Checklist.'),
);

addCheck(
  'existing env checklist warns not to expose values',
  includesAll(envChecklist, [
    'Do not paste actual values',
    'Never commit `.env.local`',
    '`VITE_*` and `EXPO_PUBLIC_*` values are bundled',
  ]),
);

addCheck(
  'host network checklist points to env ownership',
  hostNetwork.includes('Plan P1 Production Env Ownership Checklist.'),
);

addCheck(
  'sprint report records no secret or production actions',
  includesAll(sprintReport, [
    'No secret values were read, printed, generated, changed or committed',
    'No production environment variables were created or modified',
    'No production deployment was executed',
  ]),
);

addCheck(
  'documentation index links env ownership checklist and sprint report',
  docsIndex.includes('[Production Env Ownership Checklist](production-env-ownership-checklist.md)') &&
    docsIndex.includes('[Production Env Ownership Checklist Sprint 042 Report](production-env-ownership-checklist-sprint-042-report.md)'),
);

addCheck(
  'current status points to migration rehearsal checklist',
  currentStatus.includes('Plan P1 Migration Rehearsal Checklist.'),
);

addCheck(
  'roadmap records Sprint 042 completion',
  roadmap.includes('Sprint 042 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/production-env-ownership-checklist.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} production-env-ownership / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
