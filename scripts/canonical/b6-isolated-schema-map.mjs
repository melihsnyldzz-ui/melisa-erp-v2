// Offline source/type map only. No imports, SQL executor, installer or row data.
// Concrete schema statements may be extracted as text; nothing executes them.
// The relation scope is the two frozen stock/catalog reader candidates, not
// every dependency of the complete B6 apply/inverse or an installed baseline.
export const B6_ISOLATED_SCHEMA_REVISION='F05B63189AFC7A5BAF6E5686631CC3B793ECF73F94C472DB32747138EBAFC7C8';
const ref=(file,symbol,line,kind='TABLE_DDL')=>Object.freeze({file,symbol,line,kind,readSourceOnly:true});
const initial=(table,line)=>ref('infra/sql/migrations/0001_melisa_erp_v2_initial_schema.sql','CREATE TABLE dbo.'+table,line);
const price=ref('scripts/canonical/enable-test-product-prices.mjs','PRICE_DDL',32);
const batch=ref('scripts/canonical/enable-test-purchase-batches.mjs','buildSql',84);
const fx=ref('scripts/canonical/enable-test-purchase-fx.mjs','buildSql',74);
const accepted=ref('scripts/migration/accepted-opening-prices.mjs','installAcceptedPrices',68,'EXECUTOR_EMBEDDED_TABLE_DDL');
const version=ref('scripts/migration/goal7-source-version.mjs','SOURCE_VERSION_DDL_SQL',62);
const quarantine=ref('scripts/migration/operation-quarantine.mjs','installQuarantine',82,'EXECUTOR_EMBEDDED_TABLE_DDL');
const opening=ref('scripts/migration/target-native-opening.mjs','applyNativeOpening',36,'EXECUTOR_EMBEDDED_TABLE_DDL');
const seed=ref('scripts/canonical/clean-synthetic-seed.mjs','buildCleanSeedSql',2,'ALTERNATE_CLEAN_SEED_DDL');
const relation=(name,status,sources,dependencies=[],gaps=[])=>Object.freeze({name,status,sources:Object.freeze(sources),ddlDependencies:Object.freeze(dependencies),gaps:Object.freeze(gaps),exactNativeBaselineProved:false});
export const B6_ISOLATED_RELATIONS=Object.freeze([
 relation('dbo.party_source_links','ALTERNATE_SCHEMA_ONLY',[seed],[],['FULL_NATIVE_PARTY_LINK_DDL_NOT_LOCATED']),
 relation('dbo.permissions','INITIAL_SCHEMA_SOURCE',[initial('permissions',34)],['dbo.roles']),
 relation('dbo.product_barcodes','INITIAL_SCHEMA_SOURCE',[initial('product_barcodes',94)],['dbo.products']),
 relation('dbo.product_images','INITIAL_SCHEMA_SOURCE',[initial('product_images',116)],['dbo.products']),
 relation('dbo.product_prices','ALTERNATE_SCHEMA_ONLY',[seed],['dbo.products'],['FULL_NATIVE_PRICE_LINEAGE_DDL_NOT_LOCATED']),
 relation('dbo.product_source_aliases','TABLE_DDL_NOT_LOCATED',[ref('scripts/canonical/enable-test-work-catalog.mjs','CATALOG_INDEX_INSTALL_SQL',25,'INDEX_ONLY')],['dbo.products'],['BASE_TABLE_AND_COLUMN_TYPES_NOT_LOCATED']),
 relation('dbo.products','INITIAL_SCHEMA_SOURCE',[initial('products',69),ref('infra/sql/migrations/0005_average_cost_gross_profit.sql','products cost additions',9,'MIGRATION_DELTA'),ref('infra/sql/migrations/0011_purchase_discount_defaults.sql','products discount default',3,'MIGRATION_DELTA')],[],['LATER_NATIVE_LINEAGE_COLUMN_CLOSURE_NOT_PROVED']),
 relation('dbo.purchase_invoices','INITIAL_SCHEMA_SOURCE',[initial('purchase_invoices',265)],['dbo.suppliers','dbo.users'],['LATER_NATIVE_ACCOUNT_COLUMN_CLOSURE_NOT_PROVED']),
 relation('dbo.supplier_movements','SCHEMA_SOURCE',[ref('infra/sql/migrations/0004_supplier_movements.sql','CREATE TABLE dbo.supplier_movements',9)],['dbo.suppliers'],['LATER_EXACT_BALANCE_COLUMN_CLOSURE_NOT_PROVED']),
 relation('dbo.suppliers','INITIAL_SCHEMA_SOURCE',[initial('suppliers',160),ref('infra/sql/migrations/0011_purchase_discount_defaults.sql','suppliers discount default',10,'MIGRATION_DELTA'),ref('scripts/migration/party-currency-balance-precision.sql','suppliers balance precision',27,'MIGRATION_DELTA')],[],['LATER_PARTY_COLUMN_CLOSURE_NOT_PROVED']),
 relation('dbo.test_daily_scope','ALTERNATE_SCHEMA_ONLY',[ref('scripts/canonical/clean-store-day-cohort-sql.mjs','buildCleanStoreDayInventorySql',391,'ALTERNATE_CLEAN_TABLE_DDL')],['dbo.products','dbo.suppliers','dbo.customers'],['SHARED_TEST_DAILY_BASELINE_DDL_NOT_PROVED']),
 relation('dbo.test_product_price_current','SCHEMA_SOURCE',[price],[],['NATIVE_CONSTRAINT_AND_INDEX_EQUIVALENCE_NOT_PROVED']),
 relation('dbo.test_product_price_manifest','SCHEMA_SOURCE',[price]),
 relation('dbo.test_product_price_units','SCHEMA_SOURCE',[price]),
 relation('dbo.test_product_price_versions','SCHEMA_SOURCE',[price]),
 relation('dbo.test_purchase_batch_guard_manifest','SCHEMA_SOURCE',[batch]),
 relation('dbo.test_purchase_fx_guard_manifest','SCHEMA_SOURCE',[fx,ref('scripts/canonical/enable-test-purchase-fx.sql','CREATE TABLE dbo.test_purchase_fx_guard_manifest',48)]),
 relation('dbo.test_purchase_fx_intents','SCHEMA_SOURCE',[fx],['dbo.test_daily_drafts','dbo.purchase_invoices','dbo.test_purchase_fx_sources','dbo.test_purchase_fx_rates']),
 relation('dbo.test_purchase_fx_scope','SCHEMA_SOURCE',[fx]),
 relation('dbo.test_purchase_fx_sources','SCHEMA_SOURCE',[fx]),
 relation('dbo.users','INITIAL_SCHEMA_SOURCE',[initial('users',51),ref('infra/sql/migrations/0006_auth_live_foundation.sql','auth foundation additions',1,'MIGRATION_DELTA')],['dbo.roles']),
 relation('erp_migration.accepted_price_manifest','SCHEMA_SOURCE',[accepted]),
 relation('erp_migration.accepted_price_products','SCHEMA_SOURCE',[accepted]),
 relation('erp_migration.accepted_price_values','SCHEMA_SOURCE',[accepted],['erp_migration.accepted_price_products']),
 relation('erp_migration.goal7_source_version_manifest','SCHEMA_SOURCE',[version]),
 relation('erp_migration.goal7_source_version_prices','DERIVED_SELECT_INTO',[version],['erp_migration.accepted_price_values'],['INHERITED_ACCEPTED_VALUE_TYPES_REQUIRED']),
 relation('erp_migration.goal7_source_version_products','DERIVED_SELECT_INTO',[version],['erp_migration.accepted_price_products'],['INHERITED_ACCEPTED_PRODUCT_TYPES_REQUIRED']),
 relation('erp_migration.goal7_source_version_records','SCHEMA_SOURCE',[version]),
 relation('erp_migration.operation_quarantine_holds','SCHEMA_SOURCE',[quarantine],[],['CLEAN_SEED_VARIANT_IS_INCOMPLETE_FOR_THIS_READER']),
 relation('erp_migration.operation_quarantine_manifest','SCHEMA_SOURCE',[quarantine]),
 relation('erp_migration.records','SCHEMA_SOURCE',[opening]),
 relation('erp_migration.runs','SCHEMA_SOURCE',[opening]),
]);
export const B6_ISOLATED_READER_CANDIDATES=Object.freeze([
 Object.freeze({module:'dbo.usp_b6_reader_50e615ffdb8a8ec3_v1',source:'dbo.usp_read_stock_products_product_b40b0745_1fa0_4970_b19f_1479cf75d67a',applyBatch:'create-dbo.usp_b6_reader_50e615ffdb8a8ec3_v1',applySqlLine:464,decodedStatementLine:117,sourceMap:ref('scripts/canonical/enable-test-stock-products.mjs','STOCK_PRODUCT_PROC_SQL',75,'READER_SOURCE'),versionBuilder:ref('scripts/canonical/goal7-source-catalog-readers.mjs','buildSourceStockReader',126,'READER_SOURCE')}),
 Object.freeze({module:'dbo.usp_b6_reader_fccebc6e99370487_v1',source:'dbo.usp_read_work_catalog_product_b40b0745_1fa0_4970_b19f_1479cf75d67a',applyBatch:'create-dbo.usp_b6_reader_fccebc6e99370487_v1',applySqlLine:652,decodedStatementLine:199,sourceMap:ref('scripts/canonical/enable-test-work-catalog.mjs','CATALOG_PROC_SQL',209,'READER_SOURCE'),versionBuilder:ref('scripts/canonical/goal7-source-catalog-readers.mjs','buildSourceCatalogReader',61,'READER_SOURCE')}),
]);
const identifier=x=>typeof x==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(x);
function sqlType(c){
 if(!identifier(c.typeName))throw Error('B6_SCHEMA_TYPE_NAME');
 const t=c.typeName.toLowerCase();
 if(['char','varchar','binary','varbinary','nchar','nvarchar'].includes(t)){
  if(!Number.isInteger(c.max_length)||c.max_length===0||c.max_length< -1)throw Error('B6_SCHEMA_TYPE_LENGTH');
  if(c.max_length===-1){if(!['varchar','varbinary','nvarchar'].includes(t))throw Error('B6_SCHEMA_TYPE_LENGTH');return t+'(max)';}
  const n=t.startsWith('n')?c.max_length/2:c.max_length;if(!Number.isInteger(n))throw Error('B6_SCHEMA_TYPE_LENGTH');return t+'('+n+')';
 }
 if(['decimal','numeric'].includes(t)){if(!Number.isInteger(c.precision)||c.precision<1||c.precision>38||!Number.isInteger(c.scale)||c.scale<0||c.scale>c.precision)throw Error('B6_SCHEMA_TYPE_PRECISION');return t+'('+c.precision+','+c.scale+')';}
 if(['time','datetime2','datetimeoffset'].includes(t)){if(!Number.isInteger(c.scale)||c.scale<0||c.scale>7)throw Error('B6_SCHEMA_TYPE_SCALE');return t+'('+c.scale+')';}
 if(!['bigint','int','smallint','tinyint','bit','float','real','money','smallmoney','date','datetime','smalldatetime','timestamp','rowversion','uniqueidentifier','text','ntext','image','xml','sysname'].includes(t))throw Error('B6_SCHEMA_TYPE_NOT_MAPPED');
 return t;
}
// Whitelist schema metadata. Never return the input object, defaults, checks,
// SQL definitions, private profiles, records, source payloads or row values.
export function extractB6IsolatedColumnTypes(documents=[]){
 if(!Array.isArray(documents))throw Error('B6_SCHEMA_METADATA_ARRAY');
 const known=new Set(B6_ISOLATED_RELATIONS.map(r=>r.name)),out=new Map();
 for(const document of documents){if(!document||!Array.isArray(document.columnsJson))throw Error('B6_SCHEMA_COLUMN_METADATA');for(const c of document.columnsJson){
  if(!identifier(c.schemaName)||!identifier(c.tableName))throw Error('B6_SCHEMA_RELATION_NAME');
  const name=c.schemaName+'.'+c.tableName;if(!known.has(name))continue;
  if(!identifier(c.columnName)||!Number.isInteger(c.columnId)||c.columnId<1)throw Error('B6_SCHEMA_COLUMN_NAME');
  for(const flag of ['is_nullable','is_identity','is_computed'])if(typeof c[flag]!=='boolean')throw Error('B6_SCHEMA_COLUMN_FLAG');
  const row={relation:name,column:c.columnName,ordinal:c.columnId,sqlType:sqlType(c),nullable:c.is_nullable,identity:c.is_identity,computed:c.is_computed,defaultMetadataPresent:Object.hasOwn(c,'defaultDefinition')};
  const key=name+'.'+c.columnName,old=out.get(key);if(old&&JSON.stringify({...old,defaultMetadataPresent:false})!==JSON.stringify({...row,defaultMetadataPresent:false}))throw Error('B6_SCHEMA_METADATA_CONFLICT');
  out.set(key,old?{...row,defaultMetadataPresent:old.defaultMetadataPresent||row.defaultMetadataPresent}:row);
 }}
 return [...out.values()].sort((a,b)=>a.relation.localeCompare(b.relation)||a.ordinal-b.ordinal);
}
export function buildB6IsolatedSchemaMap(artifact,metadataDocuments=[]){
 if(artifact?.schemaVersion!=='melisa-canonical-business-sale-revision.v1'||artifact.revisionHash!==B6_ISOLATED_SCHEMA_REVISION)throw Error('B6_SCHEMA_ARTIFACT_REVISION');
 const batches={};for(const phase of ['apply','inverse']){const source=artifact[phase+'Batches'],expected=B6_ISOLATED_BATCH_IDS[phase];if(!Array.isArray(source)||source.length!==expected.length)throw Error('B6_SCHEMA_BATCH_SCOPE');batches[phase]=source.map((b,index)=>{if(b.id!==expected[index]||typeof b.kind!=='string'||!/^[A-Z0-9_]+$/.test(b.kind))throw Error('B6_SCHEMA_BATCH_SCOPE');return {index,id:b.id,kind:b.kind};});}
 const columnTypes=extractB6IsolatedColumnTypes(metadataDocuments),covered=new Set(columnTypes.map(c=>c.relation)),known=new Set(B6_ISOLATED_RELATIONS.map(r=>r.name));
 return {schema:'melisa-b6-isolated-schema-map.v1',status:'OFFLINE_MAP_NOT_NATIVE_PROOF',revisionHash:B6_ISOLATED_SCHEMA_REVISION,relationScope:'TWO_FROZEN_ACTIVE_READER_CANDIDATES',fullArtifactDependencyClosure:false,batches,relations:B6_ISOLATED_RELATIONS,columnTypes,missingColumnMetadata:B6_ISOLATED_RELATIONS.filter(r=>!covered.has(r.name)).map(r=>r.name),additionalDdlDependencies:[...new Set(B6_ISOLATED_RELATIONS.flatMap(r=>r.ddlDependencies).filter(n=>!known.has(n)))].sort(),environmentEquivalenceChecks:['SQL_SERVER_BUILD_CU','DATABASE_COMPATIBILITY_LEVEL','DATABASE_COLLATION','OPTIMIZER_DATABASE_SCOPED_CONFIGURATION'],limitations:['Target-before-CAS, server/database, object IDs and hash guards remain unchanged.','DDL origins are source references, not permission to import or run migration executors.','Column metadata excludes commercial rows, defaults, identity seeds and constraint definitions.']};
}
function closeTableParenthesis(text,start){
 let depth=0,quote=null;
 for(let i=start;i<text.length;i++){
  const c=text[i];
  if(quote){if(c===quote){if(text[i+1]===quote){i++;continue;}quote=null;}continue;}
  if(c==="'"||c==='"'){quote=c;continue;}
  if(c==='['){quote=']';continue;}
  if(text.startsWith('--',i)){const end=text.indexOf('\n',i);if(end<0)return -1;i=end;continue;}
  if(text.startsWith('/*',i)){let comments=1;i+=2;while(i<text.length&&comments){if(text.startsWith('/*',i)){comments++;i+=2;}else if(text.startsWith('*/',i)){comments--;i+=2;}else i++;}if(comments)return -1;i--;continue;}
  if(c==='(')depth++;else if(c===')'&&--depth===0)return i;
 }
 return -1;
}
// Sources are caller-provided text, not imported modules or executable paths.
// Only known DDL source files and mapped relations are considered. Alternative
// clean seeds are reported separately, never silently substituted as baseline.
export function extractB6IsolatedSourceTables(sourceDocuments,capturedRelations=[]){
 if(!Array.isArray(sourceDocuments)||!Array.isArray(capturedRelations))throw Error('B6_SCHEMA_SOURCE_ARRAY');
 const captured=new Set(capturedRelations),known=new Map(B6_ISOLATED_RELATIONS.map(r=>[r.name,r])),sources=new Map();
 for(const d of sourceDocuments){if(!d||typeof d.file!=='string'||typeof d.text!=='string'||sources.has(d.file))throw Error('B6_SCHEMA_SOURCE_DOCUMENT');sources.set(d.file,d.text);}
 const tables=[],deferred=[];
 for(const r of B6_ISOLATED_RELATIONS){
  if(captured.has(r.name))continue;
  if(['ALTERNATE_SCHEMA_ONLY','TABLE_DDL_NOT_LOCATED'].includes(r.status)){deferred.push({relation:r.name,reason:r.status,sources:r.sources});continue;}
  let found=false;
  for(const s of r.sources){
   const text=sources.get(s.file);if(text===undefined||s.kind==='MIGRATION_DELTA'||s.kind==='INDEX_ONLY')continue;
   const matches=[...text.matchAll(/\bCREATE\s+TABLE\s+(?:\[([A-Za-z_][A-Za-z0-9_]*)\]|([A-Za-z_][A-Za-z0-9_]*))\s*\.\s*(?:\[([A-Za-z_][A-Za-z0-9_]*)\]|([A-Za-z_][A-Za-z0-9_]*))\s*\(/gi)].filter(m=>(m[1]??m[2])+'.'+(m[3]??m[4])===r.name);
   if(matches.length!==1)continue;
   const m=matches[0],start=text.indexOf('(',m.index+m[0].length-1),end=closeTableParenthesis(text,start);if(end<0)throw Error('B6_SCHEMA_UNBALANCED_SOURCE_DDL');
   const sql=text.slice(m.index,end+1)+';';if(sql.includes('${')){deferred.push({relation:r.name,reason:'UNRESOLVED_SOURCE_INTERPOLATION',source:s});found=true;break;}
   tables.push({relation:r.name,kind:'SOURCE_CONCRETE_CREATE_TABLE',sql,source:{...s,line:1+text.slice(0,m.index).split('\n').length-1},baselineStatus:r.status,exactNativeBaselineProved:false});found=true;break;
  }
  if(!found&&r.status==='DERIVED_SELECT_INTO'){
   const s=r.sources[0],text=sources.get(s.file),escaped=r.name.replaceAll('.','\\.');
   if(text!==undefined){const select=new RegExp('SELECT TOP\\(0\\)[^;\\n]* INTO '+escaped+'[^;\\n]*;','g'),alters=new RegExp('ALTER TABLE '+escaped+'[^;\\n]*;','g'),indexes=new RegExp('CREATE UNIQUE INDEX [^;\\n]+ ON '+escaped+'[^;\\n]*;','g');const selects=[...text.matchAll(select)];
    if(selects.length===1){const statements=[selects[0][0],...[...text.matchAll(alters)].map(m=>m[0]),...[...text.matchAll(indexes)].map(m=>m[0])],sql=statements.join('\n');if(!sql.includes('${')){tables.push({relation:r.name,kind:'SOURCE_DERIVED_TOP_ZERO',sql,source:s,ddlDependencies:r.ddlDependencies,exactNativeBaselineProved:false});found=true;}}
   }
  }
  if(!found)deferred.push({relation:r.name,reason:'NO_CONCRETE_DDL_IN_SUPPLIED_SOURCE_TEXT',sources:r.sources});
 }
 return {schema:'melisa-b6-isolated-source-tables.v1',tables,deferred,execution:'NONE',scope:[...known.keys()]};
}
export const B6_ISOLATED_BATCH_IDS=Object.freeze({
 apply:Object.freeze([
  "target-before-cas",
  "probe-stored-header-policy",
  "create-private-table-0",
  "create-private-table-1",
  "create-private-table-2",
  "create-private-table-3",
  "create-private-table-4",
  "create-private-table-5",
  "create-projection-registry",
  "create-private-index-0",
  "seed-owner-scope",
  "immutable-dbo.canonical_business_sale_scope_immutable_v1",
  "immutable-dbo.canonical_business_sale_products_immutable_v1",
  "immutable-dbo.canonical_business_sale_accounts_immutable_v1",
  "immutable-dbo.canonical_business_sale_quotes_immutable_v1",
  "immutable-dbo.canonical_business_sale_rates_immutable_v1",
  "create-dbo.fn_canonical_business_sale_original_definition_v1",
  "create-dbo.usp_canonical_business_sale_legacy_ready_v1",
  "create-dbo.usp_canonical_business_sale_legacy_goal8_v1",
  "create-dbo.usp_b6_reader_b064fb8059b2a25a_v1",
  "create-dbo.usp_b6_reader_8e4de81a3e097ff9_v1",
  "create-dbo.usp_b6_reader_72508a13541b7914_v1",
  "create-dbo.usp_b6_reader_493d8752d74e363d_v1",
  "create-dbo.usp_b6_reader_0c766ec4fba1e755_v1",
  "create-dbo.usp_b6_reader_90a14e87f5a40fb7_v1",
  "create-dbo.usp_b6_reader_07ff3f8716077a9f_v1",
  "create-dbo.usp_b6_reader_50e615ffdb8a8ec3_v1",
  "create-dbo.usp_b6_reader_b0d249a7e6df0837_v1",
  "create-dbo.usp_b6_reader_fccebc6e99370487_v1",
  "create-dbo.usp_b6_reader_6a9c02f6cfc70556_v1",
  "create-dbo.usp_b6_reader_d88ef01914f618f0_v1",
  "create-dbo.usp_b6_reader_b5ff90009adf2b19_v1",
  "create-dbo.usp_b6_reader_ad00a254c052d27c_v1",
  "create-dbo.usp_canonical_business_sale_ready_v1",
  "create-dbo.usp_canonical_business_sale_resolve_v1",
  "create-dbo.usp_canonical_business_sale_context_v1",
  "create-dbo.usp_canonical_business_sale_begin_v1",
  "create-dbo.usp_canonical_business_sale_assert_v1",
  "create-dbo.usp_canonical_business_sale_guard_v1",
  "create-dbo.usp_canonical_business_sale_effects_v1",
  "create-dbo.canonical_business_sale_guard_party_currency_accounts_v1",
  "alter-dbo.test_guard_sales_invoices",
  "restore-order-dbo.test_guard_sales_invoices",
  "alter-dbo.test_guard_sales_invoice_items",
  "restore-order-dbo.test_guard_sales_invoice_items",
  "alter-dbo.test_guard_products",
  "restore-order-dbo.test_guard_products",
  "alter-dbo.test_guard_stock_movements",
  "restore-order-dbo.test_guard_stock_movements",
  "alter-dbo.test_guard_customers",
  "restore-order-dbo.test_guard_customers",
  "alter-dbo.test_guard_customer_movements",
  "restore-order-dbo.test_guard_customer_movements",
  "alter-dbo.test_guard_audit_logs",
  "restore-order-dbo.test_guard_audit_logs",
  "alter-dbo.work_night_guard_work_sales_links",
  "restore-order-dbo.work_night_guard_work_sales_links",
  "alter-dbo.work_night_guard_work_trade_requests",
  "restore-order-dbo.work_night_guard_work_trade_requests",
  "alter-dbo.work_trade_assert_ready",
  "alter-dbo.goal8_day_assert_scope",
  "alter-dbo.usp_assert_test_current_price_purchase_received",
  "alter-dbo.usp_assert_test_purchase_fx_received",
  "alter-dbo.usp_get_test_current_price_purchase_context",
  "alter-dbo.usp_get_test_product_prices",
  "alter-dbo.usp_get_test_purchase_fx_context",
  "alter-dbo.usp_get_test_purchase_fx_unit_evidence",
  "alter-dbo.usp_get_test_supplier_contact_context",
  "alter-dbo.usp_read_stock_products_product_b40b0745_1fa0_4970_b19f_1479cf75d67a",
  "alter-dbo.usp_read_supplier_cards",
  "alter-dbo.usp_read_work_catalog_product_b40b0745_1fa0_4970_b19f_1479cf75d67a",
  "alter-dbo.usp_set_test_product_price",
  "alter-dbo.usp_update_test_supplier_contact",
  "alter-dbo.usp_work_inbound_ready",
  "alter-dbo.usp_work_supplier_payment_ready",
  "seed-original-projection",
  "seal-original-projection",
  "narrow-permission-0",
  "narrow-permission-1",
  "narrow-permission-2",
  "narrow-permission-3",
  "narrow-permission-4",
  "narrow-permission-5",
  "narrow-permission-6",
  "narrow-permission-7",
  "narrow-permission-8",
  "narrow-permission-9",
  "narrow-permission-10",
  "narrow-permission-11",
  "narrow-permission-12",
  "narrow-permission-13",
  "narrow-permission-14",
  "narrow-permission-15",
  "narrow-permission-16",
  "narrow-permission-17",
  "narrow-permission-18",
  "narrow-permission-19",
  "narrow-permission-20",
  "narrow-permission-21",
  "narrow-permission-22",
  "narrow-permission-23",
  "narrow-permission-24",
  "narrow-permission-25",
  "narrow-permission-26",
  "narrow-permission-27",
  "narrow-permission-28",
  "narrow-permission-29",
  "after-cas"
]),
 inverse:Object.freeze([
  "inverse-cas-no-history",
  "restore-dbo.test_guard_sales_invoices",
  "restore-order-dbo.test_guard_sales_invoices",
  "restore-dbo.test_guard_sales_invoice_items",
  "restore-order-dbo.test_guard_sales_invoice_items",
  "restore-dbo.test_guard_products",
  "restore-order-dbo.test_guard_products",
  "restore-dbo.test_guard_stock_movements",
  "restore-order-dbo.test_guard_stock_movements",
  "restore-dbo.test_guard_customers",
  "restore-order-dbo.test_guard_customers",
  "restore-dbo.test_guard_customer_movements",
  "restore-order-dbo.test_guard_customer_movements",
  "restore-dbo.test_guard_audit_logs",
  "restore-order-dbo.test_guard_audit_logs",
  "restore-dbo.work_night_guard_work_sales_links",
  "restore-order-dbo.work_night_guard_work_sales_links",
  "restore-dbo.work_night_guard_work_trade_requests",
  "restore-order-dbo.work_night_guard_work_trade_requests",
  "restore-dbo.work_trade_assert_ready",
  "restore-dbo.goal8_day_assert_scope",
  "restore-dbo.usp_assert_test_current_price_purchase_received",
  "restore-dbo.usp_assert_test_purchase_fx_received",
  "restore-dbo.usp_get_test_current_price_purchase_context",
  "restore-dbo.usp_get_test_product_prices",
  "restore-dbo.usp_get_test_purchase_fx_context",
  "restore-dbo.usp_get_test_purchase_fx_unit_evidence",
  "restore-dbo.usp_get_test_supplier_contact_context",
  "restore-dbo.usp_read_stock_products_product_b40b0745_1fa0_4970_b19f_1479cf75d67a",
  "restore-dbo.usp_read_supplier_cards",
  "restore-dbo.usp_read_work_catalog_product_b40b0745_1fa0_4970_b19f_1479cf75d67a",
  "restore-dbo.usp_set_test_product_price",
  "restore-dbo.usp_update_test_supplier_contact",
  "restore-dbo.usp_work_inbound_ready",
  "restore-dbo.usp_work_supplier_payment_ready",
  "restore-introduced-permission-0",
  "restore-introduced-permission-1",
  "restore-introduced-permission-2",
  "restore-introduced-permission-3",
  "restore-introduced-permission-4",
  "restore-introduced-permission-5",
  "restore-introduced-permission-6",
  "restore-introduced-permission-7",
  "restore-introduced-permission-8",
  "restore-introduced-permission-9",
  "restore-introduced-permission-10",
  "restore-introduced-permission-11",
  "restore-introduced-permission-12",
  "restore-introduced-permission-13",
  "restore-introduced-permission-14",
  "restore-introduced-permission-15",
  "drop-new-module-0",
  "drop-new-module-1",
  "drop-new-module-2",
  "drop-new-module-3",
  "drop-new-module-4",
  "drop-new-module-5",
  "drop-new-module-6",
  "drop-new-module-7",
  "drop-new-module-8",
  "drop-new-module-9",
  "drop-new-module-10",
  "drop-new-module-11",
  "drop-new-module-12",
  "drop-new-module-13",
  "drop-new-module-14",
  "drop-new-module-15",
  "drop-new-module-16",
  "drop-new-module-17",
  "drop-new-module-18",
  "drop-new-module-19",
  "drop-new-module-20",
  "drop-new-module-21",
  "drop-new-module-22",
  "drop-new-module-23",
  "drop-new-module-24",
  "drop-new-module-25",
  "drop-new-module-26",
  "drop-new-module-27",
  "drop-new-module-28",
  "drop-new-module-29",
  "drop-new-module-30",
  "drop-new-table-0",
  "drop-new-table-1",
  "drop-new-table-2",
  "drop-new-table-3",
  "drop-new-table-4",
  "drop-new-table-5",
  "drop-new-table-6",
  "original-cas"
]),
});
