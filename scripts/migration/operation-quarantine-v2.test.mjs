import test from 'node:test';
import assert from 'node:assert/strict';
import {guardTables,guardSql,guardSqlV2,guardSqlV1Metadata,readerSqlV2,predicates,predicatesV2,heldV2,QUARANTINE_RESOLVER_V2_HASH,QUARANTINE_V2_MODULES,QUARANTINE_V2_LEGACY_MODULES,QUARANTINE_V2_PROOF_TRIGGER,assertQuarantineV2Sql} from './operation-quarantine-sql.mjs';
import {OPERATION_QUARANTINE_V2_HASH} from '../../apps/api/src/services/operationQuarantineService.js';
import {installQuarantineV2,upgradeToAdditiveV2,serializeQuarantineDefinitions,quarantineSqlHash} from './operation-quarantine-v2-runtime.mjs';
const seal='a'.repeat(64);
test('new supplier identities propagate through purchase, ledger, shared account, cash and test request guards',()=>{
 for(const table of ['suppliers','party_currency_accounts','purchase_invoices','purchase_invoice_items','supplier_movements','finance_account_movements','stock_movements','test_payment_suppliers','test_payment_requests','test_refund_requests']){
  const sql=predicatesV2[table]('x');assert.match(sql,/dbo\.suppliers pv2/);assert.match(sql,/dbo\.party_source_links lv2/);assert.match(sql,/lv2\.supplier_id=pv2\.id/);assert.match(sql,/CONVERT\(varbinary\(max\)/);assert.match(sql,/h\.source_key/);assert.match(sql,/h\.native_source_key/);assert.match(sql,/h\.source_company/);
 }
 const entity=predicatesV2.party_entities('x');assert.match(entity,/pv2\.party_entity_id=x\.id/);assert.match(entity,/lv2\.party_entity_id=x\.id/);assert.match(entity,/N'VEGA2026\/'\+h\.source_company/);
});
test('existing held products and historical default guard SQL remain unchanged',()=>{
 assert.equal(heldV2('product','x.id'),'EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N\'product\' AND h.native_id=x.id)');
 assert.equal(predicatesV2.products('x'),predicates.products('x'));
 assert.doesNotMatch(guardSql('supplier_movements',seal),/pv2|resolver_v2|assert_operation_quarantine_v2/);
 for(const t of guardTables){const s=guardSqlV2(t,seal);assert.match(s,/SELECT \* FROM inserted UNION ALL SELECT \* FROM deleted/);assert.match(s,/usp_assert_operation_quarantine_v2/);assert.doesNotMatch(s,/DISABLE TRIGGER|GRANT |UPDATE erp_migration\.operation_quarantine_holds/i);}
});
test('check reader blocks NULL historical native IDs by identical exact resolver, including ambiguous sources',()=>{
 const s=readerSqlV2('check',seal);assert.match(s,/CASE WHEN hm\.matches=0 THEN 0 ELSE 1 END/);assert.match(s,/COUNT\(\*\)>1 THEN N'AMBIGUOUS_SOURCE_HOLD'/);assert.match(s,/dbo\.suppliers pv2/);assert.match(s,/lv2\.source_record_key/);assert.match(s,/h\.native_id=q\.native_id/);
 assert.match(s,/2 resolver_version/);assert.match(s,/resolver_sealed/);assert.doesNotMatch(s,/CASE WHEN h\.native_id IS NULL THEN 0/);
 assert.equal(QUARANTINE_RESOLVER_V2_HASH,OPERATION_QUARANTINE_V2_HASH);
 const list=readerSqlV2('list',seal);assert.match(list,/WHERE native_id IS NULL\)<>4/);assert.match(list,/h\.status,h\.reasons_json/);assert.match(list,/2 resolver_version/);
});
test('transient metadata exception cannot cover ledger/product tables, deleted rows, nonadmin or executable batches',()=>{
 for(const t of['products','supplier_movements','finance_account_movements'])assert.throws(()=>guardSqlV2(t,seal,{metadataExceptionSql:'1=1'}),/METADATA_TABLE/);
 for(const p of['RETURN','1=1;DELETE dbo.suppliers','EXEC dbo.x'])assert.throws(()=>guardSqlV2('suppliers',seal,{metadataExceptionSql:p}),/METADATA_PREDICATE/);
 assert.throws(()=>guardSqlV2('suppliers',seal,{metadataExceptionSql:'1=1'}),/METADATA_SCOPE/);
 const predicate=`CONVERT(nvarchar(80),SESSION_CONTEXT(N'supplier_metadata_run'))=N'ERP-MIGPREP01-CARDS-20261008' AND EXISTS(SELECT 1 FROM #supplier_metadata_scope WHERE manifest_hash='${seal}') AND NOT EXISTS(SELECT 1 FROM inserted i LEFT JOIN #supplier_metadata_insert p ON p.source_key=i.source_record_key WHERE p.source_key IS NULL OR EXISTS(SELECT i.name EXCEPT SELECT JSON_VALUE(p.after_json,'$.name')) OR NOT EXISTS(SELECT 1 FROM OPENJSON(p.after_json)))`;
 const s=guardSqlV2('suppliers',seal,{metadataExceptionSql:predicate});assert.match(s,/IS_SRVROLEMEMBER\(N'sysadmin',ORIGINAL_LOGIN\(\)\)=1 AND NOT EXISTS\(SELECT 1 FROM deleted\)/);
 assert.ok(s.indexOf('manifest_hash=')<s.indexOf('EXEC dbo.usp_assert_operation_quarantine_v2'));
 const old=guardSqlV1Metadata('suppliers',seal,{metadataExceptionSql:predicate});assert.match(old,/CREATE TRIGGER dbo.operation_quarantine_suppliers/);assert.doesNotMatch(old,/usp_assert_operation_quarantine_v2/);
});
test('v2 proof pins exact79 modules, original FIRST and additive guards outside legacy aggregates',()=>{
 assert.equal(QUARANTINE_V2_MODULES.length,79);const s=assertQuarantineV2Sql();assert.match(s,/COUNT\(\*\).*<>79/);assert.match(s,/OBJECT_DEFINITION/);assert.match(s,/EXCEPT SELECT object_name/);for(const event of['Insert','Update','Delete'])assert.match(s,new RegExp('ExecIsFirst'+event+'Trigger'));
 assert.match(QUARANTINE_V2_PROOF_TRIGGER,/CREATE TRIGGER erp_migration\.immutable_supplier_identity_quarantine_v2 ON erp_migration\.operation_quarantine_resolver_v2/);assert.ok(QUARANTINE_V2_MODULES.includes('erp_migration.immutable_supplier_identity_quarantine_v2'));assert.doesNotMatch(s,/immutable_operation_quarantine_resolver_v2/);
 assert.equal(QUARANTINE_V2_MODULES.filter(n=>n.startsWith('dbo.operation_quarantine_')).length,37);assert.equal(QUARANTINE_V2_MODULES.filter(n=>n.startsWith('dbo.supplier_identity_quarantine_v2_')).length,37);
 assert.match(guardSqlV2('supplier_movements',seal),/CREATE TRIGGER dbo.supplier_identity_quarantine_v2_supplier_movements/);assert.match(s,/operation_quarantine_compatibility_v2/);assert.match(s,/9440b9cb8e73555c/);assert.match(s,/5d9cd41555f027f9/);for(const event of['Insert','Update','Delete'])assert.match(s,new RegExp('ExecIsLast'+event+'Trigger'));
 assert.doesNotMatch(s,/UPDATE |INSERT |DELETE |DISABLE |GRANT /);
});
test('installer rejects changed prestate and missing transaction proof before first DDL; it owns no connection',async()=>{
 const before=QUARANTINE_V2_LEGACY_MODULES.slice(0,39).map(object_name=>({object_name,definition_hash:'0'.repeat(64)}));const calls=[];
 await assert.rejects(installQuarantineV2({seal,metadataManifestHash:'a'.repeat(64),beforeDefinitions:before,query:async text=>{calls.push(text);return {recordset:before.map(r=>({...r,definition_hash:'1'.repeat(64)}))};}}),/BEFORE_DRIFT/);
 assert.equal(calls.length,2);assert.doesNotMatch(calls.join('\n'),/CREATE TABLE|ALTER TRIGGER/);assert.match(calls[0],/transaction_isolation_level=4/);assert.match(calls[0],/@@TRANCOUNT<1/);
 await assert.rejects(installQuarantineV2({seal,metadataManifestHash:'a'.repeat(64),beforeDefinitions:before.slice(1),query:async()=>{throw new Error('must not query');}}),/BEFORE_REQUIRED/);
});
test('compatibility upgrade rejects an arbitrary41 proof or a changed historical manifest before any SQL',async()=>{
 const original=guardTables.map(t=>{const definition=guardSql(t,seal);return {object_name:'dbo.operation_quarantine_'+t,definition,definition_hash:quarantineSqlHash(definition)};}),current=QUARANTINE_V2_LEGACY_MODULES.map(object_name=>({object_name,definition_hash:'0'.repeat(64)}));let calls=0;
 await assert.rejects(upgradeToAdditiveV2({seal,originalDefinitions:original,currentDefinitions:current,metadataManifestHash:'4dd3285c2ade83e8823c37e951b01241dea3a9e72ff8bd6a11287bda250a5662',query:async()=>{calls++;}}),/HISTORICAL_BINDING/);assert.equal(calls,0);
 assert.equal(serializeQuarantineDefinitions([{schema:'dbo',name:'b',hash:'A'.repeat(64)},{object_name:'dbo.a',definition_hash:'b'.repeat(64)}]),JSON.stringify([{object_name:'dbo.a',definition_hash:'b'.repeat(64)},{object_name:'dbo.b',definition_hash:'a'.repeat(64)}]));
});
