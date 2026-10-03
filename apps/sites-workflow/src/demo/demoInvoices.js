import { demoList, demoDetail, matchesDemoRow } from './demoReadModel.js';
import { demoCashCustomers, demoCustomers } from './demoCustomers.js';
const salesDraftItems = [
  { id: 1, productId: 101, stockCode: 'STK-100245', barcode: '8690001002451', productName: 'Bebek Zıbın Takımı 5 Parça', quantity: 18, currency: 'TRY', unitPrice: 285, stockStatus: 'Yeterli', note: 'Demo koli sevki', averageCostTry: 164, grossProfitTry: null, grossProfitRate: null },
  { id: 2, productId: 102, stockCode: 'STK-100318', barcode: '8690001003182', productName: 'Kız Bebek Elbise Seti', quantity: 12, currency: 'TRY', unitPrice: 420, stockStatus: 'Düşük stok', note: 'Demo renkleri karışık', averageCostTry: 248, grossProfitTry: null, grossProfitRate: null },
];

const purchaseDraftItems = [
  { id: 1, productId: 101, stockCode: 'STK-100245', barcode: '8690001002451', productName: 'Bebek Zıbın Takımı 5 Parça', quantity: 60, currency: 'TRY', purchasePrice: 162, lineDiscountRate: 4, stockEffect: '+60 demo', note: 'Demo alış kaydı' },
  { id: 2, productId: 103, stockCode: 'STK-100509', barcode: '8690001005094', productName: 'Pamuk Battaniye', quantity: 24, currency: 'TRY', purchasePrice: 368, lineDiscountRate: 5, stockEffect: '+24 demo', note: 'Demo ortalama maliyet bilgisi yok' },
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
  description: 'Sentetik demo satış fişi; şirket verisi değildir ve kaydedilmez.',
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
  supplierName: 'Kardelen Bebe Üretim',
  supplierCurrency: 'TRY',
  documentCurrency: 'TRY',
  currency: 'TRY',
  exchangeRate: 1,
  description: 'Sentetik demo alış fişi; şirket verisi değildir ve kaydedilmez.',
  invoiceDiscountRate: 3,
  supplierDiscountRate: 2,
  status: 'DRAFT',
  totalAmount: 18552,
  itemCount: purchaseDraftItems.length,
  createdAt: '2026-05-31T09:00:00',
  updatedAt: '2026-05-31T09:40:00',
  items: purchaseDraftItems,
};

const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
function withSalesTotals(draft) {
  const items = draft.items.map(item => ({ ...item, unit: 'adet', unitState: 'RECORDED', unitMultiplier: 1, unitPrice: Number(item.unitPrice), lineTotal: money(Number(item.quantity) * Number(item.unitPrice)) }));
  const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = money(subtotal * Number(draft.discountRate || 0) / 100);
  const grandTotal = money(subtotal - discountAmount);
  return { ...draft, items, subtotal, discountAmount, grandTotal, totalAmount: grandTotal, itemCount: items.length };
}
function withPurchaseTotals(draft) {
  const items = draft.items.map(item => ({ ...item, unit: 'adet', unitState: 'RECORDED', unitMultiplier: 1, unitPrice: Number(item.purchasePrice),
    lineTotal: money(Number(item.quantity) * Number(item.purchasePrice) * (1 - Number(item.lineDiscountRate || 0) / 100)) }));
  const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const invoiceDiscount = money(subtotal * Number(draft.invoiceDiscountRate || 0) / 100);
  const supplierDiscount = money((subtotal - invoiceDiscount) * Number(draft.supplierDiscountRate || 0) / 100);
  const discountAmount = money(invoiceDiscount + supplierDiscount);
  const grandTotal = money(subtotal - discountAmount);
  return { ...draft, items, subtotal, discountAmount, grandTotal, totalAmount: grandTotal, itemCount: items.length };
}
export function demoInvoiceRows(kind) {
  return [kind === 'sales' ? withSalesTotals(salesDraft) : withPurchaseTotals(purchaseDraft)];
}
function invoiceList(kind, params) {
  return demoList(demoInvoiceRows(kind).filter(row => matchesDemoRow(row, params, ['invoiceNo', 'documentNo', 'customerName', 'supplierName'])), params);
}
export function demoSalesDraftsResponse(params = {}) { return invoiceList('sales', params); }
export function demoSalesInvoiceResponse(id = salesDraft.id) { return demoDetail(demoInvoiceRows('sales'), id); }

export function demoSalesDraftWriteResponse(payload = {}, id = salesDraft.id) {
  const customer = [...demoCustomers, ...demoCashCustomers]
    .find(item => String(item.id) === String(payload.customerId));
  return {
    success: true,
    message: 'Demo işlemi kaydedilmedi; gerçek satış, stok veya cari kaydı değiştirilmedi.',
    data: withSalesTotals({
      ...salesDraft,
      ...payload,
      id: Number(id) || salesDraft.id,
      documentNo: payload.documentNo || salesDraft.documentNo,
      customerName: payload.customerName || customer?.customerName || salesDraft.customerName,
      items: payload.items || salesDraft.items,
      status: 'DRAFT',
    }),
  };
}

export function demoPurchaseDraftsResponse(params = {}) { return invoiceList('purchase', params); }
export function demoPurchaseInvoiceResponse(id = purchaseDraft.id) { return demoDetail(demoInvoiceRows('purchase'), id); }

export function demoPurchaseDraftWriteResponse(payload = {}, id = purchaseDraft.id) {
  return {
    success: true,
    message: 'Demo işlemi kaydedilmedi; gerçek alış, stok veya tedarikçi kaydı değiştirilmedi.',
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
