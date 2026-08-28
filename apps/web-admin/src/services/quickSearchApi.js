import { fetchCustomers } from './customerApi.js';
import { fetchSalesDrafts, fetchPurchaseDrafts } from './invoiceDraftApi.js';
import { fetchProducts } from './productApi.js';
import { fetchSuppliers } from './supplierApi.js';

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

const sourceDefinitions = [
  {
    key: 'products',
    load: (query) => fetchProducts({ page: 1, limit: 6, search: query, activeOnly: false }),
    map: (row) => ({
      id: `product-${row.id}`,
      kind: 'product',
      typeLabel: 'Ürün',
      label: row.productName || row.stockCode || 'İsimsiz ürün',
      hint: [row.stockCode, row.barcodeMasked || row.matchedBarcode, row.brand].filter(Boolean).join(' · '),
      screenId: 'product-card',
      payload: { productId: row.id, stockCode: row.stockCode },
    }),
  },
  {
    key: 'customers',
    load: (query) => fetchCustomers({ page: 1, limit: 5, search: query, activeOnly: false }),
    map: (row) => ({
      id: `customer-${row.id}`,
      kind: 'customer',
      typeLabel: 'Müşteri',
      label: row.customerName || row.customerCode || 'İsimsiz müşteri',
      hint: [row.customerCode, row.phoneMasked, row.city].filter(Boolean).join(' · '),
      screenId: 'customer-card',
      payload: { customerId: row.id, customerCode: row.customerCode },
    }),
  },
  {
    key: 'suppliers',
    load: (query) => fetchSuppliers({ page: 1, limit: 5, search: query, activeOnly: false }),
    map: (row) => ({
      id: `supplier-${row.id}`,
      kind: 'supplier',
      typeLabel: 'Tedarikçi',
      label: row.supplierName || row.supplierCode || 'İsimsiz tedarikçi',
      hint: [row.supplierCode, row.phoneMasked, row.city].filter(Boolean).join(' · '),
      screenId: 'supplier-card',
      payload: { supplierId: row.id, supplierCode: row.supplierCode },
    }),
  },
  {
    key: 'salesInvoices',
    load: (query) => fetchSalesDrafts({ page: 1, limit: 5, search: query, status: 'ALL' }),
    map: (row) => ({
      id: `sales-invoice-${row.id}`,
      kind: 'sales-invoice',
      typeLabel: 'Satış fişi',
      label: row.invoiceNo || `Satış fişi #${row.id}`,
      hint: [row.customerName, formatDate(row.documentDate), row.status].filter(Boolean).join(' · '),
      screenId: 'sales-invoice',
      payload: { salesDraftId: row.id, invoiceNo: row.invoiceNo },
    }),
  },
  {
    key: 'purchaseInvoices',
    load: (query) => fetchPurchaseDrafts({ page: 1, limit: 5, search: query, status: 'ALL' }),
    map: (row) => ({
      id: `purchase-invoice-${row.id}`,
      kind: 'purchase-invoice',
      typeLabel: 'Alış fişi',
      label: row.invoiceNo || `Alış fişi #${row.id}`,
      hint: [row.supplierName, formatDate(row.documentDate), row.status].filter(Boolean).join(' · '),
      screenId: 'purchase-invoice',
      payload: { purchaseDraftId: row.id, invoiceNo: row.invoiceNo },
    }),
  },
];

export async function searchErpRecords(query) {
  const trimmedQuery = String(query || '').trim();
  if (trimmedQuery.length < 2) {
    return { results: [], failedSources: [] };
  }

  const settled = await Promise.allSettled(
    sourceDefinitions.map((source) => source.load(trimmedQuery)),
  );
  const results = [];
  const failedSources = [];

  settled.forEach((result, index) => {
    const source = sourceDefinitions[index];
    if (result.status === 'rejected') {
      failedSources.push(source.key);
      return;
    }

    (result.value?.data || []).forEach((row) => results.push(source.map(row)));
  });

  return { results, failedSources };
}
