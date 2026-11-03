import {createCanonicalCustomerMasterBinding} from './customerMasterCanonicalBinding.mjs';
import {customerMasterError} from './customerMasterModel.mjs';
import {createCustomerMasterMetadataCheckAssets} from './customerMasterMetadataCheckAssets.mjs';

// Existing canonical bootstrap only. Reuse the exact pool it has already
// connected/admitted; never reacquire or create a connection for metadata.
export async function prepareCanonicalCustomerMasterMetadata({startup,database,getFinalContext,getCurrentFinanceContext}={}){
 const pool=startup?.pool;
 if(!pool||pool.connected!==true||pool.connecting!==false||typeof database?.getSqlDriver!=='function')throw customerMasterError();
 const existingDatabase=Object.freeze({
  isCanonicalTest:()=>database.isCanonicalTest(),
  isIsolatedOperationCopyRuntime:()=>database.isIsolatedOperationCopyRuntime(),
  getSqlPool:async()=>pool,
  getSqlDriver:()=>database.getSqlDriver()
 });
 const binding=await createCanonicalCustomerMasterBinding({database:existingDatabase,startup,getFinalContext,getCurrentFinanceContext});
 // Do not return or register binding.service/store/cards. Preparing this route
 // does not enable the global master writer or run any metadata request.
 return Object.freeze({read:binding.metadata.read,checkAssets:createCustomerMasterMetadataCheckAssets(startup.release)});
}
