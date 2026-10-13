import {copyAssert,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {validateBusinessProductPriceSaleDTO} from './businessProductPriceSaleModel.mjs';
import {getRegisteredBusinessProductPriceSaleRevision} from '../../../../scripts/canonical/shared-business-product-price-sale-bootstrap.mjs';
import {assertPreparedBusinessProductPriceSaleArtifact} from '../../../../scripts/canonical/shared-business-product-price-sale-sql.mjs';
const nativeDTOs=new WeakMap();
const matches=(dto,info)=>isolatedCopyJSON(dto?.pricingProof)===isolatedCopyJSON(info.proof)&&info.rows.every(row=>{
 const products=dto?.scope?.products?.filter(p=>p.id===row.productId),quotes=products?.[0]?.prices?.filter(q=>q.quoteId===row.quoteId&&q.currency===row.currency);
 return products?.length===1&&quotes?.length===1&&quotes[0].unitPriceExact8===row.pricing.priceExact8&&isolatedCopyJSON(quotes[0].pricing)===isolatedCopyJSON(row.pricing);
})&&new Set(dto.scope.products.map(p=>p.id)).size===dto.scope.products.length&&dto.scope.products.every(p=>info.rows.some(r=>r.productId===p.id))&&dto.scope.products.reduce((n,p)=>n+p.prices.length,0)===info.rows.length;

// Only the proven native read/intent methods call this inside their live frame.
// A pricing property, copied JSON or pure proof validator grants no authority.
export function bindBusinessProductPriceSaleDTO({copy,transaction,artifact,dto,pricingJson,mode='CURRENT',invoiceId=null}){
 copyAssert(isolatedCopyTransactionContext(transaction,{writeRequired:false})===copy,'PRICE_SALE_DTO_TRANSACTION');
 const registered=getRegisteredBusinessProductPriceSaleRevision(copy),bundle=registered?.bundle;
 const kind=artifact===bundle?.contextArtifact?'context':artifact===bundle?.writeScopeArtifact?'intent':artifact===bundle?.historyArtifact?'history':null;
 copyAssert(kind,'PRICE_SALE_DTO_REGISTERED_ARTIFACT');assertPreparedBusinessProductPriceSaleArtifact(artifact,copy,kind);
 const expected={profileHash:artifact.profileHash,priceRevisionHash:artifact.priceRevisionHash,saleRevisionHash:artifact.saleRevisionHash,readerDefinitionHash:kind==='intent'?bundle.contextArtifact.definitionHash:artifact.definitionHash};
 const verified=validateBusinessProductPriceSaleDTO(copy,dto,pricingJson,expected,{mode,invoiceId});
 const info=Object.freeze({copy,transaction,proof:verified.proof,rows:verified.rows,pricingJson});nativeDTOs.set(dto,info);return dto;
}
export function getBusinessProductPriceSaleDTO(copy,dto,{transaction=null}={}){
 const info=nativeDTOs.get(dto);if(!info)return null;
 copyAssert(info.copy===copy&&(!transaction||transaction===info.transaction)&&isolatedCopyTransactionContext(info.transaction,{writeRequired:false})===copy&&matches(dto,info),'PRICE_SALE_DTO_CHANGED');return info;
}
export function transferBusinessProductPriceSaleDTO(copy,sourceDTO,targetDTO){
 const info=getBusinessProductPriceSaleDTO(copy,sourceDTO);copyAssert(info&&matches(targetDTO,info),'PRICE_SALE_DTO_TRANSFER');nativeDTOs.set(targetDTO,info);return targetDTO;
}
export function clearBusinessProductPriceSaleDTO(dto){return nativeDTOs.delete(dto);}
