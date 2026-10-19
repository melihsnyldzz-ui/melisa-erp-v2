// The existing validators run against a private clone. Returned/rendered DTOs
// retain the explicit cloud source; no SQL/native provenance is manufactured.
export function validateCloudContext(value,validate) {
  if(value?.meta?.source!=='cloud-shared-synthetic'||value.meta.cloudSynthetic!==true||value.scope?.synthetic!==true||
     ['operationOrigin','copyId','sealHash','testProfile','selectedSale','pricingProof'].some(key=>Object.hasOwn(value.meta,key))||Object.hasOwn(value,'pricingProof'))throw Error('Sentetik Cloud TEST bağlamı doğrulanamadı.');
  const privateValue=structuredClone(value);
  privateValue.meta.source='native-test';
  validate(privateValue);
  return value;
}
