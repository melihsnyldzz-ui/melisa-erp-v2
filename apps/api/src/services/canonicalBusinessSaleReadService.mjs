import {getCanonicalBusinessSession,assertCanonicalBusinessSession,BUSINESS_SESSION} from './canonicalBusinessSessionContext.mjs';
import {parseBusinessSaleReadQuery,buildBusinessSaleReadSelection,businessSaleReadSchema,businessSaleReadError} from './canonicalBusinessSaleReadModel.mjs';
import {workSelectedSaleInput} from './workSalesService.mjs';
import {workKeys,workFail} from './workSalesModel.mjs';
export function createCanonicalBusinessSaleReadService({authority=()=>assertCanonicalBusinessSession(getCanonicalBusinessSession()),readCustomer=async id=>(await import('./customerCardService.mjs')).customerCardService.detail(id),readProduct=async(id,user)=>(await import('./catalogProductService.mjs')).catalogProductService.detail(id,user)}={}){
 function authorize(user){
  const c=authority();
  if(c?.userId!==17||c.username!==BUSINESS_SESSION.username||c.roleId!==17||c.roleCode!==BUSINESS_SESSION.roleCode||c.database!==BUSINESS_SESSION.database||c.server!==BUSINESS_SESSION.server||c.actualT1!==false||c.externalOperations!==false||!Array.isArray(c.permissions))throw businessSaleReadError('BUSINESS_SALE_READER_NOT_READY',503);
  if(String(user?.id)!=='17'||user.username!==c.username||String(user.role?.id)!=='17'||user.role.code!==c.roleCode||user.isActive===false||user.isAdmin===true||user.testAdminSession===true||!Array.isArray(user.permissions)||!['sales.view','customer.view','product.view'].every(k=>user.permissions.includes(k))||JSON.stringify([...user.permissions].sort())!==JSON.stringify([...c.permissions].sort()))throw businessSaleReadError('AUTH_PERMISSION_DENIED',403);
  return c;
 }
 async function selection(query,user){
  const context=authorize(user),selection=parseBusinessSaleReadQuery(query);
  const [customer,catalog]=await Promise.all([readCustomer(selection.customerId),readProduct(selection.productId,user)]);
  if(authorize(user)!==context)throw businessSaleReadError('BUSINESS_SALE_READER_CHANGED',409);
  return {data:buildBusinessSaleReadSelection(selection,customer,catalog),meta:{schemaVersion:businessSaleReadSchema,profile:BUSINESS_SESSION.id,actorId:'17',readOnly:true,actualT1:false,externalOperations:false,writeAuthorized:false}};
 }
 // Preparation only: no route, transaction authority, preview hash or invoice
 // total is issued here. The native owner must bind the account and acquire its
 // own fresh context/preview before using this existing sales input contract.
 async function prepareNativeSelection(input,user){
  const context=authorize(user);
  workKeys(input,['documentDate','lines']);
  if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>200)workFail('WORK_ITEMS_INVALID','Satış kalemleri geçersiz.');
  const rows=input.lines.map(row=>{
   workKeys(row,['selection','quantity']);
   const query=parseBusinessSaleReadQuery(row.selection);
   if(typeof row.quantity!=='string'||!/^[1-9]\d{0,13}$/.test(row.quantity))workFail('WORK_QUANTITY_INVALID','Pozitif tam ana birim miktarı gerekli.');
   return {query,quantity:row.quantity};
  });
  const first=rows[0].query;
  if(rows.some(({query})=>['customerId','accountId','currency'].some(key=>query[key]!==first[key])))workFail('WORK_CUSTOMER_SCOPE','Tek müşteri döviz hesabı seçilmelidir.',409);
  // Reuse native validation, including its unique-product and quantity limits.
  // Different quotes for one product cannot be silently combined or averaged.
  const nativeSelection=workSelectedSaleInput({customerId:first.customerId,documentDate:input.documentDate,currency:first.currency,items:rows.map(({query,quantity})=>({productId:query.productId,quoteId:query.priceId,quantityExact3:`${quantity}.000`}))});
  const selections=[];
  for(const row of rows){
   const fresh=await selection(row.query,user);
   if(!fresh.data.selectionVerified)workFail('WORK_PRODUCT_SCOPE','Seçilen hesap veya ürün doğrulanamadı.',409);
   if(BigInt(fresh.data.product.stockQuantityExact.replace('.',''))<BigInt(row.quantity)*100000000n)workFail('WORK_STOCK_OR_PRICE','Seçilen miktar için yeterli doğrulanmış stok yok.',409);
   selections.push(fresh.data);
  }
  if(authorize(user)!==context)throw businessSaleReadError('BUSINESS_SALE_READER_CHANGED',409);
  return {data:{nativeSelection,binding:{customerId:first.customerId,accountId:first.accountId,currency:first.currency},selections,capabilities:{canSave:false,canFinalize:false,canCollect:false}},meta:{schemaVersion:'melisa-business-sale-native-preparation.v1',profile:BUSINESS_SESSION.id,actorId:'17',readOnly:true,actualT1:false,externalOperations:false,writeAuthorized:false,atomic:false,requiresNativeContext:true,requiresNativePreview:true}};
 }
 return {assertActor:authorize,selection,prepareNativeSelection};
}
export const canonicalBusinessSaleReadService=createCanonicalBusinessSaleReadService();
