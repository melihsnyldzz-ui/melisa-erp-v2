import { get, patch, post } from './apiClient.js';

export async function fetchFinanceSummary() {
  return get('/api/finance/summary');
}

export async function fetchFinanceMovements(params = {}) {
  return get('/api/finance/movements', params);
}

export async function fetchFinanceJournal(params = {}) {
  return get('/api/finance/journal', params);
}

export async function fetchAccountingControl() {
  return get('/api/finance/accounting-control');
}

export async function fetchDocumentNumberFixPreview() {
  return get('/api/finance/document-number-fix-preview');
}

export async function applyDocumentNumberFix() {
  return post('/api/finance/document-number-fix', {});
}

export async function fetchFinanceAccounts(params = {}) {
  return get('/api/finance/accounts', params);
}

export async function fetchFinanceAccountCleanupPreview() {
  return get('/api/finance/accounts/cleanup-preview');
}

export async function createFinanceAccount(payload) {
  return post('/api/finance/accounts', payload);
}

export async function applyFinanceAccountCleanup() {
  return post('/api/finance/accounts/cleanup', {});
}

export async function applyFinanceAccountStandardization() {
  return post('/api/finance/accounts/standardize', {});
}

export async function updateFinanceAccount(accountId, payload) {
  return patch(`/api/finance/accounts/${accountId}`, payload);
}

export async function createCustomerCollection(payload) {
  return post('/api/finance/collections', payload);
}

export async function createSupplierPayment(payload) {
  return post('/api/finance/payments', payload);
}
