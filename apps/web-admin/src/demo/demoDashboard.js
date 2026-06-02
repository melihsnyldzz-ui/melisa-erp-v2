export const demoDashboardSummary = {
  patron: {
    todaySalesTry: 684000,
    finalizedSalesToday: 26,
    todayGrossProfitTry: 171000,
    totalStockValueTry: 12840000,
    customerReceivablesTry: 22400000,
    supplierPayablesTry: 3840000,
    negativeStockCount: 7,
    finalizedPurchasesToday: 4,
  },
  operations: {
    todayPurchasesTry: 612000,
    syncWarningCount: 3,
    salesDraftCount: 12,
    purchaseDraftCount: 5,
    whatsappRepliesToday: 73,
    whatsappOrdersToday: 18,
  },
  melisa: {
    todayProfitRate: 25,
    openAccountCustomerCount: 96,
    romaniaReceivablesTry: 11200000,
    romaniaSalesShare: 50,
    top20ReceivablesTry: 16800000,
    top20ReceivableShare: 75,
    overstockProductCount: 142,
  },
  masterCounts: {
    totalCustomers: 250,
    totalProducts: 4820,
  },
  accounting: {
    todayCollectionsTry: 185000,
    todayPaymentsTry: 94000,
    customerBalanceCount: 68,
    supplierBalanceCount: 14,
    recentSalesInvoices: [
      { createdAt: '2026-06-01T10:20:00', invoiceNo: 'SF-2026-0301', customerName: 'Bucharest Baby SRL', totalAmountTry: 126000, status: 'FINALIZED' },
      { createdAt: '2026-06-01T11:05:00', invoiceNo: 'SF-2026-0302', customerName: 'Balkan Kids Trade', totalAmountTry: 98500, status: 'FINALIZED' },
    ],
    recentPurchaseInvoices: [
      { createdAt: '2026-06-01T09:15:00', invoiceNo: 'AF-2026-0401', supplierName: 'Kardelen Bebe Üretim', totalAmountTry: 212000, status: 'DRAFT' },
    ],
  },
  countryPerformance: [
    { country: 'Romanya', salesTry: 342000, receivableTry: 11200000, activeCustomers: 48, note: '%50 satış / ana pazar' },
    { country: 'Bulgaristan', salesTry: 84000, receivableTry: 2460000, activeCustomers: 18, note: 'Balkan tekrar sipariş' },
    { country: 'Moldova', salesTry: 52000, receivableTry: 1280000, activeCustomers: 11, note: 'Romanya benzer sepet' },
    { country: 'Sırbistan', salesTry: 47000, receivableTry: 980000, activeCustomers: 9, note: 'Fiyat hassas' },
    { country: 'Kosova', salesTry: 39000, receivableTry: 760000, activeCustomers: 7, note: 'Küçük ama aktif' },
    { country: 'Gürcistan', salesTry: 31000, receivableTry: 640000, activeCustomers: 5, note: 'Kontrollü sevk' },
  ],
  topProducts: [
    { stockCode: 'STK-100245', productName: 'Zıbın Takımı 5 Parça', quantity: 180, salesTry: 51300, stockQuantity: 420 },
    { stockCode: 'STK-100318', productName: 'Kız Bebek Elbise Seti', quantity: 96, salesTry: 40320, stockQuantity: 118 },
    { stockCode: 'STK-100612', productName: 'Patikli Alt Üst Takım', quantity: 240, salesTry: 47520, stockQuantity: 760 },
    { stockCode: 'STK-100509', productName: 'Pamuk Battaniye', quantity: 54, salesTry: 29160, stockQuantity: -3 },
    { stockCode: 'STK-NEW-044', productName: 'Yeni Sezon Tulum', quantity: 72, salesTry: 36720, stockQuantity: 540 },
  ],
  receivables: [
    { customerName: 'Bucharest Baby SRL', balanceTry: 5820000, lastMove: '2026-06-01', risk: 'B' },
    { customerName: 'Romania Kids Depot', balanceTry: 3980000, lastMove: '2026-05-31', risk: 'B' },
    { customerName: 'Sofia Mini Wear', balanceTry: 2140000, lastMove: '2026-05-30', risk: 'C' },
    { customerName: 'Chisinau Baby Line', balanceTry: 1280000, lastMove: '2026-05-29', risk: 'B' },
    { customerName: 'Tbilisi Kids Market', balanceTry: 980000, lastMove: '2026-05-28', risk: 'C' },
  ],
  supplierPerformance: [
    { supplierId: 1, supplierName: 'Kardelen Bebe Üretim', debtTry: 1280000, lastPurchaseAt: '2026-06-01' },
    { supplierId: 2, supplierName: 'Bursa Örme Tekstil', debtTry: 940000, lastPurchaseAt: '2026-05-31' },
    { supplierId: 3, supplierName: 'Denizli Pamuk Aksesuar', debtTry: 620000, lastPurchaseAt: '2026-05-29' },
  ],
  melisaPanels: {
    whatsapp: [
      { id: 'wa-ro', group: 'Romanya VIP', plan: 'Yeni sezon 2-6 yaş', reply: '31 cevap / 9 aday', owner: 'Melih' },
      { id: 'wa-bg', group: 'Balkan Karma', plan: 'Çok satan takımlar', reply: '18 cevap / 4 aday', owner: 'Satış' },
      { id: 'wa-stock', group: 'Stok Eritme', plan: 'Battaniye + tulum', reply: '11 cevap / 3 aday', owner: 'Depo' },
    ],
    collections: [
      { id: 'col-1', customer: 'Bucharest Baby SRL', country: 'Romanya', amount: '$164K', action: 'Ödeme planı iste' },
      { id: 'col-2', customer: 'Sofia Mini Wear', country: 'Bulgaristan', amount: '$61K', action: 'Yeni sevk öncesi tahsilat' },
      { id: 'col-3', customer: 'Tbilisi Kids Market', country: 'Gürcistan', amount: '$28K', action: 'Kontrollü paylaşım' },
    ],
    productFocus: [
      { id: 'pf-1', product: 'STK-NEW-044 Tulum', type: 'Yeni gelen', stock: '540', country: 'Romanya' },
      { id: 'pf-2', product: 'STK-100245 Zıbın', type: 'Çok satan', stock: '420', country: 'Balkan' },
      { id: 'pf-3', product: 'STK-OLD-044 Tulum', type: 'Stokta fazla', stock: '710', country: 'Moldova' },
      { id: 'pf-4', product: 'STK-100509 Battaniye', type: 'Eksi stok', stock: '-3', country: 'Paylaşma' },
    ],
    topReceivableFocus: [
      { id: 'tr-1', customer: 'İlk 10 müşteri', share: '%52', risk: 'B/C', note: 'Alacağın yarısı burada' },
      { id: 'tr-2', customer: 'İlk 20 müşteri', share: '%75', risk: 'B', note: 'Günlük takip' },
      { id: 'tr-3', customer: 'Romanya ilk 8', share: '%41', risk: 'B', note: 'Satış durmaz, tahsilat takip' },
    ],
    countryOpportunities: [
      { id: 'co-1', country: 'Romanya', category: '2-6 yaş takım', reason: 'WhatsApp dönüşü yüksek' },
      { id: 'co-2', country: 'Bulgaristan', category: 'Pamuklu seri', reason: 'Bütçe uyumu' },
      { id: 'co-3', country: 'Moldova', category: 'Romanya benzeri', reason: 'Sepet benzerliği' },
      { id: 'co-4', country: 'Gürcistan', category: 'Düşük riskli stok', reason: 'Açık hesap kontrollü' },
    ],
  },
};

export const demoDashboardAlerts = [
  { id: 'alert-1', severity: 'danger', type: 'Tahsilat', subject: 'İlk 10 müşteri alacağın %52si', value: '$360K', owner: 'Patron' },
  { id: 'alert-2', severity: 'warn', type: 'Romanya', subject: 'Açık hesap 11.2M TRY', value: '%50', owner: 'Satış' },
  { id: 'alert-3', severity: 'info', type: 'WhatsApp', subject: 'Romanya VIP paylaşım bekliyor', value: 31, owner: 'Melih' },
  { id: 'alert-4', severity: 'danger', type: 'Stok', subject: 'Pamuk Battaniye eksiye düştü', value: 7, owner: 'Depo' },
  { id: 'alert-5', severity: 'warn', type: 'Müşteri', subject: 'Sofia Mini Wear C risk', value: '$61K', owner: 'Muhasebe' },
];

export function demoDashboardSummaryResponse() {
  return { success: true, data: demoDashboardSummary };
}

export function demoDashboardAlertsResponse() {
  return { success: true, data: demoDashboardAlerts };
}
