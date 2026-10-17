// Source-only contact successor. These constants never activate a database.
export const CUSTOMER_CONTACT_CONTEXT_SCHEMA='melisa-customer-contact-context.v1';
export const CUSTOMER_CONTACT_REVISION_SCHEMA='melisa-customer-contact-revision.v1';
export const CUSTOMER_CONTACT_CONTEXT='dbo.usp_business_customer_contact_context_v1';
export const CUSTOMER_CONTACT_UPDATE='dbo.usp_business_customer_contact_update_v1';
export const CUSTOMER_CONTACT_PROOF='dbo.usp_business_customer_contact_proof_v1';
export const CUSTOMER_CONTACT_REGISTRY='dbo.stage4_copy_customer_contact_revisions';
export const CUSTOMER_CONTACT_IMMUTABLE='dbo.immutable_stage4_copy_customer_contact_revisions';
export const CUSTOMER_CONTACT_PROJECTOR='dbo.fn_customer_contact_predecessor_hash_v1';
export const CUSTOMER_CONTACT_OPERATION='customer_contact_update';
export const CUSTOMER_CONTACT_FIELDS=Object.freeze(['phone','city','country']);
export const CUSTOMER_CONTACT_BODY_KEYS=Object.freeze(['requestId','expectedRevision',...CUSTOMER_CONTACT_FIELDS]);
export const CUSTOMER_CONTACT_READ_PERMISSION='customer.view';
export const CUSTOMER_CONTACT_WRITE_PERMISSION='customer.edit';
export const CUSTOMER_CONTACT_ROW_KEYS=Object.freeze(['context_json','actor_json','replayed','sessionId','transactionId','readerDefinitionHash']);
export const CUSTOMER_CONTACT_CONTEXT_KEYS=Object.freeze(['schemaVersion','copyId','sealHash','customerId','customerCode','customerName','partyEntityId','sourceKey','sourceCompany','sourceId','accounts','contact','revision']);
export const CUSTOMER_CONTACT_ACCOUNT_KEYS=Object.freeze(['accountId','currency','partyEntityId','sourceKey']);
export const CUSTOMER_CONTACT_NATIVE_ERRORS=Object.freeze({
  52110:Object.freeze({code:'CUSTOMER_CONTACT_UNAVAILABLE',statusCode:503}),
  52111:Object.freeze({code:'CUSTOMER_CONTACT_FORBIDDEN',statusCode:403}),
  52112:Object.freeze({code:'CUSTOMER_CONTACT_SCOPE',statusCode:403}),
  52113:Object.freeze({code:'CUSTOMER_CONTACT_STALE',statusCode:409}),
  52114:Object.freeze({code:'CUSTOMER_CONTACT_REQUEST_CONFLICT',statusCode:409}),
  52115:Object.freeze({code:'CUSTOMER_CONTACT_SOURCE_CHANGED',statusCode:409}),
});
// Exact closure of the captured current native dependency graph. Revision
// triggers, original manifests, catalog readers and sale BEGIN remain intact.
export const CUSTOMER_CONTACT_PREDECESSOR_NAMES=Object.freeze([
  'dbo.business_product_price_sale_link_guard',
  'dbo.usp_assert_operation_quarantine_v2',
  'dbo.usp_business_product_price_proof_v1',
  'dbo.usp_business_product_price_sale_assert_v1',
  'dbo.usp_business_product_price_sale_context_v1',
  'dbo.usp_business_product_price_sale_history_v1',
  'dbo.usp_business_product_price_sale_intent_v1',
  'dbo.usp_business_product_price_sale_proof_v1',
  'dbo.usp_business_product_price_set_v1',
  'dbo.usp_business_product_prices_v1',
  'dbo.usp_business_selected_sale_context_v2',
  'dbo.usp_business_selected_sale_write_intent_v1',
  'dbo.usp_shared_crm_price_create_v1',
  'dbo.usp_shared_crm_price_proof_v1',
  'dbo.usp_shared_crm_price_read_v1',
  'dbo.usp_stage4_copy_context',
  'dbo.usp_stage4_copy_guard',
  'dbo.usp_stage4_copy_ready',
]);
export const CUSTOMER_CONTACT_NEW_MODULES=Object.freeze([CUSTOMER_CONTACT_CONTEXT,CUSTOMER_CONTACT_UPDATE,CUSTOMER_CONTACT_PROOF]);
export const CUSTOMER_CONTACT_FRAME_KEYS=Object.freeze(['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','contextExecute','updateExecute','proofExecute','proofViewDefinition','proofDefinitionHash','registryPrivateAccess','projectorPrivateAccess']);
export const CUSTOMER_CONTACT_PROOF_ROW_KEYS=Object.freeze(['copyId','name','moduleType','beforeHash','afterHash','actualHash','scopeHash','revisionHash','objectId','parentName','moduleDisabled','immutableHash','immutableDisabled']);
