// Durable lifecycle queue: one unresolved command per actor and desktop target.
// Changing pages or losing an HTTP acknowledgement cannot create a new UUID.
const fail=()=>{throw Error('Önceki satış işleminin sonucu doğrulanmalı.');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const states={PREPARE:'PREPARING',SAVE_CARTONS:'PREPARING',READY:'READY',CHECK:'CHECKED',CANCEL:'CANCELLED'};
function validate(kind,payload){
 const keys={draft:'customerId,documentDate,expectedRevision,items',transition:'cartons,expectedVersion,invoiceId,operation',dispatch:'customerId,expectedVersion,invoiceId,productIds'};
 if(!Object.hasOwn(keys,kind)||!payload||Object.keys(payload).sort().join(',')!==keys[kind])fail();
 if(kind!=='draft'&&(!id(payload.invoiceId)||typeof payload.expectedVersion!=='string'||!/^0x[0-9A-F]{16}$/.test(payload.expectedVersion)))fail();
 if(kind==='transition'&&(!Object.hasOwn(states,payload.operation)||!Array.isArray(payload.cartons)))fail();
 if(kind==='draft'&&(!id(payload.customerId)||!Array.isArray(payload.items)||payload.items.length!==2||typeof payload.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(payload.expectedRevision)))fail();
 if(kind==='dispatch'&&(!id(payload.customerId)||!Array.isArray(payload.productIds)||payload.productIds.length!==2||payload.productIds.some(v=>!id(v))||new Set(payload.productIds).size!==2))fail();
 const text=JSON.stringify(payload);if(text.length>32768)fail();return JSON.parse(text);
}
export function createDesktopWorkflowClient({actorId,storage,locks,newId,submit}={}){
 if(!id(actorId)||typeof storage?.getItem!=='function'||typeof storage?.setItem!=='function'||typeof storage?.removeItem!=='function'||typeof locks?.request!=='function'||typeof newId!=='function'||typeof submit!=='function')fail();
 const key='melisa.desktop.workflow.pending.v1.'+actorId;
 function pending(){const raw=storage.getItem(key);if(raw===null)return null;let value;try{value=JSON.parse(raw);}catch{fail();}if(!value||Object.keys(value).sort().join(',')!=='body,kind'||!uuid(value.body?.requestId))fail();const {requestId,...payload}=value.body;validate(value.kind,payload);return value;}
 function settle(entry,result,allowRejection=false){
  if(allowRejection&&result?.state==='NOT_COMMITTED'&&result.requestId===entry.body.requestId&&result.actorId===actorId&&result.kind===entry.kind&&result.resolution==='DURABLE_NO_COMMIT'){
   if(JSON.stringify(pending())!==JSON.stringify(entry))fail();storage.removeItem(key);return result;
  }
  const expected=entry.kind==='draft'?'DRAFT':entry.kind==='dispatch'?'COMPLETED':states[entry.body.operation];
  if(result?.state!=='COMMITTED'||result.requestId!==entry.body.requestId||!id(result.invoiceId)||entry.kind!=='draft'&&result.invoiceId!==entry.body.invoiceId||result.workflowState!==expected||typeof result.version!=='string'||!/^0x[0-9A-F]{16}$/.test(result.version)||typeof result.replayed!=='boolean')return {state:'UNKNOWN',requestId:entry.body.requestId};
  if(JSON.stringify(pending())!==JSON.stringify(entry))fail();storage.removeItem(key);return result;
 }
 async function send(entry){let result;try{result=await submit(entry.kind,JSON.parse(JSON.stringify(entry.body)));}catch{return {state:'UNKNOWN',requestId:entry.body.requestId};}return settle(entry,result);}
 const lock=work=>locks.request(key,{mode:'exclusive',ifAvailable:true},async held=>{if(!held)fail();return work();});
 return Object.freeze({pending,create:(kind,payload)=>lock(async()=>{if(pending())fail();const body=validate(kind,payload),requestId=newId();if(!uuid(requestId))fail();const entry={kind,body:{requestId,...body}};storage.setItem(key,JSON.stringify(entry));if(JSON.stringify(pending())!==JSON.stringify(entry))fail();return send(entry);}),retry:()=>lock(()=>{const entry=pending();if(!entry)fail();return send(entry);}),resolve:()=>lock(async()=>{const entry=pending();if(!entry)fail();let result;try{result=await submit('resolve',JSON.parse(JSON.stringify(entry)));}catch{return {state:'UNKNOWN',requestId:entry.body.requestId};}return settle(entry,result,true);})});
}
