import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { getVegaPurchaseInvoiceList, getVegaSupplierLedgerList, getVegaSupplierPurchaseDocument } from '../services/vegaSupplierLedgerService.js';
import { getVegaSupplierPurchaseIntelligence } from '../services/vegaSupplierPurchaseIntelligenceService.js';
import { getVegaSuppliersList } from '../services/vegaSupplierService.js';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  try {
    const request = input ? JSON.parse(input) : {};
    const payload = request.payload || {};
    let result;
    if (request.action === 'ledger') {
      result = await getVegaSupplierLedgerList(payload.supplierSourceId, payload.query || {});
    } else if (request.action === 'purchase-document') {
      result = await getVegaSupplierPurchaseDocument(payload.supplierSourceId, payload.movementSourceId);
    } else if (request.action === 'purchase-list') {
      result = await getVegaPurchaseInvoiceList(payload.query || {});
    } else if (request.action === 'purchase-intelligence') {
      result = await getVegaSupplierPurchaseIntelligence(payload.supplierSourceId, payload.query || {});
    } else {
      result = await getVegaSuppliersList(payload.query || payload);
    }
    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: {
        code: error.code || 'VEGA_SUPPLIER_READ_FAILED',
        statusCode: error.statusCode || 503,
        message: 'Vega supplier data could not be read',
      },
    }));
  } finally {
    await closeVegaSqlPool().catch(() => {});
  }
});
