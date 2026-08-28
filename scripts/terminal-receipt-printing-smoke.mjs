import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTerminalReceiptText } from '../apps/api/src/services/terminalReceiptPrintService.js';

const receipt = buildTerminalReceiptText({
  id: 101,
  documentNo: 'TS-101',
  documentDate: '2026-08-05T10:30:00.000Z',
  status: 'FINALIZED',
  customerCode: 'PESIN-TL',
  customerName: 'Pesin Satis Musterisi',
  terminalCode: 'TERM-V2-001',
  employeeName: 'Test Personeli',
  documentCurrency: 'TRY',
  subtotal: 150,
  discountTotal: 10,
  grandTotal: 140,
  items: [
    {
      stockCode: 'STK-001',
      productName: 'Ornek Bebek Urunu',
      quantity: 2,
      unitPrice: 75,
      lineTotal: 150,
      currency: 'TRY',
    },
  ],
});

assert.match(receipt, /MELISA BABY/);
assert.match(receipt, /TS-101/);
assert.match(receipt, /Pesin Satis Musterisi/);
assert.match(receipt, /GENEL TOPLAM\s+140\.00 TRY/);
assert.ok(receipt.split(/\r?\n/).every((line) => line.length <= 42), 'Receipt lines must fit the thermal width');

const routeSource = readFileSync(new URL('../apps/api/src/routes/terminalRoutes.js', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../apps/api/src/controllers/terminalController.js', import.meta.url), 'utf8');
const printServiceSource = readFileSync(new URL('../apps/api/src/services/terminalReceiptPrintService.js', import.meta.url), 'utf8');
const terminalServiceSource = readFileSync(new URL('../apps/terminal-app/src/services/terminalSalesService.js', import.meta.url), 'utf8');
const saleScreenSource = readFileSync(new URL('../apps/terminal-app/src/screens/NewSaleScreen.js', import.meta.url), 'utf8');

assert.match(routeSource, /\/terminal\/sales\/:invoiceId\/print/);
assert.match(routeSource, /requireAnyPermission\(\['terminal\.sales\.create', 'sales\.view'\]\)/);
assert.match(controllerSource, /terminal-receipt-windows-printer/);
assert.match(printServiceSource, /Out-Printer/);
assert.match(printServiceSource, /FINALIZED/);
assert.match(printServiceSource, /terminal_receipt_print_requested/);
assert.match(terminalServiceSource, /printTerminalSaleReceipt/);
assert.match(saleScreenSource, /finishSale\(\{ printAfterSubmit: true \}\)/);

console.log('Terminal receipt printing smoke PASS');
