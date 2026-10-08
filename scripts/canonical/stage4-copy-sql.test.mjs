import test from 'node:test';
import assert from 'node:assert/strict';
import {COPY_DB,COPY_LOGIN,SOURCE_DB,moduleHash,stage4CopySchema,stage4ReadySQL,stage4BeginSQL,stage4EffectsSQL,stage4GuardBranch,stage4NativeGuardSQL,stage4RequestGuardSQL,immutableCopyTrigger,stage4ReadProcedure,COPY_MUTABLE_TABLES} from './stage4-copy-sql.mjs';
import {ISOLATED_COPY_OPERATION_PERMISSIONS} from '../../apps/api/src/services/isolatedOperationCopyStore.mjs';

const module=(definition,name='legacy_guard_products',type_desc='SQL_TRIGGER')=>({schemaName:'dbo',name,type_desc,definition});
const guardedBody=`SET NOCOUNT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${SOURCE_DB}' THROW 51000,'OLD_WRONG_DATABASE',1;
IF EXISTS(SELECT 1 FROM inserted WHERE source_payload_hash IS NULL) THROW 51001,'OLD_PROVENANCE_REQUIRED',1;
IF EXISTS(SELECT 1 FROM deleted) THROW 51002,'OLD_DELETE_FORBIDDEN',1;
END;`;
const original=`CREATE TRIGGER dbo.legacy_guard_products ON dbo.products AFTER INSERT,UPDATE,DELETE AS BEGIN ${guardedBody}`;
const schema=(table,columns)=>columns.map(([columnName,typeName='nvarchar'])=>({schemaName:'dbo',tableName:table,columnName,typeName}));
const metadata=[
 ...schema('products',[['id','bigint'],['stock_code'],['unit'],['source_record_key'],['average_cost_try','decimal'],['purchase_price','decimal'],['current_stock_qty','decimal'],['updated_at','datetime2'],['updated_by','bigint'],['row_version','timestamp']]),
 ...schema('stock_movements',[['id','bigint'],['product_id','bigint'],['quantity_net','decimal'],['warehouse_name'],['source_record_key'],['migration_run_id'],['created_by','bigint'],['affects_inventory','bit']]),
 ...schema('customer_movements',[['id','bigint'],['customer_id','bigint'],['party_entity_id','bigint'],['party_currency_account_id','bigint'],['currency_code'],['balance_effect','decimal'],['balance_effect_exact','decimal'],['affects_balance','bit'],['source_record_key'],['migration_run_id'],['created_by','bigint']]),
 ...schema('work_trade_requests',[['id','uniqueidentifier'],['request_id','uniqueidentifier'],['payload_hash']]),
];
function tableCase(sql,table){const start=sql.indexOf(`IF @table_name=N'${table}' BEGIN`);assert.notEqual(start,-1);const end=sql.indexOf('RETURN;END;',start);return sql.slice(start,end);}
function immutableColumns(sql){const list=sql.match(/COALESCE\(x\.\[key\],y\.\[key\]\) IN\(([^)]*)\)/)?.[1];assert.ok(list);return [...list.matchAll(/N'([^']+)'/g)].map(m=>m[1]);}

test('every install/native entrypoint checks the exact copied DB and server before effects',()=>{
 for(const text of [stage4CopySchema(),stage4ReadySQL(),stage4BeginSQL(),stage4EffectsSQL(),stage4NativeGuardSQL(metadata),stage4RequestGuardSQL()]){
  const guard=text.indexOf("THROW 51904,'STAGE4_WRONG_COPY_TARGET'");assert.ok(guard>0);
  assert.match(text.slice(0,guard),new RegExp(`DB_NAME\\(\\) COLLATE Latin1_General_100_BIN2<>N'${COPY_DB}'`));
  assert.match(text.slice(0,guard),/SERVERPROPERTY\('ServerName'\).*Semih\\MELISADEV/);
  const mutation=text.search(/\b(?:INSERT|UPDATE|DELETE|CREATE TABLE)\s+dbo\./i);if(mutation>=0)assert.ok(guard<mutation);
 }
 assert.notEqual(COPY_DB,SOURCE_DB);assert.ok(!COPY_MUTABLE_TABLES.includes('product_prices'));assert.ok(!COPY_MUTABLE_TABLES.includes('users'));assert.ok(!COPY_MUTABLE_TABLES.includes('roles'));assert.ok(!COPY_MUTABLE_TABLES.includes('permissions'));
});

test('an additive native branch retains the old guard body byte-for-byte and binds full inserted/deleted rowsets',()=>{
 const out=stage4GuardBranch(module(original));assert.equal(out.beforeHash,moduleHash(original));assert.match(out.definition,/^ALTER TRIGGER\b/);assert.equal(out.afterHash,moduleHash(out.definition.replace(/^ALTER\b/i,'CREATE')));assert.notEqual(out.afterHash,moduleHash(out.definition));assert.equal(out.table,'products');
 assert.ok(out.definition.endsWith(guardedBody));assert.equal(out.definition.match(/OLD_PROVENANCE_REQUIRED/g).length,1);
 assert.match(out.definition,/SELECT \* FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES/);assert.match(out.definition,/SELECT \* FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES/);
 assert.match(out.definition,/EXEC dbo\.usp_stage4_copy_guard @table_name=N'products'/);assert.ok(out.definition.indexOf('STAGE4_COPY')<out.definition.indexOf('OLD_PROVENANCE_REQUIRED'));
});

test('unsafe schema/object input, absent table and unrecognised trigger bodies fail before SQL generation',()=>{
 for(const value of [{...module(original),schemaName:'other'},module(original,'bad; DROP TABLE products'),module(original,'x','SQL_STORED_PROCEDURE'),module('CREATE TRIGGER x AS BEGIN SELECT 1;END;'),module('CREATE TRIGGER dbo.x ON dbo.products AFTER INSERT AS SELECT 1;')])assert.throws(()=>stage4GuardBranch(value));
 assert.throws(()=>stage4NativeGuardSQL([]),/STAGE4_NATIVE_SCHEMA_REQUIRED/);assert.throws(()=>immutableCopyTrigger('dbo.x;DROP TABLE products','dbo.products'),/STAGE4_SQL_OBJECT/);assert.throws(()=>immutableCopyTrigger('dbo.x','other.products'),/STAGE4_SQL_OBJECT/);
});

test('quarantine expands only the exact copied same-transaction/login boundary and never returns before the original hold body',()=>{
 const holdBody="IF EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h JOIN inserted i ON i.id=h.native_id) THROW 51003,'HOLD_BLOCKED',1;END;";
 const definition=`CREATE TRIGGER dbo.quarantine_products ON dbo.products AFTER UPDATE AS BEGIN IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${SOURCE_DB}' THROW 51000,'OLD_WRONG_DATABASE',1;${holdBody}`;
 const out=stage4GuardBranch(module(definition,'quarantine_products'),{quarantine:true});assert.equal(out.kind,'QUARANTINE_FULL_BODY');assert.ok(out.definition.endsWith(holdBody));assert.doesNotMatch(out.definition,/\bRETURN\b/);
 assert.match(out.definition,/session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID\(\)/);assert.match(out.definition,new RegExp(`ORIGINAL_LOGIN\\(\\).*N'${COPY_LOGIN}'`));assert.match(out.definition,new RegExp(`DB_NAME\\(\\).*N'${COPY_DB}'`));
 assert.throws(()=>stage4GuardBranch(module(definition.replaceAll(SOURCE_DB,'UNRECOGNISED'),'quarantine_products'),{quarantine:true}),/STAGE4_QUARANTINE_IDENTITY_PATTERN/);
});

test('ready rejects wrong login, original/LIVE access, changed/disabled modules and held identities',()=>{
 const s=stage4ReadySQL();for(const code of ['STAGE4_WRITER_REQUIRED','STAGE4_DATABASE_BOUNDARY','STAGE4_MODULE_DRIFT','STAGE4_PRODUCT_SCOPE_DRIFT','STAGE4_PARTY_SCOPE_DRIFT'])assert.ok(s.includes(code));
 assert.match(s,/HAS_DBACCESS\(N'MELISA_ERP_SIRKET_TEST_20260929_01'\)/);assert.match(s,/HAS_DBACCESS\(N'MELISA_ERP_PROD_CANDIDATE_20260917_01'\)/);assert.match(s,/OBJECT_DEFINITION\(o.object_id\)/);assert.match(s,/ExecIsTriggerDisabled/);
 assert.match(s,/operation_quarantine_holds.*h\.entity=N'product'/);assert.match(s,/h\.native_entity_id=s\.partyId/);
});

test('begin requires a locked single transaction, complete JSON identity and exact active native permission witness',()=>{
 const s=stage4BeginSQL();assert.match(s,/APPLOCK_MODE.*Transaction.*Exclusive/);assert.match(s,/@@TRANCOUNT<>1/);
 for(const field of ['copyId','actorId','requestId','operation','operationOrigin','sealHash'])assert.ok(s.includes(`ISNULL(JSON_VALUE(@payload_json,'$.${field}'),'')`),field);
 for(const field of ['@copy_id','@request_id','@actor_id','@operation','@payload_hash','@payload_json'])assert.ok(s.includes(field+' IS NULL'),field);
 assert.match(s,/ISJSON\(@payload_json\)<>1/);assert.match(s,/HASHBYTES\('SHA2_256',@payload_json\)/);
 assert.match(s,/u\.is_active=1/);assert.match(s,/r\.is_active=1/);assert.match(s,/u\.role_id=s\.nativeRoleId/);assert.match(s,/r\.code=s\.nativeRoleCode/);assert.match(s,/HASHBYTES.*dbo\.permissions.*ORDER BY x\.id/);
 assert.ok(s.indexOf('STAGE4_OPERATION_FORBIDDEN')<s.indexOf('INSERT dbo.stage4_copy_intents'));
});

test('finite SQL permission vocabulary matches the backend including return/count decisions without granting an unknown operation',()=>{
 const s=stage4BeginSQL();for(const [operation,permission]of Object.entries(ISOLATED_COPY_OPERATION_PERMISSIONS))assert.ok(s.includes(`(N'${operation}',N'${permission}')`),operation);
 for(const op of ['purchase_return_draft','purchase_return_approve','purchase_return_reject','stock_count_reject','stock_count_cancel'])assert.ok(s.includes(`N'${op}'`));
 assert.match(s,/@permission IS NULL OR NOT EXISTS\(SELECT 1 FROM OPENJSON\(@actorPermissions\) WHERE value=@permission\)/);
 assert.ok(!Object.hasOwn(ISOLATED_COPY_OPERATION_PERMISSIONS,'migration_write'));assert.ok(!Object.hasOwn(ISOLATED_COPY_OPERATION_PERMISSIONS,'role_edit'));
});

test('native history protection rejects missing numeric/UUID baselines, old rows, deletions and source imports',()=>{
 const s=stage4NativeGuardSQL(metadata),stock=tableCase(s,'stock_movements'),uuid=tableCase(s,'work_trade_requests');
 assert.match(stock,/TRY_CONVERT\(bigint,JSON_VALUE\(@p,'\$\.baselineMaxIds\.stock_movements'\)\) IS NULL THROW/);assert.match(stock,/TRY_CONVERT\(bigint,JSON_VALUE\(i.value,'\$\.id'\)\) IS NULL OR/);
 assert.match(uuid,/JSON_QUERY\(@p,'\$\.baselineRowIds\.work_trade_requests'\) IS NULL THROW/);
 for(const code of ['STAGE4_OLD_HISTORY_PROTECTED','STAGE4_HISTORY_DELETE_FORBIDDEN','STAGE4_SOURCE_HISTORY_PROTECTED','STAGE4_ENTITY_OUTSIDE_SCOPE','STAGE4_ACTOR_SCOPE'])assert.ok(s.includes(code));
 assert.match(s,/session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID\(\)/);assert.match(s,/STAGE4_TABLE_OUTSIDE_OPERATION_SCOPE/);
});

test('master updates allow stock balance only while preserving source identity, units, prices and historical cost',()=>{
 const p=tableCase(stage4NativeGuardSQL(metadata),'products'),columns=immutableColumns(p);
 for(const field of ['id','stock_code','unit','source_record_key','average_cost_try','purchase_price'])assert.ok(columns.includes(field),field);
 for(const field of ['current_stock_qty','updated_at','updated_by','row_version'])assert.ok(!columns.includes(field),field);
 assert.match(p,/COUNT\(\*\) FROM OPENJSON\(@inserted\).*COUNT\(\*\) FROM OPENJSON\(@deleted\)/);assert.match(p,/STAGE4_MASTER_SCOPE/);assert.match(p,/x.type<>y.type/);assert.match(p,/Latin1_General_100_BIN2/);
});

test('a post-created party link may be completed without changing its amount, currency, creator or source identity',()=>{
 const c=tableCase(stage4NativeGuardSQL(metadata),'customer_movements'),columns=immutableColumns(c);
 for(const field of ['id','customer_id','currency_code','balance_effect','source_record_key','migration_run_id','created_by'])assert.ok(columns.includes(field),field);
 for(const field of ['party_entity_id','party_currency_account_id','balance_effect_exact','affects_balance'])assert.ok(!columns.includes(field),field);
 assert.match(c,/STAGE4_LEDGER_AMOUNT_IMMUTABLE/);assert.match(c,/STAGE4_OLD_HISTORY_PROTECTED/);
});

test('replay pins request identity and compares all four native effect tables against captured immutable full-row JSON',()=>{
 const s=stage4EffectsSQL(),replay=s.slice(s.indexOf('IF @replay=1 BEGIN'),s.indexOf('RETURN;END;')+11);
 assert.match(replay,/actor_id=@actor_id AND operation=@operation AND payload_hash=@payload_hash AND response_json=@response_json/);
 for(const table of ['stock_movements','customer_movements','supplier_movements','finance_account_movements'])assert.ok(replay.includes('JOIN dbo.'+table),table);
 assert.match(replay,/e.copy_id=@copy_id AND e.request_id=@request_id/);assert.match(replay,/STAGE4_REPLAY_NATIVE_DRIFT/);assert.match(replay,/HASHBYTES\('SHA2_256',e.effect_json\)/);assert.match(replay,/INCLUDE_NULL_VALUES/);
 assert.doesNotMatch(replay,/\b(?:INSERT|UPDATE|DELETE)\s+dbo\./i);
});

test('new account effect proof explicitly rejects NULL party/currency links before claiming a verified result',()=>{
 const s=stage4EffectsSQL();for(const field of ['party_currency_account_id','party_entity_id','currency_code','balance_effect_exact'])assert.ok(s.includes('m.'+field+' IS NULL'),field);
 for(const code of ['STAGE4_STOCK_EFFECT_MISMATCH','STAGE4_PARTY_EFFECT_MISMATCH','STAGE4_MAIN_CARD_BALANCE_MISMATCH','STAGE4_FINANCE_EFFECT_MISMATCH'])assert.ok(s.includes(code));
 assert.ok(s.indexOf('STAGE4_NATIVE_ACCOUNT_LINK_MISSING')<s.indexOf('INSERT dbo.stage4_copy_effect_components'));
});

test('request insertion needs a matching native proof/response in the same transaction and then consumes that intent',()=>{
 const s=stage4RequestGuardSQL();assert.match(s,/EXISTS\(SELECT 1 FROM deleted\) OR \(SELECT COUNT\(\*\) FROM inserted\)<>1/);
 for(const field of ['copy_id','request_id','actor_id','operation','payload_hash','payload_json','response_json'])assert.ok(s.includes('n.'+field+'=i.'+field),field);
 assert.match(s,/JSON_VALUE\(n.effect_proof_json,'\$\.valid'\)='true'/);assert.match(s,/n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID\(\)/);assert.match(s,/DELETE n FROM dbo.stage4_copy_intents/);
});

test('reader compilation is restricted to the four accepted r3 readers and retains all source verification statements',()=>{
 const name='usp_read_work_catalog_product_4161d6d9_0716_469e_8c67_c165a20fa674_r3',hash='B'.repeat(64),tail=`IF DB_NAME()<>N'${SOURCE_DB}' THROW 51000,'WRONG_SOURCE',1;DECLARE @guard varchar(64)='9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E';IF @guard IS NULL THROW 51001,'SOURCE_BINDING_REQUIRED',1;END;`,definition=`CREATE PROCEDURE dbo.${name} AS BEGIN ${tail}`,out=stage4ReadProcedure(module(definition,name,'SQL_STORED_PROCEDURE'),hash);
 assert.equal(out.beforeHash,moduleHash(definition));assert.match(out.definition,/^ALTER PROCEDURE\b/);assert.equal(out.afterHash,moduleHash(out.definition.replace(/^ALTER\b/i,'CREATE')));assert.notEqual(out.afterHash,moduleHash(out.definition));assert.ok(out.definition.endsWith(tail.replaceAll(SOURCE_DB,COPY_DB).replace('9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E',hash)));
 assert.match(out.definition,/EXEC dbo\.usp_stage4_copy_ready @stage4_reader_copy/);
 for(const bad of [module(definition,'usp_any_reader','SQL_STORED_PROCEDURE'),module(definition.replaceAll(SOURCE_DB,'OTHER'),name,'SQL_STORED_PROCEDURE'),{...module(definition,name,'SQL_STORED_PROCEDURE'),schemaName:'other'}])assert.throws(()=>stage4ReadProcedure(bad,hash),/STAGE4_READ_PROCEDURE_SCOPE/);
 assert.throws(()=>stage4ReadProcedure(module(definition,name,'SQL_STORED_PROCEDURE'),hash.toLowerCase()),/STAGE4_READ_PROCEDURE_SCOPE/);
});

test('legacy guard receipts map only the same named module and exact old witness, with an unchanged fallback',()=>{
 const name='usp_read_work_catalog_product_4161d6d9_0716_469e_8c67_c165a20fa674_r3',oldHash='A'.repeat(64),newHash='C'.repeat(64);
 for(const column of ['after_hash','definition_hash']){
  const oldComparison=`m.${column}<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+m.name))),2)`;
  const body=`IF DB_NAME()<>N'${SOURCE_DB}' THROW 51000,'WRONG_SOURCE',1;IF (SELECT COUNT(*) FROM dbo.legacy_manifest)<>15 THROW 51001,'LEGACY_COUNT',1;IF EXISTS(SELECT 1 FROM dbo.legacy_manifest m WHERE ${oldComparison}) THROW 51002,'LEGACY_GUARD_DRIFT',1;IF NOT EXISTS(SELECT 1 FROM dbo.source_receipt WHERE run_id=@run_id AND source_hash=@source_hash) THROW 51003,'LEGACY_SOURCE_REQUIRED',1;END;`;
  const definition=`CREATE PROCEDURE dbo.${name} @run_id nvarchar(80),@source_hash char(64) AS BEGIN ${body}`;
  const out=stage4ReadProcedure(module(definition,name,'SQL_STORED_PROCEDURE'),'B'.repeat(64));
  const expected=`COALESCE((SELECT p.after_hash FROM dbo.stage4_copy_module_manifest p WHERE p.name=N'dbo.'+m.name AND p.before_hash=m.${column}),m.${column})`;
  assert.equal(out.definition.split(expected).length-1,1);
  assert.ok(out.definition.endsWith(body.replaceAll(SOURCE_DB,COPY_DB).replace(`m.${column}<>`,expected+'<>')));
  assert.equal(out.beforeHash,moduleHash(definition));assert.equal(out.afterHash,moduleHash(out.definition.replace(/^ALTER\b/i,'CREATE')));
  // Evaluate the emitted scalar lookup's finite equality contract. A same
  // hash on a different module, stale/null witness, and missing map must all
  // leave the original receipt authoritative, rather than accept any copy pin.
  const predicate=out.definition.match(/SELECT p\.after_hash FROM dbo\.stage4_copy_module_manifest p WHERE ([^)]*)\),m\.(?:after_hash|definition_hash)\)/)?.[1];
  assert.equal(predicate,`p.name=N'dbo.'+m.name AND p.before_hash=m.${column}`);
  const effective=pins=>pins.find(p=>p.name==='dbo.legacy_guard'&&p.before_hash===oldHash)?.after_hash??oldHash;
  assert.equal(effective([{name:'dbo.legacy_guard',before_hash:oldHash,after_hash:newHash}]),newHash);
  for(const pins of [[],[{name:'dbo.other_guard',before_hash:oldHash,after_hash:newHash}],[{name:'dbo.legacy_guard',before_hash:'D'.repeat(64),after_hash:newHash}],[{name:'dbo.legacy_guard',before_hash:null,after_hash:newHash}]])assert.equal(effective(pins),oldHash);
 }
});

test('literal guard replacements require explicit valid hashes and do not rewrite unrelated source evidence',()=>{
 const name='usp_read_stock_products_product_4161d6d9_0716_469e_8c67_c165a20fa674_r3',beforeHash='A'.repeat(64),afterHash='C'.repeat(64),unrelated='D'.repeat(64);
 const definition=`CREATE PROCEDURE dbo.${name} AS BEGIN IF DB_NAME()<>N'${SOURCE_DB}' THROW 51000,'WRONG_SOURCE',1;IF OBJECT_DEFINITION(OBJECT_ID(N'dbo.legacy_guard')) IS NULL THROW 51001,'GUARD_REQUIRED',1;DECLARE @guard char(64)='${beforeHash}',@source char(64)='${unrelated}';END;`;
 const guard={name:'dbo.legacy_guard',beforeHash,afterHash},out=stage4ReadProcedure(module(definition,name,'SQL_STORED_PROCEDURE'),'B'.repeat(64),[guard]);
 assert.ok(out.definition.includes(`@guard char(64)='${afterHash}'`));assert.ok(out.definition.includes(`@source char(64)='${unrelated}'`));assert.ok(out.definition.includes("OBJECT_ID(N'dbo.legacy_guard')"));
 assert.ok(stage4ReadProcedure(module(definition,name,'SQL_STORED_PROCEDURE'),'B'.repeat(64),[]).definition.includes(`@guard char(64)='${beforeHash}'`));
 for(const changed of [{...guard,name:'dbo.guard; DROP TABLE products'},{...guard,name:'other.legacy_guard'},{...guard,beforeHash:null},{...guard,afterHash:'not-a-hash'},{...guard,afterHash:afterHash.toLowerCase()}])assert.throws(()=>stage4ReadProcedure(module(definition,name,'SQL_STORED_PROCEDURE'),'B'.repeat(64),[changed]),/STAGE4_READER_GUARD_MAPPING/);
});

// Interpret only the emitted aggregate WHERE's supported scalar predicates,
// not the writer or SQL server. Unsupported SQL deliberately fails this test.
function effectAggregatePredicate(sql,table){
 const start=sql.indexOf(`FROM dbo.${table} m WHERE `),end=sql.indexOf(')m WHERE',start);assert.ok(start>=0&&end>start);
 const terms=sql.slice(start+`FROM dbo.${table} m WHERE `.length,end).split(/\s+AND\s+/);
 return (row,entityId,lastId)=>terms.every(term=>{
  let match=term.match(/^m\.(\w+)=b\.id$/);if(match)return row[match[1]]===entityId;
  match=term.match(/^m\.(\w+)=1$/);if(match)return row[match[1]]===1;
  if(/^m\.id>TRY_CONVERT\(bigint,JSON_VALUE\(@before,'\$\.max(?:Stock|Finance)Id'\)\)$/.test(term))return row.id>lastId;
  assert.fail('Unsupported aggregate predicate: '+term);
 });
}

test('non-affecting, null-flag, historical and foreign stock/cash rows contribute zero but remain replay evidence',()=>{
 const sql=stage4EffectsSQL(),stockPredicate=effectAggregatePredicate(sql,'stock_movements'),cashPredicate=effectAggregatePredicate(sql,'finance_account_movements');
 const stock=[{id:11,product_id:1,affects_inventory:1,exact8:200000000n},{id:12,product_id:1,affects_inventory:0,exact8:900000000n},{id:13,product_id:1,affects_inventory:null,exact8:-300000000n},{id:9,product_id:1,affects_inventory:1,exact8:700000000n},{id:14,product_id:2,affects_inventory:1,exact8:1100000000n}];
 assert.equal(stock.filter(r=>stockPredicate(r,1,10)).reduce((sum,r)=>sum+r.exact8,0n),200000000n);
 assert.equal(stock.slice(1).filter(r=>stockPredicate(r,1,10)).reduce((sum,r)=>sum+r.exact8,0n),0n);
 const cash=[{id:11,account_id:1,affects_balance:1,direction:'in',exact8:1234500000n},{id:12,account_id:1,affects_balance:1,direction:'out',exact8:5000000n},{id:13,account_id:1,affects_balance:0,direction:'in',exact8:9900000000n},{id:14,account_id:1,affects_balance:null,direction:'out',exact8:700000000n},{id:9,account_id:1,affects_balance:1,direction:'in',exact8:800000000n},{id:15,account_id:2,affects_balance:1,direction:'out',exact8:600000000n}];
 const contribution=rows=>rows.filter(r=>cashPredicate(r,1,10)).reduce((sum,r)=>sum+(r.direction==='in'?r.exact8:-r.exact8),0n);
 assert.equal(contribution(cash),1229500000n);assert.equal(contribution(cash.slice(2)),0n);
 assert.match(sql,/SUM\(CASE WHEN m.direction=N'in' THEN CONVERT\(decimal\(38,8\),m.amount\) WHEN m.direction=N'out' THEN -CONVERT\(decimal\(38,8\),m.amount\) END\)/);
 // Zero contribution is not deletion: capture/replay retain the whole row,
 // including its flag, so a later flag change still causes native drift.
 for(const table of ['stock_movements','finance_account_movements']){
  const capture=sql.match(new RegExp(`INSERT dbo\\.stage4_copy_effect_components[^\\n]*FROM dbo\\.${table} m WHERE[^\\n]*`))?.[0];assert.ok(capture);assert.match(capture,/SELECT m\.\* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES/);assert.doesNotMatch(capture,/m\.affects_(?:inventory|balance)=1/);
 }
});
