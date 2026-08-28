import { get, patch, post, put } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import {
  demoProductDetailResponse,
  demoProductPassiveResponse,
  demoProductWriteResponse,
} from '../demo/demoProducts.js';

export async function fetchProductDetail(id) {
  if (apiConfig.demoMode) {
    return demoProductDetailResponse(id);
  }

  return get(`/api/products/${id}`);
}

export async function fetchProductOptions() {
  if (apiConfig.demoMode) {
    return {
      data: {
        brands: [],
        brandCurrencies: {},
        brandDefaults: {},
        categories: [],
        suppliers: [],
        supplierCurrencies: {},
      },
      meta: { source: 'demo-empty' },
    };
  }

  return get('/api/products/options');
}

export async function checkProductIdentityAvailability({ stockCode, barcode, excludeProductId }) {
  if (apiConfig.demoMode) {
    return {
      data: {
        stockCode: { value: stockCode || '', available: true, duplicateProduct: null },
        barcode: { value: barcode || '', available: true, duplicateProduct: null },
      },
      meta: { source: 'demo-empty' },
    };
  }

  return get('/api/products/identity-check', {
    stockCode,
    barcode,
    excludeProductId,
  });
}

export async function fetchProductStockMovements(id) {
  return get('/api/stock-movements', {
    productId: id,
    limit: 60,
  });
}

export async function createProduct(payload) {
  if (apiConfig.demoMode) {
    return demoProductWriteResponse(payload);
  }

  return post('/api/products', payload);
}

export async function updateProduct(id, payload) {
  if (apiConfig.demoMode) {
    return demoProductWriteResponse(payload, id);
  }

  return put(`/api/products/${id}`, payload);
}

export async function previewProductBulkUpdate(payload) {
  return post('/api/products/bulk-update/preview', payload);
}

export async function applyProductBulkUpdate(payload) {
  return post('/api/products/bulk-update/apply', payload);
}

export async function previewProductBulkCreate(payload) {
  return post('/api/products/bulk-create/preview', payload);
}

export async function applyProductBulkCreate(payload) {
  return post('/api/products/bulk-create/apply', payload);
}

export async function changeProductPassive(id, isPassive) {
  if (apiConfig.demoMode) {
    return demoProductPassiveResponse(id, isPassive);
  }

  return patch(`/api/products/${id}/passive`, { isPassive });
}

export async function addProductBarcode(id, payload) {
  return post(`/api/products/${id}/barcodes`, payload);
}

export async function changeProductBarcodePassive(id, barcodeId, isPassive) {
  return patch(`/api/products/${id}/barcodes/${barcodeId}/passive`, { isPassive });
}

export async function saveProductImage(id, payload) {
  return post(`/api/products/${id}/images`, payload);
}
