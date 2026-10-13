import {copyAssert,assertIsolatedCopyContext} from './isolatedOperationCopyContext.mjs';
import {BUSINESS_PRICE_COPY_ID} from '../../../../scripts/canonical/shared-business-product-price-revision-contract.mjs';
import {configureBusinessProductPriceRevision} from '../../../../scripts/canonical/shared-business-product-price-bootstrap.mjs';
import {configureBusinessProductPriceSaleRevision} from '../../../../scripts/canonical/shared-business-product-price-sale-bootstrap.mjs';

// The private startup descriptor pins prospective definitions; it cannot
// install objects, alter a role or grant capability without fresh native proof.
export function validateBusinessProductPriceStartup(config,copy){
  assertIsolatedCopyContext(copy);
  const value=config.businessProductPriceRevisions;
  if(value===undefined)return null;
  copyAssert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()==='consumer,metadata'&&config.businessSelectedSaleStartup&&copy.copyId===BUSINESS_PRICE_COPY_ID,'BUSINESS_PRICE_STARTUP_CONFIG');
  copyAssert(value.metadata?.version===12&&value.consumer?.version===13&&value.metadata.copyId===copy.copyId&&value.consumer.copyId===copy.copyId&&value.metadata.baseSealHash===copy.sealHash&&value.consumer.baseSealHash===copy.sealHash&&value.consumer.basePriceRevisionHash===value.metadata.revisionHash,'BUSINESS_PRICE_STARTUP_PINS');
  return value;
}
export async function configureBusinessProductPriceStartup(config,copy,request,input){
  const value=validateBusinessProductPriceStartup(config,copy);
  if(!value)return null;
  copyAssert(input?.schemaVersion==='melisa-selected-sale-startup-input.v6'&&input.stockPredicateRevision?.version===11,'BUSINESS_PRICE_STARTUP_V11');
  await configureBusinessProductPriceRevision(copy,value.metadata,request);
  return configureBusinessProductPriceSaleRevision(copy,value.consumer,request,{selectedBaseInput:{daily:input.daily,profit:input.profit,schema:input.schema}});
}
