// Explicit future isolated SQL-engine rehearsal. No CLI, driver discovery,
// credentials, database calls, or filesystem operations happen on import.
// Only synthetic rows are inserted, solely in the two named fixture schemas.
import {hash} from '../migration/party-currency-readonly-plan.mjs';
import {check,TARGET,sqlHash,DDL as GOAL73_DDL} from '../migration/goal73-supplier-delta.mjs';
import {FINAL_PARTY_READ_PROC_SQL} from '../../apps/api/src/services/finalPartyDeltaRead.mjs';
import {FINAL_MUTABLE_TABLES,FINAL_PROTECTED_TABLES,FINAL_SCHEMA_SQL,FINAL_GUARD_SQL,createFinalSqlStore,createFinalSqlFixtureDriver,readAcceptedFinalReceipts,finalNativeReadSql,finalMutations} from '../migration/final-cutover-sql.mjs';
import {buildFinalCutoverPlan,captureRowsHash} from '../migration/final-cutover-plan.mjs';
import {runFinalCutoverFixture} from '../migration/final-cutover-runtime.mjs';
const N='final_cutover_fixture_n',J='final_cutover_fixture_j';
const ident=s=>{check(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s),'GOAL8_FIXTURE_IDENTIFIER');return '['+s+']';};
export const fixtureGuardName=name=>name.startsWith('test_')?'test_fixture_'+name.slice(5):name.startsWith('c03_guard_')?'c03_guard_fixture_'+name.slice(10):name.startsWith('c09_guard_')?'c09_guard_fixture_'+name.slice(10):name.startsWith('operation_quarantine_')?'fixture_quarantine_'+name.slice(21):'fixture_native_'+name;
const lit=s=>"N'"+String(s).replaceAll("'","''")+"'";
const map=s=>s.replaceAll('[erp_migration].','['+J+'].').replaceAll('[dbo].','['+N+'].').replaceAll('erp_migration.',J+'.').replaceAll('dbo.',N+'.');
export function fixtureGuardDefinition(g){
 const header=s=>s.replace(/^CREATE\s+TRIGGER\s+(?:\[?[A-Za-z_]\w*\]?\.)?\[?[A-Za-z_]\w*\]?/i,`CREATE TRIGGER ${ident(N)}.${ident(fixtureGuardName(g.name))}`);
 if(!g.name.startsWith('operation_quarantine_'))return header(map(g.definition));
 // Genuine original accepted readiness remains READ ONLY against the original
 // sealed manifest/runs/hold hashes and 37 original guard names. The synthetic
 // namespace applies its own hold lookup; it never fabricates 176/172/54 holds.
 const marker=' IF EXISTS(SELECT 1 FROM(SELECT * FROM inserted UNION ALL SELECT * FROM deleted)x WHERE ',cut=g.definition.lastIndexOf(marker),body=g.definition.indexOf('AS BEGIN');
 check(cut>body&&body>0&&g.definition.indexOf(marker)===cut,'GOAL8_FIXTURE_QUARANTINE_BOUNDARY');
 const prefix=header(map(g.definition.slice(0,body)))+g.definition.slice(body,cut),suffix=map(g.definition.slice(cut));
 const sql=prefix+suffix;check(!/\b(?:INSERT\s+(?:INTO\s+)?|UPDATE\s+|DELETE\s+(?:FROM\s+)?|MERGE\s+|TRUNCATE\s+TABLE\s+)(?:\[?dbo\]?|\[?erp_migration\]?)\s*\./i.test(sql),'GOAL8_FIXTURE_QUARANTINE_COMMERCIAL_MUTATION');return sql;
}
const q=async(tx,sql,params={})=>{
 // Source introspection is SELECT-only. Every mutation must already have been
 // translated; an unmapped native dependency aborts before sending SQL.
 if(/\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE)\b/i.test(sql)&&/\b(?:dbo|erp_migration)\s*\.|\[(?:dbo|erp_migration)\]\s*\./i.test(sql)){
  const quarantine=/^CREATE\s+TRIGGER\s+\[final_cutover_fixture_n\]\.\[fixture_quarantine_\w+\]/i.test(sql);
  const refs=[...sql.matchAll(/\b(?:dbo|erp_migration)\s*\.\s*(\w+)/gi)];
  check(quarantine&&!/\[?(?:dbo)\]?\s*\./i.test(sql)&&refs.every(r=>/erp_migration\./i.test(r[0])&&['operation_quarantine_manifest','operation_quarantine_holds','runs'].includes(r[1]))&&!/\b(?:INSERT\s+(?:INTO\s+)?|UPDATE\s+|DELETE\s+(?:FROM\s+)?|MERGE\s+|ALTER\s+TABLE\s+|DROP\s+TABLE\s+|TRUNCATE\s+TABLE\s+)(?:\[?dbo\]?|\[?erp_migration\]?)\s*\./i.test(sql),'GOAL8_FIXTURE_UNMAPPED_COMMERCIAL_REFERENCE');
 }
 const r=await tx.query(sql,params);return r?.recordset??r??[];
};
function expectedFixtureFailure(error,expected,code){
 if(error?.message===expected)return;
 const nativeNumber=error?.number??error?.originalError?.info?.number??null,nativeCode=error?.code??error?.originalError?.code??null;
 throw Object.assign(Error(code),{cause:{nativeNumber:Number.isSafeInteger(nativeNumber)?nativeNumber:null,nativeCode:typeof nativeCode==='string'&&/^[A-Z0-9_]+$/.test(nativeCode)?nativeCode:null}});
}
function type(c){
 if(c.type==='timestamp')return 'rowversion';
 if(['nvarchar','nchar','varchar','char','varbinary','binary'].includes(c.type))return `${c.type}(${c.max_length===-1?'max':['nvarchar','nchar'].includes(c.type)?c.max_length/2:c.max_length})`;
 if(['decimal','numeric'].includes(c.type))return `${c.type}(${c.precision},${c.scale})`;
 if(['datetime2','datetimeoffset','time'].includes(c.type))return `${c.type}(${c.scale})`;
 check(['bigint','int','bit','date','datetime','smalldatetime','smallint','tinyint','uniqueidentifier','float','real','money','smallmoney','text','ntext','image','xml'].includes(c.type),'GOAL8_FIXTURE_COLUMN_TYPE');return c.type;
}
function generic(c){
 if(['nvarchar','nchar','varchar','char','text','ntext'].includes(c.type))return c.name==='currency_code'||c.name==='account_currency'?'TRY':c.name==='unit'?'ADET':c.name==='movement_type'?'sales_invoice':c.name==='source_type'?'sales_invoice':c.name==='status'?'finalized':c.name==='direction'?'in':c.name==='account_type'?'cash':c.name==='role'?'customer':'TEST-FINAL-'+c.name;
 if(c.type==='uniqueidentifier')return '99999999-9999-4999-8999-999999999999';
 if(['date','datetime','datetime2','smalldatetime','datetimeoffset'].includes(c.type))return '2026-10-09';
 if(c.type==='time')return '09:00:00';
 if(['binary','varbinary','image','xml'].includes(c.type))return null;
 return '1';
}
async function insert(tx,table,metadata,fields,schema=N){
 const cols=metadata.filter(c=>c.table===table&&c.schema===(schema===N?'dbo':'erp_migration')&&!c.is_computed&&c.type!=='timestamp');
 const row={};for(const c of cols){if(Object.hasOwn(fields,c.name))row[c.name]=fields[c.name];else if(c.is_identity)continue;else if(c.is_nullable)row[c.name]=null;else if(!c.default_definition)row[c.name]=generic(c);}
 const names=Object.keys(row),defs=names.map(n=>`${ident(n)} ${type(cols.find(c=>c.name===n))} '$.${n}'`).join(',');
 const identity=cols.find(c=>c.is_identity&&Object.hasOwn(row,c.name));
 await q(tx,`${identity?`SET IDENTITY_INSERT ${ident(schema)}.${ident(table)} ON;`:''}INSERT ${ident(schema)}.${ident(table)}(${names.map(ident).join(',')}) SELECT ${names.map(ident).join(',')} FROM OPENJSON(@j) WITH(${defs});${identity?`SET IDENTITY_INSERT ${ident(schema)}.${ident(table)} OFF;`:''}`,{j:JSON.stringify(row)});
}
async function fixtureMutation(tx,mutate){
 const identity=(await q(tx,'SELECT @@SERVERNAME server,DB_NAME() [database]'))[0];check(identity?.server===TARGET.server&&identity.database===TARGET.database,'GOAL8_FIXTURE_TEST_IDENTITY');
 const guards=await q(tx,map(FINAL_GUARD_SQL)),wrapped=guards.filter(g=>/^test_|^c03_guard_|^c09_guard_/.test(g.name));
 // This helper is private to these exact anonymous fixture mutations. Only the
 // copied namespace guards are removed in the same transaction; validation
 // triggers and every cloned CHECK/FK remain active, then originals/order return.
 for(const g of wrapped)await q(tx,`DROP TRIGGER ${ident(N)}.${ident(g.name)}`);
 await mutate();
 for(const g of wrapped){await q(tx,g.definition);for(const [op,k] of [['INSERT','i'],['UPDATE','u'],['DELETE','d']]){const order=g['first_'+k]?'First':g['last_'+k]?'Last':null;if(order)await q(tx,`EXEC sys.sp_settriggerorder @triggername=${lit(N+'.'+g.name)},@order=${lit(order)},@stmttype=${lit(op)}`);}}
 check(hash(await q(tx,map(FINAL_GUARD_SQL)))===hash(guards),'GOAL8_FIXTURE_GUARD_RESTORE');
}
async function fixtureMetadata(tx){return q(tx,`SELECT N'dbo' [schema],OBJECT_NAME(c.object_id) [table],c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed,dc.definition default_definition FROM sys.columns c LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id WHERE OBJECT_SCHEMA_NAME(c.object_id)=${lit(N)}`);}
async function laterFixtureLocal(tx){const metadata=await fixtureMetadata(tx);await fixtureMutation(tx,async()=>{
 for(const role of ['customer','supplier'])for(const [n,currency]of ['TRY','USD','EUR'].entries()){
  const id=String((role==='customer'?10:13)+n),party=role==='customer'?'40':'43';
  await insert(tx,role+'_movements',metadata,{id:String(400+Number(id)),[role+'_id']:party,party_entity_id:party,party_currency_account_id:id,movement_type:role==='customer'?'sales_invoice':'purchase_invoice',currency_code:currency,account_currency:currency,amount:'2.0000',balance_effect:'2.0000',balance_effect_exact:'2.00000000',affects_balance:true,source_record_key:null,migration_run_id:null,document_date:'2026-10-09'});
  await q(tx,`UPDATE ${ident(N)}.party_currency_accounts SET current_balance=current_balance+2 WHERE id=@id`,{id});
 }
 await q(tx,`UPDATE ${ident(N)}.customers SET balance=balance+2 WHERE id=40;UPDATE ${ident(N)}.suppliers SET balance=balance+2 WHERE id=43;`);
 await insert(tx,'stock_movements',metadata,{id:'420',product_id:'20',movement_type:'adjustment',source_type:'stock_adjustment',quantity_in:'2.000',quantity_out:'0.000',quantity_net:'2.000',affects_inventory:true,created_by:'13',source_record_key:null,migration_run_id:null,inventory_cutover_id:null,document_date:'2026-10-09'});
 await q(tx,`UPDATE ${ident(N)}.products SET current_stock_qty=current_stock_qty+2 WHERE id=20`);
});}
export async function prepareGoal8CutoverFixture(driver,{authorization}={}){
 check(authorization?.action==='CREATE_SYNTHETIC_FINAL_CUTOVER_FIXTURE'&&hash(authorization.target)===hash(TARGET),'GOAL8_FIXTURE_AUTHORIZATION');
 return driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const identity=(await q(tx,'SELECT @@SERVERNAME server,DB_NAME() [database]'))[0];check(identity?.server===TARGET.server&&identity.database===TARGET.database,'GOAL8_FIXTURE_TEST_IDENTITY');
  const exists=await q(tx,`SELECT name FROM sys.schemas WHERE name IN(${lit(N)},${lit(J)})`);check(exists.length===0,'GOAL8_FIXTURE_ALREADY_EXISTS_PRESERVED');
  const wanted=new Set([...FINAL_PROTECTED_TABLES,'users','roles','permissions','inventory_cutovers','inventory_cutover_items','test_goods_receipts','work_finops_scope','work_supplier_payment_requests','work_trade_products']);
  // Follow actual native foreign-key dependencies without reading any rows.
  const fks=await q(tx,"SELECT fk.name,OBJECT_SCHEMA_NAME(fk.parent_object_id) [schema],OBJECT_NAME(fk.parent_object_id) [table],OBJECT_SCHEMA_NAME(fk.referenced_object_id) refSchema,OBJECT_NAME(fk.referenced_object_id) refTable,(SELECT pc.name parentColumn,rc.name refColumn FROM sys.foreign_key_columns fkc JOIN sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id JOIN sys.columns rc ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id WHERE fkc.constraint_object_id=fk.object_id ORDER BY fkc.constraint_column_id FOR JSON PATH) columnsJSON FROM sys.foreign_keys fk WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id)=N'dbo'");
  let changed=true;while(changed){changed=false;for(const fk of fks)if(wanted.has(fk.table)&&fk.refSchema==='dbo'&&!wanted.has(fk.refTable)){wanted.add(fk.refTable);changed=true;}}
  const names=[...wanted];
  const metadata=await q(tx,`SELECT OBJECT_SCHEMA_NAME(c.object_id) [schema],OBJECT_NAME(c.object_id) [table],c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed,cc.definition computed_definition,dc.definition default_definition FROM sys.columns c LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id WHERE(OBJECT_SCHEMA_NAME(c.object_id)=N'dbo' AND OBJECT_NAME(c.object_id) IN(${names.map(lit).join(',')})) OR c.object_id=OBJECT_ID(N'erp_migration.operation_quarantine_holds') ORDER BY [schema],[table],c.column_id`);
  check(names.every(t=>metadata.some(c=>c.schema==='dbo'&&c.table===t)),'GOAL8_FIXTURE_SOURCE_SCHEMA_MISSING');
  const checks=await q(tx,`SELECT OBJECT_NAME(parent_object_id) [table],name,definition FROM sys.check_constraints WHERE OBJECT_SCHEMA_NAME(parent_object_id)=N'dbo' AND OBJECT_NAME(parent_object_id) IN(${names.map(lit).join(',')}) ORDER BY [table],name`);
  const indexes=await q(tx,`SELECT OBJECT_NAME(i.object_id) [table],i.name,i.is_primary_key,i.is_unique,i.filter_definition,(SELECT c.name,ic.is_descending_key,ic.is_included_column FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.key_ordinal,ic.index_column_id FOR JSON PATH) columnsJSON FROM sys.indexes i WHERE i.index_id>0 AND i.type IN(1,2) AND i.is_hypothetical=0 AND OBJECT_SCHEMA_NAME(i.object_id)=N'dbo' AND OBJECT_NAME(i.object_id) IN(${names.map(lit).join(',')}) ORDER BY [table],name`);
  const guards=await q(tx,FINAL_GUARD_SQL);
  const view=(await q(tx,"SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.inventory_effective_movements')) definition"))[0];check(view?.definition,'GOAL8_FIXTURE_STOCK_VIEW_MISSING');
  await q(tx,`CREATE SCHEMA ${ident(N)};`);await q(tx,`CREATE SCHEMA ${ident(J)};`);
  for(const [schema,table] of [...names.map(t=>[N,t]),[J,'operation_quarantine_holds']]){
   const columns=metadata.filter(c=>c.schema===(schema===N?'dbo':'erp_migration')&&c.table===table);check(columns.length>0,'GOAL8_FIXTURE_TABLE_COLUMNS');
   const ddl=columns.map(c=>c.is_computed?`${ident(c.name)} AS ${map(c.computed_definition)}`:`${ident(c.name)} ${type(c)}${c.is_identity?' IDENTITY(1,1)':''}${c.type==='timestamp'?'':c.is_nullable?' NULL':' NOT NULL'}${c.default_definition?' DEFAULT '+map(c.default_definition):''}`).join(',');
   await q(tx,`CREATE TABLE ${ident(schema)}.${ident(table)}(${ddl})`);
  }
  // Exact native constraints are installed BEFORE the scoped rehearsal. Seeding
  // helper only inserts independent synthetic parent placeholders; it never
  // relaxes constraints or disables cloned triggers to force a passing run.
  for(const ix of indexes){const cs=JSON.parse(ix.columnsJSON),keys=cs.filter(c=>!c.is_included_column),included=cs.filter(c=>c.is_included_column);if(!keys.length)continue;const name='fixture_'+hash(ix.table+'/'+ix.name).slice(0,20);await q(tx,ix.is_primary_key?`ALTER TABLE ${ident(N)}.${ident(ix.table)} ADD CONSTRAINT ${ident(name)} PRIMARY KEY(${keys.map(c=>ident(c.name)+(c.is_descending_key?' DESC':'')).join(',')})`:`CREATE ${ix.is_unique?'UNIQUE ':''}INDEX ${ident(name)} ON ${ident(N)}.${ident(ix.table)}(${keys.map(c=>ident(c.name)+(c.is_descending_key?' DESC':'')).join(',')})${included.length?' INCLUDE('+included.map(c=>ident(c.name)).join(',')+')':''}${ix.filter_definition?' WHERE '+ix.filter_definition:''}`);}
  // No generic business rows are needed: only native party/product parent rows
  // referenced by the deliberately synthetic movement set are inserted.
  await insert(tx,'roles',metadata,{id:'1',code:'TEST_FINAL',name:'TEST FINAL',is_active:true});
  await insert(tx,'users',metadata,{id:'13',username:'TEST_FINAL_ACTOR',display_name:'TEST FINAL ACTOR',password_hash:'TEST_DISABLED',role_id:'1',is_active:true});
  for(const [n,key] of ['stock.adjust','customer.view','supplier.view'].entries())await insert(tx,'permissions',metadata,{id:String(n+1),role_id:'1',permission_key:key,can_view:true});
  for(const role of ['customer','supplier']){
   const partyId=role==='customer'?'40':'43';await insert(tx,'party_entities',metadata,{id:partyId,role,name:'TEST FINAL '+role});
   await insert(tx,role==='customer'?'customers':'suppliers',metadata,{id:partyId,[role+'_code']:'TEST-FINAL-'+role,name:'TEST FINAL '+role,currency_code:'TRY',balance:'105.0000',party_entity_id:partyId});
   await insert(tx,'party_source_links',metadata,{id:partyId,party_entity_id:partyId,[role+'_id']:partyId,source_company:role==='customer'?'F0102':'F0103',source_id:'100'});
   for(const [n,currency] of ['TRY','USD','EUR'].entries()){
    const accountId=String((role==='customer'?10:13)+n),prior=role==='supplier'&&currency==='USD';await insert(tx,'party_currency_accounts',metadata,{id:accountId,party_entity_id:partyId,[role+'_id']:partyId,currency_code:currency,current_balance:prior?'85.00000000':'105.00000000'});
    const base={id:accountId,party_entity_id:partyId,[role+'_id']:partyId,party_currency_account_id:accountId,movement_type:'vega_journal',currency_code:currency,account_currency:currency,amount:'100.0000',balance_effect:'100.0000',balance_effect_exact:'100.00000000',affects_balance:true,document_date:'2026-10-09',source_record_key:'TEST-FINAL-OPENING/'+accountId,migration_run_id:'TEST-FINAL-OPENING'};
    await insert(tx,role+'_movements',metadata,base);await insert(tx,role+'_movements',metadata,{...base,id:String(100+Number(accountId)),amount:'5.0000',balance_effect:'5.0000',balance_effect_exact:'5.00000000',source_record_key:null,migration_run_id:null,movement_type:role==='customer'?'sales_invoice':'purchase_invoice'});
    if(prior)await insert(tx,role+'_movements',metadata,{...base,id:'214',movement_type:'MIGRATION_HISTORICAL_ADJUSTMENT',amount:'20.0000',balance_effect:'-20.0000',balance_effect_exact:'-20.00000000',source_record_key:'GOAL73-44444444-4444-4444-8444-444444444444/14',migration_run_id:'GOAL73-44444444-4444-4444-8444-444444444444',source_payload_hash:'b'.repeat(64)});
   }
  }
  await insert(tx,'products',metadata,{id:'20',stock_code:'TEST-FINAL-P20',name:'TEST FINAL PRODUCT',unit:'ADET',currency_code:'TRY',current_stock_qty:'13.000',average_cost_try:null,supplier_id:null,is_active:true,is_deleted:false,source_record_key:'TEST-FINAL-P20'}); // gitleaks:allow anonymous synthetic source key
  await insert(tx,'product_source_aliases',metadata,{id:'20',product_id:'20',source_product_id:'200'});
  const stock={product_id:'20',movement_type:'adjustment',source_type:'stock_adjustment',quantity_in:'20.000',quantity_out:'0.000',quantity_net:'20.000',affects_inventory:true,document_date:'2026-10-09',created_by:'13',inventory_cutover_id:null,source_record_key:'TEST-FINAL-OPENING/20',migration_run_id:'TEST-FINAL-OPENING'};
  await insert(tx,'stock_movements',metadata,{...stock,id:'20'});await insert(tx,'stock_movements',metadata,{...stock,id:'120',quantity_in:'0.000',quantity_out:'3.000',quantity_net:'-3.000',source_record_key:null,migration_run_id:null});
  await insert(tx,'stock_movements',metadata,{...stock,id:'220',quantity_in:'0.000',quantity_out:'4.000',quantity_net:'-4.000',source_record_key:'GOAL7-44444444-4444-4444-8444-444444444444/STOCK/44444444-4444-4444-8444-444444444444',migration_run_id:'GOAL7-44444444-4444-4444-8444-444444444444',source_payload_hash:'b'.repeat(64)});
  await insert(tx,'audit_logs',metadata,{id:'314',actor_user_id:'13',action:'goal73_currency_delta',entity_type:'party_currency_account',entity_id:'14',before_json:'{"fixtureOnly":true}',after_json:'{"fixtureOnly":true}',reason:'GOAL73-44444444-4444-4444-8444-444444444444',source:'goal73'});
  await q(tx,map(GOAL73_DDL));await q(tx,`INSERT ${ident(N)}.goal73_supplier_currency_runs VALUES(N'GOAL73-44444444-4444-4444-8444-444444444444',@h,@h,N'COMMITTED',13,N'{"fixtureOnly":true}');INSERT ${ident(N)}.goal73_supplier_currency_effects VALUES(N'GOAL73-44444444-4444-4444-8444-444444444444',@h,14,43,N'USD',-20,N'{"fixtureOnly":true}',N'{"fixtureOnly":true}',214,314)`,{h:'b'.repeat(64)});
  // Same committed Goal7 journal contract used by goal7-test-delta.mjs; these
  // synthetic prior rows prove residual subtraction against native movement220.
  await q(tx,`CREATE TABLE ${ident(J)}.goal7_delta_runs(run_id nvarchar(80) PRIMARY KEY,source_hash char(64) NOT NULL,plan_hash char(64) NOT NULL,run_kind nvarchar(30) NOT NULL,parent_run_id nvarchar(80) NULL,status nvarchar(20) NOT NULL CHECK(status=N'COMMITTED'),receipt_json nvarchar(max) NOT NULL);
CREATE TABLE ${ident(J)}.goal7_delta_atoms(run_id nvarchar(80) NOT NULL,atom_id uniqueidentifier NOT NULL,source_key nvarchar(250) NOT NULL,product_id bigint NOT NULL,payload_hash char(64) NOT NULL,before_hash char(64) NOT NULL,before_json nvarchar(max) NOT NULL,delta_qty decimal(18,3) NOT NULL,source_capture_hash char(64) NOT NULL,before_source_qty decimal(18,3) NOT NULL,after_source_qty decimal(18,3) NOT NULL,source_effect_key nvarchar(400) NOT NULL UNIQUE,PRIMARY KEY(run_id,atom_id),UNIQUE(run_id,product_id));
CREATE TABLE ${ident(J)}.goal7_delta_effects(run_id nvarchar(80) NOT NULL,atom_id uniqueidentifier NOT NULL,effect_id bigint NOT NULL UNIQUE,parent_effect_id bigint NULL,after_hash char(64) NOT NULL,PRIMARY KEY(run_id,atom_id));CREATE UNIQUE INDEX IX_fixture_goal7_compensated_effect ON ${ident(J)}.goal7_delta_effects(parent_effect_id) WHERE parent_effect_id IS NOT NULL;`);
  await q(tx,`INSERT ${ident(J)}.goal7_delta_runs VALUES(N'GOAL7-44444444-4444-4444-8444-444444444444',@h,@h,N'SOURCE_SAFE',NULL,N'COMMITTED',N'{"fixtureOnly":true}');INSERT ${ident(J)}.goal7_delta_atoms VALUES(N'GOAL7-44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',N'VEGA2026/F0102/TBLSTOKLAR/200',20,@h,@h,N'{"fixtureOnly":true}',-4,@h,20,16,N'TEST-FINAL-PRIOR-STOCK');INSERT ${ident(J)}.goal7_delta_effects VALUES(N'GOAL7-44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',220,NULL,@h)`,{h:'b'.repeat(64)});
  await insert(tx,'product_prices',metadata,{id:'30',product_id:'20',price_type:'sale',price_tier:1,currency_code:'USD',price:'9.00000000',source_unit_id:'1'});
  await insert(tx,'product_prices',metadata,{id:'31',product_id:'20',price_type:'purchase',price_tier:0,currency_code:'EUR',price:null,source_unit_id:null});
  for(const c of checks)await q(tx,`ALTER TABLE ${ident(N)}.${ident(c.table)} WITH CHECK ADD CONSTRAINT ${ident('fixture_'+hash(c.table+'/'+c.name).slice(0,20))} CHECK ${map(c.definition)}`);
  for(const fk of fks.filter(f=>wanted.has(f.table)&&wanted.has(f.refTable)&&f.refSchema==='dbo')){const cs=JSON.parse(fk.columnsJSON);await q(tx,`ALTER TABLE ${ident(N)}.${ident(fk.table)} WITH CHECK ADD CONSTRAINT ${ident('fixture_'+hash(fk.table+'/'+fk.name).slice(0,20))} FOREIGN KEY(${cs.map(c=>ident(c.parentColumn)).join(',')}) REFERENCES ${ident(N)}.${ident(fk.refTable)}(${cs.map(c=>ident(c.refColumn)).join(',')})`);}
  await q(tx,map(view.definition.replace(/^CREATE\s+OR\s+ALTER\s+VIEW/i,'CREATE VIEW').replace(/^ALTER\s+VIEW/i,'CREATE VIEW')));
  for(const g of guards){check(/^CREATE\s+TRIGGER\b/i.test(g.definition)&&!g.disabled,'GOAL8_FIXTURE_GUARD_FORMAT');const name=fixtureGuardName(g.name);await q(tx,fixtureGuardDefinition(g));for(const [op,k] of [['INSERT','i'],['UPDATE','u'],['DELETE','d']]){const order=g['first_'+k]?'First':g['last_'+k]?'Last':null;if(order)await q(tx,`EXEC sys.sp_settriggerorder @triggername=${lit(N+'.'+name)},@order=${lit(order)},@stmttype=${lit(op)}`);}}
  const checkpoint={};for(const table of FINAL_MUTABLE_TABLES)checkpoint[table]=await q(tx,`SELECT x.* FROM ${ident(N)}.${ident(table)} x ORDER BY x.id`);
  const checkpointJSON=JSON.stringify(checkpoint),checkpointHash=hash(JSON.parse(checkpointJSON));await q(tx,`CREATE TABLE ${ident(J)}.fixture_recovery_checkpoint(checkpoint_hash char(64) PRIMARY KEY,checkpoint_json nvarchar(max) NOT NULL,kind nvarchar(80) NOT NULL);`);await q(tx,`INSERT ${ident(J)}.fixture_recovery_checkpoint VALUES(@h,@j,N'SYNTHETIC_NAMESPACE_RECOVERY')`,{h:checkpointHash,j:checkpointJSON});
  return {evidenceKind:'SYNTHETIC_NATIVE_SQL',nativeSchema:N,journalSchema:J,sourceSchemaHash:hash(metadata),sourceConstraintHash:hash({checks,indexes,fks}),sourceGuardHash:hash(guards),fixtureRecoveryCheckpointHash:checkpointHash,commercialWrites:0,actualT1:false,fixtureOnly:true,fixtureTables:names};
 });
}
export async function prepareGoal8CutoverFixtureDependencies(driver,{fixtureReceipt}={}){
 check(fixtureReceipt?.fixtureOnly===true&&fixtureReceipt.actualT1===false&&fixtureReceipt.nativeSchema===N&&fixtureReceipt.journalSchema===J,'GOAL8_FIXTURE_RECEIPT');
 return driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const identity=(await q(tx,'SELECT @@SERVERNAME server,DB_NAME() [database]'))[0];check(identity?.server===TARGET.server&&identity.database===TARGET.database,'GOAL8_FIXTURE_TEST_IDENTITY');
  const checkpoint=await q(tx,`SELECT checkpoint_json FROM ${ident(J)}.fixture_recovery_checkpoint WHERE checkpoint_hash=@h AND kind=N'SYNTHETIC_NAMESPACE_RECOVERY'`,{h:fixtureReceipt.fixtureRecoveryCheckpointHash});check(checkpoint.length===1&&hash(JSON.parse(checkpoint[0].checkpoint_json))===fixtureReceipt.fixtureRecoveryCheckpointHash,'GOAL8_FIXTURE_NAMESPACE_RECOVERY_DRIFT');
  const wanted=new Set(['test_goods_receipts','work_finops_scope','work_supplier_payment_requests','work_trade_products']);
  const fks=await q(tx,"SELECT fk.name,OBJECT_SCHEMA_NAME(fk.parent_object_id) [schema],OBJECT_NAME(fk.parent_object_id) [table],OBJECT_SCHEMA_NAME(fk.referenced_object_id) refSchema,OBJECT_NAME(fk.referenced_object_id) refTable,(SELECT pc.name parentColumn,rc.name refColumn FROM sys.foreign_key_columns fkc JOIN sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id JOIN sys.columns rc ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id WHERE fkc.constraint_object_id=fk.object_id ORDER BY fkc.constraint_column_id FOR JSON PATH) columnsJSON FROM sys.foreign_keys fk WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id)=N'dbo'");
  let changed=true;while(changed){changed=false;for(const fk of fks)if(wanted.has(fk.table)&&fk.refSchema==='dbo'&&!wanted.has(fk.refTable)){wanted.add(fk.refTable);changed=true;}}
  const existing=new Set((await q(tx,`SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID(${lit(N)})`)).map(t=>t.name));check(existing.has('products')&&existing.has('party_currency_accounts'),'GOAL8_FIXTURE_OWN_NAMESPACE_REQUIRED');
  const names=[...wanted].filter(t=>!existing.has(t));if(!names.length)return {fixtureOnly:true,actualT1:false,commercialWrites:0,addedTables:[],status:'DEPENDENCIES_ALREADY_PRESENT'};
  const metadata=await q(tx,`SELECT OBJECT_NAME(c.object_id) [table],c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed,cc.definition computed_definition,dc.definition default_definition FROM sys.columns c LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id WHERE OBJECT_SCHEMA_NAME(c.object_id)=N'dbo' AND OBJECT_NAME(c.object_id) IN(${names.map(lit).join(',')}) ORDER BY [table],c.column_id`);
  const checks=await q(tx,`SELECT OBJECT_NAME(parent_object_id) [table],name,definition FROM sys.check_constraints WHERE OBJECT_SCHEMA_NAME(parent_object_id)=N'dbo' AND OBJECT_NAME(parent_object_id) IN(${names.map(lit).join(',')}) ORDER BY [table],name`);
  const indexes=await q(tx,`SELECT OBJECT_NAME(i.object_id) [table],i.name,i.is_primary_key,i.is_unique,i.filter_definition,(SELECT c.name,ic.is_descending_key,ic.is_included_column FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.key_ordinal,ic.index_column_id FOR JSON PATH) columnsJSON FROM sys.indexes i WHERE i.index_id>0 AND i.type IN(1,2) AND OBJECT_SCHEMA_NAME(i.object_id)=N'dbo' AND OBJECT_NAME(i.object_id) IN(${names.map(lit).join(',')}) ORDER BY [table],name`);
  for(const table of names){const columns=metadata.filter(c=>c.table===table);check(columns.length,'GOAL8_FIXTURE_DEPENDENCY_SCHEMA_MISSING');await q(tx,`CREATE TABLE ${ident(N)}.${ident(table)}(${columns.map(c=>c.is_computed?`${ident(c.name)} AS ${map(c.computed_definition)}`:`${ident(c.name)} ${type(c)}${c.is_identity?' IDENTITY(1,1)':''}${c.type==='timestamp'?'':c.is_nullable?' NULL':' NOT NULL'}${c.default_definition?' DEFAULT '+map(c.default_definition):''}`).join(',')})`);}
  for(const ix of indexes){const cs=JSON.parse(ix.columnsJSON),keys=cs.filter(c=>!c.is_included_column),included=cs.filter(c=>c.is_included_column);if(!keys.length)continue;const name='fixture_'+hash(ix.table+'/'+ix.name).slice(0,20);await q(tx,ix.is_primary_key?`ALTER TABLE ${ident(N)}.${ident(ix.table)} ADD CONSTRAINT ${ident(name)} PRIMARY KEY(${keys.map(c=>ident(c.name)+(c.is_descending_key?' DESC':'')).join(',')})`:`CREATE ${ix.is_unique?'UNIQUE ':''}INDEX ${ident(name)} ON ${ident(N)}.${ident(ix.table)}(${keys.map(c=>ident(c.name)+(c.is_descending_key?' DESC':'')).join(',')})${included.length?' INCLUDE('+included.map(c=>ident(c.name)).join(',')+')':''}${ix.filter_definition?' WHERE '+ix.filter_definition:''}`);}
  for(const c of checks)await q(tx,`ALTER TABLE ${ident(N)}.${ident(c.table)} WITH CHECK ADD CONSTRAINT ${ident('fixture_'+hash(c.table+'/'+c.name).slice(0,20))} CHECK ${map(c.definition)}`);
  for(const fk of fks.filter(f=>names.includes(f.table))){check(fk.refSchema==='dbo'&&(wanted.has(fk.refTable)||existing.has(fk.refTable)),'GOAL8_FIXTURE_DEPENDENCY_FOREIGN_SCHEMA');const cs=JSON.parse(fk.columnsJSON);await q(tx,`ALTER TABLE ${ident(N)}.${ident(fk.table)} WITH CHECK ADD CONSTRAINT ${ident('fixture_'+hash(fk.table+'/'+fk.name).slice(0,20))} FOREIGN KEY(${cs.map(c=>ident(c.parentColumn)).join(',')}) REFERENCES ${ident(N)}.${ident(fk.refTable)}(${cs.map(c=>ident(c.refColumn)).join(',')})`);}
  return {fixtureOnly:true,actualT1:false,commercialWrites:0,addedTables:names,rowsCopied:0,metadataHash:hash({metadata,checks,indexes,fks:fks.filter(f=>names.includes(f.table))}),status:'EMPTY_NATIVE_DEPENDENCIES_CLONED'};
 });
}
export async function normalizeExistingGoal8FixtureGuardNames(driver,{fixtureReceipt}={}){
 check(fixtureReceipt?.fixtureOnly===true&&fixtureReceipt.actualT1===false&&fixtureReceipt.nativeSchema===N&&fixtureReceipt.journalSchema===J,'GOAL8_FIXTURE_RECEIPT');
 return driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const identity=(await q(tx,'SELECT @@SERVERNAME server,DB_NAME() [database]'))[0];check(identity?.server===TARGET.server&&identity.database===TARGET.database,'GOAL8_FIXTURE_TEST_IDENTITY');
  const recovery=await q(tx,`SELECT checkpoint_json FROM ${ident(J)}.fixture_recovery_checkpoint WHERE checkpoint_hash=@h AND kind=N'SYNTHETIC_NAMESPACE_RECOVERY'`,{h:fixtureReceipt.fixtureRecoveryCheckpointHash});check(recovery.length===1&&hash(JSON.parse(recovery[0].checkpoint_json))===fixtureReceipt.fixtureRecoveryCheckpointHash,'GOAL8_FIXTURE_NAMESPACE_RECOVERY_DRIFT');
  const original=await q(tx,FINAL_GUARD_SQL),cloned=await q(tx,map(FINAL_GUARD_SQL));check(hash(original)===fixtureReceipt.sourceGuardHash&&cloned.length===original.length,'GOAL8_FIXTURE_SOURCE_GUARD_DRIFT');
  const updates=[];for(const g of original){
   const name=fixtureGuardName(g.name),matches=cloned.filter(c=>c.table===g.table&&(c.name===g.name||c.name===name));check(matches.length===1,'GOAL8_FIXTURE_GUARD_IDENTITY');const c=matches[0],definition=fixtureGuardDefinition(g);
   check(!c.disabled&&c.definition===map(g.definition)||!c.disabled&&c.definition===definition,'GOAL8_FIXTURE_FOREIGN_GUARD_BODY');
   check(['first_i','first_u','first_d','last_i','last_u','last_d'].every(k=>c[k]===g[k]),'GOAL8_FIXTURE_FOREIGN_GUARD_ORDER');
   if(c.name===name&&c.definition===definition)continue;
   await q(tx,`DROP TRIGGER ${ident(N)}.${ident(c.name)}`);await q(tx,definition);
   for(const [op,k] of [['INSERT','i'],['UPDATE','u'],['DELETE','d']]){const order=g['first_'+k]?'First':g['last_'+k]?'Last':null;if(order)await q(tx,`EXEC sys.sp_settriggerorder @triggername=${lit(N+'.'+name)},@order=${lit(order)},@stmttype=${lit(op)}`);}
   updates.push({sourceName:g.name,fixtureName:name,fixtureBodyHash:hash(definition)});
  }
  check(hash(await q(tx,FINAL_GUARD_SQL))===fixtureReceipt.sourceGuardHash,'GOAL8_FIXTURE_ORIGINAL_GUARD_CHANGED');
  const after=await q(tx,map(FINAL_GUARD_SQL));check(after.length===original.length&&original.every(g=>{const c=after.find(c=>c.name===fixtureGuardName(g.name)&&c.table===g.table);return c&&!c.disabled&&c.definition===fixtureGuardDefinition(g)&&['first_i','first_u','first_d','last_i','last_u','last_d'].every(k=>c[k]===g[k]);}),'GOAL8_FIXTURE_NORMALIZED_GUARD_DRIFT');
  return {fixtureOnly:true,actualT1:false,commercialWrites:0,normalizedGuards:updates,originalGuardHash:fixtureReceipt.sourceGuardHash,fixtureGuardHash:hash(after),quarantineReadyEvidence:'ORIGINAL_ACCEPTED_READONLY',holdLookup:'SYNTHETIC_NAMESPACE'};
 });
}
export async function rehearseGoal8CutoverFixture(driver,{fixtureReceipt,pricePublication}={}){
 check(fixtureReceipt?.fixtureOnly===true&&fixtureReceipt.nativeSchema===N&&fixtureReceipt.journalSchema===J,'GOAL8_FIXTURE_RECEIPT');
 // This MUST be a real native fixture-catalog publisher/readback supplied by the
 // runner. A Boolean success callback is not a normal catalog acceptance proof.
 check(pricePublication?.fixtureOnly===true&&typeof pricePublication.publish==='function'&&typeof pricePublication.verify==='function','GOAL8_FIXTURE_PRICE_PUBLICATION');
 let lostApplyResponse=true,lostInverseResponse=true;
 const faultDriver={...driver,pricePublication,transaction:async(options,fn)=>{let childCommitted=false;const result=await driver.transaction(options,tx=>fn({...tx,query:async(sql,params,meta)=>{const rows=await tx.query(sql,params,meta);if(meta?.operation==='child-create')childCommitted=true;return rows;}}));if(childCommitted&&result?.domain==='price'&&!result.inverse&&lostApplyResponse){lostApplyResponse=false;throw Error('GOAL8_FIXTURE_LOST_COMMIT_RESPONSE');}if(childCommitted&&result?.domain==='account'&&result.inverse&&lostInverseResponse){lostInverseResponse=false;throw Error('GOAL8_FIXTURE_LOST_INVERSE_RESPONSE');}return result;}};
 const fd=createFinalSqlFixtureDriver(faultDriver,{nativeSchema:N,journalSchema:J}),store=createFinalSqlStore(fd),h='a'.repeat(64),cutoverId='33333333-3333-4333-8333-333333333333';
 const common={identityVerified:true,held:false,acceptedBaselineHash:h,sourceSemanticsVerified:true};
 const rows=await fd.transaction({isolation:'SERIALIZABLE'},async tx=>({schema:await q(tx,FINAL_SCHEMA_SQL),guards:await q(tx,FINAL_GUARD_SQL),accounts:await q(tx,"SELECT CONVERT(varchar(20),a.id) id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT a.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) witness FROM dbo.party_currency_accounts a WHERE a.id BETWEEN 10 AND 15"),stock:await q(tx,"SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) witness FROM dbo.products p WHERE p.id=20"),prices:await q(tx,"SELECT CONVERT(varchar(20),p.id) id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) witness FROM dbo.product_prices p WHERE p.id IN(30,31)")}));
 const accounts=['customer','supplier'].flatMap(role=>['TRY','USD','EUR'].map((currency,n)=>{const id=String((role==='customer'?10:13)+n),supplier=role==='supplier',prior=supplier&&currency==='USD';return {...common,nativeId:id,nativeWitnessHash:rows.accounts.find(r=>r.id===id).witness,sourceKey:`VEGA2026/${supplier?'F0103':'F0102'}/TBLCARI/100`,role,currency,openingVerified:true,reportProofHash:h,sourceT0:supplier?'-100.00000000':'100.00000000',acceptedSourceLatest:prior?'-80.00000000':supplier?'-100.00000000':'100.00000000',sourceT1:supplier?'-90.00000000':'90.00000000',t0Direction:supplier?'A':'B',t1Direction:supplier?'A':'B',nativeOpening:'100.00000000',localEffects:'5.00000000',nativeBefore:prior?'85.00000000':'105.00000000',nativeLedger:prior?'85.00000000':'105.00000000',acceptedReceipts:prior?[{runId:'GOAL73-44444444-4444-4444-8444-444444444444',manifestHash:'b'.repeat(64),committed:true,delta:'-20.00000000'}]:[]};})); // Anonymous synthetic source IDs; gitleaks:allow
 const stocks=[{...common,nativeId:'20',nativeWitnessHash:rows.stock[0].witness,sourceKey:'VEGA2026/F0102/TBLSTOKLAR/200',unitVerified:true,sourceT0:'20.00000000',acceptedSourceLatest:'16.00000000',sourceT1:'15.00000000',nativeOpening:'20.00000000',localEffects:'-3.00000000',nativeBefore:'13.00000000',nativeLedger:'13.00000000',acceptedReceipts:[{runId:'GOAL7-44444444-4444-4444-8444-444444444444',manifestHash:'b'.repeat(64),committed:true,delta:'-4.00000000'}]}]; // Anonymous synthetic source ID; gitleaks:allow
 const prices=[{...common,nativeId:'20',nativeWitnessHash:rows.prices.find(r=>r.id==='30').witness,sourceKey:stocks[0].sourceKey,currency:'USD',priceType:'sale',unitSourceId:'1',tier:1,localOverride:false,sourceT0:'9.00000000',acceptedSourceLatest:'9.00000000',nativeBefore:'9.00000000',sourceT1:'10.00000000'},{...common,nativeId:'20',nativeWitnessHash:rows.prices.find(r=>r.id==='31').witness,sourceKey:stocks[0].sourceKey,currency:'EUR',priceType:'purchase',unitSourceId:null,tier:0,localOverride:false,sourceT0:null,acceptedSourceLatest:null,nativeBefore:null,sourceT1:'0.00000000'}];
 const priorReceiptProof=await fd.transaction({isolation:'SERIALIZABLE'},async tx=>{const proof=[];for(const row of [...accounts.map(r=>({...r,kind:'account'})),...stocks.map(r=>({...r,kind:'stock'}))])proof.push(...await readAcceptedFinalReceipts((sql,params)=>q(tx,sql,params),row));return proof;});check(priorReceiptProof.length===2,'GOAL8_FIXTURE_PRIOR_RECEIPTS');
 const durable=await fd.transaction({isolation:'SERIALIZABLE'},async tx=>{if(!(await q(tx,"SELECT OBJECT_ID(N'erp_migration.final_cutover_parents') id"))[0]?.id)return null;return(await q(tx,'SELECT plan_json,collector_json FROM erp_migration.final_cutover_parents WHERE cutover_id=@id',{id:cutoverId}))[0]??null;});
 const input={target:TARGET,cutoverId,acceptedBaselineHash:h,freeze:{allVegaWritersStopped:true,offlineQueuesDrained:true,writerInventoryHash:h,evidenceHash:h,stoppedAt:'2026-10-09T16:00:00Z',melisaWritesPaused:true,nativePauseProofHash:h},capture:{sourceServer:'DESKTOP-KSRK0EQ',database:'VEGA2026',period:'D0007',startedAt:'2026-10-09T16:01:00Z',finishedAt:'2026-10-09T16:02:00Z',commonScopeHash:h,beforeHash:h,afterHash:h,allDomainsIncluded:true,businessDate:'2026-10-09',reportDateTo:'2026-10-09'},accounts,stocks,prices,excluded:[]};input.capture.rowsHash=captureRowsHash(input);const plan=durable?JSON.parse(durable.plan_json):buildFinalCutoverPlan(input),body={planHash:plan.planHash,rowsHash:plan.capture.rowsHash,evidenceKind:'SYNTHETIC_OFFLINE',actualT1:false},collector=durable?JSON.parse(durable.collector_json):{...body,collectorHash:hash(body)};
 const approve=action=>({action,cutoverId,planHash:plan.planHash,collectorHash:collector.collectorHash,target:TARGET,actorId:'13',recovery:{evidenceKind:'SYNTHETIC_NAMESPACE_RECOVERY',checkpointHash:fixtureReceipt.fixtureRecoveryCheckpointHash},schemaHash:hash(rows.schema),guardHash:hash(rows.guards),exclusionsHash:hash(plan.excluded),fixtureSchemas:{nativeSchema:N,journalSchema:J},priceReaderHash:pricePublication.contractHash});
 const initialRecovery=durable?await store.parent(plan):null;check(!initialRecovery?.inverseStarted,'GOAL8_FIXTURE_REHEARSAL_ALREADY_INVERSE');const initialMode=initialRecovery&&(initialRecovery.status.startsWith('STOPPED')||initialRecovery.status.startsWith('APPLYING_'))?'RESUME':'APPLY';
 let lostResponse=false;try{await runFinalCutoverFixture({plan,collector,store,mode:initialMode,approval:approve(initialMode)});}catch(e){expectedFixtureFailure(e,'GOAL8_FIXTURE_LOST_COMMIT_RESPONSE','GOAL8_FIXTURE_UNEXPECTED_APPLY_FAILURE');lostResponse=true;}
 check(lostResponse,'GOAL8_FIXTURE_COMMIT_LOSS_NOT_EXERCISED');const stopped=await store.parent(plan);check(stopped.status==='STOPPED','GOAL8_FIXTURE_PARENT_NOT_STOPPED');
 const apply=await runFinalCutoverFixture({plan,collector,store,mode:'RESUME',approval:approve('RESUME')}),replay=await runFinalCutoverFixture({plan,collector,store,mode:'APPLY',approval:approve('APPLY')});check(replay.newEffects===0,'GOAL8_FIXTURE_REPLAY_EFFECT');
 const accountReceipt=await store.child(plan,'account',false),priceReceipt=await store.child(plan,'price',false),negatives=[];
 // Every negative runs in its own transaction and must throw. The runner's
 // transaction contract rolls back the deliberately introduced fixture drift.
 for(const scenario of ['scalar-drift','active-null-ledger','hold','price-cas']){
  let result=null,nullLedgerNotNullable=false;
  const negativeDriver={...driver,pricePublication,transaction:(options,fn)=>driver.transaction(options,async tx=>{
   const metadata=await fixtureMetadata(tx);
   if(scenario==='active-null-ledger')nullLedgerNotNullable=metadata.find(c=>c.table==='customer_movements'&&c.name==='balance_effect')?.is_nullable===false;
   await fixtureMutation(tx,async()=>{
    if(scenario==='scalar-drift')await q(tx,`UPDATE ${ident(N)}.customers SET balance=balance+1 WHERE id=40`);
    if(scenario==='active-null-ledger')await insert(tx,'customer_movements',metadata,{id:'999',customer_id:'40',party_entity_id:'40',party_currency_account_id:'10',movement_type:'sales_invoice',currency_code:'TRY',account_currency:'TRY',amount:'1.0000',balance_effect:null,balance_effect_exact:null,affects_balance:true,source_record_key:null,migration_run_id:null,document_date:'2026-10-09'});
    if(scenario==='hold')await q(tx,`INSERT ${ident(J)}.operation_quarantine_holds(entity,source_key,source_id,source_company,source_code,native_id,native_source_key,status,reasons_json,binding_basis,row_hash)VALUES(N'customer',N'VEGA2026/F0102/TBLCARI/100',N'100',N'F0102',N'SYN-FINAL',40,N'SYN-FINAL',N'HELD',N'["SYNTHETIC_HOLD"]',N'SYNTHETIC_NATIVE_SQL',@h)`,{h:'c'.repeat(64)});
    if(scenario==='price-cas')await q(tx,`UPDATE ${ident(N)}.product_prices SET price=11 WHERE id=30`);
   });
   if(scenario==='price-cas'){
    const row=plan.rows.find(r=>r.kind==='price'&&r.currency==='USD'),state=(await q(tx,map(finalNativeReadSql(row)),{nativeId:row.nativeId,sourceKey:row.sourceKey,sourceId:'200',currency:row.currency,priceType:row.priceType,tier:row.tier,unitSourceId:row.unitSourceId}))[0];
    finalMutations(plan,row,state,approve('INVERSE'),{inverse:true,applied:priceReceipt.effects.find(e=>e.key===row.key)});
   }else await fn(tx);
   throw Error('GOAL8_FIXTURE_NEGATIVE_WAS_ACCEPTED');
  })};
  try{await createFinalSqlStore(createFinalSqlFixtureDriver(negativeDriver,{nativeSchema:N,journalSchema:J})).verifyDomain(plan,'account',accountReceipt,{inverse:false});}catch(e){result=e.message;}
  const expected={'scalar-drift':'FINAL_NATIVE_SCALAR_DRIFT','active-null-ledger':'FINAL_LEDGER_UNKNOWN',hold:'FINAL_NATIVE_IDENTITY_HOLD','price-cas':'FINAL_PRICE_INVERSE_CAS'}[scenario];
  check(scenario==='active-null-ledger'&&nullLedgerNotNullable?/cannot insert (?:the value )?null/i.test(result??''):result===expected,'GOAL8_FIXTURE_NEGATIVE_FAILURE_'+scenario);negatives.push({scenario,rejection:scenario==='active-null-ledger'&&nullLedgerNotNullable?'NATIVE_NOT_NULL_CONSTRAINT':result,rolledBack:true});
 }
 await driver.transaction({isolation:'SERIALIZABLE'},laterFixtureLocal);
 const laterLocalReplay=await runFinalCutoverFixture({plan,collector,store,mode:'APPLY',approval:approve('APPLY')});check(laterLocalReplay.newEffects===0,'GOAL8_FIXTURE_LATER_LOCAL_REPLAY');
 let lostInverse=false;try{await runFinalCutoverFixture({plan,collector,store,mode:'INVERSE',approval:approve('INVERSE')});}catch(e){expectedFixtureFailure(e,'GOAL8_FIXTURE_LOST_INVERSE_RESPONSE','GOAL8_FIXTURE_UNEXPECTED_INVERSE_FAILURE');lostInverse=true;}check(lostInverse,'GOAL8_FIXTURE_INVERSE_LOSS_NOT_EXERCISED');
 let forwardBlocked=false;try{await runFinalCutoverFixture({plan,collector,store,mode:'RESUME',approval:approve('RESUME')});}catch(e){check(e.message==='FINAL_INVERSE_RECOVERY_REQUIRED','GOAL8_FIXTURE_UNEXPECTED_FORWARD_FAILURE');forwardBlocked=true;}check(forwardBlocked,'GOAL8_FIXTURE_FORWARD_NOT_BLOCKED');
 const inverse=await runFinalCutoverFixture({plan,collector,store,mode:'INVERSE',approval:approve('INVERSE')}),inverseReplay=await runFinalCutoverFixture({plan,collector,store,mode:'INVERSE',approval:approve('INVERSE')});check(inverseReplay.newEffects===0,'GOAL8_FIXTURE_INVERSE_REPLAY');
 const restored=await driver.transaction({isolation:'SERIALIZABLE'},async tx=>({accounts:await q(tx,`SELECT id,CONVERT(varchar(100),current_balance) value FROM ${ident(N)}.party_currency_accounts WHERE id BETWEEN 10 AND 15 ORDER BY id`),stock:await q(tx,`SELECT CONVERT(varchar(100),current_stock_qty) value FROM ${ident(N)}.products WHERE id=20`)}));check(restored.accounts.every(r=>r.value===(String(r.id)==='14'?'87.00000000':'107.00000000'))&&restored.stock[0]?.value==='15.000','GOAL8_FIXTURE_LATER_LOCAL_INVERSE');
 return {status:'SYNTHETIC_NATIVE_SQL_REHEARSED',fixtureOnly:true,actualT1:false,commercialWrites:0,planHash:plan.planHash,initialRecovery,lostResponse,forwardBlocked,priorReceiptProof,negatives,laterLocalReplay,localAfterInverse:restored,apply,replay,inverse,inverseReplay,normalRuntimeCatalog:'NOT_PROVED_BY_FIXTURE',preservedSchemas:[N,J]};
}
export async function createGoal8FixturePricePublication(driver){
 const contractHash=hash({evidenceKind:'SYNTHETIC_NATIVE_SQL',nativeSchema:N,journalSchema:J,reader:'usp_fixture_final_catalog',scope:'typed prices on one anonymous synthetic product',normalErpAcceptance:false});
 const tableSQL=`CREATE TABLE ${ident(J)}.fixture_price_publications(sequence_id bigint IDENTITY PRIMARY KEY,child_id nvarchar(100) NOT NULL,plan_hash char(64) NOT NULL,publication_hash char(64) NOT NULL,price_id bigint NOT NULL,product_id bigint NOT NULL,price_type nvarchar(20) NOT NULL,price_tier int NOT NULL,currency_code nvarchar(3) NOT NULL,source_unit_id int NULL,price_exact decimal(28,8) NULL,native_row_hash char(64) NOT NULL,UNIQUE(child_id,price_id));`;
 const triggerSQL=`CREATE TRIGGER ${ident(J)}.immutable_fixture_price_publications ON ${ident(J)}.fixture_price_publications AFTER INSERT,UPDATE,DELETE AS BEGIN IF EXISTS(SELECT 1 FROM deleted) OR OBJECT_ID(N'tempdb..#final_plan') IS NULL OR EXISTS(SELECT 1 FROM inserted i WHERE i.plan_hash<>CONVERT(char(64),SESSION_CONTEXT(N'final_cutover_plan'))) THROW 51808,'FIXTURE_PRICE_PUBLICATION_IMMUTABLE',1;END`;
 const readerSQL=`CREATE PROCEDURE ${ident(N)}.usp_fixture_final_catalog AS BEGIN SET NOCOUNT ON;
 SELECT CONVERT(varchar(20),p.id) id,p.price_type priceType,p.price_tier tier,p.currency_code currency,CONVERT(varchar(20),p.source_unit_id) unitSourceId,CONVERT(varchar(100),p.price) value,v.child_id childId,v.publication_hash publicationHash,CONVERT(bit,CASE WHEN v.native_row_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) AND NOT EXISTS(SELECT p.price,p.price_type,p.price_tier,p.currency_code,p.source_unit_id EXCEPT SELECT v.price_exact,v.price_type,v.price_tier,v.currency_code,v.source_unit_id) THEN 1 ELSE 0 END) verified FROM ${ident(N)}.product_prices p CROSS APPLY(SELECT TOP(1) * FROM ${ident(J)}.fixture_price_publications v WHERE v.price_id=p.id ORDER BY sequence_id DESC)v WHERE p.product_id=20 ORDER BY p.id;END`;
 await driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const identity=(await q(tx,'SELECT @@SERVERNAME server,DB_NAME() [database]'))[0];check(identity?.server===TARGET.server&&identity.database===TARGET.database,'GOAL8_FIXTURE_TEST_IDENTITY');
  check((await q(tx,`SELECT SCHEMA_ID(${lit(J)}) id`))[0]?.id,'GOAL8_FIXTURE_PREPARE_FIRST');
  const namespace=(await q(tx,`SELECT OBJECT_ID(${lit(J+'.fixture_recovery_checkpoint')}) id,OBJECT_ID(${lit(N+'.products')}) productId`))[0];check(namespace?.id&&namespace.productId,'GOAL8_FIXTURE_OWN_NAMESPACE_REQUIRED');
  const recovery=await q(tx,`SELECT checkpoint_hash,checkpoint_json FROM ${ident(J)}.fixture_recovery_checkpoint WHERE kind=N'SYNTHETIC_NAMESPACE_RECOVERY'`);check(recovery.length===1&&hash(JSON.parse(recovery[0].checkpoint_json))===recovery[0].checkpoint_hash,'GOAL8_FIXTURE_NAMESPACE_RECOVERY_DRIFT');
  const existing=(await q(tx,`SELECT OBJECT_ID(${lit(J+'.fixture_price_publications')}) tableId,OBJECT_DEFINITION(OBJECT_ID(${lit(J+'.immutable_fixture_price_publications')})) triggerDefinition,OBJECT_DEFINITION(OBJECT_ID(${lit(N+'.usp_fixture_final_catalog')})) readerDefinition,(SELECT is_disabled FROM sys.triggers WHERE object_id=OBJECT_ID(${lit(J+'.immutable_fixture_price_publications')})) disabled`))[0];
  if(existing?.tableId){
   check(existing.triggerDefinition===triggerSQL&&existing.readerDefinition===readerSQL&&existing.disabled===false,'GOAL8_FIXTURE_PRICE_REOPEN_DEFINITION_DRIFT');
   const columns=await q(tx,`SELECT name,TYPE_NAME(user_type_id) type,max_length,precision,scale,is_nullable,is_identity,is_computed FROM sys.columns WHERE object_id=OBJECT_ID(${lit(J+'.fixture_price_publications')}) ORDER BY column_id`);
   const expected=[['sequence_id','bigint',false],['child_id','nvarchar',false,200],['plan_hash','char',false,64],['publication_hash','char',false,64],['price_id','bigint',false],['product_id','bigint',false],['price_type','nvarchar',false,40],['price_tier','int',false],['currency_code','nvarchar',false,6],['source_unit_id','int',true],['price_exact','decimal',true],['native_row_hash','char',false,64]];
   check(columns.length===expected.length&&columns.every((c,i)=>{const [name,type,nullable,length]=expected[i];return c.name===name&&c.type===type&&c.is_nullable===nullable&&c.is_identity===(i===0)&&!c.is_computed&&(length===undefined||c.max_length===length)&&(type!=='decimal'||c.precision===28&&c.scale===8);}),'GOAL8_FIXTURE_PRICE_REOPEN_SCHEMA_DRIFT');
   const indexes=await q(tx,`SELECT i.is_primary_key primaryKey,i.is_unique [unique],(SELECT c.name FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0 ORDER BY ic.key_ordinal FOR JSON PATH) columnsJSON FROM sys.indexes i WHERE i.object_id=OBJECT_ID(${lit(J+'.fixture_price_publications')}) AND i.index_id>0 ORDER BY i.index_id`);
   check(indexes.length===2&&indexes[0].primaryKey===true&&indexes[0].unique===true&&indexes[1].primaryKey===false&&indexes[1].unique===true&&hash(indexes.map(i=>JSON.parse(i.columnsJSON).map(c=>c.name)))===hash([['sequence_id'],['child_id','price_id']]),'GOAL8_FIXTURE_PRICE_REOPEN_INDEX_DRIFT');
  }else{check(!existing?.triggerDefinition&&!existing?.readerDefinition,'GOAL8_FIXTURE_PRICE_FOREIGN_OBJECT');await q(tx,tableSQL);await q(tx,triggerSQL);await q(tx,readerSQL);}
 });
 return {fixtureOnly:true,contractHash,publish:async({query,plan,receipt,inverse})=>{
  const publicationHash=hash({planHash:plan.planHash,childId:receipt.id,effectsHash:hash(receipt.effects),inverse,kind:'SYNTHETIC_NATIVE_SQL'});
  for(const e of receipt.effects.filter(e=>e.operation!=='NOOP')){
   const row=plan.rows.find(r=>r.key===e.key),id=String(JSON.parse(e.beforeJSON).id);
   await query('fixture-price-publish','INSERT erp_migration.fixture_price_publications(child_id,plan_hash,publication_hash,price_id,product_id,price_type,price_tier,currency_code,source_unit_id,price_exact,native_row_hash)VALUES(@child,@plan,@publication,@id,@product,@type,@tier,@currency,@unit,CONVERT(decimal(28,8),@value),@witness)',{child:receipt.id,plan:plan.planHash,publication:publicationHash,id,product:row.nativeId,type:row.priceType,tier:row.tier,currency:row.currency,unit:row.unitSourceId,value:e.afterValue,witness:e.afterWitnessHash});
  }
  return {publicationHash,versionContext:{evidenceKind:'SYNTHETIC_NATIVE_SQL',actualT1:false,reader:N+'.usp_fixture_final_catalog',scopeProducts:1,scopePrices:receipt.effects.length},normalErpAcceptance:false};
 },verify:async({query,receipt})=>{
  const rows=await query('fixture-catalog-readback','EXEC dbo.usp_fixture_final_catalog');
  return receipt.effects.filter(e=>e.operation!=='NOOP').every(e=>{const id=String(JSON.parse(e.beforeJSON).id),r=rows.find(r=>r.id===id);return r?.verified===true&&r.childId===receipt.id&&r.publicationHash===receipt.publication.publicationHash&&(r.value===null?null:r.value.padEnd(r.value.indexOf('.')+9,'0'))===e.afterValue;});
 }};
}
// A separate read-only engine proof can run after the durable rehearsal has
// finished. It executes the real owner procedure in the anonymous namespace;
// it does not activate a service context or claim normal ERP card acceptance.
export async function verifyGoal8FixturePartyReader(driver,{fixtureReceipt}={}){
 check(fixtureReceipt?.fixtureOnly===true&&fixtureReceipt.nativeSchema===N&&fixtureReceipt.journalSchema===J,'GOAL8_FIXTURE_RECEIPT');
 return driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const identity=(await q(tx,'SELECT @@SERVERNAME server,DB_NAME() [database]'))[0];check(identity?.server===TARGET.server&&identity.database===TARGET.database,'GOAL8_FIXTURE_TEST_IDENTITY');
  const recovery=await q(tx,`SELECT checkpoint_json FROM ${ident(J)}.fixture_recovery_checkpoint WHERE checkpoint_hash=@hash AND kind=N'SYNTHETIC_NAMESPACE_RECOVERY'`,{hash:fixtureReceipt.fixtureRecoveryCheckpointHash});check(recovery.length===1&&hash(JSON.parse(recovery[0].checkpoint_json))===fixtureReceipt.fixtureRecoveryCheckpointHash,'GOAL8_FIXTURE_RECOVERY_DRIFT');
  const parent=(await q(tx,`SELECT CONVERT(varchar(36),p.cutover_id) cutoverId,p.plan_hash planHash,p.party_hash partyHash,p.plan_json planJSON,(SELECT TOP(1) e.state FROM ${ident(J)}.final_cutover_events e WHERE e.cutover_id=p.cutover_id ORDER BY e.id DESC) state FROM ${ident(J)}.final_cutover_parents p WHERE p.cutover_id=@id`,{id:'33333333-3333-4333-8333-333333333333'}))[0];check(parent?.state==='INVERSED','GOAL8_FIXTURE_PARTY_PARENT_STATE');
  const plan=JSON.parse(parent.planJSON),accounts=plan.rows.filter(r=>r.kind==='account');check(parent.planHash===plan.planHash&&parent.partyHash===hash(accounts)&&accounts.length===6,'GOAL8_FIXTURE_PARTY_PLAN');
  const definition=(await q(tx,`SELECT OBJECT_DEFINITION(OBJECT_ID(${lit(N+'.usp_read_final_currency_deltas')})) definition`))[0]?.definition;check(definition===map(FINAL_PARTY_READ_PROC_SQL),'GOAL8_FIXTURE_PARTY_READER_DRIFT');
  const result=await q(tx,`EXEC ${ident(N)}.usp_read_final_currency_deltas @account_ids=@ids,@cutover_id=@cutover,@plan_hash=@plan,@party_hash=@party,@inverse=@inverse`,{ids:JSON.stringify(accounts.map(r=>r.nativeId)),cutover:parent.cutoverId,plan:parent.planHash,party:parent.partyHash,inverse:true});
  check(result.length===1&&result[0].readerDefinitionHash===sqlHash(definition),'GOAL8_FIXTURE_PARTY_DEFINITION_PROOF');
  const proof=JSON.parse(result[0].rowsJson);check(proof.length===6&&new Set(proof.map(r=>r.accountId)).size===6&&accounts.every(a=>proof.some(r=>r.accountId===a.nativeId&&r.verified===true&&r.sourceDeltaExact==='0.00000000')),'GOAL8_FIXTURE_PARTY_INVERSE_PROOF');
  return {status:'SYNTHETIC_NATIVE_PARTY_READER_VERIFIED',fixtureOnly:true,actualT1:false,commercialWrites:0,planHash:parent.planHash,partyBindingsHash:parent.partyHash,readerDefinitionHash:result[0].readerDefinitionHash,accounts:accounts.map(a=>({accountId:a.nativeId,role:a.role,currency:a.currency,inverseNetDeltaExact:'0.00000000'})),normalRuntimeCardAcceptance:'NOT_PROVED_BY_FIXTURE'};
 });
}
