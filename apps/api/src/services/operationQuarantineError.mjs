// Only the dedicated quarantine SQL number and known server token are mapped.
// Other SQL/business errors retain their original behavior and diagnostics.
export function normalizeOperationQuarantineError(error){
 const info=error?.originalError?.info,number=error?.number??info?.number;
 if(number!==51076)return error;
 const text=[error.message,error.originalError?.message,info?.message,...(error.precedingErrors??[]).map(e=>e.message)].filter(Boolean).join(' ');
 if(/\bMIGRATION_OPERATION_QUARANTINED\b/.test(text))return Object.assign(new Error('Kartın geçiş eşleştirmesi tamamlanmadı; işlem yapılamaz.'),{code:'MIGRATION_ENTITY_QUARANTINED',statusCode:409});
 if(/\bMIGRATION_QUARANTINE_(?:NOT_READY|BINDING_DRIFT|CHECK_INVALID)\b/.test(text))return Object.assign(new Error('Geçiş karantinası doğrulanamadı; işlem kapalı.'),{code:'MIGRATION_QUARANTINE_NOT_READY',statusCode:503});
 return error;
}
