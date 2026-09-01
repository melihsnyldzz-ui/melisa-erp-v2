import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const dashboardServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/dashboardService.js'), 'utf8');
const dashboardRoutesSource = readFileSync(resolve(repoRoot, 'apps/api/src/routes/dashboardRoutes.js'), 'utf8');
const dashboardControllerSource = readFileSync(resolve(repoRoot, 'apps/api/src/controllers/dashboardController.js'), 'utf8');
const managementScreenSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/reports/ManagementReportsScreen.jsx'), 'utf8');
const packageSource = readFileSync(resolve(repoRoot, 'apps/web-admin/package.json'), 'utf8');

const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  if (start < 0) return '';
  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) return '';

  let depth = 0;
  for (let cursor = bodyStart; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const body = source.slice(bodyStart + 1, cursor);
        return body.includes('return {') ? body : source.slice(start);
      }
    }
  }

  return source.slice(start);
}

const managementBody = functionBody(dashboardServiceSource, 'getManagementReportingData');
const periodicBody = functionBody(dashboardServiceSource, 'getPeriodicAccountingData');
const forbiddenWriteTokens = [
  'INSERT ',
  'UPDATE ',
  'DELETE ',
  'DROP ',
  'TRUNCATE ',
  'MERGE ',
  'EXEC ',
  '.execute(',
  '.batch(',
];

addCheck(
  'management endpoint is mounted behind auth and dashboard.view',
  dashboardRoutesSource.includes("dashboardRoutes.get('/dashboard/management-reporting'") &&
    dashboardRoutesSource.includes("requirePermission('dashboard.view')"),
);
addCheck(
  'periodic accounting endpoint is mounted behind auth and dashboard.view',
  dashboardRoutesSource.includes("dashboardRoutes.get('/dashboard/periodic-accounting'") &&
    dashboardRoutesSource.includes("requirePermission('dashboard.view')"),
);
addCheck(
  'controller metadata marks reporting endpoints read-only',
  dashboardControllerSource.includes("source: 'sql-select-management-reporting'") &&
    dashboardControllerSource.includes("source: 'sql-select-periodic-accounting'") &&
    dashboardControllerSource.match(/readOnly:\s*true/g)?.length >= 2,
);
addCheck(
  'management report service exposes assumptions and data quality',
  managementBody.includes('assumptions:') &&
    managementBody.includes('dataQuality:') &&
    managementBody.includes('resmî muhasebe çıktısı değildir') &&
    managementBody.includes('rowLimits'),
);
addCheck(
  'periodic report service exposes assumptions and data quality',
  periodicBody.includes('assumptions:') &&
    periodicBody.includes('dataQuality:') &&
    periodicBody.includes('resmî muhasebe defteri değildir') &&
    periodicBody.includes('rowLimits'),
);
addCheck(
  'management report service stays SELECT-only',
  !forbiddenWriteTokens.some((token) => managementBody.toUpperCase().includes(token)),
);
addCheck(
  'periodic report service stays SELECT-only',
  !forbiddenWriteTokens.some((token) => periodicBody.toUpperCase().includes(token)),
);
addCheck(
  'management UI shows report assumption panels',
  managementScreenSource.includes('Rapor Varsayımları') &&
    managementScreenSource.includes('Veri Kalitesi Kontrolleri') &&
    managementScreenSource.includes('Onay Sınırları') &&
    managementScreenSource.includes('Dönem Varsayımları'),
);
addCheck(
  'management export includes assumptions and review boundaries',
  managementScreenSource.includes('reportAssumptionRows') &&
    managementScreenSource.includes('...reportAssumptionRows') &&
    managementScreenSource.includes('Yönetim varsayımı') &&
    managementScreenSource.includes('Dönem veri kalitesi'),
);
addCheck(
  'management UI labels report as non-official accounting',
  managementScreenSource.includes('Resmî muhasebe raporu değildir'),
);
addCheck(
  'web-admin package exposes Sprint 014 smoke',
  packageSource.includes('"smoke:reporting"'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Sprint 014 / ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exitCode = 1;
}
