// Leaf names shared by the offline compiler and independently verified runtime.
// Importing this file never registers a capability or connects to a database.
export const BUSINESS_PRICE_SCHEMA = 'melisa-business-product-prices.v1';
export const BUSINESS_PRICE_CATALOG_SCHEMA = 'melisa-business-product-price-catalog.v1';
export const BUSINESS_PRICE_CATALOG_LIMIT = 50;
export const BUSINESS_PRICE_REVISION_SCHEMA = 'melisa-business-product-price-revision.v1';
export const BUSINESS_PRICE_COPY_ID = 'e16b70f0-4057-428b-9abc-6bbcaf35fe82';
export const BUSINESS_PRICE_GET = 'dbo.usp_business_product_prices_v1';
export const BUSINESS_PRICE_SET = 'dbo.usp_business_product_price_set_v1';
export const BUSINESS_PRICE_PROOF = 'dbo.usp_business_product_price_proof_v1';
export const BUSINESS_PRICE_REGISTRY = 'dbo.stage4_copy_business_product_price_revisions';
export const BUSINESS_PRICE_IMMUTABLE = 'dbo.immutable_stage4_copy_business_product_price_revisions';
export const BUSINESS_PRICE_VERSIONS = 'dbo.business_product_price_versions';
export const BUSINESS_PRICE_CURRENT = 'dbo.business_product_price_current';
export const BUSINESS_PRICE_REQUESTS = 'dbo.business_product_price_requests';
export const BUSINESS_PRICE_TABLES = Object.freeze([BUSINESS_PRICE_VERSIONS, BUSINESS_PRICE_CURRENT, BUSINESS_PRICE_REQUESTS]);
export const BUSINESS_PRICE_GUARDS = Object.freeze([
  'dbo.business_product_price_versions_guard',
  'dbo.business_product_price_current_guard',
  'dbo.business_product_price_requests_guard',
]);
export const BUSINESS_PRICE_MODULES = Object.freeze([...BUSINESS_PRICE_GUARDS, BUSINESS_PRICE_GET, BUSINESS_PRICE_SET, BUSINESS_PRICE_PROOF]);
export const BUSINESS_PRICE_BODY_KEYS = Object.freeze(['requestId', 'expectedRevision', 'priceId', 'tuple', 'priceExact', 'reason']);
export const BUSINESS_PRICE_TUPLE_KEYS = Object.freeze(['type', 'unitId', 'tier', 'currency']);
export const BUSINESS_PRICE_READ_PERMISSIONS = Object.freeze(['product.view', 'purchase.view']);
export const BUSINESS_PRICE_WRITE_PERMISSION = 'product.price.edit';
// Existing SALE tuples only. NULL is an explicit unavailable manual price; it
// must never coalesce to the source price after a manual version exists.
export const BUSINESS_PRICE_POLICY = Object.freeze({sourceOnlyTuples: true, createTuple: false, writeActorId: '16', exactScale: 8, nullFallsBackToSource: false, changesNativePrices: false, changesRoles: false});
