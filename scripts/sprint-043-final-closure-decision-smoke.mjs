import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const closure = read('docs/erp-v2/final-closure-decision.md');
const sprintReport = read('docs/erp-v2/final-closure-decision-sprint-043-report.md');
const currentStatus = read('docs/erp-v2/current-status.md');
const docsIndex = read('docs/erp-v2/README.md');
const roadmap = read('docs/erp-v2/master-roadmap-v3.md');

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

addCheck(
  'closure document states ERP Core final-testing decision',
  includesAll(closure, [
    'Melisa ERP v2 application development is accepted as functionally complete for ERP Core final use testing.',
    'The remaining work is not a reason to keep adding ERP feature sprints.',
    'ERP Core is done enough for final operator testing and internal use decisions.',
  ]),
);

addCheck(
  'closure document keeps true production blockers explicit',
  includesAll(closure, [
    'Backup/restore verification has not been executed',
    'Migration path has not been rehearsed',
    'SQL production access and certificate/trust policy are not signed off',
    'Production users and permissions are not signed off',
    'Production host/network/HTTPS decision is not confirmed',
    'Required production environment variables have names and owners',
  ]),
);

addCheck(
  'closure document marks non-blocking follow-up items',
  includesAll(closure, [
    'Monitoring and log retention checklist',
    'Terminal physical device acceptance notes',
    'Import operator safety notes',
    'Short operator training guide',
    'Future CRM implementation',
    'Future AI automation',
  ]),
);

addCheck(
  'closure document uses production acceptance session as next action',
  closure.includes('Run ERP Production Acceptance Session.'),
);

addCheck(
  'sprint report records no production or secret actions',
  includesAll(sprintReport, [
    'No SQL write, migration, backup, restore, reset or cleanup execution',
    'No production deployment',
    'No secret reading, printing, changing, generation, rotation or committing',
  ]),
);

addCheck(
  'current status records Sprint 043 and closure decision',
  includesAll(currentStatus, [
    'Sprint 043 final closure decision documented',
    'ERP Core is treated as functionally complete for final operator testing and internal use decisions',
    'Run ERP Production Acceptance Session.',
  ]),
);

addCheck(
  'documentation index links final closure docs',
  docsIndex.includes('[Final Closure Decision](final-closure-decision.md)') &&
    docsIndex.includes('[Final Closure Decision Sprint 043 Report](final-closure-decision-sprint-043-report.md)'),
);

addCheck(
  'roadmap records Sprint 043 closure',
  includesAll(roadmap, [
    'Sprint 043 was completed on 2026-07-09',
    'docs/erp-v2/final-closure-decision.md',
    'Run ERP Production Acceptance Session.',
  ]),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} final-closure-decision / ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
