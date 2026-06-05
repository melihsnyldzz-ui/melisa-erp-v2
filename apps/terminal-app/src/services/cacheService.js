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

  const lookupEntries = Object.entries(lookupShards).map(([key, value]) => [key, JSON.stringify(value)]);
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

async function getProductCacheCount() {
  const index = await readProductCacheIndex();
  if (Number.isFinite(index?.count)) {
    return index.count;
  }

  const meta = await readJson(cacheMetaKey, {});
  return meta.productCachedCount || 0;
}

export async function getCacheSummary() {
  const [productCount, customers, meta] = await Promise.all([
    getProductCacheCount(),
    readJson(customerCacheKey, {}),
    readJson(cacheMetaKey, {}),
  ]);

  return {
    productCount,
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
