import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCanonicalBusinessSaleEffects,compileCanonicalBusinessSaleEffects,CANONICAL_SALE_EFFECTS_CONTRACT} from './canonical-business-sale-effects-sql.mjs';
import {canonicalBusinessSaleModuleHash,CANONICAL_SALE_PREFIX_BEGIN,CANONICAL_SALE_PREFIX_END} from './canonical-business-sale-admission-sql.mjs';

const oldTriggers={sales_invoices:'test_guard_sales_invoices',sales_invoice_items:'test_guard_sales_invoice_items',products:'test_guard_products',stock_movements:'test_guard_stock_movements',customers:'test_guard_customers',customer_movements:'test_guard_customer_movements',audit_logs:'test_guard_audit_logs',work_sales_links:'work_night_guard_work_sales_links',work_trade_requests:'work_night_guard_work_trade_requests'};
test('ISSUED header branches select exactly one operation before incompatible row-count checks',()=>{
 const out=prepareCanonicalBusinessSaleEffects({...fixture(),profileHash:'A'.repeat(64)}),sql=out.guardDefinition;
 const heads=[...sql.matchAll(/IF @table=N'sales_invoices' AND @phase IN\(N'ISSUED'\)([^\n]*) BEGIN/g)].map(x=>x[1]);
 assert.deepEqual(heads,[" AND @operation=N'sale_draft'"," AND @operation=N'sale_cancel'"]);
 for(const operation of ['sale_draft','sale_cancel','sale_finalize','unknown']){
  const eligible=heads.filter(head=>head===` AND @operation=N'${operation}'`);
  assert.equal(eligible.length,['sale_draft','sale_cancel'].includes(operation)?1:0);
 }
 assert.match(sql,/IF @next IS NULL/);
 // The trigger-count hypothesis was not proved; leave authority unchanged.
 assert.match(sql,/OR @@TRANCOUNT<>1 OR XACT_STATE\(\)<>1/);
 assert.match(sql,/IF @ic<>1 OR @dc<>0/);assert.match(sql,/IF @ic<>1 OR @dc<>1/);
});
function fixture(){
 const before={identityJson:{databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',serverName:'Semih\\MELISADEV'},columnsJson:[],modulesJson:[]},addon={columnsJson:[],modulesJson:[]};
 for(const table of [...CANONICAL_SALE_EFFECTS_CONTRACT.tables,...CANONICAL_SALE_EFFECTS_CONTRACT.frozenTables]){
  const key=table==='work_sales_links'?'invoice_id':table==='work_trade_requests'?'request_id':'id';
  const column={schemaName:'dbo',tableName:table,columnName:key,typeName:key==='request_id'?'uniqueidentifier':'bigint',max_length:key==='request_id'?16:8,precision:19,scale:0,is_nullable:false,is_identity:key==='id',is_computed:false};
  (table==='audit_logs'?addon:before).columnsJson.push(column);
  if(table==='products')before.columnsJson.push({...column,columnName:'source_record_key',typeName:'nvarchar',max_length:800,precision:0,is_nullable:true,is_identity:false});
  if(table==='customer_movements')for(const name of ['party_entity_id','party_currency_account_id','balance_effect_exact','affects_balance'])before.columnsJson.push({...column,columnName:name,typeName:name==='affects_balance'?'bit':name==='balance_effect_exact'?'decimal':'bigint',max_length:name==='affects_balance'?1:8,precision:name==='balance_effect_exact'?28:19,scale:name==='balance_effect_exact'?8:0,is_nullable:true,is_identity:false,defaultDefinition:null});
  if(table==='stock_movements')before.columnsJson.push({...column,columnName:'affects_inventory',typeName:'bit',max_length:1,precision:1,is_identity:false,defaultDefinition:'((1))'});
  if(table==='audit_logs')addon.columnsJson.push({...column,columnName:'created_at',typeName:'datetime2',max_length:6,precision:19,scale:0,is_identity:false,defaultDefinition:'(sysutcdatetime())'});
  if(oldTriggers[table]){const name=oldTriggers[table],definition=`CREATE TRIGGER dbo.${name} ON dbo.${table} AFTER INSERT,UPDATE,DELETE AS BEGIN\n/* Original actor15/16 bytes must remain literal. */\nIF EXISTS(SELECT 1 FROM inserted WHERE 1=0) THROW 51001,'OLD_NATIVE_GUARD',1;\nEND;`;before.modulesJson.push({schemaName:'dbo',name,type:'TR',definition,definitionHash:canonicalBusinessSaleModuleHash(definition)});}
 }
 return {before,addon,profileHash:'A'.repeat(64)};
}
test('offline output is deterministic, non-installable and contains no SQL executor or legacy-manifest writer',()=>{
 const f=fixture(),before=JSON.stringify(f),a=prepareCanonicalBusinessSaleEffects(f),b=prepareCanonicalBusinessSaleEffects(f);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(f),before);assert.equal(a.installable,false);assert.equal(a.executeAllowed,false);assert.equal(a.nativeCompiled,false);assert.equal(a.fullAcceptance,false);assert.equal(a.sourceEvidence,'UNVERIFIED_SOURCE_INPUT');assert.equal(a.legacyManifestWrites,0);assert.equal(a.businessWrites,0);
 const all=a.guardDefinition+a.effectsDefinition+a.newPcaGuardDefinition;assert.doesNotMatch(all,/\b(?:GRANT|DENY|REVOKE|RESTORE|BACKUP|DISABLE\s+TRIGGER)\b/i);assert.doesNotMatch(all,/(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?dbo\.(?:work_trade_guard_manifest|goal8_day_manifest|test_purchase_batch_guard_manifest|test_purchase_fx_guard_manifest)\b/i);
});
test('all nine legacy successors preserve the complete original body and use only the named guard delegation',()=>{
 const f=fixture(),out=prepareCanonicalBusinessSaleEffects(f);assert.equal(out.successors.length,9);
 for(const s of out.successors){const old=f.before.modulesJson.find(m=>m.name===s.name).definition;assert(s.prefix.startsWith(CANONICAL_SALE_PREFIX_BEGIN+'\n'));assert(s.prefix.endsWith('\n'+CANONICAL_SALE_PREFIX_END));assert.equal(s.definition.replace('\n'+s.prefix+'\n',''),old);assert.equal(out.beforeHashes[s.name],canonicalBusinessSaleModuleHash(old));assert.deepEqual(Object.keys(s).sort(),['approvedPrefixHash','definition','name','prefix']);assert.match(s.prefix,/SELECT i\.\* FROM inserted i FOR JSON PATH,INCLUDE_NULL_VALUES/);assert.match(s.prefix,/SELECT d\.\* FROM deleted d FOR JSON PATH,INCLUDE_NULL_VALUES/);assert.match(s.prefix,/EXEC dbo\.usp_canonical_business_sale_guard_v1 @trigger_id=@canonical_b6_trigger_id/);assert.match(s.prefix,/transaction_id=CURRENT_TRANSACTION_ID\(\)/);}
 assert.match(out.newPcaGuardDefinition,/ON dbo\.party_currency_accounts WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE/);assert.equal(out.newPcaGuardHash,canonicalBusinessSaleModuleHash(out.newPcaGuardDefinition));
});
test('guard authenticates actual trigger nesting, parent/schema, enabled state, current hash and full column closure',()=>{
 const sql=prepareCanonicalBusinessSaleEffects(fixture()).guardDefinition;
 assert.match(sql,/TRIGGER_NESTLEVEL\(@trigger_id,N'AFTER',N'DML'\)<>1 OR TRIGGER_NESTLEVEL\(\)<>1/);assert.match(sql,/JOIN sys\.triggers/);assert.match(sql,/parent_id=OBJECT_ID\(N'dbo\.'/);assert.match(sql,/schema_id=SCHEMA_ID\(N'dbo'\)/);assert.match(sql,/is_disabled=0 AND t\.is_instead_of_trigger=0/);assert.match(sql,/canonical_business_sale_original_definitions_v1/);assert.match(sql,/r\.after_hash=CONVERT\(varchar\(64\),HASHBYTES/);assert.match(sql,/pca_guard_hash/);assert.match(sql,/B6_ROW_SCHEMA_DRIFT/);assert.match(sql,/CURRENT_TRANSACTION_ID\(\)/);assert.match(sql,/EXEC dbo\.usp_canonical_business_sale_ready_v1 @actor_id=17/);
});
test('event envelope rejects malformed, duplicate, missing-column, null-key and unapproved phase events',()=>{
 const sql=prepareCanonicalBusinessSaleEffects(fixture()).guardDefinition;
 for(const code of ['B6_EVENT_JSON','B6_EVENT_ROWS','B6_EVENT_PHASE','B6_EVENT_TRANSFORM','B6_PHASE_CAS'])assert(sql.includes(code));
 assert.match(sql,/COUNT\(DISTINCT row_key\)/);assert.match(sql,/COUNT\(DISTINCT \[key\]\)/);assert.match(sql,/row_key IS NULL/);assert.match(sql,/CASE WHEN \(/);assert.match(sql,/THEN 1 ELSE 0 END<>1/);assert.match(sql,/OPENJSON\(i\.row_json\)j WHERE j\.\[key\]=N'after_json'/);assert.doesNotMatch(sql,/JSON_VALUE\(i\.row_json,N'\$\."after_json"'\)/);
});
test('native ordered phases include early draft snapshot, bulk finalize, serial cancellation and conditional empty main-card event',()=>{
 const sql=prepareCanonicalBusinessSaleEffects(fixture()).guardDefinition;
 for(const phase of ['DRAFT_OPEN','DRAFT_ITEMS','DRAFT_AUDIT','FINAL_PROFIT','FINAL_STOCK','FINAL_MOVES','PROFIT_AUDIT','CANCEL_STOCK','CANCEL_NEXT','MOVEMENT','STAMPED','CARD','STATUS','MOVEMENT_LINK','HEADER_LINK','ACCOUNT','POST_AUDIT','AUDITED','LINKED','JOURNALED'])assert(sql.includes("N'"+phase+"'"));
 assert.match(sql,/\$\.headerUpdates/);assert.match(sql,/\$\.cursor/);assert.match(sql,/@operation=N'sale_cancel'/);assert.match(sql,/CASE WHEN JSON_VALUE\(@before,'\$\.rows\.customers\[0\]\.currency_code'\)=@currency THEN 1 ELSE 0 END/);assert.match(sql,/SET @next=N'KEEP'/);
});
test('row updates preserve every unapproved field and retain account8/source4/quantity3 arithmetic',()=>{
 const out=prepareCanonicalBusinessSaleEffects(fixture()),sql=out.guardDefinition;
 assert.match(sql,/SELECT \[key\],\[value\] COLLATE Latin1_General_100_BIN2,\[type\] FROM OPENJSON\(i\.row_json\)/);assert.match(sql,/EXCEPT SELECT \[key\],\[value\]/);assert.match(sql,/decimal\(28,8\)/);assert.match(sql,/decimal\(18,3\)/);assert.match(sql,/decimal\(18,4\)/);assert.match(sql,/gross_profit_try/);assert.match(sql,/balance_effect_exact/);assert.match(sql,/party_currency_account_id/);assert.match(sql,/source_record_key|__never_column__/);assert.doesNotMatch(sql,/SESSION_CONTEXT|sp_set_session_context/);
});
test('final effects compare all table counts, all outside rows and frozen finance/FX state',()=>{
 const sql=prepareCanonicalBusinessSaleEffects(fixture()).effectsDefinition;
 for(const table of CANONICAL_SALE_EFFECTS_CONTRACT.tables){assert(sql.includes('B6_EFFECT_COUNT_'+table.toUpperCase()));assert(sql.includes('B6_EFFECT_OUTSIDE_'+table.toUpperCase()));assert(sql.includes('$.outside.'+table+'.hash'));}
 for(const table of CANONICAL_SALE_EFFECTS_CONTRACT.frozenTables)assert(sql.includes('B6_EFFECT_FROZEN_'+table.toUpperCase()));
 assert.match(sql,/FOR JSON PATH,INCLUDE_NULL_VALUES/);assert.match(sql,/N'EFFECTS_VERIFIED'/);assert.match(sql,/B6_EFFECT_ACCOUNT_LINK/);assert.match(sql,/B6_EFFECT_BALANCE/);assert.match(sql,/@requestedOperation IS NULL/);assert.match(sql,/@request_id IS NULL/);assert.match(sql,/@actor_id IS NULL/);
 assert.equal((sql.match(/DECLARE[^;]*@operation nvarchar/g)||[]).length,0,'the operation parameter must not be redeclared');
});
test('two silent effect stages preserve native callback, existing journal INSERT and DONE factory ordering',()=>{
 const {guardDefinition:guard,effectsDefinition:effects}=prepareCanonicalBusinessSaleEffects(fixture());
 assert(guard.includes("@table=N'work_trade_requests' AND @phase IN(N'EFFECTS_VERIFIED')"));assert(guard.includes("SET @next=N'JOURNALED'"));assert(guard.includes("@table=N'work_trade_requests' EXEC dbo.usp_canonical_business_sale_effects_v1"));
 assert(effects.includes("@phase NOT IN(N'LINKED',N'AUDITED',N'JOURNALED')"));assert(effects.includes("@journaled int=CASE WHEN @phase=N'JOURNALED' THEN 1 ELSE 0 END"));assert(effects.includes("THEN N'DONE' ELSE N'EFFECTS_VERIFIED'"));assert(!effects.includes('SELECT @proof native_proof_json'));
 assert.equal(CANONICAL_SALE_EFFECTS_CONTRACT.finalPhase,'DONE');assert(CANONICAL_SALE_EFFECTS_CONTRACT.phases.every(p=>p.length<=20));assert(guard.includes("phase<>N'DONE'"));assert(!guard.includes('SET proof_json='));assert(guard.includes('phase_json=@phaseJSON,invoice_id=@invoice'));
});
test('clock, long JSON, fixed server description and native audit evidence are explicit guard requirements',()=>{
 const sql=prepareCanonicalBusinessSaleEffects(fixture()).guardDefinition;
 for(const text of ['$.capturedAtUtc','BETWEEN CONVERT(datetime2(0),@captured) AND CONVERT(datetime2(0),SYSUTCDATETIME())',"N'Satış işlemi'",'$.averageCostTry','$.beforeBalance','$.afterBalance','$.sourceWitnessHash'])assert(sql.includes(text),text);
 assert(sql.includes("$.selection.customerAccountId"));assert(sql.includes("$.unit.sourceId"));assert(sql.includes("$.canonicalBusinessSaleProfileHash"));assert(sql.includes("N'CANONICAL_TEST_BUSINESS_SALE'"));assert(sql.includes("N'B6-CANONICAL-BUSINESS-SALE-V1'"));assert(sql.includes('B6_STOCK_DUPLICATE'));assert(sql.includes('nativeCreationProofJSON nvarchar(max)'));assert(sql.includes('CONVERT(varbinary(max),@proof)'));assert(sql.includes('$.invoice.customerBalanceExact8'));assert(!sql.includes('$.invoice.customerBalanceExact4'));
});
test('draft cancellation is header/audit/journal only and finalized cancellation requires the original native effects',()=>{
 const {guardDefinition:guard,effectsDefinition:effects}=prepareCanonicalBusinessSaleEffects(fixture());
 assert(guard.includes("@table=N'sales_invoices' AND @phase IN(N'ISSUED')"));assert(guard.includes("SET @next=N'DRAFT_CANCELLED'"));assert(guard.includes("N'work_sales_draft_cancelled'"));assert(guard.includes('@operation=N\'sale_cancel\' AND @draftCancel=0'));
 assert(guard.includes('B6_GUARD_DRAFT_CANCEL_BEFORE'));assert(guard.includes('B6_GUARD_ORIGINAL_EFFECT_REQUIRED'));assert(effects.includes('@mutates*@productCount'));assert(effects.includes('CONVERT(decimal(28,8),@mutates*@direction*@total)'));assert(effects.includes("@operation=N'sale_draft' OR @draftCancel=1 THEN 1"));assert(CANONICAL_SALE_EFFECTS_CONTRACT.phases.includes('DRAFT_CANCELLED'));
});
test('metadata drift, mismatched duplicated columns, target/schema changes and original definition tamper fail closed',()=>{
 const edits=[f=>{f.profileHash='bad';},f=>{f.before.identityJson.databaseName='OTHER';},f=>{f.before.columnsJson[0].schemaName='other';},f=>{f.before.modulesJson[0].definition+='\n-- drift';},f=>{f.addon.columnsJson.push({...f.before.columnsJson[0],scale:7});},f=>{f.before.columnsJson=f.before.columnsJson.filter(x=>x.tableName!=='party_currency_accounts');}];
 for(const edit of edits){const f=fixture();edit(f);assert.throws(()=>prepareCanonicalBusinessSaleEffects(f));}
 const f=fixture();f.addon.columnsJson.push({...f.before.columnsJson[0]});assert.doesNotThrow(()=>prepareCanonicalBusinessSaleEffects(f));
});
test('initial movement NULL defaults and native stock default are frozen, including SQL default-constraint metadata',()=>{
 const f=fixture(),out=prepareCanonicalBusinessSaleEffects(f);assert(out.guardDefinition.includes('LEFT JOIN sys.default_constraints'));assert(out.guardDefinition.includes('expected.default_definition COLLATE Latin1_General_100_BIN2'));
 for(const change of [f=>{f.before.columnsJson.find(c=>c.tableName==='customer_movements'&&c.columnName==='affects_balance').defaultDefinition='((0))';},f=>{f.before.columnsJson.find(c=>c.tableName==='customer_movements'&&c.columnName==='party_entity_id').is_nullable=false;},f=>{f.before.columnsJson.find(c=>c.tableName==='stock_movements'&&c.columnName==='affects_inventory').defaultDefinition='((0))';}]){const x=fixture();change(x);assert.throws(()=>prepareCanonicalBusinessSaleEffects(x));}
});
test('raw frozen byte pins cannot be substituted with synthetic metadata or alternate encoding',()=>{
 const f=fixture();for(const args of [{},{beforeMetadataJSON:JSON.stringify(f.before),addonMetadataJSON:JSON.stringify(f.addon),profileHash:f.profileHash}])assert.throws(()=>compileCanonicalBusinessSaleEffects(args),{code:'B6_EFFECTS_FROZEN_BEFORE'});
});


test('row metadata names and OPENJSON keys use the same explicit binary collation without weakening the exact envelope',()=>{
 const sql=prepareCanonicalBusinessSaleEffects(fixture()).guardDefinition;
 const envelope=sql.slice(sql.indexOf('IF EXISTS(SELECT 1 FROM @i WHERE row_key IS NULL)'),sql.indexOf("THROW 51917,'B6_EVENT_ROWS',1;")+"THROW 51917,'B6_EVENT_ROWS',1;".length);
 assert.match(envelope,/OPENJSON\(r\.row_json\)j WHERE NOT EXISTS\(SELECT 1 FROM sys\.columns c WHERE c\.object_id=OBJECT_ID\(N'dbo\.'\+@table\) AND c\.name COLLATE Latin1_General_100_BIN2=j\.\[key\] COLLATE Latin1_General_100_BIN2\)/);
 assert.doesNotMatch(sql,/(?:\bname|\.name)\s*=\s*j\.\[key\]|j\.\[key\]\s*=\s*(?:\bname|\w+\.name)/);
 assert.doesNotMatch(envelope,/DATABASE_DEFAULT|Turkish_CI_AS|LOWER\(|UPPER\(/i);
 assert.match(envelope,/COUNT\(\*\) FROM OPENJSON\(r\.row_json\)\)<>\(SELECT COUNT\(\*\) FROM sys\.columns/);
 assert.match(envelope,/COUNT\(DISTINCT \[key\]\) FROM OPENJSON\(r\.row_json\)\)<>\(SELECT COUNT\(\*\)/);
 assert.match(envelope,/COUNT\(DISTINCT row_key\) FROM @i\)<>@ic/);assert.match(envelope,/row_key IS NULL/);
 assert.match(sql,/expected\.column_name COLLATE Latin1_General_100_BIN2,expected\.type_name COLLATE Latin1_General_100_BIN2/);
 assert.match(sql,/EXCEPT SELECT c\.name COLLATE Latin1_General_100_BIN2,t\.name COLLATE Latin1_General_100_BIN2/);
 assert.match(sql,/SELECT \[key\],\[value\] COLLATE Latin1_General_100_BIN2,\[type\] FROM OPENJSON/);
});

test('compiler keeps case-distinct column names and key lookups exact and rejects a case-substituted required native key',()=>{
 const f=fixture(),id=f.before.columnsJson.find(c=>c.tableName==='products'&&c.columnName==='id');
 for(const columnName of ['I','i'])f.before.columnsJson.push({...id,columnName,is_identity:false});
 const sql=prepareCanonicalBusinessSaleEffects(f).guardDefinition;
 assert(sql.includes("(N'products',N'I',N'bigint'"));assert(sql.includes("(N'products',N'i',N'bigint'"));
 assert(sql.includes("j.[key]=N'after_json'"));assert(!sql.includes("j.[key]=N'AFTER_JSON'"));
 assert(sql.includes('c.name COLLATE Latin1_General_100_BIN2=j.[key] COLLATE Latin1_General_100_BIN2'));
 const wrong=fixture();wrong.before.columnsJson.find(c=>c.tableName==='products'&&c.columnName==='id').columnName='ID';
 assert.throws(()=>prepareCanonicalBusinessSaleEffects(wrong),{code:'B6_EFFECTS_REQUIRED_TABLE'});
 const conflict=fixture();conflict.addon.columnsJson.push({...id,typeName:'nvarchar'});
 assert.throws(()=>prepareCanonicalBusinessSaleEffects(conflict),{code:'B6_EFFECTS_DUPLICATE_COLUMN'});
});
