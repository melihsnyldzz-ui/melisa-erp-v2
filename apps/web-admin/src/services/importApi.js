import { post } from './apiClient.js';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary);
}

async function buildImportPayload(file) {
  if (!file) {
    const error = new Error('Aktarim dosyasi secilmedi.');
    error.code = 'IMPORT_FILE_REQUIRED';
    throw error;
  }

  const buffer = await file.arrayBuffer();
  return {
    fileName: file.name,
    contentBase64: arrayBufferToBase64(buffer),
  };
}

export async function previewProductsImport(file) {
  return post('/import/products/preview', await buildImportPayload(file));
}

export async function commitProductsImport(file) {
  return post('/import/products/commit', await buildImportPayload(file));
}

export async function previewCustomersImport(file) {
  return post('/import/customers/preview', await buildImportPayload(file));
}

export async function commitCustomersImport(file) {
  return post('/import/customers/commit', await buildImportPayload(file));
}
