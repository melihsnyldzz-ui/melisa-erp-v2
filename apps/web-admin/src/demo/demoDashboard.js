export const demoDashboardSummary = {
  patron: {
    todaySalesTry: 428500,
    finalizedSalesToday: 18,
    todayGrossProfitTry: 103250,
    totalStockValueTry: 12840000,
    customerReceivablesTry: 21950000,
    supplierPayablesTry: 3840000,
    negativeStockCount: 7,
    finalizedPurchasesToday: 4,
  },
  operations: {
    todayPurchasesTry: 612000,
    syncWarningCount: 3,
    salesDraftCount: 12,
    purchaseDraftCount: 5,
  },
  accounting: {
    todayCollectionsTry: 185000,
    todayPaymentsTry: 94000,
    customerBalanceCount: 68,
    supplierBalanceCount: 14,
    recentSalesInvoices: [
      { createdAt: '2026-05-31T10:20:00', invoiceNo: 'SF-DEMO-1001', customerName: 'Bucharest Baby SRL', totalAmountTry: 126000, status: 'FINALIZED' },
      { createdAt: '2026-05-31T11:05:00', invoiceNo: 'SF-DEMO-1002', customerName: 'Balkan Kids Trade', totalAmountTry: 98500, status: 'FINALIZED' },
    ],
    recentPurchaseInvoices: [
      { createdAt: '2026-05-31T09:15:00', invoiceNo: 'AF-DEMO-3001', supplierName: 'Kardelen Bebe Uretim', totalAmountTry: 212000, status: 'DRAFT' },
    ],
  },
  topProducts: [
    { stockCode: 'STK-100245', productName: 'Bebek Zibin Takimi 5 Parca', quantity: 180, salesTry: 51300, stockQuantity: 420 },
    { stockCode: 'STK-100318', productName: 'Kiz Bebek Elbise Seti', quantity: 96, salesTry: 40320, stockQuantity: 118 },
    { stockCode: 'STK-100612', productName: 'Patikli Alt Ust Takim', quantity: 240, salesTry: 47520, stockQuantity: 760 },
  ],
  receivables: [
    { customerName: 'Bucharest Baby SRL', balanceTry: 5820000, lastMove: '2026-05-29', risk: 'B' },
    { customerName: 'Sofia Mini Wear', balanceTry: 2140000, lastMove: '2026-05-24', risk: 'C' },
    { customerName: 'Tbilisi Kids Market', balanceTry: 980000, lastMove: '2026-05-18', risk: 'B' },
  ],
  supplierPerformance: [
    { supplierName: 'Kardelen Bebe Uretim', openPurchases: 3, finalizedPurchases: 12, debtTry: 840000 },
    { supplierName: 'Bursa Bebek', openPurchases: 2, finalizedPurchases: 8, debtTry: 420000 },
  ],
};

export const demoDashboardAlerts = [
  { id: 'alert-1', severity: 'danger', type: 'Eksi stok', subject: 'Pamuk Battaniye', value: 7, owner: 'Demo' },
  { id: 'alert-2', severity: 'warn', type: 'Riskli alacak', subject: 'Sofia Mini Wear', value: '2.1M TRY', owner: 'Demo' },
  { id: 'alert-3', severity: 'info', type: 'WhatsApp firsati', subject: 'Romanya paylasim listesi', value: 18, owner: 'Demo' },
];

export function demoDashboardSummaryResponse() {
  return { success: true, data: demoDashboardSummary };
}

export function demoDashboardAlertsResponse() {
  return { success: true, data: demoDashboardAlerts };
}
