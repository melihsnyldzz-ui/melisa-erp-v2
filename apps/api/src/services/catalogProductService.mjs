import {isIsolatedOperationCopyRuntime,getIsolatedOperationCopyConfig} from '../config/isolatedOperationCopyRuntime.mjs';
import {isBusinessProductPriceWriteAllowed} from './businessProductPriceRoutesPolicy.mjs';
import {catalogError,parseCatalogId,parseCatalogQuery,catalogReadResult} from './catalogModel.mjs';
import {catalogMediaStore,parseCatalogMediaVariant} from './catalogMediaStore.mjs';
function actor(user){
  if(!Array.isArray(user?.permissions)||!user.permissions.includes('product.view'))throw catalogError('AUTH_PERMISSION_DENIED','Ürün görüntüleme yetkisi gerekli.',403);
  const id=typeof user.id==='number'&&Number.isSafeInteger(user.id)?String(user.id):user.id;
  try{return parseCatalogId(id);}catch{throw catalogError('AUTH_PERMISSION_DENIED','Geçerli oturum gerekli.',403);}
}
export function createCatalogProductService({getStore=()=>import('./catalogProductReadStore.mjs'),mediaStore=catalogMediaStore}={}){
  async function read(productId,options,user){const actorId=actor(user),store=await getStore();const mediaBindingsJson=options.image==='all'?'[]':mediaStore.filterBindingsJson();const result=await store.readCatalogProducts({actorId,productId,options,mediaBindingsJson});const validated=catalogReadResult(result,{actorId,productId,options,canViewSalesPrices:user.permissions.includes('sales.view')});const projected=result.businessPriceProjection??validated.data;if(!Array.isArray(projected)||projected.length!==validated.data.length||projected.some((r,i)=>r.id!==validated.data[i].id))throw catalogError();const data=projected.map(row=>({...row,salePrices:validated.meta.canViewSalesPrices?row.salePrices:[],photo:mediaStore.photoFor(row)}));if(options.image!=='all'&&data.some(row=>(row.photo.status==='available')!==(options.image==='available')))throw catalogError();return {...validated,data};}
  async function detail(rawId,user){const id=parseCatalogId(rawId),result=await read(id,{...parseCatalogQuery(),limit:1},user);if(!result.data.length)throw catalogError('CATALOG_NOT_FOUND','Ürün kartı bulunamadı.',404);const copy=isIsolatedOperationCopyRuntime()?getIsolatedOperationCopyConfig():null;const canEdit=String(user.id)==='16'&&['product.view','purchase.view','product.price.edit'].every(p=>user.permissions.includes(p))&&isBusinessProductPriceWriteAllowed('POST','/api/products/'+id+'/current-prices',copy);return {...result,data:result.data[0],meta:{...result.meta,...(canEdit?{productPriceEdit:{enabled:true,productIds:[id]}}:{})}};}
  return {list:(query,user)=>read(null,parseCatalogQuery(query),user),detail,async photo(rawId,query,user){const variant=parseCatalogMediaVariant(query),current=await detail(rawId,user);return mediaStore.readPhoto(current.data,variant);}};
}
export const catalogProductService=createCatalogProductService();
