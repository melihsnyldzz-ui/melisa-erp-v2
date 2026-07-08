import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const files = {
  importService: readFileSync(resolve(repoRoot, 'apps/api/src/services/importService.js'), 'utf8'),
  importScreen: readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/import/ImportScreen.jsx'), 'utf8'),
  sprintReport: readFileSync(resolve(repoRoot, 'docs/erp-v2/import-cleanup-sprint-008-report.md'), 'utf8'),
};

const checks = [];

function addCheck(name, passed, detail = '') {
  checks.push({ name, passed, detail });
}

addCheck(
  'import apply requires preview token',
  files.importService.includes('function assertPreviewToken')
    && (files.importService.match(/\n\s{2}assertPreviewToken\(preview, filePayload\);/g) || []).length === 3,
);

addCheck(
  'preview response returns token and apply requirement flag',
  files.importService.includes('previewRequiredForApply: true')
    && files.importService.includes('previewToken: makePreviewToken'),
);

addCheck(
  'apply reports before and after counts',
  (files.importService.match(/beforeCount/g) || []).length >= 6
    && (files.importService.match(/afterCount/g) || []).length >= 6,
);

addCheck(
  'suspicious row warnings are present',
  files.importService.includes('salePrice is zero')
    && files.importService.includes('phone looks temporary')
    && files.importService.includes('opening balance will be imported'),
);

addCheck(
  'web-admin sends preview token on commit',
  files.importScreen.includes("const [previewToken, setPreviewToken] = useState('')")
    && files.importScreen.includes('{ validOnly: commitValidOnly, previewToken }')
    && files.importScreen.includes('&& previewToken'),
);

addCheck(
  'sprint report documents no risky writes',
  files.sprintReport.includes('No SQL write, migration, backup, restore, reset, cleanup apply')
    && files.sprintReport.includes('Cleanup endpoints were reviewed but not executed'),
);

for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} - ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
}

const passed = checks.filter((check) => check.passed).length;
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);

if (passed !== checks.length) {
  process.exitCode = 1;
}
