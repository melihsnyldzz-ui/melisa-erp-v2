export function matchesReturnResult(result, pending) {
  if (!result || !Number.isSafeInteger(Number(result.id)) || Number(result.id)<=0 || !['finalized','cancelled'].includes(result.status)) return false;
  if (pending.operation==='cancel') return Number(result.id)===Number(pending.returnId)&&result.kind===pending.kind&&result.status==='cancelled';
  if (result.requestId!==pending.payload?.requestId || result.kind!==pending.kind) return false;
  const expected={...pending.preview};delete expected.previewHash;delete expected.requestId;
  return JSON.stringify(result.plan)===JSON.stringify(expected);
}
export function newReturnRequestId(cryptoApi=globalThis.crypto){
  if(typeof cryptoApi?.randomUUID==='function')return cryptoApi.randomUUID();
  if(typeof cryptoApi?.getRandomValues!=='function')throw Error('Güvenli işlem kimliği üretilemedi; gönderim yapılmadı.');
  const bytes=cryptoApi.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const returnFailureBeforeWrite=code=>new Set(['RETURN_VALIDATION','RETURN_PREVIEW_REQUIRED','RETURN_PREVIEW_STALE','RETURN_SCHEMA_REQUIRED','RETURN_QUANTITY_EXCEEDED','RETURN_PARTY_UNAVAILABLE','RETURN_PRODUCT_UNAVAILABLE','RETURN_COST_REQUIRED','RETURN_STOCK_INSUFFICIENT','RETURN_SOURCE_NOT_FINALIZED','RETURN_SOURCE_MISMATCH','RETURN_SOURCE_NOT_FOUND','RETURN_ACCOUNT_CURRENCY_CHANGED','RETURN_DATE_BEFORE_SOURCE','RETURN_SOURCE_TOTAL_MISMATCH','RETURN_COST_REVIEW_REQUIRED','CURRENCY_SNAPSHOT_REQUIRED','CURRENCY_SNAPSHOT_INCONSISTENT','CURRENCY_SETTLEMENT_INVALID','CURRENCY_SETTLEMENT_RATE_REQUIRED','CURRENCY_SETTLEMENT_RATE_MISMATCH','ACCOUNTING_PERIOD_LOCKED','AUTH_PERMISSION_DENIED','AUTH_TOKEN_REQUIRED','AUTH_TOKEN_INVALID','SQL_WRITE_DISABLED','SQL_WRITE_TARGET_INVALID','PILOT_RETURNS_DISABLED','EXPORT_INVOICE_LOCKED']).has(code);
export function readReturnReview(storage,key){const raw=storage.getItem(key);if(!raw)return null;const p=JSON.parse(raw);if(p.version!==1||!['sales','purchase'].includes(p.kind)||!['submit','cancel'].includes(p.operation))throw Error('Bekleyen iade kaydı okunamadı. Kaydı silmeden yetkiliye bildirin.');return p;}
export function saveReturnReview(storage,key,review){const current=readReturnReview(storage,key);if(current&&JSON.stringify(current)!==JSON.stringify(review))throw Error('Bu kullanıcı için sonucu bekleyen başka iade var. Önce durumunu kontrol edin.');storage.setItem(key,JSON.stringify(review));if(storage.getItem(key)!==JSON.stringify(review))throw Error('İade işlem kimliği saklanamadı; gönderilmedi.');}
export function clearReturnReview(storage,key,review){const current=readReturnReview(storage,key);if(JSON.stringify(current)===JSON.stringify(review))storage.removeItem(key);}
