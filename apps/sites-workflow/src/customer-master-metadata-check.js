import {createWorkingCatalogSession} from './workflow/workingCatalogSession.mjs';
import {businessWorkfaceId} from './workflow/businessWorkface.mjs';
import {createCustomerMasterMetadataCheck} from './workflow/customerMasterMetadataCheck.mjs';

// Same-origin normal application transport. No token/cookie inspection,
// credential provisioning, account switching or alternate API connection.
const root=document.getElementById('customer-master-metadata-check');
if(root){
 const session=createWorkingCatalogSession({location:window.location,apiBase:'http://127.0.0.1:4144',storage:window.localStorage,businessProfile:businessWorkfaceId});
 const controller=createCustomerMasterMetadataCheck({root,session});
 void controller.mount();
 window.addEventListener('pagehide',()=>{controller.dispose();session.dispose();},{once:true});
}
