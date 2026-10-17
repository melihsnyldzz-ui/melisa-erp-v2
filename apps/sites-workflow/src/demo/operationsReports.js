import { currencies, kinds } from './operationsShared.js';
import { financePosition } from './operationsFinance.js';
import { reservedQuantity, availableStock } from './operationsSelectors.js';

const reportKinds = new Set(['sale', 'purchase', 'sales-return', 'purchase-return', 'collection', 'payment', 'customer-refund', 'supplier-refund']);
const partyName = (state, id) => [...state.customers, ...state.suppliers].find(row => row.id === id)?.name || '—';

export function operationsReport(state, filters = {}) {
  const { dateFrom = '', dateTo = '', productId = '', partyId = '', currency = '' } = filters;
  const documents = state.documents.filter(doc => doc.status === 'APPROVED' && reportKinds.has(doc.kind)
    && (!dateFrom || doc.date >= dateFrom) && (!dateTo || doc.date <= dateTo)
    && (!currency || doc.currency === currency) && (!partyId || doc.partyId === partyId)
    && (!productId || doc.items?.some(line => line.productId === productId)));
  const documentRows = documents.map(doc => ({ id: doc.id, date: doc.date, number: doc.number, kind: doc.kind, partyId: doc.partyId,
    party: partyName(state, doc.partyId), currency: doc.currency, amount: productId
      ? (() => { const net = doc.items.filter(line => line.productId === productId).reduce((sum, line) => sum + line.total, 0); return net + (doc.net ? Math.round(doc.tax * net / doc.net) : 0); })()
      : doc.amount, dueDate: doc.dueDate || '' }));
  const totals = Object.fromEntries([...reportKinds].map(kind => [kind, Object.fromEntries(currencies.map(code => [code, documentRows.filter(row => row.kind === kind && row.currency === code).reduce((sum, row) => sum + row.amount, 0)]))]));
  const dueRows = [...state.customers, ...state.suppliers].filter(party => !partyId || party.id === partyId).flatMap(party => currencies.filter(code => !currency || code === currency).flatMap(code => financePosition(state, party.id, code).invoices.filter(invoice => invoice.open > 0 && (!dateFrom || invoice.date >= dateFrom) && (!dateTo || invoice.date <= dateTo) && (!productId || state.documents.find(doc => doc.id === invoice.id)?.items?.some(line => line.productId === productId))).map(invoice => ({ party: party.name, partyId: party.id, currency: code, number: invoice.number, date: invoice.date, dueDate: invoice.dueDate, amount: invoice.open }))));
  const stockRows = state.products.filter(product => !productId || product.id === productId).map(product => ({ productId: product.id, code: product.code, name: product.name, stock: product.stock, reserved: reservedQuantity(state, product.id), available: availableStock(state, product.id), estimatedCost: Number.isSafeInteger(product.cost) && product.cost > 0 ? product.cost : null, currency: 'TRY' }));
  return { documentRows, totals, dueRows, stockRows };
}

export function operationsReportOutput(report, filters = {}) {
  const rows = report.documentRows.map(row => ({ date: row.date, number: row.number, kind: kinds[row.kind], party: row.party, currency: row.currency, amount: (row.amount / 100).toFixed(2), dueDate: row.dueDate || '' }));
  for (const [kind, totals] of Object.entries(report.totals)) for (const currency of currencies.filter(code => !filters.currency || filters.currency === code)) rows.push({ date: '', number: '', kind: `${kinds[kind]} alt toplam`, party: '', currency, amount: (totals[currency] / 100).toFixed(2), dueDate: '' });
  return { title: 'İşlem raporu', subtitle: `${filters.dateFrom || 'Başlangıç'} – ${filters.dateTo || 'Bugün'} · ${filters.productId ? 'Seçili ürünün belgelerdeki net + KDV payı' : 'Tam belge tutarları'} · Bağlı demo, resmi e-belge değildir`, filename: 'melisa-islem-raporu', columns: [{ label: 'Tarih', key: 'date' }, { label: 'Belge', key: 'number' }, { label: 'İşlem', key: 'kind' }, { label: 'Cari', key: 'party' }, { label: 'Döviz', key: 'currency' }, { label: 'Tutar', key: 'amount' }, { label: 'Vade', key: 'dueDate' }], rows };
}

export function operationsDueOutput(report) {
  return { title: 'Açık belgeler ve vadeler', subtitle: 'Bağlı demo · Ürün filtresi ilişkili faturanın tüm açık tutarını gösterir', filename: 'melisa-acik-vadeler', columns: [{ label: 'Cari', key: 'party' }, { label: 'Belge', key: 'number' }, { label: 'Döviz', key: 'currency' }, { label: 'Kalan', key: 'amount' }, { label: 'Vade', key: 'dueDate' }], rows: report.dueRows.map(row => ({ party: row.party, number: row.number, currency: row.currency, amount: (row.amount / 100).toFixed(2), dueDate: row.dueDate || '' })) };
}

export function operationsStockOutput(report) {
  return { title: 'Stok ve rezervasyon', subtitle: 'Bağlı demo · Anlık stok; maliyet tahminidir, kâr değildir', filename: 'melisa-stok-rezervasyon', columns: [{ label: 'Kod', key: 'code' }, { label: 'Ürün', key: 'name' }, { label: 'Paket', key: 'stock' }, { label: 'Ayrılmış', key: 'reserved' }, { label: 'Kullanılabilir', key: 'available' }, { label: 'Tahmini maliyet TRY', key: 'estimatedCost' }], rows: report.stockRows.map(row => ({ code: row.code, name: row.name, stock: row.stock, reserved: row.reserved, available: row.available, estimatedCost: row.estimatedCost === null ? 'Bilinmiyor' : (row.estimatedCost / 100).toFixed(2) })) };
}
