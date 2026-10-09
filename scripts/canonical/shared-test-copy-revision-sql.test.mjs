import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSharedCopyRevision,sharedGoodsCreatorGuardSQL,revisionImmutableSQL} from './shared-test-copy-revision-sql.mjs';
import {moduleHash,stage4NativeGuardSQL,stage4ReadySQL,COPY_DB,COPY_LOGIN} from './stage4-copy-sql.mjs';
import {stage4ContextSQL} from './stage4-copy-context-sql.mjs';
import {isolatedCopyHash,SHARED_COPY_DATABASE} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {sharedRevisionFixture} from '../../apps/api/src/services/isolatedOperationCopyRevision.test.mjs';
const schema=['id','created_by','state','decided_by','decided_at','reason','supplier_id','warehouse_id','note','created_at'].map(columnName=>({schemaName:'dbo',tableName:'test_goods_batches',columnName,typeName:columnName==='id'?'bigint':'nvarchar'}));
const adapt=s=>s.replaceAll(COPY_DB,SHARED_COPY_DATABASE).replaceAll(COPY_LOGIN,'melisa_shared_test_rw_20261009_01');
function fixture(){const raw=structuredClone(sharedRevisionFixture()),ready=adapt(stage4ReadySQL()),guard=adapt(stage4NativeGuardSQL(schema)),context=adapt(stage4ContextSQL());raw.sql.ready.hash=moduleHash(ready);raw.sql.context.hash=moduleHash(context);const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const newDefinitions=[{name:'dbo.usp_stage4_copy_ready',definition:ready,afterHash:moduleHash(ready)},{name:'dbo.usp_stage4_copy_guard',definition:guard,afterHash:moduleHash(guard)},{name:'dbo.usp_stage4_copy_context',definition:context,afterHash:moduleHash(context)}];return{config:{copyContext:raw},newDefinitions,moduleManifest:[...newDefinitions.map(({name,afterHash})=>({name,afterHash})),...Array.from({length:181},(_,i)=>({name:'dbo.other_'+i,afterHash:'A'.repeat(64)}))]};}
test('goods guard preserves all non-decision columns and binds exact receipt, actor and pending transition to existing intent',()=>{
 const sql=sharedGoodsCreatorGuardSQL(schema),branch=sql.slice(sql.indexOf("IF @table_name=N'test_goods_batches'"));
 assert.match(branch,/@actor<>16 OR @operation NOT IN\(N'goods_accept',N'goods_reject'\)/);assert.match(branch,/@target IS NULL OR TRY_CONVERT\(bigint,JSON_VALUE\(i.value,'\$\.id'\)\)<>@target/);
 assert.match(branch,/ISNULL\(JSON_VALUE\(d.value,'\$\.state'\),''\)<>N'pending'/);assert.match(branch,/WHEN N'goods_accept' THEN N'accepted' WHEN N'goods_reject' THEN N'rejected'/);assert.match(branch,/TRY_CONVERT\(bigint,JSON_VALUE\(i.value,'\$\.decided_by'\)\)<>@actor/);
 for(const key of ['id','created_by','supplier_id','warehouse_id','note','created_at'])assert.ok(branch.includes("N'"+key+"'"));assert.match(sql,/@operation=n.operation,@target=TRY_CONVERT\(bigint,JSON_VALUE\(n.payload_json,'\$\.id'\)\)/);assert.match(branch,/@operation<>N'count_submit'/);assert.match(sql,/CURRENT_TRANSACTION_ID\(\)/);
 assert.throws(()=>sharedGoodsCreatorGuardSQL(schema.filter(c=>c.columnName!=='decided_by')));
});
test('revision leaves sealed base and 184 original pins untouched, overriding exactly three required module hashes',()=>{
 const b=fixture(),before=JSON.stringify(b),a=buildSharedCopyRevision(b,schema);assert.equal(JSON.stringify(b),before);assert.equal(a.copyId,b.config.copyContext.copyId);assert.equal(a.baseSealHash,b.config.copyContext.sealHash);assert.deepEqual(a.replacements.map(m=>m.name),['dbo.usp_stage4_copy_ready','dbo.usp_stage4_copy_guard','dbo.usp_stage4_copy_context']);
 const ready=a.replacements[0].definition;assert.match(ready,/COALESCE\(r.after_hash,p.after_hash\)/);assert.match(ready,/r.before_hash=p.after_hash/);assert.match(ready,/stage4_copy_module_revisions\)<>3/);assert.match(ready,/immutable_stage4_copy_module_revisions/);assert.match(ready,/STAGE4_PRODUCT_SCOPE_DRIFT/);assert.match(ready,/STAGE4_PARTY_SCOPE_DRIFT/);
 const context=a.replacements[2].definition;for(const key of ['ready','context'])assert.ok(context.includes("r.name=N'dbo.usp_stage4_copy_"+key+"' AND r.before_hash=JSON_VALUE(@p,'$.sql."+key+".hash')"));assert.match(context,/ISNULL\(JSON_VALUE\(@p,'\$\.sql.begin.hash'\),''\)<>@begin/);assert.match(context,/ISNULL\(JSON_VALUE\(@p,'\$\.sql.effects.hash'\),''\)<>@effects/);assert.match(context,/EXEC dbo.usp_stage4_copy_ready @copy_id/);
 assert.match(revisionImmutableSQL,/EXISTS\(SELECT 1 FROM deleted\)/);assert.match(revisionImmutableSQL,/i.before_hash<>p.after_hash/);assert.doesNotMatch(a.tableSQL+'\n'+a.immutableSQL+'\n'+a.replacements.map(m=>m.definition).join('\n'),/DISABLE TRIGGER|UPDATE dbo.stage4_copy_(?:manifest|module_manifest)|DELETE FROM|CREATE LOGIN/i);
 const bad=fixture();bad.newDefinitions[1].definition+=' ';assert.throws(()=>buildSharedCopyRevision(bad,schema));assert.throws(()=>buildSharedCopyRevision(b,schema.concat({schemaName:'dbo',tableName:'test_goods_batches',columnName:'source_record_key',typeName:'nvarchar'})));
});
test('installer has fixed target, before/after hash seal, transaction rollback, no original writes or role changes',()=>{
 const s=fs.readFileSync(new URL('./shared-test-copy-revision-install.ps1',import.meta.url),'utf8');assert.match(s,/MELISA_ERP_CRM_SHARED_TEST_20261009_01/);assert.match(s,/BeginTransaction\(\[Data.IsolationLevel\]::Serializable\)/);assert.match(s,/SHARED_REVISION_MODULE_AFTER_DRIFT/);assert.match(s,/SHARED_REVISION_BUSINESS_OR_GUARD_DRIFT/);assert.match(s,/\$tx.Rollback\(\)/);assert.doesNotMatch(s,/DISABLE TRIGGER|DROP TABLE|DROP TRIGGER|CREATE LOGIN|GRANT.*EXECUTE|ALTER ROLE|Password=/i);
});
test('startup metadata grants cover only three pinned procedures and the registry parent table for two fresh technical principals',()=>{
 const s=fs.readFileSync(new URL('./shared-test-copy-revision-install.ps1',import.meta.url),'utf8'),grant=s.slice(s.indexOf("$phase='GRANT_FINITE_METADATA'"),s.indexOf("$phase='SNAPSHOT_AFTER'"));
 for(const name of ['dbo.usp_stage4_copy_ready','dbo.usp_stage4_copy_guard','dbo.usp_stage4_copy_context','dbo.stage4_copy_module_revisions','melisa_shared_test_ro_20261009_01','melisa_shared_test_rw_20261009_01'])assert.ok(grant.includes(name));
 assert.match(grant,/GRANT VIEW DEFINITION ON OBJECT::\$object TO \[\$principal\]/);assert.doesNotMatch(grant,/ON (?:DATABASE|SCHEMA)|GRANT EXECUTE|GRANT INSERT|GRANT UPDATE|GRANT DELETE|melisa_sirket|melisa_stage4|immutable_stage4_copy_module_revisions/);
 assert.ok(s.indexOf("$sqlCommitted=$true")<s.indexOf("$phase='CONFIG_ADJUNCT'"));assert.ok(s.indexOf("$proof.status='SQL_COMMITTED_CONFIG_WRITTEN'")<s.indexOf("$phase='CONFIG_ACL'"));
});
