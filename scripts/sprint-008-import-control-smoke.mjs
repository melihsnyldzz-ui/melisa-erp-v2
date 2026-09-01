import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const files = {
  importService: readFileSync(resolve(repoRoot, 'apps/api/src/services/importService.js'), 'utf8'),
  importScreen: readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/import/ImportScreen.jsx'), 'utf8'),
  importApi: readFileSync(resolve(repoRoot, 'apps/web-admin/src/services/importApi.js'), 'utf8'),
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
  'web-admin import language is clear Turkish',
  files.importScreen.includes('Önizleme, doğrulama, mükerrer kontrolü ve denetim kaydı destekli aktarım')
    && files.importScreen.includes('Tüm Satırları Aktar')
    && files.importScreen.includes('Doğrulama Sonuçları')
    && files.importScreen.includes('Aktarım için önce önizleme zorunludur')
    && files.importApi.includes('Aktarım dosyası seçilmedi.')
    && ![
      'Dosya se?ilmedi',
      'Gecerli Excel',
      'Commit plani',
      'Stok kartini ac',
      'Tamamını Commit Et',
      'Apply icin preview token zorunlu',
    ].some((text) => files.importScreen.includes(text)),
);

addCheck(
  'web-admin import technical contract remains intact',
  [
    '/api/import/products/preview',
    '/api/import/products/commit',
    '/api/import/customers/preview',
    '/api/import/customers/commit',
    '/api/import/suppliers/preview',
    '/api/import/suppliers/commit',
  ].every((path) => files.importApi.includes(path))
    && ['import_products', 'import_customers', 'import_suppliers'].every((code) => files.importScreen.includes(code))
    && files.importScreen.includes("status === 'duplicate'")
    && files.importApi.includes("error.code = 'IMPORT_FILE_REQUIRED'"),
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
