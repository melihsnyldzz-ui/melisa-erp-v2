import { post } from './apiClient.js';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary);
}

async function buildImportPayload(file, options = {}) {
  if (!file) {
    const error = new Error('Aktarim dosyasi se?ilmedi.');
    error.code = 'IMPORT_FILE_REQUIRED';
    throw error;
  }

  const buffer = await file.arrayBuffer();
  return {
    fileName: file.name,
    contentBase64: arrayBufferToBase64(buffer),
    ...options,
  };
}

export async function previewProductsImport(file) {
  return post('/api/import/products/preview', await buildImportPayload(file));
}

export async function commitProductsImport(file, options = {}) {
  return post('/api/import/products/commit', await buildImportPayload(file, options));
}

export async function previewCustomersImport(file) {
  return post('/api/import/customers/preview', await buildImportPayload(file));
}

export async function commitCustomersImport(file, options = {}) {
  return post('/api/import/customers/commit', await buildImportPayload(file, options));
}

export async function previewSuppliersImport(file) {
  return post('/api/import/suppliers/preview', await buildImportPayload(file));
}

export async function commitSuppliersImport(file, options = {}) {
  return post('/api/import/suppliers/commit', await buildImportPayload(file, options));
}
