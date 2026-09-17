import fs from 'node:fs';
import path from 'node:path';
import { sql, run, runDir, readRun, hash, ident, literal, protectedManifest, requireRule } from './vega-native-migration-runtime.mjs';
export const common = {source_record_key:'nvarchar(250)', migration_run_id:'nvarchar(80)', source_payload_hash:'char(64)', source_payload_json:'nvarchar(max)', source_document_key:'nvarchar(250)', original_document_date:'nvarchar(40)'};
export const documentColumns={document_no:'nvarchar(250)',document_date:'date',document_type:'nvarchar(80)',source_company:'nvarchar(10)',source_period:'nvarchar(10)',source_document_type:'int',customer_id:'bigint',supplier_id:'bigint',party_entity_id:'bigint',party_currency_account_id:'bigint',currency_code:'nvarchar(3)',exchange_rate:'decimal(28,8)',total_source:'decimal(28,8)',subtotal_source:'decimal(28,8)',discount_source:'decimal(28,8)',amount_currency:'decimal(28,8)',description:'nvarchar(max)',is_return:'bit',affects_balance:'bit',affects_inventory:'bit',salesperson_prefix:'nvarchar(40)',warehouse_name:'nvarchar(80)'};
export const lineColumns={document_id:'bigint',product_id:'bigint',source_product_id:'nvarchar(40)',source_stock_code:'nvarchar(250)',source_product_name:'nvarchar(500)',quantity_exact:'decimal(28,8)',unit_price_source:'decimal(28,8)',line_total_source:'decimal(28,8)',currency_code:'nvarchar(3)',exchange_rate:'decimal(28,8)',discount_rates_json:'nvarchar(500)',description:'nvarchar(max)',unit_name:'nvarchar(40)',unit_multiplier:'decimal(28,8)',brand_snapshot:'nvarchar(250)',category_snapshot:'nvarchar(250)',product_link_status:'nvarchar(100)'};
export async function ensureSchema(request){
 const create=async(table,cols)=>request().query(`IF OBJECT_ID(N'dbo.${table}',N'U') IS NULL CREATE TABLE dbo.${ident(table)}(id bigint IDENTITY PRIMARY KEY,${Object.entries({...cols,...common}).map(([k,v])=>`${ident(k)} ${v} NULL`).join(',')});`);
 const add=async(table,cols)=>{for(const[k,v]of Object.entries(cols))await request().query(`IF COL_LENGTH(N'dbo.${table}',N'${k}') IS NULL ALTER TABLE dbo.${ident(table)} ADD ${ident(k)} ${v} NULL;`);};
 await create('party_entities',{role:'nvarchar(20)',name:'nvarchar(250)',identity_rule:'nvarchar(100)',country:'nvarchar(100)'});
 await create('party_currency_accounts',{party_entity_id:'bigint',currency_code:'nvarchar(3)',customer_id:'bigint',supplier_id:'bigint',current_balance:'decimal(28,8)',balance_status:'nvarchar(100)'});
 await create('party_source_links',{party_entity_id:'bigint',party_currency_account_id:'bigint',customer_id:'bigint',supplier_id:'bigint',source_company:'nvarchar(10)',source_id:'int',source_code:'nvarchar(250)',source_currency:'nvarchar(3)',source_name:'nvarchar(500)'});
 await create('salesperson_aliases',{prefix:'nvarchar(40)',employee_id:'bigint',mapping_status:'nvarchar(80)'});
 await create('inventory_documents',documentColumns);await create('financial_documents',documentColumns);
 await create('inventory_document_items',lineColumns);await create('financial_document_items',lineColumns);
 await create('document_links',{origin_source_key:'nvarchar(250)',related_source_key:'nvarchar(250)',relation_type:'nvarchar(80)',amount_source:'decimal(28,8)',currency_code:'nvarchar(3)',exchange_rate:'decimal(28,8)'});
 await create('product_source_aliases',{product_id:'bigint',source_product_id:'int',stock_code:'nvarchar(250)',source_name:'nvarchar(500)',source_status:'int',quantity_exact:'decimal(28,8)',unit_status:'nvarchar(80)'});
 await create('product_prices',{product_id:'bigint',price_type:'nvarchar(20)',price_tier:'int',currency_code:'nvarchar(3)',price:'decimal(28,8)',source_unit_id:'int'});
 await create('migration_decisions',{record_type:'nvarchar(80)',reason:'nvarchar(120)',status:'nvarchar(40)',details_json:'nvarchar(max)'});
 await create('migration_runs',{run_name:'nvarchar(80)',status:'nvarchar(100)',target_database:'nvarchar(128)',source_snapshot:'nvarchar(80)',start_date:'date',finished_at:'datetime2',receipt_json:'nvarchar(max)'});
 const extra={
  products:{source_notes:'nvarchar(max)',source_sales_currency:'nvarchar(3)',source_purchase_currency:'nvarchar(3)'},
  customers:{party_entity_id:'bigint',source_notes:'nvarchar(max)'},suppliers:{party_entity_id:'bigint',source_notes:'nvarchar(max)'},
  sales_invoices:{party_entity_id:'bigint',party_currency_account_id:'bigint',salesperson_prefix:'nvarchar(40)',source_subtotal:'decimal(28,8)',source_total:'decimal(28,8)',source_header_discounts_json:'nvarchar(500)',source_notes:'nvarchar(max)'},
  purchase_invoices:{party_entity_id:'bigint',party_currency_account_id:'bigint',source_subtotal:'decimal(28,8)',source_total:'decimal(28,8)',source_header_discounts_json:'nvarchar(500)',source_notes:'nvarchar(max)'},
  sales_invoice_items:lineColumns,purchase_invoice_items:{...lineColumns,currency_code:undefined},invoice_return_items:lineColumns,
  invoice_returns:{document_no:'nvarchar(250)',source_notes:'nvarchar(max)',party_entity_id:'bigint',party_currency_account_id:'bigint',affects_inventory:'bit',affects_balance:'bit'},
  stock_movements:{source_document_no:'nvarchar(250)',source_product_id:'nvarchar(40)',source_stock_code:'nvarchar(250)',quantity_in_exact:'decimal(28,8)',quantity_out_exact:'decimal(28,8)',source_notes:'nvarchar(max)',source_warehouse:'nvarchar(80)',warehouse_name:'nvarchar(80)',history_effective:'bit'},
  customer_movements:{party_entity_id:'bigint',party_currency_account_id:'bigint',source_debit:'decimal(28,8)',source_credit:'decimal(28,8)',balance_effect_exact:'decimal(28,8)',affects_balance:'bit',source_document_no:'nvarchar(250)',source_notes:'nvarchar(max)'},
  supplier_movements:{party_entity_id:'bigint',party_currency_account_id:'bigint',source_debit:'decimal(28,8)',source_credit:'decimal(28,8)',balance_effect_exact:'decimal(28,8)',affects_balance:'bit',source_document_no:'nvarchar(250)',source_notes:'nvarchar(max)'},
  finance_accounts:{source_account_name:'nvarchar(250)',balance_exact:'decimal(28,8)',balance_status:'nvarchar(100)'},
  finance_account_movements:{party_entity_id:'bigint',party_currency_account_id:'bigint',source_income:'decimal(28,8)',source_expense:'decimal(28,8)',source_exchange_rate:'decimal(28,8)',amount_exact:'decimal(28,8)',affects_balance:'bit',source_notes:'nvarchar(max)'}
 };
 for(const[t,cols]of Object.entries(extra))await add(t,{...common,...Object.fromEntries(Object.entries(cols).filter(([,v])=>v))});
 for(const t of ['sales_invoice_items','purchase_invoice_items','invoice_return_items','stock_movements']){
  await request().query(`ALTER TABLE dbo.${t} ALTER COLUMN product_id bigint NULL; IF OBJECT_ID(N'dbo.CK_${t}_migration_product') IS NULL ALTER TABLE dbo.${t} ADD CONSTRAINT CK_${t}_migration_product CHECK(product_id IS NOT NULL OR source_record_key IS NOT NULL);`);
 }
 for(const c of ['average_cost_try_snapshot','gross_profit_try'])await request().query(`ALTER TABLE dbo.sales_invoice_items ALTER COLUMN ${c} decimal(18,4) NULL;`);
 await request().query('ALTER TABLE dbo.sales_invoice_items ALTER COLUMN gross_profit_rate decimal(18,6) NULL; ALTER TABLE dbo.invoice_return_items ALTER COLUMN unit_cost_try decimal(18,4) NULL; ALTER TABLE dbo.finance_account_movements ALTER COLUMN party_movement_id bigint NULL;');
 const checks=(await request().query("SELECT OBJECT_NAME(parent_object_id) t,name,definition FROM sys.check_constraints WHERE OBJECT_NAME(parent_object_id) IN(N'customer_movements',N'supplier_movements',N'stock_movements',N'finance_accounts')")).recordset;
 for(const c of checks){if(!/movement_type|source_type|account_type/.test(c.definition)||c.name.endsWith('_native'))continue;await request().query(`ALTER TABLE dbo.${ident(c.t)} DROP CONSTRAINT ${ident(c.name)}; ALTER TABLE dbo.${ident(c.t)} ADD CONSTRAINT ${ident(c.name+'_native')} CHECK((${c.definition}) OR (source_record_key IS NOT NULL AND ${c.t==='finance_accounts'?"account_type=N'unknown'":c.t==='stock_movements'?"source_type=N'vega_history' AND affects_inventory=0":"movement_type=N'vega_journal'"}));`);}
 const all=[...Object.keys(extra),'party_entities','party_currency_accounts','party_source_links','salesperson_aliases','inventory_documents','financial_documents','inventory_document_items','financial_document_items','document_links','product_source_aliases','product_prices','migration_decisions','migration_runs'];
 for(const t of all)await request().query(`IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.${t}') AND name=N'UX_${t}_source_record') CREATE UNIQUE INDEX ${ident('UX_'+t+'_source_record')} ON dbo.${ident(t)}(source_record_key) WHERE source_record_key IS NOT NULL;`);
}
export async function makeStore(pool){
 const schemas=new Map();let tx=null;const request=()=>tx?new sql.Request(tx):pool.request();
 async function phase(name,fn){
  requireRule(readRun('backup-receipt.json').verified,'VERIFIED_BACKUP_REQUIRED');
  tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try{const before=await protectedManifest(request);requireRule(before.hash===readRun('protected-before.json').hash,'TERMINAL_CHANGED');const result=await fn();const after=await protectedManifest(request);requireRule(after.hash===before.hash,'TERMINAL_WRITE_DETECTED');await tx.commit();tx=null;fs.appendFileSync(path.join(runDir,'commits.jsonl'),JSON.stringify({phase:name,committed:true,at:new Date().toISOString(),result})+'\n');console.log(JSON.stringify({phase:name,committed:true,result}));return result;}catch(e){await tx.rollback().catch(()=>{});tx=null;throw e;}
 }
 async function schema(t){if(!schemas.has(t))schemas.set(t,(await request().input('t',sql.NVarChar(128),t).query("SELECT c.name,ty.name type,c.max_length,c.precision,c.scale FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID(N'dbo.'+@t)")).recordset);return schemas.get(t);}
 const type=c=>c.type==='nvarchar'?`nvarchar(${c.max_length===-1?'max':c.max_length/2})`:c.type==='varchar'||c.type==='char'?`${c.type}(${c.max_length})`:c.type==='decimal'?`decimal(${c.precision},${c.scale})`:c.type==='datetime2'?`datetime2(${c.scale})`:c.type;
 async function upsert(t,rows){
  if(!rows.length)return[];const meta=await schema(t),out=[];
  for(let i=0;i<rows.length;i+=250){const batch=rows.slice(i,i+250).map(r=>({source_payload_hash:null,...r,migration_run_id:run}));const columns=[...new Set(batch.flatMap(r=>Object.keys(r)))].filter(k=>k!=='adopt_id');for(const k of columns)requireRule(meta.some(c=>c.name===k),'UNKNOWN_TARGET_COLUMN_'+t+'_'+k);
   requireRule(batch.every(r=>r.source_record_key),'SOURCE_KEY_REQUIRED');requireRule(new Set(batch.map(r=>r.source_record_key)).size===batch.length,'DUPLICATE_BATCH_KEY');
   const defs=columns.map(k=>`${ident(k)} ${type(meta.find(c=>c.name===k))} '$.${k}'`).join(',');
   const statement=`DECLARE @j nvarchar(max)=@data; SELECT * INTO #native_stage FROM OPENJSON(@j) WITH(adopt_id bigint '$.adopt_id',${defs});
   IF EXISTS(SELECT 1 FROM #native_stage s JOIN dbo.${ident(t)} d ON d.source_record_key=s.source_record_key WHERE d.source_payload_hash IS NOT NULL AND s.source_payload_hash IS NOT NULL AND d.source_payload_hash<>s.source_payload_hash) THROW 51000,'SOURCE_PAYLOAD_CHANGED',1;
   IF EXISTS(SELECT 1 FROM #native_stage s JOIN dbo.${ident(t)} d ON d.id=s.adopt_id WHERE d.source_record_key IS NOT NULL AND d.source_record_key<>s.source_record_key) THROW 51000,'ADOPTION_CONFLICT',1;
   MERGE dbo.${ident(t)} WITH(HOLDLOCK) AS d USING #native_stage s ON(d.source_record_key=s.source_record_key OR d.id=s.adopt_id)
   WHEN MATCHED THEN UPDATE SET ${columns.map(k=>`d.${ident(k)}=s.${ident(k)}`).join(',')}
   WHEN NOT MATCHED THEN INSERT(${columns.map(ident).join(',')}) VALUES(${columns.map(k=>'s.'+ident(k)).join(',')})
   OUTPUT inserted.id,inserted.source_record_key,$action action; DROP TABLE #native_stage;`;
   out.push(...(await request().input('data',sql.NVarChar(sql.MAX),JSON.stringify(batch)).query(statement)).recordset);
  }return out;
 }
 return{request,phase,upsert,clearSchema:()=>schemas.clear()};
}
