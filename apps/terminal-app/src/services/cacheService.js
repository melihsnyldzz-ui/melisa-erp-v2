import AsyncStorage from '@react-native-async-storage/async-storage';

const legacyProductCacheKey = 'terminalProductCache';
const productCacheIndexKey = 'terminalProductCacheIndexV2';
const productCacheChunkPrefix = 'terminalProductCacheChunkV2:';
const productLookupShardPrefix = 'terminalProductLookupShardV2:';
const customerCacheKey = 'terminalCustomerCache';
const cacheMetaKey = 'terminalCacheMeta';
const PRODUCT_CACHE_CHUNK_SIZE = 200;

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;

    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function toProductCacheKey(product, index) {
  return String(product.id || product.stockCode || product.barcodeMasked || product.matchedBarcode || `row-${index}`);
}

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function lookupShardKey(normalizedValue) {
  const prefix = normalizedValue.slice(0, 2) || '__';
  return `${productLookupShardPrefix}${prefix}`;
}

function addProductLookup(lookupShards, value, pointer) {
  const normalizedValue = normalizeSearch(value);
  if (!normalizedValue) return;

  const shardKey = lookupShardKey(normalizedValue);
  lookupShards[shardKey] = {
    ...(lookupShards[shardKey] || {}),
    [normalizedValue]: pointer,
  };
}

function productMatches(product, normalized) {
  if (!normalized) return false;

  return [
    product.stockCode,
    product.productName,
    product.barcodeMasked,
    product.matchedBarcode,
    product.brand,
  ].some((value) => normalizeSearch(value).includes(normalized));
}

function productBarcodeEquals(product, normalized) {
  if (!normalized) return false;

  return [
    product.barcode,
    product.barcodeMasked,
    product.matchedBarcode,
  ].some((value) => normalizeSearch(value) === normalized);
}

function normalizeProductForCache(product) {
  return {
    ...product,
    cachedAt: new Date().toISOString(),
  };
}

async function readProductCacheIndex() {
  return readJson(productCacheIndexKey, null);
}

async function removeProductCacheChunks(index) {
  const chunkKeys = Array.isArray(index?.chunkKeys) ? index.chunkKeys : [];
  const lookupShardKeys = Array.isArray(index?.lookupShardKeys) ? index.lookupShardKeys : [];
  const keys = [...chunkKeys, ...lookupShardKeys];
  if (keys.length) {
    await AsyncStorage.multiRemove(keys);
  }
}

async function writeProductCacheValues(products = []) {
  const previousIndex = await readProductCacheIndex();
  await removeProductCacheChunks(previousIndex);

  /** @type {Array<[string, string]>} */
  const chunkEntries = [];
  const lookupShards = {};
  const normalizedProducts = products.map(normalizeProductForCache);

  for (let start = 0; start < normalizedProducts.length; start += PRODUCT_CACHE_CHUNK_SIZE) {
    const chunkNo = Math.floor(start / PRODUCT_CACHE_CHUNK_SIZE);
    const key = `${productCacheChunkPrefix}${String(chunkNo).padStart(4, '0')}`;
    const chunk = normalizedProducts.slice(start, start + PRODUCT_CACHE_CHUNK_SIZE);
    chunkEntries.push([key, JSON.stringify(chunk)]);

    chunk.forEach((product, index) => {
      const pointer = { chunkKey: key, index };
      addProductLookup(lookupShards, product.stockCode, pointer);
      addProductLookup(lookupShards, product.barcodeMasked, pointer);
      addProductLookup(lookupShards, product.matchedBarcode, pointer);
    });
  }

  if (chunkEntries.length) {
    await AsyncStorage.multiSet(chunkEntries);
  }

  const lookupEntries = Object.entries(lookupShards).map(([key, value]) => /** @type {[string, string]} */ ([key, JSON.stringify(value)]));
  if (lookupEntries.length) {
    await AsyncStorage.multiSet(lookupEntries);
  }

  await writeJson(productCacheIndexKey, {
    version: 2,
    count: normalizedProducts.length,
    chunkSize: PRODUCT_CACHE_CHUNK_SIZE,
    chunkKeys: chunkEntries.map(([key]) => key),
    lookupShardKeys: lookupEntries.map(([key]) => key),
    cachedAt: new Date().toISOString(),
  });

  await AsyncStorage.removeItem(legacyProductCacheKey);
}

async function readLegacyProductValues() {
  const legacy = await readJson(legacyProductCacheKey, {});
  return Object.values(legacy);
}

async function readProductCacheValues() {
  const index = await readProductCacheIndex();
  const chunkKeys = Array.isArray(index?.chunkKeys) ? index.chunkKeys : [];

  if (!chunkKeys.length) {
    return readLegacyProductValues();
  }

  const pairs = await AsyncStorage.multiGet(chunkKeys);
  return pairs.flatMap(([, raw]) => {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
}

async function findInProductChunks(predicate, limit = 1) {
  const results = [];
  const index = await readProductCacheIndex();
  const chunkKeys = Array.isArray(index?.chunkKeys) ? index.chunkKeys : [];

  if (!chunkKeys.length) {
    const legacyValues = await readLegacyProductValues();
    return legacyValues.filter(predicate).slice(0, limit);
  }

  for (const key of chunkKeys) {
    const chunk = await readJson(key, []);
    const matches = Array.isArray(chunk) ? chunk.filter(predicate) : [];
    results.push(...matches);

    if (results.length >= limit) {
      return results.slice(0, limit);
    }
  }

  return results;
}

export async function findExactCachedProduct(query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return null;

  const lookupShard = await readJson(lookupShardKey(normalized), {});
  const pointer = lookupShard[normalized];
  if (!pointer?.chunkKey || !Number.isFinite(pointer.index)) {
    return null;
  }

  const chunk = await readJson(pointer.chunkKey, []);
  return Array.isArray(chunk) ? chunk[pointer.index] || null : null;
}

export async function findExactCachedProductByBarcode(query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return null;

  const exactProduct = await findExactCachedProduct(normalized);
  if (exactProduct && productBarcodeEquals(exactProduct, normalized)) {
    return exactProduct;
  }

  // Version 2 caches index every barcode. Scanning all chunks on a miss delays
  // the next scan noticeably on field terminals with thousands of products.
  const index = await readProductCacheIndex();
  if (Array.isArray(index?.chunkKeys) && index.chunkKeys.length) {
    return null;
  }

  const matches = await findInProductChunks((product) => productBarcodeEquals(product, normalized), 1);
  return matches[0] || null;
}

export async function saveProductCache(products = []) {
  const existing = await readProductCacheValues();
  const next = {};

  existing.forEach((product, index) => {
    next[toProductCacheKey(product, index)] = product;
  });

  products.forEach((product, index) => {
    next[toProductCacheKey(product, existing.length + index)] = {
      ...product,
      cachedAt: new Date().toISOString(),
    };
  });

  await writeProductCacheValues(Object.values(next));
}

export async function replaceProductCache(products = []) {
  await writeProductCacheValues(products);
}

export async function findCachedProduct(query) {
  const normalized = normalizeSearch(query);
  const exactProduct = await findExactCachedProduct(normalized);
  if (exactProduct) {
    return exactProduct;
  }

  const matches = await findInProductChunks((product) => productMatches(product, normalized), 1);

  return matches[0] || null;
}

export async function findCachedProducts(query, limit = 8) {
  const normalized = normalizeSearch(query);

  if (!normalized) {
    return [];
  }

  return findInProductChunks((product) => productMatches(product, normalized), limit);
}

export async function findCachedProductsByStockCode(query, limit = 8) {
  const normalized = normalizeSearch(query);

  if (!normalized) {
    return [];
  }

  if (normalized.length < 2) {
    return findInProductChunks((product) => normalizeSearch(product.stockCode).includes(normalized), limit);
  }

  const lookupShard = await readJson(lookupShardKey(normalized), {});
  const pointers = Object.entries(lookupShard)
    .filter(([key]) => key.includes(normalized))
    .map(([, pointer]) => pointer)
    .filter((pointer) => pointer?.chunkKey && Number.isFinite(pointer.index));

  const results = [];
  const seen = {};

  for (const pointer of pointers) {
    const dedupeKey = `${pointer.chunkKey}:${pointer.index}`;
    if (seen[dedupeKey]) continue;
    seen[dedupeKey] = true;

    const chunk = await readJson(pointer.chunkKey, []);
    const product = Array.isArray(chunk) ? chunk[pointer.index] || null : null;
    if (product && normalizeSearch(product.stockCode).includes(normalized)) {
      results.push(product);
    }

    if (results.length >= limit) {
      return results.slice(0, limit);
    }
  }

  return results;
}

async function getProductCacheCount() {
  const index = await readProductCacheIndex();
  if (Number.isFinite(index?.count)) {
    return index.count;
  }

  const meta = await readJson(cacheMetaKey, {});
  return meta.productCachedCount || 0;
}

export async function getCacheSummary() {
  const [productIndex, productCount, customers, meta] = await Promise.all([
    readProductCacheIndex(),
    getProductCacheCount(),
    readJson(customerCacheKey, {}),
    readJson(cacheMetaKey, {}),
  ]);
  const productChunkCount = Array.isArray(productIndex?.chunkKeys) ? productIndex.chunkKeys.length : 0;
  const productLookupShardCount = Array.isArray(productIndex?.lookupShardKeys) ? productIndex.lookupShardKeys.length : 0;
  const productIndexReady = Number(productIndex?.count || 0) > 0
    && productChunkCount > 0
    && productLookupShardCount > 0;

  return {
    productCount,
    customerCount: Object.keys(customers).length,
    productIndexReady,
    productCacheVersion: productIndex?.version || 0,
    productChunkCount,
    productLookupShardCount,
    productIndexCachedAt: productIndex?.cachedAt || null,
    productCachedAt: meta.productCachedAt || null,
    customerCachedAt: meta.customerCachedAt || null,
    productCachedCount: meta.productCachedCount || null,
    customerCachedCount: meta.customerCachedCount || null,
  };
}

export async function clearTerminalCache() {
  const productIndex = await readProductCacheIndex();
  await removeProductCacheChunks(productIndex);
  await AsyncStorage.multiRemove([
    legacyProductCacheKey,
    productCacheIndexKey,
    customerCacheKey,
    cacheMetaKey,
  ]);
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
