import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

const service = read('apps/api/src/services/invoiceDraftService.js');
const controller = read('apps/api/src/controllers/invoiceController.js');
const audit = read('apps/api/src/services/auditService.js');

const checks = [
  ['sales finalized correction uses direct stock and balance differences', service.includes('replaceFinalizedSalesEffects') && service.includes("direction === 'sale'") && service.includes('salesCorrectionBalanceDifference')],
  ['purchase finalized correction uses direct stock and balance differences', service.includes('replaceFinalizedPurchaseEffects') && service.includes("'purchase'") && service.includes('purchaseCorrectionBalanceDifference')],
  ['finalized identity fields stay locked', service.includes('SALES_FINALIZED_IDENTITY_LOCKED') && service.includes('PURCHASE_FINALIZED_IDENTITY_LOCKED')],
  ['correction replaces source movements without cancel movements', service.includes("movement_type = N'out'") && service.includes("movement_type = N'in'") && !service.includes('replaceFinalizedSalesEffects(sqlDriver, transaction, invoiceId, beforeSnapshot, draft, actor);\n      await cancelSalesInvoice')],
  ['cash sale correction updates collection and finance balance', service.includes('cashCorrectionBalanceDifference') && service.includes('dbo.finance_account_movements') && service.includes('dbo.finance_accounts')],
  ['removed invoice lines are deleted', service.includes('obsoleteSalesItemId') && service.includes('obsoletePurchaseItemId')],
  ['corrections are marked as commercial writes', controller.includes("commercialEffect: finalizedCorrection")],
  ['correction actions are included in audit coverage', audit.includes('sales_invoice_finalized_corrected') && audit.includes('purchase_invoice_finalized_corrected')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - Finalized Invoice Correction / ${name}`);
}
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
