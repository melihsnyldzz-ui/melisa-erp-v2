import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';
import { findCachedProduct, findCachedProducts, saveProductCache } from './cacheService';
import { enqueueAction } from './queueService';
import { searchTerminalProducts } from './terminalSalesService';

const recentProductsKey = 'terminalRecentProducts';

function normalizeProduct(row) {
  if (!row) {
    return null;
  }

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

async function readJson(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function getRecentProducts() {
  return readJson(recentProductsKey, []);
}

export async function rememberRecentProduct(product) {
  const normalized = normalizeProduct(product);
  if (!normalized?.id) return getRecentProducts();

  const current = await getRecentProducts();
  const next = [
    {
      ...normalized,
      rememberedAt: new Date().toISOString(),
    },
    ...current.filter((item) => String(item.id) !== String(normalized.id)),
  ].slice(0, 8);

  await AsyncStorage.setItem(recentProductsKey, JSON.stringify(next));
  return next;
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
    await rememberRecentProduct(products[0]);

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
      await rememberRecentProduct(normalizedCachedProduct);
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
