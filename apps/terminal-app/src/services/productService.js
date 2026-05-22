import { apiRequest } from './apiClient';
import { findCachedProduct, saveProductCache } from './cacheService';
import { enqueueAction } from './queueService';

function normalizeProduct(row) {
  return {
    id: row.id,
    stockCode: row.stockCode,
    barcodeMasked: row.barcodeMasked,
    productName: row.productName,
    brand: row.brand,
    category: row.category,
    currency: row.currency,
    salePrice: Number(row.salePrice || 0),
    stockQuantity: Number(row.stockQuantity || 0),
    isPassive: Boolean(row.isPassive),
  };
}

export async function lookupProductByBarcode({ barcode, token }) {
  const trimmedBarcode = String(barcode || '').trim();

  if (!trimmedBarcode) {
    const error = new Error('Barkod bos olamaz');
    error.code = 'BARCODE_REQUIRED';
    throw error;
  }

  try {
    const response = await apiRequest(`/products?search=${encodeURIComponent(trimmedBarcode)}&page=1&limit=20&activeOnly=false`, {
      token,
    });

    const products = (response.data || []).map(normalizeProduct);
    await saveProductCache(products);

    return {
      source: 'api',
      barcode: trimmedBarcode,
      products,
      selectedProduct: products[0] || null,
      searchedAt: new Date().toISOString(),
    };
  } catch (error) {
    const cachedProduct = await findCachedProduct(trimmedBarcode);
    await enqueueAction({
      eventType: 'barcode_lookup',
      payload: {
        barcode: trimmedBarcode,
        errorCode: error.code || 'LOOKUP_FAILED',
      },
    });

    if (cachedProduct) {
      return {
        source: 'cache',
        barcode: trimmedBarcode,
        products: [cachedProduct],
        selectedProduct: cachedProduct,
        warning: 'API kapali, local cache sonucu gosteriliyor',
        searchedAt: new Date().toISOString(),
      };
    }

    error.message = error.message || 'Urun bulunamadi';
    throw error;
  }
}
