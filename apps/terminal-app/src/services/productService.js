import { apiRequest } from './apiClient';
import { findCachedProduct, findCachedProducts, saveProductCache } from './cacheService';
import { enqueueAction } from './queueService';
import { searchTerminalProducts } from './terminalSalesService';

function normalizeProduct(row) {
  return {
    id: row.id,
    stockCode: row.stockCode,
    barcodeMasked: row.barcodeMasked || row.barcode || row.matchedBarcode,
    matchedBarcode: row.matchedBarcode || row.barcode || row.barcodeMasked,
    productName: row.productName,
    brand: row.brand,
    category: row.category,
    currency: row.currency,
    salePrice: Number(row.salePrice || 0),
    stockQuantity: Number(row.stockQuantity || 0),
    isPassive: Boolean(row.isPassive),
  };
}

function extractProducts(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

export async function lookupProductByBarcode({ barcode, token }) {
  const trimmedBarcode = String(barcode || '').trim();

  if (!trimmedBarcode) {
    const error = new Error('Barkod bos olamaz');
    error.code = 'BARCODE_REQUIRED';
    throw error;
  }

  try {
    const response = await apiRequest(`/terminal/products/barcode/${encodeURIComponent(trimmedBarcode)}`, {
      token,
    });

    const products = [normalizeProduct(response.data)];
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
    let alternatives = [];

    try {
      const response = await searchTerminalProducts({
        q: trimmedBarcode,
        token,
        limit: 8,
      });
      alternatives = extractProducts(response).map(normalizeProduct);
      await saveProductCache(alternatives);
    } catch {
      alternatives = (await findCachedProducts(trimmedBarcode, 8)).map(normalizeProduct);
    }

    await enqueueAction({
      eventType: 'barcode_lookup',
      payload: {
        barcode: trimmedBarcode,
        errorCode: error.code || 'LOOKUP_FAILED',
        alternativeCount: alternatives.length,
      },
    });

    if (cachedProduct) {
      const normalizedCachedProduct = normalizeProduct(cachedProduct);
      return {
        source: 'cache',
        barcode: trimmedBarcode,
        products: [normalizedCachedProduct],
        selectedProduct: normalizedCachedProduct,
        alternatives,
        warning: 'API kapali, local cache sonucu gosteriliyor',
        searchedAt: new Date().toISOString(),
      };
    }

    error.alternatives = alternatives;
    error.lookupBarcode = trimmedBarcode;
    error.message = error.message || 'Urun bulunamadi';
    throw error;
  }
}
