import { resolveCustomerSelection } from './customerSelection.js';
import { normalizeSearchText } from './searchText.js';

export function supplierSelectionLabel(supplier) {
  return `${supplier.supplierCode || supplier.code || supplier.id} / ${supplier.supplierName || supplier.name || ''}`;
}

export function resolveSupplierSelection(suppliers, query) {
  const resolved = resolveCustomerSelection(suppliers.map((supplier) => ({
    ...supplier,
    code: supplier.supplierCode || supplier.code || String(supplier.id),
    name: supplier.supplierName || supplier.name || '',
  })), query);
  return resolved ? suppliers.find((supplier) => String(supplier.id) === String(resolved.id)) : null;
}

export function clearInvoiceSupplierSelection(invoice) {
  return { ...invoice, supplierId: '', supplier: '', supplierCurrency: '-', supplierBalanceLabel: '-', supplierDiscountRate: 0 };
}

// A product's main supplier is a card default. The invoice records the actual seller.
export function purchaseProductAvailable(product, supplierId, dailyMode = false) {
  return Boolean(supplierId) && !product.isPassive
    && (dailyMode || String(product.supplierId || '') === String(supplierId));
}

export function resolvePurchaseProduct(products, query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return null;
  const matches = new Map();
  for (const product of products) {
    if ([product.stockCode, product.barcode, product.matchedBarcode, product.productName, `${product.stockCode} / ${product.productName}`]
      .some((value) => normalizeSearchText(value) === normalized)) matches.set(String(product.productId), product);
  }
  return matches.size === 1 ? matches.values().next().value : null;
}

export function purchaseFinalizeBlock({ draftId, supplierId, isDirty, isSaving }) {
  if (isSaving) return 'Alış taslağının kaydı tamamlanana kadar bekleyin.';
  if (!supplierId) return 'Kesinleştirmek için tedarikçiyi açıkça seçin.';
  if (!draftId || isDirty) return 'Kesinleştirmeden önce ekrandaki alış taslağını kaydedin.';
  return '';
}
