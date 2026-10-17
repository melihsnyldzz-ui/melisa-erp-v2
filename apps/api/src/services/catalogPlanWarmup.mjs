import {canonicalTestAdminContext,testAdminClaims} from './canonicalTestAdminSession.mjs';
import {catalogReadResult,parseCatalogQuery} from './catalogModel.mjs';
const unavailable=()=>Object.assign(new Error('Ürün kataloğu başlangıçta doğrulanamadı.'),{code:'CATALOG_STARTUP_UNAVAILABLE',statusCode:503});
// Compile through the normal, fully guarded reader. Results are discarded.
export async function warmCatalogPlan(context,{getUser=async id=>(await import('./authService.js')).getUserById(id),getStore=()=>import('./catalogProductReadStore.mjs')}={}){
 try{
  canonicalTestAdminContext(context);
  const actorId=testAdminClaims.sub,user=await getUser(actorId);
  if(String(user?.id)!==actorId||!Array.isArray(user.permissions)||!user.permissions.includes('product.view')||!user.permissions.includes('sales.view'))throw unavailable();
  const store=await getStore(),options=parseCatalogQuery({limit:'50'});
  const list=catalogReadResult(await store.readCatalogProducts({actorId,productId:null,options}),{actorId,options,canViewSalesPrices:true});
  if(!list.meta.canViewSalesPrices)throw unavailable();
  const selected=list.data.find(row=>row.provenance.kind==='accepted-opening'&&!row.hold.blocked);
  if(!selected)throw unavailable();
  const detailOptions={...options,limit:1};
  const detail=catalogReadResult(await store.readCatalogProducts({actorId,productId:selected.id,options:detailOptions}),{actorId,productId:selected.id,options:detailOptions,canViewSalesPrices:true});
  if(detail.data.length!==1||!detail.meta.canViewSalesPrices||detail.data[0].provenance.kind!=='accepted-opening'||detail.data[0].hold.blocked)throw unavailable();
  return {warmed:true};
 }catch{throw unavailable();}
}
