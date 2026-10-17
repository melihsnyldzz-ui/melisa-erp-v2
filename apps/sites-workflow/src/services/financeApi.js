import { get, patch, post } from './apiClient.js';
const financeDemoMode = import.meta.env?.VITE_DEMO_MODE === 'true'
 && import.meta.env?.VITE_VEGA_BRIDGE_MODE !== 'true';

async function loadDemoFinance() {
 return import('../demo/demoFinance.js');
}
export function postFinanceTransfer(payload){
 const fields=['source','requestId','fromAccountId','toAccountId','currency','amount','eventDate','description'];
 if(!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!fields.includes(k))||!/^[a-zA-Z0-9-]{8,80}$/.test(payload.requestId||''))throw Error('Transfer komutu geçersiz.');
 return post('/api/finance/transfers',structuredClone(payload));
}
export function compensateFinanceTransfer(transferId,payload){
 const fields=['source','requestId','fromAccountId','toAccountId','currency','amount','eventDate','reason'];
 if(typeof transferId!=='string'||!/^[1-9]\d{0,18}$/.test(transferId)||BigInt(transferId)>9223372036854775807n
  ||!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!fields.includes(k))
  ||!/^[a-zA-Z0-9-]{8,80}$/.test(payload.requestId||'')||typeof payload.reason!=='string'||!payload.reason.trim()||payload.reason.length>500)
  throw Error('Transfer telafi kimliği veya gerekçesi geçersiz.');
 return post(`/api/finance/transfers/${encodeURIComponent(transferId)}/compensate`,structuredClone(payload));
}
export function fetchCollectionNotices(params,options={}){return get('/api/collection-notices',params,options);}
export function fetchSupplierPaymentOutcome(supplierId,source,requestId,options={}){
 if(typeof supplierId!=='string'||!/^[1-9]\d{0,18}$/.test(supplierId)||BigInt(supplierId)>9223372036854775807n
  ||typeof source!=='string'||typeof requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw Error('Ödeme sonuç kimliği geçersiz.');
 return get('/api/supplier-payments/outcome',{supplierId,source,requestId},options);
}
export function fetchCollectionNotice(id,source,options={}){
 if(typeof id!=='string'||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n)throw Error('Bildirim kimliği geçersiz.');
 return get(`/api/collection-notices/${encodeURIComponent(id)}`,{source},options);
}
export function reviewCollectionNotice(id,action,payload){
 if(typeof id!=='string'||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n||!['approve','correct_and_approve','reject'].includes(action))throw Error('Bildirim inceleme kimliği geçersiz.');
 const fields=['source','requestId','expectedVersion','eventDate','reason',...(action==='reject'?[]:['approvedAmount','acknowledgedDuplicateIds'])];
 if(!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!fields.includes(k))||!Number.isSafeInteger(payload.expectedVersion)||payload.expectedVersion<0||!/^[a-zA-Z0-9-]{8,80}$/.test(payload.requestId||''))throw Error('Bildirim inceleme komutu geçersiz.');
 return post(`/api/collection-notices/${encodeURIComponent(id)}/${action}`,structuredClone(payload));
}
export function createCollectionNotice(payload){
 const allowed=['source','requestId','customerId','currency','method','reportedAmount','reportedOn'];
 if(!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!allowed.includes(k))||typeof payload.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(payload.requestId))throw Error('Bildirim kimliği veya alanları geçersiz.');
 return post('/api/collection-notices',structuredClone(payload));
}
export function postSupplierPayment(payload){
 const fields=['source','supplierId','requestId','eventDate','description','legs'];
 if(!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!fields.includes(k))||!/^[a-zA-Z0-9-]{8,80}$/.test(payload.requestId||''))throw Error('Ödeme komutu geçersiz.');
 return post('/api/supplier-payments',structuredClone(payload));
}
export function compensateSupplierPayment(paymentId,payload){
 const fields=['source','supplierId','requestId','eventDate','reason','legs'];
 if(typeof paymentId!=='string'||!/^[1-9]\d{0,18}$/.test(paymentId)||BigInt(paymentId)>9223372036854775807n
  ||!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!fields.includes(k))
  ||!/^[a-zA-Z0-9-]{8,80}$/.test(payload.requestId||'')||typeof payload.reason!=='string'||!payload.reason.trim()||payload.reason.length>500)
  throw Error('Ödeme telafi kimliği veya gerekçesi geçersiz.');
 return post(`/api/supplier-payments/${encodeURIComponent(paymentId)}/compensate`,structuredClone(payload));
}
export function fetchSupplierPaymentAccounts(supplierId,source,options={}){
 if(typeof supplierId!=='string'||!/^[1-9]\d{0,18}$/.test(supplierId)
  ||BigInt(supplierId)>9223372036854775807n||typeof source!=='string'||!source.trim())
  throw Error('Ödeme hesabı kaynak veya tedarikçi kimliği geçersiz.');
 return get('/api/supplier-payments/accounts',{source,supplierId},options);
}

export async function fetchFinanceSummary() {
  return get('/api/finance/summary');
}

export async function fetchFinanceMovements(params = {},options = {}) {
  return get('/api/finance/movements', params,options);
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

export async function fetchFinanceAccounts(params = {},options = {}) {
  return get('/api/finance/accounts', params,options);
}

export async function fetchFinanceAccountCleanupPreview(options = {}) {
  return get('/api/finance/accounts/cleanup-preview',{},options);
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

export async function fetchCashRegister(params = {}) {
  if (financeDemoMode) return (await loadDemoFinance()).demoCashRegisterResponse(params);
  return get('/api/finance/cash-register', params);
}

export async function openCashRegister(payload) {
  if (financeDemoMode) return (await loadDemoFinance()).demoOpenCashRegister(payload);
  return post('/api/finance/cash-register/open', payload);
}

export async function createCashExpense(payload) {
  if (financeDemoMode) return (await loadDemoFinance()).demoCreateCashExpense(payload);
  return post('/api/finance/cash-register/expenses', payload);
}

export async function createCashTransfer(payload) {
  if (financeDemoMode) return (await loadDemoFinance()).demoCreateCashTransfer(payload);
  return post('/api/finance/cash-register/transfers', payload);
}

export async function closeCashRegister(payload) {
  if (financeDemoMode) return (await loadDemoFinance()).demoCloseCashRegister(payload);
  return post('/api/finance/cash-register/close', payload);
}

export function fetchFinanceTransferAccounts(eventDate,options={}){
 return get('/api/finance/transfers/accounts',{source:'PROMPT-2-20260923-01',eventDate},options);
}
