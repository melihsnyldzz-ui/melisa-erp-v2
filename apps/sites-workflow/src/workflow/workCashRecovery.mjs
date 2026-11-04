// A cash overview cannot establish the outcome of an earlier command. Preserve
// its durable UUID/body and expose a read-only screen until separately verified.
const base='/api/finance/cash-register';
const routes=new Set(['open','close','transfers','expenses'].map(p=>base+'/'+p));
export const cashRecoveryNotice='Son kasa işleminin sonucu henüz doğrulanmadı. Kasa kayıtlarını inceleyebilirsiniz; yeni işlem gönderilmez. Son işlem yetkili kişi tarafından doğrulanmalıdır.';
export function cashPendingValid(p){
 return p?.version===1&&p.status==='pending'&&routes.has(p.path)&&p.body!==null&&typeof p.body==='object'&&!Array.isArray(p.body)&&typeof p.body.requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.body.requestId)&&/^[a-f0-9]{64}$/.test(p.body.expectedRevision??'');
}
export function cashReadWithRecovery(data,pending){
 if(pending?.status!=='pending')return data;
 if(!cashPendingValid(pending))throw Error('Son kasa işlemi doğrulanamadı. Yeni işlem gönderilmedi.');
 return {...data,capabilities:{...data.capabilities,canOpenOrClose:false,canRecordExpenseOrTransfer:false}};
}
