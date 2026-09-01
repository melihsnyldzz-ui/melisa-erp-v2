import { demoProductsResponse } from './demoProducts.js';
import { normalizeSearchText } from '../utils/searchText.js';

const sourceMeta = {
  source: 'synthetic-demo-read-only',
  synthetic: true,
  readOnly: true,
  writePerformed: false,
};

function isoDay(dayOffset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + dayOffset);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function line(id, stockCode, productName, quantity, unitPrice, currency) {
  return {
    id,
    stockCode,
    productName,
    barcode: `DEMO-BARKOD-${String(id).padStart(3, '0')}`,
    quantity,
    unitName: 'Adet',
    unitPrice,
    lineTotal: Number(quantity) * Number(unitPrice),
    currency,
    synthetic: true,
  };
}

function documentWithTotals(document) {
  const totalQuantity = document.lines.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const totalAmount = document.lines.reduce((total, item) => total + Number(item.lineTotal || 0), 0);

  return {
    ...document,
    itemCount: document.lines.length,
    lineCount: document.lines.length,
    totalQuantity,
    totalAmount,
    synthetic: true,
    readOnly: true,
  };
}

const salesDocuments = [
  documentWithTotals({
    id: 'DEMO-SALES-001',
    sourceId: 'DEMO-SALES-001',
    customerSourceId: 'DEMO-CUSTOMER-001',
    documentNo: 'SENTETIK-SF-001',
    documentDate: isoDay(0),
    customerCode: 'DEMO-MUSTERI-001',
    customerName: 'Örnek Berlin Bebek Mağazası',
    currency: 'EUR',
    exchangeRate: 52.4,
    lines: [
      line(1, 'DEMO-STK-001', 'Sentetik Örnek Zıbın Takımı', 24, 12.5, 'EUR'),
      line(2, 'DEMO-STK-002', 'Sentetik Örnek Bebek Seti', 12, 18, 'EUR'),
    ],
  }),
  documentWithTotals({
    id: 'DEMO-SALES-002',
    sourceId: 'DEMO-SALES-002',
    customerSourceId: 'DEMO-CUSTOMER-002',
    documentNo: 'SENTETIK-SF-002',
    documentDate: isoDay(-1),
    customerCode: 'DEMO-MUSTERI-002',
    customerName: 'Örnek İstanbul Mağazası',
    currency: 'TRY',
    exchangeRate: 1,
    lines: [
      line(3, 'DEMO-STK-003', 'Sentetik Örnek Pamuk Battaniye', 30, 540, 'TRY'),
    ],
  }),
  documentWithTotals({
    id: 'DEMO-SALES-003',
    sourceId: 'DEMO-SALES-003',
    customerSourceId: 'DEMO-CUSTOMER-003',
    documentNo: 'SENTETIK-SF-003',
    documentDate: isoDay(-2),
    customerCode: 'DEMO-MUSTERI-003',
    customerName: 'Örnek Balkan Bebek Mağazası',
    currency: 'USD',
    exchangeRate: 44.9,
    lines: [
      line(4, 'DEMO-STK-004', 'Sentetik Örnek Tulum', 16, 15, 'USD'),
      line(5, 'DEMO-STK-005', 'Sentetik Örnek Şapka', 20, 4.5, 'USD'),
    ],
  }),
];

const purchaseDocuments = [
  documentWithTotals({
    id: 'DEMO-PURCHASE-001',
    sourceId: 'DEMO-PURCHASE-001',
    supplierSourceId: 'DEMO-SUPPLIER-001',
    documentNo: 'SENTETIK-AF-001',
    documentDate: isoDay(0),
    supplierCode: 'DEMO-TEDARIKCI-001',
    supplierName: 'Örnek Bursa Üretim',
    currency: 'TRY',
    exchangeRate: 1,
    lines: [
      line(11, 'DEMO-STK-001', 'Sentetik Örnek Zıbın Takımı', 60, 162, 'TRY'),
      line(12, 'DEMO-STK-003', 'Sentetik Örnek Pamuk Battaniye', 24, 368, 'TRY'),
    ],
  }),
  documentWithTotals({
    id: 'DEMO-PURCHASE-002',
    sourceId: 'DEMO-PURCHASE-002',
    supplierSourceId: 'DEMO-SUPPLIER-002',
    documentNo: 'SENTETIK-AF-002',
    documentDate: isoDay(0),
    supplierCode: 'DEMO-TEDARIKCI-002',
    supplierName: 'Örnek Avrupa Tekstil',
    currency: 'EUR',
    exchangeRate: 52.4,
    lines: [
      line(13, 'DEMO-STK-006', 'Sentetik Örnek Organik Kumaş', 100, 5.2, 'EUR'),
    ],
  }),
  documentWithTotals({
    id: 'DEMO-PURCHASE-003',
    sourceId: 'DEMO-PURCHASE-003',
    supplierSourceId: 'DEMO-SUPPLIER-003',
    documentNo: 'SENTETIK-AF-003',
    documentDate: isoDay(0),
    supplierCode: 'DEMO-TEDARIKCI-003',
    supplierName: 'Örnek Aksesuar Tedarikçisi',
    currency: 'USD',
    exchangeRate: 44.9,
    lines: [
      line(14, 'DEMO-STK-007', 'Sentetik Örnek Çıtçıt Paketi', 200, 0.35, 'USD'),
    ],
  }),
];

function filteredDocuments(documents, params, partyCodeKey, partyNameKey) {
  const query = normalizeSearchText(params.search || '');
  const currency = String(params.currency || 'ALL').toUpperCase();
  const amountMin = params.amountMin === '' || params.amountMin == null ? null : Number(params.amountMin);
  const amountMax = params.amountMax === '' || params.amountMax == null ? null : Number(params.amountMax);
  const requestedPartyCode = normalizeSearchText(params.customerCode || params.supplierCode || '');

  return documents.filter((document) => {
    const searchValues = [
      document.documentNo,
      document[partyCodeKey],
      document[partyNameKey],
      ...document.lines.flatMap((item) => [item.stockCode, item.productName, item.barcode]),
    ];
    const matchesSearch = !query || searchValues.some((value) => normalizeSearchText(value).includes(query));
    const matchesDateFrom = !params.dateFrom || document.documentDate >= params.dateFrom;
    const matchesDateTo = !params.dateTo || document.documentDate <= params.dateTo;
    const matchesCurrency = currency === 'ALL' || document.currency === currency;
    const matchesMin = amountMin == null || document.totalAmount >= amountMin;
    const matchesMax = amountMax == null || document.totalAmount <= amountMax;
    const matchesParty = !requestedPartyCode || normalizeSearchText(document[partyCodeKey]) === requestedPartyCode;
    return matchesSearch && matchesDateFrom && matchesDateTo && matchesCurrency && matchesMin && matchesMax && matchesParty;
  });
}

function listResponse(documents, params = {}) {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.max(1, Number(params.limit || documents.length));
  const start = (page - 1) * limit;
  const data = documents.slice(start, start + limit).map(({ lines, ...document }) => document);

  return {
    success: true,
    data,
    meta: { ...sourceMeta, page, limit, total: documents.length },
  };
}

export function demoVegaProductsResponse(params = {}) {
  const baseProducts = demoProductsResponse({ ...params, search: '' }).data;
  const query = normalizeSearchText(params.search || '');
  const barcodeQuery = normalizeSearchText(params.barcode || '');
  const transformed = baseProducts.map((product, index) => ({
    ...product,
    sourceId: `DEMO-PRODUCT-${String(index + 1).padStart(3, '0')}`,
    stockCode: `DEMO-STK-${String(index + 1).padStart(3, '0')}`,
    productName: `Sentetik Örnek — ${product.productName}`,
    supplierName: `Örnek — ${product.supplierName}`,
    synthetic: true,
    readOnly: true,
  })).filter((product) => {
    const values = [product.stockCode, product.productName, product.brand, product.category, product.supplierName, product.barcodeMasked];
    const matchesSearch = !query || values.some((value) => normalizeSearchText(value).includes(query));
    const matchesBarcode = !barcodeQuery || normalizeSearchText(product.barcodeMasked).includes(barcodeQuery);
    return matchesSearch && matchesBarcode;
  });
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.max(1, Number(params.limit || transformed.length));
  const start = (page - 1) * limit;

  return {
    success: true,
    data: transformed.slice(start, start + limit),
    meta: { ...sourceMeta, page, limit, total: transformed.length },
  };
}

export function demoVegaSalesStockExitsResponse(params = {}) {
  const filtered = filteredDocuments(salesDocuments, params, 'customerCode', 'customerName');
  return listResponse(filtered, params);
}

export function demoVegaSalesDocumentResponse(customerSourceId, movementSourceId) {
  const document = salesDocuments.find((item) => String(item.sourceId) === String(movementSourceId)
    && (!customerSourceId || String(item.customerSourceId) === String(customerSourceId)));
  return { success: true, data: document || null, meta: sourceMeta };
}

export function demoVegaPurchaseInvoicesResponse(params = {}) {
  const filtered = filteredDocuments(purchaseDocuments, params, 'supplierCode', 'supplierName');
  return listResponse(filtered, params);
}

export function demoVegaPurchaseDocumentResponse(supplierSourceId, movementSourceId) {
  const document = purchaseDocuments.find((item) => String(item.sourceId) === String(movementSourceId)
    && (!supplierSourceId || String(item.supplierSourceId) === String(supplierSourceId)));
  return { success: true, data: document || null, meta: sourceMeta };
}
