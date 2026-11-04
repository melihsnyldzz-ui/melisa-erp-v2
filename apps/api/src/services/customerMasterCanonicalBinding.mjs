// A prepared binding, not an installer or auto-enabled writer. An admitted
// bootstrap must explicitly supply its existing database/runtime first.
import {createCanonicalCustomerMasterRuntime} from './customerMasterCanonicalRuntime.mjs';
import {createCustomerMasterSqlStore} from './customerMasterSqlStore.mjs';
import {createCustomerMasterService} from './customerMasterService.mjs';
import {createCustomerCardService} from './customerCardService.mjs';
import {createCustomerCardReadStore} from './customerCardReadStore.mjs';
import {createCustomerMasterMetadataReader} from './customerMasterMetadata.mjs';
export async function createCanonicalCustomerMasterBinding(options){
 const runtime=await createCanonicalCustomerMasterRuntime(options);
 const store=createCustomerMasterSqlStore({getRuntime:()=>runtime});
 const source=createCustomerCardReadStore({getRuntime:()=>runtime,getCopyContext:()=>null,getFinalContext:options?.getFinalContext,getCurrentFinanceContext:options?.getCurrentFinanceContext});
 return Object.freeze({store,service:createCustomerMasterService({getStore:()=>store}),cards:createCustomerCardService({getStore:()=>source,masterProjection:store}),metadata:createCustomerMasterMetadataReader({getRuntime:()=>runtime})});
}
