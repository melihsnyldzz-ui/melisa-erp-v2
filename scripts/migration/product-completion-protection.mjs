// Existing row/field-specific protection protocol; only repeated CASE branches are folded.
// Historical helper remains immutable. Original SHA256 de6bb77dd16b72073e3bee7fdb39e80c945eeea1a027590865d457ea098fba92
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const id=v=>/^[1-9]\d*$/.test(String(v));
const ident=v=>{if(!/^[a-z_][a-z0-9_]*$/i.test(v))throw Error('PROTECTED_IDENTIFIER');return '['+v+']';};
const tables=['products','product_prices','product_barcodes','product_source_aliases','stock_movements','customers','suppliers','party_entities','party_source_links','party_currency_accounts','customer_movements','supplier_movements','sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','invoice_returns','invoice_return_items','finance_accounts','finance_account_movements','cash_adjustments','cash_drawer_accounts','cash_drawers','cash_expenses','cash_session_counts','cash_sessions','cash_transfers','terminal_sync_queue','inventory_cutovers','inventory_cutover_items','inventory_documents','inventory_document_items','financial_documents','financial_document_items','document_links','roles','permissions','users'];
export async function protectedProductProof(q,{plan,mutations=[],inserted=[]}){
 const result={};
 for(const table of tables){
  const own=mutations.filter(m=>m.table===table&&m.targetId),added=inserted.filter(m=>m.table===table);
  if(![...own.map(m=>m.targetId),...added.map(m=>m.id)].every(id))throw Error('PROTECTED_IDS');
  const schema=await q('protected-schema',`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.${table}') ORDER BY column_id`);
  if(!schema.length)throw Error('PROTECTED_TABLE_MISSING');
  const columns=schema.map(c=>c.name),byId=new Map(own.map(m=>[String(m.targetId),new Set([...Object.keys(m.fields),'row_version'])]));
  // Changed fields are excluded only for their approved target row. All other
  // fields, existing records and business ledgers remain byte-hash protected.
  const expression=protectedRowCaseClauses(columns,byId);
  const json=expression?`CASE ${expression} ELSE (SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) END`:'(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)';
  const where=added.length?' WHERE x.id NOT IN('+added.map(m=>m.id).join(',')+')':'';
  const rows=await q('protected-'+table,`SELECT CONVERT(varchar(20),x.id) id,CONVERT(varchar(64),HASHBYTES('SHA2_256',${json}),2) h FROM dbo.${ident(table)} x${where} ORDER BY x.id`);
  result[table]={count:rows.length,hash:hash(rows)};
 }
 for(const table of ['erp_migration.operation_quarantine_holds','erp_migration.operation_quarantine_manifest','erp_migration.goal7_source_version_manifest','erp_migration.goal7_source_version_products','erp_migration.goal7_source_version_prices','erp_migration.goal7_source_version_records','erp_migration.accepted_price_products','erp_migration.accepted_price_values']){
  const columns=await q('protected-other-schema',`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'${table}') ORDER BY column_id`);if(!columns.length)throw Error('PROTECTED_IMMUTABLE_TABLE_MISSING');
  const key=columns.some(c=>c.name==='version_run_id')?'version_run_id':columns.some(c=>c.name==='run_id')?'run_id':null;
  const where=key?` WHERE x.${key}<>@run`:'';
  const order=columns.filter(c=>['run_id','version_run_id','entity','source_key','product_id','price_id','product_source_key'].includes(c.name)).map(c=>'x.'+ident(c.name)).join(',');
  if(!order)throw Error('PROTECTED_IMMUTABLE_ORDER');
  const rows=await q('protected-immutable',`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM ${table} x${where} ORDER BY ${order}`,key?{run:plan.runId}:{});result[table]={count:rows.length,hash:hash(rows)};
 }
 const extra=await q('protected-special-tables',"SELECT SCHEMA_NAME(schema_id) s,name FROM sys.tables WHERE name LIKE N'%media%' OR name LIKE N'%purchase_reference%' OR name LIKE N'%cost%' OR name LIKE N'goal73_%' OR name LIKE N'current_finance_%' OR name LIKE N'final_cutover_%' ORDER BY schema_id,name");
 for(const t of extra){const full=ident(t.s)+'.'+ident(t.name);const rows=await q('protected-special',`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM ${full} x ORDER BY h`);result[t.s+'.'+t.name]={count:rows.length,hash:hash(rows)};}
 return result;
}

// Identical per-row projection, grouped only by the exact included column list.
export function protectedRowCaseClauses(columns,byId){
 const groups=new Map();
 for(const [target,omit] of byId){if(!id(target)||!(omit instanceof Set))throw Error('PROTECTED_IDS');const keep=columns.filter(c=>!omit.has(c)),key=JSON.stringify(keep);if(!groups.has(key))groups.set(key,{keep,ids:[]});groups.get(key).ids.push(target);}
 return groups.size?[...groups.values()].map(g=>`WHEN x.id IN(${g.ids.join(',')}) THEN (SELECT ${g.keep.map(c=>'x.'+ident(c)).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)`).join(' '):null;
}
