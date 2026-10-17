import {get,post} from './apiClient.js';
// Prepared client for existing authenticated financeReviewRoutes. Not activated.
// Request identities belong to the UI's retained pending command, never regenerated here.
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const date=v=>typeof v==='string'&&/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function snapshot(body,fields){
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k))||body.source!=='PROMPT-2-20260923-01'
  ||typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Error('Çek istek kimliği veya alanları geçersiz.');
 return structuredClone(body);
}
export function validateTaskCheque(body){
 const b=snapshot(body,['source','requestId','partyId','currency','direction','amount','dueDate','bankName','number']);
 if(!id(b.partyId)||!['TRY','USD','EUR'].includes(b.currency)||!['received','given'].includes(b.direction)||!date(b.dueDate)
  ||typeof b.amount!=='string'||!/^\d{1,14}(\.\d{1,4})?$/.test(b.amount)||!/[1-9]/.test(b.amount)
  ||typeof b.bankName!=='string'||!b.bankName.trim()||b.bankName.length>120||typeof b.number!=='string'||!b.number.trim()||b.number.length>80||/[\u0000-\u001f\u007f]/.test(b.number))throw Error('Çek bilgileri doğrulanmadı.');
 const [whole,fraction='']=b.amount.split('.');if(BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0'))>250000000n)throw Error('TEST çek tutarı sınırı aşıldı.');
 return b;
}
export function transitionTaskCheque(chequeId,action,body){
 if(!id(chequeId)||!['finalize','deposit','settle','cancel','dishonour','return'].includes(action))throw Error('Çek kimliği veya işlem geçersiz.');
 const b=snapshot(body,['source','requestId','expectedVersion','eventDate','reason',...(action==='finalize'?['acknowledgedDuplicateIds']:[])]);
 if(!Number.isSafeInteger(b.expectedVersion)||b.expectedVersion<0||b.expectedVersion>=Number.MAX_SAFE_INTEGER||!date(b.eventDate)
  ||(b.reason!==undefined&&b.reason!==null&&(typeof b.reason!=='string'||b.reason.length>500))||(['cancel','dishonour','return'].includes(action)&&(typeof b.reason!=='string'||!b.reason.trim())))throw Error('Çek sürümü, tarih veya gerekçe eksik.');
 if(action==='finalize'&&(!Array.isArray(b.acknowledgedDuplicateIds)||b.acknowledgedDuplicateIds.some(v=>!id(v)||v===chequeId)
  ||new Set(b.acknowledgedDuplicateIds).size!==b.acknowledgedDuplicateIds.length))throw Error('Mükerrer çek kontrolü doğrulanmadı.');
 return post(`/api/cheques/${encodeURIComponent(chequeId)}/${action}`,b);
}

export function createTaskCheque(body){return post('/api/cheques',validateTaskCheque(body));}

export function fetchTaskCheques(query,options={}){return get('/api/cheques',query,options);}
export function fetchTaskCheque(chequeId,source,options={}){if(!id(chequeId))throw Error('Çek kimliği geçersiz.');return get(`/api/cheques/${encodeURIComponent(chequeId)}`,{source},options);}


