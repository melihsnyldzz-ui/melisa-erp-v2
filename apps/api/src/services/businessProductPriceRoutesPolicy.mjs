import {getRegisteredBusinessProductPriceRevision} from '../../../../scripts/canonical/shared-business-product-price-bootstrap.mjs';

// A server-held, native-verified registration is required in addition to the
// route's normal actor permissions. This never expands the old fixture route.
export function isBusinessProductPriceWriteAllowed(method,path,copy){
  if(method!=='POST'||!copy)return false;
  const match=/^\/api\/products\/([1-9]\d*)\/current-prices$/.exec(path);
  if(!match||getRegisteredBusinessProductPriceRevision(copy)?.canEdit!==true)return false;
  return copy.products.some(p=>p.id===match[1]&&p.identityVerified&&p.sourceKnown&&!p.quarantined&&p.unit==='ADET'&&p.unitFactorExact8==='1.00000000');
}
