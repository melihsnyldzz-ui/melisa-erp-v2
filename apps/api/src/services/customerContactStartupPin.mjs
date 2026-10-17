import {copyAssert,assertIsolatedCopyContext,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {CUSTOMER_CONTACT_NEW_MODULES,CUSTOMER_CONTACT_PREDECESSOR_NAMES,CUSTOMER_CONTACT_REVISION_SCHEMA} from '../../../../scripts/canonical/shared-business-customer-contact-contract.mjs';
import {customerContactHash,customerContactJSON} from '../../../../scripts/canonical/shared-business-customer-contact-sql.mjs';

const hash=value=>typeof value==='string'&&/^[A-F0-9]{64}$/.test(value);

// A config descriptor can only identify an already-installed, natively proved
// successor. It is not an installer and cannot manufacture a write capability.
export function validateCustomerContactStartup(config,copy){
 assertIsolatedCopyContext(copy);const revision=config.customerContactRevision;
 if(revision===undefined)return null;
 copyAssert(copy.target.database===BUSINESS_COPY_DATABASE&&config.businessSelectedSaleStartup&&config.businessProductPriceRevisions,'CUSTOMER_CONTACT_STARTUP_DEPENDENCIES');
 copyAssert(revision&&typeof revision==='object'&&!Array.isArray(revision)&&revision.schemaVersion===CUSTOMER_CONTACT_REVISION_SCHEMA&&revision.version===1&&revision.copyId===copy.copyId&&revision.baseSealHash===copy.sealHash&&revision.profileHash===customerContactHash(customerContactJSON(copy))&&revision.scope?.profileHash===revision.profileHash&&revision.scope?.sealHash===copy.sealHash,'CUSTOMER_CONTACT_STARTUP_PINS');
 const expected=[...CUSTOMER_CONTACT_PREDECESSOR_NAMES,...CUSTOMER_CONTACT_NEW_MODULES,'dbo.fn_customer_contact_predecessor_hash_v1'];
 copyAssert(Array.isArray(revision.modules)&&revision.modules.length===expected.length&&revision.modules.every((module,index)=>module?.name===expected[index]&&hash(module.afterHash)&&(index<CUSTOMER_CONTACT_PREDECESSOR_NAMES.length?hash(module.beforeHash):module.beforeHash===null)),'CUSTOMER_CONTACT_STARTUP_MODULES');
 const {revisionHash,...body}=revision;copyAssert(hash(revisionHash)&&customerContactHash(customerContactJSON(body))===revisionHash,'CUSTOMER_CONTACT_STARTUP_HASH');return revision;
}
