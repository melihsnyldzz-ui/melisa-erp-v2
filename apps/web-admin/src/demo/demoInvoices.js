const salesDraftItems = [
  { id: 1, productId: 101, stockCode: 'STK-100245', barcode: '8690001002451', productName: 'Bebek Zibin Takimi 5 Parca', quantity: 18, currency: 'TRY', unitPrice: 285, stockStatus: 'Yeterli', note: 'Demo koli sevk', averageCostTry: 164, grossProfitTry: null, grossProfitRate: null },
  { id: 2, productId: 102, stockCode: 'STK-100318', barcode: '8690001003182', productName: 'Kiz Bebek Elbise Seti', quantity: 12, currency: 'TRY', unitPrice: 420, stockStatus: 'Dusuk stok', note: 'Demo renk karisik', averageCostTry: 248, grossProfitTry: null, grossProfitRate: null },
];

const purchaseDraftItems = [
  { id: 1, productId: 101, stockCode: 'STK-100245', barcode: '8690001002451', productName: 'Bebek Zibin Takimi 5 Parca', quantity: 60, currency: 'TRY', purchasePrice: 162, lineDiscountRate: 4, stockEffect: '+60 demo', note: 'Demo alim' },
  { id: 2, productId: 103, stockCode: 'STK-100509', barcode: '8690001005094', productName: 'Pamuk Battaniye', quantity: 24, currency: 'TRY', purchasePrice: 368, lineDiscountRate: 5, stockEffect: '+24 demo', note: 'Demo average cost yok' },
];

const salesDraft = {
  id: 301,
  documentNo: 'SF-DEMO-0301',
  invoiceNo: 'SF-DEMO-0301',
  documentDate: '2026-05-31',
  customerId: 201,
  customerName: 'Bucharest Baby SRL',
  customerCurrency: 'USD',
  documentCurrency: 'TRY',
  currency: 'TRY',
  exchangeRate: 1,
  description: 'Demo satis fisi. Demo islem kaydedilmedi.',
  discountRate: 7,
  status: 'DRAFT',
  totalAmount: 9420,
  itemCount: salesDraftItems.length,
  createdAt: '2026-05-31T10:00:00',
  updatedAt: '2026-05-31T10:30:00',
  items: salesDraftItems,
};

const purchaseDraft = {
  id: 401,
  documentNo: 'AF-DEMO-0401',
  invoiceNo: 'AF-DEMO-0401',
  documentDate: '2026-05-31',
  supplierId: 501,
  supplierName: 'Kardelen Bebe Uretim',
  supplierCurrency: 'TRY',
  documentCurrency: 'TRY',
  currency: 'TRY',
  exchangeRate: 1,
  description: 'Demo alis fisi. Demo islem kaydedilmedi.',
  invoiceDiscountRate: 3,
  supplierDiscountRate: 2,
  status: 'DRAFT',
  totalAmount: 18552,
  itemCount: purchaseDraftItems.length,
  createdAt: '2026-05-31T09:00:00',
  updatedAt: '2026-05-31T09:40:00',
  items: purchaseDraftItems,
};

function withSalesTotals(draft) {
  const totalAmount = draft.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  return { ...draft, totalAmount, itemCount: draft.items.length };
}

function withPurchaseTotals(draft) {
  const totalAmount = draft.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.purchasePrice || 0), 0);
  return { ...draft, totalAmount, itemCount: draft.items.length };
}

export function demoSalesDraftsResponse() {
  const data = [withSalesTotals(salesDraft)];
  return { success: true, data, meta: { page: 1, limit: data.length, total: data.length } };
}

export function demoSalesInvoiceResponse(id = salesDraft.id) {
  return { success: true, data: { ...withSalesTotals(salesDraft), id: Number(id) || salesDraft.id } };
}

export function demoSalesDraftWriteResponse(payload = {}, id = salesDraft.id) {
  return {
    success: true,
    message: 'Demo islem kaydedilmedi.',
    data: withSalesTotals({
      ...salesDraft,
      ...payload,
      id: Number(id) || salesDraft.id,
      documentNo: payload.documentNo || salesDraft.documentNo,
      items: payload.items || salesDraft.items,
      status: 'DRAFT',
    }),
  };
}

export function demoPurchaseDraftsResponse() {
  const data = [withPurchaseTotals(purchaseDraft)];
  return { success: true, data, meta: { page: 1, limit: data.length, total: data.length } };
}

export function demoPurchaseInvoiceResponse(id = purchaseDraft.id) {
  return { success: true, data: { ...withPurchaseTotals(purchaseDraft), id: Number(id) || purchaseDraft.id } };
}

export function demoPurchaseDraftWriteResponse(payload = {}, id = purchaseDraft.id) {
  return {
    success: true,
    message: 'Demo islem kaydedilmedi.',
    data: withPurchaseTotals({
      ...purchaseDraft,
      ...payload,
      id: Number(id) || purchaseDraft.id,
      documentNo: payload.documentNo || purchaseDraft.documentNo,
      items: payload.items || purchaseDraft.items,
      status: 'DRAFT',
    }),
  };
}
