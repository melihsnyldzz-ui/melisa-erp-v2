import AsyncStorage from '@react-native-async-storage/async-storage';

const productCacheKey = 'terminalProductCache';
const customerCacheKey = 'terminalCustomerCache';
const cacheMetaKey = 'terminalCacheMeta';

async function readJson(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function saveProductCache(products = []) {
  const existing = await readJson(productCacheKey, {});
  const next = { ...existing };

  products.forEach((product) => {
    next[String(product.id)] = {
      ...product,
      cachedAt: new Date().toISOString(),
    };
  });

  await writeJson(productCacheKey, next);
}

export async function replaceProductCache(products = []) {
  const next = {};

  products.forEach((product) => {
    next[String(product.id)] = {
      ...product,
      cachedAt: new Date().toISOString(),
    };
  });

  await writeJson(productCacheKey, next);
}

export async function findCachedProduct(query) {
  const normalized = String(query || '').trim().toLocaleLowerCase('tr-TR');
  const cache = await readJson(productCacheKey, {});

  return Object.values(cache).find((product) => (
    String(product.stockCode || '').toLocaleLowerCase('tr-TR').includes(normalized)
    || String(product.productName || '').toLocaleLowerCase('tr-TR').includes(normalized)
    || String(product.barcodeMasked || '').toLocaleLowerCase('tr-TR').includes(normalized)
  )) || null;
}

export async function findCachedProducts(query, limit = 8) {
  const normalized = String(query || '').trim().toLocaleLowerCase('tr-TR');
  const cache = await readJson(productCacheKey, {});

  if (!normalized) {
    return [];
  }

  return Object.values(cache).filter((product) => (
    String(product.stockCode || '').toLocaleLowerCase('tr-TR').includes(normalized)
    || String(product.productName || '').toLocaleLowerCase('tr-TR').includes(normalized)
    || String(product.barcodeMasked || '').toLocaleLowerCase('tr-TR').includes(normalized)
    || String(product.matchedBarcode || '').toLocaleLowerCase('tr-TR').includes(normalized)
  )).slice(0, limit);
}

export async function getCacheSummary() {
  const [products, customers, meta] = await Promise.all([
    readJson(productCacheKey, {}),
    readJson(customerCacheKey, {}),
    readJson(cacheMetaKey, {}),
  ]);

  return {
    productCount: Object.keys(products).length,
    customerCount: Object.keys(customers).length,
    productCachedAt: meta.productCachedAt || null,
    customerCachedAt: meta.customerCachedAt || null,
    productCachedCount: meta.productCachedCount || null,
    customerCachedCount: meta.customerCachedCount || null,
  };
}

export async function saveCustomerCache(customers = []) {
  const existing = await readJson(customerCacheKey, {});
  const next = { ...existing };

  customers.forEach((customer) => {
    next[String(customer.id)] = {
      ...customer,
      cachedAt: new Date().toISOString(),
    };
  });

  await writeJson(customerCacheKey, next);
}

export async function replaceCustomerCache(customers = []) {
  const next = {};

  customers.forEach((customer) => {
    next[String(customer.id)] = {
      ...customer,
      cachedAt: new Date().toISOString(),
    };
  });

  await writeJson(customerCacheKey, next);
}

export async function markCacheUpdated(type, count) {
  const meta = await readJson(cacheMetaKey, {});
  const now = new Date().toISOString();
  const next = {
    ...meta,
    [`${type}CachedAt`]: now,
    [`${type}CachedCount`]: count,
  };
  await writeJson(cacheMetaKey, next);
  return next;
}
