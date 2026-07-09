import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const checklist = read('docs/erp-v2/production-host-network-checklist.md');
const hardening = read('docs/erp-v2/production-readiness-remaining-hardening.md');
const sprintReport = read('docs/erp-v2/production-host-network-checklist-sprint-041-report.md');
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
  'checklist states pending human confirmation and no execution',
  includesAll(checklist, [
    'Status: Pending human host/network confirmation',
    'This document is a checklist only',
    'does not approve or execute deployment',
  ]),
);

addCheck(
  'checklist covers host and network decisions',
  includesAll(checklist, [
    'Production host type',
    'Host owner',
    'Deployment operator',
    'Database location',
    'Access pattern',
    'Web-admin',
    'API',
    'SQL Server',
  ]),
);

addCheck(
  'checklist covers HTTPS reverse proxy and access policy',
  includesAll(checklist, [
    'Reverse proxy choice',
    'HTTPS certificate source',
    'CORS origins',
    'Debug panel',
    'Local passwordless login',
    'WhatsApp sending',
  ]),
);

addCheck(
  'checklist defines safety defaults and stop conditions',
  includesAll(checklist, [
    'ERP should start LAN/VPN-first',
    'SQL Server should not be exposed to public internet',
    'Stop Conditions',
    'Backup/restore verification is still missing',
  ]),
);

addCheck(
  'checklist includes human sign-off and next env ownership step',
  includesAll(checklist, [
    'Production Host Network Checklist Sign-Off',
    'Plan P1 Production Env Ownership Checklist.',
  ]),
);

addCheck(
  'hardening queue points to production host network checklist',
  hardening.includes('Plan P1 Production Host Network Checklist.'),
);

addCheck(
  'sprint report records no production or secret actions',
  includesAll(sprintReport, [
    'No production deployment was executed',
    'No DNS, firewall, reverse proxy or HTTPS setting was changed',
    'No secret values were read, printed or changed',
  ]),
);

addCheck(
  'documentation index links host network checklist and sprint report',
  docsIndex.includes('[Production Host Network Checklist](production-host-network-checklist.md)') &&
    docsIndex.includes('[Production Host Network Checklist Sprint 041 Report](production-host-network-checklist-sprint-041-report.md)'),
);

addCheck(
  'current status points to the production acceptance session',
  currentStatus.includes('Run ERP Production Acceptance Session.'),
);

addCheck(
  'roadmap records Sprint 041 completion',
  roadmap.includes('Sprint 041 was completed on 2026-07-09') &&
    roadmap.includes('docs/erp-v2/production-host-network-checklist.md'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} production-host-network / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
