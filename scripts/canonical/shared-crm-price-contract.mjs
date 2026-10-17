// Finite source/runtime contract. This file grants no registration or IO.
export const CRM_PRICE_CONTRACT='melisa-crm-draft-pricing.v1';
export const CRM_PRICE_REVISION_SCHEMA='melisa-crm-order-price-revision.v1';
export const CRM_PRICE_PROOF_SCHEMA='melisa-crm-order-price-proof.v1';
export const CRM_PRICE_CREATE='dbo.usp_shared_crm_price_create_v1';
export const CRM_PRICE_READ='dbo.usp_shared_crm_price_read_v1';
export const CRM_PRICE_PROOF='dbo.usp_shared_crm_price_proof_v1';
export const CRM_PRICE_REGISTRY='dbo.crm_order_price_revisions_v1';
export const CRM_PRICE_IMMUTABLE='dbo.immutable_crm_order_price_revisions_v1';
export const CRM_PRICE_MODULES=Object.freeze([CRM_PRICE_CREATE,CRM_PRICE_READ,CRM_PRICE_PROOF]);
export const CRM_PRICE_PARENT_MODULES=Object.freeze([
 'dbo.usp_shared_crm_order_customers','dbo.usp_shared_crm_order_create','dbo.usp_shared_crm_order_read',
 'dbo.crm_order_current_sources_immutable','dbo.crm_order_current_definitions_immutable',
 'dbo.crm_order_v2_requests_immutable','dbo.crm_order_v2_lines_immutable','dbo.crm_order_v2_headers_guard','dbo.crm_order_v2_items_guard','dbo.crm_order_v2_definitions_immutable',
 'dbo.business_product_price_versions_guard','dbo.business_product_price_current_guard','dbo.business_product_price_requests_guard',
 'dbo.usp_business_product_prices_v1','dbo.usp_business_product_price_set_v1','dbo.usp_business_product_price_proof_v1','dbo.immutable_stage4_copy_business_product_price_revisions',
 'dbo.usp_business_product_price_sale_context_v1','dbo.usp_business_product_price_sale_begin_v1','dbo.usp_business_product_price_sale_intent_v1','dbo.usp_business_product_price_sale_history_v1',
 'dbo.business_product_price_sale_link_guard','dbo.usp_business_product_price_sale_assert_v1','dbo.usp_business_product_price_sale_proof_v1','dbo.immutable_stage4_copy_business_product_price_sale_revisions',
]);
export const CRM_PRICE_REVISION_KEYS=Object.freeze(['schemaVersion','version','copyId','baseSealHash','profileHash','sourceContextHash','sourceRunId','sourceSnapshotHash','baseSelectedRevisionHash','priceRevisionHash','saleRevisionHash','parentModules','modules','immutableTriggerHash','registryDDLHash','priceSchemaDescriptors','revisionHash']);
export const CRM_PRICE_ROW_KEYS=Object.freeze(['copyId','name','revision','sourceContextHash','priceRevisionHash','saleRevisionHash','profileHash','afterHash','revisionHash','actualHash','immutableTriggerHash','triggerDisabled','objectId','objectType','sessionId','transactionId']);
export const CRM_PRICE_METADATA_KEYS=Object.freeze(['schemaVersion','db','server','originalLogin','copyId','sealHash','profileHash','sourceContextHash','priceRevisionHash','saleRevisionHash','sourceRunId','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','registrySchemaValid']);
export const CRM_PRICE_PROOF_SET_COUNT=9;
