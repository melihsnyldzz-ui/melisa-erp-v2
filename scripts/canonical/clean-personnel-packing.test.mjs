import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCleanPersonnelWorkDefinitions,buildCleanPersonnelWorkSql} from './clean-personnel-work-sql.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');

test('packing is an explicit compiler choice and never an implicit change to accepted defaults',()=>{
 const old=buildCleanPersonnelWorkDefinitions(),next=buildCleanPersonnelWorkDefinitions({packingTask:true});
 assert.equal(hash(JSON.stringify(old)),'e2cdb2f4df59590e9c55d2de4c2c4b834d1564e166aef08c3bd6d3b718f4225b');
 assert.equal(hash(buildCleanPersonnelWorkSql()),'47358f1cfccf9bb482bf7600c993d2c567cf1f1df1dde0d06c9b4f9b6835bfb5');
 assert.notEqual(hash(next.definitions.usp_clean_personnel_guard),hash(old.definitions.usp_clean_personnel_guard));
 assert.equal(old.definitions.usp_clean_personnel_guard.includes('can_terminal_packing'),false);
 for(const name of ['usp_clean_direct_sale_bind','usp_clean_store_day_bind','usp_clean_store_inventory_bind','usp_clean_finance_b4_bind'])assert.equal(next.definitions[name],old.definitions[name],name);
 assert.throws(()=>buildCleanPersonnelWorkDefinitions({packingTask:'true'}));
 assert.throws(()=>buildCleanPersonnelWorkSql({packingTask:true,inboundOwnerLinks:true}));
});
test('normal management accepts only a real boolean personal task and preserves an omitted task on update',()=>{
 const d=buildCleanPersonnelWorkDefinitions({packingTask:true}).definitions;
 assert.match(d.usp_clean_personnel_bind,/N'canTerminalPacking'/);
 assert.match(d.usp_clean_personnel_bind,/\[key\]=N'canTerminalPacking' AND type<>3/);
 assert.ok(d.usp_clean_personnel_bind.includes("<>(10+CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key]=N'canTerminalPacking') THEN 1 ELSE 0 END)"));
 assert.match(d.usp_clean_personnel_bind,/r\.id=30 AND r\.code=N'clean_test_personnel'/);
 assert.match(d.usp_clean_personnel_bind,/r\.id=31 AND r\.code=N'clean_test_personnel_manager'/);
 assert.match(d.usp_clean_personnel_guard,/WHEN N'canTerminalPacking' THEN N'can_terminal_packing'/);
 assert.match(d.usp_clean_personnel_guard,/N'can_terminal_packing',N'can_change_sale_price'/);
 assert.match(d.usp_clean_personnel_guard,/JSON_VALUE\(@payload,'\$\.canTerminalPacking'\) IS NULL/);
});
test('same native active membership proof returns the personal task, without any name or account allowlist grant',()=>{
 const d=buildCleanPersonnelWorkDefinitions({packingTask:true}).definitions;
 assert.match(d.usp_clean_personnel_work_actor,/p\.can_terminal_packing canTerminalPacking/);
 assert.match(d.usp_clean_personnel_work_actor,/WITH\(HOLDLOCK\)/);
 assert.match(d.usp_clean_personnel_work_actor,/pe\.is_active=1 AND pu\.is_active=1 AND pr\.is_active=1/);
 assert.doesNotMatch(Object.values(d).join('\n'),/Mehmet|Turgay|Angela|10021/);
});
test('fresh work layer variant defaults task off and refuses an already-sealed current layer before DDL',()=>{
 const s=buildCleanPersonnelWorkSql({packingTask:true});
 assert.match(s,/PACKING_FRESH_WORK_LAYER_REQUIRED/);
 assert.ok(s.indexOf('PACKING_FRESH_WORK_LAYER_REQUIRED')<s.indexOf('ADD can_terminal_packing'));
 assert.match(s,/ADD can_terminal_packing bit NOT NULL CONSTRAINT DF_clean_employee_packing DEFAULT\(0\) WITH VALUES/);
 assert.match(s,/CLEAN_PACKING_SCHEMA_CONFLICT/);
 assert.match(s,/BEGIN TRANSACTION;BEGIN TRY/);
 assert.match(s,/IF @@TRANCOUNT>0 ROLLBACK;THROW/);
 assert.doesNotMatch(s,/UPDATE dbo\.(?:users|employees|permissions)|DISABLE TRIGGER|NOCHECK CONSTRAINT/);
 assert.match(buildCleanPersonnelWorkSql({packingTask:true,probe:true}),/ROLLBACK;SELECT N'B5_PERSONAL_WORK_METADATA_PROBE_ROLLED_BACK'/);
});
