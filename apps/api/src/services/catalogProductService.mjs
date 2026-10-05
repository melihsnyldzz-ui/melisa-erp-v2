import {catalogError,parseCatalogId,parseCatalogQuery,catalogReadResult} from './catalogModel.mjs';
function actor(user){
  if(!Array.isArray(user?.permissions)||!user.permissions.includes('product.view'))throw catalogError('AUTH_PERMISSION_DENIED','Ürün görüntüleme yetkisi gerekli.',403);
  const id=typeof user.id==='number'&&Number.isSafeInteger(user.id)?String(user.id):user.id;
  try{return parseCatalogId(id);}catch{throw catalogError('AUTH_PERMISSION_DENIED','Geçerli oturum gerekli.',403);}
}
export function createCatalogProductService({getStore=()=>import('./catalogProductReadStore.mjs')}={}){
  async function read(productId,options,user){const actorId=actor(user),store=await getStore();const result=await store.readCatalogProducts({actorId,productId,options});return catalogReadResult(result,{actorId,productId,options,canViewSalesPrices:user.permissions.includes('sales.view')});}
  return {list:(query,user)=>read(null,parseCatalogQuery(query),user),async detail(rawId,user){const id=parseCatalogId(rawId),result=await read(id,{...parseCatalogQuery(),limit:1},user);if(!result.data.length)throw catalogError('CATALOG_NOT_FOUND','Ürün kartı bulunamadı.',404);return {...result,data:result.data[0]};}};
}
export const catalogProductService=createCatalogProductService();
