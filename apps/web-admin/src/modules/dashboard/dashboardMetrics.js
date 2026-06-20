export const periodLabels = {
  today: 'Bugün',
  week: 'Bu hafta',
  month: 'Bu ay',
};

export const emptyDashboardSummary = {
  patron: {},
  accounting: {
    recentSalesInvoices: [],
    recentPurchaseInvoices: [],
  },
  operations: {},
  melisa: {},
  masterCounts: {},
  topProducts: [],
  receivables: [],
  countryPerformance: [],
  melisaPanels: {},
};

function formatMoney(amount) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export function buildPatronKpis(summary = emptyDashboardSummary) {
  const patron = summary.patron || {};
  const operations = summary.operations || {};
  const melisa = summary.melisa || {};
  const masterCounts = summary.masterCounts || {};

  return [
    { label: 'Toplam müşteri', value: formatNumber(masterCounts.totalCustomers), detail: 'Cari kart sayısı', tone: 'info', screenId: 'customer-list' },
    { label: 'Toplam ürün', value: formatNumber(masterCounts.totalProducts), detail: 'Aktif barkodlu ürünler', tone: 'info', screenId: 'stock-list' },
    { label: 'Günlük satış', value: formatMoney(patron.todaySalesTry), detail: `${formatNumber(patron.finalizedSalesToday)} kesinleşen fiş`, tone: 'good', screenId: 'sales-invoice-list' },
    { label: 'Günlük kâr', value: formatMoney(patron.todayGrossProfitTry), detail: `${formatNumber(melisa.todayProfitRate || 0)}% brüt oran`, tone: Number(patron.todayGrossProfitTry || 0) >= 0 ? 'good' : 'danger', screenId: 'sales-invoice-list' },
    { label: 'Açık hesap toplam', value: formatMoney(patron.customerReceivablesTry), detail: `${formatNumber(melisa.openAccountCustomerCount || 0)} müşteri`, tone: 'warn', screenId: 'customer-list' },
    { label: 'Romanya açık hesap', value: formatMoney(melisa.romaniaReceivablesTry), detail: `${formatNumber(melisa.romaniaSalesShare || 0)}% satış payı`, tone: 'warn', screenId: 'customer-list' },
    { label: 'Eksi stok uyarısı', value: formatNumber(patron.negativeStockCount), detail: 'Stok sıfırın altında', tone: Number(patron.negativeStockCount || 0) > 0 ? 'danger' : 'good', screenId: 'stock-list' },
    { label: 'WhatsApp dönüşleri', value: formatNumber(operations.whatsappRepliesToday), detail: `${formatNumber(operations.whatsappOrdersToday)} sipariş adayı`, tone: 'info', screenId: 'catalog-list' },
    { label: 'İlk 20 alacak', value: formatMoney(melisa.top20ReceivablesTry), detail: `${formatNumber(melisa.top20ReceivableShare || 0)}% yoğunluk`, tone: 'danger', screenId: 'customer-list' },
    { label: 'Stokta fazla', value: formatNumber(melisa.overstockProductCount), detail: 'Paylaşım/kampanya adayı', tone: 'info', screenId: 'stock-list' },
  ];
}

export function buildAccountingKpis(summary = emptyDashboardSummary) {
  const accounting = summary.accounting || {};
  const patron = summary.patron || {};
  const operations = summary.operations || {};
  const masterCounts = summary.masterCounts || {};

  return [
    { label: 'Toplam müşteri', value: formatNumber(masterCounts.totalCustomers), detail: 'Cari kart sayısı', tone: 'info', screenId: 'customer-list' },
    { label: 'Toplam ürün', value: formatNumber(masterCounts.totalProducts), detail: 'Aktif barkodlu ürünler', tone: 'info', screenId: 'stock-list' },
    { label: 'Günlük tahsilat', value: formatMoney(accounting.todayCollectionsTry), detail: 'Tahsilat modülü', tone: 'info', screenId: 'collections-overview' },
    { label: 'Günlük ödeme', value: formatMoney(accounting.todayPaymentsTry), detail: 'Ödeme modülü', tone: 'info', screenId: 'collections-overview' },
    { label: 'Borçlu cari sayısı', value: formatNumber(accounting.customerBalanceCount), detail: `${formatMoney(patron.customerReceivablesTry)} toplam`, tone: 'warn', screenId: 'customer-list' },
    { label: 'Tedarikçi bakiye', value: formatNumber(accounting.supplierBalanceCount), detail: `${formatMoney(patron.supplierPayablesTry)} toplam`, tone: 'warn', screenId: 'supplier-list' },
    { label: 'Son satış fişleri', value: formatNumber(accounting.recentSalesInvoices.length), detail: `${formatNumber(operations.salesDraftCount)} taslak açık`, tone: 'info', screenId: 'sales-invoice-list' },
    { label: 'Son alış fişleri', value: formatNumber(accounting.recentPurchaseInvoices.length), detail: `${formatNumber(operations.purchaseDraftCount)} taslak açık`, tone: 'info', screenId: 'purchase-invoice-list' },
    { label: 'Bugünkü toplam satış', value: formatMoney(patron.todaySalesTry), detail: 'Kesinleşen satış', tone: 'good', screenId: 'sales-invoice-list' },
    { label: 'Brüt kâr snapshot', value: formatMoney(patron.todayGrossProfitTry), detail: 'Satış satırı maliyet izi', tone: 'good', screenId: 'sales-invoice-list' },
  ];
}

export function mapRecentTransactions(summary = emptyDashboardSummary) {
  const sales = summary.accounting.recentSalesInvoices || [];
  const purchases = summary.accounting.recentPurchaseInvoices || [];
  return [
    ...sales.map((row) => ({
      time: formatDateTime(row.createdAt),
      document: row.invoiceNo,
      account: row.customerName,
      type: 'Satış',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
    ...purchases.map((row) => ({
      time: formatDateTime(row.createdAt),
      document: row.invoiceNo,
      account: row.supplierName,
      type: 'Alış',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
  ].sort((first, second) => String(second.time).localeCompare(String(first.time))).slice(0, 10);
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
    balance: formatMoney(row.balanceTry),
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
