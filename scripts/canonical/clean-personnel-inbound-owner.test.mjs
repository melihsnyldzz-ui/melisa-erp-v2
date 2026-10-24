import test from'node:test';import assert from'node:assert/strict';
import{buildCleanPersonnelWorkSql,buildCleanPersonnelUsernameRepairDefinitions}from'./clean-personnel-work-sql.mjs';import{moduleHash}from'./stage4-copy-sql.mjs';

test('inbound owner repair replaces only two obsolete sample-only creator CHECKs with trusted user identity FKs',()=>{
 const sql=buildCleanPersonnelWorkSql({inboundOwnerLinks:true});
 for(const table of['work_inbound_counts','test_goods_batches']){
  assert.match(sql,new RegExp('ALTER TABLE dbo\\.'+table+' WITH CHECK ADD CONSTRAINT FK_clean_personnel_'+table+'_creator FOREIGN KEY\\(created_by\\) REFERENCES dbo\\.users\\(id\\)'));
 }
 assert.equal((sql.match(/WITH CHECK ADD CONSTRAINT FK_clean_personnel_/g)||[]).length,2);
 assert.doesNotMatch(sql,/EXEC\(N'ALTER TABLE[^;]+\+QUOTENAME\(/,'SQL EXEC concatenation cannot invoke QUOTENAME directly');
 assert.doesNotMatch(sql,/CHECK\(created_by>0\)|created_by=10021|CREATE (?:TABLE|FUNCTION|PROCEDURE|TRIGGER)|DISABLE TRIGGER|NOCHECK CONSTRAINT|GRANT /);
});

test('fresh installed username and native owner proofs gate the transaction and both before/after constraint phases',()=>{
 const sql=buildCleanPersonnelWorkSql({inboundOwnerLinks:true});
 for(const body of Object.values(buildCleanPersonnelUsernameRepairDefinitions().definitions))assert.ok(sql.includes(moduleHash(body)),'exact existing module pin');
 assert.match(sql,/SERIALIZABLE;BEGIN TRANSACTION/);assert.match(sql,/@Resource=N'CLEAN_STORE_DAY_20261022'/);
 assert.match(sql,/is_disabled=0 AND is_not_trusted=0/);
 assert.match(sql,/definition=N'\(\[created_by\]=\(18\)\)'/);
 assert.match(sql,/before_owner_constraints_json/);
 assert.match(sql,/CLEAN_INBOUND_OWNER_LINKS_CONFLICT/);
 assert.equal((sql.match(/EXEC dbo\.usp_clean_store_day_ready;/g)||[]).length,2);
 assert.doesNotMatch(sql,/ALTER PROCEDURE|ALTER TRIGGER|UPDATE dbo\.(?:users|roles|permissions|clean_.*manifest)/);
});

test('repair has exact replay, rollback probe, and no unsafe caller-controlled repair selector',()=>{
 assert.match(buildCleanPersonnelWorkSql({inboundOwnerLinks:true}),/B5_INBOUND_OWNER_LINKS_ALREADY_INSTALLED/);
 assert.match(buildCleanPersonnelWorkSql({inboundOwnerLinks:true,probe:true}),/ROLLBACK;SELECT N'B5_INBOUND_OWNER_LINKS_PROBE_ROLLED_BACK'/);
 assert.throws(()=>buildCleanPersonnelWorkSql({inboundOwnerLinks:'yes'}),/selector/);
});

test('existing work installer and installed username native bodies remain byte-identical',()=>{
 assert.equal(moduleHash(buildCleanPersonnelWorkSql()),'973825602EDF1BF6E2CE781FEFA02AD1C0AD456836E023288B9F851DF362511A');
 const d=buildCleanPersonnelUsernameRepairDefinitions().definitions;
 assert.equal(moduleHash(Object.entries(d).sort(([a],[b])=>a.localeCompare(b)).map(([n,v])=>n+'='+moduleHash(v)).join('|')),'282A4F651DFDA1D07CC315E135E2C4BB940B0535B30B408E0659EEADE65E4124');
});
