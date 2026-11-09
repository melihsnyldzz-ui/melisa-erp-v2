// Preparation contract only. No environment access or connection capability.
export const WAREHOUSE_LIFECYCLE_TARGET=Object.freeze({
 runtimeHead:'80662275fa8be91c32aad1efa91e6805f028df0d',packageSha256:'21de9872afcf1c48a35fad300ba36c64bdd9857d03be4cca910271e89d8af6fb',sourceCount:317,readyProofSha256:'e2bb43e6b3f6c69dd4e0781e74d3c33859fafc222cc9560a5f18c8a1d13c0294',
 proposalSha256:'c2ffb689e4c0f1042d76265d0328b4a13663b5e5727693e56f9daba28cccaf85',baselineSha256:'4e82ff37978a7d304a8da52de14df5bd8c79275c8974e159f138a6ac940bc9aa',baselineAudits:223,
 server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseId:5,databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',schemaVersion:7,userTableCount:43,sqlPermissionCount:404,
 owner:'SEMIH\\Xaser',ownerPid:39008,ownerBirth:'2026-11-09T18:40:48.5543060+03:00',workerPid:3828,workerBirth:'2026-11-09T18:41:00.6248890+03:00',sqlPid:5240,sqlBirth:'2026-11-05T17:17:00.2470240+03:00',legacySqlPid:31560,legacySqlBirth:'2026-10-29T02:18:05.6456940+03:00',ports:Object.freeze([4294,5294]),
 userId:'30007',username:'erp_depo_deneme',roleId:'10',roleCode:'desktop_warehouse_operator',initialUserVersion:'0x000000000011BB11',roleVersion:'0x000000000010E051',protectedUserSha256:'00f25f808d6c04634feb6e5464d88e32c48a5d68088fb54de073c0374b5cea47',
 writerLogin:'melisa_desktop_test_writer_20261105',writerUserId:7,writerRoleId:6,writerSid:'417717302d2efa478380226433a0bca6',auditSource:'desktop-role-test-setup'
});
export const WAREHOUSE_LIFECYCLE_RIGHTS=Object.freeze(['warehouse.pack','warehouse.prepare','warehouse.view']);
export const WAREHOUSE_EXECUTION_DECISION_KEY='K10-02-WH-EXEC/01a1c143-1536-70a0-817b-fa6954998218/59';
export const WAREHOUSE_EXECUTION_DECISION_PREFIX='Conditionally approved once by coordinator under delegatedTestApprovals, all prerequisites and boundaries in exact hashed proposal mandatory; strict RV no drift.';
export const WAREHOUSE_TABLE_KEYS=Object.freeze({
 "audit_logs": [
  "id"
 ],
 "auth_refresh_tokens": [
  "id"
 ],
 "catalog_items": [
  "id"
 ],
 "catalogs": [
  "id"
 ],
 "currency_rates": [
  "id"
 ],
 "customer_movements": [
  "id"
 ],
 "customers": [
  "id"
 ],
 "desktop_empty_installation": [
  "id"
 ],
 "desktop_finance_requests": [
  "request_id"
 ],
 "desktop_goods_purchase_links": [
  "id"
 ],
 "desktop_goods_receipt_lines": [
  "id"
 ],
 "desktop_goods_receipts": [
  "id"
 ],
 "desktop_goods_requests": [
  "request_id"
 ],
 "desktop_local_master_requests": [
  "request_id"
 ],
 "desktop_local_price_units": [
  "price_id"
 ],
 "desktop_local_product_units": [
  "id"
 ],
 "desktop_sale_carton_items": [
  "invoice_id",
  "carton_no",
  "item_id"
 ],
 "desktop_sale_cartons": [
  "invoice_id",
  "carton_no"
 ],
 "desktop_sale_request_resolutions": [
  "request_id"
 ],
 "desktop_sale_reservations": [
  "invoice_id",
  "item_id"
 ],
 "desktop_sale_workflow_requests": [
  "request_id"
 ],
 "desktop_sale_workflows": [
  "invoice_id"
 ],
 "finance_account_movements": [
  "id"
 ],
 "finance_accounts": [
  "id"
 ],
 "party_currency_accounts": [
  "id"
 ],
 "party_entities": [
  "id"
 ],
 "permissions": [
  "id"
 ],
 "product_barcodes": [
  "id"
 ],
 "product_images": [
  "id"
 ],
 "product_prices": [
  "id"
 ],
 "products": [
  "id"
 ],
 "purchase_invoice_items": [
  "id"
 ],
 "purchase_invoices": [
  "id"
 ],
 "roles": [
  "id"
 ],
 "sales_invoice_items": [
  "id"
 ],
 "sales_invoices": [
  "id"
 ],
 "stock_movements": [
  "id"
 ],
 "supplier_movements": [
  "id"
 ],
 "suppliers": [
  "id"
 ],
 "system_settings": [
  "id"
 ],
 "terminal_devices": [
  "id"
 ],
 "terminal_sync_queue": [
  "id"
 ],
 "users": [
  "id"
 ]
});
export const WAREHOUSE_GUARD_SOURCE_FILES=Object.freeze([
 "apps/api/src/config/desktopCustomerEditPolicy.mjs",
 "apps/api/src/config/desktopFinanceSchemaProposal.mjs",
 "apps/api/src/config/desktopFinanceV7Policy.mjs",
 "apps/api/src/config/desktopGoodsV6Policy.mjs",
 "apps/api/src/config/desktopGoodsV6Schema.mjs",
 "apps/api/src/config/desktopLifecyclePermissionPolicy.mjs",
 "apps/api/src/config/desktopMasterV3Policy.mjs",
 "apps/api/src/config/desktopMasterV5Policy.mjs",
 "apps/api/src/config/desktopMasterVersion.mjs",
 "apps/api/src/config/desktopSqlGuardStatements.mjs",
 "apps/api/src/config/desktopSupplierStatusPolicy.mjs",
 "apps/api/src/config/desktopWritePermissionPolicy.mjs"
]);
export const WAREHOUSE_LIFECYCLE_PARAMETER_TYPES=Object.freeze({
 userId:'bigint',roleId:'bigint',lifecycleId:'uniqueidentifier',decisionSha256:'binary(32)',proposalSha256:'binary(32)',phaseBindingSha256:'binary(32)',expectedUserVersion:'binary(8)',expectedInventorySha256:'binary(32)',expectedPermissionRowsSha256:'binary(32)',expectedMembershipsSha256:'binary(32)',expectedPrincipalsSha256:'binary(32)',expectedProtectedUserSha256:'binary(32)',expectedAuditCount:'bigint'
});
export function requireWarehouseAction(action){if(!['activate','deactivate','observe'].includes(action))throw Error('WAREHOUSE_ACTION_REJECTED');return action;}
