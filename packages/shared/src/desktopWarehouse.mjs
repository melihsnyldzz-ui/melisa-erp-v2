// The warehouse boundary deliberately has no commercial/customer fields.
export const DESKTOP_WAREHOUSE_PERMISSIONS=Object.freeze({VIEW:'warehouse.view',PREPARE:'warehouse.prepare',PACK:'warehouse.pack'});
export const DESKTOP_WAREHOUSE_OPERATIONS=Object.freeze(['PREPARE','SAVE_CARTONS','READY']);
const operationPermissions=Object.freeze({PREPARE:DESKTOP_WAREHOUSE_PERMISSIONS.PREPARE,SAVE_CARTONS:DESKTOP_WAREHOUSE_PERMISSIONS.PACK,READY:DESKTOP_WAREHOUSE_PERMISSIONS.PACK});
export const desktopWarehousePermissionForOperation=op=>typeof op==='string'&&Object.hasOwn(operationPermissions,op)?operationPermissions[op]:null;
const exact=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const version=v=>typeof v==='string'&&/^0x[0-9A-F]{16}$/.test(v);
const quantity=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(v)&&BigInt(v.replace('.',''))>0n;
const units=v=>BigInt(v.replace('.',''));
function date(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const [y,m,d]=v.split('-').map(Number),days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>=1900&&m>=1&&m<=12&&d>=1&&d<=days[m-1];
}
const headerKeys=['invoiceId','documentNo','documentDate','workflowState','version'];
const header=v=>id(v.invoiceId)&&text(v.documentNo,100)&&date(v.documentDate)&&['DRAFT','PREPARING','READY','CHECKED','COMPLETED','CANCELLED'].includes(v.workflowState)&&version(v.version);
const safe=fn=>value=>{try{return fn(value)===true;}catch{return false;}};
export const isDesktopWarehouseWorkflow=safe(v=>{
 if(!exact(v,['scope',...headerKeys,'items','cartonItems'])||v.scope!=='warehouse'||!header(v)||!Array.isArray(v.items)||v.items.length<1||v.items.length>2||!Array.isArray(v.cartonItems)||v.cartonItems.length>200)return false;
 const items=new Map(),products=new Set(),packed=new Map(),seen=new Set();
 for(const x of v.items){
  if(!exact(x,['itemId','productId','stockCode','name','barcode','quantityExact3'])||!id(x.itemId)||!id(x.productId)||items.has(x.itemId)||products.has(x.productId)||!text(x.stockCode,100)||!text(x.name,250)||!(x.barcode===null||text(x.barcode,100))||!quantity(x.quantityExact3))return false;
  items.set(x.itemId,x);products.add(x.productId);packed.set(x.itemId,0n);
 }
 for(const x of v.cartonItems){
  if(!exact(x,['cartonNo','itemId','productId','quantityExact3'])||!Number.isSafeInteger(x.cartonNo)||x.cartonNo<1||x.cartonNo>100||!quantity(x.quantityExact3))return false;
  const item=items.get(x.itemId),key=`${x.cartonNo}:${x.itemId}`;
  if(!item||x.productId!==item.productId||seen.has(key))return false;
  seen.add(key);packed.set(x.itemId,packed.get(x.itemId)+units(x.quantityExact3));
 }
 return [...items.values()].every(x=>packed.get(x.itemId)<=units(x.quantityExact3));
});
export const isDesktopWarehouseList=safe(v=>{
 if(!exact(v,['scope','page','limit','hasNext','data'])||v.scope!=='warehouse'||!Number.isSafeInteger(v.page)||v.page<1||v.page>10000||v.limit!==100||typeof v.hasNext!=='boolean'||!Array.isArray(v.data)||v.data.length>100||v.hasNext&&v.data.length!==100)return false;
 const seen=new Set();let previous=null;
 for(const x of v.data){if(!exact(x,headerKeys)||!header(x)||seen.has(x.invoiceId)||previous!==null&&BigInt(previous)<=BigInt(x.invoiceId))return false;seen.add(x.invoiceId);previous=x.invoiceId;}
 return true;
});
export const isDesktopWarehouseResult=safe(v=>exact(v,['state','requestId','invoiceId','operation','workflowState','version','replayed'])&&v.state==='COMMITTED'&&uuid(v.requestId)&&id(v.invoiceId)&&desktopWarehousePermissionForOperation(v.operation)!==null&&v.workflowState===(v.operation==='READY'?'READY':'PREPARING')&&version(v.version)&&typeof v.replayed==='boolean');
export const isDesktopWarehouseResolution=safe(v=>isDesktopWarehouseResult(v)||exact(v,['state','requestId','actorId','kind','resolution'])&&v.state==='NOT_COMMITTED'&&uuid(v.requestId)&&id(v.actorId)&&v.kind==='transition'&&v.resolution==='DURABLE_NO_COMMIT');
const assertion=check=>value=>{if(!check(value))throw Error('DESKTOP_WAREHOUSE_RESPONSE_INVALID');return value;};
export const assertDesktopWarehouseWorkflow=assertion(isDesktopWarehouseWorkflow);
export const assertDesktopWarehouseList=assertion(isDesktopWarehouseList);
export const assertDesktopWarehouseResult=assertion(isDesktopWarehouseResult);
export const assertDesktopWarehouseResolution=assertion(isDesktopWarehouseResolution);
