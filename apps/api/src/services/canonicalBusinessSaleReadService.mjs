import {getCanonicalBusinessSession,assertCanonicalBusinessSession,BUSINESS_SESSION} from './canonicalBusinessSessionContext.mjs';
import {parseBusinessSaleReadQuery,buildBusinessSaleReadSelection,businessSaleReadSchema,businessSaleReadError} from './canonicalBusinessSaleReadModel.mjs';
export function createCanonicalBusinessSaleReadService({authority=()=>assertCanonicalBusinessSession(getCanonicalBusinessSession()),readCustomer=async id=>(await import('./customerCardService.mjs')).customerCardService.detail(id),readProduct=async(id,user)=>(await import('./catalogProductService.mjs')).catalogProductService.detail(id,user)}={}){
 function authorize(user){
  const c=authority();
  if(c?.userId!==17||c.username!==BUSINESS_SESSION.username||c.roleId!==17||c.roleCode!==BUSINESS_SESSION.roleCode||c.database!==BUSINESS_SESSION.database||c.server!==BUSINESS_SESSION.server||c.actualT1!==false||c.externalOperations!==false||!Array.isArray(c.permissions))throw businessSaleReadError('BUSINESS_SALE_READER_NOT_READY',503);
  if(String(user?.id)!=='17'||user.username!==c.username||String(user.role?.id)!=='17'||user.role.code!==c.roleCode||user.isActive===false||user.isAdmin===true||user.testAdminSession===true||!Array.isArray(user.permissions)||!['sales.view','customer.view','product.view'].every(k=>user.permissions.includes(k))||JSON.stringify([...user.permissions].sort())!==JSON.stringify([...c.permissions].sort()))throw businessSaleReadError('AUTH_PERMISSION_DENIED',403);
  return c;
 }
 return {async selection(query,user){
  const context=authorize(user),selection=parseBusinessSaleReadQuery(query);
  const [customer,catalog]=await Promise.all([readCustomer(selection.customerId),readProduct(selection.productId,user)]);
  if(authorize(user)!==context)throw businessSaleReadError('BUSINESS_SALE_READER_CHANGED',409);
  return {data:buildBusinessSaleReadSelection(selection,customer,catalog),meta:{schemaVersion:businessSaleReadSchema,profile:BUSINESS_SESSION.id,actorId:'17',readOnly:true,actualT1:false,externalOperations:false,writeAuthorized:false}};
 }};
}
export const canonicalBusinessSaleReadService=createCanonicalBusinessSaleReadService();
