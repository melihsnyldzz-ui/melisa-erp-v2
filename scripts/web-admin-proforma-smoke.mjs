import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requirePermission } from '../apps/api/src/middleware/authMiddleware.js';
import {
  PROFORMA_DRAFT_SCHEMA_VERSION,
  buildVersionedProformaDraft,
  canGenerateProformaPdf,
  isFiniteNonNegativeAmount,
  isPositiveFiniteQuantity,
  isSourceLockedCurrency,
  isValidIsoDate,
  isValidProformaDateRange,
  restoreVersionedProformaDraft,
  validateProformaForPdf,
} from '../apps/web-admin/src/modules/sales/proformaSafety.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const files = {
  navigation: read('apps/web-admin/src/data/mockNavigationData.js'),
  sidebar: read('apps/web-admin/src/components/navigation/Sidebar.jsx'),
  workspace: read('apps/web-admin/src/components/workspace/Workspace.jsx'),
  appShell: read('apps/web-admin/src/components/layout/AppShell.jsx'),
  salesList: read('apps/web-admin/src/modules/sales/VegaSalesInvoiceListScreen.jsx'),
  screen: read('apps/web-admin/src/modules/sales/ProformaInvoiceScreen.jsx'),
  print: read('apps/web-admin/src/utils/proformaPrint.js'),
  movementApi: read('apps/web-admin/src/services/movementApi.js'),
  customerApi: read('apps/web-admin/src/services/customerApi.js'),
  movementRoutes: read('apps/api/src/routes/movementRoutes.js'),
  customerRoutes: read('apps/api/src/routes/customerRoutes.js'),
  apiService: read('apps/api/src/services/vegaKoliLedgerService.js'),
  classifier: read('apps/api/src/services/productCustomsClassifier.js'),
  css: read('apps/web-admin/src/styles/proforma-invoice.css'),
  packageJson: read('apps/web-admin/package.json'),
  finalPack: read('scripts/final-erp-smoke-pack.mjs'),
  documentation: read('docs/erp-v2/proforma-invoice.md'),
};

const checks = [];
const check = (name, passed) => checks.push([name, Boolean(passed)]);
const hasCode = (items, code) => items.some((item) => item.code === code);
const tabIdentitySource = files.appShell.slice(
  files.appShell.indexOf('const recordId ='),
  files.appShell.indexOf('const recordLabel ='),
);

function evaluateStockExitDetailPermission(permissions) {
  const req = { user: { permissions } };
  let error = null;
  let reachedController = false;

  requirePermission('sales.view')(req, {}, (salesError) => {
    if (salesError) {
      error = salesError;
      return;
    }

    requirePermission('customer.view')(req, {}, (customerError) => {
      if (customerError) {
        error = customerError;
        return;
      }

      reachedController = true;
    });
  });

  return { allowed: reachedController, error };
}

check('navigation entry', files.navigation.includes("screenId: 'proforma-invoice'"));
check('sidebar label uses correct Turkish characters', files.sidebar.includes("'proforma-invoice': 'Proforma Hazırlama'"));
check('workspace route', files.workspace.includes("'proforma-invoice': {") && files.workspace.includes('<ProformaInvoiceScreen'));
check('workspace route requires both read permissions', files.workspace.includes("permissionKeys: ['sales.view', 'customer.view']") && files.workspace.includes("permissionMode: 'all'"));
check('workspace passes a user-scoped draft owner', files.workspace.includes('draftOwnerId={user?.id || user?.username'));
check('sales list action', files.salesList.includes('Seçili Fişten Proforma'));
check('same-customer Proforma tabs use receipt source identity', tabIdentitySource.indexOf('payload.sourceId') >= 0 && tabIdentitySource.indexOf('payload.sourceId') < tabIdentitySource.indexOf('payload.customerSourceId'));
check('read-only Vega source label', files.screen.includes('Vega salt okunur'));
check('draft local storage', files.screen.includes('window.localStorage.setItem'));
check('stale draft protection', files.screen.includes('sourceFingerprint') && files.screen.includes('restoreVersionedProformaDraft') && files.screen.includes('Eski veya geçersiz taslak kullanılmadı'));
check('null-safe corporate defaults', files.screen.includes("value && typeof value === 'object' ? value : {}") && files.screen.includes('overrides.usdIban'));
check('editable GTIP', files.screen.includes("updateLine(line.id, 'gtipCode'"));
check('not tax invoice marker', files.print.includes('NOT A TAX INVOICE'));
check('printable proforma', files.print.includes('PROFORMA INVOICE') && files.print.includes('printWindow.print()'));
check('corporate logo', files.print.includes('melisa-baby-watermark.png') && files.print.includes('Melisa Baby'));
check('three currency bank accounts', files.screen.includes('tryIban') && files.screen.includes('usdIban') && files.screen.includes('eurIban'));
check('freight amount and payable total', files.screen.includes('freightAmount') && files.screen.includes('Mal + nakliye bedeli') && files.print.includes('Nakliye Bedeli') && files.print.includes('payableTotal'));
check('save PDF action', files.screen.includes('PDF Kaydet') && files.screen.includes('PDF olarak kaydet') && files.print.includes('proformaPdfFileName'));
check('source currency is read only in the editor', files.screen.includes('value={header.currency} readOnly') && !files.screen.includes("updateSection(setHeader, 'currency'"));
check('PDF requires explicit confirmation', files.screen.includes('isPdfConfirmed') && files.screen.includes('disabled={!canSavePdf}') && files.screen.includes('PDF öncesi son kontrol'));
check('editing clears prior PDF confirmation', files.screen.includes('setIsPdfConfirmed(false)'));
check('dirty source replacement uses inline decision', files.screen.includes('pendingAction') && files.screen.includes('Kaydetmeden devam et') && files.screen.includes('requestLoadReceipt'));
check('receipt loading ignores stale async responses', files.screen.includes('loadRequestSequence') && files.screen.includes('requestSequence !== loadRequestSequence.current'));
check('receipt search ignores stale async responses', files.screen.includes('searchRequestSequence') && files.screen.includes('requestSequence !== searchRequestSequence.current'));
check('draft storage key is user scoped and versioned', files.screen.includes('melisa.proformaDraft.v2.') && files.screen.includes('stableDraftOwnerId'));
check('swift and seller registry', files.print.includes('SWIFT:') && files.print.includes('Ticaret Sicil:'));
check('official invoice identifiers excluded', !files.print.includes('ETTN:') && !files.print.includes('e-FATURA'));
check('customs enrichment', files.apiService.includes('getVegaProductCustomsMap') && files.apiService.includes('gtipCode'));
check('automatic customs fallback', files.apiService.includes('classifyProductCustomsDraft') && files.apiService.includes("source: 'local-customs'"));
check('stored customs wins', files.apiService.includes('storedCustoms?.code') && files.apiService.includes('classifyProductCustomsDraft(line)'));
check('automatic rule transparency', files.screen.includes('Otomatik taslak') && files.screen.includes('gtipMaterialBasis') && files.screen.includes('gtipNote'));
check('customs material rules', files.classifier.includes('baby-knit-synthetic-explicit') && files.classifier.includes('baby-woven-linen-explicit') && files.classifier.includes('baby-knit-cotton-fallback'));
check('automatic customs stays draft', files.classifier.includes("status: 'draft'") && files.classifier.includes('requiresReview: true'));
check('Vega KOD4 reaches customs classifier', files.apiService.includes('s.KOD4 AS special_code_4') && files.apiService.includes("category: String(row.special_code_4"));
check('sales receipt list API is GET only', files.movementApi.includes("return get('/api/vega/sales/stock-exits', params)"));
check('sales receipt detail API is GET only', files.movementApi.includes('return get(`/api/vega/customers/${customerSourceId}/movements/${movementSourceId}/stock-exit`)'));
check('Vega customer API is GET only', files.customerApi.includes("return get('/api/vega/customers'"));
check('sales receipt list requires sales.view', files.movementRoutes.includes("movementRoutes.get('/vega/sales/stock-exits', requireAuth, requirePermission('sales.view')"));
check('sales receipt detail requires sales.view and customer.view together', files.movementRoutes.includes("movementRoutes.get('/vega/customers/:customerSourceId/movements/:movementSourceId/stock-exit', requireAuth, requirePermission('sales.view'), requirePermission('customer.view'), getVegaCustomerStockExitDocument)"));
check('customer movement list remains customer.view only', files.movementRoutes.includes("movementRoutes.get('/vega/customers/:customerSourceId/movements', requireAuth, requirePermission('customer.view'), getVegaCustomerLedger)"));
check('Vega customer read requires customer.view', files.customerRoutes.includes("customerRoutes.get('/vega/customers', requireAuth, requirePermission('customer.view')"));
check('documentation declares no commercial data write', files.documentation.includes('Vega satış fişini, stok miktarını, cari bakiyeyi veya muhasebe kaydını değiştirmez'));
check('documentation requires both read permissions', files.documentation.includes('`sales.view` ile `customer.view` yetkilerini birlikte gerektirir'));
check('documentation requires human PDF confirmation', files.documentation.includes('PDF öncesi kontrolde proforma numarası'));
check('empty Proforma rows keep natural height', files.css.includes('grid-auto-rows: max-content') && files.css.includes('align-content: start'));
check('receipt list does not inherit global minimum height', files.css.includes('.proforma-receipt-list {') && files.css.includes('min-height: 0'));
check('summary cannot collapse below readable height', files.css.includes('min-height: 76px'));
check('narrow workspace uses container-aware layout', files.css.includes('container-type: inline-size') && files.css.includes('@container (max-width: 900px)'));
check('package exposes Proforma smoke', files.packageJson.includes('"smoke:proforma"'));
check('final smoke pack includes Proforma safety', files.finalPack.includes("['web-admin proforma safety smoke'"));

const hasProformaRouteAccess = (permissions) => ['sales.view', 'customer.view'].every((permission) => permissions.includes(permission));
check('permission matrix allows both read permissions', hasProformaRouteAccess(['sales.view', 'customer.view']));
check('permission matrix rejects sales-only access', !hasProformaRouteAccess(['sales.view']));
check('permission matrix rejects customer-only access', !hasProformaRouteAccess(['customer.view']));
check('permission matrix rejects no access', !hasProformaRouteAccess([]));

const noDetailPermission = evaluateStockExitDetailPermission([]);
const salesOnlyDetailPermission = evaluateStockExitDetailPermission(['sales.view']);
const customerOnlyDetailPermission = evaluateStockExitDetailPermission(['customer.view']);
const completeDetailPermission = evaluateStockExitDetailPermission(['sales.view', 'customer.view']);
check('API detail middleware denies no permissions', !noDetailPermission.allowed && noDetailPermission.error?.code === 'AUTH_PERMISSION_DENIED');
check('API detail middleware denies sales.view alone', !salesOnlyDetailPermission.allowed && salesOnlyDetailPermission.error?.code === 'AUTH_PERMISSION_DENIED');
check('API detail middleware denies customer.view alone', !customerOnlyDetailPermission.allowed && customerOnlyDetailPermission.error?.code === 'AUTH_PERMISSION_DENIED');
check('API detail middleware allows both required permissions', completeDetailPermission.allowed && !completeDetailPermission.error);

check('draft schema version is a positive integer', Number.isInteger(PROFORMA_DRAFT_SCHEMA_VERSION) && PROFORMA_DRAFT_SCHEMA_VERSION > 0);
check('source currency accepts exact match', isSourceLockedCurrency('EUR', 'EUR'));
check('source currency normalizes case and whitespace', isSourceLockedCurrency(' eur ', 'EUR'));
check('source currency rejects relabeling', !isSourceLockedCurrency('USD', 'EUR'));
check('source currency rejects unsupported code', !isSourceLockedCurrency('GBP', 'GBP'));
check('nonnegative amount accepts zero', isFiniteNonNegativeAmount(0));
check('nonnegative amount accepts numeric text', isFiniteNonNegativeAmount('12.50'));
check('nonnegative amount rejects blank', !isFiniteNonNegativeAmount(' '));
check('nonnegative amount rejects null and boolean', !isFiniteNonNegativeAmount(null) && !isFiniteNonNegativeAmount(true));
check('nonnegative amount rejects negative and infinity', !isFiniteNonNegativeAmount(-0.01) && !isFiniteNonNegativeAmount(Infinity));
check('positive quantity accepts positive decimal', isPositiveFiniteQuantity('0.25'));
check('positive quantity rejects zero', !isPositiveFiniteQuantity(0));
check('positive quantity rejects negative, blank and infinity', !isPositiveFiniteQuantity(-1) && !isPositiveFiniteQuantity('') && !isPositiveFiniteQuantity(Infinity));
check('ISO date accepts leap day', isValidIsoDate('2024-02-29'));
check('ISO date rejects impossible day', !isValidIsoDate('2025-02-29'));
check('ISO date rejects noncanonical input', !isValidIsoDate('31.08.2026') && !isValidIsoDate('2026-8-31'));
check('date range accepts same day', isValidProformaDateRange('2026-08-31', '2026-08-31'));
check('date range rejects expiry before issue', !isValidProformaDateRange('2026-08-31', '2026-08-30'));

const validPayload = {
  sourceCurrency: 'EUR',
  header: {
    proformaNo: 'PF-2026-001',
    sourceDocumentNo: 'S-001',
    issueDate: '2026-08-31',
    validUntil: '2026-09-07',
    currency: 'EUR',
  },
  buyer: { name: 'Sentetik Alıcı' },
  shipment: {
    incoterm: 'EXW',
    paymentTerms: 'Peşin',
    freightAmount: 0,
  },
  lines: [
    { id: 'line-1', included: true, quantity: 10, unitPrice: 4.5, gtipCode: '611120900000' },
    { id: 'line-2', included: false, quantity: 0, unitPrice: -99, gtipCode: '' },
  ],
};

const validResult = validateProformaForPdf(validPayload);
check('valid proforma is PDF ready', validResult.isValid && validResult.errors.length === 0);
check('valid proforma has no warnings', validResult.warnings.length === 0);
check('excluded invalid line does not block PDF', !hasCode(validResult.errors, 'QUANTITY_INVALID') && !hasCode(validResult.errors, 'PRICE_INVALID'));

const warningResult = validateProformaForPdf({
  ...validPayload,
  shipment: { ...validPayload.shipment, incoterm: '', paymentTerms: '' },
  lines: [{ ...validPayload.lines[0], gtipCode: '' }],
});
check('commercial warnings do not block PDF validation', warningResult.isValid && warningResult.errors.length === 0);
check('missing incoterm is warning only', hasCode(warningResult.warnings, 'INCOTERM_MISSING'));
check('missing payment terms is warning only', hasCode(warningResult.warnings, 'PAYMENT_TERMS_MISSING'));
check('missing GTIP is warning only with count', warningResult.warnings.find((item) => item.code === 'GTIP_MISSING')?.count === 1);

const requiredResult = validateProformaForPdf({
  ...validPayload,
  sourceCurrency: '',
  header: { ...validPayload.header, proformaNo: '', issueDate: '2026-02-30', validUntil: 'bad', currency: 'USD' },
  buyer: { name: ' ' },
  shipment: { ...validPayload.shipment, freightAmount: -1 },
  lines: [],
});
check('missing source currency blocks PDF', hasCode(requiredResult.errors, 'SOURCE_CURRENCY_REQUIRED'));
check('missing proforma number blocks PDF', hasCode(requiredResult.errors, 'PROFORMA_NO_REQUIRED'));
check('missing buyer blocks PDF', hasCode(requiredResult.errors, 'BUYER_REQUIRED'));
check('invalid dates block PDF', hasCode(requiredResult.errors, 'ISSUE_DATE_INVALID') && hasCode(requiredResult.errors, 'VALID_UNTIL_INVALID'));
check('negative freight blocks PDF', hasCode(requiredResult.errors, 'FREIGHT_INVALID'));
check('missing included line blocks PDF', hasCode(requiredResult.errors, 'INCLUDED_LINE_REQUIRED'));

const lineErrorResult = validateProformaForPdf({
  ...validPayload,
  header: { ...validPayload.header, validUntil: '2026-08-30', currency: 'USD' },
  lines: [{ ...validPayload.lines[0], quantity: 0, unitPrice: Number.NaN }],
});
check('source currency relabeling blocks PDF', hasCode(lineErrorResult.errors, 'CURRENCY_MISMATCH'));
check('expiry before issue blocks PDF', hasCode(lineErrorResult.errors, 'VALID_UNTIL_BEFORE_ISSUE'));
check('zero included quantity blocks PDF', hasCode(lineErrorResult.errors, 'QUANTITY_INVALID'));
check('nonfinite price blocks PDF', hasCode(lineErrorResult.errors, 'PRICE_INVALID'));
check('validation alone does not generate PDF without confirmation', !canGenerateProformaPdf({ validation: validResult, isConfirmed: false, hasDetail: true }));
check('confirmation alone does not generate PDF without detail', !canGenerateProformaPdf({ validation: validResult, isConfirmed: true, hasDetail: false }));
check('invalid validation never generates PDF', !canGenerateProformaPdf({ validation: lineErrorResult, isConfirmed: true, hasDetail: true }));
check('valid confirmed detailed proforma can generate PDF', canGenerateProformaPdf({ validation: warningResult, isConfirmed: true, hasDetail: true }));

const sourceDefaults = {
  header: { ...validPayload.header },
  buyer: { name: 'Güncel Alıcı', customerCode: 'C-01', address: 'Güncel adres' },
  shipment: { ...validPayload.shipment, transportMode: 'Karayolu' },
  lines: [{
    id: 'line-1',
    included: true,
    stockCode: 'CURRENT-STOCK',
    description: 'Kaynak ürün adı',
    barcode: 'CURRENT-BARCODE',
    gtipCode: '',
    gtipStatus: '',
    gtipRequiresReview: true,
    quantity: 10,
    unitName: 'ADET',
    unitPrice: 4.5,
  }],
  seller: { name: 'Güncel satıcı' },
  bank: { eurIban: 'Güncel banka' },
};

const builtDraft = buildVersionedProformaDraft({
  sourceFingerprint: 'fingerprint-1',
  draftOwnerId: 'owner-1',
  header: validPayload.header,
  buyer: { ...sourceDefaults.buyer, name: 'Taslak Alıcı' },
  shipment: sourceDefaults.shipment,
  lines: [{
    ...sourceDefaults.lines[0],
    stockCode: 'STALE-STOCK',
    barcode: 'STALE-BARCODE',
    description: 'Kullanıcı ürün açıklaması',
    gtipCode: '611120900000',
    gtipStatus: 'draft',
    gtipSource: 'manual',
    quantity: 12,
    unitPrice: 5,
  }],
  seller: { name: 'Eski satıcı' },
  bank: { eurIban: 'Eski banka' },
});

check('versioned draft builds with identity', builtDraft?.schemaVersion === PROFORMA_DRAFT_SCHEMA_VERSION && builtDraft?.sourceFingerprint === 'fingerprint-1' && builtDraft?.draftOwnerId === 'owner-1');
check('versioned draft never stores seller', builtDraft && !Object.hasOwn(builtDraft, 'seller'));
check('versioned draft never stores bank', builtDraft && !Object.hasOwn(builtDraft, 'bank'));
check('draft build fails closed without fingerprint', buildVersionedProformaDraft({ ...builtDraft, sourceFingerprint: '' }) === null);
check('draft build fails closed without owner', buildVersionedProformaDraft({ ...builtDraft, draftOwnerId: '' }) === null);

const injectedDraft = {
  ...builtDraft,
  seller: { name: 'Depodaki eski satıcı' },
  bank: { eurIban: 'Depodaki eski banka' },
  lines: [
    ...builtDraft.lines,
    { id: 'injected-line', included: true, stockCode: 'INJECTED', quantity: 999, unitPrice: 999 },
  ],
};
const restoredDraft = restoreVersionedProformaDraft(injectedDraft, {
  sourceFingerprint: 'fingerprint-1',
  draftOwnerId: 'owner-1',
  defaults: sourceDefaults,
});

check('current versioned draft restores', Boolean(restoredDraft));
check('restored draft returns only editable sections', restoredDraft && Object.keys(restoredDraft).sort().join(',') === 'buyer,header,lines,shipment');
check('restore never returns seller or bank', restoredDraft && !Object.hasOwn(restoredDraft, 'seller') && !Object.hasOwn(restoredDraft, 'bank'));
check('restore preserves editable buyer change', restoredDraft?.buyer.name === 'Taslak Alıcı');
check('restore preserves editable line change', restoredDraft?.lines[0].description === 'Kullanıcı ürün açıklaması' && restoredDraft?.lines[0].quantity === 12 && restoredDraft?.lines[0].unitPrice === 5);
check('restore keeps current source stock identity', restoredDraft?.lines[0].stockCode === 'CURRENT-STOCK' && restoredDraft?.lines[0].barcode === 'CURRENT-BARCODE');
check('restore discards injected extra line', restoredDraft?.lines.length === 1 && restoredDraft?.lines[0].id === 'line-1');
check('restore locks draft currency to current source', restoredDraft?.header.currency === 'EUR');
check('old schema is rejected', restoreVersionedProformaDraft({ ...builtDraft, schemaVersion: PROFORMA_DRAFT_SCHEMA_VERSION - 1 }, { sourceFingerprint: 'fingerprint-1', draftOwnerId: 'owner-1', defaults: sourceDefaults }) === null);
check('wrong source fingerprint is rejected', restoreVersionedProformaDraft(builtDraft, { sourceFingerprint: 'fingerprint-2', draftOwnerId: 'owner-1', defaults: sourceDefaults }) === null);
check('wrong draft owner is rejected', restoreVersionedProformaDraft(builtDraft, { sourceFingerprint: 'fingerprint-1', draftOwnerId: 'owner-2', defaults: sourceDefaults }) === null);
check('currency-relabelled draft is rejected', restoreVersionedProformaDraft({ ...builtDraft, header: { ...builtDraft.header, currency: 'USD' } }, { sourceFingerprint: 'fingerprint-1', draftOwnerId: 'owner-1', defaults: sourceDefaults }) === null);
check('corrupt draft shape is rejected', restoreVersionedProformaDraft({ ...builtDraft, lines: {} }, { sourceFingerprint: 'fingerprint-1', draftOwnerId: 'owner-1', defaults: sourceDefaults }) === null);

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}

const passedCount = checks.filter(([, passed]) => passed).length;
const failedCount = checks.length - passedCount;
console.log(`SUMMARY ${passedCount}/${checks.length} passed; ${failedCount} failed`);

if (failedCount) process.exit(1);
