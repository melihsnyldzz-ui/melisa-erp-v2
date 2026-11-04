import test from'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import*as compiler from'./clean-personnel-work-sql.mjs';import{moduleHash}from'./stage4-copy-sql.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
test('accepted C1, username, owner-FK and default generators remain byte-identical',()=>{
 assert.equal(hash(JSON.stringify(compiler.buildCleanReadyExpressionRepairDefinitions())),'1b1dfe85e33fbafed5526c84735db17a3757b713216916a98e0dff38f9a89257');
 assert.equal(hash(JSON.stringify(compiler.buildCleanPersonnelUsernameRepairDefinitions())),'bfa5bf09410a173d1fadd34a349e1b38978ec0a531165fbe891f93dfbd1d656e');
 assert.equal(hash(compiler.buildCleanReadyExpressionRepairSql()),'92422d782892ea18fbc2bac4c05b94df04178f96386869e1a32a47091497feb8');
 assert.equal(hash(compiler.buildCleanReadyExpressionRepairSql({username:true})),'abdb51bb197b98d8e62821b8451cef03f16c6e8e1f6da13b65e22a2f7a78c713');
 assert.equal(hash(compiler.buildCleanPersonnelWorkSql({inboundOwnerLinks:true})),'6694d08dab3b9830cdeb43da9cfd349ec31998631b5bfae17e141cfbacb6146d');
});
test('in-place predecessors are current installed username/C1 bytes, never the fresh work layer',()=>{
 const p=compiler.buildCleanPersonnelPackingUpgradeDefinitions(),u=compiler.buildCleanPersonnelUsernameRepairDefinitions().definitions,w=compiler.buildCleanPersonnelWorkDefinitions().definitions;
 assert.equal(p.before.usp_clean_personnel_guard,u.usp_clean_personnel_guard);
 assert.equal(p.before.usp_clean_personnel_bind,w.usp_clean_personnel_bind);
 assert.equal(p.before.usp_clean_personnel_work_actor,w.usp_clean_personnel_work_actor);
 assert.equal(Object.keys(p.before).length,15);assert.equal(Object.keys(p.definitions).length,17);
 for(const n of Object.keys(p.before).filter(n=>n.endsWith('_ready')))assert.equal(p.before[n],u[n]);
 assert.match(p.definitions.usp_clean_personnel_guard,/N'%\[\^-a-zA-Z0-9\._\]%'/);
 assert.match(p.definitions.usp_clean_personnel_guard,/can_terminal_packing/);
 assert.match(p.definitions.usp_clean_personnel_bind,/\[key\]=N'canTerminalPacking' AND type<>3/);
 assert.match(p.definitions.usp_clean_personnel_work_actor,/p\.can_terminal_packing canTerminalPacking/);
 for(const n of ['clean_personnel_work_manifest_immutable','clean_ready_expression_immutable','clean_personnel_username_immutable'])assert.equal(p.definitions[n],undefined,'older immutable trigger is untouched');
});
test('actual readable hashes, module types, execution flags and trusted owner FKs gate predecessor projection',()=>{
 const p=compiler.buildCleanPersonnelPackingUpgradeDefinitions(),guard=p.definitions[p.guard];
 assert.match(guard,/m\.definition IS NULL/);assert.match(guard,/m\.uses_ansi_nulls<>1 OR m\.uses_quoted_identifier<>1/);
 assert.match(guard,/execute_as_principal_id/);assert.match(guard,/is_instead_of_trigger/);assert.match(guard,/is_disabled/);
 assert.match(guard,/is_not_trusted=0 AND f\.delete_referential_action=0 AND f\.update_referential_action=0/);
 assert.match(guard,/FK_clean_personnel_work_inbound_counts_creator/);assert.match(guard,/FK_clean_personnel_test_goods_batches_creator/);
 assert.match(guard,/DF_clean_employee_packing/);assert.match(guard,/c\.is_nullable=0/);
 for(const[n,b]of Object.entries(p.definitions).filter(([n])=>n.endsWith('_ready')&&n!==p.guard)){
  assert.ok(b.includes(moduleHash(guard)),n);assert.ok(b.includes(moduleHash(p.definitions[p.immutable])),n);
  assert.ok(b.indexOf('EXEC dbo.'+p.guard+';')<b.indexOf('DECLARE @packingPredecessors'),n);
  assert.match(b,/ISNULL\(JSON_VALUE\(@packingPredecessors/);
 }
});
test('wrong or unreadable precursor fails before one default-off column and before-image metadata are created',()=>{
 const p=compiler.buildCleanPersonnelPackingUpgradeDefinitions(),sql=compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:true});
 const ddl=sql.indexOf('ADD can_terminal_packing bit NOT NULL');assert.ok(ddl>0);
 for(const[n,b]of Object.entries(p.prior)){const pin=sql.indexOf(moduleHash(b));assert.ok(pin>=0&&pin<ddl,n+' exact precursor before DDL');}
 assert.ok(sql.indexOf('m.definition IS NOT NULL')<ddl);assert.ok(sql.indexOf('m.uses_ansi_nulls=1')<ddl);assert.ok(sql.indexOf('m.uses_quoted_identifier=1')<ddl);
 assert.match(sql,/CLEAN_PERSONNEL_PACKING_NOT_READY/);assert.match(sql,/DEFAULT\(0\) WITH VALUES/);
 assert.match(sql,/before_definition nvarchar\(max\)/);assert.match(sql,/before_execute_as_principal_id int/);
 assert.match(sql,/@packingEmployeesBefore/);assert.match(sql,/@packingPermissionsBefore/);assert.match(sql,/@packingOldSealsBefore/);
});
test('upgrade is atomic, exact-replay safe and never rebuilds roles, users, assignments or old seals',()=>{
 const sql=compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:true}),probe=compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:true,probe:true});
 const statements=sql.replace(/N?'(?:''|[^'])*'/g,"''");
 assert.match(sql,/SERIALIZABLE;BEGIN TRANSACTION;BEGIN TRY/);assert.match(sql,/@Resource=N'CLEAN_STORE_DAY_20261022'/);
 assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK;THROW/);assert.match(probe,/ROLLBACK;SELECT N'PERSONNEL_PACKING_UPGRADE_PROBE_ROLLED_BACK'/);
 assert.match(sql,/PERSONNEL_PACKING_UPGRADE_ALREADY_INSTALLED/);assert.match(sql,/DENY INSERT,UPDATE,DELETE ON dbo\.clean_personnel_packing_manifest/);
 assert.ok(sql.indexOf('EXISTS(SELECT 1 FROM dbo.clean_personnel_intents)')<sql.indexOf("IF OBJECT_ID(N'dbo.clean_personnel_packing_manifest')"),'no active writer before either replay or first upgrade');
 assert.doesNotMatch(statements,/\b(?:INSERT (?:INTO )?|UPDATE |DELETE FROM )(?:dbo\.)?(?:employees|users|roles|permissions|clean_personnel_members|products|stock_movements|sales_invoices)\b/i);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|NOCHECK CONSTRAINT|IDENTITY_INSERT|UPDATE dbo\.(?:clean_ready_expression_manifest|clean_personnel_work_manifest|clean_personnel_username_manifest)|SESSION_CONTEXT|CONTEXT_INFO|WAITFOR/);
 assert.equal((statements.match(/ADD can_terminal_packing bit/g)||[]).length,1);
});
test('unsafe selectors cannot combine fresh, username and installed-layer routes',()=>{
 assert.throws(()=>compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:'true'}));
 assert.throws(()=>compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:true,username:true}));
});
test('duplicate/missing metadata cannot hide a module and replay preserves later legitimate task assignments',()=>{
 const p=compiler.buildCleanPersonnelPackingUpgradeDefinitions(),guard=p.definitions[p.guard],sql=compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:true});
 assert.match(guard,/GROUP BY name HAVING COUNT\(\*\)<>1/);
 assert.match(sql,/@packingEmployeesBefore IS NULL OR @packingRolesBefore IS NULL OR @packingPermissionsBefore IS NULL OR @packingOldSealsBefore IS NULL/);
 const replay=sql.slice(sql.indexOf("IF OBJECT_ID(N'dbo.clean_personnel_packing_manifest')"),sql.indexOf('RETURN;END;')+'RETURN;END;'.length);
 assert.ok(replay.includes('PERSONNEL_PACKING_UPGRADE_ALREADY_INSTALLED'));
 assert.doesNotMatch(replay,/can_terminal_packing<>0|ADD can_terminal_packing|@packingEmployeesBefore|SET can_terminal_packing/);
 for(const n of Object.keys(p.before).filter(n=>n.endsWith('_ready'))){const body=p.definitions[n];
  for(const old of ['usp_clean_ready_expression_ready','usp_clean_personnel_username_ready'])if(p.before[n].includes(`OBJECT_ID(N'dbo.${old}')`))assert.ok(body.includes(`JSON_VALUE(@packingPredecessors,N'$.${old}')`),n+' literal precursor');
 }
});
test('EXECUTE AS OWNER also proves the actual object/schema owner and preserves it in the before image',()=>{
 const p=compiler.buildCleanPersonnelPackingUpgradeDefinitions(),sql=compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:true});
 assert.ok(p.definitions[p.guard].includes("ISNULL(COALESCE(o.principal_id,s.principal_id),-999)<>DATABASE_PRINCIPAL_ID(N'dbo')"));
 assert.ok(sql.includes("ISNULL(COALESCE(o.principal_id,s.principal_id),-999)=DATABASE_PRINCIPAL_ID(N'dbo')"));
 assert.match(sql,/before_owner_principal_id int NULL,before_schema_owner_principal_id int NULL/);
 assert.match(sql,/COALESCE\(before_owner_principal_id,before_schema_owner_principal_id\)/);
 assert.doesNotMatch(sql,/ALTER AUTHORIZATION|sp_changedbowner|CREATE USER|ALTER ROLE/);
});
test('new packing column check compiles only in a post-DDL dynamic batch in the same transaction',()=>{
 const sql=compiler.buildCleanReadyExpressionRepairSql({packingUpgrade:true}),outer=sql.replace(/N?'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(outer,/WHERE can_terminal_packing<>0/);
 const check="EXEC(N'IF EXISTS(SELECT 1 FROM dbo.employees WHERE can_terminal_packing<>0) THROW 51980,''CLEAN_PERSONNEL_PACKING_NOT_READY'',1;');";
 assert.ok(sql.includes(check));assert.ok(sql.indexOf(check)>sql.indexOf('ADD can_terminal_packing bit NOT NULL'));
 assert.match(sql,/@packingEmployeesBefore/);assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK;THROW/);
 assert.equal((outer.match(/BEGIN TRANSACTION/g)||[]).length,1);assert.doesNotMatch(outer,/^\s*GO\s*$/m);
 assert.equal(hash(JSON.stringify(compiler.buildCleanPersonnelPackingUpgradeDefinitions().definitions)),'7b43aeb8140ac8427789246600f3aba3a60dc771d7f3e9af5533aa8acde4c0d2');
});
