// Additive CHECK branches. Exact source predicates remain the first OR branch.
// Same-transaction native guards supply product, cost and supplier/account proofs.
import {moduleHash} from './stage4-copy-sql.mjs';
const pins=[
 ['stock_movements','CK_stock_movements_source_type_native','F0DE6692372B574F9A80B5C68DC1661510935CE49FB4A5081A974BAA44AFB1F2',0],
 ['test_purchase_batch_intent_lines','CK__test_purc__purch__6B4FD30B','45BAEBC914F03BD7372F6A34610FCC2C076450C20C44B6EC6EBFF6698BDFB1CD',5],
 ['test_purchase_batch_drafts','CK__test_purc__curre__60D24498','63C2B8D05758716D5F8DD0A04969653776333078B363E2F74DBC1A990EECF3AF',9],
 ['test_purchase_batch_drafts','CK__test_purc__subto__5FDE205F','69E55E924FE311898D5C608DDEE679A114536D6CD05D88C9A0CC1577AF489DE8',7]
];
const check=(v,c)=>{if(!v)throw Error(c);};
export function buildBusinessNativeChecks(constraints,profile,guard){
 check(profile.target.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&profile.target.server==='Semih\\MELISADEV'&&profile.target.login==='melisa_shared_test_rw_20261009_02'&&profile.products.length===1158&&profile.businessInvoiceMaxExact4==='20000.0000','BUSINESS_CHECK_PROFILE');
 check(guard.includes('BUSINESS_NATIVE_STOCK_COST_SCOPE')&&guard.includes('BUSINESS_NATIVE_PURCHASE_QUOTE_SCOPE')&&guard.includes('BUSINESS_SELECTED_INTENT_SCOPE'),'BUSINESS_CHECK_COUPLED_GUARD');
 const common="(db_name()) collate Latin1_General_100_BIN2=N'MELISA_ERP_CRM_SHARED_TEST_20261009_02' AND serverproperty(N'ServerName')=N'Semih\\MELISADEV' AND (original_login()) collate Latin1_General_100_BIN2=N'melisa_shared_test_rw_20261009_02'";
 const branch=[
  `${common} AND [source_type]=N'goods_receipt_batch' AND [movement_type]=N'in' AND [source_id]>(0) AND [created_by]=(16) AND [supplier_id]>(0) AND [customer_id] IS NULL AND [currency_code]=N'TRY' AND [document_date]=N'2026-10-09' AND [warehouse_name]=N'TEST V70 MAL KABUL DEPOSU' AND [source_warehouse]=N'TEST-V70-GOODS-WH' AND [source_record_key] IS NULL AND [migration_run_id] IS NULL AND [affects_inventory]=(1) AND ([quantity_in]>=(1) AND [quantity_in]<=(5)) AND [quantity_in]=floor([quantity_in]) AND [quantity_out]=(0) AND [quantity_net]=[quantity_in] AND [product_id]>(0) AND [unit_cost_try]>(0) AND [unit_cost_try]<=(1250) AND [unit_price]=[unit_cost_try] AND [average_cost_try_after]=[unit_cost_try] AND [amount_try]=round([quantity_in]*[unit_cost_try],(4))`,
  `${common} AND [draft_id]>(0) AND [receipt_line_id]>(0) AND [product_id]>(0) AND ([quantity]>=(1) AND [quantity]<=(5)) AND [quantity]=floor([quantity]) AND [line_discount_rate]=(0) AND [purchase_price]>(0) AND [purchase_price]<=(1179.80) AND [line_total]=round([quantity]*[purchase_price],(4))`,
  `${common} AND ([currency]=N'TRY' OR [currency]=N'USD' OR [currency]=N'EUR')`,
  `${common} AND [subtotal]>(0) AND [subtotal]<=(20000)`
 ];
 const replacements=pins.map(([table,name,hash,column],i)=>{
  const rows=constraints.filter(r=>r.schemaName==='dbo'&&r.tableName===table&&r.name===name);check(rows.length===1,'BUSINESS_CHECK_SOURCE_UNIQUE');const r=rows[0];
  check(r.definitionHash===hash&&moduleHash(r.definition)===hash&&r.parentColumnId===column&&!r.isDisabled&&!r.isNotTrusted&&!r.isNotForReplication&&r.definition.startsWith('(')&&r.definition.endsWith(')'),'BUSINESS_CHECK_SOURCE_PIN');
  const afterDefinition=`(${r.definition.slice(1,-1)} OR case when ${branch[i]} then (1) else (0) end=(1))`;
  return {table:'dbo.'+table,name,beforeHash:hash,beforeDefinition:r.definition,beforeParentColumnId:column,afterDefinition,afterHash:moduleHash(afterDefinition),afterParentColumnId:i<2?0:column,sql:`ALTER TABLE dbo.[${table}] DROP CONSTRAINT [${name}]; ALTER TABLE dbo.[${table}] WITH CHECK ADD CONSTRAINT [${name}] CHECK ${afterDefinition}; ALTER TABLE dbo.[${table}] WITH CHECK CHECK CONSTRAINT [${name}];`};
 });
 return {schemaVersion:'melisa-shared-business-checks.v1',requiredNativeGuardHash:moduleHash(guard),requiredQuarantineFirstCount:37,requiresSameTransaction:true,businessWrites:0,replacements,unchangedChecks:constraints.filter(r=>!pins.some(p=>p[1]===r.name))};
}
