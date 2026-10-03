export const emptyDashboardSummary = {
  patron: {},
  accounting: {},
  operations: {},
  melisa: {},
  masterCounts: {},
  topProducts: [],
  receivables: null,
  countryPerformance: [],
  melisaPanels: {},
};

function formatMoney(amount) {
  if (numberOrNull(amount) === null) return 'Bilinmiyor';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function numberOrNull(value) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function returnDetail(totals) {
  if (!totals?.known) return 'İade bilgisi doğrulanamadı; net tutar bilinmiyor';
  return `Brüt ${formatMoney(totals.grossAmountTry)} · İade ${formatMoney(totals.returnedAmountTry)} · İade iptali ${formatMoney(totals.returnCancelledAmountTry)}`;
}

function formatNumber(value) {
  if (numberOrNull(value) === null) return 'Bilinmiyor';
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDateTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '-';

  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatTransactionDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function formatCardValuation(row) {
  const base = formatMoney(row.balanceTry);
  if (!row.currency || row.currency === 'TRY' || row.balance == null) return base;
  const balance = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(row.balance);
  const rate = row.rateToTry == null ? 'Kur eksik' : `kur ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 8 }).format(row.rateToTry)} / ${formatDate(row.rateDate)}`;
  return `${base} · ${balance} ${row.currency} · ${rate}`;
}

export function buildPatronKpis(summary = emptyDashboardSummary) {
  const patron = summary.patron || {};
  const operations = summary.operations || {};
  const masterCounts = summary.masterCounts || {};
  const salesTry = numberOrNull(patron.todaySalesTry);
  const grossProfitTry = numberOrNull(patron.todayGrossProfitTry);
  const negativeStockCount = numberOrNull(patron.negativeStockCount);
  const profitRate = summary.returnReporting?.known && salesTry > 0 && grossProfitTry !== null ? (grossProfitTry / salesTry) * 100 : null;
  const openAccountCustomerCount = summary.accounting?.customerBalanceCount;
  const visibleReceivables = Array.isArray(summary.receivables) ? summary.receivables.slice(0, 20) : null;
  const top20ReceivablesTry = !visibleReceivables || visibleReceivables.some(row => numberOrNull(row.balanceTry) === null)
    ? null : visibleReceivables.reduce((total, row) => total + Number(row.balanceTry), 0);
  const top20ReceivableShare = top20ReceivablesTry != null && patron.customerReceivablesTry != null && Number(patron.customerReceivablesTry) > 0
    ? (top20ReceivablesTry / Number(patron.customerReceivablesTry)) * 100 : null;

  return [
    { label: 'Toplam müşteri', value: formatNumber(masterCounts.totalCustomers), detail: 'Cari kart sayısı', tone: 'info', screenId: 'customer-list' },
    { label: 'Toplam ürün', value: formatNumber(masterCounts.totalProducts), detail: 'Stok kartı sayısı', tone: 'info', screenId: 'stock-list' },
    { label: 'Günlük net satış', value: formatMoney(summary.returnReporting?.known ? patron.todaySalesTry : null), detail: returnDetail(summary.returnReporting?.sales), tone: 'good', screenId: 'sales-invoice-list' },
    { label: 'Günlük net alış', value: formatMoney(summary.returnReporting?.known ? operations.todayPurchasesTry : null), detail: returnDetail(summary.returnReporting?.purchases), tone: 'info', screenId: 'purchase-invoice-list' },
    { label: 'İade sonrası brüt kâr', value: formatMoney(summary.returnReporting?.known ? patron.todayGrossProfitTry : null), detail: profitRate == null ? 'Brüt kâr oranı bilinmiyor' : `${formatNumber(profitRate)}% brüt oran`, tone: !summary.returnReporting?.known || grossProfitTry === null ? 'info' : grossProfitTry >= 0 ? 'good' : 'danger', screenId: 'sales-invoice-list' },
    { label: 'Açık hesap toplam', value: formatMoney(patron.customerReceivablesTry), detail: `${formatNumber(openAccountCustomerCount)} müşteri · değerleme ${formatDate(summary.balanceValuationDate)}`, tone: 'warn', screenId: 'customer-list' },
    { label: 'Eksi stok uyarısı', value: formatNumber(negativeStockCount), detail: 'Toplam uyarı · inceleme sayfa bazında', tone: negativeStockCount === null ? 'info' : negativeStockCount > 0 ? 'danger' : 'good', screenId: 'stock-list', payload: { stockState: 'negative' } },
    { label: 'İlk 20 alacak', value: formatMoney(top20ReceivablesTry), detail: top20ReceivableShare == null ? 'TRY yoğunluğu bilinmiyor' : `${formatNumber(top20ReceivableShare)}% yoğunluk`, tone: 'danger', screenId: 'customer-list' },
  ];
}

export function buildAccountingKpis(summary = emptyDashboardSummary) {
  const accounting = summary.accounting || {};
  const patron = summary.patron || {};
  const operations = summary.operations || {};
  const masterCounts = summary.masterCounts || {};

  return [
    { label: 'Toplam müşteri', value: formatNumber(masterCounts.totalCustomers), detail: 'Cari kart sayısı', tone: 'info', screenId: 'customer-list' },
    { label: 'Toplam ürün', value: formatNumber(masterCounts.totalProducts), detail: 'Stok kartı sayısı', tone: 'info', screenId: 'stock-list' },
    { label: 'Günlük tahsilat', value: formatMoney(accounting.todayCollectionsTry), detail: 'Tahsilat modülü', tone: 'info', screenId: 'collections-overview' },
    { label: 'Günlük ödeme', value: formatMoney(accounting.todayPaymentsTry), detail: 'Ödeme modülü', tone: 'info', screenId: 'collections-overview' },
    { label: 'Borçlu cari sayısı', value: formatNumber(accounting.customerBalanceCount), detail: `${formatMoney(patron.customerReceivablesTry)} toplam`, tone: 'warn', screenId: 'customer-list' },
    { label: 'Tedarikçi bakiye', value: formatNumber(accounting.supplierBalanceCount), detail: `${formatMoney(patron.supplierPayablesTry)} toplam`, tone: 'warn', screenId: 'supplier-list' },
    { label: 'Son satış fişleri', value: formatNumber(accounting.recentSalesInvoices?.length), detail: `${formatNumber(operations.salesDraftCount)} taslak açık`, tone: 'info', screenId: 'sales-invoice-list' },
    { label: 'Son alış fişleri', value: formatNumber(accounting.recentPurchaseInvoices?.length), detail: `${formatNumber(operations.purchaseDraftCount)} taslak açık`, tone: 'info', screenId: 'purchase-invoice-list' },
    { label: 'Bugünkü net satış', value: formatMoney(summary.returnReporting?.known ? patron.todaySalesTry : null), detail: returnDetail(summary.returnReporting?.sales), tone: 'good', screenId: 'sales-invoice-list' },
    { label: 'İade sonrası brüt kâr', value: formatMoney(summary.returnReporting?.known ? patron.todayGrossProfitTry : null), detail: 'Satış ve iade maliyet kayıtları', tone: 'good', screenId: 'sales-invoice-list' },
  ];
}

export function mapRecentTransactions(summary = emptyDashboardSummary) {
  const sales = summary.accounting?.recentSalesInvoices || [];
  const purchases = summary.accounting?.recentPurchaseInvoices || [];
  return [
    ...sales.map((row) => ({
      time: formatDateTime(row.createdAt),
      date: formatTransactionDate(row.createdAt),
      timestamp: new Date(row.createdAt).getTime() || 0,
      document: row.invoiceNo,
      account: row.customerName,
      type: 'Satış',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
    ...purchases.map((row) => ({
      time: formatDateTime(row.createdAt),
      date: formatTransactionDate(row.createdAt),
      timestamp: new Date(row.createdAt).getTime() || 0,
      document: row.invoiceNo,
      account: row.supplierName,
      type: 'Alış',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
  ].sort((first, second) => second.timestamp - first.timestamp).slice(0, 10);
}

export function mapTopProducts(summary = emptyDashboardSummary) {
  return (summary.topProducts || []).map((row) => ({
    code: row.stockCode,
    name: row.productName,
    quantity: row.quantity,
    sales: formatMoney(row.salesTry),
    stock: row.stockQuantity,
  }));
}

export function mapReceivables(summary = emptyDashboardSummary) {
  return (summary.receivables || []).map((row) => ({
    customer: row.customerName,
    balance: formatCardValuation(row),
    lastMove: formatDate(row.lastMove),
    risk: row.risk,
  }));
}

export function mapSupplierPerformance(summary = emptyDashboardSummary) {
  return (summary.countryPerformance || []).map((row) => ({
    id: row.country,
    country: row.country,
    sales: formatMoney(row.salesTry),
    receivable: formatMoney(row.receivableTry),
    customers: row.activeCustomers,
    note: row.note,
  }));
}

export function mapAlerts(alerts) {
  return (alerts || []).map((alert) => ({
    ...alert,
    value: typeof alert.value === 'number' ? formatNumber(alert.value) : alert.value,
  }));
}
