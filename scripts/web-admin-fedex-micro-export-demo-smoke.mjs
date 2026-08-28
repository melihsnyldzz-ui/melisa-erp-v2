import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = {
  screen: readFileSync(resolve(root, 'apps/web-admin/src/modules/sales/FedexMicroExportDemoScreen.jsx'), 'utf8'),
  fixture: readFileSync(resolve(root, 'apps/web-admin/src/modules/sales/fedexMicroExportDemoData.js'), 'utf8'),
  integrationApi: readFileSync(resolve(root, 'apps/web-admin/src/services/shippingIntegrationApi.js'), 'utf8'),
  backendService: readFileSync(resolve(root, 'apps/api/src/services/nakliyatShippingService.js'), 'utf8'),
  registry: readFileSync(resolve(root, 'apps/web-admin/src/data/mockNavigationData.js'), 'utf8'),
  workspace: readFileSync(resolve(root, 'apps/web-admin/src/components/workspace/Workspace.jsx'), 'utf8'),
};

const checks = [
  ['external actions are protected by independent gates', ['draftCreate', 'productionRates', 'customerQuoteCreate', 'finalize'].every((value) => files.screen.includes(value))],
  ['browser talks only to ERP API', files.integrationApi.includes('/api/shipping/fedex/') && !/fedex\.com|127\.0\.0\.1:44555/i.test(files.integrationApi)],
  ['backend filters unsafe rates', ['PRODUCTION', 'ACCOUNT', 'isStale === false'].every((value) => files.backendService.includes(value))],
  ['regional economy is shown as economic road', ['FEDEX_REGIONAL_ECONOMY', 'FEDEX_REGIONAL_ECONOMY_FREIGHT', 'Ekonomik Karayolu'].every((value) => files.screen.includes(value))],
  ['AHM10350 fixture is present', files.fixture.includes("documentNo: 'AHM10350'") && files.fixture.includes('3773.30')],
  ['Ireland recipient is present', files.fixture.includes("country: 'Ireland'") && files.fixture.includes("postalCode: 'A82 F704'")],
  ['all 20 invoice rows are represented', (files.fixture.match(/^\s*\['/gm) || []).length === 20],
  ['required customs gates are visible', ['GTİP', 'e-arşiv', 'FedEx hesabı'].every((value) => files.screen.includes(value))],
  ['cotton default and synthetic keyword rule are explicit', files.fixture.includes("'VELSOFT'") && files.fixture.includes("material: 'Pamuk içerik'") && files.fixture.includes("material: 'Sentetik içerik'")],
  ['screen is registered', files.registry.includes("'fedex-micro-export-demo'")],
  ['workspace route is connected', files.workspace.includes("'fedex-micro-export-demo':") && files.workspace.includes('<FedexMicroExportDemoScreen />')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - FedEx demo / ${name}`);
  if (!ok) failed += 1;
}
console.log(`SUMMARY: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exit(1);
