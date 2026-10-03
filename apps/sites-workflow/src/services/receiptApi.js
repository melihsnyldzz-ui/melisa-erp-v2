import {get} from './apiClient.js';

// Uses existing auth/abort/error handling. No demo fallback and no write export.
// The server route remains closed until native read activation is verified.
export function fetchInventoryReceipts(params={},options={}){
 return get('/api/inventory-receipts',params,options);
}
export function fetchInventoryReceipt(id,source,options={}){
 if(typeof id!=='string'||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n)throw new Error('Kabul kimliği geçersiz.');
 return get(`/api/inventory-receipts/${encodeURIComponent(id)}`,{source},options);
}
export function fetchReceiptLineIdentity(receiptId,lineId,source,options={}){
 for(const value of [receiptId,lineId])if(typeof value!=='string'||!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new Error('Kabul veya satır kimliği geçersiz.');
 if(typeof source!=='string'||!source.trim())throw new Error('Kabul kaynağı eksik.');
 return get(`/api/inventory-receipts/${encodeURIComponent(receiptId)}/lines/${encodeURIComponent(lineId)}/identity`,{source},options);
}

