import {getSqlPool,getSqlDriver} from '../config/database.js';
import {nativeCashCodes,nativeDigest,nativeError,positiveId} from './nativeTerminalPolicy.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';

const grants=new WeakSet(),customerContext=new AsyncLocalStorage();
function grant(customerId,currency){const value=Object.freeze({customerId:Number(customerId),currency});grants.add(value);return value;}
export function withNativeCustomerAccess(value,work){
 if(!grants.has(value))nativeError('NATIVE_CUSTOMER_SCOPE_INVALID','Cari kapsamı doğrulanmadı.',503);
 return customerContext.run(value,work);
}
export function hasNativeCustomerAccess(customerId,currency){
 const value=customerContext.getStore();
 return !!value&&grants.has(value)&&value.customerId===Number(customerId)&&value.currency===currency;
}

export const nativeCustomerRoutesEnabled=()=>process.env.NATIVE_CUSTOMER_ROUTES_ENABLED==='true';
const cashSql="N'1-PEŞİN $',N'2-PEŞİN TL',N'3-PEŞİN €'";

// Legacy registered terminals can have database ID 0. This exception is device-only;
// customer/product IDs remain positive and the queries still require an active device.
function terminalDeviceId(value){
 const validType=typeof value==='number'||(typeof value==='string'&&/^\d+$/.test(value));
 const id=Number(value);
 if(!validType||!Number.isSafeInteger(id)||id<0)nativeError('NATIVE_ID_INVALID','Geçersiz kayıt kimliği.',400);
 return id;
}

export async function lockNativeCustomerRoutes(requestFactory){
 if(!nativeCustomerRoutesEnabled())return;
 const result=await requestFactory().query("DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=N'melisa-terminal-customer-routes-v1',@LockMode=N'Shared',@LockOwner=N'Transaction',@LockTimeout=5000; SELECT @result AS route_lock_result;");
 const value=result.recordset?.[0]?.route_lock_result;
 if(!Number.isInteger(value)||value<0)nativeError('NATIVE_CUSTOMER_SCOPE_BUSY','Rota bilgisi güncelleniyor. Fiş korundu; işlem sonucu kontrol edilmeli.',503);
}

// The snapshot contains only this device's active routes and active customers.
export function customerScopeSnapshot(customers,routes,deviceId){
 terminalDeviceId(deviceId);
 const routeMap=new Map(),ids=new Set(),cash=new Set();
 const invalid=()=>nativeError('NATIVE_CUSTOMER_SCOPE_INVALID','Cihazın cari kapsamı doğrulanamadı.',503);
 for(const r of routes){
  const id=Number(r.id);
  if(!Number.isSafeInteger(id)||id<1||routeMap.has(id)||typeof r.code!=='string'||!r.code||typeof r.name!=='string'||!r.name)invalid();
  routeMap.set(id,{id,code:r.code,name:r.name});
 }
 const normalized=customers.map(c=>{
  const id=Number(c.id),isCash=Object.hasOwn(nativeCashCodes,c.code);
  if(!Number.isSafeInteger(id)||id<1||ids.has(id)||typeof c.name!=='string'||!['TRY','USD','EUR'].includes(c.currency))invalid();
  ids.add(id);
  if(isCash){
   if(nativeCashCodes[c.code]!==c.currency||cash.has(c.code))invalid();
   cash.add(c.code);
   return {id,code:c.code,name:c.name,currency:c.currency,isCash:true,routeId:null,routeName:null};
  }
  const route=routeMap.get(Number(c.routeId));
  if(!route||typeof c.code!=='string'||!c.code)invalid();
  return {id,code:c.code,name:c.name,currency:c.currency,isCash:false,routeId:route.id,routeName:route.name};
 }).sort((a,b)=>a.id-b.id);
 if(cash.size!==Object.keys(nativeCashCodes).length)nativeError('NATIVE_CASH_CUSTOMER_UNAVAILABLE','Üç sabit peşin cari aktif ve doğru dövizde olmalıdır.',503);
 const activeRoutes=[...routeMap.values()].sort((a,b)=>a.id-b.id);
 return {scope:'native-customer-routes-v1',customers:normalized,routes:activeRoutes,customerScopeRevision:nativeDigest({deviceId:Number(deviceId),customers:normalized,routes:activeRoutes})};
}

export async function nativeCustomerScope(operator,{requestFactory,locked=false}={}){
 const sql=getSqlDriver(),deviceId=terminalDeviceId(operator.terminalDeviceId);
 const pool=requestFactory?null:await getSqlPool();
 const request=requestFactory||(()=>pool.request());
 const ready=(await request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.customer_routes',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.customer_route_assignments',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.terminal_device_customer_routes',N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready")).recordset?.[0]?.ready;
 if(!ready)nativeError('NATIVE_CUSTOMER_ROUTES_SCHEMA_REQUIRED','Terminal rota kurulumu henüz tamamlanmadı.',503);
 const lock=locked?' WITH(HOLDLOCK)':'';
 const result=await request().input('routeDevice',sql.BigInt,deviceId).query(`
 SELECT is_active FROM dbo.terminal_devices${lock} WHERE id=@routeDevice;
 SELECT r.id,r.route_code AS code,r.name FROM dbo.customer_routes r${lock}
 INNER JOIN dbo.terminal_device_customer_routes d${lock} ON d.route_id=r.id
 WHERE d.terminal_device_id=@routeDevice AND r.is_active=1 ORDER BY r.id;
 SELECT c.id,c.customer_code AS code,c.name,c.currency_code AS currency,a.route_id AS routeId
 FROM dbo.customers c${lock}
 LEFT JOIN dbo.customer_route_assignments a${lock} ON a.customer_id=c.id
 WHERE c.is_active=1 AND c.is_deleted=0 AND (c.customer_code IN(${cashSql}) OR EXISTS(
 SELECT 1 FROM dbo.customer_routes r${lock}
 INNER JOIN dbo.terminal_device_customer_routes d${lock} ON d.route_id=r.id
 WHERE r.id=a.route_id AND r.is_active=1 AND d.terminal_device_id=@routeDevice)) ORDER BY c.id;
 `);
 if(!result.recordsets?.[0]?.[0]?.is_active)nativeError('NATIVE_CUSTOMER_ROUTE_DENIED','Cihaz aktif değil; cari kapsamı kullanılamaz.',403);
 return customerScopeSnapshot(result.recordsets[2],result.recordsets[1],deviceId);
}

// Called in the existing sale transaction, before any commercial INSERT.
export async function assertNativeCustomerAccess(customer,currency,operator,requestFactory){
 if(!customer||customer.currency_code!==currency)nativeError('NATIVE_CUSTOMER_CHANGED','Cari veya para birimi geçersiz.');
 if(!nativeCustomerRoutesEnabled()){
  if(nativeCashCodes[customer.customer_code]!==currency)nativeError('NATIVE_CUSTOMER_CHANGED','Cari veya para birimi geçersiz.');
  return grant(customer.id,currency);
 }
 if(Object.hasOwn(nativeCashCodes,customer.customer_code)&&nativeCashCodes[customer.customer_code]!==currency)nativeError('NATIVE_CUSTOMER_CHANGED','Peşin cari para birimi geçersiz.');
 const ready=(await requestFactory().query("SELECT CASE WHEN OBJECT_ID(N'dbo.customer_routes',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.customer_route_assignments',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.terminal_device_customer_routes',N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready")).recordset?.[0]?.ready;
 if(!ready)nativeError('NATIVE_CUSTOMER_ROUTES_SCHEMA_REQUIRED','Terminal rota kurulumu henüz tamamlanmadı.',503);
 const sql=getSqlDriver();
 // The target customer is already UPDLOCKed by the caller. Never hold locks on
 // every customer here: overlapping devices could deadlock while finalizing.
 const result=await requestFactory().input('routeDevice',sql.BigInt,terminalDeviceId(operator.terminalDeviceId))
  .input('routeCustomer',sql.BigInt,positiveId(customer.id)).input('routeCash',sql.Bit,nativeCashCodes[customer.customer_code]===currency).query(`
 SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.terminal_devices d WITH(HOLDLOCK)
 WHERE d.id=@routeDevice AND d.is_active=1 AND (@routeCash=1 OR EXISTS(
 SELECT 1 FROM dbo.customer_route_assignments a WITH(HOLDLOCK)
 INNER JOIN dbo.customer_routes r WITH(HOLDLOCK) ON r.id=a.route_id AND r.is_active=1
 INNER JOIN dbo.terminal_device_customer_routes dr WITH(HOLDLOCK) ON dr.route_id=r.id
 WHERE a.customer_id=@routeCustomer AND dr.terminal_device_id=@routeDevice))) THEN 1 ELSE 0 END AS route_allowed;
 `);
 if(result.recordset?.[0]?.route_allowed!==1)nativeError('NATIVE_CUSTOMER_ROUTE_DENIED','Bu cari cihazın güncel rotalarında değil. Fiş korundu; ERP’den rota atamasını kontrol edin.',403);
 return grant(customer.id,currency);
}
