import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const files = {
  navigation: read('apps/web-admin/src/data/mockNavigationData.js'),
  sidebar: read('apps/web-admin/src/components/navigation/Sidebar.jsx'),
  workspace: read('apps/web-admin/src/components/workspace/Workspace.jsx'),
  salesList: read('apps/web-admin/src/modules/sales/VegaSalesInvoiceListScreen.jsx'),
  screen: read('apps/web-admin/src/modules/sales/ProformaInvoiceScreen.jsx'),
  print: read('apps/web-admin/src/utils/proformaPrint.js'),
  apiService: read('apps/api/src/services/vegaKoliLedgerService.js'),
  classifier: read('apps/api/src/services/productCustomsClassifier.js'),
};

const checks = [
  ['navigation entry', files.navigation.includes("screenId: 'proforma-invoice'")],
  ['sidebar label', files.sidebar.includes("'proforma-invoice': 'Proforma Hazirlama'")],
  ['workspace route', files.workspace.includes("'proforma-invoice': {") && files.workspace.includes('<ProformaInvoiceScreen')],
  ['sales list action', files.salesList.includes('Seçili Fişten Proforma')],
  ['read-only Vega source label', files.screen.includes('Vega salt okunur')],
  ['draft local storage', files.screen.includes('window.localStorage.setItem')],
  ['stale draft protection', files.screen.includes('sourceFingerprint') && files.screen.includes('savedDraftIsCurrent') && files.screen.includes('eski taslak kullanılmadı')],
  ['null-safe corporate defaults', files.screen.includes("value && typeof value === 'object' ? value : {}") && files.screen.includes('overrides.usdIban')],
  ['editable GTIP', files.screen.includes("updateLine(line.id, 'gtipCode'")],
  ['not tax invoice marker', files.print.includes('NOT A TAX INVOICE')],
  ['printable proforma', files.print.includes('PROFORMA INVOICE') && files.print.includes('printWindow.print()')],
  ['corporate logo', files.print.includes('melisa-baby-watermark.png') && files.print.includes('Melisa Baby')],
  ['three currency bank accounts', files.screen.includes('tryIban') && files.screen.includes('usdIban') && files.screen.includes('eurIban')],
  ['freight amount and payable total', files.screen.includes('freightAmount') && files.screen.includes('Mal + nakliye bedeli') && files.print.includes('Nakliye Bedeli') && files.print.includes('payableTotal')],
  ['save PDF action', files.screen.includes('PDF Kaydet') && files.screen.includes('PDF olarak kaydet') && files.print.includes('proformaPdfFileName')],
  ['swift and seller registry', files.print.includes('SWIFT:') && files.print.includes('Ticaret Sicil:')],
  ['official invoice identifiers excluded', !files.print.includes('ETTN:') && !files.print.includes('e-FATURA')],
  ['customs enrichment', files.apiService.includes('getVegaProductCustomsMap') && files.apiService.includes('gtipCode')],
  ['automatic customs fallback', files.apiService.includes('classifyProductCustomsDraft') && files.apiService.includes("source: 'local-customs'")],
  ['stored customs wins', files.apiService.includes('storedCustoms?.code') && files.apiService.includes('classifyProductCustomsDraft(line)')],
  ['automatic rule transparency', files.screen.includes('Otomatik taslak') && files.screen.includes('gtipMaterialBasis') && files.screen.includes('gtipNote')],
  ['customs material rules', files.classifier.includes('baby-knit-synthetic-explicit') && files.classifier.includes('baby-woven-linen-explicit') && files.classifier.includes('baby-knit-cotton-fallback')],
  ['automatic customs stays draft', files.classifier.includes("status: 'draft'") && files.classifier.includes('requiresReview: true')],
  ['Vega KOD4 reaches customs classifier', files.apiService.includes('s.KOD4 AS special_code_4') && files.apiService.includes("category: String(row.special_code_4")],
];

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}

if (checks.some(([, passed]) => !passed)) process.exit(1);
