const key='melisa.customer-contact.pending.v1';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const valid=v=>v&&Object.keys(v).sort().join()==='actorId,copyId,customerId,requestId,sealHash'&&typeof v.actorId==='number'&&Number.isSafeInteger(v.actorId)&&v.actorId>0&&typeof v.customerId==='string'&&/^[1-9]\d{0,18}$/.test(v.customerId)&&uuid(v.requestId)&&uuid(v.copyId)&&typeof v.sealHash==='string'&&/^[A-F0-9]{64}$/.test(v.sealHash);
// Only request/scope identifiers persist. Never contact fields, name, token,
// request body or response. A marker is a warning, never authorization.
export function createCustomerContactPendingMarker(storage,kind='customer'){
 if(!['customer','supplier'].includes(kind))throw Error('Pending contact kind invalid');
 const storageKey=kind==='customer'?key:'melisa.supplier-contact.pending.v1';
 return Object.freeze({
  read(){const raw=storage.getItem(storageKey);if(raw===null)return null;let v;try{v=JSON.parse(raw);}catch{throw Error('Pending contact marker invalid');}if(!valid(v))throw Error('Pending contact marker invalid');return v;},
  put(v){if(!valid(v))throw Error('Pending contact marker invalid');const previous=this.read();if(previous&&JSON.stringify(previous)!==JSON.stringify(v))throw Error('Another contact request is unresolved');storage.setItem(storageKey,JSON.stringify(v));if(storage.getItem(storageKey)!==JSON.stringify(v))throw Error('Pending contact marker unavailable');},
  clear(v){const current=this.read();if(current&&JSON.stringify(current)===JSON.stringify(v))storage.removeItem(storageKey);},
 });
}
