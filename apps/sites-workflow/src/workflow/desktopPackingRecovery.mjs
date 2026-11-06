const fail=()=>{throw Error('Korunan koli taslağı doğrulanamadı; kayıtlar saklanıyor.');};
const copy=v=>JSON.parse(JSON.stringify(v));
const key=(actor,invoice)=>`melisa.desktop.workflow.packing-recovery.v2.${actor}.${invoice}`;
const sourceKey=(actor,invoice,version)=>key(actor,invoice)+'.source.'+version;
const entryKey=(actor,invoice,request)=>key(actor,invoice)+'.request.'+request;
function writeOnce(storage,k,value){const text=JSON.stringify(value),old=storage.getItem(k);if(old!==null&&old!==text)fail();if(old===null)storage.setItem(k,text);if(storage.getItem(k)!==text)fail();}
export function captureDesktopPackingSource(storage,actor,record){
 const value={invoiceId:record.invoiceId,version:record.version,items:record.items.map(i=>({itemId:i.itemId,productId:i.productId,quantityExact3:i.quantityExact3}))};
 writeOnce(storage,sourceKey(actor,record.invoiceId,record.version),value);return value;
}
export function preserveDesktopPackingRequest(storage,actor,entry){
 const body=entry?.body;if(entry?.kind!=='transition'||body?.operation!=='SAVE_CARTONS')return;
 const k=entryKey(actor,body.invoiceId,body.requestId),existing=storage.getItem(k);if(existing!==null){const saved=JSON.parse(existing);if(saved.invoiceId!==body.invoiceId||saved.requestId!==body.requestId||JSON.stringify(saved.cartons)!==JSON.stringify(body.cartons))fail();const rawHead=storage.getItem(key(actor,body.invoiceId)),head=rawHead===null?null:JSON.parse(rawHead);if(head?.requestId!==saved.requestId){if((head?.requestId??null)!==saved.previousRequestId)fail();const pointer=JSON.stringify({invoiceId:body.invoiceId,requestId:body.requestId});storage.setItem(key(actor,body.invoiceId),pointer);if(storage.getItem(key(actor,body.invoiceId))!==pointer)fail();}return saved;}
 const priorRaw=storage.getItem(key(actor,body.invoiceId)),prior=priorRaw===null?null:JSON.parse(priorRaw);
 const rawSource=storage.getItem(sourceKey(actor,body.invoiceId,body.expectedVersion));
 const value={invoiceId:body.invoiceId,requestId:body.requestId,previousRequestId:prior?.requestId??null,source:rawSource===null?null:JSON.parse(rawSource),cartons:copy(body.cartons)};
 writeOnce(storage,k,value);const head={invoiceId:body.invoiceId,requestId:body.requestId};storage.setItem(key(actor,body.invoiceId),JSON.stringify(head));if(storage.getItem(key(actor,body.invoiceId))!==JSON.stringify(head))fail();return value;
}
export function readDesktopPackingRecovery(storage,actor,invoice,requestId=null){
 if(requestId===null){const raw=storage.getItem(key(actor,invoice));if(raw===null)return null;const head=JSON.parse(raw);if(head?.invoiceId!==invoice||typeof head.requestId!=='string')fail();requestId=head.requestId;}
 const raw=storage.getItem(entryKey(actor,invoice,requestId));if(raw===null)fail();const saved=JSON.parse(raw);
 if(saved?.invoiceId!==invoice||saved.requestId!==requestId||!Array.isArray(saved.cartons)||saved.cartons.length>100||saved.cartons.some(b=>!Number.isSafeInteger(b.cartonNo)||b.cartonNo<1||!Array.isArray(b.items)||b.items.length>2||b.items.some(i=>typeof i.itemId!=='string'||typeof i.quantityExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(i.quantityExact3))))fail();return saved;
}
export function desktopPackingSourceMatches(saved,record){
 if(!saved?.source||saved.source.invoiceId!==record.invoiceId||!Array.isArray(saved.source.items)||saved.source.items.length!==record.items.length)return false;
 return record.items.every(item=>saved.source.items.filter(prior=>prior.itemId===item.itemId&&prior.productId===item.productId&&prior.quantityExact3===item.quantityExact3).length===1);
}
