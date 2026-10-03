import { demoCustomers } from './demoCustomers.js';
import { demoSuppliers } from './demoSuppliers.js';
import { demoProductRows } from './demoProducts.js';
import { demoInvoiceRows } from './demoInvoices.js';
import { demoMeta, demoList, demoDetail, matchesDemoRow } from './demoReadModel.js';

const TASK_SOURCE = 'PROMPT-2-20260923-01';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function demoPartyRows(kind) {
  return (kind === 'customer' ? demoCustomers : demoSuppliers).map(row => ({ ...row, kind,
    code: row.customerCode || row.supplierCode, name: row.customerName || row.supplierName,
    currentBalances: [{ currency: row.currency, amount: String(row.balance), state: 'RECORDED' }] }));
}
function partyResponse(kind, params) {
  const rows = demoPartyRows(kind).filter(row => matchesDemoRow(row, { ...params, status: undefined }, ['code', 'name'])
    && (!params.status || params.status === 'ALL' || (params.status === 'PASSIVE' ? row.isPassive : !row.isPassive)));
  return demoList(rows, params);
}
function partyMovements(kind, id, params) {
  const party = demoDetail(demoPartyRows(kind), id).data;
  // The old fixture records a card balance only. Preserve its provenance: do
  // not fabricate invoice/tahsilat movements to make that balance reconcile.
  throw Object.assign(new Error(`${party.name}: örnek veri setinde cari hareketleri bulunmuyor. Kart bakiyesi hareket toplamı olarak yorumlanamaz.`),
    { code: 'DEMO_DATASET_UNAVAILABLE', status: 503, meta: demoMeta({ historicOpeningBalance: { state: 'UNVERIFIED' } }) });
}
function receiptRows() {
  const purchase = demoInvoiceRows('purchase')[0];
  return [{ id: '601', source: TASK_SOURCE, documentNo: 'MK-DEMO-0601', supplierId: String(purchase.supplierId),
    supplierName: purchase.supplierName, documentDate: purchase.documentDate, status: 'submitted',
    dispatchNumberState: 'unverified', dispatchNumber: null, lineScope: 'whole_receipt', billingStatus: null,
    lines: purchase.items.map(item => ({ id: String(6000 + item.id), productId: String(item.productId),
      productName: item.productName, barcode: item.barcode, quantity: String(item.quantity),
      allocatedQuantity: '0', unit: 'adet', countedBy: '1', resolution: 'verified' })) }];
}
function receipts(params, id) {
  if (params.source && params.source !== TASK_SOURCE) throw Object.assign(new Error('Örnek kabul kaynağı eşleşmedi.'), { code: 'SOURCE_MISMATCH' });
  const metadata = { source: TASK_SOURCE, visibilityScope: 'all_task_receipts' };
  if (id) { const result = demoDetail(receiptRows(), id); result.meta = demoMeta(metadata); return result; }
  return demoList(receiptRows().filter(row => (!params.status || row.status === params.status)
    && (!params.supplierId || row.supplierId === String(params.supplierId))), params, metadata);
}
function queue() {
  const readAt = new Date().toISOString();
  return { success: true, meta: demoMeta(), data: { source: TASK_SOURCE, synthetic: true, readOnly: true, complete: false,
    scope: 'TASK_RECEIPTS_NOTICES_CHEQUES_COUNTS_ONLY', groups: [
      { key: 'receipts', state: 'read', total: 1, readAt, visibilityScope: 'Örnek kabul kayıtları',
        items: [{ id: '601', kind: 'receipt', source: TASK_SOURCE, status: 'submitted',
          link: { kind: 'receipt', documentId: '601', source: '/api/inventory-receipts' } }] },
      ...['notices', 'cheques', 'counts'].map(key => ({ key, state: 'not_connected', total: null, items: [] })) ] } };
}
function balances(kind) {
  const result = new Map();
  for (const row of demoPartyRows(kind)) {
    const group = result.get(row.currency) || { currency: row.currency, balance: 0, debit: 0, credit: 0, partyCount: 0 };
    group.balance += row.balance; group.debit += Math.max(0, row.balance); group.credit += Math.max(0, -row.balance); group.partyCount++;
    result.set(row.currency, group);
  }
  return [...result.values()];
}
function finalized(kind, params) { return demoInvoiceRows(kind).filter(row => row.status === 'FINALIZED' && matchesDemoRow(row, params)); }
function currencyTotals(rows) {
  const result = new Map();
  for (const row of rows) {
    const group = result.get(row.currency) || { currency: row.currency, amount: 0, amountTry: 0, count: 0 };
    group.amount += row.grandTotal; group.amountTry += row.grandTotal * row.exchangeRate; group.count++;
    result.set(row.currency, group);
  }
  return [...result.values()];
}
export function demoWorkspaceSummary() {
  const products = demoProductRows(), businessDate = today();
  const sales = demoInvoiceRows('sales'), purchases = demoInvoiceRows('purchase');
  return { totalProducts: products.length, activeProducts: products.filter(row => !row.isPassive).length,
    readAt: new Date().toISOString(), synthetic: true, businessDate,
    dailyCounts: { salesDocuments: sales.filter(row => row.documentDate === businessDate).length,
      purchaseDocuments: purchases.filter(row => row.documentDate === businessDate).length },
    recentDocuments: [...sales.map(row => ({ ...row, kind: 'sales', label: 'Satış' })), ...purchases.map(row => ({ ...row, kind: 'purchase', label: 'Alış' }))]
      .sort((a, b) => b.documentDate.localeCompare(a.documentDate)) };
}
export function demoWorkspaceManagement() {
  const date = today(), params = { dateFrom: date, dateTo: date };
  const sales = finalized('sales', params), purchases = finalized('purchase', params), products = demoProductRows();
  const sum = rows => rows.reduce((n, row) => n + row.grandTotal * row.exchangeRate, 0);
  const negative = products.filter(row => row.stockQuantity < 0);
  return { success: true, meta: demoMeta(), data: {
    synthetic: true, generatedAt: new Date().toISOString(),
    dailySales: { salesCount: sales.length, salesAmountTry: sum(sales), cancelledSalesCount: 0, cancelledSalesAmountTry: 0 },
    dailyPurchases: { purchaseCount: purchases.length, purchaseAmountTry: sum(purchases), cancelledPurchaseCount: 0, cancelledPurchaseAmountTry: 0 },
    widgets: { todaySalesTry: sum(sales), todayPurchasesTry: sum(purchases),
      totalStockValueTry: products.reduce((n, row) => n + row.stockQuantity * row.averageCostTry, 0),
      customerBalances: balances('customer'), supplierBalances: balances('supplier'), negativeStockCount: negative.length,
      salesDraftCount: demoInvoiceRows('sales').filter(row => row.status === 'DRAFT').length,
      purchaseDraftCount: demoInvoiceRows('purchase').filter(row => row.status === 'DRAFT').length },
    criticalWarnings: negative.map(row => ({ type: 'Stok', subject: row.productName, value: row.stockQuantity, severity: 'danger' })),
    // Null financial fields remain unknown. No fabricated conversion or profit.
    assumptions: ['Sentetik örnek veriler; gerçek şirket kayıtları değildir.', 'Taslak belgeler kesinleşmiş satış ve alış toplamlarına katılmaz.'],
    dataQuality: { reviewRequired: ['Cari hareketleri, kasa ve kâr veri setleri bu demoda yok.'], approvalBoundaries: ['Gerçek ERP bağlantısı ayrıca doğrulanmalıdır.'] }
  } };
}
export function demoPeriodicAccounting(params = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dateFrom || '') || !/^\d{4}-\d{2}-\d{2}$/.test(params.dateTo || '') || params.dateFrom > params.dateTo)
    throw Object.assign(new Error('Geçerli bir başlangıç ve bitiş tarihi seçin.'), { code: 'INVALID_DATE_RANGE' });
  const salesByCurrency = currencyTotals(finalized('sales', params));
  const purchasesByCurrency = currencyTotals(finalized('purchase', params));
  return { success: true, meta: demoMeta(), data: { synthetic: true, dateFrom: params.dateFrom, dateTo: params.dateTo,
    salesByCurrency, purchasesByCurrency, customerBalances: balances('customer'), supplierBalances: balances('supplier'),
    widgets: { salesTry: salesByCurrency.reduce((n, row) => n + row.amountTry, 0), purchasesTry: purchasesByCurrency.reduce((n, row) => n + row.amountTry, 0) } } };
}
export function demoReadRequest(path, params = {}) {
  const party = path.match(/^\/api\/read-only-parties\/(customer|supplier)(?:\/(\d+)(\/movements)?)?$/);
  if (party) return party[3] ? partyMovements(party[1], party[2], params) : party[2] ? demoDetail(demoPartyRows(party[1]), party[2]) : partyResponse(party[1], params);
  const receipt = path.match(/^\/api\/inventory-receipts(?:\/(\d+))?$/);
  if (receipt) return receipts(params, receipt[1]);
  if (path === '/api/operational-queue') return queue();
  if (path === '/api/dashboard/periodic-accounting') return demoPeriodicAccounting(params);
  return null;
}
