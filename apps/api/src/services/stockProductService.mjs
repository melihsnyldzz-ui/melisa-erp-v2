import {stockProductError,parseStockProductId,parseStockProductQuery,stockProductDto,stockReadTimestamp} from './stockProductModel.mjs';
function actor(user){
  if(!user?.permissions?.includes('product.view'))throw stockProductError('AUTH_PERMISSION_DENIED','Ürün görüntüleme yetkisi gerekli.',403);
  const id=typeof user.id==='number'&&Number.isSafeInteger(user.id)?String(user.id):user.id;
  try{return parseStockProductId(id);}catch{throw stockProductError('AUTH_PERMISSION_DENIED','Geçerli oturum gerekli.',403);}
}
export function createStockProductService({getStore=()=>import('./stockProductReadStore.mjs')}={}){
  async function read(productId,options,user){
    const actorId=actor(user),store=await getStore(),result=await store.readStockProducts({actorId,productId,options});
    if(result?.actorId!==actorId||typeof result.canViewFinance!=='boolean'||!Array.isArray(result.rows)||!Number.isSafeInteger(result.total)||result.total<0
      ||result.page!==options.page||result.limit!==options.limit||!stockReadTimestamp(result.readAt)
      ||result.acceptedCount!==16622||result.syntheticCount!==3||result.quarantinedCount!==54
      ||result.rows.length!==Math.min(options.limit,Math.max(0,result.total-(options.page-1)*options.limit)))throw stockProductError();
    const canViewFinance=result.canViewFinance&&user.permissions.includes('purchase.view');
    const data=result.rows.map(row=>stockProductDto(row,{sqlFinance:result.canViewFinance,canViewFinance,financialExpected:productId!==null&&result.canViewFinance}));
    if(new Set(data.map(row=>row.id)).size!==data.length||productId!==null&&(result.total>1||data.some(row=>row.id!==productId)))throw stockProductError();
    return {data,meta:{total:result.total,page:options.page,limit:options.limit,totalPages:Math.ceil(result.total/options.limit),readOnly:true,sourceAsOf:'2026-09-30',freshLive:false,readAt:result.readAt,canViewFinance,scopeCounts:{acceptedOpening:result.acceptedCount,syntheticTest:result.syntheticCount,quarantinedSource:result.quarantinedCount}}};
  }
  return {
    list:(query,user)=>read(null,parseStockProductQuery(query),user),
    async detail(rawId,user){const id=parseStockProductId(rawId),result=await read(id,{...parseStockProductQuery(),limit:1},user);if(!result.data.length)throw stockProductError('STOCK_PRODUCT_NOT_FOUND','Ürün kartı bulunamadı.',404);return {...result,data:result.data[0]};},
  };
}
export const stockProductService=createStockProductService();
