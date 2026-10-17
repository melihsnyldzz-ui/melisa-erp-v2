import {copyAssert} from './isolatedOperationCopyContext.mjs';
import {validateCustomerContactStartup} from './customerContactStartupPin.mjs';
import {configureCustomerContactRevision,withCustomerContactCompatibilityProof} from '../../../../scripts/canonical/shared-business-customer-contact-bootstrap.mjs';
export {validateCustomerContactStartup};

export async function configureCustomerContactStartup(config,copy,request,configurePredecessors,{contextClass='ERP',register=contextClass==='ERP'}={}){
 const revision=validateCustomerContactStartup(config,copy);if(!revision)return configurePredecessors(request);
 copyAssert(typeof configurePredecessors==='function'&&typeof request?.query==='function','CUSTOMER_CONTACT_STARTUP_REQUEST');
 const value=await withCustomerContactCompatibilityProof(copy,request,revision,async project=>{
  const compatible=Object.create(request);compatible.query=async sql=>project(await request.query(sql));
  return configurePredecessors(compatible);
 },{contextClass});
 if(register)await configureCustomerContactRevision(copy,revision,request,{nativeDescriptor:true});
 return value;
}
