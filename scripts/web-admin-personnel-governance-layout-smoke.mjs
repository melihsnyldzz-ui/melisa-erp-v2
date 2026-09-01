import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const hardeningStyles = read('apps/web-admin/src/styles/responsive-layout-hardening.css');
const personnelStyles = read('apps/web-admin/src/styles/personnel-definitions.css');
const modernStyles = read('apps/web-admin/src/styles/erp-modern.css');
const personnelScreen = read('apps/web-admin/src/modules/settings/PersonnelDefinitionsScreen.jsx');
const auditScreen = read('apps/web-admin/src/modules/settings/AuditLogScreen.jsx');
const auditApi = read('apps/web-admin/src/services/auditApi.js');
const main = read('apps/web-admin/src/main.jsx');

function mediaBlocks(source) {
  const blocks = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf('@media', cursor);
    if (start === -1) break;

    const open = source.indexOf('{', start);
    if (open === -1) break;

    let depth = 1;
    let end = open + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === '{') depth += 1;
      if (source[end] === '}') depth -= 1;
      end += 1;
    }

    if (depth === 0) {
      blocks.push({
        condition: source.slice(start + '@media'.length, open).trim(),
        body: source.slice(open + 1, end - 1),
      });
    }
    cursor = end;
  }

  return blocks;
}

function matchesWidth(condition, width) {
  const minimums = [...condition.matchAll(/\(min-width:\s*(\d+)px\)/g)].map((match) => Number(match[1]));
  const maximums = [...condition.matchAll(/\(max-width:\s*(\d+)px\)/g)].map((match) => Number(match[1]));
  return minimums.every((minimum) => width >= minimum)
    && maximums.every((maximum) => width <= maximum);
}

function ruleBody(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`))?.[1] || '';
}

function activeRule(selector, width) {
  return mediaBlocks(hardeningStyles)
    .filter(({ condition }) => matchesWidth(condition, width))
    .map(({ body }) => ruleBody(body, selector))
    .find(Boolean) || '';
}

const personnel1366 = activeRule('.personnel-definitions-screen .personnel-workspace', 1366);
const personnelList1366 = activeRule('.personnel-definitions-screen .personnel-card-list', 1366);
const auditFilters1366 = activeRule('.audit-log-screen .auth-admin-audit-filter-grid', 1366);

const checks = [
  ['responsive hardening stylesheet is loaded', main.includes("import './styles/responsive-layout-hardening.css';")],
  ['personnel screen exposes the targeted workspace and card list', personnelScreen.includes('personnel-definitions-screen') && personnelScreen.includes('personnel-workspace') && personnelScreen.includes('personnel-card-list')],
  ['personnel base layout still keeps its existing small-screen fallback', personnelStyles.includes('@media (max-width: 1180px)') && personnelStyles.includes('.personnel-workspace { grid-template-columns: 1fr; }')],
  ['1366 personnel workspace resolves to one safe column', personnel1366.includes('grid-template-columns: minmax(0, 1fr);')],
  ['1366 personnel list height keeps the edit form reachable below it', personnelList1366.includes('max-height: 370px;')],
  ['audit screen exposes the targeted filter and local table shell', auditScreen.includes('audit-log-screen') && auditScreen.includes('auth-admin-audit-filter-grid') && auditScreen.includes('table-shell auth-admin-audit-table-shell')],
  ['1366 audit filters resolve to two flexible columns', auditFilters1366.includes('repeat(2, minmax(0, 1fr))') && auditFilters1366.includes('!important')],
  ['audit wide table keeps its deliberate local minimum width', modernStyles.includes('.auth-admin-audit-table {') && modernStyles.includes('min-width: 900px !important;')],
  ['wide tables scroll only inside their own shell', hardeningStyles.includes('.table-shell,') && hardeningStyles.includes('overflow-x: auto;')],
  ['audit log panel keeps its natural height inside the dashboard flex column', ruleBody(hardeningStyles, '.audit-log-screen > .auth-admin-audit-panel').includes('flex: 0 0 auto;')],
  ['audit client remains GET-only', auditApi.includes("get('/api/audit/logs', params)") && auditApi.includes("get('/api/audit/coverage')") && !/\b(post|patch|put|del|deleteRequest)\s*\(/.test(auditApi)],
  ['personnel save and password actions remain explicit user actions', personnelScreen.includes('onClick={saveEmployee}') && personnelScreen.includes('onClick={changePassword}')],
  ['layout hardening does not hide personnel or audit actions', !hardeningStyles.includes('personnel-form-footer { display: none') && !hardeningStyles.includes('auth-admin-audit-actions { display: none')],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} - Personnel and audit layout / ${name}`);
}
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
