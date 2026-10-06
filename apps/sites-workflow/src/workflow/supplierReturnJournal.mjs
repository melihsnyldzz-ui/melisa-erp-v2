const invalid=()=>{throw Error('Son işlem okunamıyor. İşlem sonucu kontrol edilmeli.');};
const positive=v=>Number.isSafeInteger(v)&&v>0;
export function supplierReturnRequest(path,body){
 if(!/^\/api\/test-daily\/purchase\/(draft|approve|reject|cancel)$/.test(path)||!body||typeof body!=='object'||Array.isArray(body)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId)||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date))||new Date(body.date).toISOString().slice(0,10)!==body.date)invalid();
 const action=path.split('/').at(-1),keys=action==='draft'?['requestId','date','reason','sourceInvoiceId','sourceItemId','quantity']:['requestId','date','id',...(action==='approve'?[]:['reason'])];
 if(Object.keys(body).length!==keys.length||keys.some(k=>!Object.hasOwn(body,k)))invalid();
 if(action==='draft'?(!positive(body.sourceInvoiceId)||!positive(body.sourceItemId)||!positive(body.quantity)||body.quantity>30):!positive(body.id))invalid();
 if(action!=='approve'&&(typeof body.reason!=='string'||body.reason.trim().length<(action==='cancel'?5:3)||body.reason.length>500))invalid();
 return {version:1,path,body:JSON.parse(JSON.stringify(body))};
}
export function createSupplierReturnJournal({storage,key,send,refresh}){
 let busy=false;
 function read(){try{const raw=storage?.getItem(key);if(!raw)return null;const p=JSON.parse(raw);if(p.version!==1)invalid();return supplierReturnRequest(p.path,p.body);}catch{invalid();}}
 function save(p){try{if(!storage)throw Error();const raw=JSON.stringify(p);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error();}catch{throw Error('İşlem saklanamadı; kayıt gönderilmedi.');}}
 function clear(p){if(storage.getItem(key)===JSON.stringify(p))storage.removeItem(key);}
 async function dispatch(p){
  if(busy)throw Error('Önceki işlem tamamlanıyor.');busy=true;let accepted=false;
  try{const result=await send(p.path,{method:'POST',body:p.body});accepted=true;await refresh();clear(p);return result;}
  catch(error){if(!accepted&&[400,403,404,409,422].includes(error?.status))clear(p);throw error;}
  finally{busy=false;}
 }
 return {read,get busy(){return busy;},async begin(path,body){if(busy||read())throw Error('Önceki işlemin sonucu önce doğrulanmalı.');const p=supplierReturnRequest(path,body);save(p);return dispatch(p);},async retry(){if(busy)throw Error('Önceki işlem tamamlanıyor.');const p=read();if(!p)throw Error('Doğrulanacak işlem yok.');return dispatch(p);}};
}
